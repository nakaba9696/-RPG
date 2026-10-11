// 蘇生師の研究所 090–094
import { bossRoom, orbRoom } from "./gen_lab_rooms.mjs";
import { Grid, writeMap, list, msg, IF, choice, SE, SW, SELF, VAR_ADD, MOVE, TONE, raw, text, transfer, pickup, chest, warp, enemy, rep, bossEvent, CORPSE, DOWN, LEFT, RIGHT, UP } from "./lib.mjs";

const LAB_FIELDS = (b1, b2) => ({ specifyBattleback: true, battleback1Name: b1, battleback2Name: b2 });
const MON = i => ({ characterName: "Monster", characterIndex: i });
const SFMON = i => ({ characterName: "SF_Monster", characterIndex: i });

// ===========================================================================
// 090 研究所・搬入口（40×28）
// ===========================================================================
{
  const g = new Grid(40, 28);
  g.rect(19, 2, 19, 2, "n");          // 坑道（051 の地下壕へ）
  g.rect(18, 3, 20, 5, ",");          // 北の地下壕
  g.rect(18, 6, 20, 23, ",");         // 搬入路
  for (let y = 6; y <= 23; y++) g.set(19, y, "r");
  g.rect(9, 9, 14, 12, ",");          // 守衛室
  g.rect(15, 10, 17, 10, ",");
  g.set(11, 9, "t").set(12, 9, "t");  // 机（12,9 に来訪の記帳）
  g.set(14, 12, "X");
  g.set(10, 8, "D").set(10, 7, "H");  // H32
  g.rect(9, 5, 11, 6, ",");           // 隠し部屋（赤い宝箱「白衣」）
  g.rect(24, 12, 33, 17, ",");        // 荷揚げ場
  g.rect(21, 14, 23, 15, ",");
  g.set(24, 12, "X").set(25, 12, "X").set(33, 17, "X").set(32, 17, "X").set(24, 17, "X");
  g.rect(21, 19, 22, 20, ",");        // 魔石の箱の置き場
  g.set(22, 19, "X").set(22, 20, "X").set(21, 20, "X");
  g.set(19, 24, "S").set(20, 24, "S"); // 南の扉（→ 091）
  console.log("090\n" + g.show());
  writeMap("w5_090_lab_dock", g, {
    _説明: "W5：研究所・搬入口（docs/world2.md 7 章）。北の地下壕（← 051 の地下壕の奥の坑道）→ 搬入路（トロッコの線路と魔石の箱。緑 2・黄 1）。西の守衛室に R39 と来訪の記帳、北の壁が H32 の隠し扉 → 赤い宝箱「白衣」。東の荷揚げ場に結界（灰の泉と記録の書見台）。搬入路の魔石の箱に搬入の札。南の扉 → 091。",
    mapId: 90, name: "研究所・搬入口", displayName: "蘇生師の研究所", legend: "lab", tilesetId: 17,
    note: "<hai_tone:-17,-51,-17,68>",
    fields: LAB_FIELDS("DemonicWorld", "DemonicWorld"),
    chars: {
      n: { name: "坑道（場所移動のマス）", as: "," },
      S: { name: "南の扉（場所移動のマス）", as: "," },
    },
    events: [
      transfer(19, 2, "坑道（帝国の陣跡の地下壕へ）", [51, 19, 3, "down"]),
      transfer(19, 24, "南の扉（実験棟へ）", [91, 21, 3, "down"]),
      transfer(20, 24, "南の扉（実験棟へ）", [91, 22, 3, "down"]),
      text(13, 9, "思念 R39 研究所の守衛", [
        "ここで何を作っているのか、誰も教えてくれない。",
        "所長は若い。教会の孤児院の出だという。口数が少なく、夜も灯を消さない。",
        "王が自ら視察に来られた。女を一人連れていた。",
        "女は守衛の俺に「ご苦労さま」と言った。目が赤かった。",
      ], { note: "<hai_thought:R39>", image: CORPSE(0, 4, 1) }),
      pickup(12, 9, "来訪の記帳（守衛室の机）", { line: "机の上に、厚い記帳が開いたままになっている。", itemId: 501, icon: 121, itemName: "来訪の記帳", image: { tileId: "E:176" } }),
      chest(10, 5, "赤い宝箱（白衣）", { kind: "armor", itemId: 501, icon: 135, itemName: "白衣" }),
      pickup(21, 19, "搬入の札（魔石の箱）", { line: "魔石の箱に、木の札が打ち付けてある。", itemId: 502, icon: 187, itemName: "搬入の札", image: { tileId: "B:221" }, after: { tileId: "B:221" } }),
      warp(31, 13, "荷揚げ場の結界（灰の泉と記録の書見台）", "研究所の荷揚げ場"),
      enemy(19, 10, "試験体の鼠（緑・巡回）", 501, "green", { image: MON(0), route: [...rep(1, 4), ...rep(4, 4)] }),
      enemy(29, 15, "試験体の鼠（緑）", 501, "green", { image: MON(0) }),
      enemy(19, 18, "白衣の亡者（黄・巡回）", 503, "yellow", { image: { characterName: "Damage2", characterIndex: 4 }, route: [...rep(1, 3), ...rep(4, 3)] }),
    ],
  });
}

// ===========================================================================
// 091 実験棟（44×34、暗がり 5）
// ===========================================================================
{
  const g = new Grid(44, 34);
  g.set(21, 2, "N").set(22, 2, "N");
  g.rect(19, 3, 24, 4, ",");          // 北の入口
  g.rect(19, 2, 20, 2, ",").rect(23, 2, 24, 2, ",");
  g.rect(20, 5, 22, 28, ",");         // 中央の廊下
  g.rect(21, 29, 22, 29, ",");        // 封印扉（イベント）
  g.set(21, 30, "S").set(22, 30, "S");
  // H33：入口の西の壁 → 廊下の西の壁の中を南へ → 封印扉の前
  g.set(18, 3, "H");
  for (let y = 3; y <= 27; y++) g.set(17, y, "H");
  g.set(18, 27, "H").set(19, 27, "H");
  // 檻の部屋（西）
  g.rect(7, 8, 13, 12, ",");
  g.rect(14, 10, 19, 10, ",");
  g.set(8, 8, "c").set(9, 8, "c").set(12, 8, "c").set(13, 8, "c");
  // 陣の部屋（南西）
  g.rect(7, 20, 13, 24, ".");
  g.rect(14, 22, 19, 22, ",");
  [["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"]].forEach((r, dy) => r.forEach((c, dx) => g.set(9 + dx, 21 + dy, c)));
  // 硝子の部屋（東）
  g.rect(29, 8, 35, 12, ",");
  g.rect(23, 10, 28, 10, ",");
  g.set(30, 8, "t").set(32, 8, "s").set(33, 8, "s").set(31, 12, "s");
  // 所長室（北東）
  g.rect(30, 2, 35, 5, ",");
  g.rect(25, 3, 29, 3, ",");
  g.set(32, 2, "t").set(33, 2, "t").set(35, 2, "k").set(30, 2, "k");
  // 搬送路（東）
  g.rect(23, 15, 32, 16, ",");
  g.set(33, 15, ",");                  // 搬送路の扉（H34 の裏）
  // 廃液槽（南東）
  g.rect(30, 20, 34, 23, ",");
  g.rect(23, 22, 29, 22, ",");
  g.rect(31, 20, 33, 21, "~");
  g.set(34, 22, ";");                  // H35 の手がかり（廃液の染みた床）
  g.set(35, 22, "H").set(36, 22, "H").set(37, 22, "H");
  g.set(38, 22, "o");                  // 管の口
  console.log("091\n" + g.show());

  const lever = (x, y, name) => raw(x, y, name, [
    { image: { tileId: "E:120" }, priorityType: 1, walkAnime: false, list: list([
      msg(["制御盤に、錆びたレバーが付いている。"]),
      choice(["倒す", "やめる"], 1, [[
        SE("Switch1"), SELF("A"), VAR_ADD(106, 1),
        msg(["レバーを倒した。南の方で、重い音がした。"]),
        IF([1, 106, 0, 3, 1], [SE("Open3"), msg(["封印扉の三つの灯が、そろって灯った。"])]),
      ], []]),
    ]) },
    { conditions: { selfSwitchCh: "A", selfSwitchValid: true }, image: { tileId: "E:122" }, priorityType: 1, walkAnime: false,
      list: list([msg(["レバーは倒してある。"])]) },
  ]);
  const sealDoor = x => raw(x, 29, "中央の封印扉（制御盤 3 つ）", [
    { image: { characterName: "!Door1", characterIndex: 2, direction: 2 }, priorityType: 1, walkAnime: false, list: list([
      msg(["重い封印扉。表に小さな灯が三つ並んでいる。", "灯っているのは \\V[106] つ。"]),
    ]) },
    { conditions: { variableId: 106, variableValid: true, variableValue: 3 }, image: { characterName: "!Door1", characterIndex: 2, direction: 8 }, priorityType: 0, walkAnime: false },
  ]);

  writeMap("w5_091_lab_wards", g, {
    _説明: "W5：実験棟（docs/world2.md 7 章、暗がり 5）。北の入口（← 090）→ 中央の廊下（赤「継ぎ接ぎ」が往復）。西の檻の部屋（制御盤 1・R40）、硝子の部屋（制御盤 2・R41）、南西の陣の部屋（制御盤 3・R42）。北東の所長室の机に蘇生師の印章。東の搬送路の突き当たりが H34 の裏（閂を外すとスイッチ 163 → 027）。南東の廃液槽の裏に H35 の見えない通路 → 管の口（101 へ片道）。入口の西の壁から H33 の見えない通路が廊下の西の壁の中を南へ下り、封印扉の前に出る。封印扉は変数 106 が 3 以上で開く → 092。",
    mapId: 91, name: "実験棟", displayName: "蘇生師の研究所", legend: "lab", tilesetId: 17,
    note: "<hai_tone:-17,-51,-17,68>\n<hai_dark:5>",
    fields: LAB_FIELDS("DemonicWorld", "DemonicWorld"),
    chars: {
      N: { name: "北の入口（場所移動のマス）", as: "," },
      S: { name: "封印扉の奥（場所移動のマス）", as: "," },
      o: { name: "管の口（穴。通れる。H35 の先）", as: ",", tiles: [null, null, "B:31"] },
    },
    events: [
      transfer(21, 2, "北の入口（搬入口へ）", [90, 19, 23, "up"]),
      transfer(22, 2, "北の入口（搬入口へ）", [90, 20, 23, "up"]),
      sealDoor(21), sealDoor(22),
      transfer(21, 30, "封印扉の奥（契約の写し室へ）", [92, 14, 3, "down"]),
      transfer(22, 30, "封印扉の奥（契約の写し室へ）", [92, 15, 3, "down"]),
      lever(11, 8, "制御盤 1（檻の部屋）"),
      lever(34, 8, "制御盤 2（硝子の部屋）"),
      lever(13, 20, "制御盤 3（陣の部屋）"),
      text(12, 9, "思念 R40 起こされた囚人（檻の中の骨）", [
        "一度死んで、起こされた。体は動く。腹は減らない。",
        "所長は毎朝、俺の名前を呼んで、帳面に書く。",
        "今日、戦場に送られる。帝国の兵を押し返すのだという。",
        "死人の兵は、もう一度死ぬまで止まらない。俺は、止まり方を知らない。",
      ], { note: "<hai_thought:R40>", image: { tileId: "B:242" } }),
      text(30, 8, "思念 R41 研究員（研究日誌）", [[
        "蘇生は一刻しかもたない。一刻を一年に延ばすには、何かを払わねばならない。",
        "所長は古書院の禁書庫から、作法の写しを見つけてきた。誰に、何を払うのかが書いてあった。",
        "禁書庫の扉の番号を、所長はよく口ずさんでいた。七、二、五。",
      ], [
        "所長は三日、写しを閉じたまま机に置いていた。",
        "四日目に、王が来た。",
      ]], { note: "<hai_thought:R41><hai_clue:古書院の禁書庫の扉の番号は 7・2・5（研究所の日誌）>", image: { tileId: "E:176" } }),
      text(7, 21, "思念 R42 研究所の助手", [
        "制御盤は三つ。檻と、硝子と、陣の部屋に一つずつ。",
        "三つとも倒せば、中央の封印扉が開く。所長が決めた手順だ。",
        "廊下の継ぎ接ぎに見つかったら終わりだ。西の壁の、影の無い所を抜けろ。",
      ], { note: "<hai_thought:R42><hai_clue:研究所の封印扉は、三つの制御盤を倒すと開く><hai_clue:実験棟の廊下の西の壁、影の無い所を抜けられる>", image: CORPSE(1, 6, 2) }),
      raw(33, 2, "所長室の机（蘇生師の印章）", [
        { priorityType: 1, list: list([
          msg(["机の上に、書きかけの帳面が積んである。", "……この字には、見覚えがある。"]),
          msg(["引き出しの奥に、銀の印章がしまってあった。"]),
          SE("Item1"), [126, [223, 0, 0, 1]], SELF("A"),
          msg(["\\I[196]蘇生師の印章を手に入れた！"]),
        ]) },
        { conditions: { selfSwitchCh: "A", selfSwitchValid: true }, priorityType: 1, list: list([
          msg(["書きかけの帳面。……この字には、見覚えがある。"]),
        ]) },
      ]),
      raw(33, 15, "搬送路の突き当たりの扉（H34 の裏）", [
        { image: { characterName: "!Door1", characterIndex: 6, direction: 2 }, priorityType: 1, walkAnime: false, list: list([
          msg(["搬送路の突き当たりの扉。こちら側に閂がある。", "扉の隙間から、冷たい土の匂いが流れてくる。"]),
          choice(["閂を外す", "やめる"], 1, [[
            SE("Open3"), SW(163),
            msg(["閂を外した。扉の向こうは、坑道の採掘場だった。"]),
            MOVE(27, 28, 16, LEFT),
          ], []]),
        ]) },
        { conditions: { switch1Id: 163, switch1Valid: true }, image: { characterName: "!Door1", characterIndex: 6, direction: 8 }, priorityType: 1, trigger: 1, walkAnime: false,
          list: list([SE("Move1"), MOVE(27, 28, 16, LEFT)]) },
      ]),
      raw(38, 22, "管の口（H35。101 水門の間へ片道）", [
        { priorityType: 0, trigger: 1, list: list([
          SE("Fall"),
          msg(["足を滑らせた！"]),
          MOVE(101, 7, 10, DOWN),
        ]) },
      ]),
      enemy(21, 9, "継ぎ接ぎ（赤・巡回）", 505, "red", { image: { characterName: "Monster", characterIndex: 3 }, chase: 3, route: [...rep(1, 14), ...rep(4, 14)] }),
      enemy(9, 11, "試験体の鼠（緑）", 501, "green", { image: MON(0) }),
      enemy(29, 12, "瓶詰めの目（緑・動かない）", 502, "green", { image: MON(5), chase: 0 }),
      enemy(35, 12, "瓶詰めの目（緑・動かない）", 502, "green", { image: MON(5), chase: 0 }),
      enemy(12, 24, "白衣の亡者（黄）", 503, "yellow", { image: { characterName: "Damage2", characterIndex: 4 } }),
      enemy(34, 5, "白衣の亡者（黄）", 503, "yellow", { image: { characterName: "Damage2", characterIndex: 4 } }),
      enemy(30, 23, "魔石の欠片（黄）", 504, "yellow", { image: MON(6) }),
    ],
  });
}

// ===========================================================================
// 092 契約の写し室（30×20）
// ===========================================================================
{
  const g = new Grid(30, 20);
  g.rect(14, 2, 15, 3, ".");          // 北の口（場所移動と着く所）
  g.set(14, 2, "N").set(15, 2, "N");
  g.set(14, 4, ".");                   // 北の扉（施錠扉：蘇生師の印章）
  g.rect(8, 5, 21, 12, ".");          // 写し室
  [["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"]].forEach((r, dy) => r.forEach((c, dx) => g.set(13 + dx, 7 + dy, c)));
  g.set(8, 5, "k").set(21, 5, "k").set(9, 5, "b");
  g.rect(24, 7, 28, 10, ",");         // 控えの小部屋
  g.rect(22, 9, 23, 9, ",");
  g.rect(14, 13, 15, 14, ".");        // 南の扉
  g.set(14, 15, "S").set(15, 15, "S");
  console.log("092\n" + g.show());
  writeMap("w5_092_contract_copy", g, {
    _説明: "W5：契約の写し室（docs/world2.md 7 章）。北の口（← 091 の封印扉）→ 施錠扉（蘇生師の印章 223）→ 写し室：床に契約の陣の写し、R43、黄 1。東の控えの小部屋に結界（灰の泉と記録の書見台）と R44（ボスの弱点）。南の扉 → 093。",
    mapId: 92, name: "契約の写し室", displayName: "蘇生師の研究所", legend: "lab", tilesetId: 17,
    note: "<hai_tone:0,-51,-17,51>",
    fields: LAB_FIELDS("DemonicWorld", "DemonCastle1"),
    chars: {
      N: { name: "北の口（場所移動のマス）", as: "." },
      S: { name: "南の扉（場所移動のマス）", as: "." },
    },
    events: [
      transfer(14, 2, "北の口（実験棟の封印扉へ）", [91, 21, 28, "up"]),
      transfer(15, 2, "北の口（実験棟の封印扉へ）", [91, 22, 28, "up"]),
      raw(14, 4, "北の扉（施錠扉：蘇生師の印章）", [
        { image: { characterName: "!Door1", characterIndex: 0, direction: 2 }, priorityType: 1, walkAnime: false },
        { conditions: { selfSwitchCh: "A", selfSwitchValid: true }, image: { characterName: "!Door1", characterIndex: 0, direction: 8 }, priorityType: 0, walkAnime: false },
      ], "<hai_locked:蘇生師の印章><hai_key:223>"),
      transfer(14, 15, "南の扉（番人の間へ）", [93, 13, 3, "down"]),
      transfer(15, 15, "南の扉（番人の間へ）", [93, 14, 3, "down"]),
      text(14, 8, "契約の陣の写し", ["床に描かれた陣の写し。赤い線が、まだ脈打っている。"]),
      text(10, 11, "思念 R43 王の侍従", [
        "陛下は「何を払ってもよい」と仰せになった。私はその場にいた。",
        "赤い目の女は、陣の中で指を折って数えた。そして何かを言い、所長は頷いた。陛下も頷いた。",
        "その夜から、城下で人が灰になり始めた。",
        "誰も、私に尋ねはしなかった。私の魂も、払われる分に入っていたのだが。",
      ], { note: "<hai_thought:R43>", image: CORPSE(2, 2, 0) }),
      text(25, 7, "思念 R44 最後の研究員（書き付け）", [
        "陣の番人は、二つの顔を持つ。秤の顔のうちは、刃も呪文も半分しか通らない。",
        "だが秤は火に弱い。所長の灰火で、何度も秤を焦がしたのを見た。",
        "秤が割れたら獣になる。獣は呪文を食うが、刃はよく通る。",
      ], { note: "<hai_thought:R44><hai_clue:契約の番人：秤の顔は火に弱い。獣の顔には刃が通る（研究所）>", image: { tileId: "E:86" } }),
      warp(28, 8, "控えの小部屋の結界（灰の泉と記録の書見台）", "契約の写し室の控え"),
      enemy(19, 10, "魔石の欠片（黄）", 504, "yellow", { image: MON(6) }),
    ],
  });
}

// ===========================================================================
// 093 番人の間（27×19）・094 オーブの間「契約」（17×13）
// ===========================================================================

bossRoom({
  base: "w5_093_keeper_hall", mapId: 93, name: "番人の間", legend: "lab", tilesetId: 17, tone: "17,-51,-34,68",
  fields: LAB_FIELDS("DemonCastle2", "DemonCastle2"),
  desc: "W5：番人の間（docs/world2.md 7 章）。北の口（← 092 の南の扉）→ 床一面の陣の広間。陣の真ん中の契約の番人（ボス。話しかけると「ボス戦」、逃げたら 092 の控えの小部屋 (26,9)）。倒すとスイッチ 154 で南の扉が開く → 094。",
  back: { name: "契約の写し室", map: 92, x: 14, y: 14 },
  boss: bossEvent(13, 9, "契約の番人（ボス）", {
    image: { characterName: "Evil", characterIndex: 6, direction: 2 },
    intro: ["床の陣の真ん中に、秤を掲げた影が立っている。", "影は秤を傾けて、こちらの重さを量っている。"],
    troopId: 506, troopName: "W5_ボス：契約の番人", escape: [92, 26, 9, 4],
    won: ["秤が割れる音がして、影は床の陣に沈んだ。", "南の扉の閂が、ひとりでに外れた。"], sw: 154,
  }),
  nextMap: { name: "オーブの間", map: 94, sw: 154, locked: "重い扉。赤い線が鎖のように絡みついていて、開かない。" },
  decor: g => {
    // 床一面の陣（真ん中に番人）
    [["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"]].forEach((r, dy) => r.forEach((c, dx) => g.set(12 + dx, 8 + dy, c)));
    for (const [x, y] of [[8, 6], [18, 6], [8, 12], [18, 12]]) g.set(x, y, "1").set(x + 1, y, "3").set(x, y + 1, "7").set(x + 1, y + 1, "9");
    g.set(6, 4, "g").set(20, 4, "g");
  },
});


orbRoom({
  base: "w5_094_orb_contract", mapId: 94, name: "オーブの間「契約」", legend: "lab", tilesetId: 17, tone: "-68,-68,-34,68",
  desc: "W5：オーブの間「契約」（docs/world2.md 7 章・11.2）。北の扉（← 093）。小さな陣の間の台座にオーブ「契約」：調べるとスイッチ 103、変数 101 に 1 を足し、場面とスイッチ 107（セレスの正体を知った）、ユエルの一言。変数 101 が 4 ならスイッチ 105・106 とユエルの一言（11.4）。転送陣（スイッチ 103）→ 牢獄の間の広間 010 (16,18)。",
  back: { name: "番人の間", map: 93 },
  pedestalTile: "B:83",
  orb: {
    name: "契約", sw: 103,
    look: "台座の上に、赤い光の脈打つ珠が載っている。",
    scene: [
      "……燃える王都。玉座の間の窓が赤い。",
      "王が玉座から降りて、自分の肩をつかむ。「何を払ってもよい。国を守れ」",
      "自分は床に陣を描く。古い写本の作法どおりに。手は震えていない。",
      "陣の中に、女が立っている。赤い目。黒い髪。",
      "「呼んだのはあなた？　若いのね」女は笑う。「望みは」",
      "「死者を兵に。帝国を押し返す力を」",
      "「いいわ。代価は、この国の民の魂の灰。少しずつ、全部」",
      "王が頷く。自分も、頷く。",
      "女は自分の耳元でささやく。「契約は、あなたが完全な魂でここに立つとき、果たされる」",
      "……その女の名を、自分は知っている。セレス。",
    ],
    after: [SW(107)],
    yuel: "……セレス。お前だったのか",
  },
  decor: g => {
    [["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"]].forEach((r, dy) => r.forEach((c, dx) => g.set(7 + dx, 5 + dy, c)));
    g.set(5, 4, "s").set(11, 4, "s");
  },
});
// BGM（autoplay）は下書きの JSON に直接書いた（研究所 Dungeon5、下水道 Dungeon3、ボスの間 Dungeon7、オーブの間 Scene3、王都の門 Castle3）。作り直すときは設定に bgm を足す
