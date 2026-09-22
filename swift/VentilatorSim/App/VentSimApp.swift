import SwiftUI
import VentilatorCore

@main
struct VentSimApp: App {
    var body: some Scene {
        WindowGroup { RootView() }
    }
}

struct RootView: View {
    @State private var controller: SimulationController?
    @State private var showingCourse = false
    @State private var showingCases = false

    var body: some View {
        Group {
            if let controller {
                VentilatorScreen(controller: controller)
            } else {
                TitleView(onStartLesson: { start(lesson: $0) },
                          onOpenCourse: { showingCourse = true },
                          onOpenCases: { showingCases = true })
                    .sheet(isPresented: $showingCourse) {
                        LessonCourseView { start(lesson: $0) }
                    }
                    .sheet(isPresented: $showingCases) {
                        ScenarioListView(onStart: { scenario, settings in
                            showingCases = false
                            controller = SimulationController(scenario: scenario, settings: settings)
                        })
                    }
            }
        }
        // 見た目に合わせて、標準のボタンや選択の色もそろえる。
        .tint(Chrome.accent)
    }

    private func start(lesson: Lesson) {
        showingCourse = false
        let created = SimulationController(scenario: lesson.scenario,
                                           settings: VentilatorSettings())
        created.startLesson(lesson)
        controller = created
    }
}

/// 症例を選び、予測体重から初期設定を決めるところまで。
/// タイトル画面から「症例で練習」で開く。
struct ScenarioListView: View {
    var onStart: (Scenario, VentilatorSettings) -> Void
    @State private var selected: Scenario?
    @Environment(\.dismiss) private var dismiss

    /// 症例ごとの顔色。Web 版の PATIENT_TONE と同じ。
    private func tone(_ id: String) -> PatientView.Tone {
        switch id {
        case "ards", "asthma": return .bad
        case "copd": return .mid
        default: return .ok
        }
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    ForEach(ScenarioLibrary.all) { scenario in
                        Button { selected = scenario } label: {
                            HStack(spacing: 12) {
                                CharacterBadge(size: 46, ring: Chrome.accent.opacity(0.3),
                                               background: Chrome.panel2) {
                                    PatientView(tone: tone(scenario.id))
                                }
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(scenario.tag)
                                        .font(.caption2.weight(.bold))
                                        .foregroundStyle(Chrome.isPop ? Color.white : Color.secondary)
                                        .padding(.horizontal, Chrome.isPop ? 8 : 0)
                                        .padding(.vertical, Chrome.isPop ? 2 : 0)
                                        .background { if Chrome.isPop { Capsule().fill(Chrome.accent) } }
                                    Text(scenario.title)
                                        .font(Chrome.label(16, weight: .bold))
                                    Text(scenario.oneLine)
                                        .font(.caption).foregroundStyle(.secondary)
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                            }
                            .padding(.vertical, 2)
                        }
                    }
                } footer: {
                    Text("レッスンを離れて、自由に操作できます。教育用のモデルなので、数値は実機・実患者とは異なります。")
                }
            }
            .navigationTitle("症例で練習")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("閉じる") { dismiss() } }
            }
            .sheet(item: $selected) { scenario in
                SetupView(scenario: scenario) { settings in
                    selected = nil
                    onStart(scenario, settings)
                }
            }
        }
    }
}

struct SetupView: View {
    let scenario: Scenario
    var onStart: (VentilatorSettings) -> Void
    @State private var settings = VentilatorSettings()
    @Environment(\.dismiss) private var dismiss

    private var pbw: Double { scenario.patient.predictedBodyWeight }
    private var norms: AgeNorms { scenario.patient.norms }
    private var limits: DialLimits {
        Physiology.dialLimits(weightKg: pbw, norms: norms)
    }
    private func mL(_ v: Double) -> String {
        pbw < 6 ? String(format: "%.1f", v) : String(format: "%.0f", v)
    }

    var body: some View {
        NavigationStack {
            List {
                Section("病歴") {
                    Text(scenario.history).font(.callout)
                    ForEach(scenario.findings, id: \.self) { Text($0).font(.caption) }
                }
                Section("体重と年齢の目安") {
                    LabeledContent("体重", value: String(format: "%.1f kg", pbw))
                    LabeledContent("年齢", value: scenario.patient.ageLabel)
                    Text("一回換気量 \(Int(norms.tidalPerKg.lowerBound))〜"
                         + "\(Int(norms.tidalPerKg.upperBound)) mL/kg なら "
                         + mL(pbw * norms.tidalPerKg.lowerBound) + "〜"
                         + mL(pbw * norms.tidalPerKg.upperBound) + " mL。"
                         + "この年齢の呼吸数は \(Int(norms.respiratoryRate.lowerBound))〜"
                         + "\(Int(norms.respiratoryRate.upperBound)) /分、"
                         + "プラトー圧は \(Int(norms.plateauMax)) cmH₂O 以下、"
                         + "SpO₂ 目標は \(Int(norms.spo2Target.lowerBound))〜"
                         + "\(Int(norms.spo2Target.upperBound))%。")
                        .font(.caption).foregroundStyle(.secondary)
                }
                Section("初期設定") {
                    ForEach(VentilatorParameter.applicable(to: settings.mode, limits: limits)) { parameter in
                        ParameterStepper(parameter: parameter, settings: $settings) { _ in }
                    }
                }
                Section("目安") { Text(advice).font(.caption) }
                Section {
                    Button("この設定で換気を開始") { onStart(settings) }
                    Button("推奨設定を入れる") { applySuggested() }
                }
            }
            .navigationTitle(scenario.title)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("戻る") { dismiss() } } }
            .onAppear {
                applySuggested()
            }
        }
    }

    private func applySuggested() {
        settings = scenario.initialSettings()
    }

    private var advice: String {
        let perKg = settings.tidalVolume / pbw
        let plateau = settings.peep + (settings.tidalVolume / 1000) / scenario.patient.compliance
        let ti = (settings.tidalVolume / 1000) / (settings.inspiratoryFlow / 60)
        let te = 60 / settings.respiratoryRate - ti
        let tau = scenario.patient.expiratoryTimeConstant
        var lines = [String(format: "体重あたり %.1f mL/kg。", perKg),
                     String(format: "予想プラトー圧はおよそ %.0f cmH₂O。", plateau),
                     String(format: "呼気時間 %.2f 秒に対し時定数は %.2f 秒（3τ = %.2f 秒）。", te, tau, tau * 3)]
        if te < tau * 3 { lines.append("吐ききる前に次の吸気が来ます。auto-PEEP に注意。") }
        if perKg > norms.tidalPerKg.upperBound + 1.5 {
            lines.append("この年齢の目安（\(Int(norms.tidalPerKg.lowerBound))〜"
                         + "\(Int(norms.tidalPerKg.upperBound)) mL/kg）を超えています。")
        }
        if plateau > norms.plateauMax {
            lines.append("プラトー圧がこの年齢の目安 \(Int(norms.plateauMax)) cmH₂O を超えそうです。")
        }
        return lines.joined(separator: " ")
    }
}
