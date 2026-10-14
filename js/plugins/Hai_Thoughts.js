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
 *                            読み終えたら既読にし、セルフスイッチ A を ON にする（文章の窓がマップの上で一度閉じてから。
 *                            窓が出る前・閉じる前に割り込まれて終わったときや、戦闘に割り込まれて文が戦闘の
 *                            画面で閉じたときは既読にしない。調べたのと同じ時に戦闘が始まったら、思念は始めない）。
 *                            既読の思念は、もう一度調べると本文の頭に「（読んだ）」が付く。
 *   <hai_faint:F01>          会話できない薄い思念（墓守の記憶のありか）。<hai_thought> の代わりに書く。
 *                            調べると画面が暗くなり、文章だけが窓なしで出る。見終えると既読・セルフスイッチ A、
 *                            初めて見たときだけ「戻った記憶の数」を 1 増やす（変数にも写す）。
 *                            会話・選択肢は置かない（tools/data/check.mjs が見る）。
 *                            コモンイベント「数の一言」の呼び出しより後ろの文章（仲間の行）は、名前と窓を残す。
 *   <hai_clue:テキスト>      読み終えたとき、メモ帳にこの一行を足す（同じものは二度足さない）。
 *                            1 つのイベントに何個でも書ける。
 *   <hai_locked:坑道の鍵>    施錠扉。セルフスイッチ A が OFF の間、調べると
 *   <hai_key:121>            鍵（アイテム ID）を持っていれば開き（セルフスイッチ A を ON）、
 *                            なければ「鍵がかかっている。」と出して、メモ帳に扉を足す。
 *                            扉のイベントの 1 ページ目は中身なし（扉の絵だけ）にする。
 *
 * 状態（セーブに入る）：
 *   $gameSystem._hai.thoughts = { read: { ID: true }, faint: { ID: true }, maps: { マップID: [{ id, eventId, x, y, faint? }] } }
 *   $gameSystem._hai.notes    = [{ id, text, mapId, x, y, kind: "clue"|"door"|"item"|"memory", time, done? }]
 *
 * 窓口 window.Hai.Thoughts：
 *   isRead(id)  markRead(id)  notes(kind)  addNote(note)  hasNote(id)  removeNote(id)  clearNotes()
 *   unreadCount(mapId)  thoughts(mapId)  isFaint(id)  faintCount()
 *   legacies()  legacyTable()  faintLine(id)
 *
 * 言い残し（P14）：夜の戸で拾った言い残しは、パラメータ「言い残し」の表（スイッチ ID・話し手・一行）に持つ。
 *   W はそのスイッチを ON にするだけ。ON の行が書庫の「言い残し」と legacies() に出る（表の順）。
 * 薄い思念のあとの固有の一言（P14）：パラメータ「薄い思念のあとの一言」に書いた思念（F09 など）は、
 *   そのイベントの中のコモンイベント「数の一言」の呼び出しを、初めて見たときだけ固有の一言に差し替える。
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
 * @param faintVariable
 * @text 戻った記憶の数の変数
 * @desc 薄い思念を見て戻った記憶の数（0〜）を入れる変数。0 で使わない。
 * @type variable
 * @default 138
 *
 * @param faintTone
 * @text 薄い思念の画面の色調
 * @desc 赤,緑,青,グレー（カンマ区切り）。
 * @type string
 * @default -102,-102,-85,170
 *
 * @param faintFrames
 * @text 暗くする・戻すフレーム数
 * @type number
 * @min 0
 * @default 30
 *
 * @param legacies
 * @text 言い残し
 * @desc 夜の戸で拾う言い残し。スイッチが ON になったものを書庫の「言い残し」に出す（表の順）。
 * @type struct<Legacy>[]
 * @default ["{\"switchId\":\"314\",\"speaker\":\"木樵の女房\",\"text\":\"薪、三束。戸の脇に置いといたよ\"}","{\"switchId\":\"413\",\"speaker\":\"焼けた村の子\",\"text\":\"おねえちゃん、三つしか叩かなかったよ。おかあ\"}","{\"switchId\":\"1061\",\"speaker\":\"列に並んだ女\",\"text\":\"名を呼ばれて、この子が笑った。初めてだ\"}","{\"switchId\":\"620\",\"speaker\":\"名無し兵\",\"text\":\"顔は覚えている。たぶん\"}"]
 *
 * @param faintLines
 * @text 薄い思念のあとの一言
 * @desc 思念 ID:一言 を ; で区切る。その思念のあとのコモンイベント「数の一言」を、この一言（名前は主人公）に差し替える。
 * @type string
 * @default F09:……一つ多い
 *
 * @param faintLineEvent
 * @text 数の一言のコモンイベント
 * @desc 薄い思念のあとに呼ぶ、記憶の数で変わる一言のコモンイベント。
 * @type common_event
 * @default 201
 *
 * @param faintLineSpeaker
 * @text 固有の一言の話し手
 * @desc 名前の欄に出す文字（制御文字が使える）。
 * @type string
 * @default \N[1]
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
 * @command faintBegin
 * @text 薄い思念の始め（内部）
 * @desc 画面を暗くする。<hai_faint> のイベントに自動で入る。
 *
 * @command faintEnd
 * @text 薄い思念の終わり（内部）
 * @desc 画面の色調を元に戻す。<hai_faint> のイベントに自動で入る。
 *
 * @command clearNotes
 * @text メモを全部消す（テスト用）
 */
/*~struct~Legacy:
 * @param switchId
 * @text スイッチ
 * @desc このスイッチが ON なら拾った扱い（W が夜の戸で ON にする）。
 * @type switch
 * @default 0
 *
 * @param speaker
 * @text 話し手
 * @type string
 * @default
 *
 * @param text
 * @text 一行
 * @type string
 * @default
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
  const faintVariable = Number(params.faintVariable ?? 138);
  const faintTone = String(params.faintTone || "-102,-102,-85,170").split(",").map(Number);
  const faintFrames = Number(params.faintFrames ?? 30);
  const parseJson = (text, fallback) => {
    try {
      return JSON.parse(text);
    } catch (e) {
      return fallback;
    }
  };
  const LEGACY_DEFAULT = [
    { switchId: 314, speaker: "木樵の女房", text: "薪、三束。戸の脇に置いといたよ" },
    { switchId: 413, speaker: "焼けた村の子", text: "おねえちゃん、三つしか叩かなかったよ。おかあ" },
    { switchId: 1061, speaker: "列に並んだ女", text: "名を呼ばれて、この子が笑った。初めてだ" },
    { switchId: 620, speaker: "名無し兵", text: "顔は覚えている。たぶん" },
  ];
  const legacyRows = (params.legacies === undefined ? LEGACY_DEFAULT : parseJson(params.legacies, []))
    .map(row => (typeof row === "string" ? parseJson(row, {}) : row || {}))
    .map(row => ({ switchId: Number(row.switchId || 0), speaker: String(row.speaker || ""), text: String(row.text || "") }))
    .filter(row => row.switchId > 0 && row.text);
  const faintLines = {};
  for (const pair of String(params.faintLines ?? "F09:……一つ多い").split(";")) {
    const i = pair.indexOf(":");
    if (i > 0 && pair.slice(i + 1).trim()) faintLines[pair.slice(0, i).trim()] = pair.slice(i + 1).trim();
  }
  const faintLineEvent = Number(params.faintLineEvent ?? 201);
  const faintLineSpeaker = params.faintLineSpeaker ?? "\\N[1]";

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
    h.thoughts.faint = h.thoughts.faint || {};
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

  const faintCount = () => Object.keys(state().faint).filter(k => state().faint[k]).length;

  /** 薄い思念を見た印。初めてなら数えて true。 */
  function markFaint(id) {
    const key = String(id);
    if (state().faint[key]) return false;
    state().faint[key] = true;
    if (faintVariable > 0) $gameVariables.setValue(faintVariable, faintCount());
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

  const isFaintEvent = event => metaOf(event).hai_faint !== undefined;

  /** 思念の ID。<hai_thought>（薄い思念は <hai_faint>）の値が空なら「マップID,イベントID」。思念でなければ null。 */
  function thoughtIdOf(event, mapId) {
    const meta = metaOf(event);
    const v = meta.hai_faint !== undefined ? meta.hai_faint : meta.hai_thought;
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
      if (id !== null) list.push({ id, eventId: ev.eventId(), x: ev.event().x, y: ev.event().y, ...(isFaintEvent(ev) ? { faint: true } : {}) });
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
    return list.map(t => ({ id: t.id, x: t.x, y: t.y, read: isRead(t.id), ...(t.faint ? { faint: true } : {}) }));
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

  /**
   * 薄い思念のあとの固有の一言：コモンイベント「数の一言」の呼び出しを、初めて見たときだけの一言に差し替える
   * （コモンイベントの頭の「セルフスイッチ A が OFF」と同じ条件）。
   */
  function lineFor(c, line) {
    if (c.code !== 117 || c.parameters[0] !== faintLineEvent) return [c];
    const i = c.indent;
    return [
      cmd(111, [2, "A", 1], i),
      cmd(101, ["", 0, 0, 2, faintLineSpeaker], i + 1),
      cmd(401, [line], i + 1),
      cmd(0, [], i + 1),
      cmd(412, [], i),
    ];
  }

  /**
   * 薄い思念：暗くする → 文章（窓なし・顔なし・名前なし・真ん中）→ 戻す。
   * コモンイベント「数の一言」の呼び出しより後ろの文章（仲間の行）は、名前と窓をそのまま残す。
   */
  function faintList(list, id) {
    const line = faintLines[id];
    let after = false;
    const plain = list.map(c => {
      if (c.code === 117 && c.parameters[0] === faintLineEvent) after = true;
      return c.code === 101 && !after ? cmd(101, ["", 0, 2, 1, ""], c.indent) : c;
    });
    // 固有の一言はコモンイベントと同じ窓（下・名前あり）で出すので、窓なしにしたあとで差し替える
    const out = line && faintLineEvent > 0 ? plain.flatMap(c => lineFor(c, line)) : plain;
    const end = out.pop();
    return [
      cmd(357, [pluginName, "faintBegin", "薄い思念の始め（内部）", {}]),
      cmd(230, [faintFrames]),
      ...out,
      cmd(357, [pluginName, "faintEnd", "薄い思念の終わり（内部）", {}]),
      cmd(230, [faintFrames]),
      end,
    ];
  }

  function faintBegin(interpreter) {
    if (!interpreter._haiFaintTone) interpreter._haiFaintTone = ($gameScreen._toneTarget || [0, 0, 0, 0]).slice();
    $gameScreen.startTint(faintTone, faintFrames);
  }

  function faintEnd(interpreter, frames = faintFrames) {
    const tone = interpreter._haiFaintTone;
    interpreter._haiFaintTone = null;
    if (tone) $gameScreen.startTint(tone, frames);
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
  // 読み終えたときの処理は this._haiThought に覚えて terminate で行う。思念は、文章の窓が一度でも
  // 閉じたあとなら中断しても読み終えた扱いにし、窓を閉じる前に終わったら既読にしない。
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
        const faint = isFaintEvent(event);
        if (faint) list = faintList(list, thoughtId);
        haiInfo = { type: "thought", id: thoughtId, faint, clues: fresh, x: event.x, y: event.y, seen: false };
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

  // 文章（と選択肢）の窓が閉じるのを待ち終えたら、思念を「見た」にする。
  // 窓がマップの上で閉じたときだけ（戦闘に割り込まれ、文が戦闘の画面の窓で送られたときは見ていない。R3 困る 3）
  const _Window_Message_terminateMessage = Window_Message.prototype.terminateMessage;
  Window_Message.prototype.terminateMessage = function() {
    const onMap = SceneManager._scene instanceof Scene_Map;
    _Window_Message_terminateMessage.apply(this, arguments);
    $gameMessage._haiClosedOnMap = onMap;
  };

  const _Game_Interpreter_updateWaitMode = Game_Interpreter.prototype.updateWaitMode;
  Game_Interpreter.prototype.updateWaitMode = function() {
    const info = this._haiThought;
    const message = this._waitMode === "message";
    const waiting = _Game_Interpreter_updateWaitMode.apply(this, arguments);
    if (message && !waiting && info && info.type === "thought" && $gameMessage._haiClosedOnMap !== false) info.seen = true;
    return waiting;
  };

  // 戦闘が始まるとき、始まる順を待っている思念（敵がぶつかったのと同じ時に調べた）は始めない。
  // 戦闘のあとに思念が勝手に流れ、決定の押しっぱなしで送られて既読になるのを防ぐ（R3 困る 3）。調べ直せば読める
  const _BattleManager_setup = BattleManager.setup;
  BattleManager.setup = function() {
    _BattleManager_setup.apply(this, arguments);
    if (!$gameMap || !(SceneManager._scene instanceof Scene_Map)) return;
    const mapId = $gameMap.mapId();
    for (const event of $gameMap.events()) {
      if (event.isStarting() && thoughtIdOf(event, mapId) !== null) {
        event.clearStartingFlag();
        event.unlock();
      }
    }
  };

  function finish(interpreter, info) {
    const mapId = interpreter._mapId;
    if (info.type === "thought") {
      if (info.seen === false) return; // 文章の窓が閉じる前に終わった（割り込まれた）ので読んでいない。古いセーブの欄なしは読んだ扱い
      markRead(info.id);
      if (info.faint) markFaint(info.id);
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
    if (this._haiFaintTone) faintEnd(this, 0); // 「イベント処理の中断」で終わっても暗いまま残さない
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

  PluginManager.registerCommand(pluginName, "faintBegin", function() {
    faintBegin(this);
  });

  PluginManager.registerCommand(pluginName, "faintEnd", function() {
    faintEnd(this);
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
    /** その ID のメモを消す。消したら true（U1 の入手ログが古いものを消す用）。 */
    removeNote(id) {
      const list = noteList();
      const i = list.findIndex(n => n.id === String(id));
      if (i < 0) return false;
      list.splice(i, 1);
      return true;
    },
    clearNotes() {
      hai().notes = [];
    },
    /** そのマップ（省略で今のマップ）の読んでいない思念の数。訪れていないマップは 0。 */
    unreadCount(mapId) {
      return thoughtsOf(mapId === undefined ? $gameMap.mapId() : Number(mapId)).filter(t => !t.read).length;
    },
    /** 薄い思念を見たか（見て記憶が戻ったか）。 */
    isFaint(id) {
      return !!state().faint[String(id)];
    },
    /** 薄い思念を見て戻った記憶の数。 */
    faintCount,
    /** 薄い思念を見た扱いにする（演出なし。テスト用）。新しく数えたら true。既読にもする。 */
    markFaint(id) {
      markRead(id);
      return markFaint(id);
    },
    /** 拾った言い残し（スイッチが ON のもの）[{ switchId, speaker, text }]。パラメータの表の順。 */
    legacies: () => legacyRows.filter(r => $gameSwitches.value(r.switchId)).map(r => ({ ...r })),
    /** 言い残しの表のすべて（拾ったかは heard）。 */
    legacyTable: () => legacyRows.map(r => ({ ...r, heard: $gameSwitches.value(r.switchId) })),
    /** 薄い思念のあとの固有の一言（無ければ ""）。 */
    faintLine: id => faintLines[String(id)] || "",
    /** そのマップの思念の一覧 [{ id, x, y, read, faint? }]。訪れていないマップは []。 */
    thoughts(mapId) {
      return thoughtsOf(mapId === undefined ? $gameMap.mapId() : Number(mapId));
    },
  };
})();
