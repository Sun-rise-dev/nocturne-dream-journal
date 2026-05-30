import Foundation

struct Dream: Identifiable, Codable, Equatable, Hashable {
    var id: String = UUID().uuidString
    var rawText: String = ""
    var narrative: String?
    var title: String?
    var emotion: String = "wonder"
    var keywords: [String] = []
    var imageURL: URL?
    var date: Date = Date()

    static let emotions: [(key: String, zh: String, en: String, symbol: String)] = [
        ("fear",    "恐惧",   "Fear",     "~"),
        ("joy",     "快乐",   "Joy",      "^"),
        ("calm",    "平静",   "Calm",     "."),
        ("anxiety", "焦虑",   "Anxiety",  "≈"),
        ("wonder",  "奇幻",   "Wonder",   "⁕"),
        ("sad",     "悲伤",   "Sadness",  "˅"),
        ("strange", "离奇",   "Strange",  "◌"),
    ]

    var emotionLabel: String {
        let lang = UserDefaults.standard.string(forKey: "nocturne-lang") ?? "zh"
        return Self.emotions.first { $0.key == emotion }.map { lang == "zh" ? $0.zh : $0.en } ?? emotion
    }

    var emotionSymbol: String {
        Self.emotions.first { $0.key == emotion }?.symbol ?? "·"
    }
}
