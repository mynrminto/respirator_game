import SwiftUI

/// 実機のロータリーダイヤル。回しても値は確定するまで患者に届かない。
/// 指の回転角を積算し、15° ごとに 1 目盛り送る。
struct KnobView: View {
    /// 0…1。目盛りの位置。
    let fraction: Double
    /// 確定していない変更があるか。あれば色を変える。
    let isPending: Bool
    let isEnabled: Bool
    let accessibilityValue: String
    var onStep: (Double) -> Void
    var onCommit: () -> Void

    @State private var lastAngle: Double?
    @State private var accumulated: Double = 0

    private let sweep = Double.pi * 1.5          // 270°
    private let start = Double.pi * 0.75
    private let stepAngle = Double.pi / 12       // 15°

    var body: some View {
        Canvas { context, size in
            draw(&context, size)
        }
        .frame(width: 58, height: 58)
        .background(
            Circle().fill(
                RadialGradient(colors: [Chrome.palette.knobFaceTop,
                                        Chrome.palette.knobFaceMid,
                                        Chrome.palette.knobFaceBottom],
                               center: UnitPoint(x: 0.34, y: 0.28), startRadius: 2, endRadius: 40))
        )
        .overlay(Circle().stroke(Chrome.isPop ? Chrome.keyLip : Color(white: 0.24),
                                 lineWidth: Chrome.isPop ? 2 : 1))
        .opacity(isEnabled ? 1 : 0.45)
        .contentShape(Circle())
        .gesture(
            DragGesture(minimumDistance: 0)
                .onChanged { drag in
                    guard isEnabled else { return }
                    let angle = atan2(drag.location.y - 29, drag.location.x - 29)
                    defer { lastAngle = angle }
                    guard let previous = lastAngle else { return }
                    var delta = angle - previous
                    while delta > .pi { delta -= 2 * .pi }
                    while delta < -.pi { delta += 2 * .pi }
                    accumulated += delta
                    var guardCount = 0
                    while abs(accumulated) >= stepAngle && guardCount < 40 {
                        onStep(accumulated > 0 ? 1 : -1)
                        accumulated -= accumulated > 0 ? stepAngle : -stepAngle
                        guardCount += 1
                    }
                }
                .onEnded { _ in lastAngle = nil; accumulated = 0 }
        )
        .accessibilityElement()
        .accessibilityLabel("設定ダイヤル")
        .accessibilityValue(accessibilityValue)
        .accessibilityAdjustableAction { direction in
            switch direction {
            case .increment: onStep(1)
            case .decrement: onStep(-1)
            @unknown default: break
            }
        }
        .accessibilityAction(named: "確定") { onCommit() }
    }

    private func draw(_ context: inout GraphicsContext, _ size: CGSize) {
        let center = CGPoint(x: size.width / 2, y: size.height / 2)
        let radius = size.width / 2 - 3
        let tint = isPending ? Chrome.pressure : Chrome.accent

        var track = Path()
        track.addArc(center: center, radius: radius - 1,
                     startAngle: .radians(start), endAngle: .radians(start + sweep), clockwise: false)
        context.stroke(track, with: .color(Chrome.palette.knobTrack),
                       style: StrokeStyle(lineWidth: 3, lineCap: .round))

        if fraction > 0 {
            var filled = Path()
            filled.addArc(center: center, radius: radius - 1,
                          startAngle: .radians(start),
                          endAngle: .radians(start + sweep * fraction), clockwise: false)
            context.stroke(filled, with: .color(tint),
                           style: StrokeStyle(lineWidth: 3, lineCap: .round))
        }

        var ticks = Path()
        for i in 0...10 {
            let angle = start + sweep * (Double(i) / 10)
            ticks.move(to: CGPoint(x: center.x + cos(angle) * (radius - 6),
                                   y: center.y + sin(angle) * (radius - 6)))
            ticks.addLine(to: CGPoint(x: center.x + cos(angle) * (radius - 9),
                                      y: center.y + sin(angle) * (radius - 9)))
        }
        context.stroke(ticks, with: .color(Chrome.palette.knobTick), lineWidth: 1)

        let pointer = start + sweep * fraction
        var needle = Path()
        needle.move(to: CGPoint(x: center.x + cos(pointer) * (radius - 22),
                                y: center.y + sin(pointer) * (radius - 22)))
        needle.addLine(to: CGPoint(x: center.x + cos(pointer) * (radius - 10),
                                   y: center.y + sin(pointer) * (radius - 10)))
        context.stroke(needle, with: .color(isPending ? Chrome.pressure : Chrome.palette.knobPointer),
                       style: StrokeStyle(lineWidth: 2.5, lineCap: .round))
    }
}
