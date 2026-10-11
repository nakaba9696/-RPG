// 王都の下水道 100–104
import { Grid, writeMap, list, msg, IF, choice, SE, SW, SELF, MOVE, SCRIPT, raw, text, transfer, pickup, chest, warp, enemy, rep, stairs, bossEvent, CORPSE, DOWN, LEFT, RIGHT, UP } from "./lib.mjs";
import { bossRoom, orbRoom } from "./gen_lab_rooms.mjs";

const F = (b1, b2) => ({ specifyBattleback: true, battleback1Name: b1, battleback2Name: b2 });
const MON = i => ({ characterName: "Monster", characterIndex: i });
const STAIRS_CHARS = {
  "<": { name: "上り階段", as: ".", tiles: [null, null, "B:18"] },
  ">": { name: "下り階段", as: ".", tiles: [null, null, "B:26"] },
  o: { name: "暗い横穴（穴D。通れる）", as: ".", tiles: [null, null, "B:31"] },
};

// ===========================================================================
// 100 下水道・上流（44×30、暗がり 5）
// ===========================================================================
{
  const g = new Grid(44, 30);
  g.rect(2, 8, 5, 14, ".");            // 西の排水口の下
  g.set(3, 8, "h");                    // 梯子（073 へ）
  g.rect(6, 8, 41, 9, ".");            // 北の歩道
  g.rect(6, 10, 41, 12, "~");          // 本流
  g.rect(6, 13, 41, 14, ".");          // 南の歩道
  for (let y = 10; y <= 12; y++) g.set(24, y, "|");
  g.set(16, 7, "D").set(16, 6, "H");   // H36
  g.rect(15, 4, 17, 5, ".");           // 隠し部屋（赤い宝箱「水除けの長靴」）
  g.rect(10, 17, 15, 20, ",");         // 下水番の小屋
  g.rect(12, 15, 12, 16, ".");
  g.set(10, 20, "X").set(11, 20, "X").set(15, 20, "b");
  g.set(42, 8, ".");                   // 東の鍵束の扉
  g.rect(38, 15, 39, 26, ".");         // 南東の出口
  g.set(38, 27, "S").set(39, 27, "S");
  g.set(6, 14, ",").set(7, 13, ",").set(30, 8, ",").set(31, 9, ",");
  console.log("100\n" + g.show());
  writeMap("w5_100_sewer_upper", g, {
    _説明: "W5：下水道・上流（docs/world2.md 8 章、暗がり 5）。西の排水口の下（← 073 の排水口。梯子で 073 へ戻れる）→ 本流（水路の両側の歩道。緑 2・黄 1。北の歩道の壁に H36 の隠し扉 → 赤い宝箱「水除けの長靴」）。南の下水番の小屋に R45 と結界（灰の泉と記録の書見台）。北の歩道の東の端が鍵束の扉（← 035 の西の扉。こちらからは閂を外せばスイッチ 160）。南東の出口 → 101。",
    mapId: 100, name: "下水道・上流", displayName: "王都の下水道", legend: "sewer", tilesetId: 18,
    note: "<hai_tone:-51,-34,-51,68>\n<hai_dark:5>",
    fields: F("Cobblestones3", "Stone2"),
    chars: { S: { name: "南東の出口（場所移動のマス）", as: "." } },
    events: [
      raw(3, 8, "梯子（沼主の淵の排水口へ）", [
        { priorityType: 0, trigger: 1, list: list([SE("Move1"), MOVE(73, 13, 5, DOWN)]) },
      ]),
      transfer(38, 27, "南東の出口（水門の間へ）", [101, 19, 3, "down"]),
      transfer(39, 27, "南東の出口（水門の間へ）", [101, 20, 3, "down"]),
      raw(42, 8, "鍵束の扉（拷問の間の西の扉へ）", [
        { image: { characterName: "!Door1", characterIndex: 1, direction: 2 }, priorityType: 1, walkAnime: false, list: list([
          msg(["鉄の扉。こちら側に太い閂が掛かっている。"]),
          choice(["閂を外す", "やめる"], 1, [[
            SE("Open3"), SW(160),
            msg(["閂を外した。扉の向こうから、乾いた血の匂いがする。"]),
          ], []]),
        ]) },
        { conditions: { switch1Id: 160, switch1Valid: true }, image: { characterName: "!Door1", characterIndex: 1, direction: 8 }, priorityType: 1, trigger: 1, walkAnime: false,
          list: list([SE("Move1"), MOVE(35, 6, 7, RIGHT)]) },
      ]),
      chest(16, 4, "赤い宝箱（水除けの長靴）", { kind: "armor", itemId: 503, icon: 146, itemName: "水除けの長靴" }),
      text(10, 17, "思念 R45 下水番（下水番の日誌）", [
        "王都に白い膜が張られた日から、上から人が降りてこなくなった。",
        "水は今も流れてくる。灰が混じって、白く濁っている。",
        "水門の間の取っ手で、東と西の水路を切り替えられる。片方を閉じれば、もう片方は歩ける。",
      ], { note: "<hai_thought:R45><hai_clue:下水道の水門の間の取っ手で、東西の水路を切り替えられる>", image: { tileId: "E:176" } }),
      warp(14, 17, "下水番の小屋の結界（灰の泉と記録の書見台）", "下水番の小屋"),
      enemy(20, 13, "溝鼠（緑・巡回）", 507, "green", { image: MON(0), route: [...rep(3, 6), ...rep(2, 6)] }),
      enemy(28, 14, "溝鼠（緑）", 507, "green", { image: MON(0) }),
      enemy(33, 14, "灰の澱（緑・動かない）", 508, "green", { image: MON(4), chase: 0 }),
      enemy(22, 8, "近衛の亡霊（黄・巡回）", 509, "yellow", { image: { characterName: "Damage3", characterIndex: 6 }, route: [...rep(3, 6), ...rep(2, 6)] }),
    ],
  });
}

// ===========================================================================
// 101 水門の間（40×30、暗がり 5）
// ===========================================================================
{
  const g = new Grid(40, 30);
  g.set(19, 2, "N").set(20, 2, "N");
  g.rect(18, 3, 21, 4, ".").rect(18, 2, 18, 2, ".").rect(21, 2, 21, 2, ".");
  g.rect(19, 5, 20, 6, ".");
  g.rect(15, 7, 24, 12, ".");          // 水門の踊り場
  // 西の水路
  g.rect(9, 9, 14, 10, ".");
  g.rect(6, 9, 8, 11, ",");
  g.rect(6, 12, 8, 17, "~");
  g.rect(6, 18, 8, 24, ",");
  g.set(6, 9, "p");                    // 廃液管の出口（H35 の着地点の上）
  g.set(7, 24, ">");
  // 東の水路
  g.rect(25, 9, 30, 10, ".");
  g.rect(31, 9, 33, 11, ",");
  g.rect(31, 12, 33, 17, "~");
  g.rect(31, 18, 33, 24, ",");
  g.set(30, 19, "H").set(29, 19, "H").set(28, 19, "H").set(27, 19, ",").set(26, 19, "o"); // H37
  console.log("101\n" + g.show());
  const flood = (x, y, side) => raw(x, y, `${side}の水路（スイッチ 162 で水が${side === "西" ? "満ちる" : "引く"}）`,
    side === "西"
      ? [{ image: { tileId: "B:148" }, priorityType: 0 }, { conditions: { switch1Id: 162, switch1Valid: true }, priorityType: 0 }]
      : [{ priorityType: 0 }, { conditions: { switch1Id: 162, switch1Valid: true }, image: { tileId: "B:148" }, priorityType: 0 }]);
  const handleList = list([
    msg(["水門の取っ手。回すと、東と西の水門が入れ替わるようだ。"]),
    choice(["回す", "やめる"], 1, [[
      SE("Water1"),
      IF([0, 162, 1], [SW(162, true), msg(["西の水門が閉じた。東の水路の水が引いていく。"])],
        [SW(162, false), msg(["東の水門が閉じた。西の水路の水が引いていく。"])]),
    ], []]),
  ]);
  writeMap("w5_101_sluice_hall", g, {
    _説明: "W5：水門の間（docs/world2.md 8 章、暗がり 5）。北の入口（← 100）→ 水門の踊り場：水門の取っ手（スイッチ 162 の切り替え）、R46、黄 1。西の水路（162 が OFF で歩ける。北の端の排水溝の上に廃液管の出口＝ H35 の着地点。突き当たりの下り階段 → 102 の北）、東の水路（162 が ON で歩ける。赤「下水の大蛇」と宝箱、西の壁の影の無い所が H37 の見えない通路 → 102 の北東）。",
    mapId: 101, name: "水門の間", displayName: "王都の下水道", legend: "sewer", tilesetId: 18,
    note: "<hai_tone:-51,-34,-51,68>\n<hai_dark:5>",
    fields: F("Cobblestones3", "Stone2"),
    chars: { N: { name: "北の入口（場所移動のマス）", as: "." }, ...STAIRS_CHARS },
    events: [
      transfer(19, 2, "北の入口（下水道・上流へ）", [100, 38, 26, "up"]),
      transfer(20, 2, "北の入口（下水道・上流へ）", [100, 39, 26, "up"]),
      transfer(7, 24, "下り階段（結界の真下へ）", [102, 5, 3, "down"]),
      transfer(26, 19, "暗い横穴（H37。結界の真下の北東へ）", [102, 34, 3, "down"]),
      raw(17, 7, "水門の取っ手（スイッチ 162）", [
        { image: { characterName: "!Switch1", characterIndex: 0, direction: 2 }, priorityType: 1, walkAnime: false, list: handleList },
        { conditions: { switch1Id: 162, switch1Valid: true }, image: { characterName: "!Switch1", characterIndex: 0, direction: 8 }, priorityType: 1, walkAnime: false, list: handleList },
      ]),
      text(16, 11, "思念 R46 王都から逃げてきた女", [
        "蘇生師さまが、門の内側で何かを描いていた。白い線が空まで伸びた。",
        "「外へ。早く」と、あの方はわたしを下水の口へ押した。",
        "しばらくして、あの方も下水へ降りてきた。暗い方へ、結界の真下へ歩いていった。",
        "胸に、何かを刻むつもりだと言っていた。",
      ], { note: "<hai_thought:R46>", image: CORPSE(3, 2, 1) }),
      ...[12, 13, 14, 15, 16, 17].map(y => flood(7, y, "西")),
      ...[12, 13, 14, 15, 16, 17].map(y => flood(32, y, "東")),
      chest(32, 24, "宝箱（凍て石）", { kind: "item", itemId: 302, icon: 65, itemName: "凍て石", count: 2 }),
      enemy(23, 11, "近衛の亡霊（黄）", 509, "yellow", { image: { characterName: "Damage3", characterIndex: 6 } }),
      enemy(32, 22, "下水の大蛇（赤）", 511, "red", { image: MON(1), chase: 2, fixed: true }),
      enemy(7, 21, "灰の澱（緑・動かない）", 508, "green", { image: MON(4), chase: 0 }),
    ],
  });
}

// ===========================================================================
// 102 結界の真下（40×28）
// ===========================================================================
{
  const g = new Grid(40, 28);
  g.rect(4, 2, 9, 5, ".");             // 北の階段の下
  g.set(5, 2, "<");
  g.rect(32, 2, 35, 5, ".");           // 北東の隅（H37 の出口）
  g.set(34, 2, "<");
  // 光の迷路（24×14）。l＝光の床（踏むと押し戻される）
  const MAZE = [
    "..llllllllllllllllllll..",
    "................l.......",
    "lllllllll.lllllllllll...",
    "...l........l.........l.",
    "...l..l.l...l..l..l.....",
    "llll..l.lllllllllllllll.",
    "......l......l..........",
    ".lllllllllll.l.llll.lll.",
    ".....l.....l.l....l..l..",
    ".l.l.l..l..l...l..l..l..",
    ".l.l...ll.lllllllll..lll",
    ".l.lllll..l.........l...",
    ".l.....l..l.lllll.l.l.l.",
    ".lllll.l.......l..l...l.",
  ];
  MAZE.forEach((row, dy) => [...row].forEach((c, dx) => g.set(8 + dx, 6 + dy, c)));
  g.rect(8, 5, 9, 5, ".").rect(30, 5, 31, 5, ".");
  g.rect(19, 20, 20, 21, ".");         // 迷路の出口
  g.rect(17, 22, 22, 25, ",");         // 控え室
  g.set(19, 26, "S").set(20, 26, "S");
  g.rect(2, 22, 5, 24, ".");           // 南西の隅の小部屋（H38 の下）
  g.set(5, 22, "<");
  const v = { x: 30, y: 18 };
  g.set(v.x, v.y, "v");                // H38
  console.log("102\n" + g.show());
  // 迷路が光の床を踏まずに抜けられるか（北西の入口 → 控え室の扉、北東の入口 → 控え室の扉、隠し階段）
  const walk = (sx, sy) => {
    const seen = new Set([`${sx},${sy}`]);
    const q = [[sx, sy]];
    while (q.length) {
      const [x, y] = q.shift();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
        if (nx < 0 || ny < 0 || nx >= g.w || ny >= g.h || seen.has(k)) continue;
        if (!".,vS<".includes(g.get(nx, ny))) continue;
        seen.add(k);
        q.push([nx, ny]);
      }
    }
    return seen;
  };
  for (const [sx, sy] of [[5, 3], [34, 3]]) {
    const r = walk(sx, sy);
    if (!r.has("19,26") || !r.has(`${v.x},${v.y}`)) { console.log(g.g.map((row, y) => row.map((c, x) => r.has(x + "," + y) ? "o" : c).join("")).join("\n")); } if (!r.has("19,26") || !r.has(`${v.x},${v.y}`)) throw new Error(`102 の迷路が抜けられない (${sx},${sy})`);
  }
  const pushBack = list([
    IF([12, "!$gamePlayer.isMoving() && $gameMap.tileId($gamePlayer.x, $gamePlayer.y, 2) === 173"], [
      [224, [[255, 255, 255, 170], 20, false]],
      SE("Saint3", 80, 120),
      msg(["白い光に押し戻された。"]),
      [205, [-1, { list: [{ code: 13, parameters: [] }, { code: 0, parameters: [] }], repeat: false, skippable: true, wait: true }]],
      [505, [{ code: 13, parameters: [] }]],
    ]),
  ]);
  writeMap("w5_102_beneath_barrier", g, {
    _説明: "W5：結界の真下（docs/world2.md 8 章）。北西の階段の下（← 101 の西の水路の階段）と北東の隅（← 101 の H37）→ 光の迷路：天井の格子から光が差す床（B:173）を踏むと、並列のイベントが白く光らせて「白い光に押し戻された」で 1 歩戻す。入口に R48、光の当たらない床のひび割れ (30,18) が H38 の隠し階段 → 南西の隅の小部屋（赤い宝箱「近衛の盾」）。白い蛾（黄 2）、水溜まりに白い澱。南の控え室に結界（灰の泉と記録の書見台）、R47、壁にユエルの刻み R49、その下に錠前師の型紙。南の扉 → 103。",
    mapId: 102, name: "結界の真下", displayName: "王都の下水道", legend: "sewer", tilesetId: 18,
    note: "<hai_tone:17,17,34,102>",
    fields: F("Cobblestones3", "Stone3"),
    chars: { S: { name: "南の扉（場所移動のマス）", as: "," }, ...STAIRS_CHARS },
    events: [
      transfer(5, 2, "上り階段（水門の間の西の水路へ）", [101, 7, 23, "up"]),
      transfer(34, 2, "上り口（H37。水門の間の東の水路の横穴へ）", [101, 27, 19, "right"]),
      transfer(19, 26, "南の扉（灰の騎士の間へ）", [103, 13, 3, "down"]),
      transfer(20, 26, "南の扉（灰の騎士の間へ）", [103, 14, 3, "down"]),
      raw(0, 0, "結界の光（光の床を踏むと押し戻す。並列）", [{ priorityType: 0, trigger: 4, list: pushBack }]),
      text(9, 7, "思念 R48 結界を見上げていた子ども（小さな靴）", [
        "天井の白い光、きれいだね。でも近づくと、押し返されるの。",
        "光の当たらない床に、割れた石が一つあるよ。下にお部屋があるの。",
        "お父さんは門の上にいる。光の向こう。",
        "わたし、ここで待ってる。光が消えたら、すぐ会えるから。",
      ], { note: "<hai_thought:R48><hai_clue:結界の真下の光の当たらない床に、割れた石。下に部屋がある（下水道）>", image: { tileId: "E:182" } }),
      stairs(v.x, v.y, "H38 隠し階段（南西の隅の小部屋へ）", 102, 4, 23, 2),
      transfer(5, 22, "上り階段（光の迷路のひび割れの床へ）", [102, 29, 18, "left"]),
      chest(2, 22, "赤い宝箱（近衛の盾）", { kind: "armor", itemId: 504, icon: 128, itemName: "近衛の盾" }),
      pickup(18, 10, "白い澱（光の迷路の水溜まり）", { line: "水溜まりの底に、白い澱が沈んでいる。握ると温かい。", itemId: 505, icon: 190, itemName: "白い澱", image: { tileId: "E:85" } }),
      warp(22, 23, "控え室の結界（灰の泉と記録の書見台）", "結界の真下の控え室"),
      text(21, 25, "思念 R47 王の近衛", [
        "隊長は、門に誰も近づけるなと命じられた。王の最後の命令だ。",
        "王が灰になっても、隊長は命令を解かれていない。",
        "隊長の鎧は灰でできている。冷えると脆くなる。",
        "それに隊長は、自分が誰を守っているのか、ときどき分からなくなる。",
      ], { note: "<hai_thought:R47><hai_clue:灰の騎士は氷に弱く、混乱が効く（下水道）>", image: CORPSE(4, 8, 1) }),
      raw(17, 21, "思念 R49 壁の刻み（ユエル自身）", [
        { priorityType: 1, list: list([
          msg(["壁に、爪で刻んだような字がある。見覚えのある字だ。"]),
          msg(["門は閉じた。錠は俺だ。中の者は眠ったまま、取り立てを免れる。", "外の灰は止まらない。遅くなるだけだ。すまない。", "次に誰かが俺を起こしても、門を開けてはいけない。"]),
          msg(["……俺の字だ"], { name: "\\N[1]" }),
        ]) },
      ], "<hai_thought:R49>"),
      pickup(17, 22, "錠前師の型紙（壁の刻みの下）", { line: "壁の刻みの下に、紙の束が落ちている。", itemId: 503, icon: 122, itemName: "錠前師の型紙", image: { tileId: "E:86" }, priority: 0 }),
      enemy(14, 8, "白い蛾（黄）", 510, "yellow", { image: MON(2), chase: 2, fixed: true }),
      enemy(24, 13, "白い蛾（黄）", 510, "yellow", { image: MON(2), chase: 2, fixed: true }),
    ],
  });
}

// ===========================================================================
// 103 灰の騎士の間・104 オーブの間「封印」
// ===========================================================================
bossRoom({
  base: "w5_103_ash_knight_hall", mapId: 103, name: "灰の騎士の間", legend: "sewer", tilesetId: 18, tone: "34,34,51,119",
  fields: F("Castle1", "Castle1"),
  desc: "W5：灰の騎士の間（docs/world2.md 8 章）。北の口（← 102 の南の扉）→ 錠の間の前室（天井が白く光る）。灰の騎士（ボス。話しかけると「ボス戦」、逃げたら 102 の控え室 (19,24)）。倒すとスイッチ 155 で南の扉が開く → 104。",
  back: { name: "結界の真下", map: 102, x: 19, y: 25 },
  boss: bossEvent(13, 9, "灰の騎士（ボス）", {
    image: { characterName: "Evil", characterIndex: 2, direction: 2 },
    intro: ["白く光る天井の下に、灰の鎧の騎士が立っている。", "騎士は剣を抜いた。「門に近づくな」"],
    troopId: 512, troopName: "W5_ボス：灰の騎士", escape: [102, 19, 24, 8],
    won: ["灰の鎧が崩れて、白い床に積もった。", "南の扉の閂が、ひとりでに外れた。"], sw: 155,
  }),
  nextMap: { name: "オーブの間", map: 104, sw: 155, locked: "重い扉。白い光が隙間から漏れているが、開かない。" },
  decor: g => {
    for (const [x, y] of [[8, 6], [18, 6], [8, 12], [18, 12], [13, 5]]) g.set(x, y, "l");
    g.set(6, 4, "x").set(20, 14, "x");
  },
});

orbRoom({
  base: "w5_104_orb_seal", mapId: 104, name: "オーブの間「封印」", legend: "sewer", tilesetId: 18, tone: "51,51,68,136",
  desc: "W5：オーブの間「封印」（docs/world2.md 8 章・11.3）。北の扉（← 103）。結界の真下の小部屋。床に古い血の跡（調べると文章）。台座にオーブ「封印」：調べるとスイッチ 104、変数 101 に 1 を足し、場面とユエルの一言。変数 101 が 4 ならスイッチ 105・106 とユエルの一言（11.4）。転送陣（スイッチ 104）→ 牢獄の間の広間 010 (16,18)。",
  back: { name: "灰の騎士の間", map: 103 },
  pedestalTile: "B:83",
  orb: {
    name: "封印", sw: 104,
    look: "台座の上に、白く光る珠が載っている。",
    scene: [
      "……白い線が、門の内側から空へ伸びていく。自分が描いた陣だ。",
      "「外へ。早く」逃げ遅れた女を、下水の口へ押しやる。",
      "門が閉じる。王都の民は、皆、家の中で眠りについた。取り立ては、ここで止まる。",
      "自分も下水へ降りる。暗い方へ。結界の真下へ。",
      "胸に刃を当てる。錠の印を刻む。痛みは思ったより少ない。",
      "足音。振り向くと、赤い目がこちらを見ている。",
      "「何をしたの」声がかすれている。",
      "「すまない。契約は果たさせない」",
      "「……あなたが死んだら、魂はばらばらになるわよ。誰があなたを拾うの」",
      "「次に目を覚ましたら、俺はたぶん何も覚えていない。それでいい」",
      "白い光が下りてくる。自分の名前が、もう思い出せない。",
    ],
    yuel: "……門を、開けてはいけない。そう決めたはずだった",
    extra: [
      raw(6, 9, "古い血の跡", [{ priorityType: 0, list: list([msg(["床に、黒く乾いた血の跡がある。ここで誰かが倒れたようだ。"])]) }]),
    ],
  },
  decor: g => {
    for (const [x, y] of [[6, 5], [10, 5], [6, 7], [10, 7]]) g.set(x, y, "l");
    g.set(6, 9, ",").set(7, 9, ",");
  },
});
