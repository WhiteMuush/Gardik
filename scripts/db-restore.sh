#!/usr/bin/env sh
# Restore a pg_dump custom-format dump into the local compose database.
set -eu

root="$(CDPATH= cd "$(dirname "$0")/.." && pwd)"
cd "$root"

if [ "$#" -ne 1 ]; then
  echo "[db-restore] usage: npm run db:restore -- backups/<file>.dump"
  exit 1
fi

file="$1"
if [ ! -f "$file" ]; then
  echo "[db-restore] file not found: $file"
  exit 1
fi

if [ "$(docker inspect -f '{{.State.Health.Status}}' datashield-db 2>/dev/null)" != "healthy" ]; then
  echo "[db-restore] database container is not running. Start it with: npm run db:up"
  exit 1
fi

printf "[db-restore] this OVERWRITES the current database with %s. Type yes to continue: " "$file"
read -r answer
if [ "$answer" != "yes" ]; then
  echo "[db-restore] aborted"
  exit 1
fi

docker compose exec -T db pg_restore --clean --if-exists -U "${POSTGRES_USER:-user}" -d "${POSTGRES_DB:-datashield}" < "$file"

echo "[db-restore] done. Check schema consistency with: npx prisma migrate status"
