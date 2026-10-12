// W8（#155）地域二の文字マップの設定（tools/maps/src/w8_*.json）を書く。何度走らせても同じ結果になる。
//   node tools/maps/src/w8_maps.mjs           書く（そのあと node tools/maps/build.mjs w8_… で data/MapNNN.json に）
//   node tools/maps/src/w8_maps.mjs --check   書かずに、今のファイルと同じかだけ見る（違えば終了コード 1）
// 地図（.txt）と置き物の重ね書き（.deco.txt）は手で直してよい（このスクリプトは .json だけを書く）。
// 文は docs/world.md（5・6・7・8・10・11 章）と docs/knowhow.md（避ける癖）に合わせて W8 が書いた。
// 番号は w8_data.mjs（データベース 421–500・スイッチ／変数 401–500）と world.md 4.4 の旗。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readData } from "../../data/io.mjs";
import { ITEM, WEAPON, ARMOR, TROOP, SW, VAR, FLAG } from "./w8_data.mjs";
import { withThirdScene, lairDoorEvents } from "./w11_parts.mjs"; // W11（#191）：鐘番の思念の 2 ページ目と霧の戸口

const HERE = path.dirname(fileURLToPath(import.meta.url));
const check = process.argv.includes("--check");
const outputs = [];

// ---------------------------------------------------------------------------
// ほかのマップとの出入口（docs/maps.md の W8 の章に同じ表）
// ---------------------------------------------------------------------------
export const MAP = { gate: 60, square: 61, tower: 62, shrine: 63, tunnel: 64, court: 80, stacks: 81, sealed: 82, nameHall: 83, bellRoom: 84, hospice: 23 };
export const AT = {
  chapelFromGate: [21, 1, 8], // 060 の東の出口 → 021 の西の端（W7）
  ossuary: [22, 13, 10], // 082 の H31 → 022 の棺の部屋の西の壁の前（W7）
  cells: [33, 8, 9], // 064 の H22 → 033 の房の列の西の壁の前（W7）
  chapelFromHospice: [21, 58, 31], // 023 の西の林 → 021 の東の白い花（W7）
  lake: [70, 22, 1], // 061 の水路の石段 → 070 の北の入口（今の 070 の座標。W9 が 070 を作り直したら合わせる）
  fortReturn: [10, 25, 27], // 084 の帰りの転送陣 → 010 の炉の南（W6）
};
// W8 のマップの着く所（ほかのマップの場所移動の行き先）
export const ARRIVE = {
  gateEast: [60, 47, 18], gateNorth: [60, 25, 2],
  squareSouth: [61, 35, 46], squareTower: [61, 9, 8], squareShrine: [61, 35, 6], squareLake: [61, 38, 31],
  towerIn: [62, 13, 12], shrineIn: [63, 13, 16], shrineFromTunnel: [63, 5, 10], shrineBack: [63, 13, 4],
  tunnelWest: [64, 2, 7], tunnelEast: [64, 41, 7],
  courtSouth: [80, 19, 27], courtNorth: [80, 19, 3],
  stacksSouth: [81, 29, 42], stacksVault: [81, 30, 2],
  sealedSouth: [82, 20, 27], sealedH31: [82, 7, 13], sealedNorth: [82, 20, 3],
  nameSouth: [83, 13, 14], nameNorth: [83, 13, 4],
  bellSouth: [84, 13, 18], hospiceWest: [23, 1, 7],
};

// ---------------------------------------------------------------------------
// イベントの部品
// ---------------------------------------------------------------------------
const items = readData("Items.json"), weapons = readData("Weapons.json"), armors = readData("Armors.json");
const TABLE = { item: items, weapon: weapons, armor: armors };
const CODE = { item: 126, weapon: 127, armor: 128 };
const end = indent => ({ code: 0, indent, parameters: [] });
/** 文章（4 行ごとに窓を分ける） */
export function say(lines, name = "", indent = 0) {
  const out = [];
  for (let i = 0; i < lines.length; i += 4) {
    out.push({ code: 101, indent, parameters: ["", 0, 0, 2, name] });
    for (const t of lines.slice(i, i + 4)) out.push({ code: 401, indent, parameters: [t] });
  }
  return out;
}
const se = (name, indent = 0, volume = 90, pitch = 100) => ({ code: 250, indent, parameters: [{ name, volume, pitch, pan: 0 }] });
const selfOn = (ch = "A", indent = 0) => ({ code: 123, indent, parameters: [ch, 0] });
const swOn = (id, indent = 0) => ({ code: 121, indent, parameters: [id, id, 0] });
const varSet = (id, value, indent = 0, op = 0) => ({ code: 122, indent, parameters: [id, id, op, 0, value] });
const plugin = (pluginName, command, label, args, indent = 0) => [
  { code: 357, indent, parameters: [pluginName, command, label, args] },
  ...Object.entries(args).map(([k, v]) => ({ code: 657, indent, parameters: [`${k} = ${v}`] })),
];
const note = (text, id, indent = 0, kind = "clue") => plugin("Hai_Thoughts", "addNote", "メモに足す", { text, id, kind }, indent);
const errand = (args, indent = 0) => plugin("Hai_Notes", "errand", "頼みごとを進める", args, indent);
const errandEnd = (args, indent = 0) => plugin("Hai_Notes", "errandEnd", "頼みごとを終える", args, indent);
/** 物を渡す（効果音・入手の文） */
function give(kind, id, n = 1, indent = 0) {
  if (kind === "gold") return [se("Coin", indent), { code: 125, indent, parameters: [0, 0, n] }, ...say([`鉄くずを ${n} 手に入れた！`], "", indent)];
  const e = TABLE[kind][id];
  if (!e || !e.name) throw new Error(`${kind} ${id} が無い`);
  const params = kind === "item" ? [id, 0, 0, n] : [id, 0, 0, n, false];
  return [
    { code: CODE[kind], indent, parameters: params },
    ...say([`\\I[${e.iconIndex}]${e.name}${n > 1 ? ` ×${n}` : ""}を手に入れた！`], "", indent),
  ];
}
const choice = (labels, cancel = labels.length - 1, indent = 0) => ({ code: 102, indent, parameters: [labels, cancel, 0, 2, 0] });
const when = (i, label, indent = 0) => ({ code: 402, indent, parameters: [i, label] });
const choiceEnd = (indent = 0) => ({ code: 404, indent, parameters: [] });
const ifSwitch = (id, on = true, indent = 0) => ({ code: 111, indent, parameters: [0, id, on ? 0 : 1] });
const ifVar = (id, value, cmp = 0, indent = 0) => ({ code: 111, indent, parameters: [1, id, 0, value, cmp] });
const ifItem = (id, indent = 0) => ({ code: 111, indent, parameters: [8, id] });
const ifActor = (actorId, indent = 0) => ({ code: 111, indent, parameters: [4, actorId, 0] });
const ifScript = (expr, indent = 0) => ({ code: 111, indent, parameters: [12, expr] });
const orElse = (indent = 0) => ({ code: 411, indent, parameters: [] });
const endIf = (indent = 0) => ({ code: 412, indent, parameters: [] });
const move = (mapId, x, y, dir = 0, indent = 0) => ({ code: 201, indent, parameters: [0, mapId, x, y, dir, 0] });
const DIR = { down: 2, left: 4, right: 6, up: 8 };
const IMG = {
  chest: { characterName: "!Chest", characterIndex: 0, direction: 2, pattern: 0 },
  redChest: { characterName: "!Chest", characterIndex: 1, direction: 2, pattern: 0 },
  glint: { characterName: "!Other1", characterIndex: 1, direction: 2, pattern: 1 },
  memory: { characterName: "!Other1", characterIndex: 5, direction: 2, pattern: 1 },
  faint: { characterName: "!Flame", characterIndex: 4, direction: 2, pattern: 1 },
  warp: { characterName: "!Other2", characterIndex: 3, direction: 2, pattern: 1 },
  door: { characterName: "!Door1", characterIndex: 0, direction: 2, pattern: 0 },
  doorOpen: { characterName: "!Door1", characterIndex: 0, direction: 8, pattern: 0 },
  wallDoor: { characterName: "!Door1", characterIndex: 6, direction: 2, pattern: 0 },
  wallDoorOpen: { characterName: "!Door1", characterIndex: 6, direction: 8, pattern: 0 },
  lever: { characterName: "!Switch1", characterIndex: 0, direction: 2, pattern: 0 },
};
const body = (sheet, index, direction = 2) => ({ characterName: sheet, characterIndex: index, direction, pattern: 1 });

/** 調べると一行か二行出る物 */
export const look = (name, x, y, lines, image) => ({ name, type: "text", x, y, ...(image ? { image } : {}), lines });
/** 残留思念（docs/plugins/Hai_Thoughts.md） */
export function thought(id, who, x, y, lines, { clue = [], image = body("Damage1", 5, 8) } = {}) {
  return { name: `思念 ${id} ${who}`, type: "text", x, y, note: `<hai_thought:${id}>` + clue.map(c => `<hai_clue:${c}>`).join(""), image, lines };
}
/** 記憶の断片（docs/plugins/Hai_Companions.md） */
export function memory(actorId, n, who, x, y, lines, image = IMG.memory) {
  return { name: `記憶 ${who} ${n}`, type: "text", x, y, note: `<hai_memory:${actorId},${n}>`, image, lines };
}
/** 宝箱（kind: item/weapon/armor/gold） */
export function chest(x, y, kind, id, n = 1, { red = false, label } = {}) {
  const what = kind === "gold" ? "鉄くず" : TABLE[kind][id].name;
  const img = red ? IMG.redChest : IMG.chest;
  return {
    name: `${red ? "赤い宝箱" : "宝箱"}（${label || what}）`, type: "raw", x, y, note: "",
    pages: [
      { image: img, priorityType: 1, trigger: 0, walkAnime: false, list: [se("Chest1"), ...give(kind, id, n), selfOn(), end(0)] },
      { conditions: { selfSwitchCh: "A", selfSwitchValid: true }, image: { ...img, direction: 8 }, priorityType: 1, walkAnime: false, list: [end(0)] },
    ],
  };
}
/** 拾い物（光る点か、置物の絵）。pre の文のあとに渡す。after は渡したあとの命令 */
export function pickup(name, x, y, kind, id, pre = [], { n = 1, image = IMG.glint, after = [], note: memo = "" } = {}) {
  return {
    name: `拾い物（${name}）`, type: "raw", x, y, note: memo,
    pages: [
      { image, priorityType: 1, stepAnime: !!image.characterName && image.characterName.startsWith("!Other"), walkAnime: false,
        list: [...(pre.length ? say(pre) : []), se("Item1"), ...give(kind, id, n), ...after, selfOn(), end(0)] },
      { conditions: { selfSwitchCh: "A", selfSwitchValid: true }, priorityType: 0, list: [end(0)] },
    ],
  };
}
/** シンボル敵（docs/plugins/Hai_SymbolEnemy.md）。route は移動ルートの命令の番号の列（1 下・2 左・3 右・4 上） */
export function enemy(name, x, y, troopId, rank, image, { type = 1, speed = 3, freq = 3, route = null, chase = null, hesitate = false } = {}) {
  const note = `<hai_enemy:${troopId},${rank}>` + (chase !== null ? `\n<hai_enemy_chase:${chase}>` : "") + (hesitate ? "\n<hai_enemy_hesitate>" : "");
  const page = { image, priorityType: 1, moveSpeed: speed, trigger: 2, moveType: route ? 3 : type, moveFrequency: route ? 4 : freq };
  if (route) page.moveRoute = { list: [...route.map(code => ({ code, parameters: [] })), { code: 0, parameters: [] }], repeat: true, skippable: true, wait: false };
  return { name, type: "raw", x, y, note, pages: [page] };
}
const back = (steps, there) => [...there, ...there.map(c => ({ 1: 4, 4: 1, 2: 3, 3: 2 })[c])].slice(0, steps);
/** 往復（同じ道を行って戻る） */
const patrol = (dir, n) => { const c = { down: 1, left: 2, right: 3, up: 4 }[dir]; const r = { 1: 4, 4: 1, 2: 3, 3: 2 }[c]; return [...Array(n).fill(c), ...Array(n).fill(r)]; };
/** 踏むと場所移動 */
export const transfer = (name, x, y, [mapId, tx, ty], dir) => ({ name, type: "transfer", x, y, to: [mapId, tx, ty, dir] });
/** 壁の戸口（決定キーか、向かって歩くと場所移動）。cond があれば、その旗が立つまで lockedLines を出す */
export function doorTo(name, x, y, [mapId, tx, ty], dir, { image = IMG.door, cond = null, lockedLines = [] } = {}) {
  const go = [se("Door1"), move(mapId, tx, ty, DIR[dir]), end(0)];
  if (!cond) return { name, type: "raw", x, y, note: "", pages: [{ image, priorityType: 1, trigger: 1, walkAnime: false, list: go }] };
  return {
    name, type: "raw", x, y, note: "",
    pages: [
      { image, priorityType: 1, trigger: 0, walkAnime: false, list: [...say(lockedLines), end(0)] },
      { conditions: cond, image, priorityType: 1, trigger: 1, walkAnime: false, list: go },
    ],
  };
}
/** 転送の結界（Hai_Warp） */
export const warp = (label, x, y) => ({
  name: `結界（${label}）`, type: "raw", x, y, note: `<hai_warp:${label}>`,
  pages: [{ image: IMG.warp, priorityType: 1, trigger: 0, stepAnime: true, list: [end(0)] }],
});
/** 薄い思念（docs/plugins/Hai_Thoughts.md の <hai_faint>）。最後に W6 のコモンイベント 201（記憶が戻ったときの一言） */
export function faint(id, who, x, y, lines) {
  return {
    name: `薄い思念 ${id} ${who}`, type: "raw", x, y, note: `<hai_faint:${id}>`,
    pages: [{ image: IMG.faint, priorityType: 1, stepAnime: true, list: [...say(lines), { code: 117, indent: 0, parameters: [201] }, end(0)] }],
  };
}
/** 遺骸（docs/plugins/Hai_Companions.md）。臨終の記憶と同じイベント */
export function remains(actorId, who, x, y, look, last, image) {
  return {
    name: `遺骸 ${who}`, type: "raw", x, y, note: `<hai_remains:${actorId}><hai_memory:${actorId},4>`,
    pages: [
      { image, priorityType: 1, trigger: 0, list: [...say(look), ...say(last), end(0)] },
      { conditions: { selfSwitchCh: "A", selfSwitchValid: true }, priorityType: 0, list: [end(0)] },
    ],
  };
}
/** 生き残りが砦へ行く（スイッチ・生き残りの数・部屋） */
const toFort = (switchId, facility, indent = 0) => [
  { code: 221, indent, parameters: [] },
  swOn(switchId, indent), varSet(FLAG.survivors, 1, indent, 1),
  ...(facility ? plugin("Hai_Facilities", "open", "部屋を開く", { facility }, indent) : []),
  selfOn("A", indent),
  { code: 222, indent, parameters: [] },
];

// ---------------------------------------------------------------------------
// 置き物の凡例（タイルセットごと）
// ---------------------------------------------------------------------------
// 焼けた村（タイルセット 19：B Outside_B・C Outside_C・D Dungeon_B・E Inside_B）
const VILLAGE_DECO = {
  k: { name: "草A（通れる）", z2: "B:152" }, K: { name: "草B（通れる）", z2: "B:153" }, f: { name: "花（通れる）", z2: "B:160" },
  s: { name: "小石（通れる）", z2: "B:171" }, l: { name: "枯れ草（通れる）", z2: "B:239" }, L: { name: "落ち葉（通れる）", z2: "B:252" },
  g: { name: "墓A（通れない）", z2: "B:142" }, G: { name: "墓B（通れない）", z2: "B:143" },
  r: { name: "瓦礫（通れない）", z2: "D:120" }, R: { name: "苔の瓦礫（通れない）", z2: "D:121" },
  x: { name: "骸骨（通れない）", z2: "D:242" }, X: { name: "骸骨B（通れない）", z2: "D:250" }, q: { name: "瓦礫の上の骸骨（通れない）", z2: "D:120", z3: "D:242" },
  b: { name: "樽（通れない）", z2: "B:141" }, c: { name: "木箱（通れない）", z2: "B:181" }, C: { name: "木箱の上の壺（通れない）", z2: "B:181", z3: "B:144" },
  p: { name: "壺（通れない）", z2: "B:144" }, w: { name: "薪（通れない）", z2: "B:170" }, t: { name: "枯れ木（通れない）", z2: "B:240" },
  o: { name: "倒木（通れない）", z2: "B:164" }, O: { name: "石のかまど（通れない）", z2: "B:147" }, i: { name: "桶（通れない）", z2: "B:145" },
  H: { name: "干し草（通れない）", z2: "B:248" }, v: { name: "立て札（通れない）", z2: "B:137" }, z: { name: "壺B（通れない）", z2: "B:144" },
  h: { name: "苔の切り株（通れない）", z2: "B:243" }, a: { name: "石碑（通れない）", z2: "C:32" }, u: { name: "壊れた台座（通れない）", z2: "C:76" },
  m: { name: "折れた石の柱（通れない）", z2: "C:17" }, d: { name: "穴（通れない）", z2: "B:169" }, n: { name: "シダ（通れない）", z2: "B:246" },
  "1": { name: "石の柱（下。通れない）", z2: "D:105" }, "2": { name: "壊れた像（通れない）", z2: "D:91" }, "7": { name: "砂利（通れる）", z2: "D:32" },
};
const VILLAGE_STAMPS = [
  { at: "幕", name: "破れた天幕（3×3）", tiles: [["B:29", "B:30", "B:31"], ["B:37", "B:38", "B:39"], ["B:45", null, "B:47"]] },
  { at: "木", name: "大木（2×2。上の段は☆）", tiles: [["B:176", "B:177"], ["B:184", "B:185"]] },
  { at: "寝", name: "焼け出された寝台（1×2）", tiles: [["E:168"], ["E:176"]] },
  { at: "柱", name: "石の柱（1×2。上は☆）", tiles: [["D:97"], ["D:105"]] },
  { at: "薪", name: "薪の山と壺（2×1）", tiles: [["B:170", "B:170"]], upper: [["B:144", null]] },
];
const VILLAGE_BASE = {
  legend: "village", tilesetId: 19,
  note: "<hai_tone:-34,-34,-34,136>\n<hai_parallax:DarkClouds,1,0>\n<hai_ash:3>",
  bgm: { name: "Field3", volume: 65, pitch: 100, pan: 0 }, bgs: { name: "Wind2", volume: 40, pitch: 100, pan: 0 },
  fields: { specifyBattleback: true, battleback1Name: "DirtField", battleback2Name: "Ruins1" },
  deco: VILLAGE_DECO, stamps: VILLAGE_STAMPS,
};
// 営倉と同じ絵の地下（タイルセット 14）と記録院（タイルセット 16）：B Dungeon_B・C Dungeon_C・D Inside_B・E Inside_C
const UNDER_DECO = {
  "1": { name: "石の柱B（下。通れない）", z2: "B:106" }, "2": { name: "折れた石の柱（通れない）", z2: "B:114" }, "3": { name: "石碑A（通れない）", z2: "B:64" },
  "4": { name: "壊れた像（通れない）", z2: "B:91" }, "5": { name: "亀裂B（壁に）", z2: "B:187" }, "7": { name: "壁の苔（壁に）", z2: "B:1" }, "8": { name: "壁のツタ（壁に）", z2: "B:184" },
  k: { name: "砂利A（通れる）", z2: "B:32" }, K: { name: "砂利B（通れる）", z2: "B:33" },
  r: { name: "瓦礫A（通れない）", z2: "B:120" }, R: { name: "苔の瓦礫（通れない）", z2: "B:121" }, u: { name: "瓦礫D（土。通れない）", z2: "B:124" },
  x: { name: "骸骨A（通れない）", z2: "B:242" }, X: { name: "骸骨B（通れない）", z2: "B:250" }, q: { name: "瓦礫の上の骸骨（通れない）", z2: "B:120", z3: "B:242" },
  o: { name: "岩B（通れない）", z2: "B:41" }, e: { name: "端材（通れない）", z2: "B:125" }, w: { name: "蜘蛛の巣（壁に）", z2: "B:176" },
  b: { name: "樽A（通れない）", z2: "B:238" }, B: { name: "樽B（廃墟。通れない）", z2: "B:239" }, c: { name: "木箱A（通れない）", z2: "B:220" }, C: { name: "木箱C（廃墟。通れない）", z2: "B:222" },
  p: { name: "壺A（廃墟。通れない）", z2: "B:223" }, P: { name: "壺B（通れない）", z2: "B:231" }, t: { name: "テーブル（廃墟。通れない）", z2: "B:243" }, h: { name: "椅子（廃墟）", z2: "B:251" },
  l: { name: "ロープ（通れない）", z2: "B:234" }, g: { name: "土砂A（通れない）", z2: "B:216" },
  j: { name: "鉄格子（上）", z2: "B:244" }, J: { name: "鉄格子（下）", z2: "B:252" }, y: { name: "粗末なベッド（通れない）", z2: "C:150" }, Y: { name: "むしろの寝床", z2: "C:151" },
  z: { name: "倒れた棚（通れない）", z2: "C:192" }, Z: { name: "本棚A（下。通れない）", z2: "C:205" }, n: { name: "椅子（Dungeon_C）", z2: "C:157" }, N: { name: "テーブル（Dungeon_C）", z2: "C:149" },
  f: { name: "積まれた木箱（通れない）", z2: "C:228" }, F: { name: "積まれた木箱B", z2: "C:229" }, v: { name: "クローゼット（通れない）", z2: "C:178" }, V: { name: "チェスト（通れない）", z2: "C:176" },
  a: { name: "線路（横）", z2: "C:105" }, A: { name: "線路（縦）", z2: "C:104" },
  d: { name: "燭台（通れない）", z2: "E:186" }, D: { name: "長机（教会机。通れない）", z2: "E:193" }, i: { name: "紙の束（通れない）", z2: "E:80" },
  m: { name: "巻物の棚（通れない）", z2: "D:185" }, M: { name: "焼けた書架（通れない）", z2: "D:175" }, s: { name: "散った紙（通れない）", z2: "E:72" },
  S: { name: "積んだ本（通れない）", z2: "E:68" }, T: { name: "書見台（通れない）", z2: "E:194" }, Q: { name: "女神像（通れない）", z2: "E:177" },
};
const UNDER_STAMPS = [
  { at: "柱", name: "石の柱（1×2。上は☆）", tiles: [["B:98"], ["B:106"]] },
  { at: "鐘", name: "鐘（台座の上に小さな鐘。仮の絵。look.md 2.2）", tiles: [["E:173"]], upper: [["E:121"]] },
  { at: "棚", name: "高い本棚（1×2。上は☆）", tiles: [["D:157"], ["D:165"]] },
];
const SHRINE_BASE = {
  legend: "dungeon", tilesetId: 14,
  bgm: { name: "Castle3", volume: 60, pitch: 100, pan: 0 }, bgs: { name: "Fire1", volume: 25, pitch: 100, pan: 0 },
  fields: { specifyBattleback: true, battleback1Name: "Stone1", battleback2Name: "Temple" },
  deco: UNDER_DECO, stamps: UNDER_STAMPS,
};
const LIBRARY_BASE = {
  legend: "library", tilesetId: 16,
  deco: UNDER_DECO, stamps: UNDER_STAMPS,
};
const ARCHIVE_BG = (a, b) => ({ specifyBattleback: true, battleback1Name: a, battleback2Name: b });

function config(file, cfg) {
  // スタンプは地図に在る文字だけ（build.mjs は使わないスタンプを止める）
  const read = ext => { const p = path.join(HERE, file + ext); return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : ""; };
  const drawn = read(".txt") + read(".deco.txt");
  if (cfg.stamps) cfg = { ...cfg, stamps: cfg.stamps.filter(s => drawn.includes(s.at)) };
  outputs.push({ file: path.join(HERE, file + ".json"), text: JSON.stringify(cfg, null, 2) + "\n" });
}

// ===========================================================================
// 060 焼けた村・入口
// ===========================================================================
{
  const [sx, sy] = [ARRIVE.squareSouth[1], ARRIVE.squareSouth[2]];
  const events = [
    ...[16, 17, 18, 19, 20].map(y => transfer("東の焼けた道（古い礼拝堂へ）", 49, y, AT.chapelFromGate, "right")),
    ...[23, 24, 25, 26, 27].map(x => transfer("北の道（村の広場へ）", x, 0, [MAP.square, sx - 25 + x, sy], "up")),
    warp("焼けた村の入口", 44, 20),
    look("道標", 45, 15, ["焼けた杭に板が打ち付けてある。「この先　村」。", "村の字の下に、刃物で小さく「こたえるな」。"], { tileId: "B:137" }),
    // 入口の家
    pickup("戸板の盾", 41, 24, "armor", ARMOR.doorShield, ["戸口の脇に、戸板が一枚立てかけてある。", "裏に、取っ手が打ち付けてある。"], { image: { tileId: "B:180" } }),
    thought("R2-01", "戸を開けなかった母親", 38, 26, [
      "戸を三度、叩かれた。去年の秋に祠へ行った娘の声だった。",
      "朝まで、戸に背中をつけて座ってた。",
      "叩く音は、三度で止んだ。夜明けの前だった。",
      "戸板の裏に、下の子が何か書いてる。読んでいない。",
    ], { image: body("Damage1", 5, 4) }),
    look("内から打ち付けた戸", 42, 22, ["戸口に、内側から板が打ち付けてあった跡。", "釘は外から抜かれていない。中から抜いてある。"]),
    // ノラの家
    memory(6, 1, "ノラ", 28, 24, [
      ["うちは狩りの家。父さんが弓で、あたしは追い込み！", "藪を走って、獲物を父さんの前に追い出すの。", "村でいちばん速かったよ。大人よりも！"],
      ["妹はのろくてさ。いっつも後ろで、待ってよって。", "待ってやればよかったな。", "あたし、走るのだけは上手かったんだ。"],
    ]),
    look("焼けた寝台", 31, 26, ["寝台が二つ並んでいる。小さい方の枕元に、木彫りの兎。", "大きい方は、窓の下に寄せてある。"]),
    // 畑と盛り土（ノラ）
    {
      name: "畑の盛り土（ノラ）", type: "raw", x: 12, y: 28, note: "",
      pages: [
        { image: { tileId: "B:169" }, priorityType: 1, list: [
          ifActor(6),
          ...say(["ノラが鼻を鳴らして、盛り土の前にしゃがんだ。"], "", 1),
          ...say(["ここ、何か埋まってる！　布の匂い。……うちの布だ。"], "ノラ", 1),
          se("Sand", 1, 80), ...give("armor", ARMOR.lotTag, 1, 1), selfOn("A", 1), end(1),
          orElse(0),
          ...say(["畑の真ん中に、小さな盛り土がある。墓ではない。", "鼻の利く者なら、何が埋まっているか分かりそうだ。"], "", 1), end(1),
          endIf(0), end(0),
        ] },
        { conditions: { selfSwitchCh: "A", selfSwitchValid: true }, image: { tileId: "B:169" }, priorityType: 1, list: [...say(["掘り返した土が、もう乾いている。"]), end(0)] },
      ],
    },
    thought("R2-02", "畑の番の子ども", 17, 26, [
      "くじはね、先の黒いのを引いたら、祠へ行くの。",
      "あたし白いの引いたよ。白いのは畑の番。",
      "案山子の腕の黒い棒、あたしが結んだの。鳥がね、来なくなった。",
    ], { image: body("Damage1", 6, 8) }),
    look("案山子", 9, 24, ["案山子の腕に、黒く塗った棒が一本結んである。"], { tileId: "B:148" }),
    // 配給の小屋
    pickup("配給札", 37, 8, "item", ITEM.rationTag, ["箱の中に、麦の印の木札が何十枚も重なっている。"], { image: { tileId: "B:181" } }),
    thought("R2-03", "配給を待った男", 34, 9, [
      "王国の麦が来なくなった年に、祠の帳面が始まった。",
      "麦の列に並んだ家の数と、帳面の名の数。どちらも、二十六。",
    ], { image: body("Damage2", 0, 2) }),
    // 信徒の集落（今）
    {
      name: "ゲンサイ", type: "raw", x: 11, y: 9, note: "",
      pages: [{ image: body("People4", 6, 2), priorityType: 1, list: [
        ifVar(VAR.brother, 3),
        ...say(["ルッツは自分で決めたんよ。あんたも見とったやろ。", "ほな。灰の祈りは夕べにやる。粥の椀は、一つ多めに出しとく。"], "ゲンサイ", 1), end(1),
        orElse(0),
        ...say(["ほな、あんたが砦の火の人か。鐘を鳴らして回っとると聞いたで。", "鐘なあ。鳴らしたら、しばらくは夜が静かや。しばらくは、な。"], "ゲンサイ", 1),
        ...say(["二百年前もそうやった。わしの経典には、そう書いてある。", "わしらは戸を閉めへん。叩かれたら、開ける。それで終わる苦しみもある。"], "ゲンサイ", 1),
        ...say(["ゆっくりしていき。堪忍な、出せるもんは灰の粥だけや。"], "ゲンサイ", 1), end(1),
        endIf(0), end(0),
      ] }],
    },
    {
      name: "ルッツ（アンネリーゼの弟）", type: "raw", x: 16, y: 11, note: "",
      pages: [
        { image: body("People3", 2, 4), priorityType: 1, list: [
          ifVar(VAR.brother, 1),
          ...say(["姉ちゃんに言われて来たんだろ。顔で分かるし。", "おれは帰らない。灰の祈りは、こわくないけど。"], "ルッツ", 1),
          ifItem(ITEM.sacrificeLedger, 1),
          choice(["生贄の帳面を見せる", "ゲンサイと話す", "やめる"], 2, 2),
          when(0, "生贄の帳面を見せる", 2),
          ...say(["……なんだよ、これ。"], "ルッツ", 3),
          ...say(["ルッツは帳面をめくり、ある行で指を止めた。"], "", 3),
          ...say(["鍛冶の家。うちだし。下の娘、済。", "次の年も、鍛冶の家。済。司祭さまは、こういうの、言わなかったけど。"], "ルッツ", 3),
          ...say(["……帰る。姉ちゃんの所に、帰る。"], "ルッツ", 3),
          varSet(VAR.brother, 2, 3), swOn(SW.brotherHome, 3),
          ...errand({ key: "brother", stage: "2", text: "ルッツは村の広場の鍛冶小屋へ帰った" }, 3),
          { code: 221, indent: 3, parameters: [] }, selfOn("A", 3), { code: 222, indent: 3, parameters: [] },
          end(3),
          when(1, "ゲンサイと話す", 2), ...argue(3), end(3),
          when(2, "やめる", 2), end(3),
          choiceEnd(2), end(2),
          orElse(1),
          choice(["ゲンサイと話す", "やめる"], 1, 2),
          when(0, "ゲンサイと話す", 2), ...argue(3), end(3),
          when(1, "やめる", 2), end(3),
          choiceEnd(2), end(2),
          endIf(1), end(1),
          orElse(0),
          ifVar(VAR.brother, 3, 0, 1),
          ...say(["姉ちゃんには、元気だって言っといて。それだけだし。"], "ルッツ", 2), end(2),
          orElse(1),
          ...say(["おれはここにいる。夕べの粥の番、おれだし。"], "ルッツ", 2), end(2),
          endIf(1), end(1),
          endIf(0), end(0),
        ] },
        { conditions: { switch1Id: SW.brotherHome, switch1Valid: true }, priorityType: 0, list: [end(0)] },
      ],
    },
    thought("R2-04", "くじを削った男", 6, 14, [
      "祠の帳面に、わしの名は無い。くじの棒を削る役だったからな。",
      "白い棒を十一本と、先を黒く塗る棒を一本。毎年、一本だけ。",
      "削り屑は、かまどで燃やした。黒い棒の屑だけ、別に捨てた。",
    ], { image: body("Damage2", 4, 6) }),
    look("灰の祈りの杭", 13, 6, ["杭に灰色の布が巻いてある。布の端に、新しい結び目が三つ。"]),
    // 道ばた
    look("灰に埋もれた荷車", 30, 15, ["荷車の轍が、祠の方へ向いている。", "荷台に麦の粒がこぼれたまま、灰をかぶっている。"], { tileId: "B:181" }),
    look("名の無い墓", 22, 21, ["墓標に名は無い。数だけ刻んである。百十二。"]),
    look("名の無い墓", 24, 21, ["墓標に名は無い。こちらは数も無い。"]),
    // 宝箱
    chest(46, 7, "item", ITEM.herb, 2),
    chest(3, 17, "gold", 0, 30),
    chest(5, 30, "item", ITEM.bitterRoot, 1),
    chest(46, 30, "item", ITEM.elixir, 1),
    // 敵
    enemy("灰鼬（緑）", 10, 25, TROOP.weasels, "green", body("Monster", 0)),
    enemy("灰鼬（緑）", 40, 13, TROOP.weasels, "green", body("Monster", 0)),
    enemy("煤けた鴉（黄・往復）", 31, 20, TROOP.crow, "yellow", body("Nature", 2), { route: patrol("right", 8) }),
    enemy("祠へ歩く者（黄）", 22, 12, TROOP.walker, "yellow", body("Evil", 6), { route: patrol("up", 6), speed: 2, hesitate: true }),
    enemy("焼け跡の番犬（黄・宝の番）", 39, 31, TROOP.scorchDog, "yellow", body("Monster", 3), { type: 0, chase: 3 }),
  ];
  config("w8_060_burnt_gate", {
    _説明: "W8（#155）：焼けた村・入口（docs/world.md 5.1・5.2・7.3）。東の焼けた道→021、北の道→061。入口の家（戸板の盾）、ノラの家（記憶 1）、畑の盛り土（ノラ）、配給の小屋、灰の信徒の今の集落（ゲンサイ・ルッツ）。",
    mapId: 60, name: "焼けた村・入口", displayName: "焼けた村", ...VILLAGE_BASE,
    chars: {},
    scatter: [
      { on: ".", z: 1, tiles: ["A2:15"], rate: 0.08, seed: 60 },
      { on: ".", tiles: ["B:171", "B:239", "B:252", "D:32", "B:152", "B:153"], rate: 0.14, seed: 61 },
      { on: ",", tiles: ["B:152", "B:153", "B:239", "B:155"], rate: 0.2, seed: 62 },
      { on: ";", tiles: ["D:32", "D:33", "B:252"], rate: 0.12, seed: 63 },
    ],
    events,
  });
}

// ===========================================================================
// 061 焼けた村・広場
// ===========================================================================
{
  const anneliseFort = [
    ...errandEnd({ key: "brother", result: "done", text: "アンネリーゼは砦へ。ルッツは村の鍛冶小屋の火を見ている" }, 1),
    ...toFort(SW.annelise, "smithy", 1),
    ...say(["アンネリーゼは金槌を腰に差して、村の南へ出ていった。"], "", 1),
  ];
  const events = [
    ...[33, 34, 35, 36, 37].map(x => transfer("南の道（焼けた村の入口へ）", x, 49, [MAP.gate, x - 10, 2], "down")),
    doorTo("見張り台の戸", 9, 7, ARRIVE.towerIn, "up"),
    doorTo("祠の戸口", 35, 5, ARRIVE.shrineIn, "up", { image: { characterName: "!Door1", characterIndex: 2, direction: 2, pattern: 0 } }),
    transfer("水路の石段（霧の湖へ）", 38, 33, AT.lake, "down"),
    transfer("水路の石段（霧の湖へ）", 39, 33, AT.lake, "down"),
    look("水路の石段", 40, 33, ["石段が水路へ下りている。水路は南の霧の中へ続く。", "石段の苔に、小舟を舫った縄の擦れ跡。"]),
    warp("村の祠の下", 33, 9),
    // 広場
    memory(6, 3, "ノラ", 31, 15, [
      ["立て札に、村の長の触れ書き。", "「くじは収めの月。逃げた家は、下の子を出す」", "その下に、別の手で小さく「上の子は帰らず」。"],
      ["街道の宿で、荷運びの男が話してた。", "西の谷の村で、くじの娘が逃げたって。代わりに、その妹が祠へ行ったって。", "あたし、宿の裏で、朝まで動けなかった。", "足は、動かそうと思えば動いた。動かさなかった。"],
    ], { tileId: "B:137" }),
    look("井戸", 38, 20, ["井戸の縁に、縄の跡が二筋。一筋は新しい。", "桶は無い。代わりに、灰色の帯が結んである。"], { tileId: "B:147" }),
    thought("R2-08", "井戸の子ども", 39, 22, [
      "井戸に石を落とすとね、三つ数えて、ぽちゃん。",
      "くじの夜は、みんな井戸のまわりで数えるの。三十まで。",
      "三十まで数えたら、終わってるんだって。",
    ], { image: body("Damage1", 7, 8) }),
    thought("R2-05", "槍を持ってきた若者", 26, 20, [
      "祠のくじを止めに来た。相場は、娘一人で銀三十。",
      "祠守りに斬りかかった所で、後ろから腕を取られた。女の手だった。",
      "くじで行く娘の母親だと。使徒は来ず、村はその年も残った。",
      "槍は取り上げられた。銀三十は、もらっていない。",
    ], { image: body("Damage2", 6, 6) }),
    thought("R2-06", "槍を預かった年寄り", 13, 19, [
      "使徒狩りの若いのが来て、くじを止めると言った。",
      "くじを止めたら、村が行く。あれには、それが分からん。",
      "槍は預かった。西の生け垣の奥に、放った。穂先を下にして。",
    ], { clue: ["使徒狩りの槍は、村の西の生け垣の奥に放られたらしい（焼けた村の広場）"], image: body("Damage2", 0, 8) }),
    // 鍛冶小屋
    look("金床", 52, 18, ["金床の角が欠けている。欠けた所だけ、新しい鉄で継いである。"], { tileId: "B:150" }),
    thought("R2-07", "閂を打った鍛冶", 58, 18, [
      "祠の戸の閂は、わしが打った。",
      "内からは開かない閂を、と言われた。外からだけ開く閂だ。",
      "打てと言われて、打った。鍛冶は、頼まれた物を打つ。",
    ], { image: body("Damage2", 2, 4) }),
    {
      name: "アンネリーゼ", type: "raw", x: 56, y: 19, note: "",
      pages: [
        { image: body("People2", 3, 2), priorityType: 1, list: [
          ifVar(VAR.brother, 0),
          ...say(["おう、あんた。見ねえ顔だね。後輩かい。", "あたいはアンネリーゼ。ここで鉄を打ち直してる。鍬が八本、鎌が六本。"], "アンネリーゼ", 1),
          ...say(["頼みがあるんだ。弟のルッツが、村の入口の灰の連中の所に入っちまった。", "灰の祈りだか祠の祈りだか言ってさ。あの馬鹿。"], "アンネリーゼ", 1),
          ...say(["連れて帰ってくれねえか。あたいが行くと、喧嘩になる。", "礼は鉄くずで、ええと、三十と二十で、五十。いや、四十。とにかく払う！"], "アンネリーゼ", 1),
          varSet(VAR.brother, 1, 1),
          ...errand({ key: "brother", title: "弟を連れて帰る", who: "アンネリーゼ", stage: "1", variableId: "161", text: "灰の信徒の集落（焼けた村の入口）にいるルッツを連れて帰る" }, 1),
          end(1),
          orElse(0),
          ifVar(VAR.brother, 1, 0, 1),
          ...say(["ルッツは村の入口の、灰の連中の所だ。灰の連中にも、言い分はあるんだろうさ。", "あいつ、昔から言い負かされると黙るんだ。言い負かすんじゃねえぞ。"], "アンネリーゼ", 2), end(2),
          orElse(1),
          ifVar(VAR.brother, 2, 0, 2),
          ...say(["ルッツが帰ってきた。帳面に、うちの名が二つあったって。", "……あいつ、泣きやがって。あたいまで、もらっちまった。"], "アンネリーゼ", 3),
          ...say(["決めた。あたいは砦へ行く。あんたの所、鍛冶の手が要るだろ。", "ルッツには、この小屋の火を見させる。後輩、行くよ。"], "アンネリーゼ", 3),
          ...anneliseFort.map(c => ({ ...c, indent: c.indent + 2 })),
          end(3),
          orElse(2),
          ...say(["……あいつ、残るってさ。元気だって。", "いいさ。あたいは砦で鉄を打つ。あいつが来たら、すぐ分かるように。"], "アンネリーゼ", 3),
          ...anneliseFort.map(c => ({ ...c, indent: c.indent + 2 })),
          end(3),
          endIf(2), end(2),
          endIf(1), end(1),
          endIf(0), end(0),
        ] },
        { conditions: { selfSwitchCh: "A", selfSwitchValid: true }, priorityType: 0, list: [end(0)] },
      ],
    },
    {
      name: "ルッツ（鍛冶小屋）", type: "raw", x: 54, y: 20, note: "",
      pages: [
        { priorityType: 0, list: [end(0)] },
        { conditions: { switch1Id: SW.brotherHome, switch1Valid: true }, image: body("People3", 2, 2), priorityType: 1, list: [
          ifSwitch(SW.annelise),
          ...say(["姉ちゃんは砦に行った。おれは、この小屋の火を見てる。", "絶やしたら殴られるし。薪は、あと三日分だけど。"], "ルッツ", 1), end(1),
          orElse(0),
          ...say(["姉ちゃんに殴られた。一発だけ。……帰ってきて、よかったけど。"], "ルッツ", 1), end(1),
          endIf(0), end(0),
        ] },
      ],
    },
    // 見張り台・北東の家
    look("見張り台の外壁", 12, 7, ["外壁の板が、内側から黒く焦げている。", "屋根の上で、何かを燃やした跡らしい。"]),
    look("打ち付けた戸", 60, 9, ["戸は内側から打ち付けてある。表に、拳ほどの凹みが三つ。"]),
    // 倒れた梁（トゥーラ）
    {
      name: "倒れた梁（トゥーラ）", type: "raw", x: 55, y: 40, note: "",
      pages: [
        { image: { tileId: "B:164" }, priorityType: 1, list: [
          ifActor(11),
          ...say(["トゥーラが梁の下に肩を入れた。"], "", 1),
          ...say(["どいてな、兄貴。……よっ、と！"], "トゥーラ", 1),
          se("Push", 1), selfOn("A", 1), end(1),
          orElse(0),
          ...say(["焼けた梁が倒れて、倉の戸口を塞いでいる。", "一人では動かない。もっと力のある者なら。"], "", 1), end(1),
          endIf(0), end(0),
        ] },
        { conditions: { selfSwitchCh: "A", selfSwitchValid: true }, priorityType: 0, list: [end(0)] },
      ],
    },
    look("倉の札", 58, 37, ["樽に札。「祠の分」「村の分」。", "祠の分の樽だけ、封が切られていない。"]),
    // 墓地
    thought("R2-09", "墓掘り", 46, 41, [
      "ここに埋まってるのは、くじで白を引いた者ばかりだ。",
      "黒を引いた者は、祠から戻らん。掘る手間もない。",
      "村が焼けた夜は、掘る者がいなかった。鍬は、三本とも倉にある。",
    ], { image: body("Damage2", 4, 2) }),
    look("名のある墓", 41, 39, ["墓標の名の下に、「くじ　白」と刻んである。"]),
    look("名のある墓", 51, 43, ["墓標の名の下に、「くじ　白」。隣も、その隣も。"]),
    // 焼けた家
    look("焼けた鍋", 16, 22, ["かまどに鍋が掛かったまま。鍋の底に、焦げた麦。"]),
    look("並んだ寝台の跡", 7, 22, ["寝台の跡が五つ。一つだけ、藁が新しい。"]),
    // 宝箱
    chest(16, 12, "item", ITEM.herb, 2),
    chest(24, 40, "item", ITEM.antidote, 2),
    chest(61, 39, "gold", 0, 60),
    chest(63, 41, "item", ITEM.elixir, 1),
    chest(47, 4, "item", ITEM.holyWater, 2),
    chest(4, 40, "weapon", WEAPON.hunterSpear, 1, { red: true }),
    // 敵
    enemy("灰鼬（緑）", 10, 30, TROOP.weasels, "green", body("Monster", 0)),
    enemy("灰鼬（緑）", 25, 29, TROOP.weasels, "green", body("Monster", 0)),
    enemy("煤けた鴉（黄・往復）", 30, 22, TROOP.crow, "yellow", body("Nature", 2), { route: patrol("right", 10) }),
    enemy("焼け跡の番犬（黄）", 60, 25, TROOP.scorchDog, "yellow", body("Monster", 3)),
    enemy("祠へ歩く者（黄）", 21, 19, TROOP.walker, "yellow", body("Evil", 6), { route: patrol("down", 7), speed: 2, hesitate: true }),
    enemy("祠へ歩く者（黄）", 44, 37, TROOP.walker, "yellow", body("Evil", 6), { speed: 2, hesitate: true }),
    enemy("使徒狩りの亡骸（赤・畑の番）", 50, 6, TROOP.hunterCorpse, "red", body("Evil", 2, 2), { type: 0, chase: 2 }),
  ];
  config("w8_061_village_square", {
    _説明: "W8（#155）：焼けた村・広場（docs/world.md 5.1・5.2・6.4・7.3）。南の道→060、見張り台の戸→062、祠の坂の上の戸口→063、水路の石段→070（W9）。アンネリーゼと弟の筋、ノラの記憶 3（触れ書き）、倒れた梁（トゥーラ）の先の倉、生け垣の奥の見えない通路の先（使徒狩りの投げ槍）。",
    mapId: 61, name: "焼けた村・広場", displayName: "焼けた村", ...VILLAGE_BASE,
    chars: {},
    scatter: [
      { on: ".", z: 1, tiles: ["A2:15"], rate: 0.08, seed: 610 },
      { on: ".", tiles: ["B:171", "B:239", "B:252", "D:32", "B:152", "B:153"], rate: 0.14, seed: 611 },
      { on: ",", tiles: ["B:152", "B:153", "B:239", "B:160"], rate: 0.2, seed: 612 },
      { on: ";", tiles: ["D:32", "D:33", "B:252"], rate: 0.12, seed: 613 },
      { on: ":", tiles: ["B:171", "D:32", "D:33"], rate: 0.08, seed: 614 },
      { on: "^", tiles: ["B:239", "B:171"], rate: 0.1, seed: 615 },
    ],
    events,
  });
}

// ===========================================================================
// 062 村の見張り台
// ===========================================================================
{
  const events = [
    ...[12, 13, 14].map(x => transfer("下り口（村の広場へ）", x, 16, ARRIVE.squareTower, "down")),
    remains(6, "ノラ", 13, 6, [
      "薪の山の前に、犬の耳の娘が座っている。",
      "手に、火打ち石を握ったまま。",
      "村の方ではなく、山の方を向いている。",
    ], [
      "上がった！　火、上がったよ！",
      "これで、村へ帰る道が見える。",
      "あれ。足、動かないや。",
      "こっちは山の方だ。村は、背中の方。",
      "振り向けないや。でも、火は上がった。",
    ], body("Damage1", 7, 8)),
    faint("F06", "伝令の子", 16, 11, [
      "見張り台から村の門まで、墓守と駆けっこをした。",
      "墓守は途中で転んだ。転ぶと決めてあった転び方だった。",
      "ぼくが勝った。賭けは、干し杏が三つ。",
      "墓守は四つくれた。一つは数え間違いだと言った。",
    ]),
    thought("R2-10", "夜番の年寄り", 6, 11, [
      "見張り台の火は、村へ戻る者の目印だ。そういう決まりだった。",
      "戻る者がいなくなって、誰も上げなくなった。薪だけは、十年分積んである。",
      "あの晩、誰かが上げた。わしは寝床で、見なかったことにした。",
    ], { image: body("Damage2", 0, 6) }),
    look("薪の山", 11, 5, ["薪の山の上半分だけが燃えて、炭になっている。"]),
    look("北の眺め", 9, 5, ["柵の向こうに、灰をかぶった谷。", "谷の先の山の上に、塔の影が一つ。"]),
    {
      name: "屋根の梁（鉤綱で上る）", type: "raw", x: 19, y: 8, note: "",
      pages: [
        { priorityType: 1, list: [
          ifSwitch(FLAG.grapple),
          ...say(["鉤綱を梁に掛けて上った。梁に、煤けた外套が掛かっている。"], "", 1), se("Move3", 1),
          ...give("armor", ARMOR.watchCloak, 1, 1), selfOn("A", 1), end(1),
          orElse(0),
          ...say(["見張り台の屋根の梁に、外套が引っかかっている。", "綱を掛ければ、上れそうだ。"], "", 1), end(1),
          endIf(0), end(0),
        ] },
        { conditions: { selfSwitchCh: "A", selfSwitchValid: true }, priorityType: 1, list: [...say(["梁には、もう何も掛かっていない。"]), end(0)] },
      ],
    },
    chest(5, 6, "item", ITEM.antidote, 1),
  ];
  config("w8_062_watchtower", {
    _説明: "W8（#155）：村の見張り台の上（docs/world.md 6.3・6.4・6.5）。ノラの遺骸と記憶 4、薄い思念 F06 伝令の子、屋根の梁（鉤綱。スイッチ 312）の外套。",
    mapId: 62, name: "村の見張り台", displayName: "村の見張り台", ...VILLAGE_BASE,
    chars: { "^": { name: "屋根の梁（段差B（土）の上面。鉤綱で上る）", ledge: { top: "A4:37", side: "A4:45", height: 1 } } },
    scatter: [{ on: ";", tiles: ["D:32", "D:33", "B:252", "B:171"], rate: 0.12, seed: 620 }],
    events,
  });
}

// ===========================================================================
// 063 村の祠（ボス 生贄の祠の番）
// ===========================================================================
{
  const bossFight = [
    ...say(["戸の前に、灰色の肩布の大きな影が立っている。", "手に帳面。指が、行を一つずつ辿っている。"]),
    ...say(["差し出す者を、逃がすな。名は、揃っている。"], "生贄の祠の番"),
    ...plugin("Hai_Boss", "bossBattle", "ボス戦", { troopId: String(TROOP.shrineWarden), escapeMapId: String(MAP.shrine), escapeX: "13", escapeY: "15", escapeDirection: "2" }),
    ifScript("Hai.Boss.lastResult() === 0"),
    ...say(["祠の番は、帳面の上に覆いかぶさるように崩れた。", "灰の中に、肩布が一枚残った。"], "", 1),
    se("Item1", 1), ...give("armor", ARMOR.ashShawl, 1, 1),
    ...say(["奥の戸の閂が、外れて落ちた。"], "", 1),
    end(1),
    endIf(0), end(0),
  ];
  const events = [
    transfer("南の戸口（村の広場へ）", 13, 18, ARRIVE.squareShrine, "down"),
    transfer("南の戸口（村の広場へ）", 14, 18, ARRIVE.squareShrine, "down"),
    doorTo("西の戸（荷運びの抜け道へ）", 4, 10, ARRIVE.tunnelWest, "right"),
    {
      name: "生贄の祠の番", type: "raw", x: 13, y: 5, note: "",
      pages: [
        { image: body("Evil", 1, 2), priorityType: 1, list: bossFight },
        { conditions: { switch1Id: SW.shrineBoss, switch1Valid: true }, priorityType: 0, list: [end(0)] },
      ],
    },
    {
      name: "奥の戸（記録院へ）", type: "raw", x: 13, y: 3, note: "",
      pages: [
        { image: IMG.door, priorityType: 1, trigger: 0, walkAnime: false, list: [...say(["戸には閂が掛かっている。閂は、戸の外側にだけある。"]), end(0)] },
        { conditions: { switch1Id: SW.shrineBoss, switch1Valid: true }, image: IMG.doorOpen, priorityType: 1, trigger: 1, walkAnime: false,
          list: [se("Door1"), move(...ARRIVE.courtSouth, DIR.up), end(0)] },
      ],
    },
    pickup("生贄の帳面", 18, 6, "item", ITEM.sacrificeLedger, ["台の上に、灰で黒くなった帳面がある。", "一行に一つずつ、くじの月と、家と、「済」の印。"], {
      image: { tileId: "E:194" },
      after: note("生贄の帳面に、済の印が無い行が一つある（村の祠）", "clue:w8:ledger"),
    }),
    memory(6, 2, "ノラ", 17, 6, [
      "くじの棒、先が黒かった。あたしの手の中で。",
      "祠守りが帳面に書いて、読み上げた。母さんは何も言わなかった。",
      "その夜、窓の桟を蹴った。桟は一度で外れた。",
      "前の年に誰かが外して、釘を打ち直した跡があった。",
    ]),
    pickup("祠の経典", 9, 5, "item", ITEM.scripture, ["祭壇に、角の黒く光る経典が開いたまま置いてある。", "開いた頁に「大いなる安らぎの夜。門は内から開かれた」。"], { image: { tileId: "E:193" } }),
    thought("R2-11", "代わりに来た娘", 8, 12, [
      "おねえちゃんの代わりだって。",
      "何の代わりなのか、だれも言わない。",
      "祠のおじさんは、ずっと帳面を見てた。あたしの名前は、まだ書いてなかった。",
    ], { image: body("Damage1", 6, 8) }),
    thought("R2-12", "祠守り", 19, 12, [
      "一人出せば、村が残る。帳面の名は、その勘定だ。",
      "勘定は、わしが付けた。名を書くのも、読み上げるのも、わしだ。",
      "わしの娘の名は、帳面に無い。棒を配るのは、わしの役だった。",
    ], { image: body("Damage2", 3, 4) }),
    look("戸の閂の受け", 15, 4, ["奥の戸の脇に、閂の受け金が打ってある。外側にだけ。"]),
    chest(6, 14, "item", ITEM.holyWater, 1),
  ];
  config("w8_063_shrine", {
    _説明: "W8（#155）：村の祠（docs/world.md 2.3・5.5・6.4）。ボス 生贄の祠の番（弱み：生贄の帳面の最後の名。帳面を持って挑むと戦いの頭に見せる）、祠の経典、ノラの記憶 2、奥の戸→080 記録院（ボスのあと）、西の戸→064。",
    mapId: 63, name: "村の祠", displayName: "村の祠", ...SHRINE_BASE,
    note: "<hai_tone:-34,-51,-51,85>",
    chars: { ",": { name: "祭壇の前の段（石畳。床の汚れ）", as: ".", tiles: [null, "A2:15"] } },
    scatter: [{ on: ".", tiles: ["B:32", "B:33"], rate: 0.08, seed: 630 }],
    events,
  });
}

// ===========================================================================
// 064 荷運びの抜け道（H22：村 → 営倉）
// ===========================================================================
{
  const h22 = y => ({
    name: "閂の戸（営倉へ。H22）", type: "raw", x: 43, y, note: "",
    pages: [
      { image: IMG.wallDoor, priorityType: 1, trigger: 0, walkAnime: false, list: [
        ...say(["突き当たりに、内から閂を掛けた戸がある。", "閂には、営倉の焼き印。"]),
        choice(["閂を外す", "やめる"], 1),
        when(0, "閂を外す"), se("Open2", 1), swOn(SW.h22, 1),
        ...say(["閂を外した。戸の向こうは、石の房の並ぶ廊下だ。"], "", 1), end(1),
        when(1, "やめる"), end(1),
        choiceEnd(0), end(0),
      ] },
      { conditions: { switch1Id: SW.h22, switch1Valid: true }, image: IMG.wallDoorOpen, priorityType: 1, trigger: 1, walkAnime: false,
        list: [se("Move1"), move(...AT.cells, DIR.right), end(0)] },
    ],
  });
  const events = [
    transfer("上り階段（村の祠へ）", 1, 6, ARRIVE.shrineFromTunnel, "right"),
    h22(6), h22(7),
    thought("R2-13", "荷車引き", 13, 5, [
      "祠の分の荷を、この道で営倉へ運んだ。袋は八つ、と言われた。",
      "荷台で、一つだけ重さが違った。中は、見なかった。",
      "営倉の兵は、七つを倉に入れた。一つは、房の方へ。",
      "帰りの荷台には、空の袋が七つ。",
    ], { image: body("Damage2", 1, 2) }),
    look("荷札", 11, 5, ["木箱に荷札。「麦　祠より　営倉へ　八」。", "八の横に、別の手で「うち一、九番」。"]),
    look("轍", 12, 8, ["床石に、荷車の轍が深く刻まれている。東へ続く。"]),
    pickup("油の壺", 33, 10, "item", ITEM.oil, ["待避所の隅に、口を縛った油の壺。"], { image: { tileId: "B:223" } }),
    chest(34, 11, "item", ITEM.bitterRoot, 2),
    enemy("灰鼬（緑・往復）", 20, 10, TROOP.weasels, "green", body("Monster", 0), { route: patrol("right", 6) }),
    enemy("祠へ歩く者（黄）", 36, 6, TROOP.walker, "yellow", body("Evil", 6), { speed: 2, hesitate: true }),
  ];
  config("w8_064_tunnel", {
    _説明: "W8（#155）：荷運びの抜け道（docs/world.md 5.2・H22）。西の上り階段→063、東の閂の戸→033 営倉・監房（H22。スイッチ 404 で開く。033 の側の戸も同じスイッチ）。",
    mapId: 64, name: "荷運びの抜け道", displayName: "荷運びの抜け道", ...SHRINE_BASE,
    note: "<hai_tone:-68,-68,-51,85>\n<hai_dark:4>",
    bgm: { name: "Dungeon7", volume: 60, pitch: 100, pan: 0 }, bgs: { name: "Drips", volume: 35, pitch: 100, pan: 0 },
    fields: { specifyBattleback: true, battleback1Name: "Stone1", battleback2Name: "Stone1" },
    chars: {},
    scatter: [{ on: ",", tiles: ["B:32", "B:33"], rate: 0.1, seed: 640 }],
    events,
  });
}

// ===========================================================================
// 023 森の療養小屋（W7 の帯のマップ。地域二の中身なので W8 が作る。形は前の世界の看取りの小屋のまま）
// ===========================================================================
{
  const events = [
    ...[6, 7, 8].map(y => transfer("西の林（古い礼拝堂へ）", 0, y, AT.chapelFromHospice, "left")),
    {
      name: "ピピネル", type: "raw", x: 18, y: 6, note: "",
      pages: [
        { image: body("People1", 5, 2), priorityType: 1, list: [
          ...say(["おや、人の子かえ。婆の小屋に客とは、珍しいのう。", "婆はピピネルじゃ。見た目で笑うたら、薬に苦い根を足すぞ。"], "ピピネル"),
          ...say(["熱の薬、傷の薬、眠る薬。たいていの薬は、ここで煎じられる。", "森の内へ戻る薬は、無い。門が閉じてからずっと、無い。"], "ピピネル"),
          ...say(["砦の炉に火が入ったと？　……ほう。火の入る所には、怪我人が出る。", "行ってやろう。薬草の籠を背負うてな。帳面は、置いていく。"], "ピピネル"),
          ...toFort(SW.pipinel, "infirmary"),
          ...say(["ピピネルは籠を背負って、森の道を砦の方へ歩いていった。"]),
          end(0),
        ] },
        { conditions: { selfSwitchCh: "A", selfSwitchValid: true }, priorityType: 0, list: [end(0)] },
      ],
    },
    pickup("療養小屋の帳面", 17, 4, "item", ITEM.hospiceLedger, ["薬棚の下に、紐で綴じた帳面がある。", "表紙に、木の葉を三枚重ねた印。"], { image: { tileId: "D:185" } }),
    thought("R2-14", "熱の下がらない男", 16, 7, [
      "ここで寝てた。熱が下がったら、帰っていいと言われた。",
      "帰る村は焼けたと、通りがかりの者に聞いた。",
      "下がらないふりをした。婆さまは何も言わずに、薬を倍にした。",
    ], { image: body("Damage1", 1, 4) }),
    {
      name: "湧き水", type: "raw", x: 3, y: 10, note: "",
      pages: [{ image: { tileId: "B:146" }, priorityType: 1, list: [
        ...say(["岩の割れ目から、冷たい水が湧いている。", "手ですくって飲んだ。"]),
        se("Recovery"), { code: 314, indent: 0, parameters: [0, 0] },
        ...say(["体の重さが、少し抜けた。"]), end(0),
      ] }],
    },
    pickup("薬草", 7, 6, "item", ITEM.herb, ["枯れた畝の中に、まだ青い葉が残っている。"], { n: 2 }),
    pickup("苦根", 11, 8, "item", ITEM.bitterRoot, ["畝の端に、太い根が掘りかけのまま。"]),
    look("小屋の裏の小石", 24, 6, ["小石が積んである。数えると、帳面の印の無い名と同じ数。"]),
    look("寝台", 16, 5, ["寝台の藁は干したばかり。誰も寝ていない。"]),
  ];
  config("w8_023_hospice", {
    _説明: "W8（#155）：森の療養小屋（docs/world.md 5.2・7.1）。ピピネル（話すと砦へ。スイッチ 411・生き残りの数）、療養小屋の帳面、湧き水（全回復）。西の林→021（W7 の東の白い花の先）。",
    mapId: 23, name: "森の療養小屋", displayName: "森の療養小屋",
    legend: "forest", tilesetId: 12,
    note: "<hai_tone:0,-9,-17,68>\n<hai_fog:60>",
    bgm: { name: "Scene4", volume: 55, pitch: 100, pan: 0 }, bgs: { name: "Wind1", volume: 25, pitch: 100, pan: 0 },
    fields: { specifyBattleback: true, battleback1Name: "Grassland", battleback2Name: "Forest" },
    chars: {
      e: { name: "西の林（場所移動のマス）", as: "." },
      W: { name: "小屋の壁（建物E（土壁））", wall: { top: "A4:20", side: "A4:28", height: 1 } },
      h: { name: "枯れた薬草の畝（通れる）", as: ".", tiles: [null, null, "B:239"] },
      s: { name: "湧き水（イベント）", as: "." },
      B: { name: "粗末な寝台（通れない）", as: "#", tiles: [null, null, "E:150"] },
    },
    deco: {
      i: { name: "桶（通れない）", z2: "B:145" }, z: { name: "壺（通れない）", z2: "B:144" }, v: { name: "樽（通れない）", z2: "B:141" },
      H: { name: "干し草（通れない）", z2: "B:248" }, k: { name: "草A（通れる）", z2: "B:152" }, f: { name: "花（通れる）", z2: "B:160" },
      s: { name: "小石（通れる）", z2: "B:171" }, w: { name: "薪（通れない）", z2: "B:170" }, L: { name: "落ち葉（通れる）", z2: "B:252" },
    },
    scatter: [{ on: ".", tiles: ["B:152", "B:153", "B:160", "B:171", "B:252"], rate: 0.12, seed: 230 }],
    events,
  });
}

// ===========================================================================
// 080 記録院・前庭
// ===========================================================================
{
  const ismeneFort = indent => [
    ...say(["学者の声が止んだのですね。記録します。", "書架の番は、ほかの誰かにも。……いいえ。誰もいません。二百年、いません。"], "イスメネ", indent),
    ...say(["砦に書庫があるなら、そこも書架です。", "行きます。記録は、持てるだけ持って。三冊です。"], "イスメネ", indent),
    ...toFort(SW.ismene, "lore", indent),
    ...say(["イスメネは本を三冊抱えて、南の戸口から出ていった。"], "", indent),
  ];
  const events = [
    ...[18, 19, 20, 21].map(x => transfer("南の戸口（村の祠へ）", x, 29, ARRIVE.shrineBack, "down")),
    ...[18, 19, 20, 21].map(x => transfer("北の廊下（書架へ）", x, 0, [MAP.stacks, x + 10, 42], "up")),
    warp("記録院の前庭", 12, 23),
    {
      name: "イスメネ", type: "raw", x: 24, y: 17, note: "",
      pages: [
        { image: body("People1", 3, 2), priorityType: 1, list: [
          ifSwitch(SW.scholarBoss),
          ifItem(ITEM.twoCopies, 1),
          ifVar(VAR.copies, 1, 0, 2),
          ...say(["その二冊。……封じた書架の、写しですね。"], "イスメネ", 3),
          choice(["写しを返す", "まだ持っている"], 1, 3),
          when(0, "写しを返す", 3),
          { code: 126, indent: 4, parameters: [ITEM.twoCopies, 1, 0, 1] },
          varSet(VAR.copies, 2, 4),
          ...say(["受け取りました。記録します。", "どちらが本物かは、書きません。分からないので。まだ。"], "イスメネ", 4),
          ...errandEnd({ key: "copies", result: "done", text: "二通りの写しはイスメネの書架に戻った" }, 4),
          end(4),
          when(1, "まだ持っている", 3), end(4),
          choiceEnd(3), end(3),
          endIf(2), end(2),
          endIf(1),
          ...ismeneFort(1), end(1),
          orElse(0),
          ifVar(VAR.copies, 0, 0, 1),
          ...say(["あなた、記録にない方です。記録します。", "わたしはイスメネ。ここの書庫番です。受付の帳面は、毎朝わたしが書きます。"], "イスメネ", 2),
          ...say(["奥の書架は封じてあります。封じた人の名は、記録にあります。本人はいません。", "その奥の真名の間に、学者が一人。まだ読んでいます。読んでいる、と記録にあります。"], "イスメネ", 2),
          ...say(["一つ、頼めますか。奥に、銘の写しが二通りあるはずです。", "どちらが本物か、わたしは知りません。まだ。見つけたら、見せてください。"], "イスメネ", 2),
          varSet(VAR.copies, 1, 2),
          ...errand({ key: "copies", title: "本物の写し", who: "イスメネ", stage: "1", variableId: "163", text: "記録院の奥の二通りの写しを、イスメネに見せる" }, 2),
          end(2),
          orElse(1),
          ...say(["真名の間の学者は、まだ読んでいます。", "封じた書架に、札が掛かっているはずです。読んでから行ってください。"], "イスメネ", 2), end(2),
          endIf(1), end(1),
          endIf(0), end(0),
        ] },
        { conditions: { selfSwitchCh: "A", selfSwitchValid: true }, priorityType: 0, list: [end(0)] },
      ],
    },
    memory(7, 1, "ディル", 4, 8, [
      ["港の倉の裏に、濡れて捨てられた本が積んであった。", "字はそれで覚えた。勘定は、荷札で覚えた。"],
      ["記録院の門で、一枚書いてみろと言われた。書いたら、入れた。", "それだけの話だよ。泣ける所は無い。"],
    ], { tileId: "E:194" }),
    thought("R2-15", "前の書庫番", 8, 10, [
      "古言の棚の目録は、私が作りました。棚は三つ。目録は一枚です。",
      "題だけを書きました。中の音は写しませんでした。写した者が前に二人、欠けましたので。",
      "書架は年ごとに重くなりました。目録は、一枚のままです。",
    ], { image: body("Damage2", 3, 2) }),
    thought("R2-16", "教会の使い", 29, 23, [
      "教会の使いだ。銘の写しを受け取りに来た。",
      "三日待てと言われた。二日目に、催促の手紙を書いた。",
      "急がせた方が早く出来る。そう教わっていた。",
    ], { image: body("Damage1", 3, 8) }),
    {
      name: "古言の碑の扉（ディル）", type: "raw", x: 33, y: 20, note: "",
      pages: [
        { image: { tileId: "B:66" }, priorityType: 1, list: [
          ifActor(7),
          ...say(["石の扉に、人の字でない線が刻んである。脇に、片仮名で短い音が三つ。"], "", 1),
          ...say(["……読めるよ。読むだけならな。", "訳？　しない。訳すと、あんたも欠けるだろ。"], "ディル", 1),
          ...say(["ディルが一行を、声に出さずに唇で辿った。石の扉が横へ滑った。"], "", 1),
          se("Open5", 1), swOn(SW.runeDoor, 1), end(1),
          orElse(0),
          ...say(["石の扉に、人の字でない線が刻んである。脇に、片仮名で短い音が三つ。", "三つ目の音は削ってある。その下に「声に出すな」。読める者なら、開け方が分かりそうだ。"], "", 1), end(1),
          endIf(0), end(0),
        ] },
        { conditions: { switch1Id: SW.runeDoor, switch1Valid: true }, priorityType: 0, list: [end(0)] },
      ],
    },
    chest(35, 18, "item", ITEM.elixir, 1),
    chest(36, 21, "item", ITEM.holyWater, 2),
    thought("R2-17", "扉を閉めた写字生", 35, 22, [
      "この部屋の扉は、古言で閉める。開けられる者は、院に三人。",
      "三人とも、写しの仕事で手が離せなかった。",
      "だから、ここに入れた物は、誰も出していない。",
    ], { image: body("Damage1", 0, 2) }),
    look("受付の机", 23, 16, ["机の上に、来た人の名を書く帳面。今の日付の行に、一つだけ名がある。"]),
    look("書見台", 10, 22, ["書見台に、開いたままの本。頁の端に、指で付けた折り目が並ぶ。"]),
    look("女神の像", 19, 20, ["像の台座に「記す者は、忘れぬ者」。", "その下に、小さく削った跡。"]),
    look("閲覧の札", 3, 5, ["札に「声に出して読むこと、これを禁ず」。"]),
    chest(5, 14, "item", ITEM.mossAsh, 2),
    chest(14, 8, "gold", 0, 40),
    enemy("紙魚（緑）", 26, 9, TROOP.bookworms, "green", body("Monster", 6)),
    enemy("インクの影（緑・往復）", 13, 19, TROOP.inkShades, "green", body("Evil", 0), { route: patrol("down", 5) }),
  ];
  config("w8_080_archive_court", {
    _説明: "W8（#155）：記録院・前庭（docs/world.md 5.1・6.4・7.1・7.3）。イスメネ（真名を読んだ学者を越えたあとに話すと砦へ。書庫を開く。頼み「本物の写し」）、ディルの記憶 1、古言の碑の扉（ディル）、南→063、北→081。",
    mapId: 80, name: "記録院・前庭", displayName: "記録院", ...LIBRARY_BASE,
    note: "<hai_tone:17,0,-34,68>",
    bgm: { name: "Castle1", volume: 55, pitch: 100, pan: 0 }, bgs: { name: "Clock", volume: 30, pitch: 100, pan: 0 },
    fields: ARCHIVE_BG("DecorativeTile1", "Room2"),
    chars: {},
    scatter: [{ on: ".", tiles: ["B:32", "B:33"], rate: 0.08, seed: 800 }, { on: ",", tiles: ["B:32", "B:33"], rate: 0.08, seed: 801 }],
    events,
  });
}

// ===========================================================================
// 081 記録院・書架
// ===========================================================================
{
  const lockDoor = {
    name: "封じた書架の錠の戸", type: "raw", x: 30, y: 3, note: "",
    pages: [
      { image: { characterName: "!Door2", characterIndex: 0, direction: 2, pattern: 0 }, priorityType: 1, trigger: 0, walkAnime: false, list: [
        ...say(["鉄の戸に、数を三つ合わせる錠が付いている。"]),
        choice(["数を合わせる", "やめる"], 1),
        when(0, "数を合わせる"),
        { code: 103, indent: 1, parameters: [VAR.lockAnswer, 3] },
        ifVar(VAR.lockAnswer, 429, 0, 1),
        se("Key", 2), swOn(SW.lock, 2), ...say(["錠が外れた。戸の向こうは、灯の無い書架だ。"], "", 2), end(2),
        orElse(1),
        se("Buzzer1", 2), ...say(["錠は動かない。"], "", 2), end(2),
        endIf(1), end(1),
        when(1, "やめる"), end(1),
        choiceEnd(0), end(0),
      ] },
      { conditions: { switch1Id: SW.lock, switch1Valid: true }, image: { characterName: "!Door2", characterIndex: 0, direction: 8, pattern: 0 }, priorityType: 1, trigger: 1, walkAnime: false,
        list: [se("Door1"), move(...ARRIVE.sealedSouth, DIR.up), end(0)] },
    ],
  };
  const events = [
    ...[28, 29, 30, 31].map(x => transfer("南の廊下（前庭へ）", x, 44, [MAP.court, x - 10, 3], "down")),
    lockDoor,
    // 西の写字室
    memory(7, 2, "ディル", 11, 5, [
      ["学者の書いたものを、清書するのが俺の仕事だった。", "ある頃から、学者の字が大きくなりだした。一頁に一字とか。"],
      ["俺はそれも清書した。一頁に一字。きれいにな。", "清書しなきゃよかったかって？　知らないよ。"],
    ], { tileId: "E:194" }),
    pickup("写しの台帳", 6, 9, "item", ITEM.copyRegister, ["写字台の上に、厚い台帳が開いている。", "同じ日付の行が、二つ並んでいる。"], { image: { tileId: "E:193" } }),
    thought("R2-18", "写字室の同輩", 9, 11, [
      "二冊のうち一冊を、使いに渡したのは私です。急かされましたので。",
      "机の上に置いてあった方を渡しました。ディルは、その夜も写していました。",
      "どちらを渡したか、覚えていません。渡した日の数は、覚えています。",
      "封じた書架の錠は、その数です。四、二、九。",
    ], { clue: ["封じた書架の錠は 4・2・9（記録院の写字室）"], image: body("Damage1", 0, 8) }),
    look("写字台の書き付け", 4, 9, ["紙切れに「封じた書架　錠は渡した日の数。声に出さぬこと」。"]),
    // 東の閲覧の小部屋
    pickup("鐘の古い記録", 52, 8, "item", ITEM.bellRecord, ["机の上の箱に、古い綴りが一冊。", "表紙に「鋳造の記」。"], { image: { tileId: "E:193" } }),
    thought("R2-19", "鐘の記録を写した老学者", 49, 11, [
      "鋳造の記を写した。歌い手の名を書く欄で、筆が止まった。",
      "森の人は、名を書くなと言った。歌が別の物になるからと。",
      "欄は空けた。訳の欄も、三度書いて三度消した。",
    ], { image: body("Damage2", 4, 2) }),
    // 迷路
    thought("R2-20", "迷った見習い", 33, 23, [
      "書架の並びは、目録の順だと聞いた。目録は燃えた。",
      "だから壁に手をついて歩けと、先輩が言った。",
      "先輩も、手をついて歩いてた。",
    ], { image: body("Damage1", 1, 6) }),
    look("焼けた書架", 51, 24, ["書架の半分が焦げている。焦げた所の本だけ、題が削ってある。"]),
    look("南の間の掲示", 25, 35, ["掲示に「奥の書架、封鎖。院長の許しなき者、入るべからず」。", "院長の名の所が、空いている。"]),
    // 南西の隠し扉の先
    chest(3, 40, "armor", ARMOR.sealRing, 1, { red: true }),
    chest(4, 41, "item", ITEM.elixir, 1),
    // 宝箱
    chest(55, 12, "item", ITEM.holyWater, 1),
    chest(3, 13, "item", ITEM.salve, 2),
    chest(42, 31, "gold", 0, 50),
    chest(37, 5, "item", ITEM.smelling, 2),
    chest(51, 34, "item", ITEM.antidote, 2),
    // 敵
    enemy("紙魚（緑）", 24, 38, TROOP.bookworms, "green", body("Monster", 6)),
    enemy("インクの影（緑）", 20, 25, TROOP.inkShades, "green", body("Evil", 0)),
    enemy("黙読者（黄・往復）", 30, 6, TROOP.silentReader, "yellow", body("Evil", 7), { route: patrol("right", 8), hesitate: true }),
    enemy("写字の手（黄）", 8, 25, TROOP.copyist, "yellow", body("Evil", 3), { route: patrol("down", 6) }),
    enemy("写字の手（黄）", 51, 22, TROOP.copyist, "yellow", body("Evil", 3), { route: patrol("down", 6) }),
    enemy("黙読者（黄）", 40, 17, TROOP.silentReader, "yellow", body("Evil", 7), { hesitate: true }),
    enemy("書架の番人（赤）", 23, 28, TROOP.shelfWarden, "red", body("Evil", 5), { type: 0, chase: 2 }),
    enemy("紙魚（緑）", 48, 10, TROOP.bookworms, "green", body("Monster", 6)),
  ];
  config("w8_081_archive_stacks", {
    _説明: "W8（#155）：記録院・書架（docs/world.md 5.2・6.4・mapdesign 8 章の番号錠）。書架の迷路と輪、写字室（ディルの記憶 2・写しの台帳・錠の数の手がかり 2 本）、閲覧の小部屋（鐘の古い記録）、北の錠の戸（429）→082、南→080、南西の隠し扉の先の赤い宝箱（封蝋の指輪）。",
    mapId: 81, name: "記録院・書架", displayName: "記録院", ...LIBRARY_BASE,
    note: "<hai_tone:17,0,-34,68>",
    bgm: { name: "Castle1", volume: 55, pitch: 100, pan: 0 }, bgs: { name: "Clock", volume: 30, pitch: 100, pan: 0 },
    fields: ARCHIVE_BG("DecorativeTile1", "Room2"),
    chars: {},
    scatter: [
      { on: ".", tiles: ["B:32", "B:33"], rate: 0.08, seed: 810 },
      { on: ";", tiles: ["B:32", "B:33", "B:120"], rate: 0.08, seed: 811, solid: true },
      { on: ",", tiles: ["B:32", "B:33"], rate: 0.08, seed: 812 },
    ],
    events,
  });
}

// ===========================================================================
// 082 封じた書架（暗がり。H31）
// ===========================================================================
{
  const h31 = {
    name: "帳面の棚の裏の戸（納骨所へ。H31）", type: "raw", x: 6, y: 13, note: "",
    pages: [
      { image: IMG.wallDoor, priorityType: 1, trigger: 0, walkAnime: false, list: [
        ...say(["棚の裏に、小さな戸が隠れている。閂は、こちら側に掛かっている。", "戸の隙間から、冷たい石の匂い。"]),
        choice(["閂を外す", "やめる"], 1),
        when(0, "閂を外す"), se("Open2", 1), swOn(SW.h31, 1),
        ...say(["閂を外した。細い通り道の先に、棺の並ぶ部屋が見える。"], "", 1), end(1),
        when(1, "やめる"), end(1),
        choiceEnd(0), end(0),
      ] },
      { conditions: { switch1Id: SW.h31, switch1Valid: true }, image: IMG.wallDoorOpen, priorityType: 1, trigger: 1, walkAnime: false,
        list: [se("Move1"), move(...AT.ossuary, DIR.left), end(0)] },
    ],
  };
  const events = [
    ...[19, 20, 21, 22].map(x => transfer("南の戸（書架へ）", x, 29, [MAP.stacks, 30, 4], "down")),
    ...[19, 20, 21].map(x => transfer("北の戸（真名の間へ）", x, 0, ARRIVE.nameSouth, "up")),
    warp("封じた書架", 17, 4),
    {
      name: "角灯の明かり（自動）", type: "raw", x: 1, y: 1, note: "",
      pages: [{ priorityType: 0, trigger: 4, list: [
        ifItem(ITEM.lantern), ...plugin("Hai_MapTone", "dark", "暗がりの半径を変える", { radius: "5" }, 1), end(1), endIf(0),
        { code: 214, indent: 0, parameters: [] }, end(0),
      ] }],
    },
    look("札", 22, 3, ["戸の脇に札が掛けてある。", "「この先の者に、声を出させるな。出させれば、読む」。"]),
    thought("R2-21", "封じた学者", 21, 25, [
      "書架を封じたのは私だ。奥の男を、ここから出さないために。",
      "あれは声に出すと読む。出させなければ、ただの男だ。",
      "札を三枚書いた。釘は二本しか無かった。一枚は、机の上だ。",
    ], { clue: ["真名の間の学者は、声を出させなければ読めないらしい（封じた書架）"], image: body("Damage2", 3, 8) }),
    remains(7, "ディル", 33, 8, [
      "写しの棚の前に、痩せた男が座っている。",
      "胸に、表紙の色の違う写しを二冊抱えている。",
      "膝の上の紙に、書きかけの一行。",
    ], [
      "続きを書く。灯が細い。",
      "外で、鐘が鳴りやんだ。まあいい。",
      "続きを書く。誰が読むか知らないけど。",
      "あと一行だよ。あと一行で、",
    ], body("Damage1", 0, 2)),
    pickup("二通りの写し", 34, 8, "item", ITEM.twoCopies, ["男の腕から、二冊の写しが滑り落ちていた。", "灰色の表紙と、茶色の表紙。"], { image: { tileId: "D:189" } }),
    pickup("学者の手記", 35, 12, "item", ITEM.scholarNotes, ["棚の下に、手記が一冊。後ろの頁ほど字が大きい。"], { image: { tileId: "D:189" } }),
    pickup("刻印の写し", 32, 21, "item", ITEM.sealCopy, ["床に、四つに折った紙。開くと、炭で擦り写した線。"], { image: IMG.glint }),
    thought("R2-22", "読んだ学者", 30, 19, [
      "読めた。口が勝手に動く。止めるには、声を出すな、と札を書く。",
      "書いた。札の字が、私の字ではない。",
      "隣の机の男の字だ。隣の男は、昨日からいない。",
    ], { image: body("Damage2", 3, 6) }),
    h31,
    thought("R2-23", "古い帳面を運んだ下働き", 9, 14, [
      "古い帳面は、ここから砦の下の納骨所へ移せと言われた。",
      "棺の部屋の壁の裏に、通り道がある。",
      "帳面のほうが、棺より大事なんだと。",
    ], { image: body("Damage1", 1, 8) }),
    chest(10, 11, "item", ITEM.elixir, 1),
    chest(35, 22, "item", ITEM.holyWater, 2),
    enemy("黙読者（黄）", 20, 13, TROOP.silentReader, "yellow", body("Evil", 7), { hesitate: true, chase: 3 }),
    enemy("インクの影（緑）", 24, 21, TROOP.inkShades, "green", body("Evil", 0)),
    enemy("インクの影（緑）", 16, 9, TROOP.inkShades, "green", body("Evil", 0)),
  ];
  config("w8_082_sealed_stacks", {
    _説明: "W8（#155）：封じた書架（docs/world.md 2.3・5.5・6.3・6.4・H31）。暗がり 1.5（鐘番の角灯で 5）。ディルの遺骸と記憶 4、二通りの写し・学者の手記・刻印の写し、「声に出させるな」の札（学者の弱み）、帳面の部屋の戸（H31→022。スイッチ 408）、北→083。",
    mapId: 82, name: "封じた書架", displayName: "封じた書架", ...LIBRARY_BASE,
    note: "<hai_tone:-34,-34,-51,68>\n<hai_dark:1.5>",
    bgm: { name: "Dungeon7", volume: 55, pitch: 100, pan: 0 }, bgs: { name: "Darkness", volume: 35, pitch: 100, pan: 0 },
    fields: ARCHIVE_BG("DecorativeTile2", "Room3"),
    chars: {},
    scatter: [{ on: ".", tiles: ["B:32", "B:33"], rate: 0.08, seed: 820 }, { on: ",", tiles: ["B:32", "B:33"], rate: 0.08, seed: 821 }],
    events,
  });
}

// ===========================================================================
// 083 真名の間（ボス 真名を読んだ学者）
// ===========================================================================
{
  const bossFight = [
    ...say(["頁の山の真ん中で、痩せた男が本を開いている。", "唇が、同じ一語の形に動いている。声は、まだ出ていない。"]),
    ...say(["男が顔を上げた。唇は、同じ形のまま動き続けている。"]),
    ...plugin("Hai_Boss", "bossBattle", "ボス戦", { troopId: String(TROOP.scholar), escapeMapId: String(MAP.sealed), escapeX: "20", escapeY: "3", escapeDirection: "2" }),
    ifScript("Hai.Boss.lastResult() === 0"),
    ...say(["学者は開いた本の上に突っ伏した。唇は、まだ少し動いていた。", "本に、革の栞が挟まっている。"], "", 1),
    se("Item1", 1), ...give("armor", ARMOR.bookmark, 1, 1),
    ...say(["北の戸の向こうで、何かが低く唸った。鐘の胴のような音。"], "", 1),
    end(1),
    endIf(0), end(0),
  ];
  const events = [
    transfer("南の戸（封じた書架へ）", 13, 16, ARRIVE.sealedNorth, "down"),
    transfer("南の戸（封じた書架へ）", 14, 16, ARRIVE.sealedNorth, "down"),
    {
      name: "真名を読んだ学者", type: "raw", x: 13, y: 8, note: "",
      pages: [
        { image: body("Evil", 7, 2), priorityType: 1, list: bossFight },
        { conditions: { switch1Id: SW.scholarBoss, switch1Valid: true }, priorityType: 0, list: [end(0)] },
      ],
    },
    {
      name: "北の戸（記録院の鐘の間へ）", type: "raw", x: 13, y: 3, note: "",
      pages: [
        { image: IMG.wallDoor, priorityType: 1, trigger: 0, walkAnime: false, list: [...say(["戸は動かない。部屋の真ん中で、誰かが読み続けている。"]), end(0)] },
        { conditions: { switch1Id: SW.scholarBoss, switch1Valid: true }, image: IMG.wallDoorOpen, priorityType: 1, trigger: 1, walkAnime: false,
          list: [se("Door1"), move(...ARRIVE.bellSouth, DIR.up), end(0)] },
      ],
    },
    thought("R2-24", "読むのをやめた学者", 7, 11, [
      "私は途中で読むのをやめた。三字目で。",
      "隣の男は、やめなかった。",
      "やめた私も、ここから出られなかった。頁は、まだ手の中だ。",
    ], { image: body("Damage2", 3, 2) }),
    look("頁の山", 17, 6, ["頁の山。どの頁にも、同じ一字が大きく書いてある。", "読もうとすると、目が滑る。"]),
  ];
  config("w8_083_name_hall", {
    _説明: "W8（#155）：真名の間（docs/world.md 5.5）。ボス 真名を読んだ学者（弱み：封じた書架の「声に出させるな」の札。沈黙がよく効き、技は魔法）、倒すと北の戸→084。南→082。",
    mapId: 83, name: "真名の間", displayName: "真名の間", ...LIBRARY_BASE,
    note: "<hai_tone:-17,-17,-34,68>",
    bgm: { name: "Dungeon6", volume: 70, pitch: 100, pan: 0 }, bgs: { name: "Darkness", volume: 30, pitch: 100, pan: 0 },
    fields: ARCHIVE_BG("DecorativeTile2", "Room3"),
    chars: {},
    scatter: [{ on: ",", tiles: ["B:32", "B:33"], rate: 0.1, seed: 830 }],
    events,
  });
}

// ===========================================================================
// 084 記録院の鐘の間（記録院の鐘。W11 の山場の置き場所は南の控え）
// ===========================================================================
{
  const ring = [
    { code: 108, indent: 0, parameters: ["W11：3 つ目の場面と山場をここに足す"] },
    { code: 408, indent: 0, parameters: ["（鳴らした数が 3 になったときの主人公の記憶の場面。最後の地域になったときは、控えの門叩きの塊を越えてから）"] },
    ...say(["台座の上に、抱えられるほどの鐘が据えてある。", "鐘の綱が、梁から垂れている。"]),
    choice(["綱を引く", "やめる"], 1),
    when(0, "綱を引く"),
    se("Bell3", 1, 100, 95), { code: 225, indent: 1, parameters: [3, 5, 20, false] }, { code: 224, indent: 1, parameters: [[255, 255, 255, 120], 20, true] },
    { code: 230, indent: 1, parameters: [30] }, se("Bell3", 1, 90, 95), { code: 230, indent: 1, parameters: [40] }, se("Bell3", 1, 80, 90), { code: 230, indent: 1, parameters: [60] },
    ...say(["鐘が鳴る。音が書架の間を抜けて、上へ昇っていく。", "棚という棚で、頁が一枚ずつめくれた。"], "", 1),
    swOn(FLAG.archiveBell, 1), varSet(FLAG.bellCount, 1, 1, 1),
    ifVar(FLAG.bellCount, 4, 1, 1), swOn(FLAG.allBells, 2), end(2), endIf(1),
    selfOn("A", 1),
    ...say(["壁の札掛けに、当番の札が一枚だけ残っている。"], "", 1),
    se("Item3", 1), ...give("item", ITEM.dutyTag, 1, 1),
    end(1),
    when(1, "やめる"), end(1),
    choiceEnd(0), end(0),
  ];
  const events = [
    ...[12, 13, 14].map(x => transfer("南の戸（真名の間へ）", x, 20, ARRIVE.nameNorth, "down")),
    {
      name: "記録院の鐘の綱", type: "raw", x: 13, y: 7, note: "",
      pages: [
        { image: { tileId: "B:6" }, priorityType: 1, list: ring },
        { conditions: { selfSwitchCh: "A", selfSwitchValid: true }, image: { tileId: "B:6" }, priorityType: 1, list: [...say(["鐘は、まだ小さく震えている。"]), end(0)] },
      ],
    },
    look("札掛け", 18, 4, ["札掛けの釘は四本。札の掛かっていた跡が、四つとも同じ色に焼けている。"], { tileId: "B:178" }),
    withThirdScene(thought("R2-25", "記録院の鐘番", 9, 8, [
      "夕べ。頂の鐘、鳴らず。こちらも鳴らさず。札にそう書いた。",
      "書いたあとで、写しの件を思い出した。明朝、と書き足した。",
      "朝は来なかった。札は、釘に掛かったままだ。",
    ], { image: body("Damage2", 5, 8) })),
    {
      name: "帰りの転送陣（砦へ）", type: "raw", x: 17, y: 8, note: "",
      pages: [
        { priorityType: 0, list: [end(0)] },
        { conditions: { switch1Id: FLAG.archiveBell, switch1Valid: true }, image: IMG.warp, priorityType: 0, trigger: 1, stepAnime: true,
          list: [...say(["足もとの輪が、鐘の音の名残で光っている。"]), choice(["砦へ戻る", "やめる"], 1),
            when(0, "砦へ戻る"), se("Teleport", 1), move(...AT.fortReturn, DIR.up, 1), end(1),
            when(1, "やめる"), end(1), choiceEnd(0), end(0)] },
      ],
    },
    // 南の控え（W11 が門叩きの塊を置く所。今は写字台と空き）
    memory(7, 3, "ディル", 7, 13, [
      ["教会に渡す銘の写しを、俺が写した。二冊。", "一冊は書架に残す。一冊は教会へ。"],
      ["どっちを渡したか、確かめる気になれば、確かめられた。", "確かめないことにした。それだけだよ。"],
    ], { tileId: "E:194" }),
    look("空いた床", 17, 14, ["控えの床の真ん中だけ、灰が積もっていない。"]),
    ...lairDoorEvents("west"), // 鐘の間の口の霧の戸口（W11）
  ];
  config("w8_084_archive_bell", {
    _説明: "W8（#155）：記録院の鐘の間（docs/world.md 3.6・3.7・8.1）。鐘の綱（スイッチ 102・変数 101 に 1 足す・4 以上ならスイッチ 105。注釈に W11 の足し場所）、当番の札（記録院）、帰りの転送陣（鳴らしたあと。010 の炉の南へ）。鐘の間の口に W11 の霧の戸口（門叩きの縄張り 170 へ）、鐘番の思念の 2 ページ目は 3 つ目の場面（W11。w11_parts.mjs）。",
    mapId: 84, name: "記録院の鐘の間", displayName: "記録院の鐘の間", ...LIBRARY_BASE,
    note: "<hai_tone:-68,-68,-34,68>",
    bgm: { name: "Scene2", volume: 55, pitch: 100, pan: 0 }, bgs: { name: "Darkness", volume: 25, pitch: 100, pan: 0 },
    fields: {},
    chars: {},
    scatter: [{ on: ",", tiles: ["B:32", "B:33"], rate: 0.06, seed: 840 }],
    events,
  });
}

// 弟の筋：ゲンサイと言い争う（docs/world.md 7.3）
function argue(indent) {
  return [
    ...say(["弟さんのことやろ。堪忍な、帰さへん。", "帰さへんのやない。本人が帰らへん言うとる。聞いてみ。"], "ゲンサイ", indent),
    choice(["言い返す", "やめる"], 1, indent),
    when(0, "言い返す", indent),
    ...say(["ゲンサイは笑ったまま、ルッツの方へ顎をしゃくった。"], "", indent + 1),
    ...say(["ほな、あの子に決めさせよか。"], "ゲンサイ", indent + 1),
    ...say(["おれは残る。姉ちゃんには、元気だって言っといて。"], "ルッツ", indent + 1),
    varSet(VAR.brother, 3, indent + 1), swOn(SW.brotherStays, indent + 1),
    ...errandEnd({ key: "brother", result: "failed", text: "ルッツは灰の信徒の集落に残った" }, indent + 1),
    end(indent + 1),
    when(1, "やめる", indent), end(indent + 1),
    choiceEnd(indent),
  ];
}

// ---------------------------------------------------------------------------
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const ROOT = path.resolve(HERE, "../../..");
  let stale = 0;
  for (const { file, text } of outputs) {
    const rel = path.relative(ROOT, file);
    const current = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
    if (check) {
      if (current !== text) { console.error(`古い: ${rel}（node tools/maps/src/w8_maps.mjs で書き直す）`); stale++; }
      else console.log(`一致: ${rel}`);
    } else if (current !== text) {
      fs.writeFileSync(file, text);
      console.log(`書き出し: ${rel}`);
    }
  }
  if (stale) process.exit(1);
}
