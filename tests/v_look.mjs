// V1 見た目の土台の検査。
//   1. 画面が 1280×720 で起動する（System.json の advanced、Graphics、スクリーンショットの大きさ）。
//   2. タイルセット 11–14：画像が在り、通行（☆・茂み・梯子・カウンター）が同梱から写っていて、ダンジョンの壁の上面は歩けない。
//   3. Hai_MapTone：<hai_tone> のある Map903 に入ると色調が即時で掛かり、画素の平均が暗くなる。タグの無いマップに出ると戻る。
//      <hai_parallax> で遠景が付く。<hai_dark> でプレイヤーの周りだけ明るく、四隅は暗い。プラグインコマンドで半径を変えられる。
//   4. 敵グループ 101–103 の敵が 1280×720 の戦闘画面に収まる。P2 の Map902 があれば手がかりを 1280×720 で撮る。
import fs from "node:fs";
import path from "node:path";
import { launchGame, check, runTest, ROOT } from "./lib.mjs";
import { readData } from "../tools/data/io.mjs";
import { readSource, findChars } from "../tools/maps/build.mjs";

const MAP_ID = 903;
const TONE = [-68, -68, -34, 68];
const source = readSource("v1_look");
const [START] = findChars(source.lines, "S");

// --- 2. タイルセット（ブラウザなし） ---
function checkTilesets() {
  const tilesets = readData("Tilesets.json");
  const want = { 11: "拠点", 12: "森", 13: "廃坑", 14: "地下牢" };
  const A = (kind, shape = 0) => 2048 + kind * 48 + shape;
  for (const [id, label] of Object.entries(want)) {
    const ts = tilesets[id];
    check(ts && ts.id === Number(id) && ts.name.includes(label), `Tilesets.json[${id}] が「${label}」でない`);
    check(ts.flags.length === 8192 && ts.tilesetNames.length === 9 && ts.mode === 1, `Tilesets.json[${id}] の形`);
    for (const name of ts.tilesetNames.filter(Boolean)) {
      check(fs.existsSync(path.join(ROOT, "img", "tilesets", name + ".png")), `Tilesets.json[${id}] の画像 ${name} が img/tilesets にない`);
    }
    check(ts.flags[0] & 0x10, `Tilesets.json[${id}] B の 0 番が ☆ でない`);
    const bits = { star: 0x10, ladder: 0x20, bush: 0x40, counter: 0x80 };
    for (const [bit, v] of Object.entries(bits)) {
      check(ts.flags.some(f => f & v), `Tilesets.json[${id}] に ${bit} のタイルがない`);
    }
  }
  // ダンジョン系（11・13・14）：Dungeon_A4 の壁の上面（岩の壁 A4:1、石の壁 A4:16）は全部の形で通れない。段差（A4:37）は歩ける形がある。
  for (const id of [11, 13, 14]) {
    const f = tilesets[id].flags;
    for (const k of [1, 16]) {
      for (let s = 0; s < 48; s++) check((f[A(80 + k, s)] & 0x0f) === 0x0f, `Tilesets.json[${id}] A4:${k} の形 ${s} が通れる`);
    }
    check([...Array(47).keys()].some(s => (f[A(80 + 37, s)] & 0x0f) === 0), `Tilesets.json[${id}] 段差 A4:37 が全部通れない`);
    check(tilesets[id].tilesetNames.slice(0, 7).join() === tilesets[4].tilesetNames.slice(0, 7).join(), `Tilesets.json[${id}] の A〜C が同梱のダンジョンと違う（凡例 dungeon が使えない）`);
  }
  // 森（12）：茂み（Outside_A2 の 4 番）が茂み、木の葉（☆）がある
  check(tilesets[12].flags[A(16 + 4)] & 0x40, "森の茂み（A2:4）が茂みでない");
  console.log("  タイルセット 11–14：画像あり、☆・茂み・梯子・カウンターあり、ダンジョンの壁の上面は通れない");
}

/** 画面の矩形の明るさの平均（0〜255）。SceneManager.snap で描画を読む。 */
async function brightness(game, rects) {
  return game.eval(rs => {
    const snap = SceneManager.snap();
    const ctx = snap.context;
    const out = rs.map(([x, y, w, h]) => {
      const d = ctx.getImageData(Math.max(0, x), Math.max(0, y), w, h).data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 4) sum += (d[i] + d[i + 1] + d[i + 2]) / 3;
      return sum / (d.length / 4);
    });
    snap.destroy();
    return out;
  }, rects);
}

await runTest(async () => {
  checkTilesets();

  const game = await launchGame();
  try {
    // --- 1. 画面の大きさ ---
    const size = await game.eval(() => ({
      w: Graphics.width,
      h: Graphics.height,
      bw: Graphics.boxWidth,
      bh: Graphics.boxHeight,
      canvas: [document.querySelector("canvas").width, document.querySelector("canvas").height],
      sys: [$dataSystem.advanced.screenWidth, $dataSystem.advanced.screenHeight, $dataSystem.advanced.uiAreaWidth, $dataSystem.advanced.uiAreaHeight],
    }));
    check(size.w === 1280 && size.h === 720 && size.bw === 1280 - 8 && size.bh === 720 - 8, "画面が 1280×720 でない " + JSON.stringify(size));
    check(size.sys.join() === "1280,720,1280,720", "System.json の advanced " + JSON.stringify(size.sys));
    const vp = game.page.viewportSize();
    check(vp.width === 1280 && vp.height === 720, "スクリーンショットの大きさ " + JSON.stringify(vp));
    await game.shot("title");
    console.log(`  画面：${size.w}×${size.h}（UI の箱 ${size.bw}×${size.bh}。余白 4、canvas ${size.canvas.join("×")}）`);

    await game.call("newGame");
    await game.waitScene("Scene_Map");

    const enter = async (mapId, x, y) => {
      await game.call("transfer", mapId, x, y, 2);
      await game.waitFor(id => window.__game.mapId() === id && !window.__game.isBusy(), mapId);
      await game.waitFor(() => SceneManager._scene._spriteset._tilemap.isReady() && ImageManager.isReady());
      await game.frames(3);
    };
    const look = () =>
      game.eval(() => ({
        tone: $gameScreen.tone().slice(),
        applied: Hai.MapTone.appliedTone(),
        parallax: [$gameMap.parallaxName(), $gameMap._parallaxSx, $gameMap._parallaxSy, $gameMap._parallaxLoopX],
        dark: Hai.MapTone.dark(),
      }));

    // タグの無いマップ（Map900）
    await enter(900, 5, 7);
    const plain = await look();
    check(plain.tone.every(v => v === 0) && !plain.applied && !plain.dark && plain.parallax[0] === "", "Map900 に見た目の効果が付いている " + JSON.stringify(plain));

    // --- 3. Map903 に入る：色調は即時、遠景、暗がり ---
    await enter(MAP_ID, START.x, START.y);
    const tagged = await look();
    check(tagged.tone.join() === TONE.join(), "色調が即時で掛かっていない " + JSON.stringify(tagged.tone));
    check(tagged.parallax.join() === "DarkClouds,1,0,true", "遠景 " + JSON.stringify(tagged.parallax));
    check(tagged.dark && tagged.dark.radius === 5 && tagged.dark.opacity === 230, "暗がり " + JSON.stringify(tagged.dark));
    const tileset = await game.eval(() => $gameMap.tilesetId());
    check(tileset === 14, "Map903 のタイルセットが 14 でない");
    await game.shot("map903-tone-dark");

    // 暗がり：プレイヤーの周りは明るく、四隅は黒い
    const p = await game.eval(() => ({ x: Math.round($gamePlayer.screenX()), y: Math.round($gamePlayer.screenY() - 24) }));
    const W = 1280, H = 720, C = 80;
    // 上の隅は地図の名前のウィンドウとメニューのボタン（暗がりの上）を避ける
    const corners = [[0, 100, C, C], [W - C, 100, C, C], [0, H - C, C, C], [W - C, H - C, C, C]];
    const around = [p.x - 72, p.y - 72, 144, 144];
    const [litDark, ...cornersDark] = await brightness(game, [around, ...corners]);
    const sprite = await game.eval(() => {
      const s = SceneManager._scene._spriteset._haiDarkSprite;
      return { visible: s.visible, bw: s.bitmap.width, bh: s.bitmap.height, x: s.x, y: s.y };
    });
    check(sprite.visible && sprite.bw === Math.ceil((W * 2) / 4) && sprite.bh === Math.ceil((H * 2) / 4), "暗がりの絵の大きさが画面に合っていない " + JSON.stringify(sprite));
    check(sprite.x === p.x && sprite.y === p.y, "暗がりがプレイヤーに付いていない " + JSON.stringify({ sprite, p }));
    check(Math.max(...cornersDark) < 12, "暗がりの四隅が暗くない " + cornersDark.map(v => v.toFixed(1)).join(","));
    check(litDark > Math.max(...cornersDark) + 15, `プレイヤーの周りが明るくない（周り ${litDark.toFixed(1)}、四隅 ${cornersDark.map(v => v.toFixed(1)).join(",")}）`);
    console.log(`  暗がり：プレイヤーの周り ${litDark.toFixed(1)}、四隅 ${cornersDark.map(v => v.toFixed(1)).join(" / ")}`);

    // 歩くと暗がりも付いてくる
    check(await game.call("step", 6), "右に歩けない");
    await game.waitPlayerStopped();
    await game.frames(2);
    const moved = await game.eval(() => {
      const s = SceneManager._scene._spriteset._haiDarkSprite;
      return { sx: s.x, sy: s.y, px: Math.round($gamePlayer.screenX()), py: Math.round($gamePlayer.screenY() - 24) };
    });
    check(moved.sx === moved.px && moved.sy === moved.py, "歩いたあと暗がりがずれた " + JSON.stringify(moved));

    // プラグインコマンドで暗がりを消す（色調だけ）
    await game.eval(() => PluginManager.callCommand($gameMap._interpreter, "Hai_MapTone", "dark", { radius: "0" }));
    await game.frames(3);
    check(!(await look()).dark, "dark 0 で暗がりが消えない");
    const full = [[0, 96, W, H - 96]]; // 上の 2 行（遠景）を除いた画面
    const [toned] = await brightness(game, full);
    const [, ...cornersToneOnly] = await brightness(game, [around, ...corners]);
    check(Math.min(...cornersToneOnly.slice(2)) > Math.max(...cornersDark) + 5, "暗がりを消しても下の四隅が暗いまま " + cornersToneOnly.map(v => v.toFixed(1)).join(","));
    await game.shot("map903-tone-only");

    // 色調を外すと明るくなる（＝色調で画素の平均が暗くなっている）
    await game.eval(() => $gameScreen.startTint([0, 0, 0, 0], 0));
    await game.frames(3);
    const [untoned] = await brightness(game, full);
    check(toned < untoned - 5, `色調で暗くなっていない（色調あり ${toned.toFixed(1)}、なし ${untoned.toFixed(1)}）`);
    console.log(`  色調：画素の平均 ${untoned.toFixed(1)} → ${toned.toFixed(1)}（${TONE.join(",")}）`);
    await game.shot("map903-no-tone");

    // darkReset でメモ欄の値に戻る
    await game.eval(() => PluginManager.callCommand($gameMap._interpreter, "Hai_MapTone", "darkReset", {}));
    check((await look()).dark.radius === 5, "darkReset で戻らない");

    // タグの無いマップに出ると、プラグインの掛けた色調は戻る。イベントで変えた色調は残る。
    await enter(MAP_ID, START.x, START.y); // 同じマップへの移動では掛け直さない（色調は今 0 のまま）
    await enter(900, 5, 7);
    await enter(MAP_ID, START.x, START.y);
    check((await look()).tone.join() === TONE.join(), "入り直しで色調が掛からない");
    await enter(900, 5, 7);
    const back = await look();
    check(back.tone.every(v => v === 0) && !back.applied && !back.dark && back.parallax[0] === "", "Map900 に戻っても効果が残っている " + JSON.stringify(back));
    await enter(MAP_ID, START.x, START.y);
    await game.eval(() => $gameScreen.startTint([40, 0, 0, 0], 0)); // イベントの「画面の色調変更」の代わり
    await enter(900, 5, 7);
    check((await look()).tone.join() === "40,0,0,0", "イベントで変えた色調が消された");
    await game.eval(() => $gameScreen.startTint([0, 0, 0, 0], 0));
    console.log("  タグの無いマップに出ると色調が戻る。イベントで変えた色調は残る");

    // セーブ → ロードで、色調・暗がりの上書きが残る
    await enter(MAP_ID, START.x, START.y);
    await game.eval(() => PluginManager.callCommand($gameMap._interpreter, "Hai_MapTone", "dark", { radius: "2.5" }));
    await game.call("save", 1);
    await game.reload();
    await game.call("load", 1);
    await game.waitScene("Scene_Map");
    const loaded = await look();
    check(loaded.tone.join() === TONE.join() && loaded.dark.radius === 2.5 && loaded.applied.join() === TONE.join(), "ロードで見た目が戻らない " + JSON.stringify(loaded));
    await game.frames(5);
    await game.shot("map903-loaded-radius2_5");

    // --- 4. P2 の Map902（手がかり）を 1280×720 で ---
    const has902 = await game.eval(() => !!$dataMapInfos[902]);
    if (has902) {
      await enter(902, 5, 11);
      await game.shot("map902-clues");
      // ダンジョンの雰囲気（Map903 と同じ色調＋暗がり半径 6）の下で、手がかりがどう見えるか
      await enter(902, 7, 11);
      await game.eval(tone => {
        $gameScreen.startTint(tone, 0);
        PluginManager.callCommand($gameMap._interpreter, "Hai_MapTone", "dark", { radius: "6" });
      }, TONE);
      await game.frames(3);
      await game.shot("map902-clues-dark");
      await game.eval(() => $gameScreen.startTint([0, 0, 0, 0], 0));
      console.log("  Map902（手がかり）を撮った");
    }

    // 敵グループ 101–103 が 1280×720 の戦闘画面に収まる
    await game.call("startBattle", 102, true, false);
    await game.waitScene("Scene_Battle");
    await game.frames(60);
    const enemies = await game.eval(() => $gameTroop.members().map(e => [e.screenX(), e.screenY()]));
    check(enemies.length === 2 && enemies.every(([x, y]) => x > 100 && x < 1180 && y > 200 && y < 720), "敵の位置 " + JSON.stringify(enemies));
    await game.shot("battle-102");

    game.assertNoErrors();
  } finally {
    await game.close();
  }
});
