// W13（#192）寄り道 骨の鍛冶場（030 炉の間・031 骨置き場・032 狩人の寝床）の設定とデータを書く。何度走らせても同じ結果になる。
//   node tools/maps/src/w13_data.mjs           書く（このあと node tools/maps/build.mjs w13_030_forge_hall w13_031_bone_store w13_032_hunters_bed w7_026_iron_mine w7_027_mine_depths で地図を作る）
//   node tools/maps/src/w13_data.mjs --check   書かずに、今のファイルと同じかだけ見る（違えば終了コード 1）
// 書くもの（docs/ROADMAP.md の割り当て表の W13：スイッチ・変数・データベース・コモンイベント 1101–1150、マップ 030–032）：
//   tools/maps/src/w13_*.json      地図の設定（イベント・凡例の上書き・スタンプ）。地図（.txt・.deco.txt）は手で書く
//   tools/maps/src/w7_027_mine_depths.json・w7_026_iron_mine.json の出入口のイベント 1 つずつ（027 長屋の奥の下り口、026 鍛冶場の跡の奥の戸）。
//     ほかのイベントとタイル層は触らない（名前の同じイベントだけを置き直す）
//   Weapons・Skills・States・Enemies・Troops の 1101–1150
//   System.json の switches 1101–1150 の名前
// 文は docs/text.md 5.8（K-01〜K-05）と docs/world.md 5.1・5.2・5.5・8.3・11 章から。寄り道はこの中だけで終わる（world.md 5.10 の 2）。
// W7 の物は使うだけ：敵グループ 326 灰鼠・327 骨食み・328 骨の刃の狩人・330 骨鎧の狩人、技 323 骨の一閃、P9 の拾い物 143・196–200。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readData, formatTable, dataPath, extendTable } from "../../data/io.mjs";
import { SRC_DIR } from "../build.mjs";
import { fixW30 } from "./w30_parts.mjs"; // W30（#315）：見えない壁と、話すと姿が変わる人の直し
import { fixW31 } from "./w31_parts.mjs"; // W31（#326）：黒い丸の拾い物を宝箱に

const check = process.argv.includes("--check");
const outputs = []; // [{ file, text }]

// ---------------------------------------------------------------------------
// イベントの命令の部品（W10 と同じ形）
// ---------------------------------------------------------------------------
const cmd = (code, parameters, indent = 0) => ({ code, indent, parameters });
const END = cmd(0, []);
// 文章の 1 行は顔なしで全角 46 字まで（docs/knowhow.md 7.2）。制御文字 \I[n] は 1 字、\C[n] は 0 字と数える
const textWidth = s => [...s.replace(/\\C\[\d+\]/g, "").replace(/\\I\[\d+\]/g, "＊")].reduce((w, ch) => w + (/[ -~｡-ﾟ]/.test(ch) ? 0.5 : 1), 0);
const say = (lines, speaker = "", indent = 0) => {
  if (lines.length > 4) throw new Error(`1 ページは 4 行まで：${lines[0]}`);
  for (const l of lines) if (textWidth(l) > 46) throw new Error(`文が 46 字を超える：${l}`);
  return [cmd(101, ["", 0, 0, 2, speaker], indent), ...lines.map(l => cmd(401, [l], indent))];
};
const se = (name, indent = 0, volume = 90, pitch = 100) => cmd(250, [{ name, volume, pitch, pan: 0 }], indent);
const plugin = (name, command, label, args = {}, indent = 0) => [
  cmd(357, [name, command, label, args], indent),
  ...Object.entries(args).map(([k, v]) => cmd(657, [`${k} = ${v}`], indent)),
];
const switchOn = (id, indent = 0) => cmd(121, [id, id, 0], indent);
const switchOff = (id, indent = 0) => cmd(121, [id, id, 1], indent);
const selfOn = (ch = "A", indent = 0) => cmd(123, [ch, 0], indent);
const transfer = (mapId, x, y, d, indent = 0) => cmd(201, [0, mapId, x, y, d, 0], indent);
const ifSwitch = (id, on = true, indent = 0) => cmd(111, [0, id, on ? 0 : 1], indent);
const ifScript = (expr, indent = 0) => cmd(111, [12, expr], indent);
const ELSE = (indent = 0) => cmd(411, [], indent);
const ENDIF = (indent = 0) => cmd(412, [], indent);
const end = indent => cmd(0, [], indent);
const choice = (labels, cancel, indent = 0) => cmd(102, [labels, cancel, 0, 2, 0], indent);
const when = (i, label, indent = 0) => cmd(402, [i, label], indent);
const ENDCHOICE = (indent = 0) => cmd(404, [], indent);
const gainItem = (id, n = 1, indent = 0) => cmd(126, [id, 0, 0, n], indent);
const gainWeapon = (id, indent = 0) => cmd(127, [id, 0, 0, 1, false], indent);
const gainGold = (n, indent = 0) => cmd(125, [0, 0, n], indent);
const addNote = (id, text, indent = 0) => plugin("Hai_Thoughts", "addNote", "メモに足す", { text, id, kind: "clue" }, indent);

const DOWN = 2, LEFT = 4, RIGHT = 6, UP = 8;
const sourceText = cfg => JSON.stringify(cfg, null, 2) + "\n";
const srcPath = name => path.join(SRC_DIR, name + ".json");

// 絵（持ち主がエディタで決め直してよい。仮の絵。W7・W10 と同じもの）
const IMG = {
  thoughtMan: { characterName: "Damage1", characterIndex: 4, direction: DOWN, pattern: 1 }, // 残留思念（W7 の坑道と同じ、遺骸の絵）
  thoughtOld: { characterName: "Damage2", characterIndex: 6, direction: DOWN, pattern: 1 },
  chest: { characterName: "!Chest", characterIndex: 0, direction: DOWN, pattern: 0 },
  chestOpen: { characterName: "!Chest", characterIndex: 0, direction: UP, pattern: 0 },
  redChest: { characterName: "!Chest", characterIndex: 2, direction: DOWN, pattern: 0 },
  redChestOpen: { characterName: "!Chest", characterIndex: 2, direction: UP, pattern: 0 },
  sparkle: { characterName: "!Other1", characterIndex: 1, direction: DOWN, pattern: 1 }, // 光る点（拾える物）
  warp: { characterName: "!Other2", characterIndex: 3, direction: DOWN, pattern: 1 }, // 結界（W7 と同じ）
  doorShut: { characterName: "!Door1", characterIndex: 0, direction: DOWN, pattern: 0 },
  doorOpen: { characterName: "!Door1", characterIndex: 0, direction: UP, pattern: 0 },
  picker: { characterName: "People3", characterIndex: 1, direction: LEFT, pattern: 1 }, // 拾い屋（026 の見張りと同じ）
  hunterHead: { characterName: "Evil", characterIndex: 1, direction: UP, pattern: 1 }, // 狩人の頭（傷のある傭兵の絵。台に向かって背を見せる）
};

// ---------------------------------------------------------------------------
// ID（帯 1101–1150）
// ---------------------------------------------------------------------------
export const WEAPON = { boneGreatsword: 1101 };
export const SKILL = { sweep: 1101, scrape: 1102, brand: 1103 };
export const STATE = { stilled: 1101 };
export const ENEMY = { hunterHead: 1101, forgeHunter: 1102 };
export const TROOP = { hunterHead: 1101, forgeHunter: 1102 };
export const SW = { hunterHead: 1101, bedBar: 1102, hiltName: 1103, calledName: 1104 };
// W7 の物（使うだけ）
const W7_TROOP = { ashRats: 326, boneEater: 327, hunter: 328, boneArmor: 330 };
const W7_SKILL = { boneSlash: 323 };
const ITEM = { smelling: 143, herb: 196, antidote: 197, elixir: 198, bitterRoot: 199, mossAsh: 200 };

const SWITCH_NAMES = {
  1101: "ボス:狩人の頭（031）",
  1102: "鍛冶場:寝床の閂を外した（032→026 の近道）",
  1103: "鍛冶場:柄の名を読んだ（030 の柄の棚）",
  1104: "ボス:狩人の頭の名を呼んだ（戦いの頭に手が止まる）",
};
const VARIABLE_NAMES = {};

// ---------------------------------------------------------------------------
// マップと出入口
// ---------------------------------------------------------------------------
const MAP = { hall: 30, store: 31, bed: 32 };
const DEPTHS = { mapId: 27, hole: [2, 25], arrive: [3, 25] }; // 鉄の坑道・下層の長屋の奥（W7。南西の隅の廊下）
const MINE = { mapId: 26, door: [45, 4], arrive: [45, 5] }; // 鉄の坑道・上層の使徒狩りの鍛冶場の跡の、北の奥まり（W7）
const BED_BAR = [25, 8]; // 032 の東の古い坑道の閂の戸
const BOSS_AT = [20, 5]; // 031 の削り台の奥の口（赤い宝箱の小部屋の前）

// ---------------------------------------------------------------------------
// 説明と来歴（1 行は全角 40 字まで。docs/knowhow.md 5.1。骨の大剣は world.md 8.3 から写した）
// ---------------------------------------------------------------------------
const LORE = {
  "骨の大剣": {
    desc: ["攻撃が大きく上がる。両手で持つ。", "骨を継がずに削り出した大剣。柄に名が四つ。"],
    lore: ["骨は人のものではない。継ぎ目が無い。", "柄の名の一番上は、短剣の二番目と同じ。", "四つ目の名は、削りかけで止まっている。"],
  },
};
for (const [name, { desc, lore }] of Object.entries(LORE)) {
  for (const line of [...desc, ...lore]) {
    if ([...line].length > 40) throw new Error(`${name} の文が 40 字を超える：${line}`);
  }
}
const descOf = name => LORE[name].desc.join("\n");
const loreOf = name => ["<hai_lore>", ...LORE[name].lore, "</hai_lore>"].join("\n");

// ---------------------------------------------------------------------------
// データベースの共通（W10 と同じ。帯だけを書き直す）
// ---------------------------------------------------------------------------
const BAND = [1101, 1150];
function clearBand(table, makeEmpty) {
  extendTable(table, BAND[0] - 1, makeEmpty);
  for (let id = BAND[0]; id < table.length && id <= BAND[1]; id++) table[id] = makeEmpty(id);
  while (table.length - 1 >= BAND[0] && table.length - 1 <= BAND[1] && table[table.length - 1].name === "") table.pop();
}
function put(table, id, item, makeEmpty) {
  if (id < BAND[0] || id > BAND[1]) throw new Error(`${id} は W13 の帯の外`);
  extendTable(table, id, makeEmpty);
  table[id] = { ...makeEmpty(id), ...item, id };
}
const writeTable = (name, array) => outputs.push({ file: dataPath(name), text: formatTable(array) });

const ELEMENT = { fire: 2, ice: 3, thunder: 4, light: 8, dark: 9 };

// Weapons（骨の大剣。031 の赤い宝箱。両手で持つ＝盾の装備封印）
const emptyWeapon = id => ({
  id, animationId: 0, description: "", etypeId: 1, traits: [{ code: 31, dataId: 1, value: 0 }, { code: 22, dataId: 0, value: 0 }],
  iconIndex: 0, name: "", note: "", params: [0, 0, 0, 0, 0, 0, 0, 0], price: 0, wtypeId: 0,
});
const weapons = readData("Weapons.json");
clearBand(weapons, emptyWeapon);
put(weapons, WEAPON.boneGreatsword, {
  name: "骨の大剣", description: descOf("骨の大剣"), note: [loreOf("骨の大剣"), "<hai_unique>"].join("\n"),
  animationId: 7, iconIndex: 97, wtypeId: 2, params: [0, 0, 52, 0, 0, 0, -6, 0],
  traits: [{ code: 31, dataId: 1, value: 0 }, { code: 22, dataId: 0, value: 0 }, { code: 54, dataId: 2, value: 1 }],
}, emptyWeapon);
writeTable("Weapons.json", weapons);

// Skills（敵の技。欄は W7・W10 と同じ）
const emptySkill = id => ({
  id, animationId: 0, damage: { critical: false, elementId: 0, formula: "0", type: 0, variance: 20 },
  description: "", effects: [], hitType: 0, iconIndex: 0, message1: "", message2: "", mpCost: 0, name: "", note: "",
  occasion: 0, repeats: 1, requiredWtypeId1: 0, requiredWtypeId2: 0, scope: 1, speed: 0, stypeId: 0, successRate: 100,
  tpCost: 0, tpGain: 0, messageType: 1,
});
const skills = readData("Skills.json");
clearBand(skills, emptySkill);
const enemySkill = (name, o) => ({ name, occasion: 1, stypeId: 0, hitType: 1, note: "<hai_w13:敵の技>", ...o });
put(skills, SKILL.sweep, enemySkill("大剣の薙ぎ", {
  description: "骨の大剣で、前に立つ者をまとめて薙ぐ。", animationId: 7, iconIndex: 97, scope: 2, message1: "%1は大剣を横に振るった！",
  damage: { critical: false, elementId: -1, formula: "a.atk * 3 - b.def * 2", type: 1, variance: 20 },
}), emptySkill);
put(skills, SKILL.scrape, enemySkill("骨を削る", {
  description: "台の骨を削り、刃を研ぎ直す。攻撃が上がる。", animationId: 0, iconIndex: 0, hitType: 0, scope: 11, message1: "%1は台の骨を削りはじめた。",
  effects: [{ code: 31, dataId: 2, value1: 3, value2: 0 }],
}), emptySkill);
put(skills, SKILL.brand, enemySkill("焼き印", {
  description: "焼けた型を押し当てる。", animationId: 66, iconIndex: 64, scope: 1, message1: "%1は焼けた型を押し当てた！",
  damage: { critical: false, elementId: ELEMENT.fire, formula: "a.atk * 3 - b.def * 2", type: 1, variance: 20 },
}), emptySkill);
writeTable("Skills.json", skills);

// States（狩人の頭の名を呼ぶと、戦いの頭に手が止まる。text.md 5.8 の K-03「二番目の名を呼ぶと手が止まる」）
const emptyState = id => ({
  id, autoRemovalTiming: 0, chanceByDamage: 100, iconIndex: 0, maxTurns: 1, message1: "", message2: "", message3: "", message4: "",
  minTurns: 1, motion: 0, name: "", note: "", overlay: 0, priority: 50, releaseByDamage: false, removeAtBattleEnd: true,
  removeByDamage: false, removeByRestriction: false, removeByWalking: false, restriction: 0, stepsToRemove: 100, traits: [],
  messageType: 1,
});
const states = readData("States.json");
clearBand(states, emptyState);
put(states, STATE.stilled, {
  name: "手が止まる（狩人の頭）", iconIndex: 10, priority: 60, restriction: 4, motion: 3,
  message1: "", message2: "", message3: "%1の手は、骨の上で止まったままだ。", message4: "%1は、また刃を動かしはじめた。",
  autoRemovalTiming: 2, minTurns: 3, maxTurns: 3,
  traits: [{ code: 21, dataId: 3, value: 0.8 }],
  note: "<hai_w13:狩人の頭の名を呼んだとき、戦いの頭に付く>",
}, emptyState);
writeTable("States.json", states);

// Enemies・Troops（world.md 5.1・5.5。坑道の敵は「狩人の成れの果て」。そうとは書かない。数値は仮で、持ち主が調整する）
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
const base = [{ code: 22, dataId: 0, value: 0.95 }, { code: 22, dataId: 1, value: 0.05 }, { code: 31, dataId: 1, value: 0 }];
const act = (skillId, rating = 5) => ({ conditionParam1: 0, conditionParam2: 0, conditionType: 0, rating, skillId });
const onTurn = (skillId, a, b, rating = 5) => ({ conditionParam1: a, conditionParam2: b, conditionType: 1, rating, skillId });
const hpBelow = (skillId, rate, rating) => ({ conditionParam1: 0, conditionParam2: rate, conditionType: 2, rating, skillId });
const attack = act(1);
const drop = (kind, id, denominator) => [{ dataId: id, denominator, kind }, { dataId: 1, denominator: 1, kind: 0 }, { dataId: 1, denominator: 1, kind: 0 }];
const noDrop = drop(0, 1, 1);
const enemies = readData("Enemies.json");
clearBand(enemies, emptyEnemy);
// 狩人の頭（隠しボス。031 の削り台）。弱みは名（柄の棚の二つ目の名を呼ぶと、戦いの頭に「手が止まる」）。属性の穴は置かない
put(enemies, ENEMY.hunterHead, {
  name: "狩人の頭", battlerName: "Blackknight", battlerHue: 0, params: [4400, 0, 58, 40, 10, 24, 20, 30], exp: 480, gold: 340,
  traits: [...base, T.element(ELEMENT.dark, 0.5), T.stateRate(1, 0)],
  actions: [attack, act(W7_SKILL.boneSlash, 4), onTurn(SKILL.sweep, 3, 3, 6), hpBelow(SKILL.scrape, 0.5, 5)],
  dropItems: noDrop,
  note: ["<hai_boss>", "<hai_boss_name:狩人の頭>", `<hai_boss_switch:${SW.hunterHead}>`, "<hai_actions_low:2,30>", "<hai_drop:none>"].join("\n"),
}, emptyEnemy);
// 炉番の狩人（黄。030 の炉の間）
put(enemies, ENEMY.forgeHunter, {
  name: "炉番の狩人", battlerName: "Mercenary", battlerHue: 330, params: [520, 0, 36, 20, 8, 14, 16, 10], exp: 40, gold: 30,
  traits: [...base, T.element(ELEMENT.ice, 1.5)],
  actions: [attack, act(SKILL.brand, 4)],
  dropItems: drop(1, ITEM.smelling, 5),
}, emptyEnemy);
writeTable("Enemies.json", enemies);

const emptyTroop = id => ({
  id, members: [], name: "",
  pages: [{
    conditions: { actorHp: 50, actorId: 1, actorValid: false, enemyHp: 50, enemyIndex: 0, enemyValid: false, switchId: 1, switchValid: false, turnA: 0, turnB: 0, turnEnding: false, turnValid: false },
    list: [{ code: 0, indent: 0, parameters: [] }], span: 0,
  }],
});
const row = n => Array.from({ length: n }, (_, i) => ({ x: Math.round(640 + (i - (n - 1) / 2) * 200), y: 460 }));
const TROOPS = [
  [TROOP.hunterHead, "W13_ボス：狩人の頭", [ENEMY.hunterHead]],
  [TROOP.forgeHunter, "W13_黄：炉番の狩人", [ENEMY.forgeHunter]],
];
const troops = readData("Troops.json");
clearBand(troops, emptyTroop);
for (const [id, name, members] of TROOPS) {
  const pos = row(members.length);
  put(troops, id, { name, members: members.map((enemyId, i) => ({ enemyId, ...pos[i], hidden: false })) }, emptyTroop);
}
// 狩人の頭の言葉（text.md 4.11 の型。戦いの前 1〜2 行・中 1 行・崩れるとき 1 行。world.md 11 章に足した口調）
const tmsg = (indent, name, lines) => say(lines, name, indent);
const page0 = emptyTroop(0).pages[0];
troops[TROOP.hunterHead].pages = [
  { ...page0, conditions: { ...page0.conditions, switchId: SW.calledName, switchValid: true }, span: 0,
    list: [
      cmd(333, [-1, 0, STATE.stilled]),
      ...tmsg(0, "", ["狩人の頭の手は、刃を握ったまま動かない。"]),
      END,
    ] },
  { ...page0, conditions: { ...page0.conditions, turnA: 2, turnB: 3, turnValid: true }, span: 1,
    list: [...tmsg(0, "狩人の頭", ["骨運び。火を落とすな。次の骨を。"]), END] },
  { ...page0, conditions: { ...page0.conditions, enemyHp: 50, enemyIndex: 0, enemyValid: true }, span: 1,
    list: [
      ifScript("$gameTroop.members()[0].isAlive()"),
      ...tmsg(1, "狩人の頭", ["名は、上に彫れ。"]),
      end(1), ENDIF(), END,
    ] },
];
writeTable("Troops.json", troops);

// ---------------------------------------------------------------------------
// イベントの部品
// ---------------------------------------------------------------------------
const text = (name, [x, y], lines, extra = {}) => ({ name, type: "text", x, y, lines, ...extra });
const thought = (id, name, [x, y], lines, image, note = "") => ({
  name: `思念 ${id} ${name}`, type: "text", x, y, note: `<hai_thought:${id}>${note}`, image, lines,
});
// 調べると一行出る置物（タイルの絵）。絵の無いもの（炉の前）は、通れないマスに置く見えない置物
const look = (name, [x, y], lines, tileId = null) => ({
  name, type: "raw", x, y, pages: [{ ...(tileId ? { image: { tileId } } : {}), priorityType: 1, list: [...say(lines), END] }],
});
const exit = (name, [x, y], mapId, tx, ty, d) => ({ name, type: "transfer", x, y, to: [mapId, tx, ty, d] });
const chestEvent = (name, [x, y], gainList, gotText, red = false) => ({
  name: red ? `赤い宝箱（${name}）` : `宝箱（${name}）`, type: "raw", x, y,
  pages: [
    { image: red ? IMG.redChest : IMG.chest, priorityType: 1, walkAnime: false,
      list: [se("Chest1"), ...gainList, selfOn(), ...say([gotText]), END] },
    { conditions: { selfSwitchCh: "A", selfSwitchValid: true }, image: red ? IMG.redChestOpen : IMG.chestOpen, priorityType: 1, walkAnime: false },
  ],
});
const chestItem = (name, xy, id, n, icon) => chestEvent(name, xy, [gainItem(id, n)], `\\I[${icon}]${name}${n > 1 ? `×${n}` : ""}を手に入れた。`);
const chestGold = (xy, n) => chestEvent("鉄くず", xy, [gainGold(n)], `鉄くずを ${n} 手に入れた。`);
const pickup = (name, [x, y], gainList) => ({
  name: `拾い物（${name}）`, type: "raw", x, y,
  pages: [
    { image: IMG.sparkle, priorityType: 1, stepAnime: true, walkAnime: false, list: [se("Item3"), ...gainList, selfOn(), END] },
    { conditions: { selfSwitchCh: "A", selfSwitchValid: true }, priorityType: 0 },
  ],
});
const pickItem = (name, xy, id, n, icon) => pickup(name, xy, [gainItem(id, n), ...say([`\\I[${icon}]${name}${n > 1 ? `×${n}` : ""}を手に入れた。`])]);
const pickGold = (xy, n) => pickup("鉄くず", xy, [gainGold(n), ...say([`鉄くずを ${n} 手に入れた。`])]);
const warp = (name, [x, y]) => ({
  name: `結界（${name}）`, type: "raw", x, y, note: `<hai_warp:${name}>`,
  pages: [{ image: IMG.warp, priorityType: 1, stepAnime: true, list: [END] }],
});
// シンボル敵（docs/plugins/Hai_SymbolEnemy.md。緑は往復かランダム、赤は持ち場から出ない。緑は <hai_enemy_hesitate>）
const ENEMY_IMG = {
  [W7_TROOP.ashRats]: { characterName: "Monster", characterIndex: 0 }, // W7 の 026・027 と同じ絵
  [W7_TROOP.boneEater]: { characterName: "Monster", characterIndex: 6 },
  [W7_TROOP.hunter]: { characterName: "Evil", characterIndex: 2 },
  [W7_TROOP.boneArmor]: { characterName: "Evil", characterIndex: 5 },
  [TROOP.forgeHunter]: { characterName: "Evil", characterIndex: 0 },
};
const NAMES = {
  [W7_TROOP.ashRats]: "灰鼠", [W7_TROOP.boneEater]: "骨食み", [W7_TROOP.hunter]: "骨の刃の狩人", [W7_TROOP.boneArmor]: "骨鎧の狩人",
  [TROOP.forgeHunter]: "炉番の狩人",
};
const routeOf = steps => ({ list: [...steps.map(code => ({ code, parameters: [] })), { code: 0, parameters: [] }], repeat: true, skippable: true, wait: false });
const MOVE = { down: 1, left: 2, right: 3, up: 4 };
/** 敵。kind は "random"（ランダム）・"fixed"（固定）・{ dir: "right", n: 4 }（往復） */
const foe = (troopId, rank, [x, y], kind = "random", chase = null) => {
  const rankName = { green: "緑", yellow: "黄", red: "赤" }[rank];
  const page = { image: { ...ENEMY_IMG[troopId], direction: DOWN, pattern: 1 }, priorityType: 1, moveSpeed: 3, trigger: 2, moveFrequency: 3 };
  let label = "";
  if (kind === "random") { page.moveType = 1; }
  else if (kind === "fixed") { page.moveType = 0; label = "・番兵"; }
  else {
    const back = { right: "left", left: "right", up: "down", down: "up" }[kind.dir];
    page.moveType = 3; page.moveFrequency = 4;
    page.moveRoute = routeOf([...Array(kind.n).fill(MOVE[kind.dir]), ...Array(kind.n).fill(MOVE[back])]);
    label = "・往復";
  }
  const note = [`<hai_enemy:${troopId},${rank}>`, ...(chase !== null ? [`<hai_enemy_chase:${chase}>`] : []), ...(rank === "green" ? ["<hai_enemy_hesitate>"] : [])].join("\n");
  return { name: `${NAMES[troopId]}（${rankName}${label}）`, type: "raw", x, y, note, pages: [page] };
};
const bossBattle = (troopId, [mapId, x, y, d], indent = 0) => plugin("Hai_Boss", "bossBattle", "ボス戦",
  { troopId: String(troopId), escapeMapId: String(mapId), escapeX: String(x), escapeY: String(y), escapeDirection: String(d) }, indent);

// 見た目（docs/look.md 1 章の表：タイルセット 13 V_鉄の坑道は 026–032。3 章の坑道の色調・戦闘の背景にそろえる）
const MINE_LOOK = {
  legend: "dungeon", tilesetId: 13,
  fields: { specifyBattleback: true, battleback1Name: "DirtCave", battleback2Name: "DirtCave" },
};
const CHARS = {
  ";": { name: "土の床の汚れ（煤）", as: ",", tiles: [null, "A2:15"] },
};
// 置き物（重ね書き）。W7 の坑道（026・027・029）と同じタイル
const DECO = {
  t: { name: "テーブル（廃墟。通れない）", z2: "B:243" },
  h: { name: "椅子（廃墟）", z2: "B:251" },
  x: { name: "骸骨A（通れない）", z2: "B:242" },
  X: { name: "骸骨B（通れない）", z2: "B:250" },
  q: { name: "瓦礫の上の骸骨（通れない）", z2: "B:120", z3: "B:242" },
  r: { name: "瓦礫A（通れない）", z2: "B:120" },
  c: { name: "木箱A（通れない）", z2: "B:220" },
  C: { name: "木箱C（廃墟。通れない）", z2: "B:222" },
  b: { name: "樽A（通れない）", z2: "B:238" },
  p: { name: "壺A（廃墟。通れない）", z2: "B:223" },
  e: { name: "端材（通れない）", z2: "B:125" },
  s: { name: "スコップ（通れない）", z2: "B:232" },
  S: { name: "つるはし（通れない）", z2: "B:233" },
  l: { name: "ロープ（通れない）", z2: "B:234" },
  g: { name: "土砂A（炭の山。通れない）", z2: "B:216" },
  G: { name: "土砂B（石。通れない）", z2: "B:217" },
  k: { name: "砂利A（通れる）", z2: "B:32" },
  K: { name: "砂利B（通れる）", z2: "B:33" },
  Y: { name: "むしろの寝床", z2: "C:151" },
};
const STAMPS = [
  { at: "炉", name: "鍛冶の炉（暖炉C（鉄）。1×2。W7 の 026 と同じ）", tiles: [["E:188"], ["E:196"]] },
  { at: "床", name: "寝台（粗末なベッド）", tiles: [["C:150"]] },
];

// ===========================================================================
// 030 骨の鍛冶場・炉の間（50×40。暗がり 4）
// ===========================================================================
// 柄の棚：二つ目の名（狩人の頭の名）を読むと、狩人の頭の前で「名を呼ぶ」が出る（スイッチ 1103）
const hiltShelf = {
  name: "柄の棚", type: "raw", x: 44, y: 3,
  pages: [{ image: { tileId: "C:205" }, priorityType: 1,
    list: [
      ...say(["棚に、削り終えた骨の柄が七本並んでいる。", "どの柄にも、使う人の名と、削った職人の名が彫ってある。職人の名は、七本とも「オスヴァル」。"]),
      switchOn(SW.hiltName),
      ...addNote("w13:hilt", "柄の職人の名は、七本とも「オスヴァル」（骨の鍛冶場・炉の間の棚）"),
      END,
    ] }],
};
// 拾い屋の使い（world.md 5.4「マルゴの買い付けの使い」。026 の拾い屋の見張りと同じ口調）
const picker = {
  name: "拾い屋の使い", type: "raw", x: 45, y: 14,
  pages: [
    { image: IMG.picker, priorityType: 1,
      list: [
        ...say(["マルゴの言いつけで、骨の大剣を買い付けに来たんだよ。", "持ち主は奥の骨置き場にいる。台から離れないから、値の話ができない。"], "拾い屋"),
        selfOn(), END,
      ] },
    { conditions: { selfSwitchCh: "A", selfSwitchValid: true }, image: IMG.picker, priorityType: 1,
      list: [...say(["大剣一本で、麦が半年分。マルゴはそう言ってる。", "持ち主が売るって言うまで、ここで待つ。今日で四日目。"], "拾い屋"), END] },
    { conditions: { switch1Id: SW.hunterHead, switch1Valid: true }, image: IMG.picker, priorityType: 1,
      list: [...say(["崩れたの。じゃあ、誰から買えばいいんだろ。", "マルゴには、売る人がいなくなったって言っとく。"], "拾い屋"), END] },
  ],
};
const hallEvents = [
  { name: "梯子（長屋の床下へ）", type: "raw", x: 4, y: 2,
    pages: [{ image: { tileId: "B:18" }, priorityType: 0, trigger: 1, list: [se("Move1"), transfer(DEPTHS.mapId, ...DEPTHS.arrive, RIGHT), END] }] },
  ...[16, 17, 18].map((y, i) => exit("東の口（骨置き場へ）", [49, y], MAP.store, 1, 13 + i, "right")),
  ...[24, 25].map((x, i) => exit("南の口（狩人の寝床へ）", [x, 39], MAP.bed, 12 + i, 1, "down")),
  warp("骨の鍛冶場", [41, 16]),
  text("焼き印の型", [30, 6], [
    "炉の脇の壁に、骨に押す焼き印の型が三つ掛かっている。",
    "「砦」と「帝国」と、印の無い型。印の無い型だけ、柄がすり減って黒く光る。",
  ], { image: { tileId: "B:125" } }),
  text("骨を削った台", [21, 12], [
    "骨を削るための台。面が、骨の形に浅くえぐれている。",
    "台の下の削り屑は白く、指でつまむと灰より軽い。",
  ], { image: { tileId: "B:243" } }),
  look("冷えた炉", [22, 7], ["炉の灰は冷えている。かき分けると、溶けずに残った骨の欠片が出てきた。"]),
  look("割れた木箱", [6, 13], ["木箱の中は空だ。底に、骨の粉が白く溜まっている。"], "C:222"),
  look("炭の山", [36, 31], ["炭の山。崩れた所に、炭を掻く鉤が刺さったままだ。"], "B:216"),
  look("削り損ねた骨", [8, 33], ["削り損ねた骨が、壁際に積んである。どれも端が欠けている。"], "B:250"),
  hiltShelf,
  picker,
  thought("K-01", "狩人の頭の弟子", [38, 18], [
    "頭は削り台から離れなかった。飯も、台の端で食った。",
    "「次の骨を」と言われるたびに、骨置き場から一本担いできた。",
    "十九本目を台に載せた晩、荷紐を切って、上の坑道へ出た。",
  ], IMG.thoughtMan),
  chestItem("薬草", [3, 12], ITEM.herb, 2, 176),
  chestGold([46, 9], 120),
  chestItem("苦い根", [5, 31], ITEM.bitterRoot, 2, 189),
  chestItem("秘薬", [48, 33], ITEM.elixir, 1, 179),
  pickGold([33, 26], 40),
  pickItem("灰の苔", [12, 35], ITEM.mossAsh, 1, 190),
  foe(W7_TROOP.boneEater, "green", [6, 17]),
  foe(W7_TROOP.ashRats, "green", [32, 24]),
  foe(TROOP.forgeHunter, "yellow", [18, 21], { dir: "right", n: 6 }),
  foe(W7_TROOP.hunter, "yellow", [43, 6]),
  foe(TROOP.forgeHunter, "yellow", [6, 34]),
  foe(W7_TROOP.boneArmor, "red", [38, 33], "fixed", 2),
];
const hallConfig = {
  _説明: "W13（#192）：骨の鍛冶場・炉の間（docs/world.md 5.2 の 030、docs/mapdesign.md 10.1 の寄り道のダンジョン）。北西の梯子→027 長屋の奥、炉が三つと焼き印の型（K-02）、骨を削った台、北東の仕上げ場に柄の棚（狩人の頭の名。スイッチ 1103）、東の口→031（手前に結界・拾い屋の使い・弟子の思念 K-01）、南の口→032、南東の炭置き場の奥に見えない通路。この設定は node tools/maps/src/w13_data.mjs が書く。",
  mapId: MAP.hall, name: "骨の鍛冶場・炉の間", displayName: "骨の鍛冶場", ...MINE_LOOK,
  note: "<hai_tone:-68,-85,-102,68>\n<hai_dark:4>",
  bgm: { name: "Dungeon2", volume: 60, pitch: 100, pan: 0 },
  bgs: { name: "Fire1", volume: 25, pitch: 100, pan: 0 },
  chars: CHARS, deco: DECO, stamps: [...STAMPS],
  scatter: [
    { on: ",", tiles: ["B:32", "B:33", "B:32", "B:33"], rate: 0.12, seed: 3001 },
    { on: ".", z: 1, tiles: ["A2:15"], rate: 0.06, seed: 3002 },
  ],
  events: hallEvents,
};

// ===========================================================================
// 031 骨の鍛冶場・骨置き場（40×30）：隠しボス 狩人の頭、赤い宝箱「骨の大剣」
// ===========================================================================
const hunterHead = {
  name: "狩人の頭", type: "raw", x: BOSS_AT[0], y: BOSS_AT[1],
  pages: [
    { image: IMG.hunterHead, priorityType: 1,
      list: [
        // 寄り道の隠しボス（HP 4400）。地域一の二人で挑めるので、挑むかを選ぶ前に強さを物で知らせる（W27 #300。R3 で二人で 2 回全滅）
        ...say(["削り台の前に、背を丸めた大きな影が立っている。", "台の上の骨を刃で削り続けて、こちらを見ない。", "足もとに、割れた盾が四枚重ねてある。四枚とも一太刀で割られている。"]),
        ...say(["骨運び。次の骨を。"], "狩人の頭"),
        switchOff(SW.calledName),
        ifSwitch(SW.hiltName),
        choice(["押し通る", "名を呼ぶ", "やめる"], 2, 1),
        when(0, "押し通る", 1), end(2),
        when(1, "名を呼ぶ", 1),
        ...say(["柄の職人の名を、声に出して呼んだ。"], "", 2),
        se("Bell3", 2, 70, 70),
        ...say(["刃が、削りかけの骨の上で止まった。肩が、一度だけ上がった。"], "", 2),
        switchOn(SW.calledName, 2),
        end(2),
        when(2, "やめる", 1),
        cmd(115, [], 2), end(2),
        ENDCHOICE(1),
        end(1),
        ELSE(),
        choice(["押し通る", "やめる"], 1, 1),
        when(0, "押し通る", 1), end(2),
        when(1, "やめる", 1),
        cmd(115, [], 2), end(2),
        ENDCHOICE(1),
        end(1),
        ENDIF(),
        ...bossBattle(TROOP.hunterHead, [MAP.store, 20, 10, DOWN]),
        ifScript("Hai.Boss.lastResult() === 0"),
        ...say(["次の……"], "狩人の頭", 1),
        ...say(["狩人の頭は、台に手をついたまま崩れた。", "奥の口が空いた。"], "", 1),
        end(1),
        ENDIF(),
        END,
      ] },
    { conditions: { switch1Id: SW.hunterHead, switch1Valid: true }, priorityType: 0 },
  ],
};
const storeEvents = [
  ...[13, 14, 15].map((y, i) => exit("西の口（炉の間へ）", [0, y], MAP.hall, 48, 16 + i, "left")),
  hunterHead,
  chestEvent("骨の大剣", [20, 3], [gainWeapon(WEAPON.boneGreatsword)], "\\I[97]骨の大剣を手に入れた。", true),
  text("削り台", [22, 6], [
    "削り台の上に、骨が一本載っている。",
    "半分まで削ったところで、刃の跡が止まっている。",
  ], { image: { tileId: "B:243" } }),
  look("骨の列", [13, 11], ["骨が長さの順に並べてある。いちばん長い骨の列だけ、途中で終わっている。"], "B:250"),
  thought("K-06", "骨置き場の番", [33, 22], [
    "骨は長さで並べる。腕より長いのは頭の台へ。短いのは短剣に回す。",
    "長いのは、あと三本。",
  ], IMG.thoughtOld),
  chestItem("気付け薬", [5, 22], ITEM.smelling, 2, 176),
  pickGold([28, 25], 60),
  foe(W7_TROOP.boneEater, "green", [12, 21]),
  foe(W7_TROOP.boneEater, "green", [28, 17]),
];
const storeConfig = {
  _説明: "W13（#192）：骨の鍛冶場・骨置き場（docs/world.md 5.2 の 031・5.5 の隠しボス）。西の口→030、骨の山の洞、北の削り台の段に狩人の頭（隠しボス。スイッチ 1101。柄の名を読んでいれば「名を呼ぶ」でスイッチ 1104）、その奥の小部屋に赤い宝箱（骨の大剣）。思念 K-06。この設定は node tools/maps/src/w13_data.mjs が書く。",
  mapId: MAP.store, name: "骨の鍛冶場・骨置き場", displayName: "骨の鍛冶場・骨置き場", ...MINE_LOOK,
  note: "<hai_tone:-85,-85,-102,85>",
  bgm: { name: "Dungeon3", volume: 60, pitch: 90, pan: 0 },
  bgs: { name: "Darkness", volume: 30, pitch: 100, pan: 0 },
  chars: CHARS, deco: DECO, stamps: [...STAMPS],
  scatter: [{ on: ",", tiles: ["B:32", "B:33", "B:32", "B:33"], rate: 0.12, seed: 3101 }],
  events: storeEvents,
};

// ===========================================================================
// 032 狩人の寝床（27×17）：鞘の型（K-05）、帰りの近道→026 の鍛冶場の跡（閂。スイッチ 1102）
// ===========================================================================
const bedBar = {
  name: "古い坑道の閂（鍛冶場の跡へ）", type: "raw", x: BED_BAR[0], y: BED_BAR[1],
  pages: [
    { image: IMG.doorShut, priorityType: 1, walkAnime: false,
      list: [
        ...say(["古い坑道の口を、板の戸で塞いである。閂はこちら側に掛かっている。", "戸の隙間から、上の坑道の風が来る。"]),
        choice(["閂を外す", "やめる"], 1),
        when(0, "閂を外す"),
        se("Open1", 1),
        switchOn(SW.bedBar, 1),
        ...say(["閂を外した。戸の向こうに、上りの坑道が続いている。"], "", 1),
        end(1),
        when(1, "やめる"), end(1),
        ENDCHOICE(),
        END,
      ] },
    { conditions: { switch1Id: SW.bedBar, switch1Valid: true }, image: IMG.doorOpen, priorityType: 0, trigger: 1, walkAnime: false,
      list: [se("Move1"), transfer(MINE.mapId, ...MINE.arrive, DOWN), END] },
  ],
};
const bedEvents = [
  ...[12, 13].map((x, i) => exit("北の口（炉の間へ）", [x, 0], MAP.hall, 24 + i, 38, "up")),
  bedBar,
  text("鞘の型", [19, 5], [
    "壁に、骨の剣の鞘を合わせる木の型が掛かっている。",
    "型は二つ分。片方だけ、型の内側が手の脂で黒い。",
  ], { image: { tileId: "B:125" } }),
  thought("K-07", "頭の隣で寝た狩人", [8, 10], [
    "頭は寝床でも柄を握って寝た。指を外してやるのが、俺の夜の番だった。",
    "指を五本とも外して、柄を横に置く。朝には、また四本で握っている。",
  ], IMG.thoughtMan),
  look("むしろの寝床", [12, 12], ["むしろの寝床。枕の代わりに、砥石が一つ置いてある。"], "C:151"),
  chestItem("毒消し", [21, 7], ITEM.antidote, 2, 177),
];
const bedConfig = {
  _説明: "W13（#192）：狩人の寝床（docs/world.md 5.2 の 032）。北の口→030、寝床と鞘の型（K-05）、思念 K-07、東の古い坑道の閂（スイッチ 1102）→026 の使徒狩りの鍛冶場の跡の奥（帰りの近道。026 の側の戸は閂を外したあとだけ開く）。この設定は node tools/maps/src/w13_data.mjs が書く。",
  mapId: MAP.bed, name: "狩人の寝床", displayName: "狩人の寝床", ...MINE_LOOK,
  note: "<hai_tone:-85,-85,-102,68>\n<hai_dark:5>",
  bgm: { name: "Dungeon2", volume: 55, pitch: 100, pan: 0 },
  bgs: { name: "Drips", volume: 35, pitch: 100, pan: 0 },
  chars: CHARS, deco: DECO, stamps: [...STAMPS],
  scatter: [{ on: ",", tiles: ["B:32", "B:33"], rate: 0.1, seed: 3201 }],
  events: bedEvents,
};

// ===========================================================================
// 027・026 の出入口（W7 の設定に 1 つずつ足す。名前の同じイベントを置き直すので、何度走らせても同じ）
// ===========================================================================
const depthsHole = {
  name: "長屋の奥の下り口（骨の鍛冶場へ）", type: "raw", x: DEPTHS.hole[0], y: DEPTHS.hole[1], note: "",
  pages: [{ image: { tileId: "B:31" }, priorityType: 0, trigger: 1, list: [se("Move1"), transfer(MAP.hall, 4, 3, DOWN), END] }],
};
const mineDoor = {
  name: "奥まりの板戸（狩人の寝床へ）", type: "raw", x: MINE.door[0], y: MINE.door[1], note: "",
  pages: [
    { image: IMG.doorShut, priorityType: 1, walkAnime: false,
      list: [...say(["奥まりの岩の間に、板の戸がはまっている。", "向こう側から閂が掛かっていて、動かない。下から風が来る。"]), END] },
    { conditions: { switch1Id: SW.bedBar, switch1Valid: true }, image: IMG.doorOpen, priorityType: 0, trigger: 1, walkAnime: false,
      list: [se("Move1"), transfer(MAP.bed, BED_BAR[0] - 1, BED_BAR[1], LEFT), END] },
  ],
};
function patchW7(name, event) {
  const cfg = JSON.parse(fs.readFileSync(srcPath(name), "utf8"));
  const i = cfg.events.findIndex(e => e.name === event.name);
  if (i >= 0) cfg.events[i] = event; else cfg.events.push(event);
  return cfg;
}

// ---------------------------------------------------------------------------
// 設定を書く
// ---------------------------------------------------------------------------
const CONFIGS = {
  w13_030_forge_hall: hallConfig,
  w13_031_bone_store: storeConfig,
  w13_032_hunters_bed: bedConfig,
  w7_027_mine_depths: patchW7("w7_027_mine_depths", depthsHole),
  w7_026_iron_mine: patchW7("w7_026_iron_mine", mineDoor),
};
// イベントの座標が地図の床（壁でないマス）にあるか、重ね書きの置き物と重ならないかを確かめる（打ち間違いを早く見つけるため）
for (const [name, cfg] of Object.entries(CONFIGS)) {
  const read = ext => fs.existsSync(path.join(SRC_DIR, name + ext)) ? fs.readFileSync(path.join(SRC_DIR, name + ext), "utf8").replace(/\n$/, "").split("\n").map(l => [...l]) : null;
  const lines = read(".txt");
  const deco = read(".deco.txt");
  const seen = new Set();
  const mine = name.startsWith("w13_") ? cfg.events : cfg.events.filter(e => e === depthsHole || e === mineDoor);
  for (const ev of cfg.events) {
    if (ev.x === undefined) continue;
    const key = `${ev.x},${ev.y}`;
    if (seen.has(key)) throw new Error(`${name}「${ev.name}」(${key}) にイベントが二つ`);
    seen.add(key);
    if (!mine.includes(ev)) continue;
    const ch = lines[ev.y]?.[ev.x];
    if (ch === undefined) throw new Error(`${name}「${ev.name}」(${ev.x},${ev.y}) は地図の外`);
    if (ch === "#") throw new Error(`${name}「${ev.name}」(${ev.x},${ev.y}) が壁の上`);
    if (deco && deco[ev.y][ev.x] !== ".") throw new Error(`${name}「${ev.name}」(${ev.x},${ev.y}) が置き物「${deco[ev.y][ev.x]}」の上`);
  }
  // スタンプは、その地図（.txt か .deco.txt）に文字があるものだけを残す（build.mjs は使わないスタンプを落とす）
  if (name.startsWith("w13_")) {
    const all = [lines, deco].filter(Boolean).flat(2).join("");
    cfg.stamps = cfg.stamps.filter(st => all.includes(st.at));
    if (!cfg.stamps.length) delete cfg.stamps;
  }
  outputs.push({ file: srcPath(name), text: sourceText(fixW31(name, fixW30(name, cfg))) });
}

// ---------------------------------------------------------------------------
// System.json（スイッチ・変数 1101–1150 の名前）
// ---------------------------------------------------------------------------
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
      if (current !== text) { console.error(`古い: ${rel}（node tools/maps/src/w13_data.mjs で書き直す）`); stale++; }
      else console.log(`一致: ${rel}`);
    } else if (current !== text) {
      fs.writeFileSync(file, text);
      console.log(`書き出し: ${rel}`);
    }
  }
  if (stale) process.exit(1);
}
