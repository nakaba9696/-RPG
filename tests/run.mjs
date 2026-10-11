// テストの入口。tests/ の <レーン>_<名前>.mjs（例 t_smoke.mjs、p_symbol_enemy.mjs）を名前順に 1 本ずつ別のプロセスで走らせる。
// 1 本でも落ちたら終了コード 1。
//   node tests/run.mjs                 全部
//   node tests/run.mjs t_smoke t_maps  名前（拡張子なし）で選ぶ
//   node tests/run.mjs --shard 2/3     名前順に並べて 3 つに総当たりで配った 2 番目だけ（CI の並列用。--shard=2/3 も可）
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
let shard = null;
const names = [];
for (let k = 0; k < args.length; k++) {
  const a = args[k];
  if (a === "--shard" || a.startsWith("--shard=")) {
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
if (shard && names.length) {
  console.error("--shard と名前の指定は一緒に使えない");
  process.exit(1);
}
const wanted = names.map(a => a.replace(/\.mjs$/, ""));

const all = fs
  .readdirSync(here)
  .filter(f => /^[a-z][a-z0-9]*_[A-Za-z0-9_-]+\.mjs$/.test(f))
  .sort();
let files = wanted.length ? all.filter(f => wanted.includes(f.replace(/\.mjs$/, ""))) : all;
if (shard) {
  // 名前順の k 番目（0 始まり）を k % n + 1 番目のシャードへ。決まった分け方で、全シャードの和が全部になる。
  files = all.filter((_, k) => k % shard.n === shard.i - 1);
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
