/* Ngữ pháp IELTS: danh sách bài theo chủ điểm, bài học trực quan (dòng thời gian, công thức màu, sơ đồ, thang đo), bài tập có chấm điểm. */
(function () {
  const { $, $$, esc, speak, ring } = UI;
  const App = window.App;
  const { state, routes } = App;
  const view = App.view;
  const L = () => (window.GRAMMAR || []).slice().sort((a, b) => (UNITS.findIndex(u => u.id === a.unit) - UNITS.findIndex(u => u.id === b.unit)) || (a.order - b.order));
  const UNITS = [
    { id: 'tenses', name: 'Thì động từ', emoji: '⏳', desc: '12 thì & cách diễn đạt tương lai – nền tảng cho mọi câu', color: '#6d5dfc' },
    { id: 'verbs', name: 'Cấu trúc động từ', emoji: '⚙️', desc: 'Động từ khuyết thiếu, bị động, câu điều kiện, câu tường thuật', color: '#0ea5a4' },
    { id: 'words', name: 'Từ loại & cụm từ', emoji: '🧱', desc: 'Mạo từ, danh từ đếm được, so sánh, giới từ, hòa hợp chủ – vị', color: '#f59e0b' },
    { id: 'sentences', name: 'Câu phức & nâng band', emoji: '🏗️', desc: 'Mệnh đề quan hệ, mệnh đề danh từ, liên kết, đảo ngữ – band 7+', color: '#c026d3' },
  ];
  const done = () => state.game.grammarDone || {};
  const sayBtn = t => `<button class="icon-btn sm" data-speak-text="${esc(t)}" title="Nghe">🔊</button>`;

  routes.grammar = function (id) {
    if (id) return lesson(id);
    const all = L();
    const d = done();
    view.innerHTML = `
      <div class="page-head"><div><h1>📐 Ngữ pháp IELTS</h1><p class="muted">${all.length} bài học trực quan: dòng thời gian, công thức tô màu, sơ đồ biến đổi câu, lỗi người Việt hay mắc và bài tập chấm điểm ngay.</p></div>
        ${ring(all.length ? Object.keys(d).length / all.length * 100 : 0, `${Object.keys(d).length}/${all.length}`, 'var(--good)')}</div>
      ${UNITS.map(u => {
        const ls = all.filter(x => x.unit === u.id);
        if (!ls.length) return '';
        return `<div class="section-title"><h2>${u.emoji} ${esc(u.name)}</h2><span class="muted small">${esc(u.desc)}</span></div>
          <div class="grid auto">${ls.map(x => `
            <a class="card hover topic-card" href="#/grammar/${x.id}" style="color:var(--text);border-top:4px solid ${u.color}">
              <div class="row between"><span class="em">${x.emoji}</span>${d[x.id] ? `<span class="chip ok">✓ ${d[x.id]}%</span>` : levelChip(x.level)}</div>
              <h3>${esc(x.title)}</h3><div class="tiny muted" style="font-weight:700">${esc(x.en)}</div>
              <div class="muted small">${esc(x.summary)}</div>
            </a>`).join('')}</div>`;
      }).join('') || '<div class="card empty"><div class="em">📐</div>Đang cập nhật bài học…</div>'}`;
  };
  const levelChip = l => l ? `<span class="chip lv ${esc(l)}">${esc(l)}</span>` : '';

  // ---------- Các khối hiển thị ----------
  function timeline(b) {
    const X = v => 40 + v * 6.4; // 0..100 → 40..680
    const marks = (b.marks || []).map(m => {
      if (m.kind === 'now') return `<line x1="${X(50)}" y1="22" x2="${X(50)}" y2="98" stroke="var(--again)" stroke-width="2" stroke-dasharray="4 3"/><text x="${X(50)}" y="16" text-anchor="middle" class="tl-now">NOW</text>`;
      if (m.kind === 'point') return `<circle cx="${X(m.at)}" cy="60" r="9" fill="var(--primary)"/><text x="${X(m.at)}" y="90" text-anchor="middle" class="tl-lab">${esc(m.label || '')}</text>`;
      if (m.kind === 'range') return `<rect x="${X(m.from)}" y="50" width="${X(m.to) - X(m.from)}" height="20" rx="10" fill="var(--primary)" opacity=".75"/><text x="${(X(m.from) + X(m.to)) / 2}" y="90" text-anchor="middle" class="tl-lab">${esc(m.label || '')}</text>`;
      if (m.kind === 'arrow') return `<line x1="${X(m.from)}" y1="60" x2="${X(m.to) - 8}" y2="60" stroke="var(--accent)" stroke-width="5" stroke-linecap="round"/><polygon points="${X(m.to)},60 ${X(m.to) - 12},52 ${X(m.to) - 12},68" fill="var(--accent)"/><text x="${(X(m.from) + X(m.to)) / 2}" y="44" text-anchor="middle" class="tl-lab">${esc(m.label || '')}</text>`;
      if (m.kind === 'repeat') { const n = 6, pts = []; for (let i = 0; i < n; i++) pts.push(`<circle cx="${X(m.from + (m.to - m.from) * i / (n - 1))}" cy="60" r="6" fill="var(--hard)"/>`); return pts.join('') + `<text x="${(X(m.from) + X(m.to)) / 2}" y="90" text-anchor="middle" class="tl-lab">${esc(m.label || '')}</text>`; }
      return '';
    }).join('');
    return `<div class="g-visual"><svg viewBox="0 0 720 110" class="timeline" role="img" aria-label="${esc(b.caption || 'Dòng thời gian')}">
      <line x1="30" y1="60" x2="700" y2="60" stroke="var(--line)" stroke-width="4" stroke-linecap="round"/><polygon points="712,60 698,52 698,68" fill="var(--line)"/>
      <text x="40" y="106" class="tl-ax">QUÁ KHỨ</text><text x="680" y="106" text-anchor="end" class="tl-ax">TƯƠNG LAI</text>${marks}</svg>
      ${b.caption ? `<div class="small muted center">${esc(b.caption)}</div>` : ''}</div>`;
  }
  const formula = b => `<div class="g-block"><h3>🧮 Công thức</h3>${b.rows.map(r => `<div class="frow"><div class="flabel">${esc(r.label)}</div>
      <div class="fparts">${r.parts.map(p => `<span class="fp ${esc(p.c || '')}">${esc(p.t)}</span>`).join('<span class="fplus">+</span>')}</div>
      ${r.ex ? `<div class="fex">➜ ${esc(r.ex)} ${sayBtn(r.ex)}</div>` : ''}</div>`).join('')}
      <div class="tiny muted" style="margin-top:.4rem"><span class="fp subj">Chủ ngữ</span> <span class="fp aux">Trợ động từ</span> <span class="fp verb">Động từ</span> <span class="fp neg">Phủ định</span> <span class="fp obj">Tân ngữ</span> <span class="fp time">Thời gian</span></div></div>`;
  const uses = b => `<div class="g-block"><h3>🎯 Khi nào dùng?</h3><div class="uses">${b.items.map((u, i) => `<div class="use"><span class="unum">${i + 1}</span><div><b>${esc(u.title)}</b><div>${esc(u.ex)} ${sayBtn(u.ex)}</div><div class="muted small">${esc(u.vi || '')}</div></div></div>`).join('')}</div></div>`;
  const signals = b => `<div class="g-block"><h3>🚦 Dấu hiệu nhận biết</h3><div class="row">${b.words.map(w => `<span class="chip lv">${esc(w)}</span>`).join('')}</div></div>`;
  const table = b => `<div class="g-block" style="overflow-x:auto"><table class="gtable"><thead><tr>${b.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${b.rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const tip = b => `<div class="g-tip">💡 ${esc(b.text)}</div>`;
  const mistake = b => `<div class="g-mistake"><div><span class="bad">✗</span> <s>${esc(b.wrong)}</s></div><div><span class="good">✓</span> <b>${esc(b.right)}</b> ${sayBtn(b.right)}</div><div class="small muted">${esc(b.why)}</div></div>`;
  const ielts = b => `<div class="g-ielts"><b>🎓 Trong IELTS:</b> ${esc(b.text)}${b.ex ? `<div class="ex" style="margin-top:.3rem">“${esc(b.ex)}” ${sayBtn(b.ex)}</div>` : ''}</div>`;
  const diagram = b => `<div class="g-visual"><div class="flow">${b.steps.map(s => `<div class="fstep ${esc(s.c || '')}">${esc(s.t)}</div>`).join('')}</div>${b.caption ? `<div class="small muted center">${esc(b.caption)}</div>` : ''}</div>`;
  const scale = b => `<div class="g-visual"><div class="scale">${b.items.slice().sort((x, y) => y.v - x.v).map(i => `<div class="srow"><b>${esc(i.t)}</b><div class="sbar"><i style="width:${i.v}%;background:hsl(${i.v * 1.2},70%,48%)"></i></div><span class="tiny muted">${i.v}%</span></div>`).join('')}</div>${b.caption ? `<div class="small muted center">${esc(b.caption)}</div>` : ''}</div>`;
  const sort = b => `<div class="g-visual"><div class="grid g2">${b.groups.map(gr => `<div class="sortbox"><div style="font-size:1.6rem">${gr.emoji || ''}</div><b>${esc(gr.title)}</b><div class="row center" style="margin-top:.4rem">${gr.items.map(x => `<span class="chip">${esc(x)}</span>`).join('')}</div></div>`).join('')}</div>${b.caption ? `<div class="small muted center">${esc(b.caption)}</div>` : ''}</div>`;
  const R = { timeline, formula, uses, signals, table, tip, mistake, ielts, diagram, scale, sort };

  function lesson(id) {
    const all = L();
    const i = all.findIndex(x => x.id === id);
    const x = all[i];
    if (!x) return routes.grammar();
    const unit = UNITS.find(u => u.id === x.unit) || UNITS[0];
    const prev = all[i - 1], next = all[i + 1];
    view.innerHTML = `
      <a href="#/grammar" class="small">← Ngữ pháp</a>
      <div class="card hero-main" style="margin:.7rem 0 1rem;background:linear-gradient(135deg, ${unit.color}, #1e1b4b 160%)">
        <div class="row nowrap"><div style="font-size:3rem">${x.emoji}</div><div><div class="muted small">${esc(unit.name)} · ${esc(x.level)}</div>
          <h1 style="margin:0;color:#fff">${esc(x.title)}</h1><div style="opacity:.9;font-weight:700">${esc(x.en)}</div></div></div>
        <p style="margin:.6rem 0 0;opacity:.95">${esc(x.summary)}</p>
      </div>
      <div class="stack" id="gBody">${x.blocks.map(b => (R[b.type] || (() => ''))(b)).join('')}</div>
      <div class="card" style="margin-top:1rem" id="gQuiz">
        <h2>✏️ Luyện tập (${x.quiz.length} câu)</h2>
        ${x.quiz.map((q, k) => `<div class="q-item" data-q="${k}"><b>${k + 1}. ${esc(q.q)}</b><div class="opts">${q.options.map((o, j) => `<button data-v="${j}">${esc(o)}</button>`).join('')}</div><div class="small" data-explain hidden style="margin-top:.4rem"></div></div>`).join('')}
        <div id="gRes" style="margin-top:1rem"></div>
      </div>
      <div class="row between" style="margin-top:1rem">${prev ? `<a class="btn" href="#/grammar/${prev.id}">← ${esc(prev.title)}</a>` : '<span></span>'}${next ? `<a class="btn primary" href="#/grammar/${next.id}">${esc(next.title)} →</a>` : '<a class="btn primary" href="#/grammar">Hoàn thành chủ điểm 🎉</a>'}</div>`;
    App.bindCommon();
    // Chấm ngay từng câu (như Duolingo), cộng điểm khi xong
    let answered = 0, right = 0;
    $$('#gQuiz .q-item').forEach(item => $$('.opts button', item).forEach(btn => btn.onclick = async () => {
      if (item.dataset.locked) return;
      item.dataset.locked = 1;
      const q = x.quiz[+item.dataset.q];
      const ok = +btn.dataset.v === q.answer;
      answered++; if (ok) right++;
      $$('.opts button', item).forEach(b2 => { if (+b2.dataset.v === q.answer) b2.classList.add('right'); });
      if (!ok) btn.classList.add('wrong');
      ok ? Sfx.correct() : Sfx.wrong();
      if (!ok && App.logMistake) App.logMistake({ kind: 'grammar', q: q.q, answer: q.options[q.answer], given: q.options[+btn.dataset.v], explain: q.explain, ref: x.id });
      const ex = $('[data-explain]', item); ex.hidden = false; ex.innerHTML = `${ok ? '✅' : '❌'} ${esc(q.explain)}`;
      if (answered === x.quiz.length) {
        const pct = Math.round(right / x.quiz.length * 100);
        await App.reward({ quizzes: 1, perfect: pct === 100 ? 1 : 0, xp: 10 + right * 3 }, $('#gRes'));
        state.game = await Game.mutate(gs => { gs.grammarDone = { ...(gs.grammarDone || {}), [x.id]: Math.max(pct, (gs.grammarDone || {})[x.id] || 0) }; });
        if (pct >= 80) { Sfx.win(); confetti(); }
        $('#gRes').innerHTML = `<div class="feedback ${pct >= 80 ? 'ok' : 'no'}" style="position:static"><b>${right}/${x.quiz.length} câu đúng (${pct}%)</b> · +${10 + right * 3} XP
          ${pct < 80 ? '<div class="small">Xem lại phần công thức và lỗi hay gặp rồi làm lại nhé.</div>' : ''}
          <div class="row" style="margin-top:.6rem"><button class="btn sm" id="gAgain">↺ Làm lại</button>${next ? `<a class="btn sm primary" href="#/grammar/${next.id}">Bài tiếp theo →</a>` : ''}</div></div>`;
        $('#gAgain').onclick = () => lesson(id);
      }
    }));
  }
})();
