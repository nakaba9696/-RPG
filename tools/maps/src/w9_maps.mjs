// W9（#157）地域三（霧の湖・地下水道と地下都市）の文字マップ（.txt と .deco.txt）を描く。何度走らせても同じ結果になる。
//   node tools/maps/src/w9_maps.mjs           書く（このあと node tools/maps/src/w9_data.mjs → node tools/maps/build.mjs w9_…）
//   node tools/maps/src/w9_maps.mjs --check   書かずに、今のファイルと同じかだけ見る（違えば終了コード 1）
//   node tools/maps/src/w9_maps.mjs --print   地図を画面に出すだけ
// 地図は四角・楕円・道の線を重ねて描き、岸と葦の縁だけ種付きの乱数で崩す。
// イベントの置き場所は POINTS（名前 → [x, y]）に書き、tools/maps/src/w9_data.mjs が読む（座標を二か所に書かない）。
// 持ち主がエディタで仕上げたら（docs/maps.md に「仕上げ済み」）、このファイルは走らせない（JSON が正本）。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// 道具
// ---------------------------------------------------------------------------
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

class Grid {
  constructor(w, h, fill = ".") {
    this.w = w;
    this.h = h;
    this.a = Array.from({ length: h }, () => Array(w).fill(fill));
  }
  in(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  get(x, y) { return this.in(x, y) ? this.a[y][x] : null; }
  set(x, y, c) { if (this.in(x, y)) this.a[y][x] = c; return this; }
  rect(x0, y0, x1, y1, c, only = null) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (!only || only.includes(this.get(x, y))) this.set(x, y, c);
    return this;
  }
  frame(x0, y0, x1, y1, c) {
    for (let x = x0; x <= x1; x++) { this.set(x, y0, c); this.set(x, y1, c); }
    for (let y = y0; y <= y1; y++) { this.set(x0, y, c); this.set(x1, y, c); }
    return this;
  }
  /** 楕円。jitter で縁を崩す（0 で崩さない）。 */
  oval(cx, cy, rx, ry, c, { jitter = 0, seed = 1, only = null } = {}) {
    const r = rng(seed);
    for (let y = Math.floor(cy - ry - 2); y <= Math.ceil(cy + ry + 2); y++) {
      for (let x = Math.floor(cx - rx - 2); x <= Math.ceil(cx + rx + 2); x++) {
        const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
        const lim = 1 + (jitter ? (r() - 0.5) * jitter : 0);
        if (d <= lim && (!only || only.includes(this.get(x, y)))) this.set(x, y, c);
      }
    }
    return this;
  }
  /** 折れ線の道。幅 width（1 なら点の上だけ）。 */
  path(points, c, width = 2, only = null) {
    for (let i = 0; i + 1 < points.length; i++) {
      let [x, y] = points[i];
      const [tx, ty] = points[i + 1];
      for (;;) {
        for (let dy = 0; dy < width; dy++) for (let dx = 0; dx < width; dx++) {
          if (!only || only.includes(this.get(x + dx, y + dy))) this.set(x + dx, y + dy, c);
        }
        if (x === tx && y === ty) break;
        if (x !== tx) x += Math.sign(tx - x);
        else y += Math.sign(ty - y);
      }
    }
    return this;
  }
  /** 縁を崩す：from の文字のうち、to の文字と隣り合うマスを rate の割合で to にする。 */
  erode(from, to, rate, seed, area = null) {
    const r = rng(seed);
    const hits = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (area && !(x >= area[0] && y >= area[1] && x <= area[2] && y <= area[3])) continue;
      if (this.get(x, y) !== from) continue;
      const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => this.get(x + dx, y + dy) === to);
      if (n && r() < rate) hits.push([x, y]);
    }
    for (const [x, y] of hits) this.set(x, y, to);
    return this;
  }
  /** 散らす：on の文字のマスに rate の割合で c を置く（area があればその中だけ）。 */
  sprinkle(on, c, rate, seed, area = null) {
    const r = rng(seed);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (area && !(x >= area[0] && y >= area[1] && x <= area[2] && y <= area[3])) { r(); continue; }
      const hit = r() < rate;
      if (hit && on.includes(this.get(x, y))) this.set(x, y, c);
    }
    return this;
  }
  text(x, y, rows) {
    rows.forEach((row, dy) => [...row].forEach((c, dx) => { if (c !== " ") this.set(x + dx, y + dy, c); }));
    return this;
  }
  toString() { return this.a.map(r => r.join("")).join("\n") + "\n"; }
}

/** 重ね書き（.deco.txt）：地図と同じ大きさ。"." は何も置かない。 */
const deco = (w, h) => new Grid(w, h, ".");

/** 歩けるマスか（文字だけで見る。build の通行とは別の、描くときの目安）。 */
function reach(grid, starts, walk, decoGrid = null, block = "") {
  const seen = new Set();
  const q = [...starts];
  for (const [x, y] of q) seen.add(x + "," + y);
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = nx + "," + ny;
      if (seen.has(k) || !grid.in(nx, ny)) continue;
      if (!walk.includes(grid.get(nx, ny))) continue;
      if (decoGrid && block.includes(decoGrid.get(nx, ny))) continue;
      seen.add(k);
      q.push([nx, ny]);
    }
  }
  return seen;
}


/** 地下の床を飾る：床（floor の文字）で、重ね書きが空のマスに、通れる小物を rate、壁ぎわに通れない瓦礫を wallRate で置く。
 *  points（イベントの置き場所）とその隣には、通れない物を置かない。 */
function dress(g, d, { floor = ".,", walls = "=#", soft = ["k", "K", "s"], softRate = 0.12, hard = ["r", "x"], wallRate = 0.06, seed = 1, points = {}, keep = [] }) {
  const r = rng(seed);
  const near = new Set();
  const addPt = ([x, y]) => { for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) near.add(`${x + dx},${y + dy}`); };
  for (const v of Object.values(points)) {
    if (Array.isArray(v) && typeof v[0] === "number") addPt(v);
    else if (Array.isArray(v)) v.forEach(addPt);
  }
  for (const [x0, y0, x1, y1] of keep) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) near.add(`${x},${y}`);
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    const a = r(), b = r(), c = r();
    if (!floor.includes(g.get(x, y)) || d.get(x, y) !== "." || "柱灯".includes(d.get(x, y - 1))) continue;
    const byWall = [[1, 0], [-1, 0], [0, -1]].some(([dx, dy]) => walls.includes(g.get(x + dx, y + dy)));
    const corridor = [[1, 0], [-1, 0]].every(([dx, dy]) => walls.includes(g.get(x + dx * 2, y)) || walls.includes(g.get(x + dx, y)))
      || [[0, 1], [0, -1]].every(([dx, dy]) => walls.includes(g.get(x, y + dy * 2)) || walls.includes(g.get(x, y + dy)));
    if (byWall && !corridor && !near.has(`${x},${y}`) && a < wallRate) d.set(x, y, hard[Math.floor(b * hard.length)]);
    else if (a >= wallRate && c < softRate) d.set(x, y, soft[Math.floor(b * soft.length)]);
  }
}

export const POINTS = {};
export const MAPS = {}; // 名前 → { txt, deco }

// ---------------------------------------------------------------------------
// 霧の湖（凡例 marsh。. 草地 , 土の道 # 葦の壁 ~ 湖 = | 板の道 ; 家の床 W 家の壁 t 枯れ木 r 岩 b 樽 i 杭 % 折れた葦 H 見えない通路）
// ---------------------------------------------------------------------------
const MARSH_WALK = ".,=|;:s%Hn" + "舟灯";
const MARSH_DECO_BLOCK = "toOprRbvzgGxXqcCaWhNnu4";

function drawLakeReeds() {
  // 070 霧の湖・葦原（80 × 60）。北の入口（061 から）→ 西の岸の道 → 南西の板の道（071 へ）。北東は霧の道（小鐘）の先の舟小屋と舟着き。
  // 湖の真ん中に小島（074 への岸）、南東は向こう岸（舟でだけ行ける）。
  const W = 80, H = 60;
  const g = new Grid(W, H, ".");
  const d = deco(W, H);
  // 湖（舟だけが通れる水）
  g.oval(50, 36, 26, 19, "~", { jitter: 0.25, seed: 701 });
  g.oval(66, 22, 13, 9, "~", { jitter: 0.25, seed: 702 });
  g.rect(60, 16, 77, 47, "~");
  g.oval(40, 50, 14, 7, "~", { jitter: 0.3, seed: 703 });
  // 南西の入り江（071 へ渡る板の道の下）
  g.oval(14, 56, 9, 5, "~", { jitter: 0.3, seed: 704 });
  // 外の縁（葦と枯れ木）
  g.frame(0, 0, W - 1, H - 1, "#").frame(1, 1, W - 2, H - 2, "#");
  g.erode(".", "#", 0.5, 705, [2, 2, W - 3, H - 3]);
  g.erode(".", "#", 0.3, 706, [2, 2, W - 3, H - 3]);
  // 向こう岸（南東。舟でだけ）
  g.oval(70, 53, 9, 6, ".", { jitter: 0.2, seed: 707 });
  g.rect(62, 57, 77, 57, "#").rect(78, 40, 79, 59, "#").rect(60, 58, 79, 59, "#");
  // 小島（074 への岸）
  g.oval(47, 38, 4, 3, ".", { jitter: 0.2, seed: 708 });
  // 北東の舟小屋の岸（霧の道の先）
  g.rect(52, 3, 77, 12, ".");
  g.rect(52, 2, 77, 2, "#").rect(78, 2, 79, 15, "#");
  g.oval(64, 13, 9, 2, ".", { only: "~" });
  // 北の岸の帯と西の岸
  g.rect(2, 3, 47, 13, ".");
  g.rect(2, 14, 20, 54, ".");
  g.oval(22, 20, 8, 6, ".");
  g.erode(".", "#", 0.35, 709, [2, 3, 22, 54]);
  g.erode(".", "~", 0.25, 710, [20, 14, 78, 57]);
  // 葦の仕切り（北の帯と北東の岸の間。霧の道だけが通る）と、その下の水
  g.rect(40, 15, 62, 18, "~", ".");
  g.rect(48, 2, 51, 18, "#");
  // 南の岸は水にして、西の岸と向こう岸をつながない
  g.rect(16, 52, 61, 57, "~", ".");
  // 葦の茂み（歩けない所を散らす）
  g.sprinkle(".", "#", 0.03, 714, [3, 3, 46, 50]);
  // 道
  const main = [[22, 0], [22, 5], [17, 9], [12, 14], [9, 22], [8, 30], [10, 38], [11, 46], [13, 50]];
  g.path(main, ",", 2);
  g.path([[22, 5], [30, 7], [40, 7], [47, 7], [55, 7], [63, 7]], ",", 2);
  g.path([[63, 7], [63, 11]], ",", 2);
  g.path([[12, 14], [24, 17], [27, 21]], ",", 1); // 網干し場への脇道
  g.path([[8, 30], [3, 33]], ",", 1); // 西の祠への脇道
  // 南西：板の道（071 へ。地図の下の端へ抜ける）
  g.rect(12, 51, 15, 52, ",");
  g.path([[13, 52], [13, 59]], "|", 2);
  // 入口の切れ目
  g.rect(21, 0, 24, 3, ",").set(21, 0, "#").set(24, 0, "#");
  // 霧の道（葦の仕切りの切れ目。霧の壁のイベントが立つ）
  g.rect(48, 7, 51, 8, ",");
  // 舟着き（北東の岸から湖へ）
  g.path([[66, 14], [66, 18]], "|", 1);
  // 小島の岸の桟橋（舟を着ける）と、向こう岸の桟橋
  g.path([[47, 41], [47, 43]], "|", 1);
  g.path([[66, 49], [66, 46]], "|", 1);
  // 北の帯の小屋（網小屋）：W は壁、; は床、戸口
  g.text(28, 3, [
    "WWWWWWW",
    "W;;;;;W",
    "W;;;;;W",
    "WWW;WWW",
  ]);
  // 舟小屋（北東）
  g.text(67, 3, [
    "WWWWWWWWW",
    "W;;;;;;;W",
    "W;;;;;;;W",
    "W;;;;;;;W",
    "WWWW;WWWW",
  ]);
  // 西の祠（灯の祠）
  g.text(2, 31, [
    "WWWW",
    ":::W",
    ":::W",
    "WWWW",
  ]);
  g.set(5, 32, ":").set(5, 33, ":");
  // 見えない通路（折れた葦の先の入り江の隠し場）：(16,40)〜(19,40) の葦が通れる
  g.rect(15, 37, 25, 43, "#");
  g.rect(16, 40, 19, 40, "H");
  g.set(15, 40, "%").set(14, 40, ",").set(13, 40, ",");
  g.rect(20, 39, 23, 41, ".");
  g.rect(24, 38, 25, 42, "#");
  // 置き物（重ね書き）
  d.sprinkle(".", "k", 0.09, 711).sprinkle(".", "K", 0.06, 712).sprinkle(".", "l", 0.07, 713);
  // 網干し場（杭と網）
  d.text(24, 18, ["i.i.i", ".....", "i.i.i"]);
  // 倒れた舟
  d.text(34, 10, ["舟"]);
  // 灯の柱（北の岸の道ぞい）
  d.set(26, 9, "灯").set(42, 9, "灯").set(14, 26, "灯").set(12, 44, "灯");
  // 墓（舟に乗れなかった者）
  d.text(4, 18, ["g.G", "...", "G.g"]);
  // 向こう岸の刻みの柱・焚き火の跡
  d.set(72, 52, "i").set(69, 54, "O");
  // 小島の石
  d.set(45, 37, "p");
  // 舟小屋の中の置き物
  d.text(68, 4, [".b.v..c"]);
  d.text(29, 4, ["v...z"]);
  // 道の上・家の床・板の道・入口の置き物を消す
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (",|=;:%H~#".includes(g.get(x, y)) && !"舟灯i".includes(d.get(x, y))) d.set(x, y, ".");
  }
  const P = {
    entry: [22, 1], entry2: [23, 1], exitN: [22, 0], exitN2: [23, 0],
    exitS: [13, 59], exitS2: [14, 59], arriveS: [13, 58],
    fogWall: [[49, 7], [49, 8], [50, 7], [50, 8]],
    sign: [24, 4], netHut: [31, 5], netChest: [33, 4], notice: [19, 10],
    boatHouseDoor: [71, 7], zelina2: [69, 5], zelina3: [65, 13], dockBoat: [66, 19], boatHouseChest: [74, 4], ledgerArk: [73, 5],
    r301: [30, 8], r302: [63, 14], r303: [10, 26], r304: [72, 51],
    shrine: [3, 32], shrineChest: [3, 33], graves: [5, 19],
    hiddenChest: [22, 40], hiddenHint: [15, 40],
    isleDock: [47, 43], isleBoat: [47, 44], isleGate: [47, 37],
    farDock: [66, 46], farBoat: [66, 45], farPost: [72, 52], farChest: [74, 54], farFire: [69, 54],
    pickup1: [21, 22], pickup2: [6, 47], pickup3: [57, 10],
    redJaw: [27, 21], chestByJaw: [28, 20],
  };
  POINTS.lake = P;
  MAPS.w9_070_mist_lake = { g, d };
}

function drawLakeHouse() {
  // 071 湖の家（48 × 36）。水の上の杭の家の跡と板の道。真ん中がミルレーネの家（湖の灯）。
  // 北の板の道→070、南西の岸の道→073（淵）、南東の板の道→072（沈んだ桟橋）。
  const W = 48, H = 36;
  const g = new Grid(W, H, "~");
  const d = deco(W, H);
  g.sprinkle("~", "w", 0.05, 7101);
  // 北の板の道（070 から）
  g.rect(23, 0, 24, 6, "|");
  // ミルレーネの家の床（桟敷）と家
  g.rect(16, 7, 31, 19, ";");
  g.text(18, 8, [
    "WWWWWWWWWWWW",
    "W;;;;;;;;;;W",
    "W;;;;;;;;;;W",
    "W;;;;;;;;;;W",
    "W;;;;;;;;;;W",
    "WWWWW;;WWWWW",
  ]);
  // 西の家の跡（帳場の跡。壁は崩れている）
  g.rect(2, 4, 12, 13, ";");
  g.text(3, 5, [
    "WWWW.WWWW",
    "W;;;;;;;W",
    "W;;;;;;;;",
    "W;;;;;;;W",
    "WWW;WW.WW",
  ]);
  g.set(7, 5, "~").set(9, 9, "~");
  g.rect(13, 10, 15, 10, "=");
  // 東の家の跡（網元の家）
  g.rect(35, 3, 45, 12, ";");
  g.text(36, 4, [
    "WWWWWWWWW",
    "W;;;;;;;W",
    "W;;;;;;;W",
    "W;;;;;;;W",
    "WWWW;WWWW",
  ]);
  g.rect(32, 9, 34, 9, "=");
  // 南へ：渡り場
  g.rect(23, 20, 24, 24, "|");
  g.rect(19, 25, 28, 28, ";");
  // 南西の家の跡と岸
  g.rect(8, 26, 18, 26, "=");
  g.rect(2, 22, 8, 29, ";");
  g.text(2, 22, [
    "WWWWWWW",
    "W;;;;;W",
    "W;;;;;W",
    ";;;;;;W",
    "W;;;;;W",
    "WWW;WWW",
  ]);
  g.set(8, 26, ";");
  g.rect(0, 30, 14, 35, ".");
  g.frame(0, 30, 14, 35, "#").set(5, 35, ",").set(6, 35, ",");
  g.rect(1, 31, 13, 31, "#", ".");
  g.rect(5, 28, 5, 34, ",").rect(6, 31, 6, 35, ",");
  g.set(5, 30, ",").set(5, 31, ",");
  g.sprinkle(".", "#", 0.18, 7102, [1, 32, 13, 34]);
  g.rect(5, 32, 6, 35, ",");
  // 南東の家の跡（隠し扉の奥の部屋）
  g.rect(29, 26, 33, 26, "=");
  g.rect(34, 21, 43, 30, ";");
  g.text(35, 22, [
    "WWWWWWW",
    "W;;;;;W",
    "W;;;;;W",
    "W;;;;;W",
    "WWWDWWW",
  ]);
  // 南東の板の道（072 へ）
  g.rect(40, 31, 41, 35, "|");
  // 折れた板の道（渡れない。景色）
  g.rect(26, 31, 26, 33, "|");
  // 置き物
  d.set(24, 16, "灯"); // 湖の灯（イベントが上に立つ）
  d.text(19, 9, ["v.z.....c."]);
  d.text(4, 6, ["..t...."]);
  d.text(37, 5, ["b.....v"]);
  d.text(3, 23, ["v...b"]);
  d.set(20, 26, "i").set(27, 27, "i").set(17, 18, "i").set(30, 8, "i");
  const P = {
    arriveN: [23, 1], arriveN2: [24, 1], exitN: [23, 0], exitN2: [24, 0],
    exitSW: [5, 35], exitSW2: [6, 35], arriveSW: [5, 34], arriveSW2: [6, 34],
    exitSE: [40, 35], exitSE2: [41, 35], arriveSE: [40, 34], arriveSE2: [41, 34],
    mirlene: [26, 16], lamp: [24, 16], house: [22, 10], ledger: [27, 10], bed: [20, 10],
    counter: [7, 7], zelina1: [6, 8], westChest: [10, 8],
    eastChest: [41, 6], r305: [38, 7],
    swHut: [4, 24], r306: [6, 25], reedCut: [9, 33],
    hidden: [38, 26], hiddenChest: [38, 24], seCrate: [36, 24],
    brokenPlank: [26, 30], pickup: [42, 10], crossing: [21, 27],
  };
  POINTS.house = P;
  MAPS.w9_071_lake_house = { g, d };
}

function drawSunkenPier() {
  // 072 沈んだ桟橋（27 × 20。前の世界の沈んだ舞台の形を使う）。北の板の道→071。桟橋の端にゼリナの遺骸、脇に櫂。東の舟小屋の隠し扉。
  const g = new Grid(27, 20, "~");
  const d = deco(27, 20);
  g.text(0, 0, [
    "~~~~~~~~~~~~~|~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~|~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~|~~~~~~~~~~~~~",
    "~~~~~~~;;;;;;;;;;;;;~~~~~~~",
    "~~~~~~~~;;;;;;;;;;;~WWWWW~~",
    "~~~~~~~~;;;;;;;;;;;~W;;;W~~",
    "~~~~~~~~~;;;;;;;;;~~W;;;W~~",
    "~~~~~~~~~~;;;;;;;~~~W;;;W~~",
    "~~~~~~~~~I;;;;;;;IWWWDWWW~~",
    "~~~~~~~~~;;;;;;;;;W;;;W~~~~",
    "~~~~~~~~~;;;;;;;;;;;;;W~~~~",
    "~~~~~~~~~;;;;;;;;;W;;;W~~~~",
    "~~~~~~~~~;;;;;;;;~WWWWW~~~~",
    "~~~~~~~~~I;;;;;~~~~~~~~~~~~",
    "~~~~~~~~~~;;;;;~~~~~~~~~~~~",
    "~~~~~~~~~~~~~I~~~~~~~~~~~~~",
    "~~~~~~~~~~~w~~~~w~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~~~~",
  ]);
  d.text(10, 4, ["b.......c"]);
  d.set(16, 12, "i").set(21, 5, "v").set(23, 7, "z");
  const P = {
    exitN: [13, 0], arrive: [13, 1],
    remains: [12, 14], oar: [13, 13], rope: [11, 13], r307: [16, 7], crate: [11, 5],
    hidden: [21, 8], hiddenChest: [22, 5], ledgerTab: [22, 6], booth: [20, 10],
  };
  POINTS.pier = P;
  MAPS.w9_072_sunken_pier = { g, d };
}

function drawLakePool() {
  // 073 湖の淵（27 × 17。前の世界の沼主の淵の形）。北の道→071。淵の主（ボス）。倒すと水が引き、底の排水口→100。
  const g = new Grid(27, 17, "#");
  const d = deco(27, 17);
  g.text(0, 0, [
    "############,,#############",
    "############,,#############",
    "############,,#############",
    "######...............######",
    "######.r...........t.######",
    "######...............######",
    "######..w~~~~~~~~~w..######",
    "######..~~~~~~~~~~~..######",
    "######..~~~~~~~~~~~..######",
    "######..~~~~~~~~~~~..######",
    "######..~~~~~~~~~~~..######",
    "######t.~~~~~~~~~~~..######",
    "######..w~~~~~~~~~w..######",
    "#########~~~~~~~~~#########",
    "###########################",
    "###########################",
    "###########################",
  ]);
  d.text(7, 7, ["k", "K", ".", "l"]);
  d.text(19, 8, ["k", ".", "l"]);
  const P = {
    exitN: [12, 0], exitN2: [13, 0], arrive: [12, 1], arrive2: [13, 1],
    shore: [13, 5], boss: [13, 6], bed: [[13, 6], [13, 7], [13, 8]], drain: [13, 9], landing: [13, 5],
    reedCut: [19, 4], r308: [7, 5], warp: [16, 3],
  };
  POINTS.pool = P;
  MAPS.w9_073_lake_pool = { g, d };
}

function drawIsle() {
  // 074 小島（30 × 22）。070 の小島の岸の石段から上がる。閉じた森の水門（エルフ）・外に残された者の思念・赤い宝箱。
  const W = 30, H = 22;
  const g = new Grid(W, H, "~");
  const d = deco(W, H);
  g.oval(15, 11, 12, 8, ".", { jitter: 0.25, seed: 7401 });
  g.erode(".", "#", 0.35, 7402);
  g.sprinkle(".", "#", 0.06, 7403, [4, 5, 26, 17]);
  // 南の岸の石段（070 から）と北の門への石畳
  g.rect(14, 15, 15, 21, ":");
  g.rect(14, 4, 15, 15, ":");
  g.rect(9, 9, 20, 10, ":");
  // 閉じた水門：北の石の壁（森の縁）。真ん中に門
  g.rect(3, 0, 26, 3, "W");
  g.rect(13, 3, 16, 3, ":");
  // 東の茂みの中の見えない通路（赤い宝箱の隠し場）
  g.rect(21, 6, 27, 12, "#");
  g.rect(21, 9, 23, 9, "H");
  g.set(20, 9, "%");
  g.rect(24, 8, 26, 10, ".");
  d.sprinkle(".", "k", 0.1, 7404).sprinkle(".", "l", 0.08, 7405);
  d.set(10, 6, "g").set(19, 6, "G").set(8, 12, "x");
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (":%H#W~".includes(g.get(x, y))) d.set(x, y, ".");
  const P = {
    arrive: [14, 20], exitS: [14, 21], exitS2: [15, 21],
    gate: [14, 3], gate2: [15, 3], elf1: [10, 7], elf2: [19, 7], elf3: [6, 11],
    redChest: [25, 9], hint: [20, 9], stone: [17, 13], pickup: [22, 15],
  };
  POINTS.isle = P;
  MAPS.w9_074_isle = { g, d };
}

// ---------------------------------------------------------------------------
// 地下水道（凡例 dungeon・タイルセット 18。. 石の床 , 土の床 = 煉瓦の壁 # 岩の壁 ~ 水路 b 石の橋（横）B 石の橋（縦）
//   _ 穴 % 苔の床 H 見えない通路 D 隠し扉）
// 地下都市（凡例 undercity・タイルセット 22。. 石の床 , 土の床 # 岩の壁 = 石の壁 ~ 水路 W 家の壁 R 家の屋根 w 井戸 l 梯子 j/J 鉄格子）
// ---------------------------------------------------------------------------
function room(g, x0, y0, x1, y1, c = ".") { g.rect(x0, y0, x1, y1, c); }

function drawSewerUpper() {
  // 100 地下水道・上流（52 × 38）。西の梯子（073 の淵の排水口から）・北東の石段（035 の西の扉から）・東→101。
  // 真ん中を東西に水路。北に上流の祭壇（アンセルモの記憶 1）、南に舫いの杭（櫂で南の洞へ下る）と、水門で水が引く部屋。
  const W = 52, H = 38;
  const g = new Grid(W, H, "=");
  const d = deco(W, H);
  // 北の部屋
  room(g, 2, 3, 10, 9); // A 排水口の下（梯子）
  room(g, 14, 3, 25, 9); // C 上流の祭壇
  room(g, 39, 3, 49, 8); // B 営倉からの石段
  g.rect(11, 6, 13, 7, "."); // A—C
  g.rect(26, 5, 38, 6, "."); // C—B
  // 水路と両岸の歩き場
  g.rect(2, 15, 51, 16, ".");
  g.rect(2, 17, 49, 18, "~");
  g.rect(2, 19, 51, 20, ".");
  g.rect(50, 17, 51, 18, "="); // 東の端は壁（101 へは歩き場から）
  for (const x of [12, 13, 30, 31, 44, 45]) g.rect(x, 17, x, 18, "b");
  // 北の部屋から水路へ
  g.rect(5, 10, 6, 14, ".");
  g.rect(19, 10, 20, 14, ".");
  g.rect(44, 9, 45, 14, ".");
  // 南の部屋
  room(g, 3, 24, 12, 31); // E 倉
  g.rect(7, 21, 8, 23, ".");
  room(g, 36, 24, 48, 31); // G 水門番の小屋（水が引くまで入口が沈んでいる）
  g.rect(41, 21, 42, 23, ",");
  g.rect(6, 33, 42, 34, "."); // 下の廊下（E—G の輪）
  g.rect(7, 32, 8, 32, ".").rect(41, 32, 42, 32, ".");
  // 舫いの杭の先：南へ下る水路と洞（舟でだけ）
  g.rect(24, 21, 25, 25, "~");
  room(g, 18, 26, 31, 31, ",");
  g.rect(24, 26, 25, 27, "~");
  g.rect(18, 26, 31, 26, "#").rect(18, 31, 31, 31, "#");
  g.rect(19, 27, 30, 30, ",");
  g.rect(24, 26, 25, 28, "~");
  // 東の口（101 へ）
  g.rect(50, 15, 51, 16, ".");
  // 見えない通路：倉の西の壁 → 小さな隠し場
  g.rect(1, 27, 2, 27, "H");
  g.set(3, 27, "%");
  // 隠し場は地図の端（x 0）の 1 マス。上下は壁
  g.set(0, 27, ".");
  // 置き物
  d.text(15, 4, ["....", "1..1"]); // 祭壇の左右の柱（スタンプ）
  d.set(21, 4, "祭");
  d.text(4, 25, ["b.c.C", ".....", "f...."]);
  d.text(37, 25, ["N.n...", "......", "y....."]);
  d.text(40, 7, ["r....q"]);
  d.sprinkle(".", "k", 0.05, 1001).sprinkle(".", "K", 0.03, 1002).sprinkle(",", "k", 0.06, 1003);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ("=~bBH%#".includes(g.get(x, y))) d.set(x, y, ".");
  // 歩き場の上は空ける
  for (let x = 2; x < W; x++) for (const y of [15, 16, 19, 20]) d.set(x, y, ".");
  const P = {
    ladder: [5, 3], arriveLadder: [5, 4], stairs: [45, 3], arriveStairs: [45, 4],
    exitE: [51, 15], exitE2: [51, 16], arriveE: [50, 15], arriveE2: [50, 16],
    altar: [21, 4], anselmo1: [21, 5], decree: [36, 15], gateArch: [36, 14],
    mooring: [24, 20], landing: [24, 29], grottoChest: [28, 28], grottoBack: [25, 29],
    flood: [[41, 21], [42, 21]], keeperChest: [46, 26], r310: [38, 29], r311: [10, 26], r312: [30, 4],
    storeChest: [11, 25], hiddenChest: [0, 27], hint: [3, 27],
    warp: [47, 5], pickup1: [16, 33], pickup2: [33, 20],
  };
  dress(g, d, { seed: 1009, points: P });
  POINTS.sewerUpper = P;
  MAPS.w9_100_sewer_upper = { g, d };
}

function drawSluice() {
  // 101 地下水道・水門（60 × 45）。西→100、南→102（水が引くまで沈んでいる）、北東→105、東の廃水の管の口（091 から。H35）。
  // 真ん中に貯め池と水門の塔。北西の上流の弁と南東の下流の弁を両方回すと水が引く。
  const W = 60, H = 45;
  const g = new Grid(W, H, "=");
  const d = deco(W, H);
  // 西の入口の間
  room(g, 0, 12, 12, 19);
  // 貯め池の輪
  g.rect(18, 11, 41, 32, ".");
  g.rect(20, 13, 39, 30, "~");
  g.rect(27, 19, 32, 24, "="); // 水門の塔
  g.rect(13, 14, 17, 15, "."); // 入口の間 → 輪
  // 北西の弁の部屋
  room(g, 3, 2, 14, 8);
  g.rect(7, 9, 8, 11, ".");
  // 北の札場（アンセルモの記憶 2）
  room(g, 23, 2, 36, 8);
  g.rect(29, 9, 30, 10, ".");
  g.rect(37, 4, 45, 5, ".");
  // 北東の部屋（105 へ）
  room(g, 46, 2, 56, 9);
  g.rect(50, 0, 51, 1, ".");
  // 東の部屋（廃水の管の口）
  g.rect(42, 21, 49, 22, ".");
  room(g, 50, 16, 58, 28);
  // 南東の弁の部屋
  g.rect(53, 29, 54, 33, ".");
  room(g, 45, 34, 57, 41);
  // 南の廊下（102 へ）。y 40–42 は水が引くまで沈む
  g.rect(29, 33, 30, 44, ".");
  // 南西の部屋と、入口の間からの廊下（輪）
  room(g, 3, 30, 14, 40);
  g.rect(6, 20, 7, 29, ".");
  g.rect(15, 38, 28, 39, ".");
  // 見えない通路：南西の部屋の南の壁 → 隠し場
  g.rect(8, 41, 8, 41, "H");
  g.set(8, 40, "%");
  room(g, 6, 42, 10, 43);
  // 北の札場の北の壁の隠し扉（D）→ 小部屋
  g.set(32, 1, "D");
  room(g, 31, 0, 33, 0); // 小部屋は 1 行（地図の上の端）
  g.set(32, 1, "D");
  // 置き物
  d.text(4, 3, ["弁"]);
  d.text(52, 35, ["弁"]);
  d.text(24, 3, ["Z.Z.Z", ".....", "N.N.N"]);
  d.text(47, 3, ["b.c..", "B...."]);
  d.text(4, 31, ["c.C.b", ".....", "y...."]);
  d.sprinkle(".", "k", 0.04, 1011).sprinkle(".", "K", 0.03, 1012);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ("=~bBH%#D".includes(g.get(x, y))) d.set(x, y, ".");
  for (let y = 11; y <= 32; y++) for (let x = 18; x <= 41; x++) if (y < 13 || y > 30 || x < 20 || x > 39) d.set(x, y, ".");
  const P = {
    arriveW: [1, 15], arriveW2: [1, 16], exitW: [0, 15], exitW2: [0, 16],
    exitS: [29, 44], exitS2: [30, 44], arriveS: [29, 43], arriveS2: [30, 43],
    exitN: [50, 0], exitN2: [51, 0], arriveN: [50, 1], arriveN2: [51, 1],
    pipe: [58, 22], arrivePipe: [57, 22],
    valveUp: [4, 3], valveDown: [52, 35], flood: [[29, 40], [30, 40], [29, 41], [30, 41], [29, 42], [30, 42]],
    desk: [26, 5], anselmo2: [29, 5], tower: [29, 25],
    r313: [12, 4], r314: [55, 25], r315: [5, 36], r316: [40, 7],
    swChest: [13, 31], hiddenChest: [8, 43], hint: [8, 40], secretRoom: [32, 0], secretChest: [33, 0],
    neChest: [55, 3], warp: [10, 13], pickup1: [36, 31], pickup2: [48, 17],
  };
  dress(g, d, { seed: 1019, points: P });
  POINTS.sluice = P;
  MAPS.w9_101_sluice = { g, d };
}

function drawGateFront() {
  // 102 地下都市の閉じた扉の前（44 × 32。暗がり 1.5、角灯で 5）。北→101、東→103（扉の番）。
  // 広場に外に残された人の寝床の跡。南の壁の真ん中に閉じた大扉、扉に背を預けてアンセルモの遺骸。
  const W = 44, H = 32;
  const g = new Grid(W, H, "#");
  const d = deco(W, H);
  g.rect(21, 0, 22, 7, ".");
  room(g, 5, 8, 38, 24);
  g.rect(5, 8, 38, 24, ".");
  // 大扉の壁（石の壁）と、扉の前の窪み
  g.rect(14, 25, 29, 28, "=");
  g.rect(18, 25, 25, 26, ".");
  // 西の弔いの場
  room(g, 1, 11, 4, 18, ",");
  // 北東の騎士の詰め所
  room(g, 32, 2, 41, 6);
  g.rect(35, 7, 36, 7, ".");
  // 東の廊下（103 へ）
  g.rect(39, 15, 43, 16, ".");
  // 見えない通路：広場の南西の角 → 隠し場
  g.rect(6, 25, 6, 26, "H");
  g.set(6, 24, "%");
  room(g, 5, 27, 8, 29);
  // 広場の柱
  for (const [x, y] of [[10, 12], [33, 12], [10, 20], [33, 20]]) g.set(x, y, "#");
  // 置き物（寝床の跡・骨・瓦礫）
  d.text(8, 9, ["x..r....y.....r..x....y....r"]);
  d.text(7, 14, ["y", ".", ".", "x"]);
  d.text(14, 15, ["r....y..x...y....r...y"]);
  d.text(8, 22, ["x....r..y....x...r....y...x"]);
  d.text(2, 12, ["g", ".", "G", ".", "g", "."]);
  d.text(33, 3, ["v.N.n.y"]);
  d.sprinkle(".", "k", 0.04, 1021);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ("#=H%".includes(g.get(x, y))) d.set(x, y, ".");
  for (let x = 18; x <= 25; x++) for (let y = 24; y <= 26; y++) d.set(x, y, ".");
  for (let x = 20; x <= 23; x++) for (let y = 7; y <= 24; y++) d.set(x, y, ".");
  for (let x = 30; x <= 39; x++) for (let y = 15; y <= 16; y++) d.set(x, y, ".");
  const P = {
    exitN: [21, 0], exitN2: [22, 0], arriveN: [21, 1], arriveN2: [22, 1],
    exitE: [43, 15], exitE2: [43, 16], arriveE: [42, 15], arriveE2: [42, 16],
    gate: [21, 26], gateBlock: [22, 26], gateFront: [21, 25], anselmo: [19, 25], claw: [24, 26],
    journal: [38, 4], listRoll: [2, 15], graves: [2, 12],
    anselmo3: [38, 14], warp: [36, 17],
    r320: [12, 10], r321: [28, 18], r322: [8, 21], r323: [35, 23], r324: [3, 17],
    hiddenChest: [7, 28], hint: [6, 24], chest: [40, 3], pickup: [16, 12],
  };
  dress(g, d, { seed: 1029, points: P });
  POINTS.gateFront = P;
  MAPS.w9_102_gate_front = { g, d };
}

function drawGateKeeper() {
  // 103 扉の番の間（27 × 17）。西→102、北の扉→104（扉の番を倒すと開く）。
  const g = new Grid(27, 17, "=");
  const d = deco(27, 17);
  room(g, 4, 4, 22, 13);
  g.rect(0, 8, 3, 9, ".");
  g.rect(13, 2, 13, 3, ".");
  d.set(8, 6, "柱").set(18, 6, "柱").set(8, 10, "柱").set(18, 10, "柱");
  d.text(5, 5, ["N.n"]);
  d.text(19, 12, ["b.c"]);
  d.sprinkle(".", "k", 0.06, 1031);
  for (let y = 0; y < 17; y++) for (let x = 0; x < 27; x++) if (g.get(x, y) === "=") d.set(x, y, ".");
  const P = {
    exitW: [0, 8], exitW2: [0, 9], arriveW: [1, 8], arriveW2: [1, 9],
    boss: [13, 7], door: [13, 3], arriveDoor: [13, 4], r325: [5, 12], table: [5, 5],
  };
  dress(g, d, { seed: 1039, points: P });
  POINTS.gateKeeper = P;
  MAPS.w9_103_gate_keeper = { g, d };
}

function drawBellDeep() {
  // 104 水底の鐘の間（27 × 24）。南→103。南の控え（y 13–20。W11 の門叩きの塊を置ける空き）と、北の鐘の間。
  const g = new Grid(27, 24, "=");
  const d = deco(27, 24);
  room(g, 6, 4, 20, 11); // 鐘の間
  g.rect(12, 12, 14, 12, "."); // 鐘の間の口
  room(g, 5, 13, 21, 20); // 控え（空き）
  g.rect(13, 21, 13, 23, ".");
  g.rect(6, 10, 7, 11, "~").rect(19, 10, 20, 11, "~");
  d.text(7, 5, ["柱...........柱"]);
  d.set(13, 6, "鐘");
  d.text(7, 8, ["柱...........柱"]);
  const P = { exitS: [13, 23], arriveS: [13, 22], rope: [13, 7], board: [18, 4], r326: [8, 7], note: [13, 16] };
  dress(g, d, { seed: 1049, points: P, keep: [[5, 13, 21, 20]] });
  POINTS.bellDeep = P;
  MAPS.w9_104_bell_deep = { g, d };
}

function drawWellShaft() {
  // 105 井戸の縦穴（50 × 36。凡例 undercity）。南→101。扉の内側の村（長の家・灯の家並み）、北東の井戸の縦穴（綱→010 の井戸）、
  // 北西の梯子の上の格子（閂→037）、南西の大扉の内側（村の長が閂を外すと 102 とつながる）。
  const W = 50, H = 36;
  const g = new Grid(W, H, "#");
  const d = deco(W, H);
  // 村の広場
  g.rect(3, 9, 34, 30, ".");
  // 家並み（屋根 R と壁 W）
  const house = (x, y, w) => { g.rect(x, y, x + w - 1, y + 1, "R"); g.rect(x, y + 2, x + w - 1, y + 2, "W"); };
  house(5, 10, 5); // 長の家
  house(13, 10, 4);
  house(23, 10, 5);
  house(5, 18, 4);
  house(26, 18, 5);
  // 長の家の中は家の外に出さない（扉の前で話す）
  // 南の口（101 から）
  g.rect(24, 31, 25, 35, ".");
  // 井戸の縦穴（北東）
  room(g, 37, 2, 47, 12);
  g.rect(35, 13, 37, 14, ".");
  g.rect(38, 12, 39, 13, ".");
  // 梯子の上の格子（北西）
  room(g, 4, 2, 10, 7);
  g.rect(7, 8, 8, 8, ".");
  // 大扉の内側（南西）
  g.rect(3, 31, 12, 33, "=");
  g.rect(6, 31, 9, 31, ".");
  // 村の水路
  g.rect(15, 24, 34, 24, "~");
  g.rect(20, 24, 21, 24, ".");
  g.rect(30, 24, 30, 24, ".");
  // 置き物
  d.set(19, 16, "w");
  d.text(11, 14, ["k...c"]);
  d.text(28, 15, ["f..k"]);
  d.text(4, 27, ["c.k"]);
  d.text(40, 3, ["r.....x"]);
  d.set(42, 7, "w"); // 縦穴の底の井戸の水溜め
  d.set(7, 2, "l");
  d.sprinkle(".", "k", 0.05, 1051);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ("#=RW~".includes(g.get(x, y))) d.set(x, y, ".");
  const P = {
    exitS: [24, 35], exitS2: [25, 35], arriveS: [24, 34], arriveS2: [25, 34],
    elder: [7, 13], elderDoor: [7, 12], villager1: [16, 15], villager2: [27, 21], child: [12, 26],
    rope: [42, 4], arriveRope: [42, 5], faint: [44, 8], grate: [7, 2], arriveGrate: [7, 3],
    gateInner: [7, 31], gateInner2: [8, 31], arriveGate: [7, 30], lampPost: [20, 16],
    chest: [46, 11], r330: [31, 28], r331: [9, 5], pickup: [33, 10], warp: [26, 29],
  };
  dress(g, d, { seed: 1059, points: P, walls: "#=RW" });
  POINTS.well = P;
  MAPS.w9_105_well_shaft = { g, d };
}

export function drawAll() {
  drawSewerUpper();
  drawSluice();
  drawGateFront();
  drawGateKeeper();
  drawBellDeep();
  drawWellShaft();
  drawLakeReeds();
  drawLakeHouse();
  drawSunkenPier();
  drawLakePool();
  drawIsle();
  return MAPS;
}

// ---------------------------------------------------------------------------
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  drawAll();
  const mode = process.argv.includes("--check") ? "check" : process.argv.includes("--print") ? "print" : "write";
  let stale = 0;
  for (const [name, { g, d }] of Object.entries(MAPS)) {
    for (const [ext, grid] of [[".txt", g], [".deco.txt", d]]) {
      const file = path.join(HERE, name + ext);
      const text = grid.toString();
      if (mode === "print") { console.log(`== ${name}${ext}`); console.log(text); continue; }
      const cur = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
      if (mode === "check") {
        if (cur !== text) { console.error(`古い: ${name}${ext}`); stale++; }
      } else if (cur !== text) { fs.writeFileSync(file, text); console.log(`書き出し: ${name}${ext}`); }
    }
  }
  if (stale) process.exit(1);
}
