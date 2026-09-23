import Testing
import Foundation
@testable import VentilatorCore

/* web/test.js と同じ項目を同じ順で確かめる。片方を直したらもう片方も直すこと。
 * 症例はすべて小児なので、設定値は体重 1.1 kg〜35 kg の幅に合わせてある。 */

private func scen(_ id: String) -> Scenario {
    ScenarioLibrary.all.first { $0.id == id }!
}

/// 症例の推奨初期設定から engine を作り、必要な分だけ上書きする。
private func makeEngine(_ id: String,
                        sedation: Double? = nil,
                        _ override: (inout VentilatorSettings) -> Void = { _ in }) -> VentilatorEngine {
    let sc = scen(id)
    var s = sc.initialSettings()
    override(&s)
    let engine = VentilatorEngine(patient: sc.patient, settings: s)
    if let sedation { engine.sedation = sedation }
    return engine
}

private func run(_ engine: VentilatorEngine, seconds: Double, dt: Double = 0.005) {
    let steps = Int((seconds / dt).rounded())
    for _ in 0..<steps { engine.step(dt: dt) }
}

/// 呼気ポーズを次の呼気末で実行し、総 PEEP を測り終えるまで進める。
private func expiratoryPause(_ e: VentilatorEngine) {
    while e.phase != .inspiration { e.step(dt: 0.002) }
    e.requestHold(.expiratory)
    run(e, seconds: 14)
}

@Suite("肺の力学")
struct MechanicsTests {

    @Test("受動呼気は τ = R × C で減衰する（学童）")
    func timeConstant() {
        let e = makeEngine("postop", sedation: 1.0) {
            $0.mode = .volumeAssistControl
            $0.tidalVolume = 180; $0.respiratoryRate = 10; $0.peep = 5
            $0.inspiratoryFlow = 24; $0.flowPattern = .square
        }
        run(e, seconds: 20)
        while e.phase != .inspiration { e.step(dt: 0.002) }
        while e.phase == .inspiration { e.step(dt: 0.002) }

        let start = e.volume
        let equilibrium = e.patient.compliance * e.settings.peep
        let tau = e.patient.expiratoryTimeConstant
        var t = 0.0
        while t < tau { e.step(dt: 0.002); t += 0.002 }
        #expect(abs((e.volume - equilibrium) / (start - equilibrium) - 0.368) < 0.02)
    }

    /// 早産児は τ が 0.05 秒と桁違いに短い。固定刻みの積分でもここが崩れないこと。
    @Test("早産児（τ 0.05 秒）でも同じ")
    func timeConstantNeonate() {
        let e = makeEngine("rds", sedation: 1.0) {
            $0.mode = .volumeAssistControl
            $0.tidalVolume = 6; $0.respiratoryRate = 40; $0.peep = 5
            $0.inspiratoryFlow = 2; $0.flowPattern = .square
        }
        run(e, seconds: 20)
        while e.phase != .inspiration { e.step(dt: 0.0005) }
        while e.phase == .inspiration { e.step(dt: 0.0005) }

        let start = e.volume
        let equilibrium = e.patient.compliance * e.settings.peep
        let tau = e.patient.expiratoryTimeConstant
        var t = 0.0
        while t < tau { e.step(dt: 0.0005); t += 0.0005 }
        #expect(abs((e.volume - equilibrium) / (start - equilibrium) - 0.368) < 0.03)
    }

    @Test("プラトー圧から静肺コンプライアンスとドライビング圧が戻る")
    func plateauMechanics() {
        let e = makeEngine("ards", sedation: 1.0) { $0.inspiratoryPause = 0.4 }
        run(e, seconds: 40)
        let measuredC = (e.measured.staticCompliance ?? 0) / 1000
        #expect(abs(measuredC - e.patient.compliance) < e.patient.compliance * 0.06)
        #expect((e.measured.plateauPressure ?? 0) < e.measured.peakPressure)
        let expectedDriving = (e.measured.tidalVolumeExp / 1000) / e.patient.compliance
        #expect(abs((e.measured.drivingPressure ?? 0) - expectedDriving) < 1.0)
    }

    /// 体重 1.1 kg では Vt も圧も桁が小さい。0 割りや打ち切りで nil にならないこと。
    @Test("早産児でも Cstat が計算される")
    func neonatalCompliance() {
        let e = makeEngine("rds", sedation: 1.0) { $0.inspiratoryPause = 0.2 }
        run(e, seconds: 60)
        let c = e.measured.staticCompliance
        #expect(c != nil)
        #expect(abs((c ?? 0) / 1000 - e.patient.compliance) < e.patient.compliance * 0.10)
    }

    @Test("最高気道内圧とプラトー圧の差に気道抵抗が出る")
    func resistance() {
        let e = makeEngine("bronchiolitis", sedation: 1.0) {
            $0.respiratoryRate = 20; $0.flowPattern = .square; $0.inspiratoryPause = 0.4
        }
        run(e, seconds: 60)
        let raw = e.measured.airwayResistance ?? 0
        #expect(abs(raw - e.patient.resistanceInsp) < e.patient.resistanceInsp * 0.12)
        // 細い気管チューブと細気管支炎で、抵抗は成人の桁（5〜10）を大きく超える。
        #expect(raw > 40)
    }

    @Test("呼気時間が足りないと auto-PEEP が出る（細気管支炎の乳児）")
    func autoPEEP() {
        let slow = makeEngine("bronchiolitis", sedation: 1.0) {
            $0.tidalVolume = 45; $0.respiratoryRate = 20; $0.peep = 6; $0.inspiratoryFlow = 6
        }
        run(slow, seconds: 180)
        let fast = makeEngine("bronchiolitis", sedation: 1.0) {
            $0.tidalVolume = 45; $0.respiratoryRate = 45; $0.peep = 6; $0.inspiratoryFlow = 6
        }
        run(fast, seconds: 180)

        #expect(slow.measured.autoPEEP < 1.5)
        #expect(fast.measured.autoPEEP > 3)
        #expect(fast.measured.tidalVolumeExp > 40)   // 量規定なので換気量は保たれる

        expiratoryPause(fast)
        #expect(fast.measured.totalPEEP > fast.settings.peep + 2)
    }

    @Test("圧規定では肺が硬いほど一回換気量が減る")
    func pressureControl() {
        let normal = makeEngine("postop", sedation: 1.0) {
            $0.mode = .pressureAssistControl
            $0.inspiratoryPressure = 12; $0.inspiratoryTime = 0.7
            $0.respiratoryRate = 20; $0.peep = 5
        }
        run(normal, seconds: 60)
        let stiff = makeEngine("ards", sedation: 1.0) {
            $0.mode = .pressureAssistControl
            $0.inspiratoryPressure = 12; $0.inspiratoryTime = 0.7
            $0.respiratoryRate = 20; $0.peep = 5
        }
        run(stiff, seconds: 60)
        // 同じ体重あたりで比べる
        let a = normal.measured.tidalVolumeExp / normal.patient.predictedBodyWeight
        let b = stiff.measured.tidalVolumeExp / stiff.patient.predictedBodyWeight
        #expect(b < a * 0.75)
    }
}

@Suite("ガス交換")
struct GasExchangeTests {

    @Test("PaCO2 は 0.863 · VCO2 / VA に収束する")
    func alveolarVentilation() {
        let e = makeEngine("postop", sedation: 1.0) {
            $0.tidalVolume = 150; $0.respiratoryRate = 18; $0.peep = 5
            $0.fio2 = 0.4; $0.inspiratoryFlow = 20
        }
        run(e, seconds: 60 * 45, dt: 0.01)

        let p = e.patient
        let deadSpace = 2.0 * p.predictedBodyWeight / 1000 + p.circuitDeadSpace / 1000
            + p.alveolarDeadSpaceFraction * (e.measured.tidalVolumeExp / 1000)
        let va = (e.measured.tidalVolumeExp / 1000 - deadSpace) * e.measured.respiratoryRateTotal
        let expected = 0.863 * p.vco2 * (1 + 0.13 * (p.temperature - 37)) / va
        #expect(abs(e.paco2 - expected) < 2.0)
    }

    @Test("呼吸数を上げると PaCO2 が下がる")
    func minuteVentilation() {
        let e = makeEngine("postop", sedation: 1.0) {
            $0.tidalVolume = 150; $0.respiratoryRate = 16; $0.inspiratoryFlow = 20
        }
        run(e, seconds: 60 * 45, dt: 0.01)
        let before = e.paco2
        e.settings.respiratoryRate = 26
        run(e, seconds: 60 * 30, dt: 0.01)
        #expect(e.paco2 < before - 5)
    }

    @Test("小児 ARDS では PEEP を上げると酸素化が改善し、心拍出量は下がる")
    func peepRecruitment() {
        let lo = makeEngine("ards", sedation: 1.0) { $0.peep = 5; $0.fio2 = 0.6 }
        run(lo, seconds: 60 * 20, dt: 0.01)
        let hi = makeEngine("ards", sedation: 1.0) { $0.peep = 14; $0.fio2 = 0.6 }
        run(hi, seconds: 60 * 20, dt: 0.01)

        #expect(hi.pao2 > lo.pao2 + 15)
        #expect(hi.cardiacOutput < lo.cardiacOutput)
        #expect(lo.pao2 / lo.settings.fio2 < 200)
    }

    @Test("FiO2 を上げると PaO2 が上がる")
    func oxygenResponse() {
        let e = makeEngine("postop", sedation: 1.0) { $0.fio2 = 0.21 }
        run(e, seconds: 60 * 20, dt: 0.01)
        let roomAir = e.pao2
        #expect(roomAir > 60 && roomAir < 110)
        e.settings.fio2 = 1.0
        run(e, seconds: 60 * 12, dt: 0.01)
        #expect(e.pao2 > roomAir + 150)
    }

    @Test("肺胞 PO2 は釣り合えば肺胞気式に一致し、換気が落ちると SpO2 が CO2 より先に動く")
    func alveolarOxygenStore() {
        let e = makeEngine("postop", sedation: 1.0) {
            $0.tidalVolume = 180; $0.respiratoryRate = 20; $0.peep = 5
            $0.fio2 = 0.21; $0.inspiratoryFlow = 24
        }
        run(e, seconds: 60 * 15, dt: 0.01)
        let equation = Physiology.alveolarPO2(fio2: 0.21, paco2: e.paco2)
        #expect(abs(e.alveolarPO2 - equation) < 3)
        let spo2Before = e.spo2, paco2Before = e.paco2
        e.settings.tidalVolume = 50; e.settings.respiratoryRate = 10
        run(e, seconds: 60, dt: 0.01)
        #expect(e.spo2 < spo2Before - 8)
        #expect(e.paco2 - paco2Before < 20 && e.paco2 - paco2Before > 5)
        // Vt が死腔と同じくらいだと、吐き終わりに肺胞のガスが届かず etCO2 は低く出る
        #expect(e.etco2 < e.paco2 * 0.4)
        // 学童でも重い低酸素が続くと徐脈になり、血圧が落ちる
        run(e, seconds: 150, dt: 0.01)
        #expect(e.heartRate < e.norms.heartRate.lowerBound * 0.5)
        #expect(e.meanArterialPressure < e.norms.meanArterialPressureMin)
        #expect(e.alarms.contains { $0.message == "徐脈" })
        // 換気と酸素を戻せば戻る
        e.settings.tidalVolume = 180; e.settings.respiratoryRate = 20; e.settings.fio2 = 1.0
        run(e, seconds: 180, dt: 0.01)
        #expect(e.spo2 > 95)
        #expect(e.heartRate > e.norms.heartRate.lowerBound)
        #expect(e.meanArterialPressure > e.norms.meanArterialPressureMin - 5)
    }

    @Test("血液ガスは Henderson-Hasselbalch を満たす")
    func bloodGasConsistency() {
        let e = makeEngine("ards", sedation: 1.0) { $0.peep = 12; $0.fio2 = 0.7 }
        run(e, seconds: 60 * 15, dt: 0.01)
        let g = e.drawBloodGas()
        #expect(abs(g.pH - Physiology.pH(hco3: g.hco3, paco2: g.paco2)) < 0.03)
        #expect(g.pfRatio > 0)
    }

    @Test("細気管支炎の許容的高炭酸ガス血症")
    func permissiveHypercapnia() {
        let e = makeEngine("bronchiolitis", sedation: 1.0) {
            $0.tidalVolume = 45; $0.respiratoryRate = 25; $0.peep = 6
            $0.fio2 = 0.5; $0.inspiratoryFlow = 6
        }
        run(e, seconds: 60 * 25, dt: 0.01)
        #expect(e.pH >= 7.20 && e.paco2 > 55)

        let before = e.pH
        e.settings.respiratoryRate = 35
        run(e, seconds: 60 * 15, dt: 0.01)
        #expect(e.pH > before + 0.05)
        expiratoryPause(e)
        #expect(e.measured.autoPEEP > 1.5)   // 換気を増やした代償
    }
}

@Suite("自発呼吸と離脱")
struct WeaningTests {

    @Test("PSV では患者トリガで呼吸が立つ")
    func patientTriggering() {
        let e = makeEngine("gbs", sedation: 0.1) {
            $0.mode = .pressureSupport
            $0.pressureSupport = 12; $0.peep = 5; $0.fio2 = 0.4; $0.triggerFlow = 1.0
        }
        run(e, seconds: 180)
        #expect(e.measured.respiratoryRateSpontaneous > 5)
        #expect(e.measured.tidalVolumeExp > 60)
        #expect((e.measured.rsbiPerKg ?? 0) > 0)
    }

    @Test("筋力の弱い児は SBT で浅く速い呼吸になる")
    func rapidShallowBreathing() {
        let supported = makeEngine("gbs", sedation: 0.1) {
            $0.mode = .pressureSupport
            $0.pressureSupport = 14; $0.peep = 5; $0.fio2 = 0.4
        }
        run(supported, seconds: 60 * 10, dt: 0.01)
        let trial = makeEngine("gbs", sedation: 0.1) {
            $0.mode = .cpap
            $0.pressureSupport = 0; $0.peep = 5; $0.fio2 = 0.4
        }
        run(trial, seconds: 60 * 25, dt: 0.01)

        #expect((trial.measured.rsbiPerKg ?? 0) > (supported.measured.rsbiPerKg ?? 0) + 3)
        #expect(trial.fatigue > 0.2)
        #expect(trial.measured.respiratoryRateTotal > supported.measured.respiratoryRateTotal)
        #expect(Weaning.failureReason(for: trial, elapsed: 60 * 25) != nil)
    }

    @Test("肺が正常な児は SBT を通る")
    func successfulTrial() {
        let e = makeEngine("postop", sedation: 0.1) {
            $0.mode = .cpap
            $0.pressureSupport = 0; $0.peep = 5; $0.fio2 = 0.4
        }
        run(e, seconds: 60 * 30, dt: 0.01)
        // 成人の RSBI 105 ではなく、体重あたりの f/VT 8 で見る。
        #expect((e.measured.rsbiPerKg ?? 999) < 8)
        #expect(e.paco2 < 55)
        #expect(e.fatigue < 0.35)
        #expect(Weaning.failureReason(for: e, elapsed: 60 * 30) == nil)
    }
}

@Suite("体重と年齢別の基準値")
struct AgeNormsTests {

    @Test("設定の基準は実体重")
    func bodyWeight() {
        #expect(scen("ards").patient.predictedBodyWeight == 14)
        #expect(scen("rds").patient.predictedBodyWeight == 1.1)
        // 成人式も残してある（身長からの予測体重）。
        #expect(abs(Physiology.predictedBodyWeight(sex: .male, heightCm: 170) - 66.0) < 0.3)
    }

    @Test("年齢帯ごとの正常値")
    func norms() {
        let nn = Physiology.ageNorms(ageMonths: 0)
        let inf = Physiology.ageNorms(ageMonths: 4)
        let sch = Physiology.ageNorms(ageMonths: 96)
        #expect(nn.respiratoryRate.lowerBound == 40 && nn.respiratoryRate.upperBound == 60)
        #expect(inf.respiratoryRate.upperBound > sch.respiratoryRate.upperBound)
        #expect(nn.meanArterialPressureMin <= 35 && nn.meanArterialPressureMin >= 28)
        #expect(nn.plateauMax < sch.plateauMax)
        #expect(nn.spo2Target.upperBound == 95)   // 未熟児網膜症があるので上限も切る
    }

    @Test("推奨初期設定がすべてダイヤルの範囲内")
    func suggestedWithinDialRange() {
        var outOfRange: [String] = []
        for sc in ScenarioLibrary.all {
            let l = Physiology.dialLimits(weightKg: sc.patient.predictedBodyWeight,
                                          norms: sc.patient.norms)
            let g = sc.suggested
            func chk(_ name: String, _ v: Double, _ r: DialRange) {
                if v < r.min || v > r.max { outOfRange.append("\(sc.id):\(name)=\(v)") }
            }
            chk("vt", g.tidalVolume, l.tidalVolume)
            chk("rr", g.respiratoryRate, l.respiratoryRate)
            chk("ti", g.inspiratoryTime, l.inspiratoryTime)
            chk("flow", g.inspiratoryFlow, l.inspiratoryFlow)
            chk("pinsp", g.inspiratoryPressure, l.inspiratoryPressure)
            chk("ps", g.pressureSupport, l.pressureSupport)
            chk("trig", g.triggerFlow, l.trigger)
        }
        #expect(outOfRange.isEmpty, "\(outOfRange)")
    }

    @Test("アラーム初期値が設定値を挟んでいる")
    func alarmBrackets() {
        var bad: [String] = []
        for sc in ScenarioLibrary.all {
            let g = sc.suggested
            let a = AlarmLimits.forWeight(sc.patient.predictedBodyWeight, norms: sc.patient.norms,
                                          tidalVolume: g.tidalVolume,
                                          respiratoryRate: g.respiratoryRate)
            if !(a.tidalVolumeLow < g.tidalVolume && g.tidalVolume < a.tidalVolumeHigh) {
                bad.append(sc.id + ":vt")
            }
            let mv = g.tidalVolume / 1000 * g.respiratoryRate
            if !(a.minuteVolumeLow < mv && mv < a.minuteVolumeHigh) { bad.append(sc.id + ":mv") }
            if !(a.peakPressure > 20 && a.peakPressure < 45) { bad.append(sc.id + ":pMax") }
        }
        #expect(bad.isEmpty, "\(bad)")
    }
}

@Suite("症例が意図した状態で始まる")
struct ScenarioStartTests {

    /// 推奨初期設定で始めたとき、どの症例も臨床的にありうる状態に落ち着くこと。
    /// ここが崩れると、教材としてどのレッスンも成立しなくなる。
    struct Expectation {
        let tidalPerKg: ClosedRange<Double>
        let pH: ClosedRange<Double>
    }

    static let expected: [String: Expectation] = [
        "postop":        .init(tidalPerKg: 6.5...7.5, pH: 7.33...7.46),
        "rds":           .init(tidalPerKg: 4.0...6.0, pH: 7.20...7.42),
        "bronchiolitis": .init(tidalPerKg: 6.5...8.0, pH: 7.18...7.42),
        "ards":          .init(tidalPerKg: 5.5...6.5, pH: 7.18...7.45),
        "asthma":        .init(tidalPerKg: 6.5...7.8, pH: 7.10...7.30),
        "gbs":           .init(tidalPerKg: 6.5...7.6, pH: 7.32...7.48)
    ]

    @Test("推奨初期設定で 15 分後の状態", arguments: ScenarioLibrary.all.map(\.id))
    func startingState(id: String) {
        let want = Self.expected[id]!
        let e = makeEngine(id)
        run(e, seconds: 60 * 15, dt: 0.01)

        let perKg = e.measured.tidalVolumeExp / e.patient.predictedBodyWeight
        #expect(want.tidalPerKg.contains(perKg), "\(id): \(perKg) mL/kg")
        #expect(want.pH.contains(e.pH), "\(id): pH \(e.pH) PaCO2 \(e.paco2)")

        let nm = e.norms
        #expect(e.measured.respiratoryRateTotal >= nm.respiratoryRate.lowerBound * 0.5
                && e.measured.respiratoryRateTotal <= nm.respiratoryRateMax,
                "\(id): RR \(e.measured.respiratoryRateTotal)")
        #expect(e.heartRate > nm.heartRate.lowerBound * 0.6
                && e.heartRate < nm.heartRate.upperBound * 1.5
                && e.meanArterialPressure > 20 && e.meanArterialPressure < 110,
                "\(id): HR \(e.heartRate) MAP \(e.meanArterialPressure)")
    }
}

@Suite("数値の性質")
struct NumericsTests {

    @Test("刻み幅を変えても結果が変わらない")
    func stepSizeIndependence() {
        let fine = makeEngine("postop", sedation: 1.0)
        run(fine, seconds: 60 * 10, dt: 0.005)
        let coarse = makeEngine("postop", sedation: 1.0)
        run(coarse, seconds: 60 * 10, dt: 0.012)
        #expect(abs(fine.paco2 - coarse.paco2) < 1.0)
        #expect(abs(fine.measured.tidalVolumeExp - coarse.measured.tidalVolumeExp) < 8)
    }
}

@Suite("ポーズ操作のタイミング")
struct HoldTimingTests {
    /// 呼気の途中で吸気ポーズを押しても、実行されるのは次の吸気末でなければならない。
    /// 押した瞬間に止めると、プラトー圧として呼気末の圧を読んでしまう。
    @Test("吸気ポーズは次の吸気末で実行される")
    func inspiratoryHoldWaitsForEndInspiration() {
        let e = makeEngine("postop", sedation: 1.0) { $0.respiratoryRate = 18 }
        run(e, seconds: 20)
        while e.phase != .expiration { e.step(dt: 0.002) }
        e.requestHold(.inspiratory)
        #expect(e.activeHold == nil && e.awaitingHold == .inspiratory)

        run(e, seconds: 12)
        let plateau = e.measured.plateauPressure ?? 0
        #expect(plateau > e.measured.totalPEEP + 4)
        let compliance = e.measured.staticCompliance ?? 0
        #expect(abs(compliance / 1000 - e.patient.compliance) < e.patient.compliance * 0.06)
    }

    @Test("呼気ポーズで auto-PEEP が検出され、その後も換気が続く")
    func expiratoryHoldMeasuresAutoPEEP() {
        let e = makeEngine("bronchiolitis", sedation: 1.0) {
            $0.tidalVolume = 45; $0.respiratoryRate = 40; $0.peep = 6; $0.inspiratoryFlow = 6
        }
        run(e, seconds: 60)
        while e.phase != .inspiration { e.step(dt: 0.002) }
        e.requestHold(.expiratory)
        #expect(e.activeHold == nil)

        run(e, seconds: 14)
        #expect(e.measured.autoPEEP > 0.5)
        run(e, seconds: 30)
        #expect(e.measured.tidalVolumeExp > 35)
    }
}
