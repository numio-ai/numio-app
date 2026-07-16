"""Numio FastAPI application entrypoint."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text

from numio.api.accounts import router as accounts_router
from numio.api.anomaly_thresholds import router as anomaly_thresholds_router
from numio.api.attribution_rules import router as attribution_rules_router
from numio.api.audit_action_events import router as audit_action_events_router
from numio.api.audit_config_events import router as audit_config_events_router
from numio.api.auth import router as auth_router
from numio.api.aws_org_tag_policy import router as aws_org_tag_policy_router
from numio.api.budgets import router as budgets_router
from numio.api.campaigns import router as campaigns_router
from numio.api.chat import router as chat_router
from numio.api.compliance import router as compliance_router
from numio.api.cost_explorer import router as cost_explorer_router
from numio.api.cost_views import router as cost_views_router
from numio.api.data_explorer import router as data_explorer_router
from numio.api.findings import router as findings_router
from numio.api.ia_v2_autopilot import router as ia_v2_autopilot_router
from numio.api.ia_v2_budgets import router as ia_v2_budgets_router
from numio.api.ia_v2_inbox import router as ia_v2_inbox_router
from numio.api.ia_v2_inventory import router as ia_v2_inventory_router
from numio.api.ia_v2_policies import router as ia_v2_policies_router
from numio.api.ia_v2_recommendations_evidence import router as ia_v2_rec_evidence_router
from numio.api.ia_v2_saved_views import router as ia_v2_saved_views_router
from numio.api.ia_v2_usage import router as ia_v2_usage_router
from numio.api.infra_policies import router as infra_policies_router
from numio.api.jobs import router as jobs_router
from numio.api.notifications import router as notifications_router
from numio.api.onboarding import router as onboarding_router
from numio.api.recommendations import router as recommendations_router
from numio.api.resources import router as resources_router
from numio.api.routes import router as api_router
from numio.api.tag_policies import router as tag_policies_router
from numio.api.tags import router as tags_router
from numio.api.users import router as users_router
from numio.api.workspace import router as workspace_router
from numio.api.zombie_thresholds import router as zombie_thresholds_router
from numio.core.config import settings
from numio.core.error_handlers import register_error_handlers
from numio.core.logging import configure_logging
from numio.core.middleware import RequestIDMiddleware, SecurityHeadersMiddleware
from numio.core.rate_limit import limiter
from numio.db.session import AsyncSessionLocal
from numio.mcp.server import mcp, register_mcp_endpoints

configure_logging(log_level=settings.log_level, json_output=settings.environment != "local")
logger = logging.getLogger("numio")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup/shutdown."""
    # MCP remote transports require the session manager to be running.
    async with mcp.session_manager.run():
        logger.info("Numio server starting...")
        yield
        logger.info("Numio server shutting down...")


app = FastAPI(
    title="Numio API",
    description="Cloud cost analysis REST API and MCP server",
    version=settings.app_version,
    lifespan=lifespan,
)

# Middleware — order matters: outermost first (RequestID → SecurityHeaders → CORS)
app.add_middleware(RequestIDMiddleware)
app.add_middleware(SecurityHeadersMiddleware)

# CORS — restrict to configured origins instead of wildcard
_cors_origins = [o.strip() for o in settings.cors_allowed_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-API-Key"],
)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Error handlers
register_error_handlers(app)

# Onboarding-specific validation: surface label rejection as a structured 422.
from numio.api.onboarding import label_validation_handler  # noqa: E402
from numio.onboarding.cfn_template import LabelValidationError  # noqa: E402

app.add_exception_handler(LabelValidationError, label_validation_handler)

# Register routes
app.include_router(auth_router, prefix="/api/v1")
app.include_router(api_router, prefix="/api/v1")
app.include_router(accounts_router, prefix="/api/v1")
app.include_router(onboarding_router, prefix="/api/v1")
app.include_router(jobs_router, prefix="/api/v1")
app.include_router(cost_explorer_router, prefix="/api/v1")
app.include_router(tag_policies_router, prefix="/api/v1")
app.include_router(tags_router, prefix="/api/v1")
app.include_router(aws_org_tag_policy_router, prefix="/api/v1")
app.include_router(compliance_router, prefix="/api/v1")
app.include_router(campaigns_router, prefix="/api/v1")
app.include_router(attribution_rules_router, prefix="/api/v1")
app.include_router(cost_views_router, prefix="/api/v1")
app.include_router(data_explorer_router, prefix="/api/v1")
app.include_router(findings_router, prefix="/api/v1")
app.include_router(resources_router, prefix="/api/v1")
app.include_router(anomaly_thresholds_router, prefix="/api/v1")
app.include_router(zombie_thresholds_router, prefix="/api/v1")
app.include_router(budgets_router, prefix="/api/v1")
app.include_router(infra_policies_router, prefix="/api/v1")
app.include_router(recommendations_router, prefix="/api/v1")
app.include_router(chat_router, prefix="/api/v1")
app.include_router(notifications_router, prefix="/api/v1")
app.include_router(audit_config_events_router, prefix="/api/v1")
app.include_router(audit_action_events_router, prefix="/api/v1")
app.include_router(workspace_router, prefix="/api/v1")
app.include_router(users_router, prefix="/api/v1")
app.include_router(ia_v2_saved_views_router, prefix="/api/v1")
app.include_router(ia_v2_usage_router, prefix="/api/v1")
app.include_router(ia_v2_inventory_router, prefix="/api/v1")
app.include_router(ia_v2_rec_evidence_router, prefix="/api/v1")
app.include_router(ia_v2_autopilot_router, prefix="/api/v1")
app.include_router(ia_v2_budgets_router, prefix="/api/v1")
app.include_router(ia_v2_policies_router, prefix="/api/v1")
app.include_router(ia_v2_inbox_router, prefix="/api/v1")
register_mcp_endpoints(app)


@app.get("/health", summary="Health check")
async def health_check() -> JSONResponse:
    """Health check endpoint with database connectivity status."""
    db_status = "connected"
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
    except Exception:
        db_status = "disconnected"

    return JSONResponse(
        content={
            "service": "numio",
            "status": "ok",
            "version": settings.app_version,
            "environment": settings.environment,
            "database": db_status,
        }
    )


@app.get("/", summary="Root endpoint")
async def root() -> JSONResponse:
    """Root endpoint redirects to health."""
    return await health_check()


def run(host: str = "0.0.0.0", port: int = 8000) -> None:
    """Run the Numio server."""
    import uvicorn

    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    run()
