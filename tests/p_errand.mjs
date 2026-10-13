// P16（#253、R2 止まる 1）頼みごと「外に残された者」（outsiders）の段を下げない：
//   1. Hai.Notes.setErrand：段を下げない筋では、今の段より小さい段は何も書き換えない（段・変数・文・終えた印）。同じ段・0（前のまま）は書ける。ほかの筋は下げられる（prisonBell の 4 → 2）
//   2. 074 小島で森の水門 (14,3) を先に開けてから思念 R3-09〜11 を読んでも「外に残された者」の段は 3（変数 166 も 3）
//      → 071 のミルレーネに伝えると終わり → 010 の三つ目の鐘の夜にミルレーネが砦に来る（ev72、スイッチ 1152）
//   3. 古いセーブの救い：終わったのに段 2・変数 166＝2 のセーブを読み込むと 3 にそろう
import { launchGame, check, runTest } from "./lib.mjs";

const FORT = 10, HOUSE = 71, ISLE = 74;
const VAR = 166;
const SW = { thirdBell: 106, metMirlene: 107, askedOutsiders: 511, waterGateOpen: 512, toldMirlene: 514, mirleneAtFort: 1152 };
const GATE = [14, 3], THOUGHTS = [[10, 7], [19, 7], [6, 11]], MIRLENE = [26, 16];

await runTest(async () => {
  const game = await launchGame();
  try {
    await game.call("newGame");
    await game.waitScene("Scene_Map");
    await game.call("setSpeed", 2);
    const sw = id => game.eval(i => $gameSwitches.value(i), id);
    const vr = id => game.eval(i => $gameVariables.value(i), id);
    const errand = () => game.eval(() => { const e = Hai.Notes.errand("outsiders"); return e && { stage: e.stage, result: e.result, text: e.text }; });

    // ===== 1. setErrand：段を下げない筋（outsiders）は下げない、ほかの筋は下げてよい =====
    const unit = await game.eval(() => {
      const N = Hai.Notes, out = { noDown: N.noDown("outsiders"), free: N.noDown("prisonBell") };
      const st = k => { const e = N.errand(k); return { stage: e.stage, text: e.text, result: e.result, v: $gameVariables.value(e.variableId) }; };
      N.setErrand({ key: "outsiders", stage: 1, text: "一" });
      N.setErrand({ key: "outsiders", stage: 3, text: "三" });
      out.up = st("outsiders");
      N.setErrand({ key: "outsiders", stage: 2, text: "二" });
      out.down = st("outsiders");
      N.setErrand({ key: "outsiders", stage: 3, text: "三の二" });
      out.same = st("outsiders");
      N.setErrand({ key: "outsiders", stage: 0, text: "段は前のまま" });
      out.zero = st("outsiders");
      N.endErrand("outsiders", "done");
      N.setErrand({ key: "outsiders", stage: 2, text: "終えた後の二" });
      out.afterDone = st("outsiders");
      // 段を下げない筋でないもの（変数を写さない仮の key）は、これまでどおり下げられる
      N.setErrand({ key: "test16", stage: 4, text: "四" });
      N.setErrand({ key: "test16", stage: 2, text: "二" });
      out.other = N.errand("test16").stage;
      // 片づけ（あとの通しに残さない）
      const s = $gameSystem._hai.errands;
      s.list = s.list.filter(e => e.key !== "outsiders" && e.key !== "test16");
      $gameVariables.setValue(166, 0);
      return out;
    });
    check(unit.noDown && !unit.free, "段を下げない筋が outsiders だけでない " + JSON.stringify(unit));
    check(unit.up.stage === 3 && unit.up.v === 3, "段が上がらない " + JSON.stringify(unit.up));
    check(unit.down.stage === 3 && unit.down.v === 3 && unit.down.text === "三", "小さい段で段・変数・文が戻る " + JSON.stringify(unit.down));
    check(unit.same.stage === 3 && unit.same.text === "三の二", "同じ段で文が書けない " + JSON.stringify(unit.same));
    check(unit.zero.stage === 3 && unit.zero.text === "段は前のまま", "段 0 で文が書けない " + JSON.stringify(unit.zero));
    check(unit.afterDone.result === "done" && unit.afterDone.stage === 3, "終えた後の小さい段で印が消える " + JSON.stringify(unit.afterDone));
    check(unit.other === 2, "段を下げない筋でないものが下げられない " + unit.other);
    console.log("  setErrand：outsiders は小さい段で何もしない・同じ段と段 0 は書ける・終えた印は残る／ほかの筋は下げられる");

    // ===== 2. 074 で水門を先に開けてから思念を読む → 010 でミルレーネが来る =====
    async function arrive(m, x, y) {
      await game.waitFor(([m2, x2, y2]) => {
        const g = window.__game, p = g.pos();
        return g.mapId() === m2 && p.x === x2 && p.y === y2 && !g.isBusy();
      }, [m, x, y]);
      await game.eval(() => {
        for (const ev of $gameMap.events()) if (ev.event().meta.hai_enemy) $gameSelfSwitches.setValue([$gameMap.mapId(), ev.eventId(), "A"], true);
      });
      await game.frames(2);
    }
    /** イベントが終わるまで文章を読み進める。選択肢は choices の順に選ぶ。読んだ頁の配列。 */
    async function readThrough(choices = []) {
      const queue = choices.slice(), pages = [];
      const t0 = Date.now();
      for (;;) {
        await game.waitFor(() => {
          const w = SceneManager._scene._messageWindow, c = w && w._choiceListWindow;
          return !$gameMap.isEventRunning() || (w && w.pause) || (c && c.active && c.isOpen());
        });
        const st = await game.eval(() => {
          const w = SceneManager._scene._messageWindow;
          return {
            running: $gameMap.isEventRunning() || $gameMessage.isBusy(),
            choice: !!(w && w._choiceListWindow.active && w._choiceListWindow.isOpen()),
            text: $gameMessage.allText(),
            choices: $gameMessage.choices(),
          };
        });
        if (!st.running) break;
        if (st.choice) {
          const q = queue.shift() ?? 0;
          const i = typeof q === "string" ? st.choices.indexOf(q) : q;
          check(i >= 0 && i < st.choices.length, `選択肢「${q}」が無い ${JSON.stringify(st.choices)}`);
          await game.eval(n => SceneManager._scene._messageWindow._choiceListWindow.select(n), i);
          await game.frames(2);
        } else {
          pages.push(st.text);
          await game.frames(12);
        }
        await game.press("Enter");
        await game.waitFor(prev => {
          const w = SceneManager._scene._messageWindow;
          return !$gameMap.isEventRunning() || !w.pause || $gameMessage.allText() !== prev;
        }, st.text);
        await game.frames(2);
        check(Date.now() - t0 < 60_000, "イベントが終わらない");
      }
      await game.frames(3);
      return pages;
    }
    /** (x, y) に d を向いて立ち、決定キーで調べる。 */
    async function look(m, x, y, d, choices = []) {
      await game.call("transfer", m, x, y, d);
      await arrive(m, x, y);
      await game.press("Enter");
      await game.waitFor(() => $gameMap.isEventRunning() || $gameMessage.isBusy());
      return (await readThrough(choices)).join("\n");
    }

    // 071 でミルレーネに頼まれた所から（スイッチ 107・511、段 1）
    await game.eval(([s1, s2, v]) => {
      $gameSwitches.setValue(s1, true);
      $gameSwitches.setValue(s2, true);
      Hai.Notes.setErrand({ key: "outsiders", stage: 1, text: "ミルレーネに森の水門のことを頼まれた", variableId: v });
    }, [SW.metMirlene, SW.askedOutsiders, VAR]);
    const gate = await look(ISLE, GATE[0], GATE[1] + 1, 8, ["根を外して門を開ける"]);
    check(await sw(SW.waterGateOpen), "森の水門が開かない（スイッチ 512） " + JSON.stringify(gate));
    check((await errand()).stage === 3 && (await vr(VAR)) === 3, "水門を開けて段 3 にならない " + JSON.stringify(await errand()));
    const afterGate = (await errand()).text;
    for (const [x, y] of THOUGHTS) {
      await look(ISLE, x, y + 1, 8);
      const e = await errand();
      check(e.stage === 3 && (await vr(VAR)) === 3 && e.text === afterGate, `思念 (${x},${y}) を読むと段が戻る ${JSON.stringify(e)} 変数 ${await vr(VAR)}`);
    }
    console.log("  074：水門を先に開けてから思念 3 つを読んでも段 3・変数 166＝3");

    const told = await look(HOUSE, MIRLENE[0] + 1, MIRLENE[1], 4);
    check((await sw(SW.toldMirlene)) && (await errand()).result === "done", "ミルレーネに伝えて終わらない " + JSON.stringify(told));
    check((await vr(VAR)) === 3, "ミルレーネに伝えたあと変数 166 が 3 でない " + (await vr(VAR)));

    // 010：三つ目の鐘の夜（スイッチ 106）にミルレーネが来る（ev72 は自動実行）
    await game.eval(id => $gameSwitches.setValue(id, true), SW.thirdBell);
    await game.call("transfer", FORT, 49, 2, 2);
    await game.waitFor(m => window.__game.mapId() === m, FORT);
    const t0 = Date.now();
    while (!(await sw(SW.mirleneAtFort))) {
      if (await game.eval(() => $gameMap.isEventRunning() || $gameMessage.isBusy())) await readThrough();
      else await game.frames(5);
      check(Date.now() - t0 < 60_000, "010 でミルレーネが砦に来ない（スイッチ 1152）");
    }
    await readThrough();
    console.log("  ミルレーネに伝える → 010 でミルレーネが砦に来る（スイッチ 1152）");

    // ===== 3. 古いセーブの救い =====
    await game.eval(v => {
      const e = $gameSystem._hai.errands.list.find(x => x.key === "outsiders");
      e.stage = 2;
      $gameVariables.setValue(v, 2);
    }, VAR);
    await game.call("save", 1);
    await game.call("load", 1);
    await game.waitScene("Scene_Map");
    await game.waitFor(() => !window.__game.isBusy());
    const loaded = await game.eval(v => ({ e: Hai.Notes.errand("outsiders"), v: $gameVariables.value(v) }), VAR);
    check(loaded.e.stage === 3 && loaded.e.result === "done" && loaded.v === 3, "古いセーブで段がそろわない " + JSON.stringify(loaded));
    const kept = await game.eval(() => Hai.Notes.repairErrands());
    check(kept.length === 0, "そろえた後にもう一度そろえようとする " + JSON.stringify(kept));
    console.log("  古いセーブ：終わったのに変数 166＝2 → 読み込みで 3");

    game.assertNoErrors();
  } finally {
    await game.close();
  }
});
