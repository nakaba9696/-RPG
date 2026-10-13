// W14（#234）後半：頂（015）の地図とイベント、耐える戦い「夜の思い」のバトルイベント。台本は docs/story/scenes/04-climax.md の 5 章。
// w14_data.mjs が読む（地図・設定・データベースを書くのは w14_data.mjs）。文は場面表のまま写す（変えない）。
//   P14（#230）の仕掛け（耐える／呼ぶの命令・灰を止める・結末を見た全体の旗）を呼ぶ所は、注釈（108）「P14：」で印を付けた。
import { say, center, plugin, SW, VAR, ITEM, MAP, FLAG } from "./w14_parts.mjs";

const cmd = (code, parameters, indent = 0) => ({ code, indent, parameters });
const END = cmd(0, []);
const end = indent => cmd(0, [], indent);
const se = (name, indent = 0, volume = 90, pitch = 100) => cmd(250, [{ name, volume, pitch, pan: 0 }], indent);
const wait = (n, indent = 0) => cmd(230, [n], indent);
const switchOn = (id, indent = 0) => cmd(121, [id, id, 0], indent);
const selfOn = (ch = "A", indent = 0) => cmd(123, [ch, 0], indent);
const ifSwitch = (id, on = true, indent = 0) => cmd(111, [0, id, on ? 0 : 1], indent);
const ifScript = (expr, indent = 0) => cmd(111, [12, expr], indent);
const ELSE = (indent = 0) => cmd(411, [], indent);
const ENDIF = (indent = 0) => cmd(412, [], indent);
const comment = (text, indent = 0) => cmd(108, [text], indent);
const label = (name, indent = 0) => cmd(118, [name], indent);
const jump = (name, indent = 0) => cmd(119, [name], indent);
const choice = (options, cancel, indent = 0) => cmd(102, [options, cancel, 0, 2, 0], indent);
const when = (i, text, indent = 0) => cmd(402, [i, text], indent);
const ENDCHOICE = (indent = 0) => cmd(404, [], indent);
const varAdd = (id, n, indent = 0) => cmd(122, [id, id, 1, 0, n], indent);
const tint = (rgbg, frames, indent = 0) => cmd(223, [rgbg, frames, true], indent);
const removeActor = (id, indent = 0) => cmd(129, [id, 1, false], indent);
/** 条件が合えば中身（indent+1） */
const iff = (cond, body, indent = 0) => [cond(indent), ...body(indent + 1), end(indent + 1), ENDIF(indent)];
const sw = id => `$gameSwitches.value(${id})`;

const DOWN = 2, LEFT = 4, RIGHT = 6, UP = 8;

// 加入（P11）とアクター（仲間 7 人。Actors 5–11）
const MATE = {
  bruno: { sw: FLAG.bruno, actor: 5, name: "ブルーノ" },
  nora: { sw: FLAG.nora, actor: 6, name: "ノラ" },
  dil: { sw: FLAG.dil, actor: 7, name: "ディル" },
  zelina: { sw: FLAG.zelina, actor: 8, name: "ゼリナ" },
  anselmo: { sw: FLAG.anselmo, actor: 9, name: "アンセルモ" },
  beltran: { sw: FLAG.beltran, actor: 10, name: "ベルトラン" },
  tura: { sw: FLAG.tura, actor: 11, name: "トゥーラ" },
};
const N = { lucien: "ルシアン", sorenne: "ソレンヌ", mirlene: "ミルレーネ" };

// 頂の旗（W14 の帯）。章末 1 の 1156–1166 は w14_parts の SW、ここで足すのは場面の進みだけ
export const SUMMIT_SW = {
  readInscription: 1174, // 頂:銘を読んだ（ルシアンの場面の合図）
  shadesGone: 1175, // 頂:群れが消えた
  mirleneHere: 1176, // 頂:ミルレーネが来ている（真の結末の条件がそろっている）
  fastForward: 1177, // 頂:早送り（二周目。数だけ進める）
};
export const SUMMIT_SWITCH_NAMES = {
  [SUMMIT_SW.readInscription]: "頂:銘を読んだ",
  [SUMMIT_SW.shadesGone]: "頂:群れが消えた",
  [SUMMIT_SW.mirleneHere]: "頂:ミルレーネが来ている",
  [SUMMIT_SW.fastForward]: "頂:早送り",
};
export const TROOP_NIGHT = 1152;
const VAR_COMPANIONS = 102; // 連れている仲間の数（P11）
const VAR_SURVIVORS = 103; // 生き残りの数（W6）
const ITEM_TONGUE = 606; // 親鐘の舌（W10）
const ERRAND = { tools: 162, copies: 163 }; // 頼みごと「頂の道具」「本物の写し」（P12）
const SW_THIRD_COPY = 1057; // テオの三通り目を見た（W12）
// 言い残し（夜の戸。P14 の表と同じスイッチ。読むだけ）
const LEGACY = { woodcutter: 314, burntChild: 413, lineWoman: 1061, namelessSoldier: 620 };

// 頂の道具と写しがそろっているか（場面表 5.1。道具＝変数 162 が 2 以上〔鐘鉄を渡して長が打つ〕、写し＝変数 163 が 3〔夕べの会に渡した〕かスイッチ 1057）
const READY = `$gameVariables.value(${ERRAND.tools}) >= 2 && ($gameVariables.value(${ERRAND.copies}) === 3 || ${sw(SW_THIRD_COPY)})`;
// 真の結末の条件（world.md 9.3。〔秘〕）：仲間 7 人完全体（変数 131〜137 が全部 4）＋生き残り 7 人（変数 103 が 7）＋ミルレーネが砦にいる（1152）
const TRUE_END = `${sw(SW.mirleneFort)} && [131, 132, 133, 134, 135, 136, 137].every(v => $gameVariables.value(v) >= 4) && $gameVariables.value(${VAR_SURVIVORS}) >= 7`;

const IMG = {
  lucien: { characterName: "People3", characterIndex: 7, direction: UP, pattern: 1 },
  sorenne: { characterName: "People4", characterIndex: 6, direction: UP, pattern: 1 },
  mirlene: { characterName: "People4", characterIndex: 3, direction: UP, pattern: 1 },
  shade: { characterName: "Monster", characterIndex: 5, direction: UP, pattern: 1 },
  rope: { characterName: "!Other1", characterIndex: 4, direction: DOWN, pattern: 1 },
};

// ===========================================================================
// 015 山の頂の鐘楼（40 × 30）：南の石段（183 から）→ 足場（親鐘の周り）。親鐘の肌（銘）・口（舌を吊る）・綱
// ===========================================================================
export function draw015(Grid) {
  const g = new Grid(40, 30, " ");
  const d = new Grid(40, 30, ".");
  g.rect(6, 4, 33, 26, "."); // 頂の床（風が灰を払っている）
  g.rect(19, 27, 21, 29, "."); // 南の石段 ← 183
  g.rect(15, 3, 25, 9, "#"); // 親鐘の鐘楼（石組み）
  g.rect(10, 10, 29, 16, ";"); // 足場の下の灰
  for (const [x, y, ch] of [[7, 5, "r"], [32, 5, "r"], [7, 25, "x"], [32, 24, "r"], [12, 20, "p"], [27, 20, "p"]]) d.set(x, y, ch);
  return { g, d };
}
export const E015 = {
  entry: [20, 29], arrive: [20, 28], inscription: [18, 10], mouth: [20, 10], rope: [22, 10],
  lucien: [17, 12], sorenne: [24, 13], mirlene: [14, 13],
  shades: [[11, 18], [14, 20], [17, 22], [20, 23], [23, 22], [26, 20], [29, 18], [9, 14], [31, 14], [20, 19]],
};

// --- 5.1 足場とルシアン（183 から上がったとき自動） ---
function arrivalList() {
  return [
    ...say(["灰は降っていない。風が灰を払い、床が黒く出ている。", "親鐘。舌が無く、口は暗い。周りに、木の足場。", "板の一枚に、砦の倉の焼き印。"]),
    ...say(["鳴らしてくれて、ありがとう。あとは、私が彫ります", "今度は一晩もかからない。使徒を、境の向こうへ全部"], N.lucien),
    ...iff(i => ifSwitch(FLAG.timber, true, i), i => say(["足場の脇に、ソレンヌが運んだ木の束が立てかけてある。"], "", i)),
    ...say(["あなたの連れは、何人です"], N.lucien),
    ...iff(i => ifSwitch(MATE.bruno.sw, true, i), i => [
      ...iff(j => ifScript(`$gameVariables.value(${VAR_COMPANIONS}) === 7`, j), j => say(["……七人です"], MATE.bruno.name, j), i),
      ...iff(j => ifScript(`$gameVariables.value(${VAR_COMPANIONS}) !== 7`, j), j => say(["……\\V[102]人です"], MATE.bruno.name, j), i),
      ...say(["ルシアンには聞こえなかった。ルシアンは頷いた。"], "", i),
    ]),
    ...say(["そうですか。多いですね"], N.lucien),
    comment("W14：真の結末の条件がそろっていれば、ミルレーネが足場の下に来ている（場面表 5.8。〔秘〕。条件は見せない）"),
    ...iff(i => ifScript(TRUE_END, i), i => [switchOn(SUMMIT_SW.mirleneHere, i)]),
    selfOn(),
    END,
  ];
}

// --- 5.2 親鐘の銘 ---
const inscriptionLines = [
  ...say(["古い字。線が一筆で戻ってきて、読めない。", "一か所だけ、読める形がある。", "記録院の写しの、終わりの近くの一行と同じ形。", "「鳴る音に、その日の者を乗せよ」"]),
  ...say(["その上に、新しい字が彫りかけてある。教会の字。", "「鳴る所は、東の果て」", "果て、の次で、鑿が止まっている。"]),
  ...say(["「ここで、止まっている」"]),
];

// --- 5.3 ルシアンを止める ---
function stopLucienList() {
  return [
    comment("W14：場面表 5.3。道具と写しがそろっていれば彫りはじめる。止めるまで選択肢をくり返す（鳴らさない道・彫り直しが進む道は作らない）"),
    ifScript(READY),
    ...say(["ルシアンの鑿が、「果て」の続きに当たっている。"], "", 1),
    label("掴む", 1),
    choice(["手首を掴む", "見ている"], -1, 1),
    when(0, "手首を掴む", 1), end(2),
    when(1, "見ている", 1),
    ...say(["ルシアンは、こちらを見た。鑿は止めなかった。"], "", 2),
    jump("掴む", 2),
    end(2),
    ENDCHOICE(1),
    ...say(["ルシアンの手は細く、冷たかった。鑿が鐘の肌を離れた。"], "", 1),
    ...say(["あなたは、向こうに誰かいるのか"], N.lucien, 1),
    ...say(["ルカは答えなかった。手は離さなかった。"], "", 1),
    ...say(["かたじけない。ここからは、わたしが"], N.sorenne, 1),
    ...say(["ソレンヌは長の手から鑿を取って、自分の帯に差した。"], "", 1),
    ifSwitch(FLAG.timber, true, 1),
    ...say(["長。木は、下ろす", "段は、わたしが数えました。長ではなく"], N.sorenne, 2),
    ...say(["ソレンヌは足場の板を一枚外した。板は斜面へ落ちた。"], "", 2),
    switchOn(SW.sorenneAlive, 2),
    end(2),
    ELSE(1),
    ...say(["長。段は、ここまでです"], N.sorenne, 2),
    ...say(["ソレンヌは長の前に立ったまま、膝をついた。", "鑿は、帯に差したままだった。"], "", 2),
    end(2),
    ENDIF(1),
    ...say(["ルシアンは足場の残った板に、座りこんだ。", "鑿の無い手を、膝の上に置いた。"], "", 1),
    ...say(["そうですか"], N.lucien, 1),
    end(1),
    ELSE(0),
    ...say(["ルシアンは鑿を鐘の肌に当て、当てたまま、下ろした。"], "", 1),
    ...say(["道具が、足りませんね。……いえ、言い訳です"], N.lucien, 1),
    ...say(["ルシアンは足場に座りこんだ。"], "", 1),
    end(1),
    ENDIF(0),
    switchOn(SW.lucienStopped),
    END,
  ];
}

// --- 5.4 舌を吊る → 5.5 耐える戦い ---
function mouthList() {
  return [
    ifSwitch(SW.lucienStopped, false),
    comment("W14：ルシアンの場面がまだなら、先にそれを出す（銘を読んだのと同じ合図）", 1),
    switchOn(SUMMIT_SW.readInscription, 1),
    end(1),
    ELSE(0),
    ifScript(`$gameParty.hasItem($dataItems[${ITEM_TONGUE}]) && ${sw(SW.ropeFixed)}`, 1),
    ...iff(i => ifSwitch(MATE.tura.sw, true, i), i => say(["兄貴。これ、重いぞ。", "背負ってるあいだは軽いんだよ。渡すと重い"], MATE.tura.name, i), 2),
    ...say(["舌を吊った。綱を引いて、金具を上げた。", "舌が鐘の口の中で一度揺れて、鐘の肌に触れた。", "音は、しなかった。"], "", 2),
    cmd(242, [2], 2), cmd(246, [2], 2), wait(40, 2),
    ...say(["風が止んだ。", "斜面の下から、何かが上ってくる。"], "", 2),
    switchOn(SW.tongueHung, 2),
    wait(60, 2),
    ...say(["姿の薄い影。営倉で、記録院で、水底で、鋳物場で、", "鐘のあとに東を向いて止まっていた者たち。"], "", 2),
    ...iff(i => ifSwitch(MATE.bruno.sw, true, i), i => say(["あなた。あれは"], MATE.bruno.name, i), 2),
    ...say(["「止まっていた」"], "", 2),
    ...say(["影が、ルカの方へ向いた。二百年ぶんの顔が、一斉に。"], "", 2),
    comment("耐える戦いの命令「耐える」「呼ぶ」は Hai_Apostle のパラメータ endureCommands（P14）", 2),
    cmd(301, [0, TROOP_NIGHT, false, false], 2),
    switchOn(SW.endured, 2),
    end(2),
    ELSE(1),
    ...iff(i => ifScript(`!$gameParty.hasItem($dataItems[${ITEM_TONGUE}])`, i), i => say(["吊り金具が、空のまま揺れている。舌が無い。"], "", i), 2),
    ...iff(i => ifSwitch(SW.ropeFixed, false, i), i => say(["綱が、金具まで通っていない。根の巻き上げが硬いままだ。"], "", i), 2),
    end(2),
    ENDIF(1),
    end(1),
    ENDIF(0),
    END,
  ];
}

// --- 5.6〜5.9 綱：引く／まだ・三十・三十一・頂の終わり ---
const KANJI = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九",
  "二十", "二十一", "二十二", "二十三", "二十四", "二十五", "二十六", "二十七", "二十八", "二十九", "三十", "三十一"];
// 「まだ」の一周目（加入順に一人ずつ）。二周目からは相づち
const NOT_YET = [
  [MATE.zelina, "まだ、って顔しとるな。あんた、勘定が長いわ"],
  [MATE.beltran, "いいぜ。もう一本飲んでから、ってやつだ。飲めねえけどな"],
  [MATE.bruno, "……いち、に、さん。すみません。待つのは、慣れてます"],
  [MATE.nora, "早くしてよ！　ううん、まだでいい"],
  [MATE.dil, "読み終わるまで待てよ。あんたの顔を"],
  [MATE.anselmo, "お前さん。わしの歌、最後まで聞いたことないじゃろ"],
  [MATE.tura, "兄貴、手ぇ震えてんぞ。いいよ。まだで"],
];
function notYetList(indent) {
  // 変数 1151（まだの回数）を 1 足し、その番の仲間がいれば一言。一周したら二周目の相づち
  const out = [varAdd(VAR.notYet, 1, indent)];
  NOT_YET.forEach(([m, line], i) => {
    out.push(...iff(j => ifScript(`$gameVariables.value(${VAR.notYet}) === ${i + 1}`, j), j => [
      ...iff(k => ifSwitch(m.sw, true, k), k => say([line], m.name, k), j),
    ], indent));
  });
  out.push(...iff(j => ifScript(`$gameVariables.value(${VAR.notYet}) > ${NOT_YET.length}`, j), j => [
    ...iff(k => ifScript(`$gameVariables.value(${VAR.notYet}) % 2 === 0 && ${sw(MATE.zelina.sw)}`, k), k => say(["ええよ。まだで"], MATE.zelina.name, k), j),
    ...iff(k => ifScript(`!($gameVariables.value(${VAR.notYet}) % 2 === 0 && ${sw(MATE.zelina.sw)}) && ${sw(MATE.bruno.sw)}`, k), k => say(["はい。まだで"], MATE.bruno.name, k), j),
  ], indent));
  return out;
}
// 三十のうち、数のほかに出す物（場面表 5.7）。f は「早送りでないとき」の文、leave は外す仲間
const PULL = {
  3: { text: [[MATE.bruno, ["三。あなた、数えるのが速いです"]]] },
  7: {
    text: [[MATE.bruno, null, [["", ["ブルーノの手の甲の鐘が、親鐘と一緒に鳴った。"]], [MATE.bruno.name, ["鳴りました。隊長、鳴りました"]], [MATE.bruno.name, ["僕のは、巻かなくてよかったみたいです"]], ["", ["鎧の音が、鐘の音に混ざって、聞こえなくなった。"]]]]],
    leave: MATE.bruno,
    flash: { sw: FLAG.adel, lines: [["アデルが夕べの数を数えている。"], ["「二十八、二十九、三十。今のは試し。もう一回、一から」"]] },
  },
  10: { text: [[MATE.nora, null, [[MATE.nora.name, ["あんた、足、遅いね！"]], [MATE.nora.name, ["先に行ってる。妹に、先に行ってるって言う"]], ["", ["火打ち石は、足場に置いていった。"]]]]], leave: MATE.nora },
  13: { text: [[MATE.dil, null, [[MATE.dil.name, ["どっちだったか、向こうで確かめてくる"]], [MATE.dil.name, ["あんた、読める顔になったな"]], ["", ["二冊とも、置いていった。"]]]]], leave: MATE.dil },
  14: { legacy: [LEGACY.burntChild, ["焼けた村の子。おねえちゃん、三つしか叩かなかったよ、と言って、行った。"]] },
  16: { text: [[MATE.zelina, null, [[MATE.zelina.name, ["十四人、着いたか見てくる"]], [MATE.zelina.name, ["帳面に、名前の無いつけが一つ残っとる。銀三枚。まけといたる"]], ["", ["桟橋の綱が切れるような音を立てて、ゼリナは行った。"]]]]], leave: MATE.zelina },
  19: { text: [[MATE.anselmo, null, [[MATE.anselmo.name, ["ひとつ、戸の外。ふたつ、扉の前"]], [MATE.anselmo.name, ["三つ目は、向こうで歌う"]], ["", ["歌の続きが、音に乗って遠くなった。"]]]]], leave: MATE.anselmo },
  20: { legacy: [LEGACY.lineWoman, ["列の女。名を呼ばれて、この子が笑った。初めてだ。"]] },
  22: { text: [[MATE.beltran, null, [[MATE.beltran.name, ["お前にやる。いや、マルゴに売っとけ。高いぞ"]], [MATE.beltran.name, ["あいつ、お前には値段を言わなかったからな"]], ["", ["鞘の中は、空だった。"]]]]], leave: MATE.beltran },
  23: { legacy: [LEGACY.namelessSoldier, ["名無し兵。顔は覚えている、たぶん。宛名は、無いままだった。"]] },
  25: {
    text: [[MATE.tura, null, [[MATE.tura.name, ["兄貴。帰りは、軽いな"]], [MATE.tura.name, ["弟たちに、帰るって言ったんだ。言いに行く"]], ["", ["背負子だけが、残った。"]]]]],
    leave: MATE.tura,
    flash: { sw: FLAG.shano, lines: [["シャノが身を起こした。"], ["「……なんか、寝ろって言われた」"]] },
  },
  26: { faint: ["F02", ["外門の番が、群れの中から浮かんで、一緒に数えた。"]] },
  27: { faint: ["F04", ["帳場の娘。いつ払うの、と笑って、行った。"]] },
  28: { legacy: [LEGACY.woodcutter, ["木樵の女房。薪は三束。戸の脇に置いてあった。"], ["懐の帳面の、届けた相手の欄に、字が一つ入った。"]] },
  29: { faint: ["F11", ["鐘守が、指で三十の形を作って見せた。三十で止めろ。"]] },
};
// 数だけをまとめて出す番（場面表の「四。　五。　六。」などの行。窓を一つにまとめた番は、二番目以降を窓に出さない）
const JOINED = { 4: "四。　五。　六。", 8: "八。　九。", 11: "十一。　十二。", 17: "十七。　十八。" };
const SKIP = new Set([5, 6, 9, 12, 18]);
const FF = sw(SUMMIT_SW.fastForward);
function pullOnce(n) {
  const out = [];
  // 一回ごとに「引く」を押す（二周目は「早送り」を足す。早送りを選んだら、あとは押さずに数だけ進める）
  out.push(
    ifSwitch(SUMMIT_SW.fastForward, false),
    ifScript("Hai.Comfort.endingSeen()", 1), // P14：結末を見た全体の旗（記録をまたぐ）
    choice(["引く", "早送り"], -1, 2), when(0, "引く", 2), end(3), when(1, "早送り", 2), switchOn(SUMMIT_SW.fastForward, 3), end(3), ENDCHOICE(2),
    end(2), ELSE(1),
    choice(["引く"], -1, 2), when(0, "引く", 2), end(3), ENDCHOICE(2),
    end(2), ENDIF(1),
    end(1), ENDIF(0),
  );
  out.push(varAdd(VAR.pulls, 1), se("Bell3", 0, 95, 80), cmd(225, [3, 4, 12, false]));
  if (!SKIP.has(n)) out.push(...center([JOINED[n] ?? `${KANJI[n]}。`]));
  if (n === 1) out.push(...iff(i => ifSwitch(SUMMIT_SW.fastForward, false, i), i => say(["鐘が鳴る。音が、灰の払われた空へ上がっていく。"], "", i)));
  const p = PULL[n];
  if (!p) return out;
  const body = [];
  for (const [m, simple, windows] of p.text ?? []) {
    const lines = windows ?? [[m.name, simple]];
    body.push(...iff(i => ifSwitch(m.sw, true, i), i => lines.flatMap(([who, ls]) => say(ls, who, i))));
  }
  if (p.legacy) body.push(...iff(i => ifSwitch(p.legacy[0], true, i), i => p.legacy.slice(1).flatMap(ls => say(ls, "", i))));
  if (p.faint) body.push(...iff(i => ifScript(`Hai.Thoughts.isFaint("${p.faint[0]}")`, i), i => say(p.faint[1], "", i)));
  if (p.flash) {
    body.push(...iff(i => ifSwitch(p.flash.sw, true, i), i => [
      comment("W14：画面の切り替え（一瞬だけ。顔なし）。場所は移さず、色調で替える", i),
      tint([-34, -34, 0, 68], 10, i),
      ...p.flash.lines.flatMap(ls => say(ls, "", i)),
      tint([-68, -68, -34, 85], 10, i),
    ]));
  }
  out.push(...iff(i => ifSwitch(SUMMIT_SW.fastForward, false, i), () => body.map(c => ({ ...c, indent: c.indent + 1 }))));
  if (p.leave) out.push(removeActor(p.leave.actor));
  return out;
}
function ropeList() {
  const out = [
    comment("W14：場面表 5.6〜5.9。耐えきったあと自動（スイッチ 1158）"),
    ...say(["綱を握る。二百年ぶんの硬さ。"]),
    label("綱"),
    choice(["引く", "まだ"], -1),
    when(0, "引く"), end(1),
    when(1, "まだ"), ...notYetList(1), jump("綱", 1), end(1),
    ENDCHOICE(),
  ];
  for (let n = 1; n <= 30; n++) out.push(...pullOnce(n));
  // 5.8 三十のあと
  out.push(
    wait(30),
    ...say(["綱のそばに、相棒が立っている。", "彫り刀は持っていない。手ぶらで、こちらを見ている。", "蝋で汚れた袖。指の節に、彫り傷。年寄りの、笑っている口。", "口は、動かなかった。"]),
    ...say(["相棒は、鐘の音の中へ入っていった。"]),
    switchOn(SUMMIT_SW.shadesGone),
    ...plugin("Hai_MapTone", "stopAsh", "灰を止める"), // P14：これから先、どのマップの <hai_ash> も降らない
    wait(30),
    ...say(["灰が、止んだ。"]),
    ...say(["指が、次を数えている。"]),
    choice(["もう一度、引く", "手を離す"], -1),
    when(0, "もう一度、引く"),
    switchOn(SW.pulled31, 1),
    ifSwitch(SUMMIT_SW.mirleneHere, true, 1),
    ...say(["待って。わたしの民は、三十一まで数えるの", "一緒に、引いてくれる？"], N.mirlene, 2),
    comment("ミルレーネが足場に上がり、綱に手を添える", 2),
    se("Bell3", 2, 95, 80), cmd(225, [3, 4, 12, false], 2),
    ...center(["三十一。"], 2),
    ...say(["鐘が鳴った。音は山の向こうへ落ちていった。", "消えて、しばらく、何も無かった。"], "", 2),
    wait(90, 2),
    se("Bell1", 2, 40, 150),
    wait(30, 2),
    ...say(["境山の向こうの、遠い山から。", "知らない鐘が、一つ応えた。"], "", 2),
    ...say(["聞こえたわ"], N.mirlene, 2),
    switchOn(SW.trueEnding, 2),
    end(2),
    ELSE(1),
    se("Bell3", 2, 95, 80), cmd(225, [3, 4, 12, false], 2),
    ...center(["三十一。"], 2),
    ...say(["音は、山の向こうで消えた。", "消えて、何も無かった。風だけが、灰を払っていた。"], "", 2),
    end(2),
    ENDIF(1),
    end(1),
    when(1, "手を離す"), end(1),
    ENDCHOICE(),
    // 5.9 頂の終わり
    wait(30),
    ...say(["足場に、火打ち石と、二冊の写しと、空の鞘と、背負子。", "一つずつ拾った。背負子は、軽かった。"]),
    ifSwitch(SW.sorenneAlive, true),
    ...say(["木は、下ろした。長は、わたしが連れて下りる。きみは、先に行け"], N.sorenne, 1),
    end(1), ENDIF(),
    ...say(["鳴りましたね。……私が彫るつもりだった所から、鳴りました"], N.lucien),
    ifScript(`!${sw(SW.sorenneAlive)} && ${sw(SW.lucienStopped)} && (${READY})`),
    ...say(["ソレンヌは足場の下に、膝をついたまま動かなかった。", "ルシアンが、その肩に当て布を掛けた。"], "", 1),
    end(1), ENDIF(),
    ...say(["石段を下りた。灰は止み、足跡が消えずに残った。"]),
    cmd(221, []),
    switchOn(SW.endingNight),
    cmd(201, [0, 10, 25, 26, UP, 2]),
    END,
  );
  return out;
}

export function events015() {
  return [
    { name: "南の石段（鐘楼の根へ）", type: "transfer", x: E015.entry[0], y: E015.entry[1], to: [MAP.root, 20, 2, "down"] },
    {
      name: "頂に着いた（自動）", type: "raw", x: 0, y: 0,
      pages: [
        { priorityType: 0, trigger: 3, list: arrivalList() },
        { conditions: { selfSwitchCh: "A", selfSwitchValid: true }, priorityType: 0 },
      ],
    },
    {
      name: "親鐘の肌（銘）", type: "raw", x: E015.inscription[0], y: E015.inscription[1],
      pages: [{ priorityType: 1, list: [...inscriptionLines, switchOn(SUMMIT_SW.readInscription), END] }],
    },
    {
      name: "親鐘の口（舌を吊る）", type: "raw", x: E015.mouth[0], y: E015.mouth[1],
      pages: [
        { priorityType: 1, list: mouthList() },
        { conditions: { switch1Id: SW.tongueHung, switch1Valid: true }, priorityType: 1, list: [...say(["舌が鐘の口の中で、揺れている。"]), END] },
      ],
    },
    {
      name: "親鐘の綱", type: "raw", x: E015.rope[0], y: E015.rope[1],
      pages: [
        { image: IMG.rope, priorityType: 1, directionFix: true },
        { conditions: { switch1Id: SW.endured, switch1Valid: true }, image: IMG.rope, priorityType: 1, directionFix: true, trigger: 3, list: ropeList() },
        { conditions: { switch1Id: SW.endingNight, switch1Valid: true }, image: IMG.rope, priorityType: 1, directionFix: true },
      ],
    },
    {
      name: "ルシアン", type: "raw", x: E015.lucien[0], y: E015.lucien[1],
      pages: [
        { image: IMG.lucien, priorityType: 1, directionFix: true },
        { conditions: { switch1Id: SUMMIT_SW.readInscription, switch1Valid: true }, image: IMG.lucien, priorityType: 1, directionFix: true, trigger: 3, list: stopLucienList() },
        { conditions: { switch1Id: SW.lucienStopped, switch1Valid: true }, image: { ...IMG.lucien, direction: DOWN, pattern: 0 }, priorityType: 1, directionFix: true },
      ],
    },
    {
      name: "ソレンヌ（頂）", type: "raw", x: E015.sorenne[0], y: E015.sorenne[1],
      pages: [
        { priorityType: 0 },
        { conditions: { switch1Id: SW.sorenneTalked, switch1Valid: true }, image: IMG.sorenne, priorityType: 1, directionFix: true },
        { conditions: { switch1Id: SW.lucienStopped, switch1Valid: true }, image: { ...IMG.sorenne, direction: DOWN, pattern: 0 }, priorityType: 1, directionFix: true },
        { conditions: { switch1Id: SW.sorenneAlive, switch1Valid: true }, image: { ...IMG.sorenne, direction: LEFT }, priorityType: 1, directionFix: true },
      ],
    },
    {
      name: "ミルレーネ（頂。真の結末のとき）", type: "raw", x: E015.mirlene[0], y: E015.mirlene[1],
      pages: [
        { priorityType: 0 },
        { conditions: { switch1Id: SUMMIT_SW.mirleneHere, switch1Valid: true }, image: IMG.mirlene, priorityType: 1, directionFix: true },
      ],
    },
    // 頂の群れ（舌を吊ると、止まっていた影が足場を囲む。三十のあと消える）。四つの鐘のスイッチ 101〜104 で出す数を分ける
    ...E015.shades.map(([x, y], i) => ({
      name: `頂の群れ ${i + 1}`, type: "raw", x, y,
      pages: [
        { priorityType: 0 },
        { conditions: { switch1Id: SW.tongueHung, switch1Valid: true, switch2Id: 101 + (i % 4), switch2Valid: true }, image: IMG.shade, priorityType: 1, directionFix: true, stepAnime: true, walkAnime: false },
        { conditions: { switch1Id: SUMMIT_SW.shadesGone, switch1Valid: true }, priorityType: 0 },
      ],
    })),
  ];
}

// ===========================================================================
// 耐える戦い「夜の思い」（Troops 1152）のバトルイベント（場面表 5.5）
// ===========================================================================
const FAINT_TURN = [
  ["F03", ["群れの中から、顔が一つ浮かんだ。坑道の、崩れた所の。", "坑夫の女房が、門の前に立っている。", "墓守が、女房に何かを伝えている。声は聞こえない。", "女房が頷いて、門に背を向けた。"]],
  ["F08", ["東門の番。閂を二人で持ち上げる。せえの。", "墓守の手が、閂の反対の端を持っている。", "閂は上がる。番が笑う。"]],
];
const ALL_SEEN = ["相棒が、壁に彫っている。戸は見ない。", "眠っている方へ、向き直る。"];
const TRAVEL_CALL = [[MATE.zelina, "あんた！　戻り"], [MATE.beltran, "お前、戻れ"], [MATE.dil, "あんた、読めてるか"], [MATE.anselmo, "お前さん、こっちじゃ"], [MATE.nora, "あんた！"]];
export function nightTroopPages(page0) {
  const faintTurn = () => {
    // まだ見ていない薄い思念から一つ（場面表の例の F03・F08）。全部見ていれば司祭の場面をもう一度
    const out = [];
    FAINT_TURN.forEach(([id, lines], i) => {
      const before = FAINT_TURN.slice(0, i).map(([b]) => `Hai.Thoughts.isFaint("${b}")`).join(" && ") || "true";
      out.push(...iff(j => ifScript(`!Hai.Thoughts.isFaint("${id}") && ${before} && !$gameTemp._haiW14Faint${id}`, j), j => [
        ...say(lines, "", j, { background: 1, position: 1 }),
        ...cmdScript(`$gameTemp._haiW14Faint${id} = true;`, j),
      ]));
    });
    out.push(...iff(j => ifScript(FAINT_TURN.map(([id]) => `(Hai.Thoughts.isFaint("${id}") || $gameTemp._haiW14Faint${id})`).join(" && "), j), j => say(ALL_SEEN, "", j, { background: 1, position: 1 })));
    return out;
  };
  const lastTurn = [
    ...iff(i => ifSwitch(MATE.bruno.sw, true, i), i => [...say(["……ルカさん、で、合ってますか"], MATE.bruno.name, i), ...say(["「合っている」"], "", i)]),
    ...iff(i => ifSwitch(MATE.tura.sw, true, i), i => [...say(["ルカ兄貴！　戻ってこい！"], MATE.tura.name, i), ...say(["「戻っている」"], "", i)]),
    ...iff(i => ifScript(`!${sw(MATE.bruno.sw)} && !${sw(MATE.tura.sw)}`, i), i => {
      const out = [];
      TRAVEL_CALL.forEach(([m, line], k) => {
        const before = TRAVEL_CALL.slice(0, k).map(([b]) => `!${sw(b.sw)}`).join(" && ") || "true";
        out.push(...iff(j => ifScript(`${sw(m.sw)} && ${before}`, j), j => say([line], m.name, j), i));
      });
      return out;
    }),
    ...say(["影は、もう寄ってこなかった。頂の床を埋めて、立っていた。"]),
  ];
  return [
    { ...page0, conditions: { ...page0.conditions, turnA: 0, turnB: 0, turnValid: true }, span: 0,
      list: [comment("耐える戦いの間、主人公の命令は「耐える」「呼ぶ」だけ（Hai_Apostle の endureCommands。P14）。呑まれは毎ターン少し溜まり、溜まると仲間が呼ぶ"), END] },
    // 毎ターン：最後のターン（Hai.Boss.endureLeft() が 1）なら名で呼ぶ。ほかは一つおきに、まだ見ていない薄い思念が一つ浮かぶ
    { ...page0, conditions: { ...page0.conditions, turnA: 0, turnB: 1, turnValid: true }, span: 1,
      list: [
        cmd(355, ["Hai.Apostle.addEngulf(1, 15); // 群れが寄ってくるたびに、呑まれが少し溜まる（P14 の doc のとおりバトルイベントで溜める）"]),
        ifScript("Hai.Boss.endureLeft() === 1"),
        ...lastTurn.map(c => ({ ...c, indent: c.indent + 1 })),
        end(1),
        ELSE(),
        ...iff(i => ifScript("$gameTroop.turnCount() % 2 === 1", i), i => faintTurn().map(c => ({ ...c, indent: c.indent + i })), 1),
        end(1),
        ENDIF(),
        END,
      ] },
  ];
}
function cmdScript(src, indent) { return [cmd(355, [src], indent)]; }
