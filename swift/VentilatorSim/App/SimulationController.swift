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

    /// 5 Hz で更新する表示用スナップショット。60 fps で View を無効化しないための仕切り。
    private(set) var tickCount: Int = 0

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
    @ObservationIgnored private var displaySync: Double = 0
    @ObservationIgnored private var link: AnyObject?
    @ObservationIgnored private var lastTimestamp: CFTimeInterval = 0

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
        guard speed != .paused else { return }
        let simulated = realSeconds * speed.rawValue
        // 高速再生では刻みを粗くする。指数積分なので結果は変わらない。
        let nominal = speed == .realtime ? 0.005 : 0.01
        let steps = max(1, min(1400, Int((simulated / nominal).rounded(.up))))
        let dt = simulated / Double(steps)

        for _ in 0..<steps {
            engine.step(dt: dt)
            guard speed == .realtime else { continue }
            sampleAccumulator += dt
            if sampleAccumulator >= trace.sampleInterval {
                sampleAccumulator -= trace.sampleInterval
                trace.push(pressure: engine.airwayPressure,
                           flow: engine.flow * 60,
                           volume: (engine.volume - engine.patient.compliance * engine.settings.peep) * 1000)
            }
        }

        updateTimers(simulated: simulated)

        displaySync += realSeconds
        if displaySync >= 0.2 {          // 数値表示は 5 Hz で十分
            displaySync = 0
            tickCount &+= 1
        }
    }

    private func updateTimers(simulated: Double) {
        if let due = pendingBloodGasAt, engine.clock >= due {
            pendingBloodGasAt = nil
            let gas = engine.drawBloodGas()
            bloodGases.append(gas)
            append(String(format: "血液ガス：pH %.2f / PaCO2 %.0f / PaO2 %.0f", gas.pH, gas.paco2, gas.pao2))
            speed = .realtime
        }
        if var elapsed = sbtElapsed {
            elapsed += simulated
            sbtElapsed = elapsed
            if sbtFailureReason == nil,
               let reason = Weaning.failureReason(for: engine, elapsed: elapsed) {
                sbtFailureReason = reason
                speed = .realtime
                append("SBT 中に異常：\(reason)")
            }
        }
    }

    // MARK: - 操作

    func orderBloodGas() {
        guard pendingBloodGasAt == nil else { return }
        pendingBloodGasAt = engine.clock + 120      // 結果が出るまで 2 分待つ
        append("動脈血液ガスを採取")
        if speed.rawValue < 10 { speed = .fast }
    }

    func beginSBT(mode: VentilationMode) {
        engine.settings.mode = mode
        engine.settings.pressureSupport = mode == .pressureSupport ? 5 : 0
        engine.settings.peep = 5
        if engine.sedation > 0.3 { engine.sedation = 0.15 }
        sbtElapsed = 0
        sbtFailureReason = nil
        speed = .fast
        append("SBT 開始")
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
