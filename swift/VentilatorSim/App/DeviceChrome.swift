import SwiftUI

/// 筐体の色と寸法。実機の画面は黒に近い背景に彩度の高い波形を載せるので、
/// システムの動的配色ではなく固定値で持つ。
enum Chrome {
    static let chassisTop = Color(red: 0.102, green: 0.118, blue: 0.137)
    static let chassis    = Color(red: 0.082, green: 0.094, blue: 0.110)
    static let screen     = Color(red: 0.016, green: 0.027, blue: 0.039)
    static let screenTile = Color(red: 0.031, green: 0.047, blue: 0.067)
    static let line       = Color(red: 0.086, green: 0.125, blue: 0.161)
    static let edge       = Color(red: 0.039, green: 0.051, blue: 0.063)

    static let ink   = Color(red: 0.863, green: 0.902, blue: 0.941)
    static let dim   = Color(red: 0.494, green: 0.557, blue: 0.627)
    static let faint = Color(red: 0.290, green: 0.341, blue: 0.396)

    static let pressure = Color(red: 0.961, green: 0.706, blue: 0.161)
    static let flow     = Color(red: 0.184, green: 0.847, blue: 0.659)
    static let volume   = Color(red: 0.561, green: 0.659, blue: 1.000)
    static let critical = Color(red: 1.000, green: 0.294, blue: 0.341)
    static let warning  = Color(red: 1.000, green: 0.690, blue: 0.227)
    static let good     = Color(red: 0.243, green: 0.796, blue: 0.502)
    static let sim      = Color(red: 0.561, green: 0.659, blue: 1.000)

    static func digits(_ size: CGFloat, weight: Font.Weight = .semibold) -> Font {
        .system(size: size, weight: weight, design: .default).monospacedDigit()
    }
}

/// 機器のキー。押した感じを出すため、上辺だけ明るい線を入れる。
struct DeviceKey: View {
    let title: String
    var tint: Color = Chrome.ink
    var isOn: Bool = false
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 12))
                .foregroundStyle(isOn ? Chrome.flow : tint)
                .padding(.horizontal, 11)
                .padding(.vertical, 8)
                .frame(minWidth: 44)
        }
        .background(
            RoundedRectangle(cornerRadius: 4)
                .fill(Color(red: 0.106, green: 0.125, blue: 0.153))
                .overlay(
                    RoundedRectangle(cornerRadius: 4)
                        .stroke(isOn ? Chrome.flow : Chrome.edge, lineWidth: 1)
                )
        )
        .buttonStyle(.plain)
    }
}

/// 計測値のタイル。単位と、あれば上限の目安を小さく添える。
struct ValueTile: View {
    let caption: String
    let value: String
    let unit: String
    var limit: String? = nil
    var tone: Color = Chrome.ink

    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            HStack(alignment: .top, spacing: 4) {
                Text(caption)
                    .font(.system(size: 9.5))
                    .foregroundStyle(Chrome.dim)
                Spacer(minLength: 0)
                if let limit {
                    Text(limit).font(.system(size: 8.5)).foregroundStyle(Chrome.faint)
                }
            }
            HStack(alignment: .firstTextBaseline, spacing: 2) {
                Text(value)
                    .font(Chrome.digits(22))
                    .foregroundStyle(tone)
                Text(unit)
                    .font(.system(size: 8.5))
                    .foregroundStyle(Chrome.faint)
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
