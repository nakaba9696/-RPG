/*:
 * @target MZ
 * @plugindesc 戦闘の戦術性：SP（TP の読み替え）、ボスからの逃走、敵の狙いの癖、おまかせ、属性の色。
 * @author 灰の王国
 * @help
 * MZ の既定の戦闘（ターン制）の上に、足りない所だけを足す。
 * 状態異常（States 141–147）・耐性・敵の行動の型は、データベースの設定（特徴・行動パターン）で表している。
 * 詳しくは docs/plugins/Hai_Battle.md。
 *
 * ■ SP（TP の読み替え。用語は System.json の「ＳＰ」）
 *   - 最大値は「SP の最大値」（既定 50）。
 *   - 味方の SP は戦闘をまたいで持ち越す（戦闘の頭で乱数にしない、終わりで 0 にしない）。
 *   - ダメージを受けても、技を使っても溜まらない（パラメータで戻せる）。
 *     増えるのは、アイテムの「TP 増加」と特徴の「TP 再生率」だけ。
 *   - 全快は宿（拠点）で、プラグインコマンド「SP を全快」を使う。
 *     イベントの「全回復」は SP に触らない。仲間が加わったときは満タン。
 *
 * ■ ボスからの逃走
 *   敵のメモ欄に <hai_boss> がある敵が 1 体でもいる戦闘は、「戦闘の処理」で
 *   逃走不可にしてあっても逃げられる。成功率は MZ の既定式（素早さの比）のまま。
 *
 * ■ 敵の狙いの癖（敵のメモ欄）
 *   <hai_target:lowest>  HP が最も低い者を狙う
 *   <hai_target:taunt>   狙われ率（挑発）が最も高い者を必ず狙う
 *   書かなければ MZ の既定（狙われ率の重みで乱数）。単体の技だけに効く。
 *
 * ■ おまかせ（パーティコマンド）
 *   選ぶと全員が「攻撃」を選んでターンが進む。次のターンも続く。
 *   決定かキャンセルを押すと、次のターンの頭で止まる。
 *
 * ■ 属性の色
 *   ダメージの数字を、属性で色分けする（「属性の色」パラメータ）。
 *
 * @param maxSp
 * @text SP の最大値
 * @type number
 * @min 1
 * @default 50
 *
 * @param chargeByDamage
 * @text ダメージで SP が溜まる
 * @desc MZ の既定（受けたダメージで TP が溜まる）を使うか。
 * @type boolean
 * @default false
 *
 * @param chargeByAction
 * @text 技で SP が溜まる
 * @desc MZ の既定（スキルの「得られる TP」）を使うか。
 * @type boolean
 * @default false
 *
 * @param bossEscape
 * @text ボスから逃げられる
 * @desc <hai_boss> の敵がいる戦闘を、いつも逃走可にするか。
 * @type boolean
 * @default true
 *
 * @param autoCommand
 * @text おまかせの名前
 * @type string
 * @default おまかせ
 *
 * @param autoHelp
 * @text おまかせ中の表示
 * @type string
 * @default おまかせ中　決定／キャンセルで止める
 *
 * @param elementColors
 * @text 属性の色
 * @desc 属性 ID:色 をカンマで区切る。書いていない属性は MZ の既定の色。
 * @type string
 * @default 2:#ff5a3c,3:#7fdcff,4:#ffe23c,8:#ffffff,9:#c07cff
 *
 * @command recoverSp
 * @text SP を全快
 * @desc 宿（拠点）で使う。
 *
 * @arg actorId
 * @text アクター
 * @desc 0 でパーティ全員。
 * @type actor
 * @default 0
 */
(() => {
  "use strict";
  const pluginName = "Hai_Battle";
  const params = PluginManager.parameters(pluginName);
  const maxSp = Number(params.maxSp || 50);
  const chargeByDamage = params.chargeByDamage === "true";
  const chargeByAction = params.chargeByAction === "true";
  const bossEscape = params.bossEscape !== "false";
  const autoCommand = params.autoCommand || "おまかせ";
  const autoHelp = params.autoHelp || "おまかせ中　決定／キャンセルで止める";
  const elementColors = {};
  for (const pair of String(params.elementColors || "").split(",")) {
    const [id, color] = pair.split(":").map(s => s.trim());
    if (id && color) elementColors[Number(id)] = color;
  }

  function isBossTroop() {
    return $gameTroop.members().some(enemy => enemy.enemy().meta.hai_boss);
  }

  function targetHabit(battler) {
    if (!battler || !battler.isEnemy()) return "";
    const habit = battler.enemy().meta.hai_target;
    return typeof habit === "string" ? habit.trim() : "";
  }

  /** 癖に合う相手（なければ null で、MZ の既定に任せる）。 */
  function pickTarget(habit, unit) {
    const members = unit.aliveMembers();
    if (members.length === 0) return null;
    if (habit === "lowest") {
      return members.reduce((best, m) => (m.hp < best.hp ? m : best));
    }
    if (habit === "taunt") {
      return members.reduce((best, m) => (m.tgr > best.tgr ? m : best));
    }
    return null;
  }

  function recoverSp(actorId) {
    const actors = actorId > 0 ? [$gameActors.actor(actorId)] : $gameParty.members();
    for (const actor of actors) {
      if (actor) actor.setTp(actor.maxTp());
    }
  }

  window.Hai = window.Hai || {};
  Hai.Battle = {
    params: { maxSp, chargeByDamage, chargeByAction, bossEscape, autoCommand, elementColors },
    isBossTroop,
    targetHabit,
    pickTarget,
    recoverSp,
    isAuto: () => !!BattleManager._haiAuto,
    setAuto: on => {
      BattleManager._haiAuto = !!on;
    },
    elementColor: elementId => elementColors[elementId] || null,
  };

  PluginManager.registerCommand(pluginName, "recoverSp", args => {
    recoverSp(Number(args.actorId || 0));
  });

  // ---------------------------------------------------------------- SP
  const _Game_BattlerBase_maxTp = Game_BattlerBase.prototype.maxTp;
  Game_BattlerBase.prototype.maxTp = function() {
    return maxSp > 0 ? maxSp : _Game_BattlerBase_maxTp.apply(this, arguments);
  };

  const _Game_BattlerBase_isPreserveTp = Game_BattlerBase.prototype.isPreserveTp;
  Game_BattlerBase.prototype.isPreserveTp = function() {
    return this.isActor() || _Game_BattlerBase_isPreserveTp.apply(this, arguments);
  };

  const _Game_Battler_chargeTpByDamage = Game_Battler.prototype.chargeTpByDamage;
  Game_Battler.prototype.chargeTpByDamage = function() {
    if (chargeByDamage) _Game_Battler_chargeTpByDamage.apply(this, arguments);
  };

  const _Game_Action_applyItemUserEffect = Game_Action.prototype.applyItemUserEffect;
  Game_Action.prototype.applyItemUserEffect = function() {
    if (chargeByAction) _Game_Action_applyItemUserEffect.apply(this, arguments);
  };

  const _Game_Actor_setup = Game_Actor.prototype.setup;
  Game_Actor.prototype.setup = function() {
    _Game_Actor_setup.apply(this, arguments);
    this.setTp(this.maxTp());
  };

  // ---------------------------------------------------------------- ボスからの逃走
  const _BattleManager_setup = BattleManager.setup;
  BattleManager.setup = function() {
    _BattleManager_setup.apply(this, arguments);
    if (bossEscape && isBossTroop()) this._canEscape = true;
  };

  // ---------------------------------------------------------------- 敵の狙いの癖
  const _Game_Action_targetsForOpponents = Game_Action.prototype.targetsForOpponents;
  Game_Action.prototype.targetsForOpponents = function() {
    const habit = targetHabit(this.subject());
    if (habit && this.isForOne() && !this.isForRandom() && this._targetIndex < 0) {
      const target = pickTarget(habit, this.opponentsUnit());
      if (target) return [target];
    }
    return _Game_Action_targetsForOpponents.apply(this, arguments);
  };

  // ---------------------------------------------------------------- 属性の色
  const _Game_ActionResult_clear = Game_ActionResult.prototype.clear;
  Game_ActionResult.prototype.clear = function() {
    _Game_ActionResult_clear.apply(this, arguments);
    this.haiElementId = 0;
  };

  /** ダメージの属性（通常攻撃は攻撃時属性のうち一番効くもの。calcElementRate と同じ選び方）。 */
  Game_Action.prototype.haiElementId = function(target) {
    const elementId = this.item().damage.elementId;
    if (elementId >= 0) return elementId;
    const elements = this.subject().attackElements();
    let best = 0;
    for (const id of elements) {
      if (!best || target.elementRate(id) > target.elementRate(best)) best = id;
    }
    return best;
  };

  const _Game_Action_executeHpDamage = Game_Action.prototype.executeHpDamage;
  Game_Action.prototype.executeHpDamage = function(target, value) {
    _Game_Action_executeHpDamage.apply(this, arguments);
    if (value > 0) target.result().haiElementId = this.haiElementId(target);
  };

  const _Sprite_Damage_setup = Sprite_Damage.prototype.setup;
  Sprite_Damage.prototype.setup = function(target) {
    const result = target.result();
    const isDamage = !result.missed && !result.evaded && result.hpAffected && result.hpDamage > 0;
    this._haiColor = isDamage ? Hai.Battle.elementColor(result.haiElementId) : null;
    _Sprite_Damage_setup.apply(this, arguments);
  };

  const _Sprite_Damage_damageColor = Sprite_Damage.prototype.damageColor;
  Sprite_Damage.prototype.damageColor = function() {
    return this._haiColor || _Sprite_Damage_damageColor.apply(this, arguments);
  };

  // ---------------------------------------------------------------- おまかせ
  const _BattleManager_initMembers = BattleManager.initMembers;
  BattleManager.initMembers = function() {
    _BattleManager_initMembers.apply(this, arguments);
    this._haiAuto = false;
  };

  /** 入力できる味方の行動を、全部「攻撃」にする（狙いは実行のときに乱数）。 */
  BattleManager.haiInputAuto = function() {
    for (const actor of $gameParty.members()) {
      if (!actor.canInput()) continue;
      for (let i = 0; i < actor.numActions(); i++) {
        actor.action(i).setAttack();
      }
      actor.setActionState("waiting");
    }
  };

  const _Window_PartyCommand_makeCommandList = Window_PartyCommand.prototype.makeCommandList;
  Window_PartyCommand.prototype.makeCommandList = function() {
    _Window_PartyCommand_makeCommandList.apply(this, arguments);
    if (BattleManager.isTpb()) return;
    this.addCommand(autoCommand, "haiAuto"); // 「逃げる」の下（並びを変えると、↓ 1 回で逃げる操作が変わる）
  };

  function Window_HaiAuto() {
    this.initialize(...arguments);
  }
  Window_HaiAuto.prototype = Object.create(Window_Base.prototype);
  Window_HaiAuto.prototype.constructor = Window_HaiAuto;
  Window_HaiAuto.prototype.initialize = function(rect) {
    Window_Base.prototype.initialize.call(this, rect);
    this.drawText(autoHelp, 0, 0, this.innerWidth, "center");
    this.hide();
  };

  const _Scene_Battle_createAllWindows = Scene_Battle.prototype.createAllWindows;
  Scene_Battle.prototype.createAllWindows = function() {
    _Scene_Battle_createAllWindows.apply(this, arguments);
    const ww = 480;
    const wh = this.calcWindowHeight(1, false);
    const rect = new Rectangle((Graphics.boxWidth - ww) / 2, Graphics.boxHeight - this.windowAreaHeight() - wh, ww, wh);
    this._haiAutoWindow = new Window_HaiAuto(rect);
    this.addWindow(this._haiAutoWindow);
  };

  const _Scene_Battle_createPartyCommandWindow = Scene_Battle.prototype.createPartyCommandWindow;
  Scene_Battle.prototype.createPartyCommandWindow = function() {
    _Scene_Battle_createPartyCommandWindow.apply(this, arguments);
    this._partyCommandWindow.setHandler("haiAuto", this.commandHaiAuto.bind(this));
  };

  Scene_Battle.prototype.commandHaiAuto = function() {
    BattleManager._haiAuto = true;
    BattleManager.haiInputAuto();
    BattleManager.startTurn();
    this.changeInputWindow();
  };

  const _Scene_Battle_startPartyCommandSelection = Scene_Battle.prototype.startPartyCommandSelection;
  Scene_Battle.prototype.startPartyCommandSelection = function() {
    if (BattleManager._haiAuto && !BattleManager.isTpb()) {
      this.commandHaiAuto();
      return;
    }
    _Scene_Battle_startPartyCommandSelection.apply(this, arguments);
  };

  const _Scene_Battle_update = Scene_Battle.prototype.update;
  Scene_Battle.prototype.update = function() {
    if (BattleManager._haiAuto && (Input.isTriggered("ok") || Input.isTriggered("cancel") || TouchInput.isCancelled())) {
      BattleManager._haiAuto = false;
      SoundManager.playCancel();
    }
    _Scene_Battle_update.apply(this, arguments);
    if (this._haiAutoWindow) {
      this._haiAutoWindow.visible = !!BattleManager._haiAuto && !BattleManager.isBattleEnd();
    }
  };
})();
