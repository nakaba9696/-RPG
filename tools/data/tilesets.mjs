// V2：第2段階のタイルセット 15–20 を data/Tilesets.json に書く（11–14 は V1 の tools/maps/src/v1_tilesets.mjs。ここでは触らない）。
//   node tools/data/tilesets.mjs           書く（15–20 だけ。ほかの番号は今のまま残す）
//   node tools/data/tilesets.mjs --check   書かずに、今の Tilesets.json の 15–20 が生成物と同じかだけ見る
//
// 作り方は V1 と同じ：MZ 同梱の画像を組み合わせ、通行（flags）は「その画像を使っている同梱のタイルセット 1–6」から区画ごとに写す。
//   変えたのは 1 つだけ：A4 の壁の上面（kind 80–87・96–103・112–119 のうち「段差」でないもの）を、全部の形で 4 方向とも通れなくする。
//   どれが段差かは img/tilesets/<A4 の画像>.txt の名前（Ledge …）で見る。理由と組み合わせの狙いは docs/look.md 2.4。
// 何度走らせても同じ結果になる。持ち主がエディタで 15–20 を直したら、そちらが正本（--check で差を見てから上書きする）。
import fs from "node:fs";
import path from "node:path";
import { ROOT, dataPath, readData, writeTable, formatTable, extendTable } from "./io.mjs";
import { buildTileset, emptyTileset } from "../maps/src/v1_tilesets.mjs";

const DUNGEON_A = ["Dungeon_A1", "Dungeon_A2", "", "Dungeon_A4", "Dungeon_A5"];
const OUTSIDE_A = ["Outside_A1", "Outside_A2", "Outside_A3", "Outside_A4", "Outside_A5"];

// names は A1・A2・A3・A4・A5・B・C・D・E の順（docs/mz-data.md 2.2）。
export const TILESETS = [
  {
    id: 15,
    name: "V_魚人の湿地",
    names: [...OUTSIDE_A, "Outside_B", "Outside_C", "Dungeon_B", "Dungeon_C"],
    note: "魚人の湿地（Map070–073）。A〜C は外観（毒の沼・水草・枯れ木・ススキ・木の橋）。D＝ダンジョンの石の柱（苔）・折れた柱・橋げた・岩（沈んだ舞台と客席）、E＝装飾柱（廃墟）・カーテン（廃墟）＝舞台の幕・粗末なベッド（杭の上の家）。 <hai_hidden_tiles:D:183,D:26>",
  },
  {
    id: 16,
    name: "V_古書院",
    names: ["Inside_A1", "Dungeon_A2", "", "Inside_A4", "Inside_A5", "Dungeon_B", "Dungeon_C", "Inside_B", "Inside_C"],
    note: "古書院（Map080–084）。A2 はダンジョン（床の苔・ひび割れ＝P2 の手がかりがそのまま使える）、A4・A5 は内装（石・大理石の壁、木の床・石畳（廃墟））。B・C＝ダンジョン（本棚・魔法陣・カーテン（廃墟））、D＝内装の本棚・簡易棚（本）・倒れた棚、E＝巻物・閉じた本・開いた本・ペン・教会机。",
  },
  {
    id: 17,
    name: "V_研究所",
    names: [...DUNGEON_A, "Dungeon_B", "Dungeon_C", "SF_Inside_B", "SF_Inside_C"],
    note: "蘇生師の研究所（Map090–094）。A〜C はダンジョン（壁H 魔界・床H 魔界、魔法陣、装飾柱I 悪魔）。D＝近未来の内装（鉄格子・病院ベッド・資料棚（廃墟）・デスク）、E＝檻・骨格模型・生物標本・機械・配管・操作盤（制御盤）・祭壇。",
  },
  {
    id: 18,
    name: "V_下水道",
    names: [...DUNGEON_A, "Dungeon_B", "Dungeon_C", "Inside_B", "SF_Inside_C"],
    note: "王都の下水道（Map100–104）。A〜C はダンジョン（A1 の水路・滝F（石壁）、壁I（石）、出口からの光）。D＝内装の鉄格子・はしご・木箱・粗末なベッド（下水番の小屋）、E＝配管・パイプ・排水口・瓦礫の山・廃棄物。",
  },
  {
    id: 19,
    name: "V_異端者の廃集落",
    names: [...OUTSIDE_A, "Outside_B", "Outside_C", "Dungeon_B", "Inside_B"],
    note: "異端者の廃集落（Map060–062）。A〜C は外観（屋根F 木造・廃墟、外壁、枯れ木、墓、瓦礫）。D＝ダンジョンの瓦礫・骸骨・樽B（廃墟）・テーブル（廃墟）・石版（廃墟）、E＝内装のベッド（廃墟）・倒れた棚・貼り紙（廃墟）・瓦礫（焼けた家の中）。 <hai_hidden_tiles:D:183,D:26>",
  },
  {
    id: 20,
    name: "V_巨人の崖道",
    names: [...OUTSIDE_A, "Outside_B", "Outside_C", "Dungeon_B", "Inside_C"],
    note: "巨人の崖道（Map050–052）。A〜C は外観（段差・壁A〜C（石）、テント＝帝国の陣跡、岩、石像）。D＝ダンジョンの大きな岩・瓦礫・骸骨・石像・橋げた、E＝内装の槍・槍立て（陣跡の武器）・小箱・開いた本（将校の日誌）。 <hai_hidden_tiles:D:183,D:26>",
  },
];

/** A4 の画像の壁の上面の添字（kind − 80）。上面は 0・2・4 行目（8 個ずつ）で、名前が Ledge（段差）のものは歩ける床なので除く。 */
export function wallTopIndexes(a4Image) {
  const lines = fs
    .readFileSync(path.join(ROOT, "img", "tilesets", a4Image + ".txt"), "utf8")
    .replace(/^﻿/, "")
    .split(/\r?\n/);
  const out = [];
  for (let i = 0; i < 48; i++) {
    if (Math.floor(i / 8) % 2 === 1) continue;
    if (/^Ledge/.test(lines[i] || "")) continue;
    out.push(i);
  }
  return out;
}

export function buildV2(def, shipped) {
  const ts = buildTileset({ ...def, tweaks: [] }, shipped);
  const a4 = ts.tilesetNames[3];
  if (a4) {
    // 壁の上面は全部の形で 4 方向とも通れない（同梱は形によって通れる）。船・飛行船・☆などほかのビットは同梱のまま。
    for (const k of wallTopIndexes(a4)) {
      for (let s = 0; s < 48; s++) {
        const tileId = 2048 + (80 + k) * 48 + s;
        ts.flags[tileId] |= 0x0f;
      }
    }
  }
  return ts;
}

export function buildAll(current) {
  const out = current.slice();
  extendTable(out, Math.max(...TILESETS.map(d => d.id)), emptyTileset);
  for (const def of TILESETS) out[def.id] = buildV2(def, current);
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.join(ROOT, "tools", "data", "tilesets.mjs")) {
  const current = readData("Tilesets.json");
  const next = buildAll(current);
  const same = formatTable(next) === fs.readFileSync(dataPath("Tilesets.json"), "utf8");
  if (process.argv.includes("--check")) {
    console.log(same ? "Tilesets.json の 15–20 は tools/data/tilesets.mjs と同じ" : "Tilesets.json の 15–20 が tools/data/tilesets.mjs と違う");
    process.exit(same ? 0 : 1);
  }
  if (same) {
    console.log("変化なし");
  } else {
    writeTable("Tilesets.json", next);
    console.log(`書いた：${TILESETS.map(d => `${d.id} ${d.name}`).join("、")}`);
  }
}
