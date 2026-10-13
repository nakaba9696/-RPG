// W4（#102）のデータベースの項目を書く。何度走らせても同じ結果になる（自分の帯だけを書き直す）。
//   node tools/maps/src/w4_data.mjs           書く
//   node tools/maps/src/w4_data.mjs --check   書かずに、今のファイルと同じかだけ見る（違えば終了コード 1）
// 書くもの（docs/world2.md 5・6・9・11・12・16 章、docs/lore.md 4.4・4.5）：
//   Items・Weapons・Armors・Skills・States・Enemies・Troops の 401–（W4 の帯 401–500。敵グループは 401–412）
//   System.json の switches・variables の名前：筋の旗（world2.md 16 章の「使う W」が W4 の行、オーブ「聖灰」、仲間ノクス・ルメの旗 world.md 8 章）と W4 の帯（401–）
//     ほかの名前（W1・W2・W3・P8 のもの）は消さない
// 状態異常は P4（States 141–147）を使う。仲間の呪文（MZ の既定のスリープ・サイレンス）が付けるのは 10「睡眠」・6「沈黙」なので、ボスの耐性はどちらにも付ける。
import fs from "node:fs";
import path from "node:path";
import { readData, formatTable, dataPath, extendTable } from "../../data/io.mjs";

const check = process.argv.includes("--check");

// 引退（P15 #250）：前の世界の生成。帯は新しい世界の w8_data.mjs・w9_data.mjs が書き直したので、走らせると今の data/ を壊す。
// 書かずに、--check でも何も見ずに終える（どの生成をどの順で走らせ直しても data/ が今と同じになるように）。中身は控えとして残す。
console.log("引退: tools/maps/src/w4_data.mjs（前の世界の生成。何も書かない）");
process.exit(0);
const outputs = []; // [{ file, text }]
const writeTable = (name, array) => outputs.push({ file: dataPath(name), text: formatTable(array) });

const ST = { poison: 141, sleep: 142, ice: 143, confuse: 144, frenzy: 145, silence: 146, bind: 147 };
const MZ_ST = { silence: 6, confuse: 8, sleep: 10 }; // MZ の既定（仲間の呪文が付ける）
const EL = { physical: 1, fire: 2, ice: 3, thunder: 4, water: 5 };

// ---------------------------------------------------------------------------
// 共通：帯の中だけを空にしてから書く
// ---------------------------------------------------------------------------
const W4 = [401, 500];
function clearBand(table, makeEmpty, [from, to] = W4) {
  extendTable(table, from - 1, makeEmpty);
  for (let id = from; id < table.length && id <= to; id++) table[id] = makeEmpty(id);
  while (table.length - 1 >= from && table.length - 1 <= to && table[table.length - 1].name === "") table.pop();
}
function put(table, id, item, makeEmpty) {
  if (!(id >= W4[0] && id <= W4[1])) throw new Error(`${id} は W4 の帯の外`);
  extendTable(table, id, makeEmpty);
  table[id] = { ...makeEmpty(id), ...item, id };
}

// 説明（2 行目は来歴の一行）と来歴（メモ欄の <hai_lore>）。docs/lore.md 4.4・4.5 から写した
const LORE = {
  "灰の病の届け帳": { desc: ["人間の村の、灰の病の届け帳。", "水門番の字で、名前と日付が並ぶ。"], lore: ["湿地の人間の村で、灰の病にかかった者の名を届けた帳面。", "字の上手な水門番が、村の頼みで清書していた。", "二十年余りの名前が並ぶ。どれも人間の名だ。", "最後の頁の隅に、水門番の書き込みがある。", "魚人の名を探した。一つも無い。網を切った者に見せたい。"] },
  "牙の首飾り": { desc: ["獣人の子の、小さな牙の首飾り。", "魚人の家の梁に、同じ物がいくつも下がっていた。"], lore: ["獣人の子が、生え替わりで抜けた牙を糸に通した首飾り。", "獣人の村では、子の牙を戸口に下げて無事を願う。", "魚人の水上の家の梁に、同じ首飾りが並んで下がっていた。", "魚人の歯は、生え替わらない。"] },
  "漁師の銛": { desc: ["氷の属性。", "魚人の漁師の銛。穂先が冷たく、水に入れると霜が付く。"], lore: ["湿地の魚人の漁師が、冬の淵で使った銛。", "穂先に冷たい石が嵌めてあり、刺さった魚は暴れずに凍る。", "沈んだ荷車に、切られた網と一緒に積まれていた。", "持ち主は荷を捨てて、舟に子どもを乗せた。"] },
  "歌い手の首飾り": { desc: ["眠りを防ぐ。", "貝を連ねた首飾り。舞台に立つ歌い手が着けた。"], lore: ["湿地の歌い手が、舞台に立つときだけ着けた貝の首飾り。", "貝は一つずつ、違う浜から拾ってある。", "首に掛けると貝が触れ合って鳴り、歌う前に耳が冴える。", "舞台袖の壁の中に、次の歌い手に渡すつもりでしまってあった。"] },
  "水鏡の護符": { desc: ["水と氷のダメージを半分に抑える。", "磨いた貝殻の手鏡。沼主の腹の中にあった。"], lore: ["沈んだ舞台の楽屋に掛かっていた、貝殻を磨いた手鏡。", "歌い手は舞台に出る前に、これで口の形を確かめた。", "淵の主に呑まれて、腹の中で長く過ごした。", "水も冷たさも鏡の面には届かず、曇り一つ無い。"] },
  "沼主の髭": { desc: ["合成の材料。", "沼主の太い髭。雷が鳴ると、ひとりでに縮む。"], lore: ["淵の主の口の端から伸びていた、太く長い髭。", "雷の音を聞くと、切り取った後でもひとりでに縮む。", "老いた歌い手は、この髭を軒に下げて天気を読んだ。"] },
  "点の字の栞": { desc: ["指でなぞって読む、点の字の栞。", "裏に、目の見える者のための手書きの一覧表。"], lore: ["書院の司書が使った、点の字を打った細い板の栞。", "裏に、点の形と文字を並べた一覧表が墨で書いてある。", "目の見えない司書には、この表は要らない。", "表の字は角ばった若い字で、何度も書き直してある。"] },
  "夜の閲覧の札": { desc: ["禁書庫の本を、夜に読むための許しの札の束。", "借りた者の欄は、毎晩同じ字で埋まっている。"], lore: ["禁書庫の本を、夜に閲覧室で読むための許しの札。", "司書の印と、借りた者の名を書く欄がある。", "ひと冬の間、名の欄は毎晩同じ字だ。名は擦れて読めない。", "最後の札だけ、返した印が無い。書名の欄に「作法の写し」。"] },
  "灰樫の杖": { desc: ["雷の属性。", "書架を組んだ灰樫の余り木で作られた杖。"], lore: ["古書院の書架を組んだ、灰樫の余り木を削った杖。", "灰樫は雷を呼ぶ木で、書院の屋根の避雷の柱にも使われた。", "焚書の夜、書架は燃えたが、この杖は書架の裏で焦げずに残った。", "握りに点の字が一つ打ってある。「戻せ」。"] },
  "司書の眼鏡": { desc: ["沈黙と混乱を防ぐ。", "古書院の書庫番の眼鏡。紙魚の王の頁の山にあった。"], lore: ["古書院の書庫番が、細かい写本の字を読むために掛けた眼鏡。", "目の見えない司書の代わりに、目録を読み上げるのが役目だった。", "焚書の日には、教会の使いの前で、燃やす本の題を読み上げた。", "一冊目は、聖女の奇跡の記録だった。"] },
  "焼け残りの頁": { desc: ["焚書の火をくぐった、写本の一枚。", "端に、円と線の図が半分だけ残っている。"], lore: ["禁書庫の古い写本から焼け残った一枚。", "頁の端に、円と線を組み合わせた図が半分だけ残っている。", "図の横の古い言葉は「呼ぶ者」「立つ者」「払う者」と読める。", "裏に点の字の打ち跡が透けている。この頁は、一度写されている。"] },
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
const keyItem = (name, description, iconIndex) => ({
  name, description, iconIndex, itypeId: 2, consumable: false, occasion: 3, scope: 0,
});
const items = readData("Items.json");
clearBand(items, emptyItem);
const key = (id, name, iconIndex) => put(items, id, { ...keyItem(name, descOf(name), iconIndex), note: noteOf(name) }, emptyItem);
// 道具で語る大事なもの（docs/lore.md 4.4・4.5。調べると拾える）
key(401, "灰の病の届け帳", 121);
key(402, "牙の首飾り", 145);
key(403, "点の字の栞", 122);
key(404, "夜の閲覧の札", 123);
// 紙魚の王の固定ドロップ（P8 の理知の間で読める）
key(405, "焼け残りの頁", 124);
// 沼主の固定ドロップ（素材。欄は P9 の苦い根 199 から写した）
put(items, 406, {
  name: "沼主の髭", description: descOf("沼主の髭"), iconIndex: 189, itypeId: 1, consumable: true, occasion: 3, scope: 0, price: 5,
  note: noteOf("沼主の髭", "<hai_max:20>"),
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
// 漁師の銛：武器タイプ 12「槍」（職業 4 騎士＝オルドが装備できる）。灰樫の杖：6「杖」（ノクス・シオン）
put(weapons, 401, {
  name: "漁師の銛", description: descOf("漁師の銛"), animationId: 72, iconIndex: 107, wtypeId: 12, params: [0, 0, 24, 0, 0, 0, 0, 0],
  note: noteOf("漁師の銛", "<hai_unique>"), traits: [{ code: 31, dataId: EL.ice, value: 0 }, { code: 22, dataId: 0, value: 0 }],
}, emptyWeapon);
put(weapons, 402, {
  name: "灰樫の杖", description: descOf("灰樫の杖"), animationId: 77, iconIndex: 101, wtypeId: 6, params: [0, 0, 8, 0, 18, 6, 0, 0],
  note: noteOf("灰樫の杖", "<hai_unique>"), traits: [{ code: 31, dataId: EL.thunder, value: 0 }, { code: 22, dataId: 0, value: 0 }],
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
  // [ID, 名前, 防具タイプ, 装備タイプ, アイコン, 能力値, 特徴]
  [401, "歌い手の首飾り", 1, 5, 145, [0, 0, 0, 2, 0, 4, 0, 0], [resist(ST.sleep), resist(MZ_ST.sleep)]],
  [402, "水鏡の護符", 1, 5, 146, [0, 0, 0, 4, 0, 4, 0, 0], [{ code: 11, dataId: EL.water, value: 0.5 }, { code: 11, dataId: EL.ice, value: 0.5 }]],
  [403, "司書の眼鏡", 1, 5, 147, [0, 0, 0, 0, 4, 4, 0, 0], [resist(ST.silence), resist(MZ_ST.silence), resist(ST.confuse), resist(MZ_ST.confuse)]],
];
for (const [id, name, atypeId, etypeId, iconIndex, params, traits] of ARMORS) {
  put(armors, id, { name, description: descOf(name), atypeId, etypeId, iconIndex, params, traits, note: noteOf(name, "<hai_unique>") }, emptyArmor);
}
writeTable("Armors.json", armors);

// ---------------------------------------------------------------------------
// States 401–（沼主の「淵に潜る」と「呑み込み」）。欄は States.json の既存の項目から写した
// ---------------------------------------------------------------------------
const emptyState = id => ({
  id, autoRemovalTiming: 0, chanceByDamage: 100, iconIndex: 0, maxTurns: 1, message1: "", message2: "", message3: "", message4: "",
  minTurns: 1, motion: 0, name: "", note: "", overlay: 0, priority: 50, releaseByDamage: false, removeAtBattleEnd: true,
  removeByDamage: false, removeByRestriction: false, removeByWalking: false, restriction: 0, stepsToRemove: 100, traits: [], messageType: 1,
});
const states = readData("States.json");
clearBand(states, emptyState);
const STATE = { dive: 401, swallowed: 402 };
// 潜った次のターンの「大波」まで攻撃が当たらない（付いたターンの終わりと次のターンの終わりで 2 つ減る）
put(states, STATE.dive, {
  name: "淵に潜る", iconIndex: 17, autoRemovalTiming: 2, minTurns: 2, maxTurns: 2, priority: 60,
  message1: "%1は淵の底に潜った！", message4: "%1が水面に浮かび上がった！",
  traits: [{ code: 22, dataId: 1, value: 1 }, { code: 22, dataId: 2, value: 1 }],
  note: "<hai_w4:沼主の第二形態。命中・魔法の回避 100%（必中の技は当たる）>",
}, emptyState);
put(states, STATE.swallowed, {
  name: "呑み込まれ", iconIndex: 9, autoRemovalTiming: 2, minTurns: 2, maxTurns: 2, priority: 70, restriction: 4, motion: 3,
  message1: "%1は沼主に呑み込まれた！", message2: "%1は沼主に呑み込まれた！", message4: "%1は沼主の腹から出てきた。",
  traits: [{ code: 22, dataId: 7, value: -0.06 }],
  note: "<hai_w4:沼主の呑み込み。2 ターン行動不能、毎ターン最大 HP の 6%。主に攻撃が当たると敵グループ 406 のバトルイベントが外す>",
}, emptyState);
writeTable("States.json", states);

// ---------------------------------------------------------------------------
// Skills 401–（敵の技。欄は w3_data.mjs と同じ）
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
const addState = (id, rate) => ({ code: 21, dataId: id, value1: rate, value2: 0 });
// stypeId：0 は沈黙で封じられない。1（魔法）は沈黙 146 で封じられる
const SKILLS = {
  401: { name: "吸い付き", message1: "%1は吸い付いた！", scope: 1, hitType: 1, animationId: 11, damage: dmg("a.atk * 3 - b.def * 2", -1), effects: [addState(ST.poison, 0.5)] },
  402: { name: "眠りの舌", message1: "%1は長い舌を伸ばした！", scope: 1, hitType: 1, animationId: 1, damage: dmg("a.atk * 2 - b.def", -1), effects: [addState(ST.sleep, 0.4)] },
  403: { name: "溺れの息", message1: "%1は冷たい息を吐いた！", scope: 2, hitType: 2, animationId: 45, effects: [addState(ST.sleep, 0.3)] },
  404: { name: "惑わしの羽", message1: "%1は白い羽を撒き散らした！", scope: 1, hitType: 2, animationId: 63, effects: [addState(ST.confuse, 0.5)] },
  405: { name: "噛み砕き", message1: "%1は顎を打ち合わせた！", scope: 1, hitType: 1, repeats: 2, animationId: 11, damage: dmg("a.atk * 3 - b.def * 2", -1) },
  // 沼主
  406: { name: "尾の一撃", message1: "%1は尾を叩きつけた！", scope: 1, hitType: 1, animationId: 2, damage: dmg("a.atk * 4 - b.def * 2", -1) },
  407: { name: "泥吐き", message1: "%1は泥を吐きかけた！", scope: 2, hitType: 1, animationId: 45, damage: dmg("20 + a.atk * 2 - b.def", EL.water), effects: [addState(ST.poison, 0.4)] },
  408: { name: "呑み込み", message1: "%1は大口を開けた！", scope: 1, hitType: 1, animationId: 11, damage: dmg("a.atk * 2 - b.def", -1), effects: [addState(STATE.swallowed, 1)] },
  409: { name: "淵に潜る", message1: "%1は身を沈めた！", scope: 11, hitType: 0, animationId: 45, effects: [addState(STATE.dive, 1)] },
  410: { name: "大波", message1: "%1は淵の水を巻き上げた！", scope: 2, hitType: 0, animationId: 45, damage: dmg("60 + a.atk * 3 - b.def * 2", EL.water) },
  // 古書院
  411: { name: "インクの飛沫", message1: "%1は黒い飛沫を飛ばした！", scope: 1, hitType: 1, animationId: 1, damage: dmg("a.atk * 2 - b.def", -1), effects: [addState(ST.poison, 0.5)] },
  412: { name: "口を縫う", message1: "%1は細い糸を伸ばした！", scope: 1, hitType: 2, animationId: 63, effects: [addState(ST.silence, 0.5)] },
  413: { name: "燃える頁", message1: "%1は燃える頁を飛ばした！", scope: 1, hitType: 2, animationId: 66, damage: dmg("30 + a.mat * 2 - b.mdf", EL.fire), stypeId: 1 },
  414: { name: "書架の一撃", message1: "%1は鉄の腕を振り下ろした！", scope: 1, hitType: 1, animationId: 2, damage: dmg("a.atk * 4 - b.def * 2", -1) },
  // 紙魚の王
  415: { name: "沈黙の頁", message1: "%1は白い頁を舞い散らせた！", scope: 2, hitType: 2, animationId: 63, effects: [addState(ST.silence, 0.6)] },
  416: { name: "読み上げ", message1: "%1は喰った頁を読み上げた！", message2: "炎の呪文だ！", scope: 2, hitType: 2, animationId: 68, damage: dmg("40 + a.mat * 2 - b.mdf", EL.fire) },
  417: { name: "読み上げ", message1: "%1は喰った頁を読み上げた！", message2: "氷の呪文だ！", scope: 2, hitType: 2, animationId: 72, damage: dmg("40 + a.mat * 2 - b.mdf", EL.ice) },
  418: { name: "読み上げ", message1: "%1は喰った頁を読み上げた！", message2: "雷の呪文だ！", scope: 2, hitType: 2, animationId: 77, damage: dmg("40 + a.mat * 2 - b.mdf", EL.thunder) },
  419: { name: "頁を喰う", message1: "%1は頁をかじり取った！", scope: 1, hitType: 2, animationId: 11, damage: dmg("30 + a.mat", 0, 6) },
};
for (const [id, s] of Object.entries(SKILLS)) put(skills, Number(id), { stypeId: 0, ...s, occasion: 1, note: "<hai_w4:敵の技>" }, emptySkill);
writeTable("Skills.json", skills);

// ---------------------------------------------------------------------------
// Enemies・Troops（world2.md 5・6・9 章。数値は仮。持ち主が調整する）
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
// 素材と消耗品：199 苦い根、200 灰の苔（P9）、204 眠り香（W1）、302 凍て石・303 雷鳴石（W3）
const DROP = { root: drop(1, 199, 4), moss: drop(1, 200, 4), sleep: drop(1, 204, 8), ice: drop(1, 302, 6), thunder: drop(1, 303, 6) };
const physical = T.attackElement(EL.physical);
const sleepOk = rate => [T.stateRate(ST.sleep, rate), T.stateRate(MZ_ST.sleep, rate)];
// [ID, 名前, 戦闘の絵, 色相, [HP, MP, 攻, 防, 魔, 魔防, 敏, 運], 経験値, 魔石, 特徴, 行動, ドロップ, メモ]
const SWAMP_LORD = "<hai_boss>\n<hai_boss_name:沼主>\n<hai_weak_hint:雷>\n<hai_boss_switch:157>\n<hai_drop:item,406,1>";
const SWAMP_TRAITS = [physical, T.physRate(0.75), T.element(EL.water, 0), T.element(EL.thunder, 2), ...sleepOk(1.5), noDeath];
const KING_TRAITS = [physical, T.physRate(0.75), T.stateResist(ST.silence), T.stateResist(MZ_ST.silence), T.stateResist(ST.sleep), T.stateResist(MZ_ST.sleep),
  T.element(EL.fire, 2), noDeath];
const ENEMIES = [
  // 湿地（world2.md 5 章）
  [401, "葦蛭", "Sandworm", 90, [280, 0, 30, 16, 10, 14, 20, 10], 16, 12, [physical], [attack, act(401)], [DROP.moss], ""],
  [402, "泥蛙", "Frilledlizard", 60, [340, 20, 28, 24, 18, 18, 8, 10], 16, 12, [physical, T.element(EL.thunder, 1.5)], [attack, act(402)], [DROP.root], ""],
  [403, "沈み人", "Zombie", 160, [820, 30, 38, 30, 12, 20, 10, 10], 36, 26, [physical, T.element(EL.fire, 1.5)], [attack, act(403, 4)], [DROP.sleep], ""],
  [404, "霧の鷺", "Crow", 180, [560, 40, 34, 22, 30, 26, 32, 10], 36, 26, [physical], [attack, act(404)], [DROP.moss], ""],
  [405, "大顎", "Ketos", 0, [1800, 0, 50, 34, 20, 24, 22, 10], 130, 90, [physical, T.element(EL.thunder, 2)], [act(1, 4), act(405)], [DROP.thunder], ""],
  // 沼主（world2.md 9 章）。HP 30% で 413「沼主」（淵に潜る・大波をくり返す）へ（HP の割合を引き継ぐ）
  [406, "沼主", "Kraken", 0, [4800, 60, 56, 40, 40, 34, 22, 20], 600, 600, SWAMP_TRAITS,
    [act(406), act(407), onTurn(408, 3, 3, 9)], [drop(3, 402, 1)], SWAMP_LORD.replace("<hai_drop", "<hai_transform:413,30>\n<hai_drop")],
  // 古書院（world2.md 6 章）
  [407, "紙魚", "Machinerybee", 30, [220, 0, 24, 12, 10, 12, 30, 10], 10, 8, [physical, T.element(EL.fire, 1.5)], [attack], [DROP.moss], ""],
  [408, "インク溜まり", "Plasma", 240, [380, 20, 26, 20, 20, 20, 8, 10], 16, 12, [physical], [attack, act(411)], [DROP.root], ""],
  [409, "写字の亡霊", "Wraith", 60, [600, 40, 30, 22, 34, 30, 20, 10], 36, 26, [physical, T.element(EL.fire, 1.5)], [attack, act(412)], [DROP.moss], ""],
  [410, "焚書の灰", "SF_Will_o_the_wisp", 0, [580, 40, 26, 18, 38, 26, 26, 10], 36, 26, [physical, T.element(EL.fire, 0), T.element(EL.ice, 2)], [act(1, 3), act(413)], [DROP.ice], ""],
  [411, "書架の番人", "Gatekeeper", 30, [1900, 0, 54, 44, 10, 30, 14, 10], 130, 90, [physical, T.physRate(0.5), T.element(EL.thunder, 2)], [act(1, 4), act(414)], [DROP.thunder], ""],
  // 紙魚の王（world2.md 9 章）。HP 50% で 1 回だけ紙魚を 2 体呼ぶ（敵グループ 412 のバトルイベント）
  [412, "紙魚の王", "Evilbook", 0, [5600, 200, 48, 38, 52, 40, 28, 20], 700, 700, KING_TRAITS,
    [act(415), act(416), act(417), act(418), onTurn(419, 2, 2, 9)], [drop(3, 403, 1)],
    "<hai_boss>\n<hai_boss_name:紙魚の王>\n<hai_weak_hint:炎>\n<hai_boss_switch:152>\n<hai_drop:item,405,1>"],
  // 沼主の第二形態：3 ターンごとに潜り、次のターンに大波。ほかのターンは第一形態と同じ
  [413, "沼主", "Kraken", 200, [4800, 60, 56, 40, 40, 34, 22, 20], 600, 600, SWAMP_TRAITS,
    [act(406), act(407), onTurn(409, 3, 3, 9), onTurn(410, 4, 3, 9)], [drop(3, 402, 1)], SWAMP_LORD],
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
  [401, "W4_緑：葦蛭", [401]],
  [402, "W4_緑：泥蛙", [402]],
  [403, "W4_黄：沈み人", [403]],
  [404, "W4_黄：霧の鷺", [404]],
  [405, "W4_赤：大顎", [405]],
  [406, "W4_ボス：沼主", [406]],
  [407, "W4_緑：紙魚×2", [407, 407]],
  [408, "W4_緑：インク溜まり", [408]],
  [409, "W4_黄：写字の亡霊", [409]],
  [410, "W4_黄：焚書の灰", [410]],
  [411, "W4_赤：書架の番人", [411]],
  [412, "W4_ボス：紙魚の王", [412]],
];
const troops = readData("Troops.json");
clearBand(troops, emptyTroop, [401, 412]);
for (const [id, name, members] of TROOPS) {
  const pos = row(members.length);
  put(troops, id, { name, members: members.map((enemyId, i) => ({ enemyId, ...pos[i], hidden: false })) }, emptyTroop);
}
const page = (conditions, span, list) => {
  const p = emptyPage();
  return { ...p, conditions: { ...p.conditions, ...conditions }, span, list: [...list, { code: 0, indent: 0, parameters: [] }] };
};
const msg = (indent, lines) => [{ code: 101, indent, parameters: ["", 0, 0, 2, ""] }, ...lines.map(text => ({ code: 401, indent, parameters: [text] }))];
// 沼主 ②「呑み込み」：主を叩くと吐き出す。ターンの頭に主の HP を覚え、ターンの終わりに減っていたら外す
const swallowStart = "$gameTroop._haiSwallowHp = $gameTroop.members()[0].hp;";
const swallowEnd = `const lord = $gameTroop.members()[0];
const held = $gameParty.members().filter(a => a.isStateAffected(${STATE.swallowed}));
if (lord.isAlive() && held.length && lord.hp < ($gameTroop._haiSwallowHp ?? lord.hp)) {
  held.forEach(a => a.removeState(${STATE.swallowed}));
  $gameMessage.add("叩かれた沼主は、呑んだ者を吐き出した！");
}`.split("\n");
troops[406].pages.push(page({ turnValid: true, turnA: 0, turnB: 1 }, 1, [{ code: 355, indent: 0, parameters: [swallowStart] }]));
troops[406].pages.push(page({ turnEnding: true }, 1, [
  { code: 355, indent: 0, parameters: [swallowEnd[0]] },
  ...swallowEnd.slice(1).map(line => ({ code: 655, indent: 0, parameters: [line] })),
]));
// 紙魚の王 ③：HP 50% で 1 回だけ紙魚を 2 体呼ぶ。王が倒れたら残った紙魚は散る（看守長の番犬と同じ）
troops[412].members = [
  { enemyId: 412, x: 640, y: 440, hidden: false },
  { enemyId: 407, x: 380, y: 500, hidden: true },
  { enemyId: 407, x: 900, y: 500, hidden: true },
];
troops[412].pages.push(page({ enemyValid: true, enemyIndex: 0, enemyHp: 50 }, 0, [
  { code: 111, indent: 0, parameters: [12, "$gameTroop.members()[0].isAlive()"] },
  ...msg(1, ["紙魚の王の体がほどけて、頁の間から紙魚が這い出した！"]),
  { code: 335, indent: 1, parameters: [1] },
  { code: 335, indent: 1, parameters: [2] },
  { code: 0, indent: 1, parameters: [] },
  { code: 412, indent: 0, parameters: [] },
]));
troops[412].pages.push(page({ enemyValid: true, enemyIndex: 0, enemyHp: 0 }, 1, [
  { code: 111, indent: 0, parameters: [12, "$gameTroop.aliveMembers().length > 0"] },
  ...msg(1, ["王を失った紙魚は、頁の山の奥へ散っていった。"]),
  { code: 355, indent: 1, parameters: ["$gameTroop.aliveMembers().forEach(e => e.escape());"] },
  { code: 0, indent: 1, parameters: [] },
  { code: 412, indent: 0, parameters: [] },
]));
writeTable("Troops.json", troops);

// ---------------------------------------------------------------------------
// System.json：筋の旗の名前（world2.md 16 章の W4 の行、world.md 8 章のオーブ「聖灰」と仲間ノクス・ルメの旗）と W4 の帯
// ---------------------------------------------------------------------------
const SWITCHES = {
  102: "オーブ:聖灰", 105: "オーブ:四つ揃った", 106: "真の姿",
  133: "遺骸:ノクス", 134: "遺骸:ルメ", 138: "加入:ノクス", 139: "加入:ルメ", 143: "完全体:ノクス", 144: "完全体:ルメ",
  152: "ボス:紙魚の王", 157: "ボス:沼主", 159: "湿地の水門", 164: "禁書庫の抜け道:開",
};
const VARIABLES = { 133: "記憶:ノクス", 134: "記憶:ルメ" };
const sysPath = dataPath("System.json");
const system = JSON.parse(fs.readFileSync(sysPath, "utf8"));
for (const [key, names] of [["switches", SWITCHES], ["variables", VARIABLES]]) {
  const arr = system[key];
  while (arr.length <= 200) arr.push("");
  for (const [id, name] of Object.entries(names)) arr[Number(id)] = name;
  for (let id = W4[0]; id <= W4[1] && id < arr.length; id++) arr[id] = ""; // W4 の帯（401–500）は今は使っていない
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
      console.error(`古い: ${rel}（node tools/maps/src/w4_data.mjs で書き直す）`);
      stale++;
    } else console.log(`一致: ${rel}`);
  } else if (current !== text) {
    fs.writeFileSync(file, text);
    console.log(`書き出し: ${rel}`);
  }
}
if (stale) process.exit(1);
if (!check) console.log("W4 のデータを書いた");
