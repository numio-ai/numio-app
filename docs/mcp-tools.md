# Numio MCP Tools

Numio exposes an [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server that allows AI agents and LLM-powered tools to query cloud cost data programmatically.

## Endpoint

| Environment | URL |
|-------------|-----|
| Local (Docker Compose) | `http://localhost:8000/mcp` |
| Local (dev server) | `http://localhost:8000/mcp` |
| Production | `https://<your-domain>/mcp` |

The MCP server uses Streamable HTTP transport. Connect using any MCP-compatible client (e.g., Claude Desktop, Claude Code, Cursor).

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_ALLOWED_HOSTS` | `localhost,127.0.0.1` | Comma-separated list of allowed MCP client hosts |

## Tools

### `get_cost_summary`

Get total cloud spend for a date range with daily breakdown.

**Parameters:**

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `start_date` | string | No | First of current month | Start date (YYYY-MM-DD) |
| `end_date` | string | No | Today | End date (YYYY-MM-DD) |

**Example Response:**

```json
{
  "total": 12450.00,
  "currency": "USD",
  "start_date": "2026-03-01",
  "end_date": "2026-03-28",
  "daily": [
    {"date": "2026-03-01", "cost": 445.00},
    {"date": "2026-03-02", "cost": 430.00}
  ]
}
```

---

### `get_cost_by_dimension`

Get cloud costs grouped by a business dimension (service, region, or custom attribution dimension).

**Parameters:**

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `dimension` | string | No | `"service"` | Dimension to group by: `service`, `region`, or a custom attribution dimension name |
| `start_date` | string | No | First of current month | Start date (YYYY-MM-DD) |
| `end_date` | string | No | Today | End date (YYYY-MM-DD) |

**Example Response:**

```json
{
  "dimension": "service",
  "start_date": "2026-03-01",
  "end_date": "2026-03-28",
  "data": [
    {"value": "Amazon EC2", "cost": 5200.00, "percentage": 41.8},
    {"value": "Amazon RDS", "cost": 3100.00, "percentage": 24.9},
    {"value": "Amazon S3", "cost": 1800.00, "percentage": 14.5}
  ]
}
```

---

### `list_findings`

List findings — anomalies, zombie resources, idle resources, and policy violations.

**Parameters:**

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `type` | string | No | All types | Filter: `anomaly`, `zombie`, `idle`, `policy_violation`, `tag_violation` |
| `severity` | string | No | All severities | Filter: `critical`, `high`, `medium`, `low`, `info` |
| `status` | string | No | `"open"` | Filter: `open`, `acknowledged`, `resolved`, `suppressed` |
| `limit` | integer | No | `20` | Maximum findings to return |

**Example Response:**

```json
{
  "findings": [
    {
      "id": "f-abc123",
      "type": "anomaly",
      "severity": "high",
      "status": "open",
      "title": "EC2 spend spike: +340% in us-east-1",
      "resource_id": "i-0abc123def456",
      "estimated_impact": 1200.00,
      "detected_at": "2026-03-27T14:30:00Z"
    }
  ],
  "count": 1
}
```

---

### `list_recommendations`

List optimization recommendations — right-sizing, zombie cleanup, and idle shutdown.

**Parameters:**

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `category` | string | No | All categories | Filter: `right_sizing`, `zombie_cleanup`, `idle_shutdown` |
| `status` | string | No | `"open"` | Filter: `open`, `accepted`, `implemented`, `dismissed` |
| `sort_by_savings` | boolean | No | `true` | Sort by estimated monthly savings (descending) |
| `limit` | integer | No | `20` | Maximum recommendations to return |

**Example Response:**

```json
{
  "recommendations": [
    {
      "id": "r-xyz789",
      "category": "right_sizing",
      "status": "open",
      "title": "Downsize i-0abc123 from m5.2xlarge to m5.xlarge",
      "resource_id": "i-0abc123def456",
      "estimated_monthly_savings": 180.00,
      "confidence": "high"
    }
  ],
  "count": 1
}
```

---

### `get_account_status`

List registered AWS accounts with their sync status.

**Parameters:** None

**Example Response:**

```json
{
  "accounts": [
    {
      "id": "acc-001",
      "aws_account_id": "123456789012",
      "name": "Production",
      "status": "active",
      "environment": "production",
      "last_sync": "2026-03-28T06:00:00Z"
    }
  ]
}
```

---

### `list_tag_keys`

List all known tag keys across Numio policies and the synced AWS Organizations tag policy.

**Parameters:** None

**Example Response:**

```json
{
  "keys": [
    {"tag_key": "cost-center", "source": "both", "required": true},
    {"tag_key": "env", "source": "numio", "required": true},
    {"tag_key": "DataClass", "source": "aws-org", "required": false}
  ],
  "count": 3
}
```

`source` is `numio`, `aws-org`, or `both`. A key with a Numio policy rule is always required.

---

### `get_resource_tags`

Get the current tags on a cloud resource from Numio's inventory (read-only).

**Parameters:**

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `resource_arn` | string | Yes | — | ARN of the resource to read tags for |

**Example Response:**

```json
{
  "resource_arn": "arn:aws:ec2:us-east-1:123456789012:instance/i-0abc123",
  "found": true,
  "tags": {"env": "production", "team": "payments"}
}
```

`found` is `false` (and `tags` is `{}`) when the ARN is not in inventory.

---

### `apply_tags`

Apply tag set/remove changes to a single AWS resource. A `null` value removes that key. Bulk tagging across many resources routes through a Campaign, not this tool.

**Parameters:**

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `resource_arn` | string | Yes | — | ARN of the resource to tag |
| `tags` | object | Yes | — | Map of tag key → value; `null` value removes the key |
| `rationale` | string | No | `null` | Free-text reason recorded in the audit |
| `confirm_risky` | boolean | No | `false` | Proceed past the risky-write gate (production resource or aggregate cost > $1000) |

**Example Response (success):**

```json
{"status": "success", "event_id": "e-abc123", "summary": {"item_count": 1, "success_count": 1, "failure_count": 0}}
```

**Example Response (risky write, not confirmed):**

```json
{
  "status": "rejected",
  "reason": "risky_write_not_confirmed",
  "preview": {
    "risky": true,
    "reasons": ["1 affected resource(s) are tagged as production"],
    "affected_resources": [
      {"resource_id": "...", "arn": "arn:aws:ec2:...:instance/i-0abc123", "name": "prod-1", "env": "production", "monthly_cost": 842.0}
    ]
  }
}
```

Resubmit with `confirm_risky: true` to proceed. Returns `{"status": "rejected", "reason": "resource_not_found"}` when the ARN is unknown.

---

### `list_tag_conflicts`

List schema conflicts between Numio tag policies and the synced AWS Organizations tag policy (read-only). Same data as `GET /tags/schema/conflicts`.

**Parameters:** None

**Example Response:**

```json
{
  "conflicts": [
    {"tag_key": "env", "conflict_type": "required_mismatch", "detail": "Numio enforces 'env' as required; AWS Org does not.", "numio_required": true, "aws_required": false}
  ],
  "count": 1
}
```

`conflict_type` is one of `required_mismatch`, `allowed_values_diff`, `case_sensitivity`, `missing_in_numio`.

---

### `get_tag_coverage`

Get overall tag-compliance coverage from the most recent audit. Same data as `GET /compliance/summary`.

**Parameters:** None

**Example Response:**

```json
{
  "cost_weighted_score": 73.4,
  "total_resources": 412,
  "compliant_resources": 290,
  "non_compliant_resources": 122,
  "total_cost": 18400.0,
  "compliant_cost": 13500.0,
  "untagged_spend": 4900.0
}
```

Returns `{"overall": null, "total_resources": 0, ...}` when no audit has run yet.

## Usage with Claude Desktop

Add this to your Claude Desktop MCP configuration (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "numio": {
      "url": "http://localhost:8000/mcp"
    }
  }
}
```

Then ask Claude questions like:
- "What's our total cloud spend this month?"
- "Show me the top services by cost"
- "Are there any critical findings?"
- "What optimization recommendations have the highest savings?"
