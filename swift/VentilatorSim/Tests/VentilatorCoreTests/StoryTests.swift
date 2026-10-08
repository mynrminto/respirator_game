import Testing
@testable import VentilatorCore

/// 物語（幕）の検証。web/test.js の 26 番と同じ内容。

@Test func storyHasPrologueChaptersAndEpilogue() {
    let ids = StoryLibrary.scenes.map(\.id)
    #expect(ids.first == "prologue" && ids.last == "epilogue")
    for chapter in LessonLibrary.chapters {
        #expect(ids.contains(chapter.id + "-open"))
        #expect(ids.contains(chapter.id + "-close"))
    }
    #expect(StoryLibrary.scenes.flatMap(\.lines).filter(\.asksName).count == 1)
}

@Test func storyPlaysBeforeAndAfterLessons() {
    #expect(StoryLibrary.before(lessonID: "1-1", chapterID: "ch1", seen: []) == ["prologue", "ch1-open"])
    #expect(StoryLibrary.before(lessonID: "2-1", chapterID: "ch2", seen: ["prologue"]) == ["ch2-open"])
    #expect(StoryLibrary.before(lessonID: "1-2", chapterID: "ch1", seen: ["prologue", "ch1-open"]).isEmpty)
    let ch1 = LessonLibrary.chapter(of: "1-3")
    #expect(StoryLibrary.after(lessonID: "1-2", chapter: ch1, seen: []).isEmpty)
    #expect(StoryLibrary.after(lessonID: "1-3", chapter: ch1, seen: []) == ["ch1-close"])
    let ch6 = LessonLibrary.chapter(of: "6-3")
    #expect(StoryLibrary.after(lessonID: "6-3", chapter: ch6, seen: []) == ["ch6-close"])
    let last = LessonLibrary.chapter(of: "11-2")
    #expect(StoryLibrary.after(lessonID: "11-2", chapter: last, seen: []) == ["ch11-close"])
    let nicu = LessonLibrary.chapter(of: "13-4")
    #expect(StoryLibrary.after(lessonID: "13-4", chapter: nicu, seen: []) == ["ch13-close", "epilogue"])
}

@Test func storyNameIsCleaned() {
    #expect(StoryLibrary.cleanName("  山田先生 ") == "山田")
    #expect(StoryLibrary.cleanName("") == StoryLibrary.defaultName)
    #expect(StoryLibrary.cleanName(nil) == StoryLibrary.defaultName)
    #expect(StoryLibrary.cleanName("あいうえおかきくけこ").count == StoryLibrary.nameMax)
    #expect(StoryLibrary.fill("{名前}先生", name: "高橋") == "高橋先生")
}

@Test func storyRunWaitsForNameAndChoice() {
    let run = StoryRun(scene: StoryLibrary.scene(id: "prologue")!)
    #expect(run.phase == .card)
    run.next()
    #expect(run.phase == .line)
    while run.waiting == nil { run.next() }
    #expect(run.waiting == .name)
    #expect(run.next() == false && run.waiting == .name)    // 押しても名前の行からは進まない
    run.submitName()
    while run.waiting == nil { run.next() }
    #expect(run.waiting == .choice)
    run.pick(0)
    #expect(run.line?.isReply == true)
    run.next()
    #expect(run.waiting == nil)
    // 名前が無いまま飛ばすと、名前の行で止まる
    let fresh = StoryRun(scene: StoryLibrary.scene(id: "prologue")!)
    #expect(fresh.skip(hasName: false) == false && fresh.waiting == .name)
    #expect(fresh.skip(hasName: true) == true && fresh.phase == .end)
}

@Test func notebookGrowsWithTheStory() {
    let ids = Set(StoryLibrary.scenes.map(\.id))
    #expect(StoryLibrary.notebook.allSatisfy { ids.contains($0.scene) })
    #expect(Set(StoryLibrary.notebook.map(\.id)).count == StoryLibrary.notebook.count)
    // できるようになったことは、どの章の幕にも 1 つずつ
    for chapter in LessonLibrary.chapters {
        #expect(StoryLibrary.notebook.filter { $0.kind == .growth && $0.scene == chapter.id + "-close" }.count == 1)
    }
    // いぶき先生のことは、プロローグで始まりエピローグで終わる
    let secrets = StoryLibrary.notebook.filter { $0.kind == .secret }
    #expect(secrets.first?.scene == "prologue" && secrets.last?.scene == "epilogue")
    #expect(StoryLibrary.notesOpen(seen: []).isEmpty)
    #expect(StoryLibrary.notesAdded(before: [], after: ["prologue"]).map(\.id) == ["secret-1"])
    #expect(StoryLibrary.notesAdded(before: ["prologue"], after: ["prologue"]).isEmpty)
}

@Test func storyRemembersWhatThePlayerChose() {
    let epilogue = StoryLibrary.scene(id: "epilogue")!
    func says(_ picks: [String: Int]) -> [String] {
        let r = StoryRun(scene: epilogue, picks: picks)
        var out: [String] = []
        r.next()
        while r.phase != .end { if let l = r.line { out.append(l.say) }; r.next() }
        return out
    }
    #expect(says(["path": 0]).contains { $0.contains("やっぱり、小児科") })
    #expect(!says(["path": 2]).contains { $0.contains("やっぱり、小児科") })
    #expect(says([:]) == says(["path": 0, "photo": 0, "nerves": 0]))   // 選ばずに飛ばしたら 0 番
    let run = StoryRun(scene: StoryLibrary.scene(id: "ch9-close")!)
    while run.waiting != .choice { run.next() }
    run.pick(1)
    #expect(run.picks["aoiDad"] == 1 && run.line?.who == .doc)
}
