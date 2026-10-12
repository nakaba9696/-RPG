// P6（仲間）・P11（7 人に）：データベースの自分の分を data/*.json に書く。何度走らせても同じ結果（下の番号だけ書き直す）。
//   node tools/maps/src/p6_data.mjs           書く
//   node tools/maps/src/p6_data.mjs --check   書かずに、今の data/ と同じかだけ見る（違えば終了コード 1）
//
// 書くもの（docs/world.md 6 章）：
//   Skills 191–195・181–182  7 人の完全体の強技（メモ欄 <hai_complete:アクター ID>。Hai_Companions が完全体のときだけ覚えさせる）
//                            181–182 は P の帯の空き（191–200 の残り 196–200 は MZ 既定の「かばう」ほか）
//   States 191–193  行軍（<hai_vow>：味方への物理攻撃の身代わり＋反撃）、勘定合わせ（状態異常を防ぐ）、檻破り（自分が狙われる）
//   Actors 5–11     名前・職業・初期レベル・二つ名・プロフィール・目覚めの一言（<hai_wake:…>）・固有の立ち回りの特徴。
//                   5–9 の絵と装備はそのまま。10・11 は 9 の欄を写し、絵は Actor2 の 2・3 人目（持ち主が素材を決めるまでの仮）
//   System.json     スイッチ 131–150・変数 131–138 の名前（P11。W の帯の中の例外）
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
    name: "行軍", note: "<hai_complete:5>", stypeId: 2, scope: 11, tpCost: 40, iconIndex: 81, animationId: 52,
    description: "3 ターン、味方全員の代わりに物理攻撃を受け、受けるたびに反撃する。",
    message1: "%1は行軍を始めた。", effects: [{ code: 21, dataId: 191, value1: 1, value2: 0 }],
  },
  192: {
    name: "逃げ足", note: "<hai_complete:6>", stypeId: 2, scope: 6, tpCost: 40, iconIndex: 77, animationId: -1, hitType: 1,
    description: "敵全体に 4 回のランダム攻撃。",
    message1: "%1の逃げ足！", damage: { critical: true, elementId: -1, formula: "a.atk * 3 - b.def * 2", type: 1, variance: 20 },
  },
  193: {
    name: "頁を伏せる", note: "<hai_complete:7>", stypeId: 1, scope: 2, mpCost: 40, iconIndex: 71, animationId: 101, hitType: 2,
    description: "敵全体に即死の判定（成功率は低い）と沈黙。",
    message1: "%1は頁を伏せた。", effects: [
      { code: 21, dataId: 1, value1: 0.15, value2: 0 },
      { code: 21, dataId: SILENCE, value1: 0.8, value2: 0 },
    ],
  },
  194: {
    name: "勘定合わせ", note: "<hai_complete:8>", stypeId: 2, scope: 8, tpCost: 40, iconIndex: 79, animationId: 46,
    description: "味方全体の HP と SP を少し回復し、3 ターン状態異常を防ぐ。",
    message1: "%1は勘定を合わせた。", effects: [
      { code: 11, dataId: 0, value1: 0.2, value2: 0 },
      { code: 13, dataId: 0, value1: 10, value2: 0 },
      { code: 21, dataId: 192, value1: 1, value2: 0 },
    ],
  },
  195: {
    name: "扉の外の歌", note: "<hai_complete:9>", stypeId: 1, scope: 13, tpCost: 50, iconIndex: 72, animationId: 49,
    description: "味方全体の戦闘不能を回復し、HP を半分まで戻す。",
    message1: "%1は扉の外の歌をうたった。", effects: [
      { code: 22, dataId: 1, value1: 1, value2: 0 },
      { code: 11, dataId: 0, value1: 0.5, value2: 0 },
    ],
  },
  181: {
    name: "骨断ち", note: "<hai_complete:10>", stypeId: 2, scope: 1, tpCost: 40, iconIndex: 76, animationId: -1, hitType: 0,
    description: "敵 1 体に大きな一撃。必ず当たる。",
    message1: "%1の骨断ち！", damage: { critical: false, elementId: -1, formula: "a.atk * 6 - b.def * 2", type: 1, variance: 10 },
  },
  182: {
    name: "檻破り", note: "<hai_complete:11>\n<hai_user_state:193>", stypeId: 2, scope: 9, tpCost: 40, iconIndex: 82, animationId: 45,
    description: "戦闘不能の味方 1 人を起こす。2 ターン、自分が狙われる。",
    message1: "%1は檻を破った！", effects: [
      { code: 22, dataId: 1, value1: 1, value2: 0 },
      { code: 11, dataId: 0, value1: 0.25, value2: 0 },
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
    name: "行軍", note: "<hai_vow>", iconIndex: 81, autoRemovalTiming: 2, minTurns: 3, maxTurns: 3, removeAtBattleEnd: true,
    message1: "%1は仲間の前に立った！", message2: "", message4: "%1の行軍が止まった。",
    traits: [
      { code: 62, dataId: 2, value: 1 }, // かばう
      { code: 22, dataId: 6, value: 1 }, // 反撃率 100%（物理を受けると反撃）
      { code: 23, dataId: 6, value: 0.5 }, // 物理ダメージ率 50%
      { code: 23, dataId: 0, value: 10 }, // 狙われ率
    ],
  },
  192: {
    name: "勘定合わせ", note: "", iconIndex: 79, autoRemovalTiming: 2, minTurns: 3, maxTurns: 3, removeAtBattleEnd: true,
    message1: "%1の勘定は合っている。", message4: "%1の勘定合わせが切れた。",
    traits: AILMENTS.map(dataId => ({ code: 14, dataId, value: 1 })),
  },
  193: {
    name: "檻破り", note: "", iconIndex: 82, autoRemovalTiming: 2, minTurns: 2, maxTurns: 2, removeAtBattleEnd: true,
    message1: "%1は前に出た！", message4: "%1は下がった。",
    traits: [
      { code: 23, dataId: 0, value: 10 }, // 狙われ率
      { code: 23, dataId: 6, value: 0.7 }, // 物理ダメージ率 70%
    ],
  },
};

// docs/world.md 6.2・6.6。職業は MZ の既定の職業から近いもの（仲間ごとの職業を作るかは持ち主が決める）。
// 固有の立ち回りはアクターの特徴（traits）に置く（職業はほかのアクターと共用のため）
const ACTORS = {
  5: {
    name: "ブルーノ", nickname: "鐘の騎士団の騎士", classId: 4, initialLevel: 3,
    profile: "鐘の騎士団の騎士。大きな体で、祈りの文句を数のように唱える。\n味方をかばい、物理を受けると反撃する盾。",
    // <hai_down>：戦闘不能になったときの一言（W15 #231 が書いた。P14 #230 が読む）
    note: "<hai_wake:……礼拝堂は、まだですか。あなたは、どこの隊の方です>\n<hai_down:……数えてください>",
    traits: [{ code: 62, dataId: 2, value: 1 }, { code: 22, dataId: 6, value: 0.3 }, { code: 23, dataId: 0, value: 2 }],
  },
  6: {
    name: "ノラ", nickname: "生贄の村の娘", classId: 5, initialLevel: 8,
    profile: "犬の獣人の娘。くじの夜に窓から逃げた。足が速い。\n1 ターンに 2 回動く。",
    note: "<hai_wake:火、上げたよ！　……あれ。あんた、誰？>",
    traits: [{ code: 61, dataId: 0, value: 1 }],
  },
  7: {
    name: "ディル", nickname: "記録院の写字生", classId: 2, initialLevel: 8,
    profile: "記録院の写字生。本好きで、口を開けば皮肉。\n沈黙と即死の術を使う。体は弱い。",
    note: "<hai_wake:……読める人か。いや、読めない顔だな。>",
    traits: [{ code: 21, dataId: 0, value: 0.8 }, { code: 21, dataId: 4, value: 1.15 }],
  },
  8: {
    name: "ゼリナ", nickname: "方舟の酒保", classId: 7, initialLevel: 10,
    profile: "砦の酒保を一人で回した。金と子どもが好き。\n味方を強め、敵の狙いを引きつけてかわす。戦いの後の鉄くずが増える。",
    note: "<hai_wake:舟は？　……あんた、乗りそびれたクチか。>",
    traits: [{ code: 22, dataId: 1, value: 0.15 }, { code: 23, dataId: 0, value: 2 }, { code: 64, dataId: 3, value: 1 }],
  },
  9: {
    name: "アンセルモ", nickname: "扉の外の司祭", classId: 3, initialLevel: 10,
    profile: "王国の司祭。下品で陽気。歌うと、聞く者が泣く。\n回復と蘇生、SP の受け渡しができる。",
    note: "<hai_wake:おう、お前さん、扉の内の人かの。外かの。>",
    traits: [{ code: 23, dataId: 2, value: 1.2 }],
  },
  10: {
    name: "ベルトラン", nickname: "使徒狩りの傭兵", classId: 1, initialLevel: 12,
    profile: "骨の剣を握る傭兵。だらしなく、何でも冗談にする。\n狙いを引きつけ、物理を受け流して返す。",
    note: "<hai_wake:よう。俺の剣、骨拾いから取り返してくれたのか。高かったろ。>",
    traits: [{ code: 22, dataId: 6, value: 0.4 }, { code: 22, dataId: 1, value: 0.1 }, { code: 23, dataId: 0, value: 3 }],
  },
  11: {
    name: "トゥーラ", nickname: "研究所の檻の子", classId: 5, initialLevel: 12,
    profile: "熊の獣人の子。口が悪く、世話焼き。力が強い。\n味方に使う薬の効き目が上がる。",
    note: "<hai_wake:兄貴、誰だよ。……檻の外の人か。>",
    traits: [{ code: 21, dataId: 2, value: 1.2 }, { code: 23, dataId: 3, value: 1.5 }],
  },
};

// System.json の名前（P11。スイッチ 131–150・変数 131–138。W の帯の中の例外。docs/plugins/Hai_Companions.md）
const SWITCH_NAMES = {};
const VARIABLE_NAMES = {};
Object.entries(ACTORS).forEach(([id, a], i) => {
  SWITCH_NAMES[131 + i] = `遺骸:${a.name}`;
  SWITCH_NAMES[138 + i] = `加入:${a.name}`;
  VARIABLE_NAMES[131 + i] = `記憶:${a.name}`;
});
VARIABLE_NAMES[138] = "戻った記憶の数";

function build() {
  const skills = readData("Skills.json");
  for (const [id, s] of Object.entries(SKILLS)) skills[id] = { id: Number(id), ...skillBase, ...s };

  const states = readData("States.json");
  extendTable(states, 193, id => ({ id, ...stateBase }));
  for (const [id, s] of Object.entries(STATES)) states[id] = { id: Number(id), ...stateBase, ...s };

  const actors = readData("Actors.json");
  // 10・11 番が無ければ 9 番の欄を写して作る（絵は Actor2 の 2・3 人目。持ち主が素材を決めるまでの仮）
  extendTable(actors, 11, id => ({
    ...actors[9], id, battlerName: `Actor2_${id - 8}`, characterName: "Actor2", characterIndex: id - 9, faceName: "Actor2", faceIndex: id - 9,
  }));
  for (const [id, a] of Object.entries(ACTORS)) actors[id] = { ...actors[id], ...a, id: Number(id) };

  const system = JSON.parse(fs.readFileSync(dataPath("System.json"), "utf8"));
  for (let id = 131; id <= 150; id++) system.switches[id] = SWITCH_NAMES[id] ?? "";
  for (let id = 131; id <= 138; id++) system.variables[id] = VARIABLE_NAMES[id] ?? "";

  return { "Skills.json": skills, "States.json": states, "Actors.json": actors, "System.json": system };
}

const out = build();
const check = process.argv.includes("--check");
let stale = false;
for (const [name, table] of Object.entries(out)) {
  const text = name === "System.json" ? JSON.stringify(table) : formatTable(table);
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
