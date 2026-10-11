import { Grid, writeMap, list, msg, IF, SE, SW, VAR_ADD, MOVE, TONE, raw, transfer, DOWN } from "./lib.mjs";

export function bossRoom({ base, mapId, name, legend, tilesetId, tone, fields, desc, back, boss, nextMap, decor }) {
  const g = new Grid(27, 19);
  g.rect(13, 2, 14, 3, ".");
  g.set(13, 2, "N").set(14, 2, "N");
  g.rect(6, 4, 20, 14, ".");
  g.set(13, 15, "e");
  decor(g);
  console.log(mapId + "\n" + g.show());
  writeMap(base, g, {
    _説明: desc, mapId, name, displayName: name, legend, tilesetId,
    note: `<hai_tone:${tone}>`, fields,
    chars: {
      N: { name: "北の口（場所移動のマス）", as: "." },
      e: { name: "南の扉（イベント）", as: "." },
    },
    events: [
      transfer(13, 2, `北の口（${back.name}へ）`, [back.map, back.x, back.y, "up"]),
      transfer(14, 2, `北の口（${back.name}へ）`, [back.map, back.x + 1, back.y, "up"]),
      boss,
      raw(13, 15, `南の扉（${nextMap.name}へ）`, [
        { image: { characterName: "!Door1", characterIndex: 2, direction: 2 }, priorityType: 1, walkAnime: false, list: list([msg([nextMap.locked])]) },
        { conditions: { switch1Id: nextMap.sw, switch1Valid: true }, image: { characterName: "!Door1", characterIndex: 2, direction: 8 }, priorityType: 1, trigger: 1, walkAnime: false,
          list: list([SE("Move1"), MOVE(nextMap.map, 8, 4, DOWN)]) },
      ]),
    ],
  });
}

export function orbRoom({ base, mapId, name, legend, tilesetId, tone, desc, back, pedestalTile, orb, decor }) {
  const g = new Grid(17, 13);
  g.set(8, 3, "N");
  g.rect(5, 4, 11, 9, ".");
  g.set(8, 8, "A");
  decor(g);
  console.log(mapId + "\n" + g.show());
  const scenePages = [];
  for (let i = 0; i < orb.scene.length; i += 4) scenePages.push(orb.scene.slice(i, i + 4));
  writeMap(base, g, {
    _説明: desc, mapId, name, displayName: "オーブの間", legend, tilesetId,
    note: `<hai_tone:${tone}>`,
    fields: {},
    chars: {
      N: { name: "北の扉（場所移動のマス）", as: "." },
      A: { name: "台座（イベント。通れない）", as: ".", tiles: [null, null, pedestalTile] },
    },
    events: [
      transfer(8, 3, `北の扉（${back.name}へ）`, [back.map, 13, 14, "up"]),
      raw(8, 8, `オーブ「${orb.name}」の台座`, [
        { priorityType: 1, list: list([
          IF([0, orb.sw, 1], [
            msg([orb.look]),
            SE("Item3"), SW(orb.sw), VAR_ADD(101, 1),
            TONE([-68, -68, -68, 170], 60),
            ...scenePages.map(p => msg(p, { bg: 1, pos: 1 })),
            ...(orb.after || []),
            TONE([0, 0, 0, 0], 60),
            msg([orb.yuel], { name: "\\N[1]" }),
            msg([`オーブ「${orb.name}」を取り戻した。転送陣が光りはじめた。`]),
            IF([1, 101, 0, 4, 1], [SW(105, true, 106), msg(["……全部、思い出した。セレスが門で待っている"], { name: "\\N[1]" })]),
          ], [
            msg(["台座は空だ。"]),
          ]),
        ]) },
      ]),
      raw(10, 6, "帰りの転送陣", [
        { image: { characterName: "!Door2", characterIndex: 7, direction: 2, pattern: 1 }, priorityType: 0, list: list([msg(["床に描かれた転送陣。光っていない。"])]) },
        { conditions: { switch1Id: orb.sw, switch1Valid: true }, image: { characterName: "!Door2", characterIndex: 7, direction: 2, pattern: 1 }, priorityType: 0, trigger: 1, stepAnime: true,
          list: list([SE("Teleport"), MOVE(10, 16, 18, DOWN)]) },
      ]),
      ...(orb.extra || []),
    ],
  });
}
