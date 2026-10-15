// W28（#302）地図の継ぎ目の検査（ブラウザなし。R3 気になる 6・7・8）：
//   070 霧の湖の舟の杭（舟着き・小島の岸・向こう岸）が「通常」の優先度で、すり抜け（舟から杭の先へ降りられる）。
//     「自分で漕ぐ」は、舟を杭の脇の水に置き、プレイヤーを杭の先へ移して舟の方を向かせてから乗せる
//   180 ソレンヌは、111 で会っていない（1058 OFF）ときに名乗る一行がある。会っていれば「きみか」
//   071 ミルレーネは、砦に来たら（1152 ON）湖の家にいない
// 動かして確かめるのは tests/w_region3.mjs（杭を隣のマスから調べて自分で漕ぐ）。
import { check, runTest } from "./lib.mjs";
import { readData } from "../tools/data/io.mjs";

const MET_SORENNE = 1058, TIMBER = 1055, MIRLENE_FORT = 1152;
const evNamed = (map, name) => {
  const e = map.events.find(e => e && e.name === name);
  if (!e) throw new Error(`「${name}」が無い`);
  return e;
};
const texts = list => list.filter(c => c.code === 401).map(c => c.parameters[0]).join("\n");

await runTest(async () => {
  // ---- 070 の舟の杭
  const lake = readData("Map070.json");
  const docks = ["舟着きの杭（舟を出す）", "小島の岸の杭（舟を出す）", "向こう岸の杭（舟を出す）"].map(n => evNamed(lake, n));
  for (const d of docks) {
    const p = d.pages[0];
    check(p.priorityType === 1 && p.through === true && p.trigger === 0, `${d.name}：通常の優先度・すり抜け・決定で調べる ${JSON.stringify([p.priorityType, p.through, p.trigger])}`);
    // 「自分で漕ぐ」の枝：舟の置き場（202）→ 杭の先へ移す（201）→ 乗る（206）
    const i = p.list.findIndex(c => c.code === 402 && c.parameters[1] === "自分で漕ぐ");
    const j = p.list.findIndex((c, k) => k > i && c.code === 402);
    const branch = p.list.slice(i + 1, j);
    const boat = branch.find(c => c.code === 202), move = branch.find(c => c.code === 201);
    const codes = branch.map(c => c.code);
    check(boat && move && codes.indexOf(202) < codes.indexOf(201) && codes.indexOf(201) < codes.indexOf(206), `${d.name}：自分で漕ぐの並び ${codes.join(",")}`);
    if (!boat || !move) continue;
    const [, , , bx, by] = boat.parameters, [, , mx, my, dir] = move.parameters;
    check(mx === d.x && my === d.y, `${d.name}：杭の先 (${d.x},${d.y}) へ移さない (${mx},${my})`);
    const front = { 2: [0, 1], 4: [-1, 0], 6: [1, 0], 8: [0, -1] }[dir];
    check(front && bx === mx + front[0] && by === my + front[1], `${d.name}：舟 (${bx},${by}) が杭の先の向き ${dir} の前にない`);
  }

  // ---- 180 ソレンヌ：111 で会っていないときの一行
  const slope = readData("Map180.json");
  const sor = evNamed(slope, "ソレンヌ（灰の斜面）").pages[0].list;
  const metAt = sor.findIndex(c => c.code === 111 && c.parameters[0] === 0 && c.parameters[1] === MET_SORENNE);
  check(metAt >= 0, "ソレンヌ：会った印（1058）で分けていない");
  const elseAt = sor.findIndex((c, k) => k > metAt && c.code === 411 && c.indent === sor[metAt].indent);
  const endAt = sor.findIndex((c, k) => k > metAt && c.code === 412 && c.indent === sor[metAt].indent);
  const met = texts(sor.slice(metAt, elseAt)), notMet = texts(sor.slice(elseAt, endAt));
  check(met.includes("きみか。長は先に上った。"), "ソレンヌ：会っているときの「きみか」 " + JSON.stringify(met));
  check(notMet.includes("わたしはソレンヌ") && !notMet.includes("きみか"), "ソレンヌ：会っていないときに名乗らない " + JSON.stringify(notMet));
  const timberAt = sor.findIndex(c => c.code === 111 && c.parameters[1] === TIMBER);
  check(timberAt >= 0 && timberAt < metAt, "ソレンヌ：木を運んだ（1055）の枝を先に見る");

  // ---- 071 ミルレーネ：砦に来たら湖の家にいない
  const house = readData("Map071.json");
  const mir = evNamed(house, "ミルレーネ");
  const gone = mir.pages.find(p => p.conditions.switch1Valid && p.conditions.switch1Id === MIRLENE_FORT);
  check(gone && !gone.image.characterName && !gone.image.tileId && gone.list.length === 1, "071 ミルレーネ：1152 ON のページで消えない");
  check(mir.pages.indexOf(gone) === mir.pages.length - 1, "071 ミルレーネ：1152 のページが最後でない");
  console.log("  070 の杭 3 つ（通常・すり抜け・自分で漕ぐの舟の位置）・180 ソレンヌの二通り・071 ミルレーネが 1152 で消える");
});
