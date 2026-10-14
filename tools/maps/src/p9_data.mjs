// P9（#60）のデータベースの項目を書く（説明と来歴は W2b #112 が docs/lore.md 3 章から写した）。何度走らせても同じ結果になる（自分の帯 196–200 だけを書き直す）。
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

// 説明（2 行目は来歴の一行）と来歴（メモ欄の <hai_lore>）。docs/lore.md 3 章から写した（W2b #112）。
// 薬草・毒消し・秘薬・苦い根は W25（#293）が今の世界の言葉に直した（docs/world.md 8.3。R3 困る 1）
const LORE = {
  "薬草": { desc: ["HP を 200 戻す。苦いが効く。", "集落の畑の端で、畝を一本だけ立てて育てる草。"], lore: ["集落の畑の端に、畝を一本だけ立てて育てる草。", "傷と熱には効く。灰を吸った咳には効かない。", "干した束の根元に、摘んだ家の結び目。家ごとに形が違う。", "結び目の無い束は、拾い屋が森で摘んだもの。"] },
  "毒消し": { desc: ["毒を消す。苦い根を煎じて、塩で固めたもの。", "坑道の掘り手が、首に下げて潜った。"], lore: ["苦い根を煎じて、塩で固めた薬。", "坑道の溜まり水には、刺す虫が湧く。掘り手は首に下げて潜った。", "袋には、掘り手の名の焼き印。", "空の袋が七つ、坑道の棚の釘に下がっていた。"] },
  "秘薬": { desc: ["HP を全部戻す。強い薬なので 2 つまでしか持てない。", "砦の療養所の薬師の処方を、見習いが写したもの。"], lore: ["砦の療養所の薬師の処方。眠らずに働くための薬。", "見習いが写しを持っていた。夜番の前に、薬師が飲んだ。", "写しの端に、見習いの字の書き足し。「二つまで」。", "その次の行は、墨で塗りつぶしてある。"] },
  "苦い根": { desc: ["合成の材料。毒消しの元になる。", "坑道の湿った岩に根を張る。掘り手が噛んで腹をごまかした。"], lore: ["坑道の湿った岩の割れ目に、白い根を伸ばす草。", "苦くて食えたものではないが、噛んでいると腹が鳴らない。", "掘り手の寝床の藁の下から、噛み跡のある根が束で出てきた。"] },
  "灰の苔": { desc: ["合成の材料。灰の積もった石に生える。", "暖炉の灰には生えない。降ってきた灰にだけ生える。"], lore: ["灰の積もった石に生える、白い苔。", "暖炉の灰を鉢に入れて植えても、三日で枯れる。", "空から降ってきた灰にだけ、根を張る。", "礼拝堂の納骨所では、骨の棚の上が一番よく育つ。"] },
  "灰鋼の剣": { desc: ["【剣】灰を練り込んだ鋼の剣。世に一振り（一点もの）。", "刃が欠けない。鍛冶は二振り目を打たなかった。"], lore: ["降ってきた灰を、溶けた鋼に練り込んで打った剣。", "刃は白く曇り、石に打ちつけても欠けない。", "打った鍛冶は、その晩のうちに炉の火を落とした。", "弟子が二振り目をせがむと、鍛冶は「灰を素手で触るな」とだけ言った。"] },
  "鉄の剣": { desc: ["【剣】ありふれた鉄の剣。", "王国の兵に配られた数打ち。柄の革が握りの形に固まる。"], lore: ["王国の兵に配られた、銘の無い数打ちの剣。", "柄の革が、持ち主の握りの形のまま固まっている。", "崖道の帝国の陣の外で、こうした剣が何本も見つかる。", "どれも刃こぼれが少ない。振るわれた跡より、握られた跡が深い。"] },
  "見張りの外套": { desc: ["見張り番が代々着てきた外套（一点もの）。", "盗賊団「夜鴉」の見張りの外套。代々といっても三代。"], lore: ["夜鴉団の見張り番が、代々受け継いできた黒い外套。", "代々といっても三代。三代とも、頭より先に逃げて生き延びた。", "四代目は礼拝堂の入口で、頭が地下から戻るのを待っていた。", "襟の裏に、四代目の字の縫い取りがある。「三日待った」"] },
};
const descOf = name => LORE[name].desc.join("\n");
const noteOf = (name, ...tags) => [...tags, "<hai_lore>", ...LORE[name].lore, "</hai_lore>"].join("\n");

const material = (name, iconIndex) => ({
  name, description: descOf(name), iconIndex, occasion: 3, scope: 0, price: 5, note: noteOf(name, "<hai_max:20>"),
});

const tables = {
  "Items.json": fill(readData("Items.json"), emptyItem, {
    196: {
      name: "薬草", description: descOf("薬草"), note: noteOf("薬草"), iconIndex: 176, animationId: 41, price: 20,
      effects: [{ code: 11, dataId: 0, value1: 0, value2: 200 }],
    },
    197: {
      name: "毒消し", description: descOf("毒消し"), iconIndex: 177, animationId: 45, price: 30,
      effects: [{ code: 22, dataId: POISON, value1: 1, value2: 0 }],
      note: noteOf("毒消し", "<hai_craft:i199x2,i200>", "<hai_craft_known>"),
    },
    198: {
      name: "秘薬", description: descOf("秘薬"), iconIndex: 179, animationId: 46, price: 300,
      effects: [{ code: 11, dataId: 0, value1: 1, value2: 0 }],
      note: noteOf("秘薬", "<hai_max:2>", "<hai_craft:i196x2,i200>"),
    },
    199: material("苦い根", 189),
    200: material("灰の苔", 190),
  }),
  "Weapons.json": fill(readData("Weapons.json"), emptyWeapon, {
    196: {
      name: "灰鋼の剣", description: descOf("灰鋼の剣"),
      animationId: 6, iconIndex: 98, wtypeId: 2, price: 500, params: [0, 0, 20, 0, 0, 0, 0, 0], note: noteOf("灰鋼の剣", "<hai_unique>"),
    },
    197: {
      name: "鉄の剣", description: descOf("鉄の剣"), note: noteOf("鉄の剣"), animationId: 6, iconIndex: 97, wtypeId: 2, price: 200,
      params: [0, 0, 10, 0, 0, 0, 0, 0],
    },
  }),
  "Armors.json": fill(readData("Armors.json"), emptyArmor, {
    196: {
      name: "見張りの外套", description: descOf("見張りの外套"), atypeId: 1, etypeId: 4, iconIndex: 135,
      price: 400, params: [0, 0, 0, 6, 0, 4, 0, 0], note: noteOf("見張りの外套", "<hai_unique>"),
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
