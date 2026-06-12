#!/usr/bin/env sh
# Spin up a local test database, apply migrations, seed demo data.
# Requires Docker (compose.yml). Not for production.
set -eu

root="$(CDPATH= cd "$(dirname "$0")/.." && pwd)"
cd "$root"

if ! docker info >/dev/null 2>&1; then
  echo "[db-init] Docker is not available. Enable Docker Desktop WSL integration first."
  exit 1
fi

echo "[db-init] starting postgres"
docker compose up -d db

echo "[db-init] waiting for postgres to be healthy"
i=0
until [ "$(docker inspect -f '{{.State.Health.Status}}' datashield-db 2>/dev/null)" = "healthy" ]; do
  i=$((i + 1))
  if [ "$i" -gt 60 ]; then
    echo "[db-init] timeout waiting for database"
    exit 1
  fi
  sleep 1
done

echo "[db-init] applying migrations"
npx prisma migrate deploy

echo "[db-init] seeding demo data"
npm run seed:dev

echo "[db-init] done. login: ${SEED_ADMIN_EMAIL:-admin@datashield.local} / ${SEED_ADMIN_PASSWORD:-ChangeMe123!}"
