import SwiftUI

/// 起動時のロゴ（KIND-AI）。iOS の起動画面（Info.plist の UILaunchScreen）と同じ黒地・同じ大きさ・
/// 画面のまん中に置いて、起動画面からつなぎ目なく続ける。少し見せてからタイトルへ。タップで飛ばせる。
///
/// 出てすぐ、光の帯が盾の上を斜めに走り、右上に星がキラッと光る。同時に鈴の音（SoundBoard の sparkle）。
/// 音は音全体のオン/オフに従い、マナーモードでは鳴らない（.ambient）。タイトルの BGM はロゴが消えてから。
/// 視差効果を減らす設定では帯を走らせず、星をふわっと出すだけにする。
struct SplashView: View {
    var onFinish: () -> Void

    /// 起動画面の KindLogo と同じ幅（pt）。変えるときは KindLogo.imageset の書き出しもそろえる。
    static let logoWidth: CGFloat = 220
    /// ロゴの縦横比（KindLogo の書き出し 660×762）。
    private static let logoAspect: CGFloat = 762.0 / 660.0
    private let holdSeconds: Double = 1.9

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var finished = false
    /// 光の帯の位置。-1 で左上の外、1 で右下の外。
    @State private var sweep: CGFloat = -1
    @State private var glint: CGFloat = 0
    @State private var glintSpin: Double = -40

    var body: some View {
        let w = Self.logoWidth, h = w * Self.logoAspect
        ZStack {
            Color.black
            ZStack {
                logo
                // 光の帯。ロゴの明るいところ（線と文字）だけが光るように、ロゴの明るさで型を抜く。
                // 型はロゴと同じ枠に置く（帯の枠に置くと型も帯と一緒に動いてしまう）。
                // 型の濃さは線の明るさまでなので、2 枚重ねてはっきり光らせる。
                ForEach(0..<2, id: \.self) { _ in
                Color.clear
                    .overlay {
                        LinearGradient(colors: [.clear, .white, .clear],
                                       startPoint: .leading, endPoint: .trailing)
                            .frame(width: w * 0.5, height: h * 1.8)
                            .rotationEffect(.degrees(24))
                            .offset(x: sweep * w * 1.1)
                    }
                    .mask(logo.luminanceToAlpha())
                    .blendMode(.plusLighter)
                    .allowsHitTesting(false)
                }
                // 右上の星
                Image(systemName: "sparkle")
                    .font(.system(size: 34, weight: .regular))
                    .foregroundStyle(.white)
                    .shadow(color: Color(red: 0.2, green: 0.7, blue: 1), radius: 8)
                    .shadow(color: .white, radius: 2)
                    .scaleEffect(glint)
                    .rotationEffect(.degrees(glintSpin))
                    .opacity(Double(min(1, glint * 1.5)))
                    .offset(x: w * 0.33, y: -h * 0.36)
                    .accessibilityHidden(true)
            }
            .frame(width: w, height: h)
        }
        // 起動画面は安全領域を無視した画面全体のまん中に絵を置くので、それに合わせる。
        .ignoresSafeArea()
        .contentShape(Rectangle())
        .onTapGesture { finish() }
        .statusBarHidden()
        .task {
            try? await Task.sleep(for: .seconds(0.25))
            SoundBoard.shared.play(.sparkle)
            if reduceMotion {
                withAnimation(.easeOut(duration: 0.5)) { glint = 0.9; glintSpin = 0 }
            } else {
                withAnimation(.easeInOut(duration: 0.75)) { sweep = 1 }
                try? await Task.sleep(for: .seconds(0.4))
                withAnimation(.spring(response: 0.3, dampingFraction: 0.5)) { glint = 1.15; glintSpin = 0 }
                try? await Task.sleep(for: .seconds(0.35))
                withAnimation(.easeIn(duration: 0.45)) { glint = 0; glintSpin = 45 }
            }
            try? await Task.sleep(for: .seconds(holdSeconds - 1.0))
            finish()
        }
    }

    private var logo: some View {
        Image("KindLogo")
            .resizable()
            .aspectRatio(contentMode: .fit)
            .accessibilityLabel("KIND-AI")
    }

    private func finish() {
        guard !finished else { return }
        finished = true
        onFinish()
    }
}
