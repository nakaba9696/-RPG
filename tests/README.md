# テスト（tests/）

MZ の Web 実行（`index.html`）を、Playwright のヘッドレス Chromium で自動で動かして確かめる。

## 走らせ方
```bash
npm ci --ignore-scripts --prefix tests && node tests/run.mjs   # 全部（失敗が 1 本でもあれば終了コード 1）
node tests/run.mjs t_smoke         # 名前で選ぶ（拡張子なし、いくつでも）
node tests/run.mjs --shard 2/12    # 所要時間で 12 に均して配った 2 番目だけ（CI は 12 シャードを並列に走らせる）
node tests/run.mjs --plan 12       # 12 シャードへの配り分けと見込み時間を表示するだけ
node tests/run.mjs --no-browser    # ブラウザなしのテスト（本文に launchGame( が無いもの）だけ
node tests/t_maps.mjs              # 1 本だけを直接
node tests/serve.mjs 8000          # 手元のブラウザで遊ぶ：http://127.0.0.1:8000/index.html （?hai_test を付けると window.__game が出る）
```
- クラウドのセッションでは Chromium が `/opt/pw-browsers` にある（`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`）。`playwright install` はしない。
- CI では `node tests/node_modules/playwright/cli.js install --with-deps --only-shell chromium` で入れる（`npx` は使わない。headless shell だけ。`~/.cache/ms-playwright` は actions/cache で残す）。
- シャードの配り分けは `tests/durations.json`（テスト名 → CI の**速い機械**での秒数）で決まる。所要時間の大きい順に、いま最も軽いシャードへ配る（表が同じなら結果も同じ）。表に無いテストは 180 秒とみなす。
  テストを足したり重くしたりしたら、CI のログの「OK（N 秒）」を写して表を直す（CI のログの頭に配り分けと見込みが出る）。
- **CI の機械の速さはジョブごとに 1.0〜2.3 倍ちがう**（T14：run 4 本 × 12 シャードの実測。同じジョブの中ではどのテストも同じ倍率で遅く、同じ中身のテストが回によって倍になる）。
  ゲームの重さではない（`tests/loadtime.mjs` で 10/13 の版と今の版を同じ機械で比べ、起動・マップの読み込み・旗の束・描画の差は 5% 以内）。
  そこで表は速い機械の秒（数回の CI の最小）にし、`--plan` は遅い機械（×2.3、`SLOW_FACTOR`）でもジョブの上限 25 分に収まるかを見る。
  ログの頭の「機械：… 目安の計算 N ms」と、各テストの「起動 N 秒（タイトルまで）」が機械の速さの目安（遅い機械はおよそ倍）。遅い機械のジョブの秒は半分にして写す（そのまま写すと見込みが重くなるだけで、危なくはない）。
- 見込みはテストの本体の秒数だけ。ジョブにはそのほかに準備（checkout・setup-node・npm ci・Chromium を入れる）が足されるが、実測で **30〜40 秒**（`--plan` は目安 1 分で「準備込み」を出す）。
  見込みと実際が大きくずれるのは、たいてい**表が古い**とき（T13：表のままだと 10/10 は見込み 13 分 19 秒、実際は 23 分 32 秒。w_region3b が表 280 秒・実際 617 秒など、倍ほど遅いテストが十数本あった）。
  テストに場面や確かめる所を足したら、その PR の CI のログで所要を見て表を直す。ジョブの上限は 25 分（`timeout-minutes`）なので、表が古くなる分とばらつきの余裕を残して、
  どのシャードも見込み **15 分以下**に保つ（越えると `--plan` が注意を出す）。越えたら上限を延ばさず、シャードを増やす（`ci.yml` の `matrix.shard` と `--shard i/n`、ジョブ名の `/n`、CLAUDE.md の「検証」の節）。
- CI の道（T8、`.github/workflows/ci.yml`）：まず `changes` ジョブが全部を走らせるかを決め、そのあと `quick`（ブラウザなしのテスト、`--no-browser`）と `test`（12 シャード、全部の道だけ）が並列に走る。
  PR で変わったファイルが文書（`docs/` の下か `*.md`）だけなら、ブラウザのシャードは走らせない（判定は `tools/ci/changes.mjs`。
  `data/`・`js/`・`tests/`・`tools/`・`.github/`・`img/`・`audio/` などが 1 つでも混ざれば、`*.md` でも全部）。main への push はブラウザなしのテストだけ、手で走らせる（workflow_dispatch）と全部。
  ブラウザなしのテストを足すときは `launchGame(` を本文に書かない（書くとブラウザありに数えられ、速い道で走らない）。
- スクリーンショットは `tests/out/<テスト名>-<番号>-<名前>.png` に出る（コミットしない）。CI では失敗しても成功しても artifact「screenshots」に残る。

## 今あるテスト
| ファイル | 中身 | 時間の目安（クラウド） |
|---|---|---|
| `t_data.mjs` | データの整合（`tools/data/check.mjs`）と、`tools/data/io.mjs` で書き直してもエディタの書式と 1 バイトも変わらないこと。ブラウザなし | 1 秒 |
| `t_reach.mjs` | データの自動検証（到達性・場所移動の行き先・リージョン・ID の帯・プラグインの並び。`tools/data/README.md`）が今の `data/` で通り、わざと壊した写し（一時フォルダ）で落ちること。ブラウザなし | 1 秒 |
| `t_ci_changes.mjs` | CI の速い道の判定（`tools/ci/changes.mjs`）：文書だけで light、`data/`・`js/` などが混ざれば full。ブラウザなし | 1 秒 |
| `t_maps.mjs` | オートタイルの形の計算（コアの表・エディタの通行設定・エディタの書いたマップと突き合わせ）、`data/` の生成物が文字マップと一致すること、置き物の道具（重ね書き・スタンプ・散らし・段差・建物）と置き物の密度の報告。見本の迷宮（Map900）に移り、描画・全マスの通行・石碑の文章・階段での移動。置き物の道具の見本（Map915）で段差の梯子と屋根・壁の通行 | 30 秒 |
| `t_smoke.mjs` | タイトル → ニューゲーム → 歩く（キー入力と窓口）→ 戦闘（決定キーで勝つ）→ セーブ → ページの読み直し → ロードで同じ場所・同じ経験値 | 50 秒 |
| `t_bands.mjs` | W の帯 1001–1500（`tools/data/bands.json`）・`System.json` の名前の配列が 1500 番まであること（短いと検査が落ちる）・`tools/data/extend-system.mjs`・遊ぶ時間の換算（`tests/playtime.mjs`）。ブラウザなし | 1 秒 |
| `t_checkpoints.mjs` | 旗の束（`__game.setup`）の 5 束と行き先のそれぞれで、入口に着き・歩けて・鐘・仲間・生き残りの数が束のとおりで、着くまでが 30 分以内 | 120 秒 |
| `t_balance.mjs` | 戦いを測る道具（`tools/balance/`）が動くこと：035 牢番を 2 回測る・同じ種で同じ結果・わざと技の範囲を誤らせると拾う（GAM-45）。表の全部は CI に入れず手で `node tools/balance/run.mjs --all`（`tools/balance/README.md`） | 20 秒 |

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
| `game.holdOkToMap(timeout)` | 決定キーを押しっぱなしにして戦闘を進め、**マップへ戻る所（次の場面がマップになったフレーム）でゲームの中から離し**、マップの場面まで待つ。戻ったあとのマップの文は送られずに残る（次の talk で読む） |
| `game.holdKey(key, release, arg, timeout, until)` | 一般の形：`release`（ページの中の関数）が真になったフレームで離し、`until`（既定は `release`）まで待つ。`TO_MAP` は「マップへ戻る途中か、もうマップ」 |
| `WAIT_TIMEOUT`・`SLOW_PAGE_TIMEOUT` | 待ちの既定の上限（30 秒）と、わざと遅く出す演出の頁を 1 頁待つ上限（90 秒）。後者はその会話の頁の待ちにだけ渡す |
| `game.shot(label)` | スクリーンショット |
| `game.reload()` | ページを読み直してタイトルまで待つ（セーブは IndexedDB に残る） |
| `game.assertNoErrors()` | 集めたエラーがゼロか |
| `check(cond, message)` | 確かめる |

### 押しっぱなしと待ち（T14）
- 決定キーを `page.keyboard.down` で押しっぱなしにして `waitFor(マップ)` で待ち、そのあと `keyboard.up` する形は使わない。
  待ちの見回り（50 ミリ秒ごと）と keyup が届くまでの間に、早送り（`setSpeed`）で数十フレーム進み、戻ったあとのマップの文や次のイベントを先に送り切る。
  次の「イベントが始まるのを待つ」が 30 秒で切れる（#261。遅い CI の機械でだけ出る）。`game.holdOkToMap()` か `game.holdKey()` を使う。
- わざと遅く出す演出の頁（数を一つずつ数える・間を置く）は、その会話の頁の待ちにだけ `SLOW_PAGE_TIMEOUT` を渡す（例 `w_story1` の `talk([], false, SLOW_PAGE_TIMEOUT)`）。全体の上限（`WAIT_TIMEOUT`）は上げない。
  会話を読む `talk` は各テストに形の違う写しがある（18 本）ので、`lib.mjs` には移さず、上限の値だけを共通にしている。
- `waitFor`・`waitScene`・`waitIdle`・`holdKey` の待ちが 10 秒を越えると「遅い待ち N 秒（上限 M 秒、<テスト>.mjs:<行>）」をログに出す（結果は変えない）。
  上限に近い待ちは、落ちる前に CI のログで見つけて、どの頁が遅いかを測る（TST-34）。

## 読み込み時間を測る（`tests/loadtime.mjs`、T14）
`node tests/loadtime.mjs [回数]` で、起動（タイトルまで）・ニューゲーム・場所移動 8 回・旗の束 4 つ・マップで 120 フレームの時間を測り、中央値を出す（テストではない。`run.mjs` は拾わない）。
ゲームが重くなったのか機械が遅いのかを分けるときは、古い版を `git worktree add <場所> <コミット>` で出し、このファイルを写して同じ機械で両方を走らせて比べる。

## テスト用の窓口 `window.__game`（`js/plugins/Hai_TestHooks.js`）
URL に `?hai_test` があるときだけ作られる（ふつうに遊ぶときと PC 版では何もしない）。
`scene()`・`isBusy()`・`ref(name)`・`newGame({ opening })`・`mapId()`・`pos()`・`transfer(mapId, x, y, d)`・`step(d)`・`canPass(x, y, d)`・`tileId(x, y, z)`・
`startBattle(troopId, canEscape, canLose)`・`strengthenParty()`・`save(slot)`・`load(slot)`・`goToTitle()`・`setSpeed(n)`・
`setup(name, opts)`・`checkpoints()`・`playCounters()`。
中身はプラグインの冒頭の説明を見る。
- `newGame()`（とタイトルの「ニューゲーム」）は、Map010 の目覚めの場面を飛ばす（スイッチ 111 を ON にし、拠点 `Hai.Defeat.home()` に置く）。
  目覚めの場面を見るテストだけ `newGame({ opening: true })` にする。製品のマップにテスト用の分岐は置かない。

## 旗の束（途中から始める。T12、docs/world.md 5.10）
`__game.setup(name, opts)` は、ニューゲームから「旗の束」を立てて、その地域の入口へ転送する（Promise。解決の値は `{ bundle, to, bells }`）。
マップの途中からでも呼べる。束の中身（スイッチ・変数・仲間・施設・道具）は `js/plugins/Hai_TestHooks.js` の `DONE` と `BUNDLES`。

| 名前 | 立てる旗 | 着く所 |
|---|---|---|
| `fort` | 砦だけ（目覚め・炉・墓所の書き付け・シャノ・倉） | 砦の炉の前（`Hai.Defeat.home()`） |
| `cleared1` | 地域一まで済み（営倉の鐘・牢番・ブルーノ・ヴォルフラム・アデル・鍵束・角灯・小鐘） | 砦の炉の前 |
| `bells2` | 鐘 2 つ（既定は記録院の鐘。焼けた村・ノラ・ディル・アンネリーゼ・イスメネ・ピピネル） | まだの地域の入口（既定は霧の湖 070） |
| `bells3` | 鐘 3 つ（既定は記録院・水底の鐘）と 3 つ目の場面（スイッチ 106） | 最後の地域の入口（既定は鋳物場の側） |
| `bells4` | 四つ鳴った（スイッチ 105・108・109）。砦の W16・W17 の自動実行（名乗り・食卓の場面）は見たことにする | 境山の高みの入口 |
| `region1`〜`region5`・`last`・`summit` | その地域に入る前の束（`region1` は `fort`、`region2`〜`5` は `cleared1`、`region5` は焼けた村の祠の番まで、`last` は `bells3`、`summit` は `bells4`） | その地域の入口 |

- `opts.bells`：営倉のほかに鳴らした鐘を `["archive" | "water" | "foundry"]` で選ぶ（`bells2` は 1 つ、`bells3`・`last` は 2 つ。残りの 1 つが最後の地域）。`opts.level`：パーティのレベル。
- まだ無いマップ（110 麦の街道・170 門叩きの縄張り・180 灰の斜面）へは、作られるまで手前の入口（063 祠の奥の戸の前・まだの鐘の間・019 城壁の東門）に送る。
  **W12・W11・W14 はマップを作ったら、`Hai_TestHooks.js` の `ENTRANCES` の先頭にその入口を 1 行足す**（T のファイルだが、この 1 行は W が足してよい）。
  地域五の旗（関所の札・収税吏・院長など）は `DONE.archive`（または `DONE` に地域五の項目）に足す。
- 持ち主はエディタのテストプレイで、プラグインコマンド「旗の束」（`Hai_TestHooks` の `checkpoint`）を確認部屋のイベントから呼べる（テストプレイと `?hai_test` のときだけ働く）。

```js
const r = await game.call("setup", "region5");                 // 地域五の入口へ
await game.waitFor(to => window.__game.mapId() === to.mapId && !window.__game.isBusy(), r.to);
await game.call("setup", "last", { bells: ["water", "foundry"] }); // 記録院が最後の地域
```

## 遊ぶ時間の目安（歩数から時間を出す。T12、docs/world.md 5.7）
通しテストで歩いた歩数・戦闘・ボス・読んだ思念を数え、**1 歩 0.25 秒＋戦闘 1 回 1 分＋ボス 8 分＋思念 1 つ 20 秒**で換算する（`tests/playtime.mjs`）。
W は本道の通しテストに数行足し、出た目安を PR の説明に書く（配分表 world.md 5.7 と 3 割以上ずれたら D16 で表を直す）。
```js
import { startPlaytime } from "./playtime.mjs";
const pt = await startPlaytime(game);       // 測り始め（__game.playCounters() の写し）
// … 本道を歩く（__game.step か キー入力。__game.transfer の場所移動は歩数に入らない） …
await pt.report("地域五の本道");             // 「  遊ぶ時間の目安（地域五の本道）：歩数 1200（5 分）・戦闘 6（6 分）・ボス 1（8 分）・思念 9（3 分）→ 約 22 分」
```
- 数は `__game.playCounters()`：`steps`（`$gameParty.steps()`）、`battles`（始まった戦闘。ボス戦を含む）、`bosses`（`<hai_boss>` の敵がいる戦闘）、`thoughts`（既読の思念）、`playtime`（ゲームの中の秒）。
  戦闘の数はページを読み直すと 0 に戻る（差は `startPlaytime` からの分だけ取る）。
- 部品：`estimatePlaytime({ steps, battles, bosses, thoughts })`（秒と分）、`formatPlaytime(e)`（1 行の文）、`readCounters(game)`、`playtimeSince(game, start)`。換算の値は `RATE`。
- テストは時間を短くするために場所移動で飛ばすことが多い。目安は「歩いた所だけ」の数なので、飛ばした区間は別に足す（文字マップの道の長さか、手元の計測）。

## ヘッドレスで MZ を動かすための設定
- MZ（PIXI）は WebGL が無いと「Failed to initialize graphics.」で止まる。ヘッドレス Chromium には GPU が無いので、
  `--use-angle=swiftshader --enable-unsafe-swiftshader`（ソフトウェアの WebGL）で起動する（`CHROMIUM_ARGS`）。
- 音は `--autoplay-policy=no-user-gesture-required` で人の操作なしに鳴らせる（鳴らしても音は出ない）。
- ソフトウェア描画は遅い（5〜10fps）。長い場面は `__game.setSpeed(4)` で 1 回の描画あたり 4 フレーム進める。待ちはフレーム数で数えるので結果は変わらない。
- MZ は `file://` では動かないので、`tests/serve.mjs`（Node の `http` だけの静的サーバー）で配る。
