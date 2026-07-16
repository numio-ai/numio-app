"""Tests for background worker job framework: registry, runner, and API endpoints."""

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from numio.jobs.registry import JobRegistry
from numio.jobs.runner import run_job
from numio.models.job import IngestionStatus, JobRunAccount


# ---------------------------------------------------------------------------
# Job registry tests
# ---------------------------------------------------------------------------
class TestJobRegistry:
    def test_register_and_get(self):
        registry = JobRegistry()

        async def dummy_job(account_id: str) -> int:
            return 42

        registry.register("test_job", dummy_job, description="A test job", interval_seconds=60)

        job_def = registry.get("test_job")
        assert job_def is not None
        assert job_def.job_type == "test_job"
        assert job_def.description == "A test job"
        assert job_def.interval_seconds == 60
        assert job_def.func is dummy_job

    def test_get_nonexistent_returns_none(self):
        registry = JobRegistry()
        assert registry.get("nonexistent") is None

    def test_list_types(self):
        registry = JobRegistry()

        async def job_a(account_id: str) -> int:
            return 1

        async def job_b(account_id: str) -> int:
            return 2

        registry.register("job_a", job_a, description="Job A")
        registry.register("job_b", job_b, description="Job B")

        types = registry.list_types()
        assert len(types) == 2
        type_names = {t.job_type for t in types}
        assert type_names == {"job_a", "job_b"}


# ---------------------------------------------------------------------------
# Job runner tests
# ---------------------------------------------------------------------------
class TestJobRunner:
    async def test_successful_run_records_all_accounts(self, db_session):
        """All accounts succeed — job status should be 'success'."""

        async def success_job(account_id: str) -> int:
            return 100

        job_run = await run_job(
            job_type="test_success",
            job_func=success_job,
            session=db_session,
            workspace_id="ws-test",
            accounts=["acct-1", "acct-2"],
        )

        assert job_run.status == "success"
        assert job_run.finished_at is not None
        assert job_run.workspace_id == "ws-test"
        assert job_run.job_type == "test_success"

        # Verify account results
        result = await db_session.execute(
            select(JobRunAccount).where(JobRunAccount.job_run_id == job_run.id)
        )
        accounts = result.scalars().all()
        assert len(accounts) == 2
        assert all(a.status == "success" for a in accounts)
        assert all(a.record_count == 100 for a in accounts)

    async def test_per_account_failure_isolation(self, db_session):
        """One account fails, others succeed — job status should be 'partial'."""

        async def mixed_job(account_id: str) -> int:
            if account_id == "acct-bad":
                raise RuntimeError("Simulated failure")
            return 50

        job_run = await run_job(
            job_type="test_partial",
            job_func=mixed_job,
            session=db_session,
            workspace_id="ws-test",
            accounts=["acct-good", "acct-bad"],
        )

        assert job_run.status == "partial"

        result = await db_session.execute(
            select(JobRunAccount).where(JobRunAccount.job_run_id == job_run.id)
        )
        accounts = {a.account_id: a for a in result.scalars().all()}

        assert accounts["acct-good"].status == "success"
        assert accounts["acct-good"].record_count == 50
        assert accounts["acct-bad"].status == "failure"
        assert "Simulated failure" in accounts["acct-bad"].error_details

    async def test_all_accounts_fail(self, db_session):
        """All accounts fail — job status should be 'failure'."""

        async def fail_job(account_id: str) -> int:
            raise RuntimeError("All fail")

        job_run = await run_job(
            job_type="test_failure",
            job_func=fail_job,
            session=db_session,
            workspace_id="ws-test",
            accounts=["acct-1", "acct-2"],
        )

        assert job_run.status == "failure"

    async def test_ingestion_status_created_on_run(self, db_session):
        """Running a job creates/updates ingestion status records."""

        async def status_job(account_id: str) -> int:
            return 25

        await run_job(
            job_type="test_ingestion",
            job_func=status_job,
            session=db_session,
            workspace_id="ws-ing",
            accounts=["acct-x"],
        )

        result = await db_session.execute(
            select(IngestionStatus).where(
                IngestionStatus.workspace_id == "ws-ing",
                IngestionStatus.account_id == "acct-x",
                IngestionStatus.data_source == "test_ingestion",
            )
        )
        status = result.scalar_one_or_none()
        assert status is not None
        assert status.last_status == "success"
        assert status.record_count == 25
        assert status.last_sync_at is not None

    async def test_account_selection_by_status(self, db_session, default_workspace_id):
        """run_job must include `connected`/`incomplete`, exclude `disconnected`/`inactive`.

        Regression test for the bug where the runner filtered on a non-existent
        "active" status, causing all scheduled jobs to be skipped even after
        successful connectivity validation.
        """
        from numio.models.aws_account import AwsAccount

        fixtures = {
            "100000000001": "connected",
            "100000000002": "incomplete",
            "100000000003": "disconnected",
            "100000000004": "inactive",
        }
        for aws_id, status in fixtures.items():
            db_session.add(
                AwsAccount(
                    workspace_id=default_workspace_id,
                    aws_account_id=aws_id,
                    alias=aws_id,
                    role_arn=f"arn:aws:iam::{aws_id}:role/NumioRead",
                    status=status,
                )
            )
        await db_session.flush()

        seen: list[str] = []

        async def capture_job(account_id: str) -> int:
            seen.append(account_id)
            return 1

        job_run = await run_job(
            job_type="test_status_filter",
            job_func=capture_job,
            session=db_session,
            workspace_id=default_workspace_id,
        )

        assert job_run.status == "success"
        assert set(seen) == {"100000000001", "100000000002"}

    async def test_ingestion_status_updated_on_rerun(self, db_session):
        """Running the same job again updates the existing ingestion status."""

        async def rerun_job(account_id: str) -> int:
            return 10

        await run_job(
            job_type="test_rerun",
            job_func=rerun_job,
            session=db_session,
            workspace_id="ws-rerun",
            accounts=["acct-r"],
        )

        # Run again with higher count
        async def rerun_job_v2(account_id: str) -> int:
            return 99

        await run_job(
            job_type="test_rerun",
            job_func=rerun_job_v2,
            session=db_session,
            workspace_id="ws-rerun",
            accounts=["acct-r"],
        )

        result = await db_session.execute(
            select(IngestionStatus).where(
                IngestionStatus.workspace_id == "ws-rerun",
                IngestionStatus.account_id == "acct-r",
                IngestionStatus.data_source == "test_rerun",
            )
        )
        statuses = result.scalars().all()
        # Should still be exactly one record (updated, not duplicated)
        assert len(statuses) == 1
        assert statuses[0].record_count == 99


# ---------------------------------------------------------------------------
# API endpoint tests
# ---------------------------------------------------------------------------
class TestJobsAPI:
    @pytest.fixture
    async def client(self, db_session):
        """Create a test client that overrides DB session with the test session."""
        from numio.db.session import get_session
        from numio.main import app

        async def _override_session():
            yield db_session

        app.dependency_overrides[get_session] = _override_session
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            yield c
        app.dependency_overrides.pop(get_session, None)

    async def test_list_job_types(self, client):
        resp = await client.get("/api/v1/jobs/types")
        assert resp.status_code == 200
        data = resp.json()
        assert "job_types" in data
        assert len(data["job_types"]) >= 1
        # sample_ingestion should be registered
        type_names = {j["job_type"] for j in data["job_types"]}
        assert "sample_ingestion" in type_names

    async def test_trigger_nonexistent_job_returns_404(self, client):
        resp = await client.post("/api/v1/jobs/nonexistent_job_xyz/trigger")
        assert resp.status_code == 404

    async def test_trigger_job_returns_run_id(self, client):
        resp = await client.post("/api/v1/jobs/sample_ingestion/trigger")
        assert resp.status_code == 200
        data = resp.json()
        assert "job_run_id" in data
        assert data["job_type"] == "sample_ingestion"
        assert data["status"] in ("success", "partial", "failure", "skipped")

    async def test_job_history_returns_runs(self, client):
        # Trigger a job first to ensure there's history
        await client.post("/api/v1/jobs/sample_ingestion/trigger")

        resp = await client.get("/api/v1/jobs/history")
        assert resp.status_code == 200
        data = resp.json()
        assert "runs" in data
        assert len(data["runs"]) >= 1

        run = data["runs"][0]
        assert "id" in run
        assert "job_type" in run
        assert "status" in run
        assert "account_results" in run

    async def test_job_history_limit_param(self, client):
        resp = await client.get("/api/v1/jobs/history?limit=1")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["runs"]) <= 1

    async def test_ingestion_status_endpoint(self, client):
        # Trigger a job — with no registered accounts, job is skipped
        await client.post("/api/v1/jobs/sample_ingestion/trigger")

        resp = await client.get("/api/v1/jobs/ingestion-status")
        assert resp.status_code == 200
        data = resp.json()
        assert "statuses" in data
        # No registered accounts in test DB → no per-account ingestion records
        assert isinstance(data["statuses"], list)
