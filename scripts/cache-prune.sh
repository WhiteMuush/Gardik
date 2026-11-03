#!/usr/bin/env sh
# Deletes the GitHub Actions caches no run can read anymore, so the repository stays under its 10 GB quota.
set -eu

FAMILIES='["node-cache-","nextjs-","trivy-binary-","gitleaks-cache-"]'

# Prints "id<TAB>MB<TAB>ref<TAB>key" for each cache of a closed pull request or superseded by a newer one of its family on the same ref.
stale_caches() {
  open="$(gh pr list --state open --limit 500 --json number --jq '[.[].number | tostring]')"
  gh cache list --limit 5000 --json id,key,ref,createdAt,sizeInBytes |
    jq -r --argjson open "$open" --argjson families "$FAMILIES" '
      map(. as $c | . + {family: ($families | map(select(. as $p | $c.key | startswith($p))) | first)})
      | (map(select(.ref | test("^refs/pull/"))
          | select((.ref | capture("^refs/pull/(?<n>[0-9]+)/").n) as $n | $open | index($n) | not)))
        + (map(select(.family != null)) | group_by([.ref, .family]) | map(sort_by(.createdAt) | .[:-1]) | add // [])
      | unique_by(.id)
      | .[] | "\(.id)\t\(.sizeInBytes / 1048576 | floor)\t\(.ref)\t\(.key)"'
}

prune() {
  stale="$(stale_caches)"
  if [ -z "$stale" ]; then
    echo "[cache-prune] nothing to delete"
    return
  fi
  verb="deleted"
  [ -n "${DRY_RUN:-}" ] && verb="would delete"
  total=0
  tab="$(printf '\t')"
  while IFS="$tab" read -r id mb ref key; do
    [ -z "${DRY_RUN:-}" ] && gh cache delete "$id" >/dev/null
    echo "[cache-prune] $verb ${mb} MB $ref $key"
    total=$((total + mb))
  done <<EOF
$stale
EOF
  echo "[cache-prune] $verb ${total} MB in total"
}

main() {
  prune
}

main "$@"
