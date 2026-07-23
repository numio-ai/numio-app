#!/usr/bin/env bash
# Numio Dev - Development CLI for Numio
#
# Manages the full development lifecycle: run, stop, restart, rebuild,
# migrate, status, log, health, init, and build.
#
# Usage:
#   ./scripts/numio-dev.sh <command> [options]
#
# Examples:
#   ./scripts/numio-dev.sh run backend           # Run backend (auto-starts infra)
#   ./scripts/numio-dev.sh run all               # Run everything
#   ./scripts/numio-dev.sh stop backend           # Stop backend
#   ./scripts/numio-dev.sh status                 # Show what's running
#   ./scripts/numio-dev.sh migrate                # Run database migrations

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${SCRIPT_DIR}/.."

# Source common utilities
source "${SCRIPT_DIR}/tools/common.sh"
source "${SCRIPT_DIR}/tools/docker.sh"
source "${SCRIPT_DIR}/tools/build.sh"
source "${SCRIPT_DIR}/tools/worktree.sh"
source "${SCRIPT_DIR}/tools/dev.sh"

usage() {
  cat <<'EOF'
Usage: scripts/numio-dev.sh <command> [options]

Development CLI for Numio.

Lifecycle Commands:
  run       [--no-browser] [--mock] <component...>
                                  Run component(s) with hot reload. When the
                                  invocation starts the frontend in background
                                  mode (e.g. 'run all'), the default browser is
                                  opened to the frontend URL on success.
                                  Pass --no-browser, set NUMIO_NO_BROWSER=1, or
                                  run non-interactively (CI=1 / non-TTY) to skip.
                                  Pass --mock to run the frontend from synthetic
                                  data with no backend (VITE_API_MODE=mock); e.g.
                                  'run frontend --mock'. See docs/dev-runbook.md.
  stop      <component...>        Stop component(s)
  restart   <component...>        Soft restart (keep state)
  rebuild   <component...>        Hard restart (rebuild + re-migrate)
  status                          Show what's running
  ports                           Show this worktree's project name and host port map
  nuke      [-y|--yes]            Destroy this worktree's stack + data (scoped to its Compose project)
  log       [component...] [-f]   Show recent logs (last 200 lines). Use -f/--follow to stream.
  migrate                         Run database migrations (alembic upgrade head)
  seed                            Insert the default workspace row (idempotent)
  health                          Backend health check

Setup Commands:
  init                            First-time setup (install dependencies)
  build     [options]             Build Docker images locally
  build     help                  Show detailed build help

Components:
  backend    FastAPI server (native, hot reload)
  frontend   Vite dev server (native, hot reload)
  worker     Background worker (native)
  postgres   PostgreSQL (container)
  valkey     Valkey cache (container)
  infra      Alias: postgres + valkey
  all        All five services

Options:
  --tag=TAG         Image tag for build (e.g., v1.2.3). Default: latest
  --service=SVC     Single service for build: backend, frontend
  -h, --help        Show this help

Examples:
  ./scripts/numio-dev.sh run backend              # Start backend + auto-start infra
  ./scripts/numio-dev.sh run all                  # Start everything
  ./scripts/numio-dev.sh run frontend --mock      # Frontend only, synthetic data, no backend
  ./scripts/numio-dev.sh stop all                 # Stop everything
  ./scripts/numio-dev.sh status                   # Show what's running
  ./scripts/numio-dev.sh log backend              # Recent backend logs (exits)
  ./scripts/numio-dev.sh log -f backend           # Follow backend logs (Ctrl-C to stop)
  ./scripts/numio-dev.sh log worker | grep ERROR  # Output is safe to pipe to grep/head/less
  ./scripts/numio-dev.sh restart backend          # Soft restart backend
  ./scripts/numio-dev.sh rebuild infra            # Hard restart infra containers
  ./scripts/numio-dev.sh migrate                  # Apply database migrations
  ./scripts/numio-dev.sh seed                     # Insert the default workspace row
  ./scripts/numio-dev.sh health                   # Check backend health
  ./scripts/numio-dev.sh init                     # First-time setup
  ./scripts/numio-dev.sh build --tag=v1.2.3       # Build Docker images
EOF
}

# ============================================================================
# Init — install dependencies for local development
# ============================================================================

cmd_init() {
  log_info "Setting up localhost development environment..."

  require_cmd node
  require_cmd npm
  require_cmd uv
  require_cmd docker
  require_cmd gitleaks

  log_info "Enabling git pre-commit secret scanning (gitleaks)..."
  git -C "${PROJECT_DIR}" config core.hooksPath .githooks

  log_info "Installing frontend dependencies..."
  cd "${PROJECT_DIR}/frontend"
  npm install

  log_info "Installing backend dependencies..."
  cd "${PROJECT_DIR}/backend"
  uv sync

  log_info "Setup complete!"
  echo
  log_info "Next steps (first-time worktree setup, in order):"
  echo "  1. Start infra containers:"
  echo "       ./scripts/numio-dev.sh run infra"
  echo "  2. Apply database migrations:"
  echo "       ./scripts/numio-dev.sh migrate"
  echo "  3. Seed the default workspace (required for bypass-mode auth):"
  echo "       ./scripts/numio-dev.sh seed"
  echo "  4. Start the services:"
  echo "       ./scripts/numio-dev.sh run all"
  echo ""
  echo "  See docs/dev-runbook.md -> 'First-time worktree setup' for the full SOP."
}

# ============================================================================
# Build — build Docker images locally
# ============================================================================

cmd_build() {
  build_main "$PROJECT_DIR" "$@"
}

# ============================================================================
# Main
# ============================================================================

main() {
  local command="${1:-}"

  # Help commands don't need worktree env loading (and may run before init).
  case "${command}" in
    ""|-h|--help|help)
      usage
      return 0
      ;;
  esac

  # Every command below this point operates against the worktree-scoped stack.
  # Loading here (once) guarantees COMPOSE_PROJECT_NAME and the port map are
  # exported before any docker compose or native process is launched.
  worktree_load_env

  case "${command}" in
    run)
      shift
      dev_run "$@"
      ;;
    stop)
      shift
      dev_stop "$@"
      ;;
    status)
      dev_status
      ;;
    ports)
      worktree_print_env
      ;;
    nuke)
      shift
      dev_nuke "$@"
      ;;
    log)
      shift
      dev_log "$@"
      ;;
    restart)
      shift
      dev_restart "$@"
      ;;
    rebuild)
      shift
      dev_rebuild "$@"
      ;;
    migrate)
      dev_migrate
      ;;
    seed)
      dev_seed
      ;;
    health)
      dev_health
      ;;
    init)
      shift
      cmd_init
      ;;
    build)
      shift
      cmd_build "$@"
      ;;
    # Hidden alias: 'dev' maps to 'run' for backward compatibility
    dev)
      shift
      dev_run "$@"
      ;;
    *)
      log_error "Unknown command: ${command}"
      usage >&2
      exit 2
      ;;
  esac
}

main "$@"
