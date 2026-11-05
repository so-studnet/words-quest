# 設定の手順（Supabase と Vercel）

Words Quest を公開して使うための設定。ブラウザだけでできる。

## 公開してよい値と秘密の値

| 値 | 例 | 扱い |
|---|---|---|
| Supabase の Project URL | `https://abcd1234.supabase.co` | 公開してよい |
| Supabase の **Publishable key** | `sb_publishable_...` | 公開してよい（ログイン機能でブラウザに載る。データは RLS で守る） |
| Supabase の **Secret key** | `sb_secret_...` | **秘密**。Vercel の環境変数にだけ入れる。会話・スクリーンショット・GitHub に出さない |
| Groq の API キー | `gsk_...` | **秘密**。同上 |

ログインのパスワードは自分で決めて Supabase に入力するだけ。会話には書かない。

## 1. Supabase のプロジェクトを作る

1. https://supabase.com を開き、右上の **Start your project**（またはサインイン）→ **Continue with GitHub**
2. 初回は組織（Organization）を作る画面が出る。名前は何でもよい。Plan は **Free**
3. **New project** を押す
   - **Project name**：`words-quest`
   - **Database Password**：**Generate a password** を押す（このアプリでは使わないが、念のためメモしておく）
   - **Region**：**Northeast Asia (Tokyo)**
   - **Enable Data API** のようなチェックがあれば **オンのまま**にする（アプリがこれを使う）
4. **Create new project** を押し、準備が終わるまで1〜2分待つ

## 2. テーブルを作る（SQL Editor）

1. 左のメニューの **SQL Editor**（`>_` のアイコン）を押す
2. 上の **+**（New query / New SQL snippet）を押す
3. GitHub の `supabase/migrations/20261104000000_cache_and_rate_limits.sql` を開き、右上のコピーのボタン（Copy raw file）で全文をコピーして貼り付ける
4. 右下の **Run**（または `Ctrl + Enter`）を押す
5. 下に **Success. No rows returned** と出れば完了。確認として、左のメニューの **Table Editor** に `lookups` と `rate_limits` が出ていること

## 3. 接続情報を確かめる

- **Project URL**：左下の歯車 **Project Settings** → **Data API**（または **API**）の **Project URL**。上の緑の **Connect** ボタンからも見られる
- **Secret key**：**Project Settings** → **API Keys** → **Secret keys** の欄。`default` の行の目のアイコン（Reveal）を押して表示し、コピーのアイコンでコピーする。**この画面のスクリーンショットは送らない**

## 4. Vercel に環境変数を入れる

1. Vercel のダッシュボードで `words-quest` を開く
2. 上のタブの **Settings** → 左の **Environment Variables**
3. 次の2つを1つずつ追加する（**Key** と **Value** を入れて **Save**）。Environments は **Production** と **Preview** にチェック

   | Key | Value | Sensitive |
   |---|---|---|
   | `SUPABASE_URL` | Project URL | オフでよい |
   | `SUPABASE_SECRET_KEY` | Secret key | **オン** |

4. 上のタブの **Deployments** → 一番上の行の右端の **⋯** → **Redeploy** → **Redeploy**（環境変数は再デプロイしないと反映されない）

## 5. 動いているか確かめる

1. 公開中のサイトで同じ語を2回検索する。2回目はすぐに結果が出る
2. Supabase の **Table Editor** → `lookups` に検索した語の行がある。もう一度検索すると `hits` が増える
3. SQL Editor で次を実行すると、最近の検索が見られる

   ```sql
   select key, kind, hits, created_at from public.lookups order by created_at desc limit 20;
   ```

## 6. ログインと学習記録を使う（M5.1〜）

### 6-1. 表を足す（SQL Editor）

1. Supabase の左のメニューの **SQL Editor** → 上の **+**
2. GitHub の `supabase/migrations/20261105000000_study_log.sql` の全文を貼り付けて **Run**
3. **Success. No rows returned** と出て、**Table Editor** に `study_items` と `study_events` が増えていれば完了

手順2の `20261104000000_cache_and_rate_limits.sql` がまだなら、そちらを先に実行する（ファイル名の日付の順）。

### 6-2. 自分のアカウントを作る

1. 左のメニューの **Authentication**（人のアイコン）→ **Users**
2. 右上の **Add user** → **Create new user**
3. **Email address** と **Password** を入れ、**Auto Confirm User** にチェックを入れて **Create user**

### 6-3. 新規登録をできないようにする

1. **Authentication** → 左の **Sign In / Providers**（または **Providers**）
2. 上のほうの **Allow new users to sign up** をオフにして **Save changes**

これで、6-2 で作ったアカウント以外はログインできない。

### 6-4. Publishable key を確かめる

**Project Settings** → **API Keys** の **Publishable key** の欄（`sb_publishable_...`）。右のコピーのアイコンでコピーする。

### 6-5. Vercel に入れる

**Settings** → **Environment Variables** に次の2つを追加し、**Redeploy** する（`NEXT_PUBLIC_` の値はビルドのときに埋め込まれるので、Redeploy しないと反映されない）。

| Key | Value | Sensitive |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL（`SUPABASE_URL` と同じ値） | オフ |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key | オフ |

### 6-6. 確かめる

1. 公開中のサイトのトップの右上に **Sign in** が出る → 押して 6-2 のメールアドレスとパスワードでログイン
2. 画面の下に **Search / Learned / Review** のタブが出る
3. 何か検索してから **Learned** を開くと、Today の一覧に出る
4. 翌日以降、**Review** に復習の数が出る

## 回数制限（変えたいとき）

AI に問い合わせる回数だけを数える（保存済みの結果は数えない）。Vercel の Environment Variables で変えられる。

| Key | 意味 | 既定 |
|---|---|---|
| `RATE_LIMIT_PER_HOUR` | 1つの IP アドレスから1時間に AI に問い合わせられる回数 | 30 |
| `AI_DAILY_LIMIT` | サイト全体で1日（UTC）に AI に問い合わせる回数 | 500 |

## 別のサイトから API を使う

自分の別サイトのブラウザ（JavaScript）から呼ぶときは、そのサイトのアドレスを許可する。サーバーから呼ぶとき（Next.js の Route Handler や curl など）は設定不要。

1. Vercel の `words-quest` → **Settings** → **Environment Variables**
2. **Key** に `ALLOWED_ORIGINS`、**Value** に別サイトのアドレス（例 `https://my-blog.vercel.app`）。複数ならカンマで区切る（`https://a.vercel.app,https://b.example.com`）。末尾の `/` やページのパスはあってもなくてもよい
3. **Save** → **Deployments** → 一番上の **⋯** → **Redeploy**

使い方は公開中のサイトの `/docs/api`（トップ画面の一番下の「API」）に英語で書いてある。

## 困ったとき

| 症状 | 原因と対処 |
|---|---|
| 2回目も遅い・`lookups` に行が増えない | Vercel の環境変数が入っていないか、Redeploy していない。Vercel の **Logs** に `[cache]` の行があれば、そのスクリーンショットを送る |
| Logs に `relation "public.lookups" does not exist` | 手順2の SQL を実行していない |
| Logs に `Invalid API key` | `SUPABASE_SECRET_KEY` が違う（Publishable key を入れていないか確かめる） |
| トップに **Sign in** が出ない | `NEXT_PUBLIC_SUPABASE_URL` か `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` が入っていないか、Redeploy していない |
| 「Wrong email or password.」 | 6-2 で作ったメールアドレス・パスワードと違う。Supabase の **Users** でパスワードを変えられる（ユーザーの行の **⋯** → **Send password recovery** は無料枠のメールを使うので、作り直すほうが確実） |
| 「This email address is not confirmed yet.」 | 6-2 で **Auto Confirm User** にチェックしていなかった。ユーザーを消して作り直す |
| Learned に「Could not load your study log.」 | 6-1 の SQL を実行していない。実行したら **Reload** |
| 別サイトから呼ぶと `forbidden_origin`、またはブラウザのコンソールに CORS のエラー | `ALLOWED_ORIGINS` にそのサイトが入っていない（`http` と `https` の違いにも注意）。入れたら Redeploy |
| 「Lookup limit reached.」が出る | 回数制限に達した。1時間（全体なら翌日の午前9時、日本時間）で戻る |
| しばらく使っていなかったら保存されない | Supabase の無料プロジェクトは1週間使わないと一時停止する。Supabase のダッシュボードでプロジェクトを開き **Restore project** を押す。停止中も検索は AI に直接問い合わせて動く |
