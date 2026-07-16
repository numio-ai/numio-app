---
status: done
kind: task
feature: tag_management
title: Register 5 MCP tag tools with risky-write enforcement
---

# Register 5 MCP tag tools with risky-write enforcement

## Problem statement

AI agents have no MCP surface for tag operations. Feature `tag_management` needs five tools that wrap existing services, with the same risky-write gate as the HTTP path. Spec §10.

## Scope

In scope (register in `backend/src/numio/mcp/server.py`):
- `list_tag_keys()` — all known keys with `source` (`numio`|`aws-org`) + required flag (joins `tag_policies.rules` and `aws_org_tag_policy`).
- `get_resource_tags(resource_arn)` — current tags from `cloud_resources.tags`, read-only.
- `apply_tags(resource_arn, tags, rationale?)` — single-resource apply wrapping `tag_write_service`. Enforces risky rule: if risky and `confirm_risky!=True` → `{status:'rejected', reason:'risky_write_not_confirmed', preview:{...}}`.
- `list_tag_conflicts()` — same as `GET /tags/schema/conflicts`.
- `get_tag_coverage()` — same as `/compliance/summary`.

Out of scope:
- Chat-driven bulk (routes through Campaign, not these tools — spec §13).

## Acceptance criteria

A1 (=feature A10). From an MCP client, all five tools return sensible structured responses. `apply_tags` on a risky target without `confirm_risky=True` returns the rejection object with a preview.
A2. `apply_tags` on a non-risky target writes the tag and returns the action-event result.

## Quality gates

- `cd backend && uv run pytest` green (tool wrappers + risky rejection).
- `cd backend && uv run ruff check .` clean.
- Manual: tools callable from a running MCP client.
- Depends on `tag_write_service`, `aws_org_tag_policy_sync`. Parallelizable with tasks 4–8 per spec §11.

## Summary

Steps completed (in order):
1. Registered five MCP tools in `backend/src/numio/mcp/server.py`, each a thin `@mcp.tool()` wrapper that opens `AsyncSessionLocal`, resolves the default workspace, and delegates to existing services/repositories:
   - `list_tag_keys()` — merges Numio active-policy rule tag names with `aws_org_tag_policy` rows; each key reports `source` (`numio`|`aws-org`|`both`) and `required` (a Numio rule ⇒ required).
   - `get_resource_tags(resource_arn)` — reads `cloud_resources.tags`; `found:false` for unknown ARNs.
   - `apply_tags(resource_arn, tags, rationale?, confirm_risky?)` — resolves the resource, runs `assess_risk`; if risky and not confirmed returns `{status:"rejected", reason:"risky_write_not_confirmed", preview:{...}}` without writing; otherwise writes via `tag_write_service.apply_tag_changes` (actor `"mcp"`).
   - `list_tag_conflicts()` — wraps `detect_schema_conflicts`.
   - `get_tag_coverage()` — mirrors `GET /compliance/summary` from the latest `overall` snapshot.
2. Tests in `tests/test_mcp.py`: registration assertion + a `TestMCPTagTools` class (patches `AsyncSessionLocal` to the test session, per the existing MCP test pattern). Covers key merge, resource-tag read/miss, risky rejection-with-preview, non-risky write, risky-confirmed write, unknown-resource rejection, conflicts, empty coverage, structured-data.
3. Docs: `docs/mcp-tools.md` documents all five tools (params + example responses).

Verification:
- Backend: 732 passed (10 new). ruff clean on `mcp/server.py` + `tests/test_mcp.py`.
- Live: restarted backend; MCP `tools/list` over `http://localhost:8000/mcp/` returns all five tools (`list_tag_keys`, `get_resource_tags`, `apply_tags`, `list_tag_conflicts`, `get_tag_coverage`) — callable from a real MCP client.

Notable decisions / deviations:
- **`apply_tags` uses `apply_tag_changes`, not `apply_single_tag`.** The MCP `tags` argument is a map, so one resource may carry several key changes in one call. `apply_single_tag` is itself a one-change wrapper around `apply_tag_changes`; calling the latter directly supports multi-key single-resource writes while staying single-resource (bulk still routes through a Campaign per spec §13). Risky-write enforcement is identical to the HTTP path (`tag_risk.assess_risk`).
- **Audit actor `"mcp"`.** MCP is stateless with no authenticated user; `"mcp"` honestly attributes the source (the audit `actor` column is free-text; spec §5.2 names "user email or 'system'", and `"mcp"` is a third honest source).
- **No new executors added to `chat/tools.py`.** Tools wrap services/repositories directly (spec §10 allows "existing executors or services"); `get_tag_coverage` inlines the small `/compliance/summary` snapshot computation rather than extracting a shared helper (YAGNI — one caller).

Changes made:
- `backend/src/numio/mcp/server.py` (5 tools + imports)
- `backend/tests/test_mcp.py` (registration test + `TestMCPTagTools`)
- `docs/mcp-tools.md` (five tool entries)
