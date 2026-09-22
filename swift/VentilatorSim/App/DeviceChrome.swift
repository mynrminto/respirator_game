import SwiftUI
import VentilatorCore

/// 見た目は 2 通り。pop（既定）は明るくポップな筐体、device は従来の実機風。
/// 中身（物理モデル・レッスン・操作の流れ）はどちらでも同じ。
enum ThemeKind: String, CaseIterable {
    case pop
    case device

    var label: String { self == .pop ? "ポップ" : "実機" }
}

/// テーマの選択を 1 か所に持つ。Chrome の各色はここを読むので、
/// これが変わると画面全体の配色が一度に切り替わる。
@Observable
final class ThemeStore {
    static let shared = ThemeStore()

    private static let key = "ventsim.theme.v1"

    var kind: ThemeKind {
        didSet { UserDefaults.standard.set(kind.rawValue, forKey: Self.key) }
    }

    private init() {
        let raw = UserDefaults.standard.string(forKey: Self.key) ?? ThemeKind.pop.rawValue
        kind = ThemeKind(rawValue: raw) ?? .pop
    }

    func toggle() { kind = (kind == .pop ? .device : .pop) }
}

/// 1 つのテーマがもつ色と寸法。Web 版の CSS カスタムプロパティと同じ並びにしてある。
struct Palette {
    /// 筐体
    var chassisTop: Color
    var chassis: Color
    var bar: Color
    var panel: Color
    var panel2: Color
    var line: Color
    var edge: Color

    var ink: Color
    var dim: Color
    var faint: Color

    /// アクセント
    var accent: Color        // 確定・選択中
    var accentInk: Color     // アクセントの上に載る文字
    var sim: Color           // シミュレーター側の操作

    /// 機器の画面。ポップでも暗いままにして、波形と数値の読みやすさを落とさない。
    var screen: Color
    var screenFrame: Color
    var screenTile: Color
    var screenTileLine: Color
    var screenInk: Color
    var screenDim: Color

    /// 計測の色
    var pressure: Color
    var flow: Color
    var volume: Color
    var spo2: Color
    var critical: Color
    var warning: Color
    var good: Color

    /// キー
    var key: Color
    var keyBorder: Color
    var keyInk: Color
    var keyLip: Color        // 押し込める厚みの色

    /// ダイヤル
    var knobFaceTop: Color
    var knobFaceMid: Color
    var knobFaceBottom: Color
    var knobTrack: Color
    var knobTick: Color
    var knobPointer: Color

    /// 学習帯
    var coachPanel: Color
    var coachInk: Color
    var coachFaint: Color

    var corner: CGFloat
    var cornerLarge: CGFloat
    /// 波形に淡い発光を足すか。
    var glow: Bool
    var colorScheme: ColorScheme
}

extension Palette {
    static let pop = Palette(
        chassisTop: Color(red: 1.000, green: 0.937, blue: 0.839),
        chassis:    Color(red: 0.890, green: 0.925, blue: 1.000),
        bar:        .white,
        panel:      .white,
        panel2:     Color(red: 1.000, green: 0.973, blue: 0.933),
        line:       Color(red: 0.941, green: 0.875, blue: 0.816),
        edge:       Color(red: 0.894, green: 0.827, blue: 0.753),
        ink:        Color(red: 0.149, green: 0.153, blue: 0.271),
        dim:        Color(red: 0.463, green: 0.471, blue: 0.596),
        faint:      Color(red: 0.643, green: 0.651, blue: 0.761),
        accent:     Color(red: 1.000, green: 0.369, blue: 0.541),
        accentInk:  .white,
        sim:        Color(red: 0.357, green: 0.486, blue: 0.980),
        screen:         Color(red: 0.098, green: 0.118, blue: 0.298),
        screenFrame:    .white,
        screenTile:     Color(red: 0.137, green: 0.165, blue: 0.400),
        screenTileLine: Color(red: 0.192, green: 0.227, blue: 0.514),
        screenInk:      Color(red: 0.941, green: 0.949, blue: 1.000),
        screenDim:      Color(red: 0.655, green: 0.690, blue: 0.918),
        pressure: Color(red: 1.000, green: 0.773, blue: 0.239),
        flow:     Color(red: 0.231, green: 0.937, blue: 0.753),
        volume:   Color(red: 0.651, green: 0.722, blue: 1.000),
        spo2:     Color(red: 0.373, green: 0.882, blue: 0.961),
        critical: Color(red: 1.000, green: 0.333, blue: 0.439),
        warning:  Color(red: 1.000, green: 0.686, blue: 0.180),
        good:     Color(red: 0.169, green: 0.851, blue: 0.627),
        key:       .white,
        keyBorder: Color(red: 0.922, green: 0.863, blue: 0.812),
        keyInk:    Color(red: 0.227, green: 0.231, blue: 0.361),
        keyLip:    Color(red: 0.890, green: 0.816, blue: 0.753),
        knobFaceTop:    .white,
        knobFaceMid:    Color(red: 1.000, green: 0.949, blue: 0.886),
        knobFaceBottom: Color(red: 0.953, green: 0.804, blue: 0.706),
        knobTrack:   Color(red: 0.918, green: 0.863, blue: 0.812),
        knobTick:    Color(red: 0.851, green: 0.784, blue: 0.722),
        knobPointer: Color(red: 0.227, green: 0.231, blue: 0.361),
        coachPanel: .white,
        coachInk:   Color(red: 0.165, green: 0.169, blue: 0.290),
        coachFaint: Color(red: 0.463, green: 0.471, blue: 0.596),
        corner: 14,
        cornerLarge: 20,
        glow: true,
        colorScheme: .light
    )

    static let device = Palette(
        chassisTop: Color(red: 0.102, green: 0.118, blue: 0.137),
        chassis:    Color(red: 0.047, green: 0.059, blue: 0.071),
        bar:        Color(red: 0.082, green: 0.094, blue: 0.110),
        panel:      Color(red: 0.059, green: 0.075, blue: 0.094),
        panel2:     Color(red: 0.071, green: 0.086, blue: 0.106),
        line:       Color(red: 0.086, green: 0.125, blue: 0.161),
        edge:       Color(red: 0.039, green: 0.051, blue: 0.063),
        ink:        Color(red: 0.863, green: 0.902, blue: 0.941),
        dim:        Color(red: 0.494, green: 0.557, blue: 0.627),
        faint:      Color(red: 0.290, green: 0.341, blue: 0.396),
        accent:     Color(red: 0.184, green: 0.847, blue: 0.659),
        accentInk:  Color(red: 0.016, green: 0.071, blue: 0.051),
        sim:        Color(red: 0.561, green: 0.659, blue: 1.000),
        screen:         Color(red: 0.016, green: 0.027, blue: 0.039),
        screenFrame:    Color(red: 0.039, green: 0.071, blue: 0.098),
        screenTile:     Color(red: 0.031, green: 0.047, blue: 0.067),
        screenTileLine: Color(red: 0.086, green: 0.125, blue: 0.161),
        screenInk:      Color(red: 0.863, green: 0.902, blue: 0.941),
        screenDim:      Color(red: 0.494, green: 0.557, blue: 0.627),
        pressure: Color(red: 0.961, green: 0.706, blue: 0.161),
        flow:     Color(red: 0.184, green: 0.847, blue: 0.659),
        volume:   Color(red: 0.561, green: 0.659, blue: 1.000),
        spo2:     Color(red: 0.349, green: 0.847, blue: 0.918),
        critical: Color(red: 1.000, green: 0.294, blue: 0.341),
        warning:  Color(red: 1.000, green: 0.690, blue: 0.227),
        good:     Color(red: 0.243, green: 0.796, blue: 0.502),
        key:       Color(red: 0.106, green: 0.125, blue: 0.153),
        keyBorder: Color(red: 0.039, green: 0.055, blue: 0.071),
        keyInk:    Color(red: 0.765, green: 0.816, blue: 0.863),
        keyLip:    Color(red: 0.169, green: 0.204, blue: 0.243),
        knobFaceTop:    Color(white: 0.22),
        knobFaceMid:    Color(white: 0.11),
        knobFaceBottom: Color(white: 0.04),
        knobTrack:   Color(white: 0.16),
        knobTick:    Color(white: 0.20),
        knobPointer: Color(red: 0.784, green: 0.839, blue: 0.894),
        coachPanel: Color(red: 0.051, green: 0.102, blue: 0.090),
        coachInk:   Color(red: 0.863, green: 0.937, blue: 0.906),
        coachFaint: Color(red: 0.369, green: 0.541, blue: 0.482),
        corner: 4,
        cornerLarge: 6,
        glow: false,
        colorScheme: .dark
    )
}

/// 筐体の色と寸法。選ばれているテーマのパレットを引くだけの薄い入り口。
enum Chrome {
    static var kind: ThemeKind { ThemeStore.shared.kind }
    static var palette: Palette { kind == .pop ? .pop : .device }
    static var isPop: Bool { kind == .pop }

    static var chassisTop: Color { palette.chassisTop }
    static var chassis: Color { palette.chassis }
    static var bar: Color { palette.bar }
    static var panel: Color { palette.panel }
    static var panel2: Color { palette.panel2 }
    static var screen: Color { palette.screen }
    static var screenFrame: Color { palette.screenFrame }
    static var screenTile: Color { palette.screenTile }
    static var screenTileLine: Color { palette.screenTileLine }
    static var screenInk: Color { palette.screenInk }
    static var screenDim: Color { palette.screenDim }
    static var line: Color { palette.line }
    static var edge: Color { palette.edge }

    static var ink: Color { palette.ink }
    static var dim: Color { palette.dim }
    static var faint: Color { palette.faint }

    static var accent: Color { palette.accent }
    static var accentInk: Color { palette.accentInk }

    static var pressure: Color { palette.pressure }
    static var flow: Color { palette.flow }
    static var volume: Color { palette.volume }
    static var spo2: Color { palette.spo2 }
    static var critical: Color { palette.critical }
    static var warning: Color { palette.warning }
    static var good: Color { palette.good }
    static var sim: Color { palette.sim }

    static var key: Color { palette.key }
    static var keyBorder: Color { palette.keyBorder }
    static var keyInk: Color { palette.keyInk }
    static var keyLip: Color { palette.keyLip }

    static var corner: CGFloat { palette.corner }
    static var cornerLarge: CGFloat { palette.cornerLarge }
    static var glow: Bool { palette.glow }
    static var colorScheme: ColorScheme { palette.colorScheme }

    /// 章ごとの色。学習コースの帯と一覧で使う。
    static func chapterColor(_ id: String) -> Color {
        guard isPop else { return accent }
        switch id {
        case "ch1": return Color(red: 0.310, green: 0.659, blue: 1.000)
        case "ch2": return Color(red: 0.071, green: 0.769, blue: 0.545)
        case "ch3": return Color(red: 0.545, green: 0.420, blue: 1.000)
        case "ch4": return Color(red: 1.000, green: 0.369, blue: 0.541)
        case "ch5": return Color(red: 1.000, green: 0.541, blue: 0.239)
        default:    return Color(red: 0.941, green: 0.659, blue: 0.000)
        }
    }

    static func digits(_ size: CGFloat, weight: Font.Weight = .semibold) -> Font {
        .system(size: size, weight: weight, design: isPop ? .rounded : .default).monospacedDigit()
    }

    /// 見出しやボタンの文字。ポップのときだけ丸ゴシックにする。
    static func label(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        .system(size: size, weight: weight, design: isPop ? .rounded : .default)
    }
}

/// 機器のキー。ポップでは押し込める厚みを、実機風では従来どおりの平らなキーにする。
struct DeviceKey: View {
    let title: String
    var tint: Color? = nil
    var isOn: Bool = false
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(Chrome.label(12, weight: Chrome.isPop ? .bold : .regular))
                .padding(.horizontal, Chrome.isPop ? 13 : 11)
                .padding(.vertical, 8)
                .frame(minWidth: 44)
        }
        .buttonStyle(DeviceKeyStyle(tint: tint, isOn: isOn))
    }
}

/// 押した瞬間だけキーが沈む。ButtonStyle にすることで、タップの判定に手を入れずに済む。
struct DeviceKeyStyle: ButtonStyle {
    var tint: Color?
    var isOn: Bool

    func makeBody(configuration: Configuration) -> some View {
        let pop = Chrome.isPop
        let radius: CGFloat = pop ? 999 : Chrome.corner
        let base = tint ?? Chrome.keyInk
        let onFill = tint ?? Chrome.accent
        let foreground: Color = isOn ? (pop ? Chrome.accentInk : Chrome.flow) : base
        let fill: Color = (isOn && pop) ? onFill : Chrome.key
        let stroke: Color = isOn ? (pop ? onFill : Chrome.flow)
                                 : (tint.map { $0.opacity(pop ? 0.4 : 1) } ?? Chrome.keyBorder)
        let sunk = pop && configuration.isPressed
        return configuration.label
            .foregroundStyle(foreground)
            .background(
                ZStack {
                    if pop && !sunk {
                        RoundedRectangle(cornerRadius: radius).fill(Chrome.keyLip).offset(y: 3)
                    }
                    RoundedRectangle(cornerRadius: radius)
                        .fill(fill)
                        .overlay(
                            RoundedRectangle(cornerRadius: radius)
                                .stroke(stroke, lineWidth: pop ? 2 : 1)
                        )
                }
            )
            .offset(y: sunk ? 3 : 0)
            .opacity(!pop && configuration.isPressed ? 0.7 : 1)
    }
}

/// 状態バーの小さな丸ボタン（消音・見た目の切り替え）。
struct ChipButton: View {
    let title: String
    var isOn: Bool = false
    var tint: Color? = nil
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(Chrome.label(11, weight: Chrome.isPop ? .bold : .regular))
                .foregroundStyle(isOn ? Chrome.warning : (tint ?? Chrome.dim))
                .padding(.horizontal, Chrome.isPop ? 10 : 9)
                .padding(.vertical, 4)
                .background(
                    RoundedRectangle(cornerRadius: Chrome.isPop ? 999 : 3)
                        .fill(Chrome.isPop ? Chrome.panel2 : Color.clear)
                        .overlay(
                            RoundedRectangle(cornerRadius: Chrome.isPop ? 999 : 3)
                                .stroke(isOn ? Chrome.warning : (tint ?? Chrome.edge),
                                        lineWidth: Chrome.isPop ? 1.5 : 1)
                        )
                )
        }
        .buttonStyle(.plain)
    }
}

/// 計測値のタイル。単位と、あれば上限の目安を小さく添える。
/* 機器の画面に並ぶ計測値。学習コースの帯も同じ定義を読むので、
 * タイルと帯で表示がずれない（web/app.js の VALS と同じ並び・同じ文字列）。 */
struct Readout: Identifiable {
    let caption: String
    let unit: String
    let value: (VentilatorEngine) -> String
    var limit: ((VentilatorEngine) -> String)? = nil
    var tone: ((VentilatorEngine) -> Color)? = nil

    var id: String { caption }

    static func find(_ caption: String) -> Readout? { all.first { $0.caption == caption } }

    private static func whole(_ v: Double) -> String { v.isFinite ? String(Int(v.rounded())) : "––" }
    private static func wholeOpt(_ v: Double?) -> String { v.map { whole($0) } ?? "––" }
    private static func one(_ v: Double) -> String { v.isFinite ? String(format: "%.1f", v) : "––" }

    static let all: [Readout] = [
        Readout(caption: "PIP", unit: "cmH₂O", value: { whole($0.measured.peakPressure) },
                limit: { "≤\(Int($0.settings.alarms.peakPressure))" },
                tone: { $0.measured.peakPressure > $0.settings.alarms.peakPressure
                    ? Chrome.critical : Chrome.screenInk }),
        Readout(caption: "Pplat", unit: "cmH₂O", value: { wholeOpt($0.measured.plateauPressure) },
                limit: { "≤\(Int($0.norms.plateauMax))" },
                tone: { ($0.measured.plateauPressure ?? 0) > $0.norms.plateauMax
                    ? Chrome.critical : Chrome.screenInk }),
        Readout(caption: "PEEP tot", unit: "cmH₂O", value: { one($0.measured.totalPEEP) }),
        Readout(caption: "ΔP", unit: "cmH₂O", value: { wholeOpt($0.measured.drivingPressure) },
                limit: { "≤\(Int($0.norms.drivingPressureMax))" },
                tone: { ($0.measured.drivingPressure ?? 0) > $0.norms.drivingPressureMax
                    ? Chrome.critical : Chrome.screenInk }),
        Readout(caption: "Vte", unit: "mL",
                value: { $0.patient.predictedBodyWeight < 6
                    ? one($0.measured.tidalVolumeExp) : whole($0.measured.tidalVolumeExp) },
                limit: { String(format: "%.1f mL/kg",
                                $0.measured.tidalVolumeExp / $0.patient.predictedBodyWeight) },
                tone: { $0.measured.tidalVolumeExp / $0.patient.predictedBodyWeight
                    > $0.norms.tidalPerKg.upperBound + 1.5 ? Chrome.critical : Chrome.screenInk }),
        Readout(caption: "MV", unit: "L/min",
                value: { $0.patient.predictedBodyWeight < 10
                    ? String(format: "%.2f", $0.measured.minuteVolume) : one($0.measured.minuteVolume) },
                limit: { String(format: "%.0f mL/kg/分",
                                $0.measured.minuteVolume * 1000 / $0.patient.predictedBodyWeight) }),
        Readout(caption: "RR tot", unit: "/min", value: { whole($0.measured.respiratoryRateTotal) },
                limit: { "自発 \(Int($0.measured.respiratoryRateSpontaneous))" }),
        Readout(caption: "I:E", unit: "", value: { $0.measured.ieRatio }),
        Readout(caption: "Cstat", unit: "mL/cmH₂O", value: { wholeOpt($0.measured.staticCompliance) }),
        Readout(caption: "Raw", unit: "cmH₂O/L/s", value: { wholeOpt($0.measured.airwayResistance) }),
        Readout(caption: "auto-PEEP", unit: "cmH₂O", value: { one($0.measured.autoPEEP) },
                tone: { $0.measured.autoPEEP > 5 ? Chrome.critical
                    : ($0.measured.autoPEEP > 2 ? Chrome.warning : Chrome.screenInk) }),
        // 小児では f/VT を体重あたりで見る。成人の RSBI（<105）は体重が軽いほど大きく出て使えない。
        Readout(caption: "f/VT", unit: "/分/(mL/kg)",
                value: { $0.measured.rsbiPerKg.map { String(format: "%.1f", $0) } ?? "––" },
                limit: { _ in "<8" },
                tone: { ($0.measured.rsbiPerKg ?? 0) > 8 ? Chrome.warning : Chrome.screenInk }),
        Readout(caption: "SpO₂", unit: "%", value: { whole($0.spo2) },
                limit: { "\(Int($0.norms.spo2Target.lowerBound))–\(Int($0.norms.spo2Target.upperBound))%" },
                tone: { $0.spo2 < $0.norms.spo2Target.lowerBound ? Chrome.critical
                    : ($0.spo2 > $0.norms.spo2Target.upperBound + 2 ? Chrome.warning : Chrome.good) }),
        Readout(caption: "etCO₂", unit: "mmHg", value: { whole($0.etco2) }),
        Readout(caption: "HR", unit: "/min", value: { whole($0.heartRate) },
                limit: { "\(Int($0.norms.heartRate.lowerBound))–\(Int($0.norms.heartRate.upperBound))" },
                tone: { $0.heartRate > $0.norms.heartRate.upperBound * 1.15
                    ? Chrome.warning : Chrome.screenInk }),
        Readout(caption: "ABP mean", unit: "mmHg", value: { whole($0.meanArterialPressure) },
                limit: { "≥\(Int($0.norms.meanArterialPressureMin))" },
                tone: { $0.meanArterialPressure < $0.norms.meanArterialPressureMin ? Chrome.critical
                    : ($0.meanArterialPressure < $0.norms.meanArterialPressureMin + 5
                       ? Chrome.warning : Chrome.screenInk) })
    ]
}

/* いま押すところ・見るところを光らせる。「画面の下の段にある設定キーで」と書く代わりに、
 * 現物を光らせて指す。学習コースの課題の spot がこれを決める。 */
struct Spotlight: ViewModifier {
    var on: Bool
    var corner: CGFloat
    @State private var pulse = false

    func body(content: Content) -> some View {
        content.overlay {
            if on {
                RoundedRectangle(cornerRadius: corner)
                    .strokeBorder(Chrome.pressure, lineWidth: 2)
                    .shadow(color: Chrome.pressure.opacity(pulse ? 0 : 0.6), radius: pulse ? 10 : 1)
                    .allowsHitTesting(false)
                    .onAppear {
                        withAnimation(.easeInOut(duration: 1.3).repeatForever(autoreverses: true)) {
                            pulse = true
                        }
                    }
            }
        }
    }
}

extension View {
    /// 学習コースが指している要素を光らせる。
    func spotlight(_ on: Bool, corner: CGFloat = Chrome.corner) -> some View {
        modifier(Spotlight(on: on, corner: corner))
    }
}

struct ValueTile: View {
    let caption: String
    let value: String
    let unit: String
    var limit: String? = nil
    var tone: Color? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            HStack(alignment: .top, spacing: 4) {
                Text(caption)
                    .font(Chrome.label(9.5, weight: Chrome.isPop ? .bold : .regular))
                    .foregroundStyle(Chrome.screenDim)
                Spacer(minLength: 0)
                if let limit {
                    Text(limit).font(.system(size: 8.5)).foregroundStyle(Chrome.screenDim.opacity(0.8))
                }
            }
            HStack(alignment: .firstTextBaseline, spacing: 2) {
                Text(value)
                    .font(Chrome.digits(22, weight: .bold))
                    .foregroundStyle(tone ?? Chrome.screenInk)
                Text(unit)
                    .font(.system(size: 8.5))
                    .foregroundStyle(Chrome.screenDim.opacity(0.85))
            }
        }
        .padding(.horizontal, 7)
        .padding(.vertical, 5)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Chrome.screenTile)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(caption) \(value) \(unit)")
    }
}

/// レッスン修了のお祝い。紙吹雪と一言を 2 秒だけ出す。
/// 学習の邪魔にならないよう、操作は一切受けない。
struct CelebrationView: View {
    let message: String
    /// 出し終わったら呼ぶ。状態を持っている側がこれで片付ける。
    var onFinished: () -> Void = {}
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var launched = false

    private static let colors: [Color] = [
        Color(red: 1.000, green: 0.369, blue: 0.541),
        Color(red: 1.000, green: 0.690, blue: 0.125),
        Color(red: 0.071, green: 0.769, blue: 0.545),
        Color(red: 0.357, green: 0.486, blue: 0.980),
        Color(red: 1.000, green: 0.541, blue: 0.239),
        Color(red: 0.545, green: 0.420, blue: 1.000)
    ]

    private struct Piece: Identifiable {
        let id: Int
        let x: CGFloat
        let dx: CGFloat
        let dy: CGFloat
        let angle: Double
        let color: Color
        let delay: Double
    }

    private var pieces: [Piece] {
        (0..<24).map { i in
            let t = Double(i) / 24
            return Piece(id: i,
                         x: CGFloat(sin(t * 12) * 0.5 + 0.5),
                         dx: CGFloat(cos(t * .pi * 2) * 150),
                         dy: CGFloat(200 + t * 180),
                         angle: t * 720 - 360,
                         color: Self.colors[i % Self.colors.count],
                         delay: t * 0.2)
        }
    }

    var body: some View {
        GeometryReader { geo in
            ZStack {
                if !reduceMotion {
                    ForEach(pieces) { piece in
                        RoundedRectangle(cornerRadius: 2)
                            .fill(piece.color)
                            .frame(width: 8, height: 13)
                            .position(x: geo.size.width * piece.x,
                                      y: geo.size.height * 0.3)
                            .offset(x: launched ? piece.dx : 0,
                                    y: launched ? piece.dy : 0)
                            .rotationEffect(.degrees(launched ? piece.angle : 0))
                            .opacity(launched ? 0 : 1)
                            .animation(.easeOut(duration: 1.5).delay(piece.delay), value: launched)
                    }
                }
                Text(message)
                    .font(Chrome.label(15, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 22)
                    .padding(.vertical, 12)
                    .background(
                        Capsule().fill(
                            LinearGradient(colors: [Color(red: 1.0, green: 0.369, blue: 0.541),
                                                    Color(red: 1.0, green: 0.690, blue: 0.125)],
                                           startPoint: .leading, endPoint: .trailing))
                    )
                    .position(x: geo.size.width / 2, y: geo.size.height * 0.2)
                    .opacity(launched ? 1 : 0)
                    .animation(.easeOut(duration: 0.2), value: launched)
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
        .onAppear { launched = true }
        .task {
            try? await Task.sleep(nanoseconds: 2_000_000_000)
            onFinished()
        }
    }
}
