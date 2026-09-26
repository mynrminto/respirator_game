import SwiftUI

/// 起動時のロゴ（KIND-AI）。iOS の起動画面（Info.plist の UILaunchScreen）と同じ黒地・同じ大きさ・
/// 画面のまん中に置いて、起動画面からつなぎ目なく続ける。少し見せてからタイトルへ。タップで飛ばせる。
struct SplashView: View {
    var onFinish: () -> Void

    /// 起動画面の LaunchLogo と同じ幅（pt）。変えるときは KindLogo.imageset の書き出しもそろえる。
    static let logoWidth: CGFloat = 220
    private let holdSeconds: Double = 1.5

    @State private var finished = false

    var body: some View {
        ZStack {
            Color.black
            Image("KindLogo")
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(width: Self.logoWidth)
                .accessibilityLabel("KIND-AI")
        }
        // 起動画面は安全領域を無視した画面全体のまん中に絵を置くので、それに合わせる。
        .ignoresSafeArea()
        .contentShape(Rectangle())
        .onTapGesture { finish() }
        .statusBarHidden()
        .task {
            try? await Task.sleep(for: .seconds(holdSeconds))
            finish()
        }
    }

    private func finish() {
        guard !finished else { return }
        finished = true
        onFinish()
    }
}
