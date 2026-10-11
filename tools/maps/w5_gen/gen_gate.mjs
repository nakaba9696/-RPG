// 015 王都の門と結末 B、第1・第2段階のマップへの追加（010・027・035・051・073）
import fs from "node:fs";
import path from "node:path";
import { Grid, writeMap, readSrc, writeSrc, SRC, list, msg, IF, choice, SE, SW, SELF, MOVE, TONE, WAIT, SCRIPT, raw, transfer, warp, DOWN, LEFT, RIGHT, UP } from "./lib.mjs";

const C = name => ({ name }); // 話し手の名前
const CELES = { name: "セレス" };
const YUEL = { name: "\\N[1]" };
const say = (who, line) => msg([line], who);
const nar = line => msg([line]);

// ===========================================================================
// 015 王都の門（結界の前）（27×20、外観）
// ===========================================================================
const g = new Grid(27, 20, "=");
g.rect(6, 5, 20, 13, ".");            // 門前の広場
g.rect(12, 14, 14, 16, ".");          // 南の螺旋階段の出口
g.set(13, 16, "<");
g.rect(12, 4, 14, 4, ".");            // 白い結界の門（イベント）
g.rect(12, 8, 14, 9, "~");            // 崩れた噴水
g.set(11, 9, "x").set(15, 8, "x");
g.set(10, 5, "P").set(10, 6, "p").set(16, 5, "P").set(16, 6, "p");
g.set(6, 12, "x").set(19, 6, "x").set(7, 5, "x");
for (const [x, y] of [[8, 7], [9, 7], [17, 10], [18, 11], [7, 10], [13, 12], [14, 11], [9, 12], [19, 9], [12, 6], [15, 13]]) g.set(x, y, ",");
console.log("015\n" + g.show());

// 15.4 門の前の場面（オーブ 4 つ）と 15.5 結末 B。セレスに話しかけても、門に近づいても同じ
const ending = [
  SW(182),
  nar("ユエルが門に手を当てる。胸の錠の印が、熱を持つ。"),
  say(YUEL, "……開けるぞ"),
  SE("Saint5", 90, 80),
  TONE([34, 34, 34, 0], 90),
  nar("白い光がほどけ、門が内側へ開く。灰色の街並みが、眠ったように静かに続いている。"),
  say(CELES, "……ありがとう、\\N[1]"),
  nar("家々の窓から、白い灰が立ちのぼる。音もなく、空へ吸われていく。"),
  say(YUEL, "これが、俺の払うものか"),
  say(CELES, "あなたが払うのは、最後の一粒だけ。残りは、あの日あなたと王が払ったの"),
  TONE([85, 85, 85, 0], 90),
  nar("ユエルの指の先が、白くなっていく。"),
  say(YUEL, "セレス。外の灰は、本当に止まるのか"),
  say(CELES, "契約は嘘をつかない。……私と違ってね"),
  say(YUEL, "……そうか。なら、いい"),
  TONE([255, 255, 255, 0], 120),
  nar("画面が白くなる。"),
  [221, []],
  TONE([0, 0, 0, 0], 1),
  ...[
    "──灰が、降りやんだ。",
    "湿地の舟の上で、魚人の子どもが空に手をかざした。指に何も積もらない。",
    "焼けた谷で、獣人の女が畑の灰を払い、種を蒔いた。",
    "牢獄の間の灰の泉は、今日も湧いている。汲む者はいない。",
    "王都の門は開いたまま。中には、もう誰もいない。",
  ].map(line => msg([line], { bg: 2, pos: 1 })),
  WAIT(60),
  msg(["　　　　　　　　　　　　　　　　　　　　灰の履行"], { bg: 2, pos: 1 }),
  WAIT(120),
  [354, []],
];
const notYet = [say(CELES, "いいわ。待つのは慣れてる")];
const gateScene = [
  IF([0, 501, 1], [
    say(CELES, "おかえりなさい、\\N[1]。……全部、思い出した？"),
    say(YUEL, "ああ。お前が誰なのかも"),
    say(CELES, "そう。じゃあ、もう隠すことはないわね"),
    say(CELES, "門を開ければ、契約は果たされる。中の民の魂は、灰としていただく"),
    say(CELES, "その代わり、取り立てはそこで終わり。外に残った者は、もう灰にならない"),
    say(CELES, "そして私は自由になる。何百年ぶりかしら"),
    say(YUEL, "……俺は"),
    SW(501),
  ]),
  say(CELES, "あなたも灰に還る。完全な魂で門をくぐるのだもの。契約した者の分も、払ってもらうわ"),
  say(CELES, "選んで。開けるか、開けないか"),
  choice(["門を開ける", "まだ開けない"], 1, [[
    msg(["本当に開けますか？（もう戻れません）"]),
    choice(["はい", "いいえ"], 1, [ending, notYet]),
  ], notYet]),
];
// 門に近づいた：オーブ 4 つなら 15.4、3 つなら押し戻される（初めてだけ 15.3）
const pushed = [
  [224, [[255, 255, 255, 170], 30, false]],
  SE("Saint3", 80, 120),
];
const gateTouch = list([
  IF([0, 105, 0], gateScene, [
    ...pushed,
    IF([0, 115, 1], [
      nar("門に近づくと、白い光が強くなる。体が押し戻される。"),
      say(YUEL, "……入れない"),
      say(CELES, "まだ、ね。足りないものがあるの、分かってるでしょう"),
      say(CELES, "あと一つ。持って帰ってきたら、ここで待ってる"),
      SW(115),
    ], [
      nar("白い光に押し戻された。"),
    ]),
    [205, [-1, { list: [{ code: 13, parameters: [] }, { code: 0, parameters: [] }], repeat: false, skippable: true, wait: true }]],
    [505, [{ code: 13, parameters: [] }]],
  ]),
]);
const gateEvent = (x, name, image) => raw(x, 4, name, [{ ...(image ? { image } : {}), priorityType: 1, trigger: 1, directionFix: true, walkAnime: false, list: gateTouch }]);

writeMap("w5_015_royal_gate", g, {
  _説明: "W5：王都の門（結界の前）（docs/world2.md 15 章）。南の螺旋階段の出口（← 010 の塞がった螺旋階段。下り階段で 010 へ）→ 門前の広場（崩れた噴水、灰をかぶった石畳、結界＝灰の泉と記録の書見台）。北の真ん中の白い結界の門 (12..14,4)：近づくと、オーブ 3 つなら押し戻される（初めてだけ 15.3 とスイッチ 115）、4 つ（スイッチ 105）なら 15.4 の場面と選択肢。門の前のセレス（変数 101 が 3 以上）に話しかけても同じ。「門を開ける」→ 確かめ → 結末 B（15.5。スイッチ 182、タイトルへ）。場面を一度見たらスイッチ 501（2 回目からは最後の 2 行と選択肢だけ）。",
  mapId: 15, name: "王都の門", displayName: "王都の門", legend: "gate", tilesetId: 2,
  note: "<hai_tone:-34,-51,-34,102>\n<hai_parallax:DarkClouds,1,0>",
  fields: { specifyBattleback: true, battleback1Name: "Cobblestones1", battleback2Name: "Castle1" },
  chars: {},
  events: [
    transfer(13, 16, "螺旋階段（牢獄の間へ）", [10, 16, 18, "down"]),
    gateEvent(13, "白い結界の門", { characterName: "!$Gate1", characterIndex: 0, direction: 2 }),
    gateEvent(12, "白い結界の門（左）"),
    gateEvent(14, "白い結界の門（右）"),
    raw(11, 6, "セレス（門の前）", [
      { priorityType: 0 },
      { conditions: { variableId: 101, variableValid: true, variableValue: 3 }, image: { characterName: "People2", characterIndex: 1, direction: 2, pattern: 1 }, priorityType: 1,
        list: list([IF([0, 105, 0], gateScene, [say(CELES, "あと一つ。持って帰ってきたら、ここで待ってる")])]) },
    ]),
    warp(8, 11, "門前の結界（灰の泉の湧き水と記録の書見台）", "王都の門"),
  ],
});

// ===========================================================================
// 010 牢獄の間：塞がった螺旋階段（イベント 8。ID は変えない）
// ===========================================================================
{
  const j = readSrc("w1_010_prison_hall");
  const i = j.events.findIndex(e => e.name === "塞がった螺旋階段");
  if (i !== 7) throw new Error("010 の螺旋階段のイベントが 8 番でない");
  const old = j.events[i];
  j.events[i] = {
    name: "塞がった螺旋階段", type: "raw", x: old.x, y: old.y,
    pages: [{
      priorityType: 1,
      list: list([
        IF([1, 101, 0, 3, 1], [
          msg(["上の王都へ続く螺旋階段。", "白い光が薄れている。上れそうだ。"]),
          choice(["上る", "やめる"], 1, [[SE("Move1"), MOVE(15, 13, 15, UP)], []]),
        ], [
          msg(old.lines),
        ]),
      ]),
    }],
  };
  writeSrc("w1_010_prison_hall", j);
}

// ===========================================================================
// 027 廃坑・下層：H34 の表（採掘場の東の壁。末尾に足す）
// ===========================================================================
{
  const j = readSrc("w1_027_mine_lower");
  const name = "採掘場の東の壁（H34 の表）";
  j.events = j.events.filter(e => e.name !== name);
  j.events.push(raw(29, 16, name, [
    { priorityType: 0 },
    { conditions: { switch1Id: 163, switch1Valid: true }, image: { characterName: "!Door1", characterIndex: 6, direction: 8, pattern: 0 }, priorityType: 1, trigger: 1, walkAnime: false,
      list: list([SE("Move1"), MOVE(91, 32, 15, LEFT)]) },
  ]));
  writeSrc("w1_027_mine_lower", j);
}

// ===========================================================================
// 035 拷問の間：西の扉（看守長の鍵束 203 → 100 下水道）。壁に扉のマスを 1 つ開け、イベントを末尾に足す
// ===========================================================================
{
  const txt = path.join(SRC, "w1_035_torture_room.txt");
  const rows = fs.readFileSync(txt, "utf8").split("\n");
  rows[7] = rows[7].slice(0, 5) + "w" + rows[7].slice(6);
  fs.writeFileSync(txt, rows.join("\n"));
  const j = readSrc("w1_035_torture_room");
  j.chars.w = { name: "西の扉（イベント。看守長の鍵束）", as: "." };
  const name = "西の扉（看守長の鍵束。下水道へ）";
  j.events = j.events.filter(e => e.name !== name);
  const go = list([SW(160), SE("Move1"), MOVE(100, 41, 8, LEFT)]);
  // 鍵束は看守長のドロップなので、<hai_locked>（鍵をくれるイベントを検査が探す）ではなく、ページの条件「アイテム」で開ける
  const shut = { image: { characterName: "!Door1", characterIndex: 1, direction: 2 }, priorityType: 1, walkAnime: false };
  const open = { image: { characterName: "!Door1", characterIndex: 1, direction: 8 }, priorityType: 1, trigger: 1, walkAnime: false, list: go };
  j.events.push(raw(5, 7, name, [
    { ...shut, list: list([msg(["西の壁の鉄の扉。鍵がかかっている。", "錠の形が、監房の鍵とは違う。"])]) },
    { ...shut, conditions: { itemId: 203, itemValid: true }, list: list([
      msg(["鉄の扉。鍵がかかっている。"]),
      SE("Open1"), SELF("A"),
      msg(["看守長の鍵束の一本が、錠に合った。"]),
    ]) },
    { ...open, conditions: { selfSwitchCh: "A", selfSwitchValid: true } },
    { ...open, conditions: { switch1Id: 160, switch1Valid: true } },
  ]));
  writeSrc("w1_035_torture_room", j);
}

// ===========================================================================
// 051 帝国の陣跡：地下壕の奥の坑道（イベント 13。W3 の文章を場所移動に替える。ID は同じ）
// ===========================================================================
{
  const j = readSrc("w3_051_imperial_camp");
  const i = j.events.findIndex(e => e.x === 19 && e.y === 2);
  if (i !== 12) throw new Error("051 の坑道のイベントが 13 番でない");
  j.events[i] = { x: 19, y: 2, name: "地下壕の奥の坑道（研究所・搬入口へ）", type: "transfer", to: [90, 19, 3, "down"] };
  writeSrc("w3_051_imperial_camp", j);
}

// ===========================================================================
// 073 沼主の淵：淵の底の排水口（イベント 7 の 2 ページ目を、文章のあと下水道へ下りる選択肢に替える）
// ===========================================================================
{
  const j = readSrc("w4_073_swamp_pool");
  const i = j.events.findIndex(e => e.x === 13 && e.y === 9);
  if (i !== 6) throw new Error("073 の排水口のイベントが 7 番でない");
  const ev = j.events[i];
  ev.name = "淵の底の排水口（下水道・上流へ）";
  ev.pages[1] = {
    conditions: { switch1Id: 157, switch1Valid: true }, image: { tileId: "B:42" }, priorityType: 0, trigger: 1,
    list: list([
      msg(["淵の底の排水口。錆びた梯子が、暗い水路へ下りている。", "梯子の下からは、水の流れる音だけがする。"]),
      choice(["下りる", "やめる"], 1, [[SE("Move1"), MOVE(100, 3, 9, DOWN)], []]),
    ]),
  };
  writeSrc("w4_073_swamp_pool", j);
}
