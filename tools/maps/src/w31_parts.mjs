// W31（#326）持ち主の遊びの直し「変な黒い丸がアイテムなのも意味不明 宝箱にして 初見じゃわからない」：地図の設定（cfg）を書き出す前に直す部品。
//   各地図の生成スクリプト（w8_maps・w9_data・w10_data・w11_data・w12_data・w13_data・w14_data・w15_story）が、
//   書き出す直前（fixW30 のあと）に fixW31(name, cfg) を呼ぶ。何度呼んでも同じ結果。試験場は触らない。
//
// 拾い物（キャラの絵が !Other1 の 1 番＝黒いトゲの丸で、アイテム・武器・防具・お金を渡すページ）を、今ある宝箱と同じ形にする：
//   渡すページ  ：絵を !Chest の閉じた箱（向き 下・パターン 0）に。足踏みを止める。
//                 拾う音（Item1・Item3）を開ける音（Chest1）に。お金は宝箱と同じく Chest1 のあとに Coin を 1 つ。
//   渡したあと  ：セルフスイッチで出るページの絵を、開いた箱（向き 上）に。優先度は「通常」（今ある宝箱と同じ。ページの中身は空のまま）
//   箱の色は、その地図のふつうの宝箱（名前が「宝箱（」で始まり、アイテムかお金を渡す物）と同じ番号。地図に無ければ近い地図の番号（020–037 は 1、ほかは 0）。
//   宝箱は開くと向きの行が変わる絵なので、向き固定は付けない。
//   拾ったときの文・名前・イベントの数と座標は変えない（床の散らしがずれないように。GAM-48）。
//   絵がタイルの拾い物（机の上の帳面など）は触らない。

const giveCodes = new Set([125, 126, 127, 128]);
/** 増やす命令か（125 お金・126 アイテム・127 武器・128 防具） */
const gives = c => giveCodes.has(c.code) && (c.code === 125 ? c.parameters[0] === 0 : c.parameters[1] === 0);
/** 黒いトゲの丸（!Other1 の 1 番） */
export const isSparkle = img => !!img && img.characterName === "!Other1" && img.characterIndex === 1;
/** アイテム・武器・防具・お金を渡すページで、絵が黒いトゲの丸 */
export const isSparklePickup = p => isSparkle(p.image) && (p.list || []).some(gives);

const isChest = img => !!img && img.characterName === "!Chest";
const sePickup = new Set(["Item1", "Item3"]);
const seOf = name => ({ code: 250, indent: 0, parameters: [{ name, volume: 90, pitch: 100, pan: 0 }] });

/** その地図のふつうの宝箱の番号（無ければ近い地図の番号） */
function chestIndex(cfg) {
  const count = {};
  for (const e of cfg.events) {
    if (!/^宝箱（/.test(e.name || "") || e.type !== "raw") continue;
    // 武器・防具の箱は一点ものの色のことがある（074 の水門守の弓）ので、アイテムとお金の箱だけで数える
    if (!e.pages[0].list.some(c => (c.code === 125 || c.code === 126) && gives(c))) continue;
    const img = e.pages[0].image;
    if (isChest(img)) count[img.characterIndex] = (count[img.characterIndex] || 0) + 1;
  }
  const best = Object.entries(count).sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
  if (best) return Number(best[0]);
  return cfg.mapId >= 20 && cfg.mapId <= 37 ? 1 : 0;
}

/** 拾う音を開ける音に（お金は Chest1 → Coin。Coin が二つ続く物は一つに） */
function chestSound(list, indent) {
  const i = list.findIndex(c => c.code === 250 && c.indent === indent);
  const name = i >= 0 ? list[i].parameters[0].name : null;
  const open = { ...seOf("Chest1"), indent };
  if (i >= 0 && sePickup.has(name)) { list[i] = open; return list; }
  if (i >= 0 && name === "Coin") {
    const coin = list[i];
    const rest = list.slice(i + 1);
    if (rest[0] && rest[0].code === 250 && rest[0].parameters[0].name === "Coin") rest.shift();
    return [...list.slice(0, i), open, coin, ...rest];
  }
  // 音が無い物は、最初に渡す命令の前に開ける音
  const g = list.findIndex(gives);
  return [...list.slice(0, g), { ...seOf("Chest1"), indent: list[g].indent }, ...list.slice(g)];
}

/** 地図の設定 cfg を直す（name は設定のファイル名。エラーの文に使う）。cfg を返す */
export function fixW31(name, cfg) {
  const mapId = cfg.mapId;
  if (!(mapId >= 10 && mapId < 900)) return cfg; // 試験場は触らない
  const index = chestIndex(cfg);
  const closed = { characterName: "!Chest", characterIndex: index, direction: 2, pattern: 0 };
  const opened = { characterName: "!Chest", characterIndex: index, direction: 8, pattern: 0 };
  for (const spec of cfg.events) {
    if (spec.type !== "raw") continue;
    spec.pages.forEach((p, i) => {
      if (!isSparklePickup(p)) return;
      const sw = p.list.find(c => c.code === 123 && c.parameters[1] === 0);
      if (!sw) throw new Error(`${name}「${spec.name}」の ${i + 1} ページ目：渡したあとのセルフスイッチが無い`);
      const ch = sw.parameters[0];
      const after = spec.pages.findIndex(q => q.conditions && q.conditions.selfSwitchValid && q.conditions.selfSwitchCh === ch);
      if (after <= i) throw new Error(`${name}「${spec.name}」：セルフスイッチ ${ch} のページが後ろに無い`);
      const q = spec.pages[after];
      if (q.image && (q.image.characterName || q.image.tileId) && !isChest(q.image)) throw new Error(`${name}「${spec.name}」：渡したあとのページに別の絵がある`);
      const giveAt = p.list.findIndex(gives);
      p.image = { ...closed };
      p.stepAnime = false;
      p.walkAnime = false;
      delete p.directionFix;
      p.list = chestSound(p.list, p.list[giveAt].indent);
      q.image = { ...opened };
      q.priorityType = 1;
      q.stepAnime = false;
      q.walkAnime = false;
      delete q.directionFix;
    });
  }
  return cfg;
}
