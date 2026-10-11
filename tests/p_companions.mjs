// P6 仲間（js/plugins/Hai_Companions.js）の検査。試験場 Map907（tools/maps/src/p6_companions）で：
//   遺骸を調べると found に入り、セルフスイッチ A と筋の旗（スイッチ 131）が入る／召喚陣で選ぶと暗転して目を覚まし、パーティに入る／
//   呼び戻せる魂がないときの文／編成で並べ替え・入れ替え（主人公は控えに回せない）／戦闘に出るのは 4 人／
//   記憶 4 つで完全体になり強技を覚え、メモに 4 行／強技は完全体のほかでは覚えない／セーブ・ロード（読み直しをはさむ）で残る。
//   召喚の選択肢・目覚め・編成の画面・完全体の知らせのスクリーンショットを撮る。
import { launchGame, check, runTest } from "./lib.mjs";

const MAP = 907;
const SLOT = 7;
// 地図の座標（tools/maps/src/p6_companions.txt）
const START = { x: 3, y: 5 };
const ORDO = { x: 4, y: 3, actor: 5 };
const ZAZA = { x: 9, y: 3, actor: 6 };
const CIRCLE = { x: 15, y: 3 };
const STONE = { x: 12, y: 9 };
const MEMORIES = [{ x: 4, y: 7 }, { x: 8, y: 7 }, { x: 12, y: 7 }, { x: 16, y: 7 }];
const VOW = 191; // 鉄の誓い（オルドの強技）

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

  // 筋の旗（docs/world.md 8 章）は W1 が System.json に名前を入れるまで無い（コアは名前の数を超える番号を無視する）。在るときだけ確かめる
  const flagsReady = () => game.eval(() => $dataSystem.switches.length > 145 && $dataSystem.variables.length > 135);
  const switchOn = async id => !(await flagsReady()) || game.eval(n => $gameSwitches.value(n), id);
  const variableIs = async (id, v) => !(await flagsReady()) || (await game.eval(n => $gameVariables.value(n), id)) === v;

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

    // ---- 最初は誰も見つけていない。召喚陣は「まだ呼び戻せる魂がない」
    check((await hc("found")).length === 0 && (await hc("summoned")).length === 0, "最初から見つけている");
    check((await game.eval(() => Hai.Companions.maxBattleMembers)) === 4, "maxBattleMembers が 4 でない");
    await go(CIRCLE.x, CIRCLE.y + 1, 8);
    let pages = await talk();
    check(pages.length === 1 && pages[0].includes("まだ呼び戻せる魂がない"), "空の召喚陣 " + JSON.stringify(pages));

    // ---- 遺骸を調べると見つけた扱い（本文の後に「遺骸を拠点へ送った」）。遺骸は消える
    await go(ORDO.x, ORDO.y + 1, 8);
    pages = await talk();
    check(pages[0].includes("帝国の工兵の徽章"), "オルドの遺骸の本文 " + JSON.stringify(pages));
    check(pages.at(-1).includes("オルドの遺骸を拠点へ送った"), "遺骸を送った文 " + JSON.stringify(pages));
    check(JSON.stringify(await hc("found")) === "[5]", "found " + JSON.stringify(await hc("found")));
    check(await selfA(ORDO.x, ORDO.y), "遺骸のセルフスイッチ A が OFF");
    check(await switchOn(131), "スイッチ 131（遺骸:オルド）が OFF");
    check(await game.call("canPass", ORDO.x, ORDO.y + 1, 8), "送った遺骸が消えていない（通れない）");

    await go(ZAZA.x, ZAZA.y + 1, 8);
    pages = await talk();
    check(pages.at(-1).includes("ザザの遺骸を拠点へ送った"), "ザザの遺骸 " + JSON.stringify(pages));
    check(JSON.stringify(await hc("found")) === "[5,6]", "found 2 人 " + JSON.stringify(await hc("found")));
    check((await party()).length === 1, "見つけただけでパーティに入った");

    // ---- 召喚陣：オルドを選ぶ → 暗転 → 目を覚ます → パーティに入る
    await go(CIRCLE.x, CIRCLE.y + 1, 8);
    pages = await talk([0], { choice: "summon-choice", 2: "summon-wake" });
    check(pages[0].includes("どの魂を呼び戻す"), "召喚陣の問いかけ " + JSON.stringify(pages));
    check(pages[1].includes("オルドが目を覚ました"), "目覚めの文 " + JSON.stringify(pages));
    check(pages[2].includes("梁は、まだ持っているか"), "目覚めの一言 " + JSON.stringify(pages));
    check(JSON.stringify(await party()) === "[1,5]", "召喚後のパーティ " + JSON.stringify(await party()));
    check(JSON.stringify(await hc("summoned")) === "[5]", "summoned " + JSON.stringify(await hc("summoned")));
    check((await switchOn(136)) && (await variableIs(102, 1)), "スイッチ 136（加入:オルド）・変数 102（仲間の数）");
    check((await game.eval(() => $gameScreen.brightness())) === 255, "召喚のあと画面が暗いまま");

    // ---- 二度目：一覧にはザザだけ。「やめる」を選ぶと何も起きない
    pages = await talk([1]);
    check(JSON.stringify(await hc("summonable")) === "[6]", "summonable " + JSON.stringify(await hc("summonable")));
    check(JSON.stringify(await party()) === "[1,5]", "やめたのに増えた " + JSON.stringify(await party()));
    pages = await talk([0]);
    check(pages.some(p => p.includes("ザザが目を覚ました")), "ザザの目覚め " + JSON.stringify(pages));
    check(JSON.stringify(await party()) === "[1,5,6]", "ザザの召喚後 " + JSON.stringify(await party()));
    pages = await talk();
    check(pages[0].includes("まだ呼び戻せる魂がない"), "全員呼んだあとの召喚陣 " + JSON.stringify(pages));

    // ---- 残りの 3 人も呼ぶ（窓口）→ 6 人。戦闘に出るのは先頭 4 人
    for (const id of [7, 8, 9]) await hc("summon", id);
    check(JSON.stringify(await party()) === "[1,5,6,7,8,9]", "6 人 " + JSON.stringify(await party()));
    check(JSON.stringify(await battleIds()) === "[1,5,6,7]", "戦闘メンバー " + JSON.stringify(await battleIds()));
    check(await variableIs(102, 5), "変数 102（仲間の数）が 5 でない");

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
    check(JSON.stringify(await party()) === "[1,5,6,7,8,9]", "主人公が控えに回った " + JSON.stringify(await party()));
    const help = await game.eval(() => SceneManager._scene._helpWindow._text);
    check(help.includes("控えに回せない"), "断りの文 " + help);
    check(!(await hc("canSwap", 0, 4)) && (await hc("canSwap", 0, 2)), "canSwap");
    // 控え（ルメ）と戦闘メンバー（オルド）を入れ替える
    await pick(1);
    await pick(4);
    check(JSON.stringify(await party()) === "[1,8,6,7,5,9]", "控えとの入れ替え " + JSON.stringify(await party()));
    // 主人公が戦闘メンバーの中で動くのはよい
    await pick(0);
    await pick(2);
    check(JSON.stringify(await party()) === "[6,8,1,7,5,9]", "主人公の並べ替え " + JSON.stringify(await party()));
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
    await game.eval(() => BattleManager.processAbort()); // 戦わずに終える
    await game.waitScene("Scene_Map");
    await game.waitFor(() => !window.__game.isBusy());

    // ---- 強技は完全体のほかでは覚えない（ノクスの職業「魔法使い」は Lv15 で 193 を覚える表がある）
    await game.eval(() => $gameActors.actor(7).changeLevel(30, false));
    check(!(await game.eval(() => $gameActors.actor(7).isLearnedSkill(193))), "完全体でないノクスが強技を覚えた");

    // ---- 記憶の断片：1〜3 ではまだ完全体でない。メモに 1 行ずつ
    for (let n = 1; n <= 3; n++) {
      const m = MEMORIES[n - 1];
      await go(m.x, m.y + 1, 8);
      pages = await talk();
      check(pages.at(-1).includes(`オルドの記憶 ${n}/4`), `記憶 ${n} のメモの行 ` + JSON.stringify(pages));
      check(await selfA(m.x, m.y), `記憶 ${n} のセルフスイッチ A`);
    }
    check(JSON.stringify(await hc("memories", 5)) === "[1,2,3]", "memories(5) " + JSON.stringify(await hc("memories", 5)));
    check(!(await hc("isComplete", 5)), "3 つで完全体になった");
    check(!(await game.eval(id => $gameActors.actor(5).isLearnedSkill(id), VOW)), "3 つで強技を覚えた");
    check(await variableIs(131, 3), "変数 131（記憶:オルド）が 3 でない");

    // ---- 4 つ目「臨終」で完全体
    const m4 = MEMORIES[3];
    await go(m4.x, m4.y + 1, 8);
    pages = await talk([], { 3: "complete" });
    check(pages[0].includes("天井が鳴った") && pages[1].includes("この梁は俺を覚えている"), "臨終の本文 " + JSON.stringify(pages));
    check(pages[2].includes("オルドの記憶 4/4「臨終」"), "臨終のメモの行 " + JSON.stringify(pages));
    check(pages[3].includes("完全体") && pages[3].includes("鉄の誓い"), "完全体の知らせ " + JSON.stringify(pages));
    check(await hc("isComplete", 5), "4 つで完全体にならない");
    check(await game.eval(id => $gameActors.actor(5).isLearnedSkill(id), VOW), "完全体で強技を覚えない");
    check(await switchOn(141), "スイッチ 141（完全体:オルド）が OFF");
    let notes = await game.eval(() => Hai.Thoughts.notes("memory").map(n => n.text));
    check(notes.length === 4 && notes[3] === "オルドの記憶 4/4「臨終」", "記憶のメモ " + JSON.stringify(notes));

    // もう一度読んでもメモも知らせも増えない
    pages = await talk();
    check(!pages.some(p => p.includes("完全体") || p.includes("メモ：")), "読み直しで知らせが出た " + JSON.stringify(pages));
    check((await game.eval(() => Hai.Thoughts.notes("memory").length)) === 4, "読み直しでメモが増えた");

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
    }), VOW);
    check(JSON.stringify(after) === JSON.stringify({
      found: [5, 6, 7, 8, 9], summoned: [5, 6, 7, 8, 9], memories: [1, 2, 3, 4], complete: true, skill: true,
      party: [6, 8, 1, 7, 5, 9], notes: 4,
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
