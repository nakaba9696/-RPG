// T8：CI の速い道の判定（tools/ci/changes.mjs、ブラウザなし）。文書だけのときだけ light になり、
// data/・js/ などが 1 つでも混ざれば full になること。--no-browser がブラウザを開くテストを選ばないこと。
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { check, runTest, ROOT } from "./lib.mjs";
import { classify } from "../tools/ci/changes.mjs";

await runTest(async () => {
  const light = [
    ["docs/ROADMAP.md"],
    ["VISION.md", "CLAUDE.md", "docs/world.md"],
    ["docs/plugins/Hai_Craft.md", "README.md"],
    ["docs/maps/sketch.txt"],
  ];
  const full = [
    [],
    ["docs/ROADMAP.md", "data/Map010.json"],
    ["docs/world.md", "js/plugins/Hai_Craft.js"],
    ["js/plugins.js"],
    ["tests/README.md"],
    ["tools/maps/README.md"],
    [".github/workflows/ci.yml"],
    [".github/pull_request_template.md"],
    ["img/pictures/x.png", "docs/look.md"],
    ["audio/se/x.ogg"],
    ["package.json"],
    [".gitignore"],
    ["index.html"],
    ["Game.rmmzproject"],
    ["data/README.md"],
  ];
  for (const files of light) check(classify(files) === "light", `文書だけなのに light にならない: ${files.join(", ")}`);
  for (const files of full) check(classify(files) === "full", `full にならない: ${files.join(", ") || "（空）"}`);

  // CLI（CI が呼ぶ形）：標準入力に 1 行 1 つ
  const cli = input =>
    spawnSync(process.execPath, [path.join(ROOT, "tools/ci/changes.mjs")], { input, encoding: "utf8" }).stdout.trim();
  check(cli("docs/ROADMAP.md\nVISION.md\n") === "light", "CLI: 文書だけで light にならない");
  check(cli("docs/ROADMAP.md\ndata/System.json\n") === "full", "CLI: data/ が混ざって full にならない");
  check(cli("") === "full", "CLI: 空で full にならない");

  // --no-browser が選ぶテストは launchGame を呼ばない。ブラウザを開くテストは選ばれない
  const out = spawnSync(process.execPath, [path.join(ROOT, "tests/run.mjs"), "--no-browser", "--plan", "1"], { encoding: "utf8" });
  check(out.status !== 0, "--no-browser と --plan を一緒に使えてしまう");
  // （run.mjs と同じ見分け方。この本文に呼び出しの形を書くとこのテストがブラウザありに数えられるので、文字列を分けて作る）
  const marker = "launch" + "Game(";
  const here = path.join(ROOT, "tests");
  const browserTests = fs.readdirSync(here).filter(f => /^[a-z][a-z0-9]*_.+\.mjs$/.test(f) && fs.readFileSync(path.join(here, f), "utf8").includes(marker));
  check(!browserTests.includes("t_ci_changes.mjs"), "このテストがブラウザありに数えられている");
  check(browserTests.includes("t_smoke.mjs") && browserTests.includes("t_maps.mjs"), "ブラウザのテストの見分けが効いていない");
});
