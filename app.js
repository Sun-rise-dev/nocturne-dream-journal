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

  // Update tab labels
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.toggle('active', t.dataset.route === path));
  updateTabLabels();

  main.style.opacity = '0';
  main.style.transition = 'opacity 0.2s ease';

  setTimeout(() => {
    switch (path) {
      case 'record': main.innerHTML = renderRecordPage(); initRecordPage(); break;
      case 'broadcast': main.innerHTML = renderBroadcastPage(); break;
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
    const el = document.getElementById('recordTranscript'); if (el) el.innerHTML = '';
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
    const el = document.getElementById('recordTranscript'); if (el) el.innerHTML = '';
    document.getElementById('recordActions').style.display = 'none';
    document.getElementById('recordStatus').textContent = t('record_status_idle');
  }
}

// ═══════════════════════ Dream Processing ═══════════════════════

function processDream() {
  const text = window._recorder?.transcript || '';
  if (!text.trim()) { showToast(t('toast_nothing')); return; }
  const pEl = document.getElementById('recordProcessing'); if (pEl) pEl.style.display = 'block';
  const pText = pEl?.querySelector('.weaver-text');
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

  let html = `<div class="nav-bar">
    <div><div class="nav-title">Nocturne</div><div class="nav-subtitle">${t('timeline_subtitle')}</div></div>
    <button class="btn btn-tertiary" onclick="toggleLang()" style="font-size:11px;letter-spacing:1px;padding:6px 10px">${t('lang_switch')}</button>
  </div>
  <div class="stat-row" onclick="viewStats()" style="cursor:pointer">
    <div class="stat-cell"><span class="stat-cell-value">${stats.total}</span><span class="stat-cell-label">${t('stat_dreams')}</span></div>
    <div class="stat-cell"><span class="stat-cell-value">${Object.keys(stats.keywords).length}</span><span class="stat-cell-label">${t('stat_symbols')}</span></div>
    <div class="stat-cell"><span class="stat-cell-value">${em(topE?.[0]).symbol}</span><span class="stat-cell-label">${t('stat_mood')}</span></div>
  </div>`;

  const groups = {};
  dreams.forEach(d => { const k = formatDate(d.date); if (!groups[k]) groups[k] = []; groups[k].push(d); });
  for (const [label, group] of Object.entries(groups)) {
    html += `<div class="section-header">${label.toUpperCase()}</div>`;
    group.forEach(dream => {
      html += `<div class="card dream-cell" onclick="viewDream('${dream.id}')">
        <div class="dream-cell-thumb">${dream.image ? `<img src="${dream.image}" alt="" loading="lazy">` : `<div class="dream-cell-thumb-placeholder">${em(dream.emotion).symbol}</div>`}</div>
        <div class="dream-cell-body">
          <div class="dream-cell-title">${esc(dream.narrative?.slice(0, 50) || dream.rawText?.slice(0, 50) || '···')}</div>
          <div class="dream-cell-meta">${em(dream.emotion).label}${dream.keywords?.length ? ' · ' + dream.keywords.slice(0,2).map(k => esc(k)).join(', ') : ''}</div>
        </div>
        <span class="dream-cell-chevron"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></span>
      </div>`;
    });
    html += '</div>';
  }
  return html;
}

function renderRecordPage() {
  return `<div class="record-container">
    <div class="record-status" id="recordStatus">${t('record_status_idle')}</div>
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
  const broadcast = loadBroadcast();
  if (broadcast.length === 0) {
    return `<div class="nav-bar"><div><div class="nav-title">Nocturne</div><div class="nav-subtitle">${t('broadcast_subtitle')}</div></div><button class="btn btn-tertiary" onclick="toggleLang()" style="font-size:11px;letter-spacing:1px;padding:6px 10px">${t('lang_switch')}</button></div>
    <div class="card-list"><div class="card broadcast-empty-cell"><p>${t('broadcast_empty')}</p></div></div>`;
  }
  let html = `<div class="nav-bar"><div><div class="nav-title">Nocturne</div><div class="nav-subtitle">${t('broadcast_subtitle')}</div></div><button class="btn btn-tertiary" onclick="toggleLang()" style="font-size:11px;letter-spacing:1px;padding:6px 10px">${t('lang_switch')}</button></div><div class="card-list">`;
  broadcast.forEach(item => {
    html += `<div class="card broadcast-card">
      <div class="broadcast-meta">${em(item.emotion).symbol} ${em(item.emotion).label}</div>
      <p class="broadcast-text">${esc(item.narrative?.slice(0, 180) || '')}</p>
      <div class="broadcast-reactions">${['○','⁕','^'].map(e => { const c = (item.reactions||{})[e]||0; return `<button class="reaction-btn${c>0?' active':''}" onclick="reactToBroadcast('${item.id}','${e}')">${e}${c>0?`<span class="reaction-count">${c}</span>`:''}</button>`; }).join('')}</div>
    </div>`;
  });
  html += '</div>';
  return html;
}

function reactToBroadcast(id, emoji) { reactToDream(id, emoji); routeTo('broadcast'); }

// ═══════════════════════ Dream Detail ═══════════════════════

function viewDream(id) {
  const dream = findDream(id);
  if (!dream) { showToast(t('toast_not_found')); return; }
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
      <div class="stat-section"><div class="section-header">${t('insights_emotions')}</div><div class="card-list">
        ${topEmo.map(([e,c]) => `<div class="card emotion-bar-row"><span class="emoji">${em(e).symbol}</span><span class="label">${em(e).label}</span><div class="emotion-bar-track"><div class="emotion-bar-fill" style="width:${(c/maxE*100)}%"></div></div><span class="count">${c}</span></div>`).join('')}
      </div></div>
      <div class="stat-section"><div class="section-header">${t('insights_symbols')}</div><div class="keyword-cloud">
        ${topKw.map(([k,c]) => `<span class="keyword-item" style="font-size:${Math.max(12,Math.min(20,12+c*2))}px;opacity:${0.4+(c/topKw[0][1])*0.6}">${esc(k)}</span>`).join('')}
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

// ═══════════════════════ Init ═══════════════════════

function initTimelinePage() {}
function initRecordPage() { window._recorder = new DreamRecorder(); }
function initBroadcastPage() {}

document.addEventListener('DOMContentLoaded', () => {
  // Splash tagline
  const tagEl = document.getElementById('splashTagline');
  if (tagEl) tagEl.textContent = t('tagline');

  updateTabLabels();
  initNavigation();
  const hash = window.location.hash.replace('#', '') || 'timeline';
  routeTo(hash);

  // Splash — auto-dismiss after 2s
  const splash = document.getElementById('splash');
  if (splash) {
    setTimeout(() => { splash.classList.add('fade-out'); }, 1800);
    setTimeout(() => { if (splash.parentNode) splash.remove(); }, 2400);
  }
});
