"""ValKey cache client for Cost Explorer pass-through responses.

ValKey is optional — if not configured or unavailable, all operations
are no-ops and the CE pass-through calls AWS directly on every request.
"""

import hashlib
import json
import logging

from numio.core.config import settings

logger = logging.getLogger(__name__)

_client = None
_initialized = False


def _get_client():
    """Lazily initialize the ValKey client. Returns None if unavailable."""
    global _client, _initialized
    if _initialized:
        return _client

    _initialized = True

    if not settings.valkey_url or not settings.ce_cache_enabled:
        logger.info(
            "ValKey cache disabled (url=%r, enabled=%s)",
            settings.valkey_url,
            settings.ce_cache_enabled,
        )
        return None

    try:
        import valkey

        _client = valkey.Valkey.from_url(settings.valkey_url, decode_responses=True)
        _client.ping()
        logger.info("ValKey cache connected: %s", settings.valkey_url)
    except Exception as e:
        logger.warning("ValKey cache unavailable, proceeding without cache: %s", e)
        _client = None

    return _client


def make_cache_key(workspace_id: str, account_id: str, endpoint: str, params: dict) -> str:
    """Build a deterministic cache key from request parameters."""
    params_sorted = json.dumps(params, sort_keys=True)
    params_hash = hashlib.sha256(params_sorted.encode()).hexdigest()[:16]
    return f"ce:{workspace_id}:{account_id}:{endpoint}:{params_hash}"


def cache_get(key: str) -> dict | None:
    """Get a cached response. Returns None on miss or if cache is unavailable."""
    client = _get_client()
    if client is None:
        return None

    try:
        value = client.get(key)
        if value is not None:
            return json.loads(value)
    except Exception as e:
        logger.warning("ValKey get failed for key %s: %s", key, e)

    return None


def cache_set(key: str, value: dict) -> None:
    """Store a response in cache with the configured TTL. No-op if cache is unavailable."""
    client = _get_client()
    if client is None:
        return

    try:
        client.setex(key, settings.ce_cache_ttl_seconds, json.dumps(value))
    except Exception as e:
        logger.warning("ValKey set failed for key %s: %s", key, e)


def reset():
    """Reset the client state. Used in tests."""
    global _client, _initialized
    _client = None
    _initialized = False
