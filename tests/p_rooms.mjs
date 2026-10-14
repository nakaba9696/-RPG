// P13（#189）砦の新しい 3 部屋・頼みごと 8 本・記憶が戻るたびの一言・声だけの影の検査。
//   1. 最初は 7 部屋とも閉じている。Map010 の療養所の扉は「瓦礫で塞がっている」だけ。
//   2. open で開く（スイッチ 125〜127）。010 の扉から 016・017・018 へ入れて、出口で扉の前へ戻る。019 の見張り台の扉からも 018 へ。
//   3. 療養所：状態異常が治る。開いている間、消耗品の所持上限が 1 つ増える。
//   4. 鍛冶場：鉄切り鋏を打つ（スイッチ 313）。一点ものの装備を魂で鍛え直すと能力が上がる。
//   5. 見張り台：訪れたマップの地図が隅まで埋まる。転送の行き先が増える（訪れたマップだけ）。
//   6. 頼みごと：筋の表の 8 本。key だけで名前・頼んだ人・変数が入る（足場の木は変数 176）。
//   7. コモンイベント 201：1 つ目・4 つ目（墓守の帳面があれば「全部、同じ手だ」、無ければ在りかを問う。W24）と、7 つ目から先で名前が戻っていない間（スイッチ 110 OFF）だけ一言。
//   8. 声だけの影（<hai_enemy_shade>）：姿が薄く、近くにいても追わない。触れると戦闘。勝つと一行の声を残す。
//   9. 古いセーブ（_hai.facilities が無い）：スイッチ 125〜127 から開いた部屋を写す。
import { launchGame, check, runTest } from "./lib.mjs";

const KEEP = 10;
// 010 の扉（tools/maps/src/w6_data.mjs の P.doors。どれも北の壁。下から上を向いて触れる）と、部屋（着く所・使う物）
const ROOMS = {
  infirmary: { door: { x: 44, y: 8 }, map: 16, use: { x: 8, y: 4 }, sw: 125 },
  smithy: { door: { x: 42, y: 36 }, map: 17, use: { x: 8, y: 6 }, sw: 126 },
  watch: { door: { x: 17, y: 8 }, map: 18, use: { x: 8, y: 5 }, sw: 127 },
};
const ARRIVE = { x: 8, y: 11 };
const RAMPART_WATCH_DOOR = { x: 16, y: 6 }; // 019 の見張り台の扉
const UNIQUE_SWORD = 196; // 灰鋼の剣（<hai_unique>）
const POISON = 4;
const SHADE_MAP = 901; // P1 の試験場。赤（一度きり、固定）を声だけの影に読み替えて使う

await runTest(async () => {
  const game = await launchGame();
  const F = (fn, ...args) => game.eval(([f, a]) => window.Hai.Facilities[f](...a), [fn, args]);

  async function go(mapId, x, y, d) {
    await game.call("transfer", mapId, x, y, d);
    await game.waitFor(([m, x2, y2]) => {
      const g = window.__game;
      const p = g.pos();
      return g.mapId() === m && p.x === x2 && p.y === y2 && !g.isBusy();
    }, [mapId, x, y]);
  }
  const waitAt = (mapId, x, y) =>
    game.waitFor(([m, x2, y2]) => {
      const g = window.__game;
      return g.mapId() === m && g.pos().x === x2 && g.pos().y === y2 && !g.isBusy();
    }, [mapId, x, y]);

  /** 決定キーで調べ、イベントが終わるまで文章を読み進める。選択肢が出たら choices の順に選ぶ。出た文章（ページごと）を返す。 */
  async function talk(choices = []) {
    const queue = choices.slice();
    await game.press("Enter");
    await game.waitFor(() => $gameMap.isEventRunning());
    const pages = [];
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
          choices: $gameMessage.choices().slice(),
          text: $gameMessage.allText(),
        };
      });
      if (!st.running) break;
      pages.push(st.choice ? `[${st.choices.join("|")}]` : st.text);
      if (st.choice) {
        const i = queue.shift() ?? st.choices.length - 1;
        await game.eval(n => SceneManager._scene._messageWindow._choiceListWindow.select(n), i);
        await game.frames(2);
        await game.press("Enter");
      } else {
        await game.frames(12); // ▼が出てから 10 フレームは決定を受け付けない
        await game.press("Enter");
      }
      await game.waitFor(prev => {
        const s = SceneManager._scene;
        const w = s._messageWindow;
        return !$gameMap.isEventRunning() || !(s instanceof Scene_Map) || !w || !w.pause || $gameMessage.allText() !== prev;
      }, st.text);
      await game.frames(2);
    }
    await game.frames(3);
    return pages;
  }

  /** 010 の扉の前から上へ触れて部屋へ入り、出口から扉の前へ戻る。 */
  async function enterAndLeave(key, shot) {
    const r = ROOMS[key];
    await go(KEEP, r.door.x, r.door.y + 1, 8);
    await game.call("step", 8); // 扉は通れないので、触れて場所移動
    await waitAt(r.map, ARRIVE.x, ARRIVE.y);
    await game.frames(10);
    if (shot) await game.shot(shot);
    check(await game.call("step", 2), `${key}: 出口へ歩けない`);
    await waitAt(KEEP, r.door.x, r.door.y + 1);
  }

  try {
    await game.call("newGame");
    await game.waitScene("Scene_Map");
    await game.eval(() => {
      $gameParty._actors = [1];
      $gamePlayer.refresh();
    });

    // ---- 1. 最初は 7 部屋とも閉じている
    const keys = await game.eval(() => Hai.Facilities.KEYS);
    check(JSON.stringify(keys) === '["soul","kitchen","gate","lore","infirmary","smithy","watch"]', "部屋の鍵 " + JSON.stringify(keys));
    check((await F("closed")).length === 7, "最初から開いている部屋がある");
    check((await game.eval(() => Hai.Facilities.KEYS.slice(4).map(k => Hai.Facilities.nameOf(k)).join())) === "療養所,鍛冶場,見張り台", "部屋の名前");
    await go(KEEP, ROOMS.infirmary.door.x, ROOMS.infirmary.door.y + 1, 8);
    let pages = await talk();
    check(pages.length === 1 && pages[0].includes("瓦礫で塞がっている"), "閉じた療養所の扉 " + JSON.stringify(pages));
    check((await game.call("mapId")) === KEEP, "閉じた扉で部屋へ入れた");

    // ---- 2・3. 療養所
    const item = await game.eval(() => {
      const it = $dataItems.find(i => i && i.name && i.itypeId === 1 && i.consumable && Hai.Items.maxOf(i) === Hai.Items.params.itemMax);
      return it ? { id: it.id, max: Hai.Items.maxOf(it) } : null;
    });
    check(!!item, "上限が itemMax の消耗品が見つからない");
    check(await F("open", "infirmary"), "療養所が開かない");
    check(await game.eval(() => $gameSwitches.value(125)), "スイッチ 125 が ON にならない");
    check((await game.eval(id => Hai.Items.maxOf($dataItems[id]), item.id)) === item.max + 1, "療養所が開いても消耗品の上限が増えない");
    await enterAndLeave("infirmary", "room-016-infirmary");
    await game.eval(id => $gameActors.actor(1).addState(id), POISON);
    await go(16, ROOMS.infirmary.use.x, ROOMS.infirmary.use.y + 1, 8);
    pages = await talk();
    check(pages.length === 1 && pages[0].includes("体の障りが抜けた"), "療養所の文 " + JSON.stringify(pages));
    check(!(await game.eval(id => $gameActors.actor(1).isStateAffected(id), POISON)), "療養所で毒が治らない");

    // ---- 4. 鍛冶場：鉄切り鋏・鍛え直し
    check(await F("open", "smithy"), "鍛冶場が開かない");
    await enterAndLeave("smithy", "room-017-smithy");
    await go(17, ROOMS.smithy.use.x, ROOMS.smithy.use.y + 1, 8);
    pages = await talk([1]);
    check(pages[0] === "[鍛え直す|鉄切り鋏を打つ|やめる]", "鍛冶場の選択肢 " + JSON.stringify(pages));
    check(pages.some(p => p.includes("鉄切り鋏を手に入れた")), "鉄切り鋏の文 " + JSON.stringify(pages));
    check(await game.eval(() => $gameParty.hasItem($dataItems[1001]) && $gameSwitches.value(313)), "鉄切り鋏が手に入らない・スイッチ 313 が ON にならない");
    pages = await talk([2]);
    check(pages[0] === "[鍛え直す|やめる]", "鋏を持ったあとの選択肢 " + JSON.stringify(pages));
    // 一点ものの剣を装備して、魂で鍛え直す
    const forge = await game.eval(id => {
      const a = $gameActors.actor(1);
      a.forceChangeEquip(0, $dataWeapons[id]);
      Hai.Facilities.addSouls(100);
      const before = { atk: a.atk, souls: Hai.Facilities.souls(), cost: Hai.Facilities.forgeCost("weapon", id) };
      const ok = Hai.Facilities.forge("weapon", id);
      return { before, ok, atk: a.atk, souls: Hai.Facilities.souls(), level: Hai.Facilities.forgedLevel("weapon", id), list: Hai.Facilities.forgeables() };
    }, UNIQUE_SWORD);
    check(forge.ok && forge.level === 1 && forge.souls === forge.before.souls - forge.before.cost, "鍛え直し " + JSON.stringify(forge));
    check(forge.atk === forge.before.atk + 4, `鍛え直して攻撃力が 20 の 20%（4）上がらない ${JSON.stringify(forge)}`);
    check(forge.list.some(e => e.kind === "weapon" && e.id === UNIQUE_SWORD), "装備中の一点ものが鍛え直しの一覧に無い " + JSON.stringify(forge.list));
    // 鍛え直しの画面
    await talk([0]);
    await game.waitScene("Scene_HaiForge");
    await game.frames(10);
    await game.shot("forge-scene");
    for (let i = 0; i < 5 && (await game.call("scene")) !== "Scene_Map"; i++) {
      await game.press("Escape");
      await game.frames(10);
    }
    await game.waitFor(() => window.__game.scene() === "Scene_Map" && !$gameMap.isEventRunning());

    // ---- 5. 見張り台：全図・転送の行き先。019 の扉からも入れる
    check((await F("watchDestinations")).length === 0, "見張り台が閉じているのに転送の行き先が増えた");
    check(await F("open", "watch"), "見張り台が開かない");
    await enterAndLeave("watch", "room-018-watch");
    await go(19, RAMPART_WATCH_DOOR.x, RAMPART_WATCH_DOOR.y + 1, 8);
    await game.call("step", 8);
    await waitAt(18, ARRIVE.x, ARRIVE.y);
    const before = await game.eval(() => ({ keep: Hai.AutoMap.visitedCount(10), size: $dataMap.width * $dataMap.height }));
    await go(18, ROOMS.watch.use.x, ROOMS.watch.use.y + 1, 8);
    pages = await talk();
    check(pages.length === 1 && pages[0].includes("地図の隅まで埋まった"), "見張り台の文 " + JSON.stringify(pages));
    const after = await game.eval(() => ({ keep: Hai.AutoMap.visitedCount(10), here: Hai.AutoMap.visitedCount(18), size: $dataMap.width * $dataMap.height }));
    check(after.keep > before.keep && after.here === after.size, `訪れたマップの地図が埋まらない ${JSON.stringify({ before, after })}`);
    const dests = await game.eval(() => {
      const none = Hai.Facilities.watchDestinations().map(d => d.name);
      $gameSystem._hai.automap[20] = { w: 1, h: 1, v: "B" }; // 霧の森を訪れたことにする
      return { none, some: Hai.Facilities.watchDestinations(), warp: Hai.Warp.destinations().filter(d => d.exact) };
    });
    check(dests.none.length === 0, "訪れていないマップが転送の行き先に出た " + JSON.stringify(dests));
    check(dests.some.length === 1 && dests.some[0].mapId === 20 && dests.warp.some(d => d.name === "霧の森の門" && d.mapId === 20), "見張り台の転送の行き先 " + JSON.stringify(dests));
    check(JSON.stringify(await game.eval(() => [125, 126, 127].map(n => $gameSwitches.value(n)))) === "[true,true,true]", "スイッチ 125〜127");

    // ---- 6. 頼みごと：筋の表の 8 本
    const errands = await game.eval(() => {
      const book = Hai.Notes.ERRANDS;
      const e = Hai.Notes.setErrand({ key: "scaffold", stage: 1, text: "工房の木を、麦の村の詰め所へ" });
      const d = Hai.Notes.setErrand({ key: "doorSong", stage: 2, text: "名簿を見せた" });
      return { keys: book.map(b => b.key), vars: book.map(b => b.variableId), e, d, v176: $gameVariables.value(176), v501: $gameVariables.value(501), row: Hai.Notes.errands().find(r => r.key === "scaffold").text };
    });
    check(errands.keys.length === 8 && errands.keys.includes("scaffold") && errands.keys.includes("doorSong"), "頼みごとの筋の表 " + JSON.stringify(errands.keys));
    check(JSON.stringify(errands.vars) === "[161,162,163,164,165,166,501,176]", "頼みごとの変数 " + JSON.stringify(errands.vars));
    check(errands.e.title === "足場の木" && errands.e.who === "テオ" && errands.e.variableId === 176 && errands.v176 === 1, "足場の木 " + JSON.stringify(errands));
    check(errands.d.title === "扉の外の歌" && errands.v501 === 2 && errands.row === "足場の木：工房の木を、麦の村の詰め所へ", "扉の外の歌 " + JSON.stringify(errands));

    // ---- 7. コモンイベント 201（記憶が戻ったときの一言）。010 の F01（イベント 13）から呼んだことにする
    await go(KEEP, 25, 26, 2);
    const lines = await game.eval(() => {
      const hadLedger = $gameParty.numItems($dataItems[326]);
      const run = (faint, nameBack, selfA = false, ledger = true) => {
        $gameParty.loseItem($dataItems[326], 99);
        if (ledger) $gameParty.gainItem($dataItems[326], 1);
        $gameVariables.setValue(138, faint);
        $gameSwitches.setValue(110, nameBack);
        $gameSelfSwitches.setValue([10, 13, "A"], selfA);
        $gameMessage.clear();
        const it = new Game_Interpreter();
        it.setup($dataCommonEvents[201].list, 13);
        it.update();
        const text = $gameMessage.allText();
        $gameMessage.clear();
        return text;
      };
      const out = {};
      for (let n = 0; n <= 11; n++) out[n + 1] = run(n, false); // 戻った数（この思念で n + 1 個目）
      out.name7 = run(6, true);
      out.name11 = run(10, true);
      out.read1 = run(0, false, true);
      // W24（#281）：四つ目は墓守の帳面（326）を持っているときだけ「全部、同じ手だ」。持っていなければ在りかを問う一行
      out.noLedger4 = run(3, false, false, false);
      out.noLedger1 = run(0, false, false, false);
      $gameParty.loseItem($dataItems[326], 99);
      $gameParty.gainItem($dataItems[326], hadLedger);
      $gameSelfSwitches.setValue([10, 13, "A"], false);
      $gameSwitches.setValue(110, false);
      $gameVariables.setValue(138, 0);
      return out;
    });
    const want = n => (n === 1 ? "葬式を出した" : n === 4 ? "全部、同じ手だ" : n >= 7 ? "名前のところだけ、思い出せない。" : "");
    for (let n = 1; n <= 12; n++) {
      check(want(n) ? lines[n].includes(want(n)) : lines[n] === "", `${n} つ目の一言 ${JSON.stringify(lines[n])}`);
    }
    check(lines.name7 === "" && lines.name11 === "" && lines.read1 === "", "名前が戻ったあと・見た思念で一言が出た " + JSON.stringify(lines));
    check(lines.noLedger4 === "墓守の帳面。どこに置いた" && lines.noLedger1.includes("葬式を出した"), "帳面が無いときの四つ目の一言 " + JSON.stringify(lines));

    // ---- 8. 声だけの影：P1 の試験場の赤（固定・一度きり）を影にする
    // マップを読み直しても影のままにする（場所移動のたびに $dataMap は読み直される）
    await game.eval(() => {
      const onLoad = DataManager.onLoad;
      DataManager.onLoad = function(object) {
        onLoad.apply(this, arguments);
        if (object === $dataMap && Array.isArray(object.events)) {
          for (const e of object.events) if (e && e.note.includes("<hai_enemy:103,red>")) e.meta.hai_enemy_shade = "写しを渡した";
        }
      };
    });
    await go(SHADE_MAP, 4, 2, 2);
    await game.call("strengthenParty");
    const shade = await game.eval(() => {
      const ev = $gameMap.events().find(e => Hai.SymbolEnemy.rankOf(e) === "red");
      return { id: ev.eventId(), x: ev.x, y: ev.y };
    });
    await game.frames(5);
    const s0 = await game.eval(i => {
      const ev = $gameMap.event(i);
      const sprite = SceneManager._scene._spriteset._characterSprites.find(sp => sp._character === ev);
      return { shade: Hai.SymbolEnemy.isShade(ev), voice: Hai.SymbolEnemy.shadeVoice(ev), opacity: ev.opacity(), sprite: sprite.opacity, see: Hai.SymbolEnemy.canSeePlayer(ev) };
    }, shade.id);
    check(s0.shade && s0.voice === "写しを渡した" && s0.opacity === 96 && s0.sprite === 96 && !s0.see, "影の見た目・追わない " + JSON.stringify(s0));
    // P17（R2 気になる 12）：<hai_enemy_shade_quiet> の影は、倒しても一行を出さない（戦闘のあとの命令に声の文章が無い）
    const quiet = await game.eval(i => {
      const ev = $gameMap.event(i);
      const voiced = list => list.some(c => c.code === 401 && c.parameters[0] === "写しを渡した");
      ev.event().meta.hai_enemy_shade_quiet = true;
      const r = { quiet: Hai.SymbolEnemy.isShadeQuiet(ev), voice: Hai.SymbolEnemy.shadeVoice(ev), listed: voiced(ev.list()) };
      delete ev.event().meta.hai_enemy_shade_quiet;
      return { ...r, normal: voiced(ev.list()), quietAfter: Hai.SymbolEnemy.isShadeQuiet(ev) };
    }, shade.id);
    check(quiet.quiet && quiet.voice === "写しを渡した" && !quiet.listed && quiet.normal && !quiet.quietAfter, "<hai_enemy_shade_quiet> の影 " + JSON.stringify(quiet));
    // 近く（2 マス左。まっすぐ見える所）に立っても追ってこない
    await go(SHADE_MAP, shade.x - 2, shade.y, 6);
    await game.frames(120);
    const s1 = await game.eval(i => ({ x: $gameMap.event(i).x, y: $gameMap.event(i).y, ...Hai.SymbolEnemy.state($gameMap.event(i)) }), shade.id);
    check(s1.x === shade.x && s1.y === shade.y && !s1.chasing && (await game.call("scene")) === "Scene_Map", "影が追ってきた " + JSON.stringify(s1));
    await game.shot("shade");
    // 触れると戦闘。勝つと一行の声
    await game.eval(() => {
      window.__msgs = [];
      const add = Game_Message.prototype.add;
      Game_Message.prototype.add = function(text) {
        window.__msgs.push(text);
        return add.apply(this, arguments);
      };
    });
    check(await game.call("step", 6), "影の手前へ歩けない");
    await game.waitPlayerStopped();
    await game.call("step", 6);
    await game.waitScene("Scene_Battle");
    await game.call("setSpeed", 4);
    await game.page.keyboard.down("Enter");
    try {
      await game.waitFor(() => window.__game.scene() === "Scene_Map" && window.__msgs.includes("写しを渡した"), null, 120_000);
    } finally {
      await game.page.keyboard.up("Enter");
    }
    await game.call("setSpeed", 1);
    for (let i = 0; i < 10 && (await game.eval(() => $gameMap.isEventRunning() || $gameMessage.isBusy())); i++) {
      await game.frames(15);
      await game.press("Enter");
    }
    await game.waitFor(() => !$gameMap.isEventRunning() && !$gameMessage.isBusy(), null, 30_000);
    const s2 = await game.eval(i => ({ defeated: Hai.SymbolEnemy.state($gameMap.event(i)).defeated, msgs: window.__msgs.slice() }), shade.id);
    check(s2.defeated && s2.msgs.includes("写しを渡した"), "影を倒したあとの声 " + JSON.stringify(s2));
    // P17：プラグインコマンド「影の声を出す」で、崩れる文章のあとに一行を話し手の名つき（ふつうの窓・下）で出す。倒して消えた影からも読める
    await game.eval(i => {
      window.__msgs = [];
      window.__voice = [];
      const add = Game_Message.prototype.add;
      Game_Message.prototype.add = function(text) {
        window.__voice.push({ text, speaker: this.speakerName(), background: this.background(), position: this.positionType() });
        return add.apply(this, arguments);
      };
      $gameMap._interpreter.setup([
        { code: 101, indent: 0, parameters: ["", 0, 0, 2, ""] },
        { code: 401, indent: 0, parameters: ["影は崩れた。"] },
        { code: 357, indent: 0, parameters: ["Hai_SymbolEnemy", "shadeVoice", "影の声を出す", { eventId: String(i), speaker: "焼けた村の子" }] },
        { code: 0, indent: 0, parameters: [] },
      ], 0);
    }, shade.id);
    for (let i = 0; i < 20 && (await game.eval(() => $gameMap.isEventRunning() || $gameMessage.isBusy())); i++) {
      await game.frames(15);
      await game.press("Enter");
    }
    await game.waitFor(() => !$gameMap.isEventRunning() && !$gameMessage.isBusy(), null, 30_000);
    const v = await game.eval(() => window.__voice.slice());
    check(v.length === 2 && v[0].text === "影は崩れた。" && v[1].text === "写しを渡した" && v[1].speaker === "焼けた村の子" && v[1].background === 0 && v[1].position === 2,
      "影の声を出す（崩れる → 声の順・名前つき） " + JSON.stringify(v));

    // ---- 9. 古いセーブ：スイッチ 125〜127 から開いた部屋を写す
    const old = await game.eval(() => {
      delete $gameSystem._hai.facilities;
      const r = { opened: Hai.Facilities.opened(), forged: Hai.Facilities.forgedLevel("weapon", 196) };
      return r;
    });
    check(JSON.stringify(old.opened) === '["infirmary","smithy","watch"]' && old.forged === 0, "古いセーブ " + JSON.stringify(old));

    game.assertNoErrors();
  } finally {
    await game.close();
  }
});
