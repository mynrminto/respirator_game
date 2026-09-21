import Testing
import Foundation
@testable import VentilatorCore

/// 解析解と突き合わせられるものから固める。数値が正しいことがそのまま教材の価値になる。
private func makeEngine(_ scenario: Scenario,
                        mode: VentilationMode = .volumeAssistControl,
                        tidalVolume: Double = 450,
                        rate: Double = 14,
                        peep: Double = 5,
                        fio2: Double = 0.4,
                        flow: Double = 50,
                        pattern: FlowPattern = .decelerating,
                        pause: Double = 0,
                        pressureSupport: Double = 10,
                        inspiratoryPressure: Double = 15,
                        sedation: Double = 1.0) -> VentilatorEngine {
    var s = VentilatorSettings()
    s.mode = mode
    s.tidalVolume = tidalVolume
    s.respiratoryRate = rate
    s.peep = peep
    s.fio2 = fio2
    s.inspiratoryFlow = flow
    s.flowPattern = pattern
    s.inspiratoryPause = pause
    s.pressureSupport = pressureSupport
    s.inspiratoryPressure = inspiratoryPressure
    let engine = VentilatorEngine(patient: scenario.patient, settings: s)
    engine.sedation = sedation
    return engine
}

private func run(_ engine: VentilatorEngine, seconds: Double, dt: Double = 0.005) {
    let steps = Int((seconds / dt).rounded())
    for _ in 0..<steps { engine.step(dt: dt) }
}

@Suite("肺の力学")
struct MechanicsTests {

    @Test("受動呼気は τ = R × C で減衰する")
    func timeConstant() {
        let e = makeEngine(ScenarioLibrary.postoperative,
                           tidalVolume: 500, rate: 10, flow: 60, pattern: .square)
        run(e, seconds: 20)
        while e.phase != .inspiration { e.step(dt: 0.002) }
        while e.phase == .inspiration { e.step(dt: 0.002) }

        let start = e.volume
        let equilibrium = e.patient.compliance * e.settings.peep
        let tau = e.patient.expiratoryTimeConstant
        var t = 0.0
        while t < tau { e.step(dt: 0.002); t += 0.002 }

        let remaining = (e.volume - equilibrium) / (start - equilibrium)
        #expect(abs(remaining - 0.368) < 0.02)
    }

    @Test("プラトー圧から静肺コンプライアンスとドライビング圧が戻る")
    func plateauMechanics() {
        let e = makeEngine(ScenarioLibrary.ards, tidalVolume: 300, rate: 20,
                           peep: 10, flow: 45, pause: 0.4)
        run(e, seconds: 40)
        let measuredC = (e.measured.staticCompliance ?? 0) / 1000
        #expect(abs(measuredC - e.patient.compliance) < e.patient.compliance * 0.06)
        #expect((e.measured.plateauPressure ?? 0) < e.measured.peakPressure)
        let expectedDriving = (e.measured.tidalVolumeExp / 1000) / e.patient.compliance
        #expect(abs((e.measured.drivingPressure ?? 0) - expectedDriving) < 1.0)
    }

    @Test("最高気道内圧とプラトー圧の差に気道抵抗が出る")
    func resistance() {
        let e = makeEngine(ScenarioLibrary.copd, rate: 10, flow: 60,
                           pattern: .square, pause: 0.4)
        run(e, seconds: 60)
        #expect(abs((e.measured.airwayResistance ?? 0) - e.patient.resistanceInsp) < 2.5)
    }

    @Test("呼気時間が足りないと auto-PEEP が出る")
    func autoPEEP() {
        let slow = makeEngine(ScenarioLibrary.copd, rate: 10, flow: 60)
        run(slow, seconds: 120)
        let fast = makeEngine(ScenarioLibrary.copd, rate: 26, flow: 60)
        run(fast, seconds: 120)

        #expect(slow.measured.autoPEEP < 1.5)
        #expect(fast.measured.autoPEEP > 4)
        #expect(fast.measured.tidalVolumeExp > 400)   // 量規定なので換気量は保たれる

        while fast.phase != .expiration { fast.step(dt: 0.002) }
        fast.requestHold(.expiratory)
        run(fast, seconds: 3)
        #expect(fast.measured.totalPEEP > fast.settings.peep + 3)
    }

    @Test("圧規定では肺が硬いほど一回換気量が減る")
    func pressureControl() {
        let normal = makeEngine(ScenarioLibrary.postoperative, mode: .pressureAssistControl)
        run(normal, seconds: 60)
        let stiff = makeEngine(ScenarioLibrary.ards, mode: .pressureAssistControl)
        run(stiff, seconds: 60)
        #expect(stiff.measured.tidalVolumeExp < normal.measured.tidalVolumeExp * 0.75)
    }
}

@Suite("ガス交換")
struct GasExchangeTests {

    @Test("PaCO2 は 0.863 · VCO2 / VA に収束する")
    func alveolarVentilation() {
        let e = makeEngine(ScenarioLibrary.postoperative, rate: 12)
        run(e, seconds: 60 * 45, dt: 0.01)

        let pbw = e.patient.predictedBodyWeight
        let deadSpace = 2.0 * pbw / 1000 + 0.030
            + e.patient.alveolarDeadSpaceFraction * (e.measured.tidalVolumeExp / 1000)
        let va = (e.measured.tidalVolumeExp / 1000 - deadSpace) * e.measured.respiratoryRateTotal
        let expected = 0.863 * e.patient.vco2 * (1 + 0.13 * (e.patient.temperature - 37)) / va
        #expect(abs(e.paco2 - expected) < 2.0)
    }

    @Test("呼吸数を上げると PaCO2 が下がる")
    func minuteVentilation() {
        let e = makeEngine(ScenarioLibrary.postoperative, rate: 12)
        run(e, seconds: 60 * 45, dt: 0.01)
        let before = e.paco2
        e.settings.respiratoryRate = 20
        run(e, seconds: 60 * 30, dt: 0.01)
        #expect(e.paco2 < before - 6)
    }

    @Test("ARDS では PEEP を上げると酸素化が改善し、心拍出量は下がる")
    func peepRecruitment() {
        let low = makeEngine(ScenarioLibrary.ards, tidalVolume: 300, rate: 24,
                             peep: 5, fio2: 0.6, flow: 45)
        run(low, seconds: 60 * 20, dt: 0.01)
        let high = makeEngine(ScenarioLibrary.ards, tidalVolume: 300, rate: 24,
                              peep: 14, fio2: 0.6, flow: 45)
        run(high, seconds: 60 * 20, dt: 0.01)

        #expect(high.pao2 > low.pao2 + 15)
        #expect(high.cardiacOutput < low.cardiacOutput)
        #expect(low.pao2 / low.settings.fio2 < 200)
    }

    @Test("FiO2 を上げると PaO2 が上がる")
    func oxygenResponse() {
        let e = makeEngine(ScenarioLibrary.postoperative, rate: 16, fio2: 0.21)
        run(e, seconds: 60 * 20, dt: 0.01)
        let roomAir = e.pao2
        #expect(roomAir > 60 && roomAir < 110)
        e.settings.fio2 = 1.0
        run(e, seconds: 60 * 12, dt: 0.01)
        #expect(e.pao2 > roomAir + 150)
    }

    @Test("COPD の慢性代償と、急な過換気")
    func chronicCompensation() {
        let e = makeEngine(ScenarioLibrary.copd, rate: 12, fio2: 0.35, flow: 55)
        run(e, seconds: 60 * 20, dt: 0.01)
        #expect(e.pH > 7.28)          // 高 CO2 でも代償されている
        let before = e.pH
        e.settings.respiratoryRate = 24
        run(e, seconds: 60 * 10, dt: 0.01)
        #expect(e.pH > before + 0.05) // 急に換気を増やすとアルカローシスに振れる
    }

    @Test("血液ガスは Henderson-Hasselbalch を満たす")
    func bloodGasConsistency() {
        let e = makeEngine(ScenarioLibrary.ards, tidalVolume: 300, rate: 22,
                           peep: 12, fio2: 0.7, flow: 45)
        run(e, seconds: 60 * 15, dt: 0.01)
        let g = e.drawBloodGas()
        let calculated = Physiology.pH(hco3: g.hco3, paco2: g.paco2)
        #expect(abs(g.pH - calculated) < 0.03)
        #expect(g.pfRatio > 0)
    }
}

@Suite("自発呼吸と離脱")
struct WeaningTests {

    @Test("PSV では患者トリガで呼吸が立つ")
    func patientTriggering() {
        let e = makeEngine(ScenarioLibrary.guillainBarre, mode: .pressureSupport,
                           peep: 5, pressureSupport: 12, sedation: 0.1)
        run(e, seconds: 180)
        #expect(e.measured.respiratoryRateSpontaneous > 4)
        #expect(e.measured.tidalVolumeExp > 150)
        #expect(e.measured.rsbi != nil)
    }

    @Test("筋力の弱い患者は SBT で rapid shallow breathing になる")
    func rapidShallowBreathing() {
        let supported = makeEngine(ScenarioLibrary.guillainBarre, mode: .pressureSupport,
                                   peep: 5, pressureSupport: 14, sedation: 0.1)
        run(supported, seconds: 60 * 10, dt: 0.01)
        let trial = makeEngine(ScenarioLibrary.guillainBarre, mode: .cpap,
                               peep: 5, pressureSupport: 0, sedation: 0.1)
        run(trial, seconds: 60 * 25, dt: 0.01)

        #expect((trial.measured.rsbi ?? 0) > (supported.measured.rsbi ?? 0) + 60)
        #expect(trial.fatigue > 0.2)
        #expect(trial.measured.respiratoryRateTotal > supported.measured.respiratoryRateTotal)
        #expect(Weaning.failureReason(for: trial, elapsed: 60 * 25) != nil)
    }

    @Test("肺も筋力も保たれていれば SBT を通る")
    func successfulTrial() {
        let e = makeEngine(ScenarioLibrary.postoperative, mode: .cpap,
                           peep: 5, pressureSupport: 0, sedation: 0.1)
        run(e, seconds: 60 * 30, dt: 0.01)
        #expect((e.measured.rsbi ?? 999) < 105)
        #expect(e.paco2 < 55)
        #expect(e.fatigue < 0.35)
        #expect(Weaning.failureReason(for: e, elapsed: 60 * 30) == nil)
    }
}

@Suite("数値の性質")
struct NumericsTests {

    @Test("予測体重")
    func predictedBodyWeight() {
        #expect(abs(Physiology.predictedBodyWeight(sex: .male, heightCm: 170) - 66.0) < 0.3)
        #expect(abs(Physiology.predictedBodyWeight(sex: .female, heightCm: 158) - 50.6) < 0.3)
    }

    @Test("刻み幅を変えても結果が変わらない")
    func stepSizeIndependence() {
        let fine = makeEngine(ScenarioLibrary.postoperative)
        run(fine, seconds: 60 * 10, dt: 0.005)
        let coarse = makeEngine(ScenarioLibrary.postoperative)
        run(coarse, seconds: 60 * 10, dt: 0.012)
        #expect(abs(fine.paco2 - coarse.paco2) < 1.0)
        #expect(abs(fine.measured.tidalVolumeExp - coarse.measured.tidalVolumeExp) < 15)
    }
}

@Suite("ポーズ操作のタイミング")
struct HoldTimingTests {
    /// 呼気の途中で吸気ポーズを押しても、実行されるのは次の吸気末でなければならない。
    /// 押した瞬間に止めると、プラトー圧として呼気末の圧を読んでしまう。
    @Test("吸気ポーズは次の吸気末で実行される")
    func inspiratoryHoldWaitsForEndInspiration() {
        let scenario = ScenarioLibrary.all[0]
        let engine = makeEngine(scenario, rate: 12)
        run(engine, seconds: 20)
        engine.requestHold(.inspiratory)
        run(engine, seconds: 12)

        let plateau = engine.measured.plateauPressure ?? 0
        #expect(plateau > engine.measured.totalPEEP + 4)
        let compliance = engine.measured.staticCompliance ?? 0
        #expect(abs(compliance - scenario.patient.compliance * 1000) < 6)
    }

    @Test("呼気ポーズで auto-PEEP が検出され、その後も換気が続く")
    func expiratoryHoldMeasuresAutoPEEP() {
        let scenario = ScenarioLibrary.all.first { $0.id == "copd" }!
        let engine = makeEngine(scenario, rate: 20, flow: 45)
        run(engine, seconds: 60)
        engine.requestHold(.expiratory)
        run(engine, seconds: 14)
        #expect(engine.measured.autoPEEP > 0.5)

        run(engine, seconds: 30)
        #expect(engine.measured.tidalVolumeExp > 300)
    }
}
