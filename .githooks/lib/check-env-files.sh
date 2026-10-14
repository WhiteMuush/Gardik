#!/usr/bin/env sh
# Rejects committed environment files other than .env.example; usage: check-env-files.sh <path>...
set -eu
status=0

for f in "$@"; do
  base="$(basename "$f")"
  case "$base" in
    .env.example) ;;
    .env|.env.*) echo "Environment file must not be committed: $f"; status=1 ;;
  esac
done

exit $status
