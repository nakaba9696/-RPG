// V4・V5 新しい世界の見た目：地域ごとのタイルセット・色調・霧と灰（tools/maps/looks.json）。
//   1. ブラウザなし：looks.json の 15 の地域（V4 の 11 と V5 の 4）が揃い、どの場所もタイルセット（V_ で始まる名前・画像が在る）・凡例（同じタイルセットか、
//      A〜C が同梱のダンジョンと同じ）・曲・環境音・戦闘の背景のファイルが在る。見本のマップ 916–918・920・921 の設定が looks.json の先頭の場所と同じ。
//      スタンプ（looks.json の stamps）は、使えるタイルセットの B〜E の画像がそろい、見本のマップ 920・921 の設定と同じ。
//   2. どの場所のメモ欄も Hai_MapTone が読める（色調・遠景・暗がり・霧・灰）。遠景の絵が在る。
//   3. 地域ごとに見本のマップに入り、先頭の場所の見た目を掛けて撮る（製品のマップは今のメモ欄の代わりに looks.json の値を掛ける）。
//      霧のある地域は霧の層が見え、灰のある地域は灰の粒が強さ × 10 個ある。最後に 15 枚と縄張りの 1 枚を 1 枚に並べた絵を撮る。
//   4. 霧：霧の層で画面が明るくなる。プラグインコマンド fog 0 で 1 秒ほどで消え、fogReset で戻る。
//      灰：粒は落ちていく。プラグインコマンド ash で数が変わり、0 で止まり、ashReset で戻る。
//   5. 門叩きの縄張り（V5）：プラグインコマンド lair west で、西の谷のマップ（080）の色調が「縄張りの色調の差」だけ暗くなり、霧が足される。
//      ほかの地域（070）は変わらない。lairReset で戻る。
import fs from "node:fs";
import path from "node:path";
import { launchGame, check, runTest, ROOT, OUT_DIR } from "./lib.mjs";
import { readData } from "../tools/data/io.mjs";
import { readSource, findChars, LEGEND_PATH } from "../tools/maps/build.mjs";

const LOOKS = JSON.parse(fs.readFileSync(path.join(ROOT, "tools", "maps", "looks.json"), "utf8"));
const LEGEND = JSON.parse(fs.readFileSync(LEGEND_PATH, "utf8"));
// 見本のマップ（文字マップ）。境山の高み（heights）は頂の見本 918 に高みの値を掛けて撮る。
const SAMPLES = { 918: "v4_918_summit", 916: "v4_916_undercity", 917: "v4_917_foundry", 920: "v5_920_highway", 921: "v5_921_monastery" };
// 見本のマップの設定が先頭の場所と同じでなければならない地域
const OWN_SAMPLE = { summit: 918, undercity: 916, foundry: 917, highway: 920, monastery: 921 };
// issue #137 の地域（砦・霧の森・鉄の坑道・営倉・焼けた村・記録院・霧の湖・地下水道と地下都市・境山の古道・鋳物場と研究所・山の頂）と
// issue #173 の地域（麦の街道と関所・鐘守の修道院・門叩きの縄張り・境山の高み）
const KEYS = ["fort", "forest", "mine", "prison", "village", "archive", "lake", "undercity", "pass", "foundry", "summit", "highway", "monastery", "lair", "heights"];
const exists = (...p) => fs.existsSync(path.join(ROOT, ...p));

// --- 1. ブラウザなし ---
function checkData() {
  const tilesets = readData("Tilesets.json");
  const infos = readData("MapInfos.json");
  check(LOOKS.regions.map(r => r.key).join() === KEYS.join(), "looks.json の地域が issue #137・#173 の 15 と違う：" + LOOKS.regions.map(r => r.key).join());
  const dungeonAC = tilesets[4].tilesetNames.slice(0, 7).join();
  let places = 0;
  for (const region of LOOKS.regions) {
    check(region.places.length > 0, `${region.name} に場所がない`);
    check(infos[region.sample], `${region.name} の見本のマップ ${region.sample} が MapInfos.json にない`);
    for (const p of region.places) {
      const where = `${region.name}「${p.name}」`;
      const ts = tilesets[p.tilesetId];
      check(p.tilesetId >= 11 && p.tilesetId <= 30 && ts && /^V_/.test(ts.name), `${where} のタイルセット ${p.tilesetId} が V の帯の V_ でない`);
      for (const image of ts.tilesetNames.filter(Boolean)) check(exists("img", "tilesets", image + ".png"), `${where} の画像 ${image} が無い`);
      const set = LEGEND.sets[p.legend];
      check(set, `${where} の凡例 ${p.legend} が legend.json にない`);
      check(
        set.tilesetId === p.tilesetId || (p.legend === "dungeon" && ts.tilesetNames.slice(0, 7).join() === dungeonAC),
        `${where} の凡例 ${p.legend}（タイルセット ${set.tilesetId}）がタイルセット ${p.tilesetId} で使えない`
      );
      check(exists("audio", "bgm", p.bgm.name + ".ogg") && p.bgm.volume > 0 && p.bgm.volume <= 80, `${where} の BGM ${JSON.stringify(p.bgm)}`);
      if (p.bgs) check(exists("audio", "bgs", p.bgs.name + ".ogg") && p.bgs.volume > 0 && p.bgs.volume <= 60, `${where} の BGS ${JSON.stringify(p.bgs)}`);
      if (p.battleback) {
        check(exists("img", "battlebacks1", p.battleback[0] + ".png"), `${where} の戦闘の背景 1 ${p.battleback[0]} が無い`);
        check(exists("img", "battlebacks2", p.battleback[1] + ".png"), `${where} の戦闘の背景 2 ${p.battleback[1]} が無い`);
      }
      const parallax = /<hai_parallax:([^,>]+)/.exec(p.note);
      if (parallax) check(exists("img", "parallaxes", parallax[1] + ".png"), `${where} の遠景 ${parallax[1]} が無い`);
      places++;
    }
  }
  // 見本のマップ 916–918・920・921 は looks.json の先頭の場所と同じ
  for (const region of LOOKS.regions.filter(r => OWN_SAMPLE[r.key])) {
    check(region.sample === OWN_SAMPLE[region.key], `${region.name} の見本のマップが ${OWN_SAMPLE[region.key]} でない`);
    const p = region.places[0];
    const map = readData(`Map${region.sample}.json`);
    check(map.tilesetId === p.tilesetId, `Map${region.sample} のタイルセット ${map.tilesetId} が looks.json の ${p.tilesetId} と違う`);
    check(map.note === p.note, `Map${region.sample} のメモ欄が looks.json と違う`);
    check(map.bgm.name === p.bgm.name && map.bgs.name === p.bgs.name && map.autoplayBgm, `Map${region.sample} の曲が looks.json と違う`);
    check(map.specifyBattleback && map.battleback1Name === p.battleback[0] && map.battleback2Name === p.battleback[1], `Map${region.sample} の戦闘の背景が looks.json と違う`);
  }
  console.log(`  地域 ${LOOKS.regions.length}、場所 ${places}：タイルセット・凡例・曲・環境音・戦闘の背景・遠景のファイルが在る`);

  // スタンプ：使えるタイルセットは、スタンプが使う B〜E の画像が 1 つ目と同じ。見本のマップの設定のスタンプは looks.json と同じ形
  const stamps = Object.entries(LOOKS.stamps).filter(([k]) => !k.startsWith("_"));
  const used = new Set();
  for (const [key, st] of stamps) {
    const letters = new Set([...st.tiles, ...(st.upper || [])].flat().filter(Boolean).map(t => t.split(":")[0]));
    const images = id => [...letters].map(l => tilesets[id].tilesetNames[5 + "BCDE".indexOf(l)]).join();
    check(st.tilesets.length > 0 && st.tilesets.every(id => images(id) === images(st.tilesets[0])), `スタンプ ${key} の使えるタイルセット ${st.tilesets} の画像がそろわない`);
  }
  for (const name of Object.values(SAMPLES).filter(n => n.startsWith("v5_"))) {
    const config = JSON.parse(fs.readFileSync(path.join(ROOT, "tools", "maps", "src", name + ".json"), "utf8"));
    for (const st of config.stamps || []) {
      const hit = stamps.find(([, s]) => s.name === st.name);
      check(hit, `${name} のスタンプ「${st.name}」が looks.json の stamps に無い`);
      if (!hit) continue;
      check(JSON.stringify([st.tiles, st.upper || null]) === JSON.stringify([hit[1].tiles, hit[1].upper || null]), `${name} のスタンプ「${st.name}」の形が looks.json と違う`);
      check(hit[1].tilesets.includes(config.tilesetId), `${name} のタイルセット ${config.tilesetId} でスタンプ「${st.name}」は使えない`);
      used.add(hit[0]);
    }
  }
  check(stamps.every(([k]) => used.has(k)), `見本のマップで使っていないスタンプ：${stamps.map(([k]) => k).filter(k => !used.has(k))}`);
  console.log(`  スタンプ ${stamps.length}：使えるタイルセットの画像がそろい、見本のマップ 920・921 が同じ形で使う`);
}

await runTest(async () => {
  checkData();

  const game = await launchGame();
  try {
    await game.call("newGame");
    await game.waitScene("Scene_Map");

    // --- 2. どの場所のメモ欄も読める ---
    const notes = LOOKS.regions.flatMap(r => r.places.map(p => ({ where: `${r.name}「${p.name}」`, note: p.note })));
    const parsed = await game.eval(list => {
      return list.map(({ where, note }) => {
        const obj = { note };
        DataManager.extractMetadata(obj);
        const M = Hai.MapTone;
        const tags = (note.match(/<hai_(\w+)/g) || []).map(s => s.slice(5));
        return { where, tags, tone: M.parseTone(obj.meta), parallax: M.parseParallax(obj.meta), dark: M.parseDark(obj.meta), fog: M.parseFog(obj.meta), ash: M.parseAsh(obj.meta) };
      });
    }, notes);
    for (const p of parsed) {
      check(p.tone, `${p.where} に色調が無い`);
      for (const tag of p.tags) check(["tone", "parallax", "dark", "fog", "ash"].includes(tag) && p[tag], `${p.where} の <hai_${tag}> が読めない`);
    }
    console.log(`  メモ欄 ${parsed.length} 個：色調・遠景・暗がり・霧・灰が読める`);

    // --- 3. 地域ごとに撮る ---
    const shots = [];
    for (const region of LOOKS.regions) {
      const p = region.places[0];
      const id = region.sample;
      let start = null;
      if (SAMPLES[id]) {
        const [s] = findChars(readSource(SAMPLES[id]).lines, "S");
        start = [s.x, s.y];
      }
      await game.call("transfer", id, start ? start[0] : 1, start ? start[1] : 1, 2);
      await game.waitFor(m => window.__game.mapId() === m && !window.__game.isBusy(), id);
      const got = await game.eval(
        ({ note, start }) => {
          // 製品のマップ（前の世界の形のまま）は、今のメモ欄の代わりに looks.json の値を掛ける。シンボル敵は止める（撮る間に戦闘にならないように）。
          if ($dataMap.note !== note) {
            $dataMap.note = note;
            DataManager.extractMetadata($dataMap);
            $gameScreen.startTint(Hai.MapTone.parseTone($dataMap.meta) || [0, 0, 0, 0], 0);
            $gameMap.setupParallax();
          }
          for (const e of $gameMap.events()) if (/hai_enemy/.test(e.event().note)) e.erase();
          SceneManager._scene._mapNameWindow.hide(); // 製品のマップの表示名は前の世界のまま（見本の絵では下の説明に地域の名を書く）
          if (!start) {
            // 地図の真ん中にいちばん近い、歩けてイベントの無いマス
            const cx = $gameMap.width() / 2;
            const cy = $gameMap.height() / 2;
            let best = null;
            for (let y = 1; y < $gameMap.height() - 1; y++) {
              for (let x = 1; x < $gameMap.width() - 1; x++) {
                if (![2, 4, 6, 8].every(d => $gameMap.isPassable(x, y, d)) || $gameMap.eventsXy(x, y).length) continue;
                const d = (x - cx) ** 2 + (y - cy) ** 2;
                if (!best || d < best.d) best = { x, y, d };
              }
            }
            $gamePlayer.locate(best.x, best.y);
          }
          return { tileset: $gameMap.tilesetId(), tone: $gameScreen.tone().slice() };
        },
        { note: p.note, start }
      );
      check(got.tileset === p.tilesetId, `${region.name}：見本のマップ ${id} のタイルセット ${got.tileset} が ${p.tilesetId} でない`);
      await game.waitFor(() => SceneManager._scene._spriteset._tilemap.isReady() && ImageManager.isReady());
      await game.frames(40);
      const fx = await game.eval(() => {
        const s = SceneManager._scene._spriteset;
        return {
          tone: $gameScreen.tone().slice(),
          fog: Hai.MapTone.fog(),
          fogVisible: s._haiFogSprite.visible,
          ash: Hai.MapTone.ash(),
          flakes: s._haiAshSprite.visible ? s._haiAshSprite.children.length : 0,
          parallax: $gameMap.parallaxName(),
        };
      });
      const want = parsed.find(q => q.where === `${region.name}「${p.name}」`);
      check(fx.tone.join() === want.tone.join(), `${region.name} の色調 ${fx.tone} が ${want.tone} でない`);
      check(fx.fogVisible === !!want.fog, `${region.name} の霧の層 ${fx.fogVisible}（タグ ${JSON.stringify(want.fog)}）`);
      check(fx.flakes === (want.ash ? want.ash.power * 10 : 0), `${region.name} の灰の粒 ${fx.flakes}（タグ ${JSON.stringify(want.ash)}）`);
      if (want.parallax) check(fx.parallax === want.parallax.name, `${region.name} の遠景 ${fx.parallax} が ${want.parallax.name} でない`);
      const file = await game.shot(`${region.key}-ts${p.tilesetId}`);
      shots.push({ file, label: `${region.name}（${region.maps}）タイルセット ${p.tilesetId}`, sub: p.note.replace(/\n/g, " ") });
      console.log(`  ${region.name}：Map${id}、タイルセット ${p.tilesetId}、霧 ${fx.fogVisible ? fx.fog.density : "なし"}、灰 ${fx.flakes}`);
    }

    // --- 4. 霧と灰の動き（霧の森の見本 Map020 で） ---
    await game.call("transfer", 20, 1, 1, 2);
    await game.waitFor(() => window.__game.mapId() === 20 && !window.__game.isBusy());
    const forest = LOOKS.regions.find(r => r.key === "forest").places[0];
    await game.eval(note => {
      $dataMap.note = note;
      DataManager.extractMetadata($dataMap);
      $gameScreen.startTint([0, 0, 0, 0], 0);
      for (const e of $gameMap.events()) if (/hai_enemy/.test(e.event().note)) e.erase();
    }, forest.note);
    await game.frames(10);
    // 霧の層の有り無しを同じフレームの中で比べる（フレームが進むと霧の層は自分で見える状態に戻る）
    const [withFog, noFog] = await game.eval(() => {
      const fog = SceneManager._scene._spriteset._haiFogSprite;
      const mean = () => {
        const snap = SceneManager.snap();
        const d = snap.context.getImageData(0, 96, 1280, 720 - 96).data;
        let sum = 0;
        for (let i = 0; i < d.length; i += 4) sum += (d[i] + d[i + 1] + d[i + 2]) / 3;
        snap.destroy();
        return sum / (d.length / 4);
      };
      const a = mean();
      fog.visible = false;
      const b = mean();
      fog.visible = true;
      return [a, b];
    });
    check(withFog > noFog + 5, `霧で画面が明るくならない（霧あり ${withFog.toFixed(1)}、なし ${noFog.toFixed(1)}）`);
    console.log(`  霧：画素の平均 ${noFog.toFixed(1)} → ${withFog.toFixed(1)}`);

    await game.eval(() => PluginManager.callCommand($gameMap._interpreter, "Hai_MapTone", "fog", { density: "0" }));
    await game.frames(3);
    check(!(await game.eval(() => Hai.MapTone.fog())), "fog 0 で霧が消えない");
    const fading = await game.eval(() => SceneManager._scene._spriteset._haiFogSprite.opacity);
    await game.frames(70);
    const gone = await game.eval(() => SceneManager._scene._spriteset._haiFogSprite.visible);
    check(fading > 0 && !gone, `霧が徐々に引かない（3 フレーム後の濃さ ${fading}、70 フレーム後も見える ${gone}）`);
    await game.eval(() => PluginManager.callCommand($gameMap._interpreter, "Hai_MapTone", "fogReset", {}));
    await game.frames(5);
    check((await game.eval(() => Hai.MapTone.fog())).density === 120, "fogReset で霧が戻らない");

    // 灰：粒が下へ動く（焼けた村の値を掛ける）
    const village = LOOKS.regions.find(r => r.key === "village").places[0];
    await game.eval(note => {
      $dataMap.note = note;
      DataManager.extractMetadata($dataMap);
    }, village.note);
    await game.frames(3);
    const y0 = await game.eval(() => SceneManager._scene._spriteset._haiAshSprite.children.map(f => f.y));
    await game.frames(20);
    const y1 = await game.eval(() => SceneManager._scene._spriteset._haiAshSprite.children.map(f => f.y));
    const fell = y1.filter((y, i) => y > y0[i]).length;
    const villageAsh = Number(/<hai_ash:(\d+)/.exec(village.note)[1]);
    check(y0.length === villageAsh * 10 && fell > y0.length * 0.6, `灰の粒が落ちていない（${fell}/${y0.length}）`);
    console.log(`  灰：${y0.length} 粒のうち ${fell} 粒が 20 フレームで下へ動いた`);

    // プラグインコマンド ash で強さを変える（鐘を鳴らした数で薄くする）。0 で止まり、ashReset で戻る。
    await game.eval(() => PluginManager.callCommand($gameMap._interpreter, "Hai_MapTone", "ash", { power: "1" }));
    await game.frames(2);
    check((await game.eval(() => SceneManager._scene._spriteset._haiAshSprite.children.length)) === 10, "ash 1 で灰の粒が 10 にならない");
    await game.eval(() => PluginManager.callCommand($gameMap._interpreter, "Hai_MapTone", "ash", { power: "0" }));
    await game.frames(2);
    check(!(await game.eval(() => Hai.MapTone.ash() || SceneManager._scene._spriteset._haiAshSprite.visible)), "ash 0 で灰が止まらない");
    await game.eval(() => PluginManager.callCommand($gameMap._interpreter, "Hai_MapTone", "ashReset", {}));
    await game.frames(2);
    check((await game.eval(() => Hai.MapTone.ash().power)) === villageAsh, "ashReset で灰が戻らない");

    // --- 5. 門叩きの縄張り：lair で地域の色調が暗くなり、霧が足される ---
    const lair = await game.eval(() => ({ params: Hai.MapTone.params, area80: Hai.MapTone.areaOf(80), area70: Hai.MapTone.areaOf(70), area110: Hai.MapTone.areaOf(110) }));
    check(lair.area80 === "west" && lair.area110 === "west" && lair.area70 === "south", `縄張りの地域の読み方が違う：${JSON.stringify(lair)}`);
    const enter = async (id, x, y) => {
      await game.call("transfer", id, x, y, 2);
      await game.waitFor(m => window.__game.mapId() === m && !window.__game.isBusy(), id);
      await game.eval(() => {
        for (const e of $gameMap.events()) if (/hai_enemy/.test(e.event().note)) e.erase();
        SceneManager._scene._mapNameWindow.hide();
        // 地図の真ん中にいちばん近い、歩けてイベントの無いマス（撮る絵のため）
        let best = null;
        for (let y = 1; y < $gameMap.height() - 1; y++) {
          for (let x = 1; x < $gameMap.width() - 1; x++) {
            if (![2, 4, 6, 8].every(d => $gameMap.isPassable(x, y, d)) || $gameMap.eventsXy(x, y).length) continue;
            const d = (x - $gameMap.width() / 2) ** 2 + (y - $gameMap.height() / 2) ** 2;
            if (!best || d < best.d) best = { x, y, d };
          }
        }
        $gamePlayer.locate(best.x, best.y);
      });
      await game.frames(5);
      return game.eval(() => ({ tone: $gameScreen.tone().slice(), base: Hai.MapTone.parseTone($dataMap.meta) || [0, 0, 0, 0], fog: Hai.MapTone.fog(), here: Hai.MapTone.lairHere() }));
    };
    const plain = await enter(80, 1, 1);
    check(!plain.here && plain.tone.join() === plain.base.join(), `縄張りの前の 080 の色調 ${plain.tone}`);
    await game.eval(() => PluginManager.callCommand($gameMap._interpreter, "Hai_MapTone", "lair", { area: "west" }));
    await game.frames(70);
    const shaded = await game.eval(() => ({ tone: $gameScreen.tone().slice(), fog: Hai.MapTone.fog(), here: Hai.MapTone.lairHere(), lair: Hai.MapTone.lair() }));
    const want = plain.base.map((v, i) => Math.max(i === 3 ? 0 : -255, Math.min(255, v + lair.params.lairTone[i])));
    check(shaded.here && shaded.lair === "west" && shaded.tone.join() === want.join(), `lair west で 080 の色調が ${want} にならない：${shaded.tone}`);
    check(shaded.fog && shaded.fog.density === Math.min(255, (plain.fog ? plain.fog.density : 0) + lair.params.lairFog), `lair west で 080 の霧が足されない：${JSON.stringify(shaded.fog)}`);
    await game.waitFor(() => SceneManager._scene._spriteset._tilemap.isReady() && ImageManager.isReady());
    await game.frames(20);
    const lairFile = await game.shot("lair-west-080");
    const south = await enter(70, 1, 1);
    check(!south.here && south.tone.join() === south.base.join(), `縄張りでない 070 の色調が変わった：${south.tone}`);
    const again = await enter(80, 1, 1);
    check(again.here && again.tone.join() === want.join(), `080 に入り直すと縄張りの色調にならない：${again.tone}`);
    await game.eval(() => PluginManager.callCommand($gameMap._interpreter, "Hai_MapTone", "lairReset", {}));
    await game.frames(70);
    const reset = await game.eval(() => ({ tone: $gameScreen.tone().slice(), here: Hai.MapTone.lairHere(), lair: Hai.MapTone.lair() }));
    check(!reset.here && reset.lair === null && reset.tone.join() === plain.base.join(), `lairReset で 080 の色調が戻らない：${reset.tone}`);
    shots.push({ file: lairFile, label: "縄張りになった西の谷（記録院 080。lair west）", sub: `色調 ${want}、霧 +${lair.params.lairFog}（元の 080 のメモ欄に足す）` });
    console.log(`  縄張り：080 の色調 ${plain.base} → ${want}、霧 ${plain.fog ? plain.fog.density : 0} → ${shaded.fog.density}。070 は変わらず、lairReset で戻る`);

    game.assertNoErrors();

    // 地域の絵を 1 枚に並べる（PR に載せる見本）
    const sheet = await game.page.context().newPage();
    await sheet.setViewportSize({ width: 1280, height: 720 });
    const cells = shots
      .map(s => `<figure><img src="data:image/png;base64,${fs.readFileSync(s.file).toString("base64")}"><figcaption><b>${s.label}</b><br>${s.sub.replace(/</g, "&lt;")}</figcaption></figure>`)
      .join("");
    await sheet.setContent(
      `<html><body style="margin:0;background:#111;color:#ddd;font:12px sans-serif"><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;padding:6px">${cells}</div>` +
        `<style>figure{margin:0}img{width:100%;display:block}figcaption{padding:2px 4px;line-height:1.35}</style></body></html>`
    );
    const sheetFile = path.join(OUT_DIR, "v_regions-sheet.png");
    await sheet.screenshot({ path: sheetFile, fullPage: true });
    await sheet.close();
    console.log(`  スクリーンショット: ${path.relative(ROOT, sheetFile)}（${shots.length} 枚を並べた見本）`);
  } finally {
    await game.close();
  }
});
