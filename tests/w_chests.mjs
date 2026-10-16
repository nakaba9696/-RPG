// W31（#326）黒い丸の拾い物を宝箱にした直しの検査（ブラウザなし）。製品のマップ（010–899）を見る：
//   持ち主の遊び「変な黒い丸がアイテムなのも意味不明 宝箱にして 初見じゃわからない」
//   1. アイテム・武器・防具・お金を渡すページの絵に、!Other1 の 1 番（黒いトゲの丸）が残っていない
//   2. 宝箱（!Chest の絵で渡すページ）がどれも同じ手触り：
//        閉じた箱（向き 下）・開ける音（Chest1）・向き固定なし（開くと向きの行が変わる絵なので）・
//        渡したあとのセルフスイッチのページが開いた箱（向き 上）
//   直し方は tools/maps/src/w31_parts.mjs。わざと戻したデータで落ちることも確かめる。
import { check, runTest } from "./lib.mjs";
import { readData } from "../tools/data/io.mjs";

const giveCodes = new Set([125, 126, 127, 128]);
const gives = c => giveCodes.has(c.code) && (c.code === 125 ? c.parameters[0] === 0 : c.parameters[1] === 0);
const isSparkle = img => img.characterName === "!Other1" && img.characterIndex === 1;
const isChest = img => img.characterName === "!Chest";

/** 1 枚のマップ：{ sparkles, chests, bad }（当たった所の行） */
function census(id, map) {
  const res = { sparkles: [], chests: [], bad: [] };
  const at = (ev, i) => `${String(id).padStart(3, "0")} ev${ev.id} ${ev.name} (${ev.x},${ev.y}) p${i + 1}`;
  for (const ev of map.events) {
    if (!ev) continue;
    ev.pages.forEach((p, i) => {
      if (!p.list.some(gives)) return;
      if (isSparkle(p.image)) res.sparkles.push(at(ev, i));
      if (!isChest(p.image)) return;
      res.chests.push(at(ev, i));
      const why = [];
      if (p.image.direction !== 2) why.push(`閉じた箱でない（向き ${p.image.direction}）`);
      if (p.directionFix) why.push("向き固定");
      if (!p.list.some(c => c.code === 250 && c.parameters[0].name === "Chest1")) why.push("開ける音（Chest1）が無い");
      const sw = p.list.find(c => c.code === 123 && c.parameters[1] === 0);
      const after = sw && ev.pages.find(q => q.conditions.selfSwitchValid && q.conditions.selfSwitchCh === sw.parameters[0]);
      if (!after) why.push("渡したあとのセルフスイッチのページが無い");
      else {
        if (!isChest(after.image) || after.image.direction !== 8) why.push(`渡したあとのページが開いた箱でない（${after.image.characterName}:${after.image.direction}）`);
        if (after.directionFix) why.push("開いた箱に向き固定");
      }
      if (why.length) res.bad.push(`${at(ev, i)}：${why.join("・")}`);
    });
  }
  return res;
}

function censusAll(maps) {
  const res = { sparkles: [], chests: [], bad: [] };
  for (const [id, map] of maps) {
    const r = census(id, map);
    for (const k of Object.keys(res)) res[k].push(...r[k]);
  }
  return res;
}

await runTest(async () => {
  const ids = readData("MapInfos.json").filter(m => m && m.id >= 10 && m.id < 900).map(m => m.id);
  const maps = new Map(ids.map(id => [id, readData(`Map${String(id).padStart(3, "0")}.json`)]));

  const res = censusAll(maps);
  console.log(`  宝箱で渡すページ：${res.chests.length} 件、黒い丸で渡すページ：${res.sparkles.length} 件、形の違う宝箱：${res.bad.length} 件`);
  check(res.sparkles.length === 0, `アイテムを渡すページの絵に !Other1 の 1 番が ${res.sparkles.length} 件:\n  ${res.sparkles.join("\n  ")}`);
  check(res.bad.length === 0, `今の宝箱と形の違う宝箱が ${res.bad.length} 件:\n  ${res.bad.join("\n  ")}`);
  check(res.chests.length >= 142 + 68, `宝箱で渡すページが ${res.chests.length} 件（W31 の前の 142 件と直した 68 件より少ない）`);

  // 021 の騎士の列の前（持ち主が見た所）が宝箱になっている
  const chapel = maps.get(21);
  const gauntlet = chapel.events.find(e => e && e.name === "拾い物（鐘鳴りの籠手）");
  check(!!gauntlet && isChest(gauntlet.pages[0].image) && gauntlet.x === 28 && gauntlet.y === 37, "021「拾い物（鐘鳴りの籠手）」(28,37) が宝箱でない");

  // わざと戻す：籠手を黒い丸に、別の宝箱に向き固定と拾う音、開いたページの絵を消す
  const back = JSON.parse(JSON.stringify(chapel));
  const named = n => {
    const e = back.events.find(e => e && e.name === n);
    check(!!e, `021 に「${n}」が無い`);
    return e;
  };
  Object.assign(named("拾い物（鐘鳴りの籠手）").pages[0].image, { characterName: "!Other1", characterIndex: 1, pattern: 1 });
  const order = named("拾い物（行軍の命令書）");
  order.pages[0].directionFix = true;
  order.pages[0].list.find(c => c.code === 250).parameters[0].name = "Item1";
  const herb = named("拾い物（解毒草）");
  Object.assign(herb.pages[1].image, { characterName: "", characterIndex: 0 });
  const r = census(21, back);
  check(r.sparkles.some(l => l.includes("鐘鳴りの籠手")), "黒い丸に戻した籠手を数えない");
  check(r.bad.some(l => l.includes("行軍の命令書") && l.includes("向き固定") && l.includes("Chest1")), "向き固定と拾う音に戻した宝箱を数えない");
  check(r.bad.some(l => l.includes("解毒草") && l.includes("開いた箱でない")), "開いた絵を消した宝箱を数えない");
});
