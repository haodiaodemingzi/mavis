#!/bin/bash
# TaskCompleted hook: Verifies task acceptance criteria before marking complete.
# Exit code 2 blocks the task from being marked as completed.

set -euo pipefail

INPUT=$(cat)
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')
TASK_DESC=$(echo "$INPUT" | jq -r '.task_input.description // empty')

if [ -z "$CWD" ]; then
  exit 0
fi

cd "$CWD"

ERRORS=""

if echo "$TASK_DESC" | grep -qi "test\|spec"; then
  if [ -f "package.json" ] && jq -e '.scripts.test' package.json > /dev/null 2>&1; then
    if ! npm test --silent 2>/dev/null; then
      ERRORS="${ERRORS}Tests are failing. Fix before marking task complete.\n"
    fi
  fi
fi

if echo "$TASK_DESC" | grep -qi "implement\|create\|write\|add"; then
  if [ -f "tsconfig.json" ]; then
    if ! npx tsc --noEmit 2>/dev/null; then
      ERRORS="${ERRORS}TypeScript errors detected. Fix before marking task complete.\n"
    fi
  fi
fi

if [ -n "$ERRORS" ]; then
  echo -e "$ERRORS" >&2
  exit 2
fi

exit 0
