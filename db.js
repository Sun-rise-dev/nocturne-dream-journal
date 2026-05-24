/**
 * Nocturne · IndexedDB 数据层
 * 替代 localStorage — iOS 不会清理 IndexedDB，数据更安全
 */

const DB_NAME = 'nocturne-db';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('dreams')) {
        db.createObjectStore('dreams', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idb(storeName) {
  return {
    async getAll() {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const req = tx.objectStore(storeName).getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    },
    async get(key) {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const req = tx.objectStore(storeName).get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    },
    async put(item) {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const req = tx.objectStore(storeName).put(item);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    },
    async delete(key) {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const req = tx.objectStore(storeName).delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    },
    async clear() {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const req = tx.objectStore(storeName).clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    },
  };
}

// ═══════════════════════ Migration from localStorage ═══════════════════════

const _migrated = {};

async function migrateIfNeeded() {
  if (_migrated.done) return;
  try {
    const old = localStorage.getItem('nocturne-dreams');
    if (old) {
      const dreams = JSON.parse(old);
      if (dreams.length > 0) {
        const store = idb('dreams');
        const existing = await store.getAll();
        const existingIds = new Set(existing.map(d => d.id));
        let migrated = 0;
        for (const d of dreams) {
          if (!existingIds.has(d.id)) {
            await store.put(d);
            migrated++;
          }
        }
        if (migrated > 0) {
          localStorage.removeItem('nocturne-dreams');
          console.log(`Migrated ${migrated} dreams to IndexedDB`);
        }
      }
    }
    // Migrate broadcast
    const oldBroadcast = localStorage.getItem('nocturne-broadcast');
    if (oldBroadcast) {
      const broadcasts = JSON.parse(oldBroadcast);
      if (broadcasts.length > 0) {
        await idb('settings').put({ key: 'broadcast', value: broadcasts });
        localStorage.removeItem('nocturne-broadcast');
      }
    }
  } catch (e) { console.warn('Migration skipped:', e.message); }
  _migrated.done = true;
}

// ═══════════════════════ Dream CRUD (async) ═══════════════════════

const store = idb('dreams');

async function loadDreams() {
  await migrateIfNeeded();
  const dreams = await store.getAll();
  return dreams.sort((a, b) => new Date(b.date) - new Date(a.date));
}

async function saveDream(dream) {
  await store.put(dream);
}

async function saveDreams(dreams) {
  const store_ = idb('dreams');
  await store_.clear();
  for (const d of dreams) await store_.put(d);
}

async function findDream(id) {
  return store.get(id);
}

async function addDream(dream) {
  dream.id = dream.id || 'dream_' + Date.now();
  dream.date = dream.date || new Date().toISOString();
  await store.put(dream);
  return dream;
}

async function deleteDreamFromDB(id) {
  await store.delete(id);
}

// ═══════════════════════ Broadcast (hybrid: API-first, IndexedDB fallback) ═══════════════════════

async function loadBroadcast() {
  const result = await apiGetBroadcasts();
  if (result.success) {
    return { broadcasts: result.broadcasts, online: true };
  }
  const saved = await idb('settings').get('broadcast');
  return { broadcasts: saved?.value || [], online: false };
}

async function saveBroadcastLocally(broadcasts) {
  await idb('settings').put({ key: 'broadcast', value: broadcasts });
}

// ═══════════════════════ Image Compression ═══════════════════════

function compressImage(dataUrl, maxWidth, quality = 0.6) {
  return new Promise((resolve) => {
    if (!dataUrl || !dataUrl.startsWith('data:image')) {
      return resolve(dataUrl);
    }
    const img = new Image();
    img.onload = () => {
      const w = Math.min(img.width, maxWidth);
      const h = Math.round(img.height * (w / img.width));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

async function compressAndStoreImage(dreamId, dataUrl) {
  const thumb = await compressImage(dataUrl, 200, 0.5);
  const full = await compressImage(dataUrl, 600, 0.65);
  const dream = await findDream(dreamId);
  if (dream) {
    dream.image = full;
    dream.thumb = thumb;
    await saveDream(dream);
  }
  return { image: full, thumb };
}

// ═══════════════════════ Export / Import ═══════════════════════

async function exportDreamsJSON() {
  const dreams = await loadDreams();
  return JSON.stringify(dreams, null, 2);
}

async function importDreamsJSON(jsonStr) {
  let incoming;
  try { incoming = JSON.parse(jsonStr); } catch { throw new Error('Invalid JSON'); }
  if (!Array.isArray(incoming)) throw new Error('Expected array of dreams');

  const existing = await loadDreams();
  const existingIds = new Set(existing.map(d => d.id));
  let imported = 0;
  for (const d of incoming) {
    if (!d.id || !d.date) continue;
    if (!existingIds.has(d.id)) {
      await saveDream(d);
      imported++;
    }
  }
  return imported;
}
