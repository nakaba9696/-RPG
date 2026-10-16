// W14（#234）終盤の後半（docs/story/scenes/04-climax.md の 5〜7 章、tools/maps/src/w14_summit.mjs・w14_parts.mjs）の通しの検査：
//   旗の束 bells4（四つ鳴った）から、綱を直し・足場の木を渡した道で 183 → 015 頂：着いた（ブルーノ「七人です」）→ 銘 → ルシアンを止める（道具と写しがそろった道。1156・ソレンヌが生きて残る 1166）
//   → 舌を吊る（1157）→ 耐える戦い「夜の思い」（Troops 1152。8 ターン。1158）→ 綱：まだ・三十を一回ずつ（仲間が外れる）・もう一度、引く（夕べの数）
//   → 010 の結末の夜（戸を開ける 1163）と朝（1159・1165）→ 中庭の子ども・後日談の一行（122）。
// 三十の数は Hai_BigCount で画面の上に大きく出る（文7）。前半（三つ目の鐘〜183）は w_summit.mjs。6 分以内。
import { launchGame, check, runTest } from "./lib.mjs";
import { checkAll } from "../tools/data/check.mjs";

const KEEP = 10, RAMPART = 19, WATER_BELL = 104, SLOPE = 180, LODGE = 181, SCAFFOLD = 182, ROOT = 183, EAST_GATE = 54, SUMMIT = 15;
const SW = { scene3: 106, metMirlene: 107, bowl: 1151, mirlene: 1152, sorenne: 1153, scaffold: 1154, rope: 1155, lucien: 1156, tongue: 1157, endured: 1158, sorenneAlive: 1166, ropeDown: 1167, ismene: 1170, timber: 1055 };
const VAR = { bells: 101, copies: 163, outsiders: 166, faint: 138 };
const ITEM = { ledger: 1151, tools: 1152, twoCopies: 426 };
const STATE_ONE_NIGHT = 1151;
const FAST = 16;
const MAP_SPEED = 4;

const T0 = Date.now();
await runTest(async () => {
  const game = await launchGame();
  try {
    const sw = id => game.eval(i => $gameSwitches.value(i), id);
    const vr = id => game.eval(i => $gameVariables.value(i), id);
    const pos = () => game.call("pos");
    async function calm() {
      await game.eval(() => {
        for (const ev of $gameMap.events()) if (ev.event().meta.hai_enemy) $gameSelfSwitches.setValue([$gameMap.mapId(), ev.eventId(), "A"], true);
      });
      await game.frames(2);
    }
    async function arrive(m, x, y, { quiet = true } = {}) {
      await game.waitFor(([m2, x2, y2]) => {
        const g = window.__game;
        const p = g.pos();
        return g.mapId() === m2 && (x2 === undefined || (p.x === x2 && p.y === y2)) && !g.isBusy();
      }, [m, x, y]);
      if (quiet) await calm();
    }
    async function go(m, x, y, d, opts) {
      await game.call("transfer", m, x, y, d);
      await arrive(m, x, y, opts);
    }
    async function step(d) {
      const moved = await game.call("step", d);
      if (moved) await game.waitPlayerStopped();
      return moved;
    }
    /** 文章を読み進め、選択肢は choices の順に選ぶ。イベントが止まって 10 フレーム動かなければ終わり（自動実行が続くときも拾う）。 */
    async function talk(choices = [], press = true, limit = 120_000) {
      const queue = choices.slice();
      if (press) await game.press("Enter");
      await game.waitFor(() => $gameMap.isEventRunning() || $gameMessage.isBusy() || window.__game.scene() !== "Scene_Map");
      const pages = [];
      const t0 = Date.now();
      let idle = 0;
      while (idle < 10) {
        check(Date.now() - t0 < limit, "イベントが終わらない " + JSON.stringify(pages.slice(-3)));
        const st = await game.eval(() => {
          const s = SceneManager._scene;
          const w = s && s._messageWindow;
          return {
            map: s instanceof Scene_Map,
            running: $gameMap.isEventRunning() || $gameMessage.isBusy() || window.__game.isBusy(),
            pause: !!(w && w.pause),
            choice: !!(w && w._choiceListWindow && w._choiceListWindow.active && w._choiceListWindow.isOpen()),
            text: $gameMessage.allText(),
            speaker: $gameMessage.speakerName(),
            choices: $gameMessage.choices(),
          };
        });
        if (!st.map) return pages; // 戦闘に入った
        if (!st.running) { idle++; await game.frames(1); continue; }
        idle = 0;
        if (st.choice) {
          pages.push((st.speaker ? st.speaker + "：" : "") + st.text + "［" + st.choices.join("／") + "］");
          const q = queue.shift() ?? 0;
          const i = typeof q === "string" ? st.choices.indexOf(q) : q;
          check(i >= 0 && i < st.choices.length, `選択肢「${q}」が無い ${JSON.stringify(st.choices)}`);
          await game.eval(n => SceneManager._scene._messageWindow._choiceListWindow.select(n), i);
          await game.frames(2);
          await game.press("Enter");
          await game.frames(4);
        } else if (st.pause) {
          pages.push((st.speaker ? st.speaker + "：" : "") + st.text);
          await game.frames(6);
          await game.press("Enter");
          for (let i = 0; i < 30; i++) {
            const moved = await game.eval(prev => !SceneManager._scene._messageWindow || !SceneManager._scene._messageWindow.pause || $gameMessage.allText() !== prev, st.text);
            if (moved) break;
            await game.frames(2);
          }
        } else {
          await game.frames(2);
        }
      }
      return pages;
    }
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
        check(Date.now() - t0 < 120_000, "入力の番にならない");
      }
    };
    const attackTurn = async () => {
      await game.call("setSpeed", FAST);
      await game.eval(() => {
        $gameParty.members().forEach(a => {
          if (!a.action(0) && a.canMove()) a.makeActions();
          const act = a.action(0);
          if (!a.canInput() || !act) return;
          act.setAttack();
          act.setTarget(0);
        });
        BattleManager.startTurn();
        SceneManager._scene.changeInputWindow();
      });
      await waitInput();
      await game.call("setSpeed", MAP_SPEED);
    };
    /** 戦闘の画面になるまで待ち、相手を弱らせて勝ち、マップへ戻る。戻ったあとの文章も読む。 */
    async function winBattle(troopId) {
      await game.waitFor(() => window.__game.scene() === "Scene_Battle", null, 60_000);
      if (troopId) check(await game.eval(id => $gameTroop.troop().id === id, troopId), `敵グループが ${troopId} ではない`);
      await waitInput();
      await game.call("strengthenParty");
      await game.eval(() => $gameTroop.members().forEach(e => e.setHp(1)));
      for (let i = 0; i < 4 && (await game.eval(() => SceneManager._scene instanceof Scene_Battle && !$gameTroop.isAllDead())); i++) await attackTurn();
      await game.call("setSpeed", FAST);
      try {
        await game.holdOkToMap();
      } finally {
        await game.call("setSpeed", MAP_SPEED);
      }
      return talk([], false);
    }
    const has = id => game.eval(i => $gameParty.numItems($dataItems[i]), id);

    const r4 = await game.call("setup", "bells4", { level: 20 });
    await game.waitScene("Scene_Map");
    await arrive(r4.to.mapId, r4.to.x, r4.to.y);
    await game.call("setSpeed", MAP_SPEED);
    await game.eval(() => { $gameSwitches.setValue(1155, true); $gameSwitches.setValue(1055, true); $gameSwitches.setValue(1153, true); $gameSwitches.setValue(1172, true); });
    // ===== 7. 015 頂（場面表 5）：ルシアン・銘・舌を吊る・耐える戦い・三十・三十一 =====
    await game.eval(() => { $gameVariables.setValue(162, 2); $gameVariables.setValue(163, 3); }); // 頂の道具と写しがそろった道（ルシアンが彫りはじめる）
    await go(ROOT, 20, 2, 8);
    await step(8);
    const summit = (await talk([], false)).join("\n");
    await arrive(SUMMIT, 20, 28);
    check(summit.includes("親鐘。舌が無く、口は暗い。周りに、木の足場。") && summit.includes("ルシアン：あなたの連れは、何人です") && summit.includes("ブルーノ：……七人です"), "頂に着いた " + JSON.stringify(summit));
    await game.shot("summit");
    await go(SUMMIT, 18, 10, 8); // 親鐘の肌は鐘楼の石組みの面 (18,9)（W29 #314）
    const ins = (await talk(["見ている", "手首を掴む"])).join("\n");
    check(ins.includes("「鳴る音に、その日の者を乗せよ」") && ins.includes("ルシアンは、こちらを見た。鑿は止めなかった。") && ins.includes("ソレンヌ：長。木は、下ろす"), "銘とルシアンを止める " + JSON.stringify(ins));
    check((await sw(SW.lucien)) && (await sw(SW.sorenneAlive)), "ルシアンを止めた（1156）・ソレンヌが生きている（1166）");
    // 足場の柱の彫り直しの指図書（文7。text.md 6-01・6-02）
    await go(SUMMIT, 16, 11, 8);
    const order = (await talk()).join("\n");
    check(order.includes("「一晩のみ。使徒は気づかぬ」") && order.includes("判は四つ。どれも同じ日。") && order.includes("古い鑿が一本"), "足場の柱の指図書 " + JSON.stringify(order));
    await go(SUMMIT, 20, 10, 8); // 親鐘の口は鐘楼の石組みの面 (20,9)（W29 #314）
    const hang = (await talk()).join("\n");
    check(hang.includes("舌を吊った。綱を引いて、金具を上げた。") && hang.includes("「止まっていた」") && (await sw(SW.tongue)), "舌を吊る（1157） " + JSON.stringify(hang));
    await game.waitFor(() => window.__game.scene() === "Scene_Battle", null, 60_000);
    check(await game.eval(id => $gameTroop.troop().id === id, 1152), "耐える戦い「夜の思い」（Troops 1152）");
    await game.shot("endure");
    // 耐える：毎ターン全員が防御（8 ターン目の終わりで勝ち）
    await game.call("strengthenParty");
    for (let t = 0; t < 12 && (await game.eval(() => SceneManager._scene instanceof Scene_Battle && !BattleManager.isBattleEnd())); t++) {
      await waitInput();
      if (!(await game.eval(() => SceneManager._scene instanceof Scene_Battle && BattleManager.isInputting()))) break;
      await game.call("setSpeed", FAST);
      await game.eval(() => {
        $gameParty.members().forEach(a => { if (!a.action(0) && a.canMove()) a.makeActions(); const act = a.action(0); if (a.canInput() && act) act.setGuard(); });
        BattleManager.startTurn();
        SceneManager._scene.changeInputWindow();
      });
    }
    await game.holdOkToMap();
    await game.call("setSpeed", MAP_SPEED);
    await game.waitFor(id => $gameSwitches.value(id) || window.__game.scene() !== "Scene_Map", SW.endured, 30_000).catch(() => {});
    const endSt = await game.eval(id => ({ sw: $gameSwitches.value(id), scene: window.__game.scene(), map: $gameMap.mapId(), turn: $gameTroop.turnCount(), running: $gameMap.isEventRunning(), msg: $gameMessage.allText() }), SW.endured);
    check(endSt.sw, "耐えきった（1158） " + JSON.stringify(endSt));
    // 夜の思いは味方に寄ってきて HP を削るが、倒しはしない（W21 #259。全員が防御していても減る）
    const hps = await game.eval(() => $gameParty.battleMembers().map(a => ({ name: a.name(), hp: a.hp, mhp: a.mhp })));
    check(hps.every(a => a.hp > 0) && hps.some(a => a.hp < a.mhp), "夜の思いで HP が減り、だれも倒れない " + JSON.stringify(hps));
    console.log("  015：着いた・銘・ルシアンを止める（1156・1166）・舌を吊る（1157）・耐える戦い（1158）", `（${Math.round((Date.now() - T0) / 1000)} 秒）`);

    // ===== 8. 綱（まだ・三十・三十一）→ 010 の結末の夜と朝 =====
    // 三十の数は文章の窓でなく、画面の上に大きく出る（Hai_BigCount。R2 7 章 04:815。文7）。出た数と、そのときの絵の位置を毎フレーム控える
    await game.eval(() => {
      window.__bigSeen = [];
      const _update = Scene_Map.prototype.update;
      Scene_Map.prototype.update = function() {
        _update.apply(this, arguments);
        const text = Hai.BigCount.text();
        const seen = window.__bigSeen;
        if (!text || Hai.BigCount.phase() !== "show" || (seen.length && seen[seen.length - 1].text === text)) return;
        const sp = Hai.BigCount.sprite();
        const w = this._messageWindow;
        seen.push({
          text, y: sp ? sp.y / Graphics.height : -1, x: sp ? sp.x / Graphics.width : -1, visible: !!(sp && sp.visible && sp.opacity > 0),
          onTop: !!sp && this.children.indexOf(sp) > this.children.indexOf(this._windowLayer),
          message: w && w.isOpen() ? { y: w.y / Graphics.height, text: $gameMessage.allText() } : null,
        });
      };
    });
    await game.call("setSpeed", 6); // 決定キーの押しっぱなしが連打にならない速さまで上げる
    const ropePages = await talk(["まだ", "引く", ...Array(30).fill("引く"), "もう一度、引く", "開ける"], false, 600_000);
    const rope = ropePages.join("\n");
    const big = await game.eval(() => window.__bigSeen);
    await game.call("setSpeed", MAP_SPEED);
    check(rope.includes("ゼリナ：まだ、って顔しとるな。あんた、勘定が長いわ"), "まだ（一周目の仲間の一言） " + JSON.stringify(rope).slice(0, 300));
    check(rope.includes("ブルーノ：鳴りました。隊長、鳴りました") && rope.includes("ゼリナ：十四人、着いたか見てくる"), "三十を一回ずつ " + JSON.stringify(rope).slice(0, 1500));
    const kan = await game.eval(() => Array.from({ length: 31 }, (_, i) => Hai.BigCount.kanji(i + 1) + "。"));
    check(JSON.stringify(big.map(b => b.text)) === JSON.stringify(kan), "三十の数が一回ずつ大きく出る（一。〜三十。と三十一。） " + JSON.stringify(big.map(b => b.text)));
    check(big.every(b => b.visible && b.onTop && b.y > 0 && b.y < 0.35 && Math.abs(b.x - 0.5) < 0.05), "数は画面の上の真ん中・文章の窓より手前 " + JSON.stringify(big.filter(b => !(b.visible && b.onTop && b.y > 0 && b.y < 0.35)).slice(0, 3)));
    check(big.every(b => !b.message || b.message.y > b.y + 0.2), "数と文章の窓（下）が重ならない " + JSON.stringify(big.filter(b => b.message).slice(0, 3)));
    check(!ropePages.some(p => /^[一二三四五六七八九十]+。$/.test(p)), "数を文章の窓（真ん中）で出していない " + JSON.stringify(ropePages.filter(p => /^[一二三四五六七八九十]+。$/.test(p))));
    check(await game.eval(() => Hai.BigCount.text() === ""), "結末の砦では数が消えている");
    check(rope.includes("相棒は、鐘の音の中へ入っていった。") && rope.includes("音は、山の向こうで消えた。"), "三十のあと・三十一（夕べの数） " + JSON.stringify(rope).slice(-2000, -1000));
    check(rope.includes("ソレンヌ：木は、下ろした。") && rope.includes("食卓が、いっせいに黙った。") && rope.includes("紐は、新しい。") && rope.includes("「ルカ！　爺ちゃんが、飯だって！」") && rope.includes("答えた。"),
      "結末の夜と朝 " + JSON.stringify(rope).slice(-1200));
    const ending = await game.eval(() => ({
      map: $gameMap.mapId(), party: $gameParty._actors.slice(), pulls: $gameVariables.value(1152),
      sw: [1159, 1160, 1161, 1162, 1163, 1165].map(i => $gameSwitches.value(i)),
    }));
    check(ending.map === KEEP && ending.party.join() === "1" && ending.pulls === 30 && ending.sw.join() === "true,true,false,true,true,true", "結末のあと（仲間は外れ・旗） " + JSON.stringify(ending));
    await game.shot("morning");
    await go(KEEP, 24, 19, 8);
    check((await talk()).join("").includes("「三十のつぎって、なんだっけ」"), "中庭の子ども（朝の砦）");
    await go(122, 19, 11, 8);
    check((await talk()).join("").includes("ルシアンは、空の鐘架の前に座っている。"), "後日談の一行（122 空の鐘架）");
    console.log("  綱：まだ・三十・三十一 → 結末の夜（戸を開けた）と朝（1159・1165）・中庭の子ども・後日談", `（${Math.round((Date.now() - T0) / 1000)} 秒）`);

    const problems = checkAll();
    check(problems.length === 0, "データの検査で問題 " + JSON.stringify(problems.slice(0, 5)));
    game.assertNoErrors();
  } finally {
    await game.close();
  }
});
