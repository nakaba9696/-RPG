// テストの入口。tests/ の <レーン>_<名前>.mjs（例 t_smoke.mjs、p_symbol_enemy.mjs）を名前順に 1 本ずつ別のプロセスで走らせる。
// 1 本でも落ちたら終了コード 1。
//   node tests/run.mjs                 全部
//   node tests/run.mjs t_smoke t_maps  名前（拡張子なし）で選ぶ
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const wanted = process.argv.slice(2).map(a => a.replace(/\.mjs$/, ""));

const all = fs
  .readdirSync(here)
  .filter(f => /^[a-z][a-z0-9]*_[A-Za-z0-9_-]+\.mjs$/.test(f))
  .sort();
const files = wanted.length ? all.filter(f => wanted.includes(f.replace(/\.mjs$/, ""))) : all;

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
