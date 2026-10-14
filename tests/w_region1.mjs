// W7（#145）地域一の本道（docs/world.md 5.1・5.2・5.3、tools/maps/src/w7_*）の検査：
//   ニューゲーム → 砦（010）の外門から霧の森 020 → 道標・R1-01・見張り塔の小鐘・見えない通路（白い花）の先の宝箱 → 北の道で 021
//   → ブルーノの遺骸（記憶 4）・教会の祈祷書・隠し階段 H04 → 納骨所 022（ブルーノの記憶 1）→ 北東の坑口で鉄の坑道 026
//   → アデル（砦へ。稽古場・頼み）・詰め所 029 の鐘番の角灯・巻き上げ機 → 昇降機で下層 027（角灯で暗がりが広がる）→ 掘り抜きで営倉 033
//   → 門番の薄い思念 F02（記憶が戻る一言）・砦への鉄扉の閂 → 廊下 034 のレバーと牢番の帳面 → 牢番 035（倒すと鍵束、北の扉）
//   → 営倉の鐘 036 を鳴らす（スイッチ 101・変数 101・当番の札）→ 鉄扉の近道で砦へ戻る → 鍵束で監房の倉の扉が開く → データの検査が通る。
// シンボル敵は検査の邪魔にならないよう、マップに入るたびに「倒した」ことにする（セルフスイッチ A）。
// 砦（010）の出入口は W6（#144）の座標（下の FORT）。外門への階段 (25,2) → 020 (35,47)、営倉への鉄扉 → 033 (47,42)、戻りは 010 (25,3)・(25,37)。
import { launchGame, check, runTest } from "./lib.mjs";
import { checkAll } from "../tools/data/check.mjs";

const FORT = { map: 10, stairs: { x: 25, y: 2 }, ironArrive: { x: 25, y: 37 } };
const FOREST = 20, CHAPEL = 21, OSSUARY = 22, MINE = 26, DEPTHS = 27, STATION = 29, CELLS = 33, HALL = 34, WARDEN_ROOM = 35, BELL_ROOM = 36;
const ITEM = { keyRing: 321, lantern: 322, dutyTag: 323, prayerBook: 324, wardenLog: 325, elixir: 198 };
const ARMOR = { smallBell: 321 };
const SW = { lift: 303, ironDoor: 305, adele: 307, hallGate: 309, bellFirst: 310, bellRung: 101, ironDoorFort: 114, warden: 151, brunoFound: 131, soulRoom: 121 };
const VAR = { bellCount: 101, survivors: 103, bellIronTask: 301 };
const WARDEN_TROOP = 335;
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
    /** 決定キーで調べ、イベントが終わるまで文章を読み進める。選択肢は choices の順に選ぶ。数値入力は numbers の順に入れる。 */
    async function talk(choices = [], press = true, numbers = []) {
      const queue = choices.slice();
      const nums = numbers.slice();
      if (press) await game.press("Enter");
      await game.waitFor(() => $gameMap.isEventRunning() || $gameMessage.isBusy());
      const pages = [];
      for (;;) {
        await game.waitFor(() => {
          const w = SceneManager._scene._messageWindow;
          const c = w && w._choiceListWindow;
          const n = w && w._numberInputWindow;
          return !$gameMap.isEventRunning() || (w && w.pause) || (c && c.active && c.isOpen()) || (n && n.active && n.isOpen()) || !(SceneManager._scene instanceof Scene_Map);
        });
        const st = await game.eval(() => {
          const w = SceneManager._scene._messageWindow;
          return {
            running: ($gameMap.isEventRunning() || $gameMessage.isBusy()) && SceneManager._scene instanceof Scene_Map,
            choice: !!(w && w._choiceListWindow.active && w._choiceListWindow.isOpen()),
            number: !!(w && w._numberInputWindow.active && w._numberInputWindow.isOpen()),
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
        } else if (st.number) {
          const n = nums.shift() ?? 0;
          pages.push(st.text + `［${n}］`);
          await game.eval(v => { const w = SceneManager._scene._messageWindow._numberInputWindow; w._number = v; w.refresh(); }, n);
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
    /** 決定キーで調べて、プラグインが出す文章（隠し階段の発見など）を読み切る。 */
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

    // ===== 1. 砦の外門 → 霧の森・入口 020 =====
    check((await game.call("mapId")) === FORT.map, "ニューゲームで砦にいない");
    await go(FORT.map, FORT.stairs.x, FORT.stairs.y + 1, 8);
    await step(8);
    await arrive(FOREST, 35, 47);
    await game.shot("forest-arrive");
    const forestInfo = await game.eval(() => ({ w: $dataMap.width, h: $dataMap.height, fog: Hai.MapTone.fog(), name: $gameMap.displayName() }));
    check(forestInfo.w === 70 && forestInfo.h === 50 && forestInfo.fog && forestInfo.fog.density === 120 && forestInfo.name === "霧の森", "霧の森の大きさ・霧 " + JSON.stringify(forestInfo));
    await go(FOREST, 33, 44, 8);
    check((await talk()).join("").includes("南の字だけ"), "道標の文章");
    await go(FOREST, 39, 38, 8);
    const r1 = (await talk()).join("\n");
    check(r1.includes("左右が逆だった"), "R1-01 の本文 " + JSON.stringify(r1));
    check(await game.eval(() => Hai.Thoughts.isRead("R1-01")), "R1-01 が既読にならない");
    await go(FOREST, 12, 35, 8);
    await talk();
    check((await items("a", ARMOR.smallBell)) === 1, "倒れた塔の根元で見張り塔の小鐘が拾えない");
    // 見えない通路（白い花の先）
    const elixir0 = await items("i", ITEM.elixir);
    await go(FOREST, 56, 34, 8);
    for (let i = 0; i < 6; i++) check(await step(8), `墓地の北の見えない通路で進めない ${JSON.stringify(await pos())}`);
    check((await pos()).y === 28, "見えない通路の先の空き地に着かない " + JSON.stringify(await pos()));
    await step(8);
    await talk();
    check((await items("i", ITEM.elixir)) === elixir0 + 1, "見えない通路の先の宝箱で秘薬が手に入らない");
    await game.shot("forest-hidden-glade");
    await go(FOREST, 40, 1, 8);
    await step(8);
    await arrive(CHAPEL, 30, 43);
    console.log("  霧の森：道標・R1-01・小鐘・見えない通路の先の宝箱 → 北の道で礼拝堂へ");

    // ===== 2. 古い礼拝堂 021：ブルーノの遺骸・祈祷書・隠し階段 → 納骨所 022 =====
    await game.shot("chapel-arrive");
    await go(CHAPEL, 32, 28, 8);
    const bruno = (await talk()).join("\n");
    check(bruno.includes("巻いてくれる人がいません") && bruno.includes("名の壁の輪に置けば、この人を呼べる。"), "ブルーノの遺骸と記憶 4 " + JSON.stringify(bruno));
    const br = await game.eval(id => ({ found: $gameSwitches.value(id), memories: Hai.Companions.memories(5) }), SW.brunoFound);
    check(br.found && br.memories.includes(4), "ブルーノの遺骸（スイッチ 131）と記憶 4 " + JSON.stringify(br));
    await go(CHAPEL, 30, 18, 8);
    await talk();
    check((await items("i", ITEM.prayerBook)) === 1, "書見台で教会の祈祷書が手に入らない");
    await go(CHAPEL, 23, 17, 8);
    const found = (await inspectPlain()).join("");
    check(found.includes("隠し階段"), "礼拝堂の床の隠し階段が見つからない " + JSON.stringify(found));
    await step(8);
    await arrive(OSSUARY, 3, 4);
    await game.shot("ossuary");
    await go(OSSUARY, 4, 11, 8);
    check((await talk()).join("").includes("粉屋"), "ブルーノの記憶 1");
    check((await game.eval(() => Hai.Companions.memories(5))).includes(1), "ブルーノの記憶 1 が数えられない");
    await go(OSSUARY, 3, 4, 8);
    await step(8);
    await arrive(CHAPEL, 23, 17);
    await go(CHAPEL, 56, 2, 8);
    await step(8);
    await arrive(MINE, 2, 22);
    console.log(`  礼拝堂：ブルーノの遺骸（記憶 ${JSON.stringify(await game.eval(() => Hai.Companions.memories(5)))}）・祈祷書・隠し階段 → 納骨所 → 坑口`);

    // ===== 3. 鉄の坑道・上層 026：アデル・角灯・巻き上げ機・昇降機 =====
    await game.shot("mine-arrive");
    await go(MINE, 10, 38, 4);
    const adele = (await talk()).join("\n");
    check(adele.includes("後輩") && adele.includes("鐘鉄"), "アデルの台詞 " + JSON.stringify(adele));
    const ad = await game.eval(([a, s, t, r]) => ({ adele: $gameSwitches.value(a), survivors: $gameVariables.value(s), task: $gameVariables.value(t), room: $gameSwitches.value(r), note: Hai.Thoughts.hasNote("task:bellIron") }), [SW.adele, VAR.survivors, VAR.bellIronTask, SW.soulRoom]);
    check(ad.adele && ad.survivors >= 1 && ad.task === 1 && ad.room && ad.note, "アデルが砦へ（スイッチ 307・変数 103・稽古場・頼み） " + JSON.stringify(ad));
    await go(MINE, 28, 3, 8);
    await step(8);
    await arrive(STATION, 13, 13);
    await go(STATION, 21, 7, 8);
    await talk();
    check((await items("i", ITEM.lantern)) === 1, "詰め所で鐘番の角灯が手に入らない");
    await go(STATION, 13, 13, 2);
    await step(2);
    await arrive(MINE, 28, 3);
    await go(MINE, 30, 39, 2);
    await step(2);
    check((await game.call("mapId")) === MINE, "止め金を外す前に昇降機で下りられた");
    await finishEvent();
    await go(MINE, 31, 5, 8);
    await talk(["止め金を外す"]);
    check(await sw(SW.lift), "巻き上げ機でスイッチ 303 が立たない");
    await go(MINE, 30, 39, 2);
    await game.call("step", 2);
    await game.waitFor(() => $gameMap.isEventRunning() || $gameMessage.isBusy() || window.__game.mapId() !== 26);
    await finishEvent();
    await arrive(DEPTHS, 24, 3);
    console.log("  坑道・上層：アデル（スイッチ 307・稽古場・頼み 変数 301）・鐘番の角灯・巻き上げ機（スイッチ 303）→ 昇降機");

    // ===== 4. 下層 027（角灯）→ 掘り抜き → 営倉 033 =====
    await game.frames(10);
    const dark = await game.eval(() => Hai.MapTone.dark());
    check(dark && dark.radius === 5, "角灯を持って下層に入っても暗がりが広がらない " + JSON.stringify(dark));
    await game.shot("depths-lantern");
    await go(DEPTHS, 48, 34, 6);
    await step(6);
    await arrive(CELLS, 6, 5);
    await game.shot("cells-arrive");
    await go(CELLS, 42, 40, 8);
    const f02 = (await talk()).join("\n");
    check(f02.includes("三十まで揃った") && f02.includes("覚えている"), "門番の薄い思念 F02 と記憶が戻る一言 " + JSON.stringify(f02));
    check(await game.eval(() => Hai.Thoughts.isFaint("F02") && Hai.Thoughts.faintCount() === 1), "F02 が戻った記憶に数えられない");
    await go(CELLS, 47, 42, 2);
    await talk(["閂を外す"]);
    check((await sw(SW.ironDoor)) && (await sw(SW.ironDoorFort)), "鉄扉の閂でスイッチ 305・114 が立たない");
    await go(CELLS, 29, 42, 2);
    await step(2);
    await arrive(HALL, 22, 3);
    console.log("  下層：角灯で半径 5 → 掘り抜き → 営倉：F02（一言）・鉄扉の閂（スイッチ 305・114）→ 廊下");

    // ===== 5. 廊下 034：レバー・牢番の帳面 → 牢番 035 =====
    await go(HALL, 22, 26, 2);
    await step(2);
    check((await game.call("mapId")) === HALL, "レバーを引く前に鉄格子の門を抜けられた");
    await finishEvent();
    await go(HALL, 3, 14, 8);
    await talk(["引く"]);
    check(await sw(SW.hallGate), "レバーでスイッチ 309 が立たない");
    await go(HALL, 27, 24, 8);
    const log = (await talk()).join("\n");
    check(log.includes("火を嫌う") && (await items("i", ITEM.wardenLog)) === 1, "牢番の帳面 " + JSON.stringify(log));
    check(await game.eval(() => Hai.Thoughts.notes("clue").some(n => n.text.includes("火を嫌う"))), "牢番の帳面の手がかりがメモに無い");
    await go(HALL, 22, 26, 2);
    await step(2);
    await arrive(WARDEN_ROOM, 13, 13);
    await game.shot("warden-room");

    // 牢番（倒す。逃走・弱点の確かめは w_region1b）
    await go(WARDEN_ROOM, 13, 8, 8);
    await game.press("Enter");
    const t0 = Date.now();
    while ((await game.call("scene")) !== "Scene_Battle") {
      if (await game.eval(() => $gameMessage.isBusy())) { await game.frames(12); await game.press("Enter"); } else await game.frames(2);
      check(Date.now() - t0 < 60_000, "牢番に話しかけても戦闘にならない");
    }
    check(await game.eval(id => $gameTroop.troop().id === id, WARDEN_TROOP), "牢番の敵グループではない");
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
    await waitInput();
    await game.call("strengthenParty");
    await game.eval(() => $gameTroop.members().forEach(e => e.setHp(1)));
    for (let i = 0; i < 3 && (await game.eval(() => SceneManager._scene instanceof Scene_Battle && !$gameTroop.isAllDead())); i++) await turn(["attack", "attack", "attack", "attack"]);
    await toMap();
    await finishEvent();
    const won = await game.eval(([s, k]) => ({ sw: $gameSwitches.value(s), key: $gameParty.numItems($dataItems[k]), result: Hai.Boss.lastResult() }), [SW.warden, ITEM.keyRing]);
    check(won.sw && won.key === 1 && won.result === 0, "牢番を倒した後の旗と鍵束 " + JSON.stringify(won));
    await go(WARDEN_ROOM, 13, 4, 8);
    await step(8);
    await arrive(BELL_ROOM, 13, 12);
    console.log("  廊下：レバー（スイッチ 309）・牢番の帳面（手がかり）→ 牢番を倒す（スイッチ 151・鍵束）→ 鐘の間");

    // ===== 6. 営倉の鐘を鳴らす =====
    await go(BELL_ROOM, 13, 8, 8);
    const ring = (await talk(["綱を引く"])).join("\n");
    check(ring.includes("鐘が鳴る"), "鐘を鳴らす場面 " + JSON.stringify(ring));
    const bell = await game.eval(([a, b, c, t]) => ({ rung: $gameSwitches.value(a), count: $gameVariables.value(b), first: $gameSwitches.value(c), tag: $gameParty.numItems($dataItems[t]) }), [SW.bellRung, VAR.bellCount, SW.bellFirst, ITEM.dutyTag]);
    check(bell.rung && bell.count === 1 && bell.first && bell.tag === 1, "営倉の鐘（スイッチ 101・変数 101・スイッチ 310・当番の札） " + JSON.stringify(bell));
    await game.shot("bell-rung");
    check((await talk()).join("").includes("小さく震えて"), "鳴らした後の鐘の文章");
    console.log("  営倉の鐘：スイッチ 101・変数 101 = 1・当番の札");

    // ===== 7. 鉄扉の近道で砦へ戻る・鍵束で倉の扉 =====
    await go(CELLS, 47, 42, 2);
    await step(2);
    await arrive(FORT.map, FORT.ironArrive.x, FORT.ironArrive.y);
    await game.shot("fort-return");
    await go(CELLS, 12, 16, 4);
    const door = (await talk([], true)).join("");
    check(door.includes("牢番の鍵束で扉を開けた"), "鍵束で倉の扉が開かない " + JSON.stringify(door));
    check(await step(4), "開いた倉の扉を通れない");
    console.log("  鉄扉の近道で砦へ・鍵束で倉の扉が開く");

    // ===== 8. データの検査 =====
    const problems = checkAll();
    check(problems.length === 0, "データの検査で問題 " + JSON.stringify(problems.slice(0, 5)));
    game.assertNoErrors();
  } finally {
    await game.close();
  }
});
