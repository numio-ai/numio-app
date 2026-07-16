#!/usr/bin/env bash
set -euo pipefail

# AWS SSM Parameter Store helpers + env file parsing.
# Keep Bash 3.2-compatible.

_TOOLS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$_TOOLS_DIR/common.sh"
# shellcheck source=/dev/null
source "$_TOOLS_DIR/env.sh"

params_prefix() {
  local env="$1"
  # Convention: /<env>/numio/<KEY>
  echo "/${env}/numio/"
}

aws_ssm_assert_access() {
  # Verifies the current AWS identity can read SSM parameters under /<env>/numio/.
  # Does not log or return parameter names/values.
  local env="$1"
  local project_root="$2"
  local region
  region="$(get_env_aws_region "$env" "$project_root")"

  local out rc
  set +e
  out="$(aws ssm get-parameters-by-path \
    --region "$region" \
    --path "$(params_prefix "$env")" \
    --recursive \
    --with-decryption \
    --max-items 1 \
    --query "Parameters[].Name" \
    --output text 2>&1)"
  rc=$?
  set -e
  if [[ $rc -ne 0 ]]; then
    log_error "Failed to access AWS SSM Parameter Store (env=$env, region=$region)."
    log_error "Most common cause: missing ssm:GetParametersByPath/ssm:GetParameter for /$env/numio/* (and kms:Decrypt if using a CMK)."
    log_error "AWS error: $(printf "%s" "$out" | head -c 240 | tr '\n' ' ')"
    exit $rc
  fi
}

aws_ssm_list_parameter_names() {
  local env="$1"
  local project_root="$2"
  local region
  region="$(get_env_aws_region "$env" "$project_root")"

  local out rc
  set +e
  out="$(aws ssm get-parameters-by-path \
    --region "$region" \
    --path "$(params_prefix "$env")" \
    --recursive \
    --query "Parameters[].Name" \
    --output text 2>&1)"
  rc=$?
  set -e
  if [[ $rc -ne 0 ]]; then
    log_error "Failed to list parameters from AWS SSM Parameter Store (env=$env, region=$region)."
    log_error "Most common cause: missing ssm:GetParametersByPath for /$env/numio/*"
    log_error "AWS error: $(printf "%s" "$out" | head -c 240 | tr '\n' ' ')"
    exit $rc
  fi

  printf "%s\n" $out
}

aws_ssm_get_parameter_value() {
  local name="$1"
  local region="$2"

  aws ssm get-parameter \
    --region "$region" \
    --name "$name" \
    --with-decryption \
    --query 'Parameter.Value' \
    --output text
}

aws_ssm_get_env_param_pairs() {
  # Prints KEY<TAB>VALUE pairs for all parameters under /<env>/numio/
  local env="$1"
  local project_root="$2"
  local region
  region="$(get_env_aws_region "$env" "$project_root")"

  local names
  names="$(aws_ssm_list_parameter_names "$env" "$project_root")"
  [[ -n "$names" ]] || return 0

  local name key value
  for name in $names; do
    key="${name##*/}"
    local out rc
    set +e
    out="$(aws_ssm_get_parameter_value "$name" "$region" 2>&1)"
    rc=$?
    set -e
    if [[ $rc -ne 0 ]]; then
      if printf "%s" "$out" | grep -q "ParameterNotFound"; then
        log_warn "Parameter missing: $name"
        continue
      fi
      log_error "Failed to read parameter value: $name"
      log_error "AWS error: $(printf "%s" "$out" | head -c 240 | tr '\n' ' ')"
      exit $rc
    fi

    value="$out"
    [[ -n "$value" ]] || continue
    if [[ "$value" == "PLACEHOLDER_REPLACE_ME" ]]; then
      continue
    fi
    printf "%s\t%s\n" "$key" "$value"
  done
}

export_aws_params_to_env() {
  local env="$1"
  local project_root="$2"
  local key value
  while IFS=$'\t' read -r key value; do
    [[ -n "$key" ]] || continue
    export "$key=$value"
  done < <(aws_ssm_get_env_param_pairs "$env" "$project_root")
}

load_env_file_exports() {
  # Loads KEY=VALUE pairs from a .env file into the current process environment.
  # - Ignores blank lines and comments.
  # - Does not eval; treats everything after first '=' as literal.
  local file="$1"
  [[ -f "$file" ]] || die ".env file not found: $file"

  local line key value
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -n "$line" ]] || continue
    [[ "$line" =~ ^[[:space:]]*# ]] && continue

    line="${line#"${line%%[![:space:]]*}"}"
    [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]] || continue

    key="${line%%=*}"
    value="${line#*=}"

    if [[ "$key" == "UID" || "$key" == "EUID" ]]; then
      continue
    fi

    if [[ "$value" =~ ^\".*\"$ ]]; then
      value="${value:1:${#value}-2}"
    elif [[ "$value" =~ ^\'.*\'$ ]]; then
      value="${value:1:${#value}-2}"
    fi

    export "$key=$value"
  done < "$file"
}

write_runtime_env_file() {
  # Writes a combined env file to a path (recommended: tmpfs like /run).
  # Arguments:
  #   1) static_env_file (source)
  #   2) output_file (target)
  #   3) env (deployment key)
  #   4) project_root (for env metadata)
  local static_env_file="$1"
  local output_file="$2"
  local env="$3"
  local project_root="$4"

  local out_dir
  out_dir="$(dirname "$output_file")"

  mkdir -p "$out_dir"
  chmod 700 "$out_dir" || true

  cat "$static_env_file" > "$output_file"
  printf "\n# --- parameters (runtime fetched) ---\n" >> "$output_file"

  local key value
  while IFS=$'\t' read -r key value; do
    [[ -n "$key" ]] || continue
    printf "%s=%s\n" "$key" "$value" >> "$output_file"
  done < <(aws_ssm_get_env_param_pairs "$env" "$project_root")

  chmod 600 "$output_file" || true
}

# ============================================================================
# Remote-side functions (run on target host, no project_root)
# ============================================================================

fetch_and_append_ssm_secrets() {
  # Fetches SSM parameters and appends them to the .env file.
  # Designed to run on the target host (no project_root available).
  #
  # Arguments:
  #   1) host - environment identifier (e.g., n0)
  #   2) app_dir - directory containing .env file
  #
  # Requires:
  #   - AWS_REGION environment variable must be set
  #   - AWS credentials (instance role or configured profile)
  local host="$1"
  local app_dir="$2"
  local env_file="${app_dir}/.env"

  if [[ -z "${AWS_REGION:-}" ]]; then
    log_error "AWS_REGION environment variable must be set"
    return 1
  fi

  if [[ ! -f "$env_file" ]]; then
    log_error ".env file not found: $env_file"
    return 1
  fi

  local prefix="/${host}/numio/"
  log_info "Fetching secrets from SSM: ${prefix}*"

  # Get all parameter names under the prefix
  local names_output rc
  set +e
  names_output="$(aws ssm get-parameters-by-path \
    --region "$AWS_REGION" \
    --path "$prefix" \
    --recursive \
    --query "Parameters[].Name" \
    --output text 2>&1)"
  rc=$?
  set -e

  if [[ $rc -ne 0 ]]; then
    log_error "Failed to list SSM parameters: $names_output"
    return $rc
  fi

  # No parameters found is okay
  if [[ -z "$names_output" || "$names_output" == "None" ]]; then
    log_info "No SSM parameters found under $prefix"
    return 0
  fi

  # Append secrets section header
  printf "\n# --- secrets (SSM, fetched at boot) ---\n" >> "$env_file"

  # Fetch each parameter and append to .env
  local name key value
  for name in $names_output; do
    key="${name##*/}"

    set +e
    value="$(aws ssm get-parameter \
      --region "$AWS_REGION" \
      --name "$name" \
      --with-decryption \
      --query 'Parameter.Value' \
      --output text 2>&1)"
    rc=$?
    set -e

    if [[ $rc -ne 0 ]]; then
      log_warn "Failed to fetch parameter $name: $value"
      continue
    fi

    # Skip placeholder values
    if [[ "$value" == "PLACEHOLDER_REPLACE_ME" ]]; then
      log_debug "Skipping placeholder: $key"
      continue
    fi

    printf "%s=%s\n" "$key" "$value" >> "$env_file"
    log_info "  Added secret: $key"
  done

  chmod 600 "$env_file" || true
  log_info "Secrets appended to $env_file"
}

