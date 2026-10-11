// V2：第2段階のタイルセット 15–20（ブラウザなし）。画像が在る・flags の長さ・A4 の壁の上面が通れない・名前。
// 生成物と同じかは見ない（持ち主がエディタで 15–20 を直してよい）。それは node tools/data/tilesets.mjs --check で見る。
import fs from "node:fs";
import path from "node:path";
import { check, runTest, ROOT } from "./lib.mjs";
import { readData } from "../tools/data/io.mjs";
import { TILESETS, wallTopIndexes } from "../tools/data/tilesets.mjs";

await runTest(async () => {
  const tilesets = readData("Tilesets.json");
  check(TILESETS.map(d => d.id).join() === "15,16,17,18,19,20", "tools/data/tilesets.mjs の対象が 15–20 でない");

  for (let id = 15; id <= 20; id++) {
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
});
