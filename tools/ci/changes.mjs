// CI で「全部のテスト」か「ブラウザなしのテストだけ」かを、PR で変わったファイルの名前から決める（T8）。
//   node tools/ci/changes.mjs < 変わったファイルの一覧（1 行 1 つ）   → full か light を 1 行出す
// 安全側に倒す：文書（docs/ の下か *.md）だけのときだけ light。下の場所が 1 つでも変わったら、
// 名前が *.md でも full。一覧が空・知らない場所（直下の package.json、.gitignore など）も full。
import fs from "node:fs";
import { fileURLToPath } from "node:url";

// ここが変わったら必ず全部（docs/plugins/*.md のような文書でも、これらの下にあれば全部）
export const FULL_PREFIXES = ["data/", "js/", "tests/", "tools/", ".github/", "img/", "audio/", "css/", "fonts/", "effects/", "icon/"];

export function isDocPath(file) {
  if (FULL_PREFIXES.some(p => file.startsWith(p))) return false;
  return file.startsWith("docs/") || file.endsWith(".md");
}

// files: リポジトリ直下からの相対パスの配列 → "full" | "light"
export function classify(files) {
  const list = files.map(f => f.trim()).filter(Boolean);
  if (list.length === 0) return "full";
  return list.every(isDocPath) ? "light" : "full";
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  const files = fs.readFileSync(0, "utf8").split("\n");
  console.log(classify(files));
}
