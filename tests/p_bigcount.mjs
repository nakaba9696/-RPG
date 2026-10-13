// P19（#266）の検査：大きな数（Hai_BigCount）。頂の三十の数を、文章の窓でなく画面の上に大きく出す。
//   1. 漢数字：1→一、10→十、30→三十、31→三十一。
//   2. 「大きな数を出す」（イベントの 357）：数・変数・文字のどれでも出る。文章の窓は開かない。
//      前の数と入れ替わる。出す時間 0 は消すまで残り、0 より大きいと消える。「完了まで待つ」で次の命令が待つ。
//   3. 「大きな数を消す」で消える。場所移動で消える。メニューを開いて戻っても残る。
//   4. 絵：文章の窓と同じ書体。画面の上の真ん中。画面の大きさを変えても、画面に対する位置は変わらない。
//   5. 見た目：頂（Map015）で数と文章の窓（下）を一緒に撮る。
import { launchGame, check, runTest } from "./lib.mjs";

const TEST_MAP = 900;
const SUMMIT = 15;
const COUNT_VAR = 1152; // 頂:綱の回数

/** イベントの 357（プラグインコマンド）を 1 つ作る。 */
const cmd = (name, label, args, indent = 0) => ({ code: 357, indent, parameters: ["Hai_BigCount", name, label, args] });

await runTest(async () => {
  const game = await launchGame();
  try {
    await game.call("newGame");
    await game.waitScene("Scene_Map");
    await game.call("transfer", TEST_MAP, 5, 7, 2);
    await game.waitFor(id => window.__game.mapId() === id && !window.__game.isBusy(), TEST_MAP);

    /** マップのインタプリタで命令の並びを走らせる（終わりの code 0 は足す）。 */
    const run = list => game.eval(l => {
      $gameMap._interpreter.setup(l.concat([{ code: 0, indent: 0, parameters: [] }]), 0);
    }, list);
    const info = () => game.eval(() => {
      const sp = Hai.BigCount.sprite();
      return {
        text: Hai.BigCount.text(), phase: Hai.BigCount.phase(), busy: Hai.BigCount.isBusy(),
        running: $gameMap._interpreter.isRunning(), message: $gameMessage.isBusy(),
        sprite: sp && { visible: sp.visible, x: sp.x, y: sp.y, opacity: sp.opacity, face: sp.bitmap && sp.bitmap.fontFace, size: sp.bitmap && sp.bitmap.fontSize, onTop: SceneManager._scene.children.indexOf(sp) > SceneManager._scene.children.indexOf(SceneManager._scene._windowLayer) },
        w: Graphics.width, h: Graphics.height, mainFace: $gameSystem.mainFontFace(),
      };
    });

    // ===== 1. 漢数字 =====
    const kanji = await game.eval(() => [1, 7, 10, 11, 20, 29, 30, 31].map(n => Hai.BigCount.kanji(n)));
    check(kanji.join() === "一,七,十,十一,二十,二十九,三十,三十一", "漢数字が違う " + kanji.join());

    // ===== 2. 大きな数を出す =====
    await game.eval(v => $gameVariables.setValue(v, 30), COUNT_VAR);
    await run([cmd("show", "大きな数を出す", { number: "0", variableId: String(COUNT_VAR), text: "", duration: "0", fadeIn: "", fadeOut: "", wait: "true" })]);
    await game.frames(2);
    let s = await info();
    check(s.text === "三十。" && s.phase === "in", "変数 30 で「三十。」が現れない " + JSON.stringify(s));
    check(s.running, "「完了まで待つ」で現れる間に次へ進んだ");
    await game.waitFor(() => !$gameMap._interpreter.isRunning());
    s = await info();
    check(s.phase === "show" && s.sprite.visible && s.sprite.opacity === 255, "現れ終わって残っていない " + JSON.stringify(s));
    check(!s.message, "文章の窓が開いた");
    check(s.sprite.face === s.mainFace, `書体が文章の窓と違う（${s.sprite.face} / ${s.mainFace}）`);
    check(s.sprite.onTop, "文章の窓より奥にある");
    check(Math.abs(s.sprite.x - s.w / 2) <= 1 && Math.abs(s.sprite.y / s.h - 0.22) < 0.01, "位置が画面の上の真ん中でない " + JSON.stringify(s));
    await game.frames(120);
    check((await info()).text === "三十。", "出す時間 0 なのに消えた");

    // 数で出す・入れ替わる
    await run([cmd("show", "大きな数を出す", { number: "7", variableId: "0", text: "", duration: "0", fadeIn: "0", fadeOut: "", wait: "false" })]);
    await game.frames(2);
    s = await info();
    check(s.text === "七。" && s.phase === "show" && s.sprite.opacity === 255, "数 7 で「七。」に入れ替わらない " + JSON.stringify(s));

    // 文字で出す・出す時間のあとに消える。完了まで待つは消え終わるまで
    await run([
      cmd("show", "大きな数を出す", { number: "0", variableId: "0", text: "四。　五。　六。", duration: "30", fadeIn: "6", fadeOut: "6", wait: "true" }),
      { code: 122, indent: 0, parameters: [COUNT_VAR, COUNT_VAR, 0, 0, 99] },
    ]);
    await game.frames(10);
    s = await info();
    check(s.text === "四。　五。　六。", "文字がそのまま出ない " + JSON.stringify(s));
    check(s.running && (await game.eval(v => $gameVariables.value(v), COUNT_VAR)) === 30, "出す時間の間に次の命令へ進んだ");
    await game.waitFor(() => !$gameMap._interpreter.isRunning());
    s = await info();
    check(s.text === "" && s.phase === "none" && !s.sprite.visible, "出す時間のあとに消えない " + JSON.stringify(s));
    check((await game.eval(v => $gameVariables.value(v), COUNT_VAR)) === 99, "消え終わったあとの命令が走らない");

    // ===== 3. 消す・場所移動・メニュー =====
    await run([cmd("show", "大きな数を出す", { number: "12", variableId: "0", text: "", duration: "0", fadeIn: "", fadeOut: "", wait: "true" })]);
    await game.waitFor(() => !$gameMap._interpreter.isRunning());
    await run([cmd("hide", "大きな数を消す", { fadeOut: "10", wait: "true" })]);
    await game.frames(3);
    s = await info();
    check(s.phase === "out" && s.running && s.sprite.opacity < 255, "消え方の途中でない " + JSON.stringify(s));
    await game.waitFor(() => !$gameMap._interpreter.isRunning());
    check((await info()).phase === "none", "「大きな数を消す」で消えない");

    await game.eval(() => Hai.BigCount.show("十三。", { fadeIn: 0 }));
    await game.press("Escape");
    await game.waitScene("Scene_Menu");
    await game.press("Escape");
    await game.waitScene("Scene_Map");
    await game.frames(2);
    s = await info();
    check(s.text === "十三。" && s.sprite.visible && s.sprite.opacity === 255, "メニューから戻ると消えた " + JSON.stringify(s));
    await game.call("transfer", TEST_MAP, 6, 7, 2);
    await game.waitFor(id => window.__game.mapId() === id && !window.__game.isBusy() && !$gamePlayer.isTransferring(), TEST_MAP);
    await game.frames(2);
    check((await info()).phase === "none", "場所移動で消えない");

    // ===== 4. 画面の大きさを変える =====
    await game.eval(() => Hai.BigCount.show("三十一。", { fadeIn: 0 }));
    await game.frames(2);
    const before = await info();
    await game.eval(() => Graphics.resize(960, 540));
    await game.frames(3);
    const after = await info();
    await game.eval(() => Graphics.resize(1280, 720));
    await game.frames(3);
    check(after.w === 960 && after.h === 540, "画面の大きさが変わらない " + JSON.stringify(after));
    check(Math.abs(after.sprite.x / after.w - before.sprite.x / before.w) < 0.01 && Math.abs(after.sprite.y / after.h - before.sprite.y / before.h) < 0.01,
      `画面の大きさを変えると位置がずれる（前 ${before.sprite.x},${before.sprite.y} / 後 ${after.sprite.x},${after.sprite.y}）`);
    check(after.sprite.size < before.sprite.size, "画面を小さくしても字が小さくならない");
    await game.eval(() => Hai.BigCount.hide(0));

    // ===== 5. 頂で撮る =====
    await game.call("transfer", SUMMIT, 22, 11, 8);
    await game.waitFor(id => window.__game.mapId() === id && !$gamePlayer.isTransferring(), SUMMIT);
    await game.eval(() => {
      $gameMap._interpreter.clear(); // 着いたときの自動の場面は撮る邪魔なので止める
      for (const ev of $gameMap.events()) if (ev.page() && ev.page().trigger >= 3) ev.erase();
      $gameMessage.clear();
    });
    await game.waitFor(() => SceneManager._scene._spriteset._tilemap.isReady());
    await run([
      { code: 250, indent: 0, parameters: [{ name: "Bell3", volume: 95, pitch: 80, pan: 0 }] },
      cmd("show", "大きな数を出す", { number: "1", variableId: "0", text: "", duration: "0", fadeIn: "", fadeOut: "", wait: "true" }),
      { code: 101, indent: 0, parameters: ["", 0, 0, 2, ""] },
      { code: 401, indent: 0, parameters: ["鐘が鳴る。音が、灰の払われた空へ上がっていく。"] },
    ]);
    await game.waitFor(() => $gameMessage.isBusy() && SceneManager._scene._messageWindow.isOpen() && !SceneManager._scene._messageWindow._textState);
    await game.frames(10);
    await game.shot("summit-one");
    check((await info()).text === "一。", "頂で「一。」が出ていない");
    await game.press("Enter");
    await game.waitFor(() => !$gameMap._interpreter.isRunning());
    await run([cmd("show", "大きな数を出す", { number: "30", variableId: "0", text: "", duration: "0", fadeIn: "", fadeOut: "", wait: "true" })]);
    await game.waitFor(() => !$gameMap._interpreter.isRunning());
    await game.shot("summit-thirty");

    game.assertNoErrors();
  } finally {
    await game.close();
  }
});
