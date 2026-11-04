# Words Quest

英語の単語・熟語・イディオム・文章を英語で説明する Web サイト（Next.js + Groq + Supabase + Vercel）。

@AGENTS.md

## ドキュメント
- `docs/requirements.md`：要件（F1〜）と決めた点
- `docs/architecture.md`：技術構成・処理の流れ・データモデル
- `docs/roadmap.md`：マイルストーンと状態

## 開発ルール
- サイトの UI 文言・結果・エラーメッセージはすべて英語。ドキュメントとユーザーへの説明は日本語
- 間違えやすいロジックは `src/lib/domain/` の純粋関数にし、Vitest のテストを書く
- 画面と API は共通の `LookupResult` だけを扱う。AI 固有の形は Provider の中で変換する
- 秘密の値（`GROQ_API_KEY`、Supabase の Secret key）はサーバー側だけで使う。`NEXT_PUBLIC_` を付けない。会話やコミットに含めない
- 無料枠の範囲で動かす（有料になる設定はしない）
- 仕様を変えたら docs も更新する。roadmap の状態は正確に書く
- ユーザーの PC は Windows（PowerShell）。コマンドを案内するときは PowerShell で動く形にする

## コミット前のチェック
```bash
npm run check   # 単体テスト・lint・型チェック・本番ビルド
```
画面を変えたら Playwright でスマホ幅（ライト・ダーク）を操作して確かめる。
