#!/usr/bin/env bash
# Numio Manager - Runtime management for Numio services
#
# Thin wrapper around docker compose for managing Numio containers.
# Runs from the project source tree.
#
# Usage:
#   ./scripts/numio-ctl.sh <command> [SERVICE]
#
# Examples:
#   ./scripts/numio-ctl.sh start              # Start all containers
#   ./scripts/numio-ctl.sh stop               # Stop all containers
#   ./scripts/numio-ctl.sh restart backend    # Restart backend only
#   ./scripts/numio-ctl.sh logs               # View all logs
#   ./scripts/numio-ctl.sh health             # Health check

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${SCRIPT_DIR}/.."

# Source common utilities
source "${SCRIPT_DIR}/tools/common.sh"

usage() {
  cat <<'EOF'
Usage: ./scripts/numio-ctl.sh <command> [SERVICE]

Runtime management for Numio containers.

Commands:
  start   [SERVICE]     Start containers (all or specific)
  stop    [SERVICE]     Stop containers (all or specific)
  restart [SERVICE]     Restart containers (all or specific)
  status                Show container status
  logs    [SERVICE]     View logs (all or specific)
  health                Health check

Arguments:
  SERVICE               Service name: backend, frontend, worker, postgres, valkey

Examples:
  ./scripts/numio-ctl.sh start              # Start all
  ./scripts/numio-ctl.sh stop backend       # Stop backend only
  ./scripts/numio-ctl.sh restart            # Restart all
  ./scripts/numio-ctl.sh logs backend       # Backend logs
  ./scripts/numio-ctl.sh health             # Health check
EOF
}

# ============================================================================
# Docker Compose helper
# ============================================================================

compose() {
  check_docker
  check_docker_compose
  cd "${PROJECT_DIR}"
  docker compose "$@"
}

# ============================================================================
# Commands
# ============================================================================

cmd_start() {
  local services=("$@")

  if [[ ${#services[@]} -gt 0 ]]; then
    log_info "Starting ${services[*]}..."
    compose up -d "${services[@]}"
  else
    log_info "Starting all services..."
    compose up -d
  fi

  log_info "Services started"
  compose ps
}

cmd_stop() {
  local services=("$@")

  if [[ ${#services[@]} -gt 0 ]]; then
    log_info "Stopping ${services[*]}..."
    compose stop "${services[@]}"
  else
    log_info "Stopping all services..."
    compose down
  fi

  log_info "Services stopped"
}

cmd_restart() {
  local services=("$@")

  if [[ ${#services[@]} -gt 0 ]]; then
    log_info "Restarting ${services[*]}..."
    compose up -d --force-recreate "${services[@]}"
  else
    log_info "Restarting all services..."
    compose down
    compose up -d
  fi

  log_info "Services restarted"
  compose ps
}

cmd_status() {
  compose ps
}

cmd_logs() {
  local service="${1:-}"

  if [[ -n "$service" ]]; then
    compose logs -f "$service"
  else
    compose logs -f
  fi
}

cmd_health() {
  require_cmd curl

  local url="http://localhost:8000/health"
  log_info "Checking health at ${url}..."

  if curl -fsS --max-time 5 "${url}" | head -c 500; then
    echo
    log_info "Health check passed"
  else
    log_error "Health check failed"
    exit 1
  fi
}

# ============================================================================
# Main
# ============================================================================

main() {
  local command="${1:-}"
  shift || true

  case "${command}" in
    start)
      cmd_start "$@"
      ;;
    stop)
      cmd_stop "$@"
      ;;
    restart)
      cmd_restart "$@"
      ;;
    status)
      cmd_status
      ;;
    logs)
      cmd_logs "$@"
      ;;
    health)
      cmd_health
      ;;
    ""|-h|--help|help)
      usage
      ;;
    *)
      log_error "Unknown command: ${command}"
      usage >&2
      exit 2
      ;;
  esac
}

main "$@"
