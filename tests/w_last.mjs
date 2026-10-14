// W11（#191）最後の地域の山場（docs/world.md 3.6・3.7・4.4・9.1、docs/text.md 4.16・5.5、tools/maps/src/w11_*）の通しの検査：
//   旗の束 bells2（営倉・記録院）から、水底の鐘 104 を 3 つ目に鳴らす → 鐘番の思念の 2 ページ目が自動で 3 つ目の場面（スイッチ 106・縄張りは鋳物場 east・メモ）
//   → 104 の口に霧の戸口が出ない（鳴った地域）→ 鋳物場の鐘の間 094 の口の霧の戸口から縄張りの縁 170（東の戸口だけ開いている・骨拾いの一言・門叩きの声）
//   → 171 喰われた者の廊下（読んだ思念の影だけが出て、倒すとその一行を残す・彫り刀の音）→ 172 塊の間（使徒の力 スイッチ 162・塊を倒す スイッチ 701）
//   → 相棒の司祭の薄い思念 F12（スイッチ 110）→ 名前が「ルカ」に・スイッチ 108 → 刃の欠けた彫り刀 → 173 戻りの戸口（スイッチ 704）→ 094 の鐘の間の側
//   → 4 つ目の鐘（スイッチ 105）→ 霧が引き、頂への門（スイッチ 109）・縄張りの色調を戻す → 019 の頂への門が開いている。
// 残りの二つの戸口（084・104）は、データの検査（場所移動の行き先・到達性）と、ページの出方で見る。6 分以内。
import { launchGame, check, runTest } from "./lib.mjs";
import { checkAll } from "../tools/data/check.mjs";

const EDGE = 170, CORRIDOR = 171, MASS = 172, BACK = 173, FOUNDRY_BELL = 94, ARCHIVE_BELL = 84, WATER_BELL = 104, RAMPART = 19;
const SW = { bellArchive: 102, bellWater: 103, bellFoundry: 104, bellsAll: 105, scene3: 106, climax: 108, summitGate: 109, nameBack: 110, apostle: 162, mass: 701, backEast: 704, knife3: 707, voice: 708 };
const VAR = { bells: 101, faint: 138 };
const MASS_TROOP = 703;
const KNIFE = 701;
const FAST = 16;
const MAP_SPEED = 4; // マップでの早送り（6 分以内に収める）

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
      try {
        await game.holdOkToMap();
      } finally {
        await game.call("setSpeed", MAP_SPEED);
      }
      return talk([], false);
    }
    const pageIndex = (name) => game.eval(n => {
      const ev = $gameMap.events().find(e => e.event().name === n);
      return ev ? ev._pageIndex : -2;
    }, name);

    // ===== 1. 鐘 2 つ（営倉・記録院）から、水底の鐘を 3 つ目に鳴らす → 3 つ目の場面 =====
    const r = await game.call("setup", "bells2", { bells: ["archive"] });
    await game.waitScene("Scene_Map");
    await arrive(r.to.mapId, r.to.x, r.to.y);
    await game.call("setSpeed", MAP_SPEED);
    check((await vr(VAR.bells)) === 2 && !(await sw(SW.scene3)), "旗の束 bells2：鐘 2 つ・3 つ目の場面はまだ");
    await game.eval(() => Hai.Thoughts.markRead("R3-23")); // 鐘番の思念を先に読んだ扱い（W20 #264。R2 困る 5）
    await go(WATER_BELL, 13, 8, 8);
    const scene = (await talk(["綱を引く"])).join("\n");
    check(scene.includes("水は、膝から胸まで来た") && !scene.includes("（読んだ）"), "3 つ目の場面の途中の鐘番の思念に「（読んだ）」が付く " + JSON.stringify(scene).slice(0, 600));
    check(scene.includes("輪が幾重にも") && scene.includes("喰わない。代わりに、自分のものを一つ渡す。") && scene.includes("……喰わないために、預けたのか"),
      "水底の鐘を 3 つ目に鳴らすと、鐘番の思念のあとに 3 つ目の場面 " + JSON.stringify(scene).slice(0, 600));
    check(scene.includes("鋳物場の方角だ"), "まだ鳴っていない鋳物場の方角から戸を叩く音 " + JSON.stringify(scene).slice(-300));
    const after3 = await game.eval(() => ({
      bells: $gameVariables.value(101), scene3: $gameSwitches.value(106), lair: Hai.MapTone.lair(),
      note: Hai.Thoughts.notes("clue").some(n => n.text.includes("鋳物場の鐘の間の手前")),
      tone: $gameScreen.tone().slice(),
    }));
    check(after3.bells === 3 && after3.scene3 && after3.lair === "east" && after3.note, "3 つ目の場面のあと（変数 101 = 3・スイッチ 106・縄張り east・メモ） " + JSON.stringify(after3));
    check(after3.tone[3] < 150, "3 つ目の場面のあと画面が暗いまま " + JSON.stringify(after3.tone));
    check((await talk()).join("").includes("小さく震えて"), "鳴らした後の鐘の文章");
    // 鳴った地域（水底）の口には霧の戸口が出ない。鐘番の思念は 3 ページ目（ふつうの思念）
    check((await pageIndex("霧の戸口（門叩きの縄張りへ。W11）")) === 1, "水底の鐘の間の口に霧の戸口が出ている");
    await go(WATER_BELL, 8, 8, 8);
    const keeper = (await talk()).join("\n");
    check(keeper.includes("水は、膝から胸まで来た") && !keeper.includes("喰わない"), "3 つ目の場面のあとの鐘番の思念は本文だけ " + JSON.stringify(keeper));
    await game.shot("scene3-after");
    console.log("  水底の鐘を 3 つ目に：鐘番の思念 → 3 つ目の場面（スイッチ 106・縄張り east・メモ）・水底の口は空いている", `（${Math.round((Date.now() - T0) / 1000)} 秒）`);

    // ===== 2. 鋳物場の鐘の間 094：口の霧の戸口から縄張りへ =====
    await go(FOUNDRY_BELL, 13, 15, 8);
    check((await pageIndex("霧の戸口（門叩きの縄張りへ。W11）")) === 0, "鋳物場の鐘の間の口に霧の戸口が出ない");
    check(await game.eval(() => Hai.MapTone.lairHere()), "鋳物場（east）が縄張りの色調になっていない");
    await game.shot("foundry-door");
    check(!(await step(8)), "霧の戸口を通り抜けた");
    const enter = (await talk(["霧の奥へ入る"], false)).join("\n");
    check(enter.includes("霧が詰まっている") && enter.includes("下りの石段"), "霧の戸口の文章（文6） " + JSON.stringify(enter));
    await arrive(EDGE, 47, 20);
    await game.shot("edge-east");
    const edge = await game.eval(() => ({
      name: $gameMap.displayName(), w: $dataMap.width, h: $dataMap.height, dark: Hai.MapTone.dark(), fog: Hai.MapTone.fog(),
      pages: Object.fromEntries($gameMap.events().map(e => [e.event().name, e._pageIndex])),
    }));
    check(edge.name === "縄張りの縁" && edge.w === 50 && edge.h === 40 && edge.fog && edge.fog.density >= 90, "縄張りの縁の大きさ・霧 " + JSON.stringify({ ...edge, pages: undefined }));
    check(edge.dark && edge.dark.radius === 5, "鐘番の角灯で暗がりが 5 にならない " + JSON.stringify(edge.dark));
    check(edge.pages["戸口（鋳物場の鐘の間へ戻る）"] === 0 && edge.pages["戸口（記録院の鐘の間へ戻る）"] === 1 && edge.pages["戸口（水底の鐘の間へ戻る）"] === 1,
      "入った戸口（鋳物場）だけ開いている " + JSON.stringify(edge.pages));
    check(edge.pages["骨拾い（縄張りの縁。最後の地域が鋳物場のとき）"] === 0 && edge.pages["ゲンサイ（縄張りの縁。最後の地域が記録院のとき）"] === 1, "今の勢力の人はその地域の人だけ " + JSON.stringify(edge.pages));
    await go(EDGE, 45, 19, 8);
    const picker = (await talk()).join("\n");
    check(picker.includes("増えております") && picker.includes("頭を深く下げた"), "骨拾いの一言（text.md 5.5 の a） " + JSON.stringify(picker));
    // 門叩きの声（広間へ入る東の通り）
    await go(EDGE, 36, 20, 4);
    await step(4);
    const voice = (await talk([], false)).join("\n");
    // W14（#234）：場面表 3.3 に差し替えた（名前なし・声ごとに窓・最後に相棒の声）
    check(voice.includes("戸を開けておくれ。中で、待っている。") && voice.includes("同胞よ。拾ったものは、喰うものだ。") && voice.includes("お前の分も残しておいた") &&
      voice.includes("……三十一。お前は、いつも一つ多い。") && !voice.includes("の声："), "門叩きの声（地域の死者の声と相棒の声。場面表 3.3） " + JSON.stringify(voice));
    check(await sw(SW.voice), "門叩きの声のスイッチ 708");
    // 北の細い口の影は、広間の北西の見えない通路で避けられる
    await go(EDGE, 18, 12, 8);
    check((await step(8)) && (await step(8)) && (await step(8)), "広間の北西の見えない通路を通れない " + JSON.stringify(await pos()));
    await go(EDGE, 25, 2, 8);
    await game.eval(() => Hai.Thoughts.markRead("R4-13")); // 鋳物場の檻の子を読んだ扱い（廊下に影が一つ出る）
    // 文6（#273）：トゥーラの臨終（記憶 4）を読み、トゥーラを連れている扱い（廊下に「かえりは かるい」の影が出る）
    await game.eval(() => { Hai.Companions.learnMemory(11, 4); $gameSwitches.setValue(144, true); });
    await step(8);
    await arrive(CORRIDOR, 25, 38, { quiet: false });
    console.log("  縄張りの縁：東の戸口だけ開く・角灯で暗がり 5・骨拾いの一言・門叩きの声（檻の子・下士官）・見えない通路 → 廊下", `（${Math.round((Date.now() - T0) / 1000)} 秒）`);

    // ===== 3. 171 喰われた者の廊下：読んだ思念の影だけが出る =====
    await game.shot("corridor");
    await game.frames(6);
    const shades = await game.eval(() => Object.fromEntries($gameMap.events().filter(e => e.event().name.startsWith("声だけの影（鋳物場")).map(e => [e.event().name, e._pageIndex])));
    check(shades["声だけの影（鋳物場 R4-13）"] === 0 && shades["声だけの影（鋳物場 R4-11）"] === -1, "読んだ思念（R4-13）の影だけが出る " + JSON.stringify(shades));
    const westShade = await game.eval(() => $gameMap.events().filter(e => e.event().name.startsWith("声だけの影（記録院")).every(e => e._pageIndex === -1));
    check(westShade, "縄張りでない地域の影が出ている");
    const TULA_SHADE = "声だけの影（鋳物場 トゥーラの記憶 4）";
    check((await pageIndex(TULA_SHADE)) === 0, "トゥーラの記憶 4 を読んでいるのに「かえりは かるい」の影が出ない");
    await game.eval(t => { for (const e of $gameMap.events()) if (e.event().meta.hai_enemy && !e.event().name.includes("R4-13") && e.event().name !== t) $gameSelfSwitches.setValue([$gameMap.mapId(), e.eventId(), "A"], true); }, TULA_SHADE);
    await go(CORRIDOR, 5, 29, 8, { quiet: false });
    await game.call("step", 8);
    const left = (await winBattle(702)).join("\n");
    check(left.includes("いち、に、さん、ってかぞえてる"), "影を倒すと、読んだ思念の一行を残す（text.md 5.5 の c） " + JSON.stringify(left));
    // 文6（#273）：「かえりは かるい」の影は、崩れる文 → 字 → トゥーラの一言の順（場面表 04 の 3.4。R2 の 7 章 04:242）
    await go(CORRIDOR, 39, 8, 6, { quiet: false });
    await game.call("step", 6);
    const tula = await winBattle(702);
    const at = s => tula.findIndex(p => p.includes(s));
    check(at("影が崩れた。灰に、刃物で彫ったような字") >= 0 && at("影が崩れた。") < at("かえりは かるい") && at("かえりは かるい") < at("トゥーラ：……あたしの字だ"),
      "「かえりは かるい」の影のあとの順（崩れる → 字 → トゥーラ） " + JSON.stringify(tula));
    await go(CORRIDOR, 36, 8, 4);
    await step(4);
    check((await talk([], false)).join("").includes("床ごと脈を打つ音") && (await sw(SW.knife3)), "彫り刀の音（C4）");
    await go(CORRIDOR, 25, 1, 8);
    await step(8);
    await arrive(MASS, 20, 28);
    console.log("  喰われた者の廊下：読んだ思念の影だけ・倒すとその一行・彫り刀の音 → 塊の間", `（${Math.round((Date.now() - T0) / 1000)} 秒）`);

    // ===== 4. 172 塊の間：使徒の力・塊・相棒の司祭・名前・彫り刀 =====
    const faint0 = await vr(VAR.faint);
    await go(MASS, 20, 11, 8);
    await game.shot("mass");
    const pre = (await talk()).join("\n");
    check(pre.includes("思いの刃") && (await sw(SW.apostle)) && (await game.eval(() => Hai.Apostle.isLearned())), "塊の前で使徒の力（スイッチ 162） " + JSON.stringify(pre));
    const won = (await winBattle(MASS_TROOP)).join("\n");
    check(won.includes("塊が崩れる") && (await sw(SW.mass)) && (await game.eval(() => Hai.Boss.lastResult())) === 0, "塊を倒す（スイッチ 701） " + JSON.stringify(won));
    await go(MASS, 20, 9, 8);
    const priest = (await talk()).join("\n");
    // W14（#234）：場面表 3.6 に差し替えた（司祭の目から。戸は見ない。主人公の一言は置かない。門叩きの退き）
    check(priest.includes("眠っている方へ、向き直る。") && priest.includes("「ルカ」") && priest.includes("刃の欠けた彫り刀が、床に落ちている。"), "相棒の司祭の薄い思念（F12） " + JSON.stringify(priest));
    check(!priest.includes("最後の一画は、あの夜のままだ。") && priest.includes("呼ばれてしまったか。"), "名前が戻ったあと、主人公の一言は無く門叩きが退く " + JSON.stringify(priest));
    const named = await game.eval(([n, c, v]) => ({ name: $gameActors.actor(1).name(), nameBack: $gameSwitches.value(n), climax: $gameSwitches.value(c), faint: $gameVariables.value(v), f12: Hai.Thoughts.isFaint("F12") }), [SW.nameBack, SW.climax, VAR.faint]);
    check(named.name === "ルカ" && named.nameBack && named.climax && named.f12 && named.faint === faint0 + 1, "名前が戻る（ルカ・スイッチ 110・108・戻った記憶の数） " + JSON.stringify(named));
    await go(MASS, 20, 11, 8);
    await talk();
    check((await game.eval(id => $gameParty.numItems($dataWeapons[id]), KNIFE)) === 1, "刃の欠けた彫り刀");
    await game.shot("mass-after");
    await go(MASS, 20, 2, 8);
    await step(8);
    await arrive(BACK, 13, 11);
    console.log("  塊の間：使徒の力（162）・塊（701）・F12 で「ルカ」（110・108・記憶の数）・刃の欠けた彫り刀 → 戻りの戸口", `（${Math.round((Date.now() - T0) / 1000)} 秒）`);

    // ===== 5. 173 戻りの戸口 → 鋳物場の鐘の間 → 4 つ目の鐘 → 頂への門 =====
    await go(BACK, 13, 3, 8);
    check(!(await step(8)), "戻りの戸口を通り抜けた");
    await talk([], false);
    await arrive(FOUNDRY_BELL, 13, 12);
    check(await sw(SW.backEast), "戻りの戸口のスイッチ 704");
    check((await pageIndex("霧の戸口（門叩きの縄張りへ。W11）")) === 0, "鐘を鳴らす前に口の霧が引いた");
    await go(FOUNDRY_BELL, 13, 8, 8);
    const ring = (await talk(["綱を引く"])).join("\n");
    check(ring.includes("鐘が鳴る") && ring.includes("霧の奥の声が、一つずつ遠くなった") && ring.includes("東の塔の門が開く音"), "4 つ目の鐘のあと、霧が引いて門の開く音 " + JSON.stringify(ring).slice(-400));
    const after4 = await game.eval(() => ({
      bells: $gameVariables.value(101), all: $gameSwitches.value(105), gate: $gameSwitches.value(109), lair: Hai.MapTone.lair(),
      note: Hai.Thoughts.notes("clue").some(n => n.text.includes("頂への門が開いた")),
      doors: $gameMap.events().filter(e => e.event().name.startsWith("霧の戸口")).map(e => e._pageIndex),
    }));
    check(after4.bells === 4 && after4.all && after4.gate && after4.lair === null && after4.note, "4 つ目の鐘（変数 101 = 4・スイッチ 105・109・縄張りを戻す・メモ） " + JSON.stringify(after4));
    check(after4.doors.join() === "1,3,1", "霧の戸口が引いていない " + JSON.stringify(after4.doors));
    await go(FOUNDRY_BELL, 13, 15, 8);
    check((await step(8)) && (await pos()).y === 14, "霧が引いたあと、口を通れない");
    await game.shot("foundry-bell-after");
    console.log("  戻りの戸口（704）→ 鋳物場の鐘の間の側 → 4 つ目の鐘（105）→ 霧が引き、頂への門（109）・縄張りの色調を戻す", `（${Math.round((Date.now() - T0) / 1000)} 秒）`);

    // ===== 6. 残りの戸口と頂への門 =====
    await go(ARCHIVE_BELL, 13, 13, 8);
    check((await pageIndex("霧の戸口（門叩きの縄張りへ。W11）")) === 1, "記録院の鐘の間の口に霧の戸口が残っている");
    await go(RAMPART, 41, 7, 8);
    check((await talk()).join("").includes("灰が引いている"), "019 の頂への門が開いていない（スイッチ 109）");
    console.log("  記録院の口は空いている・城壁の上の頂への門が開いている（スイッチ 109）", `（${Math.round((Date.now() - T0) / 1000)} 秒）`);

    const problems = checkAll();
    check(problems.length === 0, "データの検査で問題 " + JSON.stringify(problems.slice(0, 5)));
    game.assertNoErrors();
  } finally {
    await game.close();
  }
});
