#!/usr/bin/env sh
# Run the full local stack (app + db) via whichever compose provider exists,
# forwarding all arguments to it. For the database alone use `make db-up`, which
# needs no compose provider. Not for production.
set -eu

root="$(CDPATH= cd "$(dirname "$0")/.." && pwd)"
cd "$root"
. "$root/scripts/container.sh"
ct_resolve || exit 1

if [ -z "$CT_COMPOSE" ]; then
  echo "No compose provider found for $CT_ENGINE." >&2
  if [ "$CT_ENGINE" = "podman" ]; then
    echo "Install 'podman-compose' (pip install podman-compose) or the docker compose plugin," >&2
  else
    echo "Install the docker compose plugin," >&2
  fi
  echo "or skip compose entirely with: make db-up && make run" >&2
  exit 1
fi

# shellcheck disable=SC2086
exec $CT_COMPOSE "$@"
