// W9（#157）地域三・地下水道と地下都市（docs/world.md 5.1・5.2・5.5・6.4・7.2・8.1・8.3、tools/maps/src/w9_*）の通しの検査：
//   営倉の牢番の詰め所 035 の西の扉（牢番の鍵束）→ 地下水道・上流 100：アンセルモの記憶 1・王の布告（手がかり）・舫いの杭（櫂）で南の洞の赤い宝箱・沈んだ戸口
//   → 水門 101：上流の弁だけでは水が引かない → 下流の弁で引く（スイッチ 505）・アンセルモの記憶 2・廃水の管（H35）で鋳物場 091 と行き来 → 沈んでいた南の廊下
//   → 閉じた扉の前 102（角灯で暗がりが半径 5）：アンセルモの遺骸と記憶 4（完全体）・記憶 3・騎士長の日誌・弔いの名簿・扉の番の手がかり
//   → 扉の番 103：王の布告を見せると戦いの頭に「迷い」・倒すとスイッチ 504・衛兵の兜 → 水底の鐘 104：鳴らす（スイッチ 103・変数 101 に 1、4 つ目ならスイッチ 105・当番の札）
//   → 井戸の縦穴 105：村の長（頼み「扉の外の歌」→ 弔いの名簿を見せると大扉の閂、スイッチ 510）・大扉の内側 → 102
//   → 井戸の綱（スイッチ 508）で砦 010 の井戸へ上り、井戸から下りる → 薄い思念 F09 → 梯子の上の格子（スイッチ 509）→ 営倉の井戸の底への通路 037 → 下りる
//   → データの検査が通る。
import { launchGame, check, runTest } from "./lib.mjs";
import { checkAll } from "../tools/data/check.mjs";
import { POINTS, drawAll } from "../tools/maps/src/w9_maps.mjs";

drawAll();
const S0 = POINTS.sewerUpper, S1 = POINTS.sluice, G2 = POINTS.gateFront, G3 = POINTS.gateKeeper, B4 = POINTS.bellDeep, WL = POINTS.well;
const FOUNDRY = 91, FORT = 10, WARDEN_POST = 35, PASSAGE = 37, SEWER = 100, SLUICE = 101, GATE = 102, WARDEN_ROOM = 103, BELL = 104, WELL = 105;
const ITEM = { keyRing: 321, lantern: 322, oar: 501, decree: 503, journal: 504, dutyTag: 505, dirge: 508 };
const ARMOR = { helm: 503 };
const WEAPON = { censer: 502 };
const SW = { pipe: 517, westDoor: 308, drained: 505, valveUp: 506, valveDown: 507, rope: 508, grate: 509, gateOpened: 510, wardenWavers: 515, doorWarden: 504, anselmoFound: 135, bellWater: 103, bellsAll: 105 };
const VAR = { songTask: 501, bellCount: 101 };
const WARDEN_TROOP = 512, WAVER = 501;
const ANSELMO = 9;
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
      try {
        await game.holdOkToMap();
      } finally {
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

    // ===== 1. 営倉の西の扉（鍵束）→ 地下水道・上流 100 =====
    await gain("i", ITEM.keyRing);
    const door = await look(WARDEN_POST, 3, 8, 4);
    check(door.includes("鍵の束の一本が合った") && (await sw(SW.westDoor)), "035 の西の扉が鍵束で開かない " + JSON.stringify(door));
    await game.call("step", 4);
    await arrive(SEWER, S0.arriveStairs[0], S0.arriveStairs[1]);
    const sewerInfo = await game.eval(() => ({ w: $dataMap.width, h: $dataMap.height, name: $gameMap.displayName(), tileset: $gameMap.tilesetId(), dark: Hai.MapTone.dark() }));
    check(sewerInfo.w === 52 && sewerInfo.h === 38 && sewerInfo.tileset === 18 && sewerInfo.dark && sewerInfo.dark.radius === 5, "地下水道・上流 " + JSON.stringify(sewerInfo));
    await game.shot("sewer-arrive");
    console.log("  営倉の西の扉（鍵束。スイッチ 308）→ 地下水道・上流");

    // ===== 2. 上流：アンセルモの記憶 1・王の布告・舫いの杭・沈んだ戸口 =====
    check((await look(SEWER, S0.anselmo1[0], S0.anselmo1[1] + 1, 8)).includes("しゃっくり"), "アンセルモの記憶 1");
    await look(SEWER, S0.decree[0], S0.decree[1] + 1, 8);
    check((await items("i", ITEM.decree)) === 1 && (await game.eval(() => Hai.Thoughts.hasNote("clue:decree"))), "王の布告と手がかり");
    const moor0 = await look(SEWER, S0.mooring[0] - 1, S0.mooring[1], 6);
    check(moor0.includes("漕ぐ物が無い"), "櫂が無いのに小舟で下れる");
    await gain("i", ITEM.oar);
    await talk(["小舟で下る"]);
    await arrive(SEWER, S0.landing[0], S0.landing[1]);
    await look(SEWER, S0.grottoChest[0] - 1, S0.grottoChest[1], 6);
    check((await items("w", WEAPON.censer)) === 1, "南の洞の赤い宝箱で鎖の香炉が手に入らない");
    await look(SEWER, S0.grottoBack[0] - 1, S0.grottoBack[1], 6, ["小舟で戻る"]);
    await arrive(SEWER, S0.mooring[0] - 1, S0.mooring[1]);
    const [fx, fy] = S0.flood[0];
    check((await look(SEWER, fx, fy - 1, 2)).includes("胸まで"), "水門番の小屋の戸口が沈んでいない");
    console.log("  上流：アンセルモの記憶 1・王の布告（手がかり）・舫いの杭（櫂）で南の洞の赤い宝箱・沈んだ戸口");

    // ===== 3. 水門 101：弁を両方回す・アンセルモの記憶 2 =====
    await go(SEWER, S0.arriveE[0], S0.arriveE[1], 6);
    await step(6);
    await arrive(SLUICE, S1.arriveW[0], S1.arriveW[1]);
    await game.shot("sluice-arrive");
    const up = await look(SLUICE, S1.valveUp[0], S1.valveUp[1] + 1, 8, ["回す"]);
    check(up.includes("水が唸っている") && (await sw(SW.valveUp)) && !(await sw(SW.drained)), "上流の弁だけで水が引いた " + JSON.stringify(up));
    const down = await look(SLUICE, S1.valveDown[0], S1.valveDown[1] + 1, 8, ["回す"]);
    check(down.includes("水が、低い音") && (await sw(SW.drained)), "下流の弁で水が引かない（スイッチ 505） " + JSON.stringify(down));
    check((await look(SLUICE, S1.anselmo2[0], S1.anselmo2[1] + 1, 8)).includes("最初の日のほかは"), "アンセルモの記憶 2");
    // H35：廃水の管の口の閂を外し、鋳物場 091 と行き来する
    await look(SLUICE, S1.arrivePipe[0], S1.arrivePipe[1], 6, ["閂を外す"]);
    check(await sw(SW.pipe), "廃水の管の格子の閂（スイッチ 517）");
    await talk(["管をくぐる"]);
    await arrive(FOUNDRY, 52, 37);
    await look(FOUNDRY, 52, 37, 2, ["管をくぐる"]);
    await arrive(SLUICE, S1.arrivePipe[0], S1.arrivePipe[1]);
    await go(SLUICE, S1.exitS[0], S1.flood[0][1] - 1, 2);
    while ((await pos()).y < S1.exitS[1]) check(await step(2), `水の引いた南の廊下を通れない ${JSON.stringify(await pos())}`);
    await arrive(GATE, G2.arriveN[0], G2.arriveN[1]);
    console.log("  水門：上流の弁だけでは引かない → 下流の弁で引く（スイッチ 505）・アンセルモの記憶 2 → 南の廊下");

    // ===== 4. 閉じた扉の前 102（暗がり）=====
    const dark0 = await game.eval(() => Hai.MapTone.dark());
    check(dark0 && dark0.radius === 1.5, "閉じた扉の前の暗がり " + JSON.stringify(dark0));
    await gain("i", ITEM.lantern);
    await go(SLUICE, S1.arriveS[0], S1.arriveS[1], 2);
    await step(2);
    await arrive(GATE, G2.arriveN[0], G2.arriveN[1]);
    await game.frames(10);
    const dark1 = await game.eval(() => Hai.MapTone.dark());
    check(dark1 && dark1.radius === 5, "角灯を持って入っても暗がりが広がらない " + JSON.stringify(dark1));
    await game.shot("gate-front");
    const ans = await look(GATE, G2.anselmo[0], G2.anselmo[1] - 1, 2);
    check(ans.includes("続きを歌っといてくれ") && ans.includes("名の壁の輪に置けば、この人を呼べる。"), "アンセルモの遺骸と記憶 4 " + JSON.stringify(ans));
    check((await look(GATE, G2.anselmo3[0] - 1, G2.anselmo3[1], 6)).includes("首に掛けてやった"), "アンセルモの記憶 3");
    const a = await game.eval(([s, id]) => ({ found: $gameSwitches.value(s), mem: Hai.Companions.memories(id) }), [SW.anselmoFound, ANSELMO]);
    check(a.found && a.mem.join() === "1,2,3,4", "アンセルモの遺骸（スイッチ 135）と記憶 4 つ " + JSON.stringify(a));
    await look(GATE, G2.journal[0], G2.journal[1] + 1, 8);
    check((await items("i", ITEM.journal)) === 1, "騎士長の日誌が手に入らない");
    await look(GATE, G2.listRoll[0] + 1, G2.listRoll[1], 4);
    check((await items("i", ITEM.dirge)) === 1, "弔いの名簿が手に入らない");
    check((await look(GATE, G2.r323[0], G2.r323[1] - 1, 2)).includes("槍の先が下がっている"), "R3-22（扉の番の手がかり）");
    check((await look(GATE, G2.gate[0], G2.gate[1] - 1, 2)).includes("爪の跡で白く"), "閉じた大扉");
    console.log("  閉じた扉の前：角灯で半径 5・アンセルモの遺骸と記憶 3・4・騎士長の日誌・弔いの名簿・番の手がかり");

    // ===== 5. 扉の番 103（王の布告で迷う）→ 水底の鐘 104 =====
    await go(GATE, G2.arriveE[0], G2.arriveE[1], 6);
    await step(6);
    await arrive(WARDEN_ROOM, G3.arriveW[0], G3.arriveW[1]);
    await go(WARDEN_ROOM, G3.boss[0], G3.boss[1] + 1, 8);
    await startFight("扉の番");
    const fight = await game.eval(([t, s, st]) => ({ troop: $gameTroop.troop().id, wavers: $gameSwitches.value(s), state: $gameTroop.members()[0].isStateAffected(st) }), [WARDEN_TROOP, SW.wardenWavers, WAVER]);
    check(fight.troop === WARDEN_TROOP && fight.wavers && fight.state, "王の布告を見た扉の番が迷わない " + JSON.stringify(fight));
    await game.shot("warden-battle");
    await winFight();
    const won = await game.eval(([s, h]) => ({ sw: $gameSwitches.value(s), helm: $gameParty.numItems($dataArmors[h]) }), [SW.doorWarden, ARMOR.helm]);
    check(won.sw && won.helm === 1, "扉の番を倒した後の旗と衛兵の兜 " + JSON.stringify(won));
    await go(WARDEN_ROOM, G3.door[0], G3.door[1] + 1, 8);
    await step(8);
    await arrive(BELL, B4.arriveS[0], B4.arriveS[1]);
    await game.shot("bell-deep");
    await game.eval(id => { $gameVariables.setValue(id, 3); $gameSwitches.setValue(106, true); }, VAR.bellCount); // 3 つ目の場面（スイッチ 106。W11）は済んだ扱い
    // W32（#331）：札掛けは、札を得る前もあとも「壁の札掛け。鐘番の当番の札を掛けておく所だ。」の一行だけ（036・084・094 と同じ）
    const board0 = await look(BELL, B4.board[0], B4.board[1] + 1, 8);
    check(board0.includes("壁の札掛け。鐘番の当番の札を掛けておく所だ。") && !board0.includes("札は一枚。") && !board0.includes("釘は四本"), "札を得る前の札掛け " + JSON.stringify(board0));
    const ring = await look(BELL, B4.rope[0], B4.rope[1] + 1, 8, ["綱を引く"]);
    const bell = await game.eval(([a, b, c, t]) => ({ rung: $gameSwitches.value(a), count: $gameVariables.value(b), all: $gameSwitches.value(c), tag: $gameParty.numItems($dataItems[t]) }), [SW.bellWater, VAR.bellCount, SW.bellsAll, ITEM.dutyTag]);
    check(ring.includes("輪が幾重にも") && bell.rung && bell.count === 4 && bell.all && bell.tag === 1, "水底の鐘（スイッチ 103・変数 101・4 つ目でスイッチ 105・当番の札） " + JSON.stringify(bell));
    const board1 = await look(BELL, B4.board[0], B4.board[1] + 1, 8);
    check(board1.includes("壁の札掛け。鐘番の当番の札を掛けておく所だ。") && !board1.includes("札は一枚。"), "札を得たあとの札掛け " + JSON.stringify(board1));
    const note = await game.eval(id => $dataMap.events.find(e => e && e.name === "水底の鐘の綱").pages[0].list.some(c => c.code === 108 && c.parameters[0].startsWith("W11")), 0);
    check(note, "鐘の綱に W11 への注釈が無い");
    console.log("  扉の番（布告で迷う・スイッチ 504・衛兵の兜）→ 水底の鐘（スイッチ 103・変数 101 = 4・スイッチ 105・当番の札）");

    // ===== 6. 井戸の縦穴 105：村の長・大扉・井戸の綱・F09・格子 =====
    await go(SLUICE, S1.arriveN[0], S1.arriveN[1], 8);
    await step(8);
    await arrive(WELL, WL.arriveS[0], WL.arriveS[1]);
    await game.shot("well-village");
    const elder1 = await look(WELL, WL.elder[0], WL.elder[1] + 1, 8);
    check(elder1.includes("扉の外で夜ごとに歌") && (await vr(VAR.songTask)) === 1, "村の長の頼み " + JSON.stringify(elder1));
    check(elder1.split("ただのう。").length === 2 && elder1.includes("それにのう。言い伝えに"), "村の長の続く頁が両方「ただのう。」で始まる（R2 気になる 15） " + JSON.stringify(elder1));
    // W20（#264。P16 #256 の気づき）：見せないと変数 501 は 3（見せなかった）のまま。頼みごとの段も 3
    const elderNo = await look(WELL, WL.elder[0], WL.elder[1] + 1, 8, ["見せない"]);
    const no = await game.eval(id => ({ v: $gameVariables.value(id), e: Hai.Notes.errand("doorSong") }), VAR.songTask);
    check(elderNo.includes("まあ、ええ") && no.v === 3 && no.e && no.e.stage === 3 && !(await sw(SW.gateOpened)), "名簿を見せない（変数 501 = 3・段 3） " + JSON.stringify(no));
    check(!(await look(WELL, WL.elder[0], WL.elder[1] + 1, 8)).includes("閂は外したまま"), "見せなかったのに、長が「閂は外したまま」と言う");
    await game.eval(id => $gameVariables.setValue(id, 1), VAR.songTask); // 見せる道も見るため、頼まれた段に戻す
    const elder2 = await look(WELL, WL.elder[0], WL.elder[1] + 1, 8, ["名簿を見せる"]);
    check(elder2.includes("閂を外そう") && (await sw(SW.gateOpened)) && (await vr(VAR.songTask)) === 2 && (await items("i", ITEM.dirge)) === 0, "名簿を見せて大扉の閂（スイッチ 510） " + JSON.stringify(elder2));
    await look(WELL, WL.gateInner[0], WL.gateInner[1] - 1, 2);
    await arrive(GATE, G2.gateFront[0], G2.gateFront[1]);
    await look(GATE, G2.gate[0], G2.gate[1] - 1, 2);
    await arrive(WELL, WL.arriveGate[0], WL.arriveGate[1]);
    console.log("  村の長：頼み「扉の外の歌」→ 弔いの名簿で大扉の閂（スイッチ 510）→ 102 と行き来");
    await look(WELL, WL.rope[0], WL.rope[1] + 1, 8, ["綱を引き下ろす"]);
    check(await sw(SW.rope), "井戸の綱が下りない（スイッチ 508）");
    await talk(["綱を上る"]);
    await arrive(FORT, 29, 20);
    await game.shot("fort-well");
    await look(FORT, 29, 20, 8, ["綱を下りる"]);
    await arrive(WELL, WL.arriveRope[0], WL.arriveRope[1]);
    const f09 = await look(WELL, WL.faint[0], WL.faint[1] + 1, 8);
    check(f09.includes("墓守は袖をまくって、また綱を引いた。") && !f09.includes("一から数えはじめる") && (await game.eval(() => Hai.Thoughts.isFaint("F09"))), "薄い思念 F09 " + JSON.stringify(f09));
    await look(WELL, WL.grate[0], WL.grate[1] + 1, 8, ["閂を外す"]);
    check(await sw(SW.grate), "格子の閂（スイッチ 509）");
    await talk(["格子を上る"]);
    await arrive(PASSAGE, 5, 11);
    await look(PASSAGE, 5, 11, 2, ["下りる"]);
    await arrive(WELL, WL.arriveGrate[0], WL.arriveGrate[1]);
    console.log("  井戸の綱で砦 010 と行き来（スイッチ 508）・F09・格子で営倉 037 と行き来（スイッチ 509）");

    // ===== 7. データの検査 =====
    const problems = checkAll();
    check(problems.length === 0, "データの検査で問題 " + JSON.stringify(problems.slice(0, 5)));
    game.assertNoErrors();
  } finally {
    await game.close();
  }
});
