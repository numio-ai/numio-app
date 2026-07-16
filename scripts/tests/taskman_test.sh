#!/usr/bin/env bash
# Smoke tests for scripts/taskman.sh.
#
# Runs against a sandbox tasks/ directory (via TASKMAN_TASKS_DIR) so it
# does not touch the real repo. Exits nonzero on any failure.

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
TASKMAN="${SCRIPT_DIR}/../taskman.sh"

SANDBOX="$(mktemp -d -t taskman-test.XXXXXX)"
export TASKMAN_TASKS_DIR="${SANDBOX}/tasks"
mkdir -p "${TASKMAN_TASKS_DIR}/backlog" "${TASKMAN_TASKS_DIR}/active" "${TASKMAN_TASKS_DIR}/done"

cleanup() { rm -rf "$SANDBOX"; }
trap cleanup EXIT

pass=0
fail=0
PASS() { printf '  [PASS] %s\n' "$1"; pass=$((pass+1)); }
FAIL() { printf '  [FAIL] %s\n' "$1" >&2; fail=$((fail+1)); }

FEATURE_BODY='## Problem statement
We need a sandbox feature for tests.

## Objective
Prove taskman can create features with valid bodies.

## Acceptance criteria
- Feature file created with correct YAML header and body.
'

TASK_BODY='## Problem statement
Test task content.

## Scope
In: unit test coverage. Out: everything else.

## Acceptance criteria
- Task file lands in backlog/ with correct YAML.

## Quality gates
- taskman validate is green after creation.
'

BAD_BODY='## Summary
Missing the required sections.
'

banner() { printf '\n=== %s ===\n' "$1"; }

# --- Test 1: create feature draft, finalize
banner "new feature (draft)"
feature_path="$(printf '%s' "$FEATURE_BODY" | "$TASKMAN" new feature --slug sandbox --title "Sandbox feature" 2>/dev/null)"
[[ -f "$feature_path" ]] && PASS "feature file created: $(basename "$feature_path")" || FAIL "feature file not created"
grep -q '^status: backlog$' "$feature_path" && PASS "feature YAML status=backlog" || FAIL "feature YAML status wrong"
grep -q '^slug: sandbox$' "$feature_path" && PASS "feature YAML slug=sandbox" || FAIL "feature YAML slug wrong"
grep -q '^draft: true$' "$feature_path" && PASS "feature YAML draft=true" || FAIL "feature YAML draft marker missing"

"$TASKMAN" finalize "$feature_path" >/dev/null 2>&1
grep -q '^draft:' "$feature_path" && FAIL "finalize should remove draft field" || PASS "finalize removed draft field"

# --- Test 2: duplicate slug rejected
banner "duplicate feature slug"
if printf '%s' "$FEATURE_BODY" | "$TASKMAN" new feature --slug sandbox --title "Dup" 2>/dev/null; then
  FAIL "duplicate slug should have been rejected"
else
  PASS "duplicate slug rejected"
fi

# --- Test 3: body validation
banner "body validation"
if printf '%s' "$BAD_BODY" | "$TASKMAN" new feature --slug badbody --title "Bad" 2>/dev/null; then
  FAIL "bad body should have been rejected"
else
  PASS "bad body rejected"
fi
if printf '%s' "$BAD_BODY" | "$TASKMAN" new feature --slug badbody --title "Bad" --no-validate 2>/dev/null >/dev/null; then
  PASS "--no-validate bypasses body checks"
else
  FAIL "--no-validate should have allowed bad body"
fi

# --- Test 4: create task attached to feature (draft)
banner "new task --feature (draft)"
task_path="$(printf '%s' "$TASK_BODY" | "$TASKMAN" new task --title "Wire up widget" --feature sandbox 2>/dev/null)"
[[ -f "$task_path" ]] && PASS "task file created: $(basename "$task_path")" || FAIL "task file not created"
grep -q '^feature: sandbox$' "$task_path" && PASS "task YAML feature=sandbox" || FAIL "task YAML feature missing"
grep -q '^kind: task$' "$task_path" && PASS "task YAML kind=task" || FAIL "task YAML kind wrong"
grep -q '^draft: true$' "$task_path" && PASS "task YAML draft=true" || FAIL "task YAML draft marker missing"

# --- Test 4b: discard refuses non-draft files; accepts drafts
banner "discard semantics"
discard_path="$(printf '%s' "$TASK_BODY" | "$TASKMAN" new task --title "To be discarded" --feature sandbox 2>/dev/null)"
"$TASKMAN" discard "$discard_path" >/dev/null 2>&1
[[ ! -e "$discard_path" ]] && PASS "discard removed draft file" || FAIL "discard did not remove draft file"

# Finalize the live task, then prove discard refuses to delete it.
"$TASKMAN" finalize "$task_path" >/dev/null 2>&1
if "$TASKMAN" discard "$task_path" 2>/dev/null; then
  FAIL "discard should refuse non-draft file"
else
  PASS "discard refuses non-draft file"
fi
[[ -f "$task_path" ]] && PASS "non-draft file untouched after refused discard" || FAIL "non-draft file vanished"

# --- Test 5: task with unknown feature rejected
banner "task with unknown feature"
if printf '%s' "$TASK_BODY" | "$TASKMAN" new task --title "Orphan" --feature nonexistent 2>/dev/null; then
  FAIL "unknown feature should have been rejected"
else
  PASS "unknown feature rejected"
fi

# --- Test 6: ad-hoc bug
banner "ad-hoc bug task"
bug_path="$(printf '%s' "$TASK_BODY" | "$TASKMAN" new task --title "Fix log glitch" --kind bug 2>/dev/null)"
grep -q '^kind: bug$' "$bug_path" && PASS "bug YAML kind=bug" || FAIL "bug YAML kind wrong"
grep -q '^feature:' "$bug_path" && FAIL "ad-hoc bug should not have feature field" || PASS "ad-hoc bug has no feature field"

# --- Test 7: move lifecycle
banner "move backlog -> active -> done"
active_path="$("$TASKMAN" move "$task_path" active 2>/dev/null)"
[[ "$(dirname "$active_path")" == *"/active" ]] && PASS "moved to active/" || FAIL "not in active/"
grep -q '^status: active$' "$active_path" && PASS "YAML status updated to active" || FAIL "YAML status not updated"

done_path="$("$TASKMAN" move "$active_path" done 2>/dev/null)"
[[ "$(dirname "$done_path")" == *"/done" ]] && PASS "moved to done/" || FAIL "not in done/"
grep -q '^status: done$' "$done_path" && PASS "YAML status updated to done" || FAIL "YAML status not updated"

# --- Test 8: feature close fails while a MEMBER task is open
banner "feature close with open member task"
open_member="$(printf '%s' "$TASK_BODY" | "$TASKMAN" new task --title "Other member" --feature sandbox 2>/dev/null)"
if "$TASKMAN" feature close sandbox 2>/dev/null; then
  FAIL "feature close should fail while member task is in backlog"
else
  PASS "feature close rejected while member task open"
fi

# --- Test 9: feature close succeeds after all member tasks done
banner "feature close after all member tasks done"
"$TASKMAN" move "$open_member" done >/dev/null 2>&1
closed_path="$("$TASKMAN" feature close sandbox 2>/dev/null)"
[[ -n "$closed_path" ]] && grep -q '^status: done$' "$closed_path" \
  && PASS "feature closed and marked done" \
  || FAIL "feature not marked done (closed_path='$closed_path')"

# --- Test 10: validate
banner "validate"
"$TASKMAN" validate >/dev/null 2>&1 && PASS "validate green" || FAIL "validate failed"

# --- Test 11: list
banner "list"
"$TASKMAN" list features | grep -q sandbox && PASS "list features shows sandbox" || FAIL "list features missing sandbox"
"$TASKMAN" list tasks --kind bug | grep -q bug && PASS "list tasks --kind bug filter works" || FAIL "list tasks filter broken"

# --- Test 12: invalid slug rejected
banner "invalid slug"
if printf '%s' "$FEATURE_BODY" | "$TASKMAN" new feature --slug "Bad-Slug" --title "x" 2>/dev/null; then
  FAIL "invalid slug should be rejected"
else
  PASS "invalid slug rejected"
fi

# --- Summary
printf '\n'
if (( fail == 0 )); then
  printf '\033[0;32mAll %d tests passed\033[0m\n' "$pass"
  exit 0
else
  printf '\033[0;31m%d passed, %d failed\033[0m\n' "$pass" "$fail"
  exit 1
fi
