// W6（#144）：黒鉄の砦（マップ 010–014・019）の設定と、W6 の帯のデータを書く。何度走らせても同じ結果になる。
//   node tools/maps/src/w6_data.mjs           書く（このあと node tools/maps/build.mjs w6_010_keep w6_011_drill … で地図を作る）
//   node tools/maps/src/w6_data.mjs --check   書かずに、今のファイルと同じかだけ見る（違えば終了コード 1）
// 書くもの：
//   tools/maps/src/w6_*.json        砦の文字マップの設定（イベント・凡例の上書き・スタンプ・散らし）。地図（.txt・.deco.txt）は手で書く
//   data/System.json                switches・variables の W6 の帯（101–130・151–160・171–200）のうち、docs/world.md 4.4 の旗の名前と、開始位置
//                                    （P8 の 121–130・P11 の 131–150・P12 の 161–170 は触らない。151–160 は前の世界のボスの旗が残っているので触らない）
//   data/CommonEvents.json          201「記憶が戻ったときの一言」（docs/world.md 3.5。薄い思念のイベントの最後から呼ぶ）
//   data/MapInfos.json              010–014・019 の名前（エディタの一覧。新しい世界の名前に）
// 前の世界の w1_data.mjs も System.json の 101–200 の名前と開始位置を書くが、そちらはもう走らせない（新しい世界の旗はこのファイルが正本）。
// 文は docs/world.md 3.4（目覚め）・4 章（拠点）・6.5（薄い思念）・7.1（シャノ）・11 章（口調）から。説明役に語らせない（3.2）。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readData, formatTable, dataPath, extendTable } from "../../data/io.mjs";
import { SRC_DIR } from "../build.mjs";
import { fortTableEvents, FORT_SWITCH_NAMES } from "./w17_parts.mjs"; // W17（#233）：砦の食卓の場面（イベント ID 61–70・スイッチ 180–185）

const check = process.argv.includes("--check");
const outputs = []; // [{ file, text }]
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

// ---------------------------------------------------------------------------
// イベントの命令の部品
// ---------------------------------------------------------------------------
const cmd = (code, parameters, indent = 0) => ({ code, indent, parameters });
const END = cmd(0, []);
// 5 行以上は 4 行ずつの窓に分ける（窓は 4 行まで。W15 #231 の場面表は 1 行 26 字までで切ってある）
const say = (lines, speaker = "", indent = 0) => {
  const out = [];
  for (let i = 0; i < lines.length; i += 4) out.push(cmd(101, ["", 0, 0, 2, speaker], indent), ...lines.slice(i, i + 4).map(l => cmd(401, [l], indent)));
  return out;
};
const se = (name, indent = 0, volume = 90, pitch = 100) => cmd(250, [{ name, volume, pitch, pan: 0 }], indent);
const plugin = (name, command, label, args = {}, indent = 0, show = {}) => [
  cmd(357, [name, command, label, args], indent),
  ...Object.entries(args).map(([k, v]) => cmd(657, [`${show[k] ?? k} = ${v}`], indent)),
];
const switchOn = (id, indent = 0) => cmd(121, [id, id, 0], indent);
const memo = text => `\\C[6]メモ：\\C[0]${text}`;
const addNote = (id, text, indent = 0) => plugin("Hai_Thoughts", "addNote", "メモを足す", { text, id, kind: "clue" }, indent, { text: "メモの一行", id: "ID", kind: "種類" });

const DOWN = 2, LEFT = 4, RIGHT = 6, UP = 8;
const sourceText = cfg => JSON.stringify(cfg, null, 2) + "\n";
const srcPath = name => path.join(SRC_DIR, name + ".json");

// 絵（持ち主がエディタで決め直してよい。仮の絵）
const IMG = {
  thought: { characterName: "!Flame", characterIndex: 5, direction: DOWN, pattern: 1 }, // 残留思念（青い火）
  faint: { characterName: "!Flame", characterIndex: 4, direction: DOWN, pattern: 1 }, // 薄い思念（Hai_Thoughts の見本と同じ）
  hearthCold: { characterName: "!Flame", characterIndex: 2, direction: RIGHT, pattern: 1 }, // 冷えた炉の火床
  hearthLit: { characterName: "!Flame", characterIndex: 2, direction: DOWN, pattern: 1 }, // 火の入った炉
  shano: { characterName: "People1", characterIndex: 2, direction: DOWN, pattern: 1 }, // シャノ（仮。P8 の試験場と同じ）
  doorShut: { characterName: "!Door1", characterIndex: 2, direction: DOWN, pattern: 1 }, // 木の扉（閉じている・崩れている）
  doorOpen: { characterName: "!Door1", characterIndex: 2, direction: UP, pattern: 1 },
  ironShut: { characterName: "!Door1", characterIndex: 0, direction: DOWN, pattern: 2 }, // 鉄の扉
  ironOpen: { characterName: "!Door1", characterIndex: 0, direction: UP, pattern: 2 },
  chest: { characterName: "!Chest", characterIndex: 0, direction: DOWN, pattern: 0 },
  chestOpen: { characterName: "!Chest", characterIndex: 0, direction: UP, pattern: 0 },
  // W15（#231）：食卓の人と物（仮の絵。持ち主が決め直す。ヴォルフラム・アデルは 024・026 と同じ絵）
  wolfram: { characterName: "People1", characterIndex: 2, direction: DOWN, pattern: 1 },
  adele: { characterName: "Actor3", characterIndex: 6, direction: DOWN, pattern: 1 },
  bruno: { characterName: "Actor1", characterIndex: 4, direction: UP, pattern: 1 },
  margo: { characterName: "People3", characterIndex: 5, direction: RIGHT, pattern: 1 },
  picker: { characterName: "People3", characterIndex: 1, direction: RIGHT, pattern: 1 },
  bowlDown: { tileId: "E:62" }, // 伏せた椀（裏の絵は持ち主。今は表と同じ椀）
  bowlUp: { tileId: "E:62" },
  bowlServed: { tileId: "E:62" }, // 先に盛る一椀（湯気の立つ椀の絵は持ち主）
};

// ---------------------------------------------------------------------------
// 旗（docs/world.md 4.4。W6 の帯）
// ---------------------------------------------------------------------------
const SW = {
  bellPrison: 101, bellArchive: 102, bellWater: 103, bellFoundry: 104, bellsAll: 105,
  thirdScene: 106, metMirlene: 107, lastClimax: 108, summitGate: 109, nameBack: 110,
  woke: 111, hearth: 112, nameWall: 113, ironDoor: 114,
  facility: { soul: 121, kitchen: 122, gate: 123, lore: 124, infirmary: 125, smithy: 126, watch: 127 }, // P8・P13 の旗（読むだけ）
  writing: 171, shano: 172, footprints: 173, eastGate: 174,
  // W15（#231）の筋の旗（W6 の帯の空き 115–118。docs/story/scenes/01-fort-region1.md 1 章）
  margoOnce: 115, bowlUp: 116, served: 117, margoTwice: 118,
  bruno: 138, // 加入:ブルーノ（P11。読むだけ）
  wolfram: 306, adele: 307, // W7 の帯（読むだけ）
};
const VAR = { bells: 101, companions: 102, survivors: 103, faint: 138, prisonBell: 165, bellIron: 301 };
const ITEM = { bellIron: 327, shears: 1001 };
const BRUNO = 5; // アクター 5（条件分岐 111 の [4, 5, 0]：パーティにいる）
const SWITCH_NAMES = {
  ...FORT_SWITCH_NAMES, // 180–185（W17）
  101: "鐘:営倉", 102: "鐘:記録院", 103: "鐘:水底", 104: "鐘:鋳物場", 105: "鐘:四つ鳴った",
  106: "3つ目の鐘の場面", 107: "ミルレーネに会った", 108: "最後の地域の山場", 109: "頂への門:開", 110: "名前が戻った",
  111: "目覚めた", 112: "炉に火を入れた", 113: "名の壁を調べた", 114: "営倉の鉄扉:開",
  115: "マルゴ:一度来た", 116: "食卓:伏せた椀を起こしてある", 117: "食卓:先に盛る一椀", 118: "マルゴ:二度来た",
  171: "墓所の書き付けを読んだ", 172: "シャノが砦にいる", 173: "灰の足跡を見た", 174: "城壁の東門:開",
};
const VARIABLE_NAMES = { 101: "鳴らした鐘の数", 103: "生き残りの数" };
const COMMON = { memoryLine: 201 };

// ---------------------------------------------------------------------------
// 砦の座標（tools/maps/src/w6_010_keep.txt。行が y、列が x、0 始まり）
// ---------------------------------------------------------------------------
const KEEP = 10;
const P = {
  start: [7, 18], // 墓所の床（目覚め）。System.json の開始位置
  hearth: [25, 25], // 大広間の炉（北の壁の暖炉）
  home: [25, 26], // 炉の前（全滅の戻り先）
  shanoHide: [30, 26], // 東の柱 (31,26) の陰
  shanoSeat: [18, 29], // 食卓の西の端（戸口にいちばん近い席。伏せた椀からいちばん遠い）
  // W15（#231）：十四の椅子の長い食卓（y 29 の x 19–30）。北（炉の壁の側）と南に 6 席ずつ（x 19・21…29）、西と東の端に 1 席ずつ
  table: [25, 29], // 食卓（調べる）
  bowl: [30, 29], // 伏せた椀（いちばん奥の席 (31,29) の前）
  served: [29, 29], // 先に盛る一椀（炉から数えて三つ目の、壁の側の席 (29,28) の前）
  adeleSeat: [19, 28], // 戸口にいちばん近い、壁の側の席
  brunoSeat: [19, 30], // 戸口にいちばん近い、壁と反対の側の席
  wolfram: [24, 26], // 炉の前（戻り先 (25,26) の西隣）
  margo: [17, 30], // 大広間の西の戸口の内側
  pickers: [[17, 31], [18, 31]],
  gateDents: [24, 1], // 外門への階段の脇の壁
  ironDoor: [25, 36], // 南の廊下の鉄扉
  doors: { soul: [40, 8], lore: [33, 8], kitchen: [5, 36], gate: [10, 36], infirmary: [44, 8], smithy: [42, 36], watch: [17, 8] }, // 後ろの 3 つは P13
};
// 部屋（011–014）：南の出口 (8,12)、着く所 (8,11)。010 の扉の前へ戻る
const ROOM_ARRIVE = [8, 11];
const front = ([x, y]) => [x, y + 1];

// 外の行き先（W7 #145 が作り直した 020・033 の着く所）
const FOREST = { mapId: 20, x: 35, y: 47 }; // 霧の森・入口の南の門の内側
const PRISON = { mapId: 33, x: 47, y: 42 }; // 営倉・監房の外門の詰め所の鉄扉の前
const RAMPART = { mapId: 19, x: 2, y: 8 }; // 城壁の上（019）の西の端（下り階段の隣）

// ---------------------------------------------------------------------------
// 010 黒鉄の砦・内郭
// ---------------------------------------------------------------------------
// イベントの ID は events の並び順（1 から）。シャノ（柱の陰）は移動ルートで ID を使うので先頭に置く
const SHANO_HIDE_ID = 2;

const opening = {
  name: "目覚めの場面",
  type: "raw",
  x: 0,
  y: 39,
  pages: [
    {
      priorityType: 0,
      trigger: 3, // 自動実行
      list: [
        cmd(221, []),
        cmd(320, [1, "墓守"]),
        cmd(324, [1, "墓守"]),
        cmd(230, [60]),
        // 戸を三度叩く音（一つ目と二つ目の間を長く、三つ目を短く。W15 #231）
        se("Knock", 0, 90, 100),
        cmd(230, [70]),
        se("Knock", 0, 90, 100),
        cmd(230, [18]),
        se("Knock", 0, 90, 100),
        cmd(230, [50]),
        se("Bell3", 0, 50, 130),
        cmd(230, [45]),
        cmd(222, []),
        ...say(["床の小さな鈴が、まだ揺れている。"]),
        switchOn(SW.woke),
        END,
      ],
    },
    { conditions: { switch1Id: SW.woke, switch1Valid: true }, priorityType: 0 },
  ],
};

// シャノ（柱の陰）：炉に火が入ると姿が見える。会う場面は炉のイベントが進める。会ったら消えて、食卓のシャノに替わる
const shanoHide = {
  name: "シャノ（柱の陰）",
  type: "raw",
  x: P.shanoHide[0],
  y: P.shanoHide[1],
  pages: [
    { priorityType: 0 },
    { conditions: { switch1Id: SW.hearth, switch1Valid: true }, image: { ...IMG.shano, direction: LEFT }, priorityType: 1 },
    { conditions: { switch1Id: SW.shano, switch1Valid: true }, priorityType: 0 },
    // W15（#231）：営倉の鐘のあとは梁の上（柱の陰と同じ所。梁の下に立って話す。梁の上の絵は持ち主か V）
    {
      conditions: { switch1Id: SW.shano, switch1Valid: true, switch2Id: SW.bellPrison, switch2Valid: true },
      image: { ...IMG.shano, direction: DOWN },
      priorityType: 2,
      list: [...say(["見てた？　さっき梁の上まで登った。", "鉄の留め金、三つ取れた"], "シャノ"), ...say(["下は、人が多い"], "シャノ"), END],
    },
  ],
};

// 食卓のシャノ（戸口にいちばん近い席）。営倉の鐘が鳴ると梁の上へ（柱の陰のイベントの 4 ページ目）。
// マルゴと取り引きした（鐘を外した。変数 165 が 3 以上）あとは、鐘が鳴るまで砦にいない（W15 #231）
const shanoSeat = {
  name: "シャノ（食卓）",
  type: "raw",
  x: P.shanoSeat[0],
  y: P.shanoSeat[1],
  pages: [
    { priorityType: 0 },
    {
      conditions: { switch1Id: SW.shano, switch1Valid: true },
      image: { ...IMG.shano, direction: RIGHT },
      priorityType: 1,
      list: [
        cmd(111, [0, SW.bruno, 0]),
        ...say(["また誰かと話してた？　ま、いいけど"], "シャノ", 1),
        cmd(0, [], 1),
        cmd(412, []),
        ...say(["地下の牢の鐘、外して持ってったら、頭に褒められる。……たぶん"], "シャノ"),
        END,
      ],
    },
    { conditions: { variableId: VAR.prisonBell, variableValid: true, variableValue: 3 }, priorityType: 0 },
    { conditions: { switch1Id: SW.bellPrison, switch1Valid: true }, priorityType: 0 },
  ],
};

// 炉：火を入れる → 回復と記録（Hai_Warp の選択肢）・全滅の戻り先（Hai_Defeat）→ シャノが柱の陰から出てくる
const shanoWalk = [
  { code: 29, parameters: [4] }, // 速さ 4（場面を間延びさせない）
  { code: 1 }, // 下
  { code: 2 }, // 左
  { code: 2 },
  { code: 17 }, // 左を向く
];
const moveRoute = (charId, steps) => {
  const list = [...steps.map(s => ({ code: s.code, indent: null, parameters: s.parameters || [] })), { code: 0, parameters: [] }];
  return [
    cmd(205, [charId, { list, repeat: false, skippable: false, wait: true }]),
    ...steps.map(s => cmd(505, [{ code: s.code, indent: null, parameters: s.parameters || [] }])),
  ];
};
// シャノが柱の陰から食卓の戸口の席へ歩く（(28,27) から下へ 1、西へ 10。椅子の列の上を通る。何かに塞がれても止まらない）
const shanoToSeat = [
  { code: 37 }, // すり抜け ON
  { code: 1 }, // 下
  ...Array.from({ length: 10 }, () => ({ code: 2 })), // 左
  { code: 38 }, // すり抜け OFF
  { code: 16 }, // 下を向く
];
const moveRouteSkippable = (charId, steps) => {
  const list = [...steps.map(s => ({ code: s.code, indent: null, parameters: s.parameters || [] })), { code: 0, parameters: [] }];
  return [
    cmd(205, [charId, { list, repeat: false, skippable: true, wait: true }]),
    ...steps.map(s => cmd(505, [{ code: s.code, indent: null, parameters: s.parameters || [] }])),
  ];
};
const shanoScene = indent => [
  cmd(230, [15], indent),
  ...moveRoute(SHANO_HIDE_ID, shanoWalk).map(c => ({ ...c, indent })),
  ...say(["火、つけたの、あんた？"], "シャノ", indent),
  ...say(["おれ、鉄を拾いに来ただけ。", "鈴、蹴っちゃった。ごめん"], "シャノ", indent),
  cmd(111, [12, "Hai.Thoughts.isRead('K01')"], indent),
  ...say(["さっき誰と話してたの？　……ま、いいや"], "シャノ", indent + 1),
  cmd(0, [], indent + 1),
  cmd(412, [], indent),
  ...say(["頭に言われてんだ。", "砦の地下の牢の鐘、外して持ってこいって"], "シャノ", indent),
  ...say(["でも鉄の扉が開かない。", "あと、森の霧で炊き出しの爺さんが三日帰ってない"], "シャノ", indent),
  ...say(["おれは霧、だめなんだ。", "ここ、ちょっといていい？"], "シャノ", indent),
  ...say(["あ、あと。あんた、夜は戸ぇ開けんなよ。", "知らなそうだから言っとく"], "シャノ", indent),
  ...plugin("Hai_Facilities", "open", "部屋を開く", { facility: "gate" }, indent, { facility: "部屋" }),
  cmd(122, [VAR.survivors, VAR.survivors, 1, 0, 1], indent),
  ...addNote("shano:bell", "鐘：砦の地下の牢（シャノ）", indent),
  ...addNote("shano:cook", "炊き出しの爺さん：外の森の霧（シャノ）", indent),
  ...say([memo("鐘：砦の地下の牢（シャノ）"), memo("炊き出しの爺さん：外の森の霧（シャノ）")], "", indent),
  // 戸口にいちばん近い席（伏せた椀からいちばん遠い席）へ
  ...moveRouteSkippable(SHANO_HIDE_ID, shanoToSeat).map(c => ({ ...c, indent })),
  switchOn(SW.shano, indent),
  cmd(230, [20], indent),
  ...say(["見てた？　おれ、椅子に座るの、久しぶり"], "シャノ", indent),
];
const hearth = {
  name: "砦の炉",
  type: "raw",
  x: P.hearth[0],
  y: P.hearth[1],
  pages: [
    {
      image: IMG.hearthCold,
      priorityType: 1,
      directionFix: true,
      list: [
        ...say(["炉は冷えている。", "灰の下に、乾いた薪が残っている。"]),
        cmd(102, [["火を入れる", "やめる"], 1, 0, 2, 0]),
        cmd(402, [0, "火を入れる"]),
        se("Fire1", 1),
        switchOn(SW.hearth, 1),
        ...plugin("Hai_Defeat", "setHome", "拠点を設定", { mapId: "0", x: String(P.home[0]), y: String(P.home[1]), direction: String(UP) }, 1,
          { mapId: "マップ ID", x: "X", y: "Y", direction: "向き" }),
        cmd(230, [10], 1),
        ...say(["炉に火が入った。", "煤けた壁が、赤く照らされる。"], "", 1),
        ...shanoScene(1),
        cmd(0, [], 1),
        cmd(402, [1, "やめる"]),
        cmd(0, [], 1),
        cmd(404, []),
        END,
      ],
    },
    {
      conditions: { switch1Id: SW.hearth, switch1Valid: true },
      image: IMG.hearthLit,
      priorityType: 1,
      directionFix: true,
      stepAnime: true,
      // 結界でないイベントから「結界を開く」：イベントの名前で、休む・記録する・転送する（Hai_Warp）。行き先の先頭は拠点（この炉の前）
      list: [...plugin("Hai_Warp", "open", "結界を開く"), END],
    },
  ],
};

const text = (name, [x, y], lines, extra = {}) => ({ name, type: "text", x, y, lines, ...extra });
// 東の塔の影の灯の数（鳴らした鐘の数＋一。W12 の 116 と同じ数え方）。make(灯の数の字) は indent 1 の命令を返す
const LAMPS = ["二つ", "三つ", "四つ", "五つ"];
const lampsByBells = make => [
  ...LAMPS.flatMap((n, i) => [cmd(111, [1, VAR.bells, 0, i + 1, i === LAMPS.length - 1 ? 1 : 0]), ...make(n), cmd(0, [], 1), cmd(412, [])]),
  END,
];

const writing = {
  name: "墓所の壁の書き付け",
  type: "raw",
  x: 7,
  y: 13,
  pages: [
    {
      list: [
        ...say(["壁に、刃物で刻んだ字がある。", "「四つの鐘を鳴らして。", "それから、山の頂の鐘楼へ」", "最後の一画が、途中で止まっている。"]),
        cmd(111, [0, SW.writing, 1]),
        ...addNote("goal:bells", "四つの鐘を鳴らす。それから山の頂の鐘楼へ（墓所の壁）", 1),
        ...say([memo("四つの鐘を鳴らす。それから山の頂の鐘楼へ（墓所の壁）")], "", 1),
        switchOn(SW.writing, 1),
        cmd(0, [], 1),
        cmd(412, []),
        END,
      ],
    },
  ],
};

const footprints = ([x, y]) => ({
  name: "灰の上の足跡",
  type: "raw",
  x,
  y,
  pages: [
    {
      priorityType: 0,
      trigger: 1, // プレイヤーから接触
      list: [...say(["灰に、裸足の小さな足跡。外へ駆けていった。"]), switchOn(SW.footprints), END],
    },
    { conditions: { switch1Id: SW.footprints, switch1Valid: true }, priorityType: 0 },
  ],
});

const memoryLine = [cmd(117, [COMMON.memoryLine])];
const faint = (id, name, [x, y], lines) => ({
  name: `薄い思念 ${id} ${name}`,
  type: "raw",
  x,
  y,
  note: `<hai_faint:${id}>`,
  pages: [{ image: IMG.faint, priorityType: 1, list: [...say(lines), ...memoryLine, END] }],
});
const thought = (id, name, [x, y], lines, note = "") => ({
  name: `思念 ${id} ${name}`,
  type: "text",
  x,
  y,
  note: `<hai_thought:${id}>${note}`,
  image: IMG.thought,
  lines,
});

const ring = {
  name: "名の壁の輪",
  type: "raw",
  x: 42,
  y: 19,
  pages: [
    {
      list: [
        cmd(111, [1, VAR.companions, 0, 1, 1]),
        cmd(102, [["輪に触れる", "並びを替える", "やめる"], 2, 0, 2, 0], 1),
        cmd(402, [0, "輪に触れる"], 1),
        ...plugin("Hai_Companions", "summonMenu", "名の壁で呼ぶ", {}, 2),
        cmd(0, [], 2),
        cmd(402, [1, "並びを替える"], 1),
        ...plugin("Hai_Companions", "partyMenu", "編成", {}, 2),
        cmd(0, [], 2),
        cmd(402, [2, "やめる"], 1),
        cmd(0, [], 2),
        cmd(404, [], 1),
        cmd(0, [], 1),
        cmd(411, []),
        ...plugin("Hai_Companions", "summonMenu", "名の壁で呼ぶ", {}, 1),
        cmd(0, [], 1),
        cmd(412, []),
        switchOn(SW.nameWall),
        END,
      ],
    },
  ],
};

// 部屋の扉（Hai_Facilities）：1 ページ目は崩れた扉、2 ページ目（部屋のスイッチ）は開いた扉で、触れると部屋へ
const ROOMS = {
  soul: { mapId: 11, name: "稽古場" },
  kitchen: { mapId: 12, name: "食堂" },
  gate: { mapId: 13, name: "倉" },
  lore: { mapId: 14, name: "書庫" },
  infirmary: { mapId: 16, name: "療養所" }, // P13（#189）
  smithy: { mapId: 17, name: "鍛冶場" },
  watch: { mapId: 18, name: "見張り台" },
};
const roomDoor = (key, [x, y] = P.doors[key]) => {
  const room = ROOMS[key];
  return {
    name: `${room.name}の扉`,
    type: "raw",
    x,
    y,
    pages: [
      { image: IMG.doorShut, priorityType: 1, walkAnime: false, list: [...plugin("Hai_Facilities", "door", "崩れた扉", { door: key }, 0, { door: "どの部屋の扉か" }), END] },
      {
        conditions: { switch1Id: SW.facility[key], switch1Valid: true },
        image: IMG.doorOpen,
        priorityType: 1,
        trigger: 1,
        walkAnime: false,
        list: [se("Move1"), cmd(201, [0, room.mapId, ...ROOM_ARRIVE, UP, 0]), END],
      },
    ],
  };
};

const ironDoor = {
  name: "営倉への鉄扉",
  type: "raw",
  x: P.ironDoor[0],
  y: P.ironDoor[1],
  pages: [
    { image: IMG.ironShut, priorityType: 1, walkAnime: false, list: [...say(["錆びた鉄の扉。押しても引いても動かない。", "隙間から覗くと、向こう側に閂が掛かっている。"]), END] },
    {
      conditions: { switch1Id: SW.ironDoor, switch1Valid: true },
      image: IMG.ironOpen,
      priorityType: 1,
      trigger: 1,
      walkAnime: false,
      list: [se("Move1"), cmd(201, [0, PRISON.mapId, PRISON.x, PRISON.y, LEFT, 0]), END],
    },
  ],
};

const chest = (name, [x, y], itemId, count, itemName) => ({
  name: `宝箱（${itemName}）`,
  type: "raw",
  x,
  y,
  pages: [
    {
      image: IMG.chest,
      priorityType: 1,
      walkAnime: false,
      list: [se("Chest1"), cmd(126, [itemId, 0, 0, count]), cmd(123, ["A", 0]), ...say([`${itemName}${count > 1 ? `×${count}` : ""}を手に入れた。`]), END],
    },
    { conditions: { selfSwitchCh: "A", selfSwitchValid: true }, image: IMG.chestOpen, priorityType: 1, walkAnime: false },
  ],
});

// ---------------------------------------------------------------------------
// W15（#231）：原作の反映（docs/story/scenes/01-fort-region1.md の二・八・十五・十六）。010 のイベント ID 42–52
//   食卓・伏せた椀・ヴォルフラム（先に盛る）・輪のあとの名乗り・ブルーノの席・マルゴ（一度目・取り引き・二度目）と拾い屋二人・
//   アデルの席・アデルの講義・先に盛る一椀（梁の上のシャノは柱の陰のイベントの 4 ページ目）。019 の夕べの数
// ---------------------------------------------------------------------------
const ifSw = (id, indent = 0) => cmd(111, [0, id, 0], indent);
const ifBruno = (indent = 0) => cmd(111, [4, BRUNO, 0], indent);
const ENDIF = (indent = 0) => [cmd(0, [], indent + 1), cmd(412, [], indent)];
const selfOn = (ch = "A", indent = 0) => cmd(123, [ch, 0], indent);
const KEEPER = "\\N[1]"; // 墓守（主人公の一行）
const errand = (key, stage, text, indent = 0) =>
  plugin("Hai_Notes", "errand", "頼みごとを進める", { key, stage: String(stage), text }, indent, { key: "キー", stage: "段", text: "今の一行" });
const errandEnd = (key, result, text, indent = 0) =>
  plugin("Hai_Notes", "errandEnd", "頼みごとを終える", { key, result, text }, indent, { key: "キー", result: "終わり方", text: "最後の一行" });
// 半透明（仲間の席。移動ルートの「不透明度の変更」を一度だけ）
const ghost = { moveType: 3, moveRoute: { list: [{ code: 42, indent: null, parameters: [128] }, { code: 0, parameters: [] }], repeat: false, skippable: true, wait: false } };

// 二 十四の椅子：食卓（長辺）と伏せた椀（いちばん奥の席の前）
const table = text("食卓", P.table, ["長い食卓。椅子が十四。", "どれも埃をかぶっている。", "いちばん奥の席に一つだけ、", "椀が伏せてある。"]);
const bowlList = [
  ...say(["伏せた椀を起こす。中は乾いている。", "椀の底に、小刀で彫った印。", "墓所の壁の字と、同じ手だ。"]),
  cmd(102, [["伏せておく", "起こしておく"], -2, 0, 2, 0]),
  cmd(402, [0, "伏せておく"]), cmd(121, [SW.bowlUp, SW.bowlUp, 1], 1), cmd(0, [], 1),
  cmd(402, [1, "起こしておく"]), switchOn(SW.bowlUp, 1), cmd(0, [], 1),
  cmd(403, []), cmd(0, [], 1),
  cmd(404, []),
  END,
];
const bowl = {
  name: "伏せた椀", type: "raw", x: P.bowl[0], y: P.bowl[1],
  pages: [
    { image: IMG.bowlDown, priorityType: 1, list: bowlList },
    { conditions: { switch1Id: SW.bowlUp, switch1Valid: true }, image: IMG.bowlUp, priorityType: 1, list: bowlList },
    // 1151 のページ（W14 の頼み。場面表 04 の 2.1：三つ目の鐘の夜から毎晩盛られる。スイッチ 1151 は W14 の帯で、読むだけ）
    { conditions: { switch1Id: 1151, switch1Valid: true }, image: IMG.bowlUp, priorityType: 1,
      list: [...say(["奥の席の椀に、飯が盛られている。", "椀の底の印は、飯の下で見えない。"]), END] },
  ],
};

// 八 先に盛る：ヴォルフラム（炉の前）。一度目に「先に盛る一椀」を炉から三つ目の壁の側の席に置く（スイッチ 117）
const wolframFort = {
  name: "ヴォルフラム（炉の前）", type: "raw", x: P.wolfram[0], y: P.wolfram[1],
  pages: [
    { priorityType: 0 },
    {
      conditions: { switch1Id: SW.wolfram, switch1Valid: true }, image: IMG.wolfram, priorityType: 1,
      list: [
        ifSw(SW.shano),
        ...say(["でかい爺さんが来た。鍋、担いでた。", "霧、平気なんだって。信じらんない"], "シャノ", 1),
        ...ENDIF(),
        ...say(["座れ！　食え！"], "ヴォルフラム"),
        ...say(["ヴォルフラムは椀を取り、鍋から一杯よそった。", "よそった椀を、食卓の空いた席に置いた。", "炉から数えて三つ目の、壁の側の席。"]),
        switchOn(SW.served),
        ...say(["先に盛る。誰のぶんかは知らん。", "家の決まりだ"], "ヴォルフラム"),
        ...say(["奥のは触らんぞ。", "伏せた椀は、伏せた奴が起こす"], "ヴォルフラム"),
        selfOn(),
        END,
      ],
    },
    // 二ページ目（食卓の人の数で変わる一言は、まだ仕組みが無い。world.md 4.3）
    { conditions: { switch1Id: SW.wolfram, switch1Valid: true, selfSwitchCh: "A", selfSwitchValid: true }, image: IMG.wolfram, priorityType: 1,
      list: [...say(["座れ！　食え！"], "ヴォルフラム"), END] },
  ],
};

// 八 輪のあと：ブルーノの名乗り（目覚めの一言のあと。自動実行で一度だけ）
const afterRing = {
  name: "輪のあと（ブルーノの名乗り）", type: "raw", x: 1, y: 39,
  pages: [
    { priorityType: 0 },
    { conditions: { switch1Id: SW.bruno, switch1Valid: true }, priorityType: 0, trigger: 3,
      list: [...say(["隊の方でなくても、いいです。", "僕は、ブルーノといいます"], "ブルーノ"), ...say(["鐘の騎士団の。たぶん、最後の"], "ブルーノ"), selfOn(), END] },
    { conditions: { switch1Id: SW.bruno, switch1Valid: true, selfSwitchCh: "A", selfSwitchValid: true }, priorityType: 0 },
  ],
};

// 八 ブルーノの席（戸口にいちばん近い、壁と反対の側。半透明。話しかけたとき一度だけ）
const brunoSeat = {
  name: "ブルーノの席", type: "raw", x: P.brunoSeat[0], y: P.brunoSeat[1],
  pages: [
    { priorityType: 0 },
    { conditions: { switch1Id: SW.bruno, switch1Valid: true }, image: IMG.bruno, priorityType: 1, ...ghost,
      list: [...say(["末席でいいです。隊では、いつもそこでした"], "ブルーノ"), selfOn(), END] },
    { conditions: { switch1Id: SW.bruno, switch1Valid: true, selfSwitchCh: "A", selfSwitchValid: true }, image: IMG.bruno, priorityType: 1, ...ghost },
  ],
};

// 八（続）・十五 マルゴ：一度目（ヴォルフラムが砦に来たあと、鐘の前）、取り引き（営倉の鐘を外したあと）、二度目（鳴らしたあと）。
// 砦に入ると自動で入ってくる。拾い屋二人を連れている。ページは後ろほど強い：
//   2 一度目（306）／3 帰った（115）／4 取り引き（変数 165 ≥ 3）／5 帰った（変数 165 ≥ 4）／6 鳴らしたが一度目を見ていない（101）／7 二度目（115・101）／8 帰った（118）
const margoFirst = [
  ...say(["鐘は？"], "マルゴ"),
  ifSw(SW.shano),
  ...say(["扉が開かないんだって。地下の。", "おれ、言ったじゃん"], "シャノ", 1),
  ...ENDIF(),
  ...say(["あんたが火の人かい。", "あたしはマルゴ。拾い屋の頭だ"], "マルゴ"),
  ...say(["地下の牢に、鐘がある。", "外して持ってきな。鉄として買う"], "マルゴ"),
  ...say(["鐘一つで、麦が三月"], "マルゴ"),
  ifSw(SW.shano),
  ...say(["マルゴは戸口の席のシャノを見て、", "言葉を切った。"], "", 1),
  ...ENDIF(),
  ...say(["値は、あとで"], "マルゴ"),
  ...say(["鳴らすんじゃないよ。", "鳴った鐘は、鉄に戻らない"], "マルゴ"),
  ...say(["三日したら、取りに来る"], "マルゴ"),
  ifBruno(),
  ...say(["あの人、鐘を、鉄と言いました"], "ブルーノ", 1),
  ...ENDIF(),
  ...errand("prisonBell", 1, "マルゴが営倉の鐘を鉄として買いに来た"),
  switchOn(SW.margoOnce),
  END,
];
// 取り引きの道（鐘を鳴らさずに外した。W が書いた。骨子 7.3・8.1：鳴らさない道は作らない。マルゴは鐘を台に戻させ、シャノは鐘が鳴るまで砦を出る）
const margoTrade = [
  ...say(["外したってね。うちの者が見てきた"], "マルゴ"),
  ...say(["鉄は、鳴らしてから売る方が高い"], "マルゴ"),
  ...say(["鐘は台に戻させた。", "鳴らしてから、また呼びな"], "マルゴ"),
  ifSw(SW.shano),
  ...say(["シャノは、マルゴとこちらを見比べた。"], "", 1),
  ...say(["おれ、外にいる。", "鐘が鳴ったら戻る"], "シャノ", 1),
  ...ENDIF(),
  ...errand("prisonBell", 4, "マルゴは鐘を買わなかった。鐘は台に戻った"),
  END,
];
const margoSecond = [
  ...say(["鳴らしたね"], "マルゴ"),
  ...say(["坑道まで聞こえた。", "掘り場の連中が、鶴嘴を落とした"], "マルゴ"),
  ...say(["鳴った鐘は、あたしは買わない"], "マルゴ"),
  ...say(["お前はここで鉄拾ってな。", "霧も無いし、火もある"], "マルゴ"),
  ...say(["鋏なら売る。鉄切り鋏。", "坑道の奥の格子を切るやつだ"], "マルゴ"),
  ...say(["値は、あとで"], "マルゴ"),
  cmd(302, [0, ITEM.shears, 0, 0, true]),
  ...errandEnd("prisonBell", "done", "マルゴは鳴った鐘を買わなかった。鋏を売りに来る"),
  switchOn(SW.margoTwice),
  END,
];
const margoPages = (image, lists) => [
  { priorityType: 0 },
  { conditions: { switch1Id: SW.wolfram, switch1Valid: true }, image, priorityType: 1, ...(lists ? { trigger: 3, list: lists.first } : {}) },
  { conditions: { switch1Id: SW.margoOnce, switch1Valid: true }, priorityType: 0 },
  { conditions: { variableId: VAR.prisonBell, variableValid: true, variableValue: 3 }, image, priorityType: 1, ...(lists ? { trigger: 3, list: lists.trade } : {}) },
  { conditions: { variableId: VAR.prisonBell, variableValid: true, variableValue: 4 }, priorityType: 0 },
  { conditions: { switch1Id: SW.bellPrison, switch1Valid: true }, priorityType: 0 },
  { conditions: { switch1Id: SW.margoOnce, switch1Valid: true, switch2Id: SW.bellPrison, switch2Valid: true }, image, priorityType: 1, ...(lists ? { trigger: 3, list: lists.second } : {}) },
  { conditions: { switch1Id: SW.margoTwice, switch1Valid: true }, priorityType: 0 },
];
const margo = { name: "マルゴ", type: "raw", x: P.margo[0], y: P.margo[1], pages: margoPages(IMG.margo, { first: margoFirst, trade: margoTrade, second: margoSecond }) };
const pickers = P.pickers.map(([x, y], i) => ({ name: `拾い屋（マルゴの連れ ${i + 1}）`, type: "raw", x, y, pages: margoPages(IMG.picker, null) }));

// 十五 アデルの席（戸口にいちばん近い、壁の側）：鐘鉄を渡す（頂の道具）
const adeleSeat = {
  name: "アデル（食卓）", type: "raw", x: P.adeleSeat[0], y: P.adeleSeat[1],
  pages: [
    { priorityType: 0 },
    {
      conditions: { switch1Id: SW.adele, switch1Valid: true }, image: IMG.adele, priorityType: 1,
      list: [
        cmd(111, [8, ITEM.bellIron]),
        ...say(["後輩。遅い。先輩を待たせないで"], "アデル", 1),
        ...say(["鐘鉄は？　あった？"], "アデル", 1),
        ...say(["布に包んだ塊を、食卓のアデルの前に置いた。", "布を開くと、白い鉄が炉の火を返した。"], "", 1),
        ...say(["いい？　これは私が預かる。", "会の長が、頂の道具を打つの"], "アデル", 1),
        ...say(["売るな、って書いてある。", "掘った人が書いたのね。長には、そう言っとく"], "アデル", 1),
        cmd(126, [ITEM.bellIron, 1, 0, 1], 1),
        cmd(122, [VAR.bellIron, VAR.bellIron, 0, 0, 2], 1),
        ...errand("summitTools", 2, "鐘鉄をアデルに渡した。長が道具を打つ", 1),
        cmd(0, [], 1),
        cmd(411, []),
        ...say(["後輩。鐘鉄、まだ？", "下の層の長屋。白っぽい鉄"], "アデル", 1),
        cmd(0, [], 1),
        cmd(412, []),
        END,
      ],
    },
    { conditions: { switch1Id: SW.adele, switch1Valid: true, variableId: VAR.bellIron, variableValid: true, variableValue: 2 }, image: IMG.adele, priorityType: 1,
      list: [...say(["いい？　鐘鉄は長に渡す。", "頂の道具になる"], "アデル"), END] },
  ],
};

// 十五 アデルの講義（アデルが砦にいて、営倉の鐘が鳴り、ブルーノがパーティにいるとき。砦に戻った最初に一度だけ）
const adeleLecture = {
  name: "アデルの講義", type: "raw", x: 2, y: 39,
  pages: [
    { priorityType: 0 },
    {
      conditions: { switch1Id: SW.adele, switch1Valid: true, switch2Id: SW.bellPrison, switch2Valid: true, actorId: BRUNO, actorValid: true }, priorityType: 0, trigger: 3,
      list: [
        ...say(["アデルが、向かいの席の空気に向かって言った。"]),
        ...say(["いい？　鐘はね、巻くの。", "鳴らなくなっても、巻くの"], "アデル"),
        ...say(["布は、舌の方から。", "舌を布で包んで、口の所で結ぶ。結び目は二つ"], "アデル"),
        ...say(["アデルは手拭いを取り、", "椀を鐘に見立てて巻いてみせた。", "椀の口を上にして、底の方から布を回した。"]),
        ...say(["これで、鳴らない。会ではそう教える"], "アデル"),
        ...say(["……その巻き方は、違います"], "ブルーノ"),
        ...say(["アデルには聞こえなかった。"]),
        ...say(["いい？　もう一回。こうやって、底から"], "アデル"),
        ...say(["すみません"], "ブルーノ"),
        ...say(["アデルは三度巻いて、三度ほどいた。"]),
        ...say(["今のは試し"], "アデル"),
        selfOn(),
        END,
      ],
    },
    { conditions: { switch1Id: SW.adele, switch1Valid: true, switch2Id: SW.bellPrison, switch2Valid: true, selfSwitchCh: "A", selfSwitchValid: true }, priorityType: 0 },
  ],
};

// 十五 先に盛る一椀（炉から三つ目、壁の側の席の前。スイッチ 117 で出る）
const served = {
  name: "先に盛る一椀", type: "raw", x: P.served[0], y: P.served[1],
  pages: [
    { priorityType: 0 },
    { conditions: { switch1Id: SW.served, switch1Valid: true }, image: IMG.bowlServed, priorityType: 1,
      list: [
        ...say(["先に盛った一椀。湯気が、まだ立っている。"]),
        ifBruno(),
        ...say(["あれは、僕のぶんでは、ないです"], "ブルーノ", 1),
        ...ENDIF(),
        END,
      ] },
  ],
};

// 十六 夕べの数（019 胸壁の東の端。営倉の鐘のあと、ブルーノがパーティにいるとき一度だけ。踏むか調べる）
const NUMS = "四、五、六、七、八、九、十、十一、十二、十三、十四、十五、十六、十七、十八、十九、二十、二十一、二十二、二十三、二十四、二十五、二十六、二十七、".split("、").filter(Boolean);
const slowCount = nums => nums.map(n => `${n}、\\.`).join("");
const eveningCount = {
  name: "夕べの数（胸壁の東の端）", type: "raw", x: 42, y: 8,
  pages: [
    { priorityType: 0 },
    {
      conditions: { switch1Id: SW.bellPrison, switch1Valid: true, actorId: BRUNO, actorValid: true }, priorityType: 0, trigger: 1,
      list: [
        ...say(["ブルーノが、胸壁の東の端に立った。", "東を向いて、指を折りはじめた。"]),
        ...say(["いち、に、さん"], "ブルーノ"),
        // ブルーノの数が、ゆっくり出る（十、十一、…）。墓守の指が折れる絵は出さない
        ...say([slowCount(NUMS.slice(0, 10)), slowCount(NUMS.slice(10, 18)), slowCount(NUMS.slice(18))], "ブルーノ"),
        ...say(["指が、動いた。", "ブルーノと同じ速さで、折れていく。"]),
        ...say(["にじゅうはち、にじゅうく、さんじゅう"], "ブルーノ"),
        ...say(["ブルーノの指が、止まった。", "墓守の指は、止まらなかった。", "もう一本、折れた。"]),
        ...say(["さんじゅうい——"], KEEPER),
        ...say(["三十で終わりです"], "ブルーノ"),
        ...say(["……どこで習ったんです"], "ブルーノ"),
        ...say(["折れた指を、開いた。", "手のひらに、灰が落ちた。"]),
        ...say(["東に、山の頂。塔の影が、雲を突いている。", "影の下に、灯が二つ。"]),
        ...say(["灯です。塔の下に、二つ"], "ブルーノ"),
        selfOn(),
        END,
      ],
    },
    { conditions: { switch1Id: SW.bellPrison, switch1Valid: true, selfSwitchCh: "A", selfSwitchValid: true }, priorityType: 0 },
  ],
};

const keepEvents = [
  opening, // 1
  shanoHide, // 2（SHANO_HIDE_ID）
  shanoSeat, // 3
  hearth,
  writing,
  footprints([12, 19]),
  footprints([12, 20]),
  { name: "外の霧の森へ（外門への階段）", type: "transfer", at: "<", to: [FOREST.mapId, FOREST.x, FOREST.y, "down"] },
  { name: "城壁へ上る階段", type: "transfer", at: ">", to: [RAMPART.mapId, RAMPART.x, RAMPART.y, "right"] },
  // 墓所
  text("小さな鈴", [6, 19], ["小さな真鍮の鈴。", "結んであった紐が、途中で切れている。"], { image: { tileId: "E:121" } }),
  text("外套掛け", [3, 13], ["壁の木釘。外套を掛けておく所だ。", "釘には何も掛かっていない。"]),
  thought("K01", "婚礼の歌を覚えたい父親", [11, 21], ["娘の婚礼の歌を、まだ半分しか覚えていない。", "墓守さん、続きを聞いといてくれ。"]),
  faint("F01", "墓所の番の老人", [4, 23], [
    "棺の前に、墓守がしゃがんで耳を寄せている。",
    "わしには何も聞こえん。いつものことだ。",
    "やがて墓守は立ち上がり、",
    "壁の釘から外套を取った。",
    "「町まで行ってくる」と言うので、",
    "灯を一つ持たせた。",
  ]),
  faint("F07", "小間使いの子", [11, 13], [
    "壁に背中をつけて、まっすぐ立つ。",
    "墓守が刃物で、あたしの頭の上に刻みを入れる。",
    "「去年より、指二本ぶん」",
    "墓守は、自分のぶんは刻まない。ずるい。",
  ]),
  text("割れた棺", [11, 24], ["蓋の割れた棺。中は空で、底に乾いた花びらが貼りついている。"]),
  // 中庭
  text("騎士長の触れ書き", [22, 13], [
    ["壁の触れ書き。騎士長の印がある。", "「夜、戸を叩かれても開けぬこと。名を呼ばれても答えぬこと。」", "「当番の者、灯を倍に。油は倉から。」"],
    ["下の余白に、別の手で一行。", "「油、もう無い」"],
  ]),
  // 灯は鳴らした鐘の数＋一（W12 の 116 の東の眺めと同じ数え方。W15 #231）
  {
    name: "崩れた壁の隙間", type: "raw", x: 33, y: 13,
    pages: [
      { priorityType: 1, list: [...say(["崩れた壁の隙間から、東の空が見える。", "雲の上に、塔の影が一つ。山の頂だ。", "塔の影の下に、灯は無い。"]), END] },
      { conditions: { variableId: VAR.bells, variableValid: true, variableValue: 1 }, priorityType: 1,
        list: lampsByBells(n => say(["崩れた壁の隙間から、東の空が見える。", "雲の上に、塔の影が一つ。山の頂だ。", `塔の影の下に、灯が${n}。`], "", 1)) },
    ],
  },
  // 井戸：地下水道の側（105 井戸の縦穴。W9 #157）で綱を下ろすと（スイッチ 508）、綱を下りて近道できる
  {
    name: "井戸", type: "raw", x: 29, y: 19,
    pages: [
      { image: { tileId: "B:31" }, priorityType: 1, list: [...say(["石を組んだ井戸。覗くと、底は暗い。水の音はしない。", "縁の石に、綱でこすれた溝が何本もある。"]), END] },
      {
        conditions: { switch1Id: 508, switch1Valid: true }, image: { tileId: "B:31" }, priorityType: 1,
        list: [
          ...say(["井戸の滑車から、綱がまっすぐ底まで下りている。"]),
          cmd(102, [["綱を下りる", "やめる"], 1, 0, 2, 0]),
          cmd(402, [0, "綱を下りる"]), se("Move1", 1), cmd(201, [0, 105, 42, 5, 2, 0], 1), cmd(0, [], 1),
          cmd(402, [1, "やめる"]), cmd(0, [], 1),
          cmd(404, []),
          END,
        ],
      },
    ],
  },
  thought("K04", "水汲みの女", [28, 19], [
    "水を汲んでおいてって言われたの。桶に三杯。",
    "二杯目のとき、門の方で、",
    "誰かが「入れておくれ」って。",
    "三杯目、まだ汲んでない。",
  ]),
  text("灰に埋もれた骨", [21, 16], ["灰に半ば埋もれた骨。指の骨が、門の方を向いている。"]),
  // 門楼
  text("門の内側の凹み", P.gateDents, ["門の内側に、拳ほどの凹みが三つ。縦に並んでいる。"]),
  text("番の机", [27, 5], ["番の机。賽子が二つ、六の目を上にして置いてある。"]),
  // 名の壁
  text("名の壁", [39, 13], ["砦の兵の名が、石に彫ってある。", "上の方の名ほど字が深い。下の方は、刃物で急いで掻いたような字だ。"]),
  text("名の壁（騎士長の欄）", [42, 13], ["一番上に、騎士長の名。", "その下には、三つの国の字が混ざって並んでいる。"]),
  text("名の壁（墓守の欄）", [45, 13], [
    "壁の端に、「墓守」と彫った欄がある。",
    "名前の所だけ、石が削られている。",
    "削った跡に、また何か彫り、それもまた削ってある。刃の跡が重なって、もう読めない。",
  ]),
  ring,
  // 大広間
  text("空の鐘架", [22, 27], ["鐘を吊るす木の架。鐘は無い。", "切れた綱が、架の上から垂れている。"]),
  // 詰め所
  text("騎士長の命令書の束", [10, 31], [
    ["紐でくくった命令書の束。封蝋の色が三つある。", "教会の白「頂に足場を組む。石工を回せ。」", "王の青「兵の半数、西の村へ戻せ。」", "帝国の黒「古言兵の一隊、砦を通す。糧を出せ。」"],
    ["束の一番下に、騎士長の手で一行。", "「三つとも、今月中に。」"],
  ]),
  thought("K02", "灯の当番", [4, 32], ["報告。灯の油、残り二樽。", "触れのとおり倍に灯せば、もって五日。", "五日目の当番は自分だ。数え直しても、五日だ。"]),
  chest("詰め所の宝箱", [11, 29], 7, 2, "ポーション"),
  // 兵舎
  thought("K03", "残った兵", [46, 32], ["王国の兵だった。西へ戻る列に、自分の名は無かった。", "残った。残された、とは書かないでくれ。"]),
  text("寝台の下", [43, 30], ["寝台の下に、木彫りの小さな馬。脚が一本ない。"]),
  chest("兵舎の宝箱", [38, 33], 8, 1, "ハイポーション"),
  // 扉
  roomDoor("soul"),
  roomDoor("lore"),
  roomDoor("kitchen"),
  roomDoor("gate"),
  // 新しい 3 部屋（P13 #189。world.md 4.3：ピピネル・アンネリーゼ・グィドが来ると開く）
  roomDoor("infirmary"),
  roomDoor("smithy"),
  roomDoor("watch"),
  ironDoor,
  // W15（#231）：42–52（010 の 42–55 は W15 の割り当て。56– は W16・W17・W14）
  table, // 42
  bowl, // 43
  wolframFort, // 44
  afterRing, // 45
  brunoSeat, // 46
  margo, // 47
  ...pickers, // 48・49
  adeleSeat, // 50
  adeleLecture, // 51
  served, // 52
  // W17（#233）：砦の食卓の場面（台本 docs/story/scenes/03-region3-region4.md の 4・17・23）。ID 61–70（配り役の割り当て）
  ...fortTableEvents({
    zelina: [29, 28], // 炉から三つ目、壁の側の席（ヴォルフラムの先に盛る一椀の席。東の卓の椅子）
    tula: [30, 28], // ゼリナの隣
    beam: [29, 27], // 梁の下（W15 で梁の上のシャノを (30,26) にしたので、その脇）
    auto1: [18, 26], auto2: [19, 26], auto3: [20, 26], auto4: [33, 26], auto5: [33, 32], auto6: [32, 32], auto7: [18, 32], // 自動の場面（見えない）
  }).map(([id, e]) => ({ ...e, id })),
];
if (keepEvents[SHANO_HIDE_ID - 1] !== shanoHide) throw new Error("シャノ（柱の陰）の ID がずれた");
// 配られた番号に置く（tools/maps の "id"。ほかの子が 56– を足しても動かない）
[table, bowl, wolframFort, afterRing, brunoSeat, margo, ...pickers, adeleSeat, adeleLecture, served].forEach((e, i) => { e.id = 42 + i; });

// 置き物（.deco.txt の文字）。Dungeon_B＝B、Dungeon_C＝C、Inside_B＝D、Inside_C＝E（タイルセット 11）
const FORT_WALL = { name: "砦の壁（壁O（砦）。下が床なら側面、ほかは上面）", wall: { top: "A4:22", side: "A4:30", height: 2 } };
const FORT_FLOOR = { name: "石畳（石畳A）", tiles: ["A5:20"] };
const keepConfig = {
  _説明: "W6（#144）：黒鉄の砦・内郭（docs/world.md 3.4・4 章、docs/mapdesign.md）。墓所（西）で目覚め、中庭（真ん中）・大広間（炉）・名の壁（東）・門楼（北、外の霧の森へ）・城壁へ上る階段（北西、019）・南の廊下（営倉への鉄扉）。部屋の扉 7 つ（稽古場・書庫・食堂・倉、崩れた療養所・鍛冶場・見張り台）。この設定は node tools/maps/src/w6_data.mjs が書く。地図は w6_010_keep.txt と .deco.txt（手で書く）。",
  mapId: KEEP,
  name: "黒鉄の砦・内郭",
  displayName: "黒鉄の砦",
  legend: "dungeon",
  tilesetId: 11,
  bgm: { name: "Castle2", volume: 60, pitch: 100, pan: 0 },
  bgs: { name: "Wind1", volume: 25, pitch: 100, pan: 0 },
  note: "<hai_tone:-34,-34,-17,68>\n<hai_ash:2>",
  fields: { specifyBattleback: true, battleback1Name: "Stone2", battleback2Name: "Fort1" },
  chars: {
    "#": FORT_WALL,
    ".": FORT_FLOOR,
    ",": { name: "中庭の土（床C（岩洞窟））", tiles: ["A2:8"] },
    a: { name: "中庭の灰の吹きだまり（床の汚れを重ねる）", as: ",", tiles: [null, "A2:15"] },
    A: { name: "石畳の上の灰", as: ".", tiles: [null, "A2:15"] },
    c: { name: "大広間の赤い敷物（じゅうたんA）", as: ".", tiles: [null, "A2:19"] },
    C: { name: "墓所の紫の敷物（じゅうたんB）", as: ".", tiles: [null, "A2:27"] },
    p: { name: "名の壁の輪の台（石段）", as: ".", tiles: [null, "A2:30"] },
    S: { name: "目覚めの場所（開始位置）", as: "C" },
    "<": { name: "外門への階段（上り）", as: "A", tiles: [null, null, "B:18"] },
    ">": { name: "城壁へ上る階段（上り）", as: ".", tiles: [null, null, "B:18"] },
  },
  deco: {
    r: { name: "瓦礫", z2: "B:120" },
    R: { name: "苔の瓦礫", z2: "B:121" },
    u: { name: "折れた柱", z2: "B:113" },
    h: { name: "端材", z2: "B:125" },
    b: { name: "壊れたバリケード", z2: "B:126" },
    x: { name: "骸骨", z2: "B:242" },
    X: { name: "骸骨", z2: "B:250" },
    w: { name: "蜘蛛の巣（壁）", z2: "B:176" },
    k: { name: "壁の刻み（亀裂）", z2: "B:195" },
    m: { name: "壁の苔", z2: "B:1" },
    v: { name: "壁のツタ", z2: "B:184" },
    1: { name: "石版", z2: "B:177" },
    2: { name: "割れた石版", z2: "B:178" },
    Q: { name: "木箱", z2: "B:221" },
    q: { name: "壊れた木箱", z2: "B:222" },
    n: { name: "壊れた樽", z2: "B:239" },
    N: { name: "樽", z2: "D:212" },
    s: { name: "麻袋", z2: "D:248" },
    t: { name: "壊れた机", z2: "B:243" },
    y: { name: "壊れた椅子", z2: "B:251" },
    "+": { name: "机の上の命令書の束", z2: "B:243", z3: "E:72" },
    T: { name: "食卓（左）", z2: "D:112" },
    U: { name: "食卓（右）", z2: "D:113" },
    P: { name: "食卓（左）と皿", z2: "D:112", z3: "E:58" },
    o: { name: "食卓（右）と椀", z2: "D:113", z3: "E:62" },
    c: { name: "椅子", z2: "D:120" },
    f: { name: "破れた旗（上）", z2: "D:81" },
    F: { name: "破れた旗（下）", z2: "D:89" },
    e: { name: "崩れた壁", z2: "B:16" },
    Z: { name: "貼り紙（触れ書き）", z2: "D:216" },
    K: { name: "外套掛けの木釘（壁）", z2: "E:144" },
    9: { name: "壁の石の面（書き付け）", z2: "D:35" },
    i: { name: "兜", z2: "E:152" },
    "&": { name: "鎧のスタンド", z2: "E:160" },
    3: { name: "鉄くず", z2: "E:151" },
    4: { name: "水桶", z2: "E:150" },
    5: { name: "桶", z2: "D:211" },
    7: { name: "薪（端材）", z2: "D:220" },
  },
  stamps: [
    { at: "V", name: "棺（縦）", tiles: [["C:86"], ["C:94"]] },
    { at: "W", name: "棺（縦）", tiles: [["C:87"], ["C:95"]] },
    { at: "H", name: "棺（横）", tiles: [["C:78", "C:79"]] },
    { at: "J", name: "蓋の割れた棺（横）", tiles: [["C:102", "C:103"]] },
    { at: "O", name: "崩れた外壁の石の山（2×2）", tiles: [["B:202", "B:203"], ["B:210", "B:211"]] },
    { at: "M", name: "名の壁の大きな石碑（3×2）", tiles: [["B:66", "B:67", "B:68"], ["B:74", "B:75", "B:76"]] },
    { at: "G", name: "名の壁の輪（3×3）", tiles: [["C:80", "C:81", "C:82"], ["C:88", "C:89", "C:90"], ["C:96", "C:97", "C:98"]] },
    { at: "L", name: "大広間の炉（大きな暖炉 3×2）", tiles: [["D:189", "D:190", "D:191"], ["D:197", "D:198", "D:199"]] },
    { at: "I", name: "石の柱（1×2。上は☆）", tiles: [["B:97"], ["B:105"]] },
    { at: "!", name: "槍立て（1×2。空の鐘架の脚にも）", tiles: [["E:175"], ["E:183"]] },
    { at: "?", name: "剣立て（1×2）", tiles: [["E:174"], ["E:182"]] },
    { at: "Y", name: "粗末な寝台（1×2）", tiles: [["D:171"], ["D:179"]] },
    { at: "D", name: "朽ちた寝台（1×2）", tiles: [["D:174"], ["D:182"]] },
  ],
  scatter: [
    { on: ".", z: 1, tiles: ["A2:15"], rate: 0.05, seed: 1010 },
    { on: ".", tiles: ["B:32", "B:33"], rate: 0.07, seed: 1011 },
    { on: ",a", tiles: ["B:33", "B:33", "B:32"], rate: 0.14, seed: 1012 },
  ],
  events: keepEvents,
};
outputs.push({ file: srcPath("w6_010_keep"), text: sourceText(keepConfig) });

// ---------------------------------------------------------------------------
// 011–014 の部屋（17×13。南の出口 (8,12) → 010 の扉の前）
// ---------------------------------------------------------------------------
const roomBase = (key, name, extra) => ({
  mapId: ROOMS[key].mapId,
  name,
  parentId: KEEP,
  displayName: name,
  legend: "dungeon",
  tilesetId: 11,
  bgm: { name: "Castle2", volume: 60, pitch: 100, pan: 0 },
  note: "<hai_tone:-17,-26,-43,34>",
  fields: { specifyBattleback: true, battleback1Name: "Stone2", battleback2Name: "Room1" },
  ...extra,
});
const exitTo = key => {
  const [x, y] = front(P.doors[key]);
  return { name: "出口（黒鉄の砦へ）", type: "transfer", x: 8, y: 12, to: [KEEP, x, y, "down"] };
};
const useRoom = (key, name, [x, y], image) => ({
  name,
  type: "raw",
  x,
  y,
  pages: [{ ...(image ? { image } : {}), priorityType: 1, list: [...plugin("Hai_Facilities", "use", "部屋を使う", { facility: key }, 0, { facility: "部屋" }), END] }],
});
const roomChars = extra => ({ "#": FORT_WALL, ".": FORT_FLOOR, ...extra });
const roomScatter = seed => [
  { on: ".", z: 1, tiles: ["A2:15"], rate: 0.04, seed },
  { on: ".", tiles: ["B:32", "B:33"], rate: 0.05, seed: seed + 1 },
];

const ROOM_CONFIGS = {
  w6_011_drill: roomBase("soul", "稽古場", {
    _説明: "W6（#144）：稽古場（docs/world.md 4.3。アデルが来ると開く）。木人を調べると魂で仲間を育てる（Hai_Facilities の use soul）。剣の教官の薄い思念 F05。出口は南 (8,12) → 010 の稽古場の扉の前。この設定は w6_data.mjs が書く。",
    chars: roomChars({ s: { name: "稽古場の砂（床A（土洞窟））", tiles: ["A2:0"] } }),
    deco: {
      Z: { name: "貼り紙（稽古場の決まり）", z2: "D:91" },
      w: { name: "壁の剣", z2: "D:82" },
      W: { name: "壁の剣", z2: "D:83" },
      d: { name: "壁の盾", z2: "D:90" },
      "&": { name: "稽古の木人（鎧のスタンド）", z2: "E:161" },
      b: { name: "長椅子", z2: "D:208" },
      h: { name: "端材", z2: "D:220" },
      4: { name: "水桶", z2: "E:150" },
      n: { name: "壊れた樽", z2: "B:239" },
      N: { name: "樽", z2: "D:212" },
    },
    stamps: [
      { at: "!", name: "槍立て", tiles: [["E:175"], ["E:183"]] },
      { at: "?", name: "剣立て", tiles: [["E:174"], ["E:182"]] },
    ],
    scatter: roomScatter(1110),
    events: [
      exitTo("soul"),
      useRoom("soul", "稽古の木人", [8, 6]),
      text("稽古場の決まり", [4, 2], ["稽古場の決まり。", "「木剣は使ったら拭いて戻すこと。」", "「新兵は、朝の鐘の前に壁の内を三周。」", "その下に小さく「朝の鐘、去年から鳴らず。走る刻は各自」。"]),
      faint("F05", "剣の教官", [12, 9], [
        "稽古場の隅で、教官が木剣で肩を叩いている。",
        "「おまえ、俺が新兵だったころから、その顔だな」",
        "「何を食えばそうなる。隊の若いのに教えてやれ」",
        "墓守は答えずに、落ちていた木剣を拾って教官に返した。",
      ]),
    ],
  }),
  w6_012_mess: roomBase("kitchen", "食堂", {
    _説明: "W6（#144）：食堂（docs/world.md 4.3。ヴォルフラムが来ると開く。来なくても鍋だけ残る）。大鍋を調べると合成（Hai_Facilities の use kitchen）。古い勘定台に酒保の帳場の娘の薄い思念 F04。出口は南 (8,12) → 010 の食堂の扉の前。この設定は w6_data.mjs が書く。",
    chars: roomChars({}),
    deco: {
      K: { name: "かまど", z2: "D:200" },
      N: { name: "流し", z2: "D:201" },
      P: { name: "調理台", z2: "D:202" },
      Q: { name: "調理台", z2: "D:203" },
      k: { name: "かまどの上の大鍋", z2: "D:200", z3: "E:63" },
      y: { name: "食器棚（上）", z2: "D:140" },
      Y: { name: "食器棚（下）", z2: "D:148" },
      m: { name: "吊るし肉の鉤（壁）", z2: "E:137" },
      s: { name: "麻袋", z2: "D:248" },
      "+": { name: "古い勘定台と帳面", z2: "B:243", z3: "E:68" },
      T: { name: "食卓（左）", z2: "D:112" },
      U: { name: "食卓（右）", z2: "D:113" },
      L: { name: "食卓（左）と皿", z2: "D:112", z3: "E:58" },
      o: { name: "食卓（右）と椀", z2: "D:113", z3: "E:62" },
      c: { name: "椅子", z2: "D:120" },
      n: { name: "樽", z2: "D:212" },
    },
    scatter: roomScatter(1210),
    events: [
      exitTo("kitchen"),
      // 合成の画面の前に二行（W15 #231。第二章の「同じ字」の種）
      {
        name: "大鍋", type: "raw", x: 8, y: 3,
        pages: [{ priorityType: 1, list: [
          ...say(["かまどの大鍋。", "底に、煤で大きく「わし」。"]),
          ...plugin("Hai_Facilities", "use", "部屋を使う", { facility: "kitchen" }, 0, { facility: "部屋" }),
          END,
        ] }],
      },
      faint("F04", "酒保の帳場の娘", [13, 5], [
        "帳面を開くと、一番上は今月も墓守のつけだ。",
        "銀三枚。先月も、その前の月も、銀三枚。",
        "「いつ払うの」と聞くと、墓守は棚の干し肉を一本、勝手に足した。",
        "これで銀三枚と、干し肉一本。",
      ]),
      text("食器棚", [11, 3], ["食器棚。欠けた椀が、数を揃えて重ねてある。"]),
    ],
  }),
  w6_013_store: roomBase("gate", "倉", {
    _説明: "W6（#144）：倉（docs/world.md 4.3。シャノが来ると開く）。札の下がった棚を調べると倉庫の出し入れ（Hai_Facilities の use gate）。出口は南 (8,12) → 010 の倉の扉の前。この設定は w6_data.mjs が書く。",
    chars: roomChars({}),
    deco: {
      Q: { name: "木箱", z2: "D:224" },
      q: { name: "壊れた木箱", z2: "D:228" },
      X: { name: "大きな木箱", z2: "D:243" },
      s: { name: "麻袋", z2: "D:248" },
      S: { name: "麻袋", z2: "D:249" },
      N: { name: "樽", z2: "D:212" },
      n: { name: "壊れた樽", z2: "D:237" },
    },
    stamps: [
      { at: "u", name: "雑貨棚", tiles: [["D:153"], ["D:161"]] },
      { at: "v", name: "雑貨棚", tiles: [["D:154"], ["D:162"]] },
      { at: "w", name: "雑貨棚", tiles: [["D:155"], ["D:163"]] },
      { at: "x", name: "札の下がった棚（パン棚）", tiles: [["D:152"], ["D:160"]] },
      { at: "Y", name: "むしろの寝床", tiles: [["D:173"], ["D:181"]] },
    ],
    scatter: roomScatter(1310),
    events: [
      exitTo("gate"),
      useRoom("gate", "札の下がった棚", [8, 3]),
      text("絵の札", [6, 3], ["棚ごとに、木の札が下がっている。", "字ではなく、鍋や靴や縄の絵が、炭で描いてある。"]),
      text("むしろ", [14, 7], ["積んだ木箱のそばに、むしろが一枚。", "乾いた藁の匂い。床から一番遠い隅だ。"]),
    ],
  }),
  w6_014_archive: roomBase("lore", "書庫", {
    _説明: "W6（#144）：書庫（docs/world.md 4.3。イスメネが来ると開く）。書見台を調べると倒したボスと読んだ思念（Hai_Facilities の use lore）。出口は南 (8,12) → 010 の書庫の扉の前。この設定は w6_data.mjs が書く。",
    chars: roomChars({}),
    deco: {
      b: { name: "積んだ本", z2: "E:64" },
      e: { name: "巻物", z2: "E:82" },
      f: { name: "目録の写し", z2: "E:72" },
      d: { name: "書見台（机と開いた本）", z2: "D:116", z3: "E:68" },
      c: { name: "椅子", z2: "D:120" },
    },
    stamps: [
      { at: "u", name: "本棚", tiles: [["D:157"], ["D:165"]] },
      { at: "v", name: "本棚", tiles: [["D:158"], ["D:166"]] },
      { at: "w", name: "本棚", tiles: [["D:159"], ["D:167"]] },
      { at: "x", name: "倒れた棚", tiles: [["D:175"], ["D:183"]] },
    ],
    scatter: roomScatter(1410),
    events: [
      exitTo("lore"),
      useRoom("lore", "書見台", [9, 6]),
      text("湿った本", [4, 3], ["棚の本は、湿気で一つの塊になっている。背の字は読めない。"]),
      text("目録の写し", [13, 9], ["書庫の目録の写し。棚の番号と、本の名。", "途中から、本の名の代わりに「濡れて読めず」が続く。"]),
    ],
  }),
};
// ---------------------------------------------------------------------------
// 019 城壁の上（45×15。docs/world.md 4.1・5.2。凡例 rampart・タイルセット 21、docs/look.md 3 章の 018・019）
//   西の端の下り階段 → 010。見張り台の扉（018 は後回し）。南の胸壁の東門（古道の側から開ける近道。開いたら W10 が 054 への場所移動を足す）。
//   東の塔の頂への門（四つの鐘が鳴るまで通れない。開いたら W11 が 015 への場所移動を足す）
// ---------------------------------------------------------------------------
const RAMPART_FROM_KEEP = [6, 4]; // 010 の城壁へ上る階段（6,3）の前
const rampartConfig = {
  _説明: "W6（#144）：城壁の上（docs/world.md 4.1・4.2・5.2）。西の下り階段 → 010、見張り台の扉（崩れている。018 は後回し）、南の胸壁の東門（外から閂。開けるのは W10 の 054 の側）、東の塔の頂への門（四つの鐘が鳴るまで灰で押し戻される。015 は W11）。この設定は node tools/maps/src/w6_data.mjs が書く。",
  mapId: 19,
  name: "城壁の上",
  parentId: KEEP,
  displayName: "黒鉄の砦・城壁の上",
  legend: "rampart",
  tilesetId: 21,
  bgm: { name: "Castle2", volume: 55, pitch: 100, pan: 0 },
  bgs: { name: "Wind4", volume: 40, pitch: 100, pan: 0 },
  note: "<hai_tone:-34,-34,-17,85>\n<hai_parallax:DarkClouds,1,0>\n<hai_ash:3>",
  fields: { specifyBattleback: true, battleback1Name: "Fort2", battleback2Name: "Fort2" },
  chars: {
    "<": { name: "下り階段（010 へ）", as: ".", tiles: [null, null, "D:26"] },
  },
  deco: {
    a: { name: "鎧の亡骸（鎧のスタンド）", z2: "E:160" },
    x: { name: "骸骨", z2: "D:242" },
    r: { name: "瓦礫", z2: "D:120" },
    p: { name: "倒れた槍立て", z2: "E:183" },
    f: { name: "烽火の跡（石のかまど）", z2: "B:147" },
    b: { name: "壊れた像（胸壁の上）", z2: "D:91" },
  },
  scatter: [
    { on: ".", z: 1, tiles: ["A2:15"], rate: 0.12, seed: 1910 },
    { on: ".", tiles: ["D:32", "D:33"], rate: 0.06, seed: 1911 },
  ],
  events: [
    { name: "砦の中へ（下り階段）", type: "transfer", at: "<", to: [KEEP, ...RAMPART_FROM_KEEP, "down"] },
    roomDoor("watch", [16, 6]), // 城壁の上からも見張り台へ（P13。出口は 010 の見張り台の扉の前）
    {
      name: "東門",
      type: "raw",
      x: 30,
      y: 10,
      pages: [
        { image: { characterName: "!$Gate1", characterIndex: 0, direction: DOWN, pattern: 1 }, priorityType: 1, walkAnime: false,
          list: [...say(["外へ下りる門。外から閂が掛かっていて、内からは動かない。", "門の下の隙間から、灰をかぶった山道が見える。"]), END] },
        // 閂が外れたら、触れると城壁の東門の外（054。W10 #156）へ
        { conditions: { switch1Id: SW.eastGate, switch1Valid: true }, image: { characterName: "!$Gate1", characterIndex: 0, direction: UP, pattern: 1 }, priorityType: 1, trigger: 1, walkAnime: false,
          list: [se("Move1"), cmd(201, [0, 54, 20, 6, DOWN, 0]), END] },
      ],
    },
    {
      name: "頂への門",
      type: "raw",
      x: 41,
      y: 6,
      pages: [
        { image: { characterName: "!$Gate1", characterIndex: 0, direction: DOWN, pattern: 1 }, priorityType: 1, walkAnime: false,
          list: [...say(["大きな門。押すと、隙間から灰が流れこんでくる。", "門の向こうは灰と霧で、一歩先も見えない。"]), END] },
        // W11（#191）：開くのは最後の地域の山場を越えて 4 つ目の鐘を鳴らしたとき（スイッチ 109。084・094・104 の霧の戸口が立てる）。行き先 180 は W14
        { conditions: { switch1Id: SW.summitGate, switch1Valid: true }, image: { characterName: "!$Gate1", characterIndex: 0, direction: UP, pattern: 1 }, priorityType: 1, walkAnime: false,
          list: [...say(["門の向こうの灰が引いている。山道が上へ続いている。"]), END] },
      ],
    },
    {
      name: "東の眺め", type: "raw", x: 43, y: 8,
      pages: [
        { priorityType: 1, list: [...say(["東に、山の頂。塔の影が雲を突いている。", "灰は、そちらから降ってくる。"]), END] },
        // 鳴らした鐘の数＋一の灯（W15 #231。010 の崩れた壁の隙間と同じ）
        { conditions: { variableId: VAR.bells, variableValid: true, variableValue: 1 }, priorityType: 1,
          list: lampsByBells(n => say(["東に、山の頂。塔の影が雲を突いている。", `影の下に、灯が${n}。`, "灰は、そちらから降ってくる。"], "", 1)) },
      ],
    },
    eveningCount,
    thought("K05", "城壁の見張り", [24, 8], ["見張り、異常なし。灰、いつもより多し。", "頂の鐘、今夜も聞こえず。報告は朝にまとめる。"]),
    chest("城壁の宝箱", [42, 9], 7, 1, "ポーション"),
  ],
};
outputs.push({ file: srcPath("w6_019_rampart"), text: sourceText(rampartConfig) });

for (const [name, cfg] of Object.entries(ROOM_CONFIGS)) outputs.push({ file: srcPath(name), text: sourceText(cfg) });

// ---------------------------------------------------------------------------
// System.json：旗の名前と開始位置
// ---------------------------------------------------------------------------
const W6_BAND = id => (id >= 101 && id <= 120) || (id >= 171 && id <= 200);
const sysFile = dataPath("System.json");
const system = JSON.parse(fs.readFileSync(sysFile, "utf8"));
while (system.switches.length <= 200) system.switches.push("");
while (system.variables.length <= 200) system.variables.push("");
for (let id = 101; id <= 200; id++) {
  if (!W6_BAND(id)) continue;
  system.switches[id] = SWITCH_NAMES[id] ?? "";
}
for (const [id, name] of Object.entries(VARIABLE_NAMES)) system.variables[id] = name;
system.startMapId = KEEP;
[system.startX, system.startY] = P.start;
outputs.push({ file: sysFile, text: JSON.stringify(system) });

// ---------------------------------------------------------------------------
// CommonEvents 201：記憶が戻ったときの一言（docs/world.md 3.5）
//   薄い思念（<hai_faint>）のイベントの最後から呼ぶ。初めて見たとき（そのイベントのセルフスイッチ A が OFF）だけ、
//   戻った記憶の数（変数 138。この思念の分はまだ数えていない）で一言を変える。1 つ目・4 つ目と、7 つ目から先で名前が戻っていない間（スイッチ 110 OFF）。
//   薄い思念は 11 ＋相棒の司祭（world.md 6.5。P13 #189）。司祭（<hai_faint:F12>。W11）は 201 を呼ばない（一言は text.md 5.5 の e のあとに W11 が書く）。
// ---------------------------------------------------------------------------
const commons = readData("CommonEvents.json");
const emptyCommon = id => ({ id, list: [END], name: "", switchId: 1, trigger: 0 });
extendTable(commons, COMMON.memoryLine, emptyCommon);
commons[COMMON.memoryLine] = {
  id: COMMON.memoryLine,
  name: "W6_記憶が戻ったときの一言",
  switchId: 1,
  trigger: 0,
  list: [
    cmd(111, [2, "A", 1]),
    cmd(111, [1, VAR.faint, 0, 0, 0], 1),
    ...say(["……覚えている。この人の葬式を出した"], "\\N[1]", 2),
    cmd(0, [], 2),
    cmd(412, [], 1),
    cmd(111, [1, VAR.faint, 0, 3, 0], 1),
    ...say(["墓守の帳面。全部、同じ手だ"], "\\N[1]", 2),
    cmd(0, [], 2),
    cmd(412, [], 1),
    // 7 つ目から先は数ではなく「名前が戻っていない間」（スイッチ 110 OFF。P13 #189・text.md 7-11）
    cmd(111, [1, VAR.faint, 0, 6, 1], 1),
    cmd(111, [0, SW.nameBack, 1], 2),
    ...say(["名前のところだけ、思い出せない。"], "", 3),
    cmd(0, [], 3),
    cmd(412, [], 2),
    cmd(0, [], 2),
    cmd(412, [], 1),
    cmd(0, [], 1),
    cmd(412, []),
    END,
  ],
};
outputs.push({ file: dataPath("CommonEvents.json"), text: formatTable(commons) });

// ---------------------------------------------------------------------------
// MapInfos.json：010–014 の名前（エディタの一覧）
// ---------------------------------------------------------------------------
const infos = readData("MapInfos.json");
const MAP_NAMES = { 10: keepConfig.name, 11: "稽古場", 12: "食堂", 13: "倉", 14: "書庫", 19: rampartConfig.name };
for (const [id, name] of Object.entries(MAP_NAMES)) if (infos[id]) infos[id].name = name;
outputs.push({ file: dataPath("MapInfos.json"), text: formatTable(infos) });

// ---------------------------------------------------------------------------
let stale = 0;
for (const { file, text: body } of outputs) {
  const rel = path.relative(ROOT, file);
  const current = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
  if (check) {
    if (current !== body) {
      console.error(`古い: ${rel}（node tools/maps/src/w6_data.mjs で書き直す）`);
      stale++;
    } else console.log(`一致: ${rel}`);
  } else {
    fs.writeFileSync(file, body);
    console.log(`${current === body ? "変化なし" : "書き出し"}: ${rel}`);
  }
}
if (stale) process.exit(1);
