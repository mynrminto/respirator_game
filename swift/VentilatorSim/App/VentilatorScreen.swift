import SwiftUI
import VentilatorCore

/// 実機の筐体。上からステータス帯、画面、モードキー、設定キー、ハードキー、ダイヤル。
///
/// 横に動かさないと見えない表示は作らない。入りきらないぶんはキーを折り返して縦に伸ばし、
/// 全体を縦にスクロールさせる。ステータス帯（アラーム）は上に、学習コースの帯とダイヤルは下に
/// 貼り付けたまま残す（Web 版の `.dialrow{position:sticky;bottom:0}` と同じ）。
/// 帯をスクロールの中に置くと、SE や mini では計測値タイルの下に隠れて課題が見えなくなる。
struct VentilatorScreen: View {
    @Bindable var controller: SimulationController
    /// メニューの「タイトルへ」。画面を持っている側（RootView）が controller を捨てる。
    var onGoToTitle: () -> Void = {}

    @State private var showingBloodGas: BloodGas?
    @State private var showingWeaning = false
    @State private var showingPatient = false
    @State private var showingCourse = false
    @State private var showingCases = false

    /// 設定キーやダイヤルの見出し。Dynamic Type に合わせて大きくするが、キーの折り返しが
    /// 崩れない範囲で頭打ちにする。
    @ScaledMetric(relativeTo: .caption) private var keyCaptionSize: CGFloat = 11
    private var keyCaption: CGFloat { min(keyCaptionSize, 15) }

    var body: some View {
        let _ = controller.tickCount        // 5 Hz の更新を購読する
        ScrollViewReader { proxy in
            ScrollView(.vertical) {
                VStack(spacing: 0) {
                    screenArea
                        .padding(.horizontal, 6)
                        .padding(.vertical, 6)
                    modeAndScreenTabs
                    parameterKeys
                    hardKeys
                }
            }
            .safeAreaInset(edge: .top, spacing: 0) { topBar }
            .safeAreaInset(edge: .bottom, spacing: 0) {
                VStack(spacing: 0) {
                    LessonCoachView(controller: controller)
                    dialRow
                }
            }
            // 課題が機器のキーを指したら、そのキーが見えるところまで送る。
            .onChange(of: controller.lessonSpots) { _, spots in
                scrollToSpot(spots, proxy: proxy)
            }
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
                          ageLabel: controller.engine.patient.ageLabel,
                          inLesson: controller.lesson != nil,
                          meanArterialPressure: controller.engine.meanArterialPressure,
                          plateau: controller.engine.measured.plateauPressure,
                          autoPEEP: controller.engine.measured.autoPEEP)
        }
        .sheet(item: $controller.sbtOutcome) { outcome in
            SBTResultSheet(controller: controller, outcome: outcome)
        }
        .sheet(isPresented: $showingWeaning) {
            WeaningSheet(controller: controller)
        }
        .sheet(isPresented: $showingPatient) {
            PatientInfoSheet(controller: controller)
        }
        .sheet(isPresented: $showingCourse) {
            LessonCourseView { controller.startLesson($0) }
        }
        .sheet(isPresented: $showingCases) {
            ScenarioListView(onStart: { scenario, settings, provisional in
                showingCases = false
                controller.load(scenario: scenario, settings: settings, provisional: provisional)
            })
        }
    }

    /// 光らせた要素のうち、スクロールの中にあるものへ送る。ダイヤルと帯は下に貼り付けてあるので送らない。
    private func scrollToSpot(_ spots: [String], proxy: ScrollViewProxy) {
        let scrollable = ["key:", "hard:", "mode:", "val:"]
        guard let target = spots.first(where: { spec in
            spec == "wave" || scrollable.contains { spec.hasPrefix($0) }
        }) else { return }
        withAnimation(.easeInOut(duration: 0.3)) {
            proxy.scrollTo(target, anchor: nil)
        }
    }

    // MARK: - ステータス帯（上に固定）

    private var topBar: some View {
        VStack(spacing: 0) {
            HStack(spacing: 6) {
                menuButton
                alarmBanner
                ChipButton(title: controller.isAlarmSilenced ? "消音中" : "消音 2分",
                           isOn: controller.isAlarmSilenced,
                           action: controller.toggleAlarmSilence)
                    .accessibilityLabel(controller.isAlarmSilenced ? "消音を解除する" : "アラームを 2 分消音する")
                Text(controller.wallClock)
                    .font(Chrome.digits(15, weight: .bold)).foregroundStyle(Chrome.dim)
                    .fixedSize()
            }
            .padding(.leading, 2)
            .padding(.trailing, 8)
            if controller.settingsAreProvisional {
                // 「自分で設定する」で始めたとき。最初の「確定」まで出しておく。
                Text("いまは仮の設定です。キーを選んで決めてください")
                    .font(Chrome.label(12, weight: .bold))
                    .foregroundStyle(Chrome.warning)
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 12)
                    .padding(.bottom, 5)
            }
        }
        .background(Chrome.bar)
    }

    /// 症例やレッスンを変える入口。Web 版の「メニュー」キーにあたる。
    private var menuButton: some View {
        Menu {
            Section(controller.scenario.profile.name + "・" + controller.scenario.profile.weight) {
                Button { openPatientInfo() } label: {
                    Label("患者情報", systemImage: "person.text.rectangle")
                }
                Button { showingCourse = true } label: {
                    Label("レッスン一覧", systemImage: "list.bullet")
                }
                Button { showingCases = true } label: {
                    Label("症例を選ぶ", systemImage: "person.2")
                }
                Button { ThemeStore.shared.toggle() } label: {
                    Label("見た目を切り替える（いま：\(Chrome.kind.label)）", systemImage: "paintpalette")
                }
                Button { onGoToTitle() } label: {
                    Label("タイトルへ", systemImage: "house")
                }
            }
        } label: {
            Image(systemName: "line.3.horizontal")
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(Chrome.dim)
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .accessibilityLabel("メニュー")
    }

    /// アラームは 1 件だけ文字で出し、残りは丸い件数（+2）にする。
    /// 「一回換気量 低下　＋他 2 件」を 375pt 幅に押し込むと「一…」になって読めない。
    private var alarmBanner: some View {
        let alarms = controller.engine.alarms
        let severity = alarms.map(\.severity).max() ?? 0
        let tint: Color = severity >= 2 ? Chrome.critical : (severity == 1 ? Chrome.warning : Chrome.dim)
        let others = max(0, alarms.count - 1)
        return HStack(spacing: 6) {
            Circle().fill(tint.opacity(severity == 0 ? 0.25 : 1)).frame(width: 7, height: 7)
                .shadow(color: severity == 0 ? .clear : tint, radius: 3)
            Text(bannerText)
                .font(Chrome.label(12, weight: severity > 0 ? .bold : .regular))
                .foregroundStyle(tint)
                .lineLimit(1)
                .minimumScaleFactor(0.75)
            Spacer(minLength: 0)
            if others > 0 {
                Text("+\(others)")
                    .font(Chrome.digits(11, weight: .bold))
                    .foregroundStyle(Color.white)
                    .frame(minWidth: 20, minHeight: 20)
                    .padding(.horizontal, 2)
                    .background(Capsule().fill(tint))
                    .accessibilityLabel("ほかに \(others) 件")
            }
        }
        .padding(.leading, Chrome.isPop ? 10 : 8)
        .padding(.trailing, others > 0 ? 4 : (Chrome.isPop ? 10 : 8))
        .frame(height: 32)
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
        .accessibilityElement(children: .combine)
        .accessibilityLabel("アラーム \(bannerText)" + (others > 0 ? "　ほかに \(others) 件" : ""))
    }

    private var bannerText: String {
        let engine = controller.engine
        if let worst = engine.alarms.map(\.severity).max(),
           let first = engine.alarms.first(where: { $0.severity == worst }) {
            return first.message.subscripted
        }
        if let active = engine.activeHold {
            return active == .inspiratory ? "吸気ポーズ中  Pplat を測定中"
                                          : "呼気ポーズ中  total PEEP を測定中"
        }
        if let awaiting = engine.awaitingHold {
            return awaiting == .inspiratory ? "吸気ポーズ待機中（次の吸気末）"
                                            : "呼気ポーズ待機中（次の呼気末）"
        }
        if let result = controller.extubation {
            return result.succeeded ? "抜管済み" : "抜管後に再挿管が必要"
        }
        if let elapsed = controller.sbtElapsed, !controller.sbtFinished {
            let left = max(0, 1800 - elapsed)
            return String(format: "SBT 実施中  残り %d:%02d", Int(left / 60), Int(left.truncatingRemainder(dividingBy: 60)))
        }
        return "換気中  \(controller.settings.mode.uiLabel)"
    }

    // MARK: - 画面

    private var screenArea: some View {
        VStack(spacing: Chrome.isPop ? 2 : 1) {
            ZStack(alignment: .bottomLeading) {
                switch controller.screen {
                case .waveforms: scope
                case .loops: LoopView(current: controller.currentLoop,
                                      previous: controller.previousLoop,
                                      volumeFloor: volumeCeiling,
                                      flowFloor: flowLimit / 4)
                case .trend: TrendView(samples: controller.trend, volumeMax: volumeCeiling)
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
            // 波形の高さは決めておく。決めないとスクロールの中でつぶれる。
            .containerRelativeFrame(.vertical) { height, _ in
                min(max(200, height * 0.42), 330)
            }
            .id("wave")
            valueGrid
        }
        .background(Chrome.screenTileLine)
        .clipShape(RoundedRectangle(cornerRadius: Chrome.cornerLarge))
        .overlay(
            RoundedRectangle(cornerRadius: Chrome.cornerLarge)
                .stroke(Chrome.screenFrame, lineWidth: Chrome.isPop ? 3 : 1)
        )
    }

    /// 体重あたりの容量の目盛り。早産児の 6 mL と学童の 250 mL を同じ軸で描くと片方が線になる。
    private var volumeStep: Double {
        let pbw = controller.engine.patient.predictedBodyWeight
        return pbw < 6 ? 2 : (pbw < 20 ? 20 : 100)
    }

    private var volumeCeiling: Double {
        let engine = controller.engine
        let reference = max(engine.measured.tidalVolumeExp, controller.settings.tidalVolume,
                            engine.patient.predictedBodyWeight * 6) * 1.5
        return max(volumeStep * 2, (reference / volumeStep).rounded(.up) * volumeStep)
    }

    /// 流量の目盛り（±）。体重で決め（5 kg 未満 8、15 kg 未満 20、35 kg 未満 40、それ以上 80 L/min）、
    /// 実測や設定流量がはみ出すときだけ 5 L/min 単位で広げる。
    private var flowLimit: Double {
        let engine = controller.engine
        let pbw = engine.patient.predictedBodyWeight
        let base: Double = pbw < 5 ? 8 : (pbw < 15 ? 20 : (pbw < 35 ? 40 : 80))
        var peak = 0.0
        for value in controller.trace.flow where value.isFinite { peak = max(peak, abs(value)) }
        let setFlow = controller.settings.mode.isVolumeTargeted ? controller.settings.inspiratoryFlow : 0
        let needed = (max(peak, setFlow) * 1.2 / 5).rounded(.up) * 5
        return max(base, needed)
    }

    private var scope: some View {
        let engine = controller.engine
        let trace = controller.trace
        let peakCeiling = max(40, (engine.measured.peakPressure + 6).rounded(.up))
        let flow = flowLimit
        return ScopeView(
            lanes: [
                .init(label: "Paw", unit: "cmH₂O", color: Chrome.pressure,
                      samples: trace.pressure, range: -5...peakCeiling,
                      reference: controller.settings.peep),
                .init(label: "Flow", unit: "L/min", color: Chrome.flow,
                      samples: trace.flow, range: -flow...flow),
                .init(label: "Volume", unit: "mL", color: Chrome.volume,
                      samples: trace.volume, range: 0...volumeCeiling)
            ],
            cursor: trace.cursor,
            sampleCount: trace.capacity,
            sweepSeconds: trace.sweepSeconds)
            .spotlight(controller.isSpotted("wave"), corner: Chrome.corner)
    }

    /// 計測値。1 枚 108pt 以上あれば「——」と「mL/cmH₂O」が 1 行に収まるので、
    /// その幅で入るだけ並べて折り返す（Web 版の auto-fill / minmax(108px,1fr) と同じ）。
    private var valueGrid: some View {
        let engine = controller.engine
        return LazyVGrid(columns: [GridItem(.adaptive(minimum: 108), spacing: 1)], spacing: 1) {
            ForEach(Readout.all) { r in
                ValueTile(caption: r.caption, value: r.value(engine), unit: r.unit,
                          limit: r.limit?(engine), tone: r.tone?(engine))
                    .spotlight(controller.isSpotted("val:" + r.caption), corner: Chrome.corner)
                    .id("val:" + r.caption)
            }
        }
    }

    // MARK: - モードと画面の切り替え

    /// モードと画面の切り替え。横に流さず折り返す。モードと画面は別の行にする。
    /// 表示名は Web 版と同じ（VC-AC / PC-AC / SIMV / PSV / CPAP）。レッスンの指示文もこの名前で書いてある。
    private var modeAndScreenTabs: some View {
        VStack(alignment: .leading, spacing: Chrome.isPop ? 3 : 1) {
            FlowLayout(spacing: Chrome.isPop ? 5 : 1, lineSpacing: Chrome.isPop ? 3 : 1) {
                ForEach(VentilationMode.allCases, id: \.self) { mode in
                    tab(mode.uiLabel,
                        selected: controller.settings.mode == mode,
                        tint: Chrome.isPop ? Chrome.accent : Chrome.flow) { controller.change(mode: mode) }
                        .spotlight(controller.isSpotted("mode:" + mode.rawValue), corner: hardCorner)
                        .id("mode:" + mode.rawValue)
                }
            }
            FlowLayout(spacing: Chrome.isPop ? 5 : 1, lineSpacing: Chrome.isPop ? 3 : 1) {
                ForEach(SimulationController.Screen.allCases) { screen in
                    tab(screen.label,
                        selected: controller.screen == screen,
                        tint: Chrome.volume) { controller.screen = screen }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 6)
    }

    private func tab(_ title: String, selected: Bool, tint: Color,
                     action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(Chrome.label(13, weight: .bold))
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
                .frame(minHeight: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    // MARK: - 設定キー

    private var parameterKeys: some View {
        FlowLayout(spacing: Chrome.isPop ? 6 : 4, lineSpacing: Chrome.isPop ? 6 : 4,
                   alignment: .top) {
            ForEach(VentilatorParameter.applicable(to: controller.settings.mode,
                                                   limits: controller.engine.limits)) { parameter in
                parameterKey(parameter)
            }
            // 鎮静はシミュレーター側の操作。ほかのキーと同じくダイヤルで決めるが、枠を点線にして区別する。
            parameterKey(.sedation)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 6).padding(.vertical, 4)
    }

    private func parameterKey(_ parameter: VentilatorParameter) -> some View {
        let selected = controller.selectedParameterID == parameter.id
        let committed = controller.currentValue(parameter)
        let shown = selected ? (controller.pendingValue ?? committed) : committed
        let pending = selected && controller.hasPendingChange
        let sim = parameter.isSimulatorControl
        let accent: Color = sim ? Chrome.sim : (Chrome.isPop ? Chrome.accent : Chrome.flow)
        let border: Color = selected ? accent : (sim ? Chrome.sim.opacity(Chrome.isPop ? 0.6 : 0.8) : Chrome.keyBorder)
        let lineWidth: CGFloat = Chrome.isPop ? 2 : 1
        return Button { controller.select(parameterID: parameter.id) } label: {
            VStack(alignment: .leading, spacing: 1) {
                Text(parameter.label)
                    .font(Chrome.label(keyCaption, weight: Chrome.isPop ? .bold : .regular))
                    .foregroundStyle(sim ? Chrome.sim : (selected && Chrome.isPop ? Chrome.accent : Chrome.dim))
                    .lineLimit(1)
                HStack(alignment: .firstTextBaseline, spacing: 2) {
                    Text(shown.formatted(.number.precision(.fractionLength(parameter.digits))))
                        .font(Chrome.digits(20, weight: .bold))
                        .foregroundStyle(pending ? Chrome.pressure
                                                 : (sim ? Chrome.sim
                                                        : (selected && Chrome.isPop ? Chrome.accent : Chrome.keyInk)))
                    Text(parameter.unit).font(Chrome.label(10)).foregroundStyle(Chrome.faint)
                }
            }
            .padding(.horizontal, Chrome.isPop ? 10 : 8).padding(.vertical, 5)
            .frame(minWidth: 80, minHeight: 44, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .background(
            ZStack {
                if Chrome.isPop {
                    RoundedRectangle(cornerRadius: Chrome.corner).fill(Chrome.keyLip).offset(y: 3)
                }
                RoundedRectangle(cornerRadius: Chrome.corner)
                    .fill(selected && Chrome.isPop ? accent.opacity(0.08) : Chrome.key)
                    .overlay(
                        RoundedRectangle(cornerRadius: Chrome.corner)
                            .stroke(border,
                                    style: StrokeStyle(lineWidth: lineWidth,
                                                       dash: sim && !selected ? [4, 3] : []))
                    )
            }
        )
        .spotlight(controller.isSpotted("key:" + parameter.id), corner: Chrome.corner)
        .id("key:" + parameter.id)
        .accessibilityLabel("\(parameter.label) \(shown.formatted()) \(parameter.unit)"
                            + (sim ? "（シミュレーターの操作）" : ""))
        .accessibilityHint(selected ? "ダイヤルで変更できます" : "押すとダイヤルで変更できます")
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    // MARK: - ハードキー

    private var hardKeys: some View {
        FlowLayout(spacing: 5, lineSpacing: 5) {
            DeviceKey(title: "吸気ポーズ",
                      isOn: holdKey == .inspiratory) { controller.requestHold(.inspiratory) }
                .spotlight(controller.isSpotted("hard:kInsp"), corner: hardCorner)
                .id("hard:kInsp")
            DeviceKey(title: "呼気ポーズ",
                      isOn: holdKey == .expiratory) { controller.requestHold(.expiratory) }
                .spotlight(controller.isSpotted("hard:kExp"), corner: hardCorner)
                .id("hard:kExp")
            DeviceKey(title: "100% O₂") { controller.oxygenFlush() }
                .spotlight(controller.isSpotted("hard:kO2"), corner: hardCorner)
                .id("hard:kO2")
            DeviceKey(title: "気管吸引") { controller.performSuction() }
                .spotlight(controller.isSpotted("hard:kSuc"), corner: hardCorner)
                .id("hard:kSuc")
            DeviceKey(title: "波形停止", isOn: controller.waveformsFrozen) {
                controller.waveformsFrozen.toggle()
            }
            .spotlight(controller.isSpotted("hard:kFrz"), corner: hardCorner)
            .id("hard:kFrz")
            DeviceKey(title: speedLabel, tint: Chrome.sim,
                      isOn: controller.speed.rawValue > 1) { cycleSpeed() }
                .spotlight(controller.isSpotted("hard:kSpd"), corner: hardCorner)
                .id("hard:kSpd")
            DeviceKey(title: "患者情報", tint: Chrome.sim) { openPatientInfo() }
                .spotlight(controller.isSpotted("hard:kPt"), corner: hardCorner)
                .id("hard:kPt")
            DeviceKey(title: controller.pendingBloodGasAt == nil ? "血液ガス" : "採血中…",
                      tint: Chrome.sim,
                      isOn: controller.pendingBloodGasAt != nil) { controller.orderBloodGas() }
                .spotlight(controller.isSpotted("hard:kAbg"), corner: hardCorner)
                .id("hard:kAbg")
            DeviceKey(title: "離脱", tint: Chrome.sim) {
                controller.openedWeaning()
                showingWeaning = true
            }
            .spotlight(controller.isSpotted("hard:kWean"), corner: hardCorner)
            .id("hard:kWean")
            DeviceKey(title: "学習コース", tint: Chrome.sim,
                      isOn: controller.lesson != nil) { showingCourse = true }
            .spotlight(controller.isSpotted("hard:kLearn"), corner: hardCorner)
            .id("hard:kLearn")
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 6).padding(.vertical, Chrome.isPop ? 6 : 5)
        .background(Chrome.isPop ? Color.clear : Chrome.chassisTop)
    }

    private func openPatientInfo() {
        controller.openedPatientInfo()
        showingPatient = true
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

    // MARK: - ダイヤル（下に固定）

    private var dialRow: some View {
        let selected = controller.selectedParameter
        return HStack(spacing: 6) {
            Group {
                if let parameter = selected {
                    VStack(alignment: .leading, spacing: 0) {
                        Text(parameter.label)
                            .font(Chrome.label(keyCaption, weight: Chrome.isPop ? .bold : .regular))
                            .foregroundStyle(parameter.isSimulatorControl ? Chrome.sim : Chrome.dim)
                            .lineLimit(1)
                        HStack(alignment: .firstTextBaseline, spacing: 2) {
                            Text(dialValueText)
                                .font(Chrome.digits(26, weight: .bold))
                                .foregroundStyle(controller.hasPendingChange ? Chrome.pressure : Chrome.ink)
                                .lineLimit(1)
                                .minimumScaleFactor(0.6)
                            Text(parameter.unit)
                                .font(Chrome.label(11)).foregroundStyle(Chrome.faint)
                        }
                    }
                } else {
                    Text("キーを選び、ダイヤルで合わせて「確定」")
                        .font(Chrome.label(12)).foregroundStyle(Chrome.dim)
                        .lineLimit(3)
                        .minimumScaleFactor(0.85)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            HStack(spacing: 2) {
                stepButton(-1)
                KnobView(fraction: dialFraction,
                         isPending: controller.hasPendingChange,
                         isEnabled: selected != nil,
                         accessibilityValue: dialAccessibilityValue,
                         onStep: { controller.nudge($0) },
                         onCommit: { controller.commitPending() })
                stepButton(1)
            }
            .spotlight(controller.isSpotted("dial"), corner: 999)

            Button { controller.commitPending() } label: {
                Text("確定")
                    .font(Chrome.label(14, weight: Chrome.isPop ? .heavy : .semibold))
                    .foregroundStyle(Chrome.isPop ? Chrome.accentInk : Chrome.good)
                    .padding(.horizontal, Chrome.isPop ? 14 : 12).padding(.vertical, 10)
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
                    .frame(minWidth: 44, minHeight: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .disabled(!controller.hasPendingChange)
            .opacity(controller.hasPendingChange ? 1 : 0.32)
            .spotlight(controller.isSpotted("confirm"), corner: Chrome.isPop ? 999 : 4)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, Chrome.isPop ? 6 : 5)
        .background(Chrome.bar)
    }

    /// ダイヤル横の −／＋。1 回押すと 1 目盛り、長押しで送り続ける。
    private func stepButton(_ direction: Double) -> some View {
        let enabled = controller.selectedParameter != nil
        return Button { controller.nudge(direction) } label: {
            Image(systemName: direction < 0 ? "minus" : "plus")
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(Chrome.keyInk)
                .frame(width: 34, height: 34)
                .background(
                    Circle().fill(Chrome.key)
                        .overlay(Circle().stroke(Chrome.keyBorder, lineWidth: Chrome.isPop ? 2 : 1))
                )
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .buttonRepeatBehavior(.enabled)
        .disabled(!enabled)
        .opacity(enabled ? 1 : 0.4)
        .accessibilityLabel(direction < 0 ? "値を下げる" : "値を上げる")
    }

    private var dialValueText: String {
        guard let parameter = controller.selectedParameter else { return "—" }
        let value = controller.pendingValue ?? controller.currentValue(parameter)
        return value.formatted(.number.precision(.fractionLength(parameter.digits)))
    }

    private var dialAccessibilityValue: String {
        guard let parameter = controller.selectedParameter else { return "未選択" }
        return "\(parameter.label) \(dialValueText) \(parameter.unit)"
    }

    private var dialFraction: Double {
        guard let parameter = controller.selectedParameter else { return 0 }
        let value = controller.pendingValue ?? controller.currentValue(parameter)
        let span = parameter.range.upperBound - parameter.range.lowerBound
        guard span > 0 else { return 0 }
        return min(max((value - parameter.range.lowerBound) / span, 0), 1)
    }

}
