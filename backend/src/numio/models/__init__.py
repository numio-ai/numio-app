"""Database models package. Import all models here so Alembic can detect them."""

from numio.models.anomaly_threshold import AnomalyThreshold
from numio.models.api_key import ApiKey
from numio.models.attribution_rule import AttributionRule
from numio.models.audit_action_event import AuditActionEvent, AuditActionEventItem
from numio.models.audit_config_event import AuditConfigEvent
from numio.models.aws_account import AwsAccount
from numio.models.aws_org_tag_policy import AwsOrgTagPolicy
from numio.models.base import Base
from numio.models.budget import Budget
from numio.models.campaign import CampaignResource, RemediationCampaign
from numio.models.chat import ChatMessage, ChatSession
from numio.models.cloud_resource import CloudResource
from numio.models.compliance import ComplianceResult, ComplianceSnapshot
from numio.models.cost_record import CostRecord
from numio.models.finding import Finding, FindingTransition
from numio.models.finding_ack import FindingAck
from numio.models.infra_policy import InfraPolicy
from numio.models.job import IngestionStatus, JobRun, JobRunAccount
from numio.models.notification import Notification, NotificationPreference
from numio.models.onboarding_in_progress import OnboardingInProgress
from numio.models.recommendation import Recommendation
from numio.models.saved_query import SavedQuery
from numio.models.tag_policy import TagPolicy, TagPolicyRule
from numio.models.user import User
from numio.models.workspace import AutomationToggle, Workspace
from numio.models.zombie_threshold import ZombieThreshold

__all__ = [
    "AnomalyThreshold",
    "ApiKey",
    "AutomationToggle",
    "AttributionRule",
    "AuditActionEvent",
    "AuditActionEventItem",
    "AuditConfigEvent",
    "Base",
    "Budget",
    "ChatMessage",
    "ChatSession",
    "Workspace",
    "User",
    "AwsAccount",
    "AwsOrgTagPolicy",
    "JobRun",
    "JobRunAccount",
    "IngestionStatus",
    "CostRecord",
    "Finding",
    "FindingTransition",
    "FindingAck",
    "InfraPolicy",
    "Notification",
    "NotificationPreference",
    "OnboardingInProgress",
    "Recommendation",
    "SavedQuery",
    "CloudResource",
    "TagPolicy",
    "TagPolicyRule",
    "ComplianceResult",
    "ComplianceSnapshot",
    "RemediationCampaign",
    "CampaignResource",
    "ZombieThreshold",
]
