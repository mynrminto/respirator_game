import SwiftUI

/// 入りきらないぶんを次の行へ送る並べ方。Web 版の `flex-wrap: wrap` にあたる。
///
/// 横に動かさないと見えない表示を作らないために、キーの列はすべてこれで並べる。
/// 横スクロールだと、画面の外にあるキーの存在に気づけない。
struct FlowLayout: Layout {
    var spacing: CGFloat = 6
    var lineSpacing: CGFloat = 6
    /// 行の中の縦ぞろえ。
    var alignment: VerticalAlignment = .center

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? .greatestFiniteMagnitude
        let rows = rows(of: subviews, width: width)
        let height = rows.reduce(0) { $0 + $1.height }
            + lineSpacing * CGFloat(max(0, rows.count - 1))
        let widest = rows.map(\.width).max() ?? 0
        return CGSize(width: proposal.width ?? widest, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize,
                       subviews: Subviews, cache: inout ()) {
        var y = bounds.minY
        for row in rows(of: subviews, width: bounds.width) {
            var x = bounds.minX
            for index in row.items {
                let size = subviews[index].sizeThatFits(.unspecified)
                var dy = (row.height - size.height) / 2
                if alignment == .top { dy = 0 }
                if alignment == .bottom { dy = row.height - size.height }
                subviews[index].place(at: CGPoint(x: x, y: y + dy),
                                      proposal: ProposedViewSize(size))
                x += size.width + spacing
            }
            y += row.height + lineSpacing
        }
    }

    private struct Row {
        var items: [Int] = []
        var width: CGFloat = 0
        var height: CGFloat = 0
    }

    /// 幅に合わせて行に分ける。1 つで幅を超えるものは、それだけで 1 行にする。
    private func rows(of subviews: Subviews, width: CGFloat) -> [Row] {
        var rows: [Row] = []
        var row = Row()
        for index in subviews.indices {
            let size = subviews[index].sizeThatFits(.unspecified)
            let needed = row.items.isEmpty ? size.width : row.width + spacing + size.width
            if !row.items.isEmpty && needed > width {
                rows.append(row)
                row = Row(items: [index], width: size.width, height: size.height)
            } else {
                row.items.append(index)
                row.width = needed
                row.height = max(row.height, size.height)
            }
        }
        if !row.items.isEmpty { rows.append(row) }
        return rows
    }
}
