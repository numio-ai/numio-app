"""Workspace-scoped data access layer for AWS Organizations tag policy rows."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from numio.models.aws_org_tag_policy import AwsOrgTagPolicy


class AwsOrgTagPolicyRepository:
    """Read/upsert operations for the synced AWS Org tag policy — scoped by workspace."""

    def __init__(self, session: AsyncSession, workspace_id: str) -> None:
        self._session = session
        self._workspace_id = workspace_id

    async def list_by_workspace(self) -> list[AwsOrgTagPolicy]:
        result = await self._session.execute(
            select(AwsOrgTagPolicy)
            .where(AwsOrgTagPolicy.workspace_id == self._workspace_id)
            .order_by(AwsOrgTagPolicy.tag_key)
        )
        return list(result.scalars().all())

    async def upsert(
        self,
        *,
        tag_key: str,
        required: bool,
        allowed_values: list[str] | None,
        case_sensitive: bool,
        source_policy_id: str | None,
        source_policy_arn: str | None,
        raw: dict | None,
    ) -> None:
        """Insert or update the row for (workspace, tag_key)."""
        existing = (
            await self._session.execute(
                select(AwsOrgTagPolicy).where(
                    AwsOrgTagPolicy.workspace_id == self._workspace_id,
                    AwsOrgTagPolicy.tag_key == tag_key,
                )
            )
        ).scalar_one_or_none()

        now = datetime.now(timezone.utc)
        if existing is None:
            self._session.add(
                AwsOrgTagPolicy(
                    id=uuid.uuid4(),
                    workspace_id=self._workspace_id,
                    tag_key=tag_key,
                    required=required,
                    allowed_values=allowed_values,
                    case_sensitive=case_sensitive,
                    source_policy_id=source_policy_id,
                    source_policy_arn=source_policy_arn,
                    raw=raw,
                    synced_at=now,
                )
            )
        else:
            existing.required = required
            existing.allowed_values = allowed_values
            existing.case_sensitive = case_sensitive
            existing.source_policy_id = source_policy_id
            existing.source_policy_arn = source_policy_arn
            existing.raw = raw
            existing.synced_at = now

    async def delete_keys_not_in(self, keep_keys: set[str]) -> int:
        """Drop rows whose tag_key is no longer present in the effective policy."""
        rows = await self.list_by_workspace()
        stale = [r.tag_key for r in rows if r.tag_key not in keep_keys]
        if not stale:
            return 0
        await self._session.execute(
            delete(AwsOrgTagPolicy).where(
                AwsOrgTagPolicy.workspace_id == self._workspace_id,
                AwsOrgTagPolicy.tag_key.in_(stale),
            )
        )
        return len(stale)
