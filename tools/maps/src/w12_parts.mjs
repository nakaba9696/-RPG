// W12（#195）地域五の出入口の行き先。w8_maps.mjs（063 祠の裏口・080 南の坂）と w12_data.mjs が読む。
// 帯は W12 の「063・080 の出入口のイベントの行き先だけ」（docs/ROADMAP.md）。タイル層とほかのイベントは W8 のまま。
/** 063 祠の裏口の行き先：110 麦の街道の西の口（[マップ ID, x, y]） */
export const STREET_FROM_SHRINE = [110, 2, 31];
/** 110 の西の口から戻る所：063 の祠の裏口の前（W8 の ARRIVE.shrineBack と同じ） */
export const SHRINE_FROM_STREET = [63, 13, 4];
/** 080 南の坂（南の戸口 x = 18–21）の行き先：124 裏の坂の北の坂の下 */
export const SLOPE_FROM_COURT = x => [124, x <= 19 ? 21 : 22, 1];
/** 124 の北の坂（x = 20–23）から 080 へ：前庭の南（W8 の ARRIVE.courtSouth の並び） */
export const COURT_FROM_SLOPE = x => [80, Math.min(21, x - 1), 27];
