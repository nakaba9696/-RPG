// 置き物の密度の報告（docs/mapdesign.md 6.1 の目安を数で見る）。落とさない。報告だけ。
//   node tools/maps/density.mjs            文字マップから作ったマップをすべて
//   node tools/maps/density.mjs 915 20     マップ ID で選ぶ（エディタで描いたマップも可）
// 1 画面（27 × 15。左上から区切り、端は欠けた画面）ごとに：
//   床      ：z=0 が A3・A4 でなく（壁・屋根・段差は数えない）、z=0・z=1 がタイルセットの通行で通れるマス。
//             段差の上面（文字マップの ledge。A4 だが歩ける）は床に数える（文字マップから作ったマップだけ分かる）。
//             ただし、置き物で通れず上下左右もすべて通れないマス（森の木の列のような「置き物の壁」の中）は除く
//   z2・z3  ：z=2・z=3 にタイルがあるマスの数（床でないマスも数える）
//   置き物  ：床のうち z=2 か z=3 に何かあるマスの割合（目安 15〜25%）
//   空の3×3 ：3 × 3 がすべて「置き物もイベントもない床」の窓の数（重なりを数える。窓の真ん中のマスの画面に入れる）
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isTileA3, isTileA4 } from "./autotile.mjs";
import { listSources, readSource, readLegend, buildMapWithInfo } from "./build.mjs";
import { readData, mapFileName } from "../data/io.mjs";

export const SCREEN_W = 27;
export const SCREEN_H = 15;

/** 通れるか（MZ と同じく、上の層から ☆ を飛ばして最初のタイルの 4 方向のどれかが開いているか）。z=0・z=1 だけを見る。 */
function isFloorPassable(flags, ids) {
  for (const id of ids) {
    const f = flags[id] ?? 0;
    if (f & 0x10) continue;
    return (f & 0x0f) !== 0x0f;
  }
  return false;
}

/**
 * マップ（MapNNN.json の中身）の密度。
 * @returns {{ screens: {sx, sy, floor, z2, z3, filled, empty3}[], total: {floor, z2, z3, filled, empty3} }}
 */
export function densityOf(map, tileset = readData("Tilesets.json")[map.tilesetId], ledgeTops = new Set()) {
  const { width: w, height: h, data } = map;
  const at = (x, y, z) => data[(z * h + y) * w + x];
  const flags = tileset?.flags || [];
  const eventAt = new Set((map.events || []).filter(Boolean).map(e => `${e.x},${e.y}`));
  const ids = (x, y, top) => [3, 2, 1, 0].filter(z => z <= top).map(z => at(x, y, z)).filter(id => id !== 0);
  const solid = (x, y) => x < 0 || y < 0 || x >= w || y >= h || !isFloorPassable(flags, ids(x, y, 3));
  const floor = [];
  const bare = []; // 置き物もイベントもない床
  for (let y = 0; y < h; y++) {
    floor.push([]);
    bare.push([]);
    for (let x = 0; x < w; x++) {
      const z0 = at(x, y, 0);
      const inWall = solid(x, y) && solid(x - 1, y) && solid(x + 1, y) && solid(x, y - 1) && solid(x, y + 1);
      const ground = ledgeTops.has(`${x},${y}`) || (z0 !== 0 && !isTileA3(z0) && !isTileA4(z0));
      const isFloor = ground && isFloorPassable(flags, ids(x, y, 1)) && !inWall;
      floor[y].push(isFloor);
      bare[y].push(isFloor && at(x, y, 2) === 0 && at(x, y, 3) === 0 && !eventAt.has(`${x},${y}`));
    }
  }
  const cols = Math.ceil(w / SCREEN_W);
  const rows = Math.ceil(h / SCREEN_H);
  const screens = [];
  for (let sy = 0; sy < rows; sy++) for (let sx = 0; sx < cols; sx++) screens.push({ sx, sy, floor: 0, z2: 0, z3: 0, filled: 0, empty3: 0 });
  const screenOf = (x, y) => screens[Math.floor(y / SCREEN_H) * cols + Math.floor(x / SCREEN_W)];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const s = screenOf(x, y);
      if (at(x, y, 2)) s.z2++;
      if (at(x, y, 3)) s.z3++;
      if (floor[y][x]) {
        s.floor++;
        if (!bare[y][x]) s.filled++;
      }
      if (x >= 1 && y >= 1 && x < w - 1 && y < h - 1) {
        let empty = true;
        for (let dy = -1; dy <= 1 && empty; dy++) for (let dx = -1; dx <= 1; dx++) if (!bare[y + dy][x + dx]) { empty = false; break; }
        if (empty) s.empty3++;
      }
    }
  }
  const total = { floor: 0, z2: 0, z3: 0, filled: 0, empty3: 0 };
  for (const s of screens) for (const k of Object.keys(total)) total[k] += s[k];
  return { width: w, height: h, cols, rows, screens, total };
}

const pct = (a, b) => (b ? Math.round((a * 100) / b) : 0);

/** 1 枚ぶんの報告の行（1 行目が合計、続く行が画面ごと）。 */
export function formatDensity(label, d) {
  const t = d.total;
  const out = [
    `${label} ${d.width}×${d.height}（${d.cols * d.rows} 画面）: 置き物 z2 ${t.z2}・z3 ${t.z3}、床 ${t.floor} の ${pct(t.filled, t.floor)}%、空の3×3 ${t.empty3}`,
  ];
  for (let sy = 0; sy < d.rows; sy++) {
    const cells = d.screens.filter(s => s.sy === sy).map(s => `${String(pct(s.filled, s.floor)).padStart(3)}%/${String(s.empty3).padStart(3)}`);
    out.push(`    行 ${sy}: ${cells.join("  ")}`);
  }
  return out;
}

/** 文字マップから作ったマップの、段差の上面のマス（mapId → Set）。 */
export function ledgeTopsOfSources(legend = readLegend()) {
  const out = new Map();
  for (const name of listSources()) {
    const source = readSource(name);
    out.set(source.config.mapId, buildMapWithInfo(source, legend).info.ledgeTops);
  }
  return out;
}

function main(argv) {
  const tops = ledgeTopsOfSources();
  const ids = argv.length ? argv.map(Number) : [...tops.keys()].sort((a, b) => a - b);
  const tilesets = readData("Tilesets.json");
  console.log("画面ごと：置き物のある床の割合 / 空の 3×3 の数（目安：置き物 15〜25%、空の 3×3 は 0 に近く）");
  for (const id of ids) {
    const map = readData(mapFileName(id));
    const d = densityOf(map, tilesets[map.tilesetId], tops.get(id));
    for (const line of formatDensity(`Map${String(id).padStart(3, "0")}`, d)) console.log(line);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
