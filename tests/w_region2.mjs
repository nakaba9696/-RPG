// W8（#155）地域二・焼けた村（docs/world.md 5.1・5.2・5.5・6.3・6.4・6.5・7.3、tools/maps/src/w8_*）の検査：
//   古い礼拝堂 021 の西の焼けた道 → 焼けた村・入口 060：戸板の盾・R2-01・ノラの記憶 1・畑の盛り土（ノラがいないと掘れない）
//   → 広場 061：アンネリーゼの頼み（弟を連れて帰る。変数 401）・触れ書き（ノラの記憶 3）・R2-06 の手がかり・生け垣の奥の見えない通路の先の赤い宝箱
//   → 見張り台 062：ノラの遺骸（記憶 4・スイッチ 132）・薄い思念 F06（記憶が戻る）・梁（鉤綱が無いと上れない）
//   → 祠 063：生贄の帳面・ノラの記憶 2（4 つ揃って完全体）・祠の経典 → 西の戸 → 抜け道 064：H22 の閂（スイッチ 404）→ 営倉 033 と行き来
//   → 060 のルッツに帳面を見せる（変数 401 = 2・スイッチ 402）→ アンネリーゼが砦へ（スイッチ 401・変数 103）
//   → 生贄の祠の番：帳面で「名を呼ばれた」（ステート 421）、倒すと旗（スイッチ 405）と肩布、奥の戸 → 麦の街道 110（W12 で 080 から差し替え）→ データの検査が通る。
// シンボル敵は検査の邪魔にならないよう、マップに入るたびに「倒した」ことにする（セルフスイッチ A）。
import { launchGame, check, runTest } from "./lib.mjs";
import { checkAll } from "../tools/data/check.mjs";

const CHAPEL = 21, GATE = 60, SQUARE = 61, TOWER = 62, SHRINE = 63, TUNNEL = 64, CELLS = 33, STREET = 110;
const ITEM = { ledger: 421, scripture: 422, rationTag: 423 };
const ARMOR = { doorShield: 421, ashShawl: 423 };
const WEAPON = { hunterSpear: 421 };
const SW = { annelise: 401, brotherHome: 402, h22: 404, shrineBoss: 405, nightDoorAnswered: 412, nightDoorLegacy: 413, noraFound: 132 };
const VAR = { brother: 401, survivors: 103 };
const NORA = 6, BOSS_TROOP = 441, NAMED = 421;
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
    const spoken = []; // 出た文章の［名前, 本文］（W20：話し手の名を見る）
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
            speaker: $gameMessage.speakerName(),
            choices: $gameMessage.choices(),
          };
        });
        if (!st.running) break;
        spoken.push([st.speaker, st.text]);
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

    // ===== 1. 古い礼拝堂の西の焼けた道 → 焼けた村・入口 060 =====
    await go(CHAPEL, 1, 8, 4);
    await step(4);
    await arrive(GATE, 47, 18);
    await game.shot("gate-arrive");
    const gateInfo = await game.eval(() => ({ w: $dataMap.width, h: $dataMap.height, name: $gameMap.displayName() }));
    check(gateInfo.w === 50 && gateInfo.h === 36 && gateInfo.name === "焼けた村", "焼けた村・入口の大きさ・表示名 " + JSON.stringify(gateInfo));
    await go(GATE, 41, 25, 8);
    const shield = (await talk()).join("\n");
    check(shield.includes("戸板") && (await items("a", ARMOR.doorShield)) === 1, "入口の家で戸板の盾が手に入らない " + JSON.stringify(shield));
    await go(GATE, 39, 26, 4);
    check((await talk()).join("").includes("戸に背中をつけて"), "R2-01 の本文");
    // W20（#264。R2 気になる 12）：夜の戸の影を倒したあとは「崩れる → 声（話し手の名つき）」の順。影は倒しても自分では一行を出さない
    await go(GATE, 42, 23, 8);
    const shadeId = await game.eval(() => $gameMap.events().find(e => e.event().name === "声だけの影（焼けた村の子）").eventId());
    await game.eval(id => $gameSelfSwitches.setValue([60, id, "A"], false), shadeId); // calm() が倒した扱いにした影を戻す
    const door = (await talk(["答える"])).join("\n");
    check(door.includes("おかあ、戸、こたえていい？") && door.includes("声の形だった") && !door.includes("崩れる") && (await sw(SW.nightDoorAnswered)), "夜の戸で答える（スイッチ 412） " + JSON.stringify(door));
    check(await game.eval(id => Hai.SymbolEnemy.isShadeQuiet($gameMap.event(id)), shadeId), "夜の戸の影に <hai_enemy_shade_quiet> が無い");
    spoken.length = 0;
    await game.eval(id => $gameSelfSwitches.setValue([60, id, "A"], true), shadeId); // 影を倒したことにする
    await game.waitFor(() => $gameMap.isEventRunning());
    await talk([], false);
    const iFall = spoken.findIndex(([, t]) => t.includes("崩れるときに、声が落ちた"));
    const iVoice = spoken.findIndex(([n, t]) => n === "焼けた村の子" && t.includes("おねえちゃん、三つしか叩かなかったよ。おかあ"));
    const iLedger = spoken.findIndex(([, t]) => t.includes("届けた相手の欄は、空けた"));
    check(iFall >= 0 && iVoice > iFall && iLedger > iVoice && (await sw(SW.nightDoorLegacy)) && (await game.eval(() => Hai.Thoughts.isRead("L2-01"))),
      "夜の戸の後は「崩れる → 声（焼けた村の子）→ 帳面」の順・スイッチ 413・L2-01 " + JSON.stringify(spoken));
    await go(GATE, 28, 25, 8);
    check((await talk()).join("").includes("追い込み"), "ノラの記憶 1");
    await go(GATE, 12, 29, 8);
    check((await talk()).join("").includes("鼻の利く者"), "ノラがいないのに盛り土を掘れた");
    await go(GATE, 25, 1, 8);
    await step(8);
    await arrive(SQUARE, 35, 46);
    console.log("  焼けた村・入口：戸板の盾・R2-01・ノラの記憶 1・盛り土（掘れない）→ 北の道で広場へ");

    // ===== 2. 広場 061：アンネリーゼの頼み・触れ書き・見えない通路の先 =====
    await game.shot("square-arrive");
    await go(SQUARE, 56, 20, 8);
    const anne = (await talk()).join("\n");
    check(anne.includes("ルッツ") && (await vr(VAR.brother)) === 1, "アンネリーゼの頼み（変数 401 = 1） " + JSON.stringify(anne));
    const errand = await game.eval(() => ({ e: Hai.Notes.errand("brother"), v: $gameVariables.value(161) }));
    check(errand.e && errand.e.stage === 1 && errand.e.title === "弟を連れて帰る" && errand.v === 1, "頼みごと「弟を連れて帰る」が一覧に無い（変数 161） " + JSON.stringify(errand));
    await go(SQUARE, 31, 16, 8);
    check((await talk()).join("").includes("代わりに、その妹が"), "触れ書きのノラの記憶 3");
    await go(SQUARE, 13, 20, 8);
    await talk();
    check(await game.eval(() => Hai.Thoughts.notes("clue").some(n => n.text.includes("生け垣の奥"))), "R2-06 の手がかりがメモに無い");
    await go(SQUARE, 10, 41, 4);
    for (let i = 0; i < 3; i++) check(await step(4), `生け垣の見えない通路を抜けられない ${JSON.stringify(await pos())}`);
    await go(SQUARE, 5, 40, 4);
    await talk();
    check((await items("w", WEAPON.hunterSpear)) === 1, "生け垣の奥の赤い宝箱で使徒狩りの投げ槍が手に入らない");
    await game.shot("square-hedge");
    await go(SQUARE, 9, 8, 8);
    await step(8);
    await arrive(TOWER, 13, 12);
    console.log("  広場：アンネリーゼの頼み・ノラの記憶 3・R2-06 の手がかり・見えない通路の先の投げ槍 → 見張り台へ");

    // ===== 3. 見張り台 062：ノラの遺骸・F06 =====
    await game.shot("tower");
    await go(TOWER, 13, 7, 8);
    const nora = (await talk()).join("\n");
    check(nora.includes("火は上がった") && nora.includes("名の壁の輪に置けば、この人を呼べる。"), "ノラの遺骸と記憶 4 " + JSON.stringify(nora));
    check((await sw(SW.noraFound)) && (await game.eval(n => Hai.Companions.memories(n), NORA)).includes(4), "ノラの遺骸（スイッチ 132）と記憶 4");
    await go(TOWER, 16, 12, 8);
    const f06 = (await talk()).join("\n");
    check(f06.includes("勝った") && f06.includes("覚えている"), "伝令の子の薄い思念 F06 と記憶が戻る一言 " + JSON.stringify(f06));
    check(await game.eval(() => Hai.Thoughts.isFaint("F06") && Hai.Thoughts.faintCount() === 1), "F06 が戻った記憶に数えられない");
    await go(TOWER, 19, 9, 8);
    check((await talk()).join("").includes("綱を掛ければ"), "鉤綱が無いのに梁に上れた");
    await go(TOWER, 13, 15, 2);
    await step(2);
    await arrive(SQUARE, 9, 8);

    // ===== 4. 祠 063：帳面・記憶 2・経典 → 抜け道 064 の H22 =====
    await go(SQUARE, 35, 6, 8);
    await step(8);
    await arrive(SHRINE, 13, 16);
    await game.shot("shrine");
    await go(SHRINE, 18, 7, 8);
    const ledger = (await talk()).join("\n");
    check((await items("i", ITEM.ledger)) === 1, "祠で生贄の帳面が手に入らない " + JSON.stringify(ledger));
    check(await game.eval(() => Hai.Thoughts.notes("clue").some(n => n.text.includes("済の印が無い"))), "帳面の手がかりがメモに無い");
    await go(SHRINE, 17, 7, 8);
    const m2 = (await talk()).join("\n");
    check(m2.includes("桟を蹴った") && m2.includes("完全体"), "ノラの記憶 2 で完全体にならない " + JSON.stringify(m2));
    check(await game.eval(n => Hai.Companions.isComplete(n), NORA), "ノラが完全体にならない");
    await go(SHRINE, 9, 6, 8);
    await talk();
    check((await items("i", ITEM.scripture)) === 1, "祭壇で祠の経典が手に入らない");
    await go(SHRINE, 5, 10, 4);
    await step(4);
    await arrive(TUNNEL, 2, 7);
    await go(TUNNEL, 42, 7, 6);
    const bolt = (await talk(["閂を外す"])).join("\n");
    check((await sw(SW.h22)) && bolt.includes("房の並ぶ廊下"), "抜け道の閂（スイッチ 404） " + JSON.stringify(bolt));
    await step(6);
    await arrive(CELLS, 8, 9);
    await game.shot("h22-cells");
    await step(8);
    await arrive(TUNNEL, 41, 7);
    await go(TUNNEL, 2, 6, 4);
    await step(4);
    await arrive(SHRINE, 5, 10);
    console.log("  見張り台：ノラの遺骸・F06 → 祠：帳面・記憶 2（完全体）・経典 → 抜け道の閂で営倉と行き来（H22）");

    // ===== 5. 弟に帳面を見せる → アンネリーゼが砦へ =====
    await go(GATE, 17, 11, 4);
    const brother = (await talk(["生贄の帳面を見せる"])).join("\n");
    check(brother.includes("姉ちゃんの所に、帰る") && (await vr(VAR.brother)) === 2 && (await sw(SW.brotherHome)), "ルッツに帳面を見せる（変数 401 = 2・スイッチ 402） " + JSON.stringify(brother));
    const survivors0 = await vr(VAR.survivors);
    await go(SQUARE, 56, 20, 8);
    const anne2 = (await talk()).join("\n");
    check(anne2.includes("砦へ行く") && (await sw(SW.annelise)) && (await vr(VAR.survivors)) === survivors0 + 1, "アンネリーゼが砦へ（スイッチ 401・変数 103） " + JSON.stringify(anne2));
    await go(SQUARE, 54, 21, 8);
    check((await talk()).join("").includes("火を見てる"), "鍛冶小屋に戻ったルッツ");
    const done = await game.eval(() => Hai.Notes.errand("brother"));
    check(done && done.result === "done", "頼みごと「弟を連れて帰る」が終わらない " + JSON.stringify(done));
    console.log("  ルッツに帳面を見せる → アンネリーゼが砦へ・ルッツは鍛冶小屋");

    // ===== 6. 生贄の祠の番 → 奥の戸 → 麦の街道（W12） =====
    await go(SHRINE, 13, 4, 8);
    check((await talk()).join("").includes("閂は、戸の外側にだけ"), "祠の番を越える前に奥の戸が開く");
    await go(SHRINE, 13, 6, 8);
    await game.press("Enter");
    const t0 = Date.now();
    const before = [];
    while ((await game.call("scene")) !== "Scene_Battle") {
      if (await game.eval(() => $gameMessage.isBusy())) {
        await game.frames(12);
        const t = await game.eval(() => $gameMessage.allText());
        if (before[before.length - 1] !== t) before.push(t);
        await game.press("Enter");
      } else await game.frames(2);
      check(Date.now() - t0 < 60_000, "祠の番に話しかけても戦闘にならない");
    }
    // W20（#264。R2 気になる 13）：「番の口が、止まった。」は戦いの頭の頁だけ（戦いの前の読み上げでは出さない）
    check(before.some(t => t.includes("イーダ。印、済")) && !before.some(t => t.includes("番の口が、止まった。")), "戦いの前の読み上げ " + JSON.stringify(before));
    check(await game.eval(id => $gameTroop.troop().id === id, BOSS_TROOP), "祠の番の敵グループではない");
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
    check(await game.eval(s => $gameTroop.members()[0].isStateAffected(s), NAMED), "帳面を持って挑んでも「名を呼ばれた」にならない");
    await game.call("strengthenParty");
    await game.eval(() => $gameTroop.members().forEach(e => e.setHp(1)));
    for (let i = 0; i < 3 && (await game.eval(() => SceneManager._scene instanceof Scene_Battle && !$gameTroop.isAllDead())); i++) await turn(["attack", "attack", "attack", "attack"]);
    await toMap();
    await finishEvent();
    const won = await game.eval(([s, a]) => ({ sw: $gameSwitches.value(s), shawl: $gameParty.numItems($dataArmors[a]), result: Hai.Boss.lastResult() }), [SW.shrineBoss, ARMOR.ashShawl]);
    check(won.sw && won.shawl === 1 && won.result === 0, "祠の番を倒した後の旗と肩布 " + JSON.stringify(won));
    await go(SHRINE, 13, 4, 8);
    await step(8);
    await arrive(STREET, 2, 31);
    await game.shot("street-arrive");
    console.log("  生贄の祠の番：名を呼ばれた（帳面）→ 倒す（スイッチ 405・肩布）→ 奥の戸で麦の街道へ");

    // ===== 7. データの検査 =====
    const problems = checkAll();
    check(problems.length === 0, "データの検査で問題 " + JSON.stringify(problems.slice(0, 5)));
    game.assertNoErrors();
  } finally {
    await game.close();
  }
});
