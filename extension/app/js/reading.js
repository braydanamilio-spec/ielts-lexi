/* Bài đọc IELTS: chạm vào từ để tra & lưu kèm câu làm ngữ cảnh, làm câu hỏi TFNG/MCQ. */
(function () {
  const { $, $$, esc, toast, speak, levelChip, posChip } = UI;
  const App = window.App;
  const { state, routes } = App;
  const view = App.view;
  const R = () => window.READINGS || [];

  routes.reading = function () {
    const done = (state.game.readDone || {});
    view.innerHTML = `
      <div class="page-head"><div><h1>Bài đọc IELTS</h1><p class="muted">Đọc bài theo phong cách IELTS Academic · chạm vào bất kỳ từ nào để tra nghĩa và lưu kèm câu gốc làm ngữ cảnh.</p></div></div>
      <div class="grid auto">${R().map(r => `
        <a class="card hover topic-card" href="#/read/${r.id}" style="color:var(--text)">
          <div class="row between"><span class="em">${r.emoji}</span>${levelChip(r.level)}</div>
          <h3>${esc(r.title)}</h3>
          <div class="muted small">${esc(r.summaryVi)}</div>
          <div class="row"><span class="chip">⏱ ${Math.max(2, Math.round(r.text.split(/\s+/).length / 140))} phút</span><span class="chip">${r.questions.length} câu hỏi</span>${done[r.id] ? `<span class="chip ok">✓ ${done[r.id]}</span>` : ''}</div>
        </a>`).join('')}</div>`;
  };

  routes.read = function (id) {
    const r = R().find(x => x.id === id);
    if (!r) return routes.reading();
    const kw = new Set(r.keywords.map(k => k.toLowerCase()));
    // Bọc từng từ thành phần tử chạm được + tô sáng AWL / từ nối / collocation / từ của tôi
    const paras = Lexis.markText(r.text, { keywords: kw, mine: w => App.inDeck(w) });
    const hl = (state.settings.hl || 'kw awl link mine').split(' ');

    view.innerHTML = `
      <a href="#/reading" class="small">← Tất cả bài đọc</a>
      <div class="grid" style="grid-template-columns:minmax(0,1fr) 300px;align-items:start;margin-top:.7rem" id="readGrid">
        <div class="card" style="padding:1.8rem;position:relative" id="paper">
          <div class="row between"><div class="row">${levelChip(r.level)}<span class="chip">${r.emoji} ${esc(r.topic)}</span></div>
            <button class="btn sm" id="readAloud">🔊 Nghe cả bài</button></div>
          <h1 style="margin:.8rem 0 .3rem">${esc(r.title)}</h1>
          <p class="muted" style="margin-bottom:.8rem">${esc(r.summaryVi)}</p>
          <div class="hl-bar" id="hlBar">
            <span class="tiny muted" style="font-weight:700">TÔ SÁNG:</span>
            ${[['kw', '🔑 Từ khóa'], ['awl', '🎓 Học thuật AWL'], ['link', '🧷 Từ nối & cụm'], ['mine', '📒 Từ của tôi']].map(([k, l]) => `<button class="hl-chip ${k} ${hl.includes(k) ? 'on' : ''}" data-hl="${k}">${l} <b data-count="${k}"></b></button>`).join('')}
          </div>
          <div class="passage ${hl.map(x => 'hl-' + x).join(' ')}" id="passage">${paras}</div>
          <div class="small muted">💡 Chạm vào từ để tra · bấm đúp vào câu để nghe câu đó · gạch chấm = từ khóa IELTS · nền xanh = từ đã có trong sổ</div>
        </div>
        <div style="position:sticky;top:80px" class="stack">
          <div class="card"><h3>🔑 Từ khóa</h3><div class="row">${r.keywords.map(k => `<button class="chip" data-kw="${esc(k)}" style="border:0;cursor:pointer">${esc(k)}</button>`).join('')}</div>
            <button class="btn sm block" id="addKw" style="margin-top:.8rem">+ Lưu tất cả từ khóa</button></div>
          <div class="card"><h3>📝 Câu hỏi</h3><p class="small muted">${r.questions.length} câu · True/False/Not Given & trắc nghiệm</p><a class="btn sm primary block" href="#qs">Làm bài →</a></div>
        </div>
      </div>
      <div class="card" style="margin-top:1rem" id="qs">
        <h2>Câu hỏi</h2>
        ${r.questions.map((q, i) => `<div class="q-item" data-q="${i}"><b>${i + 1}. ${esc(q.q)}</b>
          <div class="opts">${(q.type === 'tfng' ? ['TRUE', 'FALSE', 'NOT GIVEN'] : q.options).map((o, k) => `<button data-v="${q.type === 'tfng' ? o : k}">${q.type === 'mcq' ? String.fromCharCode(65 + k) + '. ' : ''}${esc(o)}</button>`).join('')}</div>
          <div class="small" data-explain hidden style="margin-top:.5rem"></div></div>`).join('')}
        <button class="btn primary" id="check" style="margin-top:1rem">Chấm điểm</button>
        <div id="qResult"></div>
      </div>`;
    if (innerWidth < 900) $('#readGrid').style.gridTemplateColumns = '1fr';

    // Thanh tô sáng
    const count = k => new Set($$(`#passage .tw.${k === 'link' ? 'link, #passage .tw.col' : k}`).map(x => x.dataset.ph || x.dataset.w)).size;
    const paintCounts = () => ['kw', 'awl', 'link', 'mine'].forEach(k => { const el = $(`[data-count="${k}"]`); if (el) el.textContent = count(k); });
    paintCounts();
    $$('[data-hl]').forEach(b => b.onclick = () => {
      b.classList.toggle('on');
      $('#passage').classList.toggle('hl-' + b.dataset.hl, b.classList.contains('on'));
      state.settings.hl = $$('[data-hl].on').map(x => x.dataset.hl).join(' ');
      App.saveSettings();
    });

    // Popover tra từ
    let pop = null;
    const closePop = () => { if (pop) { pop.remove(); pop = null; } $$('.tw.active').forEach(x => x.classList.remove('active')); };
    App.cleanup = () => { closePop(); UI.stopSpeak(); };
    async function openPop(el) {
      closePop();
      el.classList.add('active');
      const word = el.dataset.w;
      const sentence = el.closest('.sent').textContent.replace(/\s+/g, ' ').trim();
      const phrase = el.dataset.ph;
      pop = document.createElement('div');
      pop.className = 'pop';
      const paper = $('#paper');
      const pr = paper.getBoundingClientRect(), er = el.getBoundingClientRect();
      pop.style.left = Math.max(8, Math.min(er.left - pr.left - 20, pr.width - 370)) + 'px';
      pop.style.top = (er.bottom - pr.top + 8) + 'px';
      pop.innerHTML = `<div class="muted">⏳ Đang tra “${esc(word)}”…</div>`;
      paper.appendChild(pop);
      const mine = pop;
      const e = await Dict.lookup(word, { examples: false });
      if (pop !== mine) return;
      if (!e || !e.found) { pop.innerHTML = `<div class="muted">Không tìm thấy “${esc(word)}”.${e && e.vi ? ` Dịch: <b>${esc(e.vi)}</b>` : ''}</div>`; return; }
      const saved = App.inDeck(e.word);
      pop.innerHTML = `
        <div class="row between nowrap"><div><span style="font-size:1.3rem;font-weight:800">${esc(e.word)}</span> ${posChip(e.pos)}${levelChip(e.level)}</div><button class="icon-btn sm" data-x>✕</button></div>
        <div class="row"><span class="ipa">${esc(e.ipa)}</span><button class="icon-btn sm" data-s>🔊</button></div>
        <div class="vi" style="font-size:1.05rem">${esc(e.vi)}</div>
        ${e.def ? `<div class="small" style="margin-top:.3rem">${esc(e.def)}</div>` : ''}
        <div class="example-box small" style="margin-top:.6rem">📌 ${UI.highlight(sentence, e.word === word ? word : e.word)}</div>
        <div class="row" style="margin-top:.7rem"><button class="btn sm primary" data-save>${saved ? '+ Thêm ngữ cảnh' : '+ Lưu flashcard'}</button><a class="btn sm" href="#/dict/${encodeURIComponent(e.word)}">Chi tiết</a></div>`;
      $('[data-x]', pop).onclick = closePop;
      $('[data-s]', pop).onclick = () => speak(e.word, state.settings.accent, e.audio);
      $('[data-save]', pop).onclick = async ev => {
        const b = ev.currentTarget; b.disabled = true;
        const vi = await Dict.translateVi(sentence);
        await App.addWord(e, { text: sentence, vi, title: `Bài đọc: ${r.title}` });
        b.textContent = '✓ Đã lưu kèm ngữ cảnh';
        $$(`.tw[data-w="${CSS.escape(word)}"]`).forEach(x => x.classList.add('mine'));
        paintCounts();
      };
      if (state.settings.autoSpeak) speak(e.word, state.settings.accent, e.audio);
    }
    $('#passage').addEventListener('click', e => { const t = e.target.closest('.tw'); if (t) openPop(t); });
    document.addEventListener('mousedown', function off(e) {
      if (!document.body.contains($('#passage') || document.createElement('i'))) return document.removeEventListener('mousedown', off);
      if (pop && !pop.contains(e.target) && !e.target.closest('.tw')) closePop();
    });
    $$('[data-kw]').forEach(b => b.onclick = () => {
      const t = $(`.tw[data-w="${CSS.escape(b.dataset.kw.toLowerCase())}"]`) || $$('.tw').find(x => x.dataset.w.startsWith(b.dataset.kw.toLowerCase().slice(0, 5)));
      if (t) { t.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => openPop(t), 350); }
    });
    $('#addKw').onclick = async () => {
      $('#addKw').disabled = true;
      let n = 0;
      for (const k of r.keywords) {
        if (App.inDeck(k)) continue;
        const t = $(`.tw[data-w="${CSS.escape(k.toLowerCase())}"]`);
        const sentence = t ? t.closest('.sent').textContent.replace(/\s+/g, ' ').trim() : '';
        const local = IELTS_DATA.INDEX[k.toLowerCase()];
        await App.addWord(local || { word: k, topic: 'mine', emoji: r.emoji }, sentence ? { text: sentence, title: `Bài đọc: ${r.title}` } : null, { silent: true });
        n++;
      }
      Sfx.win(); toast(`Đã lưu ${n} từ khóa kèm câu ngữ cảnh`);
      $('#addKw').textContent = '✓ Đã lưu';
    };
    let reading = false;
    $('#readAloud').onclick = () => {
      if (!window.speechSynthesis) return toast('Trình duyệt không hỗ trợ đọc văn bản');
      const sents = $$('#passage .sent');
      const clear = () => sents.forEach(x => x.classList.remove('reading'));
      if (reading) { UI.stopSpeak(); reading = false; clear(); $('#readAloud').textContent = '🔊 Nghe cả bài'; return; }
      reading = true; $('#readAloud').textContent = '⏹ Dừng đọc';
      // Đọc từng câu theo đúng câu hiển thị → ngữ điệu tự nhiên + tô sáng câu đang đọc
      const text = sents.map(x => x.textContent.trim()).join(' ');
      const idx = []; sents.forEach((x, i) => UI.splitSentences(x.textContent).forEach(() => idx.push(i)));
      UI.tts(text, state.settings.accent, null, {
        onSentence: i => { clear(); const el = sents[idx[i]]; if (el) { el.classList.add('reading'); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } },
        onEnd: () => { reading = false; clear(); const b = $('#readAloud'); if (b) b.textContent = '🔊 Nghe cả bài'; },
      });
    };
    // Bấm đúp vào câu → nghe riêng câu đó
    $('#passage').addEventListener('dblclick', e => { const s = e.target.closest('.sent'); if (s) { e.preventDefault(); UI.tts(s.textContent, state.settings.accent); } });

    // Câu hỏi
    const answers = {};
    $$('.q-item').forEach(item => $$('.opts button', item).forEach(b => b.onclick = () => {
      if (item.dataset.locked) return;
      $$('.opts button', item).forEach(x => x.classList.toggle('sel', x === b));
      answers[item.dataset.q] = b.dataset.v;
    }));
    $('#check').onclick = async () => {
      if (Object.keys(answers).length < r.questions.length && !confirm('Bạn chưa trả lời hết. Vẫn chấm điểm?')) return;
      let score = 0;
      r.questions.forEach((q, i) => {
        const item = $(`.q-item[data-q="${i}"]`);
        item.dataset.locked = 1;
        const right = String(q.answer);
        const ok = answers[i] === right;
        if (ok) score++;
        $$('.opts button', item).forEach(b => { if (b.dataset.v === right) b.classList.add('right'); else if (b.classList.contains('sel')) b.classList.add('wrong'); });
        const ex = $('[data-explain]', item); ex.hidden = false; ex.innerHTML = `${ok ? '✅' : '❌'} ${esc(q.explain)}`;
      });
      $('#check').disabled = true;
      const pct = Math.round(score / r.questions.length * 100);
      const first = !(state.game.readDone || {})[r.id];
      await App.reward({ readings: first ? 1 : 0, quizzes: 1, perfect: pct === 100 ? 1 : 0, xp: 10 + score * 4 }, $('#check'));
      state.game = await Game.mutate(gs => { gs.readDone = { ...(gs.readDone || {}), [r.id]: `${score}/${r.questions.length}` }; });
      if (pct >= 80) { Sfx.win(); confetti(); }
      $('#qResult').innerHTML = `<div class="feedback ${pct >= 60 ? 'ok' : 'no'}" style="position:static"><b>Kết quả: ${score}/${r.questions.length} (${pct}%)</b> · +${10 + score * 4} XP
        <div class="row" style="margin-top:.6rem"><a class="btn sm" href="#/reading">Bài đọc khác</a><a class="btn sm primary" href="#/practice/learn?src=deck">🧠 Học các từ vừa lưu</a></div></div>`;
    };
  };
})();
