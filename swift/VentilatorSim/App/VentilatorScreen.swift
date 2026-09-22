import SwiftUI
import VentilatorCore

/// 実機の筐体。上からステータス帯、画面、モードキー、設定キー、ハードキー、ダイヤル。
/// 縦スクロールはしない。画面の外側は機器の筐体として扱う。
struct VentilatorScreen: View {
    @Bindable var controller: SimulationController
    @State private var showingBloodGas: BloodGas?
    @State private var showingWeaning = false
    @State private var showingCourse = false

    var body: some View {
        let _ = controller.tickCount        // 5 Hz の更新を購読する
        VStack(spacing: 0) {
            statusBar
            screenArea
                .padding(.horizontal, 6)
                .padding(.vertical, 6)
            LessonCoachView(controller: controller)
            modeAndScreenTabs
            parameterKeys
            hardKeys
            dialRow
        }
        .background(
            LinearGradient(colors: [Chrome.chassisTop, Chrome.chassis],
                           startPoint: .topLeading, endPoint: .bottomTrailing)
        )
        .overlay(alignment: .top) {
            if let message = controller.celebration {
                CelebrationView(message: message.text) {
                    controller.clearCelebration(message.id)
                }
                .id(message.id)
            }
        }
        .preferredColorScheme(Chrome.colorScheme)
        .persistentSystemOverlays(.hidden)
        .onAppear { controller.start() }
        .onDisappear { controller.stop() }
        .onChange(of: controller.bloodGases.count) { _, _ in
            showingBloodGas = controller.bloodGases.last
        }
        .sheet(item: $showingBloodGas) { gas in
            BloodGasSheet(gas: gas, goals: controller.engine.patient.goals,
                          norms: controller.engine.norms,
                          ageLabel: controller.engine.patient.ageLabel)
        }
        .sheet(isPresented: $showingWeaning) {
            WeaningSheet(controller: controller)
        }
        .sheet(isPresented: $showingCourse) {
            LessonCourseView { controller.startLesson($0) }
        }
    }

    // MARK: - ステータス帯

    private var statusBar: some View {
        HStack(spacing: 8) {
            brandMark
            Circle().fill(Chrome.good).frame(width: Chrome.isPop ? 9 : 7,
                                             height: Chrome.isPop ? 9 : 7)
                .shadow(color: Chrome.good, radius: 3)
                .accessibilityHidden(true)
            Text(controller.scenario.patient.name)
                .font(Chrome.label(11)).foregroundStyle(Chrome.dim)
                .lineLimit(1)
            alarmBanner
            ChipButton(title: controller.isAlarmSilenced ? "消音中" : "消音 2分",
                       isOn: controller.isAlarmSilenced,
                       action: controller.toggleAlarmSilence)
            ChipButton(title: Chrome.kind.label, tint: Chrome.sim) {
                ThemeStore.shared.toggle()
            }
            .accessibilityLabel("見た目を切り替える")
            Text(controller.wallClock)
                .font(Chrome.digits(15, weight: .bold)).foregroundStyle(Chrome.dim)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(Chrome.bar)
    }

    /// ポップでは機器名を明るい色で、実機風では従来どおり落ち着いた灰色で出す。
    private var brandMark: some View {
        HStack(alignment: .firstTextBaseline, spacing: 5) {
            if Chrome.isPop {
                Text("VentaSim")
                    .font(.system(size: 15, weight: .heavy, design: .rounded))
                    .foregroundStyle(
                        LinearGradient(colors: [Color(red: 1.0, green: 0.369, blue: 0.541),
                                                Color(red: 1.0, green: 0.690, blue: 0.125),
                                                Color(red: 0.071, green: 0.769, blue: 0.545),
                                                Color(red: 0.357, green: 0.486, blue: 0.980)],
                                       startPoint: .leading, endPoint: .trailing))
            } else {
                Text("VENTA").font(.system(size: 14, weight: .bold)).kerning(2)
                    .foregroundStyle(Chrome.dim)
                Text("SIM 5000").font(.system(size: 9)).kerning(1.6)
                    .foregroundStyle(Chrome.faint)
            }
        }
        .accessibilityHidden(true)
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
        .padding(.horizontal, Chrome.isPop ? 11 : 9)
        .frame(height: 28)
        .frame(maxWidth: .infinity)
        .background(
            RoundedRectangle(cornerRadius: Chrome.isPop ? 999 : 3)
                .fill(severity == 0 ? (Chrome.isPop ? Chrome.panel2 : Chrome.screen)
                                    : tint.opacity(Chrome.isPop ? 0.16 : 0.12))
                .overlay(RoundedRectangle(cornerRadius: Chrome.isPop ? 999 : 3)
                    .stroke(severity == 0 && Chrome.isPop ? Chrome.line : tint.opacity(0.5),
                            lineWidth: Chrome.isPop ? 1.5 : 1))
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
        if let result = controller.extubation {
            return result.succeeded ? "抜管済み" : "抜管後に再挿管が必要"
        }
        if let elapsed = controller.sbtElapsed, !controller.sbtFinished {
            let left = max(0, 1800 - elapsed)
            return String(format: "SBT 実施中  残り %d:%02d", Int(left / 60), Int(left.truncatingRemainder(dividingBy: 60)))
        }
        return "換気中  \(controller.settings.mode.rawValue)"
    }

    // MARK: - 画面

    private var screenArea: some View {
        HStack(spacing: Chrome.isPop ? 2 : 1) {
            ZStack(alignment: .bottomLeading) {
                switch controller.screen {
                case .waveforms: scope
                case .loops: LoopView(current: controller.currentLoop,
                                      previous: controller.previousLoop)
                case .trend: TrendView(samples: controller.trend)
                case .lung3D: LungSceneView(controller: controller)
                }
                if controller.waveformsFrozen && controller.screen == .waveforms {
                    Text("波形停止中")
                        .font(Chrome.label(11, weight: Chrome.isPop ? .bold : .regular))
                        .foregroundStyle(Chrome.isPop ? Color.black.opacity(0.75) : Chrome.pressure)
                        .padding(.horizontal, 9).padding(.vertical, 3)
                        .background(
                            Group {
                                if Chrome.isPop {
                                    Capsule().fill(Chrome.pressure)
                                } else {
                                    RoundedRectangle(cornerRadius: 3)
                                        .stroke(Chrome.pressure.opacity(0.6), lineWidth: 1)
                                }
                            }
                        )
                        .padding(8)
                }
                if controller.speed.rawValue > 1 {
                    Text("早送り中  \(Int(controller.speed.rawValue))×")
                        .font(Chrome.label(11, weight: .bold))
                        .foregroundStyle(Color.black.opacity(0.75))
                        .padding(.horizontal, 12).padding(.vertical, 3)
                        .background(Capsule().fill(Chrome.pressure))
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.bottom, 0)
                }
            }
            valueColumn
        }
        .background(Chrome.screenTileLine)
        .clipShape(RoundedRectangle(cornerRadius: Chrome.cornerLarge))
        .overlay(
            RoundedRectangle(cornerRadius: Chrome.cornerLarge)
                .stroke(Chrome.screenFrame, lineWidth: Chrome.isPop ? 3 : 1)
        )
    }

    private var scope: some View {
        let engine = controller.engine
        let trace = controller.trace
        let peakCeiling = max(40, (engine.measured.peakPressure + 6).rounded(.up))
        let volumeStep: Double = engine.patient.predictedBodyWeight < 6 ? 2
            : (engine.patient.predictedBodyWeight < 20 ? 20 : 100)
        let volumeCeiling = max(volumeStep * 2, (max(engine.measured.tidalVolumeExp,
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
            .spotlight(controller.isSpotted("wave"), corner: Chrome.corner)
    }

    private var valueColumn: some View {
        let engine = controller.engine
        return LazyVGrid(columns: [GridItem(.flexible(), spacing: 1),
                                   GridItem(.flexible(), spacing: 1)], spacing: 1) {
            ForEach(Readout.all) { r in
                ValueTile(caption: r.caption, value: r.value(engine), unit: r.unit,
                          limit: r.limit?(engine), tone: r.tone?(engine))
                    .spotlight(controller.isSpotted("val:" + r.caption), corner: Chrome.corner)
            }
        }
        .frame(width: 220)
    }

    // MARK: - モードと画面の切り替え

    private var modeAndScreenTabs: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Chrome.isPop ? 5 : 1) {
                ForEach(VentilationMode.allCases, id: \.self) { mode in
                    tab(mode.rawValue,
                        selected: controller.settings.mode == mode,
                        tint: Chrome.isPop ? Chrome.accent : Chrome.flow) { controller.change(mode: mode) }
                        .spotlight(controller.isSpotted("mode:" + mode.rawValue), corner: hardCorner)
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
                .font(Chrome.label(12, weight: .bold))
                .foregroundStyle(selected ? (Chrome.isPop ? Chrome.accentInk : tint) : Chrome.dim)
                .padding(.horizontal, Chrome.isPop ? 14 : 13)
                .padding(.vertical, 6)
                .background {
                    if Chrome.isPop {
                        Capsule()
                            .fill(selected ? tint : Chrome.panel)
                            .overlay(Capsule().stroke(selected ? tint : Chrome.line, lineWidth: 2))
                    }
                }
                .background(alignment: .bottom) {
                    if !Chrome.isPop {
                        Rectangle().fill(selected ? tint : .clear).frame(height: 2)
                    }
                }
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    // MARK: - 設定キー

    private var parameterKeys: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Chrome.isPop ? 6 : 4) {
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
                    .font(Chrome.label(9.5, weight: Chrome.isPop ? .bold : .regular))
                    .foregroundStyle(selected && Chrome.isPop ? Chrome.accent : Chrome.dim)
                HStack(alignment: .firstTextBaseline, spacing: 2) {
                    Text(shown.formatted(.number.precision(.fractionLength(parameter.digits))))
                        .font(Chrome.digits(20, weight: .bold))
                        .foregroundStyle(pending ? Chrome.pressure
                                                 : (selected && Chrome.isPop ? Chrome.accent : Chrome.keyInk))
                    Text(parameter.unit).font(.system(size: 9)).foregroundStyle(Chrome.faint)
                }
            }
            .padding(.horizontal, Chrome.isPop ? 10 : 8).padding(.vertical, 5)
            .frame(minWidth: 80, alignment: .leading)
        }
        .buttonStyle(.plain)
        .background(
            ZStack {
                if Chrome.isPop {
                    RoundedRectangle(cornerRadius: Chrome.corner).fill(Chrome.keyLip).offset(y: 3)
                }
                RoundedRectangle(cornerRadius: Chrome.corner)
                    .fill(selected && Chrome.isPop ? Chrome.accent.opacity(0.08) : Chrome.key)
                    .overlay(RoundedRectangle(cornerRadius: Chrome.corner)
                        .stroke(selected ? (Chrome.isPop ? Chrome.accent : Chrome.flow) : Chrome.keyBorder,
                                lineWidth: Chrome.isPop ? 2 : 1))
            }
        )
        .spotlight(controller.isSpotted("key:" + parameter.id), corner: Chrome.corner)
        .accessibilityLabel("\(parameter.label) \(shown.formatted()) \(parameter.unit)")
        .accessibilityHint(selected ? "ダイヤルで変更できます" : "押すとダイヤルで変更できます")
    }

    /// 鎮静は機器の設定ではないので、色を分けてシミュレーター側の操作として置く。
    private var sedationKey: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text("鎮静").font(Chrome.label(9.5, weight: Chrome.isPop ? .bold : .regular))
                .foregroundStyle(Chrome.sim)
            HStack(spacing: 6) {
                Button { controller.engine.sedation = max(0, controller.engine.sedation - 0.1) } label: {
                    Image(systemName: "minus").font(.system(size: 11))
                }
                .accessibilityLabel("鎮静を浅くする")
                Text("\(Int(controller.engine.sedation * 100))")
                    .font(Chrome.digits(20, weight: .bold)).foregroundStyle(Chrome.sim)
                Button { controller.engine.sedation = min(1, controller.engine.sedation + 0.1) } label: {
                    Image(systemName: "plus").font(.system(size: 11))
                }
                .accessibilityLabel("鎮静を深くする")
            }
        }
        .buttonStyle(.plain)
        .foregroundStyle(Chrome.sim)
        .padding(.horizontal, Chrome.isPop ? 10 : 8).padding(.vertical, 5)
        .background(
            ZStack {
                if Chrome.isPop {
                    RoundedRectangle(cornerRadius: Chrome.corner).fill(Chrome.keyLip).offset(y: 3)
                }
                RoundedRectangle(cornerRadius: Chrome.corner)
                    .fill(Chrome.key)
                    .overlay(RoundedRectangle(cornerRadius: Chrome.corner)
                        .stroke(Chrome.isPop ? Chrome.sim.opacity(0.4) : Chrome.edge,
                                lineWidth: Chrome.isPop ? 2 : 1))
            }
        )
        .spotlight(controller.isSpotted("key:sed"), corner: Chrome.corner)
    }

    // MARK: - ハードキー

    private var hardKeys: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 5) {
                DeviceKey(title: "吸気ポーズ",
                          isOn: holdKey == .inspiratory) { controller.requestHold(.inspiratory) }
                    .spotlight(controller.isSpotted("hard:kInsp"), corner: hardCorner)
                DeviceKey(title: "呼気ポーズ",
                          isOn: holdKey == .expiratory) { controller.requestHold(.expiratory) }
                    .spotlight(controller.isSpotted("hard:kExp"), corner: hardCorner)
                DeviceKey(title: "100% O₂") { controller.oxygenFlush() }
                    .spotlight(controller.isSpotted("hard:kO2"), corner: hardCorner)
                DeviceKey(title: "気管吸引") { controller.performSuction() }
                    .spotlight(controller.isSpotted("hard:kSuc"), corner: hardCorner)
                DeviceKey(title: "波形停止", isOn: controller.waveformsFrozen) {
                    controller.waveformsFrozen.toggle()
                }
                .spotlight(controller.isSpotted("hard:kFrz"), corner: hardCorner)
                DeviceKey(title: speedLabel, tint: Chrome.sim,
                          isOn: controller.speed.rawValue > 1) { cycleSpeed() }
                    .spotlight(controller.isSpotted("hard:kSpd"), corner: hardCorner)
                DeviceKey(title: controller.pendingBloodGasAt == nil ? "血液ガス" : "採血中…",
                          tint: Chrome.sim,
                          isOn: controller.pendingBloodGasAt != nil) { controller.orderBloodGas() }
                    .spotlight(controller.isSpotted("hard:kAbg"), corner: hardCorner)
                DeviceKey(title: "離脱", tint: Chrome.sim) {
                    controller.openedWeaning()
                    showingWeaning = true
                }
                .spotlight(controller.isSpotted("hard:kWean"), corner: hardCorner)
                DeviceKey(title: "学習コース", tint: Chrome.sim,
                          isOn: controller.lesson != nil) { showingCourse = true }
                    .spotlight(controller.isSpotted("hard:kLearn"), corner: hardCorner)
            }
            .padding(.horizontal, 6).padding(.vertical, Chrome.isPop ? 6 : 5)
        }
        .background(Chrome.isPop ? Color.clear : Chrome.chassisTop)
    }

    /// ハードキーはポップのときだけ丸い。光の枠もそれに合わせる。
    private var hardCorner: CGFloat { Chrome.isPop ? 999 : Chrome.corner }

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
                .font(Chrome.label(11)).foregroundStyle(Chrome.dim)
                .lineLimit(2)
            Spacer(minLength: 0)
            VStack(alignment: .trailing, spacing: 0) {
                Text(controller.selectedParameter?.label ?? "設定を選択")
                    .font(Chrome.label(9.5, weight: Chrome.isPop ? .bold : .regular))
                    .foregroundStyle(Chrome.dim)
                HStack(alignment: .firstTextBaseline, spacing: 2) {
                    Text(dialValueText)
                        .font(Chrome.digits(26, weight: .bold))
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
                .spotlight(controller.isSpotted("dial"), corner: 999)
            Button { controller.commitPending() } label: {
                Text("確定")
                    .font(Chrome.label(13, weight: Chrome.isPop ? .heavy : .semibold))
                    .foregroundStyle(Chrome.isPop ? Chrome.accentInk : Chrome.good)
                    .padding(.horizontal, Chrome.isPop ? 16 : 12).padding(.vertical, 10)
                    .background(
                        Group {
                            if Chrome.isPop {
                                Capsule().fill(Chrome.accent)
                            } else {
                                RoundedRectangle(cornerRadius: 4)
                                    .stroke(Chrome.good.opacity(0.6), lineWidth: 1)
                            }
                        }
                    )
            }
            .buttonStyle(.plain)
            .disabled(!controller.hasPendingChange)
            .opacity(controller.hasPendingChange ? 1 : 0.32)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, Chrome.isPop ? 7 : 6)
        .background(Chrome.bar)
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

}
