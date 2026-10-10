# 灰の王国（仮題）— Fanastasis 系 長編探索RPG

フリーゲーム **Fanastasis** の遊びの構造（隠し通路だらけのつながったダンジョン、避けられるシンボル敵、死者の残留思念、
記憶のオーブ、遺骸から蘇る仲間）を手本にした、RPGツクールMZ で作るオリジナル探索RPGです。
物語・プラグイン・マップは自作し、絵と音は MZ 同梱の素材と自作のものを使います。何を作るかは [VISION.md](VISION.md)、進め方は [docs/ROADMAP.md](docs/ROADMAP.md)。

## 遊び方（制作中）

- **MZ のエディタ**：`Game.rmmzproject` を開き、「テストプレイ」。
- **ブラウザ**：リポジトリ直下を静的サーバーで配って `index.html` を開く（`file://` では動きません）。例：`python3 -m http.server` → `http://localhost:8000/`。

| 操作 | キー |
|---|---|
| 移動 | 矢印キー / テンキー |
| 決定・話す・調べる | Z / Enter / Space |
| キャンセル・メニュー | X / Esc |
| ダッシュ | Shift |

マウスとタッチでも操作できます。

## 開発

```bash
npm ci --ignore-scripts
node tests/run.mjs
```
レーン・ID の帯・約束は [docs/ROADMAP.md](docs/ROADMAP.md)、データの形は [docs/mz-data.md](docs/mz-data.md)、決まりは [CLAUDE.md](CLAUDE.md)。
