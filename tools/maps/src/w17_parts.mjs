// W17（#233）原作の反映：地域三と地域四（台本 docs/story/scenes/03-region3-region4.md）の部品。
// w9_data.mjs・w10_data.mjs・w6_data.mjs・w12_data.mjs・p6_data.mjs が読む（何度走らせても同じ結果になる）。
// 共有のファイル（砦 010・麦の村 111・アクター）に足す物はここに置き、各ファイルの変更は呼び出しの一行に留める。
// 文は台本の表のまま（変えない）。旗：スイッチ 518–521（W9 の帯）・620（W10 の帯）・180–185（砦の食卓）、敵 613（声だけの影）。

const cmd = (code, parameters, indent = 0) => ({ code, indent, parameters });
const END = cmd(0, []);
const say = (lines, speaker = "", indent = 0) => [cmd(101, ["", 0, 0, 2, speaker], indent), ...lines.map(l => cmd(401, [l], indent))];
const shift = (list, n) => list.map(c => ({ ...c, indent: c.indent + n }));
const close = indent => cmd(0, [], indent);
const ENDIF = (indent = 0) => cmd(412, [], indent);
const swOn = (id, indent = 0) => cmd(121, [id, id, 0], indent);
const selfOn = (ch, indent = 0) => cmd(123, [ch, 0], indent);
const ifSwitch = (id, on = true, indent = 0) => cmd(111, [0, id, on ? 0 : 1], indent);
const ifActor = (actorId, indent = 0) => cmd(111, [4, actorId, 0], indent);
const ifSelf = (ch, on = true, indent = 0) => cmd(111, [2, ch, on ? 0 : 1], indent);
const se = (name, indent = 0, volume = 90, pitch = 100) => cmd(250, [{ name, volume, pitch, pan: 0 }], indent);

/** 仲間・旗の印（P11 の加入スイッチ 138–144。アクター ID とは別） */
export const ACTOR = { bruno: 5, dil: 7, zelina: 8, anselmo: 9, beltran: 10, tula: 11 };
export const JOINED = { bruno: 138, dil: 140, zelina: 141, anselmo: 142, beltran: 143, tula: 144 };
export const W17_SW = {
  zelinaLedger: 518, nightDoorGate: 519, anselmoSang: 520, doorRhyme: 521, nightDoorCamp: 620,
  // 砦の食卓（010）
  zelinaBowl: 180, tulaPack: 181, beltranPipinel: 182, tulaShano: 183, zelinaAnselmo: 184, guidoRhyme: 185,
};
export const W17_SWITCH_NAMES = {
  518: "麦の村:ゼリナが帳面を読んだ（111）",
  519: "夜の戸:閉じた扉（102。答えた／答えなかった）",
  520: "扉の前:アンセルモが節を歌った（102）",
  521: "扉の前:扉の内の数え歌を聞いた（102）",
  620: "夜の戸:陣跡（051 の天幕。答えた／答えなかった）",
};
export const FORT_SWITCH_NAMES = {
  180: "砦:ゼリナの椀（済）",
  181: "砦:トゥーラの背負子",
  182: "砦:ベルトランとピピネル（済）",
  183: "砦:トゥーラとシャノ（済）",
  184: "砦:ゼリナとアンセルモ（済）",
  185: "砦:グィドの数え歌（済）",
};
/** 声だけの影（名無し兵）。Enemies・Troops 613（W10 の帯） */
export const NAMELESS_SHADE = 613;

/**
 * 仲間の一言。その仲間が隊にいるとき（条件分岐 4）だけ body を出す。
 * ch（"B"〜"D"）を渡すと、そのイベントのセルフスイッチで一度きりにする（null なら毎回）。
 * body は indent 0 始まりの命令。返す命令も indent 0 始まり（入れ子に置くときは shift する）。
 */
export function aside(actorId, ch, body) {
  if (!ch) return [ifActor(actorId), ...shift(body, 1), close(1), ENDIF()];
  return [
    ifActor(actorId),
    ifSelf(ch, false, 1),
    ...shift(body, 2), selfOn(ch, 2), close(2),
    ENDIF(1), close(1), ENDIF(),
  ];
}

/** 敵のメモ欄に、その地域の鐘のスイッチを書く（P14 #230 が読む。東を向いて止まる）。 */
export const withBell = (note, bellSwitch) => `${note}<hai_enemy_bell:${bellSwitch}>`;

// ---------------------------------------------------------------------------
// 111 麦の村の帳面（台本 5。N4-2 の帳面のイベントに、ゼリナが読み上げる所を足す）
// ---------------------------------------------------------------------------
/** text か raw のイベントの 1 ページ目の最後（END の前）に命令を足す（文はそのまま）。 */
export function appendToEvent(event, extra) {
  let pages;
  if (event.type === "text") {
    const blocks = Array.isArray(event.lines[0]) ? event.lines : [event.lines];
    const list = blocks.flatMap(b => [cmd(101, ["", 0, event.background ?? 0, 2, event.speaker || ""]), ...b.map(l => cmd(401, [l]))]);
    pages = [{ ...(event.image ? { image: event.image } : {}), priorityType: event.priorityType ?? 1, list: [...list, END] }];
  } else if (event.type === "raw") {
    pages = event.pages.map(p => ({ ...p }));
  } else {
    throw new Error(`${event.name}: text か raw のイベントにだけ足せる`);
  }
  const first = pages[0];
  const list = first.list || [END];
  first.list = [...list.slice(0, -1), ...extra, list[list.length - 1]];
  const out = { ...event, type: "raw", pages };
  delete out.lines;
  delete out.image;
  delete out.speaker;
  delete out.background;
  delete out.priorityType;
  return out;
}
export function withZelinaLedger(event) {
  return appendToEvent(event, aside(ACTOR.zelina, null, [
    ifSwitch(W17_SW.zelinaLedger, false),
    ...shift([
      ...say(["ゼリナは帳面を取り上げて、声に出して読んだ。"]),
      ...say(["舟で着いた。十四。いち、に、さん"], "ゼリナ"),
      ...say(["十四で指が止まり、口だけが、十五、と言った。"]),
      ...say(["……うちの名、勝手に書きなや"], "ゼリナ"),
      ...say(["舟代は、貰っとる"], "ゼリナ"),
      ...say(["ほんまに、貰っとるんや"], "ゼリナ"),
      swOn(W17_SW.zelinaLedger),
    ], 1),
    close(1), ENDIF(),
  ]));
}

// ---------------------------------------------------------------------------
// 010 砦の食卓（台本 4・17・23）。イベント ID 61–70（配り役の割り当て）
// ---------------------------------------------------------------------------
const FLAG = { prisonBell: 101, wolfram: 306, shano: 172, pipinel: 411, guido: 602, bowlUp: 116, bowlFilled: 1151 }; // 116 は W6・1151 は W14 の帯（読むだけ）
const ITEM_TONGUE = 606;
const IMG = {
  zelina: { characterName: "Actor1", characterIndex: 7, direction: 2, pattern: 1 },
  tula: { characterName: "Actor2", characterIndex: 2, direction: 2, pattern: 1 },
};
// 大広間の場面（W18 #258。R2 困る 6）：自動実行にせず、大広間の見張り（w6_data.mjs の並列のイベント）が、主人公が大広間にいるときに始める。
// 名の壁の輪で仲間を呼んだ直後に、食卓や梁の場面が中庭や名の壁の前で出ないように。トリガーは決定ボタン（見張りが start() で始める。大広間の中の見えないマスに乗って押しても、同じ場面が出るだけ）
const hall = (cond, list) => ({ conditions: cond, priorityType: 0, trigger: 0, list: [...list, END] });
/** 大広間の見張りが始める場面の ID（61–70 のうち）。順に見て、最初に出せるものを始める */
export const HALL_SCENE_IDS = [61, 66, 67, 68, 69];
const done = id => ({ conditions: { switch1Id: id, switch1Valid: true }, priorityType: 0 });
const onSw = (a, b) => ({ switch1Id: a, switch1Valid: true, ...(b ? { switch2Id: b, switch2Valid: true } : {}) });

/**
 * 砦 010 の食卓の場面。seats は席の座標（N4-1 の食卓の並び。w6_data.mjs が渡す）。
 * 返すのは [ID, イベント] の並び（ID は 61–70）。
 */
export function fortTableEvents(seats) {
  const ev = (id, name, [x, y], pages, note = "") => [id, { name, type: "raw", x, y, note, pages }];
  return [
    // 61 ゼリナの椀（台本 4）。141 ON・ヴォルフラムが砦にいる。010 に入ったとき一度
    ev(61, "W17 ゼリナの椀（自動）", seats.auto1, [
      hall(onSw(JOINED.zelina, FLAG.wolfram), [
        ...say(["座れ！"], "ヴォルフラム"),
        ...say(["最初の一椀を、炉から三つ目の壁の側の席に置いた。"]),
        ...say(["誰のぶんかは知らん。家の決まりだ"], "ヴォルフラム"),
        ...say(["誰の"], "シャノ"),
        ...say(["知らん！"], "ヴォルフラム"),
        ...say(["……うちの前に置きよった"], "ゼリナ"),
        ...say(["椀を指で向こうへ押した。椀は動かなかった。"]),
        ...say(["うちの分は、要らんで。うちは、飲ませる側や"], "ゼリナ"),
        swOn(W17_SW.zelinaBowl),
      ]),
      done(W17_SW.zelinaBowl),
    ], "<hai_w17:台本 4。ヴォルフラムの先に盛る一椀（N4-1）の、ゼリナが来たときの場面>"),
    // 62 ゼリナ（食卓）。炉から三つ目、壁の側の席
    ev(62, "W17 ゼリナ（食卓）", seats.zelina, [
      { priorityType: 0 },
      { conditions: onSw(JOINED.zelina), image: IMG.zelina, priorityType: 1, list: [
        // 伏せた椀を起こしてある（スイッチ 116）なら、伏せたままとは言わない（W18 #258。R2 困る 9）
        ifSwitch(FLAG.bowlUp),
        ...say(["あの椀、起きとるな。誰か来るんか"], "ゼリナ", 1), close(1),
        cmd(411, []),
        ...say(["あの椀、伏せたままやな。誰か来るんか"], "ゼリナ", 1), close(1),
        ENDIF(), END,
      ] },
      // 三つ目の鐘の夜に椀へ飯が盛られたあと（1151。W14 の帯。106 のあとにしか ON にならない）：
      // 一度目はゼリナの夢（場面表 04 の 2.2。セルフスイッチ B）、以後は差し替えの一言（W18 #258。R2 困る 9・7 章 04:130）
      { conditions: onSw(JOINED.zelina, FLAG.bowlFilled), image: IMG.zelina, priorityType: 1, list: [
        ifSelf("B", false),
        ...say(["舟の金、まだ足りへん夢を見た", "起きたら、十四人分の椀が並んどった。", "……勘定は合うとる。なんで足りへんのやろな"], "ゼリナ", 1),
        selfOn("B", 1), close(1),
        cmd(411, []),
        ...say(["奥の椀にも、盛ってあるな"], "ゼリナ", 1), close(1),
        ENDIF(), END,
      ] },
    ]),
    // 63 トゥーラの背負子（台本 17）。輪で呼んだ直後、親鐘の舌を持っているとき
    ev(63, "W17 トゥーラの背負子（自動）", seats.auto2, [
      { priorityType: 0 },
      { conditions: { ...onSw(JOINED.tula), itemId: ITEM_TONGUE, itemValid: true }, priorityType: 0, trigger: 3, list: [
        ...say(["あたしはトゥーラ。兄貴、その背負子、あたしのだろ"], "トゥーラ"),
        ...say(["墓守は背負子を下ろさなかった。舌が、まだ中にあった。"]),
        ...say(["貸しといてやる。帰りに返せ"], "トゥーラ"),
        swOn(W17_SW.tulaPack), END,
      ] },
      done(W17_SW.tulaPack),
    ]),
    // 64 トゥーラとベルトラン（台本 17）。両方 ON のとき一度。輪の前で
    ev(64, "W17 トゥーラとベルトラン（自動）", seats.auto3, [
      { priorityType: 0 },
      { conditions: onSw(JOINED.tula, JOINED.beltran), priorityType: 0, trigger: 3, list: [
        ...say(["おい、その剣。骨の剣だろ。売ったの誰だよ"], "トゥーラ"),
        ...say(["ベルトランは答えなかった。トゥーラの腕を見て、黙った。", "トゥーラは自分の腕を見て、袖を下ろした。"]),
        selfOn("A"), END,
      ] },
      { conditions: { selfSwitchCh: "A", selfSwitchValid: true }, priorityType: 0 },
    ]),
    // 65 トゥーラ（食卓・梁の下）。ゼリナの隣の席。シャノの場面のあとは梁の下で「寝ろ、馬鹿」
    ev(65, "W17 トゥーラ（食卓）", seats.tula, [
      { priorityType: 0 },
      { conditions: onSw(JOINED.tula), image: IMG.tula, priorityType: 1, list: [
        ifSwitch(JOINED.zelina),
        ...say(["トゥーラちゃん。食べ。うちの分や"], "ゼリナ", 1),
        ...say(["子ども扱いすんな。食うけど"], "トゥーラ", 1),
        close(1), ENDIF(), END,
      ] },
      done(W17_SW.tulaShano), // シャノの場面のあとは梁の下（70）
    ]),
    // 66 ピピネル（台本 17）。143 ON・411 ON。療養所の戸から出て、ベルトランの席の前で止まる
    ev(66, "W17 ベルトランとピピネル（自動）", seats.auto4, [
      { priorityType: 0 },
      { conditions: onSw(JOINED.beltran, FLAG.pipinel), priorityType: 0, trigger: 0, list: [
        ...say(["酒くさいのう、ここ"], "ピピネル"),
        ...say(["ベルトランは口を開けた。酒の話をするときの顔だった。", "薬草の束で、ピピネルの袖が持ち上がった。袖の下に、古い傷。", "肩から肘へ、斜めに。刃の傷だった。"]),
        ...say(["……生きてたのか"], "ベルトラン"),
        ...say(["おぬし。この席、誰ぞ座っとるのか。", "婆には見えんが、酒の匂いがする"], "ピピネル"),
        swOn(W17_SW.beltranPipinel), END,
      ] },
      done(W17_SW.beltranPipinel),
    ]),
    // 67 トゥーラとシャノ（台本 17）。144 ON・シャノが砦にいる。夜（010 に入ったとき）一度
    ev(67, "W17 トゥーラとシャノ（自動）", seats.auto5, [
      { priorityType: 0 },
      { conditions: onSw(JOINED.tula, FLAG.shano), priorityType: 0, trigger: 0, list: [
        ...say(["見てた？　今日は留め金が五つ。重かった"], "シャノ"),
        ...say(["帰りは軽い、って頭が言うんだ。", "拾い屋はみんな言う。意味は知らねえ"], "シャノ"),
        ...say(["……誰に教わった、それ"], "トゥーラ"),
        ...say(["シャノは背負子を柱に立て掛けて、梁へ登った。", "椀には手を付けていなかった。"]),
        ...say(["兄貴。あいつ、飯食ってない"], "トゥーラ"),
        ...say(["背負子の字と、同じだ"], "\\N[1]"),
        ...say(["寝ろ、馬鹿"], "トゥーラ"),
        ...say(["梁の上で、シャノは寝返りを打った。"]),
        swOn(W17_SW.tulaShano), END,
      ] },
      done(W17_SW.tulaShano),
    ]),
    // 68 ゼリナとアンセルモ（台本 23）。141・142 が両方 ON で一度
    ev(68, "W17 ゼリナとアンセルモ（自動）", seats.auto6, [
      { priorityType: 0 },
      { conditions: onSw(JOINED.zelina, JOINED.anselmo), priorityType: 0, trigger: 0, list: [
        ...say(["お前さん、酒保の人かの。舟の"], "アンセルモ"),
        ...say(["舟の。あんたは、扉の"], "ゼリナ"),
        ...say(["二人はそれきり、しばらく黙った。炉の火が鳴った。"]),
        ...say(["わしはな、札を一枚、持っとった。内へ入る札じゃ"], "アンセルモ"),
        ...say(["うちは、籠を受け取った。籠だけ"], "ゼリナ"),
        ...say(["ほう"], "アンセルモ"),
        ...say(["ほう、やあらへん"], "ゼリナ"),
        ...say(["降ろした顔は、全部覚えとる。二十六"], "ゼリナ"),
        ...say(["わしは、札をやった子の名を聞かんかった。", "……そっちの方が、楽じゃったからの"], "アンセルモ"),
        swOn(W17_SW.zelinaAnselmo), END,
      ] },
      done(W17_SW.zelinaAnselmo),
    ]),
    // 69 グィドの数え歌（台本 23）。602 ON（グィドが砦にいる）で、142 ON のとき一度。窓の所（見張り台の戸の脇）
    ev(69, "W17 グィドの数え歌（自動）", seats.auto7, [
      { priorityType: 0 },
      { conditions: onSw(FLAG.guido, JOINED.anselmo), priorityType: 0, trigger: 0, list: [
        ...say(["ひとつ、戸の外。ふたつ、扉の前"], "グィド"),
        ...say(["指が三本目を折った。声は無かった。"]),
        ...say(["よっつ。まあ、明日にしよう"], "グィド"),
        ...say(["三つ目は、歌わんのか"], "アンセルモ"),
        ...say(["三つ目は、飛ばす。じいさんも、飛ばしとった"], "グィド"), // 052 の一言と同じにしない（W18 #258。R2 気になる 24）
        ...say(["ええ爺さんじゃ"], "アンセルモ"),
        swOn(W17_SW.guidoRhyme), END,
      ] },
      done(W17_SW.guidoRhyme),
    ]),
    // 70 トゥーラ（梁の下）。シャノの場面のあと、梁の下で見上げている（話しかけると）
    ev(70, "W17 トゥーラ（梁の下）", seats.beam, [
      { priorityType: 0 },
      { conditions: onSw(JOINED.tula, W17_SW.tulaShano), image: { ...IMG.tula, direction: 8 }, priorityType: 1, list: [
        ...say(["寝ろ、馬鹿"], "トゥーラ"), END,
      ] },
    ]),
  ];
}

// ---------------------------------------------------------------------------
// 夜の戸（台本 13・22）：画面を暗くして、戸が三度叩かれる。終わったら色調を元に戻す
// ---------------------------------------------------------------------------
const script = (s, indent = 0) => cmd(355, [s], indent);
const wait = (n, indent = 0) => cmd(230, [n], indent);
export function nightDoorStart(indent = 0) {
  return [
    script("this._w17Tone = $gameScreen.tone().slice();", indent),
    cmd(223, [[-136, -136, -119, 170], 30, true], indent),
    ...[0, 1, 2].flatMap(() => [se("Knock", indent, 90, 100), wait(24, indent)]),
  ];
}
export function nightDoorEnd(indent = 0) {
  return [script("$gameScreen.startTint(this._w17Tone || [0, 0, 0, 0], 30);", indent), wait(30, indent)];
}
