// W12（#195）地域五 麦の街道と関所（110–116）・鐘守の修道院（120–124）の設定とデータを書く。何度走らせても同じ結果になる。
//   node tools/maps/src/w12_data.mjs           書く（このあと node tools/maps/build.mjs w12_… w7_020_mist_forest w8_063_shrine w8_080_archive_court で地図を作る）
//   node tools/maps/src/w12_data.mjs --check   書かずに、今のファイルと同じかだけ見る（違えば終了コード 1）
// 書くもの（docs/ROADMAP.md の割り当て表の W12：スイッチ・変数・データベース・コモンイベント 1051–1100、マップ 110–116・120–124）：
//   tools/maps/src/w12_*.json      地図の設定（イベント・凡例の上書き・スタンプ・散らし）。地図（.txt・.deco.txt）は手で書く
//   tools/maps/src/w7_020_mist_forest.json の出入口のイベント 1 つ（西の崖の縄。116 から下りた所）。ほかのイベントとタイル層は触らない
//   063 祠の裏口（080 → 110）と 080 南の坂（063 → 124）の行き先は tools/maps/src/w12_parts.mjs（w8_maps.mjs が読む）
//   Items・Weapons・Armors・Skills・States・Enemies・Troops の 1051–1100（Armors は 1050 まで空の項目で埋める）
//   System.json の switches 1051–1100 の名前
// 文は docs/text.md 5.7（5-01〜5-23）と docs/world.md 2.2・5.1・5.2・5.5・6.5（F10）・7.2・7.3（足場の木）・8.3・11 章から。
// 地域五に墓守の糸は置かない（text.md 1 章）。鐘の話は「祠の像の口は開いている」（113）と「修道院の鐘架は空」（120・122）の二つだけ。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readData, formatTable, dataPath, extendTable } from "../../data/io.mjs";
import { SRC_DIR } from "../build.mjs";
import { patchLater } from "./w14_parts.mjs"; // W14（#234）：朝の砦の後日談の一行
import { STREET_FROM_SHRINE, SLOPE_FROM_COURT, COURT_FROM_SLOPE, SHRINE_FROM_STREET } from "./w12_parts.mjs";
import { withZelinaLedger } from "./w17_parts.mjs"; // W17（#233）：111 の帳面にゼリナの読み上げ

const check = process.argv.includes("--check");
const outputs = []; // [{ file, text }]

// ---------------------------------------------------------------------------
// イベントの命令の部品（W13 と同じ形）
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
/** 会話（「」の中身だけを渡す。1 行ずつ「名前「…」」の形にはしない。名前は名前の窓に出す） */
const talk = (speaker, pages, indent = 0) => pages.flatMap(lines => say(lines, speaker, indent));
const se = (name, indent = 0, volume = 90, pitch = 100) => cmd(250, [{ name, volume, pitch, pan: 0 }], indent);
const plugin = (name, command, label, args = {}, indent = 0) => [
  cmd(357, [name, command, label, args], indent),
  ...Object.entries(args).map(([k, v]) => cmd(657, [`${k} = ${v}`], indent)),
];
const switchOn = (id, indent = 0) => cmd(121, [id, id, 0], indent);
const selfOn = (ch = "A", indent = 0) => cmd(123, [ch, 0], indent);
const transfer = (mapId, x, y, d, indent = 0) => cmd(201, [0, mapId, x, y, d, 0], indent);
const ifSwitch = (id, on = true, indent = 0) => cmd(111, [0, id, on ? 0 : 1], indent);
const ifVar = (id, value, op = 0, indent = 0) => cmd(111, [1, id, 0, value, op], indent);
const ifItem = (id, indent = 0) => cmd(111, [8, id], indent);
const ifScript = (expr, indent = 0) => cmd(111, [12, expr], indent);
const ifActor = (actorId, indent = 0) => cmd(111, [4, actorId, 0], indent);
const ifSelf = (ch, on = true, indent = 0) => cmd(111, [2, ch, on ? 0 : 1], indent);
const ME = "\\N[1]"; // 主人公（名前の欄は「墓守」）
const wait = (frames, indent = 0) => cmd(230, [frames], indent);
const ELSE = (indent = 0) => cmd(411, [], indent);
const ENDIF = (indent = 0) => cmd(412, [], indent);
const end = indent => cmd(0, [], indent);
const choice = (labels, cancel, indent = 0) => cmd(102, [labels, cancel, 0, 2, 0], indent);
const when = (i, label, indent = 0) => cmd(402, [i, label], indent);
const ENDCHOICE = (indent = 0) => cmd(404, [], indent);
const gainItem = (id, n = 1, indent = 0) => cmd(126, [id, 0, 0, n], indent);
const loseItem = (id, n = 1, indent = 0) => cmd(126, [id, 1, 0, n], indent);
const gainWeapon = (id, indent = 0) => cmd(127, [id, 0, 0, 1, false], indent);
const gainArmor = (id, indent = 0) => cmd(128, [id, 0, 0, 1, false], indent);
const gainGold = (n, indent = 0) => cmd(125, [0, 0, n], indent);
const addNote = (id, text, indent = 0) => plugin("Hai_Thoughts", "addNote", "メモに足す", { text, id, kind: "clue" }, indent);
const errand = (args, indent = 0) => plugin("Hai_Notes", "errand", "頼みごとを進める", args, indent);
const errandEnd = (args, indent = 0) => plugin("Hai_Notes", "errandEnd", "頼みごとを終える", args, indent);

const DOWN = 2, LEFT = 4, RIGHT = 6, UP = 8;
const sourceText = cfg => JSON.stringify(cfg, null, 2) + "\n";
const srcPath = name => path.join(SRC_DIR, name + ".json");

// 絵（持ち主がエディタで決め直してよい。仮の絵。残留思念・薄い思念は W10 と同じ火）
const IMG = {
  thought: { characterName: "!Flame", characterIndex: 5, direction: DOWN, pattern: 1 },
  faint: { characterName: "!Flame", characterIndex: 4, direction: DOWN, pattern: 1 },
  chest: { characterName: "!Chest", characterIndex: 0, direction: DOWN, pattern: 0 },
  chestOpen: { characterName: "!Chest", characterIndex: 0, direction: UP, pattern: 0 },
  redChest: { characterName: "!Chest", characterIndex: 2, direction: DOWN, pattern: 0 },
  redChestOpen: { characterName: "!Chest", characterIndex: 2, direction: UP, pattern: 0 },
  sparkle: { characterName: "!Other1", characterIndex: 1, direction: DOWN, pattern: 1 },
  warp: { characterName: "!Other2", characterIndex: 3, direction: DOWN, pattern: 1 },
  doorShut: { characterName: "!Door1", characterIndex: 0, direction: DOWN, pattern: 0 },
  doorOpen: { characterName: "!Door1", characterIndex: 0, direction: UP, pattern: 0 },
  gateShut: { characterName: "!$Gate1", characterIndex: 0, direction: DOWN, pattern: 1 },
  gateOpen: { characterName: "!$Gate1", characterIndex: 0, direction: UP, pattern: 1 },
  pilgrim: { characterName: "People3", characterIndex: 5, direction: LEFT, pattern: 1 },
  sorenne: { characterName: "People4", characterIndex: 6, direction: DOWN, pattern: 1 },
  teo: { characterName: "People1", characterIndex: 2, direction: DOWN, pattern: 1 },
  thresher: { characterName: "People2", characterIndex: 1, direction: LEFT, pattern: 1 },
  elder: { characterName: "People3", characterIndex: 0, direction: DOWN, pattern: 1 },
  child: { characterName: "People1", characterIndex: 6, direction: RIGHT, pattern: 1 },
  taxman: { characterName: "Evil", characterIndex: 6, direction: DOWN, pattern: 1 },
  abbot: { characterName: "Evil", characterIndex: 4, direction: UP, pattern: 1 },
};

// ---------------------------------------------------------------------------
// ID（帯 1051–1100）
// ---------------------------------------------------------------------------
export const ITEM = { pass: 1051, minutes: 1052, petitions: 1053, oldPrayer: 1054, timber: 1055 };
export const WEAPON = { pilgrimStaff: 1051 };
export const ARMOR = { cliffBell: 1051 };
export const SKILL = { handful: 1051, levy: 1052, eastward: 1053, evenCount: 1054, cling: 1055, spear: 1056, toll: 1057, whisper: 1058, lid: 1059, bite: 1060 };
export const STATE = { letPass: 1051, miscount: 1052, westHunger: 1053 };
export const ENEMY = { taxman: 1051, abbot: 1052, line: 1053, crow: 1054, gateDead: 1055, keeperDead: 1056, prayerShade: 1057, coffinWarden: 1058, gateDog: 1059, voiceShade: 1060 };
export const TROOP = { taxman: 1051, abbot: 1052, line: 1053, crows: 1054, gateDead: 1055, keeperDead: 1056, prayerShades: 1057, coffinWarden: 1058, gateDog: 1059, voiceShade: 1060 };
export const SW = {
  taxman: 1051, abbot: 1052, gate: 1053, backGate: 1054, timberDelivered: 1055, timberBurned: 1056, compared: 1057,
  sorenne: 1058, teo: 1059,
  // W16（#232。docs/story/scenes/02-region2-region5.md）
  nightDoorAnswered: 1060, nightDoorLegacy: 1061, shano: 1062, evening: 1063,
};
export const VAR = { bells: 101, scaffold: 176 }; // 鳴らした鐘の数（W6）、頼みごと「足場の木」（P13）
const SW_SCENE3 = 106; // 3 つ目の鐘の場面（W11）
const SW_ARCHIVE_BELL = 102; // 記録院の鐘（W6）。地域五は記録院の鐘の道なので、敵はこの鐘で止まる（場面表 0.2）
const SW_SHANO_FORT = 172; // シャノが砦にいる（W6）
const SW_W8 = { annelise: 401 }; // 生き残り:アンネリーゼが砦へ（W8。使うだけ）
const SW_W16_FORT = { compared: 179, dilThird: 416 }; // 書庫の読み比べ（W6 の帯）・ディルが三通りを聞いた（W8 の帯）。W16 が書く
const ACTOR = { bruno: 5, nora: 6, dil: 7 };
// ほかの W・P の物（使うだけ）
const W8_ITEM = { ration: 423, twoCopies: 426 }; // 配給札（060）・二通りの写し（082）
const W10_TROOP = { goats: 601 };
const P_ITEM = { herb: 196, antidote: 197, elixir: 198, bitterRoot: 199, mossAsh: 200, salve: 142, smelling: 143, holyWater: 144 };

const SWITCH_NAMES = {
  1051: "ボス:関所の収税吏（112）",
  1052: "ボス:院長（122）",
  1053: "街道:関所の門を通行の札で開けた（110）",
  1054: "修道院:裏門の鍵（院長のあと。120→124）",
  1055: "頼みごと:足場の木をソレンヌに渡した（W14 が灰の斜面と頂で読む）",
  1056: "頼みごと:足場の木を燃やした（テオが写しを閉じる）",
  1057: "修道院:テオの読み比べで三通り目を見た",
  1058: "麦の村:ソレンヌと話した",
  1059: "修道院:テオと話した（足場の木を頼まれた）",
  1060: "夜の戸:関所（答えた）",
  1061: "夜の戸:関所 言い残し",
  1062: "崖の上:シャノの一言",
  1063: "麦の村:夕べの数を見た",
};
const VARIABLE_NAMES = {};

// ---------------------------------------------------------------------------
// マップと出入口
// ---------------------------------------------------------------------------
const MAP = { road: 110, village: 111, tower: 112, shrine: 113, cliff: 115, view: 116, cloister: 120, scriptorium: 121, belfry: 122, crypt: 123, slope: 124 };
const FOREST = { mapId: 20, rope: [16, 17], arrive: [15, 18] }; // 霧の森・入口の西の高台の崖の下（W7。坂の石段の東）
// 着く所（ほかのマップから来たときに立つ所）
const AT = {
  roadWest: [MAP.road, 2, 31], roadNorth: x => [MAP.road, x, 1], roadEast: y => [MAP.road, 67, y], roadGate: [MAP.road, 48, 9], roadShrine: [MAP.road, 14, 9],
  villageWest: y => [MAP.village, 2, y],
  towerSouth: [MAP.tower, 24, 37], towerNorth: [MAP.tower, 24, 3],
  shrineIn: [MAP.shrine, 13, 13],
  cliffSouth: x => [MAP.cliff, x, 27], cliffNorth: x => [MAP.cliff, x, 1],
  viewSouth: x => [MAP.view, x, 14],
  cloisterSouth: [MAP.cloister, 9, 42], cloisterNW: x => [MAP.cloister, x, 2], cloisterNE: x => [MAP.cloister, x, 2], cloisterStairs: [MAP.cloister, 54, 39], cloisterBack: [MAP.cloister, 58, 14],
  scriptoriumSouth: x => [MAP.scriptorium, x, 27], belfrySouth: x => [MAP.belfry, x, 27], cryptTop: [MAP.crypt, 24, 5],
  slopeWest: y => [MAP.slope, 1, y],
};
if (STREET_FROM_SHRINE.join() !== AT.roadWest.join()) throw new Error("w12_parts.mjs の STREET_FROM_SHRINE が 110 の西の着き場と違う");

// ---------------------------------------------------------------------------
// 説明と来歴（1 行は全角 40 字まで。docs/knowhow.md 5.1。world.md 8.3 の物はそこから写した）
// ---------------------------------------------------------------------------
const LORE = {
  "通行の札": {
    desc: ["関所を通る札。表に王国の麦の印。", "裏に、通った人数の刻み。線で消した跡が多い。"],
    lore: ["札は家ごとに一枚。関所で麦を一握り納めると刻みが増える。", "裏の刻みは十一。線で消してあるのが七。", "最後の刻みの横に、別の手で「東へ」。"],
  },
  "会議の議事録": {
    desc: ["鐘守の修道院の会議の記録。", "判は六つ。一つだけ、修道院の印ではない。"],
    lore: ["「西の飢えを救うため、鐘の境を東へ広げる」。", "反対の欄に名が一つ。線で消してある。", "日付の横に、王家の印に似た印。印は議事録より新しい墨。"],
  },
  "嘆願書の束": {
    desc: ["西の村々から修道院に届いた嘆願書の束。", "どの紙にも、同じ一行と村の判。"],
    lore: ["「鐘の境を東へ。麦の土地を」。", "判は四十七。どれも村の名の頭の字を彫った木の判。", "一つだけ、字ではなく麦の穂の形の判がある。"],
  },
  "祈祷書の古い版": {
    desc: ["鐘の教会の祈祷書の、古い版。", "礼拝堂のものより薄い。最後の頁が無い。"],
    lore: ["夕べの数の唱え方と、鐘への祈りを綴じたもの。", "「神の怒り」の頁は無い。綴じ足す前の版らしい。", "中ほどに「鐘を黙らせし夜」の一行。", "その一行の上に、紙を貼って剥がした跡。"],
  },
  "足場の木": {
    desc: ["頂の足場を直すための木。一束。", "札に「頂へ。三晩分」。"],
    lore: ["石工の工房に積んであった木の、一束。", "札の「三」は、別の手で「一」の上から書いてある。", "木の端に、石段と同じ石工の印の焼き印。"],
  },
  "巡礼の杖": {
    desc: ["魔法防御が上がる。", "夕べの会の巡礼が、森へ下りる崖で使った杖。"],
    lore: ["石突きに小さな鉤。小鐘を吊る鉤と同じ形。", "柄に、崖を下りた回数の刻み。四十。", "最後の刻みの下に、鐘の形が一つ。"],
  },
  "崖の小道の小鐘": {
    desc: ["眠りを防ぐ。", "見張り塔の小鐘と同じ形。預かり物の札が付いている。"],
    lore: ["塔の鉤と同じ形の鉤に、吊ってあった。", "札に「返す先」。その先は雨で読めない。", "内側の数は、見張り塔の鐘より四つ少ない。"],
  },
};
for (const [name, { desc, lore }] of Object.entries(LORE)) {
  for (const line of [...desc, ...lore]) {
    if ([...line].length > 40) throw new Error(`${name} の文が 40 字を超える：${line}`);
  }
  if (lore.length < 3 || lore.length > 6) throw new Error(`${name} の来歴は 3〜6 行`);
}
const descOf = name => LORE[name].desc.join("\n");
const loreOf = name => ["<hai_lore>", ...LORE[name].lore, "</hai_lore>"].join("\n");

// ---------------------------------------------------------------------------
// データベースの共通（W13 と同じ。帯だけを書き直す）
// ---------------------------------------------------------------------------
const BAND = [1051, 1100];
function clearBand(table, makeEmpty) {
  extendTable(table, BAND[0] - 1, makeEmpty);
  for (let id = BAND[0]; id < table.length && id <= BAND[1]; id++) table[id] = makeEmpty(id);
  while (table.length - 1 >= BAND[0] && table.length - 1 <= BAND[1] && table[table.length - 1].name === "") table.pop();
}
function put(table, id, item, makeEmpty) {
  if (id < BAND[0] || id > BAND[1]) throw new Error(`${id} は W12 の帯の外`);
  extendTable(table, id, makeEmpty);
  table[id] = { ...makeEmpty(id), ...item, id };
}
const writeTable = (name, array) => outputs.push({ file: dataPath(name), text: formatTable(array) });
const ELEMENT = { fire: 2, ice: 3, thunder: 4, light: 8, dark: 9 };
const STATE_SILENCE = 6, STATE_SLEEP = 10;

// Items（大事なもの。欄は W8 の配給札と同じ）
const emptyItem = id => ({
  id, animationId: 0, consumable: true, damage: { critical: false, elementId: 0, formula: "0", type: 0, variance: 20 },
  description: "", effects: [], hitType: 0, iconIndex: 0, itypeId: 1, name: "", note: "", occasion: 0, price: 0, repeats: 1,
  scope: 0, speed: 0, successRate: 100, tpGain: 0,
});
const keyItem = (name, iconIndex) => ({ name, description: descOf(name), note: loreOf(name), iconIndex, itypeId: 2, consumable: false, occasion: 3 });
const items = readData("Items.json");
clearBand(items, emptyItem);
put(items, ITEM.pass, keyItem("通行の札", 195), emptyItem);
put(items, ITEM.minutes, keyItem("会議の議事録", 121), emptyItem);
put(items, ITEM.petitions, keyItem("嘆願書の束", 121), emptyItem);
put(items, ITEM.oldPrayer, keyItem("祈祷書の古い版", 122), emptyItem);
put(items, ITEM.timber, keyItem("足場の木", 195), emptyItem);
writeTable("Items.json", items);

// Weapons（巡礼の杖。115 の赤い宝箱）
const emptyWeapon = id => ({
  id, animationId: 0, description: "", etypeId: 1, traits: [{ code: 31, dataId: 1, value: 0 }, { code: 22, dataId: 0, value: 0 }],
  iconIndex: 0, name: "", note: "", params: [0, 0, 0, 0, 0, 0, 0, 0], price: 0, wtypeId: 0,
});
const weapons = readData("Weapons.json");
clearBand(weapons, emptyWeapon);
put(weapons, WEAPON.pilgrimStaff, {
  name: "巡礼の杖", description: descOf("巡礼の杖"), note: [loreOf("巡礼の杖"), "<hai_unique>"].join("\n"),
  animationId: 1, iconIndex: 101, wtypeId: 6, params: [0, 0, 22, 0, 10, 24, 0, 0],
}, emptyWeapon);
writeTable("Weapons.json", weapons);

// Armors（崖の小道の小鐘。見張り塔の小鐘 321 と同じ形の特徴）
const emptyArmor = id => ({
  id, atypeId: 1, description: "", etypeId: 4, traits: [{ code: 22, dataId: 1, value: 0 }], iconIndex: 0, name: "", note: "",
  params: [0, 0, 0, 0, 0, 0, 0, 0], price: 0,
});
const armors = readData("Armors.json");
clearBand(armors, emptyArmor);
put(armors, ARMOR.cliffBell, {
  name: "崖の小道の小鐘", description: descOf("崖の小道の小鐘"), note: [loreOf("崖の小道の小鐘"), "<hai_unique>"].join("\n"),
  atypeId: 1, etypeId: 5, iconIndex: 205, params: [0, 0, 0, 1, 0, 2, 0, 0],
  traits: [{ code: 22, dataId: 1, value: 0 }, { code: 14, dataId: STATE_SLEEP, value: 0 }],
}, emptyArmor);
writeTable("Armors.json", armors);

// Skills（敵の技。欄は W13 と同じ）
const emptySkill = id => ({
  id, animationId: 0, damage: { critical: false, elementId: 0, formula: "0", type: 0, variance: 20 },
  description: "", effects: [], hitType: 0, iconIndex: 0, message1: "", message2: "", mpCost: 0, name: "", note: "",
  occasion: 0, repeats: 1, requiredWtypeId1: 0, requiredWtypeId2: 0, scope: 1, speed: 0, stypeId: 0, successRate: 100,
  tpCost: 0, tpGain: 0, messageType: 1,
});
const skills = readData("Skills.json");
clearBand(skills, emptySkill);
const enemySkill = (name, o) => ({ name, occasion: 1, stypeId: 0, hitType: 1, note: "<hai_w12:敵の技>", ...o });
const phys = (formula, elementId = -1) => ({ critical: false, elementId, formula, type: 1, variance: 20 });
const SKILLS = [
  [SKILL.handful, "一握り", { description: "手を差し出し、持ち物から一握りを取る。", animationId: 6, iconIndex: 76, message1: "%1は手を差し出した！",
    damage: phys("a.atk * 2.5 - b.def * 2") }],
  [SKILL.levy, "取り立て", { description: "前に並んだ者から、まとめて取り立てる。", animationId: 7, iconIndex: 76, scope: 2, message1: "%1は帳面を読み上げた！",
    damage: phys("a.atk * 2 - b.def * 1.5") }],
  [SKILL.eastward, "東へ", { description: "祈りの文句。東から冷たい声が来る。", hitType: 2, animationId: 101, iconIndex: 71, scope: 2, message1: "%1は「東へ」と唱えた！",
    damage: { critical: false, elementId: ELEMENT.dark, formula: "a.mat * 2 - b.mdf", type: 1, variance: 20 } }],
  [SKILL.evenCount, "夕べの数", { description: "夕べの数を数える。聞く者のまぶたが重くなる。", hitType: 0, animationId: 62, iconIndex: 70, scope: 2, message1: "%1は低い声で数を数えはじめた。",
    effects: [{ code: 21, dataId: STATE_SLEEP, value1: 0.35, value2: 0 }] }],
  [SKILL.cling, "すがる", { description: "手を伸ばしてすがりつく。動きが鈍る。", animationId: 1, iconIndex: 0, message1: "%1はすがりついた！",
    damage: phys("a.atk * 2 - b.def * 2"), effects: [{ code: 32, dataId: 6, value1: 3, value2: 0 }] }],
  [SKILL.spear, "槍の突き", { description: "錆びた槍で突く。", animationId: 11, iconIndex: 107, message1: "%1は槍を突き出した！",
    damage: phys("a.atk * 3 - b.def * 2") }],
  [SKILL.toll, "鐘守の祈り", { description: "低い祈りの声。", hitType: 2, animationId: 101, iconIndex: 71, message1: "%1は祈りの文句を唱えた。",
    damage: { critical: false, elementId: ELEMENT.dark, formula: "a.mat * 2.5 - b.mdf * 1.5", type: 1, variance: 20 } }],
  [SKILL.whisper, "囁き", { description: "耳元で何かを囁く。声が出なくなる。", hitType: 2, animationId: 62, iconIndex: 70, message1: "%1は耳元で囁いた。",
    effects: [{ code: 21, dataId: STATE_SILENCE, value1: 0.5, value2: 0 }] }],
  [SKILL.lid, "棺の蓋", { description: "重い石の蓋を振り下ろす。", animationId: 7, iconIndex: 0, message1: "%1は棺の蓋を振り下ろした！",
    damage: phys("a.atk * 4 - b.def * 2") }],
  [SKILL.bite, "噛みつき", { description: "喉元に噛みつく。", animationId: 6, iconIndex: 0, message1: "%1は飛びかかった！",
    damage: phys("a.atk * 3.5 - b.def * 2") }],
];
for (const [id, name, o] of SKILLS) put(skills, id, enemySkill(name, o), emptySkill);
writeTable("Skills.json", skills);

// States（収税吏・院長の弱み。docs/world.md 5.5）
const emptyState = id => ({
  id, autoRemovalTiming: 0, chanceByDamage: 100, iconIndex: 0, maxTurns: 1, message1: "", message2: "", message3: "", message4: "",
  minTurns: 1, motion: 0, name: "", note: "", overlay: 0, priority: 50, releaseByDamage: false, removeAtBattleEnd: true,
  removeByDamage: false, removeByRestriction: false, removeByWalking: false, restriction: 0, stepsToRemove: 100, traits: [],
  messageType: 1,
});
const states = readData("States.json");
clearBand(states, emptyState);
put(states, STATE.letPass, {
  name: "通せ（収税吏）", iconIndex: 10, priority: 60, restriction: 4, motion: 3,
  message3: "%1は札を見たまま、帳面に何かを書きつけている。", message4: "%1は、また手を差し出した。",
  autoRemovalTiming: 2, minTurns: 1, maxTurns: 1,
  note: "<hai_w12:通行の札を持って挑むと、戦いの頭に付く（半ターン止まる）>",
}, emptyState);
put(states, STATE.miscount, {
  name: "勘定が狂う（収税吏）", iconIndex: 6, priority: 55, restriction: 0,
  message3: "%1の指が、帳面の上で行き来している。", message4: "",
  autoRemovalTiming: 0,
  traits: [{ code: 21, dataId: 2, value: 0.75 }, { code: 22, dataId: 0, value: -0.2 }],
  note: "<hai_w12:配給札を持って挑むと、戦いの頭に付く（攻撃と命中が落ちる。戦いの終わりまで）>",
}, emptyState);
put(states, STATE.westHunger, {
  name: "西の飢え（院長）", iconIndex: 6, priority: 55, restriction: 0,
  message3: "%1の祈りの声が、途中で途切れる。", message4: "",
  autoRemovalTiming: 0,
  traits: [{ code: 21, dataId: 3, value: 0.7 }, { code: 21, dataId: 5, value: 0.7 }, { code: 21, dataId: 4, value: 0.8 }, { code: 13, dataId: STATE_SILENCE, value: 2 }],
  note: "<hai_w12:嘆願書の束を持って挑むと、戦いの頭に付く（崩れる。沈黙がさらによく効く）>",
}, emptyState);
writeTable("States.json", states);

// Enemies・Troops（world.md 5.1・5.5。街道は「飢えの列」、修道院は「鐘守の亡骸」。そうとは書かない。数値は仮で、持ち主が調整する）
// ボスは記録院の鐘の間のボス（真名を読んだ学者 2600）より少し弱い（道の途中の壁。world.md 5.1）
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
const ENEMIES = [
  // 関所の収税吏（112）。弱み：通行の札（戦いの頭に「通せ」）・配給札（勘定が狂う）
  // W27（#300）：R3 で 4〜5 ターン・味方の HP 8〜9 割残ったので、W22 後の加入時の装備（Lv8 の三人・攻撃と灰火）で 9〜11 ターン・HP 6 割残る所に（HP 2400→4200、攻撃 46→82）
  [ENEMY.taxman, { name: "関所の収税吏", battlerName: "Gatekeeper", battlerHue: 30, params: [4200, 40, 82, 34, 18, 26, 22, 30], exp: 340, gold: 260,
    traits: [...base, T.element(ELEMENT.thunder, 1.5)],
    actions: [attack, act(SKILL.handful, 5), onTurn(SKILL.levy, 3, 3, 6)],
    dropItems: noDrop,
    note: ["<hai_boss>", "<hai_boss_name:関所の収税吏>", `<hai_boss_switch:${SW.taxman}>`, "<hai_weak_hint:雷>", "<hai_actions_low:2,40>", "<hai_drop:none>"].join("\n") }],
  // 院長（122）。弱み：嘆願書の束（崩れる）、沈黙がよく効く
  // W27（#300）：夕べの数の範囲を隊に直し（自分を眠らせていた）、同じ遊び方（Lv8・8・9）で 8〜12 ターン・HP 5 割残る所に（HP 2500→3800、魔力 48→70）
  [ENEMY.abbot, { name: "院長", battlerName: "Sorcerer", battlerHue: 200, params: [3800, 300, 28, 30, 70, 40, 24, 30], exp: 380, gold: 280,
    traits: [...base, T.element(ELEMENT.light, 1.5), T.stateRate(STATE_SILENCE, 1.5)],
    actions: [attack, act(SKILL.eastward, 6), onTurn(SKILL.evenCount, 2, 4, 6)],
    dropItems: noDrop,
    note: ["<hai_boss>", "<hai_boss_name:院長>", `<hai_boss_switch:${SW.abbot}>`, "<hai_weak_hint:光>", "<hai_actions_low:2,50>", "<hai_drop:none>"].join("\n") }],
  // 緑・黄・赤
  // 夜の戸の声だけの影（W16。W11 の 701 と同じ型で、強さは麦の街道のふつうの敵 1〜2 体分。言い残しはマップのイベントのメモ欄 <hai_enemy_shade:…>）
  [ENEMY.voiceShade, { name: "声だけの影", battlerName: "SF_Shadow", battlerHue: 0, params: [480, 20, 30, 18, 22, 20, 18, 10], exp: 32, gold: 22,
    traits: [...base, T.element(ELEMENT.light, 2), T.element(ELEMENT.dark, 0.5), { code: 23, dataId: 6, value: 0.85 }],
    actions: [attack, act(SKILL.whisper, 3)], dropItems: drop(1, P_ITEM.mossAsh, 4) }],
  [ENEMY.line, { name: "飢えの列", battlerName: "Zombie", battlerHue: 40, params: [240, 0, 22, 12, 8, 10, 14, 10], exp: 14, gold: 10,
    traits: [...base, T.element(ELEMENT.fire, 1.5)], actions: [attack, act(SKILL.cling, 4)], dropItems: drop(1, P_ITEM.herb, 6) }],
  [ENEMY.crow, { name: "痩せ烏", battlerName: "Crow", battlerHue: 0, params: [180, 0, 24, 10, 8, 10, 32, 10], exp: 12, gold: 8,
    traits: [...base, T.element(ELEMENT.thunder, 1.5)], actions: [attack], dropItems: noDrop }],
  [ENEMY.gateDead, { name: "関所の兵の亡骸", battlerName: "Stoneknight", battlerHue: 30, params: [520, 0, 34, 22, 8, 14, 18, 10], exp: 34, gold: 24,
    traits: [...base, T.element(ELEMENT.thunder, 1.5)], actions: [attack, act(SKILL.spear, 4)], dropItems: drop(1, P_ITEM.smelling, 5) }],
  [ENEMY.keeperDead, { name: "鐘守の亡骸", battlerName: "Lich", battlerHue: 180, params: [480, 40, 26, 20, 26, 24, 16, 10], exp: 34, gold: 24,
    traits: [...base, T.element(ELEMENT.light, 1.5)], actions: [attack, act(SKILL.toll, 4)], dropItems: drop(1, P_ITEM.holyWater, 6) }],
  [ENEMY.prayerShade, { name: "祈りの影", battlerName: "Wraith", battlerHue: 200, params: [220, 30, 18, 12, 20, 18, 16, 10], exp: 14, gold: 10,
    traits: [...base, T.element(ELEMENT.light, 1.5)], actions: [attack, act(SKILL.whisper, 3)], dropItems: noDrop }],
  [ENEMY.coffinWarden, { name: "棺守り", battlerName: "Stoneknight", battlerHue: 200, params: [1700, 0, 44, 32, 10, 22, 16, 10], exp: 100, gold: 55,
    traits: [...base, T.element(ELEMENT.light, 1.5)], actions: [attack, act(SKILL.lid, 4)], dropItems: drop(1, P_ITEM.elixir, 3) }],
  [ENEMY.gateDog, { name: "関所の番犬", battlerName: "SF_Zombiedog", battlerHue: 30, params: [1600, 0, 46, 26, 8, 16, 30, 10], exp: 100, gold: 55,
    traits: [...base, T.element(ELEMENT.fire, 1.5)], actions: [attack, act(SKILL.bite, 4)], dropItems: drop(1, P_ITEM.elixir, 3) }],
];
for (const [id, o] of ENEMIES) put(enemies, id, o, emptyEnemy);
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
  [TROOP.taxman, "W12_ボス：関所の収税吏", [ENEMY.taxman]],
  [TROOP.abbot, "W12_ボス：院長", [ENEMY.abbot]],
  [TROOP.line, "W12_緑：飢えの列×2", [ENEMY.line, ENEMY.line]],
  [TROOP.crows, "W12_緑：痩せ烏×3", [ENEMY.crow, ENEMY.crow, ENEMY.crow]],
  [TROOP.gateDead, "W12_黄：関所の兵の亡骸", [ENEMY.gateDead]],
  [TROOP.keeperDead, "W12_黄：鐘守の亡骸", [ENEMY.keeperDead]],
  [TROOP.prayerShades, "W12_緑：祈りの影×2", [ENEMY.prayerShade, ENEMY.prayerShade]],
  [TROOP.coffinWarden, "W12_赤：棺守り", [ENEMY.coffinWarden]],
  [TROOP.gateDog, "W12_赤：関所の番犬", [ENEMY.gateDog]],
  [TROOP.voiceShade, "W12_緑：声だけの影（列に並んだ女）", [ENEMY.voiceShade]],
];
const troops = readData("Troops.json");
clearBand(troops, emptyTroop);
for (const [id, name, members] of TROOPS) {
  const pos = row(members.length);
  put(troops, id, { name, members: members.map((enemyId, i) => ({ enemyId, ...pos[i], hidden: false })) }, emptyTroop);
}
// ボスの言葉（text.md 4.11 の型。戦いの前 1〜2 行・中 1 行・崩れるとき 1 行。world.md 11 章の口調）
const page0 = emptyTroop(0).pages[0];
const turnPage = (a, b, span, list) => ({ ...page0, conditions: { ...page0.conditions, turnA: a, turnB: b, turnValid: true }, span, list });
const hpPage = (hp, span, list) => ({ ...page0, conditions: { ...page0.conditions, enemyHp: hp, enemyIndex: 0, enemyValid: true }, span, list });
const addState = (stateId, indent = 0) => cmd(333, [0, 0, stateId], indent); // 敵 1 体目にステートを付ける
troops[TROOP.taxman].pages = [
  turnPage(0, 0, 0, [
    ifItem(ITEM.pass),
    ...say(["通行の札を、収税吏の目の前に掲げた。"], "", 1),
    ...say(["……札。通せ。"], "関所の収税吏", 1),
    addState(STATE.letPass, 1),
    end(1), ENDIF(),
    ifItem(W8_ITEM.ration),
    ...say(["配給札も出して、並べて見せた。裏の刻みは、六。五。六。"], "", 1),
    ...say(["一握り。……六。五。いや、六。"], "関所の収税吏", 1),
    addState(STATE.miscount, 1),
    end(1), ENDIF(),
    END,
  ]),
  turnPage(3, 3, 1, [...say(["一握り。一握りは王のもの。"], "関所の収税吏"), END]),
  hpPage(40, 1, [
    ifScript("$gameTroop.members()[0].isAlive()"),
    ...say(["納め、百九十。通し、……幾つだ。"], "関所の収税吏", 1),
    end(1), ENDIF(), END,
  ]),
];
troops[TROOP.abbot].pages = [
  turnPage(0, 0, 0, [
    ifItem(ITEM.petitions),
    ...say(["嘆願書の束の紐をほどいて、一枚目を読み上げた。", "「鐘の境を東へ。麦の土地を」。"], "", 1),
    ...say(["……西の飢えは。"], "院長", 1),
    addState(STATE.westHunger, 1),
    end(1), ENDIF(),
    END,
  ]),
  turnPage(3, 3, 1, [...say(["東へ、東へ。鐘の届く所を、東へ。"], "院長"), END]),
  hpPage(50, 1, [
    ifScript("$gameTroop.members()[0].isAlive()"),
    ...say(["西の者。数を、乱すな。"], "院長", 1),
    end(1), ENDIF(), END,
  ]),
];
writeTable("Troops.json", troops);

// ---------------------------------------------------------------------------
// イベントの部品
// ---------------------------------------------------------------------------
const text = (name, [x, y], lines, extra = {}) => ({ name, type: "text", x, y, lines, ...extra });
const thought = (id, name, [x, y], lines, after = []) => (after.length
  ? { name: `思念 ${id} ${name}`, type: "raw", x, y, note: `<hai_thought:${id}>`, pages: [{ image: IMG.thought, priorityType: 1, list: [...say(lines), ...after, END] }] }
  : { name: `思念 ${id} ${name}`, type: "text", x, y, note: `<hai_thought:${id}>`, image: IMG.thought, lines });
/** 夜の戸（W16。場面表 0.1）の声だけの影と、倒したあとの一度きりの文（w8_maps.mjs と同じ作り） */
const shadeEvent = (name, [x, y], voice, troopId, answered) => ({
  name, type: "raw", x, y,
  note: [`<hai_enemy:${troopId},green>`, `<hai_enemy_shade:${voice}>`, "<hai_enemy_shade_quiet>", "<hai_enemy_once>", `<hai_enemy_bell:${SW_ARCHIVE_BELL}>`].join("\n"),
  pages: [
    { priorityType: 0 },
    { conditions: { switch1Id: answered, switch1Valid: true }, image: { characterName: "Monster", characterIndex: 5, direction: DOWN, pattern: 1 }, priorityType: 1, trigger: 2, moveType: 0 },
  ],
});
const afterShade = (name, [x, y], mapId, shadeId, answered, legacy, list) => ({
  name, type: "raw", x, y,
  pages: [
    { priorityType: 0 },
    { conditions: { switch1Id: answered, switch1Valid: true }, priorityType: 0, trigger: 4,
      list: [ifScript(`$gameSelfSwitches.value([${mapId}, ${shadeId}, "A"])`), selfOn("B", 1), end(1), ENDIF(), END] },
    { conditions: { switch1Id: answered, switch1Valid: true, selfSwitchCh: "B", selfSwitchValid: true }, priorityType: 0, trigger: 3, list: [...list, switchOn(legacy), END] },
    { conditions: { switch1Id: legacy, switch1Valid: true }, priorityType: 0 },
  ],
});
const knock3 = (indent = 0) => [se("Knock", indent), wait(30, indent), se("Knock", indent), wait(30, indent), se("Knock", indent), wait(40, indent)];
const markRead = (id, indent = 0) => plugin("Hai_Thoughts", "markRead", "思念を既読にする", { id }, indent);
const faint = (id, name, [x, y], lines) => ({
  name: `薄い思念 ${id} ${name}`, type: "raw", x, y, note: `<hai_faint:${id}>`,
  pages: [{ image: IMG.faint, priorityType: 1, list: [...say(lines), cmd(117, [201]), END] }],
});
// 調べると一行か二行出る置物（タイルの絵）。絵の無いものは、床に置く見えない置物
const look = (name, [x, y], lines, tileId = null) => ({
  name, type: "raw", x, y, pages: [{ ...(tileId ? { image: { tileId } } : {}), priorityType: 1, list: [...say(lines), END] }],
});
const exit = (name, [x, y], [mapId, tx, ty], d) => ({ name, type: "transfer", x, y, to: [mapId, tx, ty, d] });
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
const pickup = (name, [x, y], gainList, extra = {}) => ({
  name: `拾い物（${name}）`, type: "raw", x, y,
  pages: [
    { image: IMG.sparkle, priorityType: 1, stepAnime: true, walkAnime: false, list: [se("Item3"), ...gainList, selfOn(), END], ...extra },
    { conditions: { selfSwitchCh: "A", selfSwitchValid: true }, priorityType: 0 },
  ],
});
const pickItem = (name, xy, id, n, icon) => pickup(name, xy, [gainItem(id, n), ...say([`\\I[${icon}]${name}${n > 1 ? `×${n}` : ""}を手に入れた。`])]);
const pickGold = (xy, n) => pickup("鉄くず", xy, [gainGold(n), ...say([`鉄くずを ${n} 手に入れた。`])]);
/** 来歴つきの大事なもの（調べた文のあとに入手。光る点か、タイルの絵） */
const keyPickup = (name, [x, y], lines, gainList, image = IMG.sparkle, after = []) => ({
  name: `拾い物（${name}）`, type: "raw", x, y,
  pages: [
    { image, priorityType: 1, stepAnime: image === IMG.sparkle, walkAnime: false, list: [...say(lines), se("Item3"), ...gainList, selfOn(), ...after, END] },
    { conditions: { selfSwitchCh: "A", selfSwitchValid: true }, priorityType: 0 },
  ],
});
const warp = (name, [x, y]) => ({
  name: `結界（${name}）`, type: "raw", x, y, note: `<hai_warp:${name}>`,
  pages: [{ image: IMG.warp, priorityType: 1, stepAnime: true, list: [END] }],
});
const npc = (name, [x, y], image, pages) => ({ name, type: "raw", x, y, pages: pages.map(p => ({ image, priorityType: 1, ...p })) });
// シンボル敵（docs/plugins/Hai_SymbolEnemy.md。緑は往復かランダム、赤は持ち場から出ない。緑は <hai_enemy_hesitate>）
const ENEMY_IMG = {
  [TROOP.line]: { characterName: "Damage1", characterIndex: 1 },
  [TROOP.crows]: { characterName: "Nature", characterIndex: 5 },
  [TROOP.gateDead]: { characterName: "Evil", characterIndex: 5 },
  [TROOP.keeperDead]: { characterName: "Evil", characterIndex: 2 },
  [TROOP.prayerShades]: { characterName: "Damage2", characterIndex: 3 },
  [TROOP.coffinWarden]: { characterName: "Evil", characterIndex: 0 },
  [TROOP.gateDog]: { characterName: "Monster", characterIndex: 0 },
  [W10_TROOP.goats]: { characterName: "Nature", characterIndex: 3 },
};
const NAMES = {
  [TROOP.line]: "飢えの列", [TROOP.crows]: "痩せ烏", [TROOP.gateDead]: "関所の兵の亡骸", [TROOP.keeperDead]: "鐘守の亡骸",
  [TROOP.prayerShades]: "祈りの影", [TROOP.coffinWarden]: "棺守り", [TROOP.gateDog]: "関所の番犬", [W10_TROOP.goats]: "灰山羊",
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
  // 鳴らした地域の敵は追わず、東を向いて止まる（P の旗。地域五は記録院の鐘の道なので記録院の鐘。場面表 0.2。W16）
  const note = [`<hai_enemy:${troopId},${rank}>`, ...(chase !== null ? [`<hai_enemy_chase:${chase}>`] : []), ...(rank === "green" ? ["<hai_enemy_hesitate>"] : []), `<hai_enemy_bell:${SW_ARCHIVE_BELL}>`].join("\n");
  return { name: `${NAMES[troopId]}（${rankName}${label}）`, type: "raw", x, y, note, pages: [page] };
};
const bossBattle = (troopId, [mapId, x, y, d], indent = 0) => plugin("Hai_Boss", "bossBattle", "ボス戦",
  { troopId: String(troopId), escapeMapId: String(mapId), escapeX: String(x), escapeY: String(y), escapeDirection: String(d) }, indent);
const NUM = ["一", "二", "三", "四", "五"]; // NUM[n] は n＋1

// 見た目（tools/maps/looks.json の「麦の街道と関所」「鐘守の修道院」の場所を写した。docs/look.md 3 章）
const LOOK = {
  road: { legend: "highway", tilesetId: 24, note: "<hai_tone:-17,-17,-34,136>", bgm: { name: "Field1", volume: 60, pitch: 100, pan: 0 }, bgs: { name: "Wind2", volume: 30, pitch: 100, pan: 0 }, battleback: ["Road1", "Grassland"] },
  village: { legend: "highway", tilesetId: 24, note: "<hai_tone:0,-9,-34,68>", bgm: { name: "Scene5", volume: 55, pitch: 100, pan: 0 }, bgs: { name: "Wind1", volume: 20, pitch: 100, pan: 0 }, battleback: ["DirtField", "Grassland"] },
  tower: { legend: "dungeon", tilesetId: 11, note: "<hai_tone:-34,-34,-17,85>", bgm: { name: "Castle1", volume: 55, pitch: 100, pan: 0 }, bgs: { name: "Wind2", volume: 25, pitch: 100, pan: 0 }, battleback: ["Castle2", "Castle2"] },
  shrine: { legend: "dungeon", tilesetId: 14, note: "<hai_tone:-34,-51,-51,85>", bgm: { name: "Scene9", volume: 50, pitch: 100, pan: 0 }, bgs: null, battleback: ["Stone1", "Temple"] },
  cliff: { legend: "highway", tilesetId: 24, note: "<hai_tone:-17,-17,0,102>\n<hai_parallax:Mountains1,0,0>\n<hai_fog:50,0.3,0.05>", bgm: { name: "Field1", volume: 55, pitch: 100, pan: 0 }, bgs: { name: "Wind4", volume: 40, pitch: 100, pan: 0 }, battleback: ["Wasteland", "Cliff"] },
  cloister: { legend: "monastery", tilesetId: 25, note: "<hai_tone:-34,-34,-17,85>", bgm: { name: "Scene3", volume: 55, pitch: 100, pan: 0 }, bgs: { name: "Wind1", volume: 25, pitch: 100, pan: 0 }, battleback: ["Cobblestones1", "Temple"] },
  scriptorium: { legend: "monastery", tilesetId: 25, note: "<hai_tone:9,-9,-34,51>", bgm: { name: "Scene3", volume: 50, pitch: 100, pan: 0 }, bgs: { name: "Fire1", volume: 15, pitch: 100, pan: 0 }, battleback: ["Wood1", "Room2"] },
  belfry: { legend: "monastery", tilesetId: 25, note: "<hai_tone:-34,-34,-17,102>", bgm: { name: "Castle3", volume: 60, pitch: 100, pan: 0 }, bgs: { name: "Wind3", volume: 35, pitch: 100, pan: 0 }, battleback: ["DecorativeTile1", "Tower"] },
  crypt: { legend: "monastery", tilesetId: 25, note: "<hai_tone:-68,-68,-51,85>\n<hai_dark:4>", bgm: { name: "Dungeon3", volume: 60, pitch: 100, pan: 0 }, bgs: { name: "Drips", volume: 35, pitch: 100, pan: 0 }, battleback: ["Stone1", "Temple"] },
  slope: { legend: "highway", tilesetId: 24, note: "<hai_tone:-17,-17,-17,102>", bgm: { name: "Field1", volume: 55, pitch: 100, pan: 0 }, bgs: { name: "Wind2", volume: 30, pitch: 100, pan: 0 }, battleback: ["Road2", "Grassland"] },
};
const lookOf = key => {
  const { battleback, bgs, ...rest } = LOOK[key];
  return { ...rest, ...(bgs ? { bgs } : {}), fields: { specifyBattleback: true, battleback1Name: battleback[0], battleback2Name: battleback[1] } };
};
// スタンプ（tools/maps/looks.json の stamps を写した）
const STAMP = {
  tent: { name: "集落の天幕（天幕A。3×3。下の真ん中が入口）", tiles: [["B:5", "B:6", "B:7"], ["B:13", "B:14", "B:15"], ["B:21", "B:22", "B:23"]] },
  tentRed: { name: "夕べの会の天幕（天幕B。赤い屋根。3×3。下の真ん中が入口）", tiles: [["B:29", "B:30", "B:31"], ["B:37", "B:38", "B:39"], ["B:45", "B:46", "B:47"]] },
  cart: { name: "荷車（荷台は丸太の橋（横）、上に干し草と薪。2×1。荷車の絵は同梱に無いので代わり）", tiles: [["B:81", "B:81"]], upper: [["B:248", "B:170"]] },
  cartSacks: { name: "捨てた荷車（荷台に麻袋と木箱。2×1）", tiles: [["B:81", "B:81"]], upper: [["D:248", "D:224"]] },
  churchTable: { name: "教会机（祭壇。3×2）", tiles: [["C:184", "C:185", "C:186"], ["C:192", "C:193", "C:194"]] },
  goddess: { name: "鐘を抱く女の像（女神像で代用。1×2）", tiles: [["C:169"], ["C:177"]] },
  bookshelves: { name: "写本の棚（本棚 3 つ。3×2）", tiles: [["B:157", "B:158", "B:159"], ["B:165", "B:166", "B:167"]] },
  coffin: { name: "棺（納骨堂。1×2）", tiles: [["E:86"], ["E:94"]] },
  bellFrame: { name: "空の鐘架（石の柱 2 本と台座。3×2。鐘の絵は同梱に無い）", tiles: [["B:24", null, "B:24"], ["B:32", "C:173", "B:32"]] },
};
const stamp = (at, key) => ({ at, ...STAMP[key] });
// 高台の上の道（凡例 highway の ^ の上に、z=1 で道と石畳を重ねる。段差の上面の形はそのまま）
const HIGH_CHARS = {
  K: { name: "高台の上の王国の街道（段差の上面に石畳A を重ねる）", as: "^", tiles: [null, "A2:3"] },
  P: { name: "高台の上の土の道（段差の上面に道（草地）を重ねる）", as: "^", tiles: [null, "A2:2"] },
  // 場所移動の着き場（高台の上でも、下は地面にする。段差の上面は壁の扱いで、着き場にできない。tools/data/check.mjs）
  1: { name: "高台の上の着き場（石畳A。上にも石畳A を重ねて、まわりの K とつなぐ）", tiles: ["A2:3", "A2:3"] },
  2: { name: "高台の上の着き場（道（草地）。上にも道を重ねて、まわりの P とつなぐ）", tiles: ["A2:2", "A2:2"] },
};

// ===========================================================================
// 110 麦の街道・関所の道（70×50、外、段が 2）
// ===========================================================================
const roadGate = {
  name: "関所の門", type: "raw", x: 48, y: 8,
  pages: [
    { image: IMG.gateShut, priorityType: 1, walkAnime: false,
      list: [
        ...say(["関所の門。太い閂の横に、札を差しこむ溝が切ってある。", "溝の上の刻み文字。『一握りは王のもの。札を示せ』。"]),
        ifItem(ITEM.pass),
        choice(["通行の札を差しこむ", "やめる"], 1, 1),
        when(0, "通行の札を差しこむ", 1),
        se("Key", 2), switchOn(SW.gate, 2),
        ...say(["札を溝に差しこむと、門の内側で閂の外れる音がした。", "札は、溝の奥から押し戻されてきた。"], "", 2),
        end(2),
        when(1, "やめる", 1), end(2),
        ENDCHOICE(1),
        end(1),
        ELSE(),
        ...addNote("w12:gate", "関所の門は、通行の札を溝に差しこむと開く（麦の街道・関所の道）", 1),
        end(1),
        ENDIF(),
        END,
      ] },
    { conditions: { switch1Id: SW.gate, switch1Valid: true }, image: IMG.gateOpen, priorityType: 1, trigger: 1, walkAnime: false,
      list: [se("Door2"), transfer(...AT.towerSouth, UP), END] },
  ],
};
const pilgrim = npc("夕べの会の巡礼", [40, 30], IMG.pilgrim, [
  { list: [
    ...talk("巡礼", [
      ["夕べまでに修道院に着きたいんだよ。皆と一緒に数えたいからね。", "あんたも上るのかい。関所の門は、札が無いと開かないよ。"],
      ["札は家に一枚きり。あたしのは、村の娘に置いてきた。", "来る道の脇に、札を握ったままの骨がいた。あたしは、指をほどけなかった。"],
      ["昔の巡礼は、北の崖の小道を下りてきたって。霧の森の西に出る道だよ。", "あたしは縄が怖い。だから、関所の方を回る。"],
    ]),
    selfOn(), END,
  ] },
  { conditions: { selfSwitchCh: "A", selfSwitchValid: true },
    list: [...say(["一、二、三。まだ早いね。着いてから数えよう。"], "巡礼"), END] },
]);
// 夜の戸（W16。場面表 0.1・2-14）：R5-01 を読んであれば、戸を叩かれる。答えると声だけの影（1060）が戸の前に出る。
//   倒すと言い残しを窓なしで出し（Hai_SymbolEnemy）、「夜の戸の後（自動）」が言い残しを既読（L5-01）にしてスイッチ 1061 を立てる
const SHADE_TOLL = "声だけの影（列に並んだ女）";
const TOLL_DOOR_LINES = ["関所の兵の詰め所。戸は外から板を打ちつけてある。", "板に、拳の跡が三つ、縦に並ぶ。古いものだ。", "板の釘は錆びている。一本だけ、頭が光っている。"];
const nightDoorToll = {
  name: "関所の詰め所の戸", type: "raw", x: 28, y: 12,
  pages: [
    { priorityType: 1, list: [
      ...say(TOLL_DOOR_LINES),
      ifScript('Hai.Thoughts.isRead("R5-01")'),
      ...knock3(1),
      ...say(["入れておくれ。娘の分を、納めに来た"], "列に並んだ女", 1),
      ...say(["戸の前には、誰もいない。"], "", 1),
      ...say(["入れておくれ"], "列に並んだ女", 1),
      choice(["答える", "答えない"], 1, 1),
      when(0, "答える", 1),
      ...say(["ここにいる"], ME, 2),
      ...say(["板に、黒いものが溜まった。声の形。"], "", 2),
      switchOn(SW.nightDoorAnswered, 2),
      end(2),
      when(1, "答えない", 1),
      ...say(["音は、三度で止んだ。板の釘が、一本だけ光っている。"], "", 2),
      end(2),
      ENDCHOICE(1),
      end(1), ENDIF(),
      END,
    ] },
    { conditions: { switch1Id: SW.nightDoorAnswered, switch1Valid: true }, priorityType: 1, list: [...say(TOLL_DOOR_LINES), END] },
    { conditions: { switch1Id: SW.nightDoorLegacy, switch1Valid: true }, priorityType: 1, list: [...say(["板は、外から打ってある。", "中に誰がいたのかは、分からない。"]), END] },
  ],
};
const roadEvents = [
  ...[30, 31, 32].map(y => exit("西の口（村の祠へ）", [0, y], SHRINE_FROM_STREET, DOWN)),
  ...[4, 5, 6].map(x => exit("北の崖道（崖の小道へ）", [x, 0], AT.cliffSouth(x), UP)),
  ...[38, 39, 40].map(y => exit("東の道（麦の村へ）", [69, y], AT.villageWest(y - 20), RIGHT)),
  roadGate,
  { name: "街道の祠の戸", type: "raw", x: 14, y: 8,
    pages: [{ priorityType: 1, trigger: 1, list: [se("Door1"), transfer(...AT.shrineIn, UP), END] }] },
  nightDoorToll,
  { name: "捨てた荷", type: "raw", x: 16, y: 29, pages: [{ image: { tileId: "D:248" }, priorityType: 1, list: [
    ...say([
      "街道の脇に、荷が列の形のまま捨ててある。荷の口は、どれも西を向いている。",
      "荷を数えると三十四。踏み固めた足跡は、関所の方へ、その何倍も続いている。",
    ]),
    ifActor(ACTOR.nora), ...say(["三十四！"], "ノラ", 1), end(1), ENDIF(), // W16（場面表 2-12）
    END,
  ] }] },
  look("配給札の束", [25, 33], ["麻袋の口から、木の札の束がこぼれている。表に麦の印。", "どの札も、裏の刻みが線で消してある。"], "D:249"),
  look("王国の道標", [46, 28], ["王国の道標。東を指す板に『関所　修道院』。", "西を指す板は割れて、字が半分しか無い。"]),
  keyPickup("通行の札", [38, 28], ["うつ伏せの骨の手に、木の札が一枚。", "札の角を握った指の骨を、一本ずつ外した。"],
    [gainItem(ITEM.pass), ...say(["\\I[195]通行の札を手に入れた。"])], IMG.sparkle,
    [...addNote("w12:pass", "通行の札は、関所の道の骨が握っていた（麦の街道）")]),
  thought("R5-01", "列に並んだ女", [33, 34], [
    "関所で麦を一握り納めた。娘の分は、娘が自分で納めろと役人が言った。",
    "札は、わたしの首に一枚きり。娘の手の中には、麦が四粒。",
  ], [ifActor(ACTOR.bruno), ...say(["ブルーノが自分の手を見た。握って、開いた。", "四粒は、入りそうだった。"], "", 1), end(1), ENDIF()]),
  faint("F10", "荷車の御者", [21, 23], [
    "修道院へ麦を受け取りに行く朝。荷台で、墓守が寝ていた。",
    "空の麦袋を三つ重ねて、枕にしている。砦から乗ってきたらしい。",
    "轍で荷台が跳ねるたびに揺らしたが、起きない。",
    "関所の手前で起きて、袋を畳んで返してきた。三つとも、角を揃えて。",
  ]),
  pilgrim,
  chestItem("薬草", [4, 22], P_ITEM.herb, 2, 176),
  chestGold([64, 12], 150),
  chestItem("苦い根", [12, 41], P_ITEM.bitterRoot, 2, 189),
  chestItem("秘薬", [64, 44], P_ITEM.elixir, 1, 179),
  pickGold([55, 22], 40),
  pickItem("灰の苔", [66, 20], P_ITEM.mossAsh, 1, 190),
  foe(TROOP.line, "green", [17, 31]),
  foe(TROOP.line, "green", [30, 31]),
  foe(TROOP.crows, "green", [22, 43]),
  foe(TROOP.gateDead, "yellow", [48, 22], { dir: "down", n: 4 }),
  foe(TROOP.gateDead, "yellow", [61, 30]),
  foe(TROOP.gateDog, "red", [62, 42], "fixed", 2),
  // W16（場面表 2-12・2-14）
  { name: "麻袋の跡", type: "raw", x: 22, y: 22, pages: [{ priorityType: 1, list: [
    ifScript('Hai.Thoughts.isRead("F10")'),
    ...say(["小屋の奥の床に、畳んだ麻袋の形の跡。三つ分。", "角が、揃っている。"], "", 1), end(1), ENDIF(), END,
  ] }] },
  shadeEvent(SHADE_TOLL, [27, 14], "名を呼ばれて、この子が笑った。初めてだ", TROOP.voiceShade, SW.nightDoorAnswered),
];
roadEvents.push(afterShade("夜の戸の後（自動）", [0, 0], MAP.road, roadEvents.findIndex(e => e.name === SHADE_TOLL) + 1, SW.nightDoorAnswered, SW.nightDoorLegacy, [
  ...say(["影は、子どもの背の高さに手を添える形のまま、崩れた。"]),
  // 崩れる → 声（話し手の名つき）の順（文5 #272。R2 気になる 12。P17 の shadeVoice）
  ...plugin("Hai_SymbolEnemy", "shadeVoice", "影の声を出す", { eventId: String(roadEvents.findIndex(e => e.name === SHADE_TOLL) + 1), speaker: "列に並んだ女" }),
  ...markRead("L5-01"),
  ...say(["光っていた釘の頭が、灰で曇った。", "墓守は帳面に、炭で一行書いた。"]),
]));
const roadConfig = {
  _説明: "W12（#195）：麦の街道・関所の道（docs/world.md 5.2 の 110、text.md 5.7 の 5-01〜5-04）。西の口→063 の祠の裏口、北の高台の上に関所の石壁と門（通行の札。スイッチ 1053）→112、街道の祠の戸→113、北の崖道→115、東の道→111。飢えの列の跡（捨てた荷・配給札の束）、王国の道標、通行の札（骨が握っている）、思念 R5-01、薄い思念 F10（屋根の落ちた荷車小屋）、夕べの会の巡礼。この設定は node tools/maps/src/w12_data.mjs が書く。",
  mapId: MAP.road, name: "麦の街道・関所の道", displayName: "麦の街道", ...lookOf("road"),
  chars: HIGH_CHARS,
  stamps: [stamp("E", "cartSacks"), stamp("C", "cart")],
  scatter: [
    { on: "\"", tiles: ["B:172", "B:172", "B:173"], rate: 0.55, solid: true, seed: 11001 },
    { on: ".:", z: 1, tiles: ["A2:15"], rate: 0.08, seed: 11002 },
    { on: ",", tiles: ["B:152", "B:153", "B:239"], rate: 0.12, seed: 11003 },
    { on: "^", tiles: ["B:152", "B:239", "B:171"], rate: 0.08, seed: 11004 },
  ],
  events: roadEvents,
};

// ===========================================================================
// 111 麦の村（50×40、外、集落）：夕べの会の集落。ソレンヌの詰め所（足場の木の届け先）
// ===========================================================================
const sorenne = npc("ソレンヌ", [17, 14], IMG.sorenne, [
  { list: [
    ifItem(ITEM.timber),
    ...talk("ソレンヌ", [["その木は、修道院の工房のものだな。テオどのに頼まれたか。"]], 1),
    choice(["足場の木を渡す", "まだ渡さない"], 1, 1),
    when(0, "足場の木を渡す", 1),
    loseItem(ITEM.timber, 1, 2), switchOn(SW.timberDelivered, 2), se("Item1", 2),
    ...talk("ソレンヌ", [["かたじけない。頂へは、わたしが担いで上る。", "段の数は、長が数えてある。わたしは担ぐだけだ。"]], 2),
    ...say(["ソレンヌは木を肩に乗せた。重さを量る乗せ方だった。", "木は天幕の裏に立てかけられた。"], "", 2), // W16（場面表 2-21）
    ifActor(ACTOR.nora, 2), ...say(["一束だけ？"], "ノラ", 3), ...say(["ソレンヌは当て布の結び目を、歯で締め直した。"], "", 3) /* 「〜には聞こえなかった」の型を続けない（文5 #272。R2 7 章の癖） */, end(3), ENDIF(2),
    ...errandEnd({ key: "scaffold", result: "done", text: "足場の木はソレンヌの詰め所に届いた" }, 2),
    end(2),
    when(1, "まだ渡さない", 1), end(2),
    ENDCHOICE(1),
    end(1),
    ELSE(),
    ifSwitch(SW.sorenne, true, 1),
    ifSwitch(SW.timberDelivered, true, 2),
    ...talk("ソレンヌ", [["木は天幕の裏に立てかけてある。上るときに、肩に当て布を足す。"]], 3),
    end(3),
    ELSE(2),
    ...talk("ソレンヌ", [["修道院の写本係のテオどのに会え。字のことなら、あの人だ。", "長は修道院にいる。頂のことは、長が言う。"]], 3),
    end(3),
    ENDIF(2),
    end(2),
    ELSE(1),
    ...talk("ソレンヌ", [
      ["わたしはソレンヌ。夕べの会の騎士だ。", "きみは砦の方から来たな。夜のうちに、あちらの空に火が見えた。"],
      ["この村は麦を会に出す。会は鐘の番をする。二百年、そうしてきた。", "関所の向こうへ行くなら、収税吏に気をつけろ。まだ取り立てている。"],
      ["長は修道院だ。頂のことは、長が言う。", "日が落ちる。きみも、数えていけ"],
    ], 2),
    switchOn(SW.sorenne, 2),
    end(2),
    ENDIF(1),
    end(1),
    ENDIF(),
    END,
  ] },
]);
const villageEvents = [
  ...[18, 19, 20].map(y => exit("西の口（麦の街道へ）", [0, y], AT.roadEast(y + 20), LEFT)),
  warp("麦の村", [4, 19]),
  sorenne,
  withZelinaLedger(text("家の帳面", [11, 10], [ // W17（#233）：ゼリナが隊にいれば読み上げる（スイッチ 518）。W16：文は場面表 2-13
    ["軒先の台に、家の帳面が開いたまま置いてある。", "始まりの頁に、太い字で「舟で着いた。十四」。", "その下に名が十四。一つだけ、線で消してある。", "十四の名の下に、別の手で小さく一行。"],
    ["「ゼリナ（舟代）」", "次の頁から先は、会へ出した麦の袋の数ばかりが並ぶ。"],
  ], { image: { tileId: "E:69" } })),
  look("ヴォルフラムの家の戸", [9, 9], ["戸の脇に大鍋が伏せてある。", "鍋の底に、煤で大きく「わし」。", "砦の炊き出しの鍋の底にも、同じ字があった。"]),
  look("東の家の戸", [33, 9], ["戸は閉まっている。中で、粉を挽く石の音がする。"]),
  look("南の家の戸", [8, 26], ["戸の脇に、干した麦の束が吊ってある。束は三十。"]),
  look("麦の倉", [36, 26], ["麦の倉。戸の板に、麦の穂の形の焼き印が押してある。", "印の下に『会へ　秋の分』の札。"]),
  look("井戸", [21, 16], ["井戸の綱は新しい。桶の縁に、指で切った鐘の形の印。"]),
  npc("麦打ちの女", [28, 28], IMG.thresher, [{ list: [
    ...talk("麦打ちの女", [["鐘の火が見えたよ。砦の方。夜の間、ずっと。", "あたしらは麦を打つ。会に出す分が先。うちの分は、そのあと。"]]), END,
  ] }]),
  npc("村の年寄り", [40, 17], IMG.elder, [{ list: [
    ...talk("村の年寄り", [["わしの爺さまの爺さまは、関所で麦を一握り取られた。", "それで、ここに畑を開いた。一握り分の畑だと、爺さまは笑うとった。"],
      ["夜に戸を叩かれても、開けんことだ。叩く手が爺さまの手でもな。"]]), END,
  ] }]),
  npc("村の子", [14, 18], IMG.child, [{ list: [
    ...talk("村の子", [["かねの かず、ぼく 三十まで いえる", "ソレンヌさまの てんとには はいっちゃ だめなんだよ"]]), END,
  ] }]),
  // W16（場面表 2-13）：ノラがいれば、村に入った最初の一回だけ（西の口）
  { name: "ノラの一言（麦の村）", type: "raw", x: 0, y: 0, pages: [
    { conditions: { actorId: ACTOR.nora, actorValid: true }, priorityType: 0, trigger: 3, list: [...say(["麦、立ってる！"], "ノラ"), selfOn(), END] },
    { conditions: { selfSwitchCh: "A", selfSwitchValid: true }, priorityType: 0 },
  ] },
  // W16（場面表 2-13）：ソレンヌと話したあと（スイッチ 1058）、井戸に近づくと一度だけ夕べの数（スイッチ 1063）
  { name: "夕べの数（自動）", type: "raw", x: 1, y: 0, pages: [
    { priorityType: 0 },
    { conditions: { switch1Id: SW.sorenne, switch1Valid: true }, priorityType: 0, trigger: 4,
      list: [ifScript("Math.abs($gamePlayer.x - 21) + Math.abs($gamePlayer.y - 16) <= 3"), selfOn("B", 1), end(1), ENDIF(), END] },
    { conditions: { switch1Id: SW.sorenne, switch1Valid: true, selfSwitchCh: "B", selfSwitchValid: true }, priorityType: 0, trigger: 3, list: [
      ...say(["日が落ちた。村の人が、井戸のまわりに出てきた。", "二十人ほど。誰も灯を持たない。", "ソレンヌが天幕の前で、指を鐘の形に切った。"]),
      ...say(["いち"], "ソレンヌ"),
      ...say(["村の人が、声を揃えた。に。さん。", "鐘は、どこにも無い。", "鳴らない空に向かって、二十人が数えた。"]),
      ifActor(ACTOR.bruno), ...say(["ブルーノが、同じ指を切った。声は出さなかった。"], "", 1), end(1), ENDIF(),
      ...say(["子どもが一人、十一で間違えて、一から数え直した。"]),
      ifActor(ACTOR.bruno), ...say(["ブルーノも、子どもの横で一から数え直した。", "二人は、同じ所で三十に着いた。"], "", 1), end(1), ENDIF(),
      ...say(["三十で、二十人が手を下ろした。", "村の戸が、一つずつ閉まっていった。"]),
      switchOn(SW.evening), END,
    ] },
    { conditions: { switch1Id: SW.evening, switch1Valid: true }, priorityType: 0 },
  ] },
];
const villageConfig = {
  _説明: "W12（#195）：麦の村（docs/world.md 5.2 の 111、text.md 5.7 の 5-05・5-06）。夕べの会の集落。西の口→110、結界、ソレンヌの詰め所（夕べの会の天幕。頼みごと「足場の木」の届け先。スイッチ 1055）、ヴォルフラムの家の帳面、麦の倉（麦の穂の焼き印。嘆願書の判と並ぶ）、村の衆。この設定は node tools/maps/src/w12_data.mjs が書く。",
  mapId: MAP.village, name: "麦の村", displayName: "麦の村", ...lookOf("village"),
  stamps: [stamp("A", "tent"), stamp("B", "tentRed")],
  scatter: [
    { on: "\"", tiles: ["B:172", "B:172", "B:173"], rate: 0.55, solid: true, seed: 11101 },
    { on: ".", z: 1, tiles: ["A2:15"], rate: 0.05, seed: 11102 },
    { on: ",", tiles: ["B:152", "B:153"], rate: 0.05, seed: 11103 },
  ],
  events: villageEvents,
};

// ===========================================================================
// 112 関所の塔（50×40、中）：ボス 関所の収税吏。裏の崖道 → 120
// ===========================================================================
const taxman = {
  name: "関所の収税吏", type: "raw", x: 24, y: 5,
  pages: [
    { image: IMG.taxman, priorityType: 1,
      list: [
        ...say(["裏の口の前に、帳面を抱えた役人の影が立っている。", "片手を、こちらへ差し出したまま動かない。"]),
        ...say(["通る者。一握り。一握りは王のもの。"], "関所の収税吏"),
        ...bossBattle(TROOP.taxman, [MAP.tower, 24, 9, DOWN]),
        ifScript("Hai.Boss.lastResult() === 0"),
        ...say(["……通せ。"], "関所の収税吏", 1),
        ...say(["収税吏は、帳面を抱いたまま崩れた。", "裏の口から、崖の風が入ってくる。"], "", 1),
        se("Item1", 1), gainItem(P_ITEM.elixir, 1, 1),
        ...say(["腰の袋に、秘薬が一つ残っていた。", "\\I[179]秘薬を手に入れた。"], "", 1), // 文5（#272）：拾い物の表記（R2 気になる 26）
        ...say(["帳面は、最後の頁が開いていた。", "納めの欄だけ、数がある。通しの欄は、空いている。"], "", 1), // W16（場面表 2-15）
        end(1),
        ENDIF(),
        END,
      ] },
    { conditions: { switch1Id: SW.taxman, switch1Valid: true }, priorityType: 0 },
  ],
};
const towerEvents = [
  ...[24, 25].map(x => exit("南の口（関所の道へ）", [x, 39], AT.roadGate, DOWN)),
  exit("裏の崖道（修道院へ）", [24, 2], AT.cloisterSouth, UP),
  taxman,
  text("収税吏の帳面", [42, 20], [
    "机の上に、帳面が開いている。日ごとに、数が二つ。", "刈り入れの月、一日。納め、百十二握り。通し、百十二。",
    "同じ月、四日。納め、二百三握り。通し、百五十。", "間の日も、納めと通しの差が、日ごとに開いている。",
  ], { image: { tileId: "E:69" } }),
  look("通行の札の束", [6, 21], ["棚に、通行の札が束ねて積んである。", "束の札には、裏の刻みが一つも無い。"], "D:185"),
  { name: "石段", type: "raw", x: 24, y: 26, pages: [{ priorityType: 1, list: [
    ...say(["石段に、石工の印が刻んである。段は十二。", "十三段目の石が抜けて、そこだけ土が見える。"]),
    ifActor(ACTOR.bruno), ...say(["ブルーノが十三段目を跳び越えようとして、", "やめて、またいだ。"], "", 1), end(1), ENDIF(), // W16（場面表 2-15）
    END,
  ] }] },
  look("金の延べ棒", [44, 19], ["収税の箱の上に、麦の印を打った金の延べ棒が積んである。数えると、二十。"]),
  thought("R5-02", "関所を越えた巡礼", [30, 8], [
    "関所を裏から越えて、修道院へ上った。札は持っていなかった。",
    "崖の小道の梁に、小鐘を一つ掛けてきた。預かった鐘だ。上りには重すぎた。",
    "返す先は、鐘の札に書いておいた。",
  ]),
  chestItem("気付け薬", [11, 17], P_ITEM.smelling, 2, 176),
  chestGold([46, 29], 160),
  chestItem("毒消し", [36, 10], P_ITEM.antidote, 2, 177),
  chestGold([5, 11], 220),
  foe(TROOP.gateDead, "yellow", [20, 32]),
  foe(TROOP.gateDead, "yellow", [42, 26]),
  foe(TROOP.line, "green", [7, 27]),
  foe(TROOP.line, "green", [32, 11]),
];
const towerConfig = {
  _説明: "W12（#195）：関所の塔（docs/world.md 5.2 の 112・5.5、text.md 5.7 の 5-07〜5-09）。南の口→110 の関所の門、西の間（通行の札の束）とその奥の見えない通路の小部屋、東の間（収税吏の帳面・金の延べ棒）、真ん中の石段（石工の印）、北の間にボス 関所の収税吏（スイッチ 1051。弱み：通行の札で「通せ」、配給札で勘定が狂う）、思念 R5-02、裏の崖道→120。この設定は node tools/maps/src/w12_data.mjs が書く。",
  mapId: MAP.tower, name: "関所の塔", displayName: "関所の塔", ...lookOf("tower"),
  chars: {
    "#": { name: "関所の塔の壁（壁O（砦）。下が床なら側面、ほかは上面）", wall: { top: "A4:22", side: "A4:30", height: 2 } },
    ".": { name: "石畳（石畳A）", tiles: ["A5:20"] },
    ",": { name: "石段の踏み面（床A（土洞窟））", tiles: ["A2:0"] },
  },
  deco: {
    N: { name: "樽", z2: "D:212" },
    h: { name: "端材", z2: "D:220" },
    n: { name: "壊れた樽", z2: "B:239" },
    b: { name: "椅子A", z2: "D:120" },
    t: { name: "テーブルA", z2: "D:112" },
    Z: { name: "簡易棚B（本。札の束）", z2: "D:185" },
    s: { name: "麻袋A", z2: "D:248" },
    S: { name: "麻袋C", z2: "D:250" },
    u: { name: "金の延べ棒A（一握りは王のもの）", z2: "E:200" },
    U: { name: "金の延べ棒B", z2: "E:201" },
  },
  stamps: [
    { at: "柱", name: "石の柱（1×2。上は☆）", tiles: [["B:98"], ["B:106"]] },
    { at: "!", name: "槍立て（1×2）", tiles: [["E:175"], ["E:183"]] },
  ],
  scatter: [
    { on: ".", z: 1, tiles: ["A2:15"], rate: 0.05, seed: 11201 },
    { on: ".,", tiles: ["B:32", "B:33"], rate: 0.08, seed: 11202 },
  ],
  events: towerEvents,
};

// ===========================================================================
// 113 街道の祠（27×17）：鐘を抱く像（鐘の口は開いている）、結界
// ===========================================================================
const shrineEvents = [
  ...[12, 13, 14].map(x => exit("南の戸口（麦の街道へ）", [x, 16], AT.roadShrine, DOWN)),
  look("鐘を抱く女の像", [13, 4], ["鐘を抱く女の像。抱かれた鐘の口は、塞がれずに開いている。", "台座に『夕べを数えよ』。その下の行は、鑿の跡だけで字が無い。"]),
  warp("街道の祠", [8, 12]),
  look("石碑", [11, 3], ["石碑の面は、雨で削れて読めない。", "根元に、麦の粒が三つ供えてある。乾いている。"]),
  chestItem("霊水", [17, 12], P_ITEM.holyWater, 1, 176),
];
const shrineConfig = {
  _説明: "W12（#195）：街道の祠（docs/world.md 5.2 の 113・5.8 の 3、text.md 5.7 の 5-10）。南の戸口→110、鐘を抱く女の像（鐘の口は開いている）、結界。この設定は node tools/maps/src/w12_data.mjs が書く。",
  mapId: MAP.shrine, name: "街道の祠", displayName: "街道の祠", ...lookOf("shrine"),
  chars: { ",": { name: "像の前の段（石畳。床の汚れ）", as: ".", tiles: [null, "A2:15"] } },
  deco: {
    3: { name: "石碑A（通れない）", z2: "B:64" },
    R: { name: "苔の瓦礫（通れない）", z2: "B:121" },
    r: { name: "瓦礫A（通れない）", z2: "B:120" },
    x: { name: "骸骨A（通れない）", z2: "B:242" },
    P: { name: "壺B（通れない）", z2: "B:231" },
    w: { name: "蜘蛛の巣", z2: "B:176" },
    k: { name: "砂利A（通れる）", z2: "B:32" },
    K: { name: "砂利B（通れる）", z2: "B:33" },
  },
  stamps: [
    { at: "像", name: "鐘を抱く女の像（女神像。1×2）", tiles: [["B:82"], ["B:90"]] },
    { at: "柱", name: "石の柱（1×2。上は☆）", tiles: [["B:98"], ["B:106"]] },
  ],
  events: shrineEvents,
};

// ===========================================================================
// 115 崖の小道（40×30、外、段が 3）：寄り道。崖の小道の小鐘、赤い宝箱「巡礼の杖」
// ===========================================================================
const cliffEvents = [
  ...[4, 5, 6].map(x => exit("南の口（麦の街道へ）", [x, 29], AT.roadNorth(x), DOWN)),
  ...[22, 23, 24].map(x => exit("北の口（崖の上の見晴らしへ）", [x, 0], AT.viewSouth(x - 10), UP)),
  keyPickup("崖の小道の小鐘", [35, 4], ["崖に打った梁に、鉤が一つ。手のひらほどの鐘が吊ってある。", "鐘に札。『返す先』。その先は、雨で滲んで読めない。"],
    [gainArmor(ARMOR.cliffBell), ...say(["\\I[205]崖の小道の小鐘を手に入れた。"])], { tileId: "C:121" },
    [ifActor(ACTOR.bruno), ...say(["見張り塔の鐘と、同じ形です。中の数は、四つ少ない"], "ブルーノ", 1), end(1), ENDIF()]), // W16（場面表 2-16）
  chestEvent("巡礼の杖", [16, 7], [gainWeapon(WEAPON.pilgrimStaff)], "\\I[101]巡礼の杖を手に入れた。", true),
  thought("R5-03", "崖を下りた巡礼", [5, 7], [
    "縄は四十尋。森の西の崖まで、一尋だけ足りない。",
    "足りない一尋は、跳んだ。",
  ]),
  look("墓標", [6, 5], ["小さな墓標。名の代わりに、鐘の形が刻んである。"]),
  chestGold([34, 17], 120),
  chestItem("薬草", [3, 25], P_ITEM.herb, 2, 176),
  foe(TROOP.crows, "green", [12, 23]),
  foe(W10_TROOP.goats, "green", [24, 16]),
  foe(TROOP.crows, "green", [28, 6]),
];
const cliffConfig = {
  _説明: "W12（#195）：崖の小道（docs/world.md 5.2 の 115、text.md 5.7 の 5-11）。寄り道。南の口→110 の北の崖道、下の岩棚・1 段目（^。坂）・2 段目（A。梯子）、崖の梁の小鐘（崖の小道の小鐘）、赤い宝箱（巡礼の杖）、思念 R5-03、北の口→116。この設定は node tools/maps/src/w12_data.mjs が書く。",
  mapId: MAP.cliff, name: "崖の小道", displayName: "崖の小道", ...lookOf("cliff"),
  chars: {
    ...HIGH_CHARS,
    A: { name: "高台の 2 段目（段差B（土）の上面。下の 1 行に崖の側面が自動で付く）", ledge: { top: "A4:37", side: "A4:45", height: 1, level: 2 } },
    Q: { name: "2 段目の上の土の道（段差の上面に道（草地）を重ねる）", as: "A", tiles: [null, "A2:2"] },
    L: { name: "2 段目の側面の梯子（下は 1 段目の上面）", as: "^", tiles: [null, null, "B:18"] },
    3: { name: "2 段目の上の着き場（道（草地）。上にも道を重ねて、まわりの Q とつなぐ）", tiles: ["A2:2", "A2:2"] },
  },
  scatter: [{ on: ",^A", tiles: ["B:152", "B:239", "B:171"], rate: 0.12, seed: 11501 }],
  events: cliffEvents,
};

// ===========================================================================
// 116 崖の上の見晴らし（27×17）：東の眺め、霧の森（020）の西の崖へ下りる縄（片側）
// ===========================================================================
// 灯の数は鳴らした鐘の数＋1（0 で一つ … 4 以上で五つ。W16 で直した。場面表 2-16）
const VIEW_HEAD = ["崖の縁から、東がよく見える。", "いちばん高い頂に、塔の影が一本。"];
const viewEast = {
  name: "東の眺め", type: "raw", x: 24, y: 8,
  pages: [{ priorityType: 1, list: [
    ...[0, 1, 2, 3].flatMap(n => [ifVar(VAR.bells, n), ...say([...VIEW_HEAD, `塔の影に、灯が${NUM[n]}つ。`], "", 1), end(1), ENDIF()]),
    ifVar(VAR.bells, 4, 1),
    ...say([...VIEW_HEAD, "塔の影に、灯が五つ。"], "", 1),
    end(1), ENDIF(),
    ifSwitch(SW_SCENE3),
    ...say(["塔の手前の尾根の一か所だけ、", "灰が溜まって渦を巻いている。"], "", 1),
    end(1), ENDIF(),
    END,
  ] }],
};
// シャノ（W16。場面表 2-16）：鐘を一つ以上鳴らして、シャノが砦にいると、崖の縁に一度だけ（スイッチ 1062）
const shanoTalk = n => [
  ...talk("シャノ", [["あんた、ここまで来たの？", "鉤、鉄じゃん。これ、外して持って帰る。", "高い所なら、おれ、だいじょぶ"]]),
  ...talk("シャノ", [[`あんた、鐘、${NUM[n - 1]}つ鳴らしたんだろ。`, n === 1 ? "灯、二つあるじゃん。一個多くない？" : `灯、${NUM[n]}つあるじゃん。鐘より一個多くない？`]]),
];
const shanoCliff = {
  name: "シャノ（崖の上）", type: "raw", x: 4, y: 8,
  pages: [
    { priorityType: 0 },
    { conditions: { switch1Id: SW_SHANO_FORT, switch1Valid: true, variableId: VAR.bells, variableValid: true, variableValue: 1 },
      image: { characterName: "People1", characterIndex: 2, direction: RIGHT, pattern: 1 }, priorityType: 1, list: [
        ...[1, 2, 3].flatMap(n => [ifVar(VAR.bells, n), ...shanoTalk(n).map(c => ({ ...c, indent: c.indent + 1 })), end(1), ENDIF()]),
        ifVar(VAR.bells, 4, 1), ...shanoTalk(4).map(c => ({ ...c, indent: c.indent + 1 })), end(1), ENDIF(),
        ...say(["誰も答えなかった。"]),
        ...talk("シャノ", [["下は霧の森。おれ、縄では下りない。歩いて帰る"]]),
        switchOn(SW.shano), cmd(214, []),
        END,
      ] },
    { conditions: { switch1Id: SW.shano, switch1Valid: true }, priorityType: 0 },
  ],
};
const viewRope = {
  name: "西の崖の縄（霧の森へ下りる）", type: "raw", x: 2, y: 8,
  pages: [{ priorityType: 1, list: [
    ...say(["崖の縁の岩に、鉤が打ちこんである。縄が一本、霧の中へ垂れている。", "下は霧の森の西の高台らしい。上り直す足場は見えない。"]),
    choice(["縄を伝って下りる", "やめる"], 1),
    when(0, "縄を伝って下りる"),
    se("Move1", 1),
    ...say(["縄を伝って下りた。縄の端で、足が宙に浮いた。", "手を離した。"], "", 1),
    transfer(FOREST.mapId, ...FOREST.arrive, DOWN, 1),
    end(1),
    when(1, "やめる"), end(1),
    ENDCHOICE(),
    END,
  ] }],
};
const viewEvents = [
  ...[12, 13, 14].map(x => exit("南の口（崖の小道へ）", [x, 16], AT.cliffNorth(x + 10), DOWN)),
  viewEast,
  viewRope,
  pickItem("薬草", [20, 12], P_ITEM.herb, 1, 176),
  shanoCliff,
];
const viewConfig = {
  _説明: "W12（#195）：崖の上の見晴らし（docs/world.md 5.2 の 116、text.md 5.7 の 5-12）。南の口→115、東の眺め（塔の影の灯は鳴らした鐘の数＋1。3 つ目の場面のあとは縄張りの灰）、西の崖の縄→020 霧の森・入口の西の高台（片側。D14 の「遠い所が実は隣」）。この設定は node tools/maps/src/w12_data.mjs が書く。",
  mapId: MAP.view, name: "崖の上の見晴らし", displayName: "崖の上の見晴らし", ...lookOf("cliff"),
  scatter: [{ on: ",", tiles: ["B:152", "B:239", "B:171"], rate: 0.12, seed: 11601 }],
  events: viewEvents,
};

// ===========================================================================
// 120 鐘守の修道院・前庭と回廊（60×45）：嘆願書の束、当番表、空の鐘架。裏門（院長のあと）→124
// ===========================================================================
const backGate = {
  name: "裏門（裏の坂へ）", type: "raw", x: 57, y: 14,
  pages: [
    { image: IMG.doorShut, priorityType: 1, walkAnime: false,
      list: [...say(["修道院の裏門。閂に錠が掛かっている。", "錠は新しい。鍵穴の縁だけ、指の脂で黒く光っている。"]), END] },
    { conditions: { switch1Id: SW.backGate, switch1Valid: true }, image: IMG.doorOpen, priorityType: 0, walkAnime: false },
  ],
};
const cloisterEvents = [
  ...[8, 9, 10].map(x => exit("南の口（関所の塔の裏の崖道へ）", [x, 44], AT.towerNorth, DOWN)),
  ...[14, 15].map(x => exit("北西の戸（写本室と食堂へ）", [x, 1], AT.scriptoriumSouth(x + 5), UP)),
  ...[43, 44].map(x => exit("北東の戸（鐘守の塔へ）", [x, 1], AT.belfrySouth(x - 24), UP)),
  exit("裏門の外（裏の坂へ）", [59, 14], AT.slopeWest(4), RIGHT),
  { name: "下り階段（納骨堂へ）", type: "raw", x: 54, y: 40,
    pages: [{ priorityType: 0, trigger: 1, list: [se("Move1"), transfer(...AT.cryptTop, DOWN), END] }] },
  backGate,
  warp("鐘守の修道院", [5, 31]),
  keyPickup("嘆願書の束", [13, 35], ["石碑の根元に、紐でくくった紙の束。雨よけの革に包んである。"],
    [gainItem(ITEM.petitions), ...say(["\\I[121]嘆願書の束を手に入れた。"])]),
  { name: "嘆願の判の石", type: "raw", x: 12, y: 34, pages: [{ priorityType: 1, list: [
    ...say(["石碑に、四十七の判の跡が並べて刻んである。", "上に一行。『西の村々より』。"]),
    // W16（場面表 2-17）：ノラがいて、嘆願書の束を持っていれば
    ifActor(ACTOR.nora), ifItem(ITEM.petitions, 1),
    ...say(["四十七！"], "ノラ", 2), ...say(["ノラが束の判と石碑の判を、一つずつ合わせた。合った。"], "", 2),
    end(2), ENDIF(1), end(1), ENDIF(),
    END,
  ] }] },
  text("鐘守の当番表", [47, 9], [
    "鐘守の当番の表。四つの鐘と頂に、名が割り振ってある。",
    "営倉、一。記録院、一。水底、一。鋳物場、一。頂、二。",
    "どの欄も、同じ日付で止まっている。",
  ], { image: { tileId: "B:91" } }),
  { name: "空の鐘架", type: "raw", x: 44, y: 10, pages: [{ priorityType: 1, list: [
    ...say(["鐘架の梁はきれいなままだ。鉤を打った跡が一つも無い。"]),
    // W16（場面表 2-17・3-29）
    ifActor(ACTOR.bruno), ...say(["鐘守の修道院、ですよね。ここ"], "ブルーノ", 1), end(1), ENDIF(),
    ifSelf("A", false), ...say(["鐘架だけだ。鐘は、四つにしか無い"], ME, 1), selfOn("A", 1), end(1), ENDIF(),
    ifSwitch(SW.compared), ifActor(ACTOR.dil, 1), ifSwitch(SW_W16_FORT.dilThird, false, 2),
    ...say(["ディルが鐘架の下で、梁を見ていた。"], "", 3),
    ...say(["三通りか", "俺が写したのは、二つだ"], "ディル", 3),
    switchOn(SW_W16_FORT.dilThird, 3),
    end(3), ENDIF(2), end(2), ENDIF(1), end(1), ENDIF(),
    END,
  ] }] },
  { name: "礼拝堂の祭壇", type: "raw", x: 40, y: 32, pages: [{ priorityType: 1, list: [
    ...say(["祭壇の布に、指で数える形が縫い取ってある。", "指は三十本。最後の一本だけ、糸の色が違う。"]),
    ifActor(ACTOR.bruno), ...say(["……三十", "縫い間違い、でしょうか"], "ブルーノ", 1), end(1), ENDIF(), // W16（場面表 2-17）
    END,
  ] }] },
  chestItem("薬草", [5, 5], P_ITEM.herb, 2, 176),
  chestItem("秘薬", [27, 39], P_ITEM.elixir, 1, 179),
  chestGold([54, 24], 140),
  chestGold([20, 41], 80),
  foe(TROOP.keeperDead, "yellow", [15, 24]),
  foe(TROOP.keeperDead, "yellow", [40, 5]),
  foe(TROOP.prayerShades, "green", [20, 11]),
  foe(TROOP.prayerShades, "green", [50, 22]),
  foe(TROOP.coffinWarden, "red", [30, 40], "fixed", 2),
];
const MONASTERY_DECO = {
  v: { name: "長椅子の代わりの石の椅子（通れない）", z2: "B:121" },
  t: { name: "テーブルA（通れない）", z2: "B:112" },
  T: { name: "テーブルB（食卓。通れない）", z2: "B:114" },
  h: { name: "椅子A", z2: "B:120" },
  w: { name: "端材（足場の木。通れない）", z2: "D:125" },
  R: { name: "苔の瓦礫（通れない）", z2: "D:121" },
};
const cloisterConfig = {
  _説明: "W12（#195）：鐘守の修道院・前庭と回廊（docs/world.md 5.2 の 120、text.md 5.7 の 5-13・5-14）。南の口→112 の裏の崖道、前庭（結界・嘆願の判の石と嘆願書の束）、回廊の輪が 2 つ（西は水盤、東は空の鐘架と当番表）、北西の戸→121、北東の戸→122、礼拝堂の下り階段→123、東の裏門（院長のあと。スイッチ 1054）→124。この設定は node tools/maps/src/w12_data.mjs が書く。",
  mapId: MAP.cloister, name: "鐘守の修道院・前庭と回廊", displayName: "鐘守の修道院", ...lookOf("cloister"),
  deco: MONASTERY_DECO,
  stamps: [stamp("A", "churchTable"), stamp("B", "goddess"), stamp("C", "bellFrame")],
  scatter: [
    { on: ".:", z: 1, tiles: ["A2:15"], rate: 0.06, seed: 12001 },
    { on: ".:", tiles: ["D:32", "D:33"], rate: 0.07, seed: 12002 },
  ],
  events: cloisterEvents,
};

// ===========================================================================
// 121 写本室と食堂（40×30）：写本係テオ（足場の木を頼む・読み比べ）、会議の議事録、祈祷書の古い版
// ===========================================================================
const teoCompare = indent => [
  ...talk("テオ", [["その二冊、記録院の写しですか？　並べてみても、いいですか？"]], indent),
  choice(["並べてもらう", "やめておく"], 1, indent),
  when(0, "並べてもらう", indent),
  ...talk("テオ", [
    ["灰色のと、茶色の。終わりの近くの一行が、灰色のにだけ有りますね。", "教会の古い版にも、その一行は有るんです。ここです。"],
    ["それで、その次の行の上に、貼り紙。透かすと、下にもう一行あります。", "灰色のにも茶色のにも、無い行です。三通り目、ですね？"],
    ["院の帳面には、記録院が渡したのは偽の写しだって書いてあります。", "ぼくは、教会のが正しいと思うんです。……思うんですけど。"],
    ["貼り紙は剥がしません。剥がしたら、どれが写しなのか分からなくなるので。"],
  ], indent + 1),
  // W16（場面表 3-29）
  ...say(["テオは羽根の筆を一本取って、小さな紙に何かを写した。", "写し終えると、紙を折って、どこかにしまった。"], "", indent + 1),
  ...talk("テオ", [["写しておきました。", "どこに置いたかは、写しておきませんでした"]], indent + 1),
  switchOn(SW.compared, indent + 1),
  ...errand({ key: "copies", stage: "0", text: "テオの読み比べ：教会の古い版には、貼り紙の下にもう一行あった" }, indent + 1),
  end(indent + 1),
  when(1, "やめておく", indent), end(indent + 1),
  ENDCHOICE(indent),
];
const teo = npc("写本係テオ", [9, 18], IMG.teo, [
  { list: [
    ...talk("テオ", [
      ["あ、……砦の方から？　ぼく、テオです。ここで写しをしています。", "修道院の書きものは、だいたいぼくが写しました。議事録も、祈祷書も。"],
      ["読み比べは、好きです。違う所を見つけると、そこだけ字が光って見えて。", "議事録の写しに、一か所だけ、ぼくの写し間違いがあります。場所は、内緒です。"],
      ["一つ、頼んでもいいですか？　地下の石工の工房に、足場の木が積んであるんです。", "頂の足場を直す木です。麦の村の、ソレンヌさんの詰め所まで運んでほしくて。"],
      ["ソレンヌさんが、頂まで担いで上るそうです。", "ぼくは、字より重い物を持つと、次の日に字が震えるので。"],
    ]),
    switchOn(SW.teo),
    ...errand({ key: "scaffold", stage: "1", text: "修道院の地下の石工の工房の木を、麦の村のソレンヌの詰め所へ運ぶ" }),
    selfOn(), END,
  ] },
  { conditions: { selfSwitchCh: "A", selfSwitchValid: true },
    list: [
      ifSwitch(SW.timberBurned),
      ...talk("テオ", [["工房の木が、燃えたそうですね。", "写しは、しばらく閉じておきます。写しておきます、とは言えないので。"]], 1),
      end(1),
      ELSE(),
      ifItem(W8_ITEM.twoCopies, 1),
      ifSwitch(SW.compared, false, 2),
      ...teoCompare(3),
      end(3),
      ELSE(2),
      ...talk("テオ", [["三通り目の行は、写しておきました。どこに置いたかは、写しておきませんでした。"]], 3),
      end(3),
      ENDIF(2),
      end(2),
      ELSE(1),
      ifSwitch(SW.timberDelivered, true, 2),
      ...talk("テオ", [["木、届いたんですね。ソレンヌさん、何か言ってました？", "いえ、いいです。写しておきます、とだけ。"]], 3),
      end(3),
      ELSE(2),
      ...talk("テオ", [["足場の木は、工房の奥です。札が付いているので、すぐ分かります。", "記録院の写しを手に入れたら、見せてください。読み比べは、好きです。"]], 3),
      end(3),
      ENDIF(2),
      end(2),
      ENDIF(1),
      end(1),
      ENDIF(),
      END,
    ] },
]);
const scriptoriumEvents = [
  ...[19, 20].map(x => exit("南の口（回廊へ）", [x, 29], AT.cloisterNW(x - 5), DOWN)),
  teo,
  keyPickup("会議の議事録", [16, 8], ["書見台に、綴じた紙の束。表紙に『会議の記録　収めの月　十九日』。"],
    [gainItem(ITEM.minutes), ...say(["\\I[121]会議の議事録を手に入れた。"])], { tileId: "C:68" }),
  keyPickup("祈祷書の古い版", [5, 8], ["棚の奥に、古い祈祷書が一冊。表紙の色が抜けている。", "中ほどに「鐘を黙らせし夜」の一行。", "その一行の上に、紙を貼って剥がした跡。"],
    [gainItem(ITEM.oldPrayer), ...say(["\\I[122]祈祷書の古い版を手に入れた。"])]),
  thought("R5-04", "修道院の炊事番", [33, 22], [
    "会議の年の冬は、客が多かった。椀を十二、足した。",
    "足した椀のうち、一つだけ縁に金の線が入っていた。",
  ]),
  look("写字台", [6, 13], ["写字台の上に、削った羽根の筆が七本。どれも先が同じ長さに揃えてある。"]),
  chestItem("霊水", [36, 23], P_ITEM.holyWater, 1, 176),
  look("棚", [35, 22], ["棚に、椀は無い。", "椀の形の、埃の無い輪だけが、十二ある。"]), // W16（場面表 2-18）
];
const scriptoriumConfig = {
  _説明: "W12（#195）：写本室と食堂（docs/world.md 5.2 の 121・7.2・7.3、text.md 5.7 の 5-15〜5-17）。南の口→120、写本係テオ（頼みごと「足場の木」を頼む。スイッチ 1059・変数 176。二通りの写しを持って話すと読み比べ。スイッチ 1057。木を燃やすと写しを閉じる）、会議の議事録、祈祷書の古い版、食堂の思念 R5-04。この設定は node tools/maps/src/w12_data.mjs が書く。",
  mapId: MAP.scriptorium, name: "写本室と食堂", displayName: "写本室と食堂", ...lookOf("scriptorium"),
  deco: MONASTERY_DECO,
  stamps: [stamp("E", "bookshelves"), { at: "F", name: "暖炉A（石。1×2）", tiles: [["B:186"], ["B:194"]] }],
  events: scriptoriumEvents,
};

// ===========================================================================
// 122 鐘守の塔（40×30、縦）：ボス 院長。塔の鐘は無い（鐘架だけ）。「東へ、東へ」の刻み
// ===========================================================================
const abbot = {
  name: "院長", type: "raw", x: 19, y: 7,
  pages: [
    { image: IMG.abbot, priorityType: 1,
      list: [
        ...say(["空の鐘架に向かって、長衣の影が立っている。", "低い声で、同じ祈りをくり返している。"]),
        ...say(["東へ、東へ。鐘の届く所を、東へ。", "西の者。祈りの途中だ。数を乱すな。"], "院長"),
        ...bossBattle(TROOP.abbot, [MAP.belfry, 6, 17, DOWN]),
        ifScript("Hai.Boss.lastResult() === 0"),
        ...say(["西の、……飢えは。"], "院長", 1),
        ...say(["院長は鐘架の前に膝をついて崩れた。", "長衣の中から、鍵が一本落ちた。柄に、修道院の印。"], "", 1),
        ...say(["鐘架の釘は四本。鐘は無い。", "院長の膝の前の床だけ、二百年ぶん、磨れている。"], "", 1), // W16（場面表 2-20）
        se("Key", 1), switchOn(SW.backGate, 1),
        ...addNote("w12:backgate", "院長の鍵で、修道院の裏門が開く（鐘守の修道院・回廊の東）", 1),
        end(1),
        ENDIF(),
        END,
      ] },
    { conditions: { switch1Id: SW.abbot, switch1Valid: true }, priorityType: 0 },
  ],
};
const belfryEvents = [
  ...[19, 20].map(x => exit("南の口（回廊へ）", [x, 29], AT.cloisterNE(x + 24), DOWN)),
  abbot,
  warp("鐘守の塔", [6, 16]),
  look("壁の刻み", [16, 14], ["壁に、同じ二文字が刻みつけてある。『東へ』。", "刻みは、上へ行くほど新しく、深い。"]),
  look("鐘架", [19, 5], ["鐘架の梁に、鐘を吊る釘が四本。鐘は無い。"]),
  chestItem("気付け薬", [34, 24], P_ITEM.smelling, 2, 176),
  chestGold([5, 6], 180),
  foe(TROOP.keeperDead, "yellow", [12, 24]),
  foe(TROOP.keeperDead, "yellow", [25, 17], { dir: "right", n: 5 }),
  foe(TROOP.prayerShades, "green", [30, 25]),
];
const belfryConfig = {
  _説明: "W12（#195）：鐘守の塔（docs/world.md 5.2 の 122・5.5、text.md 5.7 の 5-18）。南の口→120、一階 → 東の石段 → 二階（結界・「東へ」の刻み）→ 西の石段 → 鐘の床。空の鐘架の前にボス 院長（スイッチ 1052。弱み：嘆願書の束で「西の飢えは」と崩れる・沈黙がよく効く）。倒すと裏門の鍵（スイッチ 1054）。この設定は node tools/maps/src/w12_data.mjs が書く。",
  mapId: MAP.belfry, name: "鐘守の塔", displayName: "鐘守の塔", ...lookOf("belfry"),
  deco: MONASTERY_DECO,
  stamps: [stamp("C", "bellFrame")],
  scatter: [
    { on: ".", z: 1, tiles: ["A2:15"], rate: 0.05, seed: 12201 },
    { on: ".", tiles: ["D:32", "D:33"], rate: 0.07, seed: 12202 },
  ],
  events: belfryEvents,
};

// ===========================================================================
// 123 地下の納骨堂と石工の工房（50×40、暗がり）：反対した修道士、王家の使いの部屋、石工の工房、足場の木
// ===========================================================================
const timber = {
  name: "足場の木", type: "raw", x: 29, y: 17,
  pages: [
    { priorityType: 1,
      list: [
        ...say(["積んだ木に札。『頂へ。三晩分』。", "札の『三』は、別の手で『一』の上から書いてある。"]),
        ifVar(VAR.scaffold, 1),
        choice(["一束、背負って運ぶ", "置いておく", "燃やす"], 1, 1),
        when(0, "一束、背負って運ぶ", 1),
        se("Item3", 2), gainItem(ITEM.timber, 1, 2),
        ...say(["木を一束、背に負った。思ったより軽い。", "\\I[195]足場の木を手に入れた。"], "", 2),
        ...errand({ key: "scaffold", stage: "2", text: "足場の木を一束背負った。麦の村のソレンヌの詰め所へ" }, 2),
        ifActor(ACTOR.bruno, 2), ...say(["僕が代わります。……いえ、はい。あなたが"], "ブルーノ", 3), end(3), ENDIF(2), // W16（場面表 2-19）
        ...say(["木の端に、石段と同じ石工の印の焼き印があった。"], "", 2),
        selfOn("A", 2),
        end(2),
        when(1, "置いておく", 1), end(2),
        when(2, "燃やす", 1),
        ...say(["石工の炉の燠を移した。木は湿っていて、燃えるまでに時間がかかった。"], "", 2),
        se("Fire1", 2), switchOn(SW.timberBurned, 2),
        ...errandEnd({ key: "scaffold", result: "failed", text: "工房の足場の木は燃えた" }, 2),
        selfOn("B", 2),
        end(2),
        ENDCHOICE(1),
        end(1),
        ENDIF(),
        END,
      ] },
    { conditions: { selfSwitchCh: "A", selfSwitchValid: true }, priorityType: 1,
      list: [...say(["木の山の一角が、一束ぶん空いている。"]), END] },
    { conditions: { selfSwitchCh: "B", selfSwitchValid: true }, priorityType: 1,
      list: [...say(["木の山は黒く焦げている。札は燃えた。束ねた縄が、黒く縮れて落ちている。"]), END] },
  ],
};
const cryptEvents = [
  { name: "上り階段（礼拝堂へ）", type: "raw", x: 24, y: 4,
    pages: [{ priorityType: 0, trigger: 1, list: [se("Move1"), transfer(...AT.cloisterStairs, UP), END] }] },
  thought("R5-05", "反対した修道士", [9, 28], [
    "会議で、反対の手を挙げたのは私だけだった。",
    "金が先に来た。飢えの嘆願は、そのあとで束ねて読まれた。",
    "翌朝から、納骨堂の当番になった。棺の数を数えるのが勤めだ。",
    "議事録の反対の欄の名に線を引いたのは、私だ。墨は院長の机のを借りた。",
  ], [ifItem(ITEM.minutes), ...say(["議事録の、線で消した名。線は、まっすぐだった。"], "", 1), end(1), ENDIF()]), // W16（場面表 2-19）
  look("金の箱の跡", [40, 7], ["床の埃の中に、箱の大きさの四角い跡。四隅に、鉄の脚の凹み。", "跡の脇に、王家の印の封蝋の欠片。蝋に『収めの月　七日』。"]),
  look("王家の使いの机", [44, 6], ["机の引き出しは空だ。底の木目に、金の粉が詰まっている。"]),
  text("足場の設計図", [39, 23], [
    ["台の上に、足場の設計図が広げてある。頂の鐘楼に、段と梁が描きこんである。", "木の数の欄だけ、何度も書き直してある。最後の数の横に『三晩分』。"],
    ["上る段の図は細かい。下りる段の図は、どこにも無い。"],
  ]),
  thought("R5-06", "石工の頭", [34, 20], [
    "一晩のみ、と言われた。図を引くのは俺の仕事だから、図には三晩分と書いた。",
    "木は三晩分、運ぶ。言われた数より多く運んで、怒られた石工はいない。",
    "誰にも言わなかった。言えば、一晩の図を引き直せと言われる。",
    "頂へは二十二人で上る。木を担ぐ順は、もう決めてある。",
  ]),
  timber,
  look("壁の刻み", [5, 35], ["壁に、指で刻んだ線。三十ごとに、横に一本。", "横の線は、九本で終わっている。"]),
  chestItem("霊水", [16, 29], P_ITEM.holyWater, 2, 176),
  chestGold([45, 20], 160),
  chestItem("秘薬", [11, 36], P_ITEM.elixir, 1, 179),
  pickGold([36, 9], 60),
  foe(TROOP.prayerShades, "green", [8, 9]),
  foe(TROOP.prayerShades, "green", [40, 30]),
  foe(TROOP.keeperDead, "yellow", [33, 27]),
  foe(TROOP.coffinWarden, "red", [16, 14], "fixed", 2),
];
const cryptConfig = {
  _説明: "W12（#195）：地下の納骨堂と石工の工房（docs/world.md 5.2 の 123、text.md 5.7 の 5-19〜5-22）。暗がり 4。上り階段→120 の礼拝堂、西の納骨堂（棺の列・思念 R5-05 反対した修道士・奥の見えない通路の小部屋）、北東の王家の使いの部屋（金の箱の跡・封蝋）、南東の石工の工房（足場の設計図・思念 R5-06 石工の頭・足場の木＝頼みごと「足場の木」の分かれ目）。この設定は node tools/maps/src/w12_data.mjs が書く。",
  mapId: MAP.crypt, name: "地下の納骨堂と石工の工房", displayName: "修道院の地下", ...lookOf("crypt"),
  deco: MONASTERY_DECO,
  stamps: [stamp("F", "coffin")],
  scatter: [{ on: ".,", z: 1, tiles: ["A2:15"], rate: 0.08, seed: 12301 }],
  events: cryptEvents,
};

// ===========================================================================
// 124 裏の坂（27×15）：080 記録院の南の坂へ。写しの使いが通った道
// ===========================================================================
const slopeEvents = [
  ...[4, 5].map(y => exit("西の口（修道院の裏門へ）", [0, y], AT.cloisterBack, LEFT)),
  ...[20, 21, 22, 23].map(x => exit("北の坂（記録院へ）", [x, 0], COURT_FROM_SLOPE(x), UP)),
  { name: "坂の足跡", type: "raw", x: 21, y: 6, pages: [{ priorityType: 1, list: [
    ...say(["坂の土に、足跡が一列。北の、記録院の方へ向いている。", "戻ってくる向きの足跡は、一つも無い。"]),
    ifActor(ACTOR.nora), ...say(["ノラが足跡の横を走った。足跡を踏まないように。"], "", 1), end(1), ENDIF(), // W16（場面表 2-20）
    END,
  ] }] },
  chestItem("毒消し", [3, 11], P_ITEM.antidote, 1, 177),
];
const slopeConfig = {
  _説明: "W12（#195）：裏の坂（docs/world.md 5.2 の 124、text.md 5.7 の 5-23）。西の口→120 の裏門、高台から坂を下りて北へ、北の坂→080 記録院・前庭の南。この設定は node tools/maps/src/w12_data.mjs が書く。",
  mapId: MAP.slope, name: "裏の坂", displayName: "修道院の裏の坂", ...lookOf("slope"),
  chars: HIGH_CHARS,
  scatter: [{ on: ",^", tiles: ["B:152", "B:239", "B:171"], rate: 0.1, seed: 12401 }],
  events: slopeEvents,
};

// ===========================================================================
// 020 の出入口（W7 の設定に 1 つ足す。名前の同じイベントを置き直すので、何度走らせても同じ）
// ===========================================================================
const forestRope = look("崖の縄（崖の上の見晴らしから）", FOREST.rope, ["崖の上から縄が一本垂れている。端は、手の届く高さより上で揺れている。"]);
forestRope.note = "";
function patchSource(name, events) {
  const cfg = JSON.parse(fs.readFileSync(srcPath(name), "utf8"));
  for (const event of events) {
    const i = cfg.events.findIndex(e => e.name === event.name);
    if (i >= 0) cfg.events[i] = event; else cfg.events.push(event);
  }
  return cfg;
}

// ---------------------------------------------------------------------------
// 設定を書く
// ---------------------------------------------------------------------------
const CONFIGS = {
  w12_110_wheat_road: roadConfig,
  w12_111_wheat_village: villageConfig,
  w12_112_toll_tower: towerConfig,
  w12_113_road_shrine: shrineConfig,
  w12_115_cliff_path: cliffConfig,
  w12_116_cliff_view: viewConfig,
  w12_120_monastery_cloister: cloisterConfig,
  w12_121_scriptorium: scriptoriumConfig,
  w12_122_bell_tower: belfryConfig,
  w12_123_crypt_workshop: cryptConfig,
  w12_124_back_slope: slopeConfig,
  w7_020_mist_forest: patchSource("w7_020_mist_forest", [forestRope]),
};
// 置き物の上に置いてよいイベント（置き物そのものを調べるもの）
const ON_DECO = new Set(["鐘を抱く女の像", "石碑", "墓標", "写字台", "空の鐘架", "鐘架", "礼拝堂の祭壇", "足場の設計図", "金の延べ棒", "王家の使いの机"]);
// 壁の上に置いてよいイベント（壁の戸・門・壁の刻み）
const ON_WALL = new Set(["夜の戸の後（自動）", "ノラの一言（麦の村）", "夕べの数（自動）", "関所の門", "街道の祠の戸", "関所の詰め所の戸", "ヴォルフラムの家の戸", "東の家の戸", "南の家の戸", "麦の倉", "壁の刻み", "鐘守の当番表", "王国の道標", "井戸"]);
// イベントの座標が地図の中にあり、壁や置き物と重ならないかを確かめる（打ち間違いを早く見つけるため）
for (const [name, cfg] of Object.entries(CONFIGS)) {
  const read = ext => fs.existsSync(path.join(SRC_DIR, name + ext)) ? fs.readFileSync(path.join(SRC_DIR, name + ext), "utf8").replace(/\n$/, "").split("\n").map(l => [...l]) : null;
  const lines = read(".txt");
  const deco = read(".deco.txt");
  const seen = new Set();
  const mine = name.startsWith("w12_") ? cfg.events : [forestRope];
  for (const ev of cfg.events) {
    if (ev.x === undefined) continue;
    const key = `${ev.x},${ev.y}`;
    if (seen.has(key)) throw new Error(`${name}「${ev.name}」(${key}) にイベントが二つ`);
    seen.add(key);
    if (!mine.includes(ev)) continue;
    const ch = lines[ev.y]?.[ev.x];
    if (ch === undefined) throw new Error(`${name}「${ev.name}」(${ev.x},${ev.y}) は地図の外`);
    if ("#=WTR".includes(ch) && !ON_WALL.has(ev.name)) throw new Error(`${name}「${ev.name}」(${ev.x},${ev.y}) が壁の上「${ch}」`);
    if (deco && deco[ev.y][ev.x] !== "." && !ON_DECO.has(ev.name)) throw new Error(`${name}「${ev.name}」(${ev.x},${ev.y}) が置き物「${deco[ev.y][ev.x]}」の上`);
  }
  // スタンプは、その地図（.txt か .deco.txt）に文字があるものだけを残す（build.mjs は使わないスタンプを落とす）
  if (name.startsWith("w12_") && cfg.stamps) {
    const all = [lines, deco].filter(Boolean).flat(2).join("");
    cfg.stamps = cfg.stamps.filter(st => all.includes(st.at));
    if (!cfg.stamps.length) delete cfg.stamps;
  }
  outputs.push({ file: srcPath(name), text: sourceText(patchLater(name, cfg)) }); // W14：後日談の一行（場面表 7.3）
}

// ---------------------------------------------------------------------------
// System.json（スイッチ・変数 1051–1100 の名前）
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
      if (current !== text) { console.error(`古い: ${rel}（node tools/maps/src/w12_data.mjs で書き直す）`); stale++; }
      else console.log(`一致: ${rel}`);
    } else if (current !== text) {
      fs.writeFileSync(file, text);
      console.log(`書き出し: ${rel}`);
    }
  }
  if (stale) process.exit(1);
}
