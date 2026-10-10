#!/usr/bin/env bash
# .github/workflows/ の決まりの検査（CI と、ワークフローを触る PR の前に手元で走らせる）。
#   - 外部の Action（uses: owner/repo@ref）は 40 桁の commit SHA で固定する
#   - pull_request_target・npx・npm exec を使わない
#   - 必須チェックのジョブ名「CI result」を消さない
set -euo pipefail
cd "$(dirname "$0")/../.."
status=0
shopt -s nullglob
files=(.github/workflows/*.yml .github/workflows/*.yaml)
if [ ${#files[@]} -eq 0 ]; then
  echo "ワークフローがない"
  exit 1
fi
for f in "${files[@]}"; do
  while IFS= read -r line; do
    ref="${line#*uses:}"
    ref="${ref%%#*}"
    ref="$(echo "$ref" | tr -d " \"'")"
    case "$ref" in
      ./*|docker://*) continue ;;
    esac
    if ! [[ "$ref" =~ @[0-9a-f]{40}$ ]]; then
      echo "$f: commit SHA で固定されていない: $ref"
      status=1
    fi
  done < <(grep -E '^[[:space:]-]*uses:' "$f" || true)
  if grep -nE 'pull_request_target|(^|[[:space:]])npx[[:space:]]|npm[[:space:]]+exec' "$f"; then
    echo "$f: pull_request_target・npx・npm exec は使わない"
    status=1
  fi
done
if ! grep -qE '^[[:space:]]+name:[[:space:]]*CI result[[:space:]]*$' .github/workflows/ci.yml; then
  echo ".github/workflows/ci.yml: 必須チェックのジョブ「CI result」がない"
  status=1
fi
if [ $status -eq 0 ]; then
  echo "ワークフローの決まり: 問題なし"
fi
exit $status
