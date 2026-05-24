/**
 * Nocturne · API 调用封装
 * 后端地址见 backend/server.py，开发时默认 localhost:12450
 */

const API_BASE = 'http://localhost:12450/api';

async function apiProcessDream(rawText) {
  try {
    const res = await fetch(`${API_BASE}/dreams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: rawText }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    return { success: false, error: `无法连接梦境服务：${e.message}` };
  }
}

async function apiGetDreams() {
  try {
    const res = await fetch(`${API_BASE}/dreams`);
    return await res.json();
  } catch {
    return { success: false, dreams: [] };
  }
}

async function apiShareBroadcast(narrative, emotion) {
  try {
    const res = await fetch(`${API_BASE}/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ narrative, emotion }),
    });
    return await res.json();
  } catch {
    return { success: false };
  }
}

async function apiGetBroadcasts() {
  try {
    const res = await fetch(`${API_BASE}/broadcast`);
    return await res.json();
  } catch {
    return { success: false, broadcasts: [] };
  }
}

async function apiReactBroadcast(broadcastId, emoji) {
  try {
    const res = await fetch(`${API_BASE}/broadcast/${broadcastId}/react`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji }),
    });
    return await res.json();
  } catch {
    return { success: false };
  }
}
