/**
 * Nocturne · 夜曲
 * iOS-native dream journal. Bilingual (zh/en).
 */

const APP = { currentRoute: 'timeline' };

// ═══════════════════════ SPA Router ═══════════════════════

function routeTo(path) {
  APP.currentRoute = path;
  const main = document.getElementById('mainView');
  if (!main) return;

  const titles = { timeline: 'Nocturne', record: 'Nocturne · Record', broadcast: 'Nocturne · Broadcast', detail: 'Nocturne · Dream', stats: 'Nocturne · Insights' };
  document.title = titles[path] || 'Nocturne';

  document.querySelectorAll('.nav-tab').forEach(t => t.classList.toggle('active', t.dataset.route === path));
  updateTabLabels();

  main.style.opacity = '0';
  main.style.transition = 'opacity 0.2s ease';

  setTimeout(() => {
    switch (path) {
      case 'record': main.innerHTML = renderRecordPage(); initRecordPage(); break;
      case 'broadcast': main.innerHTML = renderBroadcastPage(); break;
      case 'login': main.innerHTML = renderLoginPage(); break;
      case 'profile': main.innerHTML = renderProfilePage(); break;
      default: main.innerHTML = renderTimelinePage(); break;
    }
    main.style.opacity = '1';
  }, 180);

  window.location.hash = path;
  main.scrollTop = 0;
}

function updateTabLabels() {
  const labels = [
    { sel: '[data-route="timeline"]', key: 'tab_timeline' },
    { sel: '[data-route="record"]', key: 'tab_record' },
    { sel: '[data-route="broadcast"]', key: 'tab_broadcast' },
  ];
  labels.forEach(({ sel, key }) => {
    const el = document.querySelector(sel);
    if (el) {
      const span = el.querySelector('span');
      if (span) span.textContent = t(key);
    }
  });
}

function initNavigation() {
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', (e) => { e.preventDefault(); routeTo(tab.dataset.route); });
  });
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '') || 'timeline';
    if (hash !== APP.currentRoute) routeTo(hash);
  });
}

// ═══════════════════════ Toast ═══════════════════════

function showToast(msg, duration = 2200) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.hidden = false;
  toast.textContent = msg;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.hidden = true; }, duration);
}

// ═══════════════════════ Helpers ═══════════════════════

function formatDate(dateStr) {
  const d = new Date(dateStr), now = new Date();
  const diff = now - d;
  if (diff < 86400000) return t('section_today');
  if (diff < 172800000) return t('section_yesterday');
  const months = currentLang === 'zh'
    ? ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']
    : ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return currentLang === 'zh' ? `${d.getMonth()+1}月${d.getDate()}日` : `${months[d.getMonth()]} ${d.getDate()}`;
}

const EMOTIONS_ZH = {
  fear: { symbol: '~', label: '恐惧' }, joy: { symbol: '^', label: '快乐' },
  calm: { symbol: '.', label: '平静' }, anxiety: { symbol: '≈', label: '焦虑' },
  wonder: { symbol: '⁕', label: '奇幻' }, sad: { symbol: '˅', label: '悲伤' }, strange: { symbol: '◌', label: '离奇' },
};
const EMOTIONS_EN = {
  fear: { symbol: '~', label: 'Fear' }, joy: { symbol: '^', label: 'Joy' },
  calm: { symbol: '.', label: 'Calm' }, anxiety: { symbol: '≈', label: 'Anxiety' },
  wonder: { symbol: '⁕', label: 'Wonder' }, sad: { symbol: '˅', label: 'Sadness' }, strange: { symbol: '◌', label: 'Strange' },
};

function em(e) {
  const map = currentLang === 'zh' ? EMOTIONS_ZH : EMOTIONS_EN;
  return map[e] || map.wonder;
}

function esc(str) {
  if (!str) return '';
  const d = document.createElement('div'); d.textContent = str; return d.innerHTML;
}

// ═══════════════════════ Dream Recorder ═══════════════════════

class DreamRecorder {
  constructor() {
    this.transcript = '';
    this.isRecording = false;
    this.recognition = null; this.timer = null;
    this.seconds = 0; this.lastSpeech = 0;
    this.init();
  }
  init() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      const el = document.getElementById('recordStatus');
      if (el) el.textContent = currentLang === 'zh' ? '不支持语音识别' : 'Speech not available';
      return;
    }
    this.recognition = new SR();
    this.recognition.lang = currentLang === 'zh' ? 'zh-CN' : 'en-US';
    this.recognition.interimResults = true;
    this.recognition.continuous = true;
    this.recognition.maxAlternatives = 1;
    this.recognition.onresult = (e) => {
      let interim = '', final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        e.results[i].isFinal ? (final += t) : (interim += t);
      }
      if (final) { this.transcript += final + ' '; this.lastSpeech = Date.now(); }
      const el = document.getElementById('recordTranscript');
      if (el) el.innerHTML = `<p>${this.transcript}<span class="transcript-interim">${interim}</span></p>`;
    };
    this.recognition.onerror = (e) => {
      if (e.error === 'no-speech') return;
      const el = document.getElementById('recordStatus');
      const msgs = {
        'not-allowed': currentLang === 'zh' ? '麦克风权限被拒绝' : 'Microphone access denied',
        'audio-capture': currentLang === 'zh' ? '无法访问麦克风' : 'Cannot access microphone',
        'network': currentLang === 'zh' ? '网络连接异常' : 'Network error',
        'aborted': currentLang === 'zh' ? '录音已中断' : 'Recording aborted',
      };
      if (el) el.textContent = msgs[e.error] || (currentLang === 'zh' ? '语音识别出错' : 'Speech error');
      this.isRecording = false;
      document.getElementById('recordBtn')?.classList.remove('recording');
      ['ripple1','ripple2','ripple3'].forEach(id => { const r = document.getElementById(id); if (r) r.style.display = 'none'; });
      clearInterval(this.timer);
      document.getElementById('recordTimer').textContent = '00:00';
    };
    this.recognition.onend = () => { if (this.isRecording) this.recognition.start(); };
    document.getElementById('recordBtn')?.addEventListener('click', () => this.toggle());
  }
  toggle() { this.isRecording ? this.stop() : this.start(); }
  start() {
    this.isRecording = true; this.seconds = 0; this.lastSpeech = Date.now();
    this.recognition.lang = currentLang === 'zh' ? 'zh-CN' : 'en-US';
    this.recognition.start();
    document.getElementById('recordBtn')?.classList.add('recording');
    document.getElementById('recordStatus').textContent = t('record_status_listen');
    // Show ripple rings
    ['ripple1','ripple2','ripple3'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.style.display = 'block'; el.style.animation = 'none'; el.offsetHeight; el.style.animation = ''; }
    });
    const el = document.getElementById('recordTranscript'); if (el) { el.innerHTML = ''; el.style.display = ''; }
    document.getElementById('recordActions').style.display = 'none';
    this.timer = setInterval(() => {
      this.seconds++;
      const m = Math.floor(this.seconds / 60).toString().padStart(2, '0');
      const s = (this.seconds % 60).toString().padStart(2, '0');
      const timerEl = document.getElementById('recordTimer'); if (timerEl) timerEl.textContent = `${m}:${s}`;
      if (Date.now() - this.lastSpeech > 4000 && this.transcript.length > 0)
        document.getElementById('recordStatus').textContent = t('record_status_still');
      if (this.seconds >= 90) this.stop();
    }, 1000);
  }
  stop() {
    this.isRecording = false; this.recognition.stop(); clearInterval(this.timer);
    document.getElementById('recordBtn')?.classList.remove('recording');
    ['ripple1','ripple2','ripple3'].forEach(id => {
      const el = document.getElementById(id); if (el) el.style.display = 'none';
    });
    document.getElementById('recordStatus').textContent = this.transcript ? t('record_status_done') : t('record_status_idle');
    document.getElementById('recordTimer').textContent = '00:00';
    if (this.transcript.trim()) document.getElementById('recordActions').style.display = 'flex';
  }
  reset() {
    this.transcript = ''; this.seconds = 0;
    document.getElementById('recordTimer').textContent = '00:00';
    const el = document.getElementById('recordTranscript'); if (el) { el.innerHTML = ''; el.style.display = 'none'; }
    document.getElementById('recordActions').style.display = 'none';
    document.getElementById('recordStatus').textContent = t('record_status_idle');
  }
}

// ═══════════════════════ Dream Processing ═══════════════════════

function processDream() {
  const text = window._recorder?.transcript || '';
  if (!text.trim()) { showToast(t('toast_nothing')); return; }
  const pEl = document.getElementById('recordProcessing'); if (pEl) pEl.style.display = 'block';
  const pText = pEl?.querySelector('.processing-text');
  const aEl = document.getElementById('recordActions'); if (aEl) aEl.style.display = 'none';
  const sEl = document.getElementById('recordStatus'); if (sEl) sEl.textContent = '';

  // Cycling processing messages
  const phasesZh = ['正在聆听...', '梳理碎片...', '编织叙事...', '即将完成...'];
  const phasesEn = ['Listening...', 'Gathering fragments...', 'Weaving narrative...', 'Almost there...'];
  const phases = currentLang === 'zh' ? phasesZh : phasesEn;
  let phaseIdx = 0;
  if (pText) pText.textContent = phases[0];
  const phaseInterval = setInterval(() => {
    phaseIdx++;
    if (phaseIdx < phases.length && pText) pText.textContent = phases[phaseIdx];
  }, 1200);

  apiProcessDream(text).then(r => {
    clearInterval(phaseInterval);
    if (r.success) {
      addDream({ rawText: text, narrative: r.narrative, emotion: r.emotion || 'wonder', keywords: r.keywords || [], image: r.image_url || null, title: r.title || null });
      showToast(t('toast_saved'));
    } else {
      addDream({ rawText: text, narrative: text, emotion: 'wonder', keywords: kw(text), title: text.slice(0, 28), image: null });
      showToast(t('toast_saved_offline'));
    }
    setTimeout(() => routeTo('timeline'), 500);
    if (pEl) pEl.style.display = 'none';
  });
}
function kw(text) {
  const stop = new Set(['的','了','是','我','在','有','和','就','不','人','都','一','个','上','也','很','到','说','要','去','你','会','着','没有','看','好','自己','这','那','什么','好像','感觉','觉得','the','a','an','is','was','in','on','at','to','of','and','it','that','this','my','me','I','was']);
  return text.split(/[\s，。！？、]+/).filter(w => w.length > 1 && !stop.has(w.toLowerCase())).slice(0, 8);
}
function resetRecording() { window._recorder?.reset(); }

// ═══════════════════════ Page Templates ═══════════════════════

function renderTimelinePage() {
  const dreams = loadDreams();
  if (dreams.length === 0) {
    const btnText = t('empty_btn');
    return `<div class="timeline-empty">
      <div class="empty-moon"><div class="empty-moon-inner"></div></div>
      <div class="empty-title">${t('empty_title')}</div>
      <p class="empty-hint">${t('empty_hint')}</p>
      <button class="btn btn-primary" onclick="routeTo('record')">${btnText}</button>
    </div>`;
  }
  const stats = getDreamStats();
  const topE = Object.entries(stats.emotions).sort((a,b) => b[1]-a[1])[0];

  const user = getCurrentUser();
  const color = user?.avatar_color || '#5B6E82';
  const initial = user ? (user.nickname||user.username).charAt(0).toUpperCase() : '?';
  const profilePath = user ? 'profile' : 'login';

  let html = `<div class="nav-bar">
    <div><div class="nav-title">Nocturne</div><div class="nav-subtitle">${t('timeline_subtitle')}</div></div>
    <div style="display:flex;align-items:center;gap:8px">
      <button class="user-nav" onclick="routeTo('${profilePath}')" style="background:${color}" aria-label="${user?'个人中心':'登录'}">${initial}</button>
      <button class="btn btn-tertiary" onclick="toggleLang()" style="font-size:11px;letter-spacing:1px;padding:6px 10px">${t('lang_switch')}</button>
    </div>
  </div>
  <div class="stat-row" onclick="viewStats()" style="cursor:pointer">
    <div class="stat-cell"><span class="stat-value">${stats.total}</span><span class="stat-label">${t('stat_dreams')}</span></div>
    <div class="stat-cell"><span class="stat-value">${Object.keys(stats.keywords).length}</span><span class="stat-label">${t('stat_symbols')}</span></div>
    <div class="stat-cell"><span class="stat-value">${em(topE?.[0]).symbol}</span><span class="stat-label">${t('stat_mood')}</span></div>
  </div>`;

  const groups = {};
  dreams.forEach(d => { const k = formatDate(d.date); if (!groups[k]) groups[k] = []; groups[k].push(d); });
  for (const [label, group] of Object.entries(groups)) {
    html += `<h3 class="section-header">${label.toUpperCase()}</h3>`;
    group.forEach(dream => {
      html += `<button class="card dream-cell" onclick="viewDream('${dream.id}')" style="width:100%;text-align:left;font:inherit" aria-label="${esc(dream.narrative?.slice(0, 40) || dream.rawText?.slice(0, 40) || '')}">
        <div class="dream-cell-thumb">${dream.image ? `<img src="${dream.image}" alt="" loading="lazy">` : `<div class="dream-cell-thumb-placeholder">${em(dream.emotion).symbol}</div>`}</div>
        <div class="dream-cell-body">
          <div class="dream-cell-title">${esc(dream.narrative?.slice(0, 50) || dream.rawText?.slice(0, 50) || '···')}</div>
          <div class="dream-cell-meta">${em(dream.emotion).label}${dream.keywords?.length ? ' · ' + dream.keywords.slice(0,2).map(k => esc(k)).join(', ') : ''}</div>
        </div>
        <span class="dream-cell-chevron"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></span>
      </button>`;
    });
    html += '</div>';
  }
  return html;
}

function renderRecordPage() {
  return `<div class="record-container">
    <div class="record-status" id="recordStatus" aria-live="polite">${t('record_status_idle')}</div>
    <div class="record-btn-wrap" id="recordBtnWrap">
      <div class="record-ripple" id="ripple1" style="display:none"></div>
      <div class="record-ripple" id="ripple2" style="display:none"></div>
      <div class="record-ripple" id="ripple3" style="display:none"></div>
      <button class="record-btn" id="recordBtn" aria-label="Record">
        <div class="record-btn-inner"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="5"/></svg></div>
      </button>
    </div>
    <div class="record-timer" id="recordTimer">00:00</div>
    <div class="record-transcript" id="recordTranscript"></div>
    <div class="record-actions" id="recordActions" style="display:none">
      <button class="btn btn-secondary" onclick="resetRecording()">${t('record_re_record')}</button>
      <button class="btn btn-primary" onclick="processDream()">${t('record_weave')}</button>
    </div>
    <div class="record-processing" id="recordProcessing" style="display:none">
      <div class="processing-dots"><div class="processing-dot"></div><div class="processing-dot"></div><div class="processing-dot"></div></div>
      <p class="processing-text">${t('record_weaving')}</p>
    </div>
  </div>`;
}

function renderBroadcastPage() {
  const user = getCurrentUser();
  const color2 = user?.avatar_color || '#5B6E82';
  const init2 = user ? (user.nickname||user.username).charAt(0).toUpperCase() : '?';
  const pp = user ? 'profile' : 'login';
  return `<div class="nav-bar"><div><div class="nav-title">Nocturne</div><div class="nav-subtitle">${t('broadcast_subtitle')}</div></div><div style="display:flex;align-items:center;gap:8px"><button class="user-nav" onclick="routeTo('${pp}')" style="background:${color2}" aria-label="Profile">${init2}</button><button class="btn btn-tertiary" onclick="toggleLang()" style="font-size:11px;letter-spacing:1px;padding:6px 10px">${t('lang_switch')}</button></div></div>
    <div class="broadcast-feed" id="broadcastFeed">
      <div class="dream-weaver" style="padding:40px 0;display:flex;align-items:center;justify-content:center;gap:16px">
        <div class="weaver-dot"></div><div class="weaver-dot"></div><div class="weaver-dot"></div>
      </div>
    </div>`;
}

async function reactToBroadcast(id, emoji) { await reactToDream(id, emoji); routeTo('broadcast'); }

// ═══════════════════════ Dream Detail ═══════════════════════

function viewDream(id) {
  const dream = findDream(id);
  if (!dream) { showToast(t('toast_not_found')); return; }
  document.title = 'Nocturne · Dream';
  const e = em(dream.emotion);
  const main = document.getElementById('mainView');
  main.style.opacity = '0';
  setTimeout(() => {
    main.innerHTML = `
      <div class="detail-nav">
        <button class="detail-back" onclick="routeTo('timeline')" aria-label="${t('detail_back')}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span class="detail-nav-label">${t('detail_nav')}</span>
      </div>
      <div class="detail-image">${dream.image ? `<img src="${dream.image}" alt="">` : `<div class="detail-image-placeholder">${e.symbol}</div>`}</div>
      <div class="detail-meta">${formatDate(dream.date)} · ${e.symbol} ${e.label}</div>
      <h1 class="detail-title">${esc(dream.title || dream.narrative?.slice(0, 36) || (currentLang==='zh'?'未命名之梦':'Untitled'))}</h1>
      <div class="detail-narrative">${esc(dream.narrative || dream.rawText || '')}</div>
      <div class="detail-keywords">${dream.keywords?.map(k => `<span class="detail-keyword">${esc(k)}</span>`).join('') || ''}</div>
      <div class="detail-actions">
        <button class="btn btn-secondary" onclick="shareDream('${dream.id}')"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/><line x1="15.4" y1="6.5" x2="8.6" y2="10.5"/></svg>${t('detail_share')}</button>
        <button class="btn btn-destructive" onclick="deleteDream('${dream.id}')">${t('detail_delete')}</button>
      </div>`;
    main.style.opacity = '1';
  }, 180);
  APP.currentRoute = 'detail';
}

function deleteDream(id) {
  const dream = findDream(id);
  if (!dream) return;
  const backup = { ...dream };

  // Optimistic delete with undo
  const dreams = loadDreams().filter(d => d.id !== id);
  saveDreams(dreams);
  routeTo('timeline');

  const undoMsg = currentLang === 'zh' ? '已删除 · 点击撤销' : 'Deleted · Tap to undo';
  showToast(undoMsg, 4000);

  // Undo listener
  const toast = document.getElementById('toast');
  const undo = () => {
    const current = loadDreams();
    current.push(backup);
    saveDreams(current);
    showToast(currentLang === 'zh' ? '已恢复' : 'Restored');
    routeTo('timeline');
    toast.removeEventListener('click', undo);
  };
  if (toast) {
    toast.style.cursor = 'pointer';
    toast.addEventListener('click', undo);
    setTimeout(() => { toast.style.cursor = ''; toast.removeEventListener('click', undo); }, 4000);
  }
}

// ═══════════════════════ Stats ═══════════════════════

function viewStats() {
  const stats = getDreamStats();
  if (stats.total === 0) return;
  document.title = 'Nocturne · Insights';
  const topEmo = Object.entries(stats.emotions).sort((a,b) => b[1]-a[1]).slice(0, 6);
  const topKw = Object.entries(stats.keywords).sort((a,b) => b[1]-a[1]).slice(0, 15);
  const maxE = topEmo[0]?.[1] || 1;
  const main = document.getElementById('mainView');
  main.style.opacity = '0';
  setTimeout(() => {
    main.innerHTML = `
      <div class="detail-nav">
        <button class="detail-back" onclick="routeTo('timeline')" aria-label="${t('detail_back')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg></button>
        <span class="detail-nav-label">${t('insights_title')}</span>
      </div>
      <div class="nav-bar"><div><div class="nav-title">${t('insights_title')}</div><div class="nav-subtitle">${t('insights_subtitle', stats.total)}</div></div></div>
      <div class="stat-section"><h2 class="section-header">${t('insights_emotions')}</h2><div class="card-list">
        ${topEmo.map(([e,c]) => `<div class="card emotion-bar-row"><span class="emotion-emoji">${em(e).symbol}</span><span class="emotion-label">${em(e).label}</span><div class="emotion-bar-track"><div class="emotion-bar-fill" style="width:${(c/maxE*100)}%"></div></div><span class="emotion-count">${c}</span></div>`).join('')}
      </div></div>
      <div class="stat-section"><h2 class="section-header">${t('insights_symbols')}</h2><div class="keyword-cloud">
        ${(() => { const maxKw = topKw[0]?.[1] || 1; return topKw.map(([k,c]) => `<span class="keyword-item" style="font-size:${Math.max(12,Math.min(20,12+c*2))}px;opacity:${0.4+(c/maxKw)*0.6}">${esc(k)}</span>`).join(''); })()}
      </div></div>`;
    main.style.opacity = '1';
  }, 180);
  APP.currentRoute = 'stats';
}

// ═══════════════════════ Swipe-to-Back ═══════════════════════

let touchSX = 0, touchSY = 0;
document.addEventListener('touchstart', (e) => { touchSX = e.touches[0].clientX; touchSY = e.touches[0].clientY; }, { passive: true });
document.addEventListener('touchend', (e) => {
  if (APP.currentRoute !== 'detail' && APP.currentRoute !== 'stats') return;
  const dx = e.changedTouches[0].clientX - touchSX;
  const dy = Math.abs(e.changedTouches[0].clientY - touchSY);
  if (dx > 60 && dx > dy * 1.5 && touchSX < 40) routeTo('timeline');
});

// ═══════════════════════ Splash — light particles gather into moon ═══════════════════════

function initSplash() {
  const canvas = document.getElementById('splashCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) { canvas.remove(); return; }

  let W, H, cx, cy;
  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
    cx = W / 2;
    cy = H * 0.38;
  }
  resize();
  window.addEventListener('resize', resize);
  const moonR = Math.min(50, W * 0.12);
  let time = 0;
  let animId;

  // Phase timing
  const PHASE_GATHER = 2.8;  // particles slowly gather into moon
  const PHASE_HOLD = 1.2;    // moon stays, title appears
  const PHASE_FADE = 0.8;    // gentle fade out to app
  const TOTAL = PHASE_GATHER + PHASE_HOLD + PHASE_FADE;

  // Edge-spawned particles
  const particles = [];
  const PARTICLE_COUNT = Math.min(55, Math.floor(W * H / 6000));

  function spawnParticle(delay) {
    const edge = Math.floor(Math.random() * 4);
    let x, y;
    switch (edge) {
      case 0: x = Math.random() * W; y = -20; break;          // top
      case 1: x = W + 20; y = Math.random() * H; break;       // right
      case 2: x = Math.random() * W; y = H + 20; break;       // bottom
      default: x = -20; y = Math.random() * H; break;          // left
    }
    // Target: random point within the moon circle
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * moonR * 0.85;
    const tx = cx + Math.cos(angle) * dist;
    const ty = cy + Math.sin(angle) * dist;

    return {
      x, y, tx, ty,
      start: delay,
      duration: 1.4 + Math.random() * 1.4,
      r: Math.random() * 2.2 + 0.8,
      brightness: Math.random() * 0.6 + 0.3,
      settled: false,
    };
  }

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push(spawnParticle(0.3 + Math.random() * 1.5));
  }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function draw(ts) {
    time += 0.016; // ~60fps step
    ctx.clearRect(0, 0, W, H);

    // Dark background
    ctx.fillStyle = '#060D18';
    ctx.fillRect(0, 0, W, H);

    // Draw particles
    for (const p of particles) {
      const elapsed = time - p.start;
      if (elapsed < 0) continue;

      if (!p.settled) {
        const prog = Math.min(1, elapsed / p.duration);
        const t = easeInOutCubic(prog);
        p.x = p.tx + (p.x - p.tx) * (1 - t);
        p.y = p.ty + (p.y - p.ty) * (1 - t);
        if (prog >= 1) p.settled = true;
      }

      // Glow
      const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
      gradient.addColorStop(0, `rgba(240, 220, 160, ${p.brightness})`);
      gradient.addColorStop(0.4, `rgba(220, 200, 140, ${p.brightness * 0.5})`);
      gradient.addColorStop(1, 'rgba(220, 200, 140, 0)');
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Core dot
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 245, 210, ${p.brightness})`;
      ctx.fill();
    }

    // Moon crescent outline (emerges as particles settle)
    if (time > PHASE_GATHER * 0.5) {
      const moonAlpha = Math.min(1, (time - PHASE_GATHER * 0.6) / (PHASE_GATHER * 0.4));
      // Outer glow
      const glow = ctx.createRadialGradient(cx, cy, moonR * 0.7, cx, cy, moonR * 2.2);
      glow.addColorStop(0, `rgba(220, 200, 160, ${0.15 * moonAlpha})`);
      glow.addColorStop(1, 'rgba(220, 200, 160, 0)');
      ctx.beginPath();
      ctx.arc(cx, cy, moonR * 2.2, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      // Crescent rim
      ctx.beginPath();
      ctx.arc(cx, cy, moonR, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(220, 200, 160, ${0.25 * moonAlpha})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Title text
    if (time > PHASE_GATHER) {
      const textAlpha = Math.min(1, (time - PHASE_GATHER) / 0.8);
      ctx.fillStyle = `rgba(225, 220, 210, ${0.9 * textAlpha})`;
      ctx.font = `italic ${Math.min(38, W * 0.09)}px 'Cormorant Garamond', 'Georgia', serif`;
      ctx.textAlign = 'center';
      ctx.fillText('Nocturne', cx, cy + moonR + 48);

      // Tagline
      ctx.fillStyle = `rgba(200, 190, 175, ${0.4 * textAlpha})`;
      ctx.font = `${Math.min(12, W * 0.028)}px 'Courier New', monospace`;
      ctx.textAlign = 'center';
      const tag = t('tagline');
      ctx.fillText(tag, cx, cy + moonR + 72);
    }

    // Fade out
    if (time > PHASE_GATHER + PHASE_HOLD) {
      const fadeProg = (time - PHASE_GATHER - PHASE_HOLD) / PHASE_FADE;
      canvas.style.opacity = Math.max(0, 1 - fadeProg);
    }

    if (time < TOTAL + 0.3) {
      animId = requestAnimationFrame(draw);
    } else {
      canvas.classList.add('hide');
      setTimeout(() => canvas.remove(), 800);
    }
  }

  animId = requestAnimationFrame(draw);
}

// ═══════════════════════ Particle System — gentle dust motes in moonlight ═══════════════════════

function initParticles() {
  const canvas = document.getElementById('particles');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (prefersReduced.matches) return;
  let motes = [];
  let animId;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  // Dust motes — warm, drifting
  for (let i = 0; i < 30; i++) {
    motes.push({
      type: 'dust',
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.0 + 0.3,
      speed: Math.random() * 0.2 + 0.05,
      opacity: Math.random() * 0.18 + 0.04,
      wobble: Math.random() * Math.PI * 2,
      wobbleSpeed: Math.random() * 0.003 + 0.001,
    });
  }
  // Stars — irregular scatter, slow twinkle, gentle drift
  for (let i = 0; i < 18; i++) {
    motes.push({
      type: Math.random() < 0.3 ? 'cross' : 'dot',
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 0.6 + 0.15,
      opacity: Math.random() * 0.4 + 0.15,
      twinklePhase: Math.random() * Math.PI * 2,
      twinkleSpeed: Math.random() * 0.008 + 0.004,
      driftX: (Math.random() - 0.5) * 0.25,
      driftY: (Math.random() - 0.5) * 0.25,
    });
  }

  function draw(time) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const m of motes) {
      if (m.type === 'dust') {
        m.y -= m.speed;
        m.wobble += m.wobbleSpeed;
        m.x += Math.sin(m.wobble) * 0.15;
        if (m.y < -10) { m.y = canvas.height + 10; m.x = Math.random() * canvas.width; }
        const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r * 3);
        g.addColorStop(0, `rgba(220, 205, 175, ${m.opacity})`);
        g.addColorStop(1, 'rgba(220, 205, 175, 0)');
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r * 3, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
      } else {
        // Star — slow drift + gentle twinkle
        m.x += m.driftX;
        m.y += m.driftY;
        if (m.x < -10) m.x = canvas.width + 10;
        if (m.x > canvas.width + 10) m.x = -10;
        if (m.y < -10) m.y = canvas.height + 10;
        if (m.y > canvas.height + 10) m.y = -10;

        const twinkle = 0.35 + 0.65 * Math.sin(time * m.twinkleSpeed + m.twinklePhase);
        const alpha = m.opacity * Math.max(0.15, twinkle);

        // Soft glow halo
        const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r * 2);
        g.addColorStop(0, `rgba(240, 220, 160, ${alpha})`);
        g.addColorStop(1, 'rgba(240, 220, 160, 0)');
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r * 2, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();

        // Core dot
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 240, 200, ${alpha})`; ctx.fill();

        // Cross sparkle on brightest moments
        if (m.type === 'cross' && twinkle > 0.82) {
          ctx.strokeStyle = `rgba(255, 240, 200, ${alpha * 0.35})`;
          ctx.lineWidth = 0.3;
          const len = m.r * 4;
          ctx.beginPath();
          ctx.moveTo(m.x - len, m.y); ctx.lineTo(m.x + len, m.y);
          ctx.moveTo(m.x, m.y - len); ctx.lineTo(m.x, m.y + len);
          ctx.stroke();
        }
      }
    }
    animId = requestAnimationFrame(draw);
  }
  animId = requestAnimationFrame(draw);
  prefersReduced.addEventListener('change', (e) => {
    if (e.matches) cancelAnimationFrame(animId);
    else animId = requestAnimationFrame(draw);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(animId); }
    else { animId = requestAnimationFrame(draw); }
  });
}

// ═══════════════════════ Init ═══════════════════════

function renderLoginPage() {
  return `<div class="auth-container">
    <div class="auth-card">
      <div class="auth-logo">Nocturne</div>
      <p class="auth-desc" id="authDesc">${currentLang==='zh'?'登录以同步你的梦境数据':'Sign in to sync your dreams'}</p>
      <form id="authForm" onsubmit="return false" class="auth-form">
        <input type="text" id="authUser" placeholder="${currentLang==='zh'?'用户名':'Username'}" class="auth-input" autocomplete="username" minlength="3" maxlength="20" required>
        <input type="password" id="authPass" placeholder="${currentLang==='zh'?'密码':'Password'}" class="auth-input" autocomplete="current-password" minlength="6" required>
        <input type="password" id="authPass2" placeholder="${currentLang==='zh'?'确认密码':'Confirm'}" class="auth-input" style="display:none" minlength="6">
        <div class="auth-error" id="authError" role="alert"></div>
        <button type="submit" class="btn btn-primary auth-btn" id="authSubmit">${currentLang==='zh'?'登录':'Sign In'}</button>
      </form>
      <p class="auth-switch">
        <span id="authSwitchText">${currentLang==='zh'?'还没有账号？':"Don't have an account?"}</span>
        <button class="btn btn-ghost" id="authSwitchBtn" style="font-size:13px">${currentLang==='zh'?'注册':'Register'}</button>
      </p>
    </div>
  </div>`;
}

async function initLoginPage() {
  if (isLoggedIn()) { routeTo('profile'); return; }
  const userEl = document.getElementById('authUser'); const passEl = document.getElementById('authPass');
  const pass2El = document.getElementById('authPass2'); const errorEl = document.getElementById('authError');
  const submitBtn = document.getElementById('authSubmit'); const switchBtn = document.getElementById('authSwitchBtn');
  const switchText = document.getElementById('authSwitchText'); const descEl = document.getElementById('authDesc');
  let isRegister = false;
  switchBtn.addEventListener('click', () => {
    isRegister = !isRegister;
    pass2El.style.display = isRegister ? 'block' : 'none';
    submitBtn.textContent = isRegister ? (currentLang==='zh'?'注册':'Register') : (currentLang==='zh'?'登录':'Sign In');
    switchBtn.textContent = isRegister ? (currentLang==='zh'?'登录':'Sign In') : (currentLang==='zh'?'注册':'Register');
    switchText.textContent = isRegister ? (currentLang==='zh'?'已有账号？':'Already have one?') : (currentLang==='zh'?'还没有账号？':"Don't have one?");
    descEl.textContent = isRegister ? (currentLang==='zh'?'创建一个账号来保存你的梦境':'Create an account to save your dreams') : (currentLang==='zh'?'登录以同步你的梦境数据':'Sign in to sync your dreams');
    errorEl.textContent = '';
  });
  document.getElementById('authForm').addEventListener('submit', async () => {
    const username = userEl.value.trim(); const password = passEl.value;
    if (!username || !password) { errorEl.textContent = currentLang==='zh'?'请填写所有字段':'Fill all fields'; return; }
    if (isRegister && password !== pass2El.value) { errorEl.textContent = currentLang==='zh'?'两次密码不一致':'Passwords mismatch'; return; }
    submitBtn.disabled = true; submitBtn.textContent = '...'; errorEl.textContent = '';
    const result = isRegister ? await apiRegister(username, password) : await apiLogin(username, password);
    if (result.success) {
      localStorage.setItem('nocturne-token', result.token);
      localStorage.setItem('nocturne-user', JSON.stringify(result.user));
      showToast(isRegister ? (currentLang==='zh'?'注册成功 ✦':'Registered ✦') : (currentLang==='zh'?'欢迎回来':'Welcome back'));
      routeTo('timeline');
    } else { errorEl.textContent = result.error || 'Error'; }
    submitBtn.disabled = false;
    submitBtn.textContent = isRegister ? (currentLang==='zh'?'注册':'Register') : (currentLang==='zh'?'登录':'Sign In');
  });
}

function renderProfilePage() {
  const user = getCurrentUser();
  if (!user) { routeTo('login'); return ''; }
  const color = user.avatar_color || '#5B6E82';
  const initial = (user.nickname || user.username).charAt(0).toUpperCase();
  return `<div class="profile-container">
    <div class="profile-header">
      <div class="profile-avatar" style="background:${color}">${initial}</div>
      <h2 class="profile-name">${esc(user.nickname)}</h2>
      <p class="profile-username">@${esc(user.username)}</p>
    </div>
    <div class="card profile-edit">
      <label class="profile-label">${currentLang==='zh'?'昵称':'Nickname'}</label>
      <input type="text" id="profileNickname" class="auth-input" value="${esc(user.nickname)}" maxlength="30">
      <label class="profile-label">${currentLang==='zh'?'简介':'Bio'}</label>
      <input type="text" id="profileBio" class="auth-input" value="${esc(user.bio||'')}" maxlength="200" placeholder="${currentLang==='zh'?'写一句话介绍自己':'A short intro'}">
      <div class="profile-actions">
        <button class="btn btn-primary" onclick="saveProfile()">${currentLang==='zh'?'保存':'Save'}</button>
        <button class="btn btn-ghost" onclick="handleLogout()">${currentLang==='zh'?'退出登录':'Log Out'}</button>
      </div>
    </div>
  </div>`;
}

async function saveProfile() {
  const nickname = document.getElementById('profileNickname')?.value?.trim() || '';
  const bio = document.getElementById('profileBio')?.value?.trim() || '';
  const result = await apiUpdateProfile(nickname, bio);
  if (result.success) { localStorage.setItem('nocturne-user', JSON.stringify(result.user)); showToast(currentLang==='zh'?'已保存':'Saved'); routeTo('profile'); }
  else { showToast(result.error || 'Failed'); }
}

async function handleLogout() { await apiLogout(); showToast(currentLang==='zh'?'已退出':'Logged out'); routeTo('timeline'); }

function initRecordPage() { window._recorder = new DreamRecorder(); }
async function initBroadcastPage() {
  const feed = document.getElementById('broadcastFeed');
  if (!feed) return;
  const { broadcasts, online } = await loadBroadcast();
  if (broadcasts.length === 0) {
    const msg = online ? t('broadcast_empty') : (currentLang === 'zh' ? '无法连接，请检查网络' : 'Cannot connect. Check your network.');
    feed.innerHTML = `<div class="broadcast-empty-cell"><p>${msg}</p></div>`;
    return;
  }
  feed.innerHTML = broadcasts.map(item => {
    return `<div class="card broadcast-card">
      <div class="broadcast-meta">${em(item.emotion).symbol} ${em(item.emotion).label}</div>
      <p class="broadcast-text">${esc(item.narrative?.slice(0, 180) || '')}</p>
      <div class="broadcast-reactions">${['○','⁕','^'].map(e => {
        const c = (item.reactions||{})[e]||0;
        return `<button class="reaction-btn${c>0?' active':''}" onclick="reactToBroadcast('${item.id}','${e}')" aria-label="${e}${c>0?' '+c:''}">${e}${c>0?`<span class="reaction-count" aria-hidden="true">${c}</span>`:''}</button>`;
      }).join('')}</div>
    </div>`;
  }).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  initParticles();
  updateTabLabels();
  initNavigation();
  const hash = window.location.hash.replace('#', '') || 'timeline';
  routeTo(hash);

  // Light-gathering splash
  initSplash();
});
