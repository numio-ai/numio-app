#!/usr/bin/env bash
# Common utilities for numio scripts
# Bash 3.2 compatible (macOS default)

set -euo pipefail

# Colors (if terminal supports them)
if [[ -t 1 ]]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[0;33m'
  BLUE='\033[0;34m'
  NC='\033[0m' # No Color
else
  RED=''
  GREEN=''
  YELLOW=''
  BLUE=''
  NC=''
fi

# Logging functions
log_info() {
  echo -e "${GREEN}[INFO]${NC} $*"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $*" >&2
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $*" >&2
}

log_debug() {
  if [[ "${NUMIO_DEBUG:-0}" == "1" ]]; then
    echo -e "${BLUE}[DEBUG]${NC} $*" >&2
  fi
}

# Exit with error message
die() {
  log_error "$@"
  exit 1
}

# Check if command exists
require_cmd() {
  local cmd="$1"
  if ! command -v "${cmd}" &>/dev/null; then
    die "Unsatisfied prerequisite: '${cmd}' must be installed"
  fi
}


# Check if Docker is available and running
check_docker() {
  require_cmd docker
  if ! docker info &>/dev/null; then
    die "Unsatisfied prerequisite: Docker must be installed and running"
  fi
}

# Check if docker compose is available
check_docker_compose() {
  if ! docker compose version &>/dev/null; then
    die "Unsatisfied prerequisite: Docker Compose V2 must be installed"
  fi
}

# Parse --host=VALUE flag from arguments
# Sets HOST variable
parse_host_flag() {
  HOST="${NUMIO_ENV:-localhost}"
  local args=()
  local prev_was_host_flag=0
  for arg in "$@"; do
    case "${arg}" in
      --host=*)
        HOST="${arg#*=}"
        ;;
      --host)
        prev_was_host_flag=1
        ;;
      *)
        if [[ "$prev_was_host_flag" == "1" ]]; then
          HOST="${arg}"
          prev_was_host_flag=0
          continue
        fi
        args+=("${arg}")
        ;;
    esac
  done
  # Return remaining args (use ${args[@]+...} for Bash 3.2 empty array safety)
  REMAINING_ARGS=(${args[@]+"${args[@]}"})
}

# SSH options for non-interactive connections
ssh_opts() {
  # Non-interactive + fail-fast options.
  # StrictHostKeyChecking=accept-new avoids a first-connect prompt but still fails on key mismatch.
  # LogLevel=ERROR suppresses "Permanently added..." warnings.
  echo "-o BatchMode=yes -o ConnectTimeout=15 -o ServerAliveInterval=5 -o ServerAliveCountMax=3 -o StrictHostKeyChecking=accept-new -o LogLevel=ERROR"
}

# Get project root directory
get_project_root() {
  local script_dir
  script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[1]}")" && pwd)"
  echo "${script_dir}/.."
}
