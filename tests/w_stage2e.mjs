// W5（#120）蘇生師の研究所とオーブ「契約」（docs/world2.md 7・9・11 章、tools/maps/src/w5_09*）の検査：
//   1. 帝国の陣跡 051 の地下壕の奥の坑道 → 研究所・搬入口 090：R39、来訪の記帳（来歴つき）、H32（くぼんだ壁）→ 赤い宝箱「白衣」、
//      搬入の札（魔石の箱）、荷揚げ場の結界。
//   2. 実験棟 091：H33（入口の西の壁の影の無い所から、廊下の西の壁の中を南へ → 封印扉の前）、封印扉が閉じている、
//      R40・R41（番号錠 725 の手がかり）・R42（制御盤と H33 の手がかり）、制御盤 3 つ（変数 106）、所長室の机の蘇生師の印章、
//      H34（搬送路の閂 → 廃坑・下層 027、スイッチ 163。027 の東の壁から戻れる）、H35（廃液槽の裏 → 管の口 → 水門の間 101）、封印扉 → 092。
//   3. 契約の写し室 092：施錠扉（蘇生師の印章）、陣の写し、R43、R44（ボスの弱点）、控えの結界。
//   4. 番人の間 093：契約の番人（逃げると控えの小部屋へ。秤の顔は灰火で炎の弱点のヒント、物理と魔法 50%、
//      HP 50% で獣の顔＝形態変化、物理の弱点のヒント、魔法 無効・眠りが効く、倒すとスイッチ 154・契約者の指輪・割れた秤）。
//   5. オーブの間「契約」094：場面（スイッチ 103・107・変数 101）、取った後は「台座は空だ」、帰りの転送陣 → 牢獄の間。
//   6. セーブ・ロード。
// 乱数（Math.random）は固定する（逃走の成否と行動の選び方）。スキル・状態・装備はテストから与えない（灰火はユエルが初めから覚えている）。
// ユエルの Lv だけ、world2.md 9 章の想定（Lv 13 前後）に上げる（職業 10 は Lv 1 の灰火・魂吸いのほかに技を覚えないので、技は増えない）。
import { launchGame, check, runTest } from "./lib.mjs";
import { makePlay } from "./wplay.mjs";

const CAMP = 51;
const DOCK = 90;
const WARDS = 91;
const COPY = 92;
const KEEPER_HALL = 93;
const ORB_ROOM = 94;
const MINE = 27;
const SLUICE = 101;
const HALL = 10;
const ITEM = { visit: 501, tag: 502, seal: 223, scale: 504 };
const ARMOR = { coat: 501, ring: 502 };
const SKILL = { ashfire: 161 };
const KEEPER = { troop: 506, escape: { map: COPY, x: 26, y: 9, d: 4 } };

await runTest(async () => {
  const game = await launchGame();
  const p = makePlay(game);
  const { pos, sw, v, items, hasLore, log, go, arrive, step, walk, talk, inspectPlain, turn, toMap, finishEvent, boss, startFight, escapeBoss, heal } = p;
  try {
    await p.setup();

    // ===== 1. 051 の地下壕の奥 → 090 研究所・搬入口 =====
    await go(CAMP, 19, 3, 8);
    await game.call("step", 8);
    await arrive(DOCK, 19, 3);
    await game.shot("lab-dock");
    await go(DOCK, 13, 10, 8);
    check((await talk()).join("").includes("女は守衛の俺に「ご苦労さま」と言った。目が赤かった。"), "R39 の本文");
    await go(DOCK, 12, 10, 8);
    await talk();
    check((await items("i", ITEM.visit)) === 1 && (await hasLore("i", ITEM.visit)), "守衛室の机で来訪の記帳（来歴つき）が拾えない");
    // H32：守衛室の北の壁のくぼみ → 隠し部屋の赤い宝箱「白衣」
    await go(DOCK, 10, 9, 8);
    await inspectPlain();
    check(await game.eval(() => Hai.HiddenPassage.isFound(10, 8)), "H32 の隠し扉が開かない");
    await walk([8, 8, 8], "H32 の奥");
    await talk();
    check((await items("a", ARMOR.coat)) === 1 && (await hasLore("a", ARMOR.coat)), "赤い宝箱で白衣が手に入らない");
    await go(DOCK, 20, 19, 6);
    await talk();
    check((await items("i", ITEM.tag)) === 1 && (await hasLore("i", ITEM.tag)), "魔石の箱で搬入の札が拾えない");
    await go(DOCK, 31, 14, 8);
    await talk([-1]);
    check(await game.eval(() => Hai.Warp.visited().some(w => w.name === "研究所の荷揚げ場")), "荷揚げ場の結界を訪れたことにならない");
    await go(DOCK, 19, 23, 2);
    await game.call("step", 2);
    await arrive(WARDS, 21, 3);
    console.log("  搬入口：051 の坑道 → R39・来訪の記帳・H32 → 白衣・搬入の札・荷揚げ場の結界 → 実験棟");

    // ===== 2. 091 実験棟 =====
    await game.shot("lab-wards");
    // H33：入口の西の壁の影の無い所 (18,3) から、廊下の西の壁の中を南へ下りて、封印扉の前 (20,27) に出る
    await go(WARDS, 19, 3, 4);
    await walk([4, 4, ...Array(24).fill(2), 6, 6, 6], "H33");
    const h33 = await pos();
    check(h33.x === 20 && h33.y === 27, "H33 を抜けた先 " + JSON.stringify(h33));
    check(await game.eval(() => Hai.HiddenPassage.isFound(18, 3) && Hai.HiddenPassage.isFound(17, 15)), "H33 が見つけたことにならない");
    await go(WARDS, 21, 28, 2);
    const sealText = (await talk()).join("");
    check(sealText.includes("灯っているのは"), "封印扉の文章 " + JSON.stringify(sealText));
    check(!(await step(2)), "制御盤を倒す前に封印扉を通れる");
    // 思念
    await go(WARDS, 12, 10, 8);
    check((await talk()).join("").includes("俺は、止まり方を知らない。"), "R40 の本文");
    await go(WARDS, 30, 9, 8);
    check((await talk()).join("").includes("七、二、五。"), "R41 の本文");
    check(await game.eval(() => Hai.Thoughts.hasNote("clue:R41")), "R41 の手がかりがメモに無い");
    await go(WARDS, 8, 21, 4);
    check((await talk()).join("").includes("影の無い所を抜けろ"), "R42 の本文");
    check(await game.eval(() => Hai.Thoughts.hasNote("clue:R42") && Hai.Thoughts.hasNote("clue:R42#2")), "R42 の手がかりがメモに無い");
    // 制御盤 3 つ
    for (const [x, y] of [[11, 9], [34, 9], [13, 21]]) {
      await go(WARDS, x, y, 8);
      await talk(["倒す"]);
    }
    const lever = await game.eval(() => ({ v106: $gameVariables.value(106), msgs: window.__log.msgs.slice(-3) }));
    check(lever.v106 === 3 && lever.msgs.some(m => m.includes("三つの灯が、そろって灯った")), "制御盤 3 つで変数 106 が 3 にならない " + JSON.stringify(lever));
    await go(WARDS, 11, 9, 8);
    check((await talk()).join("").includes("レバーは倒してある"), "倒した制御盤をもう一度調べたとき");
    check((await game.eval(() => $gameVariables.value(106))) === 3, "倒した制御盤をもう一度調べると変数 106 が増える");
    // 所長室の机：蘇生師の印章
    await go(WARDS, 33, 3, 8);
    const desk = (await talk()).join("\n");
    check(desk.includes("この字には、見覚えがある") && (await items("i", ITEM.seal)) === 1 && (await hasLore("i", ITEM.seal)), "所長室の机で蘇生師の印章が手に入らない " + JSON.stringify(desk));
    // H34：搬送路の突き当たりの閂 → 廃坑・下層の採掘場。採掘場の東の壁から戻れる
    await go(WARDS, 32, 15, 6);
    await talk(["閂を外す"]);
    await arrive(MINE, 28, 16);
    check(await sw(163), "閂を外してもスイッチ 163 が ON にならない");
    await game.shot("mine-h34");
    await game.call("step", 6);
    await arrive(WARDS, 32, 15);
    // H35：廃液槽の染みた床の東の壁 → 管の口 → 水門の間 101（片道）
    await go(WARDS, 34, 22, 6);
    await walk([6, 6, 6], "H35");
    await game.call("step", 6);
    await game.waitFor(() => $gameMessage.isBusy() || window.__game.mapId() === 101);
    if (await game.eval(() => $gameMessage.isBusy())) await talk([], {}, false);
    await arrive(SLUICE, 7, 10);
    check(await game.eval(() => window.__log.msgs.includes("足を滑らせた！")), "管の口の文章");
    await game.shot("h35-sluice");
    // 封印扉 → 092
    await go(WARDS, 21, 28, 2);
    await walk([2], "開いた封印扉");
    await game.call("step", 2);
    await arrive(COPY, 14, 3);
    console.log("  実験棟：H33・R40〜R42・制御盤 3 つ（変数 106）・蘇生師の印章・H34（スイッチ 163）・H35 → 101・封印扉 → 契約の写し室");

    // ===== 3. 092 契約の写し室 =====
    await game.shot("contract-copy");
    check((await talk()).join("").includes("蘇生師の印章"), "北の扉を印章で開けたときの文章");
    const door = await game.eval(() => $gameSelfSwitches.value([92, $gameMap.eventIdXy(14, 4), "A"]));
    check(door, "蘇生師の印章で北の扉が開かない");
    await walk([2, 2, 2, 2], "契約の写し室");
    await go(COPY, 14, 7, 2);
    check((await talk()).join("").includes("赤い線が、まだ脈打っている"), "陣の写しの文章");
    await go(COPY, 10, 12, 8);
    check((await talk()).join("").includes("その夜から、城下で人が灰になり始めた。"), "R43 の本文");
    await go(COPY, 25, 8, 8);
    check((await talk()).join("").includes("刃はよく通る"), "R44 の本文");
    check(await game.eval(() => Hai.Thoughts.hasNote("clue:R44")), "R44 の手がかりがメモに無い");
    await go(COPY, 27, 8, 6);
    await talk([-1]);
    check(await game.eval(() => Hai.Warp.visited().some(w => w.name === "契約の写し室の控え")), "控えの結界を訪れたことにならない");
    await go(COPY, 14, 14, 2);
    await game.call("step", 2);
    await arrive(KEEPER_HALL, 13, 3);
    await game.shot("keeper-hall");
    console.log("  契約の写し室：施錠扉（印章）・陣の写し・R43・R44・控えの結界 → 番人の間");

    // ===== 4. 093 契約の番人 =====
    await game.eval(() => $gameActors.actor(1).changeLevel(13, false));
    // 4a. 逃げる → 092 の控えの小部屋
    await startFight(KEEPER_HALL, 13, 8, 2);
    check((await log()).msgs.includes("――契約の番人――"), "戦闘の頭に契約の番人の名前が出ない");
    await game.shot("keeper-battle");
    await escapeBoss(154, KEEPER.escape);
    // 4b. 戦う：秤の顔に灰火（炎 200%）、物理と魔法 50%
    await startFight(KEEPER_HALL, 13, 8, 2);
    const scale = await game.eval(() => { const e = $gameTroop.members()[0]; return { pdr: e.pdr, mdr: e.mdr, fire: e.elementRate(2) }; });
    check(scale.pdr === 0.5 && scale.mdr === 0.5 && scale.fire === 2, "秤の顔の耐性 " + JSON.stringify(scale));
    let b = await boss();
    // 契約の鎖（縛り）が毎ターン同じ相手に入る（乱数を固定しているため）ので、ターンの頭に外して灰火を撃たせる
    for (let i = 0; i < 4 && (await boss()).hp === b.hp; i++) {
      await heal();
      await game.eval(() => $gameParty.members().forEach(a => a.removeState(147)));
      await turn([{ skill: SKILL.ashfire }]);
    }
    const b2 = await boss();
    check(b2.hp < b.hp, `灰火が契約の番人に当たらない ${b.hp} → ${b2.hp}`);
    check((await log()).texts.includes("契約の番人は炎に弱いようだ。"), "炎の弱点のヒントが出ない " + JSON.stringify((await log()).texts));
    // HP 50% で秤が割れて獣の顔（513）
    await game.eval(() => { const e = $gameTroop.members()[0]; e.setHp(Math.floor(e.mhp * 0.5) + 10); });
    await heal();
    await turn(["attack"]);
    b = await boss();
    check(b.id === 513 && b.phase === 2, "HP 50% で獣の顔にならない " + JSON.stringify(b));
    await game.shot("keeper-beast");
    const beast = await game.eval(() => { const e = $gameTroop.members()[0]; return { mdr: e.mdr, phys: e.elementRate(1), sleep: e.stateRate(142), sleepMz: e.stateRate(10), death: e.stateRate(1), actions: Hai.Boss.actionCount(513, 1) }; });
    check(beast.mdr === 0 && beast.phys === 1.5 && beast.sleep === 1.5 && beast.sleepMz === 1.5 && beast.death === 0 && beast.actions === 2, "獣の顔の耐性と行動の回数 " + JSON.stringify(beast));
    for (let i = 0; i < 3 && !(await game.eval(() => window.__log.texts.includes("契約の番人は物理に弱いようだ。"))); i++) {
      await heal();
      await game.eval(() => $gameParty.members().forEach(a => a.removeState(147)));
      await turn(["attack"]);
    }
    check((await log()).texts.includes("契約の番人は物理に弱いようだ。"), "物理の弱点のヒントが出ない " + JSON.stringify((await log()).texts.slice(-8)));
    await game.eval(() => $gameTroop.members()[0].setHp(30));
    for (let i = 0; i < 4 && (await game.eval(() => !BattleManager.isBattleEnd() && $gameTroop.members()[0].isAlive())); i++) {
      await heal();
      await game.eval(() => $gameParty.members().forEach(a => a.removeState(147)));
      await turn(["attack"]);
    }
    await game.waitFor(() => !(SceneManager._scene instanceof Scene_Battle) || BattleManager.isBattleEnd() || $gameMessage.isBusy(), null, 60_000);
    await toMap();
    await finishEvent();
    const won = await game.eval(tr => ({ sw: $gameSwitches.value(154), defeated: Hai.Boss.defeated(tr), msgs: window.__log.msgs.slice(-4) }), KEEPER.troop);
    check(won.sw && won.defeated && won.msgs.some(m => m.includes("南の扉の閂が、ひとりでに外れた。")), "契約の番人を倒したのに旗が立たない " + JSON.stringify(won));
    check((await items("a", ARMOR.ring)) === 1 && (await items("i", ITEM.scale)) === 1 && (await hasLore("a", ARMOR.ring)) && (await hasLore("i", ITEM.scale)),
      "契約の番人の固定ドロップ（契約者の指輪・割れた秤）が無い");
    console.log("  契約の番人：逃走・秤の顔（物理と魔法 50%、灰火で炎のヒント）・HP 50% で獣の顔（魔法 無効・物理のヒント・眠り 150%・2 回行動）・撃破（スイッチ 154）・指輪と秤");

    // ===== 5. 094 オーブの間「契約」 =====
    await go(KEEPER_HALL, 13, 14, 2);
    await game.call("step", 2);
    await arrive(ORB_ROOM, 8, 4);
    await game.shot("orb-contract-room");
    const orbCount = await v(101);
    await go(ORB_ROOM, 8, 7, 2);
    const scene = (await talk([], { 1: "orb-contract-scene", 4: "orb-contract-yuel" })).join("\n");
    check(scene.includes("代価は、この国の民の魂の灰") && scene.includes("その女の名を、自分は知っている。セレス。") && scene.includes("セレス。お前だったのか") &&
      scene.includes("オーブ「契約」を取り戻した"), "オーブ「契約」の場面 " + JSON.stringify(scene));
    const got = await game.eval(() => ({ sw103: $gameSwitches.value(103), sw107: $gameSwitches.value(107), v101: $gameVariables.value(101), sw105: $gameSwitches.value(105) }));
    check(got.sw103 && got.sw107 && got.v101 === orbCount + 1 && !got.sw105, "オーブ「契約」の旗 " + JSON.stringify(got));
    const again = (await talk()).join("");
    check(again.includes("台座は空だ") && !again.includes("珠が載っている"), "取った後の台座 " + JSON.stringify(again));
    await go(ORB_ROOM, 10, 7, 8);
    await game.call("step", 8);
    await arrive(HALL, 16, 18);
    console.log("  オーブの間：場面（スイッチ 103・107・変数 101）・取った後は台座は空・帰りの転送陣で牢獄の間へ");

    // ===== 6. セーブ・ロード =====
    await game.call("save", 1);
    await game.call("goToTitle");
    await game.waitScene("Scene_Title");
    await game.call("load", 1);
    await game.waitScene("Scene_Map");
    const loaded = await game.eval(() => ({
      map: $gameMap.mapId(), sw103: $gameSwitches.value(103), sw154: $gameSwitches.value(154), sw163: $gameSwitches.value(163), v106: $gameVariables.value(106),
      found: Hai.HiddenPassage.isFound(10, 8, 90), seal: $gameParty.numItems($dataItems[223]),
    }));
    check(loaded.map === HALL && loaded.sw103 && loaded.sw154 && loaded.sw163 && loaded.v106 === 3 && loaded.found && loaded.seal === 1, "ロードの後の状態 " + JSON.stringify(loaded));
    console.log("  セーブ・ロード：旗（103・154・163）・変数 106・見つけた隠し扉・印章が残る");

    game.assertNoErrors();
  } finally {
    await game.close();
  }
});
