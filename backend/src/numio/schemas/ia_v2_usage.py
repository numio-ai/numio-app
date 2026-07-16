"""Pydantic schemas for IA v2 tag-as-dimension usage queries.

Frontend shape: chart series (stacked area) + breakdown table rows, both keyed
by an arbitrary dimension. Dimension is either a platform attribute
(service/account/region/provider/resource_type) or a tag key (`tag:<key>`).
Untagged is surfaced as a first-class series + row.
"""

from datetime import date
from decimal import Decimal
from enum import Enum

from pydantic import BaseModel, Field


class UsageScope(str, Enum):
    cloud = "cloud"
    ai = "ai"


class UsageRange(str, Enum):
    range_7d = "7D"
    range_30d = "30D"
    mtd = "MTD"
    qtd = "QTD"
    ytd = "YTD"


class UsageSeriesPoint(BaseModel):
    date: date
    value: Decimal


class UsageSeries(BaseModel):
    name: str
    color: str | None = None
    untagged: bool = False
    points: list[UsageSeriesPoint]


class UsageBreakdownRow(BaseModel):
    name: str
    team: str | None = None
    spend: Decimal
    share_pct: float
    trend_pct: float | None = None
    trend_up: bool | None = None
    untagged: bool = False


class UsageForecast(BaseModel):
    value: Decimal
    budget: Decimal
    status: str


class UsageResponse(BaseModel):
    scope: UsageScope
    range: UsageRange
    group_by: str = Field(..., description="platform:<key> or tag:<key>")
    total: Decimal
    delta_pct: float
    forecast: UsageForecast | None = None
    series: list[UsageSeries]
    breakdown: list[UsageBreakdownRow]
    untagged_spend: Decimal = Field(default=Decimal("0"))
    tag_keys_available: list[str]
    platform_dims_available: list[str]
