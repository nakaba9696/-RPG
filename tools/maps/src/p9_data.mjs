// P9（#60）のデータベースの項目を書く。何度走らせても同じ結果になる（自分の帯 196–200 だけを書き直す）。
//   node tools/maps/src/p9_data.mjs           書く
//   node tools/maps/src/p9_data.mjs --check   書かずに、今の data/ と同じかだけ見る（違えば終了コード 1）
// 書くもの：Items 196–200、Weapons 196–197、Armors 196（試験場 Map910 で使う。Enemies・Troops は使わない）
// 毒消しの状態異常は P4（States 141 毒）が入っていればそれを、無ければ MZ の既定（4 毒）を使う。
import fs from "node:fs";
import { readData, formatTable, dataPath, extendTable } from "../../data/io.mjs";

const BAND = [196, 200];
const check = process.argv.includes("--check");

const states = readData("States.json");
const POISON = states[141]?.name === "毒" ? 141 : 4;

/** 帯を空にしてから項目を置く（帯より前の隙間は空の項目で埋める。帯の後ろのほかの項目は残す）。 */
function fill(table, makeEmpty, entries) {
  extendTable(table, BAND[0] - 1, makeEmpty);
  for (let id = BAND[0]; id < table.length && id <= BAND[1]; id++) table[id] = makeEmpty(id);
  for (const [id, item] of Object.entries(entries)) {
    const n = Number(id);
    if (n < BAND[0] || n > BAND[1]) throw new Error(`${n} は P9 の帯の外`);
    extendTable(table, n, makeEmpty);
    table[n] = { ...makeEmpty(n), ...item, id: n };
  }
  // 帯の終わりより後ろに何も無いなら、帯の中の末尾の空の項目を削る
  while (table.length - 1 >= BAND[0] && table.length - 1 <= BAND[1] && table[table.length - 1].name === "") table.pop();
  return table;
}

// 欄は各ファイルの既存の項目（Items 7 ポーション、Weapons 1、Armors 1）から写した
const emptyItem = id => ({
  id, animationId: 0, consumable: true,
  damage: { critical: false, elementId: 0, formula: "0", type: 0, variance: 20 },
  description: "", effects: [], hitType: 0, iconIndex: 0, itypeId: 1, name: "", note: "",
  occasion: 0, price: 0, repeats: 1, scope: 7, speed: 0, successRate: 100, tpGain: 0,
});
const emptyWeapon = id => ({
  id, animationId: 0, description: "", etypeId: 1, traits: [{ code: 31, dataId: 1, value: 0 }, { code: 22, dataId: 0, value: 0 }],
  iconIndex: 0, name: "", note: "", params: [0, 0, 0, 0, 0, 0, 0, 0], price: 0, wtypeId: 0,
});
const emptyArmor = id => ({
  id, atypeId: 1, description: "", etypeId: 4, traits: [{ code: 22, dataId: 1, value: 0 }],
  iconIndex: 0, name: "", note: "", params: [0, 0, 0, 0, 0, 0, 0, 0], price: 0,
});

const material = (name, description, iconIndex) => ({
  name, description, iconIndex, occasion: 3, scope: 0, price: 5, note: "<hai_max:20>",
});

const tables = {
  "Items.json": fill(readData("Items.json"), emptyItem, {
    196: {
      name: "薬草", description: "ＨＰを２００回復する。苦いが効く。", iconIndex: 176, animationId: 41, price: 20,
      effects: [{ code: 11, dataId: 0, value1: 0, value2: 200 }],
    },
    197: {
      name: "毒消し", description: "毒を消す。苦い根を煎じたもの。", iconIndex: 177, animationId: 45, price: 30,
      effects: [{ code: 22, dataId: POISON, value1: 1, value2: 0 }],
      note: "<hai_craft:i199x2,i200>\n<hai_craft_known>",
    },
    198: {
      name: "秘薬", description: "ＨＰを全快する。強い薬なので２つまでしか持てない。", iconIndex: 179, animationId: 46, price: 300,
      effects: [{ code: 11, dataId: 0, value1: 1, value2: 0 }],
      note: "<hai_max:2>\n<hai_craft:i196x2,i200>",
    },
    199: material("苦い根", "合成の材料。毒消しの元になる。", 189),
    200: material("灰の苔", "合成の材料。灰の積もった石に生える。", 190),
  }),
  "Weapons.json": fill(readData("Weapons.json"), emptyWeapon, {
    196: {
      name: "灰鋼の剣", description: "【剣】灰を練り込んだ鋼の剣。世に一振り（一点もの）。",
      animationId: 6, iconIndex: 98, wtypeId: 2, price: 500, params: [0, 0, 20, 0, 0, 0, 0, 0], note: "<hai_unique>",
    },
    197: {
      name: "鉄の剣", description: "【剣】ありふれた鉄の剣。", animationId: 6, iconIndex: 97, wtypeId: 2, price: 200,
      params: [0, 0, 10, 0, 0, 0, 0, 0],
    },
  }),
  "Armors.json": fill(readData("Armors.json"), emptyArmor, {
    196: {
      name: "見張りの外套", description: "見張り番が代々着てきた外套（一点もの）。", atypeId: 1, etypeId: 4, iconIndex: 135,
      price: 400, params: [0, 0, 0, 6, 0, 4, 0, 0], note: "<hai_unique>",
    },
  }),
};

let stale = 0;
for (const [name, table] of Object.entries(tables)) {
  const text = formatTable(table);
  const current = fs.readFileSync(dataPath(name), "utf8");
  if (check) {
    if (current !== text) {
      console.error(`古い: data/${name}（node tools/maps/src/p9_data.mjs で書き直す）`);
      stale++;
    } else console.log(`一致: data/${name}`);
  } else {
    fs.writeFileSync(dataPath(name), text);
    console.log(`${current === text ? "変化なし" : "書き出し"}: data/${name}`);
  }
}
if (stale) process.exit(1);
