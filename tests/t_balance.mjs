// T15 戦いを測る道具（tools/balance/）が動くことの小さな確かめ。全部の表は CI に入れない（手で node tools/balance/run.mjs --all）。
//   1. 基準の表（bosses.json）の 035 牢番を、攻撃と灰火で 2 回。勝ち負け・ターン・HP・倒れた人が取れて、狙いの幅と比べられる。
//   2. 同じ種でもう一度戦うと、行動の並びまで同じ結果（乱数の種で再現できる）。種を変えると乱数が変わる。
//   3. わざと牢番の技 169 鉄鞭の範囲を「味方全体」（敵自身）にすると（メモリの上だけ）、GAM-45 の誤りとして拾う。
//   4. pageerror・console の error がゼロ。
import fs from "node:fs";
import path from "node:path";
import { launchGame, check, runTest, ROOT } from "./lib.mjs";
import { prepare, measure, runOnce, runSeed, resolveCondition, judge, toMarkdown } from "../tools/balance/measure.mjs";
import { POLICIES } from "../tools/balance/policies.mjs";

const table = JSON.parse(fs.readFileSync(path.join(ROOT, "tools", "balance", "bosses.json"), "utf8"));
const WARDEN = 169; // 牢番の鉄鞭（範囲 1 敵単体・HP ダメージ）

await runTest(async () => {
  // 表の形：どの行も defaults と重ねて条件になり、遊び方の名前がある
  for (const b of table.bosses) {
    const c = resolveCondition(table.defaults, b);
    for (const p of c.policies) check(POLICIES[p], `${b.key} の遊び方 ${p} が policies.mjs に無い`);
    for (const p of Object.keys(b.target || {})) check(c.policies.includes(p), `${b.key} の狙いの幅 ${p} が測る遊び方に無い`);
  }
  check(runSeed(1, 0) !== runSeed(1, 1) && runSeed(1, 0) === runSeed(1, 0), "回ごとの種");

  const game = await launchGame();
  try {
    await prepare(game);
    const cond = resolveCondition(table.defaults, { ...table.bosses.find(b => b.key === "035"), runs: 2 });

    // 1. 2 回測る
    const m = await measure(game, cond, "attack");
    const s = m.summary;
    console.log(`  035 牢番：勝ち ${s.wins}/${s.runs}・ターン ${s.turns.min}〜${s.turns.max}・HP ${s.hp && Math.round(s.hp.mean * 100)}%`);
    check(s.runs === 2 && s.wins + s.loses + s.timeouts === 2, "回数 " + JSON.stringify(s));
    check(s.wins >= 1, "Lv5・4 の二人で牢番に一度も勝てない " + JSON.stringify(s));
    check(s.turns.min >= 2 && s.turns.max < cond.maxTurns, "ターン数 " + JSON.stringify(s.turns));
    check(s.hp.mean > 0 && s.hp.mean <= 1, "残る HP " + JSON.stringify(s.hp));
    for (const r of m.runs) {
      check(r.hp.length === 2 && r.mhp.every(x => x > 0), "隊の HP " + JSON.stringify(r));
      // 鎖縛りなどで動けない者は入力しない（ゲームのとおり）ので、二人ぶんより少ないターンはある
      check(r.actions.length >= r.turns, `行動を埋めていない（${r.turns} ターンで ${r.actions.length} 手）`);
      check(r.actions.some(a => a[1] === 1 && a[2] === "s161"), "主人公が灰火を使っていない");
      check(r.result !== "win" || r.enemyHp.every(h => h === 0), "勝ったのに敵が残る");
    }
    check(Object.keys(s.selfHits).length === 0, "今のデータで敵の技が敵に当たった " + JSON.stringify(s.selfHits));
    check(Array.isArray(judge(s, cond.target.attack)), "狙いの幅と比べられない");
    check(toMarkdown([{ ...m, target: cond.target.attack, verdict: judge(s, cond.target.attack) }]).includes("牢番（335）"), "表に出ない");

    // 2. 同じ種なら同じ（同じプロセスで、ほかの戦いのあとでも）
    const again = await runOnce(game, cond, "attack", runSeed(cond.seed, 0));
    check(JSON.stringify(again) === JSON.stringify(m.runs[0]), "同じ種で結果が違う\n" + JSON.stringify(again) + "\n" + JSON.stringify(m.runs[0]));
    const other = await runOnce(game, cond, "attack", 12345);
    check(JSON.stringify(other.actions) !== JSON.stringify(m.runs[0].actions) || other.hpRate !== m.runs[0].hpRate, "種を変えても同じ（乱数が効いていない）");

    // 3. 範囲の誤り（GAM-45）を拾う：メモリの上だけで鉄鞭を「味方全体」にする
    await game.eval(id => { window.__scope = $dataSkills[id].scope; $dataSkills[id].scope = 8; }, WARDEN);
    try {
      const broken = await runOnce(game, cond, "attack", runSeed(cond.seed, 0));
      check(broken.selfHits[WARDEN] > 0, "敵の技が敵自身に当たったのを拾えない " + JSON.stringify(broken.selfHits));
      const v = judge({ ...m.summary, selfHits: broken.selfHits }, cond.target.attack);
      check(v.some(t => t.includes("GAM-45")), "判定に出ない " + JSON.stringify(v));
    } finally {
      await game.eval(id => { $dataSkills[id].scope = window.__scope; }, WARDEN);
    }

    game.assertNoErrors();
  } finally {
    await game.close();
  }
});
