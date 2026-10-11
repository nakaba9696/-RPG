// W2（#83）W1 の仕上げの検査：
//   1. 崩落の間のオルドの遺骸（Hai_Companions の遺骸・記憶 4「臨終」R12）→ 遺骸が拠点へ送られる（スイッチ 131、記憶、メモ）。
//   2. 拠点の召喚陣（summonMenu）：初めてはセレスの説明（スイッチ 113）→ 選択肢「魂を呼ぶ」でオルドが加わる（スイッチ 136）。
//   3. 結界（Hai_Warp）：地下牢の控え室の結界を調べて覚え、拠点の結界に触れてから、拠点の結界の「転送する」で控え室へ移る。
//   4. 看守長グラウ（Hai_Boss）：話しかけると「ボス戦」。逃げると控え室 (19,22) へ。もう一度戦い、
//      HP 50% で点呼（番犬 2 体）、炎の弱点のヒント、HP 25% で狂乱（形態 2・2 回行動）、看守長を倒すと番犬が逃げて勝ち →
//      スイッチ 151・撃破の記録・看守長の鍵束・北の扉が開く。
// 乱数（Math.random）は固定する（逃走の成否と行動の選び方）。
import { launchGame, check, runTest } from "./lib.mjs";

const HALL = 10;
const COLLAPSE = 28;
const ORDO = { x: 11, y: 6 }; // 遺骸 オルド
const CIRCLE = { x: 28, y: 17 }; // 召喚陣（足元のイベント）
const HALL_WARP = { x: 12, y: 14 }; // 牢獄の間の結界
const CORRIDOR = 34;
const LOBBY_WARP = { x: 22, y: 22 }; // 地下牢の控え室の結界
const ESCAPE_TO = { x: 19, y: 22, d: 8 }; // 看守長から逃げたとき
const TORTURE = 35;
const WARDEN = { x: 13, y: 6 };
const TROOP = 212;
const KEYRING = 203;
const FIRE = 161; // P4 の灰火（炎）
const NAME_LINE = "――看守長グラウ――";
const HINT = "看守長グラウは炎に弱いようだ。";
const ROLL_CALL = "点呼。番犬、二頭。前へ。";
const FLEE = "主を失った番犬は、尾を巻いて逃げていった。";
const FAST = 16;

await runTest(async () => {
  const game = await launchGame();
  try {
    await game.call("newGame");
    await game.waitScene("Scene_Map");
    await game.call("setSpeed", 2);
    await game.eval(() => {
      window.__rand = 0.5;
      Math.random = () => window.__rand;
      window.__log = { msgs: [], texts: [] };
      const add = Game_Message.prototype.add;
      Game_Message.prototype.add = function(text) {
        window.__log.msgs.push(text);
        return add.apply(this, arguments);
      };
      const addText = Window_BattleLog.prototype.addText;
      Window_BattleLog.prototype.addText = function(text) {
        window.__log.texts.push(text);
        return addText.apply(this, arguments);
      };
    });
    const setRand = v => game.eval(x => { window.__rand = x; }, v);
    const log = () => game.eval(() => window.__log);

    async function go(mapId, x, y, d) {
      await game.call("transfer", mapId, x, y, d);
      await game.waitFor(([m, x2, y2]) => {
        const g = window.__game;
        const p = g.pos();
        return g.mapId() === m && p.x === x2 && p.y === y2 && !g.isBusy();
      }, [mapId, x, y]);
      // シンボル敵が邪魔をしないよう、マップの敵を「倒した」ことにする
      await game.eval(() => {
        for (const ev of $gameMap.events()) if (ev.event().meta.hai_enemy) $gameSelfSwitches.setValue([$gameMap.mapId(), ev.eventId(), "A"], true);
      });
      await game.frames(2);
    }

    /** 決定キーで調べ、イベントが終わるまで文章を読み進める。選択肢が出たら choices の順に選ぶ（tests/p_companions.mjs と同じ）。 */
    // 選択肢は番号か文字列。番号が負なら後ろから数える（-1 が最後）。press: false なら決定キーを押さずに、もう始まっているイベントを読む。
    async function talk(choices = [], shots = {}, press = true) {
      const queue = choices.slice();
      if (press) await game.press("Enter");
      await game.waitFor(() => $gameMap.isEventRunning());
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
            running: $gameMap.isEventRunning() && SceneManager._scene instanceof Scene_Map,
            choice: !!(w && w._choiceListWindow.active && w._choiceListWindow.isOpen()),
            text: $gameMessage.allText(),
            choices: $gameMessage.choices(),
          };
        });
        if (!st.running) break;
        if (st.choice) {
          pages.push(st.text + "［" + st.choices.join("／") + "］");
          if (shots.choice) await game.shot(shots.choice);
          const q = queue.shift() ?? 0;
          const i = typeof q === "string" ? st.choices.indexOf(q) : q < 0 ? st.choices.length + q : q;
          check(i >= 0 && i < st.choices.length, `選択肢「${q}」が無い ${JSON.stringify(st.choices)}`);
          await game.eval(n => SceneManager._scene._messageWindow._choiceListWindow.select(n), i);
          await game.frames(2);
          await game.press("Enter");
        } else {
          pages.push(st.text);
          if (shots[pages.length - 1]) await game.shot(shots[pages.length - 1]);
          await game.frames(12); // ▼が出てから 10 フレームは決定を受け付けない
          await game.press("Enter");
        }
        await game.waitFor(prev => {
          const w = SceneManager._scene._messageWindow;
          return !$gameMap.isEventRunning() || !(SceneManager._scene instanceof Scene_Map) || !w.pause || $gameMessage.allText() !== prev;
        }, st.text);
        await game.frames(2);
      }
      await game.frames(3);
      return pages;
    }

    // ===== 1. オルドの遺骸 =====
    await go(COLLAPSE, ORDO.x - 1, ORDO.y, 6);
    const body = await talk([], { 0: "ordo-remains" });
    const bodyText = body.join("\n");
    check(bodyText.includes("この梁は俺を覚えている") && bodyText.includes("拠点の召喚陣で呼べそうだ"), "遺骸の本文 " + JSON.stringify(body));
    check(bodyText.includes("オルドの遺骸を拠点へ送った。"), "遺骸を送った一行が無い " + JSON.stringify(body));
    const remains = await game.eval(([x, y]) => ({
      sw131: $gameSwitches.value(131), found: Hai.Companions.found(), memories: Hai.Companions.memories(5),
      read: Hai.Thoughts.isRead("R12"), gone: !$gameMap.eventsXy(x, y).some(e => e.characterName()),
    }), [ORDO.x, ORDO.y]);
    check(remains.sw131 && remains.found.includes(5) && remains.memories.includes(4) && remains.read && remains.gone,
      "遺骸を調べた後の状態 " + JSON.stringify(remains));
    console.log(`  遺骸：スイッチ 131・見つけた ${JSON.stringify(remains.found)}・記憶 ${JSON.stringify(remains.memories)}・遺骸が消えた`);

    // ===== 2. 召喚陣 =====
    await go(HALL, CIRCLE.x, CIRCLE.y, 2);
    const summon = await talk([0, 0], { 2: "circle-celes", choice: "circle-choice" });
    const summonText = summon.join("\n");
    check(summonText.includes("見つけたのね") && summonText.includes("［魂を呼ぶ／並びを替える／やめる］"), "召喚陣の説明と選択肢 " + JSON.stringify(summon));
    check(summonText.includes("オルドが目を覚ました。"), "オルドが目を覚まさない " + JSON.stringify(summon));
    const party = await game.eval(() => ({
      members: $gameParty.members().map(a => a.actorId()), sw113: $gameSwitches.value(113), sw136: $gameSwitches.value(136),
      count: $gameVariables.value(102),
    }));
    check(JSON.stringify(party.members) === "[1,5]" && party.sw113 && party.sw136 && party.count === 1, "召喚の後のパーティと旗 " + JSON.stringify(party));
    // 2 度目は説明なしで選択肢から
    const again = await talk([2]);
    check(again.length === 1 && again[0].includes("［魂を呼ぶ／並びを替える／やめる］"), "2 度目の召喚陣 " + JSON.stringify(again));
    console.log(`  召喚陣：セレスの説明（スイッチ 113）→ オルドが加わった ${JSON.stringify(party.members)}`);

    // ===== 3. 結界 =====
    await go(CORRIDOR, LOBBY_WARP.x, LOBBY_WARP.y + 1, 8);
    const lobby = await talk([-1], { choice: "warp-lobby" });
    check(lobby.join("\n").includes("地下牢の控え室に触れた。"), "控え室の結界に触れた文章 " + JSON.stringify(lobby));
    await go(HALL, HALL_WARP.x, HALL_WARP.y + 1, 8);
    await game.call("step", 8); // 結界にぶつかる（触れる）
    await game.waitFor(() => $gameMap.isEventRunning() || $gameMessage.isBusy());
    const touched = await talk([], {}, false);
    check(touched.join("\n").includes("牢獄の間に触れた。"), "拠点の結界に触れた文章 " + JSON.stringify(touched));
    const visited = await game.eval(() => Hai.Warp.visited().map(v => v.name));
    check(visited.includes("牢獄の間") && visited.includes("地下牢の控え室"), "訪れた結界 " + JSON.stringify(visited));
    const warpPages = await talk(["転送する", "地下牢の控え室"], { choice: "warp-hall" });
    const list = warpPages.find(p => p.includes("どこへ転送する？")) || "";
    check(list.includes("地下牢の控え室") && !list.includes("牢獄の間"), "拠点の結界からの転送の一覧（いまの所を除く）" + JSON.stringify(warpPages));
    await game.waitFor(m => window.__game.mapId() === m && !window.__game.isBusy(), CORRIDOR);
    const arrived = await game.call("pos");
    check(arrived.x === LOBBY_WARP.x && arrived.y === LOBBY_WARP.y + 1, "転送の着いた所 " + JSON.stringify(arrived));
    console.log(`  結界：訪れた ${JSON.stringify(visited)}、拠点から「地下牢の控え室」へ転送 (${arrived.x},${arrived.y})`);

    // ===== 4. 看守長グラウ =====
    // 戦闘：次の入力か戦闘の終わりまで進める（tests/p_boss.mjs と同じ）
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
    const turn = async plan => {
      await game.call("setSpeed", FAST);
      await game.eval(p => {
        $gameParty.members().forEach((a, i) => {
          if (!a.action(0) && a.canMove()) a.makeActions(); // 縛り・眠りを全回復で解いたあと
          const act = a.action(0);
          if (!a.canInput() || !act) return;
          const want = p[i] || "guard";
          if (want === "guard") act.setGuard();
          else if (want === "attack") act.setAttack();
          else act.setSkill(want.skill);
          act.setTarget(0);
        });
        BattleManager.startTurn();
        SceneManager._scene.changeInputWindow();
      }, plan);
      await waitInput();
      await game.call("setSpeed", 2);
    };
    const toMap = async () => {
      await game.call("setSpeed", FAST);
      await game.page.keyboard.down("Enter");
      try {
        await game.waitFor(() => window.__game.scene() === "Scene_Map", null, 120_000);
      } finally {
        await game.page.keyboard.up("Enter");
        await game.call("setSpeed", 2);
      }
      await game.waitFor(() => !window.__game.isBusy());
    };
    const finishEvent = async () => {
      const t0 = Date.now();
      for (;;) {
        const st = await game.eval(() =>
          window.__game.isBusy() ? "busy" : $gameMessage.isBusy() ? "message" : $gameMap.isEventRunning() ? "busy" : "done");
        if (st === "done") return;
        if (st === "message") await game.press("Enter");
        else await game.frames(2);
        check(Date.now() - t0 < 60_000, "イベントが終わらない");
      }
    };
    const troop = () => game.eval(() => $gameTroop.members().map(e => ({
      id: e.enemyId(), hp: e.hp, mhp: e.mhp, alive: e.isAlive(), appeared: e.isAppeared(),
      phase: Hai.Boss.phase(e), actions: e.numActions(),
    })));
    const startFight = async () => {
      await go(TORTURE, WARDEN.x, WARDEN.y + 1, 8);
      await game.eval(() => { $gameParty.members().forEach(a => a.recoverAll()); window.__log.msgs = []; window.__log.texts = []; });
      await game.press("Enter");
      const t0 = Date.now();
      while ((await game.call("scene")) !== "Scene_Battle") {
        if (await game.eval(() => $gameMessage.isBusy())) {
          await game.frames(12);
          await game.press("Enter");
        } else await game.frames(2);
        check(Date.now() - t0 < 60_000, "看守長に話しかけても戦闘にならない");
      }
      await waitInput();
    };

    // 4a. 逃げる → 控え室
    await startFight();
    const first = await troop();
    check(first.length === 3 && first[0].id === 212 && first[0].alive && !first[1].appeared && !first[2].appeared,
      "看守長の敵グループ（看守長と、隠れた番犬 2 体）" + JSON.stringify(first));
    check((await log()).msgs.includes(NAME_LINE), "戦闘の頭に看守長の名前が出ない " + JSON.stringify((await log()).msgs));
    await game.shot("warden-battle");
    check(await game.eval(() => BattleManager.canEscape()), "看守長から逃げられない");
    await setRand(0.01);
    await game.eval(() => SceneManager._scene.commandEscape());
    await toMap();
    await setRand(0.5);
    await game.waitFor(m => window.__game.mapId() === m && !window.__game.isBusy(), CORRIDOR);
    await finishEvent();
    const esc = await game.eval(() => ({ pos: window.__game.pos(), result: Hai.Boss.lastResult(), sw: $gameSwitches.value(151) }));
    check(esc.pos.x === ESCAPE_TO.x && esc.pos.y === ESCAPE_TO.y && esc.pos.d === ESCAPE_TO.d, "逃げたときの場所 " + JSON.stringify(esc.pos));
    check(esc.result === 1 && !esc.sw, "逃げたのに撃破になった " + JSON.stringify(esc));
    console.log(`  逃走：控え室 (${esc.pos.x},${esc.pos.y}) へ。スイッチ 151 は OFF`);

    // 4b. 倒す
    await startFight();
    await game.call("strengthenParty");
    await game.eval(id => $gameParty.members().forEach(a => { a.learnSkill(id); a.setMp(a.mmp); }), FIRE);
    // HP 50% → 点呼（番犬 2 体）
    await game.eval(() => $gameTroop.members()[0].setHp(1000));
    await turn(["guard", "guard"]);
    let t = await troop();
    check(t[1].appeared && t[1].alive && t[2].appeared && t[2].alive, "HP 50% で番犬が出ない " + JSON.stringify(t));
    check((await log()).msgs.includes(ROLL_CALL), "点呼の台詞が無い " + JSON.stringify((await log()).msgs));
    // 炎の弱点 → ヒント。HP 25% を下回って狂乱（213、形態 2）
    await game.eval(() => { $gameParty.members().forEach(a => a.recoverAll()); $gameTroop.members()[0].setHp(520); });
    await turn([{ skill: FIRE }, "guard"]);
    t = await troop();
    const texts = (await log()).texts;
    check(texts.filter(x => x === HINT).length === 1, "炎の弱点のヒントが 1 回出ていない " + JSON.stringify(texts));
    check(t[0].id === 213 && t[0].phase === 2 && t[0].alive, "HP 25% で狂乱にならない " + JSON.stringify(t[0]));
    check(t[0].actions === 2, "狂乱で 2 回行動にならない " + JSON.stringify(t[0]));
    await game.shot("warden-frenzy");
    // 看守長を倒す → 番犬が逃げて勝ち
    const keys = await game.eval(id => $gameParty.numItems($dataItems[id]), KEYRING);
    await game.eval(() => { $gameParty.members().forEach(a => a.recoverAll()); $gameTroop.members()[0].setHp(1); });
    for (let i = 0; i < 3 && (await troop())[0].alive; i++) await turn(["attack", "attack"]);
    await game.waitFor(() => !(SceneManager._scene instanceof Scene_Battle) || BattleManager.isBattleEnd() || $gameMessage.isBusy(), null, 60_000);
    const msgs = (await log()).msgs;
    check(msgs.includes(FLEE), "看守長を倒しても番犬が逃げない " + JSON.stringify(msgs));
    await toMap();
    await finishEvent();
    const won = await game.eval(([tr, k, x, y]) => ({
      sw: $gameSwitches.value(151), defeated: Hai.Boss.defeated(tr), result: Hai.Boss.lastResult(),
      keys: $gameParty.numItems($dataItems[k]), page: $gameMap.event($gameMap.eventIdXy(x, y)).findProperPageIndex(),
      msgs: window.__log.msgs,
    }), [TROOP, KEYRING, WARDEN.x, WARDEN.y]);
    check(won.sw && won.defeated && won.result === 0 && won.page === 1, "倒したのに旗が立たない " + JSON.stringify(won));
    check(won.keys === keys + 1, `看守長の鍵束が増えていない ${keys} → ${won.keys}`);
    check(won.msgs.includes("看守長は灰になって崩れた。"), "勝ったときの文章が無い " + JSON.stringify(won.msgs));
    // 北の鉄の扉が開いて、オーブの間へ行ける
    await go(TORTURE, 13, 3, 8);
    await game.call("step", 8);
    await game.waitFor(() => window.__game.mapId() === 36 && !window.__game.isBusy());
    await game.shot("orb-room");
    console.log(`  看守長：点呼・炎のヒント・狂乱（形態 2、2 回行動）→ 撃破でスイッチ 151、鍵束 ${keys} → ${won.keys}、オーブの間へ`);

    game.assertNoErrors();
  } finally {
    await game.close();
  }
});
