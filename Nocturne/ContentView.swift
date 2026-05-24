import SwiftUI

struct ContentView: View {
    @Environment(DreamStore.self) private var store
    @Environment(LanguageManager.self) private var lang
    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            NavigationStack {
                TimelineView()
            }
            .tabItem {
                Image(systemName: selectedTab == 0 ? "moon.stars.fill" : "moon.stars")
                Text(lang.t("tab_timeline"))
            }
            .tag(0)

            NavigationStack {
                RecordView()
            }
            .tabItem {
                Image(systemName: "mic.circle.fill")
                    .environment(\.symbolVariants, .none)
                Text(lang.t("tab_record"))
            }
            .tag(1)

            NavigationStack {
                BroadcastView()
            }
            .tabItem {
                Image(systemName: selectedTab == 2 ? "globe.americas.fill" : "globe.americas")
                Text(lang.t("tab_broadcast"))
            }
            .tag(2)
        }
        .tint(Color(red: 0.54, green: 0.62, blue: 0.69)) // accent blue-gray
    }
}
