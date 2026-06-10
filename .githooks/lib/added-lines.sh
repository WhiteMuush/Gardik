#!/usr/bin/env sh
# Emit added lines of a diff as "path:linenumber:content".
# Usage: added-lines.sh staged
#        added-lines.sh range <base-sha>
set -eu

case "${1:-}" in
  staged) diff_cmd='git diff --cached -U0 --diff-filter=ACMR' ;;
  range)  diff_cmd="git diff -U0 --diff-filter=ACMR ${2:?missing base}..HEAD" ;;
  *) echo "usage: added-lines.sh staged | range <base>" >&2; exit 2 ;;
esac

$diff_cmd | awk '
  /^\+\+\+ / { file=$0; sub(/^\+\+\+ b\//, "", file); sub(/^\+\+\+ /, "", file); next }
  /^@@ /     { match($0, /\+[0-9]+/); ln=substr($0, RSTART+1, RLENGTH-1)+0; next }
  /^\+/      { print file ":" ln ":" substr($0, 2); ln++; next }
'
