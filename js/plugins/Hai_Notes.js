/*:
 * @target MZ
 * @plugindesc メモの画面（手がかり・扉・入手）と、手に入れたものの自動の記録。
 * @author 灰の王国
 * @help
 * メニューの「メモ」で、Hai_Thoughts のメモ帳を新しい順に、種類ごとに切り替えて並べる。
 *   手がかり … 残留思念の <hai_clue> など
 *   扉       … 鍵の要る扉（開けたものは薄く）
 *   入手     … 手に入れたもの（下の入手ログ）
 * 一行を選ぶと、下の窓に書き留めた場所（マップ名 x,y）と時刻が出る。
 *
 * 入手ログ：アイテム・武器・防具・魔石（所持金）を手に入れたとき、
 * メモ帳に kind: "item" の一行を足す（「〜を手に入れた（マップ名）」）。
 * ショップの購入・売却と、装備の付け替えで戻ってきたものは記録しない。
 * 入手ログは新しいものから maxItemLog 件だけ残す。
 *
 * 前提：Hai_Thoughts（メモ帳）。Hai_AutoMap があればマップの表示名をそこから引く。
 * 窓口 window.Hai.Notes：
 *   open()  logItem(item, amount)  logGold(amount)  suspend(fn)  itemLog()
 * 詳しくは docs/plugins/Hai_Notes.md。
 *
 * @param menuText
 * @text メニューの項目名
 * @desc 空にするとメニューに出さない。
 * @type string
 * @default メモ
 *
 * @param maxItemLog
 * @text 入手ログの件数
 * @desc これより古い入手ログは消す。
 * @type number
 * @min 1
 * @default 50
 *
 * @param itemFormat
 * @text 入手ログの一行（1 つ）
 * @desc %1 アイコンと名前、%2 マップ名。
 * @type string
 * @default %1を手に入れた（%2）
 *
 * @param itemsFormat
 * @text 入手ログの一行（2 つ以上）
 * @desc %1 アイコンと名前、%2 数、%3 マップ名。
 * @type string
 * @default %1×%2を手に入れた（%3）
 *
 * @param goldFormat
 * @text 入手ログの一行（魔石）
 * @desc %1 数、%2 通貨の単位、%3 マップ名。
 * @type string
 * @default 魔石 %1%2を手に入れた（%3）
 */
(() => {
  "use strict";
  const pluginName = "Hai_Notes";
  const params = PluginManager.parameters(pluginName);
  const menuText = params.menuText ?? "メモ";
  const maxItemLog = Math.max(1, Number(params.maxItemLog || 50));
  const itemFormat = params.itemFormat || "%1を手に入れた（%2）";
  const itemsFormat = params.itemsFormat || "%1×%2を手に入れた（%3）";
  const goldFormat = params.goldFormat || "魔石 %1%2を手に入れた（%3）";

  const CATEGORIES = [
    { kind: "clue", name: "手がかり", empty: "まだ手がかりはない。" },
    { kind: "door", name: "扉", empty: "まだ鍵の要る扉はない。" },
    { kind: "item", name: "入手", empty: "まだ何も手に入れていない。" },
  ];

  const thoughts = () => (window.Hai && Hai.Thoughts) || null;
  const autoMap = () => (window.Hai && Hai.AutoMap) || null;

  function mapName(mapId) {
    if (!mapId) return "";
    const am = autoMap();
    if (am) return am.mapName(mapId);
    if ($gameMap.mapId() === mapId && $gameMap.displayName()) return $gameMap.displayName();
    const info = $dataMapInfos[mapId];
    return info ? info.name : String(mapId);
  }

  function hereName() {
    return $gameMap && $gameMap.mapId() > 0 ? mapName($gameMap.mapId()) : "";
  }

  function format(fmt, ...args) {
    return args.reduce((s, a, i) => s.split(`%${i + 1}`).join(String(a)), fmt);
  }

  function timeText(sec) {
    const s = Math.floor(Number(sec) || 0);
    const hh = Math.floor(s / 3600);
    const mm = Math.floor(s / 60) % 60;
    const ss = s % 60;
    return `${hh.padZero(2)}:${mm.padZero(2)}:${ss.padZero(2)}`;
  }

  // ---------------------------------------------------------------------------
  // 入手ログ
  // ---------------------------------------------------------------------------
  let suspended = 0; // ショップ・装備の付け替えの間は記録しない

  function suspend(fn, self, args) {
    suspended++;
    try {
      return fn.apply(self, args);
    } finally {
      suspended--;
    }
  }

  function addLog(text) {
    const th = thoughts();
    if (!th || suspended || !$gameMap || !$gameMap.mapId()) return null;
    const base = `item:${$gameSystem.playtime()}`;
    let id = base;
    for (let n = 2; th.hasNote(id); n++) id = `${base}#${n}`;
    const added = th.addNote({ id, text, kind: "item" });
    const items = th.notes("item");
    for (let i = 0; i < items.length - maxItemLog; i++) th.removeNote(items[i].id);
    return added;
  }

  function logItem(item, amount) {
    if (!item || !(amount > 0)) return null;
    const name = (item.iconIndex ? `\\I[${item.iconIndex}]` : "") + item.name;
    const text = amount === 1 ? format(itemFormat, name, hereName()) : format(itemsFormat, name, amount, hereName());
    return addLog(text);
  }

  function logGold(amount) {
    if (!(amount > 0)) return null;
    return addLog(format(goldFormat, amount, TextManager.currencyUnit, hereName()));
  }

  const _Game_Party_gainItem = Game_Party.prototype.gainItem;
  Game_Party.prototype.gainItem = function(item, amount) {
    const before = item && this.itemContainer(item) ? this.numItems(item) : 0;
    _Game_Party_gainItem.apply(this, arguments);
    if (amount > 0 && item && this.itemContainer(item) && this === $gameParty) {
      const got = this.numItems(item) - before;
      if (got > 0) logItem(item, got);
    }
  };

  const _Game_Party_gainGold = Game_Party.prototype.gainGold;
  Game_Party.prototype.gainGold = function(amount) {
    const before = this._gold;
    _Game_Party_gainGold.apply(this, arguments);
    if (amount > 0 && this === $gameParty && this._gold > before) logGold(this._gold - before);
  };

  // 記録しないところ
  const _Scene_Shop_doBuy = Scene_Shop.prototype.doBuy;
  Scene_Shop.prototype.doBuy = function() {
    return suspend(_Scene_Shop_doBuy, this, arguments);
  };
  const _Scene_Shop_doSell = Scene_Shop.prototype.doSell;
  Scene_Shop.prototype.doSell = function() {
    return suspend(_Scene_Shop_doSell, this, arguments);
  };
  const _Game_Actor_tradeItemWithParty = Game_Actor.prototype.tradeItemWithParty;
  Game_Actor.prototype.tradeItemWithParty = function() {
    return suspend(_Game_Actor_tradeItemWithParty, this, arguments);
  };

  // ---------------------------------------------------------------------------
  // メモの画面
  // ---------------------------------------------------------------------------
  class Window_HaiNoteCategory extends Window_HorzCommand {
    maxCols() {
      return CATEGORIES.length;
    }
    makeCommandList() {
      const th = thoughts();
      for (const c of CATEGORIES) {
        const n = th ? th.notes(c.kind).length : 0;
        this.addCommand(`${c.name}（${n}）`, c.kind);
      }
    }
    update() {
      super.update();
      if (this._listWindow) this._listWindow.setKind(this.currentSymbol());
    }
    setListWindow(w) {
      this._listWindow = w;
    }
  }

  class Window_HaiNoteList extends Window_Selectable {
    initialize(rect) {
      super.initialize(rect);
      this._kind = null;
      this._data = [];
    }
    setKind(kind) {
      if (this._kind === kind) return;
      this._kind = kind;
      this.refresh();
      this.scrollTo(0, 0);
      this.select(this.active ? 0 : -1);
    }
    maxItems() {
      return this._data ? this._data.length : 0;
    }
    item(index = this.index()) {
      return (this._data && this._data[index]) || null;
    }
    refresh() {
      const th = thoughts();
      this._data = th && this._kind ? th.notes(this._kind).reverse() : [];
      super.refresh();
      if (!this._data.length) {
        const c = CATEGORIES.find(k => k.kind === this._kind);
        this.changePaintOpacity(false);
        this.drawText(c ? c.empty : "", 0, 0, this.innerWidth, "center");
        this.changePaintOpacity(true);
      }
    }
    drawItem(index) {
      const note = this.item(index);
      if (!note) return;
      const rect = this.itemLineRect(index);
      const done = note.kind === "door" && note.done;
      this.changePaintOpacity(!done);
      const tagW = done ? 120 : 0;
      this.drawTextEx(note.text, rect.x, rect.y, rect.width - tagW);
      if (done) {
        this.changeTextColor(ColorManager.textColor(8));
        this.drawText("開けた", rect.x + rect.width - tagW, rect.y, tagW, "right");
        this.resetTextColor();
      }
      this.changePaintOpacity(true);
    }
    updateHelp() {
      const note = this.item();
      if (!note) {
        this._helpWindow.setText("");
        return;
      }
      const where = note.mapId ? `場所：${mapName(note.mapId)} ${note.x},${note.y}` : "場所：—";
      this._helpWindow.setText(`${where}\n書き留めた時刻：${timeText(note.time)}`);
    }
  }

  class Scene_HaiNotes extends Scene_MenuBase {
    create() {
      super.create();
      this.createHelpWindow();
      const top = this.mainAreaTop();
      const catH = this.calcWindowHeight(1, true);
      this._categoryWindow = new Window_HaiNoteCategory(new Rectangle(0, top, Graphics.boxWidth, catH));
      this._categoryWindow.setHandler("ok", this.onCategoryOk.bind(this));
      this._categoryWindow.setHandler("cancel", this.popScene.bind(this));
      this.addWindow(this._categoryWindow);
      const listRect = new Rectangle(0, top + catH, Graphics.boxWidth, this.mainAreaHeight() - catH);
      this._listWindow = new Window_HaiNoteList(listRect);
      this._listWindow.setHelpWindow(this._helpWindow);
      this._listWindow.setHandler("ok", this.onListOk.bind(this));
      this._listWindow.setHandler("cancel", this.onListCancel.bind(this));
      this.addWindow(this._listWindow);
      this._categoryWindow.setListWindow(this._listWindow);
      this._listWindow.setKind(this._categoryWindow.currentSymbol());
      this._helpWindow.setText("←→ で種類を切り替え、決定で一行を選ぶと書き留めた場所が出る。");
    }
    onCategoryOk() {
      if (this._listWindow.maxItems() === 0) {
        this._categoryWindow.activate();
        return;
      }
      this._listWindow.activate();
      this._listWindow.select(0);
    }
    onListOk() {
      this._listWindow.activate(); // 選んでも何もしない（場所は下の窓に出ている）
    }
    onListCancel() {
      this._listWindow.deselect();
      this._helpWindow.setText("←→ で種類を切り替え、決定で一行を選ぶと書き留めた場所が出る。");
      this._categoryWindow.activate();
    }
  }
  window.Scene_HaiNotes = Scene_HaiNotes;

  // メニューの「メモ」（既定の並びは変えず、独自コマンドの所に足す）
  const _Window_MenuCommand_addOriginalCommands = Window_MenuCommand.prototype.addOriginalCommands;
  Window_MenuCommand.prototype.addOriginalCommands = function() {
    _Window_MenuCommand_addOriginalCommands.apply(this, arguments);
    if (menuText) this.addCommand(menuText, "haiNotes", !!thoughts());
  };

  const _Scene_Menu_createCommandWindow = Scene_Menu.prototype.createCommandWindow;
  Scene_Menu.prototype.createCommandWindow = function() {
    _Scene_Menu_createCommandWindow.apply(this, arguments);
    this._commandWindow.setHandler("haiNotes", () => SceneManager.push(Scene_HaiNotes));
  };

  // ---------------------------------------------------------------------------
  // 窓口
  // ---------------------------------------------------------------------------
  window.Hai = window.Hai || {};
  Hai.Notes = {
    CATEGORIES: CATEGORIES.map(c => c.kind),
    /** メモの画面を開く。 */
    open() {
      SceneManager.push(Scene_HaiNotes);
    },
    /** 入手ログに一行足す（ふつうは gainItem から自動）。足したらそのメモ。 */
    logItem,
    logGold,
    /** fn の間は入手ログを記録しない（ほかのプラグインが「入手」でない増減をするとき用）。 */
    suspend(fn) {
      return suspend(fn, null, []);
    },
    /** 入手ログ（新しい順）。 */
    itemLog() {
      const th = thoughts();
      return th ? th.notes("item").reverse() : [];
    },
  };
})();
