# Hai_Comfort — 快適機能（瞬間表示・早送り）（U3）

`VISION.md` 核 9「快適さ（Steam版相当）」の**文章の瞬間表示**と**早送り**。どちらもオプション画面で切り替える。

## オプション
オプション画面の「タッチ UI」（U2 が入っていれば「タッチボタン」）の下に 2 つ足す（`Window_Options.addGeneralOptions` の alias）。
値は `config.rmmzsave`（`ConfigManager`）に入り、セーブデータとは別に残る。

| 項目 | 欄 | 既定 | 中身 |
|---|---|---|---|
| 瞬間表示 | `ConfigManager.haiInstantText` | OFF | ON のとき、文章が 1 文字ずつでなく一度に出る |
| 早送り | `ConfigManager.haiFastForward` | ON | ON のとき、押し続けている間だけ文章と戦闘を速くする |

オプション画面の窓の高さ（コアは 7 行の決め打ち）は、実際の項目の数に合わせる（ほかのプラグインが足した項目も数える。12 行を超えるとスクロール）。

### 瞬間表示
- `Window_Message.updateMessage` の中の `updateShowFast` を alias して、いつも「早く出す」にする。
- `\.`（15 フレーム）・`\|`（60 フレーム）の待ちと、`\!` の入力待ちは**残る**（そこまでを一度に出し、待ってから続きを一度に出す）。
- ページ送りの入力待ち（▼）もそのまま。決定で次へ。

### 早送り
押し続けている間だけ（離すと通常）：
| 押すもの | |
|---|---|
| ダッシュのキー（Shift） | 押している間 |
| 決定（Enter・Z・Space） | **長押し**（約 0.4 秒）してから。調べるために 1 回押しただけでは早送りにならない |
| タッチ | 長押し |

| 場面 | 早送り中 |
|---|---|
| 文章 | 1 文字ずつの表示と `\.` `\|` の待ちを飛ばし、ページ送りの入力待ちも自動で送る。選択肢・数値入力・アイテム選択では止まる |
| 戦闘のログ | `Window_BattleLog.messageSpeed` を半分（パラメータ `battleWaitRate`。既定 50%） |
| アニメーション | `Sprite_Animation`（Effekseer）・`Sprite_AnimationMV` を 2 倍の速さ（パラメータ `animationRate`） |

- 早送りが OFF でも、MZ の既定の早送り（戦闘ログの待ちを、決定の長押し・Shift の間 3 倍で減らす）はそのまま残る。
- マップでは Shift はダッシュでもある（歩きながら文章が出ることはないので重ならない）。

## 結末を見た（P14 #230。二周目の早送り）
記録をまたぐ全体の旗を一つ持つ（04-climax 章末 1「二周目の早送り」）。
- 「結末のスイッチ」（既定 1159。W14 が作る）が ON になると立つ。プラグインコマンド「結末を見た」（`markEndingSeen`）でも立つ。
  結末のあとの記録をロードしたときも立つ。
- 置き場所は早送りの設定と同じ `config.rmmzsave`（`ConfigManager.haiEndingSeen`）。どの記録をロードしても、ニューゲームでも残る。オプション画面には出さない。
- 頂の三十で「早送り」の選択肢を出すかは、W14 が条件分岐のスクリプト `Hai.Comfort.endingSeen()` で読む。

## パラメータ
| 名前 | 表示名 | 既定 |
|---|---|---|
| `instantText` | 瞬間表示の名前 | 瞬間表示 |
| `fastForward` | 早送りの名前 | 早送り |
| `battleWaitRate` | 早送り中の戦闘ログの待ち（%） | 50 |
| `animationRate` | 早送り中のアニメーションの速さ（倍） | 2 |
| `endingSwitch` | 結末のスイッチ | 1159 |

## 窓口（`window.Hai.Comfort`）
| 関数 | 中身 |
|---|---|
| `get(name)` | `"instantText"`・`"fastForward"` の今の値（`"haiInstantText"` のように欄の名前でもよい） |
| `set(name, value)` | 値を変える（保存は `ConfigManager.save()`。オプション画面を閉じたときはコアが保存する） |
| `isFastForward()` | いま早送り中か（早送りが ON で、キーを押し続けている） |
| `endingSeen()` | 結末を見たことがあるか（記録をまたぐ。今の記録で結末のスイッチが ON でも `true`） |
| `markEndingSeen()` | 結末を見た旗を立てる（config に保存する）。新しく立てたら `true` |

## 中身（alias したところ）
`ConfigManager.makeData`・`applyData`、`Window_Options.addGeneralOptions`、`Scene_Options.maxCommands`、
`Window_Message.updateShowFast`・`startWait`・`updateWait`・`isTriggered`、`Window_BattleLog.messageSpeed`、
`Sprite_Animation.update`・`updateEffectGeometry`、`Sprite_AnimationMV.update`、`Game_Switches.setValue`・`DataManager.extractSaveContents`（結末を見た）。

## テスト
結末を見た旗は `tests/p_hooks.mjs` の 6。
`tests/u_warp.mjs` の 5〜8（瞬間表示で窓が開いたフレームに全文が出る、`\|` は残る、Shift を押し続けると待ちとページ送りが飛ぶ、戦闘ログの待ちが半分、オプション画面、設定が読み直しても残る）。
