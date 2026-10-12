// W14（#234）：終盤（三つ目の鐘から朝の砦まで）のうち、ほかのレーンの地図に足す部品。台本は docs/story/scenes/04-climax.md（場面表 N4-4）。
//   ・三つの鐘の間（084 w8_maps・094 w10_data・104 w9_data）の綱：鳴ったあとの一行（場面表 1.1・3.7）→ ringAfter
//   ・010 黒鉄の砦（w6_data）：三つ目の鐘の夜（2.1・2.3・2.4）、出立のイスメネ（4.1）。イベント ID は 71–99（W14 の帯。build.mjs の "id"）
//   ・019 城壁の上（w6_data）：頂への門 → 180（4.3）、東の眺めの二ページ目（4.2）
//   ・054 城壁の東門の外（w10_data）：灰の斜面 180 から下りた縄（4.4。崖を下りる近道の片側）
// ほかのレーンの部品は読まない（どの生成スクリプトから読んでも同じ結果になるように）。文は場面表のまま写す（1 行は表の行のまま。5 行より長い窓は 4 行ずつに分ける）。

const cmd = (code, parameters, indent = 0) => ({ code, indent, parameters });
const END = cmd(0, []);
const end = indent => cmd(0, [], indent);
// 1 行は顔なしで全角 46 字まで（docs/knowhow.md 7.2）
const width = s => [...s.replace(/\\[A-Z]\[\d+\]/g, "00")].reduce((w, ch) => w + (/[ -~｡-ﾟ]/.test(ch) ? 0.5 : 1), 0);
/** 窓を出す。4 行より長ければ 4 行ずつの窓に分ける。speaker は 101 の 5 つ目（名前）。 */
export function say(lines, speaker = "", indent = 0, { background = 0, position = 2 } = {}) {
  for (const l of lines) if (width(l) > 46) throw new Error(`文が 46 字を超える：${l}`);
  const out = [];
  for (let i = 0; i < lines.length; i += 4) {
    out.push(cmd(101, ["", 0, background, position, speaker], indent), ...lines.slice(i, i + 4).map(l => cmd(401, [l], indent)));
  }
  return out;
}
/** 窓なし・画面の真ん中（場面表の［中央］） */
export const center = (lines, indent = 0) => say(lines, "", indent, { background: 2, position: 1 });
export const plugin = (name, command, label, args = {}, indent = 0) => [
  cmd(357, [name, command, label, args], indent),
  ...Object.entries(args).map(([k, v]) => cmd(657, [`${k} = ${v}`], indent)),
];
const se = (name, indent = 0, volume = 90, pitch = 100) => cmd(250, [{ name, volume, pitch, pan: 0 }], indent);
const wait = (n, indent = 0) => cmd(230, [n], indent);
const switchOn = (id, indent = 0) => cmd(121, [id, id, 0], indent);
const ifSwitch = (id, on = true, indent = 0) => cmd(111, [0, id, on ? 0 : 1], indent);
const ifVar = (id, value, op = 0, indent = 0) => cmd(111, [1, id, 0, value, op], indent); // op 0＝ 1≧ 2≦ 3＞ 4＜ 5≠
const ifScript = (expr, indent = 0) => cmd(111, [12, expr], indent);
const ELSE = indent => cmd(411, [], indent);
const ENDIF = indent => cmd(412, [], indent);
const selfOn = (ch = "A", indent = 0) => cmd(123, [ch, 0], indent);
const comment = (text, indent = 0) => cmd(108, [text], indent);
const transfer = (mapId, x, y, d, indent = 0) => cmd(201, [0, mapId, x, y, d, 0], indent);
/** 条件が合えば中身（indent+1）を出す */
const when = (cond, body, indent = 0) => [cond(indent), ...body(indent + 1), end(indent + 1), ENDIF(indent)];

const DOWN = 2, LEFT = 4, RIGHT = 6, UP = 8;

// ---------------------------------------------------------------------------
// 旗と ID（W14 の帯 1151–1200。場面表の章末 1）。ほかの帯は読むだけ
// ---------------------------------------------------------------------------
export const SW = {
  bowlFilled: 1151, mirleneFort: 1152, sorenneTalked: 1153, scaffoldBoss: 1154, ropeFixed: 1155, lucienStopped: 1156,
  tongueHung: 1157, endured: 1158, endingSeen: 1159, pulled31: 1160, trueEnding: 1161, endingNight: 1162, doorOpened: 1163,
  nameCarved: 1164, morning: 1165, sorenneAlive: 1166,
  ropeDown: 1167, // 斜面:崖の縄を下ろした（054 の側に縄の絵。崖を下りる近道）
  lairLegacyWest: 1168, lairLegacyEast: 1169, // 縄張り:廊下の影の言い残し（記録院の側 焼けた村の子・鋳物場の側 名無し兵）
  ismene: 1170, // 出立:イスメネが写しを返した
  arrived: 1172, // 斜面:着いた（着き場の文を一度だけ）
};
export const VAR = { notYet: 1151, pulls: 1152 };
export const ITEM = { ledger: 1151, masonTools: 1152 };
export const MAP = { slope: 180, lodge: 181, scaffold: 182, root: 183, summit: 15 };
// ほかの帯（読むだけ）
export const FLAG = {
  bells: 101, bellsAll: 105, scene3: 106, metMirlene: 107, summitGate: 109,
  bruno: 138, nora: 139, dil: 140, zelina: 141, anselmo: 142, beltran: 143, tura: 144, // 加入（P11）
  adel: 121, wolfram: 122, lore: 124, shano: 172, // 生き残り（P8・W6）
  copiesErrand: 163, outsidersErrand: 166, // 頼みごと（P12）
  timber: 1055, // 頼みごと「足場の木」：ソレンヌに渡した（W12）
};
const ITEM_TWO_COPIES = 426; // 二通りの写し（W8）

// 名前（101 の 5 つ目）
const N = {
  bruno: "ブルーノ", nora: "ノラ", dil: "ディル", zelina: "ゼリナ", anselmo: "アンセルモ", beltran: "ベルトラン", tura: "トゥーラ",
  wolfram: "ヴォルフラム", mirlene: "ミルレーネ", shano: "シャノ", ismene: "イスメネ", sorenne: "ソレンヌ",
};

// ---------------------------------------------------------------------------
// 鐘の綱：鳴ったあとの一行（場面表 1.1・3.7。数える場面は置かない。数えるのは頂だけ）
//   084・094・104 の綱のイベントの「綱を引く」の中、鳴ったあと（変数 101 を足したあと）に置く。indent は「綱を引く」の中の深さ
// ---------------------------------------------------------------------------
export function ringAfter(indent = 1) {
  return [
    comment("W14：鳴ったあとの一行（場面表 1.1・3.7）。三つ目ならブルーノの一言、四つ目なら指の一行", indent),
    ...when(i => ifVar(FLAG.bells, 3, 0, i), i => [
      ...when(j => ifSwitch(FLAG.bruno, true, j), j => [
        ...say(["あなた。……三十です"], N.bruno, j),
        ...say(["墓守の指が、もう一本、動いた。"], "", j),
      ], i),
    ], indent),
    ...when(i => ifVar(FLAG.bells, 4, 0, i), i => say(["指が、もう一本、動いた。"], "", i), indent),
  ];
}

// ---------------------------------------------------------------------------
// 010 黒鉄の砦（場面表 2.1・2.3・2.4・4.1）。イベント ID は 71 から（W14 の帯 71–99）
// ---------------------------------------------------------------------------
const IMG = {
  mirlene: { characterName: "People4", characterIndex: 3, direction: DOWN, pattern: 1 }, // W9 の湖の家のミルレーネと同じ絵
  ismene: { characterName: "People1", characterIndex: 3, direction: DOWN, pattern: 1 }, // W8 の記録院のイスメネと同じ絵
  rope: { characterName: "!Other1", characterIndex: 4, direction: DOWN, pattern: 1 }, // 垂れた縄（仮の絵）
};
const KEEP_AT = {
  bowlScene: [49, 0], mirleneArrive: [49, 1], // 自動実行（見えない。壁の上の隅）
  mirleneSeat: [22, 26], // 大広間の炉 (25,25) の脇の石
  ismene: [26, 3], // 外門への階段 (25,2) の手前
};

// 2.1 伏せた椀に飯が盛られる（大広間に入ったとき自動。ヴォルフラムが砦にいるときだけ。いなければ何も出さない）
const bowlScene = {
  id: 71, name: "W14 伏せた椀に飯が盛られる（三つ目の鐘の夜。自動）", type: "raw", x: KEEP_AT.bowlScene[0], y: KEEP_AT.bowlScene[1],
  pages: [
    { priorityType: 0 },
    { conditions: { switch1Id: FLAG.scene3, switch1Valid: true, switch2Id: FLAG.wolfram, switch2Valid: true }, priorityType: 0, trigger: 3,
      list: [
        comment("W14：場面表 2.1。以後、伏せた椀（N4-1 の椀のイベント）は「飯が盛られている」のページ（スイッチ 1151）"),
        ...say(["この椀は、触らん"], N.wolfram),
        ...say(["ヴォルフラムは、椀を起こした。"]),
        ...say(["先に盛る。家の決まりだ"], N.wolfram),
        ...say(["飯が盛られた。湯気が立った。", "ヴォルフラムは椀を元の席に置いて、", "自分の席へ戻った。"]),
        switchOn(SW.bowlFilled),
        END,
      ] },
    { conditions: { switch1Id: SW.bowlFilled, switch1Valid: true }, priorityType: 0 },
  ],
};
/** 伏せた椀のイベント（N4-1・W15 が置く）に足すページ：飯が盛られている（場面表 2.1）。W15 の椀が入ったあとに足す */
export const BOWL_FILLED_PAGE = {
  conditions: { switch1Id: SW.bowlFilled, switch1Valid: true }, priorityType: 1,
  list: [...say(["奥の席の椀に、飯が盛られている。", "椀の底の印は、飯の下で見えない。"]), END],
};

// 2.3 ミルレーネが砦に来る（頼みごと「外に残された者」が終わっている＝変数 166 が 3 以上。灯を湖の子に頼めた）
const mirleneArrive = {
  id: 72, name: "W14 ミルレーネが砦に来る（三つ目の鐘の夜。自動）", type: "raw", x: KEEP_AT.mirleneArrive[0], y: KEEP_AT.mirleneArrive[1],
  pages: [
    { priorityType: 0 },
    { conditions: { switch1Id: FLAG.scene3, switch1Valid: true, switch2Id: FLAG.metMirlene, switch2Valid: true, variableId: FLAG.outsidersErrand, variableValid: true, variableValue: 3 },
      priorityType: 0, trigger: 3,
      list: [
        comment("W14：場面表 2.3。世界設計書 6.8「灯を誰かに頼めたら砦に来る」＝頼みごと「外に残された者」（変数 166）が 3（水門を開けた・開けなかったのどちらでも）"),
        ...when(i => ifSwitch(FLAG.shano, true, i), i => say(["湖の人、来たよ。灯、持ってない"], N.shano, i)),
        ...say(["灯は、湖の子に頼んだの。七十三冊目の帳面も"], N.mirlene),
        comment("ミルレーネが大広間へ歩き、炉の脇の石に座る（炉の脇の石のイベントがスイッチ 1152 で出る）"),
        switchOn(SW.mirleneFort),
        wait(20),
        ...say(["わたしは、火の側でいいわ", "三つ、鳴ったのね"], N.mirlene),
        ...say(["「鳴った」"]),
        ...say(["四つ目は、わたしも待つわ。ここで"], N.mirlene),
        END,
      ] },
    { conditions: { switch1Id: SW.mirleneFort, switch1Valid: true }, priorityType: 0 },
  ],
};
const mirleneSeat = {
  id: 73, name: "W14 ミルレーネ（炉の脇の石）", type: "raw", x: KEEP_AT.mirleneSeat[0], y: KEEP_AT.mirleneSeat[1],
  pages: [
    { priorityType: 0 },
    { conditions: { switch1Id: SW.mirleneFort, switch1Valid: true }, image: { ...IMG.mirlene, direction: RIGHT }, priorityType: 1, directionFix: true,
      list: [...say(["指の腹が黒いのは、灯の油よ。落ちないの", "四つ目は、ここで待つわ"], N.mirlene), END] },
  ],
};

// 4.1 出立：イスメネが写しを返す（四つ目のあと、書庫があり、頼みごと「本物の写し」がイスメネに返した段＝変数 163 が 2）。一度だけ
const ismeneSendoff = {
  id: 74, name: "W14 イスメネ（出立。写しを返す）", type: "raw", x: KEEP_AT.ismene[0], y: KEEP_AT.ismene[1],
  pages: [
    { priorityType: 0 },
    { conditions: { switch1Id: FLAG.bellsAll, switch1Valid: true, switch2Id: FLAG.lore, switch2Valid: true, variableId: FLAG.copiesErrand, variableValid: true, variableValue: 2 },
      image: { ...IMG.ismene, direction: LEFT }, priorityType: 1, trigger: 3,
      list: [
        comment("W14：場面表 4.1。写しを夕べの会に渡した道・燃やした道では出ない（変数 163 が 2 のときだけ）"),
        ...when(i => ifVar(FLAG.copiesErrand, 2, 0, i), i => [
          ...say(["お返しします。まだ、です"], N.ismene, i),
          se("Item3", i), cmd(126, [ITEM_TWO_COPIES, 0, 0, 1], i),
          ...say(["二通りの写しを受け取った。灰色と、茶色。"], "", i),
        ]),
        switchOn(SW.ismene),
        END,
      ] },
    { conditions: { switch1Id: SW.ismene, switch1Valid: true }, priorityType: 0 },
  ],
};

/** 010 に足すイベント（ID 71 から） */
export const keepEvents = () => [bowlScene, mirleneArrive, mirleneSeat, ismeneSendoff];

/** 2.4 墓所の壁の書き付けに足すページ（三つ目の鐘の夜から、名前が戻るまで。そのあとは 1 ページ目に戻る） */
export const writingNightPage = (firstPageList) => ({
  conditions: { switch1Id: FLAG.scene3, switch1Valid: true },
  list: [
    comment("W14：場面表 2.4。三つ目の鐘のあと、名前が戻る（スイッチ 110）までの夜"),
    ifSwitch(110, false),
    ...say(["四つの鐘を鳴らして。それから、山の頂の鐘楼へ。", "最後の一画は、止まったままだ。", "指を折る。三十で、指は全部開いた。", "もう一本、動いた。"], "", 1),
    end(1),
    ELSE(0),
    ...firstPageList.filter(c => c.code !== 0 || c.indent > 0).map(c => ({ ...c, indent: c.indent + 1 })),
    end(1),
    ENDIF(0),
    END,
  ],
});

// ---------------------------------------------------------------------------
// 019 城壁の上：頂への門（4.3）と東の眺め（4.2）
// ---------------------------------------------------------------------------
export const SLOPE_ARRIVE = [9, 46]; // 180 の 019 からの着き場（南西の門の内側）
/** 頂への門の二ページ目（スイッチ 109）の命令。文は今のまま。ミルレーネが砦にいれば一度だけ。触れると 180 へ */
export function summitGateList() {
  return [
    ...say(["門の向こうの灰が引いている。山道が上へ続いている。"]),
    comment("W14：場面表 4.3。ミルレーネが砦にいれば（1152）門の内側で一度だけ。以後は頂に先回りしている"),
    cmd(111, [12, `$gameSwitches.value(${SW.mirleneFort}) && !$gameSelfSwitches.value([19, this._eventId, "B"])`]),
    ...say(["わたしも上るわ。灯は持たないの。", "向こうで、灯は要らないから"], N.mirlene, 1),
    selfOn("B", 1),
    end(1),
    ENDIF(0),
    se("Move1"),
    transfer(MAP.slope, SLOPE_ARRIVE[0], SLOPE_ARRIVE[1], UP),
    // 着き場（場面表 4.4）：初めて門を抜けたときだけ、着いた所で続けて出す（180 に自動実行を置かない）
    ifSwitch(SW.arrived, false),
    wait(20, 1),
    ...say(["灰が降っている。足を置くと沈み、", "足跡は降った端から消える。", "東の空に、山の形をした影。"], "", 1),
    ifSwitch(FLAG.bruno, true, 1), ...say(["灰の中で、数えるのは難しいです。", "でも、数えます。いち、に"], N.bruno, 2), end(2), ENDIF(1),
    switchOn(SW.arrived, 1),
    end(1),
    ENDIF(0),
    END,
  ];
}
/** 東の眺めの二ページ目（四つ目のあと、シャノが砦にいる）：灯の数 */
export const eastViewPage = {
  conditions: { switch1Id: FLAG.bellsAll, switch1Valid: true, switch2Id: FLAG.shano, switch2Valid: true },
  list: [
    comment("W14：場面表 4.2。シャノの二行は一度だけ（セルフスイッチ A）"),
    cmd(111, [2, "A", 1]),
    ...say(["あんた。灯、数えた？", "五つあった。鐘、四つなのに。……ま、いいや。おれ、梁で寝る"], N.shano, 1),
    selfOn("A", 1),
    end(1),
    ENDIF(0),
    ...say(["塔の影に、灯が五つ。四つまで数えて、一つ余った。"]),
    END,
  ],
};

// ---------------------------------------------------------------------------
// 054 城壁の東門の外：灰の斜面（180）の崖から下ろした縄（4.4。崖を下りる近道の片側。下ろすまでは何も無い）
// ---------------------------------------------------------------------------
export const ROPE_054 = [10, 6]; // 北の崖の下（崖の上が 180 の崖の縁）
export const ROPE_180 = [6, 30]; // 180 の崖の縁の縄の掛かるマス（下りると 054 の ROPE_054 の一つ下）
export const ROPE_180_ARRIVE = [7, 30]; // 054 から上ったときの 180 の着く所
export const ropeAt054 = {
  name: "崖の縄（灰の斜面から下ろした。W14）", type: "raw", x: ROPE_054[0], y: ROPE_054[1],
  pages: [
    { priorityType: 0 },
    { conditions: { switch1Id: SW.ropeDown, switch1Valid: true }, image: IMG.rope, priorityType: 1, directionFix: true,
      list: [
        ...say(["崖の上から、縄が一本垂れている。", "上は、灰の斜面だ。"]),
        cmd(102, [["縄を上る", "やめる"], 1, 0, 2, 0]),
        cmd(402, [0, "縄を上る"]), se("Move1", 1), transfer(MAP.slope, ROPE_180_ARRIVE[0], ROPE_180_ARRIVE[1], RIGHT, 1), end(1),
        cmd(402, [1, "やめる"]), end(1),
        cmd(404, []),
        END,
      ] },
  ],
};
