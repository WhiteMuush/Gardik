#!/usr/bin/env sh
# Detect secrets in added lines. Reads "path:line:content" on stdin.
set -eu
status=0

patterns='-----BEGIN ([A-Z ]+ )?PRIVATE KEY-----'
patterns="$patterns|AKIA[0-9A-Z]{16}"
patterns="$patterns|gh[pousr]_[0-9A-Za-z]{36,}"
patterns="$patterns|xox[baprs]-[0-9A-Za-z-]{10,}"
patterns="$patterns|sk-[A-Za-z0-9]{20,}"
patterns="$patterns|(AUTH_SECRET|DIRECTORY_ENCRYPTION_KEY)[[:space:]]*[:=][[:space:]]*[\"'][^\"']{12,}"

while IFS= read -r entry; do
  path=${entry%%:*}
  case "$path" in
    .githooks/*) continue ;;
  esac
  rest=${entry#*:}; content=${rest#*:}
  if printf '%s' "$content" | grep -qEe "$patterns"; then
    echo "Possible secret: ${path}:${rest%%:*}"
    status=1
  fi
done

exit $status
