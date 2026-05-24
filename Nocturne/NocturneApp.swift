import SwiftUI

@main
struct NocturneApp: App {
    @State private var showSplash = true
    @State private var dreamStore = DreamStore()
    @State private var language = LanguageManager()

    var body: some Scene {
        WindowGroup {
            ZStack {
                ContentView()
                    .environment(dreamStore)
                    .environment(language)
                    .opacity(showSplash ? 0 : 1)
                    .animation(.easeInOut(duration: 0.4), value: showSplash)

                if showSplash {
                    SplashView(isPresented: $showSplash)
                        .transition(.opacity)
                }
            }
            .preferredColorScheme(.dark)
        }
    }
}
