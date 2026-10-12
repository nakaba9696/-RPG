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

const check = process.argv.includes("--check");
const outputs = []; // [{ file, text }]
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

// ---------------------------------------------------------------------------
// イベントの命令の部品
// ---------------------------------------------------------------------------
const cmd = (code, parameters, indent = 0) => ({ code, indent, parameters });
const END = cmd(0, []);
const say = (lines, speaker = "", indent = 0) => [cmd(101, ["", 0, 0, 2, speaker], indent), ...lines.map(l => cmd(401, [l], indent))];
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
  rubbleDoor: { characterName: "!Door1", characterIndex: 0, direction: DOWN, pattern: 0 }, // 板の扉（崩れて塞がっている）
  ironShut: { characterName: "!Door1", characterIndex: 0, direction: DOWN, pattern: 2 }, // 鉄の扉
  ironOpen: { characterName: "!Door1", characterIndex: 0, direction: UP, pattern: 2 },
  chest: { characterName: "!Chest", characterIndex: 0, direction: DOWN, pattern: 0 },
  chestOpen: { characterName: "!Chest", characterIndex: 0, direction: UP, pattern: 0 },
};

// ---------------------------------------------------------------------------
// 旗（docs/world.md 4.4。W6 の帯）
// ---------------------------------------------------------------------------
const SW = {
  bellPrison: 101, bellArchive: 102, bellWater: 103, bellFoundry: 104, bellsAll: 105,
  thirdScene: 106, metMirlene: 107, lastClimax: 108, summitGate: 109, nameBack: 110,
  woke: 111, hearth: 112, nameWall: 113, ironDoor: 114,
  facility: { soul: 121, kitchen: 122, gate: 123, lore: 124 }, // P8 の旗（読むだけ）
  writing: 171, shano: 172, footprints: 173, eastGate: 174,
};
const VAR = { bells: 101, companions: 102, survivors: 103, faint: 138 };
const SWITCH_NAMES = {
  101: "鐘:営倉", 102: "鐘:記録院", 103: "鐘:水底", 104: "鐘:鋳物場", 105: "鐘:四つ鳴った",
  106: "3つ目の鐘の場面", 107: "ミルレーネに会った", 108: "最後の地域の山場", 109: "頂への門:開", 110: "名前が戻った",
  111: "目覚めた", 112: "炉に火を入れた", 113: "名の壁を調べた", 114: "営倉の鉄扉:開",
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
  shanoSeat: [22, 30], // 食卓
  gateDents: [24, 1], // 外門への階段の脇の壁
  ironDoor: [25, 36], // 南の廊下の鉄扉
  doors: { soul: [40, 8], lore: [33, 8], kitchen: [5, 36], gate: [10, 36] },
  shut: { infirmary: [44, 8], smithy: [42, 36], watch: [17, 8] },
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
  ],
};

const shanoSeat = {
  name: "シャノ（食卓）",
  type: "raw",
  x: P.shanoSeat[0],
  y: P.shanoSeat[1],
  pages: [
    { priorityType: 0 },
    {
      conditions: { switch1Id: SW.shano, switch1Valid: true },
      image: { ...IMG.shano, direction: UP },
      priorityType: 1,
      list: [
        cmd(111, [1, VAR.companions, 0, 1, 1]),
        ...say(["……また誰かと話してた？　ま、いいけど"], "シャノ", 1),
        cmd(0, [], 1),
        cmd(412, []),
        ...say(["見てた？　さっき梁の上まで登った。鉄の留め金、三つ取れた"], "シャノ"),
        ...say(["地下の牢の鐘、外して持ってったら、頭に褒められる。……たぶん"], "シャノ"),
        END,
      ],
    },
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
const shanoScene = indent => [
  cmd(230, [15], indent),
  ...moveRoute(SHANO_HIDE_ID, shanoWalk).map(c => ({ ...c, indent })),
  ...say(["……火、つけたの、あんた？"], "シャノ", indent),
  ...say(["おれ、鉄を拾いに来ただけ。鈴、蹴っちゃった。ごめん"], "シャノ", indent),
  cmd(111, [12, "Hai.Thoughts.isRead('K01')"], indent),
  ...say(["さっき誰と話してたの？　……ま、いいや"], "シャノ", indent + 1),
  cmd(0, [], indent + 1),
  cmd(412, [], indent),
  ...say(["頭に言われてんだ。砦の地下の牢の鐘、外して持ってこいって"], "シャノ", indent),
  ...say(["でも鉄の扉が開かない。あと、森の霧で炊き出しの爺さんが三日帰ってない"], "シャノ", indent),
  ...say(["おれは霧、だめなんだ。……ここ、ちょっといていい？"], "シャノ", indent),
  ...plugin("Hai_Facilities", "open", "部屋を開く", { facility: "gate" }, indent, { facility: "部屋" }),
  cmd(122, [VAR.survivors, VAR.survivors, 1, 0, 1], indent),
  ...addNote("shano:bell", "鐘：砦の地下の牢（シャノ）", indent),
  ...addNote("shano:cook", "炊き出しの爺さん：外の森の霧（シャノ）", indent),
  ...say([memo("鐘：砦の地下の牢（シャノ）"), memo("炊き出しの爺さん：外の森の霧（シャノ）")], "", indent),
  switchOn(SW.shano, indent),
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
        ...say(["炉は冷えている。灰の下に、乾いた薪が残っている。"]),
        cmd(102, [["火を入れる", "やめる"], 1, 0, 2, 0]),
        cmd(402, [0, "火を入れる"]),
        se("Fire1", 1),
        switchOn(SW.hearth, 1),
        ...plugin("Hai_Defeat", "setHome", "拠点を設定", { mapId: "0", x: String(P.home[0]), y: String(P.home[1]), direction: String(UP) }, 1,
          { mapId: "マップ ID", x: "X", y: "Y", direction: "向き" }),
        cmd(230, [10], 1),
        ...say(["炉に火が入った。煤けた壁が、赤く照らされる。"], "", 1),
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

const writing = {
  name: "墓所の壁の書き付け",
  type: "raw",
  x: 7,
  y: 13,
  pages: [
    {
      list: [
        ...say(["壁に、刃物で刻んだ字がある。", "「四つの鐘を鳴らして。それから、山の頂の鐘楼へ」", "最後の一画が、途中で止まっている。"]),
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
};
const roomDoor = key => {
  const [x, y] = P.doors[key];
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
// 新しい 3 部屋（療養所・鍛冶場・見張り台）は扉だけ（world.md 4.3。開く仕組みは P の後の issue）
const shutDoor = (name, [x, y]) => ({
  name: `${name}の扉（崩れている）`,
  type: "raw",
  x,
  y,
  pages: [{ image: IMG.rubbleDoor, priorityType: 1, walkAnime: false, list: [...say(["扉が崩れて、瓦礫で塞がっている。"]), END] }],
});

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
  text("小さな鈴", [6, 19], ["小さな真鍮の鈴。結んであった紐が、途中で切れている。"], { image: { tileId: "E:121" } }),
  text("外套掛け", [3, 13], ["壁の木釘。外套を掛けておく所だ。", "釘には何も掛かっていない。"]),
  thought("K01", "婚礼の歌を覚えたい父親", [11, 21], ["娘の婚礼の歌を、まだ半分しか覚えていない。", "墓守さん、続きを聞いといてくれ。"]),
  faint("F01", "墓所の番の老人", [4, 23], [
    "棺の前に、墓守がしゃがんで耳を寄せている。",
    "わしには何も聞こえん。いつものことだ。",
    "やがて墓守は立ち上がり、壁の釘から外套を取った。",
    "「町まで行ってくる」と言うので、灯を一つ持たせた。",
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
  text("崩れた壁の隙間", [33, 13], ["崩れた壁の隙間から、東の空が見える。", "雲の上に、塔の影が一つ。山の頂だ。"]),
  text("井戸", [29, 19], ["石を組んだ井戸。覗くと、底は暗い。水の音はしない。", "縁の石に、綱でこすれた溝が何本もある。"], { image: { tileId: "B:31" } }),
  thought("K04", "水汲みの女", [28, 19], [
    "水を汲んでおいてって言われたの。桶に三杯。",
    "二杯目のとき、門の方で、誰かが「入れておくれ」って。",
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
  shutDoor("療養所", P.shut.infirmary),
  shutDoor("鍛冶場", P.shut.smithy),
  shutDoor("見張り台", P.shut.watch),
  ironDoor,
];
if (keepEvents[SHANO_HIDE_ID - 1] !== shanoHide) throw new Error("シャノ（柱の陰）の ID がずれた");

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
      useRoom("kitchen", "大鍋", [8, 3]),
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
    shutDoor("見張り台", [16, 6]),
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
        { conditions: { switch1Id: SW.bellsAll, switch1Valid: true }, image: { characterName: "!$Gate1", characterIndex: 0, direction: UP, pattern: 1 }, priorityType: 1, walkAnime: false,
          list: [...say(["門の向こうの灰が引いている。山道が上へ続いている。"]), END] },
      ],
    },
    text("東の眺め", [43, 8], ["東に、山の頂。塔の影が雲を突いている。", "灰は、そちらから降ってくる。"]),
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
//   戻った記憶の数（変数 138。この思念の分はまだ数えていない）で一言を変える。1 つ目・4 つ目・7 つ目だけ。
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
    cmd(111, [1, VAR.faint, 0, 6, 0], 1),
    ...say(["名前のところだけ、思い出せない。"], "", 2),
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
