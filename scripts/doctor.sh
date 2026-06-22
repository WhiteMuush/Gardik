#!/usr/bin/env sh
# Full setup diagnosis for DataShield: toolchain, env, Docker, database, Prisma.
# After the report, offers to auto-fix detected issues (interactive only),
# separating failures from warnings. Exits non-zero when failures remain.
set -u

root="$(CDPATH= cd "$(dirname "$0")/.." && pwd)"
cd "$root"

ok=0
warn=0
bad=0
dkr=0
fx_env=0
fx_auth=0
fx_enc=0
fx_authurl=0
fx_cron=0
fx_install=0
fx_generate=0
fx_dbup=0
fx_migrate=0

pass() { echo "  [OK]   $1"; ok=$((ok + 1)); }
wrn()  { echo "  [WARN] $1"; warn=$((warn + 1)); }
err()  { echo "  [FAIL] $1"; bad=$((bad + 1)); }
getv() { grep -E "^$1=" .env.local 2>/dev/null | head -1 | cut -d= -f2-; }
setval() {
  if grep -qE "^$1=" .env.local 2>/dev/null; then
    sed -i "s|^$1=.*|$1=$2|" .env.local
  else
    printf '%s=%s\n' "$1" "$2" >>.env.local
  fi
}

echo "DataShield doctor"
echo "================="

echo "Toolchain:"
nv="$(node -v 2>/dev/null || true)"
if [ -z "$nv" ]; then err "node: not found (need Node 22)"
elif [ "${nv#v22.}" != "$nv" ]; then pass "node $nv"
else wrn "node $nv (project targets Node 22)"; fi
if command -v npm >/dev/null 2>&1; then pass "npm $(npm -v)"; else err "npm: not found"; fi
if command -v openssl >/dev/null 2>&1; then pass "openssl present (used by 'make env')"
else wrn "openssl: not found ('make env' cannot generate secrets)"; fi

echo "Environment (.env.local):"
if [ ! -f .env.local ]; then
  err ".env.local missing (run 'make env')"
  fx_env=1
else
  pass ".env.local present"
  [ -n "$(getv DATABASE_URL)" ] && pass "DATABASE_URL set" || err "DATABASE_URL empty"
  as="$(getv AUTH_SECRET)"
  if [ -z "$as" ]; then err "AUTH_SECRET empty"; fx_auth=1
  elif [ "${as#change-me}" != "$as" ]; then err "AUTH_SECRET still the placeholder"; fx_auth=1
  else pass "AUTH_SECRET set"; fi
  ek="$(getv DIRECTORY_ENCRYPTION_KEY)"
  ekl="$(printf %s "$ek" | wc -c | tr -d ' ')"
  if [ -z "$ek" ]; then err "DIRECTORY_ENCRYPTION_KEY empty (app refuses directory configs)"; fx_enc=1
  elif [ "${ek#change-me}" != "$ek" ]; then err "DIRECTORY_ENCRYPTION_KEY still the placeholder"; fx_enc=1
  elif [ "$ekl" -lt 32 ]; then err "DIRECTORY_ENCRYPTION_KEY too short ($ekl chars, need >= 32)"; fx_enc=1
  else pass "DIRECTORY_ENCRYPTION_KEY set ($ekl chars)"; fi
  if [ -n "$(getv AUTH_URL)" ]; then pass "AUTH_URL set"
  else wrn "AUTH_URL empty (defaults to http://localhost:3000)"; fx_authurl=1; fi
  if [ -n "$(getv CRON_SECRET)" ]; then pass "CRON_SECRET set"
  else wrn "CRON_SECRET empty (scheduler endpoint /api/cron returns 503)"; fx_cron=1; fi
  [ -n "$(getv HIBP_API_KEY)" ] && pass "HIBP_API_KEY set" || wrn "HIBP_API_KEY empty (no breach lookups unless a per-company key is stored)"
  rk="$(getv RESEND_API_KEY)"; ef="$(getv EMAIL_FROM)"
  if [ -n "$rk" ] && [ -n "$ef" ]; then pass "email configured (RESEND_API_KEY + EMAIL_FROM)"
  elif [ -z "$rk" ] && [ -z "$ef" ]; then wrn "email disabled (RESEND_API_KEY + EMAIL_FROM unset)"
  else wrn "email half-configured: set both RESEND_API_KEY and EMAIL_FROM or neither"; fi
fi

echo "Docker:"
if command -v docker >/dev/null 2>&1; then pass "docker $(docker --version | awk '{print $3}' | tr -d ',')"
else err "docker not found (needed for the local database)"; fi
if docker compose version >/dev/null 2>&1; then pass "docker compose available"; else wrn "docker compose not available"; fi
if docker info >/dev/null 2>&1; then pass "docker daemon running"; dkr=1
else err "docker daemon not running (start Docker Desktop / enable WSL integration)"; fi
st="$(docker inspect -f '{{.State.Health.Status}}' datashield-db 2>/dev/null || true)"
if [ "$st" = "healthy" ]; then pass "db container healthy"
elif [ -n "$st" ]; then wrn "db container status: $st"
else wrn "db container not found (run 'make db-up')"; [ "$dkr" = "1" ] && fx_dbup=1; fi

echo "Database connectivity:"
du="$(getv DATABASE_URL)"
hp="$(printf %s "$du" | sed -E 's#^[a-z]+://([^@]*@)?([^/?]+).*#\2#')"
host="${hp%%:*}"; port="${hp##*:}"; [ "$port" = "$host" ] && port=5432
if [ -z "$host" ]; then wrn "could not parse host from DATABASE_URL"
elif command -v nc >/dev/null 2>&1; then
  if nc -z -w 2 "$host" "$port" >/dev/null 2>&1; then pass "TCP $host:$port reachable"
  else err "TCP $host:$port not reachable (is the DB up?)"; fi
else wrn "nc not installed, skipping TCP probe ($host:$port)"; fi

echo "Prisma:"
if [ -d node_modules ]; then pass "node_modules installed"; else err "node_modules missing (run 'make install')"; fx_install=1; fi
if [ -d node_modules/.prisma/client ]; then pass "prisma client generated"; else err "prisma client missing (run 'npx prisma generate')"; fx_generate=1; fi
if npx prisma validate >/dev/null 2>&1; then pass "schema valid (prisma validate)"; else err "schema invalid (run 'npx prisma validate' for details)"; fi
ms="$(npx prisma migrate status 2>&1 || true)"
if printf %s "$ms" | grep -q "up to date"; then pass "migrations up to date"
elif printf %s "$ms" | grep -q "have not yet been applied"; then wrn "pending migrations (run 'make migrate')"; fx_migrate=1
elif printf %s "$ms" | grep -qE "P1001|reach|unreachable"; then err "database unreachable for migrate status"
else wrn "migrate status inconclusive (run 'make migrate' / 'npx prisma migrate status')"; fi

echo "================="
echo "Summary: $ok OK, $warn warning(s), $bad failure(s)"
if [ "$bad" -gt 0 ]; then echo "Result: NOT ready."; else echo "Result: ready."; fi

errfix=$((fx_env + fx_auth + fx_enc + fx_install + fx_generate))
warnfix=$((fx_authurl + fx_cron + fx_dbup + fx_migrate))
ans=n
if [ $((errfix + warnfix)) -gt 0 ] && [ -t 0 ]; then
  echo ""
  echo "Auto-fixable: $errfix from failures, $warnfix from warnings."
  printf "Fix now? [e]rrors only / [a]ll / [n]o: "
  read ans
fi

do_err=0; do_warn=0
case "$ans" in
  e | E) do_err=1 ;;
  a | A) do_err=1; do_warn=1 ;;
esac

applied=0
if [ "$do_err" = "1" ]; then
  if [ "$fx_env" = "1" ]; then
    cp .env.example .env.local
    setval AUTH_SECRET "$(openssl rand -base64 32)"
    setval DIRECTORY_ENCRYPTION_KEY "$(openssl rand -base64 32)"
    echo "fixed: created .env.local with generated secrets"; applied=1
  else
    if [ "$fx_auth" = "1" ]; then setval AUTH_SECRET "$(openssl rand -base64 32)"; echo "fixed: AUTH_SECRET"; applied=1; fi
    if [ "$fx_enc" = "1" ]; then setval DIRECTORY_ENCRYPTION_KEY "$(openssl rand -base64 32)"; echo "fixed: DIRECTORY_ENCRYPTION_KEY"; applied=1; fi
  fi
  if [ "$fx_install" = "1" ]; then npm install; applied=1; fi
  if [ "$fx_generate" = "1" ]; then npx prisma generate; applied=1; fi
fi
if [ "$do_warn" = "1" ]; then
  if [ "$fx_authurl" = "1" ]; then setval AUTH_URL "http://localhost:3000"; echo "fixed: AUTH_URL"; applied=1; fi
  if [ "$fx_cron" = "1" ]; then setval CRON_SECRET "$(openssl rand -base64 32)"; echo "fixed: CRON_SECRET"; applied=1; fi
  if [ "$fx_dbup" = "1" ]; then
    npm run db:up
    echo "waiting for db to become healthy"
    i=0
    while [ "$(docker inspect -f '{{.State.Health.Status}}' datashield-db 2>/dev/null || true)" != "healthy" ] && [ "$i" -lt 60 ]; do
      i=$((i + 1)); sleep 1
    done
    applied=1
  fi
  if [ "$fx_migrate" = "1" ]; then npx prisma migrate deploy; applied=1; fi
fi

if [ "$applied" = "1" ]; then
  echo ""
  echo "Fixes applied. Re-run 'make doctor' to verify."
  exit 0
fi
[ "$bad" -eq 0 ]
