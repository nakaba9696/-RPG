// P3 残留思念と自動メモ（js/plugins/Hai_Thoughts.js）の検査（P17・P20：割り込まれたら既読にしない）。見本のマップ Map904（tools/maps/src/p3_thoughts）で：
//   読むと既読になり、セルフスイッチ A が入り、unreadCount が減る／もう一度読むと本文が薄く暗く出る（P21。印は付かない。
//   あとのメモの行・次の文章は元の明るさ。文章の窓に描いた字のいちばん明るい点で測る）／
//   手がかりがメモに入る（二度読んでも増えない。1 つの思念に 2 つ）／鍵なしで扉を調べるとメモに入り（二度でも 1 行）、
//   鍵を持つと開いて通れる／ほかのマップからも unreadCount が読める／セーブ・ロード（ページの読み直しをはさむ）の後も
//   既読とメモが残る。読んでいる画面と既読の表示のスクリーンショットを撮る。
import { launchGame, check, runTest } from "./lib.mjs";

const MAP = 904;
const SLOT = 4;
// 地図の座標（tools/maps/src/p3_thoughts.txt）
const R13 = { x: 3, y: 6, id: "R13", eventId: 1 }; // a：手がかりなし
const R10 = { x: 8, y: 6, id: "R10", eventId: 2 }; // b：手がかり 2 つ、2 ページ
const P3C = { x: 7, y: 9, id: "P3c", eventId: 3 }; // c：手がかり（隠し扉の示唆）
const KEY_CHEST = { x: 4, y: 3 };
const LOCKED = { x: 10, y: 8, eventId: 5 };
const HIDDEN_DOOR = { x: 5, y: 5 };
const KEY_ID = 121;

await runTest(async () => {
  const game = await launchGame();
  const th = (fn, ...args) => game.eval(([f, a]) => window.Hai.Thoughts[f](...a), [fn, args]);
  const pos = () => game.call("pos");

  async function go(x, y, d, mapId = MAP) {
    await game.call("transfer", mapId, x, y, d);
    await game.waitFor(([m, x2, y2]) => {
      const g = window.__game;
      const p = g.pos();
      return g.mapId() === m && p.x === x2 && p.y === y2 && !g.isBusy();
    }, [mapId, x, y]);
  }

  /** 1 歩。動けたら止まるまで待つ。 */
  async function step(d) {
    const moved = await game.call("step", d);
    if (moved) await game.waitPlayerStopped();
    return moved;
  }

  const messageBusy = () => game.eval(() => window.__game.ref("$gameMessage").isBusy());
  const messageText = () => game.eval(() => window.__game.ref("$gameMessage").allText());
  const selfSwitchA = eventId => game.eval(([m, e]) => window.__game.ref("$gameSelfSwitches").value([m, e, "A"]), [MAP, eventId]);

  /**
   * 今の文章の窓の見え方。dim：既読の思念として暗く出ているか（窓口）。bright：窓に描いた字のいちばん明るい点
   * （不透明度×明るさ、0〜255。白い字なら 255 近く、暗くした字は 200 以下。灰色 \C[8] は 192、半透明 128 は 128）。
   */
  const look = () => game.eval(() => {
    const b = SceneManager._scene._messageWindow.contents;
    const d = b.context.getImageData(0, 0, b.width, b.height).data;
    let bright = 0;
    for (let i = 0; i < d.length; i += 4) bright = Math.max(bright, (d[i + 3] * (d[i] + d[i + 1] + d[i + 2])) / 3 / 255);
    return { dim: Hai.Thoughts.messageDimmed(), bright: Math.round(bright) };
  });
  let looks = []; // readAll が読んだページごとの見え方
  const isDim = l => l.dim && l.bright <= 200;
  const isBright = l => !l.dim && l.bright >= 230;

  /**
   * 決定キーで調べ、出た文章をすべて読んで閉じる（ページごとに、書き終わってから決定）。各ページの中身を返す。
   * ページごとの見え方は looks に入れる。shotLabel を渡すと、最初のページを書き終えたところでスクリーンショットを撮る。
   */
  async function readAll(shotLabel) {
    looks = [];
    await game.press("Enter");
    await game.waitFor(() => window.__game.ref("$gameMessage").isBusy());
    const pages = [];
    for (;;) {
      await game.waitFor(() => {
        const s = window.__game.ref("SceneManager")._scene;
        return !window.__game.ref("$gameMessage").isBusy() || (s._messageWindow && s._messageWindow.pause);
      });
      if (!(await messageBusy())) break;
      const text = await messageText();
      pages.push(text);
      looks.push(await look());
      if (shotLabel && pages.length === 1) await game.shot(shotLabel);
      await game.frames(12); // ▼が出てから 10 フレームは決定を受け付けない（Window_Message.startPause）
      await game.press("Enter");
      await game.waitFor(prev => {
        const m = window.__game.ref("$gameMessage");
        return !m.isBusy() || m.allText() !== prev;
      }, text);
      // 次のページが始まるか、イベントが終わるまで
      await game.waitFor(() => {
        const g = window.__game;
        return g.ref("$gameMessage").isBusy() || !g.ref("$gameMap").isEventRunning();
      });
      if (!(await messageBusy())) break;
    }
    await game.waitFor(() => !window.__game.ref("$gameMap").isEventRunning());
    await game.frames(3);
    return pages;
  }

  try {
    await game.call("setSpeed", 2);
    await game.call("newGame");
    await game.waitScene("Scene_Map");
    await go(3, 9, 8);

    // ---- 最初は 3 つとも読んでいない。メモは空
    check((await th("unreadCount", MAP)) === 3, `unreadCount 最初 ${await th("unreadCount", MAP)}`);
    check((await th("unreadCount")) === 3, "unreadCount() が今のマップを数えない");
    const list = await th("thoughts", MAP);
    check(list.length === 3 && list.every(t => !t.read), `thoughts(904): ${JSON.stringify(list)}`);
    check(list.some(t => t.id === "R10" && t.x === R10.x && t.y === R10.y), "thoughts() に R10 の座標がない");
    check((await th("notes")).length === 0, "最初からメモがある");

    // ---- P17（R2 困る 5）：調べた直後、文章の窓を閉じる前に割り込まれて終わったら既読にしない
    await go(R13.x, R13.y + 1, 8);
    await game.press("Enter");
    await game.waitFor(() => window.__game.ref("$gameMessage").isBusy());
    await game.eval(() => window.__game.ref("$gameMap")._interpreter.terminate());
    check(!(await th("isRead", R13.id)) && !(await selfSwitchA(R13.eventId)), "窓を閉じる前に終わった R13 が既読になった");
    await game.waitFor(() => {
      const s = window.__game.ref("SceneManager")._scene;
      return s._messageWindow && s._messageWindow.pause;
    });
    await game.frames(12);
    await game.press("Enter");
    await game.waitFor(() => !window.__game.ref("$gameMessage").isBusy() && !window.__game.ref("$gameMap").isEventRunning());
    await game.frames(3);
    check(!(await th("isRead", R13.id)), "割り込まれたあと窓を閉じても R13 が既読になった");

    // ---- P20（R3 困る 3）：調べた直後に戦闘で割り込まれ、文が戦闘の画面で送られて閉じても既読にしない
    const toMapIdle = () => game.waitFor(() => {
      const g = window.__game;
      return g.scene() === "Scene_Map" && !g.isBusy() && !g.ref("$gameMap").isEventRunning() && !g.ref("$gameMessage").isBusy();
    });
    await game.call("strengthenParty");
    await game.press("Enter");
    await game.waitFor(() => window.__game.ref("$gameMessage").isBusy());
    await game.call("startBattle", 1, true, false);
    await game.waitFor(() => window.__game.scene() === "Scene_Battle");
    await game.call("setSpeed", 8);
    await game.holdOkToMap();
    await game.call("setSpeed", 2);
    await toMapIdle();
    await game.frames(3);
    check(!(await th("isRead", R13.id)) && !(await selfSwitchA(R13.eventId)), "戦闘に割り込まれて戦闘の画面で窓が閉じた R13 が既読になった");
    // 調べたのと同じ時に戦闘が始まったら、思念は始めない（戦闘のあとに勝手に流れて、押しっぱなしで既読にならない）
    await game.eval(e => {
      window.__game.ref("$gameMap").event(e).start();
      window.__game.startBattle(1, true, false);
    }, R13.eventId);
    await game.waitFor(() => window.__game.scene() === "Scene_Battle");
    await game.call("setSpeed", 8);
    await game.holdOkToMap();
    await game.call("setSpeed", 2);
    await toMapIdle();
    await game.frames(3);
    check(!(await th("isRead", R13.id)) && !(await selfSwitchA(R13.eventId)), "戦闘と同じ時に調べた R13 が、戦闘のあとに流れて既読になった");
    check(!(await game.eval(e => window.__game.ref("$gameMap").event(e).isStarting(), R13.eventId)), "戦闘のあとも R13 が始まる順を待っている");
    await th("clearNotes"); // 戦利品の作り方のメモ（Hai_Craft）を消して、下の「メモは手がかりの分だけ」を数える

    // ---- R13（手がかりなし）を読むと既読になり、セルフスイッチ A が入る
    check(!(await th("isRead", R13.id)), "読む前に R13 が既読");
    let pages = await readAll("reading");
    check(pages.length === 1 && pages[0].includes("耳が獣だから"), `R13 の本文: ${JSON.stringify(pages)}`);
    check(!pages[0].includes("（読んだ）") && isBright(looks[0]), `初めて読んだのに暗い・印が付いた ${JSON.stringify(looks)}`);
    check(JSON.stringify(await th("readStyle")) === JSON.stringify({ style: "dim", dim: "gray" }), `既定の見せ方 ${JSON.stringify(await th("readStyle"))}`);
    check(await th("isRead", R13.id), "読んだ R13 が既読にならない");
    check(await selfSwitchA(R13.eventId), "読んだ R13 のセルフスイッチ A が OFF");
    check((await th("notes")).length === 0, "手がかりのない思念でメモが増えた");
    check((await th("unreadCount", MAP)) === 2, `unreadCount 1 つ読んだ後 ${await th("unreadCount", MAP)}`);

    // ---- もう一度調べると本文が薄く暗く出る（P21。「（読んだ）」の印は付けない）。数は変わらない
    pages = await readAll("reread");
    check(!pages[0].includes("（読んだ）") && pages[0].includes("耳が獣だから"), `R13 を二度目: ${JSON.stringify(pages)}`);
    check(looks.length === 1 && isDim(looks[0]), `二度目の R13 が暗くない ${JSON.stringify(looks)}`);
    check((await th("unreadCount", MAP)) === 2, "二度読んで unreadCount が変わった");

    // ---- ほかのマップにいても、訪れたマップの unreadCount を読める
    await go(5, 11, 6, 902);
    check((await th("unreadCount", MAP)) === 2, `ほかのマップから見た unreadCount(904) ${await th("unreadCount", MAP)}`);
    check((await th("unreadCount", 902)) === 0, "思念のないマップの unreadCount が 0 でない");
    check((await th("unreadCount", 1)) === 0, "訪れていないマップの unreadCount が 0 でない");

    // ---- R10（手がかり 2 つ、2 ページ）：読み終えるとメモに 2 行。文章の最後に「メモ：」の行
    await go(R10.x, R10.y + 1, 8);
    pages = await readAll("clue");
    check(pages.length === 3, `R10 のページ数 ${pages.length}: ${JSON.stringify(pages)}`);
    check(pages[0].includes("四、一、三") && pages[1].includes("寝床の下の壁"), "R10 の本文");
    check(pages[2].includes("メモ：") && pages[2].includes("4・1・3") && pages[2].includes("寝床の下の壁が柔らかい"), `メモの行: ${pages[2]}`);
    check(looks.length === 3 && looks.every(isBright), `初めての R10 が暗い ${JSON.stringify(looks)}`);
    let notes = await th("notes");
    check(notes.length === 2, `R10 を読んだ後のメモの数 ${notes.length}`);
    check(notes[0].id === "clue:R10" && notes[1].id === "clue:R10#2", `メモの ID ${notes.map(n => n.id)}`);
    check(notes[0].text === "地下牢の看守の箱の番号は 4・1・3", `メモの一行 ${notes[0].text}`);
    check(notes.every(n => n.kind === "clue" && n.mapId === MAP && n.x === R10.x && n.y === R10.y && typeof n.time === "number"), `メモの欄 ${JSON.stringify(notes[0])}`);
    // 二度読んでも増えない。メモの行も出ない
    pages = await readAll();
    check(pages.length === 2 && !pages.join("").includes("（読んだ）") && !pages.join("").includes("メモ："), `R10 を二度目: ${JSON.stringify(pages)}`);
    check(looks.length === 2 && looks.every(isDim), `二度目の R10 の 2 ページが暗くない ${JSON.stringify(looks)}`);
    check((await th("notes")).length === 2, "二度読んでメモが増えた");
    // 既読の思念のあとに出るメモの行は元の明るさ（メモを 1 つ消して、もう一度足させる）
    await th("removeNote", "clue:R10#2");
    pages = await readAll();
    check(pages.length === 3 && pages[2].includes("寝床の下の壁が柔らかい") && !pages[2].includes("4・1・3"), `メモを消して R10 を三度目: ${JSON.stringify(pages)}`);
    check(isDim(looks[0]) && isDim(looks[1]) && isBright(looks[2]), `既読の思念のあとのメモの行が元の明るさでない ${JSON.stringify(looks)}`);
    check((await th("notes")).map(n => n.id).join() === "clue:R10,clue:R10#2", `メモを足し直した順 ${JSON.stringify(await th("notes"))}`);
    check((await th("unreadCount", MAP)) === 1, "R10 を読んだ後の unreadCount");

    // ---- 施錠扉：鍵なしで調べると「鍵がかかっている。」とメモ（kind: door）。二度でも 1 行。通れない
    await go(LOCKED.x - 1, LOCKED.y, 6);
    check(!(await game.call("canPass", LOCKED.x - 1, LOCKED.y, 6)), "鍵の扉を通れた");
    pages = await readAll("locked");
    check(pages.length === 1 && pages[0].includes("鍵がかかっている。"), `鍵の扉: ${JSON.stringify(pages)}`);
    check(isBright(looks[0]), `既読の思念の次の文章（鍵の扉）が元の明るさでない ${JSON.stringify(looks)}`);
    check(pages[0].includes("試験場の鍵が要る扉（残留思念の試験場 10,8）"), `扉のメモの行: ${pages[0]}`);
    let doors = await th("notes", "door");
    check(doors.length === 1 && doors[0].text === "試験場の鍵が要る扉（残留思念の試験場 10,8）" && doors[0].x === LOCKED.x && doors[0].y === LOCKED.y, `扉のメモ ${JSON.stringify(doors)}`);
    check(!doors[0].done, "開けていない扉のメモが done");
    pages = await readAll();
    check(pages.length === 1 && !pages[0].includes("メモ："), `鍵の扉を二度目: ${JSON.stringify(pages)}`);
    check((await th("notes", "door")).length === 1, "扉を二度調べてメモが増えた");
    check(!(await selfSwitchA(LOCKED.eventId)), "鍵なしで扉が開いた");

    // ---- 思念 c（隠し扉の示唆）→ 隠し扉（P2）→ 奥の宝箱で鍵
    await go(P3C.x, P3C.y + 1, 8);
    pages = await readAll();
    check(pages[0].includes("北の壁を見ろ") && pages[pages.length - 1].includes("色の違う石"), `c の本文: ${JSON.stringify(pages)}`);
    check(await th("hasNote", "clue:P3c"), "c の手がかりがメモにない");
    check((await th("unreadCount", MAP)) === 0, "全部読んだのに unreadCount が 0 でない");
    await go(HIDDEN_DOOR.x, HIDDEN_DOOR.y + 1, 8);
    pages = await readAll();
    check(pages[0].includes("隠し扉を見つけた"), `隠し扉: ${JSON.stringify(pages)}`);
    for (let i = 0; i < 3; i++) check(await step(8), `隠し扉の奥へ ${i + 1} 歩目で進めない`);
    await game.eval(() => window.__game.ref("$gamePlayer").setDirection(4));
    const p = await pos();
    check(p.x === KEY_CHEST.x + 1 && p.y === KEY_CHEST.y, `鍵の宝箱の横にいない (${p.x},${p.y})`);
    await readAll();
    check(await game.eval(id => window.__game.ref("$gameParty").hasItem($dataItems[id]), KEY_ID), "宝箱から鍵が出ない");

    // ---- 鍵を持って扉を調べると開き、通れる。扉のメモは done
    await go(LOCKED.x - 1, LOCKED.y, 6);
    pages = await readAll();
    check(pages.length === 1 && pages[0].includes("試験場の鍵で扉を開けた"), `鍵で開ける: ${JSON.stringify(pages)}`);
    check(await selfSwitchA(LOCKED.eventId), "開けた扉のセルフスイッチ A が OFF");
    doors = await th("notes", "door");
    check(doors.length === 1 && doors[0].done === true, `開けた扉のメモ ${JSON.stringify(doors)}`);
    check(await step(6), "開けた扉を通れない");
    await game.shot("door-open");

    // ---- 窓口：addNote（同じ ID は二度足さない）
    const added = await th("addNote", { id: "test:1", text: "試しのメモ", kind: "item" });
    check(added && added.kind === "item" && added.mapId === MAP, `addNote ${JSON.stringify(added)}`);
    check((await th("addNote", { id: "test:1", text: "別の文" })) === null, "同じ ID の addNote が足された");
    check(await th("markRead", "R99") && !(await th("markRead", "R99")), "markRead の戻り値");
    notes = await th("notes");
    // R10 の 2 つ、扉、c、試し（U1 の Hai_Notes があると、鍵を拾った入手ログ item:… も入るので数えない）
    const ownNotes = notes.filter(n => !n.id.startsWith("item:"));
    check(ownNotes.length === 5, `メモの数 ${ownNotes.length}`);

    // ---- セーブ → ページの読み直し → ロードで、既読とメモが残る
    await go(3, 9, 8);
    await game.call("save", SLOT);
    await game.reload();
    await game.call("load", SLOT);
    await game.waitScene("Scene_Map");
    check((await game.call("mapId")) === MAP, "ロード後のマップ");
    for (const id of [R13.id, R10.id, P3C.id]) check(await th("isRead", id), `ロード後に ${id} が既読でない`);
    check((await th("unreadCount", MAP)) === 0, "ロード後の unreadCount");
    const after = await th("notes");
    check(JSON.stringify(after) === JSON.stringify(notes), `ロード後のメモ ${JSON.stringify(after)}`);
    await go(R10.x, R10.y + 1, 8);
    pages = await readAll();
    check(!pages.join("").includes("（読んだ）") && looks.every(isDim) && !pages.join("").includes("メモ："), `ロード後に読み直した R10 ${JSON.stringify(looks)}`);
    check((await th("notes")).length === notes.length, "ロード後に読み直してメモが増えた");
    await go(LOCKED.x - 1, LOCKED.y, 6);
    check(await step(6), "ロード後に開けた扉を通れない");

    // ---- P11 会話できない薄い思念（<hai_faint>。試験場 Map907 の f・g）：画面が暗くなり、文章だけ（窓なし・真ん中）。
    //      見終えると色調が戻り、戻った記憶の数（faintCount・変数 138）が 1 増える。読み直しても増えない
    const FAINT = { map: 907, f: { x: 4, y: 9, id: "F01" }, g: { x: 8, y: 9, id: "F07" } };
    const tone = () => game.eval(() => window.__game.ref("$gameScreen").tone().slice());
    const faintVar = () => game.eval(() => window.__game.ref("$gameVariables").value(138));
    await go(FAINT.f.x, FAINT.f.y + 1, 8, FAINT.map);
    const baseTone = await tone();
    check((await th("faintCount")) === 0 && (await faintVar()) === 0, "最初から記憶が戻っている");
    const faintList = await th("thoughts", FAINT.map);
    check(faintList.length === 2 && faintList.every(t => t.faint && !t.read), `thoughts(907) の薄い思念 ${JSON.stringify(faintList)}`);
    await game.press("Enter");
    await game.waitFor(() => {
      const s = window.__game.ref("SceneManager")._scene;
      return s._messageWindow && s._messageWindow.pause;
    });
    const scene = await game.eval(() => {
      const g = window.__game;
      const m = g.ref("$gameMessage");
      return { tone: g.ref("$gameScreen").tone().slice(), background: m.background(), position: m.positionType(), face: m.faceName(), speaker: m.speakerName(), text: m.allText() };
    });
    await game.shot("faint");
    const faintLook = await look();
    check(isBright(faintLook), `初めての薄い思念が暗い ${JSON.stringify(faintLook)}`);
    check(scene.tone[3] >= 150 && scene.tone[0] <= -90, `薄い思念で画面が暗くならない ${JSON.stringify(scene.tone)}`);
    check(scene.background === 2 && scene.position === 1 && scene.face === "" && scene.speaker === "", `薄い思念の窓 ${JSON.stringify(scene)}`);
    check(scene.text.includes("耳を寄せている"), `薄い思念の本文 ${JSON.stringify(scene)}`);
    await game.frames(12);
    await game.press("Enter");
    await game.waitFor(() => !window.__game.ref("$gameMap").isEventRunning());
    await game.frames(3);
    check(JSON.stringify(await tone()) === JSON.stringify(baseTone), `薄い思念のあと色調が戻らない ${JSON.stringify(await tone())}`);
    check((await th("isRead", "F01")) && (await th("isFaint", "F01")), "F01 が既読・見た扱いにならない");
    check((await th("faintCount")) === 1 && (await faintVar()) === 1, `戻った記憶の数 ${await th("faintCount")} / 変数 138 ${await faintVar()}`);
    pages = await readAll();
    check(!pages[0].includes("（読んだ）") && isDim(looks[0]) && (await th("faintCount")) === 1, `読み直した薄い思念が暗くない・記憶の数が増えた ${JSON.stringify(pages)} ${JSON.stringify(looks)}`);
    // 「イベント処理の中断」で終わっても、暗いまま残らない
    await go(FAINT.g.x, FAINT.g.y + 1, 8, FAINT.map);
    await game.press("Enter");
    await game.waitFor(() => window.__game.ref("$gameMessage").isBusy());
    await game.eval(() => window.__game.ref("$gameMap")._interpreter.command115());
    await game.waitFor(() => {
      const s = window.__game.ref("SceneManager")._scene;
      return s._messageWindow && s._messageWindow.pause;
    });
    await game.frames(12);
    await game.press("Enter");
    await game.waitFor(() => !window.__game.ref("$gameMap").isEventRunning());
    await game.frames(3);
    check(JSON.stringify(await tone()) === JSON.stringify(baseTone), `中断のあと色調が戻らない ${JSON.stringify(await tone())}`);
    check((await th("faintCount")) === 2 && (await faintVar()) === 2, `2 つ目で記憶の数が 2 にならない ${await th("faintCount")}`);
    // 古いセーブ（faint が無い）でも初期値で動く
    const oldFaint = await game.eval(() => {
      const t = window.__game.ref("$gameSystem")._hai.thoughts;
      const keep = t.faint;
      delete t.faint;
      const r = { count: Hai.Thoughts.faintCount(), isFaint: Hai.Thoughts.isFaint("F01") };
      t.faint = keep;
      return r;
    });
    check(oldFaint.count === 0 && !oldFaint.isFaint, `古いセーブの初期値 ${JSON.stringify(oldFaint)}`);

    // ---- P17（R2 困る 4）：薄い思念のあとの仲間の行（コモンイベント 201 の後ろ）は名前と窓を残す（033 F02 のブルーノ）
    await go(42, 40, 8, 33);
    const f02 = await game.eval(() => {
      const g = window.__game;
      const ev = g.ref("$gameMap").events().find(e => /<hai_faint:F02>/.test(e.event().note));
      const it = new Game_Interpreter();
      it.setup(ev.list(), ev.eventId());
      const list = it._list;
      const at = list.findIndex(c => c.code === 117 && c.parameters[0] === 201);
      const texts = list.map((c, i) => ({ i, c })).filter(o => o.c.code === 101);
      return { at, before: texts.filter(o => o.i < at).map(o => o.c.parameters), after: texts.filter(o => o.i > at).map(o => o.c.parameters) };
    });
    check(f02.at > 0 && f02.before.length > 0 && f02.before.every(p => p[2] === 2 && p[3] === 1 && p[4] === ""), `F02 の本文が窓なしにならない ${JSON.stringify(f02)}`);
    check(f02.after.length === 2 && f02.after.every(p => p[2] === 0 && p[3] === 2 && p[4] === "ブルーノ"), `F02 のあとのブルーノの行の名前・窓が消えた ${JSON.stringify(f02)}`);
    // P21：既読のとき暗くするのは本文（コモンイベントの前）だけ。あとのブルーノの行は暗くしない
    const f02dim = await game.eval(() => {
      const ev = $gameMap.events().find(e => /<hai_faint:F02>/.test(e.event().note));
      const dims = () => {
        const it = new Game_Interpreter();
        it.setup(ev.list(), ev.eventId());
        const at = it._list.findIndex(c => c.code === 117 && c.parameters[0] === 201);
        const texts = it._list.map((c, i) => ({ i, c })).filter(o => o.c.code === 101);
        return { before: texts.filter(o => o.i < at).map(o => !!o.c._haiDim), after: texts.filter(o => o.i > at).map(o => !!o.c._haiDim) };
      };
      const unread = dims();
      Hai.Thoughts.markRead("F02");
      const read = dims();
      delete $gameSystem._hai.thoughts.read.F02;
      return { unread, read, source: ev.list().some(c => c._haiDim) };
    });
    check(f02dim.unread.before.every(d => !d) && f02dim.unread.after.every(d => !d), `読んでいない F02 に暗くする印 ${JSON.stringify(f02dim)}`);
    check(f02dim.read.before.length > 0 && f02dim.read.before.every(d => d) && f02dim.read.after.every(d => !d), `既読の F02 の暗くする所 ${JSON.stringify(f02dim)}`);
    check(!f02dim.source, "暗くする印がマップのデータそのものに付いた");

    // ---- clearNotes（テスト用）
    await th("clearNotes");
    check((await th("notes")).length === 0, "clearNotes で消えない");

    game.assertNoErrors();
  } finally {
    await game.close();
  }
});
