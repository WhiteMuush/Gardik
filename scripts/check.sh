#!/usr/bin/env sh
# Runs every quality gate and lists all failures in one pass.
set -u

# prisma.config.ts refuses to load without a URL; validate never connects.
export DATABASE_URL="${DATABASE_URL:-postgresql://ci:ci@localhost:5432/ci}"

failed=""

# A missing scanner fails its gate, since a gate that skips itself would only look green.
need() {
  command -v "$1" >/dev/null 2>&1 || { echo "$1 is not installed, see the Development page of the wiki"; return 1; }
}

secrets_in_history() { need gitleaks && gitleaks git --no-banner --redact --log-level warn .; }
shell_scripts() {
  need shellcheck && git ls-files -z '*.sh' .githooks/commit-msg .githooks/pre-commit .githooks/pre-push | xargs -0 shellcheck
}
dockerfiles() { need trivy && trivy config --quiet --severity HIGH,CRITICAL --exit-code 1 .; }

# Re-runs the commit content checks on the whole branch, so a commit made with --no-verify is still caught.
branch_content() {
  base="$(git merge-base origin/develop HEAD 2>/dev/null)" || { echo "origin/develop not found, run git fetch"; return 1; }
  added="$(mktemp)"
  sh .githooks/lib/added-lines.sh range "$base" > "$added"
  git diff --name-only -z --diff-filter=ACMR "$base..HEAD" \
    | xargs -0 sh .githooks/lib/run-all.sh "$base:package.json" "HEAD:package.json" "$added" --
  status=$?
  rm -f "$added"
  return $status
}

gate() {
  name="$1"; shift
  echo ""
  echo "[check] $name"
  "$@" || failed="$failed\n  - $name"
}

gate "lint (zero warnings, files of 200 lines max)" npm run --silent lint -- --max-warnings 0
gate "format (Prettier)" npx prettier --check --log-level warn .
gate "types" npx tsc --noEmit
gate "Prisma schema" npx prisma validate
gate "unit tests and coverage floor" npx vitest run --coverage
gate "dead code and dependencies (knip)" npx knip --no-progress
gate "versions consistency" node scripts/check-consistency.mjs
gate "licenses" node scripts/check-licenses.mjs
gate "npm audit (production, high and critical)" npm audit --audit-level=high --omit=dev
gate "ASCII only (whole tree)" sh .githooks/lib/check-ascii-tree.sh
gate "secrets in the git history (gitleaks)" secrets_in_history
gate "shell scripts (shellcheck)" shell_scripts
gate "Dockerfiles (Trivy config, HIGH and CRITICAL)" dockerfiles
gate "commit content of the branch" branch_content

echo ""
if [ -n "$failed" ]; then
  printf "[check] FAILED:%b\n" "$failed"
  exit 1
fi
echo "[check] all gates passed"
