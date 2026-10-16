// P13（#189）：砦の新しい 3 部屋（016 療養所・017 鍛冶場・018 見張り台）の設定と、P13 の帯のデータを書く。何度走らせても同じ結果になる。
//   node tools/maps/src/p13_data.mjs           書く（このあと node tools/maps/build.mjs p13_016_infirmary p13_017_smithy p13_018_watch で地図を作る）
//   node tools/maps/src/p13_data.mjs --check   書かずに、今のファイルと同じかだけ見る（違えば終了コード 1）
// 書くもの（docs/ROADMAP.md の割り当て表の P13：スイッチ 125–127・変数 176・データベース 1001–1050・マップ 016–018）：
//   tools/maps/src/p13_01*.json     部屋の文字マップの設定（イベント・凡例の上書き・スタンプ・散らし）。地図（.txt・.deco.txt）は手で書く
//   data/Items.json                 1001 鉄切り鋏（鍛冶場で打つ。持つとスイッチ 313。Hai_Facilities の shearsItem）。1002–1050 は空
//   data/System.json                スイッチ 125–127「部屋:療養所」ほか、変数 176「頼みごと:足場の木」
// 010 の扉 3 つ（療養所 (44,8)・鍛冶場 (42,36)・見張り台 (17,8)）と 019 の見張り台の扉 (16,6) は w6_data.mjs の roomDoor が書く。
// 部屋が開く場面（023 ピピネル・061 アンネリーゼ・052 グィド）の open は w8_maps.mjs・w10_data.mjs に足した。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readData, formatTable, dataPath, extendTable } from "../../data/io.mjs";
import { SRC_DIR } from "../build.mjs";
import { patchLater } from "./w14_parts.mjs"; // W14（#234）：朝の砦の後日談の一行

const check = process.argv.includes("--check");
const outputs = []; // [{ file, text }]
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

const cmd = (code, parameters, indent = 0) => ({ code, indent, parameters });
const END = cmd(0, []);
const plugin = (name, command, label, args = {}, indent = 0, show = {}) => [
  cmd(357, [name, command, label, args], indent),
  ...Object.entries(args).map(([k, v]) => cmd(657, [`${show[k] ?? k} = ${v}`], indent)),
];
const srcPath = name => path.join(SRC_DIR, name + ".json");
const sourceText = cfg => JSON.stringify(cfg, null, 2) + "\n";

// ---------------------------------------------------------------------------
// 帯と旗
// ---------------------------------------------------------------------------
const BAND = [1001, 1050];
const SHEARS = 1001;
const SWITCHES = { 125: "部屋:療養所", 126: "部屋:鍛冶場", 127: "部屋:見張り台" };
const VARIABLES = { 176: "頼みごと:足場の木" };

// 部屋（17×13。南の出口 (8,12) → 010 の扉の前。着く所は (8,11)。w6_data.mjs の P.doors と同じ座標）
const KEEP = 10;
const ROOMS = {
  infirmary: { mapId: 16, name: "療養所", door: [44, 8] },
  smithy: { mapId: 17, name: "鍛冶場", door: [42, 36] },
  watch: { mapId: 18, name: "見張り台", door: [17, 8] },
};
const exitTo = key => {
  const [x, y] = ROOMS[key].door;
  return { name: "出口（黒鉄の砦へ）", type: "transfer", x: 8, y: 12, to: [KEEP, x, y + 1, "down"] };
};
const useRoom = (key, name, [x, y]) => ({
  name,
  type: "raw",
  x,
  y,
  pages: [{ priorityType: 1, list: [...plugin("Hai_Facilities", "use", "部屋を使う", { facility: key }, 0, { facility: "部屋" }), END] }],
});
const text = (name, [x, y], lines) => ({ name, type: "text", x, y, lines });

// 砦の中の部屋（タイルセット 11・凡例 dungeon。011–014 と同じ壁・床・色調）。docs/look.md の「011–014・016・017 部屋」
const FORT_WALL = { name: "砦の壁（壁O（砦）。下が床なら側面、ほかは上面）", wall: { top: "A4:22", side: "A4:30", height: 2 } };
const FORT_FLOOR = { name: "石畳（石畳A）", tiles: ["A5:20"] };
const indoor = (key, extra) => ({
  mapId: ROOMS[key].mapId,
  name: ROOMS[key].name,
  parentId: KEEP,
  displayName: ROOMS[key].name,
  legend: "dungeon",
  tilesetId: 11,
  bgm: { name: "Castle2", volume: 60, pitch: 100, pan: 0 },
  note: "<hai_tone:-17,-26,-43,34>",
  fields: { specifyBattleback: true, battleback1Name: "Stone2", battleback2Name: "Room1" },
  chars: { "#": FORT_WALL, ".": FORT_FLOOR },
  ...extra,
});
const scatter = seed => [
  { on: ".", z: 1, tiles: ["A2:15"], rate: 0.04, seed },
  { on: ".", tiles: ["B:32", "B:33"], rate: 0.05, seed: seed + 1 },
];

const CONFIGS = {
  p13_016_infirmary: indoor("infirmary", {
    _説明: "P13（#189）：療養所（docs/world.md 4.3。ピピネルが来ると開く）。奥の寝台を調べると全員の状態異常が治る（Hai_Facilities の use infirmary）。開いている間、消耗品の所持上限が 1 つ増える。出口は南 (8,12) → 010 の療養所の扉の前 (44,9)。この設定は p13_data.mjs が書く。",
    deco: {
      Z: { name: "貼り紙（寝台の札）", z2: "D:216" },
      4: { name: "水桶", z2: "E:150" },
      h: { name: "端材", z2: "D:220" },
      N: { name: "樽", z2: "D:212" },
    },
    stamps: [
      { at: "B", name: "粗末な寝台（1×2）", tiles: [["D:171"], ["D:179"]] },
      { at: "S", name: "薬棚（雑貨棚）", tiles: [["D:153"], ["D:161"]] },
      { at: "T", name: "薬棚（雑貨棚）", tiles: [["D:154"], ["D:162"]] },
      { at: "U", name: "薬棚（雑貨棚）", tiles: [["D:155"], ["D:163"]] },
    ],
    scatter: scatter(1610),
    events: [
      exitTo("infirmary"),
      useRoom("infirmary", "療養所の寝台", [8, 4]),
      text("寝台の札", [4, 2], ["壁に木の札。", "「熱のある者は窓の側。咳の者は戸の側。」", "札の下に、寝台の数だけ釘が打ってある。釘は九本。"]),
    ],
  }),
  p13_017_smithy: indoor("smithy", {
    _説明: "P13（#189）：鍛冶場（docs/world.md 4.3・mapdesign.md 4 章。アンネリーゼが来ると開く）。金床を調べると、一点ものの装備を魂で鍛え直す・鉄切り鋏を打つ（Hai_Facilities の use smithy。鋏はスイッチ 313）。出口は南 (8,12) → 010 の鍛冶場の扉の前 (42,37)。この設定は p13_data.mjs が書く。",
    deco: {
      Z: { name: "貼り紙（打ち印の板）", z2: "D:216" },
      "&": { name: "金床", z2: "E:148" },
      4: { name: "水桶", z2: "E:150" },
      i: { name: "鉄くず", z2: "E:151" },
      n: { name: "壊れた樽", z2: "D:237" },
      N: { name: "樽", z2: "D:212" },
      M: { name: "麻袋", z2: "D:249" },
      h: { name: "端材", z2: "D:220" },
    },
    stamps: [
      { at: "F", name: "炉（大きな暖炉 3×2）", tiles: [["D:189", "D:190", "D:191"], ["D:197", "D:198", "D:199"]] },
      { at: "?", name: "剣立て（1×2）", tiles: [["E:174"], ["E:182"]] },
    ],
    scatter: scatter(1710),
    events: [
      exitTo("smithy"),
      useRoom("smithy", "金床", [8, 6]),
      text("打ち印の板", [12, 2], ["壁に板が打ちつけてある。鍛冶の打ち印が二十ほど焼き付けてある。", "下の段の三つは、焼きが浅い。"]),
    ],
  }),
  p13_018_watch: {
    mapId: ROOMS.watch.mapId,
    name: ROOMS.watch.name,
    parentId: KEEP,
    displayName: ROOMS.watch.name,
    legend: "rampart",
    tilesetId: 21,
    bgm: { name: "Castle2", volume: 55, pitch: 100, pan: 0 },
    bgs: { name: "Wind4", volume: 40, pitch: 100, pan: 0 },
    note: "<hai_tone:-34,-34,-17,85>\n<hai_parallax:DarkClouds,1,0>\n<hai_ash:3>",
    fields: { specifyBattleback: true, battleback1Name: "Fort2", battleback2Name: "Fort2" },
    _説明: "P13（#189）：見張り台（docs/world.md 4.3・look.md の 018。グィドが来ると開く）。烽火の台を調べると、訪れたマップの地図が隅まで埋まる（Hai_Facilities の use watch）。開いている間、結界の転送の行き先が増える。出口は南の下り階段 (8,12) → 010 の見張り台の扉の前 (17,9)。019 の見張り台の扉 (16,6) からも来る。この設定は p13_data.mjs が書く。",
    chars: {
      "<": { name: "下り階段（010 へ）", as: ".", tiles: [null, null, "D:26"] },
    },
    deco: {
      Z: { name: "胸壁の刻み（壁の亀裂）", z2: "D:195" }, // W29（#314）：タイルセット 21 の D は Dungeon_B。前の D:35 は氷の欠片で、通れる絵だったので胸壁の 1 マスが歩ける床になっていた
      f: { name: "烽火の台（石のかまど）", z2: "B:147" },
      p: { name: "倒れた槍立て", z2: "E:183" },
      r: { name: "瓦礫", z2: "D:120" },
      a: { name: "鎧の亡骸（鎧のスタンド）", z2: "E:160" },
    },
    scatter: [
      { on: ".", z: 1, tiles: ["A2:15"], rate: 0.12, seed: 1810 },
      { on: ".", tiles: ["D:32", "D:33"], rate: 0.05, seed: 1811 },
    ],
    events: [
      exitTo("watch"),
      useRoom("watch", "烽火の台", [8, 5]),
      text("胸壁の刻み", [3, 1], ["胸壁に、刃物で刻んだ線が並んでいる。", "五本ごとに横線。数えると、六十一。"]),
    ],
  },
};
for (const [name, cfg] of Object.entries(CONFIGS)) outputs.push({ file: srcPath(name), text: sourceText(patchLater(name, cfg)) }); // W14：後日談の一行（場面表 7.3）

// ---------------------------------------------------------------------------
// Items 1001–1050（1001 鉄切り鋏。ほかは空）。945–1000 は空で埋める（帯の先頭まで伸ばす）
// ---------------------------------------------------------------------------
const items = readData("Items.json");
const emptyItem = id => ({
  id, animationId: 0, consumable: true,
  damage: { critical: false, elementId: 0, formula: "0", type: 0, variance: 20 },
  description: "", effects: [], hitType: 0, iconIndex: 0, itypeId: 1, name: "", note: "",
  occasion: 0, price: 0, repeats: 1, scope: 0, speed: 0, successRate: 100, tpGain: 0,
});
extendTable(items, BAND[1], emptyItem);
for (let id = BAND[0]; id <= BAND[1]; id++) items[id] = emptyItem(id);
items[SHEARS] = {
  ...emptyItem(SHEARS),
  name: "鉄切り鋏",
  description: "錆びた鉄格子を切る、柄の長い鋏。\n刃の根元に、新しい打ち印と古い打ち印が並んでいる。",
  iconIndex: 200, itypeId: 2, consumable: false, occasion: 3, price: 300,
};
outputs.push({ file: dataPath("Items.json"), text: formatTable(items) });

// ---------------------------------------------------------------------------
// System.json：スイッチ 125–127・変数 176 の名前（docs/world.md 4.4）
// ---------------------------------------------------------------------------
const sysFile = dataPath("System.json");
const system = JSON.parse(fs.readFileSync(sysFile, "utf8"));
for (const [id, name] of Object.entries(SWITCHES)) system.switches[id] = name;
for (const [id, name] of Object.entries(VARIABLES)) system.variables[id] = name;
outputs.push({ file: sysFile, text: JSON.stringify(system) });

// ---------------------------------------------------------------------------
let stale = 0;
for (const { file, text: body } of outputs) {
  const rel = path.relative(ROOT, file);
  const current = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
  if (check) {
    if (current !== body) {
      console.error(`古い: ${rel}（node tools/maps/src/p13_data.mjs で書き直す）`);
      stale++;
    } else console.log(`一致: ${rel}`);
  } else {
    fs.writeFileSync(file, body);
    console.log(`${current === body ? "変化なし" : "書き出し"}: ${rel}`);
  }
}
if (stale) process.exit(1);
