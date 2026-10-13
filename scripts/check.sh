#!/usr/bin/env sh
# Every quality gate in one command, shared by the pre-push hook and CI.
# Runs all gates even when one fails, so a single run lists every problem.
# Secrets are scanned on added lines by pre-commit and on the history by
# gitleaks in CI; a whole-tree shell scan here takes minutes.
set -u

# prisma.config.ts refuses to load without a URL; validate never connects.
export DATABASE_URL="${DATABASE_URL:-postgresql://ci:ci@localhost:5432/ci}"

failed=""

gate() {
  name="$1"; shift
  echo ""
  echo "[check] $name"
  "$@" || failed="$failed\n  - $name"
}

gate "lint (zero warnings, files under 500 lines)" npm run --silent lint -- --max-warnings 0
gate "format (Prettier)" npx prettier --check --log-level warn .
gate "types" npx tsc --noEmit
gate "Prisma schema" npx prisma validate
gate "unit tests and coverage floor" npx vitest run --coverage
gate "dead code and dependencies (knip)" npx knip --no-progress
gate "versions consistency" node scripts/check-consistency.mjs
gate "licenses" node scripts/check-licenses.mjs
gate "npm audit (production, high and critical)" npm audit --audit-level=high --omit=dev
gate "ASCII only (whole tree)" sh .githooks/lib/check-ascii-tree.sh

echo ""
if [ -n "$failed" ]; then
  printf "[check] FAILED:%b\n" "$failed"
  exit 1
fi
echo "[check] all gates passed"
