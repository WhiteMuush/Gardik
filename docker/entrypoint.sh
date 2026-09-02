#!/bin/sh
# Container entrypoint: validate the environment, bring the schema up to date,
# then hand over to the Next.js server (the image CMD).
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "[entrypoint] DATABASE_URL is not set. Refusing to start." >&2
  exit 1
fi

if [ "$RUN_MIGRATIONS" = "false" ]; then
  echo "[entrypoint] RUN_MIGRATIONS=false, skipping prisma migrate deploy."
else
  echo "[entrypoint] Applying database migrations..."
  # The CLI lives in its own tree under /opt/prisma with its own config file,
  # so it has to run from there. The subshell keeps the app's working directory
  # untouched. The entry path is read from the manifest so it survives a CLI
  # release that moves its bundle.
  (
    cd /opt/prisma
    PRISMA_ENTRY=$(node -p "const b = require('./node_modules/prisma/package.json').bin; typeof b === 'string' ? b : b.prisma")
    node "node_modules/prisma/$PRISMA_ENTRY" migrate deploy --schema /app/prisma/schema.prisma
  )
fi

exec "$@"
