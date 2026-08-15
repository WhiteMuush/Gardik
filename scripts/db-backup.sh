#!/usr/bin/env sh
# Dump the local database (Docker or Podman). Managed databases should use their
# provider's native backups instead (see docs/backup.md).
set -eu

root="$(CDPATH= cd "$(dirname "$0")/.." && pwd)"
cd "$root"
. "$root/scripts/container.sh"
ct_resolve || exit 1

if ! "$CT_ENGINE" exec "$DB_CONTAINER" pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
  echo "[db-backup] database container is not running. Start it with: npm run db:up"
  exit 1
fi

mkdir -p backups
out="backups/datashield-$(date +%Y%m%d-%H%M%S).dump"

echo "[db-backup] dumping to $out"
"$CT_ENGINE" exec "$DB_CONTAINER" pg_dump -Fc -U "$DB_USER" "$DB_NAME" > "$out.tmp"
mv "$out.tmp" "$out"

echo "[db-backup] done: $out ($(du -h "$out" | cut -f1))"
