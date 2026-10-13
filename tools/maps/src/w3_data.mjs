// W3（#94）のデータベースの項目を書く。何度走らせても同じ結果になる（自分の帯だけを書き直す）。
//   node tools/maps/src/w3_data.mjs           書く
//   node tools/maps/src/w3_data.mjs --check   書かずに、今のファイルと同じかだけ見る（違えば終了コード 1）
// 書くもの（docs/world2.md 2・3・9・12・14・16 章）：
//   Items 221–222（鍵。world2.md 14 章の仮の番号）、Items・Weapons・Armors・Skills・States・Enemies・Troops の 301–（W3 の帯 301–400）
//   System.json の switches・variables の名前：筋の旗（world2.md 16 章の「使う W」が W3 の行と、仲間ザザ・シオンの旗 world.md 8 章）
//     ほかの名前（W1・W2・P8 のもの）は消さない
// 状態異常は P4（States 141–147）を使う。
import fs from "node:fs";
import path from "node:path";
import { readData, formatTable, dataPath, extendTable } from "../../data/io.mjs";

const check = process.argv.includes("--check");

// 引退（P15 #250）：前の世界の生成。帯は新しい世界の w6_data.mjs・w7_data.mjs が書き直したので、走らせると今の data/ を壊す。
// 書かずに、--check でも何も見ずに終える（どの生成をどの順で走らせ直しても data/ が今と同じになるように）。中身は控えとして残す。
console.log("引退: tools/maps/src/w3_data.mjs（前の世界の生成。何も書かない）");
process.exit(0);
const outputs = []; // [{ file, text }]
const writeTable = (name, array) => outputs.push({ file: dataPath(name), text: formatTable(array) });

const ST = { poison: 141, sleep: 142, ice: 143, confuse: 144, frenzy: 145, silence: 146, bind: 147 };
const EL = { physical: 1, fire: 2, ice: 3, thunder: 4 };

// ---------------------------------------------------------------------------
// 共通：帯の中だけを空にしてから書く
// ---------------------------------------------------------------------------
const W3 = [301, 400];
const KEYS = [221, 222]; // world2.md 14 章（地下壕の鍵・異端狩りの紋章）。223 蘇生師の印章は W5
function clearBand(table, makeEmpty, [from, to] = W3) {
  extendTable(table, from - 1, makeEmpty);
  for (let id = from; id < table.length && id <= to; id++) table[id] = makeEmpty(id);
  while (table.length - 1 >= from && table.length - 1 <= to && table[table.length - 1].name === "") table.pop();
}
function put(table, id, item, makeEmpty) {
  const ok = (id >= W3[0] && id <= W3[1]) || (table === items && KEYS.includes(id));
  if (!ok) throw new Error(`${id} は W3 の帯の外`);
  extendTable(table, id, makeEmpty);
  table[id] = { ...makeEmpty(id), ...item, id };
}

// 説明（2 行目は来歴の一行）と来歴（メモ欄の <hai_lore>）。docs/lore.md 4.1〜4.3 から写した
const LORE = {
  "地下壕の鍵": { desc: ["帝国の陣跡の地下壕の扉を開ける鍵。", "歯は帝国の作り。合う錠前は、王国の作り。"], lore: ["帝国の陣が山の根に掘った、地下壕の扉の鍵。", "鍵の歯は帝国の作り。", "扉の錠前には、王国の宮廷の工房の刻印がある。", "帝国が掘った穴の奥を、後から王国が自分の錠で閉じたことになる。"] },
  "王国兵の札": { desc: ["王国の兵が首に下げていた銅の札。", "裏に日付が二つ。死んだ日と、起きた日。"], lore: ["王国の兵が首に下げた銅の札。表に名前と隊の番号。", "裏に日付が二つ、別の手で刻んである。「没」と「起」。", "二つの日付の間は、どの札も三日と空いていない。", "帝国兵の骨の山の中に、この札だけが落ちていた。"] },
  "将校の遠眼鏡": { desc: ["帝国の将校が使った真鍮の遠眼鏡。", "三脚に据えたまま、王都の城壁を向いていた。"], lore: ["帝国の将校が、毎朝王都の城壁を見た遠眼鏡。", "三脚の横の板に、見たものが炭で描き留めてある。", "城壁の上に人影が三つ。朝日を背にした絵だ。", "石に落ちる影は、二つしか描かれていない。"] },
  "工兵の手袋": { desc: ["攻撃と防御が少し上がる。", "帝国の工兵の革の手袋。指先だけが鉄で覆ってある。"], lore: ["帝国の工兵に配られた、指先を鉄で覆った革の手袋。", "楔を打つ手を守るためのもので、甲に隊の番号が焼いてある。", "攻城弩の台の裏に、片方だけ隠してあった。", "甲の番号は、廃坑の鶴嘴の焼き印と同じだ。"] },
  "巨人の腕輪": { desc: ["最大ＨＰと防御が上がる。素早さが少し下がる。", "巨人の見張りの石の腕輪。人の胴が通るほど大きい。"], lore: ["巨人の見張りが、子に渡すために洞に置いていた石の腕輪。", "内側に巨人の字が彫ってある。「誰の側にも付くな」。", "腕輪は人の胴が通るほど大きい。", "吊り橋の向こうで待つ子の腕には、まだ大きすぎた。"] },
  "岩背負いの石帯": { desc: ["物理のダメージを 1 割 5 分減らす。", "岩背負いが、背の岩を体に縛っていた石の帯。"], lore: ["巨人の門番が、背負った岩を体に縛りつけていた石の帯。", "留め金に、一度も外された跡が無い。", "門を守ると誓った日に締め、それから岩を下ろさなかったという。", "帯の内側は、背の肌と同じ灰色に染まっている。"] },
  "異端狩りの紋章": { desc: ["焚刑の教会の大扉を開ける、異端狩りの紋章。", "野営の箱に返されていた。留め針が曲がっている。"], lore: ["聖灰教会の異端狩りの隊が、胸に付けた鉄の紋章。", "これを見せれば、教会の大扉は誰にでも開く。", "裏の留め針が、無理に引き抜いたように曲がっている。", "野営の箱の中で、この一つだけが布に包んであった。"] },
  "護送の名札": { desc: ["異端者の首に掛けられていた木の名札。", "焼き印は「行き先　王都　更生牢」。"], lore: ["送られる異端者の首に掛けられた、木の名札。", "名前の下に、行き先の焼き印。「王都　更生牢」。", "地下牢の監房の鍵の箱にあった「更生済」の札と、木も焼き印も同じだ。", "紐は長い。獣人の太い首に合わせて取ってある。"] },
  "獣人の革鎧": { desc: ["回避が上がる。", "獣人の剣士の革鎧。胸に、小さな手で縫った当て布。"], lore: ["獣人の村の剣士が着た、柔らかい革の鎧。", "動きやすいよう、肩と腰の革を薄く削いである。", "胸の当て布だけ縫い目が粗い。子どもの手で縫ったらしい。", "柵囲いの中に畳んで置いてあった。焼けた村で、焦げていない物はこれだけだ。"] },
  "ザザの父の剣": { desc: ["ザザだけが扱える片刃の剣。", "床下にしまわれていた。刃こぼれが一つも無い。"], lore: ["獣人の剣士が、家の床下にしまっていた片刃の剣。", "柄の革は、大人の手の形にすり減っている。", "柄頭に小さな刻みが十いくつ。刃には、こぼれが一つも無い。", "床下には、子どもの背丈に合う木の枝も一本しまってあった。"] },
  "耐火の外套": { desc: ["火のダメージを半分に抑える。", "焚刑官の外套。内側が焦げて、外側は白いまま。"], lore: ["焚刑官が火の前に立つときに着た、厚い白布の外套。", "燃えない石の糸を織り込んであり、炎の中でも外側は白いまま残る。", "内側は黒く焦げている。燃えたのは、着ていた方だった。"] },
  "焚刑官の祈祷書": { desc: ["焚刑官ハルトの祈祷書。焦げた頁が多い。", "最後の一章だけ、紙と綴じ糸が新しい。"], lore: ["聖灰教会の祈祷書。前の方は、二百年前から変わらない祈り。", "最後に「異端を浄める祈り」の一章が綴じ足してある。", "その章だけ紙が白く、綴じ糸の色も違う。", "綴じ足した年は、王都で灰の病が出た年と同じ。", "欄外に、焼いた村の名前が並び、上から線で消してある。"] },
  "聖灰の小壺": { desc: ["聖灰教会が配った白い粉の小壺。空になっている。", "匙の柄が、親指の形にすり減っている。"], lore: ["聖灰教会が看取りの小屋に配った、白い粉の小壺。", "壺の口に、木の匙が一本差してある。", "匙の柄は、親指の当たる所だけがすり減って薄い。", "壺は空だ。底に、指でぬぐった跡が一筋。"] },
  "寝台の石板": { desc: ["寝台の頭に掛かっていた小さな石板。", "白墨で名前を書いては消した跡が、幾重にも残る。"], lore: ["看取りの小屋の寝台の頭に掛かっていた石板。", "白墨で患者の名を書き、看取ると消して、次の名を書いた。", "消し跡が幾重にも重なって、石板は白く曇っている。", "最後に書かれた名前だけ、消されていない。"] },
  "凍て石": { desc: ["敵 1 体に氷のダメージ。", "異端狩りの兵が、火傷を冷やすのに袋で持ち歩いた石。"], lore: [] },
  "雷鳴石": { desc: ["敵 1 体に雷のダメージ。", "崖道の岩這いの殻から出る石。帝国の工兵は発破に使った。"], lore: [] },
  "口封じの灰": { desc: ["敵 1 体を沈黙させる。", "焚刑の跡の灰。吸うと、しばらく祈りの声が出ない。"], lore: [] },
};
const descOf = name => LORE[name].desc.join("\n");
const loreOf = name => (LORE[name].lore.length ? ["<hai_lore>", ...LORE[name].lore, "</hai_lore>"].join("\n") : "");
const noteOf = (name, ...tags) => [...tags, loreOf(name)].filter(Boolean).join("\n");

// ---------------------------------------------------------------------------
// Items（欄は Items.json の既存の項目から写した）
// ---------------------------------------------------------------------------
const emptyItem = id => ({
  id, animationId: 0, consumable: true,
  damage: { critical: false, elementId: 0, formula: "0", type: 0, variance: 20 },
  description: "", effects: [], hitType: 0, iconIndex: 0, itypeId: 1, name: "", note: "",
  occasion: 0, price: 0, repeats: 1, scope: 7, speed: 0, successRate: 100, tpGain: 0,
});
const keyItem = (name, description, iconIndex = 195) => ({
  name, description, iconIndex, itypeId: 2, consumable: false, occasion: 3, scope: 0,
});
// 投げる消耗品（戦闘中だけ。必中、敵単体）
const throwItem = (name, description, iconIndex, extra) => ({
  name, description, iconIndex, itypeId: 1, consumable: true, occasion: 1, scope: 1, hitType: 0, price: 0, note: "<hai_max:3>", ...extra,
});
const items = readData("Items.json");
clearBand(items, emptyItem, [KEYS[0], KEYS[KEYS.length - 1]]);
clearBand(items, emptyItem);
const key = (id, name, iconIndex = 195) => put(items, id, { ...keyItem(name, descOf(name), iconIndex), note: noteOf(name) }, emptyItem);
key(221, "地下壕の鍵");
key(222, "異端狩りの紋章", 196);
key(301, "焚刑官の祈祷書", 121);
put(items, 302, throwItem("凍て石", descOf("凍て石"), 65, {
  animationId: 72, damage: { critical: false, elementId: EL.ice, formula: "180", type: 1, variance: 10 },
}), emptyItem);
put(items, 303, throwItem("雷鳴石", descOf("雷鳴石"), 66, {
  animationId: 77, damage: { critical: false, elementId: EL.thunder, formula: "180", type: 1, variance: 10 },
}), emptyItem);
put(items, 304, throwItem("口封じの灰", descOf("口封じの灰"), 4, {
  animationId: 61, effects: [{ code: 21, dataId: ST.silence, value1: 0.8, value2: 0 }],
}), emptyItem);
// 道具で語る大事なもの（docs/lore.md 4.1〜4.3。調べると拾える）
key(305, "王国兵の札", 88);
key(306, "将校の遠眼鏡", 175);
key(307, "護送の名札", 187);
key(308, "聖灰の小壺", 176);
key(309, "寝台の石板", 189);
writeTable("Items.json", items);

// ---------------------------------------------------------------------------
// Weapons・Armors（赤い宝箱とボスの固定ドロップ。どれも一点もの <hai_unique>）
// ---------------------------------------------------------------------------
const emptyWeapon = id => ({
  id, animationId: 0, description: "", etypeId: 1, traits: [{ code: 31, dataId: 1, value: 0 }, { code: 22, dataId: 0, value: 0 }],
  iconIndex: 0, name: "", note: "", params: [0, 0, 0, 0, 0, 0, 0, 0], price: 0, wtypeId: 0,
});
const weapons = readData("Weapons.json");
clearBand(weapons, emptyWeapon);
// ザザだけが装備できる：武器タイプ 10「爪」は職業 5（ザザ）だけが装備できる
put(weapons, 301, {
  name: "ザザの父の剣", description: descOf("ザザの父の剣"),
  animationId: 6, iconIndex: 97, wtypeId: 10, price: 0, params: [0, 0, 26, 4, 0, 0, 2, 0], note: noteOf("ザザの父の剣", "<hai_unique>"),
  traits: [{ code: 31, dataId: EL.physical, value: 0 }, { code: 22, dataId: 0, value: 0 }],
}, emptyWeapon);
writeTable("Weapons.json", weapons);

const emptyArmor = id => ({
  id, atypeId: 1, description: "", etypeId: 4, traits: [{ code: 22, dataId: 1, value: 0 }],
  iconIndex: 0, name: "", note: "", params: [0, 0, 0, 0, 0, 0, 0, 0], price: 0,
});
const armors = readData("Armors.json");
clearBand(armors, emptyArmor);
const ARMORS = [
  // [ID, 名前, 防具タイプ, 装備タイプ, アイコン, 能力値, 特徴]
  [301, "工兵の手袋", 1, 5, 145, [0, 0, 4, 4, 0, 0, 0, 0], []],
  [302, "巨人の腕輪", 1, 5, 146, [60, 0, 0, 6, 0, 0, -2, 0], []],
  [303, "岩背負いの石帯", 1, 5, 147, [0, 0, 0, 4, 0, 0, 0, 0], [{ code: 23, dataId: 6, value: 0.85 }]],
  [304, "獣人の革鎧", 3, 4, 133, [0, 0, 0, 8, 0, 2, 4, 0], [{ code: 22, dataId: 1, value: 0.1 }]],
  [305, "耐火の外套", 3, 4, 135, [0, 0, 0, 10, 0, 6, 0, 0], [{ code: 22, dataId: 1, value: 0 }, { code: 11, dataId: EL.fire, value: 0.5 }]],
];
for (const [id, name, atypeId, etypeId, iconIndex, params, traits] of ARMORS) {
  put(armors, id, {
    name, description: descOf(name), atypeId, etypeId, iconIndex, params, note: noteOf(name, "<hai_unique>"),
    traits: traits.length ? traits : [{ code: 22, dataId: 1, value: 0 }],
  }, emptyArmor);
}
writeTable("Armors.json", armors);

// ---------------------------------------------------------------------------
// States 301–（ボスの状態の切り替え）。欄は States.json の既存の項目から写した
// ---------------------------------------------------------------------------
const emptyState = id => ({
  id, autoRemovalTiming: 0, chanceByDamage: 100, iconIndex: 0, maxTurns: 1, message1: "", message2: "", message3: "", message4: "",
  minTurns: 1, motion: 0, name: "", note: "", overlay: 0, priority: 50, releaseByDamage: false, removeAtBattleEnd: true,
  removeByDamage: false, removeByRestriction: false, removeByWalking: false, restriction: 0, stepsToRemove: 100, traits: [], messageType: 1,
});
const states = readData("States.json");
clearBand(states, emptyState);
const STATE = { gate: 301, flame: 302, stone: 303 };
put(states, STATE.gate, {
  name: "門を閉ざす", iconIndex: 14, autoRemovalTiming: 2, minTurns: 2, maxTurns: 2, priority: 60,
  message1: "%1は身を固めた！", message4: "%1の構えが解けた。", traits: [{ code: 21, dataId: 3, value: 3 }],
  note: "<hai_w3:岩背負い。2 ターン、防御力 300%>",
}, emptyState);
put(states, STATE.flame, {
  name: "聖火の法", iconIndex: 64, priority: 60, message1: "%1の鎧が燃え上がった！", message4: "%1の鎧の炎が鎮まった。",
  traits: [{ code: 22, dataId: 6, value: 0.5 }],
  note: "<hai_w3:焚刑官ハルトの第二形態。反撃 50%（攻撃は炎）。沈黙の間は敵グループ 311 のバトルイベントが外す>",
}, emptyState);
put(states, STATE.stone, {
  name: "誓いの石化", iconIndex: 13, priority: 60, message1: "%1の体が石に覆われた！",
  traits: [{ code: 23, dataId: 6, value: 0 }, { code: 23, dataId: 7, value: 2 }],
  note: "<hai_w3:岩背負い。HP 50% から。物理ダメージ率 0%、魔法ダメージ率 200%>",
}, emptyState);
writeTable("States.json", states);

// ---------------------------------------------------------------------------
// Skills 301–（敵の技。欄は w1_data.mjs の眠りの鱗粉と同じ）
// ---------------------------------------------------------------------------
const emptySkill = id => ({
  id, animationId: 0, damage: { critical: false, elementId: 0, formula: "0", type: 0, variance: 20 },
  description: "", effects: [], hitType: 0, iconIndex: 0, message1: "", message2: "", mpCost: 0, name: "", note: "",
  occasion: 0, repeats: 1, requiredWtypeId1: 0, requiredWtypeId2: 0, scope: 1, speed: 0, stypeId: 0, successRate: 100,
  tpCost: 0, tpGain: 0, messageType: 1,
});
const skills = readData("Skills.json");
clearBand(skills, emptySkill);
const dmg = (formula, elementId = 0, type = 1) => ({ critical: false, elementId, formula, type, variance: 20 });
// stypeId：0 は沈黙で封じられない。1（魔法）・2（必殺技）は沈黙 146 で封じられる
const SKILLS = {
  301: { name: "岩投げ", message1: "%1は岩を投げつけた！", scope: 1, hitType: 1, animationId: 2, damage: dmg("a.atk * 4 - b.def * 2", -1), stypeId: 0 },
  302: { name: "地鳴らし", message1: "%1は地を踏み鳴らした！", scope: 2, hitType: 1, animationId: 88, damage: dmg("a.atk * 2 - b.def", -1), stypeId: 0 },
  303: { name: "門を閉ざす", message1: "%1は門の前に立ちはだかった！", scope: 11, hitType: 0, animationId: 51, stypeId: 0,
    effects: [{ code: 21, dataId: STATE.gate, value1: 1, value2: 0 }] },
  304: { name: "岩落とし", message1: "%1は頭上の岩を崩した！", scope: 2, hitType: 1, animationId: 88, damage: dmg("20 + a.atk * 2 - b.def", -1), stypeId: 0 },
  305: { name: "焚刑の槍", message1: "%1は燃える槍を突き出した！", scope: 1, hitType: 1, animationId: 13, damage: dmg("a.atk * 4 - b.def * 2", EL.fire), stypeId: 0 },
  306: { name: "浄化の炎", message1: "%1は祈りを唱えた！", message2: "炎が広がった！", scope: 2, hitType: 2, animationId: 68, damage: dmg("50 + a.mat * 2 - b.mdf", EL.fire), stypeId: 1 },
  307: { name: "告発", message1: "%1は指をさした！", scope: 1, hitType: 0, animationId: 63, stypeId: 0,
    effects: [{ code: 21, dataId: ST.frenzy, value1: 0.7, value2: 0 }] },
  308: { name: "祈り", message1: "%1は祈りを唱えた！", scope: 7, hitType: 0, animationId: 41, damage: dmg("120 + a.mat * 2", 0, 3), stypeId: 1 },
  309: { name: "火の粉", message1: "%1は火の粉を散らした！", scope: 1, hitType: 2, animationId: 66, damage: dmg("30 + a.mat * 2 - b.mdf", EL.fire), stypeId: 1 },
  310: { name: "狂乱の灰", message1: "%1は灰を撒き散らした！", scope: 1, hitType: 2, animationId: 63, stypeId: 0,
    effects: [{ code: 21, dataId: ST.frenzy, value1: 0.4, value2: 0 }] },
  311: { name: "業火", message1: "%1の体から炎が噴き出した！", scope: 2, hitType: 2, animationId: 69, damage: dmg("40 + a.mat * 2 - b.mdf", EL.fire), stypeId: 1 },
};
for (const [id, s] of Object.entries(SKILLS)) put(skills, Number(id), { ...s, occasion: 1, note: "<hai_w3:敵の技>" }, emptySkill);
writeTable("Skills.json", skills);

// ---------------------------------------------------------------------------
// Enemies・Troops（world2.md 2・3・9 章。数値は仮。持ち主が調整する）
// ---------------------------------------------------------------------------
const emptyEnemy = id => ({
  id, actions: [{ conditionParam1: 0, conditionParam2: 0, conditionType: 0, rating: 5, skillId: 1 }],
  battlerHue: 0, battlerName: "",
  dropItems: [{ dataId: 1, denominator: 1, kind: 0 }, { dataId: 1, denominator: 1, kind: 0 }, { dataId: 1, denominator: 1, kind: 0 }],
  exp: 0, traits: [{ code: 22, dataId: 0, value: 0.95 }, { code: 22, dataId: 1, value: 0.05 }, { code: 31, dataId: 1, value: 0 }],
  gold: 0, name: "", note: "", params: [100, 0, 10, 10, 10, 10, 10, 10],
});
const T = {
  attackElement: id => ({ code: 31, dataId: id, value: 0 }),
  element: (elementId, rate) => ({ code: 11, dataId: elementId, value: rate }),
  physRate: rate => ({ code: 23, dataId: 6, value: rate }),
  stateResist: stateId => ({ code: 14, dataId: stateId, value: 0 }),
  stateRate: (stateId, rate) => ({ code: 13, dataId: stateId, value: rate }),
};
// 即死は効かない：「ステート有効度（戦闘不能）0%」。「ステート無効化（戦闘不能）」は HP 0 でも倒れなくなるので使わない（docs/plugins/Hai_Boss.md）
const noDeath = T.stateRate(1, 0);
const base = [{ code: 22, dataId: 0, value: 0.95 }, { code: 22, dataId: 1, value: 0.05 }];
const act = (skillId, rating = 5) => ({ conditionParam1: 0, conditionParam2: 0, conditionType: 0, rating, skillId });
const onTurn = (skillId, a, b, rating = 5) => ({ conditionParam1: a, conditionParam2: b, conditionType: 1, rating, skillId });
const attack = act(1);
const guard = act(2, 3);
const drop = (kind, dataId, denominator) => ({ dataId, denominator, kind });
const none = drop(0, 1, 1);
// 素材（P9 の合成）：199 苦い根、200 灰の苔
const DROP = { root: drop(1, 199, 4), moss: drop(1, 200, 4), ice: drop(1, 302, 6), thunder: drop(1, 303, 6) };
const physical = T.attackElement(EL.physical);
const fire = T.attackElement(EL.fire);
// [ID, 名前, 戦闘の絵, 色相, [HP, MP, 攻, 防, 魔, 魔防, 敏, 運], 経験値, 魔石, 特徴, 行動, ドロップ, メモ]
const ENEMIES = [
  // 崖道（world2.md 2 章）
  [301, "灰つばめ", "Crow", 0, [180, 0, 22, 12, 10, 12, 34, 10], 12, 8, [physical], [attack], [DROP.moss], ""],
  [302, "岩這い", "Crab", 30, [260, 0, 24, 30, 8, 14, 6, 10], 16, 12, [physical, T.physRate(0.5), T.element(EL.thunder, 2)], [attack, guard], [DROP.thunder],
    "<hai_weak_hint:雷>"],
  [303, "帝国の亡兵", "Mercenary", 200, [480, 0, 34, 32, 10, 18, 14, 10], 30, 22, [physical, T.stateRate(ST.sleep, 1.5)], [attack, act(2, 4)], [DROP.root], ""],
  [304, "崖喰い", "Hydra", 30, [1300, 0, 44, 30, 20, 20, 16, 10], 110, 80, [physical, T.element(EL.thunder, 2)], [attack, act(304)], [DROP.thunder], ""],
  [305, "岩背負い", "Stoneknight", 0, [3200, 0, 50, 38, 20, 30, 18, 20], 400, 400,
    [physical, T.physRate(0.5), T.element(EL.fire, 0.5), T.stateResist(ST.poison), T.element(EL.thunder, 2), T.stateRate(ST.confuse, 1.5), noDeath],
    [act(301), act(302), onTurn(303, 3, 3, 9)], [drop(3, 303, 1)],
    "<hai_boss>\n<hai_boss_name:岩背負い>\n<hai_weak_hint:雷>\n<hai_boss_switch:158>"],
  // 廃集落（world2.md 3 章）
  [306, "火の粉", "Plasma", 0, [170, 40, 14, 10, 26, 16, 26, 10], 12, 8, [physical, T.element(EL.fire, 0), T.element(EL.ice, 2)], [act(1, 3), act(309)], [DROP.moss], ""],
  [307, "焼け犬", "Foxman", 330, [200, 0, 26, 12, 8, 8, 28, 10], 12, 8, [physical], [attack], [DROP.root], ""],
  [308, "異端狩りの兵", "Captain", 30, [500, 40, 32, 30, 20, 24, 14, 10], 30, 22, [physical, T.stateRate(ST.silence, 1.5)], [attack, guard, act(308, 4)], [DROP.ice], ""],
  [309, "焦げた影", "Wraith", 20, [460, 30, 30, 18, 24, 20, 18, 10], 30, 22, [physical, T.element(EL.fire, 0.5)], [attack, act(310, 4)], [DROP.moss], ""],
  [310, "火刑の亡者", "Lich", 0, [1400, 60, 40, 26, 40, 26, 16, 10], 110, 80, [physical, T.element(EL.fire, 0), T.element(EL.ice, 2)], [act(1, 4), act(311)], [DROP.ice], ""],
  // 焚刑官ハルト（world2.md 9 章）。HP 50% で 312「聖火の法」へ（HP の割合を引き継ぐ）
  [311, "焚刑官ハルト", "Blackknight", 0, [4000, 80, 54, 40, 40, 34, 26, 20], 500, 500,
    [physical, T.element(EL.fire, 0), T.stateResist(ST.poison), T.physRate(0.75), T.element(EL.ice, 2), T.stateRate(ST.silence, 1.5), noDeath],
    [act(305), act(306), onTurn(307, 2, 2, 9)], [drop(3, 305, 1)],
    "<hai_boss>\n<hai_boss_name:焚刑官ハルト>\n<hai_weak_hint:氷>\n<hai_boss_switch:156>\n<hai_transform:312,50>\n<hai_drop:item,301,1>"],
  [312, "焚刑官ハルト", "Blackknight", 0, [4000, 80, 54, 34, 40, 34, 26, 20], 500, 500,
    [fire, T.element(EL.fire, 0), T.stateResist(ST.poison), T.physRate(0.75), T.element(EL.ice, 2), T.stateRate(ST.silence, 1.5), noDeath],
    [act(305), act(306), onTurn(307, 2, 2, 9)], [drop(3, 305, 1)],
    "<hai_boss>\n<hai_boss_name:焚刑官ハルト>\n<hai_weak_hint:氷>\n<hai_boss_switch:156>\n<hai_drop:item,301,1>"],
];
const enemies = readData("Enemies.json");
clearBand(enemies, emptyEnemy);
for (const [id, name, battlerName, battlerHue, params, exp, gold, traits, actions, drops, note] of ENEMIES) {
  const dropItems = [...drops, none, none, none].slice(0, 3);
  put(enemies, id, { name, battlerName, battlerHue, params, exp, gold, traits: [...base, ...traits], actions, dropItems, note }, emptyEnemy);
}
enemies[312].battlerHue = 340; // 鎧が燃え上がった赤
writeTable("Enemies.json", enemies);

const emptyPage = () => ({
  conditions: { actorHp: 50, actorId: 1, actorValid: false, enemyHp: 50, enemyIndex: 0, enemyValid: false, switchId: 1, switchValid: false, turnA: 0, turnB: 0, turnEnding: false, turnValid: false },
  list: [{ code: 0, indent: 0, parameters: [] }], span: 0,
});
const emptyTroop = id => ({ id, members: [], name: "", pages: [emptyPage()] });
const row = n => Array.from({ length: n }, (_, i) => ({ x: Math.round(640 + (i - (n - 1) / 2) * 200), y: 460 }));
const TROOPS = [
  [301, "W3_緑：灰つばめ", [301]],
  [302, "W3_緑：岩這い", [302]],
  [303, "W3_黄：帝国の亡兵×2", [303, 303]],
  [304, "W3_赤：崖喰い", [304]],
  [305, "W3_ボス：岩背負い", [305]],
  [306, "W3_緑：火の粉", [306]],
  [307, "W3_緑：焼け犬×2", [307, 307]],
  [308, "W3_黄：異端狩りの兵", [308]],
  [309, "W3_黄：焦げた影", [309]],
  [310, "W3_赤：火刑の亡者", [310]],
  [311, "W3_ボス：焚刑官ハルト", [311]],
];
const troops = readData("Troops.json");
clearBand(troops, emptyTroop);
for (const [id, name, members] of TROOPS) {
  const pos = row(members.length);
  put(troops, id, { name, members: members.map((enemyId, i) => ({ enemyId, ...pos[i], hidden: false })) }, emptyTroop);
}
const page = (conditions, span, list) => {
  const p = emptyPage();
  return { ...p, conditions: { ...p.conditions, ...conditions }, span, list: [...list, { code: 0, indent: 0, parameters: [] }] };
};
const msg = (indent, lines) => [{ code: 101, indent, parameters: ["", 0, 0, 2, ""] }, ...lines.map(text => ({ code: 401, indent, parameters: [text] }))];
// 岩背負い ③：HP 50% で「誓いの石化」（物理が効かず、魔法に弱くなる。形は変わらない）
troops[305].pages.push(page({ enemyValid: true, enemyIndex: 0, enemyHp: 50 }, 0, [
  { code: 111, indent: 0, parameters: [12, "$gameTroop.members()[0].isAlive()"] },
  ...msg(1, ["岩背負いは背の岩に額を付け、何かを誓った。", "その体が、足元から石に変わっていく。"]),
  { code: 333, indent: 1, parameters: [0, 0, STATE.stone] },
  { code: 0, indent: 1, parameters: [] },
  { code: 412, indent: 0, parameters: [] },
]));
// 焚刑官ハルトの「聖火の法」（312）：沈黙の間は反撃しない。ターンの頭と終わりに付け外しする
const flameScript = `$gameTroop.members().forEach(e => { if (e.enemyId() !== 312 || !e.isAlive()) return; if (e.isStateAffected(${ST.silence})) e.removeState(${STATE.flame}); else if (!e.isStateAffected(${STATE.flame})) e.addState(${STATE.flame}); });`;
troops[311].pages.push(page({ turnValid: true, turnA: 0, turnB: 1 }, 1, [{ code: 355, indent: 0, parameters: [flameScript] }]));
troops[311].pages.push(page({ turnEnding: true }, 1, [{ code: 355, indent: 0, parameters: [flameScript] }]));
writeTable("Troops.json", troops);

// ---------------------------------------------------------------------------
// System.json：筋の旗の名前（world2.md 16 章の W3 の行、world.md 8 章の仲間ザザ・シオンの旗）
// ---------------------------------------------------------------------------
const SWITCHES = {
  132: "遺骸:ザザ", 135: "遺骸:シオン", 137: "加入:ザザ", 140: "加入:シオン", 141: "完全体:オルド", 142: "完全体:ザザ", 145: "完全体:シオン",
  156: "ボス:焚刑官", 158: "ボス:岩背負い", 161: "巨人の吊り橋", 165: "護送路の扉:開",
};
const VARIABLES = { 132: "記憶:ザザ", 135: "記憶:シオン" };
const sysPath = dataPath("System.json");
const system = JSON.parse(fs.readFileSync(sysPath, "utf8"));
for (const [key, names] of [["switches", SWITCHES], ["variables", VARIABLES]]) {
  const arr = system[key];
  while (arr.length <= 200) arr.push("");
  for (const [id, name] of Object.entries(names)) arr[Number(id)] = name;
  for (let id = W3[0]; id <= W3[1] && id < arr.length; id++) arr[id] = ""; // W3 の帯（301–400）は今は使っていない
}
outputs.push({ file: sysPath, text: JSON.stringify(system) });

// ---------------------------------------------------------------------------
const ROOT = path.resolve(dataPath("."), "..");
let stale = 0;
for (const { file, text } of outputs) {
  const rel = path.relative(ROOT, file);
  const current = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
  if (check) {
    if (current !== text) {
      console.error(`古い: ${rel}（node tools/maps/src/w3_data.mjs で書き直す）`);
      stale++;
    } else console.log(`一致: ${rel}`);
  } else if (current !== text) {
    fs.writeFileSync(file, text);
    console.log(`書き出し: ${rel}`);
  }
}
if (stale) process.exit(1);
if (!check) console.log("W3 のデータを書いた");
