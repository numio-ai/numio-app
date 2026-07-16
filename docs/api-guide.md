# Numio API Usage Guide

Numio exposes a REST API at `/api/v1/` for managing cloud cost data, findings, recommendations, budgets, and more. Interactive API documentation is available at `/docs` (Swagger UI) and `/redoc` (ReDoc) when the backend is running.

## Base URL

| Environment | URL |
|-------------|-----|
| Local (Docker Compose) | `http://localhost:8000/api/v1` |
| Local (dev server) | `http://localhost:8000/api/v1` |
| Production | `https://<your-domain>/api/v1` |

## Authentication

Numio supports three authentication methods. Every API request (except `/health` and `/api/v1/auth/*`) must include one.

### 1. Session Cookie (Web UI)

The web UI authenticates via Cognito OAuth and receives a `numio_session` cookie. This is handled automatically by the browser.

### 2. API Key

For programmatic access, create an API key in Settings > API Access Tokens, then pass it in the `X-API-Key` header:

```bash
curl -H "X-API-Key: $NUMIO_API_KEY" http://localhost:8000/api/v1/resources
```

### 3. Auth Bypass (Development Only)

When `AUTH_ENABLED=false`, all requests are treated as an admin user. Never use this in production.

## Common Patterns

### Pagination

All list endpoints support pagination via `limit` and `offset` query parameters:

```bash
# First 20 results
GET /api/v1/findings?limit=20&offset=0

# Next 20 results
GET /api/v1/findings?limit=20&offset=20
```

| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| `limit` | 100 | 1–1000 | Maximum results per page |
| `offset` | 0 | 0+ | Number of results to skip |

List responses include a `count` field with the total number of matching records.

### Filtering

Most list endpoints support query-parameter filters:

```bash
# Findings filtered by type and severity
GET /api/v1/findings?type=anomaly&severity=critical&status=open

# Recommendations sorted by savings
GET /api/v1/recommendations?category=right_sizing&sort_by_savings=true

# Cost data for a date range
GET /api/v1/cost-views/total?start_date=2026-01-01&end_date=2026-01-31
```

Refer to the interactive docs at `/docs` for the full list of filters per endpoint.

### Date Ranges

Cost and time-series endpoints accept `start_date` and `end_date` in `YYYY-MM-DD` format:

```bash
GET /api/v1/cost-views/time-series?start_date=2026-03-01&end_date=2026-03-28&granularity=daily
```

Granularity options: `daily` (default), `monthly`.

## Error Handling

All errors return JSON with a consistent structure:

```json
{
  "error_code": "VALIDATION_ERROR",
  "message": "Human-readable description",
  "request_id": "abc123def456",
  "details": [...]
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created (POST endpoints) |
| 400 | Validation error (check `details` for field-level errors) |
| 401 | Not authenticated |
| 403 | Insufficient permissions (role too low) |
| 404 | Resource not found |
| 429 | Rate limit exceeded |
| 500 | Internal server error |

### Correlation IDs

Every response includes an `X-Request-ID` header. Include this when reporting issues — it links to the server-side logs for that request.

## Rate Limiting

API requests are rate-limited per API key (or per session for web UI):

| Operation | Default Limit |
|-----------|--------------|
| Read (GET) | 100 requests/minute |
| Write (POST/PUT/PATCH/DELETE) | 20 requests/minute |

When rate-limited, the API returns `429 Too Many Requests` with a `Retry-After` header.

Limits are configurable via `RATE_LIMIT_READ` and `RATE_LIMIT_WRITE` environment variables.

## Key Endpoints

### Cost Data

| Method | Path | Description |
|--------|------|-------------|
| GET | `/cost-views/total` | Total cost for a date range |
| GET | `/cost-views/time-series` | Daily/monthly cost time series |
| GET | `/cost-views/by-dimension` | Costs grouped by service, team, etc. |
| GET | `/cost-explorer/cost-by-service` | AWS Cost Explorer pass-through |

### Findings & Recommendations

| Method | Path | Description |
|--------|------|-------------|
| GET | `/findings` | List findings (anomalies, zombies, idle, violations) |
| POST | `/findings/{id}/acknowledge` | Acknowledge a finding |
| POST | `/findings/{id}/resolve` | Resolve a finding |
| GET | `/recommendations` | List optimization recommendations |
| POST | `/recommendations/{id}/accept` | Accept a recommendation |
| POST | `/recommendations/{id}/implement` | Mark as implemented |

### Budgets & Governance

| Method | Path | Description |
|--------|------|-------------|
| GET | `/budgets` | List budgets with current status |
| POST | `/budgets` | Create a budget |
| GET | `/infra-policies` | List infrastructure policies |
| GET | `/audit-config-events` | Query the configuration audit trail (account/policy/threshold changes) |
| GET | `/audit-action-events` | Query the action audit trail (operations Numio ran against external systems) |
| GET | `/audit-action-events/{event_id}` | One action event with its child items |
| POST | `/tags/apply/preview` | Preview a tag write — returns `risky`, reasons, and affected resources with monthly cost |
| POST | `/tags/apply` | Apply tag set/remove changes to AWS resources (≤100/op; risky writes require `confirm_risky=true`) |
| GET | `/tags/schema/conflicts` | List schema conflicts between Numio tag policies and the synced AWS Organizations tag policy |
| GET | `/aws-org-tag-policy` | List the synced AWS Organizations tag policy rules for the workspace |
| POST | `/aws-org-tag-policy/sync` | Trigger an on-demand AWS Organizations tag policy sync (admin) |

### Resources & Accounts

| Method | Path | Description |
|--------|------|-------------|
| GET | `/resources` | List cloud resources |
| GET | `/accounts` | List registered AWS accounts |
| POST | `/accounts` | Register a new AWS account |

For the complete API reference, see the interactive docs at `/docs`.
