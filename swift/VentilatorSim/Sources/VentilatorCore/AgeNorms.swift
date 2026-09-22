import Foundation

/// 年齢相応の基準値。体重が 1 kg から 35 kg まで動くので、
/// 「正常」も「上限」も年齢で決めないと意味を持たない。
/// JS 版（web/engine.js の ageNorms）と同じ値を持つ。
public struct AgeNorms: Equatable, Sendable {
    public var label: String
    public var respiratoryRate: ClosedRange<Double>   // 正常な呼吸数
    public var heartRate: ClosedRange<Double>
    public var meanArterialPressureMin: Double        // 許容できる平均血圧の下限
    public var spo2Target: ClosedRange<Double>
    public var plateauMax: Double
    public var drivingPressureMax: Double
    public var tidalPerKg: ClosedRange<Double>
    public var circuitDeadSpace: Double               // mL（回路＋フローセンサ）
    public var apneaSeconds: Double
    public var respiratoryRateMax: Double
    public var inspiratoryTimeMin: Double
    public var triggerLockout: Double                 // s
    public var abgPH: ClosedRange<Double>
    public var abgPaco2: ClosedRange<Double>
    public var abgPao2: ClosedRange<Double>
    public var abgHco3: ClosedRange<Double>
}

/// 症例ごとに一部だけ上書きしたいとき用。書かなかった項目は年齢の既定値のまま。
public struct NormsOverride: Codable, Equatable, Sendable {
    public var plateauMax: Double?
    public var drivingPressureMax: Double?
    public var meanArterialPressureMin: Double?
    public var spo2Low: Double?
    public var spo2High: Double?
    public init(plateauMax: Double? = nil, drivingPressureMax: Double? = nil,
                meanArterialPressureMin: Double? = nil,
                spo2Low: Double? = nil, spo2High: Double? = nil) {
        self.plateauMax = plateauMax
        self.drivingPressureMax = drivingPressureMax
        self.meanArterialPressureMin = meanArterialPressureMin
        self.spo2Low = spo2Low
        self.spo2High = spo2High
    }
}

/// つまみの可動域。早産児の Vt は 0.5 mL 刻み、学童は 10 mL 刻みになる。
public struct DialRange: Equatable, Sendable {
    public var min: Double
    public var max: Double
    public var step: Double
    public var decimals: Int
}

public struct DialLimits: Equatable, Sendable {
    public var tidalVolume: DialRange
    public var respiratoryRate: DialRange
    public var inspiratoryTime: DialRange
    public var inspiratoryFlow: DialRange
    public var inspiratoryPause: DialRange
    public var trigger: DialRange
    public var inspiratoryPressure: DialRange
    public var pressureSupport: DialRange
}

public extension Physiology {

    /// 月齢から年齢相応の基準値を作る。
    static func ageNorms(ageMonths: Double) -> AgeNorms {
        if ageMonths < 1 {
            return AgeNorms(label: "新生児", respiratoryRate: 40...60, heartRate: 120...160,
                            meanArterialPressureMin: 30, spo2Target: 90...95,
                            plateauMax: 24, drivingPressureMax: 12, tidalPerKg: 4...6,
                            circuitDeadSpace: 1.0, apneaSeconds: 10, respiratoryRateMax: 80,
                            inspiratoryTimeMin: 0.20, triggerLockout: 0.10,
                            abgPH: 7.25...7.40, abgPaco2: 40...55, abgPao2: 45...75, abgHco3: 18...24)
        }
        if ageMonths < 12 {
            return AgeNorms(label: "乳児", respiratoryRate: 30...50, heartRate: 110...160,
                            meanArterialPressureMin: 45, spo2Target: 92...97,
                            plateauMax: 26, drivingPressureMax: 13, tidalPerKg: 5...7,
                            circuitDeadSpace: 5, apneaSeconds: 15, respiratoryRateMax: 70,
                            inspiratoryTimeMin: 0.30, triggerLockout: 0.12,
                            abgPH: 7.33...7.45, abgPaco2: 33...45, abgPao2: 70...100, abgHco3: 19...24)
        }
        if ageMonths < 36 {
            return AgeNorms(label: "幼児", respiratoryRate: 24...40, heartRate: 100...140,
                            meanArterialPressureMin: 50, spo2Target: 92...97,
                            plateauMax: 28, drivingPressureMax: 14, tidalPerKg: 5...7,
                            circuitDeadSpace: 8, apneaSeconds: 15, respiratoryRateMax: 60,
                            inspiratoryTimeMin: 0.35, triggerLockout: 0.15,
                            abgPH: 7.34...7.45, abgPaco2: 33...45, abgPao2: 80...100, abgHco3: 20...25)
        }
        if ageMonths < 72 {
            return AgeNorms(label: "未就学児", respiratoryRate: 20...30, heartRate: 90...130,
                            meanArterialPressureMin: 55, spo2Target: 92...97,
                            plateauMax: 28, drivingPressureMax: 15, tidalPerKg: 6...8,
                            circuitDeadSpace: 10, apneaSeconds: 18, respiratoryRateMax: 55,
                            inspiratoryTimeMin: 0.40, triggerLockout: 0.18,
                            abgPH: 7.35...7.45, abgPaco2: 34...45, abgPao2: 80...100, abgHco3: 21...26)
        }
        if ageMonths < 144 {
            return AgeNorms(label: "学童", respiratoryRate: 18...26, heartRate: 75...115,
                            meanArterialPressureMin: 60, spo2Target: 94...98,
                            plateauMax: 30, drivingPressureMax: 15, tidalPerKg: 6...8,
                            circuitDeadSpace: 12, apneaSeconds: 20, respiratoryRateMax: 45,
                            inspiratoryTimeMin: 0.45, triggerLockout: 0.20,
                            abgPH: 7.35...7.45, abgPaco2: 35...45, abgPao2: 80...100, abgHco3: 22...26)
        }
        return AgeNorms(label: "思春期", respiratoryRate: 14...22, heartRate: 60...100,
                        meanArterialPressureMin: 65, spo2Target: 94...98,
                        plateauMax: 30, drivingPressureMax: 15, tidalPerKg: 6...8,
                        circuitDeadSpace: 15, apneaSeconds: 20, respiratoryRateMax: 40,
                        inspiratoryTimeMin: 0.50, triggerLockout: 0.25,
                        abgPH: 7.35...7.45, abgPaco2: 35...45, abgPao2: 80...100, abgHco3: 22...26)
    }

    /// 症例の患者から、エンジンと画面が使う基準値一式を作る。
    static func norms(for patient: Patient) -> AgeNorms {
        var n = ageNorms(ageMonths: patient.ageMonths)
        if let o = patient.normsOverride {
            if let v = o.plateauMax { n.plateauMax = v }
            if let v = o.drivingPressureMax { n.drivingPressureMax = v }
            if let v = o.meanArterialPressureMin { n.meanArterialPressureMin = v }
            if let lo = o.spo2Low, let hi = o.spo2High { n.spo2Target = lo...hi }
        }
        return n
    }

    /// つまみの可動域を体重から作る。
    static func dialLimits(weightKg w: Double, norms n: AgeNorms) -> DialLimits {
        let fine = w < 6, small = w < 20
        let vtStep = fine ? 0.5 : (small ? 5.0 : 10.0)
        let vtMax = Swift.max(vtStep * 4, (w * 15 / vtStep).rounded(.up) * vtStep)
        let vtMin = Swift.max(vtStep, (w * 2 / vtStep).rounded(.down) * vtStep)
        let flowMax = Swift.max(4, (w * 1.6).rounded(.up))
        let flowStep: Double = flowMax <= 12 ? 0.5 : (flowMax <= 40 ? 1 : 5)
        return DialLimits(
            tidalVolume: DialRange(min: vtMin, max: vtMax, step: vtStep, decimals: fine ? 1 : 0),
            respiratoryRate: DialRange(min: 5, max: n.respiratoryRateMax, step: 1, decimals: 0),
            inspiratoryTime: DialRange(min: n.inspiratoryTimeMin,
                                       max: fine ? 1.0 : (small ? 1.8 : 2.5), step: 0.05, decimals: 2),
            inspiratoryFlow: DialRange(min: flowStep, max: flowMax, step: flowStep,
                                       decimals: flowStep < 1 ? 1 : 0),
            inspiratoryPause: DialRange(min: 0, max: fine ? 0.4 : 0.8,
                                        step: fine ? 0.05 : 0.1, decimals: 2),
            trigger: DialRange(min: 0.2, max: fine ? 3 : 8, step: fine ? 0.1 : 0.5, decimals: 1),
            inspiratoryPressure: DialRange(min: 4, max: fine ? 30 : 40, step: 1, decimals: 0),
            pressureSupport: DialRange(min: 0, max: fine ? 20 : 25, step: 1, decimals: 0))
    }
}

public extension AlarmLimits {
    /// 体重と設定値からアラームの初期値を作る。実機と同じで、設定値の周りに枠を作る。
    static func forWeight(_ w: Double, norms n: AgeNorms,
                          tidalVolume vt: Double, respiratoryRate rr: Double) -> AlarmLimits {
        let mv = vt / 1000 * rr
        var a = AlarmLimits()
        a.peakPressure = (n.plateauMax + 8).rounded()
        a.tidalVolumeLow = Swift.max(1, (vt * 0.55).rounded())
        a.tidalVolumeHigh = (w * 10).rounded()
        a.minuteVolumeLow = Swift.max(0.05, (mv * 0.6 * 100).rounded() / 100)
        a.minuteVolumeHigh = (mv * 1.8 * 100).rounded() / 100
        a.respiratoryRateHigh = Swift.min(n.respiratoryRateMax, (rr * 1.5 + 8).rounded())
        a.apneaSeconds = n.apneaSeconds
        return a
    }
}
