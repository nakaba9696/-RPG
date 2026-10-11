/*:
 * @target MZ
 * @plugindesc スマホ向けの画面ボタン（調べる・メニュー・地図・ダッシュ）とオプション「タッチボタン」。
 * @author 灰の王国
 * @help
 * タッチ端末のとき、マップと戦闘の上に半透明のボタンを出す。
 *   右下「調べる」   決定キー（ok）を押している間だけ立てる。戦闘・メッセージ中は「決定」
 *   左下「メニュー」 メニューを開く。戦闘・メッセージ中は「戻る」（キャンセル）
 *   その上「地図」   Hai.AutoMap.open()（Hai_AutoMap が無ければ出さない）
 *   右の上「ダッシュ」 ダッシュの入り切り（押した間ではなく切り替え。Shift と同じ向きに足す）
 * MZ の既定のタッチ操作（タップで移動・2 本指でキャンセル・長押しダッシュ）はそのまま。
 * ボタンの上でのタップはマップの移動にならない。
 *
 * 出る条件：オプションの「タッチボタン」が ON。既定は、タッチ端末（Utils.isMobileDevice() か
 * タッチ点が 1 つ以上）なら ON、そうでなければ OFF。
 *
 * 窓口 window.Hai.TouchUI：
 *   show() / hide()   「タッチボタン」を ON / OFF にする（セーブはしない）
 *   isShown()         今のシーンでボタンが出ているか
 *   press(name)       テスト用：ボタンを押す。name は ok・menu・map・dash（cancel も可）
 *   rect(name)        ボタンの画面上の矩形 { x, y, width, height }（ゲームの座標）。出ていなければ null
 *
 * @param size
 * @text ボタンの大きさ
 * @desc 1280×720 の座標での一辺。縦画面（720 幅）に縮んでも 64px 以上になる値にする。
 * @type number
 * @min 64
 * @default 120
 *
 * @param opacity
 * @text 不透明度
 * @type number
 * @min 0
 * @max 255
 * @default 140
 *
 * @param okText
 * @text 「調べる」の文字
 * @type string
 * @default 調べる
 *
 * @param decideText
 * @text 「決定」の文字（戦闘・メッセージ中）
 * @type string
 * @default 決定
 *
 * @param menuText
 * @text 「メニュー」の文字
 * @type string
 * @default メニュー
 *
 * @param cancelText
 * @text 「戻る」の文字（戦闘・メッセージ中）
 * @type string
 * @default 戻る
 *
 * @param mapText
 * @text 「地図」の文字
 * @type string
 * @default 地図
 *
 * @param dashText
 * @text 「ダッシュ」の文字
 * @type string
 * @default ダッシュ
 *
 * @param optionText
 * @text オプションの項目名
 * @type string
 * @default タッチボタン
 */
(() => {
  "use strict";
  const pluginName = "Hai_TouchUI";
  const params = PluginManager.parameters(pluginName);
  const SIZE = Math.max(64, Number(params.size || 120));
  const OPACITY = Number(params.opacity || 140);
  const TEXT = {
    ok: params.okText || "調べる",
    decide: params.decideText || "決定",
    menu: params.menuText || "メニュー",
    cancel: params.cancelText || "戻る",
    map: params.mapText || "地図",
    dash: params.dashText || "ダッシュ",
  };
  const OPTION_TEXT = params.optionText || "タッチボタン";
  const MARGIN = 20;
  const GAP = 16;
  const PRESS_FRAMES = 4; // press(name) が入力を立てておくフレーム数

  const isTouchDevice = () =>
    Utils.isMobileDevice() || (navigator.maxTouchPoints || 0) > 0 || "ontouchstart" in window;

  const touchState = () => {
    $gameSystem._hai = $gameSystem._hai || {};
    const s = ($gameSystem._hai.touchUI = $gameSystem._hai.touchUI || {});
    if (s.dash === undefined) s.dash = false;
    return s;
  };

  // ---- 設定 ----
  ConfigManager.haiTouchButtons = isTouchDevice();

  const _ConfigManager_makeData = ConfigManager.makeData;
  ConfigManager.makeData = function() {
    const config = _ConfigManager_makeData.apply(this, arguments);
    config.haiTouchButtons = this.haiTouchButtons;
    return config;
  };

  const _ConfigManager_applyData = ConfigManager.applyData;
  ConfigManager.applyData = function(config) {
    _ConfigManager_applyData.apply(this, arguments);
    this.haiTouchButtons = this.readFlag(config, "haiTouchButtons", isTouchDevice());
  };

  const _Window_Options_addGeneralOptions = Window_Options.prototype.addGeneralOptions;
  Window_Options.prototype.addGeneralOptions = function() {
    _Window_Options_addGeneralOptions.apply(this, arguments);
    this.addCommand(OPTION_TEXT, "haiTouchButtons");
  };

  // ---- ダッシュの切替 ----
  const _Game_Player_isDashButtonPressed = Game_Player.prototype.isDashButtonPressed;
  Game_Player.prototype.isDashButtonPressed = function() {
    const base = _Game_Player_isDashButtonPressed.apply(this, arguments);
    return touchState().dash ? !base : base;
  };

  // ---- ボタン ----
  class Sprite_HaiTouchButton extends Sprite {
    constructor(name) {
      super(new Bitmap(SIZE, SIZE));
      this.name = name;
      this._label = "";
      this._on = false;
      this._held = false; // この枠が Input の状態を立てているか
      this._pressFrames = 0;
      this.opacity = OPACITY;
      this.visible = false;
    }

    // 画面上の矩形（シーンの子なので座標はそのまま）
    hit(x, y) {
      return this.visible && x >= this.x && x < this.x + SIZE && y >= this.y && y < this.y + SIZE;
    }

    isTouched() {
      // 一瞬のタップ（押して同じフレームのうちに離す）も拾う
      return (TouchInput.isPressed() || TouchInput.isTriggered()) && this.hit(TouchInput.x, TouchInput.y);
    }

    refresh(label, on) {
      if (label === this._label && on === this._on) return;
      this._label = label;
      this._on = on;
      const b = this.bitmap;
      b.clear();
      const r = SIZE / 2;
      const ctx = b.context;
      ctx.save();
      ctx.beginPath();
      ctx.arc(r, r, r - 3, 0, Math.PI * 2);
      ctx.fillStyle = on ? "rgba(255,208,96,0.95)" : "rgba(24,24,32,0.9)";
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.stroke();
      ctx.restore();
      b.fontSize = label.length > 3 ? 22 : 28;
      b.textColor = on ? "#000000" : "#ffffff";
      b.drawText(label, 0, 0, SIZE, SIZE, "center");
      b._baseTexture.update();
    }
  }

  // 入力の名前（Input の状態）。map と dash は押した瞬間に動く。
  const HOLD = { ok: "ok", menu: "escape", cancel: "escape" };

  class Hai_TouchButtons extends Sprite {
    constructor() {
      super();
      this._buttons = {};
      for (const n of ["ok", "menu", "map", "dash"]) {
        this._buttons[n] = new Sprite_HaiTouchButton(n);
        this.addChild(this._buttons[n]);
      }
      this._pressed = {}; // 前フレームに触れていたか（押した瞬間を取る）
      this._forced = {}; // press(name) の残りフレーム
    }

    // メッセージ・イベント・戦闘中は「決定」「戻る」だけ
    isSimple() {
      return SceneManager._scene instanceof Scene_Battle || $gameMessage.isBusy() || $gameMap.isEventRunning();
    }

    isOn() {
      return !!ConfigManager.haiTouchButtons;
    }

    hasMap() {
      return !!(window.Hai && Hai.AutoMap && typeof Hai.AutoMap.open === "function");
    }

    // 配置は Graphics.boxWidth / boxHeight から
    layout() {
      const w = Graphics.boxWidth;
      const h = Graphics.boxHeight;
      const simple = this.isSimple();
      const B = this._buttons;
      const bottom = h - MARGIN - SIZE;
      const right = w - MARGIN - SIZE;
      B.ok.move(right, bottom);
      B.menu.move(MARGIN, bottom);
      B.dash.move(right, bottom - SIZE - GAP);
      B.map.move(MARGIN, bottom - SIZE - GAP);
      const on = this.isOn();
      B.ok.visible = on;
      B.menu.visible = on && (simple || $gameSystem.isMenuEnabled());
      B.dash.visible = on && !simple;
      B.map.visible = on && !simple && this.hasMap() && $gameSystem.isMenuEnabled();
      B.ok.refresh(simple ? TEXT.decide : TEXT.ok, false);
      B.menu.refresh(simple ? TEXT.cancel : TEXT.menu, false);
      B.map.refresh(TEXT.map, false);
      B.dash.refresh(TEXT.dash, touchState().dash);
    }

    anyTouched() {
      return Object.values(this._buttons).some(b => b.isTouched());
    }

    update() {
      super.update();
      this.layout();
      const B = this._buttons;
      const wants = { ok: false, escape: false };
      for (const n of ["ok", "menu"]) {
        const b = B[n];
        if (b.isTouched() || this._forced[n] > 0) {
          wants[HOLD[n]] = true;
        }
        if (this._forced[n] > 0) this._forced[n]--;
      }
      if (this._forced.cancel > 0) {
        wants.escape = true;
        this._forced.cancel--;
      }
      for (const name of ["ok", "escape"]) {
        if (wants[name]) {
          Input._currentState[name] = true;
          this["_held_" + name] = true;
        } else if (this["_held_" + name]) {
          Input._currentState[name] = false;
          this["_held_" + name] = false;
        }
      }
      // 押した瞬間に動くもの
      for (const n of ["map", "dash"]) {
        const touched = B[n].isTouched();
        const forced = this._forced[n] > 0;
        if (forced) this._forced[n]--;
        if ((touched && !this._pressed[n]) || forced) this.fire(n);
        this._pressed[n] = touched;
      }
    }

    fire(name) {
      const B = this._buttons;
      if (!B[name].visible) return;
      if (name === "dash") {
        const s = touchState();
        s.dash = !s.dash;
        SoundManager.playCursor();
      } else if (name === "map") {
        const scene = SceneManager._scene;
        if (scene instanceof Scene_Map && scene.isMenuEnabled()) {
          SoundManager.playOk();
          Hai.AutoMap.open();
        }
      }
    }

    press(name) {
      if (name === "dash" || name === "map") {
        this._forced[name] = 1;
      } else {
        this._forced[name] = PRESS_FRAMES;
      }
    }
  }

  const addButtons = scene => {
    scene._haiTouchButtons = new Hai_TouchButtons();
    scene.addChild(scene._haiTouchButtons);
  };

  const _Scene_Map_createButtons = Scene_Map.prototype.createButtons;
  Scene_Map.prototype.createButtons = function() {
    _Scene_Map_createButtons.apply(this, arguments);
    addButtons(this);
  };

  const _Scene_Battle_createButtons = Scene_Battle.prototype.createButtons;
  Scene_Battle.prototype.createButtons = function() {
    _Scene_Battle_createButtons.apply(this, arguments);
    addButtons(this);
  };

  // ボタンの上のタップをマップの移動にしない（核の processMapTouch が見る）
  const _Scene_Map_isAnyButtonPressed = Scene_Map.prototype.isAnyButtonPressed;
  Scene_Map.prototype.isAnyButtonPressed = function() {
    return _Scene_Map_isAnyButtonPressed.apply(this, arguments) ||
      !!(this._haiTouchButtons && this._haiTouchButtons.anyTouched());
  };

  const sceneButtons = () => {
    const s = SceneManager._scene;
    return s && s._haiTouchButtons ? s._haiTouchButtons : null;
  };

  window.Hai = window.Hai || {};
  Hai.TouchUI = {
    show() {
      ConfigManager.haiTouchButtons = true;
    },
    hide() {
      ConfigManager.haiTouchButtons = false;
    },
    isShown() {
      const b = sceneButtons();
      return !!b && b._buttons.ok.visible;
    },
    press(name) {
      const b = sceneButtons();
      if (b) b.press(name);
    },
    rect(name) {
      const b = sceneButtons();
      const s = b && b._buttons[name === "cancel" ? "menu" : name];
      return s && s.visible ? { x: s.x, y: s.y, width: SIZE, height: SIZE } : null;
    },
  };
})();
