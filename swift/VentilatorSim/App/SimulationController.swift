import Foundation
import Observation
import VentilatorCore
#if canImport(UIKit)
import UIKit
#endif

/// 波形用のリングバッファ。UI の再描画とは独立に、シミュレーション内時間で一定間隔に積む。
final class WaveformTrace {
    private(set) var pressure: [Double]
    private(set) var flow: [Double]
    private(set) var volume: [Double]
    private(set) var cursor = 0
    let capacity: Int
    /// 画面を横切るのにかかるシミュレーション内の秒数。
    let sweepSeconds: Double = 8

    init(capacity: Int = 480) {
        self.capacity = capacity
        pressure = Array(repeating: .nan, count: capacity)
        flow = Array(repeating: .nan, count: capacity)
        volume = Array(repeating: .nan, count: capacity)
    }

    var sampleInterval: Double { sweepSeconds / Double(capacity) }

    func push(pressure p: Double, flow f: Double, volume v: Double) {
        pressure[cursor] = p
        flow[cursor] = f
        volume[cursor] = v
        cursor = (cursor + 1) % capacity
        // 走査線の先を消して、実機のスイープ表示と同じ見え方にする
        for k in 1...6 { 
            let i = (cursor + k) % capacity
            pressure[i] = .nan; flow[i] = .nan; volume[i] = .nan
        }
    }

    func clear() {
        pressure = Array(repeating: .nan, count: capacity)
        flow = Array(repeating: .nan, count: capacity)
        volume = Array(repeating: .nan, count: capacity)
        cursor = 0
    }
}

@Observable
final class SimulationController {

    enum Speed: Double, CaseIterable, Identifiable {
        case paused = 0, realtime = 1, fast = 10, veryFast = 60
        var id: Double { rawValue }
        var label: String {
            switch self {
            case .paused: return "‖"
            case .realtime: return "1×"
            case .fast: return "10×"
            case .veryFast: return "60×"
            }
        }
    }

    private(set) var engine: VentilatorEngine
    private(set) var scenario: Scenario
    var speed: Speed = .realtime
    private(set) var bloodGases: [BloodGas] = []
    private(set) var pendingBloodGasAt: Double?
    private(set) var log: [(time: Double, message: String)] = []
    private(set) var sbtElapsed: Double?
    private(set) var sbtFailureReason: String?
    private(set) var sbtFinished = false
    private(set) var sbtPassed = false
    /// SBT 前の設定。失敗・中止のときにこれへ戻す（Web 版の S.sbtSaved）。
    @ObservationIgnored private var sbtSaved: VentilatorSettings?
    /// 中止基準に当てはまり始めた時刻。1 分続いたら失敗にする（一瞬の揺れでは止めない）。
    @ObservationIgnored private var sbtBadSince: Double?

    /// SBT が終わったときに出す結果画面（成功・失敗）。閉じると nil に戻る。
    struct SBTOutcome: Identifiable {
        let id: Int
        let passed: Bool
        let reason: String?
        let rsbiPerKg: Double?
        let respiratoryRate: Double
    }
    var sbtOutcome: SBTOutcome?
    @ObservationIgnored private var sbtOutcomeCount = 0

    /// 「自分で設定する」で始めたとき。最初に「確定」するまで、仮の設定だと知らせる。
    private(set) var settingsAreProvisional = false
    /// 抜管後は換気を止める。nil なら挿管中。
    private(set) var extubation: ExtubationResult?

    struct ExtubationResult {
        var succeeded: Bool
        var metCriteria: Int
        var totalCriteria: Int
        var passedSBT: Bool
    }

    // MARK: - 学習コース

    enum LessonPhase { case task, feedback, done }

    private(set) var lessonRuntime: LessonRuntime?
    private(set) var lessonPhase: LessonPhase = .task
    private(set) var lessonFeedback = ""
    /// LessonRuntime は監視対象にならないので、変化したらこれを進めて View を更新させる。
    private(set) var lessonVersion = 0

    /// レッスンを修了したときの短いお祝い。出してから 2 秒で自分で消える。
    struct Celebration: Identifiable, Equatable {
        let id: Int
        let text: String
    }
    private(set) var celebration: Celebration?
    private var celebrationCount = 0

    var lesson: Lesson? { lessonRuntime?.lesson }
    var lessonChapter: LessonChapter? {
        guard let id = lessonRuntime?.lesson.id else { return nil }
        return LessonLibrary.chapter(of: id)
    }

    var lessonContext: LessonContext {
        LessonContext(engine: engine,
                      bloodGases: bloodGases,
                      sbt: SBTState(running: sbtElapsed != nil && !sbtFinished,
                                    finished: sbtFinished,
                                    passed: sbtPassed,
                                    failureReason: sbtFailureReason,
                                    elapsed: sbtElapsed ?? 0),
                      extubated: extubation != nil,
                      memory: lessonRuntime?.memory ?? LessonMemory())
    }

    /// いま光らせているところ。
    /// - 操作の課題 … 課題の spot（押すところ。押したらダイヤルと確定へ移る）
    /// - 会話・クイズ … 課題の spot ＋ セリフや設問に出てきたモニターの場所（lessonLook）
    /// - 操作後の解説 … 解説の文に出てきたモニターの場所（押す操作はもう終わっているので、キーは光らせない）
    var lessonSpots: [String] {
        if lessonPhase == .feedback { return lessonLook }
        guard lessonPhase == .task, let task = lessonRuntime?.task else { return [] }
        if task.isTalk || task.quiz != nil { return lessonLook }
        // 光っているキーを押したら、次に触るダイヤル（値を変えたら「確定」）へ光を移す。
        if let selected = selectedParameterID, task.spot.contains("key:" + selected) {
            return task.spot.filter { !$0.hasPrefix("key:") } + [hasPendingChange ? "confirm" : "dial"]
        }
        return task.spot
    }

    func isSpotted(_ spec: String) -> Bool { lessonSpots.contains(spec) }

    /* 会話・クイズ・解説で光らせるモニターの場所。Web 版 app.js の paintLook と同じ規則で、
     * 文の中に出てきた計測値や波形（LessonLibrary.monitorSpots）を光らせる。
     * 場面が変わったときだけ作り直す（View の描画のたびに文を調べない）。 */
    private(set) var lessonLook: [String] = []
    private var lessonFeedbackRaw = ""

    private func refreshLessonLook() {
        var look: [String] = []
        if let runtime = lessonRuntime {
            switch lessonPhase {
            case .task:
                if let task = runtime.task, task.isTalk || task.quiz != nil {
                    // 差し込み前の文で調べる（{PIP} も名前として拾える）
                    let text = task.quiz?.questionText(lessonContext) ?? task.instruction(lessonContext)
                    look = LessonLibrary.lookFor(task, text: text)
                }
            case .feedback:
                look = LessonLibrary.monitorSpots(in: lessonFeedbackRaw)
            case .done:
                break
            }
        }
        if look != lessonLook { lessonLook = look }
    }

    /* 帯にも出す計測値。課題に入った時点の値を控えておき、操作が終わったら「前 → 後」で見せる。
     * 解説を出しているあいだも、いま終えた課題の計測値を出し続けたいので、
     * 見出しの一覧ごと控えておく（index はもう次の課題を指している）。 */
    private(set) var lessonWatch: [String] = []
    private(set) var lessonWatchBefore: [String: String] = [:]
    /// 解説を出した瞬間の値。解説を読んでいるあいだに「後」の数字が動かないよう、ここで止める。
    private(set) var lessonWatchAfter: [String: String] = [:]
    private var lessonWatchIndex = -1

    /// 毎フレーム呼んでよい。課題が変わった瞬間だけ控えを取り直す。
    private func refreshLessonWatch() {
        guard let runtime = lessonRuntime else {
            if lessonWatchIndex != -1 { lessonWatch = []; lessonWatchBefore = [:]; lessonWatchIndex = -1 }
            return
        }
        guard lessonPhase == .task, lessonWatchIndex != runtime.index else { return }
        lessonWatchIndex = runtime.index
        lessonWatch = runtime.task?.watch ?? []
        var snapshot: [String: String] = [:]
        for caption in lessonWatch { snapshot[caption] = Readout.find(caption)?.value(engine) ?? "––" }
        lessonWatchBefore = snapshot
    }

    /// 心拍の拍ごとに 1 進む。SpO₂ のタイルの ♥ がこれに合わせて光る（パルス音と同じ拍）。
    private(set) var pulseBeat: Int = 0

    /// 5 Hz で更新する表示用スナップショット。60 fps で View を無効化しないための仕切り。
    private(set) var tickCount: Int = 0

    // MARK: - 機器としての状態

    enum Screen: String, CaseIterable, Identifiable {
        case waveforms, loops, trend, lung3D
        var id: String { rawValue }
        var label: String {
            switch self {
            case .waveforms: return "波形"
            case .loops: return "ループ"
            case .trend: return "トレンド"
            case .lung3D: return "肺 3D"
            }
        }
    }

    struct TrendSample: Identifiable {
        let id = UUID()
        let time: Double
        let peak: Double
        let plateau: Double?
        let tidal: Double
        let spo2: Double
    }

    /// ループ表示の 1 点。容量は呼気終末を 0 とした値で持つ。
    struct LoopPoint {
        let volume: Double
        let pressure: Double
        let flow: Double
    }

    var screen: Screen = .waveforms
    /// 波形停止。実機の freeze と同じで、計測と換気は止めない。
    var waveformsFrozen = false
    private(set) var alarmSilencedUntil: Double = -1
    var isAlarmSilenced: Bool { alarmSilencedUntil > engine.clock }

    private(set) var trend: [TrendSample] = []
    private(set) var currentLoop: [LoopPoint] = []
    private(set) var previousLoop: [LoopPoint] = []

    /// ダイヤルで操作中の設定項目と、確定前の値。実機と同じく確定するまで反映しない。
    private(set) var selectedParameterID: String?
    private(set) var pendingValue: Double?

    var selectedParameter: VentilatorParameter? {
        guard let id = selectedParameterID else { return nil }
        return parameter(id: id)
    }
    /// 設定キーの定義を、症例の可動域に合わせて返す。鎮静（"sed"）もここから引ける。
    func parameter(id: String) -> VentilatorParameter? {
        if id == VentilatorParameter.sedation.id { return .sedation }
        return VentilatorParameter.fitted(to: engine.limits).first { $0.id == id }
    }
    /// いま反映されている値。鎮静だけは設定ではなく engine が持っている。
    func currentValue(_ parameter: VentilatorParameter) -> Double {
        if parameter.isSimulatorControl {
            _ = settingsVersion
            return (engine.sedation * 100).rounded()
        }
        return parameter.read(settings)
    }
    /// 確定していない変更があるか。
    var hasPendingChange: Bool {
        guard let parameter = selectedParameter, let pending = pendingValue else { return false }
        return abs(pending - currentValue(parameter)) > 1e-9
    }

    /// 設定は engine が持っているが、SwiftUI から双方向に束縛できるようここを窓口にする。
    /// getter で settingsVersion を読むことで、書き込みのたびに View が更新される。
    var settings: VentilatorSettings {
        get {
            _ = settingsVersion
            return engine.settings
        }
        set {
            engine.settings = newValue
            settingsVersion &+= 1
        }
    }
    private var settingsVersion: Int = 0

    @ObservationIgnored let trace = WaveformTrace()
    @ObservationIgnored private var sampleAccumulator: Double = 0
    @ObservationIgnored private var trendAccumulator: Double = 4
    @ObservationIgnored private var loopBuffer: [LoopPoint] = []
    @ObservationIgnored private var loopBaseline: Double = 0
    @ObservationIgnored private var lastPhase: VentilatorEngine.Phase = .expiration
    @ObservationIgnored private var displaySync: Double = 0
    @ObservationIgnored private var link: AnyObject?
    @ObservationIgnored private var lastTimestamp: CFTimeInterval = 0
    @ObservationIgnored private var oxygenFlushUntil: Double?
    @ObservationIgnored private var oxygenFlushRestore: Double?

    /// 08:00 を開始時刻にして、経過をシミュレーション内の時計として見せる。
    var wallClock: String {
        let minutes = 8 * 60 + engine.clock / 60
        return String(format: "%02d:%02d", Int(minutes / 60) % 24, Int(minutes.truncatingRemainder(dividingBy: 60)))
    }

    init(scenario: Scenario, settings: VentilatorSettings, provisional: Bool = false) {
        self.scenario = scenario
        self.engine = VentilatorEngine(patient: scenario.patient, settings: settings)
        engine.settle()
        settingsAreProvisional = provisional
        append("換気開始：\(settings.mode.uiLabel)")
    }

    /// 症例を読み込み直す（メニューの「症例を選ぶ」）。Web 版 loadScenario と同じく、経過もレッスンも捨てる。
    func load(scenario: Scenario, settings: VentilatorSettings, provisional: Bool = false) {
        endLesson()
        resetRun(scenario: scenario, settings: settings, sedation: nil)
        settingsAreProvisional = provisional
        append("換気開始：\(settings.mode.uiLabel)")
    }

    /// 患者・設定・経過・機器の一時状態（消音、100% 酸素の戻し、早送り、SBT）をすべて入れ直す。
    private func resetRun(scenario: Scenario, settings: VentilatorSettings, sedation: Double?) {
        self.scenario = scenario
        engine = VentilatorEngine(patient: scenario.patient, settings: settings)
        if let sedation { engine.sedation = sedation }
        engine.settle()                  // その設定で数呼吸ぶん進め、実測をそろえてから始める
        settingsVersion &+= 1
        bloodGases = []
        pendingBloodGasAt = nil
        trend = []
        currentLoop = []
        previousLoop = []
        loopBuffer = []
        loopBaseline = 0
        lastPhase = .expiration
        sampleAccumulator = 0
        trendAccumulator = 4
        trace.clear()
        log = []
        sbtElapsed = nil
        sbtFailureReason = nil
        sbtFinished = false
        sbtPassed = false
        sbtSaved = nil
        sbtBadSince = nil
        sbtOutcome = nil
        extubation = nil
        selectedParameterID = nil
        pendingValue = nil
        speed = .realtime
        screen = .waveforms
        waveformsFrozen = false
        // 前の症例・レッスンの消音や「100% 酸素を 2 分後に戻す」を持ち越さない。
        // 持ち越すと、FiO₂ 100% から始まるレッスンの設定を 2 分後に書き換えてしまう。
        alarmSilencedUntil = -1
        oxygenFlushUntil = nil
        oxygenFlushRestore = nil
        settingsAreProvisional = false
    }

    // MARK: - 駆動

    func start() {
        #if canImport(UIKit)
        let displayLink = CADisplayLink(target: DisplayLinkProxy { [weak self] link in
            self?.advance(timestamp: link.timestamp)
        }, selector: #selector(DisplayLinkProxy.handle(_:)))
        displayLink.add(to: .main, forMode: .common)
        link = displayLink
        #endif
    }

    func stop() {
        #if canImport(UIKit)
        (link as? CADisplayLink)?.invalidate()
        #endif
        link = nil
        SoundBoard.shared.updateAlarm(level: 0, silenced: true)
        SoundBoard.shared.resetPulse()
    }

    private func advance(timestamp: CFTimeInterval) {
        defer { lastTimestamp = timestamp }
        guard lastTimestamp > 0 else { return }
        let realDelta = min(0.06, timestamp - lastTimestamp)
        advance(realSeconds: realDelta)
    }

    /// テストやプレビューからも呼べるよう、実時間の差分を受け取る形にしてある。
    func advance(realSeconds: Double) {
        guard speed != .paused else { return }
        if extubation != nil {
            // 抜管後は換気を止める。ただしレッスンの判定（「結果を確認してください」など）は続ける。
            advanceLesson(simulated: realSeconds * speed.rawValue)
            refreshLessonWatch()
            syncDisplay(realSeconds)
            return
        }
        let simulated = realSeconds * speed.rawValue
        // 高速再生では刻みを粗くする。指数積分なので結果は変わらない。
        let nominal = speed == .realtime ? 0.005 : 0.01
        let steps = max(1, min(1400, Int((simulated / nominal).rounded(.up))))
        let dt = simulated / Double(steps)

        let sampling = (speed == .realtime) && !waveformsFrozen
        for _ in 0..<steps {
            engine.step(dt: dt)
            let relativeVolume = (engine.volume - engine.patient.compliance * engine.settings.peep) * 1000
            if sampling {
                sampleAccumulator += dt
                if sampleAccumulator >= trace.sampleInterval {
                    sampleAccumulator -= trace.sampleInterval
                    trace.push(pressure: engine.airwayPressure,
                               flow: engine.flow * 60,
                               volume: relativeVolume)
                }
                if loopBuffer.count < 2000 {
                    loopBuffer.append(LoopPoint(volume: relativeVolume - loopBaseline,
                                                pressure: engine.airwayPressure,
                                                flow: engine.flow * 60))
                }
            }
            // 吸気の立ち上がりでループを 1 本ぶん区切る
            if engine.phase == .inspiration && lastPhase != .inspiration {
                if loopBuffer.count > 12 { previousLoop = loopBuffer }
                loopBuffer = []
                loopBaseline = relativeVolume
            }
            lastPhase = engine.phase
        }
        currentLoop = loopBuffer

        recordTrend(simulated: simulated)
        updateTimers(simulated: simulated)
        advanceLesson(simulated: simulated)
        refreshLessonWatch()
        syncDisplay(realSeconds)
    }

    private func syncDisplay(_ realSeconds: Double) {
        // パルス音は拍の時刻がずれないよう毎フレーム見る（数値表示の 5 Hz とは別）。
        if SoundBoard.shared.pulse(spo2: engine.spo2, heartRate: engine.heartRate,
                                   now: ProcessInfo.processInfo.systemUptime) {
            pulseBeat &+= 1
        }
        displaySync += realSeconds
        if displaySync >= 0.2 {          // 数値表示は 5 Hz で十分
            displaySync = 0
            tickCount &+= 1
            updateAlarmSound()
        }
    }

    /// アラーム音。抜管後は鳴らさない。消音キーの 2 分間も鳴らさない。
    private func updateAlarmSound() {
        let level = extubation == nil ? (engine.alarms.map(\.severity).max() ?? 0) : 0
        SoundBoard.shared.updateAlarm(level: level, silenced: isAlarmSilenced)
    }

    private func recordTrend(simulated: Double) {
        trendAccumulator += simulated
        guard trendAccumulator >= 5 else { return }
        trendAccumulator = 0
        trend.append(TrendSample(time: engine.clock,
                                 peak: engine.measured.peakPressure,
                                 plateau: engine.measured.plateauPressure,
                                 tidal: engine.measured.tidalVolumeExp,
                                 spo2: engine.spo2))
        if trend.count > 900 { trend.removeFirst() }
    }

    // MARK: - ダイヤル操作

    /// 設定キーを押す。選択中のキーをもう一度押しても外さない
    /// （外すと、確定前に押し直した人が「押したのに選ばれていない」状態にはまる）。
    func select(parameterID: String) {
        guard selectedParameterID != parameterID, let key = self.parameter(id: parameterID) else { return }
        selectedParameterID = parameterID
        pendingValue = currentValue(key)
    }

    /// ダイヤルを回す。steps は目盛りの数（速く回したときは 2 以上が来る）。確定するまで患者には届かない。
    func nudge(_ steps: Double) {
        guard let parameter = selectedParameter else { return }
        let current = pendingValue ?? currentValue(parameter)
        let stepped = ((current + steps * parameter.step) / parameter.step).rounded() * parameter.step
        pendingValue = min(max(stepped, parameter.range.lowerBound), parameter.range.upperBound)
        if pendingValue != current { SoundBoard.shared.play(.tick) }
    }

    /// 確定。反映したらキーの選択を外し、次の操作はキーを選ぶところから始める。
    func commitPending() {
        guard let parameter = selectedParameter, let pending = pendingValue, hasPendingChange else { return }
        if parameter.isSimulatorControl {
            engine.sedation = pending / 100
            settingsVersion &+= 1
        } else {
            var updated = engine.settings
            parameter.write(&updated, pending)
            settings = updated
        }
        SoundBoard.shared.play(.confirm)
        append("\(parameter.label) を \(pending.formatted(.number.precision(.fractionLength(parameter.digits)))) \(parameter.unit) に変更")
        settingsAreProvisional = false
        selectedParameterID = nil
        pendingValue = nil
    }

    func change(mode: VentilationMode) {
        guard engine.settings.mode != mode else { return }
        var updated = engine.settings
        updated.mode = mode
        settings = updated
        selectedParameterID = nil
        pendingValue = nil
        append("モードを \(mode.uiLabel) に変更")
        send(.mode(mode))
    }

    // MARK: - 機器のキー

    func requestHold(_ kind: VentilatorEngine.HoldKind) {
        engine.requestHold(kind)
        append(kind == .inspiratory ? "吸気ポーズを予約（次の吸気末で測定）"
                                    : "呼気ポーズを予約（次の呼気末で測定）")
        send(kind == .inspiratory ? .inspiratoryHold : .expiratoryHold)
    }

    /// 気管吸引。痰が取れて抵抗は下がるが、一時的に酸素化が落ちる。
    func performSuction() {
        engine.suction()
        append("気管吸引を実施")
        send(.suction)
    }

    /// 一時的な 100% 酸素。2 分で元の値に戻す。
    func oxygenFlush() {
        let previous = engine.settings.fio2
        guard previous < 1.0 else { return }
        engine.settings.fio2 = 1.0
        settingsVersion &+= 1
        oxygenFlushUntil = engine.clock + 120
        oxygenFlushRestore = previous
        append("100% 酸素（2 分）")
        send(.oxygenFlush)
    }

    func toggleAlarmSilence() {
        alarmSilencedUntil = isAlarmSilenced ? -1 : engine.clock + 120
    }

    private func updateTimers(simulated: Double) {
        if let due = pendingBloodGasAt, engine.clock >= due {
            pendingBloodGasAt = nil
            let gas = engine.drawBloodGas()
            bloodGases.append(gas)
            append(String(format: "血液ガス：pH %.2f / PaCO₂ %.0f / PaO₂ %.0f", gas.pH, gas.paco2, gas.pao2))
            speed = .realtime
        }
        if var elapsed = sbtElapsed, !sbtFinished {
            elapsed += simulated
            sbtElapsed = elapsed
            // Web 版 sbtTick と同じく、中止基準に 1 分当てはまり続けたら失敗にする。
            if let reason = Weaning.failureReason(for: engine, elapsed: elapsed) {
                let since = sbtBadSince ?? engine.clock
                sbtBadSince = since
                if engine.clock - since > 60 {
                    sbtFinished = true
                    sbtPassed = false
                    sbtFailureReason = reason.subscripted
                    restoreAfterSBT()
                    speed = .realtime
                    append("SBT 失敗：\(reason.subscripted)")
                    presentSBTOutcome(passed: false)
                }
            } else {
                sbtBadSince = nil
            }
            if !sbtFinished && elapsed >= 1800 {
                sbtFinished = true
                sbtPassed = true
                speed = .realtime
                append("SBT 完遂（30 分）")
                presentSBTOutcome(passed: true)
            }
        }
        if let until = oxygenFlushUntil, engine.clock >= until {
            oxygenFlushUntil = nil
            if let restore = oxygenFlushRestore, engine.settings.fio2 == 1.0 {
                engine.settings.fio2 = restore
                settingsVersion &+= 1
            }
            oxygenFlushRestore = nil
        }
    }

    // MARK: - 学習コースの進行

    /// レッスンを開始する。症例とレッスン用の設定を入れ直すので、これまでの経過は捨てる。
    /// Web 版 startLesson と同じく、まず症例を読み込み（推奨設定・体重から作ったアラーム・患者）、
    /// その上にレッスン自身の設定と鎮静を重ねる。成人の既定値（Vt 下限 250 mL など）は残さない。
    func startLesson(_ lesson: Lesson) {
        let scenario = lesson.scenario
        var settings = scenario.initialSettings()
        lesson.prepare(&settings)
        resetRun(scenario: scenario, settings: settings, sedation: lesson.sedation)
        lessonRuntime = LessonRuntime(lesson: lesson)
        lessonPhase = .task
        lessonFeedback = ""
        lessonWatch = []
        lessonWatchBefore = [:]
        lessonWatchAfter = [:]
        lessonWatchIndex = -1
        lessonVersion &+= 1
        refreshLessonLook()
        append("学習コース：\(lesson.title)")
    }

    func endLesson() {
        lessonRuntime = nil
        lessonPhase = .task
        lessonFeedback = ""
        lessonWatch = []
        lessonWatchBefore = [:]
        lessonWatchAfter = [:]
        lessonWatchIndex = -1
        lessonVersion &+= 1
        refreshLessonLook()
    }

    /// 解説を読み終えて「次へ」。最後の課題の解説だったら、ここで修了にする。
    func continueLesson() {
        guard lessonPhase == .feedback, let runtime = lessonRuntime else { return }
        if runtime.finished {
            completeLesson(runtime.lesson)
        } else {
            lessonPhase = .task
        }
        lessonVersion &+= 1
        refreshLessonLook()
    }

    /// 会話の場面の「続ける」。物語を、読む人の速さで進める。
    func tapLesson() {
        guard let runtime = lessonRuntime, lessonPhase == .task else { return }
        if let why = runtime.tap(lessonContext) { finishStep(why) }
        lessonVersion &+= 1
        refreshLessonLook()
    }

    func answerLesson(_ choice: Int) {
        guard let runtime = lessonRuntime, lessonPhase == .task else { return }
        let result = runtime.answer(choice, lessonContext)
        if result.correct { finishStep(result.explanation ?? "") }
        lessonVersion &+= 1
        refreshLessonLook()
    }

    private func send(_ event: LessonEvent) {
        guard let runtime = lessonRuntime, lessonPhase == .task else { return }
        if let why = runtime.fire(event, lessonContext) { finishStep(why) }
        lessonVersion &+= 1
        refreshLessonLook()
    }

    private func advanceLesson(simulated: Double) {
        guard let runtime = lessonRuntime, lessonPhase == .task else { return }
        let before = runtime.index
        if let why = runtime.poll(lessonContext, seconds: simulated) { finishStep(why) }
        if before != runtime.index || runtime.holdFraction > 0 { lessonVersion &+= 1 }
        if before != runtime.index { refreshLessonLook() }
    }

    private func finishStep(_ why: String) {
        guard let runtime = lessonRuntime else { return }
        lessonFeedbackRaw = why
        lessonFeedback = fillSay(why)      // 解説は通過した瞬間の値で固定する
        // 帯の「前 → 後」も、解説が出た瞬間の値で止める。
        var after: [String: String] = [:]
        for caption in lessonWatch { after[caption] = Readout.find(caption)?.value(engine) ?? "––" }
        lessonWatchAfter = after
        if !why.isEmpty {
            // 最後の課題でも、解説があれば先に読ませる。「次へ」で修了になる。
            lessonPhase = .feedback
        } else if runtime.finished {
            completeLesson(runtime.lesson)
        } else {
            // 会話の場面には一言が付かない。空の解説画面を挟むと物語が途切れるので、そのまま次へ。
            lessonPhase = .task
        }
    }

    private func completeLesson(_ lesson: Lesson) {
        lessonPhase = .done
        celebrate(lesson)
    }

    /// 修了の演出。通し番号を付けて、同じレッスンを繰り返しても必ず出るようにする。
    /// 消すのは表示している View 側（出し終わったら clearCelebration を呼ぶ）。
    private func celebrate(_ lesson: Lesson) {
        celebrationCount &+= 1
        celebration = Celebration(id: celebrationCount, text: "レッスン修了！ 🎉")
    }

    func clearCelebration(_ id: Int) {
        if celebration?.id == id { celebration = nil }
    }

    // MARK: - 操作

    func orderBloodGas() {
        guard pendingBloodGasAt == nil else { return }
        pendingBloodGasAt = engine.clock + 120      // 結果が出るまで 2 分待つ
        append("動脈血液ガスを採取")
        if speed.rawValue < 10 { speed = .fast }
        send(.orderBloodGas)
    }

    /// 離脱の画面を開いた。レッスンの課題がこれを待っていることがある。
    func openedWeaning() { send(.openWeaning) }
    func openedPatientInfo() { send(.openPatientInfo) }

    /// 抜管。SBT に通っていて離脱条件もほぼ揃っていれば成功、そうでなければ再挿管。
    @discardableResult
    func extubate() -> ExtubationResult {
        if let done = extubation { return done }
        let criteria = Weaning.readiness(for: engine)
        let met = criteria.filter(\.met).count
        let result = ExtubationResult(succeeded: sbtPassed && met >= criteria.count - 1,
                                      metCriteria: met, totalCriteria: criteria.count,
                                      passedSBT: sbtPassed)
        extubation = result
        // sbtOutcome は消さない。SBT 結果の画面から抜管したとき、その画面に抜管の結果を続けて出す。
        selectedParameterID = nil
        pendingValue = nil
        append(result.succeeded ? "抜管（成功）" : "抜管（再挿管）")
        send(.extubate)
        // 抜管すると換気（と毎フレームの進行）が止まるので、次の課題の判定をここで一度走らせる。
        advanceLesson(simulated: 0)
        refreshLessonWatch()
        return result
    }

    var isSBTRunning: Bool { sbtElapsed != nil && !sbtFinished }

    /// SBT の開始。Web 版 startSBT と同じく、元の設定を控えてから
    /// PSV・体重相応の PS（10 kg 未満 8、25 kg 未満 6、それ以上 5）・PEEP 5 以下・FiO₂ 40% 以下にし、鎮静を浅くする。
    func beginSBT() {
        guard extubation == nil, !isSBTRunning else { return }
        sbtSaved = engine.settings
        var s = engine.settings
        let pbw = engine.patient.predictedBodyWeight
        s.mode = .pressureSupport
        s.pressureSupport = pbw < 10 ? 8 : (pbw < 25 ? 6 : 5)
        s.peep = min(s.peep, 5)
        s.fio2 = min(s.fio2, 0.4)
        settings = s
        engine.sedation = min(engine.sedation, 0.15)
        sbtElapsed = 0
        sbtFinished = false
        sbtPassed = false
        sbtFailureReason = nil
        sbtBadSince = nil
        sbtOutcome = nil
        selectedParameterID = nil
        pendingValue = nil
        append(String(format: "SBT 開始（PS %.0f / PEEP %.0f）", s.pressureSupport, s.peep))
        send(.startSBT)
    }

    /// SBT を途中でやめる。設定は開始前に戻す。
    func endSBT() {
        guard isSBTRunning else { return }
        sbtElapsed = nil
        sbtFailureReason = nil
        sbtBadSince = nil
        restoreAfterSBT()
        speed = .realtime
        append("SBT を中止")
    }

    /// 失敗・中止のあと、控えておいた設定に戻して呼吸筋を休ませる（Web 版 restoreSettings）。
    private func restoreAfterSBT() {
        guard let saved = sbtSaved else { return }
        settings = saved
        engine.sedation = min(0.5, engine.sedation + 0.25)
        sbtSaved = nil
        selectedParameterID = nil
        pendingValue = nil
    }

    private func presentSBTOutcome(passed: Bool) {
        sbtOutcomeCount &+= 1
        sbtOutcome = SBTOutcome(id: sbtOutcomeCount, passed: passed,
                                reason: passed ? nil : sbtFailureReason,
                                rsbiPerKg: engine.measured.rsbiPerKg,
                                respiratoryRate: engine.measured.respiratoryRateTotal)
    }

    func append(_ message: String) {
        log.append((engine.clock, message))
        if log.count > 300 { log.removeFirst() }
    }
}

#if canImport(UIKit)
/// CADisplayLink はターゲットを強参照するので、クロージャを挟んで循環参照を避ける。
private final class DisplayLinkProxy: NSObject {
    private let callback: (CADisplayLink) -> Void
    init(_ callback: @escaping (CADisplayLink) -> Void) { self.callback = callback }
    @objc func handle(_ link: CADisplayLink) { callback(link) }
}
#endif

// MARK: - セリフへの数値の差し込み

extension SimulationController {
    /// セリフの中の {PIP} や {FiO₂} を、そのときの計測値・設定値に置き換える。
    /// セリフに数字を書き込むと画面の実測とずれる（「PIP は 22」と言いながら画面は 18）ので、
    /// 登場人物が数値を口にするときは必ずここから差し込む。Web 版 app.js の fillSay と同じ名前を受ける
    /// （{PIP} {Pplat} {PEEP tot} {auto-PEEP} {Vte} {RR tot} {MV} {SpO₂} {FiO₂} {ABP mean} {pH} {PaCO₂} など）。
    func fillSay(_ text: String) -> String {
        guard text.contains("{") else { return text }
        var out = ""
        var rest = Substring(text)
        while let open = rest.firstIndex(of: "{") {
            out += rest[..<open]
            let afterOpen = rest.index(after: open)
            guard let close = rest[afterOpen...].firstIndex(of: "}") else {
                out += rest[open...]
                return out
            }
            let name = String(rest[afterOpen..<close])
            out += lookupSay(name) ?? "{\(name)}"
            rest = rest[rest.index(after: close)...]
        }
        out += rest
        return out
    }

    /// 名前の決め方は Web 版 fillSay と同じ：計測値タイルの見出し（Readout.caption）→
    /// 設定キーの見出し（VentilatorParameter.label、鎮静を含む）→ 血液ガスの項目。
    /// "FiO2" のように下付きでない書き方も受ける。知らない名前は {…} のまま残す。
    private func lookupSay(_ raw: String) -> String? {
        let name = raw.trimmingCharacters(in: .whitespaces)
        for candidate in [name, name.subscripted] {
            if let readout = Readout.find(candidate) { return readout.value(engine) }
            if let key = self.parameter(label: candidate) {
                return currentValue(key).formatted(.number.precision(.fractionLength(key.digits)))
            }
            switch candidate {
            case "pH":     return String(format: "%.2f", bloodGases.last?.pH ?? engine.pH)
            case "PaCO₂":  return String(format: "%.0f", bloodGases.last?.paco2 ?? engine.paco2)
            case "PaO₂":   return String(format: "%.0f", bloodGases.last?.pao2 ?? engine.pao2)
            case "HCO₃", "HCO₃⁻": return String(format: "%.1f", bloodGases.last?.hco3 ?? engine.hco3)
            default: break
            }
        }
        return nil
    }

    private func parameter(label: String) -> VentilatorParameter? {
        if label == VentilatorParameter.sedation.label { return .sedation }
        return VentilatorParameter.fitted(to: engine.limits).first { $0.label == label }
    }
}
