// W4（#102）古書院とオーブ「聖灰」（docs/world2.md 6・11 章、tools/maps/src/w4_08*）の検査：
//   1. 焚刑の教会 063 の裏口（焚刑官を倒した後）→ 古書院・前庭と閲覧室 080：R35、ノクスの記憶 1（点の字の石板）、シオンの記憶 1（習字の帳面）、
//      点の字の栞（来歴つき）、目録の部屋の R34、H28（本棚B）→ 赤い宝箱「灰樫の杖」。
//   2. 書架の迷路 081：写字室の結界と夜の閲覧の札、焼けた区画の R36・ノクスの記憶 2、H29（迷路の南東の苔から東の壁の中を北へ）、
//      番号錠（違う数・725）→ 禁書庫 082。
//   3. 禁書庫 082：R37、ノクスの記憶 3（2 ページ）、H30 → ノクスの遺骸（記憶 4 つで完全体）、奥の叡智のオーブ、
//      H31 の閂（スイッチ 164）→ 森の納骨所 022 と行き来。拠点の召喚陣でノクスが加わる。
//   4. 紙魚の王の間 083：R38、紙魚の王（逃げると禁書庫の大扉の前へ。ノクスのファイアで炎の弱点のヒント、沈黙・眠りが効かない、
//      HP 50% で紙魚を 2 体呼ぶ、倒すとスイッチ 152・司書の眼鏡・焼け残りの頁、残った紙魚は散る）。
//   5. オーブの間「聖灰」084：場面（スイッチ 102・変数 101）、帰りの転送陣 → 牢獄の間。4 つ目なら 105・106。
//   6. セーブ・ロード。
// 乱数（Math.random）は固定する（逃走の成否と行動の選び方）。
import { launchGame, check, runTest } from "./lib.mjs";

const HALL = 10;
const CIRCLE = { x: 28, y: 17 };
const CHURCH = 63;
const BACKDOOR = { x: 17, y: 5 };
const COURT = 80;
const COURT_ARRIVE = { x: 19, y: 28 };
const R35 = { x: 17, y: 15 };
const NOX1 = { x: 25, y: 10 };
const SHION1 = { x: 22, y: 14 };
const BOOKMARK = { x: 17, y: 11 };
const R34 = { x: 8, y: 11 };
const H28 = { x: 4, y: 13, chest: { x: 1, y: 13 } };
const NORTH_DOOR = { x: 19, y: 3 };
const MAZE = 81;
const MAZE_ARRIVE = { x: 21, y: 29 };
const WARP = { x: 4, y: 17 };
const SLIP = { x: 2, y: 15 };
const R36 = { x: 35, y: 3 };
const NOX2 = { x: 37, y: 1 };
const H29 = { moss: { x: 35, y: 27 }, end: { x: 36, y: 7 } };
const LOCK = { x: 21, y: 5 };
const VAULT = 82;
const VAULT_ARRIVE = { x: 3, y: 22 };
const R37 = { x: 13, y: 9 };
const NOX3 = { x: 27, y: 14 };
const H30 = { x: 12, y: 7, remains: { x: 11, y: 4 } };
const ORB = { x: 32, y: 3 };
const H31 = { x: 6, y: 13 };
const OSSUARY = 22;
const OSSUARY_ARRIVE = { x: 13, y: 10 };
const R38 = { x: 27, y: 20 };
const BIG_DOOR = { x: 28, y: 21 };
const KING_ROOM = 83;
const KING_ARRIVE = { x: 13, y: 14 };
const KING = { x: 13, y: 7, troop: 412, escape: { x: 28, y: 20, d: 8 } };
const ORB_ROOM = 84;
const ORB_ARRIVE = { x: 8, y: 9 };
const PEDESTAL = { x: 8, y: 4 };
const RETURN_CIRCLE = { x: 10, y: 8 };
const ITEM = { bookmark: 403, slip: 404, page: 405, orb: 171 };
const WEAPON = { staff: 402 };
const ARMOR = { glasses: 403 };
const SKILL = { fire: 99 };
const FAST = 16;

await runTest(async () => {
  const game = await launchGame();
  try {
    await game.call("newGame");
    await game.waitScene("Scene_Map");
    await game.call("setSpeed", 2);
    await game.eval(() => {
      window.__rand = 0.5;
      Math.random = () => window.__rand;
      window.__log = { msgs: [], texts: [] };
      const add = Game_Message.prototype.add;
      Game_Message.prototype.add = function(text) {
        window.__log.msgs.push(text);
        return add.apply(this, arguments);
      };
      const addText = Window_BattleLog.prototype.addText;
      Window_BattleLog.prototype.addText = function(text) {
        window.__log.texts.push(text);
        return addText.apply(this, arguments);
      };
    });
    const setRand = v => game.eval(x => { window.__rand = x; }, v);
    const log = () => game.eval(() => window.__log);
    const pos = () => game.call("pos");
    const sw = id => game.eval(i => $gameSwitches.value(i), id);
    const items = (kind, id) => game.eval(([k, i]) => $gameParty.numItems((k === "a" ? $dataArmors : k === "w" ? $dataWeapons : $dataItems)[i]), [kind, id]);
    const hasLore = (kind, id) => game.eval(([k, i]) => /<hai_lore>\n[^<]+<\/hai_lore>/.test((k === "a" ? $dataArmors : k === "w" ? $dataWeapons : $dataItems)[i].note), [kind, id]);

    async function calm() {
      await game.eval(() => {
        for (const ev of $gameMap.events()) if (ev.event().meta.hai_enemy) $gameSelfSwitches.setValue([$gameMap.mapId(), ev.eventId(), "A"], true);
      });
      await game.frames(2);
    }
    async function arrive(m, x, y) {
      await game.waitFor(([m2, x2, y2]) => {
        const g = window.__game;
        const p = g.pos();
        return g.mapId() === m2 && (x2 === undefined || (p.x === x2 && p.y === y2)) && !g.isBusy();
      }, [m, x, y]);
      await calm();
    }
    async function go(m, x, y, d) {
      await game.call("transfer", m, x, y, d);
      await arrive(m, x, y);
    }
    async function step(d) {
      const moved = await game.call("step", d);
      if (moved) await game.waitPlayerStopped();
      return moved;
    }

    /**
     * 決定キーで調べ、イベントが終わるまで文章を読み進める（w_stage2b.mjs と同じ）。
     * 選択肢が出たら choices の順に選ぶ（番号、文字列。文字列は前方一致でもよい）。数値入力が出たら choices の次の { number } を入れる。
     */
    async function talk(choices = [], shots = {}, press = true) {
      const queue = choices.slice();
      if (press) await game.press("Enter");
      await game.waitFor(() => $gameMap.isEventRunning());
      const pages = [];
      for (;;) {
        await game.waitFor(() => {
          const w = SceneManager._scene._messageWindow;
          const c = w && w._choiceListWindow;
          const n = w && w._numberInputWindow;
          return !$gameMap.isEventRunning() || (w && w.pause) || (c && c.active && c.isOpen()) || (n && n.active) ||
            !(SceneManager._scene instanceof Scene_Map);
        });
        const st = await game.eval(() => {
          const w = SceneManager._scene._messageWindow;
          return {
            running: $gameMap.isEventRunning() && SceneManager._scene instanceof Scene_Map,
            choice: !!(w && w._choiceListWindow.active && w._choiceListWindow.isOpen()),
            number: !!(w && w._numberInputWindow.active),
            text: $gameMessage.allText(),
            choices: $gameMessage.choices(),
          };
        });
        if (!st.running) break;
        if (st.number) {
          const q = queue.shift();
          check(q && q.number !== undefined, `数値入力が出たが、入れる数が無い（${st.text}）`);
          pages.push(st.text + `［${q.number}］`);
          await game.eval(n => {
            const w = SceneManager._scene._messageWindow._numberInputWindow;
            w._number = n;
            w.refresh();
          }, q.number);
          await game.frames(5);
          await game.press("Enter");
        } else if (st.choice) {
          pages.push(st.text + "［" + st.choices.join("／") + "］");
          if (shots.choice) await game.shot(shots.choice);
          const q = queue.shift() ?? 0;
          const i = typeof q === "string" ? st.choices.findIndex(c => c === q || c.startsWith(q)) : q < 0 ? st.choices.length + q : q;
          check(i >= 0 && i < st.choices.length, `選択肢「${q}」が無い ${JSON.stringify(st.choices)}`);
          await game.eval(n => SceneManager._scene._messageWindow._choiceListWindow.select(n), i);
          await game.frames(2);
          await game.press("Enter");
        } else {
          pages.push(st.text);
          if (shots[pages.length - 1]) await game.shot(shots[pages.length - 1]);
          await game.frames(12);
          await game.press("Enter");
        }
        await game.waitFor(prev => {
          const w = SceneManager._scene._messageWindow;
          return !$gameMap.isEventRunning() || !(SceneManager._scene instanceof Scene_Map) || !w.pause || $gameMessage.allText() !== prev;
        }, st.text);
        await game.frames(2);
      }
      await game.frames(3);
      return pages;
    }

    /** 決定キーで調べて、プラグインが出す文章（隠し扉の発見など。イベントではない）を読み切る。 */
    async function inspectPlain() {
      await game.press("Enter");
      await game.waitFor(() => $gameMessage.isBusy());
      const texts = [];
      while (await game.eval(() => $gameMessage.isBusy())) {
        texts.push(await game.eval(() => $gameMessage.allText()));
        await game.waitFor(() => !$gameMessage.isBusy() || SceneManager._scene._messageWindow.pause);
        await game.frames(12);
        await game.press("Enter");
        await game.frames(4);
      }
      return texts;
    }

    // ---- 戦闘（w_stage2b.mjs と同じ） ----
    const waitInput = async () => {
      const t0 = Date.now();
      for (;;) {
        const st = await game.eval(() => {
          const s = SceneManager._scene;
          if (!(s instanceof Scene_Battle) || BattleManager.isBattleEnd() || BattleManager._escaped) return "end";
          if ($gameMessage.isBusy()) return "message";
          return BattleManager.isInputting() && s._partyCommandWindow.active ? "input" : "busy";
        });
        if (st === "end" || st === "input") return;
        if (st === "message") await game.press("Enter");
        else await game.frames(2);
        check(Date.now() - t0 < 180_000, "入力の番にならない");
      }
    };
    /** 1 ターン。plan[i] は i 番目の仲間の行動："guard"・"attack"・{ item }・{ skill }。 */
    const turn = async plan => {
      await game.call("setSpeed", FAST);
      await game.eval(p => {
        $gameParty.members().forEach((a, i) => {
          if (!a.action(0) && a.canMove()) a.makeActions();
          const act = a.action(0);
          if (!a.canInput() || !act) return;
          const want = p[i] || "guard";
          if (want === "guard") act.setGuard();
          else if (want === "attack") act.setAttack();
          else if (want.item) act.setItem(want.item);
          else act.setSkill(want.skill);
          act.setTarget(0);
        });
        BattleManager.startTurn();
        SceneManager._scene.changeInputWindow();
      }, plan);
      await waitInput();
      await game.call("setSpeed", 2);
    };
    const toMap = async () => {
      await game.call("setSpeed", FAST);
      await game.page.keyboard.down("Enter");
      try {
        await game.waitFor(() => window.__game.scene() === "Scene_Map", null, 120_000);
      } finally {
        await game.page.keyboard.up("Enter");
        await game.call("setSpeed", 2);
      }
      await game.waitFor(() => !window.__game.isBusy());
    };
    const finishEvent = async () => {
      const t0 = Date.now();
      for (;;) {
        const st = await game.eval(() =>
          window.__game.isBusy() ? "busy" : $gameMessage.isBusy() ? "message" : $gameMap.isEventRunning() ? "busy" : "done");
        if (st === "done") return;
        if (st === "message") await game.press("Enter");
        else await game.frames(2);
        check(Date.now() - t0 < 60_000, "イベントが終わらない");
      }
    };
    const boss = () => game.eval(() => {
      const e = $gameTroop.members()[0];
      return { id: e.enemyId(), hp: e.hp, mhp: e.mhp, alive: e.isAlive(), phase: Hai.Boss.phase(e), states: e.states().map(s => s.id) };
    });
    /** ボスに話しかけて（選択肢があれば一つ目を選んで）戦闘の入力の番まで進める。 */
    const startFight = async (m, x, y, d) => {
      await go(m, x, y, d);
      await game.eval(() => { $gameParty.members().forEach(a => a.recoverAll()); window.__log.msgs = []; window.__log.texts = []; });
      await game.press("Enter");
      const t0 = Date.now();
      while ((await game.call("scene")) !== "Scene_Battle") {
        const st = await game.eval(() => {
          const w = SceneManager._scene._messageWindow;
          return { busy: $gameMessage.isBusy(), choice: !!(w && w._choiceListWindow.active) };
        });
        if (st.choice) {
          await game.eval(() => SceneManager._scene._messageWindow._choiceListWindow.select(0));
          await game.frames(2);
          await game.press("Enter");
        } else if (st.busy) {
          await game.frames(12);
          await game.press("Enter");
        } else await game.frames(2);
        check(Date.now() - t0 < 60_000, "ボスに話しかけても戦闘にならない");
      }
      await waitInput();
    };
    /** 拠点の召喚陣で仲間を呼び戻す。 */
    const summon = async (name) => {
      await go(HALL, CIRCLE.x, CIRCLE.y, 2);
      const text = (await talk([0, name])).join("\n");
      check(text.includes(`${name}が目を開けた。`), `召喚陣で${name}が目を覚まさない ` + JSON.stringify(text));
    };

    // ===== 1. 063 の裏口 → 080 前庭と閲覧室 =====
    await game.eval(() => $gameSwitches.setValue(156, true)); // 焚刑官ハルトは W3 の検査（w_stage2b）で倒している
    await go(CHURCH, BACKDOOR.x, BACKDOOR.y + 1, 8);
    check((await talk()).join("").includes("閂が外れている"), "裏口の文章");
    await arrive(COURT, COURT_ARRIVE.x, COURT_ARRIVE.y);
    await game.shot("court-entrance");
    await go(COURT, R35.x, R35.y + 1, 8);
    check((await talk()).join("").includes("記録は嘘だった"), "R35 の本文");
    await go(COURT, NOX1.x, NOX1.y + 1, 8);
    const nox1 = (await talk()).join("\n");
    check(nox1.includes("点の字") && nox1.includes("ディルの記憶 1/4「生い立ち」"), "ノクスの記憶 1 " + JSON.stringify(nox1));
    await go(COURT, SHION1.x, SHION1.y + 1, 8);
    check((await talk()).join("").includes("アンセルモの記憶 1/4「生い立ち」"), "シオンの記憶 1");
    await go(COURT, BOOKMARK.x, BOOKMARK.y - 1, 2);
    await talk();
    check((await items("i", ITEM.bookmark)) === 1 && (await hasLore("i", ITEM.bookmark)), "長机で点の字の栞（来歴つき）が拾えない");
    await go(COURT, R34.x, R34.y + 1, 8);
    check((await talk()).join("").includes("棚の七、段の二、五冊目"), "R34 の本文");
    check(await game.eval(() => Hai.Thoughts.hasNote("clue:R34")), "R34 の手がかりがメモに無い");
    await go(COURT, H28.x + 1, H28.y, 4);
    await inspectPlain();
    check(await game.eval(([x, y]) => Hai.HiddenPassage.isFound(x, y), [H28.x, H28.y]), "H28 の隠し扉（本棚B）が開かない");
    await step(4);
    await step(4);
    await step(4);
    await talk();
    check((await items("w", WEAPON.staff)) === 1 && (await hasLore("w", WEAPON.staff)), "赤い宝箱で灰樫の杖が手に入らない");
    console.log("  前庭と閲覧室：裏口・R35・ノクスの記憶 1・シオンの記憶 1・点の字の栞・R34・H28 → 灰樫の杖");

    // ===== 2. 081 書架の迷路 =====
    await go(COURT, NORTH_DOOR.x, NORTH_DOOR.y + 1, 8);
    await game.call("step", 8);
    await arrive(MAZE, MAZE_ARRIVE.x, MAZE_ARRIVE.y);
    await game.shot("maze-entrance");
    await go(MAZE, WARP.x, WARP.y + 1, 8);
    await talk([-1]);
    check(await game.eval(() => Hai.Warp.visited().some(v => v.name === "古書院の写字室")), "写字室の結界を訪れたことにならない");
    await go(MAZE, SLIP.x, SLIP.y + 1, 8);
    await talk();
    check((await items("i", ITEM.slip)) === 1 && (await hasLore("i", ITEM.slip)), "写字室の机で夜の閲覧の札が拾えない");
    await go(MAZE, R36.x, R36.y + 1, 8);
    check((await talk()).join("").includes("司書が写しを取っていた"), "R36 の本文");
    await go(MAZE, NOX2.x, NOX2.y + 1, 8);
    check((await talk()).join("").includes("ディルの記憶 2/4「転機」"), "ノクスの記憶 2");
    // H29：迷路の南東の隅の苔から、東の石の壁の中を北へ（赤「書架の番人」の通路を通らずに北の廊下へ）
    await go(MAZE, H29.moss.x, H29.moss.y, 6);
    const route = [6, 6, ...Array(20).fill(8), 4];
    for (const d of route) check(await step(d), `H29 の途中で進めない ${JSON.stringify(await pos())}`);
    const h29 = await pos();
    check(h29.x === H29.end.x && h29.y === H29.end.y, "H29 を抜けた先 " + JSON.stringify(h29));
    check(await game.eval(() => Hai.HiddenPassage.isFound(37, 15)), "H29 が見つけたことにならない");
    await go(MAZE, LOCK.x, LOCK.y + 1, 8);
    check((await talk([{ number: 123 }])).join("").includes("違うようだ"), "番号錠に違う数で開いてしまう");
    check((await talk([{ number: 725 }])).join("").includes("錠が外れた"), "番号錠 725 で開かない");
    check(await step(8), "開いた鉄の扉を通れない");
    await step(8);
    await step(8);
    await game.call("step", 8);
    await arrive(VAULT, VAULT_ARRIVE.x, VAULT_ARRIVE.y);
    await game.shot("vault-entrance");
    console.log("  書架の迷路：結界・夜の閲覧の札・R36・ノクスの記憶 2・H29・番号錠 725 → 禁書庫");

    // ===== 3. 082 禁書庫 =====
    await go(VAULT, R37.x, R37.y + 1, 8);
    check((await talk()).join("").includes("背が少し奥にずれている"), "R37 の本文");
    check(await game.eval(() => Hai.Thoughts.hasNote("clue:R37")), "R37 の手がかりがメモに無い");
    await go(VAULT, NOX3.x, NOX3.y - 1, 2);
    const nox3 = await talk();
    check(nox3.join("\n").includes("ありがとうございます、先生") && nox3.join("").includes("ディルの記憶 3/4「罪か誇り」"), "ノクスの記憶 3 " + JSON.stringify(nox3));
    await go(VAULT, H30.x, H30.y + 1, 8);
    await inspectPlain();
    check(await game.eval(([x, y]) => Hai.HiddenPassage.isFound(x, y), [H30.x, H30.y]), "H30 の隠し扉が開かない");
    for (let i = 0; i < 3; i++) check(await step(8), `H30 の奥へ進めない ${JSON.stringify(await pos())}`);
    await go(VAULT, H30.remains.x + 1, H30.remains.y, 4);
    const body = (await talk([], { 1: "nox-remains" })).join("\n");
    check(body.includes("本は残る。誰かが、いつか読む。") && body.includes("名の壁の輪に置けば、この人を呼べる。"), "ノクスの遺骸 " + JSON.stringify(body));
    const nx = await game.eval(() => ({ sw133: $gameSwitches.value(133), memories: Hai.Companions.memories(7), complete: Hai.Companions.isComplete(7), var133: $gameVariables.value(133) }));
    check(nx.sw133 && nx.memories.length === 4 && nx.complete && nx.var133 === 4, "ノクスの遺骸と記憶 4 つ（完全体）" + JSON.stringify(nx));
    const orbs0 = await items("i", ITEM.orb);
    await go(VAULT, ORB.x, ORB.y + 1, 8);
    await talk();
    check((await items("i", ITEM.orb)) === orbs0 + 1, "禁書庫の奥で叡智のオーブが手に入らない");
    // H31：西の壁の扉の閂を外すと納骨所へ。以後は納骨所の側からも来られる
    await go(VAULT, H31.x + 1, H31.y, 4);
    await talk(["閂を外す"]);
    await arrive(OSSUARY, OSSUARY_ARRIVE.x, OSSUARY_ARRIVE.y);
    check(await sw(164), "閂を外してもスイッチ 164 が ON にならない");
    await game.shot("ossuary-h31");
    await game.call("step", 4);
    await arrive(VAULT, H31.x + 1, H31.y);
    await summon("ディル");
    check(await game.eval(() => $gameParty.members().some(a => a.actorId() === 7) && $gameSwitches.value(140)), "ノクスが加わらない");
    console.log(`  禁書庫：R37・ノクスの記憶 3・H30 → ノクスの遺骸（記憶 ${JSON.stringify(nx.memories)}、完全体）・叡智のオーブ・H31（スイッチ 164）・ノクスが加わった`);

    // ===== 4. 083 紙魚の王 =====
    await go(VAULT, R38.x, R38.y - 1, 2);
    check((await talk()).join("").includes("火を恐れる"), "R38 の本文");
    check(await game.eval(() => Hai.Thoughts.hasNote("clue:R38")), "R38 の手がかりがメモに無い");
    await go(VAULT, BIG_DOOR.x, BIG_DOOR.y - 1, 2);
    await game.call("step", 2);
    await arrive(KING_ROOM, KING_ARRIVE.x, KING_ARRIVE.y);
    await game.shot("king-room");
    // 4a. 逃げる → 禁書庫の大扉の前
    await startFight(KING_ROOM, KING.x, KING.y + 1, 8);
    check((await log()).msgs.includes("――紙魚の王――"), "戦闘の頭に紙魚の王の名前が出ない");
    await game.shot("king-battle");
    await setRand(0.01);
    await game.eval(() => SceneManager._scene.commandEscape());
    await toMap();
    await setRand(0.5);
    await finishEvent();
    const esc = await game.eval(() => ({ map: $gameMap.mapId(), pos: window.__game.pos(), sw: $gameSwitches.value(152) }));
    check(esc.map === VAULT && esc.pos.x === KING.escape.x && esc.pos.y === KING.escape.y && esc.pos.d === KING.escape.d && !esc.sw,
      "紙魚の王から逃げたときの場所と旗 " + JSON.stringify(esc));
    // 4b. 戦う：ノクスのファイア（炎 200%）、沈黙・眠りが効かない、HP 50% で紙魚を 2 体
    await startFight(KING_ROOM, KING.x, KING.y + 1, 8);
    const resist = await game.eval(() => { const e = $gameTroop.members()[0]; return [146, 6, 142, 10].map(id => e.isStateResist(id)); });
    check(resist.every(Boolean), "紙魚の王に沈黙・眠りが効く " + JSON.stringify(resist));
    const noxAt = await game.eval(() => $gameParty.members().findIndex(a => a.actorId() === 7));
    const heal = () => game.eval(() => $gameParty.members().forEach(a => a.recoverAll()));
    const firePlan = () => { const p = ["guard", "guard", "guard"]; p[noxAt] = { skill: SKILL.fire }; return p; };
    let b = await boss();
    await heal();
    await turn(firePlan());
    let b2 = await boss();
    check(b2.hp < b.hp, `ノクスのファイアが紙魚の王に当たらない ${b.hp} → ${b2.hp}`);
    check((await log()).texts.includes("紙魚の王は炎に弱いようだ。"), "炎の弱点のヒントが出ない " + JSON.stringify((await log()).texts));
    await game.eval(() => { const e = $gameTroop.members()[0]; e.setHp(Math.floor(e.mhp * 0.49)); });
    await heal();
    await turn(["guard", "guard", "guard"]);
    const split = await game.eval(() => $gameTroop.members().slice(1).map(e => e.isAppeared()));
    check(split.length === 2 && split.every(Boolean) && (await log()).msgs.some(m => m.includes("紙魚が這い出した")), "HP 50% で紙魚を呼ばない " + JSON.stringify(split));
    await game.shot("king-split");
    await game.eval(() => $gameTroop.members()[0].setHp(50));
    // 頁を喰う（2 ターンごと）で SP を奪われたターンはファイアが出ないので、倒れるまで数ターン
    for (let i = 0; i < 4 && (await game.eval(() => !BattleManager.isBattleEnd() && $gameTroop.members()[0].isAlive())); i++) {
      await heal();
      await turn(firePlan());
    }
    await game.waitFor(() => !(SceneManager._scene instanceof Scene_Battle) || BattleManager.isBattleEnd() || $gameMessage.isBusy(), null, 60_000);
    await toMap();
    await finishEvent();
    const won = await game.eval(tr => ({ sw: $gameSwitches.value(152), defeated: Hai.Boss.defeated(tr), msgs: window.__log.msgs }), KING.troop);
    check(won.sw && won.defeated, "紙魚の王を倒したのに旗が立たない " + JSON.stringify(won));
    check(won.msgs.some(m => m.includes("頁の山の奥へ散っていった")), "王を失った紙魚が散らない " + JSON.stringify(won.msgs));
    check((await items("a", ARMOR.glasses)) === 1 && (await items("i", ITEM.page)) === 1 && (await hasLore("i", ITEM.page)), "紙魚の王の固定ドロップ（司書の眼鏡・焼け残りの頁）が無い");
    console.log("  紙魚の王：逃走・沈黙と眠りが効かない・ファイアで炎のヒント・HP 50% で紙魚 2 体・撃破（スイッチ 152）・司書の眼鏡と焼け残りの頁");

    // ===== 5. 084 オーブの間「聖灰」 =====
    await go(KING_ROOM, 13, 4, 8);
    await game.call("step", 8);
    await arrive(ORB_ROOM, ORB_ARRIVE.x, ORB_ARRIVE.y);
    await game.shot("orb-room");
    const orbCount = await game.eval(() => $gameVariables.value(101));
    await go(ORB_ROOM, PEDESTAL.x, PEDESTAL.y + 1, 8);
    const scene = (await talk([], { 1: "orb-ash-scene", 3: "orb-ash-yuel" })).join("\n");
    check(scene.includes("聖女さまの灰だよ") && scene.includes("誰も、見ていない。") && scene.includes("あの匙を、覚えている") &&
      scene.includes("オーブ「聖灰」を取り戻した"), "オーブ「聖灰」の場面 " + JSON.stringify(scene));
    const got = await game.eval(() => ({ sw102: $gameSwitches.value(102), v101: $gameVariables.value(101), sw105: $gameSwitches.value(105) }));
    check(got.sw102 && got.v101 === orbCount + 1 && !got.sw105, "オーブ「聖灰」の旗 " + JSON.stringify(got));
    check((await talk()).join("").includes("台座は空だ"), "取った後の台座");
    // 4 つ目のオーブだったとき（ほかの 3 つを先に取っていた）：105・106 とユエルの一言（11.4）
    await game.eval(() => { $gameSwitches.setValue(102, false); $gameVariables.setValue(101, 3); });
    const fourth = (await talk()).join("\n");
    const four = await game.eval(() => ({ v101: $gameVariables.value(101), sw105: $gameSwitches.value(105), sw106: $gameSwitches.value(106) }));
    check(four.v101 === 4 && four.sw105 && four.sw106 && fourth.includes("全部、思い出した"), "4 つ目のオーブのとき " + JSON.stringify(four));
    await game.eval(() => { $gameSwitches.setValue(105, false); $gameSwitches.setValue(106, false); $gameVariables.setValue(101, 1); });
    await go(ORB_ROOM, RETURN_CIRCLE.x, RETURN_CIRCLE.y + 1, 8);
    await game.call("step", 8);
    await arrive(HALL, 16, 18);
    console.log("  オーブの間：場面（スイッチ 102・変数 101）・4 つ目なら 105・106・帰りの転送陣で牢獄の間へ");

    // ===== 6. セーブ・ロード =====
    await game.call("save", 1);
    await game.call("goToTitle");
    await game.waitScene("Scene_Title");
    await game.call("load", 1);
    await game.waitScene("Scene_Map");
    const loaded = await game.eval(() => ({
      map: $gameMap.mapId(), pos: window.__game.pos(), sw102: $gameSwitches.value(102), sw152: $gameSwitches.value(152), sw164: $gameSwitches.value(164),
      party: $gameParty.members().map(a => a.actorId()), found: Hai.HiddenPassage.isFound(12, 7, 82),
    }));
    check(loaded.map === HALL && loaded.pos.x === 16 && loaded.pos.y === 18 && loaded.sw102 && loaded.sw152 && loaded.sw164 && loaded.party.includes(7) && loaded.found,
      "ロードの後の状態 " + JSON.stringify(loaded));
    console.log("  セーブ・ロード：旗（102・152・164）・ノクスの加入・見つけた隠し扉が残る");

    game.assertNoErrors();
  } finally {
    await game.close();
  }
});
