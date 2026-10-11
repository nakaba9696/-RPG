// P7（#67）のデータベースの項目を書く。何度走らせても同じ結果になる（自分の帯 196–200 だけを書き直す）。
//   node tools/maps/src/p7_data.mjs           書く
//   node tools/maps/src/p7_data.mjs --check   書かずに、今の data/ と同じかだけ見る（違えば終了コード 1）
// 書くもの：Enemies 196–197（試しの番人の 2 形態）、Troops 196、System.json の switches 91 の名前。
// Skills・States 196–200 は使わない（Skills 196–200 には MZ の既定のスキル「かばう」などが入っているので触らない）。
// 雷の技は MZ の既定の 115 サンダーⅠ、固定ドロップは MZ の既定の 7 ポーション（確率 1/1）をテストで使う。
import fs from "node:fs";
import { readData, formatTable, dataPath, extendTable } from "../../data/io.mjs";

const BAND = [196, 200];
const SWITCH_DEFEATED = 91;
const check = process.argv.includes("--check");

/** 帯を空にしてから項目を置く（帯より前の隙間は空の項目で埋める。帯の後ろのほかの項目は残す）。 */
function fill(table, makeEmpty, entries) {
  extendTable(table, BAND[0] - 1, makeEmpty);
  for (let id = BAND[0]; id < table.length && id <= BAND[1]; id++) table[id] = makeEmpty(id);
  for (const [id, item] of Object.entries(entries)) {
    const n = Number(id);
    if (n < BAND[0] || n > BAND[1]) throw new Error(`${n} は P7 の帯の外`);
    extendTable(table, n, makeEmpty);
    table[n] = { ...makeEmpty(n), ...item, id: n };
  }
  while (table.length - 1 >= BAND[0] && table.length - 1 <= BAND[1] && table[table.length - 1].name === "") table.pop();
  return table;
}

// 欄は Enemies 196・Troops 196（MZ のエディタが作った空の項目）から写した
const NO_DROP = { dataId: 1, denominator: 1, kind: 0 };
const BASE_TRAITS = [{ code: 22, dataId: 0, value: 0.95 }, { code: 22, dataId: 1, value: 0.05 }, { code: 31, dataId: 1, value: 0 }];
const emptyEnemy = id => ({
  id, actions: [{ conditionParam1: 0, conditionParam2: 0, conditionType: 0, rating: 5, skillId: 1 }],
  battlerHue: 0, battlerName: "", dropItems: [NO_DROP, NO_DROP, NO_DROP], exp: 0,
  traits: BASE_TRAITS, gold: 0, name: "", note: "", params: [100, 0, 10, 10, 10, 10, 10, 10],
});
const emptyTroop = id => ({
  id, members: [], name: "",
  pages: [{
    conditions: {
      actorHp: 50, actorId: 1, actorValid: false, enemyHp: 50, enemyIndex: 0, enemyValid: false,
      switchId: 1, switchValid: false, turnA: 0, turnB: 0, turnEnding: false, turnValid: false,
    },
    list: [{ code: 0, indent: 0, parameters: [] }],
    span: 0,
  }],
});

const THUNDER = 4; // System.json の elements の 4 雷
const thunderWeak = { code: 11, dataId: THUNDER, value: 2 };

const tables = {
  "Enemies.json": fill(readData("Enemies.json"), emptyEnemy, {
    196: {
      name: "試しの番人", battlerName: "Demon", exp: 50, gold: 100,
      params: [3000, 0, 20, 10, 10, 10, 10, 10],
      traits: [...BASE_TRAITS, thunderWeak],
      dropItems: [{ dataId: 7, denominator: 1, kind: 1 }, NO_DROP, NO_DROP],
      note: [
        "<hai_boss>", "<hai_boss_name:試しの番人>", "<hai_actions:2>", "<hai_actions_low:3,50>",
        "<hai_transform:197,30>", "<hai_weak_hint:雷>", `<hai_boss_switch:${SWITCH_DEFEATED}>`,
        "<hai_boss_test:P7 のテスト用。2 形態・2 回行動（HP 50% 以下で 3 回）・雷 200%・ポーションを必ず落とす>",
      ].join("\n"),
    },
    197: {
      name: "崩れの番人", battlerName: "Demon_metamorphosis", exp: 50, gold: 100,
      params: [2000, 0, 24, 8, 10, 8, 12, 10],
      traits: [...BASE_TRAITS, thunderWeak],
      dropItems: [{ dataId: 7, denominator: 1, kind: 1 }, NO_DROP, NO_DROP],
      note: [
        "<hai_boss>", "<hai_actions:3>", "<hai_weak_hint:雷>", `<hai_boss_switch:${SWITCH_DEFEATED}>`,
        "<hai_boss_test:P7 のテスト用。試しの番人の第二形態（HP 30% で 196 から変わる）>",
      ].join("\n"),
    },
  }),
  "Troops.json": fill(readData("Troops.json"), emptyTroop, {
    196: { name: "P7_試しの番人", members: [{ enemyId: 196, x: 408, y: 420, hidden: false }] },
  }),
};

// System.json：自分の帯のスイッチの名前だけ
const system = readData("System.json");
while (system.switches.length <= SWITCH_DEFEATED) system.switches.push("");
system.switches[SWITCH_DEFEATED] = "P7_試しの番人を倒した";

let stale = 0;
const outputs = Object.entries(tables).map(([name, table]) => [name, formatTable(table)]);
outputs.push(["System.json", JSON.stringify(system)]);
for (const [name, text] of outputs) {
  const current = fs.readFileSync(dataPath(name), "utf8");
  if (check) {
    if (current !== text) {
      console.error(`古い: data/${name}（node tools/maps/src/p7_data.mjs で書き直す）`);
      stale++;
    } else console.log(`一致: data/${name}`);
  } else {
    fs.writeFileSync(dataPath(name), text);
    console.log(`${current === text ? "変化なし" : "書き出し"}: data/${name}`);
  }
}
if (stale) process.exit(1);
