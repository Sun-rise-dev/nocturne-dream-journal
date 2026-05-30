import SwiftUI

struct TimelineView: View {
    @Environment(DreamStore.self) private var store
    @Environment(LanguageManager.self) private var lang
    @State private var showInsights = false

    var body: some View {
        List {
            // Header
            Section {
                VStack(alignment: .leading, spacing: 2) {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Nocturne")
                                .font(.largeTitle).fontWeight(.bold)
                            Text(lang.t("timeline_subtitle"))
                                .font(.footnote).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Button(lang.isChinese ? "EN" : "中") {
                            lang.toggle()
                        }
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 10).padding(.vertical, 6)
                        .background(.ultraThinMaterial, in: Capsule())
                    }

                    // Stat row
                    if !store.dreams.isEmpty {
                        Button { showInsights = true } label: {
                            HStack {
                                StatCell(value: "\(store.totalDreams)", label: lang.t("stat_dreams"))
                                StatCell(value: "\(store.topKeywords.count)", label: lang.t("stat_symbols"))
                                StatCell(value: store.emotionStats.first.flatMap { top in Dream.emotions.first(where: { $0.key == top.key })?.symbol } ?? "·", label: lang.t("stat_mood"))
                            }
                            .padding(.vertical, 12)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets())
            }

            // Dream list grouped by date
            if store.dreams.isEmpty {
                Section {
                    EmptyStateView()
                }
            } else {
                let groups = groupByDate()
                ForEach(groups.keys.sorted(by: >), id: \.self) { dateLabel in
                    Section(dateLabel.uppercased()) {
                        ForEach(groups[dateLabel] ?? []) { dream in
                            NavigationLink {
                                DreamDetailView(dream: dream)
                            } label: {
                                DreamCellView(dream: dream)
                            }
                        }
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(Color(red: 0, green: 0, blue: 0))
        .navigationDestination(for: Dream.self) { dream in
            DreamDetailView(dream: dream)
        }
        .sheet(isPresented: $showInsights) {
            InsightsView()
        }
    }

    private func groupByDate() -> [String: [Dream]] {
        var groups: [String: [Dream]] = [:]
        let cal = Calendar.current
        let fmt = RelativeDateTimeFormatter()
        fmt.unitsStyle = .full
        for dream in store.dreams {
            let label = cal.isDateInToday(dream.date) ? lang.t("section_today")
                : cal.isDateInYesterday(dream.date) ? lang.t("section_yesterday")
                : dream.date.formatted(Date.FormatStyle.dateTime.month(.wide).day())
            groups[label, default: []].append(dream)
        }
        return groups
    }
}

private struct StatCell: View {
    let value: String
    let label: String
    var body: some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.title2).fontWeight(.semibold)
                .foregroundStyle(Color(red: 0.54, green: 0.62, blue: 0.69))
            Text(label)
                .font(.caption2).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(Color(red: 0.11, green: 0.11, blue: 0.12), in: RoundedRectangle(cornerRadius: 12))
    }
}
