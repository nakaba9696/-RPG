// 読み込み時間を測る道具（T14）。テストではない（名前に _ が無いので run.mjs は拾わない）。
// ゲームの起動・ニューゲーム・場所移動（マップの読み込み）・旗の束・マップの上の描画の速さを、同じ機械で版ごとに比べる。
//   node tests/loadtime.mjs            3 回測って中央値を出す
//   node tests/loadtime.mjs 5          回数を変える
// ゲームが重くなったのか CI の機械が遅いのかを分けるときは、古い版を git worktree に出し、このファイルを写して同じ機械で走らせて比べる。
import { launchGame } from "./lib.mjs";

const N = Number(process.argv[2] || 3);
// どの版にもある地図（砦・地域一〜五の入口あたり）。無い地図は飛ばす
const MAPS = [10, 19, 30, 50, 70, 90, 94, 100];
const BUNDLES = ["fort", "cleared1", "bells2", "bells4"];

const median = a => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};

async function once() {
  const r = {};
  let t = Date.now();
  const game = await launchGame({ name: "loadtime" });
  r["起動（タイトルまで）"] = Date.now() - t;
  try {
    t = Date.now();
    await game.call("newGame");
    await game.waitScene("Scene_Map");
    r["ニューゲーム → マップ"] = Date.now() - t;

    // 描画の速さ：マップの上で 120 フレーム（setSpeed 1）にかかる時間
    await game.frames(10);
    t = Date.now();
    await game.frames(120);
    r["マップで 120 フレーム"] = Date.now() - t;

    const exists = await game.eval(ids => ids.filter(id => $dataMapInfos[id]), MAPS);
    let sum = 0;
    for (const id of exists) {
      t = Date.now();
      await game.call("transfer", id, 1, 1, 2);
      await game.waitFor(m => window.__game.mapId() === m && !window.__game.isBusy(), id, 60_000);
      sum += Date.now() - t;
    }
    r[`場所移動 ${exists.length} 回（${exists.join("・")}）`] = sum;

    for (const b of BUNDLES) {
      t = Date.now();
      const res = await game.call("setup", b);
      await game.waitFor(to => window.__game.mapId() === to.mapId && !window.__game.isBusy(), res.to, 60_000);
      r[`旗の束 ${b}`] = Date.now() - t;
    }
    game.assertNoErrors();
  } finally {
    await game.close();
  }
  return r;
}

const runs = [];
for (let i = 0; i < N; i++) runs.push(await once());
console.log(`読み込み時間（${N} 回の中央値、ミリ秒）`);
for (const k of Object.keys(runs[0])) {
  console.log(`  ${k}: ${median(runs.map(r => r[k]))}（${runs.map(r => r[k]).join(" / ")}）`);
}
