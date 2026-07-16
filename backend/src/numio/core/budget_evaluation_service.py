"""Budget evaluation service — spend tracking, burn rate projection, and alert generation."""

import calendar
import logging
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from numio.core.cost_attribution_service import CostAttributionService
from numio.db.budget_repository import BudgetRepository
from numio.db.finding_repository import FindingRepository
from numio.models.budget import Budget
from numio.schemas.budget import BudgetDetailResponse, BudgetStatus, CostDriverItem
from numio.schemas.finding import CreateFindingRequest

logger = logging.getLogger(__name__)

TOP_COST_DRIVERS = 5


class BudgetEvaluationService:
    """Evaluates budgets against current spend and generates alert findings."""

    def __init__(self, session: AsyncSession, workspace_id: str) -> None:
        self._session = session
        self._workspace_id = workspace_id
        self._cost_service = CostAttributionService(session, workspace_id)
        self._budget_repo = BudgetRepository(session, workspace_id)
        self._finding_repo = FindingRepository(session, workspace_id)

    # --- Public API ---

    async def evaluate_budget(self, budget: Budget) -> BudgetDetailResponse:
        """Evaluate a single budget: compute spend, burn rate, status, and cost drivers."""
        period_start, period_end = self._period_boundaries(budget.period, date.today())
        days_in_period = (period_end - period_start).days
        days_elapsed = max((date.today() - period_start).days, 1)

        # Get spend for the budget's dimension in current period
        cost_data = await self._cost_service.get_cost_by_dimension(
            dimension=budget.dimension,
            start_date=period_start,
            end_date=min(date.today(), period_end),
        )

        current_spend = Decimal(0)
        for item in cost_data.data:
            if item.dimension_value == budget.dimension_value:
                current_spend = item.amount
                break

        # Burn rate projection (linear extrapolation)
        q = Decimal("0.01")
        daily_rate = current_spend / days_elapsed
        projected_spend = (daily_rate * days_in_period).quantize(q, rounding=ROUND_HALF_UP)
        remaining = (budget.amount - current_spend).quantize(q, rounding=ROUND_HALF_UP)
        percentage_consumed = (
            (current_spend / budget.amount * 100).quantize(q, rounding=ROUND_HALF_UP)
            if budget.amount > 0
            else Decimal(0)
        )

        # Determine status
        if current_spend >= budget.amount:
            status = BudgetStatus.exceeded
        elif projected_spend > budget.amount:
            status = BudgetStatus.at_risk
        else:
            status = BudgetStatus.on_track

        # Top cost drivers — breakdown by service for the same period
        drivers = await self._get_top_cost_drivers(period_start, date.today())

        return BudgetDetailResponse(
            id=budget.id,
            workspace_id=budget.workspace_id,
            name=budget.name,
            amount=budget.amount,
            currency=budget.currency,
            period=budget.period,
            dimension=budget.dimension,
            dimension_value=budget.dimension_value,
            alert_thresholds=budget.alert_thresholds,
            created_at=budget.created_at,
            updated_at=budget.updated_at,
            current_spend=current_spend,
            percentage_consumed=percentage_consumed,
            projected_spend=projected_spend,
            remaining=remaining,
            status=status,
            days_elapsed=days_elapsed,
            days_in_period=days_in_period,
            top_cost_drivers=drivers,
        )

    async def evaluate_all_and_alert(self) -> int:
        """Evaluate all budgets and generate findings for threshold breaches.

        Returns the number of new findings created.
        """
        budgets, _ = await self._budget_repo.list_all(limit=1000)
        alerts_created = 0

        for budget in budgets:
            detail = await self.evaluate_budget(budget)
            alerts_created += await self._check_and_alert(budget, detail)

        return alerts_created

    # --- Alert generation ---

    async def _check_and_alert(self, budget: Budget, detail: BudgetDetailResponse) -> int:
        """Create findings when thresholds are crossed or projected overrun detected."""
        alerts_created = 0
        thresholds = sorted(budget.alert_thresholds, reverse=True)

        # Check threshold crossings
        for threshold in thresholds:
            if detail.percentage_consumed >= threshold:
                created = await self._create_threshold_finding(budget, detail, threshold)
                if created:
                    alerts_created += 1
                break  # only alert for the highest crossed threshold

        # Predictive alert: projected overrun
        if detail.status == BudgetStatus.at_risk and detail.current_spend < budget.amount:
            created = await self._create_projection_finding(budget, detail)
            if created:
                alerts_created += 1

        return alerts_created

    async def _create_threshold_finding(
        self, budget: Budget, detail: BudgetDetailResponse, threshold: int
    ) -> bool:
        severity = "high" if threshold >= 100 else ("medium" if threshold >= 80 else "low")
        drivers_text = self._format_drivers(detail.top_cost_drivers)

        _, created = await self._finding_repo.create_or_update(
            CreateFindingRequest(
                type="policy_violation",
                severity=severity,
                title=(
                    f"Budget '{budget.name}' "
                    f"{detail.percentage_consumed}% consumed "
                    f"({threshold}% threshold)"
                ),
                description=(
                    f"Budget: {budget.name}\n"
                    f"Amount: {budget.currency} {budget.amount}\n"
                    f"Current spend: {budget.currency} {detail.current_spend}\n"
                    f"Projected: {budget.currency} {detail.projected_spend}\n"
                    f"Period: {budget.period} "
                    f"({detail.days_elapsed}/{detail.days_in_period} days)\n"
                    f"Top cost drivers:\n{drivers_text}"
                ),
                resource_id=f"budget:{budget.id}:threshold",
                detection_source="budget_evaluation",
                suggested_action=f"Review spend for {budget.dimension}={budget.dimension_value}",
                estimated_cost_impact=max(detail.current_spend - budget.amount, Decimal(0)),
            )
        )
        if created:
            logger.info("Created threshold alert for budget '%s' at %d%%", budget.name, threshold)
        return created

    async def _create_projection_finding(
        self, budget: Budget, detail: BudgetDetailResponse
    ) -> bool:
        overage = detail.projected_spend - budget.amount
        drivers_text = self._format_drivers(detail.top_cost_drivers)

        _, created = await self._finding_repo.create_or_update(
            CreateFindingRequest(
                type="policy_violation",
                severity="high",
                title=f"Budget '{budget.name}' projected to exceed by {budget.currency} {overage}",
                description=(
                    f"Budget: {budget.name}\n"
                    f"Amount: {budget.currency} {budget.amount}\n"
                    f"Current spend: {budget.currency} {detail.current_spend}\n"
                    f"Projected: {budget.currency} {detail.projected_spend}\n"
                    f"Projected overage: {budget.currency} {overage}\n"
                    f"Period: {budget.period} "
                    f"({detail.days_elapsed}/{detail.days_in_period} days)\n"
                    f"Top cost drivers:\n{drivers_text}"
                ),
                resource_id=f"budget:{budget.id}:projection",
                detection_source="budget_evaluation",
                suggested_action=(
                    f"Review and reduce spend for {budget.dimension}={budget.dimension_value}"
                ),
                estimated_cost_impact=overage,
            )
        )
        if created:
            logger.info("Created projection alert for budget '%s'", budget.name)
        return created

    # --- Helpers ---

    async def _get_top_cost_drivers(self, start_date: date, end_date: date) -> list[CostDriverItem]:
        """Get top services by spend for the period."""
        cost_data = await self._cost_service.get_cost_by_dimension(
            dimension="service",
            start_date=start_date,
            end_date=end_date,
        )
        return [
            CostDriverItem(
                dimension_value=item.dimension_value,
                amount=item.amount,
                percentage=item.percentage,
            )
            for item in cost_data.data[:TOP_COST_DRIVERS]
        ]

    @staticmethod
    def _period_boundaries(period: str, today: date) -> tuple[date, date]:
        """Return (start, end) for the current budget period containing today."""
        if period == "monthly":
            start = today.replace(day=1)
            _, last_day = calendar.monthrange(today.year, today.month)
            end = today.replace(day=last_day) + timedelta(days=1)
        elif period == "quarterly":
            quarter_month = ((today.month - 1) // 3) * 3 + 1
            start = today.replace(month=quarter_month, day=1)
            end_month = quarter_month + 2
            _, last_day = calendar.monthrange(today.year, end_month)
            end = today.replace(month=end_month, day=last_day) + timedelta(days=1)
        else:
            raise ValueError(f"Unknown budget period: {period}")
        return start, end

    @staticmethod
    def _format_drivers(drivers: list[CostDriverItem]) -> str:
        if not drivers:
            return "  (no cost data)"
        lines = []
        for i, d in enumerate(drivers, 1):
            lines.append(f"  {i}. {d.dimension_value}: ${d.amount} ({d.percentage}%)")
        return "\n".join(lines)
