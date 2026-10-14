#!/usr/bin/env sh
# Starts the local PostgreSQL with Docker or Podman, port published and data in a named volume, not for production.
set -eu

root="$(CDPATH='' cd "$(dirname "$0")/.." && pwd)"
cd "$root"
. "$root/scripts/container.sh"
ct_resolve || exit 1

if "$CT_ENGINE" container inspect "$DB_CONTAINER" >/dev/null 2>&1; then
  echo "[db-up] $DB_CONTAINER exists, starting it ($CT_ENGINE)"
  "$CT_ENGINE" start "$DB_CONTAINER" >/dev/null 2>&1 || true
else
  echo "[db-up] creating $DB_CONTAINER on localhost:$DB_PORT ($CT_ENGINE)"
  "$CT_ENGINE" run -d --name "$DB_CONTAINER" \
    -e POSTGRES_USER="$DB_USER" \
    -e POSTGRES_PASSWORD="$DB_PASSWORD" \
    -e POSTGRES_DB="$DB_NAME" \
    -p "$DB_PORT:5432" \
    -v "$DB_VOLUME:/var/lib/postgresql/data" \
    "$DB_IMAGE" >/dev/null
fi

ct_wait_db || exit 1
echo "[db-up] ready on localhost:$DB_PORT ($CT_ENGINE)"
