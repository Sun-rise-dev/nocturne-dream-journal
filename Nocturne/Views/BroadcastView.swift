import SwiftUI

struct BroadcastView: View {
    @Environment(LanguageManager.self) private var lang
    @State private var broadcasts: [BroadcastItem] = []
    @State private var isLoading = false

    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 2) {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Nocturne").font(.largeTitle).fontWeight(.bold)
                            Text(lang.t("broadcast_subtitle")).font(.footnote).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Button(lang.isChinese ? "EN" : "中") { lang.toggle() }
                            .font(.system(size: 11, weight: .medium)).foregroundStyle(.secondary)
                            .padding(.horizontal, 10).padding(.vertical, 6)
                            .background(.ultraThinMaterial, in: Capsule())
                    }
                }
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets())
            }

            if broadcasts.isEmpty {
                Section {
                    Text(lang.t("broadcast_empty"))
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 40)
                }
            } else {
                Section {
                    ForEach(broadcasts) { item in
                        BroadcastCardView(item: item, onReact: { emoji in
                            reactToBroadcast(id: item.id, emoji: emoji)
                        })
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(Color(red: 0, green: 0, blue: 0))
        .onAppear { loadBroadcasts() }
        .refreshable { loadBroadcasts() }
    }

    private func loadBroadcasts() {
        broadcasts = BroadcastStorage.shared.loadBroadcasts()
    }

    private func reactToBroadcast(id: String, emoji: String) {
        BroadcastStorage.shared.addReaction(broadcastId: id, emoji: emoji)
        loadBroadcasts()
    }
}

// MARK: - Simple in-memory broadcast storage (demo only; in production, use server)

struct BroadcastItem: Identifiable, Codable {
    var id: String
    var narrative: String
    var emotion: String
    var date: Date
    var reactions: [String: Int]

    var emotionSymbol: String {
        Dream.emotions.first { $0.key == emotion }?.symbol ?? "·"
    }
    var emotionLabel: String {
        let lang = UserDefaults.standard.string(forKey: "nocturne-lang") ?? "zh"
        return Dream.emotions.first { $0.key == emotion }.map { lang == "zh" ? $0.zh : $0.en } ?? emotion
    }
}

final class BroadcastStorage {
    static let shared = BroadcastStorage()

    func loadBroadcasts() -> [BroadcastItem] {
        guard let data = UserDefaults.standard.data(forKey: "nocturne-broadcast"),
              let items = try? JSONDecoder().decode([BroadcastItem].self, from: data)
        else { return [] }
        return items
    }

    func saveBroadcast(_ item: BroadcastItem) {
        var items = loadBroadcasts()
        items.insert(item, at: 0)
        save(items)
    }

    func addReaction(broadcastId: String, emoji: String) {
        var items = loadBroadcasts()
        if let idx = items.firstIndex(where: { $0.id == broadcastId }) {
            items[idx].reactions[emoji, default: 0] += 1
            save(items)
        }
    }

    private func save(_ items: [BroadcastItem]) {
        guard let data = try? JSONEncoder().encode(items) else { return }
        UserDefaults.standard.set(data, forKey: "nocturne-broadcast")
    }
}

private struct BroadcastCardView: View {
    let item: BroadcastItem
    let onReact: (String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(item.emotionSymbol)
                Text(item.emotionLabel)
            }
            .font(.footnote).foregroundStyle(.tertiary)

            Text(item.narrative.prefix(180))
                .font(.subheadline).lineSpacing(4).foregroundStyle(.primary)

            HStack(spacing: 6) {
                ForEach(["○", "⁕", "^"], id: \.self) { emoji in
                    Button {
                        onReact(emoji)
                    } label: {
                        HStack(spacing: 3) {
                            Text(emoji)
                            if let count = item.reactions[emoji], count > 0 {
                                Text("\(count)").font(.caption2).foregroundStyle(.secondary)
                            }
                        }
                        .padding(.horizontal, 10).padding(.vertical, 6)
                        .background(
                            (item.reactions[emoji] ?? 0) > 0
                                ? Color(red: 0.54, green: 0.62, blue: 0.69).opacity(0.15)
                                : Color.white.opacity(0.05),
                            in: RoundedRectangle(cornerRadius: 6)
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(.vertical, 4)
    }
}
