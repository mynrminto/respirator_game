import Foundation

/// 呼吸生理の基本式。UI にも人工呼吸器の制御則にも依存しない純粋な計算だけを置く。
public enum Physiology {

    public static let barometric: Double = 760      // mmHg
    public static let waterVapor: Double = 47       // mmHg
    public static let respiratoryQuotient: Double = 0.8

    /// 酸素解離曲線（Severinghaus の近似式）。PO2 は mmHg、戻り値は 0...1。
    public static func saturation(po2: Double) -> Double {
        guard po2 > 0 else { return 0 }
        let s = 1 / (23_400 / (po2 * po2 * po2 + 150 * po2) + 1)
        return min(max(s, 0), 1)
    }

    /// 動脈血酸素含量 mL/dL。
    public static func oxygenContent(po2: Double, hemoglobin: Double) -> Double {
        1.34 * hemoglobin * saturation(po2: po2) + 0.003 * po2
    }

    /// 酸素含量から PO2 を逆算する（二分法）。
    public static func po2(fromContent content: Double, hemoglobin: Double) -> Double {
        var low = 0.0, high = 700.0
        for _ in 0..<60 {
            let mid = (low + high) / 2
            if oxygenContent(po2: mid, hemoglobin: hemoglobin) < content { low = mid } else { high = mid }
        }
        return (low + high) / 2
    }

    /// 飽和度（0...1）から PO2 を逆算する（二分法）。
    public static func po2(fromSaturation sat: Double) -> Double {
        guard sat > 0 else { return 0 }
        if sat >= 0.9999 { return 700 }
        var low = 0.0, high = 700.0
        for _ in 0..<60 {
            let mid = (low + high) / 2
            if saturation(po2: mid) < sat { low = mid } else { high = mid }
        }
        return (low + high) / 2
    }

    /// 肺胞気酸素分圧。
    public static func alveolarPO2(fio2: Double, paco2: Double) -> Double {
        fio2 * (barometric - waterVapor) - paco2 / respiratoryQuotient
    }

    /// Henderson-Hasselbalch。
    public static func pH(hco3: Double, paco2: Double) -> Double {
        6.1 + log10(max(2, hco3) / (0.03 * max(8, paco2)))
    }

    /// ARDSNet の予測体重 (kg)。
    public static func predictedBodyWeight(sex: Patient.Sex, heightCm: Double) -> Double {
        let base = sex == .female ? 45.5 : 50.0
        return max(25, base + 0.91 * (heightCm - 152.4))
    }

    static func clamp(_ v: Double, _ lo: Double, _ hi: Double) -> Double { min(max(v, lo), hi) }

    static func smoothstep(_ a: Double, _ b: Double, _ x: Double) -> Double {
        let t = clamp((x - a) / (b - a), 0, 1)
        return t * t * (3 - 2 * t)
    }

    /// 一次遅れ。指数積分なので刻み幅が変わっても結果が変わらない。
    static func approach(_ current: Double, toward target: Double, dt: Double, tau: Double) -> Double {
        guard tau > 0 else { return target }
        return current + (target - current) * (1 - exp(-dt / tau))
    }
}
