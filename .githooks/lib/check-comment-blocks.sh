#!/usr/bin/env sh
# Block code comments longer than one line, the rule is one sentence. Reads "path:line:content" on stdin.
set -eu

awk '
  {
    path = $0; sub(/:.*/, "", path)
    rest = substr($0, length(path) + 2)
    lineno = rest; sub(/:.*/, "", lineno); lineno += 0
    content = substr(rest, index(rest, ":") + 1)
  }
  path ~ /^\.githooks\// || path !~ /\.(ts|tsx|js|jsx|mjs|cjs)$/ { next }
  # Tool directives are not prose, so they never count toward a block.
  content ~ /^[ \t]*\/\/[ \t]*(eslint-|@ts-|prettier-ignore)/ { next }
  content ~ /^[ \t]*\/\// {
    if (path == last_path && lineno == last_line + 1) { print "Comment longer than one line: " path ":" lineno; bad = 1 }
    last_path = path; last_line = lineno
    next
  }
  content ~ /^[ \t]*\{?\/\*/ && content !~ /\*\// { print "Comment longer than one line: " path ":" lineno; bad = 1 }
  END { exit bad }
'
