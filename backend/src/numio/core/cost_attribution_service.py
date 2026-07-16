"""Cost attribution and cost views service.

Computes attribution at query time by building dynamic SQL CASE expressions
from attribution rules. Provides cost views grouped by dimension, time-series,
trend analysis, and significant change detection.
"""

from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import case, func, literal, select
from sqlalchemy.ext.asyncio import AsyncSession

from numio.models.attribution_rule import AttributionRule
from numio.models.cost_record import CostRecord
from numio.schemas.attribution import (
    CostByDimensionResponse,
    CostTimeBucket,
    CostTimeSeriesResponse,
    CostViewMetadata,
    DimensionCostItem,
    DimensionTimeSeries,
    Granularity,
    SignificantChangeItem,
    SignificantChangesResponse,
    TotalCostResponse,
    TrendItem,
    TrendPeriod,
    TrendResponse,
)


class CostAttributionService:
    """Query-time cost attribution and cost views."""

    def __init__(self, session: AsyncSession, workspace_id: str) -> None:
        self._session = session
        self._workspace_id = workspace_id

    # --- Attribution rule expression builder ---

    def _build_dimension_expr(self, rules: list[AttributionRule]):
        """Build a SQL CASE expression that evaluates rules in priority order.

        For tag-based rules: checks if tags->>tag_key IS NOT NULL, returns the tag value.
        For account-based rules: checks if usage_account_id IN (...), returns dimension_value.
        Falls back to 'unallocated' if no rule matches.
        """
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

    async def _get_rules_for_dimension(self, dimension: str) -> list[AttributionRule]:
        result = await self._session.execute(
            select(AttributionRule)
            .where(
                AttributionRule.workspace_id == self._workspace_id,
                AttributionRule.dimension == dimension,
            )
            .order_by(AttributionRule.priority)
        )
        return list(result.scalars().all())

    def _base_query_filters(self, start_date: date, end_date: date, account: str | None = None):
        """Return common WHERE filters for cost queries."""
        filters = [
            CostRecord.workspace_id == self._workspace_id,
            func.date(CostRecord.usage_start) >= start_date,
            func.date(CostRecord.usage_start) < end_date,
        ]
        if account:
            filters.append(CostRecord.usage_account_id == account)
        return filters

    # --- Cost Views ---

    async def get_total_cost(
        self,
        start_date: date,
        end_date: date,
        account: str | None = None,
        granularity: Granularity = Granularity.daily,
    ) -> TotalCostResponse:
        """Total spend with time buckets."""
        filters = self._base_query_filters(start_date, end_date, account)
        date_trunc = self._date_trunc_expr(granularity)

        stmt = (
            select(
                date_trunc.label("bucket"),
                func.sum(CostRecord.unblended_cost).label("amount"),
            )
            .where(*filters)
            .group_by("bucket")
            .order_by("bucket")
        )
        result = await self._session.execute(stmt)
        rows = result.all()

        buckets = self._fill_time_buckets(rows, start_date, end_date, granularity)
        total = sum(b.amount for b in buckets)

        return TotalCostResponse(
            metadata=CostViewMetadata(start_date=start_date, end_date=end_date, account=account),
            total=total,
            data=buckets,
        )

    async def get_cost_by_dimension(
        self,
        dimension: str,
        start_date: date,
        end_date: date,
        account: str | None = None,
    ) -> CostByDimensionResponse:
        """Spend grouped by a business dimension."""
        rules = await self._get_rules_for_dimension(dimension)
        dim_expr = self._build_dimension_expr(rules)
        filters = self._base_query_filters(start_date, end_date, account)

        stmt = (
            select(
                dim_expr.label("dimension_value"),
                func.sum(CostRecord.unblended_cost).label("amount"),
            )
            .where(*filters)
            .group_by("dimension_value")
            .order_by(func.sum(CostRecord.unblended_cost).desc())
        )
        result = await self._session.execute(stmt)
        rows = result.all()

        total = sum(r.amount for r in rows) if rows else Decimal(0)
        data = [
            DimensionCostItem(
                dimension_value=r.dimension_value or "unallocated",
                amount=r.amount,
                percentage=round(r.amount / total * 100, 2) if total else Decimal(0),
            )
            for r in rows
        ]

        return CostByDimensionResponse(
            metadata=CostViewMetadata(
                start_date=start_date, end_date=end_date, account=account, dimension=dimension
            ),
            total=total,
            data=data,
        )

    async def get_cost_time_series(
        self,
        start_date: date,
        end_date: date,
        granularity: Granularity = Granularity.daily,
        dimension: str | None = None,
        account: str | None = None,
    ) -> CostTimeSeriesResponse:
        """Spend over time, optionally broken down by dimension."""
        filters = self._base_query_filters(start_date, end_date, account)
        date_trunc = self._date_trunc_expr(granularity)

        if dimension:
            rules = await self._get_rules_for_dimension(dimension)
            dim_expr = self._build_dimension_expr(rules)
            stmt = (
                select(
                    date_trunc.label("bucket"),
                    dim_expr.label("dimension_value"),
                    func.sum(CostRecord.unblended_cost).label("amount"),
                )
                .where(*filters)
                .group_by("bucket", "dimension_value")
                .order_by("bucket")
            )
            result = await self._session.execute(stmt)
            rows = result.all()

            # Build per-dimension time series
            dim_map: dict[str, list[CostTimeBucket]] = defaultdict(list)
            totals_map: dict[date, Decimal] = defaultdict(Decimal)
            for r in rows:
                bucket_date = r.bucket.date() if hasattr(r.bucket, "date") else r.bucket
                dv = r.dimension_value or "unallocated"
                dim_map[dv].append(
                    CostTimeBucket(
                        start=bucket_date,
                        end=self._bucket_end(bucket_date, granularity),
                        amount=r.amount,
                    )
                )
                totals_map[bucket_date] += r.amount

            # Aggregate time series
            agg_buckets = self._fill_time_buckets_from_map(
                totals_map, start_date, end_date, granularity
            )
            total = sum(b.amount for b in agg_buckets)

            by_dimension = [
                DimensionTimeSeries(dimension_value=dv, data=points)
                for dv, points in sorted(dim_map.items())
            ]
        else:
            stmt = (
                select(
                    date_trunc.label("bucket"),
                    func.sum(CostRecord.unblended_cost).label("amount"),
                )
                .where(*filters)
                .group_by("bucket")
                .order_by("bucket")
            )
            result = await self._session.execute(stmt)
            rows = result.all()
            agg_buckets = self._fill_time_buckets(rows, start_date, end_date, granularity)
            total = sum(b.amount for b in agg_buckets)
            by_dimension = None

        return CostTimeSeriesResponse(
            metadata=CostViewMetadata(
                start_date=start_date, end_date=end_date, account=account, dimension=dimension
            ),
            granularity=granularity.value,
            total=total,
            data=agg_buckets,
            by_dimension=by_dimension,
        )

    # --- Trend Analysis ---

    async def get_trends(
        self,
        dimension: str,
        period: TrendPeriod,
        end_date: date | None = None,
        account: str | None = None,
    ) -> TrendResponse:
        """Period-over-period trend analysis with partial-period handling."""
        if end_date is None:
            end_date = date.today()

        current_start, current_end, prev_start, prev_end = self._compute_trend_periods(
            period, end_date
        )

        rules = await self._get_rules_for_dimension(dimension)
        dim_expr = self._build_dimension_expr(rules)

        current_data = await self._query_dimension_totals(
            dim_expr, current_start, current_end, account
        )
        previous_data = await self._query_dimension_totals(dim_expr, prev_start, prev_end, account)

        all_dims = set(current_data.keys()) | set(previous_data.keys())
        items = []
        for dv in sorted(all_dims):
            cur = current_data.get(dv, Decimal(0))
            prev = previous_data.get(dv, Decimal(0))
            abs_change = cur - prev
            pct_change = round(abs_change / prev * 100, 2) if prev != 0 else None
            items.append(
                TrendItem(
                    dimension_value=dv,
                    current_amount=cur,
                    previous_amount=prev,
                    absolute_change=abs_change,
                    percentage_change=pct_change,
                )
            )

        return TrendResponse(
            metadata=CostViewMetadata(
                start_date=current_start, end_date=current_end, account=account, dimension=dimension
            ),
            period=period.value,
            current_period_start=current_start,
            current_period_end=current_end,
            previous_period_start=prev_start,
            previous_period_end=prev_end,
            data=items,
        )

    async def get_significant_changes(
        self,
        dimension: str,
        period: TrendPeriod,
        end_date: date | None = None,
        account: str | None = None,
        percentage_threshold: Decimal = Decimal("20"),
        absolute_threshold: Decimal = Decimal("100"),
    ) -> SignificantChangesResponse:
        """Identify dimensions with cost changes exceeding thresholds."""
        trend = await self.get_trends(dimension, period, end_date, account)

        significant = []
        for item in trend.data:
            if item.percentage_change is None:
                continue
            if (
                abs(item.percentage_change) >= percentage_threshold
                and abs(item.absolute_change) >= absolute_threshold
            ):
                significant.append(
                    SignificantChangeItem(
                        dimension_value=item.dimension_value,
                        current_amount=item.current_amount,
                        previous_amount=item.previous_amount,
                        absolute_change=item.absolute_change,
                        percentage_change=item.percentage_change,
                    )
                )

        significant.sort(key=lambda x: abs(x.absolute_change), reverse=True)

        return SignificantChangesResponse(
            metadata=trend.metadata,
            period=trend.period,
            percentage_threshold=percentage_threshold,
            absolute_threshold=absolute_threshold,
            data=significant,
        )

    # --- Internal helpers ---

    async def _query_dimension_totals(
        self, dim_expr, start_date: date, end_date: date, account: str | None
    ) -> dict[str, Decimal]:
        filters = self._base_query_filters(start_date, end_date, account)
        stmt = (
            select(
                dim_expr.label("dimension_value"),
                func.sum(CostRecord.unblended_cost).label("amount"),
            )
            .where(*filters)
            .group_by("dimension_value")
        )
        result = await self._session.execute(stmt)
        return {r.dimension_value or "unallocated": r.amount for r in result.all()}

    def _date_trunc_expr(self, granularity: Granularity):
        """Return a SQL date_trunc expression for the given granularity."""
        trunc_map = {
            Granularity.daily: "day",
            Granularity.weekly: "week",
            Granularity.monthly: "month",
        }
        return func.date_trunc(trunc_map[granularity], CostRecord.usage_start)

    def _fill_time_buckets(
        self, rows, start_date: date, end_date: date, granularity: Granularity
    ) -> list[CostTimeBucket]:
        """Fill in zero-value buckets for time periods with no data."""
        data_map: dict[date, Decimal] = {}
        for r in rows:
            bucket_date = r.bucket.date() if hasattr(r.bucket, "date") else r.bucket
            data_map[bucket_date] = r.amount
        return self._fill_time_buckets_from_map(data_map, start_date, end_date, granularity)

    def _fill_time_buckets_from_map(
        self,
        data_map: dict[date, Decimal],
        start_date: date,
        end_date: date,
        granularity: Granularity,
    ) -> list[CostTimeBucket]:
        """Generate all expected time buckets, filling missing ones with zero."""
        buckets = []
        current = self._truncate_date(start_date, granularity)
        while current < end_date:
            bucket_end = self._bucket_end(current, granularity)
            buckets.append(
                CostTimeBucket(
                    start=current,
                    end=min(bucket_end, end_date),
                    amount=data_map.get(current, Decimal(0)),
                )
            )
            current = bucket_end
        return buckets

    def _truncate_date(self, d: date, granularity: Granularity) -> date:
        if granularity == Granularity.daily:
            return d
        elif granularity == Granularity.weekly:
            return d - timedelta(days=d.weekday())  # Monday
        elif granularity == Granularity.monthly:
            return d.replace(day=1)
        return d

    def _bucket_end(self, bucket_start: date, granularity: Granularity) -> date:
        if granularity == Granularity.daily:
            return bucket_start + timedelta(days=1)
        elif granularity == Granularity.weekly:
            return bucket_start + timedelta(weeks=1)
        elif granularity == Granularity.monthly:
            if bucket_start.month == 12:
                return bucket_start.replace(year=bucket_start.year + 1, month=1)
            return bucket_start.replace(month=bucket_start.month + 1)
        return bucket_start + timedelta(days=1)

    def _compute_trend_periods(
        self, period: TrendPeriod, end_date: date
    ) -> tuple[date, date, date, date]:
        """Compute current and previous period boundaries with partial-period handling.

        For partial periods: compare first N days of current period against
        first N days of previous period.
        """
        if period == TrendPeriod.day:
            current_start = end_date - timedelta(days=1)
            current_end = end_date
            prev_start = current_start - timedelta(days=1)
            prev_end = current_start
        elif period == TrendPeriod.week:
            # ISO 8601: week starts on Monday
            current_week_start = end_date - timedelta(days=end_date.weekday())
            days_into_week = (end_date - current_week_start).days
            current_start = current_week_start
            current_end = end_date
            prev_week_start = current_week_start - timedelta(weeks=1)
            prev_start = prev_week_start
            prev_end = prev_week_start + timedelta(days=days_into_week)
        elif period == TrendPeriod.month:
            current_month_start = end_date.replace(day=1)
            days_into_month = (end_date - current_month_start).days
            current_start = current_month_start
            current_end = end_date
            # Previous month
            if current_month_start.month == 1:
                prev_month_start = current_month_start.replace(
                    year=current_month_start.year - 1, month=12
                )
            else:
                prev_month_start = current_month_start.replace(month=current_month_start.month - 1)
            prev_start = prev_month_start
            prev_end = prev_month_start + timedelta(days=days_into_month)
        else:
            raise ValueError(f"Unknown period: {period}")

        return current_start, current_end, prev_start, prev_end
