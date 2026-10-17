// W11（#191）門叩きの縄張り（170–173）と最後の地域の山場の地図・設定・データを書く。何度走らせても同じ結果になる。
//   node tools/maps/src/w11_data.mjs           書く（このあと node tools/maps/build.mjs w11_170_lair_edge w11_171_eaten_corridor w11_172_mass w11_173_return で地図を作る）
//   node tools/maps/src/w11_data.mjs --check   書かずに、今のファイルと同じかだけ見る（違えば終了コード 1）
// 書くもの（docs/ROADMAP.md の割り当て表の W11：スイッチ・変数・データベース・コモンイベント 701–800、マップ 170–173）：
//   tools/maps/src/w11_17*.txt・.deco.txt・.json   地図（文字マップはこのスクリプトが描く）と設定
//   Skills・Weapons・Enemies・Troops の 701–800、System.json の switches・variables 701–800 の名前
// 084・094・104 の霧の戸口と鐘番の思念の 2 ページ目は tools/maps/src/w11_parts.mjs（w8_maps・w10_data・w9_data が読む）。
// 文は docs/world.md 3.6・3.7・6.5・8.3・10〜11 章、docs/text.md 4.14・4.16・5.5 から。縄張りの中の思念は書き下ろさない（その地域で読んだ思念の一行の再掲だけ）。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readData, formatTable, dataPath, extendTable } from "../../data/io.mjs";
import { SRC_DIR } from "../build.mjs";
import { fixW30 } from "./w30_parts.mjs"; // W30（#315）：見えない壁と、話すと姿が変わる人の直し
import { fixW31 } from "./w31_parts.mjs"; // W31（#326）：黒い丸の拾い物を宝箱に
import { say, plugin, byLastRegion, REGIONS, REGION_KEYS, LAIR_MAP, FLAG } from "./w11_parts.mjs";

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
const ifScript = (expr, indent = 0) => cmd(111, [12, expr], indent);
const ELSE = (indent = 0) => cmd(411, [], indent);
const ENDIF = (indent = 0) => cmd(412, [], indent);
const comment = (text, indent = 0) => cmd(108, [text], indent);
const transfer = (mapId, x, y, d, indent = 0) => cmd(201, [0, mapId, x, y, d, 0], indent);
const gainItem = (id, n = 1, indent = 0) => cmd(126, [id, 0, 0, n], indent);
const gainWeapon = (id, indent = 0) => cmd(127, [id, 0, 0, 1, false], indent);
const gainGold = (n, indent = 0) => cmd(125, [0, 0, n], indent);
const knock = (indent = 0, volume = 70) => [se("Knock", indent, volume, 80), wait(18, indent), se("Knock", indent, volume, 80), wait(18, indent), se("Knock", indent, volume, 80), wait(24, indent)];
/** スクリプト（355 と続きの 655） */
const script = (src, indent = 0) => src.trim().split("\n").map((line, i) => cmd(i ? 655 : 355, [line], indent));
const bossBattle = (troopId, [mapId, x, y, d], indent = 0) => plugin("Hai_Boss", "bossBattle", "ボス戦",
  { troopId: String(troopId), escapeMapId: String(mapId), escapeX: String(x), escapeY: String(y), escapeDirection: String(d) }, indent);

const DOWN = 2, LEFT = 4, RIGHT = 6, UP = 8;
const sourceText = cfg => JSON.stringify(cfg, null, 2) + "\n";
const srcPath = (name, ext = ".json") => path.join(SRC_DIR, name + ext);

// 絵（持ち主がエディタで決め直してよい。仮の絵）
const IMG = {
  fog: { characterName: "!Other2", characterIndex: 6, direction: DOWN, pattern: 1 }, // 霧（白い煙。!Other2 の 6 番の下向き）
  faint: { characterName: "!Flame", characterIndex: 4, direction: DOWN, pattern: 1 }, // 薄い思念
  sparkle: { characterName: "!Other1", characterIndex: 1, direction: DOWN, pattern: 1 }, // 光る点（拾える物）
  chest: { characterName: "!Chest", characterIndex: 0, direction: DOWN, pattern: 0 },
  chestOpen: { characterName: "!Chest", characterIndex: 0, direction: UP, pattern: 0 },
  redChest: { characterName: "!Chest", characterIndex: 2, direction: DOWN, pattern: 0 },
  redChestOpen: { characterName: "!Chest", characterIndex: 2, direction: UP, pattern: 0 },
  warp: { characterName: "!Other2", characterIndex: 3, direction: DOWN, pattern: 1 }, // 結界（W7 と同じ）
  shade: { characterName: "Monster", characterIndex: 5, direction: DOWN, pattern: 1 }, // 声だけの影（フードの影。半透明はプラグイン）
  mass: { characterName: "$BigMonster2", characterIndex: 0, direction: DOWN, pattern: 1 }, // 門叩きが抱えた思いの塊
  gensai: { characterName: "People4", characterIndex: 6, direction: DOWN, pattern: 1 }, // W8 と同じ
  elder: { characterName: "People3", characterIndex: 0, direction: DOWN, pattern: 1 }, // W9 と同じ
  bonePicker: { characterName: "Evil", characterIndex: 3, direction: LEFT, pattern: 1 }, // W10 と同じ
  lamp: { characterName: "!Flame", characterIndex: 0, direction: DOWN, pattern: 1 },
};

// ---------------------------------------------------------------------------
// ID（W11 の帯 701–800）
// ---------------------------------------------------------------------------
export const WEAPON = { carvingKnife: 701 };
export const SKILL = { callingVoice: 701, layeredVoices: 702, swallow: 703 };
export const ENEMY = { shade: 701, thickShade: 702, mass: 703 };
export const TROOP = { shade: 701, thickShade: 702, mass: 703 };
// スイッチ（701–800）。702–704 は w11_parts.mjs の REGIONS[].back と同じ
export const SW = { mass: 701, backWest: 702, backSouth: 703, backEast: 704, knife1: 705, knife2: 706, knife3: 707, voice: 708, shadeFirst: 711 };
// P の帯（使うだけ）：使徒の力（P12）、拾い物（P9）、鐘番の角灯（W7）
const APOSTLE_SWITCH = 162;
// 加入（P11。読むだけ）：W14 が場面表 3.3〜3.7 の仲間の一言に使う
const FLAG_BRUNO = 138, FLAG_NORA = 139, FLAG_DIL = 140, FLAG_ZELINA = 141, FLAG_ANSELMO = 142, FLAG_BELTRAN = 143, FLAG_TURA = 144;
const ITEM = { herb: 196, antidote: 197, elixir: 198, bitterRoot: 199, mossAsh: 200, lantern: 322 };
const ITEM_NAME = { 196: ["薬草", 176], 197: ["毒消し", 177], 198: ["秘薬", 179], 199: ["苦い根", 189] };
const PRIEST_FAINT = "F12";

// ---------------------------------------------------------------------------
// 地域ごとに替える文（docs/text.md 5.5 の a・b・c。d〜g は同じ）
//   lines：その地域で読んだ思念の一行の再掲（読んでいない思念の一行は漏れない）。0〜3 は廊下 171 の声だけの影、4・5 は塊が戦いの中で漏らす
// ---------------------------------------------------------------------------
const LOCAL = {
  west: {
    person: { name: "ゲンサイ", image: IMG.gensai, xy: [5, 18], lines: [["夜が長うなった。経典どおりや。", "わしの灯は、ここまでや。ほな、帰って灰の祈りをするわ。"]] },
    voice: "戸を開けておくれ。中で、待っている。", // 一つ目の声（写字生）。場面表 3.3
    lines: [
      ["R2-01", "戸を三度、叩かれた。去年の秋に祠へ行った娘の声だった。"],
      ["R2-18", "二冊のうち一冊を、使いに渡したのは私です。急かされましたので。"],
      ["R2-22", "書いた。札の字が、私の字ではない。"],
      ["R2-25", "朝は来なかった。札は、釘に掛かったままだ。"],
      ["R2-12", "一人出せば、村が残る。帳面の名は、その勘定だ。"],
      ["R2-08", "三十まで数えたら、終わってるんだって。"],
    ],
  },
  south: {
    person: { name: "村の長", image: IMG.elder, xy: [23, 33], lamp: [22, 33], lines: [["村の決まりは変えん。叩く音には、答えん。", "じゃが、叩く音が増えたでのう。灯を一つ、置きに来たんじゃ。"]] },
    voice: "戸を叩いておるのは、わしじゃ。開けておくれ。", // 一つ目の声（外の民）
    lines: [
      ["R3-19", "札を持っとる子から順だと。わしの札は、朝に孫に持たせた。"],
      ["R3-20", "扉にさわったら、中で、だれかがぼくの名前で泣いてた。"],
      ["R3-14", "四百は、札の無い者だ。並ぶなとは、誰も言わなかった。"],
      ["R3-23", "水は、膝から胸まで来た。筆は、札掛けの下に浮いている。"],
      ["R3-03", "おれは数えた。十二で、娘の声がした。"],
      ["R3-17", "三十まで数えて、槍を横にした。槍の向こうに、まだ二百はいた。"],
    ],
  },
  east: {
    person: { name: "骨拾い", image: IMG.bonePicker, xy: [45, 18], lines: [["生きておられる方。数が合いません。昨夜は十一、今夜は十四。", "増えております。"]], after: ["骨拾いは、頭を深く下げた。"] },
    voice: "戸を開けておくれ。中で、待っている。", // 一つ目の声（檻の子）
    lines: [
      ["R4-13", "ぼくは、いち、に、さん、ってかぞえてる。姉ちゃんが行ってから、ずっと。"],
      ["R4-11", "一箱、泣いていた。それも数に入れた。"],
      ["R4-01", "隣の奴に聞いた。おまえの名は何だ、と。隣の奴も、知らなかった。"],
      ["R4-18", "札を拭いて、もう一度書こうとした。そこまでだ。"],
      ["R4-06", "受け取りの帳面に、隊の名を書いた。半日のことは、書く欄が無かった。"],
      ["R4-07", "砦の灯が、一つも無かった。油は、二樽とも台の脇に置いた。"],
    ],
  },
};
// 廊下の声だけの影のスイッチ（その地域が縄張りで、その思念を読んでいれば ON。171 に入るたびに並列で決め直す）
const SHADE_SWITCH = {}; // `${key}:${slot}` → スイッチ
REGION_KEYS.forEach((key, r) => [0, 1, 2, 3].forEach(slot => { SHADE_SWITCH[`${key}:${slot}`] = SW.shadeFirst + r * 4 + slot; }));

// ---------------------------------------------------------------------------
// 説明と来歴（1 行は全角 40 字まで。docs/knowhow.md 5.1・docs/world.md 8.3）
// ---------------------------------------------------------------------------
const LORE = {
  "刃の欠けた彫り刀": {
    desc: ["攻撃が上がる。墓掘りの使う、短い彫り刀。", "刃の先が欠けている。"],
    lore: ["柄に、蝋の跡と、墨の染み。", "刃の欠けは石を彫った跡。", "柄の革の巻き方は、司祭の結び方。"], // W14：場面表 章末 2（相棒の印から酒を外す）
  },
};
for (const [name, { desc, lore }] of Object.entries(LORE)) {
  for (const line of [...desc, ...lore]) if ([...line].length > 40) throw new Error(`${name} の文が 40 字を超える：${line}`);
}
const descOf = name => LORE[name].desc.join("\n");
const loreOf = name => ["<hai_lore>", ...LORE[name].lore, "</hai_lore>"].join("\n");

// ---------------------------------------------------------------------------
// データベースの共通（W10 と同じ形。帯だけを書き直す）
// ---------------------------------------------------------------------------
const BAND = [701, 800];
function clearBand(table, makeEmpty) {
  extendTable(table, BAND[0] - 1, makeEmpty);
  for (let id = BAND[0]; id < table.length && id <= BAND[1]; id++) table[id] = makeEmpty(id);
  while (table.length - 1 >= BAND[0] && table.length - 1 <= BAND[1] && table[table.length - 1].name === "") table.pop();
}
function put(table, id, item, makeEmpty) {
  if (id < BAND[0] || id > BAND[1]) throw new Error(`${id} は W11 の帯の外`);
  extendTable(table, id, makeEmpty);
  table[id] = { ...makeEmpty(id), ...item, id };
}
const writeTable = (name, array) => outputs.push({ file: dataPath(name), text: formatTable(array) });

const STATE = { sleep: 142, confuse: 144 };
const ELEMENT = { light: 8, dark: 9 };

// Weapons
const emptyWeapon = id => ({
  id, animationId: 0, description: "", etypeId: 1, traits: [{ code: 31, dataId: 1, value: 0 }, { code: 22, dataId: 0, value: 0 }],
  iconIndex: 0, name: "", note: "", params: [0, 0, 0, 0, 0, 0, 0, 0], price: 0, wtypeId: 0,
});
const weapons = readData("Weapons.json");
clearBand(weapons, emptyWeapon);
put(weapons, WEAPON.carvingKnife, {
  name: "刃の欠けた彫り刀", description: descOf("刃の欠けた彫り刀"), note: [loreOf("刃の欠けた彫り刀"), "<hai_unique>"].join("\n"),
  animationId: 6, iconIndex: 96, wtypeId: 1, params: [0, 0, 28, 0, 0, 4, 4, 0],
}, emptyWeapon);
writeTable("Weapons.json", weapons);

// Skills（敵の技。欄は W10 と同じ）
const emptySkill = id => ({
  id, animationId: 0, damage: { critical: false, elementId: 0, formula: "0", type: 0, variance: 20 },
  description: "", effects: [], hitType: 0, iconIndex: 0, message1: "", message2: "", mpCost: 0, name: "", note: "",
  occasion: 0, repeats: 1, requiredWtypeId1: 0, requiredWtypeId2: 0, scope: 1, speed: 0, stypeId: 0, successRate: 100,
  tpCost: 0, tpGain: 0, messageType: 1,
});
const skills = readData("Skills.json");
clearBand(skills, emptySkill);
const enemySkill = (name, o) => ({ name, occasion: 1, stypeId: 0, hitType: 1, note: "<hai_w11:敵の技>", ...o });
put(skills, SKILL.callingVoice, enemySkill("呼ぶ声", {
  description: "知った声で呼び、足を止めさせる。", animationId: 59, iconIndex: 0, hitType: 2, scope: 1, message1: "%1は、知った声で呼んだ！",
  effects: [{ code: 21, dataId: STATE.sleep, value1: 0.35, value2: 0 }],
}), emptySkill);
put(skills, SKILL.layeredVoices, enemySkill("重なる声", {
  description: "いくつもの声を重ね、全員を打つ。", animationId: 59, iconIndex: 0, hitType: 2, scope: 2, message1: "%1から、いくつもの声が重なって響いた！",
  damage: { critical: false, elementId: ELEMENT.dark, formula: "a.mat * 2 - b.mdf", type: 1, variance: 20 },
}), emptySkill);
put(skills, SKILL.swallow, enemySkill("呑みこむ", {
  description: "灰色の腕で包み、力を吸う。", animationId: 7, iconIndex: 0, scope: 1, message1: "%1は、灰色の腕で包みこんだ！",
  damage: { critical: false, elementId: -1, formula: "a.atk * 3 - b.def * 2", type: 5, variance: 20 },
}), emptySkill);
writeTable("Skills.json", skills);

// Enemies・Troops（docs/world.md 3.7・5.5。縄張りは「声だけの影」。数値は仮で、持ち主が調整する）
const emptyEnemy = id => ({
  id, actions: [{ conditionParam1: 0, conditionParam2: 0, conditionType: 0, rating: 5, skillId: 1 }],
  battlerHue: 0, battlerName: "",
  dropItems: [{ dataId: 1, denominator: 1, kind: 0 }, { dataId: 1, denominator: 1, kind: 0 }, { dataId: 1, denominator: 1, kind: 0 }],
  exp: 0, traits: [{ code: 22, dataId: 0, value: 0.95 }, { code: 22, dataId: 1, value: 0.05 }, { code: 31, dataId: 1, value: 0 }],
  gold: 0, name: "", note: "", params: [100, 0, 10, 10, 10, 10, 10, 10],
});
const T = {
  element: (elementId, rate) => ({ code: 11, dataId: elementId, value: rate }),
  physRate: rate => ({ code: 23, dataId: 6, value: rate }),
  stateRate: (stateId, rate) => ({ code: 13, dataId: stateId, value: rate }),
};
const base = [{ code: 22, dataId: 0, value: 0.95 }, { code: 22, dataId: 1, value: 0.05 }, { code: 31, dataId: 1, value: 0 }];
const act = (skillId, rating = 5) => ({ conditionParam1: 0, conditionParam2: 0, conditionType: 0, rating, skillId });
const onTurn = (skillId, a, b, rating = 5) => ({ conditionParam1: a, conditionParam2: b, conditionType: 1, rating, skillId });
const hpBelow = (skillId, rate, rating) => ({ conditionParam1: 0, conditionParam2: rate, conditionType: 2, rating, skillId });
const drop = (kind, id, denominator) => [{ dataId: id, denominator, kind }, { dataId: 1, denominator: 1, kind: 0 }, { dataId: 1, denominator: 1, kind: 0 }];
const noDrop = drop(0, 1, 1);
const enemies = readData("Enemies.json");
clearBand(enemies, emptyEnemy);
put(enemies, ENEMY.shade, {
  name: "声だけの影", battlerName: "SF_Shadow", battlerHue: 0, params: [820, 40, 44, 26, 32, 30, 26, 10], exp: 50, gold: 30,
  traits: [...base, T.element(ELEMENT.light, 2), T.element(ELEMENT.dark, 0.5), T.physRate(0.85)],
  actions: [act(1), act(SKILL.callingVoice, 3)], dropItems: drop(1, ITEM.mossAsh, 4),
}, emptyEnemy);
put(enemies, ENEMY.thickShade, {
  name: "重なった影", battlerName: "Wraith", battlerHue: 200, params: [1400, 60, 50, 30, 42, 36, 28, 10], exp: 90, gold: 55,
  traits: [...base, T.element(ELEMENT.light, 2), T.element(ELEMENT.dark, 0.5), T.physRate(0.85)],
  actions: [act(1), act(SKILL.callingVoice, 3), act(SKILL.layeredVoices, 3)], dropItems: drop(1, ITEM.bitterRoot, 4),
}, emptyEnemy);
// 門叩きが抱えた思いの塊（172。ボス）。倒し方の芯は使徒の力（思いの刃）と、呑まれたときの仲間の呼びかけ（Hai_Apostle）
// 数値は W21（#259）で、仲間が初めの装備のままの Lv11 の四人（R2 の遊び方）が 15〜20 ターン・全滅しない所に下げた（HP 7200→4500、攻撃 58→55、魔力 54→52）
// W22（#279）で仲間の初めの装備を職業に合わせた（素手でなくなった）ので、同じ四人（獣人の二回行動も使う）が 15〜20 ターンになるよう HP を 4500→9000 に上げた
put(enemies, ENEMY.mass, {
  name: "思いの塊", battlerName: "Plasma", battlerHue: 300, params: [9000, 200, 55, 38, 52, 40, 24, 30], exp: 900, gold: 500,
  traits: [...base, T.element(ELEMENT.light, 1.5), T.element(ELEMENT.dark, 0.3), T.stateRate(STATE.confuse, 0), T.stateRate(STATE.sleep, 0), T.stateRate(1, 0)],
  actions: [act(SKILL.swallow, 5), act(SKILL.layeredVoices, 4), onTurn(SKILL.layeredVoices, 3, 3, 8), hpBelow(SKILL.swallow, 0.5, 7)],
  dropItems: noDrop,
  note: ["<hai_boss>", "<hai_boss_name:門叩きが抱えた思いの塊>", `<hai_boss_switch:${SW.mass}>`, "<hai_actions_low:2,50>", "<hai_drop:none>"].join("\n"),
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
const troops = readData("Troops.json");
clearBand(troops, emptyTroop);
for (const [id, name, members] of [
  [TROOP.shade, "W11_緑：声だけの影", [ENEMY.shade]],
  [TROOP.thickShade, "W11_黄：重なった影", [ENEMY.thickShade]],
  [TROOP.mass, "W11_ボス：思いの塊", [ENEMY.mass]],
]) {
  const pos = row(members.length);
  put(troops, id, { name, members: members.map((enemyId, i) => ({ enemyId, ...pos[i], hidden: false })) }, emptyTroop);
}
// 塊から漏れる一行（text.md 5.5 の c）：その地域が縄張りで、その思念を読んでいれば、2・4 ターン目に一行ずつ。言葉は無く、思念の一行だけ
const page0 = emptyTroop(0).pages[0];
const lastIs = key => `!$gameSwitches.value(${REGIONS[key].bell})`;
const leak = slot => [
  ...REGION_KEYS.flatMap(key => {
    const [id, line] = LOCAL[key].lines[slot];
    return [
      ifScript(`${lastIs(key)} && Hai.Thoughts.isRead("${id}")`),
      ...say([line], "", 1, { background: 1, position: 1 }),
      end(1), ENDIF(),
    ];
  }),
  END,
];
troops[TROOP.mass].pages = [
  { ...page0, conditions: { ...page0.conditions, turnA: 2, turnB: 0, turnValid: true }, span: 1, list: leak(4) },
  { ...page0, conditions: { ...page0.conditions, turnA: 4, turnB: 0, turnValid: true }, span: 1, list: leak(5) },
  // 裂け目の一行は、HP が半分を切ってから一度目と、そのあと 3 ターンおき（W27 #300。毎ターン窓で出ると、決定を押すだけの頁になる）。
  // 出したターンは塊（Game_Enemy。戦闘ごとに作り直される）に持たせる
  { ...page0, conditions: { ...page0.conditions, enemyHp: 50, enemyIndex: 0, enemyValid: true }, span: 1,
    list: [
      ifScript("(e => e.isAlive() && (e._haiTear === undefined || $gameTroop.turnCount() - e._haiTear >= 3))($gameTroop.members()[0])"),
      cmd(355, ["$gameTroop.members()[0]._haiTear = $gameTroop.turnCount();"], 1),
      ...say(["塊の表面が裂けた。奥で、刃が石を掻く音がする。"], "", 1),
      end(1), ENDIF(), END,
    ] },
];
writeTable("Troops.json", troops);

// System.json（スイッチ 701–800 の名前。変数は使わない）
const SWITCH_NAMES = {
  [SW.mass]: "ボス:思いの塊",
  [SW.backWest]: "縄張り:記録院の側へ戻った",
  [SW.backSouth]: "縄張り:水底の側へ戻った",
  [SW.backEast]: "縄張り:鋳物場の側へ戻った",
  [SW.knife1]: "縄張り:彫り刀の音1",
  [SW.knife2]: "縄張り:彫り刀の音2",
  [SW.knife3]: "縄張り:彫り刀の音3",
  [SW.voice]: "縄張り:門叩きの声を聞いた",
};
for (const key of REGION_KEYS) for (const slot of [0, 1, 2, 3]) SWITCH_NAMES[SHADE_SWITCH[`${key}:${slot}`]] = `縄張り:影の声 ${REGIONS[key].label} ${LOCAL[key].lines[slot][0]}`;

// ---------------------------------------------------------------------------
// 地図を描く（文字マップ）。凡例 dungeon・タイルセット 14（docs/look.md 3.4）
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
const LOOK = JSON.parse(fs.readFileSync(path.join(SRC_DIR, "..", "looks.json"), "utf8")).regions.find(r => r.key === "lair").places;
const lookOf = mapId => LOOK.find(p => p.maps === String(mapId));
const CHARS = {
  ";": { name: "床の汚れ", as: ".", tiles: [null, "A2:15"] },
  h: { name: "見えない通路（石の壁に見えて通れる。影なし。リージョン 251）", as: "=", region: 251, shadow: false },
};
const DECO = {
  1: { name: "石の柱B（下。通れない）", z2: "B:106" },
  2: { name: "折れた石の柱（通れない）", z2: "B:114" },
  5: { name: "亀裂B（壁に）", z2: "B:187" },
  7: { name: "壁の苔（壁に）", z2: "B:1" },
  k: { name: "砂利A（通れる）", z2: "B:32" },
  K: { name: "砂利B（通れる）", z2: "B:33" },
  r: { name: "瓦礫A（通れない）", z2: "B:120" },
  x: { name: "骸骨A（通れない）", z2: "B:242" },
  X: { name: "骸骨B（通れない）", z2: "B:250" },
  q: { name: "瓦礫の上の骸骨（通れない）", z2: "B:120", z3: "B:242" },
  w: { name: "蜘蛛の巣（壁に）", z2: "B:176" },
};
function configOf(mapId, name, displayName, about, events, extra = {}) {
  const look = lookOf(mapId);
  return {
    _説明: about + " この設定は node tools/maps/src/w11_data.mjs が書く。",
    mapId, name, displayName, legend: look.legend, tilesetId: look.tilesetId,
    note: look.note,
    bgm: { name: look.bgm.name, volume: look.bgm.volume, pitch: 100, pan: 0 },
    bgs: { name: look.bgs.name, volume: look.bgs.volume, pitch: 100, pan: 0 },
    fields: look.battleback ? { specifyBattleback: true, battleback1Name: look.battleback[0], battleback2Name: look.battleback[1] } : {},
    chars: CHARS, deco: DECO,
    ...extra,
    events,
  };
}

// ---------------------------------------------------------------------------
// イベントの部品
// ---------------------------------------------------------------------------
const text = (name, [x, y], lines, extra = {}) => ({ name, type: "text", x, y, lines, ...extra });
const exitTo = (name, [x, y], [mapId, tx, ty, d]) => ({ name, type: "transfer", x, y, to: [mapId, tx, ty, d] });
const chest = (label, [x, y], gainList, gotText, red = false) => ({
  name: `${red ? "赤い宝箱" : "宝箱"}（${label}）`, type: "raw", x, y,
  pages: [
    { image: red ? IMG.redChest : IMG.chest, priorityType: 1, walkAnime: false, list: [se("Chest1"), ...gainList, selfOn(), ...say([gotText]), END] },
    { conditions: { selfSwitchCh: "A", selfSwitchValid: true }, image: red ? IMG.redChestOpen : IMG.chestOpen, priorityType: 1, walkAnime: false },
  ],
});
const chestItem = (xy, id, n = 1, red = false) => chest(ITEM_NAME[id][0], xy, [gainItem(id, n)], `\\I[${ITEM_NAME[id][1]}]${ITEM_NAME[id][0]}${n > 1 ? `×${n}` : ""}を手に入れた。`, red);
const chestGold = (xy, n) => chest("鉄くず", xy, [gainGold(n)], `鉄くずを ${n} 手に入れた。`);
const ward = (name, [x, y]) => ({
  name: `結界（${name}）`, type: "raw", x, y, note: `<hai_warp:${name}>`,
  pages: [{ image: IMG.warp, priorityType: 1, stepAnime: true, walkAnime: false }],
});
// 声だけの影（P13 の <hai_enemy_shade>）。voice が無ければ声を残さない。cond（スイッチ）があれば、それが ON の間だけ出る。
//   selfCond（"D"）：スイッチの代わりに、影のセルフスイッチで出す（171 の旗の自動のイベントが立てる）
//   quiet（文6）：倒しても一行を出さない（<hai_enemy_shade_quiet>）。一行は「影の崩れ」の自動のイベントが、崩れる文のあとに出す（P17 の shadeVoice）。
//     戦闘の前に影のセルフスイッチ B を立てる（触れて戦った印。旗の束や検査がセルフスイッチ A だけを立てても、崩れる文は出ない）
const shade = (name, [x, y], { troop = TROOP.shade, rank = "green", voice = null, once = false, random = false, cond = null, selfCond = null, quiet = false } = {}) => ({
  name, type: "raw", x, y,
  note: `<hai_enemy:${troop},${rank}>` + (once ? "<hai_enemy_once>" : "") + (voice === null ? "<hai_enemy_shade>" : `<hai_enemy_shade:${voice}>`) + (quiet ? "<hai_enemy_shade_quiet>" : ""),
  pages: [{
    ...(cond ? { conditions: { switch1Id: cond, switch1Valid: true } } : {}),
    ...(selfCond ? { conditions: { selfSwitchCh: selfCond, selfSwitchValid: true } } : {}),
    image: IMG.shade, priorityType: 1, trigger: 2, moveType: random ? 1 : 0, moveFrequency: random ? 3 : 5, moveSpeed: 3,
    ...(quiet ? { list: [selfOn("B"), END] } : {}),
  }],
});
// 一度だけ踏むと出る文（同じスイッチを持つ何マスかで一つ）
const strip = (name, cells, sw, list) => cells.map(([x, y], i) => ({
  name: `${name}${cells.length > 1 ? ` ${i + 1}` : ""}`, type: "raw", x, y,
  pages: [
    { priorityType: 0, trigger: 1, list: [...list, switchOn(sw), END] },
    { conditions: { switch1Id: sw, switch1Valid: true }, priorityType: 0 },
  ],
}));
// 角灯の明かり（W8・W9 と同じ。暗がり 1.5 → 角灯で 5）
const lanternAuto = {
  name: "角灯の明かり（自動）", type: "raw", x: 0, y: 0,
  pages: [{ priorityType: 0, trigger: 4, list: [cmd(111, [8, ITEM.lantern]), ...plugin("Hai_MapTone", "dark", "暗がりの半径を変える", { radius: "5" }, 1), end(1), ENDIF(), cmd(214, []), END] }],
};

// ===========================================================================
// 170 縄張りの縁（50 × 40。霧・暗がり 1.5）
//   三つの戸口（西＝記録院 084、南＝水底 104、東＝鋳物場 094。入った戸口だけ開いている）。真ん中の広間。北の細い口 → 171
//   今の勢力の人の一言（a）、門叩きの声（b）。北の細い口の影は、広間の北西の苔の床の上の見えない通路で避けられる
// ===========================================================================
function draw170() {
  const g = new Grid(50, 40, "=");
  const d = new Grid(50, 40, ".");
  g.rect(2, 17, 8, 23, ".").set(1, 20, "."); // 西の着き場（記録院の戸口）
  g.rect(9, 20, 15, 20, "."); // 西の通り
  g.rect(41, 17, 47, 23, ".").set(48, 20, "."); // 東の着き場（鋳物場の戸口）
  g.rect(35, 20, 40, 20, "."); // 東の通り
  g.rect(21, 31, 29, 37, ".").set(25, 38, "."); // 南の着き場（水底の戸口）
  g.rect(25, 28, 25, 30, "."); // 南の通り
  g.rect(16, 12, 34, 27, "."); // 広間
  g.rect(25, 6, 25, 11, "."); // 北の細い口
  g.rect(21, 2, 29, 5, ".").set(25, 1, "."); // 北の間 → 171
  // 広間の北西の見えない通路（手がかりは苔の床）→ 北の間の西
  g.set(18, 12, "%").set(18, 11, "h").set(18, 10, "h").rect(18, 3, 18, 9, ".").rect(19, 3, 20, 3, ".");
  // 北西の小部屋（西の着き場から）・北東の小部屋（東の着き場から。細い通りに影）
  g.rect(3, 5, 10, 10, ".").rect(5, 11, 6, 16, ".");
  g.rect(39, 5, 46, 10, ".").rect(44, 11, 44, 16, ".");
  // 南東の小部屋（南の着き場から）と、その奥の見えない通路の先の小部屋（赤い宝箱）
  g.rect(30, 34, 32, 34, ".").rect(33, 32, 40, 36, ".");
  g.set(40, 34, "%").set(41, 34, "h").set(42, 34, "h").rect(43, 33, 45, 35, ".");
  // 床の汚れ
  for (const [x, y] of [[20, 15], [27, 19], [31, 25], [18, 24], [5, 21], [44, 21], [24, 35]]) g.set(x, y, ";");
  // 置き物：広間の柱、骸骨、瓦礫
  for (const [x, y] of [[19, 15], [31, 15], [19, 24], [31, 24]]) d.set(x, y, "1");
  for (const [x, y, ch] of [[17, 26, "x"], [33, 13, "X"], [3, 8, "q"], [10, 6, "r"], [46, 9, "x"], [39, 6, "r"], [34, 33, "X"], [3, 18, "r"], [47, 22, "r"], [29, 31, "x"], [16, 19, "2"], [34, 21, "2"]]) d.set(x, y, ch);
  for (const [x, y, ch] of [[22, 10, "5"], [28, 10, "w"], [12, 18, "7"], [38, 18, "5"], [24, 29, "w"]]) d.set(x, y, ch);
  return { g, d };
}
const E170 = {
  door: { west: [1, 20], east: [48, 20], south: [25, 38] },
  exitN: [25, 1], arriveFromCorridor: [25, 2],
  voice: [[15, 20], [35, 20], [25, 28]],
  shadeN: [25, 8], ward: [30, 14],
};
function events170() {
  const ev = [];
  // 戻る戸口（入った戸口だけ開いている：出現はスイッチ 106、その地域の鐘が鳴っていれば閉じている）
  for (const key of REGION_KEYS) {
    const r = REGIONS[key];
    const [x, y] = E170.door[key];
    ev.push({
      name: `戸口（${r.label}の鐘の間へ戻る）`, type: "raw", x, y,
      pages: [
        { conditions: { switch1Id: FLAG.scene3, switch1Valid: true }, image: IMG.fog, priorityType: 1, trigger: 1, stepAnime: true, walkAnime: false, directionFix: true,
          list: [
            ...say([`霧の向こうに、${r.label}の鐘の間の控えが見える。`]),
            cmd(102, [["霧を抜けて戻る", "やめる"], 1, 0, 2, 0]),
            cmd(402, [0, "霧を抜けて戻る"]), se("Fog1", 1, 80, 70), transfer(r.room, r.inner[0], r.inner[1], DOWN, 1), end(1),
            cmd(402, [1, "やめる"]), end(1),
            cmd(404, []), END,
          ] },
        { conditions: { switch1Id: r.bell, switch1Valid: true }, priorityType: 1, list: [...say(["霧が固い。手を当てると、向こうから同じ強さで押し返してくる。"]), END] },
      ],
    });
  }
  // 今の勢力の人の一言（text.md 5.5 の a。その地域が縄張りのときだけ、その戸口の着き場に）
  for (const key of REGION_KEYS) {
    const p = LOCAL[key].person;
    const r = REGIONS[key];
    ev.push({
      name: `${p.name}（縄張りの縁。最後の地域が${r.label}のとき）`, type: "raw", x: p.xy[0], y: p.xy[1],
      pages: [
        { conditions: { switch1Id: FLAG.scene3, switch1Valid: true }, image: p.image, priorityType: 1,
          list: [...p.lines.flatMap(ls => say(ls, p.name)), ...(p.after ? say(p.after) : []), END] },
        { conditions: { switch1Id: r.bell, switch1Valid: true }, priorityType: 0 },
      ],
    });
    if (p.lamp) {
      ev.push({
        name: `${p.name}の置いた灯`, type: "raw", x: p.lamp[0], y: p.lamp[1],
        pages: [
          { conditions: { switch1Id: FLAG.scene3, switch1Valid: true }, image: IMG.lamp, priorityType: 1, stepAnime: true, walkAnime: false,
            list: [...say(["小さな灯が一つ、床に置いてある。芯は短く切ってある。"]), END] },
          { conditions: { switch1Id: r.bell, switch1Valid: true }, priorityType: 0 },
        ],
      });
    }
  }
  // 門叩きの声（text.md 4.14・5.5 の b。広間へ入る三つの通りのどれかを踏むと一度だけ。声を次々に替える）
  ev.push(...strip("門叩きの声", E170.voice, SW.voice, [
    ...knock(0, 60),
    // W14（#234）：場面表 3.3。姿は見せない。名前なし。声ごとに窓を分ける。一つ目の声は地域で替え、二つ目・三つ目と相棒の声は同じ
    ...byLastRegion(Object.fromEntries(REGION_KEYS.map(key => [key, ind => [
      ...say([LOCAL[key].voice], "", ind),
      ...(key === "east" ? [ifSwitch(FLAG_TURA, true, ind), ...say(["兄貴。今の声、知ってる。檻の隣の"], "トゥーラ", ind + 1), end(ind + 1), ENDIF(ind)] : []),
    ]]))),
    ...say(["同胞よ。お前も、死んだ者の思いを取りこむ側だろう。喰えばいい。", "あの夜は、よく喰えた。お前の分も残しておいた。"]),
    ...say(["戸を開けて。いち、に、さん、で開けて。"]),
    ...say(["呼んでやろうか。", "お前の名は、わしが持っている。"]),
    ...say(["名は来なかった。声は遠のいた。"]),
    ifSwitch(FLAG_BELTRAN, true), ...say(["お前、今の、誰の声だ"], "ベルトラン", 1), end(1),
    ELSE(), ifSwitch(FLAG_BRUNO, true, 1), ...say(["あなた。今の声、知っている人ですか"], "ブルーノ", 2), end(2), ENDIF(1), end(1),
    ENDIF(),
  ]));
  ev.push(
    exitTo("北の口（喰われた者の廊下へ）", E170.exitN, [LAIR_MAP.corridor, 25, 38, UP]),
    ward("縄張りの縁", E170.ward),
    lanternAuto,
    shade("声だけの影（北の細い口）", E170.shadeN, { troop: TROOP.thickShade, rank: "yellow" }),
    shade("声だけの影（広間 1）", [20, 22], { random: true }),
    shade("声だけの影（広間 2）", [30, 18], { random: true }),
    shade("声だけの影（北東の細い通り）", [44, 13], { troop: TROOP.thickShade, rank: "yellow" }),
    text("引きずった跡", [22, 13], ["石の床に、引きずった跡が二筋。踵の幅で並んでいる。", "跡は、北の細い口へ続いている。"]),
    text("爪の跡", [3, 22], ["床に、爪の跡が三本ずつ並んでいる。", "どれも、戸口の方を向いている。"]),
    text("北西の小部屋の灯の皿", [8, 6], ["棚に、灯の皿が並んでいる。"], { image: { tileId: "B:125" } }),
    chestItem([4, 6], ITEM.elixir),
    chestGold([45, 6], 150),
    chestItem([44, 34], ITEM.elixir, 2, true),
    text("南東の小部屋の灰", [36, 35], ["灰の上に、裸足の足跡が一つだけ。"]),
  );
  return ev;
}

// ===========================================================================
// 171 喰われた者の廊下（50 × 40。暗がり 4）
//   東西の廊下が四本（下から C1〜C4）。廊下の間の口は二つずつ（片方に影、もう片方は回り道）。C4 から北の間（ボスの控え・結界）→ 172
//   声だけの影は、その地域が縄張りで、その思念を読んでいれば出る（倒すとその一行を残す）。読んでいなければ口は空いている
// ===========================================================================
function draw171() {
  const g = new Grid(50, 40, "=");
  const d = new Grid(50, 40, ".");
  g.rect(20, 35, 30, 38, ".").set(25, 39, "."); // 南の間 ← 170
  g.rect(24, 34, 26, 34, ".");
  g.rect(4, 31, 45, 33, "."); // C1
  g.rect(4, 22, 45, 24, "."); // C2
  g.rect(4, 13, 45, 15, "."); // C3
  g.rect(4, 7, 45, 9, "."); // C4
  g.rect(21, 1, 29, 3, ".").set(25, 0, "."); // 北の間（ボスの控え）→ 172
  // 影の置き場は 1 マス幅の 3 マスの通り（地域ごとに 1 マスずつ。出るのは一つだけ）
  const narrowV = (x, y1, y2) => { for (let y = y1; y <= y2; y++) g.set(x - 1, y, "o").set(x + 1, y, "o"); };
  // C1–C2：西の口（影の置き場 0）と東の口
  g.rect(4, 25, 6, 30, "."); narrowV(5, 26, 28);
  g.rect(43, 25, 45, 30, ".");
  // C2–C3：真ん中の口（影の置き場 1）と西の口（重なった影）と、見えない通路（苔の床）
  g.rect(24, 16, 26, 21, "."); narrowV(25, 17, 19);
  g.rect(4, 16, 6, 21, ".").set(4, 18, "o").set(6, 18, "o");
  g.set(14, 22, "%").rect(14, 16, 14, 21, "h");
  // C3–C4：東の口（影の置き場 2）と真ん中の口
  g.rect(43, 10, 45, 12, "."); narrowV(44, 10, 12);
  g.rect(24, 10, 26, 12, ".");
  // C4–北の間：細い口（影の置き場 3）と、見えない通路（苔の床）
  g.rect(25, 4, 25, 6, ".").set(22, 7, "%").rect(22, 4, 22, 6, "h");
  for (const [x, y] of [[10, 32], [33, 23], [17, 14], [40, 8], [25, 37]]) g.set(x, y, ";");
  for (const [x, y, ch] of [[12, 33, "x"], [38, 31, "X"], [8, 23, "q"], [30, 24, "x"], [20, 15, "X"], [41, 13, "r"], [9, 9, "x"], [36, 7, "r"], [21, 38, "x"], [29, 1, "X"]]) d.set(x, y, ch);
  for (const [x, y, ch] of [[18, 30, "5"], [32, 21, "w"], [10, 12, "7"], [40, 6, "5"], [23, 0, "w"]]) d.set(x, y, ch);
  return { g, d };
}
// 影の置き場（地域ごとに 1 マス：記録院・水底・鋳物場の順）
const SLOTS171 = [[[5, 26], [5, 27], [5, 28]], [[25, 17], [25, 18], [25, 19]], [[44, 10], [44, 11], [44, 12]], [[25, 4], [25, 5], [25, 6]]];
// 夜の戸で拾った言い残し（W14 #234、場面表 3.4。N4-2・N4-3 の夜の戸の旗。読むだけ）。その地域が縄張りで、言い残しを拾っていれば廊下に影が一体
const LEGACY = [
  { key: "west", flag: 413, sw: 1168, who: "焼けた村の子", line: "おねえちゃん、三つしか叩かなかったよ。おかあ", at: [40, 23] },
  { key: "east", flag: 620, sw: 1169, who: "名無し兵", line: "顔は覚えている。たぶん", at: [28, 32] },
];
const E171 = { entry: [25, 39], exitN: [25, 0], arriveFromMass: [25, 1], ward: [28, 2] };
// 文6（#273）：影の一行が同じ型で続かないように、倒したあとの出し方を影ごとに替える（R2 の 7 章 04:242・ROADMAP の文6）。
//   置き場 0・2 は今のまま（倒すと窓なしで一行だけ漏れる。text.md 5.5 の c）。置き場 1・3 と言い残しは、崩れる文 → 声の順（P17 の shadeVoice）
const COLLAPSE = {
  1: ["影は膝をつき、膝から先が床に溶けた。", "口の形だけが、しばらく残って動いていた。"],
  3: ["崩れた影は床に落ちず、北の口へ吸われていく。"],
};
const LEGACY_COLLAPSE = {
  焼けた村の子: ["影がほどけた。ほどける前に、背の低い形になった。"],
  名無し兵: ["影は片手を上げて、宙に一画だけ引いた。そこで手ごと散った。"],
};
// 鋳物場の側：トゥーラの臨終（091。記憶 4）の「かえりは かるい」が漏れる影と、トゥーラの一言（場面表 04 の 3.4。R2 の 7 章 04:242）
const TULA_ACTOR = 11;
const TULA_SHADE = { name: "声だけの影（鋳物場 トゥーラの記憶 4）", at: [40, 8], line: "かえりは かるい", collapse: ["影が崩れた。灰に、刃物で彫ったような字が残った。"] };
// 足すイベントは床の汚れ（;）のマスに置く。散らし（scatter）は「.」のマスだけを数えるので、ここに置けばタイル層の散らしは変わらない
const AFTER_AT = [25, 37];
/**
 * 影を倒したあと（影のセルフスイッチ A と B。C は出し終えた印）：崩れる文 → 影の一行（話し手の名つき）→ 足す行。影ごとに一度だけ。
 * 影ごとにイベントを置かず、一つのイベントで見張る（並列で見て、自動実行で出す）。entries は [影の ID, 崩れる文, 話し手, 足す行（indent → 命令）]
 */
function afterShades(entries) {
  const sv = (id, ch) => `$gameSelfSwitches.value([${LAIR_MAP.corridor}, ${id}, "${ch}"])`;
  const due = id => `${sv(id, "A")} && ${sv(id, "B")} && !${sv(id, "C")}`;
  return {
    name: "影の崩れ（自動。崩れる文 → 声）", type: "raw", x: AFTER_AT[0], y: AFTER_AT[1],
    pages: [
      { priorityType: 0, trigger: 4,
        list: [ifScript(`${JSON.stringify(entries.map(([id]) => id))}.some(i => ${due("i")})`), selfOn("B", 1), end(1), ENDIF(), END] },
      { conditions: { selfSwitchCh: "B", selfSwitchValid: true }, priorityType: 0, trigger: 3,
        list: [
          ...entries.flatMap(([id, collapse, speaker, tail]) => [
            ifScript(due(id)),
            ...say(collapse, "", 1),
            ...plugin("Hai_SymbolEnemy", "shadeVoice", "影の声を出す", { eventId: String(id), speaker }, 1),
            ...tail(1),
            ...script(`$gameSelfSwitches.setValue([${LAIR_MAP.corridor}, ${id}, "C"], true);`, 1),
            end(1), ENDIF(),
          ]),
          cmd(123, ["B", 1]), END,
        ] },
    ],
  };
}
function events171() {
  const ev = [
    exitTo("南の口（縄張りの縁へ）", E171.entry, [LAIR_MAP.edge, E170.arriveFromCorridor[0], E170.arriveFromCorridor[1], DOWN]),
    exitTo("北の口（塊の間へ）", E171.exitN, [LAIR_MAP.mass, 20, 28, UP]),
    ward("喰われた者の廊下", E171.ward),
    // 影の声のスイッチを決める（入るたびに一度）
    {
      name: "影の声の旗（自動）", type: "raw", x: 0, y: 0,
      pages: [{ priorityType: 0, trigger: 4, list: [
        comment("W11：その地域が縄張り（鐘が鳴っていない）で、その思念を読んでいれば、廊下の声だけの影を出す（スイッチ 711–722）"),
        ...script([
          `const last = ${REGION_KEYS.map(k => `!$gameSwitches.value(${REGIONS[k].bell}) ? "${k}" : `).join("")}"";`,
          `const T = ${JSON.stringify(Object.fromEntries(REGION_KEYS.flatMap(k => [0, 1, 2, 3].map(s => [SHADE_SWITCH[`${k}:${s}`], [k, LOCAL[k].lines[s][0]]]))))};`,
          `for (const id in T) $gameSwitches.setValue(Number(id), T[id][0] === last && Hai.Thoughts.isRead(T[id][1]));`,
          // W14（#234）：場面表 3.4。夜の戸で拾った言い残し（記録院の側＝焼けた村の子 413、鋳物場の側＝名無し兵 620）
          `const L = ${JSON.stringify(Object.fromEntries(LEGACY.map(l => [l.sw, [l.key, l.flag]])))};`,
          `for (const id in L) $gameSwitches.setValue(Number(id), L[id][0] === last && $gameSwitches.value(L[id][1]));`,
          // 文6（#273）：鋳物場の側で、トゥーラの臨終（記憶 4）を読んでいれば「かえりは かるい」の影（影のセルフスイッチ D）
          `$gameSelfSwitches.setValue([${LAIR_MAP.corridor}, TULA_SHADE_ID, "D"], last === "east" && Hai.Companions.memories(${TULA_ACTOR}).includes(4));`,
        ].join("\n")),
        cmd(214, []), END,
      ] }],
    },
  ];
  // 声だけの影（その地域の思念の一行。読んだときだけ）。置き場 1・3 は崩れる文のあとに声（文6）
  const after = []; // [影の名, 崩れる文, 話し手, 足す行]
  for (const key of REGION_KEYS) {
    SLOTS171.forEach((cells, slot) => {
      const [id, line] = LOCAL[key].lines[slot];
      const name = `声だけの影（${REGIONS[key].label} ${id}）`;
      const quiet = !!COLLAPSE[slot];
      ev.push(shade(name, cells[REGION_KEYS.indexOf(key)], { troop: TROOP.thickShade, rank: "yellow", voice: line, once: true, cond: SHADE_SWITCH[`${key}:${slot}`], quiet }));
      if (quiet) after.push([name, COLLAPSE[slot], ""]);
    });
  }
  for (const l of LEGACY) {
    const name = `声だけの影（言い残し ${l.who}）`;
    ev.push(shade(name, l.at, { troop: TROOP.thickShade, rank: "yellow", voice: l.line, once: true, cond: l.sw, quiet: true }));
    after.push([name, LEGACY_COLLAPSE[l.who], l.who]);
  }
  ev.push(
    shade("声だけの影（C2–C3 の西の口）", [5, 18], { troop: TROOP.thickShade, rank: "yellow" }),
    shade("声だけの影（C1）", [15, 32], { random: true }),
    shade("声だけの影（C3）", [35, 14], { random: true }),
    // 相棒の司祭の彫り刀の音が近づく（world.md 5.2 の 171）
    ...strip("彫り刀の音（C2）", [[35, 22], [35, 23], [35, 24]], SW.knife1, say(["壁の向こうで、刃が石を掻く音がした。"])),
    ...strip("彫り刀の音（C3）", [[15, 13], [15, 14], [15, 15]], SW.knife2, [
      ...say(["掻く音が近い。一画ずつ、間を置いて。"]),
      ifSwitch(FLAG_BRUNO, true), ...say(["あなた。刃の音です。石を、彫っています"], "ブルーノ", 1), end(1), ENDIF(), // W14：場面表 3.4
    ]),
    ...strip("彫り刀の音（C4）", [[35, 7], [35, 8], [35, 9]], SW.knife3, say(["刃の音が止んだ。北の口の奥で、床ごと脈を打つ音がする。"])),
    text("戸板の列", [10, 31], ["壁ぎわに、戸板が十一枚立てかけてある。", "どの戸も、閂は内から外してある。"]),
    chestItem([4, 32], ITEM.herb, 3),
    chestItem([45, 14], ITEM.antidote, 2),
  );
  // 文6（#273）：ここから下は足したイベント（上のイベントの番号と座標は動かさない）
  ev.push(shade(TULA_SHADE.name, TULA_SHADE.at, { troop: TROOP.thickShade, rank: "yellow", voice: TULA_SHADE.line, once: true, selfCond: "D", quiet: true }));
  after.push([TULA_SHADE.name, TULA_SHADE.collapse, "", ind => [ifSwitch(FLAG_TURA, true, ind), ...say(["……あたしの字だ"], "トゥーラ", ind + 1), end(ind + 1), ENDIF(ind)]]);
  // イベントの番号は並べた順（1 から。通行止めのイベントは build.mjs が後ろに置く）
  const idOf = name => {
    const i = ev.findIndex(e => e.name === name);
    if (i < 0) throw new Error(`171 に「${name}」が無い`);
    return i + 1;
  };
  ev.push(afterShades(after.map(([name, collapse, speaker, tail = () => []]) => [idOf(name), collapse, speaker, tail])));
  // 旗の自動のイベントの式に、トゥーラの影の番号を入れる
  const flags = ev.find(e => e.name === "影の声の旗（自動）").pages[0].list;
  for (const c of flags) if (c.code === 355 || c.code === 655) c.parameters[0] = c.parameters[0].replace("TULA_SHADE_ID", String(idOf(TULA_SHADE.name)));
  return ev;
}

// ===========================================================================
// 172 塊の間（40 × 30。暗がりなし・霧 110）
//   門叩きが抱えた思いの塊（ボス）。調べると使徒の力（スイッチ 162）。崩すと相棒の司祭の薄い思念（F12）→ 名前（ルカ）・スイッチ 110・108、刃の欠けた彫り刀。北の口 → 173
// ===========================================================================
function draw172() {
  const g = new Grid(40, 30, "=");
  const d = new Grid(40, 30, ".");
  g.rect(6, 5, 33, 25, ".");
  g.rect(19, 26, 21, 28, ".").set(20, 29, "."); // 南の口 ← 171
  g.rect(20, 1, 20, 4, "."); // 北の口 → 173
  for (const [x, y] of [[10, 9], [29, 9], [10, 20], [29, 20]]) d.set(x, y, "1");
  for (const [x, y, ch] of [[7, 6, "x"], [32, 7, "X"], [8, 24, "q"], [31, 23, "x"], [15, 6, "r"], [26, 24, "r"], [13, 14, "X"], [27, 15, "x"]]) d.set(x, y, ch);
  for (const [x, y, ch] of [[12, 4, "5"], [27, 4, "w"], [8, 4, "7"], [33, 3, "5"]]) d.set(x, y, ch);
  for (const [x, y] of [[17, 12], [23, 13], [20, 16], [16, 18], [24, 18]]) g.set(x, y, ";");
  return { g, d };
}
// 名前が戻ったあとの仲間の反応（場面表 3.6。連れている仲間のうち二人まで。上から順。ブルーノは何も言わない）
//   トゥーラ・ゼリナはいれば出る。ベルトラン・ディル・アンセルモ・ノラは、上の二人がどちらも出ていないときに、上から二人まで
function companionsOnName() {
  const s = id => `$gameSwitches.value(${id})`;
  const first = [[FLAG_TURA, "トゥーラ", "兄貴。……兄貴は、兄貴でいいよな"], [FLAG_ZELINA, "ゼリナ", "つけ帳、書き直さなあかん"]];
  const rest = [[FLAG_BELTRAN, "ベルトラン", "呼びにくい名じゃねえな。短くていい"], [FLAG_DIL, "ディル", "読める名だ"], [FLAG_ANSELMO, "アンセルモ", "名簿の一行、埋まったのう"], [FLAG_NORA, "ノラ", "あんた、名前あったんだ！"]];
  const out = [];
  for (const [id, who, line] of first) out.push(ifSwitch(id, true), ...say([line], who, 1), end(1), ENDIF());
  rest.forEach(([id, who, line], i) => {
    const before = rest.slice(0, i).map(([b]) => `(${s(b)} ? 1 : 0)`).join(" + ") || "0";
    out.push(ifScript(`!${s(FLAG_TURA)} && !${s(FLAG_ZELINA)} && ${s(id)} && ${before} < 2`), ...say([line], who, 1), end(1), ENDIF());
  });
  return out;
}
const MASS_AT = [20, 10];
const PRIEST_AT = [20, 8]; // 塊の上の端（塊の絵は大きい）。崩したあと、そこに相棒の司祭の薄い思念
const MASS_ESCAPE = [LAIR_MAP.mass, 20, 24, UP];
function events172() {
  const massList = [
    ifSwitch(APOSTLE_SWITCH, false),
    ...say(["床から天井まで、灰色の塊がふくれている。", "表面に顔の形の凹みが浮いては沈み、聞いた声がいくつも混ざる。"], "", 1),
    ...say(["手のひらに、取り込んできた思いが集まってくる。", "握れば、刃になる。"], "", 1),
    switchOn(APOSTLE_SWITCH, 1),
    se("Absorb1", 1, 80, 80),
    ...say(["\\C[6]思いの刃\\C[0]を使えるようになった。使うたびに、呑まれが溜まる。"], "", 1),
    end(1),
    ELSE(),
    ...say(["塊が、脈を打っている。"], "", 1),
    end(1),
    ENDIF(),
    ...bossBattle(TROOP.mass, MASS_ESCAPE),
    ifScript("Hai.Boss.lastResult() === 0"),
    se("Collapse3", 1, 80, 80),
    // W14（#234）：場面表 3.5（崩れたあとの文）
    ...say(["塊が崩れる。灰色の殻が、壁ぎわに積もった。", "殻の中から、小さな明かりが漏れた。", "明かりは床を這わず、東の壁へ向かって流れた。", "壁を抜けていった。一つ、また一つ。"], "", 1),
    ifSwitch(FLAG_TURA, true, 1), ...say(["行った"], "トゥーラ", 2), end(2), ENDIF(1),
    ...say(["灰色の中から、彫り刀を握った手が一本、", "上へ伸びた。"], "", 1),
    end(1),
    ENDIF(),
    END,
  ];
  return [
    exitTo("南の口（喰われた者の廊下へ）", [20, 29], [LAIR_MAP.corridor, E171.arriveFromMass[0], E171.arriveFromMass[1], DOWN]),
    // 塊（ボス）→ 倒すと消え、名前が戻る場面（自動）→ 刃の欠けた彫り刀（光る点）。同じマスに二つ置けないので一つのイベントのページで分ける
    {
      name: "門叩きが抱えた思いの塊（ボス）・名前が戻る・刃の欠けた彫り刀", type: "raw", x: MASS_AT[0], y: MASS_AT[1],
      pages: [
        { image: IMG.mass, priorityType: 1, stepAnime: true, walkAnime: false, directionFix: true, list: massList },
        { conditions: { switch1Id: SW.mass, switch1Valid: true }, priorityType: 0 },
        // 名前が戻る（相棒の司祭の薄い思念がスイッチ 110 を立てたあと。名前の欄を「ルカ」に・スイッチ 108）
        { conditions: { switch1Id: FLAG.nameBack, switch1Valid: true }, priorityType: 0, trigger: 3,
          // W14（#234）：場面表 3.6。名前の変更は思念の中（「ルカ」のあと）。主人公の一言は置かない。音は止めたまま
          list: [
            wait(30),
            ...say(["刃の欠けた彫り刀が、床に落ちている。"]),
            ...companionsOnName(),
            ...say(["呼ばれてしまったか。"]),
            ...say(["声は遠のき、戻らなかった。霧が、北の口から薄れていく。"]),
            switchOn(FLAG.climax),
            selfOn("A"),
            END,
          ] },
        { conditions: { selfSwitchCh: "A", selfSwitchValid: true }, image: IMG.sparkle, priorityType: 1, stepAnime: true, walkAnime: false,
          list: [
            ...say(["彫り刀を拾った。柄の革が、自分のではない指の形にへこんでいる。"]),
            se("Item3"), gainWeapon(WEAPON.carvingKnife),
            ...say(["\\I[96]刃の欠けた彫り刀を手に入れた。"]),
            selfOn("B"),
            END,
          ] },
        { conditions: { selfSwitchCh: "B", selfSwitchValid: true }, priorityType: 0 },
      ],
    },
    // 相棒の司祭の薄い思念（docs/world.md 3.7・6.5。<hai_faint:F12>。コモンイベント 201 は呼ばない。名前の一言は上の自動の場面）
    {
      name: `薄い思念 ${PRIEST_FAINT} 墓守の相棒の司祭`, type: "raw", x: PRIEST_AT[0], y: PRIEST_AT[1], note: `<hai_faint:${PRIEST_FAINT}>`,
      pages: [
        { conditions: { switch1Id: SW.mass, switch1Valid: true }, image: IMG.faint, priorityType: 1,
          list: [
            // W14（#234）：場面表 3.6（A の場面。司祭の目から。戸は見ない）。「ルカ」の前に BGM・BGS を止め、無音のまま名前を戻す
            ...say(["墓所。棺の前で、墓守が眠っている。", "壁に彫る。四つの鐘を鳴らして。", "それから、山の頂の鐘楼へ。", "刃の先が欠けた。構わない。"]),
            ...say(["戸が、三度叩かれた。", "戸の向こうから、声がする。", "わたしの名を呼んでいる。", "墓守の声だ。眠っているのに。"]),
            ...say(["手を止めた。戸は見ない。", "眠っている方へ、向き直る。"]),
            cmd(242, [1]), cmd(246, [1]), wait(60),
            ...say(["「ルカ」"], "", 0, { background: 2, position: 1 }),
            cmd(320, [1, "ルカ"]),
            switchOn(FLAG.nameBack),
            END,
          ] },
        { conditions: { selfSwitchCh: "A", selfSwitchValid: true }, priorityType: 0 },
      ],
    },
    {
      name: "北の口（戻りの戸口へ）", type: "raw", x: 20, y: 1,
      pages: [
        { priorityType: 1, list: [...say(["霧が固まって、奥へ通れない。"]), END] },
        { conditions: { switch1Id: SW.mass, switch1Valid: true }, priorityType: 0, trigger: 1, list: [se("Move1"), transfer(LAIR_MAP.back, 13, 11, UP), END] },
      ],
    },
    text("灰色の殻", [8, 23], ["壁ぎわに、灰色の殻が積もっている。", "触ると、まだ湿っている。"]),
  ];
}

// ===========================================================================
// 173 戻りの戸口（27 × 15）：北の霧の戸口 → 入った戸口の鐘の間（鐘の間の側）。スイッチ 702〜704
// ===========================================================================
function draw173() {
  const g = new Grid(27, 15, "=");
  const d = new Grid(27, 15, ".");
  g.rect(5, 5, 21, 11, ".");
  g.rect(13, 12, 13, 13, ".").set(13, 14, "."); // 南の口 ← 172
  g.rect(13, 2, 13, 4, "."); // 北の霧の戸口
  for (const [x, y, ch] of [[6, 6, "x"], [20, 10, "r"], [9, 4, "5"], [18, 4, "w"]]) d.set(x, y, ch);
  return { g, d };
}
function events173() {
  return [
    exitTo("南の口（塊の間へ）", [13, 14], [LAIR_MAP.mass, 20, 2, DOWN]),
    {
      name: "戻りの戸口（入った戸口の鐘の間へ）", type: "raw", x: 13, y: 2,
      pages: [{ image: IMG.fog, priorityType: 1, trigger: 1, stepAnime: true, walkAnime: false, directionFix: true,
        list: [
          ...say(["霧の向こうに、鐘の間の灯が見える。綱が一本、垂れている。"]),
          se("Fog1", 0, 80, 70),
          ...byLastRegion(Object.fromEntries(REGION_KEYS.map(key => [key, ind => [
            switchOn(REGIONS[key].back, ind),
            transfer(REGIONS[key].room, REGIONS[key].bellSide[0], REGIONS[key].bellSide[1], UP, ind),
          ]]))),
          END,
        ] }],
    },
    text("擦れる音", [17, 6], ["霧の奥から、鐘の綱の擦れる音がする。"]),
  ];
}

// ---------------------------------------------------------------------------
// 設定と地図を書く
// ---------------------------------------------------------------------------
const MAPS = [
  ["w11_170_lair_edge", 170, "門叩きの縄張り・縁", "縄張りの縁", draw170, events170,
    "W11（#191）：門叩きの縄張りの縁（docs/world.md 3.7・docs/text.md 5.5・docs/mapdesign.md 10 章）。三つの戸口（西＝記録院 084、南＝水底 104、東＝鋳物場 094。入った戸口だけ開いている。出るのはスイッチ 106 のあと）、今の勢力の人の一言（a）、門叩きの声（b）、北の細い口の影（広間の北西の見えない通路で避けられる）→ 171。暗がり 1.5（鐘番の角灯で 5）。"],
  ["w11_171_eaten_corridor", 171, "喰われた者の廊下", "喰われた者の廊下", draw171, events171,
    "W11（#191）：喰われた者の廊下（docs/world.md 3.7）。東西の廊下が四本、間の口は二つずつ（片方に声だけの影、もう片方は回り道。C2–C3 と北の間の前には見えない通路）。影の声はその地域で読んだ思念の一行（c。スイッチ 711–722）。彫り刀の音が近づく。北の間（ボスの控え・結界）→ 172。"],
  ["w11_172_mass", 172, "塊の間", "塊の間", draw172, events172,
    "W11（#191）：塊の間（docs/world.md 3.7・6.5・8.3）。ボス 門叩きが抱えた思いの塊（調べると使徒の力：スイッチ 162。倒すとスイッチ 701）、相棒の司祭の薄い思念 F12（スイッチ 110）、名前が戻る（名前の変更でルカ・スイッチ 108）、刃の欠けた彫り刀。北の口 → 173。"],
  ["w11_173_return", 173, "戻りの戸口", "戻りの戸口", draw173, events173,
    "W11（#191）：戻りの戸口（docs/world.md 3.7）。北の霧の戸口から、入った戸口の鐘の間（鐘の間の側）へ。スイッチ 702〜704。"],
];
const WALL_CHARS = "=h";
for (const [name, mapId, mapName, displayName, draw, makeEvents, about] of MAPS) {
  const { g, d } = draw();
  const events = makeEvents();
  // イベントが床にあるか（打ち間違いを早く見つける。(0,0) の自動のイベントと見えない通路は除く）
  for (const ev of events) {
    if (ev.x === 0 && ev.y === 0) continue;
    const ch = g.get(ev.x, ev.y);
    if (ch === undefined) throw new Error(`${name}「${ev.name}」(${ev.x},${ev.y}) は地図の外`);
    if (WALL_CHARS.includes(ch) || ch === "o") throw new Error(`${name}「${ev.name}」(${ev.x},${ev.y}) が壁「${ch}」の上`);
    if (d.get(ev.x, ev.y) !== ".") throw new Error(`${name}「${ev.name}」(${ev.x},${ev.y}) に置き物「${d.get(ev.x, ev.y)}」`);
  }
  // 置き物は床か壁の上だけ（床の置き物は通れない物が多いので、通り道の 1 マス幅には置かない）
  outputs.push({ file: srcPath(name, ".txt"), text: g.text() });
  outputs.push({ file: srcPath(name, ".deco.txt"), text: d.text() });
  outputs.push({ file: srcPath(name), text: sourceText(fixW31(name, fixW30(name, configOf(mapId, mapName, displayName, about, events, { scatter: [{ on: ".", z: 1, tiles: ["A2:15"], rate: 0.06, seed: mapId * 10 + 1 }, { on: ".", tiles: ["B:32", "B:33"], rate: 0.05, seed: mapId * 10 + 2 }] })))) });
}

// System.json（スイッチ・変数 701–800 の名前）
const sysPath = dataPath("System.json");
const system = JSON.parse(fs.readFileSync(sysPath, "utf8"));
for (const key of ["switches", "variables"]) {
  const arr = system[key];
  for (let id = 701; id <= 800; id++) arr[id] = key === "switches" ? SWITCH_NAMES[id] ?? "" : "";
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
      if (current !== text) { console.error(`古い: ${rel}（node tools/maps/src/w11_data.mjs で書き直す）`); stale++; }
      else console.log(`一致: ${rel}`);
    } else if (current !== text) {
      fs.writeFileSync(file, text);
      console.log(`書き出し: ${rel}`);
    }
  }
  if (stale) process.exit(1);
}
