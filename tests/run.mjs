// テストの入口。tests/ の <レーン>_<名前>.mjs（例 t_smoke.mjs、p_symbol_enemy.mjs）を名前順に 1 本ずつ別のプロセスで走らせる。
// 1 本でも落ちたら終了コード 1。
//   node tests/run.mjs                 全部
//   node tests/run.mjs t_smoke t_maps  名前（拡張子なし）で選ぶ
//   node tests/run.mjs --shard 2/4     所要時間（tests/durations.json）で 4 つに均して配った 2 番目だけ（CI の並列用。--shard=2/4 も可）
//   node tests/run.mjs --plan 4        4 つへの配り分けと見込み時間を表示するだけ（テストは走らせない）
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
let shard = null;
let planN = 0;
const names = [];
for (let k = 0; k < args.length; k++) {
  const a = args[k];
  if (a === "--plan" || a.startsWith("--plan=")) {
    const v = a === "--plan" ? args[++k] : a.slice("--plan=".length);
    planN = /^\d+$/.test(v || "") ? Number(v) : 0;
    if (planN < 1) {
      console.error(`--plan の値が正しくない: ${v}（例 --plan 4）`);
      process.exit(1);
    }
  } else if (a === "--shard" || a.startsWith("--shard=")) {
    const v = a === "--shard" ? args[++k] : a.slice("--shard=".length);
    const m = /^(\d+)\/(\d+)$/.exec(v || "");
    const i = m ? Number(m[1]) : 0;
    const n = m ? Number(m[2]) : 0;
    if (!m || n < 1 || i < 1 || i > n) {
      console.error(`--shard の値が正しくない: ${v}（例 --shard 2/3）`);
      process.exit(1);
    }
    shard = { i, n };
  } else {
    names.push(a);
  }
}
if ((shard || planN) && names.length) {
  console.error("--shard・--plan と名前の指定は一緒に使えない");
  process.exit(1);
}
const wanted = names.map(a => a.replace(/\.mjs$/, ""));

const all = fs
  .readdirSync(here)
  .filter(f => /^[a-z][a-z0-9]*_[A-Za-z0-9_-]+\.mjs$/.test(f))
  .sort();

// 所要時間の表（テスト名 → CI での秒数）。CI のログの「OK（N 秒）」を写して手で直す。表に無いテストは 180 秒とみなす。
const DEFAULT_SEC = 180;
function loadDurations() {
  const table = JSON.parse(fs.readFileSync(path.join(here, "durations.json"), "utf8"));
  for (const [k, v] of Object.entries(table)) {
    if (typeof v !== "number" || !(v >= 0)) throw new Error(`tests/durations.json の ${k} が 0 以上の数でない: ${v}`);
  }
  return table;
}

// 所要時間の大きい順に（同じなら名前順）、いま最も軽いシャード（同じなら番号の小さい方）へ配る。
// 決まった分け方で、表が同じなら結果も同じ。全シャードの和が全部になり、重なりはない。
function makePlan(n) {
  const table = loadDurations();
  const sec = f => {
    const name = f.replace(/\.mjs$/, "");
    return Object.hasOwn(table, name) ? table[name] : DEFAULT_SEC;
  };
  const order = [...all].sort((a, b) => sec(b) - sec(a) || (a < b ? -1 : a > b ? 1 : 0));
  const shards = Array.from({ length: n }, () => ({ files: [], sec: 0 }));
  for (const f of order) {
    let best = shards[0];
    for (const s of shards) if (s.sec < best.sec) best = s;
    best.files.push(f);
    best.sec += sec(f);
  }
  for (const s of shards) s.files.sort();
  return { shards, sec };
}

function printPlan(plan, mark) {
  const fmt = t => `${Math.floor(t / 60)} 分 ${String(Math.round(t % 60)).padStart(2, "0")} 秒`;
  console.log(`配り分け（${plan.shards.length} シャード、見込みは tests/durations.json。表に無いテストは ${DEFAULT_SEC} 秒）`);
  plan.shards.forEach((s, k) => {
    const list = s.files.map(f => `${f.replace(/\.mjs$/, "")} ${plan.sec(f)}`).join(", ") || "（なし）";
    console.log(`${k + 1 === mark ? "→" : " "} ${k + 1}/${plan.shards.length}  見込み ${fmt(s.sec)}  ${list}`);
  });
}

if (planN) {
  printPlan(makePlan(planN), 0);
  process.exit(0);
}

let files = wanted.length ? all.filter(f => wanted.includes(f.replace(/\.mjs$/, ""))) : all;
if (shard) {
  const plan = makePlan(shard.n);
  printPlan(plan, shard.i); // CI のログの頭に全体の配り分けを出す
  files = plan.shards[shard.i - 1].files;
  console.log(`シャード ${shard.i}/${shard.n}: ${files.join(", ") || "（なし）"}`);
  if (files.length === 0) process.exit(0); // テストの本数よりシャードが多いとき
}

if (wanted.length && files.length !== wanted.length) {
  const missing = wanted.filter(w => !all.includes(w + ".mjs"));
  console.error("見つからないテスト: " + missing.join(", "));
  process.exit(1);
}
if (files.length === 0) {
  console.error("テストがない");
  process.exit(1);
}

function runOne(file) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [path.join(here, file)], { stdio: "inherit" });
    child.on("exit", (code, signal) => resolve(signal ? 1 : code));
  });
}

const t0 = Date.now();
const failed = [];
for (const file of files) {
  console.log(`▶ ${file}`);
  const code = await runOne(file);
  if (code !== 0) {
    failed.push(file);
    console.log(`✗ ${file}（終了コード ${code}）`);
  }
}
const sec = ((Date.now() - t0) / 1000).toFixed(1);
if (failed.length) {
  console.log(`\n失敗 ${failed.length} / ${files.length}（${sec} 秒）: ${failed.join(", ")}`);
  process.exit(1);
}
console.log(`\nすべて成功 ${files.length} 本（${sec} 秒）`);
