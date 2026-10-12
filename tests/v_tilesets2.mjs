// V2・V4：タイルセット 15–23（ブラウザなし。15–20 は V2、21–23 は V4）。画像が在る・flags の長さ・A4 の壁の上面が通れない・名前。
// 生成物と同じかは見ない（持ち主がエディタで 15–20 を直してよい）。それは node tools/data/tilesets.mjs --check で見る。
// V4 で足した 21–23 は、A〜C の画像が凡例（legend.json の rampart・undercity・foundry）の前提どおりかも見る。
import fs from "node:fs";
import path from "node:path";
import { check, runTest, ROOT } from "./lib.mjs";
import { readData } from "../tools/data/io.mjs";
import { TILESETS, wallTopIndexes } from "../tools/data/tilesets.mjs";

await runTest(async () => {
  const tilesets = readData("Tilesets.json");
  check(TILESETS.map(d => d.id).join() === "15,16,17,18,19,20,21,22,23", "tools/data/tilesets.mjs の対象が 15–23 でない");

  for (let id = 15; id <= 23; id++) {
    const ts = tilesets[id];
    check(ts && ts.id === id, `Tilesets.json[${id}] が無いか id が違う`);
    check(/^V_/.test(ts.name), `タイルセット ${id} の名前が V_ で始まらない：${ts.name}`);
    check(Array.isArray(ts.flags) && ts.flags.length === 8192, `タイルセット ${id} の flags の長さが 8192 でない`);
    check(ts.tilesetNames.length === 9, `タイルセット ${id} の tilesetNames が 9 個でない`);
    for (const image of ts.tilesetNames.filter(Boolean)) {
      check(fs.existsSync(path.join(ROOT, "img", "tilesets", image + ".png")), `タイルセット ${id} の画像 img/tilesets/${image}.png が無い`);
    }
    // A4 の壁の上面（段差を除く）は、どの形（48 通り）でも 4 方向とも通れない
    const a4 = ts.tilesetNames[3];
    check(a4, `タイルセット ${id} に A4 が無い`);
    const tops = wallTopIndexes(a4);
    check(tops.length >= 20, `タイルセット ${id} の A4（${a4}）の壁の上面が少なすぎる：${tops.length}`);
    for (const k of tops) {
      for (let s = 0; s < 48; s++) {
        const tileId = 2048 + (80 + k) * 48 + s;
        check((ts.flags[tileId] & 0x0f) === 0x0f, `タイルセット ${id} の A4:${k}（形 ${s}、タイル ${tileId}）が通れる`);
      }
    }
  }

  // V4 の 21–23：凡例が前提にする画像（P2 の隠し扉・隠し階段の絵が D の Dungeon_B か B の Dungeon_B に在る）
  const names = id => tilesets[id].tilesetNames;
  check(names(21).slice(0, 7).join() === names(20).slice(0, 7).join() && names(21)[7] === "Dungeon_B", "21 の A〜C が外観でないか、D が Dungeon_B でない");
  check(/<hai_hidden_tiles:D:183,D:26>/.test(tilesets[21].note), "21（B が Outside_B）に <hai_hidden_tiles:D:183,D:26> が無い");
  for (const id of [22, 23]) {
    const n = names(id);
    check([0, 1, 3, 4, 5, 6].every(i => n[i] === tilesets[4].tilesetNames[i]), `${id} の A1・A2・A4・A5・B・C が同梱のダンジョンと違う（凡例 dungeon の文字が使えない）`);
  }
  check(names(22)[2] === "Outside_A3", "22 の A3 が Outside_A3（地下都市の家並み）でない");
  check(names(23)[7] === "Inside_B" && names(23)[8] === "Inside_C", "23 の D・E が内装（炉・金床）でない");
});
