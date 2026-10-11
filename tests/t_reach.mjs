// データの自動検証（T2、ブラウザなし）：tools/data/check.mjs の到達性・場所移動の行き先・リージョン・ID の帯・プラグインの並び。
// 1. 今の data/ で検査が通る。
// 2. わざと壊したデータで落ちる。data/ の写しを一時フォルダに作って壊し、checkAll({ dataDir }) で走らせる（data/ は触らない）。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { check, runTest } from "./lib.mjs";
import { checkAll } from "../tools/data/check.mjs";
import { DATA_DIR, ROOT } from "../tools/data/io.mjs";

const read = (dir, name) => JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
const write = (dir, name, json) => fs.writeFileSync(path.join(dir, name), JSON.stringify(json));

/** data/ の写しを作り、edit(dir) で壊して検査する。問題の一覧を返す。 */
function broken(label, edit, opts = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hai-t-reach-"));
  try {
    for (const f of fs.readdirSync(DATA_DIR)) fs.copyFileSync(path.join(DATA_DIR, f), path.join(dir, f));
    edit(dir);
    const t0 = Date.now();
    const problems = checkAll({ dataDir: dir, ...opts });
    console.log(`  壊した例「${label}」（${Date.now() - t0} ms）:\n    ${problems.join("\n    ") || "（問題なし）"}`);
    return problems;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const setTile = (map, x, y, z, id) => (map.data[(z * map.height + y) * map.width + x] = id);
const setRegion = (map, x, y, r) => setTile(map, x, y, 5, r);
const eventNamed = (map, name) => map.events.find(e => e && e.name === name);

await runTest(async () => {
  // 1. 今の data/ で通る
  const t0 = Date.now();
  const problems = checkAll();
  console.log(`  今の data/ の検査: ${Date.now() - t0} ms`);
  check(problems.length === 0, "今の data/ で検査が落ちる:\n  " + problems.join("\n  "));

  const expect = (label, edit, needle, opts) => {
    const got = broken(label, edit, opts);
    check(got.some(p => p.includes(needle)), `「${label}」で「${needle}」の問題が出ない:\n  ${got.join("\n  ")}`);
  };

  // 場所移動の行き先を壁に（Map902 の上り階段 → 同じマップの (0,0) は岩の壁）
  expect("場所移動の行き先が壁", dir => {
    const map = read(dir, "Map902.json");
    const cmd = eventNamed(map, "上り階段").pages[0].list.find(c => c.code === 201);
    cmd.parameters = [0, 902, 0, 0, 2, 0];
    write(dir, "Map902.json", map);
  }, "data/Map902.json (25,14)「上り階段」: 場所移動の行き先（マップ 902 の (0,0)）が壁か、どこへも動けないマス");

  // 行き先のマップがない・地図の外
  expect("場所移動の行き先のマップがない", dir => {
    const map = read(dir, "Map900.json");
    eventNamed(map, "上り階段").pages[0].list.find(c => c.code === 201).parameters = [0, 948, 1, 1, 2, 0];
    write(dir, "Map900.json", map);
  }, "場所移動の行き先（マップ 948 の (1,1)）のマップがない");

  // 隠し階段の行き先が地図の外
  expect("隠し階段の行き先が地図の外", dir => {
    const map = read(dir, "Map902.json");
    eventNamed(map, "隠し階段").note = "<hai_stairs:902,99,3>";
    write(dir, "Map902.json", map);
  }, "「隠し階段」: 隠し階段の行き先（マップ 902 の (99,3)）が地図の外");

  // 宝箱を囲む（Map902 の赤い宝箱 (17,4) の上下左右に岩 B:41（通行 ×。文字マップの o）を置く）
  expect("宝箱を岩で囲む", dir => {
    const map = read(dir, "Map902.json");
    const chest = eventNamed(map, "赤い宝箱");
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) setTile(map, chest.x + dx, chest.y + dy, 2, 41);
    write(dir, "Map902.json", map);
  }, "data/Map902.json (17,4)「赤い宝箱」: 宝箱に入口");

  // 隠し通路なら届く宝箱が、通路（251）を消すと届かない（隠し通路込みで数えていること）
  expect("見えない通路を消す", dir => {
    const map = read(dir, "Map902.json");
    for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if ([251, 252, 253].includes(map.data[5 * map.width * map.height + y * map.width + x])) setRegion(map, x, y, 0);
    write(dir, "Map902.json", map);
  }, "「赤い宝箱」: 宝箱に入口");

  // 251 を床に置く（Map900 の開始地点の右の床 (6,7)）
  expect("251 を床に置く", dir => {
    const map = read(dir, "Map900.json");
    setRegion(map, 6, 7, 251);
    write(dir, "Map900.json", map);
  }, "data/Map900.json (6,7) リージョン 251: 隠し通路が通れるタイルの上にある");

  // 帯の外の ID（P1 の帯 101–120 の外の 121 番に P1_ の敵グループ）
  expect("帯の外の ID", dir => {
    const troops = read(dir, "Troops.json");
    while (troops.length <= 121) troops.push({ ...troops[troops.length - 1], id: troops.length, name: "" });
    troops[121].name = "P1_はみ出し";
    write(dir, "Troops.json", troops);
  }, "Troops.json[121]「P1_はみ出し」: 121 番は P1 の帯（101–120）の外");

  // 割り当て表に無い issue の接頭辞のマップ
  expect("割り当て表に無い接頭辞", dir => {
    const infos = read(dir, "MapInfos.json");
    infos[903].name = "W9_試し";
    write(dir, "MapInfos.json", infos);
  }, "MapInfos.json[903]「W9_試し」: 接頭辞 W9_ の W9 が割り当て表");

  // 施錠扉：鍵が手に入らないと落ち、鍵（宝箱がくれる Items 7）に届けば開く
  const lock = key => dir => {
    const map = read(dir, "Map902.json");
    eventNamed(map, "上り階段").note = `<hai_locked:試しの鍵><hai_key:${key}>`;
    write(dir, "Map902.json", map);
  };
  expect("鍵の無い施錠扉", lock(999), "data/Map902.json (25,14)「上り階段」: 施錠扉の鍵 Items 999 が手に入らない");
  const opened = broken("鍵に届く施錠扉", lock(7));
  check(opened.length === 0, "宝箱の鍵（Items 7）で開く施錠扉で検査が落ちる:\n  " + opened.join("\n  "));

  // 製品のマップからテスト用のマップへ行ける
  expect("製品からテスト用のマップへ", dir => {
    const map = read(dir, "Map001.json");
    map.events = [null, { ...read(dir, "Map900.json").events[2], id: 1, x: 2, y: 2 }];
    eventNamed(map, "上り階段").pages[0].list.find(c => c.code === 201).parameters = [0, 900, 5, 7, 2, 0];
    write(dir, "Map001.json", map);
  }, "製品のマップからテスト用のマップ 900 へ行ける");

  // 入口の無いテスト用のマップ（文字マップの S の無い Map903 の写しを 949 に）
  expect("入口の無いマップ", dir => {
    fs.copyFileSync(path.join(dir, "Map903.json"), path.join(dir, "Map949.json"));
    const infos = read(dir, "MapInfos.json");
    while (infos.length <= 949) infos.push(null);
    infos[949] = { ...infos[903], id: 949, name: "T_入口なし" };
    write(dir, "MapInfos.json", infos);
  }, "data/Map949.json: 入口がない");

  // プラグインの並び
  const pluginsText = fs.readFileSync(path.join(ROOT, "js", "plugins.js"), "utf8");
  const rows = pluginsText.split("\n").map(l => (l.startsWith("{") ? l.replace(/,$/, "") : l));
  const a = rows.findIndex(l => l.includes('"name":"Hai_SymbolEnemy"'));
  const b = rows.findIndex(l => l.includes('"name":"Hai_HiddenPassage"'));
  [rows[a], rows[b]] = [rows[b], rows[a]];
  const last = rows.findLastIndex(l => l.startsWith("{"));
  const swapped = rows.map((l, i) => (l.startsWith("{") && i !== last ? l + "," : l)).join("\n");
  expect("プラグインの並び", () => {}, "js/plugins.js: 並びが違う", { pluginsText: swapped });

  console.log("  到達性・場所移動・リージョン・帯・プラグインの並び: 問題なし（壊したデータではすべて落ちた）");
});
