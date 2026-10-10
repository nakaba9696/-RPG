# 灰の王国（仮題）— Fanastasis 系 長編探索RPG

フリーゲーム **Fanastasis** の遊びの構造（隠し通路だらけのつながったダンジョン、避けられるシンボル敵、死者の残留思念、
記憶のオーブ、遺骸から蘇る仲間）を手本にした、ブラウザで動くオリジナル探索RPGです。
素材・コード・物語はすべてこのリポジトリで自作します。何を作るかは [VISION.md](VISION.md)、進め方は [docs/ROADMAP.md](docs/ROADMAP.md)。

## 遊び方（現在は試作段階）

`index.html` をブラウザで開くだけで遊べます。

| 操作 | キー |
|---|---|
| 移動 | 矢印キー / WASD |
| 決定・話す・調べる | Z / Enter / Space |
| キャンセル・メニュー | X / Esc |

スマホではタッチ用のボタンが画面下に出ます。セーブはメニューから（ブラウザの localStorage）。

## 開発

```bash
npm ci --ignore-scripts
node tests/run.mjs
```
詳しくは [CLAUDE.md](CLAUDE.md)。
