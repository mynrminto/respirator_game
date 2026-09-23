import Foundation

/* 学習コース。web/lessons.js と同じ内容・同じ判定で、呼吸器の操作を 1 から学べるようにしたもの。
 * 方針は「物語を追ううちに手が動く」こと。場面（talk）で状況を作り、操作させ、
 * その結果にいぶき先生が一言を添える。ぷくぷくが学習者の代わりに「なんで？」と聞く。
 * instruction は一息で読める指示だけにし、理屈は操作が終わったあとの explanation に回す。
 * 背景の解説（brief）は帯の「解説」からいつでも読めるが、読まなくても先に進める。
 * ここはデータと進行のロジックだけを持ち、描画は App 側の LessonCoachView が行う。 */

// MARK: - 機器の出来事

/// 課題を進めるきっかけになる操作。UI 側が該当のキーを押したときに送る。
public enum LessonEvent: String, Sendable, Equatable {
    case inspiratoryHold, expiratoryHold, suction, oxygenFlush, orderBloodGas
    case openWeaning, startSBT, extubate
    /// 患者情報を開いた。
    case openPatientInfo
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
    /// 開始からの秒数。終わったあとは終わった時点の値で止まる（web の tEnd − t0）。
    public var elapsed: Double

    public init(running: Bool = false, finished: Bool = false,
                passed: Bool = false, failureReason: String? = nil,
                elapsed: Double = 0) {
        self.running = running
        self.finished = finished
        self.passed = passed
        self.failureReason = failureReason
        self.elapsed = elapsed
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
    /// 設問の文。実測値から作る設問では、値がそろう前の見出しとして使う。
    public var question: String
    public var choices: [String]
    public var answer: Int
    public var explanation: String
    /// 選択肢ごとの「なぜ違うか」の一言。正解の位置は nil。
    public var miss: [String?]
    /// 実測値や血液ガスの結果から設問・解説を作るとき。
    public var dynamicQuestion: ((LessonContext) -> String)?
    public var dynamicExplanation: ((LessonContext) -> String)?

    public init(question: String, choices: [String], answer: Int, explanation: String,
                miss: [String?] = [],
                dynamicQuestion: ((LessonContext) -> String)? = nil,
                dynamicExplanation: ((LessonContext) -> String)? = nil) {
        self.question = question
        self.choices = choices
        self.answer = answer
        self.explanation = explanation
        self.miss = miss
        self.dynamicQuestion = dynamicQuestion
        self.dynamicExplanation = dynamicExplanation
    }

    /// 画面に出す設問。
    public func questionText(_ context: LessonContext) -> String {
        dynamicQuestion?(context) ?? question
    }
    /// 正解したときの解説。
    public func explanationText(_ context: LessonContext) -> String {
        dynamicExplanation?(context) ?? explanation
    }
    /// 誤答したときの一言。
    public func missText(_ choice: Int) -> String? {
        guard miss.indices.contains(choice) else { return nil }
        return miss[choice]
    }
}

/// 帯でしゃべる人。ぷくぷくが学習者の代わりに聞き、いぶき先生が答える。
/// 説明を一方的に読ませるより、この往復のほうが頭に残る。
public enum LessonSpeaker: String, Sendable {
    case scene      // ト書き。人のせりふではなく場面の説明。
    case doctor     // いぶき先生
    case puku       // ぷくぷく
    case patient    // 患者・家族

    public var displayName: String {
        switch self {
        case .scene:   return ""
        case .doctor:  return "いぶき先生"
        case .puku:    return "ぷくぷく"
        case .patient: return "患者・家族"
        }
    }
}

public struct LessonTask {
    /// 課題が先に進む条件。4 つのうちちょうど 1 つ。
    public enum Advance {
        case condition((LessonContext) -> Bool)
        case event(LessonEvent)
        case quiz(LessonQuiz)
        /// 会話・ト書きの場面。「続ける」を押すと進む。
        case talk(LessonSpeaker)
    }

    public var advance: Advance
    /// 条件を満たし続けなければならないシミュレーション内の秒数。0 なら一瞬でよい。
    public var holdSeconds: Double
    public var instruction: (LessonContext) -> String
    public var hint: (LessonContext) -> String
    public var explanation: (LessonContext) -> String
    /* 表示の指定。文章で「右の計測値の Vte を見てください」と書く代わりに、
     * 見るべき値を帯にも出し（watch）、押すところを光らせる（spot）。
     * 文字列は web/lessons.js とまったく同じものを使う。 */
    /// 帯にも出しておく計測値。画面のタイルと同じ見出し（"Pplat" など）。
    public var watch: [String]
    /// いま押す／見るところ。"key:vt" / "val:Pplat" / "hard:kInsp" / "wave" / "dial"、
    /// およびモードのタブ "mode:" ＋ そのモードの表示名（web とは表示名が違うのでそこだけ読み替える）。
    public var spot: [String]
    /// 会話・クイズで光らせるモニターの場所。nil なら文から拾う（LessonLibrary.lookFor）。
    /// [] なら何も光らせない。web/lessons.js の look と同じ。
    public var look: [String]?
    public var onStart: ((LessonContext) -> Void)?
    public var onPass: ((LessonContext) -> Void)?
    /// event の課題で、違うキーを押したときに返す一言。
    public var missEvents: [LessonEvent: String] = [:]

    public init(advance: Advance,
                holdSeconds: Double = 0,
                instruction: @escaping (LessonContext) -> String = { _ in "" },
                hint: @escaping (LessonContext) -> String = { _ in "" },
                explanation: @escaping (LessonContext) -> String = { _ in "" },
                watch: [String] = [],
                spot: [String] = [],
                onStart: ((LessonContext) -> Void)? = nil,
                onPass: ((LessonContext) -> Void)? = nil) {
        self.advance = advance
        self.holdSeconds = holdSeconds
        self.instruction = instruction
        self.hint = hint
        self.explanation = explanation
        self.watch = watch
        self.spot = spot
        self.onStart = onStart
        self.onPass = onPass
    }

    public var quiz: LessonQuiz? {
        if case .quiz(let q) = advance { return q }
        return nil
    }

    /// 会話の場面なら、その話し手。
    public var speaker: LessonSpeaker? {
        if case .talk(let who) = advance { return who }
        return nil
    }
    public var isTalk: Bool { speaker != nil }
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

    /// 会話・ト書きの場面。「続ける」を押すと次へ進む。
    static func talk(_ who: LessonSpeaker, _ say: String) -> LessonTask {
        LessonTask(advance: .talk(who), instruction: { _ in say })
    }

    /// 選択肢に答えて進む課題。miss は選択肢ごとの「なぜ違うか」（正解の位置は nil）。
    static func quiz(_ question: String, _ choices: [String], answer: Int,
                     miss: [String?] = [], why: String) -> LessonTask {
        LessonTask(advance: .quiz(LessonQuiz(question: question, choices: choices,
                                             answer: answer, explanation: why, miss: miss)))
    }

    /// 設問を実測値や血液ガスの結果から作るクイズ。question は値がそろう前の見出し。
    static func quiz(_ question: String, asking ask: @escaping (LessonContext) -> String,
                     _ choices: [String], answer: Int,
                     miss: [String?] = [], why: String) -> LessonTask {
        LessonTask(advance: .quiz(LessonQuiz(question: question, choices: choices,
                                             answer: answer, explanation: why, miss: miss,
                                             dynamicQuestion: ask)))
    }

    /// 課題のあいだ、帯にもこの計測値を出す。操作の前後を「前 → 後」で見せるのに使う。
    func watching(_ captions: [String]) -> LessonTask {
        var copy = self; copy.watch = captions; return copy
    }
    /// いま押す／見るところを光らせる。
    func spotting(_ specs: [String]) -> LessonTask {
        var copy = self; copy.spot = specs; return copy
    }
    /// 会話・クイズで光らせるモニターの場所を、文から拾わずに決める。"lane:paw" / "val:PIP" / "wave" など。
    func looking(_ specs: [String]) -> LessonTask {
        var copy = self; copy.look = specs; return copy
    }
    /// 解説を、そのときの計測値から組み立てたいとき。クイズなら正解したときの解説になる。
    func explaining(_ body: @escaping (LessonContext) -> String) -> LessonTask {
        var copy = self
        if case .quiz(var q) = advance {
            q.dynamicExplanation = body
            copy.advance = .quiz(q)
        } else {
            copy.explanation = body
        }
        return copy
    }
    /// 違うキーを押したときの一言。黙って無視すると、押せていないのかと迷う。
    func missing(_ events: [LessonEvent: String]) -> LessonTask {
        var copy = self; copy.missEvents = events; return copy
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

    /// 物語のいまの場面。index までで最後のト書き（患者の様子を含む）。患者情報の「いまの状況」に出す。
    /// セリフの {FiO₂} などは表示する側で実測値に置き換える。
    public func storyLine(upTo index: Int, _ context: LessonContext) -> String? {
        var last: String?
        for (i, t) in tasks.enumerated() where i <= index {
            if t.speaker == .scene || t.speaker == .patient { last = t.instruction(context) }
        }
        return last
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

    /// 直前の結果。ok が false のときは、誤答や違うキーへの一言（帯のヒントの位置に出す）。
    public struct Feedback: Equatable {
        public let text: String
        public let ok: Bool
    }
    public private(set) var feedback: Feedback?

    private var enteredIndex = -1

    public init(lesson: Lesson) { self.lesson = lesson }

    public var task: LessonTask? { finished ? nil : lesson.tasks[index] }
    public var total: Int { lesson.tasks.count }

    /* 進み具合は「やること」の数で数える。会話の場面まで数えると、
     * 読んだだけで進んだように見えてしまう。 */
    public var actionTotal: Int { lesson.tasks.filter { !$0.isTalk }.count }
    public var actionDone: Int {
        lesson.tasks.prefix(index).filter { !$0.isTalk }.count
    }
    /// いま向かっている「やること」の番号。会話の場面は飛ばす。無ければ nil。
    public var actionIndex: Int? {
        lesson.tasks.indices.first { $0 >= index && !lesson.tasks[$0].isTalk }
    }

    /// 課題に入るときの副作用を 1 回だけ実行する。poll / fire / answer の前に呼ぶ。
    public func enter(_ context: LessonContext) {
        guard !finished, enteredIndex != index else { return }
        enteredIndex = index
        held = 0
        lastAnswer = nil
        lastAnswerWasWrong = false
        feedback = nil
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
    /// 違うキーなら、その課題に一言があれば feedback に入れる（ok は false）。
    @discardableResult
    public func fire(_ event: LessonEvent, _ context: LessonContext) -> String? {
        guard let task else { return nil }
        enter(context)
        guard case .event(let wanted) = task.advance else { return nil }
        guard wanted == event else {
            if let miss = task.missEvents[event] { feedback = Feedback(text: miss, ok: false) }
            return nil
        }
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
            let miss = quiz.missText(choice).map { $0 + " " } ?? ""
            feedback = Feedback(text: miss + "もう一度考えてみてください。", ok: false)
            return (false, nil)
        }
        lastAnswerWasWrong = false
        return (true, advance(context))
    }

    /// 会話の場面を読み終えて次へ。「続ける」を押したときに呼ぶ。
    @discardableResult
    public func tap(_ context: LessonContext) -> String? {
        guard let task, task.isTalk else { return nil }
        enter(context)
        return advance(context)
    }

    /// hold 付きの課題で、あとどれだけ保てばよいかの割合。
    public var holdFraction: Double {
        guard let task, task.holdSeconds > 0 else { return 0 }
        return min(max(held / task.holdSeconds, 0), 1)
    }

    private func advance(_ context: LessonContext) -> String {
        let task = lesson.tasks[index]
        task.onPass?(context)
        let why = task.quiz?.explanationText(context) ?? task.explanation(context)
        index += 1
        held = 0
        lastAnswer = nil
        lastAnswerWasWrong = false
        if index >= lesson.tasks.count { finished = true }
        feedback = Feedback(text: why, ok: true)
        return why
    }
}

// MARK: - コース

public enum LessonLibrary {

    /* ---- 説明の文から、モニターのどこを見ればよいかを決める ----
     * 会話・クイズ・操作後の解説で「PIP は…」「流量波形が…」と言ったら、画面のその場所を
     * ボタンと同じ光り方で光らせる。web/lessons.js の monitorSpots と同じ規則・同じ一覧
     * （test.js の 25 番が突き合わせる）。
     * 計測値タイルは見出し（Readout.caption）そのままの名前で拾う。英字の名前は前後が英数字でない
     * ときだけ（「SIMV」の中の MV や「Vt」を Vte と取り違えない）。 */
    public static let monitorVals: [String] = ["PIP", "Pplat", "PEEP tot", "ΔP", "Vte", "MV", "RR tot", "I:E", "Cstat", "Raw",
        "auto-PEEP", "f/VT", "SpO₂", "etCO₂", "HR", "ABP mean"]
    /// 日本語で呼んだときの言い方。（言い方, タイルの名前）
    public static let monitorAlias: [(String, String)] = [("SpO2", "SpO₂"), ("心拍", "HR"), ("血圧", "ABP mean"), ("総 PEEP", "PEEP tot"),
        ("分時換気量", "MV")]
    /// 波形の段。（言い方, 段）。どれにも当たらず「波形」とだけ言ったら波形の画面全体。
    public static let monitorLanes: [(String, String)] = [("圧波形", "paw"), ("圧の波形", "paw"), ("気道内圧", "paw"),
        ("流量", "flow"), ("換気量波形", "vol"), ("換気量の波形", "vol")]

    private static func isWordChar(_ c: Character?) -> Bool {
        guard let c else { return false }
        return c.isASCII && (c.isLetter || c.isNumber)
    }

    static func containsWord(_ text: String, _ name: String) -> Bool {
        var from = text.startIndex
        while from < text.endIndex, let r = text.range(of: name, range: from..<text.endIndex) {
            let before: Character? = r.lowerBound > text.startIndex ? text[text.index(before: r.lowerBound)] : nil
            let after: Character? = r.upperBound < text.endIndex ? text[r.upperBound] : nil
            let edgeL = !isWordChar(name.first) || !isWordChar(before)
            let edgeR = !isWordChar(name.last) || !(isWordChar(after) || after == "₂")
            if edgeL && edgeR { return true }
            from = text.index(after: r.lowerBound)
        }
        return false
    }

    /// 文に出てきたモニターの場所。"val:PIP" / "lane:flow" / "wave"。
    public static func monitorSpots(in text: String) -> [String] {
        guard !text.isEmpty else { return [] }
        var out: [String] = []
        func add(_ s: String) { if !out.contains(s) { out.append(s) } }
        for k in monitorVals where containsWord(text, k) { add("val:" + k) }
        for (say, k) in monitorAlias where text.contains(say) { add("val:" + k) }
        var lane = false
        for (say, k) in monitorLanes where text.contains(say) { add("lane:" + k); lane = true }
        if !lane && text.contains("波形") { add("wave") }
        return out
    }

    /// 会話・クイズの課題で光らせるもの。text は差し込み前のセリフや設問。
    /// look があればそれ。無ければ spot ＋ watch の計測値 ＋ 文に出てきたモニターの場所。
    public static func lookFor(_ task: LessonTask, text: String) -> [String] {
        if let look = task.look { return look }
        var out = task.spot
        func add(_ s: String) { if !out.contains(s) { out.append(s) } }
        for k in task.watch { add("val:" + k) }
        for s in monitorSpots(in: text) { add(s) }
        return out
    }

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

    /// 表示用の「x mL/kg の目標値」。ヒントと判定でずれないよう 1 か所で計算する。
    /// 体重が 1 kg から 35 kg まで動くので、早産児では小数第 1 位まで見せる。
    static func protectiveTidal(_ pbw: Double, _ perKg: Double = 6) -> Double {
        pbw * perKg
    }

    /// 設定値を JS の数値表記と同じ形で出す（整数なら小数点なし、そうでなければ最短の小数）。
    static func number(_ v: Double) -> String {
        v == v.rounded() ? String(Int(v)) : String(v)
    }

    /// 同じ値を画面に出すときの表記。6 kg 未満は 0.1 mL の桁まで。
    static func mlkg(_ pbw: Double, _ perKg: Double) -> String {
        let v = pbw * perKg
        return pbw < 6 ? String(format: "%.1f", v) : String(format: "%.0f", v.rounded())
    }
}
