"""Structured logging with request correlation IDs.

In production (LOG_LEVEL != DEBUG), logs are emitted as single-line JSON for
easy ingestion by log aggregators. In local development, the default human-
readable format is preserved.
"""

import json
import logging
from contextvars import ContextVar
from datetime import datetime, timezone

# Context variable to hold the current request ID across async boundaries
request_id_ctx: ContextVar[str] = ContextVar("request_id", default="")


class JSONFormatter(logging.Formatter):
    """Emit log records as single-line JSON with correlation ID."""

    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": request_id_ctx.get(""),
        }
        if record.exc_info and record.exc_info[1]:
            log_entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_entry, default=str)


def configure_logging(log_level: str = "INFO", json_output: bool = True) -> None:
    """Set up application-wide logging.

    Args:
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR).
        json_output: If True, emit JSON logs. If False, use human-readable format.
    """
    level = getattr(logging, log_level.upper(), logging.INFO)
    root = logging.getLogger()
    root.setLevel(level)

    # Remove existing handlers to avoid duplicates
    for handler in root.handlers[:]:
        root.removeHandler(handler)

    handler = logging.StreamHandler()
    handler.setLevel(level)

    if json_output and log_level.upper() != "DEBUG":
        handler.setFormatter(JSONFormatter())
    else:
        handler.setFormatter(
            logging.Formatter(
                "%(asctime)s %(levelname)s %(name)s [%(request_id)s] %(message)s",
                defaults={"request_id": ""},
            )
        )

    root.addHandler(handler)

    # Quiet down noisy libraries
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("botocore").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)
