// W3（#94）異端者の廃集落・看取りの小屋・第1段階への追加（docs/world2.md 1.4・3・4 章、tools/maps/src/w3_06*・w3_023）の検査：
//   1. 巡礼の森・奥 021 の西端の焼けた道（道標）→ 焼け野 060：異端狩りの紋章・R23・H18 → 獣人の革鎧・ザザの記憶 2・3。
//   2. 廃集落・広場 061：ザザの記憶 1（手がかりのメモ）・H19 → ザザの父の剣（ザザだけが装備できる）・R24・R25・結界・H20・水路の柵。
//   3. 焼けた見張り台 062：ザザの遺骸（記憶 4 つで完全体）→ 拠点の召喚陣でザザが加わる。
//   4. 焚刑の教会 063：紋章で大扉・R26・R27・H21 → 地下の護送路 064・R28・H22 の閂（スイッチ 165）→ 監房区 033 と行き来。
//   5. 焚刑官ハルト：逃げると広場の北の坂の下へ。HP 50% で聖火の法（反撃）、沈黙で反撃が止む、氷の弱点のヒント、
//      倒すとスイッチ 156・耐火の外套・祈祷書・祭壇の叡智のオーブ・裏口が開く。
//   6. 021 の告解室のシオンの記憶 2、H23 → 看取りの小屋 023：シオンの記憶 3・遺骸・湧き水。
//   7. セーブ・ロード。
// 乱数（Math.random）は固定する（逃走の成否と行動の選び方）。
import { launchGame, check, runTest } from "./lib.mjs";

const HALL = 10;
const CIRCLE = { x: 28, y: 17 };
const CHAPEL = 21;
const SIGN = { x: 9, y: 7 };
const SHION2 = { x: 15, y: 10 };
const H23 = { ash: { x: 36, y: 4 } };
const FIELD = 60;
const FIELD_ARRIVE = { x: 38, y: 14 };
const EMBLEM = { x: 23, y: 21 };
const R23 = { x: 26, y: 22 };
const H18 = { grass: { x: 23, y: 4 } };
const ZAZA3 = { x: 15, y: 3 };
const ZAZA2 = { x: 13, y: 12 };
const SQUARE = 61;
const SQUARE_ARRIVE = { x: 42, y: 16 };
const ZAZA1 = { x: 14, y: 25 };
const H19 = { x: 12, y: 26, to: { x: 39, y: 2 } };
const SWORD = { x: 41, y: 2 };
const LADDER = { x: 38, y: 1 };
const R24 = { x: 12, y: 5 };
const R25 = { x: 21, y: 15 };
const WELL = { x: 18, y: 14 };
const H20 = { from: { x: 15, y: 13 } };
const FENCE = { x: 38, y: 23 };
const CHURCH_DOOR = { x: 21, y: 2 };
const TOWER = 62;
const TOWER_ARRIVE = { x: 25, y: 8 };
const ZAZA = { x: 9, y: 5 };
const CHURCH = 63;
const CHURCH_ARRIVE = { x: 12, y: 17 };
const R26 = { x: 9, y: 6 };
const R27 = { x: 17, y: 10 };
const H21 = { x: 12, y: 7 };
const HARTH = { x: 13, y: 8, troop: 311, escape: { x: 21, y: 10 } };
const ALTAR = { x: 13, y: 6 };
const BACKDOOR = { x: 17, y: 5 };
const TUNNEL = 64;
const TUNNEL_ARRIVE = { x: 2, y: 7 };
const R28 = { x: 19, y: 6 };
const H22 = { x: 43, y: 7 };
const CELLS = 33;
const CELLS_ARRIVE = { x: 8, y: 9 };
const HOSPICE = 23;
const HOSPICE_ARRIVE = { x: 1, y: 7 };
const SHION3 = { x: 18, y: 4 };
const SHION = { x: 21, y: 5 };
const SPRING = { x: 3, y: 10 };
const ITEM = { emblem: 222, prayer: 301, ice: 302, silence: 304, orb: 171 };
const ARMOR = { leather: 304, coat: 305 };
const WEAPON = { sword: 301 };
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


    // ===== 1. 021 の西端の焼けた道 → 060 =====
    await go(CHAPEL, SIGN.x, SIGN.y + 1, 8);
    check((await talk()).join("").includes("立ち入りを禁ず"), "焼けた道標の文章");
    await go(CHAPEL, 1, 8, 4);
    await step(4);
    await arrive(FIELD, FIELD_ARRIVE.x, FIELD_ARRIVE.y);
    await game.shot("village-entrance");
    await go(FIELD, EMBLEM.x, EMBLEM.y + 1, 8);
    await talk();
    check((await items("i", ITEM.emblem)) === 1, "野営跡の箱で異端狩りの紋章が手に入らない");
    await go(FIELD, R23.x - 1, R23.y, 6);
    check((await talk()).join("").includes("四つ目の村へは、行かない。"), "R23 の本文");
    check(await game.eval(() => Hai.Thoughts.hasNote("clue:R23")), "R23 の手がかりがメモに無い");
    // H18：焼けていない草 (23,4) から柵の中を抜けて柵囲いへ
    await go(FIELD, H18.grass.x, H18.grass.y, 6);
    check(await step(6), "H18 の見えない柵に入れない");
    check(await step(6), "H18 から柵囲いへ抜けられない");
    check(await step(6), "柵囲いの中を歩けない");
    await talk();
    check((await items("a", ARMOR.leather)) === 1, "赤い宝箱で獣人の革鎧が手に入らない");
    await go(FIELD, ZAZA3.x, ZAZA3.y + 1, 8);
    check((await talk()).join("").includes("ザザの記憶 3/4「罪か誇り」"), "ザザの記憶 3");
    await go(FIELD, ZAZA2.x, ZAZA2.y + 1, 8);
    check((await talk()).join("").includes("ザザの記憶 2/4「転機」"), "ザザの記憶 2");
    console.log("  焼け野：道標・紋章・R23・H18 → 獣人の革鎧・ザザの記憶 2・3");

    // ===== 2. 061 廃集落・広場 =====
    await go(FIELD, 1, 13, 4);
    await step(4);
    await arrive(SQUARE, SQUARE_ARRIVE.x, SQUARE_ARRIVE.y);
    await game.shot("square");
    await go(SQUARE, ZAZA1.x, ZAZA1.y + 1, 8);
    const z1 = (await talk()).join("\n");
    check(z1.includes("自分の剣を床下にしまった") && z1.includes("ザザの記憶 1/4「生い立ち」"), "ザザの記憶 1 " + JSON.stringify(z1));
    check(await game.eval(() => Hai.Thoughts.hasNote("clue:zaza-sword")), "ザザの父の剣の手がかりがメモに無い");
    // H19：父の家の床のひび割れ → 床下の隠れ部屋
    await go(SQUARE, H19.x, H19.y - 1, 2);
    await inspectPlain();
    await step(2);
    await arrive(SQUARE, H19.to.x, H19.to.y);
    await go(SQUARE, SWORD.x - 1, SWORD.y, 6);
    await talk();
    check((await items("w", WEAPON.sword)) === 1, "赤い宝箱でザザの父の剣が手に入らない");
    const canEquip = await game.eval(id => ({ zaza: $gameActors.actor(6).canEquip($dataWeapons[id]), hero: $gameActors.actor(1).canEquip($dataWeapons[id]) }), WEAPON.sword);
    check(canEquip.zaza && !canEquip.hero, "ザザの父の剣はザザだけが装備できるはず " + JSON.stringify(canEquip));
    await go(SQUARE, LADDER.x, LADDER.y + 1, 8);
    await step(8);
    await arrive(SQUARE, H19.x, H19.y - 1);
    await go(SQUARE, R24.x, R24.y + 1, 8);
    check((await talk()).join("").includes("鍋をかき混ぜている"), "R24 の本文");
    await go(SQUARE, R25.x, R25.y + 1, 8);
    check((await talk()).join("").includes("人の魂を数えておる"), "R25 の本文");
    await go(SQUARE, WELL.x, WELL.y + 1, 8);
    await talk([-1]);
    check(await game.eval(() => Hai.Warp.visited().some(v => v.name === "廃集落の井戸")), "井戸の跡の結界を訪れたことにならない");
    // H20：広場の西 (15,13) から焼けた生け垣の中を西へ、西の丘への道の西の端 (1,15) へ
    await go(SQUARE, H20.from.x, H20.from.y, 4);
    for (const d of [...Array(14).fill(4), 2, 2]) check(await step(d), `H20 の途中で進めない ${JSON.stringify(await pos())}`);
    const lane = await pos();
    check(lane.x === 1 && lane.y === 15, "H20 を抜けた先 " + JSON.stringify(lane));
    check(await game.eval(() => Hai.HiddenPassage.isFound(8, 13)), "H20 が見つけたことにならない");
    // 南の水路の柵を押し広げる
    await go(SQUARE, FENCE.x, FENCE.y - 1, 2);
    await talk(["押し広げる"]);
    check(await step(2), "押し広げた柵を通れない");
    console.log("  広場：ザザの記憶 1・H19 → ザザの父の剣・R24・R25・結界・H20・水路の柵");

    // ===== 3. 062 焼けた見張り台：ザザの遺骸 → 召喚 =====
    await go(SQUARE, 1, 15, 4);
    await step(4);
    await arrive(TOWER, TOWER_ARRIVE.x, TOWER_ARRIVE.y);
    await go(TOWER, ZAZA.x, ZAZA.y + 1, 8);
    const body = (await talk([], { 0: "zaza-remains" })).join("\n");
    check(body.includes("最後まで、わたしは正気だった") && body.includes("ザザの遺骸を拠点へ送った。"), "ザザの遺骸 " + JSON.stringify(body));
    const zz = await game.eval(() => ({ sw132: $gameSwitches.value(132), memories: Hai.Companions.memories(6), complete: Hai.Companions.isComplete(6), sw142: $gameSwitches.value(142) }));
    check(zz.sw132 && zz.memories.length === 4 && zz.complete && zz.sw142, "ザザの遺骸と記憶 4 つ（完全体）" + JSON.stringify(zz));
    await go(HALL, CIRCLE.x, CIRCLE.y, 2);
    const summon = (await talk([0, "ザザ（獣人の剣士）"])).join("\n");
    check(summon.includes("ザザが目を覚ました。"), "召喚陣でザザが目を覚まさない " + JSON.stringify(summon));
    check(await game.eval(() => $gameParty.members().some(a => a.actorId() === 6) && $gameSwitches.value(137)), "ザザが加わらない");
    console.log("  見張り台：ザザの遺骸（記憶 4 つで完全体）→ 召喚陣でザザが加わった");

    // ===== 4. 063 焚刑の教会・064 護送路・033 =====
    await go(SQUARE, CHURCH_DOOR.x, CHURCH_DOOR.y + 1, 8);
    check((await talk()).join("").includes("異端狩りの紋章で扉を開けた"), "教会の大扉が紋章で開かない");
    await step(8);
    await step(8);
    await arrive(CHURCH, CHURCH_ARRIVE.x, CHURCH_ARRIVE.y);
    await game.shot("church");
    await go(CHURCH, R26.x + 1, R26.y, 4);
    check((await talk()).join("").includes("枯れた白樺の向こうに看取りの小屋"), "R26 の本文");
    check(await game.eval(() => Hai.Thoughts.hasNote("clue:R26#2")), "R26 の 2 つ目の手がかりがメモに無い");
    await go(CHURCH, R27.x - 1, R27.y, 6);
    check((await talk()).join("").includes("冬の山の氷"), "R27 の本文");
    // H21：祭壇の前の色の違う床石 → 064
    await go(CHURCH, H21.x, H21.y + 1, 8);
    await inspectPlain();
    await step(8);
    await arrive(TUNNEL, TUNNEL_ARRIVE.x, TUNNEL_ARRIVE.y);
    await game.shot("tunnel");
    await go(TUNNEL, R28.x, R28.y + 1, 8);
    check((await talk()).join("").includes("千九百、二千"), "R28 の本文");
    await go(TUNNEL, H22.x - 1, H22.y, 6);
    await talk(["閂を外す"]);
    await arrive(CELLS, CELLS_ARRIVE.x, CELLS_ARRIVE.y);
    check(await sw(165), "閂を外してもスイッチ 165 が ON にならない");
    await game.waitFor(() => !$gameMap.isEventRunning() && !$gameMessage.isBusy());
    await game.frames(5);
    await game.call("step", 8); // 監房区の側の壁に触れると護送路の東の端へ
    await arrive(TUNNEL, H22.x - 1, H22.y);
    console.log("  教会：大扉・R26・R27・H21 → 護送路・R28・H22（スイッチ 165）で監房区と行き来");

    // ===== 5. 焚刑官ハルト =====
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
      return { id: e.enemyId(), hp: e.hp, mhp: e.mhp, alive: e.isAlive(), phase: Hai.Boss.phase(e), states: e.states().map(s => s.id) };
    });
    const startFight = async () => {
      await go(CHURCH, HARTH.x, HARTH.y + 1, 8);
      await game.eval(() => { $gameParty.members().forEach(a => a.recoverAll()); window.__log.msgs = []; window.__log.texts = []; });
      await game.press("Enter");
      const t0 = Date.now();
      while ((await game.call("scene")) !== "Scene_Battle") {
        if (await game.eval(() => $gameMessage.isBusy())) {
          await game.frames(12);
          await game.press("Enter");
        } else await game.frames(2);
        check(Date.now() - t0 < 60_000, "焚刑官に話しかけても戦闘にならない");
      }
      await waitInput();
    };
    await startFight();
    check((await log()).msgs.includes("――焚刑官ハルト――"), "戦闘の頭に焚刑官の名前が出ない");
    await game.shot("harth-battle");
    await setRand(0.01);
    await game.eval(() => SceneManager._scene.commandEscape());
    await toMap();
    await setRand(0.5);
    await finishEvent();
    const esc = await game.eval(() => ({ map: $gameMap.mapId(), pos: window.__game.pos(), sw: $gameSwitches.value(156) }));
    check(esc.map === SQUARE && esc.pos.x === HARTH.escape.x && esc.pos.y === HARTH.escape.y && !esc.sw, "焚刑官から逃げたときの場所と旗 " + JSON.stringify(esc));
    await startFight();
    await game.call("strengthenParty");
    await game.eval(([a, b]) => { $gameParty.gainItem($dataItems[a], 3); $gameParty.gainItem($dataItems[b], 3); }, [ITEM.ice, ITEM.silence]);
    // HP 50% → 聖火の法（312、形態 2）。反撃のステート 302 が付く
    await game.eval(() => $gameTroop.members()[0].setHp(1800));
    await turn(["guard", "guard"]);
    let b = await boss();
    check(b.id === 312 && b.phase === 2 && b.states.includes(302), "HP 50% で聖火の法にならない " + JSON.stringify(b));
    await game.shot("harth-flame");
    // 口封じの灰で沈黙 → 反撃のステートが外れる
    await game.eval(() => $gameParty.members().forEach(a => a.recoverAll()));
    await turn([{ item: ITEM.silence }, "guard"]);
    b = await boss();
    check(b.states.includes(146) && !b.states.includes(302), "沈黙の間に聖火の法（反撃）が外れない " + JSON.stringify(b));
    // 凍て石（氷）→ 弱点のヒント、そのまま倒す
    await game.eval(() => { $gameParty.members().forEach(a => a.recoverAll()); $gameTroop.members()[0].setHp(200); });
    await turn([{ item: ITEM.ice }, "guard"]);
    await game.waitFor(() => !(SceneManager._scene instanceof Scene_Battle) || BattleManager.isBattleEnd() || $gameMessage.isBusy(), null, 60_000);
    check((await log()).texts.includes("焚刑官ハルトは氷に弱いようだ。"), "氷の弱点のヒントが出ない " + JSON.stringify((await log()).texts));
    await toMap();
    await finishEvent();
    const won = await game.eval(tr => ({ sw: $gameSwitches.value(156), defeated: Hai.Boss.defeated(tr) }), HARTH.troop);
    check(won.sw && won.defeated, "焚刑官を倒したのに旗が立たない " + JSON.stringify(won));
    check((await items("a", ARMOR.coat)) === 1 && (await items("i", ITEM.prayer)) === 1, "焚刑官の固定ドロップ（耐火の外套・祈祷書）が無い");
    const orbs0 = await items("i", ITEM.orb);
    await go(CHURCH, ALTAR.x, ALTAR.y + 1, 8);
    await talk([], { 0: "church-orb" });
    check((await items("i", ITEM.orb)) === orbs0 + 1, "祭壇の叡智のオーブが手に入らない");
    await go(CHURCH, BACKDOOR.x, BACKDOOR.y + 1, 8);
    check((await talk()).join("").includes("閂が外れている"), "倒した後に裏口の閂が外れていない");
    console.log("  焚刑官：逃走・聖火の法（反撃）・沈黙で反撃が止む・氷のヒント・撃破（スイッチ 156）・耐火の外套と祈祷書・叡智のオーブ");

    // ===== 6. 023 看取りの小屋（021 の H23）=====
    await go(CHAPEL, SHION2.x, SHION2.y - 1, 2);
    check((await talk()).join("").includes("シオンの記憶 2/4「転機」"), "シオンの記憶 2");
    await go(CHAPEL, H23.ash.x, H23.ash.y, 6);
    for (let i = 0; i < 3; i++) check(await step(6), `H23 の途中で進めない ${JSON.stringify(await pos())}`);
    await arrive(HOSPICE, HOSPICE_ARRIVE.x, HOSPICE_ARRIVE.y);
    await game.shot("hospice");
    await go(HOSPICE, SHION3.x, SHION3.y + 1, 8);
    check((await talk()).join("").includes("シオンの記憶 3/4「罪か誇り」"), "シオンの記憶 3");
    await go(HOSPICE, SHION.x, SHION.y + 1, 8);
    const sb = (await talk([], { 0: "shion-remains" })).join("\n");
    check(sb.includes("兄さんは、間に合った？") && sb.includes("シオンの遺骸を拠点へ送った。"), "シオンの遺骸 " + JSON.stringify(sb));
    const sh = await game.eval(() => ({ sw135: $gameSwitches.value(135), memories: Hai.Companions.memories(9) }));
    check(sh.sw135 && JSON.stringify(sh.memories) === "[2,3,4]", "シオンの遺骸と記憶 2〜4 " + JSON.stringify(sh));
    await game.eval(() => $gameParty.members().forEach(a => a.setHp(1)));
    await go(HOSPICE, SPRING.x + 1, SPRING.y, 4);
    await talk();
    check(await game.eval(() => $gameParty.members().every(a => a.hp === a.mhp)), "灰の泉の湧き水で回復しない");
    console.log(`  看取りの小屋：H23・シオンの記憶 ${JSON.stringify(sh.memories)}・遺骸（スイッチ 135）・湧き水`);

    // ===== 7. セーブ・ロード =====
    await go(SQUARE, 30, 15, 2);
    await game.call("save", 1);
    await game.call("goToTitle");
    await game.waitScene("Scene_Title");
    await game.call("load", 1);
    await game.waitScene("Scene_Map");
    const loaded = await game.eval(() => ({
      map: $gameMap.mapId(), pos: window.__game.pos(), sw156: $gameSwitches.value(156), sw165: $gameSwitches.value(165),
      party: $gameParty.members().map(a => a.actorId()), found: Hai.Companions.found(),
      door: $gameSelfSwitches.value([61, $gameMap.eventIdXy(21, 2), "A"]),
    }));
    check(loaded.map === SQUARE && loaded.pos.x === 30 && loaded.pos.y === 15 && loaded.sw156 && loaded.sw165 && loaded.party.includes(6) &&
      loaded.found.includes(6) && loaded.found.includes(9) && loaded.door, "ロードの後の状態 " + JSON.stringify(loaded));
    console.log("  セーブ・ロード：旗（156・165）・ザザの加入・遺骸・教会の大扉が残る");

    game.assertNoErrors();
  } finally {
    await game.close();
  }
});
