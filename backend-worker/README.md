# MaaNote Stage 12 Admin API

Googleログイン、管理者の追加・停止、①見るだけ版＋②入力版への自動配信を担当するCloudflare Workerです。

## 1. Google OAuth
Google Cloud Consoleで「Web application」のOAuthクライアントIDを作成します。

現在のGitHub Pagesを使う場合、Authorized JavaScript origins に:

https://2008e22-eng.github.io

を登録します。

## 2. Cloudflare D1
このフォルダで:

npm install
npx wrangler d1 create maanote-admin-db

表示された database_id を `wrangler.toml` に入れます。

次に:

npx wrangler d1 execute maanote-admin-db --remote --file=./schema.sql

## 3. wrangler.toml
以下を設定します。

- `GOOGLE_CLIENT_ID`: Google OAuth Web Client ID
- `OWNER_EMAIL`: 最初のオーナーのGoogleアカウント
- `ALLOWED_ORIGINS`: 現在は `https://2008e22-eng.github.io`

## 4. Deploy
npx wrangler deploy

表示されたWorker URL（例: `https://maanote-admin-api.xxxxx.workers.dev`）を控えます。

## 5. MaaNote側
ルートの `runtime-config.js` を:

window.MAANOTE_CONFIG = Object.freeze({
  API_BASE: "https://maanote-admin-api.xxxxx.workers.dev",
  GOOGLE_CLIENT_ID: "xxxxxxxx.apps.googleusercontent.com",
  ADMIN_AUTH_ENABLED: true
});

に変更してGitHubへPushします。

## 動作
- ③ `/admin/` はGoogleログイン必須
- `OWNER_EMAIL` は自動的にオーナー
- オーナーは管理者タブから後でメンバーを追加／停止できる
- 通常管理者はイベント編集・公開ができる
- 公開時はD1へ保存され、① `/view/` と② `/` が同じ `/api/common-data` を取得する
- 同時編集時はバージョン競合を検知し、古い画面からの上書きを拒否する
