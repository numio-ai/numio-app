#!/usr/bin/env bash
# Build command implementation for numio-dev.sh
# Handles Docker image building.
#
# This file is sourced by numio-dev.sh

set -euo pipefail

build_usage() {
  cat <<'EOF'
Usage: ./scripts/numio-dev.sh build [options]
       ./scripts/numio-dev.sh build help

Build Docker images locally. Images are environment-agnostic (same image runs
in all environments). Environment differences are handled at runtime via
environment variables.

Options:
  --tag=TAG         Image tag (e.g., v1.2.3, latest)
                    Default: latest
  --service=SVC     Build single service instead of all
                    Values: backend, frontend
  help              Show this detailed help message

Image Names:
  Service 'backend'  -> Image 'numio-srv'
  Service 'frontend' -> Image 'numio-ui'

Examples:
  # Build all services with :latest tag
  ./scripts/numio-dev.sh build

  # Build with specific version tag
  ./scripts/numio-dev.sh build --tag=v1.2.3

  # Build backend only
  ./scripts/numio-dev.sh build --service=backend
EOF
}

build_main() {
  local project_dir="$1"
  shift

  if [[ "${1:-}" == "help" ]]; then
    build_usage
    return 0
  fi

  parse_tag_flag "$@"
  parse_service_flag ${REMAINING_ARGS[@]+"${REMAINING_ARGS[@]}"}

  local tag="${TAG}"
  local service="${SERVICE}"

  if [[ -n "$service" ]]; then
    validate_service "$service" || return 1
  fi

  local services="${service:-backend frontend}"

  docker_build "$project_dir" "$tag" "$service"

  local all_ok=1
  log_info "Images built:"
  for svc in $services; do
    local image_name
    image_name="$(get_local_image_name "$svc")" || continue
    if docker image inspect "${image_name}:${tag}" >/dev/null 2>&1; then
      echo "  - ${image_name}:${tag}"
    else
      log_error "  - ${image_name}:${tag} (NOT FOUND)"
      all_ok=0
    fi
  done

  if [[ "$all_ok" != "1" ]]; then
    die "Build verification failed: some images were not created"
  fi
}
