// P1 シンボル敵（js/plugins/Hai_SymbolEnemy.js）の検査。試験場は Map901（tools/maps/src/p1_symbols）。
//   1. 色：緑・黄・赤の敵に、強さの色が重なっている。黄はランダムに歩く。
//   2. 避ける：巡回する緑を、タイミングを見て通り抜けられる（戦闘が起きない）。
//   3. 接触で戦闘：黄（プレイヤーから接触）に敵の側からぶつかられて戦闘 → 勝つと消える（セルフスイッチ A）→ マップを出入りすると復活。
//   4. 追う：赤は追い始める距離の外では動かず、内に入ると近づき、離れると追うのをやめる。壁の向こうは見えない。
//   5. 逃げる：赤から逃げると 180 フレームはすり抜けて追わない。終わると元に戻る。
//   6. 一度きり：<hai_enemy_once> の赤は、勝つとマップを出入りしても出ない。
import { launchGame, check, runTest } from "./lib.mjs";
import { readSource, findChars } from "../tools/maps/build.mjs";

const MAP_ID = 901;
const source = readSource("p1_symbols");
const [START] = findChars(source.lines, "S");

await runTest(async () => {
  const game = await launchGame();
  try {
    await game.call("newGame");
    await game.waitScene("Scene_Map");
    await game.call("transfer", MAP_ID, START.x, START.y, 2);
    await game.waitFor(id => window.__game.mapId() === id && !window.__game.isBusy(), MAP_ID);
    await game.waitFor(() => SceneManager._scene._spriteset._tilemap.isReady());

    // 始まった戦闘の敵グループを記録する
    await game.eval(() => {
      window.__battles = [];
      const setup = BattleManager.setup;
      BattleManager.setup = function(troopId) {
        window.__battles.push(troopId);
        return setup.apply(this, arguments);
      };
    });
    const battles = () => game.eval(() => window.__battles.slice());

    // 敵の ID を強さで引く
    const ids = await game.eval(() => {
      const out = {};
      for (const ev of $gameMap.events()) {
        const rank = Hai.SymbolEnemy.rankOf(ev);
        if (rank) out[rank] = ev.eventId();
      }
      return out;
    });
    check(ids.green && ids.yellow && ids.red, "緑・黄・赤の敵がそろっていない " + JSON.stringify(ids));
    const info = id =>
      game.eval(i => {
        const ev = $gameMap.event(i);
        return { x: ev.x, y: ev.y, d: ev.direction(), speed: ev.moveSpeed(), page: ev._pageIndex, ...Hai.SymbolEnemy.state(ev) };
      }, id);
    const playerSpeed = await game.eval(() => $gamePlayer.moveSpeed());
    const params = await game.eval(() => Hai.SymbolEnemy.params);
    check(params.chaseRange === 4 && params.fleeFrames === 180, "パラメータが既定と違う " + JSON.stringify(params));

    // --- 1. 色 ---
    await game.frames(10);
    const tints = await game.eval(ids => {
      const sprites = SceneManager._scene._spriteset._characterSprites;
      const out = {};
      for (const [rank, id] of Object.entries(ids)) {
        const s = sprites.find(sp => sp._character === $gameMap.event(id));
        out[rank] = { got: s.getBlendColor(), want: Hai.SymbolEnemy.colorOf(rank), troop: Hai.SymbolEnemy.troopOf($gameMap.event(id)) };
      }
      const player = sprites.find(sp => sp._character === $gamePlayer).getBlendColor();
      return { out, player };
    }, ids);
    for (const [rank, t] of Object.entries(tints.out)) {
      check(JSON.stringify(t.got) === JSON.stringify(t.want) && t.want[3] > 0, `${rank} の色が違う ${JSON.stringify(t)}`);
    }
    check(tints.out.green.troop === 101 && tints.out.yellow.troop === 102 && tints.out.red.troop === 103, "敵グループの ID");
    check(tints.player.every(v => v === 0), "プレイヤーに色が付いている");
    // 3 体が見える所を撮る（プレイヤーは画面の外）
    await game.eval(() => $gameMap.setDisplayPos(1, 4));
    await game.frames(5);
    await game.shot("three-ranks");
    await game.eval(() => $gamePlayer.center($gamePlayer.x, $gamePlayer.y));

    // 黄はランダムに歩く
    const y0 = await info(ids.yellow);
    await game.call("setSpeed", 4);
    await game.waitFor(([i, x, y]) => {
      const ev = $gameMap.event(i);
      return ev.x !== x || ev.y !== y;
    }, [ids.yellow, y0.x, y0.y], 60_000);
    await game.call("setSpeed", 1);
    console.log("  色：緑・黄・赤が強さの色。黄はランダムに歩く");

    // --- 2. 緑を避けて通り抜ける ---
    // 開始地点（緑の通り道から 6 マス上）で、緑が通り道の右の端へ向かうのを待ち、下へ一気に抜ける。
    const g0 = await info(ids.green);
    check(g0.y === START.y + 6, `緑の位置 ${JSON.stringify(g0)}`);
    check(!g0.chasing && !(await game.eval(i => Hai.SymbolEnemy.canSeePlayer($gameMap.event(i)), ids.green)), "開始地点で緑に見つかっている");
    await game.waitFor(i => {
      const ev = $gameMap.event(i);
      return ev.x >= 10 && ev.direction() === 6;
    }, ids.green, 60_000);
    const crossTo = START.y + 12;
    await game.page.keyboard.down("ArrowDown");
    try {
      await game.waitFor(y => $gamePlayer.y >= y && !$gamePlayer.isMoving(), crossTo);
    } finally {
      await game.page.keyboard.up("ArrowDown");
    }
    await game.waitPlayerStopped();
    await game.frames(30);
    check((await battles()).length === 0, "緑を避けられなかった（戦闘になった）");
    check(await game.call("scene") === "Scene_Map", "マップのまま");
    const g1 = await info(ids.green);
    check(g1.x !== g0.x || g1.d !== g0.d, "緑が巡回していない");
    console.log(`  避ける：緑が右の端へ向かう間に (${START.x},${crossTo}) まで抜けた（緑は今 (${g1.x},${g1.y})）。戦闘なし`);

    // 勝つための準備
    await game.call("strengthenParty");
    const winBattle = async troopId => {
      await game.waitScene("Scene_Battle");
      check((await battles()).at(-1) === troopId, `敵グループ ${troopId} と戦っていない ${JSON.stringify(await battles())}`);
      await game.call("setSpeed", 4);
      try {
        await game.holdOkToMap();
      } finally {
        await game.call("setSpeed", 1);
      }
      await game.waitScene("Scene_Map");
      await game.waitFor(() => !$gameMap.isEventRunning());
      check(await game.eval(() => $gameTroop.isAllDead() && !$gameParty.isAllDead()), "勝っていない");
    };
    const reenter = async (x, y) => {
      await game.call("transfer", 900, 5, 7, 2);
      await game.waitFor(() => window.__game.mapId() === 900 && !window.__game.isBusy());
      await game.call("transfer", MAP_ID, x, y, 2);
      await game.waitFor(id => window.__game.mapId() === id && !window.__game.isBusy(), MAP_ID);
    };

    // --- 3. 黄（プレイヤーから接触）に、敵の側からぶつかられて戦闘 → 勝つと消える → 出入りで復活 ---
    await game.eval(i => $gameMap.event(i).locate(14, 11), ids.yellow);
    await game.call("transfer", MAP_ID, 16, 11, 4);
    await game.waitFor(() => !window.__game.isBusy() && $gamePlayer.x === 16);
    const yTrigger = await game.eval(i => $gameMap.event(i).page().trigger, ids.yellow);
    check(yTrigger === 1, "黄のトリガーは「プレイヤーから接触」のはず");
    await game.waitFor(i => Hai.SymbolEnemy.state($gameMap.event(i)).chasing || window.__game.scene() !== "Scene_Map", ids.yellow);
    await winBattle(102);
    const yWon = await info(ids.yellow);
    check(yWon.defeated && yWon.page === -1, "勝った黄が消えていない " + JSON.stringify(yWon));
    check(await game.eval(i => $gameSelfSwitches.value([901, i, "A"]), ids.yellow), "黄のセルフスイッチ A が ON でない");
    await game.frames(10);
    check(await game.eval(i => {
      const s = SceneManager._scene._spriteset._characterSprites.find(sp => sp._character === $gameMap.event(i));
      return !s.bitmap || s._characterName === "";
    }, ids.yellow), "消えた黄の絵が残っている");
    await game.shot("yellow-defeated");
    await reenter(4, 15);
    const yBack = await info(ids.yellow);
    check(!yBack.defeated && yBack.page === 0 && yBack.x === 14 && yBack.y === 10, "黄が復活していない " + JSON.stringify(yBack));
    console.log("  接触で戦闘：黄にぶつかられて戦闘 → 勝って消えた → マップを出入りして復活");

    // ここからは赤だけを見る（黄は消しておく）
    await game.eval(i => $gameMap.event(i).erase(), ids.yellow);

    // --- 4. 赤が追う ---
    const r0 = await info(ids.red);
    check(r0.x === 14 && r0.y === 15 && !r0.chasing, "赤の位置 " + JSON.stringify(r0));
    // 壁の向こう（距離 4 でも）は見えない
    await game.call("transfer", MAP_ID, 4, 12, 2);
    await game.waitFor(() => !window.__game.isBusy() && $gamePlayer.y === 12);
    await game.eval(i => $gameMap.event(i).locate(6, 14), ids.red);
    check(!(await game.eval(i => Hai.SymbolEnemy.canSeePlayer($gameMap.event(i)), ids.red)), "壁の向こうの赤に見つかった");
    await game.eval(i => $gameMap.event(i).locate(14, 15), ids.red);
    // 遠く（距離 10）と、少し外（距離 5）では動かない
    for (const x of [4, 9]) {
      await game.call("transfer", MAP_ID, x, 15, 6);
      await game.waitFor(px => !window.__game.isBusy() && $gamePlayer.x === px, x);
      await game.frames(90);
      const r = await info(ids.red);
      check(r.x === 14 && r.y === 15 && !r.chasing, `距離 ${14 - x} で赤が動いた ${JSON.stringify(r)}`);
    }
    // 1 歩入る（距離 4）と近づく
    check(await game.call("step", 6), "右に歩けない");
    await game.waitPlayerStopped();
    await game.waitFor(i => $gameMap.event(i).x < 14, ids.red);
    const r1 = await info(ids.red);
    check(r1.chasing && r1.speed < playerSpeed, `赤が追っていない、または速すぎる ${JSON.stringify(r1)}（プレイヤー ${playerSpeed}）`);
    await game.shot("red-chasing");
    // 左の端へ走って離れる → 追うのをやめ、その場で止まる
    await game.page.keyboard.down("ArrowLeft");
    try {
      await game.waitFor(() => $gamePlayer.x === 3 && !$gamePlayer.isMoving());
    } finally {
      await game.page.keyboard.up("ArrowLeft");
    }
    check((await battles()).length === 1, "赤に追いつかれた");
    await game.waitFor(i => {
      const ev = $gameMap.event(i);
      return !Hai.SymbolEnemy.state(ev).chasing && !ev.isMoving();
    }, ids.red);
    const r2 = await info(ids.red);
    await game.frames(90);
    const r3 = await info(ids.red);
    check(r3.x === r2.x && r3.y === r2.y && !r3.chasing, "範囲の外で赤が近づいた");
    check(r2.x - 3 > params.chaseRange, `赤が範囲の内で止まった ${JSON.stringify(r2)}`);
    console.log(`  追う：距離 10・5 では動かず、4 で近づき（速さ ${r1.speed} < ${playerSpeed}）、離れると (${r2.x},${r2.y}) で止まった`);

    // --- 5. 赤から逃げる → 180 フレームすり抜ける ---
    await game.page.keyboard.down("ArrowRight");
    try {
      await game.waitFor(() => window.__battles.length === 2);
    } finally {
      await game.page.keyboard.up("ArrowRight");
    }
    await game.waitScene("Scene_Battle");
    check((await battles()).at(-1) === 103, "赤と戦っていない");
    await game.call("setSpeed", 4);
    // 出現の文を送り、パーティのコマンドが選べるまで待つ
    for (let i = 0; i < 200; i++) {
      const s = await game.eval(() => ({
        party: SceneManager._scene._partyCommandWindow.active,
        msg: $gameMessage.isBusy(),
      }));
      if (s.party) break;
      if (s.msg) await game.press("Enter");
      else await game.frames(5);
    }
    await game.eval(() => {
      BattleManager._escapeRatio = 1; // 逃走を必ず成功させる
    });
    await game.shot("red-battle");
    await game.press("ArrowDown");
    check(await game.eval(() => SceneManager._scene._partyCommandWindow.currentSymbol()) === "escape", "「逃げる」が選べない");
    await game.press("Enter");
    for (let i = 0; i < 200 && (await game.call("scene")) !== "Scene_Map"; i++) {
      if (await game.eval(() => $gameMessage.isBusy())) await game.press("Enter");
      else await game.frames(5);
    }
    await game.call("setSpeed", 1);
    await game.waitScene("Scene_Map");
    await game.waitFor(() => !$gameMap.isEventRunning());
    const f0 = await info(ids.red);
    check(f0.flee > 150 && f0.through && !f0.chasing && !f0.defeated, "逃げたあとすり抜けになっていない " + JSON.stringify(f0));
    // 赤の方へ歩くと、重なって通り抜けられる（戦闘にならない）
    const p0 = await game.call("pos");
    const dir = f0.x > p0.x ? 6 : 4;
    await game.page.keyboard.down(dir === 6 ? "ArrowRight" : "ArrowLeft");
    try {
      await game.waitFor(([x, d]) => (d === 6 ? $gamePlayer.x >= x + 1 : $gamePlayer.x <= x - 1) && !$gamePlayer.isMoving(), [f0.x, dir]);
    } finally {
      await game.page.keyboard.up(dir === 6 ? "ArrowRight" : "ArrowLeft");
    }
    const f1 = await info(ids.red);
    check((await battles()).length === 2, "すり抜けの間に戦闘になった");
    check(f1.flee > 0 && f1.through && !f1.chasing, "すり抜けの間に追った " + JSON.stringify(f1));
    await game.shot("red-pass-through");
    // 180 フレームが過ぎると元に戻り、また追ってくる → 勝つ
    await game.waitFor(i => Hai.SymbolEnemy.state($gameMap.event(i)).flee === 0, ids.red);
    const f2 = await info(ids.red);
    check(!f2.through, "すり抜けが終わらない");
    console.log(`  逃げる：残り ${f0.flee} フレームのすり抜け → 赤を通り抜けて戦闘なし → 終わると元どおり`);

    // --- 6. 一度きりの赤に勝つと、出入りしても出ない ---
    await game.waitFor(() => window.__battles.length === 3, null, 60_000);
    await winBattle(103);
    check((await info(ids.red)).defeated, "赤に勝ったのに消えていない");
    await reenter(4, 15);
    const rBack = await info(ids.red);
    const gBack = await info(ids.green);
    check(rBack.defeated && rBack.page === -1, "一度きりの赤が復活した " + JSON.stringify(rBack));
    check(!gBack.defeated && gBack.page === 0, "緑がいない");
    console.log("  一度きり：赤は出入りしても出ない（緑・黄は出る）");

    game.assertNoErrors();
  } finally {
    await game.close();
  }
});
