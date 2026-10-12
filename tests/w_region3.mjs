// W9（#157）地域三・霧の湖（docs/world.md 5.1・5.2・5.5・6.4・6.8・7.3、tools/maps/src/w9_*）の通しの検査：
//   焼けた村の広場 061 の水路の小道 → 霧の湖・葦原 070：道標・R3-01・霧の壁（小鐘が無いと戻される → 鳴らすと引く。スイッチ 501）
//   → 舟小屋：ゼリナの記憶 2・方舟の乗船名簿、舟着き：ゼリナの記憶 3、舟着きの杭（櫂が無いと「漕ぐ物が無い」）
//   → 南西の板の道 → 湖の家 071：ミルレーネ（スイッチ 107・511、取り決めの歌の手がかり）・湖の灯の帳面・ゼリナの記憶 1・葦刈りの思念（沼主の弱みの手がかり）
//   → 沈んだ桟橋 072：ゼリナの遺骸と記憶 4（完全体）・櫂（スイッチ 502）・隠し扉の奥のつけ帳
//   → 070 の舟着きから「自分で漕ぐ」で小型船に乗る → 小島の岸で降りる → 小島 074：外に残された者の思念・森の水門を開ける（スイッチ 512）・見えない通路の先の赤い宝箱
//   → ミルレーネに伝える（スイッチ 514）→ 舟で向こう岸へ（R3-04）
//   → 湖の淵 073：沼主（倒すとスイッチ 503・沼主の鱗）→ 淵の底の排水口 → 地下水道・上流 100 → データの検査が通る。
// 地下水道から先は w_region3b。シンボル敵はマップに入るたびに「倒した」ことにする（セルフスイッチ A）。
import { launchGame, check, runTest } from "./lib.mjs";
import { checkAll } from "../tools/data/check.mjs";
import { POINTS, drawAll } from "../tools/maps/src/w9_maps.mjs";

drawAll();
const L = POINTS.lake, H = POINTS.house, PI = POINTS.pier, PO = POINTS.pool, IS = POINTS.isle, S0 = POINTS.sewerUpper;
const SQUARE = 61, LAKE = 70, HOUSE = 71, PIER = 72, POOL = 73, ISLE = 74, SEWER = 100;
const ITEM = { oar: 501, lampLedger: 502, tab: 506, arkList: 507 };
const ARMOR = { smallBell: 321, scale: 502 };
const WEAPON = { gateBow: 501 };
const SW = { fogPath: 501, oar: 502, marshLord: 503, askedOutsiders: 511, waterGateOpen: 512, toldMirlene: 514, metMirlene: 107, zelinaFound: 134 };
const LORD_TROOP = 511;
const ZELINA = 8;
const FAST = 16;

await runTest(async () => {
  const game = await launchGame();
  try {
    await game.call("newGame");
    await game.waitScene("Scene_Map");
    await game.call("setSpeed", 2);
    const pos = () => game.call("pos");
    const sw = id => game.eval(i => $gameSwitches.value(i), id);
    const vr = id => game.eval(i => $gameVariables.value(i), id);
    const items = (kind, id) => game.eval(([k, i]) => $gameParty.numItems((k === "a" ? $dataArmors : k === "w" ? $dataWeapons : $dataItems)[i]), [kind, id]);
    const gain = (kind, id, n = 1) => game.eval(([k, i, c]) => $gameParty.gainItem((k === "a" ? $dataArmors : k === "w" ? $dataWeapons : $dataItems)[i], c), [kind, id, n]);

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
    /** 決定キーで調べ、イベントが終わるまで文章を読み進める。選択肢は choices の順に選ぶ。 */
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
          pages.push(st.text);
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
      return pages;
    }
    /** (x, y) に d を向いて立ち、決定キーで調べる。 */
    async function look(m, x, y, d, choices = []) {
      await go(m, x, y, d);
      return (await talk(choices)).join("\n");
    }
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
    // 戦闘
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
    /** 決定キーでボスに話しかけ、戦闘の画面まで読み進める。 */
    const startFight = async what => {
      await game.press("Enter");
      const t0 = Date.now();
      while ((await game.call("scene")) !== "Scene_Battle") {
        if (await game.eval(() => $gameMessage.isBusy())) { await game.frames(12); await game.press("Enter"); } else await game.frames(2);
        check(Date.now() - t0 < 60_000, `${what}に話しかけても戦闘にならない`);
      }
      await waitInput();
    };
    /** 弱くして倒す。 */
    const winFight = async () => {
      await game.call("strengthenParty");
      await game.eval(() => $gameTroop.members().forEach(e => e.setHp(1)));
      for (let i = 0; i < 3 && (await game.eval(() => SceneManager._scene instanceof Scene_Battle && !$gameTroop.isAllDead())); i++) await turn(["attack", "attack", "attack", "attack"]);
      await toMap();
      await finishEvent();
    };

    // ===== 1. 焼けた村の広場 → 霧の湖・葦原 070 =====
    await go(SQUARE, 38, 32, 2); // W8（#155）の広場の水路の石段 (38,33) の手前
    await step(2);
    await arrive(LAKE, L.entry[0], L.entry[1]);
    const lakeInfo = await game.eval(() => ({ w: $dataMap.width, h: $dataMap.height, fog: Hai.MapTone.fog(), name: $gameMap.displayName(), tileset: $gameMap.tilesetId() }));
    check(lakeInfo.w === 80 && lakeInfo.h === 60 && lakeInfo.fog && lakeInfo.fog.density === 150 && lakeInfo.name === "霧の湖" && lakeInfo.tileset === 15, "霧の湖の大きさ・霧 " + JSON.stringify(lakeInfo));
    await game.shot("lake-arrive");
    check((await look(LAKE, L.sign[0], L.sign[1] + 1, 8)).includes("灯を見て歩け"), "道標の文章");
    check((await look(LAKE, L.r301[0], L.r301[1] + 1, 8)).includes("四十枚"), "R3-01 の本文");
    check((await look(LAKE, L.notice[0], L.notice[1] + 1, 8)).includes("その母を"), "方舟の触れ書き");
    // 霧の壁：小鐘が無いと戻される → 鳴らすと引く
    const [fx, fy] = L.fogWall[0];
    const pushed = await look(LAKE, fx - 1, fy, 6);
    check(pushed.includes("足が勝手に戻って"), "小鐘が無いのに霧の壁を抜けられる " + JSON.stringify(pushed));
    check(!(await step(6)), "小鐘が無いのに霧の壁を通れる");
    await gain("a", ARMOR.smallBell);
    const rung = (await talk(["小鐘を鳴らす"])).join("\n");
    check(rung.includes("湖の方へ離れて") && (await sw(SW.fogPath)), "小鐘で霧の壁が引かない（スイッチ 501） " + JSON.stringify(rung));
    for (let i = 0; i < 4; i++) check(await step(6), `霧の道を抜けられない ${JSON.stringify(await pos())}`);
    await game.shot("lake-fog-path");
    console.log("  葦原：道標・R3-01・触れ書き・霧の壁（小鐘で引く。スイッチ 501）");

    // ===== 2. 舟小屋と舟着き：ゼリナの記憶 2・3、乗船名簿、舟着きの杭（櫂なし） =====
    check((await look(LAKE, L.zelina2[0], L.zelina2[1] + 1, 8)).includes("三年で舟が一艘"), "ゼリナの記憶 2");
    await look(LAKE, L.ledgerArk[0], L.ledgerArk[1] + 1, 8);
    check((await items("i", ITEM.arkList)) === 1, "方舟の乗船名簿が手に入らない");
    check((await look(LAKE, L.zelina3[0], L.zelina3[1] + 1, 8)).includes("二十六"), "ゼリナの記憶 3");
    check((await look(LAKE, L.r302[0], L.r302[1] + 1, 8)).includes("袖を引いた"), "R3-02");
    const stand = [L.dockBoat[0], L.dockBoat[1] - 1];
    check((await look(LAKE, stand[0], stand[1], 2)).includes("漕ぐ物が無い"), "櫂が無いのに舟を出せる");
    check((await game.eval(() => Hai.Companions.memories(8))).join() === "2,3", "ゼリナの記憶 2・3 が数えられない");
    console.log("  舟小屋：ゼリナの記憶 2・3・乗船名簿・舟着きの杭（漕ぐ物が無い）");

    // ===== 3. 湖の家 071：ミルレーネ・灯の帳面・ゼリナの記憶 1・葦刈りの思念 =====
    await go(LAKE, L.arriveS[0], L.arriveS[1], 2);
    await step(2);
    await arrive(HOUSE, H.arriveN[0], H.arriveN[1]);
    await game.shot("house-arrive");
    const mir = await look(HOUSE, H.mirlene[0] + 1, H.mirlene[1], 4);
    check(mir.includes("わたしはミルレーネ") && mir.includes("森の水門"), "ミルレーネの初めての話 " + JSON.stringify(mir));
    check((await sw(SW.metMirlene)) && (await sw(SW.askedOutsiders)), "ミルレーネに会った旗（107・511）");
    const song = (await talk(["歌を聞く"])).join("\n");
    check(song.includes("戸を内より") && (await game.eval(() => Hai.Thoughts.hasNote("song:mirlene"))), "取り決めの歌とメモ " + JSON.stringify(song));
    await look(HOUSE, H.ledger[0], H.ledger[1] + 1, 8);
    check((await items("i", ITEM.lampLedger)) === 1, "湖の灯の帳面が手に入らない");
    check((await look(HOUSE, H.zelina1[0] + 1, H.zelina1[1], 4)).includes("ただの石"), "ゼリナの記憶 1");
    const reed = await look(HOUSE, H.r306[0], H.r306[1] - 1, 2);
    check(reed.includes("焦げた刈り跡") && (await game.eval(() => Hai.Thoughts.notes("clue").some(n => n.text.includes("焦げた葦")))), "葦刈りの思念と手がかり " + JSON.stringify(reed));
    console.log("  湖の家：ミルレーネ（スイッチ 107・511）・取り決めの歌・灯の帳面・ゼリナの記憶 1・葦刈りの手がかり");

    // ===== 4. 沈んだ桟橋 072：ゼリナの遺骸・櫂・隠し扉のつけ帳 =====
    await go(HOUSE, H.arriveSE[0], H.arriveSE[1], 2);
    await step(2);
    await arrive(PIER, PI.arrive[0], PI.arrive[1]);
    await game.shot("pier-arrive");
    const remains = await look(PIER, PI.remains[0], PI.remains[1] - 1, 2);
    check(remains.includes("最初から数えよか") && remains.includes("名の壁の輪に置けば、この人を呼べる。"), "ゼリナの遺骸と記憶 4 " + JSON.stringify(remains));
    const z = await game.eval(([s, a]) => ({ found: $gameSwitches.value(s), mem: Hai.Companions.memories(a), complete: Hai.Companions.isComplete(a) }), [SW.zelinaFound, ZELINA]);
    check(z.found && z.complete, "ゼリナの遺骸（スイッチ 134）と完全体 " + JSON.stringify(z));
    await look(PIER, PI.oar[0], PI.oar[1] - 1, 2);
    check((await items("i", ITEM.oar)) === 1 && (await sw(SW.oar)), "櫂が手に入らない（スイッチ 502）");
    check((await look(PIER, PI.r307[0], PI.r307[1] + 1, 8)).includes("壁の中に隠した"), "R3-07");
    await go(PIER, PI.hidden[0], PI.hidden[1] + 1, 8);
    await game.press("Enter");
    await finishEvent();
    check(await step(8), "舟小屋の隠し扉が開かない");
    await step(8);
    await look(PIER, PI.ledgerTab[0] - 1, PI.ledgerTab[1], 6);
    check((await items("i", ITEM.tab)) === 1, "隠し扉の奥で酒保のつけ帳が手に入らない");
    console.log("  沈んだ桟橋：ゼリナの遺骸（完全体）・櫂（スイッチ 502）・隠し扉の奥のつけ帳");

    // ===== 5. 舟：舟着きから自分で漕ぐ → 小島の岸で降りる → 小島 074 =====
    await go(LAKE, stand[0], stand[1], 2);
    await talk(["自分で漕ぐ"]);
    await game.waitFor(() => $gamePlayer.isInBoat() && !$gamePlayer.isMoving() && !window.__game.isBusy());
    check(await game.eval(() => $gamePlayer.isInBoat() && $gameMap.boat().x === $gamePlayer.x), "舟に乗れない");
    await game.shot("lake-boat");
    // 湖の上を漕ぐ（水だけを通って小島の岸の手前まで）。舟は小型船の通行で動く
    const path = await game.eval(([tx, ty]) => {
      const start = [$gamePlayer.x, $gamePlayer.y];
      const prev = new Map([[start.join(), null]]);
      const q = [start];
      while (q.length) {
        const [x, y] = q.shift();
        if (x === tx && y === ty) break;
        for (const d of [2, 4, 6, 8]) {
          const nx = $gameMap.roundXWithDirection(x, d), ny = $gameMap.roundYWithDirection(y, d);
          if (prev.has(nx + "," + ny) || !$gameMap.isBoatPassable(nx, ny)) continue;
          prev.set(nx + "," + ny, [x, y, d]);
          q.push([nx, ny]);
        }
      }
      const dirs = [];
      for (let k = tx + "," + ty; prev.get(k); ) { const [x, y, d] = prev.get(k); dirs.unshift(d); k = x + "," + y; }
      return dirs;
    }, L.isleBoat);
    check(path.length > 10, "舟着きから小島の岸まで水の上を行けない " + path.length);
    for (const d of path) check(await step(d), "舟が進まない " + JSON.stringify(await pos()));
    await game.eval(() => $gamePlayer.setDirection(8));
    await game.press("Enter");
    await game.waitFor(() => !$gamePlayer.isInVehicle() && !$gamePlayer.isMoving());
    check((await pos()).x === L.isleBoat[0] && (await pos()).y === L.isleBoat[1] - 1, "小島の岸で舟から降りられない " + JSON.stringify(await pos()));
    await go(LAKE, L.isleGate[0], L.isleGate[1] + 1, 8);
    await step(8);
    await arrive(ISLE, IS.arrive[0], IS.arrive[1]);
    await game.shot("isle-arrive");
    check((await look(ISLE, IS.elf1[0], IS.elf1[1] + 1, 8)).includes("三晩"), "R3-09");
    check((await look(ISLE, IS.elf2[0], IS.elf2[1] + 1, 8)).includes("人には告げるな"), "R3-10");
    const gate = await look(ISLE, IS.gate[0], IS.gate[1] + 1, 8, ["根を外して門を開ける"]);
    check(gate.includes("内へ半分だけ開いた") && (await sw(SW.waterGateOpen)), "森の水門を開ける（スイッチ 512） " + JSON.stringify(gate));
    // 茂みの見えない通路の先の赤い宝箱
    await go(ISLE, IS.hint[0], IS.hint[1], 6);
    for (let i = 0; i < 4; i++) check(await step(6), `茂みの見えない通路を通れない ${JSON.stringify(await pos())}`);
    await go(ISLE, IS.redChest[0] - 1, IS.redChest[1], 6);
    await talk();
    check((await items("w", WEAPON.gateBow)) === 1, "赤い宝箱で水門守の弓が手に入らない");
    console.log("  舟で小島へ：外に残された者の思念・森の水門を開ける（スイッチ 512）・赤い宝箱");

    // ===== 6. ミルレーネに伝える・舟着きの杭から向こう岸へ =====
    const told = await look(HOUSE, H.mirlene[0] + 1, H.mirlene[1], 4);
    check(told.includes("門が、開いたのね") && (await sw(SW.toldMirlene)), "ミルレーネに水門のことを伝える（スイッチ 514） " + JSON.stringify(told));
    await go(LAKE, L.isleBoat[0], L.isleBoat[1] - 1, 8); // 舟の方を向くと舟に乗ってしまうので、背を向けて杭を調べる
    await talk(["向こう岸へ漕ぐ"]);
    await arrive(LAKE, L.farBoat[0], L.farBoat[1] + 1);
    check((await look(LAKE, L.r304[0] - 1, L.r304[1], 6)).includes("十四"), "向こう岸の R3-04");
    console.log("  ミルレーネに伝える（スイッチ 514）・杭から向こう岸へ（R3-04）");

    // ===== 7. 湖の淵 073：沼主 → 排水口 → 地下水道 100 =====
    await go(HOUSE, H.arriveSW[0], H.arriveSW[1], 2);
    await step(2);
    await arrive(POOL, PO.arrive[0], PO.arrive[1]);
    await game.shot("pool-arrive");
    await go(POOL, PO.shore[0], PO.shore[1], 2);
    await startFight("沼主");
    check(await game.eval(id => $gameTroop.troop().id === id, LORD_TROOP), "沼主の敵グループではない");
    await game.shot("marsh-lord-battle");
    await winFight();
    const won = await game.eval(([s, a]) => ({ sw: $gameSwitches.value(s), scale: $gameParty.numItems($dataArmors[a]), result: Hai.Boss.lastResult() }), [SW.marshLord, ARMOR.scale]);
    check(won.sw && won.scale === 1 && won.result === 0, "沼主を倒した後の旗と沼主の鱗 " + JSON.stringify(won));
    const drain = (await talk(["下りる"])).join("\n");
    check(drain.includes("梯子が下へ"), "淵の底の排水口 " + JSON.stringify(drain));
    await arrive(SEWER, S0.arriveLadder[0], S0.arriveLadder[1]);
    await game.shot("sewer-from-pool");
    console.log("  湖の淵：沼主を倒す（スイッチ 503・沼主の鱗）→ 排水口 → 地下水道・上流");

    // ===== 8. データの検査 =====
    const problems = checkAll();
    check(problems.length === 0, "データの検査で問題 " + JSON.stringify(problems.slice(0, 5)));
    game.assertNoErrors();
  } finally {
    await game.close();
  }
});
