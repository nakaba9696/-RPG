// W14（#234）終盤：境山の高み（180–183）の地図・設定・データを書く。何度走らせても同じ結果になる。台本は docs/story/scenes/04-climax.md（場面表 N4-4）の 4 章。
//   node tools/maps/src/w14_data.mjs           書く（このあと node tools/maps/build.mjs w14_180_ash_slope w14_181_lodge w14_182_scaffold w14_183_bell_root で地図を作る）
//   node tools/maps/src/w14_data.mjs --check   書かずに、今のファイルと同じかだけ見る（違えば終了コード 1）
// 書くもの（docs/ROADMAP.md の割り当て表の W14：スイッチ・変数・データベース 1151–1200、マップ 180–183）：
//   tools/maps/src/w14_18*.txt・.deco.txt・.json   地図（文字マップはこのスクリプトが描く）と設定
//   Items・Skills・States・Enemies・Troops の 1151–1200、System.json の switches・variables 1151–1200 の名前
// ほかのレーンの地図に足す部品（三つの鐘の綱・010・019・054）は tools/maps/src/w14_parts.mjs（w6_data・w8_maps・w9_data・w10_data が読む）。
// 文は場面表のまま写す（変えない）。場面表に無い調べた文・宝箱は置かない（宝箱の入手の文だけ）。
// 文7（#274）：場面表に無かった文（二度目に調べた頁・ふさがった口・入手の一行）と R2 の直し（気になる 17・18・19・26）を書き直した。印は「文7」。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readData, formatTable, dataPath, extendTable } from "../../data/io.mjs";
import { SRC_DIR } from "../build.mjs";
import { say, plugin, SW, VAR, ITEM, MAP, FLAG, ROPE_054, ROPE_180, ROPE_180_ARRIVE, SLOPE_ARRIVE, patchLater } from "./w14_parts.mjs";
import { draw015, events015, nightTroopPages, SUMMIT_SWITCH_NAMES, E015 } from "./w14_summit.mjs";

const check = process.argv.includes("--check");
const outputs = []; // [{ file, text }]

// ---------------------------------------------------------------------------
// イベントの命令の部品
// ---------------------------------------------------------------------------
const cmd = (code, parameters, indent = 0) => ({ code, indent, parameters });
const END = cmd(0, []);
const end = indent => cmd(0, [], indent);
const se = (name, indent = 0, volume = 90, pitch = 100) => cmd(250, [{ name, volume, pitch, pan: 0 }], indent);
const wait = (n, indent = 0) => cmd(230, [n], indent);
const switchOn = (id, indent = 0) => cmd(121, [id, id, 0], indent);
const selfOn = (ch = "A", indent = 0) => cmd(123, [ch, 0], indent);
const ifSwitch = (id, on = true, indent = 0) => cmd(111, [0, id, on ? 0 : 1], indent);
const ifItem = (id, indent = 0) => cmd(111, [8, id], indent);
const ifScript = (expr, indent = 0) => cmd(111, [12, expr], indent);
const ELSE = (indent = 0) => cmd(411, [], indent);
const ENDIF = (indent = 0) => cmd(412, [], indent);
const comment = (text, indent = 0) => cmd(108, [text], indent);
const transfer = (mapId, x, y, d, indent = 0) => cmd(201, [0, mapId, x, y, d, 0], indent);
const gainItem = (id, n = 1, indent = 0) => cmd(126, [id, 0, 0, n], indent);
const gainGold = (n, indent = 0) => cmd(125, [0, 0, n], indent);
// 大事なものの入手。ほかの物と同じ「\I[n]〜を手に入れた。」の形（文7。R2 気になる 18。「メモ：」の形にしない）
const got = id => `\\I[${KEY_ITEM[id][1]}]${KEY_ITEM[id][0]}を手に入れた。`;
const bossBattle = (troopId, [mapId, x, y, d], indent = 0) => plugin("Hai_Boss", "bossBattle", "ボス戦",
  { troopId: String(troopId), escapeMapId: String(mapId), escapeX: String(x), escapeY: String(y), escapeDirection: String(d) }, indent);
/** 仲間がいれば一言（加入のスイッチ） */
const ifJoined = (id, who, lines, indent = 0) => [ifSwitch(id, true, indent), ...say(lines, who, indent + 1), end(indent + 1), ENDIF(indent)];

const DOWN = 2, LEFT = 4, RIGHT = 6, UP = 8;
const sourceText = cfg => JSON.stringify(cfg, null, 2) + "\n";
const srcPath = (name, ext = ".json") => path.join(SRC_DIR, name + ext);

// 絵（持ち主がエディタで決め直してよい。仮の絵）
const IMG = {
  faint: { characterName: "!Flame", characterIndex: 4, direction: DOWN, pattern: 1 }, // 薄い思念
  thought: { characterName: "!Flame", characterIndex: 5, direction: DOWN, pattern: 1 }, // 残留思念
  sparkle: { characterName: "!Other1", characterIndex: 1, direction: DOWN, pattern: 1 }, // 光る点（拾える物）
  chest: { characterName: "!Chest", characterIndex: 0, direction: DOWN, pattern: 0 },
  chestOpen: { characterName: "!Chest", characterIndex: 0, direction: UP, pattern: 0 },
  redChest: { characterName: "!Chest", characterIndex: 2, direction: DOWN, pattern: 0 },
  redChestOpen: { characterName: "!Chest", characterIndex: 2, direction: UP, pattern: 0 },
  warp: { characterName: "!Other2", characterIndex: 3, direction: DOWN, pattern: 1 }, // 結界（W7 と同じ）
  sorenne: { characterName: "People4", characterIndex: 6, direction: DOWN, pattern: 1 }, // W12 と同じ
  rope: { characterName: "!Other1", characterIndex: 4, direction: DOWN, pattern: 1 }, // 垂れた縄（w14_parts と同じ仮の絵）
  mason: { characterName: "Evil", characterIndex: 5, direction: DOWN, pattern: 1 }, // 石工の亡骸
  warden: { characterName: "Monster", characterIndex: 6, direction: DOWN, pattern: 1 }, // 足場の番（影の重なり）
};

// ---------------------------------------------------------------------------
// ID（W14 の帯 1151–1200）
// ---------------------------------------------------------------------------
const BAND = [1151, 1200];
export const SKILL = { chisel: 1151, unstep: 1152, masonBlow: 1153, nightVoices: 1154, nightStill: 1155 };
export const STATE = { oneNight: 1151 };
export const ENEMY = { scaffold: 1151, nightThoughts: 1152, mason: 1153 };
export const TROOP = { scaffold: 1151, nightThoughts: 1152, mason: 1153, masons: 1154 };
const SW_SHOWED_LEDGER = 1171; // 足場の番:指図の写しを見せた（戦闘の頭に「一晩のみ」）
const SW_F11_SEEN = 1173; // 宿坊:F11 を見た（ブルーノの一言を思念のあとに出す）
// P の帯（使うだけ）：拾い物（P9）
const P_ITEM = { herb: 196, antidote: 197, elixir: 198, bitterRoot: 199 };
const P_ITEM_NAME = { 196: ["薬草", 176], 197: ["毒消し", 177], 198: ["秘薬", 179], 199: ["苦い根", 189] };
const FORT = { mapId: 19, gate: [41, 7] }; // 019 城壁の上：頂への門 (41,6) の一つ下

// ---------------------------------------------------------------------------
// 説明と来歴（1 行は全角 40 字まで。docs/world.md 8.3・場面表 章末 1・2）
// ---------------------------------------------------------------------------
const LORE = {
  "宿帳": {
    desc: ["鐘守の宿坊の宿帳。", "石工の隊の名が並ぶ。最後の夜の頁は、一晩分しか無い。"],
    lore: ["「石工、二十二。鐘守、三。王家の使い、一」。", "指図の写しが挟んである。「一晩のみ」。", "砦の鐘守の交代の欄に、墓守の名の所だけ印。印は五冊の帳面と同じ。"],
  },
  "石工の工具": {
    desc: ["鐘楼の根の巻き上げを直す。", "歯が一つ、新しい。"],
    lore: [],
  },
};
for (const [name, { desc, lore }] of Object.entries(LORE)) {
  for (const line of [...desc, ...lore]) if ([...line].length > 40) throw new Error(`${name} の文が 40 字を超える：${line}`);
}
const descOf = name => LORE[name].desc.join("\n");
const loreOf = name => LORE[name].lore.length ? ["<hai_lore>", ...LORE[name].lore, "</hai_lore>"].join("\n") : "";

// ---------------------------------------------------------------------------
// データベース（帯だけを書き直す）
// ---------------------------------------------------------------------------
function clearBand(table, makeEmpty) {
  extendTable(table, BAND[0] - 1, makeEmpty);
  for (let id = BAND[0]; id < table.length && id <= BAND[1]; id++) table[id] = makeEmpty(id);
  while (table.length - 1 >= BAND[0] && table.length - 1 <= BAND[1] && table[table.length - 1].name === "") table.pop();
}
function put(table, id, item, makeEmpty) {
  if (id < BAND[0] || id > BAND[1]) throw new Error(`${id} は W14 の帯の外`);
  extendTable(table, id, makeEmpty);
  table[id] = { ...makeEmpty(id), ...item, id };
}
const writeTable = (name, array) => outputs.push({ file: dataPath(name), text: formatTable(array) });

// Items（大事なもの）
const emptyItem = id => ({
  id, animationId: 0, consumable: true, damage: { critical: false, elementId: 0, formula: "0", type: 0, variance: 20 },
  description: "", effects: [], hitType: 0, iconIndex: 0, itypeId: 1, name: "", note: "", occasion: 0, price: 0, repeats: 1,
  scope: 0, speed: 0, successRate: 100, tpGain: 0,
});
// 大事なものの名前と絵（入手の文 got と同じ表を使う）
const KEY_ITEM = { [ITEM.ledger]: ["宿帳", 121], [ITEM.masonTools]: ["石工の工具", 143] };
const keyItem = (name, iconIndex) => ({ name, description: descOf(name), note: loreOf(name), iconIndex, itypeId: 2, consumable: false, occasion: 3 });
const items = readData("Items.json");
clearBand(items, emptyItem);
put(items, ITEM.ledger, keyItem(...KEY_ITEM[ITEM.ledger]), emptyItem);
put(items, ITEM.masonTools, keyItem(...KEY_ITEM[ITEM.masonTools]), emptyItem);
writeTable("Items.json", items);

// Skills（敵の技）
const emptySkill = id => ({
  id, animationId: 0, damage: { critical: false, elementId: 0, formula: "0", type: 0, variance: 20 },
  description: "", effects: [], hitType: 0, iconIndex: 0, message1: "", message2: "", mpCost: 0, name: "", note: "",
  occasion: 0, repeats: 1, requiredWtypeId1: 0, requiredWtypeId2: 0, scope: 1, speed: 0, stypeId: 0, successRate: 100,
  tpCost: 0, tpGain: 0, messageType: 1,
});
const skills = readData("Skills.json");
clearBand(skills, emptySkill);
const enemySkill = (name, o) => ({ name, occasion: 1, stypeId: 0, hitType: 1, note: "<hai_w14:敵の技>", ...o });
put(skills, SKILL.chisel, enemySkill("鑿を打つ", {
  description: "鑿で打ちこむ。", animationId: 6, scope: 1, message1: "%1は、鑿を振り下ろした！",
  damage: { critical: true, elementId: -1, formula: "a.atk * 4 - b.def * 2", type: 1, variance: 20 },
}), emptySkill);
// 範囲は使う側から見た向き：2＝相手全体（プレイヤーの隊）。前は 8（足場の番の味方全体＝自身）で、隊に当たっていなかった（W23 #280）
put(skills, SKILL.unstep, enemySkill("段を外す", {
  description: "足もとの段を叩き、全員を打つ。", animationId: 2, scope: 2, message1: "%1は、槌で段を叩いた！",
  damage: { critical: false, elementId: -1, formula: "a.atk * 2 - b.def", type: 1, variance: 20 },
}), emptySkill);
put(skills, SKILL.masonBlow, enemySkill("槌を振る", {
  description: "槌で殴る。", animationId: 1, scope: 1, message1: "%1は、槌を振るった！",
  damage: { critical: false, elementId: -1, formula: "a.atk * 3 - b.def * 2", type: 1, variance: 20 },
}), emptySkill);
// 夜の思い（耐える戦い）の技。味方全員の最大 HP の 6〜9% を削る。ただし HP 1 は残す（減るが倒れない。W21 #259）
put(skills, SKILL.nightVoices, enemySkill("寄ってくる顔", {
  description: "群れが寄ってくる。", animationId: 59, hitType: 0, scope: 2, message1: "%1が、寄ってきた。",
  damage: { critical: false, elementId: 0, formula: "Math.min(b.hp - 1, Math.round(b.mhp * (0.06 + Math.random() * 0.03)))", type: 1, variance: 0 },
}), emptySkill);
// 夜の思いの最後のターン（バトルイベントが「影は、もう寄ってこなかった」を出すターン）の行動。何もしない
put(skills, SKILL.nightStill, enemySkill("立ち止まる", {
  description: "影は、もう寄ってこない。", hitType: 0, scope: 0, message1: "",
}), emptySkill);
writeTable("Skills.json", skills);

// States（足場の番が宿帳の「一晩のみ」を見たとき、戦いの頭に付く。W9 の「迷い」と同じ形）
const emptyState = id => ({
  id, autoRemovalTiming: 0, chanceByDamage: 100, iconIndex: 0, maxTurns: 1, message1: "", message2: "", message3: "", message4: "",
  minTurns: 1, motion: 0, name: "", note: "", overlay: 0, priority: 50, releaseByDamage: false, removeAtBattleEnd: true,
  removeByDamage: false, removeByRestriction: false, removeByWalking: false, restriction: 0, stepsToRemove: 100, traits: [],
  messageType: 1,
});
const states = readData("States.json");
clearBand(states, emptyState);
put(states, STATE.oneNight, {
  name: "一晩のみ", iconIndex: 10, priority: 60, message1: "", message2: "%1の槌が、止まった。", message3: "", message4: "",
  autoRemovalTiming: 2, minTurns: 5, maxTurns: 5,
  traits: [{ code: 21, dataId: 2, value: 0.6 }, { code: 21, dataId: 3, value: 0.7 }, { code: 22, dataId: 1, value: -0.2 }],
  note: "<hai_w14:足場の番が宿帳の指図の写しを見たとき、戦いの頭に付く>",
}, emptyState);
writeTable("States.json", states);

// Enemies・Troops（docs/world.md 5.5。数値は仮で、持ち主が調整する）
const emptyEnemy = id => ({
  id, actions: [{ conditionParam1: 0, conditionParam2: 0, conditionType: 0, rating: 5, skillId: 1 }],
  battlerHue: 0, battlerName: "",
  dropItems: [{ dataId: 1, denominator: 1, kind: 0 }, { dataId: 1, denominator: 1, kind: 0 }, { dataId: 1, denominator: 1, kind: 0 }],
  exp: 0, traits: [{ code: 22, dataId: 0, value: 0.95 }, { code: 22, dataId: 1, value: 0.05 }, { code: 31, dataId: 1, value: 0 }],
  gold: 0, name: "", note: "", params: [100, 0, 10, 10, 10, 10, 10, 10],
});
const T = {
  element: (elementId, rate) => ({ code: 11, dataId: elementId, value: rate }),
  stateRate: (stateId, rate) => ({ code: 13, dataId: stateId, value: rate }),
};
const ELEMENT = { light: 8, dark: 9 };
const base = [{ code: 22, dataId: 0, value: 0.95 }, { code: 22, dataId: 1, value: 0.05 }, { code: 31, dataId: 1, value: 0 }];
const act = (skillId, rating = 5) => ({ conditionParam1: 0, conditionParam2: 0, conditionType: 0, rating, skillId });
const onTurn = (skillId, a, b, rating = 5) => ({ conditionParam1: a, conditionParam2: b, conditionType: 1, rating, skillId });
const hpBelow = (skillId, rate, rating) => ({ conditionParam1: 0, conditionParam2: rate, conditionType: 2, rating, skillId });
const drop = (kind, id, denominator) => [{ dataId: id, denominator, kind }, { dataId: 1, denominator: 1, kind: 0 }, { dataId: 1, denominator: 1, kind: 0 }];
const noDrop = drop(0, 1, 1);
const enemies = readData("Enemies.json");
clearBand(enemies, emptyEnemy);
put(enemies, ENEMY.mason, {
  name: "石工の亡骸", battlerName: "Zombie", battlerHue: 0, params: [1500, 0, 62, 40, 20, 30, 24, 10], exp: 110, gold: 60,
  traits: [...base, T.element(ELEMENT.light, 1.5)],
  actions: [act(1), act(SKILL.masonBlow, 4)], dropItems: drop(1, P_ITEM.herb, 4),
}, emptyEnemy);
// HP・攻撃は W23（#280）で測って決めた：段を外すが隊に当たるようになった分、9000・120 から下げた（R2 の「Lv12 で 25 ターン前後、一人倒れて勝つ」に合わせる）
put(enemies, ENEMY.scaffold, {
  name: "足場の番", battlerName: "Stoneknight", battlerHue: 0, params: [7000, 110, 70, 48, 40, 44, 26, 30], exp: 1200, gold: 600,
  traits: [...base, T.element(ELEMENT.light, 1.5), T.stateRate(1, 0), T.stateRate(STATE.oneNight, 1)],
  actions: [act(SKILL.chisel, 5), act(SKILL.unstep, 3), onTurn(SKILL.unstep, 3, 3, 8), hpBelow(SKILL.chisel, 0.5, 7)],
  dropItems: noDrop,
  note: ["<hai_boss>", "<hai_boss_name:足場の番>", `<hai_boss_switch:${SW.scaffoldBoss}>`, "<hai_actions_low:2,50>", "<hai_drop:none>"].join("\n"),
}, emptyEnemy);
// 夜の思い（015。耐える戦い。倒せない・逃げられない。8 ターン耐えれば勝ち。場面表 5.5）
const NIGHT_TURNS = 8;
put(enemies, ENEMY.nightThoughts, {
  name: "夜の思い", battlerName: "SF_Shadow", battlerHue: 200, params: [999999, 0, 40, 999, 30, 999, 20, 10], exp: 0, gold: 0,
  traits: [...base, T.stateRate(1, 0)],
  // 最後のターン（行動の条件のターン数は 1 から数える）は寄ってこない
  actions: [act(SKILL.nightVoices, 5), onTurn(SKILL.nightStill, NIGHT_TURNS, 0, 9)], dropItems: noDrop,
  note: [`<hai_endure:${NIGHT_TURNS}>`, "<hai_drop:none>"].join("\n"),
}, emptyEnemy);
writeTable("Enemies.json", enemies);

const emptyTroop = id => ({
  id, members: [], name: "",
  pages: [{
    conditions: { actorHp: 50, actorId: 1, actorValid: false, enemyHp: 50, enemyIndex: 0, enemyValid: false, switchId: 1, switchValid: false, turnA: 0, turnB: 0, turnEnding: false, turnValid: false },
    list: [{ code: 0, indent: 0, parameters: [] }], span: 0,
  }],
});
const row = n => Array.from({ length: n }, (_, i) => ({ x: Math.round(640 + (i - (n - 1) / 2) * 220), y: 460 }));
const troops = readData("Troops.json");
clearBand(troops, emptyTroop);
for (const [id, name, members] of [
  [TROOP.mason, "W14_緑：石工の亡骸", [ENEMY.mason]],
  [TROOP.masons, "W14_黄：石工の亡骸×2", [ENEMY.mason, ENEMY.mason]],
  [TROOP.scaffold, "W14_ボス：足場の番", [ENEMY.scaffold]],
  [TROOP.nightThoughts, "W14_耐える戦い：夜の思い", [ENEMY.nightThoughts]],
]) {
  const pos = row(members.length);
  put(troops, id, { name, members: members.map((enemyId, i) => ({ enemyId, ...pos[i], hidden: false })), pages: emptyTroop(id).pages }, emptyTroop);
}
// 足場の番：宿帳の指図の写しを見せていたら（スイッチ 1171）、戦いの頭に「一晩のみ」（場面表 4.6）
const page0 = emptyTroop(0).pages[0];
troops[TROOP.scaffold].pages = [
  { ...page0, conditions: { ...page0.conditions, switchId: SW_SHOWED_LEDGER, switchValid: true }, span: 0,
    list: [cmd(333, [-1, 0, STATE.oneNight]), END] },
];
troops[TROOP.nightThoughts].pages = nightTroopPages(page0);
writeTable("Troops.json", troops);

// System.json の名前（場面表 章末 1。1159 以降の旗は頂と結末で立てる）
const SWITCH_NAMES = {
  [SW.bowlFilled]: "砦:伏せた椀に飯が盛られた",
  [SW.mirleneFort]: "ミルレーネが砦にいる",
  [SW.sorenneTalked]: "斜面:ソレンヌと話した",
  [SW.scaffoldBoss]: "ボス:足場の番",
  [SW.ropeFixed]: "鐘楼の根:綱を直した",
  [SW.lucienStopped]: "頂:ルシアンを止めた",
  [SW.tongueHung]: "頂:舌を吊った",
  [SW.endured]: "頂:耐えきった",
  [SW.endingSeen]: "結末を見た",
  [SW.pulled31]: "頂:三十一を引いた",
  [SW.trueEnding]: "真の結末（遠い鐘が応えた）",
  [SW.endingNight]: "結末の夜",
  [SW.doorOpened]: "結末:戸を開けた",
  [SW.nameCarved]: "結末:名を彫った",
  [SW.morning]: "朝の砦",
  [SW.sorenneAlive]: "ソレンヌが生きている",
  [SW.ropeDown]: "斜面:崖の縄を下ろした",
  [SW.lairLegacyWest]: "縄張り:影の言い残し 記録院の側",
  [SW.lairLegacyEast]: "縄張り:影の言い残し 鋳物場の側",
  [SW.ismene]: "出立:イスメネが写しを返した",
  [SW_SHOWED_LEDGER]: "足場の番:指図の写しを見せた",
  [SW.arrived]: "斜面:着いた",
  [SW_F11_SEEN]: "宿坊:F11 を見た",
};
Object.assign(SWITCH_NAMES, SUMMIT_SWITCH_NAMES);
const VARIABLE_NAMES = { [VAR.notYet]: "頂:まだの回数", [VAR.pulls]: "頂:綱の回数" };

// ---------------------------------------------------------------------------
// 地図を描く（文字マップ）
// ---------------------------------------------------------------------------
class Grid {
  constructor(w, h, fill) { this.w = w; this.h = h; this.cells = Array.from({ length: h }, () => Array(w).fill(fill)); }
  set(x, y, ch) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) throw new Error(`地図の外 (${x},${y})`);
    this.cells[y][x] = ch; return this;
  }
  get(x, y) { return this.cells[y]?.[x]; }
  rect(x1, y1, x2, y2, ch) { for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) this.set(x, y, ch); return this; }
  text() { return this.cells.map(r => r.join("")).join("\n") + "\n"; }
}
const LOOK = JSON.parse(fs.readFileSync(path.join(SRC_DIR, "..", "looks.json"), "utf8")).regions.filter(r => r.key === "heights" || r.key === "summit").flatMap(r => r.places);
const lookOf = mapId => LOOK.find(p => p.maps === String(mapId).padStart(mapId < 100 ? 3 : 0, "0"));
// 置き物（重ね書き）。rampart（タイルセット 21：B＝Outside_B、C＝Outside_C、D＝Dungeon_B、E＝Inside_C）は 019 と同じ、monastery（25）は W12 と同じ
const RAMPART_DECO = {
  a: { name: "鎧の亡骸（鎧のスタンド）", z2: "E:160" },
  x: { name: "骸骨", z2: "D:242" },
  r: { name: "瓦礫", z2: "D:120" },
  p: { name: "倒れた槍立て", z2: "E:183" },
  b: { name: "壊れた像", z2: "D:91" },
};
const MONASTERY_DECO = {
  t: { name: "テーブルA（帳場の台・机。通れない）", z2: "B:112" },
  T: { name: "テーブルB（通れない）", z2: "B:114" },
  h: { name: "椅子A", z2: "B:120" },
  w: { name: "端材（橇・木。通れない）", z2: "D:125" },
  R: { name: "苔の瓦礫（通れない）", z2: "D:121" },
};
function configOf(mapId, name, displayName, about, events, extra = {}) {
  const look = lookOf(mapId);
  return {
    _説明: about + " この設定は node tools/maps/src/w14_data.mjs が書く。",
    mapId, name, displayName, legend: look.legend, tilesetId: look.tilesetId,
    note: look.note,
    bgm: { name: look.bgm.name, volume: look.bgm.volume, pitch: 100, pan: 0 },
    bgs: { name: look.bgs.name, volume: look.bgs.volume, pitch: 100, pan: 0 },
    fields: look.battleback ? { specifyBattleback: true, battleback1Name: look.battleback[0], battleback2Name: look.battleback[1] } : {},
    ...extra,
    events,
  };
}

// ---------------------------------------------------------------------------
// イベントの部品
// ---------------------------------------------------------------------------
const look = (name, [x, y], lines, extra = {}) => ({ name, type: "raw", x, y, pages: [{ priorityType: 1, list: [...say(lines), END], ...extra }] });
const exitTo = (name, [x, y], [mapId, tx, ty, d]) => ({ name, type: "transfer", x, y, to: [mapId, tx, ty, d] });
const chest = (label, [x, y], gainList, gotText, red = false) => ({
  name: `${red ? "赤い宝箱" : "宝箱"}（${label}）`, type: "raw", x, y,
  pages: [
    { image: red ? IMG.redChest : IMG.chest, priorityType: 1, walkAnime: false, list: [se("Chest1"), ...gainList, selfOn(), ...say([gotText]), END] },
    { conditions: { selfSwitchCh: "A", selfSwitchValid: true }, image: red ? IMG.redChestOpen : IMG.chestOpen, priorityType: 1, walkAnime: false },
  ],
});
const chestItem = (xy, id, n = 1, red = false) => chest(P_ITEM_NAME[id][0], xy, [gainItem(id, n)], `\\I[${P_ITEM_NAME[id][1]}]${P_ITEM_NAME[id][0]}${n > 1 ? `×${n}` : ""}を手に入れた。`, red); // 拾い物は「〜×2を手に入れた。」の形（文7。R2 気になる 26）
const chestGold = (xy, n) => chest("鉄くず", xy, [gainGold(n)], `鉄くずを ${n} 手に入れた。`);
const ward = (name, [x, y], lines = []) => ({
  name: `結界（${name}）`, type: "raw", x, y, note: `<hai_warp:${name}>`,
  pages: [{ image: IMG.warp, priorityType: 1, stepAnime: true, walkAnime: false, ...(lines.length ? { list: [...say(lines), END] } : {}) }],
});
const foe = (troopId, rank, [x, y], random = true) => ({
  name: `石工の亡骸（${{ green: "緑", yellow: "黄", red: "赤" }[rank]}）`, type: "raw", x, y,
  note: `<hai_enemy:${troopId},${rank}>` + (rank === "green" ? "\n<hai_enemy_hesitate>" : ""),
  pages: [{ image: IMG.mason, priorityType: 1, trigger: 2, moveType: random ? 1 : 0, moveFrequency: 3, moveSpeed: 3 }],
});

// ===========================================================================
// 180 灰の斜面（70 × 50。外。段が 3。灰が降る）
//   南西の門（019 の頂への門から着く）→ 段 1（使徒狩りの野営の跡）→ 東の切れ目 → 段 2（ソレンヌ、西の崖の縁＝054 への縄）→ 西の切れ目 → 段 3 → 北の宿坊の戸 → 181
// ===========================================================================
function draw180() {
  const g = new Grid(70, 50, " ");
  const d = new Grid(70, 50, ".");
  g.rect(4, 3, 65, 47, ","); // 斜面（土）
  g.rect(5, 48, 13, 49, "#").rect(8, 47, 10, 47, "."); // 南西の門（城壁の東の塔）
  g.rect(4, 26, 5, 34, " "); // 西の崖（下は東門の外 054）
  g.rect(4, 3, 7, 8, " ").rect(62, 3, 65, 9, " ").rect(60, 40, 65, 47, " ").rect(4, 40, 6, 47, " "); // 角の谷
  g.rect(22, 38, 31, 42, " ").rect(40, 20, 46, 23, " ").rect(18, 7, 24, 10, " "); // 斜面の裂け目
  // 段の境（崖の縁）：段 1 と段 2 の境（東の切れ目）、段 2 と段 3 の境（西の切れ目）
  for (let x = 6; x <= 65; x++) if (x < 56 || x > 59) g.set(x, 32, "_").set(x, 33, "_");
  for (let x = 4; x <= 65; x++) if (x < 10 || x > 13) g.set(x, 16, "_").set(x, 17, "_");
  g.rect(30, 0, 40, 2, "#").rect(34, 2, 36, 2, "."); // 北：宿坊の門
  // 古い石の道（門から段の切れ目を通って宿坊の門へ。2 マス幅）と、道の上の灰だまり
  for (const [x1, y1, x2, y2] of [[8, 36, 10, 46], [8, 35, 58, 36], [57, 28, 58, 34], [11, 28, 58, 29], [11, 12, 12, 29], [11, 12, 36, 13], [34, 3, 36, 13]]) g.rect(x1, y1, x2, y2, ".");
  for (const [x, y] of [[9, 40], [22, 35], [41, 36], [57, 31], [30, 28], [12, 21], [24, 13], [35, 8]]) g.set(x, y, ";");
  // 使徒狩りの野営の跡（火床）
  g.set(44, 40, "f");
  // 置き物
  for (const [x, y, ch] of [[16, 38, "r"], [33, 45, "x"], [50, 37, "r"], [58, 44, "x"], [9, 22, "r"], [30, 31, "x"], [60, 21, "r"], [26, 5, "r"], [55, 12, "x"], [12, 6, "r"], [42, 14, "r"]]) d.set(x, y, ch);
  return { g, d };
}
const E180 = {
  gate: [9, 47], arrive: SLOPE_ARRIVE, lodge: [35, 2], fromLodge: [35, 3],
  camp: [44, 40], sorenne: [50, 24], ward: [12, 44],
};
function events180() {
  return [
    exitTo("南西の門（城壁の上へ）", E180.gate, [FORT.mapId, FORT.gate[0], FORT.gate[1], DOWN]),
    exitTo("北の門（鐘守の宿坊へ）", E180.lodge, [MAP.lodge, E181.entry[0], E181.entry[1] - 1, UP]),
    ward("灰の斜面", E180.ward),
    // ソレンヌ（天幕の前。場面表 4.4。足場の木を運んだか＝スイッチ 1055 で文が替わる）。話すと斜面を上る（以後は頂）
    {
      name: "ソレンヌ（灰の斜面）", type: "raw", x: E180.sorenne[0], y: E180.sorenne[1],
      pages: [
        { image: IMG.sorenne, priorityType: 1, list: [
          ifSwitch(FLAG.timber, true),
          ...say(["きみか。長は先に上った。わたしは足場の木を運ぶ。", "段の数は、長が数えてある", "きみは、鳴らしに来たのか"], "ソレンヌ", 1),
          end(1),
          ELSE(),
          ...say(["きみか。長は先に上った。わたしは、あとから上る。", "足場は、二百年前のままだそうだ", "きみは、鳴らしに来たのか"], "ソレンヌ", 1),
          end(1),
          ENDIF(),
          ...say(["ソレンヌは斜面を上りはじめた。"]),
          ifSwitch(FLAG.timber, true), ...say(["木の束が、灰に細い筋を引いた。筋は、すぐに消えた。"], "", 1), end(1), ENDIF(),
          cmd(221, []), switchOn(SW.sorenneTalked), cmd(222, []),
          END,
        ] },
        { conditions: { switch1Id: SW.sorenneTalked, switch1Valid: true }, priorityType: 0 },
      ],
    },
    // 使徒狩りの野営の跡（火床。調べる）
    {
      name: "使徒狩りの野営の跡（火床）", type: "raw", x: E180.camp[0], y: E180.camp[1],
      pages: [{ priorityType: 1, list: [
        ...say(["石を組んだ火床。火は消してある。", "消した灰は黒く、降る灰は白い。", "火床の脇の石に、刃で刻んだ字。", "「ここから上は、骨拾いの縄張りだ。狩らない」"]),
        ifSwitch(FLAG.beltran, true), ...say(["……狩らねえ、か", "俺が死んだのは、この下だ。", "洞の前で、剣を杖にして。ここまでは、上がらなかった"], "ベルトラン", 1), end(1), ENDIF(),
        END,
      ] }],
    },
    // 054 への下り（崖の縁。片側。下りると 054 の側に縄が残る）
    {
      name: "崖の縁（東門の外へ下りる縄）", type: "raw", x: ROPE_180[0], y: ROPE_180[1],
      pages: [{ image: IMG.rope, priorityType: 1, directionFix: true, list: [
        ...say(["崖の下に、東門の外の山道が見える。縄が一本、垂れている。"]),
        cmd(102, [["縄を下りる", "やめる"], 1, 0, 2, 0]),
        cmd(402, [0, "縄を下りる"]), switchOn(SW.ropeDown, 1), se("Move1", 1), transfer(54, ROPE_054[0], ROPE_054[1] + 1, DOWN, 1), end(1),
        cmd(402, [1, "やめる"]), end(1),
        cmd(404, []),
        END,
      ] }],
    },
    foe(TROOP.mason, "green", [24, 45]),
    foe(TROOP.mason, "green", [36, 27]),
    foe(TROOP.masons, "yellow", [57, 30], false),
    foe(TROOP.mason, "green", [30, 9]),
    chestItem([62, 36], P_ITEM.elixir),
    chestGold([8, 12], 180),
    chestItem([60, 12], P_ITEM.herb, 3),
  ];
}

// ===========================================================================
// 181 鐘守の宿坊（50 × 40。中）
//   南の戸（180 から）→ 帳場（宿帳・結界）→ 西の囲炉裏の間（薄い思念 F11）・東の氷室（橇・石工の思念）・北西の王家の使いの部屋 → 北の戸 → 182
// ===========================================================================
function draw181() {
  const g = new Grid(50, 40, "#");
  const d = new Grid(50, 40, ".");
  g.rect(14, 27, 35, 37, "."); // 帳場（石の床）
  g.rect(24, 38, 26, 38, ".").set(25, 39, "."); // 南の戸 ← 180
  g.rect(3, 15, 18, 25, ","); // 西：囲炉裏の間（木の床）
  g.rect(15, 20, 18, 20, ",").rect(14, 30, 15, 30, "."); // 囲炉裏の間 ↔ 帳場の通り
  g.rect(15, 21, 15, 29, ",");
  g.rect(31, 15, 46, 25, "."); // 東：氷室（石の床）
  g.rect(34, 26, 34, 27, "."); // 氷室 ↔ 帳場
  g.rect(3, 3, 18, 11, ","); // 北西：王家の使いの部屋（いちばん良い部屋）
  g.rect(10, 12, 10, 14, ","); // 王家の使いの部屋 ↔ 囲炉裏の間
  g.rect(22, 3, 28, 26, "."); // 北の廊下（帳場から北の戸へ）
  g.rect(25, 0, 25, 2, "."); // 北の戸 → 182
  g.rect(19, 6, 21, 6, ","); // 王家の使いの部屋 ↔ 北の廊下
  g.rect(31, 3, 46, 11, ","); // 北東：石工の寝間
  g.rect(29, 7, 30, 7, ",");
  for (const [x1, y1, x2, y2] of [[36, 17, 40, 19], [42, 22, 45, 24], [33, 23, 35, 24]]) g.rect(x1, y1, x2, y2, ";"); // 氷室の霜（汚れ）
  // 置き物
  d.set(25, 29, "t"); // 帳場の台
  d.set(39, 20, "w"); // 氷室の橇
  d.set(9, 6, "t").set(10, 6, "t"); // 王家の使いの机
  for (const [x, y] of [[33, 5], [36, 5], [39, 5], [42, 5], [33, 9], [36, 9], [39, 9], [42, 9]]) d.set(x, y, "h"); // 石工の寝床（椅子で代用）
  for (const [x, y, ch] of [[17, 36, "R"], [4, 24, "R"], [45, 16, "R"], [3, 16, "w"], [46, 11, "R"]]) d.set(x, y, ch);
  return { g, d };
}
const E181 = {
  entry: [25, 39], ledger: [25, 29], hearth: [9, 20], sled: [39, 20], masonThought: [46, 22], envoy: [11, 6],
  ward: [18, 33], exitN: [25, 0], arriveFromScaffold: [25, 1],
};
function events181() {
  return [
    exitTo("南の戸（灰の斜面へ）", E181.entry, [MAP.slope, E180.fromLodge[0], E180.fromLodge[1], DOWN]),
    exitTo("北の戸（足場の番へ）", E181.exitN, [MAP.scaffold, E182.entry[0], E182.entry[1] - 1, UP]),
    ward("鐘守の宿坊", E181.ward),
    // 宿帳（帳場の台。場面表 4.5）
    {
      name: "宿帳（帳場の台）", type: "raw", x: E181.ledger[0], y: E181.ledger[1],
      pages: [
        { priorityType: 1, list: [
          ...say(["宿帳が、開いたまま置いてある。", "「石工、二十二。鐘守、三。王家の使い、一」", "最後の夜の頁は、一晩分しか無い。", "頁のあいだに、指図の写し。「一晩のみ」"]),
          ...say(["砦の鐘守の交代の欄。名の所に、印が一つ。", "五冊の帳面の、墓守の欄の印と同じ形だ。"]),
          se("Item3"), gainItem(ITEM.ledger),
          ...say([got(ITEM.ledger)]),
          selfOn(),
          END,
        ] },
        { conditions: { selfSwitchCh: "A", selfSwitchValid: true }, priorityType: 1, list: [...say(["帳場の台。宿帳の形に、埃が薄い。"]), END] },
      ],
    },
    // 薄い思念 F11 砦の鐘守（囲炉裏。最後に 201 を呼ぶ）。ブルーノの一言は 201 のあと
    {
      name: "薄い思念 F11 砦の鐘守（囲炉裏）", type: "raw", x: E181.hearth[0], y: E181.hearth[1], note: "<hai_faint:F11>",
      pages: [{ image: IMG.faint, priorityType: 1, list: [
        ...say(["囲炉裏の向かいに、墓守が座っている。", "明日は頂の鐘守の交代だ。指の形を合わせる。", "ひとつ、ふたつ。墓守の指は速い。", "三十で、わたしの指は止まる。"]),
        ...say(["墓守の指は、三十一まで動いた。", "「三十で止めろ」", "墓守は笑って、指を戻した。", "戻したが、もう一本、まだ動いていた。"]),
        cmd(117, [201]),
        switchOn(SW_F11_SEEN),
        END,
      ] }],
    },
    // F11 のあとのブルーノの一言（薄い思念の中の文章は名前が消えるので、思念が明けてから別のイベントで出す）
    {
      name: "F11 のあとのブルーノの一言（自動）", type: "raw", x: 0, y: 0,
      pages: [
        { priorityType: 0 },
        { conditions: { switch1Id: SW_F11_SEEN, switch1Valid: true }, priorityType: 0, trigger: 3, list: [
          ifSwitch(FLAG.bruno, true),
          ...say(["城壁のときも、三十一でした。……どこで習ったんです"], "ブルーノ", 1),
          ...say(["「習っていない」"], "", 1),
          end(1), ENDIF(),
          selfOn(),
          END,
        ] },
        { conditions: { selfSwitchCh: "A", selfSwitchValid: true }, priorityType: 0 },
      ],
    },
    // 氷室の橇
    {
      name: "氷室の橇", type: "raw", x: E181.sled[0], y: E181.sled[1],
      pages: [{ priorityType: 1, list: [
        ...say(["石の棚に、橇が一台。空だ。", "札に「鋳物場へ。夜明けまでに」。", "橇の跡は往きだけで、鋳物場の方へ下りている。"]),
        ifSwitch(FLAG.tura, true), ...say(["これで運ぶはずだったのか。", "あたし、背負って歩いたぞ。檻から", "軽かった。ほんとに"], "トゥーラ", 1), end(1), ENDIF(),
        END,
      ] }],
    },
    // 石工の思念（氷室の壁ぎわ。<hai_thought:Z05>）
    { name: "思念 Z05 石工", type: "text", x: E181.masonThought[0], y: E181.masonThought[1], note: "<hai_thought:Z05>", image: IMG.thought,
      lines: ["頭が木を三晩分と言った。一晩で済むなら余る。", "余った木で、下りる段を組んだ。", "頭は下りてこなかった。"] },
    // 王家の使いの部屋（調べる）
    look("王家の使いの机", E181.envoy, ["宿坊でいちばん良い部屋。机に、王家の印の封蝋の欠片。", "帰りの荷の札に「鋳物場へ」。使いは頂へ上っていない。"]),
    foe(TROOP.mason, "green", [25, 14]),
    foe(TROOP.mason, "green", [38, 7]),
    chestItem([45, 4], P_ITEM.antidote, 2),
    chestItem([4, 4], P_ITEM.bitterRoot, 2),
  ];
}

// ===========================================================================
// 182 足場の番の間（27 × 19）：南の口（181 から）→ 石段 → 段の上の足場の番（ボス）→ 北の口 → 183
// ===========================================================================
function draw182() {
  const g = new Grid(27, 19, "#");
  const d = new Grid(27, 19, ".");
  g.rect(5, 3, 21, 15, "."); // 段の間
  g.rect(12, 16, 14, 17, ".").set(13, 18, "."); // 南の口 ← 181
  g.rect(13, 0, 13, 2, "."); // 北の口 → 183
  g.rect(9, 7, 17, 9, ";"); // 段の灰
  for (const [x, y, ch] of [[6, 4, "r"], [20, 4, "x"], [6, 14, "x"], [20, 13, "r"], [8, 11, "r"], [18, 10, "a"]]) d.set(x, y, ch);
  return { g, d };
}
const E182 = { entry: [13, 18], boss: [13, 4], exitN: [13, 0], arriveFromRoot: [13, 1] };
const SCAFFOLD_ESCAPE = [MAP.scaffold, 13, 15, UP];
function events182() {
  const bossList = [
    ...say(["石段の上に、背の高い影。二十二人分の影が重なっている。", "手に鑿と槌。影は一列になって段を上り、段の上で一つに重なる。"]),
    ...say(["夜明けまでに。段を外せ。"]),
    ifSwitch(FLAG.nora, true), ...say(["あんた、あたしが先！"], "ノラ", 1), end(1), ENDIF(),
    ifSwitch(FLAG.zelina, true), ...say(["重いわ。木、三晩分も担いどるんやろ、あんた"], "ゼリナ", 1), end(1), ENDIF(),
    // 宿帳（指図の写し）を持っていれば見せる → 戦いの頭に「一晩のみ」（Troops 1151 のバトルイベント）
    ifItem(ITEM.ledger),
    ...say(["指図の写しを、影の前にかざした。「一晩のみ」", "影の槌が、止まった。"], "", 1),
    ...say(["三晩。"], "", 1),
    switchOn(SW_SHOWED_LEDGER, 1),
    end(1), ENDIF(),
    ...bossBattle(TROOP.scaffold, SCAFFOLD_ESCAPE),
    ifScript("Hai.Boss.lastResult() === 0"),
    se("Collapse4", 1, 80, 80),
    // 文7（R2 気になる 19）：180 の火床の「灰は黒く、降る灰は白い」と重ねない。宿帳の「石工、二十二」と並ぶ数で終える（一本は頂の足場に残っている）
    ...say(["影は段の上で、灰になった。", "段に、鑿が二十一本残った。"], "", 1),
    end(1), ENDIF(),
    END,
  ];
  return [
    exitTo("南の口（鐘守の宿坊へ）", E182.entry, [MAP.lodge, E181.arriveFromScaffold[0], E181.arriveFromScaffold[1], DOWN]),
    {
      name: "足場の番（ボス）", type: "raw", x: E182.boss[0], y: E182.boss[1],
      pages: [
        { image: IMG.warden, priorityType: 1, stepAnime: true, walkAnime: false, directionFix: true, list: bossList },
        { conditions: { switch1Id: SW.scaffoldBoss, switch1Valid: true }, priorityType: 0 },
      ],
    },
    {
      name: "北の口（鐘楼の根へ）", type: "raw", x: E182.exitN[0], y: E182.exitN[1],
      pages: [
        { priorityType: 1, list: [...say(["石段の上に、影の背中。重なった肩で、段が見えない。"]), END] },
        { conditions: { switch1Id: SW.scaffoldBoss, switch1Valid: true }, priorityType: 0, trigger: 1, list: [se("Move1"), transfer(MAP.root, E183.entry[0], E183.entry[1] - 1, UP), END] },
      ],
    },
  ];
}

// ===========================================================================
// 183 鐘楼の根（40 × 30。中）：南の口（182 から）→ 石の広間（綱の巻き上げ・石工の工具・隊の最後の野営の跡・結界）→ 北の石段 → 015（頂。W14 の後半で作る）
// ===========================================================================
function draw183() {
  const g = new Grid(40, 30, "#");
  const d = new Grid(40, 30, ".");
  g.rect(4, 5, 35, 26, "."); // 石の広間
  g.rect(19, 27, 21, 28, ".").set(20, 29, "."); // 南の口 ← 182
  g.rect(19, 1, 21, 4, "."); // 北の石段 → 015
  for (const [x1, y1, x2, y2] of [[8, 18, 12, 21], [27, 9, 31, 11], [16, 22, 23, 24]]) g.rect(x1, y1, x2, y2, ";");
  for (const [x, y, ch] of [[5, 6, "r"], [34, 6, "x"], [5, 25, "x"], [34, 25, "r"], [14, 12, "b"], [26, 18, "p"]]) d.set(x, y, ch);
  return { g, d };
}
const E183 = { entry: [20, 29], winch: [20, 8], tools: [23, 9], camp: [9, 20], ward: [30, 20], stairs: [20, 1] };
function events183() {
  return [
    exitTo("南の口（足場の番の間へ）", E183.entry, [MAP.scaffold, E182.arriveFromRoot[0], E182.arriveFromRoot[1], DOWN]),
    // 綱の巻き上げ（場面表 4.7）。石工の工具があれば直せる（スイッチ 1155。頂で舌を吊る条件）
    {
      name: "綱の巻き上げ", type: "raw", x: E183.winch[0], y: E183.winch[1],
      pages: [
        // 文7（R2 気になる 17）：工具があってもなくても、先に「歯は錆びている」の頁を出す。アンセルモの一言は直す前に（直したあとでは遅い）
        { image: IMG.rope, priorityType: 1, directionFix: true, list: [
          ...say(["太い綱が巻き上げに掛かっている。綱は硬く、歯は錆びている。", "歯が一つだけ、新しい。"]),
          ...[ifSwitch(FLAG.anselmo, true), ...say(["お前さん。綱を直すと、上で吊れるようになる"], "アンセルモ", 1), end(1), ENDIF()],
          ifItem(ITEM.masonTools),
          se("Hammer", 1),
          ...say(["石工の工具で、錆びた歯を外して磨いた。", "嵌め直すと、綱が上まで通った。"], "", 1),
          switchOn(SW.ropeFixed, 1),
          end(1),
          ENDIF(),
          END,
        ] },
        { conditions: { switch1Id: SW.ropeFixed, switch1Valid: true }, image: IMG.rope, priorityType: 1, directionFix: true,
          list: [...say(["綱が、頂の方へ張っている。", "磨いた歯のあいだに、新しい歯が一つ。"]), END] },
      ],
    },
    // 石工の工具（巻き上げの脇で拾う）
    {
      name: "石工の工具", type: "raw", x: E183.tools[0], y: E183.tools[1],
      pages: [
        { image: IMG.sparkle, priorityType: 1, stepAnime: true, walkAnime: false, list: [
          ...say(["巻き上げの脇に、石工の工具。"]),
          se("Item3"), gainItem(ITEM.masonTools),
          ...say([got(ITEM.masonTools)]),
          selfOn(),
          END,
        ] },
        { conditions: { selfSwitchCh: "A", selfSwitchValid: true }, priorityType: 0 },
      ],
    },
    look("隊の最後の野営の跡", E183.camp, ["隊の最後の野営の跡。火は焚いていない。", "石に「一晩」と刻んである。刻みの下に、別の手で「三」。"]),
    ward("鐘楼の根", E183.ward, ["床の石の輪が、光っている。"]),
    {
      name: "頂への石段", type: "raw", x: E183.stairs[0], y: E183.stairs[1],
      pages: [{ priorityType: 0, trigger: 1, list: [
        ...say(["石段は、上へ続いていた。"]),
        se("Move1"), transfer(MAP.summit, E015.arrive[0], E015.arrive[1], UP),
        END,
      ] }],
    },
  ];
}

// ---------------------------------------------------------------------------
// 設定と地図を書く
// ---------------------------------------------------------------------------
const MAPS = [
  ["w14_180_ash_slope", 180, "境山の高み・灰の斜面", "灰の斜面", draw180, events180,
    "W14（#234）：灰の斜面（docs/world.md 5.2・docs/story/scenes/04-climax.md 4.4）。南西の門（019 の頂への門から）、段 1（使徒狩りの野営の跡）、段 2（ソレンヌ、西の崖の縁＝054 への縄。片側の近道）、段 3、北の宿坊の門 → 181。灰（<hai_ash>）。"],
  ["w14_181_lodge", 181, "境山の高み・鐘守の宿坊", "鐘守の宿坊", draw181, events181,
    "W14（#234）：鐘守の宿坊（場面表 4.5）。帳場の台（宿帳 Items 1151）、囲炉裏の間（薄い思念 F11 砦の鐘守）、氷室（橇・石工の思念 Z05）、王家の使いの部屋（調べた文だけ）、結界。北の戸 → 182。"],
  ["w14_182_scaffold", 182, "境山の高み・足場の番の間", "足場の番の間", draw182, events182,
    "W14（#234）：足場の番の間（場面表 4.6）。ボス 足場の番（Enemies・Troops 1151。宿帳を持っていれば戦いの頭に「一晩のみ」States 1151）。倒すとスイッチ 1154、北の口 → 183。"],
  ["w14_183_bell_root", 183, "境山の高み・鐘楼の根", "鐘楼の根", draw183, events183,
    "W14（#234）：鐘楼の根（場面表 4.7）。綱の巻き上げ（石工の工具 Items 1152 で直す。スイッチ 1155）、石工の工具、隊の最後の野営の跡、結界。北の石段 → 015。"],
  ["w14_015_summit", 15, "山の頂の鐘楼", "山の頂の鐘楼", () => draw015(Grid), events015,
    "W14（#234）：山の頂の鐘楼（場面表 5 章）。親鐘の肌（銘）・口（舌を吊る）・綱（三十と三十一）、ルシアン、ソレンヌ、ミルレーネ（真の結末のとき）、頂の群れ（10）。舌を吊ると耐える戦い「夜の思い」（Troops 1152）。綱のあと 010 の結末の夜へ。"],
];
const DECO_BY_LEGEND = { rampart: RAMPART_DECO, monastery: MONASTERY_DECO };
const WALLS = new Set(["#", "=", "_", " "]);
// 置き物の上に置いてよいイベント（置き物そのものを調べるもの）と、通れない文字の上に置いてよいイベント
const ON_DECO = new Set(["宿帳（帳場の台）", "氷室の橇", "王家の使いの机"]);
const ON_WALL = new Set(["親鐘の肌（銘）", "親鐘の口（舌を吊る）", "親鐘の綱"]); // 親鐘（鐘楼の石組み）の前の 1 行
const ON_SOLID = new Set(["使徒狩りの野営の跡（火床）"]);
for (const [name, mapId, mapName, displayName, draw, makeEvents, about] of MAPS) {
  const { g, d } = draw();
  const events = makeEvents();
  for (const ev of events) {
    if (ev.x === 0 && ev.y === 0) continue;
    const ch = g.get(ev.x, ev.y);
    if (ch === undefined) throw new Error(`${name}「${ev.name}」(${ev.x},${ev.y}) は地図の外`);
    if (WALLS.has(ch) && !ON_WALL.has(ev.name)) throw new Error(`${name}「${ev.name}」(${ev.x},${ev.y}) が壁「${ch}」の上`);
    if (ch === "f" && !ON_SOLID.has(ev.name)) throw new Error(`${name}「${ev.name}」(${ev.x},${ev.y}) が火床の上`);
    if (d.get(ev.x, ev.y) !== "." && !ON_DECO.has(ev.name)) throw new Error(`${name}「${ev.name}」(${ev.x},${ev.y}) に置き物「${d.get(ev.x, ev.y)}」`);
  }
  const look0 = lookOf(mapId);
  const floor = ",.";
  outputs.push({ file: srcPath(name, ".txt"), text: g.text() });
  outputs.push({ file: srcPath(name, ".deco.txt"), text: d.text() });
  outputs.push({ file: srcPath(name), text: sourceText(configOf(mapId, mapName, displayName, about, events, {
    deco: DECO_BY_LEGEND[look0.legend],
    scatter: [{ on: floor, z: 1, tiles: ["A2:15"], rate: 0.05, seed: mapId * 10 + 1 }],
  })) });
}

// 朝の砦から（場面表 7.2・7.3）：W7 の地図の設定は手で書いた物なので、ここで足す（ほかのレーンの地図は、その生成スクリプトが W14.patchLater を呼ぶ）
for (const name of ["w7_021_old_chapel", "w7_026_iron_mine"]) {
  const cfg = JSON.parse(fs.readFileSync(srcPath(name), "utf8"));
  patchLater(name, cfg);
  outputs.push({ file: srcPath(name), text: sourceText(cfg) });
}

// System.json（スイッチ・変数 1151–1200 の名前）
const sysPath = dataPath("System.json");
const system = JSON.parse(fs.readFileSync(sysPath, "utf8"));
for (const [key, names] of [["switches", SWITCH_NAMES], ["variables", VARIABLE_NAMES]]) {
  const arr = system[key];
  while (arr.length <= BAND[1]) arr.push("");
  for (let id = BAND[0]; id <= BAND[1]; id++) arr[id] = names[id] ?? "";
}
outputs.push({ file: sysPath, text: JSON.stringify(system) });

// ---------------------------------------------------------------------------
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const ROOT = path.resolve(dataPath("."), "..");
  let stale = 0;
  for (const { file, text } of outputs) {
    const rel = path.relative(ROOT, file);
    const current = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
    if (check) {
      if (current !== text) { console.error(`古い: ${rel}（node tools/maps/src/w14_data.mjs で書き直す）`); stale++; }
      else console.log(`一致: ${rel}`);
    } else if (current !== text) {
      fs.writeFileSync(file, text);
      console.log(`書き出し: ${rel}`);
    }
  }
  if (stale) process.exit(1);
}
