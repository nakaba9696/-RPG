// W1（#39）・W2（#83）のデータベースの項目を書く。何度走らせても同じ結果になる（自分の帯だけを書き直す）。
//   node tools/maps/src/w1_data.mjs           書く
//   node tools/maps/src/w1_data.mjs --check   書かずに、今のファイルと同じかだけ見る（違えば終了コード 1）
// 書くもの：
//   Items・Weapons・Armors・Enemies・Troops の 201–（W1 の帯 201–300）、Skills 236（Skills 201–235 は MZ の既定のスキルなので触らない）
//   System.json の switches・variables 101–200 の名前（docs/world.md 8 章の「第1段階」の ●）、startMapId・startX・startY・partyMembers
//     P8（#82）の switches 121–130・variables 103 の名前は p8_data.mjs が、W3 以降の旗（world2.md 16 章・仲間の旗）は w3_data.mjs などが書くので、ここでは消さずに残す
//   Actors.json の 1 番の名前と肩書き、5 番の名前
// 状態異常は P4（States 141–147）が入っていればそれを、無ければ MZ の既定（4 毒・6 沈黙・10 睡眠）を使う。
import fs from "node:fs";
import path from "node:path";
import { readData, formatTable, dataPath, extendTable } from "../../data/io.mjs";

const check = process.argv.includes("--check");
const outputs = []; // [{ file, text }]
const writeTable = (name, array) => outputs.push({ file: dataPath(name), text: formatTable(array) });

// ---------------------------------------------------------------------------
// 状態異常（P4 があればそちら）
// ---------------------------------------------------------------------------
const states = readData("States.json");
const hasP4 = states[141]?.name === "毒" && states[142]?.name === "眠り";
const ST = hasP4
  ? { poison: 141, sleep: 142, silence: 146, bind: 147 }
  : { poison: 4, sleep: 10, silence: 6, bind: 13 };

// ---------------------------------------------------------------------------
// 共通
// ---------------------------------------------------------------------------
const W1 = [201, 300];
// Items の 221– は W3〜W5 の鍵（docs/world2.md 14 章の仮の番号）なので、Items は 201–220 だけを書き直す
function clearBand(table, makeEmpty, [from, to] = W1) {
  extendTable(table, from - 1, makeEmpty);
  for (let id = from; id < table.length && id <= to; id++) table[id] = makeEmpty(id);
  // 帯の終わりより後ろに何も無いなら、空の項目を末尾から削る（ほかのレーンの項目は残す）
  while (table.length - 1 >= from && table.length - 1 <= to && table[table.length - 1].name === "") table.pop();
}
function put(table, id, item, makeEmpty) {
  if (id < W1[0] || id > W1[1]) throw new Error(`${id} は W1 の帯の外`);
  extendTable(table, id, makeEmpty);
  table[id] = { ...makeEmpty(id), ...item, id };
}

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
const items = readData("Items.json");
clearBand(items, emptyItem, [201, 220]);
put(items, 201, keyItem("坑道の鍵", "廃坑・上層の機械室の扉を開ける鍵。帝国の刻印がある。"), emptyItem);
put(items, 202, keyItem("監房の鍵", "地下牢の点呼の広場の、南の扉を開ける鍵。"), emptyItem);
put(items, 203, keyItem("看守長の鍵束", "看守長グラウの鍵束。地下牢のさらに奥の扉に合いそうだ。"), emptyItem);
put(items, 204, {
  name: "眠り香", description: "焚くと甘い煙が立つ。敵 1 体を眠らせる（沈黙中でも使える）。",
  iconIndex: 210, animationId: 62, hitType: 0, occasion: 1, scope: 1, price: 0,
  effects: [{ code: 21, dataId: ST.sleep, value1: 0.9, value2: 0 }],
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
put(weapons, 201, {
  name: "坑夫の鶴嘴", description: "捕虜が魔石を掘った鶴嘴。硬い殻にも食い込む。",
  animationId: 6, iconIndex: 99, wtypeId: 4, price: 0, params: [0, 0, 14, 0, 0, 0, 0, 0],
  traits: [{ code: 31, dataId: 1, value: 0 }, { code: 22, dataId: 0, value: 0 }],
}, emptyWeapon);
writeTable("Weapons.json", weapons);

const emptyArmor = id => ({
  id, atypeId: 1, description: "", etypeId: 4, traits: [{ code: 22, dataId: 1, value: 0 }],
  iconIndex: 0, name: "", note: "", params: [0, 0, 0, 0, 0, 0, 0, 0], price: 0,
});
const armors = readData("Armors.json");
clearBand(armors, emptyArmor);
put(armors, 201, {
  name: "巡礼者の外套", description: "灰をかぶった巡礼者の外套。魔法のダメージを 2 割減らす。",
  atypeId: 3, etypeId: 4, iconIndex: 135, params: [0, 0, 0, 4, 0, 6, 0, 0],
  traits: [{ code: 22, dataId: 1, value: 0 }, { code: 23, dataId: 7, value: 0.8 }],
}, emptyArmor);
put(armors, 202, {
  name: "灯火の指輪", description: "小さな火が消えずに灯っている指輪。暗闇と眠りを防ぐ。",
  atypeId: 1, etypeId: 5, iconIndex: 145, params: [0, 0, 0, 0, 2, 2, 0, 0],
  traits: [{ code: 14, dataId: ST.sleep, value: 0 }],
}, emptyArmor);
put(armors, 203, {
  name: "沈黙除けの首輪", description: "囚人の首輪を作り直したもの。沈黙を防ぐ。",
  atypeId: 1, etypeId: 5, iconIndex: 146, params: [0, 0, 0, 2, 0, 2, 0, 0],
  traits: [{ code: 14, dataId: ST.silence, value: 0 }],
}, emptyArmor);
writeTable("Armors.json", armors);

// ---------------------------------------------------------------------------
// Skills 236–（敵の技。欄は P4 の 164 眠りの棍棒から写した）。201–235 は MZ の既定のスキル（職業が覚える）なので触らない
// ---------------------------------------------------------------------------
const SK = { scales: 236, poison: hasP4 ? 163 : 1, sleepClub: hasP4 ? 164 : 1, whip: 169, chain: 170, order: 179, punish: 180 };
const skills = readData("Skills.json");
const emptySkill = id => ({
  id, animationId: 0, damage: { critical: false, elementId: 0, formula: "0", type: 0, variance: 20 },
  description: "", effects: [], hitType: 0, iconIndex: 0, message1: "", message2: "", mpCost: 0, name: "", note: "",
  occasion: 0, repeats: 1, requiredWtypeId1: 0, requiredWtypeId2: 0, scope: 1, speed: 0, stypeId: 0, successRate: 100,
  tpCost: 0, tpGain: 0, messageType: 1,
});
extendTable(skills, SK.scales, emptySkill);
skills[SK.scales] = {
  ...emptySkill(SK.scales), name: "眠りの鱗粉", description: "敵単体に鱗粉を浴びせ、眠らせる。",
  animationId: 59, iconIndex: 8, hitType: 0, occasion: 1, scope: 1, stypeId: 2, message1: "%1は%2をまき散らした！",
  effects: [{ code: 21, dataId: ST.sleep, value1: 0.4, value2: 0 }], note: "<hai_w1:迷い蛾の技>",
};
writeTable("Skills.json", skills);

// ---------------------------------------------------------------------------
// Enemies・Troops（docs/world.md 4.2〜4.4 の敵。数値は仮。持ち主・P4・P7 が調整する）
// ---------------------------------------------------------------------------
const emptyEnemy = id => ({
  id, actions: [{ conditionParam1: 0, conditionParam2: 0, conditionType: 0, rating: 5, skillId: 1 }],
  battlerHue: 0, battlerName: "",
  dropItems: [{ dataId: 1, denominator: 1, kind: 0 }, { dataId: 1, denominator: 1, kind: 0 }, { dataId: 1, denominator: 1, kind: 0 }],
  exp: 0, traits: [{ code: 22, dataId: 0, value: 0.95 }, { code: 22, dataId: 1, value: 0.05 }, { code: 31, dataId: 1, value: 0 }],
  gold: 0, name: "", note: "", params: [100, 0, 10, 10, 10, 10, 10, 10],
});
const T = {
  attackState: (stateId, rate) => ({ code: 32, dataId: stateId, value: rate }),
  element: (elementId, rate) => ({ code: 11, dataId: elementId, value: rate }),
  physRate: rate => ({ code: 23, dataId: 6, value: rate }),
  stateResist: stateId => ({ code: 14, dataId: stateId, value: 0 }),
  stateRate: (stateId, rate) => ({ code: 13, dataId: stateId, value: rate }),
  attackTimes: n => ({ code: 34, dataId: 0, value: n }),
};
const base = [{ code: 22, dataId: 0, value: 0.95 }, { code: 22, dataId: 1, value: 0.05 }, { code: 31, dataId: 1, value: 0 }];
const act = (skillId, rating = 5) => ({ conditionParam1: 0, conditionParam2: 0, conditionType: 0, rating, skillId });
const onTurn = (skillId, a, b, rating = 5) => ({ conditionParam1: a, conditionParam2: b, conditionType: 1, rating, skillId });
const hpBelow = (skillId, rate, rating) => ({ conditionParam1: 0, conditionParam2: rate, conditionType: 2, rating, skillId });
const attack = act(1);
const guard = act(2, 3);
const noDrop = [{ dataId: 1, denominator: 1, kind: 0 }, { dataId: 1, denominator: 1, kind: 0 }, { dataId: 1, denominator: 1, kind: 0 }];
// 看守長（docs/world.md 4.4、docs/plugins/Hai_Boss.md の「W1 の看守長を本物にする差分の案」）。行動は P4 の 161 と同じ型：
//   鉄鞭（5）か鎖縛り（5）、3+3X ターンに更生の号令（9）、HP 50% 以下で懲罰の鎖（7）
const wardenActions = [act(SK.whip), act(SK.chain), onTurn(SK.order, 3, 3, 9), hpBelow(SK.punish, 0.5, 7)];
const wardenTraits = [T.physRate(0.5), T.element(4, 0), T.element(2, 2), T.stateResist(ST.poison), T.stateRate(ST.sleep, 1.5), T.stateRate(1, 0)];
// 即死は効かない：「ステート有効度（戦闘不能）0%」。「ステート無効化（戦闘不能）」にすると HP 0 でも倒れなくなる（MZ の addState が無効化を見る）
// [ID, 名前, 戦闘の絵, [HP, MP, 攻, 防, 魔, 魔防, 敏, 運], 経験値, 魔石, 特徴, 行動]
const ENEMIES = [
  [201, "迷い蛾", "Machinerybee", [90, 0, 14, 8, 10, 10, 18, 10], 6, 4, [], [attack, act(SK.scales, 3)]],
  [202, "根喰い", "Treant", [140, 0, 16, 14, 8, 10, 6, 10], 8, 6, [T.element(2, 2)], [attack, act(SK.poison, 4)]],
  [203, "灰の巡礼者", "Zombie", [320, 0, 22, 14, 10, 12, 10, 10], 20, 15, [T.element(2, 1.5)], [attack, guard]],
  [205, "坑道鼠", "Frilledlizard", [110, 0, 18, 10, 8, 8, 20, 10], 8, 5, [], [attack]],
  [206, "石喰い", "Crab", [300, 0, 24, 30, 8, 14, 8, 10], 24, 18, [T.physRate(0.5), T.element(2, 2)], [attack, guard]],
  [207, "灯なし坑夫", "Berserker", [380, 0, 30, 18, 8, 12, 12, 10], 28, 20, [], [attack, act(SK.whip, 3)]],
  [208, "大百足", "Sandworm", [900, 0, 34, 24, 10, 16, 16, 10], 80, 60, [T.attackTimes(1), T.element(2, 2)], [attack, act(SK.poison, 5)]],
  [209, "骨の囚人", "Wraith", [160, 0, 20, 12, 10, 10, 12, 10], 10, 8, [T.element(2, 1.5), T.stateResist(ST.poison)], [attack]],
  // 獄卒は P4 の 141 と同じ定型：防御 → 眠りの棍棒 → 攻撃
  [210, "獄卒", "Captain", [420, 0, 30, 20, 10, 14, 14, 10], 30, 22, [], [onTurn(2, 1, 3), onTurn(SK.sleepClub, 2, 3), onTurn(1, 3, 3)]],
  [211, "番犬", "Wolfman", [700, 0, 36, 20, 8, 12, 30, 10], 70, 40, [T.attackTimes(1)], [attack]],
  [212, "看守長グラウ", "Gatekeeper", [2000, 60, 45, 30, 30, 25, 30, 30], 300, 300, wardenTraits, wardenActions],
  // 狂乱（HP 25% から）：防御が半分、2 回行動。見た目は赤みを帯びる（色相）
  [213, "看守長グラウ", "Gatekeeper", [2000, 60, 45, 15, 30, 25, 30, 30], 300, 300, wardenTraits, wardenActions],
];
const enemies = readData("Enemies.json");
clearBand(enemies, emptyEnemy);
for (const [id, name, battlerName, params, exp, gold, traits, actions] of ENEMIES) {
  put(enemies, id, { name, battlerName, params, exp, gold, traits: [...base, ...traits], actions, dropItems: noDrop }, emptyEnemy);
}
// 看守長は「看守長の鍵束」を必ず落とす（docs/world.md 4.4）。狂乱の形態で倒しても同じ
for (const id of [212, 213]) {
  enemies[id].dropItems = [{ dataId: 203, denominator: 1, kind: 1 }, { dataId: 1, denominator: 1, kind: 0 }, { dataId: 1, denominator: 1, kind: 0 }];
}
enemies[212].note = [
  "<hai_boss>", "<hai_boss_name:看守長グラウ>", "<hai_weak_hint:炎>", "<hai_boss_switch:151>", "<hai_actions_low:2,25>", "<hai_transform:213,25>",
].join("\n");
enemies[213].battlerHue = 330;
enemies[213].note = ["<hai_boss>", "<hai_boss_name:看守長グラウ>", "<hai_weak_hint:炎>", "<hai_boss_switch:151>", "<hai_actions:2>"].join("\n");
writeTable("Enemies.json", enemies);

const emptyTroop = id => ({
  id, members: [], name: "",
  pages: [{
    conditions: { actorHp: 50, actorId: 1, actorValid: false, enemyHp: 50, enemyIndex: 0, enemyValid: false, switchId: 1, switchValid: false, turnA: 0, turnB: 0, turnEnding: false, turnValid: false },
    list: [{ code: 0, indent: 0, parameters: [] }], span: 0,
  }],
});
// 画面 1280×720 の真ん中あたりに並べる
const row = n => Array.from({ length: n }, (_, i) => ({ x: Math.round(640 + (i - (n - 1) / 2) * 200), y: 460 }));
const TROOPS = [
  [201, "W1_緑：迷い蛾", [201, 201]],
  [202, "W1_緑：根喰い", [202]],
  [203, "W1_黄：灰の巡礼者", [203]],
  [204, "W1_赤：祈りの群れ", [203, 203, 203]],
  [205, "W1_緑：坑道鼠×2", [205, 205]],
  [206, "W1_黄：石喰い", [206]],
  [207, "W1_黄：灯なし坑夫", [207]],
  [208, "W1_赤：大百足", [208]],
  [209, "W1_緑：骨の囚人", [209]],
  [210, "W1_黄：獄卒", [210]],
  [211, "W1_赤：番犬", [211]],
  [212, "W1_ボス：看守長グラウ", [212]],
];
const troops = readData("Troops.json");
clearBand(troops, emptyTroop);
for (const [id, name, members] of TROOPS) {
  const pos = row(members.length);
  put(troops, id, { name, members: members.map((enemyId, i) => ({ enemyId, ...pos[i], hidden: false })) }, emptyTroop);
}
// 看守長の点呼（HP 50% で番犬 2 体を呼ぶ）と、看守長が倒れたら番犬が逃げる（docs/world.md 4.4 の ③ と倒し方の 4）。
// 番犬は「途中から出現」で左右に置き、バトルイベント（スパン「バトル」）で「敵キャラの出現」（335）。
const enemyHpPage = (hp, list) => {
  const page = emptyTroop(0).pages[0];
  return { ...page, conditions: { ...page.conditions, enemyHp: hp, enemyIndex: 0, enemyValid: true }, list: [...list, { code: 0, indent: 0, parameters: [] }], span: 1 };
};
const msg = (indent, name, lines) => [
  { code: 101, indent, parameters: ["", 0, 0, 2, name] },
  ...lines.map(text => ({ code: 401, indent, parameters: [text] })),
];
troops[212].members = [
  { enemyId: 212, x: 640, y: 460, hidden: false },
  { enemyId: 211, x: 360, y: 500, hidden: true },
  { enemyId: 211, x: 920, y: 500, hidden: true },
];
troops[212].pages = [
  emptyTroop(0).pages[0],
  // 看守長が一撃で 50% を越えて倒れたときは呼ばない
  enemyHpPage(50, [
    { code: 111, indent: 0, parameters: [12, "$gameTroop.members()[0].isAlive()"] },
    ...msg(1, "看守長グラウ", ["点呼。番犬、二頭。前へ。"]),
    { code: 335, indent: 1, parameters: [1] },
    { code: 335, indent: 1, parameters: [2] },
    { code: 0, indent: 1, parameters: [] },
    { code: 412, indent: 0, parameters: [] },
  ]),
  enemyHpPage(0, [
    { code: 111, indent: 0, parameters: [12, "$gameTroop.aliveMembers().length > 0"] },
    ...msg(1, "", ["主を失った番犬は、尾を巻いて逃げていった。"]),
    { code: 355, indent: 1, parameters: ["$gameTroop.aliveMembers().forEach(e => e.escape());"] },
    { code: 0, indent: 1, parameters: [] },
    { code: 412, indent: 0, parameters: [] },
  ]),
];
writeTable("Troops.json", troops);

// ---------------------------------------------------------------------------
// Actors：1 番の名前と肩書き（#13 の推し「ユエル」）、5 番の名前（オルド）
// ---------------------------------------------------------------------------
const actors = readData("Actors.json");
actors[1].name = "ユエル";
actors[1].nickname = "蘇生師";
actors[5].name = "オルド";
writeTable("Actors.json", actors);

// ---------------------------------------------------------------------------
// System.json：筋の旗の名前（docs/world.md 8 章の ●）と開始位置
// ---------------------------------------------------------------------------
const SWITCHES = {
  101: "オーブ:鎖", 111: "目覚めた", 112: "セレスと話した", 113: "召喚陣を教わった", 114: "拠点の鉄扉:開",
  131: "遺骸:オルド", 136: "加入:オルド", 151: "ボス:看守長", 153: "廃坑の昇降機",
};
const VARIABLES = { 101: "オーブの数", 102: "仲間の数", 104: "番号錠の入力", 105: "聖女像に祈った回数", 131: "記憶:オルド" };
// P8（#82）の名前は p8_data.mjs が書く（docs/plugins/Hai_Facilities.md）。W3（#94）以降の旗は w3_data.mjs などが書く。ここでは消さない
const LATER = { switches: [132, 135, 137, 140, 141, 142, 145, 156, 158, 161, 165], variables: [132, 135] };
const KEEP = {
  switches: id => (id >= 121 && id <= 130) || LATER.switches.includes(id),
  variables: id => id === 103 || LATER.variables.includes(id),
};
const sysPath = dataPath("System.json");
const system = JSON.parse(fs.readFileSync(sysPath, "utf8"));
for (const [key, names] of [["switches", SWITCHES], ["variables", VARIABLES]]) {
  const arr = system[key];
  while (arr.length <= 200) arr.push("");
  for (let id = 101; id <= 300 && id < arr.length; id++) if (!KEEP[key](id)) arr[id] = names[id] ?? "";
}
system.startMapId = 10;
system.startX = 5;
system.startY = 16;
system.partyMembers = [1];
outputs.push({ file: sysPath, text: JSON.stringify(system) });

// ---------------------------------------------------------------------------
const ROOT = path.resolve(dataPath("."), "..");
let stale = 0;
for (const { file, text } of outputs) {
  const rel = path.relative(ROOT, file);
  const current = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
  if (check) {
    if (current !== text) {
      console.error(`古い: ${rel}（node tools/maps/src/w1_data.mjs で書き直す）`);
      stale++;
    } else console.log(`一致: ${rel}`);
  } else if (current !== text) {
    fs.writeFileSync(file, text);
    console.log(`書き出し: ${rel}`);
  }
}
if (stale) process.exit(1);
if (!check) console.log(`W1 のデータを書いた（状態異常：${hasP4 ? "P4 の 141–147" : "MZ の既定"}）`);
