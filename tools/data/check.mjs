// data/*.json と js/plugins.js の整合の検査。問題の一覧（文字列の配列）を返す。空なら合格。
//   node tools/data/check.mjs    単独で走らせる（問題があれば終了コード 1）
// tests/t_data.mjs からも呼ぶ。
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { ROOT, DATA_DIR, readData as readDataFile, mapFileName } from "./io.mjs";
import { REGION, DIRS, parseMeta, stairsDest, keyOf, itemsGiven, makeMapModel, canTouch, reachWorld } from "./reach.mjs";
import { listSources, readSource, findChars } from "../maps/build.mjs";

export const TABLES = [
  "Actors.json", "Animations.json", "Armors.json", "Classes.json", "CommonEvents.json", "Enemies.json",
  "Items.json", "Skills.json", "States.json", "Tilesets.json", "Troops.json", "Weapons.json",
];

/**
 * エディタの状態：MZ のエディタが「保存」のたびに書き換える欄。ゲームの中身ではないので、検査で値を問わない。
 *   System.json の editMapId（最後に開いたマップ）・versionId（保存のたびに変わる版番号）
 *   MapInfos.json の各要素の scrollX・scrollY（エディタのスクロール位置。小数もある）
 * 持ち主がエディタで保存して commit しても、これらの差分では何も落ちない。
 */
export const EDITOR_STATE = {
  "System.json": ["editMapId", "versionId"],
  "MapInfos.json": ["scrollX", "scrollY"],
};

/** エディタの状態の欄を除いた写しを返す（比べるとき用）。name は "System.json" か "MapInfos.json"。 */
export function withoutEditorState(name, json) {
  const keys = EDITOR_STATE[name] || [];
  const strip = obj => {
    if (!obj || typeof obj !== "object") return obj;
    const copy = { ...obj };
    for (const k of keys) delete copy[k];
    return copy;
  };
  return Array.isArray(json) ? json.map(strip) : strip(json);
}

/** イベントの list（命令の並び）を検査する。 */
export function checkList(list, where, problems) {
  if (!Array.isArray(list) || list.length === 0) {
    problems.push(`${where}: list が空`);
    return;
  }
  const last = list[list.length - 1];
  if (last.code !== 0 || last.indent !== 0) problems.push(`${where}: list が { code: 0, indent: 0 } で終わっていない`);
  let prev = 0;
  list.forEach((cmd, i) => {
    if (!Number.isInteger(cmd.code) || !Number.isInteger(cmd.indent) || !Array.isArray(cmd.parameters)) {
      problems.push(`${where}: list[${i}] の形が違う（code・indent・parameters）`);
      return;
    }
    if (cmd.indent < 0 || cmd.indent > prev + 1) problems.push(`${where}: list[${i}] の indent ${cmd.indent} が前（${prev}）から飛んでいる`);
    prev = cmd.indent;
  });
}

function readPlugins(text = fs.readFileSync(path.join(ROOT, "js", "plugins.js"), "utf8")) {
  const sandbox = {};
  vm.runInNewContext(text + "\nthis.$plugins = $plugins;", sandbox);
  return sandbox.$plugins;
}

/**
 * readData を差し替えられる（テストでエディタの保存を真似るため）。既定は data/ から読む。
 * dataDir を渡すと、そのフォルダの data/*.json を読む（tests/t_reach.mjs が壊したデータの写しで走らせる）。
 * pluginsText・bands も差し替えられる。
 */
export function checkAll({ dataDir = DATA_DIR, readData, pluginsText, bands = readBands() } = {}) {
  readData = readData || (dataDir === DATA_DIR ? readDataFile : name => JSON.parse(fs.readFileSync(path.join(dataDir, name), "utf8")));
  const problems = [];
  const tables = {};
  for (const name of TABLES) {
    let arr;
    try {
      arr = readData(name);
    } catch (e) {
      problems.push(`${name}: 読めない（${e.message}）`);
      continue;
    }
    tables[name] = arr;
    if (!Array.isArray(arr) || arr[0] !== null) {
      problems.push(`${name}: 配列で、0 番目が null であること`);
      continue;
    }
    arr.forEach((e, i) => {
      if (i === 0) return;
      if (!e || typeof e !== "object") problems.push(`${name}[${i}]: 空（null）にしない。空の項目で埋める`);
      else if (e.id !== i) problems.push(`${name}[${i}]: id が ${e.id}（添字と同じであること）`);
    });
  }

  for (const [i, ce] of (tables["CommonEvents.json"] || []).entries()) {
    if (ce) checkList(ce.list, `CommonEvents.json[${i}]`, problems);
  }
  for (const [i, troop] of (tables["Troops.json"] || []).entries()) {
    if (troop) troop.pages.forEach((p, k) => checkList(p.list, `Troops.json[${i}].pages[${k}]`, problems));
  }

  const system = readData("System.json");
  for (const key of ["switches", "variables"]) {
    if (!Array.isArray(system[key]) || system[key][0] !== "") problems.push(`System.json: ${key} の 0 番目は ""`);
  }

  // エディタの状態（EDITOR_STATE）は値を問わない。数であることだけ見る（エディタは数しか書かない）
  for (const k of EDITOR_STATE["System.json"]) {
    if (k in system && typeof system[k] !== "number") problems.push(`System.json: ${k} が数でない`);
  }

  // MapInfos.json と MapNNN.json
  const infos = readData("MapInfos.json");
  if (!Array.isArray(infos) || infos[0] !== null) problems.push("MapInfos.json: 配列で、0 番目が null であること");
  const mapFiles = fs.readdirSync(dataDir).filter(f => /^Map\d{3}\.json$/.test(f));
  const maps = {};
  infos.forEach((info, i) => {
    if (!info) return;
    if (info.id !== i) problems.push(`MapInfos.json[${i}]: id が ${info.id}`);
    if (info.parentId && !infos[info.parentId]) problems.push(`MapInfos.json[${i}]: 親 ${info.parentId} がない`);
    if (!mapFiles.includes(mapFileName(i))) problems.push(`MapInfos.json[${i}]: data/${mapFileName(i)} がない`);
    for (const k of EDITOR_STATE["MapInfos.json"]) {
      if (k in info && typeof info[k] !== "number") problems.push(`MapInfos.json[${i}]: ${k} が数でない`);
    }
  });
  const tilesets = tables["Tilesets.json"] || [];
  for (const file of mapFiles) {
    const id = Number(file.slice(3, 6));
    if (!infos[id]) problems.push(`data/${file}: MapInfos.json に ${id} 番の要素がない`);
    const map = readData(file);
    maps[id] = map;
    const where = `data/${file}`;
    if (map.data.length !== map.width * map.height * 6) problems.push(`${where}: data の長さが width × height × 6 でない`);
    if (!tilesets[map.tilesetId]) problems.push(`${where}: tilesetId ${map.tilesetId} が Tilesets.json にない`);
    if (map.data.some(v => !Number.isInteger(v) || v < 0 || v >= 8192)) problems.push(`${where}: data に 0〜8191 以外の値がある`);
    if (map.events[0] !== null && map.events.length > 0) problems.push(`${where}: events の 0 番目は null`);
    map.events.forEach((ev, i) => {
      if (!ev) return;
      const at = `${where} events[${i}]「${ev.name}」`;
      if (ev.id !== i) problems.push(`${at}: id が ${ev.id}`);
      if (!(ev.x >= 0 && ev.x < map.width && ev.y >= 0 && ev.y < map.height)) problems.push(`${at}: 座標 (${ev.x},${ev.y}) が地図の外`);
      ev.pages.forEach((p, k) => checkList(p.list, `${at} pages[${k}]`, problems));
    });
  }
  if (!maps[system.startMapId]) problems.push(`System.json: 開始マップ ${system.startMapId} がない`);

  // 場所移動の行き先・到達性・リージョン・ID の帯（T2。tools/data/README.md）
  const world = { maps, tilesets, system, infos, tables, sources: readSources() };
  for (const run of [checkTransfers, checkReach, checkRegions]) {
    try {
      run(world, problems, bands);
    } catch (e) {
      problems.push(`${run.name}: 検査の途中で止まった（${e.message}）。上の形の問題を先に直す`);
    }
  }
  checkBands(world, bands, problems);

  // js/plugins.js
  let plugins = [];
  try {
    plugins = readPlugins(pluginsText);
  } catch (e) {
    problems.push(`js/plugins.js: 読めない（${e.message}）`);
  }
  const names = new Set();
  for (const p of plugins) {
    if (names.has(p.name)) problems.push(`js/plugins.js: ${p.name} が 2 回ある`);
    names.add(p.name);
    if (!fs.existsSync(path.join(ROOT, "js", "plugins", p.name + ".js"))) problems.push(`js/plugins.js: js/plugins/${p.name}.js がない`);
    for (const [k, v] of Object.entries(p.parameters || {})) {
      if (typeof v !== "string") problems.push(`js/plugins.js: ${p.name} の parameters.${k} が文字列でない`);
    }
  }
  checkPluginOrder(plugins, problems);
  return problems;
}

// ---------------------------------------------------------------------------
// T2：場所移動の行き先・到達性・リージョン・ID の帯・プラグインの並び。一覧と直し方は tools/data/README.md
// ---------------------------------------------------------------------------
export const BANDS_PATH = path.join(ROOT, "tools", "data", "bands.json");
export function readBands() {
  return JSON.parse(fs.readFileSync(BANDS_PATH, "utf8"));
}

/** プラグインの並び（在るものだけ、この順）。#35 で持ち主が決めた順。 */
export const PLUGIN_ORDER = [
  "Hai_TestHooks", "Hai_SymbolEnemy", "Hai_HiddenPassage", "Hai_MapTone", "Hai_Battle", "Hai_Boss", "Hai_Thoughts", "Hai_Defeat", "Hai_AutoMap", "Hai_Notes", "Hai_Companions", "Hai_Comfort", "Hai_Warp", "Hai_TouchUI",
];

const mapLabel = id => `data/${mapFileName(Number(id))}`;
const inRanges = (n, ranges) => ranges.some(([a, b]) => n >= a && n <= b);
const rangesText = ranges => (ranges.length ? ranges.map(([a, b]) => (a === b ? `${a}` : `${a}–${b}`)).join("・") : "割り当てなし");
const isTestMap = (id, bands) => inRanges(Number(id), [bands.testMaps]);

/** 文字マップの設定（tools/maps/src/*.json）と、その中の S（テストの開始地点）の座標。 */
function readSources() {
  const out = [];
  for (const name of listSources()) {
    try {
      const { lines, config } = readSource(name);
      const starts = config.chars && config.chars.S ? findChars(lines, "S") : [];
      out.push({ name, mapId: config.mapId, starts });
    } catch {
      // 読めない文字マップは tests/t_maps.mjs が落とす
    }
  }
  return out;
}

/** 場所移動の一覧：イベントの 201（直接指定）・<hai_stairs>・Hai_Defeat の拠点を設定。 */
export function collectTransfers({ maps, tables }) {
  const out = [];
  for (const [id, map] of Object.entries(maps)) {
    for (const ev of map.events) {
      if (!ev) continue;
      const from = `${mapLabel(id)} (${ev.x},${ev.y})「${ev.name}」`;
      const meta = parseMeta(ev.note);
      if (meta.hai_stairs !== undefined) {
        const dest = stairsDest(meta);
        out.push({ fromMap: Number(id), from, what: "隠し階段", dest, bad: dest ? null : `<hai_stairs:${meta.hai_stairs}> が「マップID,x,y」でない` });
      }
      for (const p of ev.pages) collectFromList(p.list, Number(id), from, out);
    }
  }
  for (const ce of tables["CommonEvents.json"] || []) {
    if (ce) collectFromList(ce.list, 0, `コモンイベント ${ce.id}「${ce.name}」`, out);
  }
  return out;
}

function collectFromList(list, fromMap, from, out) {
  for (const c of list) {
    if (c.code === 201 && c.parameters[0] === 0) {
      out.push({ fromMap, from, what: "場所移動", dest: c.parameters.slice(1, 4) });
    } else if (c.code === 357 && c.parameters[0] === "Hai_Defeat" && c.parameters[1] === "setHome") {
      const a = c.parameters[3] || {};
      const n = [a.mapId, a.x, a.y].map(Number);
      if (!n.every(Number.isInteger)) out.push({ fromMap, from, what: "拠点（Hai_Defeat）", dest: null, bad: "拠点の座標が数でない" });
      else if (n[0] === 0 && !fromMap) continue; // コモンイベントの「このマップ」は呼んだ所しだい
      else out.push({ fromMap, from, what: "拠点（Hai_Defeat）", dest: [n[0] || fromMap, n[1], n[2]] });
    }
  }
}

/** マップごとの入口：開始位置・場所移動の行き先・拠点、テスト用マップ（900–949）なら文字マップの S。 */
export function collectEntries(world, bands = readBands()) {
  const entries = {};
  const add = (mapId, x, y, why) => (entries[mapId] = entries[mapId] || []).push({ x, y, why });
  const { system } = world;
  add(system.startMapId, system.startX, system.startY, "開始位置");
  for (const t of collectTransfers(world)) if (t.dest) add(t.dest[0], t.dest[1], t.dest[2], t.from);
  for (const s of world.sources) {
    if (!isTestMap(s.mapId, bands)) continue;
    for (const { x, y } of s.starts) add(s.mapId, x, y, `文字マップ ${s.name} の S`);
  }
  return entries;
}

/** 場所移動の行き先：在るマップ・地図の中・通れるマス（壁のタイル（A3・A4）でなく、立って 1 歩でも動ける）。テスト用マップへは製品から行かない。 */
export function checkTransfers(world, problems, bands = readBands()) {
  const { maps, tilesets, system } = world;
  const party = system.partyMembers || [];
  const models = {};
  const model = id => (models[id] = models[id] || makeMapModel(maps[id], tilesets[maps[id].tilesetId], { partyMembers: party }));
  for (const t of collectTransfers(world)) {
    if (t.bad) {
      problems.push(`${t.from}: ${t.bad}`);
      continue;
    }
    const [mapId, x, y] = t.dest;
    const to = `${t.what}の行き先（マップ ${mapId} の (${x},${y})）`;
    if (!maps[mapId]) problems.push(`${t.from}: ${to}のマップがない`);
    else if (!(x >= 0 && x < maps[mapId].width && y >= 0 && y < maps[mapId].height)) problems.push(`${t.from}: ${to}が地図の外（${maps[mapId].width}×${maps[mapId].height}）`);
    else if (model(mapId).isBlocker(x, y)) problems.push(`${t.from}: ${to}に通せんぼのイベントがある`);
    else if (model(mapId).isWall(x, y) || !model(mapId).canLeave(x, y)) problems.push(`${t.from}: ${to}が壁か、どこへも動けないマス`);
    if (maps[mapId] && isTestMap(mapId, bands) && t.fromMap && !isTestMap(t.fromMap, bands)) {
      problems.push(`${t.from}: 製品のマップからテスト用のマップ ${mapId} へ行ける（900–949 は製品から行けないようにする）`);
    }
  }
  const s = system;
  if (maps[s.startMapId] && (model(s.startMapId).isWall(s.startX, s.startY) || !model(s.startMapId).canLeave(s.startX, s.startY))) {
    problems.push(`System.json: 開始位置（マップ ${s.startMapId} の (${s.startX},${s.startY})）が壁か、どこへも動けないマス`);
  }
}

/** 届くべきイベントの種類（無ければ空）。 */
export function targetKinds(ev) {
  const meta = parseMeta(ev.note);
  const kinds = [];
  if (ev.pages.some(p => p.image && /^!Chest/.test(p.image.characterName)) || ev.name.includes("宝箱")) kinds.push("宝箱");
  if (ev.name.includes("遺骸")) kinds.push("遺骸");
  if (meta.hai_thought !== undefined || ev.name.includes("残留思念")) kinds.push("残留思念");
  if (meta.hai_locked !== undefined) kinds.push("施錠扉");
  if (meta.hai_enemy !== undefined) kinds.push("シンボル敵");
  if (ev.pages.some(p => p.list.some(c => c.code === 201))) kinds.push("場所移動");
  return kinds;
}

/** 宝箱・遺骸・残留思念・施錠扉・シンボル敵・場所移動のイベントに、入口から歩いて届くか（隠し通路込み。施錠扉は鍵に届けば開く）。 */
export function checkReach(world, problems, bands = readBands()) {
  const { maps, tilesets, system, tables } = world;
  const entries = collectEntries(world, bands);
  const freeKeys = [];
  for (const ce of tables["CommonEvents.json"] || []) if (ce) freeKeys.push(...itemsGiven(ce.list));
  const { models, seen, opened, keys } = reachWorld({ maps, tilesets, entries, partyMembers: system.partyMembers || [], freeKeys });
  for (const [id, map] of Object.entries(maps)) {
    const list = (entries[id] || []).filter(e => e.x >= 0 && e.x < map.width && e.y >= 0 && e.y < map.height);
    const where = mapLabel(id);
    if (!list.length) {
      if (inRanges(Number(id), bands.lanes.owner.maps)) continue; // 持ち主の試し用は見ない
      const hint = isTestMap(id, bands) ? "文字マップに S（テストの開始地点）を置く" : "どこかから場所移動で来るようにする";
      problems.push(`${where}: 入口がない（開始位置・場所移動・拠点のどれもこのマップに来ない）。${hint}`);
      continue;
    }
    const from = list.slice(0, 3).map(e => `(${e.x},${e.y})`).join("・") + (list.length > 3 ? " ほか" : "");
    for (const ev of map.events) {
      if (!ev) continue;
      const kinds = targetKinds(ev);
      if (!kinds.length) continue;
      const meta = parseMeta(ev.note);
      const at = `${where} (${ev.x},${ev.y})「${ev.name}」`;
      if (meta.hai_locked !== undefined && !keyOf(meta)) problems.push(`${at}: 施錠扉に <hai_key:アイテムID> がない`);
      if (!canTouch(models[id], seen[id], ev.x, ev.y)) {
        problems.push(`${at}: ${kinds.join("・")}に入口 ${from} から届かない（隠し通路 251–254 込み）`);
      } else if (meta.hai_locked !== undefined && keyOf(meta) && !opened[id].has(ev.id)) {
        const why = keys.has(keyOf(meta)) ? "" : "（鍵をくれるイベント（126）が無いか、届かない）";
        problems.push(`${at}: 施錠扉の鍵 Items ${keyOf(meta)} が手に入らない${why}`);
      }
    }
  }
}

/** リージョン：251–253 は見た目が壁（タイルの通行が × か、A3・A4 の壁）、254 は床。253・254 には同じ座標にタグのイベント。 */
export function checkRegions(world, problems) {
  const { maps, tilesets } = world;
  for (const [id, map] of Object.entries(maps)) {
    const m = makeMapModel(map, tilesets[map.tilesetId]);
    const metaAt = (x, y, tag) => map.events.some(ev => ev && ev.x === x && ev.y === y && parseMeta(ev.note)[tag] !== undefined);
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const r = m.region(x, y);
        if (r < REGION.PASSAGE || r > REGION.STAIRS) continue;
        const at = `${mapLabel(id)} (${x},${y}) リージョン ${r}`;
        const tilePassable = DIRS.some(d => m.isPassable(x, y, d));
        if (r !== REGION.STAIRS && tilePassable && !m.isWall(x, y)) problems.push(`${at}: 隠し通路が通れるタイルの上にある（見た目が壁のタイルに置く）`);
        if (r === REGION.STAIRS && (!tilePassable || m.isWall(x, y))) problems.push(`${at}: 隠し階段は床のタイルに置く`);
        if (r === REGION.ONEWAY && !m.oneway.get(m.key(x, y))) problems.push(`${at}: 片側扉に <hai_oneway:裏の向き> のイベントがない（どちらからも開かない）`);
        if (r === REGION.STAIRS && !metaAt(x, y, "hai_stairs")) problems.push(`${at}: 隠し階段に <hai_stairs:マップID,x,y> のイベントがない`);
      }
    }
  }
}

/** 名前の接頭辞（T_・P1_ など）から帯を引く。接頭辞が無ければ null。 */
function bandFor(name, kind, bands) {
  const m = /^([A-Z])(\d*)_/.exec(name || "");
  if (!m) return null;
  const [, lane, num] = m;
  if (!bands.lanes[lane]) return { error: `接頭辞 ${m[0]} のレーン ${lane} が tools/data/bands.json に無い` };
  if (num) {
    const issue = bands.issues[lane + num];
    if (!issue) return { error: `接頭辞 ${m[0]} の ${lane + num} が割り当て表（tools/data/bands.json の issues）に無い` };
    if (issue[kind]) return { label: `${lane + num} の帯`, ranges: issue[kind] };
  }
  return { label: `${lane} の帯`, ranges: bands.lanes[lane][kind] || [] };
}

const TABLE_KINDS = {
  "Actors.json": "actors", "Classes.json": "actors", "Tilesets.json": "tilesets", "CommonEvents.json": "commonEvents",
  "Skills.json": "database", "Items.json": "database", "Weapons.json": "database", "Armors.json": "database",
  "Enemies.json": "database", "Troops.json": "database", "States.json": "database", "Animations.json": "database",
};

/** ID が帯に収まるか。接頭辞があればその issue（無ければレーン）の帯、無ければどれかのレーンの帯。 */
export function checkBands(world, bands, problems) {
  const one = (where, id, name, kind) => {
    const band = bandFor(name, kind, bands);
    if (band && band.error) problems.push(`${where}「${name}」: ${band.error}`);
    else if (band && !inRanges(id, band.ranges)) problems.push(`${where}「${name}」: ${id} 番は ${band.label}（${rangesText(band.ranges)}）の外`);
    else if (!band && !Object.values(bands.lanes).some(l => inRanges(id, l[kind] || []))) problems.push(`${where}「${name}」: ${id} 番はどの帯にも入っていない（docs/ROADMAP.md の「ID の帯」）`);
  };
  world.infos.forEach((info, i) => info && one(`MapInfos.json[${i}]`, i, info.name, "maps"));
  for (const [file, kind] of Object.entries(TABLE_KINDS)) {
    (world.tables[file] || []).forEach((e, i) => e && e.name && one(`${file}[${i}]`, i, e.name, kind));
  }
  for (const key of ["switches", "variables"]) {
    (world.system[key] || []).forEach((name, i) => name && one(`System.json ${key}[${i}]`, i, name, "switches"));
  }
}

/** js/plugins.js の並び：PLUGIN_ORDER の順（在るものだけ）。 */
export function checkPluginOrder(plugins, problems) {
  const present = plugins.map(p => p.name).filter(n => PLUGIN_ORDER.includes(n));
  const want = PLUGIN_ORDER.filter(n => present.includes(n));
  if (present.join() !== want.join()) {
    problems.push(`js/plugins.js: 並びが違う。今は ${present.join(" → ")}、正しくは ${want.join(" → ")}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const problems = checkAll();
  if (problems.length) {
    console.error(problems.join("\n"));
    process.exit(1);
  }
  console.log("データの整合: 問題なし");
}
