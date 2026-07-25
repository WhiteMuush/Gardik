#!/usr/bin/env sh
# Restore a pg_dump custom-format dump into the local database (Docker or Podman).
set -eu

root="$(CDPATH= cd "$(dirname "$0")/.." && pwd)"
cd "$root"
. "$root/scripts/container.sh"
ct_resolve || exit 1

if [ "$#" -ne 1 ]; then
  echo "[db-restore] usage: npm run db:restore -- backups/<file>.dump"
  exit 1
fi

file="$1"
if [ ! -f "$file" ]; then
  echo "[db-restore] file not found: $file"
  exit 1
fi

if ! "$CT_ENGINE" exec "$DB_CONTAINER" pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
  echo "[db-restore] database container is not running. Start it with: npm run db:up"
  exit 1
fi

printf "[db-restore] this OVERWRITES the current database with %s. Type yes to continue: " "$file"
read -r answer
if [ "$answer" != "yes" ]; then
  echo "[db-restore] aborted"
  exit 1
fi

"$CT_ENGINE" exec -i "$DB_CONTAINER" pg_restore --clean --if-exists -U "$DB_USER" -d "$DB_NAME" < "$file"

echo "[db-restore] done. Check schema consistency with: npx prisma migrate status"
