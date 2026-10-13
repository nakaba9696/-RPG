// W12（#195）地域五 麦の街道と関所・鐘守の修道院（docs/world.md 5.1・5.2・5.5・6.5・7.3・8.3、docs/text.md 5.7、tools/maps/src/w12_*）の通しの検査：
//   旗の束 region5（焼けた村の祠の番を越えた所）→ 麦の街道 110 の西の口：捨てた荷（5-01）・薄い思念 F10（記憶が戻る）
//   → 関所の門は札が無いと開かない → 骨の握った通行の札 → 札で門を開ける（スイッチ 1053）→ 関所の塔 112
//   → 収税吏の帳面（5-07）→ ボス 関所の収税吏：通行の札で「通せ」（ステート 1051）、倒すと旗（スイッチ 1051）と秘薬 → 裏の崖道 → 修道院 120
//   → 嘆願書の束・当番表 → 写本室 121 のテオ（頼みごと「足場の木」。変数 176 = 1）→ 地下の工房 123 で木を背負う（変数 176 = 2）
//   → 麦の村 111 のソレンヌに渡す（スイッチ 1055・頼みごとが終わる）→ 鐘守の塔 122 のボス 院長：嘆願書で「西の飢え」（ステート 1053）、
//   倒すと旗（スイッチ 1052）と裏門の鍵（スイッチ 1054）→ 120 の裏門 → 裏の坂 124 → 記録院・前庭 080 → データの検査が通る。
// 寄り道（崖の小道 115・見晴らし 116・020 への縄、街道の祠 113、テオの読み比べ）は、データの検査（到達性・場所移動の行き先）で見る。6 分以内。
import { launchGame, check, runTest } from "./lib.mjs";
import { checkAll } from "../tools/data/check.mjs";

const ROAD = 110, VILLAGE = 111, TOWER = 112, CLOISTER = 120, SCRIPTORIUM = 121, BELFRY = 122, CRYPT = 123, SLOPE = 124, COURT = 80;
const SW = { taxman: 1051, abbot: 1052, gate: 1053, backGate: 1054, timberDelivered: 1055, teo: 1059 };
const VAR = { scaffold: 176 };
const ITEM = { pass: 1051, petitions: 1053, timber: 1055, elixir: 198 };
const STATE = { letPass: 1051, westHunger: 1053 };
const TROOP = { taxman: 1051, abbot: 1052 };
const FAST = 16;
const MAP_SPEED = 4;

const T0 = Date.now();
const lap = () => `（${Math.round((Date.now() - T0) / 1000)} 秒）`;
await runTest(async () => {
  const game = await launchGame();
  try {
    const sw = id => game.eval(i => $gameSwitches.value(i), id);
    const vr = id => game.eval(i => $gameVariables.value(i), id);
    const count = id => game.eval(i => $gameParty.numItems($dataItems[i]), id);
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
    /** 文章を読み進め、選択肢は choices の順に選ぶ。イベントが止まって 10 フレーム動かなければ終わり。 */
    async function talk(choices = [], press = true) {
      const queue = choices.slice();
      if (press) await game.press("Enter");
      await game.waitFor(() => $gameMap.isEventRunning() || $gameMessage.isBusy() || window.__game.scene() !== "Scene_Map");
      const pages = [];
      const t0 = Date.now();
      let idle = 0;
      while (idle < 10) {
        check(Date.now() - t0 < 120_000, "イベントが終わらない " + JSON.stringify(pages.slice(-3)));
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
    /** 戦闘の画面になるまで待ち、戦いの頭のステートを見てから、相手を弱らせて勝ち、マップへ戻る。戻ったあとの文章も読む。 */
    async function winBoss(troopId, stateId) {
      await game.waitFor(() => window.__game.scene() === "Scene_Battle", null, 60_000);
      check(await game.eval(id => $gameTroop.troop().id === id, troopId), `敵グループが ${troopId} ではない`);
      await waitInput();
      const st = await game.eval(s => $gameTroop.members()[0].isStateAffected(s), stateId);
      check(st, `戦いの頭にステート ${stateId} が付かない（弱みの物を持って挑んだ）`);
      await game.call("strengthenParty");
      await game.eval(() => $gameTroop.members().forEach(e => e.setHp(1)));
      for (let i = 0; i < 4 && (await game.eval(() => SceneManager._scene instanceof Scene_Battle && !$gameTroop.isAllDead())); i++) await attackTurn();
      await game.call("setSpeed", FAST);
      await game.page.keyboard.down("Enter");
      try {
        await game.waitFor(() => window.__game.scene() === "Scene_Map", null, 120_000);
      } finally {
        await game.page.keyboard.up("Enter");
        await game.call("setSpeed", MAP_SPEED);
      }
      return talk([], false);
    }

    // ===== 1. 旗の束 region5 → 麦の街道 110 の西の口 =====
    const r = await game.call("setup", "region5");
    await game.waitScene("Scene_Map");
    check(r.to.mapId === ROAD && r.to.x === 2 && r.to.y === 31, "旗の束 region5 の入口が 110 の西の口ではない " + JSON.stringify(r.to));
    await arrive(ROAD, 2, 31);
    await game.call("setSpeed", MAP_SPEED);
    const road = await game.eval(() => ({ name: $gameMap.displayName(), w: $dataMap.width, h: $dataMap.height, tileset: $gameMap.tilesetId() }));
    check(road.name === "麦の街道" && road.w === 70 && road.h === 50 && road.tileset === 24, "麦の街道の大きさ・タイルセット " + JSON.stringify(road));
    await game.shot("road-west");
    // 西の口は 063 の祠の裏口へ戻る
    await go(ROAD, 1, 31, 4);
    await step(4);
    await arrive(63, 13, 4);
    await go(ROAD, 16, 30, 8);
    const load = (await talk()).join("\n");
    check(load.includes("荷の口は、どれも西を向いている") && load.includes("三十四"), "捨てた荷（5-01）" + JSON.stringify(load));
    // 薄い思念 F10（屋根の落ちた荷車小屋）
    const faint0 = await game.eval(() => Hai.Thoughts.faintCount());
    await go(ROAD, 21, 24, 8);
    const f10 = (await talk()).join("\n");
    check(f10.includes("空の麦袋を三つ重ねて") && (await game.eval(() => Hai.Thoughts.isFaint("F10"))), "薄い思念 F10 " + JSON.stringify(f10));
    check((await game.eval(() => Hai.Thoughts.faintCount())) === faint0 + 1, "F10 を見ても戻った記憶が増えない");
    console.log("  麦の街道：西の口（063 と行き来）・捨てた荷・薄い思念 F10", lap());

    // ===== 2. 関所の門：札が無いと開かない → 骨の握った札 → 門を開けて関所の塔へ =====
    await go(ROAD, 48, 9, 8);
    const shut = (await talk()).join("\n");
    check(shut.includes("札を示せ") && !(await sw(SW.gate)), "札の無いうちに関所の門が開く " + JSON.stringify(shut));
    check(!(await step(8)), "札の無いうちに門を通り抜けた");
    await go(ROAD, 38, 29, 8);
    await talk();
    check((await count(ITEM.pass)) === 1, "通行の札を拾えない");
    await go(ROAD, 48, 9, 8);
    await talk(["通行の札を差しこむ"]);
    check(await sw(SW.gate), "札で関所の門が開かない（スイッチ 1053）");
    await game.shot("road-gate-open");
    await step(8);
    await arrive(TOWER, 24, 37);
    console.log("  関所の門：札が無いと開かない → 通行の札 → 門を開けて関所の塔へ", lap());

    // ===== 3. 関所の塔 112：収税吏の帳面 → ボス 関所の収税吏（札で「通せ」）→ 裏の崖道 =====
    await go(TOWER, 42, 21, 8);
    const ledger = (await talk()).join("\n");
    check(ledger.includes("納め、二百三握り。通し、百五十。"), "収税吏の帳面（5-07）" + JSON.stringify(ledger));
    check(!(await sw(SW.taxman)), "収税吏の旗が先に立っている");
    await go(TOWER, 24, 6, 8);
    const before = (await talk()).join("\n");
    check(before.includes("一握りは王のもの"), "収税吏の戦いの前の言葉 " + JSON.stringify(before));
    const elixir0 = await count(ITEM.elixir);
    const fell = (await winBoss(TROOP.taxman, STATE.letPass)).join("\n");
    check(fell.includes("……通せ。") && (await sw(SW.taxman)) && (await count(ITEM.elixir)) === elixir0 + 1, "収税吏を倒した後（スイッチ 1051・秘薬） " + JSON.stringify(fell));
    await game.shot("tower-after");
    await go(TOWER, 24, 3, 8);
    await step(8);
    await arrive(CLOISTER, 9, 42);
    await game.shot("cloister-south");
    console.log("  関所の塔：帳面 → 収税吏（通行の札で「通せ」）→ 裏の崖道で修道院へ", lap());

    // ===== 4. 修道院 120：嘆願書の束・当番表 → 写本室 121 のテオ（足場の木） =====
    await go(CLOISTER, 13, 36, 8);
    await talk();
    check((await count(ITEM.petitions)) === 1, "嘆願書の束を拾えない");
    await go(CLOISTER, 47, 10, 8);
    const duty = (await talk()).join("\n");
    check(duty.includes("頂、二。") && duty.includes("同じ日付で止まっている"), "鐘守の当番表（5-14）" + JSON.stringify(duty));
    await go(SCRIPTORIUM, 9, 19, 8);
    const teo = (await talk()).join("\n");
    check(teo.includes("足場の木が積んであるんです") && (await vr(VAR.scaffold)) === 1 && (await sw(SW.teo)), "テオの頼み（変数 176 = 1） " + JSON.stringify(teo).slice(0, 300));
    const errand1 = await game.eval(() => Hai.Notes.errand("scaffold"));
    check(errand1 && errand1.title === "足場の木" && errand1.who === "テオ" && Number(errand1.stage) === 1, "頼みごとの一覧に足場の木 " + JSON.stringify(errand1));
    await game.shot("scriptorium-teo");
    console.log("  修道院：嘆願書の束・当番表 → 写本室のテオ（頼みごと「足場の木」）", lap());

    // ===== 5. 地下の工房 123 で木を背負う → 麦の村 111 のソレンヌに渡す =====
    await go(CRYPT, 29, 18, 8);
    const wood = (await talk(["一束、背負って運ぶ"])).join("\n");
    check(wood.includes("頂へ。三晩分") && (await count(ITEM.timber)) === 1 && (await vr(VAR.scaffold)) === 2, "足場の木を背負う（変数 176 = 2） " + JSON.stringify(wood));
    await game.shot("crypt-workshop");
    await go(VILLAGE, 17, 15, 8);
    // W16（場面表 2-13）：ノラがいれば、村に入った最初の一回だけノラの一言（自動実行）
    if (await game.eval(() => $gameParty.members().some(a => a.actorId() === 6))) {
      const nora = (await talk([], false)).join("\n");
      check(nora.includes("麦、立ってる！"), "麦の村に入ったときのノラの一言 " + JSON.stringify(nora));
    }
    const sorenne = (await talk(["足場の木を渡す"])).join("\n");
    check(sorenne.includes("かたじけない") && (await sw(SW.timberDelivered)) && (await count(ITEM.timber)) === 0, "ソレンヌに足場の木を渡す（スイッチ 1055） " + JSON.stringify(sorenne));
    const errand2 = await game.eval(() => Hai.Notes.errand("scaffold"));
    check(errand2 && errand2.result === "done", "頼みごと「足場の木」が終わらない " + JSON.stringify(errand2));
    await game.shot("village-sorenne");
    console.log("  地下の工房で足場の木を背負い、麦の村のソレンヌに渡す（頼みごとが終わる）", lap());

    // ===== 6. 鐘守の塔 122：ボス 院長（嘆願書で「西の飢え」）→ 裏門の鍵 =====
    check(!(await sw(SW.backGate)), "院長の前に裏門の鍵がある");
    await go(CLOISTER, 56, 14, 6);
    check((await talk()).join("").includes("閂に錠が掛かっている"), "院長の前に裏門が開いている");
    await go(BELFRY, 19, 8, 8);
    const prayer = (await talk()).join("\n");
    check(prayer.includes("東へ、東へ"), "院長の戦いの前の言葉 " + JSON.stringify(prayer));
    const knelt = (await winBoss(TROOP.abbot, STATE.westHunger)).join("\n");
    check(knelt.includes("西の、……飢えは。") && (await sw(SW.abbot)) && (await sw(SW.backGate)), "院長を倒した後（スイッチ 1052・1054） " + JSON.stringify(knelt));
    await game.shot("belfry-after");
    console.log("  鐘守の塔：院長（嘆願書の束で「西の飢え」）→ 裏門の鍵", lap());

    // ===== 7. 裏門 → 裏の坂 124 → 記録院・前庭 080 =====
    await go(CLOISTER, 56, 14, 6);
    for (let i = 0; i < 3; i++) await step(6);
    await arrive(SLOPE, 1, 4);
    await game.shot("slope");
    await go(SLOPE, 21, 1, 8);
    await step(8);
    await arrive(COURT, 20, 27);
    console.log("  裏門 → 裏の坂 → 記録院・前庭", lap());

    // ===== 8. データの検査 =====
    const problems = checkAll();
    check(problems.length === 0, "データの検査で問題 " + JSON.stringify(problems.slice(0, 5)));
    game.assertNoErrors();
    console.log("  地域五の通し：OK", lap());
  } finally {
    await game.close();
  }
});
