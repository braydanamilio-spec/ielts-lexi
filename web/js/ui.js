/* Tiện ích giao diện dùng chung. */
(function (g) {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // Bắt cả dạng biến đổi: recruit → recruited/recruiting; cụm từ: so khớp nguyên cụm
  function wordRegex(word) {
    const w = word.toLowerCase().trim();
    if (/[\s-]/.test(w)) {
      // cụm động từ/thành ngữ: cho phép biến đổi ở từ đầu (cut down on → cutting down on)
      const parts = w.split(/\s+/);
      const first = parts[0].length > 3 ? reEsc(parts[0].replace(/(e|y)$/, '')) + '[a-z]*' : reEsc(parts[0]);
      return new RegExp(`\\b(${[first, ...parts.slice(1).map(reEsc)].join('\\s+')})\\b`, 'gi');
    }
    const stem = w.length > 4 ? w.replace(/(e|y|s)$/, '') : w;
    return new RegExp(`\\b(${reEsc(stem)}[a-z]*)\\b`, 'gi');
  }
  // So khớp trên văn bản gốc rồi mới mã hóa từng đoạn (tránh khớp nhầm vào &quot; / &#39;)
  function wrapMatches(text, word, fn) {
    const t = String(text || '');
    let out = '', i = 0;
    for (const m of t.matchAll(wordRegex(word))) { out += esc(t.slice(i, m.index)) + fn(esc(m[0])); i = m.index + m[0].length; }
    return out + esc(t.slice(i));
  }
  const highlight = (text, word) => wrapMatches(text, word, s => `<mark>${s}</mark>`);
  const cloze = (text, word) => wrapMatches(text, word, () => '<span class="blank"></span>');
  const clozeAnswer = (text, word) => ((text || '').match(wordRegex(word)) || [word])[0];

  // Độ giống nhau 0..1 (Levenshtein)
  function similarity(a, b) {
    a = a.toLowerCase().replace(/[^a-z ]/g, '').trim(); b = b.toLowerCase().replace(/[^a-z ]/g, '').trim();
    if (!a.length && !b.length) return 1;
    const m = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) m[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return 1 - m[a.length][b.length] / Math.max(a.length, b.length);
  }

  function toast(msg, ms = 2400) {
    const t = $('#toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), ms);
  }

  let lastFocus = null;
  function modal(html) {
    lastFocus = document.activeElement;
    const box = $('#modalBox');
    box.innerHTML = html;
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.tabIndex = -1;
    $('#modal').hidden = false;
    (box.querySelector('input, textarea, button.primary, button, a') || box).focus();
    return box;
  }
  const closeModal = () => { if ($('#modal').hidden) return; $('#modal').hidden = true; if (lastFocus && lastFocus.focus) lastFocus.focus(); };
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#modal').hidden) closeModal(); });
  document.addEventListener('click', e => {
    if (e.target.id === 'modal' || (e.target.closest && e.target.closest('[data-close]'))) closeModal();
  });

  // +XP bay lên tại vị trí phần tử
  function xpFloat(n, el) {
    if (!n) return;
    const r = el ? el.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 0 };
    const d = document.createElement('div');
    d.className = 'xp-float'; d.textContent = `+${n} XP`;
    d.style.left = (r.left + r.width / 2 - 30) + 'px'; d.style.top = (r.top - 10) + 'px';
    document.body.appendChild(d); setTimeout(() => d.remove(), 1000);
  }

  // ---------- Phát âm ----------
  // Xếp hạng giọng đọc: ưu tiên giọng neural/tự nhiên, rồi giọng chất lượng cao của hệ điều hành
  function voiceScore(v, accent) {
    let s = 0;
    const n = v.name;
    if (v.lang === accent || v.lang.replace('_', '-') === accent) s += 100; else if (v.lang.startsWith('en')) s += 10; else return -1;
    if (/Natural|Neural|Online/i.test(n)) s += 60;                       // Edge: Microsoft Sonia/Ryan/Libby Online (Natural)
    if (/^Google (UK|US) English/i.test(n)) s += 50;                       // Chrome
    if (/Premium|Enhanced|Siri/i.test(n)) s += 45;                         // macOS/iOS giọng tải thêm
    if (/Daniel|Serena|Kate|Oliver|Arthur|Martha|Samantha|Ava|Evan|Zoe|Allison|Tom|Susan/i.test(n)) s += 20;
    if (/Fred|Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Wobble|Zarvox|Trinoids|Whisper|Junior|Ralph|Kathy|Jester|Organ|Superstar|Grandma|Grandpa|Eddy|Flo|Reed|Rocko|Sandy|Shelley/i.test(n)) s -= 200; // giọng hiệu ứng
    if (v.localService === false) s += 5;
    return s;
  }
  function voicesFor(accent) {
    if (!('speechSynthesis' in g)) return [];
    return speechSynthesis.getVoices().map(v => ({ v, s: voiceScore(v, accent) })).filter(x => x.s > 0).sort((a, b) => b.s - a.s).map(x => x.v);
  }
  const prefs = () => (g.App && g.App.state && g.App.state.settings) || {};
  function pickVoice(accent) {
    const want = prefs().voice && prefs().voice[accent];
    const list = voicesFor(accent);
    return (want && list.find(v => v.name === want)) || list[0] || null;
  }
  // Tách đoạn dài thành câu (giữ ngữ điệu tự nhiên, tránh Chrome cắt khi > ~15 giây)
  function splitSentences(text) {
    const parts = String(text).replace(/\s+/g, ' ').match(/[^.!?;:]+[.!?;:]+["”’)]*|[^.!?;:]+$/g) || [text];
    const out = [];
    for (let p of parts) {
      p = p.trim(); if (!p) continue;
      while (p.length > 220) { const cut = p.lastIndexOf(',', 200) > 60 ? p.lastIndexOf(',', 200) + 1 : p.lastIndexOf(' ', 200); out.push(p.slice(0, cut).trim()); p = p.slice(cut).trim(); }
      out.push(p);
    }
    return out;
  }
  let speakSeq = 0;
  // opts: { rate, onSentence(i, text), onEnd() }
  function tts(text, accent = 'en-GB', rate, opts = {}) {
    if (!('speechSynthesis' in g) || !text) return;
    const my = ++speakSeq;
    speechSynthesis.cancel();
    const voice = pickVoice(accent);
    const base = rate || prefs().ttsRate || 0.92;
    const parts = splitSentences(text);
    // Chrome đôi khi "treo" sau cancel → resume định kỳ khi đọc đoạn dài
    const keep = parts.length > 1 ? setInterval(() => { if (speechSynthesis.speaking) { speechSynthesis.pause(); speechSynthesis.resume(); } }, 10000) : null;
    parts.forEach((p, i) => {
      const u = new SpeechSynthesisUtterance(p);
      u.lang = accent; u.rate = base; u.pitch = 1;
      if (voice) u.voice = voice;
      u.onstart = () => { if (my === speakSeq && opts.onSentence) opts.onSentence(i, p); };
      if (i === parts.length - 1) u.onend = u.onerror = () => { if (keep) clearInterval(keep); if (my === speakSeq && opts.onEnd) opts.onEnd(); };
      speechSynthesis.speak(u);
    });
  }
  const stopSpeak = () => { speakSeq++; if ('speechSynthesis' in g) speechSynthesis.cancel(); if (audioEl) audioEl.pause(); };
  // Từ đơn: ưu tiên bản ghi giọng người thật; câu: giọng tổng hợp tốt nhất
  let audioEl = null;
  function speak(text, accent, url) {
    accent = accent || prefs().accent || 'en-GB';
    if (url) {
      try {
        stopSpeak();
        audioEl = new Audio(url);
        audioEl.playbackRate = 1;
        audioEl.play().catch(() => tts(text, accent));
        return;
      } catch (e) { /* dùng TTS */ }
    }
    tts(text, accent);
  }
  if ('speechSynthesis' in g) { speechSynthesis.getVoices(); speechSynthesis.addEventListener && speechSynthesis.addEventListener('voiceschanged', () => speechSynthesis.getVoices()); }

  const pic = (c, cls = 'pic') => `<div class="${cls}">${c.image ? `<img src="${esc(c.image)}" alt="${esc(c.word)}" loading="lazy" referrerpolicy="no-referrer">` : esc(c.emoji || '📘')}</div>`;
  const levelChip = l => l ? `<span class="chip lv ${esc(l)}">${esc(l)}</span>` : '';
  const posChip = p => p ? `<span class="chip pos">${esc(p)}</span>` : '';
  const masteryDots = (s, SRS) => { const m = SRS.mastery(s); return `<span class="mastery" title="Mức thuộc">${[1, 2, 3].map(i => `<i class="${i <= m ? 'on' : ''}"></i>`).join('')}</span>`; };
  const ring = (pct, label, color) => `<div class="ring" style="--p:${Math.round(pct)};${color ? `--c:${color}` : ''}"><b>${label}</b></div>`;

  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  g.UI = { $, $$, esc, shuffle, wordRegex, highlight, cloze, clozeAnswer, similarity, toast, modal, closeModal, xpFloat, speak, tts, stopSpeak, voicesFor, pickVoice, splitSentences, pic, levelChip, posChip, masteryDots, ring, download };
})(typeof self !== 'undefined' ? self : this);
