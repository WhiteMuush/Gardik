#!/usr/bin/env sh
# Dump the local compose database. Managed databases should use their
# provider's native backups instead (see docs/backup.md).
set -eu

root="$(CDPATH= cd "$(dirname "$0")/.." && pwd)"
cd "$root"

if [ "$(docker inspect -f '{{.State.Health.Status}}' datashield-db 2>/dev/null)" != "healthy" ]; then
  echo "[db-backup] database container is not running. Start it with: npm run db:up"
  exit 1
fi

mkdir -p backups
out="backups/datashield-$(date +%Y%m%d-%H%M%S).dump"

echo "[db-backup] dumping to $out"
docker compose exec -T db pg_dump -Fc -U "${POSTGRES_USER:-user}" "${POSTGRES_DB:-datashield}" > "$out.tmp"
mv "$out.tmp" "$out"

echo "[db-backup] done: $out ($(du -h "$out" | cut -f1))"
