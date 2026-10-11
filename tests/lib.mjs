// テストの共有部品：静的サーバー・ヘッドレス Chromium の起動・MZ の起動待ち・エラーの収集・スクリーンショット。
// 各テスト（tests/<レーン>_*.mjs）はこれを使う。ここは T レーンだけが触る。
//
//   import { launchGame, check } from "./lib.mjs";
//   const game = await launchGame();          // タイトル画面まで起動して返す
//   try {
//     await game.call("newGame");             // window.__game.newGame()
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
const WAIT_TIMEOUT = 30_000;

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
      await page.waitForFunction(
        n => window.__game && window.__game.scene() === n && !window.__game.isBusy(),
        sceneName,
        { timeout, polling: 50 },
      );
    },

    /** 条件（ページの中の関数）が真になるまで待つ。 */
    async waitFor(fn, arg, timeout = WAIT_TIMEOUT) {
      await page.waitForFunction(fn, arg, { timeout, polling: 50 });
    },

    /** シーンの切り替え・移動が落ち着くまで待つ。 */
    async waitIdle(timeout = WAIT_TIMEOUT) {
      await page.waitForFunction(() => window.__game && !window.__game.isBusy(), null, {
        timeout,
        polling: 50,
      });
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
    await page.goto(url);
    await waitBoot();
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
