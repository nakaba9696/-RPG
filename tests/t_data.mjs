// データの整合（ブラウザなし）：tools/data/check.mjs の検査と、書き出しの書式がエディタと同じであること。
import fs from "node:fs";
import { check, runTest } from "./lib.mjs";
import path from "node:path";
import { checkAll, EDITOR_STATE, withoutEditorState } from "../tools/data/check.mjs";
import { ROOT, DATA_DIR, dataPath, readData, formatMap, formatTable } from "../tools/data/io.mjs";

// 直下の package.json は MZ のエディタが保存のたびに自分の内容で書き戻す。ここに書いてよい欄（MZ が書く欄）
const MZ_PACKAGE_KEYS = ["name", "main", "chromium-args", "window"];

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

  // エディタで保存したときの差分（エディタの状態）では検査が落ちないこと。値を変えた写しで checkAll を走らせる
  const edited = name => {
    const json = readData(name);
    if (name === "System.json") return { ...json, editMapId: 900, versionId: 87748811 };
    if (name === "MapInfos.json") return json.map(e => e && { ...e, scrollX: 451, scrollY: 306.5 });
    return json;
  };
  const editedProblems = checkAll({ readData: edited });
  check(editedProblems.length === 0, "エディタの状態（" + JSON.stringify(EDITOR_STATE) + "）の差分で検査が落ちる:\n  " + editedProblems.join("\n  "));
  for (const name of Object.keys(EDITOR_STATE)) {
    check(JSON.stringify(withoutEditorState(name, edited(name))) === JSON.stringify(withoutEditorState(name, readData(name))),
      `${name}: エディタの状態を除いても差分が残る`);
  }

  // 薄い思念（<hai_faint>）に選択肢を置くと検査が落ちること（Map907 の F01 に選択肢を足した写し）
  const withChoice = name => {
    const json = readData(name);
    if (name !== "Map907.json") return json;
    const ev = json.events.find(e => e && /<hai_faint:F01>/.test(e.note));
    const list = ev.pages[0].list;
    list.splice(list.length - 1, 0, { code: 102, indent: 0, parameters: [["はい", "いいえ"], 1, 0, 2, 0] }, { code: 404, indent: 0, parameters: [] });
    return json;
  };
  const faintProblems = checkAll({ readData: withChoice });
  check(faintProblems.some(p => p.includes("薄い思念") && p.includes("Map907")), "薄い思念の選択肢を検査が見つけない:\n  " + faintProblems.join("\n  "));

  // 直下の package.json は MZ の書いた内容だけ（テストの npm 設定は tests/package.json に置く）
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  const extra = Object.keys(pkg).filter(k => !MZ_PACKAGE_KEYS.includes(k));
  check(extra.length === 0, `直下の package.json に MZ の書かない欄がある（${extra.join("・")}）。MZ のエディタが保存で消すので tests/package.json に置く`);
  check(pkg.main === "index.html" && pkg.window && typeof pkg.window === "object", "直下の package.json が MZ の形（main: index.html、window）でない");
  check(!fs.existsSync(path.join(ROOT, "package-lock.json")), "直下に package-lock.json がある（tests/package-lock.json に置く）");
  console.log("  データの整合と書式・エディタの保存・package.json: 問題なし");
});
