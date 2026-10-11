// W5 の下書きを作る道具（scratchpad。生成物だけをコミットする）
import fs from "node:fs";
import path from "node:path";

export const ROOT = "/home/user/-RPG";
export const SRC = path.join(ROOT, "tools/maps/src");

// ---- 地図 ----
export class Grid {
  constructor(w, h, fill = "#") {
    this.w = w; this.h = h;
    this.g = Array.from({ length: h }, () => Array(w).fill(fill));
  }
  set(x, y, ch) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) throw new Error(`外 (${x},${y})`);
    this.g[y][x] = ch;
    return this;
  }
  rect(x1, y1, x2, y2, ch) {
    for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) this.set(x, y, ch);
    return this;
  }
  get(x, y) { return this.g[y][x]; }
  text() { return this.g.map(r => r.join("")).join("\n") + "\n"; }
  show() { return this.g.map((r, y) => String(y).padStart(2) + " " + r.join("")).join("\n"); }
}

// ---- イベントの命令 ----
// 木の形で書いて compile で list にする。
//   ["msg", lines, { name, bg, pos }]   文章（4 行ずつ 101 を分ける）
//   ["if", params, then[], else[]?]     条件分岐
//   ["choice", [labels], cancel, [branch...]]
//   [code, params]                      そのまま
export const SE = (name, volume = 90, pitch = 100) => [250, [{ name, volume, pitch, pan: 0 }]];
export const SW = (id, on = true, to = id) => [121, [id, to, on ? 0 : 1]];
export const SELF = (ch = "A", on = true) => [123, [ch, on ? 0 : 1]];
export const VAR_ADD = (id, n) => [122, [id, id, 1, 0, n]];
export const VAR_SET = (id, n) => [122, [id, id, 0, 0, n]];
export const MOVE = (map, x, y, d = 0, fade = 0) => [201, [0, map, x, y, d, fade]];
export const SCRIPT = text => {
  const lines = text.split("\n");
  return ["script", lines];
};
export const msg = (lines, opt = {}) => ["msg", lines, opt];
export const IF = (params, then, els) => ["if", params, then, els];
export const choice = (labels, cancel, branches) => ["choice", labels, cancel, branches];
export const TONE = (tone, frames, wait = true) => [223, [tone, frames, wait]];
export const WAIT = n => [230, [n]];

export function compile(tree, indent = 0) {
  const out = [];
  for (const node of tree) {
    const [kind] = node;
    if (kind === "msg") {
      const [, lines, opt] = node;
      const pages = Array.isArray(lines[0]) ? lines : chunk(lines, 4);
      for (const page of pages) {
        out.push({ code: 101, indent, parameters: [opt.face || "", 0, opt.bg ?? 0, opt.pos ?? 2, opt.name || ""] });
        for (const l of page) out.push({ code: 401, indent, parameters: [l] });
      }
    } else if (kind === "if") {
      const [, params, then, els] = node;
      out.push({ code: 111, indent, parameters: params });
      out.push(...compile(then, indent + 1), { code: 0, indent: indent + 1, parameters: [] });
      if (els) {
        out.push({ code: 411, indent, parameters: [] });
        out.push(...compile(els, indent + 1), { code: 0, indent: indent + 1, parameters: [] });
      }
      out.push({ code: 412, indent, parameters: [] });
    } else if (kind === "choice") {
      const [, labels, cancel, branches] = node;
      out.push({ code: 102, indent, parameters: [labels, cancel, 0, 2, 0] });
      labels.forEach((label, i) => {
        out.push({ code: 402, indent, parameters: [i, label] });
        out.push(...compile(branches[i] || [], indent + 1), { code: 0, indent: indent + 1, parameters: [] });
      });
      out.push({ code: 404, indent, parameters: [] });
    } else if (kind === "script") {
      const [, lines] = node;
      out.push({ code: 355, indent, parameters: [lines[0]] });
      for (const l of lines.slice(1)) out.push({ code: 655, indent, parameters: [l] });
    } else if (kind === "raw") {
      out.push(...node[1].map(c => ({ ...c, indent: indent + (c.indent || 0) })));
    } else {
      const [code, params] = node;
      out.push({ code, indent, parameters: params });
    }
  }
  return out;
}
export const list = tree => [...compile(tree), { code: 0, indent: 0, parameters: [] }];
const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };

// ---- イベントの部品 ----
export const DOWN = 2, LEFT = 4, RIGHT = 6, UP = 8;
export const transfer = (x, y, name, to, extra = {}) => ({ x, y, name, type: "transfer", to, ...extra });
export const text = (x, y, name, lines, extra = {}) => ({ x, y, name, type: "text", ...extra, lines });
export const raw = (x, y, name, pages, note) => ({ x, y, name, type: "raw", ...(note ? { note } : {}), pages });
export const CORPSE = (i = 1, d = 2, p = 2) => ({ characterName: "Damage1", characterIndex: i, direction: d, pattern: p });

/** 調べると拾える物（大事なもの・消耗品）。拾うとセルフスイッチ A で消える（下に何か残すなら after の絵）。 */
export function pickup(x, y, name, { line, itemId, icon, itemName, count = 1, image, after, kind = 126, priority = 1 }) {
  const gain = kind === 126 ? [126, [itemId, 0, 0, count]] : [kind, [itemId, 0, 0, count, false]];
  return raw(x, y, name, [
    { image, priorityType: priority, walkAnime: false, list: list([
      msg([line]), SE("Item1"), gain, SELF("A"),
      msg([`\\I[${icon}]${itemName}${count > 1 ? `を ${count} 個` : "を"}手に入れた！`]),
    ]) },
    { conditions: { selfSwitchCh: "A", selfSwitchValid: true }, ...(after ? { image: after, priorityType: 1 } : { priorityType: 0 }) },
  ]);
}

/** 宝箱（赤い宝箱も同じ絵の 0 番。W4 と同じ） */
export function chest(x, y, name, { kind, itemId, icon, itemName, count = 1 }) {
  const code = { item: 126, weapon: 127, armor: 128 }[kind];
  const gain = code === 126 ? [126, [itemId, 0, 0, count]] : [code, [itemId, 0, 0, count, false]];
  return raw(x, y, name, [
    { image: { characterName: "!Chest", characterIndex: 0, direction: 2, pattern: 0 }, priorityType: 1, trigger: 0, walkAnime: false,
      list: list([SE("Chest1"), gain, SELF("A"), msg([`\\I[${icon}]${itemName}${count > 1 ? ` ×${count}` : ""}を手に入れた！`])]) },
    { conditions: { selfSwitchCh: "A", selfSwitchValid: true }, image: { characterName: "!Chest", characterIndex: 0, direction: 8, pattern: 0 },
      priorityType: 1, trigger: 0, walkAnime: false },
  ]);
}

/** 結界（灰の泉と記録の書見台。U3 <hai_warp>） */
export const warp = (x, y, name, warpName) => raw(x, y, name, [
  { image: { characterName: "!Crystal", characterIndex: 1, direction: 8, pattern: 1 }, priorityType: 1, stepAnime: true, directionFix: true, trigger: 0 },
], `<hai_warp:${warpName}>`);

/** シンボル敵。route は移動ルートのコマンド番号（1 下 2 左 3 右 4 上）の並び。無ければ chase 0 なら固定、そうでなければランダム */
export function enemy(x, y, name, troop, rank, { image, route, chase, fixed } = {}) {
  const note = [`<hai_enemy:${troop},${rank}>`, chase !== undefined ? `<hai_enemy_chase:${chase}>` : ""].filter(Boolean).join("\n");
  const page = { image: { pattern: 1, direction: 2, ...image }, priorityType: 1, moveSpeed: 3, trigger: 2 };
  if (route) {
    page.moveType = 3;
    page.moveFrequency = 5;
    page.moveRoute = { list: [...route.map(code => ({ code, parameters: [] })), { code: 0, parameters: [] }], repeat: true, skippable: true, wait: false };
  } else if (!fixed && chase !== 0) {
    page.moveType = 1;
    page.moveFrequency = 3;
  }
  return { name, type: "raw", x, y, note, pages: [page] };
}
export const rep = (code, n) => Array(n).fill(code);

/** 隠し階段・片側扉（P2） */
export const stairs = (x, y, name, map, tx, ty, d) => raw(x, y, name, [{ priorityType: 0 }], `<hai_stairs:${map},${tx},${ty}${d ? "," + d : ""}>`);

/** ボス（Hai_Boss のボス戦。看守長と同じ形） */
export function bossEvent(x, y, name, { image, intro, troopId, troopName, escape: [em, ex, ey, ed], won, sw }) {
  const DIRN = { 2: "下", 4: "左", 6: "右", 8: "上" };
  return raw(x, y, name, [
    { image, priorityType: 1, directionFix: true, list: list([
      msg(intro),
      [357, ["Hai_Boss", "bossBattle", "ボス戦", { troopId: String(troopId), escapeMapId: String(em), escapeX: String(ex), escapeY: String(ey), escapeDirection: String(ed) }]],
      [657, [`敵グループ = ${String(troopId).padStart(4, "0")}:${troopName}`]],
      [657, [`逃げたときのマップ = ${em}`]],
      [657, [`逃げたときの X = ${ex}`]],
      [657, [`逃げたときの Y = ${ey}`]],
      [657, [`逃げたときの向き = ${DIRN[ed]}`]],
      IF([12, "Hai.Boss.lastResult() === 0"], [msg(won)]),
    ]) },
    { conditions: { switch1Id: sw, switch1Valid: true }, priorityType: 0 },
  ]);
}

export function writeMap(base, grid, config) {
  fs.writeFileSync(path.join(SRC, base + ".txt"), grid.text());
  fs.writeFileSync(path.join(SRC, base + ".json"), JSON.stringify(config, null, 2) + "\n");
}
export function readSrc(base) { return JSON.parse(fs.readFileSync(path.join(SRC, base + ".json"), "utf8")); }
export function writeSrc(base, json) { fs.writeFileSync(path.join(SRC, base + ".json"), JSON.stringify(json, null, 2) + "\n"); }
