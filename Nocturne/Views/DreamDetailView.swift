import SwiftUI

struct DreamDetailView: View {
    @Environment(DreamStore.self) private var store
    @Environment(LanguageManager.self) private var lang
    @Environment(\.dismiss) private var dismiss
    let dream: Dream
    @State private var showUndo = false
    @State private var undoBackup: Dream?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Image
                if let url = dream.imageURL {
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .success(let image):
                            image.resizable().aspectRatio(3.0/4.0, contentMode: .fill)
                        default:
                            imagePlaceholder
                        }
                    }
                    .clipShape(RoundedRectangle(cornerRadius: 16))
                } else {
                    imagePlaceholder
                }

                HStack {
                    Text(dream.date.formatted(date: .abbreviated, time: .omitted))
                    Text("·")
                    Text(dream.emotionSymbol)
                    Text(dream.emotionLabel)
                }
                .font(.footnote).foregroundStyle(.secondary)

                Text(dream.title ?? dream.narrative.map { String($0.prefix(36)) } ?? "Untitled")
                    .font(.title2).fontWeight(.bold)
                    .fontDesign(.serif)

                if let narrative = dream.narrative {
                    Text(narrative)
                        .font(.body).lineSpacing(6)
                        .padding()
                        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 14))
                        .overlay(alignment: .leading) {
                            Rectangle()
                                .fill(Color(red: 0.78, green: 0.75, blue: 0.66).opacity(0.15))
                                .frame(width: 2)
                                .padding(.leading, -1)
                        }
                }

                if !dream.keywords.isEmpty {
                    LazyVGrid(columns: [.init(.adaptive(minimum: 80))], spacing: 8) {
                        ForEach(dream.keywords, id: \.self) { kw in
                            Text(kw).font(.footnote).foregroundStyle(.secondary)
                                .padding(.horizontal, 12).padding(.vertical, 5)
                                .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 6))
                        }
                    }
                }

                HStack(spacing: 12) {
                    Button(action: shareDream) {
                        Label(lang.t("share"), systemImage: "square.and.arrow.up")
                    }
                    .buttonStyle(.bordered)

                    Button(role: .destructive, action: performDelete) {
                        Label(lang.t("delete"), systemImage: "trash")
                    }
                    .buttonStyle(.bordered).tint(.red)
                }
                .padding(.top, 8)
            }
            .padding()
        }
        .navigationTitle(lang.t("detail_nav"))
        .navigationBarTitleDisplayMode(.inline)
        .background(Color(red: 0.016, green: 0.031, blue: 0.059))
        .overlay(alignment: .bottom) {
            if showUndo {
                Button {
                    if let backup = undoBackup { store.addDream(backup) }
                    showUndo = false
                } label: {
                    Text(lang.t("toast_undo"))
                        .font(.footnote)
                        .padding(.horizontal, 20).padding(.vertical, 11)
                        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 10))
                }
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
    }

    private var imagePlaceholder: some View {
        RoundedRectangle(cornerRadius: 16)
            .fill(Color(red: 0.11, green: 0.11, blue: 0.12))
            .aspectRatio(3.0/4.0, contentMode: .fill)
            .overlay(Text(dream.emotionSymbol).font(.system(size: 40)).opacity(0.15))
    }

    private func shareDream() {
        let text = [dream.title, dream.narrative].compactMap { $0 }.joined(separator: "\n\n")
        let activityVC = UIActivityViewController(activityItems: [text], applicationActivities: nil)
        if let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
           let root = scene.windows.first?.rootViewController {
            root.present(activityVC, animated: true)
        }
    }

    private func performDelete() {
        undoBackup = dream
        withAnimation {
            store.deleteDream(dream)
            dismiss()
        }
        showUndo = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 4) {
            showUndo = false
        }
    }
}
