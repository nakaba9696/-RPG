// W17（#233）原作の反映：地域三と地域四（台本 docs/story/scenes/03-region3-region4.md）の検査。
//   旗と仲間を直に入れて、足した場面だけを見る（道中の通しは w_region3・w_region3b・w_region4）：
//   070 の触れ書きでディルの一言 → 102 の夜の戸（遺骸を見たあと。答えると閂の音、519）→ R3-20 のアンセルモの名簿（520）→ 大扉の数え歌（521）
//   → 105 の大扉の内側（519 のページ）・村の長（戸を叩く音・閂の一行）・F09 の 4 行目
//   → 051 の天幕の夜の戸（手紙を持つ。答えて声だけの影に勝つと言い残しの一行と 620）→ 052 のグィドの数え歌 → 053 の記憶 ベルトラン 4
//   → 111 の帳面（ゼリナの読み上げ、518）→ 010 の食卓（ゼリナの椀 180・トゥーラの背負子 181、ID 61–70）→ 目覚めの一言（Actors 8・11）。
import { launchGame, check, runTest } from "./lib.mjs";
import { POINTS, drawAll } from "../tools/maps/src/w9_maps.mjs";

drawAll();
const L = POINTS.lake, G2 = POINTS.gateFront, WL = POINTS.well;
const LAKE = 70, GATE = 102, WELL = 105, CAMP = 51, BEACON = 52, BONE = 53, WHEAT = 111, FORT = 10;
const SW = { nightGate: 519, anselmoSang: 520, doorRhyme: 521, nightCamp: 620, zelinaLedger: 518, zelinaBowl: 180, tulaPack: 181, wolfram: 306, swordTraded: 611 };
const JOINED = { zelina: 141, anselmo: 142, tula: 144 };
const ACTOR = { dil: 7, zelina: 8, anselmo: 9, tula: 11 };
const ITEM = { dirge: 508, letter: 603, tongue: 606 };
const SHADE_TROOP = 613;
const FAST = 16;

await runTest(async () => {
  const game = await launchGame();
  try {
    await game.call("newGame");
    await game.waitScene("Scene_Map");
    await game.call("setSpeed", 2);
    const sw = id => game.eval(i => $gameSwitches.value(i), id);
    const setSw = (id, v = true) => game.eval(([i, b]) => $gameSwitches.setValue(i, b), [id, v]);
    const gain = (id, n = 1) => game.eval(([i, c]) => $gameParty.gainItem($dataItems[i], c), [id, n]);
    const join = id => game.eval(i => $gameParty.addActor(i), id);
    const leave = id => game.eval(i => $gameParty.removeActor(i), id);

    async function calm() {
      await game.eval(() => {
        for (const ev of $gameMap.events()) if (ev.event().meta.hai_enemy) $gameSelfSwitches.setValue([$gameMap.mapId(), ev.eventId(), "A"], true);
      });
      await game.frames(2);
    }
    async function go(m, x, y, d) {
      await game.call("transfer", m, x, y, d);
      await game.waitFor(([m2, x2, y2]) => {
        const g = window.__game;
        const p = g.pos();
        return g.mapId() === m2 && p.x === x2 && p.y === y2 && !g.isBusy();
      }, [m, x, y]);
      await calm();
    }
    /** 動いているイベントの文章を読み進める（press なら決定キーで調べてから）。選択肢は choices の順に選ぶ。 */
    async function talk(choices = [], press = true) {
      const queue = choices.slice();
      if (press) await game.press("Enter");
      await game.waitFor(() => $gameMap.isEventRunning() || $gameMessage.isBusy());
      const pages = [];
      for (;;) {
        await game.waitFor(() => {
          const w = SceneManager._scene._messageWindow;
          const c = w && w._choiceListWindow;
          return !$gameMap.isEventRunning() || (w && w.pause) || (c && c.active && c.isOpen()) || !(SceneManager._scene instanceof Scene_Map);
        });
        const st = await game.eval(() => {
          const w = SceneManager._scene._messageWindow;
          return {
            running: ($gameMap.isEventRunning() || $gameMessage.isBusy()) && SceneManager._scene instanceof Scene_Map,
            choice: !!(w && w._choiceListWindow.active && w._choiceListWindow.isOpen()),
            text: $gameMessage.allText(),
            speaker: $gameMessage.speakerName(),
            choices: $gameMessage.choices(),
          };
        });
        if (!st.running) break;
        if (st.choice) {
          pages.push(st.text + "［" + st.choices.join("／") + "］");
          const q = queue.shift() ?? 0;
          const i = typeof q === "string" ? st.choices.indexOf(q) : q;
          check(i >= 0 && i < st.choices.length, `選択肢「${q}」が無い ${JSON.stringify(st.choices)}`);
          await game.eval(n => SceneManager._scene._messageWindow._choiceListWindow.select(n), i);
          await game.frames(2);
          await game.press("Enter");
        } else {
          pages.push((st.speaker ? st.speaker + "「" : "") + st.text);
          await game.frames(12);
          await game.press("Enter");
        }
        await game.waitFor(prev => {
          const w = SceneManager._scene._messageWindow;
          return !$gameMap.isEventRunning() || !(SceneManager._scene instanceof Scene_Map) || !w.pause || $gameMessage.allText() !== prev;
        }, st.text);
        await game.frames(2);
      }
      await game.frames(3);
      return pages.join("\n");
    }
    const look = async (m, x, y, d, choices = []) => {
      await go(m, x, y, d);
      return talk(choices);
    };
    // 戦闘（弱くして倒す）
    const waitInput = async () => {
      const t0 = Date.now();
      for (;;) {
        const st = await game.eval(() => {
          const s = SceneManager._scene;
          if (!(s instanceof Scene_Battle) || BattleManager.isBattleEnd() || BattleManager._escaped) return "end";
          if ($gameMessage.isBusy()) return "message";
          return BattleManager.isInputting() && s._partyCommandWindow.active ? "input" : "busy";
        });
        if (st === "end" || st === "input") return;
        if (st === "message") await game.press("Enter");
        else await game.frames(2);
        check(Date.now() - t0 < 180_000, "入力の番にならない");
      }
    };
    const attackAll = async () => {
      await game.call("setSpeed", FAST);
      await game.eval(() => {
        $gameParty.members().forEach(a => {
          if (!a.action(0) && a.canMove()) a.makeActions();
          const act = a.action(0);
          if (a.canInput() && act) { act.setAttack(); act.setTarget(0); }
        });
        BattleManager.startTurn();
        SceneManager._scene.changeInputWindow();
      });
      await waitInput();
      await game.call("setSpeed", 2);
    };

    // ===== 1. 070：触れ書きのあとのディルの一言（隊にいるとき、一度だけ）=====
    await join(ACTOR.dil);
    const notice = await look(LAKE, L.notice[0], L.notice[1] + 1, 8);
    check(notice.includes("その母を") && notice.includes("記録院なら、刷った方が首だな"), "触れ書きのあとのディル " + JSON.stringify(notice));
    const notice2 = await look(LAKE, L.notice[0], L.notice[1] + 1, 8);
    check(!notice2.includes("記録院なら"), "ディルの一言が二度出る");
    await leave(ACTOR.dil);
    console.log("  070：触れ書きのあとのディルの一言（一度きり）");

    // ===== 2. 102：夜の戸、二度目（アンセルモの遺骸を見たあと）・名簿の場面・数え歌 =====
    const gate0 = await look(GATE, G2.gate[0], G2.gate[1] - 1, 2);
    check(gate0.includes("爪の跡で白く") && !gate0.includes("そとのひと") && !(await sw(SW.nightGate)), "遺骸を見る前に夜の戸が出る " + JSON.stringify(gate0));
    await game.eval(id => { $gameSystem._hai.companions = $gameSystem._hai.companions || {}; const s = $gameSystem._hai.companions; s.found = s.found || {}; s.found[id] = true; }, ACTOR.anselmo);
    const night = await look(GATE, G2.gate[0], G2.gate[1] - 1, 2, ["答える"]);
    check(night.includes("内側から、小さな拳で") && night.includes("そとのひと、まだいる？") && night.includes("閂が一つ動く音") && (await sw(SW.nightGate)), "102 の夜の戸 " + JSON.stringify(night));
    const tone = await game.eval(() => $gameScreen.tone().slice());
    const gate1 = await look(GATE, G2.gate[0], G2.gate[1] - 1, 2);
    check(!gate1.includes("そとのひと"), "答えたあとも夜の戸が出る");
    check(tone.join() === (await game.eval(() => $gameScreen.tone().slice())).join(), "夜の戸のあと色調が戻らない " + JSON.stringify(tone));
    await join(ACTOR.anselmo);
    await gain(ITEM.dirge);
    const r320 = await look(GATE, G2.r321[0], G2.r321[1] - 1, 2);
    check(r320.includes("一つしか、歌うとらん") && r320.includes("二つ目、じゃ") && (await sw(SW.anselmoSang)), "R3-20 のあとのアンセルモの名簿 " + JSON.stringify(r320));
    const rhyme = await look(GATE, G2.gate[0], G2.gate[1] - 1, 2);
    check(rhyme.includes("ふたつ、扉の前。") && rhyme.includes("三つ目を抜いてな") && (await sw(SW.doorRhyme)), "扉の内の数え歌 " + JSON.stringify(rhyme));
    check((await look(GATE, G2.gate[0], G2.gate[1] - 1, 2)).includes("爪の跡で白く"), "数え歌のあと大扉が元の文に戻らない");
    await game.shot("gate-night");
    console.log("  102：夜の戸（519）・アンセルモの名簿（520）・扉の内の数え歌（521）");

    // ===== 3. 105：アンセルモの一言（初めて入ったとき）・大扉の内側（519）・村の長・F09 =====
    await game.call("transfer", WELL, WL.arriveS[0], WL.arriveS[1], 8);
    const inside = await talk([], false);
    check(inside.includes("内は、こうなっとったか"), "105 に初めて入ったときのアンセルモ " + JSON.stringify(inside));
    const inner = await look(WELL, WL.gateInner[0], WL.gateInner[1] - 1, 2);
    check(inner.includes("いちばん上の一本が、受けから外れている"), "105 の大扉の内側（519） " + JSON.stringify(inner));
    const elder1 = await look(WELL, WL.elder[0], WL.elder[1] + 1, 8);
    check(elder1.includes("戸を叩く音が増えた") && elder1.includes("村の者には言うておらん"), "村の長の「戸を叩く音」 " + JSON.stringify(elder1));
    const elder2 = await look(WELL, WL.elder[0], WL.elder[1] + 1, 8, ["名簿を見せる"]);
    check(elder2.includes("残りの二本を外した") && elder2.includes("ひとことで、ええんじゃ"), "閂を外す所（519）とアンセルモ " + JSON.stringify(elder2));
    const f09 = await look(WELL, WL.faint[0], WL.faint[1] + 1, 8);
    check(f09.includes("指が、もう一本折れる"), "F09 の 4 行目 " + JSON.stringify(f09));
    await leave(ACTOR.anselmo);
    console.log("  105：大扉の内側（519）・村の長（戸を叩く音・閂の一行）・F09 の 4 行目");

    // ===== 4. 051：夜の戸（天幕）。答えて声だけの影に勝つ =====
    const tent0 = await look(CAMP, 15, 13, 8);
    check(tent0.includes("寝具が十") && !tent0.includes("おまえ"), "手紙が無いのに夜の戸が出る");
    await gain(ITEM.letter);
    await go(CAMP, 15, 13, 8);
    await game.press("Enter");
    const t0 = Date.now();
    while ((await game.call("scene")) !== "Scene_Battle") {
      const st = await game.eval(() => {
        const w = SceneManager._scene._messageWindow;
        return { msg: $gameMessage.isBusy(), choice: !!(w && w._choiceListWindow.active && w._choiceListWindow.isOpen()), choices: $gameMessage.choices() };
      });
      if (st.choice) {
        await game.eval(n => SceneManager._scene._messageWindow._choiceListWindow.select(n), st.choices.indexOf("答える"));
        await game.frames(2);
        await game.press("Enter");
      } else if (st.msg) { await game.frames(12); await game.press("Enter"); } else await game.frames(2);
      check(Date.now() - t0 < 60_000, "天幕の夜の戸で戦闘にならない");
    }
    await waitInput();
    check(await game.eval(id => $gameTroop.troop().id === id, SHADE_TROOP), "声だけの影（名無し兵）の敵グループではない");
    await game.call("strengthenParty");
    await game.eval(() => $gameTroop.members().forEach(e => e.setHp(1)));
    for (let i = 0; i < 3 && (await game.eval(() => SceneManager._scene instanceof Scene_Battle && !$gameTroop.isAllDead())); i++) await attackAll();
    await game.call("setSpeed", FAST);
    await game.page.keyboard.down("Enter");
    try {
      await game.waitFor(() => window.__game.scene() === "Scene_Map", null, 120_000);
    } finally {
      await game.page.keyboard.up("Enter");
      await game.call("setSpeed", 2);
    }
    const after = await talk([], false);
    check(after.includes("顔は覚えている。たぶん") && (await sw(SW.nightCamp)), "影に勝ったあとの言い残しと 620 " + JSON.stringify(after));
    check(!(await look(CAMP, 15, 13, 8)).includes("おまえ"), "答えたあとも夜の戸が出る");
    console.log("  051：天幕の夜の戸 → 声だけの影（613）に勝つ → 言い残しの一行（620）");

    // ===== 5. 052 のグィドの数え歌・053 の記憶 ベルトラン 4 =====
    const guido = await look(BEACON, 9, 5, 6);
    check(guido.includes("よっつ、よっつ目が、見えん") && guido.includes("じいさんが言うなと"), "グィドの数え歌 " + JSON.stringify(guido));
    await setSw(SW.swordTraded);
    const sword = await look(BONE, 9, 9, 8);
    check(sword.includes("森の小屋へ運んだ") && sword.includes("手前に誰か") && !sword.includes("決めてなかった"), "記憶 ベルトラン 4 の差し替え " + JSON.stringify(sword));
    console.log("  052：グィドの数え歌・053：記憶 ベルトラン 4（4 行）");

    // ===== 6. 111：帳面のゼリナ（518）=====
    await join(ACTOR.zelina);
    const ledger = await look(WHEAT, 11, 11, 8);
    check(ledger.includes("舟で着いた。十四。いち、に、さん") && ledger.includes("ほんまに、貰っとるんや") && (await sw(SW.zelinaLedger)), "111 の帳面のゼリナ " + JSON.stringify(ledger));
    check(!(await look(WHEAT, 11, 11, 8)).includes("いち、に、さん"), "ゼリナの読み上げが二度出る");
    console.log("  111：帳面のゼリナの読み上げ（518）");

    // ===== 7. 010 の食卓：ゼリナの椀（180）・トゥーラの背負子（181）=====
    await setSw(JOINED.zelina);
    await setSw(SW.wolfram);
    await game.call("transfer", FORT, 21, 28, 2);
    const bowl = await talk([], false);
    check(bowl.includes("最初の一椀を、炉から三つ目の壁の側の席に置いた。") && bowl.includes("うちは、飲ませる側や") && (await sw(SW.zelinaBowl)), "ゼリナの椀 " + JSON.stringify(bowl));
    const fort = await game.eval(() => $dataMap.events.slice(61, 71).map(e => e && e.name));
    check(fort.every(n => n && n.startsWith("W17 ")), "010 の ID 61–70 " + JSON.stringify(fort));
    await setSw(JOINED.tula);
    await gain(ITEM.tongue);
    await game.call("transfer", FORT, 21, 28, 2);
    const pack = await talk([], false);
    check(pack.includes("その背負子、あたしのだろ") && pack.includes("帰りに返せ") && (await sw(SW.tulaPack)), "トゥーラの背負子 " + JSON.stringify(pack));
    await game.shot("fort-table");
    console.log("  010：ゼリナの椀（180）・トゥーラの背負子（181）。ID 61–70");

    // ===== 8. 目覚めの一言（Actors 8・11）=====
    const wake = await game.eval(() => [$dataActors[8].meta.hai_wake, $dataActors[11].meta.hai_wake]);
    check(wake[0] === "舟は？　あんた、乗りそびれたクチか。" && wake[1] === "兄貴、誰だよ。檻の外の人か。", "目覚めの一言 " + JSON.stringify(wake));

    game.assertNoErrors();
  } finally {
    await game.close();
  }
});
