# Development notes — 灰の王国（探索RPG、RPGツクールMZ）

- エンジンは **RPGツクールMZ**。リポジトリ直下が MZ のプロジェクト（`Game.rmmzproject`、`index.html`、`js/`、`data/`、`img/`、`audio/` …）。
- 読むべきもの：[VISION.md](VISION.md)（何を作るか）、[docs/ROADMAP.md](docs/ROADMAP.md)（レーン・ID の帯・約束）、
  [docs/mz-data.md](docs/mz-data.md)（`data/*.json` の形・タイル ID・オートタイル）、[docs/world.md](docs/world.md)（世界設定。D1 以降）。
- ゲームの手本は Fanastasis だが、固有名詞・台詞・素材は使わない。すべて自作する（絵と音は MZ 同梱の素材と自作のもの）。
- UI の文言・コメント・PR の説明は日本語。コミットや PR にモデル名を書かない。

## 誰が何を触るか
- **クラウドの子セッションは MZ のエディタを開けない。** 触れるのは `js/plugins/*.js`、`js/plugins.js`（追記だけ）、`data/*.json`、`tools/`、`tests/`、`.github/`、`docs/`。
  どれを書き換えてよいかはレーンと ID の帯で決まる（[docs/ROADMAP.md](docs/ROADMAP.md)）。
- 持ち主の PC 側セッションだけが触るもの：`Game.rmmzproject`、`index.html`、`js/main.js`、`js/rmmz_*.js`（コアスクリプト）、`js/libs/`、
  `img/`、`audio/`、`css/`、`fonts/`、`effects/`、`icon/`。
- PR の説明に「エディタでの確認（持ち主の PC 側）」の章を付け、エディタで見てほしい所（マップ ID と座標、データベースの ID、見た目・手触り）を書く。

## 構成
| 場所 | 中身 |
|---|---|
| `index.html`、`js/main.js` | MZ の起動（触らない） |
| `js/rmmz_*.js` | コアスクリプト（触らない。変えたい所はプラグインで alias） |
| `js/plugins.js` | 読み込むプラグインの一覧（追記だけ） |
| `js/plugins/Hai_<名前>.js` | 自作のプラグイン |
| `docs/plugins/Hai_*.md` | 各プラグインの説明（使い方・メモ欄のタグ・窓口） |
| `docs/look.md` | 見た目の決まり（タイルセット・色調・数値。V レーン） |
| `docs/world.md` | 世界設計書（D1） |
| `data/*.json` | データベースとマップ（形は [docs/mz-data.md](docs/mz-data.md)） |
| `tools/maps/` | 文字マップ → `data/MapNNN.json` の変換（T1 で作る） |
| `tools/data/` | データの JSON を読む・書く・検査する小さな関数（T1 で作る） |
| `tests/` | Playwright のテスト（`run.mjs` が入口、各レーンは `tests/<レーン>_*.mjs`） |

## `data/*.json` を編集するとき
- 配列の **0 番目は `null`**、`i` 番目の `id` は `i`。途中を詰めない。帯の先頭まで伸ばすときは空の項目で埋める。
- 自分の **ID の帯**だけを書く（[docs/ROADMAP.md](docs/ROADMAP.md) の「ID の帯」と「割り当て表」）。
- マップを足したら `data/MapInfos.json` に同じ番号の要素を足す（追記だけ）。`MapNNN.json` の番号は 3 桁ゼロ埋め。
- `System.json` は `switches`・`variables` の自分の帯の名前だけ（0 番目は `""`）。
- 新しい要素は、同じファイルの既存の要素から欄を写す（欄を欠かさない）。メモ欄のタグは `<hai_<名前>:…>`。
- イベントの `list` は `code: 0` で終わる。分岐の中は `indent` を 1 深く。イベントごとの状態はセルフスイッチ（`"A"`〜`"D"`）で持つ。
- 書いたら `node tests/run.mjs`（データの整合の検査を含む）を通す。
- 持ち主がエディタで仕上げたマップ（`docs/maps.md` に「仕上げ済み」）は、タイル層を作り直さない。

## プラグインの書き方
```js
/*:
 * @target MZ
 * @plugindesc シンボル敵の動きと接触での戦闘。
 * @author 灰の王国
 * @help
 * 敵イベントのメモ欄に <hai_enemy:3,red> と書く。
 *
 * @param chaseRange
 * @text 追い始める距離
 * @type number
 * @default 4
 *
 * @command reset
 * @text 敵を元の位置に戻す
 */
(() => {
  "use strict";
  const pluginName = "Hai_SymbolEnemy";
  const params = PluginManager.parameters(pluginName);
  const chaseRange = Number(params.chaseRange || 4); // 値はすべて文字列で来る

  window.Hai = window.Hai || {};
  Hai.SymbolEnemy = { /* 他のプラグインやテストに見せる窓口だけ */ };

  PluginManager.registerCommand(pluginName, "reset", args => { /* … */ });

  const _Game_Event_update = Game_Event.prototype.update;
  Game_Event.prototype.update = function() {
    _Game_Event_update.apply(this, arguments);
    // 足す処理
  };
})();
```
- ファイル名＝プラグイン名＝`Hai_<PascalCase>`。`js/plugins.js` に `{"name":"Hai_…","status":true,"description":"…","parameters":{…}}` を 1 行足す（値は文字列）。
- プラグインは `<script>` で読まれる。**`import`/`export` は使えない**。即時関数で包み、グローバルは `window.Hai.<名前>` だけ。
- コアの関数の上書きは **alias**（元を変数に取って `apply(this, arguments)` で呼ぶ）にし、上書きする範囲を最小にする。丸ごと置き換えない。
- 状態は `$gameSystem._hai.<名前>` に置く（セーブに入る）。古いセーブで無ければ読むときに初期値を入れる。
- 文言は日本語。`@param` には `@text` と `@type` と `@default` を付ける。
- テストから触りたい所は `Hai.<名前>` に関数で出す。テスト専用の窓口は `Hai_TestHooks.js`（T のもの）にまとめる。

## イベントコマンド（`list` の `code` と `parameters`）
| code | 命令 | parameters |
|---|---|---|
| 0 | 終わり（list の最後、分岐の中の最後） | `[]` |
| 101 | 文章の表示（設定） | `[顔画像, 顔番号, 背景 0通常/1暗く/2透明, 位置 0上/1中/2下, 名前]` |
| 401 | 文章の 1 行（101 の後に続ける） | `[文字列]` |
| 102 | 選択肢の表示 | `[[選択肢…], キャンセル時, 初期位置, 位置, 背景]` |
| 402 / 403 / 404 | 〜のとき / キャンセルのとき / 選択肢の終わり | `[番号, 文字列]` / `[]` / `[]` |
| 108 / 408 | 注釈 / 注釈の続き | `[文字列]` |
| 111 | 条件分岐 | 下の表 |
| 411 / 412 | それ以外のとき / 分岐の終わり | `[]` |
| 112 / 413 / 113 | ループ / 以上繰り返し / ループの中断 | `[]` |
| 115 | イベント処理の中断 | `[]` |
| 117 | コモンイベント | `[コモンイベント ID]` |
| 118 / 119 | ラベル / ラベルジャンプ | `[名前]` |
| 121 | スイッチの操作 | `[開始 ID, 終了 ID, 0=ON / 1=OFF]` |
| 122 | 変数の操作 | `[開始 ID, 終了 ID, 演算 0代入/1加算/2減算/3乗算/4除算/5剰余, 種類 0定数/1変数/2乱数/3ゲームデータ/4スクリプト, 値…]` |
| 123 | セルフスイッチの操作 | `["A"〜"D", 0=ON / 1=OFF]` |
| 125 | 所持金の増減 | `[0増やす/1減らす, 0定数/1変数, 値]` |
| 126 / 127 / 128 | アイテム / 武器 / 防具の増減 | `[ID, 0増やす/1減らす, 0定数/1変数, 値]`（127・128 は末尾に装備品を含むか） |
| 129 | メンバーの入れ替え | `[アクター ID, 0加える/1外す, 初期化するか]` |
| 201 | 場所移動 | `[0直接/1変数, マップ ID, x, y, 向き 0そのまま/2下/4左/6右/8上, フェード 0黒/1白/2なし]` |
| 205 / 505 | 移動ルートの設定 / その中の 1 手（エディタの表示用） | `[キャラ -1プレイヤー/0このイベント/n, 移動ルート]` / `[移動コマンド]` |
| 212 / 213 | アニメーション / フキダシの表示 | `[キャラ, ID, 完了まで待つか]` |
| 214 | イベントの一時消去 | `[]` |
| 221 / 222 | フェードアウト / フェードイン | `[]` |
| 223 | 画面の色調変更 | `[[赤, 緑, 青, グレー], フレーム数, 待つか]` |
| 230 | ウェイト | `[フレーム数]` |
| 241 / 245 / 249 / 250 | BGM / BGS / ME / SE の演奏 | `[{name, volume, pitch, pan}]` |
| 301 | 戦闘の処理 | `[0直接/1変数/2ランダムと同じ, 敵グループ ID, 逃走可, 敗北可]` |
| 601 / 602 / 603 / 604 | 勝ったとき / 逃げたとき / 負けたとき / 戦闘分岐の終わり | `[]` |
| 302 / 605 | ショップの処理 / 2 品目以降 | `[0アイテム/1武器/2防具, ID, 0標準価格/1指定, 価格, 購入のみ]` |
| 314 | 全回復 | `[0固定/1変数, アクター ID（0 で全員）]` |
| 352 / 353 / 354 | セーブ画面 / ゲームオーバー / タイトルに戻す | `[]` |
| 355 / 655 | スクリプト / その続きの行 | `[文字列]` |
| 357 | プラグインコマンド（MZ） | `[プラグイン名, コマンド名, 表示名, {引数名: "値"}]` |
| 657 | 357 の引数の表示行（エディタの表示用） | `[文字列]` |

条件分岐（111）の parameters：
| 1 つ目 | 意味 | 続き |
|---|---|---|
| 0 | スイッチ | `[0, スイッチ ID, 0=ON / 1=OFF]` |
| 1 | 変数 | `[1, 変数 ID, 0定数/1変数, 値, 比較 0＝/1≧/2≦/3＞/4＜/5≠]` |
| 2 | セルフスイッチ | `[2, "A"〜"D", 0=ON / 1=OFF]` |
| 4 | アクター | `[4, アクター ID, 0パーティにいる/1名前/2職業/3スキル/4武器/5防具/6ステート, 値]` |
| 7 | 所持金 | `[7, 金額, 0以上/1以下/2未満]` |
| 8 | アイテム | `[8, アイテム ID]` |
| 12 | スクリプト | `[12, "式"]` |

確かさ：T1 で `js/rmmz_objects.js` の `Game_Interpreter` と突き合わせた。101 の 5 つ目は名前（`setSpeakerName`）、
357 は `[プラグイン名, コマンド名, 表示名（実行には使わない）, 引数]`。表に無い命令は `Game_Interpreter.prototype.command<番号>` を読む。

## 検証（PR を出す前に必ず通す）
```bash
npm ci --ignore-scripts --prefix tests && node tests/run.mjs   # 静的サーバー＋Playwright（ヘッドレス Chromium）でスモーク一式とデータの検査
```
- CI は `node tests/run.mjs --shard i/4`（`tests/durations.json` の所要時間で 4 つに均した i 番目）を 4 つ並列に走らせる。手元で CI の 1 シャードだけ再現するときも同じ引数で。配り分けは `node tests/run.mjs --plan 4` で見る。
- テストを足したり重くしたりしたら、CI のログの「OK（N 秒）」を `tests/durations.json` に写す（表に無いテストは 180 秒とみなす）。
- クラウドのセッションでは Chromium が `/opt/pw-browsers/chromium` にある（`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`）。`playwright install` は実行しない。
- MZ は `file://` では動かない。テストは `tests/serve.mjs` の静的サーバーで `index.html?hai_test` を開く。
- `pageerror` と console の error はゼロにする。
- 見た目が変わる PR はスクリーンショット（`tests/out/`）を PR に載せる。
- 必須チェックは CI（`.github/workflows/ci.yml`）の **`CI result`**。テストを飛ばす・弱める変更で緑にしない。
- 走らせ方・テストの足し方・窓口（`window.__game`）は [tests/README.md](tests/README.md)、文字マップの変換は [tools/maps/README.md](tools/maps/README.md)。
- ヘッドレス Chromium では `--use-angle=swiftshader --enable-unsafe-swiftshader`（ソフトウェアの WebGL）で MZ を動かす（`tests/lib.mjs` が付ける）。
- `.github/workflows/` を触ったら `bash tools/ci/check-workflows.sh` を通す。

## 決まり
- `docs/ROADMAP.md` のチェックは編集しない（配り役が D レーンでまとめる）。
- 共有ファイル（`js/plugins.js`、`data/MapInfos.json`、`data/System.json` の名前の配列、帯をまたぐデータベースの表）は追記だけ（`docs/ROADMAP.md` の「約束」）。
- `.github/workflows/` は T レーンの issue 以外で触らない。third-party Actions は full SHA で固定する。
- 外部の有料・配布プラグインは入れない（自作のみ。持ち主が入れたものは別）。
- 認証情報・私的 URL・テスターの個人情報を置かない。
- `save/`、`node_modules/`、`tests/out/` はコミットしない。
