# Numio Operations Runbook

## Audience

Forward-deployed engineer (FDE) installing Numio on a laptop. All services run as containers pulled from the public GitLab Container Registry at `registry.gitlab.com/numio-ai/numio-app`. Docker is the only host requirement. No source tree, no build, no language runtimes.

Out of scope: multi-host, Kubernetes, customer AWS-account installs, Numio-internal registries.

Developing Numio? Use [`dev-runbook.md`](dev-runbook.md).

> **Status.** Install will fail until the operator compose artifact (`tasks/backlog/20260416_03.11_packaging--shipped_operator_compose_artifact.md`) and the `numio-ctl.sh` operator CLI (`tasks/backlog/20260416_02.12_tools--evolve_numio_ctl_operator_cli.md`) land. Image publishing to the GitLab Container Registry is handled by `tasks/active/20260416_03.10_packaging--publish_images_to_gitlab_registry.md`. Use `dev-runbook.md` until all three land.

## Operator mode vs developer mode

| Aspect | Operator | Developer |
|---|---|---|
| What runs | 5 services as containers | Infra containers; backend/worker/frontend native |
| Images | `registry.gitlab.com/numio-ai/numio-app` | Repo build or hot-reload dev servers |
| CLI | `numio-ctl.sh` | `numio-dev.sh` |
| Source tree | Not required | Required |
| `status` shows | Containers | Containers + native PIDs |

Do not run both on one host. If the two `status` outputs disagree, both are running — stop one.

## Prerequisites

| Tool | Version |
|------|---------|
| Docker Desktop | 4.x+ with Compose V2 |
| `curl` | any |

```bash
docker --version && docker compose version
```

## Install

```bash
export NUMIO_HOME="$HOME/.numio"
mkdir -p "$NUMIO_HOME" && cd "$NUMIO_HOME"

RELEASE=permalink/latest   # or a pinned tag path, e.g. v0.1.0
BASE="https://gitlab.com/numio-ai/numio-app/-/releases/${RELEASE}/downloads"
curl -fsSLO "${BASE}/docker-compose.yml"
curl -fsSLO "${BASE}/.env.example"
curl -fsSLO "${BASE}/numio-ctl.sh"
chmod +x numio-ctl.sh

cp .env.example .env
$EDITOR .env        # set SESSION_SECRET_KEY

./numio-ctl.sh install
```

`install` pulls images, starts containers, applies migrations, seeds the default workspace, runs the health check. First run: 1–3 minutes. Next start: under 10 seconds.

## Verify

```bash
./numio-ctl.sh status
./numio-ctl.sh health
```

Expected `/health`:

```json
{"service": "numio", "status": "ok", "version": "0.1.0", "environment": "local", "database": "connected"}
```

| Service | Container | Endpoint |
|---|---|---|
| Frontend | `numio-ui` | http://localhost:3000 |
| REST API | `numio-srv` | http://localhost:8000/api/v1 |
| MCP (HTTP) | `numio-srv` | http://localhost:8000/mcp |
| MCP (SSE) | `numio-srv` | http://localhost:8000/mcp/sse |
| Health | `numio-srv` | http://localhost:8000/health |
| PostgreSQL | `numio-postgres` | localhost:5432 |
| Valkey | `numio-valkey` | localhost:6379 |
| Worker | `numio-worker` | — (no port) |

Open http://localhost:3000.

## Connect an AWS account

Use **Settings → Integrations → Add Account** in the UI. Full IAM, external ID, and Cost and Usage Report (CUR) steps are in the [User Guide](user-guide.md). AWS credentials go in the database via the UI, never in `.env`.

## Lifecycle

| Action | Command |
|---|---|
| Start / stop / restart all | `./numio-ctl.sh {start,stop,restart}` |
| Same, one service | `./numio-ctl.sh {start,stop,restart} <service>` |
| Container status | `./numio-ctl.sh status` |
| Follow logs | `./numio-ctl.sh logs [service]` |
| Backend health | `./numio-ctl.sh health` |

Services: `backend`, `frontend`, `worker`, `postgres`, `valkey`.

### Logs

`./numio-ctl.sh logs` merges stdout and stderr. `Ctrl-C` stops tailing; containers keep running. Raw `docker logs` keeps streams split; add `2>&1` before piping to `grep`.

## Upgrade

```bash
./numio-ctl.sh upgrade 0.2.0
```

Pins `NUMIO_VERSION=0.2.0`, pulls, migrates, recreates containers, runs the health check. Database data persists. Read release notes first for schema or config changes.

## Rollback

```bash
./numio-ctl.sh rollback 0.1.0
```

Pins the previous tag and restarts. Under 1 minute for schema-compatible versions. If the newer version added migrations, run the downgrade before rollback — check release notes.

## Uninstall

```bash
./numio-ctl.sh uninstall      # prompts before removing pgdata volume
rm -rf "$NUMIO_HOME"          # removes install directory
```

Volume removal deletes all cost data, accounts, and config. Irreversible.

## Configuration

Env vars live in `$NUMIO_HOME/.env`. Any change: `./numio-ctl.sh restart`. Do not commit `.env`.

### Authentication

| Variable | Default | Purpose |
|---|---|---|
| `AUTH_ENABLED` | `false` | Keep `false` for laptop use. |
| `COGNITO_USER_POOL_ID` | _(empty)_ | Required when `AUTH_ENABLED=true`. |
| `COGNITO_CLIENT_ID` | _(empty)_ | Required when `AUTH_ENABLED=true`. |
| `COGNITO_REGION` | `us-east-1` | Cognito region. |
| `SESSION_SECRET_KEY` | `change-me-in-production` | Unique per install. |
| `SESSION_TTL_HOURS` | `24` | Session lifetime. |

With `AUTH_ENABLED=false` every request runs as `admin@localhost`. Never expose such a host beyond localhost.

### Database

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgresql+psycopg://numio:numio@postgres:5432/numio` | Primary DSN used by the backend, worker, and migrations. |
| `DATA_EXPLORER_DB_PASSWORD` | `numio_readonly` | Password for the `numio_readonly` Postgres role used by Data Explorer. **Override in any non-laptop environment.** |
| `DATA_EXPLORER_DATABASE_URL` | _(empty — derived)_ | Optional full DSN for the read-only connection. When empty, the backend reuses `DATABASE_URL` with `numio_readonly:${DATA_EXPLORER_DB_PASSWORD}` as the userinfo. |

### Cache

| Variable | Default |
|---|---|
| `VALKEY_URL` | `valkey://valkey:6379` |
| `CE_CACHE_TTL_SECONDS` | `3600` |
| `CE_CACHE_ENABLED` | `true` |

### Logging

| Variable | Default |
|---|---|
| `LOG_LEVEL` | `INFO` (`DEBUG` / `INFO` / `WARNING` / `ERROR`) |
| `ENVIRONMENT` | `local` |
| `DEBUG` | `false` |

Non-`DEBUG` emits JSON logs.

### CORS

| Variable | Default |
|---|---|
| `CORS_ALLOWED_ORIGINS` | `http://localhost:3000,http://localhost:5173` |

### Rate limiting

| Variable | Default (req/min) |
|---|---|
| `RATE_LIMIT_READ` | `100` |
| `RATE_LIMIT_WRITE` | `20` |

### Analytics / LLM

| Variable | Default |
|---|---|
| `CHAT_LLM_BACKEND` | `lmgate` (or `anthropic`) |
| `CHAT_LMGATE_URL` | _(empty)_ |
| `CHAT_LMGATE_MODEL` | _(empty)_ |
| `CHAT_ANTHROPIC_API_KEY` | _(empty)_ |
| `CHAT_ANTHROPIC_MODEL` | `claude-sonnet-4-5-20250514` |
| `CHAT_SESSION_TTL_HOURS` | `24` |
| `CHAT_MAX_MESSAGES_PER_SESSION` | `50` |

### AWS onboarding

| Variable | Default | Purpose |
|---|---|---|
| `PUBLIC_BASE_URL` | _(empty)_ | Publicly reachable base URL of the Numio backend (e.g. `https://app.example.com`). Required for the CloudFormation quick-create launch URL to pre-load the onboarding template via `templateURL`. When empty, the UI falls back to manual upload of the downloaded template. |
| `ONBOARDING_CHAT_ENABLED` | `false` | When `true`, the Chat onboarding method appears on the **Add Account** hub. Off in production until Chat v1 ships. |

### Image version

| Variable | Default |
|---|---|
| `NUMIO_VERSION` | `latest` (set by `numio-ctl.sh upgrade`) |

## Troubleshooting

### Containers won't start

1. `docker info` succeeds?
2. Ports free? `lsof -i:3000 -i:8000 -i:5432 -i:6379`
3. Dev stack already running? Stop it.

### Backend `/health` fails

```bash
./numio-ctl.sh logs backend
```

- Postgres not ready: `./numio-ctl.sh restart backend`.
- Migrations missing: `./numio-ctl.sh init-db`.
- Wrong `DATABASE_URL` in `.env`.

### Frontend blank / network errors

1. Backend up? `./numio-ctl.sh health`.
2. Browser-console network errors → `CORS_ALLOWED_ORIGINS` missing your origin.
3. Changed backend port/host? `VITE_API_URL` is baked at image build; file an issue.

### Worker up but no data ingested

Same diagnosis as dev mode — see [`dev-runbook.md`](dev-runbook.md#worker-appears-healthy-but-no-data-lands-in-the-database). Replace the dev log path with `./numio-ctl.sh logs worker`.

### Reset everything

```bash
./numio-ctl.sh uninstall       # answer yes to wipe pgdata
./numio-ctl.sh install
```

## Monitoring

- `GET /health` — service status, database, version.
- Non-`DEBUG`: JSON logs with correlation IDs.
- Every response: `X-Request-ID`.
- Rate-limit headers: `X-RateLimit-{Limit,Remaining,Reset}`.

## Security checklist

- [ ] `SESSION_SECRET_KEY` is unique. Generate: `python3 -c "import secrets; print(secrets.token_urlsafe(48))"` (run anywhere).
- [ ] `.env` not in version control; owner-read only.
- [ ] Host reachable beyond localhost → `AUTH_ENABLED=true` + Cognito configured.
- [ ] UI exposed beyond localhost → put HTTPS in front; Numio ships no TLS.
- [ ] AWS credentials entered via the UI, not `.env`.

## Appendix — raw `docker compose` equivalents

For debugging only. Run from `$NUMIO_HOME`.

| `numio-ctl.sh` | Raw |
|---|---|
| `start` / `start <svc>` | `docker compose up -d [svc]` |
| `stop` | `docker compose down` |
| `stop <svc>` | `docker compose stop <svc>` |
| `restart` | `docker compose down && docker compose up -d` |
| `restart <svc>` | `docker compose up -d --force-recreate <svc>` |
| `status` | `docker compose ps` |
| `logs [svc]` | `docker compose logs -f [svc]` |
| `health` | `curl -fsS http://localhost:8000/health` |

The wrapper adds what the raw commands do not: `restart` forces recreate (picks up `.env` changes); `upgrade` pins `NUMIO_VERSION`, pulls, and migrates in one step; `install` / `uninstall` hide `docker compose exec` for migrations and seeding.
