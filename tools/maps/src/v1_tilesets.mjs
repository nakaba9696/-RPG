// V1：タイルセット 11–14 を data/Tilesets.json に書く（V4 で名前と用途を新しい世界「最後の鐘」の地域に読み替えた。画像と通行は V1 のまま）。
//   node tools/maps/src/v1_tilesets.mjs           書く（11–30 の自分の分だけ。ほかの番号は触らない）
//   node tools/maps/src/v1_tilesets.mjs --check   書かずに、今の Tilesets.json と同じかだけ見る
//
// 作り方：MZ 同梱の画像を組み合わせ、通行（flags）は「その画像を使っている同梱のタイルセット 1–6」から区画ごとに写す。
//   ☆・茂み・梯子・カウンター・地形タグは、同梱の設定がそのまま入る（エディタで画像を選んだときと同じ状態を、手で選び直さずに作る）。
//   変えたのは下の `tweaks` だけ（理由は docs/look.md 2.3）。
// 持ち主がエディタでタイルセットを直したら、そちらが正本（このスクリプトで上書きしない。上書きするときは --check で差を見てから）。
import { readData, writeTable, formatTable, extendTable } from "../../data/io.mjs";
import fs from "node:fs";
import { dataPath } from "../../data/io.mjs";

// tilesetNames の添字 → flags の区画（先頭のタイル ID と個数）。docs/mz-data.md 2.2。
const SLOT_RANGE = [
  [2048, 768], // 0 A1
  [2816, 1536], // 1 A2
  [4352, 1536], // 2 A3
  [5888, 2304], // 3 A4
  [1536, 128], // 4 A5
  [0, 256], // 5 B
  [256, 256], // 6 C
  [512, 256], // 7 D
  [768, 256], // 8 E
];
// 画像が無い区画の値（同梱のタイルセットの空きの区画と同じ）
const EMPTY_A = 0xe0f;
const EMPTY_BE = 0x600;
const EMPTY_OTHER = 0x600; // 1024–1535、1664–2047（どの区画でもない番号）

const DUNGEON = ["Dungeon_A1", "Dungeon_A2", "", "Dungeon_A4", "Dungeon_A5", "Dungeon_B", "Dungeon_C"];
const OUTSIDE = ["Outside_A1", "Outside_A2", "Outside_A3", "Outside_A4", "Outside_A5", "Outside_B", "Outside_C"];

// Dungeon_A4 の壁の上面のうち、歩かせない種類（壁 A〜H・I〜P・Q〜T）。段差 A〜D（kind 番号 36–39）は歩ける床なので除く。
const DUNGEON_WALL_TOPS = [0, 1, 2, 3, 4, 5, 6, 7, 16, 17, 18, 19, 20, 21, 22, 23, 32, 33, 34, 35];

export const TILESETS = [
  {
    id: 11,
    name: "V_黒鉄の砦",
    names: [...DUNGEON, "Inside_B", "Inside_C"],
    note: "拠点 黒鉄の砦の内郭と部屋（Map010–014・016・017）。A〜C はダンジョン（凡例 dungeon がそのまま使える。壁は壁O（砦）A4:22/30）。D＝内装の家具（寝台・暖炉＝炉・食卓・本棚・かまど）、E＝内装の小物（鎧のスタンド・金床＝鍛冶場・開いた本・水桶）。",
    tweaks: ["wallTopsBlocked"],
  },
  {
    id: 12,
    name: "V_霧の森",
    names: [...OUTSIDE, "Dungeon_B", "Dungeon_C"],
    note: "霧の森と古い礼拝堂（Map020–024）。A〜C は外観（木・枯れ木・墓・坑道入口）。D＝ダンジョンの石像（鐘を抱く女の像は D の女神像）・折れた柱・骸骨（鐘の騎士の亡骸）、E＝棺・魔法陣・装飾柱（廃墟）。霧は <hai_fog>。 <hai_hidden_tiles:D:183,D:26>",
    tweaks: [],
  },
  {
    id: 13,
    name: "V_鉄の坑道",
    names: [...DUNGEON, "Outside_C", "Inside_B"],
    note: "鉄の坑道（Map026–032）と骨拾いの洞（Map053）。A〜C はダンジョン（線路・壁の補強材・つるはし。床は土 A2:0、壁は壁A（土洞窟）A4:0/8）。D＝坑道入口・瓦礫・骸骨（狩人の成れの果て）、E＝むしろの寝床・粗末なベッド・樽（坑夫の詰め所）・暖炉（使徒狩りの鍛冶場の跡）。",
    tweaks: ["wallTopsBlocked"],
  },
  {
    id: 14,
    name: "V_砦の営倉",
    names: [...DUNGEON, "Inside_B", "Inside_C"],
    note: "砦の営倉（Map033–037）、納骨所（Map022）、村の祠と荷運びの抜け道（Map063–064）。A〜C はダンジョン（鉄格子・骸骨、壁は壁I（石）A4:16/24）。D＝粗末なベッド・鉄格子・肖像画、E＝鞭・斧・水桶・開いた本（牢番の帳面）・鎧のスタンド。",
    tweaks: ["wallTopsBlocked"],
  },
];

/** 画像名 → それを使っている同梱のタイルセット（1–6）と添字。 */
function findSource(shipped, image) {
  for (let id = 1; id <= 10; id++) {
    const ts = shipped[id];
    if (!ts || !ts.name) continue;
    const slot = ts.tilesetNames.indexOf(image);
    if (slot >= 0) return { ts, slot };
  }
  throw new Error(`同梱のタイルセットに ${image} を使うものがない`);
}

/** 空のタイルセット（帯の先頭まで伸ばすときの埋め草）。 */
export function emptyTileset(id) {
  const flags = new Array(8192).fill(EMPTY_OTHER);
  flags[0] = 0x10;
  return { id, flags, mode: 1, name: "", note: "", tilesetNames: ["", "", "", "", "", "", "", "", ""] };
}

export function buildTileset(def, shipped) {
  const names = [...def.names];
  while (names.length < 9) names.push("");
  const flags = new Array(8192).fill(EMPTY_OTHER);
  names.forEach((image, slot) => {
    const [start, count] = SLOT_RANGE[slot];
    if (!image) {
      flags.fill(slot <= 4 ? EMPTY_A : EMPTY_BE, start, start + count);
      return;
    }
    const src = findSource(shipped, image);
    const [srcStart] = SLOT_RANGE[src.slot];
    for (let i = 0; i < count; i++) flags[start + i] = src.ts.flags[srcStart + i];
  });
  if (def.tweaks.includes("wallTopsBlocked")) {
    // 壁の上面は全部の形で 4 方向とも通れない（同梱は真ん中の形だけ通れる）。船・飛行船のビットは同梱のまま。
    for (const k of DUNGEON_WALL_TOPS) {
      const kind = 80 + k;
      for (let s = 0; s < 48; s++) {
        const tileId = 2048 + kind * 48 + s;
        flags[tileId] = (flags[tileId] & ~0x0f) | 0x0f;
      }
    }
  }
  return { id: def.id, flags, mode: 1, name: def.name, note: def.note, tilesetNames: names };
}

export function buildAll(current) {
  const out = current.slice();
  const last = Math.max(...TILESETS.map(d => d.id));
  extendTable(out, last, emptyTileset);
  for (const def of TILESETS) out[def.id] = buildTileset(def, current);
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const current = readData("Tilesets.json");
  const next = buildAll(current);
  const same = formatTable(next) === fs.readFileSync(dataPath("Tilesets.json"), "utf8");
  if (process.argv.includes("--check")) {
    console.log(same ? "Tilesets.json は v1_tilesets.mjs と同じ" : "Tilesets.json が v1_tilesets.mjs と違う");
    process.exit(same ? 0 : 1);
  }
  if (same) {
    console.log("変化なし");
  } else {
    writeTable("Tilesets.json", next);
    console.log(`書いた：${TILESETS.map(d => `${d.id} ${d.name}`).join("、")}`);
  }
}
