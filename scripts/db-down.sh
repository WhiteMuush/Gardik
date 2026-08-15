#!/usr/bin/env sh
# Stop the local database container (Docker or Podman). Keeps the data volume so
# the next `db-up` resumes with the same data.
set -eu

root="$(CDPATH= cd "$(dirname "$0")/.." && pwd)"
cd "$root"
. "$root/scripts/container.sh"
ct_resolve || exit 1

if "$CT_ENGINE" container inspect "$DB_CONTAINER" >/dev/null 2>&1; then
  "$CT_ENGINE" stop "$DB_CONTAINER" >/dev/null
  echo "[db-down] stopped $DB_CONTAINER (data volume $DB_VOLUME kept)"
else
  echo "[db-down] $DB_CONTAINER not found, nothing to stop"
fi
