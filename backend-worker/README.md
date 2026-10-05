# MaaNote Stage 15 Backend

Stage 15ではGoogle Driveバックアップの認証をブラウザ直結方式から、
Cloudflare Worker経由のサーバーOAuthへ変更します。

## 目的
Googleの短時間アクセストークンをブラウザへ長期保存しません。
初回Google認証で取得したrefresh tokenをWorker側で暗号化保存し、
以後はWorkerが必要に応じてGoogleのaccess tokenを更新します。

利用者は通常、最初のGoogleログインだけで済みます。

## 必要なGoogle Cloud設定
OAuth Web Clientに次を追加します。

### Authorized JavaScript origin
https://2008e22-eng.github.io

### Authorized redirect URI
Workerをdeployした後のURL:
https://<あなたのWorker>.workers.dev/api/drive/oauth/callback

Google Drive APIを有効化し、OAuth Data Accessに:
https://www.googleapis.com/auth/drive.appdata
を追加してください。

## D1更新
既存DBに対してもう一度schema.sqlを実行します。

npx wrangler d1 execute maanote-admin-db --remote --file=./schema.sql

CREATE TABLE IF NOT EXISTSなので既存の管理者データ・配信データは消しません。

## Secrets
Google CloudのOAuth Client Secret:
npx wrangler secret put GOOGLE_CLIENT_SECRET

refresh token暗号化用32-byte keyを作成:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

表示された値を:
npx wrangler secret put DRIVE_TOKEN_KEY

へ設定します。

## Deploy
npx wrangler deploy

deploy後のWorker URLをGoogle CloudのAuthorized redirect URIへ登録してください。

## runtime-config.js
本番maanote側:

window.MAANOTE_CONFIG = Object.freeze({
  ENV: "production",
  API_BASE: "https://<あなたのWorker>.workers.dev",
  GOOGLE_CLIENT_ID: "<現在の正しいClient ID>",
  ADMIN_AUTH_ENABLED: false,
  DRIVE_SYNC_ENABLED: true
});

ADMIN_AUTH_ENABLEDは管理者ログインの準備が終わるまでfalseのままで構いません。

## セキュリティ
- Google refresh tokenはブラウザへ返しません。
- D1にはAES-GCMで暗号化して保存します。
- ブラウザにはMaaNote専用のランダムなセッショントークンのみ保存します。
- セッションは利用中なら期限を延長します。
- Drive権限はdrive.appdataだけです。
