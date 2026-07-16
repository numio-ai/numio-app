#!/usr/bin/env bash
# Docker build helpers for numio scripts
# Handles image building, tagging, and compose operations

set -euo pipefail

# Default image tag (matches Docker CLI behavior)
DEFAULT_IMAGE_TAG="latest"

# Get local image name for a service
# Usage: get_local_image_name <service>
get_local_image_name() {
  local service="$1"
  case "$service" in
    backend)
      echo "numio-srv"
      ;;
    frontend)
      echo "numio-ui"
      ;;
    *)
      log_error "Unknown service: $service"
      return 1
      ;;
  esac
}

# Build Docker images using docker compose
# Usage: docker_build <project_dir> [tag] [service]
# Builds environment-agnostic images (same image runs in all environments)
docker_build() {
  local project_dir="$1"
  local tag="${2:-${DEFAULT_IMAGE_TAG}}"
  local service="${3:-}"

  check_docker
  check_docker_compose

  log_info "Building Docker images (tag=$tag)..."

  cd "$project_dir"

  # Build with the base compose file, which contains the build directives.
  local compose_cmd="docker compose -f docker-compose.yml build"

  if [[ -n "$service" ]]; then
    compose_cmd="$compose_cmd $service"
  fi

  eval "$compose_cmd" || {
    log_error "Docker build failed"
    return 1
  }

  # Tag images with the specified tag
  docker_tag_images "$tag" "$service"

  log_info "Build complete"
}

# Tag built images with the specified tag
# Usage: docker_tag_images <tag> [service]
# Note: docker-compose.yml has explicit image: directives (numio-srv:latest, numio-ui:latest)
# so compose builds with correct names. We only need to retag if tag != latest.
docker_tag_images() {
  local tag="$1"
  local service="${2:-}"

  # If tag is 'latest', compose already built with correct name - nothing to do
  if [[ "$tag" == "latest" ]]; then
    log_debug "Tag is 'latest', skipping retag (compose built with correct names)"
    return 0
  fi

  local services
  if [[ -n "$service" ]]; then
    services="$service"
  else
    services="backend frontend"
  fi

  for svc in $services; do
    local image_name
    image_name="$(get_local_image_name "$svc")" || continue

    # Verify the :latest image exists (built by compose)
    if ! docker image inspect "${image_name}:latest" >/dev/null 2>&1; then
      log_error "Image not found: ${image_name}:latest"
      log_error "Docker compose build may have failed."
      return 1
    fi

    # Tag from :latest to requested tag
    log_debug "Tagging ${image_name}:latest as ${image_name}:${tag}"
    docker tag "${image_name}:latest" "${image_name}:${tag}" || {
      log_error "Failed to tag ${image_name}:${tag}"
      return 1
    }
  done
}

# Parse --tag flag from arguments
# Usage: parse_tag_flag "$@"
# Sets TAG variable, defaults to DEFAULT_IMAGE_TAG
parse_tag_flag() {
  TAG="${DEFAULT_IMAGE_TAG}"
  local args=()
  local prev_was_tag_flag=0
  for arg in "$@"; do
    case "${arg}" in
      --tag=*)
        TAG="${arg#*=}"
        ;;
      --tag)
        prev_was_tag_flag=1
        ;;
      *)
        if [[ "$prev_was_tag_flag" == "1" ]]; then
          TAG="${arg}"
          prev_was_tag_flag=0
          continue
        fi
        args+=("${arg}")
        ;;
    esac
  done
  REMAINING_ARGS=(${args[@]+"${args[@]}"})
}

# Parse --service flag from arguments
# Usage: parse_service_flag "$@"
# Sets SERVICE variable (empty if not specified)
parse_service_flag() {
  SERVICE=""
  local args=()
  local prev_was_service_flag=0
  for arg in "$@"; do
    case "${arg}" in
      --service=*)
        SERVICE="${arg#*=}"
        ;;
      --service)
        prev_was_service_flag=1
        ;;
      *)
        if [[ "$prev_was_service_flag" == "1" ]]; then
          SERVICE="${arg}"
          prev_was_service_flag=0
          continue
        fi
        args+=("${arg}")
        ;;
    esac
  done
  REMAINING_ARGS=(${args[@]+"${args[@]}"})
}

# Validate service name
# Usage: validate_service <service>
validate_service() {
  local service="$1"
  case "$service" in
    backend|frontend|"")
      return 0
      ;;
    *)
      log_error "Invalid service: $service. Valid values: backend, frontend"
      return 1
      ;;
  esac
}
