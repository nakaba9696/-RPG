# Hai_Items — 所持上限と倉庫、一点もの、ドロップの決まり（P9）

VISION.md 核 7「消耗品は所持上限が小さい（強いものほど少ない）。ボスのドロップは固定。ザコは装備を落とさない」、
核 1「赤い宝箱（一点ものの装備）」、核 9「倉庫への自動転送」の**仕組みの側**（#60）。
倉庫から出す本物の画面は P8（保管ゲート）が作る。ここにあるのはテスト用の最小の画面だけ。

## メモ欄のタグ
| タグ | 置く所 | 中身 |
|---|---|---|
| `<hai_max:3>` | アイテム・武器・防具 | その物の所持上限（袋の中の数） |
| `<hai_unique>` | 武器・防具（アイテムにも書ける） | 一点もの：上限 1（装備中も数える）、店で売れない、捨てられない |
| `<hai_drop:none>` | 敵 | 武器・防具を落とさない |
| `<hai_drop:item,201,1>` | 敵 | 必ず（100%）落とす物。種類 `item`/`weapon`/`armor`（`i`/`w`/`a`）、ID、数（省くと 1）。**いくつでも**書ける |
| `<hai_boss>` | 敵 | ボス（P4 のタグをそのまま読む）。「ザコは装備を落とさない」の対象から外れる |

## 上限
| 物 | 上限 |
|---|---|
| `<hai_unique>` | 1（装備している分も数える） |
| `<hai_max:n>` | n |
| ふつうのアイテム（`itypeId` 1）で「消耗する」もの | パラメータ「消耗品の上限」（既定 **5**） |
| 武器・防具 | パラメータ「装備の上限」（既定 0＝MZ の既定の 99） |
| 大事なもの・隠しアイテム・消耗しないアイテム | MZ の既定の 99 |

「強いものほど少ない」は `<hai_max:2>`（秘薬）・`<hai_max:1>` のように物ごとに書く。素材は `<hai_max:20>` など大きめに。
店の「購入する」は上限までしか買えない（MZ の `maxBuy` が `maxItems` を見る）。

## 倉庫への自動転送
- 上限を超えて手に入れた分は捨てずに倉庫へ入れ、「〜（N 個）は倉庫へ送られた。」と知らせる。既定では**画面の端の小さな通知**（約 2 秒、窓を止めない・決定を押さなくてよい）。`noticeStyle` を「文章」にすると文章の窓（元の挙動）。メニュー・戦闘・合成の中で起きたときは、マップに戻ってから出す。一点ものを手に入れた知らせ（`uniqueMessage`）も同じ出し方。
  宝箱・「アイテムの増減」・戦闘のドロップ・合成など、`$gameParty.gainItem` で増えるときすべて。減るとき（売る・使う）は関係しない。
- 知らせは、マップと戦闘ではその場で文章（`$gameMessage`）。メニュー・店・合成の画面の中で起きたときは、マップに戻ってから出す。
- 装備を外して袋に戻すとき（`Game_Actor.tradeItemWithParty`）は知らせない（あふれた分は黙って倉庫へ）。
- 倉庫に上限はない。中身は入れた順。
- 入手ログ（`Hai_Notes`）があれば、倉庫へ送った分も `Hai.Notes.logItem(item, 数)` で入手ログに残す（袋に入った分は `Hai_Notes` が自分で記録するので、一部があふれたときは「袋の分」と「倉庫の分」の 2 行になる）。

## 一点もの
- 1 つしか持てない（装備している分も数える。装備中にもう 1 本手に入れると倉庫へ）。
- 店で売れない（`Window_ShopSell.isEnabled` で選べない）。捨てられない（MZ に捨てる操作は無い。作るときは `canDiscard` を見る）。
- 手に入れたとき「〜を手に入れた（一点もの）。」と知らせる（戦闘のドロップでは出さない。戦闘の「〜を手に入れた」と重なるため）。

## パラメータ（知らせ）
| 名前 | 既定 | 中身 |
|---|---|---|
| `noticeStyle` | 通知 | 倉庫・一点ものの知らせの出し方。通知（画面の端、操作を止めない）／文章（窓で止める。元の挙動） |
| `toastFrames` | 120 | 通知を出しておくフレーム数 |
| `storageMessage`・`uniqueMessage` | 〜 | 文言（空で知らせない） |

## ドロップの決まり
- パラメータ「ザコは装備を落とさない」（既定 ON）：`<hai_boss>` の無い敵の**武器・防具**のドロップを落とさない（データの設定より優先。アイテムは落ちる）。
  敵のデータ（P4・W の帯）は触らずにこの決まりがかかる。
- `<hai_drop:none>` はボスでも武器・防具を落とさない。
- `<hai_drop:…>` の固定ドロップは上の 2 つに関係なく必ず落ちる（`<hai_drop:none>` と一緒に書けば「決まった物だけを落とす」ボスになる）。

## プラグインコマンド
| コマンド | 中身 |
|---|---|
| `openStorage`（倉庫を開く） | 倉庫の一覧（`Scene_HaiStorage`）。決定で 1 つ袋へ取り出す（上限に空きがあるときだけ選べる） |

## 窓口（`window.Hai.Items`）
| 関数 | 戻り値・中身 |
|---|---|
| `storage()` | 倉庫の中身の写し `[{ kind, id, n }]`（`kind` は `item`/`weapon`/`armor`） |
| `storageCount(kind, id)` | 倉庫にある数 |
| `takeFromStorage(kind, id, n)` | 倉庫から袋へ n 個（上限まで）。出した数 |
| `putToStorage(kind, id, n)` | 袋から倉庫へ n 個。入れた数 |
| `maxOf(item)` / `roomFor(item)` | 上限 / あと何個袋に入るか（一点ものは装備中も数える） |
| `addItemMaxRule(fn)` / `itemMaxBonus()` | 消耗品の上限（`itemMax`）に `fn()` の数を足す関数を登録する（P13 の療養所。`<hai_max>`・一点ものには足さない） / 今足している数 |
| `isUnique(item)` / `canSell(item)` / `canDiscard(item)` | 一点ものか / 売れるか / 捨てられるか |
| `isBoss(enemyId)` / `dropsEquipment(enemyId)` / `fixedDrops(enemyId)` | ドロップの判定（`fixedDrops` は `[{ kind, id, n }]`） |
| `itemOf(kind, id)` / `kindOf(item)` | 種類と ID ⇔ データ（`kind` は `i`/`w`/`a` でもよい） |
| `pendingNotices()` | 画面の中で起きて、まだ出していない文章の知らせ |
| `toast(text)` | 窓を止めない小さな通知を出す（`Hai_Lore` も使う） |
| `toastState()` | `{ queued, shown, log }`（テスト用） |

## 状態（セーブに入る）
```js
$gameSystem._hai.storage = [{ kind: "item", id: 196, n: 1 }, { kind: "weapon", id: 196, n: 1 }];
```
古いセーブで無ければ、読むときに `[]` を入れる。

## 中身（alias したところ）
- `Game_Party.prototype.maxItems`・`hasMaxItems`：上限。
- `Game_Party.prototype.gainItem`：あふれた分を倉庫へ・知らせ。
- `Game_Actor.prototype.tradeItemWithParty`：付け替えの間は知らせない・装備中を数えない。
- `Window_ShopSell.prototype.isEnabled`：一点ものを売れなくする。
- `Game_Enemy.prototype.makeDropItems`：ザコの装備を外し、固定ドロップを足す。
- `Scene_Map.prototype.update`：画面の中で起きた知らせを、マップに戻ってから出す。

## 試験場
`data/Map910.json`（`tools/maps/src/p9_items`）と Items/Weapons/Armors 196–200（`node tools/maps/src/p9_data.mjs` が書く）。テストは `tests/p_items.mjs`。
