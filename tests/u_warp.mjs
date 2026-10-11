// U3 快適機能（js/plugins/Hai_Comfort.js）とセーブ地点の結界（js/plugins/Hai_Warp.js）の検査。試験場は Map909（tools/maps/src/u3_warp）。
//   1. 結界 A に歩いてぶつかる（触れる）と訪れたことになり、文章が出る。自動メモ（Hai_Thoughts）に 1 行残る。
//   2. A を調べると選択肢。行き先がまだ無いので「転送する」は出ず「まだ他の結界を知らない。」。「休む」で HP・MP が全快。
//   3. 結界 B まで歩いて触れる → B を調べて「転送する」→ 一覧は A だけ → A の 1 マス下に移る。
//   4. 下が壁の結界 C へは結界の位置に移る。拠点（Hai_Defeat）が決まると一覧の先頭に「牢獄の間」が出て、そこへ移れる。
//   5. 瞬間表示 ON で、窓が開いたフレームで全文が出る（OFF なら何十フレームもかかる）。
//   6. 早送り ON で Shift を押し続けると、文章の待ち（\|）とページ送りが飛ぶ。戦闘ログの待ちは半分。
//   7. オプション画面に 2 つの項目が出る。
//   8. セーブ → ページの読み直し → ロードで、訪れた結界が残る。オプションの値も残る。
import { launchGame, check, runTest } from "./lib.mjs";
import { readSource, findChars } from "../tools/maps/build.mjs";

const MAP_ID = 909;
const source = readSource("u3_warp");
const [START] = findChars(source.lines, "S");
const [A] = findChars(source.lines, "A");
const [B] = findChars(source.lines, "B");
const [C] = findChars(source.lines, "C");
const [EV_A, EV_B, EV_C] = [1, 2, 3]; // events の順

await runTest(async () => {
  const game = await launchGame();
  try {
    await game.call("newGame");
    await game.waitScene("Scene_Map");
    await game.call("transfer", MAP_ID, START.x, START.y, 8);
    await game.waitFor(id => window.__game.mapId() === id && !window.__game.isBusy(), MAP_ID);
    await game.waitFor(() => SceneManager._scene._spriteset._tilemap.isReady());

    const pos = () => game.call("pos");
    const visited = () => game.eval(() => Hai.Warp.visited());
    const choices = () => game.eval(() => $gameMessage.choices());
    const messageText = () => game.eval(() => $gameMessage._texts.join("\n"));
    const waitMessage = () => game.waitFor(() => $gameMessage.isBusy() && SceneManager._scene._messageWindow.isOpen());
    const closeMessage = async () => {
      await waitMessage();
      for (let i = 0; i < 20 && (await game.eval(() => $gameMessage.isBusy())); i++) {
        await game.press("Enter");
        await game.frames(4);
      }
      check(!(await game.eval(() => $gameMessage.isBusy())), "文章が閉じない");
      await game.waitFor(() => !$gameMap.isEventRunning());
    };
    const waitChoice = () => game.waitFor(() => SceneManager._scene._messageWindow._choiceListWindow.isOpenAndActive());
    const choose = async index => {
      await waitChoice();
      const now = await game.eval(() => SceneManager._scene._messageWindow._choiceListWindow.index());
      for (let i = now; i < index; i++) await game.press("ArrowDown");
      check(
        (await game.eval(() => SceneManager._scene._messageWindow._choiceListWindow.index())) === index,
        `選択肢の ${index} 番を選べない（${now} から ${await game.eval(() => SceneManager._scene._messageWindow._choiceListWindow.index())} まで）`,
      );
      await game.press("Enter");
    };
    const walk = async d => {
      const moved = await game.call("step", d);
      await game.waitPlayerStopped();
      return moved;
    };
    const waitAt = (x, y, mapId = MAP_ID) =>
      game.waitFor(([id, px, py]) => {
        const p = window.__game.pos();
        return window.__game.mapId() === id && p.x === px && p.y === py && !window.__game.isBusy();
      }, [mapId, x, y]);

    // ---- 1. 結界 A に触れる ----
    check(await walk(8), "A の下へ歩けない");
    check(!(await walk(8)), "結界 A を通り抜けた（通常キャラと同じ高さのはず）");
    await waitMessage();
    check((await messageText()).includes("西の結界"), `触れたときの文章が違う: ${await messageText()}`);
    await game.shot("visit-a");
    await closeMessage();
    let v = await visited();
    check(v.length === 1 && v[0].name === "西の結界" && v[0].eventId === EV_A && v[0].x === A.x && v[0].y === A.y,
      `訪れた結界が違う: ${JSON.stringify(v)}`);
    const note = await game.eval(() => Hai.Thoughts.notes().find(n => n.id === "warp:909,1"));
    check(note && note.text === "西の結界（結界の試験場）", `自動メモに結界が残らない: ${JSON.stringify(note)}`);
    // もう一度ぶつかっても文章は出ない
    check(!(await walk(8)), "結界 A を通り抜けた");
    await game.frames(5);
    check(!(await game.eval(() => $gameMessage.isBusy())), "訪れた結界にぶつかるたびに文章が出る");

    // ---- 2. A を調べる：行き先が無い・休む ----
    await game.eval(() => $gameParty.members().forEach(a => { a.setHp(1); a.setMp(0); }));
    await game.press("Enter");
    await waitChoice();
    check(JSON.stringify(await choices()) === JSON.stringify(["休む", "記録する", "やめる"]), `A の選択肢が違う: ${await choices()}`);
    check((await messageText()).includes("まだ他の結界を知らない。"), `行き先が無いときの文章が出ない: ${await messageText()}`);
    await game.shot("menu-no-destination");
    await choose(0);
    await closeMessage();
    const full = await game.eval(() => $gameParty.members().every(a => a.hp === a.mhp && a.mp === a.mmp));
    check(full, "「休む」で全快しない");

    // ---- 3. B まで歩いて触れ、B から A へ転送 ----
    check(await walk(2), "S へ戻れない");
    while ((await pos()).x < B.x - 1) check(await walk(6), `東へ歩けない（${JSON.stringify(await pos())}）`);
    check(!(await walk(6)), "結界 B を通り抜けた");
    await waitMessage();
    check((await messageText()).includes("東の結界"), "B に触れたときの文章が出ない");
    await closeMessage();
    check((await visited()).length === 2, "B を訪れたことにならない");

    await game.press("Enter");
    await waitChoice();
    check(JSON.stringify(await choices()) === JSON.stringify(["休む", "記録する", "転送する", "やめる"]), `B の選択肢が違う: ${await choices()}`);
    await game.shot("menu-b");
    await choose(2);
    await waitChoice();
    check(JSON.stringify(await choices()) === JSON.stringify(["西の結界", "やめる"]), `転送の一覧が違う（いまの所を除く）: ${await choices()}`);
    await game.shot("warp-list");
    await choose(0);
    await waitAt(A.x, A.y + 1);
    check((await pos()).d === 2, "転送のあと下を向いていない");
    await game.waitFor(() => !$gameMap.isEventRunning());
    await game.shot("warped-to-a");

    // ---- 4. 下が壁の結界 C・拠点 ----
    check((await game.eval(id => Hai.Warp.visit(909, id), EV_C)).name === "奥の結界", "C を visit できない");
    let dests = await game.eval(() => Hai.Warp.destinations());
    let ci = dests.findIndex(d => d.name === "奥の結界");
    check(ci >= 0, `一覧に C がない: ${JSON.stringify(dests)}`);
    check(await game.eval(i => Hai.Warp.warpTo(i), ci), "warpTo が false");
    await waitAt(C.x, C.y);

    await game.eval(() => Hai.Defeat.setHome(905, 4, 5, 2));
    dests = await game.eval(() => Hai.Warp.destinations());
    check(dests[0] && dests[0].name === "牢獄の間" && dests[0].home && dests[0].mapId === 905,
      `拠点が一覧の先頭にない: ${JSON.stringify(dests)}`);
    check(await game.eval(() => Hai.Warp.warpTo(0)), "拠点へ warpTo できない");
    await waitAt(4, 5, 905);
    await game.call("transfer", MAP_ID, START.x, START.y, 2);
    await waitAt(START.x, START.y);
    check(await game.eval(id => Hai.Warp.openMenu(id), EV_B), "openMenu が false");
    await waitChoice();
    check(JSON.stringify(await choices()) === JSON.stringify(["休む", "記録する", "転送する", "やめる"]), "openMenu の選択肢が違う");
    await choose(2);
    await waitChoice();
    check(JSON.stringify(await choices()) === JSON.stringify(["牢獄の間", "西の結界", "奥の結界", "やめる"]),
      `拠点つきの転送の一覧が違う: ${await choices()}`);
    await game.shot("warp-list-home");
    await game.press("Escape"); // 一覧をやめる
    await game.waitFor(() => !$gameMap.isEventRunning());

    // ---- 5. 瞬間表示 ----
    await game.eval(() => {
      const update = Window_Message.prototype.update;
      Window_Message.prototype.update = function() {
        update.apply(this, arguments);
        const r = window.__msg;
        if (!r) return;
        if (r.open === undefined && this.isOpen() && $gameMessage.hasText()) r.open = Graphics.frameCount;
        if (r.open !== undefined && r.done === undefined && !this._textState) r.done = Graphics.frameCount;
      };
    });
    const LONG = "結界の光は、灰に覆われた王国の地下で、今もかすかに脈を打っている。";
    const measure = async (text, hold) => {
      await game.eval(t => {
        window.__msg = {};
        $gameMessage.add(t);
      }, text);
      await game.waitFor(() => window.__msg.done !== undefined);
      const r = await game.eval(() => window.__msg);
      if (!hold) await closeMessage();
      return r.done - r.open;
    };
    await game.eval(() => Hai.Comfort.set("instantText", false));
    const slow = await measure(LONG);
    await game.eval(() => Hai.Comfort.set("instantText", true));
    const fast = await measure(LONG, true);
    await game.shot("instant-text");
    await closeMessage();
    console.log(`  全文が出るまで：通常 ${slow} フレーム、瞬間表示 ${fast} フレーム`);
    check(fast <= 1, `瞬間表示で 1 フレームで全文が出ない（${fast}）`);
    check(slow >= 20, `通常の表示が速すぎる（${slow}）`);
    // \| の待ちは瞬間表示でも残る
    const waited = await measure("待つ\\|続き");
    check(waited >= 55, `瞬間表示で \\| の待ちが消えた（${waited}）`);
    await game.eval(() => Hai.Comfort.set("instantText", false));

    // ---- 6. 早送り ----
    check(await game.eval(() => Hai.Comfort.get("fastForward")), "早送りの既定が ON でない");
    const WAITY = "一つ目の文\\|二つ目の文\\|三つ目の文";
    const normal = await measure(WAITY);
    await game.page.keyboard.down("Shift");
    await game.frames(3);
    check(await game.eval(() => Hai.Comfort.isFastForward()), "Shift を押しているのに早送りにならない");
    const logSpeed = await game.eval(() => Window_BattleLog.prototype.messageSpeed.call({}));
    await game.eval(t => {
      window.__msg = {};
      window.__msgStart = Graphics.frameCount;
      $gameMessage.add(t);
      $gameMessage.add(t); // 2 つ目の文章も入力なしで送られる
    }, WAITY);
    await game.waitFor(() => window.__msg.done !== undefined && !$gameMessage.isBusy(), null, 20000);
    const skipped = await game.eval(() => window.__msg.done - window.__msg.open);
    const total = await game.eval(() => Graphics.frameCount - window.__msgStart);
    await game.page.keyboard.up("Shift");
    await game.frames(2);
    console.log(`  \\| 2 つの文章：通常 ${normal} フレーム、早送り ${skipped} フレーム（2 つを閉じるまで ${total} フレーム）`);
    check(normal >= 120, `通常で \\| の待ちが無い（${normal}）`);
    check(skipped <= 2, `早送りで文章の待ちが飛ばない（${skipped}）`);
    check(logSpeed === 8, `早送り中の戦闘ログの待ちが半分でない（${logSpeed}）`);
    check((await game.eval(() => Window_BattleLog.prototype.messageSpeed.call({}))) === 16, "離したあとも戦闘ログが早い");
    await game.eval(() => Hai.Comfort.set("fastForward", false));
    await game.page.keyboard.down("Shift");
    await game.frames(3);
    check(!(await game.eval(() => Hai.Comfort.isFastForward())), "早送り OFF でも早送りになる");
    await game.page.keyboard.up("Shift");
    await game.eval(() => Hai.Comfort.set("fastForward", true));

    // ---- 7. オプション画面 ----
    await game.eval(() => {
      Hai.Comfort.set("instantText", true);
      SceneManager.push(Scene_Options);
    });
    await game.waitScene("Scene_Options");
    const opts = await game.eval(() => {
      const w = SceneManager._scene._optionsWindow;
      return { list: w._list.map(c => [c.name, c.symbol]), rows: w.maxVisibleItems ? w.maxVisibleItems() : 0, max: w.maxItems() };
    });
    const symbols = opts.list.map(c => c[1]);
    check(symbols.includes("haiInstantText") && symbols.includes("haiFastForward"), `オプションに項目がない: ${JSON.stringify(opts.list)}`);
    check(symbols.indexOf("haiInstantText") > symbols.indexOf("touchUI"), "項目がコアの項目の下にない");
    check(opts.rows >= opts.max, `オプションの窓に全部の項目が入らない（${opts.rows} 行に ${opts.max} 項目）`);
    await game.shot("options");
    await game.press("Escape");
    await game.waitScene("Scene_Map");

    // ---- 8. セーブ → 読み直し → ロード ----
    const before = await visited();
    check(before.length === 3, `訪れた結界が 3 つでない: ${JSON.stringify(before)}`);
    await game.call("save", 1);
    await game.reload();
    check(await game.eval(() => Hai.Comfort.get("instantText")), "瞬間表示の設定が残らない");
    await game.call("load", 1);
    await game.waitScene("Scene_Map");
    const after = await visited();
    check(JSON.stringify(after) === JSON.stringify(before), `ロードで訪れた結界が変わった: ${JSON.stringify(after)}`);
    await game.eval(() => {
      Hai.Comfort.set("instantText", false);
      ConfigManager.save();
    });

    game.assertNoErrors();
  } finally {
    await game.close();
  }
});
