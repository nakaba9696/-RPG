// 文字マップ → MapNNN.json の変換（tools/maps）の検査。
//   前半（ブラウザなし）：オートタイルの形の計算をコアの表・エディタの通行設定・エディタの書いたマップと突き合わせる。
//                         data/ の生成物が今の文字マップと一致する（作り直し忘れがない）。
//   後半（MZ の Web 実行）：見本の迷宮（Map900）に移り、タイルが描かれ、壁に通れず床は通れ、
//                         石碑を調べると文章が出て、階段で Map001 に戻る。
import fs from "node:fs";
import { launchGame, check, runTest } from "./lib.mjs";
import * as A from "../tools/maps/autotile.mjs";
import { buildMap, readSource, listSources, readLegend, findChars, withMapInfo } from "../tools/maps/build.mjs";
import { readData, dataPath, mapFileName, formatMap, formatTable } from "../tools/data/io.mjs";

const SAMPLE = "sample_dungeon";
// 見本の迷宮で歩ける文字（T は石碑のイベントがあるので通れない）
const WALKABLE = new Set([".", ",", "S", "<"]);

function checkAutotileMath() {
  check(A.FLOOR_TABLE.length === 48 && A.WALL_TABLE.length === 16 && A.WATERFALL_TABLE.length === 4, "コアの表の長さ");

  // 床型：周り 8 マスの 256 通りがすべて引け、47 通りの形にちょうど行き渡る
  const floorShapes = new Set();
  for (let m = 0; m < 256; m++) {
    const b = k => !!((m >> k) & 1);
    floorShapes.add(A.shapeFor("floor", { u: b(0), d: b(1), l: b(2), r: b(3), ul: b(4), ur: b(5), dl: b(6), dr: b(7) }));
  }
  check(floorShapes.size === 47 && !floorShapes.has(47), `床型の形が 47 通りでない（${floorShapes.size}）`);
  // 4 辺がつながっていて角だけ違うとき：左上 +1、右上 +2、右下 +4、左下 +8（docs/mz-data.md 2.3 の表）
  const all = { u: true, d: true, l: true, r: true, ul: true, ur: true, dl: true, dr: true };
  check(A.shapeFor("floor", all) === 0, "全部つながると 0");
  check(A.shapeFor("floor", { ...all, ul: false }) === 1 && A.shapeFor("floor", { ...all, ur: false }) === 2 &&
    A.shapeFor("floor", { ...all, dr: false }) === 4 && A.shapeFor("floor", { ...all, dl: false }) === 8, "角の値");
  check(A.shapeFor("floor", { u: false, d: false, l: false, r: false }) === 46, "孤立は 46");
  // 辺が開いているのに角を数えない（開いた辺に接する角は形に入らない）
  check(A.shapeFor("floor", { ...all, l: false, ul: false, dl: false }) === 16, "左が開いた形は 16");
  // 壁型：開いている辺の値の和（左 1、上 2、右 4、下 8）
  for (let m = 0; m < 16; m++) {
    const open = k => !!((m >> k) & 1);
    const s = A.shapeFor("wall", { l: !open(0), u: !open(1), r: !open(2), d: !open(3) });
    check(s === m, `壁型の形 ${m} が ${s}`);
  }
  for (let m = 0; m < 4; m++) {
    check(A.shapeFor("waterfall", { l: !(m & 1), r: !(m & 2) }) === m, `滝型の形 ${m}`);
  }
}

// エディタの設定した通行：A4 の壁の上面は、形ごとに「縁の向きに出られない」ビットが立つ
// （左が開いた形は 0x02、上は 0x08、右は 0x04。下は側面が続くので立たない）。形の計算がこれと一致すること。
function checkAgainstEditorFlags() {
  const tilesets = readData("Tilesets.json");
  let kindsChecked = 0;
  for (const ts of tilesets) {
    if (!ts || !ts.tilesetNames[3]) continue;
    for (let kind = 80; kind < 128; kind++) {
      if (kind % 16 >= 8) continue; // 側面は除く
      const flags = [];
      for (let s = 0; s < 47; s++) flags.push(ts.flags[A.makeAutotileId(kind, s)] & 0x0f);
      if (flags.every(f => f === flags[0])) continue; // 形で通行を分けていない種類
      for (let s = 0; s < 47; s++) {
        const e = A.openEdges("floor", s);
        const want = (e.l ? 0x02 : 0) | (e.u ? 0x08 : 0) | (e.r ? 0x04 : 0);
        check(flags[s] === want, `Tilesets.json[${ts.id}] A4 kind ${kind} shape ${s}: エディタの通行 ${flags[s]} と形の計算 ${want} が違う`);
      }
      kindsChecked++;
    }
  }
  check(kindsChecked > 0, "突き合わせられる壁の上面がなかった");
  console.log(`  エディタの通行設定と一致: A4 の壁の上面 ${kindsChecked} 種`);
}

// エディタの書いたマップ（文字マップから作っていないもの）を読み戻し、形を計算し直して一致するか。
// エディタでは形を手で選ぶこともできる（Shift を押しながら置く）ので、一致しないマスは数を出すだけにする。
function reportEditorMaps() {
  const generated = new Set(listSources().map(n => readSource(n).config.mapId));
  const infos = readData("MapInfos.json");
  for (const info of infos) {
    if (!info || generated.has(info.id)) continue;
    const map = readData(mapFileName(info.id));
    const { width: w, height: h } = map;
    let total = 0;
    let same = 0;
    for (let z = 0; z < 4; z++) {
      const kinds = [];
      for (let y = 0; y < h; y++) {
        kinds.push([]);
        for (let x = 0; x < w; x++) {
          const id = map.data[(z * h + y) * w + x];
          kinds[y].push(A.isAutotile(id) ? A.autotileKind(id) : -1);
        }
      }
      const out = A.resolveLayer(kinds);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (kinds[y][x] < 0) continue;
          total++;
          if (out[y][x] === map.data[(z * h + y) * w + x]) same++;
        }
      }
    }
    console.log(`  エディタのマップ ${mapFileName(info.id)}: オートタイル ${total} マス中 ${same} マスが計算と一致`);
    if (info.id === 1) check(same === total, "Map001 のオートタイルが計算と一致しない");
  }
}

function checkGeneratedUpToDate() {
  const legend = readLegend();
  let infos = readData("MapInfos.json");
  for (const name of listSources()) {
    const source = readSource(name);
    const file = dataPath(mapFileName(source.config.mapId));
    check(fs.existsSync(file), `data/${mapFileName(source.config.mapId)} がない（node tools/maps/build.mjs ${name}）`);
    check(fs.readFileSync(file, "utf8") === formatMap(buildMap(source, legend)),
      `data/${mapFileName(source.config.mapId)} が文字マップ ${name} と一致しない（node tools/maps/build.mjs ${name} で作り直す）`);
    infos = withMapInfo(infos, source.config);
  }
  check(formatTable(infos) === formatTable(readData("MapInfos.json")), "data/MapInfos.json に文字マップのマップが足りない");
}

// 見本の迷宮で、壁の文字が上面・側面に正しく分かれていること
function checkSampleWalls(lines, map) {
  const { width: w, height: h } = map;
  const wallAt = (x, y) => y >= h || lines[y][x] === "#";
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (lines[y][x] !== "#") continue;
      const id = map.data[y * w + x];
      const side = !wallAt(x, y + 1) || !wallAt(x, y + 2);
      check(side ? A.isWallSideTile(id) : A.isWallTopTile(id), `(${x},${y}) は壁の${side ? "側面" : "上面"}のはず（${id}）`);
    }
  }
}

function bfs(lines, from, to) {
  const key = p => `${p.x},${p.y}`;
  const prev = new Map([[key(from), null]]);
  const queue = [from];
  const dirs = [[2, 0, 1], [4, -1, 0], [6, 1, 0], [8, 0, -1]];
  while (queue.length) {
    const p = queue.shift();
    if (p.x === to.x && p.y === to.y) break;
    for (const [d, dx, dy] of dirs) {
      const q = { x: p.x + dx, y: p.y + dy };
      if (!lines[q.y] || !WALKABLE.has(lines[q.y][q.x]) || prev.has(key(q))) continue;
      prev.set(key(q), { p, d });
      queue.push(q);
    }
  }
  const path = [];
  for (let k = key(to); prev.get(k); ) {
    const { p, d } = prev.get(k);
    path.unshift(d);
    k = key(p);
  }
  return path;
}

await runTest(async () => {
  checkAutotileMath();
  checkAgainstEditorFlags();
  reportEditorMaps();
  checkGeneratedUpToDate();

  const source = readSource(SAMPLE);
  const lines = source.lines;
  const fileMap = readData(mapFileName(source.config.mapId));
  checkSampleWalls(lines, fileMap);
  console.log("  オートタイルの計算・生成物: 問題なし");

  const mapId = source.config.mapId;
  const [start] = findChars(lines, "S");
  const [stone] = findChars(lines, "T");
  const [stairs] = findChars(lines, "<");
  const [pit] = findChars(lines, "_");

  const game = await launchGame();
  try {
    await game.call("newGame");
    await game.waitScene("Scene_Map");
    await game.call("transfer", mapId, start.x, start.y, 2);
    await game.waitFor(id => window.__game.mapId() === id && !window.__game.isBusy(), mapId);
    await game.waitFor(() => SceneManager._scene._spriteset._tilemap.isReady());
    await game.frames(20);
    await game.shot("map900-start");

    // ゲームが読んだタイルがファイルと同じ
    const loaded = await game.eval(() => $dataMap.data);
    check(JSON.stringify(loaded) === JSON.stringify(fileMap.data), "MZ が読んだ Map900 の data がファイルと違う");

    // 描画：床と壁の側面は黒くなく、穴の真ん中は黒い（タイルの画像が実際に描かれている）
    const colors = await game.eval(cells => {
      const snap = SceneManager.snap();
      const out = cells.map(c => {
        const sx = Math.round($gameMap.adjustX(c.x) * 48 + 24);
        const sy = Math.round($gameMap.adjustY(c.y) * 48 + 24);
        return { ...c, color: snap.getPixel(sx, sy), onScreen: sx >= 0 && sy >= 0 && sx < Graphics.width && sy < Graphics.height };
      });
      snap.destroy();
      return out;
    }, [
      { what: "床", x: start.x + 1, y: start.y },
      { what: "壁の側面", x: start.x, y: 2 },
      { what: "壁の上面", x: 1, y: start.y },
    ]);
    const brightness = hex => [1, 3, 5].reduce((s, i) => s + parseInt(hex.slice(i, i + 2), 16), 0) / 3;
    for (const c of colors) {
      check(c.onScreen, `${c.what} (${c.x},${c.y}) が画面の外`);
      check(brightness(c.color) > 40, `${c.what} (${c.x},${c.y}) が描かれていない（色 ${c.color}）`);
    }
    console.log("  描画の色: " + colors.map(c => `${c.what} ${c.color}`).join("、"));

    // 通行：隣り合う全マスの組で、MZ の判定が文字マップの「歩ける文字」と一致する
    const pass = await game.eval(({ w, h }) => {
      const p = $gamePlayer;
      const out = [];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out.push([2, 4, 6, 8].map(d => p.canPass(x, y, d)));
      return out;
    }, { w: fileMap.width, h: fileMap.height });
    let pairs = 0;
    for (let y = 0; y < fileMap.height; y++) {
      for (let x = 0; x < fileMap.width; x++) {
        if (!WALKABLE.has(lines[y][x])) continue;
        [[2, 0, 1], [4, -1, 0], [6, 1, 0], [8, 0, -1]].forEach(([d, dx, dy], i) => {
          const nx = x + dx;
          const ny = y + dy;
          const want = ny >= 0 && ny < fileMap.height && nx >= 0 && nx < fileMap.width && WALKABLE.has(lines[ny][nx]);
          const got = pass[y * fileMap.width + x][i];
          check(got === want, `(${x},${y}) から向き ${d} へ「${lines[ny]?.[nx]}」: MZ は ${got ? "通れる" : "通れない"}、文字マップでは ${want ? "通れる" : "通れない"}`);
          pairs++;
        });
      }
    }
    console.log(`  通行の判定が文字マップと一致: ${pairs} 組（壁・穴・岩・石碑は通れない）`);

    // 石碑の左まで歩き、右を向いて調べる
    const toStone = bfs(lines, start, { x: stone.x - 1, y: stone.y });
    check(toStone.length > 0, "石碑まで道がない");
    for (const d of toStone) {
      check(await game.call("step", d), `歩けない（向き ${d}、${JSON.stringify(await game.call("pos"))}）`);
      await game.waitPlayerStopped();
    }
    await game.eval(() => $gamePlayer.setDirection(6));
    await game.press("Enter");
    await game.waitFor(() => $gameMessage.isBusy() && SceneManager._scene._messageWindow.isOpen());
    const text = await game.eval(() => $gameMessage.allText());
    check(text.includes("見本の迷宮"), "石碑の文章が違う: " + text);
    await game.frames(30);
    await game.shot("map900-stone");
    await game.press("Enter");
    await game.waitFor(() => !$gameMessage.isBusy());
    await game.waitIdle();

    // 穴の近くを歩いた所を撮る
    await game.shot("map900-walked");

    // 階段へ歩いて Map001 に戻る
    const toStairs = bfs(lines, { x: stone.x - 1, y: stone.y }, stairs);
    check(toStairs.length > 0, "階段まで道がない");
    for (const d of toStairs) {
      check(await game.call("step", d), `歩けない（向き ${d}）`);
      await game.waitPlayerStopped();
    }
    await game.waitFor(() => window.__game.mapId() === 1 && !window.__game.isBusy());
    const back = await game.call("pos");
    check(back.x === 8 && back.y === 6, `階段の行き先が違う ${JSON.stringify(back)}`);
    console.log(`  石碑の文章 → 階段で Map001 (8,6) に戻った（穴は (${pit.x},${pit.y}) から）`);

    game.assertNoErrors();
  } finally {
    await game.close();
  }
});
