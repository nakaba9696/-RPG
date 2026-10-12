// System.json の switches・variables（名前の配列）を、指定の番号まで "" で伸ばす（T12）。
// W の帯 1001–1500（docs/ROADMAP.md の「ID の帯」）を使うために 1500 まで伸ばす。既にある名前は変えず、末尾に足すだけ（共有ファイルの約束）。
//   node tools/data/extend-system.mjs          # 1500 まで（既定）
//   node tools/data/extend-system.mjs 1600     # 番号を指定
// MZ のエディタの「最大数」が小さいまま保存すると、配列はエディタの最大数まで切り詰められる。持ち主はエディタで最大数を同じ数に上げる。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dataPath, readData } from "./io.mjs";

export const SYSTEM_NAME_KEYS = ["switches", "variables"];
export const W_BAND_MAX = 1500;

/** system の switches・variables を max 番まで "" で伸ばす（長さ max + 1）。伸ばした数を { switches, variables } で返す。縮めない。 */
export function extendSystemNames(system, max = W_BAND_MAX) {
  const added = {};
  for (const key of SYSTEM_NAME_KEYS) {
    const names = system[key];
    if (!Array.isArray(names)) throw new Error(`System.json の ${key} が配列でない`);
    if (names.length === 0) names.push("");
    added[key] = 0;
    while (names.length <= max) {
      names.push("");
      added[key]++;
    }
  }
  return added;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const max = Number(process.argv[2] || W_BAND_MAX);
  if (!Number.isInteger(max) || max < 1) {
    console.error(`番号は 1 以上の整数で（${process.argv[2]}）`);
    process.exit(1);
  }
  const system = readData("System.json");
  const added = extendSystemNames(system, max);
  fs.writeFileSync(dataPath("System.json"), JSON.stringify(system)); // System.json は 1 行（io.mjs の書式）
  console.log(`System.json: switches を ${added.switches} 個、variables を ${added.variables} 個伸ばした（${max} 番まで）`);
}
