---
status: done
phase: 2
task_id: P2.1
---

# AWS Account Registration and Connectivity Validation

## Problem Statement

Numio has no way to connect to customer AWS accounts. Before any cost data can be ingested, customers must be able to register their AWS accounts with Numio and verify that the required IAM permissions are in place. A typical customer operates 10-50+ AWS accounts, so multi-account support is a day-1 requirement.

## Scope

**In scope:**
- Register multiple AWS accounts, each with its own IAM role ARN for cross-account assume-role access
- Each registered account stores: AWS account ID, human-readable alias, IAM role ARN, status (active/inactive/error), environment label (e.g., production, staging, dev)
- Adding and removing accounts at any time
- At registration time, validate IAM role connectivity by performing an assume-role call
- Validate that the assumed role has the required permissions (Cost Explorer read, resource describe, S3 read for CUR)
- Surface specific permission gaps clearly (e.g., "Cost Explorer read access missing on account 123456789012")
- No long-lived AWS credentials stored — only IAM role ARNs; credentials are obtained at runtime via STS assume-role
- REST API endpoints for: register account, list accounts, get account details, update account metadata, remove account
- All account data is workspace-scoped

**Out of scope:**
- AWS Organization discovery (deferred from MVP per Q1)
- Cost data ingestion (separate task)
- Resource inventory sync (separate task)
- Frontend UI for account management (Phase 9 task)
- Bulk account import

## Acceptance Criteria

1. Register 3+ AWS accounts via API, each with a different IAM role ARN
2. Registration validates assume-role connectivity and returns success or a specific error describing what failed
3. One account failing registration does not affect other registered accounts
4. Permission validation identifies missing permissions and reports them clearly in the API response
5. Removing an account marks it inactive (soft delete) — it does not cascade-delete associated cost or resource data
6. List accounts API returns all registered accounts for the workspace with their current status
7. No AWS credentials (access keys, secret keys) are stored — only role ARNs

## Quality Gates

### Automated checks
- All tests pass: `cd backend && uv run pytest`
- Linting passes: `cd backend && uv run ruff check .`

### Functional validation (requires running backend + PostgreSQL)
Prerequisites: `docker compose up postgres -d && cd backend && uv run alembic upgrade head`

1. Start backend: `cd backend && uv run uvicorn numio.main:app --port 8000`
2. **Register an account** — returns 201 with account details and validation result:
   ```
   curl -s -X POST http://localhost:8000/api/v1/accounts \
     -H "Content-Type: application/json" \
     -d '{"aws_account_id":"123456789012","alias":"test-dev","role_arn":"arn:aws:iam::123456789012:role/NumioAccess","environment_label":"dev"}' | python3 -m json.tool
   ```
3. **List accounts** — returns the registered account(s):
   ```
   curl -s http://localhost:8000/api/v1/accounts | python3 -m json.tool
   ```
4. **Get account by ID** — returns single account (use id from step 2):
   ```
   curl -s http://localhost:8000/api/v1/accounts/{id} | python3 -m json.tool
   ```
5. **Update account metadata** — returns updated account:
   ```
   curl -s -X PUT http://localhost:8000/api/v1/accounts/{id} \
     -H "Content-Type: application/json" \
     -d '{"alias":"renamed-dev","environment_label":"staging"}' | python3 -m json.tool
   ```
6. **Soft delete** — returns account with status "inactive":
   ```
   curl -s -X DELETE http://localhost:8000/api/v1/accounts/{id} | python3 -m json.tool
   ```
7. **Verify soft delete** — deleted account still appears in list with status "inactive":
   ```
   curl -s http://localhost:8000/api/v1/accounts | python3 -m json.tool
   ```
8. **OpenAPI docs** — accounts endpoints visible at http://localhost:8000/docs
9. **No credentials stored** — verify the database contains only role_arn, no access keys:
   ```
   docker exec numio-postgres psql -U numio -c "SELECT aws_account_id, role_arn, status FROM aws_accounts;"
   ```
