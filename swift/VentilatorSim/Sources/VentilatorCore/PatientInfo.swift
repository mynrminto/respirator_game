import Foundation

/* 患者情報パネルに出すもの。web/scenarios.js の patientProfile / targetsFor / sedationLabel と同じ。
 * 開始時の初期設定画面は一度きりなので、体重や経過を見直したくなったときはここへ戻ってくる。 */

public struct PatientProfile: Equatable {
    /// 物語の呼び名があればそれ、無ければ「8歳 男児」。
    public let name: String
    /// 呼び名があるときだけ「8歳 男児」。無いときは name と同じになるので空にする。
    public let ageSex: String
    public let ward: String
    public let weight: String
    public let height: String
}

/// 体重と年齢から決まる設定の目安の 1 行。
public struct PatientTarget: Identifiable, Equatable {
    public var id: String { label }
    public let label: String
    public let value: String
    public let sub: String
}

public extension Scenario {

    var profile: PatientProfile {
        let p = patient, kg = p.weightKg
        let ageSex = p.ageLabel + " " + (p.sex == .female ? "女児" : "男児")
        return PatientProfile(
            name: nickname ?? ageSex,
            ageSex: nickname == nil ? "" : ageSex,
            ward: ward,
            weight: (kg < 10 ? String(format: "%.1f", kg) : String(format: "%.0f", kg)) + " kg",
            height: String(format: "%.0f cm", p.heightCm))
    }
}

public enum PatientInfo {

    /// 初期設定の画面と患者情報で同じものを出す。
    public static func targets(for engine: VentilatorEngine) -> [PatientTarget] {
        let n = engine.norms, kg = engine.patient.predictedBodyWeight, vk = n.tidalPerKg
        func rd(_ v: Double) -> String { kg < 6 ? String(format: "%.1f", v) : String(format: "%.0f", v) }
        func i(_ v: Double) -> String { String(format: "%.0f", v) }
        return [
            .init(label: "一回換気量", value: "\(i(vk.lowerBound))〜\(i(vk.upperBound)) mL/kg",
                  sub: "\(rd(kg * vk.lowerBound))〜\(rd(kg * vk.upperBound)) mL"),
            .init(label: "呼吸数", value: "\(i(n.respiratoryRate.lowerBound))〜\(i(n.respiratoryRate.upperBound)) /分",
                  sub: n.label + "の正常"),
            .init(label: "プラトー圧", value: "\(i(n.plateauMax)) 以下", sub: "cmH₂O"),
            .init(label: "ドライビング圧", value: "\(i(n.drivingPressureMax)) 以下", sub: "cmH₂O"),
            .init(label: "SpO₂ 目標", value: "\(i(n.spo2Target.lowerBound))〜\(i(n.spo2Target.upperBound)) %", sub: ""),
            .init(label: "平均血圧", value: "\(i(n.meanArterialPressureMin)) 以上", sub: "mmHg")
        ]
    }

    /// 鎮静の深さ。離脱の条件（0.4 以下で覚醒）と同じ境目で言葉にする。
    public static func sedationLabel(_ x: Double) -> String {
        x > 0.75 ? "深い" : (x > 0.4 ? "中くらい" : "浅い（覚醒）")
    }

    /// 採血からの時間。
    public static func ago(_ seconds: Double) -> String {
        let m = max(0, Int((seconds / 60).rounded()))
        if m < 1 { return "たったいま" }
        return m < 60 ? "\(m) 分前" : "\(m / 60) 時間 \(m % 60) 分前"
    }
}
