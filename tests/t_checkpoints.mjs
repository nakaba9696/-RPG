// T12（#172）旗の束（docs/world.md 5.10、js/plugins/Hai_TestHooks.js の __game.setup）の検査：
//   束と行き先のそれぞれで、ニューゲームから束を立てて入口へ転送し、
//   ・入口（まだ無いマップは手前の入口）に着き、イベントに捕まらずに歩ける
//   ・鳴らした鐘の数（変数 101）・四つ鳴った（スイッチ 105）・3 つ目の場面（106）・仲間・生き残りの数（変数 103）・施設が束のとおり
//   ・着くまでの遊ぶ時間の目安（tests/playtime.mjs）とゲームの中の時間が 30 分以内（どの地域にも 30 分以内で入れる）
import { launchGame, check, runTest } from "./lib.mjs";
import { readCounters, playtimeSince, formatPlaytime } from "./playtime.mjs";

const LIMIT_MINUTES = 30;
// 名前・opts・着く所（mapId）・鐘の数・仲間（アクター ID）・生き残りの数・3 つ目の場面
const CASES = [
  { name: "fort", map: 10, bells: 0, companions: [], survivors: 1 },
  { name: "region1", map: 20, bells: 0, companions: [], survivors: 1 },
  { name: "cleared1", map: 10, bells: 1, companions: [5], survivors: 3 },
  { name: "region2", map: 60, bells: 1, companions: [5], survivors: 3 },
  { name: "region3", map: 70, bells: 1, companions: [5], survivors: 3 },
  { name: "region4", map: 50, bells: 1, companions: [5], survivors: 3 },
  { name: "region5", map: [110, 63], bells: 1, companions: [5, 6], survivors: 5 },
  { name: "bells2", map: 70, bells: 2, companions: [5, 6, 7], survivors: 6 },
  { name: "bells2", opts: { bells: ["foundry"] }, map: 60, bells: 2, companions: [5, 10, 11], survivors: 4 },
  { name: "bells3", map: [170, 94], bells: 3, companions: [5, 6, 7, 8, 9], survivors: 6, scene3: true },
  { name: "last", opts: { bells: ["water", "foundry"] }, map: [170, 84], bells: 3, companions: [5, 8, 9, 10, 11], survivors: 4, scene3: true },
  { name: "bells4", opts: { level: 20 }, map: [180, 19], bells: 4, companions: [5, 6, 7, 8, 9, 10, 11], survivors: 7, scene3: true, level: 20 },
];

await runTest(async () => {
  const game = await launchGame();
  try {
    const list = await game.call("checkpoints");
    check(list.bundles.join() === "fort,cleared1,bells2,bells3,bells4", "旗の束は 5 束 " + JSON.stringify(list));
    const maps = await game.eval(() => $dataMapInfos.map((m, i) => (m ? i : 0)).filter(Boolean));
    let shots = 0;

    for (const c of CASES) {
      const label = c.name + (c.opts ? " " + JSON.stringify(c.opts) : "");
      const before = await readCounters(game);
      const r = await game.call("setup", c.name, c.opts || {});
      await game.waitScene("Scene_Map");
      await game.waitFor(to => {
        const g = window.__game;
        const p = g.pos();
        return g.mapId() === to.mapId && p.x === to.x && p.y === to.y && !g.isBusy();
      }, r.to);
      await game.frames(20);

      const want = [].concat(c.map).find(id => maps.includes(id));
      check(r.to.mapId === want, `${label}: 着いたのが Map${r.to.mapId}（Map${want} のはず）`);
      const st = await game.eval(() => ({
        bells: $gameVariables.value(101),
        all: $gameSwitches.value(105),
        scene3: $gameSwitches.value(106),
        survivors: $gameVariables.value(103),
        party: $gameParty._actors.slice(),
        level: $gameParty.leader().level,
        running: $gameMap.isEventRunning() || $gameMessage.isBusy(),
        opened: Hai.Facilities.opened ? Hai.Facilities.opened() : null,
      }));
      check(st.bells === c.bells, `${label}: 鳴らした鐘の数 ${st.bells}（${c.bells} のはず）`);
      check(st.all === (c.bells === 4), `${label}: 四つ鳴った（スイッチ 105）が ${st.all}`);
      check(st.scene3 === !!c.scene3, `${label}: 3 つ目の場面（スイッチ 106）が ${st.scene3}`);
      check(st.survivors === c.survivors, `${label}: 生き残りの数 ${st.survivors}（${c.survivors} のはず）`);
      check(st.party.slice(1).join() === c.companions.join(), `${label}: 仲間 ${JSON.stringify(st.party)}（主人公と ${c.companions.join(",")} のはず）`);
      if (c.level) check(st.level === c.level, `${label}: レベル ${st.level}（${c.level} のはず）`);
      check(!st.running, `${label}: 着いた所でイベントが動いている（Map${r.to.mapId} (${r.to.x},${r.to.y})）`);

      // どの地域にも 30 分以内で入れる（ニューゲームから束を立てて着くまで。歩数・戦闘・思念の換算と、ゲームの中の時間）
      const e = await playtimeSince(game, { battles: before.battles, bosses: before.bosses, steps: 0, thoughts: 0, playtime: 0 });
      check(e.minutes <= LIMIT_MINUTES && e.playtime <= LIMIT_MINUTES * 60, `${label}: 入口まで ${formatPlaytime(e)}（ゲームの中 ${e.playtime} 秒）。${LIMIT_MINUTES} 分を超える`);

      // 入口から歩ける（どれかの向きに 1 歩出て、戻れる）
      let moved = 0;
      for (const d of [2, 4, 6, 8]) {
        if (await game.call("step", d)) {
          await game.waitPlayerStopped();
          moved = d;
          break;
        }
      }
      check(moved, `${label}: 入口 Map${r.to.mapId} (${r.to.x},${r.to.y}) からどこへも歩けない`);
      check(await game.call("step", 10 - moved), `${label}: 入口へ戻れない`);
      await game.waitPlayerStopped();
      console.log(`  ${label}: Map${r.to.mapId} (${r.to.x},${r.to.y})・鐘 ${st.bells}・仲間 ${c.companions.length}・生き残り ${st.survivors}・入口まで約 ${Math.round(e.minutes)} 分（ゲームの中 ${e.playtime} 秒）`);
      if (shots < 4 && ["fort", "region5", "bells3", "bells4"].includes(c.name)) {
        shots++;
        await game.shot(c.name);
      }
    }
    game.assertNoErrors();
  } finally {
    await game.close();
  }
});
