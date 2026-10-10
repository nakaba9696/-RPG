// data/*.json と js/plugins.js の整合の検査。問題の一覧（文字列の配列）を返す。空なら合格。
//   node tools/data/check.mjs    単独で走らせる（問題があれば終了コード 1）
// tests/t_data.mjs からも呼ぶ。
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { ROOT, DATA_DIR, readData as readDataFile, mapFileName } from "./io.mjs";

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

function readPlugins() {
  const text = fs.readFileSync(path.join(ROOT, "js", "plugins.js"), "utf8");
  const sandbox = {};
  vm.runInNewContext(text + "\nthis.$plugins = $plugins;", sandbox);
  return sandbox.$plugins;
}

/** readData を差し替えられる（テストでエディタの保存を真似るため）。既定は data/ から読む。 */
export function checkAll({ readData = readDataFile } = {}) {
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
  const mapFiles = fs.readdirSync(DATA_DIR).filter(f => /^Map\d{3}\.json$/.test(f));
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
  // 場所移動（201、直接指定）の行き先
  const transfers = [];
  for (const [id, map] of Object.entries(maps)) {
    map.events.forEach(ev => ev && ev.pages.forEach(p => p.list.forEach(c => {
      if (c.code === 201 && c.parameters[0] === 0) transfers.push({ from: `data/${mapFileName(Number(id))} 「${ev.name}」`, p: c.parameters });
    })));
  }
  for (const ce of tables["CommonEvents.json"] || []) {
    ce && ce.list.forEach(c => c.code === 201 && c.parameters[0] === 0 && transfers.push({ from: `コモンイベント「${ce.name}」`, p: c.parameters }));
  }
  for (const { from, p } of transfers) {
    const [, mapId, x, y] = p;
    const dest = maps[mapId];
    if (!dest) problems.push(`${from}: 場所移動の行き先のマップ ${mapId} がない`);
    else if (!(x >= 0 && x < dest.width && y >= 0 && y < dest.height)) problems.push(`${from}: 場所移動の行き先 (${x},${y}) がマップ ${mapId} の外`);
  }
  if (!maps[system.startMapId]) problems.push(`System.json: 開始マップ ${system.startMapId} がない`);

  // js/plugins.js
  let plugins = [];
  try {
    plugins = readPlugins();
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
  return problems;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const problems = checkAll();
  if (problems.length) {
    console.error(problems.join("\n"));
    process.exit(1);
  }
  console.log("データの整合: 問題なし");
}
