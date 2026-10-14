// W25（#293）品の名前と説明・倒れた者を起こす品・拾い物の表記の検査（ブラウザなし。R3 困る 1・2、気になる 9）：
//   ゲームで渡す品（001–899 のマップの「アイテムの増減」で増やす品）の説明と来歴に、前の世界の言葉と全角の数字が残っていない。1 行は全角 40 字まで
//   持-8：7 煎じ薬・8 濃い煎じ薬（持ち主の OK 2026-10-15）。143 気付け薬の説明の頭が「倒れた者には効かない」
//   倒れた者を起こす品（Items 1156 供え酒）が戦闘不能を治し、地域一（020–037）の宝箱から手に入る
//   入手の文は「〜を手に入れた。」の形（「！」で終えない）で、\I[n] が品のアイコン番号と同じ
import fs from "node:fs";
import path from "node:path";
import { check, runTest, ROOT } from "./lib.mjs";
import { readData } from "../tools/data/io.mjs";

const REVIVE = 1156;
const OLD_WORDS = ["聖女", "魚人", "蘇生師", "宮廷", "看取り", "看守", "牢獄の間", "叡智", "聖灰", "更生牢", "異端", "賢者", "ポーション"];
const FULL_DIGITS = /[０-９ＨＭＳＰ]/;

await runTest(async () => {
  const items = readData("Items.json");
  const maps = fs.readdirSync(path.join(ROOT, "data")).filter(f => /^Map\d{3}\.json$/.test(f) && Number(f.slice(3, 6)) < 900);

  // 001–899 のマップで渡す品と、その場所
  const given = new Map(); // id → ["020 ev19", …]
  const texts = []; // [マップ, 文]
  for (const f of maps) {
    const map = readData(f);
    for (const ev of map.events || []) {
      if (!ev) continue;
      for (const page of ev.pages) {
        for (const c of page.list || []) {
          if (c.code === 126 && c.parameters[1] === 0 && c.parameters[2] === 0) {
            const at = `${f.slice(3, 6)} ev${ev.id}(${ev.x},${ev.y})`;
            given.set(c.parameters[0], [...(given.get(c.parameters[0]) || []), at]);
          }
          if (c.code === 401) texts.push([f.slice(3, 6), c.parameters[0]]);
        }
      }
    }
  }

  // 1. 渡す品の説明と来歴
  for (const id of given.keys()) {
    const item = items[id];
    check(item && item.name, `Items ${id} が無いのに渡している（${given.get(id)[0]}）`);
    const lines = [...item.description.split("\n"), ...item.note.split("\n").filter(l => !l.startsWith("<"))];
    for (const line of lines) {
      check([...line].length <= 40, `Items ${id} ${item.name} の行が全角 40 字を超える：${line}`);
      check(!FULL_DIGITS.test(line), `Items ${id} ${item.name} に全角の数字か ＨＰ・ＳＰ が残る：${line}`);
      for (const w of OLD_WORDS) check(!line.includes(w) && !item.name.includes(w), `Items ${id} ${item.name} に前の世界の言葉「${w}」：${line}`);
    }
  }
  check(items[7].name === "煎じ薬" && items[8].name === "濃い煎じ薬", `持-8 の名前 ${items[7].name}・${items[8].name}`);
  check(items[143].description.startsWith("倒れた者には効かない"), "気付け薬の説明の頭が「倒れた者には効かない」でない：" + items[143].description);

  // 2. 倒れた者を起こす品
  const revive = items[REVIVE];
  check(revive.name === "供え酒" && revive.scope === 9 && revive.occasion === 0, `Items ${REVIVE} の名前・範囲・使える時 ${revive.name} ${revive.scope} ${revive.occasion}`);
  check(revive.effects.some(e => e.code === 22 && e.dataId === 1), `Items ${REVIVE} が戦闘不能を治さない`);
  check(revive.damage.type === 3 && revive.damage.formula === "b.mhp / 4", `Items ${REVIVE} の HP の戻し方 ${JSON.stringify(revive.damage)}`);
  const region1 = (given.get(REVIVE) || []).filter(at => { const m = Number(at.slice(0, 3)); return m >= 20 && m <= 37; });
  check(region1.length >= 1, `Items ${REVIVE} が地域一（020–037）で手に入らない ${JSON.stringify(given.get(REVIVE))}`);

  // 3. 入手の文
  const byName = new Map();
  for (const table of ["Items.json", "Weapons.json", "Armors.json"]) {
    for (const x of readData(table)) if (x && x.name && !byName.has(x.name)) byName.set(x.name, x.iconIndex);
  }
  let n = 0;
  for (const [map, text] of texts) {
    check(!/を手に入れた！/.test(text), `${map}：入手の文が「！」で終わる：${text}`);
    const m = text.match(/^\\I\[(\d+)\](.+?)(?:×\d+)?を手に入れた/);
    if (!m || !byName.has(m[2])) continue;
    n++;
    check(Number(m[1]) === byName.get(m[2]), `${map}：「${m[2]}」のアイコンが品と違う（文 ${m[1]}・品 ${byName.get(m[2])}）`);
  }
  console.log(`  渡す品 ${given.size} 種・入手の文 ${n} 件・供え酒 ${region1.join("、")}：問題なし`);
});
