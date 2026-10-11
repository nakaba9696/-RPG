// P6（仲間）：データベースの自分の分を data/*.json に書く。何度走らせても同じ結果（下の番号だけ書き直す）。
//   node tools/maps/src/p6_data.mjs           書く
//   node tools/maps/src/p6_data.mjs --check   書かずに、今の data/ と同じかだけ見る（違えば終了コード 1）
//
// 書くもの（docs/world.md 6 章）：
//   Skills 191–195  5 人の完全体の強技（メモ欄 <hai_complete:アクター ID>。Hai_Companions が完全体のときだけ覚えさせる）
//   States 191–192  鉄の誓い（<hai_vow>：味方への物理攻撃の身代わり＋反撃）、潮騒の守り（状態異常を防ぐ）
//   Actors 5–9      名前・職業・初期レベル・二つ名・プロフィール・目覚めの一言（<hai_wake:…>）。絵と装備はそのまま
import fs from "node:fs";
import { readData, dataPath, formatTable, extendTable } from "../../data/io.mjs";

// 状態異常（MZ の既定 4〜13 と、P4 の 141〜147）
const AILMENTS = [4, 5, 6, 7, 8, 9, 10, 12, 13, 141, 142, 143, 144, 145, 146, 147];
const SILENCE = 6; // MZ の既定の沈黙（P4 の 146 が入ったら W・P4 で差し替える）

const skillBase = {
  animationId: 0, damage: { critical: false, elementId: 0, formula: "0", type: 0, variance: 20 }, description: "", effects: [],
  hitType: 0, iconIndex: 0, message1: "", message2: "", mpCost: 0, name: "", note: "", occasion: 1, repeats: 1,
  requiredWtypeId1: 0, requiredWtypeId2: 0, scope: 1, speed: 0, stypeId: 1, successRate: 100, tpCost: 0, tpGain: 0, messageType: 1,
};

const SKILLS = {
  191: {
    name: "鉄の誓い", note: "<hai_complete:5>", stypeId: 2, scope: 11, tpCost: 40, iconIndex: 81, animationId: 52,
    description: "3 ターン、味方全員の代わりに物理攻撃を受け、受けるたびに反撃する。",
    message1: "%1は鉄の誓いを立てた！", effects: [{ code: 21, dataId: 191, value1: 1, value2: 0 }],
  },
  192: {
    name: "千の牙", note: "<hai_complete:6>", stypeId: 2, scope: 6, tpCost: 40, iconIndex: 77, animationId: -1, hitType: 1,
    description: "敵全体に 4 回のランダム攻撃。",
    message1: "%1の千の牙！", damage: { critical: true, elementId: -1, formula: "a.atk * 3 - b.def * 2", type: 1, variance: 20 },
  },
  193: {
    name: "頁を閉じる", note: "<hai_complete:7>", stypeId: 1, scope: 2, mpCost: 40, iconIndex: 71, animationId: 101, hitType: 2,
    description: "敵全体に即死の判定（成功率は低い）と沈黙。",
    message1: "%1は頁を閉じた……", effects: [
      { code: 21, dataId: 1, value1: 0.15, value2: 0 },
      { code: 21, dataId: SILENCE, value1: 0.8, value2: 0 },
    ],
  },
  194: {
    name: "潮騒の歌", note: "<hai_complete:8>", stypeId: 2, scope: 8, tpCost: 40, iconIndex: 79, animationId: 46,
    description: "味方全体の HP と SP を少し回復し、3 ターン状態異常を防ぐ。",
    message1: "%1は潮騒の歌をうたった。", effects: [
      { code: 11, dataId: 0, value1: 0.2, value2: 0 },
      { code: 13, dataId: 0, value1: 10, value2: 0 },
      { code: 21, dataId: 192, value1: 1, value2: 0 },
    ],
  },
  195: {
    name: "最後の祈り", note: "<hai_complete:9>", stypeId: 1, scope: 13, tpCost: 50, iconIndex: 72, animationId: 49,
    description: "味方全体の戦闘不能を回復し、HP を半分まで戻す。",
    message1: "%1は最後の祈りを捧げた。", effects: [
      { code: 22, dataId: 1, value1: 1, value2: 0 },
      { code: 11, dataId: 0, value1: 0.5, value2: 0 },
    ],
  },
};

const stateBase = {
  autoRemovalTiming: 0, chanceByDamage: 100, iconIndex: 0, maxTurns: 1, message1: "", message2: "", message3: "", message4: "",
  minTurns: 1, motion: 0, name: "", note: "", overlay: 0, priority: 50, releaseByDamage: false, removeAtBattleEnd: false,
  removeByDamage: false, removeByRestriction: false, removeByWalking: false, restriction: 0, stepsToRemove: 100, traits: [], messageType: 1,
};

const STATES = {
  191: {
    name: "鉄の誓い", note: "<hai_vow>", iconIndex: 81, autoRemovalTiming: 2, minTurns: 3, maxTurns: 3, removeAtBattleEnd: true,
    message1: "%1は仲間の盾になった！", message2: "", message4: "%1の誓いが解けた。",
    traits: [
      { code: 62, dataId: 2, value: 1 }, // かばう
      { code: 22, dataId: 6, value: 1 }, // 反撃率 100%（物理を受けると反撃）
      { code: 23, dataId: 6, value: 0.5 }, // 物理ダメージ率 50%
      { code: 23, dataId: 0, value: 10 }, // 狙われ率
    ],
  },
  192: {
    name: "潮騒の守り", note: "", iconIndex: 79, autoRemovalTiming: 2, minTurns: 3, maxTurns: 3, removeAtBattleEnd: true,
    message1: "%1は潮騒に守られている。", message4: "%1の潮騒の守りが消えた。",
    traits: AILMENTS.map(dataId => ({ code: 14, dataId, value: 1 })),
  },
};

// docs/world.md 6 章。職業は MZ の既定の職業から近いもの（W が仲間の職業を作るまでの仮）
const ACTORS = {
  5: {
    name: "オルド", nickname: "帝国の工兵", classId: 4, initialLevel: 3,
    profile: "帝国の工兵。捕虜として廃坑で死んだ。\n味方をかばい、物理を受けると反撃する盾。",
    note: "<hai_wake:……梁は、まだ持っているか。なら、俺もまだ持つ。>",
  },
  6: {
    name: "ザザ", nickname: "獣人の剣士", classId: 5, initialLevel: 8,
    profile: "獣人の村の女剣士。異端狩りから村を守って死んだ。\n2 回動き、傷つくと狂乱して攻めが上がる。",
    note: "<hai_wake:村は……いや、いい。剣はどこだ。>",
  },
  7: {
    name: "ノクス", nickname: "盲目の司書", classId: 2, initialLevel: 8,
    profile: "古書院の盲目の司書。禁書を守って死んだ。\n即死と沈黙の術を使う。体は弱い。",
    note: "<hai_wake:その声は覚えている。君は、あのとき本を読んでいた子だね。>",
  },
  8: {
    name: "ルメ", nickname: "湿地の歌い手", classId: 7, initialLevel: 10,
    profile: "湿地の魚人の歌い手。迫害の中で一族に歌を教え続けた。\n歌で味方を強め、自分は敵の狙いを引きつけてかわす。",
    note: "<hai_wake:客席に、人がいる。……一曲目は、何がいい？>",
  },
  9: {
    name: "シオン", nickname: "看取りの修道士", classId: 3, initialLevel: 10,
    profile: "聖灰教会の少年修道士。灰化した民を看取り続けた。\n回復と蘇生、SP の受け渡しができる。",
    note: "<hai_wake:兄さん……？　そうか。僕も、灰になったんだね。>",
  },
};

function build() {
  const skills = readData("Skills.json");
  for (const [id, s] of Object.entries(SKILLS)) skills[id] = { id: Number(id), ...skillBase, ...s };

  const states = readData("States.json");
  extendTable(states, 192, id => ({ id, ...stateBase }));
  for (const [id, s] of Object.entries(STATES)) states[id] = { id: Number(id), ...stateBase, ...s };

  const actors = readData("Actors.json");
  // 9 番が無ければ 8 番の欄を写して作る（絵は Actor2 の 1 人目）
  if (!actors[9]) {
    extendTable(actors, 9, id => ({
      ...actors[8], id, battlerName: "Actor2_1", characterName: "Actor2", characterIndex: 0, faceName: "Actor2", faceIndex: 0,
    }));
  }
  for (const [id, a] of Object.entries(ACTORS)) actors[id] = { ...actors[id], ...a, id: Number(id) };

  return { "Skills.json": skills, "States.json": states, "Actors.json": actors };
}

const out = build();
const check = process.argv.includes("--check");
let stale = false;
for (const [name, table] of Object.entries(out)) {
  const text = formatTable(table);
  if (fs.readFileSync(dataPath(name), "utf8") === text) continue;
  if (check) {
    console.error(`古い: data/${name}（node tools/maps/src/p6_data.mjs で書き直す）`);
    stale = true;
  } else {
    fs.writeFileSync(dataPath(name), text);
    console.log(`書いた: data/${name}`);
  }
}
if (stale) process.exit(1);
