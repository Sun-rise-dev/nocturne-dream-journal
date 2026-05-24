/**
 * Nocturne · i18n — 中/English bilingual
 */
const I18N = {
  zh: {
    tab_timeline: '时间线',
    tab_record: '记录',
    tab_broadcast: '广播',

    timeline_title: '梦境时间线',
    timeline_subtitle: '每一次沉睡，都是一场旅行',
    empty_title: '还没有记录过梦境',
    empty_hint: '点击下方按钮，记录你的第一场梦',
    empty_btn: '开始记录',
    stat_dreams: '梦境',
    stat_symbols: '意象',
    stat_mood: '情绪',

    record_status_idle: '轻声说出你的梦...',
    record_status_listen: '正在聆听...',
    record_status_still: '还在吗？',
    record_status_done: '录制完成',
    record_re_record: '重新记录',
    record_weave: '编织梦境',
    record_weaving: '正在编织你的梦境...',

    detail_nav: '梦境',
    detail_share: '分享',
    detail_delete: '删除',
    detail_back: '返回',

    broadcast_title: '梦境广播',
    broadcast_subtitle: '匿名分享 — 只有梦本身被看见',
    broadcast_empty: '还没有人分享梦境',
    broadcast_offline: '无法连接，请检查网络',

    insights_title: '梦境分析',
    insights_subtitle: '已记录 ? 个梦境',
    insights_emotions: '情绪景观',
    insights_symbols: '重复出现的意象',

    toast_saved: '梦境已记录 ✦',
    toast_saved_no_image: '梦境已记录，插图生成失败',
    toast_saved_offline: '梦境已记录（离线）',
    toast_deleted: '梦境已删除',
    toast_shared: '已匿名分享到广播',
    toast_nothing: '请先录入梦境内容',
    toast_not_found: '梦境不存在',
    toast_copied: '已复制到剪贴板',

    tagline: '梦如繁星',

    lang_switch: 'EN',

    section_today: '今天',
    section_yesterday: '昨天',
  },

  en: {
    tab_timeline: 'Timeline',
    tab_record: 'Record',
    tab_broadcast: 'Broadcast',

    timeline_title: 'Dream Timeline',
    timeline_subtitle: 'Every sleep is a journey',
    empty_title: 'No Dreams Yet',
    empty_hint: 'Tap the button to capture your first dream',
    empty_btn: 'Record a Dream',
    stat_dreams: 'Dreams',
    stat_symbols: 'Symbols',
    stat_mood: 'Mood',

    record_status_idle: 'Speak your dream...',
    record_status_listen: 'Listening...',
    record_status_still: 'Still there?',
    record_status_done: 'Recording finished',
    record_re_record: 'Re-record',
    record_weave: 'Weave Dream',
    record_weaving: 'Weaving your dream...',

    detail_nav: 'Dream',
    detail_share: 'Share',
    detail_delete: 'Delete',
    detail_back: 'Back',

    broadcast_title: 'Dream Broadcast',
    broadcast_subtitle: 'Anonymous — only the dream is visible',
    broadcast_empty: 'No dreams shared yet',
    broadcast_offline: 'Cannot connect. Check your network.',

    insights_title: 'Dream Insights',
    insights_subtitle: '? dreams recorded',
    insights_emotions: 'EMOTIONAL LANDSCAPE',
    insights_symbols: 'RECURRING SYMBOLS',

    toast_saved: 'Dream saved ✦',
    toast_saved_no_image: 'Dream saved, image failed',
    toast_saved_offline: 'Saved (offline)',
    toast_deleted: 'Dream deleted',
    toast_shared: 'Shared anonymously',
    toast_nothing: 'Nothing recorded',
    toast_not_found: 'Dream not found',
    toast_copied: 'Copied to clipboard',

    tagline: 'dreams, like stars',

    lang_switch: '中',

    section_today: 'Today',
    section_yesterday: 'Yesterday',
  }
};

let currentLang;
try { currentLang = localStorage.getItem('nocturne-lang') || 'zh'; } catch { currentLang = 'zh'; }

function t(key, ...args) {
  let str = I18N[currentLang]?.[key] || I18N.zh[key] || key;
  for (const arg of args) str = str.replace('?', arg);
  return str;
}

function toggleLang() {
  currentLang = currentLang === 'zh' ? 'en' : 'zh';
  document.documentElement.lang = currentLang === 'zh' ? 'zh-CN' : 'en';
  try { localStorage.setItem('nocturne-lang', currentLang); } catch {}
  const tagEl = document.getElementById('splashTagline');
  if (tagEl) tagEl.textContent = t('tagline');
  routeTo(APP.currentRoute === 'detail' || APP.currentRoute === 'stats' ? 'timeline' : APP.currentRoute);
}
