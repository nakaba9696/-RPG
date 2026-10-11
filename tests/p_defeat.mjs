// P5 全滅と魔石（js/plugins/Hai_Defeat.js）の検査。試験場は Map905（tools/maps/src/p5_defeat）。
//   1. 拠点：灯を調べると setHome で戻る場所が決まる。
//   2. 全滅：ゲームオーバー画面にならず、暗い画面のまま拠点へ戻って文章が出る。所持金 0、drop() に座標と額、HP 1・状態異常なし。
//   3. 印：落としたマップに光る印が出る。
//   4. もう一度全滅すると、前の魔石は消える（印も 1 つだけ）。
//   5. セーブ → ページの読み直し → ロードでも drop() と印が残る。
//   6. 踏むと取り戻して所持金が戻る。向かい合って調べても取り戻せる。
//   7. 「戦闘の処理」で敗北可の戦闘では発動しない（MZ の既定の敗北の分岐へ進む）。
import { launchGame, check, runTest } from "./lib.mjs";
import { readSource, findChars } from "../tools/maps/build.mjs";

const MAP_ID = 905;
const source = readSource("p5_defeat");
const [HOME] = findChars(source.lines, "S");
const [LAMP] = findChars(source.lines, "L");
const [ENEMY] = findChars(source.lines, "E");
const [LOSER] = findChars(source.lines, "B");

await runTest(async () => {
  const game = await launchGame();
  try {
    await game.call("newGame");
    await game.waitScene("Scene_Map");
    await game.call("transfer", MAP_ID, LAMP.x, LAMP.y + 1, 8);
    await game.waitFor(id => window.__game.mapId() === id && !window.__game.isBusy(), MAP_ID);
    await game.waitFor(() => SceneManager._scene._spriteset._tilemap.isReady());

    // ゲームオーバー画面に行ったかを記録する（ページを読み直したら付け直す）
    const recordScenes = () => game.eval(() => {
      window.__scenes = [];
      const goto = SceneManager.goto;
      SceneManager.goto = function(sceneClass) {
        window.__scenes.push(sceneClass ? sceneClass.name : null);
        return goto.apply(this, arguments);
      };
    });
    await recordScenes();
    const sawGameover = () => game.eval(() => window.__scenes.includes("Scene_Gameover"));
    const gold = () => game.eval(() => $gameParty.gold());
    const setGold = n => game.eval(k => $gameParty.gainGold(k - $gameParty.gold()), n);
    const drop = () => game.eval(() => Hai.Defeat.drop());
    const markers = () => game.eval(() => Hai.Defeat.markers());
    const markerSprites = () =>
      game.eval(() =>
        SceneManager._scene._spriteset._haiMarkerSprites.map(s => ({
          x: s._character.x,
          y: s._character.y,
          name: s._characterName,
          visible: s.visible && s.parent === SceneManager._scene._spriteset._tilemap,
        })),
      );
    const closeMessage = async () => {
      await game.waitFor(() => $gameMessage.isBusy() && SceneManager._scene._messageWindow.isOpen());
      for (let i = 0; i < 20 && (await game.eval(() => $gameMessage.isBusy())); i++) {
        await game.press("Enter");
        await game.frames(4);
      }
      check(!(await game.eval(() => $gameMessage.isBusy())), "文章が閉じない");
    };
    const go = async (x, y, d) => {
      await game.call("transfer", MAP_ID, x, y, d);
      await game.waitFor(([id, px, py]) => {
        const p = window.__game.pos();
        return window.__game.mapId() === id && p.x === px && p.y === py && !window.__game.isBusy();
      }, [MAP_ID, x, y]);
    };
    // 戦闘：コマンドと文章を決定キーで送り、マップに戻るまで進める
    const fightUntilMap = async () => {
      await game.waitScene("Scene_Battle");
      await game.call("setSpeed", 4);
      try {
        for (let i = 0; i < 600; i++) {
          const s = await game.eval(() => {
            const scene = SceneManager._scene;
            const name = scene.constructor.name;
            if (name !== "Scene_Battle") return { name, busy: window.__game.isBusy() };
            const input = [scene._partyCommandWindow, scene._actorCommandWindow, scene._skillWindow, scene._enemyWindow, scene._actorWindow];
            return { name, input: input.some(w => w && w.active) || $gameMessage.isBusy() };
          });
          if (s.name === "Scene_Map" && !s.busy) return;
          if (s.name === "Scene_Battle" && s.input) await game.press("Enter");
          else await game.frames(5);
        }
        throw new Error("戦闘が終わらない");
      } finally {
        await game.call("setSpeed", 1);
      }
    };
    const params = await game.eval(() => Hai.Defeat.params);
    check(params.keepOld === false && params.markerImage === "!Crystal", "パラメータが既定と違う " + JSON.stringify(params));

    // --- 1. 拠点 ---
    const before = await game.eval(() => Hai.Defeat.home());
    const sys = await game.eval(() => ({ mapId: $dataSystem.startMapId, x: $dataSystem.startX, y: $dataSystem.startY }));
    check(before.mapId === sys.mapId && before.x === sys.x && before.y === sys.y, "未設定の拠点が開始位置でない " + JSON.stringify(before));
    await game.press("Enter");
    await closeMessage();
    const home = await game.eval(() => Hai.Defeat.home());
    check(home.mapId === MAP_ID && home.x === HOME.x && home.y === HOME.y && home.d === 2, "灯で拠点が決まらない " + JSON.stringify(home));

    // --- 2. 全滅 ---
    await setGold(500);
    await go(ENEMY.x - 1, ENEMY.y, 6);
    await game.call("step", 6); // 敵にぶつかる
    await fightUntilMap();
    check(!(await sawGameover()), "ゲームオーバー画面に行った");
    await game.waitFor(() => $gameMessage.isBusy() && SceneManager._scene._messageWindow.pause); // 文章が出きるまで
    const after = await game.eval(() => ({
      mapId: $gameMap.mapId(),
      pos: window.__game.pos(),
      brightness: $gameScreen.brightness(),
      returning: Hai.Defeat.isReturning(),
      text: $gameMessage._texts.slice(),
      members: $gameParty.members().map(a => ({ hp: a.hp, dead: a.isDead(), states: a.states().length })),
      running: $gameMap.isEventRunning(),
    }));
    check(after.mapId === MAP_ID && after.pos.x === HOME.x && after.pos.y === HOME.y, "拠点に戻っていない " + JSON.stringify(after));
    check(after.brightness === 0 && after.returning, "暗いまま文章を出していない " + JSON.stringify(after));
    check(after.text[0] === "ユエルの魂は牢獄の間へ引き戻された……", "全滅の文章 " + JSON.stringify(after.text));
    check(/500/.test(after.text[1] || ""), "落とした額の文章 " + JSON.stringify(after.text));
    check(after.members.every(m => !m.dead && m.hp >= 1 && m.states === 0), "HP 1・状態異常の解除 " + JSON.stringify(after.members));
    check(after.members.some(m => m.hp === 1), "HP 1 で起きていない " + JSON.stringify(after.members));
    check(!after.running, "全滅した戦闘のイベントが止まっていない");
    check((await gold()) === 0, "所持金が 0 でない");
    let d = await drop();
    check(d && d.mapId === MAP_ID && d.x === ENEMY.x - 1 && d.y === ENEMY.y && d.amount === 500, "drop() " + JSON.stringify(d));
    await game.shot("defeat-message");
    await closeMessage();
    await game.waitFor(() => !Hai.Defeat.isReturning() && $gameScreen.brightness() === 255);

    // --- 3. 印 ---
    await go(ENEMY.x - 3, ENEMY.y, 6);
    await game.frames(10);
    let m = await markers();
    check(m.length === 1 && m[0].x === ENEMY.x - 1 && m[0].y === ENEMY.y && m[0].amount === 500, "印 " + JSON.stringify(m));
    let sprites = await markerSprites();
    check(sprites.length === 1 && sprites[0].name === "!Crystal" && sprites[0].visible, "印の絵 " + JSON.stringify(sprites));
    await game.shot("dropped-marker");

    // --- 4. もう一度全滅すると前の魔石は消える ---
    await setGold(300);
    await go(ENEMY.x, ENEMY.y + 1, 8);
    await game.call("step", 8);
    await fightUntilMap();
    check(!(await sawGameover()), "2 度目でゲームオーバー画面に行った");
    await closeMessage();
    await game.waitFor(() => !Hai.Defeat.isReturning());
    d = await drop();
    check(d && d.x === ENEMY.x && d.y === ENEMY.y + 1 && d.amount === 300, "2 度目の drop() " + JSON.stringify(d));
    check((await game.eval(() => Hai.Defeat.drops())).length === 1, "前の魔石が残っている");
    m = await markers();
    check(m.length === 1 && m[0].x === ENEMY.x && m[0].y === ENEMY.y + 1, "2 度目の印 " + JSON.stringify(m));
    check((await gold()) === 0, "2 度目の所持金が 0 でない");

    // --- 5. セーブ → 読み直し → ロード ---
    await game.call("save", 1);
    await game.reload();
    await game.call("load", 1);
    await game.waitScene("Scene_Map");
    await recordScenes();
    await game.waitFor(() => SceneManager._scene._spriteset._tilemap.isReady());
    d = await drop();
    check(d && d.mapId === MAP_ID && d.x === ENEMY.x && d.y === ENEMY.y + 1 && d.amount === 300, "ロード後の drop() " + JSON.stringify(d));
    check((await game.eval(() => Hai.Defeat.home())).x === HOME.x, "ロード後の拠点");
    await game.frames(5);
    sprites = await markerSprites();
    check(sprites.length === 1 && sprites[0].x === ENEMY.x && sprites[0].y === ENEMY.y + 1, "ロード後の印 " + JSON.stringify(sprites));

    // --- 6. 踏むと取り戻す ---
    await go(ENEMY.x, ENEMY.y + 2, 8);
    check(await game.call("step", 8), "印のマスへ歩けない");
    await game.waitPlayerStopped();
    await game.waitFor(() => $gameMessage.isBusy());
    check((await gold()) === 300, "所持金が戻っていない");
    check((await drop()) === null && (await markers()).length === 0, "取り戻したのに残っている");
    await game.frames(5);
    check((await markerSprites()).length === 0, "印の絵が消えていない");
    await game.waitFor(() => SceneManager._scene._messageWindow.pause); // 文章が出きるまで
    await game.shot("recovered");
    await closeMessage();

    // 向かい合って調べても取り戻せる（落とした魔石を直接置いて確かめる）
    await game.eval(([id, x, y]) => {
      $gameSystem._hai.defeat.drop = { mapId: id, x, y, amount: 7 };
    }, [MAP_ID, HOME.x + 2, HOME.y]);
    await go(HOME.x + 1, HOME.y, 6);
    await game.press("Enter");
    await game.waitFor(() => $gameMessage.isBusy());
    check((await gold()) === 307 && (await drop()) === null, "調べて取り戻せない");
    await closeMessage();

    // --- 7. 敗北可の戦闘では発動しない ---
    const loserId = await game.eval(([x, y]) => $gameMap.eventIdXy(x, y), [LOSER.x, LOSER.y]);
    await go(LOSER.x, LOSER.y - 1, 2);
    await game.press("Enter");
    await fightUntilMap();
    check(!(await sawGameover()), "敗北可の戦闘でゲームオーバー画面に行った");
    await game.waitFor(() => $gameMessage.isBusy());
    const lose = await game.eval(id => ({
      pos: window.__game.pos(),
      gold: $gameParty.gold(),
      drop: Hai.Defeat.drop(),
      returning: Hai.Defeat.isReturning(),
      branch: $gameSelfSwitches.value([$gameMap.mapId(), id, "A"]),
      text: $gameMessage._texts.slice(),
    }), loserId);
    check(lose.pos.x === LOSER.x && lose.pos.y === LOSER.y - 1, "敗北可なのに移された " + JSON.stringify(lose));
    check(lose.gold === 307 && lose.drop === null && !lose.returning, "敗北可なのに魔石を落とした " + JSON.stringify(lose));
    check(lose.branch && /何も落とさない/.test(lose.text[0] || ""), "敗北の分岐に進んでいない " + JSON.stringify(lose));
    await closeMessage();

    game.assertNoErrors();
  } finally {
    await game.close();
  }
});
