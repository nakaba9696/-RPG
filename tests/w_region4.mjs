// W10（#156）地域四の本道（docs/world.md 5.1–5.5・6.3・6.4・7.3・8.1、tools/maps/src/w10_*）の検査：
//   鉄の坑道 026 の東の坑道 → 境山の古道 050（80×60。思念・名札・上段の崖は綱が無いと上れない・崖の縁の石段で段 0 へ）→ 北の道で帝国の陣跡 051
//   → 名無しの頼み（変数 601）・名無し兵の手紙・鉤綱（スイッチ 312）・地下壕の扉は鍵が無いと開かない → 052：グィド（地下壕の鍵・家の手紙・砦へ）、ベルトランの記憶 3
//   → 053：骨拾いと名札三つでベルトランの形見（記憶 4）、鉄くず百で取り引きの帳面 → 050 の上段（綱を掛けて上る：ブルーノの記憶 3・赤い宝箱）
//   → 051 の地下壕（鍵）→ 鋳物場 090（トゥーラの記憶 2）→ 091：門の綱（スイッチ 614）・トゥーラの遺骸（親鐘の舌）・研究所の門
//   → 093：研究所の報告の写し（光を嫌う）・研究者の娘を倒す（スイッチ 605）→ 094：鋳物場の鐘（スイッチ 104・変数 101・4 つ目でスイッチ 105）・音叉
//   → 091 の名無しに記録を渡し「イルゼ」と書く（スイッチ 610）→ 隠し扉の奥の搬入路で坑道・下層 027（H34）
//   → 050 の南の下り道 → 054：薄い思念 F08・東門の閂（スイッチ 617・174）→ 019 の城壁 → 砦 010。019 の東門から 054 へも出られる。
// シンボル敵は検査の邪魔にならないよう、マップに入るたびに「倒した」ことにする（セルフスイッチ A）。
import { launchGame, check, runTest } from "./lib.mjs";
import { checkAll } from "../tools/data/check.mjs";

const MINE = 26, DEPTHS = 27, RIDGE = 50, CAMP = 51, BEACON = 52, BONE = 53, EAST = 54, DOCK = 90, HALL = 91, LAB = 93, BELL = 94, RAMPART = 19, FORT = 10;
const ITEM = { bunkerKey: 601, grapple: 602, soldierLetter: 603, labReport: 604, dutyTag: 605, tongue: 606, tradeLedger: 608, guidoLetter: 609, nameTag: 328 };
const WEAPON = { spear: 601 };
const ARMOR = { fork: 601 };
const SW = { guido: 602, daughter: 605, namelessSat: 610, swordTraded: 611, ledgerRead: 612, labGate: 614, eastGate: 617, chute: 618, hook: 619, grapple: 312, bellFoundry: 104, bellsAll: 105, eastGateFort: 174 };
const VAR = { nameless: 601, bells: 101, survivors: 103 };
const DAUGHTER_TROOP = 612;
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

    // ===== 1. 坑道 026 の東の坑道 → 境山の古道 050 =====
    await go(MINE, 58, 16, 6);
    await step(6);
    await arrive(RIDGE, 1, 18);
    await game.shot("ridge-arrive");
    const ridge = await game.eval(() => ({ w: $dataMap.width, h: $dataMap.height, name: $gameMap.displayName(), ash: Hai.MapTone.ash() }));
    check(ridge.w === 80 && ridge.h === 60 && ridge.name === "境山の古道" && ridge.ash && ridge.ash.power === 4, "尾根道の大きさ・灰 " + JSON.stringify(ridge));
    await go(RIDGE, 3, 17, 8);
    check((await talk()).join("").includes("東の字の上にだけ"), "古い道標");
    // 上段の崖：鉤綱が無いと上れない
    await go(RIDGE, 16, 14, 8);
    check((await talk()).join("").includes("綱を掛ければ"), "鉤綱の無いときの崖の文章");
    check(!(await step(8)), "鉤綱が無いのに上段へ上れた");
    // 崖の縁の石段で段 0（戦場の跡）へ
    await go(RIDGE, 14, 32, 2);
    check(await step(2), "崖の縁の石段を下りられない");
    check(await step(2), "石段の下の段 0 へ出られない " + JSON.stringify(await pos()));
    await go(RIDGE, 12, 45, 8);
    check((await talk()).join("").includes("隣の奴に聞いた"), "R4-01 の本文");
    await go(RIDGE, 6, 41, 8);
    await talk();
    check((await items("i", ITEM.nameTag)) === 1, "戦場の跡で砦の名札が拾えない");
    await go(RIDGE, 55, 1, 8);
    await step(8);
    await arrive(CAMP, 25, 38);
    console.log("  尾根道：80×60・道標・綱の無い崖・崖の縁の石段・R4-01・名札 → 北の道で陣跡");

    // ===== 2. 帝国の陣跡 051 =====
    await game.shot("camp-arrive");
    await go(CAMP, 28, 12, 8);
    const nameless = (await talk(["引き受ける"])).join("\n");
    check(nameless.includes("観察の記録") && (await vr(VAR.nameless)) === 1, "名無しの頼み " + JSON.stringify(nameless));
    const errand1 = await game.eval(() => ({ e: Hai.Notes.errand("name"), v: $gameVariables.value(164) }));
    check(errand1.e && errand1.e.stage === 1 && errand1.v === 1, "頼みごとの一覧に「名を返す」が載らない " + JSON.stringify(errand1));
    await go(CAMP, 14, 23, 8);
    await talk();
    check((await items("i", ITEM.soldierLetter)) === 1, "名無し兵の手紙");
    await go(CAMP, 46, 23, 8);
    await talk();
    check((await items("i", ITEM.grapple)) === 1 && (await sw(SW.grapple)), "鉤綱（スイッチ 312）");
    await go(CAMP, 10, 4, 8);
    await talk();
    check(!(await step(8)), "鍵が無いのに地下壕の扉を通れた");
    await go(CAMP, 48, 18, 6);
    await step(6);
    await arrive(BEACON, 1, 14);
    console.log("  陣跡：名無しの頼み（変数 601）・手紙・鉤綱（スイッチ 312）・地下壕は鍵が無いと開かない → 吊り橋と烽火台");

    // ===== 3. 吊り橋と烽火台 052：グィド・ベルトランの記憶 3 =====
    await game.shot("beacon-arrive");
    const survivors0 = await vr(VAR.survivors);
    await go(BEACON, 10, 6, 8);
    const guido = (await talk()).join("\n");
    check(guido.includes("明日にしよう") && (await items("i", ITEM.bunkerKey)) === 1 && (await items("i", ITEM.guidoLetter)) === 1, "グィド " + JSON.stringify(guido));
    check((await sw(SW.guido)) && (await vr(VAR.survivors)) === survivors0 + 1, "グィドが砦へ（スイッチ 602・変数 103）");
    await go(BEACON, 33, 14, 8);
    check((await talk()).join("").includes("子どもの顔だった"), "ベルトランの記憶 3");
    check((await game.eval(() => Hai.Companions.memories(10))).includes(3), "ベルトランの記憶 3 が数えられない");
    await go(BEACON, 48, 8, 6);
    await step(6);
    await arrive(BONE, 1, 6);
    console.log("  吊り橋と烽火台：グィド（地下壕の鍵・家の手紙・砦へ）・ベルトランの記憶 3 → 骨拾いの洞");

    // ===== 4. 骨拾いの洞 053 =====
    await game.shot("bone-cave");
    await go(BONE, 12, 5, 6);
    check((await talk(["剣のこと"])).join("").includes("三つに足りて"), "名札が足りないときの骨拾い");
    await game.eval(id => $gameParty.gainItem($dataItems[id], 2), ITEM.nameTag);
    const trade = (await talk(["剣のこと", "名札を三つ渡す"])).join("\n");
    check(trade.includes("欠けておりません") && (await sw(SW.swordTraded)) && (await items("i", ITEM.nameTag)) === 0, "名札三つの取り引き " + JSON.stringify(trade));
    await go(BONE, 9, 9, 8);
    const sword = (await talk()).join("\n");
    check(sword.includes("名の壁の輪に置けば") && (await game.eval(() => Hai.Companions.found().includes(10) && Hai.Companions.memories(10).includes(4))), "ベルトランの形見と記憶 4 " + JSON.stringify(sword));
    await game.eval(() => $gameParty.gainGold(100));
    await go(BONE, 12, 5, 6);
    await talk(["帳面のこと", "百払う"]);
    check((await items("i", ITEM.tradeLedger)) === 1 && (await sw(SW.ledgerRead)), "取り引きの帳面");
    console.log("  骨拾い：名札三つでベルトランの形見（記憶 4）・鉄くず百で取り引きの帳面");

    // ===== 5. 尾根道の上段（綱を掛けて上る）=====
    await go(RIDGE, 16, 14, 8);
    await talk(["綱を掛ける"]);
    check(await sw(SW.hook), "綱を掛けてもスイッチ 619 が立たない");
    check((await step(8)) && (await step(8)), "掛けた綱を伝って上れない " + JSON.stringify(await pos()));
    check((await pos()).y === 12, "上段に着かない " + JSON.stringify(await pos()));
    await go(RIDGE, 8, 6, 8);
    check((await talk()).join("").includes("十二本目は"), "ブルーノの記憶 3");
    await go(RIDGE, 26, 5, 8);
    await talk();
    check((await items("w", WEAPON.spear)) === 1, "上段の赤い宝箱で古言兵の短槍");
    await game.shot("ridge-upper");
    console.log("  上段：綱（スイッチ 619）・ブルーノの記憶 3・古言兵の短槍");

    // ===== 6. 地下壕（鍵）→ 鋳物場 090 → 091 =====
    await go(CAMP, 10, 4, 8);
    check((await talk()).join("").includes("地下壕の鍵"), "鍵で地下壕の扉が開かない");
    await step(8);
    await arrive(DOCK, 8, 3);
    await game.shot("dock-arrive");
    await go(DOCK, 7, 26, 2);
    check((await talk()).join("").includes("自分で書いた"), "トゥーラの記憶 2");
    await go(DOCK, 38, 15, 6);
    await step(6);
    await arrive(HALL, 1, 21);
    await game.shot("hall-arrive");
    await go(HALL, 56, 5, 6);
    check(!(await step(6)), "綱を引く前に研究所の門を通れた");
    await finishEvent();
    await go(HALL, 5, 14, 8);
    await talk(["綱を引く"]);
    check(await sw(SW.labGate), "門の綱でスイッチ 614 が立たない");
    await go(HALL, 55, 17, 2);
    const tula = (await talk()).join("\n");
    check(tula.includes("かえりは") && (await items("i", ITEM.tongue)) === 1 && (await game.eval(() => Hai.Companions.found().includes(11))), "トゥーラの遺骸と親鐘の舌 " + JSON.stringify(tula));
    await go(HALL, 56, 5, 6);
    await step(6);
    await arrive(LAB, 1, 9);
    console.log("  地下壕 → 搬入口（トゥーラの記憶 2）→ 型の間：門の綱（スイッチ 614）・トゥーラの遺骸（親鐘の舌）→ 研究所");

    // ===== 7. 研究所の奥 093：報告の写し・研究者の娘 =====
    await game.shot("lab");
    await go(LAB, 5, 6, 8);
    const report = (await talk()).join("\n");
    check(report.includes("光を嫌う") && report.includes("年を取らない") && (await items("i", ITEM.labReport)) === 1, "研究所の報告の写し " + JSON.stringify(report));
    check(await game.eval(() => Hai.Thoughts.notes("clue").some(n => n.text.includes("光を嫌う"))), "光を嫌う、がメモに無い");
    await go(LAB, 19, 5, 8);
    await game.press("Enter");
    const t0 = Date.now();
    while ((await game.call("scene")) !== "Scene_Battle") {
      if (await game.eval(() => $gameMessage.isBusy())) { await game.frames(12); await game.press("Enter"); } else await game.frames(2);
      check(Date.now() - t0 < 60_000, "研究者の娘に話しかけても戦闘にならない");
    }
    check(await game.eval(id => $gameTroop.troop().id === id, DAUGHTER_TROOP), "研究者の娘の敵グループではない");
    await waitInput();
    await game.call("strengthenParty");
    await game.eval(() => $gameTroop.members().forEach(e => e.setHp(1)));
    for (let i = 0; i < 3 && (await game.eval(() => SceneManager._scene instanceof Scene_Battle && !$gameTroop.isAllDead())); i++) await turn(["attack", "attack", "attack", "attack"]);
    await toMap();
    await finishEvent();
    check((await sw(SW.daughter)) && (await game.eval(() => Hai.Boss.lastResult())) === 0, "研究者の娘を倒した旗（スイッチ 605）");
    await go(LAB, 19, 2, 8);
    await step(8);
    await arrive(BELL, 13, 24);
    console.log("  研究所：報告の写し（光を嫌う・墓守の一行）・研究者の娘を倒す（スイッチ 605）→ 鐘の間");

    // ===== 8. 鋳物場の鐘 094（4 つ目の鐘にする）=====
    await game.shot("bell-room");
    await game.eval(id => $gameVariables.setValue(id, 3), VAR.bells);
    await go(BELL, 13, 8, 8);
    const ring = (await talk(["綱を引く"])).join("\n");
    check(ring.includes("鐘が鳴る"), "鐘を鳴らす場面 " + JSON.stringify(ring));
    const bell = await game.eval(([a, b, c, t]) => ({ rung: $gameSwitches.value(a), count: $gameVariables.value(b), all: $gameSwitches.value(c), tag: $gameParty.numItems($dataItems[t]) }), [SW.bellFoundry, VAR.bells, SW.bellsAll, ITEM.dutyTag]);
    check(bell.rung && bell.count === 4 && bell.all && bell.tag === 1, "鋳物場の鐘（スイッチ 104・変数 101・4 つでスイッチ 105・当番の札） " + JSON.stringify(bell));
    check((await talk()).join("").includes("小さく震えて"), "鳴らした後の鐘の文章");
    await go(BELL, 16, 8, 8);
    await talk();
    check((await items("a", ARMOR.fork)) === 1, "調律師の音叉");
    await game.shot("bell-rung");
    console.log("  鋳物場の鐘：スイッチ 104・変数 101 = 4・スイッチ 105・当番の札・音叉");

    // ===== 9. 名無しに記録を渡す（イルゼ）・搬入路（H34）=====
    await go(HALL, 8, 38, 8);
    const den = (await talk(["渡す", "「イルゼ」と書く"])).join("\n");
    const errand3 = await game.eval(() => Hai.Notes.errand("name"));
    check(errand3 && errand3.result === "done", "頼みごと「名を返す」が終わらない " + JSON.stringify(errand3));
    check(den.includes("番号で、書かれていた") && (await sw(SW.namelessSat)) && (await vr(VAR.nameless)) === 3 && (await items("i", ITEM.labReport)) === 0, "名無しの分かれ目（イルゼ） " + JSON.stringify(den));
    await go(HALL, 9, 11, 8);
    const hidden = (await inspectPlain()).join("");
    check(hidden.includes("隠し扉"), "搬入路の部屋の隠し扉が見つからない " + JSON.stringify(hidden));
    check((await step(8)) && (await step(8)), "隠し扉を通れない");
    await go(HALL, 6, 5, 8);
    await talk(["滑り降りる"]);
    await arrive(DEPTHS, 44, 10);
    check(await sw(SW.chute), "搬入路（スイッチ 618）");
    console.log("  名無し：記録を渡して「イルゼ」（スイッチ 610・変数 601 = 3）・隠し扉の奥の搬入路で坑道・下層（H34）");

    // ===== 10. 東門の外 054 → 城壁 019 → 砦 =====
    await go(RIDGE, 61, 58, 2);
    await step(2);
    await arrive(EAST, 38, 11);
    await game.shot("east-gate");
    await go(EAST, 7, 12, 8);
    const f08 = (await talk()).join("\n");
    check(f08.includes("名札を") && (await game.eval(() => Hai.Thoughts.isFaint("F08"))), "薄い思念 F08 " + JSON.stringify(f08));
    await go(EAST, 20, 6, 8);
    await talk(["閂を外す"]);
    check((await sw(SW.eastGate)) && (await sw(SW.eastGateFort)), "東門の閂（スイッチ 617・174）");
    await step(8);
    await arrive(RAMPART, 30, 9);
    await game.shot("rampart");
    await go(RAMPART, 30, 9, 2);
    await step(2);
    await arrive(EAST, 20, 6);
    await go(RAMPART, 2, 8, 4);
    await step(4);
    await game.waitFor(() => window.__game.mapId() === 10 && !window.__game.isBusy());
    console.log("  東門の外：F08・閂（スイッチ 617・174）→ 城壁 019 → 砦。019 の東門からも 054 へ");

    // ===== 11. データの検査 =====
    const problems = checkAll();
    check(problems.length === 0, "データの検査で問題 " + JSON.stringify(problems.slice(0, 5)));
    game.assertNoErrors();
  } finally {
    await game.close();
  }
});
