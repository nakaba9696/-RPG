// W15（#231）：原作の反映（序と地域一）のうち、地域一のマップ（020–037。W7 #145 の設定 tools/maps/src/w7_*.json）を直す。
// 台本は docs/story/scenes/01-fort-region1.md（場面表）。文は表のまま写す。砦（010–014・019）は w6_data.mjs が書く。
//   node tools/maps/src/w15_story.mjs           w7_*.json を直す（このあと node tools/maps/build.mjs w7_020_mist_forest … で地図を作る）
//   node tools/maps/src/w15_story.mjs --check   書かずに、今のファイルと同じかだけ見る（違えば終了コード 1）
// 何度走らせても同じ結果になる（直すイベントは名前で引いて中身を丸ごと置き換え、足すイベントは名前で引いて無ければ末尾に足す）。
// 直すもの：
//   020 R1-01 の切り方、夜の戸（木樵の小屋の土間・声だけの影。言い残しはスイッチ 314 で P14 の表が出す）
//   021 巡礼の切り方と二ページ目、鐘鳴りの籠手の調べた文
//   024 ヴォルフラムの切り方
//   026 拾い屋の見張り（五行を二行に・二ページ目を削除）、アデル（「……」を一つに・ブルーノの二行・頼みごと「頂の道具」）、昇降機のブルーノの一行
//   028 坑道の門・F03 のブルーノの一行
//   033 F02 のブルーノの二行、房の列の端（「……東を向いている」）
//   035 牢番を倒したあとのブルーノの一行
//   036 営倉の鐘（ブルーノの四行、マルゴと取り引きする道、頼みごと「営倉の鐘を売る」、「同じ日だ」）
//   地域一の敵（020–029・033–037・022。030–032 は除く）のメモ欄に <hai_enemy_bell:101>（P14 #230 が読む。それまでは何も起きない）
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SRC_DIR } from "../build.mjs";
import { patchLater } from "./w14_parts.mjs"; // W14（#234）：朝の砦のページと後日談の一行（021・026）
import { fixW30 } from "./w30_parts.mjs"; // W30（#315）：見えない壁と、話すと姿が変わる人の直し

const check = process.argv.includes("--check");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

// ---------------------------------------------------------------------------
// 命令の部品（w6_data.mjs と同じ形）
// ---------------------------------------------------------------------------
const cmd = (code, parameters, indent = 0) => ({ code, indent, parameters });
const END = cmd(0, []);
const say = (lines, speaker = "", indent = 0) => {
  const out = [];
  for (let i = 0; i < lines.length; i += 4) out.push(cmd(101, ["", 0, 0, 2, speaker], indent), ...lines.slice(i, i + 4).map(l => cmd(401, [l], indent)));
  return out;
};
const se = (name, indent = 0, volume = 90, pitch = 100) => cmd(250, [{ name, volume, pitch, pan: 0 }], indent);
const plugin = (name, command, label, args = {}, indent = 0) => [
  cmd(357, [name, command, label, args], indent),
  ...Object.entries(args).map(([k, v]) => cmd(657, [`${k} = ${v}`], indent)),
];
const switchOn = (id, indent = 0) => cmd(121, [id, id, 0], indent);
const selfOn = (ch = "A", indent = 0) => cmd(123, [ch, 0], indent);
const ifBruno = (indent = 0) => cmd(111, [4, BRUNO, 0], indent);
const ifVar = (id, value, op = 0, indent = 0) => cmd(111, [1, id, 0, value, op], indent);
const ifItem = (id, indent = 0) => cmd(111, [8, id], indent);
const ENDIF = (indent = 0) => [cmd(0, [], indent + 1), cmd(412, [], indent)];
const ELSE = (indent = 0) => [cmd(0, [], indent + 1), cmd(411, [], indent)];
const errand = (key, stage, text, indent = 0) => plugin("Hai_Notes", "errand", "頼みごとを進める", { key, stage: String(stage), text }, indent);
const shift = (list, by) => list.map(c => ({ ...c, indent: c.indent + by }));

const BRUNO = 5; // アクター 5（パーティにいる）
const KEEPER = "\\N[1]"; // 墓守（主人公の一行）
const SW = { bellPrison: 101, bellFirst: 310, nightDoor: 314 };
const VAR = { bells: 101, survivors: 103, faint: 138, prisonBell: 165, bellIron: 301 };
const ITEM = { dutyTag: 323, graveLedger: 326, archiveTag: 429 };
const TROOP = { nightShade: 336 };
const ENEMY_BELL = `<hai_enemy_bell:${SW.bellPrison}>`; // 鳴らした地域の敵は追わず、東を向いて止まる（P14 #230）

// ---------------------------------------------------------------------------
// 設定の読み書きと、イベントの引き方
// ---------------------------------------------------------------------------
const configs = new Map(); // 名前 → { file, cfg, before }
function load(name) {
  if (!configs.has(name)) {
    const file = path.join(SRC_DIR, name + ".json");
    const before = fs.readFileSync(file, "utf8");
    configs.set(name, { file, cfg: JSON.parse(before), before });
  }
  return configs.get(name).cfg;
}
function ev(cfg, name) {
  const found = cfg.events.filter(e => e.name === name);
  if (found.length !== 1) throw new Error(`${cfg.mapId}: イベント「${name}」が ${found.length} 個`);
  return found[0];
}
/** 名前のイベントを置き換える。無ければ末尾に足す。 */
function upsert(cfg, spec) {
  const i = cfg.events.findIndex(e => e.name === spec.name);
  if (i >= 0) cfg.events[i] = spec;
  else cfg.events.push(spec);
}
/** list の n 番目の「文章の表示」（101 と続く 401）の行を lines に置き換える（5 行以上は窓を分ける）。 */
function rewrap(list, n, lines) {
  let seen = -1;
  for (let i = 0; i < list.length; i++) {
    if (list[i].code !== 101 || ++seen !== n) continue;
    let j = i + 1;
    while (j < list.length && list[j].code === 401) j++;
    const { indent } = list[i];
    list.splice(i, j - i, ...say(lines, list[i].parameters[4], indent));
    return;
  }
  throw new Error(`文章の表示 ${n} 番目が無い`);
}
const textsOf = list => list.filter(c => c.code === 401).map(c => c.parameters[0]);

// ===========================================================================
// 020 霧の森・入口
// ===========================================================================
const forest = load("w7_020_mist_forest");
ev(forest, "思念 R1-01 戸に答えなかった木樵").lines = [
  ["夜、戸を三度叩かれた。", "女房の声で、入れておくれ、と。", "女房は昼に、この手で埋めた。"],
  ["答えなかった。朝になると、", "戸の前に女房の靴が揃えてあった。", "左右が逆だった。あいつは、いつもそう脱いだ。"],
];
// 七 薪、三束（夜の戸の一つ目。骨子 6 章の 2・8.2）。崩れた小屋の土間（戸板 (38,36) の内側の一マス）。踏むか調べる
const HUT = { x: 38, y: 37 }, SHADE = { x: 38, y: 38 };
const SHADE_NAME = "声だけの影（木樵の女房）";
const WIFE_LINE = "薪、三束。戸の脇に置いといたよ";
upsert(forest, {
  name: "木樵の小屋の土間（夜の戸）", type: "raw", x: HUT.x, y: HUT.y,
  pages: [
    {
      priorityType: 0, trigger: 1,
      list: [
        ...plugin("Hai_MapTone", "dark", "暗がりの半径を変える", { radius: "2" }),
        cmd(230, [30]),
        // 戸を三度叩く音（一つ目と二つ目の間を長く、三つ目を短く）
        se("Knock"), cmd(230, [70]), se("Knock"), cmd(230, [18]), se("Knock"), cmd(230, [30]),
        ...say(["戸を、三度叩く音がした。", "戸板の向こうで、女の声がした。"]),
        ...say([WIFE_LINE], "声"),
        cmd(102, [["答える", "答えない"], 1, 0, 2, 0]),
        cmd(402, [0, "答える"]),
        ...say(["……三束だな"], KEEPER, 1),
        ...say(["戸板の向こうで、声は止まった。", "土間の暗がりが、縦に裂けた。"], "", 1),
        switchOn(SW.nightDoor, 1),
        cmd(0, [], 1),
        cmd(402, [1, "答えない"]),
        cmd(0, [], 1),
        cmd(404, []),
        ...plugin("Hai_MapTone", "darkReset", "暗がりを元に戻す"),
        END,
      ],
    },
    {
      conditions: { switch1Id: SW.nightDoor, switch1Valid: true }, priorityType: 0,
      list: [...say(["戸板の脇の地面に、四角く、苔の濃い所がある。", "薪を積んであった形だ。"]), END],
    },
  ],
});
// 声だけの影（W11 の 701 と同じ型）。答えたら出る。一度きり。倒すと一行の声を残す（Hai_SymbolEnemy）
upsert(forest, {
  name: SHADE_NAME, type: "raw", x: SHADE.x, y: SHADE.y,
  // W19（#263。R2 気になる 12）：倒しても一行を出さない（<hai_enemy_shade_quiet>）。一行は下の「夜の戸の後（自動）」が、崩れる文のあとに話し手の名つきで出す
  note: `<hai_enemy:${TROOP.nightShade},yellow><hai_enemy_once><hai_enemy_shade:${WIFE_LINE}><hai_enemy_shade_quiet>`,
  pages: [
    { priorityType: 0 },
    {
      conditions: { switch1Id: SW.nightDoor, switch1Valid: true },
      image: { characterName: "Monster", characterIndex: 5, direction: 8, pattern: 1 },
      priorityType: 1, trigger: 2, moveType: 0, moveFrequency: 5, moveSpeed: 3,
    },
  ],
});
// W19（#263。R2 気になる 12）：影を倒したあと「崩れる → 声（話し手の名つき）」の順に出す（P17 #257 の shadeVoice。060 の夜の戸の後と同じ作り）。
// 影の勝ちはセルフスイッチ A（Hai_SymbolEnemy）なので、並列のページで見て自分の B を立て、B で自動実行。出し終えたら C。
// 置き場所は地図の左上の木 (0,0)（散らしの床でないマス。散らしの乱数の並びを変えない）
{
  const shadeId = forest.events.findIndex(e => e.name === SHADE_NAME) + 1;
  upsert(forest, {
    name: "夜の戸の後（自動）", type: "raw", x: 0, y: 0,
    pages: [
      { priorityType: 0 },
      {
        conditions: { switch1Id: SW.nightDoor, switch1Valid: true }, priorityType: 0, trigger: 4,
        list: [cmd(111, [12, `$gameSelfSwitches.value([20, ${shadeId}, "A"])`]), selfOn("B", 1), ...ENDIF(), END],
      },
      {
        conditions: { switch1Id: SW.nightDoor, switch1Valid: true, selfSwitchCh: "B", selfSwitchValid: true }, priorityType: 0, trigger: 3,
        list: [
          ...say(["影は、土間の上で崩れた。", "灰が、戸板の下まで流れた。"]),
          ...plugin("Hai_SymbolEnemy", "shadeVoice", "影の声を出す", { eventId: String(shadeId), speaker: "木樵の女房" }),
          selfOn("C"),
          END,
        ],
      },
      { conditions: { selfSwitchCh: "C", selfSwitchValid: true }, priorityType: 0 },
    ],
  });
}
// 言い残しは P14 の Hai_Thoughts の表（スイッチ 314 の行）が持つ。W は答えたときにスイッチ 314 を立てるだけ（文を二か所に書かない）。
// 前の版で足した見張りのイベントは消す
{
  const i = forest.events.findIndex(e => e.name === "言い残し（木樵の女房）");
  if (i >= 0) forest.events.splice(i, 1);
}

// ===========================================================================
// 021 古い礼拝堂
// ===========================================================================
const chapel = load("w7_021_old_chapel");
{
  const pilgrim = ev(chapel, "夕べの会の巡礼");
  const img = pilgrim.pages[0].image;
  pilgrim.pages = [
    {
      image: img, priorityType: 1,
      list: [
        ...say(["……二十八、二十九、三十。"], "巡礼"),
        ...say(["ああ、すみません。", "夕べの数は、途中で止めると一からなので。"], "巡礼"),
        ...say(["長に言われて、騎士さまの鐘を集めに来ました。", "布で巻いたまま持って帰るように、と。", "鳴らしてはいけないそうです。"], "巡礼"),
        ...say(["でも、一つも外れないんです。", "手の甲に縫い付けてあって。", "糸が、鎧の革を貫いてます。", "鋏は、三本折りました。"], "巡礼"),
        selfOn(),
        END,
      ],
    },
    { conditions: { selfSwitchCh: "A", selfSwitchValid: true }, image: img, priorityType: 1, list: [...say(["十一、十二、十三。"], "巡礼"), END] },
  ];
  const gauntlet = ev(chapel, "拾い物（鐘鳴りの籠手）");
  rewrap(gauntlet.pages[0].list, 0, ["列の端に、籠手が片方だけ落ちている。", "手の甲に、小指ほどの鐘。", "舌は布で巻いて結んである。"]);
}

// ===========================================================================
// 024 霧の奥：ヴォルフラム（切り方だけ）
// ===========================================================================
const deep = load("w7_024_deep_mist");
{
  const list = ev(deep, "ヴォルフラム").pages[0].list;
  const blocks = [
    ["おう！　そこのお前！　鍋を見なかったか！"],
    ["でかい鍋だ。炊き出しの鍋だ。", "三日前ここに置いて、薪を拾いに行って、", "戻ったらどこだか分からん！", "わははは！　腹が減った！"],
    ["……横にあるな。", "ずっと横にあったか。そうか。"],
    ["砦？　火が入ったのか。なら行く。", "鍋はわしが担ぐ。お前は先を歩け！", "わしは道を覚えん！"],
    ["それと、これを持っとけ。", "孫に持たせとった護符だ。", "孫には、もう要らん。持っとけ。"],
    null, // 鐘喰いの護符を手に入れた！
    ["ヴォルフラムは鍋を担いで、", "霧の中を砦の方へ歩いていった。", "鍋の底を叩く音が、しばらく聞こえていた。"],
  ];
  // 後ろから置き換える（前の窓の数が変わっても番号がずれない）
  for (let n = blocks.length - 1; n >= 0; n--) if (blocks[n]) rewrap(list, n, blocks[n]);
}

// ===========================================================================
// 026 鉄の坑道・上層
// ===========================================================================
const mine = load("w7_026_iron_mine");
{
  const watch = ev(mine, "拾い屋の見張り");
  const img = watch.pages[0].image;
  // 五行を二行に。二ページ目（麦三月）は削除（麦三月はマルゴが言う）
  watch.pages = [{
    image: img, priorityType: 1,
    list: [
      ...say(["ここは頭の掘り場だよ。", "掘った鉄は頭のもの。拾った鉄も、頭のもの"], "拾い屋"),
      ...say(["下の層には行かないほうがいい。", "灯の無い連中がうろついてる"], "拾い屋"),
      END,
    ],
  }];

  const adele = ev(mine, "アデル");
  const old = adele.pages[0].list;
  const from = old.findIndex(c => c.code === 122 && c.parameters[0] === VAR.bellIron); // 変数 301＝1 から後（メモ・砦へ・稽古場）は今のまま
  if (from < 0) throw new Error("026 アデル：変数 301 の操作が無い");
  const tail = old.slice(from, old.findIndex((c, i) => i > from && c.code === 101)); // 最後の「出ていった」の前まで
  // 頼みごと（Hai_Notes の 357 と続く 657）は外して、下で入れ直す（何度走らせても一つ）
  const keep = [];
  let inErrand = false;
  for (const c of tail) {
    if (c.code === 357) inErrand = c.parameters[0] === "Hai_Notes";
    else if (c.code !== 657) inErrand = false;
    if (!inErrand) keep.push(c);
  }
  const at = keep.findIndex(c => c.code === 221); // フェードアウトの前に頼みごと
  adele.pages[0].list = [
    ...say(["いい？　坑道では、灯を消したら負け。"], "アデル"),
    ...say(["……あ、新しい人。後輩ね。私が先輩。"], "アデル"),
    ...say(["私は夕べの会の見習い。", "ここで、会に納める鉄を掘ってる。", "槍は本物。掘るのは鶴嘴。鶴嘴の方が上手い。"], "アデル"),
    ...say(["砦の炉に火が入った？　誰が入れたの。", "いい？　後輩の面倒を見るのも、先輩の務め。", "私も行く。"], "アデル"),
    ...say(["それと、頼みがあるの。", "下の層の長屋に、鐘鉄の塊が残ってるはず。", "会の長が欲しがってる。白っぽい鉄。", "見つけたら、砦の私に。"], "アデル"),
    ...keep.slice(0, at),
    ...errand("summitTools", 1, "鐘鉄の塊を、砦のアデルに（鉄の坑道・下層の長屋）"),
    ...keep.slice(at),
    ...say(["アデルは鶴嘴を担いで、坑道を西へ出ていった。"]),
    ifBruno(),
    ...say(["今の人、僕の隊の鐘の印を、槍に"], "ブルーノ", 1),
    ...say(["いえ。なんでもないです"], "ブルーノ", 1),
    ...ENDIF(),
    END,
  ];

  const lift = ev(mine, "昇降機（下層へ）");
  const down = lift.pages[1].list;
  const go = down.findIndex(c => c.code === 201);
  if (!textsOf(down).includes("籠に乗ると、鎖がきしんで下りはじめた。") || go < 0) throw new Error("026 昇降機の二ページ目が今の形でない");
  lift.pages[1].list = [
    ...down.slice(0, down.findIndex(c => c.code === 101)),
    ...say(["籠に乗ると、鎖がきしんで下りはじめた。"]),
    ifBruno(),
    ...say(["いち、に、さん、し"], "ブルーノ", 1),
    ...ENDIF(),
    ...down.slice(go),
  ];
}

// ===========================================================================
// 028 坑道の門
// ===========================================================================
const gate = load("w7_028_mine_gate");
{
  const i = gate.events.findIndex(e => e.name === "坑道の門");
  const g = gate.events[i];
  if (g.type !== "raw") {
    gate.events[i] = {
      name: g.name, type: "raw", x: g.x, y: g.y,
      pages: [{
        ...(g.image ? { image: g.image } : {}), priorityType: 1,
        list: [
          ...say(["鉄の格子の門。向こうは土砂で埋まっている。", "格子に、坑夫の名札が十いくつ結び付けてある。"]),
          ifBruno(),
          ...say(["名の無い札が、一枚。", "いえ。擦れて読めないだけです"], "ブルーノ", 1),
          ...ENDIF(),
          END,
        ],
      }],
    };
  }
  const f03 = ev(gate, "薄い思念 F03 坑夫の頭");
  const list = f03.pages[0].list;
  const call = list.findIndex(c => c.code === 117 || (c.code === 111 && c.parameters[0] === 1 && c.parameters[1] === VAR.faint));
  f03.pages[0].list = [
    ...list.slice(0, call),
    // 一言はコモン 201 がいつも出す。四つ目の「墓守の帳面。全部、同じ手だ」を帳面（022）のあるときだけにするのも 201 の側（W24 #281。W19 #263 の分岐は 201 へ移した）
    cmd(117, [201]),
    ifBruno(),
    ifItem(ITEM.graveLedger, 1),
    ...say(["あなたの、帳面ですか"], "ブルーノ", 2),
    ...ENDIF(1),
    ...ENDIF(),
    END,
  ];
}

// ===========================================================================
// 033 営倉・監房
// ===========================================================================
const cells = load("w7_033_stockade_cells");
{
  const f02 = ev(cells, "薄い思念 F02 外門の門番");
  const list = f02.pages[0].list;
  const call = list.findIndex(c => c.code === 117);
  f02.pages[0].list = [
    ...list.slice(0, call + 1),
    ifBruno(),
    ...say(["……今、数えてましたね。三十まで"], "ブルーノ", 1),
    ...say(["声は、出してなかったですけど。", "口が、そう動いてました"], "ブルーノ", 1),
    ...ENDIF(),
    END,
  ];
  // 十四 房の列の端（南の下り口の上。営倉の鐘のあと、一度だけ）。二マスで一つ（踏んだ方がもう一方のセルフスイッチも立てる）
  const cellsAt = [[29, 41], [30, 41]];
  const names = cellsAt.map((_, i) => `房の列の端 ${i + 1}`);
  cellsAt.forEach(([x, y], i) => {
    const other = names[1 - i];
    upsert(cells, {
      name: names[i], type: "raw", x, y,
      pages: [
        { priorityType: 0 },
        {
          conditions: { switch1Id: SW.bellPrison, switch1Valid: true }, priorityType: 0, trigger: 1,
          list: [
            // W19（#263。R2 気になる 22）：下り口の近くに影は見えないので、今見えている物でなく、通ってきた影のことにした
            //（影を置くと散らしの床が変わる。場面表 十四 の二行の直し）
            ...say(["追ってくる足音が、無い。", "途中の影は、どれも同じ方を向いて立っていた。"]),
            ifBruno(),
            ...say(["追って、来ません"], "ブルーノ", 1),
            ...say(["あの、みんな、"], "ブルーノ", 1),
            ...ENDIF(),
            ...say(["……東を向いている"], KEEPER),
            selfOn(),
            cmd(355, [`{ const e = $gameMap.events().find(e => e.event().name === "${other}"); if (e) $gameSelfSwitches.setValue([$gameMap.mapId(), e.eventId(), "A"], true); }`]),
            END,
          ],
        },
        { conditions: { switch1Id: SW.bellPrison, switch1Valid: true, selfSwitchCh: "A", selfSwitchValid: true }, priorityType: 0 },
      ],
    });
  });
}

// ===========================================================================
// 035 牢番の詰め所：勝ったあとのブルーノの一行
// ===========================================================================
const post = load("w7_035_warden_post");
{
  const list = ev(post, "牢番").pages[0].list;
  const doorLine = list.findIndex(c => c.code === 401 && c.parameters[0] === "北の扉の閂が、内側から外れる音がした。");
  if (doorLine < 0) throw new Error("035 牢番：勝ったあとの文が無い");
  const exists = list.some(c => c.code === 401 && c.parameters[0] === "すみません。三度しか、持ちませんでした");
  if (!exists) list.splice(doorLine + 1, 0, ifBruno(1), ...say(["すみません。三度しか、持ちませんでした"], "ブルーノ", 2), ...ENDIF(1));
}

// ===========================================================================
// 036 営倉の鐘の間
// ===========================================================================
const bellRoom = load("w7_036_stockade_bell");
{
  const rope = ev(bellRoom, "営倉の鐘の綱");
  const p1 = rope.pages[0];
  // 鐘を鳴らす命令（今のまま）は、もとの「綱を引く」の枝から写す（初回は今の形。二回目からは写した物を使う）
  const RING_SOUND = [
    se("Bell3", 0, 100, 90), cmd(225, [3, 5, 20, false]), cmd(224, [[255, 255, 255, 120], 20, true]), cmd(230, [30]),
    se("Bell3", 0, 90, 90), cmd(230, [40]), se("Bell3", 0, 80, 85), cmd(230, [60]),
  ];
  const ring = indent => shift([
    ...RING_SOUND,
    ...say(["鐘が鳴る。音が石を伝って、上へ抜けていく。", "天井から、灰が一筋落ちた。"]),
    ifBruno(),
    ...say(["ブルーノの手の甲の鐘は、鳴らなかった。", "ブルーノは、自分の手を見た。"], "", 1),
    ...ENDIF(),
    switchOn(SW.bellPrison),
    cmd(122, [VAR.bells, VAR.bells, 1, 0, 1]),
    // 「先に鳴らした」（取り引きの前）。取り引きのあと（変数 165 が 3 以上）は立てない
    ifVar(VAR.prisonBell, 3, 4),
    switchOn(SW.bellFirst, 1),
    ...ENDIF(),
    selfOn(),
    ...say(["壁の札掛けに、当番の札が一枚だけ残っている。"]),
    se("Item3"),
    cmd(126, [ITEM.dutyTag, 0, 0, 1]),
    ...say(["\\I[196]当番の札（営倉）を手に入れた。"]),
    // 記録院の札を先に持っているとき（scenes/02 の 3-27。084 側の三行と同じ）
    ifItem(ITEM.archiveTag),
    ...say(["営倉の札と、並べた。", "日付は、同じだった。"], "", 1),
    ...say(["同じ日だ"], KEEPER, 1),
    ...ENDIF(),
    // 頼みごと「営倉の鐘を売る」（マルゴに会っていれば）
    ifVar(VAR.prisonBell, 1, 1),
    ...errand("prisonBell", 2, "鳴らした。マルゴは鳴った鐘を買わない", 1),
    ...ENDIF(),
  ], indent);
  const choose = (choices, branches) => [
    cmd(102, [choices, choices.length - 1, 0, 2, 0]),
    ...choices.flatMap((c, i) => [cmd(402, [i, c]), ...shift(branches[i] || [], 1), cmd(0, [], 1)]),
    cmd(404, []),
  ];
  // マルゴと取り引きする道（鐘を鳴らさずに外す。骨子 8.1。文は W が書いた）。マルゴが台に戻させるまで（変数 165＝3）鳴らせない
  const unhook = [
    ...say(["鐘を台座から外した。", "抱えると、腕が痺れるほど重い。"]),
    ...say(["鐘を、台座の脇の床に下ろした。"]),
    ...errand("prisonBell", 3, "鐘を台座から外した。マルゴが取りに来る"),
  ];
  p1.list = [
    ifVar(VAR.prisonBell, 3),
    ...say(["鐘は、台座の脇の床に下ろしてある。", "綱だけが、梁から垂れている。"], "", 1),
    ...ELSE(),
    ...shift([
      ...say(["台座の上に、抱えられるほどの鐘が据えてある。", "鐘の綱が、天井の梁から垂れている。"]),
      ifBruno(),
      ...say(["これが、営倉の鐘ですか。", "隊の鐘より、ずっと大きい"], "ブルーノ", 1),
      ...say(["僕は、鳴らしたことがありません。", "鳴らすのは、鐘番の役でしたから"], "ブルーノ", 1),
      ...ENDIF(),
      // マルゴに頼まれていて（変数 165＝1）、まだ鳴らしていない
      ifVar(VAR.prisonBell, 1),
      ...shift(choose(["綱を引く", "鐘を外す（マルゴに売る）", "やめる"], [ring(0), unhook, []]), 1),
      ...ELSE(),
      ...shift(choose(["綱を引く", "やめる"], [ring(0), []]), 1),
      ...ENDIF(),
    ], 1),
    ...ENDIF(),
    END,
  ];
}

// ===========================================================================
// 地域一の敵：東を向いて止まる旗（P14 #230）
// ===========================================================================
for (const name of ["w7_020_mist_forest", "w7_021_old_chapel", "w7_022_ossuary", "w7_024_deep_mist", "w7_026_iron_mine", "w7_027_mine_depths",
  "w7_028_mine_gate", "w7_029_miners_station", "w7_033_stockade_cells", "w7_034_stockade_hall", "w7_035_warden_post", "w7_036_stockade_bell", "w7_037_well_passage"]) {
  for (const e of load(name).events) {
    const note = e.note || "";
    if (!note.includes("<hai_enemy:") || note.includes("<hai_enemy_shade") || note.includes(ENEMY_BELL)) continue;
    e.note = `${note}\n${ENEMY_BELL}`;
  }
}

// ===========================================================================
// 朝の砦（W14 #234）：021 の巡礼・ブルーノの遺骸のページと 026 の後日談の一行は w14_parts.mjs の patchLater が足す。
// 上で巡礼を丸ごと置き換えたので、ここで足し直す（w14_data.mjs と同じ。どちらを先に走らせても同じ結果。P15 #250）
// ===========================================================================
for (const [name, { cfg }] of configs) fixW30(name, patchLater(name, cfg));

// ---------------------------------------------------------------------------
let stale = 0;
for (const { file, cfg, before } of configs.values()) {
  const rel = path.relative(ROOT, file);
  const text = JSON.stringify(cfg, null, 2) + "\n";
  if (check) {
    if (text !== before) { console.error(`古い: ${rel}（node tools/maps/src/w15_story.mjs で書き直す）`); stale++; }
    else console.log(`一致: ${rel}`);
  } else {
    if (text !== before) fs.writeFileSync(file, text);
    console.log(`${text === before ? "変化なし" : "書き出し"}: ${rel}`);
  }
}
if (stale) process.exit(1);
