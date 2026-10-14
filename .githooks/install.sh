#!/usr/bin/env sh
# Points git at the versioned hooks, non-fatal outside a work tree but loud about what it did.
set -eu

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "[hooks] skipped: not a git work tree"
  exit 0
fi

git config core.hooksPath .githooks
echo "[hooks] core.hooksPath set to .githooks"
