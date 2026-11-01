import Foundation

public enum VentilationMode: String, Codable, CaseIterable, Sendable {
    case volumeAssistControl   = "A/C VC"
    case pressureAssistControl = "A/C PC"
    case simvVolume            = "SIMV+PS"
    case pressureSupport       = "PSV"
    case cpap                  = "CPAP"
    /* NICU のモード。rawValue は web と同じ名前（レッスンの spot "mode:HFO" をそのまま照合する）。 */
    /// 高頻度振動換気。MAP のまわりで 1 秒に 10〜15 回揺らす。
    case hfo                   = "HFO"
    /// 横隔膜の電気活動（Edi）に比例して圧を足す。
    case nava                  = "NAVA"
    /// 抜管後、鼻のマスクから続ける NAVA。
    case nivNava               = "NIV-NAVA"
    /// 高流量鼻カニュラ。呼吸は送らず、温めたガスを流し続ける。
    case hfnc                  = "HFNC"

    public var isSpontaneousOnly: Bool { self == .pressureSupport || self == .cpap }
    public var isVolumeTargeted: Bool { self == .volumeAssistControl || self == .simvVolume }
    public var isNava: Bool { self == .nava || self == .nivNava }
    /// 気管チューブが入っていないモード（鼻から支える）。
    public var isNoninvasive: Bool { self == .nivNava || self == .hfnc }
    /// 新生児の症例でだけタブを出すモード。
    public var isNICUOnly: Bool { self == .hfo || isNava || self == .hfnc }
}

public enum FlowPattern: String, Codable, Sendable { case square, decelerating }

public struct AlarmLimits: Codable, Equatable, Sendable {
    public var peakPressure: Double = 35
    public var tidalVolumeLow: Double = 250
    public var tidalVolumeHigh: Double = 800
    public var minuteVolumeLow: Double = 3
    public var minuteVolumeHigh: Double = 15
    public var respiratoryRateHigh: Double = 35
    public var apneaSeconds: Double = 20
    /// ここから下はベッドサイドモニターの枠（Web 版 alarms.spo2Low / spo2High / hrLow）。
    /// SpO₂ 上限は 100（鳴らない）で始め、早産児で高すぎる酸素を見張りたいときに下げる。
    public var spo2Low: Double = 94
    public var spo2High: Double = 100
    public var heartRateLow: Double = 60
    public init() {}
}

public struct VentilatorSettings: Codable, Equatable, Sendable {
    public var mode: VentilationMode = .volumeAssistControl
    public var tidalVolume: Double = 450          // mL
    public var respiratoryRate: Double = 14       // /min
    public var peep: Double = 5                   // cmH2O
    public var fio2: Double = 1.0                 // 0.21...1.0
    public var inspiratoryPressure: Double = 15   // PEEP からの上乗せ
    public var inspiratoryTime: Double = 1.0      // s
    public var inspiratoryFlow: Double = 50       // L/min
    public var flowPattern: FlowPattern = .decelerating
    public var pressureSupport: Double = 10
    public var triggerFlow: Double = 2.0          // L/min
    public var expiratoryTriggerFraction: Double = 0.25
    public var inspiratoryPause: Double = 0       // s
    public var riseTime: Double = 0.15            // s
    public var hfoMeanPressure: Double = 12       // HFO の平均気道内圧 MAP (cmH2O)
    public var hfoAmplitude: Double = 20          // HFO の振幅 ΔP（山から谷まで, cmH2O）
    public var hfoFrequency: Double = 12          // HFO の周波数 (Hz)
    public var navaLevel: Double = 1.5            // NAVA レベル (cmH2O/µV)
    public var hfncFlow: Double = 6               // HFNC の流量 (L/min)
    public var alarms = AlarmLimits()
    public init() {}
}

/// 人工呼吸器が表示する実測値。
public struct MeasuredValues: Equatable, Sendable {
    public var peakPressure: Double = 0
    public var plateauPressure: Double?
    public var meanAirwayPressure: Double = 0
    public var totalPEEP: Double = 0
    public var autoPEEP: Double = 0
    public var tidalVolumeExp: Double = 0
    public var minuteVolume: Double = 0
    public var respiratoryRateTotal: Double = 0
    public var respiratoryRateSpontaneous: Double = 0
    /// 患者がトリガした呼吸の回数（/分）。A/C では自発も強制換気として送られるので、自発はこれで数える。
    public var respiratoryRateTriggered: Double = 0
    public var staticCompliance: Double?
    public var airwayResistance: Double?
    public var drivingPressure: Double?
    public var ieRatio: String = "1:2"
    public var rsbi: Double?
    /// 小児の f/VT ＝ 呼吸回数 ÷ 一回換気量(mL/kg)。8 未満が離脱の目安。
    public var rsbiPerKg: Double?
    /// 1 呼吸の最大吸気流量・最大呼気流量（L/min、どちらも正の値）。波形の目盛りを体重に合わせるのに使う。
    public var peakInspiratoryFlow: Double = 0
    public var peakExpiratoryFlow: Double = 0
    /// NAVA：1 回の吸気の Edi の山と、吐いているときの谷（µV）。数呼吸でならす。
    public var ediPeak: Double?
    public var ediMin: Double?
    /// HFO：一回の揺れで動く量（mL、山から谷まで）と、CO₂ を出す力 f × VThf²（mL²/s）。
    public var hfoTidalVolume: Double = 0
    public var dco2: Double = 0
    /// 鼻から支えるときの漏れ（0〜1）。
    public var leak: Double = 0
}

public struct BloodGas: Equatable, Sendable, Identifiable {
    public var id: Double { time }
    public var time: Double
    public var pH: Double
    public var paco2: Double
    public var pao2: Double
    public var hco3: Double
    public var baseExcess: Double
    public var sao2: Double
    public var lactate: Double
    public var fio2: Double
    public var peep: Double
    public var pfRatio: Double { pao2 / fio2 }
}
