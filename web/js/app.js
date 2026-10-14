/* IELTS Lexi – ứng dụng chính (web app + trang trong add-on). */
(function () {
  const { Store, SRS, Cards, Stats, DEFAULT_SETTINGS, todayKey, endOfToday, DAY } = Core;
  const { TOPICS, INDEX } = IELTS_DATA;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const view = $('#view');

  const state = { cards: {}, settings: { ...DEFAULT_SETTINGS }, stats: { days: {}, newToday: { day: '', n: 0 } } };

  // ---------- Tiện ích ----------
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const allSeed = () => TOPICS.flatMap(t => t.words);
  const topicOf = id => TOPICS.find(t => t.id === id);

  // Regex bắt cả dạng biến đổi của từ: recruit → recruited, recruiting...
  function wordRegex(word) {
    const w = word.toLowerCase();
    if (w.includes(' ') || w.includes('-')) return new RegExp(`\\b(${reEsc(w)})\\b`, 'gi');
    const stem = w.length > 4 ? w.replace(/(e|y|s)$/, '') : w;
    return new RegExp(`\\b(${reEsc(stem)}[a-z]*)\\b`, 'gi');
  }
  const highlight = (text, word) => esc(text).replace(wordRegex(word), '<mark>$1</mark>');

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2200);
  }

  function modal(html) {
    $('#modalBox').innerHTML = html;
    $('#modal').hidden = false;
  }
  const closeModal = () => { $('#modal').hidden = true; };
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal' || e.target.closest('[data-close]')) closeModal(); });

  // ---------- Phát âm ----------
  let audioEl = null;
  function speak(text, accent = state.settings.accent, url = '') {
    if (url) {
      try { audioEl && audioEl.pause(); audioEl = new Audio(url); audioEl.play().catch(() => tts(text, accent)); return; } catch (e) { /* fallthrough */ }
    }
    tts(text, accent);
  }
  function tts(text, accent) {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = accent; u.rate = 0.9;
    const v = speechSynthesis.getVoices().find(v => v.lang === accent) || speechSynthesis.getVoices().find(v => v.lang.startsWith('en'));
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  }
  if ('speechSynthesis' in window) speechSynthesis.getVoices();

  const pic = (c, cls = 'pic') => `<div class="${cls}">${c.image ? `<img src="${esc(c.image)}" alt="${esc(c.word)}" loading="lazy" referrerpolicy="no-referrer">` : esc(c.emoji || '📘')}</div>`;
  const levelChip = l => l ? `<span class="chip lv">${esc(l)}</span>` : '';
  const posChip = p => p ? `<span class="chip pos">${esc(p)}</span>` : '';
  const masteryDots = s => { const m = SRS.mastery(s); return `<span class="mastery" title="Mức thuộc">${[1, 2, 3].map(i => `<i class="${i <= m ? 'on' : ''}"></i>`).join('')}</span>`; };

  // ---------- Dữ liệu ----------
  async function load() {
    state.cards = await Cards.all();
    state.settings = { ...DEFAULT_SETTINGS, ...(await Store.get('settings', {})) };
    state.stats = await Stats.get();
    updateChrome();
  }
  async function saveSettings() { await Store.set('settings', state.settings); }

  function updateChrome() {
    $('#streak').textContent = `🔥 ${Stats.streak(state.stats)}`;
    const { total } = Cards.dueCount(state.cards, state.settings, state.stats);
    const b = $('#dueBadge');
    b.hidden = !total; b.textContent = total;
  }

  async function addWord(entry, context) {
    const card = await Cards.add(entry, context);
    state.cards[card.word.toLowerCase()] = card;
    updateChrome();
    // Lấy hình minh họa từ Wikipedia nếu thẻ chưa có
    if (!card.image && navigator.onLine) {
      Dict.wikiImage(card.word).then(async img => {
        if (!img) return;
        card.image = img; await Cards.update(card); state.cards[card.word.toLowerCase()] = card;
      });
    }
    return card;
  }
  const inDeck = w => !!state.cards[w.toLowerCase()];

  // ---------- Router ----------
  const routes = { home: renderHome, dict: renderDict, topics: renderTopics, topic: renderTopic, review: renderReview, practice: renderPractice, deck: renderDeck, settings: renderSettings };
  function route() {
    const [name, arg] = (location.hash.replace(/^#\/?/, '') || 'home').split('/');
    const fn = routes[name] || renderHome;
    $$('#nav a').forEach(a => a.classList.toggle('active', a.dataset.route === (name === 'topic' ? 'topics' : name)));
    if (window.speechSynthesis) speechSynthesis.cancel();
    document.onkeydown = null;
    fn(decodeURIComponent(arg || ''));
    view.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);
  // Bấm link trỏ tới đúng trang hiện tại (vd. “← Chọn chế độ” trong Luyện tập) vẫn phải vẽ lại
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#/"]');
    if (a && a.getAttribute('href') === location.hash) { e.preventDefault(); route(); }
  });

  // ================= TRANG CHỦ =================
  function renderHome() {
    const cards = Object.values(state.cards);
    const { due, newCount, total } = Cards.dueCount(state.cards, state.settings, state.stats);
    const today = state.stats.days[todayKey()] || 0;
    const goal = state.settings.dailyGoal;
    const mastered = cards.filter(c => SRS.mastery(c.srs) === 3).length;
    const learning = cards.filter(c => SRS.mastery(c.srs) > 0).length;
    const streak = Stats.streak(state.stats);

    // 14 ngày gần nhất
    const days = [];
    for (let i = 13; i >= 0; i--) { const d = new Date(Date.now() - i * DAY); days.push({ k: todayKey(d), d }); }
    const max = Math.max(goal, ...days.map(x => state.stats.days[x.k] || 0));

    // Từ của ngày: cố định theo ngày
    const seed = allSeed();
    const dayIdx = Math.floor(Date.now() / DAY) % seed.length;
    const w = seed[dayIdx];

    const h = new Date().getHours();
    const greet = h < 11 ? 'Chào buổi sáng' : h < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';

    view.innerHTML = `
      <div class="hero">
        <div class="card hero-main stack">
          <div class="muted">${greet} 👋</div>
          <div class="row between">
            <div><div class="big-num">${total}</div><div class="muted">thẻ cần học hôm nay</div></div>
            <div class="small" style="text-align:right">🔁 ${due} ôn lại<br>✨ ${newCount} từ mới</div>
          </div>
          <div>
            <div class="row between small"><span>Mục tiêu hôm nay</span><span>${today}/${goal}</span></div>
            <div class="progress"><i style="width:${Math.min(100, today / goal * 100)}%"></i></div>
          </div>
          <div class="row">
            ${total ? `<a class="btn primary lg" href="#/review">Bắt đầu ôn tập →</a>` : cards.length ? `<a class="btn primary lg" href="#/practice">Luyện tập thêm 🎯</a>` : `<a class="btn primary lg" href="#/topics">Chọn bộ từ đầu tiên →</a>`}
          </div>
        </div>
        <div class="card">
          <div class="row between"><h3>Hoạt động 14 ngày</h3><span class="chip">🔥 ${streak} ngày</span></div>
          <div class="bars" style="margin-top:.8rem">
            ${days.map(x => { const n = state.stats.days[x.k] || 0; return `<div title="${x.k}: ${n} thẻ"><i class="${n ? '' : 'zero'}" style="height:${n ? Math.max(6, n / max * 72) : 3}px"></i><small>${x.d.getDate()}</small></div>`; }).join('')}
          </div>
        </div>
      </div>

      <div class="grid g4 stats" style="margin-top:1rem">
        <div class="card stat"><b>${cards.length}</b><span class="muted small">Từ trong sổ</span></div>
        <div class="card stat"><b>${learning}</b><span class="muted small">Đang học</span></div>
        <div class="card stat"><b>${mastered}</b><span class="muted small">Đã thuộc</span></div>
        <div class="card stat"><b>${Object.values(state.stats.days).reduce((a, b) => a + b, 0)}</b><span class="muted small">Lượt ôn</span></div>
      </div>

      <div class="section-title"><h2>Từ của ngày</h2></div>
      <div class="card wotd">
        ${pic(w)}
        <div>
          <div class="row"><span class="entry-word" style="font-size:1.6rem">${esc(w.word)}</span>${posChip(w.pos)}${levelChip(w.level)}</div>
          <div class="row"><span class="ipa">${esc(w.ipa)}</span><button class="icon-btn" data-speak="${esc(w.word)}" aria-label="Phát âm">🔊</button></div>
          <div class="vi">${esc(w.vi)}</div>
          <div class="ex small">“${highlight(w.ex, w.word)}”</div>
          <div class="row" style="margin-top:.6rem">
            ${inDeck(w.word) ? '<span class="chip">✓ Đã có trong sổ</span>' : `<button class="btn sm primary" data-add-seed="${esc(w.word)}">+ Thêm vào flashcard</button>`}
            <a class="btn sm" href="#/dict/${encodeURIComponent(w.word)}">Xem chi tiết</a>
          </div>
        </div>
      </div>

      <div class="section-title"><h2>Chủ đề IELTS</h2><a href="#/topics">Xem tất cả →</a></div>
      <div class="grid g3 topics">${TOPICS.slice(0, 6).map(topicCard).join('')}</div>
    `;
    bindCommon();
  }

  function topicCard(t) {
    const n = t.words.filter(w => inDeck(w.word)).length;
    return `<div class="card topic" data-go="#/topic/${t.id}">
      <div class="row between"><span class="em">${t.emoji}</span><span class="chip">${n}/${t.words.length}</span></div>
      <h3 style="margin-top:.5rem">${esc(t.name)}</h3>
      <div class="muted small">${esc(t.desc)}</div>
      <div class="progress" style="margin-top:.7rem"><i style="width:${n / t.words.length * 100}%"></i></div>
    </div>`;
  }

  // ================= CHỦ ĐỀ =================
  function renderTopics() {
    view.innerHTML = `
      <h1>Bộ từ vựng IELTS theo chủ đề</h1>
      <p class="muted">${allSeed().length} từ được chọn lọc theo các chủ đề hay gặp trong IELTS, phiên âm Anh–Anh chuẩn Oxford, cấp độ CEFR, kèm collocation và câu ví dụ học thuật.</p>
      <div class="grid g3 topics">${TOPICS.map(topicCard).join('')}</div>`;
    bindCommon();
  }

  function renderTopic(id) {
    const t = topicOf(id);
    if (!t) return renderTopics();
    const missing = t.words.filter(w => !inDeck(w.word)).length;
    view.innerHTML = `
      <a href="#/topics" class="small">← Tất cả chủ đề</a>
      <div class="row between" style="margin:.5rem 0 1rem">
        <div><h1>${t.emoji} ${esc(t.name)}</h1><div class="muted">${esc(t.desc)}</div></div>
        ${missing ? `<button class="btn primary" id="addAll">+ Thêm cả ${missing} từ vào flashcard</button>` : '<span class="chip">✓ Đã thêm toàn bộ</span>'}
      </div>
      <div class="card">
        ${t.words.map(w => `
          <div class="word-row">
            <div class="em">${w.emoji}</div>
            <div>
              <div class="row"><a class="w" href="#/dict/${encodeURIComponent(w.word)}">${esc(w.word)}</a>${posChip(w.pos)}${levelChip(w.level)}
                <span class="ipa small">${esc(w.ipa)}</span><button class="icon-btn" data-speak="${esc(w.word)}" aria-label="Phát âm">🔊</button></div>
              <div><b class="vi" style="font-size:1rem">${esc(w.vi)}</b> <span class="muted small">— ${esc(w.def)}</span></div>
              <div class="ex small">“${highlight(w.ex, w.word)}”</div>
              ${w.col.length ? `<div class="small" style="margin-top:.2rem">🔗 ${w.col.map(esc).join(' · ')}</div>` : ''}
            </div>
            <div>${inDeck(w.word) ? '<span class="chip">✓ Đã thêm</span>' : `<button class="btn sm" data-add-seed="${esc(w.word)}">+ Thêm</button>`}</div>
          </div>`).join('')}
      </div>`;
    bindCommon();
    const btn = $('#addAll');
    if (btn) btn.onclick = async () => {
      btn.disabled = true;
      for (const w of t.words) if (!inDeck(w.word)) await addWord(w);
      toast(`Đã thêm ${missing} từ – vào mục Ôn tập để bắt đầu!`);
      renderTopic(id);
    };
  }

  // ================= TRA TỪ =================
  async function renderDict(q) {
    const recent = await Store.get('recent', []);
    view.innerHTML = `
      <h1>Từ điển Anh – Việt</h1>
      <form class="search" id="searchForm" autocomplete="off">
        <input class="input" id="q" placeholder="Nhập từ tiếng Anh, ví dụ: sustainable" value="${esc(q)}" autofocus list="seedWords">
        <button class="btn primary lg">Tra từ</button>
      </form>
      <datalist id="seedWords">${allSeed().map(w => `<option value="${esc(w.word)}">`).join('')}</datalist>
      ${recent.length ? `<div class="row small" style="margin-top:.7rem"><span class="muted">Gần đây:</span>${recent.map(r => `<a class="chip" href="#/dict/${encodeURIComponent(r)}">${esc(r)}</a>`).join('')}</div>` : ''}
      <div id="result" style="margin-top:1.25rem"></div>`;
    $('#searchForm').onsubmit = e => { e.preventDefault(); const v = $('#q').value.trim(); if (v) location.hash = `#/dict/${encodeURIComponent(v)}`; };
    if (!q) {
      $('#result').innerHTML = `<div class="card empty"><div class="em">🔎</div><p>Tra bất kỳ từ nào để xem phiên âm UK/US, nghĩa tiếng Việt, định nghĩa, ví dụ, hình minh họa — rồi lưu vào flashcard kèm câu ngữ cảnh của riêng bạn.</p><p class="small">Mẹo: cài <b>add-on Chrome</b> để bấm đúp vào từ trên bất kỳ trang web nào.</p></div>`;
      return;
    }
    $('#result').innerHTML = `<div class="card empty"><div class="em">⏳</div>Đang tra “${esc(q)}”…</div>`;
    const e = await Dict.lookup(q);
    if (!e || !e.found) {
      $('#result').innerHTML = `<div class="card empty"><div class="em">🤔</div><p>Không tìm thấy “${esc(q)}”.${e && e.vi ? ` Gợi ý dịch: <b>${esc(e.vi)}</b>` : ''}</p><p class="small">Kiểm tra chính tả hoặc kết nối mạng.</p></div>`;
      return;
    }
    const rec = [e.word, ...recent.filter(r => r !== e.word)].slice(0, 8);
    Store.set('recent', rec);
    const card = state.cards[e.word];

    $('#result').innerHTML = `
      <div class="card">
        <div class="entry-head">
          <div>
            <div class="row"><span class="entry-word">${esc(e.word)}</span>${posChip(e.pos)}${levelChip(e.level)}</div>
            <div class="pron">
              ${e.ipa ? `<span><b class="small">UK</b> <span class="ipa">${esc(e.ipa)}</span><button class="icon-btn" data-speak="${esc(e.word)}" data-accent="en-GB" data-url="${esc(e.audio && /-uk/.test(e.audio) ? e.audio : '')}">🔊</button></span>` : ''}
              <span><b class="small">US</b> <span class="ipa">${esc(e.ipaUS || '')}</span><button class="icon-btn" data-speak="${esc(e.word)}" data-accent="en-US" data-url="${esc(e.audioUS || '')}">🔊</button></span>
            </div>
            <div class="vi">${esc(e.vi)}</div>
            ${e.def ? `<div style="margin-top:.4rem">${esc(e.def)}</div>` : ''}
          </div>
          ${pic(e)}
        </div>
        ${e.ex ? `<div class="example-box" style="margin-top:1rem"><div class="small muted">Ví dụ</div>${highlight(e.ex, e.word)} <button class="icon-btn" data-speak-text="${esc(e.ex)}">🔊</button></div>` : ''}
        ${e.col.length ? `<div style="margin-top:1rem"><b>🔗 Collocations:</b> ${e.col.map(c => `<span class="chip">${esc(c)}</span>`).join(' ')}</div>` : ''}
        ${e.syn.length ? `<div style="margin-top:.6rem"><b>≈ Đồng nghĩa:</b> ${e.syn.map(s => `<a class="chip" href="#/dict/${encodeURIComponent(s)}">${esc(s)}</a>`).join(' ')}</div>` : ''}
        ${(e.senses || []).length ? `<div style="margin-top:1rem"><h3>🇻🇳 Nghĩa tiếng Việt theo từ loại</h3>${e.senses.map(s => `
          <div class="meaning"><span class="chip pos">${esc(s.pos)}</span> ${s.terms.map(esc).join(', ')}</div>`).join('')}</div>` : ''}
        ${(e.oxford || []).length ? `<div style="margin-top:1rem"><h3>📕 Định nghĩa <span class="muted small">(Oxford Languages)</span></h3>${e.oxford.map(m => `
          <div class="meaning"><span class="chip pos">${esc(m.pos)}</span>
            <ol>${m.defs.map(d => `<li>${esc(d.def)}${d.ex ? `<div class="ex small">“${highlight(d.ex, e.word)}”</div>` : ''}</li>`).join('')}</ol>
          </div>`).join('')}</div>` : ''}
        ${e.meanings.length ? `<details style="margin-top:.8rem"${(e.oxford || []).length ? '' : ' open'}><summary class="small"><b>Định nghĩa bổ sung</b> <span class="muted">(Wiktionary)</span></summary>${e.meanings.map(m => `
          <div class="meaning"><span class="chip pos">${esc(m.pos)}</span>
            <ol>${m.defs.map(d => `<li>${esc(d.def)}${d.ex ? `<div class="ex small">“${highlight(d.ex, e.word)}”</div>` : ''}</li>`).join('')}</ol>
          </div>`).join('')}</details>` : ''}
      </div>

      ${(e.sentences || []).length ? `<div class="card" style="margin-top:1rem">
        <h3>💬 Câu ví dụ song ngữ <span class="muted small">(Tatoeba)</span></h3>
        ${e.sentences.map(s => `<div class="meaning"><div>${highlight(s.en, e.word)} <button class="icon-btn" data-speak-text="${esc(s.en)}">🔊</button></div><div class="muted small">${esc(s.vi)}</div>
          <button class="btn sm ghost" data-use-sent="${esc(s.en)}">📌 Dùng làm ngữ cảnh</button></div>`).join('')}
      </div>` : ''}

      <div class="card" style="margin-top:1rem">
        <h3>${card ? '✓ Từ này đã có trong flashcard' : '➕ Lưu vào flashcard'}</h3>
        <label class="field"><span>Câu ngữ cảnh (nơi bạn gặp từ này) – giúp nhớ lâu hơn</span>
          <textarea class="input" id="ctx" placeholder="Dán câu bạn đọc/nghe được có chứa “${esc(e.word)}”…"></textarea></label>
        <div id="ctxVi" class="muted small" style="margin-top:.4rem"></div>
        <div class="row" style="margin-top:.7rem">
          <button class="btn" id="trCtx">🌐 Dịch câu</button>
          <button class="btn primary" id="saveWord">${card ? 'Thêm ngữ cảnh' : 'Lưu vào flashcard'}</button>
          ${card ? `<span class="muted small">Đã có ${card.contexts.length} ngữ cảnh · ${masteryDots(card.srs)}</span>` : ''}
        </div>
      </div>`;
    bindCommon();
    if (state.settings.autoSpeak) speak(e.word, state.settings.accent, state.settings.accent === 'en-US' ? e.audioUS : e.audio);
    let ctxVi = '';
    const trCtx = async () => {
      const text = $('#ctx').value.trim();
      if (!text) return '';
      $('#ctxVi').textContent = '⏳ Đang dịch…';
      ctxVi = await Dict.translateVi(text);
      $('#ctxVi').textContent = ctxVi ? `🇻🇳 ${ctxVi}` : 'Không dịch được câu này.';
      return ctxVi;
    };
    $('#trCtx').onclick = trCtx;
    $('#ctx').oninput = () => { ctxVi = ''; $('#ctxVi').textContent = ''; };
    $$('[data-use-sent]').forEach(b => b.onclick = () => {
      const s = e.sentences.find(x => x.en === b.dataset.useSent);
      $('#ctx').value = s.en; ctxVi = s.vi; $('#ctxVi').textContent = `🇻🇳 ${s.vi}`;
      $('#ctx').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    $('#saveWord').onclick = async () => {
      const text = $('#ctx').value.trim();
      if (text && !ctxVi) await trCtx();
      await addWord(e, text ? { text, vi: ctxVi, source: '', title: 'Ghi chú của bạn' } : null);
      toast(card ? 'Đã cập nhật thẻ' : `Đã lưu “${e.word}” vào flashcard`);
      renderDict(e.word);
    };
  }

  // ================= ÔN TẬP (FLASHCARD SRS) =================
  let session = null;

  function buildQueue() {
    const list = Object.values(state.cards);
    const end = endOfToday();
    const due = list.filter(c => (c.srs.reps > 0 || c.srs.last) && c.srs.due <= end).sort((a, b) => a.srs.due - b.srs.due);
    const { newCount } = Cards.dueCount(state.cards, state.settings, state.stats);
    const fresh = list.filter(c => c.srs.reps === 0 && !c.srs.last).sort((a, b) => a.added - b.added).slice(0, newCount);
    // Xen kẽ thẻ mới vào giữa thẻ ôn
    const q = [...due];
    fresh.forEach((c, i) => q.splice(Math.min(q.length, i * 3 + 1), 0, c));
    return q.map(c => c.word.toLowerCase());
  }

  function renderReview() {
    if (!Object.keys(state.cards).length) {
      view.innerHTML = `<div class="card empty"><div class="em">🃏</div><h2>Chưa có flashcard nào</h2><p>Thêm từ từ một chủ đề IELTS hoặc tra từ điển để bắt đầu.</p><div class="row" style="justify-content:center"><a class="btn primary" href="#/topics">Chọn chủ đề</a><a class="btn" href="#/dict">Tra từ</a></div></div>`;
      return;
    }
    session = { queue: buildQueue(), done: 0, again: 0, reverse: !!session && session.reverse, flipped: false };
    if (!session.queue.length) return renderReviewDone(true);
    showCard();
  }

  function renderReviewDone(nothing) {
    const next = Object.values(state.cards).filter(c => c.srs.due > endOfToday()).sort((a, b) => a.srs.due - b.srs.due)[0];
    view.innerHTML = `<div class="review-wrap"><div class="card empty">
      <div class="em">${nothing ? '🎉' : '🏆'}</div>
      <h2>${nothing ? 'Hôm nay bạn đã ôn hết!' : `Hoàn thành ${session.done} thẻ!`}</h2>
      <p>${next ? `Thẻ tiếp theo đến hạn: <b>${new Date(next.srs.due).toLocaleDateString('vi-VN')}</b>.` : ''} Học đều mỗi ngày là bí quyết nhớ lâu.</p>
      <div class="row" style="justify-content:center"><a class="btn primary" href="#/practice">Luyện tập thêm 🎯</a><a class="btn" href="#/topics">Thêm từ mới</a></div>
    </div></div>`;
  }

  function showCard() {
    const key = session.queue[0];
    const c = state.cards[key];
    if (!c) { session.queue.shift(); return session.queue.length ? showCard() : renderReviewDone(false); }
    session.flipped = false;
    const ctx = c.contexts[0];
    const isNew = c.srs.reps === 0 && !c.srs.last;
    const rev = session.reverse;
    const clozeEx = c.ex ? esc(c.ex).replace(wordRegex(c.word), '<span class="blank"></span>') : '';

    const front = rev ? `
        ${pic(c)}
        <div class="vi" style="font-size:1.5rem">${esc(c.vi)}</div>
        ${posChip(c.pos)}
        ${clozeEx ? `<div class="ctx">“${clozeEx}”</div>` : ''}
        <div class="muted small" style="margin-top:1rem">Nhớ lại từ tiếng Anh, rồi chạm để lật</div>` : `
        ${pic(c)}
        <div class="entry-word">${esc(c.word)}</div>
        <div class="row" style="justify-content:center"><span class="ipa">${esc(c.ipa)}</span>${posChip(c.pos)}<button class="icon-btn" data-speak="${esc(c.word)}" data-url="${esc(c.audio)}">🔊</button></div>
        ${ctx ? `<div class="ctx">“${highlight(ctx.text, c.word)}”</div>` : ''}
        <div class="muted small" style="margin-top:1rem">Đoán nghĩa, rồi chạm để lật <span class="kbd">Space</span></div>`;

    view.innerHTML = `<div class="review-wrap">
      <div class="row between small" style="margin-bottom:.7rem">
        <span class="muted">Còn lại <b>${session.queue.length}</b> · Đã ôn ${session.done}</span>
        <span class="row">${isNew ? '<span class="chip lv">MỚI</span>' : masteryDots(c.srs)}
          <button class="btn sm ghost" id="toggleRev" title="Đổi chiều thẻ">${rev ? '🇻🇳→🇬🇧' : '🇬🇧→🇻🇳'}</button></span>
      </div>
      <div class="flash" id="flash">
        <div class="flash-inner">
          <div class="card face front">${front}</div>
          <div class="card face back">
            <div class="row"><span class="entry-word" style="font-size:1.8rem">${esc(c.word)}</span>${posChip(c.pos)}${levelChip(c.level)}
              <span class="ipa">${esc(c.ipa)}</span><button class="icon-btn" data-speak="${esc(c.word)}" data-url="${esc(c.audio)}">🔊</button></div>
            <div class="vi" style="margin:.3rem 0">${esc(c.vi)}</div>
            ${c.def ? `<div>${esc(c.def)}</div>` : ''}
            ${c.ex ? `<div class="example-box" style="margin-top:.8rem">${highlight(c.ex, c.word)} <button class="icon-btn" data-speak-text="${esc(c.ex)}">🔊</button></div>` : ''}
            ${c.contexts.length ? `<div style="margin-top:.8rem"><b class="small">📌 Ngữ cảnh của bạn</b>${c.contexts.slice(0, 2).map(x => `<div class="ex small" style="margin-top:.3rem">“${highlight(x.text, c.word)}”${x.title ? ` <span class="muted">— ${esc(x.title)}</span>` : ''}${x.vi ? `<div style="font-style:normal">🇻🇳 ${esc(x.vi)}</div>` : ''}</div>`).join('')}</div>` : ''}
            ${(c.sentences || []).length ? `<div style="margin-top:.8rem"><b class="small">💬 Câu song ngữ</b>${c.sentences.map(x => `<div class="small" style="margin-top:.3rem">${highlight(x.en, c.word)}<div class="muted">${esc(x.vi)}</div></div>`).join('')}</div>` : ''}
            ${c.col.length ? `<div class="small" style="margin-top:.8rem">🔗 ${c.col.map(esc).join(' · ')}</div>` : ''}
            ${c.syn.length ? `<div class="small" style="margin-top:.3rem">≈ ${c.syn.map(esc).join(', ')}</div>` : ''}
            ${c.note ? `<div class="small" style="margin-top:.6rem">📝 ${esc(c.note)}</div>` : ''}
          </div>
        </div>
      </div>
      <div id="actions" style="margin-top:1rem">
        <button class="btn primary lg" id="flipBtn" style="width:100%">Lật thẻ</button>
      </div>
      <p class="muted small" style="text-align:center;margin-top:1rem">Phím tắt: <span class="kbd">Space</span> lật · <span class="kbd">1</span>–<span class="kbd">4</span> chấm điểm · <span class="kbd">P</span> phát âm</p>
    </div>`;
    bindCommon();

    const flip = () => {
      if (session.flipped) return;
      session.flipped = true;
      $('#flash').classList.add('flipped');
      const labels = [['Quên', 'g-again'], ['Khó', 'g-hard'], ['Nhớ', 'g-good'], ['Dễ', 'g-easy']];
      $('#actions').innerHTML = `<div class="grades">${labels.map(([l, cls], i) => `<button class="btn ${cls}" data-grade="${i}">${l}<small>${SRS.preview(c.srs, i)}</small></button>`).join('')}</div>`;
      $$('[data-grade]').forEach(b => b.onclick = () => grade(+b.dataset.grade));
      if (rev || state.settings.autoSpeak) speak(c.word, state.settings.accent, c.audio);
    };
    $('#flash').addEventListener('click', e => { if (!e.target.closest('button')) flip(); });
    $('#flipBtn').onclick = flip;
    $('#toggleRev').onclick = () => { session.reverse = !session.reverse; showCard(); };
    document.onkeydown = e => {
      if (e.target.matches('input, textarea')) return;
      if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); flip(); }
      else if (session.flipped && /^[1-4]$/.test(e.key)) grade(+e.key - 1);
      else if (e.key.toLowerCase() === 'p') speak(c.word, state.settings.accent, c.audio);
    };
    if (!rev && state.settings.autoSpeak) speak(c.word, state.settings.accent, c.audio);

    async function grade(g) {
      document.onkeydown = null;
      const wasNew = c.srs.reps === 0 && !c.srs.last;
      c.srs = SRS.review(c.srs, g);
      state.cards[key] = c;
      await Cards.update(c);
      state.stats = await Stats.logReview(wasNew);
      session.queue.shift();
      session.done += 1;
      if (g === 0) { session.queue.splice(Math.min(session.queue.length, 4), 0, key); session.again += 1; }
      updateChrome();
      session.queue.length ? showCard() : renderReviewDone(false);
    }
  }

  // ================= LUYỆN TẬP =================
  function practicePool() {
    const mine = Object.values(state.cards).filter(c => c.vi && c.ex);
    return mine.length >= 6 ? mine : allSeed();
  }

  function renderPractice() {
    const usingMine = Object.values(state.cards).filter(c => c.vi && c.ex).length >= 6;
    view.innerHTML = `
      <h1>Luyện tập</h1>
      <p class="muted">${usingMine ? 'Câu hỏi lấy từ sổ từ của bạn.' : 'Sổ từ còn ít (&lt;6 từ) nên câu hỏi lấy từ bộ từ IELTS.'} Mỗi lượt 10 câu.</p>
      <div class="grid g3">
        <div class="card mode" data-mode="mcq"><div class="em">🧩</div><h3>Trắc nghiệm nghĩa</h3><p class="muted small">Chọn nghĩa tiếng Việt đúng của từ.</p></div>
        <div class="card mode" data-mode="cloze"><div class="em">✍️</div><h3>Điền từ vào câu</h3><p class="muted small">Đọc câu IELTS, gõ từ còn thiếu – luyện dùng từ trong ngữ cảnh.</p></div>
        <div class="card mode" data-mode="listen"><div class="em">🎧</div><h3>Nghe & chép</h3><p class="muted small">Nghe phát âm, gõ lại đúng chính tả – luyện Listening.</p></div>
      </div>`;
    $$('[data-mode]').forEach(el => el.onclick = () => startPractice(el.dataset.mode));
  }

  function startPractice(mode) {
    const pool = practicePool();
    const qs = shuffle(pool).slice(0, Math.min(10, pool.length));
    const run = { mode, qs, i: 0, score: 0, wrong: [] };
    nextQ();

    function nextQ() {
      if (run.i >= run.qs.length) return finish();
      const w = run.qs[run.i];
      const head = `<div class="row between small" style="margin-bottom:.8rem"><a href="#/practice">← Chọn chế độ</a><span class="muted">Câu ${run.i + 1}/${run.qs.length} · Đúng ${run.score}</span></div>
        <div class="progress" style="margin-bottom:1rem"><i style="width:${run.i / run.qs.length * 100}%"></i></div>`;

      if (mode === 'mcq') {
        const opts = shuffle([w, ...shuffle(pool.filter(x => x.word !== w.word && x.vi !== w.vi)).slice(0, 3)]);
        view.innerHTML = `<div class="review-wrap">${head}<div class="card" style="text-align:center">
          ${pic(w)}<div class="entry-word">${esc(w.word)}</div>
          <div class="row" style="justify-content:center"><span class="ipa">${esc(w.ipa)}</span><button class="icon-btn" data-speak="${esc(w.word)}">🔊</button></div></div>
          <div class="options" style="margin-top:1rem">${opts.map((o, k) => `<button class="option" data-o="${esc(o.word)}"><span class="kbd">${k + 1}</span> ${esc(o.vi)}</button>`).join('')}</div>
          <div id="fb"></div></div>`;
        bindCommon();
        const pick = btn => {
          if (run.answered) return; run.answered = true;
          const ok = btn.dataset.o === w.word;
          $$('.option').forEach(b => { if (b.dataset.o === w.word) b.classList.add('right'); });
          if (!ok) btn.classList.add('wrong');
          feedback(ok, w);
        };
        $$('.option').forEach(b => b.onclick = () => pick(b));
        document.onkeydown = e => { const n = +e.key; if (n >= 1 && n <= opts.length) pick($$('.option')[n - 1]); else if (e.key === 'Enter' && run.answered) advance(); };
        speak(w.word);
      } else {
        const isCloze = mode === 'cloze';
        const sentence = isCloze ? esc(w.ex).replace(wordRegex(w.word), '<span class="blank"></span>') : '';
        const m = isCloze ? (w.ex.match(wordRegex(w.word)) || [w.word])[0] : w.word;
        view.innerHTML = `<div class="review-wrap">${head}<div class="card" style="text-align:center">
          ${isCloze ? `<div style="font-size:1.15rem">“${sentence}”</div>
            <div class="muted" style="margin-top:.7rem">Gợi ý: <b>${esc(w.vi)}</b> ${posChip(w.pos)} · bắt đầu bằng “${esc(m[0])}”, ${m.length} chữ cái</div>`
            : `<div class="em" style="font-size:3rem">🎧</div><div class="row" style="justify-content:center"><button class="btn primary" id="play">🔊 Nghe lại</button><button class="btn" id="slow">🐢 Chậm</button></div>
               <div class="muted" style="margin-top:.7rem">Gợi ý: ${esc(w.vi)}</div>`}
          </div>
          <form id="ansForm" class="search" style="margin-top:1rem" autocomplete="off">
            <input class="input" id="ans" placeholder="Gõ đáp án…" autocapitalize="off" spellcheck="false">
            <button class="btn primary">Kiểm tra</button>
          </form>
          <div id="fb"></div></div>`;
        bindCommon();
        $('#ans').focus();
        if (!isCloze) {
          const play = rate => { const u = new SpeechSynthesisUtterance(w.word); u.lang = state.settings.accent; u.rate = rate; speechSynthesis.cancel(); speechSynthesis.speak(u); };
          $('#play').onclick = () => speak(w.word); $('#slow').onclick = () => play(0.5);
          setTimeout(() => speak(w.word), 300);
        }
        $('#ansForm').onsubmit = e => {
          e.preventDefault();
          if (run.answered) return advance();
          const a = $('#ans').value.trim().toLowerCase();
          if (!a) return;
          run.answered = true;
          const ok = a === w.word.toLowerCase() || a === m.toLowerCase();
          feedback(ok, w, isCloze ? m : w.word);
        };
      }
    }

    function feedback(ok, w, answer) {
      if (ok) run.score++; else run.wrong.push(w);
      $('#fb').innerHTML = `<div class="feedback ${ok ? 'ok' : 'no'}">
        <b>${ok ? '✅ Chính xác!' : `❌ Đáp án: ${esc(answer || w.word)}`}</b>
        <div><b>${esc(w.word)}</b> <span class="ipa">${esc(w.ipa)}</span> – ${esc(w.vi)}</div>
        <div class="ex small">“${highlight(w.ex, w.word)}”</div>
        <button class="btn primary" id="nextQ" style="margin-top:.7rem">Tiếp tục →</button></div>`;
      $('#nextQ').onclick = advance;
      $('#nextQ').focus();
      if (!ok) speak(w.word);
    }
    function advance() { run.answered = false; run.i++; nextQ(); }

    function finish() {
      document.onkeydown = null;
      const pct = Math.round(run.score / run.qs.length * 100);
      view.innerHTML = `<div class="review-wrap"><div class="card empty">
        <div class="em">${pct >= 80 ? '🏆' : pct >= 50 ? '👍' : '💪'}</div>
        <h2>${run.score}/${run.qs.length} câu đúng (${pct}%)</h2>
        ${run.wrong.length ? `<p>Cần ôn lại:</p><div class="row" style="justify-content:center">${run.wrong.map(w => `<a class="chip" href="#/dict/${encodeURIComponent(w.word)}">${esc(w.word)}</a>`).join('')}</div>
          <p><button class="btn sm" id="addWrong">+ Đưa các từ sai vào flashcard</button></p>` : '<p>Xuất sắc! 🎉</p>'}
        <div class="row" style="justify-content:center;margin-top:1rem"><button class="btn primary" id="again">Làm lượt mới</button><a class="btn" href="#/practice">Đổi chế độ</a></div>
      </div></div>`;
      $('#again').onclick = () => startPractice(mode);
      const aw = $('#addWrong');
      if (aw) aw.onclick = async () => { for (const w of run.wrong) if (!inDeck(w.word)) await addWord(w); toast('Đã thêm vào flashcard'); aw.disabled = true; };
    }
  }

  // ================= SỔ TỪ =================
  function renderDeck() {
    const list = Object.values(state.cards);
    view.innerHTML = `
      <div class="row between"><h1>Sổ từ của bạn <span class="muted">(${list.length})</span></h1>
        <div class="row"><button class="btn sm" id="exportBtn">⬇️ Xuất</button><label class="btn sm">⬆️ Nhập<input type="file" id="importFile" accept="application/json" hidden></label></div></div>
      <div class="grid g3" style="margin:1rem 0">
        <input class="input" id="filterQ" placeholder="Tìm từ hoặc nghĩa…">
        <select class="input" id="filterTopic"><option value="">Tất cả chủ đề</option>${TOPICS.map(t => `<option value="${t.id}">${t.emoji} ${esc(t.name)}</option>`).join('')}<option value="mine">📌 Từ tự thêm</option></select>
        <select class="input" id="filterM"><option value="">Mọi mức độ</option><option value="0">Chưa học</option><option value="1">Đang học</option><option value="2">Quen</option><option value="3">Đã thuộc</option></select>
      </div>
      <div class="card" id="deckList"></div>`;
    const draw = () => {
      const q = $('#filterQ').value.trim().toLowerCase(), tp = $('#filterTopic').value, m = $('#filterM').value;
      const rows = list.filter(c => (!q || c.word.includes(q) || (c.vi || '').toLowerCase().includes(q)) && (!tp || c.topic === tp) && (m === '' || SRS.mastery(c.srs) === +m))
        .sort((a, b) => b.added - a.added);
      $('#deckList').innerHTML = rows.length ? rows.map(c => `
        <div class="deck-row">
          <div class="em">${c.image ? `<div class="pic" style="width:40px;font-size:1.2rem"><img src="${esc(c.image)}" alt="" loading="lazy" referrerpolicy="no-referrer"></div>` : esc(c.emoji)}</div>
          <div><a href="#/dict/${encodeURIComponent(c.word)}"><b>${esc(c.word)}</b></a> <span class="ipa small">${esc(c.ipa)}</span><div class="small">${esc(c.vi)}</div></div>
          <div class="small muted hide-sm">${c.contexts[0] ? `“${highlight(c.contexts[0].text.slice(0, 110), c.word)}${c.contexts[0].text.length > 110 ? '…' : ''}”` : esc(c.def).slice(0, 110)}</div>
          <div class="hide-sm" title="Đến hạn ${new Date(c.srs.due).toLocaleDateString('vi-VN')}">${masteryDots(c.srs)}</div>
          <div class="row" style="gap:.3rem"><button class="icon-btn" data-speak="${esc(c.word)}" data-url="${esc(c.audio)}">🔊</button><button class="icon-btn" data-edit="${esc(c.word)}" title="Sửa">✏️</button></div>
        </div>`).join('') : `<div class="empty"><div class="em">📒</div>${list.length ? 'Không có từ phù hợp bộ lọc.' : 'Sổ từ đang trống. Hãy thêm từ từ <a href="#/topics">chủ đề</a> hoặc <a href="#/dict">tra từ</a>.'}</div>`;
      bindCommon();
      $$('[data-edit]').forEach(b => b.onclick = () => editCard(b.dataset.edit));
    };
    ['filterQ', 'filterTopic', 'filterM'].forEach(id => $('#' + id).addEventListener('input', draw));
    draw();

    $('#exportBtn').onclick = () => {
      const blob = new Blob([JSON.stringify({ app: 'ielts-lexi', version: 1, exported: new Date().toISOString(), cards: state.cards, stats: state.stats, settings: state.settings }, null, 2)], { type: 'application/json' });
      download(blob, `ielts-lexi-${todayKey()}.json`);
    };
    $('#importFile').onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      try {
        const data = JSON.parse(await f.text());
        if (!data.cards) throw new Error();
        const merged = { ...state.cards, ...data.cards };
        await Cards.save(merged);
        if (data.stats) { const s = state.stats; for (const [k, v] of Object.entries(data.stats.days || {})) s.days[k] = Math.max(s.days[k] || 0, v); await Store.set('stats', s); }
        await load(); toast(`Đã nhập ${Object.keys(data.cards).length} thẻ`); renderDeck();
      } catch (err) { toast('File không hợp lệ'); }
    };
  }

  function editCard(word) {
    const c = state.cards[word.toLowerCase()];
    if (!c) return;
    modal(`<h2>Sửa “${esc(c.word)}”</h2>
      <div class="stack">
        <label class="field"><span>Nghĩa tiếng Việt</span><input class="input" id="eVi" value="${esc(c.vi)}"></label>
        <label class="field"><span>Phiên âm</span><input class="input" id="eIpa" value="${esc(c.ipa)}"></label>
        <label class="field"><span>Câu ví dụ</span><textarea class="input" id="eEx">${esc(c.ex)}</textarea></label>
        <label class="field"><span>Ghi chú / mẹo nhớ</span><textarea class="input" id="eNote" placeholder="VD: liên tưởng, từ gốc, cách dùng trong Writing…">${esc(c.note)}</textarea></label>
        <label class="field"><span>URL hình minh họa (để trống để dùng emoji ${esc(c.emoji)})</span><input class="input" id="eImg" value="${esc(c.image)}"></label>
      </div>
      <div class="row between" style="margin-top:1.2rem">
        <button class="btn" id="eDel" style="color:var(--again)">🗑 Xóa thẻ</button>
        <div class="row"><button class="btn" id="eReset" title="Học lại từ đầu">↺ Học lại</button><button class="btn" data-close>Hủy</button><button class="btn primary" id="eSave">Lưu</button></div>
      </div>`);
    $('#eSave').onclick = async () => {
      Object.assign(c, { vi: $('#eVi').value.trim(), ipa: $('#eIpa').value.trim(), ex: $('#eEx').value.trim(), note: $('#eNote').value.trim(), image: $('#eImg').value.trim() });
      await Cards.update(c); closeModal(); toast('Đã lưu'); renderDeck();
    };
    $('#eReset').onclick = async () => { c.srs = SRS.newState(); await Cards.update(c); closeModal(); updateChrome(); toast('Thẻ sẽ được học lại như từ mới'); renderDeck(); };
    $('#eDel').onclick = async () => {
      if (!confirm(`Xóa “${c.word}” khỏi sổ từ?`)) return;
      await Cards.remove(c.word); delete state.cards[c.word.toLowerCase()]; closeModal(); updateChrome(); renderDeck();
    };
  }

  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ================= CÀI ĐẶT & NHẮC HỌC =================
  function renderSettings() {
    const s = state.settings;
    const perm = 'Notification' in window ? Notification.permission : 'unsupported';
    view.innerHTML = `
      <h1>Cài đặt</h1>
      <div class="grid g2">
        <div class="card stack">
          <h2>⏰ Nhắc học hằng ngày</h2>
          <label class="row"><input type="checkbox" id="sRem" ${s.reminderOn ? 'checked' : ''}> Bật nhắc học</label>
          <label class="field"><span>Giờ nhắc</span><input type="time" class="input" id="sTime" value="${esc(s.reminderTime)}"></label>
          ${Store.isExtension
            ? '<p class="small muted">✅ Add-on sẽ gửi thông báo vào giờ này mỗi ngày (kể cả khi chưa mở trang này) và hiện số thẻ cần ôn trên biểu tượng.</p>'
            : `<p class="small muted">Trình duyệt chỉ báo được khi trang đang mở. Để nhắc chắc chắn mỗi ngày, hãy thêm lịch nhắc vào Lịch điện thoại hoặc dùng add-on Chrome.</p>
               <div class="row">
                 <button class="btn sm" id="sPerm" ${perm === 'granted' || perm === 'unsupported' ? 'disabled' : ''}>${perm === 'granted' ? '✓ Đã cho phép thông báo' : perm === 'unsupported' ? 'Không hỗ trợ thông báo' : '🔔 Cho phép thông báo'}</button>
                 <button class="btn sm" id="sIcs">📅 Thêm vào Lịch (.ics)</button>
               </div>`}
          <button class="btn sm" id="sTest">Thử gửi thông báo</button>
        </div>
        <div class="card stack">
          <h2>🎯 Mục tiêu học</h2>
          <label class="field"><span>Số từ mới mỗi ngày: <b id="vNew">${s.dailyNew}</b></span><input type="range" min="0" max="50" step="1" id="sNew" value="${s.dailyNew}" style="width:100%"></label>
          <label class="field"><span>Mục tiêu lượt ôn mỗi ngày: <b id="vGoal">${s.dailyGoal}</b></span><input type="range" min="5" max="200" step="5" id="sGoal" value="${s.dailyGoal}" style="width:100%"></label>
          <label class="field"><span>Giọng phát âm</span>
            <select class="input" id="sAccent"><option value="en-GB" ${s.accent === 'en-GB' ? 'selected' : ''}>🇬🇧 Anh – Anh (khuyên dùng cho IELTS)</option><option value="en-US" ${s.accent === 'en-US' ? 'selected' : ''}>🇺🇸 Anh – Mỹ</option></select></label>
          <label class="row"><input type="checkbox" id="sAuto" ${s.autoSpeak ? 'checked' : ''}> Tự động phát âm khi hiện thẻ</label>
        </div>
      </div>
      <div class="card stack" style="margin-top:1rem">
        <h2>🧩 Add-on từ điển cho Chrome</h2>
        <p>Bấm đúp vào bất kỳ từ tiếng Anh nào trên trang web (báo, bài Reading, YouTube phụ đề…) để xem phiên âm, nghĩa, hình ảnh và <b>lưu ngay vào flashcard kèm câu gốc làm ngữ cảnh</b>.</p>
        <p class="small muted">Cài đặt: mở <code>chrome://extensions</code> → bật <i>Developer mode</i> → <i>Load unpacked</i> → chọn thư mục <code>extension</code> của dự án.</p>
      </div>
      <div class="card stack" style="margin-top:1rem">
        <h2>⚠️ Dữ liệu</h2>
        <p class="small muted">Dữ liệu lưu trên máy này. Dùng Xuất/Nhập ở mục Sổ từ để sao lưu hoặc chuyển giữa web và add-on.</p>
        <div><button class="btn sm" id="sReset" style="color:var(--again)">Xóa toàn bộ dữ liệu học</button></div>
      </div>`;

    const save = async () => { await saveSettings(); updateChrome(); };
    $('#sRem').onchange = e => { s.reminderOn = e.target.checked; save(); };
    $('#sTime').onchange = e => { s.reminderTime = e.target.value || '20:00'; save(); toast(`Sẽ nhắc lúc ${s.reminderTime} mỗi ngày`); };
    $('#sNew').oninput = e => { s.dailyNew = +e.target.value; $('#vNew').textContent = s.dailyNew; save(); };
    $('#sGoal').oninput = e => { s.dailyGoal = +e.target.value; $('#vGoal').textContent = s.dailyGoal; save(); };
    $('#sAccent').onchange = e => { s.accent = e.target.value; save(); speak('pronunciation'); };
    $('#sAuto').onchange = e => { s.autoSpeak = e.target.checked; save(); };
    $('#sTest').onclick = () => notify(true);
    const p = $('#sPerm'); if (p) p.onclick = async () => { await Notification.requestPermission(); renderSettings(); };
    const ics = $('#sIcs'); if (ics) ics.onclick = () => download(new Blob([makeICS(s.reminderTime)], { type: 'text/calendar' }), 'ielts-lexi-nhac-hoc.ics');
    $('#sReset').onclick = async () => {
      if (!confirm('Xóa toàn bộ flashcard, tiến độ và thống kê? Không thể hoàn tác.')) return;
      await Store.set('cards', {}); await Store.set('stats', { days: {}, newToday: { day: '', n: 0 } });
      await load(); toast('Đã xóa dữ liệu'); renderSettings();
    };
  }

  function makeICS(time) {
    const [hh, mm] = time.split(':');
    const d = new Date(); const ymd = todayKey(d).replace(/-/g, '');
    const url = location.href.split('#')[0];
    return [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//IELTS Lexi//VI', 'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT', `UID:ielts-lexi-daily-${ymd}@lexi`, `DTSTAMP:${ymd}T000000Z`,
      `DTSTART:${ymd}T${hh}${mm}00`, 'DURATION:PT15M', 'RRULE:FREQ=DAILY',
      'SUMMARY:📚 Ôn từ vựng IELTS (15 phút)', `DESCRIPTION:Mở IELTS Lexi để ôn flashcard hôm nay: ${url}`, `URL:${url}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Đến giờ ôn từ vựng IELTS!', 'TRIGGER:PT0M', 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR',
    ].join('\r\n');
  }

  async function notify(force) {
    const { total } = Cards.dueCount(state.cards, state.settings, state.stats);
    const title = 'IELTS Lexi – đến giờ học rồi! 📚';
    const body = total ? `Bạn có ${total} thẻ cần ôn hôm nay. Chỉ mất vài phút thôi!` : 'Thêm vài từ mới để giữ chuỗi ngày học nhé 🔥';
    if (Store.isExtension && chrome.runtime) { chrome.runtime.sendMessage({ type: 'testNotify' }); return; }
    if (!('Notification' in window)) return force && toast('Trình duyệt không hỗ trợ thông báo');
    if (Notification.permission !== 'granted') {
      if (force) { const p = await Notification.requestPermission(); if (p !== 'granted') return toast('Bạn chưa cho phép thông báo'); }
      else return;
    }
    const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
    if (reg) reg.showNotification(title, { body, icon: 'icons/icon-192.png', tag: 'daily', data: { url: location.href.split('#')[0] + '#/review' } });
    else new Notification(title, { body, icon: 'icons/icon-192.png' });
  }

  // Nhắc khi trang web đang mở (add-on dùng chrome.alarms ở background)
  async function checkReminder() {
    const s = state.settings;
    if (Store.isExtension || !s.reminderOn) return;
    const [hh, mm] = s.reminderTime.split(':').map(Number);
    const now = new Date();
    if (now.getHours() * 60 + now.getMinutes() < hh * 60 + mm) return;
    const last = await Store.get('lastNotified', '');
    if (last === todayKey()) return;
    if ((state.stats.days[todayKey()] || 0) >= s.dailyGoal) return;
    await Store.set('lastNotified', todayKey());
    notify(false);
  }

  // ---------- Sự kiện dùng chung ----------
  function bindCommon() {
    $$('[data-speak]').forEach(b => b.onclick = e => { e.stopPropagation(); speak(b.dataset.speak, b.dataset.accent || state.settings.accent, b.dataset.url || ''); });
    $$('[data-speak-text]').forEach(b => b.onclick = e => { e.stopPropagation(); speak(b.dataset.speakText); });
    $$('[data-go]').forEach(el => el.onclick = () => { location.hash = el.dataset.go; });
    $$('[data-add-seed]').forEach(b => b.onclick = async () => {
      const w = INDEX[b.dataset.addSeed.toLowerCase()];
      if (!w) return;
      await addWord(w);
      b.outerHTML = '<span class="chip">✓ Đã thêm</span>';
      toast(`Đã thêm “${w.word}” vào flashcard`);
    });
  }

  // ---------- Khởi động ----------
  (async function init() {
    await load();
    route();
    if (Store.isExtension && chrome.storage.onChanged) {
      // Từ được lưu từ trang web khác qua add-on → làm mới
      chrome.storage.onChanged.addListener(async ch => {
        if (ch.cards) { state.cards = ch.cards.newValue || {}; updateChrome(); }
      });
    }
    if (!Store.isExtension && 'serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
    checkReminder();
    setInterval(checkReminder, 60 * 1000);
    document.addEventListener('visibilitychange', async () => { if (!document.hidden) { await load(); } });
  })();
})();
