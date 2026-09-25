import SwiftUI
import VentilatorCore

/// 物語の記録。見た幕と主人公の名前。Web 版 app.js の STORY_KEY / PLAYER_KEY と同じ名前で持つ。
enum StoryProgress {
    static let seenKey = "ventsim.story.seen.v1"
    static let nameKey = "ventsim.player.v1"

    static var seen: [String] { UserDefaults.standard.stringArray(forKey: seenKey) ?? [] }

    static func markSeen(_ id: String) {
        var s = seen
        guard !s.contains(id) else { return }
        s.append(id)
        UserDefaults.standard.set(s, forKey: seenKey)
    }

    /// 名前がまだ決まっていなければ nil。
    static var storedName: String? {
        guard let raw = UserDefaults.standard.string(forKey: nameKey), !raw.isEmpty else { return nil }
        return StoryLibrary.cleanName(raw)
    }

    static var playerName: String { storedName ?? StoryLibrary.defaultName }

    static func setName(_ raw: String) {
        UserDefaults.standard.set(StoryLibrary.cleanName(raw), forKey: nameKey)
    }
}

/// 物語の幕。機器を覆う紙芝居として、背景 → 立ち絵 → 下の会話窓の 3 層で見せる。
/// 押すと 1 行進む。文字は 1 字ずつ出し、途中で押すと最後まで出す。Web 版 app.js の playStories と同じ。
struct StoryView: View {
    let ids: [String]
    var onFinish: () -> Void
    /// エピローグのあとの「症例で練習する」。
    var onCases: () -> Void = {}

    @State private var queue: [String] = []
    @State private var run: StoryRun?
    /// StoryRun はクラスなので、進めたらこれを変えて描き直させる。
    @State private var version = 0
    @State private var shown = 0
    @State private var nameText = ""
    @State private var finalStep = false
    /// 飛ばして名前の行で止まったときは、文字送りをせずに全文を出す。
    @State private var instant = false
    /// 主人公の台詞のあいだも、話している相手の立ち絵を残しておく。
    @State private var lastPortrait: StoryLine?
    @FocusState private var nameFocused: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private let charsPerSecond: Double = 42

    var body: some View {
        GeometryReader { geo in
            ZStack {
                background
                if let run, run.phase == .card, let card = run.scene.card {
                    cardView(card, chapter: run.scene.chapter)
                } else {
                    portrait(height: geo.size.height)
                    VStack { Spacer(minLength: 0); dialogBox }
                        .padding(.horizontal, 12)
                        .padding(.bottom, 10)
                }
                VStack { topBar; Spacer() }
            }
        }
        .contentShape(Rectangle())
        .onTapGesture { tap() }
        .preferredColorScheme(Chrome.colorScheme)
        .onAppear {
            queue = ids
            nextScene()
        }
    }

    // MARK: - 部品

    private var currentLine: StoryLine? { _ = version; return run?.line }
    private var fullText: String {
        guard let l = currentLine else { return "" }
        return StoryLibrary.fill(l.say, name: StoryProgress.playerName)
    }
    private var isTyping: Bool { shown < fullText.count && !finalStep }

    private var backgroundKey: String {
        _ = version
        guard let run else { return "picu" }
        var key = run.scene.bg
        let upto = min(run.index, run.scene.lines.count - 1)
        if upto >= 0 { for i in 0...upto { if let bg = run.scene.lines[i].bg { key = bg } } }
        return key
    }

    private var background: some View {
        let key = backgroundKey
        let dark = key == "night" || key == "station"
        // fill で広げた絵は画面より大きくなる。ZStack にそのまま置くと ZStack ごと横に広がり、
        // 台詞の枠や名前の入力欄が画面の外へはみ出す（iPhone で右側が切れて押せなかった）。
        // 大きさは Color.clear で決め、絵は overlay に入れて寸法に関わらせない。
        return Color.clear
            .overlay {
                ZStack {
                    LinearGradient(colors: [Chrome.chassisTop, Chrome.chassis], startPoint: .top, endPoint: .bottom)
                    Art(StoryLibrary.backgrounds[key] ?? ["bg_title_day"], fit: .fill) { Color.clear }
                    LinearGradient(colors: dark ? [Color.black.opacity(0.4), Color.black.opacity(0.6)]
                                                : [Color.black.opacity(0.12), Color.clear, Color.black.opacity(0.4)],
                                   startPoint: .top, endPoint: .bottom)
                }
            }
            .clipped()
            .ignoresSafeArea()
    }

    private var topBar: some View {
        HStack {
            Text(run.map { $0.scene.card?.sub ?? $0.scene.title } ?? "")
                .font(Chrome.label(12, weight: .bold))
                .foregroundStyle(.white)
                .lineLimit(1)
                .padding(.horizontal, 12).padding(.vertical, 5)
                .background(Capsule().fill(Color.black.opacity(0.45)))
            Spacer()
            Button { skip() } label: {
                Text("スキップ ▸▸")
                    .font(Chrome.label(12, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 12).padding(.vertical, 5)
                    .background(Capsule().fill(Color.black.opacity(0.45)))
                    .overlay(Capsule().stroke(Color.white.opacity(0.55), lineWidth: 1))
            }
            .opacity(finalStep ? 0 : 1)
        }
        .padding(.horizontal, 12)
        .padding(.top, 6)
    }

    private func cardView(_ card: StoryCard, chapter: String?) -> some View {
        VStack(spacing: 10) {
            Text(card.kicker)
                .font(Chrome.label(15, weight: .heavy))
                .foregroundStyle(Chrome.chapterColor(chapter ?? "ch1"))
                .padding(.horizontal, 16).padding(.vertical, 3)
                .background(Capsule().fill(Color.white))
            Text(card.title)
                .font(Chrome.label(34, weight: .heavy))
                .foregroundStyle(.white)
                .multilineTextAlignment(.center)
                .shadow(color: .black.opacity(0.3), radius: 0, y: 3)
            Text(card.sub)
                .font(Chrome.label(14, weight: .bold))
                .foregroundStyle(.white.opacity(0.92))
            Text("タップで進む")
                .font(Chrome.label(12))
                .foregroundStyle(.white.opacity(0.8))
                .padding(.top, 40)
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.black.opacity(0.5).ignoresSafeArea())
        .transition(.opacity)
    }

    /// 立ち絵。ト書き・家族では引っ込め、主人公の台詞では直前の相手を暗くして残す。
    @ViewBuilder
    private func portrait(height: CGFloat) -> some View {
        let line = currentLine
        let shownLine: StoryLine? = {
            guard let line else { return nil }
            if hasPortrait(line) { return line }
            return line.who == .me ? lastPortrait : nil
        }()
        VStack {
            Spacer(minLength: 0)
            if let p = shownLine {
                figure(p, height: height)
                    .brightness(line?.who == .me ? -0.22 : 0)
                    .id(p.who.rawValue + (p.caseID ?? ""))
                    .transition(.asymmetric(insertion: .offset(y: 24).combined(with: .opacity), removal: .opacity))
            }
        }
        .padding(.bottom, 110)
        .frame(maxWidth: .infinity)
        .allowsHitTesting(false)
        .animation(reduceMotion ? nil : .spring(response: 0.35, dampingFraction: 0.7), value: shownLine?.who.rawValue)
    }

    private func hasPortrait(_ l: StoryLine) -> Bool {
        switch l.who {
        case .doc, .puku, .nurse: return true
        case .pt: return l.caseID != nil
        default: return false
        }
    }

    @ViewBuilder
    private func figure(_ l: StoryLine, height: CGFloat) -> some View {
        switch l.who {
        case .doc:
            let mood = doctorMood(l.mood)
            Art(CharacterArt.doctorNames(mood)) { DoctorView(mood: mood) }
                .frame(maxHeight: min(560, height * 0.66))
                .shadow(color: .black.opacity(0.3), radius: 8, y: 8)
        case .puku:
            let mood = mascotMood(l.mood)
            Art(CharacterArt.mascotNames(mood)) { MascotView(mood: mood) }
                .frame(maxHeight: min(320, height * 0.36))
        case .nurse:
            Art(["nurse_normal"]) {
                Text("看")
                    .font(.system(size: 48, weight: .heavy))
                    .foregroundStyle(Color(red: 1, green: 0.54, blue: 0.24))
                    .frame(width: 112, height: 112)
                    .background(Circle().fill(Color(red: 1, green: 0.89, blue: 0.82)))
                    .overlay(Circle().stroke(Chrome.ink, lineWidth: 4))
            }
            .frame(maxHeight: min(520, height * 0.6))
        case .pt:
            let id = l.caseID ?? "postop"
            FaceArt(AppAssets.patientNames(caseID: id, tone: .ok),
                    focus: CharacterArt.patientFocus(id), zoom: 1.9) {
                PatientView(tone: .ok)
            }
            .frame(width: min(360, height * 0.42), height: min(360, height * 0.42))
            .background(Color(red: 0.87, green: 0.91, blue: 0.96))
            .clipShape(RoundedRectangle(cornerRadius: 24))
            .overlay(RoundedRectangle(cornerRadius: 24).stroke(Color.white, lineWidth: 4))
            .shadow(color: .black.opacity(0.3), radius: 10, y: 8)
        default:
            EmptyView()
        }
    }

    private func doctorMood(_ s: String?) -> CharacterMood {
        switch s {
        case "happy": return .happy
        case "think": return .think
        case "alert": return .alert
        default: return .normal
        }
    }

    /// ぷくぷくの絵の名前は CharacterArt.mascotNames に合わせる（excited の絵は .happy で引く）。
    private func mascotMood(_ s: String?) -> CharacterMood {
        switch s {
        case "excited": return .happy
        case "sad": return .sad
        case "alert": return .alert
        default: return .normal
        }
    }

    private func nameTint(_ who: StorySpeaker) -> Color {
        switch who {
        case .doc: return Color(red: 0.07, green: 0.77, blue: 0.55)
        case .puku: return Color(red: 0.36, green: 0.49, blue: 0.98)
        case .me: return Color(red: 1, green: 0.37, blue: 0.54)
        case .nurse: return Color(red: 1, green: 0.54, blue: 0.24)
        default: return Color(red: 0.55, green: 0.42, blue: 1)
        }
    }

    private var dialogBox: some View {
        let line = currentLine
        let speaker = line.map { StoryLibrary.speakerName($0, name: StoryProgress.playerName) } ?? ""
        let text = finalStep ? (run?.scene.end?.say ?? "") : String(fullText.prefix(shown))
        let isScene = finalStep || line?.who == .scene
        return VStack(alignment: .leading, spacing: 12) {
            Text(text)
                .font(Chrome.label(16, weight: .medium))
                .foregroundStyle(isScene ? Chrome.dim : Chrome.ink)
                .lineSpacing(6)
                .frame(maxWidth: .infinity, minHeight: 56, alignment: .topLeading)
                .padding(.leading, isScene ? 10 : 0)
                .overlay(alignment: .leading) {
                    if isScene { Rectangle().fill(Chrome.line).frame(width: 3) }
                }
            actions
        }
        .padding(.horizontal, 18)
        .padding(.top, 22)
        .padding(.bottom, 16)
        .frame(maxWidth: 760)
        .background(
            RoundedRectangle(cornerRadius: Chrome.isPop ? 20 : 6)
                .fill(Chrome.panel.opacity(0.97))
        )
        .overlay(
            RoundedRectangle(cornerRadius: Chrome.isPop ? 20 : 6)
                .stroke(Chrome.isPop ? Chrome.ink : Chrome.line, lineWidth: Chrome.isPop ? 3 : 1)
        )
        .overlay(alignment: .topLeading) {
            if !speaker.isEmpty && !finalStep {
                Text(speaker)
                    .font(Chrome.label(13.5, weight: .heavy))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 14).padding(.vertical, 4)
                    .background(Capsule().fill(nameTint(line?.who ?? .doc)))
                    .overlay(Capsule().stroke(Chrome.ink, lineWidth: Chrome.isPop ? 3 : 0))
                    .offset(x: 16, y: -16)
            }
        }
        .overlay(alignment: .bottomTrailing) {
            if !isTyping && run?.waiting == nil && !finalStep {
                Text("▼").font(.system(size: 13)).foregroundStyle(Chrome.accent)
                    .padding(.trailing, 16).padding(.bottom, 8)
            }
        }
        .task(id: "\(run?.scene.id ?? "")|\(version)") { await typeLine() }
    }

    @ViewBuilder
    private var actions: some View {
        if finalStep, let end = run?.scene.end {
            HStack(spacing: 8) {
                storyButton(end.label, primary: true) { finish(openCases: end.action == "cases") }
                storyButton("閉じる", primary: false) { finish(openCases: false) }
            }
        } else if !isTyping, let run, let waiting = run.waiting {
            switch waiting {
            case .name:
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 8) {
                        TextField(StoryLibrary.defaultName, text: $nameText)
                            .textFieldStyle(.plain)
                            .font(Chrome.label(17, weight: .bold))
                            .padding(.horizontal, 12).padding(.vertical, 10)
                            .background(RoundedRectangle(cornerRadius: 12).fill(Chrome.panel2))
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Chrome.ink, lineWidth: Chrome.isPop ? 2.5 : 1))
                            .focused($nameFocused)
                            .submitLabel(.done)
                            .onSubmit { submitName() }
                            .onChange(of: nameText) { _, v in
                                if v.count > StoryLibrary.nameMax { nameText = String(v.prefix(StoryLibrary.nameMax)) }
                            }
                        storyButton("決める", primary: true) { submitName() }
                            .fixedSize()
                    }
                    Text("いぶき先生は「〇〇先生」と呼びます。空のままなら「\(StoryLibrary.defaultName)」。")
                        .font(Chrome.label(11.5)).foregroundStyle(Chrome.dim)
                }
                .onAppear {
                    nameText = StoryProgress.storedName ?? ""
                    nameFocused = true
                }
            case .choice:
                HStack(spacing: 8) {
                    ForEach(Array((run.line?.choices ?? []).enumerated()), id: \.offset) { i, c in
                        storyButton(c.label, primary: false) {
                            run.pick(i)
                            advanced()
                        }
                    }
                }
            }
        }
    }

    private func storyButton(_ title: String, primary: Bool, action: @escaping () -> Void) -> some View {
        Button {
            SoundBoard.shared.play(.tap)
            action()
        } label: {
            Text(title)
                .font(Chrome.label(14.5, weight: .heavy))
                .foregroundStyle(primary ? Color.white : Chrome.ink)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 11)
                .background(RoundedRectangle(cornerRadius: Chrome.isPop ? 14 : 4)
                    .fill(primary ? Chrome.accent : Chrome.panel))
                .overlay(RoundedRectangle(cornerRadius: Chrome.isPop ? 14 : 4)
                    .stroke(Chrome.isPop ? Chrome.ink : Chrome.line, lineWidth: Chrome.isPop ? 2.5 : 1))
        }
        .buttonStyle(.plain)
    }

    // MARK: - 進行

    private func typeLine() async {
        let total = fullText.count
        if reduceMotion || finalStep || instant { shown = total; instant = false; return }
        shown = 0
        let step = UInt64(1_000_000_000 / charsPerSecond)
        while shown < total {
            try? await Task.sleep(nanoseconds: step)
            if Task.isCancelled { return }
            shown += 1
        }
    }

    private func advanced() {
        if let l = run?.line, hasPortrait(l) { lastPortrait = l }
        version &+= 1
    }

    private func nextScene() {
        guard !queue.isEmpty, let scene = StoryLibrary.scene(id: queue.removeFirst()) else {
            onFinish()
            return
        }
        run = StoryRun(scene: scene)
        BGMPlayer.shared.want(scene.time)   // 幕の時刻で昼の曲・夜の曲を選ぶ
        lastPortrait = nil
        advanced()
    }

    private func sceneEnded() {
        guard let run else { return }
        StoryProgress.markSeen(run.scene.id)
        if !queue.isEmpty { nextScene(); return }
        if run.scene.end != nil && !finalStep {
            finalStep = true
            version &+= 1
            return
        }
        onFinish()
    }

    private func tap() {
        guard let run, !finalStep else { return }
        if run.phase == .line && isTyping { shown = fullText.count; return }
        if run.waiting != nil { return }
        SoundBoard.shared.play(.tap)
        if run.next() { sceneEnded() } else { advanced() }
    }

    private func submitName() {
        StoryProgress.setName(nameText)
        nameFocused = false
        run?.submitName()
        advanced()
    }

    /// 飛ばす。名前がまだなら名前の行で止まる。残りの幕もまとめて飛ばす。
    private func skip() {
        guard let run else { return }
        let hasName = StoryProgress.storedName != nil
        if !run.skip(hasName: hasName) { instant = true; advanced(); return }
        StoryProgress.markSeen(run.scene.id)
        while !queue.isEmpty {
            let id = queue.removeFirst()
            guard let scene = StoryLibrary.scene(id: id) else { continue }
            let r = StoryRun(scene: scene)
            if !r.skip(hasName: hasName) { self.run = r; instant = true; advanced(); return }
            StoryProgress.markSeen(id)
        }
        onFinish()
    }

    private func finish(openCases: Bool) {
        if openCases { onCases() } else { onFinish() }
    }
}

/// 読み返し。見た幕だけを物語の順に並べる。名前もここで直せる。
struct StoryListView: View {
    var onPlay: (String) -> Void
    @State private var name = StoryProgress.playerName
    @State private var saved = false
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        let seen = StoryProgress.seen
        NavigationStack {
            List {
                Section {
                    HStack {
                        TextField(StoryLibrary.defaultName, text: $name)
                        Button(saved ? "変えました" : "名前を変える") {
                            StoryProgress.setName(name)
                            name = StoryProgress.playerName
                            saved = true
                        }
                    }
                } header: { Text("あなたの名前") }
                Section {
                    ForEach(StoryLibrary.scenes) { scene in
                        let open = scene.id == "prologue" || seen.contains(scene.id)
                        Button { onPlay(scene.id) } label: {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(scene.title).font(Chrome.label(15, weight: .bold))
                                Text(open ? "\(scene.lines.count) 場面" : "まだ読んでいません")
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                        }
                        .disabled(!open)
                    }
                } footer: {
                    Text("まだ読んでいない幕は、そのレッスンに進むと開きます。")
                }
            }
            .navigationTitle("物語を読み返す")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("閉じる") { dismiss() } }
            }
        }
    }
}
