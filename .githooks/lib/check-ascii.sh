#!/usr/bin/env sh
# Reject non-ASCII bytes (em dash, accented letters, smart quotes) in added
# lines. Reads "path:line:content". Stricter superset of check-english.sh.
set -eu
status=0

while IFS= read -r entry; do
  path=${entry%%:*}
  case "$path" in
    *.png|*.jpg|*.jpeg|*.gif|*.ico|*.svg|*.woff|*.woff2|*.ttf) continue ;;
    package-lock.json|*.lock) continue ;;
  esac
  rest=${entry#*:}; content=${rest#*:}
  if printf '%s' "$content" | LC_ALL=C grep -q '[^[:print:][:space:]]'; then
    echo "Non-ASCII character: ${path}:${rest%%:*}"
    status=1
  fi
done

exit $status
