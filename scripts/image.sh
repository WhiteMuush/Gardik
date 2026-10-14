#!/usr/bin/env sh
# Builds the production image and runs it with its own database, to test it locally before publishing.
set -eu

root="$(CDPATH='' cd "$(dirname "$0")/.." && pwd)"
cd "$root"
. "$root/scripts/container.sh"
ct_resolve || exit 1

IMAGE="gardik:local"
NET="gardik-image-net"
APP="gardik-image-app"
DB="gardik-image-db"
VOLUME="gardik-image-db-data"
PORT="${IMAGE_PORT:-3001}"
URL="http://localhost:$PORT"
# Generated secrets live here, outside any command line, so a rebuild keeps the same instance.
STATE="$root/.image-local"

exists() { "$CT_ENGINE" container inspect "$1" >/dev/null 2>&1; }

secrets() {
  if [ ! -f "$STATE/app.env" ]; then
    mkdir -p "$STATE"
    umask 077
    pass="$(openssl rand -hex 24)"
    creds="gardik:$pass"
    echo "POSTGRES_PASSWORD=$pass" > "$STATE/db.env"
    {
      echo "DATABASE_URL=postgresql://$creds@$DB:5432/gardik"
      echo "BETTER_AUTH_SECRET=$(openssl rand -hex 32)"
      echo "DIRECTORY_ENCRYPTION_KEY=$(openssl rand -hex 32)"
      echo "BOOTSTRAP_INVITE_TOKEN=$(openssl rand -hex 32)"
    } > "$STATE/app.env"
  fi
  TOKEN="$(sed -n 's/^BOOTSTRAP_INVITE_TOKEN=//p' "$STATE/app.env")"
}

up() {
  echo "[image] building $IMAGE from Dockerfile ($CT_ENGINE)"
  "$CT_ENGINE" build -t "$IMAGE" .
  secrets
  "$CT_ENGINE" network inspect "$NET" >/dev/null 2>&1 || "$CT_ENGINE" network create "$NET" >/dev/null

  if ! exists "$DB"; then
    "$CT_ENGINE" run -d --name "$DB" --network "$NET" --env-file "$STATE/db.env" \
      -e POSTGRES_USER=gardik -e POSTGRES_DB=gardik \
      -v "$VOLUME:/var/lib/postgresql/data" "$DB_IMAGE" >/dev/null
  fi
  "$CT_ENGINE" start "$DB" >/dev/null
  i=0
  until "$CT_ENGINE" exec "$DB" pg_isready -U gardik -d gardik >/dev/null 2>&1; do
    i=$((i + 1)); [ "$i" -gt 60 ] && { echo "[image] database did not start" >&2; exit 1; }
    sleep 1
  done

  "$CT_ENGINE" rm -f "$APP" >/dev/null 2>&1 || true
  "$CT_ENGINE" run -d --name "$APP" --network "$NET" -p "$PORT:3000" --env-file "$STATE/app.env" \
    -e BETTER_AUTH_URL="$URL" -e BOOTSTRAP_ADMIN_EMAIL=admin@example.com \
    "$IMAGE" >/dev/null

  i=0
  until curl -s -o /dev/null "$URL/login"; do
    i=$((i + 1)); [ "$i" -gt 90 ] && { echo "[image] app did not answer, see: $CT_ENGINE logs $APP" >&2; exit 1; }
    sleep 1
  done
  echo ""
  echo "[image] production image running on $URL"
  echo "[image] first time: set the admin password at $URL/invite?token=$TOKEN"
  echo "[image] then sign in at $URL/login as admin@example.com"
  echo "[image] logs: $CT_ENGINE logs -f $APP   stop and wipe: make image-down"
}

down() {
  "$CT_ENGINE" rm -f "$APP" "$DB" >/dev/null 2>&1 || true
  "$CT_ENGINE" network rm "$NET" >/dev/null 2>&1 || true
  "$CT_ENGINE" volume rm "$VOLUME" >/dev/null 2>&1 || true
  rm -rf "$STATE"
  echo "[image] stopped, database and secrets wiped"
}

scan() {
  "$CT_ENGINE" image inspect "$IMAGE" >/dev/null 2>&1 || { echo "[image] run make image first" >&2; exit 1; }
  if command -v trivy >/dev/null 2>&1; then
    trivy image --severity HIGH,CRITICAL "$IMAGE"
  else
    echo "[image] trivy not installed: https://trivy.dev/latest/getting-started/installation/" >&2
    exit 1
  fi
}

case "${1:-}" in
  up) up ;;
  down) down ;;
  scan) scan ;;
  *) echo "usage: image.sh up|down|scan" >&2; exit 1 ;;
esac
