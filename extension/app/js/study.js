/* Học & luyện tập: ôn tập SRS, Học thông minh, Trắc nghiệm, Điền từ, Nghe & chép, Ghép thẻ, Phát âm, Kiểm tra. */
(function () {
  const { SRS, Cards, Stats, endOfToday } = Core;
  const { TOPICS, INDEX } = IELTS_DATA;
  const { $, $$, esc, shuffle, highlight, cloze, clozeAnswer, similarity, toast, speak, tts, pic, levelChip, posChip, xpFloat } = UI;
  const App = window.App;
  const { state, routes } = App;
  const view = App.view;
  const accent = () => state.settings.accent;

  // ---------- Nguồn từ ----------
  const norm = w => ({ word: w.word, ipa: w.ipa || '', vi: w.vi || '', ex: w.ex || '', def: w.def || '', pos: w.pos || '', emoji: w.emoji || '📘', image: w.image || '', audio: w.audio || '', level: w.level || '', topic: w.topic || '' });
  function sourceList() {
    const opts = [['deck', `📒 Sổ từ của tôi (${Object.keys(state.cards).length})`], ['due', '🔁 Thẻ đến hạn hôm nay'], ['forgetting', '⚠️ Từ sắp quên (độ nhớ < 85%)'], ['weak', '🧩 Từ hay quên'], ...[1, 2, 3, 4, 5].map(i => [`level:${i}`, `📶 Cấp độ nhớ ${i}`])];
    Object.entries(App.ORIGINS).forEach(([k, o]) => opts.push([`origin:${k}`, `${o.emoji} ${o.name}`]));
    TOPICS.forEach(t => opts.push([`topic:${t.id}`, `${t.emoji} ${t.name}`]));
    return opts;
  }
  function pool(src) {
    const cards = Object.values(state.cards).filter(c => c.vi);
    let list = [];
    if (src === 'due') list = cards.filter(c => (c.srs.reps > 0 || c.srs.last) && c.srs.due <= endOfToday());
    else if (src === 'weak') list = cards.filter(c => c.srs.lapses > 0 || (c.srs.ef && c.srs.ef < 2.3));
    else if (src === 'forgetting') list = App.forgetting();
    else if (src && src.startsWith('level:')) list = cards.filter(c => SRS.level5(c.srs) === +src.slice(6));
    else if (src && src.startsWith('origin:')) list = cards.filter(c => App.origin(c) === src.slice(7));
    else if (src && src.startsWith('topic:')) { const t = TOPICS.find(x => x.id === src.slice(6)); list = t ? t.words : []; }
    else list = cards;
    if (list.length < 4 && (!src || src === 'deck')) list = shuffle(TOPICS.filter(t => t.group === 'topics').flatMap(t => t.words)).slice(0, 120);
    return list.map(norm);
  }
  const srcName = src => (sourceList().find(o => o[0] === src) || [0, '📒 Sổ từ của tôi'])[1];
  const distractors = (w, list, n, key) => {
    const base = list.length >= n + 1 ? list : TOPICS.flatMap(t => t.words).map(norm);
    const same = shuffle(base.filter(x => x.word !== w.word && x[key] && x[key] !== w[key] && x.pos === w.pos));
    const any = shuffle(base.filter(x => x.word !== w.word && x[key] && x[key] !== w[key]));
    const out = [];
    for (const x of [...same, ...any]) { if (out.length >= n) break; if (!out.some(o => o[key] === x[key])) out.push(x); }
    return out;
  };

  // ================= ÔN TẬP SRS =================
  let session = null;
  function buildQueue() {
    const list = Object.values(state.cards);
    const end = endOfToday();
    const due = list.filter(c => (c.srs.reps > 0 || c.srs.last) && c.srs.due <= end).sort((a, b) => a.srs.due - b.srs.due);
    const { newCount } = Cards.dueCount(state.cards, state.settings, state.stats);
    const fresh = list.filter(c => c.srs.reps === 0 && !c.srs.last).sort((a, b) => a.added - b.added).slice(0, newCount);
    const q = [...due];
    fresh.forEach((c, i) => q.splice(Math.min(q.length, i * 3 + 1), 0, c));
    const cap = +state.settings.sessionCap || 0;
    return (cap ? q.slice(0, cap) : q).map(c => c.word.toLowerCase());
  }

  routes.review = function () {
    if (!Object.keys(state.cards).length) {
      view.innerHTML = `<div class="study-wrap"><div class="card empty"><div class="em">🃏</div><h2>Chưa có flashcard nào</h2><p>Thêm từ từ thư viện hoặc tra từ điển để bắt đầu.</p><div class="row center"><a class="btn primary" href="#/library">Mở thư viện</a><a class="btn" href="#/dict">Tra từ</a></div></div></div>`;
      return;
    }
    session = { queue: buildQueue(), done: 0, again: 0, total: 0, xp: 0, reverse: !!session && session.reverse };
    session.total = session.queue.length;
    if (!session.queue.length) return reviewDone(true);
    showCard();
  };

  function reviewDone(nothing) {
    const next = Object.values(state.cards).filter(c => c.srs.due > endOfToday()).sort((a, b) => a.srs.due - b.srs.due)[0];
    if (!nothing) { Sfx.win(); confetti(); }
    const acc = session.done ? Math.round((session.done - session.again) / session.done * 100) : 0;
    view.innerHTML = `<div class="study-wrap"><div class="card empty celebrate">
      <div class="em">${nothing ? '🎉' : '🏆'}</div>
      <h2>${nothing ? 'Hôm nay bạn đã ôn hết!' : `Hoàn thành ${session.done} lượt ôn!`}</h2>
      ${nothing ? '' : `<div class="row center" style="gap:1.5rem;margin:1rem 0"><div><b style="font-size:1.6rem;color:var(--gold)">+${session.xp}</b><div class="tiny muted">XP</div></div><div><b style="font-size:1.6rem;color:var(--good)">${acc}%</b><div class="tiny muted">Nhớ ngay</div></div><div><b style="font-size:1.6rem">🔥${App.streak()}</b><div class="tiny muted">Chuỗi ngày</div></div></div>`}
      <p>${next ? `Thẻ tiếp theo đến hạn: <b>${new Date(next.srs.due).toLocaleDateString('vi-VN')}</b>.` : ''} Học đều mỗi ngày là bí quyết nhớ lâu.</p>
      <div class="row center"><a class="btn primary" href="#/practice/learn">🧠 Học thông minh</a><a class="btn" href="#/practice/match">⚡ Ghép thẻ</a><a class="btn" href="#/library">Thêm từ mới</a></div>
    </div></div>`;
  }

  function showCard() {
    const key = session.queue[0];
    const c = state.cards[key];
    if (!c) { session.queue.shift(); return session.queue.length ? showCard() : reviewDone(false); }
    let flipped = false;
    const ctx = c.contexts[0];
    const isNew = c.srs.reps === 0 && !c.srs.last;
    const rev = session.reverse;
    const pct = session.done / Math.max(1, session.done + session.queue.length) * 100;

    const front = rev ? `
        ${pic(c)}
        <div class="vi" style="font-size:1.6rem">${esc(c.vi)}</div>${posChip(c.pos)}
        ${c.ex ? `<div class="ctx">“${cloze(c.ex, c.word)}”</div>` : ''}
        <div class="muted small" style="margin-top:1rem">Nhớ lại từ tiếng Anh, rồi chạm để lật</div>` : `
        ${pic(c)}
        <div class="entry-word">${esc(c.word)}</div>
        <div class="row center"><span class="ipa">${esc(c.ipa)}</span>${posChip(c.pos)}<button class="icon-btn sm" data-say>🔊</button></div>
        ${ctx ? `<div class="ctx">📌 “${highlight(ctx.text, c.word)}”</div>` : ''}
        <div class="muted small" style="margin-top:1rem">Đoán nghĩa, rồi chạm để lật <span class="kbd">Space</span></div>`;

    view.innerHTML = `<div class="study-wrap">
      <div class="study-top">
        <a class="icon-btn" href="#/home" title="Thoát">✕</a>
        <div class="progress"><i style="width:${pct}%"></i></div>
        <span class="small muted" style="white-space:nowrap"><b>${session.queue.length}</b> còn lại</span>
      </div>
      <div class="row between small" style="margin-bottom:.6rem">
        <span>${isNew ? '<span class="chip lv">✨ TỪ MỚI</span>' : App.masteryDots(c.srs)}</span>
        <button class="btn sm ghost" id="toggleRev" title="Đổi chiều thẻ">${rev ? '🇻🇳 → 🇬🇧' : '🇬🇧 → 🇻🇳'}</button>
      </div>
      <div class="flash" id="flash">
        <div class="flash-inner">
          <div class="card face front">${front}</div>
          <div class="card face back">
            <div class="row"><span class="entry-word" style="font-size:1.9rem">${esc(c.word)}</span>${posChip(c.pos)}${levelChip(c.level)}
              <span class="ipa">${esc(c.ipa)}</span><button class="icon-btn sm" data-say>🔊</button></div>
            <div class="vi" style="margin:.3rem 0">${esc(c.vi)}</div>
            ${c.def ? `<div>${esc(c.def)}</div>` : ''}
            ${c.ex ? `<div class="example-box" style="margin-top:.8rem">${highlight(c.ex, c.word)} <button class="icon-btn sm" data-speak-text="${esc(c.ex)}">🔊</button></div>` : ''}
            ${c.contexts.length ? `<div style="margin-top:.8rem"><b class="small">📌 Ngữ cảnh của bạn</b>${c.contexts.slice(0, 2).map(x => `<div class="ex small" style="margin-top:.3rem">“${highlight(x.text, c.word)}”${x.title ? ` <span class="muted">— ${esc(x.title)}</span>` : ''}${x.vi ? `<div style="font-style:normal">🇻🇳 ${esc(x.vi)}</div>` : ''}</div>`).join('')}</div>` : ''}
            ${(c.sentences || []).length ? `<div style="margin-top:.8rem"><b class="small">💬 Câu song ngữ</b>${c.sentences.map(x => `<div class="small" style="margin-top:.3rem">${highlight(x.en, c.word)}<div class="muted">${esc(x.vi)}</div></div>`).join('')}</div>` : ''}
            ${c.col.length ? `<div class="small" style="margin-top:.8rem">🔗 ${c.col.map(esc).join(' · ')}</div>` : ''}
            ${c.syn.length ? `<div class="small" style="margin-top:.3rem">≈ ${c.syn.map(esc).join(', ')}</div>` : ''}
            ${c.note ? `<div class="small" style="margin-top:.6rem">📝 ${esc(c.note)}</div>` : ''}
            ${SRS.retention(c.srs) != null ? `<div class="tiny muted" style="margin-top:.8rem">🧠 Khả năng còn nhớ trước lần ôn này: <b>${Math.round(SRS.retention(c.srs) * 100)}%</b> · đã quên ${c.srs.lapses} lần</div>` : ''}
            <details style="margin-top:.8rem" data-gen><summary class="small"><b>✍️ Tự đặt câu với “${esc(c.word)}”</b> <span class="muted">(+5 XP · giúp nhớ sâu hơn)</span></summary>
              <textarea class="input" id="genTxt" style="margin-top:.5rem;min-height:60px" placeholder="Viết một câu về bản thân bạn có dùng từ này…"></textarea>
              <button class="btn sm" id="genSave" style="margin-top:.4rem">Lưu câu của tôi</button></details>
          </div>
        </div>
      </div>
      <div id="actions" style="margin-top:1rem"><button class="btn primary lg block" id="flipBtn">Lật thẻ</button></div>
      <p class="muted tiny center" style="margin-top:1rem">Phím tắt: <span class="kbd">Space</span> lật · <span class="kbd">1</span>–<span class="kbd">4</span> chấm điểm · <span class="kbd">P</span> phát âm</p>
    </div>`;
    App.bindCommon();
    const say = () => speak(c.word, accent(), c.audio);
    $$('[data-say]').forEach(b => b.onclick = e => { e.stopPropagation(); say(); });

    const flip = () => {
      if (flipped) return;
      flipped = true; Sfx.flip();
      $('#flash').classList.add('flipped');
      const labels = [['Quên', 'g-again'], ['Khó', 'g-hard'], ['Nhớ', 'g-good'], ['Dễ', 'g-easy']];
      $('#actions').innerHTML = `<div class="grades">${labels.map(([l, cls], i) => `<button class="btn ${cls}" data-grade="${i}">${l}<small>${SRS.preview(c.srs, i)}</small></button>`).join('')}</div>`;
      $$('[data-grade]').forEach(b => b.onclick = () => grade(+b.dataset.grade, b));
      if (rev || state.settings.autoSpeak) say();
    };
    $('#flash').addEventListener('click', e => { if (!e.target.closest('button, details, textarea')) flip(); });
    $('#genSave').onclick = async ev => {
      ev.stopPropagation();
      const text = $('#genTxt').value.trim();
      if (!text) return;
      if (!UI.wordRegex(c.word).test(text)) return toast(`Câu cần có từ “${c.word}” nhé`);
      c.contexts = [{ text, title: 'Câu của tôi', at: Date.now() }, ...c.contexts].slice(0, 5);
      await Cards.update(c); state.cards[key] = c;
      App.reward({ xp: 5 }, ev.currentTarget); Sfx.correct();
      ev.currentTarget.textContent = '✓ Đã lưu'; ev.currentTarget.disabled = true;
    };
    $('#flipBtn').onclick = flip;
    $('#toggleRev').onclick = () => { session.reverse = !session.reverse; showCard(); };
    document.onkeydown = e => {
      if (e.target.matches('input, textarea, summary')) return;
      if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); flip(); }
      else if (flipped && /^[1-4]$/.test(e.key)) grade(+e.key - 1, $(`[data-grade="${+e.key - 1}"]`));
      else if (e.key.toLowerCase() === 'p') say();
    };
    if (!rev && state.settings.autoSpeak) say();

    let graded = false;
    async function grade(g, el) {
      if (graded) return; graded = true;
      document.onkeydown = null;
      const wasNew = c.srs.reps === 0 && !c.srs.last;
      c.srs = SRS.review(c.srs, g);
      state.cards[key] = c;
      await Cards.update(c);
      state.stats = await Stats.logReview(wasNew);
      const xp = g === 0 ? 2 : wasNew ? 8 : 5;
      session.xp += xp;
      g === 0 ? Sfx.wrong() : Sfx.correct();
      App.reward({ reviews: 1, newWords: wasNew ? 1 : 0, again: g === 0 ? 1 : 0, xp }, el);
      session.queue.shift();
      session.done += 1;
      // Thẻ còn ở bước học (1–10 phút) quay lại trong cùng phiên
      if (c.srs.reps === 0) session.queue.splice(Math.min(session.queue.length, g === 0 ? 3 : 6), 0, key);
      if (g === 0) session.again += 1;
      session.queue.length ? showCard() : reviewDone(false);
    }
  }

  // ================= TRUNG TÂM LUYỆN TẬP =================
  const MODES = {
    learn: { em: '🧠', name: 'Học thông minh', run: runLearn },
    mcq: { em: '🧩', name: 'Trắc nghiệm', run: src => runQuiz(src, 'mcq') },
    cloze: { em: '✍️', name: 'Điền từ vào câu', run: src => runQuiz(src, 'cloze') },
    listen: { em: '🎧', name: 'Nghe & chép', run: src => runQuiz(src, 'listen') },
    test: { em: '📝', name: 'Bài kiểm tra', run: src => runQuiz(src, 'test') },
    match: { em: '⚡', name: 'Ghép thẻ', run: runMatch },
    speak: { em: '🎙️', name: 'Luyện phát âm', run: runSpeak },
  };

  routes.practice = function (mode, query) {
    const src = query.get('src') || 'deck';
    if (mode && MODES[mode]) return MODES[mode].run(src, query);
    view.innerHTML = `
      <div class="page-head"><div><h1>Trò chơi & bài tập</h1><p class="muted">Chọn nguồn từ, rồi chọn cách luyện. Mỗi bài đều cộng XP và tính vào nhiệm vụ ngày.</p></div>
        <label class="field" style="min-width:260px"><span class="small">Nguồn từ</span><select class="input" id="srcSel">${sourceList().map(([v, l]) => `<option value="${esc(v)}" ${v === src ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label></div>
      <div class="modes" id="modeGrid" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr))">${App.modeTiles().join('')}</div>`;
    const fix = () => $$('#modeGrid a').forEach(a => { a.href = a.getAttribute('href').split('?')[0] + `?src=${encodeURIComponent($('#srcSel').value)}`; });
    $('#srcSel').onchange = fix; fix();
  };

  function head(title, i, n, extra = '') {
    return `<div class="study-top"><a class="icon-btn" href="#/practice" title="Thoát">✕</a><div class="progress"><i style="width:${i / Math.max(1, n) * 100}%"></i></div><span class="small muted" style="white-space:nowrap">${extra || `${Math.min(i + 1, n)}/${n}`}</span></div>
      <div class="small muted" style="margin:-.4rem 0 .8rem">${title}</div>`;
  }

  // ---------- Bộ máy câu hỏi dùng chung ----------
  // q = { type: 'mcq-vi'|'mcq-en'|'type-cloze'|'type-listen'|'type-vi', w, list }
  function renderQuestion(box, q, onDone) {
    const w = q.w;
    let answered = false;
    const finish = (ok, given) => {
      if (answered) return; answered = true;
      ok ? Sfx.correct() : Sfx.wrong();
      const fb = $('#fb', box);
      fb.innerHTML = `<div class="feedback ${ok ? 'ok' : 'no'}">
        <div class="row between"><b style="font-size:1.1rem">${ok ? ['✅ Chính xác!', '🎉 Tuyệt vời!', '👏 Giỏi lắm!'][Math.floor(Math.random() * 3)] : `❌ Đáp án: ${esc(q.answer || w.word)}`}</b>
          <button class="btn primary" id="nextQ">Tiếp tục ↵</button></div>
        <div style="margin-top:.4rem"><b>${esc(w.word)}</b> <span class="ipa">${esc(w.ipa)}</span> – ${esc(w.vi)} <button class="icon-btn sm" data-sayw>🔊</button></div>
        ${w.ex ? `<div class="ex small">“${highlight(w.ex, w.word)}”</div>` : ''}</div>`;
      $('[data-sayw]', fb).onclick = () => speak(w.word, accent(), w.audio);
      if (!ok || q.type.startsWith('type')) speak(w.word, accent(), w.audio);
      $('#nextQ').focus();
      $('#nextQ').onclick = () => onDone(ok, $('#nextQ'));
    };

    if (q.type === 'mcq-vi' || q.type === 'mcq-en') {
      const key = q.type === 'mcq-vi' ? 'vi' : 'word';
      const opts = shuffle([w, ...distractors(w, q.list, 3, key)]);
      const prompt = q.type === 'mcq-vi'
        ? `${pic(w)}<div class="entry-word" style="margin-top:.6rem">${esc(w.word)}</div><div class="row center"><span class="ipa">${esc(w.ipa)}</span>${posChip(w.pos)}<button class="icon-btn sm" data-sayw>🔊</button></div><div class="muted small" style="margin-top:.6rem">Chọn nghĩa đúng</div>`
        : `<div class="vi" style="font-size:1.5rem">${esc(w.vi)}</div>${posChip(w.pos)}${w.ex ? `<div class="ctx" style="margin:1rem auto 0">“${cloze(w.ex, w.word)}”</div>` : ''}<div class="muted small" style="margin-top:.6rem">Chọn từ tiếng Anh đúng</div>`;
      box.innerHTML = `<div class="card q-card">${prompt.replace('class="pic"', 'class="pic" style="width:110px;margin:0 auto"')}</div>
        <div class="options ${key === 'word' ? 'two' : ''}">${opts.map((o, i) => `<button class="option" data-o="${esc(o.word)}"><span class="kbd">${i + 1}</span>${esc(o[key])}</button>`).join('')}</div><div id="fb"></div>`;
      const sw = $('[data-sayw]', box); if (sw) sw.onclick = () => speak(w.word, accent(), w.audio);
      const pick = b => {
        if (answered) return;
        const ok = b.dataset.o === w.word;
        $$('.option', box).forEach(x => { if (x.dataset.o === w.word) x.classList.add('right'); });
        if (!ok) b.classList.add('wrong');
        finish(ok);
      };
      $$('.option', box).forEach(b => b.onclick = () => pick(b));
      document.onkeydown = e => {
        if (answered) { if (e.key === 'Enter') { e.preventDefault(); $('#nextQ') && $('#nextQ').click(); } return; }
        const n = +e.key; if (n >= 1 && n <= opts.length) pick($$('.option', box)[n - 1]);
      };
      if (q.type === 'mcq-vi' && state.settings.autoSpeak) speak(w.word, accent(), w.audio);
      return;
    }

    // Dạng gõ đáp án
    const isCloze = q.type === 'type-cloze' && w.ex && UI.wordRegex(w.word).test(w.ex);
    const target = isCloze ? clozeAnswer(w.ex, w.word) : w.word;
    q.answer = target;
    let prompt;
    if (q.type === 'type-listen') {
      prompt = `<div style="font-size:3rem">🎧</div><div class="row center"><button class="btn primary" id="play">🔊 Nghe</button><button class="btn" id="slow">🐢 Chậm</button></div><div class="muted small" style="margin-top:.8rem">Gõ lại từ bạn nghe được${w.vi ? ` · gợi ý: ${esc(w.vi)}` : ''}</div>`;
    } else if (isCloze) {
      prompt = `<div style="font-size:1.15rem;line-height:1.8">“${cloze(w.ex, w.word)}”</div><div class="muted" style="margin-top:.8rem">Gợi ý: <b>${esc(w.vi)}</b> ${posChip(w.pos)} · bắt đầu bằng “${esc(target[0])}”, ${target.length} ký tự</div>`;
    } else {
      prompt = `<div class="vi" style="font-size:1.5rem">${esc(w.vi)}</div>${posChip(w.pos)}<div class="muted" style="margin-top:.8rem">Gõ từ tiếng Anh · bắt đầu bằng “${esc(w.word[0])}”, ${w.word.length} ký tự</div>`;
    }
    box.innerHTML = `<div class="card q-card">${prompt}</div>
      <form id="ansForm" style="margin-top:1rem" autocomplete="off"><div class="search">
        <input class="input big-input" id="ans" placeholder="Gõ đáp án…" autocapitalize="off" autocorrect="off" spellcheck="false">
        <button class="btn primary lg">Kiểm tra</button></div>
        <div class="row center" style="margin-top:.5rem"><button type="button" class="btn sm ghost" id="skip">Không biết – xem đáp án</button></div></form><div id="fb"></div>`;
    $('#ans').focus();
    if (q.type === 'type-listen') {
      $('#play').onclick = () => speak(w.word, accent(), w.audio);
      $('#slow').onclick = () => tts(w.word, accent(), 0.5);
      setTimeout(() => speak(w.word, accent(), w.audio), 250);
    }
    $('#skip').onclick = () => finish(false);
    $('#ansForm').onsubmit = e => {
      e.preventDefault();
      if (answered) return $('#nextQ').click();
      const a = $('#ans').value.trim().toLowerCase().replace(/\s+/g, ' ');
      if (!a) return;
      const ok = a === w.word.toLowerCase() || a === target.toLowerCase();
      // Sai 1 ký tự → cho thử lại một lần
      if (!ok && !q.retried && similarity(a, target) >= 0.8) { q.retried = true; toast('Gần đúng rồi! Kiểm tra lại chính tả 👀'); return; }
      $('#ans').disabled = true;
      finish(ok);
    };
    document.onkeydown = e => { if (answered && e.key === 'Enter' && e.target.id !== 'ans') { e.preventDefault(); $('#nextQ').click(); } };
  }

  // ---------- Trắc nghiệm / Điền từ / Nghe / Kiểm tra ----------
  function runQuiz(src, mode) {
    const list = pool(src);
    const n = mode === 'test' ? 20 : 10;
    const items = shuffle(list).slice(0, Math.min(n, list.length));
    if (!items.length) return emptySource(src);
    const types = { mcq: ['mcq-vi'], cloze: ['type-cloze'], listen: ['type-listen'], test: ['mcq-vi', 'mcq-en', 'type-cloze', 'type-listen', 'type-vi'] }[mode];
    const qs = items.map((w, i) => ({ type: mode === 'test' ? types[i % types.length] : types[0], w, list }));
    if (mode === 'test') qs.sort(() => Math.random() - .5);
    const title = `${MODES[mode].em} ${MODES[mode].name} · ${esc(srcName(src))}`;
    const run = { i: 0, score: 0, wrong: [], xp: 0 };
    const next = () => {
      if (run.i >= qs.length) return finish();
      view.innerHTML = `<div class="study-wrap">${head(title, run.i, qs.length, `✅ ${run.score}`)}<div id="qbox"></div></div>`;
      renderQuestion($('#qbox'), qs[run.i], (ok, el) => {
        if (ok) { run.score++; run.xp += 3; App.reward({ xp: 3 }, el); } else run.wrong.push(qs[run.i].w);
        run.i++; next();
      });
    };
    const finish = () => {
      document.onkeydown = null;
      const pct = Math.round(run.score / qs.length * 100);
      const perfect = pct === 100;
      App.reward({ quizzes: 1, perfect: perfect ? 1 : 0, xp: perfect ? 15 : 5 });
      if (pct >= 80) { Sfx.win(); confetti(); }
      const unit = new URLSearchParams(location.hash.split('?')[1] || '').get('unit');
      const unitPassed = unit && App.completeUnit ? App.completeUnit(unit, pct) : null;
      const band = mode === 'test' ? (pct >= 95 ? '8.5+' : pct >= 85 ? '7.5–8.0' : pct >= 70 ? '6.5–7.0' : pct >= 50 ? '5.5–6.0' : '< 5.5') : '';
      view.innerHTML = `<div class="study-wrap"><div class="card empty celebrate">
        <div class="em">${pct >= 80 ? '🏆' : pct >= 50 ? '👍' : '💪'}</div>
        <div class="score-ring" style="--p:${pct};--c:${pct >= 80 ? 'var(--good)' : pct >= 50 ? 'var(--hard)' : 'var(--again)'}"><b>${pct}%</b></div>
        <h2 style="margin-top:1rem">${run.score}/${qs.length} câu đúng</h2>
        ${band ? `<p>Mức từ vựng ước tính: <b>Band ${band}</b> <span class="muted small">(tham khảo)</span></p>` : ''}
        <p class="muted">+${run.xp + (perfect ? 15 : 5)} XP</p>
        ${run.wrong.length ? `<p>Cần ôn lại:</p><div class="row center">${run.wrong.map(w => `<a class="chip" href="#/dict/${encodeURIComponent(w.word)}">${esc(w.word)}</a>`).join('')}</div>
          ${run.wrong.some(w => !App.inDeck(w.word)) ? '<p><button class="btn sm" id="addWrong">+ Đưa các từ sai vào flashcard</button></p>' : ''}` : '<p>Không sai câu nào – xuất sắc! 🎉</p>'}
        ${unit ? `<div class="feedback ${pct >= 80 ? 'ok' : 'no'}" style="position:static;margin:1rem 0">${pct >= 80 ? '🏁 <b>Hoàn thành bài!</b> Các từ đã được thêm vào flashcard để ôn đúng thời điểm vàng.' : '🔁 Cần đạt <b>80%</b> để hoàn thành bài – ôn lại các từ sai rồi thử lại nhé.'}</div>` : ''}
        <div class="row center" style="margin-top:1rem">${unit ? `<a class="btn primary" href="#/path">🗺️ Về lộ trình</a><button class="btn" id="again">Làm lại</button>` : `<button class="btn primary" id="again">Làm lượt mới</button><a class="btn" href="#/practice?src=${encodeURIComponent(src)}">Đổi chế độ</a>`}</div>
      </div></div>`;
      if (unitPassed) unitPassed.then(first => { if (first) { confetti(160); Sfx.win(); } });
      $('#again').onclick = () => runQuiz(src, mode);
      const aw = $('#addWrong');
      if (aw) aw.onclick = async () => { for (const w of run.wrong) if (!App.inDeck(w.word)) await App.addWord(INDEX[w.word.toLowerCase()] || w, null, { silent: true }); toast('Đã thêm vào flashcard'); aw.disabled = true; };
    };
    next();
  }

  function emptySource(src) {
    view.innerHTML = `<div class="study-wrap"><div class="card empty"><div class="em">🫙</div><h2>Chưa có từ để luyện</h2><p>Nguồn “${esc(srcName(src))}” đang trống.</p><div class="row center"><a class="btn primary" href="#/practice?src=deck">Chọn nguồn khác</a><a class="btn" href="#/library">Mở thư viện</a></div></div></div>`;
  }

  // ---------- Học thông minh (kiểu Quizlet Learn) ----------
  function runLearn(src) {
    const list = pool(src);
    // Ưu tiên từ chưa thuộc
    const rank = w => { const c = state.cards[w.word.toLowerCase()]; return c ? SRS.mastery(c.srs) : -1; };
    const items = shuffle(list).sort((a, b) => rank(a) - rank(b)).slice(0, Math.min(8, list.length));
    if (!items.length) return emptySource(src);
    const stage = new Map(items.map(w => [w.word, 0])); // 0: chọn nghĩa, 1: chọn từ, 2: gõ từ, 3: xong
    const STAGES = ['mcq-vi', 'mcq-en', 'type-cloze'];
    let queue = shuffle(items), mistakes = 0, answered = 0;
    const introduced = new Set();
    const title = `🧠 Học thông minh · ${esc(srcName(src))}`;
    const next = () => {
      queue = queue.filter(w => stage.get(w.word) < 3);
      if (!queue.length) return finish();
      const w = queue.shift();
      const doneSteps = [...stage.values()].reduce((a, b) => a + b, 0);
      view.innerHTML = `<div class="study-wrap">${head(title, doneSteps, items.length * 3, `🎯 ${[...stage.values()].filter(v => v === 3).length}/${items.length} từ`)}<div id="qbox"></div></div>`;
      const st = stage.get(w.word);
      // Lần đầu gặp từ chưa thuộc → giới thiệu từ (hình, âm, nghĩa, ví dụ) trước khi kiểm tra
      if (st === 0 && !introduced.has(w.word) && rank(w) <= 0) {
        introduced.add(w.word);
        $('#qbox').innerHTML = `<div class="card q-card"><span class="chip lv">✨ Từ mới</span>
          ${pic(w).replace('class="pic"', 'class="pic" style="width:130px;margin:1rem auto"')}
          <div class="entry-word">${esc(w.word)}</div>
          <div class="row center"><span class="ipa">${esc(w.ipa)}</span>${posChip(w.pos)}${levelChip(w.level)}<button class="icon-btn sm" id="sayI">🔊</button></div>
          <div class="vi" style="margin-top:.4rem">${esc(w.vi)}</div>
          ${w.def ? `<div class="muted small" style="margin-top:.3rem">${esc(w.def)}</div>` : ''}
          ${w.ex ? `<div class="example-box" style="margin-top:1rem;text-align:left">${highlight(w.ex, w.word)}</div>` : ''}
        </div><button class="btn primary lg block" id="gotIt" style="margin-top:1rem">Đã hiểu, kiểm tra tôi →</button>`;
        $('#sayI').onclick = () => speak(w.word, accent(), w.audio);
        speak(w.word, accent(), w.audio);
        $('#gotIt').focus();
        $('#gotIt').onclick = () => { queue.unshift(w); next(); };
        document.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); $('#gotIt').click(); } };
        return;
      }
      renderQuestion($('#qbox'), { type: STAGES[st], w, list }, (ok, el) => {
        answered++;
        if (ok) { stage.set(w.word, st + 1); App.reward({ xp: 2 }, el); }
        else { mistakes++; stage.set(w.word, Math.max(0, st - 1)); }
        if (stage.get(w.word) < 3) queue.splice(Math.min(queue.length, 2 + Math.floor(Math.random() * 2)), 0, w);
        next();
      });
    };
    const finish = async () => {
      document.onkeydown = null;
      const notIn = items.filter(w => !App.inDeck(w.word));
      App.reward({ quizzes: 1, perfect: mistakes === 0 ? 1 : 0, newWords: notIn.length, xp: 20 });
      Sfx.win(); confetti();
      view.innerHTML = `<div class="study-wrap"><div class="card empty celebrate">
        <div class="em">🧠</div><h2>Bạn đã học xong ${items.length} từ!</h2>
        <p class="muted">${answered} câu trả lời · ${mistakes} lần sai · +20 XP thưởng</p>
        <div class="row center" style="margin:1rem 0">${items.map(w => `<a class="chip" href="#/dict/${encodeURIComponent(w.word)}">${esc(w.emoji)} ${esc(w.word)}</a>`).join('')}</div>
        ${notIn.length ? `<p><button class="btn primary" id="addLearned">+ Đưa ${notIn.length} từ vào flashcard để ôn định kỳ</button></p>` : '<p class="small muted">Các từ này đã có trong flashcard – hệ thống sẽ nhắc bạn ôn đúng lúc.</p>'}
        <div class="row center" style="margin-top:.6rem"><button class="btn" id="again">Học 8 từ tiếp theo</button><a class="btn" href="#/practice/match?src=${encodeURIComponent(src)}">⚡ Ghép thẻ</a></div>
      </div></div>`;
      $('#again').onclick = () => runLearn(src);
      const al = $('#addLearned');
      if (al) al.onclick = async () => { for (const w of notIn) await App.addWord(INDEX[w.word.toLowerCase()] || w, null, { silent: true }); al.disabled = true; al.textContent = '✓ Đã thêm'; Sfx.win(); };
    };
    next();
  }

  // ---------- Ghép thẻ (Match) ----------
  function runMatch(src) {
    const list = pool(src).filter(w => w.vi);
    const items = shuffle(list).slice(0, 6);
    if (items.length < 3) return emptySource(src);
    const tiles = shuffle([...items.map(w => ({ id: w.word, label: w.word, kind: 'en' })), ...items.map(w => ({ id: w.word, label: w.vi, kind: 'vi' }))]);
    const t0 = performance.now();
    let sel = null, left = items.length, misses = 0, timer;
    view.innerHTML = `<div class="study-wrap" style="max-width:820px">
      <div class="study-top"><a class="icon-btn" href="#/practice" title="Thoát">✕</a><div class="grow small muted">⚡ Ghép từ với nghĩa đúng · ${esc(srcName(src))}</div><span class="timer" id="timer">0.0s</span></div>
      <div class="match-grid">${tiles.map((t, i) => `<button class="tile" data-i="${i}">${esc(t.label)}</button>`).join('')}</div>
      <p class="muted small center" style="margin-top:1rem">Mỗi lần ghép sai +1 giây phạt</p></div>`;
    timer = setInterval(() => { const el = $('#timer'); if (el) el.textContent = ((performance.now() - t0) / 1000 + misses).toFixed(1) + 's'; }, 100);
    App.cleanup = () => clearInterval(timer);
    $$('.tile').forEach(b => b.onclick = () => {
      const t = tiles[+b.dataset.i];
      if (b.classList.contains('gone')) return;
      if (t.kind === 'en') speak(t.label, accent());
      if (!sel) { sel = b; b.classList.add('sel'); Sfx.pop(); return; }
      if (sel === b) { b.classList.remove('sel'); sel = null; return; }
      const a = tiles[+sel.dataset.i];
      if (a.id === t.id && a.kind !== t.kind) {
        Sfx.correct(); sel.classList.add('gone'); b.classList.add('gone'); sel = null; left--;
        if (!left) done();
      } else {
        Sfx.wrong(); misses++; const s = sel; s.classList.remove('sel'); s.classList.add('bad'); b.classList.add('bad');
        setTimeout(() => { s.classList.remove('bad'); b.classList.remove('bad'); }, 400); sel = null;
      }
    });
    async function done() {
      clearInterval(timer);
      const time = +((performance.now() - t0) / 1000 + misses).toFixed(1);
      const best = state.game.best.match;
      const xp = 10 + (time < 25 ? 10 : time < 40 ? 5 : 0);
      await App.reward({ matches: 1, quizzes: 1, perfect: misses === 0 ? 1 : 0, matchTime: time, xp });
      Sfx.win(); confetti();
      view.innerHTML = `<div class="study-wrap"><div class="card empty celebrate">
        <div class="em">⚡</div><h2>${time}s</h2>
        <p>${!best || time < best ? '🏅 Kỷ lục mới!' : `Kỷ lục của bạn: ${best}s`} · ${misses} lần sai · +${xp} XP</p>
        <div class="row center">${items.map(w => `<span class="chip">${esc(w.word)} = ${esc(w.vi)}</span>`).join('')}</div>
        <div class="row center" style="margin-top:1.2rem"><button class="btn primary" id="again">Chơi lại</button><a class="btn" href="#/practice?src=${encodeURIComponent(src)}">Chế độ khác</a></div>
      </div></div>`;
      $('#again').onclick = () => runMatch(src);
    }
  }

  // ---------- Luyện phát âm (nhận dạng giọng nói) ----------
  function runSpeak(src, query) {
    const one = query && query.get('w');
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const items = one ? [norm(INDEX[one.toLowerCase()] || state.cards[one.toLowerCase()] || { word: one })] : shuffle(pool(src)).slice(0, 10);
    if (!items.length) return emptySource(src);
    let i = 0, good = 0, rec = null, total = 0;
    const title = `🎙️ Luyện phát âm · ${one ? esc(one) : esc(srcName(src))}`;
    App.cleanup = () => { try { rec && rec.abort(); } catch (e) { /* đã dừng */ } };
    const show = () => {
      if (i >= items.length) return finish();
      const w = items[i];
      view.innerHTML = `<div class="study-wrap">${head(title, i, items.length, `🎯 ${good}`)}
        <div class="card q-card">
          ${pic(w).replace('class="pic"', 'class="pic" style="width:110px;margin:0 auto 1rem"')}
          <div class="entry-word">${esc(w.word)}</div>
          <div class="row center"><span class="ipa" style="font-size:1.1rem">${esc(w.ipa)}</span><button class="icon-btn" id="model" title="Nghe mẫu">🔊</button><button class="icon-btn" id="modelSlow" title="Nghe chậm">🐢</button></div>
          ${w.vi ? `<div class="vi" style="font-size:1rem;margin-top:.3rem">${esc(w.vi)}</div>` : ''}
          <div style="margin:1.6rem 0 .6rem"><button class="mic" id="mic" title="Bấm và nói">🎙️</button></div>
          <div class="muted small" id="hint">${SR ? 'Bấm micro rồi đọc to từ trên' : '⚠️ Trình duyệt không hỗ trợ nhận dạng giọng nói – hãy dùng Chrome hoặc Edge.'}</div>
          <div id="result" style="margin-top:1rem"></div>
        </div>
        <div class="row center" style="margin-top:1rem"><button class="btn" id="skipW">Bỏ qua</button><button class="btn primary" id="nextW" hidden>Từ tiếp theo →</button></div>
      </div>`;
      $('#model').onclick = () => speak(w.word, accent(), w.audio);
      $('#modelSlow').onclick = () => tts(w.word, accent(), 0.55);
      $('#skipW').onclick = () => { i++; show(); };
      $('#nextW').onclick = () => { i++; show(); };
      setTimeout(() => speak(w.word, accent(), w.audio), 300);
      let scored = false;
      $('#mic').onclick = () => {
        if (!SR) return toast('Trình duyệt không hỗ trợ nhận dạng giọng nói');
        try { rec && rec.abort(); } catch (e) { /* bỏ qua */ }
        if (window.speechSynthesis) speechSynthesis.cancel();
        rec = new SR();
        rec.lang = accent(); rec.maxAlternatives = 5; rec.interimResults = false;
        $('#mic').classList.add('rec'); $('#hint').textContent = '🔴 Đang nghe… hãy đọc to và rõ';
        rec.onresult = e => {
          const alts = [...e.results[0]].map(a => a.transcript.trim());
          const best = alts.map(a => ({ a, s: similarity(a, w.word) })).sort((x, y) => y.s - x.s)[0];
          const score = Math.round(best.s * 100);
          total++;
          const color = score >= 85 ? 'var(--good)' : score >= 65 ? 'var(--hard)' : 'var(--again)';
          $('#result').innerHTML = `<div class="score-ring" style="--p:${score};--c:${color}"><b>${score}</b></div>
            <p style="margin-top:.6rem"><b>${score >= 85 ? '🌟 Xuất sắc!' : score >= 65 ? '👍 Khá tốt, thử lại cho chuẩn hơn' : '🔁 Chưa đúng, nghe mẫu rồi thử lại'}</b></p>
            <p class="muted small">Máy nghe được: “${esc(best.a)}”</p>`;
          if (score >= 65 && !scored) { scored = true; good++; App.reward({ spoken: 1, xp: score >= 85 ? 5 : 3 }, $('#mic')); score >= 85 ? Sfx.win() : Sfx.correct(); }
          else if (score < 65) Sfx.wrong();
          $('#nextW').hidden = false;
        };
        rec.onerror = e => {
          $('#hint').textContent = e.error === 'not-allowed' ? '⚠️ Bạn cần cho phép dùng micro (biểu tượng 🎙️ trên thanh địa chỉ).' : e.error === 'no-speech' ? 'Không nghe thấy gì – thử lại nhé.' : `Lỗi nhận dạng: ${e.error}`;
        };
        rec.onend = () => { const m = $('#mic'); if (m) m.classList.remove('rec'); const h = $('#hint'); if (h && /Đang nghe/.test(h.textContent)) h.textContent = 'Bấm micro để thử lại'; };
        rec.start();
      };
    };
    const finish = () => {
      App.reward({ quizzes: 1, xp: 5 });
      Sfx.win(); if (good >= items.length * 0.7) confetti();
      view.innerHTML = `<div class="study-wrap"><div class="card empty celebrate"><div class="em">🎙️</div>
        <h2>Phát âm tốt ${good}/${items.length} từ</h2><p class="muted">Luyện đều mỗi ngày để Speaking tự nhiên hơn.</p>
        <div class="row center"><button class="btn primary" id="again">Luyện tiếp</button><a class="btn" href="#/practice">Chế độ khác</a></div></div></div>`;
      $('#again').onclick = () => runSpeak(src);
    };
    show();
  }
})();
