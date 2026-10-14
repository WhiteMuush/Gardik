#!/usr/bin/env sh
# Runs a command under the .nvmrc Node via nvm when available; --delete-prefix ignores a global npm prefix for this process.

if [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1
  nvm install --delete-prefix >/dev/null 2>&1 || true
  nvm use --delete-prefix >/dev/null 2>&1 || true
fi

exec "$@"
