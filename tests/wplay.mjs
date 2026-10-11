// W5 の検査（w_stage2e・w_stage2f）で使う、歩く・調べる・戦うの道具。中身は w_stage2b〜2d と同じ（あちらは各ファイルに書いてある）。
// テストの本体ではない（ファイル名に「_」が無いので tests/run.mjs は走らせない）。
import { check } from "./lib.mjs";

export const FAST = 16;

export function makePlay(game) {
  const pos = () => game.call("pos");
  const sw = id => game.eval(i => $gameSwitches.value(i), id);
  const v = id => game.eval(i => $gameVariables.value(i), id);
  const table = k => (k === "a" ? "$dataArmors" : k === "w" ? "$dataWeapons" : "$dataItems");
  const items = (kind, id) => game.eval(([t, i]) => $gameParty.numItems(window[t][i]), [table(kind), id]);
  const hasLore = (kind, id) => game.eval(([t, i]) => /<hai_lore>\n[^<]+<\/hai_lore>/.test(window[t][i].note), [table(kind), id]);
  const log = () => game.eval(() => window.__log);
  const setRand = x => game.eval(r => { window.__rand = r; }, x);

  async function setup() {
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
  }

  /** シンボル敵を眠らせる（勝った扱いのセルフスイッチ A）。歩く道の検査で戦闘に入らないように */
  async function calm() {
    await game.eval(() => {
      for (const ev of $gameMap.events()) if (ev.event().meta.hai_enemy) $gameSelfSwitches.setValue([$gameMap.mapId(), ev.eventId(), "A"], true);
    });
    await game.frames(2);
  }
  async function arrive(m, x, y) {
    await game.waitFor(([m2, x2, y2]) => {
      const g = window.__game;
      const p = g.pos();
      return g.mapId() === m2 && (x2 === undefined || (p.x === x2 && p.y === y2)) && !g.isBusy();
    }, [m, x, y]);
    await calm();
  }
  async function go(m, x, y, d) {
    await game.call("transfer", m, x, y, d);
    await arrive(m, x, y);
  }
  async function step(d) {
    const moved = await game.call("step", d);
    if (moved) await game.waitPlayerStopped();
    return moved;
  }
  /** 一歩ずつ進む。どこかで止まったら落とす */
  async function walk(dirs, what) {
    for (const d of dirs) check(await step(d), `${what}の途中で進めない ${JSON.stringify(await pos())}`);
  }

  /**
   * 決定キーで調べ（press が false なら、もう動いているイベントを）、イベントが終わるまで文章を読み進める（w_stage2b〜2d と同じ）。
   * 選択肢が出たら choices の順に選ぶ（番号、文字列。文字列は前方一致でもよい）。数値入力が出たら choices の次の { number } を入れる。
   */
  async function talk(choices = [], shots = {}, press = true) {
    const queue = choices.slice();
    if (press) await game.press("Enter");
    await game.waitFor(() => $gameMap.isEventRunning() || $gameMessage.isBusy());
    const pages = [];
    for (;;) {
      await game.waitFor(() => {
        const w = SceneManager._scene._messageWindow;
        const c = w && w._choiceListWindow;
        const n = w && w._numberInputWindow;
        return (!$gameMap.isEventRunning() && !$gameMessage.isBusy()) || (w && w.pause) || (c && c.active && c.isOpen()) || (n && n.active) ||
          !(SceneManager._scene instanceof Scene_Map);
      });
      const st = await game.eval(() => {
        const w = SceneManager._scene._messageWindow;
        return {
          running: ($gameMap.isEventRunning() || $gameMessage.isBusy()) && SceneManager._scene instanceof Scene_Map,
          choice: !!(w && w._choiceListWindow.active && w._choiceListWindow.isOpen()),
          number: !!(w && w._numberInputWindow.active),
          text: $gameMessage.allText(),
          choices: $gameMessage.choices(),
        };
      });
      if (!st.running) break;
      if (st.number) {
        const q = queue.shift();
        check(q && q.number !== undefined, `数値入力が出たが、入れる数が無い（${st.text}）`);
        pages.push(st.text + `［${q.number}］`);
        await game.eval(n => {
          const w = SceneManager._scene._messageWindow._numberInputWindow;
          w._number = n;
          w.refresh();
        }, q.number);
        await game.frames(5);
        await game.press("Enter");
      } else if (st.choice) {
        pages.push(st.text + "［" + st.choices.join("／") + "］");
        if (shots.choice) await game.shot(shots.choice);
        const q = queue.shift() ?? 0;
        const i = typeof q === "string" ? st.choices.findIndex(c => c === q || c.startsWith(q)) : q < 0 ? st.choices.length + q : q;
        check(i >= 0 && i < st.choices.length, `選択肢「${q}」が無い ${JSON.stringify(st.choices)}`);
        await game.eval(n => SceneManager._scene._messageWindow._choiceListWindow.select(n), i);
        await game.frames(2);
        await game.press("Enter");
      } else {
        pages.push(st.text);
        if (shots[pages.length - 1]) await game.shot(shots[pages.length - 1]);
        await game.frames(12);
        await game.press("Enter");
      }
      await game.waitFor(prev => {
        const w = SceneManager._scene._messageWindow;
        return (!$gameMap.isEventRunning() && !$gameMessage.isBusy()) || !(SceneManager._scene instanceof Scene_Map) || !w.pause || $gameMessage.allText() !== prev;
      }, st.text);
      await game.frames(2);
    }
    await game.frames(3);
    return pages;
  }

  /** 決定キーで調べて、プラグインが出す文章（隠し扉の発見など。イベントではない）を読み切る。 */
  async function inspectPlain() {
    await game.press("Enter");
    await game.waitFor(() => $gameMessage.isBusy());
    const texts = [];
    while (await game.eval(() => $gameMessage.isBusy())) {
      texts.push(await game.eval(() => $gameMessage.allText()));
      await game.waitFor(() => !$gameMessage.isBusy() || SceneManager._scene._messageWindow.pause);
      await game.frames(12);
      await game.press("Enter");
      await game.frames(4);
    }
    return texts;
  }

  // ---- 戦闘 ----
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
  /** 1 ターン。plan[i] は i 番目の仲間の行動："guard"・"attack"・{ item }・{ skill }。 */
  const turn = async plan => {
    await game.call("setSpeed", FAST);
    await game.eval(p => {
      $gameParty.members().forEach((a, i) => {
        if (!a.action(0) && a.canMove()) a.makeActions();
        const act = a.action(0);
        if (!a.canInput() || !act) return;
        const want = p[i] || "guard";
        if (want === "guard") act.setGuard();
        else if (want === "attack") act.setAttack();
        else if (want.item) act.setItem(want.item);
        else act.setSkill(want.skill);
        act.setTarget(want.target ?? 0);
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
  const boss = () => game.eval(() => {
    const e = $gameTroop.members()[0];
    return { id: e.enemyId(), hp: e.hp, mhp: e.mhp, alive: e.isAlive(), phase: Hai.Boss.phase(e), states: e.states().map(s => s.id) };
  });
  /** ボスに話しかけて（選択肢があれば一つ目を選んで）戦闘の入力の番まで進める。 */
  const startFight = async (m, x, y, d) => {
    await go(m, x, y, d);
    await game.eval(() => { $gameParty.members().forEach(a => a.recoverAll()); window.__log.msgs = []; window.__log.texts = []; });
    await game.press("Enter");
    const t0 = Date.now();
    while ((await game.call("scene")) !== "Scene_Battle") {
      const st = await game.eval(() => {
        const w = SceneManager._scene._messageWindow;
        return { busy: $gameMessage.isBusy(), choice: !!(w && w._choiceListWindow.active) };
      });
      if (st.choice) {
        await game.eval(() => SceneManager._scene._messageWindow._choiceListWindow.select(0));
        await game.frames(2);
        await game.press("Enter");
      } else if (st.busy) {
        await game.frames(12);
        await game.press("Enter");
      } else await game.frames(2);
      check(Date.now() - t0 < 60_000, "ボスに話しかけても戦闘にならない");
    }
    await waitInput();
  };
  /** ボスから逃げて、控えの場所に戻ったかを確かめる */
  const escapeBoss = async (sw155, at) => {
    await setRand(0.01);
    await game.eval(() => SceneManager._scene.commandEscape());
    await toMap();
    await setRand(0.5);
    await finishEvent();
    const esc = await game.eval(s => ({ map: $gameMap.mapId(), pos: window.__game.pos(), sw: $gameSwitches.value(s) }), sw155);
    check(esc.map === at.map && esc.pos.x === at.x && esc.pos.y === at.y && esc.pos.d === at.d && !esc.sw, "ボスから逃げたときの場所と旗 " + JSON.stringify(esc));
  };
  const heal = () => game.eval(() => $gameParty.members().forEach(a => { a.recoverAll(); }));

  return { pos, sw, v, items, hasLore, log, setRand, setup, calm, arrive, go, step, walk, talk, inspectPlain, waitInput, turn, toMap, finishEvent, boss, startFight, escapeBoss, heal };
}
