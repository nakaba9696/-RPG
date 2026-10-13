/*:
 * @target MZ
 * @plugindesc 大きな数：頂の三十の数を、文章の窓でなく画面の上に大きく出す。
 * @author 灰の王国
 * @help
 * プラグインコマンド「大きな数を出す」（show）で、画面の上の真ん中に数（か短い文字）を大きく出す。
 * 頂の三十（場面表 04 の 5.7、P の表「三十の数の表示」）で、一回ごとに数を出すためのもの。
 * 鐘の効果音はイベントの「SE の演奏」で鳴らす（このプラグインは音を出さない）。
 *
 *   出す字（どれか一つ。上から優先）
 *     文字   ：そのまま出す（例「四。　五。　六。」）。
 *     変数   ：変数の値を漢数字に直し「。」を付ける（例 変数 1152 が 30 → 「三十。」）。
 *     数     ：数を漢数字に直し「。」を付ける（例 7 → 「七。」）。
 *   出す時間 ：フレーム数。0 は消すまで残す（次の「大きな数を出す」で入れ替わる）。
 *              0 より大きいと、その時間のあと消え方の時間で消える。
 *   完了まで待つ：ON で、現れ終わるまで（出す時間が 0 より大きいなら消え終わるまで）次の命令に進まない。
 *
 * プラグインコマンド「大きな数を消す」（hide）で、消え方の時間で消す（完了まで待つも選べる）。
 * 場所移動すると消える（移った先には持ち越さない）。メニューを開いて戻っても残る。
 *
 * 文字は文章の窓と同じ書体（$gameSystem.mainFontFace()）。位置は画面の幅と高さに対する割合で決めるので、
 * 画面の大きさが変わってもずれない。文章の窓・ピクチャより手前に出る。画面の色調は掛からない。
 *
 * テストやスクリプトからは Hai.BigCount.show(text, { duration, fadeIn, fadeOut }) / hide() / text() / isBusy() / kanji(n)。
 *
 * @param fontSize
 * @text 字の大きさ
 * @desc 画面の高さ 720 のときの字の大きさ（画素）。画面の高さに比例して変わる。
 * @type number
 * @min 12
 * @default 112
 *
 * @param positionY
 * @text 高さの位置（%）
 * @desc 字の中心の高さ。画面の高さに対する割合（0 で上の端、100 で下の端）。
 * @type number
 * @min 0
 * @max 100
 * @default 22
 *
 * @param textColor
 * @text 字の色
 * @type string
 * @default #ffffff
 *
 * @param outlineColor
 * @text 縁の色
 * @type string
 * @default rgba(0, 0, 0, 0.85)
 *
 * @param outlineWidth
 * @text 縁の太さ
 * @type number
 * @min 0
 * @default 10
 *
 * @param fadeIn
 * @text 現れ方の時間（既定）
 * @desc 現れるまでのフレーム数（コマンドで省いたとき）。
 * @type number
 * @min 0
 * @default 12
 *
 * @param fadeOut
 * @text 消え方の時間（既定）
 * @desc 消えるまでのフレーム数（コマンドで省いたとき）。
 * @type number
 * @min 0
 * @default 20
 *
 * @command show
 * @text 大きな数を出す
 * @desc 画面の上に数（か短い文字）を大きく出す。前の数は入れ替わる。
 *
 * @arg number
 * @text 数
 * @desc 漢数字に直し「。」を付けて出す（1〜99）。変数か文字を書いたときは使わない。
 * @type number
 * @min 0
 * @max 99
 * @default 0
 *
 * @arg variableId
 * @text 変数
 * @desc この変数の値を数として出す（0 で使わない）。
 * @type variable
 * @default 0
 *
 * @arg text
 * @text 文字
 * @desc 書けば、数・変数の代わりにこの文字をそのまま出す（例「四。　五。　六。」）。
 * @type string
 * @default
 *
 * @arg duration
 * @text 出す時間
 * @desc フレーム数。0 は消すまで残す（次の「大きな数を出す」で入れ替わる）。
 * @type number
 * @min 0
 * @default 0
 *
 * @arg fadeIn
 * @text 現れ方の時間
 * @desc フレーム数。空ならパラメータの値。
 * @type string
 * @default
 *
 * @arg fadeOut
 * @text 消え方の時間
 * @desc フレーム数。空ならパラメータの値。
 * @type string
 * @default
 *
 * @arg wait
 * @text 完了まで待つ
 * @desc 現れ終わるまで（出す時間があれば消え終わるまで）次の命令に進まない。
 * @type boolean
 * @default false
 *
 * @command hide
 * @text 大きな数を消す
 * @desc 出している数を消す。
 *
 * @arg fadeOut
 * @text 消え方の時間
 * @desc フレーム数。空ならパラメータの値。
 * @type string
 * @default
 *
 * @arg wait
 * @text 完了まで待つ
 * @type boolean
 * @default false
 */
(() => {
  "use strict";
  const pluginName = "Hai_BigCount";
  const params = PluginManager.parameters(pluginName);
  const BASE_HEIGHT = 720;
  const fontSize = Number(params.fontSize || 112);
  const positionY = Number(params.positionY === undefined || params.positionY === "" ? 22 : params.positionY) / 100;
  const textColor = String(params.textColor || "#ffffff");
  const outlineColor = String(params.outlineColor || "rgba(0, 0, 0, 0.85)");
  const outlineWidth = Number(params.outlineWidth === undefined || params.outlineWidth === "" ? 10 : params.outlineWidth);
  const defaultFadeIn = Number(params.fadeIn === undefined || params.fadeIn === "" ? 12 : params.fadeIn);
  const defaultFadeOut = Number(params.fadeOut === undefined || params.fadeOut === "" ? 20 : params.fadeOut);

  const DIGITS = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
  /** 1〜99 を漢数字に（10 → 十、30 → 三十、31 → 三十一）。範囲の外は算用数字のまま。 */
  const kanji = n => {
    n = Math.floor(Number(n));
    if (!(n >= 1 && n <= 99)) return String(n);
    const tens = Math.floor(n / 10);
    const ones = n % 10;
    return (tens === 0 ? "" : (tens === 1 ? "" : DIGITS[tens]) + "十") + DIGITS[ones];
  };

  const numberOr = (value, fallback) => (value === undefined || value === "" ? fallback : Math.max(0, Number(value) || 0));

  // ---------------------------------------------------------------- 状態（$gameTemp。セーブには入れない）
  /**
   * phase：in（現れる）→ show（出している）→ out（消える）→ none。
   * timer はその段の残りフレーム。duration 0 の show は timer を使わない（消すまで残す）。
   */
  const state = () => {
    if (!$gameTemp._haiBigCount) $gameTemp._haiBigCount = { text: "", phase: "none", timer: 0, fadeIn: 0, fadeOut: 0, duration: 0, serial: 0 };
    return $gameTemp._haiBigCount;
  };

  const show = (text, opts = {}) => {
    const s = state();
    s.text = String(text);
    s.fadeIn = numberOr(opts.fadeIn, defaultFadeIn);
    s.fadeOut = numberOr(opts.fadeOut, defaultFadeOut);
    s.duration = numberOr(opts.duration, 0);
    s.serial++;
    if (s.fadeIn > 0) {
      s.phase = "in";
      s.timer = s.fadeIn;
    } else {
      s.phase = "show";
      s.timer = s.duration;
    }
  };

  const hide = (fadeOut) => {
    const s = state();
    if (s.phase === "none") return;
    s.fadeOut = numberOr(fadeOut, defaultFadeOut);
    if (s.fadeOut > 0 && s.phase !== "out") {
      s.phase = "out";
      s.timer = s.fadeOut;
    } else if (s.fadeOut === 0) {
      clear();
    }
  };

  const clear = () => {
    const s = state();
    s.phase = "none";
    s.text = "";
    s.timer = 0;
  };

  /** 1 フレーム進める（Scene_Map の update から。メニューの間は進まない）。 */
  const update = () => {
    const s = state();
    if (s.phase === "none") return;
    if (s.phase === "show" && s.duration === 0) return;
    if (s.timer > 0) s.timer--;
    if (s.timer > 0) return;
    if (s.phase === "in") {
      s.phase = "show";
      s.timer = s.duration;
      if (s.duration > 0) return;
    } else if (s.phase === "show") {
      s.phase = "out";
      s.timer = s.fadeOut;
      if (s.fadeOut > 0) return;
      clear();
    } else if (s.phase === "out") {
      clear();
    }
  };

  /** 0〜1 の濃さ。 */
  const opacityRate = () => {
    const s = state();
    if (s.phase === "in") return s.fadeIn > 0 ? 1 - s.timer / s.fadeIn : 1;
    if (s.phase === "show") return 1;
    if (s.phase === "out") return s.fadeOut > 0 ? s.timer / s.fadeOut : 0;
    return 0;
  };

  /** 「完了まで待つ」の待ちが要るか：現れている間、出す時間があるなら消え終わるまで。 */
  const isBusy = () => {
    const s = state();
    if (s.phase === "in" || s.phase === "out") return true;
    return s.phase === "show" && s.duration > 0;
  };

  window.Hai = window.Hai || {};
  Hai.BigCount = {
    show, hide, kanji, isBusy,
    text: () => (state().phase === "none" ? "" : state().text),
    phase: () => state().phase,
    opacity: () => opacityRate(),
    /** 出している絵（テスト用）。 */
    sprite: () => (SceneManager._scene && SceneManager._scene._haiBigCount) || null,
  };

  // ---------------------------------------------------------------- プラグインコマンド
  const WAIT_MODE = "haiBigCount";

  PluginManager.registerCommand(pluginName, "show", function(args) {
    const variableId = Number(args.variableId || 0);
    let text = String(args.text || "");
    if (!text) {
      const n = variableId > 0 ? $gameVariables.value(variableId) : Number(args.number || 0);
      text = kanji(n) + "。";
    }
    show(text, { duration: args.duration, fadeIn: args.fadeIn, fadeOut: args.fadeOut });
    if (args.wait === "true" && isBusy()) this.setWaitMode(WAIT_MODE);
  });

  PluginManager.registerCommand(pluginName, "hide", function(args) {
    hide(args.fadeOut);
    if (args.wait === "true" && isBusy()) this.setWaitMode(WAIT_MODE);
  });

  const _Game_Interpreter_updateWaitMode = Game_Interpreter.prototype.updateWaitMode;
  Game_Interpreter.prototype.updateWaitMode = function() {
    if (this._waitMode === WAIT_MODE) {
      if (isBusy()) return true;
      this._waitMode = "";
      return false;
    }
    return _Game_Interpreter_updateWaitMode.apply(this, arguments);
  };

  // 場所移動で消す（移った先に持ち越さない）
  const _Game_Player_performTransfer = Game_Player.prototype.performTransfer;
  Game_Player.prototype.performTransfer = function() {
    if (this.isTransferring()) clear();
    _Game_Player_performTransfer.apply(this, arguments);
  };

  // ---------------------------------------------------------------- 絵
  /** 画面の大きさに合わせて描き直す。位置は毎フレーム画面の大きさから決める。 */
  class Sprite_HaiBigCount extends Sprite {
    initialize() {
      super.initialize();
      this.anchor.x = 0.5;
      this.anchor.y = 0.5;
      this._drawn = { text: null, width: 0, height: 0, face: "" };
      this.opacity = 0;
      this.update();
    }

    size() {
      return Math.max(12, Math.round(fontSize * Graphics.height / BASE_HEIGHT));
    }

    redraw() {
      const s = state();
      const size = this.size();
      const face = $gameSystem.mainFontFace();
      const d = this._drawn;
      if (d.text === s.text && d.width === Graphics.width && d.height === Graphics.height && d.face === face) return;
      const h = Math.ceil(size * 1.5) + outlineWidth * 2;
      if (!this.bitmap || this.bitmap.width !== Graphics.width || this.bitmap.height !== h) {
        if (this.bitmap) this.bitmap.destroy();
        this.bitmap = new Bitmap(Graphics.width, h);
      } else {
        this.bitmap.clear();
      }
      const b = this.bitmap;
      b.fontFace = face;
      b.fontSize = size;
      b.textColor = textColor;
      b.outlineColor = outlineColor;
      b.outlineWidth = outlineWidth;
      b.drawText(s.text, 0, 0, b.width, h, "center");
      this._drawn = { text: s.text, width: Graphics.width, height: Graphics.height, face };
    }

    update() {
      super.update();
      const s = state();
      this.visible = s.phase !== "none" && s.text !== "";
      if (!this.visible) return;
      this.redraw();
      this.x = Math.round(Graphics.width / 2);
      this.y = Math.round(Graphics.height * positionY);
      const rate = opacityRate();
      this.opacity = Math.round(255 * rate);
      // 現れるときだけ、少し大きい所から縮んで落ち着く
      const scale = s.phase === "in" ? 1 + 0.15 * (1 - rate) : 1;
      this.scale.x = scale;
      this.scale.y = scale;
    }
  }
  Hai.BigCount.Sprite = Sprite_HaiBigCount;

  const _Scene_Map_createDisplayObjects = Scene_Map.prototype.createDisplayObjects;
  Scene_Map.prototype.createDisplayObjects = function() {
    _Scene_Map_createDisplayObjects.apply(this, arguments);
    this._haiBigCount = new Sprite_HaiBigCount();
    this.addChild(this._haiBigCount); // 文章の窓・ボタンより手前
  };

  const _Scene_Map_updateMain = Scene_Map.prototype.updateMain;
  Scene_Map.prototype.updateMain = function() {
    _Scene_Map_updateMain.apply(this, arguments);
    update();
  };
})();
