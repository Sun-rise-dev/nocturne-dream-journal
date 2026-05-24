/**
 * Nocturne · 数据管理 — localStorage 持久化
 */

const STORAGE_KEY = 'nocturne-dreams';

function loadDreams() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveDreams(dreams) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dreams));
  } catch (e) { console.error('保存失败', e); }
}

function findDream(id) {
  return loadDreams().find(d => d.id === id);
}

function addDream(dream) {
  const dreams = loadDreams();
  dream.id = dream.id || 'dream_' + Date.now();
  dream.date = dream.date || new Date().toISOString();
  dreams.unshift(dream);
  saveDreams(dreams);
  return dream;
}

function updateDream(id, updates) {
  const dreams = loadDreams();
  const idx = dreams.findIndex(d => d.id === id);
  if (idx === -1) return null;
  dreams[idx] = { ...dreams[idx], ...updates };
  saveDreams(dreams);
  return dreams[idx];
}

function deleteDream(id) {
  const dreams = loadDreams().filter(d => d.id !== id);
  saveDreams(dreams);
  showToast(t('toast_deleted'));
  routeTo('timeline');
}

function getDreamStats() {
  const dreams = loadDreams();
  const stats = { total: dreams.length, emotions: {}, keywords: {}, byDate: {} };
  dreams.forEach(d => {
    stats.emotions[d.emotion] = (stats.emotions[d.emotion] || 0) + 1;
    d.keywords?.forEach(k => { stats.keywords[k] = (stats.keywords[k] || 0) + 1; });
    const dateKey = d.date?.slice(0, 7);
    if (dateKey) stats.byDate[dateKey] = (stats.byDate[dateKey] || 0) + 1;
  });
  return stats;
}

function shareDream(id) {
  const dream = findDream(id);
  if (!dream) return;

  // 保存到广播池
  try {
    let broadcast = JSON.parse(localStorage.getItem('nocturne-broadcast') || '[]');
    const shared = {
      id: 'b_' + Date.now(),
      dreamId: dream.id,
      date: new Date().toISOString(),
      narrative: dream.narrative?.slice(0, 120) || '',
      emotion: dream.emotion,
      keywords: dream.keywords,
      image: dream.image,
      reactions: {}
    };
    broadcast.unshift(shared);
    localStorage.setItem('nocturne-broadcast', JSON.stringify(broadcast));
    showToast('已匿名分享到广播频道');
  } catch (e) { showToast('分享失败'); }
}

function loadBroadcast() {
  try {
    return JSON.parse(localStorage.getItem('nocturne-broadcast') || '[]');
  } catch { return []; }
}

function reactToDream(broadcastId, emoji) {
  try {
    let broadcast = JSON.parse(localStorage.getItem('nocturne-broadcast') || '[]');
    const item = broadcast.find(b => b.id === broadcastId);
    if (item) {
      item.reactions[emoji] = (item.reactions[emoji] || 0) + 1;
      localStorage.setItem('nocturne-broadcast', JSON.stringify(broadcast));
    }
  } catch {}
}
