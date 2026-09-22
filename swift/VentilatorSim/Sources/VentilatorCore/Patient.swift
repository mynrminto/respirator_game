import Foundation

/// 病態をパラメータだけで表す。症例を足すときにコードを触らずに済むよう Codable にしてある。
public struct Patient: Codable, Equatable {

    public enum Sex: String, Codable { case male, female }

    public struct Goals: Codable, Equatable {
        public var pH: ClosedRange<Double>?
        public var paco2: ClosedRange<Double>?
        public var pao2: ClosedRange<Double>?
        public init(pH: ClosedRange<Double>? = nil,
                    paco2: ClosedRange<Double>? = nil,
                    pao2: ClosedRange<Double>? = nil) {
            self.pH = pH; self.paco2 = paco2; self.pao2 = pao2
        }
    }

    public var name: String
    public var sex: Sex
    public var heightCm: Double
    public var age: Int

    /// 小児では設定の基準が実体重になる。月齢から年齢相応の基準値が決まる。
    public var weightKg: Double
    public var ageMonths: Double
    public var ageLabel: String
    /// 回路＋フローセンサの死腔 (mL)。新生児回路は 1 mL、成人回路は 30 mL と桁が違う。
    public var circuitDeadSpace: Double
    public var normsOverride: NormsOverride?

    // 力学
    public var compliance: Double        // L/cmH2O
    public var resistanceInsp: Double    // cmH2O/(L/s)
    public var resistanceExp: Double

    // ガス交換
    public var shuntAtLowPEEP: Double    // 0...1
    public var shuntMinimum: Double
    public var recruitmentP50: Double    // このあたりの総 PEEP でシャントが半分になる
    public var recruitmentK: Double
    public var alveolarDeadSpaceFraction: Double
    public var vco2: Double              // mL/min
    public var hemoglobin: Double        // g/dL

    // 初期値
    public var paco2: Double
    public var pao2: Double
    public var hco3: Double
    public var hco3Base: Double
    public var cardiacOutput: Double     // L/min
    public var heartRate: Double
    public var meanArterialPressure: Double
    public var temperature: Double

    // 呼吸ドライブ
    public var sedation: Double          // 0 = 覚醒, 1 = 深鎮静
    public var driveGain: Double
    public var maxInspiratoryPressure: Double   // 出せる Pmus の上限 (cmH2O)
    public var co2Setpoint: Double              // 慢性 CO2 貯留例では 55 など

    public var volumeDepleted: Bool = false
    public var prone: Bool = false
    public var goals: Goals

    /// 小児では身長からの予測体重ではなく実体重を使う。
    /// 成長期は身長と体重が一緒に動くので、体重がそのまま肺の大きさの目安になる。
    public var predictedBodyWeight: Double { weightKg }

    public var norms: AgeNorms { Physiology.norms(for: self) }

    /// 時定数 τ = R × C（呼気側）。3τ が呼気に必要な時間の目安になる。
    public var expiratoryTimeConstant: Double { resistanceExp * compliance }
}
