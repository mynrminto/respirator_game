import SwiftUI

/// キャラクター。画像を持たずに済むよう Canvas で描く。
/// 形は Web 版の characters.js と同じ（120×120 の座標系）で、表情だけ mood で変える。
enum CharacterMood {
    case normal, happy, think, alert, sad
}

/// 120×120 の設計座標をそのまま書けるようにする小道具。
private struct Pen {
    let scale: CGFloat
    let dx: CGFloat
    let dy: CGFloat

    init(_ size: CGSize) {
        scale = min(size.width, size.height) / 120
        dx = (size.width - 120 * scale) / 2
        dy = (size.height - 120 * scale) / 2
    }

    func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
        CGPoint(x: dx + x * scale, y: dy + y * scale)
    }

    func w(_ v: CGFloat) -> CGFloat { v * scale }

    func circle(_ cx: CGFloat, _ cy: CGFloat, _ r: CGFloat) -> Path {
        Path(ellipseIn: CGRect(x: dx + (cx - r) * scale, y: dy + (cy - r) * scale,
                               width: r * 2 * scale, height: r * 2 * scale))
    }

    func ellipse(_ cx: CGFloat, _ cy: CGFloat, _ rx: CGFloat, _ ry: CGFloat) -> Path {
        Path(ellipseIn: CGRect(x: dx + (cx - rx) * scale, y: dy + (cy - ry) * scale,
                               width: rx * 2 * scale, height: ry * 2 * scale))
    }

    func rounded(_ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat, _ r: CGFloat) -> Path {
        Path(roundedRect: CGRect(x: dx + x * scale, y: dy + y * scale,
                                 width: w * scale, height: h * scale),
             cornerRadius: r * scale)
    }

    /// 連続したパスを設計座標で書く。move → quad/line の並びをそのまま渡す。
    func path(_ build: (inout Path, Pen) -> Void) -> Path {
        var path = Path()
        build(&path, self)
        return path
    }
}

private enum Ink {
    static let line = Color(red: 0.165, green: 0.137, blue: 0.251)      // 目と口
    static let skin = Color(red: 1.000, green: 0.871, blue: 0.753)
    static let skinMid = Color(red: 0.961, green: 0.824, blue: 0.706)
    static let skinBad = Color(red: 0.914, green: 0.765, blue: 0.706)
    static let hair = Color(red: 0.235, green: 0.200, blue: 0.333)
    static let hairPatient = Color(red: 0.290, green: 0.255, blue: 0.376)
    static let scrub = Color(red: 0.184, green: 0.788, blue: 0.643)
    static let scrubDark = Color(red: 0.118, green: 0.663, blue: 0.541)
    static let steth = Color(red: 0.271, green: 0.318, blue: 0.412)
    static let stethHead = Color(red: 0.561, green: 0.627, blue: 0.737)
    static let lungL = Color(red: 1.000, green: 0.561, blue: 0.659)
    static let lungR = Color(red: 1.000, green: 0.494, blue: 0.608)
    static let tube = Color(red: 0.812, green: 0.878, blue: 1.000)
    static let tubeLine = Color(red: 0.561, green: 0.690, blue: 0.933)
    static let pillow = Color(red: 0.918, green: 0.941, blue: 1.000)
    static let blanket = Color(red: 0.749, green: 0.816, blue: 0.961)
    static let blush = Color(red: 1.000, green: 0.616, blue: 0.710)
}

/// 目。表情ごとに描き分ける。
private func drawEyes(_ ctx: inout GraphicsContext, _ pen: Pen, _ mood: CharacterMood,
                      _ cx1: CGFloat, _ cx2: CGFloat, _ cy: CGFloat, _ r: CGFloat) {
    switch mood {
    case .happy:
        for cx in [cx1, cx2] {
            let arc = pen.path { p, k in
                p.move(to: k.p(cx - r, cy))
                p.addQuadCurve(to: k.p(cx + r, cy), control: k.p(cx, cy - r * 2.2))
            }
            ctx.stroke(arc, with: .color(Ink.line),
                       style: StrokeStyle(lineWidth: pen.w(2.6), lineCap: .round))
        }
    case .think:
        ctx.fill(pen.ellipse(cx1, cy, r * 0.55, r * 0.8), with: .color(Ink.line))
        ctx.fill(pen.ellipse(cx2, cy, r * 0.55, r * 0.8), with: .color(Ink.line))
        let brows = pen.path { p, k in
            p.move(to: k.p(cx1 - r, cy - r * 1.5))
            p.addLine(to: k.p(cx1 + r * 0.8, cy - r * 1.9))
            p.move(to: k.p(cx2 + r, cy - r * 1.5))
            p.addLine(to: k.p(cx2 - r * 0.8, cy - r * 1.9))
        }
        ctx.stroke(brows, with: .color(Ink.line),
                   style: StrokeStyle(lineWidth: pen.w(2), lineCap: .round))
    case .alert:
        for cx in [cx1, cx2] {
            ctx.fill(pen.circle(cx, cy, r * 0.95), with: .color(.white))
            ctx.stroke(pen.circle(cx, cy, r * 0.95), with: .color(Ink.line), lineWidth: pen.w(1))
            ctx.fill(pen.circle(cx, cy, r * 0.5), with: .color(Ink.line))
        }
    default:
        ctx.fill(pen.ellipse(cx1, cy, r * 0.62, r * 0.85), with: .color(Ink.line))
        ctx.fill(pen.ellipse(cx2, cy, r * 0.62, r * 0.85), with: .color(Ink.line))
    }
}

private func drawMouth(_ ctx: inout GraphicsContext, _ pen: Pen, _ mood: CharacterMood,
                       _ cx: CGFloat, _ cy: CGFloat, _ w: CGFloat) {
    switch mood {
    case .happy:
        let smile = pen.path { p, k in
            p.move(to: k.p(cx - w, cy))
            p.addQuadCurve(to: k.p(cx + w, cy), control: k.p(cx, cy + w * 2.3))
            p.closeSubpath()
        }
        ctx.fill(smile, with: .color(Color(red: 1.0, green: 0.502, blue: 0.596)))
        ctx.stroke(smile, with: .color(Ink.line),
                   style: StrokeStyle(lineWidth: pen.w(2.4), lineJoin: .round))
    case .sad:
        let frown = pen.path { p, k in
            p.move(to: k.p(cx - w * 0.8, cy + w * 0.4))
            p.addQuadCurve(to: k.p(cx + w * 0.8, cy + w * 0.4), control: k.p(cx, cy - w * 1.4))
        }
        ctx.stroke(frown, with: .color(Ink.line),
                   style: StrokeStyle(lineWidth: pen.w(2.4), lineCap: .round))
    case .alert:
        ctx.fill(pen.ellipse(cx, cy + w * 0.2, w * 0.5, w * 0.62), with: .color(Ink.line))
    default:
        let smile = pen.path { p, k in
            p.move(to: k.p(cx - w * 0.7, cy))
            p.addQuadCurve(to: k.p(cx + w * 0.7, cy), control: k.p(cx, cy + w * 1.4))
        }
        ctx.stroke(smile, with: .color(Ink.line),
                   style: StrokeStyle(lineWidth: pen.w(2.4), lineCap: .round))
    }
}

private func drawBlush(_ ctx: inout GraphicsContext, _ pen: Pen,
                       _ cx1: CGFloat, _ cx2: CGFloat, _ cy: CGFloat, _ r: CGFloat) {
    ctx.opacity = 0.55
    ctx.fill(pen.ellipse(cx1, cy, r, r * 0.62), with: .color(Ink.blush))
    ctx.fill(pen.ellipse(cx2, cy, r, r * 0.62), with: .color(Ink.blush))
    ctx.opacity = 1
}

/// 指導医「みどり先生」。レッスンで話す役。
struct DoctorView: View {
    var mood: CharacterMood = .normal
    var disc: Color? = nil

    var body: some View {
        Canvas { ctx, size in
            let pen = Pen(size)
            if let disc { ctx.fill(pen.circle(60, 60, 58), with: .color(disc)) }

            let body = pen.path { p, k in
                p.move(to: k.p(28, 120))
                p.addQuadCurve(to: k.p(46, 87), control: k.p(30, 94))
                p.addLine(to: k.p(60, 82))
                p.addLine(to: k.p(74, 87))
                p.addQuadCurve(to: k.p(92, 120), control: k.p(90, 94))
                p.closeSubpath()
            }
            ctx.fill(body, with: .color(Ink.scrub))

            let collar = pen.path { p, k in
                p.move(to: k.p(46, 82))
                p.addLine(to: k.p(60, 95))
                p.addLine(to: k.p(74, 82))
                p.addLine(to: k.p(68, 79))
                p.addLine(to: k.p(60, 86))
                p.addLine(to: k.p(52, 79))
                p.closeSubpath()
            }
            ctx.fill(collar, with: .color(Ink.scrubDark))

            let steth = pen.path { p, k in
                p.move(to: k.p(48, 84))
                p.addQuadCurve(to: k.p(60, 106), control: k.p(48, 106))
                p.addQuadCurve(to: k.p(72, 90), control: k.p(72, 106))
            }
            ctx.stroke(steth, with: .color(Ink.steth),
                       style: StrokeStyle(lineWidth: pen.w(3), lineCap: .round))
            ctx.fill(pen.circle(72, 92, 5.5), with: .color(Ink.stethHead))
            ctx.fill(pen.circle(72, 92, 2.6), with: .color(Color(red: 0.863, green: 0.894, blue: 0.949)))

            ctx.fill(pen.rounded(53, 70, 14, 12, 6), with: .color(Ink.skinMid))
            ctx.fill(pen.circle(60, 52, 26), with: .color(Ink.skin))

            let hair = pen.path { p, k in
                p.move(to: k.p(33, 52))
                p.addQuadCurve(to: k.p(60, 24), control: k.p(33, 24))
                p.addQuadCurve(to: k.p(87, 52), control: k.p(87, 24))
                p.addQuadCurve(to: k.p(78, 36), control: k.p(87, 39))
                p.addQuadCurve(to: k.p(51, 42), control: k.p(69, 44))
                p.addQuadCurve(to: k.p(33, 52), control: k.p(39, 41))
                p.closeSubpath()
            }
            ctx.fill(hair, with: .color(Ink.hair))

            drawBlush(&ctx, pen, 45, 75, 60, 5.5)
            drawEyes(&ctx, pen, mood, 51, 69, 53, 4.6)
            drawMouth(&ctx, pen, mood, 60, 62, 5.5)
        }
        .accessibilityHidden(true)
    }
}

/// マスコット「ぷくぷく」。肺そのもので、呼吸に合わせてふくらむ。
struct MascotView: View {
    var mood: CharacterMood = .happy
    var disc: Color? = nil
    /// 息づかい。false にすると止まる。
    var breathing: Bool = true

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var inflated = false

    var body: some View {
        Canvas { ctx, size in
            let pen = Pen(size)
            if let disc { ctx.fill(pen.circle(60, 60, 58), with: .color(disc)) }

            ctx.fill(pen.rounded(54, 20, 12, 20, 5),
                     with: .color(Color(red: 0.937, green: 0.953, blue: 1.000)))
            ctx.stroke(pen.rounded(54, 20, 12, 20, 5),
                       with: .color(Color(red: 0.788, green: 0.831, blue: 0.941)), lineWidth: pen.w(2))

            let left = pen.path { p, k in
                p.move(to: k.p(56, 38))
                p.addQuadCurve(to: k.p(44, 44), control: k.p(52, 40))
                p.addQuadCurve(to: k.p(28, 74), control: k.p(28, 52))
                p.addQuadCurve(to: k.p(44, 100), control: k.p(28, 98))
                p.addQuadCurve(to: k.p(56, 86), control: k.p(56, 102))
                p.closeSubpath()
            }
            let right = pen.path { p, k in
                p.move(to: k.p(64, 38))
                p.addQuadCurve(to: k.p(76, 44), control: k.p(68, 40))
                p.addQuadCurve(to: k.p(92, 74), control: k.p(92, 52))
                p.addQuadCurve(to: k.p(76, 100), control: k.p(92, 98))
                p.addQuadCurve(to: k.p(64, 86), control: k.p(64, 102))
                p.closeSubpath()
            }
            ctx.fill(left, with: .color(Ink.lungL))
            ctx.fill(right, with: .color(Ink.lungR))

            drawBlush(&ctx, pen, 40, 80, 76, 6)
            drawEyes(&ctx, pen, mood, 47, 73, 66, 5)
            drawMouth(&ctx, pen, mood, 60, 76, 6)
        }
        .scaleEffect(inflated ? 1.06 : 0.94, anchor: .center)
        .accessibilityHidden(true)
        .onAppear {
            guard breathing, !reduceMotion else { return }
            withAnimation(.easeInOut(duration: 1.8).repeatForever(autoreverses: true)) {
                inflated = true
            }
        }
    }
}

/// 患者。症例カードとタイトルに出す。tone で顔色を変える。
struct PatientView: View {
    enum Tone { case ok, mid, bad }
    var tone: Tone = .ok
    var disc: Color? = nil

    var body: some View {
        Canvas { ctx, size in
            let pen = Pen(size)
            if let disc { ctx.fill(pen.circle(60, 60, 58), with: .color(disc)) }

            let blanket = pen.path { p, k in
                p.move(to: k.p(10, 96))
                p.addQuadCurve(to: k.p(110, 96), control: k.p(60, 80))
                p.addLine(to: k.p(110, 120))
                p.addLine(to: k.p(10, 120))
                p.closeSubpath()
            }
            ctx.fill(blanket, with: .color(Ink.blanket))
            ctx.fill(pen.ellipse(60, 92, 44, 14), with: .color(Ink.pillow))

            let skin: Color = tone == .bad ? Ink.skinBad : (tone == .mid ? Ink.skinMid : Ink.skin)
            ctx.fill(pen.circle(60, 58, 26), with: .color(skin))

            let hair = pen.path { p, k in
                p.move(to: k.p(34, 56))
                p.addQuadCurve(to: k.p(60, 32), control: k.p(36, 32))
                p.addQuadCurve(to: k.p(86, 56), control: k.p(84, 32))
                p.addQuadCurve(to: k.p(60, 44), control: k.p(80, 44))
                p.addQuadCurve(to: k.p(34, 56), control: k.p(40, 44))
                p.closeSubpath()
            }
            ctx.fill(hair, with: .color(Ink.hairPatient))

            let lids = pen.path { p, k in
                p.move(to: k.p(46, 56))
                p.addQuadCurve(to: k.p(56, 56), control: k.p(51, 61))
                p.move(to: k.p(64, 56))
                p.addQuadCurve(to: k.p(74, 56), control: k.p(69, 61))
            }
            ctx.stroke(lids, with: .color(Ink.line),
                       style: StrokeStyle(lineWidth: pen.w(2.4), lineCap: .round))

            let tube = pen.path { p, k in
                p.move(to: k.p(60, 70))
                p.addQuadCurve(to: k.p(46, 86), control: k.p(60, 80))
                p.addQuadCurve(to: k.p(16, 90), control: k.p(32, 92))
            }
            ctx.stroke(tube, with: .color(Ink.tube),
                       style: StrokeStyle(lineWidth: pen.w(7), lineCap: .round))
            ctx.stroke(tube, with: .color(Ink.tubeLine),
                       style: StrokeStyle(lineWidth: pen.w(2), lineCap: .round))
            ctx.fill(pen.rounded(50, 64, 20, 9, 4.5), with: .color(.white))
            ctx.stroke(pen.rounded(50, 64, 20, 9, 4.5),
                       with: .color(Color(red: 0.788, green: 0.831, blue: 0.941)), lineWidth: pen.w(2))

            if tone == .bad {
                ctx.opacity = 0.85
                ctx.fill(pen.circle(96, 44, 7), with: .color(Chrome.critical))
                ctx.opacity = 1
            }
        }
        .accessibilityHidden(true)
    }
}

/// 丸く切り抜いたアイコン。学習帯や症例カード、タイトルのふきだしで使う。
struct CharacterBadge<Content: View>: View {
    var size: CGFloat
    /// 顔が小さく見えないよう、少し寄って切り抜く。
    var zoom: CGFloat = 1.2
    var ring: Color? = nil
    var background: Color = .clear
    @ViewBuilder var content: Content

    var body: some View {
        content
            .frame(width: size, height: size)
            .scaleEffect(zoom)
            .background(background)
            .clipShape(Circle())
            .overlay(Circle().strokeBorder(ring ?? .clear, lineWidth: ring == nil ? 0 : 2))
    }
}
