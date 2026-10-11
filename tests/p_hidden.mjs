// P2 隠し通路（js/plugins/Hai_HiddenPassage.js）の検査。見本のマップ Map902（tools/maps/src/p2_hidden）で：
//   見えない通路を通れる／ふつうの壁は通れない／隠し扉は調べる前は通れず、調べると開いて通れる／
//   片側扉は表から通れず裏から開く／隠し階段を調べると現れて踏むと移動する／found() に記録される／
//   セーブ・ロード（ページの読み直しをはさむ）の後も開いたまま。手がかり 3 種のスクリーンショットを撮る。
// P10：タイルセット 12（B が Outside_B）の Map911（tools/maps/src/p10_hidden_tiles）で、開いた扉と現れた階段が
//   タイルセットのメモ欄 <hai_hidden_tiles:…> の D のタイルで描かれ、現れた階段に 4 方向から入れる（梯子の絵でも）。
import { launchGame, check, runTest } from "./lib.mjs";

const MAP = 902;
const SLOT = 3;
// 地図の座標（tools/maps/src/p2_hidden.txt）
const PASSAGE = [9, 10, 11, 12].map(x => ({ x, y: 11 })); // 見えない通路（H）
const DOOR = { x: 16, y: 8 }; // 隠し扉（D）
const ONEWAY = { x: 6, y: 8 }; // 片側扉（O、裏は上）
const STAIRS = { x: 10, y: 4 }; // 隠し階段（v）
const STAIRS_TO = { x: 23, y: 14 };

await runTest(async () => {
  const game = await launchGame();
  const hp = (fn, ...args) => game.eval(([f, a]) => window.Hai.HiddenPassage[f](...a), [fn, args]);
  const pos = () => game.call("pos");
  const canPass = (x, y, d) => game.call("canPass", x, y, d);

  async function go(x, y, d) {
    await game.call("transfer", MAP, x, y, d);
    await game.waitFor(([m, x2, y2]) => {
      const g = window.__game;
      const p = g.pos();
      return g.mapId() === m && p.x === x2 && p.y === y2 && !g.isBusy();
    }, [MAP, x, y]);
  }

  /** 1 歩。動けたら止まるまで待つ。 */
  async function step(d) {
    const moved = await game.call("step", d);
    if (moved) await game.waitPlayerStopped();
    return moved;
  }

  async function turn(d) {
    await game.eval(dir => window.__game.ref("$gamePlayer").setDirection(dir), d);
  }

  /** 決定キーで調べ、出た文章を読んで閉じる。文章の中身を返す。 */
  async function investigate() {
    await game.press("Enter");
    await game.waitFor(() => window.__game.ref("$gameMessage").isBusy());
    const text = await game.eval(() => window.__game.ref("$gameMessage").allText());
    await game.frames(30);
    await game.press("Enter");
    await game.waitFor(() => !window.__game.ref("$gameMessage").isBusy());
    await game.frames(5);
    return text;
  }

  try {
    await game.call("setSpeed", 2);
    await game.call("newGame");
    await game.waitScene("Scene_Map");
    await go(5, 11, 6);

    // 手がかり 3 種（植生の違う床 (8,11)、影の無い壁 (13,11) の左、くぼんだ壁 (16,8)）が 1 枚に入る
    const tiles = await game.eval(([d, p]) => {
      const g = window.__game;
      return { moss: g.tileId(8, 11, 1), shadowB: [9, 10, 11, 12, 13].map(y => g.tileId(13, y, 4)), door: g.tileId(d.x, d.y, 0), wall: g.tileId(d.x - 1, d.y, 0) };
    }, [DOOR, PASSAGE]);
    check(tiles.moss !== 0, "通路の手前の床に第 2 層の模様がない");
    check(tiles.shadowB[2] === 0 && tiles.shadowB.filter((s, i) => i !== 2).every(s => s !== 0), `影の無い壁：部屋 B の壁ぎわの影 ${tiles.shadowB}`);
    check(Math.floor((tiles.door - 2048) / 48) !== Math.floor((tiles.wall - 2048) / 48), "隠し扉が周りの壁と同じ kind");
    await go(7, 10, 2); // 3 つの手がかりが画面に収まる位置
    await game.shot("clues");

    // ---- ふつうの壁は通れない
    check(!(await canPass(3, 11, 4)), "部屋 A の左の壁を通れた");
    check(!(await canPass(8, 10, 6)), "部屋 A の右の壁（通路でない段）を通れた");
    check(await hp("isHiddenAt", 9, 11), "isHiddenAt(9,11) が false");
    check((await hp("regionKind", 9, 11)) === 251 && (await hp("regionKind", 8, 11)) === 0, "regionKind");

    // ---- 見えない通路：壁に見えて通れる。歩くと found() に入る
    await go(8, 11, 6);
    check(await canPass(8, 11, 6), "見えない通路に入れない");
    // イベント（シンボル敵など）はタイルどおりで、見えない通路に入れない（#17 の推し A）
    check(!(await game.eval(() => window.__game.ref("$gameMap").event(1).canPass(8, 11, 6))), "イベントが見えない通路に入れた");
    for (let i = 0; i < 5; i++) check(await step(6), `見えない通路を ${i + 1} 歩目で進めない`);
    let p = await pos();
    check(p.x === 13 && p.y === 11, `通路を抜けて部屋 B に出ていない (${p.x},${p.y})`);
    for (const c of PASSAGE) check(await hp("isFound", c.x, c.y), `通路 (${c.x},${c.y}) が found にない`);
    check(!(await hp("isHiddenAt", 9, 11)), "通った通路がまだ isHiddenAt");
    // 通路の中から上下（ふつうの壁）へは出られない
    check(!(await canPass(10, 11, 8)) && !(await canPass(10, 11, 2)), "通路の中から上下の壁へ出られた");

    // ---- 隠し扉：調べる前は通れず、調べると開く
    await go(DOOR.x, DOOR.y + 1, 8);
    check(!(await canPass(DOOR.x, DOOR.y + 1, 8)), "調べる前の隠し扉を通れた");
    check(!(await step(8)), "調べる前の隠し扉に入れた");
    // 横を向いて決定キーを押しても開かない（向かい合って調べたときだけ）
    await turn(4);
    await game.press("Enter");
    await game.frames(10);
    check(!(await hp("isFound", DOOR.x, DOOR.y)), "向かい合っていないのに隠し扉が開いた");
    await turn(8);
    const doorText = await investigate();
    check(doorText.includes("隠し扉を見つけた"), `隠し扉の文章: ${doorText}`);
    check(await hp("isFound", DOOR.x, DOOR.y), "調べた隠し扉が found にない");
    check((await game.call("tileId", DOOR.x, DOOR.y, 3)) === 183, "開いた扉にアーチが重なっていない");
    await game.shot("door-open");
    for (let i = 0; i < 4; i++) check(await step(8), `開いた隠し扉の先へ ${i + 1} 歩目で進めない`);
    p = await pos();
    check(p.x === DOOR.x && p.y === DOOR.y - 3, `隠し部屋に着いていない (${p.x},${p.y})`);

    // 隠し部屋の赤い宝箱
    await go(16, 4, 6);
    const potions = () => game.eval(() => window.__game.ref("$gameParty").numItems($dataItems[7]));
    const before = await potions();
    await investigate();
    check((await potions()) === before + 1, "赤い宝箱からポーションが出ない");

    // ---- 片側扉：表（部屋 A）からは通れず、裏（隠し部屋）から入ると開く
    await go(ONEWAY.x, ONEWAY.y + 1, 8);
    check(!(await canPass(ONEWAY.x, ONEWAY.y + 1, 8)), "片側扉を表から通れた");
    check(!(await step(8)), "片側扉に表から入れた");
    // 表から調べても何も起きない
    await game.press("Enter");
    await game.frames(10);
    check(!(await game.eval(() => window.__game.ref("$gameMessage").isBusy())), "表から調べた片側扉で文章が出た");
    check(!(await hp("isFound", ONEWAY.x, ONEWAY.y)), "表から調べた片側扉が開いた");
    await go(ONEWAY.x, ONEWAY.y - 3, 2);
    for (let i = 0; i < 4; i++) check(await step(2), `裏から片側扉へ ${i + 1} 歩目で進めない`);
    p = await pos();
    check(p.x === ONEWAY.x && p.y === ONEWAY.y + 1, `片側扉を抜けて部屋 A に出ていない (${p.x},${p.y})`);
    check(await hp("isFound", ONEWAY.x, ONEWAY.y), "開いた片側扉が found にない");
    check(await canPass(ONEWAY.x, ONEWAY.y + 1, 8), "開いた片側扉を表から通れない");

    // ---- 隠し階段：調べる前は踏んでも何も起きず、調べると現れて、踏むと移動する
    await go(STAIRS.x - 1, STAIRS.y, 6);
    check(await step(6), "隠し階段のマス（床）に乗れない");
    await game.frames(20);
    p = await pos();
    check((await game.call("mapId")) === MAP && p.x === STAIRS.x && p.y === STAIRS.y, "調べる前の隠し階段で移動した");
    check(await step(4), "隠し階段のマスから戻れない");
    await go(STAIRS.x - 1, STAIRS.y, 6); // 隊列を足元に集める（仲間が階段のマスに立って絵が隠れないように）
    const stairsText = await investigate();
    check(stairsText.includes("隠し階段を見つけた"), `隠し階段の文章: ${stairsText}`);
    check((await game.call("tileId", STAIRS.x, STAIRS.y, 3)) === 26, "現れた階段が描かれていない");
    await game.shot("stairs-found");
    check(await step(6), "現れた階段に乗れない");
    await game.waitFor(([x, y]) => {
      const g = window.__game;
      const q = g.pos();
      return q.x === x && q.y === y && !g.isBusy();
    }, [STAIRS_TO.x, STAIRS_TO.y]);

    // ---- found() に 4 種類が入っている
    const found = await hp("found", MAP);
    const kinds = new Set(found.map(e => e.region));
    check([251, 252, 253, 254].every(k => kinds.has(k)), `found() の種類: ${[...kinds]}`);
    // 見えない通路 4 マス＋扉の奥の通路 2 マス × 2 か所＋扉 2 つ＋階段 1 つ
    check(found.length === PASSAGE.length + 4 + 3, `found() の数 ${found.length}`);
    check((await hp("found", 1)).length === 0, "ほかのマップの found() が空でない");

    // ---- セーブ → ページの読み直し → ロードで、開いたまま
    await go(DOOR.x, DOOR.y + 1, 8);
    await game.call("save", SLOT);
    await game.reload();
    await game.call("load", SLOT);
    await game.waitScene("Scene_Map");
    p = await pos();
    check((await game.call("mapId")) === MAP && p.x === DOOR.x && p.y === DOOR.y + 1, "ロード後の位置");
    check(await hp("isFound", DOOR.x, DOOR.y), "ロード後に隠し扉が閉じている");
    check((await game.call("tileId", DOOR.x, DOOR.y, 3)) === 183, "ロード後に開いた扉の絵が消えた");
    check((await game.call("tileId", STAIRS.x, STAIRS.y, 3)) === 26, "ロード後に階段の絵が消えた");
    check((await hp("found", MAP)).length === found.length, "ロード後の found() の数");
    check(await step(8), "ロード後に開いた隠し扉を通れない");
    // 片側扉もマップを出入りした後に開いたまま
    await go(ONEWAY.x, ONEWAY.y + 1, 8);
    check(await step(8), "ロード後に開いた片側扉を表から通れない");
    await game.shot("after-load");

    // ---- P10：タイルセット 12（B が Outside_B）の Map911。タイルセットのメモ欄 <hai_hidden_tiles:D:183,D:26> で描く
    const OUT = 911;
    const OUT_DOOR = { x: 6, y: 5 }; // 隠し扉（D）。奥は見えない通路（6,4）と隠し部屋
    const OUT_STAIRS = { x: 10, y: 7 }; // 隠し階段（v）。行き先は (3,9)
    const goOut = async (x, y, d) => {
      await game.call("transfer", OUT, x, y, d);
      await game.waitFor(([m, x2, y2]) => {
        const g = window.__game;
        const q = g.pos();
        return g.mapId() === m && q.x === x2 && q.y === y2 && !g.isBusy();
      }, [OUT, x, y]);
    };
    await goOut(OUT_DOOR.x, OUT_DOOR.y + 1, 8);
    check((await game.eval(() => window.__game.ref("$gameMap").tilesetId())) === 12, "Map911 のタイルセットが 12 でない");
    let tiles2 = await hp("overlayTiles");
    check(tiles2.door === 512 + 183 && tiles2.stairs === 512 + 26, `タイルセット 12 の重ねるタイル ${JSON.stringify(tiles2)}`);
    check(!(await step(8)), "調べる前の外の隠し扉に入れた");
    const outDoorText = await investigate();
    check(outDoorText.includes("隠し扉を見つけた"), `外の隠し扉の文章: ${outDoorText}`);
    check((await game.call("tileId", OUT_DOOR.x, OUT_DOOR.y, 3)) === 512 + 183, "外の開いた扉が D の暗いアーチ（695）で描かれていない");
    await game.shot("outside-door-open");
    for (let i = 0; i < 3; i++) check(await step(8), `外の開いた隠し扉の先へ ${i + 1} 歩目で進めない`);
    p = await pos();
    check(p.x === OUT_DOOR.x && p.y === OUT_DOOR.y - 2, `外の隠し部屋に着いていない (${p.x},${p.y})`);

    await goOut(OUT_STAIRS.x - 1, OUT_STAIRS.y, 6);
    const outStairsText = await investigate();
    check(outStairsText.includes("隠し階段を見つけた"), `外の隠し階段の文章: ${outStairsText}`);
    check((await game.call("tileId", OUT_STAIRS.x, OUT_STAIRS.y, 3)) === 512 + 26, "外の現れた階段が D の下り階段（538）で描かれていない");
    await game.shot("outside-stairs-found");
    // 4 方向から入れる
    check(await canPass(OUT_STAIRS.x - 1, OUT_STAIRS.y, 6), "現れた階段に左から入れない");
    check(await canPass(OUT_STAIRS.x + 1, OUT_STAIRS.y, 4), "現れた階段に右から入れない");
    check(await canPass(OUT_STAIRS.x, OUT_STAIRS.y - 1, 2), "現れた階段に上から入れない");
    check(await canPass(OUT_STAIRS.x, OUT_STAIRS.y + 1, 8), "現れた階段に下から入れない");

    // マップのメモ欄が優先（マップ ＞ タイルセット ＞ パラメータ）。片方だけ書けば、もう片方はタイルセットの値
    const withMapNote = note => game.eval(([v]) => {
      const dm = window.__game.ref("$dataMap");
      const before = dm.meta.hai_hidden_tiles;
      if (v === null) delete dm.meta.hai_hidden_tiles; else dm.meta.hai_hidden_tiles = v;
      const t = window.Hai.HiddenPassage.overlayTiles();
      if (before === undefined) delete dm.meta.hai_hidden_tiles; else dm.meta.hai_hidden_tiles = before;
      return t;
    }, [note]);
    tiles2 = await withMapNote("B:183,B:26");
    check(tiles2.door === 183 && tiles2.stairs === 26, `マップのメモ欄が優先されない ${JSON.stringify(tiles2)}`);
    tiles2 = await withMapNote("700");
    check(tiles2.door === 700 && tiles2.stairs === 512 + 26, `マップのメモ欄が片方だけのとき ${JSON.stringify(tiles2)}`);

    // 描いたタイルが梯子（Outside_B の B:26。タイルの通行は左右が×）でも、現れた階段には横から入れる（イベントはタイルどおり）
    await game.eval(([x, y]) => {
      const dm = window.__game.ref("$dataMap");
      dm.data[(3 * dm.height + y) * dm.width + x] = 26;
    }, [OUT_STAIRS.x, OUT_STAIRS.y]);
    check(!(await game.eval(([x, y]) => window.__game.ref("$gameMap").isPassable(x, y, 4), [OUT_STAIRS.x, OUT_STAIRS.y])), "梯子のタイルが左から通れる（試験の前提）");
    check(await canPass(OUT_STAIRS.x - 1, OUT_STAIRS.y, 6), "梯子の絵の現れた階段に左から入れない");
    check(await canPass(OUT_STAIRS.x + 1, OUT_STAIRS.y, 4), "梯子の絵の現れた階段に右から入れない");
    check(await step(6), "梯子の絵の現れた階段に左から乗れない");
    await game.waitFor(() => {
      const g = window.__game;
      const q = g.pos();
      return q.x === 3 && q.y === 9 && !g.isBusy();
    });

    game.assertNoErrors();
  } finally {
    await game.close();
  }
});
