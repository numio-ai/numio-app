"""Numio REST API routes.

Placeholder routes for the REST API. Actual business logic will be implemented
in the core services module and shared with MCP endpoints.
"""

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse

from numio.core.auth import AuthenticatedUser, get_current_user
from numio.core.config import settings
from numio.core.services import CostService

router = APIRouter(tags=["cost"])

if settings.environment != "production":
    debug_router = APIRouter(tags=["debug"])

    @debug_router.get("/debug/error", summary="Trigger test error")
    async def debug_error() -> JSONResponse:
        """Raise an unhandled exception for testing error handling."""
        raise RuntimeError("Test unhandled exception for error handling verification")

    router.include_router(debug_router)


@router.get("/cost/summary", summary="Get cost summary")
async def get_cost_summary(
    days: int = Query(default=30, ge=1, le=365, description="Number of days to summarize"),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> JSONResponse:
    """Get a summary of cloud costs.

    Returns placeholder data - actual implementation pending.
    """
    service = CostService()
    summary = service.get_cost_summary()
    return JSONResponse(content=summary)


@router.get("/cost/by-service", summary="Get costs by service")
async def get_cost_by_service(
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> JSONResponse:
    """Get cloud costs grouped by service.

    Returns placeholder data - actual implementation pending.
    """
    service = CostService()
    costs = service.get_cost_by_service()
    return JSONResponse(content=costs)


@router.get("/cost/trends", summary="Get cost trends")
async def get_cost_trends(
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> JSONResponse:
    """Get cost trends over time.

    Returns placeholder data - actual implementation pending.
    """
    service = CostService()
    trends = service.get_cost_trends()
    return JSONResponse(content=trends)
