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
    #expect(StoryLibrary.after(lessonID: "6-3", chapter: ch6, seen: []) == ["ch6-close", "epilogue"])
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
