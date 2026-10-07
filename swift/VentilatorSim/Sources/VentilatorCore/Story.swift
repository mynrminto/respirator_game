import Foundation

/// ゲーム全体を貫く物語。Web 版 story.js と同じ内容・同じ進み方。
///
/// 主人公は、初期研修で小児科を回りはじめた研修医（プレイヤー）。いぶき先生が指導医、
/// ぷくぷくは「息」から生まれた精。縦糸は、ローテ初日の夜に受け持つハルト君が抜管するまで。
///
/// レッスンの中の会話とは別に、ここには「幕」を置く。
///   prologue … いちばん最初にコースへ入るとき（名前を決める）
///   chN-open … その章のレッスンを初めて始めるとき（章の扉）
///   chN-close … その章の最後のレッスンを初めて終えたとき
///   epilogue … 第6章の幕のあと
/// 台本そのもの（StoryScenes.swift）は `node web/tools/story-swift.js` が story.js から書き出す。
/// 手で直さないこと（web/test.js の 26 番が、書き出し直した結果との一致を確かめる）。

public enum StorySpeaker: String {
    /// ト書き・いぶき先生・ぷくぷく・主人公・看護師・患者・家族
    case scene, doc, puku, me, nurse, pt, fam
}

public struct StoryChoice {
    public let label: String
    /// 選んだあとの返し（1 行）。返すのは who（既定はいぶき先生）。
    public let reply: String
    public let who: StorySpeaker
    public let mood: String?
    /// 家族・患者が返すときの呼び名と症例 ID。
    public let name: String?
    public let caseID: String?
    public init(label: String, reply: String, who: StorySpeaker = .doc, mood: String? = nil,
                name: String? = nil, caseID: String? = nil) {
        self.label = label; self.reply = reply; self.who = who; self.mood = mood
        self.name = name; self.caseID = caseID
    }
}

public struct StoryLine {
    public let who: StorySpeaker
    public let say: String
    /// doc は normal / happy / think / alert、puku は happy / excited / sad / alert。
    public let mood: String?
    /// この行から替える背景（StoryLibrary.backgrounds の名前）。
    public let bg: String?
    /// 患者・家族の呼び名。
    public let name: String?
    /// 患者の症例 ID（絵を出すため）。
    public let caseID: String?
    /// 主人公の名前を入れてもらう行。
    public let asksName: Bool
    public let choices: [StoryChoice]
    /// 選んだ番号をこの名前で覚えておく（主人公の選んだ言葉が、あとの幕に響く）。
    public let pick: String?
    /// "key:n"。key で n 番を選んだときだけ出す。選ばずに飛ばしたときは 0 番とみなす。
    public let when: String?
    /// 選択肢のあとに差し込まれた返し。
    public let isReply: Bool

    public init(_ who: StorySpeaker, _ say: String, mood: String? = nil, bg: String? = nil,
                name: String? = nil, caseID: String? = nil, asksName: Bool = false,
                pick: String? = nil, when: String? = nil,
                choices: [StoryChoice] = [], isReply: Bool = false) {
        self.who = who; self.say = say; self.mood = mood; self.bg = bg
        self.name = name; self.caseID = caseID; self.asksName = asksName
        self.pick = pick; self.when = when
        self.choices = choices; self.isReply = isReply
    }

    /// picks（選んだ言葉）のもとで、この行を出すか。Web 版 story.js の shows と同じ。
    public func shows(_ picks: [String: Int]) -> Bool {
        guard let when else { return true }
        let parts = when.split(separator: ":")
        guard parts.count == 2, let n = Int(parts[1]) else { return true }
        return (picks[String(parts[0])] ?? 0) == n
    }
}

/// 章の扉に出す大きな文字。
public struct StoryCard {
    public let kicker: String
    public let title: String
    public let sub: String
    public init(kicker: String, title: String, sub: String) {
        self.kicker = kicker; self.title = title; self.sub = sub
    }
}

/// 幕のあとに差し出す次の一手（エピローグの「症例で練習する」）。
public struct StoryEnd {
    public let label: String
    public let action: String
    public let say: String
    public init(label: String, action: String, say: String) {
        self.label = label; self.action = action; self.say = say
    }
}

public struct StoryScene: Identifiable {
    public let id: String
    public let kind: String
    public let chapter: String?
    public let title: String
    public let card: StoryCard?
    public let bg: String
    /// BGM の昼の曲・夜の曲を選ぶ（"day" / "night"）。
    public let time: String
    public let end: StoryEnd?
    public let lines: [StoryLine]

    public init(id: String, kind: String, chapter: String?, title: String, card: StoryCard?,
                bg: String, time: String = "day", end: StoryEnd?, lines: [StoryLine]) {
        self.id = id; self.kind = kind; self.chapter = chapter; self.title = title
        self.card = card; self.bg = bg; self.time = time; self.end = end; self.lines = lines
    }
}

/// 研修手帳の項目。幕を見るたびに書き足される（Web 版 story.js の NOTEBOOK と同じ）。
public struct StoryNote: Identifiable, Equatable {
    public enum Kind: String, CaseIterable {
        /// いぶき先生のこと・息のことば・できるようになったこと
        case secret, lore, growth

        public var label: String {
            switch self {
            case .secret: return "いぶき先生のこと"
            case .lore: return "息のことば"
            case .growth: return "できるようになったこと"
            }
        }

        /// 手帳のタブに出す短い名前。
        public var tab: String {
            switch self {
            case .secret: return "先生のこと"
            case .lore: return "息のことば"
            case .growth: return "できること"
            }
        }
    }

    public let id: String
    public let kind: Kind
    /// この幕を見たら書き足される。
    public let scene: String
    /// まだ書いていない欄に出す時期。
    public let hint: String
    public let title: String
    public let text: String
    public let source: String?
    /// できるようになったこと：初日の自分といま。
    public let before: String?
    public let now: String?

    public init(id: String, kind: Kind, scene: String, hint: String, title: String, text: String = "",
                source: String? = nil, before: String? = nil, now: String? = nil) {
        self.id = id; self.kind = kind; self.scene = scene; self.hint = hint; self.title = title
        self.text = text; self.source = source; self.before = before; self.now = now
    }
}

public enum StoryLibrary {

    public static let defaultName = "春野"
    public static let nameMax = 8

    /// レッスンの最中に流す BGM。章の舞台の時刻（web/story.js の CHAPTER_TIME と同じ）。
    public static let chapterTime: [String: String] = [
        "ch1": "night", "ch2": "day", "ch3": "day", "ch4": "day", "ch5": "night", "ch6": "day",
        "ch7": "day", "ch8": "day", "ch9": "night", "ch10": "night", "ch11": "day"
    ]

    /// エピローグを流す章。研修の最終日（web/story.js の LAST_CHAPTER）。
    public static let lastChapter = "ch11"

    /// 名札。{名前} は主人公の名前。患者・家族は行の name を使う。
    static let speakerLabels: [StorySpeaker: String] = [
        .scene: "", .doc: "いぶき先生", .puku: "ぷくぷく", .me: "{名前}", .nurse: "看護師 ななみ"
    ]

    /// 背景。左から順に、届いている画像を使う（新しい絵が届くまでは今ある絵で代える）。
    public static let backgrounds: [String: [String]] = [
        "corridor": ["bg_story_corridor", "bg_title_day"],
        "picu": ["bg_title_day"],
        "nicu": ["bg_story_nicu", "bg_title_day"],
        "night": ["bg_title_night"],
        "station": ["bg_story_station", "bg_title_night"],
        "dawn": ["bg_story_dawn", "bg_title_day"]
    ]

    public static func scene(id: String) -> StoryScene? { scenes.first { $0.id == id } }

    /// 名前を整える。空なら既定の名前。前後の空白と末尾の「先生」は落とす（「{名前}先生」と呼ぶため）。
    public static func cleanName(_ raw: String?) -> String {
        var s = (raw ?? "").split(whereSeparator: { $0.isWhitespace }).joined(separator: " ")
        for suffix in ["先生", "せんせい"] where s.hasSuffix(suffix) {
            s = String(s.dropLast(suffix.count)).trimmingCharacters(in: .whitespaces)
        }
        if s.count > nameMax { s = String(s.prefix(nameMax)) }
        return s.isEmpty ? defaultName : s
    }

    public static func fill(_ text: String, name: String?) -> String {
        text.replacingOccurrences(of: "{名前}", with: cleanName(name))
    }

    public static func speakerName(_ line: StoryLine, name: String?) -> String {
        if line.who == .pt || line.who == .fam { return line.name ?? "" }
        return fill(speakerLabels[line.who] ?? "", name: name)
    }

    /// 書き足されている手帳の項目（見た幕で決まる）。
    public static func notesOpen(seen: [String]) -> [StoryNote] {
        notebook.filter { seen.contains($0.scene) }
    }

    /// 幕を見る前と後の既読から、新しく書き足された項目を返す。
    public static func notesAdded(before: [String], after: [String]) -> [StoryNote] {
        notebook.filter { !before.contains($0.scene) && after.contains($0.scene) }
    }

    /// レッスンを始める前に流す幕。見ていないものだけを、物語の順に返す。
    public static func before(lessonID: String, chapterID: String?, seen: [String]) -> [String] {
        var out: [String] = []
        if !seen.contains("prologue") { out.append("prologue") }
        if let chapterID {
            let open = chapterID + "-open"
            if scene(id: open) != nil && !seen.contains(open) { out.append(open) }
        }
        return out
    }

    /// レッスンを終えたあとに流す幕。章の最後のレッスンだけが幕を持つ。
    public static func after(lessonID: String, chapter: LessonChapter?, seen: [String]) -> [String] {
        guard let chapter, chapter.lessons.last?.id == lessonID else { return [] }
        var out: [String] = []
        let close = chapter.id + "-close"
        if scene(id: close) != nil && !seen.contains(close) { out.append(close) }
        if chapter.id == lastChapter && !seen.contains("epilogue") { out.append("epilogue") }
        return out
    }
}

/// 1 つの幕を 1 行ずつ進める。描画は持たない（Web 版 story.js の Run と同じ）。
public final class StoryRun {
    public enum Phase { case card, line, end }
    public enum Waiting { case name, choice }

    public let scene: StoryScene
    public private(set) var index = 0
    public private(set) var phase: Phase
    public private(set) var reply: StoryLine?
    public private(set) var picked: Int?
    /// 選んだ言葉 { key: 番号 }。when のある行はこれで出すかどうかを決める。
    public private(set) var picks: [String: Int]

    public init(scene: StoryScene, picks: [String: Int] = [:]) {
        self.scene = scene
        self.picks = picks
        phase = scene.card == nil ? .line : .card
        settle()
    }

    /// いまの行が出さない行なら、出す行まで進める。最後まで無ければ終わり。
    private func settle() {
        while index < scene.lines.count && !scene.lines[index].shows(picks) { index += 1 }
        if index >= scene.lines.count && phase == .line { phase = .end }
    }

    public var line: StoryLine? {
        guard phase == .line else { return nil }
        if let reply { return reply }
        return index < scene.lines.count ? scene.lines[index] : nil
    }

    /// いまの行で止まって待つもの。nil なら押せば進む。
    public var waiting: Waiting? {
        guard phase == .line, reply == nil, let l = line else { return nil }
        if l.asksName { return .name }
        if !l.choices.isEmpty { return .choice }
        return nil
    }

    /// 押して進める。入力や選択を待っている行では進まない。終わったら true。
    @discardableResult
    public func next() -> Bool {
        switch phase {
        case .end: return true
        case .card: phase = .line; settle(); return phase == .end
        case .line: break
        }
        if waiting != nil { return false }
        reply = nil
        index += 1
        settle()
        if index >= scene.lines.count { phase = .end; return true }
        return false
    }

    /// 名前を入れた。次の行へ進む。
    @discardableResult
    public func submitName() -> Bool {
        guard waiting == .name else { return false }
        index += 1
        settle()
        if index >= scene.lines.count { phase = .end }
        return true
    }

    @discardableResult
    public func pick(_ i: Int) -> Bool {
        guard waiting == .choice, let l = line, l.choices.indices.contains(i) else { return false }
        picked = i
        if let key = l.pick { picks[key] = i }
        let c = l.choices[i]
        reply = StoryLine(c.who, c.reply, mood: c.mood ?? (c.who == .doc ? "happy" : nil),
                          name: c.name, caseID: c.caseID, isReply: true)
        return true
    }

    /// 残りを飛ばす。名前がまだ決まっていなければ、名前の行で止まる。
    @discardableResult
    public func skip(hasName: Bool) -> Bool {
        if phase == .card { phase = .line }
        reply = nil
        if !hasName, let i = scene.lines.indices.first(where: { $0 >= index && scene.lines[$0].asksName }) {
            index = i
            return false
        }
        phase = .end
        return true
    }
}
