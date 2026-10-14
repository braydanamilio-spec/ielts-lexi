/* Phòng viết (Writing Lab): viết bài Task 2 có bấm giờ, phân tích từ vựng ngay trên máy – không tốn phí, không gửi bài đi đâu. */
(function () {
  const { $, $$, esc, toast, ring } = UI;
  const { Store } = Core;
  const App = window.App;
  const { state, routes } = App;
  const view = App.view;

  // Đề bài tự biên soạn theo dạng IELTS Task 2
  const PROMPTS = [
    { id: 'p1', type: 'Opinion', topic: 'education', text: 'Some people believe that university education should be free for all students. To what extent do you agree or disagree?' },
    { id: 'p2', type: 'Discussion', topic: 'technology', text: 'Some people think that technology has made our lives more complicated, while others believe it has made life easier. Discuss both views and give your own opinion.' },
    { id: 'p3', type: 'Problem–Solution', topic: 'urban', text: 'Traffic congestion is becoming a serious problem in many large cities. What are the causes of this problem, and what measures could be taken to solve it?' },
    { id: 'p4', type: 'Advantages–Disadvantages', topic: 'work', text: 'More and more people are choosing to work from home rather than in an office. Do the advantages of this trend outweigh the disadvantages?' },
    { id: 'p5', type: 'Opinion', topic: 'environment', text: 'Governments should spend more money on protecting the environment than on other public services. To what extent do you agree or disagree?' },
    { id: 'p6', type: 'Two-part', topic: 'health', text: 'Obesity rates among children are rising in many countries. Why is this happening, and what can parents and schools do about it?' },
    { id: 'p7', type: 'Discussion', topic: 'media', text: 'Some people believe advertising aimed at children should be banned, while others think it is acceptable. Discuss both views and give your opinion.' },
    { id: 'p8', type: 'Opinion', topic: 'crime', text: 'The best way to reduce crime is to give longer prison sentences. To what extent do you agree or disagree?' },
  ];

  let timer = null;
  routes.write = async function (arg) {
    const essays = await Store.get('essays', []);
    const draft = await Store.get('essayDraft', { prompt: 'p1', text: '' });
    const p = PROMPTS.find(x => x.id === (arg || draft.prompt)) || PROMPTS[0];
    const topic = App.topicOf(p.topic);
    view.innerHTML = `
      <div class="page-head"><div><h1>✍️ Phòng viết</h1><p class="muted">Viết bài IELTS Task 2 rồi nhận <b>phân tích từ vựng tức thì</b>: từ học thuật, từ nối, collocation, từ bị lặp và gợi ý thay thế. Bài viết chỉ lưu trên máy bạn.</p></div></div>
      <div class="grid" style="grid-template-columns:minmax(0,1fr) 300px;align-items:start" id="wGrid">
        <div class="stack">
          <div class="card">
            <div class="row between"><span class="chip lv">${esc(p.type)}</span><select class="input" id="pSel" style="width:auto;padding:.35rem .6rem">${PROMPTS.map(x => `<option value="${x.id}" ${x.id === p.id ? 'selected' : ''}>Đề ${x.id.slice(1)} · ${esc(x.type)}</option>`).join('')}</select></div>
            <p style="font-size:1.08rem;font-weight:600;margin:.8rem 0 0">${esc(p.text)}</p>
            <p class="tiny muted" style="margin-top:.5rem">Viết ít nhất 250 từ · thời gian gợi ý 40 phút</p>
          </div>
          <div class="card">
            <textarea class="input" id="essay" style="min-height:340px;font-size:1.02rem;line-height:1.7" placeholder="Bắt đầu viết bài của bạn…" spellcheck="true">${esc(draft.prompt === p.id ? draft.text : '')}</textarea>
            <div class="row between" style="margin-top:.7rem">
              <div class="row"><b id="wc">0 từ</b><span class="timer" id="clock" style="font-size:1rem">40:00</span><button class="btn sm" id="tBtn">⏱ Bấm giờ</button></div>
              <button class="btn primary" id="analyze">🔍 Phân tích từ vựng</button>
            </div>
          </div>
          <div id="report"></div>
        </div>
        <div class="stack" style="position:sticky;top:80px">
          <div class="card"><h3>💡 Từ vựng gợi ý · ${topic ? esc(topic.name) : ''}</h3>
            <div class="row" style="margin-top:.4rem">${(topic ? topic.words.slice(0, 14) : []).map(w => `<button class="chip" data-ins="${esc(w.word)}" title="${esc(w.vi)}" style="border:0;cursor:pointer">${esc(w.word)}</button>`).join('')}</div>
            <div class="tiny muted" style="margin-top:.5rem">Bấm để chèn vào bài</div></div>
          <div class="card"><h3>🧷 Từ nối hay dùng</h3>
            <div class="row" style="margin-top:.4rem">${['Firstly,', 'Moreover,', 'However,', 'On the other hand,', 'For instance,', 'As a result,', 'It could be argued that', 'In conclusion,'].map(w => `<button class="chip" data-ins="${esc(w)}" style="border:0;cursor:pointer">${esc(w)}</button>`).join('')}</div></div>
          ${essays.length ? `<div class="card"><h3>🗂 Bài đã viết</h3>${essays.slice(0, 6).map((e, i) => `<div class="row between small" style="padding:.35rem 0;border-bottom:1px dashed var(--line)"><span>Đề ${esc(e.prompt.slice(1))} · ${e.words} từ</span><span class="chip lv">LR ~${e.band}</span><button class="btn sm ghost" data-open="${i}">Mở</button></div>`).join('')}</div>` : ''}
        </div>
      </div>`;
    if (innerWidth < 900) $('#wGrid').style.gridTemplateColumns = '1fr';
    const ta = $('#essay');
    const count = () => { const n = (ta.value.match(/[A-Za-z][A-Za-z'’-]*/g) || []).length; $('#wc').textContent = `${n} từ`; $('#wc').style.color = n >= 250 ? 'var(--good)' : ''; };
    let saveT;
    ta.oninput = () => { count(); clearTimeout(saveT); saveT = setTimeout(() => Store.set('essayDraft', { prompt: p.id, text: ta.value }), 600); };
    count();
    $('#pSel').onchange = e => { location.hash = `#/write/${e.target.value}`; };
    $$('[data-ins]').forEach(b => b.onclick = () => {
      const s = ta.selectionStart, ins = b.dataset.ins + ' ';
      ta.value = ta.value.slice(0, s) + ins + ta.value.slice(ta.selectionEnd);
      ta.focus(); ta.selectionStart = ta.selectionEnd = s + ins.length; ta.oninput();
    });
    $$('[data-open]').forEach(b => b.onclick = () => { const e = essays[+b.dataset.open]; ta.value = e.text; ta.oninput(); report(e.text, p, false); });

    // Bấm giờ 40 phút
    let left = 40 * 60;
    clearInterval(timer); timer = null;
    App.cleanup = () => { clearInterval(timer); timer = null; };
    $('#tBtn').onclick = () => {
      if (timer) { clearInterval(timer); timer = null; $('#tBtn').textContent = '⏱ Tiếp tục'; return; }
      $('#tBtn').textContent = '⏸ Tạm dừng';
      timer = setInterval(() => {
        left--; const el = $('#clock'); if (!el) return clearInterval(timer);
        el.textContent = `${String(Math.floor(Math.max(0, left) / 60)).padStart(2, '0')}:${String(Math.max(0, left) % 60).padStart(2, '0')}`;
        el.style.color = left < 300 ? 'var(--again)' : '';
        if (left <= 0) { clearInterval(timer); timer = null; Sfx.win(); toast('⏰ Hết 40 phút – hãy phân tích bài viết của bạn!'); }
      }, 1000);
    };
    $('#analyze').onclick = () => report(ta.value, p, true);
  };

  async function report(text, p, fresh) {
    const a = Lexis.analyze(text);
    if (a.words < 40) return toast('Hãy viết ít nhất vài đoạn (≥ 40 từ) để phân tích nhé');
    const list = (m, cls) => [...m.entries()].sort((x, y) => y[1] - x[1]).map(([w, n]) => `<span class="chip ${cls || ''}">${esc(w)}${n > 1 ? ` ×${n}` : ''}</span>`).join(' ') || '<span class="muted small">Chưa có</span>';
    const tips = [];
    if (a.words < 250) tips.push(`Bài mới có <b>${a.words} từ</b> – IELTS Task 2 yêu cầu tối thiểu 250 từ, thiếu sẽ bị trừ điểm Task Response.`);
    if (a.awlRatio < 0.04) tips.push('Tăng từ học thuật (AWL): thay từ thông dụng bằng từ như <i>significant, approach, impact, consequence, factor</i>.');
    if (a.link.size < 4) tips.push('Đa dạng từ nối hơn (Moreover, Consequently, Nevertheless, For instance…) để tăng điểm Coherence & Cohesion.');
    if (a.phrases.size < 2) tips.push('Dùng thêm collocation tự nhiên: <i>pose a threat, play a pivotal role, raise awareness, a growing number of…</i>');
    if (a.sd < 4 && a.sentences > 4) tips.push('Câu có độ dài khá giống nhau – kết hợp câu ngắn và câu phức (mệnh đề quan hệ, câu điều kiện) để tăng điểm ngữ pháp.');
    if (a.avg > 30) tips.push('Câu trung bình hơi dài (> 30 từ) – dễ mắc lỗi ngữ pháp, nên tách bớt.');
    if (a.overused.length) tips.push(`Một số từ bị lặp nhiều lần – xem gợi ý thay thế bên dưới.`);
    if (!tips.length) tips.push('Từ vựng đa dạng và học thuật – tiếp tục duy trì! Hãy tự kiểm tra lại ngữ pháp và chính tả.');

    $('#report').innerHTML = `
      <div class="card stack">
        <div class="row nowrap" style="gap:1.2rem">
          <div class="score-ring" style="--p:${(a.band - 4) / 4.5 * 100};--c:${a.band >= 7 ? 'var(--good)' : a.band >= 6 ? 'var(--hard)' : 'var(--again)'}"><b>${a.band}</b></div>
          <div><h2 style="margin:0">Lexical Resource ước tính: ${a.band}</h2>
            <div class="small muted">Ước tính tự động dựa trên mật độ từ học thuật, collocation, từ nối, độ đa dạng và lặp từ – chỉ để tham khảo, không thay thế giám khảo.</div></div>
        </div>
        <div class="grid g4 stats">
          <div class="card stat" style="padding:.8rem"><div><b>${a.words}</b><span class="tiny muted">Số từ</span></div></div>
          <div class="card stat" style="padding:.8rem"><div><b>${[...a.awl.values()].reduce((x, y) => x + y, 0)}</b><span class="tiny muted">Từ AWL (${(a.awlRatio * 100).toFixed(1)}%)</span></div></div>
          <div class="card stat" style="padding:.8rem"><div><b>${a.link.size}</b><span class="tiny muted">Loại từ nối</span></div></div>
          <div class="card stat" style="padding:.8rem"><div><b>${Math.round(a.diversity * 100)}%</b><span class="tiny muted">Độ đa dạng từ</span></div></div>
        </div>
        <div><h3>📌 Nhận xét</h3><ul style="margin:.3rem 0;padding-left:1.2rem">${tips.map(t => `<li style="margin:.3rem 0">${t}</li>`).join('')}</ul></div>
        ${a.overused.length ? `<div><h3>🔁 Từ bị lặp & gợi ý thay thế</h3><div id="overused">${a.overused.map(([w, n]) => `<div class="row" style="padding:.3rem 0"><b>${esc(w)}</b><span class="chip">×${n}</span><span class="small muted" data-alt="${esc(w)}">đang tìm từ thay thế…</span></div>`).join('')}</div></div>` : ''}
        <div><h3>🎓 Từ học thuật (AWL) đã dùng</h3>${list(a.awl, 'lv')}</div>
        <div><h3>🧷 Từ nối & cụm từ</h3>${list(a.link)} ${[...a.phrases.keys()].filter(k => !a.link.has(k)).map(k => `<span class="chip ok">${esc(k)}</span>`).join(' ')}</div>
        <div><h3>📝 Bài viết được tô sáng</h3>
          <div class="hl-bar"><span class="hl-chip awl on">🎓 AWL</span><span class="hl-chip link on">🧷 Từ nối & cụm</span><span class="hl-chip mine on">📒 Từ của tôi</span></div>
          <div class="passage hl-awl hl-link hl-mine" style="font-size:1rem">${Lexis.markText(text, { mine: w => App.inDeck(w) })}</div></div>
      </div>`;
    $('#report').scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Gợi ý thay thế: từ thư viện trước, sau đó Datamuse
    $$('[data-alt]').forEach(async el => {
      const w = el.dataset.alt;
      let alts = ((IELTS_DATA.INDEX[w] || {}).syn || []).slice(0, 4);
      if (alts.length < 3) {
        try { const r = await fetch(`https://api.datamuse.com/words?ml=${encodeURIComponent(w)}&max=8`).then(x => x.json()); alts = [...new Set([...alts, ...r.map(x => x.word).filter(x => !/\s/.test(x))])].slice(0, 5); } catch (e) { /* offline */ }
      }
      el.innerHTML = alts.length ? '→ ' + alts.map(x => `<a class="chip" href="#/dict/${encodeURIComponent(x)}">${esc(x)}</a>`).join(' ') : 'không có gợi ý';
    });
    if (fresh) {
      const essays = await Store.get('essays', []);
      essays.unshift({ prompt: p.id, text, words: a.words, band: a.band, at: Date.now() });
      await Store.set('essays', essays.slice(0, 20));
      App.reward({ quizzes: 1, xp: 25 }, $('#analyze'));
      Sfx.win();
    }
  }
})();
