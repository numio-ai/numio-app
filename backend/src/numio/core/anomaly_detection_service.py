"""Anomaly detection service — spike and drift detection on cost time series.

Computes baselines per dimension using rolling averages and standard deviations.
Detects sudden spikes (mean + threshold × σ) and gradual drift (linear regression).
Creates findings via the findings repository.
"""

import logging
import math
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import case, func, literal, select
from sqlalchemy.ext.asyncio import AsyncSession

from numio.db.finding_repository import FindingRepository
from numio.models.anomaly_threshold import AnomalyThreshold
from numio.models.attribution_rule import AttributionRule
from numio.models.cloud_resource import CloudResource
from numio.models.cost_record import CostRecord
from numio.schemas.finding import CreateFindingRequest

logger = logging.getLogger("numio.core.anomaly_detection")

# Global defaults matching task spec
DEFAULT_WINDOW_DAYS = 14
DEFAULT_SIGMA_THRESHOLD = Decimal("3.0")
DEFAULT_DRIFT_THRESHOLD_PCT = Decimal("10.0")

# Minimum data points required before detection activates
MIN_HISTORY_DAYS = 14

# Native dimensions that map directly to CostRecord columns
NATIVE_DIMENSIONS = {
    "service": CostRecord.service,
    "account": CostRecord.usage_account_id,
    "region": CostRecord.region,
}


class AnomalyDetectionService:
    """Detects cost spikes and drift per dimension."""

    def __init__(self, session: AsyncSession, workspace_id: str) -> None:
        self._session = session
        self._workspace_id = workspace_id

    async def run_detection(self, detection_date: date | None = None) -> int:
        """Run anomaly detection across all monitored dimensions.

        Returns the number of new findings created.
        """
        if detection_date is None:
            detection_date = date.today()

        finding_count = 0
        dimensions = await self._get_monitored_dimensions()

        for dim_type in dimensions:
            defaults = await self._get_default_thresholds(dim_type)
            window_days = int(defaults["window_days"])

            daily_costs = await self._get_daily_costs_by_dimension(
                dim_type, detection_date, window_days
            )

            for dim_value, costs in daily_costs.items():
                if len(costs) < MIN_HISTORY_DAYS:
                    logger.info(
                        "Skipping %s:%s — only %d days of history (need %d)",
                        dim_type,
                        dim_value,
                        len(costs),
                        MIN_HISTORY_DAYS,
                    )
                    continue

                # Per-dimension-value override takes precedence
                params = await self._resolve_thresholds(dim_type, dim_value)
                sigma = float(params["sigma_threshold"])
                drift_pct = float(params["drift_threshold_pct"])
                effective_window = int(params["window_days"])

                # Extract values ordered by date
                sorted_dates = sorted(costs.keys())
                values = [float(costs[d]) for d in sorted_dates]

                # Spike detection
                spike = detect_spike(values, sigma)
                if spike:
                    finding_count += await self._create_spike_finding(
                        dim_type, dim_value, spike, detection_date, effective_window
                    )

                # Drift detection
                drift = detect_drift(values, drift_pct, effective_window)
                if drift:
                    finding_count += await self._create_drift_finding(
                        dim_type, dim_value, drift, detection_date
                    )

        return finding_count

    # ------------------------------------------------------------------
    # Cost data query
    # ------------------------------------------------------------------

    async def _get_daily_costs_by_dimension(
        self, dimension_type: str, detection_date: date, window_days: int
    ) -> dict[str, dict[date, Decimal]]:
        """Query daily costs grouped by dimension value over the window."""
        start_date = detection_date - timedelta(days=window_days)
        dim_expr = await self._get_dimension_expr(dimension_type)

        stmt = (
            select(
                func.date(CostRecord.usage_start).label("day"),
                dim_expr.label("dimension_value"),
                func.sum(CostRecord.unblended_cost).label("amount"),
            )
            .where(
                CostRecord.workspace_id == self._workspace_id,
                func.date(CostRecord.usage_start) >= start_date,
                func.date(CostRecord.usage_start) <= detection_date,
            )
            .group_by("day", "dimension_value")
            .order_by("day")
        )

        result = await self._session.execute(stmt)
        rows = result.all()

        costs: dict[str, dict[date, Decimal]] = {}
        for row in rows:
            dv = row.dimension_value or "unallocated"
            if dv not in costs:
                costs[dv] = {}
            costs[dv][row.day] = row.amount

        return costs

    async def _get_dimension_expr(self, dimension_type: str):
        """Return a SQL expression for grouping by the given dimension."""
        if dimension_type in NATIVE_DIMENSIONS:
            return NATIVE_DIMENSIONS[dimension_type]

        # Attribution-rule based dimension
        rules = await self._get_attribution_rules(dimension_type)
        return _build_dimension_case_expr(rules)

    async def _get_attribution_rules(self, dimension: str) -> list[AttributionRule]:
        result = await self._session.execute(
            select(AttributionRule)
            .where(
                AttributionRule.workspace_id == self._workspace_id,
                AttributionRule.dimension == dimension,
            )
            .order_by(AttributionRule.priority)
        )
        return list(result.scalars().all())

    # ------------------------------------------------------------------
    # Threshold resolution
    # ------------------------------------------------------------------

    async def _get_monitored_dimensions(self) -> list[str]:
        """Native dimensions plus any with custom threshold overrides."""
        dimensions = list(NATIVE_DIMENSIONS.keys())

        result = await self._session.execute(
            select(AnomalyThreshold.dimension_type)
            .where(AnomalyThreshold.workspace_id == self._workspace_id)
            .distinct()
        )
        for (dim,) in result.all():
            if dim not in dimensions:
                dimensions.append(dim)

        return dimensions

    async def _get_default_thresholds(self, dimension_type: str) -> dict:
        """Global default or type-level wildcard override."""
        result = await self._session.execute(
            select(AnomalyThreshold).where(
                AnomalyThreshold.workspace_id == self._workspace_id,
                AnomalyThreshold.dimension_type == dimension_type,
                AnomalyThreshold.dimension_value == "*",
            )
        )
        override = result.scalar_one_or_none()
        if override:
            return {
                "window_days": override.window_days,
                "sigma_threshold": override.sigma_threshold,
                "drift_threshold_pct": override.drift_threshold_pct,
            }
        return {
            "window_days": DEFAULT_WINDOW_DAYS,
            "sigma_threshold": DEFAULT_SIGMA_THRESHOLD,
            "drift_threshold_pct": DEFAULT_DRIFT_THRESHOLD_PCT,
        }

    async def _resolve_thresholds(self, dimension_type: str, dimension_value: str) -> dict:
        """Per-dimension-value override > type-level wildcard > global defaults."""
        result = await self._session.execute(
            select(AnomalyThreshold).where(
                AnomalyThreshold.workspace_id == self._workspace_id,
                AnomalyThreshold.dimension_type == dimension_type,
                AnomalyThreshold.dimension_value == dimension_value,
            )
        )
        override = result.scalar_one_or_none()
        if override:
            return {
                "window_days": override.window_days,
                "sigma_threshold": override.sigma_threshold,
                "drift_threshold_pct": override.drift_threshold_pct,
            }
        return await self._get_default_thresholds(dimension_type)

    # ------------------------------------------------------------------
    # Likely cause inference
    # ------------------------------------------------------------------

    async def _infer_likely_cause(
        self, dimension_type: str, dimension_value: str, detection_date: date, window_days: int
    ) -> str | None:
        """Best-effort heuristic: new_resource, usage_spike, or None."""
        window_start = detection_date - timedelta(days=window_days)

        # Check for new cloud resources in the anomaly window
        dim_filter = _resource_dimension_filter(dimension_type, dimension_value)
        if dim_filter is not None:
            result = await self._session.execute(
                select(func.count(CloudResource.id)).where(
                    CloudResource.workspace_id == self._workspace_id,
                    dim_filter,
                    CloudResource.first_seen_at >= window_start,
                )
            )
            new_count = result.scalar_one()
            if new_count > 0:
                return "new_resource"

        # Check if usage_amount increased compared to baseline
        usage_increased = await self._check_usage_increase(
            dimension_type, dimension_value, detection_date, window_days
        )
        if usage_increased:
            return "usage_spike"

        return None

    async def _check_usage_increase(
        self, dimension_type: str, dimension_value: str, detection_date: date, window_days: int
    ) -> bool:
        """Check if usage_amount for the current day exceeds average of prior days."""
        start_date = detection_date - timedelta(days=window_days)
        dim_expr = await self._get_dimension_expr(dimension_type)

        # Average usage for prior days
        baseline_stmt = select(func.avg(CostRecord.usage_amount)).where(
            CostRecord.workspace_id == self._workspace_id,
            func.date(CostRecord.usage_start) >= start_date,
            func.date(CostRecord.usage_start) < detection_date,
            dim_expr == dimension_value,
            CostRecord.usage_amount.isnot(None),
        )
        baseline_result = await self._session.execute(baseline_stmt)
        avg_usage = baseline_result.scalar_one_or_none()

        if avg_usage is None or avg_usage == 0:
            return False

        # Current day usage
        current_stmt = select(func.sum(CostRecord.usage_amount)).where(
            CostRecord.workspace_id == self._workspace_id,
            func.date(CostRecord.usage_start) == detection_date,
            dim_expr == dimension_value,
            CostRecord.usage_amount.isnot(None),
        )
        current_result = await self._session.execute(current_stmt)
        current_usage = current_result.scalar_one_or_none()

        if current_usage is None:
            return False

        return current_usage > avg_usage * Decimal("1.5")

    # ------------------------------------------------------------------
    # Finding creation
    # ------------------------------------------------------------------

    async def _create_spike_finding(
        self, dim_type: str, dim_value: str, spike: dict, detection_date: date, window_days: int
    ) -> int:
        """Create a spike finding. Returns 1 if new, 0 if deduped."""
        likely_cause = await self._infer_likely_cause(
            dim_type, dim_value, detection_date, window_days
        )

        magnitude_dollar = Decimal(str(round(spike["magnitude_dollar"], 2)))
        magnitude_pct = round(spike["magnitude_pct"], 1)
        severity = _spike_severity(magnitude_pct)
        cause_text = f" Likely cause: {likely_cause}." if likely_cause else ""

        repo = FindingRepository(self._session, self._workspace_id)
        _, created = await repo.create_or_update(
            CreateFindingRequest(
                type="anomaly",
                severity=severity,
                title=f"Cost spike on {dim_type}:{dim_value}",
                description=(
                    f"Daily cost for {dim_type}={dim_value} spiked to "
                    f"${spike['current']:.2f} vs baseline mean ${spike['mean']:.2f} "
                    f"(+${magnitude_dollar}, +{magnitude_pct}%).{cause_text}"
                ),
                resource_id=f"{dim_type}:{dim_value}",
                detection_source="anomaly_spike",
                suggested_action=f"Review recent cost changes for {dim_type}={dim_value}",
                estimated_cost_impact=magnitude_dollar,
            )
        )
        return 1 if created else 0

    async def _create_drift_finding(
        self, dim_type: str, dim_value: str, drift: dict, detection_date: date
    ) -> int:
        """Create a drift finding. Returns 1 if new, 0 if deduped."""
        likely_cause = await self._infer_likely_cause(
            dim_type, dim_value, detection_date, drift["window_days"]
        )

        projected_change = Decimal(str(round(drift["projected_change"], 2)))
        projected_pct = round(drift["projected_pct"], 1)
        severity = _drift_severity(projected_pct)
        cause_text = f" Likely cause: {likely_cause}." if likely_cause else ""

        repo = FindingRepository(self._session, self._workspace_id)
        _, created = await repo.create_or_update(
            CreateFindingRequest(
                type="anomaly",
                severity=severity,
                title=f"Cost drift on {dim_type}:{dim_value}",
                description=(
                    f"Gradual cost increase detected for {dim_type}={dim_value}. "
                    f"Projected +${projected_change} (+{projected_pct}%) over "
                    f"{drift['window_days']} days based on trend slope.{cause_text}"
                ),
                resource_id=f"{dim_type}:{dim_value}",
                detection_source="anomaly_drift",
                suggested_action=f"Investigate gradual cost increase in {dim_type}={dim_value}",
                estimated_cost_impact=projected_change,
            )
        )
        return 1 if created else 0


# ------------------------------------------------------------------
# Pure functions (stateless, testable independently)
# ------------------------------------------------------------------


def detect_spike(values: list[float], sigma_threshold: float) -> dict | None:
    """Detect if the latest value is a spike above mean + threshold × σ.

    Uses all values except the last as baseline; the last value is the
    current day being tested.
    """
    if len(values) < 2:
        return None

    baseline = values[:-1]
    current = values[-1]

    mean = sum(baseline) / len(baseline)
    if mean == 0:
        return None

    variance = sum((x - mean) ** 2 for x in baseline) / len(baseline)
    stddev = math.sqrt(variance)

    if stddev == 0:
        # Constant baseline — no statistical basis for spike detection.
        # Skip to avoid false positives on minor fluctuations.
        return None

    threshold_value = mean + (sigma_threshold * stddev)
    if current > threshold_value:
        return {
            "current": current,
            "mean": mean,
            "stddev": stddev,
            "threshold": threshold_value,
            "magnitude_dollar": current - mean,
            "magnitude_pct": (current - mean) / mean * 100,
        }

    return None


def detect_drift(values: list[float], drift_threshold_pct: float, window_days: int) -> dict | None:
    """Detect gradual upward cost trend via linear regression slope.

    A drift anomaly fires when the slope projects a ≥threshold% increase
    over the window period.
    """
    n = len(values)
    if n < 2:
        return None

    x_values = list(range(n))
    x_mean = sum(x_values) / n
    y_mean = sum(values) / n

    if y_mean == 0:
        return None

    numerator = sum((x - x_mean) * (y - y_mean) for x, y in zip(x_values, values))
    denominator = sum((x - x_mean) ** 2 for x in x_values)

    if denominator == 0:
        return None

    slope = numerator / denominator

    projected_change = slope * window_days
    projected_pct = projected_change / y_mean * 100

    if projected_pct >= drift_threshold_pct:
        return {
            "slope": slope,
            "projected_change": projected_change,
            "projected_pct": projected_pct,
            "baseline_mean": y_mean,
            "window_days": window_days,
        }

    return None


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------


def _build_dimension_case_expr(rules: list[AttributionRule]):
    """Build SQL CASE expression from attribution rules."""
    whens = []
    for rule in sorted(rules, key=lambda r: r.priority):
        config = rule.mapping_config
        if rule.source_type == "tag":
            tag_key = config["tag_key"]
            whens.append(
                (
                    CostRecord.tags[tag_key].as_string().isnot(None),
                    CostRecord.tags[tag_key].as_string(),
                )
            )
        elif rule.source_type == "account":
            account_ids = config["account_ids"]
            dimension_value = config["dimension_value"]
            whens.append(
                (
                    CostRecord.usage_account_id.in_(account_ids),
                    literal(dimension_value),
                )
            )
    if not whens:
        return literal("unallocated")
    return case(*whens, else_=literal("unallocated"))


def _resource_dimension_filter(dimension_type: str, dimension_value: str):
    """Map a cost dimension to a CloudResource filter."""
    if dimension_type == "service":
        return CloudResource.service == dimension_value
    if dimension_type == "account":
        return CloudResource.account_id == dimension_value
    return None


def _spike_severity(magnitude_pct: float) -> str:
    """Map spike magnitude percentage to severity."""
    if magnitude_pct >= 200:
        return "critical"
    if magnitude_pct >= 100:
        return "high"
    if magnitude_pct >= 50:
        return "medium"
    return "low"


def _drift_severity(projected_pct: float) -> str:
    """Map drift projected percentage to severity."""
    if projected_pct >= 50:
        return "high"
    if projected_pct >= 25:
        return "medium"
    return "low"
