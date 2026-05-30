import SwiftUI

struct RecordView: View {
    @Environment(DreamStore.self) private var store
    @Environment(LanguageManager.self) private var lang
    @State private var recorder = DreamRecorder()
    @State private var isProcessing = false
    @State private var processingPhase = 0
    @State private var dotScales: [CGFloat] = [1.0, 1.0, 1.0]
    @State private var weaveTimer: Timer?
    private let phases = ["weave_1", "weave_2", "weave_3", "weave_4"]

    var body: some View {
        VStack(spacing: 0) {
            Spacer()

            Text(recorder.isRecording
                 ? (recorder.statusText.isEmpty ? lang.t("record_listen") : recorder.statusText)
                 : (recorder.transcript.isEmpty ? lang.t("record_idle") : lang.t("record_done")))
                .font(.headline).foregroundStyle(.secondary)
                .animation(.easeInOut(duration: 0.3), value: recorder.isRecording)

            Spacer().frame(height: 44)

            // Record button with ripple rings
            ZStack {
                if recorder.isRecording {
                    ForEach(0..<3) { i in
                        Circle()
                            .stroke(Color(red: 0.78, green: 0.75, blue: 0.66).opacity(0.12), lineWidth: 1)
                            .frame(width: 120, height: 120)
                            .scaleEffect(1 + CGFloat(i) * 0.2)
                            .opacity(0)
                            .animation(
                                .easeOut(duration: 2).delay(Double(i) * 0.6).repeatForever(autoreverses: false),
                                value: recorder.isRecording
                            )
                    }
                }

                Button {
                    let impact = UIImpactFeedbackGenerator(style: .heavy)
                    impact.impactOccurred()
                    recorder.toggle()
                } label: {
                    Circle()
                        .stroke(recorder.isRecording
                            ? Color(red: 0.78, green: 0.75, blue: 0.66).opacity(0.15)
                            : .white.opacity(0.06), lineWidth: 1.5)
                        .frame(width: 120, height: 120)
                        .background(
                            Circle()
                                .fill(recorder.isRecording
                                    ? Color(red: 0.78, green: 0.75, blue: 0.66).opacity(0.05)
                                    : .clear)
                        )
                        .overlay {
                            RoundedRectangle(cornerRadius: recorder.isRecording ? 6 : 26)
                                .fill(recorder.isRecording
                                    ? Color(red: 0.78, green: 0.75, blue: 0.66).opacity(0.3)
                                    : Color(red: 0.78, green: 0.75, blue: 0.66).opacity(0.1))
                                .frame(
                                    width: recorder.isRecording ? 32 : 52,
                                    height: recorder.isRecording ? 32 : 52
                                )
                                .animation(.spring(response: 0.4, dampingFraction: 0.6), value: recorder.isRecording)
                        }
                }
                .buttonStyle(.plain)
            }
            .frame(width: 140, height: 140)

            Spacer().frame(height: 16)

            Text(formatTime(recorder.elapsed))
                .font(.callout).foregroundStyle(.tertiary).fontDesign(.monospaced)

            Spacer().frame(height: 24)

            if !recorder.transcript.isEmpty || recorder.isRecording {
                ScrollView {
                    Text(recorder.transcript)
                        .font(.subheadline)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding()
                }
                .frame(maxHeight: 120)
                .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 14))
                .padding(.horizontal, 24)
            }

            if !recorder.isRecording && !recorder.transcript.isEmpty {
                HStack(spacing: 12) {
                    Button(lang.t("re_record")) { recorder.reset() }
                        .buttonStyle(.bordered).tint(.secondary)
                    Button {
                        startProcessing()
                    } label: {
                        HStack {
                            if isProcessing { ProgressView().tint(.black) }
                            Text(lang.t("weave"))
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(Color(red: 0.78, green: 0.75, blue: 0.66))
                    .disabled(isProcessing)
                }
                .padding(.top, 20).transition(.opacity)
            }

            if isProcessing {
                HStack(spacing: 12) {
                    ForEach(0..<3) { i in
                        Circle()
                            .fill(Color(red: 0.78, green: 0.75, blue: 0.66).opacity(0.5))
                            .frame(width: 4, height: 4)
                            .scaleEffect(dotScales[i])
                    }
                }
                .padding(.top, 24)
                Text(lang.t(phases[processingPhase]))
                    .font(.subheadline).foregroundStyle(.secondary)
            }

            Spacer()
        }
        .navigationTitle(lang.t("tab_record"))
        .navigationBarTitleDisplayMode(.inline)
        .onChange(of: isProcessing) { _, newValue in
            if newValue {
                for i in 0..<3 {
                    withAnimation(.easeInOut(duration: 0.8).repeatForever(autoreverses: true).delay(Double(i) * 0.3)) {
                        dotScales[i] = 1.8
                    }
                }
            } else {
                for i in 0..<3 { dotScales[i] = 1.0 }
            }
        }
        .onDisappear {
            weaveTimer?.invalidate()
            isProcessing = false
        }
    }

    private func startProcessing() {
        isProcessing = true
        processingPhase = 0
        weaveTimer = Timer.scheduledTimer(withTimeInterval: 1.2, repeats: true) { [weak self] timer in
            guard let self else { timer.invalidate(); return }
            processingPhase = (processingPhase + 1) % phases.count
            if !isProcessing { timer.invalidate() }
        }
        Task {
            let response = await DreamService.shared.processDream(text: recorder.transcript)
            let dream = Dream(
                rawText: recorder.transcript,
                narrative: response.narrative,
                title: response.title,
                emotion: response.emotion ?? "wonder",
                keywords: response.keywords ?? [],
                imageURL: response.imageURL
            )
            store.addDream(dream)
            recorder.reset()
            isProcessing = false
        }
    }

    private func formatTime(_ t: TimeInterval) -> String {
        String(format: "%02d:%02d", Int(t) / 60, Int(t) % 60)
    }
}
