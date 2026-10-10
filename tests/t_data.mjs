// データの整合（ブラウザなし）：tools/data/check.mjs の検査と、書き出しの書式がエディタと同じであること。
import fs from "node:fs";
import { check, runTest } from "./lib.mjs";
import { checkAll } from "../tools/data/check.mjs";
import { DATA_DIR, dataPath, formatMap, formatTable } from "../tools/data/io.mjs";

await runTest(async () => {
  const problems = checkAll();
  check(problems.length === 0, "データの整合:\n  " + problems.join("\n  "));

  // tools/data/io.mjs で読み書きしても、エディタの書いたファイルと 1 バイトも変わらないこと
  for (const file of fs.readdirSync(DATA_DIR).filter(f => f.endsWith(".json"))) {
    const raw = fs.readFileSync(dataPath(file), "utf8");
    const json = JSON.parse(raw);
    const out = /^Map\d{3}\.json$/.test(file) ? formatMap(json) : file === "System.json" ? JSON.stringify(json) : formatTable(json);
    check(out === raw, `data/${file} を読んで書き直すと書式が変わる（tools/data/io.mjs）`);
  }
  console.log("  データの整合と書式: 問題なし");
});
