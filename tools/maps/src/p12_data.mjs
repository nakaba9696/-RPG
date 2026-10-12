// P12（#143）のデータベースの項目を書く。何度走らせても同じ結果になる（自分の ID だけを書き直す）。
//   node tools/maps/src/p12_data.mjs           書く
//   node tools/maps/src/p12_data.mjs --check   書かずに、今の data/ と同じかだけ見る（違えば終了コード 1）
// 書くもの（P の帯 101–200 の空き）：
//   Skills 183「思いの刃」（主人公の技。<hai_engulf>）、184「呼びかける」（仲間のコマンド「呼びかける」で使う）
//   States 194「呑まれ」（行動制約：敵を攻撃する、3 ターン）
//   Enemies・Troops 183（耐える戦いの試し。<hai_endure:3>。テスト用）
//   System.json：switches 162、variables 161–167 の名前（P12 の帯 161–170。161・164・165 のスイッチは前の世界のマップが使っているので避けた）
import fs from "node:fs";
import { readData, formatTable, dataPath } from "../../data/io.mjs";

const check = process.argv.includes("--check");
const BAND = [101, 200];

/** id の項目を、空の項目（同じ表の既存の空き）の欄の上に置く。空でない他人の項目は上書きしない。 */
function put(table, id, item) {
  if (id < BAND[0] || id > BAND[1]) throw new Error(`${id} は P の帯の外`);
  const cur = table[id];
  if (!cur) throw new Error(`${id} 番の項目が無い（表を伸ばしてから使う）`);
  if (cur.name && cur.name !== item.name) throw new Error(`${id} 番はもう「${cur.name}」が使っている`);
  table[id] = { ...cur, ...item, id };
}

const skills = readData("Skills.json");
put(skills, 183, {
  animationId: 103,
  damage: { critical: false, elementId: 0, formula: "a.atk * 4 + a.mat * 2 - b.def", type: 1, variance: 10 },
  description: "取り込んだ思いを刃にして、敵全体を斬る。\n使うたびに呑まれが溜まる。",
  effects: [],
  hitType: 1,
  iconIndex: 64,
  message1: "%1は思いを刃にした！",
  message2: "",
  mpCost: 0,
  name: "思いの刃",
  note: "<hai_engulf:40>",
  occasion: 1,
  repeats: 1,
  scope: 2,
  speed: 0,
  stypeId: 1,
  successRate: 100,
  tpCost: 0,
  tpGain: 0,
});
put(skills, 184, {
  animationId: 0,
  damage: { critical: false, elementId: 0, formula: "0", type: 0, variance: 20 },
  description: "呑まれた味方を呼ぶ。呑まれが減り、我に返る。",
  effects: [],
  hitType: 0,
  iconIndex: 84,
  message1: "",
  message2: "",
  mpCost: 0,
  name: "呼びかける",
  note: "コマンド「呼びかける」で使う（Hai_Apostle）。戦闘ログには仲間の呼び方が出る。",
  occasion: 1,
  repeats: 1,
  scope: 7,
  speed: 0,
  stypeId: 0,
  successRate: 100,
  tpCost: 0,
  tpGain: 0,
});

const states = readData("States.json");
put(states, 194, {
  autoRemovalTiming: 2,
  chanceByDamage: 100,
  iconIndex: 5,
  maxTurns: 3,
  message1: "%1は呑まれた。",
  message2: "",
  message3: "",
  message4: "%1は顔を上げた。",
  minTurns: 3,
  motion: 0,
  name: "呑まれ",
  note: "Hai_Apostle の呑まれが最大になると付く。呼びかけで外れる。",
  overlay: 0,
  priority: 90,
  releaseByDamage: false,
  removeAtBattleEnd: true,
  removeByDamage: false,
  removeByRestriction: false,
  removeByWalking: false,
  restriction: 1,
  stepsToRemove: 100,
  traits: [],
});

const enemies = readData("Enemies.json");
put(enemies, 183, {
  name: "P12_耐える戦いの試し",
  battlerName: "Wraith",
  exp: 0,
  gold: 0,
  params: [99999, 0, 12, 10, 10, 10, 10, 10],
  note: ["<hai_boss>", "<hai_boss_name:耐える戦いの試し>", "<hai_endure:5>", "<hai_boss_test:P12 のテスト用。5 ターン耐えれば勝ち>"].join("\n"),
});

const troops = readData("Troops.json");
put(troops, 183, { name: "P12_耐える戦いの試し", members: [{ enemyId: 183, x: 408, y: 420, hidden: false }] });

// System.json：自分の帯（161–170）の名前だけ
const system = readData("System.json");
const NAMES = {
  switches: { 162: "使徒の力:覚えた" },
  variables: {
    161: "頼みごと:弟を連れて帰る",
    162: "頼みごと:頂の道具",
    163: "頼みごと:本物の写し",
    164: "頼みごと:名を返す",
    165: "頼みごと:営倉の鐘を売る",
    166: "頼みごと:外に残された者",
    167: "呑まれ（主人公）",
  },
};
for (const [key, names] of Object.entries(NAMES)) {
  for (const [id, name] of Object.entries(names)) {
    const cur = system[key][id];
    if (cur && cur !== name) throw new Error(`System.json ${key}[${id}] はもう「${cur}」が使っている`);
    system[key][id] = name;
  }
}

let stale = 0;
const outputs = [
  ["Skills.json", formatTable(skills)],
  ["States.json", formatTable(states)],
  ["Enemies.json", formatTable(enemies)],
  ["Troops.json", formatTable(troops)],
  ["System.json", JSON.stringify(system)],
];
for (const [name, text] of outputs) {
  const current = fs.readFileSync(dataPath(name), "utf8");
  if (check) {
    if (current !== text) {
      console.error(`古い: data/${name}（node tools/maps/src/p12_data.mjs で書き直す）`);
      stale++;
    } else console.log(`一致: data/${name}`);
  } else {
    fs.writeFileSync(dataPath(name), text);
    console.log(`${current === text ? "変化なし" : "書き出し"}: data/${name}`);
  }
}
if (stale) process.exit(1);
