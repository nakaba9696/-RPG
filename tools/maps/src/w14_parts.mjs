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

// ---------------------------------------------------------------------------
// 結末の夜と朝（場面表 6・7.1。頂の綱のあと 010 の炉の前 (25,26) へ。スイッチ 1162 で自動）
// ---------------------------------------------------------------------------
const NIGHT_TONE = [-68, -68, -17, 0];
const at = (x, y, d, indent = 0) => cmd(201, [0, 10, x, y, d, 2], indent); // 010 の中で立つ所を替える（暗転のあいだ）
const fadeOut = (indent = 0) => cmd(221, [], indent);
const fadeIn = (indent = 0) => cmd(222, [], indent);
const survivorsAtTable = () => {
  const s = id => `$gameSwitches.value(${id})`;
  const any = [121, 122, 124, 125, 126, 127, FLAG.shano].map(s).join(" || ");
  return [
    ifScript(any),
    ...say(["炉に火が入っている。誰かが先に入れていた。", "食卓に、生き残り。向かいの七つの席は空いていて、", "椀が一つずつ置いてある。"], "", 1),
    ...when(i => ifSwitch(122, true, i), i => say(["座れ！　冷める！", "椀は十四ある。多ければ、明日食う"], N.wolfram, i), 1),
    ...when(i => ifSwitch(121, true, i), i => say(["いい？　鐘はね、巻くの。鳴らなくなっても、巻くの", "……誰に言ってんだ、私"], "アデル", i), 1),
    ...when(i => ifSwitch(127, true, i), i => say(["ひとつ、戸の外。ふたつ、扉の前。三つ目は、じいさんが言うなと", "山は、全部ある。明日も数える"], "グィド", i), 1),
    ...when(i => ifSwitch(126, true, i), i => [
      ...say(["外の火、落とさねえ。帰ってくるのがいる"], "アンネリーゼ", i),
      ...when(j => ifSwitch(121, true, j), j => [...say(["誰が"], "アデル", j), ...say(["知らねえ。うちは昔から、そうしてる"], "アンネリーゼ", j)], i),
    ], 1),
    ...when(i => ifSwitch(124, true, i), i => say(["記録します。本日、写しの続き、届きました", "届けた人の名は、知りません。まだ"], N.ismene, i), 1),
    ...when(i => ifSwitch(125, true, i), i => say(["行ったか"], "ピピネル", i), 1),
    end(1),
    ELSE(0),
    ...say(["食卓に、椀が十四。誰も座っていない。"], "", 1),
    end(1),
    ENDIF(0),
    ...say(["奥の椀に、飯が盛られている。", "ルカは、その前に座った。"]),
  ];
};
function endingList() {
  return [
    comment("W14：場面表 6・7.1。頂の綱のあと（スイッチ 1162）。結末の夜 → 戸を叩く音 → （真の結末なら）墓所の壁と名の壁 → 朝"),
    cmd(223, [NIGHT_TONE, 1, false]),
    fadeIn(),
    // 6.1 食卓
    ...survivorsAtTable(),
    // 6.2 戸を叩く音
    wait(30),
    se("Knock", 0, 70, 80), wait(18), se("Knock", 0, 70, 80), wait(18), se("Knock", 0, 70, 80), wait(30),
    ...say(["食卓が、いっせいに黙った。"]),
    ifSwitch(121, true),
    ...say(["いち、に、さん", "数えたら、閉めるの。それが決まり"], "アデル", 1),
    end(1), ELSE(0),
    ...say(["誰も、立たなかった。"], "", 1),
    end(1), ENDIF(0),
    fadeOut(), at(25, 4, UP), fadeIn(),
    ...say(["門の内側。拳ほどの凹みが三つ、縦に並んでいる。", "門の外で、もう一度。三度。", "声は、しない。"]),
    ...say(["閂に手を置いた。夕べの数のあとに、アデルが掛ける閂だった。"]),
    cmd(102, [["開ける", "開けない"], -1, 0, 2, 0]),
    cmd(402, [0, "開ける"]),
    se("Door2", 1),
    ...say(["閂を外す。門が、内から開く。", "外に、誰もいない。灰は降っていない。", "段に、小さな真鍮の鈴。", "紐は、新しい。"], "", 1),
    comment("物は増やさない。鈴は懐に入れた、の地の文だけ", 1),
    ...say(["東の空に、塔の影。灯は、もう無い。"], "", 1),
    switchOn(SW.doorOpened, 1),
    end(1),
    cmd(402, [1, "開けない"]),
    ...say(["閂に手を置いたまま、三十を数えた。", "音は、二度目は来なかった。"], "", 1),
    end(1),
    cmd(404, []),
    fadeOut(), at(25, 26, UP), fadeIn(),
    ...when(i => ifSwitch(121, true, i), i => say(["閉めた？"], "アデル", i)),
    ...when(i => ifSwitch(SW.doorOpened, true, i), i => say(["「開けてある」"], "", i)),
    ...when(i => ifSwitch(122, true, i), i => say(["飯は朝だ！　寝ろ！"], N.wolfram, i)),
    ...say(["奥の席に戻った。椀の飯は冷めていた。それを食った。"]),
    // 6.3 墓所の壁と名の壁（真の結末だけ）
    ifSwitch(SW.trueEnding, true),
    fadeOut(1), at(7, 14, UP, 1), fadeIn(1),
    ...say(["四つの鐘を鳴らして。それから、山の頂の鐘楼へ。", "最後の一画は、止まっている。", "懐から彫り刀を出した。刃の先が欠けている。", "柄の革の巻き方は、囲炉裏の向かいで見た結び方だ。"], "", 1),
    se("Hammer", 1, 60, 120),
    ...say(["刃を、止まっていた所に当てた。一画。", "字は、それで終わった。"], "", 1),
    fadeOut(1), at(45, 14, UP, 1), fadeIn(1),
    ...say(["削られては彫り直され、読めなくなった欄。", "そこに、二文字を彫った。深く。削らなかった。"], "", 1),
    comment("018 見張り台（127 ON かつ 名を返すでイルゼの名を渡した道＝スイッチ 610）。場所は移さず文だけ", 1),
    ...when(i => ifScript("$gameSwitches.value(127) && $gameSwitches.value(610)", i), i => say(["懐の手紙を二通、グィドの樽の上に置いた。", "宛名の無い方を、上にして。", "グィドは灯の油を足していて、振り向かなかった。"], "", i), 1),
    switchOn(SW.nameCarved, 1),
    end(1), ENDIF(0),
    // 7.1 朝
    fadeOut(),
    cmd(223, [[0, 0, 0, 0], 1, false]),
    wait(60),
    ifSwitch(125, true),
    at(11, 14, UP, 1), fadeIn(1),
    ...say(["おぬし。立て。壁に背中をつけい", "刻みが一つ、足りんのじゃ。ずるいじゃろ"], "ピピネル", 1),
    ...say(["壁に、刻みが一つ増える。"], "", 1),
    end(1), ELSE(0),
    at(11, 14, UP, 1), fadeIn(1),
    ...say(["背比べの刻みの、いちばん上に、新しい刻みが一つ。", "誰が彫ったかは、分からない。"], "", 1),
    end(1), ENDIF(0),
    fadeOut(), at(25, 27, UP), fadeIn(),
    ...say(["炉に火が入っている。", "食卓の椀が十四、伏せて干してある。"]),
    ...when(i => ifSwitch(FLAG.shano, true, i), i => say(["見てた？　おれ、今日、下で寝た", "あと、おれ、鈴、蹴ってないかも"], N.shano, i)),
    wait(40),
    ...say(["「ルカ！　爺ちゃんが、飯だって！」"]),
    wait(20),
    ...say(["答えた。"]),
    wait(30),
    // 結末の画面（題と、短い曲）。記録「朝の砦」を作り、朝の砦から続ける
    fadeOut(),
    cmd(249, [{ name: "Musical1", volume: 80, pitch: 100, pan: 0 }]),
    ...center(["最後の鐘"]),
    switchOn(SW.endingSeen),
    switchOn(SW.morning),
    comment("結末を見た全体の旗は、スイッチ 1159 が ON になると Hai_Comfort が立てる（P14）"),
    ...plugin("Hai_Warp", "saveRecord", "記録を作る", { label: "朝の砦" }), // P14：記録「朝の砦」（頂の手前の記録は残す）
    fadeIn(),
    END,
  ];
}
const endingScene = {
  id: 75, name: "W14 結末の夜と朝（自動）", type: "raw", x: 17, y: 27, // 場所移動を含むので、歩いて届く床に置く（見えない）
  pages: [
    { priorityType: 0 },
    { conditions: { switch1Id: SW.endingNight, switch1Valid: true }, priorityType: 0, trigger: 3, list: endingList() },
    { conditions: { switch1Id: SW.morning, switch1Valid: true }, priorityType: 0 },
  ],
};
// 7.2 中庭の子ども（朝の砦から）
const yardChild = {
  id: 76, name: "W14 中庭の子ども（朝の砦）", type: "raw", x: 24, y: 18,
  pages: [
    { priorityType: 0 },
    { conditions: { switch1Id: SW.morning, switch1Valid: true }, image: { characterName: "People1", characterIndex: 6, direction: DOWN, pattern: 1 }, priorityType: 1,
      list: [...say(["中庭で、麦の村の子が数えている。", "「二十七、二十八、二十九、三十」", "「三十のつぎって、なんだっけ」"]), ...say(["ルカは答えなかった。"]), END] },
  ],
};

/** 010 に足すイベント（ID 71 から） */
export const keepEvents = () => [bowlScene, mirleneArrive, mirleneSeat, ismeneSendoff, endingScene, yardChild];
/** 名を彫ったあと（場面表 6.3。以後の調べた文）：墓所の壁の書き付け・名の壁（墓守の欄）に足すページ */
export const writingCarvedPage = { conditions: { switch1Id: SW.nameCarved, switch1Valid: true }, list: [...say(["最後の一画まで、彫ってある。"]), END] };
export const nameWallCarvedPage = { conditions: { switch1Id: SW.nameCarved, switch1Valid: true }, list: [...say(["『ルカ』と彫ってある。削られていない。"]), END] };

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

// ---------------------------------------------------------------------------
// 朝の砦から（場面表 7.2・7.3）：後日談の一行の調べる所と、021 の礼拝堂のページ。足した物は名前の頭の「W14 後日」とページの頭の注釈で見分ける
// ---------------------------------------------------------------------------
const MORNING = SW.morning;
const LATER = "W14 後日";
const MARK = "W14：朝の砦（場面表 7.2）";
const laterLook = (label, [x, y], cond, lines) => ({
  name: `${LATER}：${label}`, type: "raw", x, y,
  pages: [
    { priorityType: 0 },
    { conditions: { switch1Id: MORNING, switch1Valid: true, ...cond }, priorityType: 1, list: [comment("W14：後日談の一行（場面表 7.3）"), ...say(lines), END] },
  ],
});
const EPILOGUE = {
  w10_052_beacon_bridge: [laterLook("名を返す（グィドの家）", [10, 9], { switch2Id: 610, switch2Valid: true }, ["宛名の無い手紙に、宛名が書いてある。"])],
  w12_122_bell_tower: [laterLook("頂の道具・本物の写し（空の鐘架）", [19, 10], { switch2Id: SW.lucienStopped, switch2Valid: true }, ["ルシアンは、空の鐘架の前に座っている。"])],
  w12_111_wheat_village: [laterLook("頂の道具・本物の写し（麦の村）", [8, 9], { switch2Id: SW.lucienStopped, switch2Valid: true }, ["夕べの数のあとに、戸を開けておく家が出てきた。"])],
  w8_060_burnt_gate: [laterLook("灰の信徒（集落）", [15, 11], {}, ["灰の祈りと夕べの数を、同じ夕べにする家が出てきた。"])],
  w7_026_iron_mine: [laterLook("営倉の鐘を売る（マルゴ）", [20, 30], { variableId: 165, variableValid: true, variableValue: 1 }, ["マルゴは営倉の鐘を売るのをやめ、鐘守の名札を売りはじめた。"])],
  w9_071_lake_house: [laterLook("外に残された者（灯の帳面）", [26, 10], { switch2Id: 512, switch2Valid: true }, ["灯の帳面の点の横に、開いた門の絵。"])],
  w9_102_gate_front: [laterLook("扉の外の歌（大扉）", [20, 26], { variableId: 501, variableValid: true, variableValue: 2 }, ["大扉が、夕べの間だけ開く。"])],
  p13_018_watch: [laterLook("足場の木（見張り台）", [7, 5], { switch2Id: SW.sorenneAlive, switch2Valid: true }, ["ソレンヌが、足場の木を薪にして火を焚いている。"])],
};
// 021 礼拝堂（列の最後の席）：ブルーノの遺骸の跡と巡礼に、朝の砦のページ
// 061 の戸板（W16 が置いた「戸板（鍛冶小屋の戸口）」）：弟を連れて帰る（変数 161 が 2 以上）
const LATER_PAGES = {
  w8_061_village_square: {
    "戸板（鍛冶小屋の戸口）": { conditions: { switch1Id: SW.morning, switch1Valid: true, variableId: 161, variableValid: true, variableValue: 2 }, priorityType: 1,
      list: [comment(MARK), ...say(["戸板の盾の裏に、新しい字が一行足されている。ルッツの字。中身は読めない。"]), END] },
  },
};
const CHAPEL_PAGES = {
  "遺骸 ブルーノ": { conditions: { switch1Id: MORNING, switch1Valid: true }, priorityType: 1, list: [comment(MARK), ...say(["列の最後、大男の席だけが空いている。", "床に、灰が人の形に薄く残っている。", "手の甲のあった所に、小さな丸い跡。"]), END] },
  "夕べの会の巡礼": { conditions: { switch1Id: MORNING, switch1Valid: true }, priorityType: 1, list: [comment(MARK), ...say(["騎士さまの鐘を集めに来たんです。……一つ、減ってます", "七。長には、七つと言います。鋏は、もう要らないかも"], "巡礼"), END] },
};
/** その地図の設定（cfg）に、後日談の一行と朝の砦のページを足す（前に足した物は消してから。何度呼んでも同じ） */
export function patchLater(name, cfg) {
  const events = EPILOGUE[name] || [];
  const pages = name === "w7_021_old_chapel" ? CHAPEL_PAGES : LATER_PAGES[name] || {};
  cfg.events = cfg.events.filter(e => !String(e.name).startsWith(LATER));
  const used = new Set(cfg.events.map(e => `${e.x},${e.y}`));
  for (const e of cfg.events) {
    if (!pages[e.name]) continue;
    if (e.type !== "raw") throw new Error(`${name}「${e.name}」は raw でない`);
    e.pages = e.pages.filter(p => !(p.list && p.list[0] && p.list[0].code === 108 && p.list[0].parameters[0] === MARK));
    e.pages.push(JSON.parse(JSON.stringify(pages[e.name])));
  }
  for (const e of events) {
    if (used.has(`${e.x},${e.y}`)) throw new Error(`${name}「${e.name}」(${e.x},${e.y}) にもうイベントがある`);
    cfg.events.push(JSON.parse(JSON.stringify(e)));
  }
  return cfg;
}

