import SwiftUI

struct DreamCellView: View {
    let dream: Dream

    var body: some View {
        HStack(spacing: 14) {
            // Thumbnail
            Group {
                if let url = dream.imageURL {
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .success(let image):
                            image.resizable().aspectRatio(contentMode: .fill)
                        default:
                            placeholderContent
                        }
                    }
                } else {
                    placeholderContent
                }
            }
            .frame(width: 52, height: 52)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .background(Color(red: 0.11, green: 0.11, blue: 0.12))

            // Content
            VStack(alignment: .leading, spacing: 2) {
                Text(dream.narrative.map { String($0.prefix(50)) } ?? dream.rawText.map { String($0.prefix(50)) } ?? "···")
                    .font(.subheadline).fontWeight(.medium)
                    .lineLimit(1)
                HStack(spacing: 4) {
                    Text(dream.emotionLabel).font(.caption).foregroundStyle(.secondary)
                    if let first = dream.keywords.first {
                        Text("·").foregroundStyle(.tertiary)
                        Text(first).font(.caption).foregroundStyle(.tertiary)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            Image(systemName: "chevron.right")
                .font(.caption).foregroundStyle(.quaternary)
        }
        .padding(.vertical, 4)
    }

    private var placeholderContent: some View {
        Text(dream.emotionSymbol)
            .font(.caption).foregroundStyle(.tertiary)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
