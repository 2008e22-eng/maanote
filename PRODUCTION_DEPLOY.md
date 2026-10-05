# MaaNote v0.9 Stage 14 PROD - 本番環境

このZIPは `maanote-test` を上書きするためのものではありません。
新しいGitHubリポジトリ `maanote` に展開して、本番用として使います。

## URL
GitHubユーザー名が `2008e22-eng`、本番リポジトリ名が `maanote` の場合:

### ① 見るだけ版（一般公開）
https://2008e22-eng.github.io/maanote/view/

Twitter等で広く案内するURLです。

### ② 見る / 入力を選べる版
https://2008e22-eng.github.io/maanote/

自分・友人向けです。
本番用IndexedDB `MaaNoteProdDB` を使うため、`maanote-test` にある自分のテストデータは勝手に表示されません。

### ③ 管理者版
https://2008e22-eng.github.io/maanote/admin/

管理者向けです。
Google管理者認証を有効にするまではURLを広く共有しないでください。

## テスト版はそのまま残す
https://2008e22-eng.github.io/maanote-test/

本番版とは以下を分離しています。
- IndexedDB
- localStorageバックアップ
- 管理者DB
- Google Driveバックアップファイル名
- Service Workerキャッシュ

GitHub Pagesは `/maanote/` と `/maanote-test/` が同じ `2008e22-eng.github.io` オリジンになるため、
この分離を入れないとブラウザ保存データが混ざる可能性があります。

## 初回公開手順
1. GitHubで新しい公開リポジトリ `maanote` を作る
2. このZIPの中身をリポジトリ直下へ配置
3. Commit / Push
4. GitHub → Settings → Pages
5. Deploy from a branch → `main` / `/ (root)`
6. Pagesの公開完了を待つ
7. ①②③のURLをそれぞれ確認

## 現在のイベント情報を本番へ入れる
方法A（おすすめ）:
- 本番③ `/maanote/admin/` でイベント情報を入力
- 「配信用JSON」で `common-data.json` を保存
- 本番リポジトリ `maanote` の `common-data.json` を上書き
- Commit / Push
- ①と②の両方に配信

方法B:
- テスト③で「配信用JSON」を保存
- その `common-data.json` を本番リポジトリへ入れる
- テストで確認済みの共通イベント情報をそのまま本番へ移せます

個人データは `common-data.json` には含まれません。

## ②へ自分の個人データを移す場合
本番②は最初は空です。
テストデータを自動コピーしない設計にしています。

Google Drive連携を有効にする前は、必要に応じてテスト版からJSONバックアップを保存してください。
旧v9.6からの移行は本番の:
https://2008e22-eng.github.io/maanote/migrate-v96.html
を使用します。

## Google機能
Stage 14 PRODでは安全のためまだ:
- ADMIN_AUTH_ENABLED: false
- DRIVE_SYNC_ENABLED: false
です。

Google Cloud / Cloudflareの本番設定が終わったら `runtime-config.js` を変更して有効化します。
