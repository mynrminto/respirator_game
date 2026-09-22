import SwiftUI
import VentilatorCore

/// 学習コースの帯。機器の画面の下に細く出し、実機を操作しながら課題を進められるようにする。
/// モーダルで画面を塞がないことが、この教材のいちばん大事なところ。
struct LessonCoachView: View {
    let controller: SimulationController

    /// 章ごとの色。帯の縁、章タグ、進み具合をこれでそろえる。
    private var tint: Color {
        Chrome.chapterColor(controller.lessonChapter?.id ?? "ch1")
    }
    /// みどり先生の表情。今の場面に合わせて変える。
    private var mood: CharacterMood {
        switch controller.lessonPhase {
        case .done, .feedback:
            return .happy
        case .task:
            if let runtime = controller.lessonRuntime, runtime.task?.quiz != nil {
                return runtime.lastAnswerWasWrong ? .sad : .think
            }
            if (controller.engine.alarms.map(\.severity).max() ?? 0) >= 2 { return .alert }
            return .normal
        }
    }
    @State private var collapsed = false
    @State private var showingBrief = false
    @State private var showingCourse = false
    @AppStorage("ventsim.lessons.done.v1") private var completedRaw = ""

    var body: some View {
        let _ = controller.lessonVersion       // ランタイムの変化を購読する
        if let lesson = controller.lesson, let runtime = controller.lessonRuntime {
            VStack(alignment: .leading, spacing: 0) {
                header(lesson: lesson, runtime: runtime)
                if !collapsed {
                    HStack(alignment: .top, spacing: 9) {
                        CharacterBadge(size: 40, ring: Chrome.isPop ? tint.opacity(0.5) : nil,
                                       background: Coach.choice) {
                            DoctorView(mood: mood)
                        }
                        VStack(alignment: .leading, spacing: 6) {
                            content(for: runtime)
                            watchStrip
                        }
                    }
                    .padding(.horizontal, 10)
                    .padding(.bottom, 8)
                }
            }
            .background(
                LinearGradient(colors: [Coach.bandTop, Coach.bandBottom],
                               startPoint: .top, endPoint: .bottom)
            )
            .overlay(alignment: .top) {
                Rectangle().fill(Chrome.isPop ? tint : Coach.line)
                    .frame(height: Chrome.isPop ? 3 : 1)
            }
            .sheet(isPresented: $showingBrief) { LessonBriefView(lesson: lesson) }
            .sheet(isPresented: $showingCourse) {
                LessonCourseView { controller.startLesson($0) }
            }
            .onChange(of: controller.lessonPhase) { _, phase in
                if phase == .done { markCompleted(lesson.id) }
            }
        }
    }

    // MARK: - 課題に関係する計測値

    /* 「右の計測値の Vte を見てください」と書く代わりに、その値を帯の中にも出す。
     * 操作が終わったら、課題に入った時点の値を左に添えて「前 → 後」で見せる。 */
    private var watchStrip: some View {
        let engine = controller.engine
        let showBefore = controller.lessonPhase != .task
        let captions = controller.lessonWatch
        return Group {
            if !captions.isEmpty {
                HStack(spacing: 6) {
                    ForEach(captions, id: \.self) { caption in
                        if let readout = Readout.find(caption) {
                            let now = readout.value(engine)
                            let before = showBefore ? controller.lessonWatchBefore[caption] : nil
                            watchPill(readout, now: now, before: before)
                        }
                    }
                }
            }
        }
    }

    private func watchPill(_ readout: Readout, now: String, before: String?) -> some View {
        let changed = before != nil && before != now
        return HStack(alignment: .firstTextBaseline, spacing: 5) {
            Text(readout.caption)
                .font(Chrome.label(9.5, weight: .bold))
                .foregroundStyle(Coach.faint)
            if let before, changed {
                Text("\(before) →")
                    .font(Chrome.digits(12, weight: .regular))
                    .foregroundStyle(Coach.faint)
            }
            Text(now)
                .font(Chrome.digits(15, weight: .bold))
                .foregroundStyle(changed ? tint : Coach.ink)
            Text(readout.unit)
                .font(.system(size: 9))
                .foregroundStyle(Coach.faint)
        }
        .padding(.horizontal, 10).padding(.vertical, 3)
        .background(
            RoundedRectangle(cornerRadius: Chrome.isPop ? 999 : Chrome.corner)
                .fill(Coach.choice)
                .overlay(RoundedRectangle(cornerRadius: Chrome.isPop ? 999 : Chrome.corner)
                    .stroke(changed ? tint : Coach.dot, lineWidth: Chrome.isPop ? 1.5 : 1))
        )
    }

    // MARK: - 見出し

    private func header(lesson: Lesson, runtime: LessonRuntime) -> some View {
        HStack(spacing: 8) {
            Button { collapsed.toggle() } label: {
                Image(systemName: collapsed ? "chevron.right" : "chevron.down")
                    .font(.system(size: 11, weight: .semibold))
            }
            .buttonStyle(.plain)
            .foregroundStyle(Coach.accent)
            .accessibilityLabel(collapsed ? "解説を開く" : "解説をたたむ")

            Text(lesson.title)
                .font(Chrome.label(12.5, weight: Chrome.isPop ? .heavy : .semibold))
                .foregroundStyle(Chrome.isPop ? Coach.ink : Coach.accent)
                .lineLimit(1)
            if let chapter = controller.lessonChapter {
                Text(chapter.tag)
                    .font(Chrome.label(10, weight: Chrome.isPop ? .bold : .regular))
                    .foregroundStyle(Chrome.isPop ? Color.white : Coach.faint)
                    .padding(.horizontal, Chrome.isPop ? 8 : 0)
                    .padding(.vertical, Chrome.isPop ? 2 : 0)
                    .background {
                        if Chrome.isPop { Capsule().fill(tint) }
                    }
                    .lineLimit(1)
            }
            Spacer(minLength: 4)
            dots(runtime: runtime)
            smallButton("解説") { showingBrief = true }
            smallButton("一覧") { showingCourse = true }
            smallButton("終了") { controller.endLesson() }
        }
        .padding(.horizontal, 10)
        .padding(.top, 6)
        .padding(.bottom, 4)
    }

    private func dots(runtime: LessonRuntime) -> some View {
        HStack(spacing: Chrome.isPop ? 4 : 3) {
            ForEach(0..<runtime.total, id: \.self) { i in
                Circle()
                    .fill(dotColor(i, runtime: runtime))
                    .frame(width: Chrome.isPop ? 8 : 6, height: Chrome.isPop ? 8 : 6)
            }
        }
        .accessibilityLabel("課題 \(min(runtime.index + 1, runtime.total)) / \(runtime.total)")
    }

    private func dotColor(_ i: Int, runtime: LessonRuntime) -> Color {
        if i < runtime.index { return Chrome.isPop ? tint : Chrome.flow }
        if i == runtime.index && controller.lessonPhase == .task { return Chrome.pressure }
        return Coach.dot
    }

    private func smallButton(_ title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(Chrome.label(11, weight: Chrome.isPop ? .bold : .regular))
                .foregroundStyle(Chrome.isPop ? Chrome.dim : Coach.accent)
                .padding(.horizontal, Chrome.isPop ? 11 : 8)
                .padding(.vertical, Chrome.isPop ? 4 : 3)
                .background(
                    RoundedRectangle(cornerRadius: Chrome.isPop ? 999 : 3)
                        .fill(Chrome.isPop ? Chrome.panel2 : Color.clear)
                        .overlay(RoundedRectangle(cornerRadius: Chrome.isPop ? 999 : 3)
                            .stroke(Coach.line, lineWidth: Chrome.isPop ? 1.5 : 1))
                )
        }
        .buttonStyle(.plain)
    }

    // MARK: - 中身

    @ViewBuilder
    private func content(for runtime: LessonRuntime) -> some View {
        switch controller.lessonPhase {
        case .done:
            VStack(alignment: .leading, spacing: 8) {
                Text("🎉 このレッスンは終わりです。"
                     + (runtime.wrongAnswers == 0 ? "クイズは全問一度で正解でした。" : ""))
                    .font(Chrome.label(12.5, weight: Chrome.isPop ? .bold : .regular))
                    .foregroundStyle(Chrome.good)
                HStack(spacing: 6) {
                    if let next = LessonLibrary.next(after: runtime.lesson.id) {
                        primaryButton("次のレッスンへ") { controller.startLesson(next) }
                    }
                    smallButton("コース一覧") { showingCourse = true }
                    smallButton("自由に操作する") { controller.endLesson() }
                }
            }
        case .feedback:
            VStack(alignment: .leading, spacing: 8) {
                Text(controller.lessonFeedback)
                    .font(.system(size: 12.5))
                    .foregroundStyle(Chrome.good)
                    .fixedSize(horizontal: false, vertical: true)
                primaryButton("次へ") { controller.continueLesson() }
            }
        case .task:
            if let task = runtime.task {
                if let quiz = task.quiz {
                    quizView(quiz, runtime: runtime)
                } else {
                    stepView(task, runtime: runtime)
                }
            }
        }
    }

    private func stepView(_ task: LessonTask, runtime: LessonRuntime) -> some View {
        let context = controller.lessonContext
        let hint = task.hint(context)
        return VStack(alignment: .leading, spacing: 4) {
            Text(task.instruction(context))
                .font(.system(size: 12.5))
                .foregroundStyle(Coach.ink)
                .fixedSize(horizontal: false, vertical: true)
            if !hint.isEmpty {
                Text(hint)
                    .font(.system(size: 11.5))
                    .foregroundStyle(Coach.faint)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if task.holdSeconds > 0 {
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule().fill(Coach.dot)
                        Capsule()
                            .fill(LinearGradient(colors: [tint, Chrome.pressure],
                                                 startPoint: .leading, endPoint: .trailing))
                            .frame(width: geo.size.width * runtime.holdFraction)
                    }
                }
                .frame(height: Chrome.isPop ? 6 : 2)
                .padding(.top, 4)
                .accessibilityLabel("この状態を保ってください")
            }
        }
    }

    private func quizView(_ quiz: LessonQuiz, runtime: LessonRuntime) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(quiz.question)
                .font(.system(size: 12.5))
                .foregroundStyle(Coach.ink)
                .fixedSize(horizontal: false, vertical: true)
            if runtime.lastAnswerWasWrong {
                Text("もう一度考えてみてください。")
                    .font(.system(size: 11.5))
                    .foregroundStyle(Chrome.warning)
            }
            ForEach(Array(quiz.choices.enumerated()), id: \.offset) { index, choice in
                Button { controller.answerLesson(index) } label: {
                    Text(choice)
                        .font(Chrome.label(12))
                        .foregroundStyle(wrong(index, runtime) ? Chrome.critical : Coach.ink)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, Chrome.isPop ? 11 : 9)
                        .padding(.vertical, Chrome.isPop ? 8 : 6)
                        .background(
                            RoundedRectangle(cornerRadius: Chrome.corner)
                                .fill(Coach.choice)
                                .overlay(RoundedRectangle(cornerRadius: Chrome.corner)
                                    .stroke(wrong(index, runtime) ? Chrome.critical.opacity(0.6) : Coach.line,
                                            lineWidth: Chrome.isPop ? 2 : 1))
                        )
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func wrong(_ index: Int, _ runtime: LessonRuntime) -> Bool {
        runtime.lastAnswerWasWrong && runtime.lastAnswer == index
    }

    /// 修了したレッスンを覚えておく。@AppStorage は 1 つの文字列なので、カンマ区切りで持つ。
    private func markCompleted(_ id: String) {
        var ids = completedRaw.split(separator: ",").map(String.init)
        guard !ids.contains(id) else { return }
        ids.append(id)
        completedRaw = ids.joined(separator: ",")
    }

    private func primaryButton(_ title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(Chrome.label(12, weight: .bold))
                .foregroundStyle(Chrome.isPop ? Color.white : Chrome.good)
                .padding(.horizontal, Chrome.isPop ? 14 : 12).padding(.vertical, 6)
                .background(
                    Group {
                        if Chrome.isPop {
                            Capsule().fill(tint)
                        } else {
                            RoundedRectangle(cornerRadius: 4)
                                .stroke(Chrome.good.opacity(0.6), lineWidth: 1)
                        }
                    }
                )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - 解説

/// レッスンの解説。読んでから操作に入るので、ここだけはシートにする。
struct LessonBriefView: View {
    let lesson: Lesson
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section {
                    ForEach(Array(lesson.brief.enumerated()), id: \.offset) { _, paragraph in
                        Text(paragraph).font(.callout)
                    }
                } header: {
                    Text("目安 \(lesson.minutes) 分")
                }
                Section("このレッスンで覚えること") {
                    ForEach(lesson.points, id: \.self) { point in
                        Label(point, systemImage: "checkmark.circle")
                            .font(.callout)
                    }
                }
            }
            .navigationTitle(lesson.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("操作に進む") { dismiss() }
                }
            }
        }
    }
}

// MARK: - コース一覧

struct LessonCourseView: View {
    /// 呼び出し側でレッスンの始め方が違うので、選ばれたことだけを伝える。
    var onSelect: (Lesson) -> Void
    @Environment(\.dismiss) private var dismiss
    @AppStorage("ventsim.lessons.done.v1") private var completedRaw = ""

    private var completed: Set<String> {
        Set(completedRaw.split(separator: ",").map(String.init))
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Text("呼吸器の操作を、実機の画面を触りながら順に覚えていくコースです。"
                         + "各レッスンは短い解説と、画面上での操作課題・クイズで組み立ててあります。"
                         + "上から順に進めるのが基本です。")
                        .font(.footnote).foregroundStyle(.secondary)
                    progressRow
                }
                ForEach(LessonLibrary.chapters) { chapter in
                    Section {
                        ForEach(Array(chapter.lessons.enumerated()), id: \.element.id) { index, lesson in
                            Button {
                                onSelect(lesson)
                                dismiss()
                            } label: {
                                lessonRow(lesson, number: index + 1,
                                          tint: Chrome.chapterColor(chapter.id))
                            }
                        }
                    } header: {
                        chapterHeader(chapter)
                    } footer: {
                        Text(chapter.subtitle)
                    }
                }
                if !completed.isEmpty {
                    Section {
                        Button("進捗を消す", role: .destructive) { completedRaw = "" }
                    }
                }
            }
            .navigationTitle("学習コース")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("閉じる") { dismiss() } }
            }
        }
    }

    /// 章の見出し。章の色の丸と、その章の修了数を出す。
    private func chapterHeader(_ chapter: LessonChapter) -> some View {
        let tint = Chrome.chapterColor(chapter.id)
        let done = chapter.lessons.filter { completed.contains($0.id) }.count
        return HStack(spacing: 8) {
            Circle().fill(tint).frame(width: 10, height: 10)
            Text(chapter.title)
            Spacer(minLength: 0)
            Text("\(done) / \(chapter.lessons.count)")
                .font(.caption2.weight(.bold))
                .foregroundStyle(Chrome.isPop ? Color.white : Color.secondary)
                .padding(.horizontal, Chrome.isPop ? 8 : 0)
                .padding(.vertical, Chrome.isPop ? 2 : 0)
                .background {
                    if Chrome.isPop { Capsule().fill(tint) }
                }
        }
    }

    /// 全体の進み具合。何レッスン終わったかが一目で分かるようにする。
    private var progressRow: some View {
        let total = max(1, LessonLibrary.all.count)
        let ratio = Double(completed.count) / Double(total)
        return HStack(spacing: 10) {
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.secondary.opacity(0.2))
                    Capsule()
                        .fill(LinearGradient(colors: [Color(red: 1.0, green: 0.369, blue: 0.541),
                                                      Color(red: 1.0, green: 0.690, blue: 0.125),
                                                      Color(red: 0.071, green: 0.769, blue: 0.545)],
                                             startPoint: .leading, endPoint: .trailing))
                        .frame(width: geo.size.width * ratio)
                }
            }
            .frame(height: 12)
            Text("\(Int((ratio * 100).rounded()))%")
                .font(Chrome.digits(18, weight: .bold))
            if completed.count >= total { Text("🏆") }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("修了 \(completed.count) / \(LessonLibrary.all.count) レッスン")
    }

    private func lessonRow(_ lesson: Lesson, number: Int, tint: Color) -> some View {
        let done = completed.contains(lesson.id)
        return HStack(spacing: 10) {
            ZStack {
                Circle()
                    .fill(done ? tint : Color.clear)
                    .overlay(Circle().stroke(tint.opacity(done ? 1 : 0.5), lineWidth: 2))
                    .frame(width: 24, height: 24)
                Text(done ? "✓" : "\(number)")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(done ? Color.white : tint)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(lesson.title).font(.callout.weight(Chrome.isPop ? .semibold : .regular))
                Text("目安 \(lesson.minutes) 分")
                    .font(.caption2).foregroundStyle(.secondary)
            }
        }
    }
}

/// レッスン帯の配色。学習中だと一目でわかるように、ポップでは章の色を使う。
/// 実機風のときは従来どおりの緑系のままにする。
enum Coach {
    static var bandTop: Color {
        Chrome.isPop ? .white : Color(red: 0.051, green: 0.102, blue: 0.090)
    }
    static var bandBottom: Color {
        Chrome.isPop ? Chrome.panel2 : Color(red: 0.043, green: 0.082, blue: 0.071)
    }
    static var line: Color {
        Chrome.isPop ? Chrome.line : Color(red: 0.086, green: 0.204, blue: 0.169)
    }
    static var accent: Color {
        Chrome.isPop ? Chrome.accent : Color(red: 0.659, green: 0.902, blue: 0.808)
    }
    static var ink: Color {
        Chrome.isPop ? Chrome.palette.coachInk : Color(red: 0.863, green: 0.937, blue: 0.906)
    }
    static var faint: Color {
        Chrome.isPop ? Chrome.palette.coachFaint : Color(red: 0.369, green: 0.541, blue: 0.482)
    }
    static var dot: Color {
        Chrome.isPop ? Chrome.line : Color(red: 0.106, green: 0.227, blue: 0.192)
    }
    static var choice: Color {
        Chrome.isPop ? Chrome.panel : Color(red: 0.059, green: 0.106, blue: 0.094)
    }
}
