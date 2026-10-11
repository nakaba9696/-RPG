// P7 ボスの作り（js/plugins/Hai_Boss.js と Enemies/Troops 196–197・Map912）の検査。乱数（Math.random）は固定する。
//   1. 戦闘の頭にボスの名前の 1 行（<hai_boss_name>）。
//   2. 2 回行動（<hai_actions:2>）→ HP 50% 以下で 3 回（<hai_actions_low:3,50>）。
//   3. 雷の弱点を突くとヒントが戦闘ログに 1 回だけ出て、自動メモ（Hai.Thoughts）に 1 行。
//   4. HP 30% を下回った行動の終わりに形態変化（名前が変わり、HP の割合を引き継ぐ。形態 2）。
//   5. 逃走不可で始めても逃げられる（P4）。撃破の旗は立たない。
//   6. Map912 の話しかけて始める型（「ボス戦」コマンド）：逃げると指定の場所へ、もう一度話しかけて倒すと
//      スイッチ 91・撃破の記録・固定ドロップ（ポーション）・セルフスイッチ A。
//   7. セーブ・ロードで撃破の旗が残る。
import { launchGame, check, runTest } from "./lib.mjs";

const TROOP = 196;
const BOSS = { first: 196, second: 197 };
const THUNDER = 115; // MZ の既定のサンダーⅠ（雷）
const POTION = 7;
const SWITCH = 91;
const FAST = 16;
const NAME_LINE = "――試しの番人――";
const HINT = "試しの番人は雷に弱いようだ。";
const TRANSFORM = "試しの番人の姿が変わった！";

await runTest(async () => {
  const game = await launchGame();
  try {
    await game.call("newGame");
    await game.waitScene("Scene_Map");

    await game.eval(() => {
      window.__rand = 0.5;
      Math.random = () => window.__rand;
      window.__log = { msgs: [], texts: [], acts: [], transforms: [] };
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
      const startAction = BattleManager.startAction;
      BattleManager.startAction = function() {
        const s = this._subject;
        window.__log.acts.push({ turn: $gameTroop.turnCount(), enemy: s.isEnemy(), name: s.name() });
        return startAction.apply(this, arguments);
      };
      const tf = Game_Enemy.prototype.haiCheckTransform;
      Game_Enemy.prototype.haiCheckTransform = function() {
        const before = { id: this.enemyId(), name: this.name(), hp: this.hp, mhp: this.mhp };
        const r = tf.apply(this, arguments);
        if (r) window.__log.transforms.push({ before, after: { id: this.enemyId(), name: this.name(), hp: this.hp, mhp: this.mhp } });
        return r;
      };
      // MZ の既定の 4 人（W1 で初期パーティが 1 人になったので組み直す）、レベル 15、サンダーⅠ
      for (const a of $gameParty.members()) $gameParty.removeActor(a.actorId());
      for (const id of [1, 2, 3, 4]) $gameParty.addActor(id);
      for (const a of $gameParty.members()) {
        a.changeLevel(15, false);
        a.learnSkill(115);
        a.recoverAll();
      }
    });
    const log = () => game.eval(() => window.__log);
    const setRand = v => game.eval(x => { window.__rand = x; }, v);
    const enemy = () => game.eval(() => {
      const e = $gameTroop.members()[0];
      return {
        id: e.enemyId(), name: e.name(), hp: e.hp, mhp: e.mhp, alive: e.isAlive(), actions: e.numActions(),
        phase: Hai.Boss.phase(e), boss: Hai.Boss.isBoss(e),
      };
    });
    const recover = () => game.eval(() => $gameParty.members().forEach(a => a.recoverAll()));

    // 次の入力（パーティコマンド）か、戦闘の終わりまで進める。文章は決定で送る。
    const waitInput = async () => {
      const t0 = Date.now();
      for (;;) {
        const st = await game.eval(() => {
          const s = SceneManager._scene;
          if (!(s instanceof Scene_Battle) || $gameTroop.isAllDead() || $gameParty.isAllDead() || BattleManager._escaped) return "end";
          if ($gameMessage.isBusy()) return "message";
          return BattleManager.isInputting() && s._partyCommandWindow.active ? "input" : "busy";
        });
        if (st === "end" || st === "input") return;
        if (st === "message") await game.press("Enter");
        else await game.frames(2);
        check(Date.now() - t0 < 180_000, "入力の番にならない");
      }
    };
    // plan[i]：パーティの i 番目の行動。"guard" / "attack" / { skill }（狙いは敵の 0 番）
    // shotOn を渡すと、その文章が戦闘ログに出ている所でスクリーンショットを撮る（そこまでは等速）
    const turn = async (plan, shotOn) => {
      await game.call("setSpeed", shotOn ? 1 : FAST);
      await game.eval(p => {
        $gameParty.members().forEach((a, i) => {
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
      if (shotOn) {
        const t0 = Date.now();
        for (;;) {
          const shown = await game.eval(t => {
            const w = SceneManager._scene._logWindow;
            return w._lines.includes(t) ? "yes" : BattleManager.isInputting() ? "over" : "no";
          }, shotOn.text);
          if (shown === "yes") {
            await game.shot(shotOn.label);
            break;
          }
          check(shown !== "over" && Date.now() - t0 < 120_000, `戦闘ログに「${shotOn.text}」が出なかった`);
        }
        await game.call("setSpeed", FAST);
      }
      await waitInput();
      await game.call("setSpeed", 1);
    };
    const toMap = async () => {
      await game.call("setSpeed", FAST);
      await game.page.keyboard.down("Enter");
      try {
        await game.waitFor(() => window.__game.scene() === "Scene_Map", null, 120_000);
      } finally {
        await game.page.keyboard.up("Enter");
        await game.call("setSpeed", 1);
      }
      await game.waitScene("Scene_Map");
    };
    // マップの文章を全部送って、イベントが終わるまで待つ
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
    const actsIn = async n => (await log()).acts.filter(a => a.turn === n && a.enemy).length;

    // ===== 1. 名前の表示 =====
    await game.eval(t => window.__game.startBattle(t, false, false), TROOP);
    await game.waitScene("Scene_Battle");
    await game.waitFor(() => $gameMessage.isBusy() && SceneManager._scene._messageWindow.isOpen());
    await game.frames(40);
    const msgs = (await log()).msgs;
    check(msgs[0] === NAME_LINE, "戦闘の頭にボスの名前の 1 行が出ていない " + JSON.stringify(msgs));
    check(msgs[1] && msgs[1].includes("試しの番人"), "名前の行の後に出現の文章が続かない " + JSON.stringify(msgs));
    await game.shot("boss-name");
    await waitInput();
    console.log(`  名前：「${msgs[0]}」→「${msgs[1]}」`);

    // ===== 2. 2 回行動 → HP 50% 以下で 3 回 =====
    let e = await enemy();
    check(e.id === BOSS.first && e.boss && e.phase === 1, "ボスの印・形態が違う " + JSON.stringify(e));
    check(e.actions === 2, "1 ターンの行動が 2 回でない " + JSON.stringify(e));
    await game.eval(() => $gameTroop.members()[0].setHp(1500)); // 50%。このターンの行動はもう決まっている
    await turn(["guard", "guard", "guard", "guard"]);
    check((await actsIn(1)) === 2, "1 ターン目に敵が 2 回動いていない " + JSON.stringify((await log()).acts));
    e = await enemy();
    check(e.actions === 3, "HP 50% で行動が 3 回にならない " + JSON.stringify(e));
    await recover();

    // ===== 3. 雷の弱点 → ヒントとメモ =====
    const mage = ["thunder", "guard", "guard", "guard"].map(x => (x === "thunder" ? { skill: THUNDER } : x));
    await turn(mage, { text: HINT, label: "weak-hint" });
    check((await actsIn(2)) === 3, "2 ターン目に敵が 3 回動いていない");
    let texts = (await log()).texts;
    check(texts.filter(t => t === HINT).length === 1, "弱点のヒントが 1 回出ていない " + JSON.stringify(texts));
    const note = await game.eval(() => ({
      has: Hai.Thoughts.hasNote("boss:196:4"),
      text: (Hai.Thoughts.notes().find(n => n.id === "boss:196:4") || {}).text,
      weak: Hai.Boss.knownWeak(196),
    }));
    check(note.has && note.text === "試しの番人は雷に弱い。" && JSON.stringify(note.weak) === "[4]", "弱点のメモ " + JSON.stringify(note));
    e = await enemy();
    check(e.id === BOSS.first && e.hp / e.mhp > 0.3, "雷 1 発で形態が変わってしまった " + JSON.stringify(e));
    console.log(`  弱点：「${HINT}」、メモ「${note.text}」。HP ${e.hp}/${e.mhp}`);
    await recover();

    // ===== 4. HP 30% で形態変化 =====
    await game.eval(() => $gameTroop.members()[0].setHp(930)); // 31%
    await turn(mage, { text: TRANSFORM, label: "transform" });
    const tf = (await log()).transforms;
    check(tf.length === 1, "形態変化が 1 回でない " + JSON.stringify(tf));
    const { before, after } = tf[0];
    check(before.id === BOSS.first && after.id === BOSS.second && after.name === "崩れの番人", "形態変化の先が違う " + JSON.stringify(tf[0]));
    check(before.hp / before.mhp <= 0.3 && Math.abs(after.hp / after.mhp - before.hp / before.mhp) <= 1 / after.mhp,
      "HP の割合が引き継がれていない " + JSON.stringify(tf[0]));
    texts = (await log()).texts;
    check(texts.includes(TRANSFORM), "形態変化の文章が無い " + JSON.stringify(texts));
    check(texts.filter(t => t === HINT).length === 1, "弱点のヒントが 2 回出た");
    e = await enemy();
    check(e.phase === 2 && e.boss && e.name === "崩れの番人" && e.actions === 3, "形態変化の後の敵 " + JSON.stringify(e));
    console.log(`  形態変化：${before.name} ${before.hp}/${before.mhp} → ${after.name} ${after.hp}/${after.mhp}（形態 ${e.phase}、${e.actions} 回行動）`);

    // ===== 5. 逃走（逃走不可で始めても逃げられる） =====
    check(await game.eval(() => BattleManager.canEscape()), "ボスから逃げられない");
    await setRand(0.01);
    await game.eval(() => SceneManager._scene.commandEscape());
    await toMap();
    await setRand(0.5);
    const afterEscape = await game.eval(([s, t]) => ({
      escaped: BattleManager._escaped, sw: $gameSwitches.value(s), defeated: Hai.Boss.defeated(t),
    }), [SWITCH, TROOP]);
    check(afterEscape.escaped && !afterEscape.sw && !afterEscape.defeated, "逃げたのに撃破になった " + JSON.stringify(afterEscape));

    // ===== 6. Map912：話しかけて始める型 =====
    const talk = async () => {
      await game.call("transfer", 912, 9, 3, 6);
      await game.waitFor(() => window.__game.mapId() === 912 && !window.__game.isBusy());
      await recover();
      await game.eval(() => { window.__log.msgs = []; });
      await game.press("Enter"); // 番人に話しかける
      const t0 = Date.now();
      while ((await game.call("scene")) !== "Scene_Battle") {
        if (await game.eval(() => $gameMessage.isBusy())) await game.press("Enter");
        else await game.frames(2);
        check(Date.now() - t0 < 60_000, "話しかけても戦闘にならない");
      }
      await waitInput();
      check((await log()).msgs.includes(NAME_LINE), "話しかけて始めた戦闘で名前が出ない");
    };
    // 6a. 逃げる → 指定の場所（4,3 右向き）
    await talk();
    await setRand(0.01);
    await game.eval(() => SceneManager._scene.commandEscape());
    await toMap();
    await setRand(0.5);
    await game.waitFor(() => window.__game.mapId() === 912 && !window.__game.isBusy());
    await finishEvent();
    const esc = await game.eval(() => ({ pos: window.__game.pos(), result: Hai.Boss.lastResult(), msgs: window.__log.msgs }));
    check(esc.pos.x === 4 && esc.pos.y === 3 && esc.pos.d === 6, "逃げたときの場所が違う " + JSON.stringify(esc.pos));
    check(esc.result === 1 && esc.msgs.includes("……逃げ出した。"), "逃げた結果の分岐 " + JSON.stringify(esc));
    // 6b. 倒す
    await talk();
    const potions = await game.eval(id => $gameParty.numItems($dataItems[id]), POTION);
    await game.call("strengthenParty");
    for (let i = 0; i < 5 && (await enemy()).alive; i++) await turn(["attack", "attack", "attack", "attack"]);
    check(!(await enemy()).alive, "番人を倒せなかった");
    await toMap();
    await finishEvent();
    const won = await game.eval(([s, t, p]) => ({
      sw: $gameSwitches.value(s), defeated: Hai.Boss.defeated(t), result: Hai.Boss.lastResult(),
      potions: $gameParty.numItems($dataItems[p]), self: $gameSelfSwitches.value([912, 1, "A"]),
      msgs: window.__log.msgs,
    }), [SWITCH, TROOP, POTION]);
    check(won.sw && won.defeated && won.result === 0 && won.self, "倒したのに旗が立っていない " + JSON.stringify(won));
    check(won.potions === potions + 1, `固定ドロップのポーションが増えていない ${potions} → ${won.potions}`);
    check(won.msgs.includes("番人は崩れ落ちた。"), "勝ったときの分岐に入っていない " + JSON.stringify(won.msgs));
    await game.shot("defeated");
    console.log(`  Map912：逃げると (4,3) へ。倒すとスイッチ ${SWITCH}・撃破の記録・ポーション ${potions} → ${won.potions}`);

    // ===== 7. セーブ・ロード =====
    await game.call("save", 1);
    await game.call("goToTitle");
    await game.waitScene("Scene_Title");
    await game.call("load", 1);
    await game.waitFor(() => window.__game.scene() === "Scene_Map" && !window.__game.isBusy());
    const loaded = await game.eval(([s, t]) => ({
      sw: $gameSwitches.value(s), defeated: Hai.Boss.defeated(t), weak: Hai.Boss.knownWeak(196),
      page: $gameMap.event(1).findProperPageIndex(),
    }), [SWITCH, TROOP]);
    check(loaded.sw && loaded.defeated && loaded.page === 1 && JSON.stringify(loaded.weak) === "[4]", "ロードで撃破の旗が消えた " + JSON.stringify(loaded));
    console.log("  セーブ・ロード：スイッチ・撃破の記録・分かった弱点が残る");

    game.assertNoErrors();
  } finally {
    await game.close();
  }
});
