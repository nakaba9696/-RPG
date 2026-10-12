/*:
 * @target MZ
 * @plugindesc セーブ地点の結界：触れると覚え、調べると休む・記録する・訪れた結界へ転送する。
 * @author 灰の王国
 * @help
 * 結界のイベントのメモ欄に <hai_warp:名前> と書く（名前を省くとイベントの名前）。
 * 推しの置き方：プライオリティ「通常キャラと同じ」、トリガー「決定ボタン」、中身なし。
 *
 * 触れる（結界に向かって歩いてぶつかる。トリガーが接触なら踏む・ぶつかる）
 *   その結界を「訪れた」として覚える（$gameSystem._hai.warp。セーブに入る）。
 *   初めてのときは効果音と「名前に触れた。」を出し、Hai_Thoughts があればメモに 1 行残す。
 * 調べる（決定ボタン・タッチ）
 *   訪れたことにしたうえで、選択肢「休む／記録する／転送する／やめる」を出す。
 *   休む：全回復。記録する：セーブ画面。転送する：訪れた結界の一覧（いまの所は除く）から選ぶ。
 *   ほかに行き先が無いときは「転送する」を出さず、「まだ他の結界を知らない。」と出す。
 *   転送先は結界のイベントの 1 マス下（下が通れなければ結界の位置）。
 * 拠点
 *   Hai_Defeat の拠点（「拠点を設定」）が決まっていれば、一覧の先頭に「牢獄の間」（パラメータ）を常に出す。
 *   行き先は拠点の座標。拠点と同じ名前の結界は一覧に重ねて出さない。拠点のマップにいるときは出さない。
 * イベントの中身
 *   1 ページ目の list に命令があれば、それを先に流してから選択肢を出す（調べたときだけ）。
 *   中身から「結界を開く」を呼んでいれば、選択肢はそこで出る（二重に出さない）。
 *
 * セーブ：メニューからのセーブは MZ の既定のまま（どこでもできる）。
 *
 * 窓口（window.Hai.Warp）
 *   visited()              訪れた結界 [{mapId, eventId, x, y, name}]（写し。訪れた順）
 *   visit(mapId, eventId)  今のマップの結界を訪れたことにする（覚えたらその写し、結界でなければ null）
 *   destinations()         今の転送の一覧 [{name, mapId, eventId, x, y, home}]（拠点が先頭、いまの所は除く）
 *   warpTo(index)          destinations() の index 番へ転送する（場所移動を予約。できたら true）
 *   addSource(fn)          ほかのプラグインが行き先を足す（fn() は [{name, mapId, x, y, d}]。P13 の見張り台）
 *   openMenu(eventId?)     その結界（省略で目の前か足元の結界）の選択肢を出す（できたら true）
 *
 * @param homeName
 * @text 拠点の名前
 * @type string
 * @default 牢獄の間
 *
 * @param visitMessage
 * @text 初めて触れたときの文章
 * @type string
 * @default %1に触れた。転送の行き先に加わった。
 *
 * @param menuMessage
 * @text 調べたときの文章
 * @type string
 * @default %1が静かに光っている。
 *
 * @param noDestMessage
 * @text 行き先が無いときの文章
 * @type string
 * @default まだ他の結界を知らない。
 *
 * @param warpMessage
 * @text 転送先を選ぶときの文章
 * @type string
 * @default どこへ転送する？
 *
 * @param restMessage
 * @text 休んだときの文章
 * @type string
 * @default 結界の光に包まれ、傷と疲れが癒えた。
 *
 * @param restText
 * @text 選択肢「休む」
 * @type string
 * @default 休む
 *
 * @param saveText
 * @text 選択肢「記録する」
 * @type string
 * @default 記録する
 *
 * @param warpText
 * @text 選択肢「転送する」
 * @type string
 * @default 転送する
 *
 * @param cancelText
 * @text 選択肢「やめる」
 * @type string
 * @default やめる
 *
 * @param noteFormat
 * @text メモの一行
 * @type string
 * @default %1（%2）
 *
 * @param visitSe
 * @text 初めて触れたときの効果音
 * @type file
 * @dir audio/se
 * @default Saint3
 *
 * @param restSe
 * @text 休んだときの効果音
 * @type file
 * @dir audio/se
 * @default Recovery
 *
 * @param warpSe
 * @text 転送の効果音
 * @type file
 * @dir audio/se
 * @default Teleport
 *
 * @command open
 * @text 結界を開く
 * @desc このイベントで結界の選択肢（休む・記録する・転送する・やめる）を出す。<hai_warp> のイベントなら訪れたことにもする。
 */
(() => {
  "use strict";
  const pluginName = "Hai_Warp";
  const params = PluginManager.parameters(pluginName);
  const text = (name, def) => String(params[name] ?? def);
  const homeName = text("homeName", "牢獄の間");
  const visitMessage = text("visitMessage", "%1に触れた。転送の行き先に加わった。");
  const menuMessage = text("menuMessage", "%1が静かに光っている。");
  const noDestMessage = text("noDestMessage", "まだ他の結界を知らない。");
  const warpMessage = text("warpMessage", "どこへ転送する？");
  const restMessage = text("restMessage", "結界の光に包まれ、傷と疲れが癒えた。");
  const restText = text("restText", "休む");
  const saveText = text("saveText", "記録する");
  const warpText = text("warpText", "転送する");
  const cancelText = text("cancelText", "やめる");
  const noteFormat = text("noteFormat", "%1（%2）");
  const visitSe = text("visitSe", "Saint3");
  const restSe = text("restSe", "Recovery");
  const warpSe = text("warpSe", "Teleport");

  // ---------------------------------------------------------------------------
  // 状態（$gameSystem._hai.warp。セーブに入る）
  // ---------------------------------------------------------------------------
  function state() {
    $gameSystem._hai = $gameSystem._hai || {};
    const s = ($gameSystem._hai.warp = $gameSystem._hai.warp || {});
    s.visited = s.visited || [];
    return s;
  }

  const findVisited = (mapId, eventId) => state().visited.find(v => v.mapId === mapId && v.eventId === eventId) || null;

  /** イベントの結界の名前（<hai_warp:名前>。値なしならイベントの名前）。結界でなければ null。 */
  function warpNameOf(event) {
    const data = event && event.event();
    if (!data || !data.meta || data.meta.hai_warp === undefined) return null;
    const v = data.meta.hai_warp;
    return v === true ? String(data.name || "") : String(v).trim();
  }

  function mapName(mapId) {
    if (mapId === $gameMap.mapId() && $gameMap.displayName()) return $gameMap.displayName();
    const info = $dataMapInfos[mapId];
    return info ? info.name : String(mapId);
  }

  /** 今のマップの結界を訪れたことにする。{ entry, isNew }、結界でなければ null。 */
  function visitEvent(event) {
    const name = warpNameOf(event);
    if (name === null) return null;
    const mapId = $gameMap.mapId();
    const eventId = event.eventId();
    let entry = findVisited(mapId, eventId);
    if (entry) {
      entry.x = event.x;
      entry.y = event.y;
      entry.name = name;
      return { entry, isNew: false };
    }
    entry = { mapId, eventId, x: event.x, y: event.y, name };
    state().visited.push(entry);
    if (window.Hai && Hai.Thoughts) {
      Hai.Thoughts.addNote({
        id: `warp:${mapId},${eventId}`,
        text: noteFormat.replace("%1", name).replace("%2", mapName(mapId)),
        mapId, x: event.x, y: event.y, kind: "clue",
      });
    }
    return { entry, isNew: true };
  }

  // ---------------------------------------------------------------------------
  // 転送の一覧
  // ---------------------------------------------------------------------------
  // いま選択肢を出している結界（$gameTemp。セーブに入らない）
  function here() {
    const h = $gameTemp._haiWarpHere;
    return h && h.mapId === $gameMap.mapId() ? h : null;
  }

  /** Hai_Defeat の拠点が決まっていれば { mapId, x, y, d }、無ければ null。 */
  function homeOf() {
    if (!(window.Hai && Hai.Defeat)) return null;
    const s = $gameSystem._hai && $gameSystem._hai.defeat;
    if (!s || !s.home) return null;
    return Hai.Defeat.home();
  }

  const sources = []; // addSource で足した、行き先を返す関数
  function destinations() {
    const h = here();
    const home = homeOf();
    const out = [];
    if (home && !(h && h.mapId === home.mapId)) {
      out.push({ name: homeName, mapId: home.mapId, eventId: 0, x: home.x, y: home.y, d: home.d || 2, home: true });
    }
    for (const v of state().visited) {
      if (h && v.mapId === h.mapId && v.eventId === h.eventId) continue;
      if (home && v.name === homeName) continue;
      out.push({ name: v.name, mapId: v.mapId, eventId: v.eventId, x: v.x, y: v.y, d: 2, home: false });
    }
    // ほかのプラグインが足す行き先（P13 の見張り台）。着く所はその座標のまま（結界の 1 マス下にしない）
    for (const source of sources) {
      for (const e of source() || []) {
        if (!e || out.some(o => o.name === e.name)) continue;
        out.push({ name: String(e.name), mapId: Number(e.mapId), eventId: 0, x: Number(e.x), y: Number(e.y), d: Number(e.d) || 2, home: false, exact: true });
      }
    }
    return out;
  }

  function playSe(name) {
    if (name) AudioManager.playSe({ name, volume: 90, pitch: 100, pan: 0 });
  }

  function warpTo(index) {
    const dest = destinations()[Number(index)];
    if (!dest || $gamePlayer.isTransferring()) return false;
    playSe(warpSe);
    const exact = dest.home || dest.exact;
    $gameTemp._haiWarpLanding = exact ? null : { mapId: dest.mapId, eventId: dest.eventId };
    $gamePlayer.reserveTransfer(dest.mapId, dest.x, exact ? dest.y : dest.y + 1, dest.d, 0);
    return true;
  }

  /** 結界 (x, y) の 1 マス下に立てるか：下のマスから結界の方へ歩け（壁の上面などを除く）、通常キャラと同じ高さのイベントがない。 */
  function canStandBelow(x, y) {
    if (!$gameMap.isValid(x, y + 1)) return false;
    if (!$gameMap.isPassable(x, y + 1, 8) || !$gameMap.isPassable(x, y, 2)) return false;
    return !$gameMap.eventsXyNt(x, y + 1).some(e => e.isNormalPriority());
  }

  // 結界への転送：着いたマップで結界の 1 マス下に立てるか見て、立てなければ結界の位置に置く
  const _Game_Player_performTransfer = Game_Player.prototype.performTransfer;
  Game_Player.prototype.performTransfer = function() {
    const landing = this.isTransferring() ? $gameTemp._haiWarpLanding : null;
    _Game_Player_performTransfer.apply(this, arguments);
    if (!landing) return;
    $gameTemp._haiWarpLanding = null;
    const event = $gameMap.mapId() === landing.mapId ? $gameMap.event(landing.eventId) : null;
    if (!event) return;
    const below = canStandBelow(event.x, event.y);
    this.locate(event.x, below ? event.y + 1 : event.y);
    this.setDirection(2);
  };

  // ---------------------------------------------------------------------------
  // イベントの中身（調べたとき・触れたとき）
  // ---------------------------------------------------------------------------
  const cmd = (code, parameters, indent = 0) => ({ code, indent, parameters });
  const seCmd = (name, indent) => cmd(250, [{ name, volume: 90, pitch: 100, pan: 0 }], indent);
  const textCmds = (lines, indent = 0) => [cmd(101, ["", 0, 0, 2, ""], indent), ...lines.map(l => cmd(401, [l], indent))];

  function visitCmds(entry) {
    const out = [];
    if (visitSe) out.push(seCmd(visitSe, 0));
    if (visitMessage) out.push(...textCmds([visitMessage.replace("%1", entry.name)]));
    return out;
  }

  /** 選択肢の命令（最後の code 0 は含まない）。name は見出しの名前。 */
  function menuCmds(name) {
    const dests = destinations();
    const lines = [menuMessage.replace("%1", name)];
    if (!dests.length && noDestMessage) lines.push(noDestMessage);
    const items = [
      { text: restText, body: [seCmd(restSe, 1), cmd(314, [0, 0], 1), ...(restMessage ? textCmds([restMessage], 1) : [])] },
      { text: saveText, body: [cmd(352, [], 1)] },
    ];
    if (dests.length) {
      const names = dests.map(d => d.name);
      const body = [...textCmds([warpMessage], 1), cmd(102, [[...names, cancelText], names.length, 0, 2, 0], 1)];
      names.forEach((n, j) => {
        body.push(cmd(402, [j, n], 1), cmd(355, [`Hai.Warp.warpTo(${j}); this.setWaitMode("transfer");`], 2), cmd(0, [], 2));
      });
      body.push(cmd(402, [names.length, cancelText], 1), cmd(0, [], 2), cmd(404, [], 1));
      items.push({ text: warpText, body });
    }
    items.push({ text: cancelText, body: [] });
    const out = [...textCmds(lines), cmd(102, [items.map(i => i.text), items.length - 1, 0, 2, 0])];
    items.forEach((item, i) => out.push(cmd(402, [i, item.text]), ...item.body, cmd(0, [], 1)));
    out.push(cmd(404, []));
    return out;
  }

  const isOpenCommand = c => c.code === 357 && c.parameters[0] === pluginName && c.parameters[1] === "open";

  /** 結界のイベントが始まったときの list。byButton：調べた（選択肢を出す）。 */
  function warpList(event, list, byButton) {
    const visited = visitEvent(event);
    const own = (list || []).slice(0, -1); // 最後の code 0 を除く
    const out = [];
    if (visited.isNew) out.push(...visitCmds(visited.entry));
    if (byButton) {
      out.push(...own);
      if (!own.some(isOpenCommand)) {
        $gameTemp._haiWarpHere = { mapId: $gameMap.mapId(), eventId: event.eventId() };
        out.push(...menuCmds(visited.entry.name));
      }
    }
    out.push(cmd(0, []));
    return out;
  }

  // 調べた（決定ボタン・タッチ）のか、触れたのかを見分ける
  let pressing = false;
  const _Game_Player_triggerAction = Game_Player.prototype.triggerAction;
  Game_Player.prototype.triggerAction = function() {
    pressing = true;
    try {
      return _Game_Player_triggerAction.apply(this, arguments);
    } finally {
      pressing = false;
    }
  };

  // 結界は中身なしでも始める（コアは list が空のイベントを始めない）
  const _Game_Event_start = Game_Event.prototype.start;
  Game_Event.prototype.start = function() {
    _Game_Event_start.apply(this, arguments);
    if (warpNameOf(this) === null) return;
    if (!this._starting) {
      this._starting = true;
      if (this.isTriggerIn([0, 1, 2])) this.lock();
    }
    this._haiWarpByButton = pressing;
  };

  // 決定ボタンで始まる結界に歩いてぶつかったら、まだ訪れていなければ「触れた」として始める
  const _Game_Player_checkEventTriggerTouch = Game_Player.prototype.checkEventTriggerTouch;
  Game_Player.prototype.checkEventTriggerTouch = function(x, y) {
    _Game_Player_checkEventTriggerTouch.apply(this, arguments);
    if (!this.canStartLocalEvents() || $gameMap.isEventRunning()) return;
    for (const event of $gameMap.eventsXy(x, y)) {
      if (event.isTriggerIn([0]) && event.isNormalPriority() && warpNameOf(event) !== null &&
          !findVisited($gameMap.mapId(), event.eventId())) {
        event.start();
        break;
      }
    }
  };

  const _Game_Interpreter_setup = Game_Interpreter.prototype.setup;
  Game_Interpreter.prototype.setup = function(list, eventId) {
    const event = this._depth === 0 && eventId > 0 && $gameMap ? $gameMap.event(eventId) : null;
    if (event && list && list === event.list() && warpNameOf(event) !== null) {
      const byButton = !!event._haiWarpByButton;
      event._haiWarpByButton = false;
      list = warpList(event, list, byButton);
    }
    _Game_Interpreter_setup.call(this, list, eventId);
  };

  /** その結界（または結界でないイベント）の選択肢の list。 */
  function openList(event) {
    const visited = visitEvent(event);
    const out = visited && visited.isNew ? visitCmds(visited.entry) : [];
    $gameTemp._haiWarpHere = visited ? { mapId: $gameMap.mapId(), eventId: event.eventId() } : null;
    const name = visited ? visited.entry.name : String(event.event().name || "");
    out.push(...menuCmds(name), cmd(0, []));
    return out;
  }

  PluginManager.registerCommand(pluginName, "open", function() {
    const event = $gameMap.event(this._eventId);
    if (event) this.setupChild(openList(event), this._eventId);
  });

  // ---------------------------------------------------------------------------
  // 窓口
  // ---------------------------------------------------------------------------
  /** 目の前か足元の結界のイベント。 */
  function nearbyWarp() {
    const p = $gamePlayer;
    const fx = $gameMap.roundXWithDirection(p.x, p.direction());
    const fy = $gameMap.roundYWithDirection(p.y, p.direction());
    const all = [...$gameMap.eventsXy(fx, fy), ...$gameMap.eventsXy(p.x, p.y)];
    return all.find(e => warpNameOf(e) !== null) || null;
  }

  window.Hai = window.Hai || {};
  Hai.Warp = {
    /** 訪れた結界 [{mapId, eventId, x, y, name}]（写し）。 */
    visited() {
      return state().visited.map(v => ({ ...v }));
    },
    /** 今のマップの結界を訪れたことにする。覚えたらその写し、結界でなければ null。 */
    visit(mapId, eventId) {
      if (Number(mapId) !== $gameMap.mapId()) return null;
      const v = visitEvent($gameMap.event(Number(eventId)));
      return v ? { ...v.entry } : null;
    },
    /** 今の転送の一覧（拠点が先頭、いまの所は除く）。 */
    destinations() {
      return destinations().map(d => ({ ...d }));
    },
    warpTo,
    /** 転送の一覧に行き先を足す関数を登録する。fn() は [{name, mapId, x, y, d}]（着く所はその座標のまま）。 */
    addSource(fn) {
      if (typeof fn === "function") sources.push(fn);
    },
    /** その結界（省略で目の前か足元の結界）の選択肢を出す。 */
    openMenu(eventId) {
      const event = eventId ? $gameMap.event(Number(eventId)) : nearbyWarp();
      if (!event || $gameMap.isEventRunning()) return false;
      $gameMap._interpreter.setup(openList(event), event.eventId());
      return true;
    },
  };
})();
