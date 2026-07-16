"""Cost Explorer pass-through service.

Proxies requests to AWS Cost Explorer API with rate limiting,
pagination handling, and response normalization.
"""

import asyncio
import logging
import random
from datetime import date

import boto3
from botocore.exceptions import ClientError

from numio.core.aws_service import validate_connectivity

logger = logging.getLogger(__name__)

# Rate limiting constants
BASE_DELAY = 1.0
MAX_DELAY = 60.0
MAX_RETRIES = 3
PACING_DELAY = 0.2  # 200ms between calls


class CostExplorerError(Exception):
    """Base exception for Cost Explorer operations."""

    def __init__(self, message: str, status_code: int = 500):
        super().__init__(message)
        self.status_code = status_code


async def _assume_role_and_get_ce_client(role_arn: str):
    """Assume role and return a Cost Explorer client."""
    ok, error_msg, credentials = validate_connectivity(role_arn)
    if not ok:
        raise CostExplorerError(f"AssumeRole failed: {error_msg}", status_code=502)

    session = boto3.Session(
        aws_access_key_id=credentials["AccessKeyId"],
        aws_secret_access_key=credentials["SecretAccessKey"],
        aws_session_token=credentials["SessionToken"],
    )
    return session.client("ce")


async def _call_with_retry(func, *args, **kwargs):
    """Call an AWS API function with exponential backoff on throttling."""
    for attempt in range(MAX_RETRIES + 1):
        try:
            # Run boto3 sync call in thread pool
            result = await asyncio.to_thread(func, *args, **kwargs)
            # Proactive pacing between calls
            await asyncio.sleep(PACING_DELAY)
            return result
        except ClientError as e:
            error_code = e.response["Error"]["Code"]
            if error_code in ("ThrottlingException", "RequestLimitExceeded") or (
                hasattr(e, "response")
                and e.response.get("ResponseMetadata", {}).get("HTTPStatusCode") == 429
            ):
                if attempt == MAX_RETRIES:
                    raise CostExplorerError(
                        "Cost Explorer API rate limit exceeded after retries",
                        status_code=429,
                    ) from e
                delay = min(BASE_DELAY * (2**attempt) + random.uniform(0, 1), MAX_DELAY)
                logger.warning(
                    "CE API throttled (attempt %d/%d), retrying in %.1fs",
                    attempt + 1,
                    MAX_RETRIES,
                    delay,
                )
                await asyncio.sleep(delay)
            elif error_code == "AccessDeniedException":
                raise CostExplorerError(
                    "Cost Explorer access denied",
                    status_code=403,
                ) from e
            else:
                raise CostExplorerError(
                    f"Cost Explorer API error: {error_code} - {e.response['Error']['Message']}",
                ) from e


def _normalize_results_by_time(results_by_time: list, group_key_name: str) -> list[dict]:
    """Normalize GetCostAndUsage ResultsByTime into a flat list."""
    normalized = []
    for period in results_by_time:
        time_start = period["TimePeriod"]["Start"]
        time_end = period["TimePeriod"]["End"]

        if "Groups" in period and period["Groups"]:
            for group in period["Groups"]:
                key_value = group["Keys"][0] if group["Keys"] else ""
                metrics = group["Metrics"]
                amount = metrics.get("UnblendedCost", {}).get("Amount", "0")
                unit = metrics.get("UnblendedCost", {}).get("Unit", "USD")
                normalized.append(
                    {
                        "start": time_start,
                        "end": time_end,
                        group_key_name: key_value,
                        "amount": amount,
                        "currency": unit,
                    }
                )
        elif "Total" in period and period["Total"]:
            metrics = period["Total"]
            amount = metrics.get("UnblendedCost", {}).get("Amount", "0")
            unit = metrics.get("UnblendedCost", {}).get("Unit", "USD")
            normalized.append(
                {
                    "start": time_start,
                    "end": time_end,
                    "amount": amount,
                    "currency": unit,
                }
            )

    return normalized


async def get_cost_by_service(
    role_arn: str,
    start_date: date,
    end_date: date,
    granularity: str = "DAILY",
) -> list[dict]:
    """Get cost breakdown by service."""
    ce = await _assume_role_and_get_ce_client(role_arn)

    all_results = []
    params = {
        "TimePeriod": {"Start": str(start_date), "End": str(end_date)},
        "Granularity": granularity,
        "Metrics": ["UnblendedCost"],
        "GroupBy": [{"Type": "DIMENSION", "Key": "SERVICE"}],
    }

    while True:
        response = await _call_with_retry(ce.get_cost_and_usage, **params)
        all_results.extend(response.get("ResultsByTime", []))
        if "NextPageToken" not in response:
            break
        params["NextPageToken"] = response["NextPageToken"]

    return _normalize_results_by_time(all_results, "service")


async def get_cost_by_region(
    role_arn: str,
    start_date: date,
    end_date: date,
    granularity: str = "DAILY",
) -> list[dict]:
    """Get cost breakdown by region."""
    ce = await _assume_role_and_get_ce_client(role_arn)

    all_results = []
    params = {
        "TimePeriod": {"Start": str(start_date), "End": str(end_date)},
        "Granularity": granularity,
        "Metrics": ["UnblendedCost"],
        "GroupBy": [{"Type": "DIMENSION", "Key": "REGION"}],
    }

    while True:
        response = await _call_with_retry(ce.get_cost_and_usage, **params)
        all_results.extend(response.get("ResultsByTime", []))
        if "NextPageToken" not in response:
            break
        params["NextPageToken"] = response["NextPageToken"]

    return _normalize_results_by_time(all_results, "region")


async def get_cost_by_tag(
    role_arn: str,
    start_date: date,
    end_date: date,
    tag_key: str,
    granularity: str = "DAILY",
) -> list[dict]:
    """Get cost breakdown by a specific tag key."""
    ce = await _assume_role_and_get_ce_client(role_arn)

    all_results = []
    params = {
        "TimePeriod": {"Start": str(start_date), "End": str(end_date)},
        "Granularity": granularity,
        "Metrics": ["UnblendedCost"],
        "GroupBy": [{"Type": "TAG", "Key": tag_key}],
    }

    while True:
        response = await _call_with_retry(ce.get_cost_and_usage, **params)
        all_results.extend(response.get("ResultsByTime", []))
        if "NextPageToken" not in response:
            break
        params["NextPageToken"] = response["NextPageToken"]

    return _normalize_results_by_time(all_results, "tag_value")


async def get_tags(
    role_arn: str,
    start_date: date,
    end_date: date,
) -> list[str]:
    """Get available tag keys for an account within a date range."""
    ce = await _assume_role_and_get_ce_client(role_arn)

    all_tags = []
    params = {
        "TimePeriod": {"Start": str(start_date), "End": str(end_date)},
    }

    while True:
        response = await _call_with_retry(ce.get_tags, **params)
        all_tags.extend(response.get("Tags", []))
        if "NextPageToken" not in response:
            break
        params["NextPageToken"] = response["NextPageToken"]

    return all_tags


async def get_total_cost(
    role_arn: str,
    start_date: date,
    end_date: date,
    granularity: str = "DAILY",
) -> list[dict]:
    """Get total cost time series (no grouping)."""
    ce = await _assume_role_and_get_ce_client(role_arn)

    all_results = []
    params = {
        "TimePeriod": {"Start": str(start_date), "End": str(end_date)},
        "Granularity": granularity,
        "Metrics": ["UnblendedCost"],
    }

    while True:
        response = await _call_with_retry(ce.get_cost_and_usage, **params)
        all_results.extend(response.get("ResultsByTime", []))
        if "NextPageToken" not in response:
            break
        params["NextPageToken"] = response["NextPageToken"]

    return _normalize_results_by_time(all_results, "total")
