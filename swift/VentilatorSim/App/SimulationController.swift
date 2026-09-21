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
                                    failureReason: sbtFailureReason),
                      extubated: extubation != nil,
                      memory: lessonRuntime?.memory ?? LessonMemory())
    }

    /// 5 Hz で更新する表示用スナップショット。60 fps で View を無効化しないための仕切り。
    private(set) var tickCount: Int = 0

    // MARK: - 機器としての状態

    enum Screen: String, CaseIterable, Identifiable {
        case waveforms, loops, trend
        var id: String { rawValue }
        var label: String {
            switch self {
            case .waveforms: return "波形"
            case .loops: return "ループ"
            case .trend: return "トレンド"
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
        return VentilatorParameter.all.first { $0.id == id }
    }
    /// 確定していない変更があるか。
    var hasPendingChange: Bool {
        guard let parameter = selectedParameter, let pending = pendingValue else { return false }
        return abs(pending - parameter.read(engine.settings)) > 1e-9
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

    init(scenario: Scenario, settings: VentilatorSettings) {
        self.scenario = scenario
        self.engine = VentilatorEngine(patient: scenario.patient, settings: settings)
        append("換気開始：\(settings.mode.rawValue)")
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
    }

    private func advance(timestamp: CFTimeInterval) {
        defer { lastTimestamp = timestamp }
        guard lastTimestamp > 0 else { return }
        let realDelta = min(0.06, timestamp - lastTimestamp)
        advance(realSeconds: realDelta)
    }

    /// テストやプレビューからも呼べるよう、実時間の差分を受け取る形にしてある。
    func advance(realSeconds: Double) {
        guard speed != .paused, extubation == nil else { return }
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

        displaySync += realSeconds
        if displaySync >= 0.2 {          // 数値表示は 5 Hz で十分
            displaySync = 0
            tickCount &+= 1
        }
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

    /// 設定キーを押す。もう一度押すと選択を外す。
    func select(parameterID: String) {
        if selectedParameterID == parameterID {
            selectedParameterID = nil
            pendingValue = nil
            return
        }
        selectedParameterID = parameterID
        pendingValue = VentilatorParameter.all.first { $0.id == parameterID }?.read(engine.settings)
    }

    /// ダイヤルを 1 目盛り回す。確定するまで患者には届かない。
    func nudge(_ direction: Double) {
        guard let parameter = selectedParameter else { return }
        let current = pendingValue ?? parameter.read(engine.settings)
        let stepped = ((current + direction * parameter.step) / parameter.step).rounded() * parameter.step
        pendingValue = min(max(stepped, parameter.range.lowerBound), parameter.range.upperBound)
    }

    func commitPending() {
        guard let parameter = selectedParameter, let pending = pendingValue, hasPendingChange else { return }
        var updated = engine.settings
        parameter.write(&updated, pending)
        settings = updated
        append("\(parameter.label) を \(pending.formatted(.number.precision(.fractionLength(parameter.digits)))) \(parameter.unit) に変更")
    }

    func change(mode: VentilationMode) {
        guard engine.settings.mode != mode else { return }
        var updated = engine.settings
        updated.mode = mode
        settings = updated
        selectedParameterID = nil
        pendingValue = nil
        append("モードを \(mode.rawValue) に変更")
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
        engine.performSuction()
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
            append(String(format: "血液ガス：pH %.2f / PaCO2 %.0f / PaO2 %.0f", gas.pH, gas.paco2, gas.pao2))
            speed = .realtime
        }
        if var elapsed = sbtElapsed, !sbtFinished {
            elapsed += simulated
            sbtElapsed = elapsed
            if sbtFailureReason == nil,
               let reason = Weaning.failureReason(for: engine, elapsed: elapsed) {
                sbtFailureReason = reason
                sbtFinished = true
                speed = .realtime
                append("SBT 中に異常：\(reason)")
            } else if sbtFailureReason == nil, elapsed >= 1800 {
                sbtFinished = true
                sbtPassed = true
                speed = .realtime
                append("SBT 完遂（30 分）")
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
    func startLesson(_ lesson: Lesson) {
        let scenario = lesson.scenario
        var settings = VentilatorSettings()
        lesson.prepare(&settings)
        self.scenario = scenario
        engine = VentilatorEngine(patient: scenario.patient, settings: settings)
        if let sedation = lesson.sedation { engine.sedation = sedation }
        settingsVersion &+= 1
        bloodGases = []
        pendingBloodGasAt = nil
        trend = []
        currentLoop = []
        previousLoop = []
        loopBuffer = []
        trace.clear()
        log = []
        sbtElapsed = nil
        sbtFailureReason = nil
        sbtFinished = false
        sbtPassed = false
        extubation = nil
        selectedParameterID = nil
        pendingValue = nil
        speed = .realtime
        screen = .waveforms
        waveformsFrozen = false
        lessonRuntime = LessonRuntime(lesson: lesson)
        lessonPhase = .task
        lessonFeedback = ""
        lessonVersion &+= 1
        append("学習コース：\(lesson.title)")
    }

    func endLesson() {
        lessonRuntime = nil
        lessonPhase = .task
        lessonFeedback = ""
        lessonVersion &+= 1
    }

    /// 解説を読み終えて次の課題へ。
    func continueLesson() {
        guard lessonPhase == .feedback else { return }
        lessonPhase = .task
        lessonVersion &+= 1
    }

    func answerLesson(_ choice: Int) {
        guard let runtime = lessonRuntime, lessonPhase == .task else { return }
        let result = runtime.answer(choice, lessonContext)
        if result.correct { finishStep(result.explanation ?? "") }
        lessonVersion &+= 1
    }

    private func send(_ event: LessonEvent) {
        guard let runtime = lessonRuntime, lessonPhase == .task else { return }
        if let why = runtime.fire(event, lessonContext) { finishStep(why) }
        lessonVersion &+= 1
    }

    private func advanceLesson(simulated: Double) {
        guard let runtime = lessonRuntime, lessonPhase == .task else { return }
        let before = runtime.index
        if let why = runtime.poll(lessonContext, seconds: simulated) { finishStep(why) }
        if before != runtime.index || runtime.holdFraction > 0 { lessonVersion &+= 1 }
    }

    private func finishStep(_ why: String) {
        guard let runtime = lessonRuntime else { return }
        lessonFeedback = why
        lessonPhase = runtime.finished ? .done : .feedback
        if runtime.finished { celebrate(runtime.lesson) }
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

    /// 抜管。SBT に通っていて離脱条件もほぼ揃っていれば成功、そうでなければ再挿管。
    @discardableResult
    func extubate() -> ExtubationResult {
        let criteria = Weaning.readiness(for: engine)
        let met = criteria.filter(\.met).count
        let result = ExtubationResult(succeeded: sbtPassed && met >= criteria.count - 1,
                                      metCriteria: met, totalCriteria: criteria.count,
                                      passedSBT: sbtPassed)
        extubation = result
        append(result.succeeded ? "抜管（成功）" : "抜管（再挿管）")
        send(.extubate)
        return result
    }

    func beginSBT(mode: VentilationMode) {
        sbtFinished = false
        sbtPassed = false
        engine.settings.mode = mode
        engine.settings.pressureSupport = mode == .pressureSupport ? 5 : 0
        engine.settings.peep = 5
        if engine.sedation > 0.3 { engine.sedation = 0.15 }
        sbtElapsed = 0
        sbtFailureReason = nil
        speed = .fast
        append("SBT 開始")
        send(.startSBT)
    }

    func endSBT() {
        sbtElapsed = nil
        sbtFailureReason = nil
        speed = .realtime
        append("SBT を中止")
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
