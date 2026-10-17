// P14（#230）の検査：原作の仕掛け。乱数（Math.random）は固定する。
//   1. 東を向いて止まる（Hai_SymbolEnemy の <hai_enemy_bell>。試験場は Map901）：スイッチ OFF ではふだんどおり。
//      ON で追わず・動かず・右を向き・影の薄さ。触れると戦闘。マップのメモ欄の旗はイベントの旗に負ける。
//      朝の砦（スイッチ 1165）が ON なら、旗の敵だけ出ない。
//   2. 灰を止める（Hai_MapTone）：「灰を止める」で <hai_ash> も「ash」で変えた強さも降らない。1165 ON でも降らない。
//   3. 言い残し（Hai_Thoughts の表）：スイッチが ON の行だけが legacies() と書庫の「言い残し」に出る（表の順）。
//      1165 ON で書庫の「読んだ思念」が「送った人」になる。
//   4. F09 のあとの一言（Map105 の F09）：既定では固有の一言を出さない（W32 で「……一つ多い」を外した）。F09 もコモンイベント 201 を呼ぶ。
//   5. 耐える／呼ぶ（Hai_Apostle、Troops 183 の <hai_endure:5>）：主人公の命令は「耐える」「呼ぶ」だけ。
//      「呼ぶ」で隊の仲間が順に主人公を呼び、呑まれが減る。ブルーノが倒れると「……数えてください」（<hai_down>）。
//   6. 結末を見た（Hai_Comfort）：スイッチ 1159 で立ち、ページを読み直しても残る。
//   7. 記録を作る（Hai_Warp）：空いている枠に「朝の砦」を書き、頂の手前の記録（いちばん新しい枠）は残す。
//      ロードすると、コマンドの次から続く（記録を作り直さない）。
import { launchGame, check, runTest } from "./lib.mjs";
import { readSource, findChars } from "../tools/maps/build.mjs";

const SYMBOL_MAP = 901;
const [START] = findChars(readSource("p1_symbols").lines, "S");
const BELL = 103; // 営倉の鐘
const MORNING = 1165;
const ENDING = 1159;
const TROOP = 183;
const FAST = 16;

await runTest(async () => {
  const game = await launchGame();
  try {
    await game.call("newGame");
    await game.waitScene("Scene_Map");
    await game.call("transfer", SYMBOL_MAP, START.x, START.y, 2);
    await game.waitFor(id => window.__game.mapId() === id && !window.__game.isBusy(), SYMBOL_MAP);
    await game.waitFor(() => SceneManager._scene._spriteset._tilemap.isReady());
    await game.eval(() => {
      window.__rand = 0.5;
      Math.random = () => window.__rand;
      window.__log = { texts: [], msgs: [], speakers: [] };
      const addText = Window_BattleLog.prototype.addText;
      Window_BattleLog.prototype.addText = function(text) {
        window.__log.texts.push(text);
        return addText.apply(this, arguments);
      };
      const add = Game_Message.prototype.add;
      Game_Message.prototype.add = function(text) {
        window.__log.msgs.push(text);
        window.__log.speakers.push(this.speakerName());
        return add.apply(this, arguments);
      };
    });
    const log = () => game.eval(() => window.__log);
    /** 戦闘をやめてマップに戻る（文章は決定で送る）。 */
    const leaveBattle = async () => {
      await game.eval(() => BattleManager.abort());
      for (let i = 0; i < 600 && (await game.eval(() => window.__game.scene())) !== "Scene_Map"; i++) {
        if (await game.eval(() => $gameMessage.isBusy())) await game.press("Enter");
        else await game.frames(2);
      }
      await game.waitScene("Scene_Map");
      await game.waitIdle();
    };

    // ===== 1. 東を向いて止まる =====
    const ids = await game.eval(() => {
      const out = {};
      for (const ev of $gameMap.events()) {
        const rank = Hai.SymbolEnemy.rankOf(ev);
        if (rank) out[rank] = ev.eventId();
      }
      return out;
    });
    check(ids.red && ids.yellow, "赤・黄の敵がいない " + JSON.stringify(ids));
    await game.eval(([id, sw]) => {
      $gameMap.event(id).event().meta.hai_enemy_bell = String(sw);
    }, [ids.red, BELL]);
    const enemy = id => game.eval(i => {
      const ev = $gameMap.event(i);
      return {
        x: ev.x, y: ev.y, d: ev.direction(), opacity: ev.opacity(), page: ev._pageIndex,
        bell: Hai.SymbolEnemy.bellSwitchOf(ev), stopped: Hai.SymbolEnemy.isBellStopped(ev), see: Hai.SymbolEnemy.canSeePlayer(ev),
      };
    }, id);
    // プレイヤーを赤の真横（左に 2 歩）に置く：ふだんなら見えて追う距離
    const red0 = await enemy(ids.red);
    await game.eval(([x, y]) => {
      $gamePlayer.locate(x - 2, y);
    }, [red0.x, red0.y]);
    await game.frames(2);
    let red = await enemy(ids.red);
    check(red.bell === BELL && !red.stopped && red.opacity === 255, "スイッチ OFF なのに止まっている " + JSON.stringify(red));
    await game.eval(sw => $gameSwitches.setValue(sw, true), BELL);
    await game.frames(20); // 歩きかけの 1 歩が終わるまで
    const red1 = await enemy(ids.red);
    await game.frames(90);
    red = await enemy(ids.red);
    const shade = await game.eval(() => Hai.SymbolEnemy.params.shadeOpacity);
    check(red.stopped && !red.see && red.d === 6 && red.opacity === shade && red.x === red1.x && red.y === red1.y,
      "鐘が鳴ったのに、東を向いて止まらない " + JSON.stringify({ red1, red, shade }));
    await game.shot("bell-stopped");
    check(await game.eval(i => $gameMap.event(i).list().some(c => c.code === 301), ids.red), "止まった敵に触れても戦闘にならない");
    // 触れると戦闘（逃げて戻る）
    await game.eval(i => $gameMap.event(i).start(), ids.red);
    await game.waitScene("Scene_Battle");
    await leaveBattle();
    // マップのメモ欄の旗：イベントの旗が無い敵に付く。イベントの旗が優先
    // （戦闘から戻ると $dataMap は読み直されるので、イベントの旗も付け直す）
    await game.eval(([id, sw]) => {
      $gameMap.event(id).event().meta.hai_enemy_bell = String(sw);
      $dataMap.meta.hai_enemy_bell = "104";
    }, [ids.red, BELL]);
    const yellow = await enemy(ids.yellow);
    red = await enemy(ids.red);
    check(yellow.bell === 104 && !yellow.stopped && red.bell === BELL, "マップのメモ欄の旗 " + JSON.stringify({ yellow, red }));
    await game.eval(() => delete $dataMap.meta.hai_enemy_bell);
    // 朝の砦：旗の敵だけ出ない
    await game.eval(sw => {
      $gameSwitches.setValue(sw, true);
      $gameMap.refresh();
    }, MORNING);
    await game.frames(2);
    check((await enemy(ids.red)).page === -1 && (await enemy(ids.yellow)).page >= 0, "朝の砦で旗の敵が残る／旗の無い敵が消える");
    await game.eval(sw => $gameSwitches.setValue(sw, false), MORNING);
    await game.eval(sw => $gameSwitches.setValue(sw, false), BELL);
    await game.frames(4);
    red = await enemy(ids.red);
    check(red.page >= 0 && !red.stopped && red.opacity === 255, "スイッチを戻しても影の薄さが残る " + JSON.stringify(red));

    // ===== 2. 灰を止める =====
    const ash = () => game.eval(() => ({ ash: Hai.MapTone.ash(), stopped: Hai.MapTone.isAshStopped() }));
    const tone = (cmd, args = {}) => game.eval(([c, a]) => PluginManager.callCommand($gameMap._interpreter, "Hai_MapTone", c, a), [cmd, args]);
    await game.eval(() => {
      $dataMap.meta.hai_ash = "4";
    });
    check((await ash()).ash && (await ash()).ash.power === 4, "<hai_ash> が降らない");
    await tone("stopAsh");
    check((await ash()).ash === null && (await ash()).stopped, "灰を止めても降る");
    await tone("ash", { power: "6" });
    check((await ash()).ash === null, "灰を止めたあと「ash」で降る");
    await tone("resumeAsh");
    check((await ash()).ash && (await ash()).ash.power === 6, "灰を戻しても降らない");
    await tone("ashReset");
    await game.eval(sw => $gameSwitches.setValue(sw, true), MORNING);
    check((await ash()).ash === null, "朝の砦（1165）で灰が降る");
    await game.eval(sw => $gameSwitches.setValue(sw, false), MORNING);
    await game.eval(() => delete $dataMap.meta.hai_ash);

    // ===== 3. 言い残しと書庫の見出し =====
    const table = await game.eval(() => Hai.Thoughts.legacyTable());
    check(table.map(r => r.switchId).join() === "314,413,1061,620" && table.every(r => !r.heard && r.speaker && r.text),
      "言い残しの表 " + JSON.stringify(table));
    check((await game.eval(() => Hai.Thoughts.legacies())).length === 0, "拾っていない言い残しが出る");
    await game.eval(() => {
      $gameSwitches.setValue(620, true);
      $gameSwitches.setValue(314, true);
    });
    const legacies = await game.eval(() => Hai.Thoughts.legacies());
    check(legacies.map(r => r.switchId).join() === "314,620" && legacies[0].speaker === "木樵の女房" && legacies[1].text === "顔は覚えている。たぶん",
      "拾った言い残し " + JSON.stringify(legacies));
    const lore = await game.eval(() => Hai.Facilities.loreLines("legacies"));
    check(lore.length === 4 && lore[0].includes("木樵の女房") && lore[1].includes("薪、三束。戸の脇に置いといたよ") && lore[3].includes("顔は覚えている"),
      "書庫の言い残し " + JSON.stringify(lore));
    check(await game.eval(() => Hai.Facilities.loreName("thoughts")) === "読んだ思念", "書庫の見出しが「読んだ思念」でない");
    await game.eval(sw => $gameSwitches.setValue(sw, true), MORNING);
    check(await game.eval(() => Hai.Facilities.loreName("thoughts")) === "送った人", "1165 ON で見出しが「送った人」にならない");
    // 書庫の画面（見た目の確認用）
    await game.eval(() => SceneManager.push(Hai.Facilities.Scene_HaiLore));
    await game.waitScene("Scene_HaiLore");
    await game.frames(4);
    const names = await game.eval(() => SceneManager._scene._commandWindow._list.map(c => c.name));
    check(names.includes("送った人") && names.includes("言い残し") && !names.includes("読んだ思念"), "書庫の見出し " + JSON.stringify(names));
    await game.eval(() => SceneManager._scene._commandWindow.selectSymbol("legacies"));
    await game.frames(4);
    await game.shot("lore-legacies");
    await game.eval(() => SceneManager.pop());
    await game.waitScene("Scene_Map");
    await game.waitIdle();
    await game.eval(sw => $gameSwitches.setValue(sw, false), MORNING);

    // ===== 4. F09 のあとの一言 =====
    await game.call("transfer", 105, 44, 9, 8);
    await game.waitFor(() => window.__game.mapId() === 105 && !window.__game.isBusy());
    const f09 = await game.eval(() => $gameMap.events().find(e => /<hai_faint:F09>/.test(e.event().note)).eventId());
    const readFaint = async () => {
      await game.eval(() => {
        window.__log.msgs = [];
        window.__log.speakers = [];
      });
      await game.eval(i => $gameMap.event(i).start(), f09);
      await game.frames(2);
      for (let i = 0; i < 200 && (await game.eval(() => $gameMap.isEventRunning() || $gameMessage.isBusy())); i++) {
        if (await game.eval(() => $gameMessage.isBusy())) await game.press("Enter");
        else await game.frames(2);
      }
      return log();
    };
    // W32（#331。配り役の決め）：F09 のあとの固有の一言「……一つ多い」は既定から外した。F09 もほかの薄い思念と同じくコモンイベント 201 を呼ぶ
    let msgs = await readFaint();
    check(!msgs.msgs.includes("……一つ多い"), "F09 のあとに「……一つ多い」が出る " + JSON.stringify(msgs.msgs));
    check(msgs.msgs.some(m => m.includes("井戸番の女が、もう一杯、と言う。墓守は袖をまくって、また綱を引いた。")), "F09 の本文が出ない " + JSON.stringify(msgs.msgs));
    const f09List = await game.eval(i => $gameMap.event(i).list().map(c => [c.code, c.parameters[0]]), f09);
    check(f09List.some(([code, id]) => code === 117 && id === 201), "F09 がコモンイベント 201 を呼ばない " + JSON.stringify(f09List));
    msgs = await readFaint();
    check(!msgs.msgs.includes("……一つ多い"), "二度目に「……一つ多い」が出る");
    check(await game.eval(() => Hai.Thoughts.faintLine("F09") === "" && Hai.Thoughts.faintLine("F01") === ""), "faintLine の窓口（既定は空）");

    // ===== 5. 耐える／呼ぶ・倒れたときの一言 =====
    await game.eval(() => {
      for (const a of $gameParty.members()) $gameParty.removeActor(a.actorId());
      for (const id of [1, 5, 6]) $gameParty.addActor(id);
      for (const a of $gameParty.members()) {
        a.changeLevel(30, false);
        a.recoverAll();
      }
    });
    await game.eval(t => window.__game.startBattle(t, false, false), TROOP);
    await game.waitScene("Scene_Battle");
    await game.call("setSpeed", FAST);
    const sceneState = () => game.eval(() => {
      const s = SceneManager._scene;
      if (!(s instanceof Scene_Battle)) return "out";
      if ($gameMessage.isBusy()) return "message";
      if (!BattleManager.isInputting()) return "busy";
      if (s._partyCommandWindow.active) return "party";
      if (s._actorCommandWindow.active && BattleManager.actor()) return "actor:" + BattleManager.actor().actorId();
      if (["_enemyWindow", "_actorWindow", "_skillWindow", "_itemWindow"].some(k => s[k] && s[k].active)) return "select";
      return "busy";
    });
    /** 文章を送った決定が「戦う」や命令に届いて進んでいたら、キャンセルで戻す。 */
    const cancelInput = () => game.eval(() => {
      const s = SceneManager._scene;
      const w = ["_enemyWindow", "_actorWindow", "_skillWindow", "_itemWindow", "_actorCommandWindow"].map(k => s[k]).find(x => x && x.active);
      if (w) w.processCancel();
    });
    const waitState = async want => {
      const t0 = Date.now();
      for (;;) {
        const st = await sceneState();
        if (st === want) return;
        if (st === "message") await game.press("Enter");
        else if (want === "party" && (st === "select" || st.startsWith("actor:"))) await cancelInput();
        if (Date.now() - t0 > 60_000) {
          const why = await game.eval(() => ({
            phase: BattleManager._phase, inputting: BattleManager.isInputting(), busy: BattleManager.isBusy(),
            actor: BattleManager.actor() && BattleManager.actor().actorId(), log: SceneManager._scene._logWindow && SceneManager._scene._logWindow._lines,
            msg: $gameMessage.isBusy(), troopEvent: $gameTroop.isEventRunning(),
            windows: ["_partyCommandWindow", "_actorCommandWindow"].map(k => k + ":" + (SceneManager._scene[k] && SceneManager._scene[k].active)),
          }));
          check(false, `「${want}」にならない（今は ${st}） ` + JSON.stringify(why));
        }
        await game.frames(1);
      }
    };
    const pick = async (actorId, symbol) => {
      await waitState("actor:" + actorId);
      const ok = await game.eval(sym => {
        const w = SceneManager._scene._actorCommandWindow;
        const i = w._list.findIndex(c => c.symbol === sym);
        if (i < 0 || !w._list[i].enabled) return false;
        w.select(i);
        w.processOk();
        return true;
      }, symbol);
      check(ok, `アクター ${actorId} のコマンド ${symbol} が無いか使えない`);
      await game.frames(2);
    };
    const fight = async () => {
      await waitState("party");
      await game.eval(() => {
        const w = SceneManager._scene._partyCommandWindow;
        w.selectSymbol("fight");
        w.processOk();
      });
      await game.frames(2);
    };
    const callers = [];
    for (let t = 1; t <= 2; t++) {
      await game.eval(() => {
        Hai.Apostle.resetEngulf(0);
        Hai.Apostle.addEngulf(1, 80);
      });
      await fight();
      await waitState("actor:1");
      const cmds = await game.eval(() => SceneManager._scene._actorCommandWindow._list.map(c => `${c.symbol}:${c.name}:${c.enabled}`));
      check(cmds.join() === "guard:耐える:true,haiEndureCall:呼ぶ:true", "耐える戦いの主人公の命令 " + JSON.stringify(cmds));
      if (t === 1) await game.shot("endure-commands");
      callers.push(await game.eval(() => Hai.Apostle.nextCaller().actorId()));
      await pick(1, "haiEndureCall");
      await pick(5, "guard");
      await pick(6, "guard");
      // 残っている入力（ノラは 1 ターンに 2 回行動する）は防御にして、次の入力の番まで進める
      for (const t0 = Date.now(); Date.now() - t0 < 120_000; ) {
        const st = await sceneState();
        if (st === "party") break;
        if (st === "message") await game.press("Enter");
        else if (st.startsWith("actor:")) {
          await game.eval(() => {
            const w = SceneManager._scene._actorCommandWindow;
            if (!w.active) return;
            w.selectSymbol("guard");
            w.processOk();
          });
        }
        await game.frames(2);
      }
      await waitState("party");
      check(await game.eval(() => Hai.Apostle.engulf(1)) === 20, `${t} ターン目の「呼ぶ」で呑まれが 20 に下がらない`);
    }
    const texts = (await log()).texts;
    check(callers.join() === "5,6" && texts.includes("ブルーノ「あなた！　数えてください。いち、に、さん」") && texts.includes("ノラ「あんた！　あんた、顔が灰色！」"),
      "「呼ぶ」で仲間が順に呼ばない " + JSON.stringify({ callers, texts: texts.slice(-10) }));
    check(await game.eval(() => Hai.Apostle.isEndureBattle()), "耐える戦いと分からない");
    // 倒れたときの一言（ブルーノだけ）
    await game.eval(() => {
      const w = SceneManager._scene._logWindow;
      for (const id of [5, 6]) {
        const a = $gameActors.actor(id);
        a.clearResult();
        a.addState(a.deathStateId());
        w.displayAddedStates(a);
      }
    });
    await game.frames(30);
    const downs = (await log()).texts.filter(x => /「……/.test(x));
    check(downs.length === 1 && downs[0] === "ブルーノ「……数えてください」", "倒れたときの一言 " + JSON.stringify(downs));
    await leaveBattle();
    await game.call("setSpeed", 1);
    check(!(await game.eval(() => Hai.Apostle.isEndureBattle())), "戦闘の外で耐える戦いになっている");

    // ===== 6. 結末を見た =====
    check(!(await game.eval(() => Hai.Comfort.endingSeen())), "初めから結末を見たことになっている");
    await game.eval(sw => $gameSwitches.setValue(sw, true), ENDING);
    await game.eval(sw => $gameSwitches.setValue(sw, false), ENDING);
    check(await game.eval(() => Hai.Comfort.endingSeen()), "1159 を ON にしても結末を見たことにならない");

    // ===== 7. 記録を作る =====
    await game.call("transfer", SYMBOL_MAP, START.x, START.y, 2);
    await game.waitFor(id => window.__game.mapId() === id && !window.__game.isBusy(), SYMBOL_MAP);
    await game.call("save", 1); // 頂の手前の記録
    const before = await game.eval(() => DataManager.savefileInfo(1).timestamp);
    await game.eval(() => {
      $gameSwitches.setValue(21, false);
      $gameMap._interpreter.setup([
        { code: 357, indent: 0, parameters: ["Hai_Warp", "saveRecord", "記録を作る", { label: "朝の砦" }] },
        { code: 230, indent: 0, parameters: [30] },
        { code: 121, indent: 0, parameters: [21, 21, 0] },
        { code: 0, indent: 0, parameters: [] },
      ], 0);
    });
    await game.waitFor(() => $gameSwitches.value(21) && !$gameMap.isEventRunning());
    await game.waitFor(() => !!DataManager.savefileInfo(2));
    const infos = await game.eval(() => [1, 2, 3].map(i => {
      const info = DataManager.savefileInfo(i);
      return info ? { timestamp: info.timestamp, label: info.haiLabel || "" } : null;
    }));
    check(infos[0].timestamp === before && !infos[0].label && infos[1].label === "朝の砦" && infos[2] === null,
      "記録「朝の砦」が空いた枠に書かれない／頂の手前の記録が変わった " + JSON.stringify(infos));
    check(await game.eval(() => Hai.Warp.recordSlot()) === 3, "次の記録の枠が 3 でない");
    await game.eval(() => $gameSwitches.setValue(21, false));
    await game.call("load", 2);
    await game.waitScene("Scene_Map");
    await game.waitFor(() => $gameSwitches.value(21) && !$gameMap.isEventRunning());
    await game.frames(10);
    check(!(await game.eval(() => DataManager.savefileInfo(3))), "ロードしたら記録をもう一度作った");
    // 記録の一覧に名前が出る（見た目の確認用）
    await game.eval(() => SceneManager.push(Scene_Load));
    await game.waitScene("Scene_Load");
    await game.frames(10);
    await game.shot("record-list");
    await game.eval(() => SceneManager.pop());
    await game.waitScene("Scene_Map");

    // 結末を見た旗は、ページを読み直しても残る
    await game.reload();
    check(await game.eval(() => Hai.Comfort.endingSeen()), "読み直すと結末を見た旗が消える");

    game.assertNoErrors();
  } finally {
    await game.close();
  }
});
