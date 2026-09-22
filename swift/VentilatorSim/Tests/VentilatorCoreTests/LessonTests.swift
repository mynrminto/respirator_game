import Testing
import Foundation
@testable import VentilatorCore

/// 学習コースの検証。web/test.js の「10〜12」と同じ内容を Swift でも通す。
/// 教材は数字が合っていることが価値なので、目標値が本当に到達できるかまで見る。

private func makeEngine(for lesson: Lesson, sedation: Double = 1.0,
                        override: ((inout VentilatorSettings) -> Void)? = nil) -> VentilatorEngine {
    // アプリと同じ順で組む。症例の推奨設定 → レッスンの上書き → 体重からのアラーム。
    let patient = lesson.scenario.patient
    var settings = lesson.scenario.initialSettings()
    lesson.prepare(&settings)
    override?(&settings)
    settings.alarms = .forWeight(patient.predictedBodyWeight, norms: patient.norms,
                                 tidalVolume: settings.tidalVolume,
                                 respiratoryRate: settings.respiratoryRate)
    let engine = VentilatorEngine(patient: patient, settings: settings)
    engine.sedation = sedation
    return engine
}

private func advance(_ engine: VentilatorEngine, seconds: Double, dt: Double = 0.005) {
    let steps = Int((seconds / dt).rounded())
    for _ in 0..<steps { engine.step(dt: dt) }
}

private func context(_ engine: VentilatorEngine, memory: LessonMemory,
                     gases: [BloodGas] = [], sbt: SBTState = SBTState(),
                     extubated: Bool = false) -> LessonContext {
    LessonContext(engine: engine, bloodGases: gases, sbt: sbt,
                  extubated: extubated, memory: memory)
}

@Suite("学習コースの構造")
struct LessonStructureTests {

    @Test("6 章 19 レッスンあり、ID が重複しない")
    func inventory() {
        #expect(LessonLibrary.chapters.count == 6)
        #expect(LessonLibrary.all.count == 19)
        let ids = LessonLibrary.all.map(\.id)
        #expect(Set(ids).count == ids.count)
    }

    @Test("すべて実在の症例を指している")
    func scenariosExist() {
        let known = Set(ScenarioLibrary.all.map(\.id))
        for lesson in LessonLibrary.all {
            #expect(known.contains(lesson.scenarioID), "\(lesson.id) の症例 \(lesson.scenarioID)")
        }
    }

    @Test("解説・要点・課題がそろっている")
    func contentPresent() {
        for lesson in LessonLibrary.all {
            #expect(!lesson.brief.isEmpty, "\(lesson.id)")
            #expect(!lesson.points.isEmpty, "\(lesson.id)")
            #expect(!lesson.tasks.isEmpty, "\(lesson.id)")
        }
    }

    @Test("クイズの正解番号と選択肢が妥当")
    func quizzesValid() {
        for lesson in LessonLibrary.all {
            for quiz in lesson.tasks.compactMap(\.quiz) {
                #expect(quiz.choices.count >= 2, "\(lesson.id)")
                #expect(quiz.answer >= 0 && quiz.answer < quiz.choices.count, "\(lesson.id)")
                #expect(Set(quiz.choices).count == quiz.choices.count, "\(lesson.id) 選択肢の重複")
                #expect(!quiz.explanation.isEmpty, "\(lesson.id) 解説なし")
            }
        }
    }

    @Test("章のたどり方が一貫している")
    func navigation() {
        for lesson in LessonLibrary.all {
            #expect(LessonLibrary.chapter(of: lesson.id) != nil, "\(lesson.id)")
            #expect(LessonLibrary.lesson(id: lesson.id)?.id == lesson.id)
        }
        #expect(LessonLibrary.next(after: LessonLibrary.all.last!.id) == nil)
        #expect(LessonLibrary.next(after: "1-1")?.id == "1-2")
    }

    @Test("6 mL/kg の目標がダイヤルの範囲に収まる")
    func protectiveTargetsReachable() {
        // ダイヤルの可動域は体重ごとに違う。早産児の 6 mL/kg は 6.6 mL しかない。
        for id in ["2-1", "3-1", "4-4"] {
            let lesson = LessonLibrary.lesson(id: id)!
            let p = lesson.scenario.patient
            let r = Physiology.dialLimits(weightKg: p.predictedBodyWeight, norms: p.norms).tidalVolume
            let target = LessonLibrary.protectiveTidal(p.predictedBodyWeight)
            #expect(target >= r.min && target <= r.max,
                    "\(id) の目標 \(target) mL（範囲 \(r.min)〜\(r.max)）")
        }
    }

    /// レッスンが決め打ちする初期設定も、その症例のダイヤルの可動域に収まっていること。
    @Test("レッスンの初期設定がすべてダイヤルの範囲内")
    func lessonSettingsWithinDialRange() {
        var outside: [String] = []
        for lesson in LessonLibrary.all {
            let p = lesson.scenario.patient
            let l = Physiology.dialLimits(weightKg: p.predictedBodyWeight, norms: p.norms)
            var s = lesson.scenario.initialSettings()
            lesson.prepare(&s)
            func chk(_ name: String, _ v: Double, _ r: DialRange) {
                if v < r.min || v > r.max { outside.append("\(lesson.id):\(name)=\(v)") }
            }
            chk("vt", s.tidalVolume, l.tidalVolume)
            chk("rr", s.respiratoryRate, l.respiratoryRate)
            chk("flow", s.inspiratoryFlow, l.inspiratoryFlow)
            chk("pause", s.inspiratoryPause, l.inspiratoryPause)
            chk("trig", s.triggerFlow, l.trigger)
        }
        #expect(outside.isEmpty, "\(outside)")
    }
}

@Suite("レッスンの進行")
struct LessonRuntimeTests {

    @Test("イベント・待機・クイズが順に進む")
    func progression() {
        let lesson = LessonLibrary.lesson(id: "1-2")!
        let engine = makeEngine(for: lesson)
        let runtime = LessonRuntime(lesson: lesson)
        let ctx = { context(engine, memory: runtime.memory) }

        // 1 番目：吸気ポーズのキー
        #expect(runtime.fire(.expiratoryHold, ctx()) == nil)
        #expect(runtime.index == 0)
        #expect(runtime.fire(.inspiratoryHold, ctx()) != nil)
        #expect(runtime.index == 1)

        // 2 番目：測定が終わるまで進まない
        engine.requestHold(.inspiratory)
        #expect(runtime.poll(ctx(), seconds: 0.5) == nil)
        advance(engine, seconds: 14)
        #expect(runtime.poll(ctx(), seconds: 0.5) != nil)
        #expect(runtime.index == 2)

        // 3 番目：クイズ。誤答では進まない。
        let quiz = runtime.task?.quiz
        #expect(quiz != nil)
        let wrong = (quiz!.answer + 1) % quiz!.choices.count
        let bad = runtime.answer(wrong, ctx())
        #expect(bad.correct == false)
        #expect(runtime.index == 2)
        #expect(runtime.lastAnswerWasWrong)

        let good = runtime.answer(quiz!.answer, ctx())
        #expect(good.correct)
        #expect(good.explanation?.isEmpty == false)
        #expect(runtime.index == 3)
        #expect(runtime.wrongAnswers == 1)
    }

    @Test("hold 付きの課題は保ち続けた時間で進む")
    func holdTasks() {
        let lesson = LessonLibrary.lesson(id: "2-2")!
        let engine = makeEngine(for: lesson)
        let runtime = LessonRuntime(lesson: lesson)
        engine.settings.respiratoryRate = 24
        advance(engine, seconds: 90)
        let ctx = { context(engine, memory: runtime.memory) }
        #expect(engine.measured.minuteVolume >= 3.0 && engine.measured.minuteVolume <= 4.2)
        #expect(runtime.poll(ctx(), seconds: 5) == nil)     // まだ 30 秒に足りない
        #expect(runtime.poll(ctx(), seconds: 30) != nil)
        #expect(runtime.index == 1)
    }

    @Test("最後の課題を終えると finished になる")
    func finishes() {
        let lesson = LessonLibrary.lesson(id: "5-3")!
        let engine = makeEngine(for: lesson)
        let runtime = LessonRuntime(lesson: lesson)
        let ctx = { context(engine, memory: runtime.memory) }
        runtime.fire(.oxygenFlush, ctx())
        for _ in 0..<3 {
            guard let quiz = runtime.task?.quiz else { break }
            runtime.answer(quiz.answer, ctx())
        }
        #expect(runtime.finished)
        #expect(runtime.task == nil)
    }
}

@Suite("レッスンが起こす病態")
struct LessonScenarioTests {

    @Test("5-1：痰づまりで PIP だけが上がり、上限圧アラームが鳴る")
    func obstruction() {
        let lesson = LessonLibrary.lesson(id: "5-1")!
        let engine = makeEngine(for: lesson)
        let runtime = LessonRuntime(lesson: lesson)
        let ctx = { context(engine, memory: runtime.memory) }
        advance(engine, seconds: 40)

        runtime.poll(ctx(), seconds: 1)                 // 1 番目：平常時を記録
        let basePeak = runtime.memory["pip0"] ?? 0
        let basePlateau = runtime.memory["plat0"] ?? 0
        #expect(basePeak > 0)

        let before = engine.airwayResistance.inspiratory
        runtime.poll(ctx(), seconds: 1)                 // 2 番目に入ると onStart が発火する
        #expect(engine.airwayResistance.inspiratory > before * 4)

        advance(engine, seconds: 30)
        #expect(engine.measured.peakPressure > basePeak + 8)
        #expect(abs((engine.measured.plateauPressure ?? 0) - basePlateau) < 3)
        #expect(engine.alarms.contains { $0.message.contains("気道内圧") })
    }

    @Test("5-2：細気管支炎に auto-PEEP が出て、呼吸回数を下げれば消える")
    func autoPEEP() {
        let lesson = LessonLibrary.lesson(id: "5-2")!

        let bad = makeEngine(for: lesson)
        advance(bad, seconds: 120)
        while bad.phase != .inspiration { bad.step(dt: 0.005) }
        bad.requestHold(.expiratory)
        advance(bad, seconds: 14)
        #expect(bad.measured.autoPEEP > 3)

        let good = makeEngine(for: lesson) { $0.respiratoryRate = 22 }
        advance(good, seconds: 180)
        while good.phase != .inspiration { good.step(dt: 0.005) }
        good.requestHold(.expiratory)
        advance(good, seconds: 14)
        #expect(good.measured.autoPEEP < 3)
    }

    @Test("4-3：ARDS で PEEP を上げると P/F が改善する")
    func peepImprovesOxygenation() {
        let lesson = LessonLibrary.lesson(id: "4-3")!
        let low = makeEngine(for: lesson)
        advance(low, seconds: 900, dt: 0.01)
        let pfLow = low.pao2 / low.settings.fio2

        let high = makeEngine(for: lesson) { $0.peep = 14 }
        advance(high, seconds: 900, dt: 0.01)
        let pfHigh = high.pao2 / high.settings.fio2
        #expect(pfHigh > pfLow + 20)

        // 課題どおり FiO2 60% まで下げても SpO2 92% 以上を保てること
        high.settings.fio2 = 0.6
        advance(high, seconds: 300, dt: 0.01)
        #expect(high.spo2 >= 92)
    }

    @Test("4-4：6 mL/kg なら年齢相応の Pplat・ΔP に収まる")
    func lungProtectiveTargetFits() {
        let lesson = LessonLibrary.lesson(id: "4-4")!
        let pbw = lesson.scenario.patient.predictedBodyWeight
        let target = (LessonLibrary.protectiveTidal(pbw) / 5).rounded() * 5
        let e = makeEngine(for: lesson) { $0.tidalVolume = target; $0.inspiratoryPause = 0.3 }
        advance(e, seconds: 180)
        #expect((e.measured.plateauPressure ?? 99) <= e.norms.plateauMax)
        #expect((e.measured.drivingPressure ?? 99) <= e.norms.drivingPressureMax)

        // 課題どおり Vt を触らず、呼吸回数だけで pH 7.25 以上に届くこと
        let byRate = makeEngine(for: lesson) { $0.tidalVolume = target; $0.respiratoryRate = 40 }
        advance(byRate, seconds: 60 * 30, dt: 0.01)
        #expect(byRate.pH >= 7.25, "pH \(byRate.pH) PaCO2 \(byRate.paco2)")
    }

    @Test("4-2：低換気から MV を増やすと PaCO2 が目標域に入る")
    func minuteVolumeMovesCO2() {
        let lesson = LessonLibrary.lesson(id: "4-2")!
        let e = makeEngine(for: lesson)
        advance(e, seconds: 900, dt: 0.01)
        #expect(e.paco2 > 50)

        e.settings.tidalVolume = 180
        e.settings.respiratoryRate = 20
        advance(e, seconds: 900, dt: 0.01)
        #expect(e.paco2 >= 33 && e.paco2 <= 48)
        #expect(e.measured.minuteVolume >= 3.2)
    }

    @Test("6-1：離脱の条件をすべて満たせる")
    func weaningCriteriaReachable() {
        let lesson = LessonLibrary.lesson(id: "6-1")!
        let e = makeEngine(for: lesson, sedation: 0.2) { $0.peep = 5; $0.fio2 = 0.4 }
        advance(e, seconds: 60 * 20, dt: 0.01)
        let unmet = Weaning.readiness(for: e).filter { !$0.met }.map(\.label)
        #expect(unmet.isEmpty, "満たせない条件: \(unmet)")
    }
}
