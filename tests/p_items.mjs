// P9 所持上限・倉庫・一点もの・合成（js/plugins/Hai_Items.js・Hai_Craft.js）の検査。試験場は Map910（tools/maps/src/p9_items）。
//   1. 薬草を 6 つ拾うと 5 つ持って 1 つが倉庫、「倉庫へ送られた」と知らせる。上限 2 の秘薬は 3 つ拾うと 1 つが倉庫。
//   2. 一点ものの剣：1 本目は「（一点もの）」の知らせ、2 本目は倉庫。装備中も数える。店で売れない。
//   3. 倉庫の画面で 1 つ取り出す（上限に空きがあるときだけ）。
//   4. 合成：材料が足りないと作れない → 足りると作れて材料が減る（合成の画面で決定）。
//   5. レシピの紙でレシピを覚えると、自動メモが増える。
//   6. セーブ → ページの読み直し → ロードで倉庫と覚えたレシピが残る。
//   7. 古いセーブ（_hai.storage・_hai.craft が無い）で壊れない。
//   8. ドロップの決まり：ザコは装備を落とさない、<hai_boss> は落とす、<hai_drop:none>、<hai_drop:item,…> の固定ドロップ。
import { launchGame, check, runTest } from "./lib.mjs";
import { readSource, findChars } from "../tools/maps/build.mjs";

const MAP_ID = 910;
const SLOT = 1;
const source = readSource("p9_items");
const at = c => findChars(source.lines, c)[0];
const HERB_BOX = at("H");
const ELIXIR_BOX = at("E");
const RED1 = at("R");
const RED2 = at("W");
const MATERIAL_BOX = at("M");
const PAPER = at("P");
const TABLE = at("C");
const STORAGE = at("G");
const SHOP = at("K");
const HERB = 196, ANTIDOTE = 197, ELIXIR = 198, ROOT = 199, MOSS = 200, UNIQUE_SWORD = 196, IRON_SWORD = 197;

await runTest(async () => {
  const game = await launchGame();
  try {
    await game.call("newGame");
    await game.waitScene("Scene_Map");

    const num = (kind, id) =>
      game.eval(([k, i]) => $gameParty.numItems(Hai.Items.itemOf(k, i)), [kind, id]);
    const stored = (kind, id) => game.eval(([k, i]) => Hai.Items.storageCount(k, i), [kind, id]);
    const go = async (x, y, d) => {
      await game.call("transfer", MAP_ID, x, y, d);
      await game.waitFor(([id, px, py]) => {
        const p = window.__game.pos();
        return window.__game.mapId() === id && p.x === px && p.y === py && !window.__game.isBusy();
      }, [MAP_ID, x, y]);
    };
    // 文章を決定キーで送りながら、出たページの文を集める。shotAt の文を含むページでスクリーンショット
    const readMessages = async (shotAt, label) => {
      await game.waitFor(() => $gameMessage.isBusy());
      const pages = [];
      for (let i = 0; i < 30 && (await game.eval(() => $gameMessage.isBusy())); i++) {
        await game.waitFor(() => !$gameMessage.isBusy() || SceneManager._scene._messageWindow.pause);
        const text = await game.eval(() => ($gameMessage.isBusy() ? $gameMessage.allText() : null));
        if (text === null) break;
        pages.push(text);
        if (shotAt && text.includes(shotAt)) await game.shot(label);
        await game.press("Enter");
        await game.frames(6);
      }
      check(!(await game.eval(() => $gameMessage.isBusy())), "文章が閉じない");
      await game.waitFor(() => !$gameMap.isEventRunning());
      return pages;
    };
    // (x, y) のイベントの真下に立って上を向いて調べる
    const openBelow = async (p, shotAt, label) => {
      await go(p.x, p.y + 1, 8);
      await game.press("Enter");
      return readMessages(shotAt, label);
    };

    let toastSeen = 0; // これより前の通知は数えない
    // その通知が出る（先に出ている通知が消えるまで待つ）まで待つ。出たら true
    const waitToast = async text => {
      try {
        await game.waitFor(([t, from]) => Hai.Items.toastState().log.slice(from).includes(t), [text, toastSeen]);
        toastSeen = await game.eval(() => Hai.Items.toastState().log.length);
        return true;
      } catch {
        return false;
      }
    };

    const params = await game.eval(() => Hai.Items.params);
    check(params.noticeStyle === "toast", "知らせの出し方の既定が通知でない " + JSON.stringify(params));
    check(params.itemMax === 5 && params.equipMax === 0 && params.zakoNoEquip === true, "パラメータが既定と違う " + JSON.stringify(params));

    // --- 1. 薬草 6 つ → 5 つと倉庫 1 つ ---
    let pages = await openBelow(HERB_BOX, "", "herb-storage-notice");
    check((await num("item", HERB)) === 5, `薬草を 5 つ持っていない（${await num("item", HERB)}）`);
    check((await stored("item", HERB)) === 1, "薬草が 1 つ倉庫に入っていない");
    check(!pages.some(t => t.includes("倉庫へ送られた")), "倉庫の知らせが文章の窓で出た " + JSON.stringify(pages));
    check((await waitToast("薬草（1 個）は倉庫へ送られた。")), "倉庫の通知が出ない");

    // 上限 2 の秘薬
    check((await game.eval(id => Hai.Items.maxOf($dataItems[id]), ELIXIR)) === 2, "秘薬の上限が 2 でない");
    pages = await openBelow(ELIXIR_BOX);
    check((await num("item", ELIXIR)) === 2 && (await stored("item", ELIXIR)) === 1, "秘薬が 2 つ＋倉庫 1 つにならない");
    check(!pages.some(t => t.includes("倉庫へ送られた")) && (await waitToast("秘薬（1 個）は倉庫へ送られた。")), "秘薬の倉庫の通知 " + JSON.stringify(pages));

    // --- 2. 一点もの ---
    pages = await openBelow(RED1);
    check((await num("weapon", UNIQUE_SWORD)) === 1, "一点ものの剣が手に入らない");
    check(await waitToast("灰鋼の剣を手に入れた（一点もの）。"), "一点ものの通知 " + JSON.stringify(pages));
    pages = await openBelow(RED2);
    check((await num("weapon", UNIQUE_SWORD)) === 1 && (await stored("weapon", UNIQUE_SWORD)) === 1, "2 本目の一点ものが倉庫へ行かない");
    check((await waitToast("灰鋼の剣（1 個）は倉庫へ送られた。")), "2 本目の通知");
    check(!pages.some(t => t.includes("（一点もの）。")), "2 本目でも「一点もの」の知らせが出た " + JSON.stringify(pages));
    // 装備中も数える：装備すると袋は 0 でも、倉庫から出せない。外すと袋に戻る（倉庫へ行かない）
    const equip = await game.eval(id => {
      const actor = $gameParty.leader();
      const sword = $dataWeapons[id];
      const ok = actor.canEquip(sword);
      if (ok) actor.changeEquip(0, sword);
      const r = { ok, equipped: actor.isEquipped(sword), bag: $gameParty.numItems(sword), take: Hai.Items.takeFromStorage("weapon", id, 1) };
      actor.changeEquip(0, null);
      r.after = { bag: $gameParty.numItems(sword), stored: Hai.Items.storageCount("weapon", id), pending: Hai.Items.pendingNotices().length };
      return r;
    }, UNIQUE_SWORD);
    check(equip.ok && equip.equipped && equip.bag === 0, "一点ものの剣を装備できない " + JSON.stringify(equip));
    check(equip.take === 0, "装備中の一点ものを倉庫から出せた " + JSON.stringify(equip));
    check(equip.after.bag === 1 && equip.after.stored === 1 && equip.after.pending === 0, "外した一点ものが袋に戻らない " + JSON.stringify(equip));
    check(!(await game.eval(() => $gameMessage.isBusy())), "装備の付け替えで知らせが出た");

    // 店で売れない
    await game.eval(id => $gameParty.gainItem($dataWeapons[id], 1), IRON_SWORD);
    await go(SHOP.x, SHOP.y - 1, 2);
    await game.press("Enter");
    await game.waitScene("Scene_Shop");
    await game.waitFor(() => !window.__game.isBusy());
    const shop = await game.eval(([u, n]) => {
      const scene = SceneManager._scene;
      scene._commandWindow.selectSymbol("sell");
      scene._commandWindow.processOk();
      return {
        unique: scene._sellWindow.isEnabled($dataWeapons[u]),
        normal: scene._sellWindow.isEnabled($dataWeapons[n]),
        canSell: Hai.Items.canSell($dataWeapons[u]),
        canDiscard: Hai.Items.canDiscard($dataWeapons[u]),
      };
    }, [UNIQUE_SWORD, IRON_SWORD]);
    check(!shop.unique && shop.normal, "一点ものが売れる／ふつうの剣が売れない " + JSON.stringify(shop));
    check(!shop.canSell && !shop.canDiscard, "canSell・canDiscard " + JSON.stringify(shop));
    await game.eval(() => {
      const scene = SceneManager._scene;
      scene._categoryWindow.selectSymbol("weapon");
      scene._categoryWindow.processOk();
    });
    await game.frames(10);
    await game.shot("shop-sell-unique");
    await game.eval(() => SceneManager.pop());
    await game.waitScene("Scene_Map");
    await game.waitFor(() => !window.__game.isBusy());

    // --- 3. 倉庫の画面：薬草は袋が満杯で出せず、秘薬は 1 つ使ったので出せる ---
    await game.eval(id => $gameParty.loseItem($dataItems[id], 1), ELIXIR);
    await go(STORAGE.x, STORAGE.y - 1, 2);
    await game.press("Enter");
    await game.waitScene("Scene_HaiStorage");
    await game.waitFor(() => !window.__game.isBusy());
    const list = await game.eval(() => {
      const w = SceneManager._scene._listWindow;
      return w._list.map((c, i) => ({ name: c.name, enabled: w.isCommandEnabled(i), kind: c.ext.kind, id: c.ext.id }));
    });
    const herbRow = list.findIndex(c => c.kind === "item" && c.id === HERB);
    const elixirRow = list.findIndex(c => c.kind === "item" && c.id === ELIXIR);
    check(herbRow >= 0 && !list[herbRow].enabled, "満杯の薬草が倉庫から選べる " + JSON.stringify(list));
    check(elixirRow >= 0 && list[elixirRow].enabled, "秘薬が倉庫から選べない " + JSON.stringify(list));
    await game.eval(i => SceneManager._scene._listWindow.select(i), elixirRow);
    await game.frames(4);
    await game.shot("storage-window");
    await game.press("Enter");
    await game.frames(6);
    check((await num("item", ELIXIR)) === 2 && (await stored("item", ELIXIR)) === 0, "倉庫から秘薬を取り出せない");
    await game.press("Escape");
    await game.waitScene("Scene_Map");
    await game.waitFor(() => !window.__game.isBusy());

    // --- 4. 合成 ---
    const craft = (fn, ...a) => game.eval(([f, args]) => Hai.Craft[f](...args), [fn, a]);
    const known = async () => (await craft("recipes")).map(r => r.key);
    check(JSON.stringify(await known()) === JSON.stringify(["i197"]), "初めから知っているレシピが毒消しだけでない " + JSON.stringify(await known()));
    check(!(await craft("canCraft", "item", ANTIDOTE)), "材料なしで毒消しが作れる");
    check(!(await craft("craft", "item", ANTIDOTE)), "材料なしで craft が true");
    check(!(await craft("canCraft", "item", ELIXIR)), "知らないレシピ（秘薬）が作れる");
    await openBelow(MATERIAL_BOX);
    check((await num("item", ROOT)) === 1 && (await num("item", MOSS)) === 2, "素材の箱から材料が出ない");
    check(!(await craft("canCraft", "item", ANTIDOTE)), "苦い根 1 つで毒消しが作れる（2 つ要る）");
    // 合成の画面：足りない表示
    await go(TABLE.x, TABLE.y + 1, 8);
    await game.press("Enter");
    await game.waitScene("Scene_HaiCraft");
    await game.waitFor(() => !window.__game.isBusy());
    await game.shot("craft-short");
    await game.press("Enter"); // 足りないので作れない
    await game.frames(6);
    check((await num("item", ANTIDOTE)) === 0 && (await num("item", ROOT)) === 1, "足りないのに合成の画面で作れた");
    await game.eval(id => $gameParty.gainItem($dataItems[id], 1), ROOT);
    await game.eval(() => {
      SceneManager._scene._listWindow.refresh();
      SceneManager._scene._listWindow.callUpdateHelp();
    });
    check(await craft("canCraft", "item", ANTIDOTE), "材料がそろっても毒消しが作れない");
    await game.frames(4);
    await game.shot("craft-ready");
    await game.press("Enter");
    await game.frames(6);
    check((await num("item", ANTIDOTE)) === 1, "合成の画面で毒消しができない");
    check((await num("item", ROOT)) === 0 && (await num("item", MOSS)) === 1, "材料が減っていない");
    await game.shot("craft-done");
    await game.press("Escape");
    await game.waitScene("Scene_Map");
    await game.waitFor(() => !window.__game.isBusy());

    // --- 5. レシピを覚える → メモが増える ---
    const notesBefore = await game.eval(() => Hai.Thoughts.notes().length);
    pages = await openBelow(PAPER);
    check(pages.some(t => t.includes("秘薬のレシピを覚えた。")), "覚えたときの文 " + JSON.stringify(pages));
    check(JSON.stringify(await known()) === JSON.stringify(["i197", "i198"]), "秘薬のレシピを覚えていない " + JSON.stringify(await known()));
    const notes = await game.eval(() => Hai.Thoughts.notes());
    check(notes.length === notesBefore + 1, "メモが 1 つ増えていない " + JSON.stringify(notes));
    const recipeNote = notes.find(n => n.id === "recipe:i198");
    check(recipeNote && recipeNote.text === "レシピ：秘薬（薬草×2・灰の苔×1）" && recipeNote.kind === "item", "レシピのメモ " + JSON.stringify(recipeNote));
    check(!(await craft("learn", "item", ELIXIR)), "同じレシピを二度覚えた");
    check((await game.eval(() => Hai.Thoughts.notes().length)) === notesBefore + 1, "同じレシピでメモが増えた");
    // 秘薬を作る（袋は 2/2 なので、できた秘薬は倉庫へ。合成の画面の中なので知らせはマップに戻ってから）
    check(await craft("craft", "item", ELIXIR), "秘薬が作れない");
    check((await num("item", ELIXIR)) === 2 && (await stored("item", ELIXIR)) === 1, "上限の秘薬が倉庫へ行かない");
    check((await waitToast("秘薬（1 個）は倉庫へ送られた。")), "合成で倉庫へ送った通知（マップに戻ってから出る）");

    // --- 6. セーブ → 読み直し → ロード ---
    const storageBefore = await game.eval(() => Hai.Items.storage());
    await game.call("save", SLOT);
    await game.reload();
    await game.call("load", SLOT);
    await game.waitScene("Scene_Map");
    await game.waitFor(() => !window.__game.isBusy());
    const storageAfter = await game.eval(() => Hai.Items.storage());
    check(JSON.stringify(storageAfter) === JSON.stringify(storageBefore), `ロード後の倉庫 ${JSON.stringify(storageAfter)} ≠ ${JSON.stringify(storageBefore)}`);
    check(JSON.stringify(await known()) === JSON.stringify(["i197", "i198"]), "ロード後にレシピを忘れた");

    // --- 7. 古いセーブ（_hai.storage・_hai.craft が無い）---
    const old = await game.eval(id => {
      delete $gameSystem._hai.storage;
      delete $gameSystem._hai.craft;
      const r = { storage: Hai.Items.storage(), recipes: Hai.Craft.recipes().map(x => x.key) };
      r.room = Hai.Items.roomFor($dataItems[id]);
      $gameParty.gainItem($dataItems[id], r.room + 3); // 空きを超えた 3 つが倉庫へ
      r.after = Hai.Items.storage();
      r.learn = Hai.Craft.learn("item", 198);
      return r;
    }, HERB);
    check(old.storage.length === 0 && JSON.stringify(old.recipes) === JSON.stringify(["i197"]), "古いセーブで初期値にならない " + JSON.stringify(old));
    check(old.after.length === 1 && old.after[0].n === 3 && old.learn, "古いセーブで倉庫・レシピが使えない " + JSON.stringify(old));
    await readMessages(); // 倉庫の知らせ

    // --- 8. ドロップの決まり ---
    const drops = await game.eval(([sword]) => {
      const enemy = $dataEnemies[1];
      const saved = { note: enemy.note, meta: enemy.meta, dropItems: enemy.dropItems };
      const names = () => new Game_Enemy(1, 0, 0).makeDropItems().map(i => `${Hai.Items.kindOf(i)}:${i.id}`).sort();
      const r = {};
      try {
        enemy.dropItems = [{ kind: 2, dataId: sword, denominator: 1 }, { kind: 1, dataId: 196, denominator: 1 }, { kind: 0, dataId: 1, denominator: 1 }];
        enemy.note = "";
        enemy.meta = {};
        r.zako = { equip: Hai.Items.dropsEquipment(1), boss: Hai.Items.isBoss(1), drops: names() };
        enemy.meta = { hai_boss: true };
        r.boss = { equip: Hai.Items.dropsEquipment(1), drops: names() };
        enemy.note = "<hai_boss>\n<hai_drop:none>\n<hai_drop:item,198,2>\n<hai_drop:a,196>";
        DataManager.extractMetadata(enemy);
        r.bossNone = { equip: Hai.Items.dropsEquipment(1), fixed: Hai.Items.fixedDrops(1), drops: names() };
      } finally {
        Object.assign(enemy, saved);
      }
      r.realZako = Hai.Items.dropsEquipment(1);
      return r;
    }, [IRON_SWORD]);
    check(!drops.zako.equip && !drops.zako.boss && JSON.stringify(drops.zako.drops) === JSON.stringify(["item:196"]), "ザコが装備を落とす " + JSON.stringify(drops));
    check(drops.boss.equip && JSON.stringify(drops.boss.drops) === JSON.stringify(["item:196", "weapon:197"]), "ボスが装備を落とさない " + JSON.stringify(drops));
    check(
      !drops.bossNone.equip &&
        JSON.stringify(drops.bossNone.fixed) === JSON.stringify([{ kind: "item", id: 198, n: 2 }, { kind: "armor", id: 196, n: 1 }]) &&
        JSON.stringify(drops.bossNone.drops) === JSON.stringify(["armor:196", "item:196", "item:198", "item:198"]),
      "<hai_drop:none> と固定ドロップ " + JSON.stringify(drops),
    );
    check(!drops.realZako, "既存の敵（ゴブリン）がザコの扱いでない");

    game.assertNoErrors();
  } finally {
    await game.close();
  }
});
