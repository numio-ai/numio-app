"""Tests for AWS account registration, repository, API endpoints, and validation."""

import uuid
from unittest.mock import MagicMock, patch

import pytest
from botocore.exceptions import ClientError
from httpx import ASGITransport, AsyncClient

from numio.core.aws_service import validate_account
from numio.db.aws_account_repository import AwsAccountRepository
from numio.schemas.aws_account import (
    RegisterAccountRequest,
    UpdateAccountRequest,
    ValidationResult,
    ValidationStepResult,
)

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

SAMPLE_ROLE_ARN = "arn:aws:iam::123456789012:role/NumioReadAccess"
SAMPLE_TAG_WRITER_ARN = "arn:aws:iam::123456789012:role/NumioTagWriterRole-Cfn-x"
SAMPLE_AWS_ACCOUNT_ID = "123456789012"
SAMPLE_ACCESS_KEY = "AKIAIOSFODNN7EXAMPLE"
SAMPLE_SECRET_KEY = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
SAMPLE_EXTERNAL_ID = "test-external-id-123"


@pytest.fixture
def account_factory(db_session):
    """Factory fixture for creating AwsAccount objects within a workspace."""
    _counter = 0

    async def _create(
        workspace_id: str = "ws-test",
        aws_account_id: str | None = None,
        alias: str | None = None,
        role_arn: str | None = None,
        environment_label: str = "production",
    ):
        nonlocal _counter
        _counter += 1
        repo = AwsAccountRepository(db_session, workspace_id)
        data = RegisterAccountRequest(
            aws_account_id=aws_account_id or f"{100000000000 + _counter}",
            alias=alias or f"Test Account {_counter}",
            role_arn=role_arn or f"arn:aws:iam::{100000000000 + _counter}:role/TestRole",
            aws_access_key_id=SAMPLE_ACCESS_KEY,
            aws_secret_access_key=SAMPLE_SECRET_KEY,
            external_id=SAMPLE_EXTERNAL_ID,
            environment_label=environment_label,
        )
        return await repo.create(data)

    return _create


# ---------------------------------------------------------------------------
# Repository tests
# ---------------------------------------------------------------------------


class TestAwsAccountRepository:
    async def test_create_account(self, db_session, account_factory):
        account = await account_factory()
        assert account.id is not None
        assert account.status == "disconnected"  # initial before validation
        assert account.workspace_id == "ws-test"
        assert account.aws_access_key_id == SAMPLE_ACCESS_KEY

    async def test_list_by_workspace(self, db_session, account_factory):
        await account_factory(
            workspace_id="ws-a", aws_account_id="111111111111"
        )
        await account_factory(
            workspace_id="ws-a", aws_account_id="222222222222"
        )
        await account_factory(
            workspace_id="ws-b", aws_account_id="333333333333"
        )

        repo_a = AwsAccountRepository(db_session, "ws-a")
        repo_b = AwsAccountRepository(db_session, "ws-b")

        accounts_a = await repo_a.list_by_workspace()
        accounts_b = await repo_b.list_by_workspace()

        assert len(accounts_a) == 2
        assert len(accounts_b) == 1

    async def test_get_by_id(self, db_session, account_factory):
        account = await account_factory()
        repo = AwsAccountRepository(db_session, "ws-test")
        fetched = await repo.get_by_id(account.id)
        assert fetched is not None
        assert fetched.id == account.id

    async def test_get_by_id_wrong_workspace(
        self, db_session, account_factory
    ):
        account = await account_factory(workspace_id="ws-owner")
        repo = AwsAccountRepository(db_session, "ws-other")
        fetched = await repo.get_by_id(account.id)
        assert fetched is None

    async def test_get_by_aws_account_id(
        self, db_session, account_factory
    ):
        await account_factory(aws_account_id="999999999999")
        repo = AwsAccountRepository(db_session, "ws-test")
        fetched = await repo.get_by_aws_account_id("999999999999")
        assert fetched is not None
        assert fetched.aws_account_id == "999999999999"

    async def test_update(self, db_session, account_factory):
        account = await account_factory()
        repo = AwsAccountRepository(db_session, "ws-test")
        updated = await repo.update(
            account.id,
            UpdateAccountRequest(
                alias="New Alias", environment_label="staging"
            ),
        )
        assert updated is not None
        assert updated.alias == "New Alias"
        assert updated.environment_label == "staging"

    async def test_update_partial(self, db_session, account_factory):
        account = await account_factory(alias="Original")
        repo = AwsAccountRepository(db_session, "ws-test")
        updated = await repo.update(
            account.id, UpdateAccountRequest(alias="Changed")
        )
        assert updated is not None
        assert updated.alias == "Changed"
        assert updated.environment_label == account.environment_label

    async def test_update_nonexistent(self, db_session):
        repo = AwsAccountRepository(db_session, "ws-test")
        result = await repo.update(
            uuid.uuid4(), UpdateAccountRequest(alias="x")
        )
        assert result is None

    async def test_soft_delete(self, db_session, account_factory):
        account = await account_factory()
        repo = AwsAccountRepository(db_session, "ws-test")
        deleted = await repo.soft_delete(account.id)
        assert deleted is not None
        assert deleted.status == "inactive"

    async def test_soft_delete_nonexistent(self, db_session):
        repo = AwsAccountRepository(db_session, "ws-test")
        result = await repo.soft_delete(uuid.uuid4())
        assert result is None

    async def test_workspace_isolation(self, db_session, account_factory):
        """Accounts in workspace A must not be visible from workspace B."""
        acct_a = await account_factory(
            workspace_id="ws-alpha", aws_account_id="111111111111"
        )
        await account_factory(
            workspace_id="ws-beta", aws_account_id="222222222222"
        )

        repo_beta = AwsAccountRepository(db_session, "ws-beta")
        assert await repo_beta.get_by_id(acct_a.id) is None
        assert (
            await repo_beta.get_by_aws_account_id("111111111111") is None
        )


# ---------------------------------------------------------------------------
# AWS service tests (mocked)
# ---------------------------------------------------------------------------


class TestValidateAccount:
    """Test the 4-step validation flow with mocked boto3."""

    @patch("numio.core.aws_service.boto3.Session")
    def test_full_success_without_cur(self, mock_session_class):
        """Steps 1-2 pass, steps 3-4 skip (no CUR config)."""
        mock_session = MagicMock()
        mock_session_class.return_value = mock_session
        mock_sts = MagicMock()
        mock_session.client.return_value = mock_sts

        mock_sts.get_caller_identity.return_value = {
            "Arn": "arn:aws:iam::123456789012:user/numio-service"
        }
        mock_sts.assume_role.return_value = {
            "Credentials": {
                "AccessKeyId": "ASIA...",
                "SecretAccessKey": "secret",
                "SessionToken": "token",
            }
        }

        result = validate_account(
            aws_access_key_id=SAMPLE_ACCESS_KEY,
            aws_secret_access_key=SAMPLE_SECRET_KEY,
            role_arn=SAMPLE_ROLE_ARN,
            external_id=SAMPLE_EXTERNAL_ID,
        )
        assert result.overall_status == "incomplete"
        assert len(result.steps) == 5
        assert result.steps[0].status == "pass"  # verify_credentials
        assert result.steps[1].status == "pass"  # assume_role
        assert result.steps[2].status == "skip"  # s3_list
        assert result.steps[3].status == "skip"  # s3_read
        assert result.steps[4].status == "skip"  # tag_writer_assume_role (not configured)
        assert result.steps[4].name == "tag_writer_assume_role"

    @patch("numio.core.aws_service.boto3.Session")
    def test_credential_failure(self, mock_session_class):
        """Step 1 fails, all others skipped."""
        mock_session = MagicMock()
        mock_session_class.return_value = mock_session
        mock_sts = MagicMock()
        mock_session.client.return_value = mock_sts

        mock_sts.get_caller_identity.side_effect = ClientError(
            {
                "Error": {
                    "Code": "InvalidClientTokenId",
                    "Message": "The security token is invalid",
                },
                "ResponseMetadata": {"RequestId": "req-123"},
            },
            "GetCallerIdentity",
        )

        result = validate_account(
            aws_access_key_id="BAD_KEY",
            aws_secret_access_key="BAD_SECRET",
            role_arn=SAMPLE_ROLE_ARN,
            external_id=SAMPLE_EXTERNAL_ID,
        )
        assert result.overall_status == "disconnected"
        assert result.steps[0].status == "fail"
        assert "InvalidClientTokenId" in result.steps[0].error
        assert result.steps[0].remediation is not None
        # All others skipped
        assert all(s.status == "skip" for s in result.steps[1:])

    @patch("numio.core.aws_service.boto3.Session")
    def test_assume_role_failure(self, mock_session_class):
        """Step 1 passes, step 2 fails, steps 3-4 skipped."""
        mock_session = MagicMock()
        mock_session_class.return_value = mock_session
        mock_sts = MagicMock()
        mock_session.client.return_value = mock_sts

        mock_sts.get_caller_identity.return_value = {
            "Arn": "arn:aws:iam::123456789012:user/numio-service"
        }
        mock_sts.assume_role.side_effect = ClientError(
            {
                "Error": {
                    "Code": "AccessDenied",
                    "Message": "Not authorized",
                },
                "ResponseMetadata": {"RequestId": "req-456"},
            },
            "AssumeRole",
        )

        result = validate_account(
            aws_access_key_id=SAMPLE_ACCESS_KEY,
            aws_secret_access_key=SAMPLE_SECRET_KEY,
            role_arn=SAMPLE_ROLE_ARN,
            external_id=SAMPLE_EXTERNAL_ID,
        )
        assert result.overall_status == "disconnected"
        assert result.steps[0].status == "pass"
        assert result.steps[1].status == "fail"
        assert "AccessDenied" in result.steps[1].error
        assert all(s.status == "skip" for s in result.steps[2:])

    @patch("numio.core.aws_service.boto3.Session")
    def test_tag_writer_step_pass(self, mock_session_class):
        """Step 5 passes when the tag-writer role assumes; status unchanged."""
        mock_session = MagicMock()
        mock_session_class.return_value = mock_session
        mock_sts = MagicMock()
        mock_session.client.return_value = mock_sts
        mock_sts.get_caller_identity.return_value = {"Arn": "arn:aws:iam::123:user/svc"}
        mock_sts.assume_role.return_value = {
            "Credentials": {"AccessKeyId": "ASIA", "SecretAccessKey": "s", "SessionToken": "t"}
        }

        result = validate_account(
            aws_access_key_id=SAMPLE_ACCESS_KEY,
            aws_secret_access_key=SAMPLE_SECRET_KEY,
            role_arn=SAMPLE_ROLE_ARN,
            external_id=SAMPLE_EXTERNAL_ID,
            tag_writer_role_arn=SAMPLE_TAG_WRITER_ARN,
        )
        step5 = result.steps[-1]
        assert step5.name == "tag_writer_assume_role"
        assert step5.status == "pass"
        # No CUR config → reader path is incomplete; step 5 must not change that.
        assert result.overall_status == "incomplete"

    @patch("numio.core.aws_service.boto3.Session")
    def test_tag_writer_step_fail_does_not_change_status(self, mock_session_class):
        """A tag-writer assume failure is recorded but does not downgrade status."""
        mock_session = MagicMock()
        mock_session_class.return_value = mock_session
        mock_sts = MagicMock()
        mock_session.client.return_value = mock_sts
        mock_sts.get_caller_identity.return_value = {"Arn": "arn:aws:iam::123:user/svc"}

        def _assume(**kwargs):
            if kwargs["RoleArn"] == SAMPLE_TAG_WRITER_ARN:
                raise ClientError(
                    {
                        "Error": {"Code": "AccessDenied", "Message": "no"},
                        "ResponseMetadata": {"RequestId": "r"},
                    },
                    "AssumeRole",
                )
            return {
                "Credentials": {"AccessKeyId": "ASIA", "SecretAccessKey": "s", "SessionToken": "t"}
            }

        mock_sts.assume_role.side_effect = _assume

        result = validate_account(
            aws_access_key_id=SAMPLE_ACCESS_KEY,
            aws_secret_access_key=SAMPLE_SECRET_KEY,
            role_arn=SAMPLE_ROLE_ARN,
            external_id=SAMPLE_EXTERNAL_ID,
            tag_writer_role_arn=SAMPLE_TAG_WRITER_ARN,
        )
        assert result.steps[1].status == "pass"  # reader assume_role still ok
        step5 = result.steps[-1]
        assert step5.name == "tag_writer_assume_role"
        assert step5.status == "fail"
        assert "AccessDenied" in step5.error
        assert result.overall_status == "incomplete"  # unchanged by writer failure

    @patch("numio.core.aws_service.boto3.Session")
    def test_tag_writer_step_skips_when_credentials_fail(self, mock_session_class):
        """When step 1 fails, the tag-writer step skips rather than running."""
        mock_session = MagicMock()
        mock_session_class.return_value = mock_session
        mock_sts = MagicMock()
        mock_session.client.return_value = mock_sts
        mock_sts.get_caller_identity.side_effect = ClientError(
            {
                "Error": {"Code": "InvalidClientTokenId", "Message": "bad"},
                "ResponseMetadata": {"RequestId": "r"},
            },
            "GetCallerIdentity",
        )

        result = validate_account(
            aws_access_key_id=SAMPLE_ACCESS_KEY,
            aws_secret_access_key=SAMPLE_SECRET_KEY,
            role_arn=SAMPLE_ROLE_ARN,
            external_id=SAMPLE_EXTERNAL_ID,
            tag_writer_role_arn=SAMPLE_TAG_WRITER_ARN,
        )
        step5 = result.steps[-1]
        assert step5.name == "tag_writer_assume_role"
        assert step5.status == "skip"
        assert result.overall_status == "disconnected"


# ---------------------------------------------------------------------------
# API endpoint tests
# ---------------------------------------------------------------------------

# Required fields for POST /api/v1/accounts
_REQUIRED_FIELDS = {
    "aws_access_key_id": SAMPLE_ACCESS_KEY,
    "aws_secret_access_key": SAMPLE_SECRET_KEY,
    "external_id": SAMPLE_EXTERNAL_ID,
}


def _mock_validate_connected(**kwargs):
    """Return a fully connected validation result."""
    return ValidationResult(
        steps=[
            ValidationStepResult(
                name="verify_credentials",
                label="Verify AWS credentials",
                status="pass",
                detail="Authenticated as arn:aws:iam::123:user/svc",
            ),
            ValidationStepResult(
                name="assume_role",
                label="Assume customer role",
                status="pass",
                detail="Assumed role",
            ),
            ValidationStepResult(
                name="s3_list",
                label="List CUR objects in S3",
                status="skip",
                detail="CUR configuration not provided",
            ),
            ValidationStepResult(
                name="s3_read",
                label="Read CUR file from S3",
                status="skip",
                detail="CUR configuration not provided",
            ),
        ],
        overall_status="incomplete",
    )


def _mock_validate_disconnected(**kwargs):
    """Return a disconnected validation result."""
    return ValidationResult(
        steps=[
            ValidationStepResult(
                name="verify_credentials",
                label="Verify AWS credentials",
                status="fail",
                error="InvalidClientTokenId: bad key",
                remediation="Check credentials",
            ),
            ValidationStepResult(
                name="assume_role",
                label="Assume customer role",
                status="skip",
                detail="Skipped",
            ),
            ValidationStepResult(
                name="s3_list",
                label="List CUR objects in S3",
                status="skip",
                detail="Skipped",
            ),
            ValidationStepResult(
                name="s3_read",
                label="Read CUR file from S3",
                status="skip",
                detail="Skipped",
            ),
        ],
        overall_status="disconnected",
    )


def _connected_steps():
    return [
        ValidationStepResult(
            name="verify_credentials", label="Verify AWS credentials", status="pass"
        ),
        ValidationStepResult(name="assume_role", label="Assume customer role", status="pass"),
        ValidationStepResult(name="s3_list", label="List CUR objects in S3", status="skip"),
        ValidationStepResult(name="s3_read", label="Read CUR file from S3", status="skip"),
    ]


def _mock_validate_tag_writer_pass(**kwargs):
    """Reader path incomplete, tag-writer step passes."""
    return ValidationResult(
        steps=[
            *_connected_steps(),
            ValidationStepResult(
                name="tag_writer_assume_role",
                label="Assume tag-writer role",
                status="pass",
                detail="Assumed",
            ),
        ],
        overall_status="incomplete",
    )


def _mock_validate_tag_writer_fail(**kwargs):
    """Reader path incomplete, tag-writer step fails."""
    return ValidationResult(
        steps=[
            *_connected_steps(),
            ValidationStepResult(
                name="tag_writer_assume_role",
                label="Assume tag-writer role",
                status="fail",
                error="AccessDenied: trust policy mismatch",
            ),
        ],
        overall_status="incomplete",
    )


def _make_test_app(db_session, validate_side_effect):
    """Create a test app with overridden DB session and mocked validation."""
    from numio.db.session import get_session
    from numio.main import app

    async def _override_get_session():
        yield db_session

    app.dependency_overrides[get_session] = _override_get_session

    with patch(
        "numio.api.accounts.validate_account",
        side_effect=validate_side_effect,
    ):
        yield app

    app.dependency_overrides.pop(get_session, None)


class TestAccountAPI:
    """API endpoint tests with mocked AWS validation."""

    @pytest.fixture
    def app_with_mocked_aws(self, db_session):
        yield from _make_test_app(db_session, _mock_validate_connected)

    @pytest.fixture
    async def client(self, app_with_mocked_aws):
        transport = ASGITransport(app=app_with_mocked_aws)
        async with AsyncClient(
            transport=transport, base_url="http://test"
        ) as c:
            yield c

    async def test_register_account(self, client):
        resp = await client.post(
            "/api/v1/accounts",
            json={
                "aws_account_id": "111111111111",
                "alias": "My Account",
                "role_arn": "arn:aws:iam::111111111111:role/NumioRole",
                **_REQUIRED_FIELDS,
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["account"]["aws_account_id"] == "111111111111"
        assert data["account"]["alias"] == "My Account"
        assert data["account"]["status"] == "incomplete"
        assert data["validation"]["overall_status"] == "incomplete"
        # Credentials are redacted
        assert "aws_secret_access_key" not in data["account"]
        assert data["account"]["aws_access_key_id_hint"] is not None

    async def test_register_without_cur_config(self, client):
        """CUR config is optional — account is still created."""
        resp = await client.post(
            "/api/v1/accounts",
            json={
                "aws_account_id": "222222222222",
                "role_arn": "arn:aws:iam::222222222222:role/NumioRole",
                **_REQUIRED_FIELDS,
            },
        )
        assert resp.status_code == 201

    async def test_register_duplicate_account(self, client):
        payload = {
            "aws_account_id": "444444444444",
            "alias": "Dup Account",
            "role_arn": "arn:aws:iam::444444444444:role/NumioRole",
            **_REQUIRED_FIELDS,
        }
        resp1 = await client.post("/api/v1/accounts", json=payload)
        assert resp1.status_code == 201

        resp2 = await client.post("/api/v1/accounts", json=payload)
        assert resp2.status_code == 409

    async def test_list_accounts(self, client):
        await client.post(
            "/api/v1/accounts",
            json={
                "aws_account_id": "555555555555",
                "alias": "List Test",
                "role_arn": "arn:aws:iam::555555555555:role/NumioRole",
                **_REQUIRED_FIELDS,
            },
        )
        resp = await client.get("/api/v1/accounts")
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] >= 1
        assert isinstance(data["accounts"], list)

    async def test_get_account(self, client):
        create_resp = await client.post(
            "/api/v1/accounts",
            json={
                "aws_account_id": "666666666666",
                "alias": "Get Test",
                "role_arn": "arn:aws:iam::666666666666:role/NumioRole",
                **_REQUIRED_FIELDS,
            },
        )
        account_id = create_resp.json()["account"]["id"]

        resp = await client.get(f"/api/v1/accounts/{account_id}")
        assert resp.status_code == 200
        assert resp.json()["id"] == account_id

    async def test_get_nonexistent_account(self, client):
        fake_id = str(uuid.uuid4())
        resp = await client.get(f"/api/v1/accounts/{fake_id}")
        assert resp.status_code == 404

    async def test_update_account(self, client):
        create_resp = await client.post(
            "/api/v1/accounts",
            json={
                "aws_account_id": "777777777777",
                "alias": "Before Update",
                "role_arn": "arn:aws:iam::777777777777:role/NumioRole",
                **_REQUIRED_FIELDS,
            },
        )
        account_id = create_resp.json()["account"]["id"]

        resp = await client.put(
            f"/api/v1/accounts/{account_id}",
            json={
                "alias": "After Update",
                "environment_label": "staging",
            },
        )
        assert resp.status_code == 200
        put_data = resp.json()
        assert put_data["account"]["alias"] == "After Update"
        assert put_data["account"]["environment_label"] == "staging"

    async def test_deactivate_account(self, client):
        create_resp = await client.post(
            "/api/v1/accounts",
            json={
                "aws_account_id": "888888888888",
                "alias": "Deactivate Test",
                "role_arn": "arn:aws:iam::888888888888:role/NumioRole",
                **_REQUIRED_FIELDS,
            },
        )
        account_id = create_resp.json()["account"]["id"]

        resp = await client.post(
            f"/api/v1/accounts/{account_id}/deactivate"
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "inactive"

        get_resp = await client.get(f"/api/v1/accounts/{account_id}")
        assert get_resp.status_code == 200
        assert get_resp.json()["status"] == "inactive"

    async def test_delete_account_permanent(self, client):
        create_resp = await client.post(
            "/api/v1/accounts",
            json={
                "aws_account_id": "777777777778",
                "alias": "Delete Test",
                "role_arn": "arn:aws:iam::777777777778:role/NumioRole",
                **_REQUIRED_FIELDS,
            },
        )
        account_id = create_resp.json()["account"]["id"]

        resp = await client.delete(f"/api/v1/accounts/{account_id}")
        assert resp.status_code == 204

        get_resp = await client.get(f"/api/v1/accounts/{account_id}")
        assert get_resp.status_code == 404

    async def test_invalid_aws_account_id_format(self, client):
        resp = await client.post(
            "/api/v1/accounts",
            json={
                "aws_account_id": "short",
                "alias": "Bad ID",
                "role_arn": "arn:aws:iam::123456789012:role/NumioRole",
                **_REQUIRED_FIELDS,
            },
        )
        assert resp.status_code == 422

    async def test_invalid_role_arn_format(self, client):
        resp = await client.post(
            "/api/v1/accounts",
            json={
                "aws_account_id": "123456789012",
                "alias": "Bad ARN",
                "role_arn": "not-a-valid-arn",
                **_REQUIRED_FIELDS,
            },
        )
        assert resp.status_code == 422


class TestAccountAPIDisconnected:
    """Test API behavior when validation returns disconnected status."""

    @pytest.fixture
    def app_with_failed_aws(self, db_session):
        yield from _make_test_app(
            db_session, _mock_validate_disconnected
        )

    @pytest.fixture
    async def client(self, app_with_failed_aws):
        transport = ASGITransport(app=app_with_failed_aws)
        async with AsyncClient(
            transport=transport, base_url="http://test"
        ) as c:
            yield c

    async def test_register_with_bad_credentials_still_creates(
        self, client
    ):
        """Account is created even when validation fails."""
        resp = await client.post(
            "/api/v1/accounts",
            json={
                "aws_account_id": "999999999999",
                "alias": "Disconnected",
                "role_arn": "arn:aws:iam::999999999999:role/NumioRole",
                **_REQUIRED_FIELDS,
            },
        )
        # Account is always persisted now
        assert resp.status_code == 201
        data = resp.json()
        assert data["account"]["status"] == "disconnected"
        assert data["validation"]["overall_status"] == "disconnected"
        assert data["validation"]["steps"][0]["status"] == "fail"


class TestAccountAPITagWriterPersistence:
    """The tag_writer_role_arn column is persisted only when step 5 passes."""

    _PAYLOAD = {
        "aws_account_id": "555555555555",
        "alias": "Writer Account",
        "role_arn": "arn:aws:iam::555555555555:role/NumioReadAccess",
        "tag_writer_role_arn": "arn:aws:iam::555555555555:role/NumioTagWriterRole-Cfn-x",
        **_REQUIRED_FIELDS,
    }

    async def _client(self, db_session, validate_mock):
        from numio.db.session import get_session
        from numio.main import app

        async def _override():
            yield db_session

        app.dependency_overrides[get_session] = _override
        with patch("numio.api.accounts.validate_account", side_effect=validate_mock):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as c:
                yield c
        app.dependency_overrides.pop(get_session, None)

    async def test_persisted_when_step5_passes(self, db_session):
        gen = self._client(db_session, _mock_validate_tag_writer_pass)
        client = await gen.__anext__()
        try:
            resp = await client.post("/api/v1/accounts", json=self._PAYLOAD)
            assert resp.status_code == 201
            assert (
                resp.json()["account"]["tag_writer_role_arn"]
                == self._PAYLOAD["tag_writer_role_arn"]
            )
        finally:
            with pytest.raises(StopAsyncIteration):
                await gen.__anext__()

    async def test_cleared_when_step5_fails(self, db_session):
        gen = self._client(db_session, _mock_validate_tag_writer_fail)
        client = await gen.__anext__()
        try:
            resp = await client.post("/api/v1/accounts", json=self._PAYLOAD)
            assert resp.status_code == 201
            # Step 5 failed → column must be cleared even though the user supplied an ARN.
            assert resp.json()["account"]["tag_writer_role_arn"] is None
        finally:
            with pytest.raises(StopAsyncIteration):
                await gen.__anext__()
