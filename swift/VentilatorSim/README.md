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
  VentSimApp.swift          エントリポイント、症例選択、初期設定
  SimulationController.swift  CADisplayLink で駆動、波形リングバッファ、時間倍率
  VentilatorScreen.swift    人工呼吸器画面（波形・実測値・設定・手技）
  WaveformView.swift        Canvas によるスイープ波形
  ParameterStepper.swift    モードごとの設定項目
  Sheets.swift              血液ガスと離脱のシート
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

ライブラリとテストは Swift Package Manager だけで動きます。

```
swift test
```

`App/` は SwiftUI（iOS 17 以上）です。Xcode で iOS App ターゲットを作り、
このパッケージをローカルパッケージとして追加したうえで `App/` の各ファイルを
ターゲットに含めてください。

> このリポジトリは Swift ツールチェーンのない環境で書かれているため、まだコンパイルを
> 通していません。初回ビルドで小さな修正が必要になる可能性があります。
> 一方で `Sources/VentilatorCore` の数値モデルは、同じ式を実装した JavaScript 版で
> 34 件の検証テスト（時定数、auto-PEEP、Cstat、Raw、VA と PaCO₂ の関係、PEEP と酸素化、
> 慢性代償、SBT の失敗、刻み幅非依存性）を通してあります。

## 免責

教育用です。実在の人工呼吸器の動作を簡略化したモデルであり、表示される数値も
実機・実患者とは異なります。臨床判断には使用しないでください。
