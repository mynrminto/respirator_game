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

/// 物語の場面（talk）を読み飛ばして、次の「やること」に立たせる。
/// 2026-09-22 にレッスンが物語形式になり、どのレッスンも会話から始まるようになったので、
/// 課題の番号を直接書いていたテストはここを通してから本題に入る。
@discardableResult
private func skipTalk(_ runtime: LessonRuntime, _ ctx: () -> LessonContext) -> Int {
    var skipped = 0
    while let task = runtime.task, task.isTalk, skipped < 40 {
        runtime.tap(ctx())
        skipped += 1
    }
    return skipped
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
                // 誤答の一言は選択肢と同じ数だけあり、正解の位置だけが空
                #expect(quiz.miss.count == quiz.choices.count, "\(lesson.id) miss の数")
                #expect(quiz.missText(quiz.answer) == nil, "\(lesson.id) 正解に miss がある")
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

        // 1 番目の「やること」：吸気ポーズのキー
        skipTalk(runtime, ctx)
        let atKey = runtime.index
        #expect(runtime.fire(.expiratoryHold, ctx()) == nil)   // 違うキーでは進まない
        #expect(runtime.index == atKey)
        #expect(runtime.fire(.inspiratoryHold, ctx()) != nil)
        #expect(runtime.index > atKey)

        // 2 番目：測定が終わるまで進まない
        skipTalk(runtime, ctx)
        let atHold = runtime.index
        engine.requestHold(.inspiratory)
        #expect(runtime.poll(ctx(), seconds: 0.5) == nil)
        advance(engine, seconds: 14)
        #expect(runtime.poll(ctx(), seconds: 0.5) != nil)
        #expect(runtime.index > atHold)

        // 3 番目：クイズ。誤答では進まない。
        skipTalk(runtime, ctx)
        let atQuiz = runtime.index
        let quiz = runtime.task?.quiz
        #expect(quiz != nil)
        let wrong = (quiz!.answer + 1) % quiz!.choices.count
        let bad = runtime.answer(wrong, ctx())
        #expect(bad.correct == false)
        #expect(runtime.index == atQuiz)
        #expect(runtime.lastAnswerWasWrong)
        // 誤答には、その選択肢がなぜ違うかの一言が付く
        #expect(runtime.feedback?.ok == false)
        #expect(runtime.feedback?.text.hasSuffix("もう一度考えてみてください。") == true)
        #expect(runtime.feedback?.text.hasPrefix(quiz!.miss[wrong] ?? "") == true)

        let good = runtime.answer(quiz!.answer, ctx())
        #expect(good.correct)
        #expect(good.explanation?.isEmpty == false)
        #expect(runtime.index > atQuiz)
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
        skipTalk(runtime, ctx)
        let atHold = runtime.index
        #expect(engine.measured.minuteVolume >= 3.0 && engine.measured.minuteVolume <= 4.2)
        #expect(runtime.poll(ctx(), seconds: 5) == nil)     // まだ 30 秒に足りない
        #expect(runtime.poll(ctx(), seconds: 30) != nil)
        #expect(runtime.index > atHold)
    }

    @Test("最後の課題を終えると finished になる")
    func finishes() {
        let lesson = LessonLibrary.lesson(id: "5-3")!
        let engine = makeEngine(for: lesson)
        let runtime = LessonRuntime(lesson: lesson)
        let ctx = { context(engine, memory: runtime.memory) }
        advance(engine, seconds: 60, dt: 0.01)
        // 課題の種類どおりに順に通す。途中で止まったら構成が変わったということ。
        var guardCount = 0
        while !runtime.finished && guardCount < 80 {
            guardCount += 1
            guard let task = runtime.task else { break }
            switch task.advance {
            case .talk:
                runtime.tap(ctx())
            case .quiz(let quiz):
                runtime.answer(quiz.answer, ctx())
            case .event(let event):
                if event == .inspiratoryHold { engine.requestHold(.inspiratory) }
                runtime.fire(event, ctx())
            case .condition:
                advance(engine, seconds: 20, dt: 0.01)
                runtime.poll(ctx(), seconds: 60)
            }
        }
        #expect(runtime.finished)
        #expect(runtime.task == nil)
    }
}

@Suite("教材は読み物ではなく操作であること")
struct LessonShapeTests {

    /* 画面のタイル（App 側の Readout）と設定キー（VentilatorParameter）に合わせた一覧。
     * ここが食い違うと、光も帯の計測値も黙って出なくなるので、テストで固定しておく。 */
    private static let readoutCaptions: Set<String> = [
        "PIP", "Pplat", "PEEP tot", "ΔP", "Vte", "MV", "RR tot", "I:E",
        "Cstat", "Raw", "auto-PEEP", "f/VT", "SpO₂", "etCO₂", "HR", "ABP mean"
    ]
    private static let parameterIDs: Set<String> = [
        "vt", "rr", "pinsp", "ti", "flow", "peep", "fio2", "ps", "trig",
        "esens", "rise", "pause", "sed"
    ]
    private static let hardKeyIDs: Set<String> = [
        "kInsp", "kExp", "kO2", "kSuc", "kFrz", "kSpd", "kAbg", "kWean", "kLearn"
    ]

    @Test("watch がすべて実在の計測値を指す")
    func watchTargetsExist() {
        var bad: [String] = []
        for lesson in LessonLibrary.all {
            for task in lesson.tasks {
                for caption in task.watch where !Self.readoutCaptions.contains(caption) {
                    bad.append("\(lesson.id):\(caption)")
                }
            }
        }
        #expect(bad.isEmpty, "\(bad)")
    }

    @Test("spot がすべて実在の操作先を指す")
    func spotTargetsExist() {
        let modes = Set(VentilationMode.allCases.map(\.rawValue))
        var bad: [String] = []
        for lesson in LessonLibrary.all {
            for task in lesson.tasks {
                for spec in task.spot {
                    let parts = spec.split(separator: ":", maxSplits: 1).map(String.init)
                    let kind = parts[0]
                    let arg = parts.count > 1 ? parts[1] : ""
                    let ok: Bool
                    switch kind {
                    case "wave", "dial": ok = arg.isEmpty
                    case "val":  ok = Self.readoutCaptions.contains(arg)
                    case "key":  ok = Self.parameterIDs.contains(arg)
                    case "hard": ok = Self.hardKeyIDs.contains(arg)
                    case "mode": ok = modes.contains(arg)
                    default:     ok = false
                    }
                    if !ok { bad.append("\(lesson.id):\(spec)") }
                }
            }
        }
        #expect(bad.isEmpty, "\(bad)")
    }

    /// 文章の量。ここが太ると「読む教材」に逆戻りするので、上限を決めておく。
    @Test("指示も解説も一息で読める長さに収まっている")
    func textStaysShort() {
        let sample = LessonContext(engine: VentilatorEngine(patient: ScenarioLibrary.postoperative.patient,
                                                            settings: ScenarioLibrary.postoperative.initialSettings()),
                                   memory: LessonMemory())
        var tooLong: [String] = []
        for lesson in LessonLibrary.all {
            if lesson.brief.count > 4 { tooLong.append("\(lesson.id) 解説が 4 行超") }
            for line in lesson.brief where line.count > 100 {
                tooLong.append("\(lesson.id) 解説 \(line.count)字")
            }
            for task in lesson.tasks {
                let say = task.instruction(sample)
                // 指示は一息で読める長さ、会話はひと呼吸で話せる長さ。
                let limit = task.isTalk ? 120 : 48
                if say.count > limit {
                    tooLong.append("\(lesson.id) \(task.isTalk ? "会話" : "指示") \(say.count)字")
                }
                if let quiz = task.quiz, quiz.question.count > 62 {
                    tooLong.append("\(lesson.id) 設問 \(quiz.question.count)字")
                }
            }
        }
        #expect(tooLong.isEmpty, "\(tooLong)")
    }

    @Test("操作と観察がクイズより多い（クイズに偏っていない）")
    func mostlyHandsOn() {
        var quizzes = 0, actions = 0, talks = 0
        for lesson in LessonLibrary.all {
            for task in lesson.tasks {
                if task.isTalk { talks += 1 }
                else if task.quiz != nil { quizzes += 1 }
                else { actions += 1 }
            }
        }
        #expect(actions > quizzes, "操作・観察 \(actions) / クイズ \(quizzes) / 会話 \(talks)")
    }

    @Test("どのレッスンも場面から始まり、会話が 3 場面以上ある")
    func everyLessonOpensWithAScene() {
        var bad: [String] = []
        for lesson in LessonLibrary.all {
            if lesson.tasks.first?.isTalk != true { bad.append("\(lesson.id) 冒頭が場面でない") }
            let talks = lesson.tasks.filter(\.isTalk).count
            if talks < 3 { bad.append("\(lesson.id) 会話 \(talks) 場面") }
        }
        #expect(bad.isEmpty, "\(bad)")
    }

    @Test("観察の課題には必ず見どころが付いている")
    func observationTasksPointSomewhere() {
        var bare: [String] = []
        for lesson in LessonLibrary.all {
            for task in lesson.tasks {
                guard case .condition = task.advance else { continue }
                if task.watch.isEmpty && task.spot.isEmpty { bare.append(lesson.id) }
            }
        }
        #expect(bare.isEmpty, "\(bare)")
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
        skipTalk(runtime, ctx)

        runtime.poll(ctx(), seconds: 1)                 // 1 番目：平常時を記録
        let basePeak = runtime.memory["pip0"] ?? 0
        let basePlateau = runtime.memory["plat0"] ?? 0
        #expect(basePeak > 0)

        // アラームの場面の onStart で痰づまりが起きる。読み飛ばしても必ず起きること。
        let before = engine.airwayResistance.inspiratory
        skipTalk(runtime, ctx)
        #expect(engine.airwayResistance.inspiratory > before * 4)

        // 違うキー（気管吸引）を先に押すと、進まずに一言が返る
        let atKey = runtime.index
        #expect(runtime.fire(.suction, ctx()) == nil)
        #expect(runtime.index == atKey)
        #expect(runtime.feedback?.ok == false)
        #expect(runtime.feedback?.text.isEmpty == false)

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

    @Test("5-3：気胸で PIP も Pplat も上がり、Vte は変わらず SpO2 が落ちる")
    func suddenDesaturation() {
        let lesson = LessonLibrary.lesson(id: "5-3")!
        let engine = makeEngine(for: lesson)
        let runtime = LessonRuntime(lesson: lesson)
        let ctx = { context(engine, memory: runtime.memory) }
        advance(engine, seconds: 120, dt: 0.01)
        let peak0 = engine.measured.peakPressure
        let plateau0 = engine.measured.plateauPressure ?? 0
        let tidal0 = engine.measured.tidalVolumeExp
        let spo20 = engine.spo2

        skipTalk(runtime, ctx)                   // 冒頭の場面の onStart で急変が起きる（読み飛ばしても起きる）
        #expect(engine.spo2 <= 93)               // 気づいた時点で、もう下がりはじめている
        advance(engine, seconds: 300, dt: 0.01)
        #expect(engine.measured.peakPressure > peak0 + 8)
        #expect((engine.measured.plateauPressure ?? 0) > plateau0 + 8)
        #expect(abs(engine.measured.tidalVolumeExp - tidal0) < tidal0 * 0.1)
        #expect(engine.spo2 < spo20 - 3)

        // 課題を順に通し、ドレーンが入る課題に着いたら元に戻ること
        runtime.fire(.oxygenFlush, ctx())
        engine.requestHold(.inspiratory)
        advance(engine, seconds: 14, dt: 0.005)
        runtime.fire(.inspiratoryHold, ctx())
        runtime.poll(ctx(), seconds: 1)
        skipTalk(runtime, ctx)
        if let quiz = runtime.task?.quiz { runtime.answer(quiz.answer, ctx()) }
        skipTalk(runtime, ctx)                   // X 線で気胸が分かる場面
        runtime.enter(ctx())                     // ドレーンの課題の onStart で肺が戻る
        advance(engine, seconds: 600, dt: 0.01)
        #expect(engine.measured.peakPressure < peak0 + 3)
        #expect(engine.spo2 > spo20 - 2)
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
