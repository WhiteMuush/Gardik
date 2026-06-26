#!/usr/bin/env sh
# Run a command under the project's Node version (.nvmrc) via nvm, then exec it.
# Best-effort: if nvm is missing or fails, the command still runs under the
# active Node. --delete-prefix sidesteps a global npm `prefix` in ~/.npmrc
# (it only affects this process, the file is left untouched).

if [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1
  nvm install --delete-prefix >/dev/null 2>&1 || true
  nvm use --delete-prefix >/dev/null 2>&1 || true
fi

exec "$@"
