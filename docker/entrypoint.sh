#!/bin/sh
# Validates the environment, migrates the schema, then hands over to the Next.js server (the image CMD).
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "[entrypoint] DATABASE_URL is not set. Refusing to start." >&2
  exit 1
fi

if [ "$RUN_MIGRATIONS" = "false" ]; then
  echo "[entrypoint] RUN_MIGRATIONS=false, skipping prisma migrate deploy."
else
  echo "[entrypoint] Applying database migrations..."
  # The CLI runs from its own tree under /opt/prisma in a subshell, with its entry path read from the manifest.
  (
    cd /opt/prisma
    PRISMA_ENTRY=$(node -p "const b = require('./node_modules/prisma/package.json').bin; typeof b === 'string' ? b : b.prisma")
    node "node_modules/prisma/$PRISMA_ENTRY" migrate deploy --schema /app/prisma/schema.prisma
  )
fi

exec "$@"
