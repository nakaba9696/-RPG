# Hai_Facilities — 拠点の施設と叡智のオーブ（P8）

VISION.md 核 6「拠点『牢獄の間』と、叡智のオーブで開く施設」のためのプラグイン（#82）。
施設の開く順と碑文は [docs/old/world.md](../old/world.md) 3.3、オーブの置き場所は [docs/old/world2.md](../old/world2.md)（053・063・071 の H26・082。**置くのは W3〜W5**）。
合成は [Hai_Craft](Hai_Craft.md)、倉庫は [Hai_Items](Hai_Items.md)、控えの仲間は [Hai_Companions](Hai_Companions.md) の窓口を使う。
並びは `Hai_Companions` の後・`Hai_Comfort` の前（`js/plugins.js`・`tools/data/check.mjs` の `PLUGIN_ORDER`）。

## 叡智のオーブと扉の台座
- 叡智のオーブは Items **171**（大事なもの。アイコン 165）。パラメータ `orbItemId` で変えられる。
- Map010 の 4 つの扉（北西・北東・南西・南東）は台座の付いた石の扉。調べると碑文が出て、続けてプラグインコマンド「台座」。
  - オーブを持っていない：「台座には珠をはめるくぼみがある。叡智のオーブが要るようだ。」だけ。
  - 持っている：「台座のくぼみに、叡智のオーブがはまりそうだ。」と「はめる／やめる」。はめるとオーブが 1 つ減り、**次の施設**が開く。
- **どの扉の台座にはめても、開くのは決まった順**：魂の間 → 創作者の厨房 → 保管ゲート → 理知の間（1 個目は必ず魂の間）。
  - その扉が開いたとき：「台座の珠が光り、扉が開いた。（施設）に入れる。」
  - よその扉が開いたとき：「台座の珠が光った。（北西）の扉（魂の間）の開く音がする。」
- 開くと、その施設のスイッチ（121〜124）を ON、変数 103「叡智のオーブの数」にはめた数（0〜4）。
- 扉のイベントの 2 ページ目は出現条件がそのスイッチ。開いた扉の絵（`!Door1` の 6 番、上向き）で、**触れると施設のマップへ**（011〜014）。施設の出口で扉の前に戻る。

## W レーンが叡智のオーブを置く書き方
オーブは**ただの大事なもの**なので、宝箱か「アイテムの増減」（126）で 171 を 1 つ渡すだけでよい。台座の側は何もしなくてよい（数は袋の中のオーブで数える）。
文字マップの設定（`tools/maps/src/<名前>.json` の `events`）の例（old/world2.md の 053 洞の広間）：

```json
{
  "at": "Q", "name": "叡智のオーブ", "type": "raw",
  "pages": [
    { "image": { "characterName": "!Crystal", "characterIndex": 1, "direction": 2, "pattern": 1 }, "priorityType": 1, "trigger": 0, "walkAnime": false,
      "list": [
        { "code": 101, "indent": 0, "parameters": ["", 0, 0, 2, ""] },
        { "code": 401, "indent": 0, "parameters": ["石の台に、淡く光る珠が載っている。"] },
        { "code": 250, "indent": 0, "parameters": [{ "name": "Item3", "volume": 90, "pitch": 100, "pan": 0 }] },
        { "code": 126, "indent": 0, "parameters": [171, 0, 0, 1] },
        { "code": 101, "indent": 0, "parameters": ["", 0, 0, 2, ""] },
        { "code": 401, "indent": 0, "parameters": ["叡智のオーブを手に入れた。"] },
        { "code": 123, "indent": 0, "parameters": ["A", 0] },
        { "code": 0, "indent": 0, "parameters": [] }
      ] },
    { "conditions": { "selfSwitchCh": "A", "selfSwitchValid": true }, "priorityType": 0 }
  ]
}
```
- 取ったかはセルフスイッチ A で持つ（全体のスイッチは使わない）。名前に「宝箱」を入れるか `!Chest` の絵にすると、T2 の到達性の検査が「届くか」を見る。
- ボスを倒したら祭壇に現れる形（063 焚刑官ハルト）は、そのイベントの出現条件をボスの旗（スイッチ 156 など）にする。
- オーブの文の絵（`!Crystal` の何番か）は持ち主がエディタで決める。

## 魂
- 戦闘に勝つと、倒した敵 1 体につき魂 **1**。`<hai_boss>` の敵はパラメータ `bossSouls`（既定 **10**）。敵のメモ欄に `<hai_soul:5>` と書くとその数。
- 魂の間が開く前から数は増える。勝利の文「魂を N 手に入れた。」は**魂の間が開いてから**出す。
- 魂の数は `$gameSystem._hai.facilities.souls`（変数には写さない）。

## 施設（プラグインコマンド「施設を使う」）
| 施設 | マップ | 調べる物 | 画面 |
|---|---|---|---|
| 魂の間 | 011 | 魂の器 (8,4) | `Scene_HaiSouls`：パーティの一覧。決定で魂を与えてレベルを 1 つ上げる。要る魂は「今のレベル × `soulCostRate`（既定 1）」。上限は**前に出ている仲間（戦闘に出る 4 人）の最高レベル**（`soulCapByBattle`。控えを追いつかせる施設） |
| 創作者の厨房 | 012 | 創作者の調理台 (8,3) | `Hai_Craft` の合成の画面（`Scene_HaiCraft`）をそのまま開く |
| 保管ゲート | 013 | 門の箱 (8,7) | `Scene_HaiGate`：上で「引き出す／預ける」を選び、下の一覧で決定するたびに 1 つ動かす。引き出すのは袋の上限に空きがあるときだけ。預けられるのは袋のふつうのアイテム・武器・防具（大事なものは預けない） |
| 理知の間 | 014 | 理知の書見台 (8,7) | `Scene_HaiLore`：倒したボス（名前と、属性・状態の「弱い／強い」）、読んだ残留思念とメモの数。「古代語の解読」「王国全図」は名前だけ（中身は後の issue） |

- 施設が開くまでは、倉庫（`Hai_Items`）には**入るだけで取り出せない**（あふれた物は自動で倉庫へ行く。取り出す画面は保管ゲートだけ）。
- 閉じた施設を「施設を使う」で呼ぶと「扉は閉ざされている。」（ふつうは扉が閉じているので来られない）。

## プラグインコマンド
| コマンド | 引数 | 中身 |
|---|---|---|
| `pedestal`（台座） | `door`（soul/kitchen/gate/lore） | オーブがあれば「はめる？」、はめると次の施設を開く。無ければその旨の文 |
| `insert`（オーブをはめる・演出なし） | `door` | オーブを 1 つ減らし、次の施設を開く（「台座」が内部で使う） |
| `use`（施設を使う） | `facility` | その施設の画面を開く |
| `open`（施設を開く・オーブなし） | `facility` | オーブを使わずに開く（筋の都合・テスト用） |

## 窓口（`window.Hai.Facilities`）
| 関数 | 戻り値・中身 |
|---|---|
| `KEYS` | `["soul", "kitchen", "gate", "lore"]`（開く順） |
| `isOpen(key)` / `opened()` / `nextFacility()` | 開いたか / 開いた施設の一覧（開く順） / 次に開く施設（すべて開いていれば `null`） |
| `open(key)` | オーブなしで開く。新しく開いたら `true` |
| `orbs()` / `insertOrb(door)` | 袋の中のオーブの数 / 1 つはめて開いた施設の鍵（はめられなければ `null`） |
| `souls()` / `addSouls(n)` / `soulsOf(enemyId)` | 魂の数 / 足す（戻り値は足した後の数） / その敵を倒して得る魂 |
| `soulCost(actorId)` / `soulCap(actorId)` / `canRaise(actorId)` / `raise(actorId)` | 魂の間：要る魂 / 上げられる上限のレベル / 上げられるか / 上げる（上げたら `true`） |
| `bosses()` / `recordBoss(enemyId)` | 倒したボスの敵 ID の一覧 / 足す |
| `loreLines(symbol)` | 理知の間の右の窓に出す行（`bosses`・`thoughts`・`glyphs`・`atlas`） |
| `openScene(key)` | 施設の画面を開く（開いているかは見ない） |
| `nameOf(key)` / `doorOf(key)` | 施設の名前 / 扉の場所（北西など） |

## 状態（セーブに入る）
```js
$gameSystem._hai.facilities = {
  opened: { soul: true, kitchen: true }, // 開いた施設
  souls: 12,                             // 魂の数
  bosses: [5],                           // 倒したボスの敵 ID（倒した順）
};
```
古いセーブで無ければ、読むときに作る。そのとき**スイッチ 121〜124 が ON なら開いた扱い**にする（魂と倒したボスは 0 から）。

## パラメータ
| 名前 | 表示名 | 既定 |
|---|---|---|
| `orbItemId` | 叡智のオーブ | 171 |
| `switches` | 施設のスイッチ | `121,122,123,124` |
| `orbVariable` | はめた数の変数 | 103 |
| `names`・`doors` | 施設の名前・扉の場所 | `魂の間,創作者の厨房,保管ゲート,理知の間`・`北西,北東,南西,南東` |
| `noOrbMessage`・`askMessage`・`insertText`・`cancelText` | 台座の文と選択肢 | 上の「叡智のオーブと扉の台座」 |
| `openHere`・`openElsewhere`・`insertSe` | 開いたときの文・効果音 | 同上・Saint3 |
| `closedMessage` | 閉じた施設の文 | 扉は閉ざされている。 |
| `bossSouls`・`soulMessage` | ボスの魂・魂を得た文 | 10・`魂を %1 手に入れた。` |
| `soulCostRate`・`soulCapByBattle`・`soulSe` | 魂の間 | 1・true・Up4 |

## データ（P8 の帯。`node tools/maps/src/p8_data.mjs` が書く。`--check` で見るだけ）
| 何 | 中身 |
|---|---|
| Items 171 | 叡智のオーブ（172–178 は空） |
| System.json | スイッチ 121〜124「施設:魂の間」ほか（125〜130 は空）、変数 103「叡智のオーブの数」 |
| Map010 の扉 4 つ | 名前の同じイベント（「魂の間の扉」ほか）だけを差し替える。`data/Map010.json` と下書き `w1_010_prison_hall.json` の両方。Map010 のほかは触らない（W レーンと衝突したら main 側を取って走らせ直す） |
| `tools/maps/src/p8_facilities.json` | 試験場 Map913 の設定 |

マップ 011〜014・913 は `node tools/maps/build.mjs p8_011_soul p8_012_kitchen p8_013_gate p8_014_lore p8_facilities`。
`w1_data.mjs` を走らせ直すとスイッチ 121〜124・変数 103 の名前が消える（名前が無くても動く。消えたら `p8_data.mjs` を走らせ直す）。

## 試験場（Map913「T_施設」、`tools/maps/src/p8_facilities.*`）
上の壁に Map010 と同じ台座が 4 つ（左から魂の間 (3,2)・創作者の厨房 (6,2)・保管ゲート (10,2)・理知の間 (13,2)）、開始地点 (8,5)。
開いた台座に触れると本物の施設（011〜014）へ行く。テストは `tests/p_facilities.mjs`。
