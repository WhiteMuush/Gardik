#!/usr/bin/env sh
# Block patterns an AI commonly leaves behind. Reads "path:line:content" on stdin.
set -eu
status=0

match() { printf '%s' "$2" | grep -qEe "$1"; }

while IFS= read -r entry; do
  path=${entry%%:*}
  case "$path" in
    .githooks/*) continue ;;
  esac
  rest=${entry#*:}; lineno=${rest%%:*}; content=${rest#*:}
  loc="${path}:${lineno}"

  # Em dash: AI writing tell, banned project-wide. Use a comma instead.
  case "$path" in
    *.png|*.jpg|*.jpeg|*.gif|*.ico|*.woff|*.woff2|*.ttf|package-lock.json|*.lock) ;;
    *) if printf '%s' "$content" | perl -ne 'exit 1 if /\x{2014}/'; then :; else
         echo "Em dash (use a comma): $loc"; status=1
       fi ;;
  esac

  case "$path" in
    *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs) ;;
    *) continue ;;
  esac

  match 'as unknown as ' "$content" && { echo "Double cast 'as unknown as': $loc"; status=1; }
  match '@ts-nocheck' "$content" && { echo "'@ts-nocheck' forbidden: $loc"; status=1; }
  match '\$(queryRawUnsafe|executeRawUnsafe)' "$content" && { echo "Unsafe raw SQL: $loc"; status=1; }
  match 'prisma +db +push' "$content" && { echo "'prisma db push' forbidden: $loc"; status=1; }

  case "$path" in
    prisma/seed*|scripts/*) ;;
    *) match 'console\.log\(' "$content" && { echo "Leftover console.log: $loc"; status=1; } ;;
  esac
done

exit $status
