import Foundation

/// 症例。パラメータだけで病態を表すので、コードを触らずに症例を足せる。
public struct Scenario: Identifiable, Codable, Equatable {
    public var id: String
    public var title: String
    public var tag: String
    public var oneLine: String
    public var history: String
    public var findings: [String]
    public var teachingPoints: [String]
    public var patient: Patient
    public var suggested: SuggestedSettings

    public struct SuggestedSettings: Codable, Equatable {
        public var mode: VentilationMode
        public var tidalVolume: Double
        public var respiratoryRate: Double
        public var peep: Double
        public var fio2: Double
    }
}

public enum ScenarioLibrary {

    public static let all: [Scenario] = [postoperative, ards, copd, asthma, guillainBarre]

    public static let postoperative = Scenario(
        id: "postop", title: "開腹術後の呼吸不全", tag: "入門",
        oneLine: "肺はほぼ正常。初期設定と離脱の流れを一通り通す症例。",
        history: "68歳男性、身長 170 cm。S状結腸切除後。手術室から挿管のまま ICU 入室。麻酔から覚めきっておらず、自発呼吸はほとんどない。",
        findings: ["体温 36.8℃", "心拍 88 /分", "血圧 118/64 mmHg", "胸部聴診：左右差なし"],
        teachingPoints: ["予測体重から一回換気量を決める", "FiO2 を早く下げる", "SBT から抜管までの流れ"],
        patient: Patient(
            name: "68歳 男性", sex: .male, heightCm: 170, age: 68,
            compliance: 0.050, resistanceInsp: 7, resistanceExp: 9,
            shuntAtLowPEEP: 0.10, shuntMinimum: 0.05, recruitmentP50: 8, recruitmentK: 2.5,
            alveolarDeadSpaceFraction: 0.03, vco2: 200, hemoglobin: 11.5,
            paco2: 42, pao2: 90, hco3: 24, hco3Base: 24,
            cardiacOutput: 5.0, heartRate: 88, meanArterialPressure: 80, temperature: 36.8,
            sedation: 0.85, driveGain: 1.0, maxInspiratoryPressure: 24, co2Setpoint: 40,
            goals: .init(pH: 7.32...7.46, paco2: 33...48, pao2: 70...120)),
        suggested: .init(mode: .volumeAssistControl, tidalVolume: 430,
                         respiratoryRate: 14, peep: 5, fio2: 0.4))

    public static let ards = Scenario(
        id: "ards", title: "重症肺炎による ARDS", tag: "酸素化",
        oneLine: "硬い肺と大きなシャント。肺保護換気と PEEP の調整を学ぶ。",
        history: "54歳女性、身長 158 cm。市中肺炎で 3 日前から発熱。リザーバーマスク 15 L/分でも SpO2 88%、呼吸数 34 /分で挿管。両側びまん性浸潤影。",
        findings: ["体温 38.6℃", "心拍 112 /分", "血圧 104/58 mmHg", "P/F 比は挿管前 80 台"],
        teachingPoints: ["6 mL/kg 予測体重の一回換気量",
                         "プラトー圧 30 以下・ドライビング圧 15 以下",
                         "PEEP を上げると酸素化は改善するが血圧は下がる",
                         "permissive hypercapnia"],
        patient: Patient(
            name: "54歳 女性", sex: .female, heightCm: 158, age: 54,
            compliance: 0.028, resistanceInsp: 9, resistanceExp: 11,
            shuntAtLowPEEP: 0.36, shuntMinimum: 0.10, recruitmentP50: 12, recruitmentK: 3.0,
            alveolarDeadSpaceFraction: 0.14, vco2: 200, hemoglobin: 10.5,
            paco2: 55, pao2: 58, hco3: 22, hco3Base: 22,
            cardiacOutput: 5.6, heartRate: 112, meanArterialPressure: 74, temperature: 38.6,
            sedation: 0.9, driveGain: 1.7, maxInspiratoryPressure: 30, co2Setpoint: 40,
            goals: .init(pH: 7.25...7.45, pao2: 55...95)),
        suggested: .init(mode: .volumeAssistControl, tidalVolume: 300,
                         respiratoryRate: 24, peep: 12, fio2: 0.8))

    public static let copd = Scenario(
        id: "copd", title: "COPD 急性増悪", tag: "auto-PEEP",
        oneLine: "気道抵抗が高く呼気に時間がかかる。呼吸数を上げると息が吐けなくなる。",
        history: "72歳男性、身長 165 cm。COPD で在宅酸素療法中。感冒を契機に増悪し NPPV でも改善せず挿管。普段から PaCO2 は 55〜60 mmHg。",
        findings: ["体温 37.2℃", "心拍 104 /分", "血圧 132/70 mmHg", "呼気延長と wheeze"],
        teachingPoints: ["時定数と呼気時間", "呼気ポーズで総 PEEP を測る",
                         "慢性の高 CO2 を正常化しない", "頻呼吸が auto-PEEP を作る"],
        patient: Patient(
            name: "72歳 男性", sex: .male, heightCm: 165, age: 72,
            compliance: 0.072, resistanceInsp: 18, resistanceExp: 28,
            shuntAtLowPEEP: 0.16, shuntMinimum: 0.10, recruitmentP50: 8, recruitmentK: 2.5,
            alveolarDeadSpaceFraction: 0.18, vco2: 210, hemoglobin: 15.8,
            paco2: 68, pao2: 62, hco3: 34, hco3Base: 24,
            cardiacOutput: 5.2, heartRate: 104, meanArterialPressure: 88, temperature: 37.2,
            sedation: 0.85, driveGain: 1.1, maxInspiratoryPressure: 20, co2Setpoint: 55,
            goals: .init(pH: 7.30...7.46, pao2: 55...85)),
        suggested: .init(mode: .volumeAssistControl, tidalVolume: 450,
                         respiratoryRate: 12, peep: 5, fio2: 0.4))

    public static let asthma = Scenario(
        id: "asthma", title: "重症喘息発作", tag: "上級",
        oneLine: "極端に高い気道抵抗。息を吐かせることを最優先にする。",
        history: "29歳女性、身長 160 cm。喘息発作で救急搬入。会話不能、SpO2 89%、意識が落ちてきたため気管挿管。silent chest。",
        findings: ["体温 36.9℃", "心拍 128 /分", "血圧 96/54 mmHg", "呼気がほとんど聞こえない"],
        teachingPoints: ["低い呼吸数と長い呼気時間", "auto-PEEP による血圧低下",
                         "最高気道内圧よりプラトー圧を見る"],
        patient: Patient(
            name: "29歳 女性", sex: .female, heightCm: 160, age: 29,
            compliance: 0.055, resistanceInsp: 26, resistanceExp: 46,
            shuntAtLowPEEP: 0.14, shuntMinimum: 0.08, recruitmentP50: 8, recruitmentK: 2.5,
            alveolarDeadSpaceFraction: 0.18, vco2: 235, hemoglobin: 13.2,
            paco2: 70, pao2: 66, hco3: 21, hco3Base: 21,
            cardiacOutput: 4.6, heartRate: 128, meanArterialPressure: 68, temperature: 36.9,
            sedation: 0.95, driveGain: 1.5, maxInspiratoryPressure: 26, co2Setpoint: 40,
            volumeDepleted: true,
            goals: .init(pH: 7.20...7.45, pao2: 60...110)),
        suggested: .init(mode: .volumeAssistControl, tidalVolume: 400,
                         respiratoryRate: 12, peep: 5, fio2: 0.6))

    public static let guillainBarre = Scenario(
        id: "gbs", title: "ギラン・バレー症候群", tag: "離脱",
        oneLine: "肺は正常だが呼吸筋が弱い。離脱の可否を筋力で判断する。",
        history: "45歳男性、身長 172 cm。下肢から上行する筋力低下。肺活量が低下し CO2 が溜まってきたため挿管。肺そのものに病変はない。",
        findings: ["体温 36.6℃", "心拍 82 /分", "血圧 126/72 mmHg", "四肢筋力 MMT 2"],
        teachingPoints: ["肺が正常でも離脱できないことがある",
                         "SBT 中の rapid shallow breathing", "RSBI の読み方"],
        patient: Patient(
            name: "45歳 男性", sex: .male, heightCm: 172, age: 45,
            compliance: 0.052, resistanceInsp: 7, resistanceExp: 9,
            shuntAtLowPEEP: 0.10, shuntMinimum: 0.05, recruitmentP50: 8, recruitmentK: 2.5,
            alveolarDeadSpaceFraction: 0.05, vco2: 200, hemoglobin: 13.0,
            paco2: 52, pao2: 78, hco3: 26, hco3Base: 24,
            cardiacOutput: 5.0, heartRate: 82, meanArterialPressure: 86, temperature: 36.6,
            sedation: 0.25, driveGain: 1.2, maxInspiratoryPressure: 9, co2Setpoint: 40,
            goals: .init(pH: 7.32...7.46, paco2: 33...48, pao2: 70...120)),
        suggested: .init(mode: .volumeAssistControl, tidalVolume: 450,
                         respiratoryRate: 14, peep: 5, fio2: 0.4))
}

/// 離脱の前提条件。
public struct WeaningCriterion: Identifiable {
    public let id = UUID()
    public let label: String
    public let met: Bool
    public let value: String
}

public enum Weaning {
    public static func readiness(for engine: VentilatorEngine) -> [WeaningCriterion] {
        let s = engine.settings
        let pf = engine.pao2 / s.fio2
        return [
            .init(label: "FiO2 0.4 以下", met: s.fio2 <= 0.41, value: "\(Int(s.fio2 * 100))%"),
            .init(label: "PEEP 8 以下", met: s.peep <= 8, value: "\(Int(s.peep)) cmH2O"),
            .init(label: "PaO2/FiO2 150 以上", met: pf >= 150, value: String(format: "%.0f", pf)),
            .init(label: "pH 7.30 以上", met: engine.pH >= 7.30, value: String(format: "%.2f", engine.pH)),
            .init(label: "循環が安定（MAP 65 以上）", met: engine.meanArterialPressure >= 65,
                  value: String(format: "%.0f mmHg", engine.meanArterialPressure)),
            .init(label: "覚醒している", met: engine.sedation <= 0.4,
                  value: engine.sedation <= 0.4 ? "覚醒" : "鎮静下"),
            .init(label: "自発呼吸がある", met: engine.measured.respiratoryRateSpontaneous >= 4,
                  value: engine.measured.respiratoryRateSpontaneous >= 4 ? "あり" : "乏しい")
        ]
    }

    /// SBT 中止基準。満たすものがあれば文字列を返す。
    public static func failureReason(for engine: VentilatorEngine, elapsed: Double) -> String? {
        guard elapsed >= 60 else { return nil }
        let m = engine.measured
        if m.respiratoryRateTotal > 35 { return "呼吸数が 35 /分を超えた" }
        if engine.spo2 < 90 { return "SpO2 が 90% を下回った" }
        if engine.heartRate > 140 { return "心拍数が 140 /分を超えた" }
        if let rsbi = m.rsbi, rsbi > 105, elapsed > 180 { return "RSBI が 105 を超えた" }
        if engine.pH < 7.30 { return "pH が 7.30 を下回った" }
        if engine.meanArterialPressure < 60 { return "血圧が下がった" }
        return nil
    }
}
