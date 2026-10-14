// W27（#300）中盤のボスの重さと、敵の技の範囲の検査（ブラウザなし）：
//   敵の行動の表（Enemies の actions）に出る技に、範囲が味方側（scope 7〜11。敵が使うと敵自身の側に当たる）なのに
//   HP のダメージ（damage.type 1・5）か状態の付与（effects の code 21。戦闘不能以外。自分だけ＝scope 11 の構えは除く）を持つものが無い
//   （知恵袋 GAM-45。W27 で 429・431・432・433・1054 の 5 つを直した）
//   172 思いの塊（Troops 703）の数値は変えていない・「塊の表面が裂けた。…」は HP が半分を切ってから一度目と、そのあと 3 ターンおき
//   031 狩人の頭（寄り道の隠しボス）は、挑むかを選ぶ前に強さを知らせる一行がある
import { check, runTest } from "./lib.mjs";
import { readData } from "../tools/data/io.mjs";

await runTest(async () => {
  const skills = readData("Skills.json");
  const enemies = readData("Enemies.json");
  const troops = readData("Troops.json");

  // 敵の技の範囲
  const users = new Map();
  for (const e of enemies) {
    if (!e) continue;
    for (const a of e.actions) {
      if (!users.has(a.skillId)) users.set(a.skillId, []);
      users.get(a.skillId).push(`${e.id} ${e.name}`);
    }
  }
  const wrong = [];
  for (const [id, who] of users) {
    const s = skills[id];
    if (!s || s.scope < 7 || s.scope > 11) continue;
    const hurts = s.damage.type === 1 || s.damage.type === 5;
    // 自分だけ（scope 11）に状態を付けるのは構え（防御・門を閉ざすなど）なので数えない
    const states = s.scope === 11 ? [] : s.effects.filter(ef => ef.code === 21 && ef.dataId !== 0);
    if (hurts || states.length) wrong.push(`${id} ${s.name}（scope ${s.scope}${hurts ? "・ダメージ" : ""}${states.length ? "・状態 " + states.map(ef => ef.dataId).join(",") : ""}。使う敵：${who.join("、")}）`);
  }
  check(wrong.length === 0, "敵が使う技なのに範囲が味方側（敵自身の側に当たる）：\n  " + wrong.join("\n  "));
  console.log(`敵が使う技 ${users.size} 個の範囲：味方側にダメージか状態を当てるものは 0`);

  // 172 思いの塊：数値は変えない（持ち主の決め 2026-10-15）
  const mass = enemies[703];
  check(JSON.stringify(mass.params) === JSON.stringify([9000, 200, 55, 38, 52, 40, 24, 30]), `172 思いの塊の params が変わった ${JSON.stringify(mass.params)}`);

  // 172 の裂け目の一行：ターンの頭ごとに条件の式を回し、出るターンを数える（26 ターンの戦いで、HP 50% を切るのが 9 ターン目）
  const tearPage = troops[703].pages.find(p => p.list.some(c => c.code === 401 && String(c.parameters[0]).includes("表面が裂けた")));
  check(tearPage, "Troops 703 に裂け目の一行のページが無い");
  check(tearPage.span === 1 && tearPage.conditions.enemyValid && tearPage.conditions.enemyHp === 50, "裂け目のページの条件が HP 50% 以下・ターンごとでない");
  const cond = tearPage.list.find(c => c.code === 111 && c.parameters[0] === 12);
  const setter = tearPage.list.find(c => c.code === 355);
  check(cond && setter, "裂け目のページに、出したターンを覚える式が無い");
  const enemy = { isAlive: () => true };
  let turn = 0;
  const $gameTroop = { members: () => [enemy], turnCount: () => turn };
  const shown = [];
  const run = js => new Function("$gameTroop", `return (${js});`)($gameTroop);
  const exec = js => new Function("$gameTroop", js)($gameTroop);
  for (turn = 8; turn < 26; turn++) {
    if (run(cond.parameters[1])) { exec(setter.parameters[0]); shown.push(turn + 1); }
  }
  check(shown.length > 0 && shown[0] === 9, `裂け目の一行の一度目が HP 50% を切ったターンでない ${shown}`);
  check(shown.every((t, i) => i === 0 || t - shown[i - 1] === 3), `裂け目の一行が 3 ターンおきでない ${shown}`);
  console.log(`172 の裂け目の一行：9〜26 ターン目で ${shown.length} 回（${shown.join("・")} ターン目）`);

  // 031 狩人の頭：選択肢の前に強さを知らせる一行
  const map31 = readData("Map031.json");
  const head = map31.events.find(ev => ev && ev.name === "狩人の頭");
  check(head, "031 に狩人の頭のイベントが無い");
  const list = head.pages[0].list;
  const choiceAt = list.findIndex(c => c.code === 102);
  const before = list.slice(0, choiceAt).filter(c => c.code === 401).map(c => c.parameters[0]);
  check(before.some(t => t.includes("一太刀")), "031 狩人の頭：挑むかを選ぶ前に強さを知らせる一行が無い");
});
