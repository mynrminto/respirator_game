import SwiftUI
import VentilatorCore

/// 研修手帳。幕を見るたびに書き足される主人公の手帳（Web 版 app.js の openNotebook と同じ）。
/// 中身は StoryLibrary.notebook。まだ書いていない欄は、書き足される時期だけを見せる
/// （いぶき先生のこと・息のことばは題も伏せる。できるようになったことは題だけ見せて、先の目標にする）。
struct NotebookView: View {
    @State var kind: StoryNote.Kind = .secret
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        let open = StoryLibrary.notesOpen(seen: StoryProgress.seen)
        content(open)
            .onAppear { BGMPlayer.shared.overlay = "notebook" }   // 手帳を読むあいだは研修手帳の曲
            .onDisappear { BGMPlayer.shared.overlay = nil }
    }

    @ViewBuilder private func content(_ open: [StoryNote]) -> some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    Text("\(StoryProgress.playerName)先生の手帳。ローテのあいだに見聞きしたことを書き留めていく。")
                        .font(Chrome.label(12.5))
                        .foregroundStyle(Chrome.dim)
                    tabs(open: open)
                    if kind == .growth { firstDay }
                    let items = StoryLibrary.notebook.filter { $0.kind == kind }
                    ForEach(Array(items.enumerated()), id: \.element.id) { i, note in
                        entry(note, number: i + 1, isOpen: open.contains(note))
                    }
                }
                .padding(16)
                .frame(maxWidth: 760)
                .frame(maxWidth: .infinity)
            }
            .background(Chrome.panel.ignoresSafeArea())
            .navigationTitle("研修手帳")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("閉じる") { dismiss() } }
            }
        }
    }

    private func tabs(open: [StoryNote]) -> some View {
        HStack(spacing: 6) {
            ForEach(StoryNote.Kind.allCases, id: \.self) { k in
                let all = StoryLibrary.notebook.filter { $0.kind == k }
                let got = all.filter { open.contains($0) }.count
                Button {
                    SoundBoard.shared.play(.tap)
                    kind = k
                } label: {
                    VStack(spacing: 2) {
                        Text(k.tab)
                            .font(Chrome.label(12.5, weight: .heavy))
                            .multilineTextAlignment(.center)
                            .lineLimit(2)
                            .minimumScaleFactor(0.8)
                        Text("\(got) / \(all.count)")
                            .font(Chrome.digits(11, weight: .bold))
                            .foregroundStyle(Chrome.dim)
                    }
                    .foregroundStyle(kind == k ? Chrome.ink : Chrome.dim)
                    .frame(maxWidth: .infinity, minHeight: 52)
                    .background(RoundedRectangle(cornerRadius: Chrome.isPop ? 12 : 4)
                        .fill(kind == k ? Chrome.panel2 : Color.clear))
                    .overlay(RoundedRectangle(cornerRadius: Chrome.isPop ? 12 : 4)
                        .stroke(kind == k ? Chrome.accent : Chrome.line, lineWidth: 2))
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var firstDay: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("初日のわたし").font(Chrome.label(11, weight: .heavy)).foregroundStyle(NotebookView.gold)
            Text("「子どもの呼吸器は、まったく触ったことがなくて」")
                .font(Chrome.label(13)).foregroundStyle(Chrome.dim)
        }
        .padding(.leading, 10)
        .overlay(alignment: .leading) { Rectangle().fill(NotebookView.gold).frame(width: 3) }
    }

    private func entry(_ note: StoryNote, number: Int, isOpen: Bool) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                Text("\(number)")
                    .font(Chrome.label(11.5, weight: .heavy))
                    .foregroundStyle(.white)
                    .frame(width: 22, height: 22)
                    .background(Circle().fill(isOpen ? NotebookView.tint(note.kind) : Color.gray.opacity(0.6)))
                Text(isOpen || note.kind == .growth ? note.title : "？？？")
                    .font(Chrome.label(14.5, weight: .heavy))
                    .foregroundStyle(Chrome.ink)
            }
            if !isOpen {
                Text("まだ書いていない（\(note.hint)に）")
                    .font(Chrome.label(12)).foregroundStyle(Chrome.faint)
            } else if note.kind == .growth {
                Grid(alignment: .leadingFirstTextBaseline, horizontalSpacing: 8, verticalSpacing: 4) {
                    GridRow {
                        badge("初日", fill: Chrome.panel2, ink: Chrome.dim)
                        Text(note.before ?? "").font(Chrome.label(13)).foregroundStyle(Chrome.faint)
                    }
                    GridRow {
                        badge("いま", fill: NotebookView.tint(.growth), ink: .white)
                        Text(note.now ?? "").font(Chrome.label(13, weight: .bold)).foregroundStyle(Chrome.ink)
                    }
                }
            } else {
                Text(note.text)
                    .font(Chrome.label(13))
                    .foregroundStyle(Chrome.ink)
                    .lineSpacing(4)
                    .fixedSize(horizontal: false, vertical: true)
                if let source = note.source {
                    Text("出典：\(source)").font(Chrome.label(11)).foregroundStyle(Chrome.faint)
                }
            }
        }
        .padding(.horizontal, 12).padding(.vertical, 10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: Chrome.isPop ? 14 : 4)
            .fill(isOpen ? Chrome.panel2 : Color.clear))
        .overlay(RoundedRectangle(cornerRadius: Chrome.isPop ? 14 : 4)
            .stroke(Chrome.line, style: StrokeStyle(lineWidth: 1.5, dash: isOpen ? [] : [5, 4])))
        .opacity(isOpen ? 1 : 0.7)
    }

    private func badge(_ text: String, fill: Color, ink: Color) -> some View {
        Text(text)
            .font(Chrome.label(11, weight: .heavy))
            .foregroundStyle(ink)
            .padding(.horizontal, 8).padding(.vertical, 1)
            .background(Capsule().fill(fill))
    }

    static let gold = Color(red: 0.78, green: 0.56, blue: 0.18)

    static func tint(_ kind: StoryNote.Kind) -> Color {
        switch kind {
        case .secret: return Color(red: 0.88, green: 0.34, blue: 0.54)
        case .lore: return Color(red: 0.24, green: 0.61, blue: 0.88)
        case .growth: return Color(red: 0.07, green: 0.66, blue: 0.47)
        }
    }
}
