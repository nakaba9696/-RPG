/*:
 * @target MZ
 * @plugindesc マップごとの色調・遠景・暗がり・霧・降る灰を、マップのメモ欄で指定する。
 * @author 灰の王国
 * @help
 * マップのメモ欄（マップの設定の「メモ」）に書く。どれも省略できる。
 *
 *   <hai_tone:-68,-68,-34,68>
 *     画面の色調（赤, 緑, 青, グレー）。赤・緑・青は -255〜255、グレーは 0〜255。
 *     場所移動でこのマップに入ったとき、フェードの間に即時で掛かる（色が変わっていく様子は見せない）。
 *     タグの無いマップに移ると、このプラグインが掛けた色調は元に戻る
 *     （イベントの「画面の色調変更」で変えた色調はそのまま残る）。
 *
 *   <hai_parallax:DarkClouds,1,0>
 *     遠景（img/parallaxes の名前, 横の流れ, 縦の流れ）。流れが 0 でない向きはループする。
 *     マップの設定の遠景より、こちらが優先。
 *
 *   <hai_dark:4>  または  <hai_dark:4,230>
 *     暗がり。プレイヤーの周り（半径 4 マス）だけ明るく、外は黒く覆う。2 つ目は外の濃さ（0〜255。省略でパラメータの値）。
 *     ピクチャ・タイマー・ウィンドウは覆わない。戦闘の画面には掛からない。
 *
 *   <hai_fog:110>  または  <hai_fog:110,0.4,0.1>
 *     霧。画面全体に白い霧の層を重ねる。1 つ目は濃さ（0〜255）、2・3 つ目は横・縦に流れる速さ（1 フレームの画素。省略で 0.3,0.05）。
 *     霧は地図に付いて動き（プレイヤーが歩くと霧の中を進んで見える）、ゆっくり流れる。色調が掛かる（暗い色調なら灰色の霧）。
 *     絵は使わない（プラグインが描く）。
 *
 *   <hai_ash:4>
 *     降る灰。灰色の粒がゆっくり舞い落ちる（強さ 1〜9。数が増える）。天候（雨・雪）とは別に重ねられる。絵は使わない。
 *
 * 門叩きの縄張り（world.md 3.7）：3 つ目の鐘のあと、まだ鳴っていない最後の地域の色調が暗くなり、霧が出る。
 *   プラグインコマンド「lair」で地域（west・south・east）を指定すると、その地域のマップ（パラメータ「縄張りの地域」）に入ったとき
 *   メモ欄の色調に「縄張りの色調の差」を足し、霧の濃さに「縄張りの霧」を足す（霧の無いマップにも薄い霧が出る）。
 *   地域は $gameSystem に持つ（セーブに入る）。「lairReset」で戻す（4 つ目の鐘のあと）。マップのメモ欄は書き換えない。
 *
 * 灰を止める（P14）：頂の三十のあと、プラグインコマンド「灰を止める」（stopAsh）で、どのマップの <hai_ash> も降らなくなる
 *   （$gameSystem に持つのでセーブに入る。「ash」で変えた強さも無視する）。パラメータ「灰が止むスイッチ」が ON の間も同じ。
 *
 * 暗がりは、画面の 1/4 の大きさの絵（中心が透明な黒）を 1 回だけ描き、4 倍に拡大してプレイヤーに付いて動かす。
 * 毎フレームの描き直しはしない（半径・濃さ・画面の大きさが変わったときだけ描き直す）。
 *
 * @param darkOpacity
 * @text 暗がりの濃さ（既定）
 * @desc <hai_dark> の 2 つ目を省いたときの、明るい輪の外の黒さ（0〜255）。
 * @type number
 * @min 0
 * @max 255
 * @default 230
 *
 * @param darkSoftness
 * @text 明るい輪のぼかし（%）
 * @desc 半径のうち、外側の何 % をぼかすか（0 でくっきり、100 で中心から徐々に暗く）。
 * @type number
 * @min 0
 * @max 100
 * @default 45
 *
 * @param lairAreas
 * @text 縄張りの地域
 * @desc 地域の名前とマップ ID の範囲。「名前:始め-終わり,…」を ; で区切る（docs/look.md 3.4）。
 * @type string
 * @default west:60-64,80-84,110-124;south:70-74,100-105;east:50-54,90-94
 *
 * @param lairTone
 * @text 縄張りの色調の差
 * @desc 縄張りになった地域のマップで、メモ欄の色調に足す値（赤, 緑, 青, グレー）。
 * @type string
 * @default -51,-51,-34,51
 *
 * @param lairFog
 * @text 縄張りの霧
 * @desc 縄張りになった地域のマップで、霧の濃さに足す値（0〜255）。0 で霧は足さない。
 * @type number
 * @min 0
 * @max 255
 * @default 50
 *
 * @param ashStopSwitch
 * @text 灰が止むスイッチ
 * @desc ON の間、どのマップの <hai_ash> も降らない（朝の砦。0 で使わない）。
 * @type switch
 * @default 1165
 *
 * @command dark
 * @text 暗がりの半径を変える
 * @desc 今いるマップの暗がりの半径を変える（灯りを拾ったときなど）。マップを出ると、メモ欄の値に戻る。
 *
 * @arg radius
 * @text 半径（マス）
 * @desc 0 で暗がりを消す。
 * @type number
 * @decimals 1
 * @min 0
 * @default 4
 *
 * @command darkReset
 * @text 暗がりをメモ欄の値に戻す
 *
 * @command fog
 * @text 霧の濃さを変える
 * @desc 今いるマップの霧の濃さを変える（小鐘を鳴らして霧が引くときなど）。1 秒ほどで移る。マップを出ると、メモ欄の値に戻る。
 *
 * @arg density
 * @text 濃さ（0〜255）
 * @desc 0 で霧を消す。
 * @type number
 * @min 0
 * @max 255
 * @default 0
 *
 * @command fogReset
 * @text 霧をメモ欄の値に戻す
 *
 * @command ash
 * @text 降る灰の強さを変える
 * @desc 今いるマップの降る灰の強さを変える（鐘を鳴らした数で灰を薄くするときなど）。マップを出ると、メモ欄の値に戻る。
 *
 * @arg power
 * @text 強さ（0〜9）
 * @desc 0 で灰を止める。
 * @type number
 * @min 0
 * @max 9
 * @default 0
 *
 * @command ashReset
 * @text 降る灰をメモ欄の値に戻す
 *
 * @command stopAsh
 * @text 灰を止める
 * @desc 頂の三十のあと。これから先、どのマップの <hai_ash> も降らない（セーブに入る）。
 *
 * @command resumeAsh
 * @text 灰を戻す
 * @desc 「灰を止める」を取り消す（試し用）。
 *
 * @command lair
 * @text 縄張りの地域を決める
 * @desc 門叩きが縄張りを広げた地域（3 つ目の鐘のあと、まだ鳴っていない地域）。その地域のマップの色調が暗くなり、霧が出る。
 *
 * @arg area
 * @text 地域
 * @desc パラメータ「縄張りの地域」の名前（west＝西の谷と麦の街道、south＝南の水、east＝東の山）。
 * @type select
 * @option west
 * @option south
 * @option east
 * @default west
 *
 * @command lairReset
 * @text 縄張りを消す
 * @desc 4 つ目の鐘を鳴らして門叩きが退いたとき。地域の色調と霧が元に戻る。
 */
(() => {
  "use strict";
  const pluginName = "Hai_MapTone";
  const params = PluginManager.parameters(pluginName);
  const darkOpacity = Number(params.darkOpacity || 230);
  const darkSoftness = Number(params.darkSoftness ?? 45);
  // 暗がりの絵を何分の 1 の大きさで描くか（拡大しても縁はなめらかなので、小さく描いて軽くする）
  const DARK_SCALE = 4;
  // 霧の流れの既定（1 フレームの画素）、霧の絵の大きさ、灰の粒の数（強さ 1 あたり）
  const FOG_SX = 0.3;
  const FOG_SY = 0.05;
  const FOG_SIZE = 384;
  const ASH_PER_POWER = 10;
  // 縄張り（門叩き）の地域と、足す色調・霧
  const lairAreas = parseAreas(params.lairAreas ?? "west:60-64,80-84,110-124;south:70-74,100-105;east:50-54,90-94");
  const lairTone = String(params.lairTone || "-51,-51,-34,51")
    .split(",")
    .map(s => Number(s.trim()) || 0);
  const lairFog = Number(params.lairFog ?? 50);
  const ashStopSwitch = Number(params.ashStopSwitch ?? 1165);

  /** 「名前:始め-終わり,…;…」→ { 名前: [[始め, 終わり], …] } */
  function parseAreas(text) {
    const out = {};
    for (const part of String(text).split(";")) {
      const [name, ranges] = part.split(":").map(s => (s || "").trim());
      if (!name || !ranges) continue;
      out[name] = ranges.split(",").map(r => {
        const [a, b] = r.split("-").map(Number);
        return [a, Number.isFinite(b) ? b : a];
      });
    }
    return out;
  }

  function numbers(text) {
    return String(text)
      .split(",")
      .map(s => Number(s.trim()));
  }

  /** メモ欄のタグを読む。無ければ null。 */
  function parseTone(meta) {
    if (!meta || typeof meta.hai_tone !== "string") return null;
    const [r, g, b, gray] = numbers(meta.hai_tone);
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : 0));
    return [clamp(r, -255, 255), clamp(g, -255, 255), clamp(b, -255, 255), clamp(gray, 0, 255)];
  }

  function parseParallax(meta) {
    if (!meta || typeof meta.hai_parallax !== "string") return null;
    const [name, sx, sy] = meta.hai_parallax.split(",").map(s => s.trim());
    return { name: name || "", sx: Number(sx) || 0, sy: Number(sy) || 0 };
  }

  function parseDark(meta) {
    if (!meta || meta.hai_dark === undefined) return null;
    const [radius, opacity] = meta.hai_dark === true ? [4] : numbers(meta.hai_dark);
    if (!(radius > 0)) return null;
    return { radius, opacity: Number.isFinite(opacity) ? Math.max(0, Math.min(255, opacity)) : darkOpacity };
  }

  function parseFog(meta) {
    if (!meta || meta.hai_fog === undefined) return null;
    const [density, sx, sy] = meta.hai_fog === true ? [96] : numbers(meta.hai_fog);
    if (!(density > 0)) return null;
    return {
      density: Math.min(255, density),
      sx: Number.isFinite(sx) ? sx : FOG_SX,
      sy: Number.isFinite(sy) ? sy : FOG_SY,
    };
  }

  function parseAsh(meta) {
    if (!meta || meta.hai_ash === undefined) return null;
    const [power] = meta.hai_ash === true ? [4] : numbers(meta.hai_ash);
    if (!(power > 0)) return null;
    return { power: Math.min(9, Math.round(power)) || 1 };
  }

  function state() {
    $gameSystem._hai = $gameSystem._hai || {};
    $gameSystem._hai.mapTone = $gameSystem._hai.mapTone || { applied: null };
    return $gameSystem._hai.mapTone;
  }

  const sameTone = (a, b) => !!a && !!b && a.length === b.length && a.every((v, i) => v === b[i]);

  /** マップ ID の地域の名前（パラメータ「縄張りの地域」。どこにも入らなければ null）。 */
  function areaOf(mapId) {
    for (const [name, ranges] of Object.entries(lairAreas)) {
      if (ranges.some(([a, b]) => mapId >= a && mapId <= b)) return name;
    }
    return null;
  }

  /** 今のマップが縄張りになった地域なら、その地域の名前（でなければ null）。 */
  function lairHere() {
    const lair = state().lair;
    return lair && $gameMap && areaOf($gameMap.mapId()) === lair ? lair : null;
  }

  /** 今のマップの色調（メモ欄＋縄張りの差）。無ければ null。 */
  function mapTone() {
    const tone = parseTone($dataMap && $dataMap.meta);
    if (!lairHere()) return tone;
    const base = tone || [0, 0, 0, 0];
    return base.map((v, i) => Math.max(i === 3 ? 0 : -255, Math.min(255, v + (lairTone[i] || 0))));
  }

  /** 今のマップのメモ欄の色調を掛ける（場所移動のたびに Game_Map.setup から呼ぶ。縄張りが変わった時は duration で移る）。 */
  function applyMapTone(duration = 0) {
    const st = state();
    const tone = mapTone();
    if (tone) {
      $gameScreen.startTint(tone, duration);
      st.applied = tone.slice();
    } else if (st.applied) {
      // このプラグインが掛けた色調のままなら戻す。イベントで変えられていたら触らない。
      if (sameTone($gameScreen._toneTarget, st.applied)) $gameScreen.startTint([0, 0, 0, 0], duration);
      st.applied = null;
    }
  }

  /** 灰が止んだか（P14）。 */
  function isAshStopped() {
    if (!$gameSystem) return false;
    return !!state().ashStopped || (ashStopSwitch > 0 && !!$gameSwitches && $gameSwitches.value(ashStopSwitch));
  }

  window.Hai = window.Hai || {};
  Hai.MapTone = {
    parseTone,
    parseParallax,
    parseDark,
    parseFog,
    parseAsh,
    /** 今のマップの霧 { density, sx, sy }（無ければ null）。プラグインコマンドで変えた濃さを含む。 */
    fog() {
      if (!$gameMap || !$dataMap) return null;
      let base = parseFog($dataMap.meta);
      if (lairFog > 0 && lairHere()) {
        base = { density: Math.min(255, (base ? base.density : 0) + lairFog), sx: base ? base.sx : FOG_SX, sy: base ? base.sy : FOG_SY };
      }
      const override = $gameMap._haiFogDensity;
      if (override === undefined || override === null) return base;
      if (!(override > 0)) return null;
      return { density: Math.min(255, override), sx: base ? base.sx : FOG_SX, sy: base ? base.sy : FOG_SY };
    },
    /** 今のマップの降る灰 { power }（無ければ null）。プラグインコマンドで変えた強さを含む。 */
    ash() {
      if (!$gameMap || !$dataMap || isAshStopped()) return null;
      const override = $gameMap._haiAshPower;
      if (override === undefined || override === null) return parseAsh($dataMap.meta);
      return override > 0 ? { power: override } : null;
    },
    /** 今のマップの暗がり { radius, opacity }（無ければ null）。プラグインコマンドで変えた値を含む。 */
    dark() {
      if (!$gameMap || !$dataMap) return null;
      const base = parseDark($dataMap.meta);
      const override = $gameMap._haiDarkRadius;
      if (override === undefined || override === null) return base;
      if (!(override > 0)) return null;
      return { radius: override, opacity: base ? base.opacity : darkOpacity };
    },
    /** このプラグインが今掛けている色調（無ければ null）。 */
    appliedTone() {
      return state().applied ? state().applied.slice() : null;
    },
    areaOf,
    /** 縄張りになった地域の名前（lair コマンドで決めた値。無ければ null）。 */
    lair() {
      return $gameSystem ? state().lair || null : null;
    },
    /** 今のマップが縄張りになった地域か（色調と霧が足されているか）。 */
    lairHere: () => !!lairHere(),
    /** 灰が止んだか（「灰を止める」のあとか、灰が止むスイッチが ON）。 */
    isAshStopped: () => isAshStopped(),
    params: { darkOpacity, darkSoftness, lairAreas, lairTone, lairFog, ashStopSwitch },
  };

  PluginManager.registerCommand(pluginName, "dark", args => {
    $gameMap._haiDarkRadius = Math.max(0, Number(args.radius) || 0);
  });
  PluginManager.registerCommand(pluginName, "darkReset", () => {
    $gameMap._haiDarkRadius = null;
  });
  PluginManager.registerCommand(pluginName, "fog", args => {
    $gameMap._haiFogDensity = Math.max(0, Math.min(255, Number(args.density) || 0));
  });
  PluginManager.registerCommand(pluginName, "fogReset", () => {
    $gameMap._haiFogDensity = null;
  });
  PluginManager.registerCommand(pluginName, "ash", args => {
    $gameMap._haiAshPower = Math.max(0, Math.min(9, Math.round(Number(args.power) || 0)));
  });
  PluginManager.registerCommand(pluginName, "ashReset", () => {
    $gameMap._haiAshPower = null;
  });
  PluginManager.registerCommand(pluginName, "stopAsh", () => {
    state().ashStopped = true;
  });
  PluginManager.registerCommand(pluginName, "resumeAsh", () => {
    delete state().ashStopped;
  });
  PluginManager.registerCommand(pluginName, "lair", args => {
    const area = String(args.area || "").trim();
    state().lair = lairAreas[area] ? area : null;
    applyMapTone(60); // 今いるマップが縄張りになったら、1 秒で暗くなる
  });
  PluginManager.registerCommand(pluginName, "lairReset", () => {
    state().lair = null;
    applyMapTone(60);
  });

  // --- 色調と暗がりの上書きは、マップに入るたび（Game_Map.setup）に決める ---
  const _Game_Map_setup = Game_Map.prototype.setup;
  Game_Map.prototype.setup = function() {
    _Game_Map_setup.apply(this, arguments);
    this._haiDarkRadius = null;
    this._haiFogDensity = null;
    this._haiAshPower = null;
    applyMapTone();
  };

  // --- 遠景 ---
  const _Game_Map_setupParallax = Game_Map.prototype.setupParallax;
  Game_Map.prototype.setupParallax = function() {
    _Game_Map_setupParallax.apply(this, arguments);
    const p = parseParallax($dataMap.meta);
    if (p) {
      this._parallaxName = p.name;
      this._parallaxZero = ImageManager.isZeroParallax(p.name);
      this._parallaxLoopX = p.sx !== 0;
      this._parallaxLoopY = p.sy !== 0;
      this._parallaxSx = p.sx;
      this._parallaxSy = p.sy;
    }
  };

  // --- 暗がり ---
  class Sprite_HaiDark extends Sprite {
    constructor() {
      super();
      this.anchor.set(0.5, 0.5);
      this.scale.set(DARK_SCALE, DARK_SCALE);
      this._key = "";
      this.visible = false;
    }

    update() {
      super.update();
      const dark = Hai.MapTone.dark();
      this.visible = !!dark;
      if (!dark) return;
      this.redrawIfNeeded(dark);
      this.x = Math.round($gamePlayer.screenX());
      this.y = Math.round($gamePlayer.screenY() - $gameMap.tileHeight() / 2);
    }

    redrawIfNeeded(dark) {
      const w = Graphics.width;
      const h = Graphics.height;
      const tile = $gameMap.tileWidth();
      const key = [dark.radius, dark.opacity, w, h, tile, darkSoftness].join(",");
      if (key === this._key) return;
      this._key = key;
      // 画面の 2 倍の大きさを覆う（プレイヤーが画面の端にいても外が全部黒い）を、1/DARK_SCALE で描く。
      const bw = Math.ceil((w * 2) / DARK_SCALE);
      const bh = Math.ceil((h * 2) / DARK_SCALE);
      if (!this.bitmap || this.bitmap.width !== bw || this.bitmap.height !== bh) {
        if (this.bitmap) this.bitmap.destroy();
        this.bitmap = new Bitmap(bw, bh);
      }
      const bitmap = this.bitmap;
      const ctx = bitmap.context;
      const outer = (dark.radius * tile) / DARK_SCALE;
      const inner = outer * (1 - darkSoftness / 100);
      const alpha = dark.opacity / 255;
      ctx.save();
      ctx.clearRect(0, 0, bw, bh);
      const g = ctx.createRadialGradient(bw / 2, bh / 2, inner, bw / 2, bh / 2, Math.max(outer, inner + 0.01));
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, `rgba(0,0,0,${alpha})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, bw, bh);
      ctx.restore();
      bitmap.baseTexture.update();
    }
  }
  Hai.MapTone.Sprite_HaiDark = Sprite_HaiDark;

  // --- 霧 ---
  /** 種付きの乱数（霧の絵を毎回同じにする）。 */
  function seeded(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  let fogBitmap = null;
  /** 継ぎ目なく並べられる霧の絵（白いぼかしの塊を、端で折り返して重ねる）。1 回だけ描く。 */
  function makeFogBitmap() {
    if (fogBitmap) return fogBitmap;
    const size = FOG_SIZE;
    const bitmap = new Bitmap(size, size);
    const ctx = bitmap.context;
    const rand = seeded(1129);
    for (let i = 0; i < 46; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const r = size * (0.08 + rand() * 0.16);
      const a = 0.18 + rand() * 0.3;
      for (const dx of [-size, 0, size]) {
        for (const dy of [-size, 0, size]) {
          const cx = x + dx;
          const cy = y + dy;
          if (cx + r < 0 || cy + r < 0 || cx - r > size || cy - r > size) continue;
          const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
          g.addColorStop(0, `rgba(255,255,255,${a})`);
          g.addColorStop(1, "rgba(255,255,255,0)");
          ctx.fillStyle = g;
          ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
        }
      }
    }
    bitmap.baseTexture.update();
    fogBitmap = bitmap;
    return bitmap;
  }

  /** 霧の層を 2 枚（近い霧と遠い霧）。地図のスクロールに付いて動き、ゆっくり流れる。濃さは 1 秒ほどで目標に寄る。 */
  class Sprite_HaiFog extends Sprite {
    constructor() {
      super();
      this._layers = [
        { sprite: new TilingSprite(makeFogBitmap()), scale: 1, follow: 1, drift: 1 },
        { sprite: new TilingSprite(makeFogBitmap()), scale: 2, follow: 0.6, drift: 0.5 },
      ];
      for (const l of this._layers) {
        l.sprite.scale.set(l.scale, l.scale);
        this.addChild(l.sprite);
      }
      this._time = 0;
      this._density = 0;
      this.visible = false;
      this.opacity = 0;
    }

    update() {
      super.update();
      const fog = Hai.MapTone.fog();
      const target = fog ? fog.density : 0;
      if (!this.visible && target > 0) this._density = target; // マップに入った時はすぐ濃くする
      this._density += Math.sign(target - this._density) * Math.min(Math.abs(target - this._density), 4);
      this.visible = this._density > 0;
      if (!this.visible) return;
      this.opacity = this._density;
      this._time++;
      const tw = $gameMap.tileWidth();
      const th = $gameMap.tileHeight();
      const sx = fog ? fog.sx : FOG_SX;
      const sy = fog ? fog.sy : FOG_SY;
      for (const l of this._layers) {
        l.sprite.move(0, 0, Math.ceil(Graphics.width / l.scale), Math.ceil(Graphics.height / l.scale));
        l.sprite.origin.x = ($gameMap.displayX() * tw * l.follow + this._time * sx * l.drift) / l.scale;
        l.sprite.origin.y = ($gameMap.displayY() * th * l.follow + this._time * sy * l.drift) / l.scale;
      }
    }
  }
  Hai.MapTone.Sprite_HaiFog = Sprite_HaiFog;

  // --- 降る灰 ---
  let ashBitmap = null;
  function makeAshBitmap() {
    if (ashBitmap) return ashBitmap;
    const bitmap = new Bitmap(6, 6);
    const ctx = bitmap.context;
    const g = ctx.createRadialGradient(3, 3, 0, 3, 3, 3);
    g.addColorStop(0, "rgba(200,196,190,1)");
    g.addColorStop(1, "rgba(150,146,140,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 6, 6);
    bitmap.baseTexture.update();
    ashBitmap = bitmap;
    return bitmap;
  }

  /** 灰色の粒がゆっくり落ち、左右に揺れる。地図のスクロールに付いて動く。 */
  class Sprite_HaiAsh extends Sprite {
    constructor() {
      super();
      this._rand = seeded(2203);
      this._lastDisplay = null;
      this.visible = false;
    }

    update() {
      super.update();
      const ash = Hai.MapTone.ash();
      const count = ash ? ash.power * ASH_PER_POWER : 0;
      this.visible = count > 0;
      while (this.children.length < count) this.addChild(this.newFlake(true));
      while (this.children.length > count) this.removeChildAt(this.children.length - 1);
      if (!this.visible) {
        this._lastDisplay = null;
        return;
      }
      const tw = $gameMap.tileWidth();
      const th = $gameMap.tileHeight();
      const display = [$gameMap.displayX() * tw, $gameMap.displayY() * th];
      const [dx, dy] = this._lastDisplay ? [display[0] - this._lastDisplay[0], display[1] - this._lastDisplay[1]] : [0, 0];
      this._lastDisplay = display;
      const w = Graphics.width;
      const h = Graphics.height;
      for (const f of this.children) {
        f._phase += f._sway;
        f.x += f._vx + Math.sin(f._phase) * 0.4 - dx;
        f.y += f._vy - dy;
        if (f.y > h + 8 || f.x < -16 || f.x > w + 16 || f.y < -16) this.resetFlake(f, false);
      }
    }

    newFlake(anywhere) {
      const f = new Sprite(makeAshBitmap());
      f.anchor.set(0.5, 0.5);
      this.resetFlake(f, anywhere);
      return f;
    }

    resetFlake(f, anywhere) {
      const r = this._rand;
      f.x = r() * (Graphics.width + 32) - 16;
      f.y = anywhere ? r() * Graphics.height : -8;
      f._vx = -0.15 + r() * 0.3;
      f._vy = 0.35 + r() * 0.5;
      f._phase = r() * Math.PI * 2;
      f._sway = 0.01 + r() * 0.03;
      const s = 0.5 + r() * 0.8;
      f.scale.set(s, s);
      f.opacity = 120 + Math.floor(r() * 110);
    }
  }
  Hai.MapTone.Sprite_HaiAsh = Sprite_HaiAsh;

  // 霧は地図の上（_baseSprite の中なので色調が掛かる）。灰と暗がりは天気の上、ピクチャ・タイマーの下（色調は掛からない）。
  // 重なりの順：地図 → 霧 → 天気 → 灰 → 暗がり（灰は明るい輪の中でだけ見える）。
  const _Spriteset_Map_createLowerLayer = Spriteset_Map.prototype.createLowerLayer;
  Spriteset_Map.prototype.createLowerLayer = function() {
    _Spriteset_Map_createLowerLayer.apply(this, arguments);
    this._haiFogSprite = new Sprite_HaiFog();
    this._baseSprite.addChild(this._haiFogSprite);
    this._haiAshSprite = new Sprite_HaiAsh();
    this.addChild(this._haiAshSprite);
    this._haiDarkSprite = new Sprite_HaiDark();
    this.addChild(this._haiDarkSprite);
  };
})();
