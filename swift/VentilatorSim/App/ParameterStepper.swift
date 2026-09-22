import SwiftUI
import VentilatorCore

/// 設定項目の定義。モードごとに出す項目が変わるのを、この 1 か所で決める。
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

    static let all: [VentilatorParameter] = [
        .init(id: "vt", label: "一回換気量", unit: "mL", range: 100...900, step: 10, digits: 0,
              modes: [.volumeAssistControl, .simvVolume],
              read: { $0.tidalVolume }, write: { $0.tidalVolume = $1 }),
        .init(id: "rr", label: "換気回数", unit: "/分", range: 4...40, step: 1, digits: 0,
              modes: [.volumeAssistControl, .pressureAssistControl, .simvVolume],
              read: { $0.respiratoryRate }, write: { $0.respiratoryRate = $1 }),
        .init(id: "pinsp", label: "吸気圧", unit: "cmH₂O", range: 5...40, step: 1, digits: 0,
              modes: [.pressureAssistControl],
              read: { $0.inspiratoryPressure }, write: { $0.inspiratoryPressure = $1 }),
        .init(id: "ti", label: "吸気時間", unit: "秒", range: 0.4...2.5, step: 0.1, digits: 1,
              modes: [.pressureAssistControl],
              read: { $0.inspiratoryTime }, write: { $0.inspiratoryTime = $1 }),
        .init(id: "flow", label: "吸気流量", unit: "L/分", range: 20...100, step: 5, digits: 0,
              modes: [.volumeAssistControl, .simvVolume],
              read: { $0.inspiratoryFlow }, write: { $0.inspiratoryFlow = $1 }),
        .init(id: "ps", label: "サポート圧", unit: "cmH₂O", range: 0...25, step: 1, digits: 0,
              modes: [.simvVolume, .pressureSupport],
              read: { $0.pressureSupport }, write: { $0.pressureSupport = $1 }),
        .init(id: "peep", label: "PEEP", unit: "cmH₂O", range: 0...24, step: 1, digits: 0,
              modes: nil, read: { $0.peep }, write: { $0.peep = $1 }),
        .init(id: "fio2", label: "FiO₂", unit: "%", range: 21...100, step: 5, digits: 0,
              modes: nil,
              read: { $0.fio2 * 100 }, write: { $0.fio2 = $1 / 100 }),
        .init(id: "pause", label: "吸気ポーズ", unit: "秒", range: 0...0.8, step: 0.1, digits: 1,
              modes: [.volumeAssistControl, .simvVolume],
              read: { $0.inspiratoryPause }, write: { $0.inspiratoryPause = $1 }),
        .init(id: "trig", label: "トリガ感度", unit: "L/分", range: 0.5...8, step: 0.5, digits: 1,
              modes: nil, read: { $0.triggerFlow }, write: { $0.triggerFlow = $1 })
    ]

    static func applicable(to mode: VentilationMode) -> [VentilatorParameter] {
        all.filter { $0.modes == nil || $0.modes!.contains(mode) }
    }

    /// つまみの可動域は体重で 2 桁変わる（早産児の Vt は 5 mL、学童は 250 mL）。
    /// 症例の DialLimits で数値だけ差し替える。
    static func applicable(to mode: VentilationMode, limits: DialLimits) -> [VentilatorParameter] {
        applicable(to: mode).map { p in
            var p = p
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
}

struct ParameterStepper: View {
    let parameter: VentilatorParameter
    @Binding var settings: VentilatorSettings
    var onChange: (String) -> Void

    var body: some View {
        let value = parameter.read(settings)
        VStack(alignment: .leading, spacing: 2) {
            Text(parameter.label).font(.system(size: 10.5)).foregroundStyle(.secondary)
            HStack {
                Button { bump(-1) } label: { Image(systemName: "minus") }
                    .accessibilityLabel("\(parameter.label)を下げる")
                Spacer()
                Text(value.formatted(.number.precision(.fractionLength(parameter.digits))))
                    .font(.system(size: 22, weight: .semibold))
                    .monospacedDigit()
                Text(parameter.unit).font(.system(size: 10)).foregroundStyle(.secondary)
                Spacer()
                Button { bump(1) } label: { Image(systemName: "plus") }
                    .accessibilityLabel("\(parameter.label)を上げる")
            }
            .buttonStyle(.bordered)
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
