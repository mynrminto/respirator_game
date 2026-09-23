import SwiftUI
import VentilatorCore

/// 設定項目の定義。モードごとに出す項目が変わるのを、この 1 か所で決める。
/// 見出し（label）と単位は Web 版 app.js の P[].k / P[].u とまったく同じにする。
/// レッスンの指示文やセリフの差し込み（{FiO₂} など）がこの見出しで書かれているため。
struct VentilatorParameter: Identifiable {
    let id: String
    let label: String
    let unit: String
    var range: ClosedRange<Double>
    var step: Double
    var digits: Int
    let modes: Set<VentilationMode>?          // nil はすべてのモードで表示
    let read: (VentilatorSettings) -> Double
    let write: (inout VentilatorSettings, Double) -> Void
    /// 呼吸器の設定ではなく、シミュレーター側の操作（鎮静）。値は engine が持つ。
    var isSimulatorControl = false

    static let all: [VentilatorParameter] = [
        .init(id: "vt", label: "Vt", unit: "mL", range: 100...900, step: 10, digits: 0,
              modes: [.volumeAssistControl, .simvVolume],
              read: { $0.tidalVolume }, write: { $0.tidalVolume = $1 }),
        .init(id: "rr", label: "RR", unit: "/min", range: 4...40, step: 1, digits: 0,
              modes: [.volumeAssistControl, .pressureAssistControl, .simvVolume],
              read: { $0.respiratoryRate }, write: { $0.respiratoryRate = $1 }),
        .init(id: "pinsp", label: "P insp", unit: "cmH₂O", range: 5...40, step: 1, digits: 0,
              modes: [.pressureAssistControl],
              read: { $0.inspiratoryPressure }, write: { $0.inspiratoryPressure = $1 }),
        .init(id: "ti", label: "Ti", unit: "s", range: 0.4...2.5, step: 0.1, digits: 1,
              modes: [.pressureAssistControl],
              read: { $0.inspiratoryTime }, write: { $0.inspiratoryTime = $1 }),
        .init(id: "flow", label: "吸気流量", unit: "L/min", range: 20...100, step: 5, digits: 0,
              modes: [.volumeAssistControl, .simvVolume],
              read: { $0.inspiratoryFlow }, write: { $0.inspiratoryFlow = $1 }),
        .init(id: "ps", label: "PS", unit: "cmH₂O", range: 0...25, step: 1, digits: 0,
              modes: [.simvVolume, .pressureSupport],
              read: { $0.pressureSupport }, write: { $0.pressureSupport = $1 }),
        .init(id: "peep", label: "PEEP", unit: "cmH₂O", range: 0...24, step: 1, digits: 0,
              modes: nil, read: { $0.peep }, write: { $0.peep = $1 }),
        // Web 版と同じく 1% 刻み。ダイヤルを速く回すか ＋／− の長押しで大きく動かせる。
        .init(id: "fio2", label: "FiO₂", unit: "%", range: 21...100, step: 1, digits: 0,
              modes: nil,
              read: { ($0.fio2 * 100).rounded() }, write: { $0.fio2 = $1 / 100 }),
        .init(id: "pause", label: "吸気ポーズ", unit: "s", range: 0...0.8, step: 0.1, digits: 1,
              modes: [.volumeAssistControl],
              read: { $0.inspiratoryPause }, write: { $0.inspiratoryPause = $1 }),
        .init(id: "trig", label: "トリガ", unit: "L/min", range: 0.5...8, step: 0.5, digits: 1,
              modes: nil, read: { $0.triggerFlow }, write: { $0.triggerFlow = $1 }),
        // 呼気に移る流量のしきい値。低くすると吸気が延びるので、PSV の非同調の原因になる。
        .init(id: "esens", label: "呼気感度", unit: "%", range: 10...60, step: 5, digits: 0,
              modes: [.pressureSupport],
              read: { $0.expiratoryTriggerFraction * 100 },
              write: { $0.expiratoryTriggerFraction = $1 / 100 }),
        // 目標圧まで立ち上がる時間。速すぎるとオーバーシュート、遅すぎると吸気努力が残る。
        .init(id: "rise", label: "立上り", unit: "s", range: 0.05...0.4, step: 0.05, digits: 2,
              modes: [.pressureAssistControl, .pressureSupport],
              read: { $0.riseTime }, write: { $0.riseTime = $1 })
    ]

    /// 鎮静。Web 版の P.sed と同じく、ほかのキーと同じようにダイヤルで決める（0〜100 %）。
    /// 呼吸器の設定ではないので read / write は使わず、SimulationController が engine.sedation を読み書きする。
    static let sedation = VentilatorParameter(
        id: "sed", label: "鎮静", unit: "%", range: 0...100, step: 5, digits: 0,
        modes: nil, read: { _ in 0 }, write: { _, _ in }, isSimulatorControl: true)

    /// モードごとのキーの並び。Web 版 app.js の KEYS_BY_MODE と同じ順（鎮静は画面側で最後に足す）。
    static func order(for mode: VentilationMode) -> [String] {
        switch mode {
        case .volumeAssistControl:   return ["vt", "rr", "peep", "fio2", "flow", "pause", "trig"]
        case .pressureAssistControl: return ["pinsp", "rr", "peep", "fio2", "ti", "rise", "trig"]
        case .simvVolume:            return ["vt", "rr", "peep", "fio2", "flow", "ps", "trig"]
        case .pressureSupport:       return ["ps", "peep", "fio2", "trig", "esens", "rise"]
        case .cpap:                  return ["peep", "fio2", "trig"]
        }
    }

    static func applicable(to mode: VentilationMode) -> [VentilatorParameter] {
        order(for: mode).compactMap { id in all.first { $0.id == id } }
    }

    /// つまみの可動域は体重で 2 桁変わる（早産児の Vt は 5 mL、学童は 250 mL）。
    /// 症例の DialLimits で数値だけ差し替える。
    static func applicable(to mode: VentilationMode, limits: DialLimits) -> [VentilatorParameter] {
        applicable(to: mode).map { $0.fitted(to: limits) }
    }

    /// 全項目を症例の可動域に合わせたもの。`all` の定義値は成人向けの仮の数字なので、
    /// 実際にダイヤルを回すところは必ずこちらを通す（Web 版 app.js の applyLimits と同じ）。
    static func fitted(to limits: DialLimits) -> [VentilatorParameter] {
        all.map { $0.fitted(to: limits) }
    }

    func fitted(to limits: DialLimits) -> VentilatorParameter {
        var p = self
        let r: DialRange?
        switch p.id {
        case "vt":      r = limits.tidalVolume
        case "rr":      r = limits.respiratoryRate
        case "ti":      r = limits.inspiratoryTime
        case "flow":    r = limits.inspiratoryFlow
        case "pause":   r = limits.inspiratoryPause
        case "trig":    r = limits.trigger
        case "pinsp":   r = limits.inspiratoryPressure
        case "ps":      r = limits.pressureSupport
        default:        r = nil
        }
        if let r {
            p.range = r.min...r.max
            p.step = r.step
            p.digits = r.decimals
        }
        return p
    }
}

struct ParameterStepper: View {
    let parameter: VentilatorParameter
    @Binding var settings: VentilatorSettings
    var onChange: (String) -> Void

    var body: some View {
        let value = parameter.read(settings)
        VStack(alignment: .leading, spacing: 2) {
            Text(parameter.label).font(.caption).foregroundStyle(.secondary)
            HStack {
                Button { bump(-1) } label: { Image(systemName: "minus") }
                    .accessibilityLabel("\(parameter.label)を下げる")
                Spacer()
                Text(value.formatted(.number.precision(.fractionLength(parameter.digits))))
                    .font(.system(size: 22, weight: .semibold))
                    .monospacedDigit()
                Text(parameter.unit).font(.caption2).foregroundStyle(.secondary)
                Spacer()
                Button { bump(1) } label: { Image(systemName: "plus") }
                    .accessibilityLabel("\(parameter.label)を上げる")
            }
            .buttonStyle(.bordered)
            // 長押しで送り続ける（FiO₂ は 1% 刻みなので、1 回ずつでは遠い）。
            .buttonRepeatBehavior(.enabled)
        }
        .padding(8)
        .background(RoundedRectangle(cornerRadius: 10).fill(Color.white.opacity(0.05)))
    }

    private func bump(_ direction: Double) {
        let current = parameter.read(settings)
        let stepped = ((current + direction * parameter.step) / parameter.step).rounded() * parameter.step
        let clamped = min(max(stepped, parameter.range.lowerBound), parameter.range.upperBound)
        parameter.write(&settings, clamped)
        onChange("\(parameter.label) を \(clamped.formatted(.number.precision(.fractionLength(parameter.digits)))) \(parameter.unit) に変更")
    }
}

extension VentilationMode {
    /// 画面に出すモード名。Web 版 app.js の MODES[].label と同じ。
    /// レッスンの指示文がこの名前で書かれているので、機器のタブもこれにそろえる。
    /// （rawValue はレッスンの spot 指定 "mode:…" の照合にだけ使う）
    var uiLabel: String {
        switch self {
        case .volumeAssistControl:   return "VC-AC"
        case .pressureAssistControl: return "PC-AC"
        case .simvVolume:            return "SIMV"
        case .pressureSupport:       return "PSV"
        case .cpap:                  return "CPAP"
        }
    }

    /// A/C（補助調節）モードか。計測値の RR tot に「トリガ n」を出すか「自発 n」を出すかを分ける。
    var isAssistControl: Bool { self == .volumeAssistControl || self == .pressureAssistControl }
}

extension String {
    /// Core の文字列（"FiO2" "cmH2O" など）を、画面の表記（FiO₂・cmH₂O）にそろえる。
    var subscripted: String {
        var s = self
        for (plain, pretty) in [("FiO2", "FiO₂"), ("SpO2", "SpO₂"), ("SaO2", "SaO₂"),
                                ("PaO2", "PaO₂"), ("PaCO2", "PaCO₂"), ("PAO2", "PAO₂"),
                                ("etCO2", "etCO₂"), ("cmH2O", "cmH₂O"), ("HCO3", "HCO₃"),
                                ("CO2", "CO₂")] {
            s = s.replacingOccurrences(of: plain, with: pretty)
        }
        return s
    }
}
