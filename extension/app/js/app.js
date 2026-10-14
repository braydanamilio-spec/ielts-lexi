/* Vocaband v2 – khung ứng dụng: router, trạng thái, trang chủ, thư viện, từ điển, sổ từ, tiến độ, cài đặt. */
(function () {
  const { Store, SRS, Cards, Stats, Golden, DEFAULT_SETTINGS, todayKey, endOfToday, DAY } = Core;
  const { TOPICS, INDEX, GROUPS } = IELTS_DATA;
  const { $, $$, esc, highlight, toast, modal, closeModal, speak, pic, levelChip, posChip, ring, download, xpFloat } = UI;
  const view = $('#view');

  const state = { cards: {}, settings: { ...DEFAULT_SETTINGS }, stats: { days: {}, newToday: { day: '', n: 0 } }, game: null, user: null };
  const allWords = () => TOPICS.flatMap(t => t.words);
  const topicOf = id => TOPICS.find(t => t.id === id);
  const inDeck = w => !!state.cards[String(w).toLowerCase()];
  const masteryDots = s => UI.masteryDots(s, SRS);
  // Nguồn gốc của từ → các bộ từ cá nhân tự động
  const ORIGINS = {
    youtube: { emoji: '▶️', name: 'Từ YouTube & video', desc: 'Lưu khi xem video có phụ đề' },
    web: { emoji: '🌐', name: 'Từ trang web', desc: 'Lưu bằng add-on khi đọc báo, blog…' },
    reading: { emoji: '📖', name: 'Từ bài đọc', desc: 'Lưu khi đọc bài trong Vocaband' },
    dict: { emoji: '🔎', name: 'Từ tra từ điển', desc: 'Từ bạn tự tra và lưu' },
    library: { emoji: '📚', name: 'Từ thư viện', desc: 'Thêm từ các bộ từ IELTS' },
  };
  function origin(c) {
    const ctx = (c.contexts || []).find(x => x.source) || c.contexts[c.contexts.length - 1];
    if (ctx && ctx.source && /youtube\.com|youtu\.be|netflix|vimeo|ted\.com/.test(ctx.source)) return 'youtube';
    if (ctx && ctx.source && /^https?:/.test(ctx.source)) return 'web';
    if (ctx && /^Bài đọc/.test(ctx.title || '')) return 'reading';
    if (c.topic === 'mine' || !c.topic) return 'dict';
    return 'library';
  }
  const forgetting = () => Object.values(state.cards).filter(c => c.srs.reps > 0 && SRS.retention(c.srs) < 0.85);

  // ---------- Dữ liệu ----------
  async function load() {
    state.cards = await Cards.all();
    state.settings = { ...DEFAULT_SETTINGS, theme: 'auto', sfx: true, ...(await Store.get('settings', {})) };
    state.stats = await Stats.get();
    state.game = await Game.get();
    Core.sfxOff = !state.settings.sfx;
    applyTheme();
    updateChrome();
  }
  const saveSettings = async () => { await Store.set('settingsAt', Date.now()); return Store.set('settings', state.settings); };

  // Ngày có học = có ôn thẻ hoặc có XP
  function activeDays() {
    const set = new Set(Object.keys(state.stats.days).filter(k => state.stats.days[k] > 0));
    for (const [k, v] of Object.entries(state.game.days || {})) if (v.xp > 0) set.add(k);
    return set;
  }
  function streak() {
    const days = activeDays();
    let n = 0; const d = new Date();
    if (!days.has(todayKey(d))) d.setDate(d.getDate() - 1);
    while (days.has(todayKey(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  const masteredCount = () => Object.values(state.cards).filter(c => SRS.mastery(c.srs) === 3).length;

  function updateChrome() {
    const st = streak();
    $('#streakPill').textContent = `🔥 ${st}`;
    $('#xpPill').textContent = `⭐ ${state.game.xp.toLocaleString('vi-VN')}`;
    const { total } = Cards.dueCount(state.cards, state.settings, state.stats);
    $$('[data-due]').forEach(b => { b.hidden = !total; b.textContent = total > 99 ? '99+' : total; });
    const L = Game.levelOf(state.game.xp);
    const name = state.user ? (state.user.displayName || state.user.email || 'Bạn') : 'Bạn';
    $('#sideLevel').innerHTML = `<div class="lv-row">${avatarHtml()}<div class="grow"><b>${esc(name)}</b><div class="tiny muted">Cấp ${L.level} · ${esc(L.title)}</div></div></div>
      <div class="progress xp thin" style="margin-top:.6rem"><i style="width:${L.into / L.need * 100}%"></i></div>
      <div class="tiny muted" style="margin-top:.3rem">${L.into}/${L.need} XP tới cấp ${L.level + 1}</div>`;
    $('#avatarBtn').innerHTML = avatarInner();
  }
  const avatarInner = () => state.user && state.user.photoURL ? `<img src="${esc(state.user.photoURL)}" alt="" referrerpolicy="no-referrer">` : esc((state.user && (state.user.displayName || state.user.email) || 'L')[0].toUpperCase());
  const avatarHtml = () => `<span class="avatar">${avatarInner()}</span>`;

  // ---------- Theme ----------
  function applyTheme() {
    const t = state.settings.theme;
    if (t === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
  }
  $('#themeBtn').onclick = () => {
    const order = ['auto', 'light', 'dark'];
    state.settings.theme = order[(order.indexOf(state.settings.theme) + 1) % 3];
    applyTheme(); saveSettings();
    toast({ auto: '🌓 Giao diện theo hệ thống', light: '☀️ Giao diện sáng', dark: '🌙 Giao diện tối' }[state.settings.theme]);
  };

  // ---------- Thưởng XP / nhiệm vụ / huy hiệu ----------
  async function reward(delta, el) {
    const ctx = { cards: Object.keys(state.cards).length, mastered: masteredCount(), streak: streak() + ((state.game.days[todayKey()] || {}).xp ? 0 : 1) };
    const r = await Game.track(delta, ctx);
    state.game = r.state;
    if (delta.xp) xpFloat(delta.xp, el);
    for (const ev of r.events) {
      if (ev.type === 'quest') { Sfx.win(); toast(`🎉 Hoàn thành nhiệm vụ: ${ev.quest.text} (+${ev.quest.xp} XP)`, 3200); }
      if (ev.type === 'badge') { Sfx.win(); confetti(80); toast(`🏅 Huy hiệu mới: ${ev.badge.icon} ${ev.badge.name}`, 3500); }
      if (ev.type === 'level') {
        Sfx.win(); confetti(160);
        modal(`<div class="celebrate"><div class="em">🎖️</div><h2>Lên cấp ${ev.level}!</h2><p class="muted">Danh hiệu mới: <b>${esc(ev.title)}</b></p><button class="btn primary lg" data-close>Tuyệt vời!</button></div>`);
      }
    }
    updateChrome();
    if (window.Sync) Sync.schedule();
    return r;
  }

  // ---------- Thêm từ ----------
  const enrichQueue = [];
  let enriching = false;
  async function enrichLater(word) {
    enrichQueue.push(word);
    if (enriching) return;
    enriching = true;
    while (enrichQueue.length) {
      const w = enrichQueue.shift();
      const c = state.cards[w];
      if (!c || !navigator.onLine) continue;
      const e = await Dict.lookup(w, { image: c.pos === 'n' && !c.image, examples: !(c.sentences || []).length });
      if (e && e.found) {
        const cur = await Cards.patch(w, x => {
          if (!x.image && e.image) x.imageCredit = e.imageCredit || null;
          for (const k of ['ipa', 'ipaUS', 'audio', 'def', 'ex', 'vi', 'image']) if (!x[k] && e[k]) x[k] = e[k];
          if (!(x.sentences || []).length && e.sentences) x.sentences = e.sentences.slice(0, 2);
        });
        if (cur) state.cards[w] = cur;
      }
    }
    enriching = false;
  }

  async function addWord(entry, context, { silent } = {}) {
    const isNew = !inDeck(entry.word);
    const card = await Cards.add(entry, context);
    state.cards[card.word.toLowerCase()] = card;
    // Thêm lẻ → bổ sung dữ liệu ngay; thêm hàng loạt → để dành tới khi thẻ được ôn (tránh hàng trăm lượt gọi API)
    if (isNew && !silent) enrichLater(card.word.toLowerCase());
    updateChrome();
    if (window.Sync) Sync.schedule();
    if (!silent) Sfx.pop();
    return card;
  }

  // ---------- Router ----------
  const routes = {};
  const App = { enrichLater, ORIGINS, origin, forgetting, state, routes, load, reward, addWord, inDeck, allWords, topicOf, updateChrome, saveSettings, streak, activeDays, masteredCount, masteryDots, view };
  window.App = App;

  function parseHash() {
    const raw = location.hash.replace(/^#\/?/, '') || 'home';
    const [path, qs] = raw.split('?');
    const [name, ...rest] = path.split('/');
    return { name, arg: decodeURIComponent(rest.join('/') || ''), query: new URLSearchParams(qs || '') };
  }
  function route() {
    const { name, arg, query } = parseHash();
    const fn = routes[name] || routes.home;
    const navKey = name === 'topic' ? 'library' : name === 'practice' && arg === 'speak' ? 'speak' : name === 'read' ? 'reading' : name;
    $$('#nav a, #bnav a').forEach(a => a.classList.toggle('active', a.dataset.route === navKey));
    UI.stopSpeak();
    document.onkeydown = null;
    if (App.cleanup) { App.cleanup(); App.cleanup = null; }
    view.style.animation = 'none'; void view.offsetWidth; view.style.animation = '';
    fn(arg, query);
    window.scrollTo(0, 0);
  }
  App.route = route;
  window.addEventListener('hashchange', route);
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[href^="#/"]');
    if (a && a.getAttribute('href') === location.hash) { e.preventDefault(); route(); }
  });

  // ---------- Tìm kiếm toàn cục + gợi ý ----------
  (function search() {
    const input = $('#gq'), box = $('#suggest');
    let items = [], idx = -1, timer = null, seq = 0;
    const render = () => {
      box.hidden = !items.length;
      box.innerHTML = items.map((it, i) => `<a href="#/dict/${encodeURIComponent(it.word)}" class="${i === idx ? 'on' : ''}">${it.local ? '📗' : '🔎'} <b>${esc(it.word)}</b><span class="vi">${esc(it.vi || '')}</span></a>`).join('');
    };
    const go = w => { ++seq; items = []; box.hidden = true; input.value = ''; input.blur(); location.hash = `#/dict/${encodeURIComponent(w)}`; };
    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      clearTimeout(timer); idx = -1;
      if (!q) { items = []; ++seq; return render(); }
      const local = Object.keys(INDEX).filter(k => k.startsWith(q)).slice(0, 6).map(k => ({ word: INDEX[k].word, vi: INDEX[k].vi, local: true }));
      items = local; render();
      const my = ++seq;
      timer = setTimeout(async () => {
        try {
          const r = await fetch(`https://api.datamuse.com/sug?s=${encodeURIComponent(q)}&max=8`).then(r => r.json());
          if (my !== seq) return;
          const extra = r.map(x => x.word).filter(w => /^[a-z][a-z' -]*$/.test(w) && !items.some(i => i.word === w)).slice(0, 8 - items.length).map(w => ({ word: w, vi: (INDEX[w] || {}).vi }));
          items = [...items, ...extra]; render();
        } catch (e) { /* offline */ }
      }, 180);
    });
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { idx = Math.min(items.length - 1, idx + 1); render(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { idx = Math.max(-1, idx - 1); render(); e.preventDefault(); }
      else if (e.key === 'Enter') { const w = idx >= 0 ? items[idx].word : input.value.trim(); if (w) go(w); }
      else if (e.key === 'Escape') { box.hidden = true; input.blur(); }
    });
    input.addEventListener('blur', () => setTimeout(() => { box.hidden = true; }, 150));
    box.addEventListener('mousedown', e => { const a = e.target.closest('a'); if (a) { e.preventDefault(); go(decodeURIComponent(a.getAttribute('href').split('/').pop())); } });
    document.addEventListener('keydown', e => {
      if (e.key === '/' && !e.target.matches('input, textarea, select')) { e.preventDefault(); input.focus(); }
    });
  })();

  // ================= TRANG CHỦ =================
  routes.home = function () {
    const cards = Object.values(state.cards);
    const { due, newCount, total } = Cards.dueCount(state.cards, state.settings, state.stats);
    const k = todayKey();
    const gd = state.game.days[k] || {};
    const todayReviews = state.stats.days[k] || 0;
    const goal = state.settings.dailyGoal;
    const st = streak();
    const days = activeDays();
    const L = Game.levelOf(state.game.xp);
    const quests = Game.questsFor(k);
    const doneQ = state.game.questsDone[k] || [];

    // Tuần hiện tại (T2 → CN)
    const now = new Date(); const dow = (now.getDay() + 6) % 7;
    const week = Array.from({ length: 7 }, (_, i) => { const d = new Date(now); d.setDate(now.getDate() - dow + i); return d; });
    const dn = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

    const seed = allWords();
    const w = seed[Math.floor(Date.now() / DAY) % seed.length];
    const h = now.getHours();
    const greet = h < 11 ? 'Chào buổi sáng' : h < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
    const name = state.user ? (state.user.displayName || '').split(' ').pop() : '';

    // Chủ đề đang học dở
    const progressTopics = TOPICS.map(t => ({ t, n: t.words.filter(x => inDeck(x.word)).length })).filter(x => x.n > 0 && x.n < x.t.words.length).slice(0, 3);
    const suggestTopics = progressTopics.length ? progressTopics.map(x => x.t) : TOPICS.filter(t => t.group === 'topics').slice(0, 3);
    const reading = (window.READINGS || [])[Math.floor(Date.now() / DAY) % Math.max(1, (window.READINGS || []).length)];

    view.innerHTML = `
      <div class="hero">
        <div class="card hero-main stack">
          <div class="muted">${greet}${name ? ', ' + esc(name) : ''} 👋</div>
          <div class="row between">
            <div><div class="big-num">${total}</div><div class="muted">thẻ cần học hôm nay</div></div>
            <div class="small" style="text-align:right;line-height:1.9">🔁 ${due} thẻ ôn lại<br>✨ ${newCount} từ mới</div>
          </div>
          <div>
            <div class="row between small"><span>Mục tiêu ôn tập hôm nay</span><b>${todayReviews}/${goal}</b></div>
            <div class="progress"><i style="width:${Math.min(100, todayReviews / goal * 100)}%"></i></div>
          </div>
          ${forgetting().length ? `<a href="#/practice/learn?src=forgetting" class="small" style="color:#fff;background:rgba(255,255,255,.16);padding:.45rem .8rem;border-radius:10px;display:inline-block">⚠️ <b>${forgetting().length} từ sắp quên</b> (độ nhớ &lt; 85%) – ôn nhanh ngay →</a>` : ''}
          <div class="row">
            ${total ? `<a class="btn primary lg" href="#/review">Bắt đầu ôn tập →</a>` : cards.length ? `<a class="btn primary lg" href="#/practice/learn">Học thông minh 🧠</a>` : `<a class="btn primary lg" href="#/library">Chọn bộ từ đầu tiên →</a>`}
            <a class="btn lg" style="background:rgba(255,255,255,.16);color:#fff;border-color:rgba(255,255,255,.3)" href="#/practice">🎯 Luyện tập</a>
          </div>
        </div>
        <div class="card">
          <div class="row between"><h3 style="margin:0">Nhiệm vụ hôm nay</h3><span class="chip">${doneQ.length}/3</span></div>
          ${quests.map(q => { const v = Math.min(q.goal, gd[q.metric] || 0); const ok = doneQ.includes(q.id); return `
            <div class="quest ${ok ? 'done' : ''}"><div class="em">${ok ? '✅' : q.icon}</div>
              <div class="grow"><div class="row between small"><b>${esc(q.text)}</b><span class="muted">+${q.xp} XP</span></div>
              <div class="progress thin xp" style="margin-top:.35rem"><i style="width:${v / q.goal * 100}%"></i></div><div class="tiny muted">${v}/${q.goal}</div></div></div>`; }).join('')}
        </div>
      </div>

      <div class="card" id="todayPlan" style="margin-top:1rem"></div>

      <div class="grid g4 stats" style="margin-top:1rem">
        <div class="card stat"><div class="em">🔥</div><div><b>${st} ngày</b><span class="muted small">Chuỗi học</span></div></div>
        <div class="card stat"><div class="em">⭐</div><div><b>Cấp ${L.level}</b><span class="muted small">${esc(L.title)}</span></div></div>
        <div class="card stat"><div class="em">📒</div><div><b>${cards.length}</b><span class="muted small">Từ trong sổ</span></div></div>
        <div class="card stat"><div class="em">🧠</div><div><b>${masteredCount()}</b><span class="muted small">Đã thuộc</span></div></div>
      </div>

      <div class="grid g2" style="margin-top:1rem">
        <div class="card" id="goldenCard"></div>
        <div class="card">
          <div class="row between"><h3 style="margin:0">Cấp độ nhớ</h3><a class="small" href="#/method">Vì sao? →</a></div>
          ${levelBars()}
        </div>
      </div>

      <div class="grid g2" style="margin-top:1rem">
        <div class="card">
          <div class="row between"><h3 style="margin:0">Tuần này</h3><span class="muted small">${gd.xp || 0} XP hôm nay</span></div>
          <div class="week" style="margin-top:1rem">${week.map((d, i) => `<div>${dn[i]}<i class="${days.has(todayKey(d)) ? 'on' : ''} ${todayKey(d) === k ? 'today' : ''}">${days.has(todayKey(d)) ? '🔥' : d.getDate()}</i></div>`).join('')}</div>
        </div>
        <div class="card wotd" style="grid-template-columns:96px minmax(0,1fr)">
          ${pic(w)}
          <div>
            <div class="tiny muted" style="font-weight:700;text-transform:uppercase;letter-spacing:.06em">Từ của ngày</div>
            <div class="row"><a href="#/dict/${encodeURIComponent(w.word)}" style="font-size:1.4rem;font-weight:800;color:var(--text)">${esc(w.word)}</a>${posChip(w.pos)}${levelChip(w.level)}</div>
            <div class="row"><span class="ipa small">${esc(w.ipa)}</span><button class="icon-btn sm" data-speak="${esc(w.word)}">🔊</button></div>
            <div class="vi" style="font-size:1.05rem">${esc(w.vi)}</div>
            <div class="row" style="margin-top:.4rem">${inDeck(w.word) ? '<span class="chip ok">✓ Đã có trong sổ</span>' : `<button class="btn sm primary" data-add-seed="${esc(w.word)}">+ Flashcard</button>`}</div>
          </div>
        </div>
      </div>

      ${App.pathCurrent && App.pathCurrent() ? (() => { const u = App.pathCurrent(); return `<a class="card hover row nowrap" href="#/path" style="margin-top:1rem;color:var(--text);border-left:5px solid ${u.stage.color}">
        <div style="font-size:2.2rem;width:60px;height:60px;border-radius:18px;display:grid;place-items:center;background:var(--surface-2)">${u.topic.emoji}</div>
        <div class="grow"><div class="tiny muted" style="font-weight:700;text-transform:uppercase">🗺️ Lộ trình · ${esc(u.stage.name)}</div><h3 style="margin:.1rem 0">Bài tiếp theo: ${esc(u.topic.name)}</h3>
        <div class="progress thin" style="max-width:320px"><i style="width:${Math.round(u.pct * 100)}%"></i></div></div><span class="btn sm primary">Tiếp tục →</span></a>`; })() : ''}

      <div class="section-title"><h2>Chế độ luyện tập</h2><a href="#/practice">Tất cả →</a></div>
      <div class="modes">${modeTiles().slice(0, 6).join('')}</div>

      <div class="section-title"><h2>${progressTopics.length ? 'Học tiếp' : 'Gợi ý cho bạn'}</h2><a href="#/library">Thư viện →</a></div>
      <div class="grid g3">${suggestTopics.map(topicCard).join('')}</div>

      ${reading ? `<div class="section-title"><h2>Bài đọc hôm nay</h2><a href="#/reading">Tất cả bài đọc →</a></div>
      <a class="card hover row nowrap" href="#/read/${reading.id}" style="color:var(--text)">
        <div style="font-size:2.4rem">${reading.emoji}</div>
        <div class="grow"><div class="row"><h3 style="margin:0">${esc(reading.title)}</h3>${levelChip(reading.level)}</div><div class="muted small">${esc(reading.summaryVi)}</div></div>
        <span class="btn sm">Đọc →</span></a>` : ''}
    `;
    bindCommon();
    const drawGolden = () => {
      const el = $('#goldenCard'); if (!el) return;
      const now = Golden.dueNow(state.cards);
      const nx = Golden.next(state.cards);
      if (now) {
        el.innerHTML = `<div class="row nowrap"><div style="font-size:2.4rem">⏰</div><div class="grow"><h3 style="margin:0">Đang là thời điểm vàng!</h3>
          <div class="muted small"><b style="color:var(--again)">${now} từ</b> đang ở thời điểm sắp quên – ôn ngay để nhớ lâu nhất.</div></div></div>
          <a class="btn primary block" style="margin-top:.8rem" href="#/review">Ôn ${now} từ ngay →</a>`;
      } else if (nx) {
        const ms = nx.at - Date.now(), h = Math.floor(ms / 3600000), m = Math.ceil(ms % 3600000 / 60000);
        el.innerHTML = `<div class="row nowrap"><div style="font-size:2.4rem">⏳</div><div class="grow"><h3 style="margin:0">Thời điểm vàng tiếp theo</h3>
          <div class="muted small">Còn <b style="color:var(--primary);font-size:1.1rem">${h ? `${h} giờ ` : ''}${m} phút</b> · ${nx.count} từ sẽ cần ôn</div></div></div>
          <p class="small muted" style="margin:.6rem 0 0">Vocaband sẽ nhắc bạn đúng lúc từ sắp bị quên. Trong lúc chờ, hãy học thêm từ mới hoặc chơi Ghép thẻ.</p>`;
      } else {
        const fresh = Cards.dueCount(state.cards, state.settings, state.stats).newCount;
        el.innerHTML = `<div class="row nowrap"><div style="font-size:2.4rem">🌱</div><div><h3 style="margin:0">Chưa có lịch ôn</h3><div class="muted small">Học từ mới đầu tiên – Vocaband sẽ tự tính “thời điểm vàng” để nhắc bạn ôn đúng lúc sắp quên.</div></div></div>
          <div class="row" style="margin-top:.9rem">${fresh ? `<a class="btn primary" href="#/review">✨ Học ${fresh} từ mới ngay</a>` : '<a class="btn primary" href="#/library">📚 Chọn bộ từ</a>'}<a class="btn" href="#/method">Thời điểm vàng là gì?</a></div>
          <div class="tiny muted" style="margin-top:.8rem">Đường cong quên lãng: sau 1 ngày bạn quên ~50% từ mới học – ôn đúng lúc giúp nhớ gần như mãi mãi.</div>`;
      }
    };
    drawGolden();
    if (App.todayPlan) App.todayPlan().then(tasks => {
      const el = $('#todayPlan'); if (!el) return;
      const n = tasks.filter(t => t.done).length;
      const pl = state.settings.placement;
      el.innerHTML = `<div class="row between"><h3 style="margin:0">📋 Kế hoạch hôm nay <span class="muted small">· cá nhân hóa${pl ? ` theo band ${esc(pl.band)}` : ''}</span></h3><span class="chip ${n === tasks.length ? 'ok' : ''}">${n}/${tasks.length}</span></div>
        <div class="plan">${tasks.map((t, i) => `<a class="plan-item ${t.done ? 'done' : ''}" href="${t.href}"><span class="pi-num">${t.done ? '✓' : i + 1}</span><span class="pi-em">${t.em}</span><div class="grow"><b>${esc(t.t)}</b><div class="tiny muted">${esc(t.sub)}</div></div><span class="muted">→</span></a>`).join('')}</div>`;
    });
    const gt = setInterval(drawGolden, 30000);
    App.cleanup = () => clearInterval(gt);
  };

  function levelBars() {
    const n = [0, 0, 0, 0, 0, 0];
    Object.values(state.cards).forEach(c => n[SRS.level5(c.srs)]++);
    if (!n.slice(1).some(Boolean)) return `<div class="empty" style="padding:1.2rem .5rem"><div style="font-size:2rem">📶</div><div class="small">Từ của bạn sẽ đi qua <b>5 cấp độ nhớ</b>: từ “mới học” (cấp 1) đến “nhớ lâu dài” (cấp 5) sau mỗi lần ôn đúng lúc.</div><div class="row center" style="margin-top:.6rem;gap:.3rem">${[1, 2, 3, 4, 5].map(i => `<span class="chip">Cấp ${i}</span>`).join('→')}</div></div>`;
    const max = Math.max(1, ...n.slice(1));
    const col = ['', '#e5484d', '#f59e0b', '#eab308', '#22c55e', '#0ea5a4'];
    const lab = ['', '< 1 ngày', '1–3 ngày', '4–10 ngày', '11–30 ngày', '> 1 tháng'];
    return `<div class="bars" style="height:130px;margin-top:.8rem">${[1, 2, 3, 4, 5].map(i => `<a href="#/practice/learn?src=level:${i}" title="Cấp ${i}: ${lab[i]} – bấm để ôn" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:4px;height:100%;color:var(--text)">
      <em>${n[i]}</em><i style="height:${n[i] ? Math.max(8, n[i] / max * 80) : 3}px;background:${n[i] ? col[i] : 'var(--line)'};width:100%;max-width:34px;border-radius:8px 8px 3px 3px"></i><small style="font-weight:800">Cấp ${i}</small></a>`).join('')}</div>
      <div class="tiny muted center" style="margin-top:.4rem">${n[0]} từ chưa học · bấm vào cột để ôn theo cấp</div>`;
  }

  function modeTiles() {
    return [
      ['learn', '🧠', 'Học thông minh', 'Trắc nghiệm → gõ từ, thích ứng theo bạn', '#ecebff'],
      ['match', '⚡', 'Ghép thẻ', 'Ghép từ với nghĩa thật nhanh', '#fff4dc'],
      ['speak', '🎙️', 'Luyện phát âm', 'Nói vào micro, chấm điểm ngay', '#fde8f3'],
      ['mcq', '🧩', 'Trắc nghiệm', 'Chọn nghĩa đúng', '#e3f7ea'],
      ['cloze', '✍️', 'Điền từ', 'Hoàn thành câu IELTS', '#dff6f5'],
      ['listen', '🎧', 'Nghe & chép', 'Nghe phát âm, gõ lại', '#e6f0ff'],
      ['test', '📝', 'Bài kiểm tra', '20 câu tổng hợp, chấm điểm', '#f3e8ff'],
      ['write', '✍️', 'Phòng viết', 'Viết Task 2, phân tích từ vựng', '#fff1e6'],
      ['speaking', '🗣️', 'Phòng Speaking', 'Part 1–3, ghi âm, chấm từ vựng', '#e0f2fe'],
    ].map(([id, em, name, desc, bg]) => `<a class="mode" href="${id === 'write' || id === 'speaking' ? '#/' + id : '#/practice/' + id}"><span class="em" style="background:${bg}">${em}</span><b>${name}</b><span class="muted small">${desc}</span></a>`);
  }
  App.modeTiles = modeTiles;

  function topicCard(t) {
    const n = t.words.filter(w => inDeck(w.word)).length;
    const pct = n / t.words.length * 100;
    const lv = [...new Set(t.words.map(w => w.level).filter(Boolean))].sort().join(' · ');
    return `<a class="card hover topic-card" href="#/topic/${t.id}" style="color:var(--text)">
      <div class="row between nowrap"><span class="em">${t.emoji}</span>${ring(pct, `${n}/${t.words.length}`, pct === 100 ? 'var(--good)' : '')}</div>
      <h3>${esc(t.name)}</h3>
      <div class="muted small" style="min-height:2.6em">${esc(t.desc)}</div>
      <div class="row"><span class="chip">${t.words.length} từ</span>${lv ? `<span class="chip">${esc(lv)}</span>` : ''}</div>
    </a>`;
  }
  App.topicCard = topicCard;

  // ================= THƯ VIỆN =================
  routes.library = function (arg, query) {
    const tab = query.get('g') || 'all';
    const total = Object.keys(INDEX).length;
    view.innerHTML = `
      <div class="page-head"><div><h1>Thư viện từ vựng</h1><p class="muted">${total.toLocaleString('vi-VN')} từ & cụm từ trong ${TOPICS.length} bộ – phiên âm Anh–Anh, cấp độ CEFR, collocation và câu ví dụ IELTS.</p></div>
        <input class="input" id="libQ" placeholder="Lọc bộ từ…" style="max-width:240px"></div>
      <div class="tabs" id="libTabs">
        <button data-g="all" class="${tab === 'all' ? 'on' : ''}">Tất cả</button>
        ${GROUPS.map(g => `<button data-g="${g.id}" class="${tab === g.id ? 'on' : ''}">${g.emoji} ${esc(g.name)}</button>`).join('')}
        <button data-g="mine" class="${tab === 'mine' ? 'on' : ''}">📌 Đang học</button>
      </div>
      <div id="libBody" style="margin-top:1.2rem"></div>`;
    const draw = () => {
      const q = $('#libQ').value.trim().toLowerCase();
      const g = $('#libTabs .on').dataset.g;
      const match = t => (!q || t.name.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q) || t.words.some(w => w.word.toLowerCase() === q));
      const groups = g === 'all' ? GROUPS : g === 'mine' ? [{ id: 'mine', name: 'Bộ từ đang học', emoji: '📌', desc: '' }] : GROUPS.filter(x => x.id === g);
      $('#libBody').innerHTML = groups.map(gr => {
        const ts = TOPICS.filter(t => (gr.id === 'mine' ? t.words.some(w => inDeck(w.word)) : t.group === gr.id) && match(t));
        const mineHtml = gr.id === 'mine' ? personalCollections() : '';
        if (!ts.length) return gr.id === 'mine' ? (mineHtml || '<div class="card empty"><div class="em">📌</div>Bạn chưa lưu từ nào. Tra từ, đọc bài hoặc dùng add-on khi xem YouTube để bắt đầu.</div>') : '';
        if (mineHtml) return mineHtml + `<div class="section-title"><h2>📚 Bộ từ IELTS đang học</h2></div><div class="grid auto">${ts.map(topicCard).join('')}</div>`;
        return `<div class="section-title" style="margin-top:${g === 'all' ? '1.6rem' : '0'}"><h2>${gr.emoji} ${esc(gr.name)}</h2><span class="muted small">${esc(gr.desc)}</span></div>
          <div class="grid auto">${ts.map(topicCard).join('')}</div>`;
      }).join('') || '<div class="card empty"><div class="em">🔍</div>Không tìm thấy bộ từ phù hợp.</div>';
    };
    $$('#libTabs button').forEach(b => b.onclick = () => { $$('#libTabs button').forEach(x => x.classList.toggle('on', x === b)); history.replaceState(null, '', `#/library?g=${b.dataset.g}`); draw(); });
    $('#libQ').oninput = draw;
    draw();
  };

  function personalCollections() {
    const groups = {};
    Object.values(state.cards).forEach(c => { const o = origin(c); (groups[o] = groups[o] || []).push(c); });
    const keys = Object.keys(ORIGINS).filter(k => groups[k]);
    if (!keys.length) return '';
    return `<div class="section-title" style="margin-top:0"><h2>📌 Thư viện của tôi</h2><span class="muted small">Tự động phân loại theo nơi bạn gặp từ</span></div>
      <div class="grid auto">${keys.map(k => { const list = groups[k]; const m = list.filter(c => SRS.mastery(c.srs) === 3).length; const due = list.filter(c => (c.srs.reps > 0 || c.srs.last) && c.srs.due <= endOfToday()).length; return `
        <a class="card hover topic-card" href="#/deck?from=${k}" style="color:var(--text)">
          <div class="row between nowrap"><span class="em">${ORIGINS[k].emoji}</span>${ring(m / list.length * 100, `${m}/${list.length}`, 'var(--good)')}</div>
          <h3>${ORIGINS[k].name}</h3><div class="muted small">${ORIGINS[k].desc}</div>
          <div class="row"><span class="chip">${list.length} từ</span>${due ? `<span class="chip lv">🔁 ${due} cần ôn</span>` : ''}</div></a>`; }).join('')}</div>`;
  }
  App.personalCollections = personalCollections;

  routes.topic = function (id) {
    const t = topicOf(id);
    if (!t) return routes.library('', new URLSearchParams());
    const levels = [...new Set(t.words.map(w => w.level).filter(Boolean))].sort();
    const missing = () => t.words.filter(w => !inDeck(w.word));
    const gname = (GROUPS.find(g => g.id === t.group) || {}).name || '';
    view.innerHTML = `
      <a href="#/library?g=${t.group}" class="small">← ${esc(gname)}</a>
      <div class="card" style="margin:.7rem 0 1rem;display:flex;gap:1.2rem;align-items:center;flex-wrap:wrap">
        <div style="font-size:3rem;width:80px;height:80px;border-radius:22px;display:grid;place-items:center;background:var(--surface-2)">${t.emoji}</div>
        <div class="grow"><h1 style="margin:0">${esc(t.name)}</h1><div class="muted">${esc(t.desc)}</div>
          <div class="row" style="margin-top:.5rem"><span class="chip">${t.words.length} từ</span><span class="chip ok" id="tCount"></span></div></div>
        <div class="row">
          <button class="btn primary" id="addAll"></button>
          <a class="btn" href="#/practice/learn?src=topic:${t.id}">🧠 Học</a>
          <a class="btn" href="#/practice/match?src=topic:${t.id}">⚡ Ghép thẻ</a>
          <a class="btn" href="#/practice/test?src=topic:${t.id}">📝 Kiểm tra</a>
        </div>
      </div>
      ${levels.length > 1 ? `<div class="tabs" id="lvTabs" style="margin-bottom:1rem;display:inline-flex"><button class="on" data-lv="">Tất cả</button>${levels.map(l => `<button data-lv="${l}">${l}</button>`).join('')}</div>` : ''}
      <div class="card" id="wordList"></div>`;
    const header = () => {
      const m = missing().length;
      $('#tCount').textContent = `${t.words.length - m} đã thêm`;
      const b = $('#addAll');
      b.textContent = m ? `+ Thêm ${m} từ vào flashcard` : '✓ Đã thêm toàn bộ';
      b.disabled = !m;
    };
    let lv = '';
    const draw = () => {
      $('#wordList').innerHTML = t.words.filter(w => !lv || w.level === lv).map(w => `
        <div class="word-row">
          <div class="em">${esc(w.emoji || '📘')}</div>
          <div style="min-width:0">
            <div class="row"><a class="w" href="#/dict/${encodeURIComponent(w.word)}">${esc(w.word)}</a>${posChip(w.pos)}${levelChip(w.level)}
              ${w.ipa ? `<span class="ipa small">${esc(w.ipa)}</span>` : ''}<button class="icon-btn sm" data-speak="${esc(w.word)}" aria-label="Phát âm">🔊</button></div>
            <div><b class="vi" style="font-size:1rem">${esc(w.vi)}</b>${w.def ? ` <span class="muted small">— ${esc(w.def)}</span>` : ''}</div>
            ${w.ex ? `<div class="ex small">“${highlight(w.ex, w.word)}”</div>` : ''}
            ${w.col.length ? `<div class="small" style="margin-top:.2rem">🔗 ${w.col.map(esc).join(' · ')}</div>` : ''}
          </div>
          <div>${inDeck(w.word) ? '<span class="chip ok">✓ Đã thêm</span>' : `<button class="btn sm" data-add-seed="${esc(w.word)}" data-topic="${t.id}">+ Thêm</button>`}</div>
        </div>`).join('');
      bindCommon(header);
    };
    header(); draw();
    $$('#lvTabs button').forEach(b => b.onclick = () => { $$('#lvTabs button').forEach(x => x.classList.toggle('on', x === b)); lv = b.dataset.lv; draw(); });
    $('#addAll').onclick = async () => {
      const list = missing();
      $('#addAll').disabled = true;
      for (const w of list) await addWord(w, null, { silent: true });
      Sfx.win(); toast(`Đã thêm ${list.length} từ – vào Ôn tập hoặc Học thông minh để bắt đầu!`);
      header(); draw();
    };
  };

  // ================= TỪ ĐIỂN =================
  const lookedUp = new Set();
  routes.dict = async function (q) {
    const recent = await Store.get('recent', []);
    view.innerHTML = `
      <div class="page-head"><div><h1>Từ điển Anh – Việt</h1><p class="muted">Định nghĩa Oxford Languages · phiên âm UK/US · câu song ngữ · collocation · từ liên quan</p></div></div>
      <form class="search" id="searchForm" autocomplete="off">
        <input class="input" id="q" placeholder="Nhập từ tiếng Anh, ví dụ: sustainable" value="${esc(q)}" spellcheck="false" autocapitalize="off" autocorrect="off">
        <button class="btn primary lg">Tra từ</button>
      </form>
      ${recent.length ? `<div class="row small" style="margin-top:.7rem"><span class="muted">Gần đây:</span>${recent.map(r => `<a class="chip" href="#/dict/${encodeURIComponent(r)}">${esc(r)}</a>`).join('')}</div>` : ''}
      <div id="result" style="margin-top:1.25rem"></div>`;
    $('#searchForm').onsubmit = e => { e.preventDefault(); const v = $('#q').value.trim(); if (v) location.hash = `#/dict/${encodeURIComponent(v)}`; };
    if (!q) {
      $('#q').focus();
      const sample = ['resilient', 'mitigate', 'phenomenon', 'detrimental', 'ubiquitous', 'paradigm'];
      $('#result').innerHTML = `<div class="card empty"><div class="em">📖</div><h3>Tra bất kỳ từ tiếng Anh nào</h3><p>Phiên âm UK/US, nghĩa tiếng Việt theo từ loại, định nghĩa Oxford Languages, câu ví dụ song ngữ, hình minh họa — rồi lưu vào flashcard kèm câu ngữ cảnh của riêng bạn.</p>
        <div class="row center" style="margin-top:1rem">${sample.map(s => `<a class="chip" href="#/dict/${s}">${s}</a>`).join('')}</div>
        <p class="small" style="margin-top:1rem">💡 Cài <b>add-on Chrome</b> để bấm đúp vào từ hoặc bôi đen câu trên bất kỳ trang web nào.</p></div>`;
      return;
    }
    $('#result').innerHTML = `<div class="card empty"><div class="em">⏳</div>Đang tra “${esc(q)}”…</div>`;
    // Hiện kết quả nhanh trước (nghĩa, phiên âm), rồi bổ sung âm thanh, hình, câu ví dụ
    let spoke = false;
    const same = () => Dict.normWord(parseHash().arg) === Dict.normWord(q);
    const fast = await Dict.quick(q);
    if (!same()) return;
    if (fast) paint(fast, false);
    const full = await Dict.lookup(q);
    if (!same()) return;
    if (!full || !full.found) {
      if (!fast) $('#result').innerHTML = `<div class="card empty"><div class="em">🤔</div><p>Không tìm thấy “${esc(q)}”.${full && full.vi ? ` Gợi ý dịch: <b>${esc(full.vi)}</b>` : ''}</p><p class="small">Kiểm tra chính tả hoặc kết nối mạng.</p></div>`;
      return;
    }
    Store.set('recent', [full.word, ...recent.filter(r => r !== full.word)].slice(0, 8));
    const lk = todayKey() + ':' + full.word;
    if (!lookedUp.has(lk)) { lookedUp.add(lk); reward({ lookups: 1 }); }
    paint(full, true);

    function paint(e, final) {
    const keep = $('#ctx') ? $('#ctx').value : '';
    const card = state.cards[e.word];

    $('#result').innerHTML = `
      <div class="card">
        <div class="entry-head">
          <div>
            <div class="row"><span class="entry-word">${esc(e.word)}</span>${posChip(e.pos)}${levelChip(e.level)}</div>
            <div class="pron">
              <span><b class="small">🇬🇧 UK</b> <span class="ipa">${esc(e.ipa || '—')}</span><button class="icon-btn sm" data-speak="${esc(e.word)}" data-accent="en-GB" data-url="${esc(e.audio && /-uk/.test(e.audio) ? e.audio : '')}">🔊</button></span>
              <span><b class="small">🇺🇸 US</b> <span class="ipa">${esc(e.ipaUS || '—')}</span><button class="icon-btn sm" data-speak="${esc(e.word)}" data-accent="en-US" data-url="${esc(e.audioUS || '')}">🔊</button></span>
              <span><b class="small">🐢 Chậm</b><button class="icon-btn sm" data-slow="${esc(e.word)}" title="Nghe chậm">🔊</button></span>
            </div>
            <div class="vi">${esc(e.vi)}</div>
            ${e.def ? `<div style="margin-top:.4rem">${esc(e.def)}</div>` : ''}
            <div class="row" style="margin-top:.8rem">
              ${card ? '<span class="chip ok">✓ Đã có trong flashcard</span>' : '<button class="btn primary" id="quickSave">+ Lưu flashcard</button>'}
              <a class="btn" href="#/practice/speak?w=${encodeURIComponent(e.word)}">🎙️ Luyện phát âm</a>
            </div>
          </div>
          ${pic(e)}
        </div>
        ${e.ex ? `<div class="example-box" style="margin-top:1rem"><div class="small muted">Ví dụ</div>${highlight(e.ex, e.word)} <button class="icon-btn sm" data-speak-text="${esc(e.ex)}">🔊</button></div>` : ''}
        ${e.col.length ? `<div style="margin-top:1rem"><b>🔗 Collocations:</b> ${e.col.map(c => `<span class="chip">${esc(c)}</span>`).join(' ')}</div>` : ''}
        ${e.syn.length ? `<div style="margin-top:.6rem"><b>≈ Đồng nghĩa:</b> ${e.syn.map(s => `<a class="chip" href="#/dict/${encodeURIComponent(s)}">${esc(s)}</a>`).join(' ')}</div>` : ''}
        <div id="related"></div>
        <div id="phraseBox"></div>
        ${(e.senses || []).length ? `<div style="margin-top:1.2rem"><h3>🇻🇳 Nghĩa tiếng Việt theo từ loại</h3>${e.senses.map(s => `
          <div class="meaning"><span class="chip pos">${esc(s.pos)}</span> ${s.terms.map(esc).join(', ')}</div>`).join('')}</div>` : ''}
        ${(e.oxford || []).length ? `<div style="margin-top:1rem"><h3>📕 Định nghĩa <span class="muted small">(Oxford Languages)</span></h3>${e.oxford.map(m => `
          <div class="meaning"><span class="chip pos">${esc(m.pos)}</span>
            <ol>${m.defs.map(d => `<li>${esc(d.def)}${d.ex ? `<div class="ex small">“${highlight(d.ex, e.word)}”</div>` : ''}</li>`).join('')}</ol></div>`).join('')}</div>` : ''}
        ${e.meanings.length ? `<details style="margin-top:.8rem"${(e.oxford || []).length ? '' : ' open'}><summary class="small"><b>Định nghĩa bổ sung</b> <span class="muted">(Wiktionary)</span></summary>${e.meanings.map(m => `
          <div class="meaning"><span class="chip pos">${esc(m.pos)}</span>
            <ol>${m.defs.map(d => `<li>${esc(d.def)}${d.ex ? `<div class="ex small">“${highlight(d.ex, e.word)}”</div>` : ''}</li>`).join('')}</ol></div>`).join('')}</details>` : ''}
      </div>

      ${(e.sentences || []).length ? `<div class="card" style="margin-top:1rem">
        <h3>💬 Câu ví dụ song ngữ</h3>
        ${e.sentences.map(s => `<div class="meaning"><div>${highlight(s.en, e.word)} <button class="icon-btn sm" data-speak-text="${esc(s.en)}">🔊</button></div><div class="muted small">${esc(s.vi)} <span class="chip">${s.auto ? 'Oxford · dịch máy' : 'Tatoeba'}</span></div>
          <button class="btn sm ghost" data-use-sent="${esc(s.en)}">📌 Dùng làm ngữ cảnh</button></div>`).join('')}
      </div>` : ''}

      <div class="card" style="margin-top:1rem" id="saveCard">
        <h3>${card ? '📌 Thêm ngữ cảnh cho từ này' : '➕ Lưu vào flashcard kèm ngữ cảnh'}</h3>
        <label class="field"><span class="muted small" style="font-weight:500">Câu bạn gặp từ này (bài đọc, phim, báo…) – ngữ cảnh giúp nhớ lâu gấp nhiều lần</span>
          <textarea class="input" id="ctx" placeholder="Dán câu có chứa “${esc(e.word)}”…"></textarea></label>
        <div id="ctxVi" class="muted small" style="margin-top:.4rem"></div>
        <div class="row" style="margin-top:.7rem">
          <button class="btn" id="trCtx">🌐 Dịch câu</button>
          <button class="btn primary" id="saveWord">${card ? 'Thêm ngữ cảnh' : 'Lưu vào flashcard'}</button>
          ${card ? `<span class="muted small">${card.contexts.length} ngữ cảnh · ${masteryDots(card.srs)}</span>` : ''}
        </div>
      </div>`;
    bindCommon();
    if (!spoke && state.settings.autoSpeak) { spoke = true; speak(e.word, state.settings.accent, state.settings.accent === 'en-US' ? e.audioUS : e.audio); }
    if (final) { loadRelated(e); drawPhrases(e); }
    if (keep) { $('#ctx').value = keep; }

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
      $('#saveCard').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    const save = async () => {
      const text = $('#ctx').value.trim();
      if (text && !ctxVi) await trCtx();
      await addWord(e, text ? { text, vi: ctxVi, source: '', title: 'Ghi chú của bạn' } : null);
      toast(card ? 'Đã cập nhật thẻ' : `Đã lưu “${e.word}” vào flashcard`);
      location.hash === `#/dict/${encodeURIComponent(e.word)}` ? routes.dict(e.word) : (location.hash = `#/dict/${encodeURIComponent(e.word)}`);
    };
    $('#saveWord').onclick = save;
    const qs = $('#quickSave'); if (qs) qs.onclick = save;
    }
  };

  // Cụm từ & cấu trúc chứa từ đang tra: từ thư viện + sổ cụm từ của người học
  function drawPhrases(e) {
    const el = $('#phraseBox'); if (!el) return;
    const re = UI.wordRegex(e.word);
    const lib = Object.values(INDEX).filter(w => /\s/.test(w.word) && re.test(w.word)).slice(0, 10);
    const mine = Object.values(state.cards).filter(c => /\s/.test(c.word) && re.test(c.word) && !lib.some(l => l.word === c.word)).slice(0, 10);
    const row = (w, own) => `<div class="phr"><b>${esc(w.word)}</b> <span class="small" style="color:var(--accent);font-weight:700">${esc(w.vi || '')}</span>${w.ex ? `<div class="ex small">“${UI.highlight(w.ex, w.word)}”</div>` : ''}${w.note ? `<div class="tiny muted">📐 ${esc(w.note)}</div>` : ''}
      <div class="row" style="margin-top:.2rem"><button class="icon-btn sm" data-speak="${esc(w.word)}">🔊</button>${own || inDeck(w.word) ? '<span class="chip ok">✓ Đã lưu</span>' : `<button class="btn sm ghost" data-add-seed="${esc(w.word)}">+ Lưu cụm</button>`}</div></div>`;
    el.innerHTML = `<div style="margin-top:1rem"><div class="row between"><h3 style="margin:0">🧩 Cụm từ & cấu trúc với “${esc(e.word)}”</h3><button class="btn sm" id="addPhr">＋ Lưu cụm / cấu trúc của bạn</button></div>
      ${lib.length || mine.length ? `<div class="phr-grid">${lib.map(w => row(w, false)).join('')}${mine.map(c => row(c, true)).join('')}</div>` : '<p class="small muted" style="margin:.4rem 0 0">Chưa có cụm nào trong thư viện. Mẹo: <b>bôi đen một cụm trong câu ví dụ</b> phía trên rồi bấm “🧩 Lưu cụm này”.</p>'}</div>`;
    bindCommon();
    $('#addPhr').onclick = () => App.savePhraseDialog({ phrase: e.word + ' ', sentence: e.ex || '' });
  }

  // Từ liên quan (Datamuse): tính từ hay đi kèm, danh từ hay đi kèm, trái nghĩa, gần nghĩa
  async function loadRelated(e) {
    const w = encodeURIComponent(e.word);
    const get = async u => { try { const r = await fetch(u).then(r => r.json()); return Array.isArray(r) ? r : []; } catch (x) { return []; } };
    // Danh từ → tính từ hay đi kèm; tính từ → danh từ hay đi sau (tránh cụm vô nghĩa)
    const isNoun = /^n|danh/.test(e.pos || ''), isAdj = /^adj|tính/.test(e.pos || '');
    const STOP = new Set(['more', 'most', 'less', 'least', 'very', 'other', 'such', 'same', 'own', 'many', 'much', 'few', 'several', 'certain', 'various', 'error', 'orthogonal']);
    const [jjb0, jja, ant, ml] = await Promise.all([
      isNoun || !isAdj ? get(`https://api.datamuse.com/words?rel_jjb=${w}&max=14`) : [],
      isAdj ? get(`https://api.datamuse.com/words?rel_jja=${w}&max=10`) : [],
      get(`https://api.datamuse.com/words?rel_ant=${w}&max=6`),
      get(`https://api.datamuse.com/words?ml=${w}&max=16&md=f`),
    ]);
    const jjb = isAdj ? [] : jjb0.filter(x => !STOP.has(x.word) && x.score > 300).slice(0, 10);
    const el = $('#related'); if (!el || parseHash().arg !== e.word && parseHash().arg.toLowerCase() !== e.word) return;
    const chips = (arr, fmt) => arr.map(x => `<a class="chip" href="#/dict/${encodeURIComponent(x.word)}">${esc(fmt(x.word))}</a>`).join(' ');
    let html = '';
    if (jjb.length) html += `<div style="margin-top:.6rem"><b>🧩 Tính từ hay đi với “${esc(e.word)}”:</b> ${chips(jjb, x => `${x} ${e.word}`)}</div>`;
    if (jja.length) html += `<div style="margin-top:.6rem"><b>🧩 Danh từ hay đi sau:</b> ${chips(jja, x => `${e.word} ${x}`)}</div>`;
    if (ant.length) html += `<div style="margin-top:.6rem"><b>↔ Trái nghĩa:</b> ${chips(ant, x => x)}</div>`;
    const syn = new Set(e.syn);
    const stemE = e.word.slice(0, Math.max(5, e.word.length - 4));
    const mlf = ml.filter(x => !syn.has(x.word) && !/\s/.test(x.word) && !x.word.startsWith(stemE) && !e.word.startsWith(x.word.slice(0, 6)) && +(((x.tags || []).find(t => t.startsWith('f:')) || 'f:0').slice(2)) >= 1).slice(0, 8);
    if (mlf.length) html += `<div style="margin-top:.6rem"><b>🔀 Từ gần nghĩa:</b> ${chips(mlf, x => x)}</div>`;
    el.innerHTML = html;
  }

  // ================= SỔ TỪ =================
  routes.deck = function (arg, query) {
    const from = query && query.get('from') || '';
    const list = Object.values(state.cards);
    view.innerHTML = `
      <div class="page-head"><div><h1>Sổ từ của bạn</h1><p class="muted">${list.length} từ · ${masteredCount()} đã thuộc</p></div>
        <div class="row"><a class="btn sm" href="#/practice/learn?src=deck">🧠 Học</a><a class="btn sm" href="#/practice/test?src=deck">📝 Kiểm tra</a><button class="btn sm" id="exportBtn">⬇️ Xuất</button><label class="btn sm">⬆️ Nhập<input type="file" id="importFile" accept="application/json" hidden></label></div></div>
      <div class="grid g4" style="margin-bottom:1rem">
        <input class="input" id="filterQ" placeholder="Tìm từ hoặc nghĩa…">
        <select class="input" id="filterTopic"><option value="">Tất cả bộ từ</option>${TOPICS.map(t => `<option value="${t.id}">${t.emoji} ${esc(t.name)}</option>`).join('')}<option value="mine">📌 Từ tự thêm</option></select>
        <select class="input" id="filterFrom"><option value="">Mọi nguồn</option>${Object.entries(ORIGINS).map(([k, o]) => `<option value="${k}" ${from === k ? 'selected' : ''}>${o.emoji} ${o.name}</option>`).join('')}<option value="forget" ${from === 'forget' ? 'selected' : ''}>⚠️ Sắp quên</option></select>
        <select class="input" id="filterM"><option value="">Mọi mức độ</option><option value="0">Chưa học</option><option value="1">Đang học</option><option value="2">Quen</option><option value="3">Đã thuộc</option></select>
      </div>
      <div class="card" id="deckList"></div>`;
    const draw = () => {
      const q = $('#filterQ').value.trim().toLowerCase(), tp = $('#filterTopic').value, m = $('#filterM').value, fr = $('#filterFrom').value;
      const forgetSet = new Set(forgetting().map(c => c.word));
      const rows = list.filter(c => (!q || c.word.includes(q) || (c.vi || '').toLowerCase().includes(q)) && (!tp || c.topic === tp) && (m === '' || SRS.mastery(c.srs) === +m)
        && (!fr || (fr === 'forget' ? forgetSet.has(c.word) : origin(c) === fr))).sort((a, b) => fr === 'forget' ? SRS.retention(a.srs) - SRS.retention(b.srs) : b.added - a.added);
      $('#deckList').innerHTML = rows.length ? rows.slice(0, 400).map(c => `
        <div class="deck-row">
          <div class="em">${c.image ? `<img src="${esc(c.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : esc(c.emoji)}</div>
          <div style="min-width:0"><a href="#/dict/${encodeURIComponent(c.word)}"><b>${esc(c.word)}</b></a> <span class="ipa small">${esc(c.ipa)}</span><div class="small">${esc(c.vi)}</div></div>
          <div class="small muted hide-sm">${c.contexts[0] ? `📌 “${highlight(c.contexts[0].text.slice(0, 110), c.word)}${c.contexts[0].text.length > 110 ? '…' : ''}”` : esc((c.def || '').slice(0, 110))}</div>
          <div class="hide-sm small muted" style="text-align:right" title="Đến hạn ${new Date(c.srs.due).toLocaleDateString('vi-VN')}">${masteryDots(c.srs)}${SRS.retention(c.srs) != null ? `<div class="tiny">🧠 ${Math.round(SRS.retention(c.srs) * 100)}%</div>` : ''}</div>
          <div class="row nowrap" style="gap:.3rem"><button class="icon-btn sm" data-speak="${esc(c.word)}" data-url="${esc(c.audio)}">🔊</button><button class="icon-btn sm" data-edit="${esc(c.word)}" title="Sửa">✏️</button></div>
        </div>`).join('') + (rows.length > 400 ? `<p class="muted small center">Hiển thị 400/${rows.length} từ – dùng bộ lọc để thu hẹp.</p>` : '')
        : `<div class="empty"><div class="em">📒</div>${list.length ? 'Không có từ phù hợp bộ lọc.' : 'Sổ từ đang trống. Hãy thêm từ từ <a href="#/library">thư viện</a> hoặc <a href="#/dict">tra từ</a>.'}</div>`;
      bindCommon();
      $$('[data-edit]').forEach(b => b.onclick = () => editCard(b.dataset.edit, draw));
    };
    ['filterQ', 'filterTopic', 'filterM', 'filterFrom'].forEach(id => $('#' + id).addEventListener('input', draw));
    draw();
    $('#exportBtn').onclick = exportData;
    $('#importFile').onchange = importData;
  };

  async function exportData() {
    const blob = new Blob([JSON.stringify({ app: 'ielts-lexi', version: 2, exported: new Date().toISOString(), cards: state.cards, stats: state.stats, game: state.game, settings: state.settings }, null, 2)], { type: 'application/json' });
    download(blob, `ielts-lexi-${todayKey()}.json`);
  }
  async function importData(e) {
    const f = e.target.files[0]; if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!data.cards) throw new Error();
      await Cards.save({ ...state.cards, ...data.cards });
      if (data.stats) { const s = state.stats; for (const [k, v] of Object.entries(data.stats.days || {})) s.days[k] = Math.max(s.days[k] || 0, v); await Store.set('stats', s); }
      if (data.game && data.game.xp > state.game.xp) await Store.set('game', data.game);
      await load(); toast(`Đã nhập ${Object.keys(data.cards).length} thẻ`); route();
    } catch (err) { toast('File không hợp lệ'); }
  }

  function editCard(word, after) {
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
        <button class="btn danger" id="eDel">🗑 Xóa</button>
        <div class="row"><button class="btn" id="eReset" title="Học lại từ đầu">↺ Học lại</button><button class="btn" data-close>Hủy</button><button class="btn primary" id="eSave">Lưu</button></div>
      </div>`);
    $('#eSave').onclick = async () => {
      Object.assign(c, { vi: $('#eVi').value.trim(), ipa: $('#eIpa').value.trim(), ex: $('#eEx').value.trim(), note: $('#eNote').value.trim(), image: $('#eImg').value.trim() });
      await Cards.update(c); closeModal(); toast('Đã lưu'); if (window.Sync) Sync.schedule(); after && after();
    };
    $('#eReset').onclick = async () => { c.srs = SRS.newState(); await Cards.update(c); closeModal(); updateChrome(); toast('Thẻ sẽ được học lại như từ mới'); after && after(); };
    $('#eDel').onclick = async () => {
      if (!confirm(`Xóa “${c.word}” khỏi sổ từ?`)) return;
      await Cards.remove(c.word); delete state.cards[c.word.toLowerCase()]; closeModal(); updateChrome(); if (window.Sync) Sync.schedule(); routes.deck(new URLSearchParams());
    };
  }

  // ================= TIẾN ĐỘ & HUY HIỆU =================
  routes.stats = function () {
    const L = Game.levelOf(state.game.xp);
    const cards = Object.values(state.cards);
    const k = todayKey();
    // Heatmap 26 tuần
    const end = new Date(); end.setHours(0, 0, 0, 0);
    const start = new Date(end); start.setDate(end.getDate() - 7 * 26 + 1 - ((end.getDay() + 6) % 7 === 6 ? 0 : 0));
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    const cells = [];
    const activity = d => (state.stats.days[d] || 0) + Math.round(((state.game.days[d] || {}).xp || 0) / 10);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = todayKey(d), v = activity(key);
      cells.push(`<i class="${v >= 60 ? 'l4' : v >= 30 ? 'l3' : v >= 10 ? 'l2' : v > 0 ? 'l1' : ''}" title="${key}: ${state.stats.days[key] || 0} lượt ôn, ${(state.game.days[key] || {}).xp || 0} XP"></i>`);
    }
    // Ôn tập 14 ngày
    const past = Array.from({ length: 14 }, (_, i) => { const d = new Date(Date.now() - (13 - i) * DAY); return { d, n: state.stats.days[todayKey(d)] || 0 }; });
    const pmax = Math.max(1, ...past.map(x => x.n));
    // Dự báo 14 ngày tới
    const fc = Array.from({ length: 14 }, (_, i) => {
      const s = new Date(); s.setHours(0, 0, 0, 0); s.setDate(s.getDate() + i);
      const e = s.getTime() + DAY;
      const n = cards.filter(c => (c.srs.reps > 0 || c.srs.last) && (i === 0 ? c.srs.due < e : c.srs.due >= s.getTime() && c.srs.due < e)).length;
      return { d: s, n };
    });
    const fmax = Math.max(1, ...fc.map(x => x.n));
    // Phân bố mức thuộc
    const dist = [0, 0, 0, 0]; cards.forEach(c => dist[SRS.mastery(c.srs)]++);
    const tot = Math.max(1, cards.length);
    const colors = ['var(--surface-3)', 'var(--hard)', 'var(--easy)', 'var(--good)'];
    let acc = 0;
    const conic = dist.map((n, i) => { const a = acc; acc += n / tot * 100; return `${colors[i]} ${a}% ${acc}%`; }).join(',');
    const tl = state.game.total;
    const dn = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

    view.innerHTML = `
      <div class="page-head"><div><h1>Tiến độ & huy hiệu</h1><p class="muted">Theo dõi hành trình chinh phục IELTS của bạn</p></div></div>
      <div class="card hero-main" style="display:flex;gap:1.2rem;align-items:center;flex-wrap:wrap">
        <div class="avatar" style="width:72px;height:72px;font-size:1.8rem;background:rgba(255,255,255,.2)">${avatarInner()}</div>
        <div class="grow"><div class="muted">Cấp độ hiện tại</div><h2 style="margin:0;color:#fff">Cấp ${L.level} · ${esc(L.title)}</h2>
          <div class="progress" style="margin-top:.6rem"><i style="width:${L.into / L.need * 100}%"></i></div>
          <div class="small muted" style="margin-top:.3rem">${L.into}/${L.need} XP tới cấp ${L.level + 1} · Tổng ${state.game.xp.toLocaleString('vi-VN')} XP</div></div>
        <div style="text-align:center"><div class="big-num">🔥${streak()}</div><div class="muted small">ngày liên tiếp</div></div>
      </div>

      <div class="grid g4 stats" style="margin-top:1rem">
        <div class="card stat"><div class="em">🃏</div><div><b>${tl.reviews.toLocaleString('vi-VN')}</b><span class="muted small">Lượt ôn</span></div></div>
        <div class="card stat"><div class="em">🎯</div><div><b>${tl.quizzes}</b><span class="muted small">Bài luyện tập</span></div></div>
        <div class="card stat"><div class="em">🎙️</div><div><b>${tl.spoken}</b><span class="muted small">Từ phát âm đúng</span></div></div>
        <div class="card stat"><div class="em">📖</div><div><b>${tl.readings}</b><span class="muted small">Bài đọc</span></div></div>
      </div>

      <div class="card" style="margin-top:1rem">
        <div class="row between"><h3 style="margin:0">Lịch học 6 tháng</h3><span class="row tiny muted">Ít <i class="heat" style="display:inline-grid;grid-template-rows:12px"><i></i></i><span style="display:inline-flex;gap:3px"><i style="width:12px;height:12px;border-radius:3px" class="l1"></i></span> Nhiều</span></div>
        <div class="heat" style="margin-top:.8rem">${cells.join('')}</div>
      </div>

      <div class="grid g2" style="margin-top:1rem">
        <div class="card"><h3>Lượt ôn 14 ngày qua</h3>
          <div class="bars">${past.map(x => `<div title="${todayKey(x.d)}: ${x.n}"><em>${x.n || ''}</em><i class="${x.n ? '' : 'zero'}" style="height:${x.n ? Math.max(6, x.n / pmax * 100) : 3}px"></i><small>${x.d.getDate()}</small></div>`).join('')}</div></div>
        <div class="card"><h3>Dự báo thẻ đến hạn</h3>
          <div class="bars">${fc.map((x, i) => `<div title="${todayKey(x.d)}: ${x.n}"><em>${x.n || ''}</em><i class="${x.n ? '' : 'zero'}" style="height:${x.n ? Math.max(6, x.n / fmax * 100) : 3}px;background:linear-gradient(180deg,#2dd4bf,var(--accent))"></i><small>${i === 0 ? 'Nay' : dn[x.d.getDay()]}</small></div>`).join('')}</div></div>
      </div>

      <div class="card" style="margin-top:1rem;display:flex;gap:2rem;align-items:center;flex-wrap:wrap">
        <div style="width:150px;height:150px;border-radius:50%;background:conic-gradient(${cards.length ? conic : 'var(--surface-2) 0 100%'});display:grid;place-items:center">
          <div style="width:100px;height:100px;border-radius:50%;background:var(--surface);display:grid;place-items:center;text-align:center"><div><b style="font-size:1.5rem">${cards.length}</b><div class="tiny muted">từ</div></div></div></div>
        <div class="grow"><h3>Mức độ ghi nhớ</h3><div class="legend">
          ${['Chưa học', 'Đang học (< 4 ngày)', 'Quen (4–20 ngày)', 'Đã thuộc (≥ 21 ngày)'].map((l, i) => `<span><i style="background:${colors[i]}"></i>${l}<b style="margin-left:auto">${dist[i]}</b></span>`).join('')}</div></div>
      </div>

      <div class="section-title"><h2>Huy hiệu</h2><span class="muted small">${Object.keys(state.game.badges).length}/${Game.BADGES.length}</span></div>
      <div class="badge-grid">${Game.BADGES.map(b => `<div class="badge-card ${state.game.badges[b.id] ? '' : 'locked'}" title="${esc(b.desc)}"><div class="em">${b.icon}</div><b class="small">${esc(b.name)}</b><div class="tiny muted">${esc(b.desc)}</div></div>`).join('')}</div>`;
  };


  // ================= PHƯƠNG PHÁP HỌC =================
  routes.method = function () {
    const P = [
      ['📉', 'Đường cong quên lãng', 'Hermann Ebbinghaus (1885)', 'Trí nhớ về một thông tin mới giảm rất nhanh trong vài ngày đầu nếu không được ôn lại; mỗi lần ôn đúng lúc làm đường cong thoải dần.', 'Mỗi từ có chỉ số <b>🧠 % còn nhớ</b>. Từ dưới 85% được đưa vào danh sách <b>Sắp quên</b> để ôn ngay.', '#/deck?from=forget', 'Xem từ sắp quên'],
      ['🔁', 'Lặp lại ngắt quãng', 'Pimsleur (1967) · Leitner (1972) · Woźniak – SM-2 (1987)', 'Ôn với khoảng cách tăng dần (10 phút → 1 ngày → 3 ngày → 1 tuần → 1 tháng…) hiệu quả hơn nhiều so với học dồn.', 'Flashcard dùng SM-2 kèm <b>bước học 1→10 phút</b> cho từ mới (giống Anki); mỗi lựa chọn Quên/Khó/Nhớ/Dễ hiển thị lần ôn tiếp theo.', '#/review', 'Ôn tập ngay'],
      ['🎯', 'Chủ động nhớ lại (Testing effect)', 'Roediger & Karpicke (2006)', 'Tự kiểm tra – cố gắng nhớ lại trước khi xem đáp án – giúp nhớ lâu hơn hẳn việc đọc lại nhiều lần.', 'Thẻ luôn bắt bạn <b>đoán trước khi lật</b>; Học thông minh đi từ nhận diện (trắc nghiệm) đến <b>tự gõ lại từ</b>.', '#/practice/learn', 'Học thông minh'],
      ['📖', 'Ngữ liệu dễ hiểu (Comprehensible input)', 'Stephen Krashen', 'Ta tiếp thu ngôn ngữ tốt nhất khi gặp nó trong nội dung có ý nghĩa, hơi vượt trình độ hiện tại một chút (i+1).', 'Lưu từ <b>kèm câu gốc</b> từ bài đọc, trang web, phụ đề YouTube; bài đọc chia cấp độ B1 → C1.', '#/reading', 'Đọc bài'],
      ['✍️', 'Hiệu ứng tự tạo & mức độ dấn thân', 'Slamecka & Graf (1978) · Laufer & Hulstijn (2001)', 'Thông tin do chính mình tạo ra (tự đặt câu, tự tìm nghĩa) được nhớ tốt hơn thông tin được cho sẵn.', 'Mặt sau flashcard có ô <b>Tự đặt câu</b> (+5 XP); câu của bạn trở thành ngữ cảnh cho lần ôn sau.', '#/review', 'Thử đặt câu'],
      ['🖼️', 'Mã hóa kép (Dual coding)', 'Allan Paivio (1971)', 'Kết hợp hình ảnh với chữ và âm thanh tạo nhiều “đường dẫn” để truy xuất trí nhớ.', 'Mỗi từ có <b>hình minh họa</b>, phiên âm IPA và <b>phát âm UK/US</b>; luyện nói có chấm điểm.', '#/practice/speak', 'Luyện phát âm'],
      ['🔀', 'Học xen kẽ (Interleaving)', 'Rohrer & Taylor (2007)', 'Trộn nhiều dạng bài và chủ đề trong một buổi giúp phân biệt và ghi nhớ tốt hơn học từng khối.', 'Bài kiểm tra trộn 5 dạng câu hỏi; phiên ôn tập xen kẽ từ mới vào giữa từ cũ.', '#/practice/test', 'Làm bài kiểm tra'],
      ['🧩', 'Bốn mạch học từ vựng', 'Paul Nation (2007)', 'Chương trình cân bằng gồm: đầu vào có ý nghĩa, đầu ra có ý nghĩa, học tập trung vào ngôn ngữ, và luyện độ trôi chảy.', 'Đọc & nghe (bài đọc, video) · nói & viết (phát âm, đặt câu) · flashcard & collocation · trò chơi Ghép thẻ tính giờ.', '#/practice', 'Xem các chế độ'],
    ];
    view.innerHTML = `
      <div class="page-head"><div><h1>Phương pháp học của Vocaband</h1><p class="muted">Mỗi tính năng dựa trên một nguyên lý đã được nghiên cứu về trí nhớ và thụ đắc ngôn ngữ.</p></div></div>
      <div class="card hero-main" style="margin-bottom:1rem"><h2 style="color:#fff;margin:0 0 .4rem">Vòng lặp học 15 phút mỗi ngày</h2>
        <div class="row" style="gap:.5rem;font-weight:700">${['📖 Gặp từ trong ngữ cảnh', '📌 Lưu kèm câu gốc', '🧠 Học thông minh', '🔁 Ôn đúng lúc sắp quên', '✍️ Dùng lại khi nói & viết'].map((x, i) => `<span style="background:rgba(255,255,255,.18);padding:.4rem .75rem;border-radius:10px">${x}</span>${i < 4 ? '<span>→</span>' : ''}`).join('')}</div></div>
      <div class="grid g2">${P.map(([em, t, who, idea, how, href, cta]) => `
        <div class="card stack" style="display:flex;flex-direction:column">
          <div class="row nowrap"><span style="font-size:2rem">${em}</span><div><h3 style="margin:0">${t}</h3><div class="tiny muted">${who}</div></div></div>
          <p>${idea}</p>
          <div class="example-box small" style="border-left-color:var(--primary)"><b>Trong Vocaband:</b> ${how}</div>
          <div style="margin-top:auto"><a class="btn sm" href="${href}">${cta} →</a></div>
        </div>`).join('')}</div>`;
  };

  // ================= CÀI ĐẶT =================
  routes.settings = function () {
    const s = state.settings;
    const perm = 'Notification' in window ? Notification.permission : 'unsupported';
    view.innerHTML = `
      <div class="page-head"><div><h1>Cài đặt</h1><p class="muted">Tài khoản, nhắc học, mục tiêu và giao diện</p></div></div>
      <div class="card stack" id="syncBox" style="margin-bottom:1rem"></div>
      <div class="grid g2">
        <div class="card">
          <h2>⏰ Nhắc học hằng ngày</h2>
          <label class="switch"><span>Bật nhắc học</span><input type="checkbox" id="sRem" ${s.reminderOn ? 'checked' : ''}></label>
          <label class="field" style="margin:.4rem 0 .8rem"><span>Giờ nhắc</span><input type="time" class="input" id="sTime" value="${esc(s.reminderTime)}"></label>
          ${Store.isExtension
            ? '<p class="small muted">✅ Add-on gửi thông báo vào giờ này mỗi ngày (kể cả khi chưa mở trang) và hiện số thẻ cần ôn trên biểu tượng.</p>'
            : `<p class="small muted">Trình duyệt chỉ nhắc được khi trang đang mở. Để nhắc chắc chắn, thêm lịch nhắc vào điện thoại hoặc dùng add-on Chrome.</p>
               <div class="row">
                 <button class="btn sm" id="sPerm" ${perm === 'granted' || perm === 'unsupported' ? 'disabled' : ''}>${perm === 'granted' ? '✓ Đã cho phép thông báo' : perm === 'unsupported' ? 'Không hỗ trợ thông báo' : '🔔 Cho phép thông báo'}</button>
                 <button class="btn sm" id="sIcs">📅 Thêm vào Lịch (.ics)</button>
               </div>`}
          <button class="btn sm" id="sTest" style="margin-top:.6rem">Thử gửi thông báo</button>
          <hr style="border:0;border-top:1px solid var(--line);margin:1rem 0">
          <label class="switch"><span><b>⏰ Nhắc “thời điểm vàng”</b><br><span class="small muted">Báo khi có từ sắp bị quên</span></span><input type="checkbox" id="sGold" ${s.goldenOn ? 'checked' : ''}></label>
          <label class="field" style="margin-top:.4rem"><span>Chỉ nhắc khi có ít nhất <b id="vGMin">${s.goldenMin}</b> từ cần ôn</span><input type="range" min="1" max="50" id="sGMin" value="${s.goldenMin}" style="width:100%"></label>
          <div class="grid g2" style="margin-top:.6rem"><label class="field"><span>Giờ yên lặng từ</span><input type="time" class="input" id="sQ1" value="${esc(s.quietStart)}"></label><label class="field"><span>đến</span><input type="time" class="input" id="sQ2" value="${esc(s.quietEnd)}"></label></div>
        </div>
        <div class="card">
          <h2>🎯 Mục tiêu học</h2>
          <label class="field"><span>Từ mới mỗi ngày: <b id="vNew">${s.dailyNew}</b></span><input type="range" min="0" max="50" id="sNew" value="${s.dailyNew}" style="width:100%"></label>
          <label class="field" style="margin-top:.6rem"><span>Mục tiêu lượt ôn mỗi ngày: <b id="vGoal">${s.dailyGoal}</b></span><input type="range" min="5" max="200" step="5" id="sGoal" value="${s.dailyGoal}" style="width:100%"></label>
          <label class="field" style="margin-top:.6rem"><span>Tối đa thẻ mỗi phiên ôn: <b id="vCap">${s.sessionCap || 'Không giới hạn'}</b></span><input type="range" min="0" max="200" step="10" id="sCap" value="${s.sessionCap}" style="width:100%"></label>
        </div>
        <div class="card">
          <h2>🔊 Âm thanh & phát âm</h2>
          <label class="field"><span>Giọng phát âm</span>
            <select class="input" id="sAccent"><option value="en-GB" ${s.accent === 'en-GB' ? 'selected' : ''}>🇬🇧 Anh – Anh (khuyên dùng cho IELTS)</option><option value="en-US" ${s.accent === 'en-US' ? 'selected' : ''}>🇺🇸 Anh – Mỹ</option></select></label>
          <label class="field" style="margin-top:.6rem"><span>Giọng đọc</span><select class="input" id="sVoice"></select></label>
          <label class="field" style="margin-top:.6rem"><span>Tốc độ đọc: <b id="vRate">${(s.ttsRate || 0.92).toFixed(2)}×</b></span><input type="range" min="0.6" max="1.2" step="0.02" id="sRate" value="${s.ttsRate || 0.92}" style="width:100%"></label>
          <div class="row" style="margin:.4rem 0 .6rem"><button class="btn sm" id="sTry">▶️ Nghe thử câu mẫu</button><span class="tiny muted">Từ đơn ưu tiên bản ghi giọng người thật</span></div>
          <label class="switch"><span>Tự phát âm khi hiện thẻ</span><input type="checkbox" id="sAuto" ${s.autoSpeak ? 'checked' : ''}></label>
          <label class="switch"><span>Hiệu ứng âm thanh</span><input type="checkbox" id="sSfx" ${s.sfx ? 'checked' : ''}></label>
        </div>
        <div class="card">
          <h2>🎨 Giao diện</h2>
          <div class="tabs" id="sTheme" style="display:inline-flex">${[['auto', '🌓 Tự động'], ['light', '☀️ Sáng'], ['dark', '🌙 Tối']].map(([v, l]) => `<button data-v="${v}" class="${s.theme === v ? 'on' : ''}">${l}</button>`).join('')}</div>
        </div>
      </div>
      <div class="card stack" style="margin-top:1rem">
        <h2>🧩 Add-on từ điển cho Chrome</h2>
        <p>Bấm đúp vào bất kỳ từ tiếng Anh nào trên web để xem phiên âm, nghĩa, hình ảnh và <b>lưu vào flashcard kèm câu gốc làm ngữ cảnh</b>. Bôi đen cả câu/đoạn để <b>dịch sang tiếng Việt</b>.</p>
        <p class="small muted">Cài đặt: mở <code>chrome://extensions</code> → bật <i>Developer mode</i> → <i>Load unpacked</i> → chọn thư mục <code>extension</code>.</p>
      </div>
      <div class="card stack" style="margin-top:1rem">
        <h2>💾 Dữ liệu</h2>
        <div class="row"><button class="btn sm" id="sExport">⬇️ Xuất sao lưu</button><label class="btn sm">⬆️ Nhập sao lưu<input type="file" id="sImport" accept="application/json" hidden></label>
        <button class="btn sm danger" id="sReset">Xóa toàn bộ dữ liệu học</button></div>
      </div>`;

    const save = async () => { await saveSettings(); Core.sfxOff = !s.sfx; updateChrome(); if (window.Sync) Sync.schedule(); };
    $('#sRem').onchange = e => { s.reminderOn = e.target.checked; save(); };
    $('#sTime').onchange = e => { s.reminderTime = e.target.value || '20:00'; save(); toast(`Sẽ nhắc lúc ${s.reminderTime} mỗi ngày`); };
    $('#sNew').oninput = e => { s.dailyNew = +e.target.value; $('#vNew').textContent = s.dailyNew; save(); };
    $('#sGoal').oninput = e => { s.dailyGoal = +e.target.value; $('#vGoal').textContent = s.dailyGoal; save(); };
    $('#sGold').onchange = e => { s.goldenOn = e.target.checked; save(); };
    $('#sGMin').oninput = e => { s.goldenMin = +e.target.value; $('#vGMin').textContent = s.goldenMin; save(); };
    $('#sQ1').onchange = e => { s.quietStart = e.target.value || '22:30'; save(); };
    $('#sQ2').onchange = e => { s.quietEnd = e.target.value || '07:00'; save(); };
    $('#sCap').oninput = e => { s.sessionCap = +e.target.value; $('#vCap').textContent = s.sessionCap || 'Không giới hạn'; save(); };
    const fillVoices = () => {
      if (!$('#sVoice')) return; // đã rời trang Cài đặt
      const list = UI.voicesFor(s.accent);
      const cur = (UI.pickVoice(s.accent) || {}).name;
      $('#sVoice').innerHTML = list.length ? list.map((v, i) => `<option value="${esc(v.name)}" ${v.name === cur ? 'selected' : ''}>${esc(v.name)}${i === 0 ? ' ⭐ khuyên dùng' : ''}</option>`).join('') : '<option>Trình duyệt chưa có giọng tiếng Anh</option>';
    };
    fillVoices(); setTimeout(fillVoices, 600);
    $('#sVoice').onchange = e => { s.voice = { ...(s.voice || {}), [s.accent]: e.target.value }; save(); UI.tts('This is how I will read words and sentences to you.', s.accent); };
    $('#sRate').oninput = e => { s.ttsRate = +e.target.value; $('#vRate').textContent = s.ttsRate.toFixed(2) + '×'; save(); };
    $('#sTry').onclick = () => UI.tts('Many people believe that renewable energy is the key to a sustainable future. However, the transition will not happen overnight.', s.accent);
    $('#sAccent').onchange = e => { s.accent = e.target.value; save(); fillVoices(); speak('pronunciation', s.accent); };
    $('#sAuto').onchange = e => { s.autoSpeak = e.target.checked; save(); };
    $('#sSfx').onchange = e => { s.sfx = e.target.checked; save(); if (s.sfx) { Core.sfxOff = false; Sfx.correct(); } };
    $$('#sTheme button').forEach(b => b.onclick = () => { s.theme = b.dataset.v; applyTheme(); save(); $$('#sTheme button').forEach(x => x.classList.toggle('on', x === b)); });
    $('#sTest').onclick = () => notify(true);
    const p = $('#sPerm'); if (p) p.onclick = async () => { await Notification.requestPermission(); routes.settings(); };
    const ics = $('#sIcs'); if (ics) ics.onclick = () => download(new Blob([makeICS(s.reminderTime)], { type: 'text/calendar' }), 'ielts-lexi-nhac-hoc.ics');
    $('#sExport').onclick = exportData;
    $('#sImport').onchange = importData;
    $('#sReset').onclick = async () => {
      if (!confirm('Xóa toàn bộ flashcard, tiến độ, XP và thống kê trên thiết bị này? Không thể hoàn tác.')) return;
      await Store.set('cards', {}); await Store.set('stats', { days: {}, newToday: { day: '', n: 0 } }); await Store.set('game', null);
      await load(); toast('Đã xóa dữ liệu'); routes.settings();
    };
    if (window.Sync) Sync.renderBox($('#syncBox')); else $('#syncBox').hidden = true;
  };

  function makeICS(time) {
    const [hh, mm] = time.split(':');
    const ymd = todayKey().replace(/-/g, '');
    const url = location.href.split('#')[0];
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Vocaband//VI', 'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT', `UID:ielts-lexi-daily-${ymd}@lexi`, `DTSTAMP:${ymd}T000000Z`, `DTSTART:${ymd}T${hh}${mm}00`, 'DURATION:PT15M', 'RRULE:FREQ=DAILY',
      'SUMMARY:📚 Ôn từ vựng IELTS (15 phút)', `DESCRIPTION:Mở Vocaband để ôn flashcard hôm nay: ${url}`, `URL:${url}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Đến giờ ôn từ vựng IELTS!', 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  }

  async function notify(force) {
    const { total } = Cards.dueCount(state.cards, state.settings, state.stats);
    const title = 'Vocaband – đến giờ học rồi! 📚';
    const body = total ? `Bạn có ${total} thẻ cần ôn hôm nay. Giữ chuỗi 🔥${streak()} ngày nhé!` : 'Học vài từ mới để giữ chuỗi ngày học nhé 🔥';
    if (Store.isExtension && chrome.runtime) { chrome.runtime.sendMessage({ type: 'testNotify' }); return; }
    if (!('Notification' in window)) return force && toast('Trình duyệt không hỗ trợ thông báo');
    if (Notification.permission !== 'granted') {
      if (!force) return;
      if (await Notification.requestPermission() !== 'granted') return toast('Bạn chưa cho phép thông báo');
    }
    const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
    if (reg) reg.showNotification(title, { body, icon: 'icons/icon-192.png', tag: 'daily', data: { url: location.href.split('#')[0] + '#/review' } });
    else new Notification(title, { body, icon: 'icons/icon-192.png' });
  }

  async function checkReminder() {
    const s = state.settings;
    if (Store.isExtension) return;
    // Thời điểm vàng
    if (s.goldenOn && !Golden.quiet(s) && 'Notification' in window && Notification.permission === 'granted') {
      const n = Golden.dueNow(state.cards);
      const last = await Store.get('lastGolden', 0);
      if (n >= s.goldenMin && Date.now() - last > 3 * 3600 * 1000 && document.hidden) {
        await Store.set('lastGolden', Date.now());
        const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
        const opt = { body: `${n} từ đang ở thời điểm sắp quên – ôn 3 phút để nhớ lâu hơn!`, icon: 'icons/icon-192.png', tag: 'golden', data: { url: location.href.split('#')[0] + '#/review' } };
        reg ? reg.showNotification('⏰ Thời điểm vàng!', opt) : new Notification('⏰ Thời điểm vàng!', opt);
      }
    }
    if (!s.reminderOn) return;
    const [hh, mm] = s.reminderTime.split(':').map(Number);
    const now = new Date();
    if (now.getHours() * 60 + now.getMinutes() < hh * 60 + mm) return;
    if (await Store.get('lastNotified', '') === todayKey()) return;
    if ((state.stats.days[todayKey()] || 0) >= s.dailyGoal) return;
    await Store.set('lastNotified', todayKey());
    notify(false);
  }


  // ================= CHÀO MỪNG & THIẾT LẬP BAN ĐẦU =================
  routes.welcome = function (step) {
    document.body.classList.add('bare');
    App.cleanup = () => document.body.classList.remove('bare');
    if (step === 'setup') return setup();
    const feats = [
      ['📚', '1.200+ từ IELTS chọn lọc', '24 chủ đề, 570 từ học thuật AWL, phrasal verb, idiom, collocation band 7+'],
      ['🧠', 'Flashcard thông minh', 'Thuật toán lặp lại ngắt quãng nhắc bạn ôn đúng lúc sắp quên'],
      ['📌', 'Từ gắn ngữ cảnh', 'Lưu từ kèm câu gốc từ bài đọc, báo, YouTube… nhớ lâu gấp nhiều lần'],
      ['🎙️', 'Luyện phát âm có chấm điểm', 'Nói vào micro, AI nhận dạng giọng và chấm điểm ngay'],
      ['⚡', 'Trò chơi & bài kiểm tra', 'Ghép thẻ tính giờ, điền từ, nghe chép, test ước tính band'],
      ['🧩', 'Add-on Chrome', 'Bấm đúp tra từ, bôi đen dịch câu, tra từ trong phụ đề YouTube'],
      ['📐', '34 bài ngữ pháp trực quan', 'Dòng thời gian, công thức tô màu, lỗi người Việt hay mắc'],
      ['🔤', 'Thư viện phát âm 44 âm IPA', 'Khẩu hình, cặp từ dễ nhầm, trọng âm & ngữ điệu'],
      ['🖥️', 'Thi thử trên máy & Phòng viết', 'Giao diện thi thật, phân tích từ vựng bài viết miễn phí'],
    ];
    view.innerHTML = `
      <div style="max-width:980px;margin:0 auto">
        <div class="row between" style="margin-bottom:2rem"><span class="brand" style="padding:0"><img class="logo" src="icons/icon.svg" alt=""><span class="wordmark">Voca<b>band</b></span></span>
          <button class="btn ghost sm" id="skipW">Đã có dữ liệu? Vào app →</button></div>
        <div class="grid g2" style="align-items:center;gap:2.5rem">
          <div>
            <span class="chip lv">✨ Dành cho người luyện thi IELTS</span>
            <h1 style="font-size:clamp(2rem,5vw,3.2rem);line-height:1.1;margin:1rem 0">Từ vựng vững,<br><span style="background:linear-gradient(90deg,#6D5DFC,#C026D3);-webkit-background-clip:text;background-clip:text;color:transparent">band điểm bứt phá.</span></h1>
            <p class="muted" style="font-size:1.1rem">Học 15 phút mỗi ngày với flashcard thông minh, trò chơi, bài đọc và luyện phát âm. Mọi từ đều có phiên âm chuẩn Anh–Anh, nghĩa tiếng Việt và câu ví dụ IELTS.</p>
            <div class="row" style="margin-top:1.5rem"><a class="btn primary lg" href="#/welcome/setup">Bắt đầu miễn phí →</a><button class="btn lg" id="loginW">Tôi đã có tài khoản</button></div>
            <a class="small" href="#/placement" style="display:inline-block;margin-top:.7rem;font-weight:700">🧭 Kiểm tra trình độ trước (5 phút) →</a>
            <p class="small muted" style="margin-top:.8rem">Miễn phí · Không quảng cáo · Dữ liệu học thuộc về bạn</p>
          </div>
          <div class="card" style="padding:0;overflow:hidden;box-shadow:var(--shadow-lg)">
            <div style="background:linear-gradient(135deg,#6D5DFC,#7C3AED 55%,#C026D3);padding:1.6rem;color:#fff;text-align:center">
              <div style="font-size:4rem">🌿</div><div style="font-size:2rem;font-weight:800">sustainable</div>
              <div style="opacity:.85">/səˈsteɪnəbl/ · adj · B2</div></div>
            <div style="padding:1.2rem 1.4rem">
              <div class="vi">bền vững</div>
              <div class="example-box small" style="margin-top:.6rem">Governments must invest in <mark>sustainable</mark> energy to protect future generations.</div>
              <div class="grades" style="margin-top:1rem"><span class="btn g-again sm">Quên</span><span class="btn g-hard sm">Khó</span><span class="btn g-good sm">Nhớ</span><span class="btn g-easy sm">Dễ</span></div>
            </div>
          </div>
        </div>
        <div class="grid g3" style="margin-top:3rem">${feats.map(([em, t, d]) => `<div class="card"><div style="font-size:2rem">${em}</div><h3 style="margin:.5rem 0 .3rem">${t}</h3><div class="muted small">${d}</div></div>`).join('')}</div>
      </div>`;
    $('#skipW').onclick = finishOnboarding;
    $('#loginW').onclick = async () => { if (window.Sync && Sync.signIn) { await Sync.signIn(); if (state.user) finishOnboarding(); } else finishOnboarding(); };
  };

  function setup() {
    const pick = { band: '7.0', pace: 20, topics: new Set(['education', 'environment', 'technology']) };
    const paces = [[10, '🐢 Nhẹ nhàng', '5 phút/ngày · 5 từ mới'], [20, '🚶 Đều đặn', '10–15 phút/ngày · 10 từ mới'], [40, '🚀 Tăng tốc', '25 phút/ngày · 20 từ mới']];
    const topics = TOPICS.filter(t => t.group === 'topics' || t.group === 'writing').slice(0, 15);
    const draw = () => {
      view.innerHTML = `<div style="max-width:760px;margin:0 auto" class="stack">
        <div class="row between"><span class="brand" style="padding:0"><img class="logo" src="icons/icon.svg" alt=""><span class="wordmark">Voca<b>band</b></span></span><a class="small" href="#/welcome">← Quay lại</a></div>
        <div class="card"><h2>🎯 Band mục tiêu của bạn?</h2><div class="tabs" style="display:inline-flex;margin-top:.4rem" id="bandT">${['5.5', '6.0', '6.5', '7.0', '7.5', '8.0+'].map(b => `<button data-v="${b}" class="${pick.band === b ? 'on' : ''}">${b}</button>`).join('')}</div></div>
        <div class="card"><h2>⏱ Bạn muốn học với cường độ nào?</h2><div class="grid g3" style="margin-top:.6rem">${paces.map(([v, t, d]) => `<button class="option ${pick.pace === v ? 'right' : ''}" data-pace="${v}" style="flex-direction:column;align-items:flex-start"><b>${t}</b><span class="small muted" style="font-weight:500">${d}</span></button>`).join('')}</div></div>
        <div class="card"><h2>📚 Chọn chủ đề muốn học trước</h2><p class="muted small">Chọn 1–5 chủ đề, bạn có thể thêm sau trong Thư viện.</p>
          <div class="row" style="margin-top:.6rem">${topics.map(t => `<button class="chip" data-t="${t.id}" style="border:2px solid ${pick.topics.has(t.id) ? 'var(--primary)' : 'transparent'};cursor:pointer;font-size:.9rem;padding:.4rem .8rem;${pick.topics.has(t.id) ? 'background:var(--primary-soft);color:var(--primary)' : ''}">${t.emoji} ${esc(t.name)}</button>`).join('')}</div></div>
        <button class="btn primary lg block" id="go" ${pick.topics.size ? '' : 'disabled'}>Bắt đầu học ${pick.topics.size ? `(${TOPICS.filter(t => pick.topics.has(t.id)).reduce((a, t) => a + t.words.length, 0)} từ)` : ''} →</button>
      </div>`;
      $$('#bandT button').forEach(b => b.onclick = () => { pick.band = b.dataset.v; draw(); });
      $$('[data-pace]').forEach(b => b.onclick = () => { pick.pace = +b.dataset.pace; draw(); });
      $$('[data-t]').forEach(b => b.onclick = () => { const id = b.dataset.t; pick.topics.has(id) ? pick.topics.delete(id) : pick.topics.size < 5 && pick.topics.add(id); draw(); });
      $('#go').onclick = async () => {
        $('#go').disabled = true; $('#go').textContent = '⏳ Đang chuẩn bị bộ thẻ…';
        Object.assign(state.settings, { targetBand: pick.band, dailyGoal: pick.pace, dailyNew: pick.pace === 10 ? 5 : pick.pace === 20 ? 10 : 20 });
        await saveSettings();
        for (const id of pick.topics) for (const w of topicOf(id).words) if (!inDeck(w.word)) await addWord(w, null, { silent: true });
        await finishOnboarding(true);
      };
    };
    draw();
  }

  async function finishOnboarding(celebrate) {
    state.settings.onboarded = true;
    await saveSettings();
    document.body.classList.remove('bare');
    location.hash = '#/home';
    if (celebrate === true) { Sfx.win(); confetti(140); toast('🎉 Bộ thẻ đã sẵn sàng – bắt đầu bài ôn đầu tiên nhé!', 3500); }
  }

  // Dữ liệu mẫu cho ảnh giới thiệu (?demo=1, chỉ áp dụng khi máy chưa có dữ liệu)
  async function seedDemo() {
    if (Object.keys(await Cards.all()).length) return;
    const now = Date.now();
    const cards = {};
    ['environment', 'technology', 'education', 'health', 'task2', 'phrasal'].forEach((id, ti) => (topicOf(id) || { words: [] }).words.slice(0, 14).forEach((w, i) => {
      const c = Cards.make(w); const r = (i * 7 + ti * 3) % 10;
      c.added = now - (40 - i) * DAY;
      if (r < 7) { c.srs = { ef: 2.3 + r / 20, interval: [1, 3, 6, 12, 24, 30, 45][r], reps: r + 1, lapses: r % 3 === 0 ? 1 : 0, due: now + ((r % 4) - 1) * DAY, last: now - DAY * (r % 3) }; }
      if (i === 2 && w.ex) c.contexts = [{ text: w.ex, vi: '', title: 'BBC News', at: now }];
      cards[w.word.toLowerCase()] = c;
    }));
    await Cards.save(cards);
    const days = {}, gdays = {};
    for (let i = 0; i < 120; i++) { if (i > 2 && (i * 13) % 7 === 0) continue; const k = todayKey(new Date(now - i * DAY)); days[k] = 10 + (i * 17) % 45; gdays[k] = { xp: 60 + (i * 31) % 160, reviews: days[k] }; }
    await Store.set('stats', { days, newToday: { day: todayKey(), n: 3 } });
    await Store.set('game', { xp: 6840, days: gdays, total: { reviews: 3120, newWords: 412, quizzes: 96, perfect: 21, matches: 34, spoken: 188, readings: 7, lookups: 260 }, best: { match: 21.4 }, badges: { first: 1, words50: 1, master10: 1, streak3: 1, streak7: 1, rev500: 1, perfect5: 1, speaker: 1, reader: 1, speed: 1, level5: 1 }, questsDone: {} });
    await Store.set('settings', { ...DEFAULT_SETTINGS, onboarded: true, autoSpeak: false, sfx: false });
  }

  // ---------- Sự kiện dùng chung ----------
  function bindCommon(after) {
    $$('[data-speak]').forEach(b => b.onclick = e => { e.preventDefault(); e.stopPropagation(); speak(b.dataset.speak, b.dataset.accent || state.settings.accent, b.dataset.url || ''); });
    $$('[data-speak-text]').forEach(b => b.onclick = e => { e.stopPropagation(); speak(b.dataset.speakText, state.settings.accent); });
    $$('[data-slow]').forEach(b => b.onclick = e => { e.stopPropagation(); UI.tts(b.dataset.slow, state.settings.accent, 0.55); });
    $$('[data-add-seed]').forEach(b => b.onclick = async e => {
      e.preventDefault();
      const w = INDEX[b.dataset.addSeed.toLowerCase()];
      if (!w) return;
      await addWord(b.dataset.topic ? { ...w, topic: b.dataset.topic } : w);
      b.outerHTML = '<span class="chip ok">✓ Đã thêm</span>';
      toast(`Đã thêm “${w.word}” vào flashcard`);
      after && after();
    });
  }
  App.bindCommon = bindCommon;

  // ---------- Cài app (PWA) & trạng thái mạng ----------
  let installEvt = null;
  const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);
  function showInstallBtn() {
    if (Store.isExtension || isStandalone() || $('#installBtn')) return;
    if (!installEvt && !isIOS()) return;
    const b = document.createElement('button');
    b.id = 'installBtn'; b.className = 'pill'; b.style.cursor = 'pointer'; b.style.color = 'var(--primary)';
    b.innerHTML = '📲 <span class="hide-sm">Cài app</span>';
    b.title = 'Cài Vocaband lên màn hình chính';
    b.onclick = async () => {
      if (installEvt) { installEvt.prompt(); const r = await installEvt.userChoice; if (r.outcome === 'accepted') { b.remove(); toast('🎉 Đã cài Vocaband!'); } installEvt = null; return; }
      modal(`<h2>📲 Cài Vocaband lên iPhone</h2><ol style="line-height:2;padding-left:1.2rem"><li>Bấm nút <b>Chia sẻ</b> <span style="font-size:1.2rem">⎋</span> ở thanh dưới của Safari</li><li>Chọn <b>“Thêm vào MH chính”</b> (Add to Home Screen)</li><li>Bấm <b>Thêm</b> – biểu tượng Vocaband sẽ xuất hiện như một app</li></ol><button class="btn primary block" data-close>Đã hiểu</button>`);
    };
    $('.top-stats').prepend(b);
  }
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; showInstallBtn(); });
  window.addEventListener('appinstalled', () => { const b = $('#installBtn'); if (b) b.remove(); });
  const netState = () => { document.body.classList.toggle('offline', !navigator.onLine); };
  window.addEventListener('offline', () => { netState(); toast('📴 Mất kết nối – vẫn ôn tập được, tra từ mới cần mạng'); });
  window.addEventListener('online', () => { netState(); toast('✅ Đã có mạng trở lại'); });

  // ---------- Khởi động ----------
  App.ready = (async function init() {
    if (/[?&]demo=1/.test(location.search)) await seedDemo();
    if (Store.sandbox) setTimeout(() => toast('🧪 Chế độ thử nghiệm – dữ liệu tách riêng, không đồng bộ'), 800);
    await load();
    document.addEventListener('error', e => {
      const img = e.target;
      if (img.tagName === 'IMG' && img.parentElement && (img.parentElement.classList.contains('pic') || img.parentElement.classList.contains('em'))) img.parentElement.textContent = '📘';
    }, true);
    if (Store.isExtension && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener(ch => { if (ch.cards) { state.cards = ch.cards.newValue || {}; updateChrome(); } });
    }
    if (!Store.isExtension && 'serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
    checkReminder(); setInterval(checkReminder, 60 * 1000);
    netState(); setTimeout(showInstallBtn, 1500);
    document.addEventListener('visibilitychange', async () => { if (!document.hidden) { state.cards = await Cards.all(); state.stats = await Stats.get(); state.game = await Game.get(); updateChrome(); } });
  })();
  // Các module khác (study.js, reading.js) đăng ký route rồi mới vẽ trang đầu tiên
  // Chỉ vẽ trang khi mọi module (study, grammar, pron, plan…) đã tải xong
  const boot = async () => {
    await App.ready;
    const fresh = !state.settings.onboarded && !Object.keys(state.cards).length && !state.game.xp;
    if (fresh && !/welcome|dict|read/.test(location.hash)) { location.hash = '#/welcome'; return; }
    route();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else setTimeout(boot, 0);
})();
