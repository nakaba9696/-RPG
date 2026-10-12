/*:
 * @target MZ
 * @plugindesc 砦の部屋：生き残りが来たら開く。稽古場・食堂・倉・書庫。
 * @author 灰の王国
 * @orderAfter Hai_Items
 * @orderAfter Hai_Craft
 * @orderAfter Hai_Companions
 * @help
 * ■ 部屋が開く
 *   生き残りが砦に来たら、その場面のイベントでプラグインコマンド「部屋を開く」（open）を呼ぶ。
 *   開いたら、その部屋のスイッチ（既定 121〜124）を ON にする。開く順は決まっていない。
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
 *   書庫    倒したボスの一覧・読んだ思念と戻った記憶の数（写しの読み比べは名前だけ）
 *
 * ■ 状態（セーブに入る）
 *   $gameSystem._hai.facilities = { opened: { soul: true }, souls: 12, bosses: [5] }
 *   古いセーブで無ければ、読むときにスイッチから開いた部屋を写して作る。
 *
 * ■ 窓口（window.Hai.Facilities）は docs/plugins/Hai_Facilities.md
 *
 * @param switches
 * @text 部屋のスイッチ
 * @desc 稽古場・食堂・倉・書庫の順に、開いたら ON にするスイッチ（カンマ区切り。0 で写さない）。
 * @type string
 * @default 121,122,123,124
 *
 * @param names
 * @text 部屋の名前
 * @desc 稽古場・食堂・倉・書庫の順（カンマ区切り）。
 * @type string
 * @default 稽古場,食堂,倉,書庫
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
 * @default soul
 */
(() => {
  "use strict";
  const pluginName = "Hai_Facilities";
  const params = PluginManager.parameters(pluginName);
  const list = (s, d) => String(s ?? d).split(",").map(t => t.trim());
  const P = {
    switches: list(params.switches, "121,122,123,124").map(Number),
    names: list(params.names, "稽古場,食堂,倉,書庫"),
    openSe: params.openSe ?? "Open2",
    closedMessage: params.closedMessage ?? "扉が崩れて、瓦礫で塞がっている。",
    bossSouls: Number(params.bossSouls ?? 10),
    soulMessage: params.soulMessage ?? "魂を %1 手に入れた。",
    soulCostRate: Math.max(1, Number(params.soulCostRate || 1)),
    soulCapByBattle: params.soulCapByBattle !== "false",
    soulSe: params.soulSe ?? "Up4",
  };
  /** 部屋の鍵（稽古場・食堂・倉・書庫。鍵の名前は前の世界の名残り）。 */
  const KEYS = ["soul", "kitchen", "gate", "lore"];
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
      s = $gameSystem._hai.facilities = { opened: {}, souls: 0, bosses: [] };
      KEYS.forEach((key, i) => {
        if (P.switches[i] > 0 && $gameSwitches && $gameSwitches.value(P.switches[i])) s.opened[key] = true;
      });
    }
    s.opened = s.opened || {};
    s.souls = Number(s.souls) || 0;
    if (!Array.isArray(s.bosses)) s.bosses = [];
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
    { symbol: "copies", name: "写しの読み比べ" },
  ];

  function loreLines(symbol) {
    if (symbol === "bosses") {
      const ids = state().bosses.filter(id => $dataEnemies[id]);
      return ids.length ? ids.flatMap(bossLines) : ["まだ倒したボスはいない。"];
    }
    if (symbol === "thoughts") {
      const th = window.Hai && Hai.Thoughts;
      const notes = th ? th.notes().length : 0;
      const faint = th && th.faintCount ? th.faintCount() : 0;
      return [`読んだ思念　${readThoughts()}`, `戻った記憶　${faint}`, `メモ　${notes}`];
    }
    if (symbol === "copies") return ["読み比べる写しは、まだ一冊もない。"];
    return [];
  }

  class Window_HaiLoreCommand extends Window_Command {
    makeCommandList() {
      for (const c of LORE) this.addCommand(c.name, c.symbol);
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
  // 部屋の画面を開く
  // ---------------------------------------------------------------------------
  function openScene(key) {
    if (key === "soul") SceneManager.push(Scene_HaiSouls);
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

  PluginManager.registerCommand(pluginName, "use", function(args) {
    const key = String(args.facility);
    if (!isOpen(key)) {
      this.setupChild([...textCmds([P.closedMessage]), cmd(0, [])], this._eventId);
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
    loreLines,
    openScene,
    Scene_HaiSouls,
    Scene_HaiGate,
    Scene_HaiLore,
  };
})();
