// 遊び方（戦いを測る道具 tools/balance/ の、各人の行動の決め方）。
//
// 一つの遊び方は { label, decide } で、decide(actor, slot, h) が 1 手を返す。
//   actor  Game_Actor（入力できる者だけ。二回行動なら slot 0・1 と 2 回呼ばれる）
//   slot   その者の何手目か（0 から）
//   h      手伝いの関数（measure.mjs の makeHelpers。ページの中で作る）
//            h.opts                 測る条件（bosses.json の defaults と各行を重ねたもの）
//            h.isHero(actor)        主人公（opts.hero.actor）か
//            h.canSkill(actor, id)  その技を今使えるか（MP・SP・封じ。ゲームの canUse）
//            h.healLow()            HP が opts.heal.rate 未満の味方がいて回復の品が残っていれば、その 1 手（品を 1 つ取り置く）。無ければ null
//            h.strongSkill(actor)   opts.strong に書いたその者の強技の番号（無ければ 0）
// 返す 1 手：{ attack: true } / { guard: true } / { skill: 番号 } / { item: 番号, target: 味方の並びの番号 }
//   敵への狙いは書かなければ「生きている敵の先頭」。味方への狙いは target。
//
// decide はページの中へ文字列で送って作り直すので、外の変数を使わない（h と引数だけを使う）。
// 遊び方を足すときは、ここに 1 項目足し、--policy <名前> か bosses.json の "policies" で選ぶ。

export const POLICIES = {
  // W27 #301 の「攻撃と灰火」：HP 35% 未満の者がいれば煎じ薬、主人公は灰火（MP があれば）、ほかは攻撃。二回行動は両方埋める。
  attack: {
    label: "攻撃と灰火",
    decide(actor, slot, h) {
      const heal = h.healLow();
      if (heal) return heal;
      if (h.isHero(actor) && h.canSkill(actor, h.opts.hero.skill)) return { skill: h.opts.hero.skill };
      return { attack: true };
    },
  },
  // W27 #301 の「強技あり」：上に加えて、SP・MP があれば各人の強技（opts.strong）。
  strong: {
    label: "強技あり",
    decide(actor, slot, h) {
      const heal = h.healLow();
      if (heal) return heal;
      if (h.isHero(actor) && h.canSkill(actor, h.opts.hero.skill)) return { skill: h.opts.hero.skill };
      const id = h.strongSkill(actor);
      if (id && h.canSkill(actor, id)) return { skill: id };
      return { attack: true };
    },
  },
  // 比べるための素の遊び方：全員が攻撃だけ（回復もしない）。
  plain: {
    label: "攻撃だけ",
    decide() {
      return { attack: true };
    },
  },
};

/** 名前から遊び方を引く（無ければ例外）。 */
export function policy(name) {
  const p = POLICIES[name];
  if (!p) throw new Error(`遊び方 ${name} が無い（tools/balance/policies.mjs の POLICIES：${Object.keys(POLICIES).join("・")}）`);
  return p;
}
