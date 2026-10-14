// P8（#82）・P11（#134）のデータを書く。何度走らせても同じ結果になる（自分の帯と試験場 Map913 だけを書き直す）。
//   node tools/maps/src/p8_data.mjs           書く
//   node tools/maps/src/p8_data.mjs --check   書かずに、今のファイルと同じかだけ見る（違えば終了コード 1）
// 書くもの：
//   Items 171–178（171 叡智のオーブ。P11 で仕組みからは外した。置き場所を消すのは W。172–178 は空）
//   System.json の switches 121–130 の名前（docs/world.md 4.4）
//   （Map010 の扉 4 つは W6（#144）が 010 を作り直したので、w6_data.mjs が書く。ここでは書かない）
//   試験場 Map913 の下書きの設定 tools/maps/src/p8_facilities.json（崩れた扉 4 つと、部屋を開く生き残り 4 人。地図は node tools/maps/build.mjs p8_facilities で作る）
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readData, formatTable, dataPath, extendTable } from "../../data/io.mjs";
import { SRC_DIR } from "../build.mjs";

const check = process.argv.includes("--check");
const outputs = []; // [{ file, text }]

// ---------------------------------------------------------------------------
// 部屋と扉（docs/world.md 4.2・4.3）。to は部屋の着く所（011–014 はどれも南の出口の上 (8,11)、上向き）。survivor は試験場で部屋を開く生き残り
// ---------------------------------------------------------------------------
const FACILITIES = [
  { key: "soul", name: "稽古場", test: [3, 2], sw: 121, to: [11, 8, 11, 8], survivor: "アデル" },
  { key: "kitchen", name: "食堂", test: [6, 2], sw: 122, to: [12, 8, 11, 8], survivor: "ヴォルフラム" },
  { key: "gate", name: "倉", test: [10, 2], sw: 123, to: [13, 8, 11, 8], survivor: "シャノ" },
  { key: "lore", name: "書庫", test: [13, 2], sw: 124, to: [14, 8, 11, 8], survivor: "イスメネ" },
];
const ORB = 171;

/** 崩れた扉のイベント（文字マップの設定の 1 件）。1 ページ目：崩れた扉（閉じていれば一行）。2 ページ目（部屋のスイッチ）：開いた扉、触れると部屋へ。 */
function doorSpec(f, name, [x, y]) {
  const door = direction => ({ characterName: "!Door1", characterIndex: 6, direction, pattern: 0 });
  return {
    name,
    type: "raw",
    x,
    y,
    pages: [
      {
        image: door(2),
        priorityType: 1,
        walkAnime: false,
        list: [
          { code: 357, indent: 0, parameters: ["Hai_Facilities", "door", "崩れた扉", { door: f.key }] },
          { code: 657, indent: 0, parameters: [`どの部屋の扉か = ${f.key}`] },
          { code: 0, indent: 0, parameters: [] },
        ],
      },
      {
        conditions: { switch1Id: f.sw, switch1Valid: true },
        image: door(8),
        priorityType: 1,
        trigger: 1,
        walkAnime: false,
        list: [
          { code: 250, indent: 0, parameters: [{ name: "Move1", volume: 90, pitch: 100, pan: 0 }] },
          { code: 201, indent: 0, parameters: [0, ...f.to, 0] },
          { code: 0, indent: 0, parameters: [] },
        ],
      },
    ],
  };
}

/** 試験場の生き残り（調べると砦に来た扱いで部屋を開く。生き残りの場面は W が書く）。 */
function survivorSpec(f, [x, y]) {
  return {
    name: `生き残り（${f.survivor}。${f.name}を開く）`,
    type: "raw",
    x,
    y: y + 2,
    pages: [
      {
        image: { characterName: "People1", characterIndex: FACILITIES.indexOf(f), direction: 2, pattern: 1 },
        priorityType: 1,
        list: [
          { code: 101, indent: 0, parameters: ["", 0, 0, 2, ""] },
          { code: 401, indent: 0, parameters: [`（試験）${f.survivor}が砦に来た。`] },
          { code: 357, indent: 0, parameters: ["Hai_Facilities", "open", "部屋を開く", { facility: f.key }] },
          { code: 657, indent: 0, parameters: [`部屋 = ${f.key}`] },
          { code: 0, indent: 0, parameters: [] },
        ],
      },
    ],
  };
}

const sourceText = cfg => JSON.stringify(cfg, null, 2) + "\n";
const srcPath = name => path.join(SRC_DIR, name + ".json");

// ---------------------------------------------------------------------------
// Items 171–178
// ---------------------------------------------------------------------------
const BAND = [171, 178];
// 欄は Items.json の既存の項目（7 ポーション）から写した
const emptyItem = id => ({
  id, animationId: 0, consumable: true,
  damage: { critical: false, elementId: 0, formula: "0", type: 0, variance: 20 },
  description: "", effects: [], hitType: 0, iconIndex: 0, itypeId: 1, name: "", note: "",
  occasion: 0, price: 0, repeats: 1, scope: 7, speed: 0, successRate: 100, tpGain: 0,
});
const items = readData("Items.json");
extendTable(items, BAND[1], emptyItem);
for (let id = BAND[0]; id <= BAND[1]; id++) items[id] = emptyItem(id);
items[ORB] = {
  ...emptyItem(ORB),
  name: "叡智のオーブ",
  // 今の世界ではどこにも置いていない（P11 で仕組みから外した）。前の世界の説明と来歴は W25（#293。R3 困る 1）が外し、
  // 今の世界の言葉の短い説明だけにした（来歴なし）
  description: "淡く光る、手のひらほどの珠。\n覗くと、向こう側が逆さに見える。",
  note: "",
  iconIndex: 165, itypeId: 2, consumable: false, occasion: 3, scope: 0,
};
outputs.push({ file: dataPath("Items.json"), text: formatTable(items) });

// ---------------------------------------------------------------------------
// System.json：スイッチ 121–130 の名前（docs/world.md 4.4）。変数 103（前の叡智のオーブの数）は W の「生き残りの数」に明け渡す
// ---------------------------------------------------------------------------
const SWITCHES = Object.fromEntries(FACILITIES.map(f => [f.sw, `部屋:${f.name}`]));
const sysFile = dataPath("System.json");
const system = JSON.parse(fs.readFileSync(sysFile, "utf8"));
while (system.switches.length <= 130) system.switches.push("");
while (system.variables.length <= 130) system.variables.push("");
for (let id = 121; id <= 124; id++) system.switches[id] = SWITCHES[id] ?? ""; // 125–127 は P13（p13_data.mjs）
if (system.variables[103] === "叡智のオーブの数") system.variables[103] = "";
outputs.push({ file: sysFile, text: JSON.stringify(system) });

// ---------------------------------------------------------------------------
// 試験場 Map913 の設定（台座 4 つ。地図は build.mjs が作る）
// ---------------------------------------------------------------------------
outputs.push({
  file: srcPath("p8_facilities"),
  text: sourceText({
    _説明: "P8・P11 の試験場（T の帯 900–949 のうち 913 を P8 が使う）。製品のマップからは行けない。上の壁に Map010 と同じ崩れた扉が 4 つ（左から稽古場・食堂・倉・書庫）、その 2 マス下に部屋を開く生き残りが 4 人。開いた扉に触れると本物の部屋（011–014）へ。この設定は node tools/maps/src/p8_data.mjs が書く。",
    mapId: 913,
    name: "T_施設",
    displayName: "施設の試験場",
    legend: "dungeon",
    tilesetId: 11,
    chars: { S: { name: "テストの開始地点", as: "." } },
    events: [...FACILITIES.map(f => doorSpec(f, `崩れた扉（${f.name}）`, f.test)), ...FACILITIES.map(f => survivorSpec(f, f.test))],
  }),
});

// ---------------------------------------------------------------------------
let stale = 0;
for (const { file, text } of outputs) {
  const rel = path.relative(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", ".."), file);
  const current = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
  if (check) {
    if (current !== text) {
      console.error(`古い: ${rel}（node tools/maps/src/p8_data.mjs で書き直す）`);
      stale++;
    } else console.log(`一致: ${rel}`);
  } else {
    fs.writeFileSync(file, text);
    console.log(`${current === text ? "変化なし" : "書き出し"}: ${rel}`);
  }
}
if (stale) process.exit(1);
