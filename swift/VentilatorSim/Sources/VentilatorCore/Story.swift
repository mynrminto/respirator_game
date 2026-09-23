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
    /// 選んだあとに、いぶき先生が返す 1 行。
    public let reply: String
    public init(label: String, reply: String) { self.label = label; self.reply = reply }
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
    /// 選択肢のあとに差し込まれた返し。
    public let isReply: Bool

    public init(_ who: StorySpeaker, _ say: String, mood: String? = nil, bg: String? = nil,
                name: String? = nil, caseID: String? = nil, asksName: Bool = false,
                choices: [StoryChoice] = [], isReply: Bool = false) {
        self.who = who; self.say = say; self.mood = mood; self.bg = bg
        self.name = name; self.caseID = caseID; self.asksName = asksName
        self.choices = choices; self.isReply = isReply
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
    public let end: StoryEnd?
    public let lines: [StoryLine]

    public init(id: String, kind: String, chapter: String?, title: String, card: StoryCard?,
                bg: String, end: StoryEnd?, lines: [StoryLine]) {
        self.id = id; self.kind = kind; self.chapter = chapter; self.title = title
        self.card = card; self.bg = bg; self.end = end; self.lines = lines
    }
}

public enum StoryLibrary {

    public static let defaultName = "春野"
    public static let nameMax = 8

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
        if chapter.id == "ch6" && !seen.contains("epilogue") { out.append("epilogue") }
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

    public init(scene: StoryScene) {
        self.scene = scene
        phase = scene.card == nil ? .line : .card
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
        case .card: phase = .line; return false
        case .line: break
        }
        if waiting != nil { return false }
        reply = nil
        index += 1
        if index >= scene.lines.count { phase = .end; return true }
        return false
    }

    /// 名前を入れた。次の行へ進む。
    @discardableResult
    public func submitName() -> Bool {
        guard waiting == .name else { return false }
        index += 1
        if index >= scene.lines.count { phase = .end }
        return true
    }

    @discardableResult
    public func pick(_ i: Int) -> Bool {
        guard waiting == .choice, let l = line, l.choices.indices.contains(i) else { return false }
        picked = i
        reply = StoryLine(.doc, l.choices[i].reply, mood: "happy", isReply: true)
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
