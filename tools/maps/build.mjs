// 文字マップ → data/MapNNN.json の変換。使い方は tools/maps/README.md。
//   node tools/maps/build.mjs            tools/maps/src/*.txt をすべて変換
//   node tools/maps/build.mjs <名前>…    tools/maps/src/<名前>.txt だけ
//   node tools/maps/build.mjs --check    書き出さずに、data/ の中身が今の文字マップと一致するかだけ見る（違えば終了コード 1）
// 置き物の道具（T10。docs/mapdesign.md 6.3）：重ね書き（<名前>.deco.txt）・スタンプ（stamps）・散らし（scatter）・
// 段差（文字の ledge）・建物（文字の roof）。どれも使わない文字マップの出力は前と同じ。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  TILE_ID_A1, TILE_ID_A2, TILE_ID_A3, TILE_ID_A4, TILE_ID_A5,
  TILE_ID_B, TILE_ID_C, TILE_ID_D, TILE_ID_E,
  isAutotile, autotileKind, isShadowingTile, resolveLayer, makeAutotileId, isWallTopTile, isRoofTile,
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
  // 重ね書きの文字マップ（無くてよい）
  const decoPath = path.join(SRC_DIR, name + ".deco.txt");
  let deco = null;
  if (fs.existsSync(decoPath)) {
    deco = fs.readFileSync(decoPath, "utf8").replace(/\r/g, "").split("\n");
    while (deco.length && deco[deco.length - 1] === "") deco.pop();
  }
  return { name, lines, config, deco };
}

export function listSources() {
  return fs
    .readdirSync(SRC_DIR)
    .filter(f => f.endsWith(".txt") && !f.endsWith(".deco.txt"))
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
function resolveChars(legendSet, localChars, where, stampChars = {}) {
  const raw = { ...stampChars, ...legendSet.chars, ...(localChars || {}) };
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
      } else if (k === "ledge" || k === "roof") {
        out[k] = normalizeRise(k, v, `${where}: 文字 "${ch}" の ${k}`);
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
    if (out.ledge && out.roof) throw new Error(`${where}: 文字 "${ch}" に ledge と roof の両方がある`);
    if ((out.ledge || out.roof) && out.wall) throw new Error(`${where}: 文字 "${ch}" に wall と ${out.ledge ? "ledge" : "roof"} の両方がある`);
    visiting.delete(ch);
    done[ch] = out;
    return out;
  }
  for (const ch of Object.keys(raw)) resolve(ch);
  return done;
}

// ---------------------------------------------------------------------------
// 段差（ledge）と建物（roof）
//   { "ledge": { "top": "A4:37", "side": "A4:45", "height": 1, "level": 1 } }
//   { "roof":  { "top": "A3:5",  "side": "A3:13", "height": 2, "level": 10 } }
// 文字のマスは上面（段差は歩ける床、屋根は通れない）。その下 height 行には側面（崖・建物の壁）を自動で付ける。
// 側面になったマスは、もとの文字の z=0・z=1 を捨て、z=2・z=3（梯子・坂・戸口・窓）は残す。
// level の高い方の側面が低い方の上面にかぶさる（段差の既定は 1、屋根は 10）。side を省くと top の 8 つ後（A3・A4 の画像の 1 行下）。
// ---------------------------------------------------------------------------
function normalizeRise(key, spec, where) {
  const top = parseTile(spec.top, `${where}.top`);
  const sheet = key === "ledge" ? "A4" : "A3";
  if (top.auto === undefined || !(key === "ledge" ? isWallTopTile : isRoofTile)(makeAutotileId(top.auto, 0))) {
    throw new Error(`${where}.top は ${key === "ledge" ? "A4 の上面（A4:0〜7・16〜23・32〜39）" : "A3 の屋根（A3:0〜7・16〜23）"}で`);
  }
  let sideKind;
  if (spec.side === undefined) {
    sideKind = top.auto + 8;
  } else {
    const side = parseTile(spec.side, `${where}.side`);
    if (side.auto === undefined || side.auto < SHEET[sheet].kindBase || side.auto >= SHEET[sheet].kindBase + SHEET[sheet].kinds) {
      throw new Error(`${where}.side は ${sheet} のオートタイルで`);
    }
    sideKind = side.auto;
  }
  const height = spec.height ?? (key === "ledge" ? 1 : 2);
  if (!Number.isInteger(height) || height < 1) throw new Error(`${where}.height は 1 以上の整数で`);
  const level = spec.level ?? (key === "ledge" ? 1 : 10);
  return { top: top.auto, side: sideKind, height, level };
}
const riseOf = def => def.ledge || def.roof || null;

// ---------------------------------------------------------------------------
// 散らしの乱数（種付き。mulberry32）。同じ種なら何度走らせても同じ並び。
// ---------------------------------------------------------------------------
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** タイルセットの通行で、そのタイルが「通れない置き物」か（☆でなく、4 方向とも通れない）。 */
function isSolidTile(flags, id) {
  const f = flags[id] ?? 0;
  return id !== 0 && (f & 0x10) === 0 && (f & 0x0f) === 0x0f;
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
  return buildMapWithInfo(source, legend).map;
}

/**
 * buildMap と同じ。info に変換の途中で分かったことを付けて返す。
 *   info.ledgeTops：段差の上面（歩ける A4）のマス "x,y" の集まり（置き物の密度の報告で床に数える）
 */
export function buildMapWithInfo(source, legend = readLegend()) {
  const { name, lines, config } = source;
  const where = `tools/maps/src/${name}`;
  if (!Number.isInteger(config.mapId) || config.mapId < 1 || config.mapId > 999) {
    throw new Error(`${where}.json: mapId は 1〜999 の整数で`);
  }
  const legendSet = legend.sets?.[config.legend];
  if (!legendSet) throw new Error(`${where}.json: legend "${config.legend}" が legend.json の sets にない`);
  const stamps = readStamps(config.stamps, `${where}.json の stamps`);
  // スタンプの文字が文字マップ（.txt）にあれば、その下は stamp.as（既定は "."）の床
  const stampChars = {};
  for (const st of stamps) stampChars[st.at] = { as: st.as ?? "." };
  const chars = resolveChars(legendSet, config.chars, where, stampChars);

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

  // 段差・建物の側面：上に level の高い段差・屋根の文字があり、その height 行以内なら側面（上の行から決める）
  const face = grid.map(row => row.map(() => null));
  const maxRise = Math.max(0, ...Object.values(chars).map(d => riseOf(d)?.height ?? 0));
  if (maxRise > 0) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const level = riseOf(defAt(x, y))?.level ?? 0;
        for (let k = 1; k <= maxRise && y - k >= 0; k++) {
          const r = riseOf(defAt(x, y - k));
          if (!r || face[y - k][x]) continue; // 間の側面のマスは飛ばす
          if (r.level > level && k <= r.height) face[y][x] = r;
          break;
        }
      }
    }
  }

  // 層ごとに「オートタイルの kind（-1 は無し）」と「そのままの ID」を集める
  const kinds = [0, 1, 2, 3].map(() => grid.map(row => row.map(() => -1)));
  const plain = [0, 1, 2, 3].map(() => grid.map(row => row.map(() => 0)));
  const region = grid.map(row => row.map(() => 0));
  const under = grid.map(row => row.map(() => -1)); // 側面になったマスの、もとの z=0 の kind
  const level = grid.map(row => row.map(() => 0)); // z=0 の段の高さ（段差・屋根の level。側面はその段差の level）
  const underLevel = grid.map(row => row.map(() => 0));
  const setTile = (z, x, y, spec, at) => {
    const t = parseTile(spec, at);
    if (t.auto !== undefined) {
      kinds[z][y][x] = t.auto;
      plain[z][y][x] = 0;
    } else {
      plain[z][y][x] = t.id;
      kinds[z][y][x] = -1;
    }
  };
  const isEmptyAt = (z, x, y) => kinds[z][y][x] < 0 && plain[z][y][x] === 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const ch = grid[y][x];
      const def = chars[ch];
      const at = `${where}.txt (${x},${y}) "${ch}"`;
      const rise = riseOf(def);
      if (def.wall) {
        // 下に壁でないマスが height 以内にあれば側面、なければ上面
        const h = def.wall.height ?? 1;
        let side = false;
        for (let k = 1; k <= h; k++) if (!isWallAt(x, y + k)) side = true;
        kinds[0][y][x] = parseTile(side ? def.wall.side : def.wall.top, at).auto;
      } else if (rise) {
        kinds[0][y][x] = rise.top;
        level[y][x] = rise.level;
      }
      (def.tiles || []).forEach((spec, z) => {
        if (z > 3) throw new Error(`${at}: tiles は 4 層（z=0..3）まで`);
        const t = parseTile(spec, at);
        if (t.auto !== undefined) {
          kinds[z][y][x] = t.auto;
          plain[z][y][x] = 0;
        } else if (t.id !== 0 || !(def.wall || rise) || z > 0) {
          plain[z][y][x] = t.id;
          kinds[z][y][x] = -1;
        }
      });
      if (face[y][x]) {
        under[y][x] = kinds[0][y][x];
        underLevel[y][x] = level[y][x];
        level[y][x] = face[y][x].level;
        kinds[0][y][x] = face[y][x].side;
        plain[0][y][x] = 0;
        kinds[1][y][x] = -1;
        plain[1][y][x] = 0;
      }
      region[y][x] = def.region ?? 0;
    }
  }

  // 重ね書き（<名前>.deco.txt）：z=2・z=3 だけ。"." と " " は何も置かない
  const covered = grid.map(row => row.map(() => false)); // 重ね書き・スタンプで置いたマス（散らしは避ける）
  const decoBlocks = [];
  let decoGrid = null;
  if (source.deco) {
    const decoChars = { ...(legendSet.deco || {}), ...(config.deco || {}) };
    if (source.deco.length !== height) throw new Error(`${where}.deco.txt の行の数が ${source.deco.length}（.txt は ${height}）`);
    decoGrid = source.deco.map((l, y) => {
      const row = [...l];
      if (row.length !== width) throw new Error(`${where}.deco.txt の ${y + 1} 行目の長さが ${row.length}（.txt は ${width}）`);
      return row;
    });
    const stampAt = new Set(stamps.map(st => st.at));
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const ch = decoGrid[y][x];
        if (ch === "." || ch === " " || stampAt.has(ch)) continue;
        const def = decoChars[ch];
        const at = `${where}.deco.txt (${x},${y}) "${ch}"`;
        if (!def) throw new Error(`${at}: 文字の定義がない（legend.json の deco か マップの deco に書く）`);
        if (def.z2 !== undefined && def.z2 !== null) setTile(2, x, y, def.z2, at);
        if (def.z3 !== undefined && def.z3 !== null) setTile(3, x, y, def.z3, at);
        if (def.block) decoBlocks.push({ x, y });
        covered[y][x] = true;
      }
    }
  }

  // スタンプ：文字マップか重ね書きの、左上の 1 文字から tiles（z=2）と upper（z=3）をまとめて置く
  for (const st of stamps) {
    const spots = [
      ...findChars(lines, st.at).map(p => ({ ...p, file: ".txt" })),
      ...(source.deco ? findChars(source.deco, st.at).map(p => ({ ...p, file: ".deco.txt" })) : []),
    ];
    if (spots.length === 0) throw new Error(`${where}.json の stamps "${st.at}": 文字が地図にない`);
    for (const p of spots) {
      const at = `${where}${p.file} (${p.x},${p.y}) スタンプ "${st.at}"`;
      if (p.x + st.w > width || p.y + st.h > height) throw new Error(`${at}: ${st.w}×${st.h} が地図の外にはみ出す`);
      for (let dy = 0; dy < st.h; dy++) {
        for (let dx = 0; dx < st.w; dx++) {
          const x = p.x + dx;
          const y = p.y + dy;
          if (decoGrid && (dx || dy) && decoGrid[y][x] !== "." && decoGrid[y][x] !== " ") {
            throw new Error(`${at}: (${x},${y}) は重ね書きで "${decoGrid[y][x]}"。スタンプの下は "." にする`);
          }
          [[2, st.tiles], [3, st.upper]].forEach(([z, rows]) => {
            const spec = rows?.[dy]?.[dx];
            if (spec !== undefined && spec !== null) setTile(z, x, y, spec, at);
          });
          covered[y][x] = true;
        }
      }
    }
  }

  // イベント（散らしがイベントのマスを避けられるよう、先に場所を決める）
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
  for (const p of decoBlocks) place({ type: "block", name: "通行止め" }, p.x, p.y, `${where}.deco.txt (${p.x},${p.y})`);

  // 散らし：on の文字のマスに、種付きの乱数で rate の割合だけ tiles のどれかを置く（z は既定 2）。
  // 置く層（z=2 なら z=3 も）が空いていて、重ね書き・スタンプ・イベント・側面のないマスだけ。行ごとに左から数える。
  const tilesetId = config.tilesetId ?? legendSet.tilesetId;
  (config.scatter || []).forEach((sc, i) => {
    const at = `${where}.json の scatter[${i}]`;
    const on = new Set([...(sc.on ?? "")]);
    if (on.size === 0) throw new Error(`${at}: on（散らす下の文字）がない`);
    if (!Array.isArray(sc.tiles) || sc.tiles.length === 0) throw new Error(`${at}: tiles がない`);
    if (!(sc.rate > 0 && sc.rate <= 1)) throw new Error(`${at}: rate は 0 より大きく 1 以下で`);
    if (!Number.isInteger(sc.seed)) throw new Error(`${at}: seed は整数で`);
    const z = sc.z ?? 2;
    if (![1, 2, 3].includes(z)) throw new Error(`${at}: z は 1〜3`);
    if (!sc.solid) {
      const flags = readTilesetFlags(tilesetId);
      for (const spec of sc.tiles) {
        const t = parseTile(spec, at);
        if (t.auto === undefined && isSolidTile(flags, t.id)) {
          throw new Error(`${at}: "${spec}" は通れないタイル（道をふさぐおそれ）。わざとなら "solid": true`);
        }
      }
    }
    const rand = seededRandom(sc.seed);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!on.has(grid[y][x]) || covered[y][x] || face[y][x] || used.has(`${x},${y}`)) continue;
        if (!isEmptyAt(z, x, y) || (z === 2 && !isEmptyAt(3, x, y))) continue;
        if (rand() >= sc.rate) continue;
        setTile(z, x, y, sc.tiles[Math.floor(rand() * sc.tiles.length)], `${at} (${x},${y})`);
      }
    }
  });

  const data = new Array(width * height * 6).fill(0);
  const idx = (x, y, z) => (z * height + y) * width + x;
  // z=0 の形：同じ kind でも段の高さ（level）が違えばつながらない（同じ絵の 1 段目と 2 段目の間に縁が出る）。
  // 側面がかぶさった下の段の上面は、その側面のマスとつながっていると見る
  // （縁を描かず、縁の通行の止めも付かない。下の段から上の段の梯子・坂へ上がれる）
  const sameOnFloor = (x, y, k, nx, ny, nk) =>
    (nk === k && level[ny][nx] === level[y][x]) || (under[ny][nx] === k && underLevel[ny][nx] === level[y][x]);
  for (let z = 0; z < 4; z++) {
    const auto = z === 0 && maxRise > 0 ? resolveLayer(kinds[z], sameOnFloor) : resolveLayer(kinds[z]);
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

  const bgm = typeof config.bgm === "string" ? { name: config.bgm, pan: 0, pitch: 100, volume: 90 } : config.bgm;
  const bgs = typeof config.bgs === "string" ? { name: config.bgs, pan: 0, pitch: 100, volume: 90 } : config.bgs;
  const map = {
    ...MAP_DEFAULTS,
    ...(bgm ? { bgm: { ...MAP_DEFAULTS.bgm, ...bgm }, autoplayBgm: !!bgm.name } : {}),
    ...(bgs ? { bgs: { ...MAP_DEFAULTS.bgs, ...bgs }, autoplayBgs: !!bgs.name } : {}),
    displayName: config.displayName ?? "",
    note: config.note ?? "",
    ...(config.fields || {}),
    tilesetId,
    width,
    height,
    data,
    events,
  };
  const ledgeTops = new Set();
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (defAt(x, y).ledge && !face[y][x]) ledgeTops.add(`${x},${y}`);
  return { map, info: { ledgeTops } };
}

/** 設定の stamps を読む。{ at, tiles: [[z=2 の行]…], upper: [[z=3 の行]…], as } → 幅・高さ付き。 */
function readStamps(list, where) {
  if (list === undefined) return [];
  if (!Array.isArray(list)) throw new Error(`${where} は配列で`);
  const seen = new Set();
  return list.map((st, i) => {
    const at = `${where}[${i}]`;
    if (typeof st.at !== "string" || [...st.at].length !== 1) throw new Error(`${at}: at は 1 文字で`);
    if (st.at === "." || st.at === " ") throw new Error(`${at}: "." と " " はスタンプにできない`);
    if (seen.has(st.at)) throw new Error(`${at}: "${st.at}" のスタンプが 2 つある`);
    seen.add(st.at);
    const rows = [st.tiles, st.upper].filter(Boolean);
    if (!Array.isArray(st.tiles) || st.tiles.length === 0) throw new Error(`${at}: tiles（z=2 の行の配列）がない`);
    for (const r of rows) if (!Array.isArray(r) || r.some(row => !Array.isArray(row))) throw new Error(`${at}: tiles・upper は行の配列（[["B:1","B:2"]]）で`);
    const h = Math.max(...rows.map(r => r.length));
    const w = Math.max(...rows.flat().map(row => row.length));
    return { ...st, w, h };
  });
}

const tilesetFlagsCache = new Map();
function readTilesetFlags(id) {
  if (!tilesetFlagsCache.has(id)) {
    const ts = readData("Tilesets.json")[id];
    if (!ts) throw new Error(`Tilesets.json に ${id} がない`);
    tilesetFlagsCache.set(id, ts.flags);
  }
  return tilesetFlagsCache.get(id);
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
