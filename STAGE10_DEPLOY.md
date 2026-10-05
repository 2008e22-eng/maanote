# MaaNote v0.9 Stage 10 RC2

## 目的
Stage 10 RC2では、Firebaseを使わずに「管理者の共通データ」を全利用者へ配信できる形に整理しました。

## 通常のアプリ更新
1. このZIPの中身を GitHub の `maanote-test` フォルダへ全上書き
2. GitHub Desktop で Commit
3. Push origin
4. GitHub Pages反映後、Safariで通常URLを開く

## 管理者情報を全利用者へ配信する方法
1. `admin.html` を開く
2. イベントやその他情報を編集して「公開」
3. 画面上部の「配信用JSON」を押す
4. `common-data.json` が保存される
5. GitHubの `maanote-test` ルートにある `common-data.json` を、そのファイルで上書き
6. Commit → Push origin

利用者側は、次回オンラインでMaaNoteを開いたときに `common-data.json` の配信バージョンを確認し、
新しい場合だけ共通データをIndexedDBへ取り込みます。個人データは触りません。
オフライン時は端末に保存済みの共通データを表示します。

## TEST表示日の確認
通常URLでは実際の日付を使います。
TEST用の日付切り替えが必要なときだけURL末尾に `?test=1` を付けてください。

例:
`https://2008e22-eng.github.io/maanote-test/?test=1`

## RC2で整理したもの
- Firebase参照なし
- PWAキャッシュと個人データを分離
- 管理者共通データを `common-data.json` で配信
- 通常利用画面からTEST表示を非表示
- manifest / バージョン表示をRC2へ統一
- 既存のStage 9 RC1.2の個人データ保護・TODAY表示修正を維持
