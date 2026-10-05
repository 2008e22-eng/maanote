# MaaNote v0.9 Stage 12

## 今回追加したもの
- ③管理者版のGoogleログイン
- オーナー / 管理者の2権限
- オーナーによる管理者の追加・停止
- ③の「公開」から①見るだけ版・②入力版への自動配信
- 複数管理者の同時更新競合チェック
- Cloudflare Worker + D1 のバックエンド雛形

## 重要
ZIPをそのままGitHubへ上げただけでは、まだGoogle認証はONになりません。

最初は `runtime-config.js` が:
- API_BASE = 空
- GOOGLE_CLIENT_ID = 空
- ADMIN_AUTH_ENABLED = false

なので、従来どおりローカル管理＋配信用JSON方式で動きます。

`backend-worker/README.md` の手順でGoogle OAuthとCloudflare Workerを用意し、
`runtime-config.js` に値を入れて `ADMIN_AUTH_ENABLED: true` にすると、
③がGoogleログイン必須＋自動配信モードへ切り替わります。

## 管理者
最初のオーナーはCloudflare Workerの `OWNER_EMAIL` で設定します。
ログイン後、③の「管理者」タブから後で管理者を追加・停止できます。

## 次
Stage 13で②のGoogle Drive同期を実装し、
友人2人の旧v9.6データ移行前に、バックアップ／端末変更の復元まで確認する予定です。
