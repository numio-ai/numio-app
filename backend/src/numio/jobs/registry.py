"""Job registry — maps job type names to async callables and metadata."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Callable, Coroutine

logger = logging.getLogger("numio.jobs.registry")

# Job function signature: async def job(account_id: str) -> int
# Returns record count processed for that account.
JobFunc = Callable[[str], Coroutine[Any, Any, int]]


@dataclass
class JobDefinition:
    """Metadata and callable for a registered job."""

    job_type: str
    func: JobFunc
    description: str = ""
    interval_seconds: int | None = None


@dataclass
class JobRegistry:
    """Simple dict-based registry mapping job type strings to definitions."""

    _jobs: dict[str, JobDefinition] = field(default_factory=dict)

    def register(
        self,
        job_type: str,
        func: JobFunc,
        description: str = "",
        interval_seconds: int | None = None,
    ) -> None:
        """Register a job type with its async callable."""
        self._jobs[job_type] = JobDefinition(
            job_type=job_type,
            func=func,
            description=description,
            interval_seconds=interval_seconds,
        )
        logger.info("Registered job type: %s", job_type)

    def get(self, job_type: str) -> JobDefinition | None:
        """Get a job definition by type name."""
        return self._jobs.get(job_type)

    def list_types(self) -> list[JobDefinition]:
        """List all registered job definitions."""
        return list(self._jobs.values())


# Global registry instance
job_registry = JobRegistry()
