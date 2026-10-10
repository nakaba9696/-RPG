// オートタイルの shape（形の番号）の計算。
//
// 推測の表は持たない。コアスクリプト js/rmmz_core.js の
//   Tilemap.FLOOR_AUTOTILE_TABLE / WALL_AUTOTILE_TABLE / WATERFALL_AUTOTILE_TABLE
// （shape → 4 つの 1/4 マスを画像のどこから切り出すか）をそのまま読み込み、逆に引く：
//   1. 周りのマスが同じ種類か（つながっているか）から、4 つの 1/4 マスそれぞれの「欲しい部品」を決める。
//   2. 表の中で、4 つの部品が全部一致する shape を探す。
// 部品の見分け方（オートタイル画像の中の 1/4 マスの位置で決まる。RPGツクールの画像の決まり）：
//   床型（A1 の水・A2・A4 の上面）：2×3 マス＝4×6 の 1/4 マス。
//     (0..1, 0..1) 見本、(2..3, 0..1) 内側の角、
//     下の 2×2 マス（y=2..5）の外周は縁：x=0 が左、x=3 が右、y=2 が上、y=5 が下。内側（x=1..2, y=3..4）は真ん中。
//   壁型（A3・A4 の側面）：2×2 マス＝4×4 の 1/4 マス。x=0 が左、x=3 が右、y=0 が上、y=3 が下の縁。
//   滝型（A1 の滝）：2×1 マス＝4×2 の 1/4 マス。x=0 が左、x=3 が右の縁。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export const TILE_ID_B = 0;
export const TILE_ID_C = 256;
export const TILE_ID_D = 512;
export const TILE_ID_E = 768;
export const TILE_ID_A5 = 1536;
export const TILE_ID_A1 = 2048;
export const TILE_ID_A2 = 2816;
export const TILE_ID_A3 = 4352;
export const TILE_ID_A4 = 5888;
export const TILE_ID_MAX = 8192;

/** js/rmmz_core.js から Tilemap.<name> の表を読む。 */
export function readCoreTable(name, coreText) {
  const text = coreText ?? fs.readFileSync(path.join(ROOT, "js", "rmmz_core.js"), "utf8");
  const m = text.match(new RegExp(`Tilemap\\.${name}\\s*=\\s*(\\[[\\s\\S]*?\\]);`));
  if (!m) throw new Error(`rmmz_core.js に Tilemap.${name} が見つからない`);
  return JSON.parse(m[1]);
}

export const FLOOR_TABLE = readCoreTable("FLOOR_AUTOTILE_TABLE");
export const WALL_TABLE = readCoreTable("WALL_AUTOTILE_TABLE");
export const WATERFALL_TABLE = readCoreTable("WATERFALL_AUTOTILE_TABLE");

// ---- タイル ID の判定（rmmz_core.js の Tilemap.is*Tile と同じ） ----
export const isAutotile = id => id >= TILE_ID_A1;
export const autotileKind = id => Math.floor((id - TILE_ID_A1) / 48);
export const autotileShape = id => (id - TILE_ID_A1) % 48;
export const makeAutotileId = (kind, shape) => TILE_ID_A1 + kind * 48 + shape;
export const isTileA1 = id => id >= TILE_ID_A1 && id < TILE_ID_A2;
export const isTileA2 = id => id >= TILE_ID_A2 && id < TILE_ID_A3;
export const isTileA3 = id => id >= TILE_ID_A3 && id < TILE_ID_A4;
export const isTileA4 = id => id >= TILE_ID_A4 && id < TILE_ID_MAX;
export const isTileA5 = id => id >= TILE_ID_A5 && id < TILE_ID_A1;
export const isWaterfallTile = id =>
  id >= TILE_ID_A1 + 192 && id < TILE_ID_A2 && autotileKind(id) % 2 === 1;
export const isRoofTile = id => isTileA3(id) && autotileKind(id) % 16 < 8;
export const isWallTopTile = id => isTileA4(id) && autotileKind(id) % 16 < 8;
export const isWallSideTile = id => (isTileA3(id) || isTileA4(id)) && autotileKind(id) % 16 >= 8;
export const isShadowingTile = id => isTileA3(id) || isTileA4(id);
export const isFloorTypeAutotile = id =>
  (isTileA1(id) && !isWaterfallTile(id)) || isTileA2(id) || isWallTopTile(id);
export const isWallTypeAutotile = id => isRoofTile(id) || isWallSideTile(id);

/** kind（0..127）から、その種類が床型・壁型・滝型のどれか。 */
export function autotileType(kind) {
  const id = makeAutotileId(kind, 0);
  if (isWaterfallTile(id)) return "waterfall";
  if (isWallTypeAutotile(id)) return "wall";
  return "floor";
}

// ---- 部品の見分け（1/4 マス q：0 左上、1 右上、2 左下、3 右下） ----
// 部品は { h, v, inner, preview } で表す：h＝横の縁（左右の隣が別）、v＝縦の縁（上下の隣が別）、inner＝内側の角。
function floorPiece([x, y]) {
  if (y <= 1) return x <= 1 ? { preview: true } : { h: false, v: false, inner: true };
  const h = x === 0 || x === 3;
  const v = y === 2 || y === 5;
  return { h, v, inner: false };
}
function wallPiece([x, y]) {
  return { h: x === 0 || x === 3, v: y === 0 || y === 3, inner: false };
}
function waterfallPiece([x]) {
  return { h: x === 0 || x === 3, v: false, inner: false };
}
const pieceKey = p => (p.preview ? "P" : `${+p.h}${+p.v}${+p.inner}`);

function buildLookup(table, piece) {
  const map = new Map();
  table.forEach((quarters, shape) => {
    const key = quarters.map(q => pieceKey(piece(q))).join("|");
    if (key.includes("P")) return; // 見本（床型の 47）は地図に置かない
    if (map.has(key)) throw new Error(`オートタイルの表に同じ形が 2 つある（shape ${map.get(key)} と ${shape}）`);
    map.set(key, shape);
  });
  return map;
}
const FLOOR_LOOKUP = buildLookup(FLOOR_TABLE, floorPiece);
const WALL_LOOKUP = buildLookup(WALL_TABLE, wallPiece);
const WATERFALL_LOOKUP = buildLookup(WATERFALL_TABLE, waterfallPiece);

/**
 * つながり（周りの 8 マスが同じ種類か）から shape を求める。
 * @param {"floor"|"wall"|"waterfall"} type
 * @param {object} same  { u, d, l, r, ul, ur, dl, dr }：true なら「同じ種類（つながる）」
 */
export function shapeFor(type, same) {
  // 1/4 マスごとに、縦の隣・横の隣・斜めの隣
  const quarters = [
    { v: same.u, h: same.l, diag: same.ul },
    { v: same.u, h: same.r, diag: same.ur },
    { v: same.d, h: same.l, diag: same.dl },
    { v: same.d, h: same.r, diag: same.dr },
  ];
  let lookup;
  let pieces;
  if (type === "floor") {
    lookup = FLOOR_LOOKUP;
    pieces = quarters.map(q => ({ h: !q.h, v: !q.v, inner: q.h && q.v && !q.diag }));
  } else if (type === "wall") {
    lookup = WALL_LOOKUP;
    pieces = quarters.map(q => ({ h: !q.h, v: !q.v, inner: false }));
  } else if (type === "waterfall") {
    lookup = WATERFALL_LOOKUP;
    pieces = quarters.map(q => ({ h: !q.h, v: false, inner: false }));
  } else {
    throw new Error("知らない型 " + type);
  }
  const key = pieces.map(pieceKey).join("|");
  const shape = lookup.get(key);
  if (shape === undefined) throw new Error(`オートタイルの形が表にない（${type} ${key}）`);
  return shape;
}

/** shape から、開いている（隣が別の種類の）辺を返す（テストと検算用）。 */
export function openEdges(type, shape) {
  const table = { floor: FLOOR_TABLE, wall: WALL_TABLE, waterfall: WATERFALL_TABLE }[type];
  const piece = { floor: floorPiece, wall: wallPiece, waterfall: waterfallPiece }[type];
  const p = table[shape].map(piece);
  return {
    l: !!(p[0].h && p[2].h),
    r: !!(p[1].h && p[3].h),
    u: !!(p[0].v && p[1].v),
    d: !!(p[2].v && p[3].v),
  };
}

const DIRS = {
  u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0],
  ul: [-1, -1], ur: [1, -1], dl: [-1, 1], dr: [1, 1],
};

/**
 * 1 枚の層（kinds[y][x] に kind か -1）の shape をすべて計算し、タイル ID の 2 次元配列を返す。
 * マップの外は「同じ種類」と見る（エディタと同じ。端に縁を描かない）。
 * @param {number[][]} kinds
 * @param {(x:number, y:number, kind:number, nx:number, ny:number, nkind:number) => boolean} [isSame]
 *   隣を同じ種類と見るかを変えたいとき（既定は kind が同じなら同じ）
 */
export function resolveLayer(kinds, isSame) {
  const h = kinds.length;
  const w = h ? kinds[0].length : 0;
  const same = isSame || ((x, y, k, nx, ny, nk) => nk === k);
  const out = kinds.map(row => row.map(() => 0));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const kind = kinds[y][x];
      if (kind < 0) continue;
      const nb = {};
      for (const [name, [dx, dy]] of Object.entries(DIRS)) {
        const nx = x + dx;
        const ny = y + dy;
        nb[name] = nx < 0 || ny < 0 || nx >= w || ny >= h ? true : same(x, y, kind, nx, ny, kinds[ny][nx]);
      }
      out[y][x] = makeAutotileId(kind, shapeFor(autotileType(kind), nb));
    }
  }
  return out;
}
