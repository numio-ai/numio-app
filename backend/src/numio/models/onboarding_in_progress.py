"""In-progress AWS Guided onboarding state, persisted server-side per workspace.

A single row exists per workspace at most, allowing a Guided wizard run to
survive page refresh, browser close, or device switch. The row is created
when the user submits the Customize step, updated as the wizard advances,
and deleted on either successful account registration or explicit cancel.

Paste-back fields (AccessKeyId, SecretAccessKey, RoleArn, ExternalId,
AwsAccountId) and the rendered CFN template body are intentionally NOT
persisted — see tasks/done/20260426_bugfix_guided_wizard_state_persistence.md.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from numio.models.base import Base

# Steps the wizard is allowed to persist. Intro and Success are deliberately
# excluded: Intro is pre-submission so nothing is saved yet, and Success means
# the record has just been deleted by the registration-completed handler.
PERSISTED_STEPS = ("customize", "apply", "waiting", "verify")


class OnboardingInProgress(Base):
    __tablename__ = "onboarding_in_progress"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
    )
    label: Mapped[str] = mapped_column(String(64), nullable=False)
    step: Mapped[str] = mapped_column(String(16), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("workspace_id", name="uq_onboarding_in_progress_workspace_id"),
    )
