// W4（#102）魚人の湿地（docs/world2.md 5 章、tools/maps/src/w4_07*）の検査：
//   1. 廃集落・広場 061 の水路沿いの小道 → 湿地・葦原 070：道標のルメの記憶 2、水門小屋の R29・灰の病の届け帳（来歴つき）・取っ手（スイッチ 159）、
//      網小屋の R30・雷鳴石、迷い道の行き止まりの眠り香、H24（折れた葦）で赤「大顎」を迂回、H25 → 赤い宝箱「漁師の銛」。
//   2. 水上集落の跡 071：ルメの記憶 1（歌い手の家）、4 軒目の梁の牙の首飾り、浅瀬の沈んだ板の道（スイッチ 159 で歩ける）、
//      集会所の結界・R32・H26 → 叡智のオーブ、歌の杭の R31・ルメの記憶 3、歌の錠（違う数・312）→ 072。
//   3. 沈んだ舞台 072：ルメの遺骸（記憶 4 つで完全体）、H27 → 赤い宝箱「歌い手の首飾り」→ 拠点の召喚陣でルメが加わる。
//   4. 沼主の淵 073：R33、沼主（逃げると 071 の南西へ。呑み込みは主を叩くと吐き出す、雷の弱点のヒント、眠りが効く、
//      HP 30% で淵に潜る・大波、倒すとスイッチ 157・水鏡の護符・沼主の髭・淵の底の排水口まで歩ける）。
//   5. セーブ・ロード。
// 乱数（Math.random）は固定する（逃走の成否と行動の選び方）。
import { launchGame, check, runTest } from "./lib.mjs";

const HALL = 10;
const CIRCLE = { x: 28, y: 17 };
const SQUARE = 61;
const CANAL_END = { x: 38, y: 31 };
const REEDS = 70;
const REEDS_ARRIVE = { x: 22, y: 1 };
const SIGN = { x: 20, y: 2 };
const R29 = { x: 40, y: 3 };
const LEDGER = { x: 41, y: 3 };
const HANDLE = { x: 44, y: 4 };
const R30 = { x: 3, y: 3 };
const NET_CHEST = { x: 6, y: 6 };
const DEAD_END_CHEST = { x: 35, y: 13 };
const H24 = { moss: { x: 15, y: 20 }, end: { x: 15, y: 29 } };
const H25 = { from: { x: 10, y: 29 }, chest: { x: 4, y: 29 } };
const VILLAGE = 71;
const VILLAGE_ARRIVE = { x: 21, y: 1 };
const LUME1 = { x: 12, y: 6 };
const FANG = { x: 5, y: 21 };
const SUNKEN = { x: 22, top: 11, bottom: 20 };
const WARP = { x: 32, y: 6 };
const R32 = { x: 37, y: 6 };
const H26 = { x: 34, y: 4, orb: { x: 34, y: 2 } };
const R31 = { x: 36, y: 26 };
const LUME3 = { x: 38, y: 26 };
const STAKE = { x: 37, y: 29 };
const STAGE = 72;
const STAGE_ARRIVE = { x: 13, y: 1 };
const LUME = { x: 13, y: 11 };
const H27 = { x: 21, y: 8, chest: { x: 22, y: 5 } };
const POOL = 73;
const POOL_ARRIVE = { x: 12, y: 1 };
const R33 = { x: 7, y: 5 };
const LORD = { x: 13, y: 6, troop: 406, escape: { x: 2, y: 29, d: 8 } };
const DRAIN = { x: 13, y: 9 };
const ITEM = { ledger: 401, fang: 402, beard: 406, sleep: 204, thunder: 303, orb: 171 };
const WEAPON = { harpoon: 401 };
const ARMOR = { necklace: 401, mirror: 402 };
const STATE = { sleep: 142, dive: 401, swallowed: 402 };
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
    const sw = id => game.eval(i => $gameSwitches.value(i), id);
    const items = (kind, id) => game.eval(([k, i]) => $gameParty.numItems((k === "a" ? $dataArmors : k === "w" ? $dataWeapons : $dataItems)[i]), [kind, id]);
    const hasLore = (kind, id) => game.eval(([k, i]) => /<hai_lore>\n[^<]+<\/hai_lore>/.test((k === "a" ? $dataArmors : k === "w" ? $dataWeapons : $dataItems)[i].note), [kind, id]);

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

    /**
     * 決定キーで調べ、イベントが終わるまで文章を読み進める（w_stage2b.mjs と同じ）。
     * 選択肢が出たら choices の順に選ぶ（番号、文字列。文字列は前方一致でもよい）。数値入力が出たら choices の次の { number } を入れる。
     */
    async function talk(choices = [], shots = {}, press = true) {
      const queue = choices.slice();
      if (press) await game.press("Enter");
      await game.waitFor(() => $gameMap.isEventRunning());
      const pages = [];
      for (;;) {
        await game.waitFor(() => {
          const w = SceneManager._scene._messageWindow;
          const c = w && w._choiceListWindow;
          const n = w && w._numberInputWindow;
          return !$gameMap.isEventRunning() || (w && w.pause) || (c && c.active && c.isOpen()) || (n && n.active) ||
            !(SceneManager._scene instanceof Scene_Map);
        });
        const st = await game.eval(() => {
          const w = SceneManager._scene._messageWindow;
          return {
            running: $gameMap.isEventRunning() && SceneManager._scene instanceof Scene_Map,
            choice: !!(w && w._choiceListWindow.active && w._choiceListWindow.isOpen()),
            number: !!(w && w._numberInputWindow.active),
            text: $gameMessage.allText(),
            choices: $gameMessage.choices(),
          };
        });
        if (!st.running) break;
        if (st.number) {
          const q = queue.shift();
          check(q && q.number !== undefined, `数値入力が出たが、入れる数が無い（${st.text}）`);
          pages.push(st.text + `［${q.number}］`);
          await game.eval(n => {
            const w = SceneManager._scene._messageWindow._numberInputWindow;
            w._number = n;
            w.refresh();
          }, q.number);
          await game.frames(5);
          await game.press("Enter");
        } else if (st.choice) {
          pages.push(st.text + "［" + st.choices.join("／") + "］");
          if (shots.choice) await game.shot(shots.choice);
          const q = queue.shift() ?? 0;
          const i = typeof q === "string" ? st.choices.findIndex(c => c === q || c.startsWith(q)) : q < 0 ? st.choices.length + q : q;
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

    /** 決定キーで調べて、プラグインが出す文章（隠し扉の発見など。イベントではない）を読み切る。 */
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

    // ---- 戦闘（w_stage2b.mjs と同じ） ----
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
    /** 1 ターン。plan[i] は i 番目の仲間の行動："guard"・"attack"・{ item }・{ skill }。 */
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
    /** ボスに話しかけて（選択肢があれば一つ目を選んで）戦闘の入力の番まで進める。 */
    const startFight = async (m, x, y, d) => {
      await go(m, x, y, d);
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
        check(Date.now() - t0 < 60_000, "ボスに話しかけても戦闘にならない");
      }
      await waitInput();
    };
    /** 拠点の召喚陣で仲間を呼び戻す。 */
    const summon = async (name) => {
      await go(HALL, CIRCLE.x, CIRCLE.y, 2);
      const text = (await talk([0, name])).join("\n");
      check(text.includes(`${name}が目を覚ました。`), `召喚陣で${name}が目を覚まさない ` + JSON.stringify(text));
    };

    // ===== 1. 061 → 070 湿地・葦原 =====
    await go(SQUARE, CANAL_END.x, CANAL_END.y, 2);
    await step(2);
    await arrive(REEDS, REEDS_ARRIVE.x, REEDS_ARRIVE.y);
    await game.shot("reeds-entrance");
    await go(REEDS, SIGN.x + 1, SIGN.y, 4);
    const lume2 = (await talk()).join("\n");
    check(lume2.includes("北を指す板に「人間の村」") && lume2.includes("魚人の歌が呪いを呼んだ") && lume2.includes("ルメの記憶 2/4「転機」"),
      "道標とルメの記憶 2 " + JSON.stringify(lume2));
    await go(REEDS, R29.x, R29.y + 1, 8);
    check((await talk()).join("").includes("回せば、また水は引く"), "R29 の本文");
    check(await game.eval(() => Hai.Thoughts.hasNote("clue:R29")), "R29 の手がかりがメモに無い");
    await go(REEDS, LEDGER.x, LEDGER.y + 1, 8);
    await talk();
    check((await items("i", ITEM.ledger)) === 1 && (await hasLore("i", ITEM.ledger)), "水門小屋の棚で灰の病の届け帳（来歴つき）が拾えない");
    await go(REEDS, HANDLE.x - 1, HANDLE.y, 6);
    await talk(["回す"]);
    check(await sw(159), "水門の取っ手を回してもスイッチ 159 が ON にならない");
    await go(REEDS, R30.x, R30.y + 1, 8);
    check((await talk()).join("").includes("ルメの歌は、病じゃない"), "R30 の本文");
    await go(REEDS, NET_CHEST.x, NET_CHEST.y - 1, 2);
    await talk();
    check((await items("i", ITEM.thunder)) === 1, "網小屋の宝箱で雷鳴石が手に入らない");
    await go(REEDS, DEAD_END_CHEST.x - 1, DEAD_END_CHEST.y, 6);
    await talk();
    check((await items("i", ITEM.sleep)) === 1, "迷い道の行き止まりの宝箱で眠り香が手に入らない");
    // H24：迷い道の折れた葦 (15,20) から、葦原の中ほどの西の葦の壁の中を南へ
    await go(REEDS, H24.moss.x, H24.moss.y, 2);
    for (let i = 0; i < 9; i++) check(await step(2), `H24 の途中で進めない ${JSON.stringify(await pos())}`);
    const h24 = await pos();
    check(h24.x === H24.end.x && h24.y === H24.end.y, "H24 を抜けた先 " + JSON.stringify(h24));
    check(await game.eval(() => Hai.HiddenPassage.isFound(15, 24)), "H24 が見つけたことにならない");
    // H25：迂回の道の西の端から、葦の中を沈んだ荷車へ
    await go(REEDS, H25.from.x, H25.from.y, 4);
    for (let i = 0; i < 4; i++) check(await step(4), `H25 の途中で進めない ${JSON.stringify(await pos())}`);
    await go(REEDS, H25.chest.x + 1, H25.chest.y, 4);
    await talk();
    check((await items("w", WEAPON.harpoon)) === 1 && (await hasLore("w", WEAPON.harpoon)), "沈んだ荷車の赤い宝箱で漁師の銛が手に入らない");
    check(await game.eval(() => $dataWeapons[401].traits.some(t => t.code === 31 && t.dataId === 3)), "漁師の銛が氷の属性でない");
    console.log("  葦原：道標（ルメの記憶 2）・R29・届け帳・水門（スイッチ 159）・R30・H24・H25 → 漁師の銛");

    // ===== 2. 071 水上集落の跡 =====
    await go(REEDS, 22, 32, 2);
    await step(2);
    await arrive(VILLAGE, VILLAGE_ARRIVE.x, VILLAGE_ARRIVE.y);
    await game.shot("village-entrance");
    await go(VILLAGE, LUME1.x, LUME1.y + 1, 8);
    check((await talk()).join("").includes("ルメの記憶 1/4「生い立ち」"), "ルメの記憶 1");
    await go(VILLAGE, FANG.x, FANG.y + 1, 8);
    await talk();
    check((await items("i", ITEM.fang)) === 1 && (await hasLore("i", ITEM.fang)), "4 軒目の梁で牙の首飾り（来歴つき）が拾えない");
    // 浅瀬：水門を開けたので、沈んだ板の道を北の桟橋から南の板の道まで歩ける
    await go(VILLAGE, SUNKEN.x, SUNKEN.top, 2);
    for (let y = SUNKEN.top; y < SUNKEN.bottom; y++) check(await step(2), `浅瀬の沈んだ板の道を歩けない ${JSON.stringify(await pos())}`);
    await game.shot("village-shallows");
    await game.eval(() => $gameSwitches.setValue(159, false));
    await game.frames(2);
    check(!(await game.call("canPass", SUNKEN.x, SUNKEN.top, 2)), "水門を開ける前から浅瀬を歩ける");
    await game.eval(() => $gameSwitches.setValue(159, true));
    await game.frames(2);
    // 集会所：結界・R32・H26
    await go(VILLAGE, WARP.x, WARP.y + 1, 8);
    await talk([-1]);
    check(await game.eval(() => Hai.Warp.visited().some(v => v.name === "水上集落の集会所")), "集会所の結界を訪れたことにならない");
    await go(VILLAGE, R32.x, R32.y + 1, 8);
    const r32 = (await talk()).join("\n");
    check(r32.includes("払いは人間持ちだと") && r32.includes("壁を叩けば分かる"), "R32 の 2 ページ " + JSON.stringify(r32));
    check(await game.eval(() => Hai.Thoughts.hasNote("clue:R32")), "R32 の手がかりがメモに無い");
    await go(VILLAGE, H26.x, H26.y + 1, 8);
    await inspectPlain();
    check(await game.eval(([x, y]) => Hai.HiddenPassage.isFound(x, y), [H26.x, H26.y]), "H26 の隠し扉が開かない");
    const orbs0 = await items("i", ITEM.orb);
    await step(8);
    await step(8);
    await talk();
    check((await items("i", ITEM.orb)) === orbs0 + 1, "集会所の隠し部屋で叡智のオーブが手に入らない");
    // 歌の杭：R31・ルメの記憶 3・歌の錠 312
    await go(VILLAGE, R31.x, R31.y + 1, 8);
    check((await talk()).join("").includes("さん、いち、に"), "R31 の本文");
    check(await game.eval(() => Hai.Thoughts.hasNote("clue:R31")), "R31 の手がかりがメモに無い");
    await go(VILLAGE, LUME3.x, LUME3.y + 1, 8);
    check((await talk()).join("").includes("ルメの記憶 3/4「罪か誇り」"), "ルメの記憶 3");
    await go(VILLAGE, STAKE.x, STAKE.y - 1, 2);
    check((await talk(["歌う", { number: 123 }])).join("").includes("違う歌のようだ"), "歌の錠に違う数で開いてしまう");
    check(!(await game.call("canPass", STAKE.x, STAKE.y - 1, 2)), "歌の錠を開ける前に板の道へ出られる");
    const song = (await talk(["歌う", { number: 312 }], { 1: "village-song-lock" })).join("\n");
    check(song.includes("板の道が浮かんできた"), "歌の錠 312 で板の道が浮かばない " + JSON.stringify(song));
    console.log("  水上集落：ルメの記憶 1・3、牙の首飾り、浅瀬の板の道、結界・R32・H26 → 叡智のオーブ、R31、歌の錠 312");

    // ===== 3. 072 沈んだ舞台 =====
    check(await step(2), "浮かんだ板の道へ出られない");
    await arrive(STAGE, STAGE_ARRIVE.x, STAGE_ARRIVE.y);
    await game.shot("stage-entrance");
    await go(STAGE, LUME.x, LUME.y - 1, 2);
    const body = (await talk([], { 1: "lume-remains" })).join("\n");
    check(body.includes("……ありがとう。聞いてくれて。") && body.includes("ルメの遺骸を拠点へ送った。"), "ルメの遺骸 " + JSON.stringify(body));
    const lu = await game.eval(() => ({ sw134: $gameSwitches.value(134), memories: Hai.Companions.memories(8), complete: Hai.Companions.isComplete(8), sw144: $gameSwitches.value(144) }));
    check(lu.sw134 && lu.memories.length === 4 && lu.complete && lu.sw144, "ルメの遺骸と記憶 4 つ（完全体）" + JSON.stringify(lu));
    await go(STAGE, H27.x, H27.y + 1, 8);
    await inspectPlain();
    check(await game.eval(([x, y]) => Hai.HiddenPassage.isFound(x, y), [H27.x, H27.y]), "H27 の隠し扉が開かない");
    await go(STAGE, H27.chest.x, H27.chest.y + 1, 8);
    await talk();
    check((await items("a", ARMOR.necklace)) === 1 && (await hasLore("a", ARMOR.necklace)), "赤い宝箱で歌い手の首飾りが手に入らない");
    await go(STAGE, 13, 1, 8);
    await step(8);
    await arrive(VILLAGE, STAKE.x, STAKE.y - 1);
    await summon("ルメ");
    check(await game.eval(() => $gameParty.members().some(a => a.actorId() === 8) && $gameSwitches.value(139)), "ルメが加わらない");
    console.log(`  沈んだ舞台：ルメの遺骸（記憶 ${JSON.stringify(lu.memories)}、完全体）・H27 → 歌い手の首飾り → 召喚陣でルメが加わった`);

    // ===== 4. 073 沼主の淵 =====
    await go(VILLAGE, 2, 30, 2);
    await step(2);
    await arrive(POOL, POOL_ARRIVE.x, POOL_ARRIVE.y);
    await game.shot("pool");
    await go(POOL, R33.x + 1, R33.y, 4);
    check((await talk()).join("").includes("主の髭は雷を嫌う"), "R33 の本文");
    check(await game.eval(() => Hai.Thoughts.hasNote("clue:R33")), "R33 の手がかりがメモに無い");
    // 4a. 逃げる → 071 の南西の淵への道
    await startFight(POOL, LORD.x, LORD.y - 1, 2);
    check((await log()).msgs.includes("――沼主――"), "戦闘の頭に沼主の名前が出ない");
    await game.shot("lord-battle");
    await setRand(0.01);
    await game.eval(() => SceneManager._scene.commandEscape());
    await toMap();
    await setRand(0.5);
    await finishEvent();
    const esc = await game.eval(() => ({ map: $gameMap.mapId(), pos: window.__game.pos(), sw: $gameSwitches.value(157) }));
    check(esc.map === VILLAGE && esc.pos.x === LORD.escape.x && esc.pos.y === LORD.escape.y && esc.pos.d === LORD.escape.d && !esc.sw,
      "沼主から逃げたときの場所と旗 " + JSON.stringify(esc));
    // 4b. 戦う：② 3 ターン目の呑み込み → 雷鳴石で主を叩くと吐き出す（雷の弱点のヒント）
    await startFight(POOL, LORD.x, LORD.y - 1, 2);
    const heal = () => game.eval(() => $gameParty.members().forEach(a => { const held = a.isStateAffected(402); a.recoverAll(); if (held) a.addState(402); }));
    await turn(["guard", "guard"]);
    await heal();
    await turn(["guard", "guard"]);
    await heal();
    await turn(["guard", "guard"]);
    const held = await game.eval(id => $gameParty.members().filter(a => a.isStateAffected(id)).map(a => a.actorId()), STATE.swallowed);
    check(held.length === 1, "3 ターン目に呑み込みが無い " + JSON.stringify(await log()));
    await heal();
    const thunderOwner = await game.eval(() => $gameParty.members().findIndex(a => !a.isStateAffected(402)));
    const plan = ["guard", "guard"];
    plan[thunderOwner] = { item: ITEM.thunder };
    await turn(plan);
    const freed = await game.eval(id => $gameParty.members().every(a => !a.isStateAffected(id)), STATE.swallowed);
    check(freed && (await log()).msgs.some(m => m.includes("呑んだ者を吐き出した")), "主を叩いても吐き出さない " + JSON.stringify((await log()).msgs));
    check((await log()).texts.includes("沼主は雷に弱いようだ。"), "雷の弱点のヒントが出ない " + JSON.stringify((await log()).texts));
    // 眠り香で眠る（眠りが効く）
    await heal();
    const sleepPlan = ["guard", "guard"];
    sleepPlan[thunderOwner] = { item: ITEM.sleep };
    await turn(sleepPlan);
    let b = await boss();
    check(b.states.includes(STATE.sleep), "沼主に眠り香が効かない " + JSON.stringify(b));
    // ③ HP 30% で淵に潜る・大波をくり返す第二形態
    await game.eval(() => { const e = $gameTroop.members()[0]; e.removeState(142); e.setHp(Math.floor(e.mhp * 0.29)); });
    await heal();
    await turn(["guard", "guard"]);
    b = await boss();
    check(b.id === 413 && b.phase === 2, "HP 30% で沼主が形態変化しない " + JSON.stringify(b));
    let dived = false, missed = false;
    for (let i = 0; i < 6 && !(dived && missed); i++) {
      await heal();
      b = await boss();
      if (b.states.includes(STATE.dive)) {
        dived = true;
        await turn(["attack", "attack"]);
        missed = (await boss()).hp === b.hp;
      } else await turn(["guard", "guard"]);
    }
    check(dived && missed, `淵に潜って攻撃が当たらないターンが無い（潜った ${dived}・外れた ${missed}）`);
    check((await log()).texts.some(t => t.includes("淵の水を巻き上げた")), "潜った次のターンに大波が無い");
    await game.shot("lord-dive");
    // 倒す（潜っていないターンに）
    for (let i = 0; i < 4 && (await boss()).states.includes(STATE.dive); i++) { await heal(); await turn(["guard", "guard"]); }
    await game.eval(() => { $gameParty.members().forEach(a => a.recoverAll()); $gameTroop.members()[0].setHp(1); });
    await turn(["attack", "attack"]);
    await game.waitFor(() => !(SceneManager._scene instanceof Scene_Battle) || BattleManager.isBattleEnd() || $gameMessage.isBusy(), null, 60_000);
    await toMap();
    await finishEvent();
    const won = await game.eval(tr => ({ sw: $gameSwitches.value(157), defeated: Hai.Boss.defeated(tr), msgs: window.__log.msgs }), LORD.troop);
    check(won.sw && won.defeated, "沼主を倒したのに旗が立たない " + JSON.stringify(won));
    check(won.msgs.some(m => m.includes("石組みの口が見えた")), "勝ったときの文章が無い");
    check((await items("a", ARMOR.mirror)) === 1 && (await items("i", ITEM.beard)) === 1, "沼主の固定ドロップ（水鏡の護符・沼主の髭）が無い");
    // 水が引いて、淵の底の排水口まで歩ける（排水口の上に立って調べる）
    await go(POOL, LORD.x, LORD.y - 1, 2);
    for (let i = 0; i < 4; i++) check(await step(2), `引いた淵の底を歩けない ${JSON.stringify(await pos())}`);
    await game.shot("pool-drain");
    check((await talk()).join("").includes("淵の底の排水口"), "排水口の文章");
    console.log("  沼主：逃走・呑み込み（主を叩くと吐き出す）・雷のヒント・眠り・HP 30% で潜る／大波・撃破（スイッチ 157）・水鏡の護符と髭・排水口");

    // ===== 5. セーブ・ロード =====
    await go(VILLAGE, 30, 28, 2);
    await game.call("save", 1);
    await game.call("goToTitle");
    await game.waitScene("Scene_Title");
    await game.call("load", 1);
    await game.waitScene("Scene_Map");
    const loaded = await game.eval(() => ({
      map: $gameMap.mapId(), pos: window.__game.pos(), sw157: $gameSwitches.value(157), sw159: $gameSwitches.value(159),
      party: $gameParty.members().map(a => a.actorId()), stake: $gameSelfSwitches.value([71, $gameMap.eventIdXy(37, 29), "A"]),
      found: Hai.HiddenPassage.isFound(34, 4, 71),
    }));
    check(loaded.map === VILLAGE && loaded.pos.x === 30 && loaded.pos.y === 28 && loaded.sw157 && loaded.sw159 && loaded.party.includes(8) && loaded.stake && loaded.found,
      "ロードの後の状態 " + JSON.stringify(loaded));
    check(await game.call("canPass", SUNKEN.x, SUNKEN.top, 2), "ロードの後に浅瀬の板の道が歩けない");
    console.log("  セーブ・ロード：旗（157・159）・ルメの加入・歌の錠・見つけた隠し扉が残る");

    game.assertNoErrors();
  } finally {
    await game.close();
  }
});
