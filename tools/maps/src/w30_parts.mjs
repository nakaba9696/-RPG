// W30（#315）持ち主の遊びの直し（020 以降。docs/reviews/2026-10-16-owner.md の 5・6）：地図の設定（cfg）を書き出す前に直す部品。
//   各地図の生成スクリプト（w8_maps・w9_data・w10_data・w11_data・w12_data・w13_data・w14_data・w15_story）が、
//   書き出す直前（W14 の patchLater のあと）に fixW30(name, cfg) を呼ぶ。何度呼んでも同じ結果。010–019（W29）と試験場は触らない。
//
// 1. 見えない壁（指摘 6「なにもないのに通れない場所が多い」）
//    絵が無く・優先度「通常」・すり抜けでなく・決定で始まり・文が出るページ（tests/w_blockers.mjs が数える）を、下の BLOCKERS の表のとおりに直す。
//      low   ：優先度を「下」に（床の跡・小物・眺め。踏んで決定で調べる）
//      tile  ：タイルの絵を置く（物。凡例やその地図の置き物と同じタイル）。優先度は「通常」のまま（通れない置き物）
//      char  ：キャラの絵を置く（霧・影）。向き固定
//      copy  ：同じイベントの 1 ページ目の絵を写す（人のページの絵の写し漏れ）
//    イベントの数と座標は変えない（床の散らしがずれないように。GAM-48）。調べたときの文も変えない。
// 2. 話すと姿が変わる人（指摘 5）
//    Damage1–3（倒れた人・思念）と !Flame（思念の火）の素材は、向きの行ごとに別の人・別の火の絵。
//    「向き固定」なしで話しかけると、プレイヤーの方へ振り向いて別の行（別の人）の絵になる。
//    決定・接触で始まるページ（0〜2）に向き固定を付ける（動く敵の行も歩くと絵が変わるので同じ）。

/** 向きの行ごとに絵の違う素材（人・思念の火） */
export const TURN_SHEETS = /^(Damage\d|SF_Damage\d|!Flame)$/;

const low = at => ({ at, low: true });
const tile = (at, tileId) => ({ at, tile: tileId });
const fog = at => ({ at, char: ["!Other2", 4, 2, 1] }); // 霧の壁（021・070）と同じ絵
const copy = at => ({ at, copy: true });

/** 見えない壁の直し（マップ ID → イベント名 → 直し方）。理由は PR #315 の表 */
export const BLOCKERS = {
  20: {
    "倒れた荷車": tile([32, 37], "E:122"), // 車輪（Dungeon_C）
    "池": low([7, 42]),
    "盛り土（ノラ）": low([58, 35]),
    "見張りの小屋の跡": low([11, 9]),
    "灰の吹きだまり": low([30, 46]),
  },
  21: {
    "遺骸 ブルーノ": low([32, 27]), // 朝の砦のページ（床の灰の跡）
    "夕べの会の巡礼": copy([26, 34]), // 朝の砦のページに巡礼の絵が無かった
    "像の台（夕べの数）": low([30, 15]),
    "礼拝堂の裏の墓": tile([14, 27], "B:142"),
    "灰に埋まった鍋": low([34, 40]),
  },
  22: {
    "名札の棚": tile([3, 10], "C:205"),
    "棺の列": tile([14, 9], "C:86"),
  },
  23: { "小屋の裏の小石": low([24, 6]) },
  26: {
    "掘りかけの鉄の筋": low([6, 40]),
    "W14 後日：営倉の鐘を売る（マルゴ）": low([20, 30]),
  },
  27: { "壁の刻み": low([20, 17]) },
  29: {
    "空いた釘": low([22, 5]),
    "詰め所の机": tile([12, 9], "B:243"),
  },
  33: {
    "九番の房": low([45, 4]),
    "九番の房の壁の刻み": low([47, 5]),
    "六番の房の椀": low([31, 5]),
  },
  50: { "上段の崖（綱を掛ける）": tile([16, 13], "B:19") }, // タイル層の綱と同じ絵（鉤を掛けるまでは上れない）
  51: {
    "地下壕の扉の札": tile([11, 4], "B:137"),
    "援軍の荷車": tile([44, 23], "B:181"),
    "攻城弩": tile([38, 9], "B:150"),
    "天幕": low([15, 12]),
    "陣の敷石": low([25, 23]),
  },
  52: { "吊り橋": low([17, 14]) },
  53: { "骨の塔": low([10, 6]) },
  54: { "城壁": low([24, 6]) },
  60: {
    "内から打ち付けた戸": low([42, 22]),
    "焼けた寝台": tile([31, 26], "E:181"),
    "灰の祈りの杭": tile([13, 6], "C:115"),
    "W14 後日：灰の信徒（集落）": low([15, 11]),
  },
  61: {
    "水路の石段": low([40, 33]),
    "打ち付けた戸": tile([60, 9], "B:131"), // タイル層の戸口と同じ絵
    "焼けた鍋": low([16, 22]),
    "並んだ寝台の跡": low([7, 22]),
    "戸板（鍛冶小屋の戸口）": tile([55, 19], "B:180"), // 2 ページ目と同じ戸板
  },
  62: {
    "北の眺め": low([9, 5]),
    "屋根の梁（鉤綱で上る）": low([19, 8]),
  },
  63: {
    "戸の閂の受け": low([15, 4]),
    "鐘の台": tile([11, 4], "B:83"),
  },
  64: {
    "荷札": low([11, 5]),
    "轍": low([12, 8]),
  },
  70: {
    "網小屋の干し網": low([31, 5]),
    "干したままの網": low([26, 19]),
    "倒れた舟": low([34, 11]),
    "名の無い墓": low([5, 19]),
    "灯の祠": low([3, 32]),
    "刻みの杭": tile([72, 53], "C:115"),
    "焚き火の跡": low([68, 54]),
  },
  71: {
    "寝台": tile([20, 10], "E:150"),
    "崩れた勘定台": tile([7, 7], "E:149"),
    "葦の束": tile([4, 24], "B:248"),
    "葦の刈り跡": low([9, 33]),
    "木箱": tile([36, 24], "B:181"),
    "W14 後日：外に残された者（灯の帳面）": low([26, 10]),
  },
  72: {
    "切れた舫い綱": tile([11, 13], "C:115"),
    "樽": tile([11, 5], "B:141"),
    "舟小屋の勘定台": tile([20, 10], "E:149"),
  },
  74: { "苔むした石": tile([17, 13], "B:159") },
  80: {
    "受付の机": low([23, 16]),
    "閲覧の札": low([3, 5]),
  },
  81: {
    "焼けた書架": tile([51, 24], "D:175"),
    "南の間の掲示": low([25, 35]),
  },
  83: { "頁の山": tile([17, 6], "E:80") },
  84: { "空いた床": low([17, 14]) },
  90: {
    "搬入の名簿": low([5, 27]),
    "線路の終わり": low([36, 17]),
    "積み場の木箱": tile([27, 5], "B:220"),
  },
  91: {
    "炉": low([17, 15]),
    "檻": tile([43, 13], "B:244"),
    "型の並び": low([6, 15]),
  },
  92: { "割れた型の山": tile([4, 5], "E:151") },
  94: {
    "札掛け": low([18, 4]),
    "手前の間の煤": low([9, 19]),
  },
  100: { "洞の壁": low([20, 27]) },
  102: {
    "扉の爪の跡": low([24, 26]),
    "騎士団の盾": low([36, 3]),
    "W14 後日：扉の外の歌（大扉）": low([20, 26]),
  },
  103: { "番の寝床": low([5, 12]) },
  105: { "地下の灯": tile([20, 16], "B:106") },
  110: {
    "関所の詰め所の戸": tile([28, 12], "B:131"),
    "麻袋の跡": low([22, 22]),
  },
  111: {
    "ヴォルフラムの家の戸": tile([9, 9], "B:131"),
    "東の家の戸": tile([33, 9], "B:131"),
    "南の家の戸": tile([8, 26], "B:131"),
    "麦の倉": tile([36, 26], "B:131"),
  },
  112: {
    "石段": low([24, 26]),
    "金の延べ棒": tile([44, 19], "E:200"),
  },
  113: { "石碑": tile([11, 3], "B:64") }, // タイル層の石碑と同じ絵
  116: {
    "東の眺め": low([24, 8]),
    "西の崖の縄（霧の森へ下りる）": low([2, 8]),
  },
  120: { "嘆願の判の石": tile([12, 34], "C:208") },
  121: { "棚": tile([35, 22], "B:185") },
  122: { "W14 後日：頂の道具・本物の写し（空の鐘架）": low([19, 10]) },
  123: {
    "金の箱の跡": low([40, 7]),
    "王家の使いの机": tile([44, 6], "B:112"),
    "足場の設計図": tile([39, 23], "B:114"),
    "足場の木": tile([29, 17], "D:125"),
    "壁の刻み": low([5, 35]),
  },
  124: { "坂の足跡": low([21, 6]) },
  170: {
    "戸口（記録院の鐘の間へ戻る）": fog([1, 20]),
    "戸口（水底の鐘の間へ戻る）": fog([25, 38]),
    "戸口（鋳物場の鐘の間へ戻る）": fog([48, 20]),
    "引きずった跡": low([22, 13]),
    "爪の跡": low([3, 22]),
    "南東の小部屋の灰": low([36, 35]),
  },
  171: { "戸板の列": tile([10, 31], "B:125") },
  172: {
    "北の口（戻りの戸口へ）": fog([20, 1]),
    "灰色の殻": low([8, 23]),
  },
  173: { "擦れる音": low([17, 6]) },
  181: { "王家の使いの机": tile([11, 6], "B:112") },
  182: { "北の口（鐘楼の根へ）": { at: [13, 0], char: ["Evil", 0, 8, 1] } }, // 石段の上の影の背中（上を向く）
  183: { "隊の最後の野営の跡": low([9, 20]) },
};

// 3. 道端の階段（指摘 7「階段が 1F・2F 移動の階段で、道端の階段としてはグラがおかしい」）
//    外の高台の側面の石段に、屋内の上り階段の絵（Outside_B の 1）を使っていた。Outside_A5 の石段（64 左端・65 中・66 右端・67 1 マス幅。
//    端は横へ出られない通行）を上層（z=2）に置く。幅が 2 マス以上の所は、文字は中（65）にして、端を重ね書き（.deco.txt の [ ]）で置く。
const step = (name, as, tileId) => ({ name, as, tiles: [null, null, tileId] });
export const STAIRS = {
  20: { "/": step("坂の石段（高台の側面に刻んだ階段。側面の行に書く。W30 で外の石段の絵に）", ".", "A5:65") }, // (12..13,17)
  50: { "=": step("巨人の石段（上り。通れる。W30 で外の石段の絵に）", ":", "A5:67") }, // (14,33)・(66,33)
  51: { "/": step("坂の石段（段 1 の側面に刻んだ階段。W30 で外の石段の絵に）", ".", "A5:67") }, // (36,13)
  52: { "/": step("坂の石段（段 1 の側面に刻んだ階段。W30 で外の石段の絵に）", ".", "A5:67") }, // (9,9)
  110: { "/": step("坂の石段（高台の側面の行に書く。W30 で外の石段の絵に）", ".", "A5:65") }, // (47..49,18)・(63..64,18)
  115: { "/": step("坂の石段（高台の側面の行に書く。W30 で外の石段の絵に）", ".", "A5:67") }, // (30,20)
  124: { "/": step("坂の石段（高台の側面の行に書く。W30 で外の石段の絵に）", ".", "A5:65") }, // (15..16,8)
};
const STAIR_ENDS = { "[": { name: "石段の左端（W30）", z2: "A5:64" }, "]": { name: "石段の右端（W30）", z2: "A5:66" } };

const hasImage = img => !!img && ((img.tileId && img.tileId !== 0) || !!img.characterName);
const hasText = list => (list || []).some(c => c.code === 101);
/** 設定のページ（build.mjs の makePage に渡す形。欠けた欄は既定値）が見えない壁か */
const invisibleWall = p => !hasImage(p.image) && (p.priorityType ?? 1) === 1 && !p.through && (p.trigger ?? 0) === 0 && hasText(p.list);

/** text のイベントを、build.mjs が作るのと同じ中身の raw に直す（向き固定を付けるため） */
function textToRaw(spec) {
  const list = [];
  const blocks = Array.isArray(spec.lines[0]) ? spec.lines : [spec.lines];
  for (const block of blocks) {
    list.push({ code: 101, indent: 0, parameters: ["", 0, spec.background ?? 0, 2, spec.speaker || ""] });
    for (const line of block) list.push({ code: 401, indent: 0, parameters: [line] });
  }
  list.push({ code: 0, indent: 0, parameters: [] });
  const raw = { name: spec.name, type: "raw" };
  for (const k of ["at", "x", "y", "id", "note"]) if (spec[k] !== undefined) raw[k] = spec[k];
  raw.pages = [{ image: spec.image, priorityType: spec.priorityType ?? 1, trigger: spec.trigger ?? 0, list }];
  return raw;
}

function fixPage(page, fix, first) {
  if (fix.low) page.priorityType = 0;
  else if (fix.tile) page.image = { tileId: fix.tile };
  else if (fix.char) {
    const [characterName, characterIndex, direction, pattern] = fix.char;
    page.image = { characterName, characterIndex, direction, pattern };
    page.directionFix = true;
  } else if (fix.copy) {
    if (!hasImage(first.image)) throw new Error("copy：1 ページ目に絵が無い");
    page.image = JSON.parse(JSON.stringify(first.image));
    if (first.directionFix) page.directionFix = true;
  }
}

/** 地図の設定 cfg を直す（name は設定のファイル名。エラーの文に使う）。cfg を返す */
export function fixW30(name, cfg) {
  const mapId = cfg.mapId;
  if (!(mapId >= 20 && mapId < 900)) return cfg; // 010–019 は W29（#314）
  const table = BLOCKERS[mapId] || {};
  const found = new Set();
  cfg.events = cfg.events.map(spec => {
    const fix = table[spec.name];
    if (fix) {
      if (spec.x !== undefined && (spec.x !== fix.at[0] || spec.y !== fix.at[1])) throw new Error(`${name}「${spec.name}」が (${fix.at}) にない（(${spec.x},${spec.y})）`);
      found.add(spec.name);
      if (spec.type === "text") {
        const wall = invisibleWall({ ...spec, list: [{ code: 101 }] }); // text は必ず文が出る
        if (wall && (fix.char || fix.copy)) spec = textToRaw(spec);
        else if (wall) {
          if (fix.low) spec.priorityType = 0;
          else if (fix.tile) spec.image = { tileId: fix.tile };
        }
      }
      if (spec.type === "raw") for (const p of spec.pages) if (invisibleWall(p)) fixPage(p, fix, spec.pages[0]);
    }
    // 2. 向きの行ごとに絵の違う素材に向き固定
    const turns = p => p.image && TURN_SHEETS.test(p.image.characterName || "") && !p.directionFix && (p.trigger ?? 0) <= 2;
    if (spec.type === "text" && turns({ ...spec, trigger: spec.trigger })) spec = textToRaw(spec);
    if (spec.type === "raw") for (const p of spec.pages) if (turns(p)) p.directionFix = true;
    return spec;
  });
  for (const n of Object.keys(table)) if (!found.has(n)) throw new Error(`${name}「${n}」が無い（W30 の表）`);
  if (STAIRS[mapId]) {
    cfg.chars = { ...(cfg.chars || {}), ...STAIRS[mapId] };
    if (Object.values(STAIRS[mapId]).some(c => c.tiles[2] === "A5:65")) cfg.deco = { ...(cfg.deco || {}), ...STAIR_ENDS };
  }
  return cfg;
}
