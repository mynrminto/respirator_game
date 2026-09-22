import Foundation

public enum VentilationMode: String, Codable, CaseIterable, Sendable {
    case volumeAssistControl   = "A/C VC"
    case pressureAssistControl = "A/C PC"
    case simvVolume            = "SIMV+PS"
    case pressureSupport       = "PSV"
    case cpap                  = "CPAP"

    public var isSpontaneousOnly: Bool { self == .pressureSupport || self == .cpap }
    public var isVolumeTargeted: Bool { self == .volumeAssistControl || self == .simvVolume }
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
    public var staticCompliance: Double?
    public var airwayResistance: Double?
    public var drivingPressure: Double?
    public var ieRatio: String = "1:2"
    public var rsbi: Double?
    /// 小児の f/VT ＝ 呼吸回数 ÷ 一回換気量(mL/kg)。8 未満が離脱の目安。
    public var rsbiPerKg: Double?
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
