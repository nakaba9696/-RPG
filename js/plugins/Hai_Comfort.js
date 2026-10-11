/*:
 * @target MZ
 * @plugindesc 快適機能：文章の瞬間表示と、押し続けている間の早送り（オプションで切り替え）。
 * @author 灰の王国
 * @help
 * オプション画面に 2 つの項目を足す（「タッチボタン」の下）。
 *
 * 瞬間表示（既定 OFF）
 *   ON のとき、文章が 1 文字ずつでなく一度に出る。
 *   \. と \| の待ち、\! の入力待ちは残る（そこまでを一度に出し、待ってから続きを一度に出す）。
 *
 * 早送り（既定 ON）
 *   ON のとき、ダッシュのキー（Shift）を押し続けている間、または「決定」を長押ししている間（タッチは長押し）：
 *   - 文章：1 文字ずつの表示と \. \| の待ちを飛ばし、ページ送りの入力待ちも自動で送る（選択肢・数値入力では止まる）。
 *   - 戦闘：ログの待ち（messageSpeed）を半分に、アニメーションを 2 倍の速さにする。
 *   押していないときは通常の速さ。OFF でも MZ の既定の早送り（戦闘ログの待ちを 3 倍で減らす）は残る。
 *
 * 窓口（window.Hai.Comfort）
 *   get(name)              "instantText" / "fastForward" の今の値
 *   set(name, value)       値を変える（ConfigManager に入る。保存は ConfigManager.save()）
 *   isFastForward()        いま早送り中か（ON で、キーを押し続けている）
 *
 * @param instantText
 * @text 瞬間表示の名前
 * @type string
 * @default 瞬間表示
 *
 * @param fastForward
 * @text 早送りの名前
 * @type string
 * @default 早送り
 *
 * @param battleWaitRate
 * @text 早送り中の戦闘ログの待ち（%）
 * @type number
 * @min 1
 * @max 100
 * @default 50
 *
 * @param animationRate
 * @text 早送り中のアニメーションの速さ（倍）
 * @type number
 * @min 1
 * @max 4
 * @default 2
 */
(() => {
  "use strict";
  const pluginName = "Hai_Comfort";
  const params = PluginManager.parameters(pluginName);
  const instantTextName = String(params.instantText || "瞬間表示");
  const fastForwardName = String(params.fastForward || "早送り");
  const battleWaitRate = Math.max(1, Math.min(100, Number(params.battleWaitRate || 50))) / 100;
  const animationRate = Math.max(1, Math.floor(Number(params.animationRate || 2)));

  // 窓口の名前 → ConfigManager の欄
  const KEYS = { instantText: "haiInstantText", fastForward: "haiFastForward" };
  const DEFAULTS = { haiInstantText: false, haiFastForward: true };

  // ---------------------------------------------------------------------------
  // 設定（ConfigManager。config.rmmzsave に入る）
  // ---------------------------------------------------------------------------
  ConfigManager.haiInstantText = DEFAULTS.haiInstantText;
  ConfigManager.haiFastForward = DEFAULTS.haiFastForward;

  const _ConfigManager_makeData = ConfigManager.makeData;
  ConfigManager.makeData = function() {
    const config = _ConfigManager_makeData.apply(this, arguments);
    config.haiInstantText = this.haiInstantText;
    config.haiFastForward = this.haiFastForward;
    return config;
  };

  const _ConfigManager_applyData = ConfigManager.applyData;
  ConfigManager.applyData = function(config) {
    _ConfigManager_applyData.apply(this, arguments);
    this.haiInstantText = this.readFlag(config, "haiInstantText", DEFAULTS.haiInstantText);
    this.haiFastForward = this.readFlag(config, "haiFastForward", DEFAULTS.haiFastForward);
  };

  const _Window_Options_addGeneralOptions = Window_Options.prototype.addGeneralOptions;
  Window_Options.prototype.addGeneralOptions = function() {
    _Window_Options_addGeneralOptions.apply(this, arguments);
    this.addCommand(instantTextName, "haiInstantText");
    this.addCommand(fastForwardName, "haiFastForward");
  };

  // 窓の高さ（コアは 7 行の決め打ち）を、実際の項目の数に合わせる（ほかのプラグインが足した項目も数える）。
  // 画面に入らなければコアの上限（maxVisibleCommands、12 行）でスクロール。
  function countOptions() {
    const counter = Object.create(Window_Options.prototype);
    counter._list = [];
    counter.addCommand = function(name, symbol) {
      this._list.push(symbol);
    };
    counter.makeCommandList();
    return counter._list.length;
  }

  const _Scene_Options_maxCommands = Scene_Options.prototype.maxCommands;
  Scene_Options.prototype.maxCommands = function() {
    const base = _Scene_Options_maxCommands.apply(this, arguments);
    try {
      return Math.max(base, countOptions());
    } catch (e) {
      return base + 2;
    }
  };

  function isFastForward() {
    if (!ConfigManager.haiFastForward) return false;
    return Input.isPressed("shift") || Input.isLongPressed("ok") || TouchInput.isLongPressed();
  }

  // ---------------------------------------------------------------------------
  // 文章（Window_Message）
  // ---------------------------------------------------------------------------
  // 1 文字ずつ出すかは updateMessage の中の updateShowFast で決まる。ここで _showFast を立てると、
  // \. \| \! の待ち（isWaiting）までを一度に出す（コアの shouldBreakHere）。
  const _Window_Message_updateShowFast = Window_Message.prototype.updateShowFast;
  Window_Message.prototype.updateShowFast = function() {
    _Window_Message_updateShowFast.apply(this, arguments);
    if (ConfigManager.haiInstantText || isFastForward()) this._showFast = true;
  };

  // 早送り中は \. \| の待ちと、ページ送りの前の短い待ちを飛ばす（始めない・始まっていたら 0 にする）
  const _Window_Message_startWait = Window_Message.prototype.startWait;
  Window_Message.prototype.startWait = function(count) {
    _Window_Message_startWait.call(this, isFastForward() ? 0 : count);
  };

  const _Window_Message_updateWait = Window_Message.prototype.updateWait;
  Window_Message.prototype.updateWait = function() {
    if (this._waitCount > 0 && isFastForward()) this._waitCount = 0;
    return _Window_Message_updateWait.apply(this, arguments);
  };

  // 早送り中はページ送りの入力待ちを自動で送る（選択肢などの入力はコアのまま止まる）
  const _Window_Message_isTriggered = Window_Message.prototype.isTriggered;
  Window_Message.prototype.isTriggered = function() {
    return _Window_Message_isTriggered.apply(this, arguments) || (this.pause && isFastForward());
  };

  // ---------------------------------------------------------------------------
  // 戦闘（ログの待ちとアニメーション）
  // ---------------------------------------------------------------------------
  const _Window_BattleLog_messageSpeed = Window_BattleLog.prototype.messageSpeed;
  Window_BattleLog.prototype.messageSpeed = function() {
    const speed = _Window_BattleLog_messageSpeed.apply(this, arguments);
    return isFastForward() ? Math.max(1, Math.round(speed * battleWaitRate)) : speed;
  };

  // MZ 形式（Effekseer）：1 回の update で進むフレームを増やし、Effekseer の再生の速さも上げる
  const _Sprite_Animation_update = Sprite_Animation.prototype.update;
  Sprite_Animation.prototype.update = function() {
    const times = isFastForward() ? animationRate : 1;
    this._haiSpeed = times;
    for (let i = 0; i < times; i++) _Sprite_Animation_update.apply(this, arguments);
  };

  const _Sprite_Animation_updateEffectGeometry = Sprite_Animation.prototype.updateEffectGeometry;
  Sprite_Animation.prototype.updateEffectGeometry = function() {
    _Sprite_Animation_updateEffectGeometry.apply(this, arguments);
    if (this._handle && this._haiSpeed > 1) this._handle.setSpeed((this._animation.speed / 100) * this._haiSpeed);
  };

  // MV 形式のアニメーション
  const _Sprite_AnimationMV_update = Sprite_AnimationMV.prototype.update;
  Sprite_AnimationMV.prototype.update = function() {
    const times = isFastForward() ? animationRate : 1;
    for (let i = 0; i < times; i++) _Sprite_AnimationMV_update.apply(this, arguments);
  };

  // ---------------------------------------------------------------------------
  // 窓口
  // ---------------------------------------------------------------------------
  function keyOf(name) {
    const key = KEYS[name] || (Object.values(KEYS).includes(name) ? name : null);
    if (!key) throw new Error(`Hai.Comfort: 知らない名前 ${name}（${Object.keys(KEYS).join("・")}）`);
    return key;
  }

  window.Hai = window.Hai || {};
  Hai.Comfort = {
    /** "instantText" / "fastForward" の今の値。 */
    get(name) {
      return !!ConfigManager[keyOf(name)];
    },
    /** 値を変える。 */
    set(name, value) {
      ConfigManager[keyOf(name)] = !!value;
    },
    /** いま早送り中か。 */
    isFastForward,
  };
})();
