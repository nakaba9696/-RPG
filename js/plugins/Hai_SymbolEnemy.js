/*:
 * @target MZ
 * @plugindesc シンボル敵：マップ上を動く敵。色で強さが分かり、近づくと弱く追い、接触で戦闘。
 * @author 灰の王国
 * @help
 * マップのイベントをシンボル敵にする。戦闘は原則すべて任意で、敵は見切って避けられる。
 *
 * ■ メモ欄（イベントのメモ欄。ページではなくイベント全体）
 *   <hai_enemy:101,green>   敵グループ 101 と戦う緑（弱い）の敵。強さは green / yellow / red
 *   <hai_enemy_once>        勝ったら二度と出ない（ボス用）。無ければマップを出入りすると復活する
 *   <hai_enemy_chase:6>     この敵だけ追い始める距離を変える（0 で追わない）
 *
 * ■ 動き
 *   ふだんはページの「自律移動」（固定・ランダム・近づく・カスタム）のとおりに動く。
 *   プレイヤーが「追い始める距離」以内（縦と横の歩数の和）にいて、間に壁が無く
 *   まっすぐ見えるときだけ、プレイヤーに向かって歩く（速さは「追う速さ」）。
 *   回り道はしないので、角を曲がって見えなくなれば追うのをやめ、元の動きに戻る。
 *
 * ■ 接触で戦闘
 *   トリガーが「プレイヤーから接触」でも「イベントから接触」でも、どちらからぶつかっても戦闘になる。
 *   ページの実行内容に命令があれば、それを先に実行してから戦闘する（ボスの台詞など）。
 *   戦闘は逃走可・敗北不可（敗北時の処理は P5 で決める）。
 *   - 勝ったら：そのイベントのセルフスイッチ A を ON にし、マップから消える。
 *   - 逃げたら：「すり抜ける時間」のあいだ、その敵はプレイヤーをすり抜け、追わず、戦闘にならない。
 *
 * ■ 色
 *   強さごとに、キャラの絵に色を重ねる（パラメータの「緑」「黄」「赤」。赤・緑・青・強さ 0〜255）。
 *
 * ■ 他のプラグインとテストへの窓口（window.Hai.SymbolEnemy）
 *   isSymbolEnemy(event)  シンボル敵か
 *   rankOf(event)         "green" / "yellow" / "red"（シンボル敵でなければ null）
 *   troopOf(event)        敵グループの ID
 *   state(event)          { chasing, flee, through, defeated }
 *   canSeePlayer(event)   今プレイヤーを追える位置にいるか
 *   colorOf(rank)         その強さの色 [赤, 緑, 青, 強さ]
 *
 * @param chaseRange
 * @text 追い始める距離
 * @desc プレイヤーがこの歩数以内（縦と横の和）にいて、まっすぐ見えるときに追う。
 * @type number
 * @min 0
 * @default 4
 *
 * @param chaseSpeed
 * @text 追う速さ
 * @desc 追っているときの移動速度（1〜6。プレイヤーの歩きは 4、ダッシュは 5）。プレイヤーより遅くする。
 * @type number
 * @min 1
 * @max 6
 * @default 3
 *
 * @param fleeFrames
 * @text すり抜ける時間
 * @desc 逃げたあと、その敵がプレイヤーをすり抜けて追わないフレーム数（60 で 1 秒）。
 * @type number
 * @min 0
 * @default 180
 *
 * @param greenColor
 * @text 緑（弱い）の色
 * @desc 絵に重ねる色。赤,緑,青,強さ（0〜255）。
 * @type string
 * @default 48,224,64,144
 *
 * @param yellowColor
 * @text 黄（中くらい）の色
 * @desc 絵に重ねる色。赤,緑,青,強さ（0〜255）。
 * @type string
 * @default 255,208,0,144
 *
 * @param redColor
 * @text 赤（強い）の色
 * @desc 絵に重ねる色。赤,緑,青,強さ（0〜255）。
 * @type string
 * @default 255,32,32,176
 *
 * @command defeated
 * @text 勝ったとき（自動で使う）
 * @desc このイベントのセルフスイッチ A を ON にして消す。シンボル敵の戦闘のあとに自動で実行される。
 *
 * @command escaped
 * @text 逃げたとき（自動で使う）
 * @desc このイベントをしばらくすり抜けにする。シンボル敵の戦闘のあとに自動で実行される。
 */
(() => {
  "use strict";
  const pluginName = "Hai_SymbolEnemy";
  const params = PluginManager.parameters(pluginName);
  // 値はすべて文字列で来る
  const chaseRange = Number(params.chaseRange || 4);
  const chaseSpeed = Number(params.chaseSpeed || 3);
  const fleeFrames = Number(params.fleeFrames || 180);
  const parseColor = (text, fallback) => {
    const c = String(text || fallback).split(",").map(Number);
    return c.length === 4 && c.every(n => Number.isFinite(n)) ? c : fallback.split(",").map(Number);
  };
  const COLORS = {
    green: parseColor(params.greenColor, "48,224,64,144"),
    yellow: parseColor(params.yellowColor, "255,208,0,144"),
    red: parseColor(params.redColor, "255,32,32,176"),
  };
  const NO_COLOR = [0, 0, 0, 0];
  const SELF_SWITCH = "A";

  // メモ欄 <hai_enemy:troopId,rank> を読む。シンボル敵でなければ null。
  function infoOf(event) {
    const data = event && event instanceof Game_Event ? event.event() : null;
    const tag = data && data.meta ? data.meta.hai_enemy : null;
    if (!tag || tag === true) return null;
    const [troop, rank] = String(tag).split(",").map(s => s.trim());
    const range = data.meta.hai_enemy_chase;
    return {
      troopId: Number(troop),
      rank: COLORS[rank] ? rank : "green",
      once: !!data.meta.hai_enemy_once,
      chaseRange: range === undefined || range === true ? chaseRange : Number(range),
    };
  }

  // イベントごとの状態（Game_Event に置くので、$gameMap ごとセーブに入る）
  function stateOf(event) {
    if (!event._haiSymbol) event._haiSymbol = { chasing: false, flee: 0 };
    return event._haiSymbol;
  }

  function isDefeated(mapId, eventId) {
    return $gameSelfSwitches.value([mapId, eventId, SELF_SWITCH]);
  }

  // 間のマスがすべて通れる（壁・岩が無い）か。両端は見ない。
  function isLineClear(x0, y0, x1, y1) {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let x = x0;
    let y = y0;
    for (;;) {
      const e2 = err * 2;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
      if (x === x1 && y === y1) return true;
      if (![2, 4, 6, 8].some(d => $gameMap.isPassable(x, y, d))) return false;
    }
  }

  function canSeePlayer(event) {
    const info = infoOf(event);
    if (!info || info.chaseRange <= 0 || $gamePlayer.isInVehicle()) return false;
    const dx = Math.abs($gameMap.deltaX(event.x, $gamePlayer.x));
    const dy = Math.abs($gameMap.deltaY(event.y, $gamePlayer.y));
    if (dx + dy > info.chaseRange) return false;
    return isLineClear(event.x, event.y, $gamePlayer.x, $gamePlayer.y);
  }

  // 接触したときに実行する命令：ページの命令（あれば）→ 戦闘 → 勝ったら消える／逃げたらすり抜ける
  function battleList(pageList, troopId) {
    const head = (pageList || []).slice(0, -1);
    return head.concat([
      { code: 301, indent: 0, parameters: [0, troopId, true, false] },
      { code: 601, indent: 0, parameters: [] },
      { code: 357, indent: 1, parameters: [pluginName, "defeated", "勝ったとき（自動で使う）", {}] },
      { code: 0, indent: 1, parameters: [] },
      { code: 602, indent: 0, parameters: [] },
      { code: 357, indent: 1, parameters: [pluginName, "escaped", "逃げたとき（自動で使う）", {}] },
      { code: 0, indent: 1, parameters: [] },
      { code: 604, indent: 0, parameters: [] },
      { code: 0, indent: 0, parameters: [] },
    ]);
  }

  window.Hai = window.Hai || {};
  Hai.SymbolEnemy = {
    isSymbolEnemy: event => !!infoOf(event),
    rankOf: event => (infoOf(event) || {}).rank || null,
    troopOf: event => (infoOf(event) || {}).troopId || 0,
    state(event) {
      if (!infoOf(event)) return null;
      const s = stateOf(event);
      return {
        chasing: s.chasing,
        flee: s.flee,
        through: event.isThrough(),
        defeated: isDefeated($gameMap.mapId(), event.eventId()),
      };
    },
    canSeePlayer,
    colorOf: rank => (COLORS[rank] || NO_COLOR).slice(),
    params: { chaseRange, chaseSpeed, fleeFrames },
  };

  PluginManager.registerCommand(pluginName, "defeated", function() {
    const event = $gameMap.event(this.eventId());
    if (this._mapId === $gameMap.mapId() && event) {
      $gameSelfSwitches.setValue([this._mapId, event.eventId(), SELF_SWITCH], true);
    }
  });

  PluginManager.registerCommand(pluginName, "escaped", function() {
    const event = $gameMap.event(this.eventId());
    if (this._mapId === $gameMap.mapId() && event && infoOf(event)) {
      const s = stateOf(event);
      s.flee = fleeFrames;
      s.chasing = false;
      event.setMoveSpeed(s.baseSpeed || event._moveSpeed);
      event.setThrough(true);
    }
  });

  // マップに入ったとき：一度きりでない敵は復活させる（セルフスイッチ A を OFF）
  const _Game_Map_setup = Game_Map.prototype.setup;
  Game_Map.prototype.setup = function(mapId) {
    if ($dataMap && Array.isArray($dataMap.events)) {
      for (const data of $dataMap.events) {
        const tag = data && data.meta ? data.meta.hai_enemy : null;
        if (tag && tag !== true && !data.meta.hai_enemy_once) {
          $gameSelfSwitches.setValue([mapId, data.id, SELF_SWITCH], false);
        }
      }
    }
    _Game_Map_setup.apply(this, arguments);
  };

  // 勝った敵（セルフスイッチ A が ON）は、どのページも出さない（絵も当たりも無くなる）
  const _Game_Event_findProperPageIndex = Game_Event.prototype.findProperPageIndex;
  Game_Event.prototype.findProperPageIndex = function() {
    if (infoOf(this) && isDefeated(this._mapId, this._eventId)) return -1;
    return _Game_Event_findProperPageIndex.apply(this, arguments);
  };

  const _Game_Event_setupPageSettings = Game_Event.prototype.setupPageSettings;
  Game_Event.prototype.setupPageSettings = function() {
    _Game_Event_setupPageSettings.apply(this, arguments);
    if (!infoOf(this)) return;
    const s = stateOf(this);
    s.baseSpeed = this._moveSpeed;
    s.chasing = false;
    if (s.flee > 0) this.setThrough(true);
  };

  const _Game_Event_list = Game_Event.prototype.list;
  Game_Event.prototype.list = function() {
    const list = _Game_Event_list.apply(this, arguments);
    const info = infoOf(this);
    return info && list && this.isTriggerIn([0, 1, 2]) ? battleList(list, info.troopId) : list;
  };

  // すり抜けている間は戦闘にならない
  const _Game_Event_start = Game_Event.prototype.start;
  Game_Event.prototype.start = function() {
    if (infoOf(this) && stateOf(this).flee > 0) return;
    _Game_Event_start.apply(this, arguments);
  };

  // 「プレイヤーから接触」の敵も、敵の側からぶつかったら戦闘にする
  const _Game_Event_checkEventTriggerTouch = Game_Event.prototype.checkEventTriggerTouch;
  Game_Event.prototype.checkEventTriggerTouch = function(x, y) {
    _Game_Event_checkEventTriggerTouch.apply(this, arguments);
    if (
      this._trigger === 1 && infoOf(this) && !this._starting && !$gameMap.isEventRunning() &&
      $gamePlayer.pos(x, y) && !this.isJumping() && this.isNormalPriority()
    ) {
      this.start();
    }
  };

  // 追う：見えている間だけ、プレイヤーに向かって 1 歩ずつ（回り道はしない）
  const _Game_Event_updateSelfMovement = Game_Event.prototype.updateSelfMovement;
  Game_Event.prototype.updateSelfMovement = function() {
    if (infoOf(this) && this._pageIndex >= 0 && !this._locked) {
      const s = stateOf(this);
      const chase = s.flee <= 0 && canSeePlayer(this);
      if (chase !== s.chasing) {
        s.chasing = chase;
        this.setMoveSpeed(chase ? chaseSpeed : s.baseSpeed || this._moveSpeed);
        this.resetStopCount();
      }
      if (chase) {
        this.moveTowardPlayer();
        return;
      }
    }
    _Game_Event_updateSelfMovement.apply(this, arguments);
  };

  // すり抜けの残り時間を減らす。プレイヤーと重なっている間は終わらせない
  const _Game_Event_update = Game_Event.prototype.update;
  Game_Event.prototype.update = function() {
    _Game_Event_update.apply(this, arguments);
    const s = this._haiSymbol;
    if (s && s.flee > 0 && !$gameMap.isEventRunning()) {
      if (s.flee > 1 || !$gamePlayer.pos(this.x, this.y)) s.flee -= 1;
      if (s.flee <= 0) {
        const page = this.page();
        this.setThrough(page ? page.through : false);
      }
    }
  };

  // 色＝強さ
  const _Sprite_Character_updateOther = Sprite_Character.prototype.updateOther;
  Sprite_Character.prototype.updateOther = function() {
    _Sprite_Character_updateOther.apply(this, arguments);
    const info = infoOf(this._character);
    if (info) {
      this.setBlendColor(COLORS[info.rank]);
      this._haiTinted = true;
    } else if (this._haiTinted) {
      this.setBlendColor(NO_COLOR);
      this._haiTinted = false;
    }
  };
})();
