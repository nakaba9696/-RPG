// W10（#156）地域四（境山の古道 050–054・古い鋳物場と帝国の研究所 090–094）の設定とデータを書く。何度走らせても同じ結果になる。
//   node tools/maps/src/w10_data.mjs           書く（このあと node tools/maps/build.mjs w10_050_ridge_road … で地図を作る）
//   node tools/maps/src/w10_data.mjs --check   書かずに、今のファイルと同じかだけ見る（違えば終了コード 1）
// 書くもの（docs/ROADMAP.md の割り当て表の W10：スイッチ・変数・データベース・コモンイベント 601–700、マップ 050–054・090–094）：
//   tools/maps/src/w10_*.json      地図の設定（イベント・凡例の上書き・スタンプ・散らし）。地図（.txt・.deco.txt）は手で書く
//   Items・Weapons・Armors・Skills・Enemies・Troops の 601–700
//   System.json の switches・variables 601–700 の名前
//   MapInfos.json の 050–053 の名前（前の世界の名前を新しい世界の名前に。054・090–094 は build.mjs が足す）
// 文は docs/world.md 1.4・2.2・2.3・3.2・5 章・6 章・7 章・8 章・11 章から。説明役に語らせない（knowhow.md 2.2）。
// 物語の旗（world.md 4.4。W6 の帯）は使うだけ：スイッチ 104 鋳物場の鐘・105 四つ鳴った・変数 101 鳴らした鐘の数・変数 103 生き残りの数・スイッチ 174 城壁の東門。
// W7 の旗も使うだけ：スイッチ 312 道具:鉤綱（手に入れたら ON）・313 道具:鉄切り鋏。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readData, formatTable, dataPath, extendTable } from "../../data/io.mjs";
import { SRC_DIR } from "../build.mjs";

const check = process.argv.includes("--check");
const outputs = []; // [{ file, text }]

// ---------------------------------------------------------------------------
// イベントの命令の部品（w6_data.mjs と同じ形）
// ---------------------------------------------------------------------------
const cmd = (code, parameters, indent = 0) => ({ code, indent, parameters });
const END = cmd(0, []);
const say = (lines, speaker = "", indent = 0) => [cmd(101, ["", 0, 0, 2, speaker], indent), ...lines.map(l => cmd(401, [l], indent))];
const se = (name, indent = 0, volume = 90, pitch = 100) => cmd(250, [{ name, volume, pitch, pan: 0 }], indent);
const plugin = (name, command, label, args = {}, indent = 0, show = {}) => [
  cmd(357, [name, command, label, args], indent),
  ...Object.entries(args).map(([k, v]) => cmd(657, [`${show[k] ?? k} = ${v}`], indent)),
];
const switchOn = (id, indent = 0) => cmd(121, [id, id, 0], indent);
const selfOn = (ch = "A", indent = 0) => cmd(123, [ch, 0], indent);
const memo = text => `\\C[6]メモ：\\C[0]${text}`;
// 頼みごとの一覧（P12 の Hai_Notes。docs/plugins/Hai_Notes.md）。「名を返す」の段は P12 の変数 164 にも写す
const ERRAND = { key: "name", title: "名を返す", who: "名無し", variableId: 164 };
const errand = (stage, text, indent = 0) => plugin("Hai_Notes", "errand", "頼みごとを進める",
  { key: ERRAND.key, title: ERRAND.title, who: ERRAND.who, stage: String(stage), text, variableId: String(ERRAND.variableId) }, indent);
const errandEnd = (result, text, indent = 0) => plugin("Hai_Notes", "errandEnd", "頼みごとを終える", { key: ERRAND.key, result, text }, indent);
const addNote = (id, text, indent = 0) => plugin("Hai_Thoughts", "addNote", "メモに足す", { text, id, kind: "clue" }, indent);
const transfer = (mapId, x, y, d, indent = 0) => cmd(201, [0, mapId, x, y, d, 0], indent);
const ifSwitch = (id, on = true, indent = 0) => cmd(111, [0, id, on ? 0 : 1], indent);
const ifVar = (id, value, op, indent = 0) => cmd(111, [1, id, 0, value, op], indent); // op 0＝/1≧/2≦/3＞/4＜/5≠
const ifItem = (id, indent = 0) => cmd(111, [8, id], indent);
const ifScript = (expr, indent = 0) => cmd(111, [12, expr], indent);
const ifActor = (actorId, indent = 0) => cmd(111, [4, actorId, 0], indent);
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
const addVar = (id, n, indent = 0) => cmd(122, [id, id, 1, 0, n], indent);
const setVar = (id, n, indent = 0) => cmd(122, [id, id, 0, 0, n], indent);
const comment = (text, indent = 0) => cmd(108, [text], indent);
const indented = (list, by) => list.map(c => ({ ...c, indent: c.indent + by }));

const DOWN = 2, LEFT = 4, RIGHT = 6, UP = 8;
const sourceText = cfg => JSON.stringify(cfg, null, 2) + "\n";
const srcPath = name => path.join(SRC_DIR, name + ".json");

// 絵（持ち主がエディタで決め直してよい。仮の絵）
const IMG = {
  thought: { characterName: "!Flame", characterIndex: 5, direction: DOWN, pattern: 1 }, // 残留思念（青い火。W6 と同じ）
  faint: { characterName: "!Flame", characterIndex: 4, direction: DOWN, pattern: 1 }, // 薄い思念
  memory: { characterName: "!Flame", characterIndex: 5, direction: LEFT, pattern: 1 }, // 記憶の断片
  chest: { characterName: "!Chest", characterIndex: 0, direction: DOWN, pattern: 0 },
  chestOpen: { characterName: "!Chest", characterIndex: 0, direction: UP, pattern: 0 },
  redChest: { characterName: "!Chest", characterIndex: 2, direction: DOWN, pattern: 0 },
  redChestOpen: { characterName: "!Chest", characterIndex: 2, direction: UP, pattern: 0 },
  sparkle: { characterName: "!Other1", characterIndex: 1, direction: DOWN, pattern: 1 }, // 光る点（拾える物）
  warp: { characterName: "!Other2", characterIndex: 3, direction: DOWN, pattern: 1 }, // 結界（W7 と同じ）
  ironShut: { characterName: "!Door1", characterIndex: 0, direction: DOWN, pattern: 2 },
  ironOpen: { characterName: "!Door1", characterIndex: 0, direction: UP, pattern: 2 },
  doorShut: { characterName: "!Door1", characterIndex: 0, direction: DOWN, pattern: 0 },
  doorOpen: { characterName: "!Door1", characterIndex: 0, direction: UP, pattern: 0 },
  gateShut: { characterName: "!$Gate1", characterIndex: 0, direction: DOWN, pattern: 1 },
  gateOpen: { characterName: "!$Gate1", characterIndex: 0, direction: UP, pattern: 1 },
  lever: { characterName: "!Switch1", characterIndex: 0, direction: DOWN, pattern: 0 },
  leverDown: { characterName: "!Switch1", characterIndex: 0, direction: UP, pattern: 0 },
  remainsMan: { characterName: "Damage1", characterIndex: 2, direction: DOWN, pattern: 1 },
  remainsChild: { characterName: "Damage2", characterIndex: 4, direction: DOWN, pattern: 1 },
  sword: { characterName: "!Weapon", characterIndex: 0, direction: DOWN, pattern: 0 },
  beacon: { characterName: "!Flame", characterIndex: 0, direction: DOWN, pattern: 1 },
  guido: { characterName: "People1", characterIndex: 6, direction: DOWN, pattern: 1 },
  nameless: { characterName: "Evil", characterIndex: 7, direction: DOWN, pattern: 1 },
  bonePicker: { characterName: "Evil", characterIndex: 3, direction: LEFT, pattern: 1 },
  rockBearer: { characterName: "Monster", characterIndex: 1, direction: DOWN, pattern: 1 },
  daughter: { characterName: "Nature", characterIndex: 6, direction: DOWN, pattern: 1 },
};

// ---------------------------------------------------------------------------
// ID（W10 の帯 601–700）
// ---------------------------------------------------------------------------
export const ITEM = {
  bunkerKey: 601, grapple: 602, soldierLetter: 603, labReport: 604, dutyTag: 605, tongue: 606,
  boneTag: 607, tradeLedger: 608, guidoLetter: 609, moldIron: 610,
  // W7 の物（使うだけ）
  nameTag: 328,
  // P9 の拾い物（P の帯。使うだけ）
  herb: 196, antidote: 197, elixir: 198, bitterRoot: 199, mossAsh: 200, salve: 142, smelling: 143, holyWater: 144,
};
export const WEAPON = { namelessSpear: 601, moldHammer: 602 };
export const ARMOR = { tuningFork: 601, beaconCloak: 602, imperialShield: 603, backStone: 604, numberBand: 605, moldApron: 606 };
export const SKILL = { oldWord: 601, crossbow: 602, rockSwing: 603, sootBreath: 604, seamClaw: 605, cry: 606, callFather: 607, butt: 608 };
export const ENEMY = {
  goat: 601, wolf: 602, nameless: 603, archer: 604, veteran: 605, rockBearer: 606,
  sootRat: 607, slag: 608, failure: 609, cagedFailure: 610, seamed: 611, daughter: 612,
};
export const TROOP = {
  goats: 601, wolf: 602, nameless: 603, archer: 604, veteran: 605, rockBearer: 606,
  sootRats: 607, slag: 608, failure: 609, cagedFailure: 610, seamed: 611, daughter: 612,
};
// スイッチ・変数（601–700）
export const SW = {
  guido: 602, rockBearer: 604, daughter: 605,
  namelessAsked: 606, namelessGiven: 607, namelessStopped: 608, namelessLeft: 609, namelessSat: 610,
  swordTraded: 611, ledgerRead: 612, pillar: 613, labGate: 614, grating: 615, loverName: 616, eastGate: 617, chute: 618, hook: 619,
};
export const VAR = { nameless: 601 };
// 物語の旗（W6・W7・P11 の帯。使うだけ）
export const FLAG = { bellFoundry: 104, bellsAll: 105, bells: 101, survivors: 103, eastGateFort: 174, grapple: 312, shears: 313, beltranFound: 136 };

const SWITCH_NAMES = {
  602: "生き残り:グィドが砦へ",
  604: "ボス:岩背負い",
  605: "ボス:研究者の娘",
  606: "頼み:名無しの頼みを受けた",
  607: "頼み:名無しに記録を渡した",
  608: "頼み:名無しを止めた（崩れた）",
  609: "頼み:名無しを見逃した（去った）",
  610: "頼み:名無しが座った（恋人の名）",
  611: "骨拾い:名札三つでベルトランの剣",
  612: "骨拾い:取り引きの帳面",
  613: "鋳物場:倒れた柱をどけた",
  614: "鋳物場:研究所の門の綱",
  615: "鋳物場:鉄格子を切った",
  616: "グィド:手紙の名を読んだ",
  617: "東門の外:閂を外した",
  618: "鋳物場:搬入路を滑り降りた（H34）",
  619: "古道:上段に綱を掛けた",
};
const VARIABLE_NAMES = {
  601: "頼み:名を返す（0 未・1 受けた・2 記録を持った・3 終わり）",
};

// ---------------------------------------------------------------------------
// マップの番号と、ほかのレーンのマップの座標
// ---------------------------------------------------------------------------
const MAP = { ridge: 50, camp: 51, beacon: 52, boneCave: 53, eastGate: 54, dock: 90, hall: 91, molds: 92, lab: 93, bell: 94 };
const MINE = { mapId: 26, x: 57, y: 16 }; // 鉄の坑道・上層の東の坑道の端（W7 #145 の docs/maps.md「出入口」）
const DEPTHS = { mapId: 27, x: 44, y: 10 }; // 鉄の坑道・下層の北東の広間（H34 の着く所。027 の側は触らない）
const RAMPART = { mapId: 19, x: 30, y: 9 }; // 城壁の上の東門の内側（W6 #144。東門は (30,10)）

// ---------------------------------------------------------------------------
// 説明と来歴（1 行は全角 40 字まで。docs/knowhow.md 5.1・docs/world.md 8.3）
// ---------------------------------------------------------------------------
const LORE = {
  "地下壕の鍵": { desc: ["帝国の陣跡の地下壕の扉を開ける。", "黒い鉄の鍵。輪に、色の褪せた紐が結んである。"], lore: ["帝国の陣の、地下壕の扉の鍵。", "紐は三つ編み。編み目の途中で、色が変わる。", "グィドの家の、手紙の箱の底にあった。", "箱の蓋の裏に「明日、返す」と書いてある。"] },
  "鉤綱": { desc: ["崖の上に綱を掛けて上れる。", "鉄の鉤に、油を吸った太い綱。"], lore: ["帝国の陣の、援軍の荷車に積んであった綱。", "鉤の爪は四本。一本だけ、打ち直した跡がある。", "綱の端に、結び目で数が作ってある。十二。", "荷車の札は「後発」。先発の札は見当たらない。"] },
  "名無し兵の手紙": { desc: ["帝国の兵の手紙。宛名の欄が空いている。", "字は丁寧で、途中から急に崩れる。"], lore: ["「おまえの名前を書こうとして、思い出せない」。", "「顔は覚えている。たぶん」。", "封は切られていない。届け先が無かった。"] },
  "研究所の報告の写し": { desc: ["帝国の研究所の報告。何十枚もの綴り。", "観察の記録が、一行ずつ並んでいる。"], lore: ["被験者の名の欄は、どれも番号に書き換えてある。", "四十いくつ目の行に、砦の墓守のこと。年を取らない、と。", "最後の頁「教会の彫り直しにより境消滅。研究は継続」。"] },
  "当番の札（鋳物場）": { desc: ["鐘の当番の札。鋳物場の鐘の間に掛けてあった。", "字が、水を吸ったように流れている。"], lore: ["鐘の当番が、鳴らした数を書き付ける札。", "「夕べ」の字までは読める。その先は流れている。", "札の裏は乾いている。濡れたのは表だけ。", "札掛けの釘は四本。残っていた札はこれ一枚。"] },
  "親鐘の舌": { desc: ["鐘の舌。人の腕ほどの太さがある。", "背負子の革紐で、二重に括ってある。"], lore: ["鐘の内側で打つ、鉄の舌。抱えると、胸まである。", "根元の刻印は、四つの鐘のどれとも違う。", "運びの札「舌、鋳物場へ。夜明けまでに戻すこと」。", "背負子の木に、刃物で「かえりは かるい」。"] },
  "骨拾いの荷札": { desc: ["鋳物場の搬入口に落ちていた、荷の札。", "差出人の欄に、鳥の足跡のような印。"], lore: ["「骨　十二本　研究所へ」。", "受け取りの欄に、帝国の判。", "差出人の欄には、字の代わりに、細い三本の線。", "札の紐は、骨を削った留め具で留めてある。"] },
  "取り引きの帳面": { desc: ["骨拾いの取り引きの帳面。", "日付と、売った物と、相手だけが並ぶ。"], lore: ["「帝国へ。骨十二本」。", "「教会へ。銘の古い形。代は骨四本」。", "「灰の信徒へ。夜の時。代は無し」。", "「帝国へ。骨三本。問い：年を取らぬ者はいるか。答え：砦に一人」。", "感想を書く欄は無い。"] },
  "グィドの家の手紙": { desc: ["グィドの家に伝わる、古い手紙。", "宛名は無い。差出人の名だけが、太く書いてある。"], lore: ["「名前を忘れても、帰り道は覚えていて」。", "「わたしの名は、イルゼ。何度でも書きます」。", "便箋の下の半分に、同じ名が十七回。", "グィドの爺さまの、そのまた爺さまの代からある。"] },
  "鋳物場の鐘鉄": { desc: ["鐘の型の部屋に残っていた、鋳る前の鉄。", "白っぽい鉄の棒。叩くと、長く鳴る。"], lore: ["親鐘の型の脇に、四本束ねて立てかけてあった。", "刻印は「教会納め」。坑道の鐘鉄と同じ印。", "束ねた縄の結び目は、鋳物場の結び方。", "四本のうち三本は、途中で切り取られている。"] },
  "古言兵の短槍": { desc: ["攻撃が上がる。", "柄の短い槍。穂先の根元に、彫った字が並ぶ。"], lore: ["帝国の古言兵が持った短槍。", "穂先の根元に、名が一つずつ彫り足してある。", "彫り足すたびに、前の名を削っている。", "残っているのは最後の一つだけ。字が浅い。"] },
  "鋳型の槌": { desc: ["攻撃と防御が少し上がる。", "鋳型を割るための、柄の長い槌。"], lore: ["鋳物場の型師が、冷えた型を割るのに使った槌。", "頭の片側だけが、白く光るほどすり減っている。", "柄に、鐘の数が刻んである。五。", "五の横に、小さく一。消した跡は無い。"] },
  "調律師の音叉": { desc: ["混乱を防ぐ。魔法防御が上がる。", "二股の小さな鉄。指で弾くと、細く長く鳴る。"], lore: ["鐘の音を合わせる、エルフの調律師の道具。", "柄の革は、細い指の形にすり減っている。", "鐘の脚の陰に、布に包んで置いてあった。", "布の端に、閉じた門の刺繍。"] },
  "烽火番の外套": { desc: ["防御が上がる。炎に少し強い。", "煤で黒くなった、厚い毛織りの外套。"], lore: ["境山の烽火台の番が着た外套。", "肩の縫い目に、油の染みが帯になっている。", "裏に、烽火を上げた夜の数が縫い取りで。", "数は三百と少し。最後の縫い目は、途中で糸が切れている。"] },
  "帝国の小盾": { desc: ["防御が上がる。", "黒く塗った鉄の小盾。塗りは半分剥げている。"], lore: ["帝国の兵が、陣で持った小盾。", "裏の革に、持ち主の名を書く欄。", "欄には、何度も書いて消した跡。", "最後は名の代わりに、小さな丸が一つ。"] },
  "背の岩の欠片": { desc: ["防御が上がる。氷に弱くなる。", "岩背負いの背から割れ落ちた、黒い岩。"], lore: ["岩背負いが、背に負っていた岩の欠片。", "割れ目に、霜の筋が残っている。", "裏側は、獣の毛が岩に食いこんで、取れない。"] },
  "番号の腕輪": { desc: ["最大 ＨＰ が上がる。", "子どもの腕に合う、細い鉄の輪。"], lore: ["研究所の檻で、被験者の腕に巻いた鉄の輪。", "刻んであるのは、名ではなく番号。", "内側に、爪で引っかいた字。読めるのは「ね」だけ。", "留め金は、内側から曲げて外してある。"] },
  "型師の前掛け": { desc: ["防御と、炎に強さが上がる。", "焦げ穴だらけの、厚い革の前掛け。"], lore: ["鋳物場の型師が、湯を流すときに着けた前掛け。", "胸の当て布に、鐘の形の焦げ跡。", "紐は、片方だけ新しい革で継いである。"] },
};
for (const [name, { desc, lore }] of Object.entries(LORE)) {
  for (const line of [...desc, ...lore]) {
    if ([...line].length > 40) throw new Error(`${name} の文が 40 字を超える：${line}`);
  }
}
const descOf = name => LORE[name].desc.join("\n");
const loreOf = name => ["<hai_lore>", ...LORE[name].lore, "</hai_lore>"].join("\n");

// ---------------------------------------------------------------------------
// データベースの共通（W7 と同じ。帯だけを書き直す）
// ---------------------------------------------------------------------------
const BAND = [601, 700];
function clearBand(table, makeEmpty) {
  extendTable(table, BAND[0] - 1, makeEmpty);
  for (let id = BAND[0]; id < table.length && id <= BAND[1]; id++) table[id] = makeEmpty(id);
  while (table.length - 1 >= BAND[0] && table.length - 1 <= BAND[1] && table[table.length - 1].name === "") table.pop();
}
function put(table, id, item, makeEmpty) {
  if (id < BAND[0] || id > BAND[1]) throw new Error(`${id} は W10 の帯の外`);
  extendTable(table, id, makeEmpty);
  table[id] = { ...makeEmpty(id), ...item, id };
}
const writeTable = (name, array) => outputs.push({ file: dataPath(name), text: formatTable(array) });

const STATE = { poison: 141, sleep: 142, blind: 143, confuse: 144, silence: 146, bind: 147 };
const ELEMENT = { fire: 2, ice: 3, thunder: 4, light: 8, dark: 9 };

// Items
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
put(items, ITEM.bunkerKey, keyItem("地下壕の鍵", 195), emptyItem);
put(items, ITEM.grapple, keyItem("鉤綱", 234), emptyItem);
put(items, ITEM.soldierLetter, keyItem("名無し兵の手紙", 192), emptyItem);
put(items, ITEM.labReport, keyItem("研究所の報告の写し", 229), emptyItem);
put(items, ITEM.dutyTag, keyItem("当番の札（鋳物場）", 196), emptyItem);
put(items, ITEM.tongue, keyItem("親鐘の舌", 209), emptyItem);
put(items, ITEM.boneTag, keyItem("骨拾いの荷札", 197), emptyItem);
put(items, ITEM.tradeLedger, keyItem("取り引きの帳面", 228), emptyItem);
put(items, ITEM.guidoLetter, keyItem("グィドの家の手紙", 193), emptyItem);
put(items, ITEM.moldIron, keyItem("鋳物場の鐘鉄", 209), emptyItem);
writeTable("Items.json", items);

// Weapons・Armors
const emptyWeapon = id => ({
  id, animationId: 0, description: "", etypeId: 1, traits: [{ code: 31, dataId: 1, value: 0 }, { code: 22, dataId: 0, value: 0 }],
  iconIndex: 0, name: "", note: "", params: [0, 0, 0, 0, 0, 0, 0, 0], price: 0, wtypeId: 0,
});
const weapons = readData("Weapons.json");
clearBand(weapons, emptyWeapon);
put(weapons, WEAPON.namelessSpear, {
  name: "古言兵の短槍", description: descOf("古言兵の短槍"), note: [loreOf("古言兵の短槍"), "<hai_unique>"].join("\n"),
  animationId: 11, iconIndex: 101, wtypeId: 12, params: [0, 0, 30, 0, 0, 0, 2, 0],
}, emptyWeapon);
put(weapons, WEAPON.moldHammer, {
  name: "鋳型の槌", description: descOf("鋳型の槌"), note: [loreOf("鋳型の槌"), "<hai_unique>"].join("\n"),
  animationId: 1, iconIndex: 104, wtypeId: 4, params: [0, 0, 26, 6, 0, 0, -2, 0],
}, emptyWeapon);
writeTable("Weapons.json", weapons);

const emptyArmor = id => ({
  id, atypeId: 1, description: "", etypeId: 4, traits: [{ code: 22, dataId: 1, value: 0 }],
  iconIndex: 0, name: "", note: "", params: [0, 0, 0, 0, 0, 0, 0, 0], price: 0,
});
const armors = readData("Armors.json");
clearBand(armors, emptyArmor);
const armor = (name, { atypeId = 1, etypeId, iconIndex, params, traits = [], unique = false }) => ({
  name, description: descOf(name), note: [loreOf(name), ...(unique ? ["<hai_unique>"] : [])].join("\n"),
  atypeId, etypeId, iconIndex, params, traits: [{ code: 22, dataId: 1, value: 0 }, ...traits],
});
put(armors, ARMOR.tuningFork, armor("調律師の音叉", { etypeId: 5, iconIndex: 145, params: [0, 0, 0, 0, 0, 8, 0, 0], traits: [{ code: 14, dataId: STATE.confuse, value: 0 }], unique: true }), emptyArmor);
put(armors, ARMOR.beaconCloak, armor("烽火番の外套", { atypeId: 2, etypeId: 4, iconIndex: 135, params: [0, 0, 0, 12, 0, 4, 0, 0], traits: [{ code: 11, dataId: ELEMENT.fire, value: 0.8 }] }), emptyArmor);
put(armors, ARMOR.imperialShield, armor("帝国の小盾", { etypeId: 2, iconIndex: 128, params: [0, 0, 0, 8, 0, 2, 0, 0] }), emptyArmor);
put(armors, ARMOR.backStone, armor("背の岩の欠片", { etypeId: 5, iconIndex: 147, params: [0, 0, 0, 14, 0, 0, -4, 0], traits: [{ code: 11, dataId: ELEMENT.ice, value: 1.3 }], unique: true }), emptyArmor);
put(armors, ARMOR.numberBand, armor("番号の腕輪", { etypeId: 5, iconIndex: 146, params: [60, 0, 0, 0, 0, 0, 0, 0], unique: true }), emptyArmor);
put(armors, ARMOR.moldApron, armor("型師の前掛け", { atypeId: 3, etypeId: 4, iconIndex: 136, params: [0, 0, 0, 16, 0, 2, -2, 0], traits: [{ code: 11, dataId: ELEMENT.fire, value: 0.7 }] }), emptyArmor);
writeTable("Armors.json", armors);

// Skills（敵の技。欄は W7 と同じ）
const emptySkill = id => ({
  id, animationId: 0, damage: { critical: false, elementId: 0, formula: "0", type: 0, variance: 20 },
  description: "", effects: [], hitType: 0, iconIndex: 0, message1: "", message2: "", mpCost: 0, name: "", note: "",
  occasion: 0, repeats: 1, requiredWtypeId1: 0, requiredWtypeId2: 0, scope: 1, speed: 0, stypeId: 0, successRate: 100,
  tpCost: 0, tpGain: 0, messageType: 1,
});
const skills = readData("Skills.json");
clearBand(skills, emptySkill);
const enemySkill = (name, o) => ({ name, occasion: 1, stypeId: 0, hitType: 1, note: "<hai_w10:敵の技>", ...o });
put(skills, SKILL.oldWord, enemySkill("古言の残り", {
  description: "短い古い言葉で、声を奪う。", animationId: 59, iconIndex: 6, hitType: 2, scope: 1, message1: "%1は短い音を口にした！",
  effects: [{ code: 21, dataId: STATE.silence, value1: 0.6, value2: 0 }],
}), emptySkill);
put(skills, SKILL.crossbow, enemySkill("弩の一射", {
  description: "弩で射抜く。", animationId: 11, iconIndex: 102, scope: 1, message1: "%1は弩を放った！",
  damage: { critical: true, elementId: -1, formula: "a.atk * 3 - b.def * 2", type: 1, variance: 20 },
}), emptySkill);
put(skills, SKILL.rockSwing, enemySkill("背の岩を振る", {
  description: "背の岩ごと身を振り、全員をなぎ倒す。", animationId: 6, iconIndex: 0, scope: 2, message1: "%1は背の岩ごと身をよじった！",
  damage: { critical: false, elementId: -1, formula: "a.atk * 3 - b.def * 2", type: 1, variance: 20 },
}), emptySkill);
put(skills, SKILL.sootBreath, enemySkill("煤の息", {
  description: "煤を吐きかけ、目をくらませる。", animationId: 59, iconIndex: 0, hitType: 2, scope: 2, message1: "%1は煤を吐いた！",
  effects: [{ code: 21, dataId: STATE.blind, value1: 0.4, value2: 0 }],
}), emptySkill);
put(skills, SKILL.seamClaw, enemySkill("継ぎ目の爪", {
  description: "継ぎ合わせた腕で、二度引き裂く。", animationId: 7, iconIndex: 0, scope: 1, repeats: 2, message1: "%1は継ぎ目のある腕を振るった！",
  damage: { critical: false, elementId: -1, formula: "a.atk * 2 - b.def", type: 1, variance: 20 },
}), emptySkill);
put(skills, SKILL.cry, enemySkill("泣き声", {
  description: "高い泣き声で、全員を惑わせる。", animationId: 59, iconIndex: 0, hitType: 2, scope: 2, message1: "%1は泣き声を上げた！",
  effects: [{ code: 21, dataId: STATE.confuse, value1: 0.35, value2: 0 }],
}), emptySkill);
put(skills, SKILL.callFather, enemySkill("父を呼ぶ", {
  description: "父の名を呼び、身を固くする。", animationId: 52, iconIndex: 0, hitType: 0, scope: 11, message1: "%1は父の名を呼んだ。",
  damage: { critical: false, elementId: 0, formula: "a.mhp * 0.08", type: 3, variance: 0 },
}), emptySkill);
put(skills, SKILL.butt, enemySkill("角で突く", {
  description: "頭を低くして突く。", animationId: 1, iconIndex: 0, scope: 1, message1: "%1は角で突いてきた！",
  damage: { critical: false, elementId: -1, formula: "a.atk * 3 - b.def * 2", type: 1, variance: 20 },
}), emptySkill);
writeTable("Skills.json", skills);

// Enemies・Troops（docs/world.md 5.1・5.5。古道は「名無し」、研究所は「失敗作」。そうとは名前と説明に書かない。数値は仮で、持ち主が調整する）
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
const attack = act(1);
const guard = act(2, 3);
const drop = (kind, id, denominator) => [{ dataId: id, denominator, kind }, { dataId: 1, denominator: 1, kind: 0 }, { dataId: 1, denominator: 1, kind: 0 }];
const noDrop = drop(0, 1, 1);
// [ID, 名前, 戦闘の絵, 色相, [HP, MP, 攻, 防, 魔, 魔防, 敏, 運], 経験値, 鉄くず, 特徴, 行動, ドロップ]
const ENEMIES = [
  // 境山の古道（第2段階。地域一より少し強い）
  [ENEMY.goat, "灰山羊", "Unicorn", 200, [320, 0, 30, 18, 8, 12, 24, 10], 22, 16, [T.element(ELEMENT.fire, 1.5)], [attack, act(SKILL.butt, 4)], drop(1, ITEM.herb, 4)],
  [ENEMY.wolf, "尾根の狼", "SF_Wolf", 180, [380, 0, 34, 16, 8, 12, 30, 10], 26, 18, [T.element(ELEMENT.fire, 1.5)], [attack], drop(1, ITEM.antidote, 5)],
  [ENEMY.nameless, "名無し", "Sorcerer", 180, [620, 40, 36, 24, 26, 26, 18, 10], 44, 30, [T.element(ELEMENT.light, 1.5), T.stateRate(STATE.silence, 0)], [attack, guard, act(SKILL.oldWord, 4)], noDrop],
  [ENEMY.archer, "名無しの射手", "Captain", 90, [540, 0, 40, 20, 8, 18, 26, 10], 42, 28, [T.element(ELEMENT.thunder, 1.5)], [attack, act(SKILL.crossbow, 5)], noDrop],
  [ENEMY.veteran, "名無しの古兵", "Stoneknight", 120, [1900, 40, 48, 34, 20, 26, 20, 10], 120, 70, [T.element(ELEMENT.light, 1.5), T.physRate(0.8)], [attack, act(SKILL.oldWord, 3), act(SKILL.crossbow, 3)], noDrop],
  // 古い鋳物場と研究所
  [ENEMY.sootRat, "煤鼠", "Frilledlizard", 300, [300, 0, 30, 16, 8, 10, 26, 10], 20, 14, [T.element(ELEMENT.ice, 1.5)], [attack, act(SKILL.sootBreath, 2)], drop(1, ITEM.bitterRoot, 4)],
  [ENEMY.slag, "鋳くず", "Demonpot", 30, [420, 0, 32, 30, 8, 10, 10, 10], 28, 22, [T.element(ELEMENT.ice, 2), T.physRate(0.7)], [attack, act(SKILL.sootBreath, 3)], noDrop],
  [ENEMY.failure, "失敗作", "Zombie", 260, [700, 0, 40, 24, 8, 16, 16, 10], 48, 32, [T.element(ELEMENT.light, 2), T.element(ELEMENT.fire, 1.5)], [attack, act(SKILL.seamClaw, 3)], noDrop],
  [ENEMY.cagedFailure, "檻の失敗作", "Wolfman", 270, [560, 0, 42, 18, 8, 12, 32, 10], 46, 30, [T.element(ELEMENT.light, 2)], [attack, act(SKILL.seamClaw, 4)], noDrop],
  [ENEMY.seamed, "継ぎ目の失敗作", "Demon", 280, [2200, 0, 52, 32, 8, 20, 22, 10], 140, 80, [T.element(ELEMENT.light, 2), T.physRate(0.85)], [attack, act(SKILL.seamClaw, 4), act(SKILL.sootBreath, 2)], noDrop],
];
const enemies = readData("Enemies.json");
clearBand(enemies, emptyEnemy);
for (const [id, name, battlerName, battlerHue, params, exp, gold, traits, actions, dropItems] of ENEMIES) {
  put(enemies, id, { name, battlerName, battlerHue, params, exp, gold, traits: [...base, ...traits], actions, dropItems }, emptyEnemy);
}
// 岩背負い（任意のボス。052 の橋のたもと）。弱みの手がかりは「背の岩の割れ目」（霜が降りると丸まる）→ 氷
put(enemies, ENEMY.rockBearer, {
  name: "岩背負い", battlerName: "Hi_monster", battlerHue: 0, params: [3600, 0, 54, 46, 10, 20, 14, 30], exp: 380, gold: 300,
  traits: [...base, T.physRate(0.7), T.element(ELEMENT.ice, 2), T.element(ELEMENT.fire, 0.5), T.stateRate(1, 0)],
  actions: [attack, act(SKILL.rockSwing, 4), onTurn(2, 2, 3, 6)],
  dropItems: noDrop,
  note: ["<hai_boss>", "<hai_boss_name:岩背負い>", "<hai_weak_hint:氷>", `<hai_boss_switch:${SW.rockBearer}>`, "<hai_drop:none>"].join("\n"),
}, emptyEnemy);
// 研究者の娘（093）。弱みの手がかりは観察記録の「光を嫌う」→ 光
put(enemies, ENEMY.daughter, {
  name: "研究者の娘", battlerName: "Sylph", battlerHue: 260, params: [4200, 120, 50, 30, 46, 34, 30, 30], exp: 520, gold: 360,
  traits: [...base, T.element(ELEMENT.light, 2), T.element(ELEMENT.dark, 0.3), T.stateRate(STATE.confuse, 0), T.stateRate(1, 0)],
  actions: [act(SKILL.seamClaw), act(SKILL.cry, 4), onTurn(SKILL.callFather, 3, 3, 8), hpBelow(SKILL.seamClaw, 0.5, 7)],
  dropItems: noDrop,
  note: ["<hai_boss>", "<hai_boss_name:研究者の娘>", "<hai_weak_hint:光>", `<hai_boss_switch:${SW.daughter}>`, "<hai_actions_low:2,50>", "<hai_drop:none>"].join("\n"),
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
  [TROOP.goats, "W10_緑：灰山羊×2", [ENEMY.goat, ENEMY.goat]],
  [TROOP.wolf, "W10_緑：尾根の狼", [ENEMY.wolf]],
  [TROOP.nameless, "W10_黄：名無し", [ENEMY.nameless]],
  [TROOP.archer, "W10_黄：名無しの射手", [ENEMY.archer]],
  [TROOP.veteran, "W10_赤：名無しの古兵", [ENEMY.veteran]],
  [TROOP.rockBearer, "W10_ボス：岩背負い", [ENEMY.rockBearer]],
  [TROOP.sootRats, "W10_緑：煤鼠×2", [ENEMY.sootRat, ENEMY.sootRat]],
  [TROOP.slag, "W10_緑：鋳くず", [ENEMY.slag]],
  [TROOP.failure, "W10_黄：失敗作", [ENEMY.failure]],
  [TROOP.cagedFailure, "W10_黄：檻の失敗作", [ENEMY.cagedFailure]],
  [TROOP.seamed, "W10_赤：継ぎ目の失敗作", [ENEMY.seamed]],
  [TROOP.daughter, "W10_ボス：研究者の娘", [ENEMY.daughter]],
];
const troops = readData("Troops.json");
clearBand(troops, emptyTroop);
for (const [id, name, members] of TROOPS) {
  const pos = row(members.length);
  put(troops, id, { name, members: members.map((enemyId, i) => ({ enemyId, ...pos[i], hidden: false })) }, emptyTroop);
}
// 研究者の娘は父を呼ぶ（docs/world.md 5.5「父の研究所から出られない。父の名を呼ぶ」）。自分の願いだけをくり返す
const msg = (indent, name, lines) => [
  { code: 101, indent, parameters: ["", 0, 0, 2, name] },
  ...lines.map(text => ({ code: 401, indent, parameters: [text] })),
];
const page0 = emptyTroop(0).pages[0];
troops[TROOP.daughter].pages = [
  { ...page0, conditions: { ...page0.conditions, turnA: 2, turnB: 3, turnValid: true }, span: 1,
    list: [...msg(0, "研究者の娘", ["父さま。窓を、閉めて。まぶしいの。"]), { code: 0, indent: 0, parameters: [] }] },
  { ...page0, conditions: { ...page0.conditions, enemyHp: 50, enemyIndex: 0, enemyValid: true }, span: 1,
    list: [
      { code: 111, indent: 0, parameters: [12, "$gameTroop.members()[0].isAlive()"] },
      ...msg(1, "研究者の娘", ["父さま、まだ？　番号じゃなくて、名前で呼んで。"]),
      { code: 0, indent: 1, parameters: [] },
      { code: 412, indent: 0, parameters: [] },
      { code: 0, indent: 0, parameters: [] },
    ] },
];
troops[TROOP.rockBearer].pages = [
  { ...page0, conditions: { ...page0.conditions, enemyHp: 50, enemyIndex: 0, enemyValid: true }, span: 1,
    list: [
      { code: 111, indent: 0, parameters: [12, "$gameTroop.members()[0].isAlive()"] },
      ...msg(1, "", ["背の岩の割れ目から、白い息が漏れた。"]),
      { code: 0, indent: 1, parameters: [] },
      { code: 412, indent: 0, parameters: [] },
      { code: 0, indent: 0, parameters: [] },
    ] },
];
writeTable("Troops.json", troops);

// ---------------------------------------------------------------------------
// イベントの部品
// ---------------------------------------------------------------------------
const text = (name, [x, y], lines, extra = {}) => ({ name, type: "text", x, y, lines, ...extra });
const thought = (id, name, [x, y], lines, note = "") => ({
  name: `思念 ${id} ${name}`, type: "text", x, y, note: `<hai_thought:${id}>${note}`, image: IMG.thought, lines,
});
const memory = (actorId, n, who, [x, y], lines, image = IMG.memory) => ({
  name: `記憶 ${who} ${n}`, type: "text", x, y, note: `<hai_memory:${actorId},${n}>`, image, lines,
});
const faint = (id, name, [x, y], lines) => ({
  name: `薄い思念 ${id} ${name}`, type: "raw", x, y, note: `<hai_faint:${id}>`,
  pages: [{ image: IMG.faint, priorityType: 1, list: [...say(lines), cmd(117, [201]), END] }],
});
const exit = (name, [x, y], mapId, tx, ty, d) => ({ name, type: "transfer", x, y, to: [mapId, tx, ty, d] });
const exits = (name, cells, mapId, tx, ty, d) => cells.map(c => exit(name, c, mapId, tx, ty, d));
const chestEvent = (name, [x, y], gainList, gotText, red = false) => ({
  name: red ? `赤い宝箱（${name}）` : `宝箱（${name}）`, type: "raw", x, y,
  pages: [
    { image: red ? IMG.redChest : IMG.chest, priorityType: 1, walkAnime: false,
      list: [se("Chest1"), ...gainList, selfOn(), ...say([gotText]), END] },
    { conditions: { selfSwitchCh: "A", selfSwitchValid: true }, image: red ? IMG.redChestOpen : IMG.chestOpen, priorityType: 1, walkAnime: false },
  ],
});
const chestItem = (name, xy, id, n, icon) => chestEvent(name, xy, [gainItem(id, n)], `\\I[${icon}]${name}${n > 1 ? `×${n}` : ""}を手に入れた！`);
const chestGold = (xy, n) => chestEvent("鉄くず", xy, [gainGold(n)], `鉄くずを ${n} 手に入れた。`);
const chestArmor = (name, xy, id, icon, red = false) => chestEvent(name, xy, [gainArmor(id)], `\\I[${icon}]${name}を手に入れた！`, red);
const chestWeapon = (name, xy, id, icon, red = false) => chestEvent(name, xy, [gainWeapon(id)], `\\I[${icon}]${name}を手に入れた！`, red);
// 拾える物（光る点。調べると拾って消える）
const pickup = (name, [x, y], gainList, lines, extra = []) => ({
  name: `拾い物（${name}）`, type: "raw", x, y,
  pages: [
    { image: IMG.sparkle, priorityType: 1, stepAnime: true, walkAnime: false,
      list: [...(lines.length ? say(lines) : []), se("Item3"), ...gainList, selfOn(), ...extra, END] },
    { conditions: { selfSwitchCh: "A", selfSwitchValid: true }, priorityType: 0 },
  ],
});
const pickItem = (name, xy, id, n, icon, lines = []) => pickup(name, xy, [gainItem(id, n), ...say([`\\I[${icon}]${name}${n > 1 ? `×${n}` : ""}を手に入れた！`])], lines);
const pickGold = (xy, n, lines = []) => pickup("鉄くず", xy, [gainGold(n), ...say([`鉄くずを ${n} 手に入れた。`])], lines);
const warp = (name, [x, y]) => ({
  name: `結界（${name}）`, type: "raw", x, y, note: `<hai_warp:${name}>`,
  pages: [{ image: IMG.warp, priorityType: 1, stepAnime: true, list: [END] }],
});
// シンボル敵（docs/plugins/Hai_SymbolEnemy.md。緑は往復かランダム、赤は持ち場から出ない）。
// 弱い化け物（緑）は <hai_enemy_hesitate>（P12 #151 のためらい）
const ENEMY_IMG = {
  [TROOP.goats]: { characterName: "Nature", characterIndex: 3 },
  [TROOP.wolf]: { characterName: "Monster", characterIndex: 2 },
  [TROOP.nameless]: { characterName: "Evil", characterIndex: 7 },
  [TROOP.archer]: { characterName: "Evil", characterIndex: 1 },
  [TROOP.veteran]: { characterName: "Monster", characterIndex: 3 },
  [TROOP.sootRats]: { characterName: "Nature", characterIndex: 1 },
  [TROOP.slag]: { characterName: "Monster", characterIndex: 4 },
  [TROOP.failure]: { characterName: "Monster", characterIndex: 5 },
  [TROOP.cagedFailure]: { characterName: "Monster", characterIndex: 2 },
  [TROOP.seamed]: { characterName: "Monster", characterIndex: 6 },
};
const NAMES = Object.fromEntries(TROOPS.map(([id, name]) => [id, name.replace(/^W10_.：/, "").replace(/×\d$/, "")]));
const routeOf = steps => ({ list: [...steps.map(code => ({ code, parameters: [] })), { code: 0, parameters: [] }], repeat: true, skippable: true, wait: false });
const MOVE = { down: 1, left: 2, right: 3, up: 4 };
/** 敵。kind は "random"（ランダム）・"fixed"（固定）・{ dir: "right", n: 4 }（往復） */
const foe = (troopId, rank, [x, y], kind = "random", chase = null) => {
  const rankName = { green: "緑", yellow: "黄", red: "赤" }[rank];
  const page = { image: { ...ENEMY_IMG[troopId], direction: DOWN, pattern: 1 }, priorityType: 1, moveSpeed: 3, trigger: 2, moveFrequency: 3 };
  let label = "";
  if (kind === "random") { page.moveType = 1; label = ""; }
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

// ===========================================================================
// 050 境山の古道・尾根道（80×60。段が 3 つ：段 0 戦場の跡・段 1 尾根道・段 2 上段（鉤綱））
// ===========================================================================
// 上段への崖（側面の行の綱の掛かるマス (16,13)）。鉤綱が無い間は通せんぼ、掛けたら綱を伝って上り下りできる（スイッチ 619）
const HOOK = [16, 13];
const hook = {
  name: "上段の崖（綱を掛ける）", type: "raw", x: HOOK[0], y: HOOK[1],
  pages: [
    { priorityType: 1,
      list: [
        ifSwitch(FLAG.grapple),
        ...say(["崖の上に、尖った岩の角が突き出ている。"], "", 1),
        choice(["綱を掛ける", "やめる"], 1, 1),
        when(0, "綱を掛ける", 1),
        se("Jump1", 2),
        ...say(["鉤が岩の角に噛んだ。綱を伝えば、上の段へ上れる。"], "", 2),
        switchOn(SW.hook, 2),
        end(2),
        when(1, "やめる", 1),
        end(2),
        ENDCHOICE(1),
        end(1),
        ELSE(),
        ...say(["崖の上に、尖った岩の角が突き出ている。", "綱を掛ければ、上れそうだ。"], "", 1),
        end(1),
        ENDIF(),
        END,
      ] },
    { conditions: { switch1Id: SW.hook, switch1Valid: true }, priorityType: 0 },
  ],
};
const ridgeEvents = [
  ...exits("西の坑口（鉄の坑道へ）", [[0, 17], [0, 18], [0, 19]], MINE.mapId, MINE.x, MINE.y, "left"),
  ...exits("北の道（帝国の陣跡へ）", [[54, 0], [55, 0], [56, 0]], MAP.camp, 25, 38, "up"),
  ...exits("南の下り道（城壁の東門の外へ）", [[60, 59], [61, 59], [62, 59]], MAP.eastGate, 38, 11, "left"),
  text("古い道標", [3, 16], ["古い道標。字は三つ。", "「砦　西」「陣　北」「頂　東」。", "東の字の上にだけ、灰が厚く積もっている。"], { image: { tileId: "B:137" } }),
  thought("R4-01", "名を払った兵", [12, 44], [
    "名を払え、と言われた。払った。",
    "次は顔を払え、と言われた。鏡が無いので、払えたかどうか分からない。",
    "隣の奴に聞いた。隣の奴は、俺の名を知らなかった。",
    "そりゃそうだ。払ったんだから。",
  ]),
  thought("R4-02", "子鐘の塔の番", [50, 9], [
    "塔の小鐘は、頂が鳴ったら鳴らす。頂が鳴らない夜は、鳴らさない。",
    "三晩、鳴らしていない。",
    "四晩目の油を、今、注いだ。",
  ]),
  thought("R4-03", "東門へ荷を運んだ男", [63, 50], [
    "砦の東門は、内からは開かない。外から閂を外す決まりだ。",
    "決まりを作った奴は、外で夜を明かしたことが無いんだろう。",
    "荷は門の前に置いた。叩いても、誰も出てこなかった。",
  ], "<hai_clue:城壁の東門は、外から閂を外す（境山の古道の南の下り道）>"),
  thought("R4-04", "選べなかった兵", [75, 23], [
    "古言を一つ使うと、一つ払う。今日は二つ使った。",
    "夕飯の味と、妹の顔。",
    "明日は何を払うか、選べるといい。",
  ]),
  text("倒れた子鐘の塔", [48, 9], ["石を積んだ細い塔が、尾根に倒れている。", "折れた梁の鉤に、小さな鐘が一つ、引っかかったまま。", "鐘の口は、砦の方を向いている。"]),
  text("帝国の兵の骸", [5, 38], ["黒く塗った鎧の骸。胸当ての名の欄が、削ってある。"]),
  text("突き立った槍", [9, 41], ["地面に槍が三本、まっすぐ立てて並べてある。", "倒れたのではない。誰かが立てて並べた。"]),
  text("割れた盾", [7, 46], ["割れた小盾。裏の革に、書いては消した名の跡が重なっている。"]),
  text("鎧の立て掛け", [18, 38], ["崩れた石垣に、鎧が一領だけ立て掛けてある。", "中身は無い。兜の内側に、小石が詰めてある。"]),
  text("崖の縁", [33, 21], ["裂け目の底は灰で白い。底の灰に、足跡は無い。"]),
  text("尾根の眺め", [76, 10], ["東の空に、山の頂。塔の影が雲を突いている。", "尾根の道は、その手前で切れている。"]),
  text("隠し部屋の岩壁", [22, 52], ["岩の窪みに、骸が一つ。手に石を握っている。", "壁に、石で引っかいた線が名のように並ぶ。どれも途中で止まっている。"]),
  memory(5, 3, "ブルーノ", [8, 5], [
    "行軍の札。隊の名と、騎士の名が十二。",
    "一人倒れるたびに、その人の籠手の鐘を布で巻いた。いち、に、さん。",
    "巻いて、名に線を引いて、また歩いた。",
    "十一本目の線を引いたのは、僕です。十二本目は、誰も引いていません。",
  ]),
  chestWeapon("古言兵の短槍", [26, 4], WEAPON.namelessSpear, 101, true),
  text("上段の岩の割れ目", [6, 11], ["岩の割れ目に、骨が一本挟まっている。", "ここまで上った誰かは、下りなかった。"]),
  hook,
  chestItem("薬草", [5, 20], ITEM.herb, 2, 176),
  chestItem("秘薬", [24, 53], ITEM.elixir, 1, 176),
  chestGold([76, 40], 180),
  chestItem("毒消し", [61, 3], ITEM.antidote, 2, 176),
  pickItem("砦の名札", [6, 40], ITEM.nameTag, 1, 197, ["骸の首に、木の名札が引っかかっている。", "表の名は、黒鉄の砦の兵のものだ。"]),
  pickGold([26, 31], 40),
  pickItem("苦い根", [70, 55], ITEM.bitterRoot, 1, 176),
  pickItem("灰の苔", [44, 12], ITEM.mossAsh, 1, 176),
  foe(TROOP.goats, "green", [30, 16]),
  foe(TROOP.goats, "green", [64, 27]),
  foe(TROOP.wolf, "green", [52, 30]),
  foe(TROOP.goats, "green", [70, 53]),
  foe(TROOP.nameless, "yellow", [24, 18], { dir: "right", n: 6 }),
  foe(TROOP.nameless, "yellow", [40, 36], { dir: "right", n: 6 }),
  foe(TROOP.archer, "yellow", [60, 42], "fixed", 4),
  foe(TROOP.veteran, "red", [14, 50], "fixed", 2),
];
// 置き物（.deco.txt の文字。タイルセット 20：B＝Outside_B、C＝Outside_C、D＝Dungeon_B、E＝Inside_C）
const PASS_DECO = {
  x: { name: "骸骨（通れない）", z2: "D:242" },
  X: { name: "骸骨B（通れない）", z2: "C:24" },
  r: { name: "瓦礫（通れない）", z2: "D:120" },
  p: { name: "折れた石の柱（通れない）", z2: "D:113" },
  s: { name: "槍（通れない）", z2: "E:132" },
  S: { name: "槍B（通れない）", z2: "E:133" },
  h: { name: "盾（通れない）", z2: "E:138" },
  a: { name: "鎧のスタンド（通れない）", z2: "E:160" },
  t: { name: "枯れ木（通れない）", z2: "B:240" },
  T: { name: "枯れ木B（通れない）", z2: "B:232" },
  k: { name: "小石（通れる）", z2: "B:171" },
  o: { name: "岩A（通れない）", z2: "B:159" },
  O: { name: "岩B（通れない）", z2: "B:167" },
  w: { name: "薪（通れない）", z2: "B:170" },
  c: { name: "木箱（通れない）", z2: "B:181" },
  v: { name: "樽（通れない）", z2: "B:141" },
  f: { name: "石のかまど（通れない）", z2: "B:147" },
  B: { name: "倒れた子鐘（通れない）", z2: "E:121" },
};
const PASS_STAMPS = [
  { at: "幕", name: "破れた天幕（3×3。下の段の真ん中が入口）", tiles: [["B:29", "B:30", "B:31"], ["B:37", "B:38", "B:39"], ["B:45", "B:46", "B:47"]] },
];
const PASS_LOOK = {
  legend: "cliff", tilesetId: 20,
  note: "<hai_tone:-17,-17,-17,85>\n<hai_parallax:Mountains1,0,0>\n<hai_ash:4>\n<hai_hidden_tiles:D:183,D:26>",
  bgm: { name: "Field4", volume: 65, pitch: 100, pan: 0 },
  bgs: { name: "Wind4", volume: 45, pitch: 100, pan: 0 },
  fields: { specifyBattleback: true, battleback1Name: "Wasteland", battleback2Name: "Cliff" },
};
const PASS_CHARS = {
  "^": { name: "高い段（段差B（土）の上面。下の 1 行に崖の側面が自動で付く）", ledge: { top: "A4:37", side: "A4:45", height: 1 } },
  R: { name: "崖に掛けた綱（側面の行。通れる。鉤綱を掛けるまではイベントが塞ぐ）", as: ".", tiles: [null, null, "B:19"] },
  "/": { name: "坂の石段（段 1 の側面に刻んだ階段）", as: ".", tiles: [null, null, "B:1"] },
  b: { name: "吊り橋（横。谷の上。通れる）", as: " ", tiles: [null, null, "B:83"] },
  "%": { name: "苔（手がかり：見えない通路の手前の床）", as: ".", tiles: [null, "A2:23"] },
};
const ridgeConfig = {
  _説明: "W10（#156）：境山の古道・尾根道（docs/world.md 5.1・5.2、docs/mapdesign.md 1 章の外の広い場所）。段 0（南の戦場の跡。崖の縁の石段で下りる）・段 1（尾根道。西の坑口→026、北の道→051、倒れた子鐘の塔）・段 2（北西の上段。崖に鉤綱を掛けて上る。ブルーノの記憶 3・赤い宝箱）。南の下り道→054（城壁の東門の外）。見えない通路 2（戦場の岩塊・東の崖の窪み）。この設定は node tools/maps/src/w10_data.mjs が書く。",
  mapId: MAP.ridge, name: "境山の古道・尾根道", displayName: "境山の古道", ...PASS_LOOK,
  chars: { ...PASS_CHARS, "%": { name: "苔（手がかり。段 0）", as: ".", tiles: [null, "A2:23"] } },
  deco: PASS_DECO,
  stamps: PASS_STAMPS,
  scatter: [
    { on: ".", z: 1, tiles: ["A2:15"], rate: 0.08, seed: 5001 },
    { on: ".", tiles: ["B:171", "B:239", "B:252", "B:239"], rate: 0.14, seed: 5002 },
    { on: "^", tiles: ["B:171", "B:239", "B:252"], rate: 0.14, seed: 5003 },
  ],
  events: ridgeEvents,
};

// ===========================================================================
// 051 帝国の陣跡（50×40）：名無しと会う所、名無し兵の手紙、鉤綱、地下壕（鍵）→ 090
// ===========================================================================
const BUNKER = [10, 3];
const namelessCamp = {
  name: "名無し（陣跡）", type: "raw", x: 28, y: 11,
  pages: [
    { image: { ...IMG.nameless, direction: DOWN }, priorityType: 1,
      list: [
        ...say(["天幕の前に、鎧の者が座っている。顔の所に、布が巻いてある。", "こちらを見ると、膝の上の石板に、白い石で字を書いた。"]),
        ...say(["「墓守と見受けた。声は出ない。払った。書いて話す」"]),
        ...say(["「この下の鋳物場の奥に、帝国の研究所がある」", "「研究所の観察の記録を、持って来てほしい」"]),
        ...say(["「代わりに、研究所の門を開ける綱の在りかを書いておく」", "「型の間の西の壁際。引けば門が上がる」"]),
        choice(["引き受ける", "断る"], 1),
        when(0, "引き受ける"),
        ...say(["名無しは、石板の字を袖で消した。", "「鋳物場の南西の小部屋で待つ。古い寝床がある」"], "", 1),
        setVar(VAR.nameless, 1, 1),
        switchOn(SW.namelessAsked, 1),
        ...errand(1, "研究所の観察の記録を、名無しに（鋳物場の南西の小部屋）", 1),
        ...addNote("nameless:gate", "研究所の門の綱：型の間の西の壁際（名無し）", 1),
        ...say([memo("研究所の観察の記録を、名無しに（鋳物場の南西の小部屋）")], "", 1),
        end(1),
        when(1, "断る"),
        ...say(["名無しは、石板に一つだけ書いた。", "「了解」"], "", 1),
        end(1),
        ENDCHOICE(),
        END,
      ] },
    { conditions: { variableId: VAR.nameless, variableValid: true, variableValue: 1 }, priorityType: 0 },
  ],
};
const bunkerDoor = {
  name: "地下壕の扉", type: "raw", x: BUNKER[0], y: BUNKER[1], note: "<hai_locked:地下壕の鍵><hai_key:601>",
  pages: [
    { image: IMG.ironShut, priorityType: 1, walkAnime: false },
    { conditions: { selfSwitchCh: "A", selfSwitchValid: true }, image: IMG.ironOpen, priorityType: 1, trigger: 1, walkAnime: false,
      list: [se("Move1"), transfer(MAP.dock, 8, 3, DOWN), END] },
  ],
};
const campEvents = [
  ...exits("南の道（尾根道へ）", [[24, 39], [25, 39], [26, 39]], MAP.ridge, 55, 1, "down"),
  ...exits("東の道（吊り橋と烽火台へ）", [[49, 17], [49, 18], [49, 19]], MAP.beacon, 1, 14, "right"),
  bunkerDoor,
  text("地下壕の扉の札", [11, 4], ["扉の脇の札「地下壕。鍵は番の者が持つ」。", "札の下に、別の手で「番の者、帰らず」。"]),
  warp("帝国の陣跡", [20, 21]),
  namelessCamp,
  {
    name: "帝国の兵の骸（手紙）", type: "raw", x: 14, y: 22,
    pages: [
      { priorityType: 1,
        list: [
          ...say(["焚き火の跡の脇に、帝国の兵の骸。膝の上に、封をした手紙。"]),
          se("Item3"), gainItem(ITEM.soldierLetter), selfOn(),
          ...say(["\\I[192]名無し兵の手紙を手に入れた！"]),
          END,
        ] },
      { conditions: { selfSwitchCh: "A", selfSwitchValid: true }, priorityType: 1, list: [...say(["焚き火の跡の脇に、帝国の兵の骸。膝の上は空だ。"]), END] },
    ],
  },
  chestEvent("鉤綱", [46, 22], [gainItem(ITEM.grapple), switchOn(FLAG.grapple)], "\\I[234]鉤綱を手に入れた！"),
  text("援軍の荷車", [44, 23], ["荷車の札は「後発」。荷は綱と油と、乾いた麦。", "麦の袋は、一つも開けていない。"]),
  chestArmor("帝国の小盾", [45, 28], ARMOR.imperialShield, 128),
  pickItem("砦の名札", [40, 7], ITEM.nameTag, 1, 197, ["見張りの高台の隅に、木の名札が落ちている。", "黒鉄の砦の兵の名札だ。紐が、帝国の結び方で結び直してある。"]),
  pickGold([31, 33], 50),
  pickItem("薬草", [6, 33 - 12], ITEM.herb, 1, 176),
  thought("R4-05", "後発の輜重兵", [40, 21], [
    "後発の隊は、先発の隊の三日後に着く決まりだった。",
    "着いたら、先発の隊は名簿ごと無かった。",
    "名簿が無いと、誰を待てばいいのか分からない。それで、まだ待っている。",
  ]),
  thought("R4-06", "陣の書記", [16, 15], [
    "古言兵の名簿をつけるのが仕事だった。",
    "名を払った兵は、名簿から消す。消すと、誰に糧を出したか分からなくなる。",
    "だから番号を振った。番号は払えないそうだ。",
  ]),
  text("攻城弩", [38, 9], ["高台の攻城弩。弦は切れている。", "向きは西。砦の方だ。"]),
  text("天幕", [15, 12], ["破れた天幕。中に寝具が十。九つは畳んである。"]),
  text("陣の敷石", [25, 23], ["敷石に、帝国の印が刻んである。", "一つおきに、印の上から別の印が彫り重ねてある。"]),
  foe(TROOP.nameless, "yellow", [22, 30], { dir: "right", n: 7 }),
  foe(TROOP.goats, "green", [36, 28]),
  foe(TROOP.wolf, "green", [7, 13]),
  foe(TROOP.archer, "yellow", [42, 10], "fixed", 4),
];
const campConfig = {
  _説明: "W10（#156）：帝国の陣跡（docs/world.md 2.2・5.2・7.2）。南の道→050、東の道→052、北西の地下壕の扉（地下壕の鍵。052 のグィドがくれる）→090。名無し（頼みごと「名を返す」の始まり）、名無し兵の手紙、援軍の荷車の鉤綱（スイッチ 312）、結界、見張りの高台（坂）、攻城弩の台の裏の見えない通路。この設定は node tools/maps/src/w10_data.mjs が書く。",
  mapId: MAP.camp, name: "帝国の陣跡", displayName: "帝国の陣跡", ...PASS_LOOK,
  chars: PASS_CHARS,
  deco: PASS_DECO,
  stamps: PASS_STAMPS,
  scatter: [
    { on: ".", z: 1, tiles: ["A2:15"], rate: 0.08, seed: 5101 },
    { on: ".", tiles: ["B:171", "B:239", "B:252"], rate: 0.12, seed: 5102 },
    { on: "^", tiles: ["B:171", "B:239"], rate: 0.05, seed: 5103 },
  ],
  events: campEvents,
};

// ===========================================================================
// 052 吊り橋と烽火台（50×30）：グィド（地下壕の鍵・家の手紙・砦へ）、岩背負い（任意）、ベルトランの記憶 3
// ===========================================================================
const guido = {
  name: "グィド", type: "raw", x: 10, y: 5,
  pages: [
    { image: { ...IMG.guido, direction: LEFT }, priorityType: 1,
      list: [
        ...say(["お、客か。珍しいな。わしはグィド。この烽火の番だ。"], "グィド"),
        ...say(["油は三樽、山は七つ。数えるのだけは、毎日やる。", "ほかのことは、まあ、明日にしよう。"], "グィド"),
        ...say(["陣跡の地下壕？　ああ、その鍵なら家にあった。", "爺さまの、そのまた爺さまの頃からな。持ってけ。わしは開けたことがない"], "グィド"),
        se("Key", 0), gainItem(ITEM.bunkerKey),
        ...say(["\\I[195]地下壕の鍵を手に入れた！"]),
        ...say(["鍵と一緒に箱に入ってた手紙もだ。宛名の無い手紙と対になってる、と爺さまは言ってた。", "わしには、どっちがどっちだか分からんよ"], "グィド"),
        gainItem(ITEM.guidoLetter),
        switchOn(SW.loverName),
        ...say(["\\I[193]グィドの家の手紙を手に入れた！"]),
        ...say(["帝国は、悪くないぞ。爺さまはそう言ってた。爺さまは、名前を二つ持ってた"], "グィド"),
        ...say(["砦に火が入ったってな。灯の番が要るだろう。", "……明日にしよう、と言いたいが、灯のことは明日にしない。行く"], "グィド"),
        cmd(221, []),
        switchOn(SW.guido),
        addVar(FLAG.survivors, 1),
        ...addNote("guido:fort", "グィドが砦へ（吊り橋と烽火台）"),
        selfOn(),
        cmd(222, []),
        ...say(["グィドは油の樽を一つ背負って、西の道を下りていった。"]),
        END,
      ] },
    { conditions: { selfSwitchCh: "A", selfSwitchValid: true }, priorityType: 0 },
  ],
};
const rockBearer = {
  name: "岩背負い", type: "raw", x: 35, y: 20,
  pages: [
    { image: IMG.rockBearer, priorityType: 1,
      list: [
        ...say(["橋のたもとの窪みに、背に岩を負った獣が丸まっている。", "寝息のたびに、背の岩がきしむ。奥に、何か光る物が見える。"]),
        choice(["押し通る", "やめる"], 1),
        when(0, "押し通る"),
        ...bossBattle(TROOP.rockBearer, [MAP.beacon, 35, 17, UP], 1),
        ifScript("Hai.Boss.lastResult() === 0", 1),
        ...say(["岩背負いは背の岩ごと崩れ、動かなくなった。", "割れた岩の欠片が、足もとに転がってきた。"], "", 2),
        se("Item3", 2), gainArmor(ARMOR.backStone, 2),
        ...say(["\\I[147]背の岩の欠片を手に入れた！"], "", 2),
        end(2),
        ENDIF(1),
        end(1),
        when(1, "やめる"),
        end(1),
        ENDCHOICE(),
        END,
      ] },
    { conditions: { switch1Id: SW.rockBearer, switch1Valid: true }, priorityType: 0 },
  ],
};
const beaconEvents = [
  ...exits("西の道（帝国の陣跡へ）", [[0, 13], [0, 14], [0, 15]], MAP.camp, 48, 18, "left"),
  ...exits("東の洞の口（骨拾いの洞へ）", [[49, 8], [49, 9]], MAP.boneCave, 1, 6, "right"),
  guido,
  { name: "烽火", type: "raw", x: 12, y: 4, pages: [{ image: IMG.beacon, priorityType: 1, stepAnime: true,
    list: [...say(["石を組んだ烽火の台。火は小さく、絶えていない。", "台の脇の板に、上げた夜の数が刻んである。三百と少し。"]), END] }] },
  thought("R4-07", "烽火を上げなかった番", [5, 7], [
    "頂の鐘が黙ったら、烽火を上げて砦に知らせる。それが番の仕事だ。",
    "黙った夜、油を取りに下りていた。",
    "戻ったら、もう、知らせる相手がいなかった。",
  ]),
  chestArmor("烽火番の外套", [14, 7], ARMOR.beaconCloak, 135),
  memory(10, 3, "ベルトラン", [33, 13], [
    "橋のたもとで、狩りの最後の一匹を仕留めた。",
    "仕留めてから、顔の布をめくった。子どもの顔だった。",
    "連れってのはそういうもんだと、聞いてはいた。聞いてるのと、めくるのは違うな。",
    "布は元に戻しておいた。それぐらいしか、やることが無かった。",
  ]),
  text("吊り橋", [17, 14], ["板の吊り橋。綱は新しく、板は古い。", "誰かが綱だけを張り替えている。"]),
  rockBearer,
  chestItem("秘薬", [36, 23], ITEM.elixir, 2, 176),
  thought("R4-08", "岩背負いを見ていた子", [40, 16], [
    "あの岩のやつ、背中の割れ目に霜がおりると、まるまってうごかないんだよ。",
    "だから、さむい朝に橋をわたるんだって。",
    "きょうは、あったかい。",
  ], "<hai_clue:岩背負いは、背の岩の割れ目に霜がおりると動かない（吊り橋の東のたもと）>"),
  pickGold([46, 5], 60),
  pickItem("苦い根", [3, 24], ITEM.bitterRoot, 1, 176),
  foe(TROOP.wolf, "green", [10, 20]),
  foe(TROOP.goats, "green", [42, 8]),
  foe(TROOP.nameless, "yellow", [38, 11], { dir: "right", n: 5 }),
];
const beaconConfig = {
  _説明: "W10（#156）：吊り橋と烽火台（docs/world.md 5.2・5.5・7.1）。西の道→051、烽火台の高台（坂）にグィド（地下壕の鍵・家の手紙をくれて砦へ。スイッチ 602・変数 103）、谷の吊り橋、東のたもとにベルトランの記憶 3、南の窪みに岩背負い（任意のボス。スイッチ 604）、東の洞の口→053。この設定は node tools/maps/src/w10_data.mjs が書く。",
  mapId: MAP.beacon, name: "吊り橋と烽火台", displayName: "吊り橋と烽火台", ...PASS_LOOK,
  note: "<hai_tone:-17,-17,0,102>\n<hai_parallax:Mountains2,0,0>\n<hai_fog:70,0.5,0>",
  bgs: { name: "Wind5", volume: 50, pitch: 100, pan: 0 },
  chars: PASS_CHARS,
  deco: PASS_DECO,
  stamps: PASS_STAMPS,
  scatter: [
    { on: ".", z: 1, tiles: ["A2:15"], rate: 0.08, seed: 5201 },
    { on: ".", tiles: ["B:171", "B:239", "B:252"], rate: 0.1, seed: 5202 },
    { on: "^", tiles: ["B:171", "B:239"], rate: 0.06, seed: 5203 },
  ],
  events: beaconEvents,
};

// ===========================================================================
// 053 骨拾いの洞（20×15。前の世界の見張りの洞の形をそのまま使う）：骨拾い（使徒。取り引き）、ベルトランの形見
// ===========================================================================
const BONE_PICKER = [13, 5];
const bonePicker = {
  name: "骨拾い", type: "raw", x: BONE_PICKER[0], y: BONE_PICKER[1],
  pages: [{
    image: IMG.bonePicker, priorityType: 1,
    list: [
      ifSwitch(SW.ledgerRead, false),
      ifSwitch(SW.swordTraded, false, 1),
      ...say(["骨の塔の陰に、痩せた長い姿がしゃがんでいる。鳥のような頭が、こちらを向いた。", "骨拾いは、頭を深く下げた。"], "", 2),
      end(2),
      ENDIF(1),
      end(1),
      ENDIF(),
      ...say(["生きておられる方。ようこそ。骨を拾っております。", "取り引きを、なさいますか。"], "骨拾い"),
      choice(["剣のこと", "帳面のこと", "やめる"], 2),
      when(0, "剣のこと"),
      ifSwitch(SW.swordTraded, true, 1),
      ...say(["剣は、お渡しいたしました。一本。鞘も一つ。"], "骨拾い", 2),
      end(2),
      ELSE(1),
      ...say(["塔の三段目、左から七本目に、剣を立てた男の骨がございます。", "剣はわたくしが預かっております。名札を三つで、お渡しいたします。"], "骨拾い", 2),
      ifScript(`$gameParty.numItems($dataItems[${ITEM.nameTag}]) >= 3`, 2),
      choice(["名札を三つ渡す", "やめる"], 1, 3),
      when(0, "名札を三つ渡す", 3),
      loseItem(ITEM.nameTag, 3, 4),
      ...say(["三つ。確かに。名の字も、三つとも欠けておりません。"], "骨拾い", 4),
      switchOn(SW.swordTraded, 4),
      ...say(["骨拾いは塔から剣を一本抜き、鞘ごと地面に置いた。"], "", 4),
      end(4),
      when(1, "やめる", 3),
      end(4),
      ENDCHOICE(3),
      end(3),
      ELSE(2),
      ...say(["名札は、ただいま三つに足りておりません。"], "骨拾い", 3),
      end(3),
      ENDIF(2),
      end(2),
      ENDIF(1),
      end(1),
      when(1, "帳面のこと"),
      ifSwitch(SW.ledgerRead, true, 1),
      ...say(["帳面は、お持ちください。中身は、わたくしが覚えております。"], "骨拾い", 2),
      end(2),
      ELSE(1),
      ...say(["取り引きの帳面でございます。お見せするお代は、鉄くず百。"], "骨拾い", 2),
      cmd(111, [7, 100, 0], 2),
      choice(["百払う", "やめる"], 1, 3),
      when(0, "百払う", 3),
      cmd(125, [1, 0, 100], 4),
      ...say(["百。確かに。写しはございません。お持ちください。"], "骨拾い", 4),
      se("Book1", 4), gainItem(ITEM.tradeLedger, 1, 4), switchOn(SW.ledgerRead, 4),
      ...say(["\\I[228]取り引きの帳面を手に入れた！"], "", 4),
      end(4),
      when(1, "やめる", 3),
      end(4),
      ENDCHOICE(3),
      end(3),
      ELSE(2),
      ...say(["百、足りておりません。お待ちしております。"], "骨拾い", 3),
      end(3),
      ENDIF(2),
      end(2),
      ENDIF(1),
      end(1),
      when(2, "やめる"),
      end(1),
      ENDCHOICE(),
      END,
    ],
  }],
};
const beltranSword = {
  name: "形見 ベルトランの骨の剣（遺骸）", type: "raw", x: 9, y: 8, note: "<hai_remains:10><hai_memory:10,4>",
  pages: [
    { priorityType: 0 },
    { conditions: { switch1Id: SW.swordTraded, switch1Valid: true }, image: IMG.sword, priorityType: 1,
      list: [
        ...say(["鞘に収めた骨の剣。柄に、人の手の形の擦れ跡。", "鞘の口に、折りたたんだ紙が挟まっている。"]),
        ...say([
          "洞の前まで来た。剣を杖にして立っている。座ったら、もう立てねえ。",
          "骨拾いのやつが、頭を下げて待ってる。気の長い奴だ。",
          "描きたい絵が一枚あったんだがな。山と、橋と、手前に誰か。",
          "誰を描くかは、決めてなかった。",
        ]),
        END,
      ] },
    { conditions: { switch1Id: SW.swordTraded, switch1Valid: true, selfSwitchCh: "A", selfSwitchValid: true }, priorityType: 0 },
  ],
};
const boneCaveEvents = [
  ...exits("西の洞の口（吊り橋へ）", [[0, 6], [0, 7]], MAP.beacon, 48, 8, "left"),
  bonePicker,
  beltranSword,
  text("骨の塔", [10, 6], ["骨を積んだ塔。積み方に、決まりがあるらしい。", "段ごとに、骨の太さが揃えてある。"]),
  thought("R4-09", "骨を買いに来た帝国の使い", [6, 8], [
    "使いの役だ。骨を十二本、受け取って帰る。それだけ。",
    "化け物が丁寧に頭を下げるので、こちらも下げた。",
    "帰ってから、上官に叱られた。下げた数まで、帳面につけてあったそうだ。",
  ]),
  pickGold([14, 9], 40),
];
const boneCaveConfig = {
  _説明: "W10（#156）：骨拾いの洞（docs/world.md 1.4・2.3・5.2・6.3。前の世界の見張りの洞の形を使う）。西の洞の口→052、骨拾い（使徒。取り引き：名札三つ→ベルトランの形見の骨の剣（スイッチ 611）、鉄くず百→取り引きの帳面（スイッチ 612））、骨の塔。骨拾いは戦わない。この設定は node tools/maps/src/w10_data.mjs が書く。",
  mapId: MAP.boneCave, name: "骨拾いの洞", displayName: "骨拾いの洞",
  legend: "dungeon", tilesetId: 13,
  note: "<hai_tone:-68,-68,-51,68>\n<hai_dark:4>",
  bgm: { name: "Dungeon5", volume: 60, pitch: 100, pan: 0 },
  bgs: { name: "Drips", volume: 40, pitch: 100, pan: 0 },
  fields: { specifyBattleback: true, battleback1Name: "RockCave", battleback2Name: "RockCave" },
  deco: {
    1: { name: "大きな骸骨（左上）", z2: "B:240" }, 2: { name: "大きな骸骨（右上）", z2: "B:241" },
    3: { name: "大きな骸骨（左下）", z2: "B:248" }, 4: { name: "大きな骸骨（右下）", z2: "B:249" },
    x: { name: "骸骨", z2: "B:242" }, X: { name: "骸骨B", z2: "B:250" }, k: { name: "砂利", z2: "B:32" }, r: { name: "瓦礫", z2: "B:120" },
  },
  events: boneCaveEvents,
};

// ===========================================================================
// 054 城壁の東門の外（40×20）：東門の閂（外から外す近道 → 019）、薄い思念 F08
// ===========================================================================
const GATE = [20, 5];
const eastGate = {
  name: "城壁の東門（外）", type: "raw", x: GATE[0], y: GATE[1],
  pages: [
    { image: IMG.gateShut, priorityType: 1, walkAnime: false,
      list: [
        ...say(["城壁の東門。外側に、太い閂が渡してある。", "閂の上に、鉤の掛かる環が一つ。"]),
        choice(["閂を外す", "やめる"], 1),
        when(0, "閂を外す"),
        se("Door2", 1),
        switchOn(SW.eastGate, 1),
        switchOn(FLAG.eastGateFort, 1),
        ...say(["閂を外した。門の向こうに、城壁へ上がる石段が見える。", "上は、黒鉄の砦の城壁だ。"], "", 1),
        end(1),
        when(1, "やめる"),
        end(1),
        ENDCHOICE(),
        END,
      ] },
    { conditions: { switch1Id: FLAG.eastGateFort, switch1Valid: true }, image: IMG.gateOpen, priorityType: 1, trigger: 1, walkAnime: false,
      list: [se("Move1"), transfer(RAMPART.mapId, RAMPART.x, RAMPART.y, UP), END] },
  ],
};
const eastGateEvents = [
  ...exits("東の道（尾根道へ）", [[39, 10], [39, 11], [39, 12]], MAP.ridge, 61, 58, "up"),
  eastGate,
  faint("F08", "東門の番", [7, 11], [
    "夜明け前、東門の外で、墓守が門を叩く。三度ではなく、二度。",
    "閂を外すと、墓守は兵を一人背負っていた。尾根で倒れた見張りだ。",
    "重かったろう、と言うと、墓守は少し考えてから、うなずいた。",
    "背負われた兵の名札を、墓守は自分の首に掛けていた。",
  ]),
  thought("R4-10", "門の前で待った者", [28, 12], [
    "叩いても開かない。外から閂を外せばいいと、後で知った。",
    "知ったときには、もう中に用は無かった。",
  ]),
  text("城壁", [24, 6], ["見上げるほどの城壁。積んだ石の継ぎ目に、灰が詰まっている。"]),
  chestItem("気付け薬", [36, 14], ITEM.smelling, 2, 176),
  foe(TROOP.goats, "green", [14, 12]),
];
const eastGateConfig = {
  _説明: "W10（#156）：城壁の東門の外（docs/world.md 4.1・5.2・5.3）。東の道→050、城壁の東門（外から閂を外すとスイッチ 617・174。以後、触れると 019 (30,9)。019 の東門からも 054 へ出られる）、薄い思念 F08（東門の番）。この設定は node tools/maps/src/w10_data.mjs が書く。",
  mapId: MAP.eastGate, name: "城壁の東門の外", displayName: "城壁の東門の外", ...PASS_LOOK,
  chars: PASS_CHARS,
  deco: PASS_DECO,
  scatter: [
    { on: ".", z: 1, tiles: ["A2:15"], rate: 0.1, seed: 5401 },
    { on: ".", tiles: ["B:171", "B:239", "B:252"], rate: 0.12, seed: 5402 },
  ],
  events: eastGateEvents,
};

// ===========================================================================
// 鋳物場（090–092・094）と研究所（093）の見た目（docs/look.md 3 章・tools/maps/looks.json）
// ===========================================================================
const FOUNDRY_LOOK = {
  legend: "foundry", tilesetId: 23,
  note: "<hai_tone:0,-34,-68,68>",
  bgm: { name: "Dungeon5", volume: 60, pitch: 100, pan: 0 },
  bgs: { name: "Fire2", volume: 20, pitch: 100, pan: 0 },
  fields: { specifyBattleback: true, battleback1Name: "Fort1", battleback2Name: "Fort2" },
};
// タイルセット 23：B＝Dungeon_B、C＝Dungeon_C、D＝Inside_B、E＝Inside_C
const FOUNDRY_DECO = {
  c: { name: "木箱（通れない）", z2: "B:220" },
  k: { name: "樽（通れない）", z2: "B:238" },
  q: { name: "鉄くず（通れない）", z2: "E:151" },
  x: { name: "骸骨（通れない）", z2: "B:242" },
  r: { name: "瓦礫（通れない）", z2: "B:120" },
  a: { name: "型から出した鎧（通れない）", z2: "E:160" },
  n: { name: "金床（通れない）", z2: "E:148" },
  w: { name: "水桶（通れない）", z2: "E:150" },
  o: { name: "かまど（通れない）", z2: "D:200" },
};
const FOUNDRY_STAMPS = [
  { at: "柱", name: "石の柱（1×2。上は☆）", tiles: [["B:98"], ["B:106"]] },
  { at: "鐘", name: "鐘（台座の上に小さな鐘。仮の絵。look.md 2.2）", tiles: [["E:173"]], upper: [["E:121"]] },
  { at: "大", name: "親鐘の型（台座。仮の絵）", tiles: [["E:173"]], upper: [["E:121"]] },
];

// ===========================================================================
// 090 鋳物場・搬入口（40×30）：地下壕の石段→051、トゥーラの記憶 2、骨拾いの荷札
// ===========================================================================
const dockEvents = [
  exit("地下壕の石段（帝国の陣跡へ）", [8, 2], MAP.camp, BUNKER[0], BUNKER[1] + 1, "down"),
  ...exits("東の口（型の間へ）", [[39, 14], [39, 15], [39, 16]], MAP.hall, 1, 21, "right"),
  memory(11, 2, "トゥーラ", [7, 27], [
    "帝国の兵が村に来た。食べ物が出る仕事がある、ってさ。",
    "弟と妹の分まで出るのか、って聞いた。出る、って言った。",
    "だから来た。ここの名簿に、あたしの名前、自分で書いたんだぞ。",
    "書いた字、まだ下手だろ。",
  ]),
  pickItem("骨拾いの荷札", [30, 6], ITEM.boneTag, 1, 197, ["積み場の床に、荷の札が落ちている。"]),
  text("搬入の名簿", [5, 27], ["帳場の壁に、名簿が釘で留めてある。", "上の方は大人の字。下の方は、子どもの字が増えていく。", "名の横に、どれも番号が書き足してある。"]),
  text("線路の終わり", [36, 17], ["線路は東の口で曲がり、型の間へ続いている。", "車止めに、荷車が一台、鎖でつないである。"]),
  text("積み場の木箱", [27, 5], ["木箱の焼き印は「研究所」。中身は空で、藁だけが残っている。"]),
  thought("R4-11", "荷を下ろした男", [20, 16], [
    "荷を下ろす。数える。上に知らせる。それだけだ。",
    "箱の中身は見るな、と言われた。見なかった。",
    "一箱、泣いていた。それも数に入れた。",
  ]),
  thought("R4-12", "研究所の門番", [30, 24], [
    "子どもが三人、手をつないで入っていった。",
    "門番の仕事は、出ていく者を止めることだ。入る者は止めない。",
    "誰も出てこなかったので、仕事が無かった。",
  ]),
  chestItem("毒消し", [34, 24], ITEM.antidote, 2, 176),
  chestGold([25, 7], 150),
  chestItem("ハイポーション", [13, 28], 8, 2, 176),
  pickGold([16, 21], 40),
  foe(TROOP.sootRats, "green", [14, 15]),
  foe(TROOP.sootRats, "green", [30, 20]),
  foe(TROOP.slag, "green", [28, 6]),
  foe(TROOP.failure, "yellow", [10, 23], { dir: "right", n: 8 }),
];
const dockConfig = {
  _説明: "W10（#156）：古い鋳物場・搬入口（docs/world.md 2.2・5.2・6.4）。北西の地下壕の石段→051、東の口→091、線路と荷の積み場、帳場（トゥーラの記憶 2・搬入の名簿）、帳場の奥の見えない通路の先の物置。この設定は node tools/maps/src/w10_data.mjs が書く。",
  mapId: MAP.dock, name: "鋳物場・搬入口", displayName: "古い鋳物場", ...FOUNDRY_LOOK,
  deco: FOUNDRY_DECO,
  stamps: FOUNDRY_STAMPS,
  scatter: [{ on: ".", tiles: ["B:32", "B:33"], rate: 0.08, seed: 9001 }],
  events: dockEvents,
};

// ===========================================================================
// 091 鋳物場・型の間と研究所の檻（60×45）
//   型の間（炉・研究所の門の綱）、檻の区画（トゥーラの遺骸・親鐘の舌）、研究所の門→093、搬入路の部屋（隠し扉。H34→027）、
//   型置き場（倒れた柱：トゥーラかブルーノ）、廃水の管（H35→101。W9 がつなぐ）、鉄格子（鋏）、名無しの隠れ家、南の廊下→092
// ===========================================================================
const LAB_GATE = [57, 5];
const labGate = {
  name: "研究所の門", type: "raw", x: LAB_GATE[0], y: LAB_GATE[1],
  pages: [
    { image: IMG.ironShut, priorityType: 1, walkAnime: false,
      list: [...say(["鉄の門。上から吊り下ろす形で、隙間が無い。", "門の上の滑車から、綱が東の壁の上を延びている。"]), END] },
    { conditions: { switch1Id: SW.labGate, switch1Valid: true }, image: IMG.ironOpen, priorityType: 1, trigger: 1, walkAnime: false,
      list: [se("Move1"), transfer(MAP.lab, 1, 9, RIGHT), END] },
  ],
};
const gateRope = {
  name: "門の綱", type: "raw", x: 5, y: 13,
  pages: [
    { image: IMG.lever, priorityType: 1, walkAnime: false,
      list: [
        ...say(["西の壁際の滑車に、太い綱が巻いてある。綱は天井を伝って、東へ延びている。"]),
        choice(["綱を引く", "やめる"], 1),
        when(0, "綱を引く"),
        se("Open5", 1),
        switchOn(SW.labGate, 1),
        ...say(["綱を引くと、檻の区画の奥で、鉄の門の上がる音がした。"], "", 1),
        end(1),
        when(1, "やめる"),
        end(1),
        ENDCHOICE(),
        END,
      ] },
    { conditions: { switch1Id: SW.labGate, switch1Valid: true }, image: IMG.leverDown, priorityType: 1, walkAnime: false,
      list: [...say(["綱は、引いたままの所で止めてある。"]), END] },
  ],
};
const tulaRemains = {
  name: "遺骸 トゥーラ", type: "raw", x: 55, y: 18, note: "<hai_remains:11><hai_memory:11,4>",
  pages: [
    { image: IMG.remainsChild, priorityType: 1,
      list: [
        ...say(["いちばん奥の檻。戸は、内側から曲げて開けてある。", "檻の外に、獣人の子の骸。背負子に、太い鉄の舌を括りつけている。"]),
        ...say([
          "檻、曲げた。痛かったけど、骨のせいで力だけはある。",
          "廊下に、鐘の舌が転がってた。夜明けまでに戻すって札が付いてた。",
          "戻す奴がいねえなら、あたしが背負ってく。帰り道のついでだろ。",
          "背負子に彫っといた。かえりは、かるい。",
        ]),
        se("Item3"), gainItem(ITEM.tongue),
        ...say(["\\I[209]親鐘の舌を手に入れた！"]),
        END,
      ] },
    { conditions: { selfSwitchCh: "A", selfSwitchValid: true }, priorityType: 0 },
  ],
};
const fallenPillar = {
  name: "倒れた柱", type: "raw", x: 28, y: 32,
  pages: [
    { image: { tileId: "B:113" }, priorityType: 1,
      list: [
        ifScript("$gameParty.members().some(a => a.actorId() === 11 || a.actorId() === 5)"),
        ...say(["倒れた石の柱が、型置き場への口を塞いでいる。"], "", 1),
        ifActor(11, 1),
        ...say(["こんなもん、どけりゃいいんだろ。兄貴は下がってろ、馬鹿"], "トゥーラ", 2),
        ELSE(1),
        ...say(["お、押してみます。いち、に、さん……！"], "ブルーノ", 2),
        end(2),
        ENDIF(1),
        se("Earth4", 1),
        switchOn(SW.pillar, 1),
        selfOn("A", 1),
        ...say(["柱が転がり、型置き場への口が開いた。"], "", 1),
        end(1),
        ELSE(),
        ...say(["倒れた石の柱が、型置き場への口を塞いでいる。", "一人では動かない。もっと力のある者なら。"], "", 1),
        end(1),
        ENDIF(),
        END,
      ] },
    { conditions: { selfSwitchCh: "A", selfSwitchValid: true }, priorityType: 0 },
  ],
};
const grating = {
  name: "錆びた鉄格子", type: "raw", x: 54, y: 29,
  pages: [
    { image: { tileId: "D:252" }, priorityType: 1,
      list: [
        ifSwitch(FLAG.shears),
        se("Sword2", 1),
        ...say(["鉄切り鋏で、錆びた格子を一本ずつ切った。"], "", 1),
        switchOn(SW.grating, 1), selfOn("A", 1),
        end(1),
        ELSE(),
        ...say(["錆びた鉄格子。向こうの物置に、赤い箱が見える。", "手では曲がらない。鉄を切る道具があれば。"], "", 1),
        end(1),
        ENDIF(),
        END,
      ] },
    { conditions: { selfSwitchCh: "A", selfSwitchValid: true }, priorityType: 0 },
  ],
};
const chute = {
  name: "鉄の搬入路（H34。坑道・下層へ）", type: "raw", x: 6, y: 4,
  pages: [{ image: { tileId: "C:112" }, priorityType: 1,
    list: [
      ...say(["床に、鉄の樋が斜めに口を開けている。下へ、どこまでも続いている。", "樋の縁に「坑道より。鐘鉄」の刻印。"]),
      choice(["滑り降りる", "やめる"], 1),
      when(0, "滑り降りる"),
      se("Fall", 1),
      switchOn(SW.chute, 1),
      transfer(DEPTHS.mapId, DEPTHS.x, DEPTHS.y, DOWN, 1),
      end(1),
      when(1, "やめる"),
      end(1),
      ENDCHOICE(),
      END,
    ] }],
};
// 名無しの隠れ家（頼みごと「名を返す」の分かれ目。docs/world.md 7.3）
const namelessDen = {
  name: "名無し（隠れ家）", type: "raw", x: 8, y: 37,
  pages: [
    { priorityType: 0 },
    { conditions: { variableId: VAR.nameless, variableValid: true, variableValue: 1 }, image: { ...IMG.nameless, direction: DOWN }, priorityType: 1,
      list: [
        ifItem(ITEM.labReport),
        ...say(["名無しは、手を差し出した。", "石板に書く。「記録を」"], "", 1),
        choice(["渡す", "まだ渡さない"], 1, 1),
        when(0, "渡す", 1),
        loseItem(ITEM.labReport, 1, 2),
        switchOn(SW.namelessGiven, 2),
        ...say(["名無しは綴りを一枚ずつめくり、ある頁で手を止めた。", "長いあいだ、同じ行を指でなぞっていた。"], "", 2),
        ...say(["石板に書く。「番号で、書かれていた。名の欄は、空だった」", "「墓守。死んだ者の物を、生きている者へ渡す手だと聞いた」"], "", 2),
        ...say(["「その手で、俺に名を返せ。誰の名でもいい」", "名無しが立ち上がった。鎧の継ぎ目から、冷たい息が漏れる。"], "", 2),
        ifSwitch(SW.loverName, true, 2),
        choice(["止める", "見逃す", "「イルゼ」と書く"], -1, 3),
        when(0, "止める", 3),
        ...indented(namelessStop(), 4),
        end(4),
        when(1, "見逃す", 3),
        ...indented(namelessLeave(), 4),
        end(4),
        when(2, "「イルゼ」と書く", 3),
        ...indented(namelessSit(), 4),
        end(4),
        ENDCHOICE(3),
        end(3),
        ELSE(2),
        choice(["止める", "見逃す"], -1, 3),
        when(0, "止める", 3),
        ...indented(namelessStop(), 4),
        end(4),
        when(1, "見逃す", 3),
        ...indented(namelessLeave(), 4),
        end(4),
        ENDCHOICE(3),
        end(3),
        ENDIF(2),
        setVar(VAR.nameless, 3, 2),
        end(2),
        when(1, "まだ渡さない", 1),
        ...say(["名無しは、また座った。「待つ」"], "", 2),
        end(2),
        ENDCHOICE(1),
        end(1),
        ELSE(),
        ...say(["古い寝床に、名無しが座っている。", "石板に書く。「研究所の奥。観察の記録を」"], "", 1),
        end(1),
        ENDIF(),
        END,
      ] },
    { conditions: { switch1Id: SW.namelessSat, switch1Valid: true }, image: { ...IMG.nameless, direction: DOWN, pattern: 0 }, priorityType: 1,
      list: [...say(["名無しは、寝床に座ったまま動かない。", "膝の上の石板に、同じ名が一つだけ書いてある。"]), END] },
  ],
};
function namelessStop() {
  return [
    ...say(["名無しの腕を押さえた。", "名無しは石板に何か書きかけて、字の途中で手を止めた。"]),
    se("Collapse2"),
    ...say(["鎧が、膝から崩れた。中は灰だった。", "石板の字は、名の一画目で止まっている。"]),
    switchOn(SW.namelessStopped),
    ...errandEnd("dead", "名無しは崩れた（鋳物場の南西の小部屋）"),
  ];
}
function namelessLeave() {
  return [
    ...say(["名無しは、石板に知らない名を三つ書き、一つずつ消した。", "最後に書いた名の下に線を引き、それを名乗るように、胸に手を当てた。"]),
    ...say(["名無しは、型の間の方へ出ていった。足音が、さっきまでと違う。"]),
    switchOn(SW.namelessLeft),
    ...errandEnd("done", "名無しは、誰かの名を名乗って去った（鋳物場の南西の小部屋）"),
  ];
}
function namelessSit() {
  return [
    ...say(["石板の端に、手紙の差出人の名を書いた。「イルゼ」"]),
    ...say(["名無しの手が止まった。", "その名の下に何か書きかけて、やめた。名無しは、寝床に座りこんだ。"]),
    ...say(["石板に、もう一度だけ書く。「了解」"]),
    switchOn(SW.namelessSat),
    ...errandEnd("done", "名無しは、イルゼの名の前で座りこんだ（鋳物場の南西の小部屋）"),
  ];
}
const hallEvents = [
  ...exits("西の口（搬入口へ）", [[0, 20], [0, 21], [0, 22]], MAP.dock, 38, 15, "left"),
  ...exits("南の廊下（鐘の型の部屋へ）", [[17, 44], [18, 44], [19, 44]], MAP.molds, 13, 1, "down"),
  labGate,
  gateRope,
  warp("型の間", [52, 5]),
  tulaRemains,
  fallenPillar,
  grating,
  chute,
  namelessDen,
  text("名無しの寝床", [11, 35], ["古い寝床。枕の代わりに、畳んだ帝国の外套。", "壁に、石で引いた線が何百も並ぶ。日を数えたのだろうか。"]),
  {
    name: "廃水の管（H35。地下水道・水門へ。W9 がつなぐ）", type: "raw", x: 52, y: 38,
    pages: [{ image: { tileId: "E:150" }, priorityType: 1,
      list: [...say(["壁の下に、人がくぐれるほどの廃水の管。奥から水の音がする。", "管の口は、内側から格子で塞がれている。向こうから外す閂が見える。"]), END] },
      // W9（#157）：101 の側で格子の閂を外すと（スイッチ 517）、管をくぐって地下水道・水門 101 の (57,22) へ
      { conditions: { switch1Id: 517, switch1Valid: true }, image: { tileId: "E:150" }, priorityType: 1,
        list: [...say(["格子の閂は外れている。管の奥は、地下水道へ下っている。"]),
          choice(["管をくぐる", "やめる"], 1),
          cmd(402, [0, "管をくぐる"]), se("Move1", 1), cmd(201, [0, 101, 57, 22, 4, 0], 1), cmd(0, [], 1),
          cmd(402, [1, "やめる"]), cmd(0, [], 1),
          cmd(404, []), END] }],
  },
  chestEvent("番号の腕輪", [54, 27], [gainArmor(ARMOR.numberBand)], "\\I[146]番号の腕輪を手に入れた！", true),
  chestArmor("型師の前掛け", [30, 36], ARMOR.moldApron, 136),
  pickItem("砦の名札", [49, 2], ITEM.nameTag, 1, 197, ["門の前の窪みに、木の名札が一つ。紐は、子どもの手で結び直してある。"]),
  chestItem("秘薬", [12, 3 + 5], ITEM.elixir, 1, 176),
  chestGold([39, 39], 200),
  pickItem("灰の苔", [5, 39], ITEM.mossAsh, 1, 176),
  thought("R4-13", "檻の中で数えた子", [45, 6], [
    "となりのおりの子に、おしえてもらった。かぞえると、こわくないって。",
    "いち、に、さん。",
    "となりの子は、きのう、よばれていった。つづきは、あたしがかぞえてる。",
  ]),
  thought("R4-14", "型師", [8, 25], [
    "鐘の型は、壊して出す。同じ型では、二度と鋳られない。",
    "舌だけは、鋳直せと言われた。教会の札を持った男が、夜明けまでにと。",
    "炉に火を入れる前に、研究所の連中が来て、炉を三つ持っていった。",
  ]),
  thought("R4-15", "廃水の番", [48, 32], [
    "汚れた水は管で下へ流す。下は砦の地下の水路だと聞いた。",
    "流れていく物の中に、ときどき、小さな靴が混ざる。",
  ]),
  text("炉", [17, 15], ["三つ並んだ炉の跡。火床の鉄は持ち去られ、煉瓦だけが残る。"]),
  text("檻", [43, 13], ["鉄の格子の檻。床に、小さな手の跡が並んでいる。", "格子の高い所には、手の跡が無い。"]),
  text("型の並び", [6, 15], ["型から出した鎧が三領、壁に並ぶ。", "胸の所に、鐘の形の浮き彫り。三領とも、同じ所が欠けている。"]),
  foe(TROOP.failure, "yellow", [10, 19], { dir: "right", n: 8 }),
  foe(TROOP.failure, "yellow", [26, 27], { dir: "left", n: 8 }),
  foe(TROOP.sootRats, "green", [30, 16]),
  foe(TROOP.slag, "green", [22, 28]),
  foe(TROOP.cagedFailure, "yellow", [44, 14], { dir: "right", n: 10 }),
  foe(TROOP.slag, "green", [39, 18]),
  foe(TROOP.seamed, "red", [46, 33], "fixed", 2),
];
const hallConfig = {
  _説明: "W10（#156）：古い鋳物場・型の間と研究所の檻（docs/world.md 2.2・5.2・6.3・7.3・8.1）。西の口→090、型の間（炉・門の綱→研究所の門）、檻の区画（トゥーラの遺骸と親鐘の舌）、研究所の門→093、隠し扉の奥の鉄の搬入路（H34→027 (44,10)。片道）、型置き場（倒れた柱：トゥーラかブルーノ）、廃水の管（H35。W9 が 101 への場所移動を足す）、鉄格子（鉄切り鋏）、名無しの隠れ家、南の廊下→092。この設定は node tools/maps/src/w10_data.mjs が書く。",
  mapId: MAP.hall, name: "鋳物場・型の間と研究所の檻", displayName: "古い鋳物場", ...FOUNDRY_LOOK,
  deco: FOUNDRY_DECO,
  stamps: FOUNDRY_STAMPS,
  scatter: [{ on: ".", tiles: ["B:32", "B:33"], rate: 0.09, seed: 9101 }, { on: ":", tiles: ["B:32"], rate: 0.04, seed: 9102 }],
  events: hallEvents,
};

// ===========================================================================
// 092 鐘の型の部屋（27×17）：親鐘と四つの鐘の型、トゥーラの記憶 3、鋳物場の鐘鉄（アデルの頼み）、古言の碑の扉（ディル）
// ===========================================================================
const runeDoor = {
  name: "古言の碑の扉", type: "raw", x: 21, y: 8,
  pages: [
    { image: { tileId: "B:177" }, priorityType: 1,
      list: [
        ifActor(7),
        ...say(["扉の代わりに、字を刻んだ石の板が嵌めてある。"], "", 1),
        ...say(["……ああ、これか。読むだけなら読めるよ。訳さないけどな"], "ディル", 1),
        ...say(["ディルが短い音を三つ口にすると、石の板が横に滑った。"], "", 1),
        se("Open3", 1), selfOn("A", 1),
        end(1),
        ELSE(),
        ...say(["扉の代わりに、字を刻んだ石の板が嵌めてある。", "字は読めない。読める者がいれば。"], "", 1),
        end(1),
        ENDIF(),
        END,
      ] },
    { conditions: { selfSwitchCh: "A", selfSwitchValid: true }, priorityType: 0 },
  ],
};
const moldEvents = [
  ...exits("北の口（型の間へ）", [[12, 0], [13, 0], [14, 0]], MAP.hall, 18, 43, "up"),
  memory(11, 3, "トゥーラ", [6, 12], [
    "檻のちびどもの飯、あたしが分けてた。でかいのが多く取ると泣くからな。",
    "骨を移された次の日から、腕が熱くて、力が倍になった。",
    "檻の格子、曲がるんじゃねえかって思った。曲がった。",
    "ちびどもには、まだ出るなって言った。先に、道を見てくる。",
  ]),
  pickItem("鋳物場の鐘鉄", [16, 13], ITEM.moldIron, 1, 209, ["型の脇に、白っぽい鉄の棒が束ねて立てかけてある。一本だけ、切り取られずに残っている。"]),
  text("親鐘の型", [12, 8], ["真ん中の台に、大きな鐘の型。外側の型は割られ、内側の型だけが残る。", "内側の型に、銘の字が彫ってある。半分は古い字、半分は新しい字。"]),
  text("四つの鐘の型", [10, 7], ["親鐘の型を囲んで、小さな鐘の型が四つ。", "四つとも、外側の型が割られている。中身は運び出されたあとだ。"]),
  runeDoor,
  chestWeapon("鋳型の槌", [23, 8], WEAPON.moldHammer, 104, true),
  thought("R4-16", "鋳物師", [18, 12], [
    "銘を彫り直すなら、型から作り直すのが筋だ。そう言った。",
    "教会の人は、一晩でいい、と言った。舌だけ持って来させる、と。",
    "一晩で済む仕事なら、こんなに型は要らない。",
  ]),
  text("割れた型の山", [4, 5], ["割った型の破片の山。破片の内側に、溶けた鉄の筋が残る。"]),
];
const moldConfig = {
  _説明: "W10（#156）：鐘の型の部屋（docs/world.md 5.2・6.4・7.3、docs/mapdesign.md 4 章の古言の碑の扉）。北の口→091、親鐘と四つの鐘の型、トゥーラの記憶 3、鋳物場の鐘鉄（アデルの頼み「頂の道具」の鉄。渡す所は W6 か P）、古言の碑の扉（ディル）の奥の赤い宝箱。この設定は node tools/maps/src/w10_data.mjs が書く。",
  mapId: MAP.molds, name: "鐘の型の部屋", displayName: "鐘の型の部屋", ...FOUNDRY_LOOK,
  deco: FOUNDRY_DECO,
  stamps: FOUNDRY_STAMPS,
  scatter: [{ on: ".", tiles: ["B:32", "B:33"], rate: 0.08, seed: 9201 }],
  events: moldEvents,
};

// ===========================================================================
// 093 研究所の奥（27×19、タイルセット 17）：観察記録（研究所の報告の写し。弱みの手がかり「光を嫌う」）、ボス 研究者の娘 → 094
// ===========================================================================
const DAUGHTER = [19, 4];
const labRecord = {
  name: "書き物机（研究所の報告の写し）", type: "raw", x: 5, y: 5,
  pages: [
    { image: { tileId: "C:149" }, priorityType: 1,
      list: [
        ...say(["机の上に、紐で綴じた報告の束。観察の記録が一行ずつ並ぶ。"]),
        ...say(["「被験 十一番。骨の移しに耐える。力の伸び、著しい」", "「被験 十一番。檻を曲げる。他の被験の世話を焼く」", "「被験 十七番。研究者の娘。光を嫌う。窓を塞ぐ」", "「被験 十七番。父の名にのみ応じる。番号には応じない」"]),
        ...say(["何十行も、同じような行が続く。その中に一行。", "「黒鉄の砦の墓守。死者と話すとの噂。年を取らない。要観察。」", "その行にだけ、番号が振られていない。"]),
        ...say(["最後の頁。", "「教会の彫り直しにより境消滅。研究は継続」"]),
        se("Book1"), gainItem(ITEM.labReport), selfOn(),
        ...say(["\\I[229]研究所の報告の写しを手に入れた！"]),
        ...addNote("clue:daughter", "研究者の娘は光を嫌う（研究所の報告の写し）"),
        ifVar(VAR.nameless, 1, 0),
        ...errand(2, "研究所の報告の写しを、名無しに（鋳物場の南西の小部屋）", 1),
        end(1),
        ENDIF(),
        ...say([memo("研究者の娘は光を嫌う（研究所の報告の写し）")]),
        END,
      ] },
    { conditions: { selfSwitchCh: "A", selfSwitchValid: true }, image: { tileId: "C:149" }, priorityType: 1,
      list: [...say(["机の上は、紐の跡だけが残っている。"]), END] },
  ],
};
const daughter = {
  name: "研究者の娘", type: "raw", x: DAUGHTER[0], y: DAUGHTER[1],
  pages: [
    { image: IMG.daughter, priorityType: 1,
      list: [
        ...say(["北の扉の前に、白い服の娘が立っている。腕に、継ぎ目のような縫い跡。"]),
        ...say(["父さま？　……違う。父さまは、窓を閉めてくれるもの。"], "研究者の娘"),
        ...say(["ここは父さまの研究所。父さまが来るまで、誰も通さないの。"], "研究者の娘"),
        ...bossBattle(TROOP.daughter, [MAP.lab, 11, 9, LEFT]),
        ifScript("Hai.Boss.lastResult() === 0"),
        ...say(["娘は床に座りこみ、扉の方を向いたまま動かなくなった。", "縫い跡の糸が一本ずつほどけ、白い服だけが残った。"], "", 1),
        ...say(["北の扉の閂が、内側から外れる音がした。"], "", 1),
        end(1),
        ENDIF(),
        END,
      ] },
    { conditions: { switch1Id: SW.daughter, switch1Valid: true }, priorityType: 0 },
  ],
};
const labEvents = [
  exit("西の口（型の間へ）", [0, 9], MAP.hall, LAB_GATE[0] - 1, LAB_GATE[1], "left"),
  exit("北の扉（鋳物場の鐘の間へ）", [19, 1], MAP.bell, 13, 24, "up"),
  labRecord,
  daughter,
  thought("R4-17", "研究者", [7, 13], [
    "娘が光を怖がるようになった。窓を塞いだ。",
    "番号で呼ぶ決まりだ。記録はそうつけている。",
    "夜だけは、名で呼ぶ。記録には、つけていない。",
  ]),
  text("人形", [13, 15], ["布の人形。片腕が、別の布で縫い付けてある。", "縫い目は、娘の腕の縫い跡と同じ形。"]),
  text("塞いだ窓", [16, 4], ["窓に板が打ち付けてある。板の隙間に、内側から布が詰めてある。"]),
];
const labConfig = {
  _説明: "W10（#156）：研究所の奥（docs/world.md 2.2・2.3・3.2・5.5）。西の口→091、書き物机の研究所の報告の写し（観察記録。「光を嫌う」の手がかり・砦の墓守の一行・帝国の言い分）、ボス 研究者の娘（スイッチ 605。倒すと北の扉）→094。この設定は node tools/maps/src/w10_data.mjs が書く。",
  mapId: MAP.lab, name: "研究所の奥", displayName: "帝国の研究所",
  legend: "dungeon", tilesetId: 17,
  note: "<hai_tone:-34,-51,-17,68>",
  bgm: { name: "Dungeon6", volume: 60, pitch: 100, pan: 0 },
  bgs: { name: "Darkness", volume: 30, pitch: 100, pan: 0 },
  fields: { specifyBattleback: true, battleback1Name: "Stone3", battleback2Name: "Room3" },
  chars: { ";": { name: "床の汚れ（第 2 層）", as: ".", tiles: [null, "A2:15"] } },
  // タイルセット 17：B＝Dungeon_B、C＝Dungeon_C、D＝SF_Inside_B、E＝SF_Inside_C
  deco: {
    z: { name: "倒れた棚（通れない）", z2: "C:192" },
    Z: { name: "本棚（通れない）", z2: "C:197" },
    m: { name: "薬品棚（通れない）", z2: "C:196" },
    d: { name: "パイプベッド（通れない）", z2: "D:116" },
    p: { name: "散らばった紙（通れる）", z2: "E:86" },
    e: { name: "実験器具（通れない）", z2: "D:125" },
    b: { name: "檻（通れない）", z2: "E:131" },
    g: { name: "檻B（通れない）", z2: "E:132" },
    o: { name: "人形（通れない）", z2: "E:182" },
    y: { name: "骨格の標本（通れない）", z2: "E:17" },
    s: { name: "液垂れ（通れる）", z2: "E:160" },
    k: { name: "瓦礫（通れない）", z2: "B:120" },
    x: { name: "骸骨（通れない）", z2: "B:242" },
  },
  scatter: [{ on: ".", tiles: ["E:86", "B:32"], rate: 0.05, seed: 9301 }],
  events: labEvents,
};

// ===========================================================================
// 094 鋳物場の鐘の間（27×26）：鋳物場の鐘（スイッチ 104・変数 101・4 以上でスイッチ 105）、当番の札、調律師の音叉。
//   手前の間は W11 が「門叩きが抱えた思いの塊」を置く空き（docs/world.md 3.7）
// ===========================================================================
const bellRope = {
  name: "鋳物場の鐘の綱", type: "raw", x: 13, y: 7,
  pages: [
    { image: { tileId: "B:6" }, priorityType: 1,
      list: [
        ...say(["台座の上に、抱えられるほどの鐘が据えてある。", "鐘の綱が、天井の梁から垂れている。"]),
        comment("W11：3 つ目の場面と山場をここに足す"),
        choice(["綱を引く", "やめる"], 1),
        when(0, "綱を引く"),
        se("Bell3", 1, 100, 85),
        cmd(225, [3, 5, 20, false], 1),
        cmd(224, [[255, 255, 255, 120], 20, true], 1),
        cmd(230, [30], 1),
        se("Bell3", 1, 90, 85),
        cmd(230, [40], 1),
        se("Bell3", 1, 80, 80),
        cmd(230, [60], 1),
        ...say(["鐘が鳴る。音が煉瓦を伝って、山の根の方へ抜けていく。", "冷えた炉の奥で、煤が一筋崩れた。"], "", 1),
        switchOn(FLAG.bellFoundry, 1),
        addVar(FLAG.bells, 1, 1),
        ifVar(FLAG.bells, 4, 1, 1),
        switchOn(FLAG.bellsAll, 2),
        end(2),
        ENDIF(1),
        selfOn("A", 1),
        ...say(["壁の札掛けに、当番の札が一枚だけ残っている。"], "", 1),
        se("Item3", 1), gainItem(ITEM.dutyTag, 1, 1),
        ...say(["\\I[196]当番の札（鋳物場）を手に入れた！"], "", 1),
        end(1),
        when(1, "やめる"),
        end(1),
        ENDCHOICE(),
        END,
      ] },
    { conditions: { selfSwitchCh: "A", selfSwitchValid: true }, image: { tileId: "B:6" }, priorityType: 1,
      list: [...say(["鐘は、まだ小さく震えている。"]), END] },
  ],
};
const bellEvents = [
  ...exits("南の口（研究所の奥へ）", [[12, 25], [13, 25], [14, 25]], MAP.lab, DAUGHTER[0], DAUGHTER[1] - 2, "down"),
  bellRope,
  pickup("調律師の音叉", [16, 7], [gainArmor(ARMOR.tuningFork), ...say(["\\I[145]調律師の音叉を手に入れた！"])], ["鐘の脚の陰に、布の包み。中に、二股の小さな鉄。"]),
  thought("R4-18", "鋳物場の鐘番", [8, 8], [
    "夕べ、と札に書いた。数を書こうとしたら、字が流れた。",
    "雨ではない。ここに雨は降らない。",
    "札を拭いて、もう一度書こうとした。それで、終わりだ。",
  ]),
  text("札掛け", [18, 4], ["札掛けの釘は四本。", "札の掛かっていた跡が、四つとも同じ色に焼けている。"]),
  {
    name: "W11 の置き場（門叩きが抱えた思いの塊）", type: "raw", x: 13, y: 18,
    pages: [{ priorityType: 0, list: [comment("W11：門叩きが抱えた思いの塊をここに置く（docs/world.md 3.7。最後の地域が鋳物場になったとき）"), END] }],
  },
  text("手前の間の煤", [9, 19], ["床の煤に、足跡が無い。", "風も無いのに、煤が一方へ流れた跡がある。鐘の間の方へ。"]),
];
const bellConfig = {
  _説明: "W10（#156）：鋳物場の鐘の間（docs/world.md 5.1・8.1）。南の口→093。手前の間（W11 が門叩きの塊を置く空き）、鐘の間：綱を引くと鋳物場の鐘が鳴る（スイッチ 104・変数 101 に 1 足す・4 以上ならスイッチ 105。W7 の 036 と同じ形）、当番の札（鋳物場）、調律師の音叉。この設定は node tools/maps/src/w10_data.mjs が書く。",
  mapId: MAP.bell, name: "鋳物場の鐘の間", displayName: "鋳物場の鐘の間", ...FOUNDRY_LOOK,
  note: "<hai_tone:-68,-68,-34,68>",
  bgm: { name: "Scene2", volume: 55, pitch: 100, pan: 0 },
  bgs: { name: "Darkness", volume: 25, pitch: 100, pan: 0 },
  fields: {},
  deco: FOUNDRY_DECO,
  stamps: FOUNDRY_STAMPS,
  scatter: [{ on: ".;", tiles: ["B:32", "B:33"], rate: 0.08, seed: 9401 }],
  events: bellEvents,
};

// ---------------------------------------------------------------------------
// 設定を書く
// ---------------------------------------------------------------------------
const CONFIGS = {
  w10_050_ridge_road: ridgeConfig,
  w10_051_imperial_camp: campConfig,
  w10_052_beacon_bridge: beaconConfig,
  w10_053_bone_cave: boneCaveConfig,
  w10_054_east_gate: eastGateConfig,
  w10_090_loading_dock: dockConfig,
  w10_091_casting_hall: hallConfig,
  w10_092_bell_molds: moldConfig,
  w10_093_lab_depths: labConfig,
  w10_094_foundry_bell: bellConfig,
};
// イベントの座標が地図の床（壁でないマス）にあるかを確かめる（打ち間違いを早く見つけるため）
const WALLS = { cliff: "#", foundry: "#=", dungeon: "#=" };
for (const [name, cfg] of Object.entries(CONFIGS)) {
  const file = path.join(SRC_DIR, name + ".txt");
  if (!fs.existsSync(file)) continue;
  const lines = fs.readFileSync(file, "utf8").replace(/\n$/, "").split("\n").map(l => [...l]);
  for (const ev of cfg.events) {
    if (ev.x === undefined) continue;
    const ch = lines[ev.y]?.[ev.x];
    if (ch === undefined) throw new Error(`${name}「${ev.name}」(${ev.x},${ev.y}) は地図の外`);
    if (WALLS[cfg.legend].includes(ch) && !/扉|門|格子|管/.test(ev.name)) throw new Error(`${name}「${ev.name}」(${ev.x},${ev.y}) が壁「${ch}」の上`);
  }
  // スタンプは、その地図（.txt か .deco.txt）に文字があるものだけを残す（build.mjs は使わないスタンプを落とす）
  if (cfg.stamps) {
    const decoFile = path.join(SRC_DIR, name + ".deco.txt");
    const all = fs.readFileSync(file, "utf8") + (fs.existsSync(decoFile) ? fs.readFileSync(decoFile, "utf8") : "");
    cfg.stamps = cfg.stamps.filter(st => all.includes(st.at));
    if (!cfg.stamps.length) delete cfg.stamps;
  }
  outputs.push({ file: srcPath(name), text: sourceText(cfg) });
}

// ---------------------------------------------------------------------------
// System.json（スイッチ・変数 601–700 の名前）
// ---------------------------------------------------------------------------
const sysPath = dataPath("System.json");
const system = JSON.parse(fs.readFileSync(sysPath, "utf8"));
for (const [key, names] of [["switches", SWITCH_NAMES], ["variables", VARIABLE_NAMES]]) {
  const arr = system[key];
  while (arr.length <= 700) arr.push("");
  for (let id = 601; id <= 700; id++) arr[id] = names[id] ?? "";
}
outputs.push({ file: sysPath, text: JSON.stringify(system) });

// ---------------------------------------------------------------------------
// MapInfos.json：050–053 の名前（前の世界の名前が残っているので、新しい世界の名前に）
// ---------------------------------------------------------------------------
const infoPath = dataPath("MapInfos.json");
const infos = readData("MapInfos.json");
for (const cfg of Object.values(CONFIGS)) if (infos[cfg.mapId]) infos[cfg.mapId].name = cfg.name;
outputs.push({ file: infoPath, text: formatTable(infos) });

// ---------------------------------------------------------------------------
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const ROOT = path.resolve(dataPath("."), "..");
  let stale = 0;
  for (const { file, text } of outputs) {
    const rel = path.relative(ROOT, file);
    const current = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
    if (check) {
      if (current !== text) { console.error(`古い: ${rel}（node tools/maps/src/w10_data.mjs で書き直す）`); stale++; }
      else console.log(`一致: ${rel}`);
    } else if (current !== text) {
      fs.writeFileSync(file, text);
      console.log(`書き出し: ${rel}`);
    }
  }
  if (stale) process.exit(1);
}
