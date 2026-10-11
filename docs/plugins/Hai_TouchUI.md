# Hai_TouchUI — スマホ操作の画面ボタン（U2）

`VISION.md` 技術方針「スマホのブラウザでもタッチで遊べる」。MZ の既定のタッチ操作（タップで移動・2 本指でキャンセル・長押しダッシュ・右上のメニューボタン）は変えず、足りない「調べる」と、地図・ダッシュの切替を画面のボタンで補う。
ボタンは `Sprite`＋`Bitmap` で描いた簡素な丸（見た目は V が後で整える）。

## ボタン
| 名前 | 位置（ゲーム座標） | マップ | 戦闘・メッセージ・イベント中 |
|---|---|---|---|
| 調べる／決定（`ok`） | 右下 | 決定キー（`ok`）を、触れている間だけ立てる。向いている先のイベントを調べる | 「決定」（同じ入力） |
| メニュー／戻る | 左下 | キャンセル（`escape`）。マップではメニューが開く | 「戻る」（キャンセル） |
| 地図（`map`） | 左下の上 | `Hai.AutoMap.open()`（U1）。メニューが開ける間だけ。`Hai.AutoMap` が無ければ出さない | 出さない |
| ダッシュ（`dash`） | 右下の上 | ダッシュの入り切り（切替。Shift と同じ向きに足す。`ConfigManager.alwaysDash` とも重なる）。入っている間は金色 | 出さない |

- 位置は UI の領域（`Graphics.boxWidth` / `boxHeight`）のうち、**ブラウザの画面に見えている部分**の隅から決める（右下・左下の余白 20px、ボタンどうしの間 16px）。
  - MZ は UA が携帯（Android・iPhone など）のときだけキャンバスを画面に合わせて縮める（`Graphics._defaultStretchMode`）。UA が携帯でないタッチ端末（iPadOS の Safari は既定で Mac の UA、細い窓のタッチ PC）では 1280×720 のキャンバスがはみ出して右と下が切れるので、キャンバスの位置（`getBoundingClientRect`）と `visualViewport` から見えている範囲を測り、その中に置く（#110）。
  - 測り直すのは画面の大きさが変わったとき（`resize`・`orientationchange`・`visualViewport` の `resize`/`scroll`）と 60 フレームごと。
- 大きさは 120px（パラメータ `size`）。縦画面（720×1280。ブラウザが画面全体を 720 幅に縮める）でも 120 × 0.5625 ≒ 67px で、64px を割らない。
- ボタンの上のタップはマップの移動先にならない（`Scene_Map.isAnyButtonPressed` を alias）。一瞬のタップも拾う。
- 2 本指でキャンセル・長押しダッシュ・右上のメニューボタン（`ConfigManager.touchUI`）は MZ のまま。

## 出る条件・オプション
- オプションに「**タッチボタン**」（`ConfigManager.haiTouchButtons`。オプション画面の「タッチ UI」の下）を足す。ON のときだけ出る。
- 既定：タッチ端末（`Utils.isMobileDevice()` かタッチ点が 1 つ以上）なら ON、そうでなければ OFF。一度オプションで変えるとその値が `config.rmmzsave` に残る。
- 出るのは `Scene_Map` と `Scene_Battle`。メニュー画面などは MZ の戻るボタン（`touchUI`）に任せる。

## 状態（セーブに入る）
`$gameSystem._hai.touchUI = { dash: false }`。古いセーブに無ければ読むときに初期値を入れる。

## パラメータ
`size`（120）・`opacity`（140）・各ボタンとオプションの文字。

## 窓口（`window.Hai.TouchUI`）
| 関数 | 中身 |
|---|---|
| `show()`／`hide()` | 「タッチボタン」を ON／OFF にする（保存はしない） |
| `isShown()` | 今のシーンでボタンが出ているか |
| `press(name)` | テスト用。`ok`・`menu`・`cancel`・`map`・`dash` |
| `rect(name)` | ボタンの矩形 `{ x, y, width, height }`（ゲームの座標）。出ていなければ `null` |
| `visibleArea()` | ボタンを置く領域（UI の領域のうち画面に見えている部分。ゲームの座標）。呼ぶと測り直す |

## キー割り当てとの関係
ボタンは `Input._currentState` の `ok`・`escape` を立てるだけで、新しいキーは足さない（[keys.md](keys.md) は U1 のマージ後に、この表への参照を足す）。

## テスト
`tests/u_touch.mjs`（`hasTouch`・`isMobile`・Android の UA・縦の `viewport` の文脈。`tests/lib.mjs` の `launchGame({ context })`）。
最後に、ふつうの 1280×720・720×1280 の窓と、`isMobile` で UA が携帯でない文脈で、4 つのボタンと戦闘の「決定」「戻る」が画面の中にあるかを見る。
