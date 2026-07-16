"""REST API endpoints for AWS Organizations tag policy sync and inspection."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from numio.core.auth import AuthenticatedUser, get_current_user, require_role
from numio.core.aws_org_tag_policy_service import sync as sync_org_tag_policy
from numio.db.aws_org_tag_policy_repository import AwsOrgTagPolicyRepository
from numio.db.session import get_session
from numio.schemas.aws_org_tag_policy import (
    AwsOrgTagPolicyListResponse,
    AwsOrgTagPolicyResponse,
    OrgPolicySyncResponse,
)

router = APIRouter(prefix="/aws-org-tag-policy", tags=["aws-org-tag-policy"])


@router.get(
    "",
    response_model=AwsOrgTagPolicyListResponse,
    summary="List synced AWS Organizations tag policy rules",
)
async def list_aws_org_tag_policy(
    current_user: AuthenticatedUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AwsOrgTagPolicyListResponse:
    repo = AwsOrgTagPolicyRepository(session, str(current_user.workspace_id))
    rows = await repo.list_by_workspace()
    return AwsOrgTagPolicyListResponse(
        policies=[AwsOrgTagPolicyResponse.model_validate(r) for r in rows],
        count=len(rows),
    )


@router.post(
    "/sync",
    response_model=OrgPolicySyncResponse,
    summary="Trigger an on-demand AWS Organizations tag policy sync",
)
async def trigger_aws_org_tag_policy_sync(
    current_user: AuthenticatedUser = Depends(require_role("admin")),
    session: AsyncSession = Depends(get_session),
) -> OrgPolicySyncResponse:
    rows = await sync_org_tag_policy(session, str(current_user.workspace_id))
    if rows > 0:
        message = f"Synced {rows} AWS Org tag policy rule(s) from the management account."
    else:
        message = (
            "No AWS Organizations tag policy was synced. The workspace may not be on "
            "AWS Organizations, or the management account is not connected with tag "
            "writes enabled."
        )
    return OrgPolicySyncResponse(rows_upserted=rows, message=message)
