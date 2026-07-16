---
Date: 2026-04-11
Status: Needs review
---

# Numio High LEvel Architecture

Numio application provides cost monitoring, attribution, and optimization functionality to users of cloud and AI APIs. MVP scope is AWS-only, with a design that supports future expansion to GCP and AI provider billing (OpenAI, Anthropic).

Numio runs as a set of containerized services: a React frontend, a FastAPI backend (REST + MCP), a background worker for data ingestion and analysis, and PostgreSQL for persistence.

## Deployment Topology

### Services

| Service | Image | Purpose |
|---------|-------|---------|
| `numio-ui` | nginx serving static build | React frontend |
| `numio-api` | FastAPI (uvicorn) | REST API + MCP server |
| `numio-worker` | Python (APScheduler) | Background jobs: billing sync, anomaly detection, policy evaluation |
| `postgres` | PostgreSQL | Persistent data store |

### Local Development

All services run via `docker-compose.yml`. Frontend and backend also support standalone dev mode with hot reload (see Developer Guide).

```
docker-compose.yml
├── numio-ui        (port 5173 dev / 80 prod)
├── numio-api       (port 8000)
├── numio-worker    (no exposed port)
└── postgres        (port 5432)
```

### Cloud Deployment (Post-MVP)

The architecture is designed so that each service can be deployed independently to cloud-managed infrastructure (e.g., ECS tasks, Kubernetes pods). The worker's plain async function design allows jobs to be invoked by cloud schedulers (EventBridge, CronJobs) without code changes. Cloud deployment specifics are out of scope for MVP.

## Data Ingestion

### AWS Billing Data (CUR)

Numio consumes AWS billing data from AWS CUR report.

### AWS Resource Inventory

Resource metadata is pulled directly from AWS service APIs (EC2 DescribeInstances, RDS, S3, EBS, EIP, etc.) for:
- Zombie Hunter (orphaned/idle resource detection)
- Right-sizing recommendations (via CloudWatch utilization metrics)
- Tag compliance auditing

### Credential Model

Customers register AWS accounts by providing an IAM role ARN for cross-account assume-role. Numio validates connectivity and required permissions at registration time. No long-lived AWS credentials are stored.

### Future: GCP & AI Providers (Phase 2)

- GCP: BigQuery billing export ingestion
- AI providers (OpenAI, Anthropic): REST billing/usage APIs with API key auth

The common data source interface is designed to accommodate these without rearchitecting the ingestion layer.

## Backend Architecture

### Technology

- **Python 3.12+**, **FastAPI**, **uv** (package manager), **hatchling** (build system)
- **SQLAlchemy** for ORM / database access
- **Pydantic** for request/response schemas
- **Alembic** for database migrations
- Linting: **ruff** (line-length=100, py312 target, rules: E/F/I/W)
- Testing: **pytest** with `asyncio_mode = "auto"`

### Service Structure

```
backend/src/numio/
├── main.py              # FastAPI app entrypoint
├── api/                 # REST API routes (thin layer)
├── mcp/                 # MCP server (thin layer)
├── core/                # Business logic
│   ├── ingestion/       # AWS data pulling (Cost Explorer, CUR, resource APIs)
│   ├── attribution/     # Cost attribution engine
│   ├── monitoring/      # Anomaly detection, zombie hunter
│   ├── budgets/         # Budget tracking & alerts
│   ├── policies/        # Policy evaluation engine
│   ├── recommendations/ # Savings recommendations
│   └── notifications/   # Alert routing
├── models/              # SQLAlchemy database models
├── schemas/             # Pydantic request/response schemas
└── jobs/                # Job definitions (plain async functions)
```

**Key pattern**: Business logic lives in `core/`. Both `api/` and `mcp/` are thin layers that call into `core/`. Jobs in `jobs/` also call `core/` — they are plain async functions, unaware of how they are invoked.

### API Design

- REST API under `/api/v1/`
- MCP server at `/mcp` (streamable HTTP) and `/mcp/sse` (SSE transport)
- All endpoints return consistent JSON structures via Pydantic schemas

## Background Processing

### Design Principles

- Worker runs as a **separate service** (not in the API process)
- Jobs are **plain async functions** — they have no dependency on the scheduler or any framework
- This allows the same job function to be invoked by APScheduler locally, by a cloud scheduler (EventBridge, K8s CronJob), or on-demand via an API call
- **No external broker** (no Redis, no Celery, no Arq)

### Job Execution

| Trigger | MVP | Post-MVP |
|---------|-----|----------|
| Scheduled (daily) | APScheduler in `scheduler.py` | Cloud scheduler (EventBridge, CronJob) |
| On-demand | API endpoint triggers job directly | Same |

### MVP Jobs

- **Billing sync**: Pull cost data from Cost Explorer and/or CUR
- **Resource inventory sync**: Pull resource metadata from AWS APIs
- **Anomaly detection**: Compute baselines, detect drift and spikes
- **Zombie hunter**: Identify orphaned/idle resources
- **Policy evaluation**: Evaluate resources against active policies
- **Budget evaluation**: Check spend against budgets, generate alerts

## Database

### Technology

**PostgreSQL** — relational, runs in Docker for local dev, managed service (RDS) for cloud deployment.

### Multi-Tenancy Readiness

MVP is **single-tenant** (one Numio instance per customer). However, the data model includes workspace/tenant scoping to avoid significant rework when multi-tenancy is needed:

- All core tables include a `workspace_id` column
- Queries are scoped by workspace at the data access layer
- MVP ships with a single default workspace
- This allows future multi-tenant SaaS mode by adding workspace management and routing — without migrating or restructuring the data model

## Frontend Architecture

### Technology

- **React 19 + Vite 6** with react-router-dom for client-side routing
- **Node.js 20+**
- `VITE_API_URL` env var controls which backend the frontend talks to (baked into JS bundle at build time)

### Structure

```
frontend/src/
├── App.jsx            # Route definitions and main layout
├── pages/             # Page components
├── components/        # Shared components (Header, Sidebar, Footer, ChatWidget)
├── mocks/             # Mock data modules (development only)
├── styles/            # CSS
└── utils/             # Utility functions
```

### Development Approach

The current frontend is a dummy prototype from `numio-demo` — it serves as a visual reference for the target UI. Pages are converted to real functionality page-by-page as backend APIs become available. Mock data is retained for development and testing.

## Environment & Deployment

- **`deployment/localhost/`** — Local and laptop container config
- **`.env`** — Environment variables (not committed; see `deployment/localhost/.env.example`)

### Control Plane Scripts (`scripts/`)

- **`numio-ctl.sh`** — Runtime management (start/stop/dev/status/logs/health)
- **`numio-dev.sh`** — Local development, setup, and build operations
- **`tools/`** — Shared shell utilities
