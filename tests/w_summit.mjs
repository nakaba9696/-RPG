// W14（#234）終盤の前半（docs/story/scenes/04-climax.md の 1〜4 章、tools/maps/src/w14_*）の通しの検査：
//   旗の束 bells2（営倉・記録院）から水底の鐘を 3 つ目に鳴らす → ブルーノの「三十です」と三つ目の場面の差し替えた行
//   → 旗の束 bells4（四つ鳴った）で砦 010 へ：伏せた椀に飯（1151）・ミルレーネが砦に来る（1152）・イスメネが写しを返す・墓所の壁の夜の文
//   → 019 の頂への門から 180 灰の斜面（着き場・ミルレーネの一言）→ ソレンヌ（1153）・使徒狩りの野営の跡・崖の縄で 054 へ下りて上る（1167）
//   → 181 鐘守の宿坊（宿帳 Items 1151・薄い思念 F11・橇）→ 182 足場の番（宿帳で「一晩のみ」・倒すと 1154）→ 183 鐘楼の根（石工の工具 Items 1152・綱を直す 1155）。
// 縄張り（170–173）の差し替えた文は w_last.mjs が見る。6 分以内。
import { launchGame, check, runTest } from "./lib.mjs";
import { checkAll } from "../tools/data/check.mjs";

const KEEP = 10, RAMPART = 19, WATER_BELL = 104, SLOPE = 180, LODGE = 181, SCAFFOLD = 182, ROOT = 183, EAST_GATE = 54, SUMMIT = 15;
const SW = { scene3: 106, metMirlene: 107, bowl: 1151, mirlene: 1152, sorenne: 1153, scaffold: 1154, rope: 1155, lucien: 1156, tongue: 1157, endured: 1158, sorenneAlive: 1166, ropeDown: 1167, ismene: 1170, timber: 1055 };
const VAR = { bells: 101, copies: 163, outsiders: 166, faint: 138 };
const ITEM = { ledger: 1151, tools: 1152, twoCopies: 426 };
const STATE_ONE_NIGHT = 1151;
const FAST = 16;
const MAP_SPEED = 4;

const T0 = Date.now();
await runTest(async () => {
  const game = await launchGame();
  try {
    const sw = id => game.eval(i => $gameSwitches.value(i), id);
    const vr = id => game.eval(i => $gameVariables.value(i), id);
    const pos = () => game.call("pos");
    async function calm() {
      await game.eval(() => {
        for (const ev of $gameMap.events()) if (ev.event().meta.hai_enemy) $gameSelfSwitches.setValue([$gameMap.mapId(), ev.eventId(), "A"], true);
      });
      await game.frames(2);
    }
    async function arrive(m, x, y, { quiet = true } = {}) {
      await game.waitFor(([m2, x2, y2]) => {
        const g = window.__game;
        const p = g.pos();
        return g.mapId() === m2 && (x2 === undefined || (p.x === x2 && p.y === y2)) && !g.isBusy();
      }, [m, x, y]);
      if (quiet) await calm();
    }
    async function go(m, x, y, d, opts) {
      await game.call("transfer", m, x, y, d);
      await arrive(m, x, y, opts);
    }
    async function step(d) {
      const moved = await game.call("step", d);
      if (moved) await game.waitPlayerStopped();
      return moved;
    }
    /** 文章を読み進め、選択肢は choices の順に選ぶ。イベントが止まって 10 フレーム動かなければ終わり（自動実行が続くときも拾う）。 */
    async function talk(choices = [], press = true) {
      const queue = choices.slice();
      if (press) await game.press("Enter");
      await game.waitFor(() => $gameMap.isEventRunning() || $gameMessage.isBusy() || window.__game.scene() !== "Scene_Map");
      const pages = [];
      const t0 = Date.now();
      let idle = 0;
      while (idle < 10) {
        check(Date.now() - t0 < 120_000, "イベントが終わらない " + JSON.stringify(pages.slice(-3)));
        const st = await game.eval(() => {
          const s = SceneManager._scene;
          const w = s && s._messageWindow;
          return {
            map: s instanceof Scene_Map,
            running: $gameMap.isEventRunning() || $gameMessage.isBusy() || window.__game.isBusy(),
            pause: !!(w && w.pause),
            choice: !!(w && w._choiceListWindow && w._choiceListWindow.active && w._choiceListWindow.isOpen()),
            text: $gameMessage.allText(),
            speaker: $gameMessage.speakerName(),
            choices: $gameMessage.choices(),
          };
        });
        if (!st.map) return pages; // 戦闘に入った
        if (!st.running) { idle++; await game.frames(1); continue; }
        idle = 0;
        if (st.choice) {
          pages.push((st.speaker ? st.speaker + "：" : "") + st.text + "［" + st.choices.join("／") + "］");
          const q = queue.shift() ?? 0;
          const i = typeof q === "string" ? st.choices.indexOf(q) : q;
          check(i >= 0 && i < st.choices.length, `選択肢「${q}」が無い ${JSON.stringify(st.choices)}`);
          await game.eval(n => SceneManager._scene._messageWindow._choiceListWindow.select(n), i);
          await game.frames(2);
          await game.press("Enter");
          await game.frames(4);
        } else if (st.pause) {
          pages.push((st.speaker ? st.speaker + "：" : "") + st.text);
          await game.frames(6);
          await game.press("Enter");
          for (let i = 0; i < 30; i++) {
            const moved = await game.eval(prev => !SceneManager._scene._messageWindow || !SceneManager._scene._messageWindow.pause || $gameMessage.allText() !== prev, st.text);
            if (moved) break;
            await game.frames(2);
          }
        } else {
          await game.frames(2);
        }
      }
      return pages;
    }
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
        check(Date.now() - t0 < 120_000, "入力の番にならない");
      }
    };
    const attackTurn = async () => {
      await game.call("setSpeed", FAST);
      await game.eval(() => {
        $gameParty.members().forEach(a => {
          if (!a.action(0) && a.canMove()) a.makeActions();
          const act = a.action(0);
          if (!a.canInput() || !act) return;
          act.setAttack();
          act.setTarget(0);
        });
        BattleManager.startTurn();
        SceneManager._scene.changeInputWindow();
      });
      await waitInput();
      await game.call("setSpeed", MAP_SPEED);
    };
    /** 戦闘の画面になるまで待ち、相手を弱らせて勝ち、マップへ戻る。戻ったあとの文章も読む。 */
    async function winBattle(troopId) {
      await game.waitFor(() => window.__game.scene() === "Scene_Battle", null, 60_000);
      if (troopId) check(await game.eval(id => $gameTroop.troop().id === id, troopId), `敵グループが ${troopId} ではない`);
      await waitInput();
      await game.call("strengthenParty");
      await game.eval(() => $gameTroop.members().forEach(e => e.setHp(1)));
      for (let i = 0; i < 4 && (await game.eval(() => SceneManager._scene instanceof Scene_Battle && !$gameTroop.isAllDead())); i++) await attackTurn();
      await game.call("setSpeed", FAST);
      await game.page.keyboard.down("Enter");
      try {
        await game.waitFor(() => window.__game.scene() === "Scene_Map", null, 120_000);
      } finally {
        await game.page.keyboard.up("Enter");
        await game.call("setSpeed", MAP_SPEED);
      }
      return talk([], false);
    }
    const has = id => game.eval(i => $gameParty.numItems($dataItems[i]), id);

    // ===== 1. 三つ目の鐘（水底）：ブルーノの一言と、場面の差し替えた行（場面表 1.1・1.2） =====
    const r = await game.call("setup", "bells2", { bells: ["archive"] });
    await game.waitScene("Scene_Map");
    await arrive(r.to.mapId, r.to.x, r.to.y);
    await game.call("setSpeed", MAP_SPEED);
    await go(WATER_BELL, 13, 8, 8);
    const third = (await talk(["綱を引く"])).join("\n");
    check(third.includes("ブルーノ：あなた。……三十です") && third.includes("墓守の指が、もう一本、動いた。"), "三つ目の鐘のあとのブルーノの一言 " + JSON.stringify(third).slice(0, 400));
    check(third.includes("数える。二十八、二十九、三十。") && third.includes("三十一人目は、まだ来ない。目を閉じた。") && !third.includes("最後の一人に渡し終えて"),
      "三つ目の場面の差し替えた行 " + JSON.stringify(third).slice(0, 800));
    check(third.includes("……喰わないために、預けたのか") && (await sw(SW.scene3)), "三つ目の場面の一言とスイッチ 106");
    console.log("  三つ目の鐘：ブルーノ「三十です」・場面の二行の差し替え", `（${Math.round((Date.now() - T0) / 1000)} 秒）`);

    // ===== 2. 砦 010（四つ鳴った）：椀に飯・ミルレーネ・イスメネ・墓所の壁 =====
    const r4 = await game.call("setup", "bells4", { level: 20 });
    await game.waitScene("Scene_Map");
    await arrive(r4.to.mapId, r4.to.x, r4.to.y);
    check(r4.to.mapId === SLOPE, "旗の束 bells4 の入口が 180 灰の斜面でない " + JSON.stringify(r4.to));
    await game.call("setSpeed", MAP_SPEED);
    await game.eval(([c, o]) => { $gameVariables.setValue(c, 2); $gameVariables.setValue(o, 3); }, [VAR.copies, VAR.outsiders]);
    check((await sw(SW.metMirlene)) && (await sw(122)) && (await sw(124)), "bells4 でミルレーネに会った・食堂・書庫");
    await game.call("transfer", KEEP, 25, 3, 2);
    const night = (await talk([], false)).join("\n");
    check(night.includes("ヴォルフラム：この椀は、触らん") && night.includes("飯が盛られた。湯気が立った。") && (await sw(SW.bowl)), "伏せた椀に飯が盛られる（1151） " + JSON.stringify(night).slice(0, 300));
    check(night.includes("ミルレーネ：灯は、湖の子に頼んだの。七十三冊目の帳面も") && night.includes("「鳴った」") && (await sw(SW.mirlene)), "ミルレーネが砦に来る（1152） " + JSON.stringify(night).slice(0, 600));
    check(night.includes("シャノ：湖の人、来たよ。灯、持ってない"), "シャノの一言（172）");
    check(night.includes("イスメネ：お返しします。まだ、です") && (await has(ITEM.twoCopies)) === 1 && (await sw(SW.ismene)), "出立：イスメネが写しを返す " + JSON.stringify(night).slice(-300));
    check(!(await game.eval(() => $gameMap.isEventRunning())), "砦の自動実行が終わらない");
    await go(KEEP, 22, 27, 8);
    check((await talk()).join("").includes("四つ目は、ここで待つわ"), "炉の脇の石のミルレーネ");
    await go(KEEP, 7, 14, 8);
    const wall = (await talk()).join("\n");
    check(wall.includes("指を折る。三十で、指は全部開いた。"), "三つ目の鐘の夜の墓所の壁（名前が戻る前） " + JSON.stringify(wall));
    await game.shot("keep-night");
    console.log("  砦：椀に飯（1151）・ミルレーネ（1152）・イスメネの写し・墓所の壁の夜", `（${Math.round((Date.now() - T0) / 1000)} 秒）`);

    // ===== 3. 019 の頂への門 → 180 灰の斜面 =====
    await go(RAMPART, 41, 7, 8);
    const gate = (await talk()).join("\n");
    check(gate.includes("灰が引いている") && gate.includes("ミルレーネ：わたしも上るわ。灯は持たないの。") && gate.includes("足跡は降った端から消える。") && gate.includes("ブルーノ：灰の中で、数えるのは難しいです。"),
      "頂への門 → 着き場 " + JSON.stringify(gate));
    await arrive(SLOPE, 9, 46);
    const slope = await game.eval(() => ({ name: $gameMap.displayName(), w: $dataMap.width, h: $dataMap.height, ash: !!$dataMap.meta.hai_ash }));
    check(slope.name === "灰の斜面" && slope.w === 70 && slope.h === 50 && slope.ash, "灰の斜面の大きさ・灰 " + JSON.stringify(slope));
    await game.shot("slope");
    await game.eval(id => $gameSwitches.setValue(id, true), SW.timber);
    await go(SLOPE, 50, 25, 8);
    const sor = (await talk()).join("\n");
    check(sor.includes("わたしは足場の木を運ぶ。") && sor.includes("木の束が、灰に細い筋を引いた。") && (await sw(SW.sorenne)), "ソレンヌ（足場の木を運んだ道。1153） " + JSON.stringify(sor));
    await go(SLOPE, 44, 41, 8);
    const camp = (await talk()).join("\n");
    check(camp.includes("「ここから上は、骨拾いの縄張りだ。狩らない」") && camp.includes("ベルトラン：……狩らねえ、か"), "使徒狩りの野営の跡 " + JSON.stringify(camp));
    await go(SLOPE, 7, 30, 4);
    await talk(["縄を下りる"]);
    await arrive(EAST_GATE, 10, 7);
    check(await sw(SW.ropeDown), "崖の縄を下ろした（1167）");
    await go(EAST_GATE, 10, 7, 8);
    await talk(["縄を上る"]);
    await arrive(SLOPE, 7, 30);
    console.log("  019 の門 → 180：着き場・ソレンヌ（1153）・野営の跡・崖の縄で 054 と行き来（1167）", `（${Math.round((Date.now() - T0) / 1000)} 秒）`);

    // ===== 4. 181 鐘守の宿坊 =====
    await go(SLOPE, 35, 3, 8);
    await step(8);
    await arrive(LODGE, 25, 38);
    await go(LODGE, 25, 30, 8);
    const ledger = (await talk()).join("\n");
    check(ledger.includes("「一晩のみ」") && ledger.includes("宿帳を手に入れた！") && (await has(ITEM.ledger)) === 1, "宿帳 " + JSON.stringify(ledger));
    const faint0 = await vr(VAR.faint);
    await go(LODGE, 9, 21, 8);
    const f11 = (await talk()).join("\n");
    check(f11.includes("墓守の指は、三十一まで動いた。") && f11.includes("ブルーノ：城壁のときも、三十一でした。") && f11.includes("「習っていない」"), "薄い思念 F11 " + JSON.stringify(f11));
    check((await vr(VAR.faint)) === faint0 + 1 && (await game.eval(() => Hai.Thoughts.isFaint("F11"))), "F11 で戻った記憶が 1 増える");
    await go(LODGE, 39, 21, 8);
    check((await talk()).join("").includes("トゥーラ：これで運ぶはずだったのか。"), "氷室の橇とトゥーラ");
    await game.shot("lodge");
    console.log("  181：宿帳（Items 1151）・F11（記憶 +1）・氷室の橇", `（${Math.round((Date.now() - T0) / 1000)} 秒）`);

    // ===== 5. 182 足場の番（宿帳で「一晩のみ」） =====
    await go(LODGE, 25, 1, 8);
    await step(8);
    await arrive(SCAFFOLD, 13, 17);
    await go(SCAFFOLD, 13, 5, 8);
    const pre = (await talk()).join("\n");
    check(pre.includes("夜明けまでに。段を外せ。") && pre.includes("影の槌が、止まった。") && pre.includes("三晩。"), "足場の番の前（宿帳を見せる） " + JSON.stringify(pre));
    await game.waitFor(() => window.__game.scene() === "Scene_Battle", null, 60_000);
    await waitInput();
    check(await game.eval(s => $gameTroop.members()[0].isStateAffected(s), STATE_ONE_NIGHT), "戦いの頭に「一晩のみ」が付いていない");
    await game.shot("scaffold-battle");
    const won = (await winBattle()).join("\n");
    check(won.includes("影は段の上で、灰になった。") && (await sw(SW.scaffold)), "足場の番を倒す（1154） " + JSON.stringify(won));
    await go(SCAFFOLD, 13, 1, 8);
    await step(8);
    await arrive(ROOT, 20, 28);
    console.log("  182：足場の番（宿帳で一晩のみ）→ 1154 → 183", `（${Math.round((Date.now() - T0) / 1000)} 秒）`);

    // ===== 6. 183 鐘楼の根 =====
    await go(ROOT, 20, 9, 8);
    check((await talk()).join("").includes("歯が一つだけ、新しい。") && !(await sw(SW.rope)), "工具が無いと巻き上げは直せない");
    await go(ROOT, 23, 10, 8);
    check((await talk()).join("").includes("石工の工具を手に入れた！") && (await has(ITEM.tools)) === 1, "石工の工具（Items 1152）");
    await go(ROOT, 20, 9, 8);
    const fix = (await talk()).join("\n");
    check(fix.includes("歯を直した。綱が、上まで通った。") && fix.includes("アンセルモ：お前さん。綱を直すと、上で吊れるようになる") && (await sw(SW.rope)), "綱を直す（1155） " + JSON.stringify(fix));
    await game.shot("bell-root");
    console.log("  183：石工の工具（Items 1152）・綱を直す（1155）", `（${Math.round((Date.now() - T0) / 1000)} 秒）`);

    // ===== 7. 015 頂（場面表 5）：ルシアン・銘・舌を吊る・耐える戦い・三十・三十一 =====
    await game.eval(() => { $gameVariables.setValue(162, 2); $gameVariables.setValue(163, 3); }); // 頂の道具と写しがそろった道（ルシアンが彫りはじめる）
    await go(ROOT, 20, 2, 8);
    await step(8);
    const summit = (await talk([], false)).join("\n");
    await arrive(SUMMIT, 20, 28);
    check(summit.includes("親鐘。舌が無く、口は暗い。周りに、木の足場。") && summit.includes("ルシアン：あなたの連れは、何人です") && summit.includes("ブルーノ：……七人です"), "頂に着いた " + JSON.stringify(summit));
    await game.shot("summit");
    await go(SUMMIT, 18, 11, 8);
    const ins = (await talk(["見ている", "手首を掴む"])).join("\n");
    check(ins.includes("「鳴る音に、その日の者を乗せよ」") && ins.includes("ルシアンは、こちらを見た。鑿は止めなかった。") && ins.includes("ソレンヌ：長。木は、下ろす"), "銘とルシアンを止める " + JSON.stringify(ins));
    check((await sw(SW.lucien)) && (await sw(SW.sorenneAlive)), "ルシアンを止めた（1156）・ソレンヌが生きている（1166）");
    await go(SUMMIT, 20, 11, 8);
    const hang = (await talk()).join("\n");
    check(hang.includes("舌を吊った。綱を引いて、金具を上げた。") && hang.includes("「止まっていた」") && (await sw(SW.tongue)), "舌を吊る（1157） " + JSON.stringify(hang));
    await game.waitFor(() => window.__game.scene() === "Scene_Battle", null, 60_000);
    check(await game.eval(id => $gameTroop.troop().id === id, 1152), "耐える戦い「夜の思い」（Troops 1152）");
    await game.shot("endure");
    // 耐える：毎ターン全員が防御（8 ターン目の終わりで勝ち）
    await game.call("strengthenParty");
    for (let t = 0; t < 12 && (await game.eval(() => SceneManager._scene instanceof Scene_Battle && !BattleManager.isBattleEnd())); t++) {
      await waitInput();
      if (!(await game.eval(() => SceneManager._scene instanceof Scene_Battle && BattleManager.isInputting()))) break;
      await game.call("setSpeed", FAST);
      await game.eval(() => {
        $gameParty.members().forEach(a => { if (!a.action(0) && a.canMove()) a.makeActions(); const act = a.action(0); if (a.canInput() && act) act.setGuard(); });
        BattleManager.startTurn();
        SceneManager._scene.changeInputWindow();
      });
    }
    await game.page.keyboard.down("Enter");
    try { await game.waitFor(() => window.__game.scene() === "Scene_Map", null, 120_000); } finally { await game.page.keyboard.up("Enter"); }
    await game.call("setSpeed", MAP_SPEED);
    check((await sw(SW.endured)) && (await game.eval(() => Hai.Boss.endured())), "耐えきった（1158）");
    console.log("  015：着いた・銘・ルシアンを止める（1156・1166）・舌を吊る（1157）・耐える戦い（1158）", `（${Math.round((Date.now() - T0) / 1000)} 秒）`);

    // ===== 8. 綱（まだ・三十・三十一）→ 010 の結末の夜と朝 =====
    const rope = (await talk(["まだ", "引く", ...Array(30).fill("引く"), "もう一度、引く", "開ける"], false)).join("\n");
    check(rope.includes("ゼリナ：まだ、って顔しとるな。あんた、勘定が長いわ"), "まだ（一周目の仲間の一言） " + JSON.stringify(rope).slice(0, 300));
    check(rope.includes("一。") && rope.includes("ブルーノ：鳴りました。隊長、鳴りました") && rope.includes("三十。") && rope.includes("ゼリナ：十四人、着いたか見てくる"), "三十を一回ずつ " + JSON.stringify(rope).slice(0, 1500));
    check(rope.includes("相棒は、鐘の音の中へ入っていった。") && rope.includes("三十一。") && rope.includes("音は、山の向こうで消えた。"), "三十のあと・三十一（夕べの数） " + JSON.stringify(rope).slice(-2000, -1000));
    check(rope.includes("ソレンヌ：木は、下ろした。") && rope.includes("食卓が、いっせいに黙った。") && rope.includes("紐は、新しい。") && rope.includes("「ルカ！　爺ちゃんが、飯だって！」") && rope.includes("答えた。"),
      "結末の夜と朝 " + JSON.stringify(rope).slice(-1200));
    const ending = await game.eval(() => ({
      map: $gameMap.mapId(), party: $gameParty._actors.slice(), pulls: $gameVariables.value(1152),
      sw: [1159, 1160, 1161, 1162, 1163, 1165].map(i => $gameSwitches.value(i)),
    }));
    check(ending.map === KEEP && ending.party.join() === "1" && ending.pulls === 30 && ending.sw.join() === "true,true,false,true,true,true", "結末のあと（仲間は外れ・旗） " + JSON.stringify(ending));
    await game.shot("morning");
    await go(KEEP, 24, 19, 8);
    check((await talk()).join("").includes("「三十のつぎって、なんだっけ」"), "中庭の子ども（朝の砦）");
    await go(122, 19, 11, 8);
    check((await talk()).join("").includes("ルシアンは、空の鐘架の前に座っている。"), "後日談の一行（122 空の鐘架）");
    console.log("  綱：まだ・三十・三十一 → 結末の夜（戸を開けた）と朝（1159・1165）・中庭の子ども・後日談", `（${Math.round((Date.now() - T0) / 1000)} 秒）`);

    const problems = checkAll();
    check(problems.length === 0, "データの検査で問題 " + JSON.stringify(problems.slice(0, 5)));
    game.assertNoErrors();
  } finally {
    await game.close();
  }
});
