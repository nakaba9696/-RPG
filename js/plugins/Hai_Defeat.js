/*:
 * @target MZ
 * @plugindesc 全滅：ゲームオーバーにせず、魔石（所持金）をその場に落として拠点へ戻る。戻れば拾える。
 * @author 灰の王国
 * @help
 * 戦闘で全滅しても、ゲームオーバー画面にしない。
 *   1. 所持金（＝魔石）の全額を、戦った場所（マップと座標）に落とす。
 *   2. 戦闘不能のメンバーを HP 1 で起こし、全員の状態異常を解く。
 *   3. 画面を暗くしたまま拠点へ場所移動し、全滅の文章を出してから明るくする。
 * 落とした魔石はそのマップに入ると光る印で見え、踏むか調べると取り戻せる。
 *
 * ■ 落とした魔石
 *   1 か所だけ（新しく落とすと前のは消える）。パラメータ「前の魔石を残す」を ON にすると、
 *   前に落とした分も消えずに残る（どれも拾える）。所持金 0 で全滅したときは何も落とさない
 *   （「前の魔石を残す」が OFF なら、前の魔石は消える）。
 *
 * ■ 拠点
 *   プラグインコマンド「拠点を設定」（setHome）で、戻る場所を決める（拠点のイベントから呼ぶ）。
 *   マップ ID を 0 にすると、そのイベントのあるマップ。決めていなければ System の開始位置へ戻る。
 *
 * ■ 発動しないとき
 *   - イベントの「戦闘の処理」で「敗北可」にした戦闘（MZ の既定どおり、敗北の分岐へ進む）。
 *   - 戦闘テスト。逃げたとき。
 *   - 戦闘の外での全滅（マップでの床ダメージなど）は、MZ の既定のまま（ゲームオーバー）。
 *
 * ■ 全滅した戦闘を始めたイベント
 *   その場で止める（「戦闘の処理」の後ろの命令は実行しない）。ゲームオーバーで終わっていた
 *   ところなので、勝ったときの命令が負けたのに流れることを防ぐ。
 *
 * ■ 状態（セーブに入る）
 *   $gameSystem._hai.defeat = { drop: {mapId, x, y, amount} | null, kept: [...], home: {mapId, x, y, d} | null }
 *
 * ■ 他のプラグインとテストへの窓口（window.Hai.Defeat）
 *   drop()                 いちばん新しく落とした魔石 {mapId, x, y, amount}（無ければ null）
 *   drops()                拾えるすべての魔石（「前の魔石を残す」が OFF なら 0〜1 個）
 *   home()                 戻る場所 {mapId, x, y, d}（未設定なら System の開始位置）
 *   setHome(mapId, x, y, d)  戻る場所を決める
 *   markers()              今のマップに出ている印 [{x, y, amount}]
 *   recover()              いちばん新しい魔石を、その場へ行かずに取り戻す（テスト用。取り戻した額を返す）
 *   isReturning()          全滅して拠点へ戻る途中（暗転・文章）なら true
 *
 * @param defeatMessage
 * @text 全滅の文章
 * @desc 拠点に戻った暗い画面で出す文章。空にすると出さない。\N[1] などの制御文字が使える。
 * @type multiline_string
 * @default ユエルの魂は牢獄の間へ引き戻された……
 *
 * @param dropMessage
 * @text 落とした魔石の文章
 * @desc 全滅の文章の次の行に出す。%1 が額、%2 が通貨の単位。空にすると出さない。所持金 0 のときは出さない。
 * @type string
 * @default 倒れた場所に魔石（%1 %2）を落とした。
 *
 * @param recoverMessage
 * @text 取り戻したときの文章
 * @desc 落とした魔石を拾ったときの文章。%1 が額、%2 が通貨の単位。空にすると出さない。
 * @type string
 * @default 落とした魔石（%1 %2）を取り戻した。
 *
 * @param keepOld
 * @text 前の魔石を残す
 * @desc OFF：新しく落とすと前の魔石は消える（1 か所だけ）。ON：前の魔石も消えずに残る。
 * @type boolean
 * @on 残す
 * @off 消す
 * @default false
 *
 * @param fadeInFrames
 * @text 明るくする時間
 * @desc 全滅の文章を閉じたあと、画面を明るくするフレーム数（60 で 1 秒）。
 * @type number
 * @min 1
 * @default 30
 *
 * @param markerImage
 * @text 印の絵
 * @desc 落とした魔石の印に使うキャラの絵（img/characters）。
 * @type file
 * @dir img/characters/
 * @require 1
 * @default !Crystal
 *
 * @param markerIndex
 * @text 印の絵の番号
 * @desc 絵の中の何番目のキャラか（0〜7。左上から横に）。
 * @type number
 * @min 0
 * @max 7
 * @default 0
 *
 * @param markerDirection
 * @text 印の絵の向き
 * @desc キャラの絵の向きの行。!Crystal の 0 番は 2 赤・4 赤（光る）・6 紫・8 紫（光る）。
 * @type select
 * @option 下（2）
 * @value 2
 * @option 左（4）
 * @value 4
 * @option 右（6）
 * @value 6
 * @option 上（8）
 * @value 8
 * @default 8
 *
 * @command setHome
 * @text 拠点を設定
 * @desc 全滅したときに戻る場所を決める。
 *
 * @arg mapId
 * @text マップ ID
 * @desc 0 にすると、このイベントのあるマップ。
 * @type number
 * @min 0
 * @default 0
 *
 * @arg x
 * @text X
 * @type number
 * @min 0
 * @default 0
 *
 * @arg y
 * @text Y
 * @type number
 * @min 0
 * @default 0
 *
 * @arg direction
 * @text 向き
 * @type select
 * @option 下
 * @value 2
 * @option 左
 * @value 4
 * @option 右
 * @value 6
 * @option 上
 * @value 8
 * @default 2
 */
(() => {
  "use strict";
  const pluginName = "Hai_Defeat";
  const params = PluginManager.parameters(pluginName);
  // 値はすべて文字列で来る
  const defeatMessage = String(params.defeatMessage ?? "ユエルの魂は牢獄の間へ引き戻された……");
  const dropMessage = String(params.dropMessage ?? "倒れた場所に魔石（%1 %2）を落とした。");
  const recoverMessage = String(params.recoverMessage ?? "落とした魔石（%1 %2）を取り戻した。");
  const keepOld = params.keepOld === "true";
  const fadeInFrames = Math.max(1, Number(params.fadeInFrames || 30));
  const markerImage = String(params.markerImage || "!Crystal");
  const markerIndex = Number(params.markerIndex || 0);
  const markerDirection = Number(params.markerDirection || 8);

  // セーブに入る状態。古いセーブで無ければ初期値を入れる。
  function state() {
    $gameSystem._hai = $gameSystem._hai || {};
    const s = ($gameSystem._hai.defeat = $gameSystem._hai.defeat || {});
    if (s.drop === undefined) s.drop = null;
    if (!Array.isArray(s.kept)) s.kept = [];
    if (s.home === undefined) s.home = null;
    if (s.returning === undefined) s.returning = null; // null / "message" / "wait"
    return s;
  }

  const copy = obj => (obj ? { ...obj } : null);

  function allDrops() {
    const s = state();
    return s.drop ? s.kept.concat([s.drop]) : s.kept.slice();
  }

  function home() {
    const h = state().home;
    if (h) return { ...h };
    return { mapId: $dataSystem.startMapId, x: $dataSystem.startX, y: $dataSystem.startY, d: 2 };
  }

  function setHome(mapId, x, y, d = 2) {
    state().home = { mapId: Number(mapId), x: Number(x), y: Number(y), d: Number(d) || 2 };
  }

  function format(text, amount) {
    return text.replace(/%1/g, String(amount)).replace(/%2/g, TextManager.currencyUnit);
  }

  function showText(text, positionType) {
    const lines = text.split("\n").filter(line => line !== "");
    if (lines.length === 0) return false;
    $gameMessage.setBackground(0);
    $gameMessage.setPositionType(positionType);
    for (const line of lines) $gameMessage.add(line);
    return true;
  }

  // ---------------------------------------------------------------------------
  // 全滅したときの処理（戦闘の終わり、ゲームオーバー画面の手前）

  // 全滅した戦闘を始めた「戦闘の処理」のインタープリタ（セーブには入らない）
  let battleInterpreter = null;

  function rootInterpreters() {
    const list = [$gameMap._interpreter];
    for (const event of $gameMap.events()) {
      if (event._interpreter) list.push(event._interpreter);
    }
    for (const common of $gameMap._commonEvents || []) {
      if (common && common._interpreter) list.push(common._interpreter);
    }
    return list;
  }

  // 戦闘を始めたイベントを止める（コモンイベントの呼び出しの中からなら、呼び出した元ごと）
  function abortBattleEvent() {
    const target = battleInterpreter;
    battleInterpreter = null;
    if (!target) return;
    for (const root of rootInterpreters()) {
      for (let i = root; i; i = i._childInterpreter) {
        if (i === target) {
          root.terminate();
          return;
        }
      }
    }
    target.terminate();
  }

  function dropGold() {
    const s = state();
    const amount = $gameParty.gold();
    if (keepOld) {
      if (s.drop) s.kept.push(s.drop);
      s.drop = null;
    } else {
      s.kept = [];
    }
    s.drop = amount > 0 ? { mapId: $gameMap.mapId(), x: $gamePlayer.x, y: $gamePlayer.y, amount } : null;
    $gameParty.loseGold(amount);
    return amount;
  }

  function reviveParty() {
    for (const actor of $gameParty.members()) {
      actor.clearStates();
      if (actor.hp <= 0) actor.setHp(1);
      actor.refresh();
    }
  }

  function onDefeat() {
    const amount = dropGold();
    reviveParty();
    abortBattleEvent();
    const h = home();
    // 暗いまま移す（場所移動のフェードは使わず、画面の明るさを 0 にしておく）
    $gameScreen.startFadeOut(1);
    $gamePlayer.reserveTransfer(h.mapId, h.x, h.y, h.d, 2);
    $gameTemp.clearDestination();
    const s = state();
    s.returning = "message";
    s.lastAmount = amount;
  }

  function isTakenOver(manager) {
    return !manager.isBattleTest() && !manager._escaped && !manager._canLose && $gameParty.isAllDead();
  }

  // ゲームオーバー画面へ進む分岐だけを置き換える（敗北可・逃走・勝利・戦闘テストは元のまま）
  const _BattleManager_updateBattleEnd = BattleManager.updateBattleEnd;
  BattleManager.updateBattleEnd = function() {
    if (isTakenOver(this)) {
      onDefeat();
      SceneManager.pop();
      this._phase = "";
      return;
    }
    battleInterpreter = null;
    _BattleManager_updateBattleEnd.apply(this, arguments);
  };

  const _Game_Interpreter_command301 = Game_Interpreter.prototype.command301;
  Game_Interpreter.prototype.command301 = function() {
    if (!$gameParty.inBattle()) battleInterpreter = this;
    return _Game_Interpreter_command301.apply(this, arguments);
  };

  // 拠点に着いたら：文章 → 閉じたら明るくする
  function updateReturning() {
    const s = state();
    if (!s.returning || $gamePlayer.isTransferring()) return;
    if (s.returning === "message") {
      if ($gameMessage.isBusy()) return;
      let text = defeatMessage;
      if (s.lastAmount > 0 && dropMessage) text += "\n" + format(dropMessage, s.lastAmount);
      s.returning = showText(text, 1) ? "wait" : "fade";
    }
    if (s.returning === "wait" && $gameMessage.isBusy()) return;
    $gameScreen.startFadeIn(fadeInFrames);
    s.returning = null;
    s.lastAmount = 0;
  }

  // ---------------------------------------------------------------------------
  // 落とした魔石の印（マップのイベントではなく、プラグインが持つキャラ。セーブには入らない）

  let markers = [];
  let markersKey = "";

  function makeMarker(drop) {
    const c = new Game_Character();
    c.setImage(markerImage, markerIndex);
    c.setDirection(markerDirection);
    c.setDirectionFix(true);
    c.setPriorityType(0);
    c.setThrough(true);
    c.setStepAnime(true);
    c.setMoveSpeed(3);
    c.locate(drop.x, drop.y);
    c._haiDrop = drop;
    return c;
  }

  function syncMarkers() {
    const mapId = $gameMap.mapId();
    const here = allDrops().filter(d => d.mapId === mapId);
    const key = mapId + ":" + JSON.stringify(here);
    if (key !== markersKey) {
      markersKey = key;
      markers = here.map(makeMarker);
    }
  }

  function recoverDrop(drop) {
    const s = state();
    if (s.drop === drop) s.drop = null;
    else s.kept = s.kept.filter(d => d !== drop);
    $gameParty.gainGold(drop.amount);
    syncMarkers();
    return drop.amount;
  }

  function recoverAt(x, y) {
    const mapId = $gameMap.mapId();
    const drop = allDrops()
      .reverse()
      .find(d => d.mapId === mapId && d.x === x && d.y === y);
    if (!drop) return false;
    const amount = recoverDrop(drop);
    if (recoverMessage) showText(format(recoverMessage, amount), 2);
    return true;
  }

  function canRecoverNow() {
    return !$gameMap.isEventRunning() && !$gameMessage.isBusy() && !state().returning;
  }

  const _Game_Map_update = Game_Map.prototype.update;
  Game_Map.prototype.update = function() {
    _Game_Map_update.apply(this, arguments);
    updateReturning();
    syncMarkers();
    for (const m of markers) m.update();
  };

  // 踏んだとき・足元で決定したとき
  const _Game_Player_checkEventTriggerHere = Game_Player.prototype.checkEventTriggerHere;
  Game_Player.prototype.checkEventTriggerHere = function(triggers) {
    _Game_Player_checkEventTriggerHere.apply(this, arguments);
    if (this.canStartLocalEvents() && canRecoverNow()) recoverAt(this.x, this.y);
  };

  // 向かい合って調べたとき
  const _Game_Player_checkEventTriggerThere = Game_Player.prototype.checkEventTriggerThere;
  Game_Player.prototype.checkEventTriggerThere = function(triggers) {
    _Game_Player_checkEventTriggerThere.apply(this, arguments);
    if (this.canStartLocalEvents() && canRecoverNow()) {
      const d = this.direction();
      recoverAt($gameMap.roundXWithDirection(this.x, d), $gameMap.roundYWithDirection(this.y, d));
    }
  };

  const _Spriteset_Map_createCharacters = Spriteset_Map.prototype.createCharacters;
  Spriteset_Map.prototype.createCharacters = function() {
    _Spriteset_Map_createCharacters.apply(this, arguments);
    this._haiMarkerSprites = [];
    this._haiMarkersKey = null;
    this.updateHaiMarkers();
  };

  Spriteset_Map.prototype.updateHaiMarkers = function() {
    syncMarkers();
    if (this._haiMarkersKey === markersKey) return;
    this._haiMarkersKey = markersKey;
    for (const sprite of this._haiMarkerSprites) {
      this._tilemap.removeChild(sprite);
      sprite.destroy();
    }
    this._haiMarkerSprites = markers.map(m => new Sprite_Character(m));
    for (const sprite of this._haiMarkerSprites) this._tilemap.addChild(sprite);
  };

  const _Spriteset_Map_update = Spriteset_Map.prototype.update;
  Spriteset_Map.prototype.update = function() {
    _Spriteset_Map_update.apply(this, arguments);
    if (this._haiMarkerSprites) this.updateHaiMarkers();
  };

  // ---------------------------------------------------------------------------

  PluginManager.registerCommand(pluginName, "setHome", function(args) {
    const mapId = Number(args.mapId || 0) || $gameMap.mapId();
    setHome(mapId, Number(args.x || 0), Number(args.y || 0), Number(args.direction || 2));
  });

  window.Hai = window.Hai || {};
  Hai.Defeat = {
    drop: () => copy(state().drop),
    drops: () => allDrops().map(copy),
    home,
    setHome,
    markers() {
      syncMarkers();
      return markers.map(m => ({ x: m.x, y: m.y, amount: m._haiDrop.amount }));
    },
    recover() {
      const drop = state().drop;
      return drop ? recoverDrop(drop) : 0;
    },
    isReturning: () => !!state().returning,
    params: { keepOld, fadeInFrames, markerImage, markerIndex, markerDirection },
  };
})();
