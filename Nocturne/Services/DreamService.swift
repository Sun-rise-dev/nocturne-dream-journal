import Foundation

struct DreamAPIResponse: Codable {
    var success: Bool
    var narrative: String?
    var emotion: String?
    var keywords: [String]?
    var imageURL: URL?
    var title: String?
    var error: String?

    enum CodingKeys: String, CodingKey {
        case success, narrative, emotion, keywords, title, error
        case imageURL = "image_url"
    }
}

final class DreamService {
    static let shared = DreamService()
    private let baseURL = "http://localhost:12450/api"

    private init() {}

    func processDream(text: String) async -> DreamAPIResponse {
        guard let url = URL(string: "\(baseURL)/dreams") else {
            return localFallback(text: text)
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 60

        do {
            let body = try JSONEncoder().encode(["text": text])
            request.httpBody = body
            let (data, _) = try await URLSession.shared.data(for: request)
            let response = try JSONDecoder().decode(DreamAPIResponse.self, from: data)
            if response.success { return response }
        } catch {
            // Fall through to local fallback
        }

        return localFallback(text: text)
    }

    private func localFallback(text: String) -> DreamAPIResponse {
        let keywords = extractKeywords(text)
        return DreamAPIResponse(
            success: true,
            narrative: text,
            emotion: "wonder",
            keywords: keywords,
            imageURL: nil,
            title: String(text.prefix(28)),
            error: nil
        )
    }

    private let stopWords: Set<String> = [
        "的","了","是","我","在","有","和","就","不","人","都","一","个",
        "上","也","很","到","说","要","去","你","会","着","没有","看",
        "好","自己","这","那","什么","好像","感觉","觉得",
        "the","a","an","is","was","in","on","at","to","of","and",
        "it","that","this","my","me","I"
    ]

    private func extractKeywords(_ text: String) -> [String] {
        let words = text.components(separatedBy: CharacterSet(charactersIn: " ,.?!，。！？、\n"))
        return words
            .filter { $0.count > 1 && !stopWords.contains($0.lowercased()) }
            .prefix(8)
            .map { $0 }
    }
}
