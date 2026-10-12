// W7（#145）地域一の寄り道と山場（docs/world.md 3.5・4.3・5.5・6.4・7.1・7.3、tools/maps/src/w7_*）の検査：
//   1. 小鐘が無いと霧の壁に戻される → 見張り塔の小鐘で霧が引く（スイッチ 301）→ 霧の奥 024。
//   2. ヴォルフラム（砦へ：スイッチ 306・変数 103・食堂・鐘喰いの護符）、R1-12 の手がかり、霧の抜け道（スイッチ 302）で 020 と行き来。
//   3. 鐘を抱く女の像の台（夕べの数。違う数では開かず、30 で開く。スイッチ 311）。
//   4. 坑道の大扉：一人では動かない → ブルーノを呼ぶと押せる（スイッチ 304）→ 長屋：鐘鉄の塊・トゥーラの記憶 1。
//   5. 坑道の門 028：坑夫の頭の薄い思念 F03（初めてだけ一言。読み直すと出ない）。
//   6. 牢番：戦闘の頭の名前、逃げると廊下の控え、油の壺（炎）で弱点のヒントとメモ、倒すと鍵束と旗。
//   7. セーブ・ロードで旗と持ち物が残る。
// 乱数（Math.random）は固定する（逃走の成否と行動の選び方）。
import { launchGame, check, runTest } from "./lib.mjs";

const FOREST = 20, CHAPEL = 21, MIST = 24, DEPTHS = 27, GATE = 28, HALL = 34, WARDEN_ROOM = 35;
const ITEM = { keyRing: 321, bellIron: 327, oil: 332, elixir: 198 };
const ARMOR = { smallBell: 321, bellCharm: 323 };
const SW = { fog: 301, fogPath: 302, bigDoor: 304, wolfram: 306, statue: 311, warden: 151, kitchen: 122 };
const VAR = { survivors: 103 };
const WARDEN_TROOP = 335, WARDEN_ENEMY = 335, FIRE = 2;
const NAME_LINE = "――牢番――";
const HINT = "牢番は炎に弱いようだ。";
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


    // ===== 1. 霧の壁 =====
    await go(CHAPEL, 27, 6, 8);
    check((await talk()).join("").includes("知らない名だ"), "小鐘が無いのに霧の壁の先へ行けそう");
    await go(FOREST, 12, 35, 8);
    await talk();
    check((await items("a", ARMOR.smallBell)) === 1, "見張り塔の小鐘が拾えない");
    await go(CHAPEL, 27, 6, 8);
    const fog = (await talk(["小鐘を鳴らす"])).join("\n");
    check(fog.includes("霧が、音のした方へ引いていった") && (await sw(SW.fog)), "小鐘で霧が引かない（スイッチ 301） " + JSON.stringify(fog));
    await game.frames(90);
    check((await game.eval(() => Hai.MapTone.fog().density)) <= 60, "小鐘を鳴らしても霧が薄くならない");
    await game.shot("fog-cleared");
    for (let i = 0; i < 6; i++) await step(8);
    await arrive(MIST, 20, 28);
    await game.shot("deep-mist");
    console.log("  霧の壁：小鐘が無いと戻される → 小鐘で霧が引く（スイッチ 301）→ 霧の奥");

    // ===== 2. ヴォルフラム・霧の抜け道 =====
    await go(MIST, 19, 12, 8);
    const wolf = (await talk()).join("\n");
    check(wolf.includes("鍋を見なかったか") && wolf.includes("鐘喰いの護符を手に入れた"), "ヴォルフラムの台詞 " + JSON.stringify(wolf));
    const wf = await game.eval(([a, b, c, d]) => ({ sw: $gameSwitches.value(a), survivors: $gameVariables.value(b), kitchen: $gameSwitches.value(c), charm: $gameParty.numItems($dataArmors[d]) }), [SW.wolfram, VAR.survivors, SW.kitchen, ARMOR.bellCharm]);
    check(wf.sw && wf.survivors === 1 && wf.kitchen && wf.charm === 1, "ヴォルフラムが砦へ（スイッチ 306・変数 103・食堂・護符） " + JSON.stringify(wf));
    check(await game.call("canPass", 19, 12, 8), "ヴォルフラムが去った後も通れない");
    await go(MIST, 8, 7, 8);
    await talk();
    check(await game.eval(() => Hai.Thoughts.hasNote("clue:R1-12")), "R1-12 の手がかりがメモに無い");
    await go(MIST, 37, 6, 6);
    await talk(["布をたどる"]);
    await arrive(FOREST, 62, 10);
    check(await sw(SW.fogPath), "霧の抜け道でスイッチ 302 が立たない");
    await game.shot("fog-path");
    await go(FOREST, 63, 10, 6);
    await step(6);
    await arrive(MIST, 36, 6);
    console.log("  ヴォルフラム（スイッチ 306・変数 103・食堂・護符）・R1-12・霧の抜け道（スイッチ 302）で行き来");

    // ===== 3. 像の台（夕べの数）=====
    const elixir0 = await items("i", ITEM.elixir);
    await go(CHAPEL, 30, 16, 8);
    check((await talk([], true, [29])).join("").includes("元に戻った"), "違う数で像の台が開いた");
    check(!(await sw(SW.statue)), "違う数でスイッチ 311 が立った");
    await go(CHAPEL, 30, 16, 8);
    await talk([], true, [30]);
    check((await sw(SW.statue)) && (await items("i", ITEM.elixir)) === elixir0 + 1, "30 で像の台が開かない");
    console.log("  像の台：29 では開かず、30 で開く（スイッチ 311・秘薬）");

    // ===== 4. 坑道の大扉（ブルーノ）→ 長屋 =====
    await go(DEPTHS, 11, 17, 4);
    check((await talk()).join("").includes("一人では動かない"), "一人で大扉が動いた");
    check(!(await sw(SW.bigDoor)), "一人でスイッチ 304 が立った");
    await game.eval(() => Hai.Companions.summon(5));
    await go(DEPTHS, 11, 17, 4);
    check((await talk()).join("").includes("いち、に、さん"), "ブルーノが大扉を押さない");
    check(await sw(SW.bigDoor), "大扉でスイッチ 304 が立たない");
    for (let i = 0; i < 2; i++) check(await step(4), "倒れた大扉を通れない");
    await go(DEPTHS, 3, 13, 8);
    await talk();
    check((await items("i", ITEM.bellIron)) === 1, "長屋の床下で鐘鉄の塊が手に入らない");
    await go(DEPTHS, 4, 23, 8);
    check((await talk()).join("").includes("鍋の底"), "トゥーラの記憶 1");
    check((await game.eval(() => Hai.Companions.memories(11))).includes(1), "トゥーラの記憶 1 が数えられない");
    await game.shot("row-houses");
    console.log("  大扉：一人では動かず、ブルーノで開く（スイッチ 304）→ 鐘鉄の塊・トゥーラの記憶 1");

    // ===== 5. 坑夫の頭の薄い思念 F03 =====
    await go(GATE, 9, 9, 8);
    const f03 = (await talk()).join("\n");
    check(f03.includes("女が立つまで") && f03.includes("覚えている"), "F03 と記憶が戻る一言 " + JSON.stringify(f03));
    check(await game.eval(() => Hai.Thoughts.faintCount() === 1 && $gameVariables.value(138) === 1), "F03 で戻った記憶が 1 にならない");
    const again = (await talk()).join("\n");
    check(!again.includes("覚えている") && again.includes("（読んだ）"), "読み直しで一言がまた出る " + JSON.stringify(again));
    console.log("  坑道の門：F03（初めてだけ一言）");

    // ===== 6. 牢番 =====
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
    const startFight = async () => {
      await go(WARDEN_ROOM, 13, 8, 8);
      await game.eval(() => { $gameParty.members().forEach(a => a.recoverAll()); window.__log.msgs = []; window.__log.texts = []; });
      await game.press("Enter");
      const t0 = Date.now();
      while ((await game.call("scene")) !== "Scene_Battle") {
        if (await game.eval(() => $gameMessage.isBusy())) { await game.frames(12); await game.press("Enter"); } else await game.frames(2);
        check(Date.now() - t0 < 60_000, "牢番に話しかけても戦闘にならない");
      }
      await waitInput();
    };
    // 6a. 逃げる → 廊下の控え
    await startFight();
    check(await game.eval(id => $gameTroop.troop().id === id, WARDEN_TROOP), "牢番の敵グループではない");
    check((await log()).msgs.includes(NAME_LINE), "戦闘の頭に牢番の名前が出ない " + JSON.stringify((await log()).msgs));
    await game.shot("warden-battle");
    check(await game.eval(() => BattleManager.canEscape()), "牢番から逃げられない");
    await setRand(0.01);
    await game.eval(() => SceneManager._scene.commandEscape());
    await toMap();
    await setRand(0.5);
    await game.waitFor(m => window.__game.mapId() === m && !window.__game.isBusy(), HALL);
    await finishEvent();
    const esc = await game.eval(s => ({ pos: window.__game.pos(), result: Hai.Boss.lastResult(), sw: $gameSwitches.value(s) }), SW.warden);
    check(esc.pos.x === 22 && esc.pos.y === 25 && esc.result === 1 && !esc.sw, "逃げたときの場所と旗 " + JSON.stringify(esc));
    console.log(`  牢番から逃げる：控え (${esc.pos.x},${esc.pos.y})、スイッチ 151 は OFF`);
    // 6b. 油の壺で弱点 → 倒す
    await game.eval(id => $gameParty.gainItem($dataItems[id], 3), ITEM.oil);
    await startFight();
    await game.call("strengthenParty");
    await turn([{ item: ITEM.oil }, "guard", "guard", "guard"]);
    const texts = (await log()).texts;
    check(texts.filter(x => x === HINT).length === 1, "油の壺（炎）で弱点のヒントが出ない " + JSON.stringify(texts.slice(-8)));
    check(await game.eval(([e, f]) => Hai.Boss.knownWeak(e).includes(f), [WARDEN_ENEMY, FIRE]), "炎の弱点が記録されない");
    check(await game.eval(() => Hai.Thoughts.notes("clue").some(n => n.text.includes("牢番は炎に弱い"))), "弱点のメモが無い");
    await game.eval(() => { $gameParty.members().forEach(a => a.recoverAll()); $gameTroop.members()[0].setHp(1); });
    for (let i = 0; i < 3 && (await game.eval(() => SceneManager._scene instanceof Scene_Battle && $gameTroop.isAllDead() === false)); i++) await turn(["attack", "attack", "attack", "attack"]);
    await toMap();
    await finishEvent();
    const won = await game.eval(([s, k, tr]) => ({ sw: $gameSwitches.value(s), key: $gameParty.numItems($dataItems[k]), defeated: Hai.Boss.defeated(tr), msgs: window.__log.msgs }), [SW.warden, ITEM.keyRing, WARDEN_TROOP]);
    check(won.sw && won.key === 1 && won.defeated && won.msgs.some(t => t.includes("鍵の束だけが鳴った")), "牢番を倒した後 " + JSON.stringify({ ...won, msgs: won.msgs.slice(-4) }));
    console.log("  牢番：名前・炎のヒントとメモ・撃破（スイッチ 151・鍵束）");

    // ===== 7. セーブ・ロード =====
    await go(WARDEN_ROOM, 13, 10, 2);
    await game.call("save", 1);
    await game.call("goToTitle");
    await game.waitScene("Scene_Title");
    await game.call("load", 1);
    await game.waitScene("Scene_Map");
    const loaded = await game.eval(([s, i]) => ({
      map: $gameMap.mapId(), pos: window.__game.pos(), flags: s.map(id => $gameSwitches.value(id)), items: i.map(id => $gameParty.numItems($dataItems[id])),
      faint: Hai.Thoughts.faintCount(), bruno: $gameParty.members().some(a => a.actorId() === 5),
    }), [[SW.fog, SW.fogPath, SW.bigDoor, SW.wolfram, SW.statue, SW.warden], [ITEM.keyRing, ITEM.bellIron]]);
    check(loaded.map === WARDEN_ROOM && loaded.pos.x === 13 && loaded.pos.y === 10 && loaded.flags.every(Boolean) && loaded.items.every(n => n === 1) && loaded.faint === 1 && loaded.bruno,
      "ロードの後の状態 " + JSON.stringify(loaded));
    console.log("  セーブ・ロード：旗・鍵束・鐘鉄・戻った記憶・ブルーノが残る");

    game.assertNoErrors();
  } finally {
    await game.close();
  }
});
