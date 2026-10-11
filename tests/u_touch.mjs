// U2 スマホ操作（js/plugins/Hai_TouchUI.js）の検査。タッチ端末の文脈（hasTouch・isMobile）で：
//   ボタンが出る → 「調べる」でイベントが始まる → 「ダッシュ」の入り切り → 「メニュー」でメニュー → 「地図」で地図（Hai_AutoMap があるとき）→
//   戦闘中は「決定」「戻る」だけ → オプションに「タッチボタン」があり OFF で消える → 縦画面（720×1280）でもボタンが画面内で 64px 以上 →
//   ふつうの 1280×720・720×1280 の窓と、UA が携帯でないタッチ端末（MZ がキャンバスを縮めない）でも、ボタンと戦闘の「戻る」が画面の中（#110）。
import { launchGame, check, runTest } from "./lib.mjs";

// MZ は UA が携帯のときだけ画面に合わせて拡縮する（Graphics._stretchEnabled）ので、Android の UA も渡す
const UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36";
const TOUCH = { hasTouch: true, isMobile: true, userAgent: UA };
const PORTRAIT = { ...TOUCH, viewport: { width: 720, height: 1280 } };

/** ボタンの矩形（ゲームの座標）を、ブラウザの画面の座標（CSS ピクセル）に直す。 */
async function cssRect(game, name) {
  return game.eval(n => {
    const r = Hai.TouchUI.rect(n);
    if (!r) return null;
    const c = Graphics._canvas.getBoundingClientRect();
    const k = c.width / Graphics.width; // ボタンはシーンの子なので、座標は Graphics.width / height の中
    const vv = window.visualViewport;
    const v = vv ? { left: vv.offsetLeft, top: vv.offsetTop, vw: vv.offsetLeft + vv.width, vh: vv.offsetTop + vv.height } : { left: 0, top: 0, vw: innerWidth, vh: innerHeight };
    return { x: c.left + r.x * k, y: c.top + r.y * k, width: r.width * k, height: r.height * k, ...v };
  }, name);
}

/** ブラウザの画面（見えている範囲）の中にあるか。 */
function inView(r) {
  return r.x >= r.left - 0.5 && r.y >= r.top - 0.5 && r.x + r.width <= r.vw + 0.5 && r.y + r.height <= r.vh + 0.5;
}

/** ボタンの真ん中を指でタップする（mouse が真ならマウスで押す）。 */
async function tap(game, name, mouse = false) {
  const r = await cssRect(game, name);
  check(r, `ボタン ${name} が出ていない`);
  if (mouse) await game.page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
  else await game.page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2);
  await game.frames(6);
}

async function toMap900Stone(game) {
  await game.call("transfer", 900, 1, 1, 2);
  await game.waitFor(() => window.__game.mapId() === 900 && !window.__game.isBusy());
  // 石碑のイベント（文章に「見本の迷宮」）の左隣で右を向く
  const stone = await game.eval(() => {
    const ev = $dataMap.events.find(e => e && e.pages.some(p => p.list.some(c => c.code === 401 && c.parameters[0].includes("見本の迷宮"))));
    return { x: ev.x, y: ev.y };
  });
  await game.call("transfer", 900, stone.x - 1, stone.y, 6);
  await game.waitFor(([x, y]) => { const p = window.__game.pos(); return window.__game.mapId() === 900 && p.x === x && p.y === y && !window.__game.isBusy(); }, [stone.x - 1, stone.y]);
  await game.frames(2);
}

await runTest(async () => {
  // ---- 横画面 ----
  let game = await launchGame({ context: TOUCH });
  try {
    await game.call("newGame");
    await game.waitScene("Scene_Map");
    await game.frames(4);
    check(await game.eval(() => Hai.TouchUI.isShown()), "タッチ端末なのにボタンが出ない");
    for (const n of ["ok", "menu", "dash"]) check(await cssRect(game, n), `ボタン ${n} が無い`);
    const hasMap = await game.eval(() => !!(Hai.AutoMap && Hai.AutoMap.open));
    check(!!(await cssRect(game, "map")) === hasMap, "地図ボタンは Hai.AutoMap があるときだけ出る");
    await game.shot("landscape");

    // 調べる
    await toMap900Stone(game);
    const before = await game.call("pos");
    await tap(game, "ok");
    await game.waitFor(() => $gameMessage.isBusy());
    const text = await game.eval(() => $gameMessage.allText());
    check(text.includes("見本の迷宮"), "「調べる」で石碑が読めない: " + text);
    check(await game.eval(() => Hai.TouchUI.rect("map") === null), "メッセージ中に地図ボタンが出ている");
    await game.shot("landscape-message");
    for (let i = 0; i < 8 && (await game.eval(() => $gameMessage.isBusy())); i++) await tap(game, "ok"); // メッセージ中は「決定」
    await game.waitFor(() => !$gameMessage.isBusy());
    await game.waitIdle();
    const after = await game.call("pos");
    check(before.x === after.x && before.y === after.y, "ボタンのタップで歩いてしまった");
    check(!(await game.eval(() => $gameTemp.isDestinationValid())), "ボタンのタップが移動先になった");

    // ダッシュ
    check(!(await game.eval(() => $gamePlayer.isDashButtonPressed())), "最初からダッシュ");
    await tap(game, "dash");
    check(await game.eval(() => $gamePlayer.isDashButtonPressed()), "ダッシュが入らない");
    await tap(game, "dash");
    check(!(await game.eval(() => $gamePlayer.isDashButtonPressed())), "ダッシュが切れない");

    // メニュー
    await tap(game, "menu");
    await game.waitScene("Scene_Menu");
    await game.shot("menu");
    await game.press("Escape");
    await game.waitScene("Scene_Map");

    // 地図
    if (hasMap) {
      await game.frames(10);
      await tap(game, "map");
      await game.waitFor(() => SceneManager._scene.constructor.name !== "Scene_Map");
      console.log(`  地図: ${await game.call("scene")}`);
      await game.press("Escape");
      await game.waitScene("Scene_Map");
    } else {
      console.log("  地図: Hai_AutoMap が無いのでボタンも出ない（確認済み）");
    }

    // 戦闘中は「決定」「戻る」だけ
    await game.call("strengthenParty");
    await game.call("startBattle", 1, true, false);
    await game.waitScene("Scene_Battle");
    check(await game.eval(() => Hai.TouchUI.isShown()), "戦闘中にボタンが出ない");
    check(await cssRect(game, "menu"), "戦闘中に「戻る」が出ない");
    check(!(await cssRect(game, "dash")) && !(await cssRect(game, "map")), "戦闘中にダッシュ・地図が出ている");
    await game.shot("battle");
    game.assertNoErrors();
  } finally {
    await game.close();
  }

  // ---- オプション ----
  game = await launchGame({ context: TOUCH });
  try {
    await game.call("newGame");
    await game.waitScene("Scene_Map");
    await game.frames(4);
    check(await game.eval(() => Hai.TouchUI.isShown()), "ボタンが出ない");
    await game.eval(() => SceneManager.goto(Scene_Options));
    await game.waitScene("Scene_Options");
    const idx = await game.eval(() => SceneManager._scene._optionsWindow._list.findIndex(c => c.symbol === "haiTouchButtons"));
    check(idx >= 0, "オプションに「タッチボタン」が無い");
    await game.eval(i => { const w = SceneManager._scene._optionsWindow; w.select(i); w.processOk(); }, idx);
    check(!(await game.eval(() => ConfigManager.haiTouchButtons)), "オプションで OFF にならない");
    await game.shot("options");
    await game.eval(() => SceneManager.goto(Scene_Map));
    await game.waitScene("Scene_Map");
    await game.frames(4);
    check(!(await game.eval(() => Hai.TouchUI.isShown())), "OFF にしてもボタンが消えない");
    await game.eval(() => Hai.TouchUI.show());
    await game.frames(4);
    check(await game.eval(() => Hai.TouchUI.isShown()), "show() で出ない");
    game.assertNoErrors();
  } finally {
    await game.close();
  }

  // ---- 縦画面 ----
  game = await launchGame({ context: PORTRAIT });
  try {
    await game.call("newGame");
    await game.waitScene("Scene_Map");
    await game.frames(4);
    await toMap900Stone(game);
    for (const n of ["ok", "menu", "dash"]) {
      const r = await cssRect(game, n);
      check(r, `縦画面でボタン ${n} が無い`);
      check(inView(r), `縦画面でボタン ${n} が画面の外 ${JSON.stringify(r)}`);
      check(r.width >= 64 && r.height >= 64, `縦画面でボタン ${n} が小さい（${r.width.toFixed(1)}px）`);
    }
    await game.shot("portrait");
    await tap(game, "ok");
    await game.waitFor(() => $gameMessage.isBusy());
    await game.shot("portrait-message");
    game.assertNoErrors();
  } finally {
    await game.close();
  }

  // ---- 画面の中に収まるか（#110）----
  // ふつうの窓（MZ はキャンバスを縮めない）と、isMobile だが UA が携帯でない端末
  // （レイアウトの幅が 980 になり、縮まないキャンバスの右と下が切れる。iPadOS の Safari と同じ形）。
  const FIT = {
    "1280x720": {},
    "720x1280": { viewport: { width: 720, height: 1280 } },
    isMobile: { hasTouch: true, isMobile: true },
  };
  for (const [label, context] of Object.entries(FIT)) {
    game = await launchGame({ context });
    try {
      await game.call("newGame");
      await game.waitScene("Scene_Map");
      await game.eval(() => Hai.TouchUI.show());
      await game.frames(4);
      const names = ["ok", "menu", "dash"];
      if (await game.eval(() => !!(Hai.AutoMap && Hai.AutoMap.open))) names.push("map");
      for (const n of names) {
        const r = await cssRect(game, n);
        check(r, `${label}：ボタン ${n} が無い`);
        check(inView(r), `${label}：ボタン ${n} が画面の外 ${JSON.stringify(r)}`);
      }
      await game.shot("fit-" + label);
      // 出ている所で押せる（ダッシュが入る）
      await tap(game, "dash", !context.hasTouch);
      check(await game.eval(() => $gamePlayer.isDashButtonPressed()), `${label}：ダッシュのタップが効かない`);
      await game.call("strengthenParty");
      await game.call("startBattle", 1, true, false);
      await game.waitScene("Scene_Battle");
      await game.frames(4);
      for (const n of ["ok", "cancel"]) {
        const r = await cssRect(game, n);
        check(r, `${label}：戦闘でボタン ${n} が無い`);
        check(inView(r), `${label}：戦闘でボタン ${n} が画面の外 ${JSON.stringify(r)}`);
      }
      await game.shot("fit-" + label + "-battle");
      game.assertNoErrors();
    } finally {
      await game.close();
    }
  }
});
