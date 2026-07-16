"""Pydantic schemas for Cost Explorer pass-through API responses."""

from datetime import date
from enum import Enum

from pydantic import BaseModel, Field


class Granularity(str, Enum):
    DAILY = "DAILY"
    MONTHLY = "MONTHLY"


class CostDataPoint(BaseModel):
    """A single cost data point in a time series."""

    start: str = Field(description="Period start date (YYYY-MM-DD)")
    end: str = Field(description="Period end date (YYYY-MM-DD)")
    amount: str = Field(description="Cost amount")
    currency: str = Field(description="Currency code (e.g., USD)")


class CostByServiceDataPoint(CostDataPoint):
    service: str = Field(description="AWS service name")


class CostByRegionDataPoint(CostDataPoint):
    region: str = Field(description="AWS region")


class CostByTagDataPoint(CostDataPoint):
    tag_value: str = Field(description="Tag value")


class CostByServiceResponse(BaseModel):
    account_id: str
    start_date: date
    end_date: date
    granularity: str
    data: list[CostByServiceDataPoint]


class CostByRegionResponse(BaseModel):
    account_id: str
    start_date: date
    end_date: date
    granularity: str
    data: list[CostByRegionDataPoint]


class CostByTagResponse(BaseModel):
    account_id: str
    start_date: date
    end_date: date
    tag_key: str
    granularity: str
    data: list[CostByTagDataPoint]


class TagsResponse(BaseModel):
    account_id: str
    start_date: date
    end_date: date
    tags: list[str]


class TotalCostResponse(BaseModel):
    account_id: str
    start_date: date
    end_date: date
    granularity: str
    data: list[CostDataPoint]
