# Hai_Craft — 素材からの合成（P9）

VISION.md 核 6「創作者の厨房（素材から消耗品を作る）」の**仕組みの側**（#60）。
厨房の部屋と見せ方は P8 が作る。ここにあるのはレシピの読み方・知っているレシピ・窓口と、最小の合成画面。

## メモ欄のタグ（できる物のメモ欄）
| タグ | 中身 |
|---|---|
| `<hai_craft:i199x2,i200>` | 材料。「種類＋番号（`x` 数）」をカンマ区切り。種類 `i`＝アイテム、`w`＝武器、`a`＝防具。数を省くと 1 |
| `<hai_craft_known>` | 初めから知っているレシピ |

- アイテム・武器・防具のどれにも書ける。できる数は 1 つ。
- できた物が上限を超えると `Hai_Items` の倉庫へ送られる（合成の画面の中なら、知らせはマップに戻ってから）。
- 材料は**袋の中**の数で数える（倉庫・装備中の物は使わない）。

## 知っているレシピ
`<hai_craft_known>` の物 ＋ パラメータ「初めから知っているレシピ」（`i197,w196` の形）＋ 覚えたもの（`learn`）。
新しく覚えると、自動メモ（`Hai_Thoughts`）があれば 1 行残す（ID `recipe:i198`、種類 `item`、文「レシピ：秘薬（薬草×2・灰の苔×1）」）。

## プラグインコマンド
| コマンド | 引数 | 中身 |
|---|---|---|
| `openCraft`（合成を開く） | なし | `Scene_HaiCraft`：左にレシピの一覧（作れないものは薄く）、右に材料の「持っている／要る」、下に説明。決定で 1 つ作る |
| `learn`（レシピを覚える） | `kind`（item/weapon/armor）、`id` | レシピを覚える。新しく覚えたら「〜のレシピを覚えた。」（パラメータ `learnMessage`） |

## 窓口（`window.Hai.Craft`）
| 関数 | 戻り値・中身 |
|---|---|
| `recipes()` | 知っているレシピ `[{ key, kind, id, name, materials: [{ kind, id, n, have, name }], known, canCraft }]`（アイテム→武器→防具、ID 順） |
| `allRecipes()` | データにあるすべてのレシピ（同じ形） |
| `recipe(kind, id)` | 1 つのレシピ（無ければ `null`） |
| `isKnown(kind, id)` / `canCraft(kind, id)` | 知っているか / 知っていて材料がそろっているか |
| `craft(kind, id)` | 材料を減らし、できる物を 1 つ増やす。作れたら `true` |
| `learn(kind, id)` | 覚える。新しく覚えたら `true` |
| `open()` | 合成の画面を開く |

`kind` は `item`/`weapon`/`armor` でも `i`/`w`/`a` でもよい。

## 状態（セーブに入る）
```js
$gameSystem._hai.craft = { learned: ["i198"] }; // 覚えたレシピだけ（初めから知っている分は入れない）
```
古いセーブで無ければ、読むときに空で作る。初めから知っている分はデータから毎回数えるので、後からレシピを足しても古いセーブで知っている。

## P8 への申し送り
- **創作者の厨房**：厨房のイベントから `Hai_Craft` の `openCraft` を呼べば、今の最小の画面で合成できる。
  見せ方を作り直すときは `Hai.Craft.recipes()` で一覧と過不足（`materials[].have`・`canCraft`）を読み、決定で `Hai.Craft.craft(kind, id)` を呼ぶ。
  レシピの紙・料理人の会話などで覚えさせるときは `learn` コマンド（または `Hai.Craft.learn`）。メモは自動で残る。
- **保管ゲート**：`Hai.Items.storage()` で一覧、`Hai.Items.roomFor(item)` で取り出せるか、`Hai.Items.takeFromStorage(kind, id, n)` で袋へ、
  `Hai.Items.putToStorage(kind, id, n)` で袋から預ける。今の `openStorage`（`Scene_HaiStorage`）は差し替えてよい（テストは `Hai.Items` の窓口と、
  `Scene_HaiStorage` の `_listWindow` の一覧を見ている。差し替えたら `tests/p_items.mjs` の 3 を直す）。
- 合成でできた物が上限であふれたときの知らせは、マップに戻ってから出る（`Hai_Items` の「画面の中の知らせ」）。厨房の画面の中で出したいときは
  `Hai.Items.pendingNotices()` を読んで画面に出す（出した後の消し方の窓口はまだ無い。要るなら足す）。
