#!/usr/bin/env bash
#
# Pre-flight check for AWS onboarding test runs.
#
# Validates the target AWS account against artifacts created by previous
# Numio Add-Account wizard runs. Read-only — never deletes or modifies
# anything. Reports leftovers and prints copy-pasteable AWS CLI commands
# to clean them up before the next test.
#
# Resources checked (named per backend/src/numio/onboarding/cfn_template.py
# and legacy variants from earlier prototypes):
#   * CloudFormation stacks:  numio-onboarding, ConnectToNumio
#   * IAM users:              NumioServiceUser, NumioServiceUserCfn
#   * IAM roles:              NumioCurReaderRole, NumioCurReaderRoleCfn
#   * S3 buckets matching:    numio-cur-*
#   * CUR report definitions: starting with 'numio'
#
# Tester must run as an IAM identity with read access to IAM,
# CloudFormation, S3, and CUR (admin or equivalent — the same identity
# used to apply the onboarding stack).

set -euo pipefail

PROFILE="agenture-admin"
REGION="us-east-1"

usage() {
  cat <<'EOF'
Usage: pre-flight-check.sh [--profile <name>] [--region <name>] [-h|--help]

Validates an AWS account for Numio onboarding test runs. Read-only.

Options:
  --profile <name>   AWS CLI profile to use
  --region <name>    Region for CloudFormation lookup (default: us-east-1)
  -h, --help         Show this help

Exit codes:
  0   No leftovers found — safe to re-test.
  1   Leftovers present — run the printed cleanup commands first.
  2   Could not run pre-flight (missing aws CLI, no credentials, etc.).
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile) PROFILE="$2"; shift 2 ;;
    --region)  REGION="$2";  shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

if [[ -t 1 ]]; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; BOLD='\033[1m'; NC='\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; BOLD=''; NC=''
fi

if ! command -v aws &>/dev/null; then
  printf '%berror:%b aws CLI not found. Install it and retry.\n' "${RED}" "${NC}" >&2
  exit 2
fi

aws_args=(--region "${REGION}")
[[ -n "${PROFILE}" ]] && aws_args+=(--profile "${PROFILE}")

# CUR API is anchored in us-east-1 regardless of the --region argument.
cur_args=(--region us-east-1)
[[ -n "${PROFILE}" ]] && cur_args+=(--profile "${PROFILE}")

# Reusable command-prefix string for the cleanup section (echoed verbatim
# so the operator can copy-paste; --profile only included if the user passed it).
CLI_PREFIX="aws"
[[ -n "${PROFILE}" ]] && CLI_PREFIX="aws --profile ${PROFILE}"

caller_err=$(aws sts get-caller-identity --output text "${aws_args[@]}" 2>&1 1>/dev/null) || {
  printf '%berror:%b aws sts get-caller-identity failed:\n%s\n' "${RED}" "${NC}" "${caller_err}" >&2
  exit 2
}
ACCOUNT_ID=$(aws sts get-caller-identity --query 'Account' --output text "${aws_args[@]}")
CALLER=$(aws sts get-caller-identity --query 'Arn'     --output text "${aws_args[@]}")

printf '\n%bPre-flight check — Numio AWS onboarding%b\n' "${BOLD}" "${NC}"
printf '  Account : %s\n' "${ACCOUNT_ID}"
printf '  Region  : %s (CloudFormation; IAM and S3 are global)\n' "${REGION}"
printf '  Caller  : %s\n\n' "${CALLER}"

CONFLICTS=0
WARNINGS=0
STACK_FOUND=0   # if true, IAM cleanup is unnecessary (delete-stack cascades)

stack_cleanup_cmds=()
iam_cleanup_cmds=()
review_notes=()

mark_conflict() {
  printf '  %b✗%b %-32s %bFOUND%b — %s\n' "${RED}" "${NC}" "$1" "${RED}" "${NC}" "$2"
  CONFLICTS=$((CONFLICTS + 1))
}
mark_warn() {
  printf '  %b!%b %-32s %bFOUND%b — %s\n' "${YELLOW}" "${NC}" "$1" "${YELLOW}" "${NC}" "$2"
  WARNINGS=$((WARNINGS + 1))
}
mark_clean() {
  printf '  %b✓%b %-32s clean\n' "${GREEN}" "${NC}" "$1"
}

# --- CloudFormation stacks ------------------------------------------------
printf '%bCloudFormation stacks%b (region %s)\n' "${BOLD}" "${NC}" "${REGION}"
for stack in numio-onboarding ConnectToNumio; do
  status=$(aws cloudformation describe-stacks --stack-name "${stack}" \
             --query 'Stacks[0].StackStatus' --output text "${aws_args[@]}" 2>/dev/null || true)
  if [[ -n "${status}" && "${status}" != "None" ]]; then
    mark_conflict "${stack}" "delete the stack (status: ${status})"
    STACK_FOUND=1
    stack_cleanup_cmds+=(
      "${CLI_PREFIX} cloudformation delete-stack --stack-name ${stack} --region ${REGION}"
      "${CLI_PREFIX} cloudformation wait stack-delete-complete --stack-name ${stack} --region ${REGION}"
    )
  else
    mark_clean "${stack}"
  fi
done
echo

# --- IAM users ------------------------------------------------------------
printf '%bIAM users%b\n' "${BOLD}" "${NC}"
for user in NumioServiceUser NumioServiceUserCfn; do
  if aws iam get-user --user-name "${user}" "${aws_args[@]}" &>/dev/null; then
    mark_conflict "${user}" "delete the user (deactivate + delete its access keys first)"
    iam_cleanup_cmds+=(
      "# --- ${user}: delete access keys, then user"
      "for k in \$(${CLI_PREFIX} iam list-access-keys --user-name ${user} --query 'AccessKeyMetadata[].AccessKeyId' --output text); do \\"
      "  ${CLI_PREFIX} iam delete-access-key --user-name ${user} --access-key-id \"\$k\"; \\"
      "done"
      "${CLI_PREFIX} iam delete-user --user-name ${user}"
    )
  else
    mark_clean "${user}"
  fi
done
echo

# --- IAM roles ------------------------------------------------------------
printf '%bIAM roles%b\n' "${BOLD}" "${NC}"
for role in NumioCurReaderRole NumioCurReaderRoleCfn; do
  if aws iam get-role --role-name "${role}" "${aws_args[@]}" &>/dev/null; then
    inline=$(aws iam list-role-policies --role-name "${role}" \
               --query 'PolicyNames[]' --output text "${aws_args[@]}" 2>/dev/null || true)
    attached=$(aws iam list-attached-role-policies --role-name "${role}" \
                 --query 'AttachedPolicies[].PolicyName' --output text "${aws_args[@]}" 2>/dev/null || true)
    detail="delete the role"
    [[ -n "${inline}"   && "${inline}"   != "None" ]] && detail+=" (inline: ${inline// /, })"
    [[ -n "${attached}" && "${attached}" != "None" ]] && detail+=" (attached: ${attached// /, })"
    mark_conflict "${role}" "${detail}"
    iam_cleanup_cmds+=(
      "# --- ${role}: drop inline + attached policies, then role"
      "for p in \$(${CLI_PREFIX} iam list-role-policies --role-name ${role} --query 'PolicyNames[]' --output text); do \\"
      "  ${CLI_PREFIX} iam delete-role-policy --role-name ${role} --policy-name \"\$p\"; \\"
      "done"
      "for a in \$(${CLI_PREFIX} iam list-attached-role-policies --role-name ${role} --query 'AttachedPolicies[].PolicyArn' --output text); do \\"
      "  ${CLI_PREFIX} iam detach-role-policy --role-name ${role} --policy-arn \"\$a\"; \\"
      "done"
      "${CLI_PREFIX} iam delete-role --role-name ${role}"
    )
  else
    mark_clean "${role}"
  fi
done
echo

# --- S3 buckets -----------------------------------------------------------
printf "%bS3 buckets matching numio-cur-*%b\n" "${BOLD}" "${NC}"
buckets=$(aws s3api list-buckets \
            --query "Buckets[?starts_with(Name, 'numio-cur-')].Name" \
            --output text "${aws_args[@]}" 2>/dev/null || true)
if [[ -z "${buckets}" || "${buckets}" == "None" ]]; then
  mark_clean "no buckets matching numio-cur-*"
else
  for b in ${buckets}; do
    mark_warn "${b}" "do NOT delete unless intentionally rotating CUR (~24h to repopulate)"
    review_notes+=(
      "# Bucket ${b} — review only. To remove (will lose CUR history): empty first, then delete."
      "# ${CLI_PREFIX} s3 rm s3://${b} --recursive"
      "# ${CLI_PREFIX} s3api delete-bucket --bucket ${b}"
    )
  done
fi
echo

# --- CUR report definitions ----------------------------------------------
printf "%bCUR report definitions%b (us-east-1)\n" "${BOLD}" "${NC}"
reports=$(aws cur describe-report-definitions \
            --query "ReportDefinitions[?starts_with(ReportName, 'numio')].ReportName" \
            --output text "${cur_args[@]}" 2>/dev/null || true)
if [[ -z "${reports}" || "${reports}" == "None" ]]; then
  mark_clean "no CUR reports starting with 'numio'"
else
  for r in ${reports}; do
    mark_warn "${r}" "do NOT delete unless intentionally rotating CUR"
    review_notes+=(
      "# CUR report ${r} — review only. To remove (will pause CUR delivery):"
      "# ${CLI_PREFIX} cur delete-report-definition --report-name ${r} --region us-east-1"
    )
  done
fi
echo

# --- Summary --------------------------------------------------------------
printf '%bSummary%b\n' "${BOLD}" "${NC}"
printf '  Conflicts (must clean) : %d\n'   "${CONFLICTS}"
printf '  Warnings  (review)     : %d\n\n' "${WARNINGS}"

if [[ ${CONFLICTS} -eq 0 && ${WARNINGS} -eq 0 ]]; then
  printf '%bREADY%b for re-test.\n' "${GREEN}" "${NC}"
  exit 0
fi

# --- Cleanup commands -----------------------------------------------------
if [[ ${CONFLICTS} -gt 0 ]]; then
  printf '%bCleanup commands%b — copy-paste the block that fits your situation.\n\n' "${BOLD}" "${NC}"

  if [[ ${STACK_FOUND} -eq 1 ]]; then
    printf '%b# Recommended: drop the stack — it cascades to the IAM user, key, role, and inline policy.%b\n' "${YELLOW}" "${NC}"
    for cmd in "${stack_cleanup_cmds[@]}"; do printf '%s\n' "${cmd}"; done
    if [[ ${#iam_cleanup_cmds[@]} -gt 0 ]]; then
      echo
      printf '%b# Fallback only — run these IF the stack delete left orphaned IAM resources behind.%b\n' "${YELLOW}" "${NC}"
      for cmd in "${iam_cleanup_cmds[@]}"; do printf '%s\n' "${cmd}"; done
    fi
  else
    printf '%b# IAM resources exist but no Numio CFN stack does — delete them directly.%b\n' "${YELLOW}" "${NC}"
    for cmd in "${iam_cleanup_cmds[@]}"; do printf '%s\n' "${cmd}"; done
  fi
  echo
fi

if [[ ${#review_notes[@]} -gt 0 ]]; then
  printf '%bReview-only items (S3 / CUR)%b — usually leave these in place.\n' "${BOLD}" "${NC}"
  for cmd in "${review_notes[@]}"; do printf '%s\n' "${cmd}"; done
  echo
fi

if [[ ${CONFLICTS} -gt 0 ]]; then
  printf '%bNOT READY%b — re-running the wizard now will fail with EntityAlreadyExists.\n' "${RED}" "${NC}"
  exit 1
fi

printf '%bREADY%b for re-test (only review-only warnings present).\n' "${GREEN}" "${NC}"
exit 0
