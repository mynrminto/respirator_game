import SwiftUI
import VentilatorCore

/// 実機の筐体。上からステータス帯、画面、モードキー、設定キー、ハードキー、ダイヤル。
/// 縦スクロールはしない。画面の外側は機器の筐体として扱う。
struct VentilatorScreen: View {
    @Bindable var controller: SimulationController
    @State private var showingBloodGas: BloodGas?
    @State private var showingWeaning = false

    var body: some View {
        let _ = controller.tickCount        // 5 Hz の更新を購読する
        VStack(spacing: 0) {
            statusBar
            screenArea
                .padding(.horizontal, 6)
                .padding(.vertical, 6)
            modeAndScreenTabs
            parameterKeys
            hardKeys
            dialRow
        }
        .background(
            LinearGradient(colors: [Chrome.chassisTop, Chrome.chassis],
                           startPoint: .top, endPoint: .bottom)
        )
        .preferredColorScheme(.dark)
        .persistentSystemOverlays(.hidden)
        .onAppear { controller.start() }
        .onDisappear { controller.stop() }
        .onChange(of: controller.bloodGases.count) { _, _ in
            showingBloodGas = controller.bloodGases.last
        }
        .sheet(item: $showingBloodGas) { gas in
            BloodGasSheet(gas: gas, goals: controller.engine.patient.goals)
        }
        .sheet(isPresented: $showingWeaning) {
            WeaningSheet(controller: controller)
        }
    }

    // MARK: - ステータス帯

    private var statusBar: some View {
        HStack(spacing: 8) {
            HStack(alignment: .firstTextBaseline, spacing: 5) {
                Text("VENTA").font(.system(size: 14, weight: .bold)).kerning(2)
                    .foregroundStyle(Chrome.dim)
                Text("SIM 5000").font(.system(size: 9)).kerning(1.6)
                    .foregroundStyle(Chrome.faint)
            }
            Circle().fill(Chrome.good).frame(width: 7, height: 7)
                .shadow(color: Chrome.good, radius: 3)
                .accessibilityHidden(true)
            Text(controller.scenario.patient.name)
                .font(.system(size: 11)).foregroundStyle(Chrome.dim)
                .lineLimit(1)
            alarmBanner
            Button(action: controller.toggleAlarmSilence) {
                Text(controller.isAlarmSilenced ? "消音中" : "消音 2分")
                    .font(.system(size: 11))
                    .foregroundStyle(controller.isAlarmSilenced ? Chrome.warning : Chrome.dim)
                    .padding(.horizontal, 9).padding(.vertical, 4)
                    .background(RoundedRectangle(cornerRadius: 3)
                        .stroke(Chrome.edge, lineWidth: 1))
            }
            .buttonStyle(.plain)
            Text(controller.wallClock)
                .font(Chrome.digits(15)).foregroundStyle(Chrome.ink.opacity(0.8))
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(Chrome.chassisTop)
    }

    private var alarmBanner: some View {
        let alarms = controller.engine.alarms
        let severity = alarms.map(\.severity).max() ?? 0
        let tint: Color = severity >= 2 ? Chrome.critical : (severity == 1 ? Chrome.warning : Chrome.dim)
        return HStack(spacing: 7) {
            Circle().fill(tint.opacity(severity == 0 ? 0.25 : 1)).frame(width: 7, height: 7)
            Text(bannerText)
                .font(.system(size: 12))
                .foregroundStyle(tint)
                .lineLimit(1)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 9)
        .frame(height: 26)
        .frame(maxWidth: .infinity)
        .background(
            RoundedRectangle(cornerRadius: 3)
                .fill(severity == 0 ? Chrome.screen : tint.opacity(0.12))
                .overlay(RoundedRectangle(cornerRadius: 3).stroke(tint.opacity(0.5), lineWidth: 1))
        )
        .opacity(controller.isAlarmSilenced && severity > 0 ? 0.55 : 1)
        .accessibilityLabel("アラーム \(bannerText)")
    }

    private var bannerText: String {
        let engine = controller.engine
        if let top = engine.alarms.max(by: { $0.severity < $1.severity }) {
            let others = engine.alarms.count - 1
            return others > 0 ? "\(top.message)　＋他 \(others) 件" : top.message
        }
        if let active = engine.activeHold {
            return active == .inspiratory ? "吸気ポーズ中  Pplat を測定しています"
                                          : "呼気ポーズ中  total PEEP を測定しています"
        }
        if let awaiting = engine.awaitingHold {
            return awaiting == .inspiratory ? "吸気ポーズ待機中  次の吸気の終わりで実行します"
                                            : "呼気ポーズ待機中  次の呼気の終わりで実行します"
        }
        if let elapsed = controller.sbtElapsed {
            let left = max(0, 1800 - elapsed)
            return String(format: "SBT 実施中  残り %d:%02d", Int(left / 60), Int(left.truncatingRemainder(dividingBy: 60)))
        }
        return "換気中  \(controller.settings.mode.rawValue)"
    }

    // MARK: - 画面

    private var screenArea: some View {
        HStack(spacing: 1) {
            ZStack(alignment: .bottomLeading) {
                switch controller.screen {
                case .waveforms: scope
                case .loops: LoopView(current: controller.currentLoop,
                                      previous: controller.previousLoop)
                case .trend: TrendView(samples: controller.trend)
                }
                if controller.waveformsFrozen && controller.screen == .waveforms {
                    Text("波形停止中")
                        .font(.system(size: 11)).foregroundStyle(Chrome.pressure)
                        .padding(.horizontal, 8).padding(.vertical, 2)
                        .background(RoundedRectangle(cornerRadius: 3)
                            .stroke(Chrome.pressure.opacity(0.6), lineWidth: 1))
                        .padding(8)
                }
                if controller.speed.rawValue > 1 {
                    Text("早送り中  \(Int(controller.speed.rawValue))×")
                        .font(.system(size: 11)).foregroundStyle(Chrome.chassis)
                        .padding(.horizontal, 10).padding(.vertical, 2)
                        .background(Chrome.pressure)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.bottom, 0)
                }
            }
            valueColumn
        }
        .background(Chrome.line)
        .clipShape(RoundedRectangle(cornerRadius: 5))
    }

    private var scope: some View {
        let engine = controller.engine
        let trace = controller.trace
        let peakCeiling = max(40, (engine.measured.peakPressure + 6).rounded(.up))
        let volumeCeiling = max(400, (max(engine.measured.tidalVolumeExp,
                                          controller.settings.tidalVolume) * 1.5).rounded(.up))
        return ScopeView(
            lanes: [
                .init(label: "Paw", unit: "cmH₂O", color: Chrome.pressure,
                      samples: trace.pressure, range: -5...peakCeiling,
                      reference: controller.settings.peep),
                .init(label: "Flow", unit: "L/min", color: Chrome.flow,
                      samples: trace.flow, range: -80...80),
                .init(label: "Volume", unit: "mL", color: Chrome.volume,
                      samples: trace.volume, range: 0...volumeCeiling)
            ],
            cursor: trace.cursor,
            sampleCount: trace.capacity,
            sweepSeconds: trace.sweepSeconds)
    }

    private var valueColumn: some View {
        let engine = controller.engine
        let m = engine.measured
        let pbw = engine.patient.predictedBodyWeight
        return LazyVGrid(columns: [GridItem(.flexible(), spacing: 1),
                                   GridItem(.flexible(), spacing: 1)], spacing: 1) {
            ValueTile(caption: "PIP", value: whole(m.peakPressure), unit: "cmH₂O",
                      limit: "≤\(Int(controller.settings.alarms.peakPressure))",
                      tone: m.peakPressure > controller.settings.alarms.peakPressure ? Chrome.critical : Chrome.ink)
            ValueTile(caption: "Pplat", value: optionalWhole(m.plateauPressure), unit: "cmH₂O",
                      limit: "≤30",
                      tone: (m.plateauPressure ?? 0) > 30 ? Chrome.critical : Chrome.ink)
            ValueTile(caption: "PEEP tot", value: oneDecimal(m.totalPEEP), unit: "cmH₂O")
            ValueTile(caption: "ΔP", value: optionalWhole(m.drivingPressure), unit: "cmH₂O",
                      limit: "≤15",
                      tone: (m.drivingPressure ?? 0) > 15 ? Chrome.critical : Chrome.ink)
            ValueTile(caption: "Vte", value: whole(m.tidalVolumeExp), unit: "mL",
                      limit: String(format: "%.1f mL/kg", m.tidalVolumeExp / pbw),
                      tone: m.tidalVolumeExp / pbw > 8.5 ? Chrome.critical : Chrome.ink)
            ValueTile(caption: "MV", value: oneDecimal(m.minuteVolume), unit: "L/min")
            ValueTile(caption: "RR tot", value: whole(m.respiratoryRateTotal), unit: "/min",
                      limit: "自発 \(Int(m.respiratoryRateSpontaneous))")
            ValueTile(caption: "I:E", value: m.ieRatio, unit: "")
            ValueTile(caption: "Cstat", value: optionalWhole(m.staticCompliance), unit: "mL/cmH₂O")
            ValueTile(caption: "Raw", value: optionalWhole(m.airwayResistance), unit: "cmH₂O/L/s")
            ValueTile(caption: "auto-PEEP", value: oneDecimal(m.autoPEEP), unit: "cmH₂O",
                      tone: m.autoPEEP > 5 ? Chrome.critical : (m.autoPEEP > 2 ? Chrome.warning : Chrome.ink))
            ValueTile(caption: "RSBI", value: optionalWhole(m.rsbi), unit: "", limit: "<105",
                      tone: (m.rsbi ?? 0) > 105 ? Chrome.warning : Chrome.ink)
            ValueTile(caption: "SpO₂", value: whole(engine.spo2), unit: "%",
                      tone: engine.spo2 < 90 ? Chrome.critical
                          : (engine.spo2 < 94 ? Chrome.warning : Chrome.good))
            ValueTile(caption: "etCO₂", value: whole(engine.etco2), unit: "mmHg")
            ValueTile(caption: "HR", value: whole(engine.heartRate), unit: "/min",
                      tone: engine.heartRate > 130 ? Chrome.warning : Chrome.ink)
            ValueTile(caption: "ABP mean", value: whole(engine.meanArterialPressure), unit: "mmHg",
                      tone: engine.meanArterialPressure < 60 ? Chrome.critical
                          : (engine.meanArterialPressure < 65 ? Chrome.warning : Chrome.ink))
        }
        .frame(width: 216)
    }

    // MARK: - モードと画面の切り替え

    private var modeAndScreenTabs: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 1) {
                ForEach(VentilationMode.allCases, id: \.self) { mode in
                    tab(mode.rawValue,
                        selected: controller.settings.mode == mode,
                        tint: Chrome.flow) { controller.change(mode: mode) }
                }
                Spacer(minLength: 16)
                ForEach(SimulationController.Screen.allCases) { screen in
                    tab(screen.label,
                        selected: controller.screen == screen,
                        tint: Chrome.volume) { controller.screen = screen }
                }
            }
            .padding(.horizontal, 6)
        }
    }

    private func tab(_ title: String, selected: Bool, tint: Color,
                     action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(selected ? tint : Chrome.dim)
                .padding(.horizontal, 13).padding(.vertical, 6)
                .background(alignment: .bottom) {
                    Rectangle().fill(selected ? tint : .clear).frame(height: 2)
                }
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    // MARK: - 設定キー

    private var parameterKeys: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 4) {
                ForEach(VentilatorParameter.applicable(to: controller.settings.mode)) { parameter in
                    parameterKey(parameter)
                }
                sedationKey
            }
            .padding(.horizontal, 6).padding(.vertical, 4)
        }
    }

    private func parameterKey(_ parameter: VentilatorParameter) -> some View {
        let selected = controller.selectedParameterID == parameter.id
        let committed = parameter.read(controller.settings)
        let shown = selected ? (controller.pendingValue ?? committed) : committed
        let pending = selected && controller.hasPendingChange
        return Button { controller.select(parameterID: parameter.id) } label: {
            VStack(alignment: .leading, spacing: 1) {
                Text(parameter.label)
                    .font(.system(size: 9.5)).foregroundStyle(Chrome.dim)
                HStack(alignment: .firstTextBaseline, spacing: 2) {
                    Text(shown.formatted(.number.precision(.fractionLength(parameter.digits))))
                        .font(Chrome.digits(19))
                        .foregroundStyle(pending ? Chrome.pressure : Chrome.ink)
                    Text(parameter.unit).font(.system(size: 9)).foregroundStyle(Chrome.faint)
                }
            }
            .padding(.horizontal, 8).padding(.vertical, 5)
            .frame(minWidth: 80, alignment: .leading)
        }
        .buttonStyle(.plain)
        .background(
            RoundedRectangle(cornerRadius: 4)
                .fill(Color(red: 0.106, green: 0.125, blue: 0.153))
                .overlay(RoundedRectangle(cornerRadius: 4)
                    .stroke(selected ? Chrome.flow : Chrome.edge, lineWidth: 1))
        )
        .accessibilityLabel("\(parameter.label) \(shown.formatted()) \(parameter.unit)")
        .accessibilityHint(selected ? "ダイヤルで変更できます" : "押すとダイヤルで変更できます")
    }

    /// 鎮静は機器の設定ではないので、色を分けてシミュレーター側の操作として置く。
    private var sedationKey: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text("鎮静").font(.system(size: 9.5)).foregroundStyle(Chrome.sim)
            HStack(spacing: 6) {
                Button { controller.engine.sedation = max(0, controller.engine.sedation - 0.1) } label: {
                    Image(systemName: "minus").font(.system(size: 11))
                }
                .accessibilityLabel("鎮静を浅くする")
                Text("\(Int(controller.engine.sedation * 100))")
                    .font(Chrome.digits(19)).foregroundStyle(Chrome.ink)
                Button { controller.engine.sedation = min(1, controller.engine.sedation + 0.1) } label: {
                    Image(systemName: "plus").font(.system(size: 11))
                }
                .accessibilityLabel("鎮静を深くする")
            }
        }
        .buttonStyle(.plain)
        .foregroundStyle(Chrome.sim)
        .padding(.horizontal, 8).padding(.vertical, 5)
        .background(
            RoundedRectangle(cornerRadius: 4)
                .fill(Color(red: 0.082, green: 0.102, blue: 0.129))
                .overlay(RoundedRectangle(cornerRadius: 4).stroke(Chrome.edge, lineWidth: 1))
        )
    }

    // MARK: - ハードキー

    private var hardKeys: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 5) {
                DeviceKey(title: "吸気ポーズ",
                          isOn: holdKey == .inspiratory) { controller.requestHold(.inspiratory) }
                DeviceKey(title: "呼気ポーズ",
                          isOn: holdKey == .expiratory) { controller.requestHold(.expiratory) }
                DeviceKey(title: "波形停止", isOn: controller.waveformsFrozen) {
                    controller.waveformsFrozen.toggle()
                }
                DeviceKey(title: speedLabel, tint: Chrome.sim,
                          isOn: controller.speed.rawValue > 1) { cycleSpeed() }
                DeviceKey(title: controller.pendingBloodGasAt == nil ? "血液ガス" : "採血中…",
                          tint: Chrome.sim,
                          isOn: controller.pendingBloodGasAt != nil) { controller.orderBloodGas() }
                DeviceKey(title: "離脱", tint: Chrome.sim) { showingWeaning = true }
            }
            .padding(.horizontal, 6).padding(.vertical, 5)
        }
        .background(Chrome.chassisTop)
    }

    private var holdKey: VentilatorEngine.HoldKind? {
        controller.engine.activeHold ?? controller.engine.awaitingHold
    }

    private var speedLabel: String {
        controller.speed == .paused ? "‖" : "× \(Int(controller.speed.rawValue))"
    }

    private func cycleSpeed() {
        switch controller.speed {
        case .realtime: controller.speed = .fast
        case .fast: controller.speed = .veryFast
        default: controller.speed = .realtime
        }
    }

    // MARK: - ダイヤル

    private var dialRow: some View {
        HStack(spacing: 10) {
            Text("設定キーを押し、ダイヤルを回して「確定」で反映します。")
                .font(.system(size: 11)).foregroundStyle(Chrome.faint)
                .lineLimit(2)
            Spacer(minLength: 0)
            VStack(alignment: .trailing, spacing: 0) {
                Text(controller.selectedParameter?.label ?? "設定を選択")
                    .font(.system(size: 9.5)).foregroundStyle(Chrome.dim)
                HStack(alignment: .firstTextBaseline, spacing: 2) {
                    Text(dialValueText)
                        .font(Chrome.digits(24, weight: .bold))
                        .foregroundStyle(controller.hasPendingChange ? Chrome.pressure : Chrome.ink)
                    Text(controller.selectedParameter?.unit ?? "")
                        .font(.system(size: 9)).foregroundStyle(Chrome.faint)
                }
            }
            KnobView(fraction: dialFraction,
                     isPending: controller.hasPendingChange,
                     isEnabled: controller.selectedParameter != nil,
                     accessibilityValue: dialAccessibilityValue,
                     onStep: { controller.nudge($0) },
                     onCommit: { controller.commitPending() })
            Button { controller.commitPending() } label: {
                Text("確定")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Chrome.good)
                    .padding(.horizontal, 12).padding(.vertical, 10)
                    .background(RoundedRectangle(cornerRadius: 4)
                        .stroke(Chrome.good.opacity(0.6), lineWidth: 1))
            }
            .buttonStyle(.plain)
            .disabled(!controller.hasPendingChange)
            .opacity(controller.hasPendingChange ? 1 : 0.32)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(Chrome.chassis)
    }

    private var dialValueText: String {
        guard let parameter = controller.selectedParameter else { return "—" }
        let value = controller.pendingValue ?? parameter.read(controller.settings)
        return value.formatted(.number.precision(.fractionLength(parameter.digits)))
    }

    private var dialAccessibilityValue: String {
        guard let parameter = controller.selectedParameter else { return "未選択" }
        return "\(parameter.label) \(dialValueText) \(parameter.unit)"
    }

    private var dialFraction: Double {
        guard let parameter = controller.selectedParameter else { return 0 }
        let value = controller.pendingValue ?? parameter.read(controller.settings)
        let span = parameter.range.upperBound - parameter.range.lowerBound
        guard span > 0 else { return 0 }
        return min(max((value - parameter.range.lowerBound) / span, 0), 1)
    }

    // MARK: - 表示の小物

    private func whole(_ value: Double) -> String {
        value.isFinite ? String(Int(value.rounded())) : "––"
    }
    private func oneDecimal(_ value: Double) -> String {
        value.isFinite ? String(format: "%.1f", value) : "––"
    }
    private func optionalWhole(_ value: Double?) -> String {
        guard let value, value.isFinite else { return "––" }
        return String(Int(value.rounded()))
    }
}
