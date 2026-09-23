import SwiftUI
import VentilatorCore

/// タイトル画面。ゲームらしく、キャラクターと大きなメニューで迎える。
/// 免責事項は初回の開始時に一度だけ出し、同意を UserDefaults に残す。
struct TitleView: View {
    var onStartLesson: (Lesson) -> Void
    var onOpenCourse: () -> Void
    var onOpenCases: () -> Void

    @AppStorage("ventsim.lessons.done.v1") private var completedRaw = ""
    @AppStorage("ventsim.agreed.v1") private var agreed = false
    @State private var showingAbout = false
    /// 免責事項に同意したあとで実行する操作。同意済みならすぐ実行する。
    @State private var pending: (() -> Void)?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var floating = false

    private var done: Int {
        let ids = Set(completedRaw.split(separator: ",").map(String.init))
        return LessonLibrary.all.filter { ids.contains($0.id) }.count
    }
    private var total: Int { LessonLibrary.all.count }
    private var nextLesson: Lesson? {
        let ids = Set(completedRaw.split(separator: ",").map(String.init))
        return LessonLibrary.all.first { !ids.contains($0.id) }
    }

    var body: some View {
        GeometryReader { geo in
            let compact = geo.size.height < 720
            let castHeight: CGFloat = compact ? 96 : 132

            VStack(spacing: compact ? 10 : 16) {
                cast(height: castHeight)
                logo(compact: compact)
                speech
                menu
                Spacer(minLength: 0)
                footer
            }
            .frame(maxWidth: 520)
            .padding(.horizontal, 20)
            .padding(.top, compact ? 12 : 24)
            .padding(.bottom, 12)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        }
        .background(backdrop.ignoresSafeArea())
        .preferredColorScheme(Chrome.colorScheme)
        .sheet(isPresented: $showingAbout, onDismiss: runPendingIfAgreed) {
            AboutView(asGate: pending != nil) {
                agreed = true
            }
        }
        .onAppear {
            guard !reduceMotion else { return }
            withAnimation(.easeInOut(duration: 2.6).repeatForever(autoreverses: true)) {
                floating = true
            }
        }
    }

    // MARK: - 背景

    private var backdrop: some View {
        ZStack {
            drawnBackdrop
            // Web 版と同じ NICU の背景。無ければ上の塗りだけで成立する。
            if Chrome.isPop, let bg = AppAssets.image(named: "bg_title_day") {
                bg.resizable().aspectRatio(contentMode: .fill)
                    .opacity(0.9)
                    .accessibilityHidden(true)
            }
        }
        .clipped()      // fill で広げた背景が画面の外へはみ出さないように
    }

    private var drawnBackdrop: some View {
        ZStack {
            LinearGradient(colors: Chrome.isPop
                           ? [Color(red: 1.00, green: 0.937, blue: 0.839),
                              Color(red: 1.00, green: 0.878, blue: 0.925),
                              Color(red: 0.890, green: 0.925, blue: 1.000)]
                           : [Chrome.chassisTop, Chrome.chassis],
                           startPoint: .top, endPoint: .bottom)
            if Chrome.isPop {
                // 大きな丸を二つ置いて、平らな背景にならないようにする。
                Circle().fill(Color.white.opacity(0.45))
                    .frame(width: 320, height: 320)
                    .offset(x: -140, y: -220)
                Circle().fill(Chrome.accent.opacity(0.10))
                    .frame(width: 260, height: 260)
                    .offset(x: 150, y: 180)
            }
        }
    }

    // MARK: - キャラクター

    private func cast(height: CGFloat) -> some View {
        let cheerful = done >= total && total > 0
        return HStack(alignment: .bottom, spacing: height * 0.06) {
            Art(["mascot_happy"]) { MascotView(mood: .happy) }
                .frame(width: height * 0.82, height: height * 0.82)
                .offset(y: floating ? -6 : 0)
            Art([cheerful ? "doctor_happy" : "doctor_normal", "doctor_normal"]) {
                DoctorView(mood: cheerful ? .happy : .normal)
            }
            .frame(width: height * 0.92, height: height)
        }
        .frame(height: height)
        .frame(maxWidth: .infinity)
    }

    // MARK: - ロゴ

    private func logo(compact: Bool) -> some View {
        let gradient = LinearGradient(
            colors: [Color(red: 1.00, green: 0.369, blue: 0.541),
                     Color(red: 1.00, green: 0.690, blue: 0.125),
                     Color(red: 0.071, green: 0.769, blue: 0.545),
                     Color(red: 0.357, green: 0.486, blue: 0.980)],
            startPoint: .leading, endPoint: .trailing)
        return VStack(spacing: 2) {
            ZStack {
                WaveMark()
                    .stroke(gradient, style: StrokeStyle(lineWidth: 3, lineCap: .round, lineJoin: .round))
                    .frame(height: compact ? 26 : 32)
                    .opacity(0.55)
                    .offset(y: compact ? 16 : 20)
                Text("VentaSim")
                    .font(.system(size: compact ? 40 : 48, weight: .black, design: .rounded))
                    .foregroundStyle(gradient)
            }
            Text("人工呼吸器シミュレーター")
                .font(Chrome.label(13, weight: .bold))
                .foregroundStyle(Chrome.dim)
                .tracking(2)
        }
    }

    // MARK: - ひとこと

    private var speech: some View {
        HStack(alignment: .top, spacing: 10) {
            CharacterBadge(size: 44, ring: Chrome.accent.opacity(0.35), background: Chrome.panel2) {
                DoctorView(mood: done >= total && total > 0 ? .happy : .normal)
            }
            Text(line)
                .font(Chrome.label(13))
                .foregroundStyle(Chrome.ink)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(
                    RoundedRectangle(cornerRadius: Chrome.cornerLarge)
                        .fill(Chrome.panel)
                        .overlay(RoundedRectangle(cornerRadius: Chrome.cornerLarge)
                            .stroke(Chrome.line, lineWidth: Chrome.isPop ? 2 : 1))
                )
        }
    }

    private var line: String {
        let name = StoryProgress.storedName
        if done == 0 {
            if let name { return "おかえりなさい、\(name)先生。\nハルト君が待っています。" }
            return "はじめまして。わたしは いぶき先生。\nいっしょに呼吸器を動かしてみましょう。"
        }
        if done >= total {
            return "全レッスン修了、おみごとです。\n症例で腕を試してみましょう。"
        }
        return "おかえりなさい、\(StoryProgress.playerName)先生。\nここまで \(done) / \(total) レッスン。つづきからどうぞ。"
    }

    // MARK: - メニュー

    @ViewBuilder
    private var menu: some View {
        VStack(spacing: 8) {
            if done > 0, let next = nextLesson {
                let chapter = LessonLibrary.chapter(of: next.id)
                menuItem("▶", icon: "icon_go", "つづきから",
                         [chapter?.title, next.title].compactMap { $0 }.joined(separator: "　"),
                         primary: true) {
                    enter { onStartLesson(next) }
                }
            } else {
                menuItem("▶", icon: "icon_go", "はじめる", "学習コースを 1 から", primary: true) {
                    guard let first = LessonLibrary.all.first else { return }
                    enter { onStartLesson(first) }
                }
            }
            menuItem("☰", icon: "icon_course", "コースを選ぶ",
                     "\(LessonLibrary.chapters.count) 章 \(total) レッスンから選ぶ") {
                enter { onOpenCourse() }
            }
            menuItem("✚", icon: "icon_cases", "症例で練習", "\(ScenarioLibrary.all.count) 症例を自由に操作する") {
                enter { onOpenCases() }
            }
            menuItem("?", icon: "icon_about", "この教材について", "免責事項とモデルの説明") {
                pending = nil
                showingAbout = true
            }
        }
    }

    private func menuItem(_ glyph: String, icon: String? = nil,
                          _ title: String, _ subtitle: String,
                          primary: Bool = false, action: @escaping () -> Void) -> some View {
        Button { SoundBoard.shared.play(.tap); action() } label: {
            HStack(spacing: 12) {
                // 生成アイコンがあればそれを、無ければ文字のまま。
                Group {
                    if let icon, let image = AppAssets.image(named: icon) {
                        image.resizable().aspectRatio(contentMode: .fit).padding(2)
                    } else {
                        Text(glyph)
                            .font(.system(size: 15, weight: .black, design: .rounded))
                            .foregroundStyle(primary ? Chrome.accentInk : Chrome.accent)
                    }
                }
                .frame(width: 30, height: 30)
                .background(
                    Circle().fill(primary ? Color.white.opacity(0.25) : Chrome.panel2)
                )
                VStack(alignment: .leading, spacing: 1) {
                    Text(title)
                        .font(Chrome.label(16, weight: .heavy))
                        .foregroundStyle(primary ? Chrome.accentInk : Chrome.ink)
                    Text(subtitle)
                        .font(Chrome.label(11))
                        .foregroundStyle(primary ? Chrome.accentInk.opacity(0.85) : Chrome.dim)
                        .lineLimit(1)
                }
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 11)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .buttonStyle(TitleMenuStyle(primary: primary))
    }

    // MARK: - 足もと

    private var footer: some View {
        HStack(spacing: 10) {
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Chrome.panel2)
                    Capsule()
                        .fill(LinearGradient(colors: [Chrome.accent, Chrome.good],
                                             startPoint: .leading, endPoint: .trailing))
                        .frame(width: geo.size.width * (total == 0 ? 0 : Double(done) / Double(total)))
                }
            }
            .frame(height: 8)
            Text("\(total == 0 ? 0 : Int((Double(done) / Double(total) * 100).rounded()))%")
                .font(Chrome.digits(12, weight: .bold))
                .foregroundStyle(Chrome.dim)
            ChipButton(title: ThemeStore.shared.kind.label) {
                ThemeStore.shared.toggle()
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("学習の進み具合 \(done) / \(total) レッスン")
    }

    // MARK: - 免責事項の関門

    private func enter(_ action: @escaping () -> Void) {
        if agreed {
            action()
        } else {
            pending = action
            showingAbout = true
        }
    }

    private func runPendingIfAgreed() {
        guard agreed, let action = pending else { pending = nil; return }
        pending = nil
        action()
    }
}

/// ロゴの下を走る波形。
private struct WaveMark: Shape {
    func path(in rect: CGRect) -> Path {
        // 0〜320 の幅で書いた形を、与えられた矩形に伸ばす。
        let pts: [CGPoint] = [
            CGPoint(x: 0, y: 0.62), CGPoint(x: 44, y: 0.62), CGPoint(x: 54, y: 0.06),
            CGPoint(x: 64, y: 1.00), CGPoint(x: 74, y: 0.40), CGPoint(x: 120, y: 0.40),
            CGPoint(x: 128, y: 0.14), CGPoint(x: 136, y: 0.86), CGPoint(x: 144, y: 0.40),
            CGPoint(x: 204, y: 0.40), CGPoint(x: 214, y: 0.04), CGPoint(x: 224, y: 0.96),
            CGPoint(x: 232, y: 0.46), CGPoint(x: 320, y: 0.46)
        ]
        var path = Path()
        for (i, p) in pts.enumerated() {
            let q = CGPoint(x: rect.minX + rect.width * p.x / 320,
                            y: rect.minY + rect.height * p.y)
            if i == 0 { path.move(to: q) } else { path.addLine(to: q) }
        }
        return path
    }
}

/// メニューのボタン。押すと少し沈む。
private struct TitleMenuStyle: ButtonStyle {
    var primary: Bool

    func makeBody(configuration: Configuration) -> some View {
        let radius: CGFloat = Chrome.isPop ? 18 : Chrome.corner
        let sunk = Chrome.isPop && configuration.isPressed
        return configuration.label
            .background(
                ZStack {
                    if Chrome.isPop && !sunk {
                        RoundedRectangle(cornerRadius: radius)
                            .fill(primary ? Chrome.accent.opacity(0.45) : Chrome.keyLip)
                            .offset(y: 4)
                    }
                    RoundedRectangle(cornerRadius: radius)
                        .fill(primary ? Chrome.accent : Chrome.panel)
                        .overlay(
                            RoundedRectangle(cornerRadius: radius)
                                .stroke(primary ? Color.clear : Chrome.line,
                                        lineWidth: Chrome.isPop ? 2 : 1)
                        )
                }
            )
            .offset(y: sunk ? 4 : 0)
            .animation(.easeOut(duration: 0.08), value: configuration.isPressed)
    }
}

/// 免責事項。初回の開始時は関門として出し、メニューからはただの説明として出す。
struct AboutView: View {
    var asGate: Bool
    var onAgree: () -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    HStack(spacing: 10) {
                        CharacterBadge(size: 52, ring: Chrome.accent.opacity(0.35),
                                       background: Chrome.panel2) {
                            DoctorView(mood: .think)
                        }
                        Text("はじめに読んでください")
                            .font(Chrome.label(16, weight: .heavy))
                    }
                    Text("このアプリは教育用です。実在の人工呼吸器の動作を簡略化したモデルであり、表示される数値も実機・実患者とは異なります。臨床判断には使用しないでください。")
                        .font(.callout)
                    Text("患者の状態は、肺のコンプライアンスと気道抵抗を持つ 1 つのモデルで計算しています。モードは、そのモデルに対する換気の与え方の違いとして表しています。血液ガスは実際の測定と同じように、採取してから少し待つと返ってきます。")
                        .font(.callout)
                        .foregroundStyle(.secondary)
                    Text("学習コースは 6 章 19 レッスン。波形の読み方から、初期設定、モード、血液ガス、トラブル対応、離脱までを、実機の画面を操作しながら順に覚えられます。")
                        .font(.callout)
                        .foregroundStyle(.secondary)
                }
                .padding(18)
            }
            .navigationTitle("この教材について")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button(asGate ? "同意して始める" : "閉じる") {
                        if asGate { onAgree() }
                        dismiss()
                    }
                    .font(.body.weight(.semibold))
                }
            }
        }
    }
}
