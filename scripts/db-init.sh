#!/usr/bin/env sh
# Starts the local database, migrates it and seeds demo data in one command for a fresh clone, not for production.
set -eu

root="$(CDPATH='' cd "$(dirname "$0")/.." && pwd)"
cd "$root"

sh scripts/db-up.sh

echo "[db-init] applying migrations"
npx prisma migrate deploy

echo "[db-init] seeding demo data"
npm run seed:dev

echo "[db-init] done. login: ${SEED_ADMIN_EMAIL:-admin@gardik.local} / ${SEED_ADMIN_PASSWORD:-ChangeMe123!}"
