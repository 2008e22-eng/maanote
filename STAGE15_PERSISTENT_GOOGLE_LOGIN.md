# MaaNote v0.9 Stage 15 PROD

## 変更点
②のGoogle Drive認証を「ブラウザがGoogle Driveへ直接アクセス」する方式から
「Cloudflare WorkerがGoogleのrefresh tokenを安全に保持する方式」へ変更。

### 利用者側
初回:
1. Googleでログイン
2. Googleアカウントを選択
3. Driveバックアップを許可

通常は以後の再ログイン不要です。

ページ更新、Google access tokenの約1時間の期限切れ、アプリの再起動ごとに
Google認証画面を出すことはありません。

### 別端末
新端末で②を開く
→ Googleでログイン
→ 同じアカウントを選択
→ Driveバックアップが見つかれば復元確認

### 保存
端末IndexedDBが本体。
オンライン時にWorker経由でGoogle Drive appDataFolderへ自動バックアップ。
