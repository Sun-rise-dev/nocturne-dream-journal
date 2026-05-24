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

async function shareDream(id) {
  const dream = findDream(id);
  if (!dream) return;

  const narrative = dream.narrative?.slice(0, 300) || dream.rawText?.slice(0, 300) || '';
  const emotion = dream.emotion || 'wonder';

  // Try API first
  const result = await apiShareBroadcast(narrative, emotion);
  if (result.success) {
    showToast(t('toast_shared'));
    return;
  }

  // Fallback to localStorage
  try {
    let broadcast = JSON.parse(localStorage.getItem('nocturne-broadcast') || '[]');
    broadcast.unshift({
      id: 'b_' + Date.now(),
      narrative, emotion,
      date: new Date().toISOString(),
      reactions: {},
    });
    localStorage.setItem('nocturne-broadcast', JSON.stringify(broadcast));
    showToast(t('toast_shared'));
  } catch (e) { showToast('分享失败'); }
}

async function loadBroadcast() {
  const result = await apiGetBroadcasts();
  if (result.success) {
    return { broadcasts: result.broadcasts, online: true };
  }
  // Fallback to localStorage
  try {
    return { broadcasts: JSON.parse(localStorage.getItem('nocturne-broadcast') || '[]'), online: false };
  } catch { return { broadcasts: [], online: false }; }
}

async function reactToDream(broadcastId, emoji) {
  // Try API first
  const result = await apiReactBroadcast(broadcastId, emoji);
  if (result.success) return;

  // Fallback to localStorage
  try {
    let broadcast = JSON.parse(localStorage.getItem('nocturne-broadcast') || '[]');
    const item = broadcast.find(b => b.id === broadcastId);
    if (item) {
      item.reactions[emoji] = (item.reactions[emoji] || 0) + 1;
      localStorage.setItem('nocturne-broadcast', JSON.stringify(broadcast));
    }
  } catch {}
}
