"""IA v2 unified Usage endpoint — tag-as-dimension supported.

Scaffold-only. Returns realistic chart series + breakdown so the Usage page
can flip from local mock data to live API calls. Real implementation will
project cost_records by tag key extracted from the JSONB tags column.
"""

from datetime import date, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, Query

from numio.core.auth import AuthenticatedUser, get_current_user
from numio.schemas.ia_v2_usage import (
    UsageBreakdownRow,
    UsageForecast,
    UsageRange,
    UsageResponse,
    UsageScope,
    UsageSeries,
    UsageSeriesPoint,
)

router = APIRouter(prefix="/usage", tags=["ia-v2-usage"])

PLATFORM_DIMS = ["service", "account", "region", "provider", "resource_type"]
TAG_KEYS = ["env", "team", "cost-center", "owner", "service", "criticality"]

_RANGE_DAYS = {
    UsageRange.range_7d: 7,
    UsageRange.range_30d: 30,
    UsageRange.mtd: 15,
    UsageRange.qtd: 45,
    UsageRange.ytd: 120,
}


def _series(scope: UsageScope, days: int) -> list[UsageSeries]:
    today = date.today()

    def points(base: float, drift: float) -> list[UsageSeriesPoint]:
        return [
            UsageSeriesPoint(date=today - timedelta(days=days - i - 1), value=Decimal(str(round(base + drift * i, 2))))
            for i in range(days)
        ]

    if scope == UsageScope.cloud:
        return [
            UsageSeries(name="CC-PAY", color="#6366f1", points=points(1400, 12)),
            UsageSeries(name="CC-ML", color="#10b981", points=points(1020, 18)),
            UsageSeries(name="CC-ENG", color="#f59e0b", points=points(820, 4)),
            UsageSeries(name="CC-DAT", color="#ef4444", points=points(540, 6)),
            UsageSeries(name="CC-FIN", color="#8b5cf6", points=points(410, 1)),
            UsageSeries(name="CC-SAL", color="#ec4899", points=points(280, 2)),
            UsageSeries(name="Untagged", color="#9ca3af", untagged=True, points=points(50, 0)),
        ]
    return [
        UsageSeries(name="payments", color="#6366f1", points=points(110, 4)),
        UsageSeries(name="eng", color="#10b981", points=points(78, 3)),
        UsageSeries(name="data", color="#f59e0b", points=points(44, -1)),
        UsageSeries(name="sales", color="#ef4444", points=points(22, 2)),
        UsageSeries(name="ml", color="#8b5cf6", points=points(20, 0)),
        UsageSeries(name="Untagged", color="#9ca3af", untagged=True, points=points(12, 0)),
    ]


def _breakdown(scope: UsageScope) -> tuple[list[UsageBreakdownRow], Decimal]:
    if scope == UsageScope.cloud:
        rows = [
            UsageBreakdownRow(name="CC-PAY", team="payments", spend=Decimal("84120"), share_pct=31, trend_pct=-2.1, trend_up=False),
            UsageBreakdownRow(name="CC-ML", team="ml", spend=Decimal("62840"), share_pct=23, trend_pct=8.4, trend_up=True),
            UsageBreakdownRow(name="CC-ENG", team="eng", spend=Decimal("51300"), share_pct=19, trend_pct=-1.0, trend_up=False),
            UsageBreakdownRow(name="CC-DAT", team="data", spend=Decimal("32180"), share_pct=12, trend_pct=3.2, trend_up=True),
            UsageBreakdownRow(name="CC-FIN", team="finance", spend=Decimal("24500"), share_pct=9, trend_pct=0.4, trend_up=True),
            UsageBreakdownRow(name="CC-SAL", team="sales", spend=Decimal("16400"), share_pct=6, trend_pct=1.8, trend_up=True),
            UsageBreakdownRow(name="Untagged", team=None, spend=Decimal("2840"), share_pct=1, trend_pct=12, trend_up=True, untagged=True),
        ]
        return rows, Decimal("2840")
    rows = [
        UsageBreakdownRow(name="payments", spend=Decimal("3840"), share_pct=43, trend_pct=12, trend_up=True),
        UsageBreakdownRow(name="eng", spend=Decimal("2280"), share_pct=26, trend_pct=5, trend_up=True),
        UsageBreakdownRow(name="data", spend=Decimal("1240"), share_pct=14, trend_pct=-3, trend_up=False),
        UsageBreakdownRow(name="sales", spend=Decimal("620"), share_pct=7, trend_pct=42, trend_up=True),
        UsageBreakdownRow(name="ml", spend=Decimal("580"), share_pct=7, trend_pct=8, trend_up=True),
        UsageBreakdownRow(name="Untagged", spend=Decimal("340"), share_pct=4, trend_pct=25, trend_up=True, untagged=True),
    ]
    return rows, Decimal("340")


@router.get("", response_model=UsageResponse, summary="Get usage data for chart + breakdown")
async def get_usage(
    scope: UsageScope = Query(UsageScope.cloud),
    range_: UsageRange = Query(UsageRange.range_30d, alias="range"),
    group_by: str = Query("tag:cost-center", description="platform:<key> or tag:<key>"),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> UsageResponse:
    days = _RANGE_DAYS[range_]
    series = _series(scope, days)
    breakdown, untagged_spend = _breakdown(scope)

    if scope == UsageScope.cloud:
        total = Decimal("274229")
        delta_pct = -6.4
        forecast = UsageForecast(value=Decimal("297500"), budget=Decimal("320000"), status="on track")
    else:
        total = Decimal("8900")
        delta_pct = 18.0
        forecast = None

    return UsageResponse(
        scope=scope,
        range=range_,
        group_by=group_by,
        total=total,
        delta_pct=delta_pct,
        forecast=forecast,
        series=series,
        breakdown=breakdown,
        untagged_spend=untagged_spend,
        tag_keys_available=TAG_KEYS,
        platform_dims_available=PLATFORM_DIMS,
    )


@router.get("/tag-keys", response_model=list[str], summary="List tag keys available for group-by/filter")
async def list_tag_keys(
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> list[str]:
    return TAG_KEYS
