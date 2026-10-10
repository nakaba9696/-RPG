// スモーク：タイトル → ニューゲーム → マップで歩く → 戦闘に勝つ → マップに戻る → セーブ → 読み直し → ロードで同じ場所に戻る。
// pageerror・console error・HTTP エラーがゼロであること。
import { launchGame, check, runTest } from "./lib.mjs";

await runTest(async () => {
  const game = await launchGame();
  try {
    await game.shot("title");

    // タイトル：カーソルは「ニューゲーム」にある。決定キーで始める。
    await game.press("Enter");
    await game.waitScene("Scene_Map");
    const start = await game.call("pos");
    const startMap = await game.call("mapId");
    const sys = await game.eval(() => ({ id: $dataSystem.startMapId, x: $dataSystem.startX, y: $dataSystem.startY }));
    check(startMap === sys.id && start.x === sys.x && start.y === sys.y, `開始位置が System.json と違う ${JSON.stringify(start)}`);
    await game.shot("map-start");

    // キー入力で 1 歩（右）
    await game.page.keyboard.down("ArrowRight");
    await game.waitFor(x => window.__game.pos().x !== x, start.x);
    await game.page.keyboard.up("ArrowRight");
    await game.waitPlayerStopped();
    // 窓口から 2 歩（下・左）
    for (const d of [2, 4]) {
      check(await game.call("step", d), `向き ${d} に歩けない`);
      await game.waitPlayerStopped();
    }
    const walked = await game.call("pos");
    check(walked.x !== start.x || walked.y !== start.y, "歩いても位置が変わらない");
    console.log(`  歩いた: (${start.x},${start.y}) → (${walked.x},${walked.y})`);
    await game.shot("map-walked");

    // 戦闘：敵グループ 1 と戦い、決定キーの連打（たたかう → 攻撃 → 対象 → …）で勝つ。
    const troopId = 1;
    const before = await game.eval(() => ({
      exp: $gameParty.members().map(a => a.currentExp()),
      gold: $gameParty.gold(),
    }));
    await game.call("strengthenParty");
    await game.call("startBattle", troopId, true, false);
    await game.waitScene("Scene_Battle");
    await game.frames(90); // 敵の出現の文が出るまで
    await game.shot("battle");
    // 決定キーを押したままにする（MZ は押し続けると一定の間隔で決定を繰り返す）。
    // ヘッドレスの描画は遅いので、戦闘の間は 1 回の描画で 4 フレーム進める。
    await game.call("setSpeed", 4);
    await game.page.keyboard.down("Enter");
    try {
      await game.waitFor(() => window.__game.scene() === "Scene_Map", null, 120_000);
    } finally {
      await game.page.keyboard.up("Enter");
      await game.call("setSpeed", 1);
    }
    await game.waitScene("Scene_Map");
    const after = await game.eval(() => ({
      exp: $gameParty.members().map(a => a.currentExp()),
      gold: $gameParty.gold(),
      allDead: $gameTroop.isAllDead(),
      partyAlive: !$gameParty.isAllDead(),
    }));
    check(after.allDead && after.partyAlive, `勝っていない ${JSON.stringify(after)}`);
    check(after.exp.every((e, i) => e > before.exp[i]), "経験値が増えていない");
    check((await game.call("pos")).x === walked.x, "戦闘のあと位置が変わった");
    await game.shot("map-after-battle");

    // セーブ → 読み直し → ロード
    const saved = { pos: await game.call("pos"), mapId: await game.call("mapId"), gold: after.gold, exp: after.exp };
    await game.call("save", 1);
    await game.reload();
    check(await game.eval(() => DataManager.savefileExists(1)), "読み直したらセーブ 1 がない");
    await game.call("load", 1);
    await game.waitScene("Scene_Map");
    const loaded = {
      pos: await game.call("pos"),
      mapId: await game.call("mapId"),
      ...(await game.eval(() => ({ gold: $gameParty.gold(), exp: $gameParty.members().map(a => a.currentExp()) }))),
    };
    check(JSON.stringify(loaded) === JSON.stringify(saved), `ロードした状態が違う\n  セーブ: ${JSON.stringify(saved)}\n  ロード: ${JSON.stringify(loaded)}`);
    await game.shot("map-loaded");

    game.assertNoErrors();
  } finally {
    await game.close();
  }
});
