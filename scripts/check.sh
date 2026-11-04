#!/usr/bin/env bash
# コミット前のチェックをまとめて実行する。どれかが失敗したらそこで止まる。
#   npm run check          # すべて
#   SKIP_DB=1 npm run check  # PostgreSQL がない環境（DB テストは段階4から）
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

step() { printf '\n=== %s ===\n' "$1"; }

step "単体テスト (Vitest)"
npm test --silent

step "lint"
npm run lint --silent

step "型チェック"
npm run typecheck --silent

if [ "${SKIP_DB:-}" != "1" ] && grep -q "\"test:db\"" package.json; then
  step "DB テスト (マイグレーションと RLS)"
  npm run test:db --silent
fi

step "本番ビルド"
rm -rf .next
npm run build --silent >/dev/null
rm -rf .next

printf '\nすべてのチェックが通りました\n'
