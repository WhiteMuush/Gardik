#!/usr/bin/env sh
# Point git at the versioned hooks. Non-fatal outside a git work tree
# (tarball installs, CI cache restores) but loud about what it did, so a
# contributor never silently ends up with inactive hooks.
set -eu

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "[hooks] skipped: not a git work tree"
  exit 0
fi

git config core.hooksPath .githooks
echo "[hooks] core.hooksPath set to .githooks"
