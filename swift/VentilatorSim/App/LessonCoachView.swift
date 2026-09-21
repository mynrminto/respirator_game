import SwiftUI
import VentilatorCore

/// 学習コースの帯。機器の画面の下に細く出し、実機を操作しながら課題を進められるようにする。
/// モーダルで画面を塞がないことが、この教材のいちばん大事なところ。
struct LessonCoachView: View {
    let controller: SimulationController
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
                    content(for: runtime)
                        .padding(.horizontal, 10)
                        .padding(.bottom, 8)
                }
            }
            .background(
                LinearGradient(colors: [Coach.bandTop, Coach.bandBottom],
                               startPoint: .top, endPoint: .bottom)
            )
            .overlay(alignment: .top) { Rectangle().fill(Coach.line).frame(height: 1) }
            .sheet(isPresented: $showingBrief) { LessonBriefView(lesson: lesson) }
            .sheet(isPresented: $showingCourse) {
                LessonCourseView { controller.startLesson($0) }
            }
            .onChange(of: lesson.id) { _, _ in showingBrief = true }
            .onAppear { showingBrief = true }
            .onChange(of: controller.lessonPhase) { _, phase in
                if phase == .done { markCompleted(lesson.id) }
            }
        }
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
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Coach.accent)
                .lineLimit(1)
            if let chapter = controller.lessonChapter {
                Text(chapter.tag)
                    .font(.system(size: 10))
                    .foregroundStyle(Coach.faint)
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
        HStack(spacing: 3) {
            ForEach(0..<runtime.total, id: \.self) { i in
                Circle()
                    .fill(dotColor(i, runtime: runtime))
                    .frame(width: 6, height: 6)
            }
        }
        .accessibilityLabel("課題 \(min(runtime.index + 1, runtime.total)) / \(runtime.total)")
    }

    private func dotColor(_ i: Int, runtime: LessonRuntime) -> Color {
        if i < runtime.index { return Chrome.flow }
        if i == runtime.index && controller.lessonPhase == .task { return Chrome.pressure }
        return Coach.dot
    }

    private func smallButton(_ title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 11))
                .foregroundStyle(Coach.accent)
                .padding(.horizontal, 8).padding(.vertical, 3)
                .background(RoundedRectangle(cornerRadius: 3).stroke(Coach.line, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    // MARK: - 中身

    @ViewBuilder
    private func content(for runtime: LessonRuntime) -> some View {
        switch controller.lessonPhase {
        case .done:
            VStack(alignment: .leading, spacing: 8) {
                Text("このレッスンは終わりです。"
                     + (runtime.wrongAnswers == 0 ? "クイズは全問一度で正解でした。" : ""))
                    .font(.system(size: 12.5))
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
                        Capsule().fill(Chrome.flow)
                            .frame(width: geo.size.width * runtime.holdFraction)
                    }
                }
                .frame(height: 2)
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
                        .font(.system(size: 12))
                        .foregroundStyle(wrong(index, runtime) ? Chrome.critical : Coach.ink)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 9).padding(.vertical, 6)
                        .background(
                            RoundedRectangle(cornerRadius: 4)
                                .fill(Coach.choice)
                                .overlay(RoundedRectangle(cornerRadius: 4)
                                    .stroke(wrong(index, runtime) ? Chrome.critical.opacity(0.6) : Coach.line,
                                            lineWidth: 1))
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
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Chrome.good)
                .padding(.horizontal, 12).padding(.vertical, 6)
                .background(RoundedRectangle(cornerRadius: 4)
                    .stroke(Chrome.good.opacity(0.6), lineWidth: 1))
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
                    LabeledContent("修了", value: "\(completed.count) / \(LessonLibrary.all.count) レッスン")
                }
                ForEach(LessonLibrary.chapters) { chapter in
                    Section {
                        ForEach(chapter.lessons) { lesson in
                            Button {
                                onSelect(lesson)
                                dismiss()
                            } label: {
                                HStack(spacing: 10) {
                                    Image(systemName: completed.contains(lesson.id)
                                          ? "checkmark.circle.fill" : "circle")
                                        .foregroundStyle(completed.contains(lesson.id) ? .green : .secondary)
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(lesson.title).font(.callout)
                                        Text("目安 \(lesson.minutes) 分")
                                            .font(.caption2).foregroundStyle(.secondary)
                                    }
                                }
                            }
                        }
                    } header: {
                        Text(chapter.title)
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
}

/// レッスン帯の配色。機器の画面（Chrome）とは別系統にして、学習中だと一目でわかるようにする。
enum Coach {
    static let bandTop = Color(red: 0.051, green: 0.102, blue: 0.090)
    static let bandBottom = Color(red: 0.043, green: 0.082, blue: 0.071)
    static let line = Color(red: 0.086, green: 0.204, blue: 0.169)
    static let accent = Color(red: 0.659, green: 0.902, blue: 0.808)
    static let ink = Color(red: 0.863, green: 0.937, blue: 0.906)
    static let faint = Color(red: 0.369, green: 0.541, blue: 0.482)
    static let dot = Color(red: 0.106, green: 0.227, blue: 0.192)
    static let choice = Color(red: 0.059, green: 0.106, blue: 0.094)
}
