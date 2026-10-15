#!/usr/bin/env sh
# Rejects non-ASCII anywhere in the tracked tree, which the diff check never sees (run by npm run check, not per commit).
set -eu

status=0
list="$(mktemp)"
trap 'rm -f "$list"' EXIT
git ls-files > "$list"

while IFS= read -r path; do
  case "$path" in
    *.png|*.jpg|*.jpeg|*.gif|*.ico|*.svg|*.woff|*.woff2|*.ttf) continue ;;
    package-lock.json|*.lock) continue ;;
  esac
  [ -f "$path" ] || continue

  hits="$(LC_ALL=C grep -n '[^[:print:][:space:]]' "$path" || true)"
  [ -n "$hits" ] || continue

  printf '%s\n' "$hits" | while IFS= read -r hit; do
    echo "Non-ASCII character: ${path}:${hit%%:*}"
  done
  status=1
done < "$list"

if [ "$status" -ne 0 ]; then
  echo "The tree must stay ASCII-only. Replace the characters listed above."
fi

exit $status
