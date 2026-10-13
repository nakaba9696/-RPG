// W11（#191）：三つの鐘の間（084 記録院・094 鋳物場・104 水底）に足す部品。
//   w8_maps.mjs（084）・w10_data.mjs（094）・w9_data.mjs（104）が読み、その地図の設定に入れる（帯は W11 の「戸口と鐘番の思念の 2 ページ目だけ」）。
//   ・鐘番の思念の 2・3 ページ目（docs/world.md 3.6・docs/text.md 4.16）：鳴らした数が 3（変数 101）で、3 つ目の場面（スイッチ 106）をまだ見ていなければ、
//     自動で鐘番の思念と主人公の記憶の場面を出し、スイッチ 106 を ON・まだ鳴っていない地域を門叩きの縄張りにする（Hai_MapTone の lair）。
//   ・霧の戸口（world.md 3.7）：鐘の間の口（控えとの間の 3 マス）をふさぐ霧。出るのはスイッチ 106 が ON で、その地域の鐘が鳴っていない間だけ。
//     触れると門叩きの縄張り 170 へ。縄張りから戻って（173 の戻りの戸口がスイッチ 702〜704 を ON）4 つ目の鐘を鳴らす（スイッチ 105）と、
//     霧が引き、城壁の上の頂への門が開く（スイッチ 109）・縄張りの色調を戻す（lairReset）。
// ほかのレーンの部品は読まない（どの生成スクリプトから読んでも同じ結果になるように）。

const cmd = (code, parameters, indent = 0) => ({ code, indent, parameters });
const END = cmd(0, []);
const end = indent => cmd(0, [], indent);
// 1 行は顔なしで全角 46 字まで（docs/knowhow.md 7.2）。\N[1] は 2 字と数える（墓守）
const width = s => [...s.replace(/\\N\[1\]/g, "墓守")].reduce((w, ch) => w + (/[ -~｡-ﾟ]/.test(ch) ? 0.5 : 1), 0);
export function say(lines, speaker = "", indent = 0, { background = 0, position = 2 } = {}) {
  if (lines.length > 4) throw new Error(`1 ページは 4 行まで：${lines[0]}`);
  for (const l of lines) if (width(l) > 46) throw new Error(`文が 46 字を超える：${l}`);
  return [cmd(101, ["", 0, background, position, speaker], indent), ...lines.map(l => cmd(401, [l], indent))];
}
const se = (name, indent = 0, volume = 90, pitch = 100) => cmd(250, [{ name, volume, pitch, pan: 0 }], indent);
export const plugin = (name, command, label, args = {}, indent = 0) => [
  cmd(357, [name, command, label, args], indent),
  ...Object.entries(args).map(([k, v]) => cmd(657, [`${k} = ${v}`], indent)),
];
const switchOn = (id, indent = 0) => cmd(121, [id, id, 0], indent);
const ifSwitch = (id, on, indent = 0) => cmd(111, [0, id, on ? 0 : 1], indent);
const ELSE = indent => cmd(411, [], indent);
const ENDIF = indent => cmd(412, [], indent);
const addNote = (id, text, indent = 0) => plugin("Hai_Thoughts", "addNote", "メモに足す", { text, id, kind: "clue" }, indent);

// ---------------------------------------------------------------------------
// 旗（docs/world.md 4.4 は W6 の帯で使うだけ。702–704 は W11 の帯）
// ---------------------------------------------------------------------------
export const FLAG = { bells: 101, bellsAll: 105, scene3: 106, climax: 108, summitGate: 109, nameBack: 110 };
export const LAIR_MAP = { edge: 170, corridor: 171, mass: 172, back: 173 };
/**
 * 地域ごとの値。bell＝その地域の鐘のスイッチ、back＝縄張りの戻りの戸口（173）から帰ったスイッチ、
 * room＝鐘の間のマップ、door＝鐘の間の口の 3 マス（真ん中が戸口）、inner＝控えの側の着く所、bellSide＝鐘の間の側の着く所、
 * edge＝縄張りの縁（170）の着く所（戸口の 1 歩内側。向きは縄張りの中）。
 */
export const REGIONS = {
  west: { key: "west", label: "記録院", bell: 102, back: 702, room: 84, door: [[12, 11], [13, 11], [14, 11]], inner: [13, 12], bellSide: [13, 9], edge: [2, 20, 6] },
  south: { key: "south", label: "水底", bell: 103, back: 703, room: 104, door: [[12, 12], [13, 12], [14, 12]], inner: [13, 13], bellSide: [13, 11], edge: [25, 37, 8] },
  east: { key: "east", label: "鋳物場", bell: 104, back: 704, room: 94, door: [[12, 14], [13, 14], [14, 14]], inner: [13, 15], bellSide: [13, 12], edge: [47, 20, 4] },
};
export const REGION_KEYS = ["west", "south", "east"];

/** 「まだ鳴っていない地域」で分ける（3 つ目の場面のあとは一つだけ残る）。bodies[key] は indent+1 の命令の配列を返す関数。 */
export function byLastRegion(bodies, indent = 0, keys = REGION_KEYS) {
  if (!keys.length) return [];
  const [key, ...rest] = keys;
  return [
    ifSwitch(REGIONS[key].bell, false, indent),
    ...bodies[key](indent + 1), end(indent + 1),
    ELSE(indent),
    ...byLastRegion(bodies, indent + 1, rest), end(indent + 1),
    ENDIF(indent),
  ];
}

const IMG_FOG = { characterName: "!Other2", characterIndex: 6, direction: 2, pattern: 1 }; // 霧（白い煙。!Other2 の 6 番の下向き）

// ---------------------------------------------------------------------------
// 3 つ目の鐘のあとの場面（docs/text.md 4.16。地の文の主語は「自分」。画面を暗くし、文章だけ）
// ---------------------------------------------------------------------------
// W14（#234）：場面表 docs/story/scenes/04-climax.md 1.2 の行のまま（表の窓が 4 行より長いので、4 行ずつの窓に分けた）
const SCENE = [
  ["鐘が黙った。墓所の戸が、外から叩かれている。三度。",
    "運びこまれてくる。外門の番、帳場の娘、教官。",
    "一人ずつ、まだ息がある。",
    "息が止まるたび、思いが流れこんでくる。"],
  ["喰えば、楽になる。体がそう言う。",
    "喰わない。代わりに、自分のものを一つ渡す。"],
  ["外門の番には、一緒に数えた夜を。",
    "帳場の娘には、つけの帳面の夜を。",
    "渡すたびに、喰いたいと言う自分が薄くなる。",
    "数える。二十八、二十九、三十。"],
  ["相棒が、壁に向かって何かを彫りはじめた。",
    "刃の音が、戸を叩く音に混ざる。",
    "三十一人目は、まだ来ない。目を閉じた。"],
];
// 鐘の間を出る前の仲間の一言（場面表 1.3。加入のスイッチで一つだけ）
const AFTER_SCENE = [[141, "ゼリナ", "あんた、水に落ちたんか。顔が濡れとる"], [142, "アンセルモ", "お前さん。今の、聞こえたかの"], [144, "トゥーラ", "兄貴。今の音、山の方だったぞ"]];
function oneOf(lines, indent = 0) {
  if (!lines.length) return [];
  const [[sw, who, line], ...rest] = lines;
  return [ifSwitch(sw, true, indent), ...say([line], who, indent + 1), end(indent + 1), ELSE(indent), ...oneOf(rest, indent + 1), end(indent + 1), ENDIF(indent)];
}
// 場面のあと、まだ鳴っていない地域の方角から戸を叩く音（行き先の手がかり。メモにも書く）
const KNOCK = {
  west: { line: "西の谷の方で、戸を叩く音が三度。記録院の方角だ。", note: "最後の鐘：記録院の鐘の間の手前に、霧が溜まっている（戸を叩く音）" },
  south: { line: "南の深い所で、戸を叩く音が三度。水底の方角だ。", note: "最後の鐘：水底の鐘の間の手前に、霧が溜まっている（戸を叩く音）" },
  east: { line: "東の山の根の方で、戸を叩く音が三度。鋳物場の方角だ。", note: "最後の鐘：鋳物場の鐘の間の手前に、霧が溜まっている（戸を叩く音）" },
};

function sceneList() {
  return [
    cmd(108, ["W11：3 つ目の鐘のあとの場面（docs/world.md 3.6・docs/text.md 4.16）。見たらスイッチ 106、まだ鳴っていない地域を縄張りに"]),
    ...plugin("Hai_Thoughts", "faintBegin", "薄い思念の始め（暗くする）"),
    cmd(230, [40]),
    ...SCENE.flatMap(page => say(page, "", 0, { background: 2, position: 1 })),
    ...plugin("Hai_Thoughts", "faintEnd", "薄い思念の終わり（戻す）"),
    cmd(230, [30]),
    ...say(["……喰わないために、預けたのか"]),
    switchOn(FLAG.scene3),
    cmd(230, [30]),
    ...byLastRegion(Object.fromEntries(REGION_KEYS.map(key => [key, ind => [
      ...plugin("Hai_MapTone", "lair", "縄張りの地域を決める", { area: key }, ind),
      se("Knock", ind, 70, 80), cmd(230, [20], ind), se("Knock", ind, 70, 80), cmd(230, [20], ind), se("Knock", ind, 70, 80), cmd(230, [30], ind),
      ...say([KNOCK[key].line], "", ind),
      ...addNote(`clue:lair-${key}`, KNOCK[key].note, ind),
    ]]))),
    ...oneOf(AFTER_SCENE),
  ];
}

/**
 * 鐘番の思念（type: "text" の 1 ページ）を 3 ページにする。
 *   1 ページ目：今のまま／2 ページ目：鳴らした数が 3 以上で自動実行（思念の本文のあと 3 つ目の場面）／3 ページ目：スイッチ 106 のあと（今のまま）。
 * 思念のタグ（<hai_thought>）はそのまま。Hai_Thoughts はどのページでも既読にする。
 * 2 ページ目の自動実行には「（読んだ）」を付けない（W20 #264。R2 困る 5）：Hai_Thoughts は既読の思念の list の最初の 401 に印を付けるので、
 *   本文を「まだ読んでいない」と「読んだ」の二つの分岐に置く。印は前の分岐（既読のときは通らない）に付き、読んだときは後ろの分岐の印なしの本文が出る。
 */
export function withThirdScene(spec) {
  const blocks = Array.isArray(spec.lines[0]) ? spec.lines : [spec.lines];
  const body = blocks.flatMap(block => say(block));
  const bodyIn = indent => blocks.flatMap(block => say(block, "", indent));
  const id = /<hai_thought:([^>]+)>/.exec(spec.note || "")?.[1];
  if (!id) throw new Error(`鐘番の思念に <hai_thought> が無い：${spec.name}`);
  const unmarked = [
    cmd(111, [12, `!Hai.Thoughts.isRead(${JSON.stringify(id)})`]), ...bodyIn(1), end(1),
    ELSE(0), ...bodyIn(1), end(1), ENDIF(0),
  ];
  const base = { image: spec.image, priorityType: 1 };
  return {
    name: spec.name, type: "raw", x: spec.x, y: spec.y, note: spec.note,
    pages: [
      { ...base, list: [...body, END] },
      { ...base, conditions: { variableId: FLAG.bells, variableValid: true, variableValue: 3 }, trigger: 3, list: [...unmarked, ...sceneList(), END] },
      { ...base, conditions: { switch1Id: FLAG.scene3, switch1Valid: true }, list: [...body, END] },
    ],
  };
}

// ---------------------------------------------------------------------------
// 霧の戸口（鐘の間の口の 3 マス）
// ---------------------------------------------------------------------------
function enterList(region) {
  const r = REGIONS[region];
  return [
    se("Knock", 0, 60, 80), cmd(230, [15]), se("Knock", 0, 60, 80), cmd(230, [15]), se("Knock", 0, 60, 80), cmd(230, [20]),
    ...say(["霧が口をふさいでいる。奥で、戸を叩く音が三度。", "霧の向こうは、鐘の間ではない。石の廊下が下へ続いている。"]),
    cmd(102, [["霧の奥へ入る", "やめる"], 1, 0, 2, 0]),
    cmd(402, [0, "霧の奥へ入る"]),
    se("Fog1", 1, 80, 70),
    cmd(201, [0, LAIR_MAP.edge, r.edge[0], r.edge[1], r.edge[2], 0], 1),
    end(1),
    cmd(402, [1, "やめる"]),
    end(1),
    cmd(404, []),
    END,
  ];
}

function closeList() {
  return [
    cmd(108, ["W11：4 つ目の鐘のあと（縄張りから戻り、この地域の鐘を鳴らした）。霧が引き、頂への門が開く（スイッチ 109）。縄張りの色調を戻す"]),
    cmd(230, [30]),
    se("Fog2", 0, 70, 80),
    ...say(["鐘の余韻の中で、口をふさいでいた霧が薄れていく。", "霧の奥の声が、一つずつ遠くなった。"]),
    ...plugin("Hai_MapTone", "lairReset", "縄張りを消す"),
    cmd(230, [40]),
    se("Gate1", 0, 60, 70),
    ...say(["砦の方角、城壁の上で、東の塔の門が開く音がした。"]),
    ifSwitch(144, true), ...say(["兄貴。開いた"], "トゥーラ", 1), end(1), ENDIF(0), // W14：場面表 3.7
    switchOn(FLAG.summitGate),
    ...addNote("clue:summit-gate", "頂への門が開いた（砦の城壁の上の東の塔）"),
    cmd(123, ["A", 0]),
    END,
  ];
}

/**
 * 霧の戸口のイベント（3 つ）。真ん中だけ、4 つ目の鐘のあとに自動で閉じの場面を出す。
 *   1 ページ目：スイッチ 106（3 つ目の場面）のあと、霧で口をふさぐ。触れると縄張りへ
 *   2 ページ目：この地域の鐘が鳴った（スイッチ 102・103・104）→ 何も無い（通れる）
 *   3 ページ目（真ん中）：4 つ目が鳴り（スイッチ 105）、この地域の戸口から帰った（702〜704）→ 自動で閉じの場面
 *   4 ページ目（真ん中）：セルフスイッチ A → 何も無い
 */
export function lairDoorEvents(region) {
  const r = REGIONS[region];
  return r.door.map(([x, y], i) => {
    const center = i === 1;
    const pages = [
      { conditions: { switch1Id: FLAG.scene3, switch1Valid: true }, image: IMG_FOG, priorityType: 1, trigger: 1, stepAnime: true, walkAnime: false, directionFix: true, list: enterList(region) },
      { conditions: { switch1Id: r.bell, switch1Valid: true }, priorityType: 0, list: [END] },
    ];
    if (center) {
      pages.push(
        { conditions: { switch1Id: FLAG.bellsAll, switch1Valid: true, switch2Id: r.back, switch2Valid: true }, priorityType: 0, trigger: 3, list: closeList() },
        { conditions: { selfSwitchCh: "A", selfSwitchValid: true }, priorityType: 0, list: [END] },
      );
    }
    return { name: `霧の戸口（門叩きの縄張りへ。W11）${center ? "" : ` ${i + 1}`}`, type: "raw", x, y, note: "", pages };
  });
}
