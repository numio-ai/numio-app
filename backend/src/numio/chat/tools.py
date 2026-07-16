"""Shared tool definitions for analytics chat and MCP server.

Each tool has:
- A definition dict (name, description, input_schema) for the LLM
- An executor function that runs against the core data layer

Tool definitions follow the Anthropic tool-use schema so they can be passed
directly to both Anthropic API and LMGate.
"""

from __future__ import annotations

import logging
from datetime import date
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from numio.core.cost_attribution_service import CostAttributionService
from numio.db.aws_account_repository import AwsAccountRepository
from numio.db.finding_repository import FindingRepository
from numio.db.recommendation_repository import RecommendationRepository

logger = logging.getLogger("numio.chat.tools")

# ---------------------------------------------------------------------------
# Tool definitions (sent to the LLM)
# ---------------------------------------------------------------------------

TOOL_DEFINITIONS: list[dict[str, Any]] = [
    {
        "name": "get_cost_summary",
        "description": (
            "Get total cloud spend for a date range. "
            "Returns total cost with daily breakdown. "
            "Use this for questions like 'What was total spend last month?'"
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "start_date": {
                    "type": "string",
                    "description": (
                        "Start date in YYYY-MM-DD format. Defaults to first day of current month."
                    ),
                },
                "end_date": {
                    "type": "string",
                    "description": "End date in YYYY-MM-DD format. Defaults to today.",
                },
            },
            "required": [],
        },
    },
    {
        "name": "get_cost_by_dimension",
        "description": (
            "Get cloud costs grouped by a business dimension (e.g., service, team, environment). "
            "Returns a ranked list of dimension values with their costs and percentages. "
            "Use for questions like 'What are the top cost drivers?' or "
            "'What did team X spend?'"
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "dimension": {
                    "type": "string",
                    "description": (
                        "Dimension to group by: 'service', 'region', "
                        "or a custom attribution dimension."
                    ),
                    "default": "service",
                },
                "start_date": {
                    "type": "string",
                    "description": "Start date in YYYY-MM-DD format.",
                },
                "end_date": {
                    "type": "string",
                    "description": "End date in YYYY-MM-DD format.",
                },
            },
            "required": ["dimension"],
        },
    },
    {
        "name": "get_spend_over_time",
        "description": (
            "Get cost time series with optional dimension breakdown. "
            "Returns daily/weekly/monthly cost data points. "
            "Use for questions about cost trends or 'How has spend changed over time?'"
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "start_date": {
                    "type": "string",
                    "description": "Start date in YYYY-MM-DD format.",
                },
                "end_date": {
                    "type": "string",
                    "description": "End date in YYYY-MM-DD format.",
                },
                "granularity": {
                    "type": "string",
                    "enum": ["daily", "weekly", "monthly"],
                    "description": "Time bucket size. Defaults to daily.",
                    "default": "daily",
                },
                "dimension": {
                    "type": "string",
                    "description": "Optional dimension to break down by (e.g., 'service').",
                },
            },
            "required": [],
        },
    },
    {
        "name": "list_findings",
        "description": (
            "List findings (anomalies, zombie resources, idle resources, policy violations). "
            "Use for questions like 'What are the open anomalies?', "
            "'How many zombie resources do we have?', or 'Show findings by severity.'"
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "type": {
                    "type": "string",
                    "enum": ["anomaly", "zombie", "idle", "policy_violation", "tag_violation"],
                    "description": "Filter by finding type.",
                },
                "severity": {
                    "type": "string",
                    "enum": ["critical", "high", "medium", "low", "info"],
                    "description": "Filter by severity.",
                },
                "status": {
                    "type": "string",
                    "enum": ["open", "acknowledged", "resolved", "suppressed"],
                    "description": "Filter by status. Defaults to open.",
                    "default": "open",
                },
                "limit": {
                    "type": "integer",
                    "description": "Maximum number of findings to return. Defaults to 20.",
                    "default": 20,
                },
            },
            "required": [],
        },
    },
    {
        "name": "list_recommendations",
        "description": (
            "List optimization recommendations (right-sizing, zombie cleanup, idle shutdown). "
            "Use for questions like 'What recommendations are open?', "
            "'What can we save?', or 'Show top savings opportunities.'"
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "category": {
                    "type": "string",
                    "enum": ["right_sizing", "zombie_cleanup", "idle_shutdown"],
                    "description": "Filter by recommendation category.",
                },
                "status": {
                    "type": "string",
                    "enum": ["open", "accepted", "implemented", "dismissed"],
                    "description": "Filter by status. Defaults to open.",
                    "default": "open",
                },
                "sort_by_savings": {
                    "type": "boolean",
                    "description": "Sort by estimated monthly savings descending.",
                    "default": True,
                },
                "limit": {
                    "type": "integer",
                    "description": "Maximum number of recommendations to return. Defaults to 20.",
                    "default": 20,
                },
            },
            "required": [],
        },
    },
    {
        "name": "get_account_status",
        "description": (
            "List registered AWS accounts with their sync status. "
            "Use for questions like 'What accounts are connected?', "
            "'Is my AWS account syncing?', or 'Show account status.'"
        ),
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "get_savings_summary",
        "description": (
            "Get a summary of realized savings from implemented recommendations, "
            "grouped by category. Use for questions like "
            "'How much have we saved?' or 'What are our realized savings?'"
        ),
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
]


# ---------------------------------------------------------------------------
# Tool executors
# ---------------------------------------------------------------------------


def _default_date_range() -> tuple[str, str]:
    today = date.today()
    start = today.replace(day=1)
    return start.isoformat(), today.isoformat()


def _parse_date(value: str | None, default: str) -> date:
    return date.fromisoformat(value) if value else date.fromisoformat(default)


async def execute_tool(
    tool_name: str,
    tool_input: dict[str, Any],
    session: AsyncSession,
    workspace_id: str,
) -> dict[str, Any]:
    """Execute a chat tool and return its result as a serialisable dict."""
    executor = _EXECUTORS.get(tool_name)
    if executor is None:
        return {"error": f"Unknown tool: {tool_name}"}
    try:
        return await executor(tool_input, session, workspace_id)
    except Exception as exc:
        logger.exception("Tool %s failed", tool_name)
        return {"error": str(exc)}


# --- Individual executors ---


async def _exec_get_cost_summary(params: dict, session: AsyncSession, workspace_id: str) -> dict:
    default_start, default_end = _default_date_range()
    start = _parse_date(params.get("start_date"), default_start)
    end = _parse_date(params.get("end_date"), default_end)

    svc = CostAttributionService(session, workspace_id)
    result = await svc.get_total_cost(start, end)
    return {
        "total": float(result.total),
        "currency": "USD",
        "start_date": result.metadata.start_date.isoformat(),
        "end_date": result.metadata.end_date.isoformat(),
        "data_points": [
            {"date": b.start.isoformat(), "amount": float(b.amount)} for b in result.data
        ],
    }


async def _exec_get_cost_by_dimension(
    params: dict, session: AsyncSession, workspace_id: str
) -> dict:
    default_start, default_end = _default_date_range()
    dimension = params.get("dimension", "service")
    start = _parse_date(params.get("start_date"), default_start)
    end = _parse_date(params.get("end_date"), default_end)

    svc = CostAttributionService(session, workspace_id)
    result = await svc.get_cost_by_dimension(dimension, start, end)
    return {
        "dimension": dimension,
        "total": float(result.total),
        "currency": "USD",
        "items": [
            {
                "name": item.dimension_value,
                "amount": float(item.amount),
                "percentage": float(item.percentage),
            }
            for item in result.data
        ],
    }


async def _exec_get_spend_over_time(params: dict, session: AsyncSession, workspace_id: str) -> dict:
    default_start, default_end = _default_date_range()
    start = _parse_date(params.get("start_date"), default_start)
    end = _parse_date(params.get("end_date"), default_end)
    granularity_str = params.get("granularity", "daily")
    dimension = params.get("dimension")

    from numio.schemas.attribution import Granularity

    granularity = Granularity(granularity_str)

    svc = CostAttributionService(session, workspace_id)
    result = await svc.get_cost_time_series(start, end, granularity, dimension)
    response: dict[str, Any] = {
        "total": float(result.total),
        "currency": "USD",
        "granularity": granularity_str,
        "data_points": [
            {"date": b.start.isoformat(), "amount": float(b.amount)} for b in result.data
        ],
    }
    if result.by_dimension:
        response["by_dimension"] = {
            series.dimension_value: [
                {"date": b.start.isoformat(), "amount": float(b.amount)} for b in series.data
            ]
            for series in result.by_dimension
        }
    return response


async def _exec_list_findings(params: dict, session: AsyncSession, workspace_id: str) -> dict:
    repo = FindingRepository(session, workspace_id)
    findings, total = await repo.list_findings(
        finding_type=params.get("type"),
        severity=params.get("severity"),
        status=params.get("status", "open"),
        limit=params.get("limit", 20),
    )
    return {
        "total": total,
        "findings": [
            {
                "id": str(f.id),
                "type": f.type,
                "severity": f.severity,
                "status": f.status,
                "title": f.title,
                "resource_id": f.resource_id,
                "estimated_cost_impact": float(f.estimated_cost_impact)
                if f.estimated_cost_impact
                else None,
                "detected_at": f.detected_at.isoformat() if f.detected_at else None,
            }
            for f in findings
        ],
    }


async def _exec_list_recommendations(
    params: dict, session: AsyncSession, workspace_id: str
) -> dict:
    repo = RecommendationRepository(session, workspace_id)
    recs, total = await repo.list_recommendations(
        category=params.get("category"),
        status=params.get("status", "open"),
        sort_by_savings=params.get("sort_by_savings", True),
        limit=params.get("limit", 20),
    )
    return {
        "total": total,
        "recommendations": [
            {
                "id": str(r.id),
                "category": r.category,
                "status": r.status,
                "title": r.title,
                "resource_id": r.resource_id,
                "estimated_monthly_savings": float(r.estimated_monthly_savings)
                if r.estimated_monthly_savings
                else None,
                "confidence": r.confidence,
            }
            for r in recs
        ],
    }


async def _exec_get_savings_summary(params: dict, session: AsyncSession, workspace_id: str) -> dict:
    repo = RecommendationRepository(session, workspace_id)
    summary = await repo.get_savings_summary()
    return {
        "total_estimated_monthly_savings": float(summary["total_estimated_monthly_savings"]),
        "total_actual_savings": float(summary["total_actual_savings"]),
        "total_implemented": summary["total_implemented"],
        "by_category": [
            {
                "category": cat["category"],
                "estimated_monthly_savings": float(cat["estimated_monthly_savings"]),
                "actual_savings": float(cat["actual_savings"]),
                "recommendation_count": cat["recommendation_count"],
            }
            for cat in summary["by_category"]
        ],
    }


async def _exec_get_account_status(params: dict, session: AsyncSession, workspace_id: str) -> dict:
    repo = AwsAccountRepository(session, workspace_id)
    accounts = await repo.list_by_workspace()
    return {
        "total": len(accounts),
        "accounts": [
            {
                "id": str(a.id),
                "aws_account_id": a.aws_account_id,
                "alias": a.alias,
                "status": a.status,
                "status_message": a.status_message,
                "environment_label": a.environment_label,
                "created_at": a.created_at.isoformat() if a.created_at else None,
                "updated_at": a.updated_at.isoformat() if a.updated_at else None,
            }
            for a in accounts
        ],
    }


_EXECUTORS = {
    "get_cost_summary": _exec_get_cost_summary,
    "get_cost_by_dimension": _exec_get_cost_by_dimension,
    "get_spend_over_time": _exec_get_spend_over_time,
    "list_findings": _exec_list_findings,
    "list_recommendations": _exec_list_recommendations,
    "get_savings_summary": _exec_get_savings_summary,
    "get_account_status": _exec_get_account_status,
}
