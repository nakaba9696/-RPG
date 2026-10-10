# MZ のデータ形式（子セッションのための早見表）

クラウドの子セッションは RPGツクールMZ のエディタを開けない。`data/*.json` と `js/plugins/*.js` を手で（またはツールで）書くための早見表。
エディタでの確認と仕上げは持ち主の PC 側セッションが行う。

**確かさの印**
- 印なし：MV/MZ 共通のコアスクリプト（`rmmz_core.js`・`rmmz_objects.js` と同じ形の MV 版 `rpg_core.js`・`rpg_objects.js`）の実装から確かめたもの。
- **要確認**：記憶や推測によるもの。MZ プロジェクトが main に入ったあと、**T1 の子**が実ファイル（`js/rmmz_*.js` と、エディタが書いた `data/*.json`）で確かめ、
  違っていればこのファイルを直す（D レーンの扱いだが、T1 の PR でこのファイルの「要確認」を消す・直すのはよい）。

---

## 1. データベース（`data/*.json`）の共通の形

| ファイル | 中身 |
|---|---|
| `Actors.json` `Classes.json` `Skills.json` `Items.json` `Weapons.json` `Armors.json` `Enemies.json` `Troops.json` `States.json` `Animations.json` `Tilesets.json` `CommonEvents.json` | 配列。**0 番目は `null`**、`i` 番目の要素の `id` は `i`。 |
| `System.json` | 1 つのオブジェクト。`switches`・`variables` は名前の配列で、**0 番目は `""`**（空文字）。長さ − 1 が最大数。画面の大きさは `advanced` の `screenWidth`・`screenHeight`・`uiAreaWidth`・`uiAreaHeight`（今は 816×624）。 |
| `MapInfos.json` | 配列。0 番目は `null`。`i` 番目は `{id, expanded, name, order, parentId, scrollX, scrollY}`。**消したマップの番号は `null`** のまま残る。 |
| `Map001.json` … | 1 マップ 1 ファイル。番号は 3 桁のゼロ埋め（`Map010.json`）。 |

守ること：
- 配列の途中を詰めない（ID がずれる）。ID の帯（`docs/ROADMAP.md`）の先頭まで配列を伸ばすときは、隙間を**空の項目**（`id` と既定値だけ、`name: ""`）で埋める。
  `null` で埋めるとエディタが読めない恐れがある（**要確認**。コアの `DataManager.extractMetadata` は `null` を飛ばすので、ゲームは動く）。
- 新しく足す要素は、同じファイルの既存の要素から欄の一覧を写す（欄が欠けるとエディタで開いたときに壊れることがある。**要確認**）。
- `note` 欄のタグは `<hai_名前:値>` の形（コアが `meta` に読み込む：`$dataItems[5].meta.hai_名前`）。
- 文字列は日本語でよい。改行は `\n`。
- 書式（改行と空白）はエディタの書き方に合わせる。エディタは配列の要素を 1 行に 1 つずつ書く（`[\nnull,\n{…},\n{…}\n]`、末尾に改行なし。`System.json` は 1 行）。
  ツールで書くときは `tools/data/io.mjs` の `formatTable`・`formatMap` を通す（エディタの書いた 15 ファイルと 1 バイトも違わないことを `tests/t_data.mjs` で確かめている）。

### コアが番号で使うもの（動かさない）
- `Skills.json` の 1 番＝通常攻撃、2 番＝防御（`Game_BattlerBase.prototype.attackSkillId` / `guardSkillId`）。
- `States.json` の 1 番＝戦闘不能（`Game_BattlerBase.prototype.deathStateId`）。
- `Tilesets.json` の番号はマップの `tilesetId` が指す。
- `System.json` の `startMapId`・`startX`・`startY`・`partyMembers`（初期パーティ）。

## 2. マップ（`data/MapNNN.json`）

```jsonc
{
  "autoplayBgm": false, "autoplayBgs": false, "battleback1Name": "", "battleback2Name": "",
  "bgm": {"name": "", "pan": 0, "pitch": 100, "volume": 90}, "bgs": {…},
  "disableDashing": false, "displayName": "", "encounterList": [], "encounterStep": 30,
  "width": 20, "height": 15, "note": "", "parallaxLoopX": false, "parallaxLoopY": false,
  "parallaxName": "", "parallaxShow": true, "parallaxSx": 0, "parallaxSy": 0,
  "scrollType": 0, "specifyBattleback": false, "tilesetId": 1,
  "data": [ /* width * height * 6 個の整数 */ ],
  "events": [ null, { /* id 1 のイベント */ }, null, … ]
}
```
（欄の過不足と並びは、エディタの書いた `Map001.json` で確かめた：`data`・`events` 以外の欄は名前順に 1 行目へ、続けて `"data":[…]` を 1 行、`"events":[` の後にイベントを 1 行に 1 つ。
イベントのあるマップをエディタがどう書くかは、まだ実物がない。`tools/maps/` と `tools/data/io.mjs` は `[\nnull,\n{…}\n]` と書く。）

- **シンボルエンカウントにするので `encounterList` は `[]` のまま**にする（ランダムエンカウントを使わない）。

### 2.1 `data` の並び
`data` は 6 枚の層を順に並べた 1 次元配列。座標 `(x, y)`、層 `z` の値は

```
data[(z * height + y) * width + x]
```

| z | 中身 |
|---|---|
| 0 | 第 1 層（地面。A タイル） |
| 1 | 第 2 層（地面の上に重ねる A タイル。例：草むらのオートタイル） |
| 2 | 第 3 層（B〜E の上層タイル） |
| 3 | 第 4 層（B〜E の上層タイル） |
| 4 | 影（4 ビット：1＝左上、2＝右上、4＝左下、8＝右下 の 1/4 マス） |
| 5 | リージョン ID（0〜255） |

上層（z=2,3）の空きは `0`（B の 0 番は「何もない」タイル）。

### 2.2 タイル ID
| 区分 | 先頭 ID | 個数 | 画像（`Tilesets.json` の `tilesetNames` の添字） |
|---|---|---|---|
| B | 0 | 256 | 5 |
| C | 256 | 256 | 6 |
| D | 512 | 256 | 7 |
| E | 768 | 256 | 8 |
| A5 | 1536 | 128 | 4（オートタイルではない。`1536 + 番号`） |
| A1 | 2048 | 16 種 × 48 | 0（水・滝） |
| A2 | 2816 | 32 種 × 48 | 1（地面） |
| A3 | 4352 | 32 種 × 48 | 2（建物の屋根・壁） |
| A4 | 5888 | 48 種 × 48 | 3（壁の上面・側面） |
| 上限 | 8192 | | |

オートタイル（A1〜A4）の ID は

```
tileId = 2048 + kind * 48 + shape      // kind = 0..127、shape = 0..47
kind   = Math.floor((tileId - 2048) / 48)
shape  = (tileId - 2048) % 48
```

kind の範囲：A1 = 0〜15、A2 = 16〜47、A3 = 48〜79、A4 = 80〜127。
画像の中での kind の位置：A2 なら `tx = kind % 8`、`ty = Math.floor(kind / 8)`（A2 画像の左上の種が kind 16）。

kind の種類（コアの判定）：
- 水（床型）：A1 のうち滝でないもの。
- 滝（滝型）：A1 の kind 4 以上の**奇数**（`isWaterfallTile`）。
- 地面（床型）：A2 すべて。
- 屋根（壁型）：A3 で `kind % 16 < 8`。
- 壁の上面（床型）：A4 で `kind % 16 < 8`。
- 壁の側面（壁型）：A3・A4 で `kind % 16 >= 8`。

### 2.3 オートタイルの shape の計算

**床型（48 通り）**。周りの 8 マスが「同じ kind か」で決まる。辺（上下左右）が違う kind なら「開いている」。
角（斜め）は、その角をはさむ 2 辺がどちらも同じ kind のときだけ数える。

| shape | 開いている辺 | 足す値（その角が違う kind のとき） |
|---|---|---|
| 0〜15 | なし | 左上 +1、右上 +2、右下 +4、左下 +8 |
| 16〜19 | 左 | 右上 +1、右下 +2 |
| 20〜23 | 上 | 右下 +1、左下 +2 |
| 24〜27 | 右 | 左下 +1、左上 +2 |
| 28〜31 | 下 | 左上 +1、右上 +2 |
| 32 | 左・右 | — |
| 33 | 上・下 | — |
| 34〜35 | 上・左 | 右下 +1 |
| 36〜37 | 上・右 | 左下 +1 |
| 38〜39 | 右・下 | 左上 +1 |
| 40〜41 | 下・左 | 右上 +1 |
| 42 | 上・左・右（下だけつながる） | — |
| 43 | 上・左・下（右だけつながる） | — |
| 44 | 左・右・下（上だけつながる） | — |
| 45 | 上・右・下（左だけつながる） | — |
| 46 | 4 辺すべて（孤立） | — |
| 47 | 見本の 1 マス（画像の左上の絵そのまま） | — |

この表は `Tilemap.FLOOR_AUTOTILE_TABLE`（1/4 マスの切り出し位置の表）を読み解いて作った。
- マップの端の外は「同じ」と見る（エディタの書いた Map001 は全マスが shape 0 で、端に縁がない。T1 で確かめた）。
- 表と同じ結果になることを T1 で確かめた：`tools/maps/autotile.mjs` はコアの表を読み込んで逆に引き、
  エディタが A4 の壁の上面に形ごとに立てている通行のビット（左が開いた形は 0x02、上は 0x08、右は 0x04）と、全タイルセットの 120 種で一致する（`tests/t_maps.mjs`）。
- A4 の壁の上面と側面が隣り合うとき、`tools/maps/` は「別」と数える（上面の下の縁を描き、側面の上の縁を描く）。
  エディタの通行のビットとも、画面の見た目とも合うが、エディタの描き方と同じかは持ち主がエディタで確かめる（**要確認**）。

**壁型（16 通り）**：`shape = 左 1 + 上 2 + 右 4 + 下 8`（開いている辺の値を足す）。
（`Tilemap.WALL_AUTOTILE_TABLE` から。T1 で確かめた。**要確認**：壁の側面の上下のつながりを、上が壁の上面か屋根かでエディタが変えるか。）

**滝型（4 通り）**：`shape = 左 1 + 右 2`（開いている辺）。

検算：`tests/t_maps.mjs` が、エディタで作られたマップ（文字マップから作っていないもの）を読み戻して shape を計算し直し、一致したマスの数を出す（Map001 は全マス一致）。

### 2.4 通行の設定（`Tilesets.json`）
`Tilesets.json` の要素：`{id, flags, mode, name, note, tilesetNames}`。
`tilesetNames` は `[A1, A2, A3, A4, A5, B, C, D, E]` の画像名（`img/tilesets/` の拡張子なしの名前）。
`flags` は長さ 8192 の配列で、タイル ID ごとのビット：

| ビット | 意味 |
|---|---|
| `0x01` | 下へ通れない |
| `0x02` | 左へ通れない |
| `0x04` | 右へ通れない |
| `0x08` | 上へ通れない（4 つとも立つ＝通行不可） |
| `0x10` | ☆（キャラより上に描き、通行に影響しない） |
| `0x20` | 梯子 |
| `0x40` | 茂み |
| `0x80` | カウンター |
| `0x100` | ダメージ床 |
| `0x200` | 小型船が通れない |
| `0x400` | 大型船が通れない |
| `0x800` | 飛行船が降りられない |
| `flags >> 12` | 地形タグ（0〜7） |

通行の判定は上の層から見て、☆でない最初のタイルのビットで決まる（`Game_Map.checkPassage`）。
`mode`：0＝フィールド型、1＝エリア型（`Game_Map.isOverworld` が `mode === 0` を見る。同梱の Tilesets.json でも 1 番「フィールド」だけが 0）。

**隠し通路の作り方の約束（P2 で確定させる）**：見た目は壁、実は通れる通路は「通れる壁タイル」をタイルセットに作らず、
リージョン ID か通行のイベントで表す（P2 の子が決め、このファイルに追記する）。

## 3. イベント

```jsonc
{ "id": 3, "name": "残留思念", "note": "", "x": 5, "y": 7,
  "pages": [ {
    "conditions": { "actorId": 1, "actorValid": false, "itemId": 1, "itemValid": false,
                    "selfSwitchCh": "A", "selfSwitchValid": false,
                    "switch1Id": 1, "switch1Valid": false, "switch2Id": 1, "switch2Valid": false,
                    "variableId": 1, "variableValid": false, "variableValue": 0 },
    "directionFix": false,
    "image": { "characterIndex": 0, "characterName": "", "direction": 2, "pattern": 0, "tileId": 0 },
    "list": [ { "code": 101, "indent": 0, "parameters": ["", 0, 0, 2, ""] },
              { "code": 401, "indent": 0, "parameters": ["……誰かの声が残っている。"] },
              { "code": 0,   "indent": 0, "parameters": [] } ],
    "moveFrequency": 3, "moveRoute": { "list": [ {"code": 0, "parameters": []} ], "repeat": true, "skippable": false, "wait": false },
    "moveSpeed": 3, "moveType": 0, "priorityType": 1, "stepAnime": false, "through": false,
    "trigger": 0, "walkAnime": true } ] }
```

- `pages` は後ろのページほど優先（条件を満たす**最後の**ページが使われる）。
- `trigger`：0＝決定ボタン、1＝プレイヤーから接触、2＝イベントから接触、3＝自動実行、4＝並列処理。
- `priorityType`：0＝通常キャラの下、1＝通常キャラと同じ、2＝通常キャラの上。
- `moveType`：0＝固定、1＝ランダム、2＝近づく、3＝カスタム。
- `image.tileId` が 0 でなければタイルの絵で描く（`characterName` は空）。
- `list` は**必ず `code: 0` で終わる**。分岐の中は `indent` を 1 つ深くし、分岐の終わりの命令（412・404・604 など）は元の `indent` に戻す。
- セルフスイッチは `"A"`〜`"D"`。宝箱・既読などイベントごとの状態はセルフスイッチで持ち、全体のスイッチを使わない。

イベントコマンドのコード表は [CLAUDE.md](../CLAUDE.md) の「イベントコマンド」にある。

## 4. `js/plugins.js`

```js
// Generated by RPG Maker.
// Do not edit this file directly.
var $plugins =
[
{"name":"Hai_TestHooks","status":true,"description":"テスト用の窓口","parameters":{"enabled":"true"}}
];
```

- 1 行 1 プラグイン。上から順に読み込まれる（後ろのものが前のものを上書きできる）。
- `parameters` の値は**すべて文字列**（数値も真偽も文字列。構造体は JSON の文字列）。
- エディタのプラグイン管理で保存するとこのファイルが書き直される。先頭の 2 行のコメントと `var $plugins =`、`[`、`];` の形は、エディタが書いた空の一覧で確かめた。
  要素の行の書き方（1 行に 1 つ）は **要確認**（エディタで保存したものがまだない）。

## 5. セーブ
- ブラウザで動かしたときのセーブは localforage（IndexedDB）に入る。PC 版（NW.js）では `save/file1.rmmzsave` など（`StorageManager.filePath`）。ブラウザでの鍵は `rmmzsave.<gameId>.file1`。
- セーブには `$gameSystem`・`$gameSwitches`・`$gameVariables`・`$gameSelfSwitches`・`$gameActors`・`$gameParty`・`$gameMap`・`$gamePlayer` などが
  `JsonEx` でまるごと入る。プラグインが自分の状態を `$gameSystem` の自分の名前空間（例 `this._hai.symbolEnemy`）に置けば、自動でセーブされる。
- 古いセーブにはその欄が無い。**読むときに無ければ初期値を入れる**（`??=`）。版の番号は要らない。
