"""Numio core services - shared business logic.

This module contains the business logic shared between REST API and MCP endpoints.
Currently returns placeholder data - actual implementation will connect to
cost data sources (AWS CUR, etc.).
"""

from __future__ import annotations

from datetime import date
from typing import Optional


class CostService:
    """Service for cloud cost operations.

    Provides methods for querying and analyzing cloud cost data.
    Placeholder implementation - actual data source integration pending.
    """

    def get_cost_summary(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> dict:
        """Get a summary of cloud costs.

        Args:
            start_date: Start date in YYYY-MM-DD format
            end_date: End date in YYYY-MM-DD format

        Returns:
            Dictionary with total cost, currency, and period information
        """
        # Placeholder implementation
        return {
            "total_cost": 12345.67,
            "currency": "USD",
            "period": {
                "start": start_date or str(date.today().replace(day=1)),
                "end": end_date or str(date.today()),
            },
            "change_percent": 5.2,
            "status": "placeholder",
        }

    def get_cost_by_service(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: int = 10,
    ) -> dict:
        """Get cloud costs grouped by service.

        Args:
            start_date: Start date in YYYY-MM-DD format
            end_date: End date in YYYY-MM-DD format
            limit: Maximum number of services to return

        Returns:
            Dictionary with services and their costs
        """
        # Placeholder implementation
        services = [
            {"service": "Amazon EC2", "cost": 4500.00, "percent": 36.5},
            {"service": "Amazon RDS", "cost": 2800.00, "percent": 22.7},
            {"service": "Amazon S3", "cost": 1500.00, "percent": 12.2},
            {"service": "AWS Lambda", "cost": 1200.00, "percent": 9.7},
            {"service": "Amazon CloudFront", "cost": 800.00, "percent": 6.5},
            {"service": "Amazon DynamoDB", "cost": 600.00, "percent": 4.9},
            {"service": "Amazon EKS", "cost": 500.00, "percent": 4.1},
            {"service": "AWS Fargate", "cost": 300.00, "percent": 2.4},
            {"service": "Amazon ElastiCache", "cost": 100.00, "percent": 0.8},
            {"service": "Other", "cost": 45.67, "percent": 0.4},
        ]

        return {
            "services": services[:limit],
            "total_cost": 12345.67,
            "currency": "USD",
            "period": {
                "start": start_date or str(date.today().replace(day=1)),
                "end": end_date or str(date.today()),
            },
            "status": "placeholder",
        }

    def get_cost_trends(
        self,
        period: str = "daily",
        limit: int = 30,
    ) -> dict:
        """Get cost trends over time.

        Args:
            period: Aggregation period (daily, weekly, monthly)
            limit: Number of periods to return

        Returns:
            Dictionary with trend data points
        """
        # Placeholder implementation - generate sample trend data
        from datetime import timedelta

        today = date.today()
        data_points = []

        for i in range(limit):
            if period == "daily":
                point_date = today - timedelta(days=limit - 1 - i)
            elif period == "weekly":
                point_date = today - timedelta(weeks=limit - 1 - i)
            else:  # monthly
                # Simplified monthly calculation
                point_date = today.replace(day=1)
                for _ in range(limit - 1 - i):
                    point_date = (point_date - timedelta(days=1)).replace(day=1)

            # Generate pseudo-random but consistent cost
            base_cost = 400.0
            variance = (hash(str(point_date)) % 200) - 100
            cost = base_cost + variance

            data_points.append(
                {
                    "date": str(point_date),
                    "cost": round(cost, 2),
                }
            )

        return {
            "period": period,
            "data_points": data_points,
            "currency": "USD",
            "status": "placeholder",
        }
