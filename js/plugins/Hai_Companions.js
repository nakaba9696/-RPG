/*:
 * @target MZ
 * @plugindesc 仲間：遺骸か形見を見つけ、砦の名の壁で呼ぶ。控えの編成、記憶 4 断片と完全体。
 * @author 灰の王国
 * @help
 * 仲間は旅の途中で出会う見知らぬ死者の、意志の強い残留思念（7 人。アクター 5〜11）。
 * マップの遺骸か形見を調べると見つけた扱いになり、砦の名の壁の輪で呼ぶとパーティに加わる。
 * 記憶の断片を 4 つ読むと「完全体」になり、固有の強技を覚える。
 * 本文（遺骸・形見・記憶の文章）はイベントの「文章の表示」に書く（プラグインは本文を持たない）。
 *
 * イベントのメモ欄：
 *   <hai_remains:5>     アクター 5 の遺骸か形見。調べ終えると「名の壁の輪に置けば、この人を呼べる。」
 *                       → 見つけた扱い、セルフスイッチ A を ON。
 *   <hai_memory:5,2>    アクター 5 の記憶の断片 2（1 生い立ち・2 転機・3 罪か誇り・4 臨終）。
 *                       読み終えると覚え、セルフスイッチ A を ON、メモ帳に「〜の記憶 2/4」。
 *                       4 つ揃うと完全体になり、強技を覚える。
 * アクターのメモ欄：
 *   <hai_wake:……>     呼んで目覚めたときの一言（初対面の言い方。無ければ出さない）。
 *   <hai_down:……>     戦闘で倒れたときの一言（P14）。戦闘ログの「〜は倒れた」のあとに「名前「一言」」で出す。
 * スキルのメモ欄：
 *   <hai_complete:5>    アクター 5 が完全体で覚える強技（完全体のほかでは覚えない）。
 *   <hai_user_state:193> 戦闘でこのスキルを使った者に、ステート 193 を付ける（檻破り）。
 * ステートのメモ欄：
 *   <hai_vow>           このステートの者が、味方全員への物理攻撃の身代わりになる（行軍）。
 *
 * 状態（セーブに入る）：
 *   $gameSystem._hai.companions = { found: { 5: true }, summoned: { 5: true }, memories: { 5: { 1: true } } }
 *
 * 窓口 window.Hai.Companions：
 *   found()  summoned()  memories(actorId)  isComplete(actorId)  summon(actorId)  maxBattleMembers
 * 詳しくは docs/plugins/Hai_Companions.md。
 *
 * @param companionActors
 * @text 仲間のアクター
 * @desc 召喚できる仲間のアクター ID（カンマ区切り。並びが召喚の一覧の順）。
 * @type string
 * @default 5,6,7,8,9,10,11
 *
 * @param leaderActorId
 * @text 外せない主人公
 * @desc 編成で戦闘メンバーから外せないアクター。0 なら誰でも外せる。
 * @type actor
 * @default 1
 *
 * @param maxBattleMembers
 * @text 戦闘に出る人数
 * @type number
 * @min 1
 * @max 8
 * @default 4
 *
 * @param remainsMessage
 * @text 遺骸か形見を見つけたときの文章
 * @desc %1 が仲間の名前（使わなくてよい）。空にすると出さない。
 * @type string
 * @default 名の壁の輪に置けば、この人を呼べる。
 *
 * @param remainsSe
 * @text 遺骸を送ったときの効果音
 * @type file
 * @dir audio/se/
 * @default Teleport
 *
 * @param fragmentNames
 * @text 記憶の断片の名前
 * @desc 1〜4 の名前（カンマ区切り）。
 * @type string
 * @default 生い立ち,転機,罪か誇り,臨終
 *
 * @param memoryNote
 * @text 記憶のメモの一行
 * @desc %1 仲間の名前、%2 断片の番号、%3 断片の名前。
 * @type string
 * @default %1の記憶 %2/4「%3」
 *
 * @param memoryMessage
 * @text 記憶を読んだときの一行
 * @desc 本文の後に出す。%1 がメモの一行。空にすると出さない。
 * @type string
 * @default \C[6]メモ：\C[0]%1
 *
 * @param noteSe
 * @text 記憶を書き留めたときの効果音
 * @type file
 * @dir audio/se/
 * @default Book1
 *
 * @param completeMessage
 * @text 完全体になったときの文章
 * @desc %1 仲間の名前、%2 強技の名前。改行は \n。まだ呼んでいない（パーティにいない）仲間は、呼んで目を開けたときに出す。
 * @type string
 * @default \C[6]%1の記憶が、四つとも戻った。\C[0]\n%1は「%2」を思い出した。
 *
 * @param completeSe
 * @text 完全体になったときの効果音
 * @type file
 * @dir audio/se/
 * @default Saint5
 *
 * @param summonPrompt
 * @text 名の壁の問いかけ
 * @type string
 * @default 名の壁の足元の輪が、淡く光っている。誰を呼ぶ？
 *
 * @param summonNone
 * @text 呼べる人がいないとき
 * @type string
 * @default 輪は暗いままだ。呼べる人の遺骸も形見も、まだ置いていない。
 *
 * @param summonCancel
 * @text 選ばないときの選択肢
 * @type string
 * @default やめる
 *
 * @param summonSe
 * @text 呼んだときの効果音
 * @type file
 * @dir audio/se/
 * @default Magic3
 *
 * @param awakeMessage
 * @text 目覚めの文章
 * @desc %1 が仲間の名前。
 * @type string
 * @default %1が目を開けた。
 *
 * @param partyHelp
 * @text 編成の画面の説明
 * @type string
 * @default 入れ替える 2 人を順に選ぶ。上から %1 人が戦闘に出る（薄い字は控え）。
 *
 * @param partyRefuse
 * @text 主人公を外そうとしたとき
 * @desc %1 が主人公の名前。
 * @type string
 * @default %1は控えに回せない。
 *
 * @param foundSwitchStart
 * @text 遺骸のスイッチ（先頭）
 * @desc 仲間の 1 人目の遺骸か形見を見つけたら ON にするスイッチ。2 人目からは 1 つずつ後ろ（7 人で 131〜137）。0 で使わない。
 * @type switch
 * @default 131
 *
 * @param summonSwitchStart
 * @text 加入のスイッチ（先頭）
 * @desc 7 人で 138〜144。0 で使わない。
 * @type switch
 * @default 138
 *
 * @param completeSwitchStart
 * @text 完全体のスイッチ（先頭）
 * @desc 0 で使わない（既定）。完全体は「記憶の数の変数」が 4 以上かで見る（帯 131–150 に 7 人 × 3 が入らないため）。
 * @type switch
 * @default 0
 *
 * @param memoryVariableStart
 * @text 記憶の数の変数（先頭）
 * @desc 仲間ごとの読んだ記憶の数（0〜4）を入れる変数（7 人で 131〜137）。0 で使わない。
 * @type variable
 * @default 131
 *
 * @param countVariable
 * @text 仲間の数の変数
 * @desc 召喚した仲間の数を入れる変数。0 で使わない。
 * @type variable
 * @default 102
 *
 * @param downFormat
 * @text 倒れたときの一言の形
 * @desc <hai_down> の一言を戦闘ログに出す形。%1 が名前、%2 が一言。
 * @type string
 * @default %1「%2」
 *
 * @command summonMenu
 * @text 名の壁で呼ぶ
 * @desc 見つけた遺骸・形見のうち、まだ呼んでいない仲間を選んで呼ぶ。
 *
 * @command partyMenu
 * @text 編成
 * @desc 召喚した仲間を並べ替え・入れ替える画面を開く。
 *
 * @command summon
 * @text 仲間を呼ぶ（演出なし）
 *
 * @arg actorId
 * @text アクター
 * @type actor
 * @default 5
 */
(() => {
  "use strict";
  const pluginName = "Hai_Companions";
  const params = PluginManager.parameters(pluginName);
  const numList = s => String(s || "").split(",").map(Number).filter(n => n > 0);
  const companionActors = numList(params.companionActors ?? "5,6,7,8,9,10,11");
  const leaderActorId = Number(params.leaderActorId ?? 1);
  const maxBattle = Number(params.maxBattleMembers || 4);
  const remainsMessage = params.remainsMessage ?? "名の壁の輪に置けば、この人を呼べる。";
  const remainsSe = params.remainsSe ?? "Teleport";
  const fragmentNames = (params.fragmentNames || "生い立ち,転機,罪か誇り,臨終").split(",");
  const memoryNote = params.memoryNote || "%1の記憶 %2/4「%3」";
  const memoryMessage = params.memoryMessage ?? "\\C[6]メモ：\\C[0]%1";
  const noteSe = params.noteSe ?? "Book1";
  const completeMessage = params.completeMessage ?? "\\C[6]%1の記憶が、四つとも戻った。\\C[0]\\n%1は「%2」を思い出した。";
  const completeSe = params.completeSe ?? "Saint5";
  const summonPrompt = params.summonPrompt ?? "名の壁の足元の輪が、淡く光っている。誰を呼ぶ？";
  const summonNone = params.summonNone ?? "輪は暗いままだ。呼べる人の遺骸も形見も、まだ置いていない。";
  const summonCancel = params.summonCancel || "やめる";
  const summonSe = params.summonSe ?? "Magic3";
  const awakeMessage = params.awakeMessage ?? "%1が目を開けた。";
  const partyHelp = params.partyHelp ?? "入れ替える 2 人を順に選ぶ。上から %1 人が戦闘に出る（薄い字は控え）。";
  const partyRefuse = params.partyRefuse ?? "%1は控えに回せない。";
  const foundSwitchStart = Number(params.foundSwitchStart ?? 131);
  const summonSwitchStart = Number(params.summonSwitchStart ?? 138);
  const completeSwitchStart = Number(params.completeSwitchStart ?? 0);
  const memoryVariableStart = Number(params.memoryVariableStart ?? 131);
  const countVariable = Number(params.countVariable ?? 102);
  const downFormat = params.downFormat || "%1「%2」";
  const FRAGMENTS = 4;

  // ---------------------------------------------------------------------------
  // 状態（$gameSystem._hai.companions）
  // ---------------------------------------------------------------------------
  function state() {
    $gameSystem._hai = $gameSystem._hai || {};
    const s = ($gameSystem._hai.companions = $gameSystem._hai.companions || {});
    s.found = s.found || {};
    s.summoned = s.summoned || {};
    s.memories = s.memories || {};
    s.told = s.told || {}; // 完全体の知らせを出した仲間
    return s;
  }

  const actorName = id => ($gameActors.actor(id) ? $gameActors.actor(id).name() : String(id));
  const idsOf = table => Object.keys(table).filter(k => table[k]).map(Number).sort((a, b) => a - b);

  function memoryCount(actorId) {
    const m = state().memories[actorId] || {};
    let n = 0;
    for (let i = 1; i <= FRAGMENTS; i++) if (m[i]) n++;
    return n;
  }

  const isComplete = actorId => memoryCount(actorId) >= FRAGMENTS;

  /** 完全体で覚える強技（スキルのメモ欄 <hai_complete:actorId>）。 */
  function completeSkill(actorId) {
    return $dataSkills.find(s => s && s.meta && Number(s.meta.hai_complete) === Number(actorId)) || null;
  }

  // 筋の旗（スイッチ 131–144、変数 102・131–137。docs/plugins/Hai_Companions.md）に写す
  function setFlag(start, actorId, value) {
    const i = companionActors.indexOf(Number(actorId));
    if (start > 0 && i >= 0) $gameSwitches.setValue(start + i, value);
  }

  function syncVariables(actorId) {
    const i = companionActors.indexOf(Number(actorId));
    if (memoryVariableStart > 0 && i >= 0) $gameVariables.setValue(memoryVariableStart + i, memoryCount(actorId));
    if (countVariable > 0) $gameVariables.setValue(countVariable, idsOf(state().summoned).length);
  }

  function markFound(actorId) {
    state().found[actorId] = true;
    setFlag(foundSwitchStart, actorId, true);
  }

  function summon(actorId) {
    actorId = Number(actorId);
    if (!$dataActors[actorId]) return false;
    markFound(actorId);
    state().summoned[actorId] = true;
    if (isComplete(actorId)) state().told[actorId] = true; // 目覚めの文のあとに知らせを出す（awakeCmds）
    setFlag(summonSwitchStart, actorId, true);
    syncVariables(actorId);
    $gameParty.addActor(actorId);
    return true;
  }

  /** 名の壁に出す仲間：見つけた遺骸・形見のうち、まだ呼んでおらず、パーティにもいない者。 */
  function summonable() {
    const s = state();
    const order = companionActors.concat(idsOf(s.found).filter(id => !companionActors.includes(id)));
    return order.filter(id => s.found[id] && !s.summoned[id] && $dataActors[id] && !$gameParty._actors.includes(id));
  }

  let learningComplete = false;

  /** 記憶の断片を覚える。新しく覚えたら true。4 つ目なら完全体にして強技を覚える。 */
  function learnMemory(actorId, n) {
    const s = state();
    const m = (s.memories[actorId] = s.memories[actorId] || {});
    if (m[n]) return false;
    m[n] = true;
    syncVariables(actorId);
    if (isComplete(actorId)) {
      setFlag(completeSwitchStart, actorId, true);
      const skill = completeSkill(actorId);
      if (skill && $gameActors.actor(actorId)) {
        learningComplete = true;
        try {
          $gameActors.actor(actorId).learnSkill(skill.id);
        } finally {
          learningComplete = false;
        }
      }
    }
    return true;
  }

  // 強技は完全体のときだけ覚える（職業の習得表やレベルアップでは覚えない）
  const _Game_Actor_learnSkill = Game_Actor.prototype.learnSkill;
  Game_Actor.prototype.learnSkill = function(skillId) {
    const skill = $dataSkills[skillId];
    const owner = skill && skill.meta && skill.meta.hai_complete;
    if (owner !== undefined && !learningComplete && !(Number(owner) === this.actorId() && isComplete(this.actorId()))) return;
    _Game_Actor_learnSkill.apply(this, arguments);
  };

  // ---------------------------------------------------------------------------
  // 控え（戦闘に出るのは先頭 maxBattle 人。主人公は外せない）
  // ---------------------------------------------------------------------------
  const _Game_Party_maxBattleMembers = Game_Party.prototype.maxBattleMembers;
  Game_Party.prototype.maxBattleMembers = function() {
    return maxBattle > 0 ? maxBattle : _Game_Party_maxBattleMembers.apply(this, arguments);
  };

  function canSwap(index1, index2) {
    if (leaderActorId <= 0) return true;
    const order = $gameParty._actors.slice();
    [order[index1], order[index2]] = [order[index2], order[index1]];
    const i = order.indexOf(leaderActorId);
    return i < 0 || i < $gameParty.maxBattleMembers() || !$gameParty._actors.includes(leaderActorId);
  }

  const _Game_Party_swapOrder = Game_Party.prototype.swapOrder;
  Game_Party.prototype.swapOrder = function(index1, index2) {
    if (!canSwap(index1, index2)) return;
    _Game_Party_swapOrder.apply(this, arguments);
  };

  // ---------------------------------------------------------------------------
  // <hai_user_state:N> のスキルを戦闘で使うと、使った者にステート N（檻破り：自分が狙われる）
  // ---------------------------------------------------------------------------
  const _Game_Battler_useItem = Game_Battler.prototype.useItem;
  Game_Battler.prototype.useItem = function(item) {
    _Game_Battler_useItem.apply(this, arguments);
    const id = DataManager.isSkill(item) && item.meta ? Number(item.meta.hai_user_state || 0) : 0;
    if (id > 0 && $dataStates[id] && $gameParty.inBattle()) this.addState(id);
  };

  // ---------------------------------------------------------------------------
  // 行軍：<hai_vow> のステートの者が、味方への物理攻撃の身代わりになる
  // ---------------------------------------------------------------------------
  const hasVow = battler => battler.isAlive() && battler.states().some(st => st.meta && st.meta.hai_vow);

  const _BattleManager_checkSubstitute = BattleManager.checkSubstitute;
  BattleManager.checkSubstitute = function(target) {
    if (_BattleManager_checkSubstitute.apply(this, arguments)) return true;
    return this._action.isPhysical() && target.friendsUnit().members().some(m => m !== target && hasVow(m));
  };

  const _Game_Unit_substituteBattler = Game_Unit.prototype.substituteBattler;
  Game_Unit.prototype.substituteBattler = function() {
    return this.members().find(hasVow) || _Game_Unit_substituteBattler.apply(this, arguments);
  };

  // ---------------------------------------------------------------------------
  // 遺骸と記憶の断片（イベントを調べたとき）
  // ---------------------------------------------------------------------------
  const cmd = (code, parameters, indent = 0) => ({ code, indent, parameters });
  const seCmd = name => cmd(250, [{ name, volume: 90, pitch: 100, pan: 0 }]);
  const textCmds = (lines, face = ["", 0], speaker = "") => [
    cmd(101, [face[0], face[1], 0, 2, speaker]),
    ...lines.map(l => cmd(401, [l])),
  ];
  const splitLines = text => String(text).split(/\\n|\n/);

  function metaOf(event) {
    const data = event && event.event();
    return (data && data.meta) || {};
  }

  function remainsOf(event) {
    const id = Number(metaOf(event).hai_remains || 0);
    return id > 0 ? id : null;
  }

  function memoryOf(event) {
    const v = metaOf(event).hai_memory;
    if (v === undefined || v === true) return null;
    const [actorId, n] = String(v).split(",").map(Number);
    return actorId > 0 && n >= 1 && n <= FRAGMENTS ? { actorId, n } : null;
  }

  function memoryNoteText(actorId, n) {
    return memoryNote.replace(/%1/g, actorName(actorId)).replace("%2", n).replace("%3", fragmentNames[n - 1] || "");
  }

  /** 完全体の知らせ（効果音と文章）。 */
  function completeCmds(actorId) {
    if (!completeMessage) return [];
    const skill = completeSkill(actorId);
    const text = completeMessage.replace(/%1/g, actorName(actorId)).replace(/%2/g, skill ? skill.name : "");
    return [...(completeSe ? [seCmd(completeSe)] : []), ...textCmds(splitLines(text))];
  }

  /** 本文の後ろ（最後の code 0 の前）に足す命令。読み終えたときの処理は info に入れる。 */
  function extraFor(event) {
    const s = state();
    const extra = [];
    const info = { remains: null, memory: null, x: event.x, y: event.y };
    const remains = remainsOf(event);
    if (remains && !s.found[remains]) {
      info.remains = remains;
      if (remainsSe) extra.push(seCmd(remainsSe));
      if (remainsMessage) extra.push(...textCmds([remainsMessage.replace(/%1/g, actorName(remains))]));
    }
    const memory = memoryOf(event);
    if (memory && !(s.memories[memory.actorId] || {})[memory.n]) {
      info.memory = memory;
      const note = memoryNoteText(memory.actorId, memory.n);
      if (memoryMessage) {
        if (noteSe) extra.push(seCmd(noteSe));
        extra.push(...textCmds([memoryMessage.replace("%1", note)]));
      }
      // 完全体の知らせは、連れている仲間のときだけ。まだ呼んでいない仲間は、呼んだときに出す（R3 気になる 5）
      const completes = memoryCount(memory.actorId) === FRAGMENTS - 1;
      if (completes && $gameParty._actors.includes(memory.actorId)) {
        info.told = true;
        extra.push(...completeCmds(memory.actorId));
      }
    }
    return info.remains || info.memory ? { info, extra } : null;
  }

  // マップのイベント（depth 0、そのイベントの今のページの list）が始まるとき。
  // ほかのプラグイン（Hai_Thoughts）が list を作り直したあとの list の最後に足す。
  const _Game_Interpreter_setup = Game_Interpreter.prototype.setup;
  Game_Interpreter.prototype.setup = function(list, eventId) {
    const event = this._depth === 0 && eventId > 0 && $gameMap ? $gameMap.event(eventId) : null;
    const found = event && list && list === event.list() ? extraFor(event) : null;
    _Game_Interpreter_setup.apply(this, arguments);
    this._haiCompanion = null;
    if (found && this._list) {
      const out = this._list.slice();
      const end = out.pop();
      out.push(...found.extra, end);
      this._list = out;
      this._haiCompanion = found.info;
    }
  };

  function finish(interpreter, info) {
    const key = [interpreter._mapId, interpreter._eventId, "A"];
    if (info.remains) markFound(info.remains);
    if (info.memory) {
      const { actorId, n } = info.memory;
      if (info.told) state().told[actorId] = true;
      if (learnMemory(actorId, n) && window.Hai.Thoughts) {
        Hai.Thoughts.addNote({
          id: `memory:${actorId},${n}`,
          text: memoryNoteText(actorId, n),
          kind: "memory",
          mapId: interpreter._mapId,
          x: info.x,
          y: info.y,
        });
      }
    }
    $gameSelfSwitches.setValue(key, true);
  }

  const _Game_Interpreter_terminate = Game_Interpreter.prototype.terminate;
  Game_Interpreter.prototype.terminate = function() {
    const info = this._haiCompanion;
    this._haiCompanion = null;
    if (info && this.isOnCurrentMap()) finish(this, info);
    _Game_Interpreter_terminate.apply(this, arguments);
  };

  // ---------------------------------------------------------------------------
  // 名の壁（選択肢 → 暗転 → 目覚め）
  // ---------------------------------------------------------------------------
  function choiceLabel(actorId) {
    const actor = $gameActors.actor(actorId);
    return actor.nickname() ? `${actor.name()}（${actor.nickname()}）` : actor.name();
  }

  function awakeCmds(actorId, indent) {
    const actor = $gameActors.actor(actorId);
    const out = [];
    if (summonSe) out.push(seCmd(summonSe));
    out.push(cmd(221, []));
    out.push(cmd(357, [pluginName, "summon", "仲間を呼ぶ（演出なし）", { actorId: String(actorId) }]));
    out.push(cmd(230, [30]));
    out.push(cmd(222, []));
    out.push(...textCmds([awakeMessage.replace(/%1/g, actor.name())]));
    const wake = $dataActors[actorId].meta.hai_wake;
    if (wake && wake !== true) {
      out.push(...textCmds(splitLines(wake), [actor.faceName(), actor.faceIndex()], actor.name()));
    }
    // 呼ぶ前に記憶が四つとも戻っていたら、ここで知らせる
    if (isComplete(actorId) && !state().told[actorId]) out.push(...completeCmds(actorId));
    return out.map(c => ({ ...c, indent: c.indent + indent }));
  }

  function summonList() {
    const ids = summonable();
    if (!ids.length) return [...textCmds([summonNone]), cmd(0, [])];
    const labels = ids.map(choiceLabel).concat([summonCancel]);
    const out = [...textCmds([summonPrompt]), cmd(102, [labels, ids.length, 0, 2, 0])];
    ids.forEach((id, i) => {
      out.push(cmd(402, [i, labels[i]]));
      out.push(...awakeCmds(id, 1));
      out.push(cmd(0, [], 1));
    });
    out.push(cmd(402, [ids.length, summonCancel]), cmd(0, [], 1), cmd(404, []), cmd(0, []));
    return out;
  }

  // ---------------------------------------------------------------------------
  // 編成の画面（Window_MenuStatus で 2 人を選んで入れ替える）
  // ---------------------------------------------------------------------------
  class Scene_HaiParty extends Scene_MenuBase {
    create() {
      super.create();
      this.createHelpWindow();
      this.createStatusWindow();
      this.setHelp();
    }

    statusWindowRect() {
      const wy = this.mainAreaTop();
      return new Rectangle(0, wy, Graphics.boxWidth, this.mainAreaHeight());
    }

    createStatusWindow() {
      this._statusWindow = new Window_MenuStatus(this.statusWindowRect());
      this._statusWindow.setFormationMode(true);
      this._statusWindow.setHandler("ok", this.onOk.bind(this));
      this._statusWindow.setHandler("cancel", this.onCancel.bind(this));
      this._statusWindow.select(0);
      this._statusWindow.activate();
      this.addWindow(this._statusWindow);
    }

    setHelp(text) {
      this._helpWindow.setText(text || partyHelp.replace("%1", $gameParty.maxBattleMembers()));
    }

    onOk() {
      const w = this._statusWindow;
      const index = w.index();
      const pending = w.pendingIndex();
      if (pending < 0) {
        w.setPendingIndex(index);
        this.setHelp();
      } else if (pending === index) {
        w.setPendingIndex(-1);
      } else if (canSwap(index, pending)) {
        $gameParty.swapOrder(index, pending);
        w.setPendingIndex(-1);
        w.refresh();
        this.setHelp();
      } else {
        SoundManager.playBuzzer();
        w.setPendingIndex(-1);
        this.setHelp(partyRefuse.replace(/%1/g, actorName(leaderActorId)));
      }
      w.activate();
    }

    onCancel() {
      const w = this._statusWindow;
      if (w.pendingIndex() >= 0) {
        w.setPendingIndex(-1);
        w.activate();
      } else {
        this.popScene();
      }
    }
  }

  // ---------------------------------------------------------------------------
  // プラグインコマンド
  // ---------------------------------------------------------------------------
  PluginManager.registerCommand(pluginName, "summonMenu", function() {
    this.setupChild(summonList(), this._eventId);
  });

  PluginManager.registerCommand(pluginName, "partyMenu", () => {
    SceneManager.push(Scene_HaiParty);
  });

  PluginManager.registerCommand(pluginName, "summon", args => {
    summon(Number(args.actorId));
  });

  // ---------------------------------------------------------------------------
  // 倒れたときの一言（アクターのメモ欄 <hai_down:…>。P14）
  // ---------------------------------------------------------------------------
  function downLineOf(actorId) {
    const data = $dataActors[actorId];
    const v = data && data.meta ? data.meta.hai_down : undefined;
    return v === undefined || v === true ? "" : String(v).trim();
  }

  const _Window_BattleLog_displayAddedStates = Window_BattleLog.prototype.displayAddedStates;
  Window_BattleLog.prototype.displayAddedStates = function(target) {
    _Window_BattleLog_displayAddedStates.apply(this, arguments);
    if (!target.isActor()) return;
    const died = target.result().addedStateObjects().some(st => st.id === target.deathStateId());
    const line = died ? downLineOf(target.actorId()) : "";
    if (line) {
      this.push("popBaseLine");
      this.push("pushBaseLine");
      this.push("addText", downFormat.format(target.name(), line));
      this.push("waitForEffect");
    }
  };

  // ---------------------------------------------------------------------------
  // 窓口
  // ---------------------------------------------------------------------------
  window.Hai = window.Hai || {};
  window.Scene_HaiParty = Scene_HaiParty;
  Hai.Companions = {
    /** 遺骸か形見を見つけた仲間のアクター ID の一覧。 */
    found: () => idsOf(state().found),
    /** 呼んだ仲間のアクター ID の一覧。 */
    summoned: () => idsOf(state().summoned),
    /** その仲間の読んだ記憶の断片の番号（1〜4）の一覧。 */
    memories: actorId => idsOf(state().memories[actorId] || {}),
    /** 記憶が 4 つ揃って完全体か。 */
    isComplete,
    /** 演出なしで呼ぶ（テスト用）。 */
    summon,
    /** 名の壁に出る仲間（見つけた・まだ呼んでいない・パーティにいない）。 */
    summonable,
    /** 記憶の断片を覚える（演出なし。テスト用）。新しく覚えたら true。 */
    learnMemory,
    /** 編成でこの 2 人を入れ替えられるか（主人公が控えに回らないか）。 */
    canSwap,
    /** 完全体で覚える強技のスキル（無ければ null）。 */
    completeSkill,
    /** 戦闘で倒れたときの一言（<hai_down>。無ければ ""）。 */
    downLine: actorId => downLineOf(Number(actorId)),
    /** 戦闘に出る人数。 */
    get maxBattleMembers() {
      return $gameParty ? $gameParty.maxBattleMembers() : maxBattle;
    },
  };
})();
