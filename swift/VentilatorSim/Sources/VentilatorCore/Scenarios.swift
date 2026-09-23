import Foundation

/// 症例。パラメータだけで病態を表すので、コードを触らずに症例を足せる。
/// すべて小児（新生児〜思春期）。設定の基準は予測体重ではなく実体重。
/// web/scenarios.js と同じ値を持つ。片方を直したらもう片方も直すこと。
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
        public var inspiratoryPressure: Double
        public var inspiratoryTime: Double
        public var inspiratoryFlow: Double
        public var pressureSupport: Double
        public var riseTime: Double
        public var triggerFlow: Double

        public init(mode: VentilationMode, tidalVolume: Double, respiratoryRate: Double,
                    peep: Double, fio2: Double, inspiratoryPressure: Double,
                    inspiratoryTime: Double, inspiratoryFlow: Double,
                    pressureSupport: Double, riseTime: Double, triggerFlow: Double) {
            self.mode = mode; self.tidalVolume = tidalVolume; self.respiratoryRate = respiratoryRate
            self.peep = peep; self.fio2 = fio2; self.inspiratoryPressure = inspiratoryPressure
            self.inspiratoryTime = inspiratoryTime; self.inspiratoryFlow = inspiratoryFlow
            self.pressureSupport = pressureSupport; self.riseTime = riseTime
            self.triggerFlow = triggerFlow
        }
    }

    /// 推奨初期設定を人工呼吸器の設定に写し、アラームも体重から作る。
    public func initialSettings() -> VentilatorSettings {
        var s = VentilatorSettings()
        s.mode = suggested.mode
        s.tidalVolume = suggested.tidalVolume
        s.respiratoryRate = suggested.respiratoryRate
        s.peep = suggested.peep
        s.fio2 = suggested.fio2
        s.inspiratoryPressure = suggested.inspiratoryPressure
        s.inspiratoryTime = suggested.inspiratoryTime
        s.inspiratoryFlow = suggested.inspiratoryFlow
        s.pressureSupport = suggested.pressureSupport
        s.riseTime = suggested.riseTime
        s.triggerFlow = suggested.triggerFlow
        s.inspiratoryPause = 0
        s.alarms = .forWeight(patient.predictedBodyWeight, norms: patient.norms,
                              tidalVolume: s.tidalVolume, respiratoryRate: s.respiratoryRate)
        return s
    }
}

public enum ScenarioLibrary {

    public static let all: [Scenario] = [postoperative, rds, bronchiolitis, ards, asthma, guillainBarre]

    public static let postoperative = Scenario(
        id: "postop", title: "小児外科術後の呼吸管理", tag: "入門",
        oneLine: "肺はほぼ正常。体重あたりの初期設定と離脱の流れを一通り通す症例。",
        history: "8歳 男児、体重 25 kg、身長 126 cm。穿孔性虫垂炎による腹膜炎で緊急開腹術。手術室から挿管のまま PICU に入室した。麻酔から覚めきっておらず、自発呼吸はほとんどない。胸部X線は両下肺にわずかな無気肺があるのみ。",
        findings: ["体温 37.2℃", "心拍 100 /分", "血圧 96/58 mmHg（平均 68）",
                   "胸部聴診：左右差なし", "気管チューブ：カフ付き 5.5 mm、口角 17 cm"],
        teachingPoints: ["体重あたり（mL/kg）で一回換気量を決める", "小児の正常呼吸数に合わせる",
                         "FiO2 を早く下げる", "SBT から抜管までの流れ"],
        patient: Patient(
            name: "8歳 男児", sex: .male, heightCm: 126, age: 8,
            weightKg: 25, ageMonths: 96, ageLabel: "8歳", circuitDeadSpace: 12, normsOverride: nil,
            compliance: 0.0200, resistanceInsp: 14, resistanceExp: 17,
            shuntAtLowPEEP: 0.12, shuntMinimum: 0.06, recruitmentP50: 8, recruitmentK: 2.5,
            alveolarDeadSpaceFraction: 0.04, vco2: 105, hemoglobin: 11.0,
            paco2: 42, pao2: 92, hco3: 24, hco3Base: 24,
            cardiacOutput: 3.3, heartRate: 100, meanArterialPressure: 68, temperature: 37.2,
            sedation: 0.85, driveGain: 1.0, maxInspiratoryPressure: 22, co2Setpoint: 40,
            goals: .init(pH: 7.32...7.46, paco2: 33...48, pao2: 70...120)),
        suggested: .init(mode: .volumeAssistControl, tidalVolume: 180, respiratoryRate: 20,
                         peep: 5, fio2: 0.4, inspiratoryPressure: 12, inspiratoryTime: 0.7,
                         inspiratoryFlow: 18, pressureSupport: 8, riseTime: 0.12, triggerFlow: 1.0))

    public static let rds = Scenario(
        id: "rds", title: "早産児の呼吸窮迫症候群（RDS）", tag: "新生児",
        oneLine: "サーファクタント投与後の硬い肺。mL 単位の換気量と短い吸気時間を扱う。",
        history: "在胎 28週2日、日齢 1、体重 1,100 g。出生直後から呻吟と陥没呼吸。気管挿管しサーファクタントを 1 回投与した。胸部X線はすりガラス様陰影と air bronchogram。動脈管は開存しているが治療は要していない。",
        findings: ["体温 36.9℃（保育器内）", "心拍 150 /分", "平均血圧 32 mmHg", "Hb 16.0 g/dL",
                   "気管チューブ：カフなし 2.5 mm、口角 7 cm"],
        teachingPoints: ["一回換気量は 4〜6 mL/kg（＝ 4〜7 mL）", "吸気時間 0.3 秒前後と速い呼吸数",
                         "SpO2 目標は 90〜95%（上げすぎない）", "許容できる高 CO2 血症"],
        patient: Patient(
            name: "在胎28週 日齢1", sex: .male, heightCm: 37, age: 0,
            weightKg: 1.1, ageMonths: 0, ageLabel: "在胎28週 日齢1",
            circuitDeadSpace: 1.0, normsOverride: nil,
            compliance: 0.00055, resistanceInsp: 70, resistanceExp: 95,
            shuntAtLowPEEP: 0.50, shuntMinimum: 0.18, recruitmentP50: 9, recruitmentK: 2.0,
            alveolarDeadSpaceFraction: 0.06, vco2: 6.0, hemoglobin: 16.0,
            paco2: 52, pao2: 55, hco3: 20, hco3Base: 20,
            cardiacOutput: 0.22, heartRate: 150, meanArterialPressure: 32, temperature: 36.9,
            sedation: 0.80, driveGain: 1.0, maxInspiratoryPressure: 10, co2Setpoint: 45,
            goals: .init(pH: 7.22...7.42, paco2: 45...60, pao2: 45...75)),
        suggested: .init(mode: .pressureAssistControl, tidalVolume: 6, respiratoryRate: 55,
                         peep: 6, fio2: 0.35, inspiratoryPressure: 10, inspiratoryTime: 0.30,
                         inspiratoryFlow: 2, pressureSupport: 6, riseTime: 0.06, triggerFlow: 0.4))

    public static let bronchiolitis = Scenario(
        id: "bronchiolitis", title: "RSV 細気管支炎", tag: "auto-PEEP",
        oneLine: "気道が細く痰が多い。呼吸数を上げると息が吐けなくなる乳児の典型。",
        history: "生後 4か月、体重 6.0 kg。3日前から鼻汁と咳、前日から哺乳不良。高流量鼻カニュラでも陥没呼吸と無呼吸発作があり気管挿管。RSV 抗原陽性。胸部X線は過膨張と右中葉の無気肺。",
        findings: ["体温 38.2℃", "心拍 158 /分", "平均血圧 52 mmHg",
                   "呼気延長と wheeze、痰が多い", "気管チューブ：カフなし 3.5 mm、口角 10 cm"],
        teachingPoints: ["時定数と呼気時間（乳児でも同じ考え方）", "呼気ポーズで総 PEEP を測る",
                         "頻呼吸が auto-PEEP を作る", "痰づまりで気道内圧が上がる"],
        patient: Patient(
            name: "生後4か月", sex: .female, heightCm: 62, age: 0,
            weightKg: 6.0, ageMonths: 4, ageLabel: "生後4か月",
            circuitDeadSpace: 5, normsOverride: nil,
            compliance: 0.0039, resistanceInsp: 80, resistanceExp: 170,
            shuntAtLowPEEP: 0.34, shuntMinimum: 0.16, recruitmentP50: 9, recruitmentK: 2.5,
            alveolarDeadSpaceFraction: 0.14, vco2: 36, hemoglobin: 10.5,
            paco2: 62, pao2: 62, hco3: 26, hco3Base: 24,
            cardiacOutput: 1.1, heartRate: 158, meanArterialPressure: 52, temperature: 38.2,
            sedation: 0.85, driveGain: 1.5, maxInspiratoryPressure: 14, co2Setpoint: 42,
            goals: .init(pH: 7.20...7.42, paco2: 45...75, pao2: 50...90)),
        suggested: .init(mode: .volumeAssistControl, tidalVolume: 45, respiratoryRate: 25,
                         peep: 6, fio2: 0.5, inspiratoryPressure: 14, inspiratoryTime: 0.5,
                         inspiratoryFlow: 6, pressureSupport: 8, riseTime: 0.08, triggerFlow: 0.6))

    public static let ards = Scenario(
        id: "ards", title: "小児 ARDS（インフルエンザ肺炎）", tag: "酸素化",
        oneLine: "硬い肺と大きなシャント。小児の肺保護換気と PEEP の調整を学ぶ。",
        history: "3歳 女児、体重 14 kg、身長 95 cm。インフルエンザ A 型のあと発熱が続き、リザーバーマスク 10 L/分でも SpO2 86%、呼吸数 52 /分で気管挿管。胸部X線は両側びまん性浸潤影。心エコーで心機能は保たれている。",
        findings: ["体温 38.8℃", "心拍 150 /分", "血圧 84/44 mmHg（平均 63）",
                   "挿管前の P/F 比は 80 台", "気管チューブ：カフ付き 4.5 mm、口角 13 cm"],
        teachingPoints: ["小児 ARDS でも 5〜6 mL/kg の一回換気量",
                         "プラトー圧 28 以下・ドライビング圧 14 以下",
                         "PEEP を上げると酸素化は改善するが血圧は下がる",
                         "小児での permissive hypercapnia"],
        patient: Patient(
            name: "3歳 女児", sex: .female, heightCm: 95, age: 3,
            weightKg: 14, ageMonths: 36, ageLabel: "3歳", circuitDeadSpace: 6,
            // 小児 ARDS ではドライビング圧を 14 以下に抑える
            normsOverride: NormsOverride(drivingPressureMax: 14),
            compliance: 0.0062, resistanceInsp: 28, resistanceExp: 34,
            shuntAtLowPEEP: 0.38, shuntMinimum: 0.12, recruitmentP50: 12, recruitmentK: 3.0,
            alveolarDeadSpaceFraction: 0.10, vco2: 60, hemoglobin: 10.0,
            paco2: 58, pao2: 55, hco3: 22, hco3Base: 22,
            cardiacOutput: 2.1, heartRate: 150, meanArterialPressure: 63, temperature: 38.8,
            sedation: 0.92, driveGain: 1.7, maxInspiratoryPressure: 20, co2Setpoint: 40,
            goals: .init(pH: 7.20...7.45, paco2: 40...70, pao2: 55...95)),
        suggested: .init(mode: .volumeAssistControl, tidalVolume: 85, respiratoryRate: 30,
                         peep: 10, fio2: 0.8, inspiratoryPressure: 16, inspiratoryTime: 0.55,
                         inspiratoryFlow: 12, pressureSupport: 10, riseTime: 0.10, triggerFlow: 0.8))

    public static let asthma = Scenario(
        id: "asthma", title: "喘息重積発作", tag: "上級",
        oneLine: "極端に高い気道抵抗。息を吐かせることを最優先にする学童の症例。",
        history: "11歳 男児、体重 35 kg、身長 142 cm。喘息で吸入ステロイドを自己中断していた。発作で救急搬入、会話不能。吸入と全身ステロイドでも改善せず、意識が落ちてきたため気管挿管。silent chest。",
        findings: ["体温 36.8℃", "心拍 150 /分（吸入β2刺激薬の影響もある）",
                   "血圧 92/50 mmHg（平均 62）", "呼気がほとんど聞こえない",
                   "気管チューブ：カフ付き 6.5 mm、口角 20 cm"],
        teachingPoints: ["低い呼吸数と長い呼気時間", "auto-PEEP による血圧低下",
                         "最高気道内圧よりプラトー圧を見る", "小児でも pH 7.20 までは許容する"],
        patient: Patient(
            name: "11歳 男児", sex: .male, heightCm: 142, age: 11,
            weightKg: 35, ageMonths: 132, ageLabel: "11歳",
            circuitDeadSpace: 12, normsOverride: nil,
            compliance: 0.0245, resistanceInsp: 50, resistanceExp: 85,
            shuntAtLowPEEP: 0.16, shuntMinimum: 0.10, recruitmentP50: 8, recruitmentK: 2.5,
            alveolarDeadSpaceFraction: 0.14, vco2: 140, hemoglobin: 13.5,
            paco2: 72, pao2: 66, hco3: 24, hco3Base: 22,
            cardiacOutput: 4.2, heartRate: 150, meanArterialPressure: 78, temperature: 36.8,
            sedation: 0.95, driveGain: 1.5, maxInspiratoryPressure: 26, co2Setpoint: 40,
            volumeDepleted: true,
            goals: .init(pH: 7.20...7.45, paco2: 40...80, pao2: 60...110)),
        suggested: .init(mode: .volumeAssistControl, tidalVolume: 250, respiratoryRate: 12,
                         peep: 5, fio2: 0.6, inspiratoryPressure: 18, inspiratoryTime: 0.8,
                         inspiratoryFlow: 30, pressureSupport: 10, riseTime: 0.15, triggerFlow: 1.5))

    public static let guillainBarre = Scenario(
        id: "gbs", title: "ギラン・バレー症候群", tag: "離脱",
        oneLine: "肺は正常だが呼吸筋が弱い。離脱の可否を筋力で判断する。",
        history: "7歳 女児、体重 22 kg、身長 120 cm。感冒の 2週間後から歩けなくなり、下肢から上行する筋力低下。肺活量が低下し CO2 が溜まってきたため気管挿管。肺そのものに病変はなく、胸部X線は正常。免疫グロブリン大量療法を開始している。",
        findings: ["体温 36.7℃", "心拍 95 /分", "血圧 100/58 mmHg（平均 68）", "四肢筋力 MMT 2",
                   "気管チューブ：カフ付き 5.5 mm、口角 16 cm"],
        teachingPoints: ["肺が正常でも離脱できないことがある", "SBT 中の浅くて速い呼吸",
                         "小児では f/VT を体重あたりで見る"],
        patient: Patient(
            name: "7歳 女児", sex: .female, heightCm: 120, age: 7,
            weightKg: 22, ageMonths: 84, ageLabel: "7歳",
            circuitDeadSpace: 10, normsOverride: nil,
            compliance: 0.0210, resistanceInsp: 13, resistanceExp: 16,
            shuntAtLowPEEP: 0.10, shuntMinimum: 0.05, recruitmentP50: 8, recruitmentK: 2.5,
            alveolarDeadSpaceFraction: 0.05, vco2: 95, hemoglobin: 12.0,
            paco2: 50, pao2: 82, hco3: 26, hco3Base: 24,
            cardiacOutput: 2.9, heartRate: 95, meanArterialPressure: 68, temperature: 36.7,
            sedation: 0.20, driveGain: 1.2, maxInspiratoryPressure: 8, co2Setpoint: 40,
            fatigueLoad: 0.2, fatigueTau: 170,      // 軽い負荷でも 15 分ほどで疲れてくる
            goals: .init(pH: 7.32...7.46, paco2: 33...48, pao2: 70...120)),
        suggested: .init(mode: .volumeAssistControl, tidalVolume: 160, respiratoryRate: 16,
                         peep: 5, fio2: 0.4, inspiratoryPressure: 12, inspiratoryTime: 0.7,
                         inspiratoryFlow: 16, pressureSupport: 8, riseTime: 0.12, triggerFlow: 1.0))
}

/// 離脱の前提条件。
public struct WeaningCriterion: Identifiable {
    public let id = UUID()
    public let label: String
    public let met: Bool
    public let value: String
}

public enum Weaning {
    /// A/C では患者が吸った呼吸も強制換気として送られるので、自発はトリガの回数でも数える。
    public static func hasSpontaneousBreathing(_ engine: VentilatorEngine) -> Bool {
        let m = engine.measured
        return m.respiratoryRateSpontaneous >= 4 || m.respiratoryRateTriggered >= 4
            || engine.inspiratoryEffortAmplitude > 2
    }

    /// 小児では平均血圧の下限が年齢で変わるので、症例の基準値から取る。
    /// PEEP と P/F の条件も成人よりやや厳しい（再挿管の負担が大きいため）。
    public static func readiness(for engine: VentilatorEngine) -> [WeaningCriterion] {
        let s = engine.settings
        let pf = engine.pao2 / s.fio2
        let mapMin = engine.norms.meanArterialPressureMin
        return [
            .init(label: "FiO₂ 0.4 以下", met: s.fio2 <= 0.41, value: "\(Int((s.fio2 * 100).rounded()))%"),
            .init(label: "PEEP 7 以下", met: s.peep <= 7, value: "\(Int(s.peep)) cmH₂O"),
            .init(label: "PaO₂/FiO₂ 200 以上", met: pf >= 200, value: String(format: "%.0f", pf)),
            .init(label: "pH 7.30 以上", met: engine.pH >= 7.30, value: String(format: "%.2f", engine.pH)),
            .init(label: "循環が安定（平均血圧 \(Int(mapMin)) 以上）",
                  met: engine.meanArterialPressure >= mapMin,
                  value: String(format: "%.0f mmHg", engine.meanArterialPressure)),
            .init(label: "覚醒している", met: engine.sedation <= 0.4,
                  value: engine.sedation <= 0.4 ? "覚醒" : "鎮静下"),
            .init(label: "自発呼吸がある", met: hasSpontaneousBreathing(engine),
                  value: hasSpontaneousBreathing(engine) ? "あり" : "乏しい")
        ]
    }

    /// SBT 中止基準。満たすものがあれば文字列を返す。
    /// 成人の RR 35 / HR 140 / RSBI 105 は小児に使えないので、すべて年齢相応の値で置く。
    public static func failureReason(for engine: VentilatorEngine, elapsed: Double) -> String? {
        guard elapsed >= 60 else { return nil }
        let m = engine.measured, n = engine.norms
        let rrCap = (n.respiratoryRate.upperBound * 1.5).rounded()
        let hrCap = (n.heartRate.upperBound * 1.25).rounded()
        if m.respiratoryRateTotal > rrCap { return "呼吸数が \(Int(rrCap)) /分を超えた" }
        if engine.spo2 < n.spo2Target.lowerBound {
            return "SpO2 が \(Int(n.spo2Target.lowerBound))% を下回った"
        }
        if engine.heartRate > hrCap { return "心拍数が \(Int(hrCap)) /分を超えた" }
        if let r = m.rsbiPerKg, r > 8, elapsed > 180 { return "f/VT が 8 を超えた" }
        if engine.pH < 7.30 { return "pH が 7.30 を下回った" }
        if engine.meanArterialPressure < n.meanArterialPressureMin { return "血圧が下がった" }
        return nil
    }
}
