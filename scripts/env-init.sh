#!/usr/bin/env sh
# Create .env.local from .env.example with generated secrets.
# No-op if .env.local already exists (never clobbers secrets).
set -eu

root="$(CDPATH= cd "$(dirname "$0")/.." && pwd)"
cd "$root"

if [ -f .env.local ]; then
  echo ".env.local already exists, leaving it untouched."
  exit 0
fi

cp .env.example .env.local
auth="$(openssl rand -base64 32)"
enc="$(openssl rand -base64 32)"
sed -i "s|^BETTER_AUTH_SECRET=.*|BETTER_AUTH_SECRET=$auth|" .env.local
sed -i "s|^DIRECTORY_ENCRYPTION_KEY=.*|DIRECTORY_ENCRYPTION_KEY=$enc|" .env.local
echo ".env.local created with generated BETTER_AUTH_SECRET and DIRECTORY_ENCRYPTION_KEY."
