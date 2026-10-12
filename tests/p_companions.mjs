// P6・P11 仲間（js/plugins/Hai_Companions.js）の検査。試験場 Map907（tools/maps/src/p6_companions）で：
//   遺骸を調べると found に入り、セルフスイッチ A と筋の旗（スイッチ 131）が入る／名の壁の輪で選ぶと暗転して目を開け、パーティに入る／
//   呼べる人がいないときの文／7 人（アクター 5〜11）の旗（スイッチ 131〜144、変数 131〜137）／
//   編成で並べ替え・入れ替え（主人公は控えに回せない）／戦闘に出るのは 4 人／檻破り（<hai_user_state>）で使った者が狙われる／
//   記憶 4 つで完全体になり強技を覚え、メモに 4 行／強技は完全体のほかでは覚えない／名前の変更（320）で主人公の名前が変わる／
//   セーブ・ロード（読み直しをはさむ）で残る。呼ぶ選択肢・目覚め・編成の画面・完全体の知らせのスクリーンショットを撮る。
import { launchGame, check, runTest } from "./lib.mjs";

const MAP = 907;
const SLOT = 7;
// 地図の座標（tools/maps/src/p6_companions.txt）
const START = { x: 3, y: 5 };
const BRUNO = { x: 4, y: 3, actor: 5 };
const NORA = { x: 9, y: 3, actor: 6 };
const CIRCLE = { x: 15, y: 3 };
const STONE = { x: 12, y: 9 };
const MEMORIES = [{ x: 4, y: 7 }, { x: 8, y: 7 }, { x: 12, y: 7 }, { x: 16, y: 7 }];
const VOW = 191; // 行軍（ブルーノの強技）
const CAGE = 182; // 檻破り（トゥーラの強技。<hai_user_state:193>）
const CAGE_STATE = 193;
const ACTORS = [5, 6, 7, 8, 9, 10, 11];

await runTest(async () => {
  const game = await launchGame();
  const hc = (fn, ...args) => game.eval(([f, a]) => window.Hai.Companions[f](...a), [fn, args]);
  const party = () => game.eval(() => $gameParty._actors.slice());
  const battleIds = () => game.eval(() => $gameParty.battleMembers().map(a => a.actorId()));

  async function go(x, y, d, mapId = MAP) {
    await game.call("transfer", mapId, x, y, d);
    await game.waitFor(([m, x2, y2]) => {
      const g = window.__game;
      const p = g.pos();
      return g.mapId() === m && p.x === x2 && p.y === y2 && !g.isBusy();
    }, [mapId, x, y]);
  }

  /**
   * 決定キーで調べ、イベントが終わるまで文章を読み進める。選択肢が出たら choices の順に選ぶ。
   * 出た文章（ページごと）を返す。shots は { ページの番号（0 始まり）: 名前, choice: 名前 }。
   */
  async function talk(choices = [], shots = {}) {
    const queue = choices.slice();
    await game.press("Enter");
    await game.waitFor(() => $gameMap.isEventRunning());
    const pages = [];
    for (;;) {
      await game.waitFor(() => {
        const s = SceneManager._scene;
        const w = s._messageWindow;
        const c = w && w._choiceListWindow;
        return !$gameMap.isEventRunning() || (w && w.pause) || (c && c.active && c.isOpen());
      });
      const st = await game.eval(() => {
        const w = SceneManager._scene._messageWindow;
        return {
          running: $gameMap.isEventRunning(),
          choice: !!(w && w._choiceListWindow.active && w._choiceListWindow.isOpen()),
          text: $gameMessage.allText(),
        };
      });
      if (!st.running) break;
      if (st.choice) {
        pages.push(st.text);
        if (shots.choice) await game.shot(shots.choice);
        const i = queue.shift() ?? 0;
        await game.eval(n => SceneManager._scene._messageWindow._choiceListWindow.select(n), i);
        await game.frames(2);
        await game.press("Enter");
      } else {
        pages.push(st.text);
        if (shots[pages.length - 1]) await game.shot(shots[pages.length - 1]);
        await game.frames(12); // ▼が出てから 10 フレームは決定を受け付けない
        await game.press("Enter");
      }
      await game.waitFor(prev => {
        const w = SceneManager._scene._messageWindow;
        return !$gameMap.isEventRunning() || !w.pause || $gameMessage.allText() !== prev;
      }, st.text);
      await game.frames(2);
    }
    await game.frames(3);
    return pages;
  }

  // 筋の旗（スイッチ 131–144・変数 102・131–137）。System.json に名前が入っていること（コアは名前の数を超える番号を無視する）
  check(await game.eval(() => $dataSystem.switches.length > 150 && $dataSystem.variables.length > 138), "System.json のスイッチ・変数の名前が 150・138 まで無い");
  const switchOn = id => game.eval(n => $gameSwitches.value(n), id);
  const variableIs = async (id, v) => (await game.eval(n => $gameVariables.value(n), id)) === v;

  const selfA = (x, y) => game.eval(([m, x2, y2]) => $gameSelfSwitches.value([m, $gameMap.eventIdXy(x2, y2), "A"]), [MAP, x, y]);

  try {
    await game.call("setSpeed", 2);
    await game.call("newGame");
    await game.waitScene("Scene_Map");
    await game.eval(() => {
      $gameParty._actors = [1]; // 初期パーティ（System.json）に左右されないように主人公だけにする
      $gamePlayer.refresh();
    });
    await go(START.x, START.y, 2);

    // ---- 7 人のデータ（docs/world.md 6.2・6.6）：名前・目覚めの一言・完全体の強技
    const roster = await game.eval(ids => ids.map(id => ({
      name: $dataActors[id].name,
      wake: !!$dataActors[id].meta.hai_wake,
      skill: (Hai.Companions.completeSkill(id) || {}).name || "",
    })), ACTORS);
    check(JSON.stringify(roster.map(r => r.name)) === JSON.stringify(["ブルーノ", "ノラ", "ディル", "ゼリナ", "アンセルモ", "ベルトラン", "トゥーラ"]), "7 人の名前 " + JSON.stringify(roster));
    check(roster.every(r => r.wake && r.skill), "目覚めの一言か強技の無い仲間がいる " + JSON.stringify(roster));
    check(roster[5].skill === "骨断ち" && roster[6].skill === "檻破り", "10・11 の強技 " + JSON.stringify(roster));

    // ---- 最初は誰も見つけていない。名の壁の輪は「呼べる人の遺骸も形見も、まだ置いていない」
    check((await hc("found")).length === 0 && (await hc("summoned")).length === 0, "最初から見つけている");
    check((await game.eval(() => Hai.Companions.maxBattleMembers)) === 4, "maxBattleMembers が 4 でない");
    await go(CIRCLE.x, CIRCLE.y + 1, 8);
    let pages = await talk();
    check(pages.length === 1 && pages[0].includes("まだ置いていない"), "空の名の壁 " + JSON.stringify(pages));

    // ---- 遺骸を調べると見つけた扱い（本文の後に「名の壁の輪に置けば、この人を呼べる。」）。遺骸は消える
    await go(BRUNO.x, BRUNO.y + 1, 8);
    pages = await talk();
    check(pages[0].includes("布で巻かれていない"), "ブルーノの遺骸の本文 " + JSON.stringify(pages));
    check(pages.at(-1).includes("名の壁の輪に置けば、この人を呼べる。"), "遺骸を見つけた文 " + JSON.stringify(pages));
    check(!pages.some(p => p.includes("ブルーノ")), "目覚める前に名前が出た " + JSON.stringify(pages));
    check(JSON.stringify(await hc("found")) === "[5]", "found " + JSON.stringify(await hc("found")));
    check(await selfA(BRUNO.x, BRUNO.y), "遺骸のセルフスイッチ A が OFF");
    check(await switchOn(131), "スイッチ 131（遺骸:ブルーノ）が OFF");
    check(await game.call("canPass", BRUNO.x, BRUNO.y + 1, 8), "見つけた遺骸が消えていない（通れない）");

    await go(NORA.x, NORA.y + 1, 8);
    pages = await talk();
    check(pages.at(-1).includes("この人を呼べる"), "ノラの遺骸 " + JSON.stringify(pages));
    check(JSON.stringify(await hc("found")) === "[5,6]", "found 2 人 " + JSON.stringify(await hc("found")));
    check((await switchOn(132)) && (await party()).length === 1, "スイッチ 132（遺骸:ノラ）／見つけただけでパーティに入った");

    // ---- 名の壁：ブルーノを選ぶ → 暗転 → 目を開ける（初対面の一言）→ パーティに入る
    await go(CIRCLE.x, CIRCLE.y + 1, 8);
    pages = await talk([0], { choice: "summon-choice", 2: "summon-wake" });
    check(pages[0].includes("誰を呼ぶ"), "名の壁の問いかけ " + JSON.stringify(pages));
    check(pages[1].includes("ブルーノが目を開けた"), "目覚めの文 " + JSON.stringify(pages));
    check(pages[2].includes("礼拝堂は、まだですか") && pages[2].includes("どこの隊の方です"), "目覚めの一言（初対面） " + JSON.stringify(pages));
    check(!pages.some(p => p.includes("墓守")), "目覚めで「墓守」と呼んだ " + JSON.stringify(pages));
    check(JSON.stringify(await party()) === "[1,5]", "呼んだ後のパーティ " + JSON.stringify(await party()));
    check(JSON.stringify(await hc("summoned")) === "[5]", "summoned " + JSON.stringify(await hc("summoned")));
    check((await switchOn(138)) && (await variableIs(102, 1)), "スイッチ 138（加入:ブルーノ）・変数 102（仲間の数）");
    check((await game.eval(() => $gameScreen.brightness())) === 255, "呼んだあと画面が暗いまま");

    // ---- 二度目：一覧にはノラだけ。「やめる」を選ぶと何も起きない
    pages = await talk([1]);
    check(JSON.stringify(await hc("summonable")) === "[6]", "summonable " + JSON.stringify(await hc("summonable")));
    check(JSON.stringify(await party()) === "[1,5]", "やめたのに増えた " + JSON.stringify(await party()));
    pages = await talk([0]);
    check(pages.some(p => p.includes("ノラが目を開けた")) && pages.some(p => p.includes("あんた、誰？")), "ノラの目覚め " + JSON.stringify(pages));
    check(JSON.stringify(await party()) === "[1,5,6]", "ノラを呼んだ後 " + JSON.stringify(await party()));
    pages = await talk();
    check(pages[0].includes("まだ置いていない"), "全員呼んだあとの名の壁 " + JSON.stringify(pages));

    // ---- 残りの 5 人も呼ぶ（窓口）→ 8 人。戦闘に出るのは先頭 4 人。旗は 7 人ぶん
    for (const id of [7, 8, 9, 10, 11]) await hc("summon", id);
    check(JSON.stringify(await party()) === "[1,5,6,7,8,9,10,11]", "8 人 " + JSON.stringify(await party()));
    check(JSON.stringify(await battleIds()) === "[1,5,6,7]", "戦闘メンバー " + JSON.stringify(await battleIds()));
    check(await variableIs(102, 7), "変数 102（仲間の数）が 7 でない");
    const flags = await game.eval(() => ({
      found: [131, 132, 133, 134, 135, 136, 137].map(n => $gameSwitches.value(n)),
      summoned: [138, 139, 140, 141, 142, 143, 144].map(n => $gameSwitches.value(n)),
      rest: [145, 146, 147, 148, 149, 150].map(n => $gameSwitches.value(n)),
    }));
    check(flags.found.every(Boolean) && flags.summoned.every(Boolean) && !flags.rest.some(Boolean), "スイッチ 131〜150 " + JSON.stringify(flags));

    // ---- 編成：石碑を調べて画面を開く。主人公を控えに回す入れ替えは断られる
    await go(STONE.x, STONE.y + 1, 8);
    await game.press("Enter");
    await game.waitScene("Scene_HaiParty");
    await game.waitFor(() => SceneManager._scene.isStarted() && SceneManager._scene._statusWindow.active);
    const pick = async i => {
      await game.eval(n => SceneManager._scene._statusWindow.select(n), i);
      await game.frames(2);
      await game.press("Enter");
      await game.frames(4);
    };
    await pick(0);
    await pick(4);
    check(JSON.stringify(await party()) === "[1,5,6,7,8,9,10,11]", "主人公が控えに回った " + JSON.stringify(await party()));
    const help = await game.eval(() => SceneManager._scene._helpWindow._text);
    check(help.includes("控えに回せない"), "断りの文 " + help);
    check(!(await hc("canSwap", 0, 4)) && (await hc("canSwap", 0, 2)), "canSwap");
    // 控え（ゼリナ）と戦闘メンバー（ブルーノ）を入れ替える
    await pick(1);
    await pick(4);
    check(JSON.stringify(await party()) === "[1,8,6,7,5,9,10,11]", "控えとの入れ替え " + JSON.stringify(await party()));
    // 主人公が戦闘メンバーの中で動くのはよい
    await pick(0);
    await pick(2);
    check(JSON.stringify(await party()) === "[6,8,1,7,5,9,10,11]", "主人公の並べ替え " + JSON.stringify(await party()));
    check(JSON.stringify(await battleIds()) === "[6,8,1,7]", "編成後の戦闘メンバー " + JSON.stringify(await battleIds()));
    await game.eval(() => {
      const w = SceneManager._scene._statusWindow; // 控えの 2 人が見える所で、1 人目を選んだ所
      w.setPendingIndex(4);
      w.select(5);
      w.ensureCursorVisible();
    });
    await game.frames(4);
    await game.shot("party");
    await game.press("Escape"); // 選んだのを取り消す
    await game.frames(4);
    await game.press("Escape");
    await game.waitScene("Scene_Map");
    await game.waitFor(() => !window.__game.isBusy());

    // ---- 戦闘に出るのは 4 人
    await game.call("startBattle", 1, true, false);
    await game.waitScene("Scene_Battle");
    await game.waitFor(() => SceneManager._scene.isStarted());
    for (let i = 0; i < 20 && (await game.eval(() => BattleManager._phase !== "input")); i++) {
      await game.frames(12); // 「〜が出現！」を閉じる
      await game.press("Enter");
    }
    await game.shot("battle");
    const inBattle = await game.eval(() => ({
      members: $gameParty.battleMembers().length,
      actions: BattleManager.allBattleMembers().filter(b => b.isActor()).length,
      status: SceneManager._scene._statusWindow.maxItems(),
    }));
    check(inBattle.members === 4 && inBattle.actions === 4 && inBattle.status === 4, "戦闘の人数 " + JSON.stringify(inBattle));

    // ---- 檻破り（<hai_user_state:193>）：戦闘で使うと、使った者に「檻破り」（狙われる）。戦闘の外では付かない
    const cage = await game.eval(([skillId, stateId]) => {
      const user = $gameParty.battleMembers()[0];
      const before = user.isStateAffected(stateId);
      user.useItem($dataSkills[skillId]);
      return { before, after: user.isStateAffected(stateId), name: $dataStates[stateId].name };
    }, [CAGE, CAGE_STATE]);
    check(!cage.before && cage.after && cage.name === "檻破り", "檻破りで使った者にステートが付かない " + JSON.stringify(cage));
    await game.eval(() => BattleManager.processAbort()); // 戦わずに終える
    await game.waitScene("Scene_Map");
    await game.waitFor(() => !window.__game.isBusy());
    const outside = await game.eval(([skillId, stateId]) => {
      const user = $gameActors.actor(11);
      user.useItem($dataSkills[skillId]);
      return user.isStateAffected(stateId);
    }, [CAGE, CAGE_STATE]);
    check(!outside, "戦闘の外で檻破りのステートが付いた");

    // ---- 強技は完全体のほかでは覚えない（ディルの職業「魔法使い」は Lv15 で 193 を覚える表がある）
    await game.eval(() => $gameActors.actor(7).changeLevel(30, false));
    check(!(await game.eval(() => $gameActors.actor(7).isLearnedSkill(193))), "完全体でないディルが強技を覚えた");

    // ---- 記憶の断片：1〜3 ではまだ完全体でない。メモに 1 行ずつ
    for (let n = 1; n <= 3; n++) {
      const m = MEMORIES[n - 1];
      await go(m.x, m.y + 1, 8);
      pages = await talk();
      check(pages.at(-1).includes(`ブルーノの記憶 ${n}/4`), `記憶 ${n} のメモの行 ` + JSON.stringify(pages));
      check(await selfA(m.x, m.y), `記憶 ${n} のセルフスイッチ A`);
    }
    check(JSON.stringify(await hc("memories", 5)) === "[1,2,3]", "memories(5) " + JSON.stringify(await hc("memories", 5)));
    check(!(await hc("isComplete", 5)), "3 つで完全体になった");
    check(!(await game.eval(id => $gameActors.actor(5).isLearnedSkill(id), VOW)), "3 つで強技を覚えた");
    check(await variableIs(131, 3), "変数 131（記憶:ブルーノ）が 3 でない");

    // ---- 4 つ目「臨終」で完全体
    const m4 = MEMORIES[3];
    await go(m4.x, m4.y + 1, 8);
    pages = await talk([], { 3: "complete" });
    check(pages[0].includes("礼拝堂の屋根が見える") && pages[1].includes("巻いてくれる人がいません"), "臨終の本文 " + JSON.stringify(pages));
    check(pages[2].includes("ブルーノの記憶 4/4「臨終」"), "臨終のメモの行 " + JSON.stringify(pages));
    check(pages[3].includes("完全体") && pages[3].includes("行軍"), "完全体の知らせ " + JSON.stringify(pages));
    check(await hc("isComplete", 5), "4 つで完全体にならない");
    check(await game.eval(id => $gameActors.actor(5).isLearnedSkill(id), VOW), "完全体で強技を覚えない");
    // 完全体はスイッチでなく変数 131（記憶:ブルーノ）が 4。完全体のスイッチは使わない（既定 0）ので 145〜150 は OFF のまま
    check((await variableIs(131, 4)) && !(await switchOn(145)), "完全体の変数 131 が 4 でない／スイッチ 145 が入った");
    let notes = await game.eval(() => Hai.Thoughts.notes("memory").map(n => n.text));
    check(notes.length === 4 && notes[3] === "ブルーノの記憶 4/4「臨終」", "記憶のメモ " + JSON.stringify(notes));

    // もう一度読んでもメモも知らせも増えない
    pages = await talk();
    check(!pages.some(p => p.includes("完全体") || p.includes("メモ：")), "読み直しで知らせが出た " + JSON.stringify(pages));
    check((await game.eval(() => Hai.Thoughts.notes("memory").length)) === 4, "読み直しでメモが増えた");

    // ---- 名前の欄（docs/world.md 3.1）：名前の変更（320）で主人公の名前が「ルカ」になる（仕組みは足さない）
    const renamed = await game.eval(() => {
      const before = $gameActors.actor(1).name();
      const it = new Game_Interpreter();
      it.setup([{ code: 320, indent: 0, parameters: [1, "ルカ"] }, { code: 0, indent: 0, parameters: [] }], 0);
      while (it.isRunning()) it.update();
      return { before, after: $gameActors.actor(1).name(), escaped: new Window_Base(new Rectangle(0, 0, 1, 1)).convertEscapeCharacters("\\N[1]") };
    });
    check(renamed.after === "ルカ" && renamed.escaped === "ルカ", "名前の変更（320） " + JSON.stringify(renamed));

    // ---- セーブ → 読み直し → ロード
    await game.call("save", SLOT);
    await game.reload();
    await game.call("load", SLOT);
    await game.waitScene("Scene_Map");
    await game.waitFor(() => !window.__game.isBusy());
    const after = await game.eval(id => ({
      found: Hai.Companions.found(),
      summoned: Hai.Companions.summoned(),
      memories: Hai.Companions.memories(5),
      complete: Hai.Companions.isComplete(5),
      skill: $gameActors.actor(5).isLearnedSkill(id),
      party: $gameParty._actors.slice(),
      notes: Hai.Thoughts.notes("memory").length,
      name: $gameActors.actor(1).name(),
    }), VOW);
    check(JSON.stringify(after) === JSON.stringify({
      found: ACTORS, summoned: ACTORS, memories: [1, 2, 3, 4], complete: true, skill: true,
      party: [6, 8, 1, 7, 5, 9, 10, 11], notes: 4, name: "ルカ",
    }), "ロード後 " + JSON.stringify(after));

    // ---- 古いセーブ（_hai.companions が無い）でも初期値で動く
    await game.eval(() => {
      delete $gameSystem._hai.companions;
    });
    check((await hc("found")).length === 0 && !(await hc("isComplete", 5)), "古いセーブの初期値");

    game.assertNoErrors();
  } finally {
    await game.close();
  }
});
