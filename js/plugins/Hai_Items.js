/*:
 * @target MZ
 * @plugindesc 所持上限と倉庫への自動転送、一点ものの装備、ザコは装備を落とさない・ボスの固定ドロップ。
 * @author 灰の王国
 * @help
 * ■ 所持上限
 *   アイテム・武器・防具のメモ欄に <hai_max:3> と書くと、その物は 3 つまでしか持てない。
 *   書いていない物の上限はパラメータで決まる（ふつうのアイテムで「消耗する」もの＝消耗品は 5、
 *   装備は 0＝無制限（MZ の既定の 99）。大事なもの・消耗しないアイテムは MZ の既定の 99）。
 *
 * ■ 倉庫への自動転送
 *   上限を超えて手に入れた分は捨てずに倉庫へ入れ、「〜は倉庫へ送られた」と知らせる。
 *   宝箱・イベントの「アイテムの増減」・戦闘のドロップ・合成など、増えるときすべて。
 *   売る・使う・捨てるで減るときは関係しない。倉庫に上限はない。
 *   入手ログ（Hai_Notes）があれば、倉庫へ送った分も入手ログに残す。
 *   知らせはマップと戦闘ではすぐに文章で出す。メニュー・店・合成の画面の中で起きたときは、
 *   マップに戻ってから出す。装備を外して袋に戻すときは知らせない。
 *   倉庫から出す画面は P8（保管ゲート）が作る。ここにあるのはテスト用の最小の画面
 *   （プラグインコマンド「倉庫を開く」）。
 *
 * ■ 一点もの
 *   装備（アイテムにも書ける）のメモ欄に <hai_unique>。
 *   - 上限 1。装備している分も数える（装備中にもう 1 つ手に入れると倉庫へ）。
 *   - 店で売れない（売る一覧で選べない）。
 *   - 手に入れたとき「〜を手に入れた（一点もの）」と知らせる（戦闘のドロップは除く。戦闘の
 *     「〜を手に入れた」と重なるため）。
 *   - 捨てられない：MZ には捨てる操作が無い。捨てる画面を作るときは Hai.Items.canDiscard を見る。
 *
 * ■ ドロップの決まり（敵のメモ欄）
 *   <hai_drop:none>          武器・防具を落とさない。
 *   <hai_drop:item,201,1>    必ず（確率 100%）落とす物。種類 item/weapon/armor（i/w/a でもよい）、ID、数。
 *                            いくつでも書ける。
 *   パラメータ「ザコは装備を落とさない」が ON（既定）なら、<hai_boss>（P4）の無い敵の
 *   武器・防具のドロップはすべて落ちない（敵のデータの設定より優先）。アイテムは落ちる。
 *
 * ■ 状態（セーブに入る）
 *   $gameSystem._hai.storage = [{ kind: "item"|"weapon"|"armor", id, n }, ...]（入れた順）
 *   古いセーブで無ければ、読むときに [] を入れる。
 *
 * ■ 窓口（window.Hai.Items）
 *   storage()                    倉庫の中身の写し [{kind, id, n}]
 *   storageCount(kind, id)       倉庫にある数
 *   takeFromStorage(kind, id, n) 倉庫から袋へ n 個（上限まで）出す。出した数を返す
 *   putToStorage(kind, id, n)    袋から倉庫へ n 個入れる。入れた数を返す
 *   maxOf(item) / roomFor(item)  上限 / あと何個袋に入るか（一点ものは装備中の分も数える）
 *   isUnique(item) / canSell(item) / canDiscard(item)
 *   isBoss(enemyId) / dropsEquipment(enemyId) / fixedDrops(enemyId)  ドロップの判定
 *   itemOf(kind, id) / kindOf(item)  種類と ID ⇔ データ（kind は item/weapon/armor か i/w/a）
 *   pendingNotices()             まだ出していない知らせ（画面の中で起きたもの）
 *
 * @param itemMax
 * @text 消耗品の上限
 * @desc <hai_max> の無い、ふつうのアイテムで「消耗する」ものの上限。0 で MZ の既定（99）。
 * @type number
 * @min 0
 * @default 5
 *
 * @param equipMax
 * @text 装備の上限
 * @desc <hai_max> の無い武器・防具の上限。0 で MZ の既定（99）。
 * @type number
 * @min 0
 * @default 0
 *
 * @param zakoNoEquip
 * @text ザコは装備を落とさない
 * @desc ON：<hai_boss> の無い敵の武器・防具のドロップを落とさない。
 * @type boolean
 * @on 落とさない
 * @off データのまま
 * @default true
 *
 * @param storageMessage
 * @text 倉庫へ送ったときの文
 * @desc %1 が物の名前、%2 が数。空にすると知らせない。
 * @type string
 * @default %1（%2 個）は倉庫へ送られた。
 *
 * @param uniqueMessage
 * @text 一点ものを手に入れたときの文
 * @desc %1 が物の名前。空にすると知らせない。
 * @type string
 * @default %1を手に入れた（一点もの）。
 *
 * @param storageTitle
 * @text 倉庫の画面の見出し
 * @type string
 * @default 倉庫（決定で 1 つ取り出す）
 *
 * @command openStorage
 * @text 倉庫を開く
 * @desc 倉庫の中身の一覧を開く（テスト用の最小の画面。P8 の保管ゲートが本物を作る）。
 */
(() => {
  "use strict";
  const pluginName = "Hai_Items";
  const params = PluginManager.parameters(pluginName);
  const P = {
    itemMax: Number(params.itemMax || 5),
    equipMax: Number(params.equipMax || 0),
    zakoNoEquip: params.zakoNoEquip !== "false",
    storageMessage: params.storageMessage ?? "%1（%2 個）は倉庫へ送られた。",
    uniqueMessage: params.uniqueMessage ?? "%1を手に入れた（一点もの）。",
    storageTitle: params.storageTitle || "倉庫（決定で 1 つ取り出す）",
  };
  const MZ_MAX = 99;
  let trading = false; // 装備の付け替えで袋に戻すとき（知らせない・装備中を数えない）
  let quiet = false; // 倉庫から出すとき（知らせない）

  // ---------------------------------------------------------------------------
  // 種類と ID
  // ---------------------------------------------------------------------------
  const KIND = { i: "item", w: "weapon", a: "armor", item: "item", weapon: "weapon", armor: "armor" };
  const normKind = kind => KIND[String(kind).toLowerCase()] || null;
  const tableOf = kind => ({ item: $dataItems, weapon: $dataWeapons, armor: $dataArmors })[normKind(kind)];
  function itemOf(kind, id) {
    const table = tableOf(kind);
    return (table && table[Number(id)]) || null;
  }
  function kindOf(item) {
    if (DataManager.isItem(item)) return "item";
    if (DataManager.isWeapon(item)) return "weapon";
    if (DataManager.isArmor(item)) return "armor";
    return null;
  }

  // ---------------------------------------------------------------------------
  // 状態（$gameSystem._hai.storage）
  // ---------------------------------------------------------------------------
  function storageList() {
    $gameSystem._hai = $gameSystem._hai || {};
    if (!Array.isArray($gameSystem._hai.storage)) $gameSystem._hai.storage = [];
    return $gameSystem._hai.storage;
  }
  function findEntry(kind, id) {
    return storageList().find(e => e.kind === kind && e.id === id);
  }
  function addToStorage(item, n) {
    if (!item || n <= 0) return;
    const kind = kindOf(item);
    const entry = findEntry(kind, item.id);
    if (entry) entry.n += n;
    else storageList().push({ kind, id: item.id, n });
  }

  // ---------------------------------------------------------------------------
  // 上限
  // ---------------------------------------------------------------------------
  const isUnique = item => !!(item && item.meta && item.meta.hai_unique);
  function maxOf(item) {
    if (!item) return MZ_MAX;
    if (isUnique(item)) return 1;
    const tag = item.meta && item.meta.hai_max;
    if (tag !== undefined && tag !== true && Number(tag) > 0) return Number(tag);
    if (DataManager.isItem(item)) {
      return item.itypeId === 1 && item.consumable && P.itemMax > 0 ? P.itemMax : MZ_MAX;
    }
    return P.equipMax > 0 ? P.equipMax : MZ_MAX;
  }
  function equippedCount(item) {
    if (!DataManager.isWeapon(item) && !DataManager.isArmor(item)) return 0;
    return $gameParty.members().reduce((n, actor) => n + actor.equips().filter(e => e === item).length, 0);
  }
  /** 袋の中（＋一点ものは装備中）の数。 */
  function ownedCount(item) {
    return $gameParty.numItems(item) + (isUnique(item) && !trading ? equippedCount(item) : 0);
  }
  const roomFor = item => Math.max(0, maxOf(item) - ownedCount(item));

  const _Game_Party_maxItems = Game_Party.prototype.maxItems;
  Game_Party.prototype.maxItems = function(item) {
    return item ? maxOf(item) : _Game_Party_maxItems.apply(this, arguments);
  };

  const _Game_Party_hasMaxItems = Game_Party.prototype.hasMaxItems;
  Game_Party.prototype.hasMaxItems = function(item) {
    if (isUnique(item)) return roomFor(item) <= 0;
    return _Game_Party_hasMaxItems.apply(this, arguments);
  };

  // ---------------------------------------------------------------------------
  // 知らせ
  // ---------------------------------------------------------------------------
  const pending = [];
  function notify(text) {
    if (!text) return;
    if ($gameParty.inBattle() || SceneManager._scene instanceof Scene_Map) {
      if ($gameMessage.hasText()) $gameMessage.newPage();
      $gameMessage.add(text);
    } else {
      pending.push(text);
    }
  }
  const _Scene_Map_update = Scene_Map.prototype.update;
  Scene_Map.prototype.update = function() {
    _Scene_Map_update.apply(this, arguments);
    if (pending.length && !$gameMessage.isBusy() && this.isActive()) {
      for (const text of pending.splice(0)) {
        if ($gameMessage.hasText()) $gameMessage.newPage();
        $gameMessage.add(text);
      }
    }
  };

  // ---------------------------------------------------------------------------
  // 手に入れたとき：上限を超えた分は倉庫へ
  // ---------------------------------------------------------------------------
  const _Game_Party_gainItem = Game_Party.prototype.gainItem;
  Game_Party.prototype.gainItem = function(item, amount) {
    if (!item || !this.itemContainer(item) || !(amount > 0)) {
      return _Game_Party_gainItem.apply(this, arguments);
    }
    const room = roomFor(item);
    const overflow = Math.max(0, amount - room);
    const args = Array.prototype.slice.call(arguments);
    args[1] = amount - overflow;
    _Game_Party_gainItem.apply(this, args);
    if (trading || quiet) {
      addToStorage(item, overflow);
      return;
    }
    if (amount - overflow > 0 && isUnique(item) && !this.inBattle()) {
      notify(P.uniqueMessage.format(item.name));
    }
    if (overflow > 0) {
      addToStorage(item, overflow);
      notify(P.storageMessage.format(item.name, overflow));
      // 倉庫へ送った分も「手に入れた」として入手ログ（Hai_Notes）に残す。袋に入った分は Hai_Notes が自分で記録する
      if (window.Hai && Hai.Notes && Hai.Notes.logItem) Hai.Notes.logItem(item, overflow);
    }
  };

  const _Game_Actor_tradeItemWithParty = Game_Actor.prototype.tradeItemWithParty;
  Game_Actor.prototype.tradeItemWithParty = function() {
    trading = true;
    try {
      return _Game_Actor_tradeItemWithParty.apply(this, arguments);
    } finally {
      trading = false;
    }
  };

  // ---------------------------------------------------------------------------
  // 一点もの：売れない
  // ---------------------------------------------------------------------------
  const canSell = item => !!item && !isUnique(item) && item.price > 0;
  const canDiscard = item => !!item && !isUnique(item);

  const _Window_ShopSell_isEnabled = Window_ShopSell.prototype.isEnabled;
  Window_ShopSell.prototype.isEnabled = function(item) {
    return _Window_ShopSell_isEnabled.apply(this, arguments) && !isUnique(item);
  };

  // ---------------------------------------------------------------------------
  // ドロップの決まり
  // ---------------------------------------------------------------------------
  const DROP_RE = /<hai_drop:\s*(item|weapon|armor|i|w|a)\s*,\s*(\d+)\s*(?:,\s*(\d+)\s*)?>/gi;
  const enemyData = enemyId => $dataEnemies[Number(enemyId)] || null;
  const isBoss = enemyId => !!(enemyData(enemyId) && enemyData(enemyId).meta.hai_boss);
  function dropsEquipment(enemyId) {
    const enemy = enemyData(enemyId);
    if (!enemy) return false;
    if (/<hai_drop:\s*none\s*>/i.test(enemy.note || "")) return false;
    return !(P.zakoNoEquip && !isBoss(enemyId));
  }
  function fixedDrops(enemyId) {
    const enemy = enemyData(enemyId);
    if (!enemy) return [];
    const out = [];
    for (const m of (enemy.note || "").matchAll(DROP_RE)) {
      out.push({ kind: normKind(m[1]), id: Number(m[2]), n: m[3] ? Number(m[3]) : 1 });
    }
    return out;
  }

  const _Game_Enemy_makeDropItems = Game_Enemy.prototype.makeDropItems;
  Game_Enemy.prototype.makeDropItems = function() {
    let drops = _Game_Enemy_makeDropItems.apply(this, arguments);
    if (!dropsEquipment(this.enemyId())) {
      drops = drops.filter(item => !DataManager.isWeapon(item) && !DataManager.isArmor(item));
    }
    for (const d of fixedDrops(this.enemyId())) {
      const item = itemOf(d.kind, d.id);
      for (let i = 0; item && i < d.n; i++) drops.push(item);
    }
    return drops;
  };

  // ---------------------------------------------------------------------------
  // 倉庫の出し入れ
  // ---------------------------------------------------------------------------
  function takeFromStorage(kind, id, n = 1) {
    const k = normKind(kind);
    const item = itemOf(k, id);
    const entry = item && findEntry(k, item.id);
    if (!entry) return 0;
    const moved = Math.min(Math.max(0, Number(n) || 0), entry.n, roomFor(item));
    if (moved <= 0) return 0;
    entry.n -= moved;
    if (entry.n <= 0) storageList().splice(storageList().indexOf(entry), 1);
    quiet = true;
    try {
      $gameParty.gainItem(item, moved);
    } finally {
      quiet = false;
    }
    return moved;
  }
  function putToStorage(kind, id, n = 1) {
    const item = itemOf(kind, id);
    if (!item) return 0;
    const moved = Math.min(Math.max(0, Number(n) || 0), $gameParty.numItems(item));
    if (moved <= 0) return 0;
    $gameParty.loseItem(item, moved);
    addToStorage(item, moved);
    return moved;
  }

  // ---------------------------------------------------------------------------
  // 倉庫の画面（テスト用の最小。P8 が本物を作る）
  // ---------------------------------------------------------------------------
  class Window_HaiStorage extends Window_Command {
    makeCommandList() {
      for (const e of storageList()) {
        const item = itemOf(e.kind, e.id);
        if (item) this.addCommand(item.name, "take", roomFor(item) > 0, e);
      }
    }
    drawItem(index) {
      const rect = this.itemLineRect(index);
      const e = this._list[index].ext;
      const item = itemOf(e.kind, e.id);
      this.changePaintOpacity(this.isCommandEnabled(index));
      this.drawItemName(item, rect.x, rect.y, rect.width - 200);
      const have = `${$gameParty.numItems(item)}/${maxOf(item) >= MZ_MAX ? "-" : maxOf(item)}`;
      this.drawText(`倉庫 ${e.n}  手持ち ${have}`, rect.x, rect.y, rect.width, "right");
      this.changePaintOpacity(true);
    }
  }

  class Scene_HaiStorage extends Scene_MenuBase {
    create() {
      super.create();
      const help = new Window_Help(new Rectangle(0, this.mainAreaTop(), Graphics.boxWidth, this.calcWindowHeight(1, false)));
      help.setText(P.storageTitle);
      this.addWindow(help);
      const y = help.y + help.height;
      this._listWindow = new Window_HaiStorage(new Rectangle(0, y, Graphics.boxWidth, this.mainAreaBottom() - y));
      this._listWindow.setHandler("take", this.onTake.bind(this));
      this._listWindow.setHandler("cancel", this.popScene.bind(this));
      this.addWindow(this._listWindow);
    }
    onTake() {
      const e = this._listWindow.currentExt();
      if (e && takeFromStorage(e.kind, e.id, 1) > 0) SoundManager.playEquip();
      this._listWindow.refresh();
      this._listWindow.select(Math.min(this._listWindow.index(), this._listWindow.maxItems() - 1));
      this._listWindow.activate();
    }
  }

  PluginManager.registerCommand(pluginName, "openStorage", () => {
    SceneManager.push(Scene_HaiStorage);
  });

  // ---------------------------------------------------------------------------
  // 窓口
  // ---------------------------------------------------------------------------
  window.Hai = window.Hai || {};
  Hai.Items = {
    params: P,
    storage: () => storageList().map(e => ({ ...e })),
    storageCount: (kind, id) => (findEntry(normKind(kind), Number(id)) || { n: 0 }).n,
    takeFromStorage,
    putToStorage,
    maxOf,
    roomFor,
    isUnique,
    canSell,
    canDiscard,
    isBoss,
    dropsEquipment,
    fixedDrops,
    itemOf,
    kindOf,
    normKind,
    pendingNotices: () => pending.slice(),
    Scene_HaiStorage,
    Window_HaiStorage,
  };
})();
