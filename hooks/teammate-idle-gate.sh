#!/bin/bash
# TeammateIdle hook: Ensures code quality before a teammate goes idle.
# Exit code 2 blocks the teammate from going idle and sends stderr as feedback.

set -euo pipefail

INPUT=$(cat)
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')

if [ -z "$CWD" ]; then
  exit 0
fi

cd "$CWD"

ERRORS=""

if [ -f "package.json" ]; then
  if jq -e '.scripts.lint' package.json > /dev/null 2>&1; then
    if ! npm run lint --silent 2>/dev/null; then
      ERRORS="${ERRORS}Lint errors found. Fix them before completing.\n"
    fi
  fi

  if jq -e '.scripts.typecheck' package.json > /dev/null 2>&1; then
    if ! npm run typecheck --silent 2>/dev/null; then
      ERRORS="${ERRORS}Type errors found. Fix them before completing.\n"
    fi
  elif [ -f "tsconfig.json" ]; then
    if ! npx tsc --noEmit 2>/dev/null; then
      ERRORS="${ERRORS}TypeScript compilation errors. Fix them before completing.\n"
    fi
  fi
fi

if [ -n "$ERRORS" ]; then
  echo -e "$ERRORS" >&2
  exit 2
fi

exit 0
