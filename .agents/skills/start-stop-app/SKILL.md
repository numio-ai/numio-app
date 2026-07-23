---
name: start-stop-app
description: Use when the user asks to start, stop, or restart the application. Handles Docker not running, fresh volumes, and stale PIDs.
---

# Start / Stop App

## When This Skill Applies

Activate when the user asks to:
- Start, run, or launch the application
- Stop or shut down the application
- Restart the application

---

## Starting the Application

### Step 1 — Check if Docker is running

```bash
docker info > /dev/null 2>&1 && echo "running" || echo "not running"
```

If not running, launch Docker Desktop and wait for the daemon:

```bash
open -a Docker
until docker info > /dev/null 2>&1; do sleep 2; done
```

### Step 2 — Start infrastructure (postgres + valkey)

```bash
./scripts/numio-dev.sh run infra
```

The worktree allocates dynamic ports (not always 5432). Postgres and valkey ports are printed during startup and stored in `.numio/worktree.env`.

### Step 3 — Fresh volume? Run migrate + seed

Check if this is a fresh volume by looking at the `run infra` output. If it created new volumes (`Volume ... Created`), run:

```bash
./scripts/numio-dev.sh migrate
./scripts/numio-dev.sh seed
```

Skip these if the volume already existed (output says `Volume ... Running` or similar — no `Created`).

### Step 4 — Start backend, frontend, worker

```bash
./scripts/numio-dev.sh run all
```

If all three report `already running`, the PIDs are stale (processes started before infra was ready with the wrong ports/DATABASE_URL). Restart **all three**:

```bash
./scripts/numio-dev.sh restart backend
./scripts/numio-dev.sh restart frontend
./scripts/numio-dev.sh restart worker
```

### Step 5 — Verify

```bash
./scripts/numio-dev.sh health
curl -fsS "http://localhost:$(grep BACKEND_HOST_PORT .numio/worktree.env | cut -d= -f2)/api/v1/auth/me"
```

Expected health: `{"status":"ok","database":"connected"}`.
Expected auth/me: `{"email":"admin@localhost","role":"admin"}`.

**Common failures and fixes:**

| Symptom | Cause | Fix |
|---------|-------|-----|
| Backend health: `Connection refused` on port 5432 | Backend started before worktree init — wrong `DATABASE_URL` | `restart backend` |
| Frontend on port 5173 instead of worktree port | Frontend started before worktree init | `restart frontend` |
| `auth/me` returns 500 | Migrations or seed not applied | Run `migrate` then `seed`, then `restart backend` |

Always confirm the frontend is serving on the worktree port, not Vite's default 5173:

```bash
./scripts/numio-dev.sh log frontend | grep "Local:"
```

### Ports (worktree-specific — check `.numio/worktree.env`)

```bash
cat .numio/worktree.env
```

| Service | Variable | Typical URL |
|---------|----------|-------------|
| Frontend | `FRONTEND_DEV_PORT` | http://localhost:`<port>` |
| Backend  | `BACKEND_HOST_PORT` | http://localhost:`<port>` |
| Postgres | `POSTGRES_HOST_PORT` | localhost:`<port>` |
| Valkey   | `VALKEY_HOST_PORT`  | localhost:`<port>` |

---

## Stopping the Application

```bash
./scripts/numio-dev.sh stop all
```

To also stop infrastructure containers:

```bash
./scripts/numio-dev.sh stop all
docker compose --project-name "$(grep COMPOSE_PROJECT_NAME .numio/worktree.env | cut -d= -f2)" down
```

---

## Checking Status

```bash
./scripts/numio-dev.sh status
```

All five components should show `running`: postgres, valkey, backend, frontend, worker.
