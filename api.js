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

// ═══════════════════════ Image Generation ═══════════════════════
// Image generation is handled server-side only.
// API keys are never exposed to the client.

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
  fear: ['害怕','恐惧','逃跑','黑暗','追赶','坠落','死亡','血','鬼','怪物','噩梦','吓','恐怖','尖叫','逃','躲','深渊','窒息','棺材','僵尸','蛇','蜘蛛','陷阱','淹没','afraid','fear','scared','terrified','monster','dark','chase','falling','death','nightmare','horror','ghost','scream','hide','trapped','drowning','shadow','evil','demon'],
  joy: ['开心','笑','美','幸福','温暖','爱','光明','彩虹','拥抱','庆祝','鲜花','阳光','婚礼','团聚','成功','甜','礼物','胜利','happy','love','light','warm','beautiful','joy','smile','laugh','celebration','sun','flower','hug','peace','heaven'],
  calm: ['安静','水','湖','海','风','云','月','星星','花','雪','山','林','草原','日落','黄昏','晨曦','宁静','安详','漂浮','河','溪','寺庙','冥想','躺','散步','calm','water','lake','ocean','wind','moon','star','quiet','peaceful','slow','float','forest','river','sunset','snow','gentle','breeze'],
  anxiety: ['考试','迟到','找','迷路','丢','忘','急','错','没准备','赶不上','错过','晚点','等待','紧张','担心','焦虑','裸体','反复','拥挤','电梯','断','碎','慌','exam','late','lost','forgot','anxious','naked','stuck','missed','rush','broken','nervous','worried','failure','test'],
  wonder: ['飞','魔法','变','穿越','巨大','奇怪','宇宙','光','翅膀','神奇','幻想','星辰','银河','龙','精灵','仙境','奇迹','翱翔','异世界','宫殿','不可思议','fly','magic','cosmic','giant','wonder','fantasy','dragon','fairy','castle','portal','galaxy','wings','enchanted','mystical','ethereal','divine'],
  sad: ['哭','难过','失去','离别','死','老','病','泪','悲伤','孤独','寂寞','哀伤','痛苦','心碎','分手','遗憾','怀念','无奈','叹息','葬礼','再也','cry','sad','loss','goodbye','sorrow','lonely','grief','pain','tears','heartbreak','funeral','regret','miss','empty','cold','rain'],
  strange: ['扭曲','颠倒','动物','说话','变成','平行','无限','超现实','荒诞','错位','融化','变形','分身','循环','混乱','碎片','梦中梦','不真实','诡异','多重','surreal','twisted','animal','talking','strange','bizarre','weird','absurd','melt','shift','distort','warp','loop','fragment','double','clone','impossible'],
};

function _detectEmotion(text) {
  const scores = {};
  for (const [e, words] of Object.entries(EMOTION_PATTERNS)) {
    scores[e] = words.reduce((s, w) => s + (text.includes(w) ? 1 : 0), 0);
  }
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const bestScore = sorted[0][1];
  if (bestScore > 0) {
    // Among tied top scores, pick randomly
    const tied = sorted.filter(p => p[1] === bestScore).map(p => p[0]);
    return tied[Math.floor(Math.random() * tied.length)];
  }
  // No keywords matched → random emotion instead of always 'wonder'
  const all = Object.keys(EMOTION_PATTERNS);
  return all[Math.floor(Math.random() * all.length)];
}

function _extractKeywords(text) {
  const stop = new Set(['的','了','是','我','在','有','和','就','不','人','都','一','个','上','也','很','到','说','要','去','你','会','着','没有','看','好','自己','这','那','什么','好像','感觉','觉得','有点','the','a','an','is','was','in','on','at','to','of','and','it','that','this','my','me','I','was','then','just','like']);
  const words = text.split(/[\s，。！？、,!.?]+/).filter(w => w.length > 1 && !stop.has(w.toLowerCase()));
  const freq = {};
  words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 8).map(e => e[0]);
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
