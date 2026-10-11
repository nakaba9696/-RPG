/*:
 * @target MZ
 * @plugindesc アイテムの来歴（メモ欄の長い文）を読む窓と「遺物の記録」。
 * @author 灰の王国
 * @help
 * アイテム・武器・防具のメモ欄に、来歴を複数行で書く。
 *   <hai_lore>
 *   一行目（画面の一行。全角 40 字まで）
 *   二行目
 *   三行目
 *   </hai_lore>
 * 開きタグと閉じタグはそれぞれ 1 行に置く。間の 1 行が画面の 1 行（3〜6 行）。
 *
 * ・アイテム・装備の画面：来歴のある物には一覧で小さな印。選んでいるときに
 *   R キー（ゲームパッドは RT）か、上の説明の窓を押すと、来歴をページ送りの窓で読める。
 * ・手に入れたとき（倉庫へ送られた分も）に「遺物の記録」へ載せる。初めてなら一言知らせる。
 * ・遺物の記録：メニューの「メモ」の 4 つ目の種類（Hai_Notes が無ければメニューの項目）。
 *   手に入れた順・種類別に並べ、選ぶと来歴。使った物・手放した物も残る。
 *
 * 窓口 window.Hai.Lore：
 *   has(item)  text(item)  lines(item)  records()  open(item)  openRecords()
 * 詳しくは docs/plugins/Hai_Lore.md。
 *
 * @param recordsPlace
 * @text 遺物の記録の置き場所
 * @desc notes：メモの画面の 4 つ目の種類（Hai_Notes が無ければ menu と同じ）。menu：メニューの項目。
 * @type select
 * @option メモの画面の種類
 * @value notes
 * @option メニューの項目
 * @value menu
 * @default notes
 *
 * @param tabText
 * @text メモの画面の種類の名前
 * @type string
 * @default 遺物
 *
 * @param menuText
 * @text メニューの項目名
 * @desc 置き場所が menu のとき（または Hai_Notes が無いとき）。空にするとメニューに出さない。
 * @type string
 * @default 遺物の記録
 *
 * @param linesPerPage
 * @text 1 ページの行数
 * @type number
 * @min 1
 * @default 4
 *
 * @param loreKey
 * @text 来歴を読むキー
 * @desc キーコード。0 で足さない。既定 82（R）。docs/plugins/keys.md と重ねない。
 * @type number
 * @default 82
 *
 * @param loreButton
 * @text 来歴を読むボタン（ゲームパッド）
 * @desc ボタンの番号。-1 で足さない。既定 7（RT）。
 * @type number
 * @min -1
 * @default 7
 *
 * @param mark
 * @text 一覧の印
 * @type string
 * @default ◆
 *
 * @param hintText
 * @text 説明の窓の案内
 * @desc 来歴のある物を選んでいるとき、説明の窓の右下に出す。
 * @type string
 * @default 来歴を読む（R）
 *
 * @param noticeText
 * @text 初めて手に入れたときの知らせ
 * @desc %1 アイコンと名前。空にすると知らせない。
 * @type string
 * @default %1の来歴を読める。
 *
 * @param releasedText
 * @text 手放した物の印
 * @type string
 * @default 手放した
 *
 * @command open
 * @text 来歴を読む
 * @desc 指定した物の来歴の窓を開く（記録にも載せる）。
 *
 * @arg kind
 * @text 種類
 * @type select
 * @option アイテム
 * @value item
 * @option 武器
 * @value weapon
 * @option 防具
 * @value armor
 * @default item
 *
 * @arg id
 * @text ID
 * @type number
 * @default 1
 *
 * @command openRecords
 * @text 遺物の記録を開く
 */
(() => {
  "use strict";
  const pluginName = "Hai_Lore";
  const params = PluginManager.parameters(pluginName);
  const P = {
    recordsPlace: params.recordsPlace === "menu" ? "menu" : "notes",
    tabText: params.tabText || "遺物",
    menuText: params.menuText ?? "遺物の記録",
    linesPerPage: Math.max(1, Number(params.linesPerPage || 4)),
    loreKey: Number(params.loreKey ?? 82),
    loreButton: Number(params.loreButton ?? 7),
    mark: params.mark ?? "◆",
    hintText: params.hintText ?? "来歴を読む（R）",
    noticeText: params.noticeText ?? "%1の来歴を読める。",
    releasedText: params.releasedText || "手放した",
  };
  const INPUT_NAME = "haiLore";
  if (P.loreKey > 0) Input.keyMapper[P.loreKey] = INPUT_NAME;
  if (P.loreButton >= 0) Input.gamepadMapper[P.loreButton] = INPUT_NAME;

  // ---------------------------------------------------------------------------
  // 来歴の文（メモ欄）
  // ---------------------------------------------------------------------------
  const cache = new Map(); // note の文字列 → 行の配列
  function lines(item) {
    if (!item || typeof item.note !== "string") return [];
    const note = item.note;
    if (!cache.has(note)) {
      const m = /<hai_lore>([\s\S]*?)<\/hai_lore>/.exec(note);
      const out = m ? m[1].split("\n").map(s => s.replace(/\r$/, "")) : [];
      while (out.length && out[0].trim() === "") out.shift();
      while (out.length && out[out.length - 1].trim() === "") out.pop();
      cache.set(note, out);
    }
    return cache.get(note).slice();
  }
  const has = item => lines(item).length > 0;
  const text = item => lines(item).join("\n");

  // ---------------------------------------------------------------------------
  // 種類
  // ---------------------------------------------------------------------------
  function kindOf(item) {
    if (DataManager.isItem(item)) return "item";
    if (DataManager.isWeapon(item)) return "weapon";
    if (DataManager.isArmor(item)) return "armor";
    return null;
  }
  function itemOf(kind, id) {
    const table = { item: $dataItems, weapon: $dataWeapons, armor: $dataArmors }[kind];
    return (table && table[Number(id)]) || null;
  }
  // 種類別の並びと名前（大事なものはアイテムの中で分ける）
  const GROUPS = [
    { key: "item", name: "道具" },
    { key: "key", name: "大事なもの" },
    { key: "weapon", name: "武器" },
    { key: "armor", name: "防具" },
    { key: "hidden", name: "隠し" },
  ];
  function groupOf(item) {
    const kind = kindOf(item);
    if (kind !== "item") return kind;
    if (item.itypeId === 2) return "key";
    return item.itypeId === 1 ? "item" : "hidden";
  }
  const groupName = item => (GROUPS.find(g => g.key === groupOf(item)) || { name: "" }).name;
  const groupIndex = item => GROUPS.findIndex(g => g.key === groupOf(item));

  // ---------------------------------------------------------------------------
  // 状態（$gameSystem._hai.lore）
  // ---------------------------------------------------------------------------
  function state() {
    $gameSystem._hai = $gameSystem._hai || {};
    const s = $gameSystem._hai.lore;
    if (!s || !Array.isArray(s.list)) $gameSystem._hai.lore = { list: [] };
    return $gameSystem._hai.lore;
  }
  const findRecord = item => {
    const kind = kindOf(item);
    return state().list.find(r => r.kind === kind && r.id === item.id) || null;
  };
  const isRecorded = item => !!(item && findRecord(item));

  /** 記録に載せる。初めて載せたら true。 */
  function record(item) {
    if (!has(item) || isRecorded(item)) return false;
    const mapId = $gameMap ? $gameMap.mapId() : 0;
    const player = mapId ? $gamePlayer : null;
    state().list.push({
      kind: kindOf(item), id: item.id, time: $gameSystem.playtime(), mapId,
      x: player ? player.x : 0, y: player ? player.y : 0,
    });
    return true;
  }

  /** いま持っているか（袋・装備・倉庫）。 */
  function isOwned(item) {
    if (!item) return false;
    if ($gameParty.numItems(item) > 0) return true;
    if ($gameParty.allMembers().some(a => a.equips().includes(item))) return true;
    const items = window.Hai && Hai.Items;
    return !!(items && items.storageCount && items.storageCount(kindOf(item), item.id) > 0);
  }

  /** 記録の写し（手に入れた順）。item はデータ。 */
  function records() {
    return state().list
      .map(r => ({ ...r, item: itemOf(r.kind, r.id) }))
      .filter(r => r.item && has(r.item));
  }

  // ---------------------------------------------------------------------------
  // 手に入れたとき
  // ---------------------------------------------------------------------------
  const pending = []; // 画面の中で起きた知らせ（マップに戻ってから出す）
  let trading = false; // 装備の付け替えで袋に戻すとき（記録はするが知らせない）

  function notify(item) {
    if (!P.noticeText) return;
    const name = (item.iconIndex ? `\\I[${item.iconIndex}]` : "") + item.name;
    const line = P.noticeText.format(name);
    if ($gameParty.inBattle() || SceneManager._scene instanceof Scene_Map) {
      if ($gameMessage.hasText()) $gameMessage.newPage();
      $gameMessage.add(line);
    } else {
      pending.push(line);
    }
  }

  const _Scene_Map_update = Scene_Map.prototype.update;
  Scene_Map.prototype.update = function() {
    _Scene_Map_update.apply(this, arguments);
    if (pending.length && !$gameMessage.isBusy() && this.isActive()) {
      for (const line of pending.splice(0)) {
        if ($gameMessage.hasText()) $gameMessage.newPage();
        $gameMessage.add(line);
      }
    }
  };

  // Hai_Items より後に読むので、倉庫へ送られた分（袋の数が増えない）も amount で拾える
  const _Game_Party_gainItem = Game_Party.prototype.gainItem;
  Game_Party.prototype.gainItem = function(item, amount) {
    _Game_Party_gainItem.apply(this, arguments);
    if (this === $gameParty && amount > 0 && item && this.itemContainer(item) && record(item) && !trading) notify(item);
  };

  const _Game_Actor_tradeItemWithParty = Game_Actor.prototype.tradeItemWithParty;
  Game_Actor.prototype.tradeItemWithParty = function() {
    const was = trading;
    trading = true;
    try {
      return _Game_Actor_tradeItemWithParty.apply(this, arguments);
    } finally {
      trading = was;
    }
  };

  // ---------------------------------------------------------------------------
  // 一覧の印と説明の窓の案内
  // ---------------------------------------------------------------------------
  function drawMark(win, x, y, width) {
    if (!P.mark) return;
    const size = win.contents.fontSize;
    win.contents.fontSize = Math.round(size * 0.7);
    win.changeTextColor(ColorManager.systemColor());
    win.drawText(P.mark, x, y, width, "right");
    win.resetTextColor();
    win.contents.fontSize = size;
  }

  const _Window_ItemList_drawItem = Window_ItemList.prototype.drawItem;
  Window_ItemList.prototype.drawItem = function(index) {
    _Window_ItemList_drawItem.apply(this, arguments);
    const item = this.itemAt(index);
    if (!has(item)) return;
    const rect = this.itemLineRect(index);
    const w = this.textWidth("00");
    this.changePaintOpacity(this.isEnabled(item));
    drawMark(this, rect.x + rect.width - this.numberWidth() - w, rect.y, w);
    this.changePaintOpacity(true);
  };

  const _Window_EquipSlot_drawItem = Window_EquipSlot.prototype.drawItem;
  Window_EquipSlot.prototype.drawItem = function(index) {
    _Window_EquipSlot_drawItem.apply(this, arguments);
    const item = this._actor ? this.itemAt(index) : null;
    if (!has(item)) return;
    const rect = this.itemLineRect(index);
    drawMark(this, rect.x, rect.y, rect.width);
  };

  // 説明の窓が今どの物を出しているか（setItem を通らない文では null）
  const _Window_Help_setItem = Window_Help.prototype.setItem;
  Window_Help.prototype.setItem = function(item) {
    const changed = this._haiLoreItem !== item;
    this._haiLoreItem = item;
    this._haiLoreSetting = true;
    try {
      _Window_Help_setItem.apply(this, arguments);
    } finally {
      this._haiLoreSetting = false;
    }
    if (changed && this._haiLoreHint) this.refresh(); // 説明が同じ文の物に移ったときも案内を描き直す
  };

  const _Window_Help_setText = Window_Help.prototype.setText;
  Window_Help.prototype.setText = function() {
    if (!this._haiLoreSetting) this._haiLoreItem = null;
    _Window_Help_setText.apply(this, arguments);
  };

  const _Window_Help_refresh = Window_Help.prototype.refresh;
  Window_Help.prototype.refresh = function() {
    _Window_Help_refresh.apply(this, arguments);
    if (!this._haiLoreHint || !P.hintText || !has(this._haiLoreItem)) return;
    const rect = this.baseTextRect();
    const size = this.contents.fontSize;
    this.contents.fontSize = Math.round(size * 0.75);
    this.changeTextColor(ColorManager.systemColor());
    const y = rect.y + rect.height - this.lineHeight();
    this.drawText(`${P.mark}${P.hintText}`, rect.x, y, rect.width, "right");
    this.resetTextColor();
    this.contents.fontSize = size;
  };

  // ---------------------------------------------------------------------------
  // 来歴の窓（ページ送り）
  // ---------------------------------------------------------------------------
  class Window_HaiLoreText extends Window_Base {
    static rect() {
      const width = Math.min(Graphics.boxWidth - 32, 1120);
      const height = Window_Base.prototype.fittingHeight(P.linesPerPage + 2);
      return new Rectangle((Graphics.boxWidth - width) / 2, (Graphics.boxHeight - height) / 2, width, height);
    }
    initialize(rect) {
      super.initialize(rect || Window_HaiLoreText.rect());
      this.openness = 0;
      this.deactivate();
      this._item = null;
      this._lines = [];
      this._page = 0;
      this._onClose = null;
    }
    item() {
      return this._item;
    }
    page() {
      return this._page;
    }
    pageCount() {
      return Math.max(1, Math.ceil(this._lines.length / P.linesPerPage));
    }
    isReading() {
      return !!this._item;
    }
    setup(item, onClose) {
      this._item = item;
      this._lines = lines(item);
      this._page = 0;
      this._onClose = onClose || null;
      record(item);
      this.refresh();
      this.open();
      this.activate();
    }
    /** いまのページの行。 */
    pageLines() {
      const start = this._page * P.linesPerPage;
      return this._lines.slice(start, start + P.linesPerPage);
    }
    refresh() {
      this.contents.clear();
      if (!this._item) return;
      const lh = this.lineHeight();
      const w = this.innerWidth;
      this.drawItemName(this._item, 0, 0, w);
      this.changeTextColor(ColorManager.systemColor());
      this.drawText(groupName(this._item), 0, 0, w, "right");
      this.resetTextColor();
      this.contents.paintOpacity = 64;
      this.contents.fillRect(0, lh - 2, w, 2, ColorManager.normalColor());
      this.contents.paintOpacity = 255;
      this.pageLines().forEach((line, i) => this.drawTextEx(line, 0, lh * (i + 1), w));
      const y = lh * (P.linesPerPage + 1);
      const size = this.contents.fontSize;
      this.contents.fontSize = Math.round(size * 0.75);
      this.changeTextColor(ColorManager.textColor(8));
      const last = this._page >= this.pageCount() - 1;
      const how = last ? "決定で閉じる" : "決定で次へ";
      this.drawText(this._page > 0 ? `${how}　←で戻る` : how, 0, y, w, "left");
      this.drawText(`${this._page + 1} / ${this.pageCount()}`, 0, y, w, "right");
      this.resetTextColor();
      this.contents.fontSize = size;
    }
    update() {
      super.update();
      if (this._item && this.active && this.isOpen()) this.processInput();
    }
    processInput() {
      if (Input.isTriggered("cancel") || Input.isTriggered(INPUT_NAME) || TouchInput.isCancelled()) {
        SoundManager.playCancel();
        this.finish();
      } else if (Input.isTriggered("ok") || Input.isRepeated("right") || Input.isTriggered("pagedown") || TouchInput.isClicked()) {
        this.nextPage();
      } else if (Input.isRepeated("left") || Input.isTriggered("pageup")) {
        this.prevPage();
      }
    }
    nextPage() {
      if (this._page < this.pageCount() - 1) {
        this._page++;
        SoundManager.playCursor();
        this.refresh();
      } else {
        SoundManager.playOk();
        this.finish();
      }
    }
    prevPage() {
      if (this._page <= 0) return;
      this._page--;
      SoundManager.playCursor();
      this.refresh();
    }
    finish() {
      const done = this._onClose;
      this._item = null;
      this._onClose = null;
      this.deactivate();
      this.close();
      Input.clear();
      TouchInput.clear();
      if (done) done();
    }
  }

  /** シーンに来歴の窓を足す（いちばん上）。 */
  function attachReader(scene) {
    const reader = new Window_HaiLoreText();
    scene.addWindow(reader);
    scene._haiLoreReader = reader;
    return reader;
  }

  /** 来歴の窓を開く。開いている間はほかの窓とタッチのボタンを止める。 */
  function openReader(scene, item, onClose) {
    const reader = scene._haiLoreReader;
    if (!reader || reader.isReading() || !has(item)) return false;
    const active = scene._windowLayer.children.filter(w => w !== reader && w.active);
    active.forEach(w => w.deactivate());
    const buttons = [scene._cancelButton, scene._pageupButton, scene._pagedownButton].filter(b => b && b.visible);
    buttons.forEach(b => (b.visible = false));
    SoundManager.playOk();
    reader.setup(item, () => {
      active.forEach(w => w.activate());
      buttons.forEach(b => (b.visible = true));
      if (onClose) onClose();
    });
    return true;
  }

  const isReading = scene => !!(scene && scene._haiLoreReader && scene._haiLoreReader.isReading());

  /** 説明の窓が押されたか。 */
  function helpTouched(scene) {
    const help = scene._helpWindow;
    if (!help || !help.visible || !TouchInput.isClicked()) return false;
    const x = TouchInput.x - help.x - scene._windowLayer.x;
    const y = TouchInput.y - help.y - scene._windowLayer.y;
    return x >= 0 && y >= 0 && x < help.width && y < help.height;
  }

  /** アイテム・装備の画面：R キーか説明の窓で、選んでいる物の来歴を開く。 */
  function updateReadKey(scene, item) {
    if (isReading(scene) || !has(item)) return;
    if (Input.isTriggered(INPUT_NAME) || helpTouched(scene)) openReader(scene, item);
  }

  // アイテムの画面
  const _Scene_Item_create = Scene_Item.prototype.create;
  Scene_Item.prototype.create = function() {
    _Scene_Item_create.apply(this, arguments);
    this._helpWindow._haiLoreHint = true;
    attachReader(this);
  };
  const _Scene_Item_update = Scene_Item.prototype.update;
  Scene_Item.prototype.update = function() {
    _Scene_Item_update.apply(this, arguments);
    const w = this._itemWindow;
    updateReadKey(this, w && w.active ? w.item() : null);
  };

  // 装備の画面
  const _Scene_Equip_create = Scene_Equip.prototype.create;
  Scene_Equip.prototype.create = function() {
    _Scene_Equip_create.apply(this, arguments);
    this._helpWindow._haiLoreHint = true;
    attachReader(this);
  };
  const _Scene_Equip_update = Scene_Equip.prototype.update;
  Scene_Equip.prototype.update = function() {
    _Scene_Equip_update.apply(this, arguments);
    let item = null;
    if (this._slotWindow && this._slotWindow.active) item = this._slotWindow.item();
    else if (this._itemWindow && this._itemWindow.active) item = this._itemWindow.item();
    updateReadKey(this, item);
  };

  // ---------------------------------------------------------------------------
  // 遺物の記録
  // ---------------------------------------------------------------------------
  const ORDERS = [
    { key: "time", name: "手に入れた順" },
    { key: "kind", name: "種類別" },
  ];
  let lastOrder = "time"; // 画面を開き直しても並びを覚えておく（セーブには入れない）

  function sortedRecords(order) {
    const list = records();
    if (order === "kind") {
      return list
        .map((r, i) => ({ r, i }))
        .sort((a, b) => groupIndex(a.r.item) - groupIndex(b.r.item) || a.i - b.i)
        .map(e => e.r);
    }
    return list;
  }

  function mapName(mapId) {
    if (!mapId) return "—";
    const am = window.Hai && Hai.AutoMap;
    if (am && am.mapName) return am.mapName(mapId);
    const info = $dataMapInfos[mapId];
    return info ? info.name : String(mapId);
  }

  function timeText(sec) {
    const s = Math.floor(Number(sec) || 0);
    return `${Math.floor(s / 3600).padZero(2)}:${(Math.floor(s / 60) % 60).padZero(2)}:${(s % 60).padZero(2)}`;
  }

  class Window_HaiLoreRecords extends Window_Selectable {
    initialize(rect) {
      super.initialize(rect);
      this._order = lastOrder;
      this._data = [];
      this.refresh();
    }
    order() {
      return this._order;
    }
    orderName() {
      return (ORDERS.find(o => o.key === this._order) || ORDERS[0]).name;
    }
    toggleOrder() {
      const cur = this.item();
      this._order = lastOrder = this._order === "time" ? "kind" : "time";
      SoundManager.playCursor();
      this.refresh();
      const i = cur ? this._data.findIndex(r => r.kind === cur.kind && r.id === cur.id) : -1;
      if (this.index() >= 0) this.select(Math.max(0, i));
      this.callUpdateHelp();
    }
    maxItems() {
      return this._data.length;
    }
    item(index = this.index()) {
      return this._data[index] || null;
    }
    refresh() {
      this._data = sortedRecords(this._order);
      super.refresh();
      if (!this._data.length) {
        this.changePaintOpacity(false);
        this.drawText("まだ来歴のある物を手に入れていない。", 0, 0, this.innerWidth, "center");
        this.changePaintOpacity(true);
      }
    }
    drawItem(index) {
      const r = this.item(index);
      if (!r) return;
      const rect = this.itemLineRect(index);
      const owned = isOwned(r.item);
      const tagW = 160;
      this.changePaintOpacity(owned);
      this.drawItemName(r.item, rect.x, rect.y, rect.width - tagW * 2);
      this.changeTextColor(ColorManager.systemColor());
      this.drawText(groupName(r.item), rect.x + rect.width - tagW * 2, rect.y, tagW, "left");
      this.resetTextColor();
      if (!owned) {
        this.changeTextColor(ColorManager.textColor(8));
        this.drawText(P.releasedText, rect.x + rect.width - tagW, rect.y, tagW, "right");
        this.resetTextColor();
      }
      this.changePaintOpacity(true);
    }
    // Q・W（pageup・pagedown）は並びの切り替え
    cursorPagedown() {
      this.toggleOrder();
    }
    cursorPageup() {
      this.toggleOrder();
    }
    updateHelp() {
      const r = this.item();
      const how = `決定で来歴を読む。Q・W で並びを切り替え（今：${this.orderName()}）`;
      if (!r) {
        this._helpWindow.setText(how);
        return;
      }
      const where = r.mapId ? `${mapName(r.mapId)} ${r.x},${r.y}` : "—";
      this._helpWindow.setText(`手に入れた所：${where}　時刻：${timeText(r.time)}\n${how}`);
    }
  }

  /** 遺物の記録の窓をシーンに足す（Scene_HaiLoreBook とメモの画面で共通）。 */
  function createRecordsWindow(scene, rect, onCancel) {
    const list = new Window_HaiLoreRecords(rect);
    list.setHelpWindow(scene._helpWindow);
    list.setHandler("ok", () => {
      const r = list.item();
      // 決定で一覧は止まっている（Window_Selectable.processOk）ので、閉じたら動かし直す
      const reopen = () => {
        list.refresh();
        list.activate();
      };
      if (!r || !openReader(scene, r.item, reopen)) list.activate();
    });
    list.setHandler("cancel", onCancel);
    scene.addWindow(list);
    return list;
  }

  /** 遺物の記録の一覧で、説明の窓を押すと並びを切り替える。 */
  function updateRecordsTouch(scene, list) {
    if (list && list.active && !isReading(scene) && helpTouched(scene)) list.toggleOrder();
  }

  class Scene_HaiLoreBook extends Scene_MenuBase {
    /** item を渡すと、来歴の窓だけを開き、閉じたら戻る。 */
    prepare(item) {
      this._readItem = item || null;
    }
    create() {
      super.create();
      this.createHelpWindow();
      const top = this.mainAreaTop();
      this._recordsWindow = createRecordsWindow(this, new Rectangle(0, top, Graphics.boxWidth, this.mainAreaHeight()), this.popScene.bind(this));
      attachReader(this);
      if (this._readItem) {
        this._recordsWindow.hide();
        this._helpWindow.hide();
        this._recordsWindow.deactivate();
      } else {
        this._recordsWindow.activate();
        this._recordsWindow.select(this._recordsWindow.maxItems() ? 0 : -1);
        this._recordsWindow.callUpdateHelp();
      }
    }
    start() {
      super.start();
      if (this._readItem) openReader(this, this._readItem, this.popScene.bind(this));
    }
    update() {
      super.update();
      updateRecordsTouch(this, this._recordsWindow);
    }
  }
  window.Scene_HaiLoreBook = Scene_HaiLoreBook;

  // メモの画面（Hai_Notes）の 4 つ目の種類
  const LORE_SYMBOL = "haiLore";
  const inNotes = () => P.recordsPlace === "notes" && typeof window.Scene_HaiNotes === "function";
  let notesStartOnLore = false;

  if (inNotes()) {
    const Notes = window.Scene_HaiNotes;
    const _Notes_create = Notes.prototype.create;
    Notes.prototype.create = function() {
      _Notes_create.apply(this, arguments);
      const cw = this._categoryWindow;
      const lw = this._listWindow;
      const baseCols = cw.maxCols();
      const baseMake = cw.makeCommandList;
      cw.maxCols = () => baseCols + 1;
      cw.makeCommandList = function() {
        baseMake.call(this);
        this.addCommand(`${P.tabText}（${records().length}）`, LORE_SYMBOL);
      };
      cw.refresh();
      this._haiLoreList = createRecordsWindow(this, new Rectangle(lw.x, lw.y, lw.width, lw.height), () => {
        this._haiLoreList.deselect();
        this._categoryWindow.activate();
      });
      this._haiLoreList.hide();
      this._haiLoreList.deactivate();
      attachReader(this);
      if (notesStartOnLore) cw.selectSymbol(LORE_SYMBOL);
      notesStartOnLore = false;
    };

    const _Notes_update = Notes.prototype.update;
    Notes.prototype.update = function() {
      _Notes_update.apply(this, arguments);
      const lore = this._categoryWindow.currentSymbol() === LORE_SYMBOL;
      this._listWindow.visible = !lore;
      this._haiLoreList.visible = lore;
      updateRecordsTouch(this, this._haiLoreList);
    };

    const _Notes_onCategoryOk = Notes.prototype.onCategoryOk;
    Notes.prototype.onCategoryOk = function() {
      if (this._categoryWindow.currentSymbol() !== LORE_SYMBOL) return _Notes_onCategoryOk.apply(this, arguments);
      const list = this._haiLoreList;
      if (!list.maxItems()) {
        this._categoryWindow.activate();
        return;
      }
      list.activate();
      list.select(0);
    };
  }

  // メニューの項目（置き場所が menu か、Hai_Notes が無いとき）
  const _Window_MenuCommand_addOriginalCommands = Window_MenuCommand.prototype.addOriginalCommands;
  Window_MenuCommand.prototype.addOriginalCommands = function() {
    _Window_MenuCommand_addOriginalCommands.apply(this, arguments);
    if (!inNotes() && P.menuText) this.addCommand(P.menuText, "haiLoreBook", true);
  };
  const _Scene_Menu_createCommandWindow = Scene_Menu.prototype.createCommandWindow;
  Scene_Menu.prototype.createCommandWindow = function() {
    _Scene_Menu_createCommandWindow.apply(this, arguments);
    this._commandWindow.setHandler("haiLoreBook", () => SceneManager.push(Scene_HaiLoreBook));
  };

  // ---------------------------------------------------------------------------
  // 開く
  // ---------------------------------------------------------------------------
  /** 来歴の窓を開く。来歴の窓のあるシーンならその場で、ほかは来歴だけのシーンを重ねる。 */
  function open(item) {
    if (!has(item)) return false;
    const scene = SceneManager._scene;
    if (scene && scene._haiLoreReader) return openReader(scene, item);
    record(item);
    SceneManager.push(Scene_HaiLoreBook);
    SceneManager.prepareNextScene(item);
    return true;
  }

  function openRecords() {
    if (inNotes()) {
      notesStartOnLore = true;
      SceneManager.push(window.Scene_HaiNotes);
    } else {
      SceneManager.push(Scene_HaiLoreBook);
    }
  }

  PluginManager.registerCommand(pluginName, "open", args => {
    open(itemOf(String(args.kind || "item"), Number(args.id)));
  });
  PluginManager.registerCommand(pluginName, "openRecords", () => openRecords());

  // ---------------------------------------------------------------------------
  // 窓口
  // ---------------------------------------------------------------------------
  window.Hai = window.Hai || {};
  Hai.Lore = {
    params: P,
    INPUT_NAME,
    /** 来歴があるか。 */
    has,
    /** 来歴の文（行を \n でつないだもの）。無ければ ""。 */
    text,
    /** 来歴の行の配列。 */
    lines,
    /** 遺物の記録（手に入れた順）。[{ kind, id, time, mapId, x, y, item }] */
    records,
    /** 記録に載っているか / 載せる（初めてなら true）。 */
    isRecorded,
    record,
    /** いま持っているか（袋・装備・倉庫）。 */
    isOwned,
    /** 来歴の窓を開く。 */
    open,
    /** 遺物の記録を開く。 */
    openRecords,
    itemOf,
    kindOf,
    groupName,
    Window_HaiLoreText,
    Window_HaiLoreRecords,
    Scene_HaiLoreBook,
  };
})();
