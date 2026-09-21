import SwiftUI
import VentilatorCore

/// 血液ガスの結果。目標域は症例ごとに違うので、症例側が持つ範囲と突き合わせて色を変える。
struct BloodGasSheet: View {
    let gas: BloodGas
    let goals: Patient.Goals
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section {
                    row("pH", gas.pH, digits: 2, range: goals.pH)
                    row("PaCO₂", gas.paco2, unit: "mmHg", digits: 0, range: goals.paco2)
                    row("PaO₂", gas.pao2, unit: "mmHg", digits: 0, range: goals.pao2)
                    row("HCO₃⁻", gas.hco3, unit: "mEq/L", digits: 1)
                    row("BE", gas.baseExcess, unit: "mEq/L", digits: 1)
                    row("SaO₂", gas.sao2, unit: "%", digits: 1)
                    row("乳酸", gas.lactate, unit: "mmol/L", digits: 1)
                    row("P/F 比", gas.pfRatio, digits: 0)
                } header: {
                    Text("FiO₂ \(Int(gas.fio2 * 100))%　PEEP \(Int(gas.peep)) cmH₂O")
                }
                Section("読み") { Text(interpretation).font(.callout) }
            }
            .navigationTitle("動脈血液ガス")
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("閉じる") { dismiss() } } }
        }
    }

    private func row(_ label: String, _ value: Double, unit: String = "",
                     digits: Int, range: ClosedRange<Double>? = nil) -> some View {
        HStack {
            Text(label)
            Spacer()
            Text(value.formatted(.number.precision(.fractionLength(digits))))
                .font(.system(size: 18, weight: .semibold)).monospacedDigit()
                .foregroundStyle(range.map { $0.contains(value) ? Color.green : Color.red } ?? .primary)
            if !unit.isEmpty { Text(unit).font(.caption).foregroundStyle(.secondary) }
        }
        .accessibilityElement(children: .combine)
    }

    private var interpretation: String {
        var parts: [String] = []
        let acidotic = gas.pH < 7.35, alkalotic = gas.pH > 7.45
        if acidotic && gas.paco2 > 45 { parts.append("呼吸性アシドーシス") }
        if acidotic && gas.hco3 < 22 { parts.append("代謝性アシドーシス") }
        if alkalotic && gas.paco2 < 35 { parts.append("呼吸性アルカローシス") }
        if alkalotic && gas.hco3 > 26 { parts.append("代謝性アルカローシス") }
        if !acidotic && !alkalotic && gas.paco2 > 45 { parts.append("代償された高 CO₂ 血症") }
        if parts.isEmpty { parts.append("酸塩基はほぼ正常") }
        switch gas.pfRatio {
        case ..<100: parts.append("重度の酸素化障害（P/F < 100）")
        case ..<200: parts.append("中等度の酸素化障害（P/F < 200）")
        case ..<300: parts.append("軽度の酸素化障害（P/F < 300）")
        default: parts.append("酸素化は保たれている")
        }
        return parts.joined(separator: " ／ ")
    }
}

/// 離脱の評価と SBT。
struct WeaningSheet: View {
    let controller: SimulationController
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                if let result = controller.extubation {
                    Section("抜管の結果") {
                        Text(result.succeeded
                             ? "抜管後も呼吸回数と酸素化は安定しています。酸素投与を続けながら経過を見ます。"
                             : "抜管後まもなく呼吸努力が強まり、酸素化が悪化しました。再挿管が必要です。")
                            .font(.callout)
                        LabeledContent("離脱条件", value: "\(result.metCriteria) / \(result.totalCriteria) 項目")
                        LabeledContent("SBT", value: result.passedSBT ? "完遂" : "未実施または失敗")
                    }
                } else if let elapsed = controller.sbtElapsed, !controller.sbtFinished {
                    Section("SBT 実施中") {
                        LabeledContent("経過", value: "\(Int(elapsed / 60)) 分 / 目標 30 分")
                        LabeledContent("RSBI", value: controller.engine.measured.rsbi
                            .map { $0.formatted(.number.precision(.fractionLength(0))) } ?? "—")
                        LabeledContent("呼吸数", value: "\(Int(controller.engine.measured.respiratoryRateTotal)) /分")
                        LabeledContent("呼吸筋疲労", value: "\(Int(controller.engine.fatigue * 100))%")
                        if let reason = controller.sbtFailureReason {
                            Text("SBT 失敗の所見：\(reason)").foregroundStyle(.red)
                        }
                    }
                    Section {
                        Button("SBT を中止して人工呼吸器に戻す", role: .destructive) {
                            controller.endSBT(); dismiss()
                        }
                    }
                } else {
                    Section("離脱の前提条件") {
                        ForEach(Weaning.readiness(for: controller.engine)) { criterion in
                            HStack {
                                Image(systemName: criterion.met ? "checkmark.circle.fill" : "xmark.circle.fill")
                                    .foregroundStyle(criterion.met ? .green : .red)
                                Text(criterion.label)
                                Spacer()
                                Text(criterion.value).foregroundStyle(.secondary).monospacedDigit()
                            }
                            .accessibilityElement(children: .combine)
                        }
                    }
                    Section {
                        Button("SBT を開始（PS 5 / PEEP 5）") {
                            controller.beginSBT(mode: .pressureSupport); dismiss()
                        }
                        Button("SBT を開始（CPAP のみ）") {
                            controller.beginSBT(mode: .cpap); dismiss()
                        }
                    }
                    if controller.sbtFinished {
                        Section("SBT の結果") {
                            Text(controller.sbtPassed
                                 ? "30 分の自発呼吸トライアルを完遂しました。抜管を検討できます。"
                                 : "SBT は中止になりました。理由：\(controller.sbtFailureReason ?? "―")")
                                .font(.callout)
                            if controller.sbtPassed {
                                Button("抜管する") { controller.extubate(); dismiss() }
                            }
                        }
                    }
                }
            }
            .navigationTitle("離脱")
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("閉じる") { dismiss() } } }
        }
    }
}
