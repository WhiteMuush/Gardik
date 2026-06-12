#!/usr/bin/env sh
# Detect secrets in added lines. Reads "path:line:content" on stdin.
set -eu
status=0

patterns='-----BEGIN ([A-Z ]+ )?PRIVATE KEY-----'
patterns="$patterns|AKIA[0-9A-Z]{16}"
patterns="$patterns|gh[pousr]_[0-9A-Za-z]{36,}"
patterns="$patterns|xox[baprs]-[0-9A-Za-z-]{10,}"
# OpenAI
patterns="$patterns|sk-[A-Za-z0-9]{20,}"
# Anthropic
patterns="$patterns|sk-ant-[A-Za-z0-9_-]{20,}"
# Google AI (Gemini / PaLM)
patterns="$patterns|AIza[0-9A-Za-z_-]{35}"
# Hugging Face
patterns="$patterns|hf_[A-Za-z0-9]{34,}"
# Replicate
patterns="$patterns|r8_[A-Za-z0-9]{36,}"
# Groq
patterns="$patterns|gsk_[A-Za-z0-9]{48,}"
# Mistral
patterns="$patterns|[A-Za-z0-9]{32}\.mistral\."
# DATABASE_URL with inline credentials
patterns="$patterns|(postgresql|mysql|mongodb)://[^:]+:[^@]{4,}@"
patterns="$patterns|(AUTH_SECRET|DIRECTORY_ENCRYPTION_KEY)[[:space:]]*[:=][[:space:]]*[\"'][^\"']{12,}"

while IFS= read -r entry; do
  path=${entry%%:*}
  case "$path" in
    .githooks/*) continue ;;
    # Example env files hold placeholder credentials by design.
    .env.example|*.env.example) continue ;;
  esac
  rest=${entry#*:}; content=${rest#*:}
  if printf '%s' "$content" | grep -qEe "$patterns"; then
    echo "Possible secret: ${path}:${rest%%:*}"
    status=1
  fi
done

exit $status
