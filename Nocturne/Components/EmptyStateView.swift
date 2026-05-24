import SwiftUI

struct EmptyStateView: View {
    @Environment(LanguageManager.self) private var lang

    var body: some View {
        VStack(spacing: 20) {
            Spacer().frame(height: 20)

            Image(systemName: "moon.stars")
                .font(.system(size: 36))
                .foregroundStyle(Color(red: 0.54, green: 0.62, blue: 0.69))
                .padding(24)
                .background(
                    Color(red: 0.54, green: 0.62, blue: 0.69).opacity(0.1),
                    in: RoundedRectangle(cornerRadius: 18)
                )

            VStack(spacing: 6) {
                Text(lang.t("empty_title"))
                    .font(.title3).fontWeight(.semibold)
                Text(lang.t("empty_hint"))
                    .font(.subheadline).foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }

            NavigationLink {
                RecordView()
            } label: {
                Text(lang.t("empty_btn"))
                    .font(.subheadline).fontWeight(.semibold)
                    .padding(.horizontal, 24).padding(.vertical, 12)
                    .background(Color(red: 0.54, green: 0.62, blue: 0.69), in: RoundedRectangle(cornerRadius: 8))
                    .foregroundStyle(.black)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
    }
}
