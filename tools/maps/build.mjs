// 文字マップ → data/MapNNN.json の変換。使い方は tools/maps/README.md。
//   node tools/maps/build.mjs            tools/maps/src/*.txt をすべて変換
//   node tools/maps/build.mjs <名前>…    tools/maps/src/<名前>.txt だけ
//   node tools/maps/build.mjs --check    書き出さずに、data/ の中身が今の文字マップと一致するかだけ見る（違えば終了コード 1）
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  TILE_ID_A1, TILE_ID_A2, TILE_ID_A3, TILE_ID_A4, TILE_ID_A5,
  TILE_ID_B, TILE_ID_C, TILE_ID_D, TILE_ID_E,
  isAutotile, autotileKind, isShadowingTile, resolveLayer,
} from "./autotile.mjs";
import { readData, dataPath, mapFileName, formatMap, formatTable, extendTable } from "../data/io.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SRC_DIR = path.join(HERE, "src");
export const LEGEND_PATH = path.join(HERE, "legend.json");

// ---------------------------------------------------------------------------
// タイルの書き方 → タイル ID
//   "A1:3"  "A2:0"  "A3:10"  "A4:9"   オートタイル（その画像の中の種類の番号。A2:0 は左上の種類）。形は自動で決まる
//   "A5:12"                          A5 の 12 番（左上から横に数える。1 行 8 個）
//   "B:18"  "C:5"  "D:0"  "E:200"     B〜E の番号（エディタのタブの左半分 0〜127、右半分 128〜255）
//   "B@3,2"                          B〜E を画像の列・行（0 始まり、16 列 × 16 行）で
//   数（2816 など）                   タイル ID をそのまま
// オートタイルは { auto: kind }、それ以外は { id } を返す。
// ---------------------------------------------------------------------------
const SHEET = {
  A1: { base: TILE_ID_A1, kinds: 16, kindBase: 0 },
  A2: { base: TILE_ID_A2, kinds: 32, kindBase: 16 },
  A3: { base: TILE_ID_A3, kinds: 32, kindBase: 48 },
  A4: { base: TILE_ID_A4, kinds: 48, kindBase: 80 },
};
const PLAIN = { A5: [TILE_ID_A5, 128], B: [TILE_ID_B, 256], C: [TILE_ID_C, 256], D: [TILE_ID_D, 256], E: [TILE_ID_E, 256] };

export function parseTile(spec, where = "") {
  if (spec === null || spec === undefined || spec === "" || spec === 0) return { id: 0 };
  if (typeof spec === "number") {
    if (!Number.isInteger(spec) || spec < 0 || spec >= 8192) throw new Error(`${where}: タイル ID ${spec} は 0〜8191 の整数で`);
    return isAutotile(spec) ? { auto: autotileKind(spec) } : { id: spec };
  }
  let m = /^(A[1-4]):(\d+)$/.exec(spec);
  if (m) {
    const s = SHEET[m[1]];
    const n = Number(m[2]);
    if (n >= s.kinds) throw new Error(`${where}: ${spec} の番号は 0〜${s.kinds - 1}`);
    return { auto: s.kindBase + n };
  }
  m = /^(A5|B|C|D|E):(\d+)$/.exec(spec);
  if (m) {
    const [base, count] = PLAIN[m[1]];
    const n = Number(m[2]);
    if (n >= count) throw new Error(`${where}: ${spec} の番号は 0〜${count - 1}`);
    return { id: base + n };
  }
  m = /^(B|C|D|E)@(\d+),(\d+)$/.exec(spec);
  if (m) {
    const col = Number(m[2]);
    const row = Number(m[3]);
    if (col > 15 || row > 15) throw new Error(`${where}: ${spec} の列・行は 0〜15`);
    return { id: PLAIN[m[1]][0] + (col >= 8 ? 128 : 0) + row * 8 + (col % 8) };
  }
  throw new Error(`${where}: タイルの書き方が分からない "${spec}"`);
}

// ---------------------------------------------------------------------------
// 読み込み
// ---------------------------------------------------------------------------
export function readLegend() {
  return JSON.parse(fs.readFileSync(LEGEND_PATH, "utf8"));
}

/** tools/maps/src/<name>.txt と <name>.json を読む。 */
export function readSource(name) {
  const txtPath = path.join(SRC_DIR, name + ".txt");
  const jsonPath = path.join(SRC_DIR, name + ".json");
  if (!fs.existsSync(txtPath)) throw new Error(`${txtPath} がない`);
  if (!fs.existsSync(jsonPath)) throw new Error(`${jsonPath} がない（マップ ID などの設定）`);
  const lines = fs.readFileSync(txtPath, "utf8").replace(/\r/g, "").split("\n");
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  const config = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  return { name, lines, config };
}

export function listSources() {
  return fs
    .readdirSync(SRC_DIR)
    .filter(f => f.endsWith(".txt"))
    .map(f => f.slice(0, -4))
    .sort();
}

/** 文字マップの中で ch がある座標の一覧。 */
export function findChars(lines, ch) {
  const out = [];
  lines.forEach((line, y) => [...line].forEach((c, x) => c === ch && out.push({ x, y })));
  return out;
}

// ---------------------------------------------------------------------------
// 文字の定義
//   { "tiles": [z0, z1, z2, z3], "region": n, "block": true, "as": ".", "shadow": false }
//   { "wall": { "top": "A4:1", "side": "A4:9", "height": 2 } }
// "as" は別の文字の定義を下敷きにして、tiles の null でない所・ほかの欄だけ上書きする。
// ---------------------------------------------------------------------------
function resolveChars(legendSet, localChars, where) {
  const raw = { ...legendSet.chars, ...(localChars || {}) };
  const done = {};
  const visiting = new Set();
  function resolve(ch) {
    if (done[ch]) return done[ch];
    const def = raw[ch];
    if (!def) throw new Error(`${where}: 文字 "${ch}" の定義がない（legend.json か マップの chars に書く）`);
    if (visiting.has(ch)) throw new Error(`${where}: 文字 "${ch}" の as が循環している`);
    visiting.add(ch);
    let out = {};
    if (def.as !== undefined) {
      const base = resolve(def.as);
      out = { ...base, tiles: [...(base.tiles || [])] };
      delete out.block;
    }
    for (const [k, v] of Object.entries(def)) {
      if (k === "as" || k === "name" || k.startsWith("_")) continue;
      if (k === "tiles" && def.as !== undefined) {
        v.forEach((t, z) => {
          if (t !== null) out.tiles[z] = t;
        });
      } else if (k === "tiles") {
        out.tiles = [...v];
      } else {
        out[k] = v;
      }
    }
    if (out.wall) {
      for (const key of ["top", "side"]) {
        const t = parseTile(out.wall[key], `${where} 文字 "${ch}" の wall.${key}`);
        if (t.auto === undefined) throw new Error(`${where}: 文字 "${ch}" の wall.${key} はオートタイル（A3・A4）で`);
      }
    }
    visiting.delete(ch);
    done[ch] = out;
    return out;
  }
  for (const ch of Object.keys(raw)) resolve(ch);
  return done;
}

// ---------------------------------------------------------------------------
// イベント
// ---------------------------------------------------------------------------
const DEFAULT_CONDITIONS = {
  actorId: 1, actorValid: false, itemId: 1, itemValid: false, selfSwitchCh: "A", selfSwitchValid: false,
  switch1Id: 1, switch1Valid: false, switch2Id: 1, switch2Valid: false, variableId: 1, variableValid: false, variableValue: 0,
};

/** エディタと同じ欄・同じ並びのページ。over で上書きする。 */
export function makePage(over = {}) {
  const page = {
    conditions: { ...DEFAULT_CONDITIONS, ...(over.conditions || {}) },
    directionFix: false,
    image: { tileId: 0, characterName: "", direction: 2, pattern: 0, characterIndex: 0, ...(over.image || {}) },
    list: over.list || [{ code: 0, indent: 0, parameters: [] }],
    moveFrequency: 3,
    moveRoute: { list: [{ code: 0, parameters: [] }], repeat: true, skippable: false, wait: false },
    moveSpeed: 3,
    moveType: 0,
    priorityType: 1,
    stepAnime: false,
    through: false,
    trigger: 0,
    walkAnime: true,
  };
  for (const [k, v] of Object.entries(over)) {
    if (k !== "conditions" && k !== "image" && k !== "list") page[k] = v;
  }
  const last = page.list[page.list.length - 1];
  if (!last || last.code !== 0 || last.indent !== 0) throw new Error("イベントの list は { code: 0, indent: 0 } で終わる");
  return page;
}

function imageOf(spec, where) {
  if (!spec) return {};
  const img = { ...spec };
  if (img.tileId !== undefined && typeof img.tileId !== "number") {
    const t = parseTile(img.tileId, where);
    if (t.auto !== undefined) throw new Error(`${where}: イベントの絵にオートタイルは使えない`);
    img.tileId = t.id;
  }
  return img;
}

const DIR_NUM = { down: 2, left: 4, right: 6, up: 8 };
const dirOf = d => (typeof d === "string" ? DIR_NUM[d] : d ?? 0);

/** 設定の 1 件（type: transfer / text / raw / block）から MZ のイベントを作る。 */
function makeEvent(spec, id, x, y, where) {
  const name = spec.name || `EV${String(id).padStart(3, "0")}`;
  let pages;
  if (spec.type === "transfer") {
    const [mapId, tx, ty, d = 0] = spec.to;
    pages = [
      makePage({
        image: imageOf(spec.image, where),
        priorityType: spec.image ? 1 : 0,
        trigger: spec.trigger ?? 1, // プレイヤーから接触
        list: [
          { code: 250, indent: 0, parameters: [{ name: "Move1", volume: 90, pitch: 100, pan: 0 }] },
          { code: 201, indent: 0, parameters: [0, mapId, tx, ty, dirOf(d), spec.fade ?? 0] },
          { code: 0, indent: 0, parameters: [] },
        ],
      }),
    ];
  } else if (spec.type === "text") {
    const msg = [];
    const pagesOfText = Array.isArray(spec.lines[0]) ? spec.lines : [spec.lines];
    for (const block of pagesOfText) {
      msg.push({ code: 101, indent: 0, parameters: ["", 0, spec.background ?? 0, 2, spec.speaker || ""] });
      for (const line of block) msg.push({ code: 401, indent: 0, parameters: [line] });
    }
    msg.push({ code: 0, indent: 0, parameters: [] });
    pages = [
      makePage({
        image: imageOf(spec.image, where),
        priorityType: spec.priorityType ?? 1,
        trigger: spec.trigger ?? 0, // 決定ボタン
        list: msg,
      }),
    ];
  } else if (spec.type === "block") {
    // 通行の上書き：見えないイベントで通れなくする
    pages = [makePage({ priorityType: 1 })];
  } else if (spec.type === "raw") {
    pages = spec.pages.map(p => makePage({ ...p, image: imageOf(p.image, where) }));
  } else {
    throw new Error(`${where}: イベントの type が分からない "${spec.type}"（transfer / text / block / raw）`);
  }
  return { id, name, note: spec.note || "", pages, x, y };
}

// ---------------------------------------------------------------------------
// 変換の本体
// ---------------------------------------------------------------------------
export const MAP_DEFAULTS = {
  autoplayBgm: false, autoplayBgs: false, battleback1Name: "", battleback2Name: "",
  bgm: { name: "", pan: 0, pitch: 100, volume: 90 }, bgs: { name: "", pan: 0, pitch: 100, volume: 90 },
  disableDashing: false, displayName: "", encounterList: [], encounterStep: 30, note: "",
  parallaxLoopX: false, parallaxLoopY: false, parallaxName: "", parallaxShow: true, parallaxSx: 0, parallaxSy: 0,
  scrollType: 0, specifyBattleback: false,
};

/** 1 枚の文字マップから MZ のマップ（オブジェクト）を作る。 */
export function buildMap(source, legend = readLegend()) {
  const { name, lines, config } = source;
  const where = `tools/maps/src/${name}`;
  if (!Number.isInteger(config.mapId) || config.mapId < 1 || config.mapId > 999) {
    throw new Error(`${where}.json: mapId は 1〜999 の整数で`);
  }
  const legendSet = legend.sets?.[config.legend];
  if (!legendSet) throw new Error(`${where}.json: legend "${config.legend}" が legend.json の sets にない`);
  const chars = resolveChars(legendSet, config.chars, where);

  const height = lines.length;
  const width = Math.max(...lines.map(l => [...l].length));
  if (height === 0) throw new Error(`${where}.txt が空`);
  const grid = lines.map((l, y) => {
    const row = [...l];
    if (row.length !== width) throw new Error(`${where}.txt の ${y + 1} 行目の長さが ${row.length}（ほかは ${width}）`);
    return row;
  });
  const defAt = (x, y) => chars[grid[y][x]];
  const isWallAt = (x, y) => x < 0 || y < 0 || x >= width || y >= height || !!defAt(x, y).wall;

  // 層ごとに「オートタイルの kind（-1 は無し）」と「そのままの ID」を集める
  const kinds = [0, 1, 2, 3].map(() => grid.map(row => row.map(() => -1)));
  const plain = [0, 1, 2, 3].map(() => grid.map(row => row.map(() => 0)));
  const region = grid.map(row => row.map(() => 0));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const ch = grid[y][x];
      const def = chars[ch];
      const at = `${where}.txt (${x},${y}) "${ch}"`;
      if (def.wall) {
        // 下に壁でないマスが height 以内にあれば側面、なければ上面
        const h = def.wall.height ?? 1;
        let side = false;
        for (let k = 1; k <= h; k++) if (!isWallAt(x, y + k)) side = true;
        kinds[0][y][x] = parseTile(side ? def.wall.side : def.wall.top, at).auto;
      }
      (def.tiles || []).forEach((spec, z) => {
        if (z > 3) throw new Error(`${at}: tiles は 4 層（z=0..3）まで`);
        const t = parseTile(spec, at);
        if (t.auto !== undefined) {
          kinds[z][y][x] = t.auto;
          plain[z][y][x] = 0;
        } else if (t.id !== 0 || !def.wall || z > 0) {
          plain[z][y][x] = t.id;
          kinds[z][y][x] = -1;
        }
      });
      region[y][x] = def.region ?? 0;
    }
  }

  const data = new Array(width * height * 6).fill(0);
  const idx = (x, y, z) => (z * height + y) * width + x;
  for (let z = 0; z < 4; z++) {
    const auto = resolveLayer(kinds[z]);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        data[idx(x, y, z)] = kinds[z][y][x] >= 0 ? auto[y][x] : plain[z][y][x];
      }
    }
  }
  // 影（z=4）：エディタと同じく、左のマスと左上のマスがどちらも壁（A3・A4）なら、左半分に影を落とす
  // 左のマスの文字が shadow: false（隠し通路の「影の無い壁」）なら落とさない
  if (config.shadows !== false) {
    for (let y = 0; y < height; y++) {
      for (let x = 1; x < width; x++) {
        if (isShadowingTile(data[idx(x, y, 0)])) continue;
        if (defAt(x - 1, y).shadow === false) continue;
        const left = data[idx(x - 1, y, 0)];
        const upLeft = y > 0 ? data[idx(x - 1, y - 1, 0)] : left;
        if (isShadowingTile(left) && isShadowingTile(upLeft)) data[idx(x, y, 4)] = 0b0101;
      }
    }
  }
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data[idx(x, y, 5)] = region[y][x];

  // イベント
  const events = [null];
  const used = new Set();
  const place = (spec, x, y, at) => {
    const key = `${x},${y}`;
    if (used.has(key)) throw new Error(`${at}: (${x},${y}) にイベントが 2 つある`);
    used.add(key);
    events.push(makeEvent(spec, events.length, x, y, at));
  };
  (config.events || []).forEach((spec, i) => {
    const at = `${where}.json の events[${i}]`;
    if (spec.at !== undefined) {
      const spots = findChars(lines, spec.at);
      if (spots.length === 0) throw new Error(`${at}: 文字 "${spec.at}" が地図にない`);
      for (const p of spots) place(spec, p.x, p.y, at);
    } else {
      if (!(spec.x >= 0 && spec.x < width && spec.y >= 0 && spec.y < height)) throw new Error(`${at}: 座標が地図の外`);
      place(spec, spec.x, spec.y, at);
    }
  });
  // 文字の定義に block: true があるマスは、見えないイベントで通れなくする
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (defAt(x, y).block) place({ type: "block", name: "通行止め" }, x, y, `${where}.txt (${x},${y})`);
    }
  }

  const bgm = typeof config.bgm === "string" ? { name: config.bgm, pan: 0, pitch: 100, volume: 90 } : config.bgm;
  const map = {
    ...MAP_DEFAULTS,
    ...(bgm ? { bgm: { ...MAP_DEFAULTS.bgm, ...bgm }, autoplayBgm: !!bgm.name } : {}),
    displayName: config.displayName ?? "",
    note: config.note ?? "",
    ...(config.fields || {}),
    tilesetId: config.tilesetId ?? legendSet.tilesetId,
    width,
    height,
    data,
    events,
  };
  return map;
}

/** MapInfos.json に mapId の要素が無ければ足した配列を返す（既存の要素は触らない）。 */
export function withMapInfo(infos, config) {
  const out = infos.slice();
  if (out[config.mapId]) return out;
  extendTable(out, config.mapId, () => null);
  const order = Math.max(0, ...out.filter(Boolean).map(e => e.order)) + 1;
  out[config.mapId] = {
    id: config.mapId,
    expanded: false,
    name: config.name ?? `MAP${String(config.mapId).padStart(3, "0")}`,
    order,
    parentId: config.parentId ?? 0,
    scrollX: 0,
    scrollY: 0,
  };
  return out;
}

// ---------------------------------------------------------------------------
// コマンドライン
// ---------------------------------------------------------------------------
function main(argv) {
  const check = argv.includes("--check");
  const names = argv.filter(a => !a.startsWith("--"));
  const targets = names.length ? names : listSources();
  const legend = readLegend();
  let infos = readData("MapInfos.json");
  const infosBefore = formatTable(infos);
  const seenIds = new Map();
  let stale = 0;
  for (const name of targets) {
    const source = readSource(name);
    const id = source.config.mapId;
    if (seenIds.has(id)) throw new Error(`${name} と ${seenIds.get(id)} が同じ mapId ${id}`);
    seenIds.set(id, name);
    const text = formatMap(buildMap(source, legend));
    const file = dataPath(mapFileName(id));
    infos = withMapInfo(infos, source.config);
    const current = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
    if (check) {
      if (current !== text) {
        console.error(`古い: data/${mapFileName(id)}（${name} から作り直す: node tools/maps/build.mjs ${name}）`);
        stale++;
      } else {
        console.log(`一致: data/${mapFileName(id)} ← ${name}`);
      }
    } else {
      fs.writeFileSync(file, text);
      console.log(`${current === text ? "変化なし" : "書き出し"}: data/${mapFileName(id)} ← tools/maps/src/${name}.txt`);
    }
  }
  const infosAfter = formatTable(infos);
  if (infosAfter !== infosBefore) {
    if (check) {
      console.error("古い: data/MapInfos.json にマップの要素が足りない");
      stale++;
    } else {
      fs.writeFileSync(dataPath("MapInfos.json"), infosAfter);
      console.log("追記: data/MapInfos.json");
    }
  }
  if (stale) process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (e) {
    console.error("エラー: " + e.message);
    process.exit(1);
  }
}
