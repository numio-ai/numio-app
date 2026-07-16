"""Per-tenant CloudFormation template generator for Numio AWS onboarding.

The rendered template provisions everything Numio needs inside the customer's
AWS account in a single stack apply:

  * An IAM user ``NumioServiceUser-Cfn-<label>`` with a long-lived access key.
    The access key id and secret appear in the stack ``Outputs`` so the
    customer can copy them back into the Numio UI.
  * An IAM role ``NumioCurReaderRole-Cfn-<label>`` that is trusted by that
    user. The trust policy carries an ``sts:ExternalId`` condition bound to
    the workspace's external id (embedded at render time as a parameter
    default with ``NoEcho`` so it is not displayed in the AWS console
    parameter list).
  * An inline managed policy attached to the role granting the minimum set of
    read-only permissions Numio uses: CUR S3 bucket read, Cost Explorer,
    Resource Groups tagging, and generic Describe* calls used for resource
    inventory.

Every CFN-managed resource is named with a per-instance ``label`` supplied by
the operator at template-generation time. The label has two jobs: it lets
multiple Numio instances coexist in one AWS account without IAM-name
collisions, and it lets an AWS admin tell at a glance which IAM resources
are managed by which Numio CloudFormation stack (the manual / Advanced
onboarding flow uses the same brand prefix without the ``-Cfn-<label>``
suffix).

The module has no AWS SDK dependency — it only emits a YAML document and a
CloudFormation console quick-create URL. All I/O stays in the API layer.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Literal
from urllib.parse import quote, urlencode

import yaml

DEFAULT_REGION = "us-east-1"
DEFAULT_CUR_PATH_PREFIX = "cur"

# Path prefix used by the auto-provisioned CUR export in create_new mode.
# Matches the legacy "{prefix}/metadata/..." layout that ``cur_service.py``
# already understands; aligning here removes one source of integration drift.
CREATE_NEW_CUR_PATH_PREFIX = "daily"

# Canonical CUR 2.0 "Standard data export" column list — what AWS Billing's
# Data Exports wizard emits as the QueryStatement for a CUR 2.0 export.
# AWS does not accept ``SELECT *`` in BCMDataExports::Export; the columns
# must be enumerated, and they must be a subset of what the table actually
# exposes for the chosen TableConfigurations.
#
# This list mirrors the SELECT statement AWS Billing's Standard data export
# wizard generates, with one addition: ``line_item_resource_id``. That
# column is only present when ``INCLUDE_RESOURCES: TRUE`` (Numio enables it
# below for resource-level cost attribution); the wizard's default-OFF
# preset omits both the flag and the column.
#
# The list deliberately excludes the ``split_line_item_*`` columns because
# Numio leaves ``INCLUDE_SPLIT_COST_ALLOCATION_DATA: FALSE`` (split EC2
# allocation is out of scope for the v0 Guided onboarding). Those columns
# do not exist in the table without that flag, so listing them would fail
# stack create with "columns not a subset of the table". The same applies
# to the new capacity-reservation and IAM-principal columns, both gated
# behind their own flags.
_CUR_V2_STANDARD_COLUMNS = (
    "bill_bill_type, bill_billing_entity, bill_billing_period_end_date, "
    "bill_billing_period_start_date, bill_invoice_id, bill_invoicing_entity, "
    "bill_payer_account_id, bill_payer_account_name, cost_category, discount, "
    "discount_bundled_discount, discount_total_discount, identity_line_item_id, "
    "identity_time_interval, line_item_availability_zone, "
    "line_item_blended_cost, line_item_blended_rate, line_item_currency_code, "
    "line_item_legal_entity, line_item_line_item_description, "
    "line_item_line_item_type, line_item_net_unblended_cost, "
    "line_item_net_unblended_rate, line_item_normalization_factor, "
    "line_item_normalized_usage_amount, line_item_operation, "
    "line_item_product_code, line_item_resource_id, line_item_tax_type, "
    "line_item_unblended_cost, line_item_unblended_rate, "
    "line_item_usage_account_id, line_item_usage_account_name, "
    "line_item_usage_amount, line_item_usage_end_date, "
    "line_item_usage_start_date, line_item_usage_type, "
    "line_item_user_identifier, pricing_currency, "
    "pricing_lease_contract_length, pricing_offering_class, "
    "pricing_public_on_demand_cost, pricing_public_on_demand_rate, "
    "pricing_purchase_option, pricing_rate_code, pricing_rate_id, "
    "pricing_term, pricing_unit, product, product_comment, product_fee_code, "
    "product_fee_description, product_from_location, "
    "product_from_location_type, product_from_region_code, "
    "product_instance_family, product_instance_type, product_instancesku, "
    "product_location, product_location_type, product_operation, "
    "product_pricing_unit, product_product_family, product_region_code, "
    "product_servicecode, product_sku, product_to_location, "
    "product_to_location_type, product_to_region_code, product_usagetype, "
    "reservation_amortized_upfront_cost_for_usage, "
    "reservation_amortized_upfront_fee_for_billing_period, "
    "reservation_availability_zone, reservation_effective_cost, "
    "reservation_end_time, reservation_modification_status, "
    "reservation_net_amortized_upfront_cost_for_usage, "
    "reservation_net_amortized_upfront_fee_for_billing_period, "
    "reservation_net_effective_cost, reservation_net_recurring_fee_for_usage, "
    "reservation_net_unused_amortized_upfront_fee_for_billing_period, "
    "reservation_net_unused_recurring_fee, reservation_net_upfront_value, "
    "reservation_normalized_units_per_reservation, "
    "reservation_number_of_reservations, reservation_recurring_fee_for_usage, "
    "reservation_reservation_a_r_n, reservation_start_time, "
    "reservation_subscription_id, reservation_total_reserved_normalized_units, "
    "reservation_total_reserved_units, reservation_units_per_reservation, "
    "reservation_unused_amortized_upfront_fee_for_billing_period, "
    "reservation_unused_normalized_unit_quantity, reservation_unused_quantity, "
    "reservation_unused_recurring_fee, reservation_upfront_value, "
    "resource_tags, "
    "savings_plan_amortized_upfront_commitment_for_billing_period, "
    "savings_plan_end_time, savings_plan_instance_type_family, "
    "savings_plan_net_amortized_upfront_commitment_for_billing_period, "
    "savings_plan_net_recurring_commitment_for_billing_period, "
    "savings_plan_net_savings_plan_effective_cost, "
    "savings_plan_offering_type, savings_plan_payment_option, "
    "savings_plan_purchase_term, "
    "savings_plan_recurring_commitment_for_billing_period, "
    "savings_plan_region, savings_plan_savings_plan_a_r_n, "
    "savings_plan_savings_plan_effective_cost, "
    "savings_plan_savings_plan_rate, savings_plan_start_time, "
    "savings_plan_total_commitment_to_date, savings_plan_used_commitment, "
    "tags"
)
_CUR_V2_QUERY_STATEMENT = (
    f"SELECT {_CUR_V2_STANDARD_COLUMNS} FROM COST_AND_USAGE_REPORT"
)

# Modes the Customize step exposes:
#   - "existing"   — caller supplies a CUR bucket + prefix + report name; the
#                    template only provisions IAM resources (today's behavior).
#   - "create_new" — Numio provisions the S3 bucket and the CUR 2.0 Data Export
#                    inside the same stack. Names and region are derived from
#                    ``label`` and locked to ``us-east-1``.
CurMode = Literal["existing", "create_new"]


def cur_bucket_name_for(label: str) -> str:
    """Auto-derived CUR S3 bucket name for create_new mode."""
    return f"numio-cur-{label}"


def cur_report_name_for(label: str) -> str:
    """Auto-derived CUR Data Export name for create_new mode."""
    return f"numio-cur-{label}"

# Composed at render time as f"{USER_NAME_PREFIX}-{label}" /
# f"{ROLE_NAME_PREFIX}-{label}". The "-Cfn-" segment is what distinguishes
# CloudFormation-managed resources from the manual (Advanced) flow's
# "NumioServiceUser" / "NumioCurReaderRole" without the suffix.
USER_NAME_PREFIX = "NumioServiceUser-Cfn"
ROLE_NAME_PREFIX = "NumioCurReaderRole-Cfn"
# Optional write-capable role, provisioned only when EnableTagWrites=true.
# Same trust model as the reader role (same NumioServiceUser principal +
# ExternalId), separate permission surface (tag writes + Org policy read).
TAG_WRITER_ROLE_NAME_PREFIX = "NumioTagWriterRole-Cfn"

# Stack name composes as f"{STACK_NAME_PREFIX}-{label}". The AWS console
# operator can override during stack creation; Numio cannot enforce it.
STACK_NAME_PREFIX = "NumioConnect"

# Sentence both the role Description and the template top-level Description
# carry. Kept ASCII-only on purpose: IAM enforces a strict charset on
# Role.Properties.Description (tab, LF, CR, U+0020-U+007E, U+00A1-U+00FF)
# that excludes the em-dash (U+2014). Stack creation fails with
# "Member must satisfy regular expression pattern" when the role description
# contains any character outside that set, so we use the ASCII " - " form
# instead of the typographic em-dash that the bug-fix task originally proposed.
CFN_OWNERSHIP_NOTICE = (
    "Managed by Numio CloudFormation. Do not modify manually - changes will "
    "be overwritten on stack update or lost on stack delete."
)

# Lowercase alphanumeric and hyphen, 1–32 chars, must start with a letter or
# digit. The intersection of valid IAM-resource-name and CloudFormation-
# stack-name characters, plus a length cap that keeps composed names well
# under both AWS limits (IAM user/role: 64 chars, stack name: 128 chars).
LABEL_PATTERN = re.compile(r"^[a-z0-9][a-z0-9-]{0,31}$")
LABEL_REGEX_STR = r"^[a-z0-9][a-z0-9-]{0,31}$"
LABEL_EXAMPLE = "wkt-aws-onboarding"

LABEL_HELP_TEXT = (
    "Per-instance label for this CloudFormation onboarding. Numio embeds it "
    "in IAM resource names (NumioServiceUser-Cfn-<label>, "
    "NumioCurReaderRole-Cfn-<label>), in the recommended stack name "
    "(NumioConnect-<label>), and as a tag on the IAM user and role. "
    "Two reasons this exists: (1) multiple Numio instances can be onboarded "
    "into the same AWS account without IAM-name collisions; (2) an AWS "
    "admin browsing the IAM console can identify which Numio instance owns "
    "each managed resource. Format: lowercase letters, digits, and hyphens, "
    "1–32 characters, must start with a letter or digit "
    f"({LABEL_REGEX_STR}). The Guided onboarding UI pre-fills this field "
    "with the current local time as DDMMYYHHMM (e.g. 2604261950); override "
    "it with anything more meaningful — a worktree name, developer "
    "initials + date, deployment tag — before submitting."
)


class LabelValidationError(ValueError):
    """Raised when a supplied label is missing or fails the regex."""

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message
        self.field = "label"
        self.pattern = LABEL_REGEX_STR
        self.example = LABEL_EXAMPLE
        self.help = LABEL_HELP_TEXT


def validate_label(value: str | None) -> str:
    """Validate a label, returning the value or raising ``LabelValidationError``.

    The error carries enough structured fields (``field``, ``pattern``,
    ``example``, ``help``) for the API layer to build an explanatory 422
    body without re-encoding the rules.
    """
    if value is None or value == "":
        raise LabelValidationError("Label is required. " + LABEL_HELP_TEXT)
    if not LABEL_PATTERN.match(value):
        raise LabelValidationError(
            f"Label {value!r} does not match {LABEL_REGEX_STR}. " + LABEL_HELP_TEXT
        )
    return value


def stack_name_for(label: str) -> str:
    """Default CloudFormation stack name for a given label."""
    return f"{STACK_NAME_PREFIX}-{label}"


def user_name_for(label: str) -> str:
    return f"{USER_NAME_PREFIX}-{label}"


def role_name_for(label: str) -> str:
    return f"{ROLE_NAME_PREFIX}-{label}"


def tag_writer_role_name_for(label: str) -> str:
    return f"{TAG_WRITER_ROLE_NAME_PREFIX}-{label}"


@dataclass(frozen=True)
class TemplateParameters:
    """User-visible CloudFormation template parameters.

    ``label`` is the per-instance discriminator (see module docstring).
    ``external_id`` is embedded as the default of the ``WorkspaceExternalId``
    parameter and is also marked ``NoEcho`` so the AWS console hides it.
    ``cur_bucket_name`` / ``cur_report_name`` / ``cur_path_prefix`` are pre-
    filled from the calling UI when the customer already knows them
    (``cur_mode='existing'``); they are ignored in ``cur_mode='create_new'``
    where Numio derives them from ``label``.
    """

    external_id: str
    label: str
    cur_bucket_name: str = ""
    cur_report_name: str = ""
    cur_path_prefix: str = DEFAULT_CUR_PATH_PREFIX
    cur_mode: CurMode = "existing"
    enable_tag_writes: bool = False


def _ownership_tags(label: str) -> list[dict[str, Any]]:
    """Tag set applied to every CFN-managed IAM resource.

    ``numio:stack`` resolves at deploy time so it tracks any rename the AWS
    operator does in the console. ``numio:instance-label`` carries the
    literal label so it survives even if the operator renames the stack.
    """
    return [
        {"Key": "ManagedBy", "Value": "Numio"},
        {"Key": "numio:managed-by", "Value": "CloudFormation"},
        {"Key": "numio:stack", "Value": {"Ref": "AWS::StackName"}},
        {"Key": "numio:instance-label", "Value": label},
    ]


def _build_document(params: TemplateParameters) -> dict[str, Any]:
    """Assemble the CloudFormation document as a Python dict."""
    user_name = user_name_for(params.label)
    role_name = role_name_for(params.label)
    tags = _ownership_tags(params.label)
    create_new = params.cur_mode == "create_new"

    # In create_new mode the bucket name, prefix, and report name are derived
    # from the label. Surface those derived values as Parameter defaults so a
    # template downloaded from Numio is self-describing in the AWS console.
    cur_bucket_default = (
        cur_bucket_name_for(params.label) if create_new else params.cur_bucket_name
    )
    cur_path_default = (
        CREATE_NEW_CUR_PATH_PREFIX if create_new else params.cur_path_prefix
    )
    cur_report_default = (
        cur_report_name_for(params.label) if create_new else params.cur_report_name
    )

    parameters: dict[str, Any] = {
        "WorkspaceExternalId": {
            "Type": "String",
            "Description": (
                "Numio workspace external id. Do not change — this value "
                "binds the role trust policy to your Numio workspace."
            ),
            "Default": params.external_id,
            "AllowedPattern": r"^[A-Za-z0-9._:/-]{8,256}$",
        },
        "CurBucketName": {
            "Type": "String",
            "Description": (
                "Name of the S3 bucket that holds the Cost and Usage "
                "Report export. Leave empty if you have not created one."
            ),
            "Default": cur_bucket_default,
            "AllowedPattern": r"^$|^[a-z0-9][a-z0-9.\-]{1,61}[a-z0-9]$",
        },
        "CurPathPrefix": {
            "Type": "String",
            "Description": (
                "Path prefix inside the bucket (without leading or "
                "trailing slash). Example: 'cur' or 'reports/cur'."
            ),
            "Default": cur_path_default,
            "AllowedPattern": r"^[A-Za-z0-9._/-]{0,512}$",
        },
        "CurReportName": {
            "Type": "String",
            "Description": (
                "Name of the CUR export. Matches the 'Report name' field "
                "in the AWS Billing console."
            ),
            "Default": cur_report_default,
            "AllowedPattern": r"^[A-Za-z0-9_-]{0,128}$",
        },
        "EnableTagWrites": {
            "Type": "String",
            "Description": (
                "When 'true', provision the NumioTagWriterRole that lets Numio "
                "update tags on resources in this account. Leave 'false' to "
                "keep Numio read-only."
            ),
            "Default": "true" if params.enable_tag_writes else "false",
            "AllowedValues": ["true", "false"],
        },
    }

    # In create_new mode, the IAM role's CurBucketRead policy targets the
    # in-stack bucket via Fn::GetAtt — there is no need for the HasCurBucket
    # condition. In existing mode we keep the conditional Resource so an empty
    # bucket name still produces a valid (placeholder) ARN list.
    cur_bucket_resource: Any
    conditions: dict[str, Any] = {}
    if create_new:
        cur_bucket_resource = [
            {"Fn::GetAtt": ["NumioCurBucket", "Arn"]},
            {"Fn::Sub": "${NumioCurBucket.Arn}/*"},
        ]
    else:
        conditions["HasCurBucket"] = {
            "Fn::Not": [{"Fn::Equals": [{"Ref": "CurBucketName"}, ""]}]
        }
        cur_bucket_resource = {
            "Fn::If": [
                "HasCurBucket",
                [
                    {"Fn::Sub": ("arn:aws:s3:::${CurBucketName}")},
                    {"Fn::Sub": ("arn:aws:s3:::${CurBucketName}/*")},
                ],
                ["arn:aws:s3:::placeholder"],
            ]
        }

    # The tag-writer role is gated by a CFN Condition, not baked at render time,
    # so one template covers both outcomes (checkbox flips the parameter).
    conditions["TagWritesEnabled"] = {
        "Fn::Equals": [{"Ref": "EnableTagWrites"}, "true"]
    }

    document: dict[str, Any] = {
        "AWSTemplateFormatVersion": "2010-09-09",
        "Description": (
            "Numio onboarding stack: creates the IAM user, role, and policy "
            "Numio needs to read Cost and Usage Report data and inventory "
            "resources in this AWS account. " + CFN_OWNERSHIP_NOTICE
        ),
        "Parameters": parameters,
    }
    if conditions:
        document["Conditions"] = conditions
    resources: dict[str, Any] = {
        "NumioServiceUser": {
            "Type": "AWS::IAM::User",
            "Properties": {
                "UserName": user_name,
                "Path": "/numio/",
                "Tags": tags,
            },
        },
        "NumioServiceUserAccessKey": {
            "Type": "AWS::IAM::AccessKey",
            "Properties": {
                "UserName": {"Ref": "NumioServiceUser"},
                "Status": "Active",
            },
        },
        "NumioCurReaderRole": {
            "Type": "AWS::IAM::Role",
            "Properties": {
                "RoleName": role_name,
                "Path": "/numio/",
                "Description": (
                    "Role assumed by Numio to read cost and inventory "
                    "data in this AWS account. " + CFN_OWNERSHIP_NOTICE
                ),
                "MaxSessionDuration": 3600,
                "Tags": tags,
                "AssumeRolePolicyDocument": {
                    "Version": "2012-10-17",
                    "Statement": [
                        {
                            "Effect": "Allow",
                            "Principal": {"AWS": {"Fn::GetAtt": ["NumioServiceUser", "Arn"]}},
                            "Action": "sts:AssumeRole",
                            "Condition": {
                                "StringEquals": {
                                    "sts:ExternalId": {"Ref": "WorkspaceExternalId"}
                                }
                            },
                        }
                    ],
                },
                "Policies": [
                    {
                        "PolicyName": "NumioReadOnly",
                        "PolicyDocument": {
                            "Version": "2012-10-17",
                            "Statement": [
                                {
                                    "Sid": "CurBucketRead",
                                    "Effect": "Allow",
                                    "Action": [
                                        "s3:GetObject",
                                        "s3:ListBucket",
                                        "s3:GetBucketLocation",
                                    ],
                                    "Resource": cur_bucket_resource,
                                },
                                {
                                    "Sid": "CostExplorer",
                                    "Effect": "Allow",
                                    "Action": [
                                        "ce:GetCostAndUsage",
                                        "ce:GetCostForecast",
                                        "ce:GetDimensionValues",
                                        "ce:GetReservationUtilization",
                                        "ce:GetSavingsPlansUtilization",
                                        "ce:GetTags",
                                        "cur:DescribeReportDefinitions",
                                    ],
                                    "Resource": "*",
                                },
                                {
                                    "Sid": "ResourceInventory",
                                    "Effect": "Allow",
                                    "Action": [
                                        "tag:GetResources",
                                        "tag:GetTagKeys",
                                        "tag:GetTagValues",
                                        "ec2:Describe*",
                                        "rds:Describe*",
                                        "elasticloadbalancing:Describe*",
                                        "lambda:List*",
                                        "s3:ListAllMyBuckets",
                                        "iam:ListAccountAliases",
                                    ],
                                    "Resource": "*",
                                },
                            ],
                        },
                    }
                ],
            },
        },
    }

    resources["NumioTagWriterRole"] = {
        "Type": "AWS::IAM::Role",
        "Condition": "TagWritesEnabled",
        "Properties": {
            "RoleName": tag_writer_role_name_for(params.label),
            "Path": "/numio/",
            "Description": (
                "Role assumed by Numio to write tags on resources in this "
                "AWS account. " + CFN_OWNERSHIP_NOTICE
            ),
            "MaxSessionDuration": 3600,
            "Tags": tags,
            "AssumeRolePolicyDocument": {
                "Version": "2012-10-17",
                "Statement": [
                    {
                        "Effect": "Allow",
                        "Principal": {"AWS": {"Fn::GetAtt": ["NumioServiceUser", "Arn"]}},
                        "Action": "sts:AssumeRole",
                        "Condition": {
                            "StringEquals": {
                                "sts:ExternalId": {"Ref": "WorkspaceExternalId"}
                            }
                        },
                    }
                ],
            },
            "Policies": [
                {
                    "PolicyName": "NumioTagWriter",
                    "PolicyDocument": {
                        "Version": "2012-10-17",
                        "Statement": [
                            {
                                "Sid": "RGTApi",
                                "Effect": "Allow",
                                "Action": [
                                    "tag:TagResources",
                                    "tag:UntagResources",
                                    "tag:GetResources",
                                ],
                                "Resource": "*",
                            },
                            {
                                "Sid": "Ec2Tagging",
                                "Effect": "Allow",
                                "Action": ["ec2:CreateTags", "ec2:DeleteTags"],
                                "Resource": "*",
                            },
                            {
                                "Sid": "RdsTagging",
                                "Effect": "Allow",
                                "Action": [
                                    "rds:AddTagsToResource",
                                    "rds:RemoveTagsFromResource",
                                ],
                                "Resource": "*",
                            },
                            {
                                "Sid": "S3Tagging",
                                "Effect": "Allow",
                                "Action": [
                                    "s3:PutBucketTagging",
                                    "s3:DeleteBucketTagging",
                                    "s3:GetBucketTagging",
                                ],
                                "Resource": "*",
                            },
                            {
                                "Sid": "LambdaTagging",
                                "Effect": "Allow",
                                "Action": [
                                    "lambda:TagResource",
                                    "lambda:UntagResource",
                                    "lambda:ListTags",
                                ],
                                "Resource": "*",
                            },
                            {
                                "Sid": "OrgPolicyRead",
                                "Effect": "Allow",
                                "Action": [
                                    "organizations:DescribeOrganization",
                                    "organizations:DescribeEffectivePolicy",
                                    "organizations:ListPolicies",
                                ],
                                "Resource": "*",
                            },
                        ],
                    },
                }
            ],
        },
    }

    if create_new:
        resources.update(
            _create_new_cur_resources(
                bucket_name=cur_bucket_default,
                report_name=cur_report_default,
                path_prefix=cur_path_default,
                tags=tags,
            )
        )

    document["Resources"] = resources
    document["Outputs"] = {
        "RoleArn": {
            "Description": ("Paste this into the 'Role ARN' field in Numio."),
            "Value": {"Fn::GetAtt": ["NumioCurReaderRole", "Arn"]},
        },
        "AccessKeyId": {
            "Description": ("Paste this into the 'AWS Access Key ID' field in Numio."),
            "Value": {"Ref": "NumioServiceUserAccessKey"},
        },
        "SecretAccessKey": {
            "Description": (
                "Paste this into the 'AWS Secret Access Key' field in "
                "Numio. This is the only place you can read this value — "
                "copy it before closing the CloudFormation console."
            ),
            "Value": {"Fn::GetAtt": ["NumioServiceUserAccessKey", "SecretAccessKey"]},
        },
        "ExternalId": {
            "Description": ("Paste this into the 'External ID' field in Numio."),
            "Value": {"Ref": "WorkspaceExternalId"},
        },
        "AwsAccountId": {
            "Description": "The 12-digit AWS account id this stack applied in.",
            "Value": {"Ref": "AWS::AccountId"},
        },
        "CurBucketNameOut": {
            "Description": "CUR S3 bucket name — copy back into Numio.",
            "Value": {"Ref": "CurBucketName"},
        },
        "CurPathPrefixOut": {
            "Description": "CUR path prefix — copy back into Numio.",
            "Value": {"Ref": "CurPathPrefix"},
        },
        "CurReportNameOut": {
            "Description": "CUR report name — copy back into Numio.",
            "Value": {"Ref": "CurReportName"},
        },
        "TagWriterRoleArn": {
            "Description": (
                "Paste this into the 'Tag writer role ARN' field in Numio to "
                "enable tag writes. Emitted only when EnableTagWrites=true."
            ),
            "Condition": "TagWritesEnabled",
            "Value": {"Fn::GetAtt": ["NumioTagWriterRole", "Arn"]},
        },
    }
    return document


def _create_new_cur_resources(
    *,
    bucket_name: str,
    report_name: str,
    path_prefix: str,
    tags: list[dict[str, Any]],
) -> dict[str, Any]:
    """CFN resources that provision the CUR S3 bucket + Data Export.

    Only emitted in ``cur_mode='create_new'``. The bucket policy follows
    the AWS Billing service contract for CUR 2.0 / Data Exports v2: the
    ``bcm-data-exports.amazonaws.com`` service principal must be allowed
    ``s3:PutObject``, plus ``s3:GetBucketAcl`` and ``s3:GetBucketPolicy`` so
    AWS can validate the bucket configuration before each delivery. The
    ``aws:SourceAccount`` and ``aws:SourceArn`` conditions tie the policy to
    the customer's own Data Exports service in this account, so the bucket
    cannot be hijacked as a sink for someone else's exports.

    The Data Export uses the daily Parquet layout that the rest of Numio's
    ingestion already understands. The ``QueryStatement`` selects every
    column from the canonical ``COST_AND_USAGE_REPORT`` table — equivalent
    to "all standard fields" in the AWS Billing console wizard.
    """
    return {
        "NumioCurBucket": {
            "Type": "AWS::S3::Bucket",
            "DeletionPolicy": "Retain",
            "UpdateReplacePolicy": "Retain",
            "Properties": {
                "BucketName": bucket_name,
                "OwnershipControls": {
                    "Rules": [{"ObjectOwnership": "BucketOwnerEnforced"}]
                },
                "PublicAccessBlockConfiguration": {
                    "BlockPublicAcls": True,
                    "BlockPublicPolicy": True,
                    "IgnorePublicAcls": True,
                    "RestrictPublicBuckets": True,
                },
                "BucketEncryption": {
                    "ServerSideEncryptionConfiguration": [
                        {
                            "ServerSideEncryptionByDefault": {
                                "SSEAlgorithm": "AES256",
                            }
                        }
                    ]
                },
                "Tags": tags,
            },
        },
        "NumioCurBucketPolicy": {
            "Type": "AWS::S3::BucketPolicy",
            "Properties": {
                "Bucket": {"Ref": "NumioCurBucket"},
                # Verbatim policy AWS publishes for Data Exports delivery —
                # see https://docs.aws.amazon.com/cur/latest/userguide/dataexports-s3-bucket.html.
                # Single statement, ``s3:PutObject`` only, object-level
                # resource. ``ArnLike`` (not ``StringEquals``) for the source
                # ARN so the wildcarded export ARN matches; ``StringEquals``
                # for the source account. Anything stricter than this trips
                # the export's bucket-permission validation step.
                "PolicyDocument": {
                    "Version": "2012-10-17",
                    "Statement": [
                        {
                            "Sid": "EnableAWSDataExportsToWriteToS3",
                            "Effect": "Allow",
                            "Principal": {
                                "Service": ["bcm-data-exports.amazonaws.com"]
                            },
                            "Action": ["s3:PutObject"],
                            "Resource": {
                                "Fn::Sub": "${NumioCurBucket.Arn}/*"
                            },
                            "Condition": {
                                "ArnLike": {
                                    "aws:SourceArn": {
                                        "Fn::Sub": (
                                            "arn:aws:bcm-data-exports:us-east-1:"
                                            "${AWS::AccountId}:export/*"
                                        )
                                    }
                                },
                                "StringEquals": {
                                    "aws:SourceAccount": {"Ref": "AWS::AccountId"}
                                },
                            },
                        }
                    ],
                },
            },
        },
        "NumioCurExport": {
            "Type": "AWS::BCMDataExports::Export",
            "DependsOn": "NumioCurBucketPolicy",
            "Properties": {
                "Export": {
                    "Name": report_name,
                    "Description": (
                        "Numio-managed CUR 2.0 daily Parquet export. "
                        + CFN_OWNERSHIP_NOTICE
                    ),
                    "DataQuery": {
                        "QueryStatement": _CUR_V2_QUERY_STATEMENT,
                        "TableConfigurations": {
                            # Mirrors what AWS Billing's "Standard data export"
                            # wizard emits, with INCLUDE_RESOURCES flipped on so
                            # cost_records carry resource_id for per-resource
                            # cost attribution. The split / capacity-reservation
                            # / IAM-principal flags stay off — those columns are
                            # not part of v0 ingestion and would expand the
                            # column set this template would have to enumerate.
                            "COST_AND_USAGE_REPORT": {
                                "TIME_GRANULARITY": "DAILY",
                                "INCLUDE_RESOURCES": "TRUE",
                                "INCLUDE_SPLIT_COST_ALLOCATION_DATA": "FALSE",
                                "INCLUDE_CAPACITY_RESERVATION_DATA": "FALSE",
                                "INCLUDE_IAM_PRINCIPAL_DATA": "FALSE",
                            },
                        },
                    },
                    "DestinationConfigurations": {
                        "S3Destination": {
                            "S3Bucket": {"Ref": "NumioCurBucket"},
                            "S3Prefix": path_prefix,
                            "S3Region": "us-east-1",
                            "S3OutputConfigurations": {
                                "OutputType": "CUSTOM",
                                "Format": "PARQUET",
                                "Compression": "PARQUET",
                                "Overwrite": "OVERWRITE_REPORT",
                            },
                        }
                    },
                    "RefreshCadence": {"Frequency": "SYNCHRONOUS"},
                },
                "Tags": tags,
            },
        },
    }


class _LiteralStr(str):
    """Marker class rendered as a YAML literal block scalar."""


def _literal_presenter(dumper: yaml.Dumper, data: _LiteralStr) -> yaml.ScalarNode:
    return dumper.represent_scalar("tag:yaml.org,2002:str", data, style="|")


yaml.add_representer(_LiteralStr, _literal_presenter)


class _CfnSafeDumper(yaml.SafeDumper):
    """SafeDumper that never emits YAML anchors / aliases.

    CloudFormation rejects templates that contain anchors or aliases with
    "Template error: YAML aliases are not allowed in CloudFormation
    templates". PyYAML emits them whenever the same Python object is
    referenced from two places (e.g. when the IAM user and role share the
    same tag list), so disabling alias emission here makes the renderer
    safe regardless of how the document is assembled.
    """

    def ignore_aliases(self, data):  # noqa: ARG002 — overridden API
        return True


def render_template(params: TemplateParameters) -> str:
    """Render the CloudFormation template as a YAML string."""
    document = _build_document(params)
    return yaml.dump(
        document,
        Dumper=_CfnSafeDumper,
        default_flow_style=False,
        sort_keys=False,
        width=120,
        allow_unicode=True,
    )


def _quickcreate_url(
    *,
    region: str,
    stack_name: str,
    template_url: str | None,
    params: TemplateParameters,
) -> str:
    """Build a CloudFormation console quick-create URL.

    When ``template_url`` is provided, the URL lands directly on the
    review-and-create step with parameters pre-filled. When it is ``None``
    (no public Numio host configured), the URL lands on the generic
    create-stack page and the user uploads the downloaded file manually.
    """
    base = f"https://{region}.console.aws.amazon.com/cloudformation/home"
    if template_url is None:
        fragment = "/stacks/create/template"
        query = {"region": region}
        return f"{base}?{urlencode(query)}#{fragment}"

    fragment_query = {
        "stackName": stack_name,
        "templateURL": template_url,
        "param_WorkspaceExternalId": params.external_id,
        "param_CurBucketName": params.cur_bucket_name,
        "param_CurPathPrefix": params.cur_path_prefix,
        "param_CurReportName": params.cur_report_name,
        "param_EnableTagWrites": "true" if params.enable_tag_writes else "false",
    }
    # CloudFormation expects the parameters in the fragment, percent-encoded.
    fragment = "/stacks/quickcreate?" + urlencode(fragment_query, quote_via=quote, safe="")
    return f"{base}?region={region}#{fragment}"


def build_launch_url(
    *,
    region: str = DEFAULT_REGION,
    stack_name: str | None = None,
    template_url: str | None = None,
    params: TemplateParameters,
) -> str:
    """Public entry point used by the API layer.

    When ``stack_name`` is omitted, defaults to ``NumioConnect-<label>``
    derived from ``params.label``. The AWS console operator can still
    override the stack name when creating the stack.
    """
    if stack_name is None:
        stack_name = stack_name_for(params.label)
    return _quickcreate_url(
        region=region,
        stack_name=stack_name,
        template_url=template_url,
        params=params,
    )
