# テスト（tests/）

MZ の Web 実行（`index.html`）を、Playwright のヘッドレス Chromium で自動で動かして確かめる。

## 走らせ方
```bash
npm ci --ignore-scripts --prefix tests && node tests/run.mjs   # 全部（失敗が 1 本でもあれば終了コード 1）
node tests/run.mjs t_smoke         # 名前で選ぶ（拡張子なし、いくつでも）
node tests/run.mjs --shard 2/3     # 名前順に 3 つへ総当たりで配った 2 番目だけ（CI は 3 シャードを並列に走らせる）
node tests/t_maps.mjs              # 1 本だけを直接
node tests/serve.mjs 8000          # 手元のブラウザで遊ぶ：http://127.0.0.1:8000/index.html （?hai_test を付けると window.__game が出る）
```
- クラウドのセッションでは Chromium が `/opt/pw-browsers` にある（`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`）。`playwright install` はしない。
- CI では `node tests/node_modules/playwright/cli.js install --with-deps chromium` で入れる（`npx` は使わない）。
- スクリーンショットは `tests/out/<テスト名>-<番号>-<名前>.png` に出る（コミットしない）。CI では失敗しても成功しても artifact「screenshots」に残る。

## 今あるテスト
| ファイル | 中身 | 時間の目安（クラウド） |
|---|---|---|
| `t_data.mjs` | データの整合（`tools/data/check.mjs`）と、`tools/data/io.mjs` で書き直してもエディタの書式と 1 バイトも変わらないこと。ブラウザなし | 1 秒 |
| `t_reach.mjs` | データの自動検証（到達性・場所移動の行き先・リージョン・ID の帯・プラグインの並び。`tools/data/README.md`）が今の `data/` で通り、わざと壊した写し（一時フォルダ）で落ちること。ブラウザなし | 1 秒 |
| `t_maps.mjs` | オートタイルの形の計算（コアの表・エディタの通行設定・エディタの書いたマップと突き合わせ）、`data/` の生成物が文字マップと一致すること。見本の迷宮（Map900）に移り、描画・全マスの通行・石碑の文章・階段での移動 | 30 秒 |
| `t_smoke.mjs` | タイトル → ニューゲーム → 歩く（キー入力と窓口）→ 戦闘（決定キーで勝つ）→ セーブ → ページの読み直し → ロードで同じ場所・同じ経験値 | 50 秒 |

どのテストも `pageerror`・console の error・HTTP の 4xx/5xx がゼロであることを確かめる。

## テストを足す
- ファイル名は `tests/<レーン>_<名前>.mjs`（例 `p_symbol_enemy.mjs`、`w_prison.mjs`）。`run.mjs` が名前順に拾って 1 本ずつ別のプロセスで走らせる。
- `run.mjs`・`lib.mjs`・`serve.mjs`・`js/plugins/Hai_TestHooks.js` は T レーンのもの。足りない窓口があれば PR の説明に書いて小さく足すか、T に issue を立てる。
- 雛形：
```js
import { launchGame, check, runTest } from "./lib.mjs";

await runTest(async () => {
  const game = await launchGame();             // index.html?hai_test をタイトル画面まで起動
  try {
    await game.call("newGame");                // window.__game.newGame()
    await game.waitScene("Scene_Map");
    await game.call("transfer", 900, 5, 7, 2); // 場所移動
    await game.waitFor(() => window.__game.mapId() === 900 && !window.__game.isBusy());
    check(await game.call("step", 6), "右に歩けない");
    await game.waitPlayerStopped();
    await game.shot("walked");                 // tests/out/<テスト名>-01-walked.png
    game.assertNoErrors();
  } finally {
    await game.close();
  }
});
```

## `tests/lib.mjs` の部品
| 部品 | 中身 |
|---|---|
| `launchGame({ query, name })` | 静的サーバーとブラウザを起動し、`index.html?hai_test` をタイトル画面（コマンドが選べる状態）まで待つ |
| `game.call(fn, ...args)` | `window.__game[fn](...args)` を呼ぶ（Promise は解決を待つ） |
| `game.eval(fn, arg)` | ページの中で関数を評価する（`$gameMap` などを直接見る） |
| `game.waitScene(name)` / `game.waitIdle()` / `game.waitFor(fn, arg)` / `game.waitPlayerStopped()` | 待つ |
| `game.frames(n)` | ゲームのフレームを n 回待つ |
| `game.press(key)` | キーを数フレーム押して離す（`"Enter"`、`"Escape"`、`"ArrowUp"` …） |
| `game.shot(label)` | スクリーンショット |
| `game.reload()` | ページを読み直してタイトルまで待つ（セーブは IndexedDB に残る） |
| `game.assertNoErrors()` | 集めたエラーがゼロか |
| `check(cond, message)` | 確かめる |

## テスト用の窓口 `window.__game`（`js/plugins/Hai_TestHooks.js`）
URL に `?hai_test` があるときだけ作られる（ふつうに遊ぶときと PC 版では何もしない）。
`scene()`・`isBusy()`・`ref(name)`・`newGame()`・`mapId()`・`pos()`・`transfer(mapId, x, y, d)`・`step(d)`・`canPass(x, y, d)`・`tileId(x, y, z)`・
`startBattle(troopId, canEscape, canLose)`・`strengthenParty()`・`save(slot)`・`load(slot)`・`goToTitle()`・`setSpeed(n)`。
中身はプラグインの冒頭の説明を見る。

## ヘッドレスで MZ を動かすための設定
- MZ（PIXI）は WebGL が無いと「Failed to initialize graphics.」で止まる。ヘッドレス Chromium には GPU が無いので、
  `--use-angle=swiftshader --enable-unsafe-swiftshader`（ソフトウェアの WebGL）で起動する（`CHROMIUM_ARGS`）。
- 音は `--autoplay-policy=no-user-gesture-required` で人の操作なしに鳴らせる（鳴らしても音は出ない）。
- ソフトウェア描画は遅い（5〜10fps）。長い場面は `__game.setSpeed(4)` で 1 回の描画あたり 4 フレーム進める。待ちはフレーム数で数えるので結果は変わらない。
- MZ は `file://` では動かないので、`tests/serve.mjs`（Node の `http` だけの静的サーバー）で配る。
