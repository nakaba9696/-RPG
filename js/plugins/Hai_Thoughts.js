/*:
 * @target MZ
 * @plugindesc 残留思念（既読）と、手がかり・施錠扉の自動メモ。
 * @author 灰の王国
 * @help
 * 死者の残留思念（遺体・日記・落書き）を調べて読む仕組みと、メモ帳の窓口。
 * 本文はイベントの「文章の表示」に書く（プラグインは本文を持たない）。
 *
 * イベントのメモ欄：
 *   <hai_thought:R04>        残留思念。ID は docs/world.md 4.6 の番号か任意の文字列。
 *                            読み終えたら既読にし、セルフスイッチ A を ON にする。
 *                            既読の思念は、もう一度調べると本文の頭に「（読んだ）」が付く。
 *   <hai_clue:テキスト>      読み終えたとき、メモ帳にこの一行を足す（同じものは二度足さない）。
 *                            1 つのイベントに何個でも書ける。
 *   <hai_locked:坑道の鍵>    施錠扉。セルフスイッチ A が OFF の間、調べると
 *   <hai_key:121>            鍵（アイテム ID）を持っていれば開き（セルフスイッチ A を ON）、
 *                            なければ「鍵がかかっている。」と出して、メモ帳に扉を足す。
 *                            扉のイベントの 1 ページ目は中身なし（扉の絵だけ）にする。
 *
 * 状態（セーブに入る）：
 *   $gameSystem._hai.thoughts = { read: { ID: true }, maps: { マップID: [{ id, eventId, x, y }] } }
 *   $gameSystem._hai.notes    = [{ id, text, mapId, x, y, kind: "clue"|"door"|"item"|"memory", time, done? }]
 *
 * 窓口 window.Hai.Thoughts：
 *   isRead(id)  markRead(id)  notes(kind)  addNote(note)  hasNote(id)  clearNotes()
 *   unreadCount(mapId)  thoughts(mapId)
 * 詳しくは docs/plugins/Hai_Thoughts.md。
 *
 * @param readMark
 * @text 既読の思念の頭に付ける文字
 * @desc 既読の思念を調べたとき、本文の 1 行目の頭に付ける。空にすると付けない。
 * @type string
 * @default \C[8]（読んだ）\C[0]
 *
 * @param clueMessage
 * @text メモに書いたときの一行
 * @desc 手がかり・扉をメモに足したとき、文章の最後に出す行。%1 がメモの一行。空にすると出さない。
 * @type string
 * @default \C[6]メモ：\C[0]%1
 *
 * @param noteSe
 * @text メモに書いたときの効果音
 * @desc 空にすると鳴らさない。
 * @type file
 * @dir audio/se/
 * @default Book1
 *
 * @param lockedMessage
 * @text 鍵が無いときの文章
 * @type string
 * @default 鍵がかかっている。
 *
 * @param unlockMessage
 * @text 鍵で開けたときの文章
 * @desc %1 が鍵の名前。空にすると出さない。
 * @type string
 * @default %1で扉を開けた。
 *
 * @param unlockSe
 * @text 鍵で開けたときの効果音
 * @desc 空にすると鳴らさない。
 * @type file
 * @dir audio/se/
 * @default Open1
 *
 * @param doorNote
 * @text 施錠扉のメモの一行
 * @desc %1 鍵の名前、%2 マップ名、%3 x、%4 y。
 * @type string
 * @default %1が要る扉（%2 %3,%4）
 *
 * @command addNote
 * @text メモを足す
 * @desc メモ帳に一行足す（同じ ID は二度足さない）。場所はこのイベントの座標。
 *
 * @arg text
 * @text メモの一行
 * @type string
 * @default
 *
 * @arg id
 * @text ID
 * @desc 二度足さないための名前。空なら一行そのものを ID にする。
 * @type string
 * @default
 *
 * @arg kind
 * @text 種類
 * @type select
 * @option 手がかり
 * @value clue
 * @option 扉
 * @value door
 * @option もの
 * @value item
 * @default clue
 *
 * @command markRead
 * @text 思念を既読にする
 *
 * @arg id
 * @text 思念の ID
 * @type string
 * @default
 *
 * @command clearNotes
 * @text メモを全部消す（テスト用）
 */
(() => {
  "use strict";
  const pluginName = "Hai_Thoughts";
  const params = PluginManager.parameters(pluginName);
  const readMark = params.readMark ?? "\\C[8]（読んだ）\\C[0]";
  const clueMessage = params.clueMessage ?? "\\C[6]メモ：\\C[0]%1";
  const noteSe = params.noteSe ?? "Book1";
  const lockedMessage = params.lockedMessage ?? "鍵がかかっている。";
  const unlockMessage = params.unlockMessage ?? "%1で扉を開けた。";
  const unlockSe = params.unlockSe ?? "Open1";
  const doorNoteFormat = params.doorNote || "%1が要る扉（%2 %3,%4）";

  const KINDS = ["clue", "door", "item", "memory"]; // memory は P6（Hai_Companions）の記憶の断片

  // ---------------------------------------------------------------------------
  // 状態（$gameSystem._hai.thoughts と $gameSystem._hai.notes）
  // ---------------------------------------------------------------------------
  function hai() {
    $gameSystem._hai = $gameSystem._hai || {};
    return $gameSystem._hai;
  }

  function state() {
    const h = hai();
    h.thoughts = h.thoughts || {};
    h.thoughts.read = h.thoughts.read || {};
    h.thoughts.maps = h.thoughts.maps || {};
    return h.thoughts;
  }

  function noteList() {
    const h = hai();
    h.notes = h.notes || [];
    return h.notes;
  }

  function isRead(id) {
    return !!state().read[String(id)];
  }

  function markRead(id) {
    const key = String(id);
    if (state().read[key]) return false;
    state().read[key] = true;
    return true;
  }

  function findNote(id) {
    return noteList().find(n => n.id === String(id)) || null;
  }

  /** メモ帳に一行足す。足したらそのメモ、同じ ID がもうあれば null。 */
  function addNote(note) {
    const text = String(note.text ?? "");
    if (!text) return null;
    const id = String(note.id || "text:" + text);
    if (findNote(id)) return null;
    const onMap = $gameMap && $gameMap.mapId() > 0;
    const entry = {
      id,
      text,
      mapId: Number(note.mapId ?? (onMap ? $gameMap.mapId() : 0)),
      x: Number(note.x ?? (onMap ? $gamePlayer.x : 0)),
      y: Number(note.y ?? (onMap ? $gamePlayer.y : 0)),
      kind: KINDS.includes(note.kind) ? note.kind : "clue",
      time: $gameSystem.playtime(),
    };
    noteList().push(entry);
    return entry;
  }

  // ---------------------------------------------------------------------------
  // メモ欄
  // ---------------------------------------------------------------------------
  function metaOf(event) {
    const data = event && event.event();
    return (data && data.meta) || {};
  }

  /** 思念の ID。<hai_thought> の値が空なら「マップID,イベントID」。思念でなければ null。 */
  function thoughtIdOf(event, mapId) {
    const v = metaOf(event).hai_thought;
    if (v === undefined) return null;
    const s = v === true ? "" : String(v).trim();
    return s || `${mapId},${event.eventId()}`;
  }

  /** <hai_clue:…> をすべて（コアの meta は同じタグの最後しか持たないので、メモ欄を直接読む）。 */
  function cluesOf(event) {
    const note = (event.event() && event.event().note) || "";
    const out = [];
    for (const m of note.matchAll(/<hai_clue:([^>]*)>/g)) {
      const text = m[1].trim();
      if (text) out.push(text);
    }
    return out;
  }

  function clueId(thoughtId, i) {
    return `clue:${thoughtId}` + (i > 0 ? `#${i + 1}` : "");
  }

  function lockOf(event) {
    const meta = metaOf(event);
    if (meta.hai_locked === undefined) return null;
    const keyId = Number(meta.hai_key || 0);
    const item = keyId > 0 ? $dataItems[keyId] : null;
    let name = meta.hai_locked === true ? "" : String(meta.hai_locked).trim();
    if (!name) name = item ? item.name : "鍵";
    return { keyId, item, name };
  }

  function mapName(mapId) {
    if (mapId === $gameMap.mapId() && $gameMap.displayName()) return $gameMap.displayName();
    const info = $dataMapInfos[mapId];
    return info ? info.name : String(mapId);
  }

  // ---------------------------------------------------------------------------
  // マップの思念の一覧（U1 のオートマップ用。訪れたマップの分を覚える）
  // ---------------------------------------------------------------------------
  function scanCurrentMap() {
    const mapId = $gameMap.mapId();
    const list = [];
    for (const ev of $gameMap.events()) {
      const id = thoughtIdOf(ev, mapId);
      if (id !== null) list.push({ id, eventId: ev.eventId(), x: ev.event().x, y: ev.event().y });
    }
    if (list.length) state().maps[mapId] = list;
    else delete state().maps[mapId];
    return list;
  }

  const _Game_Map_setupEvents = Game_Map.prototype.setupEvents;
  Game_Map.prototype.setupEvents = function() {
    _Game_Map_setupEvents.apply(this, arguments);
    if (this.mapId() > 0) scanCurrentMap();
  };

  function thoughtsOf(mapId) {
    const list = mapId === $gameMap.mapId() ? scanCurrentMap() : state().maps[mapId] || [];
    return list.map(t => ({ id: t.id, x: t.x, y: t.y, read: isRead(t.id) }));
  }

  // ---------------------------------------------------------------------------
  // イベントの始まりと終わり
  // ---------------------------------------------------------------------------
  const cmd = (code, parameters, indent = 0) => ({ code, indent, parameters });
  const seCmd = name => cmd(250, [{ name, volume: 90, pitch: 100, pan: 0 }]);
  const textCmds = lines => [cmd(101, ["", 0, 0, 2, ""]), ...lines.map(l => cmd(401, [l]))];

  /** 思念の list を写して、既読の印と、メモに書いた行を足す。 */
  function thoughtList(list, reread, newNotes) {
    const out = list.slice();
    if (reread && readMark) {
      const i = out.findIndex(c => c.code === 401);
      if (i >= 0) out[i] = cmd(401, [readMark + out[i].parameters[0]], out[i].indent);
    }
    if (newNotes.length && clueMessage) {
      const end = out.pop(); // 最後の code 0
      if (noteSe) out.push(seCmd(noteSe));
      out.push(...textCmds(newNotes.map(t => clueMessage.replace("%1", t))));
      out.push(end);
    }
    return out;
  }

  function doorList(lock, opened, noteText) {
    const out = [];
    if (opened) {
      if (unlockSe) out.push(seCmd(unlockSe));
      if (unlockMessage) out.push(...textCmds([unlockMessage.replace("%1", lock.name)]));
      out.push(cmd(123, ["A", 0]));
    } else {
      const lines = [lockedMessage];
      if (noteText && clueMessage) lines.push(clueMessage.replace("%1", noteText));
      out.push(...textCmds(lines));
    }
    out.push(cmd(0, []));
    return out;
  }

  function isClosedDoor(event) {
    return !!lockOf(event) && !$gameSelfSwitches.value([$gameMap.mapId(), event.eventId(), "A"]);
  }

  // 施錠扉の 1 ページ目は中身なしでよい（コアは中身のないイベントを始めないので、閉じた扉だけ始める）
  const _Game_Event_start = Game_Event.prototype.start;
  Game_Event.prototype.start = function() {
    _Game_Event_start.apply(this, arguments);
    if (!this._starting && isClosedDoor(this)) {
      this._starting = true;
      if (this.isTriggerIn([0, 1, 2])) this.lock();
    }
  };

  // マップのイベントが始まるとき（depth 0、そのイベントの今のページの list）だけ手を入れる。
  // 読み終えたときの処理は this._haiThought に覚えて terminate で行う（中断しても読み終えた扱い）。
  const _Game_Interpreter_setup = Game_Interpreter.prototype.setup;
  Game_Interpreter.prototype.setup = function(list, eventId) {
    let haiInfo = null;
    const event = this._depth === 0 && eventId > 0 && $gameMap ? $gameMap.event(eventId) : null;
    if (event && list && list === event.list()) {
      const mapId = $gameMap.mapId();
      const thoughtId = thoughtIdOf(event, mapId);
      const lock = lockOf(event);
      if (thoughtId !== null) {
        const clues = cluesOf(event).map((text, i) => ({ id: clueId(thoughtId, i), text }));
        const fresh = clues.filter(c => !findNote(c.id));
        list = thoughtList(list, isRead(thoughtId), fresh.map(c => c.text));
        haiInfo = { type: "thought", id: thoughtId, clues: fresh, x: event.x, y: event.y };
      } else if (lock && isClosedDoor(event)) {
        const opened = !!lock.item && $gameParty.hasItem(lock.item);
        const noteId = `door:${mapId},${eventId}`;
        const noteText = opened || findNote(noteId) ? "" : doorNoteFormat
          .replace("%1", lock.name).replace("%2", mapName(mapId))
          .replace("%3", event.x).replace("%4", event.y);
        list = doorList(lock, opened, noteText);
        haiInfo = { type: "door", noteId, opened, noteText, x: event.x, y: event.y };
      }
    }
    _Game_Interpreter_setup.call(this, list, eventId);
    this._haiThought = haiInfo;
  };

  function finish(interpreter, info) {
    const mapId = interpreter._mapId;
    if (info.type === "thought") {
      markRead(info.id);
      $gameSelfSwitches.setValue([mapId, interpreter._eventId, "A"], true);
      for (const c of info.clues) addNote({ id: c.id, text: c.text, mapId, x: info.x, y: info.y, kind: "clue" });
    } else if (info.type === "door") {
      if (info.opened) {
        const note = findNote(info.noteId);
        if (note) note.done = true;
      } else if (info.noteText) {
        addNote({ id: info.noteId, text: info.noteText, mapId, x: info.x, y: info.y, kind: "door" });
      }
    }
  }

  const _Game_Interpreter_terminate = Game_Interpreter.prototype.terminate;
  Game_Interpreter.prototype.terminate = function() {
    const info = this._haiThought;
    this._haiThought = null;
    if (info && this.isOnCurrentMap()) finish(this, info);
    _Game_Interpreter_terminate.apply(this, arguments);
  };

  // ---------------------------------------------------------------------------
  // プラグインコマンド
  // ---------------------------------------------------------------------------
  PluginManager.registerCommand(pluginName, "addNote", function(args) {
    const ev = this.character(0);
    const added = addNote({
      id: args.id,
      text: args.text,
      kind: args.kind,
      x: ev ? ev.x : undefined,
      y: ev ? ev.y : undefined,
    });
    if (added && noteSe) AudioManager.playSe({ name: noteSe, volume: 90, pitch: 100, pan: 0 });
  });

  PluginManager.registerCommand(pluginName, "markRead", args => {
    if (args.id) markRead(args.id);
  });

  PluginManager.registerCommand(pluginName, "clearNotes", () => {
    hai().notes = [];
  });

  // ---------------------------------------------------------------------------
  // 窓口
  // ---------------------------------------------------------------------------
  window.Hai = window.Hai || {};
  Hai.Thoughts = {
    KINDS,
    /** その思念を読んだか。 */
    isRead,
    /** 既読にする（演出なし）。新しく既読にしたら true。 */
    markRead,
    /** メモの一覧（写し）。kind を渡すとその種類だけ。足した順。 */
    notes(kind) {
      return noteList()
        .filter(n => kind === undefined || n.kind === kind)
        .map(n => ({ ...n }));
    },
    /** メモを足す。{ text, id?, kind?, mapId?, x?, y? }。足したらそのメモの写し、同じ ID があれば null。 */
    addNote(note) {
      const added = addNote(note || {});
      return added ? { ...added } : null;
    },
    hasNote(id) {
      return !!findNote(id);
    },
    clearNotes() {
      hai().notes = [];
    },
    /** そのマップ（省略で今のマップ）の読んでいない思念の数。訪れていないマップは 0。 */
    unreadCount(mapId) {
      return thoughtsOf(mapId === undefined ? $gameMap.mapId() : Number(mapId)).filter(t => !t.read).length;
    },
    /** そのマップの思念の一覧 [{ id, x, y, read }]。訪れていないマップは []。 */
    thoughts(mapId) {
      return thoughtsOf(mapId === undefined ? $gameMap.mapId() : Number(mapId));
    },
  };
})();
