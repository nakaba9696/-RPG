// 戦いを測る道具の中身（tools/balance/）。run.mjs と tests/t_balance.mjs が使う。
//
// ?hai_test で起動したゲーム（tests/lib.mjs の launchGame）の中で、本物の Scene_Battle を回す。
// ダメージ・命中・敵の行動の表・技の範囲・状態は、ゲームのとおりに効く（ここで真似しない）。
// こちらがするのは次だけ：
//   - 隊・Lv・装備・SP・持ち物を条件どおりに揃える（戦うたびに加入時の形から作り直す）
//   - Math.random を種つきの乱数に替える（戦うたびに種から作り直すので、同じ種なら同じ結果）
//   - 入力の番が来たら、遊び方（policies.mjs）で各人の行動を埋めてターンを始める（イベントの「戦闘の処理」の入力と同じ所）
//   - 文章の窓を決定キーで送ったことにする（Window_Message.isTriggered）
//   - 描画を止め（Graphics._canRender）、早送りする（__game.setSpeed）
//   - 勝ち・負け・打ち切りの瞬間に、ターン数と隊の HP を写す
import { policy } from "./policies.mjs";

/** 早送りの倍率（1 回の描画の間に進めるフレーム数）。 */
export const FAST = 30;
/** 戦闘の場所（静かな見本のマップ。拠点の自動実行やシンボル敵に触らない）。 */
export const ARENA = { mapId: 900, x: 5, y: 7 };

/** defaults と各行を重ねて、1 つの測る条件にする（入れ子の hero・heal・strong・items は重ねる）。 */
export function resolveCondition(defaults = {}, row = {}) {
  const merged = { ...defaults, ...row };
  for (const k of ["hero", "heal", "strong", "items"]) merged[k] = { ...(defaults[k] || {}), ...(row[k] || {}) };
  if (!Array.isArray(merged.party) || merged.party.length === 0) throw new Error(`隊（party）が無い：${row.key ?? row.troop}`);
  if (!Array.isArray(merged.levels) || merged.levels.length !== merged.party.length) {
    throw new Error(`Lv（levels）の数が隊と合わない：${row.key ?? row.troop}`);
  }
  if (!(merged.troop > 0)) throw new Error(`敵グループ（troop）が無い：${row.key}`);
  merged.runs = Number(merged.runs ?? 12);
  merged.seed = Number(merged.seed ?? 1);
  merged.maxTurns = Number(merged.maxTurns ?? 60);
  merged.policies = merged.policies ?? ["attack"];
  merged.equip = merged.equip ?? "join";
  merged.tp = merged.tp ?? "full";
  return merged;
}

/** 種と回の番号から、その回の乱数の種（32 ビット）を作る。 */
export function runSeed(seed, index) {
  let h = (Math.imul(seed >>> 0, 0x9e3779b1) ^ Math.imul(index + 1, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  return (h ^ (h >>> 15)) >>> 0 || 1;
}

/** ページの中に台を据える（一度だけ）。 */
function install() {
  if (window.__bal) return;
  const bal = (window.__bal = { active: false, done: true, result: null, run: null, rng: null });

  // 種つきの乱数（mulberry32）。戦うたびに種から作り直す
  const nativeRandom = Math.random;
  Math.random = function() {
    if (!bal.rng) return nativeRandom();
    let t = (bal.rng.s = (bal.rng.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // 描画を止める（ゲームの更新はそのまま）
  const _canRender = Graphics._canRender;
  Graphics._canRender = function() {
    return !bal.active && _canRender.apply(this, arguments);
  };

  // 文章は決定キーで送ったことにする（ボスの名乗り・troop の文・勝ち負けの文）
  const _isTriggered = Window_Message.prototype.isTriggered;
  Window_Message.prototype.isTriggered = function() {
    return bal.active || _isTriggered.apply(this, arguments);
  };

  const snapshot = kind => {
    const run = bal.run;
    if (!run || bal.result) return;
    const members = $gameParty.members();
    const hp = members.reduce((s, a) => s + a.hp, 0);
    const mhp = members.reduce((s, a) => s + a.mhp, 0);
    const heal = run.cond.heal;
    const left = heal && heal.item ? $gameParty.numItems($dataItems[heal.item]) : 0;
    bal.result = {
      result: kind, // "win" / "lose" / "timeout"
      turns: $gameTroop.turnCount(),
      hpRate: mhp > 0 ? hp / mhp : 0,
      hp: members.map(a => a.hp),
      mhp: members.map(a => a.mhp),
      down: members.filter(a => a.isDead()).length,
      healUsed: (run.healStart || 0) - left,
      enemyHp: $gameTroop.members().map(e => e.hp),
      enemyMhp: $gameTroop.members().map(e => e.mhp),
      selfHits: run.selfHits,
    };
  };

  // GAM-45 の誤りを拾う：敵の技が敵の側（自分か仲間）に HP ダメージか状態を与えたら、技の番号を数える。
  // 自分だけ（範囲 11）に状態を付ける構えと、回復は数えない。
  const _apply = Game_Action.prototype.apply;
  Game_Action.prototype.apply = function(target) {
    _apply.apply(this, arguments);
    const run = bal.run;
    if (!bal.active || !run || !this.subject().isEnemy() || !target.isEnemy() || !this.isSkill()) return;
    const r = target.result();
    const states = this.item().scope === 11 ? [] : r.addedStateObjects().filter(st => st.id !== target.deathStateId());
    if (r.hpDamage > 0 || states.length > 0) {
      const id = this.item().id;
      run.selfHits[id] = (run.selfHits[id] || 0) + 1;
    }
  };
  const _processVictory = BattleManager.processVictory;
  BattleManager.processVictory = function() {
    if (bal.active) snapshot("win");
    return _processVictory.apply(this, arguments);
  };
  const _processDefeat = BattleManager.processDefeat;
  BattleManager.processDefeat = function() {
    if (bal.active) snapshot("lose");
    return _processDefeat.apply(this, arguments);
  };
  const _processAbort = BattleManager.processAbort;
  BattleManager.processAbort = function() {
    if (bal.active) snapshot("timeout");
    return _processAbort.apply(this, arguments);
  };
  // 勝ち負けの文（endBattle のあとに読まれる）も送り切り、戦闘の場面が閉じた所で 1 回の終わりにする
  const _Scene_Battle_terminate = Scene_Battle.prototype.terminate;
  Scene_Battle.prototype.terminate = function() {
    _Scene_Battle_terminate.apply(this, arguments);
    if (bal.active) {
      bal.active = false;
      bal.done = true;
      bal.rng = null;
    }
  };

  // 手伝いの関数（policies.mjs の h）
  const makeHelpers = run => {
    const opts = run.cond;
    const reserved = run.reserved;
    return {
      opts,
      isHero: a => !!opts.hero && a.actorId() === Number(opts.hero.actor),
      canSkill: (a, id) => !!$dataSkills[id] && a.hasSkill(id) && a.canUse($dataSkills[id]),
      strongSkill: a => Number((opts.strong || {})[a.actorId()] || 0),
      // perAlly：false にすると、同じ者に同じターンに何本でも使う（W27 #301 の台と同じ）
      healLow({ perAlly = true } = {}) {
        const heal = opts.heal;
        if (!heal || !heal.item) return null;
        const item = $dataItems[heal.item];
        if ($gameParty.numItems(item) - reserved.items <= 0) return null;
        const members = $gameParty.members();
        let best = -1;
        members.forEach((m, i) => {
          if (m.isAlive() && m.hpRate() < Number(heal.rate) && !(perAlly && reserved.targets.includes(i))) {
            if (best < 0 || m.hpRate() < members[best].hpRate()) best = i;
          }
        });
        if (best < 0) return null;
        reserved.items += 1;
        reserved.targets.push(best);
        return { item: heal.item, target: best };
      },
    };
  };

  // 入力の番：各人の行動を埋めて、ターンを始める
  const fillAndStart = scene => {
    const run = bal.run;
    if ($gameTroop.turnCount() >= run.cond.maxTurns) {
      BattleManager.abort();
      scene.changeInputWindow();
      return;
    }
    run.reserved = { items: 0, targets: [] };
    const h = makeHelpers(run);
    const firstEnemy = () => Math.max(0, $gameTroop.members().findIndex(e => e.isAlive()));
    for (const actor of $gameParty.members()) {
      if (!actor.canInput()) continue;
      for (let slot = 0; slot < actor.numActions(); slot++) {
        const act = actor.action(slot);
        if (!act) continue;
        const want = run.decide(actor, slot, h) || { attack: true };
        if (want.guard) act.setGuard();
        else if (want.skill) act.setSkill(want.skill);
        else if (want.item) act.setItem(want.item);
        else act.setAttack();
        if (act.isForFriend()) act.setTarget(want.target ?? $gameParty.members().indexOf(actor));
        else act.setTarget(want.target ?? firstEnemy());
        run.actions.push([$gameTroop.turnCount() + 1, actor.actorId(), want.skill ? "s" + want.skill : want.item ? "i" + want.item : want.guard ? "g" : "a"]);
      }
    }
    BattleManager.startTurn();
    scene.changeInputWindow();
  };
  const _Scene_Battle_update = Scene_Battle.prototype.update;
  Scene_Battle.prototype.update = function() {
    _Scene_Battle_update.apply(this, arguments);
    if (!bal.active || !bal.run || bal.result) return;
    if (!BattleManager.isInputting() || $gameMessage.isBusy() || $gameTroop.isEventRunning()) return;
    if (!(this._partyCommandWindow.active || this._actorCommandWindow.active)) return;
    fillAndStart(this);
  };

  // 1 回ぶん：隊を作り直し、乱数を据え、戦闘を始める
  bal.start = (cond, decideSrc, seed) => {
    let decide;
    try {
      decide = new Function("return ({" + decideSrc + "}).decide")();
    } catch (e) {
      decide = new Function("return (" + decideSrc + ")")();
    }
    for (const a of $gameParty.members()) $gameParty.removeActor(a.actorId());
    cond.party.forEach((id, i) => {
      const actor = $gameActors.actor(id);
      actor.setup(id); // 加入時の形（Lv・装備・技・状態）に戻す
      actor.changeLevel(Number(cond.levels[i]), false);
      const eq = cond.equip === "join" ? null : cond.equip[id];
      if (eq) eq.forEach((itemId, slot) => {
        const etype = actor.equipSlots()[slot];
        if (etype === undefined) return;
        const item = itemId ? (etype === 1 ? $dataWeapons[itemId] : $dataArmors[itemId]) : null;
        actor.forceChangeEquip(slot, item);
      });
      actor.recoverAll();
      actor.setTp(cond.tp === "full" ? actor.maxTp() : Number(cond.tp));
      $gameParty.addActor(id);
    });
    for (const [itemId, n] of Object.entries(cond.items || {})) {
      const item = $dataItems[Number(itemId)];
      $gameParty.gainItem(item, Number(n) - $gameParty.numItems(item));
    }
    const heal = cond.heal;
    bal.run = { cond, decide, actions: [], selfHits: {}, reserved: { items: 0, targets: [] },
      healStart: heal && heal.item ? $gameParty.numItems($dataItems[heal.item]) : 0 };
    bal.result = null;
    bal.done = false;
    bal.rng = { s: seed >>> 0 };
    bal.active = true;
    BattleManager.setup(cond.troop, true, true); // 逃走可・敗北可（負けても Hai_Defeat に渡さない）
    $gamePlayer.makeEncounterCount();
    SceneManager.push(Scene_Battle);
  };
}

/**
 * 台を据えて、戦闘の場所（ARENA）に立つ。launchGame のあと一度呼ぶ。
 * @param {object} game tests/lib.mjs の launchGame の戻り値
 */
export async function prepare(game) {
  await game.call("newGame");
  await game.waitScene("Scene_Map");
  await game.call("transfer", ARENA.mapId, ARENA.x, ARENA.y, 2);
  await game.waitFor(m => window.__game.mapId() === m && !window.__game.isBusy(), ARENA.mapId);
  await game.eval(install);
}

/** 1 回戦う。結果 { result, turns, hpRate, hp, mhp, down, healUsed, enemyHp, enemyMhp, actions } */
export async function runOnce(game, cond, policyName, seed, timeout = 300_000) {
  const src = policy(policyName).decide.toString();
  await game.call("setSpeed", FAST);
  await game.eval(([c, s, sd]) => window.__bal.start(c, s, sd), [cond, src, seed]);
  await game.waitFor(() => window.__bal.done && window.__game.scene() === "Scene_Map" && !window.__game.isBusy(), null, timeout);
  const r = await game.eval(() => ({ ...window.__bal.result, actions: window.__bal.run.actions }));
  if (!r || !r.result) throw new Error(`戦闘の結果が取れなかった（敵グループ ${cond.troop}）`);
  return r;
}

/** 条件 1 つ × 遊び方 1 つを runs 回戦い、まとめを返す。 */
export async function measure(game, cond, policyName, { onRun } = {}) {
  const runs = [];
  for (let i = 0; i < cond.runs; i++) {
    const r = await runOnce(game, cond, policyName, runSeed(cond.seed, i));
    runs.push(r);
    if (onRun) onRun(r, i);
  }
  return { key: cond.key ?? `troop${cond.troop}`, policy: policyName, label: policy(policyName).label, cond, summary: summarize(runs), runs };
}

const median = xs => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** 回ごとの結果をまとめる。HP は勝った回だけ（負けた回は 0 なので別に数える）。 */
export function summarize(runs) {
  const wins = runs.filter(r => r.result === "win");
  const turns = runs.map(r => r.turns);
  const hp = wins.map(r => r.hpRate);
  return {
    runs: runs.length,
    wins: wins.length,
    loses: runs.filter(r => r.result === "lose").length,
    timeouts: runs.filter(r => r.result === "timeout").length,
    turns: turns.length ? { min: Math.min(...turns), median: median(turns), max: Math.max(...turns) } : null,
    winTurns: wins.length ? { min: Math.min(...wins.map(r => r.turns)), median: median(wins.map(r => r.turns)), max: Math.max(...wins.map(r => r.turns)) } : null,
    hp: hp.length ? { mean: hp.reduce((s, x) => s + x, 0) / hp.length, min: Math.min(...hp), max: Math.max(...hp) } : null,
    down: { total: runs.reduce((s, r) => s + r.down, 0), max: Math.max(0, ...runs.map(r => r.down)), runsWithDown: runs.filter(r => r.down > 0).length },
    healUsed: runs.length ? runs.reduce((s, r) => s + r.healUsed, 0) / runs.length : 0,
    selfHits: runs.reduce((acc, r) => {
      for (const [id, n] of Object.entries(r.selfHits || {})) acc[id] = (acc[id] || 0) + n;
      return acc;
    }, {}),
  };
}

/**
 * 狙いの幅（bosses.json の target[遊び方]）と比べる。外れた所の言葉の配列（空なら幅の中）。
 * target：{ turns: [下, 上], hp: [下, 上], wipesMax: n }（どれも省略可。hp は 0〜1）
 */
export function judge(summary, target) {
  const out = [];
  const self = Object.entries(summary.selfHits || {});
  if (self.length) out.push(`敵の技が敵の側に当たった（${self.map(([id, n]) => `技 ${id}×${n}`).join("・")}。GAM-45）`);
  if (!target) return out.length ? out : null;
  const med = summary.turns && summary.turns.median;
  if (target.turns && med !== null) {
    if (med < target.turns[0]) out.push(`ターン短い（中央 ${med}＜${target.turns[0]}）`);
    if (med > target.turns[1]) out.push(`ターン長い（中央 ${med}＞${target.turns[1]}）`);
  }
  if (target.hp) {
    if (!summary.hp) out.push("勝てない");
    else {
      if (summary.hp.mean < target.hp[0]) out.push(`HP 残り少ない（${pct(summary.hp.mean)}＜${pct(target.hp[0])}）`);
      if (summary.hp.mean > target.hp[1]) out.push(`HP 残り多い（${pct(summary.hp.mean)}＞${pct(target.hp[1])}）`);
    }
  }
  const wipes = summary.loses + summary.timeouts;
  if (target.wipesMax !== undefined && wipes > target.wipesMax) out.push(`全滅・打ち切り ${wipes} 回（上限 ${target.wipesMax}）`);
  return out;
}

export const pct = x => `${Math.round(x * 100)}%`;
const range = t => (t ? (t.min === t.max ? `${t.min}` : `${t.min}〜${t.max}`) + `（中央 ${t.median}）` : "―");

/** まとめの表（Markdown）。results は measure の戻り値の配列。 */
export function toMarkdown(results) {
  const lines = [
    "| ボス（敵グループ） | 隊（Lv） | 遊び方 | 回 | 勝ち／全滅 | ターン（最小〜最大・中央） | 残る HP（平均・幅。勝った回） | 倒れた人 | 煎じ薬 | 狙いの幅 | 判定 |",
    "|---|---|---|---|---|---|---|---|---|---|---|",
  ];
  for (const r of results) {
    const s = r.summary;
    const c = r.cond;
    const party = `${c.party.map(id => c.names?.[id] ?? id).join("・")}（${c.levels.join("・")}）`;
    const hp = s.hp ? `${pct(s.hp.mean)}（${pct(s.hp.min)}〜${pct(s.hp.max)}）` : "―";
    const down = s.down.total ? `${s.down.runsWithDown} 回（計 ${s.down.total} 人・最多 ${s.down.max}）` : "0";
    const t = r.target;
    const aim = t ? [t.turns ? `${t.turns[0]}〜${t.turns[1]} ターン` : "", t.hp ? `${pct(t.hp[0])}〜${pct(t.hp[1])}` : ""].filter(Boolean).join("・") : "―";
    const verdict = r.verdict === null || r.verdict === undefined ? "―" : r.verdict.length ? "**外れ** " + r.verdict.join("・") : "幅の中";
    const wl = `${s.wins}／${s.loses}${s.timeouts ? `（打ち切り ${s.timeouts}）` : ""}`;
    lines.push(`| ${c.name ?? ""}（${c.troop}） | ${party} | ${r.label} | ${s.runs} | ${wl} | ${range(s.turns)} | ${hp} | ${down} | ${s.healUsed.toFixed(1)} | ${aim} | ${verdict} |`);
  }
  return lines.join("\n");
}
