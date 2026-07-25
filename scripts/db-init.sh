#!/usr/bin/env sh
# Bring up the local database (Docker or Podman), apply migrations, seed demo
# data. One command for a fresh clone. Not for production.
set -eu

root="$(CDPATH= cd "$(dirname "$0")/.." && pwd)"
cd "$root"

sh scripts/db-up.sh

echo "[db-init] applying migrations"
npx prisma migrate deploy

echo "[db-init] seeding demo data"
npm run seed:dev

echo "[db-init] done. login: ${SEED_ADMIN_EMAIL:-admin@datashield.local} / ${SEED_ADMIN_PASSWORD:-ChangeMe123!}"
