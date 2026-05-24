import Foundation
import SwiftUI

@Observable
final class DreamStore {
    var dreams: [Dream] = []
    var isLoading = false

    private let saveKey = "nocturne-dreams"

    init() { loadFromDisk() }

    // MARK: - CRUD

    func addDream(_ dream: Dream) {
        dreams.insert(dream, at: 0)
        saveToDisk()
    }

    func updateDream(_ dream: Dream) {
        if let idx = dreams.firstIndex(where: { $0.id == dream.id }) {
            dreams[idx] = dream
            saveToDisk()
        }
    }

    func deleteDream(_ dream: Dream) {
        dreams.removeAll { $0.id == dream.id }
        saveToDisk()
    }

    func findDream(id: String) -> Dream? {
        dreams.first { $0.id == id }
    }

    // MARK: - Statistics

    var totalDreams: Int { dreams.count }

    var emotionStats: [(key: String, count: Int)] {
        var dict: [String: Int] = [:]
        for d in dreams { dict[d.emotion, default: 0] += 1 }
        return dict.sorted { $0.value > $1.value }
    }

    var topKeywords: [(word: String, count: Int)] {
        var dict: [String: Int] = [:]
        for d in dreams { for k in d.keywords { dict[k, default: 0] += 1 } }
        return dict.sorted { $0.value > $1.value }
    }

    // MARK: - Persistence

    private var saveURL: URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("\(saveKey).json")
    }

    private func saveToDisk() {
        guard let data = try? JSONEncoder().encode(dreams) else { return }
        try? data.write(to: saveURL)
    }

    private func loadFromDisk() {
        guard let data = try? Data(contentsOf: saveURL),
              let saved = try? JSONDecoder().decode([Dream].self, from: data)
        else { return }
        dreams = saved
    }
}
