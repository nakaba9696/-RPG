// data/*.json を読む・書く小さな関数。書くときはエディタ（RPGツクールMZ）と同じ書式にする（差分を小さくするため）。
//   データベースの表（Actors.json など）と MapInfos.json：「[\nnull,\n{…},\n{…}\n]」（1 行に 1 要素、末尾に改行なし）
//   マップ（MapNNN.json）：「{\n<data と events 以外の欄>,\n"data":[…],\n"events":[\nnull,\n{…}\n]\n}」
//   System.json：1 行
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const DATA_DIR = path.join(ROOT, "data");

export function dataPath(name) {
  return path.join(DATA_DIR, name);
}

export function readData(name) {
  return JSON.parse(fs.readFileSync(dataPath(name), "utf8"));
}

/** マップのファイル名（3 桁ゼロ埋め）。 */
export function mapFileName(mapId) {
  return `Map${String(mapId).padStart(3, "0")}.json`;
}

/** データベースの表と MapInfos.json の書式。 */
export function formatTable(array) {
  return "[\n" + array.map(e => JSON.stringify(e)).join(",\n") + "\n]";
}

/** マップの書式。欄の並びはエディタと同じ（data と events 以外は名前順、最後に data、events）。 */
export function formatMap(map) {
  const head = {};
  for (const key of Object.keys(map).filter(k => k !== "data" && k !== "events").sort()) {
    head[key] = map[key];
  }
  const headText = JSON.stringify(head).slice(1, -1);
  const events = map.events.length ? map.events.map(e => JSON.stringify(e)).join(",\n") + "\n" : "";
  return `{\n${headText},\n"data":${JSON.stringify(map.data)},\n"events":[\n${events}]\n}`;
}

export function writeTable(name, array) {
  fs.writeFileSync(dataPath(name), formatTable(array));
}

export function writeMap(mapId, map) {
  fs.writeFileSync(dataPath(mapFileName(mapId)), formatMap(map));
}

/**
 * 配列を index まで伸ばす（0 番目は null）。足りない所は makeEmpty(id) の空の項目で埋める。
 * MapInfos.json のように隙間が null の表では makeEmpty に () => null を渡す。
 */
export function extendTable(array, index, makeEmpty) {
  if (array.length === 0) array.push(null);
  while (array.length <= index) array.push(makeEmpty(array.length));
  return array;
}
