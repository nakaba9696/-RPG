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
 *   newGame({ opening })  ニューゲーム（タイトルの「ニューゲーム」と同じ）。
 *                         opening が false（既定）なら目覚めの場面を飛ばす：スイッチ 111 を ON にし、
 *                         プレイヤーを拠点（Hai.Defeat.home()、無ければ Map010 (16,19)）に置いてからマップへ。
 *                         opening: true なら飛ばさない（目覚めの場面を見るテスト用）。
 *                         タイトルの「ニューゲーム」も ?hai_test では同じく飛ばす
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
 *   setup(name, opts)     旗の束（下）を立てて、その入口へ転送する。ニューゲームから始める（マップの途中からも呼べる）。
 *                         Promise。解決の値 { bundle, to: { mapId, x, y, d }, bells }
 *   checkpoints()         旗の束と行き先の名前の一覧 { bundles, targets }
 *   playCounters()        遊ぶ時間の目安に使う数 { steps, battles, bosses, thoughts, playtime }
 *                         （tests/playtime.mjs が差を取って時間に直す）
 *
 * 旗の束（T12。docs/world.md 5.10）：途中から確かめるための入口。束を選ぶと、
 * その地域までに立つ旗（鐘・ボス・仲間・生き残り・施設・道具）をまとめて立て、入口へ転送する。
 *   fort     砦だけ（目覚め・炉・シャノ・倉）                     → 砦の炉の前
 *   cleared1 地域一まで済み（営倉の鐘・ブルーノ・ヴォルフラム・アデル）→ 砦の炉の前
 *   bells2   鐘 2 つ（既定は＋記録院の鐘。焼けた村・地域五を含む） → まだの地域の入口（既定は霧の湖）
 *   bells3   鐘 3 つ（既定は＋記録院・水底の鐘。3 つ目の場面のあと）→ 最後の地域（門叩きの縄張り）の入口（既定は鋳物場の側）
 *   bells4   四つ鳴った（終盤）                                    → 境山の高みの入口
 * 行き先の名前（region1〜region5・last・summit）でも呼べる。そのときは、その地域に入る前の束を立てる
 * （region1 は fort、region2〜5 は cleared1。region5 は焼けた村の祠の番を越えた所まで）。
 * opts：
 *   bells: ["archive"|"water"|"foundry", …]  営倉のほかに鳴らした鐘（bells2 は 1 つ、bells3 は 2 つ）。
 *                                           bells3 では、残った 1 つが最後の地域になる
 *   level: n                                パーティのレベルを n にする（省略でそのまま）
 * まだ無いマップ（110 麦の街道・170 縄張り・180 灰の斜面）は、作られるまで手前の入口に送る（ENTRANCES）。
 * W12・W11・W14 がマップを作ったら、ENTRANCES の先頭にその入口を 1 行足す。
 *
 * プラグインコマンド「旗の束」（checkpoint）は、テストプレイ（エディタの「テスト」）か ?hai_test のときだけ働く。
 * 持ち主の確認部屋（Map001）から呼ぶ用。ふつうに遊ぶときは何もしない。
 *
 * 各レーンのテストで足りない窓口は、このプラグイン（T レーン）に足すか、
 * 自分のプラグインの window.Hai.<名前> に出す。
 *
 * @command checkpoint
 * @text 旗の束
 * @desc 束の旗を立てて、その地域の入口へ転送する（テストプレイのときだけ）。
 *
 * @arg name
 * @text 束か行き先
 * @type select
 * @option fort
 * @option cleared1
 * @option bells2
 * @option bells3
 * @option bells4
 * @option region1
 * @option region2
 * @option region3
 * @option region4
 * @option region5
 * @option last
 * @option summit
 * @default fort
 *
 * @arg bells
 * @text 鳴らした鐘
 * @desc 営倉のほかに鳴らした鐘（archive,water,foundry をカンマ区切り）。空なら束の既定。
 * @type string
 * @default
 *
 * @arg level
 * @text レベル
 * @desc パーティのレベル。0 ならそのまま。
 * @type number
 * @default 0
 */
(() => {
  "use strict";
  const pluginName = "Hai_TestHooks";
  const isHaiTest = /[?&]hai_test(?:[=&]|$)/.test(window.location.search);
  const FALLBACK_HOME = { mapId: 10, x: 16, y: 19, d: 2 }; // 拠点の広間（帰還の灯の前）

  // ---------------------------------------------------------------------------
  // 旗の束（T12。docs/world.md 5.10）。番号は docs/world.md 4.4 と System.json の名前
  // ---------------------------------------------------------------------------
  const BELL_COUNT_VARIABLE = 101; // 鳴らした鐘の数
  const SURVIVOR_COUNT_VARIABLE = 103; // 生き残りの数
  const SURVIVOR_SWITCHES = [172, 306, 307, 401, 407, 411, 602]; // シャノ・ヴォルフラム・アデル・アンネリーゼ・イスメネ・ピピネル・グィド
  const BELL_SWITCHES = [101, 102, 103, 104]; // 営倉・記録院・水底・鋳物場
  const SW_ALL_BELLS = 105;
  const SW_SCENE3 = 106; // 3 つ目の鐘の場面
  const OTHER_BELLS = ["archive", "water", "foundry"];
  const BELL_REGION = { archive: "region2", water: "region3", foundry: "region4" };

  // 地域を済ませたときに立つ旗。companions は呼んだ仲間（遺骸も見つけた扱い）、facilities は Hai_Facilities の部屋
  const DONE = {
    fort: { // 目覚め・炉・墓所の書き付け・シャノ（倉）
      switches: [111, 112, 171, 172], facilities: ["gate"],
    },
    prison: { // 地域一：霧の森・鉄の坑道・砦の営倉（営倉の鐘・牢番）、ブルーノ、ヴォルフラム（食堂）、アデル（稽古場）
      switches: [101, 113, 114, 151, 301, 302, 303, 305, 306, 307, 308], companions: [5], facilities: ["kitchen", "soul"],
      items: [["item", 321], ["item", 322], ["armor", 321]], // 牢番の鍵束・鐘番の角灯・見張り塔の小鐘
    },
    village: { // 焼けた村（祠の番）、ノラ、アンネリーゼ、ピピネル（森の療養小屋）。地域五と記録院の手前
      switches: [401, 405, 411], variables: { 401: 2 }, companions: [6],
    },
    archive: { // 地域五と記録院（学者・記録院の鐘）、ディル、イスメネ（書庫）。W12 が地域五の旗を足す
      requires: ["village"], switches: [102, 406, 407], companions: [7], facilities: ["lore"],
    },
    water: { // 霧の湖（沼主・ミルレーネ）と地下水道（扉の番・水底の鐘）、ゼリナ、アンセルモ
      switches: [103, 107, 503, 504], companions: [8, 9],
    },
    foundry: { // 境山の古道（鉤綱・グィド）と鋳物場（研究者の娘・鋳物場の鐘・親鐘の舌）、ベルトラン、トゥーラ、城壁の東門
      switches: [104, 174, 312, 602, 605, 614, 617], companions: [10, 11],
      items: [["item", 602], ["item", 606]], // 鉤綱・親鐘の舌
    },
  };

  // 入口。先頭から、マップが在る（MapInfos にある）最初のものへ送る。home は Hai_Defeat の拠点（無ければ砦の炉の前）
  const ENTRANCES = {
    fort: ["home"],
    region1: [{ mapId: 20, x: 35, y: 47, d: 8 }], // 霧の森の南の門（010 の外門から）
    region2: [{ mapId: 60, x: 47, y: 18, d: 4 }], // 焼けた村・入口（021 の西の焼けた道から）
    region3: [{ mapId: 70, x: 22, y: 1, d: 2 }], // 霧の湖（061 の水路の石段から）
    region4: [{ mapId: 50, x: 1, y: 18, d: 6 }], // 境山の古道（026 の東の坑道から）
    region5: [{ mapId: 63, x: 13, y: 4, d: 2 }], // 麦の街道（110。W12 が足す）ができるまでは、祠の奥の戸の前（戸に触れないよう祠の中を向く）
    last_archive: [{ mapId: 84, x: 13, y: 18, d: 8 }], // 縄張り（170。W11 が足す）ができるまでは、まだの鐘の間
    last_water: [{ mapId: 104, x: 13, y: 22, d: 8 }],
    last_foundry: [{ mapId: 94, x: 13, y: 24, d: 8 }],
    summit: [{ mapId: 19, x: 30, y: 9, d: 8 }], // 灰の斜面（180。W14 が足す）ができるまでは、城壁の東門の内（門に触れないよう北を向く。門は南の 1 歩先）
  };

  const BUNDLES = {
    fort: { label: "砦だけ", done: ["fort"], others: 0, to: "fort" },
    cleared1: { label: "地域一まで済み", done: ["fort", "prison"], others: 0, to: "fort" },
    bells2: { label: "鐘 2 つ", done: ["fort", "prison"], others: 1, to: "next" },
    bells3: { label: "鐘 3 つ（3 つ目の場面のあと）", done: ["fort", "prison"], others: 2, switches: [SW_SCENE3], to: "last" },
    bells4: { label: "四つ鳴った（終盤）", done: ["fort", "prison"], others: 3, switches: [SW_SCENE3, 108, 109], to: "summit" },
  };
  // 行き先の名前で呼んだときの束（その地域に入る前）と、足す地域
  const TARGETS = {
    fort: { bundle: "fort" },
    region1: { bundle: "fort" },
    region2: { bundle: "cleared1" },
    region3: { bundle: "cleared1" },
    region4: { bundle: "cleared1" },
    region5: { bundle: "cleared1", done: ["village"] },
    last: { bundle: "bells3" },
    summit: { bundle: "bells4" },
  };

  function resolveCheckpoint(name, opts) {
    name = String(name || "fort");
    const target = TARGETS[name];
    const bundleName = BUNDLES[name] ? name : target && target.bundle;
    const bundle = BUNDLES[bundleName];
    if (!bundle) throw new Error(`旗の束: 知らない名前 ${name}（${Object.keys(BUNDLES).concat(Object.keys(TARGETS)).join("・")}）`);
    let bells = opts.bells && opts.bells.length ? opts.bells.map(String) : OTHER_BELLS.slice(0, bundle.others);
    if (bells.length !== bundle.others || bells.some(b => !OTHER_BELLS.includes(b)) || new Set(bells).size !== bells.length) {
      throw new Error(`旗の束 ${bundleName}: 鳴らした鐘は ${OTHER_BELLS.join("・")} から ${bundle.others} つ（${bells.join("・")}）`);
    }
    const done = bundle.done.concat(bells, (target && !BUNDLES[name] && target.done) || []);
    const rest = OTHER_BELLS.filter(b => !bells.includes(b));
    let to = BUNDLES[name] ? bundle.to : name;
    if (to === "next") to = BELL_REGION[rest[0]];
    if (to === "last") to = "last_" + (rest[0] || "foundry");
    return { bundle: bundleName, done, bells: ["prison"].concat(bells), switches: bundle.switches || [], to };
  }

  function mapExists(mapId) {
    return !!($dataMapInfos && $dataMapInfos[mapId]);
  }

  function entranceOf(to) {
    for (const e of ENTRANCES[to] || []) {
      if (e === "home") {
        const h = window.Hai && Hai.Defeat && Hai.Defeat.home ? Hai.Defeat.home() : FALLBACK_HOME;
        return { mapId: h.mapId, x: h.x, y: h.y, d: h.d || 2 };
      }
      if (mapExists(e.mapId)) return { ...e };
    }
    throw new Error("旗の束: 入口が無い " + to);
  }

  function gain(kind, id) {
    const table = kind === "armor" ? $dataArmors : kind === "weapon" ? $dataWeapons : $dataItems;
    const item = table[id];
    if (item && $gameParty.numItems(item) === 0) $gameParty.gainItem(item, 1);
  }

  /** 束の旗を今のゲームに立てる（下げはしない）。 */
  function applyCheckpoint(plan, opts) {
    const seen = new Set();
    const apply = key => {
      if (seen.has(key)) return;
      seen.add(key);
      const d = DONE[key];
      for (const r of d.requires || []) apply(r);
      for (const id of d.switches || []) $gameSwitches.setValue(id, true);
      for (const [id, v] of Object.entries(d.variables || {})) $gameVariables.setValue(Number(id), v);
      for (const [kind, id] of d.items || []) gain(kind, id);
      if (window.Hai && Hai.Companions) for (const id of d.companions || []) if (!Hai.Companions.summoned().includes(id)) Hai.Companions.summon(id);
      if (window.Hai && Hai.Facilities) for (const k of d.facilities || []) Hai.Facilities.open(k);
    };
    plan.done.forEach(apply);
    for (const id of plan.switches) $gameSwitches.setValue(id, true);
    const bells = BELL_SWITCHES.filter(id => $gameSwitches.value(id)).length;
    $gameVariables.setValue(BELL_COUNT_VARIABLE, bells);
    if (bells >= BELL_SWITCHES.length) $gameSwitches.setValue(SW_ALL_BELLS, true);
    $gameVariables.setValue(SURVIVOR_COUNT_VARIABLE, SURVIVOR_SWITCHES.filter(id => $gameSwitches.value(id)).length);
    const level = Number(opts.level) || 0;
    for (const actor of $gameParty.members()) {
      if (level > 0 && actor.level < level) actor.changeLevel(level, false);
      actor.recoverAll();
    }
  }

  /** 束を立てて入口へ転送を予約する。 */
  function checkpoint(name, opts = {}) {
    const plan = resolveCheckpoint(name, opts);
    applyCheckpoint(plan, opts);
    const to = entranceOf(plan.to);
    $gamePlayer.reserveTransfer(to.mapId, to.x, to.y, to.d, 0);
    return { bundle: plan.bundle, to, bells: plan.bells };
  }

  PluginManager.registerCommand(pluginName, "checkpoint", function(args) {
    if (!isHaiTest && !$gameTemp.isPlaytest()) return; // 製品では何もしない
    const bells = String(args.bells || "").split(",").map(s => s.trim()).filter(Boolean);
    checkpoint(args.name, { bells, level: Number(args.level || 0) });
  });

  if (!isHaiTest) {
    return;
  }

  const globals = [
    "$dataSystem", "$dataMap", "$dataTroops", "$dataTilesets", "$dataMapInfos",
    "$gameTemp", "$gameSystem", "$gameScreen", "$gameSwitches", "$gameVariables",
    "$gameSelfSwitches", "$gameActors", "$gameParty", "$gameTroop", "$gameMap",
    "$gamePlayer", "$gameMessage",
  ];
  const classes = { SceneManager, BattleManager, DataManager, Input, TouchInput, Graphics };

  // 目覚めの場面（Map010 の自動実行）を飛ばす。ほかのテストがニューゲームのすぐ後に別のマップへ移れるように。
  const OPENING_DONE_SWITCH = 111; // 目覚めた
  let playOpening = false;
  const _DataManager_setupNewGame = DataManager.setupNewGame;
  DataManager.setupNewGame = function() {
    _DataManager_setupNewGame.apply(this, arguments);
    if (playOpening) return;
    $gameSwitches.setValue(OPENING_DONE_SWITCH, true);
    const h = window.Hai && Hai.Defeat && Hai.Defeat.home ? Hai.Defeat.home() : FALLBACK_HOME;
    $gamePlayer.reserveTransfer(h.mapId, h.x, h.y, h.d || 2, 0);
  };

  // 戦闘の記録（遊ぶ時間の目安。tests/playtime.mjs）。ページを読み直すと消える
  const battleLog = [];
  const isBossTroop = troopId => {
    const troop = $dataTroops[troopId];
    return !!troop && troop.members.some(m => {
      const enemy = $dataEnemies[m.enemyId];
      return enemy && enemy.meta && enemy.meta.hai_boss;
    });
  };
  const _BattleManager_setup = BattleManager.setup;
  BattleManager.setup = function(troopId) {
    _BattleManager_setup.apply(this, arguments);
    battleLog.push({ troopId, boss: isBossTroop(troopId) });
  };

  // __game.setup：ニューゲームは次の Scene_Map を作るときにする（今のマップの絵が、新しい $gameMap を描かないように）
  let pendingSetup = null;
  const _Scene_Map_create = Scene_Map.prototype.create;
  Scene_Map.prototype.create = function() {
    const p = pendingSetup;
    pendingSetup = null;
    if (p) {
      try {
        DataManager.setupNewGame();
        p.resolve(checkpoint(p.name, p.opts));
      } catch (e) {
        p.reject(e);
      }
    }
    _Scene_Map_create.apply(this, arguments);
  };

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
    newGame({ opening = false } = {}) {
      playOpening = !!opening;
      try {
        DataManager.setupNewGame();
      } finally {
        playOpening = false;
      }
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
    setup(name, opts = {}) {
      resolveCheckpoint(name, opts); // 名前の間違いはここで投げる
      return new Promise((resolve, reject) => {
        // 今の場面が始まりきってから切り替える（場所移動の直後の Scene_Map は窓がまだ無く、stop で落ちる）
        const go = () => {
          const scene = SceneManager._scene;
          const settled = scene && scene.isStarted() && !SceneManager.isSceneChanging() &&
            !(scene instanceof Scene_Map && $gamePlayer.isTransferring());
          if (!settled) return void setTimeout(go, 16);
          pendingSetup = { name, opts, resolve, reject };
          SceneManager.goto(Scene_Map);
        };
        go();
      });
    },
    checkpoints() {
      return { bundles: Object.keys(BUNDLES), targets: Object.keys(TARGETS) };
    },
    playCounters() {
      const thoughts = $gameSystem._hai && $gameSystem._hai.thoughts && $gameSystem._hai.thoughts.read;
      return {
        steps: $gameParty.steps(),
        battles: battleLog.length,
        bosses: battleLog.filter(b => b.boss).length,
        thoughts: thoughts ? Object.keys(thoughts).filter(k => thoughts[k]).length : 0,
        playtime: $gameSystem.playtime(),
      };
    },
  };
})();
