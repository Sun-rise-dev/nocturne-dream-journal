import SwiftUI

struct SplashView: View {
    @Binding var isPresented: Bool
    @Environment(LanguageManager.self) private var lang
    @State private var phase: SplashPhase = .appear

    var body: some View {
        ZStack {
            Color(red: 0.016, green: 0.031, blue: 0.059) // #04080F abyss
                .ignoresSafeArea()

            VStack(spacing: 14) {
                // Moon with ripple rings
                ZStack {
                    ForEach(0..<2) { i in
                        Circle()
                            .stroke(Color(red: 0.78, green: 0.75, blue: 0.66).opacity(0.06), lineWidth: 1)
                            .frame(width: 90, height: 90)
                            .scaleEffect(phase == .appear ? 0.9 : 1.15)
                            .opacity(phase == .appear ? 0.4 : 0)
                            .animation(.easeOut(duration: 3).delay(Double(i) * 0.6).repeatForever(autoreverses: false), value: phase)
                    }

                    Circle()
                        .fill(
                            RadialGradient(
                                colors: [
                                    Color(red: 0.78, green: 0.75, blue: 0.66).opacity(0.25),
                                    .clear
                                ],
                                center: .topTrailing,
                                startRadius: 6,
                                endRadius: 50
                            )
                        )
                        .frame(width: 90, height: 90)
                        .overlay {
                            Circle()
                                .fill(Color(red: 0.78, green: 0.75, blue: 0.66).opacity(0.55))
                                .frame(width: 18, height: 18)
                                .blur(radius: 0.5)
                                .shadow(color: Color(red: 0.78, green: 0.75, blue: 0.66).opacity(0.2), radius: 30)
                        }
                        .scaleEffect(phase == .appear ? 0.85 : 1)
                        .offset(y: phase == .appear ? 20 : 0)
                        .opacity(phase == .appear ? 0 : 1)
                        .animation(.easeOut(duration: 0.9), value: phase)
                }

                Text("Nocturne")
                    .font(.custom("Georgia", size: 38).italic())
                    .foregroundStyle(Color(red: 0.86, green: 0.84, blue: 0.8))
                    .kerning(6)
                    .shadow(color: Color(red: 0.78, green: 0.75, blue: 0.66).opacity(0.08), radius: 60, x: 0, y: 0)
                    .opacity(phase == .appear ? 0 : 1)
                    .offset(y: phase == .appear ? 10 : 0)

                Text(lang.t("tagline"))
                    .font(.system(size: 12))
                    .foregroundStyle(.white.opacity(0.3))
                    .kerning(5)
                    .textCase(.uppercase)
                    .opacity(phase == .appear ? 0 : 1)
                    .offset(y: phase == .appear ? 10 : 0)
            }
        }
        .onAppear {
            withAnimation(.easeOut(duration: 0.8).delay(0.3)) { phase = .title }
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.8) {
                withAnimation(.easeInOut(duration: 0.8)) { isPresented = false }
            }
        }
    }

    enum SplashPhase { case appear, title }
}
