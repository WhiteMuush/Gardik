#!/usr/bin/env sh
# Validate a single commit message: Conventional Commits + no AI attribution.
# Usage: check-commit-msg.sh <path-to-message-file>
set -eu

msg_file="${1:?usage: check-commit-msg.sh <message-file>}"
header="$(sed -n '1p' "$msg_file")"
status=0

# Skip merge and revert commits: they are generated, not authored.
case "$header" in
  "Merge "*|"Revert "*|"fixup! "*|"squash! "*) exit 0 ;;
esac

# 1. Conventional Commits header: type(scope): lowercase description, no period.
fmt='^(feat|fix|chore|docs|refactor)(\([a-z0-9._-]+\))?: [a-z].*[^.]$'
if ! printf '%s' "$header" | grep -qE "$fmt"; then
  echo "Commit header is not a valid Conventional Commit:"
  echo "  \"$header\""
  echo "  Expected: <feat|fix|chore|docs|refactor>(optional-scope): lowercase summary"
  echo "  No trailing period, no emoji, description starts lowercase."
  status=1
fi

# 2. Header length cap keeps history readable.
if [ "$(printf '%s' "$header" | wc -c)" -gt 72 ]; then
  echo "Commit header exceeds 72 characters."
  status=1
fi

# 3. No AI attribution anywhere in the message.
ai='Co-[Aa]uthored-[Bb]y|Generated with|noreply@anthropic\.com|Claude Code|ChatGPT|Copilot|AI-generated'
if grep -qE "$ai" "$msg_file"; then
  echo "AI attribution is forbidden in commit messages. Offending lines:"
  grep -nE "$ai" "$msg_file" | sed 's/^/  /'
  status=1
fi

# 4. No non-ASCII (emoji, accents) in the message.
if ! perl -ne 'exit 1 if /[^\x00-\x7F]/' "$msg_file"; then
  echo "Commit message contains non-ASCII characters (emoji or accents are forbidden)."
  status=1
fi

exit $status
