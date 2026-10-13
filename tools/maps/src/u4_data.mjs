// U4（#96）のデータベースの項目を書く。何度走らせても同じ結果になる（自分の帯 941–945 のうち、使う 941–944 だけを書き直す）。
//   node tools/maps/src/u4_data.mjs           書く
//   node tools/maps/src/u4_data.mjs --check   書かずに、今の data/ と同じかだけ見る（違えば終了コード 1）
// 書くもの：Items 941–944、Weapons 941（来歴の試験場 Map914 で使う。製品から使わない）
// 来歴（<hai_lore>）の書き方は docs/plugins/Hai_Lore.md と docs/lore.md 1.2。
import fs from "node:fs";
import { readData, formatTable, dataPath, extendTable } from "../../data/io.mjs";

const BAND = [941, 944]; // 945 は空き。P13 が 945–1000 を空の項目（scope 0）で埋めたので触らない（P15 #250）
const check = process.argv.includes("--check");

/** 帯を空にしてから項目を置く（帯より前の隙間は空の項目で埋める。帯の後ろのほかの項目は残す）。 */
function fill(table, makeEmpty, entries) {
  extendTable(table, BAND[0] - 1, makeEmpty);
  for (let id = BAND[0]; id < table.length && id <= BAND[1]; id++) table[id] = makeEmpty(id);
  for (const [id, item] of Object.entries(entries)) {
    const n = Number(id);
    if (n < BAND[0] || n > BAND[1]) throw new Error(`${n} は U4 の帯の外`);
    extendTable(table, n, makeEmpty);
    table[n] = { ...makeEmpty(n), ...item, id: n };
  }
  while (table.length - 1 >= BAND[0] && table.length - 1 <= BAND[1] && table[table.length - 1].name === "") table.pop();
  return table;
}

// 欄は各ファイルの既存の項目（Items 7 ポーション、Weapons 1）から写した（tools/maps/src/p9_data.mjs と同じ）
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

/** 来歴のメモ欄（開きタグと閉じタグはそれぞれ 1 行、間の 1 行が画面の 1 行）。 */
const lore = (lines, ...tags) => [...tags, "<hai_lore>", ...lines, "</hai_lore>"].join("\n");

const tables = {
  "Items.json": fill(readData("Items.json"), emptyItem, {
    941: {
      name: "試しの小瓶", description: "ＨＰを５０回復する。\n試験場の棚に並んでいた小瓶。", iconIndex: 176, animationId: 41, price: 10,
      effects: [{ code: 11, dataId: 0, value1: 0, value2: 50 }],
      note: lore([
        "試験場の棚に、同じ小瓶が六つ並んでいた。",
        "栓の蝋に、番号が爪で刻んである。一から六まで。",
        "五つ目の瓶だけ、蝋が濃い茶色をしている。",
        "棚の裏の板に、走り書きが残っている。",
        "来歴の窓は四行で次へ送る、と書いてある。",
        "六行目まで読めたら、この試験は通りだ。",
      ]),
    },
    942: {
      name: "試しの丸薬", description: "ＨＰを１００回復する。\n一つしか持てない。", iconIndex: 177, animationId: 41, price: 20,
      effects: [{ code: 11, dataId: 0, value1: 0, value2: 100 }],
      note: lore([
        "紙に包んだ丸薬。一つしか持てない決まりで作られた。",
        "二つ目からは、試験場の倉庫へ送られる。",
        "倉庫に入った分も、遺物の記録には載る。",
      ], "<hai_max:1>"),
    },
    943: {
      name: "試験場の札", description: "来歴の試験場（Map914）の札。テスト用。\n使っても減らない。", iconIndex: 195,
      itypeId: 2, consumable: false, occasion: 3, scope: 0,
      note: lore([
        "試験場の入口に下がっていた木の札。",
        "裏に、ここを作った者の印が焼いてある。",
        "記録を開けば、いつでも読み返せる。",
      ]),
    },
    944: {
      name: "ただの石", description: "来歴の無い物。一覧に印が付かない。", iconIndex: 209, occasion: 3, scope: 0, price: 1,
    },
  }),
  "Weapons.json": fill(readData("Weapons.json"), emptyWeapon, {
    941: {
      name: "試しの短剣", description: "【短剣】攻撃＋５。\n刃の根元に刻みが三本。", animationId: 6, iconIndex: 96, wtypeId: 1, price: 50,
      params: [0, 0, 5, 0, 0, 0, 0, 0],
      note: lore([
        "刃の根元に、刻みが三本ある。",
        "研ぎ直すたびに一本ずつ刻んだらしい。",
        "柄の革は新しく、刃だけが古い。",
        "装備の画面からも、この来歴を読める。",
      ]),
    },
  }),
};

let stale = 0;
for (const [name, table] of Object.entries(tables)) {
  const text = formatTable(table);
  const current = fs.readFileSync(dataPath(name), "utf8");
  if (check) {
    if (current !== text) {
      console.error(`古い: data/${name}（node tools/maps/src/u4_data.mjs で書き直す）`);
      stale++;
    } else console.log(`一致: data/${name}`);
  } else {
    fs.writeFileSync(dataPath(name), text);
    console.log(`${current === text ? "変化なし" : "書き出し"}: data/${name}`);
  }
}
if (stale) process.exit(1);
