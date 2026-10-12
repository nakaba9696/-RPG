/*:
 * @target MZ
 * @plugindesc ボスの作り：名前の表示、複数行動、形態変化、弱点のヒント、撃破の旗、ボス戦のコマンド。
 * @author 灰の王国
 * @help
 * 敵のメモ欄のタグでボスを作る。逃走（<hai_boss> の戦闘はいつも逃げられる）・
 * 行動の型・耐性は Hai_Battle（P4）、固定ドロップは Hai_Items（P9）のまま。
 * 詳しくは docs/plugins/Hai_Boss.md。
 *
 * ■ 敵のメモ欄
 *   <hai_boss>                   ボスの印（P4・P9 と共通）
 *   <hai_boss_name:看守長グラウ>   戦闘の頭に出す名前（無ければ敵の名前）
 *   <hai_actions:2>              1 ターンに 2 回行動（固定。MZ の「行動回数追加」は使わない）
 *   <hai_actions_low:3,50>       HP 50% 以下なら 3 回行動
 *   <hai_transform:197,30>       HP 30% 以下になった最初の行動の終わりに敵 197 へ形態変化。
 *                                HP の割合は引き継ぐ。何行でも書ける（段階ごとに 1 行）
 *   <hai_weak_hint:雷>           雷の弱点を突かれた最初の 1 回に「〜は雷に弱いようだ。」。
 *                                Hai_Thoughts があればメモにも 1 行。何行でも書ける
 *   <hai_boss_switch:151>        倒したらスイッチ 151 を ON。何行でも書ける
 *   <hai_endure:5>               耐える戦い：5 ターン目の終わりまで味方が立っていれば勝ち
 *                                （倒さなくてよい。勝ちは撃破と同じ扱いで、撃破の旗も立つ）
 *
 * ■ プラグインコマンド「ボス戦」
 *   話しかけて始める型のボスに使う。逃走可・敗北不可（負けたら Hai_Defeat の全滅の処理）。
 *   逃げたら指定の場所へ移す（マップ ID 0 なら移さない）。
 *   結果は Hai.Boss.lastResult()（0 勝ち／1 逃げた／2 負け）。条件分岐のスクリプトで見る。
 *
 * ■ 窓口（window.Hai.Boss）
 *   isBoss(enemy)  defeated(troopId)  phase(enemy)  lastResult()  knownWeak(enemyId)
 *   endureTurns()  endureLeft()  endured()
 *
 * @param nameFormat
 * @text 名前の表示
 * @desc 戦闘の頭の 1 行。%1 がボスの名前。
 * @type string
 * @default ――%1――
 *
 * @param transformMessage
 * @text 形態変化の文章
 * @desc %1 が変わる前の名前。
 * @type string
 * @default %1の姿が変わった！
 *
 * @param hintMessage
 * @text 弱点のヒントの文章
 * @desc %1 が敵の名前、%2 が属性の名前。
 * @type string
 * @default %1は%2に弱いようだ。
 *
 * @param hintNote
 * @text 弱点のメモ
 * @desc Hai_Thoughts のメモに残す 1 行。%1 が敵の名前、%2 が属性の名前。空にすると残さない。
 * @type string
 * @default %1は%2に弱い。
 *
 * @param weakRate
 * @text 弱点とみなす有効度
 * @desc 属性有効度がこの値以上のとき、ヒントを出す（1.5 なら 150% 以上）。
 * @type number
 * @decimals 2
 * @default 1.50
 *
 * @param endureFormat
 * @text 耐える戦いの残りの表示
 * @desc ターンの頭に戦闘ログへ出す。%1 が残りのターン数（このターンを含む）。空にすると出さない。
 * @type string
 * @default 残り %1 ターン
 *
 * @param endureMessage
 * @text 耐えきったときの文章
 * @desc 勝ちの文章の前に出す。空にすると出さない。
 * @type string
 * @default 耐えきった。
 *
 * @command bossBattle
 * @text ボス戦
 * @desc 逃走可・敗北不可の戦闘を始める。結果は Hai.Boss.lastResult()。
 *
 * @arg troopId
 * @text 敵グループ
 * @type troop
 * @default 0
 *
 * @arg escapeMapId
 * @text 逃げたときのマップ
 * @desc 0 ならその場に残る。
 * @type number
 * @default 0
 *
 * @arg escapeX
 * @text 逃げたときの X
 * @type number
 * @default 0
 *
 * @arg escapeY
 * @text 逃げたときの Y
 * @type number
 * @default 0
 *
 * @arg escapeDirection
 * @text 逃げたときの向き
 * @type select
 * @option そのまま
 * @value 0
 * @option 下
 * @value 2
 * @option 左
 * @value 4
 * @option 右
 * @value 6
 * @option 上
 * @value 8
 * @default 0
 */
(() => {
  "use strict";
  const pluginName = "Hai_Boss";
  const params = PluginManager.parameters(pluginName);
  const nameFormat = params.nameFormat ?? "――%1――";
  const transformMessage = params.transformMessage || "%1の姿が変わった！";
  const hintMessage = params.hintMessage || "%1は%2に弱いようだ。";
  const hintNote = params.hintNote ?? "%1は%2に弱い。";
  const weakRate = Number(params.weakRate || 1.5);
  const endureFormat = params.endureFormat ?? "残り %1 ターン";
  const endureMessage = params.endureMessage ?? "耐えきった。";

  // ---------------------------------------------------------------- 状態（$gameSystem._hai.boss）
  function state() {
    $gameSystem._hai = $gameSystem._hai || {};
    const s = ($gameSystem._hai.boss = $gameSystem._hai.boss || {});
    s.defeated = s.defeated || {};
    s.weak = s.weak || {};
    if (s.lastResult === undefined) s.lastResult = -1;
    return s;
  }

  // ---------------------------------------------------------------- タグを読む
  function dataOf(enemy) {
    if (!enemy) return null;
    if (typeof enemy === "number") return $dataEnemies[enemy] || null;
    if (enemy instanceof Game_Enemy) return enemy.enemy();
    return enemy;
  }

  /** 同じタグを何行でも読む（meta は最後の 1 つしか持たないので、note を直接読む）。 */
  function tagValues(data, tag) {
    if (!data || !data.note) return [];
    const re = new RegExp(`<${tag}:([^>]*)>`, "g");
    const out = [];
    for (const m of data.note.matchAll(re)) out.push(m[1].trim());
    return out;
  }

  function isBoss(enemy) {
    const data = dataOf(enemy);
    return !!(data && data.meta && data.meta.hai_boss);
  }

  function bossName(enemy) {
    const name = enemy.enemy().meta.hai_boss_name;
    return typeof name === "string" && name.trim() ? name.trim() : enemy.name();
  }

  function actionCount(data, hpRate) {
    const low = String(data.meta.hai_actions_low || "").split(",").map(Number);
    if (low.length === 2 && low[0] > 0 && hpRate * 100 <= low[1]) return Math.floor(low[0]);
    const n = Number(data.meta.hai_actions || 0);
    return n > 0 ? Math.floor(n) : 0;
  }

  function transformsOf(data) {
    return tagValues(data, "hai_transform")
      .map(v => v.split(",").map(Number))
      .filter(([to, rate]) => to > 0 && $dataEnemies[to] && rate >= 0)
      .map(([to, rate]) => ({ from: data.id, to, rate }));
  }

  function elementIdOf(name) {
    if (/^\d+$/.test(name)) return Number(name);
    return $dataSystem.elements.indexOf(name);
  }

  function weakHints(data) {
    return tagValues(data, "hai_weak_hint")
      .map(name => ({ name: /^\d+$/.test(name) ? $dataSystem.elements[Number(name)] : name, id: elementIdOf(name) }))
      .filter(h => h.id > 0);
  }

  function bossSwitches(data) {
    return tagValues(data, "hai_boss_switch").map(Number).filter(n => n > 0);
  }

  /** 耐える戦いのターン数（今の敵グループの <hai_endure> のいちばん大きい値。無ければ 0）。 */
  function endureTurns() {
    if (!$gameParty.inBattle()) return 0;
    let n = 0;
    for (const enemy of $gameTroop.members()) {
      for (const data of [enemy.enemy(), $dataEnemies[enemy._haiBossBase]]) {
        const v = data && data.meta ? Number(data.meta.hai_endure) : 0;
        if (v > n) n = Math.floor(v);
      }
    }
    return n;
  }

  /** 残りのターン数（今のターンを含む）。耐える戦いでなければ 0。 */
  function endureLeft() {
    const n = endureTurns();
    if (n <= 0) return 0;
    const done = BattleManager._phase === "turn" ? $gameTroop.turnCount() - 1 : $gameTroop.turnCount();
    return Math.max(0, n - done);
  }

  function format(text, ...args) {
    return text.replace(/%(\d)/g, (s, n) => (args[n - 1] !== undefined ? args[n - 1] : s));
  }

  // ---------------------------------------------------------------- 窓口
  window.Hai = window.Hai || {};
  Hai.Boss = {
    /** 敵（Game_Enemy・敵のデータ・敵 ID）がボスか。 */
    isBoss,
    /** その敵グループのボスを倒したことがあるか（セーブに入る）。 */
    defeated: troopId => !!state().defeated[troopId],
    /** その敵の形態（1 が最初。形態変化ごとに 1 増える）。戦闘の外では 0。 */
    phase: enemy => (enemy instanceof Game_Enemy ? enemy._haiBossPhase || 1 : 0),
    /** 「ボス戦」コマンドの最後の結果（0 勝ち／1 逃げた／2 負け、まだなら -1）。 */
    lastResult: () => state().lastResult,
    /** ヒントで分かった弱点の属性 ID（U1 の敵の情報・P8 の理知の間の材料）。 */
    knownWeak: enemyId => (state().weak[enemyId] || []).slice(),
    /** 今の戦闘のボス（いなければ null）。 */
    currentBoss: () => ($gameParty.inBattle() ? $gameTroop.members().find(e => isBoss(e)) || null : null),
    actionCount: (enemyId, hpRate = 1) => actionCount($dataEnemies[enemyId], hpRate),
    transforms: enemyId => transformsOf($dataEnemies[enemyId]),
    /** 耐える戦いのターン数（耐える戦いでなければ 0）。 */
    endureTurns,
    /** 耐える戦いの残りのターン数（今のターンを含む）。 */
    endureLeft,
    /** 今の戦闘を耐えきったか（勝ちの処理に入ったら true）。 */
    endured: () => !!BattleManager._haiEndured,
  };

  // ---------------------------------------------------------------- ボス戦（プラグインコマンド）
  PluginManager.registerCommand(pluginName, "bossBattle", function(args) {
    const troopId = Number(args.troopId || 0);
    if (!$dataTroops[troopId] || $gameParty.inBattle()) return;
    const escape = {
      mapId: Number(args.escapeMapId || 0),
      x: Number(args.escapeX || 0),
      y: Number(args.escapeY || 0),
      d: Number(args.escapeDirection || 0),
    };
    state().lastResult = -1;
    // 「戦闘の処理」と同じ（Hai_Defeat が全滅を拾えるように command301 を通す）
    this.command301([0, troopId, true, false]);
    const callback = BattleManager._eventCallback;
    BattleManager.setEventCallback(result => {
      if (callback) callback(result);
      state().lastResult = result;
      if (result === 1 && escape.mapId > 0) {
        $gamePlayer.reserveTransfer(escape.mapId, escape.x, escape.y, escape.d, 0);
      }
    });
  });

  // ---------------------------------------------------------------- 名前の表示
  const _BattleManager_displayStartMessages = BattleManager.displayStartMessages;
  BattleManager.displayStartMessages = function() {
    const boss = $gameTroop.members().find(e => isBoss(e));
    if (boss && nameFormat) $gameMessage.add(format(nameFormat, bossName(boss)));
    _BattleManager_displayStartMessages.apply(this, arguments);
  };

  // ---------------------------------------------------------------- 複数行動
  const _Game_Enemy_setup = Game_Enemy.prototype.setup;
  Game_Enemy.prototype.setup = function(enemyId) {
    _Game_Enemy_setup.apply(this, arguments);
    this._haiBossBase = enemyId;
    this._haiBossPhase = 1;
    this._haiBossDone = [];
    this._haiBossHinted = [];
    preloadForms(enemyId);
  };

  /** 形態変化の先の絵を先に読んでおく（読み込みの間、敵の絵が消えないように）。 */
  function preloadForms(enemyId, seen = []) {
    if (seen.includes(enemyId)) return;
    seen.push(enemyId);
    for (const t of transformsOf($dataEnemies[enemyId])) {
      const data = $dataEnemies[t.to];
      if (data.battlerName) {
        if ($gameSystem.isSideView()) ImageManager.loadSvEnemy(data.battlerName);
        else ImageManager.loadEnemy(data.battlerName);
      }
      preloadForms(t.to, seen);
    }
  }

  const _Game_Enemy_makeActionTimes = Game_Enemy.prototype.makeActionTimes;
  Game_Enemy.prototype.makeActionTimes = function() {
    const n = actionCount(this.enemy(), this.hpRate());
    return n > 0 ? n : _Game_Enemy_makeActionTimes.apply(this, arguments);
  };

  // ---------------------------------------------------------------- 形態変化
  /** 割合を下回った形態変化があれば行い、変わる前の名前を返す（無ければ null）。 */
  Game_Enemy.prototype.haiCheckTransform = function() {
    if (!this.isAlive()) return null;
    const done = (this._haiBossDone = this._haiBossDone || []);
    const list = transformsOf($dataEnemies[this._haiBossBase || this.enemyId()]);
    if (this.enemyId() !== this._haiBossBase) list.push(...transformsOf(this.enemy()));
    const rate = this.hpRate() * 100;
    const crossed = list.filter(t => rate <= t.rate && !done.includes(`${t.from}:${t.to}:${t.rate}`));
    if (crossed.length === 0) return null;
    for (const t of crossed) done.push(`${t.from}:${t.to}:${t.rate}`);
    // いくつも一度に下回ったら、いちばん低い割合の段へ飛ぶ
    const next = crossed.reduce((a, b) => (b.rate < a.rate ? b : a));
    if (next.to === this.enemyId()) return null;
    const oldName = this.name();
    const ratio = this.hp / this.mhp;
    this.transform(next.to);
    this.setHp(Math.max(1, Math.round(this.mhp * ratio)));
    this._haiBossPhase = (this._haiBossPhase || 1) + 1;
    return oldName;
  };

  const _BattleManager_endAction = BattleManager.endAction;
  BattleManager.endAction = function() {
    for (const enemy of $gameTroop.members()) {
      const oldName = enemy.haiCheckTransform();
      if (oldName) {
        enemy.requestEffect("whiten");
        this._logWindow.push("addText", format(transformMessage, oldName));
        this._logWindow.push("wait");
      }
    }
    _BattleManager_endAction.apply(this, arguments);
  };

  // ---------------------------------------------------------------- 弱点のヒント
  /** ダメージの属性（通常攻撃は攻撃時属性のうち一番効くもの。MZ の calcElementRate と同じ選び方）。 */
  function damageElementId(action, target) {
    const elementId = action.item().damage.elementId;
    if (elementId >= 0) return elementId;
    let best = 0;
    for (const id of action.subject().attackElements()) {
      if (!best || target.elementRate(id) > target.elementRate(best)) best = id;
    }
    return best;
  }

  function recordWeak(enemy, hint) {
    const s = state();
    const list = (s.weak[enemy.enemyId()] = s.weak[enemy.enemyId()] || []);
    if (!list.includes(hint.id)) list.push(hint.id);
    if (hintNote && window.Hai.Thoughts && Hai.Thoughts.addNote) {
      Hai.Thoughts.addNote({
        id: `boss:${enemy.enemyId()}:${hint.id}`,
        kind: "clue",
        text: format(hintNote, enemy.name(), hint.name),
      });
    }
  }

  const _Game_Action_executeHpDamage = Game_Action.prototype.executeHpDamage;
  Game_Action.prototype.executeHpDamage = function(target, value) {
    _Game_Action_executeHpDamage.apply(this, arguments);
    if (value <= 0 || !target.isEnemy()) return;
    const elementId = damageElementId(this, target);
    if (elementId <= 0 || target.elementRate(elementId) < weakRate) return;
    const hinted = (target._haiBossHinted = target._haiBossHinted || []);
    const hint = weakHints(target.enemy()).find(h => h.id === elementId && !hinted.includes(h.id));
    if (!hint) return;
    hinted.push(hint.id);
    recordWeak(target, hint);
    target._haiBossHintText = format(hintMessage, target.name(), hint.name);
  };

  const _Window_BattleLog_displayActionResults = Window_BattleLog.prototype.displayActionResults;
  Window_BattleLog.prototype.displayActionResults = function(subject, target) {
    _Window_BattleLog_displayActionResults.apply(this, arguments);
    if (target && target._haiBossHintText) {
      this.push("addText", target._haiBossHintText);
      this.push("wait");
      target._haiBossHintText = null;
    }
  };

  // ---------------------------------------------------------------- 耐える戦い
  const _BattleManager_initMembers = BattleManager.initMembers;
  BattleManager.initMembers = function() {
    _BattleManager_initMembers.apply(this, arguments);
    this._haiEndured = false;
    this._haiEndureReached = false;
  };

  const _BattleManager_startTurn = BattleManager.startTurn;
  BattleManager.startTurn = function() {
    _BattleManager_startTurn.apply(this, arguments);
    const left = endureLeft();
    if (left > 0 && endureFormat && !this.isTpb()) {
      this._logWindow.push("addText", format(endureFormat, left));
      this._logWindow.push("wait");
    }
  };

  // ターンの終わり（ステートの切れる処理のあと）に、決まったターン数に届いたかを見る
  const _BattleManager_updateTurnEnd = BattleManager.updateTurnEnd;
  BattleManager.updateTurnEnd = function() {
    _BattleManager_updateTurnEnd.apply(this, arguments);
    const n = endureTurns();
    if (n > 0 && $gameTroop.turnCount() >= n && !$gameParty.isAllDead()) this._haiEndureReached = true;
  };

  const _BattleManager_checkBattleEnd = BattleManager.checkBattleEnd;
  BattleManager.checkBattleEnd = function() {
    if (this._phase && this._haiEndureReached && !this._haiEndured && !$gameParty.isAllDead() && !$gameParty.isEscaped()) {
      this._haiEndured = true;
      if (endureMessage) $gameMessage.add(endureMessage);
      this.processVictory();
      return true;
    }
    return _BattleManager_checkBattleEnd.apply(this, arguments);
  };

  // ---------------------------------------------------------------- 撃破の旗
  const _BattleManager_processVictory = BattleManager.processVictory;
  BattleManager.processVictory = function() {
    const members = $gameTroop.members();
    if (members.some(e => isBoss(e) || isBoss(e._haiBossBase))) {
      state().defeated[$gameTroop._troopId] = true;
    }
    for (const enemy of members) {
      const ids = new Set([enemy.enemyId(), enemy._haiBossBase || enemy.enemyId()]);
      for (const id of ids) {
        for (const switchId of bossSwitches($dataEnemies[id])) $gameSwitches.setValue(switchId, true);
      }
    }
    _BattleManager_processVictory.apply(this, arguments);
  };
})();
