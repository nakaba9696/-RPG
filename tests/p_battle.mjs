// P4 戦闘の戦術性（js/plugins/Hai_Battle.js と data の 141–180）の検査。乱数（Math.random）は固定する。
//   1. SP：最大 50、技・ダメージで溜まらない、癒しで減る、戦闘後も次の戦闘の頭も持ち越す。用語は「SP」。
//      毒：毎ターン最大 HP の 8%、戦闘後も残る。沈黙：魔法・必殺技が使えない（攻撃は使える）。
//   2. 眠り：眠り香で眠り、眠っている間は動かず、被弾で起きる。氷：凍ると動かず、物理の被ダメ 1.5 倍。
//   3. 狙いの癖：<hai_target:lowest> の犬は HP が最も低い者を狙う。<hai_target:taunt> は挑発に乗る。
//   4. おまかせ：全員が攻撃を選び、次のターンも続く。決定で次のターンの頭に止まる。
//   5. 看守長：逃走不可で始めてもボスなので逃げられる。倒す手順（炎の穴・沈黙除けの首輪・眠り香・氷）で倒す。
//      HP 50% 以下で強技「懲罰の鎖」を使う。ダメージの数字が属性の色になる。
import { launchGame, check, runTest } from "./lib.mjs";

const SKILL = { heal: 158, ashFire: 161, frostMist: 162, punish: 180, rollCall: 179 };
const ITEM = { sleepIncense: 141 };
const STATE = { poison: 141, sleep: 142, ice: 143, silence: 146, taunt: 20 };
const COLLAR = 141; // 沈黙除けの首輪
const FAST = 16;

await runTest(async () => {
  const game = await launchGame();
  try {
    await game.call("newGame");
    await game.waitScene("Scene_Map");

    // 乱数の固定と記録の仕掛け
    await game.eval(() => {
      window.__rand = 0.5;
      Math.random = () => window.__rand;
      window.__log = { turns: [], acts: [], colors: [], regen: [] };
      const startTurn = BattleManager.startTurn;
      BattleManager.startTurn = function() {
        window.__log.turns.push($gameParty.members().map(a => {
          const act = a.currentAction();
          return { name: a.name(), input: a.canInput(), attack: !!(act && act.isAttack()) };
        }));
        return startTurn.apply(this, arguments);
      };
      const apply = Game_Action.prototype.apply;
      Game_Action.prototype.apply = function(target) {
        const before = { hp: target.hp, sleep: target.isStateAffected(142), pdr: target.pdr };
        const elementRate = this.item().damage.type > 0 ? this.calcElementRate(target) : 1;
        apply.apply(this, arguments);
        window.__log.acts.push({
          turn: $gameTroop.turnCount(), user: this.subject().name(), enemy: this.subject().isEnemy(),
          item: this.item().name, id: this.item().id, isSkill: this.isSkill(), target: target.name(),
          physical: this.isPhysical(), elementRate, pdr: before.pdr, wasAsleep: before.sleep,
          asleep: target.isStateAffected(142), hpDamage: target.result().hpDamage, hit: target.result().isHit(),
        });
      };
      const setup = Sprite_Damage.prototype.setup;
      Sprite_Damage.prototype.setup = function() {
        setup.apply(this, arguments);
        if (this._haiColor) window.__log.colors.push(this._haiColor);
      };
      const regen = Game_Battler.prototype.regenerateHp;
      Game_Battler.prototype.regenerateHp = function() {
        const hp = this.hp;
        regen.apply(this, arguments);
        if (this.isActor()) window.__log.regen.push({ name: this.name(), mhp: this.mhp, loss: hp - this.hp });
      };
      // 試すための下ごしらえ：MZ の既定の 4 人（1・4・6・7）、レベル 10、P4 の技、眠り香、ケイシーに沈黙除けの首輪
      for (const a of $gameParty.members()) $gameParty.removeActor(a.actorId());
      for (const id of [1, 4, 6, 7]) $gameParty.addActor(id);
      for (const a of $gameParty.members()) {
        a.changeLevel(10, false);
        for (const id of [158, 161, 162]) a.learnSkill(id);
        a.recoverAll();
      }
      $gameParty.gainItem($dataItems[141], 3);
      $gameActors.actor(6).forceChangeEquip(4, $dataArmors[141]);
    });
    const party = await game.eval(() => $gameParty.members().map(a => ({ id: a.actorId(), name: a.name() })));
    check(party.length === 4, "パーティが 4 人でない");
    const mage = party.findIndex(a => a.id === 6); // ケイシー（首輪）
    const healer = party.findIndex(a => a.id === 7); // エリオット
    check(mage >= 0 && healer >= 0, "ケイシー・エリオットがいない " + JSON.stringify(party));
    const log = () => game.eval(() => window.__log);
    const setRand = v => game.eval(x => { window.__rand = x; }, v);
    const tps = () => game.eval(() => $gameParty.members().map(a => a.tp));

    // ----- 戦闘の操作 -----
    const start = async (troopId, canEscape = true) => {
      await game.eval(() => { window.__log.acts = []; }); // ターンの番号は戦闘ごと
      await game.eval(([t, e]) => window.__game.startBattle(t, e, false), [troopId, canEscape]);
      await game.waitScene("Scene_Battle");
      await waitInput();
    };
    // 次の入力（パーティコマンド）か、戦闘の終わりまで進める。文章（出現・逃走など）は決定で送る。
    const waitInput = async () => {
      const t0 = Date.now();
      for (;;) {
        const st = await game.eval(() => {
          const s = SceneManager._scene;
          if (!(s instanceof Scene_Battle) || $gameTroop.isAllDead() || $gameParty.isAllDead() || BattleManager._escaped) return "end";
          if ($gameMessage.isBusy()) return "message";
          return BattleManager.isInputting() && s._partyCommandWindow.active ? "input" : "busy";
        });
        if (st === "end" || st === "input") return;
        if (st === "message") await game.press("Enter");
        else await game.frames(2);
        check(Date.now() - t0 < 180_000, "入力の番にならない");
      }
    };
    // plan[i]：パーティの i 番目の行動。"guard" / { attack, target } / { skill, target } / { item, target }
    const turn = async plan => {
      await game.call("setSpeed", FAST);
      await game.eval(p => {
        $gameParty.members().forEach((a, i) => {
          const act = a.action(0);
          if (!a.canInput() || !act) return;
          const want = p[i] || "guard";
          if (want === "guard") act.setGuard();
          else if (want.skill) act.setSkill(want.skill);
          else if (want.item) act.setItem(want.item);
          else act.setAttack();
          act.setTarget(want.target ?? 0);
        });
        BattleManager.startTurn();
        SceneManager._scene.changeInputWindow();
      }, plan);
      await waitInput();
      await game.call("setSpeed", 1);
    };
    const toMap = async () => {
      await game.call("setSpeed", FAST);
      await game.page.keyboard.down("Enter");
      try {
        await game.waitFor(() => window.__game.scene() === "Scene_Map", null, 120_000);
      } finally {
        await game.page.keyboard.up("Enter");
        await game.call("setSpeed", 1);
      }
      await game.waitScene("Scene_Map");
    };
    const escape = async () => {
      await setRand(0.01);
      await game.eval(() => SceneManager._scene.commandEscape());
      await toMap();
      await setRand(0.5);
      check(await game.eval(() => BattleManager._escaped), "逃げられなかった");
    };
    const enemy = () => game.eval(() => {
      const e = $gameTroop.members()[0];
      return { name: e.name(), hp: e.hp, mhp: e.mhp, states: e.states().map(s => s.id), alive: e.isAlive() };
    });
    const actsIn = async turnNo => (await log()).acts.filter(a => a.turn === turnNo);

    // ===== 1. SP・毒・沈黙（胞子茸） =====
    const terms = await game.eval(() => [TextManager.tp, TextManager.tpA, $dataSystem.optDisplayTp]);
    check(terms[0] === "ＳＰ" && terms[1] === "SP" && terms[2] === true, "用語が SP でない " + JSON.stringify(terms));
    const sp0 = await game.eval(() => $gameParty.members().map(a => [a.tp, a.maxTp()]));
    check(sp0.every(([tp, max]) => tp === 50 && max === 50), "SP が最大 50 の満タンで始まっていない " + JSON.stringify(sp0));
    await game.eval(() => $gameParty.members()[0].setTp(30));

    await start(142);
    check((await tps())[0] === 30, "戦闘の頭で SP が変わった");
    await game.eval(() => {
      $gameParty.members()[0].addState(141); // リードに毒
      $gameParty.members()[1].addState(146); // ミシェルに沈黙
    });
    const silence = await game.eval(([m]) => {
      const silenced = $gameParty.members()[1];
      const collared = $gameParty.members()[m];
      collared.addState(146);
      return {
        fire: silenced.canUse($dataSkills[161]), heal: silenced.canUse($dataSkills[158]), attack: silenced.canUse($dataSkills[1]),
        collared: collared.isStateAffected(146), collaredFire: collared.canUse($dataSkills[161]),
      };
    }, [mage]);
    check(!silence.fire && !silence.heal && silence.attack, "沈黙で魔法・必殺技が封じられていない " + JSON.stringify(silence));
    check(!silence.collared && silence.collaredFire, "首輪で沈黙を防げていない " + JSON.stringify(silence));
    await game.frames(50); // 状態のアイコンは 40 フレームごとに切り替わる
    await game.shot("states");
    const tpBefore = await tps();
    const plan1 = ["attack", "guard", "guard", "guard"].map(x => (x === "attack" ? { attack: true } : x));
    plan1[healer] = { skill: SKILL.heal, target: 0 };
    await turn(plan1);
    const tpAfter = await tps();
    const want = tpBefore.map((v, i) => (i === healer ? v - 10 : v));
    check(JSON.stringify(tpAfter) === JSON.stringify(want), `SP が技・ダメージで変わった／癒しで 10 減っていない ${tpBefore} → ${tpAfter}`);
    // 被弾で溜まらない（MZ の既定なら 200/最大 HP × 50 だけ増える）
    const charge = await game.eval(() => {
      const a = $gameParty.members()[1];
      const tp = a.tp;
      a.gainHp(-200);
      a.onDamage(200);
      return { before: tp, after: a.tp };
    });
    check(charge.before === charge.after, "被弾で SP が溜まった " + JSON.stringify(charge));
    const poison = (await log()).regen.find(r => r.name === party[0].name);
    check(poison && poison.loss === -Math.floor(poison.mhp * -0.08), "毒のダメージが最大 HP の 8% でない " + JSON.stringify(poison));
    console.log(`  SP：${tpBefore} → ${tpAfter}（癒しで −10、攻撃・被弾では増えない）。毒：${poison.loss}/${poison.mhp}。沈黙：魔法・必殺技が使えない、首輪で防ぐ`);
    // 倒す
    for (let i = 0; i < 10 && (await enemy()).alive; i++) {
      const plan = [{ attack: true }, { attack: true }, { attack: true }, "guard"];
      plan[mage] = { skill: SKILL.ashFire, target: 0 };
      await turn(plan);
    }
    check(!(await enemy()).alive, "胞子茸を倒せなかった");
    const tpEnd = await tps();
    await toMap();
    const afterBattle = await game.eval(() => ({
      tp: $gameParty.members().map(a => a.tp), poisoned: $gameParty.members()[0].isStateAffected(141),
    }));
    check(JSON.stringify(afterBattle.tp) === JSON.stringify(tpEnd), `戦闘後に SP が変わった ${tpEnd} → ${afterBattle.tp}`);
    check(afterBattle.poisoned, "毒が戦闘後に消えた");
    console.log(`  戦闘後：SP ${afterBattle.tp} を持ち越し、毒は残る`);

    // ===== 2. 眠りと氷（骨の番人） =====
    await start(143);
    check(JSON.stringify(await tps()) === JSON.stringify(tpEnd), "次の戦闘の頭で SP が変わった");
    const ice = await game.eval(() => {
      const actor = $gameParty.members()[0];
      const e = $gameTroop.members()[0];
      const action = new Game_Action(actor);
      action.setAttack();
      const normal = action.makeDamageValue(e, false);
      e.addState(143);
      const frozen = action.makeDamageValue(e, false);
      e.removeState(143);
      return { normal, frozen };
    });
    check(Math.abs(ice.frozen - ice.normal * 1.5) <= 1, "氷で物理の被ダメが 1.5 倍にならない " + JSON.stringify(ice));
    // 1 ターン目：眠り香
    const sleepPlan = ["guard", "guard", "guard", "guard"];
    sleepPlan[healer] = { item: ITEM.sleepIncense, target: 0 };
    await turn(sleepPlan);
    check((await enemy()).states.includes(STATE.sleep), "眠り香で眠らない");
    // 2 ターン目：眠っているので動かない
    await turn(["guard", "guard", "guard", "guard"]);
    check((await actsIn(2)).every(a => !a.enemy), "眠っている骨の番人が動いた");
    // 3 ターン目：殴ると起きる
    await turn([{ attack: true }, "guard", "guard", "guard"]);
    const wake = (await actsIn(3)).find(a => !a.enemy && a.physical && a.hit);
    check(wake && wake.wasAsleep && !wake.asleep, "被弾で起きない " + JSON.stringify(wake));
    // 4 ターン目：凍てつく霧で凍らせ、5 ターン目は動かない
    const icePlan = ["guard", "guard", "guard", "guard"];
    icePlan[mage] = { skill: SKILL.frostMist, target: 0 };
    await turn(icePlan);
    check((await enemy()).states.includes(STATE.ice), "凍てつく霧で凍らない");
    await turn([{ attack: true }, "guard", "guard", "guard"]);
    const frozenActs = await actsIn(5);
    check(frozenActs.every(a => !a.enemy), "凍った骨の番人が動いた");
    const frozenHit = frozenActs.find(a => !a.enemy && a.physical && a.hit);
    check(frozenHit && Math.abs(frozenHit.pdr - 1.5) < 1e-9, "凍った相手の物理ダメージ率が 150% でない " + JSON.stringify(frozenHit));
    console.log(`  眠り：眠り香で眠り、動かず、殴ると起きた。氷：被ダメ ${ice.normal} → ${ice.frozen}（1.5 倍）、凍っている間は動かない`);
    await escape();

    // ===== 3. 狙いの癖（夜狩りの犬：HP が最も低い者） =====
    await start(144);
    await game.eval(([h]) => $gameParty.members()[h].setHp(30), [healer]);
    await turn(["guard", "guard", "guard", "guard"]);
    const bite = (await actsIn(1)).find(a => a.enemy);
    check(bite && bite.target === party[healer].name, `犬が HP の最も低い ${party[healer].name} を狙っていない ` + JSON.stringify(bite));
    const taunt = await game.eval(() => {
      const target = $gameParty.members()[2];
      target.addState(20);
      const habit = Hai.Battle.targetHabit($gameTroop.members()[0]);
      const picked = Hai.Battle.pickTarget("taunt", $gameParty).name();
      target.removeState(20);
      return { habit, picked, want: target.name(), boss: Hai.Battle.isBossTroop() };
    });
    check(taunt.habit === "lowest" && taunt.picked === taunt.want && !taunt.boss, "狙いの癖の窓口 " + JSON.stringify(taunt));
    console.log(`  狙い：犬は HP 30 の ${bite.target} を噛んだ。挑発の癖は ${taunt.picked} を選ぶ`);
    await escape();
    await game.eval(() => $gameParty.members().forEach(a => a.recoverAll()));

    // ===== 4. おまかせ（獄卒） =====
    await start(141);
    const commands = await game.eval(() => SceneManager._scene._partyCommandWindow._list.map(c => c.name));
    check(JSON.stringify(commands) === JSON.stringify(["戦う", "逃げる", "おまかせ"]), "パーティコマンド " + JSON.stringify(commands));
    // 2 ターンで倒れないように、獄卒の HP を増やす
    await game.eval(() => {
      const e = $gameTroop.members()[0];
      e.addParam(0, 5000);
      e.recoverAll();
    });
    await game.waitFor(() => SceneManager._scene._partyCommandWindow.isOpenAndActive());
    const turnsBefore = (await log()).turns.length;
    await game.press("ArrowUp"); // 一番上から ↑ で一番下（おまかせ）へ
    check(await game.eval(() => SceneManager._scene._partyCommandWindow.currentSymbol() === "haiAuto"), "おまかせにカーソルが合わない");
    await game.shot("auto-command");
    await game.press("Enter");
    await game.call("setSpeed", FAST);
    await game.waitFor(n => window.__log.turns.length >= n + 2, turnsBefore, 120_000);
    await game.call("setSpeed", 1);
    await game.waitFor(() => SceneManager._scene._haiAutoWindow.visible);
    await game.shot("auto");
    const autoTurns = (await log()).turns.slice(turnsBefore, turnsBefore + 2);
    check(autoTurns.every(t => t.every(a => !a.input || a.attack)), "おまかせで全員が攻撃を選んでいない " + JSON.stringify(autoTurns));
    check(autoTurns[0].filter(a => a.attack).length >= 3, "おまかせで攻撃した人数が少ない " + JSON.stringify(autoTurns));
    await game.press("Enter");
    check(!(await game.eval(() => Hai.Battle.isAuto())), "決定でおまかせが止まらない");
    await game.call("setSpeed", FAST);
    await waitInput();
    await game.call("setSpeed", 1);
    check(await game.eval(() => SceneManager._scene._partyCommandWindow.active && !SceneManager._scene._haiAutoWindow.visible),
      "おまかせを止めたのにコマンドに戻らない");
    console.log(`  おまかせ：2 ターン続けて全員が攻撃。決定で止まり、コマンドに戻った`);
    await escape();
    await game.eval(() => $gameParty.members().forEach(a => { a.recoverAll(); a.setTp(50); }));

    // ===== 5. 看守長 =====
    // 逃走不可で始めても、ボスなので逃げられる
    await start(161, false);
    check(await game.eval(() => BattleManager.canEscape() && Hai.Battle.isBossTroop()), "看守長から逃げられない設定");
    await escape();
    console.log("  逃走：逃走不可で始めた看守長の戦闘から逃げられた");

    await start(161, false);
    const boss = await game.eval(() => {
      const e = $gameTroop.members()[0];
      return { fire: e.elementRate(2), thunder: e.elementRate(4), pdr: e.pdr, poison: e.isStateResist(141), sleep: e.stateRate(142) };
    });
    check(boss.fire === 2 && boss.thunder === 0 && boss.pdr === 0.5 && boss.poison && boss.sleep === 1.5, "看守長の耐性 " + JSON.stringify(boss));
    const keep = i => (i === mage ? { skill: SKILL.ashFire, target: 0 } : "guard");
    const healOrGuard = async () => {
      const st = await game.eval(() => $gameParty.members().map(a => ({ rate: a.hpRate(), heal: a.canUse($dataSkills[158]), alive: a.isAlive() })));
      const plan = st.map((_, i) => keep(i));
      const low = st.findIndex(s => s.alive && s.rate < 0.5);
      if (low >= 0 && st[healer].heal) plan[healer] = { skill: SKILL.heal, target: low };
      return plan;
    };
    // 1〜3 ターン目：ケイシーが灰火（炎 200%）。3 ターン目に更生の号令で沈黙（首輪のケイシーは平気）
    await game.call("setSpeed", 1);
    await game.eval(([m]) => {
      $gameParty.members().forEach((a, i) => (i === m ? a.action(0).setSkill(161) : a.action(0).setGuard()));
      $gameParty.members()[m].action(0).setTarget(0);
      BattleManager.startTurn();
      SceneManager._scene.changeInputWindow();
    }, [mage]);
    await game.waitFor(() => SceneManager._scene._spriteset._enemySprites.some(s => s._damages.some(d => d._haiColor)), null, 120_000);
    await game.frames(20); // 被弾の点滅が終わってから
    await game.shot("fire-damage");
    await waitInput();
    for (let t = 2; t <= 3; t++) await turn(await healOrGuard());
    const fire = (await log()).acts.filter(a => a.turn <= 3 && a.id === SKILL.ashFire);
    check(fire.length === 3 && fire.every(a => a.elementRate === 2 && a.hpDamage > 0), "灰火が炎 200% で当たっていない " + JSON.stringify(fire));
    const rollCall = (await actsIn(3)).filter(a => a.enemy && a.id === SKILL.rollCall);
    check(rollCall.length > 0, "3 ターン目に更生の号令を使っていない " + JSON.stringify(await actsIn(3)));
    const silenced = await game.eval(() => $gameParty.members().map(a => a.isStateAffected(146)));
    check(!silenced[mage] && silenced.some(Boolean), "号令の沈黙（首輪のケイシーは防ぐ） " + JSON.stringify(silenced));
    check(await game.eval(([m]) => $gameParty.members()[m].canUse($dataSkills[161]), [mage]), "首輪のケイシーが灰火を使えない");
    const colors = (await log()).colors;
    check(colors.includes("#ff5a3c"), "炎のダメージが赤くない " + JSON.stringify(colors));
    console.log(`  看守長：灰火 ${fire.map(a => a.hpDamage)}（炎 200%、数字は赤）。号令の沈黙 ${silenced}（首輪で防ぐ）`);

    // 4 ターン目：眠り香（アイテムなので沈黙でも使える）。5 ターン目は眠って動かない
    const p4 = (await healOrGuard()).map(() => "guard");
    p4[healer] = { item: ITEM.sleepIncense, target: 0 };
    await turn(p4);
    check((await enemy()).states.includes(STATE.sleep), "看守長が眠らない");
    await turn((await healOrGuard()).map(() => "guard"));
    check((await actsIn(5)).every(a => !a.enemy), "眠った看守長が動いた");
    // 6 ターン目：凍てつく霧（起きて凍る）。7 ターン目：凍って動かない看守長を殴る（物理 50% × 氷 150%）
    const p6 = [0, 1, 2, 3].map(() => "guard");
    p6[mage] = { skill: SKILL.frostMist, target: 0 };
    await turn(p6);
    check((await enemy()).states.includes(STATE.ice), "看守長が凍らない");
    const p7 = [0, 1, 2, 3].map(i => (i === mage || i === healer ? "guard" : { attack: true }));
    await turn(p7);
    const hits = (await actsIn(7)).filter(a => !a.enemy && a.physical && a.hit);
    check(hits.length > 0 && hits.every(a => Math.abs(a.pdr - 0.75) < 1e-9), "凍った看守長の物理ダメージ率が 75% でない " + JSON.stringify(hits));
    check((await actsIn(7)).every(a => !a.enemy), "凍った看守長が動いた");
    console.log(`  看守長：眠り香で 1 ターン止め、凍てつく霧で凍らせて殴った（物理ダメージ率 ${hits[0].pdr}）`);

    // HP 50% 以下で懲罰の鎖
    await game.eval(() => {
      const e = $gameTroop.members()[0];
      e.setHp(Math.floor(e.mhp * 0.45));
    });
    let punish = null;
    for (let i = 0; i < 6 && !punish; i++) {
      const plan = await healOrGuard(); // 削らずに待つ
      if (plan[mage].skill) plan[mage] = "guard";
      await turn(plan);
      punish = (await log()).acts.find(a => a.enemy && a.id === SKILL.punish);
    }
    check(punish, "HP 50% 以下で懲罰の鎖を使わない " + JSON.stringify((await log()).acts.filter(a => a.enemy).slice(-6)));
    const beforeHalf = (await log()).acts.filter(a => a.enemy && a.turn < 8 && a.id === SKILL.punish);
    check(beforeHalf.length === 0, "HP が多いうちに懲罰の鎖を使った");
    console.log(`  看守長：HP 50% 以下で懲罰の鎖（${punish.target} に ${punish.hpDamage}）`);

    // 倒す：灰火と攻撃
    for (let i = 0; i < 12 && (await enemy()).alive; i++) {
      const plan = await healOrGuard();
      const st = await game.eval(() => $gameParty.members().map(a => a.isAlive()));
      plan.forEach((p, k) => {
        if (p === "guard" && k !== healer && st[k]) plan[k] = { attack: true };
      });
      await turn(plan);
    }
    check(!(await enemy()).alive && !(await game.eval(() => $gameParty.isAllDead())), "看守長を倒せなかった " + JSON.stringify(await enemy()));
    await game.frames(5);
    await game.shot("boss-defeated");
    await toMap();
    console.log("  看守長を倒した");

    game.assertNoErrors();
  } finally {
    await game.close();
  }
});
