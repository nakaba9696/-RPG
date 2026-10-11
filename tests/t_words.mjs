// 禁止語の表と文章の癖（T7、ブラウザなし）：プレイヤーに見える文を data/ から集めて点検する。
//   落とす：world.md 10 章の禁止語 / 窓の幅（顔なし全角 46 字・顔あり 40 字）/ 制御文字の壊れ
//   報告だけ：knowhow.md 4.2 の「避ける癖」のうち数えられるもの → tests/out/t_words-report.md
// 壊した例（禁止語・47 字の行・閉じていない \C[）は data/ の写しを一時フォルダに作って確かめる（data/ は触らない）。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { check, runTest, OUT_DIR } from "./lib.mjs";
import { DATA_DIR, ROOT } from "../tools/data/io.mjs";

const NO_FACE_WIDTH = 46;
const FACE_WIDTH = 40;

// ---- 一時の許可表 ----------------------------------------------------------------------------
// 既存のデータで当たった所。直すのは W（docs/rewrite.md の表）。直したらここから消す。
// 形：{ kind: "word"|"width"|"control", where: "場所の文字列に含まれる語", note: "rewrite.md の #n で直す" }
const TEMP_ALLOW = [];

// ---- 読み出し ---------------------------------------------------------------------------------
const readJson = (dir, name) => JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));

/** world.md 10 章の表 → [{ word, stage, allowed: "なし" | Set<マップ番号の数>, reason }] */
export function loadBannedWords(worldPath = path.join(ROOT, "docs", "world.md")) {
  const text = fs.readFileSync(worldPath, "utf8");
  const start = text.indexOf("## 10. 禁止語の表");
  check(start >= 0, "world.md に「## 10. 禁止語の表」が無い");
  const rest = text.slice(start + 5);
  const end = rest.search(/\n## /);
  const section = end >= 0 ? rest.slice(0, end) : rest;
  const rows = [];
  for (const line of section.split("\n")) {
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map(c => c.trim());
    if (cells.length < 4 || cells[0] === "語" || /^-+$/.test(cells[0])) continue;
    const allowedCell = cells[2];
    const allowed = allowedCell === "なし" ? null : new Set(allowedCell.split(",").map(s => Number(s.trim())));
    check(allowed === null || [...allowed].every(n => Number.isInteger(n)), `禁止語「${cells[0]}」の使ってよい所が読めない: ${allowedCell}`);
    rows.push({ word: cells[0], stage: cells[1], allowed, reason: cells[3] });
  }
  check(rows.length >= 10, `禁止語の表が読めていない（${rows.length} 行）`);
  return rows;
}

/** note から <hai_tag:text> の text を取り出す（プレイヤーに見える文を持つタグ）。 */
const TEXT_TAGS = ["wake", "clue", "locked"];
function noteTexts(note) {
  const out = [];
  for (const tag of TEXT_TAGS) {
    for (const m of String(note || "").matchAll(new RegExp(`<hai_${tag}:([^>]*)>`, "g"))) out.push({ tag, text: m[1] });
  }
  return out;
}

/**
 * プレイヤーに見える文を集める。
 * 戻り値の各要素：{ where, text, mapId (数かnull), kind: "line"|"choice"|"db", face (bool), page (ページを表す鍵 | null), seqEnd (401 の並びの最後か) }
 */
export function collectTexts(dir) {
  const texts = [];
  const mapFiles = fs.readdirSync(dir).filter(f => /^Map\d{3}\.json$/.test(f)).sort();
  for (const f of mapFiles) {
    const mapId = Number(f.slice(3, 6));
    const map = readJson(dir, f);
    for (const ev of map.events || []) {
      if (!ev) continue;
      for (const t of noteTexts(ev.note)) texts.push({ where: `data/${f} (${ev.x},${ev.y})「${ev.name}」メモ <hai_${t.tag}>`, text: t.text, mapId, kind: "db", face: false, page: null });
      (ev.pages || []).forEach((page, pi) => {
        const list = page.list || [];
        const pageKey = `${f}#${ev.id}#${pi}`;
        let face = false;
        for (let i = 0; i < list.length; i++) {
          const c = list[i];
          const where = `data/${f} (${ev.x},${ev.y})「${ev.name}」ページ${pi + 1}`;
          if (c.code === 101) face = !!(c.parameters[0]);
          else if (c.code === 401) {
            texts.push({ where: `${where} の文章の表示`, text: String(c.parameters[0] ?? ""), mapId, kind: "line", face, page: pageKey, seqEnd: !list[i + 1] || list[i + 1].code !== 401 });
          } else if (c.code === 102) {
            (c.parameters[0] || []).forEach(s => texts.push({ where: `${where} の選択肢`, text: String(s), mapId, kind: "choice", face: false, page: pageKey }));
          }
        }
      });
    }
  }
  // データベース
  const FIELDS = {
    "Actors.json": ["name", "nickname", "profile"],
    "Items.json": ["name", "description"],
    "Weapons.json": ["name", "description"],
    "Armors.json": ["name", "description"],
    "Skills.json": ["name", "description", "message1", "message2"],
    "States.json": ["name", "message1", "message2", "message3", "message4"],
    "Enemies.json": ["name"],
  };
  for (const [file, fields] of Object.entries(FIELDS)) {
    const table = readJson(dir, file);
    for (const e of table) {
      if (!e) continue;
      for (const k of fields) {
        if (typeof e[k] === "string" && e[k] !== "") texts.push({ where: `data/${file}[${e.id}]「${e.name}」${k}`, text: e[k], mapId: null, kind: "db", face: false, page: null });
      }
      for (const t of noteTexts(e.note)) texts.push({ where: `data/${file}[${e.id}]「${e.name}」メモ <hai_${t.tag}>`, text: t.text, mapId: null, kind: "db", face: false, page: null });
    }
  }
  return texts;
}

// ---- 制御文字と画面に出る形 -----------------------------------------------------------------
const ZERO_WIDTH = new Set([".", "|", "!", ">", "<", "{", "}", "^", "$"]);
const WITH_NUM = new Set(["N", "V", "P", "C", "I"]);
const FW = ch => (/[ -~｡-ﾟ]/.test(ch) ? 0.5 : 1); // 半角は半分

/**
 * 制御文字を解いて、画面に出る形と幅（全角を 1 とする）と問題を返す。
 * @param {string} s
 * @param {{names: Map<number,string>, maxName: number}} ctx
 */
export function render(s, ctx) {
  let out = "";
  let width = 0;
  const problems = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch !== "\\") {
      out += ch;
      width += FW(ch);
      continue;
    }
    const nx = s[i + 1];
    if (nx === undefined) {
      problems.push("文末の \\ （制御文字が途中で切れている）");
      break;
    }
    if (nx === "\\") { out += "\\"; width += 0.5; i++; continue; }
    if (nx === "G") { out += "G"; width += 1; i++; continue; }
    if (ZERO_WIDTH.has(nx)) { i++; continue; }
    // MZ の位置とフォントの大きさ（\PX[n] \PY[n] \FS[n]）。幅 0 の既知の制御文字。\P[n]（パーティの名前）と区別する
    const pos = /^(PX|PY|FS)\[(\d+)\]/.exec(s.slice(i + 1));
    if (pos) { i += pos[0].length; continue; }
    if (/^(PX|PY|FS)/.test(s.slice(i + 1))) {
      problems.push(`\\${s.slice(i + 1, i + 3)}[ の括弧が閉じていない・番号が無い（「${s.slice(i, i + 8)}」）`);
      i += 2;
      continue;
    }
    if (WITH_NUM.has(nx)) {
      const m = /^\[(\d+)\]/.exec(s.slice(i + 2));
      if (!m) {
        problems.push(`\\${nx}[ の括弧が閉じていない・番号が無い（「${s.slice(i, i + 8)}」）`);
        i += 1;
        continue;
      }
      const n = Number(m[1]);
      if (nx === "N" || nx === "P") {
        const name = nx === "N" ? ctx.names.get(n) : null;
        if (nx === "N" && name === undefined) problems.push(`\\N[${n}] のアクターが無い`);
        out += name ?? "";
        width += nx === "N" && name ? [...name].reduce((a, c) => a + FW(c), 0) : ctx.maxName;
      } else if (nx === "V") {
        out += "0";
        width += 1; // 値は分からない。数字 2 桁ぶん
      } else if (nx === "I") {
        width += 1;
      }
      i += 1 + m[0].length;
      continue;
    }
    problems.push(`知らない制御文字 \\${nx}`);
    i += 1;
  }
  return { out, width, problems };
}

// ---- 点検 -------------------------------------------------------------------------------------
function makeCtx(dir) {
  const names = new Map();
  for (const a of readJson(dir, "Actors.json")) if (a) names.set(a.id, a.name);
  const maxName = Math.max(...[...names.values()].map(n => [...n].reduce((a, c) => a + FW(c), 0)));
  return { names, maxName };
}

const allowed = (kind, where) => TEMP_ALLOW.some(a => a.kind === kind && where.includes(a.where));

const HEDGES = ["どこか", "少しだけ", "そっと", "ふと", "かすかに", "まるで"];

/** dir の data を点検する。{ problems, report } を返す。 */
export function scan(dir, banned) {
  const ctx = makeCtx(dir);
  const texts = collectTexts(dir);
  const problems = [];
  const habits = { ellipsis: [], hedge: [], closing: [], commas: [] };
  const pageLines = new Map(); // page → 行の配列
  for (const t of texts) {
    const r = render(t.text, ctx);
    for (const p of r.problems) {
      if (!allowed("control", t.where)) problems.push(`${t.where}: 制御文字: ${p}\n      「${t.text}」`);
    }
    // 禁止語（制御文字を解いた形と、制御文字を全部取った形の両方で探す）
    const bare = r.out;
    for (const b of banned) {
      if (b.allowed && t.mapId !== null && b.allowed.has(t.mapId)) continue;
      if (b.allowed && t.mapId === null) continue; // 使ってよいマップがある語は、データベース側では見ない（人が見る）
      if (bare.includes(b.word) || t.text.includes(b.word)) {
        if (!allowed("word", t.where + b.word)) problems.push(`${t.where}: 禁止語「${b.word}」（${b.stage}）\n      「${t.text}」`);
      }
    }
    if (t.kind === "line") {
      const limit = t.face ? FACE_WIDTH : NO_FACE_WIDTH;
      if (r.width > limit && !allowed("width", t.where)) {
        problems.push(`${t.where}: 窓の幅 ${r.width} > ${limit}（${t.face ? "顔あり" : "顔なし"}）\n      「${t.text}」`);
      }
      if (!pageLines.has(t.page)) pageLines.set(t.page, { where: t.where, lines: [] });
      pageLines.get(t.page).lines.push(bare);
    }
    // 読点の打ちすぎ（文ごと）
    if (t.kind === "line" || t.kind === "db") {
      for (const sentence of bare.split(/[。！？\n]/)) {
        if ((sentence.match(/、/g) || []).length >= 4) habits.commas.push({ where: t.where, text: sentence });
      }
      if (/気がした|気がする|なぜか/.test(bare)) habits.closing.push({ where: t.where, text: bare });
    }
  }
  for (const [, { where, lines }] of pageLines) {
    const joined = lines.join("\n");
    const dots = (joined.match(/……/g) || []).length;
    if (dots >= 3) habits.ellipsis.push({ where: where.replace(" の文章の表示", ""), text: `「……」${dots} 個` });
    for (const h of HEDGES) {
      const n = joined.split(h).length - 1;
      if (n) habits.hedge.push({ where: where.replace(" の文章の表示", ""), text: `${h} ×${n}` });
    }
  }
  return { problems, habits, textCount: texts.length };
}

function writeReport(habits, textCount) {
  const section = (title, rule, items) =>
    `## ${title}（${items.length} 件）\n${rule}\n\n` + (items.map(i => `- ${i.where}\n  ${i.text.replace(/\n/g, " / ")}`).join("\n") || "（なし）") + "\n";
  const md =
    "# 文章の癖の報告（t_words）\n\n報告だけ。CI は落とさない。直し方は docs/knowhow.md 4.2、直し案の表は docs/rewrite.md。\n\n" +
    section("「……」の多用", "1 つのイベントのページに「……」が 3 つ以上", habits.ellipsis) + "\n" +
    section("ぼかし語", `ページごとの出現（${HEDGES.join("・")}）`, habits.hedge) + "\n" +
    section("締めの余韻", "「〜気がした／気がする」「なぜか」を含む行・文", habits.closing) + "\n" +
    section("読点の打ちすぎ", "1 文に読点が 4 つ以上", habits.commas);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, "t_words-report.md"), md);
  console.log(`  避ける癖（報告のみ、${textCount} 文を点検）: 「……」多用 ${habits.ellipsis.length} 件 / ぼかし語 ${habits.hedge.length} 件 / 締めの余韻 ${habits.closing.length} 件 / 読点 ${habits.commas.length} 件 → tests/out/t_words-report.md`);
}

// ---- 壊した例 ---------------------------------------------------------------------------------
/** data/ の写しを作り、edit(dir) で壊して点検する。問題の一覧を返す。 */
function broken(label, edit, banned) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hai-t-words-"));
  try {
    for (const f of fs.readdirSync(DATA_DIR)) fs.copyFileSync(path.join(DATA_DIR, f), path.join(dir, f));
    edit(dir);
    const { problems } = scan(dir, banned);
    console.log(`  壊した例「${label}」: ${problems.length} 件\n    ${problems.slice(0, 2).join("\n    ")}`);
    return problems;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** Map の最初のイベントの最初のページの末尾に、顔なしの文章 1 行を足す。 */
function addLine(file, text) {
  return dir => {
    const map = readJson(dir, file);
    const ev = map.events.find(e => e && e.pages && e.pages.length);
    const list = ev.pages[0].list;
    list.splice(list.length - 1, 0, { code: 101, indent: 0, parameters: ["", 0, 0, 2, ""] }, { code: 401, indent: 0, parameters: [text] });
    fs.writeFileSync(path.join(dir, file), JSON.stringify(map));
  };
}

await runTest(async () => {
  const banned = loadBannedWords();
  console.log(`  禁止語の表: ${banned.length} 語（なし ${banned.filter(b => !b.allowed).length}、マップ限定 ${banned.filter(b => b.allowed).length}）`);

  // 1. 今の data/
  const now = scan(DATA_DIR, banned);
  writeReport(now.habits, now.textCount);
  check(now.problems.length === 0, `禁止語・窓の幅・制御文字に ${now.problems.length} 件当たった（直し案は docs/rewrite.md、直すのは W）:\n  ` + now.problems.join("\n  "));

  // 2. 壊した例
  const expect = (label, edit, needle) => {
    const got = broken(label, edit, banned);
    check(got.some(p => p.includes(needle)), `「${label}」で「${needle}」の問題が出ない:\n  ${got.join("\n  ")}`);
  };
  expect("禁止語を 1 つ入れる", addLine("Map020.json", "あれが契約の悪魔だ。"), "禁止語「契約の悪魔」");
  expect("47 字の行", addLine("Map020.json", "あ".repeat(47)), "窓の幅 47 > 46");
  expect("閉じていない \\C[", addLine("Map020.json", "\\C[2赤い文字"), "括弧が閉じていない");
  // MZ の標準の制御文字は落ちない
  const okLine = broken("\\FS・\\PX・\\PY・\\P は落ちない", addLine("Map020.json", "\\FS[28]大きい字\\PX[10]\\PY[20]\\P[1]"), banned);
  check(okLine.length === 0, "\\FS[28] \\PX[n] \\PY[n] \\P[n] が落ちた:\n  " + okLine.join("\n  "));
  expect("閉じていない \\FS[", addLine("Map020.json", "\\FS[28大きい字"), "括弧が閉じていない");
  expect("知らない制御文字", addLine("Map020.json", "\\Z[1]あ"), "知らない制御文字");
  // 制御文字で語を割っても、画面に出る形で見つかる
  expect("制御文字で割った禁止語", addLine("Map020.json", "張\\C[2]本\\C[0]人"), "禁止語「張本人」");
  console.log("  禁止語・窓の幅・制御文字: 問題なし（壊した例ではすべて落ちた）");
});
