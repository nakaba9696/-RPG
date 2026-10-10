# Development notes — 灰の王国（探索RPG）

- ブラウザで動く HTML + JavaScript（ES modules）+ Canvas。外部ライブラリ・ビルド工程なし。`index.html` を開けば遊べる状態を常に保つ。
- 読むべきもの：[VISION.md](VISION.md)（何を作るか）、[docs/ROADMAP.md](docs/ROADMAP.md)（レーンと約束）、[docs/world.md](docs/world.md)（世界設定。D1 以降）。
- ゲームの手本は Fanastasis だが、固有名詞・台詞・素材は使わない。すべて自作する。
- UI の文言・コメント・PR の説明は日本語。コミットや PR にモデル名を書かない。

## 構成（T1 以降）
- `index.html`：読み込みだけ。`src/main.js` が起動。
- `src/core/`（状態・セーブ・入力）、`src/field/`（マップ・移動・イベント・敵シンボル）、`src/battle/`、`src/ui/`、`src/render/`、`src/data/`（maps, items, skills, enemies, party, story）。
- マップは文字列の行で書く（1 文字 = 1 タイル）。文字の意味は `src/data/maps/legend.js` に集める。
- セーブは `localStorage`。形式を変えるときは `VERSION` を上げ、古い形式を読む分岐を残す。

## 検証（PR を出す前に必ず通す）
```bash
npm ci --ignore-scripts
node tests/run.mjs          # Playwright（ヘッドレス Chromium）でスモーク一式
```
- クラウドのセッションでは Chromium が `/opt/pw-browsers/chromium` にある（`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`）。`playwright install` は実行しない。
- 見た目が変わる PR はスクリーンショット（`tests/` のスクリーンショット出力）を PR に載せる。
- CI（`.github/workflows/ci.yml` の `test` ジョブ）が必須チェック。テストを飛ばす・弱める変更で緑にしない。

## 決まり
- `docs/ROADMAP.md` のチェックは編集しない（配り役が D レーンでまとめる）。
- 共有ファイルは追記だけ（`docs/ROADMAP.md` の「約束」を参照）。
- `.github/workflows/` は T レーンの issue 以外で触らない。third-party Actions は full SHA で固定する。
- 認証情報・私的 URL・テスターの個人情報を置かない。
- `node_modules/`、スクリーンショットの出力、`tests/out/` はコミットしない。
