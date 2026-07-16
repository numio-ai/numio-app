--------------------------------------------------
# TODO: Update this document to reflect the new architecture. Align with the current UI demo and `Numio vision.md`.
--------------------------------------------------

## Architecture


### Frontend (`frontend/src/`)
- **React 19 + Vite 6** with react-router-dom for client-side routing
- **`App.jsx`** - Route definitions and main layout
- **`pages/`** - Page components (Overview, CostReporting, Optimize, etc.)
- **`components/`** - Shared components (Header, Sidebar, Footer, ChatWidget)
- **`mocks/`** - Mock data modules used during development
- **`styles.css`** - Single CSS file for all styles
- **`utils/`** - Utility functions

### Backend (`backend/src/numio/`)
- **`main.py`** - FastAPI app entrypoint, configures CORS, registers routes and MCP endpoints, manages lifespan (MCP session manager)
- **`api/routes.py`** - REST API routes under `/api/v1` (cost summary, by-service, trends)
- **`mcp/server.py`** - FastMCP server exposed at `/mcp` (streamable HTTP) and `/mcp/sse` (SSE transport)
- **`core/services.py`** - Shared business logic consumed by both REST and MCP layers

Key pattern: business logic lives in `core/`, both `api/` and `mcp/` are thin layers that call into `core/`.


### Environment & Deployment
- **`deployment/localhost/`** - Local and laptop container config
- **`.env`** - Environment variables (not committed; see `deployment/localhost/.env.example`)
- **`VITE_API_URL`** env var controls which backend the frontend talks to (baked into JS bundle at build time)

### Control Plane Scripts (`scripts/`)
- **`numio-ctl.sh`** - Runtime management (start/stop/dev/status/logs/health)
- **`numio-dev.sh`** - Local development, setup, and build operations
- **`tools/`** - Shared shell utilities (build, dev, docker, worktree)

## Key Technical Details

- Backend uses **uv** as Python package manager (not pip)
- Backend uses **hatchling** build system
- Backend linting: **ruff** (line-length=100, py312 target, rules: E/F/I/W)
- Backend testing: **pytest** with `asyncio_mode = "auto"`, test dir is `backend/tests/`
- Frontend has no test framework or linter configured yet
- Python 3.12+ required; Node.js 20+ required
