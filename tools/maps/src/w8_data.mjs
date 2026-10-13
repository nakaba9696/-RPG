// W8（#155）地域二（焼けた村・記録院・森の療養小屋）のデータベースの項目を書く。何度走らせても同じ結果になる（自分の帯だけを書き直す）。
//   node tools/maps/src/w8_data.mjs           書く
//   node tools/maps/src/w8_data.mjs --check   書かずに、今のファイルと同じかだけ見る（違えば終了コード 1）
// 書くもの（docs/ROADMAP.md の割り当て表の W8：データベース 401–500、スイッチ・変数 401–500）：
//   Items・Weapons・Armors・Skills・States・Enemies・Troops の 421–500
//   401–420 には前の世界の W4 の湖（070–073）の物が残っている。W9 が湖を作り直すまで触らない。
//   ただし前の世界の古書院（080–084）の物（Items 403–405・Weapons 402・Armors 403・Skills 411–419・Enemies/Troops 407–412）は
//   W8 が古書院を記録院に作り直したので空にする（湖の物と同じ帯の中の、使われなくなった番号）。
//   System.json の switches・variables 401–500 の名前
// 説明（2 行目は来歴の一行）と来歴（メモ欄の <hai_lore>）は docs/world.md 8.3 の物はそこから写し、ほかは W8 が書いた。
// マップのイベント（tools/maps/src/w8_maps.mjs が書く w8_*.json）がこの番号を使う（下の ID の表を export する）。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readData, formatTable, dataPath, extendTable } from "../../data/io.mjs";

export const ITEM = {
  sacrificeLedger: 421, scripture: 422, rationTag: 423, copyRegister: 424, bellRecord: 425, twoCopies: 426,
  scholarNotes: 427, sealCopy: 428, dutyTag: 429, hospiceLedger: 430,
  // P9 の拾い物（P の帯。使うだけ）
  herb: 196, antidote: 197, elixir: 198, bitterRoot: 199, mossAsh: 200, sleepIncense: 141, salve: 142, smelling: 143, holyWater: 144,
  // W7 の物（使うだけ）
  lantern: 322, oil: 332, prisonTag: 323,
};
export const WEAPON = { hunterSpear: 421 };
export const ARMOR = { doorShield: 421, lotTag: 422, ashShawl: 423, sealRing: 424, bookmark: 425, watchCloak: 426 };
export const SKILL = {
  offerHand: 421, lotVoice: 422, scorchFang: 423, spearThrow: 424, shrineDoor: 425, readNames: 426,
  eatPaper: 427, inkSpray: 428, silentRead: 429, copyHand: 430, shelfFall: 431, trueName: 432, pageStorm: 433, speakAloud: 434,
};
export const STATE = { named: 421, shut: 422 };
export const ENEMY = {
  ashWeasel: 421, sootCrow: 422, walker: 423, scorchDog: 424, hunterCorpse: 425,
  bookworm: 427, inkShade: 428, silentReader: 429, copyist: 430, shelfWarden: 431,
  voiceShade: 432, // W16（#232）：夜の戸の声だけの影（焼けた村の子）
  shrineWarden: 441, scholar: 442,
};
export const TROOP = {
  weasels: 421, crow: 422, walker: 423, scorchDog: 424, hunterCorpse: 425,
  bookworms: 427, inkShades: 428, silentReader: 429, copyist: 430, shelfWarden: 431,
  voiceShade: 432,
  shrineWarden: 441, scholar: 442,
};
// スイッチ・変数（401–500。System.json に名前を書く）。world.md 4.4 の旗（W6 の帯）は使うだけ：
//   スイッチ 102 記録院の鐘を鳴らした・105 四つ鳴った・変数 101 鳴らした鐘の数・変数 103 生き残りの数
//   スイッチ 124 書庫（Hai_Facilities の open が立てる）・312 道具:鉤綱（W7 の帯。立てるのは W10）
export const SW = {
  annelise: 401, brotherHome: 402, brotherStays: 403, h22: 404, shrineBoss: 405, scholarBoss: 406,
  ismene: 407, h31: 408, lock: 409, runeDoor: 410, pipinel: 411,
  // W16（#232。docs/story/scenes/02-region2-region5.md）
  nightDoorAnswered: 412, nightDoorLegacy: 413, noraFire: 414, sameDay: 415, dilThird: 416,
};
export const VAR = { brother: 401, copies: 402, lockAnswer: 403 };
export const FLAG = { archiveBell: 102, allBells: 105, bellCount: 101, survivors: 103, grapple: 312 };

const SWITCH_NAMES = {
  401: "生き残り:アンネリーゼが砦へ",
  402: "頼み:弟が村へ戻った",
  403: "頼み:弟は信徒に残った",
  404: "村:H22 の閂を外した（064→033）",
  405: "ボス:生贄の祠の番",
  406: "ボス:真名を読んだ学者",
  407: "生き残り:イスメネが砦へ",
  408: "記録院:H31 の閂を外した（082→022）",
  409: "記録院:封じた書架の番号錠",
  410: "記録院:古言の碑の扉（ディル）",
  411: "生き残り:ピピネルが砦へ",
  412: "夜の戸:焼けた村（答えた）",
  413: "夜の戸:焼けた村 言い残し",
  414: "焼けた村:ノラが火の向きを言った",
  415: "記録院:同じ日だ",
  416: "記録院:ディルが三通りを聞いた",
};
const VARIABLE_NAMES = {
  401: "頼み:弟（0 未・1 頼まれた・2 帳面を見せた・3 言い争った）",
  402: "頼み:写し（0 未・1 頼まれた・2 イスメネに返した）",
  403: "記録院:番号錠の答え",
};

const ST = { poison: 141, sleep: 142, confuse: 144, silence: 146, bind: 147 };
const MZ_ST = { silence: 6, confuse: 8, sleep: 10 }; // MZ の既定（仲間の呪文が付ける）
const ELEMENT = { fire: 2, ice: 3, thunder: 4, light: 8, dark: 9 };

const check = process.argv.includes("--check");
const outputs = [];
const writeTable = (name, array) => outputs.push({ file: dataPath(name), text: formatTable(array) });

// ---------------------------------------------------------------------------
// 説明と来歴（1 行は全角 40 字まで。docs/knowhow.md 5.1）
// ---------------------------------------------------------------------------
const LORE = {
  "生贄の帳面": { desc: ["村の祠の帳面。くじの月と、家の名が並ぶ。", "印の欄が、一行だけ空いている。"], lore: ["くじ。収めの月。鍛冶の家の下の娘。印、済。", "くじ。種蒔きの月。粉屋の娘。印、済。", "くじ。刈り入れの月。狩りの家の上の娘、ノラ。印、無し。", "同じ月。同じ家の下の娘、イーダ。印、済。"] },
  "祠の経典": { desc: ["灰の信徒の経典。村の祠の台に置かれていた。", "頁の角が、指の脂で黒く光っている。"], lore: ["「大いなる安らぎの夜。門は内から開かれた」。", "続く頁は、「戸を叩く声に、答えよ」の祈りの写し。", "写した手は一つではない。子どもの字が混じる。", "裏表紙に、くじの棒の数が刻んである。十二。"] },
  "配給札": { desc: ["王国の配給の札。", "表は麦の印。裏は三つの国の字で「一握り」。"], lore: ["王国が飢えの年に配った、木の配給札。", "一枚で、麦が一握り。札は家ごとに一枚。", "裏に、家の人数が刻んである。六。線で消して、五。", "消した線の上から、また六と彫ってある。"] },
  "写しの台帳": { desc: ["記録院の写字室の台帳。誰が何を写したか。", "同じ日付の行が、二つ並んでいる。"], lore: ["写字生の名と、写した物と、渡した先の欄。", "「銘の写し　教会へ」「銘の写し　書架へ」。", "二つの行は同じ日付で、同じ写字生の名。", "表紙の色を書く欄は、二つとも空いている。"] },
  "鐘の古い記録": { desc: ["鐘を鋳た頃の記録。記録院の書架の奥にあった。", "古い言葉の歌の一節が、訳されずに写してある。"], lore: ["頂の大きな鐘と、四つの鐘を鋳た年の記録。", "銘は「森の人の歌」を元に作った、とある。", "歌い手の名を書く欄は、空白のまま。", "訳の欄は三度書き直され、三度とも消してある。"] },
  "二通りの写し": { desc: ["鐘の銘の写し。表紙の色の違う二冊。", "どちらも、同じ写字生の手。"], lore: ["灰色の表紙と、茶色の表紙。中身はほとんど同じ。", "違うのは、終わりの近くの一行。片方に有って、片方に無い。", "灰色の方の裏に「書架へ」。茶色の方には何も無い。", "封じた書架の写字生が、一冊ずつ抱えていた。"] },
  "学者の手記": { desc: ["記録院の学者の手記。", "後ろの頁ほど、字が大きい。"], lore: ["「写しを渡した。あれで良かったのか」。", "次の頁は、同じ一語で埋まっている。", "その一語は読めない。読もうとすると目が滑る。"] },
  "刻印の写し": { desc: ["何かの刻印を、紙に擦り取ったもの。", "擦り取った炭が、紙の裏まで染みている。"], lore: ["大きな石に刻まれた字を、紙に擦り写したもの。", "字は人の文字ではない。線が一筆で戻ってくる。", "隅に学者の字で「名。読むな」。", "紙は四つに折られ、折り目で一度破れている。"] },
  "当番の札（記録院）": { desc: ["鐘の当番の札。記録院の鐘の間に掛けてあった。", "日付のところで、書き付けが止まっている。"], lore: ["記録院の鐘の当番が、鳴らした数を書く札。", "「頂の鐘、鳴らず。こちらも鳴らず」。", "その下に、別の手で「写しの件、明朝」。", "札掛けの釘は四本。残っていたのはこれ一枚。"] },
  "療養小屋の帳面": { desc: ["森の療養小屋の帳面。来た人と、帰った人。", "名の横の印が、途中の頁から無い。"], lore: ["来た者の名と、来た日と、どこが悪かったか。", "名の横に、森の印。木の葉を三枚重ねた形。", "印は途中の頁から無い。名は、その先も続く。", "印の無い名の数だけ、小屋の裏に小石が積んである。"] },
  "使徒狩りの投げ槍": { desc: ["攻撃と敏捷が上がる。", "骨の穂先を付けた短い投げ槍。柄に結び紐。"], lore: ["穂先は白い骨。柄は村の鍬の柄を削ったもの。", "結び紐に、子どもの髪の房が編み込んである。", "柄に刻んだ印は、狩りの数ではなく日の数。", "最後の印の日付は、祠の帳面の最後の日と同じ。"] },
  "戸板の盾": { desc: ["物理の傷を少し減らす。", "村の戸を外して、取っ手を付けた盾。"], lore: ["表に、拳ほどの凹みが三つ縦に並ぶ。", "裏には子どもの字で「こたえない」。", "取っ手の革は新しい。戸のほうは古い。"] },
  "くじの木札": { desc: ["混乱を防ぐ。", "棒くじの、先の黒い一本。"], lore: ["祠のくじに使った、細い木の棒。", "先が黒く塗ってある。これを引いた者が行く。", "畑の土の中に、布に包んで埋めてあった。", "布には、娘の名が二つ縫い取ってある。"] },
  "祠守の灰の肩布": { desc: ["毒を防ぐ。魔法防御が上がる。", "灰色に染めた肩布。端が焦げている。"], lore: ["祠の番が、くじの夜に肩に掛けた布。", "染めたのは灰。洗うと色が落ちる。", "焦げは、炎ではなく、灯を押し当てた跡。", "裏に、くじの数を数えた刺し目。百を越える。"] },
  "封蝋の指輪": { desc: ["沈黙を防ぐ。", "記録院の封蝋の印を彫った、銅の指輪。"], lore: ["書架を封じるときに、蝋に押した印の指輪。", "印は開いた本の形。片方の頁だけ削ってある。", "指の当たる内側が、すり減って薄い。", "封じた書架の錠の箱に、鍵の代わりに入っていた。"] },
  "読み止しの栞": { desc: ["混乱を防ぐ。魔法防御が少し上がる。", "読みかけの頁に挟まっていた、革の栞。"], lore: ["真名の間の、頁の山のいちばん上の本にあった。", "栞の挟まった頁は、最後から三枚目。", "その先の二枚は、白い。", "栞の革に、歯の跡がいくつも。"] },
  "見張りの外套": { desc: ["防御と敏捷が上がる。", "村の見張りが着た、煤けた厚手の外套。"], lore: ["見張り台の屋根の梁に、掛けたままになっていた。", "肩に火の粉の焦げ穴がいくつも。", "内の隠しに、火打ち石が二つ。", "片方の石だけ、すり減って小さい。"] },
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
const BAND = [421, 500];
// 前の世界の古書院（080–084）の物。W8 が作り直したので空にする（湖 070–073 の物は残す）
const OLD_ARCHIVE = {
  "Items.json": [403, 404, 405], "Weapons.json": [402], "Armors.json": [403],
  "Skills.json": [411, 412, 413, 414, 415, 416, 417, 418, 419],
  "Enemies.json": [407, 408, 409, 410, 411, 412], "Troops.json": [407, 408, 409, 410, 411, 412],
};
function clearBand(table, makeEmpty, file) {
  extendTable(table, BAND[0] - 1, makeEmpty);
  for (const id of OLD_ARCHIVE[file] || []) if (id < table.length) table[id] = makeEmpty(id);
  for (let id = BAND[0]; id < table.length && id <= BAND[1]; id++) table[id] = makeEmpty(id);
  while (table.length - 1 >= BAND[0] && table.length - 1 <= BAND[1] && table[table.length - 1].name === "") table.pop();
}
function put(table, id, item, makeEmpty) {
  if (id < BAND[0] || id > BAND[1]) throw new Error(`${id} は W8 の帯（421–500）の外`);
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
clearBand(items, emptyItem, "Items.json");
put(items, ITEM.sacrificeLedger, keyItem("生贄の帳面", 228), emptyItem);
put(items, ITEM.scripture, keyItem("祠の経典", 193), emptyItem);
put(items, ITEM.rationTag, keyItem("配給札", 197), emptyItem);
put(items, ITEM.copyRegister, keyItem("写しの台帳", 229), emptyItem);
put(items, ITEM.bellRecord, keyItem("鐘の古い記録", 121), emptyItem);
put(items, ITEM.twoCopies, keyItem("二通りの写し", 122), emptyItem);
put(items, ITEM.scholarNotes, keyItem("学者の手記", 230), emptyItem);
put(items, ITEM.sealCopy, keyItem("刻印の写し", 192), emptyItem);
put(items, ITEM.dutyTag, keyItem("当番の札（記録院）", 196), emptyItem);
put(items, ITEM.hospiceLedger, keyItem("療養小屋の帳面", 228), emptyItem);
writeTable("Items.json", items);

// ---------------------------------------------------------------------------
// Weapons・Armors
// ---------------------------------------------------------------------------
const emptyWeapon = id => ({
  id, animationId: 0, description: "", etypeId: 1, traits: [{ code: 31, dataId: 1, value: 0 }, { code: 22, dataId: 0, value: 0 }],
  iconIndex: 0, name: "", note: "", params: [0, 0, 0, 0, 0, 0, 0, 0], price: 0, wtypeId: 0,
});
const weapons = readData("Weapons.json");
clearBand(weapons, emptyWeapon, "Weapons.json");
// 使徒狩りの投げ槍（061 の赤い宝箱・一点もの）
put(weapons, WEAPON.hunterSpear, {
  name: "使徒狩りの投げ槍", description: descOf("使徒狩りの投げ槍"), note: [loreOf("使徒狩りの投げ槍"), "<hai_unique>"].join("\n"),
  animationId: 11, iconIndex: 107, wtypeId: 12, params: [0, 0, 26, 0, 0, 0, 8, 0],
  traits: [{ code: 31, dataId: 1, value: 0 }, { code: 22, dataId: 0, value: 0.05 }],
}, emptyWeapon);
writeTable("Weapons.json", weapons);

const emptyArmor = id => ({
  id, atypeId: 1, description: "", etypeId: 4, traits: [{ code: 22, dataId: 1, value: 0 }],
  iconIndex: 0, name: "", note: "", params: [0, 0, 0, 0, 0, 0, 0, 0], price: 0,
});
const armors = readData("Armors.json");
clearBand(armors, emptyArmor, "Armors.json");
const accessory = (name, iconIndex, params, traits, unique = false) => ({
  name, description: descOf(name), note: [loreOf(name), ...(unique ? ["<hai_unique>"] : [])].join("\n"),
  atypeId: 1, etypeId: 5, iconIndex, params, traits: [{ code: 22, dataId: 1, value: 0 }, ...traits],
});
put(armors, ARMOR.doorShield, {
  name: "戸板の盾", description: descOf("戸板の盾"), note: loreOf("戸板の盾"),
  atypeId: 5, etypeId: 2, iconIndex: 128, params: [0, 0, 0, 8, 0, 2, 0, 0], traits: [{ code: 22, dataId: 1, value: 0 }],
}, emptyArmor);
put(armors, ARMOR.lotTag, accessory("くじの木札", 146, [0, 0, 0, 0, 0, 4, 2, 2], [{ code: 14, dataId: ST.confuse, value: 0 }, { code: 14, dataId: MZ_ST.confuse, value: 0 }], true), emptyArmor);
put(armors, ARMOR.ashShawl, accessory("祠守の灰の肩布", 147, [0, 0, 0, 2, 0, 8, 0, 0], [{ code: 14, dataId: ST.poison, value: 0 }], true), emptyArmor);
put(armors, ARMOR.sealRing, accessory("封蝋の指輪", 145, [0, 10, 0, 0, 2, 4, 0, 0], [{ code: 14, dataId: ST.silence, value: 0 }, { code: 14, dataId: MZ_ST.silence, value: 0 }], true), emptyArmor);
put(armors, ARMOR.bookmark, accessory("読み止しの栞", 148, [0, 0, 0, 0, 3, 6, 0, 0], [{ code: 14, dataId: ST.confuse, value: 0 }, { code: 14, dataId: MZ_ST.confuse, value: 0 }], true), emptyArmor);
put(armors, ARMOR.watchCloak, {
  name: "見張りの外套", description: descOf("見張りの外套"), note: [loreOf("見張りの外套"), "<hai_unique>"].join("\n"),
  atypeId: 3, etypeId: 4, iconIndex: 135, params: [0, 0, 0, 9, 0, 3, 4, 0], traits: [{ code: 22, dataId: 1, value: 0 }],
}, emptyArmor);
writeTable("Armors.json", armors);

// ---------------------------------------------------------------------------
// States（ボスの揺らぎと、祠の戸）
// ---------------------------------------------------------------------------
const emptyState = id => ({
  id, autoRemovalTiming: 0, chanceByDamage: 100, iconIndex: 0, maxTurns: 1, message1: "", message2: "", message3: "", message4: "",
  minTurns: 1, motion: 0, name: "", note: "", overlay: 0, priority: 50, releaseByDamage: false, removeAtBattleEnd: true,
  removeByDamage: false, removeByRestriction: false, removeByWalking: false, restriction: 0, stepsToRemove: 100, traits: [],
  messageType: 1,
});
const states = readData("States.json");
clearBand(states, emptyState, "States.json");
// 名を呼ばれた：祠の番が、帳面の最後の名（逃げた娘）を見せられて揺らぐ。戦いの終わりまで、防御と魔法防御が下がり、祠の戸を閉ざせない
put(states, STATE.named, {
  name: "名を呼ばれた", iconIndex: 6, priority: 80, autoRemovalTiming: 0, removeAtBattleEnd: true,
  message3: "%1の手が止まった。", note: "<hai_w8:祠の番のゆらぎ>",
  traits: [{ code: 21, dataId: 3, value: 0.5 }, { code: 21, dataId: 5, value: 0.5 }, { code: 21, dataId: 2, value: 0.8 }, { code: 13, dataId: STATE.shut, value: 0 }],
}, emptyState);
// 祠の戸：祠の番が戸を閉ざす。2 ターン、物理の傷を大きく減らす
put(states, STATE.shut, {
  name: "祠の戸", iconIndex: 14, priority: 60, autoRemovalTiming: 2, minTurns: 2, maxTurns: 2, removeAtBattleEnd: true,
  message1: "%1は祠の戸を背に閉ざした！", message4: "%1の戸がゆるんだ。", note: "<hai_w8:祠の番の守り>",
  traits: [{ code: 23, dataId: 6, value: 0.3 }],
}, emptyState);
writeTable("States.json", states);

// ---------------------------------------------------------------------------
// Skills（敵の技）
// ---------------------------------------------------------------------------
const emptySkill = id => ({
  id, animationId: 0, damage: { critical: false, elementId: 0, formula: "0", type: 0, variance: 20 },
  description: "", effects: [], hitType: 0, iconIndex: 0, message1: "", message2: "", mpCost: 0, name: "", note: "",
  occasion: 0, repeats: 1, requiredWtypeId1: 0, requiredWtypeId2: 0, scope: 1, speed: 0, stypeId: 0, successRate: 100,
  tpCost: 0, tpGain: 0, messageType: 1,
});
const skills = readData("Skills.json");
clearBand(skills, emptySkill, "Skills.json");
const enemySkill = (name, o) => ({ name, occasion: 1, stypeId: 0, hitType: 1, note: "<hai_w8:敵の技>", ...o });
const phys = formula => ({ critical: false, elementId: -1, formula, type: 1, variance: 20 });
const magic = (formula, elementId = 0) => ({ critical: false, elementId, formula, type: 1, variance: 15 });
put(skills, SKILL.offerHand, enemySkill("差し出す手", {
  description: "手首を掴んで引く。", animationId: 1, iconIndex: 0, scope: 1, message1: "%1は手を差し出した！",
  damage: phys("a.atk * 2 - b.def"), effects: [{ code: 21, dataId: ST.bind, value1: 0.4, value2: 0 }],
}), emptySkill);
put(skills, SKILL.lotVoice, enemySkill("くじの声", {
  description: "くじの名を読む声で惑わせる。", animationId: 59, iconIndex: 6, hitType: 2, scope: 1, message1: "%1は名を一つ読み上げた！",
  effects: [{ code: 21, dataId: ST.confuse, value1: 0.4, value2: 0 }],
}), emptySkill);
put(skills, SKILL.scorchFang, enemySkill("焦げ跡の牙", {
  description: "焦げた牙で二度噛む。", animationId: 11, iconIndex: 0, scope: 1, repeats: 2, message1: "%1は低く唸って噛みついた！",
  damage: phys("a.atk * 2 - b.def * 2"),
}), emptySkill);
put(skills, SKILL.spearThrow, enemySkill("骨の穂先", {
  description: "骨の穂先の槍を投げる。", animationId: 11, iconIndex: 107, scope: 1, message1: "%1は槍を投げた！",
  damage: { ...phys("a.atk * 4 - b.def * 2"), critical: true },
}), emptySkill);
put(skills, SKILL.shrineDoor, enemySkill("祠の戸を閉ざす", {
  description: "祠の戸を背にして、傷を受けない構えを取る。", animationId: 52, iconIndex: 14, scope: 11, hitType: 0, message1: "%1は戸の前に立ちふさがった！",
  effects: [{ code: 21, dataId: STATE.shut, value1: 1, value2: 0 }],
}), emptySkill);
put(skills, SKILL.readNames, enemySkill("名を読み上げる", {
  description: "帳面の名を読み上げ、全員を打ち据える。", animationId: 66, iconIndex: 228, scope: 2, message1: "%1は帳面の名を読み上げた！",
  damage: phys("a.atk * 2 - b.def"),
}), emptySkill);
put(skills, SKILL.eatPaper, enemySkill("紙を喰う", {
  description: "紙ごと肌を齧る。", animationId: 11, iconIndex: 0, scope: 1, message1: "%1は齧りついた！",
  damage: phys("a.atk * 2 - b.def"), effects: [{ code: 21, dataId: ST.poison, value1: 0.3, value2: 0 }],
}), emptySkill);
put(skills, SKILL.inkSpray, enemySkill("墨のしぶき", {
  description: "墨を吐きかけ、口を塞ぐ。", animationId: 59, iconIndex: 64, hitType: 2, scope: 1, message1: "%1は墨を吐いた！",
  effects: [{ code: 21, dataId: ST.silence, value1: 0.4, value2: 0 }],
}), emptySkill);
put(skills, SKILL.silentRead, enemySkill("黙読", {
  description: "声を出さずに読み、聞く者の声を奪う。", animationId: 59, iconIndex: 121, hitType: 2, scope: 8, message1: "%1は唇だけを動かして読んだ……",
  effects: [{ code: 21, dataId: ST.silence, value1: 0.3, value2: 0 }],
}), emptySkill);
put(skills, SKILL.copyHand, enemySkill("写し取る", {
  description: "相手の動きを写し取り、同じ所を打つ。", animationId: 7, iconIndex: 0, scope: 1, message1: "%1は筆を走らせた！",
  damage: phys("a.atk * 3 - b.def * 2"),
}), emptySkill);
put(skills, SKILL.shelfFall, enemySkill("書架崩し", {
  description: "書架を倒しかける。", animationId: 6, iconIndex: 0, scope: 8, message1: "%1は書架を揺さぶった！",
  damage: phys("a.atk * 2 - b.def"),
}), emptySkill);
// 学者の技は魔法（沈黙で封じられる。沈黙 146 は技の種類 1・2 を封じる）
put(skills, SKILL.trueName, enemySkill("真名の読み上げ", {
  description: "読めない名を声に出す。聞いた者が裂ける。", animationId: 101, iconIndex: 79, stypeId: 1, hitType: 2, scope: 8,
  message1: "%1は、読めない名を声に出した！", damage: magic("a.mat * 3 - b.mdf"),
}), emptySkill);
put(skills, SKILL.pageStorm, enemySkill("頁の嵐", {
  description: "頁を撒き散らして惑わせる。", animationId: 59, iconIndex: 121, stypeId: 1, hitType: 2, scope: 8,
  message1: "%1の周りで、頁が一斉にめくれた！", effects: [{ code: 21, dataId: ST.confuse, value1: 0.35, value2: 0 }],
}), emptySkill);
put(skills, SKILL.speakAloud, enemySkill("声に出す", {
  description: "一人に向けて、名の一字を読み上げる。", animationId: 102, iconIndex: 79, stypeId: 1, hitType: 2, scope: 1,
  message1: "%1は一字だけ、声に出した！", damage: magic("a.mat * 4 - b.mdf * 2"),
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
};
const base = [{ code: 22, dataId: 0, value: 0.95 }, { code: 22, dataId: 1, value: 0.05 }, { code: 31, dataId: 1, value: 0 }];
const act = (skillId, rating = 5) => ({ conditionParam1: 0, conditionParam2: 0, conditionType: 0, rating, skillId });
const onTurn = (skillId, a, b, rating = 5) => ({ conditionParam1: a, conditionParam2: b, conditionType: 1, rating, skillId });
const hpBelow = (skillId, rate, rating) => ({ conditionParam1: 0, conditionParam2: rate, conditionType: 2, rating, skillId });
const stateIs = (skillId, stateId, rating) => ({ conditionParam1: stateId, conditionParam2: 0, conditionType: 4, rating, skillId });
const attack = act(1);
const guard = act(2, 3);
const drop = (kind, id, denominator) => [{ dataId: id, denominator, kind }, { dataId: 1, denominator: 1, kind: 0 }, { dataId: 1, denominator: 1, kind: 0 }];
const noDrop = drop(0, 1, 1);
// [ID, 名前, 戦闘の絵, 色相, [HP, MP, 攻, 防, 魔, 魔防, 敏, 運], 経験値, 鉄くず, 特徴, 行動, ドロップ]
const ENEMIES = [
  // 焼けた村
  [ENEMY.ashWeasel, "灰鼬", "Frilledlizard", 30, [150, 0, 22, 12, 8, 10, 30, 10], 10, 7, [T.element(ELEMENT.ice, 1.5)], [attack], drop(1, ITEM.herb, 4)],
  [ENEMY.sootCrow, "煤けた鴉", "Crow", 0, [260, 0, 26, 12, 12, 14, 34, 10], 18, 12, [T.element(ELEMENT.thunder, 1.5)], [attack, act(SKILL.scorchFang, 3)], drop(1, ITEM.antidote, 5)],
  [ENEMY.walker, "祠へ歩く者", "SF_Shadow", 160, [380, 20, 26, 16, 18, 20, 12, 10], 26, 18, [T.element(ELEMENT.light, 2), T.physRate(0.8)], [attack, act(SKILL.offerHand, 4), act(SKILL.lotVoice, 3)], noDrop],
  [ENEMY.scorchDog, "焼け跡の番犬", "SF_Zombiedog", 200, [460, 0, 32, 18, 8, 12, 24, 10], 30, 22, [T.element(ELEMENT.ice, 1.5)], [attack, act(SKILL.scorchFang, 4)], drop(1, ITEM.bitterRoot, 3)],
  [ENEMY.hunterCorpse, "使徒狩りの亡骸", "Mercenary", 300, [1700, 0, 42, 30, 8, 18, 22, 10], 100, 55, [T.element(ELEMENT.ice, 1.5)], [attack, act(SKILL.spearThrow, 4)], noDrop],
  // 記録院
  [ENEMY.bookworm, "紙魚", "Sandworm", 40, [140, 0, 22, 12, 8, 12, 18, 10], 9, 6, [T.element(ELEMENT.fire, 2)], [attack, act(SKILL.eatPaper, 3)], drop(1, ITEM.mossAsh, 4)],
  [ENEMY.inkShade, "インクの影", "Wraith", 220, [220, 20, 18, 14, 22, 18, 16, 10], 14, 10, [T.element(ELEMENT.light, 2), T.physRate(0.7)], [attack, act(SKILL.inkSpray, 4)], drop(1, ITEM.holyWater, 5)],
  [ENEMY.silentReader, "黙読者", "Sorcerer", 170, [420, 40, 22, 18, 28, 26, 14, 10], 30, 20, [T.element(ELEMENT.fire, 1.5), T.stateRate(ST.silence, 1.5)], [attack, act(SKILL.silentRead, 4)], noDrop],
  [ENEMY.copyist, "写字の手", "Lich", 120, [480, 0, 34, 20, 10, 16, 20, 10], 32, 22, [T.element(ELEMENT.fire, 1.5)], [attack, act(SKILL.copyHand, 4)], noDrop],
  // 夜の戸の声だけの影（W16。W11 の 701 と同じ型で、強さは焼けた村のふつうの敵 1〜2 体分。言い残しはマップのイベントのメモ欄 <hai_enemy_shade:…>）
  [ENEMY.voiceShade, "声だけの影", "SF_Shadow", 0, [420, 20, 28, 16, 20, 20, 16, 10], 28, 20, [T.element(ELEMENT.light, 2), T.element(ELEMENT.dark, 0.5), T.physRate(0.85)], [attack, act(SKILL.lotVoice, 3)], drop(1, ITEM.mossAsh, 4)],
  [ENEMY.shelfWarden, "書架の番人", "Stoneknight", 60, [1800, 0, 44, 34, 8, 20, 14, 10], 100, 55, [T.element(ELEMENT.thunder, 1.5), T.physRate(0.8)], [attack, act(SKILL.shelfFall, 4)], noDrop],
];
const enemies = readData("Enemies.json");
clearBand(enemies, emptyEnemy, "Enemies.json");
for (const [id, name, battlerName, battlerHue, params, exp, gold, traits, actions, dropItems] of ENEMIES) {
  put(enemies, id, { name, battlerName, battlerHue, params, exp, gold, traits: [...base, ...traits], actions, dropItems }, emptyEnemy);
}
// 生贄の祠の番（063）：「差し出す者を逃がすな」と、まだ祠の戸を守っている。弱み：生贄の帳面の最後の名（逃げた娘）。
//   帳面を持って挑むと、戦いの頭に最後の名を見せる（敵グループのバトルイベント）→ 名を呼ばれた（防御・魔法防御が半分、戸を閉ざせない）。
put(enemies, ENEMY.shrineWarden, {
  name: "生贄の祠の番", battlerName: "Gatekeeper", battlerHue: 30, params: [2800, 60, 48, 36, 20, 30, 24, 30], exp: 380, gold: 300,
  traits: [...base, T.element(ELEMENT.fire, 0.5), T.stateRate(ST.sleep, 0.5), T.stateRate(1, 0)],
  actions: [attack, act(SKILL.offerHand, 4), onTurn(SKILL.shrineDoor, 1, 3, 9), onTurn(SKILL.readNames, 3, 3, 8), hpBelow(SKILL.lotVoice, 0.5, 6)],
  dropItems: noDrop,
  note: ["<hai_boss>", "<hai_boss_name:生贄の祠の番>", `<hai_boss_switch:${SW.shrineBoss}>`, "<hai_actions_low:2,40>", "<hai_drop:none>"].join("\n"),
}, emptyEnemy);
// 真名を読んだ学者（083）：真名を読み解いて狂い、まだ読み続けている。弱み：封じた書架の「声に出すな」の札（沈黙がよく効く。技は魔法）
put(enemies, ENEMY.scholar, {
  name: "真名を読んだ学者", battlerName: "Sorcerer", battlerHue: 300, params: [2600, 400, 30, 28, 52, 40, 30, 30], exp: 420, gold: 320,
  traits: [...base, T.stateRate(ST.silence, 3), T.stateRate(MZ_ST.silence, 3), T.element(ELEMENT.fire, 1.5), T.stateRate(1, 0)],
  actions: [act(SKILL.speakAloud, 6), act(SKILL.pageStorm, 4), onTurn(SKILL.trueName, 2, 3, 9), attack, stateIs(1, ST.silence, 9)],
  dropItems: noDrop,
  note: ["<hai_boss>", "<hai_boss_name:真名を読んだ学者>", "<hai_weak_hint:炎>", `<hai_boss_switch:${SW.scholarBoss}>`, "<hai_actions_low:2,50>", "<hai_drop:none>"].join("\n"),
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
  [TROOP.weasels, "W8_緑：灰鼬×2", [ENEMY.ashWeasel, ENEMY.ashWeasel]],
  [TROOP.crow, "W8_黄：煤けた鴉", [ENEMY.sootCrow]],
  [TROOP.walker, "W8_黄：祠へ歩く者", [ENEMY.walker]],
  [TROOP.scorchDog, "W8_黄：焼け跡の番犬", [ENEMY.scorchDog]],
  [TROOP.hunterCorpse, "W8_赤：使徒狩りの亡骸", [ENEMY.hunterCorpse]],
  [TROOP.bookworms, "W8_緑：紙魚×3", [ENEMY.bookworm, ENEMY.bookworm, ENEMY.bookworm]],
  [TROOP.inkShades, "W8_緑：インクの影×2", [ENEMY.inkShade, ENEMY.inkShade]],
  [TROOP.silentReader, "W8_黄：黙読者", [ENEMY.silentReader]],
  [TROOP.copyist, "W8_黄：写字の手", [ENEMY.copyist]],
  [TROOP.shelfWarden, "W8_赤：書架の番人", [ENEMY.shelfWarden]],
  [TROOP.voiceShade, "W8_緑：声だけの影（焼けた村の子）", [ENEMY.voiceShade]],
  [TROOP.shrineWarden, "W8_ボス：生贄の祠の番", [ENEMY.shrineWarden]],
  [TROOP.scholar, "W8_ボス：真名を読んだ学者", [ENEMY.scholar]],
];
const troops = readData("Troops.json");
clearBand(troops, emptyTroop, "Troops.json");
for (const [id, name, members] of TROOPS) {
  const pos = row(members.length);
  put(troops, id, { name, members: members.map((enemyId, i) => ({ enemyId, ...pos[i], hidden: false })) }, emptyTroop);
}
const msg = (indent, name, lines) => [
  { code: 101, indent, parameters: ["", 0, 0, 2, name] },
  ...lines.map(text => ({ code: 401, indent, parameters: [text] })),
];
const end = indent => ({ code: 0, indent, parameters: [] });
const page0 = emptyTroop(0).pages[0];
const turnPage = (a, b, span, list) => ({ ...page0, conditions: { ...page0.conditions, turnA: a, turnB: b, turnValid: true }, span, list });
const hpPage = (hp, span, list) => ({ ...page0, conditions: { ...page0.conditions, enemyHp: hp, enemyIndex: 0, enemyValid: true }, span, list });
// 祠の番：帳面を持って挑むと「名を呼ばれた」で始まる（弱み）。最後の名の読み上げは戦いの前のマップのイベントに移した
//   （W16。場面表 1-9）。頭の頁は「番の口が止まった」の形。同じ文をくり返す（docs/world.md 5.5）
troops[TROOP.shrineWarden].pages = [
  turnPage(0, 0, 0, [
    { code: 111, indent: 0, parameters: [8, ITEM.sacrificeLedger] },
    ...msg(1, "", ["番の口が、止まった。"]),
    { code: 333, indent: 1, parameters: [0, 0, STATE.named] },
    end(1),
    { code: 411, indent: 0, parameters: [] },
    ...msg(1, "生贄の祠の番", ["差し出す者を、逃がすな。名は、揃っている。"]),
    end(1),
    { code: 412, indent: 0, parameters: [] },
    end(0),
  ]),
  turnPage(3, 3, 1, [...msg(0, "生贄の祠の番", ["一人で、村が残る。一人で。"]), end(0)]),
  hpPage(40, 1, [
    { code: 111, indent: 0, parameters: [12, "$gameTroop.members()[0].isAlive()"] },
    ...msg(1, "生贄の祠の番", ["名は揃っている。……揃っている。", "一つ、足りない。"]),
    end(1),
    { code: 412, indent: 0, parameters: [] },
    end(0),
  ]),
];
// 真名を読んだ学者：読むのをやめない。沈黙すると、唇だけが動き続ける
troops[TROOP.scholar].pages = [
  // ディルがいれば、頭にディルの「頁を伏せろ」（W16。場面表 3-26。弱みの沈黙は今のまま）
  turnPage(0, 0, 0, [
    { code: 111, indent: 0, parameters: [4, 7, 0] },
    ...msg(1, "ディル", ["頁を伏せろ"]),
    ...msg(1, "", ["学者の口が、閉じた。声が出なかった。"]),
    end(1),
    { code: 411, indent: 0, parameters: [] },
    ...msg(1, "", ["唇が、同じ一語の形に動いている。", "音は、まだ出ていない。"]),
    end(1),
    { code: 412, indent: 0, parameters: [] },
    end(0),
  ]),
  hpPage(50, 1, [
    { code: 111, indent: 0, parameters: [12, "$gameTroop.members()[0].isAlive()"] },
    ...msg(1, "", ["一語が、声になった。耳が、音を取り落とす。", "学者の目は、開いた頁の一行から動かない。"]),
    end(1),
    { code: 412, indent: 0, parameters: [] },
    end(0),
  ]),
];
writeTable("Troops.json", troops);

// ---------------------------------------------------------------------------
// System.json（スイッチ・変数 401–500 の名前）
// ---------------------------------------------------------------------------
const sysPath = dataPath("System.json");
const system = JSON.parse(fs.readFileSync(sysPath, "utf8"));
for (const [key, names] of [["switches", SWITCH_NAMES], ["variables", VARIABLE_NAMES]]) {
  const arr = system[key];
  while (arr.length <= 500) arr.push("");
  for (let id = 401; id <= 500; id++) arr[id] = names[id] ?? "";
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
      if (current !== text) { console.error(`古い: ${rel}（node tools/maps/src/w8_data.mjs で書き直す）`); stale++; }
      else console.log(`一致: ${rel}`);
    } else if (current !== text) {
      fs.writeFileSync(file, text);
      console.log(`書き出し: ${rel}`);
    }
  }
  if (stale) process.exit(1);
}
