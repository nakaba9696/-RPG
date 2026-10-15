#!/usr/bin/env node
// 戦いを測る道具の入口（T15 #309）。本物の Scene_Battle を早送りで回し、ボスのターン数・残る HP を測る。
//
//   node tools/balance/run.mjs --all                       基準の表（bosses.json）の全部
//   node tools/balance/run.mjs 112 083                     表の行を名前（key）で選ぶ
//   node tools/balance/run.mjs 112 --runs 4 --policy attack  回数・遊び方を上書き
//   node tools/balance/run.mjs --troop 1051 --party 1,5,6 --levels 8,8,8   表に無い条件をその場で
//
// 引数（表の値を上書きする）：
//   --runs N  --seed N  --policy 名前[,名前]  --max-turns N  --potions N（回復の品の数）
//   --troop N  --party 1,5,6  --levels 8,8,8  --name 名前
// 出力：表（Markdown）を標準出力に、JSON と Markdown を tests/out/balance/ に（コミットしない）。
// 狙いの幅から外れた行があっても終了コードは 0（測るだけ）。--strict で 1 にする。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchGame, ROOT } from "../../tests/lib.mjs";
import { prepare, measure, resolveCondition, judge, toMarkdown, pct } from "./measure.mjs";
import { policy } from "./policies.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const table = JSON.parse(fs.readFileSync(path.join(here, "bosses.json"), "utf8"));
const actors = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "Actors.json"), "utf8"));

// ---------------------------------------------------------------- 引数
const args = process.argv.slice(2);
const opt = {};
const keys = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--all" || a === "--strict") opt[a.slice(2)] = true;
  else if (a.startsWith("--")) {
    const [k, v] = a.includes("=") ? a.slice(2).split("=") : [a.slice(2), args[++i]];
    if (v === undefined) throw new Error(`${a} に値が無い`);
    opt[k] = v;
  } else keys.push(a);
}
const nums = s => String(s).split(",").map(Number);

let rows;
if (opt.troop) {
  rows = [{ key: `troop${opt.troop}`, name: opt.name ?? "", troop: Number(opt.troop), party: nums(opt.party ?? "1"), levels: nums(opt.levels ?? "1") }];
} else if (opt.all) {
  rows = table.bosses;
} else if (keys.length) {
  rows = keys.map(k => {
    const r = table.bosses.find(b => b.key === k);
    if (!r) throw new Error(`表に ${k} が無い（${table.bosses.map(b => b.key).join("・")}）`);
    return r;
  });
} else {
  console.log("使い方：node tools/balance/run.mjs --all | <key>… | --troop N --party 1,5,6 --levels 8,8,8（tools/balance/README.md）");
  process.exit(2);
}

const over = {};
if (opt.runs) over.runs = Number(opt.runs);
if (opt.seed) over.seed = Number(opt.seed);
if (opt["max-turns"]) over.maxTurns = Number(opt["max-turns"]);
if (opt.policy) over.policies = opt.policy.split(",");
if (opt.potions) over.items = { ...(table.defaults.items || {}), [table.defaults.heal.item]: Number(opt.potions) };
if (opt.troop && opt.party) over.party = nums(opt.party);
if (opt.troop && opt.levels) over.levels = nums(opt.levels);

const conds = rows.map(r => {
  const c = resolveCondition(table.defaults, { ...r, ...over });
  c.names = Object.fromEntries(c.party.map(id => [id, id === Number(c.hero.actor) ? "主人公" : actors[id]?.name ?? String(id)]));
  c.policies.forEach(policy); // 名前の間違いを先に
  return c;
});

// ---------------------------------------------------------------- 回す
const outDir = path.join(ROOT, "tests", "out", "balance");
fs.mkdirSync(outDir, { recursive: true });
const t0 = Date.now();
const game = await launchGame({ name: "balance" });
const results = [];
try {
  await prepare(game);
  for (const c of conds) {
    for (const p of c.policies) {
      const t1 = Date.now();
      const m = await measure(game, c, p);
      m.target = (c.target || {})[p] ?? null;
      m.verdict = judge(m.summary, m.target);
      results.push(m);
      const s = m.summary;
      console.log(`  ${c.key} ${c.name ?? ""}・${m.label}：勝ち ${s.wins}/${s.runs}・ターン ${s.turns.min}〜${s.turns.max}（中央 ${s.turns.median}）` +
        `・HP ${s.hp ? pct(s.hp.mean) : "―"}${m.verdict && m.verdict.length ? "・外れ " + m.verdict.join("・") : ""}（${((Date.now() - t1) / 1000).toFixed(0)} 秒）`);
    }
  }
  game.assertNoErrors();
} finally {
  await game.close();
}

// ---------------------------------------------------------------- 出す
const md = [
  `## 戦いを測る道具の結果（${new Date().toISOString().slice(0, 10)}）`,
  "",
  `条件：装備は ${conds[0].equip === "join" ? "加入時のまま" : "指定"}・SP は${conds[0].tp === "full" ? "満タン" : conds[0].tp}・` +
    `回復の品 ${Object.entries(conds[0].items).map(([id, n]) => `${id} 番×${n}`).join("・")}（HP ${pct(conds[0].heal.rate)} 未満で使う）・乱数の種 ${conds[0].seed}・打ち切り ${conds[0].maxTurns} ターン。`,
  "ターンは全部の回、残る HP は勝った回の隊の HP の合計の割合。判定はターンの中央値と HP の平均を狙いの幅と比べる。",
  "",
  toMarkdown(results),
  "",
].join("\n");
console.log("\n" + md);
const stamp = opt.troop ? `troop${opt.troop}` : opt.all ? "all" : keys.join("_");
fs.writeFileSync(path.join(outDir, `${stamp}.md`), md);
fs.writeFileSync(path.join(outDir, `${stamp}.json`), JSON.stringify(results, null, 1));
console.log(`出力：${path.relative(ROOT, path.join(outDir, stamp))}.{md,json}（${((Date.now() - t0) / 1000).toFixed(0)} 秒）`);
if (opt.strict && results.some(r => r.verdict && r.verdict.length)) process.exitCode = 1;
