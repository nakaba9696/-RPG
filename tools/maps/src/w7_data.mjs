// W7（#145）地域一（霧の森・鉄の坑道・営倉）のデータベースの項目を書く。何度走らせても同じ結果になる（自分の帯だけを書き直す）。
//   node tools/maps/src/w7_data.mjs           書く
//   node tools/maps/src/w7_data.mjs --check   書かずに、今のファイルと同じかだけ見る（違えば終了コード 1）
// 書くもの（docs/ROADMAP.md の割り当て表の W7：データベース 301–400、スイッチ・変数 301–400）：
//   Items・Weapons・Armors・Skills・Enemies・Troops の 321–400（301–320 には前の世界の W3 の物が残っている。
//     W3 の古いマップ 050–064 とテスト w_stage2a・2b がまだ使うので、W8・W10 が作り直すまで触らない）
//   System.json の switches・variables 301–400 の名前
// 説明（2 行目は来歴の一行）と来歴（メモ欄の <hai_lore>）は docs/world.md 8.3 の物はそこから写し、ほかは W7 が書いた。
// マップのイベント（tools/maps/src/w7_*.json）がこの番号を使う（下の ID の表を export する）。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readData, formatTable, dataPath, extendTable } from "../../data/io.mjs";

export const ITEM = {
  keyRing: 321, lantern: 322, dutyTag: 323, prayerBook: 324, wardenLog: 325, graveLedger: 326,
  bellIron: 327, nameTag: 328, huntLedger: 329, scripture: 330, marchOrder: 331, oil: 332,
  // P9 の拾い物（P の帯。使うだけ）
  herb: 196, antidote: 197, elixir: 198, bitterRoot: 199, mossAsh: 200, sleepIncense: 141, salve: 142, smelling: 143, holyWater: 144,
};
export const WEAPON = { boneDagger: 321 };
export const ARMOR = { smallBell: 321, bellGauntlet: 322, bellCharm: 323, minerHelm: 324, shrineHood: 325, ashSash: 326 };
export const SKILL = { bellToll: 321, mistWhisper: 322, boneSlash: 323, bolt: 324, noOneOut: 325, packFang: 326 };
export const TROOP = {
  ashDogs: 321, ashCrow: 322, lostOne: 323, bellCorpse: 324, lostFlock: 325,
  mineRats: 326, boneEater: 327, hunter: 328, lampless: 329, boneArmor: 330,
  shade: 331, watchBeast: 332, roundsman: 333, chainHound: 334, warden: 335,
  nightShade: 336, // W15（#231）：夜の戸の声だけの影（木樵の女房）
};
// スイッチ・変数（301–400。System.json に名前を書く）。world.md 4.4 の旗（W6 の帯）は使うだけ：
//   スイッチ 101 営倉の鐘を鳴らした・変数 101 鳴らした鐘の数・スイッチ 114 営倉の鉄扉を開けた・スイッチ 151 ボス 牢番・変数 103 生き残りの数
//   スイッチ 121〜124 は部屋（Hai_Facilities の open が立てる）
export const SW = {
  fogCleared: 301, fogPath: 302, lift: 303, bigDoor: 304, ironDoor: 305, wolfram: 306, adele: 307,
  westDoor: 308, hallGate: 309, bellFirst: 310, statue: 311, grapple: 312, shears: 313,
  nightDoor: 314, // W15（#231）：夜の戸（木樵）に答えた。P14 の言い残しの表が読む
};
export const VAR = { bellIronTask: 301, vespers: 302 };
export const FLAG = { bellRung: 101, bellCount: 101, ironDoorFort: 114, wardenBoss: 151, survivors: 103 };

const SWITCH_NAMES = {
  301: "森:霧の壁が引いた（021）",
  302: "森:霧の抜け道（024→020）",
  303: "坑道:昇降機が動く",
  304: "坑道:大扉が開いた",
  305: "営倉:鉄扉の閂を外した（033）",
  306: "生き残り:ヴォルフラムが砦へ",
  307: "生き残り:アデルが砦へ",
  308: "営倉:西の扉（鍵束。水道へ）",
  309: "営倉:廊下の鉄格子の門",
  310: "頼み:営倉の鐘を先に鳴らした",
  311: "森:像の台の夕べの数",
  312: "道具:鉤綱（第2段階で手に入れたら ON）",
  313: "道具:鉄切り鋏（第2段階で手に入れたら ON）",
  314: "夜の戸:木樵（答えた）",
};
const VARIABLE_NAMES = {
  301: "頼み:鐘鉄（0 未・1 受けた・2 渡した）",
  302: "森:夕べの数の答え",
};

const STATE = { poison: 141, sleep: 142, confuse: 144, silence: 146, bind: 147 };
const ELEMENT = { fire: 2, ice: 3, thunder: 4, light: 8, dark: 9 };

const check = process.argv.includes("--check");
const outputs = [];
const writeTable = (name, array) => outputs.push({ file: dataPath(name), text: formatTable(array) });

// ---------------------------------------------------------------------------
// 説明と来歴（1 行は全角 40 字まで。docs/knowhow.md 5.1）
// ---------------------------------------------------------------------------
const LORE = {
  "牢番の鍵束": { desc: ["営倉の鍵の束。鍵の掛かった扉を開ける。", "輪に鍵が十二本。輪の内側は、指の形にすり減っている。"], lore: ["営倉の牢番が腰に下げていた鍵の束。", "鍵は十二本。輪には、十三本ぶんの擦れ跡がある。", "どの鍵にも房の番号が刻んである。九番の鍵だけ無い。", "輪の留め金は、一度も外された跡が無い。"] },
  "鐘番の角灯": { desc: ["暗がりで、周りを広く照らす。", "坑道の鐘番が、夜の見回りに下げた角灯。"], lore: ["鉄の枠に、煤けた角の板をはめた角灯。", "底に「鐘番　坑道の三」と刻んである。", "油壺は半分残っている。芯は一度も切っていない。", "詰め所の釘に、鍵と並べて掛けてあった。"] },
  "当番の札（営倉）": { desc: ["鐘の当番の札。営倉の鐘の間に掛けてあった。", "日付のところで、書き付けが止まっている。"], lore: ["鐘の当番が、鳴らした数を書き付ける札。", "「夕べ、三十。頂の鐘、鳴らず」。", "その下に、同じ手で「三十一」と書きかけて消した跡。", "札掛けの釘は四本。残っていた札はこれ一枚。"] },
  "教会の祈祷書": { desc: ["鐘の教会の祈祷書。礼拝堂の書見台にあった。", "最後の頁だけ、紙が新しい。"], lore: ["夕べの数の唱え方と、鐘への祈りを綴じた祈祷書。", "綴じ足した最後の頁に「帝国の古言に、神の怒りが下った夜」。", "その頁だけ紙が白く、字が上手い。", "前の頁の余白に、騎士の名が七つ。どれも線で消してある。"] },
  "牢番の帳面": { desc: ["営倉の牢番の帳面。点呼の数と、鍵を数えた印。", "最後の頁に、太い字の書き付けがある。"], lore: ["毎夕の点呼の数と、房の鍵を数えた印が並ぶ。", "最後の日付の行は「鍵、十二。欠けなし。点呼、九」。", "その下に太い字で「火を嫌う。灯を持って来るな」。", "誰が誰に宛てたのかは、書いていない。"] },
  "墓守の帳面": { desc: ["砦の墓所の帳面。死んだ人の名と言い残し。", "墓守の欄だけ、印が一つ添えてある。"], lore: ["帳面は五冊を綴じ直してある。いちばん古い冊は黒い。", "五冊とも、書いた手は同じ。", "言い残しの欄の横に、届けた日と、届けた相手。"] },
  "鐘鉄の塊": { desc: ["坑道の奥で掘られた、鐘を鋳るための鉄。", "拳ほどの塊。叩くと、長く鳴る。"], lore: ["鐘を鋳るためだけに掘られた鉄。ほかの鉄より白い。", "刻印は「教会納め」。その上から「売るな」と彫り足してある。", "長屋の床下に、布に包んで置いてあった。", "叩くと、指が痺れるまで鳴りやまない。"] },
  "砦の名札": { desc: ["黒鉄の砦の兵が首から下げた、木の名札。", "紐を通す穴が、すり切れている。"], lore: ["表に名、裏に生まれた国の名。", "国の名は、三つのうちのどれか。", "砦では、名札の数で死んだ兵を数えた。"] },
  "使徒狩りの帳面": { desc: ["使徒狩りの傭兵団の帳面。", "骨の重さと、値段と、売った相手。"], lore: ["狩った連れの骨の重さと、鍛えた武器の値段の帳面。", "売った相手の欄に「砦」「帝国」「教会の騎士」が並ぶ。", "教会の騎士の行だけ、名の代わりに「匿名」とある。", "最後の頁「頭、手が戻らぬ。狩りは次の満月まで休む」。"] },
  "信徒の経典の頁": { desc: ["灰の信徒の経典の、ちぎれた一頁。", "房の寝藁の下に、四つに折って隠してあった。"], lore: ["端に、爪で付けた折り目がいくつもある。", "「戸を叩く声に、答えよ。答えた戸から、苦しみは終わる」。", "裏に別の手で「答えない」と三度書いてある。", "三度目の字だけ、震えていない。"] },
  "行軍の命令書": { desc: ["鐘の教会から鐘の騎士団への命令書。", "宛名の隊の名が、二度書き直してある。"], lore: ["「境を東へ二里。鐘を鳴らしつつ進め。夕べに戻るに及ばず」。", "判は司教の印。日付は、営倉の札の日付の四十二日前。", "宛名の隊の名は、二度消して書き直してある。", "裏に鉛筆で隊の人数。十二から始まり、一で終わる。"] },
  "油の壺": { desc: ["敵 1 体に火を放つ（炎）。", "営倉の見回りが角灯に注いだ油。口は布で縛ってある。"], lore: ["見回りの角灯に注ぎ足すための、素焼きの油の壺。", "札に「詰め所より持ち出し禁ず」。", "禁ず、の字の上に、煤の指の跡が二つ。"] },
  "骨の短剣": { desc: ["攻撃が上がる。戦いのあいだ、少しずつ ＨＰ が減る。", "白い骨を削った刃。柄は人の手の形に馴染む。"], lore: ["骨は人のものではない。継ぎ目が無い。", "柄に、持ち主の名が三つ刻んである。", "上の二つは線で消してある。"] },
  "見張り塔の小鐘": { desc: ["眠りを防ぐ。", "境山の見張り塔に吊ってあった、手のひらほどの鐘。"], lore: ["塔の梁に、同じ形の鉤が七つ並んでいた。", "鐘が残っていたのは、この一つだけ。", "内側に煤で数が書いてある。夕べの数らしい。", "最後の数は千と九十一。その次の行は無い。"] },
  "鐘鳴りの籠手": { desc: ["沈黙を防ぐ。", "手の甲に、小指ほどの鐘が縫い付けてある。"], lore: ["鐘の舌は、布で巻いて結んである。", "鳴らないようにしたのか、鳴らなくなったのか。", "内側に、行軍の日数が刻んである。四十二で止まる。"] },
  "鐘喰いの護符": { desc: ["沈黙を防ぐ。", "鐘の形に削った骨。紐に結び目が三つ。"], lore: ["夜のあとに生まれた子に、親が持たせた。", "鐘の形をしているが、振っても鳴らない。", "子の名の焼き印が、裏で二度押し直してある。"] },
  "坑夫の兜": { desc: ["防御が上がる。", "額に灯を据える金具。金具は空。"], lore: ["坑夫の革の兜。額の金具に、灯を据えた焦げ跡。", "内側に縫い取りで「三番坑　トマ」。", "顎紐は結んだまま、刃物で切ってある。"] },
  "祠守りの頭巾": { desc: ["混乱を防ぐ。魔法防御が上がる。", "崖の上の祠に掛けてあった、灰色の頭巾。"], lore: ["森の祠を守る者が、代々かぶった頭巾。", "縁の刺繍は鐘の形ではなく、木の葉の形。", "祠の戸には、内側から閂が掛けてあった。", "頭巾は閂の上に、たたんで置いてあった。"] },
  "信徒の灰色の帯": { desc: ["毒を防ぐ。魔法防御が上がる。", "灰色に染めた、腰に巻く布の帯。"], lore: ["灰の信徒が、祈りのときに巻いた帯。", "結び目が九つある。房の数と同じ。", "一つだけ、ほどいてから結び直した跡がある。"] },
};
for (const [name, { desc, lore }] of Object.entries(LORE)) {
  for (const line of [...desc, ...lore]) {
    if ([...line].length > 40) throw new Error(`${name} の文が 40 字を超える：${line}`);
  }
}
const descOf = name => LORE[name].desc.join("\n");
const loreOf = name => ["<hai_lore>", ...LORE[name].lore, "</hai_lore>"].join("\n");

// ---------------------------------------------------------------------------
// 共通
// ---------------------------------------------------------------------------
const BAND = [321, 400];
function clearBand(table, makeEmpty) {
  extendTable(table, BAND[0] - 1, makeEmpty);
  for (let id = BAND[0]; id < table.length && id <= BAND[1]; id++) table[id] = makeEmpty(id);
  while (table.length - 1 >= BAND[0] && table.length - 1 <= BAND[1] && table[table.length - 1].name === "") table.pop();
}
function put(table, id, item, makeEmpty) {
  if (id < BAND[0] || id > BAND[1]) throw new Error(`${id} は W7 の帯の外`);
  extendTable(table, id, makeEmpty);
  table[id] = { ...makeEmpty(id), ...item, id };
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------
const emptyItem = id => ({
  id, animationId: 0, consumable: true,
  damage: { critical: false, elementId: 0, formula: "0", type: 0, variance: 20 },
  description: "", effects: [], hitType: 0, iconIndex: 0, itypeId: 1, name: "", note: "",
  occasion: 0, price: 0, repeats: 1, scope: 7, speed: 0, successRate: 100, tpGain: 0,
});
const keyItem = (name, iconIndex) => ({
  name, description: descOf(name), note: loreOf(name), iconIndex, itypeId: 2, consumable: false, occasion: 3, scope: 0,
});
const items = readData("Items.json");
clearBand(items, emptyItem);
put(items, ITEM.keyRing, keyItem("牢番の鍵束", 195), emptyItem);
put(items, ITEM.lantern, keyItem("鐘番の角灯", 212), emptyItem);
put(items, ITEM.dutyTag, keyItem("当番の札（営倉）", 196), emptyItem);
put(items, ITEM.prayerBook, keyItem("教会の祈祷書", 121), emptyItem);
put(items, ITEM.wardenLog, keyItem("牢番の帳面", 228), emptyItem);
put(items, ITEM.graveLedger, keyItem("墓守の帳面", 230), emptyItem);
put(items, ITEM.bellIron, keyItem("鐘鉄の塊", 209), emptyItem);
put(items, ITEM.nameTag, keyItem("砦の名札", 197), emptyItem);
put(items, ITEM.huntLedger, keyItem("使徒狩りの帳面", 229), emptyItem);
put(items, ITEM.scripture, keyItem("信徒の経典の頁", 193), emptyItem);
put(items, ITEM.marchOrder, keyItem("行軍の命令書", 192), emptyItem);
put(items, ITEM.oil, {
  name: "油の壺", description: descOf("油の壺"), note: [loreOf("油の壺"), "<hai_max:3>"].join("\n"),
  iconIndex: 176, animationId: 66, hitType: 0, occasion: 1, scope: 1, price: 0,
  damage: { critical: false, elementId: ELEMENT.fire, formula: "220", type: 1, variance: 10 },
}, emptyItem);
writeTable("Items.json", items);

// ---------------------------------------------------------------------------
// Weapons・Armors
// ---------------------------------------------------------------------------
const emptyWeapon = id => ({
  id, animationId: 0, description: "", etypeId: 1, traits: [{ code: 31, dataId: 1, value: 0 }, { code: 22, dataId: 0, value: 0 }],
  iconIndex: 0, name: "", note: "", params: [0, 0, 0, 0, 0, 0, 0, 0], price: 0, wtypeId: 0,
});
const weapons = readData("Weapons.json");
clearBand(weapons, emptyWeapon);
// 骨の短剣（赤い宝箱・一点もの）。HP 再生率 -3%（ターンの終わりに少しずつ減る）
put(weapons, WEAPON.boneDagger, {
  name: "骨の短剣", description: descOf("骨の短剣"), note: [loreOf("骨の短剣"), "<hai_unique>"].join("\n"),
  animationId: 7, iconIndex: 96, wtypeId: 1, params: [0, 0, 24, 0, 0, 0, 4, 0],
  traits: [{ code: 31, dataId: 1, value: 0 }, { code: 22, dataId: 0, value: 0 }, { code: 22, dataId: 7, value: -0.03 }],
}, emptyWeapon);
writeTable("Weapons.json", weapons);

const emptyArmor = id => ({
  id, atypeId: 1, description: "", etypeId: 4, traits: [{ code: 22, dataId: 1, value: 0 }],
  iconIndex: 0, name: "", note: "", params: [0, 0, 0, 0, 0, 0, 0, 0], price: 0,
});
const armors = readData("Armors.json");
clearBand(armors, emptyArmor);
const accessory = (name, iconIndex, params, traits, unique = false) => ({
  name, description: descOf(name), note: [loreOf(name), ...(unique ? ["<hai_unique>"] : [])].join("\n"),
  atypeId: 1, etypeId: 5, iconIndex, params, traits: [{ code: 22, dataId: 1, value: 0 }, ...traits],
});
put(armors, ARMOR.smallBell, accessory("見張り塔の小鐘", 205, [0, 0, 0, 1, 0, 2, 0, 0], [{ code: 14, dataId: STATE.sleep, value: 0 }], true), emptyArmor);
put(armors, ARMOR.bellGauntlet, accessory("鐘鳴りの籠手", 143, [0, 0, 1, 3, 0, 0, 0, 0], [{ code: 14, dataId: STATE.silence, value: 0 }], true), emptyArmor);
put(armors, ARMOR.bellCharm, accessory("鐘喰いの護符", 146, [0, 0, 0, 0, 0, 3, 0, 1], [{ code: 14, dataId: STATE.silence, value: 0 }]), emptyArmor);
put(armors, ARMOR.ashSash, accessory("信徒の灰色の帯", 147, [0, 0, 0, 1, 0, 6, 0, 0], [{ code: 14, dataId: STATE.poison, value: 0 }], true), emptyArmor);
put(armors, ARMOR.minerHelm, {
  name: "坑夫の兜", description: descOf("坑夫の兜"), note: loreOf("坑夫の兜"),
  atypeId: 1, etypeId: 3, iconIndex: 130, params: [0, 0, 0, 5, 0, 1, 0, 0], traits: [{ code: 22, dataId: 1, value: 0 }],
}, emptyArmor);
put(armors, ARMOR.shrineHood, {
  name: "祠守りの頭巾", description: descOf("祠守りの頭巾"), note: [loreOf("祠守りの頭巾"), "<hai_unique>"].join("\n"),
  atypeId: 2, etypeId: 3, iconIndex: 131, params: [0, 10, 0, 2, 0, 8, 0, 0],
  traits: [{ code: 22, dataId: 1, value: 0 }, { code: 14, dataId: STATE.confuse, value: 0 }],
}, emptyArmor);
writeTable("Armors.json", armors);

// ---------------------------------------------------------------------------
// Skills（敵の技。欄は w1_data.mjs と同じ）
// ---------------------------------------------------------------------------
const emptySkill = id => ({
  id, animationId: 0, damage: { critical: false, elementId: 0, formula: "0", type: 0, variance: 20 },
  description: "", effects: [], hitType: 0, iconIndex: 0, message1: "", message2: "", mpCost: 0, name: "", note: "",
  occasion: 0, repeats: 1, requiredWtypeId1: 0, requiredWtypeId2: 0, scope: 1, speed: 0, stypeId: 0, successRate: 100,
  tpCost: 0, tpGain: 0, messageType: 1,
});
const skills = readData("Skills.json");
clearBand(skills, emptySkill);
const enemySkill = (name, o) => ({ name, occasion: 1, stypeId: 0, hitType: 1, note: "<hai_w7:敵の技>", ...o });
put(skills, SKILL.bellToll, enemySkill("鐘の響き", {
  description: "敵単体の耳元で鐘を鳴らし、声を奪う。", animationId: 48, iconIndex: 205, hitType: 2, scope: 1, message1: "%1の籠手の鐘が鳴った！",
  effects: [{ code: 21, dataId: STATE.silence, value1: 0.6, value2: 0 }],
}), emptySkill);
put(skills, SKILL.mistWhisper, enemySkill("霧の囁き", {
  description: "霧の中から呼びかけ、惑わせる。", animationId: 59, iconIndex: 6, hitType: 2, scope: 1, message1: "%1は霧の向こうから名を呼んだ！",
  effects: [{ code: 21, dataId: STATE.confuse, value1: 0.4, value2: 0 }],
}), emptySkill);
put(skills, SKILL.boneSlash, enemySkill("骨の一閃", {
  description: "骨の刃で深く斬る。", animationId: 7, iconIndex: 96, scope: 1, message1: "%1は骨の刃を振りぬいた！",
  damage: { critical: true, elementId: -1, formula: "a.atk * 4 - b.def * 2", type: 1, variance: 20 },
}), emptySkill);
put(skills, SKILL.bolt, enemySkill("閂を下ろす", {
  description: "鉄の閂で押さえつけ、動けなくする。", animationId: 1, iconIndex: 195, scope: 1, message1: "%1は閂を振り下ろした！",
  damage: { critical: false, elementId: -1, formula: "a.atk * 2 - b.def", type: 1, variance: 20 },
  effects: [{ code: 21, dataId: STATE.bind, value1: 0.5, value2: 0 }],
}), emptySkill);
put(skills, SKILL.noOneOut, enemySkill("誰も出すな", {
  description: "鍵の束を打ち鳴らし、全員を打ち据える。", animationId: 6, iconIndex: 195, scope: 2, message1: "%1は鍵の束を打ち鳴らした！",
  damage: { critical: false, elementId: -1, formula: "a.atk * 2 - b.def", type: 1, variance: 20 },
}), emptySkill);
put(skills, SKILL.packFang, enemySkill("群れの牙", {
  description: "群れで囲んで噛みつく。", animationId: 11, iconIndex: 0, scope: 1, repeats: 2, message1: "%1は仲間と飛びかかった！",
  damage: { critical: false, elementId: -1, formula: "a.atk * 2 - b.def * 2", type: 1, variance: 20 },
}), emptySkill);
writeTable("Skills.json", skills);

// ---------------------------------------------------------------------------
// Enemies・Troops（docs/world.md 5.1・5.5。敵は試みの成れの果て。そうとは名前に書かない。数値は仮で、持ち主が調整する）
// ---------------------------------------------------------------------------
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
const P4 = { poisonHit: 163, sleepClub: 164, whip: 169, chain: 170 };
const drop = (kind, id, denominator) => [{ dataId: id, denominator, kind }, { dataId: 1, denominator: 1, kind: 0 }, { dataId: 1, denominator: 1, kind: 0 }];
const noDrop = drop(0, 1, 1);
// [ID, 名前, 戦闘の絵, 色相, [HP, MP, 攻, 防, 魔, 魔防, 敏, 運], 経験値, 鉄くず, 特徴, 行動, ドロップ]
const ENEMIES = [
  // 霧の森
  [321, "灰犬", "SF_Zombiedog", 0, [110, 0, 17, 9, 8, 8, 22, 10], 7, 5, [T.element(ELEMENT.fire, 1.5)], [attack, act(SKILL.packFang, 3)], drop(1, ITEM.herb, 4)],
  [322, "灰鴉", "Crow", 200, [190, 0, 20, 10, 10, 12, 28, 10], 14, 9, [T.element(ELEMENT.thunder, 1.5)], [attack, act(P4.poisonHit, 3)], drop(1, ITEM.antidote, 5)],
  [323, "迷い人", "SF_Shadow", 0, [300, 20, 22, 14, 16, 16, 12, 10], 20, 14, [T.element(ELEMENT.light, 2), T.physRate(0.8)], [attack, act(SKILL.mistWhisper, 3)], noDrop],
  [324, "鐘鳴りの亡骸", "Blackknight", 30, [460, 0, 28, 26, 8, 14, 10, 10], 30, 22, [T.element(ELEMENT.thunder, 2), T.physRate(0.7)], [attack, guard, act(SKILL.bellToll, 4)], noDrop],
  // 鉄の坑道
  [326, "灰鼠", "Frilledlizard", 160, [120, 0, 18, 10, 8, 8, 20, 10], 8, 6, [], [attack], drop(1, ITEM.bitterRoot, 3)],
  [327, "骨食み", "Sandworm", 90, [260, 0, 22, 24, 8, 10, 8, 10], 16, 12, [T.physRate(0.6), T.element(ELEMENT.fire, 2)], [attack, act(P4.poisonHit, 4)], noDrop],
  [328, "骨の刃の狩人", "Mercenary", 0, [420, 0, 32, 18, 8, 12, 16, 10], 32, 26, [T.element(ELEMENT.ice, 1.5)], [attack, act(SKILL.boneSlash, 3)], noDrop],
  [329, "灯なし", "Berserker", 210, [360, 0, 28, 18, 8, 12, 12, 10], 26, 20, [T.element(ELEMENT.fire, 1.5), T.element(ELEMENT.light, 1.5)], [attack, act(P4.whip, 3)], noDrop],
  [330, "骨鎧の狩人", "Stoneknight", 320, [1500, 0, 38, 30, 8, 18, 18, 10], 90, 50, [T.attackTimes(1), T.element(ELEMENT.ice, 1.5)], [attack, act(SKILL.boneSlash, 4)], noDrop],
  // 営倉
  [331, "房の影", "Wraith", 0, [170, 0, 20, 12, 12, 12, 12, 10], 10, 8, [T.element(ELEMENT.light, 2), T.element(ELEMENT.fire, 1.5)], [attack], drop(1, ITEM.oil, 5)],
  [332, "番の獣", "Wolfman", 250, [520, 0, 32, 20, 8, 12, 20, 10], 34, 24, [T.element(ELEMENT.fire, 1.5)], [attack, act(SKILL.packFang, 4)], noDrop],
  [333, "見回りの亡骸", "Captain", 180, [440, 0, 30, 22, 10, 14, 14, 10], 30, 22, [T.element(ELEMENT.fire, 1.5)], [onTurn(2, 1, 3), onTurn(P4.sleepClub, 2, 3), onTurn(1, 3, 3)], noDrop],
  [334, "鎖の番犬", "SF_Whitewolf", 300, [1600, 0, 38, 26, 8, 16, 30, 10], 90, 45, [T.attackTimes(1)], [attack, act(P4.chain, 3)], noDrop],
  // W15（#231）：夜の戸の声だけの影（木樵の女房。020 の崩れた小屋）。W11 の 701 と同じ型（光に弱く闇に強い・物理を少し減らす）で、
  // 強さは地域一のふつうの敵 1〜2 体分（迷い人と同じ程度。答えたことへの報いではなく、声を聞く場面）。数値は持ち主が調整する
  [336, "声だけの影", "SF_Shadow", 0, [260, 20, 20, 12, 16, 16, 14, 10], 20, 15, [T.element(ELEMENT.light, 2), T.element(ELEMENT.dark, 0.5), T.physRate(0.85)], [attack, act(SKILL.mistWhisper, 2)], drop(1, ITEM.mossAsh, 4)],
];
const WARDEN = 335;
const wardenTraits = [T.physRate(0.7), T.element(ELEMENT.fire, 2), T.element(ELEMENT.ice, 0.5), T.stateRate(STATE.sleep, 0.5), T.stateRate(1, 0)];
const wardenActions = [act(P4.whip), act(SKILL.bolt), onTurn(SKILL.noOneOut, 3, 3, 9), hpBelow(P4.chain, 0.5, 6)];
const enemies = readData("Enemies.json");
clearBand(enemies, emptyEnemy);
for (const [id, name, battlerName, battlerHue, params, exp, gold, traits, actions, dropItems] of ENEMIES) {
  put(enemies, id, { name, battlerName, battlerHue, params, exp, gold, traits: [...base, ...traits], actions, dropItems }, emptyEnemy);
}
put(enemies, WARDEN, {
  name: "牢番", battlerName: "Gatekeeper", battlerHue: 200, params: [2400, 60, 46, 32, 20, 26, 26, 30], exp: 320, gold: 280,
  traits: [...base, ...wardenTraits], actions: wardenActions,
  // 牢番の鍵束は戦いの後のイベントで渡す（035。tools/data/check.mjs が鍵をくれるイベントを見るため）
  dropItems: noDrop,
  note: ["<hai_boss>", "<hai_boss_name:牢番>", "<hai_weak_hint:炎>", `<hai_boss_switch:${FLAG.wardenBoss}>`, "<hai_actions_low:2,50>", "<hai_drop:none>"].join("\n"),
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
  [TROOP.ashDogs, "W7_緑：灰犬×2", [321, 321]],
  [TROOP.ashCrow, "W7_黄：灰鴉", [322]],
  [TROOP.lostOne, "W7_黄：迷い人", [323]],
  [TROOP.bellCorpse, "W7_黄：鐘鳴りの亡骸", [324]],
  [TROOP.lostFlock, "W7_赤：迷い人の群れ", [323, 323, 323]],
  [TROOP.mineRats, "W7_緑：灰鼠×2", [326, 326]],
  [TROOP.boneEater, "W7_緑：骨食み", [327]],
  [TROOP.hunter, "W7_黄：骨の刃の狩人", [328]],
  [TROOP.lampless, "W7_黄：灯なし", [329]],
  [TROOP.boneArmor, "W7_赤：骨鎧の狩人", [330]],
  [TROOP.shade, "W7_緑：房の影×2", [331, 331]],
  [TROOP.watchBeast, "W7_黄：番の獣", [332]],
  [TROOP.roundsman, "W7_黄：見回りの亡骸", [333]],
  [TROOP.chainHound, "W7_赤：鎖の番犬", [334]],
  [TROOP.warden, "W7_ボス：牢番", [WARDEN]],
  [TROOP.nightShade, "W7_黄：声だけの影（木樵の女房）", [336]],
];
const troops = readData("Troops.json");
clearBand(troops, emptyTroop);
for (const [id, name, members] of TROOPS) {
  const pos = row(members.length);
  put(troops, id, { name, members: members.map((enemyId, i) => ({ enemyId, ...pos[i], hidden: false })) }, emptyTroop);
}
// 牢番は同じ文をくり返す（docs/world.md 11 章：命令を読み上げる体言止め）。HP 50% で一度だけ崩れる
const msg = (indent, name, lines) => [
  { code: 101, indent, parameters: ["", 0, 0, 2, name] },
  ...lines.map(text => ({ code: 401, indent, parameters: [text] })),
];
const page0 = emptyTroop(0).pages[0];
troops[TROOP.warden].pages = [
  { ...page0, conditions: { ...page0.conditions, turnA: 2, turnB: 3, turnValid: true }, span: 1,
    list: [...msg(0, "牢番", ["綱に、触れさせぬ。誰も、出すな。"]), { code: 0, indent: 0, parameters: [] }] },
  { ...page0, conditions: { ...page0.conditions, enemyHp: 50, enemyIndex: 0, enemyValid: true }, span: 1,
    list: [
      { code: 111, indent: 0, parameters: [12, "$gameTroop.members()[0].isAlive()"] },
      ...msg(1, "牢番", ["鍵、十二。欠けなし。点呼、九。……九。", "誰も、出していない。"]),
      { code: 0, indent: 1, parameters: [] },
      { code: 412, indent: 0, parameters: [] },
      { code: 0, indent: 0, parameters: [] },
    ] },
];
writeTable("Troops.json", troops);

// ---------------------------------------------------------------------------
// System.json（スイッチ・変数 301–400 の名前）
// ---------------------------------------------------------------------------
const sysPath = dataPath("System.json");
const system = JSON.parse(fs.readFileSync(sysPath, "utf8"));
for (const [key, names] of [["switches", SWITCH_NAMES], ["variables", VARIABLE_NAMES]]) {
  const arr = system[key];
  while (arr.length <= 400) arr.push("");
  for (let id = 301; id <= 400; id++) arr[id] = names[id] ?? "";
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
      if (current !== text) { console.error(`古い: ${rel}（node tools/maps/src/w7_data.mjs で書き直す）`); stale++; }
      else console.log(`一致: ${rel}`);
    } else if (current !== text) {
      fs.writeFileSync(file, text);
      console.log(`書き出し: ${rel}`);
    }
  }
  if (stale) process.exit(1);
}
