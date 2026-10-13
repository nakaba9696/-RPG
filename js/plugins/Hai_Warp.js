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
 *   行き先が「一列で出す数」より多いときは、まず地域（パラメータ regions のマップ番号の帯）を選び、
 *   次にその地域の結界を選ぶ（P18）。カーソルは今いる地域から始まる。地域の一覧で「戻る」を選ぶと地域へ戻る。
 *   ほかのプラグインが足した行き先（見張り台の入口）は結界と混ぜず、別の見出し（sourceGroup）の下に出す。
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
 * 記録を作る（P14）：結末のイベントからプラグインコマンド「記録を作る」（saveRecord）で、記録「朝の砦」を自動で作る。
 *   空いている枠に書く（いちばん新しい記録＝頂の手前の記録は上書きしない）。空きが無ければ、いちばん新しい記録を除いた
 *   いちばん古い枠に書く。ロードすると、そのコマンドの次から続く。記録の一覧には「ファイル N」の横に名前が出る。
 *
 * 窓口（window.Hai.Warp）
 *   visited()              訪れた結界 [{mapId, eventId, x, y, name}]（写し。訪れた順）
 *   visit(mapId, eventId)  今のマップの結界を訪れたことにする（覚えたらその写し、結界でなければ null）
 *   destinations()         今の転送の一覧 [{name, mapId, eventId, x, y, home, group}]（拠点が先頭、いまの所は除く）
 *   groups()               地域ごとのまとまり [{name, items: [destinations() の番号]}]（拠点は入れない。並びは regions の順）
 *   regionOf(mapId)        マップの地域の名前（帯に無ければ otherGroup）
 *   warpTo(index)          destinations() の index 番へ転送する（場所移動を予約。できたら true）
 *   recordSlot()           「記録を作る」が書く枠の番号（書ける枠が無ければ -1）
 *   saveRecord(label)      今の状態を記録として書く（Promise。書いた枠の番号で解決する）
 *   addSource(fn)          ほかのプラグインが行き先を足す（fn() は [{name, mapId, x, y, d, group?}]。P13 の見張り台）
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
 * @param regions
 * @text 地域（転送の一覧のまとまり）
 * @desc 名前:最初のマップID-最後のマップID をカンマで区切る。並びが地域の一覧の順。
 * @type string
 * @default 砦:10-19,霧の森:20-25,鉄の坑道:26-32,営倉:33-49,境山の古道:50-59,焼けた村:60-69,霧の湖:70-79,記録院:80-89,鋳物場:90-99,地下水道:100-109,麦の街道:110-119,鐘守の修道院:120-129,門叩きの縄張り:170-179,境山の高み:180-189
 *
 * @param otherGroup
 * @text 帯に無いマップの地域名
 * @type string
 * @default そのほか
 *
 * @param sourceGroup
 * @text ほかのプラグインが足した行き先の見出し
 * @desc 見張り台（Hai_Facilities）が足す入口など。結界とは混ぜずにこの見出しの下に出す。
 * @type string
 * @default 見張り台から見えた入口
 *
 * @param flatMax
 * @text 一列で出す数
 * @desc 行き先（拠点を含む）がこの数以下なら地域に分けずに一列で出す。
 * @type number
 * @default 8
 *
 * @param regionMessage
 * @text 地域の中から選ぶときの文章
 * @type string
 * @default %1のどこへ転送する？
 *
 * @param backText
 * @text 選択肢「戻る」
 * @type string
 * @default 戻る
 *
 * @param recordFormat
 * @text 記録の名前の形
 * @desc 「記録を作る」で作った記録を、記録の一覧に出す形。%1 が名前。
 * @type string
 * @default 「%1」
 *
 * @command open
 * @text 結界を開く
 * @desc このイベントで結界の選択肢（休む・記録する・転送する・やめる）を出す。<hai_warp> のイベントなら訪れたことにもする。
 *
 * @command saveRecord
 * @text 記録を作る
 * @desc 今の状態を、空いている枠に記録する（いちばん新しい記録は上書きしない）。結末のあとの「朝の砦」用。
 *
 * @arg label
 * @text 記録の名前
 * @type string
 * @default 朝の砦
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
  const recordFormat = text("recordFormat", "「%1」");
  const otherGroup = text("otherGroup", "そのほか");
  const sourceGroup = text("sourceGroup", "見張り台から見えた入口");
  const flatMax = Number(params.flatMax || 8);
  const regionMessage = text("regionMessage", "%1のどこへ転送する？");
  const backText = text("backText", "戻る");
  const regions = text("regions",
    "砦:10-19,霧の森:20-25,鉄の坑道:26-32,営倉:33-49,境山の古道:50-59,焼けた村:60-69,霧の湖:70-79,記録院:80-89," +
    "鋳物場:90-99,地下水道:100-109,麦の街道:110-119,鐘守の修道院:120-129,門叩きの縄張り:170-179,境山の高み:180-189")
    .split(",")
    .map(t => t.trim().match(/^(.+):(\d+)-(\d+)$/))
    .filter(m => m)
    .map(m => ({ name: m[1].trim(), from: Number(m[2]), to: Number(m[3]) }));

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

  /** マップの地域の名前（regions の帯。無ければ otherGroup）。 */
  function regionOf(mapId) {
    const r = regions.find(r => mapId >= r.from && mapId <= r.to);
    return r ? r.name : otherGroup;
  }

  /** 結界の並び：地域（regions の順）→ マップ番号 → イベント番号。帯に無いマップは最後。 */
  function regionRank(mapId) {
    const i = regions.findIndex(r => mapId >= r.from && mapId <= r.to);
    return i < 0 ? regions.length : i;
  }

  const sources = []; // addSource で足した、行き先を返す関数
  function destinations() {
    const h = here();
    const home = homeOf();
    const out = [];
    if (home && !(h && h.mapId === home.mapId)) {
      out.push({ name: homeName, mapId: home.mapId, eventId: 0, x: home.x, y: home.y, d: home.d || 2, home: true });
    }
    // 触れた結界だけ。地域ごとに並べる（訪れた順ではなく、地図の並び）
    const visited = state().visited
      .filter(v => !(h && v.mapId === h.mapId && v.eventId === h.eventId) && !(home && v.name === homeName))
      .slice()
      .sort((a, b) => regionRank(a.mapId) - regionRank(b.mapId) || a.mapId - b.mapId || a.eventId - b.eventId);
    for (const v of visited) {
      out.push({ name: v.name, mapId: v.mapId, eventId: v.eventId, x: v.x, y: v.y, d: 2, home: false, group: regionOf(v.mapId) });
    }
    // ほかのプラグインが足す行き先（P13 の見張り台）。着く所はその座標のまま（結界の 1 マス下にしない）
    for (const source of sources) {
      for (const e of source() || []) {
        if (!e || out.some(o => o.name === e.name)) continue;
        out.push({
          name: String(e.name), mapId: Number(e.mapId), eventId: 0, x: Number(e.x), y: Number(e.y), d: Number(e.d) || 2,
          home: false, exact: true, group: e.group ? String(e.group) : sourceGroup,
        });
      }
    }
    return out;
  }

  /** 地域ごとのまとまり [{name, items}]（items は destinations() の番号）。拠点は入れない。結界の地域が先、足した行き先の見出しは後。 */
  function groupsOf(dests) {
    const out = [];
    dests.forEach((d, i) => {
      if (d.home) return;
      let g = out.find(g => g.name === d.group);
      if (!g) out.push((g = { name: d.group, items: [] }));
      g.items.push(i);
    });
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

  const warpCmd = (j, indent) => cmd(355, [`Hai.Warp.warpTo(${j}); this.setWaitMode("transfer");`], indent);

  /** 行き先を一列に出す命令（少ないとき）。 */
  function flatCmds(dests, indent) {
    const names = dests.map(d => d.name);
    const body = [...textCmds([warpMessage], indent), cmd(102, [[...names, cancelText], names.length, 0, 2, 0], indent)];
    names.forEach((n, j) => body.push(cmd(402, [j, n], indent), warpCmd(j, indent + 1), cmd(0, [], indent + 1)));
    body.push(cmd(402, [names.length, cancelText], indent), cmd(0, [], indent + 1), cmd(404, [], indent));
    return body;
  }

  const regionLabel = "hai_warp_regions";

  /** 行き先を地域 → 結界の二段で出す命令（多いとき）。拠点は地域の一覧の先頭からそのまま選べる。 */
  function groupedCmds(dests, indent) {
    const homeIndex = dests.findIndex(d => d.home);
    const groups = groupsOf(dests);
    const top = [...(homeIndex >= 0 ? [{ text: dests[homeIndex].name, home: homeIndex }] : []), ...groups.map(g => ({ text: g.name, group: g }))];
    const hereGroup = here() ? regionOf($gameMap.mapId()) : null;
    const start = Math.max(0, top.findIndex(t => t.group && t.group.name === hereGroup));
    const i1 = indent + 1;
    const i2 = indent + 2;
    const body = [cmd(118, [regionLabel], indent), ...textCmds([warpMessage], indent)];
    body.push(cmd(102, [[...top.map(t => t.text), cancelText], top.length, start, 2, 0], indent));
    top.forEach((t, j) => {
      body.push(cmd(402, [j, t.text], indent));
      if (t.group) {
        const names = t.group.items.map(i => dests[i].name);
        const back = names.length;
        body.push(...textCmds([regionMessage.replace("%1", t.text)], i1));
        body.push(cmd(102, [[...names, backText, cancelText], back, 0, 2, 0], i1));
        t.group.items.forEach((di, k) => body.push(cmd(402, [k, names[k]], i1), warpCmd(di, i2), cmd(0, [], i2)));
        body.push(cmd(402, [back, backText], i1), cmd(119, [regionLabel], i2), cmd(0, [], i2));
        body.push(cmd(402, [back + 1, cancelText], i1), cmd(0, [], i2), cmd(404, [], i1));
      } else {
        body.push(warpCmd(t.home, i1));
      }
      body.push(cmd(0, [], i1));
    });
    body.push(cmd(402, [top.length, cancelText], indent), cmd(0, [], i1), cmd(404, [], indent));
    return body;
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
    if (dests.length) items.push({ text: warpText, body: dests.length > flatMax ? groupedCmds(dests, 1) : flatCmds(dests, 1) });
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
  // 記録を作る（P14。朝の砦）
  // ---------------------------------------------------------------------------
  /** 書く枠：空き → 無ければ、いちばん新しい記録を除いたいちばん古い枠。オートセーブの枠（0）は使わない。 */
  function recordSlot() {
    const empty = DataManager.emptySavefileId();
    if (empty > 0) return empty;
    const latest = DataManager.latestSavefileId();
    let best = -1;
    for (let id = 1; id < DataManager.maxSavefiles(); id++) {
      const info = DataManager.savefileInfo(id);
      if (id === latest || !info) continue;
      if (best < 0 || info.timestamp < DataManager.savefileInfo(best).timestamp) best = id;
    }
    return best;
  }

  /** 今の状態を記録として書く。Promise（書いた枠の番号。書けなければ -1）。 */
  function saveRecord(label) {
    const id = recordSlot();
    if (id <= 0) return Promise.resolve(-1);
    $gameSystem.setSavefileId(id);
    $gameSystem.onBeforeSave();
    const name = String(label || "");
    return DataManager.saveGame(id).then(() => {
      const info = DataManager.savefileInfo(id);
      if (info && name) {
        info.haiLabel = name;
        DataManager.saveGlobalInfo();
      }
      return id;
    });
  }

  PluginManager.registerCommand(pluginName, "saveRecord", function(args) {
    // 中身（$gameMap の実行中のイベント）はその場で写されるので、写す間だけ「次の命令」を指しておく
    // （ロードしたとき、このコマンドをもう一度実行して記録を作り直さないように）
    this._index++;
    saveRecord(args.label ?? "朝の砦").catch(e => console.warn("Hai_Warp: 記録を作れなかった", e));
    this._index--;
  });

  const _Window_SavefileList_drawTitle = Window_SavefileList.prototype.drawTitle;
  Window_SavefileList.prototype.drawTitle = function(savefileId, x, y) {
    _Window_SavefileList_drawTitle.apply(this, arguments);
    const info = DataManager.savefileInfo(savefileId);
    if (info && info.haiLabel) this.drawText(recordFormat.replace("%1", info.haiLabel), x + 180, y, 240);
  };

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
    /** 地域ごとのまとまり [{name, items}]（items は destinations() の番号）。 */
    groups() {
      return groupsOf(destinations()).map(g => ({ name: g.name, items: g.items.slice() }));
    },
    regionOf: mapId => regionOf(Number(mapId)),
    warpTo,
    recordSlot,
    saveRecord,
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
