# 戦いを測る道具（tools/balance/、T15 #309）

`?hai_test` で起動したゲームの中で**本物の `Scene_Battle`** を描画を止めて早送りで回し、敵グループ 1 つについて
勝ち負け・ターン数・終わったときの隊の HP・倒れた人数・全滅の回数を測る。
R4 と、その先の通しで、同じ条件・同じ測り方で前と後を比べるための道具（W27 #301 の使い捨ての台を残したもの）。

## 回し方
```bash
npm ci --ignore-scripts --prefix tests        # 初めの一回（Playwright。tests/ のものを使う）
node tools/balance/run.mjs --all              # 基準の表（bosses.json）の全部。手元で 10 分ほど
node tools/balance/run.mjs 112 083            # 表の行を key で選ぶ
node tools/balance/run.mjs 112 --runs 4 --policy attack      # 回数・遊び方を上書き
node tools/balance/run.mjs --troop 1051 --party 1,5,6 --levels 8,8,8 --name 収税吏   # 表に無い条件
```
| 引数 | 中身 |
|---|---|
| `--all` / `<key>…` / `--troop N` | 何を測るか（表の全部 / 表の行 / その場の条件。`--troop` は `--party`・`--levels`・`--name` と使う） |
| `--runs N` | 回数（表の既定 12。重いボスは表で 6） |
| `--seed N` | 乱数の種（既定 1）。同じ種なら同じ結果（行動の並びまで） |
| `--policy a,b` | 遊び方（`policies.mjs` の名前） |
| `--potions N` | 回復の品（煎じ薬）の数 |
| `--max-turns N` | このターンを越えたら打ち切り（既定 60） |
| `--strict` | 狙いの幅から外れた行があれば終了コード 1（既定は 0。測るだけ） |

- CI では回さない（重い）。CI に入っているのは、道具が動くことだけを見る `tests/t_balance.mjs`（035 牢番を 2 回・同じ種での再現・範囲の誤りの検出。20 秒ほど）。
- 数値を直す PR は、直す前と後でこの道具を回し、表を PR の説明に載せる（同じ種・同じ回数で）。

## 何が本物で、何をこちらがしているか
本物（ゲームのとおり）：ダメージの式・命中・会心・属性・敵の行動の表と条件・技の範囲・状態・二回行動（`numActions`）・troop のイベント（ボスの名乗り・裂け目の文など）・プラグイン（Hai_Battle の SP・Hai_Boss の複数行動と形態変化 …）。

こちらがしていること（`measure.mjs`）：
- 戦うたびに隊を**加入時の形**（`Game_Actor.setup`。Lv・装備・技・状態）から作り直し、Lv を `changeLevel` で合わせ（職業の習得表の技を覚える）、HP・MP を満タン、SP を条件どおりにする。持ち物は条件の数にそろえる。
- `Math.random` を種つきの乱数（mulberry32）に替える。種は「表の種 × 回の番号」から作る（`runSeed`）。
- 入力の番（パーティコマンドか、アクターコマンドが開いた所）で、遊び方の関数で各人の行動を埋めて `BattleManager.startTurn()`。動けない者（眠り・鎖縛り）は入力しない（ゲームのとおり）。
- 文章の窓は決定キーで送ったことにする。描画は止め（`Graphics._canRender`）、`__game.setSpeed(30)` で早送り。
- 戦闘は見本のマップ（Map900）から、逃走可・**敗北可**で始める（負けても Hai_Defeat の全滅の処理に入らない）。
- 勝ち（`processVictory`）・負け（`processDefeat`）・打ち切り（`processAbort`）の瞬間に、ターン数と隊の HP を写す。
- 敵の技が敵の側（自分か仲間）に HP ダメージか状態（範囲 11 の構えを除く）を与えたら、その技の番号を数える（**GAM-45 の誤り**。表の判定に「敵の技が敵の側に当たった」と出る）。

## 基準の表 `bosses.json`
```json
{
  "defaults": { "runs": 12, "seed": 1, "maxTurns": 60, "policies": ["attack", "strong"], "equip": "join", "tp": "full",
                "items": { "7": 6 }, "heal": { "item": 7, "rate": 0.35 }, "hero": { "actor": 1, "skill": 161 },
                "strong": { "5": 198, "6": 172, "7": 100 } },
  "bosses": [
    { "key": "112", "name": "関所の収税吏", "map": 112, "troop": 1051, "party": [1, 5, 6], "levels": [8, 8, 8],
      "target": { "attack": { "turns": [8, 12], "hp": [0.4, 0.65] } }, "note": "…" }
  ]
}
```
| 欄 | 中身 |
|---|---|
| `key` | 名前（ふつうはボスのいるマップの番号。同じボスの別の条件は `083-4` のように） |
| `troop` / `map` | 敵グループの番号（地図の「ボス戦」コマンドの `troopId`）/ どこのボスか（目印だけ） |
| `party` / `levels` | 隊（アクター番号の並び。先頭が主人公）と各人の Lv |
| `equip` | `"join"`＝加入時のまま。指定するときは `{ "アクター番号": [武器, 盾, 頭, 体, 装飾品] }`（0 は外す） |
| `tp` | `"full"`（SP 満タン。仲間が加わったときと同じ）か数 |
| `items` | 持ち物 `{ アイテム番号: 数 }`（戦う前にその数にそろえる） |
| `heal` | 回復の品と、使う HP の割合（`h.healLow()` が使う） |
| `hero` / `strong` | 主人公のアクター番号と灰火の番号 / 強技あり で使う各人の技 `{ アクター番号: 技番号 }` |
| `policies` / `runs` / `seed` / `maxTurns` | 遊び方の並び・回数・種・打ち切り（defaults を上書き） |
| `target` | 遊び方ごとの狙いの幅：`turns`（ターンの中央値の下・上）、`hp`（勝った回の残る HP の平均の下・上、0〜1）、`wipesMax`（全滅・打ち切りの上限）。省いた所は見ない |

- 隊と Lv は R3（`docs/reviews/2026-10-14-r3.md` 5 章）と W27 #301 の表のとおり。狙いの幅は W27 の「8〜12 ターンで HP が 4〜6 割」と R3 の見立てから置いた**仮のもの**で、R4 で決め直す。
- 条件を足すときは `bosses` に 1 行足す。敵グループの番号は地図のイベントの「ボス戦」（`Hai_Boss` の `bossBattle`）の `troopId` で確かめる。
- 能力値の並び（`params`）は [最大HP, 最大MP, 攻撃力, 防御力, 魔法力, 魔法防御, 敏捷性, 運]（GAM-49）。数値を直したら、同時に入っている仲間・装備・技の変更を取り込んだ版で測る（GAM-50）。

## 遊び方を足す（`policies.mjs`）
```js
export const POLICIES = {
  attack: { label: "攻撃と灰火", decide(actor, slot, h) {
    const heal = h.healLow();                     // HP 35% 未満の者がいれば煎じ薬（品を取り置く）
    if (heal) return heal;
    if (h.isHero(actor) && h.canSkill(actor, h.opts.hero.skill)) return { skill: h.opts.hero.skill };
    return { attack: true };
  } },
  …
};
```
- `decide(actor, slot, h)` が 1 手を返す：`{ attack: true }`・`{ guard: true }`・`{ skill: 番号 }`・`{ item: 番号, target: 味方の並びの番号 }`。敵への狙いは「生きている敵の先頭」（`target` で敵の並びの番号を渡してもよい）。
- 二回行動の者は `slot` 0・1 と 2 回呼ばれる（両方埋める）。
- `decide` はページの中へ文字列で送るので、外の変数を使わない（`h` と引数だけ）。`h` の中身は `policies.mjs` の頭の説明。
- 今ある遊び方：`attack`（攻撃と灰火。W27 の方針）・`strong`（強技あり。SP・MP があれば `strong` の技）・`plain`（攻撃だけ。回復しない）。

## 出力の読み方
標準出力と `tests/out/balance/<名前>.md`・`.json`（コミットしない）に出る。
| 列 | 中身 |
|---|---|
| 勝ち／全滅 | 勝った回／全滅した回（打ち切りがあれば括弧で） |
| ターン | 全部の回のターン数の最小〜最大と中央値（勝った・負けたターン） |
| 残る HP | 勝った回の、終わったときの隊の HP の合計 ÷ 最大 HP の合計（平均と幅）。倒れた人は 0 で数える |
| 倒れた人 | 倒れた人がいた回の数・延べ人数・一回の最多（勝った回も負けた回も） |
| 煎じ薬 | 1 回に使った回復の品の数の平均 |
| 判定 | 狙いの幅の中か、外れた所（ターンの中央値・HP の平均・全滅の数、GAM-45） |

JSON には回ごとの結果（`runs[i]`：`result`・`turns`・`hp`・`mhp`・`down`・`healUsed`・`enemyHp`・`selfHits`・`actions`＝[ターン, アクター, 手]）も入る。
1 戦は手元（クラウドの 4 コア）で 2〜5 秒（長いボスほど遅い）。
