// V6 森の色・暗がり・白い林（R1 #14・#15、R2 困る 7）の検査。
//   1. 森（タイルセット 12 の 020・021・023・024）：タイルセットのメモ欄の <hai_tiletone> が地図のタイルにだけ掛かり、
//      掛けないときより画面の彩り（緑）が落ちる。人物（プレイヤー）の絵には掛からない。
//   2. 021 東の白い林：<hai_pale> の一角が、掛けないときより明るい（人物の下・タイルの上）。
//   3. 027 下層（暗がり 1.5）と 028 坑道の門（暗がり 5）：明るい輪の外の思念・宝箱などが淡く光り（手がかりの灯り）、
//      光らせないときより明るい。敵のシンボルは光らない。輪の中では重ねない。暗がりの無いマップでは何も出ない。
import { launchGame, check, runTest } from "./lib.mjs";
import { readData } from "../tools/data/io.mjs";

const FOREST_MAPS = [20, 21, 23, 24];

/** 画面の矩形（マス）の明るさと彩りの平均（0〜255）。toggle(off) を呼んだ画とも比べる。 */
async function compare(game, rect, toggle) {
  return game.eval(
    ([rect, toggleSrc]) => {
      const off = new Function("off", toggleSrc);
      const tw = $gameMap.tileWidth();
      const x = Math.max(0, Math.round($gameMap.adjustX(rect[0]) * tw));
      const y = Math.max(0, Math.round($gameMap.adjustY(rect[1]) * tw));
      const w = Math.min(Graphics.width - x, rect[2] * tw);
      const h = Math.min(Graphics.height - y, rect[3] * tw);
      const stats = () => {
        const d = SceneManager.snap().context.getImageData(x, y, w, h).data;
        let lum = 0;
        let sat = 0;
        for (let i = 0; i < d.length; i += 4) {
          const mx = Math.max(d[i], d[i + 1], d[i + 2]);
          const mn = Math.min(d[i], d[i + 1], d[i + 2]);
          lum += (d[i] + d[i + 1] + d[i + 2]) / 3;
          sat += mx - mn;
        }
        const n = d.length / 4;
        return { lum: lum / n, sat: sat / n };
      };
      const on = stats();
      off(true);
      const without = stats();
      off(false);
      return { on, off: without };
    },
    [rect, toggle]
  );
}

async function enter(game, mapId, x, y, d = 2) {
  await game.call("transfer", mapId, x, y, d);
  await game.waitFor(
    id => {
      if (window.__game.mapId() !== id || $gamePlayer.isTransferring() || !SceneManager._scene._spriteset) return false;
      // 敵のシンボルに触れて戦闘にならないよう消す（見た目だけを見る）
      for (const e of $gameMap.events()) if (/hai_enemy/.test(e.event().note)) e.erase();
      return true;
    },
    mapId
  );
  await game.frames(30);
}

await runTest(async () => {
  // --- データ（ブラウザなしで分かる所） ---
  const tilesets = readData("Tilesets.json");
  check(/<hai_tiletone:[-\d,]+>/.test(tilesets[12].note), "タイルセット 12（霧の森）のメモ欄に <hai_tiletone> がない");
  for (const id of FOREST_MAPS) {
    const map = readData(`Map${String(id).padStart(3, "0")}.json`);
    check(map.tilesetId === 12, `Map${id} のタイルセットが 12 でない`);
  }
  check(/<hai_pale:[\d,;]+>/.test(readData("Map021.json").note), "Map021 のメモ欄に <hai_pale>（東の白い林）がない");

  const game = await launchGame();
  try {
    await game.call("newGame");
    await game.waitScene("Scene_Map");

    // --- 1. 森のタイルの色調 ---
    const offTileTone = `const sp = SceneManager._scene._spriteset._tilemap;
      for (const l of [sp._lowerLayer, sp._upperLayer]) l.filters = off ? null : [l._haiToneFilter];`;
    for (const id of FOREST_MAPS) {
      await enter(game, id, ...(id === 20 ? [30, 25] : id === 21 ? [20, 20] : id === 23 ? [10, 8] : [20, 15]));
      const tone = await game.eval(() => Hai.MapTone.tileTone());
      check(Array.isArray(tone) && tone[3] > 0, `Map${id} にタイルだけの色調が掛かっていない：${JSON.stringify(tone)}`);
      const layers = await game.eval(() => {
        const t = SceneManager._scene._spriteset._tilemap;
        return [t._lowerLayer, t._upperLayer].map(l => (l.filters || []).length);
      });
      check(layers[0] === 1 && layers[1] === 1, `Map${id} の地図の層にフィルタが無い：${layers}`);
    }
    // 020 の画面全体で比べる（木と草の緑が落ちる。暗くしすぎない）
    await enter(game, 20, 30, 25);
    const full = await game.eval(() => [$gameMap.displayX(), $gameMap.displayY()]);
    const forest = await compare(game, [full[0], full[1], 27, 15], offTileTone);
    console.log(`  020 の画面：彩り ${forest.off.sat.toFixed(1)} → ${forest.on.sat.toFixed(1)}、明るさ ${forest.off.lum.toFixed(1)} → ${forest.on.lum.toFixed(1)}`);
    check(forest.on.sat < forest.off.sat * 0.8, `森の彩りが落ちていない：${JSON.stringify(forest)}`);
    check(forest.on.lum > forest.off.lum * 0.75, `森が暗くなりすぎた：${JSON.stringify(forest)}`);
    // 人物には掛からない（プレイヤーの絵は Tilemap の別の子）
    const playerFiltered = await game.eval(() => {
      const sp = SceneManager._scene._spriteset._characterSprites.find(s => s._character === $gamePlayer);
      return !!(sp && sp.filters && sp.filters.length);
    });
    check(!playerFiltered, "プレイヤーの絵にタイルの色調が掛かっている");
    await game.shot("forest020");

    // --- 2. 021 東の白い林 ---
    await enter(game, 21, 55, 30, 6);
    const pale = await game.eval(() => Hai.MapTone.pale());
    check(pale.length === 1 && pale[0].x <= 57 && pale[0].x + pale[0].w >= 59 && pale[0].y <= 31 && pale[0].y + pale[0].h > 31,
      `021 の白い林の一角が (56..58,31) を含まない：${JSON.stringify(pale)}`);
    const offPale = `for (const c of SceneManager._scene._spriteset._tilemap.children)
        if (c instanceof Hai.MapTone.Sprite_HaiPale) c.visible = !off;`;
    const p = pale[0];
    const wood = await compare(game, [p.x + 1, p.y + 1, p.w - 2, p.h - 2], offPale);
    console.log(`  021 の白い林：明るさ ${wood.off.lum.toFixed(1)} → ${wood.on.lum.toFixed(1)}、彩り ${wood.off.sat.toFixed(1)} → ${wood.on.sat.toFixed(1)}`);
    check(wood.on.lum > wood.off.lum + 25, `白い林が白く見えない：${JSON.stringify(wood)}`);
    // 一角の外（西の林）は変わらない
    const west = await compare(game, [40, 36, 6, 4], offPale);
    check(Math.abs(west.on.lum - west.off.lum) < 1, `白い林の外まで白くなった：${JSON.stringify(west)}`);
    await game.shot("white-wood021");

    // --- 3. 暗がりの手がかりの灯り ---
    const offGlow = `SceneManager._scene._spriteset._haiGlowLayer.visible = !off;`;
    check((await game.eval(() => Hai.MapTone.glows())).length === 0, "暗がりの無い 021 に手がかりの灯りが出た");

    // 027 下層（暗がり 1.5、角灯なし）：(40,10) から東の思念 R1-19 (43,9) と宝箱 (46,10) が光る
    await enter(game, 27, 40, 10, 6);
    let glows = await game.eval(() => Hai.MapTone.glows());
    const byId = id => glows.find(g => g.eventId === id);
    check(byId(7) && byId(7).kind === "thought" && byId(7).opacity > 50, `027 の思念 R1-19 が光らない：${JSON.stringify(glows)}`);
    check(byId(12) && byId(12).kind === "thing", `027 の宝箱（秘薬）が光らない：${JSON.stringify(glows)}`);
    const enemyIds = await game.eval(() => $gameMap.events().filter(e => /hai_enemy/.test(e.event().note)).map(e => e.eventId()));
    check(enemyIds.length > 0 && !glows.some(g => enemyIds.includes(g.eventId)), `敵のシンボルが光った：${JSON.stringify(glows)}`);
    const thought = await compare(game, [43, 8.25, 1, 1], offGlow);
    console.log(`  027 の思念 R1-19（輪の外）：明るさ ${thought.off.lum.toFixed(1)} → ${thought.on.lum.toFixed(1)}`);
    check(thought.on.lum > thought.off.lum + 6, `思念が暗がりで見えない：${JSON.stringify(thought)}`);
    await game.shot("dark027");

    // 角灯（半径 5）のとき：輪の中の宝箱（毒消し (8,24)）には重ねず、輪の外の物は光る
    await game.eval(() => $gameParty.gainItem($dataItems[322], 1));
    await enter(game, 26, 21, 3); // 上層を経て入り直す（角灯の明かりのイベントが働く）
    await enter(game, 27, 8, 22);
    await game.frames(10);
    const dark = await game.eval(() => Hai.MapTone.dark());
    check(dark && dark.radius === 5, `角灯で 027 の暗がりが 5 にならない：${JSON.stringify(dark)}`);
    glows = await game.eval(() => Hai.MapTone.glows());
    check(!byId(14), `輪の中の宝箱（毒消し）に灯りを重ねた：${JSON.stringify(glows)}`);
    check(glows.length > 0, `角灯のとき輪の外の手がかりが光らない：${JSON.stringify(glows)}`);
    await game.shot("dark027-lantern");

    // 028 坑道の門（暗がり 5）：入口 (5,7) から思念 R1-22 (16,9) と宝箱 (12,4) が光る。薄い思念 F03 (9,8) は輪の中
    await enter(game, 28, 5, 7, 6);
    glows = await game.eval(() => Hai.MapTone.glows());
    check(byId(4) && byId(4).kind === "thought", `028 の思念 R1-22 が光らない：${JSON.stringify(glows)}`);
    check(byId(5), `028 の宝箱が光らない：${JSON.stringify(glows)}`);
    check(!byId(3) || byId(3).opacity < 60, `輪の中の薄い思念 F03 に灯りを濃く重ねた：${JSON.stringify(glows)}`);
    const thought28 = await compare(game, [16, 8.25, 1, 1], offGlow);
    console.log(`  028 の思念 R1-22（輪の外）：明るさ ${thought28.off.lum.toFixed(1)} → ${thought28.on.lum.toFixed(1)}`);
    check(thought28.on.lum > thought28.off.lum + 6, `028 の思念が暗がりで見えない：${JSON.stringify(thought28)}`);
    await game.shot("dark028");

    game.assertNoErrors();
  } finally {
    await game.close();
  }
});
