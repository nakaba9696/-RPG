// マップの到達性（プレイヤーが歩いて行けるマス）を計算する。検査は tools/data/check.mjs、一覧は tools/data/README.md。
// 通行の規則はコアスクリプトと Hai_HiddenPassage.js を読んで写した（推測しない）：
//   Game_Map.checkPassage    タイルイベント → 層 3・2・1・0 の順に、☆（0x10）でない最初のタイルのビットで決まる
//   Game_Map.isPassable      向き d のビットは (1 << (d / 2 - 1)) & 0x0f
//   Game_CharacterBase.canPass / isMapPassable
//                            行き先が地図の中、今のマスから d に出られる、行き先に逆向きから入れる、行き先に
//                            「通常キャラと同じ」（priorityType 1）で すり抜けでないイベントが無い
//   Game_Player.isMapPassable（Hai_HiddenPassage の上書き）
//                            251 見えない通路はいつでも入れる。252 隠し扉は調べれば入れる（入れる扱い）。
//                            253 片側扉は裏の側から踏み込んだときだけ入れる（入ってしまえば どの向きにも出られるので、裏からだけで十分）。
//                            251〜253 のマスからは タイルに関係なく出られる。ただし出た先が壁（A3・A4）なら出られない
//   254 隠し階段はふだんの床（タイルどおり）。現れた後の移動は場所移動として数える
// 単純にしている所（README にも書く）：
//   - イベントのページは「ニューゲームの直後に出るページ」（スイッチ・セルフスイッチ・変数・アイテムが無い状態）で見る。
//     ただし、どこかのページで通れるイベント（スイッチで開く扉など）は通れる扱い（仕掛けは静的には解けないので、落としすぎない側に倒す）。
//     タイルの絵のイベント（通常キャラの下）も、どこかのページで通れる絵になる（水が引く・橋が架かる）なら通れる扱い
//   - シンボル敵（<hai_enemy>）と、自律移動が「固定」でないイベントは動くので壁にしない
//   - <hai_locked> の扉は鍵（<hai_key:アイテム ID>）を手に入れるまで壁。鍵をくれるイベント（126 で増やす）に届けば開く
import { isWallTopTile, isWallSideTile, isRoofTile } from "../maps/autotile.mjs";

export const REGION = Object.freeze({ PASSAGE: 251, DOOR: 252, ONEWAY: 253, STAIRS: 254 });
export const DIRS = [2, 4, 6, 8];
const DX = { 2: 0, 4: -1, 6: 1, 8: 0 };
const DY = { 2: 1, 4: 0, 6: 0, 8: -1 };
const DIR_NAMES = { up: 8, down: 2, left: 4, right: 6, 上: 8, 下: 2, 左: 4, 右: 6, 8: 8, 2: 2, 4: 4, 6: 6 };

/** メモ欄のタグ（DataManager.extractMetadata と同じ読み方）。値の無いタグは true。 */
export function parseMeta(note) {
  const meta = {};
  const re = /<([^<>:]+)(:?)([^>]*)>/g;
  let m;
  while ((m = re.exec(note || ""))) meta[m[1]] = m[2] === ":" ? m[3] : true;
  return meta;
}

/** 片側扉の裏の向き（<hai_oneway:up> → 8）。無ければ 0。 */
export function onewayBack(meta) {
  const v = meta.hai_oneway;
  return v === undefined || v === true ? 0 : DIR_NAMES[String(v).trim()] || 0;
}

/** <hai_stairs:map,x,y[,d]> → [map, x, y]。読めなければ null。 */
export function stairsDest(meta) {
  const v = meta.hai_stairs;
  if (v === undefined || v === true) return null;
  const n = String(v).split(",").map(s => Number(s.trim()));
  return n.length >= 3 && n.slice(0, 3).every(Number.isInteger) ? n.slice(0, 3) : null;
}

/** ニューゲームの直後に条件を満たすか（Game_Event.meetsConditions を、スイッチ・変数・アイテムが無い状態で）。 */
function meetsInitial(c, partyMembers) {
  if (c.switch1Valid || c.switch2Valid || c.selfSwitchValid || c.itemValid) return false;
  if (c.variableValid && 0 < c.variableValue) return false;
  if (c.actorValid && !partyMembers.includes(c.actorId)) return false;
  return true;
}

/** ニューゲームの直後に出るページ（Game_Event.findProperPageIndex：後ろのページから）。無ければ null。 */
export function initialPage(event, partyMembers = []) {
  for (let i = event.pages.length - 1; i >= 0; i--) {
    if (meetsInitial(event.pages[i].conditions, partyMembers)) return event.pages[i];
  }
  return null;
}

const blocksIn = page => page.priorityType === 1 && !page.through;

/** 施錠扉の鍵のアイテム ID（<hai_key:121>）。無ければ 0。 */
export function keyOf(meta) {
  const n = Number(meta.hai_key);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

/**
 * マップを歩くための形。opened は開いた施錠扉のイベント ID の集合。
 * 返すもの：{ width, height, tileId, region, isPassable, isWall, canMove, isBlocker, … }
 */
export function makeMapModel(map, tileset, { partyMembers = [], opened = new Set() } = {}) {
  const { width, height, data } = map;
  const flags = tileset ? tileset.flags : [];
  const tileId = (x, y, z) => data[(z * height + y) * width + x] || 0;
  const region = (x, y) => tileId(x, y, 5);
  const key = (x, y) => y * width + x;
  const isValid = (x, y) => x >= 0 && x < width && y >= 0 && y < height;

  const tileEvents = new Map(); // key → [tileId]（Game_Map.tileEventsXy）
  const blockers = new Set(); // key
  const oneway = new Map(); // key → 裏の向き
  for (const ev of map.events) {
    if (!ev) continue;
    const meta = parseMeta(ev.note);
    const k = key(ev.x, ev.y);
    if (meta.hai_oneway !== undefined) oneway.set(k, Math.max(oneway.get(k) || 0, onewayBack(meta)));
    const page = initialPage(ev, partyMembers);
    // タイルの絵のイベント：どこかのページで通れる絵になる（水が引く・橋が架かる）なら、その絵で見る。無ければ最初のページの絵
    const isTilePage = p => p && p.image.tileId > 0 && p.priorityType === 0 && !p.through;
    const opens = ev.pages.find(p => isTilePage(p) && ((flags[p.image.tileId] || 0) & 0x10) === 0 && ((flags[p.image.tileId] || 0) & 0x0f) !== 0x0f);
    const tilePage = opens || (isTilePage(page) ? page : null);
    if (tilePage) {
      if (!tileEvents.has(k)) tileEvents.set(k, []);
      tileEvents.get(k).push(tilePage.image.tileId);
    }
    if (!page) continue;
    let blocks;
    if (meta.hai_locked !== undefined) blocks = !opened.has(ev.id);
    else if (meta.hai_enemy !== undefined || page.moveType !== 0) blocks = false;
    else blocks = ev.pages.every(blocksIn);
    if (blocks) blockers.add(k);
  }

  function checkPassage(x, y, bit) {
    const tiles = (tileEvents.get(key(x, y)) || []).concat([3, 2, 1, 0].map(z => tileId(x, y, z)));
    for (const t of tiles) {
      const f = flags[t] || 0;
      if ((f & 0x10) !== 0) continue;
      if ((f & bit) === 0) return true;
      if ((f & bit) === bit) return false;
    }
    return false;
  }
  const isPassable = (x, y, d) => checkPassage(x, y, (1 << (d / 2 - 1)) & 0x0f);
  const isWall = (x, y) => {
    const t = tileId(x, y, 0);
    return isWallTopTile(t) || isWallSideTile(t) || isRoofTile(t);
  };
  const hiddenKind = (x, y) => {
    const r = isValid(x, y) ? region(x, y) : 0;
    return r >= REGION.PASSAGE && r <= REGION.STAIRS ? r : 0;
  };

  /** プレイヤーが (x, y) から向き d に 1 歩動けるか（Game_CharacterBase.canPass ＋ Hai_HiddenPassage）。 */
  function canMove(x, y, d) {
    const x2 = x + DX[d];
    const y2 = y + DY[d];
    if (!isValid(x2, y2)) return false;
    const here = hiddenKind(x, y);
    const leaveHidden = here !== 0 && here !== REGION.STAIRS;
    let enter = null;
    switch (hiddenKind(x2, y2)) {
      case REGION.PASSAGE: enter = true; break;
      case REGION.DOOR: enter = true; break; // 調べれば開く
      case REGION.ONEWAY: enter = oneway.get(key(x2, y2)) === 10 - d; break;
    }
    let ok;
    if (!leaveHidden && enter === null) {
      ok = isPassable(x, y, d) && isPassable(x2, y2, 10 - d);
    } else {
      const leave = leaveHidden || isPassable(x, y, d);
      const into = enter !== null ? enter : isPassable(x2, y2, 10 - d) && !(leaveHidden && isWall(x2, y2));
      ok = leave && into;
    }
    return ok && !blockers.has(key(x2, y2));
  }

  /** そのマスに立ったら、どこかへ 1 歩でも動けるか（場所移動の行き先が「通れるマス」か）。 */
  const canLeave = (x, y) => DIRS.some(d => canMove(x, y, d));

  return { width, height, tileId, region, key, isValid, isPassable, isWall, hiddenKind, canMove, canLeave,
    isBlocker: (x, y) => blockers.has(key(x, y)), oneway };
}

/** entries（[{x, y}]）から歩いて行けるマス。Uint8Array（1 = 行ける）。 */
export function reach(model, entries) {
  const seen = new Uint8Array(model.width * model.height);
  const queue = [];
  for (const { x, y } of entries) {
    if (!model.isValid(x, y) || seen[model.key(x, y)]) continue;
    seen[model.key(x, y)] = 1;
    queue.push([x, y]);
  }
  while (queue.length) {
    const [x, y] = queue.pop();
    for (const d of DIRS) {
      const x2 = x + DX[d];
      const y2 = y + DY[d];
      if (!model.isValid(x2, y2) || seen[model.key(x2, y2)]) continue;
      if (!model.canMove(x, y, d)) continue;
      seen[model.key(x2, y2)] = 1;
      queue.push([x2, y2]);
    }
  }
  return seen;
}

/**
 * イベントに届くか：そのマスに立てるか、上下左右のどれかに立てる（向き合って決定キーで調べられる。
 * Game_Player.checkEventTriggerThere は前のマスの通行を見ない）。
 */
export function canTouch(model, seen, x, y) {
  if (model.isValid(x, y) && seen[model.key(x, y)]) return true;
  return DIRS.some(d => model.isValid(x + DX[d], y + DY[d]) && seen[model.key(x + DX[d], y + DY[d])]);
}

/** 1 つのイベントで、アイテム（126 で増やす）として渡すもの。 */
export function itemsGiven(list) {
  return list.filter(c => c.code === 126 && c.parameters[1] === 0).map(c => c.parameters[0]);
}

/**
 * 全マップの到達性。施錠扉は「鍵をくれるイベントに届いたら開く」を、変わらなくなるまで繰り返す（マップをまたいでよい）。
 *   maps: { [mapId]: map }、tilesets: Tilesets.json、entries: { [mapId]: [{x, y, why}] }
 *   freeKeys: 最初から手に入るとみなすアイテム ID（コモンイベントがくれるもの）
 * 返すもの：{ models: {mapId: model}, seen: {mapId: Uint8Array}, opened: {mapId: Set}, keys: Set }
 */
export function reachWorld({ maps, tilesets, entries, partyMembers = [], freeKeys = [] }) {
  const opened = {};
  for (const id of Object.keys(maps)) opened[id] = new Set();
  for (;;) {
    const models = {};
    const seen = {};
    const keys = new Set(freeKeys);
    for (const [id, map] of Object.entries(maps)) {
      models[id] = makeMapModel(map, tilesets[map.tilesetId], { partyMembers, opened: opened[id] });
      seen[id] = reach(models[id], entries[id] || []);
      for (const ev of map.events) {
        if (!ev || !canTouch(models[id], seen[id], ev.x, ev.y)) continue;
        for (const p of ev.pages) for (const item of itemsGiven(p.list)) keys.add(item);
      }
    }
    let changed = false;
    for (const [id, map] of Object.entries(maps)) {
      for (const ev of map.events) {
        if (!ev || opened[id].has(ev.id)) continue;
        const meta = parseMeta(ev.note);
        if (meta.hai_locked === undefined || !keys.has(keyOf(meta))) continue;
        if (!canTouch(models[id], seen[id], ev.x, ev.y)) continue;
        opened[id].add(ev.id);
        changed = true;
      }
    }
    if (!changed) return { models, seen, opened, keys };
  }
}
