/**
 * Nocturne · API 调用封装
 * 后端地址见 backend/server.py，开发时默认 localhost:12450
 */

const API_BASE = (() => {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:12450/api';
  }
  // Vercel backend — change this if you deploy elsewhere
  return 'https://nocturne-dream-journal.vercel.app/api';
})();

// ═══════════════════════ Client-side Image Generation ═══════════════════════
// Bypasses blocked Vercel — calls shiyunapi.com directly from browser

const IMAGE_API = 'https://shiyunapi.com/v1/chat/completions';
const IMAGE_KEY = 'sk-UCeUxIpayCYEiuzpviPEay8dkMy2bsG15Ww6hHlJ1gIbnHUx';
const IMAGE_MODEL = 'gemini-3.1-flash-image-preview';

const EMOTION_MOODS = {
  fear: 'dark and mysterious atmosphere, deep purple and blue tones',
  joy: 'warm golden light, bright and radiant atmosphere',
  calm: 'serene and peaceful, soft blue and teal tones',
  anxiety: 'tense and surreal, fragmented light and shadow',
  wonder: 'magical and ethereal, shimmering starlight and iridescent colors',
  sad: 'melancholic and quiet, soft grey and muted blue tones',
  strange: 'surreal and dreamlike, impossible geometry and floating elements',
};

const EMOTION_PATTERNS = {
  fear: ['害怕','恐惧','逃跑','黑暗','追赶','坠落','死亡','血','monster','dark','chase','falling','death'],
  joy: ['开心','笑','美','幸福','温暖','爱','光明','彩虹','happy','love','light','warm','beautiful'],
  calm: ['安静','水','湖','海','风','云','月','星星','花','calm','water','lake','ocean','wind','moon','star'],
  anxiety: ['考试','迟到','找','迷路','丢','忘','急','错','exam','late','lost','forgot','anxious'],
  wonder: ['飞','魔法','变','穿越','巨大','奇怪','宇宙','光','fly','magic','transform','cosmic','giant'],
  sad: ['哭','难过','失去','离别','死','老','病','泪','cry','sad','loss','goodbye'],
  strange: ['扭曲','颠倒','动物','说话','变成','平行','无限','surreal','twisted','animal','talking'],
};

function _detectEmotion(text) {
  const scores = {};
  for (const [e, words] of Object.entries(EMOTION_PATTERNS)) {
    scores[e] = words.reduce((s, w) => s + (text.includes(w) ? 1 : 0), 0);
  }
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return best?.[1] > 0 ? best[0] : 'wonder';
}

function _extractKeywords(text) {
  const stop = new Set(['的','了','是','我','在','有','和','就','不','人','都','一','个','上','也','很','到','说','要','去','你','会','着','没有','看','好','自己','这','那','什么','好像','感觉','觉得','有点','the','a','an','is','was','in','on','at','to','of','and','it','that','this','my','me','I','was','then','just','like']);
  const words = text.split(/[\s，。！？、,!.?]+/).filter(w => w.length > 1 && !stop.has(w.toLowerCase()));
  const freq = {};
  words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 8).map(e => e[0]);
}

async function generateImage(narrative, keywords, emotion) {
  try {
    const mood = EMOTION_MOODS[emotion] || 'dreamlike and ethereal';
    const prompt = [
      'Create a dreamlike illustration for a dream.',
      `Atmosphere: ${mood}.`,
      'Style: soft watercolor meets oil painting, misty edges, luminous quality.',
      `Key elements from the dream: ${keywords.slice(0, 5).join(', ') || 'surreal landscape'}.`,
      `Dream narrative essence: ${narrative.slice(0, 200)}.`,
      'Aspect ratio 3:4, vertical composition. No text, no borders.',
    ].join(' ');

    const resp = await fetch(IMAGE_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${IMAGE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: IMAGE_MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4096,
        temperature: 1.0,
      }),
    });

    if (!resp.ok) return null;
    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content || '';

    // Parse markdown image URL (http or data: URIs)
    const mdMatch = content.match(/!\[.*?\]\(((?:https?|data):[^\s)]+)\)/);
    if (mdMatch) return mdMatch[1];

    // Parse bare base64
    if (content.startsWith('data:image')) return content;

    return null;
  } catch {
    return null;
  }
}

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
