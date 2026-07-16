---

## Date: 2026-03-16
Status: Done
Inputs:
  - "Numio vision" (2026-03-04)
  - "Architecture & Design" (2026-03-16)

# Numio Implementation Plan

## Problem Statement

Numio is a FinOps agent for enterprise cloud cost monitoring, attribution, and optimization. The current codebase contains a dummy frontend prototype (visual reference only) and an outdated backend stub. A complete implementation is needed — from data ingestion to actionable cost insights — so that customers can connect their AWS accounts and immediately get value: cost visibility, anomaly detection, governance, and optimization recommendations.

## Objective

Deliver a functional MVP that supports AWS-only cost management. A customer should be able to: register an AWS account, see consolidated cost data with attribution, receive anomaly and budget alerts, review policy violations, and act on optimization recommendations via suggested AWS CLI commands — all through a polished web UI and an MCP interface for AI agent integration.

## Scope

**In scope (MVP):** AWS cost management — Cost Explorer API, CUR ingestion, resource inventory, cost attribution, anomaly detection, zombie hunter, budgets, policies, recommendations, notifications (dashboard), analytics chat, MCP server.

**Out of scope (MVP):** GCP, Azure, AI provider billing (OpenAI/Anthropic), autonomous action execution, multi-tenant SaaS mode, Terraform remediation output, external ticketing integrations.

## Constraints

- Single-tenant deployment (one instance per customer), but data model must include workspace scoping for future multi-tenancy
- No autonomous execution in MVP — detect and recommend only
- Remediation output is AWS CLI commands only
- Chat is analytics-only (query cost data, not trigger actions)

---

## Phase 1: Foundation

### Problem

The current backend is an outdated stub that does not match the target architecture. There is no database, no migration framework, and no structured project layout for the real application. The foundation must be laid before any feature work begins.

### Requirements


| ID    | Requirement                      | Specification                                                                                                                                                                     |
| ----- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1.1  | **Database setup**               | PostgreSQL running in Docker for local dev. Alembic configured for schema migrations. Initial migration creates base tables (workspaces, users).                                  |
| F1.2  | **Backend project restructure**  | Reorganize `backend/src/numio/` to match the target structure from architecture doc: `core/`, `models/`, `schemas/`, `jobs/`, with `api/` and `mcp/` as thin layers over `core/`. |
| F1.3  | **Workspace scoping**            | All core tables include a `workspace_id` column. Data access layer scopes queries by workspace. A single default workspace is created at initialization.                          |
| F1.4  | **Configuration management**     | Pydantic Settings for application config. Environment-specific settings loaded from `.env` files. Secrets (DB credentials, AWS role ARNs) never committed.                        |
| F1.5  | **API scaffolding**              | REST API under `/api/v1/` with consistent JSON response format via Pydantic schemas. Health endpoint at `/health`. OpenAPI docs auto-generated.                                   |
| F1.6  | **Error handling**               | Global exception handlers for API. Structured error responses with error codes, messages, and request IDs.                                                                        |
| F1.7  | **Logging**                      | Structured JSON logging with correlation IDs. Log levels configurable per environment.                                                                                            |
| F1.8  | **Testing infrastructure**       | pytest configured with async support. Test database setup/teardown. Factory fixtures for common models. CI pipeline runs tests on every push.                                     |
| F1.9  | **Backend dependency additions** | Add SQLAlchemy, Alembic, psycopg (async), APScheduler, boto3 to project dependencies.                                                                                             |
| F1.10 | **Docker Compose update**        | Add PostgreSQL service to `docker-compose.yml`. Update `numio-api` and add `numio-worker` service.                                                                                |


### Acceptance Criteria

- Backend starts, connects to PostgreSQL, and responds to `/health` and `/api/v1/` endpoints
- Alembic migration creates initial schema with workspace scoping
- `pytest` suite runs with at least one integration test against the test database
- Docker Compose brings up all four services (ui, api, worker, postgres)

---

## Phase 2: AWS Integration & Data Ingestion

### Problem

Numio has no connection to customer AWS accounts and no mechanism to pull billing or resource data. Without ingestion, no downstream feature (attribution, monitoring, optimization) can function. The typical Numio customer operates multiple AWS accounts (dev, staging, production, shared services, per-team accounts) — often 10–50+ accounts under an AWS Organization. Multi-account support is a day-1 requirement, not a follow-on.

### Requirements


| ID    | Requirement                             | Specification                                                                                                                                                                                                                                                                                                                |
| ----- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I2.1  | **Multi-account registration**          | Register multiple AWS accounts, each with its own IAM role ARN for cross-account assume-role. Each account has independent metadata (account ID, alias, role ARN, status, environment label). Support adding and removing accounts at any time. No long-lived AWS credentials stored.                                        |
| I2.2  | **AWS Organization discovery**          | Optionally discover all accounts in an AWS Organization via the Organizations API. Present discovered accounts for selective registration. This accelerates onboarding for customers with many accounts.                                                                                                                     |
| I2.3  | **Per-account connectivity validation** | Validate IAM role connectivity and required permissions per account at registration time. Surface permission gaps clearly (e.g., "Cost Explorer read access missing on account 123456789012").                                                                                                                               |
| I2.4  | **Cost Explorer ingestion**             | Pull daily cost data via AWS Cost Explorer API per registered account: by service, account, region, and tag dimensions. Store normalized cost records with date, dimension, account, and amount. Handle API pagination and rate limiting. Accounts are ingested independently — one account's failure does not block others. |
| I2.5  | **CUR ingestion**                       | Parse Cost & Usage Report files from customer-configured S3 export. CUR may cover a single account or a consolidated billing account spanning multiple linked accounts. Ingest resource-level line items with account attribution. Handle incremental updates.                                                               |
| I2.6  | **Consolidated cost views**             | Cost data from all registered accounts feeds into a single unified model. Consumers can query costs across all accounts (consolidated), by individual account, or by account groups.                                                                                                                                         |
| I2.7  | **Common data source interface**        | Both Cost Explorer and CUR data feed into a common cost data model. Consumers (API, worker, MCP) query cost data without knowing the source. Interface designed to accommodate future GCP and AI provider sources.                                                                                                           |
| I2.8  | **Resource inventory sync**             | Pull resource metadata from AWS service APIs per registered account: EC2 instances, RDS instances, S3 buckets, EBS volumes, Elastic IPs, Lambda functions. Store resource metadata with tags, state, creation date, account ID, and associated costs.                                                                        |
| I2.9  | **Background worker**                   | Worker service runs as a separate process using APScheduler. Jobs are plain async functions callable by scheduler, API, or future cloud triggers.                                                                                                                                                                            |
| I2.10 | **Scheduled jobs**                      | Daily billing sync (Cost Explorer and/or CUR) across all registered accounts. Daily resource inventory sync across all registered accounts. Jobs are idempotent and handle partial failures per-account gracefully (one failing account does not block the rest).                                                            |
| I2.11 | **Ingestion status tracking**           | Track last sync time, success/failure, and record counts per data source per account. Surface ingestion health per account in the API. Alert when an account has not synced successfully within expected window.                                                                                                             |


### Acceptance Criteria

- Register 3+ AWS accounts and verify assume-role connectivity for each independently
- One account failing registration does not affect others
- Cost Explorer sync pulls at least 90 days of daily cost data per account on first run and stores it with correct account attribution
- Consolidated cost query returns aggregated data across all accounts; per-account query returns only that account's data
- CUR sync ingests a sample CUR export covering multiple linked accounts, with correct per-account attribution
- Resource inventory sync discovers and stores resources from at least 3 AWS services across multiple accounts
- Worker ingestion failure for one account logs the error and continues with remaining accounts
- Ingestion status API shows per-account sync time, status, and record counts

### Dependencies

- Phase 1 (database, project structure, worker service)

---

## Phase 3: Tag Governance, Cost Attribution & Reporting

### Problem

Raw cost data is not useful until it can be attributed to teams, projects, and environments — and attribution is only as good as the tagging underneath it. Most organizations have 30–60% of resources untagged or mistagged, making cost reports unreliable and accountability impossible. Numio's key differentiator is treating tag governance as a first-class, day-1 capability: customers start by defining tagging policies, then Numio audits the entire estate, quantifies the gap by cost impact, and drives remediation campaigns that systematically close the gap. This is where Numio pulls ahead of tools like Vantage, which treat tagging as a passive report rather than an active workflow.

### Requirements — Tag Governance (first-class capability)


| ID    | Requirement                            | Specification                                                                                                                                                                                                                                                                                                                   |
| ----- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T3.1  | **Tag policy definition**              | Define tag policies in the Numio UI. For each required tag: name, type (string, enum, email, date), allowed values (for enum), default value (optional), and applicability rules — which resource types and which accounts/environments the tag applies to. Multiple policies can coexist (e.g., company-wide + team-specific). |
| T3.2  | **Tag policy versioning**              | Track policy changes over time. Show when a policy was created, modified, and by whom. Allow comparing compliance before/after a policy change.                                                                                                                                                                                 |
| T3.3  | **Tag compliance audit**               | Evaluate all resources across all registered accounts against active tag policies. Run on every resource inventory sync (daily minimum). Produce per-resource compliance status: compliant, missing tag, invalid value, and which policy is violated.                                                                           |
| T3.4  | **Cost-weighted compliance scoring**   | Compliance score is weighted by cost, not just resource count. A $5,000/month untagged instance matters more than a $2/month S3 bucket. Overall compliance metric: "X% of spend is properly attributed." Report compliance by tag, by account, by resource type, and by team/owner.                                             |
| T3.5  | **Tag gap analysis**                   | Show the full picture: total resources, compliant count, non-compliant count, untagged spend ($ amount), and compliance trend over time. Identify which specific tags have the worst compliance. Rank non-compliant resources by cost impact.                                                                                   |
| T3.6  | **Tag remediation campaigns**          | Create remediation campaigns targeting a set of non-compliant resources. Campaign tracks: target resources, likely owner (inferred from account, existing tags, or resource creator), remediation status per resource (pending, notified, fixed, escalated).                                                                    |
| T3.7  | **Owner inference**                    | Infer likely resource owners from existing metadata: account ownership, creator tags (aws:createdBy), related resource tags, naming conventions. Surface inferred owner to help route remediation to the right person.                                                                                                          |
| T3.8  | **Self-service tag fixing**            | Provide AWS CLI commands to apply missing tags to specific resources. In future phases: direct tag writing via AWS API (with approval). MVP outputs commands for operators to review and apply.                                                                                                                                 |
| T3.9  | **Remediation tracking**               | Track compliance improvement over time per campaign. Show before/after compliance metrics. Campaigns have a target (e.g., "reach 90% compliance within 30 days") and progress toward it.                                                                                                                                        |
| T3.10 | **Frontend: Tag governance dashboard** | Dedicated tag governance page — not buried in settings. Shows: overall cost-weighted compliance %, compliance by tag, compliance by account, compliance trend chart, top non-compliant resources ranked by cost, and active campaigns with progress.                                                                            |
| T3.11 | **Frontend: Tag policy editor**        | Create and edit tag policies. Visual editor for applicability rules (which resource types, which accounts). Preview which resources would be affected before activating.                                                                                                                                                        |
| T3.12 | **Frontend: Campaign management**      | Create campaigns from non-compliant resource sets. View campaign progress. See per-resource status. Copy remediation CLI commands.                                                                                                                                                                                              |


### Requirements — Cost Attribution & Reporting


| ID    | Requirement                      | Specification                                                                                                                                                                                                                                                          |
| ----- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A3.13 | **Attribution dimensions**       | Support configurable attribution dimensions: team, project, environment, application, service, account, region. Dimensions map to AWS tags or account-level metadata.                                                                                                  |
| A3.14 | **Attribution rules**            | Define rules that map resources to dimensions based on tags, account, or naming conventions. Handle unattributed costs (no matching tags) as a visible "unallocated" category. Unallocated spend links directly to tag governance for remediation.                     |
| A3.15 | **Cost views API**               | API endpoints for cost data: total spend, spend by dimension, spend over time (daily/weekly/monthly), with filtering and date range parameters. All views support filtering by account or account group.                                                               |
| A3.16 | **Trend analysis**               | Calculate period-over-period changes (day-over-day, week-over-week, month-over-month). Identify dimensions with significant cost increases or decreases.                                                                                                               |
| A3.17 | **Frontend: Overview dashboard** | Replace prototype Overview page with real data. Show total spend, spend trend, top cost drivers, cost by top dimensions, tag compliance summary (cost-weighted %), anomaly summary, and action items count. Tag compliance is a prominent metric, not an afterthought. |
| A3.18 | **Frontend: Cloud Usage page**   | Replace prototype with real cost breakdown. Time-series chart of spend. Drill-down by dimension. Date range selector. Export capability.                                                                                                                               |
| A3.19 | **Frontend: Cost reports**       | Cost report builder: select dimensions, filters, date range, grouping. Save and share reports. Scheduled report generation.                                                                                                                                            |


### Acceptance Criteria

- Define a tag policy requiring "team" and "environment" tags on EC2 and RDS resources
- Tag compliance audit correctly identifies all non-compliant resources across multiple accounts
- Compliance score is cost-weighted: a $1,000/month untagged instance contributes more to non-compliance than a $1/month resource
- Tag gap analysis shows untagged spend in dollar terms, not just resource count
- Create a remediation campaign, and it tracks per-resource progress from pending through fixed
- Self-service tag fix outputs valid AWS CLI tag commands for specific non-compliant resources
- Tag governance dashboard is accessible from primary navigation as a top-level page
- Compliance trend chart shows improvement over time after tags are applied
- Cost data is attributable by at least 3 dimensions (team, project, environment)
- Overview dashboard shows tag compliance % as a prominent metric alongside total spend
- Unattributed costs link to tag governance for remediation, not just displayed as a dead-end category

### Dependencies

- Phase 2 (ingested resource data with tags, multi-account support)

---

## Phase 4: Monitoring & Detection

### Problem

Cost issues often go unnoticed until the monthly bill arrives. Customers need automated detection of anomalies, idle resources, and policy violations — surfaced as actionable findings, not raw data.

### Requirements


| ID    | Requirement                         | Specification                                                                                                                                                                                               |
| ----- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M4.1  | **Anomaly detection**               | Compute cost baselines per dimension (moving averages, standard deviations). Detect spending spikes and drift that exceed configurable thresholds. Run as a scheduled background job.                       |
| M4.2  | **Anomaly context**                 | Each anomaly includes: what changed, magnitude ($ and %), affected dimension, likely cause (new resource, usage spike, pricing change), and time of detection.                                              |
| M4.3  | **Zombie Hunter**                   | Identify orphaned resources: unattached EBS volumes, unused Elastic IPs, stopped instances running longer than threshold, snapshots older than threshold, load balancers with no targets.                   |
| M4.4  | **Idle resource detection**         | Identify underutilized compute using CloudWatch metrics: CPU utilization, network I/O, disk I/O below thresholds over configurable time windows. Informational only in MVP.                                 |
| M4.5  | **Findings management**             | Findings lifecycle: open → acknowledged → resolved / suppressed. Each finding has a type, severity, affected resources, estimated cost impact, and suggested action. Findings are deduplicated across runs. |
| M4.6  | **Findings API**                    | API endpoints for listing, filtering, acknowledging, resolving, and suppressing findings. Bulk operations supported.                                                                                        |
| M4.7  | **Frontend: Feed page**             | Real-time feed of findings, anomalies, and alerts. Filterable by type, severity, dimension. Each item is expandable for details and suggested action.                                                       |
| M4.8  | **Frontend: Anomaly investigation** | Anomaly detail page showing cost chart with anomaly highlighted, affected resources, probable cause, and suggested remediation.                                                                             |
| M4.9  | **Frontend: Zombie Hunter page**    | List of detected zombie resources grouped by type. Show estimated waste per resource. Suggested cleanup action (AWS CLI command) per resource.                                                              |
| M4.10 | **Frontend: Resources page**        | Inventory of all discovered resources with tags, state, cost, and compliance status. Filterable and searchable.                                                                                             |


### Acceptance Criteria

- Anomaly detection identifies at least a 2x daily cost spike in test data and creates a finding
- Zombie Hunter detects at least 3 types of orphaned resources (unattached EBS, unused EIP, stopped instances)
- Findings lifecycle works end-to-end: open → acknowledged → resolved
- Feed page shows findings sorted by recency with correct severity indicators
- Zombie Hunter page displays estimated monthly waste per resource

### Dependencies

- Phase 2 (ingested data), Phase 3 (attribution for dimensional anomaly context)

---

## Phase 5: Governance — Budgets & Policies

### Problem

Without budgets and policies, cost governance is reactive. Teams need to set spend limits, define infrastructure policies, and be alerted before — not after — violations occur.

### Requirements


| ID   | Requirement                 | Specification                                                                                                                                                                                                                                                                                           |
| ---- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G5.1 | **Budget management**       | Create budgets scoped to dimensions (team, project, account, service). Budget has a name, amount, period (monthly/quarterly), and alert thresholds (e.g. 50%, 80%, 100%).                                                                                                                               |
| G5.2 | **Budget tracking**         | Continuously evaluate spend against budgets. Calculate burn rate and project end-of-period spend. Detect when projected spend will exceed budget before the period ends.                                                                                                                                |
| G5.3 | **Budget alerts**           | Generate alerts when spend crosses threshold percentages or when projected spend exceeds budget. Alert includes: budget name, current spend, projected spend, affected dimension, and top cost drivers.                                                                                                 |
| G5.4 | **Policy engine**           | Define policies as rules evaluated against resources and costs. Policy types: instance type restrictions, spending limits, resource count limits, environment constraints. (Tag policy is handled by the Phase 3 tag governance engine; the policy engine here covers non-tag infrastructure policies.) |
| G5.5 | **Policy evaluation**       | Scheduled evaluation of all resources against active policies. Generate violations as findings. Track compliance percentage per policy.                                                                                                                                                                 |
| G5.6 | **Policy guardrails**       | Guardrail policies evaluated on every resource inventory sync. Immediate violation detection for critical policies (e.g., unapproved instance types in production).                                                                                                                                     |
| G5.7 | **Frontend: Budgets page**  | List all budgets with status (on track / at risk / exceeded). Create/edit budget form with dimension selector, amount, period, and thresholds. Budget detail view with spend-vs-budget chart.                                                                                                           |
| G5.8 | **Frontend: Policies page** | List all infrastructure policies with compliance status. Create/edit policy form. Policy detail view showing all current violations. Links to Phase 3 tag governance for tag-specific policies.                                                                                                         |


### Acceptance Criteria

- Create a budget for a team dimension, and receive an alert when simulated spend crosses 80% threshold
- Burn rate projection correctly predicts budget overrun at least 5 days before period end in test scenario
- Infrastructure policy violation is generated when a resource uses an unapproved instance type
- Budgets page shows correct status indicators (on track / at risk / exceeded)
- Policy compliance percentage updates after each evaluation run

### Dependencies

- Phase 3 (attribution dimensions, tag governance engine)

---

## Phase 6: Optimization & Recommendations

### Problem

Detecting issues is only half the value. Customers need concrete, prioritized recommendations with estimated savings and actionable remediation commands they can review and apply.

### Requirements


| ID   | Requirement                        | Specification                                                                                                                                                                       |
| ---- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| O6.1 | **Recommendations engine**         | Generate savings recommendations from findings, anomalies, and resource analysis. Types: right-sizing, zombie cleanup, reserved instance opportunities, idle resource shutdown.     |
| O6.2 | **Recommendation prioritization**  | Rank recommendations by estimated monthly savings. Group by category and affected dimension. Show confidence level (high/medium/low).                                               |
| O6.3 | **Remediation commands**           | Each recommendation includes one or more AWS CLI commands that implement the fix. Commands are generated but never auto-executed in MVP.                                            |
| O6.4 | **Recommendation lifecycle**       | States: open → accepted → implemented → dismissed. Track implementation status. When a recommendation is implemented, measure actual savings vs estimated.                          |
| O6.5 | **Savings tracking**               | Track cumulative savings over time from implemented recommendations. Show savings by category and dimension. Compare actual vs estimated savings.                                   |
| O6.6 | **Right-sizing analysis**          | Analyze compute instance utilization metrics. Suggest downsizing for consistently underutilized instances. Show projected savings from each right-sizing action.                    |
| O6.7 | **Frontend: Recommendations page** | List of recommendations sortable by savings, priority, category. Detail view with explanation, affected resources, estimated savings, and AWS CLI commands. Accept/dismiss actions. |
| O6.8 | **Frontend: Savings timeline**     | Chart showing cumulative savings over time. Breakdown by recommendation category. Actual vs projected comparison.                                                                   |


### Acceptance Criteria

- At least 3 recommendation types are generated from test data (right-sizing, zombie cleanup, idle shutdown)
- Each recommendation includes syntactically valid AWS CLI commands
- Savings tracking shows cumulative savings after recommendations are marked as implemented
- Recommendations page correctly sorts by estimated savings
- Accepting a recommendation moves it to "accepted" state; dismissing it removes it from the active list

### Dependencies

- Phase 4 (findings, zombie hunter, anomaly data)

---

## Phase 7: Chat & MCP

### Problem

Operators and AI agents need to query cost data and ask questions without navigating the full UI. A natural-language chat interface and an MCP server enable both human operators and external AI agents to interact with Numio programmatically.

### Requirements


| ID   | Requirement                 | Specification                                                                                                                                                                                                                   |
| ---- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C7.1 | **Analytics chat backend**  | Natural language interface for querying cost data. Support questions like: "What did team X spend last month?", "Why did costs increase?", "Show top 5 cost drivers". Chat is read-only — no actions triggered via chat in MVP. |
| C7.2 | **Chat context**            | Chat queries are scoped to the customer's data. Responses include relevant data (numbers, breakdowns) and can reference specific findings or recommendations.                                                                   |
| C7.3 | **Chat session management** | Maintain conversation history within a session. Support starting new sessions. Sessions are workspace-scoped.                                                                                                                   |
| C7.4 | **MCP server**              | MCP server exposed at `/mcp` (streamable HTTP) and `/mcp/sse` (SSE transport). Provides tools for querying cost data, listing findings, and getting recommendations. Same business logic as REST API (via core layer).          |
| C7.5 | **MCP tools**               | Tools: get_cost_summary, get_cost_by_dimension, list_findings, list_recommendations, get_account_status. Each tool has typed parameters and returns structured data.                                                            |
| C7.6 | **Frontend: Chat widget**   | Replace prototype chat with functional implementation. Chat panel slides in from the side. Message input with send button. Response rendering supports text, tables, and charts.                                                |


### Acceptance Criteria

- Chat correctly answers "What was total spend last month?" with accurate data from ingested costs
- MCP server responds to tool calls and returns valid structured data
- Chat does not allow triggering any state-changing operations
- Chat widget renders data tables inline when the response includes tabular data

### Dependencies

- Phase 3 (cost data API), Phase 4 (findings), Phase 6 (recommendations)

---

## Phase 8: Notifications & Operations

### Problem

Findings, alerts, and recommendations are only useful if they reach the right people at the right time. The platform needs a notification system that routes messages to appropriate channels.

### Requirements


| ID   | Requirement                  | Specification                                                                                                                                                                           |
| ---- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N8.1 | **Notification engine**      | Central service that routes alerts, findings, and budget notifications. MVP delivery channel: in-app (dashboard notifications).                                                         |
| N8.2 | **Notification preferences** | Per-user notification preferences: which event types to receive, delivery channel. Global defaults with per-user overrides.                                                             |
| N8.3 | **Notification API**         | API endpoints: list notifications, mark as read, mark all as read. Real-time delivery via WebSocket or SSE for in-app notifications.                                                    |
| N8.4 | **Audit trail**              | Log all significant actions: account registration, policy changes, budget changes, recommendation acceptance, finding state changes. Each entry includes: who, what, when, and context. |
| N8.5 | **Action logging**           | Every recommendation and action is logged with context, decision rationale, and measured outcome. Supports the continuous improvement loop from the core spec.                          |
| N8.6 | **Frontend: Notifications**  | Notification bell in header with unread count. Dropdown or panel showing recent notifications. Link from notification to relevant detail page.                                          |
| N8.7 | **Frontend: Audit log**      | Searchable, filterable list of audit events. Filter by user, event type, date range.                                                                                                    |


### Acceptance Criteria

- Budget alert notification appears in-app within 60 seconds of threshold crossing
- Notification preferences correctly suppress unwanted event types
- Audit log captures account registration and policy change events with correct attribution
- Notification bell shows accurate unread count

### Dependencies

- Phase 5 (budget alerts), Phase 4 (findings)

---

## Phase 9: Settings & Administration

### Problem

Customers need to manage their Numio workspace: connected accounts, user access, integrations, and workspace-level configuration.

### Requirements


| ID   | Requirement                 | Specification                                                                                                                                                                     |
| ---- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S9.1 | **Workspace settings**      | Workspace name, default currency, timezone, data retention period.                                                                                                                |
| S9.2 | **Account management UI**   | List connected AWS accounts with sync status. Add/remove accounts. Re-validate credentials. View ingestion health per account.                                                    |
| S9.3 | **User management**         | Invite users by email. Role-based access: admin, editor, viewer. Admin can manage workspace settings and accounts.                                                                |
| S9.4 | **Authentication**          | MVP: API key authentication for API/MCP access. Session-based auth for web UI. Production-ready auth provider integration planned post-MVP.                                       |
| S9.5 | **API access tokens**       | Generate and manage personal API access tokens. Tokens are scoped to workspace. Revoke capability.                                                                                |
| S9.6 | **Integrations page**       | UI for managing connected cloud accounts (AWS for MVP). Show connection status and last sync time. Placeholder for future integrations (GCP, AI providers).                       |
| S9.7 | **Automation safety**       | Global "Andon cord" toggle to pause all automated actions. Per-domain automation toggles. MVP: only notification actions exist, but the safety infrastructure should be in place. |
| S9.8 | **Frontend: Settings page** | Tabbed settings page covering: workspace, accounts/integrations, people, access tokens, automation safety, audit logs.                                                            |


### Acceptance Criteria

- Admin user can invite a new user and assign a role
- API access token can be generated and used to authenticate API requests
- Andon cord toggle disables all notification delivery when activated
- Settings page renders all tabs with correct data

### Dependencies

- Phase 1 (user/workspace models), Phase 2 (account management API)

---

## Phase 10: Frontend Polish & Production Readiness

### Problem

After all features are functional, the frontend needs to be converted from the prototype reference to a production-quality application, and the system needs hardening for real-world deployment.

### Requirements


| ID    | Requirement                  | Specification                                                                                                                                |
| ----- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| P10.1 | **Remove mock data**         | All pages serve real data from the API. Mock data modules are removed or isolated behind a dev-only flag.                                    |
| P10.2 | **Loading and error states** | All pages handle loading, empty, and error states gracefully. Skeleton loaders for initial page load. Retry mechanisms for failed API calls. |
| P10.3 | **Responsive design**        | UI works on desktop (primary) and tablet viewports. Mobile is not required for MVP.                                                          |
| P10.4 | **Frontend testing**         | Add testing framework (Vitest). Unit tests for utility functions. Component tests for critical UI components.                                |
| P10.5 | **Performance**              | Page load time under 3 seconds on standard connection. API responses under 500ms for common queries. Pagination for all list endpoints.      |
| P10.6 | **Security hardening**       | Input validation on all API endpoints. Rate limiting. CORS configuration. SQL injection prevention (via ORM). XSS prevention.                |
| P10.7 | **Observability**            | Application metrics (request latency, error rates, job durations). Health check endpoints for all services. Structured logs for debugging.   |
| P10.8 | **Documentation**            | API documentation (auto-generated OpenAPI + usage guide). MCP tool documentation. Deployment guide updated for production.                   |
| P10.9 | **Cost data labeling**       | UI clearly distinguishes estimated vs exact costs (per open question in core spec).                                                          |


### Acceptance Criteria

- Zero pages rely on mock data in production build
- All API list endpoints support pagination and return under 500ms for typical data volumes
- Frontend test suite passes with coverage on critical paths
- Security scan reveals no high-severity vulnerabilities

### Dependencies

- All preceding phases

---

## Cross-Cutting Concerns

These apply across all phases and should be addressed continuously, not as a separate phase.


| Concern                 | Approach                                                                                                  |
| ----------------------- | --------------------------------------------------------------------------------------------------------- |
| **Code quality**        | Ruff linting for backend, ESLint for frontend. CI enforces lint and test pass on every PR.                |
| **Database migrations** | Every schema change goes through Alembic. Migrations are forward-only in production.                      |
| **API versioning**      | All REST endpoints under `/api/v1/`. Breaking changes require a new version.                              |
| **Testing**             | Unit tests for business logic (core/). Integration tests for API endpoints. Job tests with test database. |
| **Documentation**       | Architecture doc updated when design decisions change. ARB docs for significant decisions.                |
| **Multi-tenancy prep**  | Workspace scoping enforced from Phase 1. No shortcuts that would require schema rework.                   |


---

## Dependency Graph

```
Phase 1: Foundation
   │
   ▼
Phase 2: AWS Integration & Data Ingestion
   │
   ├──────────────────────┐
   ▼                      ▼
Phase 3: Cost             Phase 9: Settings &
Attribution &             Administration
Reporting                 (accounts UI)
   │
   ├──────────┐
   ▼          ▼
Phase 4:     Phase 5:
Monitoring   Governance
& Detection  (Budgets &
   │          Policies)
   │             │
   ▼             ▼
Phase 6:      Phase 8:
Optimization  Notifications
& Recommen-   & Operations
dations          │
   │             │
   ├─────────────┤
   ▼             ▼
Phase 7: Chat & MCP
   │
   ▼
Phase 10: Frontend Polish & Production Readiness
```

## Parallelization Opportunities


| Work Stream A                  | Can run in parallel with   | Notes                                                               |
| ------------------------------ | -------------------------- | ------------------------------------------------------------------- |
| Phase 3 (Attribution)          | Phase 9 (Settings/Admin)   | Settings depends on Phase 1 models, not on Phase 3                  |
| Phase 4 (Monitoring)           | Phase 5 (Governance)       | Both depend on Phase 3 but are independent of each other            |
| Phase 6 (Optimization)         | Phase 8 (Notifications)    | Both depend on Phase 4/5 but are independent of each other          |
| Frontend work within any phase | Backend work in same phase | Frontend can start with mock API contracts while backend implements |


---

## Risks and Mitigations


| Risk                                                                      | Impact                          | Likelihood              | Mitigation                                                                                                                  |
| ------------------------------------------------------------------------- | ------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **AWS API rate limits** throttle ingestion for large accounts             | Delayed data, incomplete syncs  | High for large accounts | Implement exponential backoff, request batching, and incremental sync. Surface ingestion health to users.                   |
| **CUR file size** — large customers generate multi-GB CUR files           | Slow ingestion, memory pressure | Medium                  | Stream-process CUR files (Parquet format preferred). Process incrementally, not all-at-once.                                |
| **Anomaly detection accuracy** — false positives erode trust              | Users ignore real alerts        | High initially          | Start conservative (high thresholds). Allow per-dimension threshold tuning. Track acknowledgment rates as feedback signal.  |
| **Cost data freshness** — Cost Explorer data can lag 24-48h               | Users see stale data            | High (AWS limitation)   | Label data with last-updated timestamp. Document expected lag. CUR provides faster updates when configured.                 |
| **Scope creep into GCP/AI providers** before AWS is solid                 | Delayed MVP, diluted quality    | Medium                  | Enforce MVP = AWS-only boundary. Design interfaces for extensibility but do not implement non-AWS adapters.                 |
| **Frontend prototype divergence** — demo UI doesn't match real data needs | Rework, wasted effort           | Medium                  | Treat prototype as visual inspiration, not specification. Design real components API-first based on backend data contracts. |
| **Authentication complexity** in MVP                                      | Delayed delivery                | Medium                  | Use simple API key + session auth for MVP. Plan for proper auth provider (OAuth/OIDC) post-MVP.                             |


---

## Open Decisions

These items from the core spec require decisions before or during implementation:


| Decision                               | Affects Phase | Options                                  | Notes                                                              |
| -------------------------------------- | ------------- | ---------------------------------------- | ------------------------------------------------------------------ |
| Cost Explorer vs CUR vs both           | Phase 2       | Both supported, customer chooses         | Architecture already accommodates both via common interface        |
| Estimated vs exact cost labeling in UI | Phase 3, 10   | Label all data with source and precision | Core spec flags this as an open question                           |
| Findings suppression semantics         | Phase 4       | Time-based, permanent, scope-based       | Core spec marks as TBD — define during Phase 4 design              |
| Chat LLM provider and integration      | Phase 7       | OpenAI, Anthropic, self-hosted           | Depends on cost, latency, and data privacy requirements            |
| Auth provider for production           | Phase 9       | OAuth/OIDC (Auth0, Cognito, etc.)        | MVP uses simple auth; production provider decided post-MVP         |
| Notification channels beyond in-app    | Phase 8       | Email, Slack webhook, PagerDuty          | MVP: in-app only. Channels added post-MVP based on customer demand |


---

## Appendix: Questions from Task Decomposition

*These questions were raised during task definition and need product/architecture answers before the affected tasks can be fully specified.*

### Phase 2: AWS Integration & Data Ingestion

**Q1: Is AWS Organization discovery (I2.2) required for MVP?**
Organization discovery adds complexity (additional IAM permissions, Organizations API integration, UI for selective account registration). Customers can register accounts individually without it. Can we defer Organization discovery to a fast-follow and require individual account registration for MVP?
Answer: We don't need Organization discovery for MVP. Customers can register accounts individually.

**Q2: Should CUR ingestion (I2.5) be included in MVP Phase 2, or start with Cost Explorer only?**
CUR ingestion requires the customer to have already configured S3 export in their AWS account, which is a setup burden. Cost Explorer API provides daily cost data without any customer-side configuration. Option A: MVP supports Cost Explorer only; CUR added as a follow-on. Option B: Both are built in Phase 2, customer chooses. This affects the scope and duration of Phase 2 tasks significantly.
Answer: We should support both Cost Explorer and CUR in Phase 2. CUR is our primary data source. In the lack of access to CUR we will fallback to Cost Explorer.

### Phase 7: Chat & MCP

**Q3: Which LLM provider for the analytics chat backend (C7.1)?**
The chat feature requires an LLM to interpret natural language queries and generate responses. Options: OpenAI, Anthropic, self-hosted. This decision affects: dependencies, cost, API integration approach, and data privacy considerations. Need a decision before chat backend tasks can be defined.
Answer: It should be configurable by the customer. Our backend must interacts with LLMs via LMGate API ([https://github.com/vkroz/lmgate](https://github.com/vkroz/lmgate)). When LMGate lacks support for a given LLM, or APIs, we will add separate task to contribute to LMGate and add required functionality.

### Phase 9: Settings & Administration

**Q4: What is the MVP authentication approach for the web UI (S9.4)?**
The plan says "session-based auth for web UI" but does not specify how users authenticate. Options: simple username/password with local storage, magic link (email), OAuth/OIDC provider (Auth0, Cognito). This affects the scope of auth tasks, user management, and onboarding flow. For single-tenant MVP, is a simple shared API key or basic username/password sufficient?
Answer: We will use Cognito for authentication. There will be an option to disable authentication and use the app without it.

### Phase 7: LMGate Dependency

**Q5: Is LMGate deployed and available, or does it need to be set up as part of Numio MVP?**
The analytics chat backend (P7.1) depends on LMGate being accessible. Does the customer deploy LMGate separately, or should Numio include LMGate in its Docker Compose / deployment? If LMGate needs setup instructions or a Docker service, this affects the scope of Phase 7 and deployment documentation.
Answer: LMGate is separate service. It will be deployed seperately. Our backed code should expect LMGate but allow to use Anthropic APIs if LMGate is not available. This choise is done via configuration.

### Phase 9: Cognito Configuration

**Q6: Who provisions the Cognito user pool — Numio's setup process or the customer?**
Cognito requires a user pool to be configured in AWS. Options: (A) Numio's setup/deployment scripts create and configure the Cognito user pool automatically, (B) the customer creates the pool and provides the pool ID and client ID as configuration. This affects the deployment and onboarding documentation.
Answer: Customer owns the Cognito user pool. Numio only uses it. Details are configurable via Numio config file.

---

## Appendix 2: Task Inventory

### Task List


| Task ID | Phase | Task                                                    | Prerequisites      | File                                                      |
| ------- | ----- | ------------------------------------------------------- | ------------------ | --------------------------------------------------------- |
| P1.1    | 1     | Backend project restructure                             | —                  | `20260316_01_backend_project_restructure.md`              |
| P1.2    | 1     | Database setup (PostgreSQL, Alembic, workspace scoping) | P1.1               | `20260316_02_database_setup.md`                           |
| P1.3    | 1     | API foundation (config, scaffolding, errors, logging)   | P1.1, P1.2         | `20260316_03_api_foundation.md`                           |
| P1.4    | 1     | Testing infrastructure                                  | P1.2               | `20260316_04_testing_infrastructure.md`                   |
| P1.5    | 1     | Docker Compose update                                   | P1.1, P1.2         | `20260316_05_docker_compose_update.md`                    |
| P2.1    | 2     | AWS account registration & connectivity validation      | P1.2, P1.3         | `20260317_01_aws_account_registration.md`                 |
| P2.2    | 2     | Background worker & job scheduling                      | P1.2, P1.3         | `20260317_02_background_worker.md`                        |
| P2.3    | 2     | Cost Explorer ingestion                                 | P2.1, P2.2         | `20260317_03_cost_explorer_ingestion.md`                  |
| P2.4    | 2     | CUR ingestion                                           | P2.1, P2.2         | `20260317_04_cur_ingestion.md12_ana`                    |
| P2.5    | 2     | Resource inventory sync                                 | P2.1, P2.2         | `20260317_05_resource_inventory_sync.md`                  |
| ---     | ---   | ---                                                     | ---                | ---                                                       |
| P3.1    | 3     | Tag policy engine & compliance audit                    | P2.5, P2.3 or P2.4 | `20260317_06_tag_policy_engine.md`                        |
| P3.2    | 3     | Tag remediation campaigns                               | P3.1               | `20260317_07_tag_remediation_campaigns.md`                |
| P3.3    | 3     | Cost attribution & cost views API                       | P2.3 or P2.4       | `20260317_08_cost_attribution_and_views.md`               |
| P3.4    | 3     | Frontend: tag governance dashboard                      | P3.1, P3.2         | `20260317_09_frontend_tag_governance.md`                  |
| P3.5    | 3     | Frontend: overview dashboard                            | P3.3, P3.1         | `20260317_10_frontend_overview_dashboard.md`              |
| P3.6    | 3     | Frontend: cloud usage & cost reports                    | P3.3               | `20260317_11_frontend_cloud_usage_and_reports.md`         |
| ---     | ---   | ---                                                     | ---                | ---                                                       |
| P4.1    | 4     | Anomaly detection                                       | P3.3, P2.2         | `20260317_12_anomaly_detection.md`                        |
| P4.2    | 4     | Zombie hunter & idle detection                          | P2.5, P2.2         | `20260317_13_zombie_hunter_and_idle_detection.md`         |
| P4.3    | 4     | Findings management                                     | P1.2, P1.3         | `20260317_14_findings_management.md`                      |
| P4.4    | 4     | Frontend: feed, anomaly, zombie, resources              | P4.1, P4.2, P4.3   | `20260317_15_frontend_monitoring.md`                      |
| ---     | ---   | ---                                                     | ---                | ---                                                       |
| P5.1    | 5     | Budget management & tracking                            | P3.3, P4.3         | `20260317_16_budget_management.md`                        |
| P5.2    | 5     | Infrastructure policy engine                            | P2.5, P4.3, P3.3   | `20260317_17_policy_engine.md`                            |
| P5.3    | 5     | Frontend: budgets & policies                            | P5.1, P5.2         | `20260317_18_frontend_budgets_and_policies.md`            |
| ---     | ---   | ---                                                     | ---                | ---                                                       |
| P6.1    | 6     | Recommendations engine & savings tracking               | P4.1, P4.2, P4.3   | `20260317_19_recommendations_engine.md`                   |
| P6.2    | 6     | Frontend: recommendations & savings timeline            | P6.1               | `20260317_20_frontend_recommendations.md`                 |
| ---     | ---   | ---                                                     | ---                | ---                                                       |
| P7.1    | 7     | Analytics chat backend (LMGate / Anthropic)             | P3.3, P4.3, P6.1   | `20260317_21_analytics_chat_backend.md`                   |
| P7.2    | 7     | MCP server                                              | P3.3, P4.3, P6.1   | `20260317_22_mcp_server.md`                               |
| P7.3    | 7     | Frontend: chat widget                                   | P7.1               | `20260317_23_frontend_chat_widget.md`                     |
| ---     | ---   | ---                                                     | ---                | ---                                                       |
| P8.1    | 8     | Notification engine & audit trail                       | P4.3, P5.1         | `20260317_24_notification_engine.md`                      |
| P8.2    | 8     | Frontend: notifications & audit log                     | P8.1               | `20260317_25_frontend_notifications_and_audit.md`         |
| ---     | ---   | ---                                                     | ---                | ---                                                       |
| P9.1    | 9     | Authentication (Cognito)                                | P1.2, P1.3         | `20260317_26_authentication.md`                           |
| P9.2    | 9     | User & workspace management                             | P9.1, P2.1         | `20260317_27_user_and_workspace_management.md`            |
| P9.3    | 9     | Frontend: settings pages                                | P9.1, P9.2, P8.1   | `20260317_28_frontend_settings.md`                        |
| ---     | ---   | ---                                                     | ---                | ---                                                       |
| P10.1   | 10    | Frontend polish & production readiness                  | All above          | `20260317_29_frontend_polish_and_production_readiness.md` |


### Parallelization Plan

The table below shows how tasks can be organized into concurrent work sessions. Tasks within the same session can run in parallel. Each session starts only after all prerequisite tasks from prior sessions are complete.

```
Session 1: Foundation
├── P1.1  Backend project restructure
│
Session 2: Foundation (parallel)
├── P1.2  Database setup                    ← needs P1.1
├── (wait for P1.2 before next session)
│
Session 3: Foundation (parallel)
├── P1.3  API foundation                    ← needs P1.1, P1.2
├── P1.4  Testing infrastructure            ← needs P1.2
├── P1.5  Docker Compose update             ← needs P1.1, P1.2
│
Session 4: AWS integration + Auth (parallel)
├── P2.1  AWS account registration          ← needs P1.2, P1.3
├── P2.2  Background worker                 ← needs P1.2, P1.3
├── P4.3  Findings management               ← needs P1.2, P1.3
├── P9.1  Authentication (Cognito)          ← needs P1.2, P1.3
│
Session 5: Data ingestion + Settings (parallel)
├── P2.3  Cost Explorer ingestion           ← needs P2.1, P2.2
├── P2.4  CUR ingestion                     ← needs P2.1, P2.2
├── P2.5  Resource inventory sync           ← needs P2.1, P2.2
├── P9.2  User & workspace management       ← needs P9.1, P2.1
│
Session 6: Attribution + Governance + Detection (parallel)
├── P3.1  Tag policy engine                 ← needs P2.5, P2.3/P2.4
├── P3.3  Cost attribution & views API      ← needs P2.3/P2.4
├── P4.2  Zombie hunter & idle detection    ← needs P2.5, P2.2
│
Session 7: Campaigns + Anomalies + Policies + Budgets (parallel)
├── P3.2  Tag remediation campaigns         ← needs P3.1
├── P4.1  Anomaly detection                 ← needs P3.3, P2.2
├── P5.1  Budget management                 ← needs P3.3, P4.3
├── P5.2  Infrastructure policy engine      ← needs P2.5, P4.3, P3.3
├── P3.6  Frontend: cloud usage & reports   ← needs P3.3
│
Session 8: Recommendations + Frontend (parallel)
├── P6.1  Recommendations engine            ← needs P4.1, P4.2, P4.3
├── P3.4  Frontend: tag governance          ← needs P3.1, P3.2
├── P3.5  Frontend: overview dashboard      ← needs P3.3, P3.1
├── P4.4  Frontend: monitoring pages        ← needs P4.1, P4.2, P4.3
├── P5.3  Frontend: budgets & policies      ← needs P5.1, P5.2
├── P8.1  Notification engine & audit trail ← needs P4.3, P5.1
│
Session 9: Chat + MCP + Frontend (parallel)
├── P7.1  Analytics chat backend            ← needs P3.3, P4.3, P6.1
├── P7.2  MCP server                        ← needs P3.3, P4.3, P6.1
├── P6.2  Frontend: recommendations         ← needs P6.1
├── P8.2  Frontend: notifications & audit   ← needs P8.1
├── P9.3  Frontend: settings pages          ← needs P9.1, P9.2, P8.1
│
Session 10: Chat frontend (parallel)
├── P7.3  Frontend: chat widget             ← needs P7.1
│
Session 11: Polish
├── P10.1 Frontend polish & production      ← needs all above
```

### Critical Path

The longest dependency chain determines the minimum number of sequential sessions:

```
P1.1 → P1.2 → P1.3 → P2.1/P2.2 → P2.3 → P3.3 → P4.1 → P6.1 → P7.1 → P7.3 → P10.1
```

This 11-session critical path cannot be shortened by adding parallelism. All other tasks fit within these sessions as parallel work.