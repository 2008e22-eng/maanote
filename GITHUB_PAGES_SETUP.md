# MaaNote v0.9 Stage 14 PROD - GitHub Pages

このフォルダの中身を GitHub リポジトリのルートへ置いてください。

## GitHub Pages 設定
- Settings → Pages
- Source: Deploy from a branch
- Branch: main
- Folder: / (root)

公開URL例:
`https://<ユーザー名>.github.io/<リポジトリ名>/`

管理者TEST画面:
`https://<ユーザー名>.github.io/<リポジトリ名>/admin.html`

## 注意
- Stage 8 の管理者画面は本番認証ではなく、同じブラウザ内で管理者配信をシミュレーションするTEST機能です。
- GitHub Pagesへ置いても、CD枚数・TODO・旅程などの個人データはGitHubへ保存されません。端末のブラウザ保存領域を使用します。
- GitHub Pages上ではリポジトリ名配下で動作するよう、アプリ内参照は相対パスのままです。


## iPhoneで「端末保存の初期化に失敗しました」と出た場合
この修正版は、同じGitHub Pages URLでRC2など新しい版を先に開いた端末でも、既存のIndexedDBをそのまま開けるように修正済みです。
リポジトリへ上書きしてCommit/Push後、Safariでページを再読み込みしてください。必要ならSafariを完全終了して開き直してください。


## 2026-10-03 compact2
- Home typography compacted to match the approved iPhone reference.
- Official 3rd single event data marked updated 2026-10-02.
- 11/15 Kinshicho details use the published venue/event information (14:00/17:00, sales 11:00, limit 4, shipping 950, priority assembly 20 min before).


## reference4 更新
- 管理者プレビューから「閉じる / 編集に戻る」で入力内容を保持して編集画面へ戻るよう修正
- プレビューから直接「この内容を公開」可能
- ホームの文字サイズを参考画像に合わせて拡大


## 今回の変更
- ホーム: NEXT EVENTを単独行、次の行に日付・曜日・都道府県
- 会場名の下に会場内場所を表示（登録済みの場合）
- 購入上限を「4枚/1会計」形式に統一
- 管理者新規イベント初期値: 販売13:00 / 部開始16:00 / 優先集合15:40
- 設定: 文字サイズ 小さめ90% / 標準100% / 大きめ120% / 特大140%


## Stage 8: 旧v9.6データ移行
一般画面・設定画面には移行導線を表示しません。既存利用者だけ、次のURLを直接開きます。

`https://<GitHubユーザー名>.github.io/<リポジトリ名>/migrate-v96.html`

旧v9.6側の移行用JSONを選択し、内容と競合を確認してから端末内IndexedDBへ取り込みます。
移行後の旧形式データ・移行履歴もバックアップJSONへ含めるようにしています。


## 文字サイズ初期値変更
- 新規利用時の文字サイズ初期値を 140%（特大）に変更
- 既に利用者が文字サイズを明示的に選択している場合は、その設定を維持


## カレンダー改善
- 祝日を赤字表示
- 日付数字を各マス左上に固定
- イベント系の表示を見やすく調整
- 文字サイズ140%初期値は維持


## 文字サイズ基準の修正
- アプリ全体の初期値を「標準 100%」へ戻しました。
- 旅程画面だけ、従来の140%表示相当を新しい100%の基準サイズにしました。
- ホーム・イベント・予定・カレンダー等の100%サイズは変更していません。
- 祝日赤表示・日付左上固定・Stage 8移行機能は維持しています。


## 2026-10-04 当日入力・カレンダー改善
- CD購入枚数を±ボタンではなく数字直接入力へ変更
- 公式イベントのカレンダー表示を「⭐️地名」に変更
- カレンダー表示名は最寄駅ではなく専用表示名／会場名から決定
- 管理者イベント編集に「カレンダー表示名」を追加
- 既存の旅程フォント基準・祝日赤表示・Stage 8移行機能は維持


## Stage 9 RC1
- Stage 8最新版をベースに安定化フェーズへ移行
- 更新判定・バックアップ・画面上のバージョン表記をRC1へ統一
- 新規利用者には個人用サンプルデータを自動投入しない
- 既存IndexedDBの個人データは削除しない
- テスト項目は STAGE9_TEST_CHECKLIST.md を参照


Stage 10 RC2の配信手順は `STAGE10_DEPLOY.md` を参照してください。


3 URL構成は `STAGE11_URLS.md` を参照してください。


Google管理者認証・自動配信の設定は `STAGE12_ADMIN_AUTH.md` と `backend-worker/README.md` を参照してください。


Google Driveバックアップ/復元は `STAGE13_GOOGLE_DRIVE.md` を参照してください。


自動クラウドバックアップの仕様は `STAGE13_1_AUTO_BACKUP.md` を参照してください。


本番環境の作り方は `PRODUCTION_DEPLOY.md` を優先して参照してください。
