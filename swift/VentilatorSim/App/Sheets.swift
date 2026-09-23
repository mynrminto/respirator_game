import SwiftUI
import VentilatorCore

/// 血液ガスの結果。各値に年齢相応の基準範囲を添え、外れていれば色を付ける。
/// 症例の目標域（goals）からも外れていれば赤、基準範囲だけを外れていれば橙。
///
/// 学習コースの途中では「読み」を出さない。読むのは学習者の仕事で、答えを先に見せると
/// いぶき先生のクイズが意味をなさなくなる。
struct BloodGasSheet: View {
    let gas: BloodGas
    let goals: Patient.Goals
    let norms: AgeNorms
    let ageLabel: String
    var inLesson: Bool = false
    /// 採血時点の平均血圧・プラトー圧・auto-PEEP。読みの助言に使う。
    var meanArterialPressure: Double = .nan
    var plateau: Double? = nil
    var autoPEEP: Double = 0
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section {
                    row("pH", gas.pH, digits: 2, reference: norms.abgPH, goal: goals.pH)
                    row("PaCO₂", gas.paco2, unit: "mmHg", digits: 0,
                        reference: norms.abgPaco2, goal: goals.paco2)
                    row("PaO₂", gas.pao2, unit: "mmHg", digits: 0,
                        reference: norms.abgPao2, goal: goals.pao2)
                    row("HCO₃⁻", gas.hco3, unit: "mEq/L", digits: 1, reference: norms.abgHco3)
                    row("BE", gas.baseExcess, unit: "mEq/L", digits: 1, reference: -2...2)
                    row("SaO₂", gas.sao2, unit: "%", digits: 1, reference: norms.spo2Target)
                    row("乳酸", gas.lactate, unit: "mmol/L", digits: 1, reference: 0...2)
                    row("P/F 比", gas.pfRatio, digits: 0, reference: 300...10_000, referenceText: "≥ 300")
                } header: {
                    Text("FiO₂ \(Int((gas.fio2 * 100).rounded()))%　PEEP \(Int(gas.peep.rounded())) cmH₂O")
                } footer: {
                    Text("右の小さな数字は \(ageLabel) の基準範囲。橙は基準外、赤はこの症例の目標域からも外れています。")
                }
                if inLesson {
                    Section {
                        Text("読みは自分で考えてみてください。答え合わせは、いぶき先生の課題で行います。")
                            .font(.callout).foregroundStyle(.secondary)
                    }
                } else {
                    Section("読み") {
                        ForEach(Array(interpretation.enumerated()), id: \.offset) { _, line in
                            Text(line).font(.callout)
                        }
                    }
                }
            }
            .navigationTitle("動脈血液ガス（\(ageLabel)）")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("閉じる") { dismiss() } } }
        }
    }

    private func rangeText(_ range: ClosedRange<Double>, digits: Int) -> String {
        let f: (Double) -> String = { $0.formatted(.number.precision(.fractionLength(digits))) }
        return "\(f(range.lowerBound))–\(f(range.upperBound))"
    }

    private func row(_ label: String, _ value: Double, unit: String = "", digits: Int,
                     reference: ClosedRange<Double>, goal: ClosedRange<Double>? = nil,
                     referenceText: String? = nil) -> some View {
        let outsideReference = !reference.contains(value)
        let outsideGoal = goal.map { !$0.contains(value) } ?? outsideReference
        let color: Color = outsideGoal ? .red : (outsideReference ? .orange : .green)
        let refDigits = label == "pH" ? 2 : (digits == 0 ? 0 : 1)
        return HStack(alignment: .firstTextBaseline) {
            Text(label)
            Spacer()
            VStack(alignment: .trailing, spacing: 0) {
                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    Text(value.formatted(.number.precision(.fractionLength(digits))))
                        .font(.title3.weight(.semibold)).monospacedDigit()
                        .foregroundStyle(color)
                    if !unit.isEmpty { Text(unit).font(.caption).foregroundStyle(.secondary) }
                }
                Text(referenceText ?? rangeText(reference, digits: refDigits))
                    .font(.caption2).foregroundStyle(.secondary).monospacedDigit()
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityValue(outsideGoal ? "目標外" : (outsideReference ? "基準外" : "基準内"))
    }

    /// Web 版 interpret と同じ順で、酸塩基 → 酸素化 → 肺保護の順に一言ずつ。
    private var interpretation: [String] {
        var lines: [String] = []
        let ph = norms.abgPH, co2 = norms.abgPaco2, bicarbonate = norms.abgHco3
        let hypercapnic = gas.paco2 > co2.upperBound
        if hypercapnic && gas.pH < ph.lowerBound && gas.pH < 7.25 {
            lines.append("呼吸性アシドーシス。換気量が足りていません。分時換気量（Vt または RR）を上げることを検討します。ただし auto-PEEP と Pplat に注意。")
        } else if hypercapnic {
            // pH が 7.25 以上なら、わざと高 CO₂ を許している（permissive hypercapnia）ことが多い。
            lines.append((gas.pH < ph.lowerBound ? "呼吸性アシドーシスですが、pH は 7.25 以上に保たれています。"
                                                 : "PaCO₂ は高めですが、pH は保たれています。")
                         + "肺保護のために高 CO₂ を許容している可能性もあります。Pplat と ΔP に余裕がなければ、換気量を増やさずこのまま見ます。")
        } else if gas.pH > ph.upperBound && gas.paco2 < co2.lowerBound {
            lines.append("呼吸性アルカローシス。過換気です。RR か Vt を下げます。")
        } else if gas.pH < ph.lowerBound && gas.hco3 < bicarbonate.lowerBound {
            lines.append("代謝性アシドーシス。原因（循環不全・敗血症・腎不全など）の検索が要ります。呼吸での代償を妨げない設定に。")
        } else {
            lines.append("酸塩基は概ね目標域です。")
        }

        let hypotensive = meanArterialPressure.isFinite && meanArterialPressure < norms.meanArterialPressureMin
        if gas.pfRatio < 150 {
            if hypotensive {
                lines.append("P/F 比 \(Int(gas.pfRatio.rounded()))。酸素化は悪いものの、平均血圧が下限（\(Int(norms.meanArterialPressureMin)) mmHg）を下回っています。PEEP を上げると静脈還流が減って血圧がさらに下がるので、先に循環を立て直し、当座は FiO₂ でしのぎます。")
            } else {
                lines.append("P/F 比 \(Int(gas.pfRatio.rounded()))。酸素化が悪く、PEEP を上げてリクルートメントを図る場面です。")
            }
        } else if gas.fio2 > 0.5 && gas.pao2 > norms.abgPao2.upperBound {
            lines.append("PaO₂ に余裕があります。FiO₂ を下げて酸素毒性（未熟児網膜症や気管支肺異形成の一因）を避けます。")
        }
        if let plateau, plateau > norms.plateauMax {
            lines.append("Pplat \(Int(plateau.rounded())) cmH₂O。この年齢の目安 \(Int(norms.plateauMax)) を超えています。Vt を減らすか PEEP を見直してください。")
        }
        if autoPEEP > 3 {
            lines.append(String(format: "auto-PEEP %.1f cmH₂O。呼気時間が不足しています。RR を下げるか吸気時間を短くします。", autoPEEP))
        }
        return lines
    }
}

/// SBT のときの PS。Web 版 startSBT と同じく、細いチューブほど抵抗ぶんを多めに足す。
private func sbtPressureSupport(_ pbw: Double) -> Int { pbw < 10 ? 8 : (pbw < 25 ? 6 : 5) }

/// 抜管の結果。離脱の画面と SBT の結果画面の両方から出す。
struct ExtubationResultSection: View {
    let result: SimulationController.ExtubationResult

    var body: some View {
        Section(result.succeeded ? "抜管：成功" : "抜管：再挿管") {
            Text(result.succeeded
                 ? "抜管後も呼吸回数と酸素化は安定しています。酸素投与を続けながら経過を見ます。"
                 : "抜管後まもなく呼吸努力が強まり、酸素化が悪化しました。再挿管が必要です。")
                .font(.callout)
            if !result.succeeded {
                Text(result.passedSBT
                     ? "離脱条件のうち \(result.totalCriteria - result.metCriteria) 項目が未達のままでした。"
                     : "SBT を通していませんでした。")
                    .font(.callout).foregroundStyle(.red)
            }
            LabeledContent("離脱条件", value: "\(result.metCriteria) / \(result.totalCriteria) 項目")
            LabeledContent("SBT", value: result.passedSBT ? "完遂" : "未実施または失敗")
        }
    }
}

/// 離脱の評価と SBT。Web 版 openWeaning と同じ流れ：条件の一覧 → SBT の開始／中止 → 抜管。
struct WeaningSheet: View {
    let controller: SimulationController
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        let _ = controller.tickCount           // 条件と SBT の経過を 5 Hz で追う
        let criteria = Weaning.readiness(for: controller.engine)
        let unmet = criteria.filter { !$0.met }.count
        NavigationStack {
            List {
                if let result = controller.extubation {
                    ExtubationResultSection(result: result)
                } else {
                    Section {
                        ForEach(criteria) { criterion in
                            HStack {
                                // 満たしていなければ ×。値（「乏しい」など）と印が食い違わないよう、印は met だけで決める。
                                Image(systemName: criterion.met ? "checkmark.circle.fill" : "xmark.circle.fill")
                                    .foregroundStyle(criterion.met ? Color.green : Color.red)
                                Text(criterion.label.subscripted)
                                Spacer()
                                Text(criterion.value.subscripted)
                                    .foregroundStyle(criterion.met ? Color.secondary : Color.red)
                                    .monospacedDigit()
                            }
                            .accessibilityElement(children: .combine)
                            .accessibilityValue(criterion.met ? "満たしている" : "満たしていない")
                        }
                    } header: {
                        Text("離脱の前提条件")
                    } footer: {
                        Text(unmet == 0
                             ? "条件は揃っています。SBT（自発呼吸トライアル）で、実際に 30 分耐えられるかを確かめます。"
                             : "\(unmet) 項目が未達です。このまま行うと失敗しやすくなります（学習のため実施は可能）。")
                    }

                    if controller.isSBTRunning, let elapsed = controller.sbtElapsed {
                        Section("SBT 実施中") {
                            LabeledContent("経過", value: "\(Int(elapsed / 60)) 分 / 30 分")
                            LabeledContent("f/VT（<8 が目安）", value: controller.engine.measured.rsbiPerKg
                                .map { $0.formatted(.number.precision(.fractionLength(1))) } ?? "—")
                            LabeledContent("呼吸回数", value: "\(Int(controller.engine.measured.respiratoryRateTotal.rounded())) /分")
                            LabeledContent("呼吸筋疲労", value: "\(Int(controller.engine.fatigue * 100))%")
                        }
                        Section {
                            Button("SBT を中止して元の設定に戻す", role: .destructive) {
                                controller.endSBT(); dismiss()
                            }
                        }
                    } else {
                        Section {
                            Button("SBT を開始（30分）") {
                                controller.beginSBT(); dismiss()
                            }
                        } footer: {
                            Text("PSV・PS \(sbtPressureSupport(controller.engine.patient.predictedBodyWeight)) cmH₂O・PEEP 5 以下・FiO₂ 40% 以下に切り替え、鎮静を浅くします。中止基準に 1 分当てはまり続けたら失敗とし、設定を元に戻します。")
                        }
                    }

                    if controller.sbtFinished {
                        Section("SBT の結果") {
                            Text(controller.sbtPassed
                                 ? "30 分の自発呼吸トライアルを完遂しました。抜管を検討できます。"
                                 : "SBT は中止になりました。理由：\(controller.sbtFailureReason ?? "―")")
                                .font(.callout)
                            if controller.sbtPassed {
                                Button("抜管する") { controller.extubate() }
                            }
                        }
                    }
                }
            }
            .navigationTitle("離脱")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("閉じる") { dismiss() } } }
        }
    }
}

/// SBT が終わったときの結果（Web 版 openSBTResult）。
/// 学習コースの途中では「抜管する」を出さない。レッスン 6-3 は SBT のあとにクイズを挟み、
/// そのあとで「離脱」キーの画面から抜管させる流れなので、ここで抜けると課題の順番が崩れる。
struct SBTResultSheet: View {
    let controller: SimulationController
    let outcome: SimulationController.SBTOutcome
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                if let result = controller.extubation {
                    ExtubationResultSection(result: result)
                    Section { Button("閉じる") { dismiss() } }
                } else if outcome.passed {
                    Section {
                        Text("30 分の自発呼吸トライアルを、呼吸回数・酸素化・循環を保ったまま完遂しました。抜管を検討できます。")
                            .font(.callout)
                        LabeledContent("f/VT", value: outcome.rsbiPerKg
                            .map { $0.formatted(.number.precision(.fractionLength(1))) } ?? "––")
                        LabeledContent("呼吸回数", value: "\(Int(outcome.respiratoryRate.rounded())) /分")
                    }
                    if controller.lesson == nil {
                        Section {
                            Button("抜管する") { controller.extubate() }
                            Button("もう少し様子を見る") { dismiss() }
                        }
                    } else {
                        Section {
                            Button("課題に戻る") { dismiss() }
                        } footer: {
                            Text("抜管は、いぶき先生の課題が進んでから「離脱」キーの画面で行います。")
                        }
                    }
                } else {
                    Section {
                        Text("SBT を中断しました。設定は元に戻しています。").font(.callout)
                        Text("中断の理由：\(outcome.reason ?? "―")")
                            .font(.callout).foregroundStyle(.red)
                    } footer: {
                        Text("失敗の多くは呼吸筋疲労・循環負荷・酸塩基の異常が背景にあります。原因を直してから再挑戦してください。")
                    }
                    Section { Button("換気に戻る") { dismiss() } }
                }
            }
            .navigationTitle(controller.extubation != nil ? "抜管" : (outcome.passed ? "SBT 成功" : "SBT 失敗"))
            .navigationBarTitleDisplayMode(.inline)
        }
        .presentationDetents([.medium, .large])
    }
}
