// V2・V4・V5：タイルセット 15–25（ブラウザなし。15–20 は V2、21–23 は V4、24・25 は V5）。画像が在る・flags の長さ・A4 の壁の上面が通れない・名前。
// 生成物と同じかは見ない（持ち主がエディタで 15–20 を直してよい）。それは node tools/data/tilesets.mjs --check で見る。
// V4 で足した 21–23 と V5 で足した 24・25 は、画像が凡例（legend.json の rampart・undercity・foundry・highway・monastery）の前提どおりかも見る。
import fs from "node:fs";
import path from "node:path";
import { check, runTest, ROOT } from "./lib.mjs";
import { readData } from "../tools/data/io.mjs";
import { TILESETS, wallTopIndexes } from "../tools/data/tilesets.mjs";

await runTest(async () => {
  const tilesets = readData("Tilesets.json");
  check(TILESETS.map(d => d.id).join() === "15,16,17,18,19,20,21,22,23,24,25", "tools/data/tilesets.mjs の対象が 15–25 でない");

  for (let id = 15; id <= 25; id++) {
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

  // V5 の 24・25：隠し扉・隠し階段の絵（<hai_hidden_tiles>）が、その画像の「入口A（上半分B）」と「階段C（下り）」を指す
  const tileName = (image, index) =>
    fs.readFileSync(path.join(ROOT, "img", "tilesets", image + ".txt"), "utf8").replace(/^\uFEFF/, "").split(/\r?\n/)[index] || "";
  const hiddenTiles = id => {
    const m = /<hai_hidden_tiles:([B-E]):(\d+),([B-E]):(\d+)>/.exec(tilesets[id].note);
    check(m, `${id} に <hai_hidden_tiles:…> が無い`);
    const image = letter => names(id)[5 + "BCDE".indexOf(letter)];
    return [tileName(image(m[1]), Number(m[2])), tileName(image(m[3]), Number(m[4]))];
  };
  for (const id of [24, 25]) {
    const [door, stairs] = hiddenTiles(id);
    check(/^Entrance A \(Top Half B\)/.test(door) && /^Stairs C \(Down\)/.test(stairs), `${id} の隠し扉・隠し階段の絵が違う：${door}／${stairs}`);
  }
  check(names(24).slice(0, 7).join() === names(20).slice(0, 7).join(), "24 の A〜C が外観でない（凡例 highway の前提）");
  check(names(24)[7] === "Inside_B" && names(24)[8] === "Inside_C", "24 の D・E が内装（麻袋・槍立て・金の延べ棒）でない");
  check(names(25).join() === "Inside_A1,Outside_A2,Outside_A3,Inside_A4,Inside_A5,Inside_B,Inside_C,Dungeon_B,Dungeon_C", `25 の画像の組み合わせが違う：${names(25)}`);
  // 25 の A2 は外観（苔 A2:23・ひび割れ A2:7 が P2 の手がかりに使える）
  check(/^Moss/.test(tileName("Outside_A2", 23)) && /^Fissures/.test(tileName("Outside_A2", 7)), "Outside_A2 の 23・7 が苔・ひび割れでない");
});
