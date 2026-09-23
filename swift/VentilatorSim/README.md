# VentilatorSim

研修医などの学習者向けの、人工呼吸器シミュレーションゲームの Swift 実装です。

肺の物理モデルを 1 つ持ち、換気モードはその肺に圧または流量を与える制御則として実装しています。
そのため VCV・PCV・SIMV・PSV・CPAP が同じエンジンから出てきて、auto-PEEP、非同調、
SBT 中の rapid shallow breathing は個別に作り込まなくても現象として現れます。

## 構成

```
Package.swift
Sources/VentilatorCore/
  Physiology.swift          酸素解離曲線、肺胞気式、Henderson-Hasselbalch、予測体重
  Patient.swift             病態をパラメータだけで表す Codable な患者モデル
  VentilatorSettings.swift  モード・設定・実測値・血液ガス
  VentilatorEngine.swift    シミュレーション本体（運動方程式・ガス交換・循環・呼吸ドライブ）
  Scenarios.swift           症例 5 本と離脱基準
Tests/VentilatorCoreTests/
  VentilatorCoreTests.swift 解析解との突き合わせ（Swift Testing）
App/                        SwiftUI の画面。Xcode の App ターゲットに追加して使う
                            （SwiftPM のターゲットには入れていないので swift test では検査されない）
  VentSimApp.swift          エントリポイント、症例選択、初期設定
  SimulationController.swift  CADisplayLink で駆動、波形リングバッファ、トレンド、ループ、ダイヤル状態
  VentilatorScreen.swift    人工呼吸器の筐体（ステータス帯・画面・モード・設定キー・ハードキー・ダイヤル）
  DeviceChrome.swift        テーマ（ポップ／実機風）の配色と、キー・計測値タイル・修了演出の部品
  WaveformView.swift        Canvas によるスイープ波形、P–V / F–V ループ、トレンド
  KnobView.swift            ロータリーダイヤル（回して「確定」で反映）
  ParameterStepper.swift    モードごとの設定項目の定義と、初期設定画面用のステッパ
  Sheets.swift              血液ガスと離脱のシート
  LungSceneView.swift       肺の物理モデルを 3D で見る画面（SceneKit）。web/lung3d.js の Swift 版
  AppAssets.swift           Bundle.main/assets/ から Web 版と同じ PNG を読む。無ければコード描画に落ちる
```

## モデル

運動方程式

```
Paw + Pmus = V/C + R·V̇
```

を毎ステップ解きます。呼気は指数積分（`V(t+dt) = Veq + (V − Veq)·e^(−dt/τ)`、`τ = R × C`）なので、
刻み幅を変えても結果が変わらず、60 倍速でも数値が安定します。

ガス交換は次の 4 本です。応答に時間の遅れを持たせているのは、即座に結果が変わると
設定を総当たりする遊び方になり、学習にならないためです。

| 量 | 式 | 時定数 |
| --- | --- | --- |
| PaCO₂ | `0.863 × VCO2 / VA` に向かって一次遅れ | 130〜190 秒 |
| PAO₂ | `FiO2 × (760 − 47) − PaCO2 / 0.8` | 即時 |
| PaO₂ | 肺胞気からシャント式で低下。シャント率は総 PEEP でリクルートされて減る | 42 秒 |
| HCO₃⁻ | 腎性代償 `24 + 0.38 × (PaCO2 − 40)` へ | 90 分 |

平均気道内圧が上がると静脈還流が落ちて心拍出量が下がるので、「PEEP を上げれば酸素化は
良くなるが無制限ではない」というトレードオフが成立します。

## ビルド

iPhone のシミュレータで動かすには、**一つ上の階層の** `swift/VentilatorSim.xcodeproj`
を開きます（このフォルダの `Package.swift` ではありません）。

```sh
open swift/VentilatorSim.xcodeproj
```

実行先を iPhone のシミュレータにして ⌘R です。スキーム **VentaSim** は共有済みなので
選び直す必要はありません。必要な設定はすべてプロジェクトに入っています。

| | |
| --- | --- |
| ターゲット | iOS 17.0 以上、iPhone のみ、縦向き固定 |
| Bundle ID | `com.mynrminto.VentaSim` |
| 画面 | `VentilatorSim/App/` を Xcode 16 の同期フォルダとして丸ごと取り込む |
| ロジック | `VentilatorSim/`（Package.swift）をローカルパッケージ `VentilatorCore` として参照 |
| 画像 | `web/assets` をフォルダ参照で同梱（`Bundle.main/assets/`）。Web 版と同じ PNG |
| アイコン | `App/Assets.xcassets`。いぶき先生の仮アイコン（`logo.png` が来たら差し替える） |

`App/` にファイルを足したときプロジェクトを編集する必要はありません。同期フォルダなので
Xcode が自動で拾います。

Xcode を使わずロジックだけ試すこともできます。

```sh
cd swift/VentilatorSim
swift test
```

> `.xcodeproj` が開けなかったときは、`swift/project.yml` から作り直せます
> （`brew install xcodegen && cd swift && xcodegen generate`）。

> このリポジトリは Swift ツールチェーンのない環境で書かれているため、まだコンパイルを
> 通していません。初回ビルドで小さな修正が必要になる可能性があります。
> 一方で `Sources/VentilatorCore` の数値モデルは、同じ式を実装した JavaScript 版で
> 110 件の検証テスト（時定数、auto-PEEP、Cstat、Raw、VA と PaCO₂ の関係、PEEP と酸素化、
> 慢性代償、SBT の失敗、刻み幅非依存性、レッスンの到達可能性）を通してあります。

## 免責

教育用です。実在の人工呼吸器の動作を簡略化したモデルであり、表示される数値も
実機・実患者とは異なります。臨床判断には使用しないでください。

## 画面の考え方

実機の人工呼吸器と同じ構成にしています。縦スクロールはしません。

- 設定は**キーを押す → ダイヤルを回す → 確定**の 3 段階です。回している間は値が琥珀色になり、
  確定するまで患者には反映されません。実機が誤操作を防ぐためにやっていることをそのまま入れています。
- 吸気ポーズと呼気ポーズは押した瞬間ではなく、次の吸気末／呼気末で実行されます。
  途中で止めると、プラトー圧も total PEEP も違う時点の圧を測ってしまうためです。
- 早送り（× 1 / × 10 / × 60）、血液ガス、離脱、鎮静はシミュレーター側の操作なので、
  機器のキーとは色を分けています。
- 見た目は 2 通りあり、ステータス帯のボタンで切り替えます（選択は UserDefaults の
  `ventsim.theme.v1` に残ります）。既定の**ポップ**は明るい筐体に丸いキー、章ごとの色分け、
  レッスン修了の演出つき。**実機風**はこれまでの黒い筐体です。どちらも機器の画面そのものは
  暗いままで、波形と計測値のコントラストは変えていません。色と角丸はすべて `Palette`
  （DeviceChrome.swift）に集めてあり、`Chrome` 経由で読みます。Web 版の CSS カスタム
  プロパティと同じ並びにしてあるので、片方を直したらもう片方も同じ順で直せます。
- タイトル画面（`App/TitleView.swift`）から始まります。キャラクター、ロゴ、
  「つづきから／はじめる」「コースを選ぶ」「症例で練習」「この教材について」の 4 つの大きなメニュー、
  それに学習の進み具合のバーを出します。免責事項は初回の開始時に一度だけ関門として出し、
  同意を UserDefaults の `ventsim.agreed.v1` に残します。
- キャラクターは画像ファイルを持たず、`App/Characters.swift` の `Canvas` ですべて描いています
  （指導医の いぶき先生、肺のマスコット ぷくぷく、患者）。形と表情の出し分けは Web 版の
  `web/characters.js` と同じ 120×120 の座標で書いてあるので、片方を直したらもう片方も直します。
  ぷくぷくの呼吸と紙吹雪は ReduceMotion のときは止まります。
