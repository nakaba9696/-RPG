// P8・P11 砦の部屋（js/plugins/Hai_Facilities.js）の検査。試験場 Map913（tools/maps/src/p8_facilities）と、Map010・011–014 で：
//   1. 閉じた部屋の崩れた扉（Map010）→「扉が崩れて、瓦礫で塞がっている。」だけ（選択肢なし）。叡智のオーブを持っていても開かない。
//   2. 生き残り（試験場）を調べると、その部屋だけが開く（プラグインコマンド open。順は決まっていない）。スイッチ 121〜124。
//   3. 二度目の open は何もしない。4 部屋とも開く。
//   4. Map010 の開いた扉に触れると部屋のマップへ。部屋の出口で Map010 の扉の前へ戻る。
//   5. 戦闘の勝利で魂が増える（勝利の文に「魂を N 手に入れた」）。ボスを倒すと書庫の一覧に入る。
//   6. 稽古場：魂を与えてレベルを 1 つ上げる（前に出ている仲間の最高レベルまで）。
//   7. 食堂：合成の画面で作る。 8. 倉：預ける・引き出す。 9. 書庫：倒したボスと読んだ思念・戻った記憶。
//   10. セーブ → 読み直し → ロードで残る。 11. 古いセーブ（_hai.facilities が無い）で壊れない。
import { launchGame, check, runTest } from "./lib.mjs";

const TEST_MAP = 913;
const SLOT = 3;
const ORB = 171;
const HERB = 196, ANTIDOTE = 197, ROOT = 199, MOSS = 200;
// 試験場の崩れた扉（上の壁）と、部屋を開く生き残り（扉の 2 マス下）。立つのはその 1 つ下
const DOOR = { soul: { x: 3, y: 2 }, kitchen: { x: 6, y: 2 }, gate: { x: 10, y: 2 }, lore: { x: 13, y: 2 } };
const SURVIVOR = { soul: { x: 3, y: 4 }, kitchen: { x: 6, y: 4 }, gate: { x: 10, y: 4 }, lore: { x: 13, y: 4 } };
// Map010 の扉（W6 #144 の黒鉄の砦。tools/maps/src/w6_data.mjs の P.doors。どれも北の壁にあり、下から上を向いて触れる）と施設の中
const HALL_DOOR = { soul: { x: 40, y: 8 }, kitchen: { x: 5, y: 36 }, gate: { x: 10, y: 36 }, lore: { x: 33, y: 8 } };
const ROOM = {
  soul: { map: 11, arrive: { x: 8, y: 11 }, use: { x: 8, y: 6 } },
  kitchen: { map: 12, arrive: { x: 8, y: 11 }, use: { x: 8, y: 3 } },
  gate: { map: 13, arrive: { x: 8, y: 11 }, use: { x: 8, y: 3 } },
  lore: { map: 14, arrive: { x: 8, y: 11 }, use: { x: 9, y: 6 } },
};

await runTest(async () => {
  const game = await launchGame();
  const F = (fn, ...args) => game.eval(([f, a]) => window.Hai.Facilities[f](...a), [fn, args]);
  const switches = () => game.eval(() => [121, 122, 123, 124].map(n => $gameSwitches.value(n)));
  const orbs = () => game.eval(id => $gameParty.numItems($dataItems[id]), ORB);
  const gainOrbs = n => game.eval(([id, k]) => $gameParty.gainItem($dataItems[id], k), [ORB, n]);
  const num = id => game.eval(i => $gameParty.numItems($dataItems[i]), id);

  async function go(mapId, x, y, d) {
    await game.call("transfer", mapId, x, y, d);
    await game.waitFor(([m, x2, y2]) => {
      const g = window.__game;
      const p = g.pos();
      return g.mapId() === m && p.x === x2 && p.y === y2 && !g.isBusy();
    }, [mapId, x, y]);
  }
  const waitMapIdle = () => game.waitFor(() => window.__game.scene() === "Scene_Map" && !window.__game.isBusy() && !$gameMap.isEventRunning());

  /** 決定キーで調べ、イベントが終わるまで文章を読み進める。選択肢が出たら choices の順に選ぶ。出た文章（ページごと）を返す。 */
  async function talk(choices = [], shots = {}) {
    const queue = choices.slice();
    await game.press("Enter");
    await game.waitFor(() => $gameMap.isEventRunning());
    const pages = [];
    let sawChoice = false;
    for (;;) {
      await game.waitFor(() => {
        const s = SceneManager._scene;
        const w = s._messageWindow;
        const c = w && w._choiceListWindow;
        return !$gameMap.isEventRunning() || !(s instanceof Scene_Map) || (w && w.pause) || (c && c.active && c.isOpen());
      });
      const st = await game.eval(() => {
        const s = SceneManager._scene;
        const w = s._messageWindow;
        return {
          running: $gameMap.isEventRunning() && s instanceof Scene_Map,
          choice: !!(w && w._choiceListWindow.active && w._choiceListWindow.isOpen()),
          text: $gameMessage.allText(),
        };
      });
      if (!st.running) break;
      pages.push(st.text);
      if (st.choice) {
        sawChoice = true;
        if (shots.choice) await game.shot(shots.choice);
        const i = queue.shift() ?? 0;
        await game.eval(n => SceneManager._scene._messageWindow._choiceListWindow.select(n), i);
        await game.frames(2);
        await game.press("Enter");
      } else {
        if (shots[pages.length - 1]) await game.shot(shots[pages.length - 1]);
        await game.frames(12); // ▼が出てから 10 フレームは決定を受け付けない
        await game.press("Enter");
      }
      await game.waitFor(prev => {
        const w = SceneManager._scene._messageWindow;
        return !$gameMap.isEventRunning() || !w || !w.pause || $gameMessage.allText() !== prev;
      }, st.text);
      await game.frames(2);
    }
    await game.frames(3);
    pages.sawChoice = sawChoice;
    return pages;
  }

  /** 施設の部屋の「使う」イベントを調べて、画面が開くのを待つ。 */
  async function useFacility(key, sceneName) {
    const r = ROOM[key];
    await go(r.map, r.use.x, r.use.y + 1, 8);
    if (key !== "soul") await game.shot(`room-${key}`);
    await game.press("Enter");
    await game.waitScene(sceneName);
    await game.waitFor(() => !window.__game.isBusy());
    await game.frames(6);
  }
  async function closeScene() {
    for (let i = 0; i < 5 && (await game.call("scene")) !== "Scene_Map"; i++) {
      await game.press("Escape");
      await game.frames(10);
    }
    await game.waitScene("Scene_Map");
    await waitMapIdle();
  }

  try {
    await game.call("newGame");
    await game.waitScene("Scene_Map");
    await game.eval(() => {
      $gameParty._actors = [1]; // 初期パーティ（System.json）に左右されないように主人公だけにする
      $gamePlayer.refresh();
    });
    check((await F("opened")).length === 0 && JSON.stringify(await F("closed")) === '["soul","kitchen","gate","lore"]', "最初から部屋が開いている");
    check((await game.eval(() => ["soul", "kitchen", "gate", "lore"].map(k => Hai.Facilities.nameOf(k)).join())) === "稽古場,食堂,倉,書庫", "部屋の名前");
    const api = await game.eval(() => Object.keys(Hai.Facilities));
    check(!api.some(k => /orb|insert|next/i.test(k)), "窓口に叡智のオーブの名残りがある " + JSON.stringify(api));

    // ---- 1. 閉じた部屋：Map010 の稽古場の扉は「瓦礫で塞がっている」だけ。叡智のオーブを持っていても開かない
    await gainOrbs(1);
    await go(10, HALL_DOOR.soul.x, HALL_DOOR.soul.y + 1, 8);
    let pages = await talk([], { 0: "door-closed" });
    check(pages.length === 1 && pages[0].includes("扉が崩れて、瓦礫で塞がっている。"), "閉じた崩れた扉 " + JSON.stringify(pages));
    check(!pages.sawChoice && (await orbs()) === 1 && (await F("opened")).length === 0, "崩れた扉で選択肢が出た・オーブが減った・開いた");
    await game.eval(id => $gameParty.loseItem($dataItems[id], 1), ORB);
    // 古いマップの「台座」（pedestal）も同じに動く
    pages = await game.eval(() => {
      const it = new Game_Interpreter();
      it.setup([{ code: 357, indent: 0, parameters: ["Hai_Facilities", "pedestal", "台座", { door: "lore" }] }, { code: 0, indent: 0, parameters: [] }], 0);
      it.update();
      const text = it._childInterpreter ? it._childInterpreter._list.filter(c => c.code === 401).map(c => c.parameters[0]) : [];
      $gameMessage.clear(); // この試しの解釈器が出した文章を、マップの窓に残さない
      return text;
    });
    check(pages.length === 1 && pages[0].includes("瓦礫で塞がっている"), "古いマップの台座 " + JSON.stringify(pages));

    // ---- 2. 生き残り：食堂（ヴォルフラム）を先に開く。開くのはその部屋だけ
    await go(TEST_MAP, DOOR.kitchen.x, DOOR.kitchen.y + 1, 8);
    pages = await talk();
    check(pages.length === 1 && pages[0].includes("瓦礫で塞がっている"), "試験場の崩れた扉 " + JSON.stringify(pages));
    await go(TEST_MAP, SURVIVOR.kitchen.x, SURVIVOR.kitchen.y + 1, 8);
    pages = await talk();
    check(pages[0].includes("ヴォルフラムが砦に来た"), "生き残りの文 " + JSON.stringify(pages));
    check(JSON.stringify(await F("opened")) === '["kitchen"]', "食堂だけが開かない " + JSON.stringify(await F("opened")));
    check(JSON.stringify(await switches()) === "[false,true,false,false]", "スイッチ 122 " + JSON.stringify(await switches()));
    // 食堂の扉は開いたページ、稽古場の扉は閉じたまま
    const pageOf = (x, y) => game.eval(([x2, y2]) => $gameMap.event($gameMap.eventIdXy(x2, y2))._pageIndex, [x, y]);
    check((await pageOf(DOOR.kitchen.x, DOOR.kitchen.y)) === 1 && (await pageOf(DOOR.soul.x, DOOR.soul.y)) === 0, "扉のページが切り替わらない");

    // ---- 3. 同じ生き残りをもう一度調べても何も変わらない。残りの 3 人で 4 部屋とも開く
    pages = await talk();
    check(JSON.stringify(await F("opened")) === '["kitchen"]', "二度目の open で何か開いた");
    for (const key of ["lore", "soul", "gate"]) {
      await go(TEST_MAP, SURVIVOR[key].x, SURVIVOR[key].y + 1, 8);
      await talk();
    }
    check(JSON.stringify(await F("opened")) === '["soul","kitchen","gate","lore"]', "4 部屋 " + JSON.stringify(await F("opened")));
    check(JSON.stringify(await switches()) === "[true,true,true,true]", "スイッチ 121〜124 " + JSON.stringify(await switches()));
    check((await F("closed")).length === 0 && !(await F("open", "soul")), "開いた部屋がまた開いた");
    await go(TEST_MAP, 8, 5, 8);
    await game.shot("test-map-all-open");

    // ---- 4. Map010 の開いた扉 → 稽古場 → 出口で扉の前へ
    await go(10, HALL_DOOR.soul.x, HALL_DOOR.soul.y + 1, 8);
    await game.frames(10);
    await game.shot("hall-door-open");
    await game.call("step", 8); // 扉は通れないので、触れて場所移動
    await game.waitFor(([m, x, y]) => {
      const g = window.__game;
      return g.mapId() === m && g.pos().x === x && g.pos().y === y && !g.isBusy();
    }, [ROOM.soul.map, ROOM.soul.arrive.x, ROOM.soul.arrive.y]);
    await game.shot("room-soul");
    check(await game.call("step", 2), "稽古場の出口へ歩けない");
    await game.waitFor(() => window.__game.mapId() === 10 && !window.__game.isBusy());
    const back = await game.call("pos");
    check(back.x === HALL_DOOR.soul.x && back.y === HALL_DOOR.soul.y + 1, "出口から稽古場の扉の前へ戻らない " + JSON.stringify(back));
    // 南の廊下の倉の扉も
    await go(10, HALL_DOOR.gate.x, HALL_DOOR.gate.y + 1, 8);
    await game.call("step", 8);
    await game.waitFor(([m, x, y]) => window.__game.mapId() === m && window.__game.pos().x === x && window.__game.pos().y === y && !window.__game.isBusy(),
      [ROOM.gate.map, ROOM.gate.arrive.x, ROOM.gate.arrive.y]);

    // ---- 5. 戦闘の勝利で魂（ボスは 10）。倒したボスを覚える
    await game.eval(() => {
      window.__msgs = [];
      const add = Game_Message.prototype.add;
      Game_Message.prototype.add = function(text) {
        window.__msgs.push(text);
        return add.apply(this, arguments);
      };
      $dataEnemies[1].meta.hai_boss = true; // ゴブリンを一時だけボスにする
    });
    await game.call("strengthenParty");
    await game.call("startBattle", 1, true, false);
    await game.waitScene("Scene_Battle");
    await game.call("setSpeed", 4);
    await game.page.keyboard.down("Enter");
    try {
      await game.waitFor(() => window.__game.scene() === "Scene_Map", null, 120_000);
    } finally {
      await game.page.keyboard.up("Enter");
      await game.call("setSpeed", 1);
    }
    await waitMapIdle();
    const msgs = await game.eval(() => {
      delete $dataEnemies[1].meta.hai_boss;
      return window.__msgs;
    });
    check((await F("souls")) === 20, "ボス 2 体で魂が 20 にならない " + (await F("souls")));
    check(msgs.some(t => t.includes("魂を 20 手に入れた。")), "勝利の文に魂が出ない " + JSON.stringify(msgs));
    check(JSON.stringify(await F("bosses")) === "[1]", "倒したボスを覚えていない " + JSON.stringify(await F("bosses")));

    // ---- 6. 稽古場：控えのブルーノ（Lv 3）を上げる。上限は前に出ている仲間の最高レベル
    await game.eval(() => {
      $gameActors.actor(1).changeLevel(5, false);
      Hai.Companions.summon(5);
      $gameActors.actor(5).changeLevel(3, false);
    });
    check((await F("soulCost", 5)) === 3 && (await F("soulCap", 5)) === 5 && (await F("canRaise", 5)), "ブルーノの魂・上限 ");
    check(!(await F("canRaise", 1)), "最高レベルの主人公が上げられる");
    await useFacility("soul", "Scene_HaiSouls");
    await game.eval(() => SceneManager._scene._statusWindow.select(1));
    await game.frames(4);
    await game.shot("soul-room");
    await game.press("Enter");
    await game.frames(8);
    check((await game.eval(() => $gameActors.actor(5).level)) === 4 && (await F("souls")) === 17, "稽古場でレベルが上がらない");
    await game.press("Enter"); // Lv 4 → 5（魂 4）
    await game.frames(8);
    await game.press("Enter"); // 上限 5 なので上がらない
    await game.frames(8);
    check((await game.eval(() => $gameActors.actor(5).level)) === 5 && (await F("souls")) === 13, "上限を超えて上がった／2 回目が上がらない");
    await game.shot("soul-room-capped");
    await closeScene();

    // ---- 7. 食堂：合成の画面で毒消しを作る
    await game.eval(([r, m]) => {
      $gameParty.gainItem($dataItems[r], 2);
      $gameParty.gainItem($dataItems[m], 1);
    }, [ROOT, MOSS]);
    await useFacility("kitchen", "Scene_HaiCraft");
    await game.shot("kitchen");
    await game.press("Enter");
    await game.frames(8);
    check((await num(ANTIDOTE)) === 1 && (await num(ROOT)) === 0, "食堂で毒消しが作れない");
    await closeScene();

    // ---- 8. 倉：薬草 6 つ（5 つ＋倉庫 1）→ 預ける → 引き出す
    await game.eval(id => $gameParty.gainItem($dataItems[id], 6), HERB);
    await waitMapIdle();
    check(!(await game.eval(() => $gameMessage.isBusy())), "倉庫の知らせが文章の窓で出た（通知は操作を止めない）");
    await game.waitFor(() => Hai.Items.toastState().log.some(t => t.includes("薬草（1 個）は倉庫へ送られた")));
    const stored = () => game.eval(id => Hai.Items.storageCount("item", id), HERB);
    check((await num(HERB)) === 5 && (await stored()) === 1, "薬草が 5＋倉庫 1 にならない");
    await useFacility("gate", "Scene_HaiGate");
    const gate = () => game.eval(() => {
      const s = SceneManager._scene;
      const w = s._listWindow;
      return { mode: w.mode(), rows: w._data.map((e, i) => ({ ...e, enabled: w.isEnabledAt(i) })), listActive: w.active };
    });
    await game.press("Enter"); // 引き出す
    await game.frames(6);
    let g = await gate();
    check(g.mode === "take" && g.listActive && g.rows.length === 1 && !g.rows[0].enabled, "袋が満杯の薬草が引き出せる " + JSON.stringify(g));
    await game.shot("gate-take-full");
    await game.press("Escape");
    await game.frames(6);
    await game.press("ArrowRight"); // 預ける
    await game.frames(6);
    await game.press("Enter");
    await game.frames(6);
    g = await gate();
    const herbRow = g.rows.findIndex(r => r.kind === "item" && r.id === HERB);
    check(g.mode === "put" && herbRow >= 0 && g.rows[herbRow].enabled, "預けるの一覧に薬草が無い " + JSON.stringify(g));
    check(!g.rows.some(r => r.kind === "item" && r.id === ORB), "大事なものが預けられる");
    await game.eval(i => SceneManager._scene._listWindow.select(i), herbRow);
    await game.frames(4);
    await game.shot("gate-put");
    await game.press("Enter");
    await game.frames(6);
    check((await num(HERB)) === 4 && (await stored()) === 2, "預けられない");
    await game.press("Escape");
    await game.frames(6);
    await game.press("ArrowLeft");
    await game.frames(6);
    await game.press("Enter");
    await game.frames(6);
    g = await gate();
    check(g.mode === "take" && g.rows[0].enabled, "空きができても引き出せない " + JSON.stringify(g));
    await game.press("Enter");
    await game.frames(6);
    check((await num(HERB)) === 5 && (await stored()) === 1, "引き出せない");
    await closeScene();

    // ---- 9. 書庫：倒したボスと読んだ思念・戻った記憶
    await useFacility("lore", "Scene_HaiLore");
    const lore = await game.eval(() => SceneManager._scene._pageWindow.lines());
    check(lore.some(l => l.includes("ゴブリン")) && lore.some(l => l.includes("弱い：")), "倒したボスの一覧 " + JSON.stringify(lore));
    await game.shot("lore-bosses");
    await game.press("ArrowDown");
    await game.frames(6);
    const lore2 = await game.eval(() => SceneManager._scene._pageWindow.lines());
    check(lore2[0].startsWith("読んだ思念") && lore2[1].startsWith("戻った記憶"), "読んだ思念・戻った記憶の数 " + JSON.stringify(lore2));
    await game.press("ArrowDown");
    await game.frames(6);
    const lore3 = await game.eval(() => SceneManager._scene._pageWindow.lines());
    check(lore3[0].includes("写し"), "写しの読み比べ " + JSON.stringify(lore3));
    await closeScene();

    // ---- 10. セーブ → 読み直し → ロード
    const before = await game.eval(() => ({ opened: Hai.Facilities.opened(), souls: Hai.Facilities.souls(), bosses: Hai.Facilities.bosses() }));
    await game.call("save", SLOT);
    await game.reload();
    await game.call("load", SLOT);
    await game.waitScene("Scene_Map");
    await waitMapIdle();
    const after = await game.eval(() => ({ opened: Hai.Facilities.opened(), souls: Hai.Facilities.souls(), bosses: Hai.Facilities.bosses() }));
    check(JSON.stringify(after) === JSON.stringify(before), `ロード後 ${JSON.stringify(after)} ≠ ${JSON.stringify(before)}`);
    check(JSON.stringify(await switches()) === "[true,true,true,true]", "ロード後のスイッチ");

    // ---- 11. 古いセーブ（_hai.facilities が無い）：スイッチから開いた施設を写す。スイッチも無ければ何も開いていない
    const old = await game.eval(() => {
      delete $gameSystem._hai.facilities;
      const r = { opened: Hai.Facilities.opened(), souls: Hai.Facilities.souls(), bosses: Hai.Facilities.bosses() };
      delete $gameSystem._hai.facilities;
      for (const n of [121, 122, 123, 124]) $gameSwitches.setValue(n, false);
      r.none = Hai.Facilities.opened();
      r.closed = Hai.Facilities.closed().length;
      r.added = Hai.Facilities.addSouls(3);
      return r;
    });
    check(old.opened.length === 4 && old.souls === 0 && old.bosses.length === 0, "古いセーブ（スイッチ ON）" + JSON.stringify(old));
    check(old.none.length === 0 && old.closed === 4 && old.added === 3, "古いセーブ（スイッチ OFF）" + JSON.stringify(old));
    // 閉じた部屋を使おうとすると「扉が崩れて、瓦礫で塞がっている。」
    await go(ROOM.soul.map, ROOM.soul.use.x, ROOM.soul.use.y + 1, 8);
    pages = await talk();
    check(pages.length === 1 && pages[0].includes("瓦礫で塞がっている。"), "閉じた部屋 " + JSON.stringify(pages));

    game.assertNoErrors();
  } finally {
    await game.close();
  }
});
