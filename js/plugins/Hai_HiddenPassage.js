/*:
 * @target MZ
 * @plugindesc 隠し通路（見えない通路・隠し扉・片側扉・隠し階段）をリージョンで表す。
 * @author 灰の王国
 * @help
 * 見た目は壁のまま、リージョン ID で通行とふるまいを上書きする（プレイヤーだけに効く）。
 *
 *   251 見えない通路   いつでも通れる。踏むと「発見済み」に入る
 *   252 隠し扉         向かい合って調べる（決定キー・タッチ）と開き、以後通れる
 *   253 片側扉         裏から踏み込むと開き、以後通れる。表からは壁
 *                      同じ座標のイベントのメモ欄に <hai_oneway:up>（裏の側。up/down/left/right）
 *   254 隠し階段       ふだんは床。調べると現れ、踏むと移動する
 *                      同じ座標のイベントのメモ欄に <hai_stairs:マップID,x,y>
 * 250・255〜259 は予約。
 *
 * メモ欄のためのイベントは「通常キャラの下」・画像なし・中身なしにする。
 * 開いた・見つけたものは $gameSystem._hai.hidden に入る（セーブに入る）。
 * 開いた扉と現れた階段は、そのマスの第 4 層（z=3）にタイルを重ねて描く。
 * その座標にイベントがあれば、開いたときにセルフスイッチ A を ON にする。
 * 重ねるタイルはタイルセットごとに変えられる（B が Outside_B だと 183 は木箱、26 は梯子になるため）：
 *   タイルセットかマップのメモ欄に <hai_hidden_tiles:開いた扉,階段>（タイル ID か D:183 のような書き方）
 *   優先はマップ ＞ タイルセット ＞ パラメータ。現れた階段は、描いたタイルの通行に関係なく 4 方向から入れる。
 *
 * 窓口 window.Hai.HiddenPassage：
 *   found(mapId)  isFound(x, y, mapId)  isHiddenAt(x, y)  regionKind(x, y)
 *   revealAt(x, y, mapId, region)  overlayTiles()  REGION
 * 詳しくは docs/plugins/Hai_HiddenPassage.md。
 *
 * @param openDoorTile
 * @text 開いた扉に重ねるタイル
 * @desc B〜E のタイル ID（B は 0〜255）。既定は Dungeon_B の暗いアーチ（183）。
 * @type number
 * @default 183
 *
 * @param stairsTile
 * @text 現れた階段に重ねるタイル
 * @desc B〜E のタイル ID。既定は Dungeon_B の下り階段（26）。
 * @type number
 * @default 26
 *
 * @param doorMessage
 * @text 隠し扉を見つけたときの文章
 * @desc 空にすると文章を出さない。
 * @type string
 * @default 隠し扉を見つけた！
 *
 * @param stairsMessage
 * @text 隠し階段を見つけたときの文章
 * @desc 空にすると文章を出さない。
 * @type string
 * @default 隠し階段を見つけた！
 *
 * @param flash
 * @text 開いたときに画面を光らせる
 * @type boolean
 * @default true
 */
(() => {
  "use strict";
  const pluginName = "Hai_HiddenPassage";
  const params = PluginManager.parameters(pluginName);
  const openDoorTile = Number(params.openDoorTile || 183);
  const stairsTile = Number(params.stairsTile || 26);
  const doorMessage = params.doorMessage ?? "隠し扉を見つけた！";
  const stairsMessage = params.stairsMessage ?? "隠し階段を見つけた！";
  const useFlash = (params.flash || "true") === "true";

  const REGION = Object.freeze({ PASSAGE: 251, DOOR: 252, ONEWAY: 253, STAIRS: 254 });
  const OVERLAY_Z = 3;
  const DIRS = { up: 8, down: 2, left: 4, right: 6, 上: 8, 下: 2, 左: 4, 右: 6, 8: 8, 2: 2, 4: 4, 6: 6 };

  // ---------------------------------------------------------------------------
  // 状態（$gameSystem._hai.hidden）
  // ---------------------------------------------------------------------------
  function state() {
    const sys = $gameSystem;
    sys._hai = sys._hai || {};
    sys._hai.hidden = sys._hai.hidden || {};
    sys._hai.hidden.found = sys._hai.hidden.found || {};
    return sys._hai.hidden;
  }

  const keyOf = (mapId, x, y) => `${mapId},${x},${y}`;

  function isFound(x, y, mapId = $gameMap.mapId()) {
    return !!state().found[keyOf(mapId, x, y)];
  }

  function regionKind(x, y) {
    if (!$gameMap.isValid(x, y)) return 0;
    const r = $gameMap.regionId(x, y);
    return r >= REGION.PASSAGE && r <= REGION.STAIRS ? r : 0;
  }

  function eventMeta(x, y, tag) {
    for (const ev of $gameMap.eventsXy(x, y)) {
      const data = ev.event();
      if (data && data.meta && data.meta[tag] !== undefined) return String(data.meta[tag]).trim();
    }
    return null;
  }

  /** 片側扉の裏の側（2/4/6/8）。メモ欄が無ければ 0（どちらからも開かない）。 */
  function onewayBack(x, y) {
    const v = eventMeta(x, y, "hai_oneway");
    return v === null ? 0 : DIRS[v] || 0;
  }

  /** 隠し階段の行き先 [mapId, x, y, d]。無ければ null。 */
  function stairsDest(x, y) {
    const v = eventMeta(x, y, "hai_stairs");
    if (v === null) return null;
    const n = v.split(",").map(s => Number(s.trim()));
    if (n.length < 3 || n.slice(0, 3).some(k => !Number.isInteger(k))) return null;
    return [n[0], n[1], n[2], DIRS[n[3]] || 0];
  }

  // ---------------------------------------------------------------------------
  // 見た目：開いた扉・現れた階段のマスの z=3 にタイルを重ねる（$dataMap を書き換える。読み直すたびに当て直す）
  // ---------------------------------------------------------------------------
  const TILE_BASE = { B: 0, C: 256, D: 512, E: 768 };

  /** 「695」「D:183」のような書き方をタイル ID に。読めなければ 0。 */
  function parseTile(text) {
    const s = String(text || "").trim();
    const m = /^([BCDE])\s*:\s*(\d+)$/i.exec(s);
    if (m) {
      const n = Number(m[2]);
      return n < 256 ? TILE_BASE[m[1].toUpperCase()] + n : 0;
    }
    const n = Number(s);
    return s !== "" && Number.isInteger(n) && n > 0 && n < 1024 ? n : 0;
  }

  /** メモ欄の <hai_hidden_tiles:扉,階段> を [扉, 階段] に（読めない方は 0）。 */
  function parseHiddenTiles(meta) {
    const v = meta && meta.hai_hidden_tiles;
    if (v === undefined || v === true) return [0, 0];
    const parts = String(v).split(",");
    return [parseTile(parts[0]), parseTile(parts[1])];
  }

  /** 今の $dataMap に重ねるタイル { door, stairs }。マップのメモ欄 ＞ タイルセットのメモ欄 ＞ パラメータ。 */
  function overlayTiles() {
    const map = $dataMap || {};
    const tileset = (window.$dataTilesets && $dataTilesets[map.tilesetId]) || {};
    const fromMap = parseHiddenTiles(map.meta);
    const fromTileset = parseHiddenTiles(tileset.meta);
    return {
      door: fromMap[0] || fromTileset[0] || openDoorTile,
      stairs: fromMap[1] || fromTileset[1] || stairsTile,
    };
  }

  function overlayTileFor(region) {
    if (region === REGION.DOOR || region === REGION.ONEWAY) return overlayTiles().door;
    if (region === REGION.STAIRS) return overlayTiles().stairs;
    return 0;
  }

  function setOverlay(x, y, region) {
    const tile = overlayTileFor(region);
    if (!tile || !$dataMap || !$dataMap.data) return;
    const { width, height } = $dataMap;
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    $dataMap.data[(OVERLAY_Z * height + y) * width + x] = tile;
  }

  function applyOverlays(mapId) {
    const prefix = mapId + ",";
    for (const [key, region] of Object.entries(state().found)) {
      if (!key.startsWith(prefix)) continue;
      const [, x, y] = key.split(",").map(Number);
      setOverlay(x, y, region);
    }
  }

  function refreshTilemap() {
    const scene = SceneManager._scene;
    const tilemap = scene && scene._spriteset && scene._spriteset._tilemap;
    if (tilemap) tilemap.refresh();
  }

  // ---------------------------------------------------------------------------
  // 見つける
  // ---------------------------------------------------------------------------
  /** 記録して見た目を変える。新しく見つけたら true。mapId が今のマップでなければ記録だけ。 */
  function record(x, y, mapId = $gameMap.mapId(), region = 0) {
    const key = keyOf(mapId, x, y);
    if (state().found[key]) return false;
    const onMap = mapId === $gameMap.mapId();
    const kind = region || (onMap ? regionKind(x, y) : 0);
    if (!kind) return false;
    state().found[key] = kind;
    if (onMap) {
      setOverlay(x, y, kind);
      refreshTilemap();
      for (const ev of $gameMap.eventsXy(x, y)) {
        $gameSelfSwitches.setValue([mapId, ev.eventId(), "A"], true);
      }
    }
    return true;
  }

  function performReveal(message) {
    if (useFlash) $gameScreen.startFlash([255, 255, 255, 160], 24);
    if (message) $gameMessage.add(message);
  }

  /** (x, y) の隠し扉・隠し階段を調べる。開いたら true。 */
  function investigate(x, y) {
    const kind = regionKind(x, y);
    if (kind !== REGION.DOOR && kind !== REGION.STAIRS) return false;
    if (!record(x, y)) return false;
    performReveal(kind === REGION.DOOR ? doorMessage : stairsMessage);
    return true;
  }

  // ---------------------------------------------------------------------------
  // 通行（プレイヤーだけ）
  // ---------------------------------------------------------------------------
  let searching = false;

  function isWallTile(x, y) {
    const id = $gameMap.tileId(x, y, 0);
    return Tilemap.isWallTopTile(id) || Tilemap.isWallSideTile(id) || Tilemap.isRoofTile(id);
  }
 // マウス・タッチの道探しの最中

  /** プレイヤーが向き d で (x, y) に入れるか。隠し通路でなければ null（タイルどおり）。 */
  function canEnter(x, y, d) {
    const kind = regionKind(x, y);
    switch (kind) {
      case REGION.PASSAGE:
        return searching ? isFound(x, y) : true;
      case REGION.DOOR:
        return isFound(x, y);
      case REGION.ONEWAY:
        if (isFound(x, y)) return true;
        // 裏の側から踏み込む：裏が上（8）なら下向き（2）に動いて入る
        return !searching && onewayBack(x, y) === 10 - d;
      case REGION.STAIRS:
        // 現れた階段は、描いたタイル（梯子など）の通行に関係なく 4 方向から入れる。現れる前は床のまま（タイルどおり）
        return isFound(x, y) ? true : null;
      default:
        return null;
    }
  }

  const _Game_Player_isMapPassable = Game_Player.prototype.isMapPassable;
  Game_Player.prototype.isMapPassable = function(x, y, d) {
    if (this.isInVehicle()) return _Game_Player_isMapPassable.apply(this, arguments);
    const x2 = $gameMap.roundXWithDirection(x, d);
    const y2 = $gameMap.roundYWithDirection(y, d);
    const here = regionKind(x, y);
    const leaveHidden = here !== 0 && (here !== REGION.STAIRS || isFound(x, y));
    const enter = canEnter(x2, y2, d);
    if (!leaveHidden && enter === null) return _Game_Player_isMapPassable.apply(this, arguments);
    // 隠し通路のマスの上にいるなら、出る向きはタイルに関係なく出られる。
    // ただし出た先が壁（A3・A4）なら出られない（壁の上面は真ん中が通れるので、通路から壁の上へ歩き出さないように）
    const leave = leaveHidden || $gameMap.isPassable(x, y, d);
    let into = enter;
    if (into === null) {
      into = $gameMap.isPassable(x2, y2, this.reverseDir(d)) && !(leaveHidden && isWallTile(x2, y2));
    }
    return leave && into;
  };

  const _Game_Player_findDirectionTo = Game_Player.prototype.findDirectionTo;
  Game_Player.prototype.findDirectionTo = function() {
    searching = true;
    try {
      return _Game_Player_findDirectionTo.apply(this, arguments);
    } finally {
      searching = false;
    }
  };

  // 踏み込んだとき：見えない通路は記録だけ、片側扉は開く
  const _Game_Player_moveStraight = Game_Player.prototype.moveStraight;
  Game_Player.prototype.moveStraight = function() {
    _Game_Player_moveStraight.apply(this, arguments);
    if (!this.isMovementSucceeded()) return;
    const kind = regionKind(this.x, this.y);
    if (kind === REGION.PASSAGE) {
      record(this.x, this.y);
    } else if (kind === REGION.ONEWAY && record(this.x, this.y)) {
      performReveal("");
    }
  };

  // 調べる（決定キー・タッチ）：前のマス、なければ足元
  const _Game_Player_checkEventTriggerThere = Game_Player.prototype.checkEventTriggerThere;
  Game_Player.prototype.checkEventTriggerThere = function(triggers) {
    _Game_Player_checkEventTriggerThere.apply(this, arguments);
    if (!triggers.includes(0) || !this.canStartLocalEvents() || $gameMap.isAnyEventStarting()) return;
    const x2 = $gameMap.roundXWithDirection(this.x, this.direction());
    const y2 = $gameMap.roundYWithDirection(this.y, this.direction());
    if (!investigate(x2, y2)) investigate(this.x, this.y);
  };

  // 現れた階段を踏んだら移動
  const _Game_Player_checkEventTriggerHere = Game_Player.prototype.checkEventTriggerHere;
  Game_Player.prototype.checkEventTriggerHere = function(triggers) {
    _Game_Player_checkEventTriggerHere.apply(this, arguments);
    if (!triggers.includes(1) || $gameMap.isAnyEventStarting() || this.isTransferring()) return;
    if (regionKind(this.x, this.y) !== REGION.STAIRS || !isFound(this.x, this.y)) return;
    const dest = stairsDest(this.x, this.y);
    if (dest) this.reserveTransfer(dest[0], dest[1], dest[2], dest[3] || this.direction(), 0);
  };

  // マップを読み込んだら、見つけたものの見た目を当て直す
  const _Scene_Map_onMapLoaded = Scene_Map.prototype.onMapLoaded;
  Scene_Map.prototype.onMapLoaded = function() {
    applyOverlays($gamePlayer.isTransferring() ? $gamePlayer.newMapId() : $gameMap.mapId());
    _Scene_Map_onMapLoaded.apply(this, arguments);
  };

  // ---------------------------------------------------------------------------
  // 窓口
  // ---------------------------------------------------------------------------
  window.Hai = window.Hai || {};
  Hai.HiddenPassage = {
    REGION,
    /** 見つけたものの一覧 [{ mapId, x, y, region }]。mapId を渡すとそのマップだけ。 */
    found(mapId) {
      return Object.entries(state().found)
        .map(([key, region]) => {
          const [m, x, y] = key.split(",").map(Number);
          return { mapId: m, x, y, region };
        })
        .filter(e => mapId === undefined || e.mapId === mapId);
    },
    isFound,
    /** 今のマップの (x, y) が隠し通路（251–254）で、まだ見つけていないか。 */
    isHiddenAt(x, y) {
      return regionKind(x, y) !== 0 && !isFound(x, y);
    },
    regionKind,
    /** 今のマップで開いた扉・現れた階段に重ねるタイル { door, stairs }（マップ ＞ タイルセット ＞ パラメータ）。 */
    overlayTiles,
    /** 見つけたことにする（演出なし）。新しく見つけたら true。ほかのマップなら region（251–254）も渡す。 */
    revealAt(x, y, mapId, region) {
      return record(x, y, mapId === undefined ? $gameMap.mapId() : mapId, region || 0);
    },
  };
})();
