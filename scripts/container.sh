#!/usr/bin/env sh
# Shared container helpers so the local database works the same whether a
# machine has Docker or Podman. Sourced by the db-* scripts. POSIX sh.

# Local database settings (override via env or .env.local).
DB_CONTAINER="datashield-db"
DB_IMAGE="postgres:16"
DB_VOLUME="datashield-db-data"
DB_USER="${POSTGRES_USER:-user}"
DB_PASSWORD="${POSTGRES_PASSWORD:-password}"
DB_NAME="${POSTGRES_DB:-datashield}"
DB_PORT="${POSTGRES_PORT:-5432}"

# Resolve the container engine and, if present, a compose command. Prefers
# Docker when its daemon is reachable, otherwise Podman. Sets CT_ENGINE, and
# CT_COMPOSE (empty when no compose provider is installed). The local DB scripts
# only need CT_ENGINE; compose is optional and used by the full-stack target.
ct_resolve() {
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    CT_ENGINE="docker"
  elif command -v podman >/dev/null 2>&1; then
    CT_ENGINE="podman"
  elif command -v docker >/dev/null 2>&1; then
    CT_ENGINE="docker" # present but daemon down; callers surface a clear error
  else
    echo "No container engine found. Install Docker or Podman." >&2
    return 1
  fi

  CT_COMPOSE=""
  if [ "$CT_ENGINE" = "docker" ]; then
    if docker compose version >/dev/null 2>&1; then
      CT_COMPOSE="docker compose"
    elif command -v docker-compose >/dev/null 2>&1; then
      CT_COMPOSE="docker-compose"
    fi
  else
    if podman compose version >/dev/null 2>&1; then
      CT_COMPOSE="podman compose"
    elif command -v podman-compose >/dev/null 2>&1; then
      CT_COMPOSE="podman-compose"
    fi
  fi
}

# Block until the database answers pg_isready, or fail after ~60s.
ct_wait_db() {
  i=0
  until "$CT_ENGINE" exec "$DB_CONTAINER" pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; do
    i=$((i + 1))
    if [ "$i" -gt 60 ]; then
      echo "[db] timeout waiting for $DB_CONTAINER to become ready" >&2
      return 1
    fi
    sleep 1
  done
}
