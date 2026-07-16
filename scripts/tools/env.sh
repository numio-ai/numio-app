#!/usr/bin/env bash
# Environment helpers for numio scripts

set -euo pipefail

# Get AWS region with fallback chain (global, not env-specific)
get_aws_region() {
  echo "${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"
}

# Get overlay directory for an environment
get_overlay_dir() {
  local env="$1"
  local project_root="$2"
  echo "${project_root}/deployment/${env}"
}

# Check if overlay exists for environment
check_overlay_exists() {
  local env="$1"
  local project_root="$2"
  local overlay_dir
  overlay_dir="$(get_overlay_dir "${env}" "${project_root}")"

  if [[ ! -d "${overlay_dir}" ]]; then
    return 1
  fi
  return 0
}

# Validate environment name (must have corresponding overlay)
# Usage: validate_env <env>
# Requires PROJECT_DIR to be set in the calling script
validate_env() {
  local env="$1"
  local project_root="${PROJECT_DIR:-$(pwd)}"

  if [[ -z "$env" ]]; then
    log_error "Environment name is required"
    return 1
  fi

  if ! check_overlay_exists "$env" "$project_root"; then
    log_error "Invalid environment: $env"
    log_error "No overlay found at: deployment/$env/"
    log_error ""
    log_error "Available environments:"
    for d in "$project_root"/deployment/*/; do
      [[ -d "$d" ]] && echo "  - $(basename "$d")"
    done
    return 1
  fi
}

deploy_env_file() {
  local env="$1"
  local project_root="$2"
  echo "$(get_overlay_dir "$env" "$project_root")/deploy.env.sh"
}

load_deploy_env() {
  # Usage: load_deploy_env <env> <project_root>
  # Sources deployment/<env>/deploy.env.sh if present.
  local env="$1"
  local project_root="$2"
  local f
  f="$(deploy_env_file "$env" "$project_root")"
  if [[ -f "$f" ]]; then
    # shellcheck source=/dev/null
    source "$f"
  fi
}

get_env_install_dir() {
  local env="$1"
  local project_root="$2"
  INSTALL_DIR=""
  load_deploy_env "$env" "$project_root"
  echo "${INSTALL_DIR:-/data/numio}"
}

get_env_base_url() {
  local env="$1"
  local project_root="$2"
  BASE_URL=""
  load_deploy_env "$env" "$project_root"
  echo "${BASE_URL:-}"
}

get_env_aws_region() {
  local env="$1"
  local project_root="$2"
  AWS_REGION=""
  load_deploy_env "$env" "$project_root"
  echo "${AWS_REGION:-$(get_aws_region)}"
}

get_env_aws_profile() {
  local env="$1"
  local project_root="$2"
  AWS_PROFILE=""
  load_deploy_env "$env" "$project_root"
  echo "${AWS_PROFILE}"
}

# Load environment file if it exists
load_env_file() {
  local env_file="$1"
  
  if [[ ! -f "${env_file}" ]]; then
    return 0
  fi
  
  # Read and export variables, ignoring comments and empty lines
  while IFS='=' read -r key value || [[ -n "${key}" ]]; do
    # Skip comments and empty lines
    [[ "${key}" =~ ^[[:space:]]*# ]] && continue
    [[ -z "${key}" ]] && continue
    
    # Remove leading/trailing whitespace
    key="${key#"${key%%[![:space:]]*}"}"
    key="${key%"${key##*[![:space:]]}"}"
    
    # Skip if key is empty after trimming
    [[ -z "${key}" ]] && continue
    
    # Remove quotes from value if present
    value="${value#\"}"
    value="${value%\"}"
    value="${value#\'}"
    value="${value%\'}"
    
    # Export the variable
    export "${key}=${value}"
  done < "${env_file}"
}

# Backwards-compat alias (older scripts)
normalize_deployment() {
  local host="$1"
  echo "$host"
}
