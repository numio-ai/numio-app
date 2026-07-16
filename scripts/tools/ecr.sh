#!/usr/bin/env bash
# ECR operations for numio scripts
# Handles ECR authentication, tagging, and push operations

set -euo pipefail

# ECR repository names (must match infra setup)
ECR_REPO_BACKEND="numio-srv"
ECR_REPO_FRONTEND="numio-ui"

# ECR primary region - images are pushed here and replicated automatically
# AWS ECR replication handles distribution to: us-east-2, us-west-1, us-west-2
ECR_PRIMARY_REGION="us-east-1"

# Get ECR registry URL for the current AWS account
# Usage: get_ecr_registry <region>
get_ecr_registry() {
  local region="${1:-$(get_aws_region)}"
  
  local account_id
  account_id="$(aws sts get-caller-identity --query Account --output text 2>/dev/null)" || {
    log_error "Failed to get AWS account ID using profile '${AWS_PROFILE:-<default>}'."
    log_error ""
    log_error "Check if credentials are valid:"
    log_error "  aws sts get-caller-identity --profile ${AWS_PROFILE:-numio-prod}"
    log_error ""
    log_error "If expired, refresh SSO login:"
    log_error "  ../infra/scripts/aws-admin.sh sso login"
    return 1
  }
  
  echo "${account_id}.dkr.ecr.${region}.amazonaws.com"
}

# Get full ECR image URI
# Usage: get_ecr_image_uri <service> <tag> [region]
get_ecr_image_uri() {
  local service="$1"
  local tag="$2"
  local region="${3:-$(get_aws_region)}"
  local registry repo

  registry="$(get_ecr_registry "$region")" || return 1

  case "$service" in
    backend)
      repo="${ECR_REPO_BACKEND}"
      ;;
    frontend)
      repo="${ECR_REPO_FRONTEND}"
      ;;
    *)
      log_error "Unknown service: $service"
      return 1
      ;;
  esac

  echo "${registry}/${repo}:${tag}"
}

# Authenticate with ECR (legacy - prefer using docker-credential-ecr-login)
# Usage: ecr_login [region]
#
# Note: If ~/.docker/config.json has credHelpers configured for ECR registries,
# authentication is handled automatically by docker-credential-ecr-login.
# This function is kept for environments without the credential helper.
ecr_login() {
  local region="${1:-$(get_aws_region)}"
  local registry

  registry="$(get_ecr_registry "$region")" || return 1

  log_info "Authenticating with ECR (region=$region)..."
  aws ecr get-login-password --region "$region" | \
    docker login --username AWS --password-stdin "$registry" >/dev/null 2>&1 || {
    log_error "ECR login failed. Check AWS credentials and ECR access."
    return 1
  }
  log_debug "ECR login successful"
}

# Push a single image to ECR
# Usage: ecr_push_image <local_image> <ecr_uri>
ecr_push_image() {
  local local_image="$1"
  local ecr_uri="$2"

  # Check if local image exists
  if ! docker image inspect "$local_image" >/dev/null 2>&1; then
    log_error "Local image not found: $local_image"
    log_error ""
    log_error "Build the image first:"
    log_error "  ./scripts/numio-dev.sh build --tag=${local_image##*:}"
    log_error ""
    log_error "Then retry the push."
    return 1
  fi

  log_info "Tagging ${local_image} -> ${ecr_uri}"
  docker tag "$local_image" "$ecr_uri" || {
    log_error "Failed to tag image: $local_image"
    return 1
  }

  log_info "Pushing ${ecr_uri}..."
  docker push "$ecr_uri" || {
    log_error "Failed to push image: $ecr_uri"
    return 1
  }
}

# Push images to ECR (single region) - tags immediately before push
# Usage: ecr_push_to_region <tag> <region> [service]
# If service is omitted, pushes both backend and frontend
ecr_push_to_region() {
  local tag="$1"
  local region="$2"
  local service="${3:-}"

  local services
  if [[ -n "$service" ]]; then
    services="$service"
  else
    services="backend frontend"
  fi

  for svc in $services; do
    local local_image ecr_uri
    case "$svc" in
      backend)
        local_image="${ECR_REPO_BACKEND}:${tag}"
        ;;
      frontend)
        local_image="${ECR_REPO_FRONTEND}:${tag}"
        ;;
    esac

    ecr_uri="$(get_ecr_image_uri "$svc" "$tag" "$region")" || return 1

    # Tag immediately before push to avoid tag corruption issues
    docker tag "$local_image" "$ecr_uri" || {
      log_error "Failed to tag ${local_image} -> ${ecr_uri}"
      return 1
    }

    log_info "Pushing ${ecr_uri}..."
    docker push "$ecr_uri" || {
      log_error "Failed to push image: $ecr_uri"
      return 1
    }
  done
}

# Push images to ECR (primary region only, replication handles other regions)
# Usage: ecr_push <tag> [service]
# If service is omitted, pushes both backend and frontend
#
# Images are pushed to us-east-1. AWS ECR replication automatically
# distributes to us-east-2, us-west-1, us-west-2.
#
# Requires: docker-credential-ecr-login configured in ~/.docker/config.json
ecr_push() {
  local tag="$1"
  local service="${2:-}"

  require_cmd aws
  require_cmd docker

  # Validate tag format
  if [[ -z "$tag" ]]; then
    log_error "Tag is required for ECR push"
    return 1
  fi

  # Determine services to push
  local services
  if [[ -n "$service" ]]; then
    services="$service"
  else
    services="backend frontend"
  fi

  # Check local images exist before starting push
  for svc in $services; do
    local local_image
    case "$svc" in
      backend)
        local_image="${ECR_REPO_BACKEND}:${tag}"
        ;;
      frontend)
        local_image="${ECR_REPO_FRONTEND}:${tag}"
        ;;
    esac

    if ! docker image inspect "$local_image" >/dev/null 2>&1; then
      log_error "Local image not found: $local_image"
      log_error ""
      log_error "Build the image first:"
      log_error "  ./scripts/numio-dev.sh build --tag=${tag}"
      log_error ""
      log_error "Then retry the push."
      return 1
    fi
  done

  log_info "Pushing to ECR (${ECR_PRIMARY_REGION}, replication handles other regions)..."

  if ecr_push_to_region "$tag" "$ECR_PRIMARY_REGION" "$service"; then
    log_info "Push complete. Replication will distribute to other regions."
    return 0
  else
    log_error "Push failed"
    return 1
  fi
}

# Check if image exists in ECR
# Usage: ecr_image_exists <service> <tag> [region]
ecr_image_exists() {
  local service="$1"
  local tag="$2"
  local region="${3:-$(get_aws_region)}"
  local repo

  case "$service" in
    backend)
      repo="${ECR_REPO_BACKEND}"
      ;;
    frontend)
      repo="${ECR_REPO_FRONTEND}"
      ;;
    *)
      return 1
      ;;
  esac

  aws ecr describe-images \
    --repository-name "$repo" \
    --image-ids imageTag="$tag" \
    --region "$region" \
    --no-cli-pager \
    >/dev/null 2>&1
}
