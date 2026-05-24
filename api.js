/**
 * Nocturne · API 调用封装
 * 后端地址见 backend/server.py，开发时默认 localhost:12450
 */

const API_BASE = (() => {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:12450/api';
  }
  return '/api';
})();

function authHeaders() {
  const token = localStorage.getItem('nocturne-token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

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

// ═══════════════════════ Auth ═══════════════════════

async function apiRegister(username, password) {
  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    return await res.json();
  } catch { return { success: false, error: 'Network error' }; }
}

async function apiLogin(username, password) {
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    return await res.json();
  } catch { return { success: false, error: 'Network error' }; }
}

async function apiGetProfile() {
  try {
    const res = await fetch(`${API_BASE}/auth/me`, { headers: authHeaders() });
    return await res.json();
  } catch { return { success: false }; }
}

async function apiUpdateProfile(nickname, bio) {
  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ nickname, bio }),
    });
    return await res.json();
  } catch { return { success: false }; }
}

async function apiLogout() {
  try {
    await fetch(`${API_BASE}/auth/logout`, { method: 'POST', headers: authHeaders() });
  } catch {}
  localStorage.removeItem('nocturne-token');
  localStorage.removeItem('nocturne-user');
}

function isLoggedIn() { return !!localStorage.getItem('nocturne-token'); }
function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem('nocturne-user')); } catch { return null; }
}
