import SwiftUI
import VentilatorCore

/// 学習コースの帯。ダイヤルのすぐ上に貼り付け、実機を操作しながら課題を進められるようにする。
/// モーダルで画面を塞がないことが、この教材のいちばん大事なところ。
///
/// 狭い画面（SE / mini）でも機器が見えるよう、帯は低く保つ。せりふは 2〜3 行ぶんの高さまでにし、
/// 長い解説やクイズの選択肢は帯の中だけでスクロールさせる。見出しの ▾ でたためる。
struct LessonCoachView: View {
    let controller: SimulationController

    /// 章ごとの色。帯の縁、章タグ、進み具合をこれでそろえる。
    private var tint: Color {
        Chrome.chapterColor(controller.lessonChapter?.id ?? "ch1")
    }
    /// いぶき先生の表情。今の場面に合わせて変える。
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
    /// いまの話し手。会話の場面以外はいぶき先生が進行役。
    private var speaker: LessonSpeaker {
        guard controller.lessonPhase == .task,
              let who = controller.lessonRuntime?.task?.speaker else { return .doctor }
        return who
    }
    private var currentTaskIsTalk: Bool {
        controller.lessonPhase == .task && (controller.lessonRuntime?.task?.isTalk ?? false)
    }
    private var speakerTint: Color {
        switch speaker {
        case .puku:    return Chrome.volume
        case .patient: return Chrome.accent
        default:       return tint
        }
    }
    @ViewBuilder
    private var speakerPortrait: some View {
        switch speaker {
        case .puku:
            FaceArt(CharacterArt.mascotNames(mood), focus: CharacterArt.mascotFocus,
                    zoom: CharacterArt.mascotZoom) {
                MascotView(mood: mood == .sad ? .sad : .happy, breathing: false)
            }
        case .patient:
            FaceArt(AppAssets.patientNames(caseID: controller.scenario.id, tone: patientTone),
                    focus: CharacterArt.patientFocus(controller.scenario.id),
                    zoom: CharacterArt.patientZoom) {
                PatientView(tone: patientTone)
            }
        default:
            FaceArt(CharacterArt.doctorNames(mood), focus: CharacterArt.doctorFocus) {
                DoctorView(mood: mood)
            }
        }
    }
    private var patientTone: PatientView.Tone {
        let worst = controller.engine.alarms.map(\.severity).max() ?? 0
        return worst >= 2 ? .bad : (worst >= 1 ? .mid : .ok)
    }

    @State private var collapsed = false
    @State private var showingBrief = false
    @State private var showingCourse = false
    /// 帯の中身の高さ。maxBodyHeight までは中身に合わせ、それを超えたら帯の中でスクロールさせる。
    @State private var bodyHeight: CGFloat = 0
    @AppStorage("ventsim.lessons.done.v1") private var completedRaw = ""

    /// せりふの文字。Dynamic Type に合わせるが、帯が高くなりすぎないよう頭打ちにする。
    @ScaledMetric(relativeTo: .subheadline) private var sayScaled: CGFloat = 13.5
    private var saySize: CGFloat { min(sayScaled, 18) }
    @ScaledMetric(relativeTo: .body) private var maxBodyScaled: CGFloat = 190
    private var maxBodyHeight: CGFloat { min(maxBodyScaled, 260) }

    var body: some View {
        let _ = controller.lessonVersion       // ランタイムの変化を購読する
        let _ = controller.tickCount           // セリフに差し込む実測値（{PIP} など）を追随させる
        if let lesson = controller.lesson, let runtime = controller.lessonRuntime {
            VStack(alignment: .leading, spacing: 0) {
                header(lesson: lesson, runtime: runtime)
                if !collapsed {
                    ScrollView(.vertical) {
                        bodyContent(runtime: runtime)
                            .padding(.horizontal, 10)
                            .padding(.bottom, 8)
                            .background(
                                GeometryReader { geo in
                                    Color.clear.preference(key: CoachBodyHeightKey.self,
                                                           value: geo.size.height)
                                }
                            )
                    }
                    .scrollBounceBehavior(.basedOnSize)
                    // 場面が変わったら一番上から読ませる。
                    .id(stepToken(runtime))
                    .frame(height: min(max(bodyHeight, 44), maxBodyHeight))
                    .onPreferenceChange(CoachBodyHeightKey.self) { bodyHeight = $0 }
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
            // たたんだままでも、次の場面が来たら開いて見せる（見落として止まるのを防ぐ）。
            .onChange(of: stepToken(runtime)) { _, _ in collapsed = false }
        }
    }

    private func stepToken(_ runtime: LessonRuntime) -> String {
        let phase: String
        switch controller.lessonPhase {
        case .task: phase = "t"
        case .feedback: phase = "f"
        case .done: phase = "d"
        }
        return "\(runtime.lesson.id)#\(runtime.index)#\(phase)"
    }

    private func bodyContent(runtime: LessonRuntime) -> some View {
        HStack(alignment: .top, spacing: 8) {
            if speaker != .scene {
                // FaceArt が自分で顔の位置に寄せるので、ここでは拡大しない。
                CharacterBadge(size: 34, zoom: 1,
                               ring: Chrome.isPop ? speakerTint.opacity(0.6) : nil,
                               background: Coach.choice) {
                    speakerPortrait
                }
            }
            VStack(alignment: .leading, spacing: 5) {
                if !speaker.displayName.isEmpty && currentTaskIsTalk {
                    Text(speaker.displayName)
                        .font(Chrome.label(11, weight: .heavy))
                        .foregroundStyle(speakerTint)
                }
                content(for: runtime)
                watchStrip
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    // MARK: - 課題に関係する計測値

    /* 「右の計測値の Vte を見てください」と書く代わりに、その値を帯の中にも出す。
     * 操作が終わったら、課題に入った時点の値を左に添えて「前 → 後」で見せる。
     * 解説を読んでいるあいだは、解説が出た瞬間の値で止めておく（読んでいる途中で数字が動くと、
     * 解説の文と食い違って見える）。 */
    private var watchStrip: some View {
        let engine = controller.engine
        let frozen = controller.lessonPhase != .task
        let captions = controller.lessonWatch
        return Group {
            if !captions.isEmpty {
                // 3 つ並ぶと狭い画面では入りきらない。横に流さず折り返す。
                FlowLayout(spacing: 6, lineSpacing: 6) {
                    ForEach(captions, id: \.self) { caption in
                        if let readout = Readout.find(caption) {
                            let live = readout.value(engine)
                            let now = frozen ? (controller.lessonWatchAfter[caption] ?? live) : live
                            let before = frozen ? controller.lessonWatchBefore[caption] : nil
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
                .font(Chrome.label(11, weight: .bold))
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
                .font(Chrome.label(10))
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
        HStack(spacing: 4) {
            Button { collapsed.toggle() } label: {
                Image(systemName: collapsed ? "chevron.up" : "chevron.down")
                    .font(.system(size: 14, weight: .semibold))
                    .frame(width: 44, height: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .foregroundStyle(Coach.accent)
            .accessibilityLabel(collapsed ? "課題を開く" : "課題をたたむ")

            VStack(alignment: .leading, spacing: 2) {
                Text(lesson.title)
                    .font(Chrome.label(13, weight: Chrome.isPop ? .heavy : .semibold))
                    .foregroundStyle(Chrome.isPop ? Coach.ink : Coach.accent)
                    .lineLimit(1)
                HStack(spacing: 6) {
                    if let chapter = controller.lessonChapter {
                        Text(chapter.tag)
                            .font(Chrome.label(10, weight: Chrome.isPop ? .bold : .regular))
                            .foregroundStyle(Chrome.isPop ? Color.white : Coach.faint)
                            .padding(.horizontal, Chrome.isPop ? 6 : 0)
                            .padding(.vertical, Chrome.isPop ? 1 : 0)
                            .background {
                                if Chrome.isPop { Capsule().fill(tint) }
                            }
                            .lineLimit(1)
                            .fixedSize()
                    }
                    dots(runtime: runtime)
                }
            }
            Spacer(minLength: 2)
            smallButton("解説") { showingBrief = true }
            smallButton("一覧") { showingCourse = true }
            smallButton("終了") { controller.endLesson() }
        }
        .padding(.trailing, 6)
    }

    /* 点は「やること」の数だけ。会話の場面まで点にすると、読んだだけで進んだように見える。 */
    private func dots(runtime: LessonRuntime) -> some View {
        let spots = runtime.lesson.tasks.indices.filter { !runtime.lesson.tasks[$0].isTalk }
        return HStack(spacing: Chrome.isPop ? 4 : 3) {
            ForEach(spots, id: \.self) { i in
                Circle()
                    .fill(dotColor(i, runtime: runtime))
                    .frame(width: Chrome.isPop ? 7 : 6, height: Chrome.isPop ? 7 : 6)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("課題 \(min(runtime.actionDone + 1, runtime.actionTotal)) / \(runtime.actionTotal)")
    }

    private func dotColor(_ i: Int, runtime: LessonRuntime) -> Color {
        if i < runtime.index { return Chrome.isPop ? tint : Chrome.flow }
        if i == runtime.actionIndex && controller.lessonPhase == .task { return Chrome.pressure }
        return Coach.dot
    }

    /// 見た目は小さな枠、押せる範囲は 44pt 四方。
    private func smallButton(_ title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(Chrome.label(12, weight: Chrome.isPop ? .bold : .regular))
                .foregroundStyle(Chrome.isPop ? Chrome.dim : Coach.accent)
                .lineLimit(1)
                .fixedSize()
                .padding(.horizontal, Chrome.isPop ? 9 : 7)
                .padding(.vertical, 5)
                .background(
                    RoundedRectangle(cornerRadius: Chrome.isPop ? 999 : 3)
                        .fill(Chrome.isPop ? Chrome.panel2 : Color.clear)
                        .overlay(RoundedRectangle(cornerRadius: Chrome.isPop ? 999 : 3)
                            .stroke(Coach.line, lineWidth: Chrome.isPop ? 1.5 : 1))
                )
                .frame(minWidth: 44, minHeight: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    // MARK: - 中身

    @ViewBuilder
    private func content(for runtime: LessonRuntime) -> some View {
        switch controller.lessonPhase {
        case .done:
            doneView(runtime)
        case .feedback:
            VStack(alignment: .leading, spacing: 6) {
                Text(controller.lessonFeedback)
                    .font(.system(size: saySize))
                    .foregroundStyle(Chrome.good)
                    .fixedSize(horizontal: false, vertical: true)
                primaryButton("次へ") { controller.continueLesson() }
            }
        case .task:
            if let task = runtime.task {
                if task.isTalk {
                    talkView(task)
                } else if let quiz = task.quiz {
                    quizView(quiz, runtime: runtime)
                } else {
                    stepView(task, runtime: runtime)
                }
            }
        }
    }

    /// 修了。覚えることを並べ直してから、次へ進む道を出す。
    private func doneView(_ runtime: LessonRuntime) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("🎉 このレッスンは終わりです。"
                 + (runtime.wrongAnswers == 0 ? "クイズは全問一度で正解でした。" : ""))
                .font(Chrome.label(saySize, weight: Chrome.isPop ? .bold : .regular))
                .foregroundStyle(Chrome.good)
                .fixedSize(horizontal: false, vertical: true)
            if !runtime.lesson.points.isEmpty {
                VStack(alignment: .leading, spacing: 3) {
                    Text("このレッスンで覚えること")
                        .font(Chrome.label(11, weight: .bold))
                        .foregroundStyle(Coach.faint)
                    ForEach(runtime.lesson.points, id: \.self) { point in
                        HStack(alignment: .firstTextBaseline, spacing: 5) {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.system(size: 11))
                                .foregroundStyle(tint)
                            Text(point.subscripted)
                                .font(.system(size: saySize - 1))
                                .foregroundStyle(Coach.ink)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
            }
            FlowLayout(spacing: 6, lineSpacing: 6) {
                if let next = LessonLibrary.next(after: runtime.lesson.id) {
                    primaryButton("次のレッスンへ") { controller.startLesson(next) }
                }
                smallButton("コース一覧") { showingCourse = true }
                smallButton("自由に操作する") { controller.endLesson() }
            }
        }
    }

    /* 会話の場面。ト書きは人のせりふではないので、細く寝かせて縦線で区別する。 */
    private func talkView(_ task: LessonTask) -> some View {
        let isScene = task.speaker == .scene
        return VStack(alignment: .leading, spacing: 6) {
            Text(controller.fillSay(task.instruction(controller.lessonContext)))
                .font(.system(size: saySize, weight: isScene ? .regular : .medium,
                              design: .default))
                .italic(isScene)
                .foregroundStyle(isScene ? Coach.faint : Coach.ink)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.leading, isScene ? 9 : 0)
                .overlay(alignment: .leading) {
                    if isScene {
                        Rectangle().fill(Coach.line).frame(width: 3)
                    }
                }
            primaryButton("続ける") { controller.tapLesson() }
        }
    }

    private func stepView(_ task: LessonTask, runtime: LessonRuntime) -> some View {
        let context = controller.lessonContext
        // 違うキーを押したときの一言（web の missEvents）は、ヒントの位置に出す。
        var missed: String?
        if case .event = task.advance, let feedback = runtime.feedback, !feedback.ok {
            missed = feedback.text
        }
        let hint = missed ?? controller.fillSay(task.hint(context))
        return VStack(alignment: .leading, spacing: 4) {
            Text(controller.fillSay(task.instruction(context)))
                .font(.system(size: saySize, weight: .medium))
                .foregroundStyle(Coach.ink)
                .fixedSize(horizontal: false, vertical: true)
            if !hint.isEmpty {
                Text(hint)
                    .font(.system(size: saySize - 1.5))
                    .foregroundStyle(missed != nil ? Chrome.warning : Coach.faint)
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
        // 選択肢がどれも短ければ 2 列に並べて帯を低く保つ。長いものがあれば 1 列で折り返す。
        let short = quiz.choices.allSatisfy { $0.count <= 12 }
        let columns = short ? [GridItem(.flexible(), spacing: 6), GridItem(.flexible(), spacing: 6)]
                            : [GridItem(.flexible())]
        return VStack(alignment: .leading, spacing: 5) {
            Text(controller.fillSay(quiz.questionText(controller.lessonContext)))
                .font(.system(size: saySize, weight: .medium))
                .foregroundStyle(Coach.ink)
                .fixedSize(horizontal: false, vertical: true)
            if runtime.lastAnswerWasWrong {
                // 選んだ選択肢ごとの「なぜ違うか」を添える（web の quiz.miss）。
                Text(runtime.feedback.map { $0.ok ? "もう一度考えてみてください。" : $0.text }
                     ?? "もう一度考えてみてください。")
                    .font(.system(size: saySize - 1.5))
                    .foregroundStyle(Chrome.warning)
            }
            LazyVGrid(columns: columns, alignment: .leading, spacing: 6) {
                ForEach(Array(quiz.choices.enumerated()), id: \.offset) { index, choice in
                    choiceButton(choice, index: index, runtime: runtime)
                }
            }
        }
    }

    private func choiceButton(_ choice: String, index: Int, runtime: LessonRuntime) -> some View {
        let isWrong = wrong(index, runtime)
        return Button { controller.answerLesson(index) } label: {
            Text(controller.fillSay(choice))
                .font(Chrome.label(saySize - 0.5))
                .foregroundStyle(isWrong ? Chrome.critical : Coach.ink)
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.vertical, 6)
                .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                .padding(.horizontal, Chrome.isPop ? 11 : 9)
                .background(
                    RoundedRectangle(cornerRadius: Chrome.corner)
                        .fill(Coach.choice)
                        .overlay(RoundedRectangle(cornerRadius: Chrome.corner)
                            .stroke(isWrong ? Chrome.critical.opacity(0.6) : Coach.line,
                                    lineWidth: Chrome.isPop ? 2 : 1))
                )
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
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
                .font(Chrome.label(14, weight: .bold))
                .foregroundStyle(Chrome.isPop ? Color.white : Chrome.good)
                .lineLimit(1)
                .fixedSize()
                .padding(.horizontal, Chrome.isPop ? 18 : 14)
                .frame(minWidth: 88, minHeight: 44)
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
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

/// 帯の中身の高さを測るためのキー。
private struct CoachBodyHeightKey: PreferenceKey {
    static let defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = max(value, nextValue())
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
                    Text("PICU と NICU の 6 人の子どもを受け持ちながら、呼吸器の操作を順に覚えていくコースです。"
                         + "いぶき先生とぷくぷくの会話を追っていくと、そのつど実機を触ることになります。"
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
