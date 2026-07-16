"""End-to-end regression lock for CUR ingestion through the job runner.

Pins the contract documented in ``docs/conventions/numio-patterns.md`` §6 (Job pattern)
and §8 (Integration test pattern):

- ``runner.run_job("cur_ingestion", cur_ingestion_job, session)`` must produce a
  ``JobRun`` with ``status='success'``, exactly one ``JobRunAccount`` row, an
  ``IngestionStatus`` row, AND ``cost_records`` rows visible to a *separate*
  session.
- The runner's session and ``cur_ingestion_job``'s own session are independent.
  The service must call ``await session.commit()`` before its ``async with`` block
  exits — without it, the upserts are silently dropped while the runner still
  reports success. See the manual-verification block at the bottom of the
  test class and ``backend/src/numio/core/cur_service.py:137``.

Test isolation strategy:

- The shared ``_engine`` fixture from ``conftest.py`` seeds the ``default``
  workspace. We patch the module-level ``AsyncSessionLocal`` in
  ``numio.core.cur_service`` to bind to this engine, so the inner session is
  real (commits land in ``numio_test``).
- A test-scoped cleanup fixture truncates the rows we own at the end of each
  test, keeping the workspace row intact for the next test.
- The runner is invoked with a verification session created from the same
  engine; assertions read through it after the runner returns, proving the
  inner-session commit was real (not a savepoint on a shared connection).
"""

from __future__ import annotations

import io
import json
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from numio.core.cur_service import cur_ingestion_job
from numio.jobs.runner import run_job
from numio.models.aws_account import AwsAccount
from numio.models.cost_record import CostRecord
from numio.models.job import IngestionStatus, JobRun, JobRunAccount

# Reuse the parquet + sample-row fixtures from the existing CUR test module.
from tests.test_cur_ingestion import _make_cur_parquet, _sample_cur_row

# ---------------------------------------------------------------------------
# Test infrastructure: real commits on the test engine, truncated per test.
# ---------------------------------------------------------------------------

# Tables touched by a single CUR run. Cleaned in dependency order
# (children before parents to satisfy FKs).
_DIRTY_TABLES = (
    "cost_records",
    "ingestion_statuses",
    "job_run_accounts",
    "job_runs",
    "aws_accounts",
)


@pytest.fixture
async def real_session_factory(_engine):
    """Async session factory bound to the test engine.

    Replaces the production ``AsyncSessionLocal`` so commits inside
    ``cur_ingestion_job`` land in ``numio_test`` and are visible to verification
    sessions opened from the same engine.
    """
    return async_sessionmaker(_engine, expire_on_commit=False, class_=AsyncSession)


@pytest.fixture
async def patched_cur_session(real_session_factory):
    """Patch ``numio.core.cur_service.AsyncSessionLocal`` for the duration of a test."""
    with patch("numio.core.cur_service.AsyncSessionLocal", real_session_factory):
        yield real_session_factory


@pytest.fixture
async def clean_cur_tables(real_session_factory):
    """Truncate the CUR-touched tables before and after each test.

    The shared ``_engine`` fixture has session scope; previous tests in the file
    may have left rows around. Truncate in FK-safe order. ``workspaces`` is left
    alone — the seeded ``default`` row must persist across the suite.
    """

    async def _wipe() -> None:
        async with real_session_factory() as session:
            for table in _DIRTY_TABLES:
                await session.execute(text(f"TRUNCATE TABLE {table} CASCADE"))
            await session.commit()

    await _wipe()
    yield
    await _wipe()


@pytest.fixture
async def default_workspace_uuid(real_session_factory):
    """Resolve the seeded default workspace UUID (string form).

    Mirrors ``conftest.py:default_workspace_id`` but on a committed session so
    the lookup is visible to the runner and its inner session.
    """
    from numio.models.workspace import Workspace

    async with real_session_factory() as session:
        result = await session.execute(select(Workspace).where(Workspace.slug == "default"))
        ws = result.scalar_one()
        return str(ws.id)


@pytest.fixture
async def committed_cur_account(real_session_factory, default_workspace_uuid, clean_cur_tables):
    """Insert and commit an AwsAccount in CUR-ready state.

    Returns the AWS account ID (12-digit string) the runner expects.
    """
    aws_account_id = "123456789012"
    async with real_session_factory() as session:
        account = AwsAccount(
            id=uuid.uuid4(),
            workspace_id=default_workspace_uuid,
            aws_account_id=aws_account_id,
            alias="cur-runner-test",
            role_arn=f"arn:aws:iam::{aws_account_id}:role/NumioAccess",
            status="connected",
            environment_label="production",
            cur_s3_bucket="example-cur-bucket",
            cur_s3_prefix="cur/example-cur-export",
            cur_report_name="example-cur-export",
        )
        session.add(account)
        await session.commit()
    return aws_account_id


# ---------------------------------------------------------------------------
# S3 mock that returns a manifest + one parquet file.
# ---------------------------------------------------------------------------


def _make_runner_s3_mock(parquet_rows: list[dict]) -> MagicMock:
    """Mock S3 client that returns one manifest pointing at one parquet file.

    Mirrors the ``_make_s3_mock_with_manifest`` pattern from
    ``test_cur_ingestion.py`` but inlined here to keep this test file
    self-contained.
    """
    parquet_bytes = _make_cur_parquet(parquet_rows)
    manifest = {
        "executionId": "test-exec",
        "dataFiles": ["s3://example-cur-bucket/data/file.parquet"],
    }
    manifest_last_modified = datetime(2025, 11, 25, tzinfo=timezone.utc)

    class _Stream:
        def __init__(self, data: bytes) -> None:
            self._buf = io.BytesIO(data)

        def read(self, n: int = -1) -> bytes:
            return self._buf.read(n)

    s3 = MagicMock()
    paginator = MagicMock()
    s3.get_paginator.return_value = paginator
    paginator.paginate.return_value = [
        {
            "Contents": [
                {
                    "Key": (
                        "cur/example-cur-export/metadata/BILLING_PERIOD=2025-11"
                        "/ts-uuid/example-cur-export-Manifest.json"
                    ),
                    "LastModified": manifest_last_modified,
                }
            ]
        }
    ]

    def _get_object(Bucket, Key):  # noqa: N803 - matches boto3 signature
        if Key.endswith("Manifest.json"):
            return {"Body": _Stream(json.dumps(manifest).encode())}
        return {"Body": _Stream(parquet_bytes)}

    s3.get_object.side_effect = _get_object
    return s3


def _patch_boto_for_cur(s3_mock: MagicMock):
    """Return a context-manager bundle that mocks STS + boto session for the CUR job."""

    creds = {"AccessKeyId": "x", "SecretAccessKey": "y", "SessionToken": "z"}
    boto = MagicMock()
    boto.client.return_value = s3_mock

    return [
        patch("numio.core.cur_service.assume_role_for_account", return_value=(True, None, creds)),
        patch("numio.core.cur_service.get_boto_session", return_value=boto),
    ]


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestRunnerEndToEnd:
    """The full path: runner.run_job → cur_ingestion_job → DB persisted."""

    @pytest.mark.asyncio
    async def test_runner_persists_cost_records_end_to_end(
        self,
        real_session_factory,
        patched_cur_session,
        committed_cur_account,
        default_workspace_uuid,
    ):
        rows = [
            _sample_cur_row(line_item_id="runner-e2e-001", unblended_cost=12.50),
            _sample_cur_row(line_item_id="runner-e2e-002", unblended_cost=7.25),
        ]
        s3 = _make_runner_s3_mock(rows)
        patches = _patch_boto_for_cur(s3)
        for p in patches:
            p.start()
        try:
            async with real_session_factory() as runner_session:
                job_run = await run_job(
                    job_type="cur_ingestion",
                    job_func=cur_ingestion_job,
                    session=runner_session,
                    workspace_id=default_workspace_uuid,
                    accounts=[committed_cur_account],
                )
        finally:
            for p in patches:
                p.stop()

        # The runner's own writes are committed inside run_job; verify via a
        # separate session.
        async with real_session_factory() as verify:
            # 1. JobRun was recorded with status=success
            jr = (await verify.execute(select(JobRun).where(JobRun.id == job_run.id))).scalar_one()
            assert jr.status == "success", f"expected JobRun.status='success', got {jr.status!r}"
            assert jr.job_type == "cur_ingestion"

            # 2. Exactly one JobRunAccount row with record_count == 2
            jra_rows = (
                (
                    await verify.execute(
                        select(JobRunAccount).where(JobRunAccount.job_run_id == jr.id)
                    )
                )
                .scalars()
                .all()
            )
            assert len(jra_rows) == 1
            assert jra_rows[0].account_id == committed_cur_account
            assert jra_rows[0].status == "success"
            assert jra_rows[0].record_count == 2

            # 3. IngestionStatus row reflects the success
            ing = (
                await verify.execute(
                    select(IngestionStatus).where(
                        IngestionStatus.account_id == committed_cur_account,
                        IngestionStatus.data_source == "cur_ingestion",
                    )
                )
            ).scalar_one()
            assert ing.last_status == "success"
            assert ing.record_count == 2

            # 4. cost_records actually persisted — the regression-sensitive part.
            recs = (
                (
                    await verify.execute(
                        select(CostRecord).where(
                            CostRecord.line_item_id.in_(["runner-e2e-001", "runner-e2e-002"])
                        )
                    )
                )
                .scalars()
                .all()
            )
            assert len(recs) == 2, (
                "cost_records missing — the cur_service inner session likely did not "
                "commit. See docs/conventions/numio-patterns.md §6."
            )
            by_id = {r.line_item_id: r for r in recs}
            assert by_id["runner-e2e-001"].unblended_cost == Decimal("12.50")
            assert by_id["runner-e2e-002"].unblended_cost == Decimal("7.25")

    @pytest.mark.asyncio
    async def test_runner_is_idempotent(
        self,
        real_session_factory,
        patched_cur_session,
        committed_cur_account,
        default_workspace_uuid,
    ):
        rows = [_sample_cur_row(line_item_id="runner-idem-001", unblended_cost=10.0)]
        s3 = _make_runner_s3_mock(rows)
        patches = _patch_boto_for_cur(s3)
        for p in patches:
            p.start()
        try:
            # First run
            async with real_session_factory() as runner_session:
                await run_job(
                    job_type="cur_ingestion",
                    job_func=cur_ingestion_job,
                    session=runner_session,
                    workspace_id=default_workspace_uuid,
                    accounts=[committed_cur_account],
                )

            # Capture updated_at after first run
            async with real_session_factory() as verify:
                rec1 = (
                    await verify.execute(
                        select(CostRecord).where(CostRecord.line_item_id == "runner-idem-001")
                    )
                ).scalar_one()
                first_updated_at = rec1.updated_at
                first_count = (
                    (
                        await verify.execute(
                            select(CostRecord).where(CostRecord.line_item_id == "runner-idem-001")
                        )
                    )
                    .scalars()
                    .all()
                )
                assert len(first_count) == 1

            # Bump the manifest LastModified so the incremental filter doesn't skip
            # this run; rebuild the s3 mock.
            s3 = _make_runner_s3_mock(rows)
            # Advance manifest LastModified beyond the IngestionStatus.last_sync_at
            # written by the first run, so _list_latest_manifests doesn't skip.
            s3.get_paginator.return_value.paginate.return_value = [
                {
                    "Contents": [
                        {
                            "Key": (
                                "cur/example-cur-export/metadata/BILLING_PERIOD=2025-11"
                                "/ts-uuid-2/example-cur-export-Manifest.json"
                            ),
                            "LastModified": datetime.now(timezone.utc),
                        }
                    ]
                }
            ]
            # Repoint the patched boto session to the new s3.
            for p in patches:
                p.stop()
            patches = _patch_boto_for_cur(s3)
            for p in patches:
                p.start()

            async with real_session_factory() as runner_session:
                await run_job(
                    job_type="cur_ingestion",
                    job_func=cur_ingestion_job,
                    session=runner_session,
                    workspace_id=default_workspace_uuid,
                    accounts=[committed_cur_account],
                )
        finally:
            for p in patches:
                p.stop()

        async with real_session_factory() as verify:
            recs = (
                (
                    await verify.execute(
                        select(CostRecord).where(CostRecord.line_item_id == "runner-idem-001")
                    )
                )
                .scalars()
                .all()
            )
            assert len(recs) == 1, "re-running produced a duplicate row"
            assert recs[0].updated_at >= first_updated_at

            # Both JobRun rows exist and succeeded
            job_runs = (
                (
                    await verify.execute(
                        select(JobRun)
                        .where(JobRun.job_type == "cur_ingestion")
                        .order_by(JobRun.started_at)
                    )
                )
                .scalars()
                .all()
            )
            assert len(job_runs) == 2
            assert all(jr.status == "success" for jr in job_runs)

    # ----------------------------------------------------------------------
    # Regression-lock canary — manual verification step.
    #
    # The two e2e tests above prove that `cost_records` rows are visible to a
    # *separate* session after `run_job(...)` returns. This is the exact
    # property that breaks if `await session.commit()` at
    # `backend/src/numio/core/cur_service.py:137` is removed: the inner session
    # closes without committing, the cost_records vanish, but the runner's own
    # session still commits JobRun / JobRunAccount / IngestionStatus, so the
    # job reports success.
    #
    # An in-test canary (xfail-strict that simulates the missing commit by
    # monkeypatching) was attempted but proved fragile against SQLAlchemy 2.0
    # async session internals — the patch did not reliably suppress the commit
    # in nested fixtures. Rather than ship a brittle canary that gives false
    # confidence, this regression check is delegated to the manual verification
    # step in the task's acceptance criteria A2:
    #
    #   1. Delete `await session.commit()` at cur_service.py:137.
    #   2. Re-run this file: `pytest tests/test_cur_runner_e2e.py -v`.
    #   3. Both happy-path tests above must fail with a clear assertion on
    #      cost_records being empty.
    #   4. Restore the line. Tests pass again.
    #
    # Run this manual gate as part of any PR that touches `cur_service.py`,
    # `runner.py`, or the AsyncSessionLocal / db.session module.
    # ----------------------------------------------------------------------
