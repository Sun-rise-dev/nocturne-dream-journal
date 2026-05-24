import SwiftUI

struct InsightsView: View {
    @Environment(DreamStore.self) private var store
    @Environment(LanguageManager.self) private var lang
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                // Emotions
                Section(lang.t("insights_emotions")) {
                    let stats = store.emotionStats
                    let maxCount = stats.first?.count ?? 1
                    ForEach(stats, id: \.key) { item in
                        let dream = Dream(rawText: "", emotion: item.key)
                        HStack(spacing: 10) {
                            Text(dream.emotionSymbol).frame(width: 22)
                            Text(dream.emotionLabel).font(.subheadline).frame(width: 60, alignment: .leading)
                            GeometryReader { geo in
                                RoundedRectangle(cornerRadius: 2)
                                    .fill(Color(red: 0.54, green: 0.62, blue: 0.69))
                                    .frame(width: max(4, geo.size.width * CGFloat(item.count) / CGFloat(maxCount)))
                            }
                            .frame(height: 4)
                            Text("\(item.count)").font(.footnote).foregroundStyle(.secondary).frame(width: 24, alignment: .trailing)
                        }
                    }
                }

                // Keywords
                Section(lang.t("insights_symbols")) {
                    let keywords = store.topKeywords.prefix(15)
                    FlowLayout(spacing: 8) {
                        ForEach(keywords, id: \.word) { item in
                            Text(item.word)
                                .font(.system(size: min(20, 12 + CGFloat(item.count) * 2)))
                                .foregroundStyle(.secondary.opacity(0.4 + 0.6 * CGFloat(item.count) / CGFloat(keywords.first?.count ?? 1)))
                                .padding(.horizontal, 8).padding(.vertical, 4)
                        }
                    }
                    .padding(.vertical, 8)
                }
            }
            .navigationTitle(lang.t("insights_title"))
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(lang.t("back")) { dismiss() }
                }
            }
        }
    }
}

/// Simple flow layout for keywords
struct FlowLayout: Layout {
    var spacing: CGFloat = 8
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let rows = arrange(proposal.width ?? 300, subviews)
        let height = rows.last.map { $0.maxY } ?? 0
        return CGSize(width: proposal.width ?? 300, height: height)
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let rows = arrange(bounds.width, subviews)
        for row in rows {
            for item in row.items {
                subviews[item.index].place(at: CGPoint(x: bounds.minX + item.x, y: bounds.minY + row.y), proposal: .unspecified)
            }
        }
    }
    struct RowItem { let index: Int; let x: CGFloat; let width: CGFloat }
    struct Row { let y: CGFloat; let maxY: CGFloat; let items: [RowItem] }
    private func arrange(_ maxWidth: CGFloat, _ subviews: Subviews) -> [Row] {
        var rows: [Row] = []
        var currentY: CGFloat = 0
        var currentX: CGFloat = 0
        var currentItems: [RowItem] = []
        var lineHeight: CGFloat = 0
        for (i, v) in subviews.enumerated() {
            let size = v.sizeThatFits(.unspecified)
            if currentX + size.width > maxWidth && !currentItems.isEmpty {
                rows.append(Row(y: currentY, maxY: currentY + lineHeight, items: currentItems))
                currentY += lineHeight + spacing
                currentX = 0; currentItems = []; lineHeight = 0
            }
            currentItems.append(RowItem(index: i, x: currentX, width: size.width))
            currentX += size.width + spacing
            lineHeight = max(lineHeight, size.height)
        }
        if !currentItems.isEmpty {
            rows.append(Row(y: currentY, maxY: currentY + lineHeight, items: currentItems))
        }
        return rows
    }
}
