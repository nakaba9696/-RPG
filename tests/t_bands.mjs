// T12（#172）の帯と道具の検査（ブラウザなし）：
//   tools/data/bands.json の W の帯が 1001–1500 まで広がっている（スイッチ・データベース・コモンイベント）・波7 以降の issue の帯がある
//   System.json の switches・variables が 1500 番まである・tools/data/extend-system.mjs が伸ばすだけで縮めない・短いと検査が落ちる
//   tests/playtime.mjs の換算が world.md 5.7 のとおり（1 歩 0.25 秒・戦闘 1 分・ボス 8 分・思念 20 秒）
import { check, runTest } from "./lib.mjs";
import { checkAll, readBands } from "../tools/data/check.mjs";
import { readData } from "../tools/data/io.mjs";
import { extendSystemNames, W_BAND_MAX } from "../tools/data/extend-system.mjs";
import { estimatePlaytime, formatPlaytime, RATE } from "./playtime.mjs";

const inRanges = (id, ranges) => ranges.some(([a, b]) => a <= id && id <= b);

await runTest(async () => {
  const bands = readBands();
  const W = bands.lanes.W;
  for (const kind of ["switches", "database", "commonEvents"]) {
    check(inRanges(1001, W[kind]) && inRanges(1500, W[kind]), `bands.json: W の ${kind} が 1001–1500 を含まない ${JSON.stringify(W[kind])}`);
    for (const [lane, l] of Object.entries(bands.lanes)) {
      if (lane !== "W") check(!inRanges(1001, l[kind] || []) && !inRanges(1500, l[kind] || []), `bands.json: ${lane} の ${kind} が W の 1001–1500 と重なる`);
    }
  }
  check(inRanges(110, W.maps) && inRanges(199, W.maps), "bands.json: W のマップの帯が 110–199 を含まない");
  const want = { P13: [1001, 1050], W12: [1051, 1100], W13: [1101, 1150], W14: [1151, 1200] };
  for (const [issue, [a, b]] of Object.entries(want)) {
    const band = bands.issues[issue];
    check(band, `bands.json: 割り当て表に ${issue} が無い`);
    for (const kind of ["database", "commonEvents"]) check(inRanges(a, band[kind]) && inRanges(b, band[kind]), `bands.json: ${issue} の ${kind} が ${a}–${b} でない`);
    if (issue !== "P13") check(inRanges(a, band.switches) && inRanges(b, band.switches), `bands.json: ${issue} のスイッチが ${a}–${b} でない`);
  }
  check(inRanges(961, bands.issues.T12.commonEvents) && inRanges(970, bands.issues.T12.commonEvents), "bands.json: T12 のコモンイベント 961–970");

  const system = readData("System.json");
  for (const key of ["switches", "variables"]) check(system[key].length === W_BAND_MAX + 1, `System.json: ${key} が ${W_BAND_MAX} 番までない（${system[key].length - 1}）`);

  // extend-system：伸ばすだけ、名前は変えない、縮めない
  const copy = { switches: ["", "a", "b"], variables: ["", "x"] };
  const added = extendSystemNames(copy, 5);
  check(copy.switches.join() === ",a,b,,," && copy.variables.length === 6 && added.switches === 3 && added.variables === 4, "extendSystemNames の伸ばし方 " + JSON.stringify(copy));
  extendSystemNames(copy, 2);
  check(copy.switches.length === 6, "extendSystemNames が縮めた");

  // エディタの最大数のまま保存して切り詰められたら、検査が落ちる
  const short = name => {
    const json = readData(name);
    return name === "System.json" ? { ...json, switches: json.switches.slice(0, 701), variables: json.variables.slice(0, 701) } : json;
  };
  const problems = checkAll({ readData: short });
  check(problems.some(p => p.includes("System.json: switches が 700 番まで")), "System.json が短いのに検査が落ちない:\n  " + problems.join("\n  "));

  // 換算（world.md 5.7）
  check(RATE.step === 0.25 && RATE.battle === 60 && RATE.boss === 480 && RATE.thought === 20, "換算の値が world.md 5.7 と違う " + JSON.stringify(RATE));
  const e = estimatePlaytime({ steps: 1200, battles: 7, bosses: 1, thoughts: 9 });
  check(e.seconds === 1200 * 0.25 + 6 * 60 + 480 + 9 * 20 && e.battles === 6, "目安の秒 " + JSON.stringify(e));
  check(formatPlaytime(e) === "歩数 1200（5 分）・戦闘 6（6 分）・ボス 1（8 分）・思念 9（3 分）→ 約 22 分", "目安の文 " + formatPlaytime(e));
  check(estimatePlaytime({}).seconds === 0, "数が無いときの目安が 0 でない");
  console.log("  W の帯 1001–1500・System.json 1500 番まで・換算: 問題なし");
});
