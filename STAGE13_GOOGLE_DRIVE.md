# MaaNote v0.9 Stage 13 - Google Driveバックアップ / 復元

## ②入力版だけの機能
①見るだけ版にはGoogle Drive連携を入れていません。
③管理者版のGoogle認証とは別用途ですが、同じGoogle OAuth Web Client IDを利用できます。

## 保存方式
- MaaNoteの通常保存先は引き続き端末のIndexedDB
- Google Driveはバックアップ / 端末変更時の復元用
- Google Driveの `appDataFolder` に `MaaNote_personal_backup_v1.json` を1ファイル保存
- `drive.appdata` スコープだけを要求
- Drive内の通常のファイルを読む権限は要求しない
- バックアップは予約画像・ホームヘッダー画像も含む

## 設定
1. Google CloudでDrive APIを有効化
2. Google Auth PlatformでOAuth Web Clientを作成
3. Authorized JavaScript origins:
   `https://2008e22-eng.github.io`
4. Google Auth Platformが Testing の場合、自分と友人のGoogleアカウントをTest usersへ追加
5. `runtime-config.js` を編集:

```js
window.MAANOTE_CONFIG = Object.freeze({
  API_BASE: "",
  GOOGLE_CLIENT_ID: "xxxxxxxx.apps.googleusercontent.com",
  ADMIN_AUTH_ENABLED: false,
  DRIVE_SYNC_ENABLED: true
});
```

管理者APIを有効化済みなら `API_BASE` / `ADMIN_AUTH_ENABLED` はその設定を維持してください。

## 使い方
② MaaNote → 設定 → Google Drive

初回:
- 「Google Driveに接続」
- Googleの許可画面で許可
- 「今すぐバックアップ」

端末変更 / 復旧:
- 新端末で同じGoogleアカウントを使って「Google Driveに接続」
- 「Google Driveから復元」
- 復元内容の件数を確認
- 復元前に現在の端末データを画像込みJSONで自動保存
- 復元実行

## 友人の旧v9.6移行
推奨順:
1. 旧v9.6から移行JSONを作成
2. ②の `/migrate-v96.html` で移行
3. ②を開いて参加状況 / CD / TODO / 旅程を確認
4. Google Driveに接続
5. 「今すぐバックアップ」
6. 一度別ブラウザ / 別端末でDriveから復元できるかテスト

この確認まで終わってから②URLをほかの友人へ案内するのが安全です。


Stage 13.1では手動バックアップ中心から自動バックアップ方式へ変更しました。詳細は `STAGE13_1_AUTO_BACKUP.md` を参照してください。
