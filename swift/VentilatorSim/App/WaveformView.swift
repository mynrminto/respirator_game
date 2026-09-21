import SwiftUI

/// 実機と同じスイープ表示。Swift Charts は静的なグラフ向けなので、
/// 毎フレーム流れる波形は Canvas に直接描く。
struct WaveformView: View {
    let samples: [Double]
    let cursor: Int
    let range: ClosedRange<Double>
    let color: Color
    let caption: String
    let unit: String

    var body: some View {
        TimelineView(.animation) { _ in
            Canvas { context, size in
                draw(in: &context, size: size)
            }
        }
        .overlay(alignment: .topLeading) {
            Text("\(caption)  \(unit)")
                .font(.system(size: 11, weight: .medium, design: .default))
                .kerning(0.8)
                .foregroundStyle(color)
                .padding(.leading, 8)
                .padding(.top, 4)
        }
        .overlay(alignment: .topTrailing) {
            Text("\(Int(range.lowerBound)) – \(Int(range.upperBound))")
                .font(.system(size: 11))
                .foregroundStyle(.secondary)
                .padding(.trailing, 8)
                .padding(.top, 4)
        }
        .accessibilityLabel("\(caption)の波形")
    }

    private func draw(in context: inout GraphicsContext, size: CGSize) {
        guard !samples.isEmpty else { return }
        let width = size.width, height = size.height
        let span = range.upperBound - range.lowerBound
        func y(_ value: Double) -> CGFloat {
            height - CGFloat((value - range.lowerBound) / span) * height
        }

        // 1 秒ごとのグリッド
        var grid = Path()
        for second in 1..<8 {
            let x = width * CGFloat(second) / 8
            grid.move(to: CGPoint(x: x, y: 0))
            grid.addLine(to: CGPoint(x: x, y: height))
        }
        context.stroke(grid, with: .color(Color(white: 0.16)), lineWidth: 1)

        if range.contains(0) {
            var zero = Path()
            zero.move(to: CGPoint(x: 0, y: y(0)))
            zero.addLine(to: CGPoint(x: width, y: y(0)))
            context.stroke(zero, with: .color(Color(white: 0.24)), lineWidth: 1)
        }

        var trace = Path()
        var penDown = false
        let dx = width / CGFloat(samples.count)
        for (index, value) in samples.enumerated() {
            guard value.isFinite else { penDown = false; continue }
            let point = CGPoint(x: CGFloat(index) * dx,
                                y: min(max(y(value), -2), height + 2))
            if penDown { trace.addLine(to: point) } else { trace.move(to: point); penDown = true }
        }
        context.stroke(trace, with: .color(color),
                       style: StrokeStyle(lineWidth: 1.7, lineCap: .round, lineJoin: .round))

        // 走査カーソル
        let cursorX = CGFloat(cursor) * dx
        context.fill(Path(CGRect(x: cursorX, y: 0, width: 2, height: height)),
                     with: .color(color.opacity(0.35)))
    }
}
