// W1 拠点「牢獄の間」と第1段階のダンジョン（docs/world.md 3・4 章、tools/maps/src/w1_*）の検査：
//   ニューゲーム → 拠点の目覚めの場面（セレスの台詞、スイッチ 111）→ 拠点（帰還の灯）が設定される →
//   各ダンジョンへ歩いて移れる → 隠し要素が各ダンジョンで 1 つずつ開く → 残留思念でメモが増える →
//   施錠扉が鍵で開く → オーブ「鎖」と帰りの転送陣 → データの検査（tools/data/check.mjs）が通る。マップごとのスクリーンショットを撮る。
// シンボル敵は検査の邪魔にならないよう、マップに入るたびに「倒した」ことにする（セルフスイッチ A）。
import { launchGame, check, runTest } from "./lib.mjs";
import { checkAll } from "../tools/data/check.mjs";

// 座標は tools/maps/src/w1_*.txt（行が y、列が x。0 始まり）
const HALL = 10;
const START = { x: 5, y: 16 };
const HOME = { mapId: 10, x: 16, y: 19 };
const STAIRS_UP = { x: 16, y: 3 }; // Map010 → Map020
const FOREST = 20;
const FOREST_ARRIVE = { x: 18, y: 27 };
const H01 = { flower: { x: 14, y: 19 }, passage: [{ x: 14, y: 20 }, { x: 14, y: 21 }], out: { x: 14, y: 22 } };
const R01 = { x: 10, y: 17, id: "R01" };
const R02 = { x: 30, y: 16, id: "R02" };
const CHAPEL = 21;
const H04 = { x: 19, y: 3, from: { x: 19, y: 2 } }; // 隠し階段（祭壇の裏）→ Map022
const OSSUARY = 22;
const OSSUARY_ARRIVE = { x: 3, y: 4 };
const H05 = { x: 17, y: 8, from: { x: 17, y: 9 }, chest: { x: 16, y: 3 } }; // 隠し扉 → 赤い宝箱（眠り香）
const SLEEP_INCENSE = 204;
const FENCE = { x: 34, y: 3 }; // Map021 坑口の前の木の柵（坑口は (34,2)）
const MINE_UP = 26;
const MINE_ARRIVE = { x: 4, y: 16 };
const H07 = { x: 14, y: 15, from: { x: 14, y: 16 } }; // 大百足の巣を迂回する隠し扉
const MINE_KEY = { chest: { x: 4, y: 6 }, item: 201 };
const MACHINE_DOOR = { x: 37, y: 25 }; // 坑道の鍵の施錠扉
const LEVER = { x: 39, y: 27 };
const ELEVATOR_UP = { x: 21, y: 2 };
const MINE_LOW = 27;
const H09 = { from: { x: 22, y: 22 }, passage: [23, 24, 25].map(x => ({ x, y: 22 })) }; // 落盤の脇 → Map028
const COLLAPSE = 28;
const ORDO = { x: 11, y: 6 };
const HOLE = { x: 39, y: 13 }; // 掘り抜きの穴 → Map033
const CELLS = 33;
const CELLS_ARRIVE = { x: 6, y: 3 };
const LOCKBOX = { x: 22, y: 2, item: 202 };
const CELL_DOOR = { x: 26, y: 20 }; // 監房の鍵の施錠扉 → Map034
const CORRIDOR = 34;
const H13 = { top: { x: 16, y: 4 }, bottom: { x: 16, y: 20 } }; // 影の無い西の壁の中
const H11 = { x: 41, y: 26 }; // 南東の通路の閂の扉 → 牢獄の間
const IRON_DOOR_FRONT = { x: 16, y: 25 };
const TORTURE = 35;
const ORB_ROOM = 36;
const ORB = { x: 8, y: 4 };
const ORB_TELEPORT = { x: 6, y: 7 };

await runTest(async () => {
  const game = await launchGame();
  const pos = () => game.call("pos");
  const mapId = () => game.call("mapId");
  const hp = (fn, ...args) => game.eval(([f, a]) => window.Hai.HiddenPassage[f](...a), [fn, args]);
  const th = (fn, ...args) => game.eval(([f, a]) => window.Hai.Thoughts[f](...a), [fn, args]);
  const messageBusy = () => game.eval(() => window.__game.ref("$gameMessage").isBusy());
  const eventRunning = () => game.eval(() => window.__game.ref("$gameMap").isEventRunning());

  /** シンボル敵を「倒した」ことにして消す（検査の途中で戦闘にならないように）。 */
  async function calmEnemies() {
    await game.eval(() => {
      const g = window.__game;
      const map = g.ref("$gameMap");
      for (const ev of map.events()) {
        if (ev.event().meta.hai_enemy) g.ref("$gameSelfSwitches").setValue([map.mapId(), ev.eventId(), "A"], true);
      }
    });
    await game.frames(2);
  }

  async function arrive(m) {
    await game.waitFor(m2 => window.__game.mapId() === m2 && !window.__game.isBusy(), m);
    await calmEnemies();
  }

  async function go(m, x, y, d) {
    await game.call("transfer", m, x, y, d);
    await game.waitFor(([m2, x2, y2]) => {
      const g = window.__game;
      const p = g.pos();
      return g.mapId() === m2 && p.x === x2 && p.y === y2 && !g.isBusy();
    }, [m, x, y]);
    await calmEnemies();
  }

  /** 1 歩。動けたら止まるまで待つ。 */
  async function step(d) {
    const moved = await game.call("step", d);
    if (moved) await game.waitPlayerStopped();
    return moved;
  }

  async function turn(d) {
    await game.eval(dir => window.__game.ref("$gamePlayer").setDirection(dir), d);
  }

  /** 出ている文章をすべて読んで閉じ、イベントが終わるまで待つ。各ページの中身を返す。 */
  async function readMessages(shotLabel) {
    const pages = [];
    for (;;) {
      await game.waitFor(() => {
        const s = window.__game.ref("SceneManager")._scene;
        const m = window.__game.ref("$gameMessage");
        if (m.isBusy()) return (s._messageWindow && s._messageWindow.pause) || (m.isChoice() && s._choiceListWindow && s._choiceListWindow.active);
        return !window.__game.ref("$gameMap").isEventRunning();
      });
      if (!(await messageBusy())) break;
      const text = await game.eval(() => window.__game.ref("$gameMessage").allText());
      pages.push(text);
      if (shotLabel && pages.length === 1) await game.shot(shotLabel);
      await game.frames(12);
      await game.press("Enter");
      await game.waitFor(prev => {
        const m = window.__game.ref("$gameMessage");
        return !m.isBusy() || m.allText() !== prev;
      }, text);
      await game.waitFor(() => window.__game.ref("$gameMessage").isBusy() || !window.__game.ref("$gameMap").isEventRunning());
      if (!(await messageBusy())) break;
    }
    await game.waitFor(() => !window.__game.ref("$gameMap").isEventRunning());
    await game.frames(3);
    return pages;
  }

  const itemCount = id => game.eval(i => window.__game.ref("$gameParty").numItems(window.$dataItems[i]), id);
  const switchOn = id => game.eval(i => window.__game.ref("$gameSwitches").value(i), id);

  /** 決定キーで調べて、出た文章を読み切る。 */
  async function investigate(shotLabel) {
    await game.press("Enter");
    await game.waitFor(() => window.__game.ref("$gameMessage").isBusy());
    return readMessages(shotLabel);
  }

  try {
    await game.call("setSpeed", 3);

    // ---- 1. ニューゲーム：拠点の独房の寝台で目覚め、セレスの台詞（2.2）が流れる
    // 目覚めの場面はテスト（?hai_test）ではふつう飛ばす（ほかのテストのため）。ここでは見る
    await game.eval(() => { window.__game.playOpening = true; });
    await game.call("newGame");
    await game.waitScene("Scene_Map");
    check((await mapId()) === HALL, `開始マップが ${await mapId()}`);
    const p0 = await pos();
    check(p0.x === START.x && p0.y === START.y, `開始位置 ${JSON.stringify(p0)}`);
    await game.waitFor(() => window.__game.ref("$gameMessage").isBusy());
    const wake = await readMessages("wake");
    const wakeText = wake.join("\n");
    check(wakeText.includes("三度目でようやく") && wakeText.includes("灰が降りやむ前に"), `目覚めの台詞: ${JSON.stringify(wake)}`);
    check(wakeText.includes("\\N[1]"), "台詞で主人公の名前（\\N[1]）を使っていない");
    check((await game.eval(() => window.__game.ref("$gameActors").actor(1).name())) === "ユエル", "主人公の名前がユエルでない");
    check(await game.eval(() => window.__game.ref("$gameSwitches").value(111)), "目覚めたあとスイッチ 111 が ON にならない");

    // ---- 2. 帰還の灯：目覚めの場面の最後で拠点が設定される（P5 Hai_Defeat が入っていれば窓口で確かめる）
    const hasDefeat = await game.eval(() => !!(window.Hai && window.Hai.Defeat));
    if (hasDefeat) {
      const home = await game.eval(() => window.Hai.Defeat.home());
      check(home.mapId === HOME.mapId && home.x === HOME.x && home.y === HOME.y, `拠点が ${JSON.stringify(home)}`);
    } else {
      const cmd = await game.eval(() => {
        const list = window.__game.ref("$dataMap").events.find(e => e && e.name === "帰還の灯").pages[0].list;
        return list.find(c => c.code === 357);
      });
      check(cmd && cmd.parameters[0] === "Hai_Defeat" && cmd.parameters[1] === "setHome" &&
        cmd.parameters[3].x === String(HOME.x) && cmd.parameters[3].y === String(HOME.y), `帰還の灯の setHome: ${JSON.stringify(cmd)}`);
      console.log("  （Hai_Defeat がまだ無いので、帰還の灯のコマンドだけ確かめた）");
    }
    // 独房の格子が開いて、広間へ歩ける
    await go(HALL, 7, 17, 6);
    check(await step(6), "独房の格子の扉を通れない");
    await go(HALL, 16, 17, 2);
    await game.shot("hall");

    // ---- 3. 北の階段から巡礼の森へ歩いて移る
    await go(HALL, STAIRS_UP.x, STAIRS_UP.y + 1, 8);
    await step(8);
    await arrive(FOREST);
    const pf = await pos();
    check(pf.x === FOREST_ARRIVE.x && pf.y === FOREST_ARRIVE.y, `森に着いた位置 ${JSON.stringify(pf)}`);
    await game.shot("forest-entrance");

    // ---- 4. 隠し要素 H01（白い花の木の間を抜ける見えない通路）
    await go(FOREST, H01.flower.x, H01.flower.y, 2);
    await game.shot("forest-h01-clue");
    for (const p of H01.passage) {
      check(await step(2), `H01 の見えない通路 (${p.x},${p.y}) に入れない`);
    }
    check(await step(2), "H01 から南の広場へ抜けられない");
    const ph = await pos();
    check(ph.x === H01.out.x && ph.y === H01.out.y, `H01 を抜けた位置 ${JSON.stringify(ph)}`);
    check(await hp("isFound", H01.passage[0].x, H01.passage[0].y, FOREST), "H01 が見つけたことにならない");

    // ---- 5. 残留思念 2 本（R01・R02）でメモが増える
    const notes0 = (await th("notes")).length;
    await go(FOREST, R01.x, R01.y + 1, 8);
    const r01 = await investigate("forest-r01");
    check(r01.join("").includes("白い花の咲く木の間"), `R01 の本文: ${JSON.stringify(r01)}`);
    await go(FOREST, R02.x, R02.y - 1, 2);
    await investigate();
    const notes1 = await th("notes");
    check(notes1.length === notes0 + 2, `メモが 2 行増えない（${notes0} → ${notes1.length}）`);
    check(await th("isRead", R01.id) && await th("isRead", R02.id), "R01・R02 が既読にならない");

    // ---- 6. 森の奥：祭壇の裏の隠し階段 H04 → 地下納骨所
    await go(CHAPEL, 20, 8, 8);
    await game.shot("forest-chapel");
    await go(CHAPEL, H04.from.x, H04.from.y, 2);
    const found = await investigate();
    check(found.join("").includes("隠し階段"), `H04 を調べた文章: ${JSON.stringify(found)}`);
    check(await step(2), "現れた隠し階段に乗れない");
    await arrive(OSSUARY);
    const po = await pos();
    check(po.x === OSSUARY_ARRIVE.x && po.y === OSSUARY_ARRIVE.y, `納骨所に着いた位置 ${JSON.stringify(po)}`);
    await game.shot("ossuary");

    // ---- 7. 納骨所の隠し扉 H05（くぼんだ壁）→ 赤い宝箱
    await go(OSSUARY, H05.from.x, H05.from.y, 8);
    check(!(await step(8)), "調べる前の隠し扉を通れた");
    await investigate();
    for (let i = 0; i < 6; i++) check(await step(8), `開いた隠し扉の奥へ進めない（${i + 1} 歩目）`);
    await turn(4);
    const before = await game.eval(id => window.__game.ref("$gameParty").numItems(window.$dataItems[id]), SLEEP_INCENSE);
    await investigate();
    const after = await game.eval(id => window.__game.ref("$gameParty").numItems(window.$dataItems[id]), SLEEP_INCENSE);
    check(after === before + 2, `赤い宝箱の眠り香が ${before} → ${after}`);

    // ---- 8. 森の奥の坑口から廃坑・上層へ（木の柵を押し開けて歩いて入る）
    await go(CHAPEL, FENCE.x, FENCE.y + 1, 8);
    await investigate();
    check(await step(8), "押し開けた柵を通れない");
    await step(8);
    await arrive(MINE_UP);
    const pm = await pos();
    check(pm.x === MINE_ARRIVE.x && pm.y === MINE_ARRIVE.y, `廃坑に着いた位置 ${JSON.stringify(pm)}`);
    await game.shot("mine-upper");

    // ---- 9. 廃坑の隠し扉 H07（影なし＋くぼみ）で大百足の巣を迂回
    await go(MINE_UP, H07.from.x, H07.from.y, 8);
    check(!(await step(8)), "調べる前の H07 を通れた");
    await investigate();
    check(await step(8) && await step(8) && await step(8), "開いた H07 の奥へ進めない");
    check(await hp("isFound", H07.x, H07.y, MINE_UP), "H07 が見つけたことにならない");

    // ---- 10. 施錠扉：鍵なしでは開かず、詰め所の机の坑道の鍵で開く → レバーで昇降機が動く
    await go(MINE_UP, MACHINE_DOOR.x, MACHINE_DOOR.y - 1, 2);
    const locked = await investigate();
    check(locked.join("").includes("鍵がかかっている"), `鍵なしの施錠扉: ${JSON.stringify(locked)}`);
    check(!(await step(2)), "鍵なしで施錠扉を通れた");
    await go(MINE_UP, MINE_KEY.chest.x, MINE_KEY.chest.y + 1, 8);
    await investigate();
    check((await itemCount(MINE_KEY.item)) === 1, "坑道の鍵が手に入らない");
    await go(MINE_UP, MACHINE_DOOR.x, MACHINE_DOOR.y - 1, 2);
    const opened = await investigate();
    check(opened.join("").includes("坑道の鍵"), `鍵で開けた文章: ${JSON.stringify(opened)}`);
    check(await step(2) && await step(2), "開いた施錠扉を通れない");
    await go(MINE_UP, LEVER.x, LEVER.y + 1, 8);
    await investigate();
    check(await switchOn(153), "レバーでスイッチ 153 が ON にならない");
    await go(MINE_UP, ELEVATOR_UP.x, ELEVATOR_UP.y + 1, 8);
    await investigate();
    await arrive(MINE_LOW);
    await game.shot("mine-lower");

    // ---- 11. 落盤の脇の見えない通路 H09 → 崩落の間：オルドの遺骸（スイッチ 131）
    await go(MINE_LOW, H09.from.x, H09.from.y, 6);
    for (const p of H09.passage) check(await step(6), `H09 (${p.x},${p.y}) に入れない`);
    await step(6);
    await step(6);
    await arrive(COLLAPSE);
    await go(COLLAPSE, ORDO.x - 1, ORDO.y, 6);
    const ordo = await investigate("collapse-ordo");
    check(ordo.join("").includes("この梁は俺を覚えている"), `オルドの記憶 1: ${JSON.stringify(ordo)}`);
    check(await switchOn(131), "オルドの遺骸でスイッチ 131 が ON にならない");

    // ---- 12. 掘り抜きの穴 → 地下牢・監房区。番号錠 413 で監房の鍵 → 施錠扉 → 更生の廊下
    await go(MINE_LOW, HOLE.x - 1, HOLE.y, 6);
    await step(6);
    await arrive(CELLS);
    const pc = await pos();
    check(pc.x === CELLS_ARRIVE.x && pc.y === CELLS_ARRIVE.y, `監房区に着いた位置 ${JSON.stringify(pc)}`);
    await go(CELLS, 24, 17, 8);
    await game.shot("prison-cells");
    await go(CELLS, LOCKBOX.x, LOCKBOX.y + 1, 8);
    for (const [number, ok] of [[123, false], [413, true]]) {
      await game.press("Enter");
      await game.waitFor(() => window.__game.ref("$gameMessage").isNumberInput() &&
        window.__game.ref("SceneManager")._scene._messageWindow._numberInputWindow.active);
      await game.eval(n => {
        const w = window.__game.ref("SceneManager")._scene._messageWindow._numberInputWindow;
        w._number = n;
        w.refresh();
      }, number);
      await game.frames(5);
      await game.press("Enter");
      const rest = await readMessages();
      check(rest.join("").includes(ok ? "監房の鍵" : "違うようだ"), `番号錠に ${number}: ${JSON.stringify(rest)}`);
    }
    check((await itemCount(LOCKBOX.item)) === 1, "番号錠の箱から監房の鍵が手に入らない");
    await go(CELLS, CELL_DOOR.x, CELL_DOOR.y - 1, 2);
    await investigate();
    check(await step(2), "監房の鍵で開いた扉を通れない");
    await step(2);
    await arrive(CORRIDOR);

    // ---- 13. 更生の廊下の西の壁の中（H13）を通って控え室へ
    await go(CORRIDOR, H13.top.x, H13.top.y, 2);
    await game.shot("prison-corridor");
    for (let y = H13.top.y + 1; y <= H13.bottom.y; y++) check(await step(2), `H13 の (${H13.top.x},${y}) に入れない`);
    check(await hp("isFound", H13.top.x, H13.top.y + 1, CORRIDOR), "H13 が見つけたことにならない");
    const speed = await game.eval(() => window.__game.ref("$gamePlayer").moveSpeed());
    check(speed === 4, `控え室での移動速度が ${speed}`);

    // ---- 14. 監房区の南東の閂の扉（H11）を開けると牢獄の間へ抜け、以後は拠点の鉄の扉から行き来できる
    await go(CELLS, H11.x - 1, H11.y, 6);
    await investigate();
    await arrive(HALL);
    check(await switchOn(114), "H11 でスイッチ 114 が ON にならない");
    const pi = await pos();
    check(pi.x === IRON_DOOR_FRONT.x && pi.y === IRON_DOOR_FRONT.y, `拠点に戻った位置 ${JSON.stringify(pi)}`);
    await turn(2);
    await step(2);
    await arrive(CELLS);

    // ---- 15. 拷問の間（看守長は仮のイベント）と、オーブの間：オーブ「鎖」（スイッチ 101、変数 101）→ 帰りの転送陣で拠点へ
    await go(TORTURE, 13, 9, 8);
    await game.shot("torture-room");
    await go(ORB_ROOM, ORB.x, ORB.y + 1, 8);
    await game.shot("orb-room");
    const orb = await investigate();
    check(orb.join("").includes("帳面をめくる自分の手"), `オーブ「鎖」の場面: ${JSON.stringify(orb)}`);
    check(await switchOn(101), "オーブでスイッチ 101 が ON にならない");
    check((await game.eval(() => window.__game.ref("$gameVariables").value(101))) === 1, "オーブの数（変数 101）が 1 にならない");
    await go(ORB_ROOM, ORB_TELEPORT.x + 1, ORB_TELEPORT.y, 4);
    await step(4);
    await arrive(HALL);

    check(!(await eventRunning()), "イベントが走ったまま");
    game.assertNoErrors();
  } finally {
    await game.close();
  }

  // ---- 最後：データの検査（届かない宝箱・壁に出る場所移動・帯の外の ID）
  const problems = checkAll();
  check(problems.length === 0, `データの検査:\n${problems.join("\n")}`);
});
