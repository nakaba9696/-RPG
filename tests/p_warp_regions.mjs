// P18（#265）転送の行き先を地域ごとに・見張り台の入口は結界と混ぜない（js/plugins/Hai_Warp.js）。試験場は Map909（tools/maps/src/u3_warp）。
//   1. 触れた結界は Hai.Warp.visited() にだけ入り、見張り台（Hai_Facilities）の入口は入らない（セーブに入らない。古いセーブにも残らない）。
//   2. 行き先が 8 つを超えると、「転送する」はまず地域の一覧（拠点が先頭、地図の並び、見張り台の入口は最後の見出し）。カーソルは今いる地域。
//   3. 地域を選ぶとその地域の結界だけ。「戻る」（キャンセル）で地域の一覧へ戻る。
//   4. 別の地域の結界を選ぶと、そのマップの結界の 1 マス下へ移る。
import { launchGame, check, runTest } from "./lib.mjs";
import { readSource, findChars } from "../tools/maps/build.mjs";

const MAP_ID = 909;
const source = readSource("u3_warp");
const [START] = findChars(source.lines, "S");
const [A] = findChars(source.lines, "A");
const [B] = findChars(source.lines, "B");
const [C] = findChars(source.lines, "C");
const EV_B = 2;
// 触れたことにする結界（data/MapNNN.json の <hai_warp>）
const TOUCHED = [
  { mapId: 61, eventId: 11, x: 33, y: 9, name: "村の祠の下" },
  { mapId: 20, eventId: 7, x: 38, y: 45, name: "霧の森の入口" },
  { mapId: 80, eventId: 9, x: 12, y: 23, name: "記録院の前庭" },
  { mapId: 26, eventId: 7, x: 5, y: 20, name: "坑道の入口" },
  { mapId: 60, eventId: 11, x: 44, y: 20, name: "焼けた村の入口" },
  { mapId: 21, eventId: 44, x: 33, y: 41, name: "古い礼拝堂" },
  { mapId: 70, eventId: 6, x: 25, y: 6, name: "霧の湖の入口" },
  { mapId: 909, eventId: 1, x: A.x, y: A.y, name: "西の結界" },
  { mapId: 909, eventId: 3, x: C.x, y: C.y, name: "奥の結界" },
  { mapId: 909, eventId: 2, x: B.x, y: B.y, name: "東の結界" }, // 一覧を開く所（いまの所なので一覧には出ない）
];

await runTest(async () => {
  const game = await launchGame();
  try {
    await game.call("newGame");
    await game.waitScene("Scene_Map");
    await game.call("transfer", MAP_ID, START.x, START.y, 8);
    await game.waitFor(id => window.__game.mapId() === id && !window.__game.isBusy(), MAP_ID);

    const choices = () => game.eval(() => $gameMessage.choices());
    const messageText = () => game.eval(() => $gameMessage._texts.join("\n"));
    const cursor = () => game.eval(() => SceneManager._scene._messageWindow._choiceListWindow.index());
    const waitChoice = () => game.waitFor(() => SceneManager._scene._messageWindow._choiceListWindow.isOpenAndActive());
    const choose = async index => {
      await waitChoice();
      for (let i = 0, now = await cursor(); i < 30 && now !== index; i++, now = await cursor()) {
        await game.press(now < index ? "ArrowDown" : "ArrowUp");
      }
      check((await cursor()) === index, `選択肢の ${index} 番を選べない（${await cursor()}）`);
      await game.press("Enter");
    };
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

    // 触れた結界・拠点・見張り台（霧の森と霧の湖を訪れた）
    await game.eval(list => {
      $gameSystem._hai = $gameSystem._hai || {};
      $gameSystem._hai.warp = { visited: list.map(v => ({ ...v })) };
      Hai.Defeat.setHome(905, 4, 5, 2);
      Hai.Facilities.open("watch");
      $gameSystem._hai.automap = $gameSystem._hai.automap || {};
      $gameSystem._hai.automap[20] = { w: 1, h: 1, v: "B" };
      $gameSystem._hai.automap[70] = { w: 1, h: 1, v: "B" };
    }, TOUCHED);

    // ---- 1. 見張り台の入口は「訪れた結界」に入らない ----
    const watch = await game.eval(() => Hai.Facilities.watchDestinations().map(d => d.name));
    check(same(watch, ["霧の森の門", "霧の湖の石段"]), `見張り台の入口 ${JSON.stringify(watch)}`);
    const visitedNames = (await game.eval(() => Hai.Warp.visited())).map(v => v.name);
    check(!visitedNames.some(n => watch.includes(n)), `見張り台の入口が訪れた結界に入った ${JSON.stringify(visitedNames)}`);
    const dests = await game.eval(() => Hai.Warp.destinations());
    for (const n of watch) {
      const d = dests.find(d => d.name === n);
      check(d && d.exact && d.group === "見張り台から見えた入口", `見張り台の入口の見出しが違う ${JSON.stringify(d)}`);
    }
    check(await game.eval(() => Hai.Warp.regionOf(61)) === "焼けた村", "regionOf(61)");

    // ---- 2. 地域の一覧 ----
    check(await game.eval(id => Hai.Warp.openMenu(id), EV_B), "openMenu が false");
    await choose(2); // 転送する
    await waitChoice();
    const TOP = ["牢獄の間", "霧の森", "鉄の坑道", "焼けた村", "霧の湖", "記録院", "そのほか", "見張り台から見えた入口", "やめる"];
    check(same(await choices(), TOP), `地域の一覧が違う: ${await choices()}`);
    check((await cursor()) === TOP.indexOf("そのほか"), `カーソルが今いる地域にない（${await cursor()}）`);
    await game.shot("warp-regions");

    // ---- 3. 地域の中・戻る ----
    await choose(TOP.indexOf("霧の森"));
    await waitChoice();
    check(same(await choices(), ["霧の森の入口", "古い礼拝堂", "戻る", "やめる"]), `霧の森の結界が違う: ${await choices()}`);
    check((await messageText()).includes("霧の森のどこへ転送する？"), `地域の中の文章 ${await messageText()}`);
    await game.shot("warp-region-forest");
    await game.press("Escape"); // 戻る
    await waitChoice();
    check(same(await choices(), TOP), `「戻る」で地域の一覧に戻らない: ${await choices()}`);
    await choose(TOP.indexOf("見張り台から見えた入口"));
    await waitChoice();
    check(same(await choices(), ["霧の森の門", "霧の湖の石段", "戻る", "やめる"]), `見張り台の見出しの中 ${await choices()}`);
    await choose(2); // 戻る
    await waitChoice();

    // ---- 4. 焼けた村の祠の下へ ----
    await choose(TOP.indexOf("焼けた村"));
    await waitChoice();
    check(same(await choices(), ["焼けた村の入口", "村の祠の下", "戻る", "やめる"]), `焼けた村の結界が違う: ${await choices()}`);
    await choose(1);
    await game.waitFor(() => window.__game.mapId() === 61 && !window.__game.isBusy(), null, 30000);
    const p = await game.call("pos");
    check(p.x === 33 && (p.y === 10 || p.y === 9), `村の祠の下の結界のそばに着かない ${JSON.stringify(p)}`);
    await game.waitFor(() => !$gameMap.isEventRunning());

    game.assertNoErrors();
  } finally {
    await game.close();
  }
});
