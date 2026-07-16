"""Rate limiting configuration using slowapi.

Rate limits are per-API-key for authenticated requests, or per-IP for
unauthenticated requests. Configurable via RATE_LIMIT_READ and
RATE_LIMIT_WRITE environment variables (requests per minute).

The global default applies the read limit (100/min) to all endpoints.
Write endpoints (POST/PUT/PATCH/DELETE) are further restricted via a
middleware that applies the write limit (20/min).
"""

import logging

from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request

from numio.core.config import settings

logger = logging.getLogger("numio.ratelimit")

_WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def _get_rate_limit_key(request: Request) -> str:
    """Extract rate limit key: API key hash > session user > client IP."""
    api_key = request.headers.get("x-api-key")
    if api_key:
        return f"apikey:{api_key[:16]}"

    session_cookie = request.cookies.get("numio_session")
    if session_cookie:
        return f"session:{session_cookie[:16]}"

    return get_remote_address(request)


limiter = Limiter(
    key_func=_get_rate_limit_key,
    default_limits=[f"{settings.rate_limit_read}/minute"],
)

# Rate limit strings for use in route decorators if needed
read_limit = f"{settings.rate_limit_read}/minute"
write_limit = f"{settings.rate_limit_write}/minute"
