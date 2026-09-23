import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

/// Web 版と同じ生成画像を読む。`web/assets` をフォルダ参照で同梱しているので、
/// アプリの中では `Bundle.main/assets/<名前>.png` にそのまま入っている。
///
/// 画像が無いときは nil を返す。呼び出し側は `Art` を通して Characters.swift の
/// コード描画に落ちるので、画像を一枚も入れない状態でもアプリは成立する。
/// 対応する Web 側の仕組みは `web/assets.js` の VentAssets。
enum AppAssets {

    /// manifest.json に載っている名前と、その絵の大きさ。ここに無いものはファイルを
    /// 探しに行かない。大きさは FaceArt が顔の位置を出すのに使う。
    private static let sizes: [String: CGSize] = {
        guard let url = Bundle.main.url(forResource: "manifest", withExtension: "json",
                                        subdirectory: "assets"),
              let data = try? Data(contentsOf: url) else { return [:] }
        let parsed = try? JSONSerialization.jsonObject(with: data)
        guard let table = parsed as? [String: Any] else { return [:] }
        var out: [String: CGSize] = [:]
        for (name, entry) in table {
            let box = entry as? [String: Any]
            let w = (box?["w"] as? NSNumber)?.doubleValue ?? 1
            let h = (box?["h"] as? NSNumber)?.doubleValue ?? 1
            out[name] = CGSize(width: w, height: h)
        }
        return out
    }()

    private static var names: Set<String> { Set(sizes.keys) }

    /// 絵の大きさ（ピクセル）。無ければ nil。
    static func size(named name: String) -> CGSize? { sizes[name] }

    static func size(anyOf candidates: [String]) -> CGSize? {
        for name in candidates where sizes[name] != nil { return sizes[name] }
        return nil
    }

    private static var cache: [String: Image] = [:]

    static var isAvailable: Bool { !names.isEmpty }

    static func has(_ name: String) -> Bool { names.contains(name) }

    /// 名前を 1 つ指定して読む。読めたものは覚えておく。
    static func image(named name: String) -> Image? {
        if let cached = cache[name] { return cached }
        guard names.contains(name),
              let url = Bundle.main.url(forResource: name, withExtension: "png",
                                        subdirectory: "assets") else { return nil }
        #if canImport(UIKit)
        guard let loaded = UIImage(contentsOfFile: url.path) else { return nil }
        let image = Image(uiImage: loaded)
        cache[name] = image
        return image
        #else
        return nil
        #endif
    }

    /// 先に見つかった 1 枚を返す。「症例ごとの絵 → 年齢層の絵」のように、
    /// 細かいものから順に並べて渡す。Web 版の patientArt() と同じ考え方。
    static func image(anyOf candidates: [String]) -> Image? {
        for name in candidates {
            if let image = image(named: name) { return image }
        }
        return nil
    }

    /// 症例に合う患者の絵。重症度で色違いがある。
    static func patientNames(caseID: String, tone: PatientView.Tone) -> [String] {
        let suffix: String
        switch tone {
        case .ok:  suffix = ""
        case .mid: suffix = "_mid"
        case .bad: suffix = "_bad"
        }
        return suffix.isEmpty
            ? ["patient_\(caseID)"]
            : ["patient_\(caseID)\(suffix)", "patient_\(caseID)"]
    }
}

/// 生成画像があればそれを出し、無ければ中身（コード描画）を出す。
///
///     Art(["doctor_happy", "doctor_normal"]) { DoctorView(mood: .happy) }
struct Art<Fallback: View>: View {
    var names: [String]
    /// 画像を出すときの合わせ方。既定は全体が入るように縮める。
    var fit: ContentMode
    var fallback: Fallback

    init(_ names: [String], fit: ContentMode = .fit, @ViewBuilder fallback: () -> Fallback) {
        self.names = names
        self.fit = fit
        self.fallback = fallback()
    }

    var body: some View {
        if let image = AppAssets.image(anyOf: names) {
            image
                .resizable()
                .aspectRatio(contentMode: fit)
                .accessibilityHidden(true)
        } else {
            fallback
        }
    }
}

/// 全身の一枚絵から、顔のところだけを切り出して出す。渡された場所いっぱいに広がるので、
/// 丸く抜くところ（CharacterBadge）が大きさを決める。
/// Web 版の `.cav img`（object-fit: cover と顔に寄せた object-position）と同じ考え方で、
/// 絵の中の `focus`（0〜1 の割合）が枠の中心に来るように置く。
///
///     FaceArt(["doctor_happy", "doctor_normal"]) { DoctorView(mood: .happy) }
struct FaceArt<Fallback: View>: View {
    var names: [String]
    /// 顔の位置。絵の幅・高さに対する割合。
    var focus: CGPoint
    /// 幅の何倍に広げるか。1 で幅ぴったり、大きくするほど顔に寄る。
    var zoom: CGFloat
    var fallback: Fallback

    init(_ names: [String], focus: CGPoint = CGPoint(x: 0.5, y: 0.18), zoom: CGFloat = 1,
         @ViewBuilder fallback: () -> Fallback) {
        self.names = names
        self.focus = focus
        self.zoom = zoom
        self.fallback = fallback()
    }

    var body: some View {
        if let image = AppAssets.image(anyOf: names), let source = AppAssets.size(anyOf: names) {
            GeometryReader { geo in
                let side = min(geo.size.width, geo.size.height)
                let width = side * zoom
                let height = width * source.height / max(1, source.width)
                image
                    .resizable()
                    .frame(width: width, height: height)
                    // 顔を中心に置く。端を越えると余白が出るので、はみ出す幅までに抑える。
                    .offset(x: Self.shift(side: side, drawn: width, focus: focus.x),
                            y: Self.shift(side: side, drawn: height, focus: focus.y))
                    .frame(width: side, height: side, alignment: .topLeading)
                    .clipped()
            }
            .accessibilityHidden(true)
        } else {
            fallback
        }
    }

    /// 絵の focus の点を枠の中心へ動かす量。枠からはみ出した範囲に丸める。
    private static func shift(side: CGFloat, drawn: CGFloat, focus: CGFloat) -> CGFloat {
        let wanted = side / 2 - focus * drawn
        return min(0, max(side - drawn, wanted))
    }
}

/// どの絵をどう切り出すかの表。Web 版 app.js の DOC_ART と PT_FOCUS と同じ値を持つ。
/// 絵が入っていなければ FaceArt が Characters.swift のコード描画に落ちるので、
/// ここに並べた名前が全部そろっている必要はない。
enum CharacterArt {

    /// いぶき先生。sad の絵は無いので think で代える。
    static func doctorNames(_ mood: CharacterMood) -> [String] {
        let first: String
        switch mood {
        case .happy: first = "doctor_happy"
        case .think: first = "doctor_think"
        case .alert: first = "doctor_alert"
        case .sad:   first = "doctor_think"
        case .normal: first = "doctor_normal"
        }
        return first == "doctor_normal" ? [first] : [first, "doctor_normal"]
    }

    /// 全身の絵の上のほうが頭。少しだけ下げて、髪の上に余白を残す。
    static let doctorFocus = CGPoint(x: 0.5, y: 0.20)

    static func mascotNames(_ mood: CharacterMood) -> [String] {
        switch mood {
        case .sad:   return ["mascot_sad", "mascot_happy"]
        case .alert: return ["mascot_alert", "mascot_happy"]
        case .happy: return ["mascot_excited", "mascot_happy"]
        default:     return ["mascot_happy"]
        }
    }

    /// ぷくぷくはほぼ正方形なので、まん中をそのまま出す。
    static let mascotFocus = CGPoint(x: 0.5, y: 0.5)
    static let mascotZoom: CGFloat = 1.1

    /// 患者はベッドごとの一枚絵。顔の位置は症例ごとに違う。
    private static let patientFocusByCase: [String: CGPoint] = [
        "postop":        CGPoint(x: 0.36, y: 0.15),
        "rds":           CGPoint(x: 0.47, y: 0.25),
        "bronchiolitis": CGPoint(x: 0.74, y: 0.26),
        "asthma":        CGPoint(x: 0.66, y: 0.21),
        "gbs":           CGPoint(x: 0.63, y: 0.25),
        "ards":          CGPoint(x: 0.58, y: 0.30)
    ]

    static func patientFocus(_ caseID: String) -> CGPoint {
        patientFocusByCase[caseID] ?? CGPoint(x: 0.5, y: 0.28)
    }

    static let patientZoom: CGFloat = 3.4
}
