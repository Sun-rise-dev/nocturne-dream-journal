import Foundation
import Speech
import AVFoundation

@Observable
final class DreamRecorder: NSObject, SFSpeechRecognizerDelegate {
    var transcript = ""
    var isRecording = false
    var isAvailable = true
    var elapsed: TimeInterval = 0
    var statusText = ""

    private let supportedLocales: [String: String] = ["zh": "zh-CN", "en": "en-US"]
    private var recognizer: SFSpeechRecognizer? = SFSpeechRecognizer(locale: Locale(identifier: "zh-CN"))
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private let audioEngine = AVAudioEngine()
    private var timer: Timer?
    private var lastSpeech: Date = Date()

    override init() {
        super.init()
        recognizer?.delegate = self
        SFSpeechRecognizer.requestAuthorization { _ in }
    }

    // MARK: - SFSpeechRecognizerDelegate

    func speechRecognizer(_ speechRecognizer: SFSpeechRecognizer, availabilityDidChange available: Bool) {
        isAvailable = available
    }

    func updateLocale(_ lang: String) {
        let localeID = supportedLocales[lang] ?? "zh-CN"
        recognizer = SFSpeechRecognizer(locale: Locale(identifier: localeID))
        recognizer?.delegate = self
    }

    func toggle() {
        isRecording ? stop() : start()
    }

    func start() {
        transcript = ""
        elapsed = 0
        lastSpeech = Date()
        statusText = ""

        let audioSession = AVAudioSession.sharedInstance()
        try? audioSession.setCategory(.record, mode: .measurement, options: .duckOthers)
        try? audioSession.setActive(true)

        recognitionRequest = SFSpeechAudioBufferRecognitionRequest()
        guard let recognitionRequest = recognitionRequest else { return }
        recognitionRequest.shouldReportPartialResults = true

        let inputNode = audioEngine.inputNode
        let format = inputNode.outputFormat(forBus: 0)
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
            recognitionRequest.append(buffer)
        }

        audioEngine.prepare()
        try? audioEngine.start()

        recognitionTask = recognizer?.recognitionTask(with: recognitionRequest) { [weak self] result, error in
            guard let self = self else { return }
            if let result = result {
                self.transcript = result.bestTranscription.formattedString
                if result.isFinal { self.lastSpeech = Date() }
            }
            if error != nil {
                self.stop()
            }
        }

        isRecording = true

        // Timer
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            guard let self = self, self.isRecording else { return }
            self.elapsed += 1
            if Date().timeIntervalSince(self.lastSpeech) > 4 && !self.transcript.isEmpty {
                let lang = UserDefaults.standard.string(forKey: "nocturne-lang") ?? "zh"
                self.statusText = lang == "zh" ? "还在吗？" : "Still there?"
            }
            if self.elapsed >= 90 { self.stop() }
        }
    }

    func stop() {
        audioEngine.stop()
        audioEngine.inputNode.removeTap(onBus: 0)
        recognitionRequest?.endAudio()
        recognitionTask?.cancel()
        recognitionTask = nil
        recognitionRequest = nil
        timer?.invalidate()
        timer = nil
        isRecording = false

        let audioSession = AVAudioSession.sharedInstance()
        try? audioSession.setActive(false)
    }

    func reset() {
        transcript = ""
        elapsed = 0
        statusText = ""
    }
}
