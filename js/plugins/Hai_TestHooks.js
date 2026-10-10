/*:
 * @target MZ
 * @plugindesc テスト用の窓口。URL に ?hai_test があるときだけ window.__game を公開する。
 * @author 灰の王国
 * @help
 * 自動テスト（tests/）から MZ の中身を触るための窓口。
 * URL に ?hai_test が付いていないとき（ふつうに遊ぶとき・PC 版）は何もしない。
 *
 * window.__game の中身（すべて関数）：
 *   scene()               今のシーンのクラス名（"Scene_Title" など）
 *   isBusy()              シーンの切り替え・フェード・場所移動の途中なら true
 *   ref(name)             "$gameMap" などのグローバルを返す
 *   newGame()             ニューゲーム（タイトルの「ニューゲーム」と同じ）
 *   mapId() / pos()       今のマップ ID / { x, y, d }
 *   transfer(mapId, x, y, d)  場所移動（向き 2下/4左/6右/8上、省略で 2）
 *   step(d)               プレイヤーを 1 歩動かす（動けたら true）。通れるかの判定は本物と同じ
 *   canPass(x, y, d)      (x, y) から向き d に進めるか（$gamePlayer の判定）
 *   tileId(x, y, z)       マップのタイル ID
 *   startBattle(troopId, canEscape, canLose)  戦闘を始める（イベントの「戦闘の処理」と同じ）
 *   strengthenParty()     パーティの攻撃力を大きくし、全回復する（戦闘を早く終わらせる）
 *   save(slot)            セーブ（Promise。セーブ画面と同じ手順）
 *   load(slot)            ロードしてマップへ（Promise。ロード画面と同じ手順）
 *   goToTitle()           タイトルへ戻る
 *   setSpeed(n)           1 回の描画ごとにゲームを n フレーム進める（早送り。既定 1）。
 *                         ヘッドレスのソフトウェア描画は遅いので、長い戦闘などで使う
 *
 * 各レーンのテストで足りない窓口は、このプラグイン（T レーン）に足すか、
 * 自分のプラグインの window.Hai.<名前> に出す。
 */
(() => {
  "use strict";
  if (!/[?&]hai_test(?:[=&]|$)/.test(window.location.search)) {
    return;
  }

  const globals = [
    "$dataSystem", "$dataMap", "$dataTroops", "$dataTilesets", "$dataMapInfos",
    "$gameTemp", "$gameSystem", "$gameScreen", "$gameSwitches", "$gameVariables",
    "$gameSelfSwitches", "$gameActors", "$gameParty", "$gameTroop", "$gameMap",
    "$gamePlayer", "$gameMessage",
  ];
  const classes = { SceneManager, BattleManager, DataManager, Input, TouchInput, Graphics };

  let speed = 1;
  const _SceneManager_determineRepeatNumber = SceneManager.determineRepeatNumber;
  SceneManager.determineRepeatNumber = function() {
    return _SceneManager_determineRepeatNumber.apply(this, arguments) * speed;
  };

  window.__game = {
    scene() {
      const s = SceneManager._scene;
      return s ? s.constructor.name : null;
    },
    isBusy() {
      const s = SceneManager._scene;
      return (
        !s || SceneManager.isSceneChanging() || !s.isStarted() || s.isBusy() ||
        (s instanceof Scene_Map && $gamePlayer.isTransferring())
      );
    },
    ref(name) {
      if (globals.includes(name)) return window[name];
      if (name in classes) return classes[name];
      throw new Error("__game.ref: 知らない名前 " + name);
    },
    newGame() {
      DataManager.setupNewGame();
      SceneManager.goto(Scene_Map);
    },
    mapId() {
      return $gameMap.mapId();
    },
    pos() {
      return { x: $gamePlayer.x, y: $gamePlayer.y, d: $gamePlayer.direction() };
    },
    transfer(mapId, x, y, d = 2) {
      $gamePlayer.reserveTransfer(mapId, x, y, d, 2);
    },
    step(d) {
      const before = $gamePlayer.x * 10000 + $gamePlayer.y;
      $gamePlayer.moveStraight(d);
      return $gamePlayer.x * 10000 + $gamePlayer.y !== before;
    },
    canPass(x, y, d) {
      return $gamePlayer.canPass(x, y, d);
    },
    tileId(x, y, z) {
      return $gameMap.tileId(x, y, z);
    },
    startBattle(troopId, canEscape = true, canLose = false) {
      BattleManager.setup(troopId, canEscape, canLose);
      $gamePlayer.makeEncounterCount();
      SceneManager.push(Scene_Battle);
    },
    strengthenParty() {
      for (const actor of $gameParty.members()) {
        actor.addParam(2, 9999); // 攻撃力
        actor.addParam(6, 999); // 敏捷性
        actor.recoverAll();
      }
    },
    save(slot) {
      $gameSystem.setSavefileId(slot);
      $gameSystem.onBeforeSave();
      return DataManager.saveGame(slot);
    },
    load(slot) {
      return DataManager.loadGame(slot).then(() => {
        Scene_Load.prototype.reloadMapIfUpdated.call(null);
        SceneManager.goto(Scene_Map);
        $gameSystem.onAfterLoad();
      });
    },
    goToTitle() {
      SceneManager.goto(Scene_Title);
    },
    setSpeed(n) {
      speed = Math.max(1, Math.floor(n));
    },
  };
})();
