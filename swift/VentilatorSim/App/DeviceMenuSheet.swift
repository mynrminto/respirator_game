import SwiftUI

/// 呼吸器の画面の左上「≡」から開くメニュー。下から出るシートで、項目は縦にスクロールできる。
/// 行き先（患者情報・レッスン一覧など）は選ぶとシートを閉じ、閉じきってから呼び出し側が開く。
/// 音と見た目の切り替えはその場で変わり、シートは開いたまま。
struct DeviceMenuSheet: View {
    enum Pick { case patient, course, cases, story, title }

    /// 見出し（患者の名前と体重）。
    var title: String
    var onPick: (Pick) -> Void

    @Environment(\.dismiss) private var dismiss
    // SoundBoard・BGMPlayer は観測できないので、表示用に写しを持って書き込みも通す。
    @State private var sound = SoundBoard.shared.isEnabled
    @State private var pulse = SoundBoard.shared.isPulseEnabled
    @State private var bgm = BGMPlayer.shared.isEnabled

    var body: some View {
        NavigationStack {
            List {
                Section(title) {
                    row("患者情報", "person.text.rectangle", .patient)
                    row("レッスン一覧", "list.bullet", .course)
                    row("症例を選ぶ", "person.2", .cases)
                    row("物語を読み返す", "book", .story)
                }
                Section("音と見た目") {
                    Toggle(isOn: $sound) { Label("音", systemImage: sound ? "speaker.wave.2" : "speaker.slash") }
                        .onChange(of: sound) { _, v in SoundBoard.shared.isEnabled = v }
                    Toggle(isOn: $pulse) { Label("パルス音", systemImage: pulse ? "heart" : "heart.slash") }
                        .onChange(of: pulse) { _, v in SoundBoard.shared.isPulseEnabled = v }
                        .disabled(!sound)
                    Toggle(isOn: $bgm) { Label("BGM", systemImage: bgm ? "music.note" : "speaker.slash") }
                        .onChange(of: bgm) { _, v in BGMPlayer.shared.isEnabled = v }
                        .disabled(!sound)
                    Button { ThemeStore.shared.toggle() } label: {
                        HStack {
                            Label("見た目を切り替える", systemImage: "paintpalette")
                            Spacer(minLength: 8)
                            Text("いま：\(Chrome.kind.label)").foregroundStyle(.secondary)
                        }
                    }
                    .foregroundStyle(Chrome.ink)
                }
                Section {
                    row("タイトルへ", "house", .title)
                }
            }
            .navigationTitle("メニュー")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("閉じる") { dismiss() } }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    private func row(_ text: String, _ icon: String, _ pick: Pick) -> some View {
        Button { onPick(pick) } label: {
            Label(text, systemImage: icon)
                .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                .contentShape(Rectangle())
        }
        .foregroundStyle(Chrome.ink)
    }
}
