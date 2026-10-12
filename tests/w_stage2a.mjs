// W3（#94）巨人の崖道（docs/world2.md 2 章、tools/maps/src/w3_05*）の検査：
//   1. 廃坑・上層 026 の東の出口 → 崖道 050。見張り小屋の箱で地下壕の鍵、R18 でメモ、骨の山の王国兵の札（来歴つき）。H14 の見えない通路で谷を迂回して巨人の石段へ。
//      石段の途中の段の縁から谷の手前へ飛び降りる（片道）。
//   2. 帝国の陣跡 051：地下壕の扉が鍵で開く。オルドの記憶 2、H15 の隠し扉 → 赤い宝箱「工兵の手袋」、結界に触れる。
//   3. 巨人の吊り橋 052：渡れない → H16（苔の崖）で向こう岸へ → 取っ手で吊り橋が下りる（スイッチ 161）。
//   4. 岩背負い（任意のボス）：逃げると東のたもとへ。戦って HP 50% で「誓いの石化」（物理が効かない）、雷の弱点のヒント、
//      倒すとスイッチ 158・岩背負いの石帯・門が開く。
//   5. 見張りの洞 053：叡智のオーブ、赤い宝箱「巨人の腕輪」、H17 の隠し階段 → 051 の地下壕の扉の内側。内側の閂で扉が開く。
//   6. オルドの記憶 1（026）・3（027）を読み、R12 と合わせて 4 つで完全体（スイッチ 141）。
//   7. セーブ・ロードで旗と持ち物が残る。
// 乱数（Math.random）は固定する（逃走の成否と行動の選び方）。
import { launchGame, check, runTest } from "./lib.mjs";

const MINE_UP = 26;
const MINE_EXIT = { x: 41, y: 16 }; // 026 の中央の坑道の東の端（(42,16) が出口）
const ROAD = 50;
const ROAD_ARRIVE = { x: 1, y: 18 };
const KEY_CHEST = { x: 9, y: 17 };
const R18 = { x: 12, y: 18 };
const H14 = { from: { x: 19, y: 8 }, path: [[8, 19, 7], [8, 19, 6], [8, 19, 5], [8, 19, 4], [6, 20, 4], [6, 21, 4], [6, 22, 4], [6, 23, 4]] };
const LEDGE = { from: { x: 22, y: 6 }, land: { x: 21, y: 8 } };
const STEPS_TOP = { x: 24, y: 1 };
const CAMP = 51;
const CAMP_ARRIVE = { x: 19, y: 26 };
const BUNKER_DOOR = { x: 19, y: 8 };
const ORDO2 = { x: 4, y: 18 };
const H15 = { x: 33, y: 4, chest: { x: 33, y: 1 } };
const CAMP_WARP = { x: 11, y: 9 };
const BRIDGE = 52;
const BRIDGE_ARRIVE = { x: 1, y: 7 };
const R21 = { x: 4, y: 5 };
const H16 = { moss: { x: 2, y: 9 }, east: { x: 20, y: 9 } };
const HANDLE = { x: 19, y: 5 };
const BEARER = { x: 31, y: 6, troop: 305, escape: { x: 21, y: 7, d: 4 } };
const CAVE = 53;
const ORB = { x: 12, y: 4, item: 171 };
const GIANT_CHEST = { x: 8, y: 5 };
const H17 = { x: 16, y: 7, to: { x: 19, y: 6 } };
const BOLT = { x: 20, y: 7 };
const MINE_LOW = 27;
const ORDO1 = { x: 2, y: 6 };
const ORDO3 = { x: 26, y: 9 };
const ITEM = { bunkerKey: 221, thunder: 303 };
const ARMOR = { gloves: 301, bracelet: 302, belt: 303 };
const FAST = 16;

await runTest(async () => {
  const game = await launchGame();
  try {
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
    const setRand = v => game.eval(x => { window.__rand = x; }, v);
    const log = () => game.eval(() => window.__log);
    const pos = () => game.call("pos");
    const mapId = () => game.call("mapId");
    const sw = id => game.eval(i => $gameSwitches.value(i), id);
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

    /** 決定キーで調べ、イベントが終わるまで文章を読み進める。選択肢が出たら choices の順に選ぶ（w_stage1b.mjs と同じ）。 */
    async function talk(choices = [], shots = {}, press = true) {
      const queue = choices.slice();
      if (press) await game.press("Enter");
      await game.waitFor(() => $gameMap.isEventRunning());
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
            running: $gameMap.isEventRunning() && SceneManager._scene instanceof Scene_Map,
            choice: !!(w && w._choiceListWindow.active && w._choiceListWindow.isOpen()),
            text: $gameMessage.allText(),
            choices: $gameMessage.choices(),
          };
        });
        if (!st.running) break;
        if (st.choice) {
          pages.push(st.text + "［" + st.choices.join("／") + "］");
          if (shots.choice) await game.shot(shots.choice);
          const q = queue.shift() ?? 0;
          const i = typeof q === "string" ? st.choices.indexOf(q) : q < 0 ? st.choices.length + q : q;
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
          return !$gameMap.isEventRunning() || !(SceneManager._scene instanceof Scene_Map) || !w.pause || $gameMessage.allText() !== prev;
        }, st.text);
        await game.frames(2);
      }
      await game.frames(3);
      return pages;
    }

    /** 決定キーで調べて、プラグインが出す文章（隠し扉・隠し階段の発見など。イベントではない）を読み切る。 */
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

    // ===== 1. 026 → 050、鍵・R18・H14・飛び降り =====
    await go(MINE_UP, MINE_EXIT.x, MINE_EXIT.y, 6);
    await step(6);
    await arrive(ROAD, ROAD_ARRIVE.x, ROAD_ARRIVE.y);
    await game.shot("road-entrance");
    await go(ROAD, KEY_CHEST.x, KEY_CHEST.y + 1, 8);
    await talk();
    check((await items("i", ITEM.bunkerKey)) === 1, "見張り小屋の箱で地下壕の鍵が手に入らない");
    await go(ROAD, R18.x, R18.y + 1, 8);
    const r18 = (await talk()).join("\n");
    check(r18.includes("地下壕の鍵は、この小屋の箱に入れておく") && r18.includes("メモ"), "R18 の本文とメモ " + JSON.stringify(r18));
    check(await game.eval(() => Hai.Thoughts.hasNote("clue:R18")), "R18 の手がかりがメモに無い");
    // 道具で語る大事なもの（docs/lore.md 4.1）：谷の手前の骨の山の王国兵の札
    await go(ROAD, 20, 9, 2);
    await talk();
    const tag = await game.eval(() => ({ n: $gameParty.numItems($dataItems[305]), lore: /<hai_lore>/.test($dataItems[305].note) }));
    check(tag.n === 1 && tag.lore, "王国兵の札が拾えない、または来歴が無い " + JSON.stringify(tag));
    // H14：曲がり道の北の端から、谷の北の岩壁の中を抜けて石段の西へ
    await go(ROAD, H14.from.x, H14.from.y, 8);
    for (const [d, x, y] of H14.path) {
      check(await step(d), `H14 の (${x},${y}) へ進めない`);
      const p = await pos();
      check(p.x === x && p.y === y, `H14 の途中の位置 ${JSON.stringify(p)}（期待 (${x},${y})）`);
    }
    check(await game.eval(() => Hai.HiddenPassage.isFound(20, 4)), "H14 が見つけたことにならない");
    await game.shot("road-h14-steps");
    // 飛び降り：段の縁 (21,6) を踏むと選択肢、飛び降りると谷の手前 (21,8)
    await go(ROAD, LEDGE.from.x, LEDGE.from.y, 4);
    await game.call("step", 4);
    await game.waitFor(() => $gameMap.isEventRunning());
    const jump = (await talk(["飛び降りる"], {}, false)).join("\n");
    check(jump.includes("飛び降りれば近い"), "段の縁の文章 " + JSON.stringify(jump));
    await game.waitPlayerStopped();
    const landed = await pos();
    check(landed.x === LEDGE.land.x && landed.y === LEDGE.land.y, "飛び降りた先 " + JSON.stringify(landed));
    check(!(await game.call("canPass", LEDGE.land.x, LEDGE.land.y, 8)), "谷の手前から段の縁へ上れてしまう（片道のはず）");
    console.log(`  崖道：鍵・R18・H14 で石段へ・段の縁から (${landed.x},${landed.y}) へ飛び降りた`);

    // ===== 2. 051 帝国の陣跡 =====
    await go(ROAD, STEPS_TOP.x, STEPS_TOP.y, 8);
    await step(8);
    await arrive(CAMP, CAMP_ARRIVE.x, CAMP_ARRIVE.y);
    await game.shot("camp-entrance");
    await go(CAMP, BUNKER_DOOR.x, BUNKER_DOOR.y + 1, 8);
    const door = (await talk()).join("\n");
    check(door.includes("地下壕の鍵で扉を開けた"), "地下壕の扉が鍵で開かない " + JSON.stringify(door));
    check(await step(8), "開いた地下壕の扉を通れない");
    await go(CAMP, ORDO2.x, ORDO2.y + 1, 8);
    const ordo2 = (await talk()).join("\n");
    check(ordo2.includes("肩章を剥がされ") && ordo2.includes("ブルーノの記憶 2/4「転機」"), "オルドの記憶 2 " + JSON.stringify(ordo2));
    await go(CAMP, H15.x, H15.y + 1, 8);
    await inspectPlain();
    check(await game.eval(([x, y]) => Hai.HiddenPassage.isFound(x, y), [H15.x, H15.y]), "H15 の隠し扉が開かない");
    await go(CAMP, H15.chest.x, H15.chest.y + 1, 8);
    await talk();
    check((await items("a", ARMOR.gloves)) === 1, "赤い宝箱で工兵の手袋が手に入らない");
    await go(CAMP, CAMP_WARP.x, CAMP_WARP.y + 1, 8);
    await talk([-1]);
    check(await game.eval(() => Hai.Warp.visited().some(v => v.name === "帝国の陣跡")), "陣跡の結界を訪れたことにならない");
    console.log("  陣跡：地下壕の扉・オルドの記憶 2・H15 → 工兵の手袋・結界");

    // ===== 3. 052 巨人の吊り橋 =====
    await go(CAMP, 38, 14, 6);
    await step(6);
    await arrive(BRIDGE, BRIDGE_ARRIVE.x, BRIDGE_ARRIVE.y);
    check(!(await game.call("canPass", 6, 7, 6)), "吊り橋が上がっているのに渡れる");
    await game.shot("bridge-raised");
    await go(BRIDGE, R21.x, R21.y + 1, 8);
    const r21 = (await talk()).join("\n");
    check(r21.includes("苔の生えた所だけ足がかかる"), "R21 の本文 " + JSON.stringify(r21));
    // H16：西のたもとの苔 (2,9) から崖の中を回って東のたもと (20,9) へ
    await go(BRIDGE, H16.moss.x, H16.moss.y, 2);
    const route = [...Array(5).fill(2), ...Array(18).fill(6), ...Array(5).fill(8)];
    for (const d of route) check(await step(d), `H16 の途中で進めない ${JSON.stringify(await pos())}`);
    const east = await pos();
    check(east.x === H16.east.x && east.y === H16.east.y, "H16 を抜けた先 " + JSON.stringify(east));
    await go(BRIDGE, HANDLE.x, HANDLE.y + 1, 8);
    await talk(["回す"]);
    check(await sw(161), "取っ手を回してもスイッチ 161 が ON にならない");
    check(await game.call("canPass", 6, 7, 6), "吊り橋が下りても渡れない");
    await go(BRIDGE, 12, 7, 6);
    await game.shot("bridge-lowered");
    console.log("  吊り橋：R21・H16 で向こう岸へ・取っ手で吊り橋が下りた（スイッチ 161）");

    // ===== 4. 岩背負い =====
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
          act.setTarget(0);
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
      return { id: e.enemyId(), hp: e.hp, mhp: e.mhp, alive: e.isAlive(), states: e.states().map(s => s.id) };
    });
    const startFight = async () => {
      await go(BRIDGE, BEARER.x - 1, BEARER.y, 6);
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
        check(Date.now() - t0 < 60_000, "岩背負いに話しかけても戦闘にならない");
      }
      await waitInput();
    };
    // 4a. 逃げる → 東のたもと
    await startFight();
    check((await log()).msgs.includes("――岩背負い――"), "戦闘の頭に岩背負いの名前が出ない");
    await game.shot("bearer-battle");
    await setRand(0.01);
    await game.eval(() => SceneManager._scene.commandEscape());
    await toMap();
    await setRand(0.5);
    await finishEvent();
    const esc = await game.eval(() => ({ map: $gameMap.mapId(), pos: window.__game.pos(), sw: $gameSwitches.value(158) }));
    check(esc.map === BRIDGE && esc.pos.x === BEARER.escape.x && esc.pos.y === BEARER.escape.y && esc.pos.d === BEARER.escape.d && !esc.sw,
      "岩背負いから逃げたときの場所と旗 " + JSON.stringify(esc));
    // 4b. 倒す
    await startFight();
    await game.eval(id => $gameParty.gainItem($dataItems[id], 3), ITEM.thunder);
    await game.eval(() => $gameTroop.members()[0].setHp(1500));
    await turn(["guard", "guard"]);
    let b = await boss();
    check(b.states.includes(303), "HP 50% で誓いの石化にならない " + JSON.stringify(b));
    check((await log()).msgs.some(m => m.includes("石に変わっていく")), "誓いの石化の文章が無い");
    // 石化の間は物理が効かない
    const hp0 = b.hp;
    await game.eval(() => $gameParty.members().forEach(a => a.recoverAll()));
    await turn(["attack", "attack"]);
    b = await boss();
    check(b.hp === hp0, `誓いの石化なのに物理が効いた ${hp0} → ${b.hp}`);
    // 雷鳴石（雷）→ 弱点のヒント、そのまま倒す
    await game.eval(() => { $gameParty.members().forEach(a => a.recoverAll()); $gameTroop.members()[0].setHp(300); });
    await turn([{ item: ITEM.thunder }, "guard"]);
    await game.waitFor(() => !(SceneManager._scene instanceof Scene_Battle) || BattleManager.isBattleEnd() || $gameMessage.isBusy(), null, 60_000);
    check((await log()).texts.includes("岩背負いは雷に弱いようだ。"), "雷の弱点のヒントが出ない " + JSON.stringify((await log()).texts));
    await toMap();
    await finishEvent();
    const won = await game.eval(tr => ({ sw: $gameSwitches.value(158), defeated: Hai.Boss.defeated(tr), msgs: window.__log.msgs }), BEARER.troop);
    check(won.sw && won.defeated, "岩背負いを倒したのに旗が立たない " + JSON.stringify(won));
    check(won.msgs.some(m => m.includes("門の閂が外れる音")), "勝ったときの文章が無い");
    check((await items("a", ARMOR.belt)) === 1, "岩背負いの石帯が手に入らない");
    await go(BRIDGE, 33, 6, 6);
    check(await step(6), "門が開かない");
    await step(6);
    await arrive(CAVE, 1, 6);
    console.log("  岩背負い：逃走・誓いの石化（物理が効かない）・雷のヒント・撃破でスイッチ 158 と石帯、門の奥へ");

    // ===== 5. 053 見張りの洞 =====
    await game.shot("cave-entrance");
    await go(CAVE, ORB.x, ORB.y + 1, 8);
    await talk([], { 0: "cave-orb" });
    check((await items("i", ORB.item)) === 1, "叡智のオーブが手に入らない");
    await go(CAVE, GIANT_CHEST.x, GIANT_CHEST.y + 1, 8);
    await talk();
    check((await items("a", ARMOR.bracelet)) === 1, "赤い宝箱で巨人の腕輪が手に入らない");
    // H17：ひび割れの床を調べると階段、踏むと 051 の地下壕の扉の内側
    await go(CAVE, H17.x - 1, H17.y, 6);
    await inspectPlain();
    await step(6);
    await arrive(CAMP, H17.to.x, H17.to.y);
    // 鍵を使わずに来た場合：扉は内側の閂で開く（ここでは扉を閉じ直して確かめる）
    await game.eval(([x, y]) => $gameSelfSwitches.setValue([$gameMap.mapId(), $gameMap.eventIdXy(x, y), "A"], false), [BUNKER_DOOR.x, BUNKER_DOOR.y]);
    await go(CAMP, BOLT.x - 1, BOLT.y, 6);
    await talk(["閂を外す"]);
    check(await game.eval(([x, y]) => $gameSelfSwitches.value([$gameMap.mapId(), $gameMap.eventIdXy(x, y), "A"]), [BUNKER_DOOR.x, BUNKER_DOOR.y]),
      "内側の閂で地下壕の扉が開かない");
    console.log("  見張りの洞：叡智のオーブ・巨人の腕輪・H17 で地下壕の内側へ・内側の閂");

    // ===== 6. オルドの記憶 1・3 → 完全体 =====
    await go(MINE_UP, ORDO1.x, ORDO1.y + 1, 8);
    check((await talk()).join("\n").includes("石は目に沿って割れ"), "オルドの記憶 1");
    await go(MINE_LOW, ORDO3.x, ORDO3.y + 1, 8);
    check((await talk()).join("\n").includes("一度も人を潰さなかった"), "オルドの記憶 3");
    await game.eval(() => Hai.Companions.learnMemory(5, 4)); // 臨終（R12、028）は W2 の検査で読んでいる
    const ordo = await game.eval(() => ({ memories: Hai.Companions.memories(5), complete: Hai.Companions.isComplete(5), var131: $gameVariables.value(131) }));
    check(ordo.memories.length === 4 && ordo.complete && ordo.var131 === 4, "オルドの記憶が 4 つ揃わない（変数 131 が 4 でない） " + JSON.stringify(ordo));
    console.log(`  オルドの記憶：${JSON.stringify(ordo.memories)}・完全体 ${ordo.complete}`);

    // ===== 7. セーブ・ロード =====
    await go(BRIDGE, 22, 7, 2);
    await game.call("save", 1);
    await game.call("goToTitle");
    await game.waitScene("Scene_Title");
    await game.call("load", 1);
    await game.waitScene("Scene_Map");
    const loaded = await game.eval(() => ({
      map: $gameMap.mapId(), pos: window.__game.pos(), sw158: $gameSwitches.value(158), sw161: $gameSwitches.value(161),
      orb: $gameParty.numItems($dataItems[171]), key: $gameParty.numItems($dataItems[221]), found: Hai.HiddenPassage.isFound(20, 4, 50),
    }));
    check(loaded.map === BRIDGE && loaded.pos.x === 22 && loaded.pos.y === 7 && loaded.sw158 && loaded.sw161 && loaded.orb === 1 && loaded.key === 1 && loaded.found,
      "ロードの後の状態 " + JSON.stringify(loaded));
    check(await game.call("canPass", 18, 7, 4), "ロードの後に吊り橋が渡れない");
    console.log("  セーブ・ロード：旗（158・161）・オーブ・鍵・見つけた隠し通路が残る");

    game.assertNoErrors();
  } finally {
    await game.close();
  }
});
