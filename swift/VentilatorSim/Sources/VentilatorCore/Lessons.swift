import Foundation

/* 学習コース。web/lessons.js と同じ内容・同じ判定で、呼吸器の操作を 1 から学べるようにしたもの。
 * 「読んで終わり」にしないため、解説はすべて実機画面上の操作課題とセットになっている。
 * ここはデータと進行のロジックだけを持ち、描画は App 側の LessonCoachView が行う。 */

// MARK: - 機器の出来事

/// 課題を進めるきっかけになる操作。UI 側が該当のキーを押したときに送る。
public enum LessonEvent: String, Sendable, Equatable {
    case inspiratoryHold, expiratoryHold, suction, oxygenFlush, orderBloodGas
    case openWeaning, startSBT, extubate
    case modeVolumeAC, modePressureAC, modeSIMV, modePSV, modeCPAP

    public static func mode(_ mode: VentilationMode) -> LessonEvent {
        switch mode {
        case .volumeAssistControl:   return .modeVolumeAC
        case .pressureAssistControl: return .modePressureAC
        case .simvVolume:            return .modeSIMV
        case .pressureSupport:       return .modePSV
        case .cpap:                  return .modeCPAP
        }
    }
}

// MARK: - 判定用のコンテキスト

/// SBT の進行状況。レッスン側は結果だけを見る。
public struct SBTState: Sendable, Equatable {
    public var running: Bool
    public var finished: Bool
    public var passed: Bool
    public var failureReason: String?

    public init(running: Bool = false, finished: Bool = false,
                passed: Bool = false, failureReason: String? = nil) {
        self.running = running
        self.finished = finished
        self.passed = passed
        self.failureReason = failureReason
    }
}

/// レッスンをまたいで値を覚えておくための入れ物。課題の onStart / onPass から書き込む。
public final class LessonMemory {
    public var numbers: [String: Double] = [:]
    public var gases: [String: BloodGas] = [:]
    public init() {}

    public subscript(key: String) -> Double? {
        get { numbers[key] }
        set { numbers[key] = newValue }
    }
}

/// 課題の判定に渡すもの。engine は参照型なので、onStart から病態を起こすこともできる。
public struct LessonContext {
    public let engine: VentilatorEngine
    public let bloodGases: [BloodGas]
    public let sbt: SBTState
    public let extubated: Bool
    public let memory: LessonMemory

    public init(engine: VentilatorEngine, bloodGases: [BloodGas] = [],
                sbt: SBTState = SBTState(), extubated: Bool = false,
                memory: LessonMemory) {
        self.engine = engine
        self.bloodGases = bloodGases
        self.sbt = sbt
        self.extubated = extubated
        self.memory = memory
    }

    public var settings: VentilatorSettings { engine.settings }
    public var measured: MeasuredValues { engine.measured }
    public var pbw: Double { engine.patient.predictedBodyWeight }
    public var lastBloodGas: BloodGas? { bloodGases.last }
    /// 予測体重あたりの実測一回換気量。肺保護の判定はほぼこれで足りる。
    public var tidalPerKg: Double { measured.tidalVolumeExp / pbw }
    /// ポーズが終わって測定値が確定しているか。
    public var holdSettled: Bool { engine.activeHold == nil && engine.awaitingHold == nil }
}

// MARK: - 課題

public struct LessonQuiz {
    public var question: String
    public var choices: [String]
    public var answer: Int
    public var explanation: String

    public init(question: String, choices: [String], answer: Int, explanation: String) {
        self.question = question
        self.choices = choices
        self.answer = answer
        self.explanation = explanation
    }
}

public struct LessonTask {
    /// 課題が先に進む条件。3 つのうちちょうど 1 つ。
    public enum Advance {
        case condition((LessonContext) -> Bool)
        case event(LessonEvent)
        case quiz(LessonQuiz)
    }

    public var advance: Advance
    /// 条件を満たし続けなければならないシミュレーション内の秒数。0 なら一瞬でよい。
    public var holdSeconds: Double
    public var instruction: (LessonContext) -> String
    public var hint: (LessonContext) -> String
    public var explanation: (LessonContext) -> String
    public var onStart: ((LessonContext) -> Void)?
    public var onPass: ((LessonContext) -> Void)?

    public init(advance: Advance,
                holdSeconds: Double = 0,
                instruction: @escaping (LessonContext) -> String = { _ in "" },
                hint: @escaping (LessonContext) -> String = { _ in "" },
                explanation: @escaping (LessonContext) -> String = { _ in "" },
                onStart: ((LessonContext) -> Void)? = nil,
                onPass: ((LessonContext) -> Void)? = nil) {
        self.advance = advance
        self.holdSeconds = holdSeconds
        self.instruction = instruction
        self.hint = hint
        self.explanation = explanation
        self.onStart = onStart
        self.onPass = onPass
    }

    public var quiz: LessonQuiz? {
        if case .quiz(let q) = advance { return q }
        return nil
    }
}

public extension LessonTask {

    /// 画面の値や設定を見て進む課題。
    static func step(_ say: String, hint: String = "", hold: Double = 0, why: String = "",
                     check: @escaping (LessonContext) -> Bool) -> LessonTask {
        LessonTask(advance: .condition(check), holdSeconds: hold,
                   instruction: { _ in say }, hint: { _ in hint }, explanation: { _ in why })
    }

    /// 機器のキーを押すことで進む課題。
    static func key(_ say: String, hint: String = "", event: LessonEvent, why: String = "") -> LessonTask {
        LessonTask(advance: .event(event),
                   instruction: { _ in say }, hint: { _ in hint }, explanation: { _ in why })
    }

    /// 選択肢に答えて進む課題。
    static func quiz(_ question: String, _ choices: [String], answer: Int, why: String) -> LessonTask {
        LessonTask(advance: .quiz(LessonQuiz(question: question, choices: choices,
                                             answer: answer, explanation: why)))
    }

    /// 解説を、そのときの計測値から組み立てたいとき。
    func explaining(_ body: @escaping (LessonContext) -> String) -> LessonTask {
        var copy = self; copy.explanation = body; return copy
    }
    /// ヒントに予測体重などの計算結果を出したいとき。
    func hinting(_ body: @escaping (LessonContext) -> String) -> LessonTask {
        var copy = self; copy.hint = body; return copy
    }
    /// 課題に入った瞬間に病態を起こす。
    func starting(_ body: @escaping (LessonContext) -> Void) -> LessonTask {
        var copy = self; copy.onStart = body; return copy
    }
    /// 課題を通過した瞬間に値を覚える、病態を戻すなど。
    func passing(_ body: @escaping (LessonContext) -> Void) -> LessonTask {
        var copy = self; copy.onPass = body; return copy
    }
}

// MARK: - レッスンと章

public struct Lesson: Identifiable {
    public var id: String
    public var title: String
    public var minutes: Int
    public var scenarioID: String
    /// 開始時の設定。症例の推奨設定ではなく、そのレッスンが教えたい状況から始める。
    public var prepare: (inout VentilatorSettings) -> Void
    public var sedation: Double?
    public var brief: [String]
    public var points: [String]
    public var tasks: [LessonTask]

    public init(id: String, title: String, minutes: Int, scenarioID: String,
                prepare: @escaping (inout VentilatorSettings) -> Void,
                sedation: Double? = nil,
                brief: [String], points: [String], tasks: [LessonTask]) {
        self.id = id
        self.title = title
        self.minutes = minutes
        self.scenarioID = scenarioID
        self.prepare = prepare
        self.sedation = sedation
        self.brief = brief
        self.points = points
        self.tasks = tasks
    }

    public var scenario: Scenario {
        ScenarioLibrary.all.first { $0.id == scenarioID } ?? ScenarioLibrary.postoperative
    }
}

public struct LessonChapter: Identifiable {
    public var id: String
    public var title: String
    public var tag: String
    public var subtitle: String
    public var lessons: [Lesson]
}

// MARK: - 進行

public final class LessonRuntime {
    public let lesson: Lesson
    public let memory = LessonMemory()

    public private(set) var index = 0
    public private(set) var held: Double = 0
    public private(set) var finished = false
    public private(set) var wrongAnswers = 0
    /// 直前に選んだ選択肢。誤答の印をつけるために覚えておく。
    public private(set) var lastAnswer: Int?
    public private(set) var lastAnswerWasWrong = false

    private var enteredIndex = -1

    public init(lesson: Lesson) { self.lesson = lesson }

    public var task: LessonTask? { finished ? nil : lesson.tasks[index] }
    public var total: Int { lesson.tasks.count }

    /// 課題に入るときの副作用を 1 回だけ実行する。poll / fire / answer の前に呼ぶ。
    public func enter(_ context: LessonContext) {
        guard !finished, enteredIndex != index else { return }
        enteredIndex = index
        held = 0
        lastAnswer = nil
        lastAnswerWasWrong = false
        lesson.tasks[index].onStart?(context)
    }

    /// seconds はシミュレーション内の経過秒。進んだときだけ解説を返す。
    @discardableResult
    public func poll(_ context: LessonContext, seconds: Double) -> String? {
        guard let task else { return nil }
        enter(context)
        guard case .condition(let test) = task.advance else { return nil }
        if test(context) {
            held += seconds
            if held >= task.holdSeconds { return advance(context) }
        } else {
            held = 0
        }
        return nil
    }

    /// 機器のキー操作を伝える。合っていれば進む。
    @discardableResult
    public func fire(_ event: LessonEvent, _ context: LessonContext) -> String? {
        guard let task else { return nil }
        enter(context)
        guard case .event(let wanted) = task.advance, wanted == event else { return nil }
        return advance(context)
    }

    /// クイズの答え。正解しないと進まない。
    @discardableResult
    public func answer(_ choice: Int, _ context: LessonContext) -> (correct: Bool, explanation: String?) {
        guard let task, let quiz = task.quiz else { return (false, nil) }
        enter(context)
        lastAnswer = choice
        guard choice == quiz.answer else {
            wrongAnswers += 1
            lastAnswerWasWrong = true
            return (false, nil)
        }
        lastAnswerWasWrong = false
        return (true, advance(context))
    }

    /// hold 付きの課題で、あとどれだけ保てばよいかの割合。
    public var holdFraction: Double {
        guard let task, task.holdSeconds > 0 else { return 0 }
        return min(max(held / task.holdSeconds, 0), 1)
    }

    private func advance(_ context: LessonContext) -> String {
        let task = lesson.tasks[index]
        task.onPass?(context)
        let why = task.quiz?.explanation ?? task.explanation(context)
        index += 1
        held = 0
        lastAnswer = nil
        lastAnswerWasWrong = false
        if index >= lesson.tasks.count { finished = true }
        return why
    }
}

// MARK: - コース

public enum LessonLibrary {

    public static let chapters: [LessonChapter] = [
        LessonChapter(id: "ch1", title: "第1章　機械を読む", tag: "基礎",
                      subtitle: "波形と数字が何を言っているのかを、まず読めるようにする。",
                      lessons: [lesson1_1, lesson1_2, lesson1_3]),
        LessonChapter(id: "ch2", title: "第2章　挿管直後の初期設定", tag: "初期設定",
                      subtitle: "目の前の患者に、最初の 5 分で何を決めるか。",
                      lessons: [lesson2_1, lesson2_2, lesson2_3]),
        LessonChapter(id: "ch3", title: "第3章　モードの違い", tag: "モード",
                      subtitle: "何を保証して、何を患者に委ねるのか。",
                      lessons: [lesson3_1, lesson3_2, lesson3_3]),
        LessonChapter(id: "ch4", title: "第4章　血液ガスを読む", tag: "血液ガス",
                      subtitle: "数字から、次に回すつまみを決められるようにする。",
                      lessons: [lesson4_1, lesson4_2, lesson4_3, lesson4_4]),
        LessonChapter(id: "ch5", title: "第5章　アラームとトラブル", tag: "トラブル",
                      subtitle: "鳴ってから考えるのではなく、順番を決めておく。",
                      lessons: [lesson5_1, lesson5_2, lesson5_3]),
        LessonChapter(id: "ch6", title: "第6章　離脱と抜管", tag: "離脱",
                      subtitle: "つけるより、外すほうが難しい。",
                      lessons: [lesson6_1, lesson6_2, lesson6_3])
    ]

    public static var all: [Lesson] { chapters.flatMap(\.lessons) }

    public static func lesson(id: String) -> Lesson? {
        all.first { $0.id == id }
    }

    public static func chapter(of id: String) -> LessonChapter? {
        chapters.first { chapter in chapter.lessons.contains { $0.id == id } }
    }

    public static func next(after id: String) -> Lesson? {
        let list = all
        guard let i = list.firstIndex(where: { $0.id == id }), i + 1 < list.count else { return nil }
        return list[i + 1]
    }

    /// 表示用に丸めた「6 mL/kg の目標値」。ヒントと判定でずれないよう 1 か所で計算する。
    static func protectiveTidal(_ pbw: Double) -> Double {
        (pbw * 6 / 10).rounded() * 10
    }
}
