import SwiftUI

/// 実機と同じスイープ表示。3 本の波形を 1 枚の Canvas に描く。
/// Swift Charts は静的なグラフ向けなので、毎フレーム流れる波形には使わない。
struct ScopeView: View {
    struct Lane {
        let label: String
        let unit: String
        let color: Color
        let samples: [Double]
        let range: ClosedRange<Double>
        /// 気道内圧のレーンにだけ PEEP の基準線を引く。
        var reference: Double? = nil
    }

    let lanes: [Lane]
    let cursor: Int
    let sampleCount: Int
    let sweepSeconds: Double

    private let axisWidth: CGFloat = 34

    var body: some View {
        TimelineView(.animation) { _ in
            Canvas { context, size in
                draw(&context, size)
            }
        }
        .background(Chrome.screen)
        .accessibilityLabel("気道内圧・流量・容量の波形")
    }

    private func draw(_ context: inout GraphicsContext, _ size: CGSize) {
        guard !lanes.isEmpty, sampleCount > 1 else { return }
        let laneHeight = size.height / CGFloat(lanes.count)
        let plotWidth = size.width - axisWidth - 6

        for (index, lane) in lanes.enumerated() {
            let top = CGFloat(index) * laneHeight
            let bottom = top + laneHeight
            let span = lane.range.upperBound - lane.range.lowerBound
            func y(_ value: Double) -> CGFloat {
                let clamped = min(max(value, lane.range.lowerBound), lane.range.upperBound)
                return bottom - 4 - CGFloat((clamped - lane.range.lowerBound) / span) * (laneHeight - 10)
            }

            // 1 秒ごとの縦線
            var grid = Path()
            for second in 0...Int(sweepSeconds) {
                let x = axisWidth + plotWidth * CGFloat(Double(second) / sweepSeconds)
                grid.move(to: CGPoint(x: x, y: top + 2))
                grid.addLine(to: CGPoint(x: x, y: bottom - 2))
            }
            context.stroke(grid, with: .color(Chrome.screenTileLine.opacity(0.7)), lineWidth: 1)

            if index > 0 {
                var separator = Path()
                separator.move(to: CGPoint(x: 0, y: top))
                separator.addLine(to: CGPoint(x: size.width, y: top))
                context.stroke(separator, with: .color(Chrome.screenTileLine), lineWidth: 1)
            }

            // 0 の線
            if lane.range.contains(0) {
                var zero = Path()
                zero.move(to: CGPoint(x: axisWidth, y: y(0)))
                zero.addLine(to: CGPoint(x: size.width - 6, y: y(0)))
                context.stroke(zero, with: .color(Chrome.screenTileLine),
                               style: StrokeStyle(lineWidth: 1, dash: [3, 4]))
            }
            // PEEP の線
            if let reference = lane.reference, lane.range.contains(reference) {
                var line = Path()
                line.move(to: CGPoint(x: axisWidth, y: y(reference)))
                line.addLine(to: CGPoint(x: size.width - 6, y: y(reference)))
                context.stroke(line, with: .color(Chrome.good.opacity(0.35)),
                               style: StrokeStyle(lineWidth: 1, dash: [2, 5]))
            }

            // 目盛りとレーン名
            context.draw(Text(String(Int(lane.range.upperBound)))
                            .font(.system(size: 9)).foregroundColor(Chrome.screenDim),
                         at: CGPoint(x: axisWidth - 5, y: top + 9), anchor: .trailing)
            context.draw(Text(String(Int(lane.range.lowerBound)))
                            .font(.system(size: 9)).foregroundColor(Chrome.screenDim),
                         at: CGPoint(x: axisWidth - 5, y: bottom - 6), anchor: .trailing)
            context.draw(Text("\(lane.label)  \(lane.unit)")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundColor(lane.color.opacity(0.9)),
                         at: CGPoint(x: axisWidth + 6, y: top + 10), anchor: .leading)

            // 波形。薄い太線を下に敷いて、実機の発光した見え方に寄せる。
            var trace = Path()
            var penDown = false
            for (i, value) in lane.samples.enumerated() {
                let age = (i - cursor + sampleCount) % sampleCount
                guard value.isFinite, age <= sampleCount - 4 else { penDown = false; continue }
                let point = CGPoint(x: axisWidth + plotWidth * CGFloat(i) / CGFloat(sampleCount),
                                    y: y(value))
                if penDown { trace.addLine(to: point) } else { trace.move(to: point); penDown = true }
            }
            let glow = Chrome.glow
            context.stroke(trace, with: .color(lane.color.opacity(glow ? 0.22 : 0.16)),
                           style: StrokeStyle(lineWidth: glow ? 5.5 : 4.5, lineCap: .round, lineJoin: .round))
            context.stroke(trace, with: .color(lane.color),
                           style: StrokeStyle(lineWidth: glow ? 2 : 1.5, lineCap: .round, lineJoin: .round))

            // 走査カーソル
            let cursorX = axisWidth + plotWidth * CGFloat(cursor) / CGFloat(sampleCount)
            context.fill(Path(CGRect(x: cursorX, y: top + 1, width: 7, height: laneHeight - 2)),
                         with: .color(Color.white.opacity(0.07)))
            context.fill(Path(CGRect(x: cursorX, y: top + 1, width: 1, height: laneHeight - 2)),
                         with: .color(Color.white.opacity(0.45)))
        }
    }
}

/// P–V ループと F–V ループ。直前の呼吸を薄く重ねる。
struct LoopView: View {
    let current: [SimulationController.LoopPoint]
    let previous: [SimulationController.LoopPoint]
    /// 容量軸の最小の上端（mL）。体重で決める。成人の 100 mL を早産児に使うとループが点になる。
    var volumeFloor: Double = 100
    /// 流量軸の最小の振れ幅（±L/min）。これも体重で決める。
    var flowFloor: Double = 10

    var body: some View {
        GeometryReader { geometry in
            let wide = geometry.size.width > 470
            let layout = wide
                ? [CGRect(x: 0, y: 0, width: geometry.size.width / 2, height: geometry.size.height),
                   CGRect(x: geometry.size.width / 2, y: 0,
                          width: geometry.size.width / 2, height: geometry.size.height)]
                : [CGRect(x: 0, y: 0, width: geometry.size.width, height: geometry.size.height / 2),
                   CGRect(x: 0, y: geometry.size.height / 2,
                          width: geometry.size.width, height: geometry.size.height / 2)]
            TimelineView(.animation) { _ in
                Canvas { context, _ in
                    drawLoop(&context, in: layout[0], title: "P–V ループ",
                             yLabel: "Paw cmH₂O", color: Chrome.pressure) { $0.pressure }
                    drawLoop(&context, in: layout[1], title: "F–V ループ",
                             yLabel: "Flow L/min", color: Chrome.flow) { $0.flow }
                }
            }
        }
        .background(Chrome.screen)
        .accessibilityLabel("圧容量ループと流量容量ループ")
    }

    private func drawLoop(_ context: inout GraphicsContext, in frame: CGRect,
                          title: String, yLabel: String, color: Color,
                          value: (SimulationController.LoopPoint) -> Double) {
        let plot = CGRect(x: frame.minX + 44, y: frame.minY + 22,
                          width: frame.width - 56, height: frame.height - 48)
        guard plot.width > 40, plot.height > 40 else { return }
        context.stroke(Path(plot), with: .color(Chrome.screenTileLine), lineWidth: 1)
        context.draw(Text(title).font(.system(size: 10, weight: .semibold)).foregroundColor(Chrome.screenInk.opacity(0.85)),
                     at: CGPoint(x: plot.minX, y: frame.minY + 12), anchor: .leading)
        context.draw(Text("Volume mL").font(.system(size: 9)).foregroundColor(Chrome.screenDim),
                     at: CGPoint(x: plot.minX, y: plot.maxY + 12), anchor: .leading)
        context.draw(Text(yLabel).font(.system(size: 9)).foregroundColor(Chrome.screenDim),
                     at: CGPoint(x: plot.maxX, y: frame.minY + 12), anchor: .trailing)

        // 直前の呼吸を薄く、いま描いている呼吸をはっきりと重ねる。
        var sets: [(points: [SimulationController.LoopPoint], faded: Bool)] = []
        if previous.count > 8 { sets.append((previous, current.count > 24)) }
        if current.count > 24 { sets.append((current, false)) }
        let all = sets.flatMap(\.points)
        guard all.count > 8 else {
            context.draw(Text("計測中").font(.system(size: 11)).foregroundColor(Chrome.screenDim),
                         at: CGPoint(x: plot.midX, y: plot.midY))
            return
        }
        let volumeMax = max(volumeFloor, (all.map(\.volume).max() ?? volumeFloor) * 1.08)
        let values = all.map(value)
        var low = values.min() ?? 0
        var high = values.max() ?? 1
        if yLabel.hasPrefix("Paw") {
            low = min(-2, low); high = max(20, high * 1.08)
        } else {
            let magnitude = max(abs(low), abs(high), flowFloor) * 1.1
            low = -magnitude; high = magnitude
        }
        func point(_ p: SimulationController.LoopPoint) -> CGPoint {
            CGPoint(x: plot.minX + CGFloat(p.volume / volumeMax) * plot.width,
                    y: plot.maxY - CGFloat((min(max(value(p), low), high) - low) / (high - low)) * plot.height)
        }
        for set in sets where set.points.count > 1 {
            var path = Path()
            path.move(to: point(set.points[0]))
            for p in set.points.dropFirst() { path.addLine(to: point(p)) }
            context.stroke(path, with: .color(color.opacity(set.faded ? 0.28 : 1)),
                           style: StrokeStyle(lineWidth: set.faded ? 1 : 1.4,
                                              lineCap: .round, lineJoin: .round))
        }
    }
}

/// 直近の経過。実機のトレンド画面と同じく、圧・換気量・SpO₂ を縦に並べる。
struct TrendView: View {
    let samples: [SimulationController.TrendSample]
    /// Vte の軸の上端（mL）。体重で決め、はみ出したら広げる。
    var volumeMax: Double = 800

    var body: some View {
        Canvas { context, size in
            guard samples.count > 1 else {
                context.draw(Text("トレンドを記録しています")
                                .font(.system(size: 11)).foregroundColor(Chrome.screenDim),
                             at: CGPoint(x: size.width / 2, y: size.height / 2))
                return
            }
            let start = samples[0].time
            let span = max(60, samples[samples.count - 1].time - start)
            let laneHeight = size.height / 3
            let axis: CGFloat = 40

            func lane(_ index: Int, _ label: String, _ color: Color,
                      _ bounds: ClosedRange<Double>, _ pick: (SimulationController.TrendSample) -> Double?) {
                let top = CGFloat(index) * laneHeight + 14
                let bottom = CGFloat(index + 1) * laneHeight - 8
                var baseline = Path()
                baseline.move(to: CGPoint(x: axis, y: bottom))
                baseline.addLine(to: CGPoint(x: size.width - 8, y: bottom))
                context.stroke(baseline, with: .color(Chrome.screenTileLine), lineWidth: 1)
                context.draw(Text(label).font(.system(size: 10, weight: .semibold))
                                .foregroundColor(color.opacity(0.9)),
                             at: CGPoint(x: axis + 4, y: top), anchor: .leading)
                context.draw(Text(String(Int(bounds.upperBound))).font(.system(size: 9))
                                .foregroundColor(Chrome.screenDim),
                             at: CGPoint(x: axis - 4, y: top + 4), anchor: .trailing)
                context.draw(Text(String(Int(bounds.lowerBound))).font(.system(size: 9))
                                .foregroundColor(Chrome.screenDim),
                             at: CGPoint(x: axis - 4, y: bottom), anchor: .trailing)

                var path = Path()
                var penDown = false
                for sample in samples {
                    guard let raw = pick(sample), raw.isFinite else { penDown = false; continue }
                    let clamped = min(max(raw, bounds.lowerBound), bounds.upperBound)
                    let x = axis + CGFloat((sample.time - start) / span) * (size.width - axis - 10)
                    let y = bottom - CGFloat((clamped - bounds.lowerBound)
                                             / (bounds.upperBound - bounds.lowerBound)) * (bottom - top - 6)
                    let p = CGPoint(x: x, y: y)
                    if penDown { path.addLine(to: p) } else { path.move(to: p); penDown = true }
                }
                context.stroke(path, with: .color(color),
                               style: StrokeStyle(lineWidth: 1.5, lineCap: .round, lineJoin: .round))
            }

            lane(0, "PIP  cmH₂O", Chrome.pressure, 0...50) { $0.peak }
            let tidalPeak = samples.map(\.tidal).filter(\.isFinite).max() ?? 0
            let tidalTop = max(volumeMax, (tidalPeak * 1.2).rounded(.up))
            lane(1, "Vte  mL", Chrome.volume, 0...tidalTop) { $0.tidal }
            lane(2, "SpO₂  %", Chrome.spo2, 80...100) { $0.spo2 }

            context.draw(Text("直近 \(Int(span / 60)) 分").font(.system(size: 9))
                            .foregroundColor(Chrome.screenDim),
                         at: CGPoint(x: size.width / 2, y: size.height - 6))
        }
        .background(Chrome.screen)
        .accessibilityLabel("気道内圧・一回換気量・SpO₂ のトレンド")
    }
}
