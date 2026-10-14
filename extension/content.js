/* Content script: bấm đúp vào từ (hoặc bôi đen + Alt) để tra nhanh, lưu vào flashcard kèm câu ngữ cảnh. */
(() => {
  // Bản content script cũ (trước khi add-on được cập nhật/tải lại) tự tắt khi bản mới chạy
  document.dispatchEvent(new CustomEvent('ielts-lexi-takeover'));
  let dead = false;
  const alive = () => { try { return !dead && !!chrome.runtime.id; } catch (e) { return false; } };
  document.addEventListener('ielts-lexi-takeover', () => { dead = true; if (host) host.remove(); });

  let host = null, root = null, enabled = true, selectMode = 'icon', current = null;
  const applySettings = st => { st = st || {}; enabled = st.dblclickOn !== false; selectMode = st.selectMode || 'icon'; };
  chrome.storage.local.get('settings').then(r => applySettings(r.settings));
  chrome.storage.onChanged.addListener(ch => { if (ch.settings) applySettings(ch.settings.newValue); });

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const CSS = `
    :host { all: initial; }
    .box { position: fixed; z-index: 2147483647; width: 380px; max-width: calc(100vw - 16px); background: #fff; color: #1c1d2b;
      border: 1px solid #e3e5ef; border-radius: 16px; box-shadow: 0 12px 40px rgba(20,20,50,.22); font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      overflow: hidden; animation: pop .14s ease-out; }
    @keyframes pop { from { opacity: 0; transform: translateY(6px) scale(.98); } }
    .head { display: flex; gap: 12px; padding: 14px 14px 10px; }
    .pic { width: 64px; height: 64px; flex: none; border-radius: 12px; background: #f1f2f8; display: grid; place-items: center; font-size: 32px; overflow: hidden; }
    .pic img { width: 100%; height: 100%; object-fit: cover; }
    .w { font-size: 20px; font-weight: 800; }
    .chip { display: inline-block; padding: 0 7px; margin-left: 4px; border-radius: 99px; background: #f1f2f8; color: #6b6f85; font-size: 11px; vertical-align: middle; }
    .lv { background: #eceafe; color: #4f46e5; font-weight: 700; }
    .ipa { color: #6b6f85; font-family: "Lucida Sans Unicode", "Arial Unicode MS", sans-serif; }
    .spk { border: 0; background: #f1f2f8; border-radius: 50%; width: 26px; height: 26px; cursor: pointer; font-size: 12px; vertical-align: middle; }
    .spk:hover { background: #eceafe; }
    .vi { color: #0e8f8e; font-weight: 700; font-size: 15px; margin-top: 2px; }
    .body { padding: 0 14px 12px; max-height: 340px; overflow: auto; }
    .def { margin: 4px 0; }
    .ex { color: #6b6f85; font-style: italic; font-size: 13px; }
    .ctx { margin-top: 8px; padding: 8px 10px; background: #fff8e6; border-radius: 10px; font-size: 13px; }
    .ctx b { font-style: normal; }
    mark { background: #fde68a; color: inherit; border-radius: 3px; padding: 0 2px; }
    .foot { display: flex; gap: 8px; padding: 10px 14px; border-top: 1px solid #eef0f6; background: #fafbfe; align-items: center; }
    .btn { border: 1px solid #e3e5ef; background: #fff; border-radius: 10px; padding: 7px 12px; font: 600 13px/1 inherit; font-family: inherit; cursor: pointer; color: #1c1d2b; }
    .btn.p { background: #4f46e5; border-color: #4f46e5; color: #fff; }
    .btn[disabled] { opacity: .6; cursor: default; }
    .x { margin-left: auto; border: 0; background: none; font-size: 18px; cursor: pointer; color: #6b6f85; }
    .muted { color: #6b6f85; padding: 18px 14px; }
    .fab { position: fixed; z-index: 2147483647; width: 34px; height: 34px; border-radius: 50%; border: 0; cursor: pointer;
      background: linear-gradient(135deg, #4f46e5, #0ea5a4); color: #fff; font-size: 16px; display: grid; place-items: center;
      box-shadow: 0 6px 18px rgba(79,70,229,.45); animation: pop .12s ease-out; }
    .fab:hover { transform: scale(1.08); }
    .fab[hidden], .box[hidden] { display: none; }
    .tr-head { display: flex; gap: 8px; align-items: center; padding: 12px 14px 8px; }
    .src { color: #6b6f85; font-size: 13px; margin-bottom: 10px; max-height: 120px; overflow: auto; border-left: 3px solid #e3e5ef; padding-left: 8px; }
    .tr { font-size: 15.5px; line-height: 1.55; color: inherit; font-weight: 500; }
    @media (prefers-color-scheme: dark) {
      .box { background: #1b1c26; color: #ecedf5; border-color: #2e3040; }
      .pic, .spk, .chip { background: #242533; } .foot { background: #171821; border-color: #2e3040; }
      .btn { background: #242533; border-color: #2e3040; color: #ecedf5; } .ctx { background: #2b2618; }
      .vi { color: #2dd4bf; } .lv { background: #2a2850; color: #8b85ff; }
    }`;

  function ensureHost() {
    const parent = document.fullscreenElement || document.documentElement;
    if (host && host.parentNode === parent) return;
    if (host) { parent.appendChild(host); return; }
    host = document.createElement('ielts-lexi-popup');
    root = host.attachShadow({ mode: 'closed' });
    root.innerHTML = `<style>${CSS}</style><div class="box" hidden></div><button class="fab" hidden title="Dịch với Vocaband">🌐</button>`;
    parent.appendChild(host);
    root.addEventListener('mousedown', e => e.stopPropagation());
  }
  const box = () => root.querySelector('.box');
  let onHide = null;
  const hide = () => { if (root) box().hidden = true; current = null; if (onHide) { const f = onHide; onHide = null; f(); } };
  const hideFab = () => { if (root) root.querySelector('.fab').hidden = true; };

  function position(rect) {
    const b = box();
    const W = Math.min(380, window.innerWidth - 16);
    let left = Math.min(Math.max(8, rect.left + rect.width / 2 - W / 2), window.innerWidth - W - 8);
    let top = rect.bottom + 10;
    b.style.left = left + 'px';
    b.style.top = top + 'px';
    requestAnimationFrame(() => {
      const h = b.offsetHeight;
      if (top + h > window.innerHeight - 8) b.style.top = Math.max(8, rect.top - h - 10) + 'px';
    });
  }

  // Lấy câu chứa từ được chọn → ngữ cảnh
  function sentenceAround(range) {
    try {
      let node = range.startContainer;
      let el = node.nodeType === 1 ? node : node.parentElement;
      const block = el.closest('p,li,td,th,dd,dt,blockquote,figcaption,caption,h1,h2,h3,h4,h5,h6,article,section,div') || el;
      const pre = document.createRange();
      pre.setStart(block, 0);
      pre.setEnd(range.startContainer, range.startOffset);
      const offset = pre.toString().length;
      const text = block.textContent;
      let s = offset, e = offset;
      while (s > 0 && !/[.!?\n]/.test(text[s - 1])) s--;
      while (e < text.length && !/[.!?\n]/.test(text[e])) e++;
      let sent = text.slice(s, Math.min(text.length, e + 1)).replace(/\s+/g, ' ').trim();
      if (sent.length > 320) {
        const local = offset - s;
        sent = '…' + sent.slice(Math.max(0, local - 150), local + 150).trim() + '…';
      }
      return sent.split(' ').length >= 3 ? sent : '';
    } catch (e) { return ''; }
  }

  function wordRegex(word) {
    const w = word.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const stem = w.length > 4 && !w.includes(' ') ? w.replace(/(e|y|s)$/, '') : w;
    return new RegExp(`\\b(${stem}[a-z]*)\\b`, 'gi');
  }

  function speak(word, url, accent) {
    const tts = () => { const u = new SpeechSynthesisUtterance(word); u.lang = accent || 'en-GB'; u.rate = .9; speechSynthesis.cancel(); speechSynthesis.speak(u); };
    if (url) { const a = new Audio(url); a.play().catch(tts); } else tts();
  }

  async function show(word, rect, context, meta) {
    meta = meta || { source: location.href, title: document.title };
    ensureHost();
    hideFab();
    const b = box();
    b.hidden = false;
    b.innerHTML = `<div class="muted">⏳ Đang tra “${esc(word)}”…</div>`;
    position(rect);
    current = word;
    let res;
    try { res = await chrome.runtime.sendMessage({ type: 'lookup', word }); }
    catch (e) { b.innerHTML = '<div class="muted">Add-on vừa được cập nhật – hãy tải lại trang.</div>'; return; }
    if (current !== word) return;
    const e = res && res.entry;
    if (!e || !e.found) {
      b.innerHTML = `<div class="muted">Không tìm thấy “${esc(word)}”.${e && e.vi ? `<br>Dịch: <b>${esc(e.vi)}</b>` : ''}</div>`;
      return;
    }
    const settings = (await chrome.storage.local.get('settings')).settings || {};
    const accent = settings.accent || 'en-GB';
    const audioFor = acc => acc === 'en-US' ? (e.audioUS || e.audio) : e.audio;
    const defs = (e.meanings || []).slice(0, 2).map(m => `<div class="def"><span class="chip">${esc(m.pos)}</span> ${esc(m.defs[0] && m.defs[0].def)}</div>`).join('');
    const ctxHtml = context ? esc(context).replace(wordRegex(word), '<mark>$1</mark>') : '';

    b.innerHTML = `
      <div class="head">
        <div class="pic">${e.image ? `<img src="${esc(e.image)}" alt="" referrerpolicy="no-referrer">` : esc(e.emoji || '📘')}</div>
        <div>
          <div><span class="w">${esc(e.word)}</span>${e.pos ? `<span class="chip">${esc(e.pos)}</span>` : ''}${e.level ? `<span class="chip lv">${esc(e.level)}</span>` : ''}</div>
          <div><span class="ipa">${esc(e.ipa)}</span> <button class="spk" data-acc="en-GB" title="Anh–Anh">🇬🇧</button> <button class="spk" data-acc="en-US" title="Anh–Mỹ">🇺🇸</button></div>
          <div class="vi">${esc(e.vi)}</div>
        </div>
      </div>
      <div class="body">
        ${e.def && !defs ? `<div class="def">${esc(e.def)}</div>` : defs}
        ${e.ex ? `<div class="ex">“${esc(e.ex)}”</div>` : ''}
        ${(e.senses || []).length ? `<div class="def">${e.senses.slice(0, 3).map(x => `<span class="chip">${esc(x.pos)}</span> ${esc(x.terms.slice(0, 4).join(', '))}`).join('<br>')}</div>` : ''}
        ${ctxHtml ? `<div class="ctx"><b>📌 Ngữ cảnh sẽ lưu:</b><br>${ctxHtml}<div class="ctxvi ex" style="margin-top:4px">⏳ Đang dịch câu…</div></div>` : ''}
      </div>
      <div class="foot">
        <button class="btn p" id="save" ${res.saved && !context ? 'disabled' : ''}>${res.saved ? (context ? '+ Thêm ngữ cảnh' : '✓ Đã lưu') : '+ Lưu flashcard'}</button>
        <button class="btn" id="more">Chi tiết</button>
        <button class="x" id="close" title="Đóng (Esc)">×</button>
      </div>`;
    const img = b.querySelector('.pic img');
    if (img) img.onerror = () => { img.parentElement.textContent = e.emoji || '📘'; };
    b.querySelectorAll('.spk').forEach(s => s.onclick = () => speak(e.word, audioFor(s.dataset.acc), s.dataset.acc));
    b.querySelector('#close').onclick = hide;
    b.querySelector('#more').onclick = () => chrome.runtime.sendMessage({ type: 'openApp', hash: '#/dict/' + encodeURIComponent(e.word) });
    b.querySelector('#save').onclick = async ev => {
      const btn = ev.currentTarget;
      btn.disabled = true;
      const { meanings, oxford, senses, found, audioUS, ...entry } = e;
      await chrome.runtime.sendMessage({ type: 'save', entry: { ...entry, audio: audioFor(accent) }, context: context ? { text: context, vi: ctxVi, source: meta.source, title: meta.title } : null });
      btn.textContent = '✓ Đã lưu vào flashcard';
    };
    let ctxVi = '';
    if (context) chrome.runtime.sendMessage({ type: 'translate', text: context }).then(r => {
      ctxVi = (r && r.vi) || '';
      const el = b.querySelector('.ctxvi');
      if (el && current === word) el.textContent = ctxVi ? '🇻🇳 ' + ctxVi : '';
    }).catch(() => {});
    position(rect);
    if (settings.autoSpeak !== false) speak(e.word, audioFor(accent), accent);
  }

  function fromSelection() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const text = sel.toString().trim();
    if (!text || text.length > 40 || !/^[A-Za-z][A-Za-z'\- ]*[A-Za-z]$/.test(text) || text.split(/\s+/).length > 3) return null;
    const range = sel.getRangeAt(0);
    return { word: text.toLowerCase(), rect: range.getBoundingClientRect(), context: sentenceAround(range) };
  }

  // ---------- Dịch câu / đoạn văn: bôi đen → nút 🌐 (hoặc tự dịch) ----------
  const isWordish = t => t.length <= 40 && /^[A-Za-z][A-Za-z'\- ]*[A-Za-z]$/.test(t) && t.split(/\s+/).length <= 3;
  const inEditable = el => el && el.closest && el.closest('input, textarea, [contenteditable="true"], [contenteditable=""]');

  function selectionInfo() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
    const text = sel.toString().replace(/\s+/g, ' ').trim();
    if (!text || text.length > 3000 || !/[A-Za-z]{2}/.test(text)) return null;
    const range = sel.getRangeAt(0);
    return { text, range, rect: range.getBoundingClientRect() };
  }

  function showFab(info) {
    ensureHost();
    const f = root.querySelector('.fab');
    const rects = info.range.getClientRects();
    const last = rects[rects.length - 1] || info.rect;
    f.style.left = Math.min(window.innerWidth - 44, last.right + 6) + 'px';
    f.style.top = Math.min(window.innerHeight - 44, last.bottom + 6) + 'px';
    f.hidden = false;
    f.onclick = () => {
      f.hidden = true;
      if (isWordish(info.text)) show(info.text.toLowerCase(), info.rect, sentenceAround(info.range));
      else translateSelection(info);
    };
  }

  async function translateSelection(info) {
    ensureHost();
    hideFab();
    const b = box();
    b.hidden = false;
    current = info.text;
    b.innerHTML = '<div class="muted">⏳ Đang dịch…</div>';
    position(info.rect);
    let r;
    try { r = await chrome.runtime.sendMessage({ type: 'translate', text: info.text }); }
    catch (e) { b.innerHTML = '<div class="muted">Add-on vừa được cập nhật – hãy tải lại trang.</div>'; return; }
    if (current !== info.text) return;
    const vi = (r && r.vi) || '';
    const st = (await chrome.storage.local.get('settings')).settings || {};
    const accent = st.accent || 'en-GB';
    b.innerHTML = `
      <div class="tr-head"><b>🌐 Dịch đoạn đã chọn</b><span class="chip">Anh → Việt</span><button class="x" id="close" title="Đóng (Esc)">×</button></div>
      <div class="body">
        <div class="src">${esc(info.text)}</div>
        <div class="tr">${vi ? esc(vi) : 'Không dịch được đoạn này.'}</div>
      </div>
      <div class="foot">
        <button class="btn p" id="listen">🔊 Nghe</button>
        <button class="btn" id="slow">🐢 Chậm</button>
        <button class="btn" id="copy">📋 Sao chép</button>
      </div>`;
    const say = rate => { const u = new SpeechSynthesisUtterance(info.text); u.lang = accent; u.rate = rate; speechSynthesis.cancel(); speechSynthesis.speak(u); };
    b.querySelector('#close').onclick = () => { speechSynthesis.cancel(); hide(); };
    b.querySelector('#listen').onclick = () => say(.95);
    b.querySelector('#slow').onclick = () => say(.6);
    b.querySelector('#copy').onclick = async ev => {
      try { await navigator.clipboard.writeText(vi); ev.currentTarget.textContent = '✓ Đã chép'; } catch (e) { /* trang chặn clipboard */ }
    };
    position(info.rect);
  }

  const fromHost = e => host && e.composedPath && e.composedPath().includes(host);

  document.addEventListener('dblclick', e => {
    if (!alive() || !enabled || inEditable(e.target) || fromHost(e)) return;
    const s = fromSelection();
    if (s) show(s.word, s.rect, s.context);
  });
  document.addEventListener('mouseup', e => {
    if (!alive() || fromHost(e) || e.button !== 0 || inEditable(e.target)) return;
    // Đợi trình duyệt cập nhật vùng chọn
    setTimeout(() => {
      if (e.altKey) { const s = fromSelection(); if (s && enabled) show(s.word, s.rect, s.context); return; }
      if (e.detail >= 2 || selectMode === 'off') return; // bấm đúp do dblclick xử lý
      const info = selectionInfo();
      if (!info) return;
      if (selectMode === 'auto' && !isWordish(info.text)) translateSelection(info);
      else showFab(info);
    }, 10);
  });
  document.addEventListener('mousedown', e => {
    if (!alive() || fromHost(e)) return;
    if (root) { hideFab(); if (!box().hidden) hide(); }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && root) { hide(); hideFab(); } });
  window.addEventListener('scroll', () => { if (root) { hideFab(); } }, { passive: true });


  // ---------- YouTube: chạm vào từ trong phụ đề để tra, video tự dừng ----------
  function initYouTube() {
    const st = document.createElement('style');
    st.textContent = `
      .ytp-caption-segment .vbw { cursor: pointer; border-radius: 4px; transition: background .1s; }
      .ytp-caption-segment .vbw:hover { background: #7c3aed !important; color: #fff !important; }
      .ytp-caption-window-container .caption-window { pointer-events: auto !important; }`;
    document.documentElement.appendChild(st);
    const video = () => document.querySelector('video.html5-main-video') || document.querySelector('video');
    let pausedByUs = false;
    const resume = () => { const v = video(); if (pausedByUs && v && v.paused) v.play(); pausedByUs = false; };
    const pause = () => { const v = video(); if (v && !v.paused) { v.pause(); pausedByUs = true; } };

    const wrap = seg => {
      const t = seg.textContent;
      if (!t || seg.dataset.vb === t) return;
      seg.innerHTML = t.split(/(\s+)/).map(tok => /[A-Za-z]/.test(tok) ? `<span class="vbw">${esc(tok)}</span>` : esc(tok)).join('');
      seg.dataset.vb = seg.textContent;
    };
    const scan = () => document.querySelectorAll('.ytp-caption-segment').forEach(wrap);
    const obs = new MutationObserver(() => { if (!alive()) return obs.disconnect(); if (enabled) scan(); });
    (function attach() {
      const p = document.querySelector('#movie_player');
      if (p) obs.observe(p, { subtree: true, childList: true, characterData: true }); else setTimeout(attach, 1000);
    })();

    // Di chuột vào phụ đề → tạm dừng để đọc; rời đi → chạy tiếp
    document.addEventListener('mouseover', e => {
      if (!alive() || !enabled || !e.target.closest) return;
      if (e.target.closest('.ytp-caption-window-container .caption-window')) pause();
    }, true);
    document.addEventListener('mouseout', e => {
      if (!alive() || !e.target.closest || !e.target.closest('.caption-window')) return;
      const to = e.relatedTarget;
      if (to && to.closest && to.closest('.caption-window')) return;
      if (root && !box().hidden) return; // đang xem bảng tra
      resume();
    }, true);
    // Chặn YouTube kéo khung phụ đề / dừng-phát khi bấm vào từ
    ['mousedown', 'mouseup', 'dblclick'].forEach(t => document.addEventListener(t, e => {
      if (e.target.closest && e.target.closest('.ytp-caption-segment .vbw')) e.stopPropagation();
    }, true));
    document.addEventListener('click', e => {
      const w = e.target.closest && e.target.closest('.ytp-caption-segment .vbw');
      if (!w || !alive() || !enabled) return;
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      pause();
      const word = w.textContent.replace(/[’]/g, "'").replace(/[^A-Za-z'-]/g, '').replace(/^'+|'+$/g, '').toLowerCase();
      if (!word) return;
      const line = [...document.querySelectorAll('.ytp-caption-segment')].map(x => x.textContent).join(' ').replace(/\s+/g, ' ').trim();
      const v = video(), t = v ? Math.floor(v.currentTime) : 0;
      const u = new URL(location.href); u.searchParams.set('t', t + 's');
      show(word, w.getBoundingClientRect(), line.split(' ').length >= 3 ? line : '', { source: u.toString(), title: '▶️ ' + document.title.replace(/ - YouTube$/, '') + ` (${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')})` });
      onHide = resume;
    }, true);
    document.addEventListener('fullscreenchange', () => { if (root && !box().hidden) hide(); });
  }
  if (/(^|\.)youtube\.com$/.test(location.hostname)) initYouTube();

  chrome.runtime.onMessage.addListener(msg => {
    if (!alive()) return;
    if (msg.type === 'translateSelection') { const info = selectionInfo(); if (info) translateSelection(info); return; }
    if (msg.type !== 'showLookup') return;
    const sel = window.getSelection();
    const range = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
    const rect = range ? range.getBoundingClientRect() : { left: window.innerWidth / 2, top: 80, bottom: 80, width: 0 };
    show(msg.word.trim().toLowerCase(), rect, range ? sentenceAround(range) : '');
  });
})();
