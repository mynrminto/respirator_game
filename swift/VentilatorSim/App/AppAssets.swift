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

    /// manifest.json に載っている名前。ここに無いものはファイルを探しに行かない。
    private static let names: Set<String> = {
        guard let url = Bundle.main.url(forResource: "manifest", withExtension: "json",
                                        subdirectory: "assets"),
              let data = try? Data(contentsOf: url) else { return [] }
        let parsed = try? JSONSerialization.jsonObject(with: data)
        guard let table = parsed as? [String: Any] else { return [] }
        return Set(table.keys)
    }()

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
