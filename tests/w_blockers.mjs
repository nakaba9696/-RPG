// W30（#315）持ち主の遊びの直しの検査（ブラウザなし。docs/reviews/2026-10-16-owner.md の 5・6・7）。製品のマップ（010–899）を見る。
//   1. 見えない壁（指摘 6「なにもないのに通れない場所が多い」）：次の全部に当たるイベントのページ
//        画像なし（タイルもキャラの絵も無い）× 優先度「通常」× すり抜けでない × 決定で始まる × 文が出る（101）
//        × そのマスのタイルが通れる（タイルセットの通行で、どこかの向きへ動ける床）
//   2. 話すと姿が変わる人（指摘 5）：向きの行ごとに絵の違う素材（Damage1–3・!Flame）で、向き固定なし・決定か接触で始まるページ。
//      話しかけると振り向いて、素材の別の行（別の人・別の火）の絵になる
//   3. 道端の階段（指摘 7）：外のタイルセット（上層の 1 枚目が Outside_B）の上層に、屋内の上り階段の絵（Outside_B の 1・2・9・10）
//   020 以降は 0。010–019（W29 #314）の分は、W29 が入るまで今の件数を上限にする（W29 が入ったら 0 にする）。
//   直し方は tools/maps/src/w30_parts.mjs。わざと戻したデータで落ちることも確かめる。
import { check, runTest } from "./lib.mjs";
import { readData } from "../tools/data/io.mjs";
import { makeMapModel } from "../tools/data/reach.mjs";

/** W29 が直すまでの 010–019 の件数の上限（W30 の時点の件数）。W29 が入ったら 0 にする。 */
const W29_LIMIT = { walls: 8, turns: 10, stairs: 0 };

const isTextPage = p => p.list.some(c => c.code === 101);
const noImage = p => !(p.image.tileId > 0) && !p.image.characterName;
const isInvisibleWall = p => noImage(p) && p.priorityType === 1 && !p.through && p.trigger === 0 && isTextPage(p);
/** 向きの行ごとに絵の違う素材（tools/maps/src/w30_parts.mjs の TURN_SHEETS と同じ） */
const TURN_SHEETS = /^(Damage\d|SF_Damage\d|!Flame)$/;
const turnsToOther = p => TURN_SHEETS.test(p.image.characterName) && !p.directionFix && p.trigger <= 2;
/** Outside_B の屋内の上り階段（建物の 1F・2F をつなぐ絵） */
const INDOOR_STAIRS = new Set([1, 2, 9, 10]);

/** 1 枚のマップの見えない壁：[{ id, name, x, y, page }]（イベントごとに最初に当たったページ） */
function invisibleWalls(map, tilesets) {
  // タイルだけの通行（イベントを除いた地図で見る）
  const model = makeMapModel({ ...map, events: [] }, tilesets[map.tilesetId]);
  const out = [];
  for (const ev of map.events) {
    if (!ev) continue;
    const i = ev.pages.findIndex(isInvisibleWall);
    if (i < 0 || !model.isValid(ev.x, ev.y)) continue;
    if (![2, 4, 6, 8].some(d => model.isPassable(ev.x, ev.y, d))) continue;
    out.push({ id: ev.id, name: ev.name, x: ev.x, y: ev.y, page: i + 1 });
  }
  return out;
}

function turningPages(map) {
  const out = [];
  for (const ev of map.events) {
    if (!ev) continue;
    ev.pages.forEach((p, i) => { if (turnsToOther(p)) out.push({ id: ev.id, name: ev.name, x: ev.x, y: ev.y, page: i + 1, sheet: p.image.characterName }); });
  }
  return out;
}

function outdoorStairs(map, tilesets) {
  if (tilesets[map.tilesetId].tilesetNames[5] !== "Outside_B") return [];
  const { width: W, height: H, data } = map;
  const out = [];
  for (const z of [2, 3]) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (INDOOR_STAIRS.has(data[(z * H + y) * W + x])) out.push({ x, y, z });
  }
  return out;
}

const pad = n => String(n).padStart(3, "0");

/** 全部の製品マップを数える：{ walls, turns, stairs }（それぞれ { fort: 010–019 の件数, later: 020 以降の行 }） */
function census(maps, tilesets) {
  const res = { walls: { fort: 0, later: [] }, turns: { fort: 0, later: [] }, stairs: { fort: 0, later: [] } };
  for (const [id, map] of maps) {
    const add = (kind, list, fmt) => {
      for (const w of list) {
        if (id < 20) res[kind].fort++;
        else res[kind].later.push(`${pad(id)} ${fmt(w)}`);
      }
    };
    add("walls", invisibleWalls(map, tilesets), w => `ev${w.id} ${w.name} (${w.x},${w.y}) p${w.page}`);
    add("turns", turningPages(map), w => `ev${w.id} ${w.name} (${w.x},${w.y}) p${w.page} ${w.sheet}`);
    add("stairs", outdoorStairs(map, tilesets), w => `(${w.x},${w.y}) z${w.z}`);
  }
  return res;
}

await runTest(async () => {
  const tilesets = readData("Tilesets.json");
  const ids = readData("MapInfos.json").filter(m => m && m.id >= 10 && m.id < 900).map(m => m.id);
  const maps = new Map(ids.map(id => [id, readData(`Map${pad(id)}.json`)]));
  const label = { walls: "見えない壁", turns: "話すと姿が変わるページ", stairs: "外の屋内の階段の絵" };

  const res = census(maps, tilesets);
  for (const kind of Object.keys(label)) {
    const { fort, later } = res[kind];
    console.log(`  ${label[kind]}：010–019 ${fort} 件（上限 ${W29_LIMIT[kind]}）、020 以降 ${later.length} 件`);
    check(later.length === 0, `020 以降に${label[kind]}が ${later.length} 件:\n  ${later.join("\n  ")}`);
    check(fort <= W29_LIMIT[kind], `010–019 の${label[kind]}が ${fort} 件（上限 ${W29_LIMIT[kind]}）`);
  }

  // わざと戻す：020 の「倒れた荷車」を画像なしに、「鎧の亡骸」の向き固定を外し、坂の石段を屋内の階段の絵に
  const forest = JSON.parse(JSON.stringify(maps.get(20)));
  const named = n => {
    const e = forest.events.find(e => e && e.name === n);
    check(!!e, `020 に「${n}」が無い`);
    return e;
  };
  Object.assign(named("倒れた荷車").pages[0].image, { tileId: 0, characterName: "" });
  named("鎧の亡骸").pages[0].directionFix = false;
  forest.data[(2 * forest.height + 17) * forest.width + 12] = 1;
  const back = census(new Map([[20, forest]]), tilesets);
  check(back.walls.later.some(l => l.includes("倒れた荷車")), "画像なしに戻した「倒れた荷車」を見えない壁として数えない");
  check(back.turns.later.some(l => l.includes("鎧の亡骸")), "向き固定を外した「鎧の亡骸」を数えない");
  check(back.stairs.later.some(l => l.includes("(12,17)")), "(12,17) に戻した屋内の階段の絵を数えない");
});
