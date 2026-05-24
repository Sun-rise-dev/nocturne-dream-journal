/**
 * Nocturne · 数据管理 — IndexedDB 持久化（兼容 localStorage 旧数据自动迁移）
 */

// ═══════════════════════ Stats (uses db.js async API) ═══════════════════════

async function getDreamStats() {
  const dreams = await loadDreams();
  const stats = { total: dreams.length, emotions: {}, keywords: {}, byDate: {} };
  dreams.forEach(d => {
    stats.emotions[d.emotion] = (stats.emotions[d.emotion] || 0) + 1;
    d.keywords?.forEach(k => { stats.keywords[k] = (stats.keywords[k] || 0) + 1; });
    const dateKey = d.date?.slice(0, 7);
    if (dateKey) stats.byDate[dateKey] = (stats.byDate[dateKey] || 0) + 1;
  });
  return stats;
}

// ═══════════════════════ Share to Broadcast ═══════════════════════

async function shareDream(id) {
  const dream = await findDream(id);
  if (!dream) return;

  const narrative = dream.narrative?.slice(0, 300) || dream.rawText?.slice(0, 300) || '';
  const emotion = dream.emotion || 'wonder';

  const result = await apiShareBroadcast(narrative, emotion);
  if (result.success) {
    showToast(t('toast_shared'));
    return;
  }

  // Fallback to local
  try {
    const saved = await idb('settings').get('broadcast');
    let broadcast = saved?.value || [];
    broadcast.unshift({
      id: 'b_' + Date.now(),
      narrative, emotion,
      date: new Date().toISOString(),
      reactions: {},
    });
    await saveBroadcastLocally(broadcast);
    showToast(t('toast_shared'));
  } catch (e) { showToast('Share failed'); }
}

// ═══════════════════════ React to Broadcast ═══════════════════════

async function reactToDreamDB(broadcastId, emoji) {
  const result = await apiReactBroadcast(broadcastId, emoji);
  if (result.success) return;

  // Fallback to local
  try {
    const saved = await idb('settings').get('broadcast');
    let broadcast = saved?.value || [];
    const item = broadcast.find(b => b.id === broadcastId);
    if (item) {
      item.reactions[emoji] = (item.reactions[emoji] || 0) + 1;
      await saveBroadcastLocally(broadcast);
    }
  } catch {}
}

// Compatibility alias — app.js calls reactToDream
async function reactToDream(broadcastId, emoji) {
  return reactToDreamDB(broadcastId, emoji);
}
