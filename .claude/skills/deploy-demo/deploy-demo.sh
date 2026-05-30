#!/usr/bin/env bash
# Build the Numio frontend in mock mode and publish it as the public, standalone
# demo at https://demo.numio.ai.
#
# This reproduces "Option A": the live demo IS the real frontend built with
# VITE_API_MODE=mock — synthetic data, no backend, no separate fork to keep in
# sync. Target infra is the prod-website-demo-numio-ai stack (S3 + CloudFront).
#
# This script is co-located with the `deploy-demo` Claude Code skill under
# .claude/skills/deploy-demo/. The skill (SKILL.md) is the entry point; invoke
# this script via the skill, or directly:
#
# Usage:
#   ./.claude/skills/deploy-demo/deploy-demo.sh              # build (mock) + deploy + invalidate + verify
#   ./.claude/skills/deploy-demo/deploy-demo.sh --build-only # just build the mock bundle
#   ./.claude/skills/deploy-demo/deploy-demo.sh --dry-run    # print the build/deploy commands, do nothing
#   ./.claude/skills/deploy-demo/deploy-demo.sh -y           # skip the confirmation prompt (CI)
#
# Prerequisite: AWS credentials for the agenture-prod profile (SSO login lives in
# the infra repo: `./scripts/aws-admin.sh sso login`).

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# Three levels up from .claude/skills/deploy-demo/ → repo root.
PROJECT_DIR="${SCRIPT_DIR}/../../.."
FRONTEND_DIR="${PROJECT_DIR}/frontend"

# Deploy target — overridable via env or flags. Defaults match
# docs/dev-runbook.md and infra/tf/stacks/prod-website-demo-numio-ai.
S3_BUCKET="${S3_BUCKET:-www-agenture-sites--demo-numio-ai}"
CLOUDFRONT_DIST_ID="${CLOUDFRONT_DIST_ID:-EKTOKO09ZQQ04}"
AWS_REGION="${AWS_REGION:-us-west-1}"
DEMO_URL="${DEMO_URL:-https://demo.numio.ai}"
export AWS_PROFILE="${AWS_PROFILE:-agenture-prod}"
export AWS_PAGER=""

log() { printf '\033[0;36m[deploy-demo]\033[0m %s\n' "$*"; }
die() { printf '\033[0;31m[deploy-demo] ERROR:\033[0m %s\n' "$*" >&2; exit 1; }
require_cmd() { command -v "$1" >/dev/null 2>&1 || die "missing required command: $1"; }

usage() {
  cat <<EOF
Usage: .claude/skills/deploy-demo/deploy-demo.sh [options]

Build the frontend in mock mode and publish it to ${DEMO_URL}.

Options:
  --build-only       Build the mock bundle, then stop (no deploy).
  --skip-build       Deploy the existing frontend/dist without rebuilding.
  --no-invalidate    Skip the CloudFront cache invalidation.
  --dry-run          Print the commands that would run; change nothing.
  -y, --yes          Don't prompt for confirmation before deploying (CI).
  --bucket=NAME      Override S3 bucket (default: ${S3_BUCKET}).
  --dist-id=ID       Override CloudFront distribution id (default: ${CLOUDFRONT_DIST_ID}).
  -h, --help         Show this help.

Environment overrides: S3_BUCKET, CLOUDFRONT_DIST_ID, AWS_REGION, AWS_PROFILE, DEMO_URL.
EOF
}

build_only=0; skip_build=0; no_invalidate=0; assume_yes=0; dry_run=0
for arg in "$@"; do
  case "$arg" in
    --build-only) build_only=1 ;;
    --skip-build) skip_build=1 ;;
    --no-invalidate) no_invalidate=1 ;;
    --dry-run) dry_run=1 ;;
    -y|--yes) assume_yes=1 ;;
    --bucket=*) S3_BUCKET="${arg#--bucket=}" ;;
    --dist-id=*) CLOUDFRONT_DIST_ID="${arg#--dist-id=}" ;;
    -h|--help) usage; exit 0 ;;
    *) die "unknown option: ${arg} (see --help)" ;;
  esac
done

run() { log "+ $*"; [[ "$dry_run" == "1" ]] && return 0; "$@"; }

DIST_DIR="${FRONTEND_DIR}/dist"

# 1. Build the mock bundle.
if [[ "$skip_build" == "0" ]]; then
  require_cmd npm
  log "Building frontend in mock mode (VITE_API_MODE=mock)..."
  if [[ "$dry_run" == "1" ]]; then
    log "+ (cd ${FRONTEND_DIR} && VITE_API_MODE=mock npm run build)"
  else
    (cd "$FRONTEND_DIR" && VITE_API_MODE=mock npm run build)
  fi
fi

# 2. Safety gate: confirm dist/ is a MOCK build, not a real-mode build.
# A real build tree-shakes the mock layer out; publishing it to the backend-free
# demo would render a blank/erroring app. The mock dispatcher's literal is a
# reliable discriminator.
if [[ "$dry_run" == "0" ]]; then
  [[ -d "$DIST_DIR" ]] || die "missing ${DIST_DIR} — build first (omit --skip-build)."
  if ! grep -rqs "No mock handler" "$DIST_DIR"; then
    die "dist/ has no mock layer — this looks like a REAL build. Refusing to deploy. Rebuild with VITE_API_MODE=mock (omit --skip-build)."
  fi
  log "Verified dist/ is a mock build."
fi

if [[ "$build_only" == "1" ]]; then
  log "Build-only: bundle ready at ${DIST_DIR}. Not deploying."
  exit 0
fi

# 3. Preflight + confirm (this is a production deploy).
require_cmd aws
require_cmd curl
if [[ "$dry_run" == "0" ]]; then
  aws sts get-caller-identity >/dev/null 2>&1 || \
    die "no valid AWS credentials for profile '${AWS_PROFILE}'. Run the infra SSO login first (./scripts/aws-admin.sh sso login)."
fi
log "Target: s3://${S3_BUCKET} (${AWS_REGION}, profile ${AWS_PROFILE}), CloudFront ${CLOUDFRONT_DIST_ID} -> ${DEMO_URL}"
if [[ "$assume_yes" == "0" && "$dry_run" == "0" ]]; then
  read -r -p "[deploy-demo] Publish this mock build to the PUBLIC demo? [y/N] " reply
  [[ "$reply" =~ ^[Yy]$ ]] || die "aborted by user."
fi

# 4. Publish: sync dist/ to S3 (removing stale objects).
run aws s3 sync "${DIST_DIR}/" "s3://${S3_BUCKET}/" --delete --region "$AWS_REGION"

# 5. Invalidate the CloudFront cache so the new bundle goes live immediately.
if [[ "$no_invalidate" == "0" ]]; then
  run aws cloudfront create-invalidation --distribution-id "$CLOUDFRONT_DIST_ID" --paths "/*"
fi

# 6. Verify.
if [[ "$dry_run" == "0" ]]; then
  log "Verifying ${DEMO_URL} ..."
  code="$(curl -s -o /dev/null -w '%{http_code}' -I "$DEMO_URL" || echo 000)"
  if [[ "$code" == "200" ]]; then
    log "OK: ${DEMO_URL} returned HTTP ${code}."
  else
    log "NOTE: ${DEMO_URL} returned HTTP ${code} — CloudFront invalidation can take a few minutes to propagate."
  fi
fi

log "Done."
