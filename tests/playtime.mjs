// 通しテストの歩数から遊ぶ時間の目安を出す（T12。docs/world.md 5.7 の測り方）。
//   1 歩 0.25 秒 ＋ 戦闘 1 回 1 分 ＋ ボス 1 回 8 分 ＋ 思念 1 つ 20 秒
// 数はゲームの中の __game.playCounters()（js/plugins/Hai_TestHooks.js）から取る：
//   steps    $gameParty.steps()（プレイヤーが 1 歩動くたびに増える。__game.transfer の場所移動は数えない）
//   battles  始まった戦闘の数（ボス戦を含む。ページを読み直すと 0 に戻る）
//   bosses   そのうち、敵グループに <hai_boss> の敵がいる戦闘
//   thoughts 読んだ思念の数（Hai_Thoughts の既読）
// 使い方は tests/README.md の「遊ぶ時間の目安」。

/** 換算の値（秒）。world.md 5.7 を変えたら、ここも直す。 */
export const RATE = Object.freeze({ step: 0.25, battle: 60, boss: 480, thought: 20 });

/** 数から目安の秒を出す。ボス戦は battles にも入っているので、ボスは「ボス 8 分」だけ数え、戦闘 1 分は足さない。 */
export function estimatePlaytime({ steps = 0, battles = 0, bosses = 0, thoughts = 0 } = {}) {
  const normal = Math.max(0, battles - bosses);
  const parts = {
    steps: steps * RATE.step,
    battles: normal * RATE.battle,
    bosses: bosses * RATE.boss,
    thoughts: thoughts * RATE.thought,
  };
  const seconds = parts.steps + parts.battles + parts.bosses + parts.thoughts;
  return { steps, battles: normal, bosses, thoughts, parts, seconds, minutes: seconds / 60 };
}

/** 「歩数 1200（5.0 分）・戦闘 6（6 分）・ボス 1（8 分）・思念 9（3.0 分）→ 約 22 分」の形。 */
export function formatPlaytime(e) {
  const m = s => (s / 60).toFixed(1).replace(/\.0$/, "");
  return `歩数 ${e.steps}（${m(e.parts.steps)} 分）・戦闘 ${e.battles}（${m(e.parts.battles)} 分）・ボス ${e.bosses}（${m(e.parts.bosses)} 分）・思念 ${e.thoughts}（${m(e.parts.thoughts)} 分）→ 約 ${Math.round(e.minutes)} 分`;
}

/** 今の数（ゲームの中）。 */
export function readCounters(game) {
  return game.call("playCounters");
}

/** start（readCounters の戻り値）から今までの差と目安。 */
export async function playtimeSince(game, start) {
  const now = await readCounters(game);
  const diff = {};
  for (const k of ["steps", "battles", "bosses", "thoughts", "playtime"]) diff[k] = Math.max(0, now[k] - (start[k] || 0));
  return { ...estimatePlaytime(diff), playtime: diff.playtime };
}

/**
 * 測り始める。戻り値の report(label) で、測り始めからの目安を 1 行出して返す。
 *   const pt = await startPlaytime(game);
 *   … 本道を歩く …
 *   const e = await pt.report("地域五の本道");   // 「  遊ぶ時間の目安（地域五の本道）：歩数 … → 約 N 分」
 */
export async function startPlaytime(game) {
  const start = await readCounters(game);
  return {
    start,
    async report(label = "") {
      const e = await playtimeSince(game, start);
      console.log(`  遊ぶ時間の目安${label ? `（${label}）` : ""}：${formatPlaytime(e)}`);
      return e;
    },
  };
}
