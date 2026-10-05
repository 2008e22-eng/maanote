# MaaNote v0.9 Stage 11 - 3 URL構成

GitHub Pages のリポジトリが `maanote-test` の場合:

## ① 見るだけ版
https://2008e22-eng.github.io/maanote-test/view/

Twitterなどで広く公開するURLです。
参加状況・CD・トーク券・TODO・旅程・集計などの個人管理機能はありません。

## ② 見る／入力を選べる版
https://2008e22-eng.github.io/maanote-test/

これまでのMaaNoteです。
自分・友人向けに使います。既存の `MaaNoteDB` をそのまま使うので、現在の個人データを維持します。

## ③ 管理者版
https://2008e22-eng.github.io/maanote-test/admin/

管理者用です。
Stage 11から管理者データは `MaaNoteAdminDB` に分離しました。
初回だけ、旧 `MaaNoteDB` に残っている管理者共通データを自動コピーします。

## 共通配信
①と②はどちらも、リポジトリ直下の `common-data.json` を読みます。
そのため同じイベント情報が両方に配信されます。

現段階:
1. ③で編集・公開
2. 「配信用JSON」を押す
3. 保存された `common-data.json` をGitHubのリポジトリ直下へ上書き
4. Commit → Push origin
5. ①と②が次回オンライン起動時に最新版を取得

管理者Googleログイン、管理者の追加・停止、公開ボタンからのワンクリック配信は次段階で実装します。
③は認証が入るまでは一般公開しないでください。
