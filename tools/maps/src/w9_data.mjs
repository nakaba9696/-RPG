// W9（#157）地域三（霧の湖・地下水道と地下都市）のデータと、文字マップの設定を書く。何度走らせても同じ結果になる。
//   node tools/maps/src/w9_maps.mjs           地図（.txt・.deco.txt）を書く
//   node tools/maps/src/w9_data.mjs           このファイル：設定（w9_*.json）とデータベースを書く
//   node tools/maps/build.mjs w9_070_mist_lake w9_071_lake_house …   地図を data/MapNNN.json にする
//   node tools/maps/src/w9_data.mjs --check   書かずに、今のファイルと同じかだけ見る（違えば終了コード 1）
// 書くもの（docs/ROADMAP.md の割り当て表の W9：データベース 501–600、スイッチ・変数 501–600、マップ 070–074・100–105）：
//   Items・Weapons・Armors・Skills・States・Enemies・Troops の 501–600
//   System.json の switches・variables 501–600 の名前
//   MapInfos.json の 070–074・100–105 の名前（前の世界の 070–073 の名前を新しい世界の名前に）
//   tools/maps/src/w9_*.json（イベント・凡例の上書き・スタンプ）。イベントの座標は w9_maps.mjs の POINTS から
//   地域一の出入口の行き先だけ：w7_035_warden_post.json の西の扉、w7_037_well_passage.json の井戸の底の格子（issue #157 の 7）
//   （砦 010 の井戸の綱は w6_data.mjs の側で直した）
// 文は docs/world.md 5.1・5.5・6 章（ゼリナ・アンセルモ）・6.8（ミルレーネ）・7.3・8.3・11 章から。説明役に語らせない（knowhow.md 2.2）。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readData, formatTable, dataPath, extendTable } from "../../data/io.mjs";
import { SRC_DIR } from "../build.mjs";
import { POINTS, MAPS, drawAll } from "./w9_maps.mjs";
import { withThirdScene, lairDoorEvents } from "./w11_parts.mjs"; // W11（#191）：鐘番の思念の 2 ページ目と霧の戸口
import { ringAfter, patchLater } from "./w14_parts.mjs"; // W14（#234）：鐘の綱の鳴ったあとの一行
import { aside, withBell, W17_SW, W17_SWITCH_NAMES, nightDoorStart, nightDoorEnd } from "./w17_parts.mjs"; // W17（#233）：原作の反映（仲間の一言・夜の戸・数え歌）
import { fixW30 } from "./w30_parts.mjs"; // W30（#315）：見えない壁と、話すと姿が変わる人の直し
import { fixW31 } from "./w31_parts.mjs"; // W31（#326）：黒い丸の拾い物を宝箱に

drawAll();
const check = process.argv.includes("--check");
const outputs = [];
const writeTable = (name, array) => {
  const file = dataPath(name);
  const i = outputs.findIndex(o => o.file === file);
  if (i >= 0) outputs.splice(i, 1); // 同じ表を二度書くときは後のものだけ
  outputs.push({ file, text: formatTable(array) });
};

// ---------------------------------------------------------------------------
// ID
// ---------------------------------------------------------------------------
export const ITEM = {
  oar: 501, lampLedger: 502, decree: 503, journal: 504, dutyTag: 505, tab: 506, arkList: 507, dirge: 508,
  // ほかの帯の物（使うだけ）
  nameTag: 328, oil: 332, lantern: 322, keyRing: 321,
  herb: 196, antidote: 197, elixir: 198, bitterRoot: 199, mossAsh: 200, sleepIncense: 141, salve: 142, smelling: 143, holyWater: 144,
};
export const WEAPON = { gateBow: 501, censer: 502 };
export const ARMOR = { boots: 501, scale: 502, helm: 503, shawl: 504, smallBell: 321 };
export const SKILL = { swallow: 501, mudWhirl: 502, fogBell: 503, knock: 504, keepShut: 505, barBlow: 506, suck: 507 };
export const STATE = { waver: 501 };
export const TROOP = {
  leeches: 501, reedShade: 502, fogSheep: 503, drowned: 504, bigJaw: 505,
  rats: 506, whiteLeech: 507, outsider: 508, keeper: 509, sluiceLord: 510, marshLord: 511, doorWarden: 512,
};
export const SW = {
  fogPath: 501, oar: 502, marshLord: 503, doorWarden: 504, drained: 505, valveUp: 506, valveDown: 507,
  rope: 508, grate: 509, gateOpened: 510, askedOutsiders: 511, waterGateOpen: 512, waterGateShut: 513,
  toldMirlene: 514, wardenWavers: 515, askedSong: 516, pipe: 517,
};
export const VAR = { songTask: 501 };
// world.md 4.4 の旗（W6 の帯）と P の帯：使うだけ
export const FLAG = { prisonBell: 101, bellWater: 103, bellsAll: 105, metMirlene: 107, bellCount: 101, outsidersErrand: 166, faint: 138, mirleneFort: 1152 };
const COMMON_MEMORY_LINE = 201; // W6：記憶が戻ったときの一言
const ACTOR = { bruno: 5, dil: 7, zelina: 8, anselmo: 9 };

const SWITCH_NAMES = {
  501: "湖:霧の道が引いた（070）",
  502: "湖:櫂を手に入れた（舟が使える）",
  503: "ボス:沼主（073。淵の水が引く）",
  504: "ボス:扉の番（103）",
  505: "水道:水が引いた（101 の弁を両方）",
  506: "水道:上流の弁",
  507: "水道:下流の弁",
  508: "水道:井戸の綱を下ろした（105↔010）",
  509: "水道:井戸の底の格子の閂（105↔037）",
  510: "頼み:村の長が大扉の閂を外した（102↔105）",
  511: "頼み:ミルレーネに頼まれた（外に残された者）",
  512: "頼み:森の水門を開けた（074）",
  513: "頼み:森の水門を開けなかった（074）",
  514: "頼み:ミルレーネに水門のことを伝えた",
  515: "ボス:扉の番が布告を見た（戦いの頭に迷う）",
  516: "頼み:村の長に扉の外の歌のことを聞いた",
  517: "水道:廃水の管の格子の閂（101↔091。H35）",
  ...W17_SWITCH_NAMES, // 518–521（W17）。620 は w10_data.mjs が書く
};
const VARIABLE_NAMES = {
  501: "頼み:扉の外の歌（0 未・1 聞いた・2 名簿を見せた・3 見せなかった）",
};

const ST = { poison: 141, sleep: 142, confuse: 144, silence: 146, bind: 147 };
const ELEMENT = { fire: 2, ice: 3, thunder: 4, water: 5, light: 8, dark: 9 };

// ---------------------------------------------------------------------------
// 説明と来歴（1 行は全角 40 字まで。knowhow.md 5.1）
// ---------------------------------------------------------------------------
const LORE = {
  "櫂": { desc: ["湖の小舟を漕ぐ櫂。舟着きの杭から舟を出せる。", "柄に焼き印で「方舟」。握りが細く削ってある。"], lore: ["沈んだ桟橋の端、酒保の女の脇にあった櫂。", "握りは女の手に合わせて、細く削り直してある。", "水かきの先が欠けている。何度も杭を突いた跡。", "焼き印の「方舟」の字は、兵の手の字。"] },
  "湖の灯の帳面": { desc: ["湖の家の、灯の帳面。", "一晩に一つ、点が打ってある。"], lore: ["点は十ずつ束ね、千で頁を替えてある。", "頁の数は七十三。この冊が七十三冊目。", "どの頁の端にも、閉じた森の門の絵。", "一冊目の最初の点だけ、墨の色が違う。"] },
  "王の布告": { desc: ["アルメリアの王の布告。", "下の半分は、内側から削られている。"], lore: ["「民を地下に守る。扉は日没に閉じる」。", "「札の無い者は、次の日没を待て」。", "削られた所に、爪の跡がいくつもある。", "爪の跡は、低い所ほど深い。"] },
  "騎士長の日誌": { desc: ["黒鉄の砦の騎士長の日誌。", "三つの封蝋の欠片が挟まっている。"], lore: ["夕べ。頂の鐘、鳴らず。灯を倍に。営倉の点呼は二度。", "王国の兵、半数、西へ。帝国の使い、墓守を引き渡せと。断る。", "教会の石工、足場の木を倉から持ち出す。許した覚え無し。", "三つとも、今月中に。そう書いたのは自分だ。", "最後の頁「兵は昨日、半分いなくなった」。"] },
  "当番の札（水底）": { desc: ["鐘の当番の札。水底の鐘の間に掛けてあった。", "日付だけが書いてある。"], lore: ["鐘の当番が、鳴らした数を書き付ける札。", "「夕べ」。その下は、何も書いていない。", "墨の下半分が、水を吸ってにじんでいる。", "日付は、営倉の札と同じ日。数だけが無い。"] },
  "酒保のつけ帳": { desc: ["砦の酒保のつけ帳。兵の名と、つけの額。", "表紙に「つけ」。酒保の女の字。"], lore: ["兵の名の横に、つけの額と、払った日。", "死んだ者の欄は、名の上に線が一本。", "一行だけ、名の欄が空いている。つけは銀三枚。", "その行には、払った日が一つも無い。", "頁をまたいでも、空いた欄は銀三枚のまま。"] },
  "方舟の乗船名簿": { desc: ["方舟に乗る者の名を書いた名簿。", "名の横に、丸と線。丸が十四。"], lore: ["酒保の字で、名と歳が並ぶ。四十行。", "丸の付いた名は、どれも十に満たない歳。", "線の付いた名は二十六。横に小さく「母」「祖父」。", "最後の行は酒保の名。丸も線も付いていない。"] },
  "弔いの名簿": { desc: ["紐で綴じた紙の束。名前ばかりが並ぶ。", "名の横に、歌った節の数。"], lore: ["司祭の字で、名と、歌った節の数。百と十一まで。", "字は、七十を過ぎた所から大きく崩れる。", "最後の名の横だけ、数が無い。", "表紙に「扉の内の者へ」。紐は、二度結び直してある。"] },
  "水門守の弓": { desc: ["攻撃と命中が上がる。", "森の水門の脇に立て掛けてあった、細い弓。"], lore: ["弦は替えてあるが、弓の木は古い。", "握りの革に、閉じた門の形の焼き印。", "矢筒には矢が三本。どれも、射られた跡が無い。"] },
  "鎖の香炉": { desc: ["攻撃と魔法力が上がる。", "鎖の先に、灰の詰まった香炉が下がっている。"], lore: ["地下へ下りる列の先頭で、司祭が振った香炉。", "灰の底に、焦げた乾し葡萄が三粒。", "鎖の輪の一つだけ、針金で継いである。"] },
  "水番の長靴": { desc: ["回避が上がる。毒を防ぐ。", "膝まである革の長靴。底に鋲が打ってある。"], lore: ["地下水道の水番が履いた長靴。", "左右で鋲の減り方が違う。左が深い。", "内側に「二番」と縫い取り。一番の長靴は無い。"] },
  "沼主の鱗": { desc: ["防御が上がる。小さな盾として持てる。", "掌ほどの鱗。縁に葦の根が絡んでいる。"], lore: ["湖の淵の主から剥がれた鱗。", "裏に、焦げた葦の跡が貼りついている。", "叩くと、湖の底のような低い音がする。"] },
  "衛兵の兜": { desc: ["防御が上がる。混乱を防ぐ。", "王国の衛兵の兜。面頬が下りたまま錆びている。"], lore: ["扉の番が、最後まで脱がなかった兜。", "面頬の内側に、布告の文が爪で刻んである。", "刻みは「扉は日没に」で止まっている。"] },
  "灯守の肩掛け": { desc: ["魔法防御が上がる。眠りを防ぐ。", "灯芯の煤で、裾が黒くなった肩掛け。"], lore: ["湖の家の隠し部屋に、たたんで置いてあった。", "裾に、灯芯を切った跡の焦げが点々と並ぶ。", "毛織りの目が、人の織り方と逆。"] },
};
for (const [name, { desc, lore }] of Object.entries(LORE)) {
  for (const line of [...desc, ...lore]) if ([...line].length > 40) throw new Error(`${name} の文が 40 字を超える：${line}`);
}
const descOf = name => LORE[name].desc.join("\n");
const loreOf = name => ["<hai_lore>", ...LORE[name].lore, "</hai_lore>"].join("\n");

// ---------------------------------------------------------------------------
// 帯の中だけを書く
// ---------------------------------------------------------------------------
const BAND = [501, 600];
function clearBand(table, makeEmpty) {
  extendTable(table, BAND[0] - 1, makeEmpty);
  for (let id = BAND[0]; id < table.length && id <= BAND[1]; id++) table[id] = makeEmpty(id);
  while (table.length - 1 >= BAND[0] && table.length - 1 <= BAND[1] && table[table.length - 1].name === "") table.pop();
}
function put(table, id, item, makeEmpty) {
  if (id < BAND[0] || id > BAND[1]) throw new Error(`${id} は W9 の帯の外`);
  extendTable(table, id, makeEmpty);
  table[id] = { ...makeEmpty(id), ...item, id };
}

// Items
const emptyItem = id => ({
  id, animationId: 0, consumable: true,
  damage: { critical: false, elementId: 0, formula: "0", type: 0, variance: 20 },
  description: "", effects: [], hitType: 0, iconIndex: 0, itypeId: 1, name: "", note: "",
  occasion: 0, price: 0, repeats: 1, scope: 7, speed: 0, successRate: 100, tpGain: 0,
});
const keyItem = (name, iconIndex) => ({ name, description: descOf(name), note: loreOf(name), iconIndex, itypeId: 2, consumable: false, occasion: 3, scope: 0 });
const items = readData("Items.json");
clearBand(items, emptyItem);
put(items, ITEM.oar, keyItem("櫂", 107), emptyItem);
put(items, ITEM.lampLedger, keyItem("湖の灯の帳面", 229), emptyItem);
put(items, ITEM.decree, keyItem("王の布告", 192), emptyItem);
put(items, ITEM.journal, keyItem("騎士長の日誌", 230), emptyItem);
put(items, ITEM.dutyTag, keyItem("当番の札（水底）", 196), emptyItem);
put(items, ITEM.tab, keyItem("酒保のつけ帳", 228), emptyItem);
put(items, ITEM.arkList, keyItem("方舟の乗船名簿", 193), emptyItem);
put(items, ITEM.dirge, keyItem("弔いの名簿", 231), emptyItem);
writeTable("Items.json", items);

// Weapons・Armors
const emptyWeapon = id => ({
  id, animationId: 0, description: "", etypeId: 1, traits: [{ code: 31, dataId: 1, value: 0 }, { code: 22, dataId: 0, value: 0 }],
  iconIndex: 0, name: "", note: "", params: [0, 0, 0, 0, 0, 0, 0, 0], price: 0, wtypeId: 0,
});
const weapons = readData("Weapons.json");
clearBand(weapons, emptyWeapon);
put(weapons, WEAPON.gateBow, {
  name: "水門守の弓", description: descOf("水門守の弓"), note: [loreOf("水門守の弓"), "<hai_unique>"].join("\n"),
  animationId: 11, iconIndex: 102, wtypeId: 7, params: [0, 0, 26, 0, 0, 0, 6, 0],
  traits: [{ code: 31, dataId: 1, value: 0 }, { code: 22, dataId: 0, value: 0.1 }],
}, emptyWeapon);
put(weapons, WEAPON.censer, {
  name: "鎖の香炉", description: descOf("鎖の香炉"), note: [loreOf("鎖の香炉"), "<hai_unique>"].join("\n"),
  animationId: 1, iconIndex: 98, wtypeId: 3, params: [0, 0, 18, 0, 14, 4, 0, 0],
  traits: [{ code: 31, dataId: 1, value: 0 }, { code: 22, dataId: 0, value: 0 }],
}, emptyWeapon);
writeTable("Weapons.json", weapons);

const emptyArmor = id => ({
  id, atypeId: 1, description: "", etypeId: 4, traits: [{ code: 22, dataId: 1, value: 0 }],
  iconIndex: 0, name: "", note: "", params: [0, 0, 0, 0, 0, 0, 0, 0], price: 0,
});
const armors = readData("Armors.json");
clearBand(armors, emptyArmor);
put(armors, ARMOR.boots, {
  name: "水番の長靴", description: descOf("水番の長靴"), note: loreOf("水番の長靴"),
  atypeId: 1, etypeId: 5, iconIndex: 145, params: [0, 0, 0, 2, 0, 0, 3, 0],
  traits: [{ code: 22, dataId: 1, value: 0.08 }, { code: 14, dataId: ST.poison, value: 0 }],
}, emptyArmor);
put(armors, ARMOR.scale, {
  name: "沼主の鱗", description: descOf("沼主の鱗"), note: loreOf("沼主の鱗"),
  atypeId: 5, etypeId: 2, iconIndex: 128, params: [0, 0, 0, 14, 0, 6, 0, 0], traits: [{ code: 22, dataId: 1, value: 0 }],
}, emptyArmor);
put(armors, ARMOR.helm, {
  name: "衛兵の兜", description: descOf("衛兵の兜"), note: loreOf("衛兵の兜"),
  atypeId: 4, etypeId: 3, iconIndex: 130, params: [0, 0, 0, 10, 0, 4, 0, 0],
  traits: [{ code: 22, dataId: 1, value: 0 }, { code: 14, dataId: ST.confuse, value: 0 }],
}, emptyArmor);
put(armors, ARMOR.shawl, {
  name: "灯守の肩掛け", description: descOf("灯守の肩掛け"), note: [loreOf("灯守の肩掛け"), "<hai_unique>"].join("\n"),
  atypeId: 2, etypeId: 4, iconIndex: 135, params: [0, 0, 0, 6, 0, 14, 0, 0],
  traits: [{ code: 22, dataId: 1, value: 0 }, { code: 14, dataId: ST.sleep, value: 0 }],
}, emptyArmor);
writeTable("Armors.json", armors);

// Skills（敵の技）
const emptySkill = id => ({
  id, animationId: 0, damage: { critical: false, elementId: 0, formula: "0", type: 0, variance: 20 },
  description: "", effects: [], hitType: 0, iconIndex: 0, message1: "", message2: "", mpCost: 0, name: "", note: "",
  occasion: 0, repeats: 1, requiredWtypeId1: 0, requiredWtypeId2: 0, scope: 1, speed: 0, stypeId: 0, successRate: 100,
  tpCost: 0, tpGain: 0, messageType: 1,
});
const skills = readData("Skills.json");
clearBand(skills, emptySkill);
const enemySkill = (name, o) => ({ name, occasion: 1, stypeId: 0, hitType: 1, note: "<hai_w9:敵の技>", ...o });
const dmg = (formula, o = {}) => ({ critical: false, elementId: -1, formula, type: 1, variance: 20, ...o });
put(skills, SKILL.swallow, enemySkill("呑み込み", {
  description: "大きな口で呑み込み、動けなくする。", animationId: 11, iconIndex: 0, scope: 1, message1: "%1は大きな口を開けた！",
  damage: dmg("a.atk * 3 - b.def"), effects: [{ code: 21, dataId: ST.bind, value1: 0.5, value2: 0 }],
}), emptySkill);
put(skills, SKILL.mudWhirl, enemySkill("泥の渦", {
  description: "淵の泥を巻き上げ、全員を打つ。", animationId: 87, iconIndex: 0, scope: 2, message1: "%1は泥を巻き上げた！",
  damage: dmg("a.atk * 2 - b.def"), effects: [{ code: 21, dataId: ST.poison, value1: 0.4, value2: 0 }],
}), emptySkill);
put(skills, SKILL.fogBell, enemySkill("霧の鈴", {
  description: "霧の中で鈴を鳴らし、惑わせる。", animationId: 59, iconIndex: 6, hitType: 2, scope: 1, message1: "%1の首の鈴が、霧の向こうで鳴った！",
  effects: [{ code: 21, dataId: ST.confuse, value1: 0.4, value2: 0 }],
}), emptySkill);
put(skills, SKILL.knock, enemySkill("戸を叩く", {
  description: "三度、叩く。", animationId: 1, iconIndex: 0, scope: 1, repeats: 3, message1: "%1は三度、叩いた！",
  damage: dmg("a.atk * 1.5 - b.def"),
}), emptySkill);
put(skills, SKILL.keepShut, enemySkill("開けるな", {
  description: "槍を横にして薙ぎ払う。", animationId: 6, iconIndex: 0, scope: 2, message1: "%1は槍を横にして払った！",
  damage: dmg("a.atk * 2.5 - b.def"),
}), emptySkill);
put(skills, SKILL.barBlow, enemySkill("閂打ち", {
  description: "閂のような槍の柄で、強く打つ。", animationId: 1, iconIndex: 0, scope: 1, message1: "%1は槍の柄を振り下ろした！",
  damage: dmg("a.atk * 4 - b.def * 2", { critical: true }),
}), emptySkill);
put(skills, SKILL.suck, enemySkill("吸い付く", {
  description: "吸い付いて、血を吸う。", animationId: 11, iconIndex: 0, scope: 1, message1: "%1は吸い付いた！",
  damage: dmg("a.atk * 2 - b.def", { type: 5 }),
}), emptySkill);
writeTable("Skills.json", skills);

// States
const emptyState = id => ({
  id, autoRemovalTiming: 0, chanceByDamage: 100, iconIndex: 0, maxTurns: 1, message1: "", message2: "", message3: "", message4: "",
  minTurns: 1, motion: 0, name: "", note: "", overlay: 0, priority: 50, releaseByDamage: false, removeAtBattleEnd: true,
  removeByDamage: false, removeByRestriction: false, removeByWalking: false, restriction: 0, stepsToRemove: 100, traits: [],
  messageType: 1,
});
const states = readData("States.json");
clearBand(states, emptyState);
put(states, STATE.waver, {
  name: "迷い（扉の番）", iconIndex: 10, priority: 60, message1: "", message2: "%1は、布告の続きを探している。", message3: "", message4: "%1は、槍を構え直した。",
  autoRemovalTiming: 2, minTurns: 4, maxTurns: 4,
  traits: [{ code: 21, dataId: 2, value: 0.7 }, { code: 21, dataId: 3, value: 0.7 }],
  note: "<hai_w9:扉の番が王の布告を見たとき、戦いの頭に付く>",
}, emptyState);
writeTable("States.json", states);

// Enemies・Troops（world.md 5.1・5.5。地下都市の敵は「扉の外の者」。そうとは書かない。数値は仮で、持ち主が調整する）
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
  attackTimes: n => ({ code: 34, dataId: 0, value: n }),
};
const base = [{ code: 22, dataId: 0, value: 0.95 }, { code: 22, dataId: 1, value: 0.05 }, { code: 31, dataId: 1, value: 0 }];
const act = (skillId, rating = 5) => ({ conditionParam1: 0, conditionParam2: 0, conditionType: 0, rating, skillId });
const onTurn = (skillId, a, b, rating = 5) => ({ conditionParam1: a, conditionParam2: b, conditionType: 1, rating, skillId });
const hpBelow = (skillId, rate, rating) => ({ conditionParam1: 0, conditionParam2: rate, conditionType: 2, rating, skillId });
const attack = act(1);
const guard = act(2, 3);
const P4 = { poisonHit: 163, chain: 170 };
const drop = (kind, id, denominator) => [{ dataId: id, denominator, kind }, { dataId: 1, denominator: 1, kind: 0 }, { dataId: 1, denominator: 1, kind: 0 }];
const noDrop = drop(0, 1, 1);
const ENEMIES = [
  // 霧の湖
  [501, "沼蛭", "Sandworm", 60, [150, 0, 20, 12, 8, 10, 14, 10], 12, 8, [T.element(ELEMENT.fire, 1.5)], [attack, act(SKILL.suck, 4)], drop(1, ITEM.herb, 5)],
  [502, "葦の影", "Wraith", 90, [190, 0, 22, 10, 14, 14, 18, 10], 14, 10, [T.element(ELEMENT.light, 2), T.physRate(0.8)], [attack], drop(1, ITEM.antidote, 5)],
  [503, "霧の羊", "Hakutaku", 0, [340, 30, 26, 16, 18, 18, 16, 10], 24, 16, [T.element(ELEMENT.light, 1.5), T.element(ELEMENT.fire, 1.5)], [attack, act(SKILL.fogBell, 3)], noDrop],
  [504, "沈み人", "Zombie", 160, [400, 0, 30, 20, 8, 12, 10, 10], 26, 20, [T.element(ELEMENT.fire, 1.5), T.element(ELEMENT.thunder, 1.5)], [attack, act(P4.poisonHit, 3)], noDrop],
  [505, "大顎", "Ketos", 0, [1700, 0, 40, 24, 8, 16, 22, 10], 90, 45, [T.attackTimes(1), T.element(ELEMENT.thunder, 1.5)], [attack, act(SKILL.swallow, 3)], noDrop],
  // 地下水道と地下都市
  [506, "溝鼠", "Frilledlizard", 60, [150, 0, 22, 12, 8, 8, 22, 10], 10, 7, [], [attack], drop(1, ITEM.bitterRoot, 4)],
  [507, "白い蛭", "Sandworm", 200, [230, 0, 22, 22, 8, 10, 10, 10], 14, 10, [T.element(ELEMENT.fire, 1.5)], [attack, act(SKILL.suck, 4)], noDrop],
  [508, "扉の外の者", "Zombie", 30, [430, 0, 30, 20, 10, 14, 12, 10], 30, 22, [T.element(ELEMENT.light, 1.5)], [attack, act(SKILL.knock, 4)], noDrop],
  [509, "水番の亡骸", "Sailor", 200, [470, 20, 32, 24, 12, 16, 14, 10], 32, 24, [T.element(ELEMENT.thunder, 1.5)], [attack, guard, act(P4.chain, 3)], noDrop],
  [510, "水門の主", "SF_Anaconda", 0, [1800, 0, 42, 26, 8, 18, 24, 10], 100, 50, [T.attackTimes(1), T.element(ELEMENT.ice, 1.5)], [attack, act(SKILL.suck, 4)], noDrop],
];
const LORD = 511, WARDEN = 512;
const enemies = readData("Enemies.json");
clearBand(enemies, emptyEnemy);
for (const [id, name, battlerName, battlerHue, params, exp, gold, traits, actions, dropItems] of ENEMIES) {
  put(enemies, id, { name, battlerName, battlerHue, params, exp, gold, traits: [...base, ...traits], actions, dropItems }, emptyEnemy);
}
// W27（#300）：R3 で 5 ターンだったので、W22 後の加入時の装備（Lv9・9・10・8 の四人・攻撃と灰火）で 8〜10 ターン・HP 5 割残る所に（HP 3000→4600、攻撃 50→56）。
// 炎に弱いので、ディルのファイアⅡを使う隊は 4〜6 ターン（弱みの見返り）
put(enemies, LORD, {
  name: "沼主", battlerName: "Hydra", battlerHue: 100, params: [4600, 80, 56, 30, 24, 28, 24, 30], exp: 380, gold: 300,
  traits: [...base, T.physRate(0.8), T.element(ELEMENT.fire, 2), T.element(ELEMENT.water, 0), T.stateRate(ST.poison, 0)],
  actions: [attack, act(SKILL.swallow, 5), onTurn(SKILL.mudWhirl, 3, 3, 9), hpBelow(SKILL.mudWhirl, 0.4, 6)],
  dropItems: noDrop,
  note: ["<hai_boss>", "<hai_boss_name:沼主>", "<hai_weak_hint:炎>", `<hai_boss_switch:${SW.marshLord}>`, "<hai_actions_low:2,40>", "<hai_drop:none>"].join("\n"),
}, emptyEnemy);
put(enemies, WARDEN, {
  name: "扉の番", battlerName: "Stoneknight", battlerHue: 120, params: [3400, 60, 54, 38, 20, 24, 24, 30], exp: 420, gold: 320,
  traits: [...base, T.physRate(0.7), T.element(ELEMENT.thunder, 2), T.element(ELEMENT.ice, 0.5), T.stateRate(1, 0)],
  actions: [attack, act(SKILL.barBlow, 5), onTurn(SKILL.keepShut, 3, 3, 9), hpBelow(SKILL.keepShut, 0.4, 6)],
  dropItems: noDrop,
  note: ["<hai_boss>", "<hai_boss_name:扉の番>", "<hai_weak_hint:雷>", `<hai_boss_switch:${SW.doorWarden}>`, "<hai_actions_low:2,40>", "<hai_drop:none>"].join("\n"),
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
  [TROOP.leeches, "W9_緑：沼蛭×2", [501, 501]],
  [TROOP.reedShade, "W9_緑：葦の影", [502]],
  [TROOP.fogSheep, "W9_黄：霧の羊", [503]],
  [TROOP.drowned, "W9_黄：沈み人", [504]],
  [TROOP.bigJaw, "W9_赤：大顎", [505]],
  [TROOP.rats, "W9_緑：溝鼠×2", [506, 506]],
  [TROOP.whiteLeech, "W9_緑：白い蛭", [507]],
  [TROOP.outsider, "W9_黄：扉の外の者", [508]],
  [TROOP.keeper, "W9_黄：水番の亡骸", [509]],
  [TROOP.sluiceLord, "W9_赤：水門の主", [510]],
  [TROOP.marshLord, "W9_ボス：沼主", [LORD]],
  [TROOP.doorWarden, "W9_ボス：扉の番", [WARDEN]],
];
const troops = readData("Troops.json");
clearBand(troops, emptyTroop);
for (const [id, name, members] of TROOPS) {
  const pos = row(members.length);
  put(troops, id, { name, members: members.map((enemyId, i) => ({ enemyId, ...pos[i], hidden: false })) }, emptyTroop);
}
const tmsg = (indent, name, lines) => [{ code: 101, indent, parameters: ["", 0, 0, 2, name] }, ...lines.map(text => ({ code: 401, indent, parameters: [text] }))];
const page0 = emptyTroop(0).pages[0];
const END0 = { code: 0, indent: 0, parameters: [] };
troops[TROOP.marshLord].pages = [
  { ...page0, conditions: { ...page0.conditions, enemyHp: 50, enemyIndex: 0, enemyValid: true }, span: 1,
    list: [
      { code: 111, indent: 0, parameters: [12, "$gameTroop.members()[0].isAlive()"] },
      ...tmsg(1, "", ["主は葦の根を引きちぎり、淵の底の泥を巻き上げた。"]),
      { code: 0, indent: 1, parameters: [] }, { code: 412, indent: 0, parameters: [] }, END0,
    ] },
];
// 扉の番：布告を見ていたら、戦いの頭に「迷い」。同じ文をくり返し、HP 50% で一度だけ崩れる（world.md 11 章の表に足した口調）
troops[TROOP.doorWarden].pages = [
  { ...page0, conditions: { ...page0.conditions, switchId: SW.wardenWavers, switchValid: true }, span: 0,
    list: [
      { code: 333, indent: 0, parameters: [-1, 0, STATE.waver] },
      ...tmsg(0, "", ["番の槍の先が、下がったままだ。"]),
      END0,
    ] },
  { ...page0, conditions: { ...page0.conditions, turnA: 2, turnB: 3, turnValid: true }, span: 1,
    list: [...tmsg(0, "扉の番", ["次の日没を、待て。"]), END0] },
  { ...page0, conditions: { ...page0.conditions, enemyHp: 50, enemyIndex: 0, enemyValid: true }, span: 1,
    list: [
      { code: 111, indent: 0, parameters: [12, "$gameTroop.members()[0].isAlive()"] },
      ...tmsg(1, "扉の番", ["日没は……いつだ。"]),
      { code: 0, indent: 1, parameters: [] }, { code: 412, indent: 0, parameters: [] }, END0,
    ] },
];
writeTable("Troops.json", troops);

// ---------------------------------------------------------------------------
// 前の世界の魚人の湿地（W4。070–073）の物を空にする（issue #157 の 10。W8 #155 が「W9 が湖を作り直すまで触らない」と残した物）。
// 帯は W8 の 401–500 の中だが、どのマップからも使われていない。名前が前の世界のままのときだけ空にする（何度走らせても同じ）。
// ---------------------------------------------------------------------------
const OLD_MARSH = {
  "Items.json": [[null, { 401: "灰の病の届け帳", 402: "牙の首飾り", 406: "沼主の髭" }, emptyItem]],
  "Weapons.json": [[null, { 401: "漁師の銛" }, emptyWeapon]],
  "Armors.json": [[null, { 401: "歌い手の首飾り", 402: "水鏡の護符" }, emptyArmor]],
  "Skills.json": [[null, { 401: "吸い付き", 402: "眠りの舌", 403: "溺れの息", 404: "惑わしの羽", 405: "噛み砕き", 406: "尾の一撃", 407: "泥吐き", 408: "呑み込み", 409: "淵に潜る", 410: "大波" }, emptySkill]],
  "States.json": [[null, { 401: "淵に潜る", 402: "呑み込まれ" }, emptyState]],
  "Enemies.json": [[null, { 401: "葦蛭", 402: "泥蛙", 403: "沈み人", 404: "霧の鷺", 405: "大顎", 406: "沼主", 413: "沼主" }, emptyEnemy]],
  "Troops.json": [[null, { 401: "W4_緑：葦蛭", 402: "W4_緑：泥蛙", 403: "W4_黄：沈み人", 404: "W4_黄：霧の鷺", 405: "W4_赤：大顎", 406: "W4_ボス：沼主" }, emptyTroop]],
};
const TABLES = { "Items.json": items, "Weapons.json": weapons, "Armors.json": armors, "Skills.json": skills, "States.json": states, "Enemies.json": enemies, "Troops.json": troops };
for (const [file, [[, names, makeEmpty]]] of Object.entries(OLD_MARSH)) {
  const table = TABLES[file];
  for (const [id, name] of Object.entries(names)) if (table[id] && table[id].name === name) table[id] = makeEmpty(Number(id));
  writeTable(file, table);
}

// ---------------------------------------------------------------------------
// System.json（スイッチ・変数 501–600 の名前）と MapInfos.json（070–074・100–105 の名前）
// ---------------------------------------------------------------------------
const sysPath = dataPath("System.json");
const system = JSON.parse(fs.readFileSync(sysPath, "utf8"));
for (const [key, names] of [["switches", SWITCH_NAMES], ["variables", VARIABLE_NAMES]]) {
  const arr = system[key];
  while (arr.length <= 600) arr.push("");
  for (let id = 501; id <= 600; id++) arr[id] = names[id] ?? "";
}
outputs.push({ file: sysPath, text: JSON.stringify(system) });

const MAP_NAMES = {
  70: "霧の湖・葦原", 71: "湖の家", 72: "沈んだ桟橋", 73: "湖の淵", 74: "小島",
  100: "地下水道・上流", 101: "地下水道・水門", 102: "地下都市の閉じた扉の前", 103: "扉の番の間", 104: "水底の鐘の間", 105: "井戸の縦穴",
};
const infos = readData("MapInfos.json");
let order = Math.max(...infos.filter(Boolean).map(i => i.order));
for (const [id, name] of Object.entries(MAP_NAMES)) {
  const n = Number(id);
  extendTable(infos, n - 1, i => null);
  if (infos[n]) infos[n] = { ...infos[n], name };
  else infos[n] = { id: n, expanded: false, name, order: ++order, parentId: 0, scrollX: 0, scrollY: 0 };
}
outputs.push({ file: dataPath("MapInfos.json"), text: formatTable(infos) });

// ---------------------------------------------------------------------------
// イベントの部品
// ---------------------------------------------------------------------------
const cmd = (code, parameters, indent = 0) => ({ code, indent, parameters });
const END = cmd(0, []);
const say = (lines, speaker = "", indent = 0) => [cmd(101, ["", 0, 0, 2, speaker], indent), ...lines.map(l => cmd(401, [l], indent))];
const se = (name, indent = 0, volume = 90, pitch = 100) => cmd(250, [{ name, volume, pitch, pan: 0 }], indent);
const plugin = (name, command, label, args = {}, indent = 0) => [
  cmd(357, [name, command, label, args], indent),
  ...Object.entries(args).map(([k, v]) => cmd(657, [`${k} = ${v}`], indent)),
];
const swOn = (id, indent = 0) => cmd(121, [id, id, 0], indent);
const selfOn = (ch = "A", indent = 0) => cmd(123, [ch, 0], indent);
const ifSwitch = (id, indent = 0, on = true) => cmd(111, [0, id, on ? 0 : 1], indent);
const ifItem = (id, indent = 0) => cmd(111, [8, id], indent);
const ifScript = (s, indent = 0) => cmd(111, [12, s], indent);
const ifVar = (id, value, op = 1, indent = 0) => cmd(111, [1, id, 0, value, op], indent);
const ELSE = (indent = 0) => cmd(411, [], indent);
const ENDIF = (indent = 0) => cmd(412, [], indent);
const close = indent => cmd(0, [], indent);
const transferCmd = (mapId, x, y, dir, indent = 0) => cmd(201, [0, mapId, x, y, dir, 0], indent);
const addNote = (id, text, indent = 0) => plugin("Hai_Thoughts", "addNote", "メモを足す", { text, id, kind: "clue" }, indent);
const errand = (args, indent = 0) => plugin("Hai_Notes", "errand", "頼みごとを進める", args, indent);
const errandEnd = (args, indent = 0) => plugin("Hai_Notes", "errandEnd", "頼みごとを終える", args, indent);
/** 選択肢。branches は [文言, 命令の配列（indent は中で +1 される前の 0 始まり）] */
function choice(options, cancel, branches, indent = 0) {
  const out = [cmd(102, [options, cancel, 0, 2, 0], indent)];
  branches.forEach((body, i) => {
    out.push(cmd(402, [i, options[i]], indent));
    out.push(...body.map(c => ({ ...c, indent: c.indent + indent + 1 })));
    out.push(close(indent + 1));
  });
  out.push(cmd(404, [], indent));
  return out;
}
const shift = (list, n) => list.map(c => ({ ...c, indent: c.indent + n }));
const DOWN = 2, LEFT = 4, RIGHT = 6, UP = 8;

const IMG = {
  thought: { characterName: "!Flame", characterIndex: 5, direction: DOWN, pattern: 1 },
  faint: { characterName: "!Flame", characterIndex: 4, direction: DOWN, pattern: 1 },
  body: i => ({ characterName: "Damage2", characterIndex: i, direction: DOWN, pattern: 1 }),
  chest: { characterName: "!Chest", characterIndex: 0, direction: DOWN, pattern: 0 },
  chestOpen: { characterName: "!Chest", characterIndex: 0, direction: UP, pattern: 0 },
  red: { characterName: "!Chest", characterIndex: 1, direction: DOWN, pattern: 0 },
  redOpen: { characterName: "!Chest", characterIndex: 1, direction: UP, pattern: 0 },
  shine: { characterName: "!Other1", characterIndex: 1, direction: DOWN, pattern: 1 },
  fog: { characterName: "!Other2", characterIndex: 4, direction: DOWN, pattern: 1 },
  warp: { characterName: "!Other2", characterIndex: 3, direction: DOWN, pattern: 1 },
  gate: { characterName: "!$Gate1", characterIndex: 0, direction: DOWN, pattern: 0 },
  gateOpen: { characterName: "!$Gate1", characterIndex: 0, direction: UP, pattern: 0 },
  door: { characterName: "!Door1", characterIndex: 6, direction: DOWN, pattern: 0 },
  doorOpen: { characterName: "!Door1", characterIndex: 6, direction: UP, pattern: 0 },
  mirlene: { characterName: "People4", characterIndex: 3, direction: DOWN, pattern: 1 },
  elder: { characterName: "People3", characterIndex: 0, direction: DOWN, pattern: 1 },
  villagerW: { characterName: "People2", characterIndex: 1, direction: DOWN, pattern: 1 },
  villagerM: { characterName: "People2", characterIndex: 4, direction: LEFT, pattern: 1 },
  child: { characterName: "People1", characterIndex: 6, direction: DOWN, pattern: 1 },
  zelina: { characterName: "Damage1", characterIndex: 2, direction: DOWN, pattern: 1 },
  anselmo: { characterName: "Damage1", characterIndex: 4, direction: UP, pattern: 1 },
  marshLord: { characterName: "Monster", characterIndex: 1, direction: DOWN, pattern: 1 },
  warden: { characterName: "Evil", characterIndex: 3, direction: DOWN, pattern: 1 },
  monster: i => ({ characterName: "Monster", characterIndex: i, direction: DOWN, pattern: 1 }),
};

// 名前とアイコン（手に入れたの一行）
const allItems = readData("Items.json"), allWeapons = readData("Weapons.json"), allArmors = readData("Armors.json");
function gainLines(kind, id, n, indent = 0) {
  if (kind === "g") return [se("Coin", indent), cmd(125, [0, 0, n], indent), ...say([`鉄くずを ${n} 手に入れた。`], "", indent)];
  const table = { i: [items, allItems], w: [weapons, allWeapons], a: [armors, allArmors] }[kind];
  const item = table[0][id]?.name ? table[0][id] : table[1][id];
  if (!item || !item.name) throw new Error(`${kind}${id} が無い`);
  const code = { i: 126, w: 127, a: 128 }[kind];
  const params = kind === "i" ? [id, 0, 0, n] : [id, 0, 0, n, false];
  const label = n > 1 ? `${item.name}×${n}` : item.name;
  return [cmd(code, params, indent), ...say([`\\I[${item.iconIndex}]${label}を手に入れた。`], "", indent)]; // 「薬草×2を手に入れた。」の形（W20 #264。R2 気になる 26）
}

const ev = {};
/** 調べると一行か二行。 */
ev.text = (name, [x, y], lines, o = {}) => ({ name, type: "text", x, y, lines, ...(o.image ? { image: o.image } : {}), ...(o.note ? { note: o.note } : {}), ...(o.speaker ? { speaker: o.speaker } : {}), ...(o.below ? { priorityType: 0 } : {}) });
/** 床の手がかり（踏んで調べる。通り道をふさがない）。 */
ev.floor = (name, xy, lines) => ev.text(name, xy, lines, { below: true });
ev.raw = (name, [x, y], pages, note = "") => ({ name, type: "raw", x, y, note, pages });
/** 調べると文章、そのあとに命令（W17：仲間の一言など）。 */
ev.textThen = (name, xy, lines, after, o = {}) => ev.raw(name, xy, [
  { ...(o.image ? { image: o.image } : {}), priorityType: o.below ? 0 : 1, list: [...pagesOf(lines), ...after, END] },
], o.note || "");
ev.transfer = (name, [x, y], to, o = {}) => ({ name, type: "transfer", x, y, to, ...o });
ev.block = (name, [x, y]) => ({ name, type: "block", x, y });
/** 宝箱。 */
ev.chest = (name, xy, [kind, id, n = 1], red = false) => ev.raw(`宝箱（${name}）`, xy, [
  { image: red ? IMG.red : IMG.chest, priorityType: 1, walkAnime: false,
    list: [se("Chest1"), ...gainLines(kind, id, n), selfOn(), END] },
  { conditions: { selfSwitchCh: "A", selfSwitchValid: true }, image: red ? IMG.redOpen : IMG.chestOpen, priorityType: 1, walkAnime: false },
]);
/** 拾える物（光る点か、物の絵）。 */
ev.pickup = (name, xy, lines, [kind, id, n = 1], o = {}) => ev.raw(`拾い物（${name}）`, xy, [
  { image: o.image || IMG.shine, priorityType: 1, stepAnime: !o.image, walkAnime: false,
    list: [...(lines.length ? say(lines) : []), se(kind === "g" ? "Coin" : "Item1"), ...gainLines(kind, id, n), ...(o.after || []), selfOn(), END] },
  { conditions: { selfSwitchCh: "A", selfSwitchValid: true }, priorityType: 0, ...(o.keepImage ? { image: o.keepImage, priorityType: 1 } : {}) },
]);
/** 残留思念。 */
ev.thought = (id, who, xy, lines, o = {}) => ({
  name: `思念 ${id} ${who}`, type: o.after ? "raw" : "text", x: xy[0], y: xy[1],
  note: [`<hai_thought:${id}>`, ...(o.clues || []).map(c => `<hai_clue:${c}>`)].join(""),
  ...(o.after
    ? { pages: [{ image: o.image || IMG.thought, priorityType: 1, stepAnime: !o.image, list: [...pagesOf(lines), ...o.after, END] }] }
    : { image: o.image || IMG.thought, lines }),
});
function pagesOf(lines) {
  const blocks = Array.isArray(lines[0]) ? lines : [lines];
  return blocks.flatMap(b => say(b));
}
/** 仲間の記憶の断片（Hai_Companions）。 */
ev.memory = (actorId, n, who, xy, lines, image = IMG.thought) => ({
  name: `記憶 ${who} ${n}`, type: "text", x: xy[0], y: xy[1], note: `<hai_memory:${actorId},${n}>`, image, lines,
});
/** シンボル敵。 */
ev.enemy = (name, xy, troop, color, o = {}) => ev.raw(`${name}（${{ green: "緑", yellow: "黄", red: "赤" }[color]}${o.kind ? "・" + o.kind : ""}）`, xy, [
  { image: o.image || IMG.monster(5), priorityType: 1, moveSpeed: o.speed ?? 3, trigger: 2, moveType: o.moveType ?? 1, moveFrequency: o.freq ?? 3 },
], withBell([`<hai_enemy:${troop},${color}>`, ...(o.chase !== undefined ? [`<hai_enemy_chase:${o.chase}>`] : []), ...(color === "green" ? ["<hai_enemy_hesitate>"] : [])].join(""), FLAG.bellWater)); // 鐘の旗は P14（#230）が読む
/** 転送の結界（Hai_Warp）。 */
ev.warp = (label, xy) => ev.raw(`結界（${label}）`, xy, [{ image: IMG.warp, priorityType: 1, stepAnime: true }], `<hai_warp:${label}>`);

/** スイッチで消える通行止め（水）。 */
function flood(name, xy, lines) {
  return ev.raw(name, xy, [
    { image: { tileId: "E:85" }, priorityType: 1, trigger: 0, list: [...say(lines), END] },
    { conditions: { switch1Id: SW.drained, switch1Valid: true }, priorityType: 0 },
  ]);
}

const BOAT = 0;
/**
 * 舟着き（櫂があれば舟を出す）。立っているマスのイベント（通常キャラの下）。
 * 「自分で漕ぐ」は boatAt に小型船を出し、そちらを向いて乗る（MZ の乗り物）。ほかの舟着きの名を選ぶと、そこまで漕いで着く（場所移動）。
 * docks：[{ label, stand: [x, y], boat: [x, y], face }]。自分は self（docks の添字）。
 */
// W28（#302）：杭は「通常」の優先度で、板の道の隣のマスから調べる。すり抜けにして、舟から杭の先へ降りられるのはそのまま。
// 「自分で漕ぐ」は、舟を杭の脇の水に着け、プレイヤーを杭の先へ移して舟の方を向かせてから乗せる（どこから調べても同じ形になる）。
function dock(name, mapId, docks, self) {
  const me = docks[self];
  const others = docks.filter((_, i) => i !== self);
  const options = ["自分で漕ぐ", ...others.map(o => `${o.label}へ漕ぐ`), "やめる"];
  return ev.raw(name, me.stand, [{
    priorityType: 1, through: true, trigger: 0,
    list: [
      ifItem(ITEM.oar),
      ...say(["杭に小舟が一艘、舫ってある。"], "", 1),
      ...choice(options, options.length - 1, [
        [cmd(221, []),
          cmd(202, [BOAT, 0, mapId, me.boat[0], me.boat[1]]),
          transferCmd(mapId, me.stand[0], me.stand[1], me.face),
          cmd(222, []),
          cmd(206, [])],
        ...others.map(o => [
          cmd(221, []), se("Water1", 0, 60), cmd(230, [30]),
          cmd(202, [BOAT, 0, mapId, o.boat[0], o.boat[1]]),
          transferCmd(mapId, o.stand[0], o.stand[1], 10 - o.face),
          cmd(222, []),
        ]),
        [],
      ], 1),
      close(1),
      ELSE(),
      ...say(["杭に小舟が一艘、舫ってある。漕ぐ物が無い。"], "", 1),
      close(1),
      ENDIF(),
      END,
    ],
  }]);
}

// ---------------------------------------------------------------------------
// 置き物の凡例（重ね書き）
// ---------------------------------------------------------------------------
const MARSH_DECO = {
  k: { name: "草A", z2: "B:152" }, K: { name: "草B", z2: "B:153" }, l: { name: "枯れ草", z2: "B:239" },
  i: { name: "舫いの杭（ビット。通れない）", z2: "B:130" }, 舟: { name: "倒れた舟（仮の絵：倒木。通れない）", z2: "B:164" },
  g: { name: "墓A（通れない）", z2: "B:142" }, G: { name: "墓B（通れない）", z2: "B:143" },
  O: { name: "焚き火の跡（薪。通れない）", z2: "B:170" }, p: { name: "岩A（通れない）", z2: "B:159" },
  b: { name: "樽（通れない）", z2: "B:141" }, v: { name: "桶（通れない）", z2: "B:145" }, z: { name: "壺（通れない）", z2: "B:144" },
  c: { name: "木箱（通れない）", z2: "B:181" }, t: { name: "立て札（通れない）", z2: "B:137" }, x: { name: "骸骨（通れない）", z2: "D:242" },
};
const MARSH_STAMPS = [{ at: "灯", name: "灯の柱（街灯A の下 2 マス）", tiles: [["B:16"], ["B:24"]] }];
const DUNGEON_DECO = {
  k: { name: "砂利A（通れる）", z2: "B:32" }, K: { name: "砂利B（通れる）", z2: "B:33" }, s: { name: "小さな芽（苔の芽。通れる）", z2: "B:36" },
  r: { name: "瓦礫A（通れない）", z2: "B:120" }, q: { name: "瓦礫の上の骸骨（通れない）", z2: "B:120", z3: "B:242" },
  x: { name: "骸骨A（通れない）", z2: "B:242" }, b: { name: "樽A（通れない）", z2: "B:238" }, B: { name: "樽B（廃墟。通れない）", z2: "B:239" },
  c: { name: "木箱A（通れない）", z2: "B:220" }, C: { name: "木箱C（廃墟。通れない）", z2: "B:222" }, f: { name: "積まれた木箱（通れない）", z2: "C:228" },
  Z: { name: "本棚A（通れない）", z2: "C:205" }, N: { name: "テーブル（通れない）", z2: "C:149" }, n: { name: "椅子", z2: "C:157" },
  y: { name: "粗末なベッド（通れない）", z2: "C:150" }, 1: { name: "石の柱B（下。通れない）", z2: "B:106" },
  弁: { name: "弁（バルブ。通れない）", z2: "E:50" }, 祭: { name: "祭壇（通れない）", z2: "E:170" },
};
const DUNGEON_STAMPS = [
  { at: "柱", name: "石の柱（1×2。上は☆）", tiles: [["B:98"], ["B:106"]] },
  { at: "鐘", name: "鐘（台座の上に鐘の形。仮の絵。look.md 2.2）", tiles: [["B:83"]], upper: [["E:151"]] },
];
const UNDER_DECO = {
  k: { name: "砂利A（通れる）", z2: "B:32" }, K: { name: "砂利B（通れる）", z2: "B:33" },
  s: { name: "小さな芽（苔の芽。通れる）", z2: "B:36" },
  r: { name: "瓦礫A（通れない）", z2: "B:120" }, x: { name: "骸骨A（通れない）", z2: "B:242" },
  y: { name: "むしろの寝床（外に残された人の寝床の跡）", z2: "C:151" }, g: { name: "墓A（通れない）", z2: "E:142" }, G: { name: "墓B（通れない）", z2: "E:143" },
  v: { name: "クローゼット（通れない）", z2: "C:178" }, N: { name: "テーブル（通れない）", z2: "C:149" }, n: { name: "椅子", z2: "C:157" },
  w: { name: "井戸（通れない）", z2: "E:139" }, c: { name: "木箱（通れない）", z2: "E:181" }, f: { name: "石のかまど（通れない）", z2: "E:147" },
  l: { name: "木製はしご（通れる）", z2: "B:5" },
};
const DUNGEON_CHARS = {
  "~": { name: "水路（通れない）", tiles: ["A1:14"] },
  b: { name: "石の橋（横。水路の上。通れる）", as: "~", tiles: [null, null, "B:149"] },
  B: { name: "石の橋（縦。水路の上。通れる）", as: "~", tiles: [null, null, "B:148"] },
};

// 地域の見た目（tools/maps/looks.json の lake・undercity）
const LOOK = {
  lake: { tilesetId: 15, legend: "marsh", note: "<hai_tone:-17,0,0,102>\n<hai_fog:150,0.2,0.02>", bgm: { name: "Field3", volume: 60, pitch: 100, pan: 0 }, bgs: { name: "River", volume: 40, pitch: 100, pan: 0 }, bb: ["PoisonSwamp", "PoisonSwamp"] },
  pier: { tilesetId: 15, legend: "marsh", note: "<hai_tone:-34,-17,0,68>\n<hai_fog:90,0.1,0>", bgm: { name: "Scene6", volume: 55, pitch: 100, pan: 0 }, bgs: { name: "Wave1", volume: 30, pitch: 100, pan: 0 }, bb: ["PoisonSwamp", "Ruins3"] },
  pool: { tilesetId: 15, legend: "marsh", note: "<hai_tone:-51,-34,-51,85>\n<hai_fog:70>", bgm: { name: "Dungeon1", volume: 65, pitch: 100, pan: 0 }, bgs: { name: "River", volume: 35, pitch: 100, pan: 0 }, bb: ["PoisonSwamp", "PoisonSwamp"] },
  well: { tilesetId: 22, legend: "undercity", note: "<hai_tone:-34,-43,-51,68>", bgm: { name: "Dungeon7", volume: 55, pitch: 100, pan: 0 }, bgs: { name: "Drips", volume: 30, pitch: 100, pan: 0 }, bb: ["Cobblestones3", "Town5"] },
  gate: { tilesetId: 22, legend: "undercity", note: "<hai_tone:-34,-34,-17,85>\n<hai_dark:1.5>", bgm: { name: "Dungeon7", volume: 55, pitch: 100, pan: 0 }, bgs: { name: "Darkness", volume: 35, pitch: 100, pan: 0 }, bb: ["Cobblestones3", "Town5"] },
  sewer: { tilesetId: 18, legend: "dungeon", note: "<hai_tone:-51,-34,-51,68>\n<hai_dark:5>", bgm: { name: "Dungeon7", volume: 60, pitch: 100, pan: 0 }, bgs: { name: "Waterfall1", volume: 35, pitch: 100, pan: 0 }, bb: ["Cobblestones3", "Stone2"] },
  warden: { tilesetId: 18, legend: "dungeon", note: "<hai_tone:-34,-34,-17,85>", bgm: { name: "Dungeon6", volume: 70, pitch: 100, pan: 0 }, bgs: { name: "Drips", volume: 30, pitch: 100, pan: 0 }, bb: ["Castle1", "Castle1"] },
  bell: { tilesetId: 18, legend: "dungeon", note: "<hai_tone:-68,-51,-17,68>", bgm: { name: "Scene2", volume: 55, pitch: 100, pan: 0 }, bgs: { name: "Drips", volume: 25, pitch: 100, pan: 0 }, bb: null },
};
function config(name, mapId, displayName, look, events, extra = {}) {
  const L = LOOK[look];
  return {
    file: name,
    cfg: {
      _説明: extra.about,
      mapId, name: MAP_NAMES[mapId], displayName, legend: L.legend, tilesetId: L.tilesetId,
      note: [L.note, ...(extra.note || [])].join("\n"), bgm: L.bgm, bgs: L.bgs,
      fields: L.bb ? { specifyBattleback: true, battleback1Name: L.bb[0], battleback2Name: L.bb[1] } : {},
      ...(extra.chars ? { chars: extra.chars } : {}),
      deco: extra.deco,
      stamps: (extra.stamps || []).filter(st => MAPS[name] && (MAPS[name].g.toString() + MAPS[name].d.toString()).includes(st.at)),
      events,
    },
  };
}
const CONFIGS = [];

// ---------------------------------------------------------------------------
// 霧の湖
// ---------------------------------------------------------------------------
const LAKE = 70, HOUSE = 71, PIER = 72, POOL = 73, ISLE = 74;
const SEWER = 100, SLUICE = 101, GATE = 102, WARDEN_ROOM = 103, BELL = 104, WELL = 105;
const L = POINTS.lake, H = POINTS.house, PI = POINTS.pier, PO = POINTS.pool, IS = POINTS.isle;
const S0 = POINTS.sewerUpper, S1 = POINTS.sluice, G2 = POINTS.gateFront, G3 = POINTS.gateKeeper, B4 = POINTS.bellDeep, WL = POINTS.well;
// 焼けた村の広場（061。W8 #155）
const SQUARE = { mapId: 61, x: 38, y: 32 }; // W8（#155）の広場の水路の石段 (38–39,33) の手前

// 霧の濃さ：霧の道が引いたら薄く、森の水門を開けたらもっと薄く（マップに入るたびに並列で一度だけ見る）
const fogAuto = (dens1, dens2) => ev.raw("霧の濃さ（自動）", [0, 0], [{
  priorityType: 0, trigger: 4,
  list: [
    ifSwitch(SW.waterGateOpen),
    ...plugin("Hai_MapTone", "fog", "霧の濃さを変える", { density: String(dens2) }, 1),
    close(1), ELSE(),
    ...(dens1 ? [ifSwitch(SW.fogPath, 1), ...plugin("Hai_MapTone", "fog", "霧の濃さを変える", { density: String(dens1) }, 2), close(2), ENDIF(1)] : []),
    close(1), ENDIF(),
    cmd(214, []), END,
  ],
}]);

const fogWall = (xy, i) => ev.raw(`霧の壁 ${i + 1}`, xy, [
  { image: IMG.fog, priorityType: 1, trigger: 0, stepAnime: true,
    list: [
      ...say(["白い霧が、葦の切れ目をふさいでいる。", "奥で、鈴が一つ鳴っている。"]),
      cmd(111, [10, ARMOR.smallBell, true]),
      ...choice(["小鐘を鳴らす", "やめる"], 1, [
        [se("Bell1", 0, 90, 120), cmd(230, [30]), se("Bell1", 0, 70, 120), cmd(230, [40]),
          ...plugin("Hai_MapTone", "fog", "霧の濃さを変える", { density: "90" }),
          ...say(["小鐘の音が、霧の中へ遠ざかっていく。", "鈴の音が、それを追って湖の方へ離れていった。"]),
          ...aside(ACTOR.bruno, null, say(["……鈴が、逃げました"], "ブルーノ")),
          swOn(SW.fogPath)],
        [],
      ], 1),
      close(1), ELSE(),
      ...say(["踏み込むと、鈴の音が耳のすぐ後ろで鳴った。", "足が勝手に戻っていた。"], "", 1),
      close(1), ENDIF(), END,
    ] },
  { conditions: { switch1Id: SW.fogPath, switch1Valid: true }, priorityType: 0 },
]);

const LAKE_DOCKS = [
  { label: "舟着き", stand: [L.dockBoat[0], L.dockBoat[1] - 1], boat: L.dockBoat, face: DOWN },
  { label: "小島の岸", stand: [L.isleBoat[0], L.isleBoat[1] - 1], boat: L.isleBoat, face: DOWN },
  { label: "向こう岸", stand: [L.farBoat[0], L.farBoat[1] + 1], boat: L.farBoat, face: UP },
];
CONFIGS.push(config("w9_070_mist_lake", LAKE, "霧の湖", "lake", [
  fogAuto(90, 60),
  ev.transfer("北の道（焼けた村へ）", L.exitN, [SQUARE.mapId, SQUARE.x, SQUARE.y, "up"]),
  ev.transfer("北の道（焼けた村へ）", L.exitN2, [SQUARE.mapId, SQUARE.x + 1, SQUARE.y, "up"]),
  ev.transfer("南西の板の道（湖の家へ）", L.exitS, [HOUSE, H.arriveN[0], H.arriveN[1], "down"]),
  ev.transfer("南西の板の道（湖の家へ）", L.exitS2, [HOUSE, H.arriveN2[0], H.arriveN2[1], "down"]),
  ev.warp("霧の湖の入口", [25, 6]),
  ev.text("道標", L.sign, ["傾いた道標。「湖の家　南へ」。", "下の板に、刻み足した字。「霧の出た日は、灯を見て歩け」。"], { image: { tileId: "B:137" } }),
  ev.textThen("方舟の触れ書き", L.notice, ["杭に打ち付けた板。騎士団の触れ書き。", "「方舟。札を持つ者、夕べに舟着きへ。子と、その母を先に」", "「その母を」の上に、別の墨で線が一本。"],
    aside(ACTOR.dil, "B", say(["四十人分の札で、十四人の舟か。", "記録院なら、刷った方が首だな"], "ディル")), { image: { tileId: "B:138" } }),
  ev.thought("R3-01", "札を刷った兵", L.r301, ["方舟の札は四十枚。俺が刷った。舟に乗るのは十四人、と聞いた。", "数が合わんと言ったら、酒保の姐さんは「乗せてから数える」と。", "配るのは姐さんが自分でやった。俺は札に数を書いただけだ。", "余りの札は、酒保に戻ってこなかった。"]),
  ev.text("網小屋の干し網", L.netHut, ["梁から網が下がったまま。目に、乾いた葦の切れ端が絡まっている。"]),
  ev.chest("薬草", L.netChest, ["i", ITEM.herb, 2]),
  ev.text("干したままの網", [26, 19], ["杭の間に網が張ったまま。結び目は、どれも新しく結び直してある。"]),
  ev.text("倒れた舟", [34, 11], ["底の抜けた舟が、腹を上にして転がっている。", "底板の穴は、内側から斧で割った跡。"]),
  ev.text("名の無い墓", L.graves, ["墓が四つ。墓標の代わりに、折れた櫂が一本ずつ立ててある。"]),
  ev.thought("R3-03", "霧で舟を出した漁師", L.r303, ["霧が出たら舟を出すな。じいさまの代からの決まりだ。", "霧の中で鈴が鳴ったら、目をつぶって三十を数えろ。追うな。", "おれは数えた。十二で、娘の声がした。", "櫂は、まだ握っとる。"], { clues: ["霧の奥で鈴が鳴る。目をつぶって三十を数える。追うな（霧の湖の漁師）"] }),
  ev.text("灯の祠", L.shrine, ["石の祠の中に、灯皿が三つ。どれも油の跡だけ残っている。", "皿の縁に、点が刻んである。数えると、十ずつ束ねてある。"]),
  ev.chest("霊水", L.shrineChest, ["i", ITEM.holyWater, 1]),
  ev.chest("秘薬", L.hiddenChest, ["i", ITEM.elixir, 1]),
  ev.floor("折れた葦", L.hiddenHint, ["葦の根元が、一列だけ踏み折られている。", "折れた先は、葦の壁の中へ続いている。"]),
  ev.chest("油の壺", L.chestByJaw, ["i", ITEM.oil, 2]),
  ev.pickup("薬草", L.pickup1, [], ["i", ITEM.herb, 1]),
  ev.pickup("毒消し草", L.pickup2, [], ["i", ITEM.antidote, 1]),
  ...L.fogWall.map((xy, i) => fogWall(xy, i)),
  // 霧の道の先：舟小屋と舟着き
  ev.memory(ACTOR.zelina, 2, "ゼリナ", L.zelina2, ["砦の酒保は、うち一人で回しとった。つけの取り立ても、うちや。", "銀貨は壺に。三年で壺が三つ。舟が一艘。網元は半値にしてくれた。", "「方舟」て名は、兵隊が勝手に付けた。うちは舟、としか呼ばへんかった。", "壺は、まだ一つ余っとる。"]),
  ev.pickup("方舟の乗船名簿", L.ledgerArk, ["舟小屋の棚に、紙の綴りが一冊。名前と歳が並んでいる。"], ["i", ITEM.arkList, 1], { image: { tileId: "E:177" } }),
  ev.chest("砦の名札", L.boatHouseChest, ["i", ITEM.nameTag, 1]),
  ev.pickup("鉄くず", L.pickup3, [], ["g", 0, 60]),
  ev.memory(ACTOR.zelina, 3, "ゼリナ", L.zelina3, ["舟は十四人で、もう縁まで沈んどった。大人が一人乗ったら、真ん中で沈む。", "うちが袖を引いて、降ろした。母親も、爺さんも。籠だけ受け取って。", "降ろした顔は全部覚えとる。数えたら、二十六。", "札の余りと、同じ数や。"]),
  ev.thought("R3-02", "舟から降ろされた男", L.r302, ["籠を担いで舟に乗った。酒保の女が、籠だけ受け取って、俺を降ろした。", "子どもが十四。大人は漕ぎ手の二人だけだと。", "籠には、俺の娘の靴が入っていた。娘は乗っていた。", "岸で数えた。灯が見えなくなるまでに、三十を九回。"], {
    after: aside(ACTOR.dil, "B", say(["九回。二百七十。舟が遅いのか、目がいいのか"], "ディル")),
  }),
  dock(["舟着きの杭（舟を出す）", "小島の岸の杭（舟を出す）", "向こう岸の杭（舟を出す）"][0], LAKE, LAKE_DOCKS, 0),
  // 小島の岸と向こう岸（舟でだけ）
  dock(["舟着きの杭（舟を出す）", "小島の岸の杭（舟を出す）", "向こう岸の杭（舟を出す）"][1], LAKE, LAKE_DOCKS, 1),
  ev.transfer("小島の石段（小島へ）", L.isleGate, [ISLE, IS.arrive[0], IS.arrive[1], "up"]),
  dock(["舟着きの杭（舟を出す）", "小島の岸の杭（舟を出す）", "向こう岸の杭（舟を出す）"][2], LAKE, LAKE_DOCKS, 2),
  ev.thought("R3-04", "舟を漕いだ兵", L.r304, ["子どもを十四、向こう岸に下ろした。数えて、数え直して、十四。", "東へ歩け、と言った。森の外を回れば、人の村に出る。", "舟を戻して大人を乗せるつもりで、櫂を取った。霧が来た。", "杭に、十四と刻んだ。それから、舟を出していない。"]),
  ev.textThen("刻みの杭", [L.farPost[0], L.farPost[1] + 1], ["杭に、刃物の刻みが十四。子どもの背の高さに揃えて刻んである。", "いちばん下の刻みの横に、小さな字で「ついた」。"],
    aside(ACTOR.zelina, "B", say(["人の村て、どこや"], "ゼリナ"))),
  ev.text("焚き火の跡", [L.farFire[0] - 1, L.farFire[1]], ["石を組んだ焚き火の跡。周りの土に、小さな足跡がいくつも。", "足跡は、東の葦の切れ目へ向かっている。"]),
  ev.chest("霊水", L.farChest, ["i", ITEM.holyWater, 2]),
  // 敵（7 章の型）
  ev.enemy("沼蛭", [12, 36], TROOP.leeches, "green", { kind: "群れ", image: IMG.monster(3), chase: 3 }),
  ev.enemy("沼蛭", [15, 34], TROOP.leeches, "green", { kind: "群れ", image: IMG.monster(3), chase: 3 }),
  ev.enemy("沼蛭", [9, 41], TROOP.leeches, "green", { kind: "群れ", image: IMG.monster(3), chase: 3 }),
  ev.enemy("葦の影", [36, 12], TROOP.reedShade, "green", { image: IMG.monster(5) }),
  ev.enemy("葦の影", [44, 4], TROOP.reedShade, "green", { image: IMG.monster(5) }),
  ev.enemy("霧の羊", [16, 21], TROOP.fogSheep, "yellow", { kind: "追ってくる", image: IMG.monster(6), chase: 5, speed: 2 }),
  ev.enemy("霧の羊", [6, 50], TROOP.fogSheep, "yellow", { kind: "追ってくる", image: IMG.monster(6), chase: 5, speed: 2 }),
  ev.enemy("沈み人", [58, 10], TROOP.drowned, "yellow", { image: IMG.monster(7) }),
  ev.enemy("大顎", L.redJaw, TROOP.bigJaw, "red", { kind: "宝の番", image: IMG.monster(1), moveType: 0, chase: 3 }),
  ev.enemy("沈み人", [72, 49], TROOP.drowned, "yellow", { image: IMG.monster(7) }),
], {
  about: "W9（#157）：霧の湖・葦原（world.md 5.1・5.2・6.4 ゼリナ 2・3・2.2 方舟）。北→061、南西の板の道→071。北東は霧の道（小鐘）の先の舟小屋と舟着き。櫂があれば舟着き・小島の岸・向こう岸の杭から舟を出せる（MZ の小型船）。小島の石段→074。",
  deco: MARSH_DECO, stamps: MARSH_STAMPS,
}));

// ---------------------------------------------------------------------------
// 071 湖の家（ミルレーネ）
// ---------------------------------------------------------------------------
const MIR = "ミルレーネ";
const mirleneTalk = [
  // 初めて会う
  ifSwitch(FLAG.metMirlene, 0, false),
  ...say(["あら。灯を見て来たのね。この霧で、ここまで歩いて来る人は久しぶりだわ"], MIR, 1),
  ...say(["わたしはミルレーネ。この灯を、毎晩ともしているの"], MIR, 1),
  ...say(["あなたの来た道は、聞かないでおくわ。わたしにも、聞かれたくないことがあるもの"], MIR, 1),
  swOn(FLAG.metMirlene, 1),
  ...say(["ひとつ、頼まれてくれるかしら"], MIR, 1),
  ...say(["湖の東の小島に、森の水門があるの。門の前に、置いていかれた人たちがいるはずなの", "わたしは灯を離れられないの。舟があれば、あなたなら行けるでしょう？"], MIR, 1),
  swOn(SW.askedOutsiders, 1),
  ...errand({ key: "outsiders", title: "外に残された者", who: MIR, stage: "1", text: "湖の東の小島、森の水門の前に置いていかれた人たちを探す（湖の家）", variableId: String(FLAG.outsidersErrand) }, 1),
  cmd(115, [], 1),
  close(1), ENDIF(),
  // 水門のことを伝える
  ifSwitch(SW.toldMirlene, 0, false),
  ifSwitch(SW.waterGateOpen, 1),
  ...say(["門が、開いたのね。今夜は霧が薄いもの"], MIR, 2),
  ...say(["あの人たちは、門のこちら側で待っていたの。わたしたちは、知っていて黙った", "ありがとう。今夜の点の横に、門の絵を一つ、開けて描いておくわ"], MIR, 2),
  swOn(SW.toldMirlene, 2),
  ...errandEnd({ key: "outsiders", result: "done", text: "森の水門を開けた。ミルレーネに伝えた（湖の家）" }, 2),
  cmd(115, [], 2),
  close(2), ENDIF(1),
  ifSwitch(SW.waterGateShut, 1),
  ...say(["そう。開けなかったのね"], MIR, 2),
  ...say(["いいの。帳面に一行、書いておくわ。今夜の点の横に"], MIR, 2),
  swOn(SW.toldMirlene, 2),
  ...errandEnd({ key: "outsiders", result: "done", text: "森の水門は開けなかった。ミルレーネは帳面に一行足した（湖の家）" }, 2),
  cmd(115, [], 2),
  close(2), ENDIF(1),
  close(1), ENDIF(),
  // いつもの（W17：水門のことを伝えたあと、鐘が三つ鳴るまでは頭に一言）
  ifSwitch(SW.toldMirlene),
  ifVar(FLAG.bellCount, 3, 4, 1),
  ...say(["鐘が三つ鳴ったら、灯を頼める人を探すわ。", "それまでは、ここにいるの"], MIR, 2),
  close(2), ENDIF(1),
  close(1), ENDIF(),
  ...say(["なにか、聞きたいことがあるの？"], MIR),
  ...choice(["歌を聞く", "灯のこと", "やめる"], 2, [
    [...say(["昔の歌よ。人に聞かせるのは、ずいぶん久しぶり"], MIR),
      se("Sound2", 0, 60, 80),
      cmd(101, ["", 0, 1, 1, ""]), ...["ひとつ　鐘は鳴る　ひとの戸口に", "ふたつ　鳴るかぎり　夜は越えぬ", "よっつ　戸を内より　ひらくときは", "　　　　この歌も　とどかぬ"].map(t => cmd(401, [t])),
      ...say(["みっつめは、歌わないことにしているの。", "人が約束を破って、鐘が黙った、という節よ"], MIR),
      ...addNote("song:mirlene", "取り決めの歌「戸を内より　ひらくときは　この歌も　とどかぬ」（湖の家）"),
      ifSwitch(FLAG.prisonBell), // 営倉の鐘が鳴っているとき
      ...shift(aside(ACTOR.bruno, "B", [
        ...say(["……三つ目は、何と言うんです"], "ブルーノ"),
        ...say(["歌わないことにしているの"], MIR),
        ...say(["営倉の九番の房の錠に、傷が無かったです"], "ブルーノ"),
      ]), 1),
      close(1), ENDIF()],
    [...say(["湖を渡る人が迷わないように、と言いつけられたの。やめる理由が、まだ無いの"], MIR),
      ...say(["一晩も欠かしていないわ。帳面は七十三冊目", "一冊目の日付は、聞かないでちょうだい"], MIR)],
    [],
  ]),
  END,
];

CONFIGS.push(config("w9_071_lake_house", HOUSE, "湖の家", "lake", [
  fogAuto(90, 60),
  ev.transfer("北の板の道（葦原へ）", H.exitN, [LAKE, L.arriveS[0], L.arriveS[1] - 1, "up"]),
  ev.transfer("北の板の道（葦原へ）", H.exitN2, [LAKE, L.arriveS[0] + 1, L.arriveS[1] - 1, "up"]),
  ev.transfer("南西の岸の道（淵へ）", H.exitSW, [POOL, PO.arrive[0], PO.arrive[1], "down"]),
  ev.transfer("南西の岸の道（淵へ）", H.exitSW2, [POOL, PO.arrive2[0], PO.arrive2[1], "down"]),
  ev.transfer("南東の板の道（沈んだ桟橋へ）", H.exitSE, [PIER, PI.arrive[0], PI.arrive[1], "down"]),
  ev.transfer("南東の板の道（沈んだ桟橋へ）", H.exitSE2, [PIER, PI.arrive[0], PI.arrive[1], "down"]),
  // W28（#302）：砦に来たら（1152「ミルレーネが砦にいる」。以後は砦の炉の脇と頂。後日も）湖の家にはいない
  ev.raw("ミルレーネ", H.mirlene, [
    { image: { ...IMG.mirlene, direction: LEFT }, priorityType: 1, list: mirleneTalk },
    { conditions: { switch1Id: FLAG.mirleneFort, switch1Valid: true }, priorityType: 0 },
  ]),
  ev.text("湖の灯", H.lamp, ["柱の上の皿に、灯がともっている。油は足したばかり。", "芯は短く切りそろえてある。"]),
  ev.pickup("湖の灯の帳面", H.ledger, ["机の上に、厚い帳面が開いてある。一晩に一つずつ、点が打ってある。"], ["i", ITEM.lampLedger, 1], {
    image: { tileId: "E:177" },
    after: [...say(["持っていっていいわ。同じ帳面が、棚にあと七十二冊あるの"], MIR)],
  }),
  ev.text("寝台", H.bed, ["寝台は使った跡が少ない。枕元の板に、閉じた門の絵が彫ってある。"]),
  ev.text("崩れた勘定台", H.counter, ["崩れた勘定台。天板に、銀貨を数えた刻みが並んでいる。"]),
  ev.memory(ACTOR.zelina, 1, "ゼリナ", H.zelina1, ["うちの家は、この湖で商いをしとった。網と塩と、ちょっとの酒。", "十五で初めて一人で船荷を仕入れた。開けたら、中身は全部ただの石や。", "笑われたわ。その晩、勘定台の天板に、損した額を爪で刻んだ。", "それから勘定は、誰にも任せへん。刻みは、まだ天板にある。"]),
  ev.chest("毒消し草", H.westChest, ["i", ITEM.antidote, 2]),
  ev.thought("R3-05", "舟を譲った網元", H.r305, ["舟は一艘、半値で譲った。酒保の娘は、値切らなかった。", "二艘目はわしが組むはずだった。頼んだ木は二十本。届いたのは六本。", "六本では底しか張れん。娘は、底板だけでも乗せる、と言った。", "木は六本とも、小屋の梁に上げたままだ。"]),
  ev.chest("鉄くず", H.eastChest, ["g", 0, 120]),
  ev.text("葦の束", H.swHut, ["床に、刈った葦の束が積んである。半分は黒く焦げている。"]),
  ev.thought("R3-06", "葦刈りの女", H.r306, ["刈った葦には、その日のうちに火を入れる。焦げた跡には、主は上がってこん。", "去年は火が足りなかった。刈り跡の手前で、弟の鎌だけ拾った。"], { clues: ["淵の主は、焦げた葦の刈り跡に上がってこない。刈ったらすぐ火を入れる（湖の家の葦刈り）"] }),
  ev.text("葦の刈り跡", H.reedCut, ["葦の刈り跡。切り口が黒く焦げている。"]),
  ev.text("木箱", H.seCrate, ["木箱の中に、乾いた灯芯が束で。数えると、三百を超える。"]),
  ev.chest("灯守の肩掛け", H.hiddenChest, ["a", ARMOR.shawl, 1], true),
  ev.pickup("薬草", H.pickup, [], ["i", ITEM.herb, 1]),
  ev.enemy("沼蛭", [21, 26], TROOP.leeches, "green", { kind: "群れ", image: IMG.monster(3), chase: 3 }),
  ev.enemy("沼蛭", [27, 28], TROOP.leeches, "green", { kind: "群れ", image: IMG.monster(3), chase: 3 }),
  ev.enemy("葦の影", [8, 11], TROOP.reedShade, "green", { image: IMG.monster(5) }),
  ev.enemy("沈み人", [40, 11], TROOP.drowned, "yellow", { image: IMG.monster(7) }),
  ev.enemy("霧の羊", [38, 28], TROOP.fogSheep, "yellow", { kind: "往復", image: IMG.monster(6), chase: 4, speed: 2 }),
], {
  about: "W9（#157）：湖の家（world.md 6.8 ミルレーネ・7.3 外に残された者・6.4 ゼリナ 1・8.3 湖の灯の帳面）。北→070、南西の岸→073、南東の板の道→072。南東の家の跡の隠し扉の奥に赤い宝箱。",
  deco: MARSH_DECO, stamps: MARSH_STAMPS,
}));

// ---------------------------------------------------------------------------
// 072 沈んだ桟橋（ゼリナの遺骸・櫂）
// ---------------------------------------------------------------------------
CONFIGS.push(config("w9_072_sunken_pier", PIER, "沈んだ桟橋", "pier", [
  ev.transfer("北の板の道（湖の家へ）", PI.exitN, [HOUSE, H.arriveSE[0], H.arriveSE[1], "up"]),
  ev.raw("遺骸 ゼリナ", PI.remains, [
    { image: IMG.zelina, priorityType: 1, list: [
      ...say(["桟橋の端に、女が一人、湖の方を向いて座っている。", "前掛けの紐に、鍵と算盤の珠が一つ下がっている。"]),
      ...say(["灯が、まだ見える。舳先に一つ、艫に一つ。", "子どもの数を数えとるつもりで、灯の数を数えとった。", "十四。……十四。", "見えへんようになった。もう一回、最初から数えよか。"]),
      END,
    ] },
    { conditions: { selfSwitchCh: "A", selfSwitchValid: true }, priorityType: 0 },
  ], `<hai_remains:${ACTOR.zelina}><hai_memory:${ACTOR.zelina},4>`),
  ev.pickup("櫂", PI.oar, ["遺骸の脇に、櫂が一本。柄に焼き印で「方舟」。"], ["i", ITEM.oar, 1], {
    after: [swOn(SW.oar), ...say(["これがあれば、湖の舟着きから舟を出せる。"])],
  }),
  ev.text("切れた舫い綱", PI.rope, ["杭に残った舫い綱。切り口は、まっすぐだ。"]),
  ev.thought("R3-07", "酒保の手伝いの兵", PI.r307, ["舟が出たあと、姐さんは桟橋に座って動かなかった。", "砦に戻ろうと言ったら、つけの帳面を投げてよこした。「あんたが取り立てや」と。", "帳面は舟小屋の奥、壁の中に隠した。表紙の字は、姐さんのだ。"], { clues: ["酒保のつけ帳は、舟小屋の奥の壁の中（沈んだ桟橋）"] }),
  ev.text("樽", PI.crate, ["樽の中に、塩漬けの魚の骨。蓋に「酒保　湖の家より」。"]),
  ev.pickup("酒保のつけ帳", PI.ledgerTab, ["壁の中の棚に、帳面が一冊。表紙に「つけ」。"], ["i", ITEM.tab, 1], {
    image: { tileId: "E:177" },
    after: aside(ACTOR.dil, null, say(["名の欄が空いてる。書き忘れか、書きたくなかったか。", "二百年ぶんで銀三枚なら、安い客だ"], "ディル")),
  }),
  ev.chest("霊水", PI.hiddenChest, ["i", ITEM.holyWater, 1]),
  ev.text("舟小屋の勘定台", PI.booth, ["小さな勘定台。釘に、空の銭袋が下がっている。"]),
  ev.enemy("沼蛭", [12, 9], TROOP.leeches, "green", { image: IMG.monster(3), chase: 3 }),
], {
  about: "W9（#157）：沈んだ桟橋（前の世界の沈んだ舞台の形。world.md 6.3 ゼリナの遺骸・6.4 ゼリナ 4・3.2 酒保のつけ帳）。北→071。遺骸の脇に櫂（舟が使える）。東の舟小屋の隠し扉の奥につけ帳。",
  deco: MARSH_DECO, stamps: MARSH_STAMPS,
}));

// ---------------------------------------------------------------------------
// 073 湖の淵（ボス 沼主・排水口→100）
// ---------------------------------------------------------------------------
const toSewerLadder = [SEWER, S0.arriveLadder[0], S0.arriveLadder[1], DOWN];
CONFIGS.push(config("w9_073_lake_pool", POOL, "湖の淵", "pool", [
  ev.transfer("北の道（湖の家へ）", PO.exitN, [HOUSE, H.arriveSW[0], H.arriveSW[1], "up"]),
  ev.transfer("北の道（湖の家へ）", PO.exitN2, [HOUSE, H.arriveSW2[0], H.arriveSW2[1], "up"]),
  ev.warp("湖の淵の手前", PO.warp),
  ev.thought("R3-08", "火打ち石の子", PO.r308, ["姉ちゃんが刈って、おれが火をつける番だった。", "火打ち石が、しめってた。三回うっても、つかなかった。", "刈り跡の手前で、足をつかまれた。鎌は、おとした。", "石は、まだにぎってる。"], {
    after: aside(ACTOR.zelina, "B", say(["坊ん。火は、うちがつけたる"], "ゼリナ")),
  }),
  ev.text("焦げた刈り跡", PO.reedCut, ["淵の縁の葦が刈られている。切り口は焦げて、まだ青い。", "焦げた所だけ、泥に這った跡が無い。"]),
  ev.raw("沼主", PO.boss, [
    { image: IMG.marshLord, priorityType: 1, list: [
      ...say(["淵の水が、ゆっくり盛り上がった。", "葦の根を体じゅうに絡ませたものが、岸の方を向いた。"]),
      ...plugin("Hai_Boss", "bossBattle", "ボス戦", { troopId: String(TROOP.marshLord), escapeMapId: String(HOUSE), escapeX: String(H.arriveSW[0]), escapeY: String(H.arriveSW[1]), escapeDirection: "8" }),
      ifScript("Hai.Boss.lastResult() === 0"),
      ...say(["主は葦の根に絡まったまま、淵の底へ沈んでいった。", "水が、底の口へ吸い込まれていく。"], "", 1),
      se("Water1", 1),
      ...gainLines("a", ARMOR.scale, 1, 1),
      close(1), ENDIF(), END,
    ] },
    // 倒したあとは、淵の底に開いた排水口（梯子で 100 へ）
    { conditions: { switch1Id: SW.marshLord, switch1Valid: true }, image: { tileId: "B:44" }, priorityType: 1,
      list: [...say(["水の引いた淵の底に、石を組んだ口が開いている。梯子が下へ続いている。"]),
        ...choice(["下りる", "やめる"], 1, [[se("Move1"), transferCmd(...toSewerLadder)], []]), END] },
  ], "<hai_w9:倒したあとは 2 ページ目が淵の底の排水口（100 へ）>"),
  ...PO.bed.slice(1).map(([x, y], i) => ev.raw(`引いた淵の底 ${i + 2}`, [x, y], [
    { priorityType: 0 },
    { conditions: { switch1Id: SW.marshLord, switch1Valid: true }, image: { tileId: "D:32" }, priorityType: 0 },
  ])),
], {
  about: "W9（#157）：湖の淵（前の世界の沼主の淵の形。world.md 5.5 ボス 沼主・弱みの手がかりは葦の刈り跡）。北→071。沼主を倒すと（スイッチ 503）淵の水が引き、底の排水口→100。",
  deco: MARSH_DECO, stamps: MARSH_STAMPS,
}));

// ---------------------------------------------------------------------------
// 074 小島（森の水門・外に残された者・赤い宝箱）
// ---------------------------------------------------------------------------
const outsiderAfter = [
  ifSwitch(SW.askedOutsiders),
  ...errand({ key: "outsiders", stage: "2", text: "小島の森の水門の前で、置いていかれた人たちの思念を見つけた。水門をどうするか（小島）" }, 1),
  close(1), ENDIF(),
];
CONFIGS.push(config("w9_074_isle", ISLE, "小島", "lake", [
  fogAuto(90, 60),
  ev.transfer("南の石段（葦原へ）", IS.exitS, [LAKE, L.isleGate[0], L.isleGate[1] + 1, "down"]),
  ev.transfer("南の石段（葦原へ）", IS.exitS2, [LAKE, L.isleGate[0], L.isleGate[1] + 1, "down"]),
  ev.raw("森の水門", IS.gate, [
    { image: IMG.gate, priorityType: 1, list: [
      ...say(["苔に覆われた石の門。扉の継ぎ目に、木の根が入りこんでいる。", "門の表に、細い字が三行。読めない。"]),
      ifSwitch(SW.askedOutsiders),
      ...choice(["根を外して門を開ける", "開けない"], 1, [
        [se("Door4"), ...say(["根を一本ずつ外した。扉が、内へ半分だけ開いた。", "門の向こうから、乾いた葉の匂いの風が来る。"]),
          ...plugin("Hai_MapTone", "fog", "霧の濃さを変える", { density: "60" }),
          swOn(SW.waterGateOpen), selfOn(),
          ...errand({ key: "outsiders", stage: "3", text: "森の水門を開けた。ミルレーネに伝える（小島）" })],
        [...say(["門には触らずにおいた。"]), swOn(SW.waterGateShut), selfOn(),
          ...errand({ key: "outsiders", stage: "3", text: "森の水門は開けなかった。ミルレーネに伝える（小島）" })],
      ], 1),
      close(1), ENDIF(), END,
    ] },
    { conditions: { selfSwitchCh: "A", selfSwitchValid: true }, image: IMG.gate, priorityType: 1, list: [
      ifSwitch(SW.waterGateOpen),
      ...say(["半分開いた門の向こうは、暗い木の間。風が通る。"], "", 1),
      close(1), ELSE(),
      ...say(["苔に覆われた石の門。根は、そのままにしてある。"], "", 1),
      close(1), ENDIF(), END,
    ] },
  ]),
  ev.block("森の水門（右）", IS.gate2),
  ev.thought("R3-09", "門のこちらに残された母", IS.elf1, ["門は、歌が三つめの節に入ると同時に閉じました。わたしは、こちら側でした。", "内から、歌が聞こえておりました。三晩。娘の声も、その中にありました。", "四晩めに、わたしは同じ節を歌い返したのです。一度だけ。", "門は、根の一本ぶんも動きませんでした。"], { after: outsiderAfter }),
  ev.thought("R3-10", "人の村に嫁いだ調律師の妹", IS.elf2, ["調律師は皆、呼び戻されました。人には告げるな、と。", "わたしは人の村に嫁いでおりましたので、呼ばれませんでした。", "夫が門まで送ってくれたのです。門の前で待て、と言うて、村へ帰りました。", "村の方角に、灯が一つ、二つ。七つめで、数えるのをやめました。"], { after: outsiderAfter }),
  ev.thought("R3-11", "歌を間違えた老人", IS.elf3, ["歌を知る者だけが、門を通れるのです。", "わしは三つめの節を、六十年、間違えて覚えておりました。", "門の前で一晩じゅう、歌い直しました。杖に一回ずつ刻みを。", "刻みは四十七。喉は、そこで止まりました。"], {
    after: [...outsiderAfter, ...aside(ACTOR.zelina, "B", say(["……乗せる方も降ろす方も、数えるんやな"], "ゼリナ"))],
  }),
  ev.text("苔むした石", IS.stone, ["平たい石に、点が刻んである。十ずつ束ねて、七つ。"]),
  ev.floor("踏み分け", IS.hint, ["茂みの根元が、一か所だけ踏み分けてある。"]),
  ev.chest("水門守の弓", IS.redChest, ["w", WEAPON.gateBow, 1], true),
  ev.pickup("霊水", IS.pickup, [], ["i", ITEM.holyWater, 1]),
  ev.enemy("葦の影", [8, 15], TROOP.reedShade, "green", { image: IMG.monster(5) }),
  ev.enemy("霧の羊", [20, 13], TROOP.fogSheep, "yellow", { image: IMG.monster(6), chase: 4, speed: 2 }),
], {
  about: "W9（#157）：小島（world.md 2.2 森を閉じる・6.8・7.3 外に残された者）。070 の小島の石段から。閉じた森の水門（ミルレーネの頼みで開ける／開けない）、外に残されたエルフの思念 3 つ、茂みの見えない通路の先の赤い宝箱。",
  deco: MARSH_DECO, stamps: MARSH_STAMPS,
}));

// ---------------------------------------------------------------------------
// 100 地下水道・上流
// ---------------------------------------------------------------------------
// W17：R3-14 と R3-17 の両方を読んだとき（二つ目を初めて読んだとき）のゼリナの一言
const zelinaQueue = other => [
  cmd(111, [2, "A", 1]),
  ifScript(`Hai.Thoughts.isRead("${other}")`, 1),
  ...shift(aside(ACTOR.zelina, null, say(["千枚と聞いて、千四百並んだんやろ。", "……うちと同じや。数えてから、乗せたらよかった"], "ゼリナ")), 2),
  close(2), ENDIF(1),
  close(1), ENDIF(),
];
const WARDEN_POST = { mapId: 35, x: 3, y: 8 }; // 営倉の牢番の詰め所（W7）の西の扉の内側
const FOUNDRY = { mapId: 91, x: 52, y: 37 }; // 鋳物場・型の間（W10 #156）の廃水の管 (52,38) の前
const lanternAuto = ev.raw("角灯の明かり（自動）", [0, 0], [{
  priorityType: 0, trigger: 4,
  list: [ifItem(ITEM.lantern), ...plugin("Hai_MapTone", "dark", "暗がりの半径を変える", { radius: "5" }, 1), close(1), ENDIF(), cmd(214, []), END],
}]);
CONFIGS.push(config("w9_100_sewer_upper", SEWER, "地下水道", "sewer", [
  ev.raw("梯子（淵へ）", S0.ladder, [
    { image: { tileId: "B:5" }, priorityType: 1, list: [...say(["梯子の上から、水が滴っている。上の口は、水で塞がっている。"]), END] },
    { conditions: { switch1Id: SW.marshLord, switch1Valid: true }, image: { tileId: "B:5" }, priorityType: 1,
      list: [se("Move1"), transferCmd(POOL, PO.landing[0], PO.landing[1], DOWN), END] },
  ]),
  ev.transfer("石段（営倉の牢番の詰め所へ）", S0.stairs, [WARDEN_POST.mapId, WARDEN_POST.x, WARDEN_POST.y, "right"], { image: { tileId: "B:2" } }),
  ev.warp("地下水道の入口", S0.warp),
  ev.transfer("東の歩き場（水門へ）", S0.exitE, [SLUICE, S1.arriveW[0], S1.arriveW[1], "right"]),
  ev.transfer("東の歩き場（水門へ）", S0.exitE2, [SLUICE, S1.arriveW2[0], S1.arriveW2[1], "right"]),
  ev.text("上流の祭壇", S0.altar, ["苔むした小さな祭壇。燭台が四つ、蝋は無い。", "祭壇の脇に、譜面が一枚。酒の染みがある。"]),
  ev.memory(ACTOR.anselmo, 1, "アンセルモ", S0.anselmo1, ["わしの喉は、聖歌隊でいちばんと言われた。酒の量も、いちばんじゃった。", "祭の朝、聖歌の三番で、しゃっくりが出た。「主よ、ひっく、憐れみを」。", "その日のうちに追い出された。司教さまの顔は、祭壇の蝋より白かったのう。", "ここで一人、三番だけ歌い直した。蝋は四本、使い切った。"]),
  ev.pickup("王の布告", S0.decree, ["壁から剥がれかけた板。王家の印の焼き印。上の半分だけ読める。", "「布告。アルメリアの王の名において。民を地下に守る。扉は日没に閉じる」", "「札を持つ者から順に。札の無い者は、次の日没を待て」", "下の半分は、内側から削られている。削った跡に、爪の跡。"], ["i", ITEM.decree, 1], {
    image: { tileId: "D:91" },
    after: addNote("clue:decree", "王の布告「扉は日没に閉じる。札の無い者は、次の日没を待て」。下の半分は内側から削られている（地下水道・上流）"),
  }),
  ev.thought("R3-12", "札を分けた母", S0.r312, ["札は三枚。うちは四人。", "いちばん下の子を、隣の家の札に入れてもらった。名前は、その家の子の名に変えて。", "あの子は内で、その家の名で呼ばれている。それでいい。", "三枚の札に、あたしの名は無い。"]),
  ev.thought("R3-13", "水番", S0.r310, ["水門は二つで一つだ。上流の弁と下流の弁、両方回して、池の水が落ちる。", "片方だけでは、水は唸るだけだ。", "相棒は、扉が閉まる日に内へ入った。俺は上流の弁の前で、相棒の分を待った。", "弁は、まだ半分しか回っていない。"], { clues: ["水門の上流の弁と下流の弁を両方回すと、池の水が落ちる（地下水道の水番）"] }),
  ev.chest("薬草", S0.storeChest, ["i", ITEM.herb, 2]),
  ev.floor("苔の床", S0.hint, ["倉の西の壁ぎわだけ、床に苔が厚い。壁の継ぎ目から、風が来る。"]),
  ev.chest("鉄くず", S0.hiddenChest, ["g", 0, 150]),
  // 舫いの杭（櫂で南の洞へ）
  ev.raw("舫いの杭（南の洞へ）", S0.mooring, [{ priorityType: 1, image: { tileId: "B:130" }, list: [
    ifItem(ITEM.oar),
    ...say(["杭に、底の浅い小舟が繋いである。水路は南へ下っている。"], "", 1),
    ...choice(["小舟で下る", "やめる"], 1, [[se("Move1"), transferCmd(SEWER, S0.landing[0], S0.landing[1], DOWN)], []], 1),
    close(1), ELSE(),
    ...say(["杭に、底の浅い小舟が繋いである。漕ぐ物が無い。"], "", 1),
    close(1), ENDIF(), END,
  ] }]),
  ev.raw("舫いの杭（戻る）", S0.grottoBack, [{ priorityType: 1, image: { tileId: "B:130" }, list: [
    ...choice(["小舟で戻る", "やめる"], 1, [[se("Move1"), transferCmd(SEWER, S0.mooring[0] - 1, S0.mooring[1], UP)], []]), END,
  ] }]),
  ev.chest("鎖の香炉", S0.grottoChest, ["w", WEAPON.censer, 1], true),
  ev.text("洞の壁", [20, 27], ["洞の壁に、水の跡の線が何本も。いちばん上の線は、天井に近い。"]),
  // 水が引くまで沈んでいる水門番の小屋
  ...S0.flood.map((xy, i) => flood(`沈んだ戸口 ${i + 1}`, xy, ["水が胸まで来ている。流れが速くて進めない。"])),
  ev.thought("R3-14", "水を戻した水番", S0.r311, ["札は千枚と聞いた。列は三日。数えた頭は、千と四百。", "四百は、札の無い者だ。並ぶなとは、誰も言わなかった。", "三日めの夕方、扉の方で太鼓が鳴った。閉める合図だ。水を戻せ、と。", "戻した。輪を三十回。下の道には、まだ列の尻尾がいた。"], {
    after: zelinaQueue("R3-17"),
  }),
  ev.chest("油の壺", S0.keeperChest, ["i", ITEM.oil, 2]),
  ev.pickup("苦い根", S0.pickup1, [], ["i", ITEM.bitterRoot, 1]),
  ev.pickup("薬草", S0.pickup2, [], ["i", ITEM.herb, 1]),
  ev.enemy("溝鼠", [8, 16], TROOP.rats, "green", { kind: "群れ", image: IMG.monster(2), chase: 3 }),
  ev.enemy("溝鼠", [16, 20], TROOP.rats, "green", { kind: "群れ", image: IMG.monster(2), chase: 3 }),
  ev.enemy("白い蛭", [6, 28], TROOP.whiteLeech, "green", { image: IMG.monster(3) }),
  ev.enemy("白い蛭", [22, 7], TROOP.whiteLeech, "green", { image: IMG.monster(3) }),
  ev.enemy("扉の外の者", [34, 15], TROOP.outsider, "yellow", { kind: "往復", image: IMG.monster(4), chase: 4 }),
  ev.enemy("扉の外の者", [30, 34], TROOP.outsider, "yellow", { image: IMG.monster(4), chase: 4 }),
  ev.enemy("水番の亡骸", [44, 29], TROOP.keeper, "yellow", { image: IMG.monster(0), chase: 3 }),
], {
  about: "W9（#157）：地下水道・上流（world.md 5.2・2.2 地下への避難・6.4 アンセルモ 1・8.3 王の布告）。西の梯子→073（沼主を倒すと上れる）、北東の石段→035、東→101。舫いの杭（櫂）→南の洞の赤い宝箱。南の水門番の小屋は 101 の弁で水が引くと入れる。",
  chars: DUNGEON_CHARS, deco: DUNGEON_DECO, stamps: DUNGEON_STAMPS,
}));

// ---------------------------------------------------------------------------
// 101 地下水道・水門
// ---------------------------------------------------------------------------
const valve = (name, xy, mine, other) => ev.raw(name, xy, [
  { priorityType: 1, list: [
    ...say(["壁から突き出た鉄の弁。輪の取っ手に、錆の筋。"]),
    ...choice(["回す", "やめる"], 1, [
      [se("Switch2"), cmd(230, [20]), se("Switch2"), swOn(mine),
        ifSwitch(other),
        se("Water2", 1), cmd(225, [3, 5, 30, false], 1),
        ...say(["もう一つの弁と合わさって、池の底で何かが外れる音がした。", "水が、低い音を立てて落ちていく。"], "", 1),
        swOn(SW.drained, 1),
        close(1), ELSE(),
        ...say(["弁が止まるまで回した。池の底で、水が唸っている。"], "", 1),
        close(1), ENDIF()],
      [],
    ]),
    END,
  ] },
  { conditions: { switch1Id: mine, switch1Valid: true }, priorityType: 1, list: [...say(["弁は、止まるまで回してある。"]), END] },
]);
CONFIGS.push(config("w9_101_sluice", SLUICE, "地下水道・水門", "sewer", [
  ev.transfer("西の口（上流へ）", S1.exitW, [SEWER, S0.arriveE[0], S0.arriveE[1], "left"]),
  ev.transfer("西の口（上流へ）", S1.exitW2, [SEWER, S0.arriveE2[0], S0.arriveE2[1], "left"]),
  ev.transfer("北東の口（井戸の縦穴へ）", S1.exitN, [WELL, WL.arriveS[0], WL.arriveS[1], "up"]),
  ev.transfer("北東の口（井戸の縦穴へ）", S1.exitN2, [WELL, WL.arriveS2[0], WL.arriveS2[1], "up"]),
  ev.transfer("南の廊下（閉じた扉の前へ）", S1.exitS, [GATE, G2.arriveN[0], G2.arriveN[1], "down"]),
  ev.transfer("南の廊下（閉じた扉の前へ）", S1.exitS2, [GATE, G2.arriveN2[0], G2.arriveN2[1], "down"]),
  valve("上流の弁", S1.valveUp, SW.valveUp, SW.valveDown),
  valve("下流の弁", S1.valveDown, SW.valveDown, SW.valveUp),
  ...S1.flood.map((xy, i) => flood(`沈んだ廊下 ${i + 1}`, xy, ["廊下が、天井近くまで水に沈んでいる。", "水は、真ん中の池の方から押してくる。"])),
  ev.text("札場の机", S1.desk, ["長い机に、札の束を数えた跡。札入れの箱は、三つとも空。"]),
  ev.memory(ACTOR.anselmo, 2, "アンセルモ", S1.anselmo2, ["王国の司祭として、地下へ下る列の世話を言いつけられた。わしが、じゃ。", "年寄りの手を引き、子どもを肩に乗せ、水の上の板を渡す。三日、歌いながらの。", "歌うと列が速う進む。へたと言われたが、速う進んだ。", "酒は一滴も飲まんかった。最初の日のほかはな。"]),
  ev.thought("R3-15", "札の無い子", S1.r313, ["列のまえのほうで、司祭さまが歌ってた。へたくそって、みんな笑ってた。", "おれ、札がなかったから、列の横を走ってついてった。", "水の上の板のとこで、兵隊さんに槍を横にされた。", "司祭さまが、おれの方を見て、歌をまちがえた。"]),
  ev.thought("R3-16", "管の口の番", S1.r314, ["東の管から来る水は、いつも鉄の味がした。山の根の鋳物場の湯だと、水番が言った。", "管の中は、人がかがんで通れる。通って逃げた者が一人。戻らなかった。", "戻らなかったから、通れたんだろう。", "格子の閂は、こちら側だ。"]),
  ev.raw("廃水の管の口（H35。鋳物場 091 へ）", S1.pipe, [
    { image: { tileId: "E:109" }, priorityType: 1, list: [
      ...say(["壁に、人がかがんで通れるほどの管の口。奥から、鉄の匂いの風が来る。", "口の格子に、こちら側から閂が掛かっている。"]),
      ...choice(["閂を外す", "やめる"], 1, [[se("Open2"), swOn(SW.pipe), ...say(["閂を外した。管は、上の方へ続いている。"]),
        ...aside(ACTOR.zelina, null, say(["鉄の匂い。鋳物場て、鐘を鋳る所やろ。", "うちの壺の銀も、溶かしたら鐘になるんか"], "ゼリナ"))], []]),
      END,
    ] },
    { conditions: { switch1Id: SW.pipe, switch1Valid: true }, image: { tileId: "E:109" }, priorityType: 1, list: [
      ...choice(["管をくぐる", "やめる"], 1, [[...say(["管の途中で、下から水の音が上がってきた。"]), se("Move1"), transferCmd(FOUNDRY.mapId, FOUNDRY.x, FOUNDRY.y, UP)], []]), END,
    ] },
  ], "<hai_w9:H35。鋳物場 091（W10）の廃水の管 (52,38) とつながる。閂はこちら側（スイッチ 517）>"),
  ev.thought("R3-17", "列を止めた兵", S1.r315, ["命令は、日没に列を止めろ、だった。", "日没の鐘は、鳴らなかった。自分の数で、日没を決めた。", "三十まで数えて、槍を横にした。槍の向こうに、まだ二百はいた。"], {
    after: zelinaQueue("R3-14"),
  }),
  ev.chest("水番の長靴", S1.swChest, ["a", ARMOR.boots, 1]),
  // 100・101・102 の手がかりを同じ型にしない（W20 #264。R2 気になる 23）：100 は苔と風、101 は水の行き先、102 は煉瓦の目地
  ev.floor("水の吸い込み", S1.hint, ["足もとの水が、南の壁の下へ細く吸い込まれていく。", "壁の向こうで、水の落ちる音がする。"]),
  ev.chest("秘薬", S1.hiddenChest, ["i", ITEM.elixir, 1]),
  ev.pickup("砦の名札", [S1.desk[0], S1.desk[1] + 1], ["札場の机の下に、木の名札が一つ落ちている。", "黒鉄の砦の兵の名札だ。"], ["i", ITEM.nameTag, 1]), // W17：宝箱 (33,0) を札場の机の下の拾い物に
  ev.chest("油の壺", S1.neChest, ["i", ITEM.oil, 2]),
  ev.pickup("気付け薬", S1.pickup1, [], ["i", ITEM.smelling, 1]),
  ev.pickup("鉄くず", S1.pickup2, [], ["g", 0, 80]),
  ev.enemy("溝鼠", [6, 14], TROOP.rats, "green", { kind: "群れ", image: IMG.monster(2), chase: 3 }),
  ev.enemy("溝鼠", [9, 17], TROOP.rats, "green", { kind: "群れ", image: IMG.monster(2), chase: 3 }),
  ev.enemy("白い蛭", [24, 11], TROOP.whiteLeech, "green", { image: IMG.monster(3) }),
  ev.enemy("白い蛭", [33, 31], TROOP.whiteLeech, "green", { image: IMG.monster(3) }),
  ev.enemy("扉の外の者", [30, 6], TROOP.outsider, "yellow", { image: IMG.monster(4), chase: 4 }),
  ev.enemy("扉の外の者", [10, 34], TROOP.outsider, "yellow", { image: IMG.monster(4), chase: 4 }),
  ev.enemy("水番の亡骸", [41, 20], TROOP.keeper, "yellow", { kind: "輪", image: IMG.monster(0), chase: 3 }),
  ev.enemy("水門の主", [55, 20], TROOP.sluiceLord, "red", { kind: "番兵", image: IMG.monster(1), moveType: 0, chase: 3 }),
  ev.enemy("水番の亡骸", [50, 38], TROOP.keeper, "yellow", { image: IMG.monster(0), chase: 3 }),
], {
  about: "W9（#157）：地下水道・水門（world.md 5.2・mapdesign 4 章の水位・8 章の二つで一つ・6.4 アンセルモ 2）。西→100、北東→105、南→102（北西の上流の弁と南東の下流の弁を両方回すと水が引く。スイッチ 505）。東の廃水の管の口は H35（091 から。W10 が場所移動を足す）。",
  chars: DUNGEON_CHARS, deco: DUNGEON_DECO, stamps: DUNGEON_STAMPS,
}));

// ---------------------------------------------------------------------------
// 102 地下都市の閉じた扉の前（暗がり・アンセルモの遺骸）
// ---------------------------------------------------------------------------
// W17（台本 22）：夜の戸、二度目。アンセルモの遺骸を見たあとで、まだ答えていない（519 OFF）とき、叩いた音のあとに
const gateList = [
  ...say(["見上げるほどの鉄の扉。外側の面は、爪の跡で白くなっている。", "叩いても、音が奥へ吸われていくだけだ。"]),
  ifSwitch(W17_SW.nightDoorGate, 0, false),
  ifScript(`Hai.Companions.found().includes(${ACTOR.anselmo})`, 1),
  ...shift([
    ...nightDoorStart(),
    ...say(["角灯を消すと、暗がりは完全だった。", "扉が、叩かれた。三度。外からではない。", "扉の向こう、内側から、小さな拳で。"]),
    ...say(["そとのひと、まだいる？"]),
    ...choice(["答える", "答えない"], 1, [
      [...say(["いる"], "\\N[1]"),
        se("Open2", 0, 70, 60), cmd(230, [40]),
        ...say(["扉の内側で、閂が一つ動く音がした。", "鉄が鉄をこする、長い音だった。それきり、何も来なかった。", "影は出なかった。声も、二度目は無かった。"])],
      [...say(["閂に手を置かなかった。音は、二度目は来なかった。"])],
    ]),
    swOn(W17_SW.nightDoorGate),
    ...nightDoorEnd(),
  ], 2),
  close(2), ENDIF(1),
  close(1), ENDIF(),
  END,
];
CONFIGS.push(config("w9_102_gate_front", GATE, "閉じた扉の前", "gate", [
  lanternAuto,
  ev.transfer("北の廊下（水門へ）", G2.exitN, [SLUICE, S1.arriveS[0], S1.arriveS[1], "up"]),
  ev.transfer("北の廊下（水門へ）", G2.exitN2, [SLUICE, S1.arriveS2[0], S1.arriveS2[1], "up"]),
  ev.transfer("東の廊下（扉の番の間へ）", G2.exitE, [WARDEN_ROOM, G3.arriveW[0], G3.arriveW[1], "right"]),
  ev.transfer("東の廊下（扉の番の間へ）", G2.exitE2, [WARDEN_ROOM, G3.arriveW2[0], G3.arriveW2[1], "right"]),
  ev.warp("扉の番の控え", G2.warp),
  ev.raw("閉じた大扉", G2.gate, [
    { image: IMG.gate, priorityType: 1, list: gateList },
    // W17：アンセルモが節を歌ったあと（520）、扉の内の数え歌を一度（521）
    { conditions: { switch1Id: W17_SW.anselmoSang, switch1Valid: true }, image: IMG.gate, priorityType: 1, list: [
      ...say(["扉の内側から、声が聞こえた。", "子どもの声で、何人かが揃って歌っている。", "ひとつ、戸の外。", "ふたつ、扉の前。"]),
      ...say(["そこで一度、声が途切れた。笑い声が混じって、また続いた。", "よっつ、", "先は、聞き取れなかった。遊びの歌だった。", "足音が扉の鉄を通って、遠くなった。"]),
      ...aside(ACTOR.anselmo, null, say(["中でも数えとるんか。三つ目を抜いてな"], "アンセルモ")),
      swOn(W17_SW.doorRhyme), END,
    ] },
    { conditions: { switch1Id: W17_SW.doorRhyme, switch1Valid: true }, image: IMG.gate, priorityType: 1, list: gateList },
    { conditions: { switch1Id: SW.gateOpened, switch1Valid: true }, image: IMG.gateOpen, priorityType: 1, trigger: 0,
      list: [...say(["大扉が、人ひとり通れるだけ開いている。"]), se("Move1"), transferCmd(WELL, WL.arriveGate[0], WL.arriveGate[1], UP), END] },
  ]),
  ev.block("閉じた大扉（右）", G2.gateBlock),
  ev.raw("遺骸 アンセルモ", G2.anselmo, [
    { image: IMG.anselmo, priorityType: 1, list: [
      ...say(["扉に背を預けて、太った男が座っている。司祭の帯は、酒の染みだらけだ。", "扉の爪の跡は、男の背のあたりだけ無い。"]),
      ...say(["名を一つ呼んで、弔いの節を一つ。これで百と、えー、いくつじゃったかの。", "扉の内から、子どもの笑う声がする。札の子かの。笑っとるなら、上等じゃ。", "次の名は、と。喉が鳴らん。", "誰か、続きを歌っといてくれ。"]),
      ...aside(ACTOR.zelina, null, say(["……こっち側にも、おったんやな。歌う人が"], "ゼリナ")),
      END,
    ] },
    { conditions: { selfSwitchCh: "A", selfSwitchValid: true }, priorityType: 0 },
  ], `<hai_remains:${ACTOR.anselmo}><hai_memory:${ACTOR.anselmo},4>`),
  ev.text("扉の爪の跡", G2.claw, ["扉の継ぎ目に、爪の跡。低い所の跡ほど、新しい。"]),
  ev.raw("記憶 アンセルモ 3", G2.anselmo3, [{ image: IMG.thought, priorityType: 1, list: [
    ...say(["扉が閉まる日、わしの懐に、内へ入る札が一枚あった。司祭の分じゃ。", "列の外に、女の子が一人。泣きもせんで立っとった。札を首に掛けてやった。", "それでわしは外。内の連中への文句は、歌に混ぜた。三番の節にな。", "子の名は、聞かんかった。"]),
    ...aside(ACTOR.anselmo, "B", say(["三番はな、お前さん。ひどい歌詞じゃ。", "司教さまが聞いたら、もう一度わしを追い出す"], "アンセルモ")),
    END,
  ] }], `<hai_memory:${ACTOR.anselmo},3>`),
  ev.pickup("騎士長の日誌", G2.journal, ["机の上に、革の日誌。三つの封蝋の欠片が挟まっている。"], ["i", ITEM.journal, 1], {
    image: { tileId: "C:149" }, keepImage: { tileId: "C:149" },
    after: aside(ACTOR.bruno, null, say(["騎士長は、断ったんですね"], "ブルーノ")),
  }),
  ev.text("騎士団の盾", [36, 3], ["壁に、黒鉄の砦の騎士団の印を刻んだ盾が一枚。", "裏に、列の警護の当番が十二人。名は、九つまで消してある。"]),
  ev.chest("霊水", G2.chest, ["i", ITEM.holyWater, 2]),
  ev.text("石を積んだ墓", G2.graves, ["石を積んだだけの墓が並ぶ。積んだ石の数が、墓ごとに違う。"]),
  ev.pickup("弔いの名簿", G2.listRoll, ["石の上に、紐で綴じた紙の束。名前ばかりが、細かい字で並んでいる。"], ["i", ITEM.dirge, 1], { image: { tileId: "E:177" } }),
  ev.thought("R3-18", "弔いを手伝った男", G2.r324, ["司祭のおっさんの歌は、うまいのか下手なのか分からなかった。", "聞いた者は、みんな泣いた。泣かせるのがうまい、が正しいな。", "おれの名は、名簿の七十いくつめだ。字が崩れだすあたりだ。"]),
  ev.thought("R3-19", "札を孫に持たせた年寄り", G2.r320, ["札を持っとる子から順だと。わしの札は、朝に孫に持たせた。", "戸の内で、孫が泣いとる。泣くな。戸は、もう叩かん。"]),
  ev.thought("R3-20", "札の無い子ら", G2.r321, ["札は、王さまの紋が焼いてある板。持ってる子と、持ってない子がいた。", "持ってない子で、鬼ごっこをした。扉にさわった子が、鬼。", "扉にさわったら、中で、だれかがぼくの名前で泣いてた。", "ぼくが鬼。三回めも、ぼく。"], {
    // W17（台本 24）：アンセルモが隊にいて、弔いの名簿を持っているとき一度（520）
    after: [
      ifSwitch(W17_SW.anselmoSang, 0, false),
      ifItem(ITEM.dirge, 1),
      ...shift(aside(ACTOR.anselmo, null, [
        ...say(["アンセルモの手が、腹へ行って、止まった。", "名簿の束を出して、頁を繰った。名を一つ、指で押さえた。", "その名の横の数は、一だった。"]),
        ...say(["一つしか、歌うとらん"], "アンセルモ"),
        ...say(["アンセルモは、その名を声に出した。小さく。", "それから、節を一つ歌った。酒場の歌の調子ではなかった。", "子どもは、扉の方を向いたままだった。"]),
        ...say(["二つ目、じゃ"], "アンセルモ"),
        swOn(W17_SW.anselmoSang),
      ]), 2),
      close(2), ENDIF(1),
      close(1), ENDIF(),
    ],
  }),
  ev.thought("R3-21", "番を見ていた女", G2.r322, ["番の鎧は、水を吸って光っていた。", "雷の晩、番は扉の陰に引っこんで、朝まで動かなかった。鉄の鳴る音を嫌う。", "あいつも、扉の内には入れてもらえなかった。札は、持っていたのに。"], { clues: ["扉の番は、雷の晩に扉の陰へ下がった。鉄の鳴る音を嫌う（閉じた扉の前）"] }),
  ev.thought("R3-22", "読み上げを聞いた男", G2.r323, ["番は、布告を読み上げるのが役目だった。日に三度、同じ文を。", "削られた下の半分を、番は覚えていない。読み上げるたびに、そこで止まる。", "止まっている間は、槍の先が下がっている。"], { clues: ["扉の番は、王の布告の削られた所で読み上げが止まる（閉じた扉の前）"] }),
  ev.floor("新しい目地", G2.hint, ["南の壁の煉瓦が、一列だけ新しい。", "目地を、指でかき出した跡がある。"]),
  ev.chest("秘薬", G2.hiddenChest, ["i", ITEM.elixir, 1]),
  ev.pickup("薬草", G2.pickup, [], ["i", ITEM.herb, 1]),
  ev.enemy("扉の外の者", [14, 11], TROOP.outsider, "yellow", { image: IMG.monster(4), chase: 4 }),
  ev.enemy("扉の外の者", [30, 13], TROOP.outsider, "yellow", { image: IMG.monster(4), chase: 4 }),
  ev.enemy("扉の外の者", [25, 21], TROOP.outsider, "yellow", { kind: "往復", image: IMG.monster(4), chase: 4 }),
  ev.enemy("白い蛭", [9, 17], TROOP.whiteLeech, "green", { image: IMG.monster(3) }),
  ev.enemy("白い蛭", [34, 9], TROOP.whiteLeech, "green", { image: IMG.monster(3) }),
], {
  about: "W9（#157）：地下都市の閉じた扉の前（暗がり 1.5、角灯で 5。world.md 2.3 王の布告と外に残された民・6.3 アンセルモの遺骸・6.4 アンセルモ 3・4・8.3 騎士長の日誌）。北→101、東→103。大扉は内側の村の長が閂を外すと 105 へ通じる（スイッチ 510）。",
  deco: UNDER_DECO,
}));

// ---------------------------------------------------------------------------
// 103 扉の番の間（ボス 扉の番）
// ---------------------------------------------------------------------------
CONFIGS.push(config("w9_103_gate_keeper", WARDEN_ROOM, "扉の番の間", "warden", [
  ev.transfer("西の口（閉じた扉の前へ）", G3.exitW, [GATE, G2.arriveE[0], G2.arriveE[1], "left"]),
  ev.transfer("西の口（閉じた扉の前へ）", G3.exitW2, [GATE, G2.arriveE2[0], G2.arriveE2[1], "left"]),
  ev.raw("扉の番", G3.boss, [
    { image: IMG.warden, priorityType: 1, list: [
      ...say(["外の者か。札を。札の無い者は、次の日没を、待て。"], "扉の番"),
      ...say(["内の者は、出すな。外の者は、入れるな。それが、命令。"], "扉の番"),
      ifItem(ITEM.decree),
      ...say(["番の目が、布告の板に止まった。"], "", 1),
      ...say(["民を、地下に、守る。扉は、日没に……。"], "扉の番", 1),
      ...say(["読み上げが、削られた所で止まった。槍の先が下がっている。"], "", 1),
      swOn(SW.wardenWavers, 1),
      close(1), ENDIF(),
      ...plugin("Hai_Boss", "bossBattle", "ボス戦", { troopId: String(TROOP.doorWarden), escapeMapId: String(GATE), escapeX: String(G2.arriveE[0]), escapeY: String(G2.arriveE[1]), escapeDirection: "4" }),
      ifScript("Hai.Boss.lastResult() === 0"),
      ...say(["番は扉の方を向いたまま、膝をついた。鎧の中から、水と灰がこぼれた。"], "", 1),
      ...gainLines("a", ARMOR.helm, 1, 1),
      ...say(["北の扉の閂が、外れる音がした。"], "", 1),
      close(1), ENDIF(), END,
    ] },
    { conditions: { switch1Id: SW.doorWarden, switch1Valid: true }, priorityType: 0 },
  ]),
  ev.raw("北の扉（水底の鐘の間へ）", G3.door, [
    { image: IMG.door, priorityType: 1, walkAnime: false, list: [...say(["鉄の扉。向こうから閂が掛かっている。", "扉の下の隙間から、冷たい水が滲んでいる。"]), END] },
    { conditions: { switch1Id: SW.doorWarden, switch1Valid: true }, image: IMG.doorOpen, priorityType: 1, trigger: 1, walkAnime: false,
      list: [se("Move1"), transferCmd(BELL, B4.arriveS[0], B4.arriveS[1], UP), END] },
  ]),
  ev.text("番の机", G3.table, ["机の上に、読み上げの文を書いた板が十数枚。", "どれも同じ文で、どれも「日没に」の先が無い。"]),
  ev.text("番の寝床", G3.r325, ["壁ぎわに、鎧を脱がずに寝た跡。藁が、人の形に潰れている。"]),
], {
  about: "W9（#157）：扉の番の間（world.md 5.5 ボス 扉の番。弱みの手がかりは王の布告と外に残された民の思念）。王の布告を持っていると、戦いの頭に「迷い」（攻撃・防御が下がる）。西→102、北の扉→104（倒すと開く）。",
  chars: DUNGEON_CHARS, deco: DUNGEON_DECO, stamps: DUNGEON_STAMPS,
}));

// ---------------------------------------------------------------------------
// 104 水底の鐘の間
// ---------------------------------------------------------------------------
const bellRope = ev.raw("水底の鐘の綱", B4.rope, [
  { image: { tileId: "B:6" }, priorityType: 1, list: [
    cmd(108, ["W11：3 つ目の場面と山場をここに足す"]),
    cmd(408, ["（鳴らした数が 3 になったときの主人公の記憶の場面・最後の地域の山場。world.md 3.6・3.7。南の控えの空きに門叩きの塊を置ける）"]),
    ...say(["台座の上の鐘は、半ば水に浸かっている。", "天井の梁から垂れた綱だけが、乾いている。"]),
    ...choice(["綱を引く", "やめる"], 1, [
      [se("Bell3", 0, 100, 80), cmd(225, [3, 5, 20, false]), cmd(224, [[180, 220, 255, 120], 20, true]), cmd(230, [30]),
        se("Bell3", 0, 90, 80), cmd(230, [40]), se("Bell3", 0, 80, 75), cmd(230, [60]),
        ...say(["鐘が鳴る。足もとの水に、輪が幾重にも広がった。", "天井の石の継ぎ目から、細い光が一筋落ちた。"]),
        swOn(FLAG.bellWater),
        cmd(122, [FLAG.bellCount, FLAG.bellCount, 1, 0, 1]),
        ifVar(FLAG.bellCount, 4, 1),
        swOn(FLAG.bellsAll, 1),
        close(1), ENDIF(),
        ...ringAfter(0), // W14：鳴ったあとの一行（三つ目・四つ目）
        selfOn(),
        ...say(["壁の札掛けに、当番の札が一枚だけ残っている。"]),
        se("Item3"),
        ...gainLines("i", ITEM.dutyTag, 1)],
      [],
    ]),
    END,
  ] },
  { conditions: { selfSwitchCh: "A", selfSwitchValid: true }, image: { tileId: "B:6" }, priorityType: 1, list: [...say(["鐘は、水の中でまだ小さく震えている。"]), END] },
]);
CONFIGS.push(config("w9_104_bell_deep", BELL, "水底の鐘の間", "bell", [
  ev.transfer("南の口（扉の番の間へ）", B4.exitS, [WARDEN_ROOM, G3.arriveDoor[0], G3.arriveDoor[1], "down"]),
  bellRope,
  // 札を得る前は「札は一枚。」（084 と同じ。W20 #264。R2 気になる 11）
  ev.raw("札掛け", B4.board, [{ image: { tileId: "B:177" }, priorityType: 1, list: [
    ...say(["札掛けの釘は四本。", "札の掛かっていた跡が、四つとも同じ高さまで水に濡れている。"]),
    ifItem(ITEM.dutyTag), close(1), ELSE(), ...say(["札は一枚。"], "", 1), close(1), ENDIF(),
    END,
  ] }]),
  withThirdScene(ev.thought("R3-23", "水底の鐘番", B4.r326, ["夕べになっても、頂の鐘は聞こえなかった。水の底だから、と思った。", "上の者が知らせに来るのを待った。誰も下りてこなかった。", "札には日付だけ書いた。鳴らしたかは、水が引いてから書く。", "水は、膝から胸まで来た。筆は、札掛けの下に浮いている。"])),
  ...lairDoorEvents("south"), // 鐘の間の口の霧の戸口（W11）
], {
  about: "W9（#157）：水底の鐘の間（world.md 5.1・8.1。鐘の綱は W7 の 036 と同じ形：スイッチ 103 ON・変数 101 に 1 足す・4 以上ならスイッチ 105 ON）。鐘の間の口に W11 の霧の戸口（門叩きの縄張り 170 へ）、鐘番の思念の 2 ページ目は 3 つ目の場面（W11。w11_parts.mjs）。鐘の綱に W11 への注釈。鐘の絵は仮。",
  chars: DUNGEON_CHARS, deco: DUNGEON_DECO, stamps: DUNGEON_STAMPS,
}));

// ---------------------------------------------------------------------------
// 105 井戸の縦穴（扉の内側の村・井戸の綱・格子）
// ---------------------------------------------------------------------------
const FORT_WELL = { mapId: 10, x: 29, y: 20 }; // 砦の中庭の井戸 (29,19) の前
const PASSAGE = { mapId: 37, x: 5, y: 11 }; // 営倉の井戸の底への通路の格子 (5,12) の上
const ELDER = "村の長";
const elderTalk = [
  ifVar(VAR.songTask, 1, 4),
  ...say(["扉は開けん。外の音には答えん。それが村の決まりじゃ。先に言うておくぞ", "あんた、下の水門から上がってきたのかね。水番の道は、とうに沈んだと聞いとった"], ELDER, 1),
  ...say(["ここは扉の内の村じゃ。わしらの爺さまの爺さまが、王さまの布告で下りてきた", "王さまは、民を守った。扉は、その日の日没に閉じた。村では、そう教える"], ELDER, 1),
  ...say(["ただのう。わしの代になってから、", "扉の外で、戸を叩く音が増えた。三度ずつ。夜に"], ELDER, 1), // W17（台本 20）
  ...say(["村の者には言うておらん"], ELDER, 1),
  // 前の頁と頭を「ただのう。」で重ねない（W20 #264。R2 気になる 15）
  ...say(["それにのう。言い伝えに、扉の外で夜ごとに歌が聞こえた、というのがある", "布告にも、村の決まりにも、歌のことは無い。誰が歌っておったのか", "わしは、それが知りたい。歌うた者の名が、分かるものならのう"], ELDER, 1),
  cmd(122, [VAR.songTask, VAR.songTask, 0, 0, 1], 1),
  swOn(SW.askedSong, 1),
  ...errand({ key: "doorSong", title: "扉の外の歌", who: ELDER, stage: "1", text: "扉の外で夜ごとに歌っていた者を探す（扉の内の村の長）", variableId: String(VAR.songTask) }, 1),
  cmd(115, [], 1),
  close(1), ENDIF(),
  ifVar(VAR.songTask, 1, 0),
  ifItem(ITEM.dirge, 1),
  ...say(["それは何じゃね。紙の束か"], ELDER, 2),
  ...choice(["名簿を見せる", "見せない"], 1, [
    [...say(["名か。外の者の、名か"], ELDER),
      cmd(230, [40]),
      ...say(["ここに、わしの家の名がある。爺さまの妹じゃ。札が一枚、足りなんだと"], ELDER),
      ...say(["横の数は、節の数か。この名で、歌うた者がおったか"], ELDER),
      ...say(["閂を外そう。わしの代で、一度きりじゃ。出る者がおっても、止めん"], ELDER),
      // W17（台本 25）：夜の戸で答えていれば（519）、いちばん上の一本はもう外れている
      ifSwitch(W17_SW.nightDoorGate),
      ...say(["閂は三本のはずだった。いちばん上の一本が、受けから外れている。", "長はそれを見て、何も言わなかった。残りの二本を外した。"], "", 1),
      close(1), ELSE(),
      ...say(["長は三本の閂を、手で持ち上げて外した。"], "", 1),
      close(1), ENDIF(),
      cmd(126, [ITEM.dirge, 1, 0, 1]),
      se("Door4"),
      swOn(SW.gateOpened),
      cmd(122, [VAR.songTask, VAR.songTask, 0, 0, 2]),
      ...errandEnd({ key: "doorSong", result: "done", text: "弔いの名簿を見せた。村の長は大扉の閂を外した（扉の内の村）" }),
      ...aside(ACTOR.anselmo, null, [
        ...say(["ひとことで、ええんじゃ。……遅い"], "アンセルモ"),
        ...say(["それから、アンセルモは笑った。"]),
      ])],
    [...say(["そうかね。まあ、ええ"], ELDER),
      // 変数 501 は 3（見せなかった）のまま残す。errand は段を変数 501 に写すので、段も 3 にそろえる（W20 #264。P16 #256 の気づき）
      ...errand({ key: "doorSong", stage: "3", text: "名簿は見せなかった（扉の内の村）" }),
      cmd(122, [VAR.songTask, VAR.songTask, 0, 0, 3])],
  ], 2),
  cmd(115, [], 2),
  close(2), ENDIF(1),
  close(1), ENDIF(),
  ifVar(VAR.songTask, 2, 0),
  ...say(["閂は外したままじゃ。外の風は、思うたより冷たいのう"], ELDER, 1),
  cmd(115, [], 1),
  close(1), ENDIF(),
  ...say(["扉は開けん。それが村の決まりじゃ"], ELDER),
  END,
];
const gateInnerAside = aside(ACTOR.zelina, "B", say(["字は書けるんやな。うちの名簿の子らも、書けたやろか"], "ゼリナ")); // W17（台本 20）
CONFIGS.push(config("w9_105_well_shaft", WELL, "扉の内の村", "well", [
  // W17（台本 25）：アンセルモが隊にいて、初めて 105 に入ったとき
  ev.raw("W17 アンセルモの一言（自動）", [0, 0], [
    { conditions: { actorId: ACTOR.anselmo, actorValid: true }, priorityType: 0, trigger: 3, list: [...say(["内は、こうなっとったか"], "アンセルモ"), selfOn(), END] },
    { conditions: { selfSwitchCh: "A", selfSwitchValid: true }, priorityType: 0 },
  ]),
  ev.transfer("南の口（水門へ）", WL.exitS, [SLUICE, S1.arriveN[0], S1.arriveN[1], "down"]),
  ev.transfer("南の口（水門へ）", WL.exitS2, [SLUICE, S1.arriveN2[0], S1.arriveN2[1], "down"]),
  ev.warp("扉の内の村", WL.warp),
  ev.raw("村の長", WL.elder, [{ image: IMG.elder, priorityType: 1, list: elderTalk }]),
  ev.text("村の女", WL.villager1, ["あんた、上から来たの。戸を叩いて来なかったでしょうね", "外からの音には答えない。小さいときから、そう言われてる"], { image: IMG.villagerW, speaker: "村の女" }),
  ev.text("村の男", WL.villager2, ["上の井戸から、たまに小石が落ちてくる。上にも誰か住んどるのかね"], { image: IMG.villagerM, speaker: "村の男" }),
  ev.text("村の子", WL.child, ["扉の向こうって、なにがあるの？", "鬼ごっこの鬼になったら、扉にさわって帰ってくるんだよ"], { image: IMG.child, speaker: "村の子" }),
  ev.text("地下の灯", WL.lampPost, ["石の柱の上の灯。煤を払った跡が新しい。", "柱の根元に、灯した夜を数える刻み。四つで一束。"]),
  ev.raw("大扉の内側", WL.gateInner, [
    { image: IMG.gate, priorityType: 1, list: [...say(["大扉の内側。太い閂が三本、渡してある。", "閂の上に、子どもの字で「あけない」。"]), ...gateInnerAside, END] },
    // W17（台本 22）：夜の戸のあと（519）。閂を外す前
    { conditions: { switch1Id: W17_SW.nightDoorGate, switch1Valid: true }, image: IMG.gate, priorityType: 1, list: [
      ...say(["大扉の内側。太い閂が三本、渡してある。", "いちばん上の一本が、受けから外れている。", "閂の上に、子どもの字で「あけない」。"]), ...gateInnerAside, END,
    ] },
    { conditions: { switch1Id: SW.gateOpened, switch1Valid: true }, image: IMG.gateOpen, priorityType: 1, list: [
      ...say(["閂の外れた大扉が、人ひとり通れるだけ開いている。"]), se("Move1"), transferCmd(GATE, G2.gateFront[0], G2.gateFront[1], UP), END,
    ] },
  ]),
  ev.block("大扉の内側（右）", WL.gateInner2),
  // 井戸の縦穴：綱（砦の井戸への近道）
  ev.raw("井戸の綱", WL.rope, [
    { image: { tileId: "B:6" }, priorityType: 1, list: [
      ...say(["見上げると、遠くに丸い光。縦穴の壁に、古い綱が垂れて、途中で絡まっている。", "綱の端の結びは、砦の中庭の井戸と同じ結び方だ。"]),
      ...choice(["綱を引き下ろす", "やめる"], 1, [
        [se("Move1"), ...say(["絡まりを解くと、綱がまっすぐ下りてきた。上の端は、井戸の滑車に掛かったままだ。"]), swOn(SW.rope)],
        [],
      ]),
      END,
    ] },
    { conditions: { switch1Id: SW.rope, switch1Valid: true }, image: { tileId: "B:6" }, priorityType: 1, list: [
      ...choice(["綱を上る", "やめる"], 1, [[se("Move1"), transferCmd(FORT_WELL.mapId, FORT_WELL.x, FORT_WELL.y, UP)], []]), END,
    ] },
  ]),
  ev.raw("薄い思念 F09 井戸番の女", WL.faint, [{ image: IMG.faint, priorityType: 1, stepAnime: true, list: [
    ...say(["井戸の綱を、墓守が一緒に引いている。", "墓守は小さく数を数える。三十で、桶が縁に届いた。二十九で届いた日は無い。", "井戸番の女が、もう一杯、と言う。墓守は袖をまくって、また一から数えはじめる。", "女は、墓守の指を見ている。三十で桶が届き、指が、もう一本折れる。"]),
    cmd(117, [COMMON_MEMORY_LINE]),
    END,
  ] }], "<hai_faint:F09>"),
  // 北西の梯子の上の格子（営倉の井戸の底への通路へ）
  ev.raw("梯子の上の格子", WL.grate, [
    { image: { tileId: "B:5" }, priorityType: 1, list: [
      ...say(["梯子の上に、鉄の格子。こちら側に閂が掛かっている。", "格子の向こうは、石の通路。"]),
      ...choice(["閂を外す", "やめる"], 1, [[se("Open2"), swOn(SW.grate), ...say(["閂を外した。格子を押し上げれば、上へ出られる。"])], []]),
      END,
    ] },
    { conditions: { switch1Id: SW.grate, switch1Valid: true }, image: { tileId: "B:5" }, priorityType: 1, list: [
      ...choice(["格子を上る", "やめる"], 1, [[se("Move1"), transferCmd(PASSAGE.mapId, PASSAGE.x, PASSAGE.y, UP)], []]), END,
    ] },
  ]),
  ev.thought("R3-24", "閂を掛けた工兵", WL.r331, ["格子の閂は、こちら側に掛けた。上から逃げてくる者を止めろ、と言われた。", "上は砦の営倉だ。下りてくる者を止めろ、とは言われていない。"]),
  ev.thought("R3-25", "内で生まれた子", WL.r330, ["おとうが、扉の音には答えるなって。三回たたくのは、門叩きだって。", "でも、四回たたく音もあった。おとうは、三回までしか数えてなかった。"]),
  ev.chest("霊水", WL.chest, ["i", ITEM.holyWater, 2]),
  ev.pickup("薬草", WL.pickup, [], ["i", ITEM.herb, 1]),
], {
  about: "W9（#157）：井戸の縦穴と扉の内の村（world.md 5.2・7.2 地下都市の子孫・村の長の頼み「扉の外の歌」）。南→101。北東の井戸の綱→010 の井戸（綱を下ろすと近道。スイッチ 508）、北西の梯子の格子→037（閂。スイッチ 509）、南西の大扉の内側→102（村の長が閂を外すと。スイッチ 510）。薄い思念 F09。",
  deco: UNDER_DECO,
}));

// ---------------------------------------------------------------------------
// 地域一の出入口の行き先（issue #157 の 7。タイル層は触らない）
// ---------------------------------------------------------------------------
const toSewerStairs = [SEWER, S0.arriveStairs[0], S0.arriveStairs[1], DOWN];
function patchEvent(file, name, fn) {
  const p = path.join(SRC_DIR, file + ".json");
  const json = JSON.parse(fs.readFileSync(p, "utf8"));
  const ev2 = json.events.find(e => e.name === name);
  if (!ev2) throw new Error(`${file}: ${name} が無い`);
  fn(ev2);
  outputs.push({ file: p, text: JSON.stringify(json, null, 2) + "\n" });
}
// 035 牢番の詰め所の西の扉：鍵束で開けたあと（スイッチ 308）、触れると地下水道・上流の石段の下へ
patchEvent("w7_035_warden_post", "西の扉（下りの石段）", e => {
  e.pages[1] = {
    conditions: { switch1Id: 308, switch1Valid: true },
    image: { characterName: "!Door1", characterIndex: 0, direction: 8, pattern: 0 },
    priorityType: 1, trigger: 1, walkAnime: false,
    list: [se("Move1"), transferCmd(...toSewerStairs), END],
  };
});
// 037 井戸の底への通路の格子：105 の側で閂を外したら（スイッチ 509）、下りられる
patchEvent("w7_037_well_passage", "井戸の底の格子", e => {
  // W7 の文（一枚目のページ）はそのまま。何度走らせても同じになるよう、元の文をここに写す
  const lines = ["床の格子の下は、深い縦穴。水の音と、細い光。", "閂は、格子の向こう側に掛かっている。"];
  const image = { tileId: "B:28" };
  e.type = "raw";
  delete e.lines;
  delete e.image;
  e.pages = [
    { image, priorityType: 1, list: [...say(lines), END] },
    { conditions: { switch1Id: SW.grate, switch1Valid: true }, image, priorityType: 1, list: [
      ...say(["格子の閂は外れている。縦穴の下に、梯子が続いている。"]),
      ...choice(["下りる", "やめる"], 1, [[se("Move1"), transferCmd(WELL, WL.arriveGrate[0], WL.arriveGrate[1], DOWN)], []]), END,
    ] },
  ];
});

// ---------------------------------------------------------------------------
for (const { file, cfg } of CONFIGS) {
  const seen = new Map();
  for (const e of cfg.events) {
    const k = `${e.x},${e.y}`;
    if (seen.has(k)) console.error(`重なり: ${file} (${k}) ${seen.get(k)} / ${e.name}`);
    seen.set(k, e.name);
  }
}
for (const { file, cfg } of CONFIGS) outputs.push({ file: path.join(SRC_DIR, file + ".json"), text: JSON.stringify(fixW31(file, fixW30(file, patchLater(file, cfg))), null, 2) + "\n" }); // W14：後日談の一行（場面表 7.3）

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const ROOT = path.resolve(dataPath("."), "..");
  let stale = 0;
  for (const { file, text } of outputs) {
    const rel = path.relative(ROOT, file);
    const current = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
    if (check) {
      if (current !== text) { console.error(`古い: ${rel}（node tools/maps/src/w9_data.mjs で書き直す）`); stale++; }
      else console.log(`一致: ${rel}`);
    } else if (current !== text) {
      fs.writeFileSync(file, text);
      console.log(`書き出し: ${rel}`);
    }
  }
  if (stale) process.exit(1);
}
