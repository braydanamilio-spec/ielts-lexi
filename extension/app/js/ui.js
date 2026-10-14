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
  const highlight = (text, word) => esc(text).replace(wordRegex(word), '<mark>$1</mark>');
  const cloze = (text, word) => esc(text).replace(wordRegex(word), '<span class="blank"></span>');
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

  function modal(html) {
    $('#modalBox').innerHTML = html;
    $('#modal').hidden = false;
    return $('#modalBox');
  }
  const closeModal = () => { $('#modal').hidden = true; };
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
  let audioEl = null;
  function tts(text, accent = 'en-GB', rate = 0.92) {
    if (!('speechSynthesis' in g)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = accent; u.rate = rate;
    const vs = speechSynthesis.getVoices();
    const v = vs.find(v => v.lang === accent && /Google|Daniel|Serena|Samantha|Natural/i.test(v.name)) || vs.find(v => v.lang === accent) || vs.find(v => v.lang.startsWith('en'));
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  }
  function speak(text, accent, url) {
    if (url) {
      try { audioEl && audioEl.pause(); audioEl = new Audio(url); audioEl.play().catch(() => tts(text, accent)); return; } catch (e) { /* dùng TTS */ }
    }
    tts(text, accent);
  }
  if ('speechSynthesis' in g) { speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices(); }

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

  g.UI = { $, $$, esc, shuffle, wordRegex, highlight, cloze, clozeAnswer, similarity, toast, modal, closeModal, xpFloat, speak, tts, pic, levelChip, posChip, masteryDots, ring, download };
})(typeof self !== 'undefined' ? self : this);
