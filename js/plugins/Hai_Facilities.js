/*:
 * @target MZ
 * @plugindesc 砦の部屋：生き残りが来たら開く。稽古場・食堂・倉・書庫・療養所・鍛冶場・見張り台。
 * @author 灰の王国
 * @orderAfter Hai_Items
 * @orderAfter Hai_Craft
 * @orderAfter Hai_Companions
 * @help
 * ■ 部屋が開く
 *   生き残りが砦に来たら、その場面のイベントでプラグインコマンド「部屋を開く」（open）を呼ぶ。
 *   開いたら、その部屋のスイッチ（既定 121〜127）を ON にする。開く順は決まっていない。
 *   崩れた扉のイベントは、1 ページ目にプラグインコマンド「崩れた扉」（door）を置く（閉じていれば一行出す）。
 *   扉の開いたページは、出現条件をその部屋のスイッチにして、場所移動を置く。
 *   （叡智のオーブと台座はやめた。古いマップの「台座」（pedestal）は「崩れた扉」と同じに動く。）
 *
 * ■ 魂
 *   戦闘に勝つと、倒した敵 1 体につき魂を 1（<hai_boss> の敵はパラメータ「ボスの魂」）得る。
 *   敵のメモ欄に <hai_soul:5> と書くと、その敵の魂の数を決められる。
 *   稽古場が開くまでも数は増える（勝利の文に出すのは、稽古場が開いてから）。
 *
 * ■ 部屋（プラグインコマンド「部屋を使う」）
 *   稽古場  控えの仲間に魂を与えてレベルを 1 つ上げる（前に出ている仲間の最高レベルまで）
 *   食堂    Hai_Craft の合成の画面
 *   倉      Hai_Items の倉庫から引き出す・袋から預ける
 *   書庫    倒したボスの一覧・読んだ思念と戻った記憶の数・拾った言い残し・写しの読み比べ
 *           「読み比べのスイッチ」が ON なら灰色・茶色の二冊、「三通り目のスイッチ」が ON ならテオの紙を並べる（P15）
 *           「朝の砦のスイッチ」が ON の間、「読んだ思念」の見出しは「送った人」になる（P14）
 *   療養所  全員の状態異常を治す。開いている間、消耗品の所持上限が 1 つ増える（Hai_Items）
 *   鍛冶場  一点ものの装備を魂で鍛え直す（能力が上がる）。鉄切り鋏を打つ（スイッチ 313 を ON）
 *   見張り台  訪れたマップの地図を隅まで埋める（Hai_AutoMap）。開いている間、転送の行き先が増える（Hai_Warp）
 *
 * ■ 状態（セーブに入る）
 *   $gameSystem._hai.facilities = { opened: { soul: true }, souls: 12, bosses: [5] }
 *   古いセーブで無ければ、読むときにスイッチから開いた部屋を写して作る。
 *
 * ■ 窓口（window.Hai.Facilities）は docs/plugins/Hai_Facilities.md
 *
 * @param switches
 * @text 部屋のスイッチ
 * @desc 稽古場・食堂・倉・書庫・療養所・鍛冶場・見張り台の順に、開いたら ON にするスイッチ（カンマ区切り。0 で写さない。足りない分は既定）。
 * @type string
 * @default 121,122,123,124,125,126,127
 *
 * @param names
 * @text 部屋の名前
 * @desc 稽古場・食堂・倉・書庫・療養所・鍛冶場・見張り台の順（カンマ区切り。足りない分は既定）。
 * @type string
 * @default 稽古場,食堂,倉,書庫,療養所,鍛冶場,見張り台
 *
 * @param openSe
 * @text 部屋が開いたときの効果音
 * @desc プラグインコマンド「部屋を開く」で新しく開いたとき。空にすると鳴らさない。
 * @type file
 * @dir audio/se/
 * @default Open2
 *
 * @param closedMessage
 * @text 閉じた部屋の文
 * @desc 崩れた扉を調べたとき・閉じた部屋を使おうとしたとき。
 * @type string
 * @default 扉が崩れて、瓦礫で塞がっている。
 *
 * @param bossSouls
 * @text ボスの魂
 * @desc <hai_boss> の敵 1 体で得る魂（<hai_soul> が無いとき）。
 * @type number
 * @min 0
 * @default 10
 *
 * @param soulMessage
 * @text 魂を得たときの文
 * @desc 戦闘に勝ったときの文。%1 が数。空にすると出さない。稽古場が開くまでは出さない。
 * @type string
 * @default 魂を %1 手に入れた。
 *
 * @param soulCostRate
 * @text レベル 1 つに要る魂
 * @desc 今のレベル × この数の魂で 1 つ上がる。
 * @type number
 * @min 1
 * @default 1
 *
 * @param soulCapByBattle
 * @text 前の仲間に追いつくまで
 * @desc ON：前に出ている仲間の最高レベルまでしか上げられない（控えを追いつかせる部屋にする）。
 * @type boolean
 * @on 追いつくまで
 * @off 上限なし
 * @default true
 *
 * @param soulSe
 * @text レベルを上げたときの効果音
 * @type file
 * @dir audio/se/
 * @require 1
 * @default Up4
 *
 * @param infirmaryMessage
 * @text 療養所の文
 * @desc 療養所で休んだとき。
 * @type string
 * @default 寝台で休んだ。体の障りが抜けた。
 *
 * @param infirmarySe
 * @text 療養所の効果音
 * @type file
 * @dir audio/se/
 * @require 1
 * @default Recovery
 *
 * @param infirmaryItemMax
 * @text 療養所で増える所持上限
 * @desc 療養所が開いている間、消耗品の所持上限（Hai_Items の itemMax）に足す数。
 * @type number
 * @min 0
 * @default 1
 *
 * @param forgeCost
 * @text 鍛え直しに要る魂
 * @desc 1 回目にこの数、2 回目に 2 倍……（回数 × この数）。
 * @type number
 * @min 0
 * @default 20
 *
 * @param forgeMax
 * @text 鍛え直せる回数
 * @desc 一点ものの装備 1 つにつき。
 * @type number
 * @min 1
 * @default 2
 *
 * @param forgeRate
 * @text 1 回で上がる割合
 * @desc 装備の能力（0 でないもの）がこの割合（%）だけ上がる。少なくとも 1。
 * @type number
 * @min 1
 * @default 20
 *
 * @param forgeSe
 * @text 鍛え直したときの効果音
 * @type file
 * @dir audio/se/
 * @require 1
 * @default Hammer
 *
 * @param shearsItem
 * @text 鉄切り鋏のアイテム
 * @desc 鍛冶場で打つ。持っているとスイッチ「鉄切り鋏のスイッチ」が ON（拾い屋の頭の店で買ったときも）。
 * @type item
 * @default 1001
 *
 * @param shearsSwitch
 * @text 鉄切り鋏のスイッチ
 * @desc 鉄格子のイベント（W）が見るスイッチ。
 * @type switch
 * @default 313
 *
 * @param watchMessage
 * @text 見張り台の文
 * @desc 烽火の台から見渡したとき。
 * @type string
 * @default 歩いた土地を見渡した。地図の隅まで埋まった。
 *
 * @param watchSe
 * @text 見張り台の効果音
 * @type file
 * @dir audio/se/
 * @require 1
 * @default Wind1
 *
 * @param watchDestinations
 * @text 見張り台で増える転送の行き先
 * @desc 名前:マップID:x:y:向き をカンマで区切る。見張り台が開いていて、そのマップを訪れていれば結界の転送の一覧に出る。
 * @type string
 * @default 霧の森の門:20:35:47:8,焼けた村の入口:60:47:18:4,霧の湖の石段:70:22:1:2,境山の古道の口:50:1:18:6
 *
 * @param morningSwitch
 * @text 朝の砦のスイッチ
 * @desc ON の間、書庫の「読んだ思念」の見出しを「送った人の見出し」にする（結末のあと。0 で替えない）。
 * @type switch
 * @default 1165
 *
 * @param sentTitle
 * @text 送った人の見出し
 * @type string
 * @default 送った人
 *
 * @param copiesSwitch
 * @text 読み比べのスイッチ
 * @desc ON なら、書庫の「写しの読み比べ」に灰色・茶色の二冊を出す（014 の二つ目の書見台で読み比べた。0 で出さない）。
 * @type switch
 * @default 179
 *
 * @param thirdCopySwitch
 * @text 三通り目のスイッチ
 * @desc ON なら、書庫の「写しの読み比べ」に三通り目（テオの紙）を足す（121 のテオで見た。0 で出さない）。
 * @type switch
 * @default 1057
 *
 * @command door
 * @text 崩れた扉
 * @desc 部屋が閉じていれば「扉が崩れて、瓦礫で塞がっている。」を出す。開いていれば何もしない。
 *
 * @arg door
 * @text どの部屋の扉か
 * @type select
 * @option 稽古場
 * @value soul
 * @option 食堂
 * @value kitchen
 * @option 倉
 * @value gate
 * @option 書庫
 * @value lore
 * @option 療養所
 * @value infirmary
 * @option 鍛冶場
 * @value smithy
 * @option 見張り台
 * @value watch
 * @default soul
 *
 * @command open
 * @text 部屋を開く
 * @desc 生き残りが砦に来たときに呼ぶ。部屋を開き、その部屋のスイッチを ON にする（文は出さない。効果音だけ）。
 *
 * @arg facility
 * @text 部屋
 * @type select
 * @option 稽古場
 * @value soul
 * @option 食堂
 * @value kitchen
 * @option 倉
 * @value gate
 * @option 書庫
 * @value lore
 * @option 療養所
 * @value infirmary
 * @option 鍛冶場
 * @value smithy
 * @option 見張り台
 * @value watch
 * @default soul
 *
 * @command use
 * @text 部屋を使う
 * @desc 部屋の画面を開く（閉じていれば「扉が崩れて、瓦礫で塞がっている。」）。
 *
 * @arg facility
 * @text 部屋
 * @type select
 * @option 稽古場
 * @value soul
 * @option 食堂
 * @value kitchen
 * @option 倉
 * @value gate
 * @option 書庫
 * @value lore
 * @option 療養所
 * @value infirmary
 * @option 鍛冶場
 * @value smithy
 * @option 見張り台
 * @value watch
 * @default soul
 */
(() => {
  "use strict";
  const pluginName = "Hai_Facilities";
  const params = PluginManager.parameters(pluginName);
  const list = (s, d) => String(s ?? d).split(",").map(t => t.trim());
  /** 部屋の鍵（稽古場・食堂・倉・書庫・療養所・鍛冶場・見張り台。前の 4 つの名前は前の世界の名残り）。 */
  const KEYS = ["soul", "kitchen", "gate", "lore", "infirmary", "smithy", "watch"];
  const DEFAULT_SWITCHES = [121, 122, 123, 124, 125, 126, 127];
  const DEFAULT_NAMES = ["稽古場", "食堂", "倉", "書庫", "療養所", "鍛冶場", "見張り台"];
  // plugins.js の値が 4 部屋の頃のままでも、足りない分は既定で埋める
  const fill = (given, defaults) => defaults.map((d, i) => (given[i] !== undefined && given[i] !== "" ? given[i] : d));
  const P = {
    switches: fill(list(params.switches, DEFAULT_SWITCHES.join()), DEFAULT_SWITCHES).map(Number),
    names: fill(list(params.names, DEFAULT_NAMES.join()), DEFAULT_NAMES),
    openSe: params.openSe ?? "Open2",
    closedMessage: params.closedMessage ?? "扉が崩れて、瓦礫で塞がっている。",
    bossSouls: Number(params.bossSouls ?? 10),
    soulMessage: params.soulMessage ?? "魂を %1 手に入れた。",
    soulCostRate: Math.max(1, Number(params.soulCostRate || 1)),
    soulCapByBattle: params.soulCapByBattle !== "false",
    soulSe: params.soulSe ?? "Up4",
    infirmaryMessage: params.infirmaryMessage ?? "寝台で休んだ。体の障りが抜けた。",
    infirmarySe: params.infirmarySe ?? "Recovery",
    infirmaryItemMax: Number(params.infirmaryItemMax ?? 1),
    forgeCost: Math.max(0, Number(params.forgeCost ?? 20)),
    forgeMax: Math.max(1, Number(params.forgeMax || 2)),
    forgeRate: Math.max(1, Number(params.forgeRate || 20)),
    forgeSe: params.forgeSe ?? "Hammer",
    shearsItem: Number(params.shearsItem ?? 1001),
    shearsSwitch: Number(params.shearsSwitch ?? 313),
    watchMessage: params.watchMessage ?? "歩いた土地を見渡した。地図の隅まで埋まった。",
    watchSe: params.watchSe ?? "Wind1",
    watchDestinations: String(params.watchDestinations ?? "霧の森の門:20:35:47:8,焼けた村の入口:60:47:18:4,霧の湖の石段:70:22:1:2,境山の古道の口:50:1:18:6")
      .split(",")
      .map(t => t.trim().split(":"))
      .filter(a => a.length >= 4 && a[0])
      .map(([name, mapId, x, y, d]) => ({ name, mapId: Number(mapId), x: Number(x), y: Number(y), d: Number(d) || 2 })),
    morningSwitch: Number(params.morningSwitch ?? 1165),
    sentTitle: params.sentTitle || "送った人",
    copiesSwitch: Number(params.copiesSwitch ?? 179),
    thirdCopySwitch: Number(params.thirdCopySwitch ?? 1057),
  };
  const indexOf = key => KEYS.indexOf(String(key));
  const nameOf = key => P.names[indexOf(key)] || String(key);
  const playSe = name => name && AudioManager.playSe({ name, volume: 90, pitch: 100, pan: 0 });

  // ---------------------------------------------------------------------------
  // 状態（$gameSystem._hai.facilities）
  // ---------------------------------------------------------------------------
  function state() {
    $gameSystem._hai = $gameSystem._hai || {};
    let s = $gameSystem._hai.facilities;
    if (!s) {
      // 古いセーブ：部屋のスイッチが入っていれば開いた扱いにする
      s = $gameSystem._hai.facilities = { opened: {}, souls: 0, bosses: [], forged: {} };
      KEYS.forEach((key, i) => {
        if (P.switches[i] > 0 && $gameSwitches && $gameSwitches.value(P.switches[i])) s.opened[key] = true;
      });
    }
    s.opened = s.opened || {};
    s.souls = Number(s.souls) || 0;
    if (!Array.isArray(s.bosses)) s.bosses = [];
    if (!s.forged || typeof s.forged !== "object") s.forged = {}; // P13 より前のセーブ
    return s;
  }

  const isOpen = key => !!state().opened[key];
  const opened = () => KEYS.filter(isOpen);
  /** まだ閉じている部屋の鍵の一覧。 */
  const closed = () => KEYS.filter(key => !isOpen(key));

  function syncFlags() {
    KEYS.forEach((key, i) => {
      if (P.switches[i] > 0) $gameSwitches.setValue(P.switches[i], isOpen(key));
    });
  }

  /** 部屋を開く（生き残りが砦に来たとき）。新しく開いたら true。 */
  function open(key) {
    if (indexOf(key) < 0 || isOpen(key)) return false;
    state().opened[key] = true;
    syncFlags();
    return true;
  }

  // ---------------------------------------------------------------------------
  // 療養所（状態異常を治す・消耗品の所持上限を足す）
  // ---------------------------------------------------------------------------
  /** パーティ全員（控えも）の状態異常を治す（戦闘不能は除く）。治した数。 */
  function cure() {
    let n = 0;
    for (const actor of $gameParty.members()) {
      for (const st of actor.states()) {
        if (st.id === actor.deathStateId()) continue;
        actor.removeState(st.id);
        n++;
      }
    }
    return n;
  }
  const itemMaxBonus = () => ($gameSystem && isOpen("infirmary") ? Math.max(0, P.infirmaryItemMax) : 0);

  // ---------------------------------------------------------------------------
  // 鍛冶場（一点ものの装備を魂で鍛え直す・鉄切り鋏）
  // ---------------------------------------------------------------------------
  const isEquipItem = item => !!item && (DataManager.isWeapon(item) || DataManager.isArmor(item));
  const equipKey = item => (DataManager.isWeapon(item) ? "w:" : "a:") + item.id;
  const isForgeable = item => isEquipItem(item) && !!(item.meta && item.meta.hai_unique);
  const equipOf = (kind, id) => (String(kind).startsWith("w") ? $dataWeapons : $dataArmors)[Number(id)] || null;
  const forgedLevel = item => (isForgeable(item) ? Number(state().forged[equipKey(item)]) || 0 : 0);
  const forgeCostOf = item => P.forgeCost * (forgedLevel(item) + 1);
  const canForge = item => isForgeable(item) && forgedLevel(item) < P.forgeMax && state().souls >= forgeCostOf(item);

  /** 鍛え直す（魂を払って回数を 1 つ増やす）。鍛え直したら true。 */
  function forge(item) {
    if (!canForge(item)) return false;
    const s = state();
    s.souls -= forgeCostOf(item);
    s.forged[equipKey(item)] = forgedLevel(item) + 1;
    for (const actor of $gameParty.members()) actor.refresh();
    return true;
  }

  /** 鍛え直した分の能力（0 でない能力が forgeRate% × 回数。少なくとも 1）。 */
  function forgeBonus(item, paramId) {
    const n = forgedLevel(item);
    const base = item.params[paramId];
    if (n <= 0 || !(base > 0)) return 0;
    return Math.max(1, Math.ceil((base * P.forgeRate * n) / 100));
  }

  /** 鍛え直せる物：袋と、パーティの誰かが装備している一点もの（同じ物は 1 つ）。 */
  function forgeables() {
    const out = [];
    const add = item => {
      if (isForgeable(item) && !out.includes(item)) out.push(item);
    };
    $gameParty.equipItems().forEach(add);
    for (const actor of $gameParty.members()) actor.equips().forEach(add);
    return out;
  }

  const _Game_Actor_paramPlus = Game_Actor.prototype.paramPlus;
  Game_Actor.prototype.paramPlus = function(paramId) {
    let value = _Game_Actor_paramPlus.apply(this, arguments);
    if ($gameSystem && $gameSystem._hai && $gameSystem._hai.facilities) {
      for (const item of this.equips()) if (item) value += forgeBonus(item, paramId);
    }
    return value;
  };

  const shearsItem = () => $dataItems[P.shearsItem] || null;
  /** 鉄切り鋏を打つ（持っていなければ袋に 1 つ）。打ったら true。 */
  function makeShears() {
    const item = shearsItem();
    if (!item || $gameParty.hasItem(item)) return false;
    $gameParty.gainItem(item, 1);
    return true;
  }
  // 鉄切り鋏を手に入れたら（鍛冶場でも店でも）、鉄格子のイベントが見るスイッチを ON
  const _Game_Party_gainItem = Game_Party.prototype.gainItem;
  Game_Party.prototype.gainItem = function(item) {
    _Game_Party_gainItem.apply(this, arguments);
    if (item && item === shearsItem() && P.shearsSwitch > 0 && this.hasItem(item)) $gameSwitches.setValue(P.shearsSwitch, true);
  };

  // ---------------------------------------------------------------------------
  // 見張り台（訪れたマップの全図・転送の行き先）
  // ---------------------------------------------------------------------------
  /** 訪れたマップの地図を隅まで埋める（Hai_AutoMap）。埋めたマップの数。 */
  function reveal() {
    const am = window.Hai && Hai.AutoMap;
    return am && am.revealVisited ? am.revealVisited() : 0;
  }
  function isVisitedMap(mapId) {
    const am = window.Hai && Hai.AutoMap;
    if (am) return am.visitedCount(mapId) > 0;
    const rec = $gameSystem._hai && $gameSystem._hai.automap;
    return !!(rec && rec[mapId]);
  }
  /** 見張り台が開いていれば増える転送の行き先（訪れたマップのものだけ）。 */
  function watchDestinations() {
    if (!$gameSystem || !isOpen("watch")) return [];
    return P.watchDestinations.filter(d => $dataMapInfos[d.mapId] && isVisitedMap(d.mapId)).map(d => ({ ...d }));
  }

  // ほかのプラグイン（並びが後ろのものも）に窓口を足すのは、全部が読み終わってから
  const _Scene_Boot_start = Scene_Boot.prototype.start;
  Scene_Boot.prototype.start = function() {
    _Scene_Boot_start.apply(this, arguments);
    if (window.Hai && Hai.Items && Hai.Items.addItemMaxRule && !Scene_Boot._haiFacilitiesHooked) {
      Hai.Items.addItemMaxRule(itemMaxBonus);
    }
    if (window.Hai && Hai.Warp && Hai.Warp.addSource && !Scene_Boot._haiFacilitiesHooked) {
      Hai.Warp.addSource(watchDestinations);
    }
    Scene_Boot._haiFacilitiesHooked = true;
  };

  // ---------------------------------------------------------------------------
  // 魂
  // ---------------------------------------------------------------------------
  function soulsOf(enemyId) {
    const enemy = $dataEnemies[Number(enemyId)];
    if (!enemy) return 0;
    const tag = enemy.meta && enemy.meta.hai_soul;
    if (tag !== undefined && tag !== true) return Math.max(0, Number(tag) || 0);
    return enemy.meta && enemy.meta.hai_boss ? P.bossSouls : 1;
  }

  function addSouls(n) {
    const s = state();
    s.souls = Math.max(0, s.souls + (Number(n) || 0));
    return s.souls;
  }

  function recordBoss(enemyId) {
    const s = state();
    enemyId = Number(enemyId);
    if ($dataEnemies[enemyId] && !s.bosses.includes(enemyId)) s.bosses.push(enemyId);
  }

  const _BattleManager_makeRewards = BattleManager.makeRewards;
  BattleManager.makeRewards = function() {
    _BattleManager_makeRewards.apply(this, arguments);
    this._rewards.souls = $gameTroop.deadMembers().reduce((n, enemy) => n + soulsOf(enemy.enemyId()), 0);
  };

  const _BattleManager_displayRewards = BattleManager.displayRewards;
  BattleManager.displayRewards = function() {
    _BattleManager_displayRewards.apply(this, arguments);
    const n = (this._rewards && this._rewards.souls) || 0;
    if (n > 0 && isOpen("soul") && P.soulMessage) $gameMessage.add("\\." + P.soulMessage.format(n));
  };

  const _BattleManager_gainRewards = BattleManager.gainRewards;
  BattleManager.gainRewards = function() {
    _BattleManager_gainRewards.apply(this, arguments);
    addSouls((this._rewards && this._rewards.souls) || 0);
    for (const enemy of $gameTroop.deadMembers()) {
      if (enemy.enemy().meta.hai_boss) recordBoss(enemy.enemyId());
    }
  };

  /** 稽古場で上げられる上限のレベル（前に出ている仲間の最高レベル。上限なしなら最高レベル）。 */
  function soulCap(actor) {
    if (!P.soulCapByBattle) return actor.maxLevel();
    const top = Math.max(0, ...$gameParty.battleMembers().map(a => a.level));
    return Math.min(actor.maxLevel(), top);
  }
  const soulCost = actor => actor.level * P.soulCostRate;
  const canRaise = actor => !!actor && actor.level < soulCap(actor) && state().souls >= soulCost(actor);

  /** 魂を与えてレベルを 1 つ上げる。上げたら true。 */
  function raise(actorId) {
    const actor = $gameActors.actor(Number(actorId));
    if (!actor || !$gameParty.members().includes(actor) || !canRaise(actor)) return false;
    state().souls -= soulCost(actor);
    actor.changeLevel(actor.level + 1, false);
    return true;
  }

  // ---------------------------------------------------------------------------
  // 崩れた扉（閉じていれば一行）
  // ---------------------------------------------------------------------------
  const cmd = (code, parameters, indent = 0) => ({ code, indent, parameters });
  const textCmds = (lines, indent = 0) => [cmd(101, ["", 0, 0, 2, ""], indent), ...lines.map(l => cmd(401, [l], indent))];

  function doorList(door) {
    if (isOpen(door)) return [cmd(0, [])];
    return [...textCmds([P.closedMessage]), cmd(0, [])];
  }

  // ---------------------------------------------------------------------------
  // 稽古場（仲間の一覧。決定で魂を与えてレベルを 1 つ上げる）
  // ---------------------------------------------------------------------------
  class Window_HaiSouls extends Window_MenuStatus {
    isCurrentItemEnabled() {
      return canRaise(this.actor(this.index()));
    }
    drawItem(index) {
      super.drawItem(index);
      const actor = this.actor(index);
      const rect = this.itemLineRect(index);
      const y = rect.y + Math.floor(rect.height / 2 - this.lineHeight() / 2);
      let text;
      if (actor.level >= soulCap(actor)) {
        this.changeTextColor(ColorManager.textColor(8));
        text = "これ以上は上げられない";
      } else {
        this.changeTextColor(state().souls >= soulCost(actor) ? ColorManager.powerUpColor() : ColorManager.deathColor());
        text = `魂 ${soulCost(actor)} で Lv ${actor.level + 1} へ`;
      }
      this.drawText(text, rect.x, y, rect.width, "right");
      this.resetTextColor();
    }
  }

  class Scene_HaiSouls extends Scene_MenuBase {
    create() {
      super.create();
      this.createHelpWindow();
      const top = this.mainAreaTop();
      this._statusWindow = new Window_HaiSouls(new Rectangle(0, top, Graphics.boxWidth, this.mainAreaHeight()));
      this._statusWindow.setHandler("ok", this.onOk.bind(this));
      this._statusWindow.setHandler("cancel", this.popScene.bind(this));
      this.addWindow(this._statusWindow);
      this._statusWindow.select(0);
      this._statusWindow.activate();
      this.refreshHelp();
    }
    start() {
      super.start();
      this._statusWindow.refresh(); // 顔の画像が読み終わってから描き直す（Scene_Menu と同じ）
    }
    refreshHelp() {
      const cap = P.soulCapByBattle ? "前に出ている仲間のレベルまで上げられる。" : "";
      this._helpWindow.setText(`手持ちの魂 ${state().souls}\n魂を与えると、レベルが 1 つ上がる。${cap}`);
    }
    onOk() {
      const actor = this._statusWindow.actor(this._statusWindow.index());
      if (actor && raise(actor.actorId())) playSe(P.soulSe);
      this._statusWindow.refresh();
      this.refreshHelp();
      this._statusWindow.activate();
    }
  }

  // ---------------------------------------------------------------------------
  // 倉（倉庫から引き出す／袋から預ける）
  // ---------------------------------------------------------------------------
  const Items = () => window.Hai && Hai.Items;
  /** 預けられる物：袋の中のアイテム（大事なもの・隠しアイテムを除く）・武器・防具。 */
  function bagEntries() {
    return $gameParty
      .allItems()
      .filter(item => !DataManager.isItem(item) || item.itypeId === 1)
      .map(item => ({ kind: Items().kindOf(item), id: item.id }));
  }

  class Window_HaiGateList extends Window_Selectable {
    initialize(rect) {
      super.initialize(rect);
      this._mode = "take";
      this._data = [];
      this.refresh();
    }
    setMode(mode) {
      if (this._mode !== mode) {
        this._mode = mode;
        this.refresh();
        this.scrollTo(0, 0);
        this.select(0);
      }
    }
    mode() {
      return this._mode;
    }
    maxItems() {
      return this._data.length;
    }
    current() {
      return this._data[this.index()] || null;
    }
    itemAt(index) {
      const e = this._data[index];
      return e ? Items().itemOf(e.kind, e.id) : null;
    }
    isEnabledAt(index) {
      const item = this.itemAt(index);
      if (!item) return false;
      return this._mode === "take" ? Items().roomFor(item) > 0 : $gameParty.numItems(item) > 0;
    }
    isCurrentItemEnabled() {
      return this.isEnabledAt(this.index());
    }
    refresh() {
      this._data = this._mode === "take" ? Items().storage().map(e => ({ kind: e.kind, id: e.id })) : bagEntries();
      super.refresh();
    }
    drawItem(index) {
      const item = this.itemAt(index);
      if (!item) return;
      const rect = this.itemLineRect(index);
      this.changePaintOpacity(this.isEnabledAt(index));
      this.drawItemName(item, rect.x, rect.y, rect.width - 320);
      const max = Items().maxOf(item);
      const have = `${$gameParty.numItems(item)}/${max >= 99 ? "-" : max}`;
      const kind = Items().kindOf(item);
      this.drawText(`倉庫 ${Items().storageCount(kind, item.id)}　手持ち ${have}`, rect.x, rect.y, rect.width, "right");
      this.changePaintOpacity(true);
    }
    drawAllItems() {
      super.drawAllItems();
      if (this.maxItems() === 0) {
        const rect = this.itemLineRect(0);
        this.changePaintOpacity(false);
        this.drawText(this._mode === "take" ? "倉庫は空だ。" : "預けられる物を持っていない。", rect.x, rect.y, rect.width);
        this.changePaintOpacity(true);
      }
    }
    updateHelp() {
      this.setHelpWindowItem(this.itemAt(this.index()));
    }
  }

  class Window_HaiGateCommand extends Window_HorzCommand {
    maxCols() {
      return 2;
    }
    makeCommandList() {
      this.addCommand("引き出す", "take");
      this.addCommand("預ける", "put");
    }
    update() {
      super.update();
      if (this._listWindow && this.active) this._listWindow.setMode(this.currentSymbol());
    }
    setListWindow(w) {
      this._listWindow = w;
    }
  }

  class Scene_HaiGate extends Scene_MenuBase {
    create() {
      super.create();
      this.createHelpWindow();
      const top = this.mainAreaTop();
      const ch = this.calcWindowHeight(1, true);
      this._commandWindow = new Window_HaiGateCommand(new Rectangle(0, top, Graphics.boxWidth, ch));
      this._commandWindow.setHandler("take", this.onCommand.bind(this));
      this._commandWindow.setHandler("put", this.onCommand.bind(this));
      this._commandWindow.setHandler("cancel", this.popScene.bind(this));
      this.addWindow(this._commandWindow);
      const y = top + ch;
      this._listWindow = new Window_HaiGateList(new Rectangle(0, y, Graphics.boxWidth, this.mainAreaBottom() - y));
      this._listWindow.setHelpWindow(this._helpWindow);
      this._listWindow.setHandler("ok", this.onMove.bind(this));
      this._listWindow.setHandler("cancel", this.onListCancel.bind(this));
      this.addWindow(this._listWindow);
      this._commandWindow.setListWindow(this._listWindow);
      this._commandWindow.activate();
    }
    onCommand() {
      this._listWindow.setMode(this._commandWindow.currentSymbol());
      this._listWindow.select(Math.max(0, Math.min(this._listWindow.index(), this._listWindow.maxItems() - 1)));
      this._listWindow.activate();
    }
    onListCancel() {
      this._listWindow.deselect();
      this._helpWindow.clear();
      this._commandWindow.activate();
    }
    onMove() {
      const e = this._listWindow.current();
      const moved = e && (this._listWindow.mode() === "take" ? Items().takeFromStorage(e.kind, e.id, 1) : Items().putToStorage(e.kind, e.id, 1));
      if (moved > 0) SoundManager.playEquip();
      this._listWindow.refresh();
      this._listWindow.select(Math.max(0, Math.min(this._listWindow.index(), this._listWindow.maxItems() - 1)));
      this._listWindow.activate();
    }
  }

  // ---------------------------------------------------------------------------
  // 書庫（倒したボス・読んだ思念と戻った記憶。写しの読み比べは名前だけ）
  // ---------------------------------------------------------------------------
  function bossLines(enemyId) {
    const enemy = $dataEnemies[enemyId];
    const weak = [];
    const strong = [];
    for (const t of enemy.traits || []) {
      if (t.code === Game_BattlerBase.TRAIT_ELEMENT_RATE) {
        const name = $dataSystem.elements[t.dataId];
        if (name && t.value > 1) weak.push(name);
        else if (name && t.value < 1) strong.push(name);
      } else if (t.code === Game_BattlerBase.TRAIT_STATE_RATE) {
        const st = $dataStates[t.dataId];
        if (st && st.name && t.value > 1) weak.push(st.name);
        else if (st && st.name && t.value < 1) strong.push(st.name);
      } else if (t.code === Game_BattlerBase.TRAIT_STATE_RESIST) {
        const st = $dataStates[t.dataId];
        if (st && st.name) strong.push(st.name);
      }
    }
    const uniq = a => [...new Set(a)];
    return [
      `\\C[16]${enemy.name}\\C[0]`,
      `　弱い：${uniq(weak).join("・") || "分からない"}`,
      `　強い：${uniq(strong).join("・") || "分からない"}`,
    ];
  }

  function readThoughts() {
    const t = $gameSystem._hai && $gameSystem._hai.thoughts;
    return t && t.read ? Object.keys(t.read).filter(k => t.read[k]).length : 0;
  }

  const LORE = [
    { symbol: "bosses", name: "倒したボス" },
    { symbol: "thoughts", name: "読んだ思念" },
    { symbol: "legacies", name: "言い残し" },
    { symbol: "copies", name: "写しの読み比べ" },
  ];

  /** 書庫の見出し。朝の砦（スイッチ ON）では「読んだ思念」が「送った人」になる。 */
  function loreName(symbol) {
    if (symbol === "thoughts" && P.morningSwitch > 0 && $gameSwitches.value(P.morningSwitch)) return P.sentTitle;
    const c = LORE.find(l => l.symbol === symbol);
    return c ? c.name : "";
  }

  function loreLines(symbol) {
    if (symbol === "bosses") {
      const ids = state().bosses.filter(id => $dataEnemies[id]);
      return ids.length ? ids.flatMap(bossLines) : ["まだ倒したボスはいない。"];
    }
    if (symbol === "thoughts") {
      const th = window.Hai && Hai.Thoughts;
      const notes = th ? th.notes().length : 0;
      const faint = th && th.faintCount ? th.faintCount() : 0;
      return [`${loreName("thoughts")}　${readThoughts()}`, `戻った記憶　${faint}`, `メモ　${notes}`];
    }
    if (symbol === "legacies") {
      // 拾った分だけ並べる（無いことは、一覧に出ないことで分かる）
      const th = window.Hai && Hai.Thoughts;
      const list = th && th.legacies ? th.legacies() : [];
      return list.flatMap(l => [`\\C[16]${l.speaker}\\C[0]`, `　${l.text}`]);
    }
    if (symbol === "copies") return copiesLines();
    return [];
  }

  // 写しの読み比べ（P15。文は場面表 docs/story/scenes/02-region2-region5.md の 3-28・3-29）。
  // 「乗せよ」の一行は 014 の書庫でだけ読ませてよい（world.md 10 章）。三通り目の行の中身は、どこにも書かない。
  const COPIES = [
    "\\C[16]灰色の写し\\C[0]",
    "　灰色の方の、終わりの近くに、一行。",
    "　「鳴る音に、その日の者を乗せよ」",
    "\\C[16]茶色の写し\\C[0]",
    "　茶色の方には、無い行。",
  ];
  const THIRD_COPY = [
    "\\C[16]三通り目\\C[0]",
    "　テオの紙。",
    "　「どこに置いたかは、写しておきませんでした」",
  ];
  // 最後にイスメネの記録の一行（三通り目を見ていれば「どれが」。3-29 の返すときの行）
  const ISMENE = "\\C[16]イスメネ\\C[0]";
  const NOT_WRITTEN = { two: "　どちらが本物かは、書きません。分からないので。まだ", three: "　どれが本物かは、書きません。分からないので。まだ" };
  const switchOn = id => id > 0 && $gameSwitches.value(id);
  function copiesLines() {
    const two = switchOn(P.copiesSwitch);
    const third = switchOn(P.thirdCopySwitch);
    if (!two && !third) return ["読み比べる写しは、まだ一冊もない。"];
    return [...(two ? COPIES : []), ...(third ? THIRD_COPY : []), ISMENE, third ? NOT_WRITTEN.three : NOT_WRITTEN.two];
  }

  class Window_HaiLoreCommand extends Window_Command {
    makeCommandList() {
      for (const c of LORE) this.addCommand(loreName(c.symbol), c.symbol);
    }
    callUpdateHelp() {
      if (this._pageWindow) this._pageWindow.setSymbol(this.currentSymbol());
    }
    setPageWindow(w) {
      this._pageWindow = w;
      this.callUpdateHelp();
    }
  }

  class Window_HaiLorePage extends Window_Base {
    setSymbol(symbol) {
      if (this._symbol === symbol) return;
      this._symbol = symbol;
      this.refresh();
    }
    lines() {
      return loreLines(this._symbol);
    }
    refresh() {
      this.contents.clear();
      this.lines().forEach((line, i) => this.drawTextEx(line, 0, i * this.lineHeight(), this.innerWidth));
    }
  }

  class Scene_HaiLore extends Scene_MenuBase {
    create() {
      super.create();
      const top = this.mainAreaTop();
      const h = this.mainAreaHeight();
      const w = 320;
      this._commandWindow = new Window_HaiLoreCommand(new Rectangle(0, top, w, this.calcWindowHeight(LORE.length, true)));
      this._commandWindow.setHandler("cancel", this.popScene.bind(this));
      this.addWindow(this._commandWindow);
      this._pageWindow = new Window_HaiLorePage(new Rectangle(w, top, Graphics.boxWidth - w, h));
      this.addWindow(this._pageWindow);
      this._commandWindow.setPageWindow(this._pageWindow);
      this._commandWindow.activate();
    }
  }

  // ---------------------------------------------------------------------------
  // 鍛冶場の画面（一点ものの一覧。決定で魂を払って鍛え直す）
  // ---------------------------------------------------------------------------
  class Window_HaiForge extends Window_Selectable {
    initialize(rect) {
      super.initialize(rect);
      this._data = [];
      this.refresh();
    }
    maxItems() {
      return this._data.length;
    }
    item() {
      return this._data[this.index()] || null;
    }
    isCurrentItemEnabled() {
      return canForge(this.item());
    }
    refresh() {
      this._data = forgeables();
      super.refresh();
    }
    drawItem(index) {
      const item = this._data[index];
      if (!item) return;
      const rect = this.itemLineRect(index);
      const n = forgedLevel(item);
      this.changePaintOpacity(canForge(item));
      this.drawItemName(item, rect.x, rect.y, rect.width - 360);
      const text = n >= P.forgeMax ? `鍛え直し ${n}/${P.forgeMax}　これ以上は鍛えられない` : `鍛え直し ${n}/${P.forgeMax}　魂 ${forgeCostOf(item)}`;
      this.drawText(text, rect.x, rect.y, rect.width, "right");
      this.changePaintOpacity(true);
    }
    drawAllItems() {
      super.drawAllItems();
      if (this.maxItems() === 0) {
        const rect = this.itemLineRect(0);
        this.changePaintOpacity(false);
        this.drawText("鍛え直せる一点ものを持っていない。", rect.x, rect.y, rect.width);
        this.changePaintOpacity(true);
      }
    }
  }

  class Scene_HaiForge extends Scene_MenuBase {
    create() {
      super.create();
      this.createHelpWindow();
      const top = this.mainAreaTop();
      this._listWindow = new Window_HaiForge(new Rectangle(0, top, Graphics.boxWidth, this.mainAreaHeight()));
      this._listWindow.setHandler("ok", this.onOk.bind(this));
      this._listWindow.setHandler("cancel", this.popScene.bind(this));
      this.addWindow(this._listWindow);
      this._listWindow.select(0);
      this._listWindow.activate();
      this.refreshHelp();
    }
    refreshHelp() {
      this._helpWindow.setText(`手持ちの魂 ${state().souls}\n一点ものの装備を鍛え直すと、能力が上がる（${P.forgeMax} 回まで）。`);
    }
    onOk() {
      if (forge(this._listWindow.item())) playSe(P.forgeSe);
      this._listWindow.refresh();
      this.refreshHelp();
      this._listWindow.activate();
    }
  }

  // ---------------------------------------------------------------------------
  // 部屋の画面を開く
  // ---------------------------------------------------------------------------
  function openScene(key) {
    if (key === "soul") SceneManager.push(Scene_HaiSouls);
    else if (key === "smithy") SceneManager.push(Scene_HaiForge);
    else if (key === "infirmary") cure();
    else if (key === "watch") reveal();
    else if (key === "kitchen") {
      if (window.Hai && Hai.Craft) Hai.Craft.open();
    } else if (key === "gate") {
      if (window.Hai && Hai.Items) SceneManager.push(Scene_HaiGate);
    } else if (key === "lore") SceneManager.push(Scene_HaiLore);
    else return false;
    return true;
  }

  // ---------------------------------------------------------------------------
  // プラグインコマンド
  // ---------------------------------------------------------------------------
  function doorCommand(args) {
    this.setupChild(doorList(String(args.door)), this._eventId);
  }
  PluginManager.registerCommand(pluginName, "door", doorCommand);
  PluginManager.registerCommand(pluginName, "pedestal", doorCommand); // 古いマップ（叡智のオーブの台座）の名残り

  const seCmd = (name, indent = 0) => cmd(250, [{ name, volume: 90, pitch: 100, pan: 0 }], indent);
  const scriptCmd = (text, indent = 0) => cmd(355, [text], indent);

  /** 療養所・鍛冶場・見張り台を使ったときの命令（文と選択肢があるので、画面ではなくイベントで流す）。 */
  function useList(key) {
    if (key === "infirmary") {
      return [seCmd(P.infirmarySe), scriptCmd("Hai.Facilities.cure();"), ...textCmds([P.infirmaryMessage]), cmd(0, [])];
    }
    if (key === "watch") {
      return [seCmd(P.watchSe), scriptCmd("Hai.Facilities.reveal();"), ...textCmds([P.watchMessage]), cmd(0, [])];
    }
    if (key === "smithy") {
      const shears = shearsItem();
      const withShears = !!shears && !$gameParty.hasItem(shears);
      const choices = ["鍛え直す", ...(withShears ? [`${shears.name}を打つ`] : []), "やめる"];
      const out = [cmd(102, [choices, choices.length - 1, 0, 2, 0]), cmd(402, [0, choices[0]]), scriptCmd('Hai.Facilities.openScene("smithy");', 1), cmd(0, [], 1)];
      if (withShears) {
        out.push(cmd(402, [1, choices[1]]), seCmd(P.forgeSe, 1), scriptCmd("Hai.Facilities.makeShears();", 1));
        out.push(...textCmds([`\\I[${shears.iconIndex}]${shears.name}を手に入れた。`], 1), cmd(0, [], 1));
      }
      out.push(cmd(402, [choices.length - 1, choices[choices.length - 1]]), cmd(0, [], 1), cmd(404, []), cmd(0, []));
      return out;
    }
    return null;
  }

  PluginManager.registerCommand(pluginName, "use", function(args) {
    const key = String(args.facility);
    if (!isOpen(key)) {
      this.setupChild([...textCmds([P.closedMessage]), cmd(0, [])], this._eventId);
    } else if (useList(key)) {
      this.setupChild(useList(key), this._eventId);
    } else {
      openScene(key);
    }
  });

  PluginManager.registerCommand(pluginName, "open", args => {
    if (open(String(args.facility)) && P.openSe) playSe(P.openSe);
  });

  // ---------------------------------------------------------------------------
  // 窓口
  // ---------------------------------------------------------------------------
  window.Hai = window.Hai || {};
  Hai.Facilities = {
    params: P,
    KEYS,
    nameOf,
    isOpen,
    opened,
    closed,
    open,
    souls: () => state().souls,
    addSouls,
    soulsOf,
    soulCost: actorId => soulCost($gameActors.actor(Number(actorId))),
    soulCap: actorId => soulCap($gameActors.actor(Number(actorId))),
    canRaise: actorId => canRaise($gameActors.actor(Number(actorId))),
    raise,
    bosses: () => state().bosses.slice(),
    recordBoss,
    cure,
    itemMaxBonus,
    forgeables: () => forgeables().map(item => ({ kind: DataManager.isWeapon(item) ? "weapon" : "armor", id: item.id, level: forgedLevel(item) })),
    forgedLevel: (kind, id) => forgedLevel(equipOf(kind, id)),
    forgeCost: (kind, id) => forgeCostOf(equipOf(kind, id)),
    canForge: (kind, id) => canForge(equipOf(kind, id)),
    forge: (kind, id) => forge(equipOf(kind, id)),
    forgeBonus: (kind, id, paramId) => (equipOf(kind, id) ? forgeBonus(equipOf(kind, id), Number(paramId)) : 0),
    makeShears,
    reveal,
    watchDestinations,
    loreLines,
    loreName,
    openScene,
    Scene_HaiSouls,
    Scene_HaiGate,
    Scene_HaiLore,
    Scene_HaiForge,
  };
})();
