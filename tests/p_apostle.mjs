// P12（#143）の検査：使徒の力と呑まれ・呼びかけ（js/plugins/Hai_Apostle.js）、耐える戦い（Hai_Boss の <hai_endure>）、
// 弱い化け物のためらい（Hai_SymbolEnemy の <hai_enemy_hesitate>）、頼みごとの一覧（Hai_Notes）。乱数（Math.random）は固定する。
//   1. 技は覚えるスイッチ（162）が ON になるまで主人公の技の一覧に無い。ON で戦闘の技の窓に「思いの刃」が出る。
//   2. 耐える戦い（Troops 183、<hai_endure:5>）：画面の操作で「思いの刃」を 3 回 → 呑まれ 40・80・100、3 回目の行動の終わりに
//      ステート「呑まれ」（操作できない）。次のターン、仲間のコマンド「呼びかける」→ ログに「ブルーノ「あなた！　数えてください。いち、に、さん」」、
//      呑まれが 40 に下がりステートが外れる。5 ターン目の終わりで「耐えきった。」→ 勝ち（撃破の旗）。呑まれは 0 に戻る。
//   3. 呼ばないとき：呑まれのステートの間は自動で敵を攻撃し、3 ターンで切れて呑まれが 50 に下がる。
//   4. ためらい（Map919）：<hai_enemy_hesitate> の敵は見つけるとこちらを向いて止まり、30 フレームより後に動き出す。
//      ふつうの敵はすぐ動く。見失って見つけ直すと、もう一度ためらう。
//   5. 頼みごと：「頼みごとを進める」で一行と段（変数 161 に写す）、「頼みごとを終える」で印。メモの画面の「頼みごと」に出る。
//   6. 古いセーブ（$gameSystem._hai.apostle・errands が無い、イベントの _haiSymbol.hesitate が無い）でも初期値で動く。
//      セーブ・ロードで呼びかけの言葉の変更と頼みごとが残る。
import { launchGame, check, runTest } from "./lib.mjs";
import { readSource, findChars } from "../tools/maps/build.mjs";

const MAP_ID = 919;
const source = readSource("p12_hesitate");
const [START] = findChars(source.lines, "S");
const TROOP = 183;
const SKILL = { power: 183, call: 184 };
const STATE = 194;
const LEARN = 162;
const ENGULF_VAR = 167;
const STAGE_VAR = 161;
const FAST = 16;

await runTest(async () => {
  const game = await launchGame();
  try {
    await game.call("newGame");
    await game.waitScene("Scene_Map");
    await game.call("transfer", MAP_ID, START.x, START.y, 2);
    await game.waitFor(id => window.__game.mapId() === id && !window.__game.isBusy(), MAP_ID);
    await game.waitFor(() => SceneManager._scene._spriteset._tilemap.isReady());

    await game.eval(() => {
      window.__rand = 0.5;
      Math.random = () => window.__rand;
      window.__log = { texts: [], msgs: [], acts: [] };
      const addText = Window_BattleLog.prototype.addText;
      Window_BattleLog.prototype.addText = function(text) {
        window.__log.texts.push(text);
        return addText.apply(this, arguments);
      };
      const add = Game_Message.prototype.add;
      Game_Message.prototype.add = function(text) {
        window.__log.msgs.push(text);
        return add.apply(this, arguments);
      };
      const startAction = BattleManager.startAction;
      BattleManager.startAction = function() {
        const s = this._subject;
        const act = s.currentAction();
        window.__log.acts.push({
          turn: $gameTroop.turnCount(), actor: s.isActor() ? s.actorId() : 0,
          skill: act && act.item() ? act.item().id : 0,
        });
        return startAction.apply(this, arguments);
      };
      // 主人公とブルーノ・ノラの 3 人（呼びかけの言葉は world.md 11 章の呼び方）
      for (const a of $gameParty.members()) $gameParty.removeActor(a.actorId());
      for (const id of [1, 5, 6]) $gameParty.addActor(id);
      for (const a of $gameParty.members()) {
        a.changeLevel(30, false);
        a.recoverAll();
      }
    });
    const log = () => game.eval(() => window.__log);

    // ===== 6a. 古いセーブ：状態が無くても初期値で動く =====
    const old = await game.eval(() => {
      delete $gameSystem._hai.apostle;
      delete $gameSystem._hai.errands;
      return {
        engulf: Hai.Apostle.engulf(1), word: Hai.Apostle.callWord(5), learned: Hai.Apostle.isLearned(),
        errands: Hai.Notes.errands().length, none: Hai.Notes.errand("brother"),
      };
    });
    check(old.engulf === 0 && old.word === "あなた！　数えてください。いち、に、さん" && !old.learned && old.errands === 0 && old.none === null,
      "古いセーブの初期値 " + JSON.stringify(old));

    // ===== 1. 技はスイッチで覚える =====
    const skillsOf1 = () => game.eval(() => $gameActors.actor(1).skills().map(s => s.id));
    check(!(await skillsOf1()).includes(SKILL.power), "スイッチが OFF なのに主人公が思いの刃を持っている");
    await game.eval(id => $gameSwitches.setValue(id, true), LEARN);
    check((await skillsOf1()).includes(SKILL.power), "スイッチを ON にしても思いの刃が技の一覧に出ない");
    check(!(await game.eval(() => $gameActors.actor(5).skills().some(s => s.id === 183))), "仲間まで思いの刃を持っている");

    // ---- 戦闘の操作
    const sceneState = () => game.eval(() => {
      const s = SceneManager._scene;
      if (!(s instanceof Scene_Battle)) return "out";
      if ($gameMessage.isBusy()) return "message";
      if (BattleManager.isBattleEnd() || BattleManager._phase === "battleEnd") return "end";
      if (!BattleManager.isInputting()) return "busy";
      if (s._partyCommandWindow.active) return "party";
      if (s._actorCommandWindow.active && BattleManager.actor()) return "actor:" + BattleManager.actor().actorId();
      if (s._skillWindow.active) return "skill";
      return "busy";
    });
    /** 入力の番（パーティコマンド）か、戦闘の終わりまで進める。文章は決定で送る。
     *  文章を送った決定がパーティコマンドに届いて「戦う」に進んでいたら、キャンセルで戻す。 */
    const waitInput = async () => {
      const t0 = Date.now();
      for (;;) {
        const st = await sceneState();
        if (st === "party" || st === "end" || st === "out") return st;
        if (st.startsWith("actor:")) {
          await game.eval(() => SceneManager._scene._actorCommandWindow.processCancel());
          await game.frames(2);
        } else if (st === "message") await game.press("Enter");
        else await game.frames(2);
        if (Date.now() - t0 > 180_000) {
          const why = await game.eval(() => ({
            phase: BattleManager._phase, inputting: BattleManager.isInputting(), busy: BattleManager.isBusy(),
            actor: BattleManager.actor() && BattleManager.actor().actorId(), log: SceneManager._scene._logWindow._lines,
            windows: ["_partyCommandWindow", "_actorCommandWindow", "_skillWindow", "_enemyWindow", "_actorWindow"].map(k => k + ":" + SceneManager._scene[k].active),
          }));
          check(false, "入力の番にならない " + JSON.stringify(why));
        }
      }
    };
    const waitState = async want => {
      const t0 = Date.now();
      for (;;) {
        const st = await sceneState();
        if (st === want) return;
        check(Date.now() - t0 < 30_000, `「${want}」にならない（今は ${st}）`);
        await game.frames(1);
      }
    };
    const commands = () => game.eval(() => SceneManager._scene._actorCommandWindow._list.map(c => ({ ...c })));
    /** 今入力している仲間のコマンドを選ぶ（決定のときと同じ processOk。使えないコマンドは選べない）。 */
    const pick = async (actorId, symbol, skillId) => {
      await waitState("actor:" + actorId);
      if (symbol === "skill") {
        const ok = await game.eval(id => {
          const w = SceneManager._scene._actorCommandWindow;
          const i = w._list.findIndex(c => c.symbol === "skill" && c.ext === $dataSkills[id].stypeId);
          if (i < 0) return false;
          w.select(i);
          w.processOk();
          return true;
        }, skillId);
        check(ok, `アクター ${actorId} の技のコマンドが無い`);
        await waitState("skill");
        const listed = await game.eval(id => {
          const w = SceneManager._scene._skillWindow;
          const i = w._data.findIndex(s => s && s.id === id);
          if (i < 0) return { i, ids: w._data.map(s => s && s.id) };
          w.select(i);
          const enabled = w.isCurrentItemEnabled();
          w.processOk();
          return { i, enabled };
        }, skillId);
        check(listed.i >= 0 && listed.enabled, `技の窓に ${skillId} が無いか使えない ` + JSON.stringify(listed));
      } else {
        const ok = await game.eval(sym => {
          const w = SceneManager._scene._actorCommandWindow;
          const i = w._list.findIndex(c => c.symbol === sym);
          if (i < 0 || !w._list[i].enabled) return false;
          w.select(i);
          w.processOk();
          return true;
        }, symbol);
        check(ok, `アクター ${actorId} のコマンド ${symbol} が無いか使えない ` + JSON.stringify(await commands()));
      }
      await game.frames(2);
    };
    /** 残っている入力（ノラは 1 ターンに 2 回行動するので 2 つ目）を防御にして、ターンを始める。 */
    const finishInputs = async () => {
      for (let i = 0; i < 8; i++) {
        const st = await sceneState();
        if (!st.startsWith("actor:")) return;
        await game.eval(() => {
          const w = SceneManager._scene._actorCommandWindow;
          w.selectSymbol("guard");
          w.processOk();
        });
        await game.frames(2);
      }
    };
    const fight = async () => {
      await waitState("party");
      await game.eval(() => {
        const w = SceneManager._scene._partyCommandWindow;
        w.selectSymbol("fight");
        w.processOk();
      });
      await game.frames(2);
    };
    const toMap = async () => {
      await game.call("setSpeed", FAST);
      try {
        await game.holdOkToMap();
      } finally {
        await game.call("setSpeed", 1);
      }
      await game.waitScene("Scene_Map");
    };
    const status = () => game.eval(([st, v]) => {
      const a = $gameActors.actor(1);
      const sprite = SceneManager._scene._statusWindow && SceneManager._scene._statusWindow._additionalSprites["actor1-gauge-haiEngulf"];
      return {
        engulf: Hai.Apostle.engulf(1), state: a.isStateAffected(st), turns: a._stateTurns[st] || 0, canInput: a.canInput(),
        variable: $gameVariables.value(v), gauge: sprite ? { visible: sprite.visible, value: sprite.currentValue() } : null,
        turn: $gameTroop.turnCount(), left: Hai.Boss.endureLeft(),
      };
    }, [STATE, ENGULF_VAR]);

    // ===== 2. 耐える戦い：思いの刃 3 回 → 呑まれ → 呼びかけ → 5 ターンで勝ち =====
    // P14 で耐える戦いの主人公の命令は「耐える」「呼ぶ」だけになった。ここではふだんの命令で呑まれの溜まり方を見る（P14 の命令は p_hooks）
    await game.eval(() => Hai.Apostle.setEndureCommands(false));
    await game.eval(t => window.__game.startBattle(t, false, false), TROOP);
    await game.waitScene("Scene_Battle");
    await game.call("setSpeed", FAST);
    check(await game.eval(() => Hai.Boss.endureTurns()) === 5, "耐える戦いのターン数が 5 でない");
    const want = [40, 80, 100];
    for (let t = 1; t <= 3; t++) {
      check((await waitInput()) === "party", `${t} ターン目の入力にならない`);
      if (t === 1) {
        const st = await status();
        check(st.gauge && st.gauge.visible && st.gauge.value === 0, "呑まれのゲージが出ていない " + JSON.stringify(st));
      }
      await fight();
      await pick(1, "skill", SKILL.power);
      const cmds = (await commands()).map(c => c.symbol);
      if (t === 1) check(!cmds.includes("haiCall"), "呑まれが 0 なのに「呼びかける」が出ている " + JSON.stringify(cmds));
      else check(cmds.includes("haiCall"), `呑まれがあるのに「呼びかける」が出ない ${JSON.stringify(cmds)}`);
      await pick(5, "guard");
      await pick(6, "guard");
      await finishInputs();
      if (t === 3) {
        // 呑まれた所で止めて撮る
        await game.waitFor(() => $gameActors.actor(1).isStateAffected(194), null, 60_000);
        await game.call("setSpeed", 1);
        await game.frames(20);
        await game.shot("engulfed");
        await game.call("setSpeed", FAST);
      }
      await waitInput();
      const st = await status();
      check(st.engulf === want[t - 1] && st.variable === want[t - 1], `${t} 回目の思いの刃のあとの呑まれ ${JSON.stringify(st)}`);
      check(st.left === 5 - t, `残りのターン ${JSON.stringify(st)}`);
    }
    let st = await status();
    check(st.state && !st.canInput, "呑まれが最大なのにステートが付かない／操作できる " + JSON.stringify(st));
    let texts = (await log()).texts;
    check(texts.some(x => /は呑まれた。$/.test(x)), "「呑まれた。」の一行が無い " + JSON.stringify(texts.slice(-8)));
    check(texts.filter(x => x === "残り 5 ターン").length === 1 && texts.includes("残り 3 ターン"), "残りのターンの表示 " + JSON.stringify(texts));

    // 4 ターン目：主人公は入力できない。ブルーノが呼びかける（呑まれのいちばん多い主人公へ）
    await fight();
    const cmds4 = await commands();
    check(cmds4.some(c => c.symbol === "haiCall" && c.name === "呼びかける" && c.enabled), "ブルーノに「呼びかける」が無い " + JSON.stringify(cmds4));
    await pick(5, "haiCall");
    await pick(6, "guard");
    await finishInputs();
    await waitInput();
    st = await status();
    check(st.engulf === 40 && !st.state, "呼びかけのあと呑まれが 40 に下がらない／ステートが残る " + JSON.stringify(st));
    texts = (await log()).texts;
    check(texts.includes("ブルーノ「あなた！　数えてください。いち、に、さん」"), "呼びかけの一行が無い " + JSON.stringify(texts.slice(-8)));
    check(texts.some(x => /は顔を上げた。$/.test(x)), "戻った一行が無い " + JSON.stringify(texts.slice(-8)));
    const acts4 = (await log()).acts.filter(a => a.turn === 4 && a.actor === 1);
    check(acts4.length === 1 && acts4[0].skill === 1, "呑まれている主人公が自動で攻撃していない " + JSON.stringify(acts4));
    const call4 = (await log()).acts.filter(a => a.turn === 4 && a.actor === 5);
    check(call4.length === 1 && call4[0].skill === SKILL.call, "ブルーノが呼びかけのスキルを使っていない " + JSON.stringify(call4));

    // 5 ターン目：耐えきると勝ち
    await fight();
    await pick(1, "guard");
    await pick(5, "guard");
    await pick(6, "guard");
    await finishInputs();
    const end = await waitInput();
    check(end === "end" || end === "out", "5 ターン目の終わりで戦闘が終わらない " + end);
    const won = await game.eval(t => ({
      endured: Hai.Boss.endured(), defeated: Hai.Boss.defeated(t), alive: $gameTroop.members()[0].isAlive(),
    }), TROOP);
    check(won.endured && won.defeated && won.alive, "耐えきった勝ちになっていない " + JSON.stringify(won));
    check((await log()).msgs.includes("耐えきった。"), "「耐えきった。」が出ない " + JSON.stringify((await log()).msgs));
    await toMap();
    st = await game.eval(v => ({ engulf: Hai.Apostle.engulf(1), state: $gameActors.actor(1).isStateAffected(194), variable: $gameVariables.value(v) }), ENGULF_VAR);
    check(st.engulf === 0 && !st.state && st.variable === 0, "戦闘のあとに呑まれが残っている " + JSON.stringify(st));
    console.log("  耐える戦い：思いの刃 3 回で呑まれ → 呼びかけで 40 → 5 ターンで勝ち");

    // ===== 3. 呼ばないとき：自動で攻撃し、3 ターンで切れて 50 =====
    await game.eval(() => { window.__log.acts = []; window.__log.texts = []; });
    await game.eval(t => window.__game.startBattle(t, true, false), TROOP);
    await game.waitScene("Scene_Battle");
    await game.call("setSpeed", FAST);
    check((await waitInput()) === "party", "2 回目の戦闘の入力にならない");
    await fight();
    await pick(1, "skill", SKILL.power);
    await game.eval(() => Hai.Apostle.addEngulf($gameActors.actor(1), 60)); // 窓口で溜める（40 + 60 = 100）
    await pick(5, "guard");
    await pick(6, "guard");
    await finishInputs();
    await waitInput();
    st = await status();
    check(st.engulf === 100 && st.state && st.turns >= 2, "窓口で溜めても呑まれない " + JSON.stringify(st));
    for (let t = 2; t <= 3; t++) {
      await fight();
      await pick(5, "guard");
      await pick(6, "guard");
      await finishInputs();
      await waitInput();
    }
    st = await status();
    check(!st.state && st.engulf === 50 && st.canInput, "3 ターンで呑まれが切れて 50 に下がらない " + JSON.stringify(st));
    const auto = (await log()).acts.filter(a => a.actor === 1);
    check(auto.length === 3 && auto[0].skill === SKILL.power && auto.slice(1).every(a => a.skill === 1), "呑まれている間の主人公の行動 " + JSON.stringify(auto));
    // 逃げて終える
    await game.eval(() => {
      const w = SceneManager._scene._partyCommandWindow;
      window.__rand = 0;
      w.selectSymbol("escape");
      w.processOk();
    });
    await toMap();
    await game.eval(() => { window.__rand = 0.5; });
    console.log("  呼ばないとき：自動で攻撃 → 3 ターンで切れて 50");

    // ===== 4. ためらい =====
    await game.eval(() => {
      window.__trace = [];
      window.__tick = 0;
      const update = Game_Map.prototype.update;
      Game_Map.prototype.update = function() {
        update.apply(this, arguments);
        window.__tick++;
        if (!window.__watch) return;
        const ev = $gameMap.event(window.__watch);
        const s = Hai.SymbolEnemy.state(ev);
        window.__trace.push({ t: window.__tick, x: ev.x, d: ev.direction(), chasing: s.chasing, hesitate: s.hesitate });
      };
    });
    const ids = await game.eval(() => {
      const out = {};
      for (const ev of $gameMap.events()) {
        if (!Hai.SymbolEnemy.isSymbolEnemy(ev)) continue;
        out[Hai.SymbolEnemy.hesitateOf(ev) > 0 ? "hesitant" : "plain"] = ev.eventId();
      }
      return out;
    });
    check(ids.hesitant && ids.plain, "ためらう敵とふつうの敵がそろっていない " + JSON.stringify(ids));
    /** 敵 id の通路の x=8 に立ち、追い始めてから最初に動くまでのフレーム数を測る（測ったら離れる）。 */
    const measure = async (id, y) => {
      await game.eval(([i, yy]) => {
        $gamePlayer.locate(1, 1);
        window.__trace = [];
        window.__watch = i;
        $gamePlayer.locate(8, yy);
      }, [id, y]);
      await game.waitFor(i => {
        const tr = window.__trace;
        const ev = $gameMap.event(i);
        return tr.length > 0 && ev.x !== 12;
      }, id, 30_000);
      const tr = await game.eval(() => window.__trace.slice());
      await game.eval(() => { window.__watch = 0; $gamePlayer.locate(1, 1); });
      await game.frames(5);
      const seen = tr.find(r => r.chasing);
      const moved = tr.find(r => r.x !== 12); // 敵は (12,y) から始まる（見つけたその更新で動けば、最初の記録でもう動いている）
      return { wait: moved.t - seen.t, dir: (tr.find(r => r.hesitate > 0) || {}).d, maxHesitate: Math.max(...tr.map(r => r.hesitate)) };
    };
    const back = id => game.eval(i => {
      const ev = $gameMap.event(i);
      ev.locate(12, ev.y);
      ev.setDirection(2);
    }, id);
    const h1 = await measure(ids.hesitant, 1);
    await back(ids.hesitant);
    const p1 = await measure(ids.plain, 3);
    await back(ids.plain);
    const h2 = await measure(ids.hesitant, 1);
    await back(ids.hesitant);
    check(h1.wait >= 30 && h1.dir === 4 && h1.maxHesitate > 0, "ためらう敵が止まらない／こちらを向かない " + JSON.stringify(h1));
    check(p1.wait < 10 && p1.maxHesitate === 0, "ふつうの敵までためらう " + JSON.stringify(p1));
    check(h2.wait >= 30, "見つけ直したときにためらわない " + JSON.stringify(h2));
    console.log(`  ためらい：${h1.wait} フレーム（ふつうの敵は ${p1.wait}）、見つけ直して ${h2.wait}`);
    // 古いセーブ：hesitate の欄が無いイベント
    const oldEv = await game.eval(i => {
      const ev = $gameMap.event(i);
      delete ev._haiSymbol.hesitate;
      return Hai.SymbolEnemy.state(ev).hesitate;
    }, ids.hesitant);
    check(oldEv === 0, "古いセーブのイベントで hesitate が 0 にならない " + oldEv);

    // ===== 5. 頼みごと =====
    const run = list => game.eval(l => {
      const it = new Game_Interpreter();
      it.setup(l.concat([{ code: 0, indent: 0, parameters: [] }]), 0);
      while (it.isRunning()) it.update();
    }, list);
    const errandCmd = (cmd, args) => ({ code: 357, indent: 0, parameters: ["Hai_Notes", cmd, "", args] });
    await run([
      errandCmd("errand", { key: "brother", title: "弟を連れて帰る", who: "アンネリーゼ", stage: "1", text: "弟は灰の信徒の集落にいる。", variableId: String(STAGE_VAR) }),
      errandCmd("errand", { key: "iron", title: "頂の道具", who: "アデル", stage: "1", text: "坑道の鉄を運ぶ。", variableId: "0" }),
    ]);
    let er = await game.eval(v => ({ b: Hai.Notes.errand("brother"), v: $gameVariables.value(v), n: Hai.Notes.errands().length }), STAGE_VAR);
    check(er.n === 2 && er.b.stage === 1 && er.v === 1 && er.b.result === "" && er.b.mapId === 919, "頼みごとの 1 段目 " + JSON.stringify(er));
    await run([errandCmd("errand", { key: "brother", title: "", who: "", stage: "2", text: "弟に帳面を見せた。", variableId: "0" })]);
    er = await game.eval(v => ({ b: Hai.Notes.errand("brother"), v: $gameVariables.value(v), order: Hai.Notes.errands().map(e => e.key) }), STAGE_VAR);
    check(er.b.stage === 2 && er.v === 2 && er.b.title === "弟を連れて帰る" && er.b.text === "弟に帳面を見せた。" && er.order.join() === "iron,brother",
      "頼みごとの 2 段目（書き換え・並び） " + JSON.stringify(er));
    await run([errandCmd("errandEnd", { key: "iron", result: "dead", text: "" })]);
    er = await game.eval(() => Hai.Notes.errand("iron"));
    check(er.result === "dead" && er.text === "坑道の鉄を運ぶ。", "頼みごとを終える（亡くなった） " + JSON.stringify(er));
    // メモの画面の「頼みごと」
    await game.eval(() => SceneManager.push(Scene_HaiNotes));
    await game.waitScene("Scene_HaiNotes");
    await game.waitIdle();
    const tab = await game.eval(() => {
      const s = SceneManager._scene;
      s._categoryWindow.selectSymbol("errand");
      return s._categoryWindow._list.map(c => c.name);
    });
    check(tab.includes("頼みごと（2）"), "メモの画面に「頼みごと」の種類が無い " + JSON.stringify(tab));
    await game.frames(3);
    await game.press("Enter");
    await game.frames(4);
    const shown = await game.eval(() => {
      const w = SceneManager._scene._listWindow;
      const drawn = [];
      const orig = w.drawText;
      w.drawText = function(text) {
        drawn.push(String(text));
        return orig.apply(this, arguments);
      };
      w.refresh();
      w.drawText = orig;
      return { rows: w._data.map(r => r.text), drawn, help: SceneManager._scene._helpWindow._text };
    });
    check(JSON.stringify(shown.rows) === JSON.stringify(["頂の道具：坑道の鉄を運ぶ。", "弟を連れて帰る：弟に帳面を見せた。"]), "頼みごとの一覧（新しい順。終えた筋も新しい所へ） " + JSON.stringify(shown));
    check(shown.drawn.includes("亡くなった") && !shown.drawn.includes("終わった"), "亡くなった印 " + JSON.stringify(shown.drawn));
    check(shown.help.includes("頼んだ人：アデル"), "頼んだ人が出ない " + shown.help);
    await game.shot("errands");
    await game.press("Escape");
    await game.frames(4);
    await game.press("Escape");
    await game.waitScene("Scene_Map");
    await game.waitIdle();

    // ===== 6b. セーブ・ロードで残る =====
    await game.eval(() => Hai.Apostle.setCallWord(5, "……ここです。"));
    await game.call("save", 1);
    await game.eval(() => {
      Hai.Apostle.setCallWord(5, "");
      delete $gameSystem._hai.errands;
    });
    await game.call("load", 1);
    await game.waitScene("Scene_Map");
    const loaded = await game.eval(() => ({ word: Hai.Apostle.callWord(5), word6: Hai.Apostle.callWord(6), brother: Hai.Notes.errand("brother"), iron: Hai.Notes.errand("iron") }));
    check(loaded.word === "……ここです。" && loaded.word6 === "あんた！　あんた、顔が灰色！" && loaded.brother && loaded.brother.stage === 2 && loaded.iron.result === "dead",
      "ロードで呼びかけの言葉・頼みごとが消えた " + JSON.stringify(loaded));
    await game.eval(() => Hai.Apostle.setCallWord(5, ""));
    check(await game.eval(() => Hai.Apostle.callWord(5)) === "あなた！　数えてください。いち、に、さん", "言葉を空にしてもパラメータの言葉に戻らない");

    game.assertNoErrors();
  } finally {
    await game.close();
  }
});
