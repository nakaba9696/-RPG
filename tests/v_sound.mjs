// V3 音の検査。
//   1. 製品のマップ（Map010〜084）がすべて BGM を自動演奏し、曲の名前が audio/bgm に、環境音の名前が audio/bgs にある（ブラウザなし）。
//   2. いくつかのマップに入ると AudioManager が data/MapNNN.json のとおりの曲・環境音を持つ。別のマップへ移ると切り替わる。
import fs from "node:fs";
import path from "node:path";
import { launchGame, check, runTest, ROOT } from "./lib.mjs";
import { readData } from "../tools/data/io.mjs";

const PRODUCT = readData("MapInfos.json").filter(m => m && m.id >= 10 && m.id <= 84).map(m => m.id);

function checkData() {
  for (const id of PRODUCT) {
    const map = readData(`Map${String(id).padStart(3, "0")}.json`);
    check(map.autoplayBgm && map.bgm.name, `Map${id} に BGM がない`);
    check(fs.existsSync(path.join(ROOT, "audio", "bgm", map.bgm.name + ".ogg")), `Map${id} の BGM ${map.bgm.name} が audio/bgm にない`);
    check(map.bgm.volume > 0 && map.bgm.volume <= 80, `Map${id} の BGM の音量 ${map.bgm.volume}（暗い世界は控えめ。80 以下）`);
    if (map.autoplayBgs) check(fs.existsSync(path.join(ROOT, "audio", "bgs", map.bgs.name + ".ogg")), `Map${id} の BGS ${map.bgs.name} が audio/bgs にない`);
  }
  console.log(`  ${PRODUCT.length} 枚のマップすべてに BGM（音量 80 以下）`);
}

await runTest(async () => {
  checkData();
  const game = await launchGame();
  try {
    await game.call("newGame");
    await game.waitScene("Scene_Map");
    const seen = [];
    for (const [id, x, y] of [[10, 16, 19], [20, 18, 27], [26, 4, 16], [10, 16, 19]]) {
      await game.call("transfer", id, x, y, 2);
      await game.waitFor(m => window.__game.mapId() === m && !window.__game.isBusy(), id);
      await game.frames(5);
      const got = await game.eval(() => ({
        bgm: AudioManager._currentBgm && AudioManager._currentBgm.name,
        bgs: AudioManager._currentBgs && AudioManager._currentBgs.name,
        want: [$dataMap.bgm.name, $dataMap.bgs.name],
      }));
      check(got.bgm === got.want[0] && got.bgm, `Map${id} の BGM が鳴っていない ${JSON.stringify(got)}`);
      check(got.bgs === got.want[1], `Map${id} の BGS が鳴っていない ${JSON.stringify(got)}`);
      seen.push(`${id}:${got.bgm}/${got.bgs}`);
    }
    check(seen[0] === seen[3] && seen[0] !== seen[1] && seen[1] !== seen[2], "マップを移っても曲が切り替わらない " + seen.join(" "));
    console.log("  入ると鳴る：" + seen.join("  "));
  } finally {
    await game.close();
  }
});
