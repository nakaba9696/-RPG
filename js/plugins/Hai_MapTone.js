/*:
 * @target MZ
 * @plugindesc マップごとの色調・遠景・暗がりを、マップのメモ欄で指定する。
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
 */
(() => {
  "use strict";
  const pluginName = "Hai_MapTone";
  const params = PluginManager.parameters(pluginName);
  const darkOpacity = Number(params.darkOpacity || 230);
  const darkSoftness = Number(params.darkSoftness ?? 45);
  // 暗がりの絵を何分の 1 の大きさで描くか（拡大しても縁はなめらかなので、小さく描いて軽くする）
  const DARK_SCALE = 4;

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

  function state() {
    $gameSystem._hai = $gameSystem._hai || {};
    $gameSystem._hai.mapTone = $gameSystem._hai.mapTone || { applied: null };
    return $gameSystem._hai.mapTone;
  }

  const sameTone = (a, b) => !!a && !!b && a.length === b.length && a.every((v, i) => v === b[i]);

  /** 今のマップのメモ欄の色調を掛ける（場所移動のたびに Game_Map.setup から呼ぶ）。 */
  function applyMapTone() {
    const st = state();
    const tone = parseTone($dataMap && $dataMap.meta);
    if (tone) {
      $gameScreen.startTint(tone, 0);
      st.applied = tone.slice();
    } else if (st.applied) {
      // このプラグインが掛けた色調のままなら戻す。イベントで変えられていたら触らない。
      if (sameTone($gameScreen._toneTarget, st.applied)) $gameScreen.startTint([0, 0, 0, 0], 0);
      st.applied = null;
    }
  }

  window.Hai = window.Hai || {};
  Hai.MapTone = {
    parseTone,
    parseParallax,
    parseDark,
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
    params: { darkOpacity, darkSoftness },
  };

  PluginManager.registerCommand(pluginName, "dark", args => {
    $gameMap._haiDarkRadius = Math.max(0, Number(args.radius) || 0);
  });
  PluginManager.registerCommand(pluginName, "darkReset", () => {
    $gameMap._haiDarkRadius = null;
  });

  // --- 色調と暗がりの上書きは、マップに入るたび（Game_Map.setup）に決める ---
  const _Game_Map_setup = Game_Map.prototype.setup;
  Game_Map.prototype.setup = function() {
    _Game_Map_setup.apply(this, arguments);
    this._haiDarkRadius = null;
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

  // 天気の上、ピクチャ・タイマーの下に置く。色調（_baseSprite のフィルター）は掛からない。
  const _Spriteset_Map_createLowerLayer = Spriteset_Map.prototype.createLowerLayer;
  Spriteset_Map.prototype.createLowerLayer = function() {
    _Spriteset_Map_createLowerLayer.apply(this, arguments);
    this._haiDarkSprite = new Sprite_HaiDark();
    this.addChild(this._haiDarkSprite);
  };
})();
