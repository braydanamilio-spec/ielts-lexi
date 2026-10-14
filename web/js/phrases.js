/* Cụm từ & cấu trúc câu: bài mẫu có chú thích (cụm từ + nghĩa, từ nối, vai trò câu), Sổ cụm từ,
 * bôi đen bất kỳ đoạn nào trong app để lưu thành cụm kèm nghĩa, cách dùng và câu ví dụ. */
(function () {
  const { $, $$, esc, toast, modal, closeModal } = UI;
  const App = window.App;
  const { state, routes } = App;
  const view = App.view;

  // ---------- Hiển thị bài mẫu có chú thích ----------
  // [[cụm|nghĩa]]  {{từ nối}}  <<Nhãn vai trò>>
  function renderAnnotated(text) {
    return text.split(/\n\s*\n/).map(p => {
      let h = esc(p.trim());
      // Vai trò ở đầu đoạn → nhãn phía trên đoạn; giữa đoạn → nhãn nhỏ trong dòng
      let head = '';
      h = h.replace(/^&lt;&lt;([^&]+?)&gt;&gt;\s*/, (m, r) => { head = `<div class="an-ptag"><span class="an-role">${r}</span></div>`; return ''; });
      h = h.replace(/&lt;&lt;([^&]+?)&gt;&gt;\s*/g, '<span class="an-role an-inl">$1</span> ')
        .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, (m, en, vi) => `<span class="an-ch" data-ph="${en}" data-vi="${vi}" tabindex="0"><span class="an-en">${en}</span><span class="an-gl">${vi}</span></span>`)
        .replace(/\{\{([^}]+)\}\}/g, '<span class="an-lk">$1</span>');
      return head + '<p>' + h + '</p>';
    }).join('');
  }
  App.renderAnnotated = renderAnnotated;
  const plain = t => t.replace(/<<[^>]*>>/g, '').replace(/\[\[([^|\]]*)\|[^\]]*\]\]/g, '$1').replace(/\{\{([^}]*)\}\}/g, '$1');
  // Chữ "sạch" của một vùng: bỏ chú thích tiếng Việt, nhãn vai trò, nút bấm → không bị dính chữ hay lẫn Việt – Anh
  const NOISE = '.an-gl, .an-role, button, .ctxvi, .vi, .tiny, sup, [hidden], .kbd';
  const cleanText = node => { const c = node.cloneNode(true); if (c.querySelectorAll) c.querySelectorAll(NOISE).forEach(x => x.remove()); return (c.textContent || '').replace(/🔊/g, '').replace(/\s+/g, ' ').replace(/\s+([,.;:!?])/g, '$1').trim(); };
  const sentenceOf = (el) => {
    // câu chứa phần tử (để làm ngữ cảnh khi lưu)
    const p = el.closest('p'); if (!p) return '';
    const text = p.innerText.replace(/\n/g, ' ');
    const t = cleanText(p);
    const sents = t.match(/[^.!?]+[.!?]+/g) || [t];
    const ph = el.dataset.ph || el.textContent;
    return (sents.find(s => s.includes(ph)) || text).trim();
  };

  routes.model = function (id) {
    const m = (window.MODELS || []).find(x => x.id === id);
    if (!m) { view.innerHTML = '<div class="card empty"><div class="em">📄</div>Chưa có bài mẫu này.</div>'; return; }
    const p2 = m.task === 2 ? (window.WRITE_PROMPTS || []).find(p => p.id === m.ref) : null;
    const d1 = m.task === 1 && App.task1 ? App.task1.SETS.find(x => x.id === m.ref) : null;
    const TYPE_VI = { line: 'Biểu đồ đường', bar: 'Biểu đồ cột', pie: 'Biểu đồ tròn', table: 'Bảng số liệu', process: 'Quy trình', map: 'Bản đồ' };
    const kind = m.task === 1 ? (d1 ? TYPE_VI[d1.type] : 'Task 1') : (p2 ? p2.type : 'Task 2');
    const hl = state.settings.annot2 || 'ch lk role';
    const on = k => hl.split(' ').includes(k);
    const chunks = [...m.text.matchAll(/\[\[([^|\]]+)\|([^\]]+)\]\]/g)].map(x => ({ en: x[1], vi: x[2] }));
    const links = [...new Set([...m.text.matchAll(/\{\{([^}]+)\}\}/g)].map(x => x[1]))];
    const back = `#/${m.task === 1 ? 'task1/' + m.ref : 'write/' + m.ref}`;
    view.innerHTML = `
      <a href="${back}" class="small">← Về đề bài</a>
      <div class="md-head card">
        <div class="row between" style="align-items:flex-start">
          <div><div class="row" style="gap:.35rem"><span class="md-badge">Writing Task ${m.task}</span><span class="md-badge soft">${esc(kind)}</span><span class="md-badge band">Band ${esc(m.band)}</span></div>
            <h1 class="md-title">Bài mẫu có phân tích</h1></div>
          <div class="row"><span class="chip">${m.words} từ</span><button class="btn sm" id="readM">🔊 Nghe bài</button><a class="btn sm ghost" href="${back}">✍️ Tự viết đề này</a></div>
        </div>
        <div class="md-prompt">${m.task === 1 ? `<div class="small muted" style="margin-bottom:.4rem">ĐỀ BÀI</div><div>${esc(d1 ? d1.title : 'Task 1 · ' + m.ref)} Summarise the information by selecting and reporting the main features, and make comparisons where relevant.</div>${d1 ? `<details class="md-chart"><summary class="small">📊 Xem biểu đồ</summary><div class="t1chart">${App.task1.draw(d1)}</div></details>` : ''}`
          : `<div class="small muted" style="margin-bottom:.4rem">ĐỀ BÀI</div><div>${esc(p2 ? p2.text : 'Task 2 · ' + m.ref)}</div>`}</div>
      </div>
      <div class="tabs" id="mTabs" style="margin:1rem 0">${[['read', '📄 Đọc bài mẫu'], ['vocab', '🧩 Điền cụm từ'], ['gram', '📐 Ngữ pháp'], ['link', '🔗 Từ nối'], ['copy', '⌨️ Chép câu'], ['write', '✍️ Viết lại câu']].map(([k, l], i) => `<button class="${i ? '' : 'on'}" data-mt="${k}">${l}</button>`).join('')}</div>
      <div id="mPane" hidden></div>
      <div id="mRead" class="md-grid">
        <div>
          <div class="md-tools" id="anBar">
            ${[['ch', 'Cụm từ hay'], ['gl', 'Nghĩa dưới cụm'], ['lk', 'Từ nối'], ['role', 'Vai trò câu']].map(([k, l]) => `<label class="md-sw"><input type="checkbox" data-an="${k}" ${on(k) ? 'checked' : ''}><span></span>${l}</label>`).join('')}
          </div>
          <article class="card annot md-paper ${['ch', 'gl', 'lk', 'role'].filter(on).map(k => 'an-' + k).join(' ')}" id="annot">${renderAnnotated(m.text)}</article>
          <p class="tiny muted" style="margin-top:.5rem">💡 Di chuột / chạm vào cụm tô màu để xem nghĩa, bấm để lưu. Bôi đen bất kỳ chữ nào để tra nghĩa hoặc lưu cấu trúc của riêng bạn.</p>
        </div>
        <aside class="md-side">
          <div class="card">
            <div class="row between"><h3 style="margin:0">🧩 Cụm từ hay <span class="muted small">(${chunks.length})</span></h3><button class="btn sm primary" id="saveAll">Lưu tất cả</button></div>
            <div class="md-list">${chunks.map((c, i) => `<div class="md-item"><div><b>${esc(c.en)}</b><div class="small muted">${esc(c.vi)}</div></div><button class="icon-btn sm" data-sv="${i}" title="Lưu vào Sổ cụm từ">${App.inDeck(c.en) ? '✓' : '+'}</button></div>`).join('')}</div>
          </div>
          ${links.length ? `<div class="card" style="margin-top:1rem"><h3 style="margin:0 0 .5rem">🔗 Từ nối & liên kết</h3><div class="row">${links.map(l => `<span class="md-lchip">${esc(l)}</span>`).join('')}</div></div>` : ''}
        </aside>
      </div>`;
    $$('[data-sv]').forEach(b => b.onclick = async () => {
      const c = chunks[+b.dataset.sv]; if (App.inDeck(c.en)) return;
      const sent = (plain(m.text).match(/[^.!?]+[.!?]+/g) || []).find(s => s.includes(c.en)) || '';
      await App.addWord({ word: c.en, vi: c.vi, pos: 'phrase', ex: sent.trim(), emoji: '🧩', topic: 'phrases' }, sent ? { text: sent.trim(), title: `Bài mẫu Task ${m.task}` } : null, { silent: true });
      b.textContent = '✓'; Sfx.correct();
    });
    $$('#mTabs button').forEach(b => b.onclick = () => {
      $$('#mTabs button').forEach(x => x.classList.toggle('on', x === b));
      const k = b.dataset.mt; $('#mRead').hidden = k !== 'read'; $('#mPane').hidden = k === 'read';
      if (k !== 'read') EX[k](m, $('#mPane'));
    });
    $$('[data-an]').forEach(b => b.onchange = () => {
      $('#annot').classList.toggle('an-' + b.dataset.an, b.checked);
      state.settings.annot2 = $$('[data-an]:checked').map(x => x.dataset.an).join(' '); App.saveSettings();
    });
    $('#annot').addEventListener('click', e => {
      const ch = e.target.closest('.an-ch'); if (!ch) return;
      savePhraseDialog({ phrase: ch.dataset.ph, vi: ch.dataset.vi, sentence: sentenceOf(ch), title: `Bài mẫu Task ${m.task}` });
    });
    $('#saveAll').onclick = async () => {
      const ps = [...m.text.matchAll(/\[\[([^|\]]+)\|([^\]]+)\]\]/g)];
      let n = 0;
      for (const [, en, vi] of ps) if (!App.inDeck(en)) {
        const sent = (plain(m.text).match(/[^.!?]+[.!?]+/g) || []).find(s => s.includes(en)) || '';
        await App.addWord({ word: en, vi, pos: 'phrase', ex: sent.trim(), emoji: '🧩', topic: 'phrases' }, sent ? { text: sent.trim(), title: `Bài mẫu Task ${m.task}` } : null, { silent: true }); n++;
      }
      Sfx.win(); toast(`Đã lưu ${n} cụm từ vào Sổ cụm từ`); $('#saveAll').disabled = true;
    };
    let reading = false;
    $('#readM').onclick = () => { if (reading) { UI.stopSpeak(); reading = false; return; } reading = true; UI.tts(plain(m.text), state.settings.accent, null, { onEnd: () => { reading = false; } }); };
  };


  // ================= BÀI TẬP SINH TỰ ĐỘNG TỪ BÀI MẪU =================
  const paras = t => t.split(/\n\s*\n/);
  const stripRole = p => p.replace(/<<[^>]*>>\s*/g, '');
  const roleOf = p => (p.match(/<<([^>]*)>>/) || [])[1] || '';
  const norm = x => x.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9' ]/g, ' ').replace(/\s+/g, ' ').trim();
  function finish(m, kind, right, total, box) {
    const pct = Math.round(right / Math.max(1, total) * 100);
    App.reward({ quizzes: 1, perfect: pct === 100 ? 1 : 0, xp: 5 + right * 2 }); pct >= 80 ? (Sfx.win(), confetti(80)) : Sfx.correct();
    box.insertAdjacentHTML('beforeend', `<div class="feedback ${pct >= 70 ? 'ok' : 'no'}" style="position:static;margin-top:1rem"><b>${right}/${total} đúng (${pct}%)</b> · +${5 + right * 2} XP</div>`);
  }
  // Ô điền + ngân hàng từ (dùng cho từ vựng & liên kết)
  function gapExercise(m, box, kind) {
    const re = kind === 'vocab' ? /\[\[([^|\]]+)\|[^\]]+\]\]/g : /\{\{([^}]+)\}\}/g;
    const answers = [];
    const html = paras(m.text).map(p => '<p>' + esc(stripRole(p)).replace(kind === 'vocab' ? /\[\[([^|\]]+)\|[^\]]+\]\]/g : /\{\{([^}]+)\}\}/g, (x, a) => { const raw = a.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'); const i = answers.push(raw) - 1; return `<input class="gap" data-i="${i}" size="${Math.max(6, raw.length)}" autocomplete="off" spellcheck="false">`; })
      .replace(kind === 'vocab' ? /\{\{([^}]+)\}\}/g : /\[\[([^|\]]+)\|[^\]]+\]\]/g, '$1') + '</p>').join('');
    const bank = UI.shuffle([...new Set(answers)]);
    box.innerHTML = `<div class="card"><p class="small muted">${kind === 'vocab' ? 'Điền các <b>cụm từ</b> vào chỗ trống. Bấm vào cụm trong ngân hàng để điền vào ô đang chọn.' : 'Điền <b>từ nối / cụm liên kết</b> phù hợp vào chỗ trống.'}</p>
      <div class="bank">${bank.map(w => `<button class="chip bankw" style="border:2px solid var(--line);cursor:pointer">${esc(w)}</button>`).join('')}</div>
      <div class="annot" style="font-size:1rem;line-height:2.3;margin-top:1rem">${html}</div>
      <div class="row" style="margin-top:1rem"><button class="btn primary" id="chk">Kiểm tra</button><button class="btn" id="show">Xem đáp án</button><button class="btn ghost" id="clr">Xóa hết</button></div></div>`;
    let focus = box.querySelector('.gap');
    $$('.gap', box).forEach(g => g.onfocus = () => { focus = g; });
    // Mờ các cụm đã dùng trong ngân hàng
    const syncBank = () => { const used = new Set($$('.gap', box).map(g => norm(g.value)).filter(Boolean)); $$('.bankw', box).forEach(b => b.classList.toggle('used', used.has(norm(b.textContent)))); };
    $$('.gap', box).forEach(g => g.addEventListener('input', syncBank));
    $$('.bankw', box).forEach(b => b.onclick = () => { if (!focus) return; focus.value = b.textContent; focus.classList.remove('ok', 'no'); syncBank(); const nx = [...box.querySelectorAll('.gap')].find(x => !x.value); if (nx) nx.focus(); });
    $('#chk', box).onclick = () => { let r = 0; $$('.gap', box).forEach(g => { const ok = norm(g.value) === norm(answers[+g.dataset.i]); g.classList.toggle('ok', ok); g.classList.toggle('no', !ok); if (ok) r++; }); finish(m, kind, r, answers.length, box.firstElementChild); };
    $('#show', box).onclick = () => $$('.gap', box).forEach(g => { g.value = answers[+g.dataset.i]; g.classList.remove('no'); }) || syncBank();
    $('#clr', box).onclick = () => $$('.gap', box).forEach(g => { g.value = ''; g.className = 'gap'; }) || syncBank();
  }
  // Luyện ngữ pháp: chọn dạng đúng của từ tại các vị trí trong bài
  const FORMS = [['rise', 'rose', 'risen', 'rising', 'rises'], ['fall', 'fell', 'fallen', 'falling', 'falls'], ['increase', 'increased', 'increasing', 'increases'], ['decrease', 'decreased', 'decreasing', 'decreases'], ['decline', 'declined', 'declining', 'declines'], ['grow', 'grew', 'grown', 'growing', 'grows'], ['remain', 'remained', 'remaining', 'remains'], ['show', 'shows', 'showed', 'shown'], ['see', 'saw', 'seen', 'sees'], ['have', 'has', 'had', 'having'], ['is', 'are', 'was', 'were', 'be', 'been'], ['reach', 'reached', 'reaches', 'reaching'], ['become', 'became', 'becomes', 'becoming'], ['spend', 'spent', 'spends', 'spending'], ['lead', 'led', 'leads', 'leading'], ['make', 'made', 'makes', 'making'], ['take', 'took', 'taken', 'takes', 'taking'], ['give', 'gave', 'given', 'gives'], ['believe', 'believes', 'believed', 'believing'], ['argue', 'argues', 'argued', 'arguing'], ['provide', 'provides', 'provided', 'providing'], ['encourage', 'encourages', 'encouraged', 'encouraging'], ['reduce', 'reduces', 'reduced', 'reducing'], ['country', 'countries'], ['student', 'students'], ['household', 'households'], ['figure', 'figures'], ['people', 'person'], ['a', 'an', 'the'], ['much', 'many'], ['less', 'fewer'], ['high', 'higher', 'highest'], ['low', 'lower', 'lowest'], ['large', 'larger', 'largest'], ['significant', 'significantly'], ['dramatic', 'dramatically'], ['steady', 'steadily'], ['sharp', 'sharply'], ['slight', 'slightly']];
  const formOf = w => FORMS.find(f => f.includes(w.toLowerCase()));
  function gramExercise(m, box) {
    const text = paras(plain(m.text)).join('\n\n');
    let picked = 0; const answers = [];
    const html = text.split(/\n\n/).map(p => '<p>' + p.split(/(\s+)/).map(tok => {
      const mm = tok.match(/^([^A-Za-z]*)([A-Za-z]+)([^A-Za-z]*)$/);
      const f = mm && formOf(mm[2]);
      if (!f || picked >= 12 || Math.random() < 0.45) return esc(tok);
      picked++; const i = answers.push(mm[2]) - 1;
      const opts = UI.shuffle(f.slice()).map(o => mm[2][0] === mm[2][0].toUpperCase() ? o[0].toUpperCase() + o.slice(1) : o);
      return `${esc(mm[1])}<select class="gap gsel" data-i="${i}"><option value="">…</option>${opts.map(o => `<option>${esc(o)}</option>`).join('')}</select>${esc(mm[3])}`;
    }).join('') + '</p>').join('');
    box.innerHTML = `<div class="card"><p class="small muted">Chọn <b>dạng đúng</b> của từ ở mỗi ô (thì, số ít/số nhiều, so sánh, tính từ/trạng từ, mạo từ) cho phù hợp ngữ pháp.</p>
      <div class="annot" style="font-size:1rem;line-height:2.4">${html}</div>
      <div class="row" style="margin-top:1rem"><button class="btn primary" id="chk">Kiểm tra</button><button class="btn" id="redo">🔀 Đổi vị trí khác</button></div></div>`;
    $('#chk', box).onclick = () => { let r = 0; $$('.gsel', box).forEach(g => { const ok = g.value.toLowerCase() === answers[+g.dataset.i].toLowerCase(); g.classList.toggle('ok', ok); g.classList.toggle('no', !ok); if (ok) r++; else g.title = 'Đáp án: ' + answers[+g.dataset.i]; }); finish(m, 'gram', r, answers.length, box.firstElementChild); };
    $('#redo', box).onclick = () => gramExercise(m, box);
  }
  // Chép câu: chỉ hiện chữ cái đầu, gõ lại cả câu từ trí nhớ
  const sentencesOf = m => paras(m.text).flatMap(p => { const role = roleOf(p); return (plain(stripRole(p)).match(/[^.!?]+[.!?]+/g) || []).map((s, i) => ({ s: s.trim(), role: i === 0 ? role : '' })); });
  const hint = s => s.split(/\s+/).map(w => w.replace(/^([^A-Za-z]*)([A-Za-z])[A-Za-z'’-]*/, '$1$2…')).join(' ');
  function diffHtml(a, b) {
    // tô màu từ sai/thiếu so với câu mẫu
    const A = norm(a).split(' '), B = b.split(/\s+/);
    return B.map(w => A.includes(norm(w).split(' ')[0]) ? `<span style="color:var(--good)">${esc(w)}</span>` : `<b style="color:var(--again)">${esc(w)}</b>`).join(' ');
  }
  function lineExercise(m, box, mode) {
    const sents = sentencesOf(m);
    box.innerHTML = `<div class="card"><p class="small muted">${mode === 'copy' ? 'Mỗi câu chỉ hiện <b>chữ cái đầu</b> của từng từ. Nhớ lại và gõ cả câu – luyện ghi nhớ cấu trúc câu band 8.' : 'Dịch <b>câu tiếng Việt</b> sang tiếng Anh theo cách diễn đạt học thuật, rồi so với bài mẫu.'}</p>
      <div id="lines">${sents.map((x, i) => `<div class="line" data-i="${i}">${x.role ? `<span class="an-role" style="display:inline-block;background:#16a34a;color:#fff;border-radius:6px;padding:.05rem .5rem;font-size:.75rem;font-weight:700">${esc(x.role)}</span> ` : ''}<span class="lhint">${mode === 'copy' ? esc(hint(x.s)) : '<i class="muted">⏳ đang dịch…</i>'}</span>
        <textarea class="input lin" rows="2" placeholder="Gõ câu tiếng Anh…" spellcheck="false"></textarea><div class="lres small"></div></div>`).join('')}</div>
      <div class="row" style="margin-top:1rem"><button class="btn primary" id="chk">Kiểm tra tất cả</button><button class="btn" id="show">Xem bài mẫu</button></div></div>`;
    if (mode === 'write') sents.forEach(async (x, i) => { const v = await Dict.translateVi(x.s); const el = box.querySelector(`.line[data-i="${i}"] .lhint`); if (el) el.innerHTML = `🇻🇳 <b>${esc(v || '(không dịch được)')}</b>`; });
    $('#chk', box).onclick = () => {
      let r = 0;
      $$('.line', box).forEach(l => {
        const s = sents[+l.dataset.i].s, v = l.querySelector('.lin').value.trim();
        if (!v) return;
        const sc = Math.round(UI.similarity(norm(v), norm(s)) * 100);
        if (sc >= (mode === 'copy' ? 90 : 60)) r++;
        l.querySelector('.lres').innerHTML = `<b style="color:${sc >= 85 ? 'var(--good)' : sc >= 60 ? 'var(--hard)' : 'var(--again)'}">${sc}% giống bài mẫu</b> · ${diffHtml(v, s)}`;
      });
      finish(m, mode, r, sents.length, box.firstElementChild);
    };
    $('#show', box).onclick = () => $$('.line', box).forEach(l => { l.querySelector('.lres').innerHTML = `<span class="muted">Bài mẫu:</span> ${esc(sents[+l.dataset.i].s)}`; });
  }
  const EX = { vocab: (m, b) => gapExercise(m, b, 'vocab'), link: (m, b) => gapExercise(m, b, 'link'), gram: gramExercise, copy: (m, b) => lineExercise(m, b, 'copy'), write: (m, b) => lineExercise(m, b, 'write') };

  // ---------- Hộp thoại lưu cụm từ / cấu trúc ----------
  async function savePhraseDialog({ phrase, vi = '', sentence = '', title = '' }) {
    const box = modal(`<h2>🧩 Lưu cụm từ / cấu trúc</h2>
      <div class="stack">
        <label class="field"><span>Cụm từ hoặc cấu trúc</span><input class="input" id="pPh" value="${esc(phrase)}" placeholder="vd: pose a threat to / not only … but also …"></label>
        <label class="field"><span>Nghĩa theo cụm</span><div class="row nowrap"><input class="input" id="pVi" value="${esc(vi)}" placeholder="Nghĩa tiếng Việt của cả cụm"><button class="btn sm" id="pTr" type="button">🌐 Dịch</button></div></label>
        <label class="field"><span>Cách dùng / mẫu cấu trúc (tùy chọn)</span><input class="input" id="pUse" placeholder="vd: S + pose a threat to + N · dùng trong Writing Task 2"></label>
        <label class="field"><span>Câu ví dụ / ngữ cảnh</span><textarea class="input" id="pEx">${esc(sentence)}</textarea></label>
      </div>
      <div class="row between" style="margin-top:1rem"><button class="btn" data-close>Hủy</button><button class="btn primary" id="pSave">Lưu vào Sổ cụm từ</button></div>`);
    const tr = async () => { const t = $('#pPh').value.trim(); if (!t) return; $('#pVi').placeholder = '⏳ Đang dịch…'; const v = await Dict.translateVi(t); if (!$('#pVi').value) $('#pVi').value = v; $('#pVi').placeholder = 'Nghĩa tiếng Việt của cả cụm'; };
    $('#pTr').onclick = tr;
    if (!vi) tr();
    $('#pSave').onclick = async () => {
      const p = $('#pPh').value.trim().replace(/\s+/g, ' '); if (!p) return;
      const ex = $('#pEx').value.trim();
      const card = await App.addWord({ word: p, vi: $('#pVi').value.trim(), pos: 'phrase', ex, emoji: '🧩', topic: 'phrases' }, ex ? { text: ex, title } : null);
      const use = $('#pUse').value.trim();
      if (use) { card.note = use; await Core.Cards.update(card); }
      closeModal(); toast(`Đã lưu “${p}” – vào Sổ cụm từ để ôn`); Sfx.correct();
    };
    return box;
  }
  App.savePhraseDialog = savePhraseDialog;

  // ---------- Bôi đen bất kỳ đoạn nào trong app: 🔎 tra nghĩa · 🌐 dịch · 🧩 lưu cụm ----------
  // (Trên trang Vocaband, tiện ích Chrome nhường phần này cho app để không hiện 2 bảng tra)
  const bar = document.createElement('div');
  bar.className = 'sel-bar'; bar.hidden = true;
  document.body.appendChild(bar);
  const pop = document.createElement('div');
  pop.className = 'sel-pop card'; pop.hidden = true;
  document.body.appendChild(pop);
  let selInfo = null;
  const NO_LOOKUP = 'input, textarea, select, .cbt, .mk-read, .mk-write, .mk-qs, .sel-pop, .sel-bar, .pop';
  const place = (el, r, below = 8) => {
    el.style.left = Math.max(8, Math.min(innerWidth - el.offsetWidth - 8, r.left + r.width / 2 - el.offsetWidth / 2)) + 'px';
    const top = r.bottom + below; el.style.top = (top + el.offsetHeight > innerHeight - 8 ? Math.max(8, r.top - el.offsetHeight - 8) : top) + 'px';
  };
  const readSel = () => {
    const sel = getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
    const node = sel.anchorNode, el = node && (node.nodeType === 1 ? node : node.parentElement);
    if (!el || !view.contains(el) || el.closest(NO_LOOKUP) || document.body.classList.contains('bare')) return null;
    const t = cleanText(sel.getRangeAt(0).cloneContents());
    if (!t || t.length > 600 || !/[A-Za-z]{2}/.test(t) || /[À-ỹ]/.test(t)) return null;
    const block = el.closest('p, li, .example-box, .ex, .meaning, .sent, .tl, .lq-item, div');
    const full = block ? cleanText(block) : t;
    const sents = full.match(/[^.!?]+[.!?]+["”’)]*|[^.!?]+$/g) || [full];
    let sentence = (sents.find(x => x.toLowerCase().includes(t.toLowerCase().slice(0, 40))) || full).trim();
    if (sentence.length > 300) sentence = sentence.slice(0, 297) + '…';
    return { text: t.replace(/^[^A-Za-z(]+|[^A-Za-z)]+$/g, ''), sentence, rect: sel.getRangeAt(0).getBoundingClientRect() };
  };
  const onSelect = () => setTimeout(() => {
    const info = readSel();
    if (!info) { bar.hidden = true; return; }
    selInfo = info;
    const n = info.text.split(/\s+/).length;
    bar.innerHTML = `${n <= 4 ? '<button data-act="look">🔎 Tra nghĩa</button>' : '<button data-act="tr">🌐 Dịch</button>'}${n >= 2 && n <= 14 ? '<button data-act="save">🧩 Lưu cụm</button>' : ''}${n <= 4 ? '<button data-act="say" title="Nghe">🔊</button>' : ''}`;
    bar.hidden = false; place(bar, info.rect);
  }, 10);
  document.addEventListener('mouseup', e => { if (!bar.contains(e.target) && !pop.contains(e.target)) onSelect(); });
  document.addEventListener('touchend', e => { if (!bar.contains(e.target) && !pop.contains(e.target)) setTimeout(onSelect, 250); });
  document.addEventListener('mousedown', e => { if (!bar.contains(e.target)) bar.hidden = true; if (!pop.contains(e.target) && !bar.contains(e.target)) pop.hidden = true; });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { bar.hidden = true; pop.hidden = true; } });
  window.addEventListener('hashchange', () => { bar.hidden = true; pop.hidden = true; });
  bar.addEventListener('mousedown', e => e.preventDefault()); // giữ nguyên vùng chọn khi bấm nút
  bar.onclick = async e => {
    const act = e.target.closest('[data-act]'); if (!act || !selInfo) return;
    const info = selInfo, k = act.dataset.act;
    if (k === 'say') return UI.speak(info.text, state.settings.accent);
    bar.hidden = true;
    if (k === 'save') { getSelection().removeAllRanges(); return savePhraseDialog({ phrase: info.text, sentence: info.sentence, title: 'Lưu từ Vocaband' }); }
    pop.hidden = false; pop.innerHTML = `<div class="muted small">⏳ ${k === 'look' ? 'Đang tra' : 'Đang dịch'} “${esc(info.text.slice(0, 60))}”…</div>`; place(pop, info.rect);
    if (k === 'tr') {
      const vi = await Dict.translateVi(info.text);
      pop.innerHTML = `<div class="row between nowrap"><b class="small">🌐 Bản dịch</b><button class="icon-btn sm" data-x>✕</button></div><div style="margin:.4rem 0;line-height:1.6">${esc(vi || 'Không dịch được – thử lại sau.')}</div>
        <div class="row"><button class="btn sm" data-sp>🔊 Nghe câu gốc</button></div>`;
      $('[data-sp]', pop).onclick = () => UI.tts(info.text, state.settings.accent);
    } else {
      const w = info.text.toLowerCase();
      const d = (await Dict.quick(w)) || (await Dict.lookup(w, { examples: false, image: false }));
      if (!d || !d.found) {
        const vi = (d && d.vi) || await Dict.translateVi(info.text);
        pop.innerHTML = `<div class="row between nowrap"><b>${esc(info.text)}</b><button class="icon-btn sm" data-x>✕</button></div><div class="vi" style="margin:.3rem 0">${esc(vi || 'Không tìm thấy')}</div>${info.text.includes(' ') ? '<button class="btn sm primary" data-ph>🧩 Lưu cụm</button>' : ''}`;
      } else {
        pop.innerHTML = `<div class="row between nowrap"><div><b style="font-size:1.2rem">${esc(d.word)}</b> ${UI.posChip ? UI.posChip(d.pos) : ''}</div><button class="icon-btn sm" data-x>✕</button></div>
          <div class="row" style="gap:.3rem"><span class="ipa">${esc(d.ipa || '')}</span><button class="icon-btn sm" data-sp>🔊</button></div>
          <div class="vi" style="font-size:1.05rem;margin:.2rem 0">${esc(d.vi)}</div>
          ${d.def ? `<div class="small muted">${esc(d.def)}</div>` : ''}
          ${info.sentence && info.sentence !== info.text ? `<div class="example-box small" style="margin-top:.5rem">📌 ${UI.highlight(info.sentence, d.word)}</div>` : ''}
          <div class="row" style="margin-top:.6rem"><button class="btn sm primary" data-save>${App.inDeck(d.word) ? '+ Thêm ngữ cảnh' : '+ Lưu flashcard'}</button>${info.text.includes(' ') ? '<button class="btn sm" data-ph>🧩 Lưu cụm</button>' : ''}<a class="btn sm ghost" href="#/dict/${encodeURIComponent(d.word)}">Chi tiết</a></div>`;
        $('[data-sp]', pop).onclick = () => UI.speak(d.word, state.settings.accent, d.audio);
        $('[data-save]', pop).onclick = async ev => {
          const b = ev.currentTarget; b.disabled = true;
          const vi = info.sentence ? await Dict.translateVi(info.sentence) : '';
          await App.addWord(d, info.sentence ? { text: info.sentence, vi, title: document.title.replace(/ – Vocaband$/, '') || 'Vocaband' } : null);
          b.textContent = '✓ Đã lưu';
        };
        if (state.settings.autoSpeak) UI.speak(d.word, state.settings.accent, d.audio);
      }
      const ph = $('[data-ph]', pop); if (ph) ph.onclick = () => { pop.hidden = true; savePhraseDialog({ phrase: info.text, sentence: info.sentence, title: 'Lưu từ Vocaband' }); };
    }
    place(pop, info.rect);
    $('[data-x]', pop).onclick = () => { pop.hidden = true; };
  };

  // ---------- Sổ cụm từ & cấu trúc ----------
  const isPhrase = c => /\s/.test(c.word.trim()) || c.pos === 'phrase' || c.topic === 'phrases';
  App.isPhrase = isPhrase;
  routes.phrases = function () {
    const list = Object.values(state.cards).filter(isPhrase).sort((a, b) => b.added - a.added);
    const models = window.MODELS || [];
    view.innerHTML = `
      <div class="page-head"><div><h1>🧩 Sổ cụm từ & cấu trúc</h1><p class="muted">Học theo <b>cụm</b> (chunk) giúp nói và viết tự nhiên hơn học từng từ rời. Lưu cụm từ, cấu trúc câu kèm nghĩa theo cụm, cách dùng và câu ví dụ – ôn đúng thời điểm vàng như từ vựng.</p></div>
        <div class="row"><button class="btn primary" id="addP">＋ Thêm cụm / cấu trúc</button>${list.length >= 4 ? '<a class="btn" href="#/practice/learn?src=phrases">🧠 Học các cụm</a>' : ''}</div></div>
      ${models.length ? `<div class="card"><h3>📄 Bài mẫu có chú thích cụm từ</h3><div class="row" style="margin-top:.5rem">${models.map(m => `<a class="chip" href="#/model/${m.id}">Task ${m.task} · ${esc(m.ref)} · Band ${esc(m.band)}</a>`).join('')}</div></div>` : ''}
      <div class="card" style="margin-top:1rem" id="pList">${list.length ? list.map(c => `<div class="deck-row" style="grid-template-columns:minmax(0,1.2fr) minmax(0,1.6fr) auto">
          <div style="min-width:0"><b>${esc(c.word)}</b><div class="small" style="color:var(--accent);font-weight:700">${esc(c.vi)}</div>${c.note ? `<div class="tiny muted">📐 ${esc(c.note)}</div>` : ''}</div>
          <div class="small muted hide-sm">${c.contexts[0] ? `“${UI.highlight(c.contexts[0].text.slice(0, 140), c.word)}”` : esc(c.ex || '')}</div>
          <div class="row nowrap" style="gap:.3rem"><button class="icon-btn sm" data-speak="${esc(c.word)}">🔊</button>${App.masteryDots(c.srs)}</div></div>`).join('')
        : '<div class="empty"><div class="em">🧩</div>Chưa có cụm từ nào. Bôi đen một cụm trong bài đọc, bài mẫu hay ví dụ từ điển rồi bấm “🧩 Lưu cụm này”, hoặc thêm thủ công.</div>'}</div>`;
    App.bindCommon();
    $('#addP').onclick = () => savePhraseDialog({ phrase: '' });
  };
})();
