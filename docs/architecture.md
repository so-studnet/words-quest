# 設計（Words Quest）

## 技術構成

| 役割 | 使うもの | 理由 |
|---|---|---|
| 画面・API | Next.js 16（App Router）+ TypeScript + Tailwind CSS 4 | 画面と API（Route Handler）を1つのプロジェクトで書ける。情報が多く Claude と相性が良い |
| 生成 AI | Groq API（無料プラン） | カードなしで使え、1日あたりの回数が多く、応答が速い。API への入力を学習に使わない方針 |
| キャッシュ・回数制限 | Supabase（PostgreSQL・無料プラン）※段階4から | 無料。サーバーからだけ読み書きする |
| 公開 | Vercel（Hobby・無料） | GitHub に push するだけで公開される |
| テスト | Vitest（ロジック）、Playwright（画面の確認） | |
| 通知 ※段階6から | PWA + Web Push + Supabase pg_cron | |

使っていないもの：辞書 API（Free Dictionary API・Datamuse）。全部 AI に任せる方針にしたため。発音記号の精度が足りなければ後から足す。

### AI の選定メモ（2026年11月時点。数値は変わるので各サービスの画面で確認する）
- **Groq**：無料プランは多くのモデルで 1日 1,000 リクエスト前後・1分 30 リクエスト前後、1日のトークン数にも上限あり。サービス契約上、API の入力・出力を学習に使わない。弱点はモデルの入れ替え（提供終了）が多いことと、1日のトークン上限。→ モデル名は環境変数 `GROQ_MODEL` で差し替えられるようにする
- **Google Gemini**：無料枠は Flash-Lite 系で 1日 数百〜1,500 リクエスト程度（モデル・時期で変わり、何度も引き下げられている）。無料枠では入力・出力が Google の製品改善に使われ、人が読むことがある
- 結論：Groq を使う。`AiProvider` インターフェースの裏に隠し、Gemini 版も後から書けるようにする

## 処理の流れ

```
画面（SearchForm、URL の ?q= で状態を持つ） ──fetch──▶ GET /api/v1/lookup?q=...
                                 │ parseQuery（入力の検証・種類の判定）
                                 │ キャッシュ（Supabase）にあれば返す
                                 │ 回数制限の確認
                                 │ AiProvider（Groq）に JSON で問い合わせ
                                 │ 応答を検証して LookupResult に整形
                                 └ キャッシュに保存して返す
```

## 環境変数

| 名前 | 内容 | 公開してよいか |
|---|---|---|
| `GROQ_API_KEY` | Groq の API キー（`gsk_...`） | 秘密。サーバーだけ |
| `GROQ_MODEL` | 使うモデル（省略時 `openai/gpt-oss-120b`） | 公開してよい |
| `GROQ_BASE_URL` | テスト用に偽の Groq サーバーへ向けるときだけ使う | ― |

## API

`GET /api/v1/lookup?q=<入力>`

| 状態 | 本文 |
|---|---|
| 200 | `LookupResult` |
| 400 `invalid_query` | 入力が空・英語以外・長すぎる |
| 404 `not_found` | AI が「そんな語はない」と判断した |
| 429 `rate_limited` | Groq の回数制限に達した |
| 502 `upstream_error` / `invalid_response` | Groq に届かない・応答が読めない（読めないときは1回だけ聞き直す） |
| 503 `not_configured` | `GROQ_API_KEY` が設定されていない、またはキーが無効 |

エラーの本文は `{ "error": { "code", "message" } }`。

## データモデル

- `LookupResult`（`src/lib/domain/lookup-result.ts`）：画面と API が共通で使う結果の形
- Supabase のテーブル（段階4で作る）
  - `lookups`：`key`（小文字化した入力・主キー）、`kind`、`result`（jsonb）、`model`、`created_at`
  - `rate_limits`：IP（ハッシュ化）と時間枠ごとの回数
  - RLS を有効にしてポリシーは作らない（ブラウザからは読み書きできず、サーバーの Secret key だけが使う）

## 設計のポイント
- 入力の判定・AI 応答の検証と整形・回数制限の判定など、間違えやすいロジックは `src/lib/domain/` の純粋関数にして Vitest で固める
- AI の呼び出しは `AiProvider` インターフェースの裏に隠す。テストでは偽の Provider を使う
- 秘密の値はサーバー側（Route Handler）でだけ使う
- 履歴はブラウザ内保存（localStorage のキー `wq:history:v1`）。`src/lib/history-store.ts` が `useSyncExternalStore` 用のストアで、別タブの変更も反映する。追加・削除・復元は `src/lib/domain/history.ts` の純粋関数

## ディレクトリ構成

```
docs/                 要件・設計・進め方
scripts/check.sh      コミット前のチェック一式
src/app/              画面（App Router）と API（app/api/v1/...）
src/components/       画面の部品
src/lib/domain/       純粋関数とその型・テスト（入力の判定、プロンプト、AI 応答の検証、エラーの対応表）
src/lib/ai/           AI の Provider（provider.ts がインターフェース、groq.ts が Groq 実装）
src/lib/lookup.ts     検索の流れ（Provider を受け取るのでテストで差し替えられる）
```
