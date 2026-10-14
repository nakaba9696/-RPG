// U1 オートマップとメモの画面（js/plugins/Hai_AutoMap.js・Hai_Notes.js）の検査。試験場 Map906（tools/maps/src/u1_automap）で：
//   歩くと通った所が増える（足元と上下左右）／M キーとメニューで地図の画面が開き、縮尺が 1280×720 に収まる／
//   見えない通路は見つけるまで壁、見つけると隠し通路の色／思念を読むと印が既読に変わり、メモ画面に手がかりが出る／
//   施錠扉の印／宝箱を開けると入手ログに出る（ショップ・装備の付け替えは出ない。50 件まで）／
//   セーブ・ロード（ページの読み直しをはさむ）の後も残る／セーブの大きさがマップ 1 枚で 1KB 以内。
import { launchGame, check, runTest } from "./lib.mjs";

const MAP = 906;
const SLOT = 6;
// 地図の座標（tools/maps/src/u1_automap.txt）
const START = { x: 5, y: 7 };
const THOUGHT = { x: 6, y: 3, id: "U1a" };
const CHEST = { x: 10, y: 7 };
const MOSS = { x: 11, y: 5 }; // 見えない通路の手前の苔
const PASSAGE = { x: 12, y: 5 }; // 見えない通路（251）の入口
const CHEST2 = { x: 24, y: 4 };
const CHEST_ITEM = 7; // 二つの宝箱が渡す品（tools/maps/src/u1_automap.json）。入手の記録は品の今の名前で見る（W25 #293 で「煎じ薬」に改名）
const DOOR = { x: 17, y: 11 };

await runTest(async () => {
  const game = await launchGame();
  const am = (fn, ...args) => game.eval(([f, a]) => window.Hai.AutoMap[f](...a), [fn, args]);
  const th = (fn, ...args) => game.eval(([f, a]) => window.Hai.Thoughts[f](...a), [fn, args]);
  const scene = () => game.call("scene");

  async function go(x, y, d, mapId = MAP) {
    await game.call("transfer", mapId, x, y, d);
    await game.waitFor(([m, x2, y2]) => {
      const g = window.__game;
      const p = g.pos();
      return g.mapId() === m && p.x === x2 && p.y === y2 && !g.isBusy();
    }, [mapId, x, y]);
    await game.frames(2);
  }

  async function step(d) {
    const moved = await game.call("step", d);
    if (moved) await game.waitPlayerStopped();
    await game.frames(2);
    return moved;
  }

  /** 決定キーで調べ、出た文章をすべて閉じる（tests/p_thoughts.mjs と同じ手順）。 */
  async function readAll() {
    await game.press("Enter");
    await game.waitFor(() => window.__game.ref("$gameMessage").isBusy());
    for (;;) {
      await game.waitFor(() => {
        const s = window.__game.ref("SceneManager")._scene;
        return !window.__game.ref("$gameMessage").isBusy() || (s._messageWindow && s._messageWindow.pause);
      });
      if (!(await game.eval(() => window.__game.ref("$gameMessage").isBusy()))) break;
      const text = await game.eval(() => window.__game.ref("$gameMessage").allText());
      await game.frames(12);
      await game.press("Enter");
      await game.waitFor(prev => {
        const m = window.__game.ref("$gameMessage");
        return !m.isBusy() || m.allText() !== prev;
      }, text);
      await game.waitFor(() => {
        const g = window.__game;
        return g.ref("$gameMessage").isBusy() || !g.ref("$gameMap").isEventRunning();
      });
      if (!(await game.eval(() => window.__game.ref("$gameMessage").isBusy()))) break;
    }
    await game.waitFor(() => !window.__game.ref("$gameMap").isEventRunning());
    await game.frames(3);
  }

  const markAt = async (x, y) => (await am("marks")).find(m => m.x === x && m.y === y) || null;
  const itemLog = () => game.eval(() => window.Hai.Notes.itemLog());

  async function openMenu() {
    await game.press("Escape");
    await game.waitScene("Scene_Menu");
    await game.waitIdle();
  }

  async function menuCommand(symbol) {
    await game.eval(s => window.__game.ref("SceneManager")._scene._commandWindow.selectSymbol(s), symbol);
    await game.frames(2);
    await game.press("Enter");
  }

  try {
    await game.call("setSpeed", 2);
    await game.call("newGame");
    await game.waitScene("Scene_Map");
    await go(START.x, START.y, 2);

    // ---- 立ったマスと上下左右が記録される
    check((await am("visitedCount")) === 5, `最初の記録 ${await am("visitedCount")}`);
    for (const [dx, dy] of [[0, 0], [0, -1], [0, 1], [-1, 0], [1, 0]]) {
      check(await am("isVisited", START.x + dx, START.y + dy), `(${START.x + dx},${START.y + dy}) が記録されていない`);
    }
    check(!(await am("isVisited", START.x + 2, START.y)), "2 マス先まで記録された");
    check((await am("cellKind", START.x, START.y)) === "floor", "床が floor でない");
    check((await am("cellKind", START.x, START.y + 2)) === "none", "未踏のマスが none でない");

    // ---- 歩くと増える
    for (let i = 0; i < 3; i++) check(await step(6), `右へ ${i + 1} 歩目で進めない`);
    const afterWalk = await am("visitedCount");
    check(afterWalk === 5 + 9, `3 歩あるいた後の記録 ${afterWalk}`);
    check(await am("isVisited", START.x + 4, START.y), "歩いた先の隣が記録されていない");

    // ---- 思念：近づくと未読の印、読むと既読の印。手がかりがメモに入る
    await go(THOUGHT.x, THOUGHT.y + 1, 8);
    let m = await markAt(THOUGHT.x, THOUGHT.y);
    check(m && m.type === "unread", `読む前の思念の印 ${JSON.stringify(m)}`);
    await readAll();
    m = await markAt(THOUGHT.x, THOUGHT.y);
    check(m && m.type === "read", `読んだ後の思念の印 ${JSON.stringify(m)}`);
    check(await th("hasNote", "clue:U1a"), "思念の手がかりがメモにない");

    // ---- 宝箱：入手ログ
    await go(CHEST.x - 1, CHEST.y, 6);
    await readAll();
    let log = await itemLog();
    const itemName = await game.eval(id => $dataItems[id].name, CHEST_ITEM);
    check(itemName === "煎じ薬", `宝箱の品の名前 ${itemName}`);
    check(log.length === 1 && log[0].text.includes(itemName) && log[0].text.includes("オートマップの試験場"), `入手ログ ${JSON.stringify(log)}`);
    check(log[0].kind === "item" && log[0].mapId === MAP, `入手ログの欄 ${JSON.stringify(log[0])}`);

    // ---- 見えない通路：隣に立つと壁として記録、通り抜けると隠し通路の色
    await go(MOSS.x, MOSS.y, 6);
    check(await am("isVisited", PASSAGE.x, PASSAGE.y), "通路の入口が記録されていない");
    check((await am("cellKind", PASSAGE.x, PASSAGE.y)) === "wall", `見つける前の通路 ${await am("cellKind", PASSAGE.x, PASSAGE.y)}`);
    for (let i = 0; i < 8; i++) check(await step(6), `通路を ${i + 1} 歩目で進めない`);
    check((await am("cellKind", PASSAGE.x, PASSAGE.y)) === "hidden", `見つけた後の通路 ${await am("cellKind", PASSAGE.x, PASSAGE.y)}`);
    check((await am("cellKind", PASSAGE.x + 3, PASSAGE.y)) === "hidden", "通路の中ほどが hidden でない");
    check((await am("cellKind", PASSAGE.x + 3, PASSAGE.y - 1)) === "wall", "通路の脇の壁が wall でない");
    check((await am("foundPassages")) === 1, `見つけた隠し通路の数 ${await am("foundPassages")}`);

    // 東の部屋の宝箱（2 つ）
    await go(CHEST2.x - 1, CHEST2.y, 6);
    await readAll();
    log = await itemLog();
    check(log.length === 2 && log[0].text.includes("×2"), `2 つ目の入手ログ（新しい順） ${JSON.stringify(log)}`);

    // ---- 施錠扉の印
    await go(DOOR.x - 1, DOOR.y, 6);
    m = await markAt(DOOR.x, DOOR.y);
    check(m && m.type === "door", `施錠扉の印 ${JSON.stringify(m)}`);
    await readAll();
    check((await th("notes", "door")).length === 1, "扉のメモがない");

    // ---- 落とした魔石（P5 の Hai_Defeat。まだ無ければ同じ形の窓口を仮に置く）
    const stubbed = await game.eval(() => {
      const sys = window.__game.ref("$gameSystem");
      const drop = { mapId: 906, x: 8, y: 3, amount: 50 };
      if (window.Hai.Defeat) {
        sys._hai.defeat = sys._hai.defeat || {};
        sys._hai.defeat.drop = drop;
        return false;
      }
      window.Hai.Defeat = { drop: () => drop, drops: () => [drop] };
      return true;
    });
    m = await markAt(8, 3);
    check(m && m.type === "drop", `落とした魔石の印 ${JSON.stringify(await am("marks"))}`);

    // ---- M キーで地図の画面。縮尺が画面に収まる
    await go(MOSS.x, MOSS.y, 6);
    await game.press("m");
    await game.waitScene("Scene_HaiAutoMap");
    await game.waitIdle();
    const layout = await game.eval(() => window.__game.ref("SceneManager")._scene.layout());
    check(layout.mapWidth === 32 && layout.mapHeight === 16, `地図の大きさ ${JSON.stringify(layout)}`);
    check(layout.tile >= 2 && layout.x >= 0 && layout.y >= 0 && layout.x + layout.width <= 1280 && layout.y + layout.height <= 720, `地図が画面に収まらない ${JSON.stringify(layout)}`);
    await game.frames(10);
    await game.shot("automap");
    await game.press("Escape");
    await game.waitScene("Scene_Map");
    await game.waitIdle();

    // ---- メニュー：既定の並びはそのまま、「地図」「メモ」が増える
    await openMenu();
    const symbols = await game.eval(() => window.__game.ref("SceneManager")._scene._commandWindow._list.map(c => c.symbol));
    const defaults = ["item", "skill", "equip", "status", "formation", "options", "save", "gameEnd"];
    check(JSON.stringify(symbols.filter(s => defaults.includes(s))) === JSON.stringify(defaults.filter(s => symbols.includes(s))), `既定の並びが変わった ${symbols}`);
    check(symbols.includes("haiMap") && symbols.includes("haiNotes"), `メニューに地図・メモがない ${symbols}`);
    await menuCommand("haiMap");
    await game.waitScene("Scene_HaiAutoMap");
    await game.waitIdle();
    await game.press("Escape");
    await game.waitScene("Scene_Menu");
    await game.waitIdle();

    // ---- メモの画面：手がかり → 扉 → 入手
    await menuCommand("haiNotes");
    await game.waitScene("Scene_HaiNotes");
    await game.waitIdle();
    const listData = () => game.eval(() => window.__game.ref("SceneManager")._scene._listWindow._data.map(n => n.text));
    let rows = await listData();
    check(rows.length === 1 && rows[0].includes("苔の生えた床"), `手がかりの一覧 ${JSON.stringify(rows)}`);
    await game.press("Enter");
    await game.frames(4);
    const help = await game.eval(() => window.__game.ref("SceneManager")._scene._helpWindow._text);
    check(help.includes(`場所：オートマップの試験場 ${THOUGHT.x},${THOUGHT.y}`), `選んだときの場所 ${help}`);
    await game.shot("notes-clue");
    await game.press("Escape");
    await game.frames(4);
    await game.press("ArrowRight");
    await game.frames(4);
    rows = await listData();
    check(rows.length === 1 && rows[0].includes("試験場の鍵が要る扉"), `扉の一覧 ${JSON.stringify(rows)}`);
    await game.press("ArrowRight");
    await game.frames(4);
    rows = await listData();
    check(rows.length === 2 && rows[0].includes("×2") && rows[1].includes(itemName), `入手の一覧（新しい順） ${JSON.stringify(rows)}`);
    await game.press("Enter");
    await game.frames(4);
    await game.shot("notes-item");
    await game.press("Escape");
    await game.frames(4);
    await game.press("Escape");
    await game.waitScene("Scene_Menu");
    await game.waitIdle();
    await game.press("Escape");
    await game.waitScene("Scene_Map");
    await game.waitIdle();

    // ---- ショップの購入・売却と装備の付け替えは入手ログに出ない。所持金は出る
    await game.eval(() => {
      const SM = window.__game.ref("SceneManager");
      SM.push(Scene_Shop);
      SM.prepareNextScene([[0, 7, 0, 0]], false);
    });
    await game.waitScene("Scene_Shop");
    await game.waitIdle();
    await game.eval(() => {
      const s = window.__game.ref("SceneManager")._scene;
      window.__game.ref("$gameParty").gainGold(0);
      s._item = $dataItems[7];
      s.doBuy(1);
      s.doSell(1);
      const actor = window.__game.ref("$gameParty").members()[0];
      actor.changeEquip(0, null);
    });
    check((await itemLog()).length === 2, `ショップ・装備で入手ログが増えた ${JSON.stringify(await itemLog())}`);
    await game.eval(() => window.__game.ref("SceneManager").pop());
    await game.waitScene("Scene_Map");
    await game.waitIdle();
    await game.eval(() => window.__game.ref("$gameParty").gainGold(100));
    log = await itemLog();
    check(log.length === 3 && log[0].text.includes("魔石 100"), `魔石の入手ログ ${JSON.stringify(log[0])}`);

    // ---- 入手ログは 50 件まで（手がかり・扉は消えない）
    await game.eval(() => {
      for (let i = 0; i < 60; i++) window.__game.ref("$gameParty").gainItem($dataItems[7], 1);
    });
    log = await itemLog();
    check(log.length === 50, `入手ログの件数 ${log.length}`);
    check((await th("notes", "clue")).length === 1 && (await th("notes", "door")).length === 1, "入手ログを詰めたら手がかり・扉が消えた");

    if (stubbed) await game.eval(() => delete window.Hai.Defeat);

    // ---- セーブ → ページの読み直し → ロードで残る
    const visitedBefore = JSON.stringify(await am("visited", MAP));
    const notesBefore = JSON.stringify(await th("notes"));
    await game.call("save", SLOT);
    await game.reload();
    await game.call("load", SLOT);
    await game.waitScene("Scene_Map");
    await game.waitIdle();
    check(JSON.stringify(await am("visited", MAP)) === visitedBefore, "ロード後に通った所が変わった");
    check(JSON.stringify(await th("notes")) === notesBefore, "ロード後にメモが変わった");
    check((await am("cellKind", PASSAGE.x, PASSAGE.y)) === "hidden", "ロード後に隠し通路が hidden でない");
    m = await markAt(THOUGHT.x, THOUGHT.y);
    check(m && m.type === "read", "ロード後の思念の印");
    // ほかのマップに行っても記録は残り、読める
    await go(5, 11, 6, 902);
    check(JSON.stringify(await am("visited", MAP)) === visitedBefore, "ほかのマップから読んだ記録が違う");
    check((await am("mapName", MAP)) === "オートマップの試験場", `ほかのマップから見た表示名 ${await am("mapName", MAP)}`);
    check((await am("visitedCount", 902)) === 5, "ほかのマップの記録");
    await go(MOSS.x, MOSS.y, 6);

    // ---- セーブの大きさ：全部のマスを通っても 1KB 以内
    await game.eval(() => {
      for (let y = 0; y < 16; y++) for (let x = 0; x < 32; x++) window.Hai.AutoMap.markVisited(906, x, y);
    });
    check((await am("visitedCount")) === 32 * 16, "全部のマスを記録できない");
    const size = await game.eval(() => JSON.stringify(window.__game.ref("$gameSystem")._hai.automap[906]).length);
    check(size <= 1024, `マップ 1 枚の記録が 1KB を超える（${size}）`);
    console.log(`  Map906（32×16）の記録の大きさ：${size} バイト`);

    game.assertNoErrors();
  } finally {
    await game.close();
  }
});
