"""Numio MCP server implementation using FastMCP.

Provides MCP tools for AI agents to query cloud cost data, findings,
recommendations, and account status. Tools delegate to the same shared
executors used by the analytics chat backend — no duplicate business logic.
"""

import logging
from typing import Annotated

from fastapi import FastAPI
from mcp.server.fastmcp import FastMCP
from pydantic import Field
from sqlalchemy import select

from numio.chat.tools import (
    _exec_get_account_status,
    _exec_get_cost_by_dimension,
    _exec_get_cost_summary,
    _exec_list_findings,
    _exec_list_recommendations,
)
from numio.core.aws_org_tag_policy_service import detect_schema_conflicts
from numio.core.tag_risk import assess_risk
from numio.core.tag_write_service import TagChange, apply_tag_changes
from numio.db.aws_org_tag_policy_repository import AwsOrgTagPolicyRepository
from numio.db.compliance_repository import ComplianceRepository
from numio.db.session import AsyncSessionLocal
from numio.db.tag_policy_repository import TagPolicyRepository
from numio.models.cloud_resource import CloudResource
from numio.models.workspace import DEFAULT_WORKSPACE_SLUG, Workspace

logger = logging.getLogger("numio.mcp")

# Initialize FastMCP server
# Transport paths are relative to the mount point in the main FastAPI app
mcp = FastMCP(
    "Numio",
    stateless_http=True,
    streamable_http_path="/",
    sse_path="/",
    message_path="/messages",
)

# Export ASGI apps for remote transports
mcp_streamable_http_app = mcp.streamable_http_app()
mcp_sse_app = mcp.sse_app()


def register_mcp_endpoints(app: FastAPI) -> None:
    """Register MCP remote endpoints on the provided FastAPI app.

    Mounts MCP transport endpoints:
    - Streamable HTTP: /mcp
    - SSE: /mcp/sse
    """
    app.mount("/mcp", mcp_streamable_http_app)
    app.mount("/mcp/sse", mcp_sse_app)


async def _get_default_workspace_id(session) -> str:
    """Look up the default workspace ID by slug."""
    result = await session.execute(
        select(Workspace).where(Workspace.slug == DEFAULT_WORKSPACE_SLUG)
    )
    workspace = result.scalar_one_or_none()
    if workspace is None:
        raise RuntimeError(f"Default workspace (slug={DEFAULT_WORKSPACE_SLUG}) not found")
    return str(workspace.id)


# -- Type aliases for parameter descriptions --------------------------------

StartDate = Annotated[str | None, Field(description="Start date (YYYY-MM-DD)")]
EndDate = Annotated[str | None, Field(description="End date (YYYY-MM-DD)")]


@mcp.tool()
async def get_cost_summary(
    start_date: StartDate = None,
    end_date: EndDate = None,
) -> dict:
    """Get total cloud spend for a date range.

    Returns total cost with daily breakdown.
    Defaults to current month if no dates provided.
    """
    async with AsyncSessionLocal() as session:
        workspace_id = await _get_default_workspace_id(session)
        return await _exec_get_cost_summary(
            {"start_date": start_date, "end_date": end_date},
            session,
            workspace_id,
        )


@mcp.tool()
async def get_cost_by_dimension(
    dimension: Annotated[
        str,
        Field(
            description="Dimension to group by: 'service', 'region', "
            "or a custom attribution dimension",
        ),
    ] = "service",
    start_date: StartDate = None,
    end_date: EndDate = None,
) -> dict:
    """Get cloud costs grouped by a business dimension.

    Returns a ranked list of dimension values with their costs
    and percentages.
    """
    async with AsyncSessionLocal() as session:
        workspace_id = await _get_default_workspace_id(session)
        return await _exec_get_cost_by_dimension(
            {
                "dimension": dimension,
                "start_date": start_date,
                "end_date": end_date,
            },
            session,
            workspace_id,
        )


@mcp.tool()
async def list_findings(
    type: Annotated[
        str | None,
        Field(
            description="Filter by finding type: anomaly, zombie, "
            "idle, policy_violation, tag_violation",
        ),
    ] = None,
    severity: Annotated[
        str | None,
        Field(
            description="Filter by severity: critical, high, medium, low, info",
        ),
    ] = None,
    status: Annotated[
        str | None,
        Field(
            description="Filter by status: open, acknowledged, resolved, suppressed",
        ),
    ] = "open",
    limit: Annotated[
        int,
        Field(
            description="Maximum number of findings to return",
        ),
    ] = 20,
) -> dict:
    """List findings (anomalies, zombie resources, idle resources,
    policy violations).

    Returns findings with type, severity, status, and estimated
    cost impact.
    """
    async with AsyncSessionLocal() as session:
        workspace_id = await _get_default_workspace_id(session)
        return await _exec_list_findings(
            {
                "type": type,
                "severity": severity,
                "status": status,
                "limit": limit,
            },
            session,
            workspace_id,
        )


@mcp.tool()
async def list_recommendations(
    category: Annotated[
        str | None,
        Field(
            description="Filter by category: right_sizing, zombie_cleanup, idle_shutdown",
        ),
    ] = None,
    status: Annotated[
        str | None,
        Field(
            description="Filter by status: open, accepted, implemented, dismissed",
        ),
    ] = "open",
    sort_by_savings: Annotated[
        bool,
        Field(
            description="Sort by estimated monthly savings descending",
        ),
    ] = True,
    limit: Annotated[
        int,
        Field(
            description="Maximum number of recommendations to return",
        ),
    ] = 20,
) -> dict:
    """List optimization recommendations (right-sizing, zombie cleanup,
    idle shutdown).

    Returns recommendations with category, status, estimated savings,
    and confidence.
    """
    async with AsyncSessionLocal() as session:
        workspace_id = await _get_default_workspace_id(session)
        return await _exec_list_recommendations(
            {
                "category": category,
                "status": status,
                "sort_by_savings": sort_by_savings,
                "limit": limit,
            },
            session,
            workspace_id,
        )


@mcp.tool()
async def get_account_status() -> dict:
    """List registered AWS accounts with their sync status.

    Returns account details including AWS account ID, alias, status,
    and environment label.
    """
    async with AsyncSessionLocal() as session:
        workspace_id = await _get_default_workspace_id(session)
        return await _exec_get_account_status(
            {},
            session,
            workspace_id,
        )


# -- Tag management tools ---------------------------------------------------


@mcp.tool()
async def list_tag_keys() -> dict:
    """List all known tag keys across Numio policies and the AWS Organizations
    tag policy.

    Each key carries its source ('numio', 'aws-org', or 'both') and whether it
    is required. A key with a Numio policy rule is always required.
    """
    async with AsyncSessionLocal() as session:
        workspace_id = await _get_default_workspace_id(session)
        merged: dict[str, dict] = {}
        for policy in await TagPolicyRepository(session, workspace_id).list_active():
            for rule in policy.rules:
                entry = merged.setdefault(
                    rule.tag_name, {"tag_key": rule.tag_name, "numio": False, "aws_org": False}
                )
                entry["numio"] = True
        for row in await AwsOrgTagPolicyRepository(session, workspace_id).list_by_workspace():
            entry = merged.setdefault(
                row.tag_key, {"tag_key": row.tag_key, "numio": False, "aws_org": False}
            )
            entry["aws_org"] = True
            entry["aws_org_required"] = bool(row.required)
        keys = []
        for entry in sorted(merged.values(), key=lambda e: e["tag_key"]):
            if entry["numio"] and entry["aws_org"]:
                source = "both"
            elif entry["numio"]:
                source = "numio"
            else:
                source = "aws-org"
            required = entry["numio"] or entry.get("aws_org_required", False)
            keys.append({"tag_key": entry["tag_key"], "source": source, "required": required})
        return {"keys": keys, "count": len(keys)}


@mcp.tool()
async def get_resource_tags(
    resource_arn: Annotated[str, Field(description="ARN of the resource to read tags for")],
) -> dict:
    """Get the current tags on a cloud resource (read-only).

    Returns the tag map from Numio's inventory. `found` is false when the ARN
    is not in inventory.
    """
    async with AsyncSessionLocal() as session:
        workspace_id = await _get_default_workspace_id(session)
        resource = (
            await session.execute(
                select(CloudResource).where(
                    CloudResource.workspace_id == workspace_id,
                    CloudResource.arn == resource_arn,
                )
            )
        ).scalar_one_or_none()
        if resource is None:
            return {"resource_arn": resource_arn, "found": False, "tags": {}}
        return {"resource_arn": resource_arn, "found": True, "tags": resource.tags or {}}


@mcp.tool()
async def apply_tags(
    resource_arn: Annotated[str, Field(description="ARN of the resource to tag")],
    tags: Annotated[
        dict,
        Field(description="Map of tag key -> value. A null value removes the key."),
    ],
    rationale: Annotated[
        str | None, Field(description="Optional free-text reason recorded in the audit")
    ] = None,
    confirm_risky: Annotated[
        bool,
        Field(description="Set true to proceed past a risky-write gate (production or >$1000)"),
    ] = False,
) -> dict:
    """Apply tag set/remove changes to a single AWS resource.

    Enforces the risky-write rule: when the target is production or above the
    cost threshold and `confirm_risky` is not true, returns
    {status: 'rejected', reason: 'risky_write_not_confirmed', preview: {...}}
    without writing. Bulk tagging across many resources routes through a
    Campaign, not this tool.
    """
    async with AsyncSessionLocal() as session:
        workspace_id = await _get_default_workspace_id(session)
        if not tags:
            return {"status": "rejected", "reason": "no_tags_provided"}
        resource = (
            await session.execute(
                select(CloudResource).where(
                    CloudResource.workspace_id == workspace_id,
                    CloudResource.arn == resource_arn,
                )
            )
        ).scalar_one_or_none()
        if resource is None:
            return {
                "status": "rejected",
                "reason": "resource_not_found",
                "resource_arn": resource_arn,
            }

        risk = await assess_risk(session, workspace_id, [resource])
        if risk.risky and not confirm_risky:
            return {
                "status": "rejected",
                "reason": "risky_write_not_confirmed",
                "preview": {
                    "risky": risk.risky,
                    "reasons": risk.reasons,
                    "affected_resources": [
                        {
                            "resource_id": str(resource.id),
                            "arn": resource.arn,
                            "name": resource.name,
                            "env": (resource.tags or {}).get("env"),
                            "monthly_cost": risk.cost_by_resource_id.get(resource.id, 0.0),
                        }
                    ],
                },
            }

        changes = [TagChange(resource.id, key, value) for key, value in tags.items()]
        operation_type = "tag_remove" if all(v is None for v in tags.values()) else "tag_apply"
        result = await apply_tag_changes(
            session,
            workspace_id,
            changes,
            actor="mcp",
            rationale=rationale,
            operation_type=operation_type,
        )
        return {
            "status": result.status,
            "event_id": str(result.event_id),
            "summary": result.summary,
        }


@mcp.tool()
async def list_tag_conflicts() -> dict:
    """List schema conflicts between Numio tag policies and the synced AWS
    Organizations tag policy (read-only)."""
    async with AsyncSessionLocal() as session:
        workspace_id = await _get_default_workspace_id(session)
        conflicts = await detect_schema_conflicts(session, workspace_id)
        return {"conflicts": [c.model_dump() for c in conflicts], "count": len(conflicts)}


@mcp.tool()
async def get_tag_coverage() -> dict:
    """Get the overall tag-compliance coverage from the most recent audit.

    Mirrors GET /compliance/summary: cost-weighted score plus compliant /
    non-compliant resource and cost totals.
    """
    async with AsyncSessionLocal() as session:
        workspace_id = await _get_default_workspace_id(session)
        overall = await ComplianceRepository(session, workspace_id).get_latest_snapshot("overall")
        # Mirror GET /compliance/summary: a nested `overall` object (or None) plus
        # the same flat counts in both branches, so consumers can branch on
        # `overall is None` without risking a KeyError on the other fields.
        if overall is None:
            return {
                "overall": None,
                "untagged_spend": 0.0,
                "total_resources": 0,
                "compliant_resources": 0,
                "non_compliant_resources": 0,
            }
        return {
            "overall": {
                "cost_weighted_score": float(overall.cost_weighted_score),
                "total_cost": float(overall.total_cost),
                "compliant_cost": float(overall.compliant_cost),
                "total_resources": overall.total_resources,
                "compliant_resources": overall.compliant_resources,
            },
            "untagged_spend": float(overall.total_cost - overall.compliant_cost),
            "total_resources": overall.total_resources,
            "compliant_resources": overall.compliant_resources,
            "non_compliant_resources": overall.total_resources - overall.compliant_resources,
        }
