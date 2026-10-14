// W6（#144）黒鉄の砦（docs/world.md 3.4・4 章、tools/maps/src/w6_*）の検査。目覚めから最初の数分を通しで動かす：
//   ニューゲーム（目覚めの場面を見る）→ 墓所の床で目覚め、名前の欄が「墓守」→ 灰の足跡 → 最初の残留思念（K01）→
//   墓所の壁の書き付け（目的のメモ）→ 薄い思念 F01 と記憶の一言 → 大広間の炉に火を入れる（全滅の戻り先・結界の選択肢）→
//   シャノが柱の陰から出てきて話す（倉が開く・生き残りの数・メモ 2 つ）→ 開いた倉の扉から倉（013）へ行って戻る →
//   名の壁の輪 → 閉じた扉（崩れた扉・鉄扉）→ 城壁の上（019）の頂への門 → 外門への階段から霧の森（020）へ。
// 置き場所はイベントの名前で引く（座標は tools/maps/src/w6_010_keep.txt。文字マップを直してもテストを直さなくてよいように）。
import fs from "node:fs";
import path from "node:path";
import { launchGame, check, runTest, ROOT } from "./lib.mjs";
import { checkAll } from "../tools/data/check.mjs";

const KEEP = 10;
const readMap = id => JSON.parse(fs.readFileSync(path.join(ROOT, "data", `Map${String(id).padStart(3, "0")}.json`), "utf8"));
const keep = readMap(KEEP);
const ev = name => {
  const e = keep.events.find(e => e && e.name === name);
  if (!e) throw new Error(`Map010 に「${name}」が無い`);
  return e;
};
const system = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "System.json"), "utf8"));
const START = { x: system.startX, y: system.startY };

await runTest(async () => {
  // ---- 0. データ：開始位置・旗の名前・場所移動の行き先（ブラウザの前に）
  check(system.startMapId === KEEP, `開始マップ ${system.startMapId}`);
  const problems = checkAll();
  check(problems.length === 0, `データの検査:\n${problems.join("\n")}`);
  for (const [id, name] of [[111, "目覚めた"], [112, "炉に火を入れた"], [113, "名の壁を調べた"], [114, "営倉の鉄扉:開"], [172, "シャノが砦にいる"]]) {
    check(system.switches[id] === name, `スイッチ ${id} の名前「${system.switches[id]}」`);
  }
  check(system.variables[103] === "生き残りの数", `変数 103 の名前「${system.variables[103]}」`);
  // W18（#258）：グィドの一言を 052 と同じにしない（R2 気になる 24）、ディルの夜は「〜には聞こえなかった」でなく動作の行（7 章の癖）
  const textOf = e => e.pages.flatMap(p => p.list.filter(c => c.code === 401).map(c => c.parameters[0])).join("\n");
  check(!textOf(ev("W17 グィドの数え歌（自動）")).includes("じいさんが言うなと"), "010 のグィドが 052 と同じ一言");
  check(!textOf(ev("食卓（ディルの夜）")).includes("には聞こえなかった"), "ディルの夜に「〜には聞こえなかった」が残っている");
  // 食卓・梁の場面は自動実行でなく、大広間の見張り（並列）が始める（R2 困る 6）
  for (const name of ["食卓（ノラの夜）", "食卓（ディルの夜）", "W17 ゼリナの椀（自動）", "W17 ベルトランとピピネル（自動）", "W17 トゥーラとシャノ（自動）", "W17 ゼリナとアンセルモ（自動）", "W17 グィドの数え歌（自動）"]) {
    check(ev(name).pages.every(p => p.trigger !== 3), `${name} が自動実行のまま（大広間の外でも出る）`);
  }
  check(ev("W18 大広間の見張り（並列。食卓の場面を始める）").pages[0].trigger === 4, "大広間の見張りが並列でない");
  // W26（#294。R3 困る 4）：マルゴ（一度目・取り引き・二度目）とアデルの講義も、大広間の見張りが始める。順はマルゴ→講義
  for (const name of ["マルゴ", "アデルの講義"]) check(ev(name).pages.every(p => p.trigger !== 3), `${name} が自動実行のまま（大広間の外でも出る）`);
  const watchScript = ev("W18 大広間の見張り（並列。食卓の場面を始める）").pages[0].list.filter(c => c.code === 355 || c.code === 655).map(c => c.parameters[0]).join("\n");
  const order = (watchScript.match(/\[([\d, ]+)\]\.map/) || [])[1];
  check(order && order.replace(/ /g, "").startsWith(`${keep.events.findIndex(e => e && e.name === "マルゴ")},${keep.events.findIndex(e => e && e.name === "アデルの講義")},`), "大広間の見張りの並び " + order);
  // W26（R3 気になる 3・4・12）：墓守の「鳴った」に名前の欄、起きている椀の文、結末のグィドの一言を 052 と同じにしない
  const mir = ev("W14 ミルレーネが砦に来る（三つ目の鐘の夜。自動）").pages.flatMap(p => p.list);
  const rang = mir.findIndex(c => c.code === 401 && c.parameters[0].includes("鳴った") && !c.parameters[0].includes("三つ"));
  check(rang > 0 && mir[rang - 1].code === 101 && mir[rang - 1].parameters[4] === "\\N[1]", "ミルレーネが砦に来る：墓守の「鳴った」の名前の欄");
  check(textOf(ev("伏せた椀")).includes("奥の席の椀は、起きている。"), "起こしてある椀の文が無い");
  check(ev("伏せた椀").pages[1].list.filter(c => c.code === 401).every(c => !c.parameters[0].includes("伏せた椀を起こす")), "起こしてある椀のページに「伏せた椀を起こす」が残っている");
  check(textOf(ev("ヴォルフラム（炉の前）")).includes("起きとるなら、起きたままにしとく"), "ヴォルフラムの起きている椀の一言が無い");
  check(!textOf(ev("W14 結末の夜と朝（自動）")).includes("じいさんが言うなと"), "結末のグィドが 052 と同じ一言");
  // 職業名（持-6。番号は変えない）
  const classes = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "Classes.json"), "utf8"));
  for (const [id, name] of [[1, "使徒狩り"], [2, "写字生"], [3, "司祭"], [4, "鐘の騎士"], [5, "獣人"], [7, "酒保"], [10, "墓守"]]) {
    check(classes[id].name === name, `職業 ${id} の名前「${classes[id].name}」`);
  }
  // 前の世界の砦の物（セレス・オーブ・ユエル）が残っていない
  const keepText = JSON.stringify(keep);
  for (const old of ["セレス", "オーブ", "ユエル", "牢獄の間", "魔石"]) check(!keepText.includes(old), `Map010 に前の世界の「${old}」が残っている`);
  for (const id of [11, 12, 13, 14, 19]) {
    const t = JSON.stringify(readMap(id));
    for (const old of ["セレス", "オーブ", "ユエル", "牢獄の間", "魂の間", "創作者", "保管ゲート", "理知の間"]) check(!t.includes(old), `Map0${id} に前の世界の「${old}」が残っている`);
  }

  const game = await launchGame();
  const pos = () => game.call("pos");
  const mapId = () => game.call("mapId");
  const messageBusy = () => game.eval(() => window.__game.ref("$gameMessage").isBusy());
  const switchOn = id => game.eval(i => window.__game.ref("$gameSwitches").value(i), id);
  const variable = id => game.eval(i => window.__game.ref("$gameVariables").value(i), id);
  const hasNote = id => game.eval(i => window.Hai.Thoughts.hasNote(i), id);

  async function arrive(m) {
    await game.waitFor(m2 => window.__game.mapId() === m2 && !window.__game.isBusy(), m);
  }
  async function go(m, x, y, d) {
    await game.call("transfer", m, x, y, d);
    await game.waitFor(([m2, x2, y2]) => {
      const g = window.__game;
      const p = g.pos();
      return g.mapId() === m2 && p.x === x2 && p.y === y2 && !g.isBusy();
    }, [m, x, y]);
  }
  async function step(d) {
    const moved = await game.call("step", d);
    if (moved) await game.waitPlayerStopped();
    return moved;
  }

  /** 出ている文章をすべて読んで閉じ（選択肢は先頭を選ぶ）、イベントが終わるまで待つ。各ページの中身を返す。 */
  async function readMessages(shotLabel) {
    const pages = [];
    for (;;) {
      await game.waitFor(() => {
        const s = window.__game.ref("SceneManager")._scene;
        const m = window.__game.ref("$gameMessage");
        if (m.isBusy()) return (s._messageWindow && s._messageWindow.pause) || (m.isChoice() && s._choiceListWindow && s._choiceListWindow.active);
        return !window.__game.ref("$gameMap").isEventRunning();
      });
      if (!(await messageBusy())) break;
      const text = await game.eval(() => {
        const m = window.__game.ref("$gameMessage");
        return (m.speakerName() ? m.speakerName() + "「" : "") + m.allText() + (m.isChoice() ? `［${m.choices().join("／")}］` : "");
      });
      pages.push(text);
      if (shotLabel && pages.length === 1) await game.shot(shotLabel);
      await game.frames(12);
      await game.press("Enter");
      await game.waitFor(prev => {
        const m = window.__game.ref("$gameMessage");
        const now = (m.speakerName() ? m.speakerName() + "「" : "") + m.allText() + (m.isChoice() ? `［${m.choices().join("／")}］` : "");
        return !m.isBusy() || now !== prev;
      }, text);
      await game.waitFor(() => window.__game.ref("$gameMessage").isBusy() || !window.__game.ref("$gameMap").isEventRunning());
      if (!(await messageBusy())) break;
    }
    await game.waitFor(() => !window.__game.ref("$gameMap").isEventRunning());
    await game.frames(3);
    return pages;
  }
  /** (x,y) に立って d を向き、決定キーで調べて文章を読み切る。 */
  async function investigate(x, y, d, shotLabel) {
    await go(KEEP, x, y, d);
    await game.press("Enter");
    await game.waitFor(() => window.__game.ref("$gameMessage").isBusy());
    return readMessages(shotLabel);
  }
  const has = (pages, s) => pages.some(p => p.includes(s));

  try {
    await game.call("setSpeed", 3);

    // ---- 1. 目覚め：墓所の床。黒から始まり、鈴の一行。名前の欄は「墓守」
    await game.call("newGame", { opening: true });
    await game.waitScene("Scene_Map");
    await game.waitFor(() => window.__game.ref("$gameMessage").isBusy());
    check((await mapId()) === KEEP, `開始マップ ${await mapId()}`);
    const p0 = await pos();
    check(p0.x === START.x && p0.y === START.y, `開始位置 ${JSON.stringify(p0)}`);
    const wake = await readMessages("wake");
    check(wake.length === 1 && wake[0].includes("床の小さな鈴が、まだ揺れている。"), `目覚めの文 ${JSON.stringify(wake)}`);
    check(await switchOn(111), "目覚めのあとスイッチ 111（目覚めた）が ON でない");
    const actor = await game.eval(() => { const a = window.__game.ref("$gameActors").actor(1); return { name: a.name(), nick: a.nickname() }; });
    check(actor.name === "墓守" && actor.nick === "墓守", `名前の欄 ${JSON.stringify(actor)}`);
    check((await game.eval(() => window.__game.ref("$gameScreen").brightness())) === 255, "目覚めのあと画面が暗いまま");

    // ---- 2. 灰の足跡：墓所の戸口へ歩くと一度だけ出る
    const fp = ev("灰の上の足跡");
    await go(KEEP, fp.x - 1, fp.y, 6);
    await step(6);
    await game.waitFor(() => window.__game.ref("$gameMessage").isBusy());
    const prints = await readMessages();
    check(has(prints, "裸足の小さな足跡"), `足跡の文 ${JSON.stringify(prints)}`);
    check(await switchOn(173), "足跡のあとスイッチ 173 が ON でない");

    // ---- 3. 最初の残留思念（棺の一つ）
    const k01 = ev("思念 K01 婚礼の歌を覚えたい父親");
    const song = await investigate(k01.x, k01.y - 1, 2, "thought-k01");
    check(has(song, "娘の婚礼の歌") && has(song, "墓守さん、続きを聞いといてくれ。"), `K01 の文 ${JSON.stringify(song)}`);
    check(await game.eval(() => window.Hai.Thoughts.isRead("K01")), "K01 が読んだことにならない");

    // ---- 4. 墓所の壁の書き付け：目的のメモ
    const w = ev("墓所の壁の書き付け");
    const writing = await investigate(w.x, w.y + 1, 8, "writing");
    check(has(writing, "「四つの鐘を鳴らして。\nそれから、山の頂の鐘楼へ」") && has(writing, "最後の一画が、途中で止まっている。"), `書き付け ${JSON.stringify(writing)}`);
    check(has(writing, "メモ："), "書き付けのメモの行が出ない");
    check(await hasNote("goal:bells"), "目的のメモが無い");
    check(await switchOn(171), "書き付けのあとスイッチ 171 が ON でない");
    const again = await investigate(w.x, w.y + 1, 8);
    check(!has(again, "メモ："), "二度目にもメモの行が出た");

    // ---- 5. 薄い思念 F01：暗くなって場面、初めての記憶の一言（コモンイベント 201）
    const f01 = ev("薄い思念 F01 墓所の番の老人");
    const scene = await investigate(f01.x, f01.y + 1, 8, "faint-f01");
    check(has(scene, "壁の釘から外套を取った") && has(scene, "この人の葬式を出した"), `F01 ${JSON.stringify(scene)}`);
    check((await variable(138)) === 1, `戻った記憶の数 ${await variable(138)}`);
    const scene2 = await investigate(f01.x, f01.y + 1, 8);
    check(!has(scene2, "葬式を出した"), "読み直しで一言がまた出た");

    // ---- 6. 炉に火を入れる → シャノ
    const hearth = ev("砦の炉");
    const home = ev("シャノ（食卓）"); // 食卓のシャノ（会う前は見えない）
    check(!(await game.eval(id => !!window.__game.ref("$gameMap").event(id).characterName(), home.id)), "会う前から食卓にシャノがいる");
    const fire = await investigate(hearth.x, hearth.y + 1, 8, "hearth-cold");
    check(has(fire, "炉は冷えている") && has(fire, "［火を入れる／やめる］"), `炉の文 ${JSON.stringify(fire)}`);
    check(has(fire, "炉に火が入った。"), "火を入れた文が出ない");
    const shanoLines = fire.filter(p => p.startsWith("シャノ「"));
    check(shanoLines.length === 8, `シャノの台詞の数 ${shanoLines.length}: ${JSON.stringify(shanoLines)}`);
    check(has(fire, "鈴、蹴っちゃった") && has(fire, "砦の地下の牢の鐘") && has(fire, "ここ、ちょっといていい？"), `シャノの台詞 ${JSON.stringify(shanoLines)}`);
    // W15（#231）：夜の戸の忠告と、席に着いてからの一言（「……ここ」の「……」は取った）
    check(has(fire, "夜は戸ぇ開けんなよ") && has(fire, "椅子に座るの、久しぶり") && !has(fire, "……ここ、ちょっと"), `シャノの台詞（W15） ${JSON.stringify(shanoLines)}`);
    check(has(fire, "さっき誰と話してたの？"), "K01 を読んだのに「誰と話してたの」が出ない");
    check(await switchOn(112), "スイッチ 112（炉に火を入れた）が ON でない");
    check(await switchOn(172), "スイッチ 172（シャノが砦にいる）が ON でない");
    check(await switchOn(123), "倉（スイッチ 123）が開いていない");
    check(await game.eval(() => window.Hai.Facilities.isOpen("gate")), "倉が開いていない（Hai.Facilities）");
    check((await variable(103)) === 1, `生き残りの数 ${await variable(103)}`);
    check((await hasNote("shano:bell")) && (await hasNote("shano:cook")), "シャノのメモ 2 つが無い");
    const defeatHome = await game.eval(() => window.Hai.Defeat.home());
    check(defeatHome.mapId === KEEP && defeatHome.x === hearth.x && defeatHome.y === hearth.y + 1, `全滅の戻り先 ${JSON.stringify(defeatHome)}`);
    await game.frames(10);
    check(await game.eval(id => !!window.__game.ref("$gameMap").event(id).characterName(), home.id), "会ったあと食卓にシャノがいない");
    await game.shot("shano-at-table");

    // 炉の火（結界の選択肢）：休むで全回復。SP も戻り、「SP が戻った。」が出る（W18 #258。持-7）
    await game.eval(() => { const a = window.__game.ref("$gameActors").actor(1); a.setHp(1); a.setTp(0); });
    const rest = await investigate(hearth.x, hearth.y + 1, 8);
    check(has(rest, "砦の炉が静かに光っている。") && has(rest, "休む"), `炉の結界の選択肢 ${JSON.stringify(rest)}`);
    check(await game.eval(() => { const a = window.__game.ref("$gameActors").actor(1); return a.hp === a.mhp; }), "休むで回復しない");
    check(await game.eval(() => { const a = window.__game.ref("$gameActors").actor(1); return a.tp === a.maxTp(); }), "休むで SP が戻らない");
    check(rest.at(-1) === "SP が戻った。", `休んだあとの最後の一行 ${JSON.stringify(rest)}`);

    // 食卓のシャノに話しかける
    const talk = await investigate(home.x, home.y + 1, 8);
    check(talk.length >= 1 && talk.every(t => t.startsWith("シャノ「")) && has(talk, "頭に褒められる"), `食卓のシャノ ${JSON.stringify(talk)}`);

    // ---- 7. 開いた倉の扉 → 倉（013）→ 戻る
    const store = ev("倉の扉");
    await go(KEEP, store.x, store.y + 1, 8);
    await step(8);
    await arrive(13);
    const inStore = await pos();
    check(inStore.x === 8 && inStore.y === 11, `倉に着いた所 ${JSON.stringify(inStore)}`);
    await game.shot("store");
    await step(2);
    await arrive(KEEP);
    const back = await pos();
    check(back.x === store.x && back.y === store.y + 1, `倉から戻った所 ${JSON.stringify(back)}`);
    // 閉じた部屋（稽古場）は崩れた扉
    const drill = ev("稽古場の扉");
    const shut = await investigate(drill.x, drill.y + 1, 8);
    check(has(shut, "扉が崩れて、瓦礫で塞がっている。"), `閉じた稽古場の扉 ${JSON.stringify(shut)}`);

    // ---- 8. 名の壁と輪
    const kw = ev("名の壁（墓守の欄）");
    const column = await investigate(kw.x, kw.y + 1, 8, "name-wall");
    check(has(column, "「墓守」と彫った欄") && has(column, "削られている"), `墓守の欄 ${JSON.stringify(column)}`);
    const ring = ev("名の壁の輪");
    const dark = await investigate(ring.x, ring.y - 1, 2);
    check(has(dark, "輪は暗いままだ"), `呼べる人がいない輪 ${JSON.stringify(dark)}`);
    check(await switchOn(113), "スイッチ 113（名の壁を調べた）が ON でない");

    // ---- 8b. W18（#258。R2 困る 6）：輪で仲間を呼んだ直後は名乗りだけ。食卓の場面は大広間に入ってから
    const setSw = (id, on = true) => game.eval(([i, v]) => window.__game.ref("$gameSwitches").setValue(i, v), [id, on]);
    await setSw(117); // 先に盛る一椀
    await game.eval(() => window.__game.ref("$gameParty").addActor(6)); // ノラ
    await setSw(139); // 加入:ノラ（輪で呼んだ）
    await game.waitFor(() => window.__game.ref("$gameMessage").isBusy());
    const named = await readMessages();
    check(has(named, "ノラ。狩りの家の、上の娘") && !has(named, "ヴォルフラムの腕"), `輪のあとのノラ ${JSON.stringify(named)}`);
    await game.frames(30);
    check(!(await game.eval(() => window.__game.ref("$gameMap").isEventRunning())) && !(await messageBusy()), "名の壁の前で食卓の場面が出た");
    await game.call("transfer", KEEP, 21, 28, 2); // 大広間の食卓の脇
    await game.waitFor(() => window.__game.ref("$gameMessage").isBusy());
    const noraTable = await readMessages("hall-nora");
    check(has(noraTable, "ノラの前を、ヴォルフラムの腕が通った。") && has(noraTable, "あっちのは？"), `大広間のノラの夜 ${JSON.stringify(noraTable)}`);
    await game.frames(30);
    check(!(await messageBusy()), "ノラの夜が二度出た");

    // 梁の上のシャノ（営倉の鐘のあと）：隣のマスから調べて話せる（R2 気になる 21）
    await setSw(101);
    const beam = await investigate(ev("シャノ（柱の陰）").x, ev("シャノ（柱の陰）").y + 1, 8, "beam-shano");
    check(has(beam, "梁の上まで登った"), `梁の上のシャノ ${JSON.stringify(beam)}`);

    // 伏せた椀を起こしてある（116）：ゼリナは「伏せたまま」と言わず、三つ目の鐘の夜にヴォルフラムは椀を起こさない（R2 困る 9）
    await setSw(116);
    await setSw(141); // 加入:ゼリナ
    const zelina = ev("W17 ゼリナ（食卓）");
    const z1 = await investigate(zelina.x, zelina.y - 1, 2);
    check(has(z1, "あの椀、起きとるな") && !has(z1, "伏せたまま"), `起こしてある椀のゼリナ ${JSON.stringify(z1)}`);
    await setSw(122); // ヴォルフラムが砦にいる（食堂）
    await setSw(106); // 三つ目の鐘の場面
    await game.waitFor(() => window.__game.ref("$gameMessage").isBusy());
    const filled = await readMessages("bowl-filled");
    check(has(filled, "ヴォルフラムは、起きている椀を取った。") && !has(filled, "椀を起こした。") && has(filled, "飯が盛られた。"), `起こしてある椀に飯が盛られる ${JSON.stringify(filled)}`);
    check(await switchOn(1151), "椀に飯が盛られたあとスイッチ 1151 が ON でない");
    // ゼリナの夢（場面表 04 の 2.2。7 章 04:130）：1151 のあと一度だけ。以後は差し替えの一言
    const dream = await investigate(zelina.x, zelina.y - 1, 2);
    check(has(dream, "舟の金、まだ足りへん夢を見た") && has(dream, "なんで足りへんのやろな"), `ゼリナの夢 ${JSON.stringify(dream)}`);
    const z2 = await investigate(zelina.x, zelina.y - 1, 2);
    check(has(z2, "奥の椀にも、盛ってあるな") && !has(z2, "夢を見た") && !has(z2, "伏せたまま"), `夢のあとのゼリナ ${JSON.stringify(z2)}`);

    // ---- 9. 営倉への鉄扉：表からは開かない。向こう側から閂を外した（スイッチ 114）あとは営倉（033）へ
    const iron = ev("営倉への鉄扉");
    const locked = await investigate(iron.x, iron.y + 1, 8);
    check(has(locked, "押しても引いても動かない") && has(locked, "向こう側に閂"), `鉄扉 ${JSON.stringify(locked)}`);
    await game.eval(() => window.__game.ref("$gameSwitches").setValue(114, true));
    await go(KEEP, iron.x, iron.y + 1, 8);
    await game.frames(5);
    await step(8);
    await arrive(33);
    await go(KEEP, iron.x, iron.y + 1, 2);

    // ---- 10. 城壁の上（019）：頂への門は四つの鐘が鳴るまで通れない。下り階段で砦へ戻る
    const up = ev("城壁へ上る階段");
    await go(KEEP, up.x, up.y + 1, 8);
    await step(8);
    await arrive(19);
    await game.shot("rampart");
    const rampart = readMap(19);
    const gate = rampart.events.find(e => e && e.name === "頂への門");
    await go(19, gate.x, gate.y + 1, 8);
    await game.press("Enter");
    await game.waitFor(() => window.__game.ref("$gameMessage").isBusy());
    const summit = await readMessages("summit-gate");
    check(has(summit, "灰と霧で、一歩先も見えない"), `頂への門 ${JSON.stringify(summit)}`);
    const down = rampart.events.find(e => e && e.name === "砦の中へ（下り階段）");
    await go(19, down.x + 1, down.y, 4);
    await step(4);
    await arrive(KEEP);
    const fromWall = await pos();
    check(fromWall.x === up.x && fromWall.y === up.y + 1, `城壁から戻った所 ${JSON.stringify(fromWall)}`);

    // ---- 11. 外へ：門の内側の凹みを見て、外門への階段から霧の森へ
    const dents = ev("門の内側の凹み");
    const three = await investigate(dents.x, dents.y + 1, 8);
    check(has(three, "拳ほどの凹みが三つ"), `門の凹み ${JSON.stringify(three)}`);
    const out = ev("外の霧の森へ（外門への階段）");
    await go(KEEP, out.x, out.y + 1, 8);
    await step(8);
    await arrive(20);
    check((await mapId()) === 20, "外門への階段で霧の森（020）へ出られない");
    // 森の下り階段で砦に戻ると、外門への階段の前に着く
    const forest = readMap(20);
    const stairs = forest.events.find(e => e && e.pages.some(p => p.list.some(c => c.code === 201 && c.parameters[1] === KEEP)));
    const cmd = stairs.pages[0].list.find(c => c.code === 201);
    check(cmd.parameters[2] === out.x && cmd.parameters[3] === out.y + 1, `森から砦へ戻る行き先 ${JSON.stringify(cmd.parameters)}`);

    game.assertNoErrors();
  } finally {
    await game.close();
  }
});
