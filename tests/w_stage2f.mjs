// W5（#120）王都の下水道・オーブ「封印」・王都の門と結末 B（docs/world2.md 8・9・11・15 章、tools/maps/src/w5_10*・w5_015）の検査：
//   1. 入口 2 つ：沼主の淵 073 の排水口（沼主を倒した後）→ 下水道・上流 100（梯子で 073 へ戻れる）。
//      拷問の間 035 の西の扉（看守長の鍵束）⇔ 100 の鍵束の扉（100 の側からは閂を外してスイッチ 160）。
//   2. 100：R45（水門の手がかり）、H36（くぼんだ壁）→ 赤い宝箱「水除けの長靴」、下水番の小屋の結界。
//   3. 水門の間 101：R46、水門の取っ手（スイッチ 162）で東西の水路が入れ替わる、東の水路の宝箱（凍て石）、
//      H37（東の水路の西の壁の影の無い所）⇔ 結界の真下 102 の北東、西の水路の階段 → 102。
//   4. 102：R48、光の床を踏むと押し戻される、H38（光の当たらない床のひび割れ）→ 南西の小部屋の赤い宝箱「近衛の盾」、
//      水溜まりの白い澱、控え室の結界・R47（ボスの弱点）・錠前師の型紙・R49（ユエルの刻み）。
//   5. 灰の騎士の間 103：灰の騎士（逃げると控え室へ。開幕と HP 70% で近衛の亡霊を呼び、亡霊がいる間は「近衛の守り」、
//      凍て石で氷の弱点のヒント、毒・眠り 無効・混乱 150%、HP 50% で灰の嵐＝形態変化と毎ターンの嵐、倒すとスイッチ 155・近衛の誓剣、残った亡霊は崩れる）。
//   6. オーブの間「封印」104：場面（スイッチ 104・変数 101）、4 つ目なら 105・106、帰りの転送陣。セーブ・ロード。
//   7. 牢獄の間 010 の螺旋階段（変数 101 が 3 以上）→ 王都の門 015：オーブ 3 つは押し戻される（初めてだけ 15.3・スイッチ 115）、
//      4 つは門の前の場面（スイッチ 501。2 回目は最後の 2 行だけ）、「まだ開けない」、「門を開ける」→ 結末 B（スイッチ 182）→ タイトル。
// 乱数（Math.random）は固定する。スキル・状態・装備はテストから与えない（凍て石は 101 の宝箱で拾う。看守長の鍵束は第1段階の看守長のドロップ）。
// ユエルの Lv だけ、world2.md 9 章の想定（Lv 13 前後）に上げる（職業 10 は技を増やさない）。
import { launchGame, check, runTest } from "./lib.mjs";
import { makePlay } from "./wplay.mjs";

const HALL = 10;
const GATE = 15;
const TORTURE = 35;
const POOL = 73;
const UPPER = 100;
const SLUICE = 101;
const BENEATH = 102;
const KNIGHT_HALL = 103;
const ORB_ROOM = 104;
const ITEM = { keyring: 203, frost: 302, template: 503, dregs: 505 };
const WEAPON = { oath: 501 };
const ARMOR = { boots: 503, shield: 504 };
const KNIGHT = { troop: 512, escape: { map: BENEATH, x: 19, y: 24, d: 8 } };

await runTest(async () => {
  const game = await launchGame();
  const p = makePlay(game);
  const { pos, sw, v, items, hasLore, log, go, arrive, step, walk, talk, inspectPlain, turn, toMap, finishEvent, boss, startFight, escapeBoss, heal } = p;
  try {
    await p.setup();

    // ===== 1. 入口 2 つ =====
    await game.eval(() => {
      $gameSwitches.setValue(157, true); // 沼主は W4 の検査（w_stage2c）で倒している
      $gameParty.gainItem($dataItems[203], 1); // 看守長の鍵束は第1段階の看守長のドロップ（w_stage1b）
    });
    await game.frames(5);
    await finishEvent(); // 「来歴を読める」の知らせ（Hai_Lore）を閉じる
    await go(POOL, 13, 8, 2);
    await game.call("step", 2);
    const drain = (await talk(["下りる"], {}, false)).join("");
    check(drain.includes("錆びた梯子"), "淵の底の排水口の文章 " + JSON.stringify(drain));
    await arrive(UPPER, 3, 9);
    await game.shot("sewer-upper");
    await game.call("step", 8);
    await arrive(POOL, 13, 5);
    // 100 の側から鍵束の扉の閂を外す（スイッチ 160）
    await go(UPPER, 41, 8, 6);
    await talk(["閂を外す"]);
    check(await sw(160), "閂を外してもスイッチ 160 が ON にならない");
    await game.call("step", 6);
    await arrive(TORTURE, 6, 7);
    // 035 の側：鍵束で開ける（スイッチ 160 を戻して、鍵で開く方を確かめる）
    await game.eval(() => $gameSwitches.setValue(160, false));
    await game.call("step", 4);
    await game.frames(4);
    const key = (await talk()).join("");
    check(key.includes("看守長の鍵束の一本が、錠に合った。"), "035 の西の扉が鍵束で開かない " + JSON.stringify(key));
    await game.call("step", 4);
    await arrive(UPPER, 41, 8);
    check(await sw(160), "035 の西の扉を通ってもスイッチ 160 が ON にならない");
    await game.shot("torture-west-door");
    console.log("  入口：073 の排水口 ⇔ 100（梯子）・100 の閂（スイッチ 160）・035 の西の扉（鍵束）→ 100");

    // ===== 2. 100 下水道・上流 =====
    await go(UPPER, 10, 18, 8);
    check((await talk()).join("").includes("東と西の水路を切り替えられる"), "R45 の本文");
    check(await game.eval(() => Hai.Thoughts.hasNote("clue:R45")), "R45 の手がかりがメモに無い");
    await go(UPPER, 14, 18, 8);
    await talk([-1]);
    check(await game.eval(() => Hai.Warp.visited().some(w => w.name === "下水番の小屋")), "下水番の小屋の結界を訪れたことにならない");
    await go(UPPER, 16, 8, 8);
    await inspectPlain();
    check(await game.eval(() => Hai.HiddenPassage.isFound(16, 7)), "H36 の隠し扉が開かない");
    await walk([8, 8, 8], "H36 の奥");
    await talk();
    check((await items("a", ARMOR.boots)) === 1 && (await hasLore("a", ARMOR.boots)), "赤い宝箱で水除けの長靴が手に入らない");
    await go(UPPER, 38, 26, 2);
    await game.call("step", 2);
    await arrive(SLUICE, 19, 3);
    console.log("  上流：R45・下水番の小屋の結界・H36 → 水除けの長靴 → 水門の間");

    // ===== 3. 101 水門の間 =====
    await game.shot("sluice-hall");
    await go(SLUICE, 16, 10, 2);
    check((await talk()).join("").includes("胸に、何かを刻むつもりだと言っていた。"), "R46 の本文");
    const canPass = (x, y, d) => game.call("canPass", x, y, d);
    check((await canPass(7, 11, 2)) && !(await canPass(32, 11, 2)), "初めは西の水路だけ歩ける");
    await go(SLUICE, 17, 8, 8);
    await talk(["回す"]);
    check((await sw(162)) && !(await canPass(7, 11, 2)) && (await canPass(32, 11, 2)), "取っ手を回しても東西の水路が入れ替わらない");
    await go(SLUICE, 32, 11, 2);
    await walk(Array(7).fill(2), "東の水路");
    await game.shot("sluice-east");
    await go(SLUICE, 32, 23, 2);
    await talk();
    check((await items("i", ITEM.frost)) === 2, "東の水路の宝箱で凍て石が手に入らない");
    // H37：東の水路の西の壁の影の無い所 (30,19) → 横穴 → 102 の北東。102 の上り口から戻れる
    await go(SLUICE, 31, 19, 4);
    await walk([4, 4, 4, 4], "H37");
    await game.call("step", 4);
    await arrive(BENEATH, 34, 3);
    check(await game.eval(() => Hai.HiddenPassage.isFound(30, 19, 101)), "H37 が見つけたことにならない");
    await game.call("step", 8);
    await arrive(SLUICE, 27, 19);
    await go(SLUICE, 17, 8, 8);
    await talk(["回す"]);
    check(!(await sw(162)) && (await canPass(7, 11, 2)), "取っ手をもう一度回しても西の水路に戻らない");
    await go(SLUICE, 7, 11, 2);
    await walk(Array(12).fill(2), "西の水路");
    await game.call("step", 2);
    await arrive(BENEATH, 5, 3);
    console.log("  水門の間：R46・取っ手（スイッチ 162）・東の水路の凍て石・H37 ⇔ 102・西の水路の階段 → 結界の真下");

    // ===== 4. 102 結界の真下 =====
    await game.shot("beneath-barrier");
    await go(BENEATH, 8, 7, 6);
    check((await talk()).join("").includes("割れた石が一つあるよ"), "R48 の本文");
    check(await game.eval(() => Hai.Thoughts.hasNote("clue:R48")), "R48 の手がかりがメモに無い");
    // 光の床：踏むと押し戻される
    await go(BENEATH, 9, 6, 6);
    await game.call("step", 6);
    await game.waitFor(() => $gameMessage.isBusy(), null, 30_000);
    await game.shot("barrier-light");
    const pushed = (await talk([], {}, false)).join("");
    await game.waitPlayerStopped();
    await game.frames(10);
    const back = await pos();
    check(pushed.includes("白い光に押し戻された。") && back.x === 9 && back.y === 6, "光の床で押し戻されない " + JSON.stringify({ pushed, back }));
    // H38：光の当たらない床のひび割れ → 南西の小部屋
    await go(BENEATH, 31, 18, 4);
    await inspectPlain();
    check(await game.eval(() => Hai.HiddenPassage.isFound(30, 18)), "H38 の隠し階段が現れない");
    await game.call("step", 4);
    await arrive(BENEATH, 4, 23);
    await go(BENEATH, 2, 23, 8);
    await talk();
    check((await items("a", ARMOR.shield)) === 1 && (await hasLore("a", ARMOR.shield)), "赤い宝箱で近衛の盾が手に入らない");
    await go(BENEATH, 5, 23, 8);
    await game.call("step", 8);
    await arrive(BENEATH, 29, 18);
    await go(BENEATH, 17, 10, 6);
    await talk();
    check((await items("i", ITEM.dregs)) === 1 && (await hasLore("i", ITEM.dregs)), "水溜まりで白い澱が拾えない");
    await go(BENEATH, 21, 23, 6);
    await talk([-1]);
    check(await game.eval(() => Hai.Warp.visited().some(w => w.name === "結界の真下の控え室")), "控え室の結界を訪れたことにならない");
    await go(BENEATH, 20, 25, 6);
    check((await talk()).join("").includes("冷えると脆くなる"), "R47 の本文");
    check(await game.eval(() => Hai.Thoughts.hasNote("clue:R47")), "R47 の手がかりがメモに無い");
    await go(BENEATH, 17, 22, 8);
    await talk();
    check((await items("i", ITEM.template)) === 1 && (await hasLore("i", ITEM.template)), "壁の刻みの下で錠前師の型紙が拾えない");
    const r49 = (await talk()).join("\n");
    check(r49.includes("錠は俺だ") && r49.includes("……俺の字だ") && (await game.eval(() => Hai.Thoughts.isRead("R49"))), "R49 " + JSON.stringify(r49));
    await go(BENEATH, 19, 25, 2);
    await game.call("step", 2);
    await arrive(KNIGHT_HALL, 13, 3);
    await game.shot("knight-hall");
    console.log("  結界の真下：R48・光の床で押し戻される・H38 → 近衛の盾・白い澱・控え室の結界・R47・錠前師の型紙・R49 → 灰の騎士の間");

    // ===== 5. 103 灰の騎士 =====
    await game.eval(() => $gameActors.actor(1).changeLevel(13, false));
    await startFight(KNIGHT_HALL, 13, 8, 2);
    check((await log()).msgs.includes("――灰の騎士――"), "戦闘の頭に灰の騎士の名前が出ない");
    const opening = await game.eval(() => ({ ghost: $gameTroop.members()[1].isAppeared(), guard: $gameTroop.members()[0].isStateAffected(502), msgs: window.__log.msgs }));
    check(opening.ghost && opening.guard && opening.msgs.some(m => m.includes("近衛が立ち上がった")), "開幕に近衛の亡霊を呼ばない " + JSON.stringify(opening));
    await game.shot("knight-battle");
    await escapeBoss(155, KNIGHT.escape);
    await startFight(KNIGHT_HALL, 13, 8, 2);
    const knight = await game.eval(() => { const e = $gameTroop.members()[0]; return { pdr: e.pdr, mdr: e.mdr, dark: e.elementRate(9), ice: e.elementRate(3), poison: e.isStateResist(141), sleep: e.isStateResist(142), confuse: e.stateRate(144), death: e.stateRate(1) }; });
    // 物理 50%（亡霊がいる間は近衛の守りでさらに半分）
    check(knight.pdr === 0.25 && knight.mdr === 0.5 && knight.dark === 0 && knight.ice === 2 && knight.poison && knight.sleep && knight.confuse === 1.5 && knight.death === 0, "灰の騎士の耐性 " + JSON.stringify(knight));
    let b = await boss();
    await heal();
    await turn([{ item: ITEM.frost }]);
    let b2 = await boss();
    check(b2.hp < b.hp && (await log()).texts.includes("灰の騎士は氷に弱いようだ。"), `凍て石で氷の弱点のヒントが出ない ${b.hp} → ${b2.hp} ` + JSON.stringify((await log()).texts.slice(-6)));
    // 亡霊を倒すと「近衛の守り」が外れる
    await game.eval(() => { const g = $gameTroop.members()[1]; g.addState(1); g.performCollapse(); });
    await heal();
    await turn(["guard"]);
    check(!(await game.eval(() => $gameTroop.members()[0].isStateAffected(502))), "亡霊を倒しても近衛の守りが外れない");
    // HP 70% でもう一体
    await game.eval(() => { const e = $gameTroop.members()[0]; e.setHp(Math.floor(e.mhp * 0.69)); });
    await heal();
    await turn(["guard"]);
    const second = await game.eval(() => ({ ghost: $gameTroop.members()[2].isAppeared(), guard: $gameTroop.members()[0].isStateAffected(502) }));
    check(second.ghost && second.guard, "HP 70% で 2 体目の亡霊を呼ばない " + JSON.stringify(second));
    // HP 50% で灰の嵐（514）。ターンの終わりに嵐
    await game.eval(() => { const e = $gameTroop.members()[0]; e.setHp(Math.floor(e.mhp * 0.5) + 10); });
    await heal();
    await turn(["attack"]);
    b = await boss();
    check(b.id === 514 && b.phase === 2, "HP 50% で灰の嵐にならない " + JSON.stringify(b));
    await heal();
    await turn(["guard"]);
    check((await log()).msgs.some(m => m.includes("灰の嵐が吹き荒れる")), "灰の嵐が吹かない");
    await game.shot("knight-storm");
    // HP 25% を切ると、残った亡霊が通常攻撃をかばう（MZ の身代わり）。必中の凍て石の 2 つ目で止めを刺す
    await game.eval(() => $gameTroop.members()[0].setHp(30));
    for (let i = 0; i < 3 && (await game.eval(() => !BattleManager.isBattleEnd() && $gameTroop.members()[0].isAlive())); i++) {
      await heal();
      await turn([{ item: ITEM.frost }]);
    }
    await game.waitFor(() => !(SceneManager._scene instanceof Scene_Battle) || BattleManager.isBattleEnd() || $gameMessage.isBusy(), null, 60_000);
    await toMap();
    await finishEvent();
    const won = await game.eval(tr => ({ sw: $gameSwitches.value(155), defeated: Hai.Boss.defeated(tr), msgs: window.__log.msgs.slice(-12) }), KNIGHT.troop);
    check(won.sw && won.defeated, "灰の騎士を倒したのに旗が立たない " + JSON.stringify(won));
    check(won.msgs.some(m => m.includes("灰になって崩れた")), "主を失った近衛が崩れない " + JSON.stringify(won.msgs));
    check((await items("w", WEAPON.oath)) === 1 && (await hasLore("w", WEAPON.oath)), "灰の騎士の固定ドロップ（近衛の誓剣）が無い");
    console.log("  灰の騎士：逃走・開幕の近衛と近衛の守り・凍て石で氷のヒント・HP 70% で 2 体目・HP 50% で灰の嵐（毎ターンの嵐）・撃破（スイッチ 155）・近衛の誓剣");

    // ===== 6. 104 オーブの間「封印」 =====
    await go(KNIGHT_HALL, 13, 14, 2);
    await game.call("step", 2);
    await arrive(ORB_ROOM, 8, 4);
    await game.shot("orb-seal-room");
    await go(ORB_ROOM, 6, 9, 2);
    check((await talk()).join("").includes("ここで誰かが倒れたようだ"), "血の跡の文章");
    const orbCount = await v(101);
    await go(ORB_ROOM, 8, 7, 2);
    const scene = (await talk([], { 1: "orb-seal-scene" })).join("\n");
    check(scene.includes("胸に刃を当てる。錠の印を刻む。") && scene.includes("門を、開けてはいけない。そう決めたはずだった") && scene.includes("オーブ「封印」を取り戻した"),
      "オーブ「封印」の場面 " + JSON.stringify(scene));
    const got = await game.eval(() => ({ sw104: $gameSwitches.value(104), v101: $gameVariables.value(101), sw105: $gameSwitches.value(105) }));
    check(got.sw104 && got.v101 === orbCount + 1 && !got.sw105, "オーブ「封印」の旗 " + JSON.stringify(got));
    // 4 つ目だったとき（ほかの 3 つを先に取っていた）：105・106 とユエルの一言
    await game.eval(() => { $gameSwitches.setValue(104, false); $gameVariables.setValue(101, 3); });
    const fourth = (await talk()).join("\n");
    const four = await game.eval(() => ({ v101: $gameVariables.value(101), sw105: $gameSwitches.value(105), sw106: $gameSwitches.value(106) }));
    check(four.v101 === 4 && four.sw105 && four.sw106 && fourth.includes("全部、思い出した。セレスが門で待っている"), "4 つ目のオーブのとき " + JSON.stringify(four));
    await go(ORB_ROOM, 10, 7, 8);
    await game.call("step", 8);
    await arrive(HALL, 16, 18);
    await game.call("save", 1);
    await game.call("goToTitle");
    await game.waitScene("Scene_Title");
    await game.call("load", 1);
    await game.waitScene("Scene_Map");
    const loaded = await game.eval(() => ({
      map: $gameMap.mapId(), sw104: $gameSwitches.value(104), sw105: $gameSwitches.value(105), sw155: $gameSwitches.value(155), sw160: $gameSwitches.value(160),
      found: Hai.HiddenPassage.isFound(30, 18, 102), r49: Hai.Thoughts.isRead("R49"),
    }));
    check(loaded.map === HALL && loaded.sw104 && loaded.sw105 && loaded.sw155 && loaded.sw160 && loaded.found && loaded.r49, "ロードの後の状態 " + JSON.stringify(loaded));
    await p.calm();
    console.log("  オーブの間：血の跡・場面（スイッチ 104・変数 101）・4 つ目なら 105・106・帰りの転送陣・セーブとロード");

    // ===== 7. 010 の螺旋階段 → 015 王都の門 → 結末 B =====
    // オーブ 3 つ（4 つ目を取る前）のとき
    await game.eval(() => { $gameSwitches.setValue(105, false); $gameVariables.setValue(101, 3); });
    await go(HALL, 16, 18, 8);
    check((await talk(["上る"])).join("").includes("白い光が薄れている。上れそうだ。"), "螺旋階段の文章（オーブ 3 つ）");
    await arrive(GATE, 13, 15);
    await game.shot("royal-gate");
    await go(GATE, 13, 5, 8);
    await game.call("step", 8);
    const first = (await talk([], { 2: "gate-pushed" }, false)).join("\n");
    await game.waitPlayerStopped();
    check(first.includes("……入れない") && first.includes("あと一つ。持って帰ってきたら、ここで待ってる") && (await sw(115)), "門の前（オーブ 3 つ、初めて）" + JSON.stringify(first));
    check((await pos()).y === 6, "門から押し戻されない " + JSON.stringify(await pos()));
    await step(8);
    await game.call("step", 8);
    const second2 = (await talk([], {}, false)).join("");
    await game.waitPlayerStopped();
    check(second2 === "白い光に押し戻された。", "門の前（オーブ 3 つ、2 回目）" + JSON.stringify(second2));
    await go(GATE, 11, 7, 8);
    check((await talk()).join("").includes("あと一つ"), "門の前のセレス（オーブ 3 つ）");
    // オーブ 4 つ：門の前の場面
    await game.eval(() => { $gameSwitches.setValue(105, true); $gameVariables.setValue(101, 4); });
    const full = (await talk(["まだ開けない"], { 3: "gate-celes", choice: "gate-choice" })).join("\n");
    check(full.includes("おかえりなさい、") && full.includes("中の民の魂は、灰としていただく") && full.includes("選んで。開けるか、開けないか") && full.includes("待つのは慣れてる") && (await sw(501)),
      "門の前の場面（オーブ 4 つ）" + JSON.stringify(full));
    const short = (await talk(["門を開ける", "いいえ"])).join("\n");
    check(!short.includes("おかえりなさい") && short.includes("選んで。開けるか、開けないか") && short.includes("本当に開けますか") && short.includes("待つのは慣れてる"), "2 回目の門の前 " + JSON.stringify(short));
    // 門に近づいて「門を開ける」→ はい → 結末 B → タイトル
    await go(GATE, 13, 5, 8);
    await game.eval(() => { window.__log.msgs = []; });
    await game.call("step", 8);
    const end = (await talk(["門を開ける", "はい"], { 5: "ending-ashes", 18: "ending-epilogue", 23: "ending-title" }, false)).join("\n");
    await game.waitScene("Scene_Title");
    const fin = await game.eval(() => ({ sw182: $gameSwitches.value(182), msgs: window.__log.msgs }));
    check(fin.sw182 && end.includes("胸の錠の印が、熱を持つ") && end.includes("契約は嘘をつかない") && fin.msgs.some(m => m.includes("灰が、降りやんだ")) &&
      fin.msgs.some(m => m.includes("灰の履行")), "結末 B " + JSON.stringify({ sw182: fin.sw182, end }));
    console.log("  王都の門：螺旋階段・押し戻される（スイッチ 115）・門の前の場面（スイッチ 501）・まだ開けない・門を開ける → 結末 B（スイッチ 182）→ タイトル");

    game.assertNoErrors();
  } finally {
    await game.close();
  }
});
