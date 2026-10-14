// W15（#231）原作の反映：序と地域一（docs/story/scenes/01-fort-region1.md、tools/maps/src/w6_data.mjs・w15_story.mjs）の検査。
//   0. データ：旗の名前（115–118・314）、Enemies・Troops 336、ブルーノの <hai_down>、地域一の敵の <hai_enemy_bell:101>（030–032 と影は除く）、
//      010 の新しいイベントが 42–52 にあること、消した文・足した文。
//   1. 砦：食卓と伏せた椀（スイッチ 116 を起こす・伏せるで選び直せる）、崩れた壁の隙間（灯は無い）。
//   2. マルゴ一度目（ヴォルフラムが砦へ来たあと、砦に入ると自動）：頼みごと「営倉の鐘を売る」の段 1。ヴォルフラム（炉の前）が先に盛る一椀（スイッチ 117）。
//   3. 夜の戸（020 の木樵の小屋）：答える → スイッチ 314 → 声だけの影を倒す → 声の一行。言い残しは P14 の表（スイッチ 314 の行）。
//   4. 営倉の鐘（036）：マルゴと取り引きする道（外す → 変数 165＝3 → 砦でマルゴが台に戻させる → 4。シャノは砦を出る）→
//      ブルーノを連れて綱を引く（ブルーノの四行・スイッチ 310 は立たない・記録院の札があれば「同じ日だ」）。
//   5. 鐘のあとの砦：輪のあとの名乗り・マルゴ二度目（鉄切り鋏の店・スイッチ 118）・アデルの講義、梁の上のシャノ、アデルの席で鐘鉄を渡す。
//   6. 019 の夕べの数（胸壁の東の端を踏む）と東の眺めの灯、033 の房の列の端（「……東を向いている」）。
// W19（#263。R2 の直し）：
//   0. 拾い物の表記（019–037 は「薬草×2を手に入れた。」の形）、021・027 の見えない通路の手がかりの一行、028 F03 の四つ目の一言は墓守の帳面があるときだけ。
//   3. 夜の戸の影は「崩れる → 声（話し手の名つき）」の順。 4. 036 の札掛け（鳴らす前は「札は一枚。」）、変数 165＝4 では「鐘を外す」が出ない。
//   4b. 027 で灯なしに勝ったあと、ブルーノ「数えると、平気です。」（一度きり）。 6. 夕べの数は全部かな、房の列の端は通ってきた影の文。
import fs from "node:fs";
import path from "node:path";
import { launchGame, check, runTest, ROOT, SLOW_PAGE_TIMEOUT } from "./lib.mjs";

const KEEP = 10, RAMPART = 19, FOREST = 20, DEPTHS = 27, CELLS = 33, BELL_ROOM = 36;
const SW = { hearth: 112, shano: 172, margoOnce: 115, bowlUp: 116, served: 117, margoTwice: 118, bruno: 138, wolfram: 306, adele: 307, bellPrison: 101, bellFirst: 310, nightDoor: 314 };
const VAR = { bells: 101, prisonBell: 165, summitTools: 162, bellIron: 301 };
const ITEM = { bellIron: 327, dutyTag: 323, archiveTag: 429 };
const readJson = f => JSON.parse(fs.readFileSync(path.join(ROOT, "data", f), "utf8"));
const mapFile = id => `Map${String(id).padStart(3, "0")}.json`;
const allText = map => JSON.stringify(map.events);

await runTest(async () => {
  // ===== 0. データ =====
  const system = readJson("System.json");
  for (const [id, name] of [[115, "マルゴ:一度来た"], [116, "食卓:伏せた椀を起こしてある"], [117, "食卓:先に盛る一椀"], [118, "マルゴ:二度来た"], [314, "夜の戸:木樵（答えた）"]]) {
    check(system.switches[id] === name, `スイッチ ${id} の名前「${system.switches[id]}」`);
  }
  check(readJson("Enemies.json")[336].name === "声だけの影" && readJson("Troops.json")[336].members[0].enemyId === 336, "Enemies・Troops 336");
  check(readJson("Actors.json")[5].note.includes("<hai_down:……数えてください>"), "ブルーノのメモ欄の <hai_down>");
  for (let id = 20; id <= 37; id++) {
    if (!fs.existsSync(path.join(ROOT, "data", mapFile(id)))) continue;
    for (const e of readJson(mapFile(id)).events) {
      if (!e || !/<hai_enemy:/.test(e.note)) continue;
      const shade = e.note.includes("<hai_enemy_shade");
      const want = id < 30 || id > 32 ? !shade : false;
      check(e.note.includes("<hai_enemy_bell:101>") === want, `${mapFile(id)} の「${e.name}」の <hai_enemy_bell:101>`);
    }
  }
  const keep = readJson(mapFile(KEEP));
  const ids = ["食卓", "伏せた椀", "ヴォルフラム（炉の前）", "輪のあと（ブルーノの名乗り）", "ブルーノの席", "マルゴ", "拾い屋（マルゴの連れ 1）", "拾い屋（マルゴの連れ 2）", "アデル（食卓）", "アデルの講義", "先に盛る一椀"]
    .map(name => keep.events.findIndex(e => e && e.name === name));
  check(JSON.stringify(ids) === JSON.stringify([42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52]), "010 の W15 のイベント ID " + JSON.stringify(ids));
  const mine = allText(readJson(mapFile(26)));
  check(!mine.includes("麦が三月") && !mine.includes("子どもと年寄りからは") && !mine.includes("……誰が入れたの"), "026 の消した文が残っている");
  check(mine.includes("いち、に、さん、し") && mine.includes("今の人、僕の隊の鐘の印を、槍に"), "026 のブルーノの行");
  const chapel = allText(readJson(mapFile(21)));
  check(chapel.includes("\"十一、十二、十三。\"") && chapel.includes("舌は布で巻いて結んである。"), "021 の巡礼の二ページ目と籠手の文");
  check(allText(readJson(mapFile(12))).includes("底に、煤で大きく「わし」。"), "012 の大鍋の二行");
  // W19：拾い物の表記（R2 気になる 26）
  for (let id = 19; id <= 37; id++) {
    if (!fs.existsSync(path.join(ROOT, "data", mapFile(id)))) continue;
    const bad = allText(readJson(mapFile(id))).match(/"[^"]*(手に入れた！| ×\d)[^"]*"/g);
    check(!bad, `${mapFile(id)} の拾い物の表記 ${JSON.stringify(bad)}`);
  }
  // W19：見えない通路の手がかり（R2 困る 7・8）
  const textOf = (id, name) => JSON.stringify(readJson(mapFile(id)).events.find(e => e && e.name === name));
  check(textOf(21, "宝箱（薬草）").includes("東の林の奥から、煎じた薬の匂いがする。"), "021 の東の白い林の手がかり");
  check(textOf(27, "宝箱（鉄くず）").includes("西の岩壁の奥から、風が来る。"), "027 の坑道の門の手がかり");
  // W19：028 F03 のコモン 201（四つ目の一言）は、四つ目なら墓守の帳面（326）を持っているときだけ（R2 気になる 16）
  const f03 = readJson(mapFile(28)).events.find(e => e && e.name === "薄い思念 F03 坑夫の頭").pages[0].list;
  const at = f03.findIndex(c => c.code === 111 && c.parameters[0] === 1 && c.parameters[1] === 138 && c.parameters[3] === 3);
  check(at >= 0 && f03[at + 1].code === 111 && f03[at + 1].parameters[1] === 326 && f03[at + 2].code === 117 && f03.filter(c => c.code === 117).length === 2, "028 F03 の四つ目の一言の条件");

  const game = await launchGame();
  try {
    await game.call("newGame");
    await game.waitScene("Scene_Map");
    await game.call("setSpeed", 2);
    const sw = id => game.eval(i => $gameSwitches.value(i), id);
    const vr = id => game.eval(i => $gameVariables.value(i), id);
    const setSw = (id, v = true) => game.eval(([i, b]) => $gameSwitches.setValue(i, b), [id, v]);
    const setVar = (id, v) => game.eval(([i, n]) => $gameVariables.setValue(i, n), [id, v]);
    const errand = key => game.eval(k => { const e = Hai.Notes.errand(k); return e && { stage: e.stage, result: e.result, text: e.text }; }, key);

    async function calm() {
      await game.eval(() => {
        for (const ev of $gameMap.events()) if (ev.event().meta.hai_enemy && !ev.event().meta.hai_enemy_shade) $gameSelfSwitches.setValue([$gameMap.mapId(), ev.eventId(), "A"], true);
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
    /** イベントが終わるまで文章を読み進める（press で決定キーを押して始める）。選択肢は choices の順。店の画面は閉じる。 */
    async function talk(choices = [], press = true, pageTimeout = undefined) {
      const queue = choices.slice();
      if (press) await game.press("Enter");
      await game.waitFor(() => $gameMap.isEventRunning() || $gameMessage.isBusy() || !(SceneManager._scene instanceof Scene_Map));
      const pages = [];
      const t0 = Date.now();
      for (;;) {
        check(Date.now() - t0 < 120_000, "イベントが終わらない " + JSON.stringify(pages.slice(-3)));
        await game.waitFor(() => {
          const s = SceneManager._scene;
          if (!(s instanceof Scene_Map)) return !SceneManager.isSceneChanging() && s.isStarted();
          const w = s._messageWindow;
          const c = w && w._choiceListWindow;
          return !$gameMap.isEventRunning() || (w && w.pause) || (c && c.active && c.isOpen());
        }, null, pageTimeout);
        const st = await game.eval(() => {
          const s = SceneManager._scene;
          const w = s._messageWindow;
          return {
            scene: s.constructor.name,
            running: $gameMap.isEventRunning() || $gameMessage.isBusy(),
            choice: !!(w && w._choiceListWindow && w._choiceListWindow.active && w._choiceListWindow.isOpen()),
            text: (($gameMessage.speakerName() ? $gameMessage.speakerName() + "「" : "") + $gameMessage.allText()),
            choices: $gameMessage.choices(),
          };
        });
        if (st.scene === "Scene_Shop") {
          pages.push("［店］");
          await game.press("Escape");
          await game.waitScene("Scene_Map");
          await game.frames(4);
          continue;
        }
        if (!st.running) break;
        if (st.choice) {
          pages.push(st.text + "［" + st.choices.join("／") + "］");
          const q = queue.shift() ?? 0;
          const i = typeof q === "string" ? st.choices.indexOf(q) : q;
          check(i >= 0 && i < st.choices.length, `選択肢「${q}」が無い ${JSON.stringify(st.choices)}`);
          await game.eval(n => SceneManager._scene._messageWindow._choiceListWindow.select(n), i);
          await game.frames(2);
          await game.press("Enter");
        } else {
          pages.push(st.text);
          await game.frames(12);
          await game.press("Enter");
        }
        await game.waitFor(prev => {
          const s = SceneManager._scene;
          if (!(s instanceof Scene_Map)) return true;
          return !$gameMap.isEventRunning() || !s._messageWindow.pause || (($gameMessage.speakerName() ? $gameMessage.speakerName() + "「" : "") + $gameMessage.allText()) !== prev;
        }, st.text);
        await game.frames(2);
      }
      await game.frames(3);
      return pages;
    }
    /** 自動実行が始まっていれば、終わるまで読む（続けて始まる自動実行もまとめて）。 */
    async function autorun(choices = []) {
      const pages = [];
      for (;;) {
        await game.frames(20);
        if (!(await game.eval(() => $gameMap.isEventRunning() || $gameMessage.isBusy()))) return pages;
        pages.push(...(await talk(choices, false)));
      }
    }
    const has = (pages, s) => pages.some(p => p.includes(s));
    const pageOf = (mapEventName) => game.eval(n => { const e = $gameMap.events().find(e => e.event().name === n); return e ? e._pageIndex : -9; }, mapEventName);

    // ===== 1. 砦：食卓・伏せた椀・崩れた壁の隙間 =====
    await game.eval(() => { for (const id of [111, 112, 171, 172]) $gameSwitches.setValue(id, true); });
    const ev = name => keep.events.find(e => e && e.name === name);
    const table = ev("食卓");
    await go(KEEP, table.x, table.y - 1, 2);
    const tableText = await talk();
    check(has(tableText, "椅子が十四") && has(tableText, "椀が伏せてある。"), "食卓 " + JSON.stringify(tableText));
    const bowl = ev("伏せた椀");
    await go(KEEP, bowl.x + 1, bowl.y, 4);
    const up = await talk(["起こしておく"]);
    check(has(up, "同じ手だ。") && (await sw(SW.bowlUp)), "伏せた椀を起こす " + JSON.stringify(up));
    await talk(["伏せておく"]);
    check(!(await sw(SW.bowlUp)), "伏せた椀を伏せ直せない");
    await game.shot("table");
    const crack = ev("崩れた壁の隙間");
    await go(KEEP, crack.x, crack.y + 1, 8);
    check(has(await talk(), "灯は無い。"), "崩れた壁の隙間（鐘の前）");

    // ===== 2. マルゴ一度目・ヴォルフラムが先に盛る =====
    await go(KEEP, 25, 27, 8);
    await setSw(SW.wolfram); // ヴォルフラムが砦へ来た → マルゴが自動で入ってくる
    const margo1 = await autorun();
    check(has(margo1, "マルゴ「鐘は？") && has(margo1, "鳴った鐘は、鉄に戻らない") && has(margo1, "シャノ「扉が開かないんだって。"), "マルゴ一度目 " + JSON.stringify(margo1));
    check((await sw(SW.margoOnce)) && (await vr(VAR.prisonBell)) === 1, "マルゴ一度目のあとの旗 115・変数 165");
    check((await errand("prisonBell")).stage === 1, "頼みごと「営倉の鐘を売る」の段 1");
    check((await pageOf("マルゴ")) === 2, "マルゴが帰らない（ページ " + (await pageOf("マルゴ")) + "）");
    const wolf = ev("ヴォルフラム（炉の前）");
    await go(KEEP, wolf.x, wolf.y + 1, 8);
    const serve = await talk();
    check(has(serve, "でかい爺さんが来た") && has(serve, "炉から数えて三つ目の、壁の側の席。") && has(serve, "伏せた奴が起こす"), "ヴォルフラム（炉の前） " + JSON.stringify(serve));
    check(await sw(SW.served), "先に盛る一椀（スイッチ 117）");
    check(has(await talk(), "座れ！　食え！"), "ヴォルフラムの二ページ目");
    const bowl2 = ev("先に盛る一椀");
    await go(KEEP, bowl2.x, bowl2.y - 1, 2);
    check(has(await talk(), "湯気が、まだ立っている。"), "先に盛る一椀を調べる");

    // ===== 3. 夜の戸（020 木樵の小屋）=====
    await go(FOREST, 38, 38, 8);
    await game.call("step", 8); // 崩れた小屋の土間を踏む
    const door = await talk(["答える"], false);
    check(has(door, "戸を、三度叩く音がした。") && has(door, "声「薪、三束。戸の脇に置いといたよ") && has(door, "……三束だな") && has(door, "縦に裂けた。"), "夜の戸 " + JSON.stringify(door));
    check(await sw(SW.nightDoor), "答えたのにスイッチ 314 が立たない");
    await game.frames(10);
    await game.shot("night-door");
    await game.call("strengthenParty");
    await game.call("step", 2); // 影に触れる
    await game.waitScene("Scene_Battle");
    check(await game.eval(() => $gameTroop.troop().id === 336), "影の敵グループが 336 でない");
    await game.eval(() => $gameTroop.members().forEach(e => e.setHp(1)));
    await game.call("setSpeed", 16);
    const t0 = Date.now();
    while ((await game.call("scene")) !== "Scene_Map") {
      check(Date.now() - t0 < 120_000, "影との戦いが終わらない");
      const st = await game.eval(() => {
        const s = SceneManager._scene;
        if (!(s instanceof Scene_Battle)) return "other";
        if ($gameMessage.isBusy()) return "message";
        return BattleManager.isInputting() ? "input" : "busy";
      });
      if (st === "input") {
        await game.eval(() => {
          $gameParty.members().forEach(a => { if (a.canInput()) { a.makeActions(); a.action(0).setAttack(); a.action(0).setTarget(0); } });
          BattleManager.startTurn();
          SceneManager._scene.changeInputWindow();
        });
      } else if (st === "message") await game.press("Enter");
      await game.frames(4);
    }
    await game.call("setSpeed", 2);
    const voice = await autorun();
    // W19（R2 気になる 12）：崩れる文 → 話し手の名つきの声の順
    const fall = voice.findIndex(p => p.includes("影は、土間の上で崩れた。")), said = voice.findIndex(p => p.includes("木樵の女房「薪、三束。戸の脇に置いといたよ"));
    check(fall >= 0 && said > fall && voice.filter(p => p.includes("薪、三束")).length === 1, "影の声の順 " + JSON.stringify(voice));
    check((await autorun()).length === 0, "夜の戸の後がくり返す");
    const legacy = await game.eval(() => Hai.Thoughts.legacies());
    check(legacy.some(l => l.switchId === 314 && l.text.includes("薪、三束")), "言い残し（P14 の表のスイッチ 314） " + JSON.stringify(legacy));
    await go(FOREST, 38, 37, 8);
    check(has(await talk(), "薪を積んであった形だ。"), "答えたあとの土間の文");

    // ===== 4. 営倉の鐘：マルゴと取り引きする道 → ブルーノと鳴らす =====
    // W19（R2 気になる 11）：鳴らす前の札掛けは「札は一枚。」（084 と同じ）
    await go(BELL_ROOM, 18, 5, 8);
    check(has(await talk(), "札は一枚。"), "鳴らす前の札掛け");
    await go(BELL_ROOM, 13, 8, 8);
    const unhook = await talk(["鐘を外す（マルゴに売る）"]);
    check(has(unhook, "腕が痺れるほど重い。") && (await vr(VAR.prisonBell)) === 3 && !(await sw(SW.bellPrison)), "鐘を外す " + JSON.stringify(unhook));
    check(has(await talk(), "台座の脇の床に下ろしてある。"), "外したあとの綱");
    await go(KEEP, 25, 27, 8);
    const trade = await autorun();
    check(has(trade, "鉄は、鳴らしてから売る方が高い") && has(trade, "鐘が鳴ったら戻る"), "マルゴ（取り引き） " + JSON.stringify(trade));
    check((await vr(VAR.prisonBell)) === 4 && (await pageOf("シャノ（食卓）")) === 2, "取り引きのあと（変数 165・シャノがいない）");
    // ブルーノを呼び、記録院の札を持って鳴らす
    await game.eval(id => { Hai.Companions.summon(5); $gameParty.gainItem($dataItems[id], 1); }, ITEM.archiveTag);
    check(await sw(SW.bruno), "ブルーノを呼んでもスイッチ 138 が立たない");
    const named = await autorun(); // 輪のあとの名乗り（砦にいる間に呼んだので、すぐ出る）
    check(has(named, "僕は、ブルーノといいます") && has(named, "たぶん、最後の"), "輪のあとの名乗り " + JSON.stringify(named));
    await go(BELL_ROOM, 13, 8, 8);
    const ring = await talk(["綱を引く"]);
    // W19（P16 #256 の気づき）：取り引きのあと（変数 165＝4）は「鐘を外す」を出さない
    check(ring.some(p => p.endsWith("［綱を引く／やめる］")) && !has(ring, "鐘を外す"), "変数 165＝4 の選択肢 " + JSON.stringify(ring));
    check(has(ring, "ブルーノ「これが、営倉の鐘ですか。") && has(ring, "鐘が鳴る。") && has(ring, "鳴らなかった。") && has(ring, "同じ日だ"), "ブルーノと鳴らす " + JSON.stringify(ring));
    check((await sw(SW.bellPrison)) && !(await sw(SW.bellFirst)) && (await vr(VAR.prisonBell)) === 2, "鳴らしたあと（101・310 は立たない・変数 165＝2）");
    await game.shot("bell-with-bruno");
    await go(BELL_ROOM, 18, 5, 8);
    const hook = await talk();
    check(has(hook, "四つとも同じ色に焼けている。") && !has(hook, "札は一枚。"), "鳴らしたあとの札掛け " + JSON.stringify(hook));

    // ===== 4b. 027 で灯なしに勝ったあとのブルーノ（W19。R2 7 章 01:157）=====
    await go(DEPTHS, 24, 3, 2); // 着くと calm() で敵を全部倒した扱いにするが、灯なしと戦っていないので出ない
    check((await autorun()).length === 0, "灯なしと戦う前にブルーノの一言が出た");
    await game.eval(() => { $gameTroop.setup(329); $gameTroop.members().forEach(m => m.setHp(0)); }); // 灯なし（Troops 329）に勝ったあと
    const lamp = await autorun();
    check(has(lamp, "ブルーノ「数えると、平気です。"), "灯なしのあとのブルーノ " + JSON.stringify(lamp));
    await go(DEPTHS, 24, 3, 2);
    check((await autorun()).length === 0, "灯なしのあとのブルーノがくり返す");

    // ===== 5. 鐘のあとの砦：名乗り・マルゴ二度目・アデルの講義・梁の上のシャノ・アデルの席 =====
    await setSw(SW.adele);
    await setVar(VAR.bellIron, 1);
    await go(KEEP, 25, 27, 8);
    const back = await autorun();
    check(!has(back, "僕は、ブルーノといいます"), "名乗りがくり返す " + JSON.stringify(back));
    check(has(back, "マルゴ「鳴らしたね") && has(back, "［店］") && (await sw(SW.margoTwice)), "マルゴ二度目（鋏の店） " + JSON.stringify(back));
    check((await errand("prisonBell")).result === "done", "頼みごと「営倉の鐘を売る」が終わらない");
    check(has(back, "ブルーノ「……その巻き方は、違います") && has(back, "アデル「今のは試し"), "アデルの講義 " + JSON.stringify(back));
    check((await autorun()).length === 0, "自動実行がくり返す");
    await game.shot("after-bell");
    await go(KEEP, 30, 27, 8); // 梁の上のシャノ (30,26) の隣から話す（W18 #258。前は真下のマスに乗らないと話せなかった）
    const beam = await talk();
    check(has(beam, "梁の上まで登った") && has(beam, "下は、人が多い"), "梁の上のシャノ " + JSON.stringify(beam));
    await game.eval(id => $gameParty.gainItem($dataItems[id], 1), ITEM.bellIron);
    const adele = ev("アデル（食卓）");
    await go(KEEP, adele.x, adele.y - 1, 2);
    const give = await talk();
    check(has(give, "白い鉄が炉の火を返した。") && (await vr(VAR.bellIron)) === 2 && (await vr(VAR.summitTools)) === 2, "アデルに鐘鉄を渡す " + JSON.stringify(give));
    check(await game.eval(id => $gameParty.numItems($dataItems[id]) === 0, ITEM.bellIron), "鐘鉄が減らない");
    check(has(await talk(), "頂の道具になる"), "渡したあとのアデル");
    const seat = ev("ブルーノの席");
    await go(KEEP, seat.x, seat.y + 1, 8);
    check(has(await talk(), "末席でいいです。"), "ブルーノの席");
    check((await game.eval(() => { const e = $gameMap.events().find(e => e.event().name === "ブルーノの席"); return e.opacity(); })) < 255, "ブルーノの席が半透明でない");

    // ===== 6. 019 夕べの数・東の眺め、033 房の列の端 =====
    await go(RAMPART, 41, 8, 6);
    await game.call("step", 6);
    // 夕べの数の頁は \. の待ちが 24 あり、一頁を出し切るのに手元で 17 秒かかる。遅い CI の機械では 1 頁の待ち（既定 30 秒）を越えるので、この会話だけ 1 頁 90 秒まで待つ
    const count = await talk([], false, SLOW_PAGE_TIMEOUT);
    check(has(count, "ブルーノ「いち、に、さん") && has(count, "さんじゅうい——") && has(count, "三十で終わりです") && has(count, "ブルーノ「灯です。塔の下に、二つ"), "夕べの数 " + JSON.stringify(count));
    // W19（R2 気になる 28）：数は全部かな
    const counting = count.filter(p => p.startsWith("ブルーノ「") && p.includes("、"));
    check(counting.some(p => p.includes("にじゅうしち")) && !counting.some(p => /[一二三四五六七八九十]、/.test(p)), "夕べの数のかな " + JSON.stringify(counting));
    await game.shot("evening-count");
    await game.call("step", 4);
    await game.call("step", 6);
    check((await game.eval(() => $gameMap.isEventRunning())) === false, "夕べの数がくり返す");
    await go(RAMPART, 42, 8, 6);
    check(has(await talk(), "影の下に、灯が二つ。"), "東の眺めの灯");
    await go(CELLS, 29, 42, 8);
    await game.call("step", 8);
    const east = await talk([], false);
    check(has(east, "同じ方を向いて立っていた。") && has(east, "ブルーノ「追って、来ません") && has(east, "……東を向いている"), "房の列の端 " + JSON.stringify(east));
    await game.call("step", 6);
    await game.frames(10);
    check((await game.eval(() => $gameMap.isEventRunning())) === false, "房の列の端の二マス目でまた出た");

    game.assertNoErrors();
  } finally {
    await game.close();
  }
});
