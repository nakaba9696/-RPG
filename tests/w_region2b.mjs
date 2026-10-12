// W8（#155）地域二・記録院と森の療養小屋（docs/world.md 5.1・5.2・5.5・6.3・6.4・7.1・7.3・8.1、tools/maps/src/w8_*）の検査：
//   祠の奥の戸の先 → 記録院・前庭 080：イスメネの頼み（本物の写し。変数 402）・ディルの記憶 1・古言の碑の扉（ディルがいないと開かず、いると開く）
//   → 書架 081：ディルの記憶 2・写しの台帳・R2-18 の手がかり・番号錠（違う数では開かず、429 で開く。スイッチ 409）
//   → 封じた書架 082（暗がり。角灯で半径 5）：ディルの遺骸（記憶 4・スイッチ 133）・二通りの写し・札・見えない通路の先の H31 の閂（スイッチ 408）→ 納骨所 022 と行き来
//   → 真名の間 083：真名を読んだ学者（沈黙で魔法の技が封じられる）、倒すと旗（スイッチ 406）と栞・北の戸
//   → 記録院の鐘の間 084：ディルの記憶 3（完全体）、鐘の綱（スイッチ 102・変数 101。4 つ目ならスイッチ 105）・当番の札、帰りの転送陣で砦へ
//   → イスメネに写しを返し、イスメネが砦へ（スイッチ 407・書庫）→ 021 の東の見えない通路 → 森の療養小屋 023：ピピネルが砦へ（スイッチ 411）
//   → セーブ・ロードで旗と持ち物が残る → データの検査が通る。
import { launchGame, check, runTest } from "./lib.mjs";
import { checkAll } from "../tools/data/check.mjs";

const FORT = 10, CHAPEL = 21, OSSUARY = 22, HOSPICE = 23, COURT = 80, STACKS = 81, SEALED = 82, NAME_HALL = 83, BELL_ROOM = 84;
const ITEM = { twoCopies: 426, dutyTag: 429, lantern: 322, copyRegister: 424 };
const ARMOR = { bookmark: 425 };
const SW = { scholar: 406, ismene: 407, h31: 408, lock: 409, runeDoor: 410, pipinel: 411, dilFound: 133, archiveBell: 102, allBells: 105, lore: 124 };
const VAR = { copies: 402, bellCount: 101, survivors: 103 };
const DIL = 7, BOSS_TROOP = 442, SILENCE = 146, TRUE_NAME = 432;
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

    // 祠の番は w_region2 で倒す。ここでは倒した後から始める（スイッチ 405）。暗がりのために鐘番の角灯を持たせる。
    await game.eval(([s, l]) => { $gameSwitches.setValue(s, true); $gameParty.gainItem($dataItems[l], 1); }, [405, ITEM.lantern]);

    // ===== 1. 記録院・前庭 080 =====
    await go(COURT, 19, 27, 8);
    await game.shot("court");
    await go(COURT, 24, 18, 8);
    const ism = (await talk()).join("\n");
    check(ism.includes("記録します") && (await vr(VAR.copies)) === 1, "イスメネの頼み（変数 402 = 1） " + JSON.stringify(ism));
    await go(COURT, 4, 9, 8);
    check((await talk()).join("").includes("濡れて捨てられた本"), "ディルの記憶 1");
    await go(COURT, 32, 20, 6);
    check((await talk()).join("").includes("読める者なら"), "ディルがいないのに古言の碑の扉が開いた");
    await game.eval(a => $gameParty.addActor(a), DIL);
    const rune = (await talk()).join("\n");
    check(rune.includes("訳すと") && (await sw(SW.runeDoor)), "ディルで古言の碑の扉が開かない（スイッチ 410） " + JSON.stringify(rune));
    check(await step(6), "開いた古言の碑の扉を通れない");
    await game.eval(a => $gameParty.removeActor(a), DIL);
    await go(COURT, 19, 1, 8);
    await step(8);
    await arrive(STACKS, 29, 42);
    console.log("  前庭：イスメネの頼み・ディルの記憶 1・古言の碑の扉（ディル）→ 書架へ");

    // ===== 2. 書架 081：記憶 2・台帳・錠 =====
    await game.shot("stacks");
    await go(STACKS, 11, 6, 8);
    check((await talk()).join("").includes("一頁に一字"), "ディルの記憶 2");
    await go(STACKS, 6, 10, 8);
    await talk();
    check((await items("i", ITEM.copyRegister)) === 1, "写字台で写しの台帳が手に入らない");
    await go(STACKS, 9, 12, 8);
    await talk();
    check(await game.eval(() => Hai.Thoughts.notes("clue").some(n => n.text.includes("4・2・9"))), "錠の数の手がかりがメモに無い");
    await go(STACKS, 30, 4, 8);
    const wrong = (await talk(["数を合わせる"], true, [111])).join("\n");
    check(wrong.includes("錠は動かない") && !(await sw(SW.lock)), "違う数で錠が開いた " + JSON.stringify(wrong));
    const right = (await talk(["数を合わせる"], true, [429])).join("\n");
    check(right.includes("錠が外れた") && (await sw(SW.lock)), "429 で錠が開かない（スイッチ 409） " + JSON.stringify(right));
    await step(8);
    await arrive(SEALED, 20, 27);
    console.log("  書架：ディルの記憶 2・写しの台帳・錠の手がかり・番号錠（429）→ 封じた書架へ");

    // ===== 3. 封じた書架 082：暗がり・ディルの遺骸・写し・H31 =====
    await game.frames(10);
    const dark = await game.eval(() => Hai.MapTone.dark());
    check(dark && dark.radius === 5, "角灯を持って封じた書架に入っても暗がりが広がらない " + JSON.stringify(dark));
    await game.shot("sealed");
    await go(SEALED, 33, 9, 8);
    const dil = (await talk()).join("\n");
    check(dil.includes("あと一行") && dil.includes("名の壁の輪に置けば、この人を呼べる。"), "ディルの遺骸と記憶 4 " + JSON.stringify(dil));
    check((await sw(SW.dilFound)) && (await game.eval(n => Hai.Companions.memories(n), DIL)).includes(4), "ディルの遺骸（スイッチ 133）と記憶 4");
    await go(SEALED, 34, 9, 8);
    await talk();
    check((await items("i", ITEM.twoCopies)) === 1, "二通りの写しが手に入らない");
    await go(SEALED, 22, 4, 8);
    check((await talk()).join("").includes("声を出させるな"), "北の戸の脇の札");
    await go(SEALED, 14, 13, 4);
    for (let i = 0; i < 2; i++) check(await step(4), `封じた書架の見えない通路を抜けられない ${JSON.stringify(await pos())}`);
    await go(SEALED, 7, 13, 4);
    const h31 = (await talk(["閂を外す"])).join("\n");
    check(h31.includes("棺の並ぶ部屋") && (await sw(SW.h31)), "帳面の棚の裏の戸の閂（スイッチ 408） " + JSON.stringify(h31));
    await step(4);
    await arrive(OSSUARY, 13, 10);
    await game.shot("h31-ossuary");
    await step(4);
    await arrive(SEALED, 7, 13);
    await go(SEALED, 20, 1, 8);
    await step(8);
    await arrive(NAME_HALL, 13, 14);
    console.log("  封じた書架：角灯で半径 5・ディルの遺骸・二通りの写し・札・H31 で納骨所と行き来 → 真名の間へ");

    // ===== 4. 真名を読んだ学者 =====
    await go(NAME_HALL, 13, 4, 8);
    check((await talk()).join("").includes("読み続けている"), "学者を越える前に北の戸が開く");
    await go(NAME_HALL, 13, 9, 8);
    await game.press("Enter");
    const t0 = Date.now();
    while ((await game.call("scene")) !== "Scene_Battle") {
      if (await game.eval(() => $gameMessage.isBusy())) { await game.frames(12); await game.press("Enter"); } else await game.frames(2);
      check(Date.now() - t0 < 60_000, "学者に話しかけても戦闘にならない");
    }
    check(await game.eval(id => $gameTroop.troop().id === id, BOSS_TROOP), "学者の敵グループではない");
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
    await waitInput();
    const sil = await game.eval(([s, k]) => {
      const e = $gameTroop.members()[0];
      const before = e.canUse($dataSkills[k]);
      const rate = e.stateRate(s);
      e.addState(s);
      const after = e.canUse($dataSkills[k]);
      e.removeState(s);
      return { before, after, rate };
    }, [SILENCE, TRUE_NAME]);
    check(sil.before && !sil.after && sil.rate >= 2, "沈黙で学者の真名の読み上げが封じられない " + JSON.stringify(sil));
    await game.call("strengthenParty");
    await game.eval(() => $gameTroop.members().forEach(e => e.setHp(1)));
    for (let i = 0; i < 3 && (await game.eval(() => SceneManager._scene instanceof Scene_Battle && !$gameTroop.isAllDead())); i++) await turn(["attack", "attack", "attack", "attack"]);
    await toMap();
    await finishEvent();
    const won = await game.eval(([s, a]) => ({ sw: $gameSwitches.value(s), bookmark: $gameParty.numItems($dataArmors[a]), result: Hai.Boss.lastResult() }), [SW.scholar, ARMOR.bookmark]);
    check(won.sw && won.bookmark === 1 && won.result === 0, "学者を倒した後の旗と栞 " + JSON.stringify(won));
    await go(NAME_HALL, 13, 4, 8);
    await step(8);
    await arrive(BELL_ROOM, 13, 18);
    console.log("  真名を読んだ学者：沈黙で真名の読み上げが封じられる → 倒す（スイッチ 406・栞）→ 鐘の間へ");

    // ===== 5. 記録院の鐘 =====
    await game.shot("bell-room");
    await go(BELL_ROOM, 7, 14, 8);
    const m3 = (await talk()).join("\n");
    check(m3.includes("確かめないことにした") && m3.includes("完全体"), "ディルの記憶 3 で完全体にならない " + JSON.stringify(m3));
    // ほかの三つを鳴らした後の 4 つ目として鳴らす（4 つ目でスイッチ 105）
    await game.eval(v => $gameVariables.setValue(v, 3), VAR.bellCount);
    await go(BELL_ROOM, 13, 8, 8);
    const ring = (await talk(["綱を引く"])).join("\n");
    check(ring.includes("鐘が鳴る"), "鐘を鳴らす場面 " + JSON.stringify(ring));
    const bell = await game.eval(([a, b, c, t]) => ({ rung: $gameSwitches.value(a), count: $gameVariables.value(b), all: $gameSwitches.value(c), tag: $gameParty.numItems($dataItems[t]) }), [SW.archiveBell, VAR.bellCount, SW.allBells, ITEM.dutyTag]);
    check(bell.rung && bell.count === 4 && bell.all && bell.tag === 1, "記録院の鐘（スイッチ 102・変数 101・4 つ目でスイッチ 105・当番の札） " + JSON.stringify(bell));
    const note = await game.eval(() => $dataMap.events.find(e => e && e.name === "記録院の鐘の綱").pages[0].list.some(c => c.code === 108 && c.parameters[0].startsWith("W11")));
    check(note, "鐘の綱に W11 の注釈が無い");
    await game.shot("bell-rung");
    await go(BELL_ROOM, 16, 8, 6);
    await step(6);
    await talk(["砦へ戻る"], false);
    await arrive(FORT, 25, 27);
    await game.shot("fort-return");
    console.log("  記録院の鐘：ディルの記憶 3（完全体）・スイッチ 102・変数 101・4 つ目でスイッチ 105・当番の札 → 転送陣で砦へ");

    // ===== 6. イスメネに写しを返す → 砦へ =====
    const survivors0 = await vr(VAR.survivors);
    await go(COURT, 24, 18, 8);
    const back = (await talk(["写しを返す"])).join("\n");
    check(back.includes("分からないので") && (await vr(VAR.copies)) === 2 && (await items("i", ITEM.twoCopies)) === 0, "イスメネに写しを返す（変数 402 = 2） " + JSON.stringify(back));
    check((await sw(SW.ismene)) && (await sw(SW.lore)) && (await vr(VAR.survivors)) === survivors0 + 1, "イスメネが砦へ（スイッチ 407・書庫・変数 103）");

    // ===== 7. 森の療養小屋 023：ピピネル =====
    await go(CHAPEL, 55, 31, 6);
    for (let i = 0; i < 3; i++) check(await step(6), `礼拝堂の東の見えない通路を抜けられない ${JSON.stringify(await pos())}`);
    await step(6);
    await arrive(HOSPICE, 1, 7);
    await game.shot("hospice");
    await go(HOSPICE, 18, 7, 8);
    const pip = (await talk()).join("\n");
    check(pip.includes("婆") && (await sw(SW.pipinel)) && (await vr(VAR.survivors)) === survivors0 + 2, "ピピネルが砦へ（スイッチ 411・変数 103） " + JSON.stringify(pip));
    console.log("  イスメネに写しを返す → 砦へ（書庫）・ピピネルが砦へ");

    // ===== 8. セーブ・ロード =====
    await game.call("save", 1);
    await game.call("goToTitle");
    await game.waitScene("Scene_Title");
    await game.call("load", 1);
    await game.waitScene("Scene_Map");
    const kept = await game.eval(ids => ids.map(i => $gameSwitches.value(i)), [SW.scholar, SW.ismene, SW.h31, SW.lock, SW.archiveBell, SW.pipinel]);
    check(kept.every(Boolean) && (await items("a", ARMOR.bookmark)) === 1, "セーブ・ロードで旗と持ち物が残らない " + JSON.stringify(kept));

    // ===== 9. データの検査 =====
    const problems = checkAll();
    check(problems.length === 0, "データの検査で問題 " + JSON.stringify(problems.slice(0, 5)));
    game.assertNoErrors();
  } finally {
    await game.close();
  }
});
