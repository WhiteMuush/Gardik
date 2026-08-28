#!/usr/bin/env sh
# Reject non-ASCII bytes anywhere in the tracked tree.
#
# check-ascii.sh reads a diff, so it only ever sees lines a commit adds.
# Anything written before that hook existed was never inspected, and the debt
# it missed kept compiling: French comments in the SCIM routes, box-drawing
# separators, em dashes in user-facing strings. This walks every tracked text
# file instead, so the rule is true of the repository rather than of the last
# patch.
#
# Run in CI rather than on every commit: it reads the whole tree, and the diff
# check already covers the fast path.
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
