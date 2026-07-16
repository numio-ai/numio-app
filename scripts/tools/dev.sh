#!/usr/bin/env bash
# Numio Dev - Development lifecycle management
#
# Provides functions for running, stopping, and managing Numio services
# in development mode. Infra services (postgres, valkey) run as containers.
# App services (backend, frontend, worker) run natively with hot reload.
#
# Sourced by numio-dev.sh

set -euo pipefail

# ============================================================================
# Component model
# ============================================================================

# Component types: infra (container) or app (native)
INFRA_COMPONENTS="postgres valkey"
APP_COMPONENTS="backend frontend worker"
ALL_COMPONENTS="postgres valkey backend frontend worker"

# Runtime state directories
DEV_PID_DIR="${PROJECT_DIR}/.numio/pids"
DEV_LOG_DIR="${PROJECT_DIR}/.numio/logs"

# Ensure runtime directories exist
_ensure_runtime_dirs() {
  mkdir -p "$DEV_PID_DIR" "$DEV_LOG_DIR"
}

# Get the dependencies for an app component
# Returns space-separated list of infra components
_component_deps() {
  local component="$1"
  case "$component" in
    backend)  echo "postgres valkey" ;;
    worker)   echo "postgres" ;;
    frontend) echo "" ;;
    *)        echo "" ;;
  esac
}

# Check if a component name is valid
_validate_component() {
  local component="$1"
  case "$component" in
    backend|frontend|worker|postgres|valkey|infra|all) return 0 ;;
    *) return 1 ;;
  esac
}

# Expand aliases (infra, all) into individual components
_expand_components() {
  local result=""
  for arg in "$@"; do
    case "$arg" in
      infra) result="$result $INFRA_COMPONENTS" ;;
      all)   result="$result $ALL_COMPONENTS" ;;
      *)     result="$result $arg" ;;
    esac
  done
  echo "$result" | xargs  # trim whitespace
}

# Check if a component is infra type
_is_infra() {
  local component="$1"
  case "$component" in
    postgres|valkey) return 0 ;;
    *) return 1 ;;
  esac
}

# ============================================================================
# Docker Compose helpers (for infra components)
# ============================================================================

_compose() {
  check_docker
  check_docker_compose
  cd "${PROJECT_DIR}"
  docker compose "$@"
}

# Check if an infra container is running
_is_container_running() {
  local service="$1"
  cd "${PROJECT_DIR}"
  local status
  status="$(docker compose ps --status running --format '{{.Service}}' 2>/dev/null || true)"
  echo "$status" | grep -qw "$service"
}

# Start infra components if not already running
_ensure_infra() {
  local deps="$1"
  [[ -z "$deps" ]] && return 0

  local to_start=""
  for dep in $deps; do
    if ! _is_container_running "$dep"; then
      to_start="$to_start $dep"
    fi
  done

  if [[ -n "$to_start" ]]; then
    log_info "Starting infrastructure:$to_start"
    _compose up -d $to_start
    # Wait for healthy
    for dep in $to_start; do
      log_info "Waiting for $dep to be ready..."
      local attempts=0
      while ! _is_container_running "$dep"; do
        attempts=$((attempts + 1))
        if [[ $attempts -ge 30 ]]; then
          die "$dep failed to start within 30 seconds"
        fi
        sleep 1
      done
    done
  fi
}

# ============================================================================
# PID management (for app components)
# ============================================================================

_pid_file() {
  echo "${DEV_PID_DIR}/${1}.pid"
}

_log_file() {
  echo "${DEV_LOG_DIR}/${1}.log"
}

_read_pid() {
  local pidfile
  pidfile="$(_pid_file "$1")"
  if [[ -f "$pidfile" ]]; then
    cat "$pidfile"
  fi
}

_is_pid_alive() {
  local pid="$1"
  [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

# Recursively send a signal to a pid and all of its descendants.
# Needed because wrappers like `npm run dev` spawn child processes
# (e.g. vite/node) that keep the listening socket alive even after the
# wrapper is killed, leaving orphans that occupy ports (e.g. 5173).
_kill_tree() {
  local pid="$1"
  local sig="${2:-TERM}"
  [[ -z "$pid" ]] && return 0
  local children
  children="$(pgrep -P "$pid" 2>/dev/null || true)"
  for child in $children; do
    _kill_tree "$child" "$sig"
  done
  kill -"$sig" "$pid" 2>/dev/null || true
}

# Check whether a TCP port is in use on localhost.
_is_port_in_use() {
  local port="$1"
  lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
}

# Return the PID of whatever is listening on a TCP port (first match).
_pid_on_port() {
  local port="$1"
  lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null | head -n1
}

_is_app_running() {
  local component="$1"
  local pid
  pid="$(_read_pid "$component")"
  if _is_pid_alive "$pid"; then
    return 0
  else
    # Clean up stale PID file
    rm -f "$(_pid_file "$component")"
    return 1
  fi
}

# Map a component to the TCP port it listens on (empty if none).
# Reads the worktree-scoped port map exported by worktree_load_env.
_component_port() {
  case "$1" in
    backend)  echo "${BACKEND_HOST_PORT:-8000}" ;;
    frontend) echo "${FRONTEND_DEV_PORT:-5173}" ;;
    *)        echo "" ;;
  esac
}

# Fail fast if the port a component needs is already bound by something
# we don't manage (e.g. an orphaned vite/node from a previous session).
_check_component_port_free() {
  local component="$1"
  local port
  port="$(_component_port "$component")"
  [[ -z "$port" ]] && return 0
  if _is_port_in_use "$port"; then
    local other_pid
    other_pid="$(_pid_on_port "$port")"
    die "Cannot start $component: port $port is already in use by PID ${other_pid:-unknown}.
This is typically an orphaned process from a previous session.
Kill it with: kill ${other_pid:-<pid>}    (or: kill -9 ${other_pid:-<pid>} if it ignores SIGTERM)"
  fi
}

_write_pid() {
  local component="$1" pid="$2"
  _ensure_runtime_dirs
  echo "$pid" > "$(_pid_file "$component")"
}

_remove_pid() {
  rm -f "$(_pid_file "$1")"
}

# ============================================================================
# Run — start components
# ============================================================================

# Run an app component in the foreground (single-component mode)
_run_app_foreground() {
  local component="$1"
  _ensure_runtime_dirs

  # Auto-start infra dependencies
  local deps
  deps="$(_component_deps "$component")"
  _ensure_infra "$deps"

  # Check if already running (backgrounded from a previous run all)
  if _is_app_running "$component"; then
    local pid
    pid="$(_read_pid "$component")"
    die "$component is already running (PID $pid). Stop it first: numio-dev.sh stop $component"
  fi

  # Surface port conflicts from orphan processes with an actionable error.
  _check_component_port_free "$component"

  # Write PID before exec (exec preserves the PID)
  _write_pid "$component" "$$"

  # Trap to clean up PID file on exit
  trap '_remove_pid "'"$component"'"' EXIT

  # Export the worktree's connection strings so pydantic-settings picks them
  # up instead of the .env / defaults. Native services launched from here must
  # reach the Postgres/Valkey bound to this worktree's ports, which may differ
  # from the classic 5432/6379 when a sibling worktree claimed them first.
  export DATABASE_URL VALKEY_URL FRONTEND_PORT BACKEND_PROXY_TARGET
  DATABASE_URL="$(worktree_database_url)"
  VALKEY_URL="$(worktree_valkey_url)"
  FRONTEND_PORT="${FRONTEND_DEV_PORT}"
  BACKEND_PROXY_TARGET="http://localhost:${BACKEND_HOST_PORT}"

  case "$component" in
    backend)
      require_cmd uv
      log_info "Starting backend (port ${BACKEND_HOST_PORT}, hot reload)..."
      cd "${PROJECT_DIR}/backend"
      exec uv run uvicorn numio.main:app --reload --port "${BACKEND_HOST_PORT}"
      ;;
    frontend)
      require_cmd npm
      log_info "Starting frontend (port ${FRONTEND_DEV_PORT}, hot reload)..."
      cd "${PROJECT_DIR}/frontend"
      exec npm run dev -- --port "${FRONTEND_DEV_PORT}"
      ;;
    worker)
      require_cmd uv
      log_info "Starting worker..."
      cd "${PROJECT_DIR}/backend"
      exec uv run python -m numio.worker
      ;;
  esac
}

# Run an app component in the background (used by run all)
_run_app_background() {
  local component="$1"
  _ensure_runtime_dirs

  if _is_app_running "$component"; then
    local pid
    pid="$(_read_pid "$component")"
    log_warn "$component is already running (PID $pid)"
    return 0
  fi

  # Surface port conflicts from orphan processes with an actionable error.
  _check_component_port_free "$component"

  local logfile
  logfile="$(_log_file "$component")"

  # Export the worktree's connection strings so pydantic-settings picks them
  # up instead of the .env / defaults. See _run_app_foreground for rationale.
  export DATABASE_URL VALKEY_URL FRONTEND_PORT BACKEND_PROXY_TARGET
  DATABASE_URL="$(worktree_database_url)"
  VALKEY_URL="$(worktree_valkey_url)"
  FRONTEND_PORT="${FRONTEND_DEV_PORT}"
  BACKEND_PROXY_TARGET="http://localhost:${BACKEND_HOST_PORT}"

  # Use nohup + </dev/null so processes survive parent script exit / terminal close
  case "$component" in
    backend)
      require_cmd uv
      log_info "Starting backend (background, port ${BACKEND_HOST_PORT})..."
      cd "${PROJECT_DIR}/backend"
      nohup uv run uvicorn numio.main:app --reload --port "${BACKEND_HOST_PORT}" > "$logfile" 2>&1 </dev/null &
      ;;
    frontend)
      require_cmd npm
      log_info "Starting frontend (background, port ${FRONTEND_DEV_PORT})..."
      cd "${PROJECT_DIR}/frontend"
      nohup npm run dev -- --port "${FRONTEND_DEV_PORT}" > "$logfile" 2>&1 </dev/null &
      ;;
    worker)
      require_cmd uv
      log_info "Starting worker (background)..."
      cd "${PROJECT_DIR}/backend"
      nohup uv run python -m numio.worker > "$logfile" 2>&1 </dev/null &
      ;;
  esac

  local pid=$!
  _write_pid "$component" "$pid"
  log_info "$component started (PID $pid, log: $logfile)"
}

# Run infra component (always container)
_run_infra() {
  local component="$1"
  if _is_container_running "$component"; then
    log_info "$component is already running"
    return 0
  fi
  log_info "Starting $component (container)..."
  _compose up -d "$component"
}

# Open the frontend dev URL in the default browser once it is reachable.
# Silently no-ops on non-macOS (logs the URL instead); silently no-ops when
# suppressed via --no-browser, NUMIO_NO_BROWSER=1, CI, or a non-TTY stdout.
_open_frontend_url() {
  local no_browser="$1"
  local url="http://localhost:${FRONTEND_DEV_PORT}"

  if [[ "$no_browser" == "1" ]] || [[ -n "${NUMIO_NO_BROWSER:-}" ]] || [[ -n "${CI:-}" ]] || [[ ! -t 1 ]]; then
    log_info "Frontend URL: ${url}"
    return 0
  fi

  # Vite needs a moment to bind. Poll for readiness so the browser does not
  # land on a connection-refused page. If the server never becomes reachable
  # (e.g. it crashed during startup), do not open the browser — just print
  # the URL so the operator can investigate.
  local attempts=0
  local ready=0
  while [[ $attempts -lt 20 ]]; do
    if curl -fsS --max-time 1 -o /dev/null "$url" 2>/dev/null; then
      ready=1
      break
    fi
    sleep 0.5
    attempts=$((attempts + 1))
  done

  if [[ $ready -ne 1 ]]; then
    log_warn "Frontend did not become reachable at ${url}; not opening browser."
    return 0
  fi

  if [[ "$(uname -s)" == "Darwin" ]]; then
    log_info "Opening ${url} in your browser..."
    open "$url" >/dev/null 2>&1 || log_info "Frontend URL: ${url}"
  else
    log_info "Frontend URL: ${url}"
  fi
}

# Main run command
dev_run() {
  # Parse --no-browser before component validation so the flag is not mistaken
  # for a component name. Only relevant to the multi-component background path.
  local no_browser=0
  local api_mode_mock=0
  local raw_args=("$@")
  local components=()
  for arg in "${raw_args[@]}"; do
    case "$arg" in
      --no-browser) no_browser=1 ;;
      --mock) api_mode_mock=1 ;;
      *) components+=("$arg") ;;
    esac
  done

  if [[ ${#components[@]} -eq 0 ]]; then
    die "Usage: numio-dev.sh run [--no-browser] [--mock] <component...>
Components: backend, frontend, worker, postgres, valkey, infra, all"
  fi

  # --mock selects the frontend's backend-free mock data source. Exported here
  # so the `npm run dev` child (foreground or background) inherits it; only the
  # frontend reads VITE_API_MODE. See docs/dev-runbook.md -> "Frontend mock mode".
  if [[ "$api_mode_mock" == "1" ]]; then
    export VITE_API_MODE=mock
    log_info "Mock mode on: frontend serves synthetic data (VITE_API_MODE=mock); no backend needed."
  fi

  # Validate all components
  for c in "${components[@]}"; do
    _validate_component "$c" || die "Invalid component: $c. Valid: backend, frontend, worker, postgres, valkey, infra, all"
  done

  # Expand aliases
  local expanded
  expanded="$(_expand_components "${components[@]}")"

  # Deduplicate (preserving order)
  local seen="" unique=""
  for c in $expanded; do
    if ! echo "$seen" | grep -qw "$c"; then
      seen="$seen $c"
      unique="$unique $c"
    fi
  done
  expanded="$(echo "$unique" | xargs)"

  # Split into infra and app
  local infra_list="" app_list=""
  for c in $expanded; do
    if _is_infra "$c"; then
      infra_list="$infra_list $c"
    else
      app_list="$app_list $c"
    fi
  done
  infra_list="$(echo "$infra_list" | xargs)"
  app_list="$(echo "$app_list" | xargs)"

  # Count total app components to decide foreground vs background
  local app_count=0
  for _ in $app_list; do
    app_count=$((app_count + 1))
  done

  # Start infra first
  if [[ -n "$infra_list" ]]; then
    _ensure_infra "$infra_list"
  fi

  # If only infra was requested, we're done
  [[ -z "$app_list" ]] && return 0

  # Single app component: run in foreground
  if [[ $app_count -eq 1 ]]; then
    # Auto-start infra deps for this component (in addition to any explicit infra)
    _run_app_foreground "$app_list"
    return
  fi

  # Multiple app components: background all, multiplex output
  # First ensure all infra deps are met
  for c in $app_list; do
    local deps
    deps="$(_component_deps "$c")"
    _ensure_infra "$deps"
  done

  # Start all in background, then return control to the shell.
  # Services run detached (nohup + stdin from /dev/null) so they survive
  # terminal close. Use `numio-dev.sh log -f` to follow output and
  # `numio-dev.sh stop all` to stop them.
  for c in $app_list; do
    _run_app_background "$c"
  done

  log_info "All services started in background."
  log_info "  View logs:  ./scripts/numio-dev.sh log -f"
  log_info "  Status:     ./scripts/numio-dev.sh status"
  log_info "  Stop all:   ./scripts/numio-dev.sh stop all"

  # Auto-open the UI when frontend was part of this invocation. The script
  # already knows the worktree's port, so the operator never has to look it up.
  # Suppress with --no-browser, NUMIO_NO_BROWSER=1, or a non-interactive shell.
  if echo " $app_list " | grep -q ' frontend '; then
    _open_frontend_url "$no_browser"
  fi
}

# ============================================================================
# Stop — stop components
# ============================================================================

_stop_app() {
  local component="$1"
  local pid
  pid="$(_read_pid "$component")"

  if ! _is_pid_alive "$pid"; then
    _remove_pid "$component"
    log_info "$component is not running"
    return 0
  fi

  log_info "Stopping $component (PID $pid)..."
  _kill_tree "$pid" TERM

  # Wait up to 5 seconds for graceful shutdown of the parent.
  local attempts=0
  while _is_pid_alive "$pid" && [[ $attempts -lt 10 ]]; do
    sleep 0.5
    attempts=$((attempts + 1))
  done

  # Force-kill the whole tree if anything is still alive.
  if _is_pid_alive "$pid"; then
    log_warn "$component did not stop gracefully, sending SIGKILL..."
    _kill_tree "$pid" KILL
  fi

  _remove_pid "$component"
  log_info "$component stopped"
}

_stop_infra() {
  local component="$1"
  if ! _is_container_running "$component"; then
    log_info "$component is not running"
    return 0
  fi
  log_info "Stopping $component (container)..."
  _compose stop "$component"
  log_info "$component stopped"
}

dev_stop() {
  local components=("$@")

  if [[ ${#components[@]} -eq 0 ]]; then
    die "Usage: numio-dev.sh stop <component...>
Components: backend, frontend, worker, postgres, valkey, infra, all"
  fi

  for c in "${components[@]}"; do
    _validate_component "$c" || die "Invalid component: $c"
  done

  local expanded
  expanded="$(_expand_components "${components[@]}")"

  for c in $expanded; do
    if _is_infra "$c"; then
      _stop_infra "$c"
    else
      _stop_app "$c"
    fi
  done
}

# ============================================================================
# Status — show what's running
# ============================================================================

dev_status() {
  _ensure_runtime_dirs

  # Header: show which worktree stack this invocation is acting on. Switching
  # terminals between worktrees is cheap to do and expensive to get wrong, so
  # the project name + bound ports + URLs are printed up front. The `name=port`
  # tokens are kept for grep-compatibility with earlier output.
  local backend_port="${BACKEND_HOST_PORT:-?}"
  local frontend_port="${FRONTEND_DEV_PORT:-?}"
  local postgres_port="${POSTGRES_HOST_PORT:-?}"
  local valkey_port="${VALKEY_HOST_PORT:-?}"
  echo "Worktree stack:"
  printf "  project=%s\n" "${COMPOSE_PROJECT_NAME:-?}"
  printf "  %-22s %s\n" "backend=${backend_port}"       "http://localhost:${backend_port}       (health: /health, docs: /docs)"
  printf "  %-22s %s\n" "frontend(dev)=${frontend_port}" "http://localhost:${frontend_port}"
  printf "  %-22s %s\n" "postgres=${postgres_port}"     "localhost:${postgres_port}"
  printf "  %-22s %s\n\n" "valkey=${valkey_port}"       "localhost:${valkey_port}"

  printf "%-12s %-10s %-10s %s\n" "COMPONENT" "MODE" "STATUS" "DETAILS"
  printf "%-12s %-10s %-10s %s\n" "---------" "----" "------" "-------"

  for c in $ALL_COMPONENTS; do
    local mode status details
    if _is_infra "$c"; then
      mode="container"
      if _is_container_running "$c"; then
        status="running"
        # Get container name
        details="$(docker compose ps --format '{{.Name}}' "$c" 2>/dev/null | head -1 || echo "-")"
      else
        status="stopped"
        details="-"
      fi
    else
      mode="native"
      local pid
      pid="$(_read_pid "$c")"
      if _is_pid_alive "$pid"; then
        status="running"
        details="PID $pid"
      else
        _remove_pid "$c"
        status="stopped"
        details="-"
      fi
    fi
    printf "%-12s %-10s %-10s %s\n" "$c" "$mode" "$status" "$details"
  done
}

# ============================================================================
# Log — show recent logs (default: last page, exit; -f/--follow to stream)
# ============================================================================

# Default number of lines for the non-follow "last page" view and the seed
# window in follow mode. Tuned to fit a typical terminal without flooding.
LOG_TAIL_LINES=200

dev_log() {
  local follow=0
  local components=()

  # Parse -f/--follow anywhere; remaining args are components.
  for arg in "$@"; do
    case "$arg" in
      -f|--follow) follow=1 ;;
      *) components+=("$arg") ;;
    esac
  done

  # Default to all components if none specified
  if [[ ${#components[@]} -eq 0 ]]; then
    components=($ALL_COMPONENTS)
  fi

  for c in "${components[@]}"; do
    _validate_component "$c" || die "Invalid component: $c"
  done

  local expanded
  expanded="$(_expand_components "${components[@]}")"

  # Separate infra and app
  local infra_list="" app_logfiles=""
  for c in $expanded; do
    if _is_infra "$c"; then
      infra_list="$infra_list $c"
    else
      local lf
      lf="$(_log_file "$c")"
      if [[ -f "$lf" ]]; then
        app_logfiles="$app_logfiles $lf"
      elif _is_app_running "$c"; then
        log_warn "$c is running in a foreground terminal (no log file)"
      fi
    fi
  done
  infra_list="$(echo "$infra_list" | xargs)"
  app_logfiles="$(echo "$app_logfiles" | xargs)"

  if [[ -z "$infra_list" ]] && [[ -z "$app_logfiles" ]]; then
    log_info "No logs available. Are any services running?"
    return 0
  fi

  # stderr is merged into stdout on every child invocation so a single
  # `| grep` filters every line — container log output that docker writes
  # on stderr would otherwise bypass the pipe.
  if [[ $follow -eq 1 ]]; then
    if [[ -n "$infra_list" ]] && [[ -z "$app_logfiles" ]]; then
      _compose logs --tail="$LOG_TAIL_LINES" -f $infra_list 2>&1
    elif [[ -z "$infra_list" ]] && [[ -n "$app_logfiles" ]]; then
      tail -n "$LOG_TAIL_LINES" -f $app_logfiles 2>&1
    else
      _compose logs --tail="$LOG_TAIL_LINES" -f $infra_list 2>&1 &
      local compose_pid=$!
      trap "kill $compose_pid 2>/dev/null || true" EXIT
      tail -n "$LOG_TAIL_LINES" -f $app_logfiles 2>&1
    fi
  else
    if [[ -n "$infra_list" ]]; then
      _compose logs --tail="$LOG_TAIL_LINES" $infra_list 2>&1
    fi
    if [[ -n "$app_logfiles" ]]; then
      tail -n "$LOG_TAIL_LINES" $app_logfiles 2>&1
    fi
  fi
}

# ============================================================================
# Restart — soft restart (restart process, keep state)
# ============================================================================

dev_restart() {
  local components=("$@")

  if [[ ${#components[@]} -eq 0 ]]; then
    die "Usage: numio-dev.sh restart <component...>
Components: backend, frontend, worker, postgres, valkey, infra, all"
  fi

  for c in "${components[@]}"; do
    _validate_component "$c" || die "Invalid component: $c"
  done

  local expanded
  expanded="$(_expand_components "${components[@]}")"

  for c in $expanded; do
    if _is_infra "$c"; then
      log_info "Restarting $c (container)..."
      _compose restart "$c"
    else
      if _is_app_running "$c"; then
        _stop_app "$c"
        _run_app_background "$c"
      else
        log_info "$c is not running, starting it..."
        _run_app_background "$c"
      fi
    fi
  done
}

# ============================================================================
# Rebuild — hard restart (rebuild containers, force-recreate, re-migrate)
# ============================================================================

dev_rebuild() {
  local components=("$@")

  if [[ ${#components[@]} -eq 0 ]]; then
    die "Usage: numio-dev.sh rebuild <component...>
Components: backend, frontend, worker, postgres, valkey, infra, all"
  fi

  for c in "${components[@]}"; do
    _validate_component "$c" || die "Invalid component: $c"
  done

  local expanded
  expanded="$(_expand_components "${components[@]}")"

  local has_infra=0 has_app=0

  for c in $expanded; do
    if _is_infra "$c"; then
      has_infra=1
      log_info "Rebuilding $c (container)..."
      _compose up -d --build --force-recreate "$c"
    else
      has_app=1
      if _is_app_running "$c"; then
        _stop_app "$c"
      fi
    fi
  done

  # Re-run migrations if infra or backend/worker were rebuilt
  if [[ $has_infra -eq 1 ]] || [[ $has_app -eq 1 ]]; then
    # Wait for postgres to be ready
    if _is_container_running "postgres"; then
      log_info "Running migrations..."
      dev_migrate
    fi
  fi

  # Restart app components that were stopped
  for c in $expanded; do
    if ! _is_infra "$c"; then
      _run_app_background "$c"
    fi
  done
}

# ============================================================================
# Nuke — destroy this worktree's stack and all of its data
# ============================================================================

# Tear down this worktree's Compose project: stop all containers, remove
# network and named volume, kill any native processes, delete the port-map
# file. Explicitly scoped to $COMPOSE_PROJECT_NAME so a sibling worktree's
# stack cannot be affected even if it happens to share container names with
# the legacy layout.
dev_nuke() {
  local assume_yes=0
  for arg in "$@"; do
    case "$arg" in
      -y|--yes) assume_yes=1 ;;
      *) die "Usage: numio-dev.sh nuke [-y|--yes]" ;;
    esac
  done

  local project="${COMPOSE_PROJECT_NAME:-?}"
  log_warn "This will DESTROY this worktree's stack:"
  log_warn "  project:  ${project}"
  log_warn "  volume:   ${project}_pgdata (ALL cost data, accounts, schema)"
  log_warn "  network:  ${project}_default"
  log_warn "  env file: ${WORKTREE_ENV_FILE}"
  log_warn "Sibling worktrees are not affected."

  if [[ $assume_yes -ne 1 ]]; then
    # Read from the controlling terminal so the prompt still works when the
    # script is piped (rare for nuke, but cheap to support).
    local reply
    printf "Type the project name to confirm: "
    read -r reply </dev/tty || reply=""
    if [[ "$reply" != "$project" ]]; then
      log_info "Aborted. Nothing destroyed."
      return 0
    fi
  fi

  # Stop native app processes first — they hold DB connections that would
  # otherwise keep the Postgres volume busy during `down -v`.
  for c in $APP_COMPONENTS; do
    if _is_app_running "$c"; then
      _stop_app "$c"
    fi
  done

  log_info "Tearing down Compose project ${project}..."
  _compose down -v --remove-orphans

  if [[ -f "$WORKTREE_ENV_FILE" ]]; then
    rm -f "$WORKTREE_ENV_FILE"
    log_info "Removed ${WORKTREE_ENV_FILE}"
  fi

  log_info "Nuke complete. Run 'numio-dev.sh run …' to start fresh."
}

# ============================================================================
# Migrate — run alembic upgrade head
# ============================================================================

dev_migrate() {
  require_cmd uv

  # Ensure postgres is running
  if ! _is_container_running "postgres"; then
    log_info "Starting postgres for migration..."
    _ensure_infra "postgres"
  fi

  # Point alembic at this worktree's Postgres. Without this, a parallel worktree
  # holding port 5432 silently wins and migrations land in the wrong database.
  export DATABASE_URL
  DATABASE_URL="$(worktree_database_url)"

  log_info "Running database migrations..."
  cd "${PROJECT_DIR}/backend"
  uv run alembic upgrade head
  log_info "Migrations complete"
}

# ============================================================================
# Seed — insert the default workspace row
# ============================================================================
#
# Idempotent. Required once per worktree after `migrate`, because
# backend auth bypass (`AUTH_ENABLED=false`) resolves the synthetic admin
# against `workspaces.slug = 'default'`. Without the row, GET /api/v1/auth/me
# returns 500 and the frontend falls back to the Cognito login page.
#
# Kept out of `run` and `migrate` on purpose — dev tools do not silently mutate
# application data.

dev_seed() {
  if ! _is_container_running "postgres"; then
    die "postgres is not running. Start it first: numio-dev.sh run infra"
  fi

  local container
  container="$(_compose ps -q postgres 2>/dev/null | head -n1)"
  if [[ -z "$container" ]]; then
    die "Could not find the postgres container for this worktree."
  fi

  log_info "Seeding default workspace..."
  docker exec "$container" psql -U numio -d numio -v ON_ERROR_STOP=1 -c \
    "INSERT INTO workspaces (id, name, slug) VALUES (gen_random_uuid(), 'default', 'default') ON CONFLICT (slug) DO NOTHING;" \
    >/dev/null
  log_info "Seed complete (default workspace present)."
}

# ============================================================================
# Health — backend health check
# ============================================================================

dev_health() {
  require_cmd curl

  local url="http://localhost:${BACKEND_HOST_PORT:-8000}/health"
  log_info "Checking health at ${url}..."

  if curl -fsS --max-time 5 "${url}" 2>/dev/null; then
    echo
    log_info "Health check passed"
  else
    log_error "Health check failed (is the backend running?)"
    exit 1
  fi
}
