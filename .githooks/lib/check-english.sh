#!/usr/bin/env sh
# Enforce English-only: no accented letters in added lines. Reads "path:line:content".
set -eu
status=0

while IFS= read -r entry; do
  path=${entry%%:*}
  case "$path" in
    *.png|*.jpg|*.jpeg|*.gif|*.ico|*.svg|*.woff|*.woff2|*.ttf) continue ;;
    package-lock.json|*.lock) continue ;;
  esac
  rest=${entry#*:}; content=${rest#*:}
  if printf '%s' "$content" | perl -ne 'exit 1 if /[\x{00C0}-\x{017F}]/'; then
    :
  else
    echo "Non-English (accented) characters: ${path}:${rest%%:*}"
    status=1
  fi
done

exit $status
