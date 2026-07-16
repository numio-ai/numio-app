"""Workspace-scoped data access layer for AWS accounts."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from numio.models.aws_account import AwsAccount
from numio.schemas.aws_account import RegisterAccountRequest, UpdateAccountRequest


class AwsAccountRepository:
    """CRUD operations for AwsAccount — all queries are scoped by workspace_id."""

    def __init__(self, session: AsyncSession, workspace_id: str) -> None:
        self._session = session
        self._workspace_id = workspace_id

    async def create(self, data: RegisterAccountRequest) -> AwsAccount:
        account = AwsAccount(
            workspace_id=self._workspace_id,
            aws_account_id=data.aws_account_id,
            alias=data.alias or data.aws_account_id,
            role_arn=data.role_arn,
            tag_writer_role_arn=data.tag_writer_role_arn,
            aws_access_key_id=data.aws_access_key_id,
            aws_secret_access_key=data.aws_secret_access_key,
            external_id=data.external_id,
            environment_label=data.environment_label,
            status="disconnected",
            cur_s3_bucket=data.cur_s3_bucket,
            cur_s3_prefix=data.cur_s3_prefix,
            cur_report_name=data.cur_report_name,
            cur_managed_by_numio=data.cur_managed_by_numio,
        )
        self._session.add(account)
        await self._session.commit()
        await self._session.refresh(account)
        return account

    async def list_by_workspace(self) -> list[AwsAccount]:
        result = await self._session.execute(
            select(AwsAccount).where(AwsAccount.workspace_id == self._workspace_id)
        )
        return list(result.scalars().all())

    async def get_by_id(self, account_id: uuid.UUID) -> AwsAccount | None:
        result = await self._session.execute(
            select(AwsAccount).where(
                AwsAccount.id == account_id,
                AwsAccount.workspace_id == self._workspace_id,
            )
        )
        return result.scalar_one_or_none()

    async def get_by_aws_account_id(self, aws_account_id: str) -> AwsAccount | None:
        result = await self._session.execute(
            select(AwsAccount).where(
                AwsAccount.aws_account_id == aws_account_id,
                AwsAccount.workspace_id == self._workspace_id,
            )
        )
        return result.scalar_one_or_none()

    async def update(self, account_id: uuid.UUID, data: UpdateAccountRequest) -> AwsAccount | None:
        account = await self.get_by_id(account_id)
        if account is None:
            return None
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(account, field, value)
        await self._session.commit()
        await self._session.refresh(account)
        return account

    async def soft_delete(self, account_id: uuid.UUID) -> AwsAccount | None:
        account = await self.get_by_id(account_id)
        if account is None:
            return None
        account.status = "inactive"
        await self._session.commit()
        await self._session.refresh(account)
        return account

    async def hard_delete(self, account_id: uuid.UUID) -> bool:
        account = await self.get_by_id(account_id)
        if account is None:
            return False
        await self._session.delete(account)
        await self._session.commit()
        return True

    async def set_tag_writer_role_arn(
        self, account_id: uuid.UUID, value: str | None
    ) -> AwsAccount | None:
        account = await self.get_by_id(account_id)
        if account is None:
            return None
        account.tag_writer_role_arn = value
        await self._session.commit()
        await self._session.refresh(account)
        return account

    async def update_status(
        self, account_id: uuid.UUID, status: str, status_message: str | None = None
    ) -> AwsAccount | None:
        account = await self.get_by_id(account_id)
        if account is None:
            return None
        account.status = status
        account.status_message = status_message
        await self._session.commit()
        await self._session.refresh(account)
        return account
