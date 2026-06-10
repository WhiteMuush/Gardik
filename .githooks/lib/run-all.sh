#!/usr/bin/env sh
# Run all compliance checks over a diff.
# Usage: run-all.sh <old-pkg-ref> <new-pkg-ref> <added-lines-file> -- <changed-path>...
set -eu

old_ref="$1"; new_ref="$2"; added="$3"; shift 3
[ "${1:-}" = "--" ] && shift || true

lib="$(CDPATH= cd "$(dirname "$0")" && pwd)"
status=0

node "$lib/check-frozen-deps.mjs" "$old_ref" "$new_ref" || status=1
sh "$lib/check-env-files.sh" "$@" || status=1

sh "$lib/check-ai-attribution.sh"     < "$added" || status=1
sh "$lib/check-secrets.sh"            < "$added" || status=1
sh "$lib/check-english.sh"            < "$added" || status=1
sh "$lib/check-forbidden-patterns.sh" < "$added" || status=1

exit $status
