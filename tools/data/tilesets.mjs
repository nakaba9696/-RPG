// V2・V4・V5：タイルセット 15–25 を data/Tilesets.json に書く（11–14 は V1 の tools/maps/src/v1_tilesets.mjs。ここでは触らない）。
//   15–20 は V2 で作り、V4 で名前と用途を新しい世界「最後の鐘」の地域に読み替えた（画像と通行は V2 のまま）。21–23 は V4、24・25 は V5 で足した。
//   node tools/data/tilesets.mjs           書く（15–25 だけ。ほかの番号は今のまま残す）
//   node tools/data/tilesets.mjs --check   書かずに、今の Tilesets.json の 15–25 が生成物と同じかだけ見る
//
// 作り方は V1 と同じ：MZ 同梱の画像を組み合わせ、通行（flags）は「その画像を使っている同梱のタイルセット 1–6」から区画ごとに写す。
//   変えたのは 1 つだけ：A4 の壁の上面（kind 80–87・96–103・112–119 のうち「段差」でないもの）を、全部の形で 4 方向とも通れなくする。
//   どれが段差かは img/tilesets/<A4 の画像>.txt の名前（Ledge …）で見る。理由と組み合わせの狙いは docs/look.md 2 章。
// 何度走らせても同じ結果になる。持ち主がエディタで 15–25 を直したら、そちらが正本（--check で差を見てから上書きする）。
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
    name: "V_霧の湖",
    names: [...OUTSIDE_A, "Outside_B", "Outside_C", "Dungeon_B", "Dungeon_C"],
    note: "霧の湖（Map070–074）。A〜C は外観（水・水草・枯れ木・ススキ＝葦・木の橋＝桟橋、建物E（土壁）＝湖の家）。D＝ダンジョンの石の柱（苔）・折れた柱・橋げた（沈んだ桟橋）・岩、E＝装飾柱（廃墟）・カーテン（廃墟）・粗末なベッド（湖の家の中）。舟は乗り物（小型船）。霧は <hai_fog>。 <hai_hidden_tiles:D:183,D:26>",
  },
  {
    id: 16,
    name: "V_記録院",
    names: ["Inside_A1", "Dungeon_A2", "", "Inside_A4", "Inside_A5", "Dungeon_B", "Dungeon_C", "Inside_B", "Inside_C"],
    note: "記録院（Map080–084）。A2 はダンジョン（床の苔・ひび割れ＝P2 の手がかりがそのまま使える）、A4・A5 は内装（石・大理石の壁、木の床・石畳（廃墟））。B・C＝ダンジョン（本棚・魔法陣・カーテン（廃墟））、D＝内装の本棚・簡易棚（本）・倒れた棚、E＝巻物・閉じた本・開いた本・ペン・教会机。",
  },
  {
    id: 17,
    name: "V_帝国の研究所",
    names: [...DUNGEON_A, "Dungeon_B", "Dungeon_C", "SF_Inside_B", "SF_Inside_C"],
    note: "帝国の研究所（古い鋳物場の奥。Map091 の檻・093 研究所の奥）。鋳物場の側は 23。A〜C はダンジョン（壁H 魔界・床H 魔界、魔法陣、装飾柱I 悪魔）。D＝近未来の内装（鉄格子・病院ベッド・資料棚（廃墟）・デスク）、E＝檻・骨格模型・生物標本・機械・配管・操作盤（制御盤）・祭壇。",
  },
  {
    id: 18,
    name: "V_地下水道",
    names: [...DUNGEON_A, "Dungeon_B", "Dungeon_C", "Inside_B", "SF_Inside_C"],
    note: "砦の下の地下水道（Map100・101・103・104）。地下都市の扉の前と井戸の縦穴は 22。A〜C はダンジョン（A1 の水路・滝F（石壁）、壁I（石）、出口からの光）。D＝内装の鉄格子・はしご・木箱・粗末なベッド（水門番の小屋）、E＝配管・パイプ・排水口・瓦礫の山・廃棄物。",
  },
  {
    id: 19,
    name: "V_焼けた村",
    names: [...OUTSIDE_A, "Outside_B", "Outside_C", "Dungeon_B", "Inside_B"],
    note: "焼けた村（Map060–062。祠と抜け道は 14）。A〜C は外観（屋根F 木造・廃墟、外壁、枯れ木、墓、瓦礫）。D＝ダンジョンの瓦礫・骸骨・樽B（廃墟）・テーブル（廃墟）・石版（廃墟）、E＝内装のベッド（廃墟）・倒れた棚・貼り紙（廃墟）・瓦礫（焼けた家の中）。 <hai_hidden_tiles:D:183,D:26>",
  },
  {
    id: 20,
    name: "V_境山の古道",
    names: [...OUTSIDE_A, "Outside_B", "Outside_C", "Dungeon_B", "Inside_C"],
    note: "境山の古道（Map050–052・054）。A〜C は外観（段差・壁A〜C（石）＝尾根の崖、テント＝帝国の陣跡、岩、石像）。D＝ダンジョンの大きな岩・瓦礫・骸骨（名無し兵）・石像・橋げた（吊り橋）、E＝内装の槍・槍立て（陣跡の武器）・小箱・開いた本（兵の手紙）。 <hai_hidden_tiles:D:183,D:26>",
  },
  // --- V4 で足した ---
  {
    id: 21,
    name: "V_城壁と頂の鐘楼",
    names: [...OUTSIDE_A, "Outside_B", "Outside_C", "Dungeon_B", "Inside_C"],
    note: "砦の城壁の上（Map019）・見張り台（018）・山の頂の鐘楼（015）。A〜C は外観（A4 の建物C（砦）＝城壁と鐘楼の石組み、壁D（石）、段差、A3 の屋根K（石））。D＝ダンジョンの石像・壊れた像・瓦礫・骸骨・大きな土砂（崩れた城壁）、E＝内装の鎧のスタンド（鎧の亡骸）・石像・槍立て・開いた本（彫り直しの足場の帳面）。親鐘の絵は同梱に無い（docs/look.md 5 章）。灰は <hai_ash>。 <hai_hidden_tiles:D:183,D:26>",
  },
  {
    id: 22,
    name: "V_地下都市",
    names: ["Dungeon_A1", "Dungeon_A2", "Outside_A3", "Dungeon_A4", "Dungeon_A5", "Dungeon_B", "Dungeon_C", "Inside_B", "Outside_B"],
    note: "地下都市の閉じた扉の前（Map102）と井戸の縦穴（105）、扉の内側の村。A1・A2・A4・A5・B・C はダンジョン（凡例 dungeon がそのまま使える）。A3＝外観の屋根と外壁（岩を掘った家並み）。D＝内装の家具・鉄格子・はしご・暖炉、E＝外観の井戸・樽・木箱・街灯（地下の灯）・石のかまど。",
  },
  {
    id: 23,
    name: "V_古い鋳物場",
    names: [...DUNGEON_A, "Dungeon_B", "Dungeon_C", "Inside_B", "Inside_C"],
    note: "古い鋳物場（Map090・091 の型の間・092・094）。A〜C はダンジョン（壁O（砦）A4:22/30・壁J（レンガ）A4:17/25、濃い床C（岩洞窟）A2:10＝炉の前の煤けた床、線路）。D＝内装の暖炉C（鉄）・大きな暖炉＝炉・かまど・鉄格子・はしご、E＝内装の金床・鎧のスタンド（型から出した鎧）・石像（鐘の型の代わり）・樽。研究所の側は 17。",
  },
  // --- V5 で足した ---
  {
    id: 24,
    name: "V_麦の街道と関所",
    names: [...OUTSIDE_A, "Outside_B", "Outside_C", "Inside_B", "Inside_C"],
    note: "麦の街道と関所（Map110・111・115・116）。A〜C は外観（畑A＝麦畑、道（草地）・石畳A＝王国の街道、建物A（城）＝関所の石壁、段差・壁A（石）＝崖道、テント＝飢えの列の野営、農作物・干し草・かかし・立て札＝道標、骸骨 C:24/25）。D＝内装の麻袋・積まれた木箱・樽・パン棚（麦の倉）・端材・倒れた棚・瓦礫、E＝内装の槍立て（関所の兵）・金の延べ棒（一握りは王のもの）・袋・石碑・開いた本（収税吏の帳面）・教会のシンボル。荷車の絵は同梱に無い（docs/look.md 2.7 のスタンプで代わりにする）。 <hai_hidden_tiles:D:20,D:11>",
  },
  {
    id: 25,
    name: "V_鐘守の修道院",
    names: ["Inside_A1", "Outside_A2", "Outside_A3", "Inside_A4", "Inside_A5", "Inside_B", "Inside_C", "Dungeon_B", "Dungeon_C"],
    note: "鐘守の修道院（Map120–124）と境山の高みの宿坊（181）。A2・A3 は外観（回廊の中庭の草地・石畳・苔・ひび割れ、屋根）、A1・A4・A5 は内装（水場、壁A・壁K（石）・内装壁A（石）、木の床・石畳・じゅうたん・階段）。B・C＝内装（本棚・簡易棚（本）・ステンドグラス・石の柱・麻袋／教会机・女神像・教会のシンボル・ベル・開いた本・石碑・台座・槍立て＝空の鐘架の代わり）、D＝ダンジョンの石像・壊れた像・骸骨・瓦礫・石の柱（納骨堂）、E＝ダンジョンの棺・装飾柱・本棚・ステンドグラス・カーテン（廃墟）。 <hai_hidden_tiles:D:183,D:26>",
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
    console.log(same ? "Tilesets.json の 15–25 は tools/data/tilesets.mjs と同じ" : "Tilesets.json の 15–25 が tools/data/tilesets.mjs と違う");
    process.exit(same ? 0 : 1);
  }
  if (same) {
    console.log("変化なし");
  } else {
    writeTable("Tilesets.json", next);
    console.log(`書いた：${TILESETS.map(d => `${d.id} ${d.name}`).join("、")}`);
  }
}
