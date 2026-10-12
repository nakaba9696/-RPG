/*:
 * @target MZ
 * @plugindesc 主人公の取り込んだ思いの技と「呑まれ」。溜まりきると操作できず、仲間の呼びかけで戻る。
 * @author 灰の王国
 * @help
 * 主人公（墓守）が最後の地域で使えるようになる技と、その代わりに溜まる「呑まれ」。
 * 詳しくは docs/plugins/Hai_Apostle.md。
 *
 * ■ 技を覚える
 *   「覚えるスイッチ」が ON の間、「技を使う者」は「技」のスキルを使える（覚えさせる命令は要らない）。
 *   スイッチは W が物語の所で ON にする。
 *
 * ■ 呑まれ
 *   スキルのメモ欄 <hai_engulf:40> の技を使うたびに、使った者の呑まれが 40 溜まる。
 *   最大（既定 100）になると、その行動の終わりに「呑まれのステート」が付く。
 *   ステートの行動制約（既定のデータは「敵を攻撃する」）で、数ターン操作できない。
 *   ステートがターンで切れたら、呑まれは「切れたあと」の値に下がる。
 *   呑まれは戦闘の頭と終わりで 0 に戻る。戦闘の画面では顔の上に細いゲージで出る。
 *
 * ■ 呼びかけ
 *   「呼びかけの言葉」に書いた仲間は、味方の誰かの呑まれが 0 より大きい間、
 *   コマンド「呼びかける」を使える。選ぶと呑まれのいちばん多い味方に呼びかけ、
 *   呑まれが「呼びかけで減る量」だけ減り、呑まれのステートが外れる。
 *   戦闘ログには「ブルーノ「あなた！」」のように、仲間の呼び方で出る。
 *   言葉はプラグインコマンド「呼びかけの言葉を変える」で変えられる（セーブに入る）。
 *
 * ■ 窓口（window.Hai.Apostle）
 *   isLearned()  engulf(actorId)  addEngulf(actor, n)  isEngulfed(actor)
 *   callWord(actorId)  setCallWord(actorId, word)  canCall(actor)  callTarget()
 *
 * @param actorId
 * @text 技を使う者
 * @type actor
 * @default 1
 *
 * @param learnSwitch
 * @text 覚えるスイッチ
 * @desc ON の間、技を使える。
 * @type switch
 * @default 162
 *
 * @param skills
 * @text 技
 * @desc スキル ID をカンマで区切る。スキルタイプは技を使う者の職業が持つものにする。
 * @type string
 * @default 183
 *
 * @param maxEngulf
 * @text 呑まれの最大
 * @type number
 * @min 1
 * @default 100
 *
 * @param engulfState
 * @text 呑まれのステート
 * @desc 呑まれが最大になったときに付くステート。行動制約と続くターン数はデータベースで決める。
 * @type state
 * @default 194
 *
 * @param afterEngulf
 * @text 切れたあとの呑まれ
 * @desc 呑まれのステートがターンで切れたときに戻る値。
 * @type number
 * @min 0
 * @default 50
 *
 * @param callSkill
 * @text 呼びかけのスキル
 * @desc 「呼びかける」で使うスキル（範囲は味方 1 人）。
 * @type skill
 * @default 184
 *
 * @param callAmount
 * @text 呼びかけで減る量
 * @type number
 * @min 0
 * @default 60
 *
 * @param callCommand
 * @text 呼びかけのコマンド名
 * @type string
 * @default 呼びかける
 *
 * @param callWords
 * @text 呼びかけの言葉
 * @desc アクター ID:言葉 をカンマで区切る（world.md 11 章の呼び方）。書いた仲間だけが呼びかけられる。
 * @type string
 * @default 5:あなた！,6:あんた！,7:おい、あんた。,8:あんた！,9:お前さん！,10:おい、お前！,11:兄貴！
 *
 * @param callFormat
 * @text 呼びかけの一行
 * @desc 戦闘ログの一行。%1 が仲間の名前、%2 が言葉。
 * @type string
 * @default %1「%2」
 *
 * @param gaugeLabel
 * @text ゲージの名前
 * @type string
 * @default 呑
 *
 * @param engulfVariable
 * @text 呑まれを写す変数
 * @desc 技を使う者の呑まれをこの変数にも入れる（バトルイベントの条件用）。0 で写さない。
 * @type variable
 * @default 167
 *
 * @command setCallWord
 * @text 呼びかけの言葉を変える
 * @desc 頂の最後のターンなどで使う。言葉を空にすると、パラメータの言葉に戻る。
 *
 * @arg actorId
 * @text 仲間
 * @type actor
 * @default 5
 *
 * @arg word
 * @text 言葉
 * @type string
 * @default
 *
 * @command resetEngulf
 * @text 呑まれを 0 にする
 *
 * @arg actorId
 * @text アクター
 * @desc 0 で全員。
 * @type actor
 * @default 0
 */
(() => {
  "use strict";
  const pluginName = "Hai_Apostle";
  const params = PluginManager.parameters(pluginName);
  // 値はすべて文字列で来る
  const apostleId = Number(params.actorId || 1);
  const learnSwitch = Number(params.learnSwitch || 0);
  const skillIds = String(params.skills ?? "183").split(",").map(Number).filter(n => n > 0);
  const maxEngulf = Math.max(1, Number(params.maxEngulf || 100));
  const engulfState = Number(params.engulfState || 0);
  const afterEngulf = Math.max(0, Number(params.afterEngulf ?? 50));
  const callSkill = Number(params.callSkill || 0);
  const callAmount = Math.max(0, Number(params.callAmount ?? 60));
  const callCommand = params.callCommand || "呼びかける";
  const callFormat = params.callFormat || "%1「%2」";
  const gaugeLabel = params.gaugeLabel ?? "呑";
  const engulfVariable = Number(params.engulfVariable || 0);
  const defaultWords = {};
  for (const pair of String(params.callWords ?? "").split(",")) {
    const i = pair.indexOf(":");
    if (i <= 0) continue;
    const id = Number(pair.slice(0, i).trim());
    const word = pair.slice(i + 1).trim();
    if (id > 0 && word) defaultWords[id] = word;
  }

  // ---------------------------------------------------------------- 状態（$gameSystem._hai.apostle）
  function state() {
    $gameSystem._hai = $gameSystem._hai || {};
    const s = ($gameSystem._hai.apostle = $gameSystem._hai.apostle || {});
    s.engulf = s.engulf || {};
    s.words = s.words || {};
    return s;
  }

  const idOf = actor => (typeof actor === "number" ? actor : actor && actor.isActor && actor.isActor() ? actor.actorId() : 0);
  const isLearned = () => learnSwitch > 0 && $gameSwitches.value(learnSwitch);
  const engulfOf = actorId => Number(state().engulf[actorId] || 0);
  const engulfCost = item => {
    const v = item && item.meta ? item.meta.hai_engulf : undefined;
    return v === undefined || v === true ? 0 : Math.max(0, Number(v) || 0);
  };
  const isCallSkill = item => !!item && DataManager.isSkill(item) && item.id === callSkill;

  function setEngulf(actorId, value) {
    const v = Math.max(0, Math.min(maxEngulf, Math.round(value)));
    if (v > 0) state().engulf[actorId] = v;
    else delete state().engulf[actorId];
    if (engulfVariable > 0 && actorId === apostleId) $gameVariables.setValue(engulfVariable, v);
    return v;
  }

  /** 呑まれを溜める。最大になったら、その行動の終わりにステートを付ける印を立てる。 */
  function addEngulf(actor, n) {
    const id = idOf(actor);
    if (!id || !(n > 0)) return engulfOf(id);
    const v = setEngulf(id, engulfOf(id) + n);
    const a = $gameActors.actor(id);
    if (v >= maxEngulf && a && engulfState > 0 && !a.isStateAffected(engulfState)) a._haiEngulfPending = true;
    return v;
  }

  function isEngulfed(actor) {
    const a = typeof actor === "number" ? $gameActors.actor(actor) : actor;
    return !!(a && engulfState > 0 && a.isStateAffected(engulfState));
  }

  function callWord(actorId) {
    const w = state().words[actorId];
    return typeof w === "string" && w ? w : defaultWords[actorId] || "";
  }

  /** 呼びかけを受ける味方（呑まれのいちばん多い、生きている者）。いなければ null。 */
  function callTarget() {
    const list = $gameParty.battleMembers().filter(a => a.isAlive() && engulfOf(a.actorId()) > 0);
    return list.length ? list.reduce((best, a) => (engulfOf(a.actorId()) > engulfOf(best.actorId()) ? a : best)) : null;
  }

  function canCall(actor) {
    return !!(actor && actor.isActor() && callSkill > 0 && callWord(actor.actorId()) && actor.actorId() !== apostleId);
  }

  /** 呼びかけを受けた：呑まれが減り、ステートが外れる。 */
  function receiveCall(target) {
    if (!target || !target.isActor()) return;
    setEngulf(target.actorId(), engulfOf(target.actorId()) - callAmount);
    target._haiEngulfPending = false;
    if (isEngulfed(target)) target.removeState(engulfState);
  }

  function resetEngulf(actorId) {
    if (actorId > 0) {
      setEngulf(actorId, 0);
    } else {
      for (const id of Object.keys(state().engulf)) setEngulf(Number(id), 0);
      if (engulfVariable > 0) $gameVariables.setValue(engulfVariable, 0);
    }
  }

  window.Hai = window.Hai || {};
  Hai.Apostle = {
    params: { apostleId, learnSwitch, skillIds, maxEngulf, engulfState, afterEngulf, callSkill, callAmount, callCommand },
    isLearned,
    engulf: actorId => engulfOf(idOf(actorId)),
    addEngulf,
    isEngulfed,
    engulfCost,
    callWord,
    setCallWord(actorId, word) {
      if (word) state().words[actorId] = String(word);
      else delete state().words[actorId];
    },
    canCall,
    callTarget,
    resetEngulf,
  };

  PluginManager.registerCommand(pluginName, "setCallWord", args => {
    Hai.Apostle.setCallWord(Number(args.actorId || 0), String(args.word || ""));
  });

  PluginManager.registerCommand(pluginName, "resetEngulf", args => {
    resetEngulf(Number(args.actorId || 0));
  });

  // ---------------------------------------------------------------- 技を覚える（スイッチの間だけ）
  const _Game_Actor_skills = Game_Actor.prototype.skills;
  Game_Actor.prototype.skills = function() {
    const list = _Game_Actor_skills.apply(this, arguments);
    if (this.actorId() !== apostleId || !isLearned()) return list;
    for (const id of skillIds) {
      const skill = $dataSkills[id];
      if (skill && !list.includes(skill)) list.push(skill);
    }
    return list;
  };

  // ---------------------------------------------------------------- 呑まれが溜まる
  const _Game_Battler_useItem = Game_Battler.prototype.useItem;
  Game_Battler.prototype.useItem = function(item) {
    _Game_Battler_useItem.apply(this, arguments);
    if (this.isActor() && $gameParty.inBattle()) addEngulf(this, engulfCost(item));
  };

  const _BattleManager_endAction = BattleManager.endAction;
  BattleManager.endAction = function() {
    for (const actor of $gameParty.members()) {
      if (!actor._haiEngulfPending) continue;
      actor._haiEngulfPending = false;
      if (!actor.isAlive() || isEngulfed(actor)) continue;
      actor.addState(engulfState);
      const msg = $dataStates[engulfState] && $dataStates[engulfState].message1;
      if (msg && isEngulfed(actor)) {
        this._logWindow.push("addText", msg.format(actor.name()));
        this._logWindow.push("wait");
      }
      $gameTemp.requestBattleRefresh();
    }
    _BattleManager_endAction.apply(this, arguments);
  };

  // ステートがターンで切れたら、呑まれを下げる（呼びかけで外れたときは、もう下がっている）
  const _Game_Battler_removeState = Game_Battler.prototype.removeState;
  Game_Battler.prototype.removeState = function(stateId) {
    const was = stateId === engulfState && this.isActor() && this.isStateAffected(stateId);
    _Game_Battler_removeState.apply(this, arguments);
    if (was && !this.isStateAffected(stateId) && engulfOf(this.actorId()) >= maxEngulf) {
      setEngulf(this.actorId(), Math.min(afterEngulf, maxEngulf - 1));
    }
  };

  // 戦闘の頭と終わりで 0 に戻す
  const _BattleManager_setup = BattleManager.setup;
  BattleManager.setup = function() {
    resetEngulf(0);
    for (const a of $gameParty.members()) a._haiEngulfPending = false;
    _BattleManager_setup.apply(this, arguments);
  };

  const _BattleManager_endBattle = BattleManager.endBattle;
  BattleManager.endBattle = function() {
    _BattleManager_endBattle.apply(this, arguments);
    resetEngulf(0);
  };

  // ---------------------------------------------------------------- 呼びかけ
  const _Game_Action_apply = Game_Action.prototype.apply;
  Game_Action.prototype.apply = function(target) {
    _Game_Action_apply.apply(this, arguments);
    if (isCallSkill(this.item()) && target.result().isHit()) {
      target.result().success = true;
      receiveCall(target);
    }
  };

  const _Window_BattleLog_displayAction = Window_BattleLog.prototype.displayAction;
  Window_BattleLog.prototype.displayAction = function(subject, item) {
    const word = isCallSkill(item) && subject.isActor() ? callWord(subject.actorId()) : "";
    if (!word) {
      _Window_BattleLog_displayAction.apply(this, arguments);
      return;
    }
    this.push("addText", callFormat.format(subject.name(), word));
    this.push("wait");
  };

  const _Window_ActorCommand_makeCommandList = Window_ActorCommand.prototype.makeCommandList;
  Window_ActorCommand.prototype.makeCommandList = function() {
    _Window_ActorCommand_makeCommandList.apply(this, arguments);
    if (this._actor && canCall(this._actor) && callTarget()) {
      this.addCommand(callCommand, "haiCall", this._actor.canUse($dataSkills[callSkill]));
    }
  };

  const _Scene_Battle_createActorCommandWindow = Scene_Battle.prototype.createActorCommandWindow;
  Scene_Battle.prototype.createActorCommandWindow = function() {
    _Scene_Battle_createActorCommandWindow.apply(this, arguments);
    this._actorCommandWindow.setHandler("haiCall", this.commandHaiCall.bind(this));
  };

  Scene_Battle.prototype.commandHaiCall = function() {
    const action = BattleManager.inputtingAction();
    const target = callTarget();
    if (!action || !target) {
      this._actorCommandWindow.activate();
      return;
    }
    action.setSkill(callSkill);
    action.setTarget(target.index());
    this.selectNextCommand();
  };

  // ---------------------------------------------------------------- ゲージ（戦闘の画面、顔の上）
  class Sprite_HaiEngulfGauge extends Sprite_Gauge {
    currentValue() {
      return this._battler ? engulfOf(this._battler.actorId()) : NaN;
    }
    currentMaxValue() {
      return maxEngulf;
    }
    label() {
      return gaugeLabel;
    }
    gaugeColor1() {
      return ColorManager.textColor(31);
    }
    gaugeColor2() {
      return ColorManager.textColor(30);
    }
  }
  window.Sprite_HaiEngulfGauge = Sprite_HaiEngulfGauge;

  const showGauge = actor => !!actor && actor.actorId() === apostleId && (isLearned() || engulfOf(apostleId) > 0);

  const _Window_BattleStatus_drawItemStatus = Window_BattleStatus.prototype.drawItemStatus;
  Window_BattleStatus.prototype.drawItemStatus = function(index) {
    _Window_BattleStatus_drawItemStatus.apply(this, arguments);
    const actor = this.actor(index);
    if (!actor) return;
    const key = `actor${actor.actorId()}-gauge-haiEngulf`;
    if (showGauge(actor)) {
      const rect = this.itemRectWithPadding(index);
      const sprite = this.createInnerSprite(key, Sprite_HaiEngulfGauge);
      sprite.setup(actor, "haiEngulf");
      sprite.move(rect.x, rect.y);
      sprite.show();
    } else if (this._additionalSprites[key]) {
      this._additionalSprites[key].hide();
    }
  };
})();
