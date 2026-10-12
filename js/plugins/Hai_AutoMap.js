/*:
 * @target MZ
 * @plugindesc オートマップ：通った所と見つけた隠し通路・思念・施錠扉・落とした魔石を地図に描く。
 * @author 灰の王国
 * @help
 * プレイヤーが立ったマス（と上下左右 1 マス）をマップごとに記録し、
 * 地図の画面（メニューの「地図」か、マップで M キー）に描く。
 *
 *   床は明るく、壁は暗く、まだ見ていないマスは描かない。
 *   見つけた隠し通路（Hai_HiddenPassage のリージョン 251–254）は水色。
 *   残留思念（Hai_Thoughts）は、読んでいなければ金の丸、読んだら灰色の丸。
 *   施錠扉（メモ欄 <hai_locked>）は、閉じていれば橙の四角、開けたら灰色の四角。
 *   落とした魔石（Hai_Defeat）は紫のひし形。プレイヤーは赤い点で点滅。
 *   縮尺は画面（1280×720）に収まるように自動で決める。
 *
 * 状態（セーブに入る）：
 *   $gameSystem._hai.automap = { マップID: { w, h, v: "通ったマスのビット列（6 ビット 1 文字）", n: "表示名" } }
 *   60×60 のマップで 1 枚 700 バイトほど。
 *
 * 窓口 window.Hai.AutoMap：
 *   visited(mapId)  visitedCount(mapId)  isVisited(x, y, mapId)  markVisited(mapId, x, y)
 *   clear(mapId)  revealVisited()  mapName(mapId)  cellKind(x, y)  marks()  foundPassages(mapId)  open()
 * 詳しくは docs/plugins/Hai_AutoMap.md。
 *
 * @param mapKey
 * @text 地図を開くキー（キーコード）
 * @desc マップの上でこのキーを押すと地図を開く。既定 77 は M。0 でキーを使わない。
 * @type number
 * @default 77
 *
 * @param mapButton
 * @text 地図を開くゲームパッドのボタン
 * @desc 既定 8 は「Back／View」。-1 で使わない。
 * @type number
 * @min -1
 * @default 8
 *
 * @param menuText
 * @text メニューの項目名
 * @desc 空にするとメニューに出さない。
 * @type string
 * @default 地図
 *
 * @param maxTile
 * @text 1 マスの最大の大きさ（ピクセル）
 * @type number
 * @min 2
 * @default 24
 *
 * @param floorColor
 * @text 床の色
 * @type string
 * @default #cfc6ad
 *
 * @param wallColor
 * @text 壁の色
 * @type string
 * @default #4d4840
 *
 * @param hiddenColor
 * @text 見つけた隠し通路の色
 * @type string
 * @default #4fc3f7
 */
(() => {
  "use strict";
  const pluginName = "Hai_AutoMap";
  const params = PluginManager.parameters(pluginName);
  const mapKey = Number(params.mapKey ?? 77);
  const mapButton = Number(params.mapButton ?? 8);
  const menuText = params.menuText ?? "地図";
  const maxTile = Math.max(2, Number(params.maxTile || 24));

  const COLORS = {
    floor: params.floorColor || "#cfc6ad",
    wall: params.wallColor || "#4d4840",
    hidden: params.hiddenColor || "#4fc3f7",
    unread: "#ffd54f",
    read: "#8e8e8e",
    door: "#ff8a50",
    doorOpen: "#8e8e8e",
    drop: "#d18cf0",
    player: "#ff4d4d",
    panel: "rgba(8,8,12,0.88)",
    frame: "#6d6658",
  };
  const HIDDEN_FIRST = 251;
  const HIDDEN_LAST = 254;
  const STAIRS = 254;
  const INPUT_NAME = "haiMap";

  if (mapKey > 0) Input.keyMapper[mapKey] = INPUT_NAME;
  if (mapButton >= 0) Input.gamepadMapper[mapButton] = INPUT_NAME;

  // ---------------------------------------------------------------------------
  // ビット列 ⇔ 文字列（6 ビットを 1 文字。JSON で逃がす文字を使わない）
  // ---------------------------------------------------------------------------
  const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const DECODE = {};
  for (let i = 0; i < 64; i++) DECODE[ALPHABET[i]] = i;

  function decode(str, size) {
    const bits = new Uint8Array(size);
    for (let c = 0; c < str.length; c++) {
      const v = DECODE[str[c]] || 0;
      if (!v) continue;
      for (let b = 0; b < 6; b++) {
        const i = c * 6 + b;
        if (i < size && v & (1 << b)) bits[i] = 1;
      }
    }
    return bits;
  }

  function encode(bits) {
    let out = "";
    for (let c = 0; c * 6 < bits.length; c++) {
      let v = 0;
      for (let b = 0; b < 6; b++) if (bits[c * 6 + b]) v |= 1 << b;
      out += ALPHABET[v];
    }
    return out.replace(/A+$/, ""); // 後ろの 0 は省く
  }

  // ---------------------------------------------------------------------------
  // 状態（$gameSystem._hai.automap）
  // ---------------------------------------------------------------------------
  function state() {
    $gameSystem._hai = $gameSystem._hai || {};
    $gameSystem._hai.automap = $gameSystem._hai.automap || {};
    return $gameSystem._hai.automap;
  }

  // 今のマップのビット列はほどいたまま持つ（1 歩ごとに文字列にし直す。60×60 で 600 文字）
  let cache = null; // { mapId, w, h, bits, rec }

  function currentDims() {
    return $dataMap && $dataMap.width ? { w: $dataMap.width, h: $dataMap.height } : null;
  }

  /** 今のマップの記録（無ければ作る。エディタで大きさが変わっていたら座標で写し直す）。 */
  function currentRecord() {
    const mapId = $gameMap.mapId();
    const dims = currentDims();
    if (!mapId || !dims) return null;
    const all = state();
    if (cache && cache.mapId === mapId && cache.rec === all[mapId] && cache.w === dims.w && cache.h === dims.h) return cache;
    let rec = all[mapId];
    let bits;
    if (rec && rec.w === dims.w && rec.h === dims.h) {
      bits = decode(rec.v || "", dims.w * dims.h);
    } else {
      bits = new Uint8Array(dims.w * dims.h);
      if (rec) {
        const old = decode(rec.v || "", rec.w * rec.h);
        for (let y = 0; y < Math.min(rec.h, dims.h); y++) {
          for (let x = 0; x < Math.min(rec.w, dims.w); x++) bits[y * dims.w + x] = old[y * rec.w + x];
        }
      }
      rec = { w: dims.w, h: dims.h, v: encode(bits) };
      all[mapId] = rec;
    }
    const name = $gameMap.displayName();
    if (name) rec.n = name;
    else delete rec.n;
    cache = { mapId, w: dims.w, h: dims.h, bits, rec };
    return cache;
  }

  /** そのマップのビット列（今のマップでなければ記録からほどく）。記録が無ければ null。 */
  function bitsOf(mapId) {
    if (mapId === $gameMap.mapId()) {
      const c = currentRecord();
      return c && { w: c.w, h: c.h, bits: c.bits };
    }
    const rec = state()[mapId];
    return rec ? { w: rec.w, h: rec.h, bits: decode(rec.v || "", rec.w * rec.h) } : null;
  }

  function setCells(cells) {
    const c = currentRecord();
    if (!c) return 0;
    let added = 0;
    for (const [x, y] of cells) {
      if (x < 0 || y < 0 || x >= c.w || y >= c.h) continue;
      const i = y * c.w + x;
      if (!c.bits[i]) {
        c.bits[i] = 1;
        added++;
      }
    }
    if (added) c.rec.v = encode(c.bits);
    return added;
  }

  /** プレイヤーの足元と上下左右を記録する。 */
  function markAround(x, y) {
    return setCells([[x, y], [x, y - 1], [x, y + 1], [x - 1, y], [x + 1, y]]);
  }

  let lastSpot = "";
  const _Game_Player_update = Game_Player.prototype.update;
  Game_Player.prototype.update = function() {
    _Game_Player_update.apply(this, arguments);
    const mapId = $gameMap.mapId();
    if (!mapId || this.isTransferring()) return;
    const spot = `${mapId},${this.x},${this.y}`;
    if (spot !== lastSpot) {
      lastSpot = spot;
      markAround(this.x, this.y);
    }
  };

  // ロードしたら作り直す
  const _Game_System_onAfterLoad = Game_System.prototype.onAfterLoad;
  Game_System.prototype.onAfterLoad = function() {
    _Game_System_onAfterLoad.apply(this, arguments);
    cache = null;
    lastSpot = "";
  };

  const _DataManager_setupNewGame = DataManager.setupNewGame;
  DataManager.setupNewGame = function() {
    _DataManager_setupNewGame.apply(this, arguments);
    cache = null;
    lastSpot = "";
  };

  // ---------------------------------------------------------------------------
  // マスの見え方
  // ---------------------------------------------------------------------------
  const hidden = () => (window.Hai && Hai.HiddenPassage) || null;
  const thoughtsApi = () => (window.Hai && Hai.Thoughts) || null;
  const defeatApi = () => (window.Hai && Hai.Defeat) || null;

  function isWallTileAt(x, y) {
    for (let z = 0; z < 4; z++) {
      const t = $gameMap.tileId(x, y, z);
      if (Tilemap.isWallTile(t) || Tilemap.isRoofTile(t)) return true;
    }
    return false;
  }

  /** 今のマップの (x, y) の描き方："none"（未踏）・"floor"・"wall"・"hidden"。 */
  function cellKind(x, y) {
    const c = currentRecord();
    if (!c || x < 0 || y < 0 || x >= c.w || y >= c.h || !c.bits[y * c.w + x]) return "none";
    const region = $gameMap.regionId(x, y);
    if (region >= HIDDEN_FIRST && region <= HIDDEN_LAST) {
      const hp = hidden();
      if (hp && hp.isFound(x, y)) return "hidden";
      if (region !== STAIRS) return "wall"; // 見つけるまでは壁に見せる
    }
    if (isWallTileAt(x, y)) return "wall";
    return [2, 4, 6, 8].some(d => $gameMap.isPassable(x, y, d)) ? "floor" : "wall";
  }

  /** 今のマップの印（通ったマスにあるものだけ。落とした魔石はいつも）。 */
  function marks() {
    const mapId = $gameMap.mapId();
    const visited = (x, y) => cellKind(x, y) !== "none";
    const out = [];
    const th = thoughtsApi();
    if (th) {
      for (const t of th.thoughts(mapId)) {
        if (visited(t.x, t.y)) out.push({ type: t.read ? "read" : "unread", x: t.x, y: t.y, id: t.id });
      }
    }
    for (const ev of $gameMap.events()) {
      const data = ev.event();
      if (!data || !data.meta || data.meta.hai_locked === undefined) continue;
      if (!visited(data.x, data.y)) continue;
      const open = $gameSelfSwitches.value([mapId, ev.eventId(), "A"]);
      out.push({ type: open ? "doorOpen" : "door", x: data.x, y: data.y });
    }
    const df = defeatApi();
    if (df) {
      const drops = typeof df.drops === "function" ? df.drops() : [typeof df.drop === "function" ? df.drop() : null];
      for (const d of drops) if (d && d.mapId === mapId) out.push({ type: "drop", x: d.x, y: d.y });
    }
    return out;
  }

  /** 見つけた隠し通路の数（となり合うマスは 1 本と数える）。 */
  function foundPassages(mapId) {
    const hp = hidden();
    if (!hp) return 0;
    const left = new Set(hp.found(mapId).map(f => `${f.x},${f.y}`));
    let count = 0;
    for (const start of [...left]) {
      if (!left.has(start)) continue;
      count++;
      const stack = [start];
      left.delete(start);
      while (stack.length) {
        const [x, y] = stack.pop().split(",").map(Number);
        for (const k of [`${x + 1},${y}`, `${x - 1},${y}`, `${x},${y + 1}`, `${x},${y - 1}`]) {
          if (left.delete(k)) stack.push(k);
        }
      }
    }
    return count;
  }

  function mapName(mapId) {
    if (mapId === $gameMap.mapId() && $gameMap.displayName()) return $gameMap.displayName();
    const rec = state()[mapId];
    if (rec && rec.n) return rec.n;
    const info = $dataMapInfos[mapId];
    return info ? info.name : String(mapId);
  }

  // ---------------------------------------------------------------------------
  // 地図の画面
  // ---------------------------------------------------------------------------
  class Window_HaiAutoMapHeader extends Window_Base {
    refresh(name, unread, found) {
      this.contents.clear();
      const w = this.innerWidth;
      this.resetTextColor();
      this.drawText(name, 0, 0, w / 2);
      const right = `未読の思念 ${unread}　　見つけた隠し通路 ${found}`;
      this.drawText(right, w / 2, 0, w / 2, "right");
    }
  }

  class Window_HaiAutoMapLegend extends Window_Base {
    refresh() {
      this.contents.clear();
      const items = [
        ["floor", "床"], ["wall", "壁"], ["hidden", "隠し通路"], ["unread", "思念（未読）"],
        ["read", "思念（既読）"], ["door", "施錠扉"], ["drop", "魔石"], ["player", "現在地"],
      ];
      const lh = this.lineHeight();
      const step = this.innerWidth / items.length;
      this.contents.fontSize = 20;
      items.forEach(([key, label], i) => {
        const x = Math.floor(i * step);
        drawMark(this.contents, key, x + 4, (lh - 16) / 2, 16);
        this.resetTextColor();
        this.drawText(label, x + 26, 0, step - 28);
      });
      this.resetFontSettings();
    }
  }

  function drawMark(bitmap, type, x, y, s) {
    const cx = x + s / 2;
    const cy = y + s / 2;
    switch (type) {
      case "floor":
      case "wall":
      case "hidden":
        bitmap.fillRect(x, y, s, s, COLORS[type]);
        break;
      case "unread":
      case "read":
        bitmap.drawCircle(cx, cy, Math.max(1, s * 0.38), COLORS[type]);
        break;
      case "door":
      case "doorOpen": {
        const m = Math.max(1, Math.round(s * 0.18));
        bitmap.fillRect(x + m, y + m, s - m * 2, s - m * 2, COLORS[type]);
        const k = Math.max(1, Math.round(s * 0.16));
        bitmap.fillRect(cx - k / 2, cy - k, k, k * 2, "#1a1a1a"); // 鍵穴
        break;
      }
      case "drop": {
        const ctx = bitmap.context;
        ctx.save();
        ctx.fillStyle = COLORS.drop;
        ctx.beginPath();
        ctx.moveTo(cx, y);
        ctx.lineTo(x + s, cy);
        ctx.lineTo(cx, y + s);
        ctx.lineTo(x, cy);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        bitmap._baseTexture.update();
        break;
      }
      case "player":
        bitmap.drawCircle(cx, cy, Math.max(1.5, s * 0.42), COLORS.player);
        break;
    }
  }

  class Scene_HaiAutoMap extends Scene_MenuBase {
    create() {
      super.create();
      const mapId = $gameMap.mapId();
      const th = thoughtsApi();
      const top = this.mainAreaTop(); // ボタンの段の下
      const lineH = this.calcWindowHeight(1, false);
      this._header = new Window_HaiAutoMapHeader(new Rectangle(0, top, Graphics.boxWidth, lineH));
      this._header.refresh(
        mapName(mapId),
        th ? th.unreadCount(mapId) : 0,
        foundPassages(mapId)
      );
      this.addWindow(this._header);
      this._legend = new Window_HaiAutoMapLegend(new Rectangle(0, Graphics.boxHeight - lineH, Graphics.boxWidth, lineH));
      this._legend.refresh();
      this.addWindow(this._legend);
      this.createMap(top + lineH, Graphics.boxHeight - lineH);
    }

    createMap(areaTop, areaBottom) {
      const c = currentRecord();
      const w = c ? c.w : 1;
      const h = c ? c.h : 1;
      const pad = 12;
      const availW = Graphics.boxWidth - pad * 4;
      const availH = areaBottom - areaTop - pad * 4;
      const tile = Math.max(2, Math.min(maxTile, Math.floor(Math.min(availW / w, availH / h))));
      const mw = w * tile;
      const mh = h * tile;
      const ox = Math.floor((Graphics.width - mw) / 2);
      const oy = Math.floor(areaTop + (Graphics.height - Graphics.boxHeight) / 2 + (areaBottom - areaTop - mh) / 2);
      this._layout = { tile, x: ox, y: oy, width: mw, height: mh, mapWidth: w, mapHeight: h };

      const panel = new Sprite(new Bitmap(mw + pad * 2, mh + pad * 2));
      panel.bitmap.fillAll(COLORS.frame);
      panel.bitmap.fillRect(2, 2, mw + pad * 2 - 4, mh + pad * 2 - 4, COLORS.panel);
      panel.x = ox - pad;
      panel.y = oy - pad;
      this.addChild(panel);

      const sprite = new Sprite(new Bitmap(mw, mh));
      sprite.x = ox;
      sprite.y = oy;
      const gap = tile >= 8 ? 1 : 0;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const kind = cellKind(x, y);
          if (kind !== "none") sprite.bitmap.fillRect(x * tile, y * tile, tile - gap, tile - gap, COLORS[kind]);
        }
      }
      for (const m of marks()) drawMark(sprite.bitmap, m.type, m.x * tile, m.y * tile, tile - gap);
      this.addChild(sprite);
      this._mapSprite = sprite;

      const player = new Sprite(new Bitmap(tile, tile));
      drawMark(player.bitmap, "player", 0, 0, tile - gap);
      player.x = ox + $gamePlayer.x * tile;
      player.y = oy + $gamePlayer.y * tile;
      this.addChild(player);
      this._playerSprite = player;
      this._blink = 0;
    }

    update() {
      super.update();
      this._blink = (this._blink + 1) % 40;
      this._playerSprite.opacity = this._blink < 26 ? 255 : 60;
      if (Input.isTriggered("cancel") || Input.isTriggered(INPUT_NAME) || TouchInput.isCancelled()) {
        SoundManager.playCancel();
        this.popScene();
      }
    }

    /** テスト用：縮尺と置き場所。 */
    layout() {
      return { ...this._layout };
    }
  }
  window.Scene_HaiAutoMap = Scene_HaiAutoMap;

  // マップでキーを押すと開く（メニューと同じ条件：メニュー禁止・イベント中は開かない。歩き終えてから）
  const _Scene_Map_updateScene = Scene_Map.prototype.updateScene;
  Scene_Map.prototype.updateScene = function() {
    _Scene_Map_updateScene.apply(this, arguments);
    if (SceneManager.isSceneChanging()) return;
    if (this.isMenuEnabled()) {
      if (Input.isTriggered(INPUT_NAME)) this._haiMapCalling = true;
      if (this._haiMapCalling && !$gamePlayer.isMoving()) {
        this._haiMapCalling = false;
        SoundManager.playOk();
        SceneManager.push(Scene_HaiAutoMap);
      }
    } else {
      this._haiMapCalling = false;
    }
  };

  // メニューの「地図」（既定の並びは変えず、独自コマンドの所に足す）
  const _Window_MenuCommand_addOriginalCommands = Window_MenuCommand.prototype.addOriginalCommands;
  Window_MenuCommand.prototype.addOriginalCommands = function() {
    _Window_MenuCommand_addOriginalCommands.apply(this, arguments);
    if (menuText) this.addCommand(menuText, "haiMap", $gameMap.mapId() > 0);
  };

  const _Scene_Menu_createCommandWindow = Scene_Menu.prototype.createCommandWindow;
  Scene_Menu.prototype.createCommandWindow = function() {
    _Scene_Menu_createCommandWindow.apply(this, arguments);
    this._commandWindow.setHandler("haiMap", () => SceneManager.push(Scene_HaiAutoMap));
  };

  // ---------------------------------------------------------------------------
  // 窓口
  // ---------------------------------------------------------------------------
  const idOr = mapId => (mapId === undefined ? $gameMap.mapId() : Number(mapId));

  window.Hai = window.Hai || {};
  Hai.AutoMap = {
    COLORS,
    /** 通ったマスの一覧 [{ x, y }]（省略で今のマップ）。記録の無いマップは []。 */
    visited(mapId) {
      const b = bitsOf(idOr(mapId));
      const out = [];
      if (b) for (let i = 0; i < b.bits.length; i++) if (b.bits[i]) out.push({ x: i % b.w, y: Math.floor(i / b.w) });
      return out;
    },
    visitedCount(mapId) {
      const b = bitsOf(idOr(mapId));
      return b ? b.bits.reduce((n, v) => n + v, 0) : 0;
    },
    isVisited(x, y, mapId) {
      const b = bitsOf(idOr(mapId));
      return !!b && x >= 0 && y >= 0 && x < b.w && y < b.h && !!b.bits[y * b.w + x];
    },
    /** そのマスを通ったことにする（テスト用。今のマップだけ）。新しく記録したら true。 */
    markVisited(mapId, x, y) {
      if (Number(mapId) !== $gameMap.mapId()) return false;
      return setCells([[Number(x), Number(y)]]) > 0;
    },
    /** 記録のあるマップ（訪れたマップ）を全部、隅まで通ったことにする（P13 の見張り台の全図）。埋めたマップの数。 */
    revealVisited() {
      const all = state();
      const ids = Object.keys(all).filter(id => all[id] && all[id].w > 0 && all[id].h > 0);
      for (const id of ids) all[id].v = encode(new Uint8Array(all[id].w * all[id].h).fill(1));
      cache = null;
      return ids.length;
    },
    /** 記録を消す（省略で今のマップ）。 */
    clear(mapId) {
      delete state()[idOr(mapId)];
      cache = null;
      lastSpot = "";
    },
    /** マップの表示名（訪れたマップは覚えた表示名、無ければエディタの名前）。 */
    mapName(mapId) {
      return mapName(idOr(mapId));
    },
    /** 今のマップの (x, y) の描き方。"none"・"floor"・"wall"・"hidden"。 */
    cellKind,
    /** 今のマップの印 [{ type: "unread"|"read"|"door"|"doorOpen"|"drop", x, y }]。 */
    marks,
    /** 見つけた隠し通路の数（となり合うマスは 1 本。省略で今のマップ）。 */
    foundPassages(mapId) {
      return foundPassages(idOr(mapId));
    },
    /** 地図の画面を開く。 */
    open() {
      SceneManager.push(Scene_HaiAutoMap);
    },
  };
})();
