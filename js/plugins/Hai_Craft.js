/*:
 * @target MZ
 * @plugindesc 素材からの合成：レシピ（メモ欄）、覚えたレシピ、最小の合成画面。
 * @author 灰の王国
 * @orderAfter Hai_Items
 * @help
 * ■ レシピ（できる物のメモ欄）
 *   <hai_craft:i199x2,i200>    材料を「種類＋番号（x 数）」でカンマ区切り。
 *                              種類は i＝アイテム、w＝武器、a＝防具。数を省くと 1。
 *   <hai_craft_known>          初めから知っているレシピにする。
 *   アイテム・武器・防具のどれにも書ける。できる数は 1 つ。
 *   上限を超えて作った分は、Hai_Items の倉庫へ送られる。
 *
 * ■ 知っているレシピ
 *   <hai_craft_known> の物と、パラメータ「初めから知っているレシピ」と、覚えたもの（learn）。
 *   自動メモ（Hai_Thoughts）があれば、新しく覚えたレシピを 1 行メモに残す（種類 item）。
 *
 * ■ 状態（セーブに入る）
 *   $gameSystem._hai.craft = { learned: ["i198", ...] }   覚えたレシピ（初めから知っている分は入れない）
 *   古いセーブで無ければ、読むときに空で作る。
 *
 * ■ 窓口（window.Hai.Craft）— P8（創作者の厨房）が呼ぶ
 *   recipes()             知っているレシピ [{key, kind, id, name, materials:[{kind,id,n,have,name}], canCraft}]
 *   allRecipes()          データにあるすべてのレシピ（同じ形。known も付く）
 *   recipe(kind, id)      1 つのレシピ（無ければ null）
 *   isKnown(kind, id)     知っているか
 *   canCraft(kind, id)    知っていて、材料が袋にそろっているか
 *   craft(kind, id)       材料を減らし、できる物を 1 つ増やす（上限なら倉庫へ）。作れたら true
 *   learn(kind, id)       レシピを覚える。新しく覚えたら true
 *   open()                合成の画面（Scene_HaiCraft）を開く
 *
 * @param known
 * @text 初めから知っているレシピ
 * @desc 「i197,w196」のように種類と番号をカンマ区切り。<hai_craft_known> の物に加えて知っている。
 * @type string
 * @default
 *
 * @param learnMessage
 * @text 覚えたときの文
 * @desc プラグインコマンド「レシピを覚える」で新しく覚えたときの文。%1 ができる物の名前。空にすると出さない。
 * @type string
 * @default %1のレシピを覚えた。
 *
 * @param noteText
 * @text メモの一行
 * @desc 自動メモ（Hai_Thoughts）に残す一行。%1 ができる物の名前、%2 が材料。空にすると残さない。
 * @type string
 * @default レシピ：%1（%2）
 *
 * @param craftSe
 * @text 作ったときの効果音
 * @type file
 * @dir audio/se/
 * @require 1
 * @default Item3
 *
 * @command openCraft
 * @text 合成を開く
 * @desc 合成の画面（レシピの一覧 → 材料の過不足 → 作る）を開く。
 *
 * @command learn
 * @text レシピを覚える
 * @desc できる物のレシピを覚える（レシピの紙を読むなど）。
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
 * @min 1
 * @default 1
 */
(() => {
  "use strict";
  const pluginName = "Hai_Craft";
  const params = PluginManager.parameters(pluginName);
  const P = {
    known: String(params.known || ""),
    learnMessage: params.learnMessage ?? "%1のレシピを覚えた。",
    noteText: params.noteText ?? "レシピ：%1（%2）",
    craftSe: params.craftSe || "Item3",
  };

  const KIND = { i: "item", w: "weapon", a: "armor", item: "item", weapon: "weapon", armor: "armor" };
  const LETTER = { item: "i", weapon: "w", armor: "a" };
  const normKind = kind => KIND[String(kind).trim().toLowerCase()] || null;
  const tableOf = kind => ({ item: $dataItems, weapon: $dataWeapons, armor: $dataArmors })[normKind(kind)];
  const itemOf = (kind, id) => {
    const table = tableOf(kind);
    return (table && table[Number(id)]) || null;
  };
  const keyOf = (kind, id) => LETTER[normKind(kind)] + Number(id);

  // ---------------------------------------------------------------------------
  // 状態（$gameSystem._hai.craft）
  // ---------------------------------------------------------------------------
  function state() {
    $gameSystem._hai = $gameSystem._hai || {};
    const s = ($gameSystem._hai.craft = $gameSystem._hai.craft || {});
    if (!Array.isArray(s.learned)) s.learned = [];
    return s;
  }

  // ---------------------------------------------------------------------------
  // レシピ
  // ---------------------------------------------------------------------------
  const MATERIAL_RE = /^([iwa])(\d+)(?:\s*[x×*]\s*(\d+))?$/i;
  function parseMaterials(text) {
    const out = [];
    for (const part of String(text).split(",")) {
      const m = part.trim().match(MATERIAL_RE);
      if (m) out.push({ kind: normKind(m[1]), id: Number(m[2]), n: m[3] ? Number(m[3]) : 1 });
    }
    return out;
  }
  function rawRecipe(kind, id) {
    const item = itemOf(kind, id);
    const tag = item && item.meta && item.meta.hai_craft;
    if (!tag || tag === true) return null;
    const materials = parseMaterials(tag);
    return materials.length ? { kind: normKind(kind), id: item.id, item, materials } : null;
  }
  const defaultKnown = () =>
    P.known
      .split(",")
      .map(s => s.trim().match(/^([iwa])(\d+)$/i))
      .filter(Boolean)
      .map(m => keyOf(m[1], m[2]));

  function isKnown(kind, id) {
    const r = rawRecipe(kind, id);
    if (!r) return false;
    const key = keyOf(kind, id);
    return !!r.item.meta.hai_craft_known || defaultKnown().includes(key) || state().learned.includes(key);
  }
  const materialsOk = r => r.materials.every(m => {
    const item = itemOf(m.kind, m.id);
    return item && $gameParty.numItems(item) >= m.n;
  });
  function describe(r) {
    const materials = r.materials.map(m => {
      const item = itemOf(m.kind, m.id);
      return { kind: m.kind, id: m.id, n: m.n, have: item ? $gameParty.numItems(item) : 0, name: item ? item.name : "" };
    });
    const known = isKnown(r.kind, r.id);
    return { key: keyOf(r.kind, r.id), kind: r.kind, id: r.id, name: r.item.name, materials, known, canCraft: known && materialsOk(r) };
  }
  function allRecipes() {
    const out = [];
    for (const kind of ["item", "weapon", "armor"]) {
      for (const item of tableOf(kind)) {
        const r = item && rawRecipe(kind, item.id);
        if (r) out.push(describe(r));
      }
    }
    return out;
  }
  const recipes = () => allRecipes().filter(r => r.known);
  function recipe(kind, id) {
    const r = rawRecipe(kind, id);
    return r ? describe(r) : null;
  }
  function canCraft(kind, id) {
    const r = rawRecipe(kind, id);
    return !!r && isKnown(kind, id) && materialsOk(r);
  }
  function craft(kind, id) {
    if (!canCraft(kind, id)) return false;
    const r = rawRecipe(kind, id);
    for (const m of r.materials) $gameParty.loseItem(itemOf(m.kind, m.id), m.n);
    $gameParty.gainItem(r.item, 1);
    return true;
  }
  const materialsText = r => r.materials.map(m => `${(itemOf(m.kind, m.id) || { name: "?" }).name}×${m.n}`).join("・");
  function learn(kind, id) {
    const r = rawRecipe(kind, id);
    if (!r || isKnown(kind, id)) return false;
    state().learned.push(keyOf(kind, id));
    if (P.noteText && window.Hai && Hai.Thoughts && Hai.Thoughts.addNote) {
      Hai.Thoughts.addNote({ id: "recipe:" + keyOf(kind, id), text: P.noteText.format(r.item.name, materialsText(r)), kind: "item" });
    }
    return true;
  }

  // ---------------------------------------------------------------------------
  // 合成の画面（最小。見せ方は P8 の厨房が作る）
  // ---------------------------------------------------------------------------
  class Window_HaiCraftList extends Window_Selectable {
    initialize(rect) {
      super.initialize(rect);
      this._data = [];
      this.refresh();
    }
    maxItems() {
      return this._data.length;
    }
    current() {
      return this._data[this.index()] || null;
    }
    isCurrentItemEnabled() {
      const r = this.current();
      return !!r && r.canCraft;
    }
    refresh() {
      this._data = recipes();
      super.refresh();
    }
    drawItem(index) {
      const r = this._data[index];
      const rect = this.itemLineRect(index);
      this.changePaintOpacity(r.canCraft);
      this.drawItemName(itemOf(r.kind, r.id), rect.x, rect.y, rect.width - 60);
      this.drawText(String($gameParty.numItems(itemOf(r.kind, r.id))), rect.x, rect.y, rect.width, "right");
      this.changePaintOpacity(true);
    }
    updateHelp() {
      const r = this.current();
      this._helpWindow.setItem(r ? itemOf(r.kind, r.id) : null);
      if (this._detailWindow) this._detailWindow.setRecipe(r);
    }
    setDetailWindow(w) {
      this._detailWindow = w;
      this.callUpdateHelp();
    }
  }

  class Window_HaiCraftDetail extends Window_Base {
    setRecipe(r) {
      this._recipe = r;
      this.refresh();
    }
    refresh() {
      this.contents.clear();
      const r = this._recipe;
      const lh = this.lineHeight();
      const w = this.innerWidth;
      if (!r) {
        this.drawText("覚えたレシピがない", 0, 0, w);
        return;
      }
      this.changeTextColor(ColorManager.systemColor());
      this.drawText("材料", 0, 0, w);
      this.drawText("持っている／要る", 0, 0, w, "right");
      this.resetTextColor();
      r.materials.forEach((m, i) => {
        const y = lh * (i + 1);
        const enough = m.have >= m.n;
        this.changePaintOpacity(enough);
        this.drawItemName(itemOf(m.kind, m.id), 0, y, w - 120);
        if (!enough) this.changeTextColor(ColorManager.deathColor());
        this.drawText(`${m.have} / ${m.n}`, 0, y, w, "right");
        this.resetTextColor();
        this.changePaintOpacity(true);
      });
      const y = lh * (r.materials.length + 2);
      this.changeTextColor(r.canCraft ? ColorManager.powerUpColor() : ColorManager.deathColor());
      this.drawText(r.canCraft ? "作れる（決定で作る）" : "材料が足りない", 0, y, w);
      this.resetTextColor();
    }
  }

  class Scene_HaiCraft extends Scene_MenuBase {
    create() {
      super.create();
      this.createHelpWindow();
      const top = this.mainAreaTop();
      const h = this.mainAreaHeight();
      const half = Math.floor(Graphics.boxWidth / 2);
      this._listWindow = new Window_HaiCraftList(new Rectangle(0, top, half, h));
      this._listWindow.setHelpWindow(this._helpWindow);
      this._listWindow.setHandler("ok", this.onCraft.bind(this));
      this._listWindow.setHandler("cancel", this.popScene.bind(this));
      this.addWindow(this._listWindow);
      this._detailWindow = new Window_HaiCraftDetail(new Rectangle(half, top, Graphics.boxWidth - half, h));
      this.addWindow(this._detailWindow);
      this._listWindow.setDetailWindow(this._detailWindow);
      this._listWindow.select(0);
      this._listWindow.activate();
    }
    onCraft() {
      const r = this._listWindow.current();
      if (r && craft(r.kind, r.id)) AudioManager.playSe({ name: P.craftSe, volume: 90, pitch: 100, pan: 0 });
      this._listWindow.refresh();
      this._listWindow.callUpdateHelp();
      this._listWindow.activate();
    }
  }

  const open = () => SceneManager.push(Scene_HaiCraft);

  PluginManager.registerCommand(pluginName, "openCraft", open);
  PluginManager.registerCommand(pluginName, "learn", args => {
    const r = rawRecipe(args.kind, args.id);
    if (learn(args.kind, args.id) && P.learnMessage) $gameMessage.add(P.learnMessage.format(r.item.name));
  });

  window.Hai = window.Hai || {};
  Hai.Craft = {
    params: P,
    recipes,
    allRecipes,
    recipe,
    isKnown,
    canCraft,
    craft,
    learn,
    open,
    parseMaterials,
    Scene_HaiCraft,
    Window_HaiCraftList,
    Window_HaiCraftDetail,
  };
})();
