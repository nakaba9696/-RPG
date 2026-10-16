// W29（#314。持ち主の遊び 2026-10-16）砦（010–019）の検査。ブラウザなし：
//   1. 見えない壁が 0 件：歩ける床の上に、絵が無く・優先度「通常」・すり抜けでなく・調べると文が出るページを置かない
//      （docs/reviews/2026-10-16-owner.md の見方。床は、イベントを除いたタイルの通行で、隣のマスから入れるマス）
//   2. まだ開いていない部屋の戸（010 の 7 つ・019 の見張り台）：1 ページ目は戸の前で一行だけ（場所移動なし）。
//      場所移動は、出現条件がその部屋のスイッチ（Hai_Facilities の 121–127）のページにだけある
//   3. 目覚めの前の導入：黒い画面のうち（フェードインの前）に、話し手なしで 5〜8 行（docs/world.md 3.4 の頭）
import { check, runTest } from "./lib.mjs";
import { readData } from "../tools/data/io.mjs";
import { makeMapModel, DIRS } from "../tools/data/reach.mjs";

const DX = { 2: 0, 4: -1, 6: 1, 8: 0 };
const DY = { 2: 1, 4: 0, 6: 0, 8: -1 };
const ROOM_SWITCH = { 11: 121, 12: 122, 13: 123, 14: 124, 16: 125, 17: 126, 18: 127 };

await runTest(async () => {
  const tilesets = readData("Tilesets.json");
  const maps = {};
  for (let id = 10; id <= 19; id++) maps[id] = readData(`Map${String(id).padStart(3, "0")}.json`);

  // ---- 1. 見えない壁
  const walls = [];
  for (const [id, map] of Object.entries(maps)) {
    const model = makeMapModel({ ...map, events: [] }, tilesets[map.tilesetId]);
    for (const e of map.events) {
      if (!e) continue;
      const floor = DIRS.some(d => model.canMove(e.x - DX[d], e.y - DY[d], d));
      e.pages.forEach((p, i) => {
        const noImage = !p.image.characterName && !p.image.tileId;
        const text = p.list.some(c => c.code === 401);
        if (floor && noImage && text && p.priorityType === 1 && !p.through) walls.push(`${id} ev${e.id} ${e.name} (${e.x},${e.y}) p${i + 1}`);
      });
    }
  }
  check(walls.length === 0, `見えない壁（絵を置くか、床の物なら優先度を「下」に）:\n${walls.join("\n")}`);

  // ---- 2. まだ開いていない部屋の戸
  let doors = 0;
  for (const id of [10, 19]) {
    for (const e of maps[id].events) {
      if (!e) continue;
      const to = e.pages.map(p => p.list.find(c => c.code === 201 && ROOM_SWITCH[c.parameters[1]]));
      if (!to.some(Boolean)) continue;
      doors++;
      const room = to.find(Boolean).parameters[1];
      const where = `Map0${id} ${e.name} (${e.x},${e.y})`;
      check(!to[0] && e.pages[0].list.filter(c => c.code === 401).length >= 1, `${where}：1 ページ目に戸の前の一行が無いか、そのまま入れる`);
      check(!e.pages[0].list.some(c => c.code === 357), `${where}：1 ページ目が共通の文（Hai_Facilities の door）のまま`);
      e.pages.forEach((p, i) => {
        if (!to[i]) return;
        check(p.conditions.switch1Valid && p.conditions.switch1Id === ROOM_SWITCH[room], `${where} p${i + 1}：部屋 ${room} の場所移動の条件がスイッチ ${ROOM_SWITCH[room]} でない`);
      });
    }
  }
  check(doors === 8, `部屋の戸の数 ${doors}（010 の 7 つと 019 の見張り台）`);

  // ---- 3. 導入
  const opening = maps[10].events.find(e => e && e.name === "目覚めの場面").pages[0].list;
  const fadeIn = opening.findIndex(c => c.code === 222);
  const before = opening.slice(0, fadeIn);
  check(before[0].code === 221 && fadeIn > 0, "目覚めの場面が黒い画面から始まらない");
  const lines = before.filter(c => c.code === 401).map(c => c.parameters[0]);
  check(lines.length >= 5 && lines.length <= 8, `導入の行の数 ${lines.length}`);
  check(before.filter(c => c.code === 101).every(c => c.parameters[4] === "" && c.parameters[2] === 2), "導入に話し手か窓が付いている");
  check(lines.every(l => l.length <= 26), `導入の一行が長い ${JSON.stringify(lines)}`);
});
