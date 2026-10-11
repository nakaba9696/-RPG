// U4 アイテムの来歴と遺物の記録（js/plugins/Hai_Lore.js）の検査。試験場 Map914（tools/maps/src/u4_lore）で：
//   来歴つきの消耗品・大事なもの・短剣を宝箱から拾う → 初めての物に一言の知らせ・遺物の記録に載る（来歴の無い石は載らない）→
//   倉庫行き（上限 1 の丸薬の 2 つ目）でも記録される → アイテムの画面で一覧に印・説明の窓の案内 →
//   R キーで来歴の窓（6 行が 4 行＋2 行のページ送り）→ 説明の窓を押しても開く → 使って消える →
//   メモの画面の 4 つ目「遺物」に残っていて「手放した」・読める・並びの切り替え → 装備の画面の欄からも読める →
//   セーブ・ページの読み直し・ロードで残る → 古いセーブ（記録の欄が無い）でも壊れない。
import { launchGame, check, runTest } from "./lib.mjs";

const MAP = 914;
const SLOT = 8;
// 地図の座標（tools/maps/src/u4_lore.txt）。宝箱は y=3 の列、下の y=4 から上を向いて開ける
const CHEST = { vial: 3, pill: 5, pill2: 7, tag: 9, dagger: 11, stone: 13 };
const ROW = 3;

await runTest(async () => {
  const game = await launchGame();
  const lore = (fn, ...args) => game.eval(([f, a]) => window.Hai.Lore[f](...a), [fn, args]);
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

  let noticeShot = false;
  /** 決定キーで調べ、出た文章をすべて閉じる。知らせが続けて出たり、1 つの文章が数ページになったりするので、入力待ちのたびに押す。 */
  async function readAll() {
    await game.press("Enter");
    await game.waitFor(() => window.__game.ref("$gameMessage").isBusy());
    for (let i = 0; i < 20; i++) {
      await game.waitFor(() => {
        const w = window.__game.ref("SceneManager")._scene._messageWindow;
        return !window.__game.ref("$gameMessage").isBusy() || (w && w.pause && w.isOpen()); // ページの区切りでも pause になる（_textState は残る）
      });
      const busy = await game.eval(() => window.__game.ref("$gameMessage").isBusy());
      if (!busy) {
        await game.frames(5);
        const more = await game.eval(() => window.__game.ref("$gameMessage").isBusy() || window.__game.ref("$gameMap").isEventRunning());
        if (!more) break;
        continue;
      }
      await game.frames(6);
      if (!noticeShot && (await game.eval(() => window.__game.ref("$gameMessage").allText().includes("来歴を読める")))) {
        noticeShot = true;
        await game.shot("notice-window");
      }
      await game.press("Enter"); // 押している 3 フレームの間に pause が外れる（次の文が瞬間表示でもすぐ次の待ちに入れる）
      await game.frames(3);
    }
    await game.waitFor(() => !window.__game.ref("$gameMap").isEventRunning() && !window.__game.ref("$gameMessage").isBusy());
    await game.frames(3);
  }

  /** 宝箱を開け、そのあいだに出た文章の行を返す。 */
  async function openChest(x) {
    await go(x, ROW + 1, 8);
    await game.eval(() => (window.__loreMessages = []));
    await readAll();
    return game.eval(() => window.__loreMessages.slice());
  }

  const recordIds = async () => (await lore("records")).map(r => `${r.kind}:${r.id}`);
  const reader = () => game.eval(() => {
    const r = window.__game.ref("SceneManager")._scene._haiLoreReader;
    return r ? { reading: r.isReading(), page: r.page(), pages: r.pageCount(), lines: r.pageLines(), item: r.item() && r.item().name, open: r.isOpen() } : null;
  });

  async function waitReaderOpen() {
    await game.waitFor(() => {
      const r = window.__game.ref("SceneManager")._scene._haiLoreReader;
      return r && r.isReading() && r.isOpen();
    });
    await game.frames(2);
  }
  async function waitReaderClosed() {
    await game.waitFor(() => {
      const r = window.__game.ref("SceneManager")._scene._haiLoreReader;
      return r && !r.isReading() && r.isClosed();
    });
    await game.frames(2);
  }

  /** 来歴の窓を最後のページまで読んで閉じる。読んだページの行を返す。 */
  async function readThrough() {
    const pages = [];
    for (;;) {
      const r = await reader();
      pages.push(r.lines);
      await game.press("Enter");
      if (r.page >= r.pages - 1) break;
      await game.waitFor(p => window.__game.ref("SceneManager")._scene._haiLoreReader.page() === p, r.page + 1);
      await game.frames(2);
    }
    await waitReaderClosed();
    return pages;
  }

  /** キャンバスの上の点（ゲームの座標）をマウスで押す。 */
  async function tap(x, y) {
    const box = await game.page.locator("#gameCanvas").boundingBox();
    const g = await game.eval(() => ({ w: window.__game.ref("Graphics").width, h: window.__game.ref("Graphics").height }));
    await game.page.mouse.click(box.x + (x * box.width) / g.w, box.y + (y * box.height) / g.h);
  }

  try {
    await game.call("setSpeed", 2);
    await game.call("newGame");
    await game.waitScene("Scene_Map");
    // 文章の行を集める（知らせの確かめ）
    await game.eval(() => {
      const m = window.__game.ref("$gameMessage");
      const add = m.add;
      m.add = function(text) {
        (window.__loreMessages = window.__loreMessages || []).push(text);
        return add.apply(this, arguments);
      };
    });
    await go(3, 5, 8);

    // ---- 窓口：メモ欄の来歴
    const vialLines = await game.eval(() => window.Hai.Lore.lines($dataItems[941]));
    check(vialLines.length === 6 && vialLines[0].startsWith("試験場の棚に"), `小瓶の来歴 ${JSON.stringify(vialLines)}`);
    check(await game.eval(() => window.Hai.Lore.text($dataItems[942]).split("\n").length === 3), "丸薬の来歴が 3 行でない");
    check(!(await game.eval(() => window.Hai.Lore.has($dataItems[944]))), "ただの石に来歴がある");
    check((await lore("records")).length === 0, "最初から記録がある");

    // ---- 宝箱：初めての物でも来歴の知らせは出さない（既定）。記録には載る
    const toasts = () => game.eval(() => window.Hai.Items.toastState().log);
    check(await game.eval(() => window.Hai.Lore.params.noticeText === "" && window.Hai.Lore.params.noticeStyle === "toast"), "知らせの既定が空・通知でない");
    let msgs = await openChest(CHEST.vial);
    check(!msgs.some(t => t.includes("来歴")), `小瓶で来歴の窓が出た ${JSON.stringify(msgs)}`);
    check(!(await toasts()).some(t => t.includes("来歴")), `小瓶で来歴の通知が出た ${JSON.stringify(await toasts())}`);
    check(JSON.stringify(await recordIds()) === JSON.stringify(["item:941"]), `小瓶が記録に載らない ${await recordIds()}`);

    // 知らせを入れると（通知）：窓は出ず、画面の端に小さく出て、操作を止めない
    await game.eval(() => (window.Hai.Lore.params.noticeText = "%1の来歴を読める。"));
    msgs = await openChest(CHEST.pill);
    check(!msgs.some(t => t.includes("来歴")), `通知なのに窓が出た ${JSON.stringify(msgs)}`);
    await game.waitFor(() => window.Hai.Items.toastState().log.some(t => t.includes("試しの丸薬の来歴を読める。")));
    check((await game.eval(() => window.Hai.Items.toastState().shown) || "").includes("試しの丸薬の来歴を読める。"), "通知が出ていない");
    check(await game.eval(() => !window.__game.ref("$gameMessage").isBusy() && !window.__game.ref("$gameMap").isEventRunning()), "通知が操作を止めている");
    await game.shot("notice-toast");

    // 知らせの出し方を「文章」にすると、元のように文章の窓で出る
    await game.eval(() => (window.Hai.Lore.params.noticeStyle = "window"));
    msgs = await openChest(CHEST.tag);
    check(msgs.some(t => t.includes("来歴を読める。")), `文章の知らせ ${JSON.stringify(msgs)}`);
    await game.eval(() => {
      window.Hai.Lore.params.noticeStyle = "toast";
      window.Hai.Lore.params.noticeText = "";
    });
    await openChest(CHEST.dagger);
    msgs = await openChest(CHEST.stone);
    check(!msgs.some(t => t.includes("来歴")), `ただの石で来歴の知らせが出た ${JSON.stringify(msgs)}`);
    check(JSON.stringify(await recordIds()) === JSON.stringify(["item:941", "item:942", "item:943", "weapon:941"]), `記録（手に入れた順） ${await recordIds()}`);
    const rec = (await lore("records"))[0];
    check(rec.mapId === MAP && rec.x === CHEST.vial && rec.y === ROW + 1, `記録の場所 ${JSON.stringify(rec)}`);

    // ---- 倉庫行き：袋が上限（丸薬は 1 つまで）のとき、2 つ目は倉庫へ送られる。初めてならそれでも記録される
    await game.eval(() => {
      const s = window.__game.ref("$gameSystem")._hai.lore;
      s.list = s.list.filter(r => !(r.kind === "item" && r.id === 942)); // 袋の 1 つを記録の外から入れた形にする
    });
    msgs = await openChest(CHEST.pill2);
    check(await game.eval(() => window.Hai.Items.storageCount("item", 942)) === 1, "丸薬の 2 つ目が倉庫へ行っていない");
    check(await game.eval(() => window.__game.ref("$gameParty").numItems($dataItems[942])) === 1, "袋の丸薬の数");
    check(JSON.stringify(await recordIds()) === JSON.stringify(["item:941", "item:943", "weapon:941", "item:942"]), `倉庫行きの記録 ${await recordIds()}`);
    check(!msgs.some(t => t.includes("倉庫へ送られた") || t.includes("来歴")), `倉庫行きで文章の窓が出た ${JSON.stringify(msgs)}`);
    await game.waitFor(() => window.Hai.Items.toastState().log.some(t => t.includes("倉庫へ送られた")));

    // ---- アイテムの画面：一覧の印と説明の窓の案内
    await game.eval(() => window.__game.ref("SceneManager").push(Scene_Item));
    await game.waitScene("Scene_Item");
    await game.waitIdle();
    await game.press("Enter"); // カテゴリ「アイテム」
    await game.waitFor(() => window.__game.ref("SceneManager")._scene._itemWindow.active);
    const marks = await game.eval(() => {
      const w = window.__game.ref("SceneManager")._scene._itemWindow;
      const drawn = [];
      const orig = w.drawText;
      w.drawText = function(text) {
        drawn.push(String(text));
        return orig.apply(this, arguments);
      };
      w.refresh();
      w.drawText = orig;
      return { marks: drawn.filter(t => t === "◆").length, names: w._data.map(i => i && i.name) };
    });
    check(marks.marks === 2, `一覧の印の数（小瓶・丸薬に付き、石に付かない） ${JSON.stringify(marks)}`);
    // 小瓶を選ぶ
    await game.eval(() => {
      const w = window.__game.ref("SceneManager")._scene._itemWindow;
      w.select(w._data.findIndex(i => i && i.id === 941));
    });
    await game.frames(3);
    check(await game.eval(() => window.__game.ref("SceneManager")._scene._helpWindow._haiLoreItem?.id === 941), "説明の窓が小瓶を出していない");
    await game.shot("item-list");

    // R キーで来歴の窓（6 行 → 4 行と 2 行）
    await game.press("KeyR");
    await waitReaderOpen();
    let r = await reader();
    check(r.item === "試しの小瓶" && r.pages === 2 && r.page === 0 && r.lines.length === 4, `来歴の窓 1 ページ目 ${JSON.stringify(r)}`);
    check(!(await game.eval(() => window.__game.ref("SceneManager")._scene._itemWindow.active)), "来歴の窓の間も一覧が動く");
    await game.shot("reader-page1");
    await game.press("Enter");
    await game.waitFor(() => window.__game.ref("SceneManager")._scene._haiLoreReader.page() === 1);
    await game.frames(4);
    r = await reader();
    check(r.lines.length === 2 && r.lines[1] === vialLines[5], `来歴の窓 2 ページ目 ${JSON.stringify(r)}`);
    await game.shot("reader-page2");
    // ← で戻り、→ で進み、決定で閉じる
    await game.press("ArrowLeft");
    await game.waitFor(() => window.__game.ref("SceneManager")._scene._haiLoreReader.page() === 0);
    await game.press("ArrowRight");
    await game.waitFor(() => window.__game.ref("SceneManager")._scene._haiLoreReader.page() === 1);
    await game.press("Enter");
    await waitReaderClosed();
    check(await game.eval(() => window.__game.ref("SceneManager")._scene._itemWindow.active), "来歴の窓を閉じても一覧に戻らない");
    check((await scene()) === "Scene_Item", `閉じたらアイテムの画面から出た ${await scene()}`);

    // 説明の窓を押しても開く（タッチ）。キャンセルで閉じる
    const help = await game.eval(() => {
      const s = window.__game.ref("SceneManager")._scene;
      const h = s._helpWindow;
      return { x: h.x + s._windowLayer.x + h.width / 2, y: h.y + s._windowLayer.y + h.height / 2 };
    });
    await tap(help.x, help.y);
    await waitReaderOpen();
    check((await reader()).item === "試しの小瓶", "説明の窓を押して開いた来歴");
    await game.press("Escape");
    await waitReaderClosed();
    check((await scene()) === "Scene_Item", "キャンセルで来歴の窓だけが閉じない");

    // 使って消える（HP を減らしてから、決定 → 使う相手 → 決定）
    await game.eval(() => window.__game.ref("$gameParty").leader().setHp(1));
    await game.press("Enter");
    await game.waitFor(() => window.__game.ref("SceneManager")._scene._actorWindow.active);
    await game.press("Enter");
    await game.waitFor(() => window.__game.ref("$gameParty").numItems($dataItems[941]) === 0);
    check(await game.eval(() => window.__game.ref("$gameParty").leader().hp > 1), "小瓶を使っても回復していない");
    check(!(await game.eval(() => window.Hai.Lore.isOwned($dataItems[941]))), "使った小瓶をまだ持っている");
    check((await recordIds()).includes("item:941"), "使った小瓶が記録から消えた");
    await game.press("Escape");
    await game.press("Escape");
    await game.press("Escape");
    await game.waitScene("Scene_Map");
    await game.waitIdle();

    // ---- 遺物の記録（メモの画面の 4 つ目の種類）
    await game.press("Escape");
    await game.waitScene("Scene_Menu");
    await game.waitIdle();
    await game.eval(() => window.__game.ref("SceneManager")._scene._commandWindow.selectSymbol("haiNotes"));
    await game.frames(2);
    await game.press("Enter");
    await game.waitScene("Scene_HaiNotes");
    await game.waitIdle();
    const tabs = await game.eval(() => window.__game.ref("SceneManager")._scene._categoryWindow._list.map(c => c.name));
    check(tabs.length === 4 && tabs[3] === "遺物（4）", `メモの画面の種類 ${JSON.stringify(tabs)}`);
    for (let i = 0; i < 3; i++) await game.press("ArrowRight");
    await game.waitFor(() => window.__game.ref("SceneManager")._scene._categoryWindow.currentSymbol() === "haiLore");
    await game.frames(3);
    check(await game.eval(() => {
      const s = window.__game.ref("SceneManager")._scene;
      return s._haiLoreList.visible && !s._listWindow.visible;
    }), "遺物の種類で記録の一覧が出ていない");
    await game.press("Enter");
    await game.waitFor(() => window.__game.ref("SceneManager")._scene._haiLoreList.active);
    const listed = await game.eval(() => {
      const w = window.__game.ref("SceneManager")._scene._haiLoreList;
      const drawn = [];
      const orig = w.drawText;
      w.drawText = function(text) {
        drawn.push(String(text));
        return orig.apply(this, arguments);
      };
      w.refresh();
      w.drawText = orig;
      return { ids: w._data.map(r => `${r.kind}:${r.id}`), released: drawn.filter(t => t === "手放した").length, order: w.order() };
    });
    check(listed.order === "time" && JSON.stringify(listed.ids) === JSON.stringify(["item:941", "item:943", "weapon:941", "item:942"]), `記録の一覧（手に入れた順） ${JSON.stringify(listed)}`);
    check(listed.released === 1, `「手放した」の数（使った小瓶だけ） ${JSON.stringify(listed)}`);
    await game.shot("records");
    // 使った小瓶を読む
    await game.press("Enter");
    await waitReaderOpen();
    check((await reader()).item === "試しの小瓶", "記録から開いた来歴");
    const pages = await readThrough();
    check(JSON.stringify(pages.flat()) === JSON.stringify(vialLines), `記録から読んだ来歴 ${JSON.stringify(pages)}`);
    check(await game.eval(() => window.__game.ref("SceneManager")._scene._haiLoreList.active), "来歴を閉じても記録の一覧に戻らない");
    // Q・W で並びを切り替える（種類別：道具 → 大事なもの → 武器）
    await game.press("KeyW");
    await game.frames(3);
    const byKind = await game.eval(() => {
      const w = window.__game.ref("SceneManager")._scene._haiLoreList;
      return { order: w.order(), ids: w._data.map(r => `${r.kind}:${r.id}`), help: window.__game.ref("SceneManager")._scene._helpWindow._text };
    });
    check(byKind.order === "kind" && JSON.stringify(byKind.ids) === JSON.stringify(["item:941", "item:942", "item:943", "weapon:941"]), `種類別の並び ${JSON.stringify(byKind)}`);
    check(byKind.help.includes("種類別"), `説明の窓に並びが出ない ${byKind.help}`);
    await game.shot("records-kind");
    await game.press("KeyQ");
    await game.frames(3);
    check(await game.eval(() => window.__game.ref("SceneManager")._scene._haiLoreList.order()) === "time", "並びが手に入れた順に戻らない");
    await game.press("Escape");
    await game.waitFor(() => window.__game.ref("SceneManager")._scene._categoryWindow.active);
    await game.press("Escape");
    await game.waitScene("Scene_Menu");

    // ---- 装備の画面：装備している短剣の来歴を欄から読む
    await game.eval(() => {
      const g = window.__game;
      g.ref("$gameParty").leader().changeEquip(0, $dataWeapons[941]);
      g.ref("SceneManager").push(Scene_Equip);
    });
    await game.waitScene("Scene_Equip");
    await game.waitIdle();
    await game.press("Enter"); // 「装備」→ 欄へ
    await game.waitFor(() => window.__game.ref("SceneManager")._scene._slotWindow.active);
    await game.eval(() => window.__game.ref("SceneManager")._scene._slotWindow.select(0));
    await game.frames(3);
    await game.shot("equip");
    await game.press("KeyR");
    await waitReaderOpen();
    r = await reader();
    check(r.item === "試しの短剣" && r.pages === 1 && r.lines.length === 4, `装備の欄から開いた来歴 ${JSON.stringify(r)}`);
    await game.shot("equip-reader");
    await game.press("Enter");
    await waitReaderClosed();
    check(await game.eval(() => window.__game.ref("SceneManager")._scene._slotWindow.active), "来歴を閉じても装備の欄に戻らない");
    check(await game.eval(() => window.Hai.Lore.isOwned($dataWeapons[941])), "装備している短剣を持っていないことになった");
    // 装備の付け替えで袋に戻っても、知らせは出ない（記録は 1 つのまま）
    await game.eval(() => {
      window.__loreMessages = [];
      window.__game.ref("$gameParty").leader().changeEquip(0, null);
    });
    check((await recordIds()).filter(id => id === "weapon:941").length === 1, "付け替えで記録が増えた");
    await game.press("Escape");
    await game.press("Escape");
    await game.waitScene("Scene_Menu");
    await game.press("Escape");
    await game.waitScene("Scene_Map");
    await game.waitIdle();
    await game.frames(10);
    check(!(await game.eval(() => (window.__loreMessages || []).some(t => t.includes("来歴")))), "付け替えで来歴の知らせが出た");

    // ---- 窓口 open(item)：マップの上からは来歴だけのシーンを重ね、閉じたら戻る
    await game.eval(() => window.Hai.Lore.open($dataItems[943]));
    await game.waitScene("Scene_HaiLoreBook");
    await waitReaderOpen();
    check((await reader()).item === "試験場の札", "open(item) で開いた来歴");
    await game.press("Enter");
    await game.waitScene("Scene_Map");
    await game.waitIdle();

    // ---- セーブ → ページの読み直し → ロードで残る
    const before = JSON.stringify(await lore("records"));
    await game.call("save", SLOT);
    await game.reload();
    await game.call("load", SLOT);
    await game.waitScene("Scene_Map");
    await game.waitIdle();
    check(JSON.stringify(await lore("records")) === before, `ロード後の記録 ${JSON.stringify(await lore("records"))}`);

    // ---- 古いセーブ：記録の欄が無くても壊れず、空から始まる
    await game.eval(() => delete window.__game.ref("$gameSystem")._hai.lore);
    check((await lore("records")).length === 0, "古いセーブの記録が空でない");
    await game.eval(() => window.__game.ref("$gameParty").gainItem($dataItems[943], 1));
    check(JSON.stringify(await recordIds()) === JSON.stringify(["item:943"]), "古いセーブで手に入れた物が記録されない");

    game.assertNoErrors();
  } finally {
    await game.close();
  }
});
