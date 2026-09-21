import SwiftUI
import VentilatorCore

/// 人工呼吸器の画面。波形・実測値・設定・手技をひとつの device screen として並べる。
struct VentilatorScreen: View {
    @Bindable var controller: SimulationController
    @State private var showingBloodGas: BloodGas?
    @State private var showingWeaning = false

    private let amber = Color(red: 0.95, green: 0.70, blue: 0.20)
    private let mint = Color(red: 0.18, green: 0.83, blue: 0.65)
    private let periwinkle = Color(red: 0.62, green: 0.71, blue: 1.0)

    var body: some View {
        let engine = controller.engine
        let _ = controller.tickCount        // 5 Hz の更新を購読する

        ScrollView {
            VStack(alignment: .leading, spacing: 10) {
                topBar
                monitorStrip
                waveforms
                measuredGrid
                modePicker
                settingsGrid
                maneuvers
                actionButtons
                Text("教育用シミュレーターです。実機の挙動とは異なり、臨床判断には使用できません。")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 32)
        }
        .background(Color(red: 0.043, green: 0.055, blue: 0.075))
        .preferredColorScheme(.dark)
        .onAppear { controller.start() }
        .onDisappear { controller.stop() }
        .onChange(of: controller.bloodGases.count) { _, _ in
            showingBloodGas = controller.bloodGases.last
        }
        .sheet(item: $showingBloodGas) { gas in
            BloodGasSheet(gas: gas, goals: engine.patient.goals)
        }
        .sheet(isPresented: $showingWeaning) {
            WeaningSheet(controller: controller)
        }
    }

    // MARK: - 部品

    private var topBar: some View {
        HStack(spacing: 10) {
            Text(controller.wallClock)
                .font(.system(size: 19, weight: .semibold))
                .monospacedDigit()
            Picker("再生速度", selection: $controller.speed) {
                ForEach(SimulationController.Speed.allCases) { speed in
                    Text(speed.label).tag(speed)
                }
            }
            .pickerStyle(.segmented)
            .frame(maxWidth: 200)
            alarmBanner
        }
        .padding(.top, 8)
    }

    private var alarmBanner: some View {
        let top = controller.engine.alarms.max { $0.severity < $1.severity }
        return Text(top?.message ?? "警報なし")
            .font(.caption)
            .foregroundStyle(top == nil ? Color.secondary
                             : (top!.severity == 2 ? Color.red : Color.orange))
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, 6).padding(.horizontal, 10)
            .background(RoundedRectangle(cornerRadius: 8).fill(Color.white.opacity(0.04)))
            .accessibilityLabel(top.map { "警報：\($0.message)" } ?? "警報なし")
    }

    private var monitorStrip: some View {
        let engine = controller.engine
        return HStack(spacing: 8) {
            monitorTile("SpO₂ %", value: engine.spo2, digits: 0,
                        color: engine.spo2 < 88 ? .red : engine.spo2 < 92 ? .orange : .cyan)
            monitorTile("心拍 /分", value: engine.heartRate, digits: 0, color: .green)
            monitorTile("平均血圧 mmHg", value: engine.meanArterialPressure, digits: 0,
                        color: engine.meanArterialPressure < 60 ? .red : .pink)
            monitorTile("EtCO₂ mmHg", value: engine.etco2, digits: 0, color: periwinkle)
        }
    }

    private func monitorTile(_ title: String, value: Double, digits: Int, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title).font(.system(size: 10.5)).foregroundStyle(.secondary)
            Text(value.formatted(.number.precision(.fractionLength(digits))))
                .font(.system(size: 28, weight: .bold))
                .monospacedDigit()
                .foregroundStyle(color)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(8)
        .background(RoundedRectangle(cornerRadius: 10).fill(Color.white.opacity(0.04)))
    }

    private var waveforms: some View {
        let engine = controller.engine
        let trace = controller.trace
        let pipCeiling = max(40, (engine.measured.peakPressure + 8).rounded(.up))
        let flowCeiling = max(60, Double(Int(max(engine.settings.inspiratoryFlow, 60) / 20) * 20 + 20))
        let volumeCeiling = max(600, (engine.measured.tidalVolumeExp * 1.5).rounded(.up))

        return VStack(spacing: 0) {
            WaveformView(samples: trace.pressure, cursor: trace.cursor,
                         range: -5...pipCeiling, color: amber,
                         caption: "気道内圧", unit: "cmH₂O")
                .frame(height: 118)
            Divider().overlay(Color.white.opacity(0.08))
            WaveformView(samples: trace.flow, cursor: trace.cursor,
                         range: -flowCeiling...flowCeiling, color: mint,
                         caption: "流量", unit: "L/分")
                .frame(height: 118)
            Divider().overlay(Color.white.opacity(0.08))
            WaveformView(samples: trace.volume, cursor: trace.cursor,
                         range: -20...volumeCeiling, color: periwinkle,
                         caption: "容量", unit: "mL")
                .frame(height: 96)
        }
        .padding(8)
        .background(RoundedRectangle(cornerRadius: 10).fill(Color.white.opacity(0.04)))
        .overlay {
            if controller.speed.rawValue > 1 {
                RoundedRectangle(cornerRadius: 10)
                    .fill(Color.black.opacity(0.75))
                    .overlay(Text("\(Int(controller.speed.rawValue))倍速で経過中").foregroundStyle(mint))
            }
        }
    }

    private var measuredGrid: some View {
        let m = controller.engine.measured
        let pbw = controller.engine.patient.predictedBodyWeight
        return LazyVGrid(columns: [GridItem(.adaptive(minimum: 104), spacing: 6)], spacing: 6) {
            valueTile("PIP", m.peakPressure, "cmH₂O", 0,
                      tone: m.peakPressure > controller.engine.settings.alarms.peakPressure ? .red : .primary)
            valueTile("Pplat", m.plateauPressure, "cmH₂O", 0,
                      tone: (m.plateauPressure ?? 0) > 30 ? .red : .green)
            valueTile("総 PEEP", m.totalPEEP, "cmH₂O", 1)
            valueTile("auto-PEEP", m.autoPEEP, "cmH₂O", 1,
                      tone: m.autoPEEP > 5 ? .red : m.autoPEEP > 2 ? .orange : .primary)
            valueTile("ΔP", m.drivingPressure, "cmH₂O", 0,
                      tone: (m.drivingPressure ?? 0) > 15 ? .red : .green)
            valueTile("平均気道内圧", m.meanAirwayPressure, "cmH₂O", 1)
            valueTile("Vte", m.tidalVolumeExp, "mL", 0)
            valueTile("Vt / PBW", m.tidalVolumeExp / pbw, "mL/kg", 1,
                      tone: m.tidalVolumeExp / pbw > 8.5 ? .red : .green)
            valueTile("分時換気量", m.minuteVolume, "L/分", 1)
            valueTile("呼吸数", m.respiratoryRateTotal, "/分", 0)
            valueTile("うち自発", m.respiratoryRateSpontaneous, "/分", 0)
            textTile("I : E", m.ieRatio)
            valueTile("Cstat", m.staticCompliance, "mL/cmH₂O", 0)
            valueTile("Raw", m.airwayResistance, "cmH₂O/L/s", 0)
            valueTile("RSBI", m.respiratoryRateSpontaneous > 0 ? m.rsbi : nil, "", 0,
                      tone: (m.rsbi ?? 0) > 105 ? .red : .green)
        }
    }

    private func valueTile(_ label: String, _ value: Double?, _ unit: String,
                           _ digits: Int, tone: Color = .primary) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(label).font(.system(size: 10.5)).foregroundStyle(.secondary)
            HStack(alignment: .firstTextBaseline, spacing: 3) {
                Text(value.map { $0.formatted(.number.precision(.fractionLength(digits))) } ?? "—")
                    .font(.system(size: 20, weight: .semibold))
                    .monospacedDigit()
                    .foregroundStyle(value == nil ? Color.secondary : tone)
                if !unit.isEmpty {
                    Text(unit).font(.system(size: 9.5)).foregroundStyle(.secondary)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 6).padding(.horizontal, 8)
        .background(RoundedRectangle(cornerRadius: 8).fill(Color.white.opacity(0.04)))
    }

    private func textTile(_ label: String, _ text: String) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(label).font(.system(size: 10.5)).foregroundStyle(.secondary)
            Text(text).font(.system(size: 20, weight: .semibold)).monospacedDigit()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 6).padding(.horizontal, 8)
        .background(RoundedRectangle(cornerRadius: 8).fill(Color.white.opacity(0.04)))
    }

    private var modePicker: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("換気モード").font(.caption).foregroundStyle(.secondary)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(VentilationMode.allCases, id: \.self) { mode in
                        Button(mode.rawValue) {
                            controller.settings.mode = mode
                            controller.append("モードを \(mode.rawValue) に変更")
                        }
                        .buttonStyle(.bordered)
                        .tint(controller.settings.mode == mode ? mint : .gray)
                    }
                }
            }
        }
    }

    private var settingsGrid: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("設定").font(.caption).foregroundStyle(.secondary)
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: 8)], spacing: 8) {
                ForEach(VentilatorParameter.applicable(to: controller.settings.mode)) { parameter in
                    ParameterStepper(parameter: parameter,
                                     settings: $controller.settings) { change in
                        controller.append(change)
                    }
                }
            }
        }
    }

    private var maneuvers: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("手技・操作").font(.caption).foregroundStyle(.secondary)
            HStack(spacing: 6) {
                Button("吸気ポーズ") {
                    controller.engine.requestHold(.inspiratory)
                    controller.append("吸気ポーズ（プラトー圧を測定）")
                }
                Button("呼気ポーズ") {
                    controller.engine.requestHold(.expiratory)
                    controller.append("呼気ポーズ（総 PEEP を測定）")
                }
                Button("鎮静を浅く") {
                    controller.engine.sedation = max(0, controller.engine.sedation - 0.2)
                    controller.append("鎮静を浅くした")
                }
            }
            .buttonStyle(.bordered)
            .font(.caption)
        }
    }

    private var actionButtons: some View {
        HStack(spacing: 8) {
            Button("動脈血液ガスを採る") { controller.orderBloodGas() }
                .buttonStyle(.borderedProminent)
                .tint(mint)
                .disabled(controller.pendingBloodGasAt != nil)
            Button("離脱を評価する") { showingWeaning = true }
                .buttonStyle(.bordered)
        }
        .padding(.top, 6)
    }
}

