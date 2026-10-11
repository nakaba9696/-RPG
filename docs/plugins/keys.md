# キーの割り当て

コア（`Input.keyMapper`・`Input.gamepadMapper`）の既定に、プラグインが足したキー。新しく足すプラグインはここに追記する（同じキーを 2 つのプラグインで使わない）。

## コアの既定（MZ）
| 名前 | キーボード | ゲームパッド |
|---|---|---|
| `ok` | Enter・Space・Z | A（0） |
| `cancel`（`escape`） | Esc・Insert・X・テンキー 0 | B（1） |
| `menu` | （`escape` と同じ） | Y（3） |
| `shift` | Shift | X（2） |
| `pageup`・`pagedown` | PageUp・PageDown・Q・W | LB（4）・RB（5） |
| `tab`・`control`・`debug` | Tab・Ctrl/Alt・F9 | — |

## プラグインが足したもの
| 名前 | キーボード | ゲームパッド | プラグイン | どこで | 中身 |
|---|---|---|---|---|---|
| `haiMap` | **M**（77） | Back／View（8） | `Hai_AutoMap`（U1） | マップの上・地図の画面 | 地図を開く／閉じる。パラメータ `mapKey`・`mapButton` で変えられる |

## 画面のボタン（タッチ）
スマホ向けの画面のボタン（調べる・メニュー・地図・ダッシュ）は `Hai_TouchUI`（U2）が出す。新しいキーは足さず、`ok`・`escape` を立てるか `Hai.AutoMap.open()` を呼ぶ。表は [Hai_TouchUI.md](Hai_TouchUI.md) の「ボタン」。
