import Foundation
import SwiftUI

@Observable
final class LanguageManager {
    var currentLang: String {
        didSet { UserDefaults.standard.set(currentLang, forKey: "nocturne-lang") }
    }

    init() {
        currentLang = UserDefaults.standard.string(forKey: "nocturne-lang") ?? "zh"
    }

    var isChinese: Bool { currentLang == "zh" }

    func toggle() {
        currentLang = isChinese ? "en" : "zh"
    }

    // MARK: - String lookup

    func t(_ key: String, _ args: CVarArg...) -> String {
        let dict = isChinese ? zhDict : enDict
        var str = dict[key] ?? zhDict[key] ?? key
        for arg in args { str = str.replacingFirst(of: "?", with: "\(arg)") }
        return str
    }

    private let zhDict: [String: String] = [
        "tab_timeline": "时间线", "tab_record": "记录", "tab_broadcast": "广播",
        "timeline_subtitle": "每一次沉睡，都是一场旅行",
        "empty_title": "还没有记录过梦境", "empty_hint": "点击下方按钮，记录你的第一场梦",
        "empty_btn": "开始记录",
        "stat_dreams": "梦境", "stat_symbols": "意象", "stat_mood": "情绪",
        "record_idle": "轻声说出你的梦...", "record_listen": "正在聆听...",
        "record_still": "还在吗？", "record_done": "录制完成",
        "re_record": "重新记录", "weave": "编织梦境", "weaving": "正在编织你的梦境...",
        "detail_nav": "梦境", "share": "分享", "delete": "删除", "back": "返回",
        "broadcast_title": "梦境广播", "broadcast_subtitle": "匿名分享 — 只有梦本身被看见",
        "broadcast_empty": "还没有人分享梦境",
        "insights_title": "梦境分析", "insights_subtitle": "已记录 ? 个梦境",
        "insights_emotions": "情绪景观", "insights_symbols": "重复出现的意象",
        "toast_saved": "梦境已记录 ✦", "toast_saved_offline": "梦境已记录（离线）",
        "toast_empty": "请先录入梦境内容", "toast_deleted": "已删除",
        "toast_undo": "已删除 · 点击撤销", "toast_restored": "已恢复",
        "weave_1": "正在聆听...", "weave_2": "梳理碎片...",
        "weave_3": "编织叙事...", "weave_4": "即将完成...",
        "tagline": "梦如繁星",
        "section_today": "今天", "section_yesterday": "昨天",
    ]

    private let enDict: [String: String] = [
        "tab_timeline": "Timeline", "tab_record": "Record", "tab_broadcast": "Broadcast",
        "timeline_subtitle": "Every sleep is a journey",
        "empty_title": "No Dreams Yet", "empty_hint": "Tap the button to capture your first dream",
        "empty_btn": "Record a Dream",
        "stat_dreams": "Dreams", "stat_symbols": "Symbols", "stat_mood": "Mood",
        "record_idle": "Speak your dream...", "record_listen": "Listening...",
        "record_still": "Still there?", "record_done": "Recording finished",
        "re_record": "Re-record", "weave": "Weave Dream", "weaving": "Weaving your dream...",
        "detail_nav": "Dream", "share": "Share", "delete": "Delete", "back": "Back",
        "broadcast_title": "Dream Broadcast", "broadcast_subtitle": "Anonymous — only the dream is visible",
        "broadcast_empty": "No dreams shared yet",
        "insights_title": "Dream Insights", "insights_subtitle": "? dreams recorded",
        "insights_emotions": "EMOTIONAL LANDSCAPE", "insights_symbols": "RECURRING SYMBOLS",
        "toast_saved": "Dream saved ✦", "toast_saved_offline": "Saved (offline)",
        "toast_empty": "Nothing recorded", "toast_deleted": "Deleted",
        "toast_undo": "Deleted · Tap to undo", "toast_restored": "Restored",
        "weave_1": "Listening...", "weave_2": "Gathering fragments...",
        "weave_3": "Weaving narrative...", "weave_4": "Almost there...",
        "tagline": "dreams, like stars",
        "section_today": "Today", "section_yesterday": "Yesterday",
    ]
}

private extension String {
    func replacingFirst(of target: String, with replacement: String) -> String {
        guard let range = self.range(of: target) else { return self }
        return self.replacingCharacters(in: range, with: replacement)
    }
}
