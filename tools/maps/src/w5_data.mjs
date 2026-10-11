// W5（#120）のデータベースの項目を書く。何度走らせても同じ結果になる（自分の帯だけを書き直す）。
//   node tools/maps/src/w5_data.mjs           書く
//   node tools/maps/src/w5_data.mjs --check   書かずに、今のファイルと同じかだけ見る（違えば終了コード 1）
// 書くもの（docs/world2.md 7〜9・11・14〜16 章、docs/lore.md 4.6・4.7）：
//   Items 223（蘇生師の印章。world2.md 14 章の鍵の番号）と、Items・Weapons・Armors・Skills・States・Enemies・Troops の 501–（W5 の帯 501–600。敵グループは 501–512）
//   System.json の switches・variables の名前：筋の旗（world2.md 16 章の「使う W」が W5 の行、オーブ「契約」「封印」、王都の門、ボス、結末 B。world.md 8 章）と W5 の帯（501–）
//     ほかの名前（W1〜W4・P8 のもの）は消さない
// 状態異常は P4（States 141–147）を使う。仲間の呪文（MZ の既定のスリープ）が付けるのは 10「睡眠」なので、眠りの穴はどちらにも付ける。
import fs from "node:fs";
import path from "node:path";
import { readData, formatTable, dataPath, extendTable } from "../../data/io.mjs";

const check = process.argv.includes("--check");
const outputs = []; // [{ file, text }]
const writeTable = (name, array) => outputs.push({ file: dataPath(name), text: formatTable(array) });

const ST = { death: 1, poison: 141, sleep: 142, ice: 143, confuse: 144, frenzy: 145, silence: 146, bind: 147 };
const MZ_ST = { poison: 4, silence: 6, confuse: 8, sleep: 10 }; // MZ の既定（仲間の呪文が付ける）
const EL = { physical: 1, fire: 2, ice: 3, thunder: 4, dark: 9 };

// ---------------------------------------------------------------------------
// 共通：帯の中だけを空にしてから書く
// ---------------------------------------------------------------------------
const W5 = [501, 600];
const KEY_SEAL = 223; // 蘇生師の印章（world2.md 14 章。W3 の 221・222 の続き。bands.json の W5 に入れた）
function clearBand(table, makeEmpty, [from, to] = W5) {
  extendTable(table, from - 1, makeEmpty);
  for (let id = from; id < table.length && id <= to; id++) table[id] = makeEmpty(id);
  while (table.length - 1 >= from && table.length - 1 <= to && table[table.length - 1].name === "") table.pop();
}
function put(table, id, item, makeEmpty) {
  if (!((id >= W5[0] && id <= W5[1]) || id === KEY_SEAL)) throw new Error(`${id} は W5 の帯の外`);
  extendTable(table, id, makeEmpty);
  table[id] = { ...makeEmpty(id), ...item, id };
}

// 説明（2 行目は来歴の一行）と来歴（メモ欄の <hai_lore>）。docs/lore.md 4.6・4.7 から写した
const LORE = {
  "来訪の記帳": { desc: ["研究所の守衛室の、来訪の記帳。", "王の訪れた日だけ、同伴の名の欄が空いている。"], lore: ["研究所の守衛が、訪れた者の名を書き留めた記帳。", "王が自ら来た日の行に、王の印と「同伴一名」の書き込み。", "同伴の名の欄には、書いては消した跡が三度ある。", "三度とも、墨が紙に乗らずに流れ落ちている。"] },
  "搬入の札": { desc: ["魔石の箱に打ち付けてあった木の札。", "差し出し元の焼き印は「廃坑　下層」。"], lore: ["研究所に運び込まれた魔石の箱の、木の札。", "差し出し元の焼き印は「廃坑　下層　採掘場」。", "受け取りの欄に、研究所の所長の判。", "日付は、帝国が坑道から引き上げた年より後のものばかりだ。"] },
  "白衣": { desc: ["毒を防ぐ。", "研究所の白衣。胸の名の刺繍を、何度もほどいた跡。"], lore: ["研究所の研究員に配られた白衣。薬に強い糸で織ってある。", "胸に名の刺繍。ほどいて縫い直した跡が、四つ重なっている。", "持ち主が替わるたびに、次の者の名を縫ったらしい。", "最後の名だけ、縫いかけで糸が垂れている。"] },
  "蘇生師の印章": { desc: ["契約の写し室の扉を開ける、蘇生師の印章。", "印面は鎖の輪。縁に、小さく別の紋がある。"], lore: ["宮廷の蘇生師に与えられた銀の印章。", "印面は鎖の輪を三つつないだ形。図柄は王が選んだ。", "印の縁に、目を凝らさないと見えないほど小さく、紋が彫り足してある。", "聖灰教会の孤児院の門に掛かっていた紋と同じだ。"] },
  "契約者の指輪": { desc: ["ＳＰの消費を２割減らす。", "番人の指にあった、秤の皿をかたどった指輪。"], lore: ["契約の番人の指に嵌まっていた、銀の指輪。", "台座は秤の皿の形で、内側に名が二つ彫ってある。", "一つは古い字で、読める者がいない。", "もう一つは新しい字で、刃物で削り取られている。"] },
  "割れた秤": { desc: ["番人が掲げていた真鍮の秤。", "片方の皿が割れて無い。割れ口はまだ新しい。"], lore: ["契約の番人が、秤の顔として掲げていた真鍮の秤。", "片方の皿には、白い灰が薄く積もっている。", "もう片方の皿は割れて、無い。割れ口はまだ新しく、光っている。"] },
  "水除けの長靴": { desc: ["毒を防ぎ、水の床でも足が鈍らない。", "下水番の長靴。底を三度張り替えてある。"], lore: ["王都の下水番が履いた、膝まである革の長靴。", "白く濁った水の中を、毎朝水門まで歩いた。", "底は三度張り替えてある。四度目の革は、注文が途絶えた。", "白い膜が張られた日から、上の街の職人が降りてこない。"] },
  "近衛の盾": { desc: ["物理のダメージを１割減らす。", "王の近衛の盾。裏に、見張りの交代の刻みが並ぶ。"], lore: ["王の近衛が使った、王家の紋の入った盾。", "裏に、見張りの交代のたびに刻んだ線が並んでいる。", "線は、ある日を境に途切れている。交代は来なかった。", "盾は、結界の光の届かない小部屋に立てかけてあった。"] },
  "近衛の誓剣": { desc: ["氷の属性。", "近衛の隊長の剣。刃に誓いの文が刻んである。"], lore: ["王の近衛の隊長が、叙任の日に授かった剣。", "刃に誓いの文。「王が解くまで、門を守る」。", "王はもう、誰の誓いも解けない。", "騎士の手から落ちた刃は冷えて、霜が付いている。"] },
  "錠前師の型紙": { desc: ["王都の錠前師の型紙の束。錠の形が並ぶ。", "一枚だけ、鍵穴の無い錠が描いてある。"], lore: ["王都の錠前師が、注文を受けた錠を描き留めた型紙の束。", "看守長の鍵束の十一本目と、同じ刻みの錠がある。", "一枚だけ、鍵穴の無い錠が描いてある。", "注文主の欄に「宮廷の蘇生師」。代金の欄は空いたまま。", "余白に錠前師の字。開ける鍵の無い錠は、作れない。"] },
  "白い澱": { desc: ["合成の材料。", "結界の真下の水に沈む、白い灰の澱。握ると温かい。"], lore: ["結界の真下の水に溜まる、白い灰の澱。", "ふつうの灰と違って、水に溶けない。握ると、手より温かい。", "下水番は、これを素手で触らなかった。", "上から降りてくる灰は、まだ誰かの分だと言っていたという。"] },
};
const descOf = name => LORE[name].desc.join("\n");
const loreOf = name => ["<hai_lore>", ...LORE[name].lore, "</hai_lore>"].join("\n");
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
const keyItem = (name, iconIndex) => ({
  name, description: descOf(name), iconIndex, itypeId: 2, consumable: false, occasion: 3, scope: 0, note: noteOf(name),
});
const items = readData("Items.json");
clearBand(items, emptyItem);
// 鍵（world2.md 14 章。091 所長室の机の引き出し → 092 契約の写し室の北の扉）
put(items, KEY_SEAL, keyItem("蘇生師の印章", 196), emptyItem);
// 道具で語る大事なもの（docs/lore.md 4.6・4.7。調べると拾える）
put(items, 501, keyItem("来訪の記帳", 121), emptyItem);
put(items, 502, keyItem("搬入の札", 187), emptyItem);
put(items, 503, keyItem("錠前師の型紙", 122), emptyItem);
// 契約の番人の固定ドロップ（第3段階の伏線）
put(items, 504, keyItem("割れた秤", 175), emptyItem);
// 素材（102 の水溜まりで拾える、灰の澱のドロップ。欄は W4 の沼主の髭 406 から写した）
put(items, 505, {
  name: "白い澱", description: descOf("白い澱"), iconIndex: 190, itypeId: 1, consumable: true, occasion: 3, scope: 0, price: 5,
  note: noteOf("白い澱", "<hai_max:20>"),
}, emptyItem);
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
// 近衛の誓剣：武器タイプ 2「剣」（職業 10 蘇生師＝ユエルが装備できる）。氷の属性
put(weapons, 501, {
  name: "近衛の誓剣", description: descOf("近衛の誓剣"), animationId: 72, iconIndex: 97, wtypeId: 2, params: [0, 0, 30, 0, 0, 0, 0, 0],
  note: noteOf("近衛の誓剣", "<hai_unique>"), traits: [{ code: 31, dataId: EL.ice, value: 0 }, { code: 22, dataId: 0, value: 0 }],
}, emptyWeapon);
writeTable("Weapons.json", weapons);

const emptyArmor = id => ({
  id, atypeId: 1, description: "", etypeId: 4, traits: [{ code: 22, dataId: 1, value: 0 }],
  iconIndex: 0, name: "", note: "", params: [0, 0, 0, 0, 0, 0, 0, 0], price: 0,
});
const armors = readData("Armors.json");
clearBand(armors, emptyArmor);
const resist = id => ({ code: 14, dataId: id, value: 0 });
const ARMORS = [
  // [ID, 名前, 防具タイプ, 装備タイプ, アイコン, 能力値, 特徴, ほかのタグ]
  // 白衣：軽装防具（身体）。毒を防ぐ（P4 の毒と MZ の毒。耐性は 1 つの状態異常として数える）
  [501, "白衣", 3, 4, 135, [0, 0, 0, 8, 0, 6, 0, 0], [resist(ST.poison), resist(MZ_ST.poison)], []],
  // 契約者の指輪：装飾品。特殊能力値「TP 消費率」80%（ＳＰは MZ の TP の読み替え。docs/plugins/Hai_Battle.md 1 章）
  [502, "契約者の指輪", 1, 5, 145, [0, 0, 0, 2, 4, 2, 0, 0], [{ code: 23, dataId: 5, value: 0.8 }], []],
  // 水除けの長靴：装飾品。毒を防ぐ（「水の床でも足が鈍らない」床はまだ無い。効果は毒だけ）
  [503, "水除けの長靴", 1, 5, 146, [0, 0, 0, 4, 0, 2, 2, 0], [resist(ST.poison), resist(MZ_ST.poison)], []],
  // 近衛の盾：小型盾（職業 10 蘇生師が装備できる）。物理ダメージ率 90%
  [504, "近衛の盾", 5, 2, 128, [0, 0, 0, 10, 0, 4, 0, 0], [{ code: 23, dataId: 6, value: 0.9 }], []],
];
for (const [id, name, atypeId, etypeId, iconIndex, params, traits, tags] of ARMORS) {
  put(armors, id, { name, description: descOf(name), atypeId, etypeId, iconIndex, params, traits, note: noteOf(name, ...tags, "<hai_unique>") }, emptyArmor);
}
writeTable("Armors.json", armors);

// ---------------------------------------------------------------------------
// States 501–（契約の番人の「呪文を食う」、灰の騎士の「近衛の守り」）。欄は States.json の既存の項目から写した
// ---------------------------------------------------------------------------
const emptyState = id => ({
  id, autoRemovalTiming: 0, chanceByDamage: 100, iconIndex: 0, maxTurns: 1, message1: "", message2: "", message3: "", message4: "",
  minTurns: 1, motion: 0, name: "", note: "", overlay: 0, priority: 50, releaseByDamage: false, removeAtBattleEnd: true,
  removeByDamage: false, removeByRestriction: false, removeByWalking: false, restriction: 0, stepsToRemove: 100, traits: [], messageType: 1,
});
const states = readData("States.json");
clearBand(states, emptyState);
const STATE = { eat: 501, guard: 502 };
// 次のターンの終わりまで、魔法を受け付けず（魔法回避 100%）、毎ターン HP を 8% 戻す
put(states, STATE.eat, {
  name: "呪文を食う", iconIndex: 72, autoRemovalTiming: 2, minTurns: 2, maxTurns: 2, priority: 60,
  message1: "%1は大きく口を開けた！", message4: "%1は口を閉じた。",
  traits: [{ code: 22, dataId: 4, value: 1 }, { code: 22, dataId: 7, value: 0.08 }],
  note: "<hai_w5:契約の番人（獣の顔）の呪文を食う。魔法回避 100%・HP 再生 8%>",
}, emptyState);
// 近衛の亡霊が生きている間、灰の騎士が受けるダメージを半分に（敵グループ 512 のバトルイベントが付け外しする）
put(states, STATE.guard, {
  name: "近衛の守り", iconIndex: 81, priority: 40,
  traits: [{ code: 23, dataId: 6, value: 0.5 }, { code: 23, dataId: 7, value: 0.5 }],
  note: "<hai_w5:灰の騎士を近衛の亡霊がかばう。物理と魔法のダメージ率 50%。亡霊がいなくなると外れる>",
}, emptyState);
writeTable("States.json", states);

// ---------------------------------------------------------------------------
// Skills 501–（敵の技。欄は w4_data.mjs と同じ）
// ---------------------------------------------------------------------------
const emptySkill = id => ({
  id, animationId: 0, damage: { critical: false, elementId: 0, formula: "0", type: 0, variance: 20 },
  description: "", effects: [], hitType: 0, iconIndex: 0, message1: "", message2: "", mpCost: 0, name: "", note: "",
  occasion: 0, repeats: 1, requiredWtypeId1: 0, requiredWtypeId2: 0, scope: 1, speed: 0, stypeId: 0, successRate: 100,
  tpCost: 0, tpGain: 0, messageType: 1,
});
const skills = readData("Skills.json");
clearBand(skills, emptySkill);
const dmg = (formula, elementId = 0, type = 1, variance = 20) => ({ critical: false, elementId, formula, type, variance });
const addState = (id, rate) => ({ code: 21, dataId: id, value1: rate, value2: 0 });
// stypeId：0 は沈黙で封じられない。1（魔法）は沈黙 146 で封じられる
const SKILLS = {
  // 研究所
  501: { name: "病みの牙", message1: "%1は噛みついた！", scope: 1, hitType: 1, animationId: 11, damage: dmg("a.atk * 3 - b.def * 2", -1), effects: [addState(ST.poison, 0.5)] },
  502: { name: "眠りの視線", message1: "%1はじっとこちらを見つめた！", scope: 1, hitType: 2, animationId: 63, effects: [addState(ST.sleep, 0.4)] },
  503: { name: "毒の針", message1: "%1は細い針を突き立てた！", scope: 1, hitType: 1, animationId: 1, damage: dmg("a.atk * 3 - b.def * 2", -1), effects: [addState(ST.poison, 0.6)] },
  504: { name: "継ぎ当て", message1: "%1は仲間の傷を縫い合わせた！", scope: 7, hitType: 0, animationId: 41, damage: dmg("120 + a.mat * 2", 0, 3) },
  505: { name: "放電", message1: "%1は青白い火花を散らした！", scope: 1, hitType: 2, animationId: 77, damage: dmg("30 + a.mat * 2 - b.mdf", EL.thunder), stypeId: 1 },
  506: { name: "砕け散る", message1: "%1は砕け散った！", scope: 2, hitType: 0, animationId: 108, damage: dmg("80 + a.mat * 2 - b.mdf", EL.thunder) },
  507: { name: "継ぎ目の殴打", message1: "%1は太い腕を振り回した！", scope: 1, hitType: 1, animationId: 2, damage: dmg("a.atk * 4 - b.def * 2", -1) },
  // 契約の番人
  508: { name: "取り立て", message1: "%1は秤を傾けた！", message2: "命の重さを量り取られる！", scope: 1, hitType: 0, animationId: 59, damage: dmg("Math.floor(b.hp * 0.3)", 0, 1, 0) },
  // 縛りは 2 ターン。続けて掛けられて動けないままにならないよう、取り立ての 3 分の 1 の重み（行動の評価 3）にした
  509: { name: "契約の鎖", message1: "%1は赤い鎖を投げつけた！", scope: 1, hitType: 2, animationId: 63, effects: [addState(ST.bind, 0.6)] },
  510: { name: "爪", message1: "%1は爪を振り下ろした！", scope: 1, hitType: 1, animationId: 7, damage: dmg("a.atk * 4 - b.def * 2", -1) },
  511: { name: "咆哮", message1: "%1は吠えた！", scope: 2, hitType: 0, animationId: 63, effects: [addState(ST.frenzy, 0.4)] },
  512: { name: "呪文を食う", message1: "%1は宙の呪文を嗅ぎ回った！", scope: 11, hitType: 0, animationId: 51, effects: [addState(STATE.eat, 1)] },
  // 下水道
  513: { name: "澱の滴", message1: "%1は白い滴を垂らした！", scope: 1, hitType: 1, animationId: 1, damage: dmg("a.atk * 2 - b.def", -1), effects: [addState(ST.poison, 0.6)] },
  514: { name: "盾打ち", message1: "%1は盾で殴りつけた！", scope: 1, hitType: 1, animationId: 2, damage: dmg("a.atk * 3 - b.def * 2", -1) },
  515: { name: "眠りの鱗粉", message1: "%1は白い粉を撒き散らした！", scope: 2, hitType: 2, animationId: 63, effects: [addState(ST.sleep, 0.3)] },
  516: { name: "毒牙", message1: "%1は牙を剥いた！", scope: 1, hitType: 1, animationId: 11, damage: dmg("a.atk * 3 - b.def * 2", -1), effects: [addState(ST.poison, 0.7)] },
  517: { name: "締め付け", message1: "%1は長い体で締め付けた！", scope: 1, hitType: 1, animationId: 2, damage: dmg("a.atk * 2 - b.def", -1), effects: [addState(ST.bind, 0.8)] },
  // 灰の騎士
  518: { name: "近衛の剣", message1: "%1は剣を振り下ろした！", scope: 1, hitType: 1, animationId: 6, damage: dmg("a.atk * 4 - b.def * 2", -1) },
  519: { name: "王命", message1: "%1は剣を掲げた！", message2: "「門に近づくな」", scope: 2, hitType: 0, animationId: 63, damage: dmg("20 + a.atk - b.def", -1), effects: [addState(ST.silence, 0.6)] },
  520: { name: "灰の嵐", message1: "%1の鎧から灰が吹き荒れた！", scope: 2, hitType: 0, animationId: 59, damage: dmg("25 + a.atk - b.def", -1) },
};
for (const [id, s] of Object.entries(SKILLS)) put(skills, Number(id), { stypeId: 0, ...s, occasion: 1, note: "<hai_w5:敵の技>" }, emptySkill);
writeTable("Skills.json", skills);

// ---------------------------------------------------------------------------
// Enemies・Troops（world2.md 7・8・9 章。数値は仮。持ち主が調整する）
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
  magicRate: rate => ({ code: 23, dataId: 7, value: rate }),
  stateResist: stateId => ({ code: 14, dataId: stateId, value: 0 }),
  stateRate: (stateId, rate) => ({ code: 13, dataId: stateId, value: rate }),
  extraAction: () => ({ code: 61, dataId: 0, value: 1 }),
  substitute: () => ({ code: 62, dataId: 2, value: 0 }),
};
// 即死は効かない：「ステート有効度（戦闘不能）0%」。「ステート無効化（戦闘不能）」は HP 0 でも倒れなくなるので使わない（docs/plugins/Hai_Boss.md）
const noDeath = T.stateRate(ST.death, 0);
const base = [{ code: 22, dataId: 0, value: 0.95 }, { code: 22, dataId: 1, value: 0.05 }];
const act = (skillId, rating = 5) => ({ conditionParam1: 0, conditionParam2: 0, conditionType: 0, rating, skillId });
const onTurn = (skillId, a, b, rating = 5) => ({ conditionParam1: a, conditionParam2: b, conditionType: 1, rating, skillId });
const attack = act(1);
const drop = (kind, dataId, denominator) => ({ dataId, denominator, kind });
const none = drop(0, 1, 1);
// 素材と消耗品：199 苦い根、200 灰の苔（P9）、204 眠り香（W1）、302 凍て石・303 雷鳴石（W3）、505 白い澱（W5）
const DROP = { root: drop(1, 199, 4), moss: drop(1, 200, 4), sleep: drop(1, 204, 8), ice: drop(1, 302, 6), thunder: drop(1, 303, 6), dregs: drop(1, 505, 3) };
const physical = T.attackElement(EL.physical);
const sleepOk = rate => [T.stateRate(ST.sleep, rate), T.stateRate(MZ_ST.sleep, rate)];
const confuseOk = rate => [T.stateRate(ST.confuse, rate), T.stateRate(MZ_ST.confuse, rate)];
// 契約の番人：秤の顔（物理と魔法 50%、炎 200%）→ HP 50% で獣の顔（513。魔法 無効、物理 150%、眠りが効く、2 回行動）
const KEEPER_DROPS = "<hai_boss_switch:154>\n<hai_drop:item,504,1>";
const KEEPER_A = "<hai_boss>\n<hai_boss_name:契約の番人>\n<hai_weak_hint:炎>\n<hai_transform:513,50>\n" + KEEPER_DROPS;
const KEEPER_B = "<hai_boss>\n<hai_boss_name:契約の番人>\n<hai_weak_hint:物理>\n<hai_actions:2>\n" + KEEPER_DROPS;
// 灰の騎士：物理 50%、闇 無効、毒・眠り 無効、氷 200%、混乱が効く → HP 50% で灰の嵐（514。防御が下がり、2 回行動。毎ターンの嵐は敵グループ 512 のバトルイベント）
const KNIGHT_RESIST = [T.element(EL.dark, 0), T.stateResist(ST.poison), T.stateResist(MZ_ST.poison), T.stateResist(ST.sleep), T.stateResist(MZ_ST.sleep),
  T.element(EL.ice, 2), ...confuseOk(1.5), noDeath];
const KNIGHT_A = "<hai_boss>\n<hai_boss_name:灰の騎士>\n<hai_weak_hint:氷>\n<hai_transform:514,50>\n<hai_boss_switch:155>";
const KNIGHT_B = "<hai_boss>\n<hai_boss_name:灰の騎士>\n<hai_weak_hint:氷>\n<hai_actions:2>\n<hai_boss_switch:155>";
// [ID, 名前, 戦闘の絵, 色相, [HP, MP, 攻, 防, 魔, 魔防, 敏, 運], 経験値, 魔石, 特徴, 行動, ドロップ, メモ]
const ENEMIES = [
  // 研究所（world2.md 7 章）
  [501, "試験体の鼠", "SF_Zombiedog", 0, [260, 0, 30, 14, 10, 12, 26, 10], 12, 10, [physical], [attack, act(501)], [DROP.root], ""],
  [502, "瓶詰めの目", "Oddegg", 260, [360, 30, 20, 20, 30, 24, 10, 10], 16, 12, [physical], [act(1, 3), act(502)], [DROP.sleep], ""],
  [503, "白衣の亡者", "SF_Madscientist", 0, [720, 40, 36, 26, 30, 26, 18, 10], 36, 26, [physical, T.element(EL.fire, 1.5)], [attack, act(503), act(504, 4)], [DROP.moss], ""],
  // HP 30% で砕け散る（敵グループ 504 のバトルイベント）
  [504, "魔石の欠片", "Plasma", 300, [620, 40, 30, 30, 38, 30, 24, 10], 36, 26, [physical, T.element(EL.thunder, 2)], [act(1, 3), act(505)], [DROP.thunder], ""],
  [505, "継ぎ接ぎ", "Berserker", 150, [1900, 0, 56, 36, 10, 24, 16, 10], 130, 90, [physical, T.element(EL.fire, 2), T.extraAction()], [attack, act(507)], [DROP.root], ""],
  [506, "契約の番人", "Demoncount", 0, [5600, 200, 50, 40, 50, 40, 26, 20], 700, 700,
    [physical, T.physRate(0.5), T.magicRate(0.5), T.element(EL.fire, 2), noDeath], [act(508), act(509, 3)], [drop(3, 502, 1)], KEEPER_A],
  // 下水道（world2.md 8 章）
  [507, "溝鼠", "SF_Wolf", 60, [200, 0, 26, 10, 10, 10, 30, 10], 8, 6, [physical], [attack], [DROP.root], ""],
  [508, "灰の澱", "Plasma", 0, [420, 0, 24, 24, 10, 20, 8, 10], 16, 12, [physical, T.element(EL.fire, 1.5)], [act(1, 3), act(513)], [DROP.dregs], ""],
  [509, "近衛の亡霊", "Wraith", 180, [760, 0, 40, 36, 16, 30, 20, 10], 36, 26, [physical, T.physRate(0.8), T.element(EL.ice, 1.5), T.substitute()], [attack, act(514)], [DROP.ice], ""],
  [510, "白い蛾", "Sylph", 0, [560, 40, 30, 20, 34, 26, 34, 10], 36, 26, [physical, T.element(EL.fire, 1.5)], [attack, act(515, 4)], [DROP.moss], ""],
  [511, "下水の大蛇", "SF_Anaconda", 0, [2000, 0, 58, 38, 20, 26, 22, 10], 130, 90, [physical, T.element(EL.ice, 2)], [act(516), act(517, 4)], [DROP.ice], ""],
  [512, "灰の騎士", "Blackknight", 0, [5600, 100, 60, 48, 30, 40, 28, 20], 700, 700, [physical, T.physRate(0.5), ...KNIGHT_RESIST],
    [act(518), onTurn(519, 3, 3, 9)], [drop(2, 501, 1)], KNIGHT_A],
  // ボスの第二形態
  [513, "契約の番人", "Demon_metamorphosis", 0, [5600, 200, 62, 30, 40, 30, 30, 20], 700, 700,
    [physical, T.magicRate(0), T.element(EL.physical, 1.5), ...sleepOk(1.5), noDeath], [act(510), act(511, 4), onTurn(512, 3, 3, 9)], [drop(3, 502, 1)], KEEPER_B],
  [514, "灰の騎士", "Stoneknight", 0, [5600, 100, 66, 30, 30, 30, 32, 20], 700, 700, [physical, T.physRate(0.7), ...KNIGHT_RESIST],
    [act(518), onTurn(519, 3, 3, 9)], [drop(2, 501, 1)], KNIGHT_B],
];
const enemies = readData("Enemies.json");
clearBand(enemies, emptyEnemy);
for (const [id, name, battlerName, battlerHue, params, exp, gold, traits, actions, drops, note] of ENEMIES) {
  const dropItems = [...drops, none, none, none].slice(0, 3);
  put(enemies, id, { name, battlerName, battlerHue, params, exp, gold, traits: [...base, ...traits], actions, dropItems, note }, emptyEnemy);
}
writeTable("Enemies.json", enemies);

const emptyPage = () => ({
  conditions: { actorHp: 50, actorId: 1, actorValid: false, enemyHp: 50, enemyIndex: 0, enemyValid: false, switchId: 1, switchValid: false, turnA: 0, turnB: 0, turnEnding: false, turnValid: false },
  list: [{ code: 0, indent: 0, parameters: [] }], span: 0,
});
const emptyTroop = id => ({ id, members: [], name: "", pages: [emptyPage()] });
const row = n => Array.from({ length: n }, (_, i) => ({ x: Math.round(640 + (i - (n - 1) / 2) * 200), y: 460 }));
const TROOPS = [
  [501, "W5_緑：試験体の鼠×2", [501, 501]],
  [502, "W5_緑：瓶詰めの目", [502]],
  [503, "W5_黄：白衣の亡者", [503]],
  [504, "W5_黄：魔石の欠片", [504]],
  [505, "W5_赤：継ぎ接ぎ", [505]],
  [506, "W5_ボス：契約の番人", [506]],
  [507, "W5_緑：溝鼠×3", [507, 507, 507]],
  [508, "W5_緑：灰の澱", [508]],
  [509, "W5_黄：近衛の亡霊×2", [509, 509]],
  [510, "W5_黄：白い蛾", [510]],
  [511, "W5_赤：下水の大蛇", [511]],
  [512, "W5_ボス：灰の騎士", [512]],
];
const troops = readData("Troops.json");
clearBand(troops, emptyTroop, [501, 512]);
for (const [id, name, members] of TROOPS) {
  const pos = row(members.length);
  put(troops, id, { name, members: members.map((enemyId, i) => ({ enemyId, ...pos[i], hidden: false })) }, emptyTroop);
}
const page = (conditions, span, list) => {
  const p = emptyPage();
  return { ...p, conditions: { ...p.conditions, ...conditions }, span, list: [...list, { code: 0, indent: 0, parameters: [] }] };
};
const msg = (indent, lines) => [{ code: 101, indent, parameters: ["", 0, 0, 2, ""] }, ...lines.map(text => ({ code: 401, indent, parameters: [text] }))];
const script = (indent, text) => text.split("\n").map((line, i) => ({ code: i ? 655 : 355, indent, parameters: [line] }));
// 魔石の欠片：HP 30% で砕け散る（全体の雷）。強制行動のあと戦闘不能にして崩れる演出を出す
troops[504].pages.push(page({ enemyValid: true, enemyIndex: 0, enemyHp: 30 }, 0, [
  { code: 111, indent: 0, parameters: [12, "$gameTroop.members()[0].isAlive()"] },
  { code: 339, indent: 1, parameters: [0, 0, 506, -1] },
  { code: 333, indent: 1, parameters: [0, 0, ST.death] },
  { code: 0, indent: 1, parameters: [] },
  { code: 412, indent: 0, parameters: [] },
]));
// 灰の騎士 ③：開幕と HP 70% で近衛の亡霊を 1 体ずつ呼ぶ。亡霊が生きている間は騎士に「近衛の守り」（かばう）。
// ④ HP 50% で灰の嵐（514）になると、毎ターンの終わりに全体へ灰の嵐。騎士が倒れたら残った亡霊は消える
troops[512].members = [
  { enemyId: 512, x: 640, y: 440, hidden: false },
  { enemyId: 509, x: 380, y: 500, hidden: true },
  { enemyId: 509, x: 900, y: 500, hidden: true },
];
const guardToggle = `const knight = $gameTroop.members()[0];
const guarded = $gameTroop.members().slice(1).some(e => e.isAlive() && e.isAppeared());
if (knight.isAlive() && guarded) knight.addState(${STATE.guard});
else knight.removeState(${STATE.guard});`;
troops[512].pages.push(page({ turnValid: true, turnA: 0, turnB: 0 }, 0, [
  ...msg(0, ["灰の騎士が剣を掲げると、灰の中から近衛が立ち上がった！"]),
  { code: 335, indent: 0, parameters: [1] },
  ...script(0, guardToggle),
]));
troops[512].pages.push(page({ enemyValid: true, enemyIndex: 0, enemyHp: 70 }, 0, [
  { code: 111, indent: 0, parameters: [12, "$gameTroop.members()[0].isAlive()"] },
  ...msg(1, ["灰の騎士がもう一度剣を掲げた。近衛がまた一人、立ち上がった！"]),
  { code: 335, indent: 1, parameters: [2] },
  ...script(1, guardToggle),
  { code: 0, indent: 1, parameters: [] },
  { code: 412, indent: 0, parameters: [] },
]));
troops[512].pages.push(page({ turnValid: true, turnA: 1, turnB: 1 }, 1, script(0, guardToggle)));
troops[512].pages.push(page({ turnEnding: true }, 1, [
  { code: 111, indent: 0, parameters: [12, "$gameTroop.members()[0].isAlive() && Hai.Boss.phase($gameTroop.members()[0]) >= 2"] },
  ...msg(1, ["崩れた鎧から、灰の嵐が吹き荒れる！"]),
  { code: 311, indent: 1, parameters: [0, 0, 1, 0, 30, false] },
  { code: 0, indent: 1, parameters: [] },
  { code: 412, indent: 0, parameters: [] },
]));
troops[512].pages.push(page({ enemyValid: true, enemyIndex: 0, enemyHp: 0 }, 1, [
  { code: 111, indent: 0, parameters: [12, "$gameTroop.aliveMembers().length > 0"] },
  ...msg(1, ["主を失った近衛は、灰になって崩れた。"]),
  { code: 355, indent: 1, parameters: ["$gameTroop.aliveMembers().forEach(e => e.escape());"] },
  { code: 0, indent: 1, parameters: [] },
  { code: 412, indent: 0, parameters: [] },
]));
writeTable("Troops.json", troops);

// ---------------------------------------------------------------------------
// System.json：筋の旗の名前（world2.md 16 章の W5 の行、world.md 8 章のオーブ「契約」「封印」・王都の門・ボス・結末 B）と W5 の帯
// ---------------------------------------------------------------------------
const SWITCHES = {
  103: "オーブ:契約", 104: "オーブ:封印", 105: "オーブ:四つ揃った", 106: "真の姿", 107: "セレスの正体を知った", 115: "王都の門に着いた",
  154: "ボス:契約の番人", 155: "ボス:灰の騎士", 160: "鍵束の扉:開", 162: "下水の水門:東", 163: "搬送路の扉:開", 182: "結末:灰の履行",
  501: "W5_門の前の場面を見た",
};
const VARIABLES = { 106: "研究所の制御盤" };
const sysPath = dataPath("System.json");
const system = JSON.parse(fs.readFileSync(sysPath, "utf8"));
for (const [key, names] of [["switches", SWITCHES], ["variables", VARIABLES]]) {
  const arr = system[key];
  const want = Math.max(...Object.keys(names).map(Number));
  for (let id = W5[0]; id <= W5[1] && id < arr.length; id++) arr[id] = ""; // W5 の帯（501–600）は下で書くものだけ
  while (arr.length <= Math.max(200, want)) arr.push("");
  for (const [id, name] of Object.entries(names)) arr[Number(id)] = name;
  while (arr.length - 1 > 200 && arr.length - 1 >= W5[0] && arr.length - 1 <= W5[1] && arr[arr.length - 1] === "") arr.pop();
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
      console.error(`古い: ${rel}（node tools/maps/src/w5_data.mjs で書き直す）`);
      stale++;
    } else console.log(`一致: ${rel}`);
  } else if (current !== text) {
    fs.writeFileSync(file, text);
    console.log(`書き出し: ${rel}`);
  }
}
if (stale) process.exit(1);
if (!check) console.log("W5 のデータを書いた");
