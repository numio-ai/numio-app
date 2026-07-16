"""Tests for the in-progress Guided onboarding state endpoints."""

from __future__ import annotations

import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from numio.models.onboarding_in_progress import OnboardingInProgress
from numio.models.workspace import Workspace

VALID_LABEL = "wkt-aws-onboarding"


@pytest.fixture
async def api_client(db_session):
    """httpx AsyncClient bound to the FastAPI app, sharing the test DB session."""
    from numio.db.session import get_session
    from numio.main import app

    async def _override_get_session():
        yield db_session

    app.dependency_overrides[get_session] = _override_get_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
    app.dependency_overrides.pop(get_session, None)


class TestInProgressEndpoint:
    async def test_get_returns_204_when_no_record(self, api_client):
        resp = await api_client.get("/api/v1/onboarding/in-progress")
        assert resp.status_code == 204

    async def test_put_creates_record(self, api_client, db_session, default_workspace_id):
        resp = await api_client.put(
            "/api/v1/onboarding/in-progress",
            json={"label": VALID_LABEL, "step": "apply"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["label"] == VALID_LABEL
        assert body["step"] == "apply"
        assert "created_at" in body and "updated_at" in body

        rows = (
            (
                await db_session.execute(
                    select(OnboardingInProgress).where(
                        OnboardingInProgress.workspace_id == uuid.UUID(default_workspace_id)
                    )
                )
            )
            .scalars()
            .all()
        )
        assert len(rows) == 1

    async def test_get_returns_record_after_put(self, api_client):
        await api_client.put(
            "/api/v1/onboarding/in-progress",
            json={"label": VALID_LABEL, "step": "waiting"},
        )
        resp = await api_client.get("/api/v1/onboarding/in-progress")
        assert resp.status_code == 200
        assert resp.json()["step"] == "waiting"
        assert resp.json()["label"] == VALID_LABEL

    async def test_put_updates_existing_record_no_parallel_row(
        self, api_client, db_session, default_workspace_id
    ):
        await api_client.put(
            "/api/v1/onboarding/in-progress",
            json={"label": VALID_LABEL, "step": "apply"},
        )
        resp = await api_client.put(
            "/api/v1/onboarding/in-progress",
            json={"label": VALID_LABEL, "step": "verify"},
        )
        assert resp.status_code == 200
        assert resp.json()["step"] == "verify"

        rows = (
            (
                await db_session.execute(
                    select(OnboardingInProgress).where(
                        OnboardingInProgress.workspace_id == uuid.UUID(default_workspace_id)
                    )
                )
            )
            .scalars()
            .all()
        )
        assert len(rows) == 1, "PUT must update, not create a parallel row"
        assert rows[0].step == "verify"

    async def test_put_rejects_invalid_label(self, api_client):
        resp = await api_client.put(
            "/api/v1/onboarding/in-progress",
            json={"label": "Has_Bad_Chars", "step": "apply"},
        )
        assert resp.status_code == 422

    async def test_put_rejects_unknown_step(self, api_client):
        resp = await api_client.put(
            "/api/v1/onboarding/in-progress",
            json={"label": VALID_LABEL, "step": "intro"},
        )
        assert resp.status_code == 422
        resp = await api_client.put(
            "/api/v1/onboarding/in-progress",
            json={"label": VALID_LABEL, "step": "success"},
        )
        assert resp.status_code == 422

    async def test_put_accepts_all_valid_steps(self, api_client):
        for step in ("customize", "apply", "waiting", "verify"):
            resp = await api_client.put(
                "/api/v1/onboarding/in-progress",
                json={"label": VALID_LABEL, "step": step},
            )
            assert resp.status_code == 200, f"step {step!r} should be accepted"

    async def test_delete_removes_record(self, api_client):
        await api_client.put(
            "/api/v1/onboarding/in-progress",
            json={"label": VALID_LABEL, "step": "apply"},
        )
        resp = await api_client.delete("/api/v1/onboarding/in-progress")
        assert resp.status_code == 204
        get_resp = await api_client.get("/api/v1/onboarding/in-progress")
        assert get_resp.status_code == 204

    async def test_delete_is_idempotent(self, api_client):
        resp = await api_client.delete("/api/v1/onboarding/in-progress")
        assert resp.status_code == 204
        # Second call without a record still 204.
        resp = await api_client.delete("/api/v1/onboarding/in-progress")
        assert resp.status_code == 204


class TestWorkspaceIsolation:
    """In-progress records belong to one workspace and are invisible to others."""

    async def test_records_are_per_workspace(self, api_client, db_session, default_workspace_id):
        # Default workspace puts a record via the API.
        await api_client.put(
            "/api/v1/onboarding/in-progress",
            json={"label": "default-label", "step": "apply"},
        )
        # Insert a record for a second workspace directly via the repository
        # (no second auth identity wired in tests).
        other_ws = Workspace(name="other", slug=f"other-{uuid.uuid4().hex[:8]}")
        db_session.add(other_ws)
        await db_session.commit()
        await db_session.refresh(other_ws)

        from numio.db.onboarding_in_progress_repository import (
            OnboardingInProgressRepository,
        )

        other_repo = OnboardingInProgressRepository(db_session, other_ws.id)
        await other_repo.upsert(label="other-label", step="verify")

        # The default workspace API still sees only its own record.
        resp = await api_client.get("/api/v1/onboarding/in-progress")
        assert resp.status_code == 200
        body = resp.json()
        assert body["label"] == "default-label"
        assert body["step"] == "apply"

        # And the other workspace's record is intact.
        other_row = await other_repo.get()
        assert other_row is not None
        assert other_row.label == "other-label"
        assert other_row.step == "verify"

    async def test_unique_constraint_prevents_two_rows_per_workspace(
        self, db_session, default_workspace_id
    ):
        from sqlalchemy.exc import IntegrityError

        ws_id = uuid.UUID(default_workspace_id)
        db_session.add(OnboardingInProgress(workspace_id=ws_id, label="a", step="apply"))
        await db_session.commit()
        db_session.add(OnboardingInProgress(workspace_id=ws_id, label="b", step="verify"))
        with pytest.raises(IntegrityError):
            await db_session.commit()
        await db_session.rollback()
