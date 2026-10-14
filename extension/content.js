/* Content script: bấm đúp vào từ (hoặc bôi đen + Alt) để tra nhanh, lưu vào flashcard kèm câu ngữ cảnh. */
(() => {
  if (window.__ieltsLexi) return;
  window.__ieltsLexi = true;

  let host = null, root = null, enabled = true, current = null;
  chrome.storage.local.get('settings').then(r => { enabled = !(r.settings && r.settings.dblclickOn === false); });
  chrome.storage.onChanged.addListener(ch => { if (ch.settings) enabled = !(ch.settings.newValue && ch.settings.newValue.dblclickOn === false); });

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const CSS = `
    :host { all: initial; }
    .box { position: fixed; z-index: 2147483647; width: 340px; max-width: calc(100vw - 16px); background: #fff; color: #1c1d2b;
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
    .body { padding: 0 14px 12px; max-height: 220px; overflow: auto; }
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
    @media (prefers-color-scheme: dark) {
      .box { background: #1b1c26; color: #ecedf5; border-color: #2e3040; }
      .pic, .spk, .chip { background: #242533; } .foot { background: #171821; border-color: #2e3040; }
      .btn { background: #242533; border-color: #2e3040; color: #ecedf5; } .ctx { background: #2b2618; }
      .vi { color: #2dd4bf; } .lv { background: #2a2850; color: #8b85ff; }
    }`;

  function ensureHost() {
    if (host && document.documentElement.contains(host)) return;
    host = document.createElement('ielts-lexi-popup');
    root = host.attachShadow({ mode: 'closed' });
    root.innerHTML = `<style>${CSS}</style><div class="box" hidden></div>`;
    document.documentElement.appendChild(host);
    root.addEventListener('mousedown', e => e.stopPropagation());
  }
  const box = () => root.querySelector('.box');
  const hide = () => { if (root) box().hidden = true; current = null; };

  function position(rect) {
    const b = box();
    const W = Math.min(340, window.innerWidth - 16);
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

  async function show(word, rect, context) {
    ensureHost();
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
      await chrome.runtime.sendMessage({ type: 'save', entry: { ...entry, audio: audioFor(accent) }, context: context ? { text: context, vi: ctxVi, source: location.href, title: document.title } : null });
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

  document.addEventListener('dblclick', e => {
    if (!enabled || e.target.closest && e.target.closest('input, textarea, [contenteditable="true"]')) return;
    const s = fromSelection();
    if (s) show(s.word, s.rect, s.context);
  });
  // Bôi đen cụm từ rồi giữ Alt khi thả chuột (ví dụ: “life expectancy”)
  document.addEventListener('mouseup', e => {
    if (!enabled || !e.altKey) return;
    const s = fromSelection();
    if (s) show(s.word, s.rect, s.context);
  });
  document.addEventListener('mousedown', () => { if (root && !box().hidden) hide(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hide(); });
  window.addEventListener('scroll', () => { if (root && !box().hidden) hide(); }, { passive: true });

  chrome.runtime.onMessage.addListener(msg => {
    if (msg.type !== 'showLookup') return;
    const sel = window.getSelection();
    const range = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
    const rect = range ? range.getBoundingClientRect() : { left: window.innerWidth / 2, top: 80, bottom: 80, width: 0 };
    show(msg.word.trim().toLowerCase(), rect, range ? sentenceAround(range) : '');
  });
})();
