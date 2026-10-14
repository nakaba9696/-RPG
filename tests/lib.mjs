// テストの共有部品：静的サーバー・ヘッドレス Chromium の起動・MZ の起動待ち・エラーの収集・スクリーンショット。
// 各テスト（tests/<レーン>_*.mjs）はこれを使う。ここは T レーンだけが触る。
//
//   import { launchGame, check } from "./lib.mjs";
//   const game = await launchGame();          // タイトル画面まで起動して返す
//   try {
//     await game.call("newGame");             // window.__game.newGame()（目覚めの場面を飛ばし、スイッチ 111 を ON にして拠点から始める）
//     await game.call("newGame", { opening: true });  // 目覚めの場面を見るとき
//     await game.waitScene("Scene_Map");
//     await game.shot("map");                 // tests/out/<テスト名>-map.png
//     game.assertNoErrors();
//   } finally { await game.close(); }
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { startServer, ROOT } from "./serve.mjs";

export { ROOT };
export const OUT_DIR = path.join(ROOT, "tests", "out");

// ヘッドレスでも MZ（PIXI の WebGL）が動くように、ソフトウェアの WebGL（SwiftShader）を使う。
// これが無いと「Failed to initialize graphics.」で止まる。音は人の操作なしで鳴らせるようにする。
export const CHROMIUM_ARGS = [
  "--use-angle=swiftshader",
  "--enable-unsafe-swiftshader",
  "--ignore-gpu-blocklist",
  "--autoplay-policy=no-user-gesture-required",
];

// 遅い CI の runner でも落ちないように、待ちは長めに取る。
const BOOT_TIMEOUT = 60_000;
/** 待ちの既定の上限（waitFor・waitScene など）。全体では上げない。 */
export const WAIT_TIMEOUT = 30_000;
/**
 * わざと遅く出す演出の頁（数を一つずつ数える・間を置く）を 1 頁待つ上限（TST-34、#278）。
 * その会話の頁の待ちにだけ渡す（例 waitFor(fn, null, SLOW_PAGE_TIMEOUT)、w_story1 の talk の第 3 引数）。全体の上限は上げない。
 */
export const SLOW_PAGE_TIMEOUT = 90_000;
// 待ちがこの秒を越えたら、かかった秒と呼んだ所をログに出す（上限に近い待ちを CI のログで見つけるため。結果は変えない）
const SLOW_WAIT_LOG_MS = 10_000;

/** 呼んだ所（tests/<名前>.mjs:行）。lib.mjs の中の行は飛ばす。 */
function caller() {
  const lines = (new Error().stack || "").split("\n").slice(1);
  const hit = lines.find(l => /\.mjs:\d+/.test(l) && !l.includes("/lib.mjs:"));
  const m = hit && /([^/\\(\s]+\.mjs:\d+)/.exec(hit);
  return m ? m[1] : "?";
}

/** page.waitForFunction を呼び、遅かった待ちをログに出す。 */
async function timedWait(page, fn, arg, timeout, where) {
  const t0 = Date.now();
  await page.waitForFunction(fn, arg, { timeout, polling: 50 });
  const ms = Date.now() - t0;
  if (ms >= SLOW_WAIT_LOG_MS) console.log(`  遅い待ち ${(ms / 1000).toFixed(1)} 秒（上限 ${timeout / 1000} 秒、${where}）`);
}

/**
 * キーを押したまま、cond（ページの中の関数）が真になったフレームで、ゲームの中から離す（TST-31、#261）。
 * ゲームのフレームごとに Input を読む前に cond を見るので、早送り（setSpeed）中でも、真になったあとのフレームに押したままが残らない。
 * Playwright の keyup を待ってから離すと、その間（早送りで数十フレーム）にマップの文を先に送ってしまう。
 */
const KEY_CODES = { Enter: 13, Escape: 27, Space: 32, " ": 32, Shift: 16, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40 };
/** ページの中の条件：戦闘などからマップへ戻る途中（次の場面がマップ）か、もうマップ。 */
export const TO_MAP = () => SceneManager._scene instanceof Scene_Map || SceneManager._nextScene instanceof Scene_Map;

/** 失敗したら例外を投げる。 */
export function check(cond, message) {
  if (!cond) throw new Error("確認に失敗: " + message);
}

/** 画面の大きさ（data/System.json の advanced）。ブラウザの窓をこれに合わせ、スクリーンショットも同じ大きさで出す。 */
function screenSize() {
  const sys = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "System.json"), "utf8"));
  return { width: sys.advanced.screenWidth, height: sys.advanced.screenHeight };
}

function testName() {
  const main = process.argv[1] ? path.basename(process.argv[1], ".mjs") : "test";
  return main;
}

/**
 * サーバーとブラウザを立ち上げ、index.html?hai_test を開いてタイトル画面まで待つ。
 * @param {object} [opts]
 * @param {string} [opts.query]  URL の ? 以降（既定 "hai_test"）
 * @param {string} [opts.name]   スクリーンショットの頭に付ける名前（既定はテストのファイル名）
 * @param {object} [opts.context] browser.newContext に足す設定（タッチ端末なら { hasTouch: true, isMobile: true }、縦画面なら viewport も）
 */
export async function launchGame(opts = {}) {
  const query = opts.query ?? "hai_test";
  const name = opts.name ?? testName();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const server = await startServer();
  const browser = await chromium.launch({ args: CHROMIUM_ARGS });
  const context = await browser.newContext({ viewport: screenSize(), ...(opts.context ?? {}) });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push("pageerror: " + (e.stack || e.message)));
  page.on("console", m => {
    if (m.type() === "error") errors.push("console.error: " + m.text());
  });
  page.on("response", r => {
    if (r.status() >= 400) errors.push(`HTTP ${r.status()}: ${r.url()}`);
  });

  const url = `${server.url}index.html${query ? "?" + query : ""}`;
  let shotCount = 0;

  const game = {
    page,
    browser,
    url,
    errors,

    /** window.__game.<fn>(...args) を呼び、結果（Promise なら解決後の値）を返す。 */
    async call(fn, ...args) {
      return page.evaluate(([f, a]) => window.__game[f](...a), [fn, args]);
    },

    /** ページの中で式を評価する（関数でも文字列でもよい）。 */
    async eval(fnOrExpr, arg) {
      return page.evaluate(fnOrExpr, arg);
    },

    /** 今のシーンが name になり、切り替え・フェードが終わるまで待つ。 */
    async waitScene(sceneName, timeout = WAIT_TIMEOUT) {
      await timedWait(page, n => window.__game && window.__game.scene() === n && !window.__game.isBusy(), sceneName, timeout, caller());
    },

    /** 条件（ページの中の関数）が真になるまで待つ。 */
    async waitFor(fn, arg, timeout = WAIT_TIMEOUT) {
      await timedWait(page, fn, arg, timeout, caller());
    },

    /**
     * key を押したままにし、release（ページの中の関数。arg を渡す）が真になったフレームでゲームの中から離す。
     * そのあと until（既定は release）が真になるまで待ってから、Playwright のキーも離す。
     * 例：戦闘を決定キーの押しっぱなしで進め、マップへ戻る所で離す → game.holdKey("Enter", TO_MAP)。
     * 戻ったあとのマップの文は、押しっぱなしで送られずに残る（次の talk で読む）。
     */
    async holdKey(key, release, arg = null, timeout = 120_000, until = release) {
      const code = KEY_CODES[key];
      if (!code) throw new Error(`holdKey: キー ${key} の番号が分からない（lib.mjs の KEY_CODES に足す）`);
      const where = caller();
      const already = await page.evaluate(([src, a, c]) => {
        const h = (window.__haiHold = window.__haiHold || { list: [] });
        if (!h.hooked) {
          // フレームごとに、Input を読む前に条件を見て、真なら押したままの状態を消す（keyup が来るまで押されない）
          const _updateInputData = SceneManager.updateInputData;
          SceneManager.updateInputData = function() {
            for (const e of h.list) {
              if (!e.released && e.cond(e.arg)) {
                e.released = true;
                const name = Input.keyMapper[e.code];
                if (name) Input._currentState[name] = false;
              }
            }
            h.list = h.list.filter(e => !e.released);
            _updateInputData.apply(this, arguments);
          };
          h.hooked = true;
        }
        const cond = new Function("return (" + src + ")")();
        if (cond(a)) return true; // もう真なら押さない
        h.list.push({ cond, arg: a, code: c, released: false });
        return false;
      }, [release.toString(), arg, code]);
      if (!already) await page.keyboard.down(key);
      try {
        await timedWait(page, until, arg, timeout, where);
      } finally {
        if (!already) await page.keyboard.up(key);
        await page.evaluate(() => { if (window.__haiHold) window.__haiHold.list = []; }).catch(() => {});
      }
    },

    /** 決定キーを押しっぱなしにして戦闘を進め、マップへ戻る所で離し、マップの場面になるまで待つ（holdKey の短縮）。 */
    async holdOkToMap(timeout = 120_000) {
      await game.holdKey("Enter", TO_MAP, null, timeout, () => window.__game.scene() === "Scene_Map");
    },

    /** シーンの切り替え・移動が落ち着くまで待つ。 */
    async waitIdle(timeout = WAIT_TIMEOUT) {
      await timedWait(page, () => window.__game && !window.__game.isBusy(), null, timeout, caller());
    },

    /** プレイヤーの移動（歩いている途中）が終わるまで待つ。 */
    async waitPlayerStopped(timeout = WAIT_TIMEOUT) {
      await page.waitForFunction(() => !window.__game.ref("$gamePlayer").isMoving(), null, {
        timeout,
        polling: 50,
      });
    },

    /** フレームを n 回ぶん待つ（MZ は 60fps 前提）。 */
    async frames(n) {
      await page.evaluate(
        k =>
          new Promise(resolve => {
            const start = Graphics.frameCount;
            const tick = () => (Graphics.frameCount - start >= k ? resolve() : requestAnimationFrame(tick));
            tick();
          }),
        n,
      );
    },

    /**
     * キーを押して離す。MZ の Input はフレームごとに状態を読むので、数フレーム押したままにする。
     * key は Playwright の名前（"Enter"、"Escape"、"ArrowUp" など）。
     */
    async press(key, holdFrames = 3) {
      await page.keyboard.down(key);
      await game.frames(holdFrames);
      await page.keyboard.up(key);
      await game.frames(2);
    },

    /** tests/out/<テスト名>-<番号>-<label>.png にスクリーンショットを出す。パスを返す。 */
    async shot(label) {
      shotCount += 1;
      const file = path.join(OUT_DIR, `${name}-${String(shotCount).padStart(2, "0")}-${label}.png`);
      await page.screenshot({ path: file });
      console.log(`  スクリーンショット: ${path.relative(ROOT, file)}`);
      return file;
    },

    /** 集めた pageerror・console error・HTTP エラーが 0 件であることを確かめる。 */
    assertNoErrors() {
      if (errors.length > 0) {
        throw new Error("ページのエラー:\n  " + errors.join("\n  "));
      }
    },

    /** ページを読み直し、タイトル画面まで待つ。 */
    async reload() {
      await page.reload();
      await waitBoot();
    },

    async close() {
      await browser.close().catch(() => {});
      await server.close().catch(() => {});
    },
  };

  async function waitBoot() {
    try {
      await page.waitForFunction(
        () =>
          window.SceneManager &&
          SceneManager._scene &&
          SceneManager._scene.constructor.name === "Scene_Title" &&
          !SceneManager.isSceneChanging() &&
          !SceneManager._scene.isBusy() &&
          SceneManager._scene._commandWindow.isOpenAndActive(),
        null,
        { timeout: BOOT_TIMEOUT, polling: 100 },
      );
    } catch (e) {
      const text = await page.evaluate(() => document.body.innerText).catch(() => "");
      await page.screenshot({ path: path.join(OUT_DIR, `${name}-boot-failed.png`) }).catch(() => {});
      throw new Error(`MZ がタイトル画面まで起動しなかった（${e.message}）\n画面の文字: ${text}\n${errors.join("\n")}`);
    }
    if (query.includes("hai_test")) {
      const hooked = await page.evaluate(() => typeof window.__game === "object");
      check(hooked, "window.__game がない（js/plugins.js に Hai_TestHooks が入っているか）");
    }
  }

  try {
    const t0 = Date.now();
    await page.goto(url);
    await waitBoot();
    // 機械の速さの目安（中身の変わらない同じ処理なので、CI のジョブごとの当たり外れが分かる。T14）
    console.log(`  起動 ${((Date.now() - t0) / 1000).toFixed(1)} 秒（タイトルまで）`);
  } catch (e) {
    await game.close();
    throw e;
  }
  return game;
}

/** テスト本体を走らせ、失敗なら終了コード 1 にする。各テストファイルの最後で使う。 */
export async function runTest(fn) {
  const t0 = Date.now();
  try {
    await fn();
    console.log(`  OK（${((Date.now() - t0) / 1000).toFixed(1)} 秒）`);
  } catch (e) {
    console.error(e && e.stack ? e.stack : e);
    process.exitCode = 1;
  }
}
