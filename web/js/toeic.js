/* Luyện thi TOEIC Listening & Reading: từ vựng TSL (1.250 từ), luyện từng Part, thi thử có quy đổi điểm 10–990 (ước tính).
 * Dùng chung trình phát nhiều giọng (listening.js) và bộ câu hỏi (qengine.js). Đề tự biên soạn. */
(function () {
  const { $, $$, esc, toast } = UI;
  const App = window.App;
  const { state, routes } = App;
  const view = App.view;
  const T = () => window.TOEIC || { reading: [], listening: [] };
  const L_PART = { 1: t('Mô tả tranh'), 2: t('Hỏi – đáp'), 3: t('Hội thoại'), 4: t('Bài nói ngắn') };
  const R_PART = { 5: t('Hoàn thành câu'), 6: t('Hoàn thành đoạn văn'), 7: t('Đọc hiểu') };
  // Đánh dấu dữ liệu TOEIC để trang Luyện nghe hiển thị đúng tên Part
  T().listening.forEach(p => { p.exam = 'toeic'; });
  // Xoay vị trí đáp án 4 lựa chọn theo mẫu cố định → A/B/C/D phân bố đều (chấm theo chỉ số nên vẫn đúng)
  const PAT = [2, 0, 3, 1, 3, 2, 0, 1, 1, 3, 0, 2];
  T().listening.forEach(p => p.groups.forEach(g => g.type === 'mcq' && !g._rot && (g._rot = 1) && g.items.forEach(it => {
    if (it.options.length !== 4) return;
    const want = PAT[it.n % PAT.length], r = (it.a - want + 4) % 4; if (!r) return;
    it.options = it.options.slice(r).concat(it.options.slice(0, r)); it.a = want;
  })));
  // Quy đổi % đúng → điểm thang 5–495 mỗi phần (ước tính tuyến tính có hiệu chỉnh nhẹ; không phải bảng chính thức)
  const scaled = pct => Math.max(5, Math.min(495, Math.round((5 + 490 * Math.pow(pct, 1.08)) / 5) * 5));
  const words = () => IELTS_DATA.TOPICS.filter(t => t.group === 'toeic');

  routes.toeic = function () {
    const g = state.game, best = g.toeicBest || {};
    const ws = words(), learned = ws.reduce((a, t) => a + t.words.filter(w => App.inDeck(w.word)).length, 0), total = ws.reduce((a, t) => a + t.words.length, 0);
    view.innerHTML = `
      <div class="page-head"><div><h1>💼 ${t('Luyện thi TOEIC')}</h1><p class="muted">${t('TOEIC Listening & Reading: từ vựng công sở – kinh doanh, luyện theo từng Part và thi thử có quy đổi điểm. Đề tự biên soạn theo đúng cấu trúc đề thi.')}</p></div></div>
      <div class="grid g2">
        <div class="card hero-main" style="background:linear-gradient(135deg,#0ea5a4,#1e40af)">
          <h2 style="color:#fff;margin:0">🏁 ${t('Thi thử Listening + Reading')}</h2>
          <p style="color:#e0f2fe;margin:.4rem 0 .8rem">${t('Làm trọn bộ câu hỏi, chấm tự động và quy đổi điểm 10–990 (ước tính).')}</p>
          <div class="row">${best.total ? `<span class="chip" style="background:rgba(255,255,255,.2);color:#fff">${t('Cao nhất: {n}/990', { n: best.total })}</span>` : ''}${[...new Set(T().listening.map(p => p.test))].filter(n => T().reading.some(r => r.test === n)).map(n => `<a class="btn" style="background:#fff;color:#0f172a" href="#/toeic-test/${n}">${t('Thi thử Test {n}', { n })}</a>`).join('')}</div>
        </div>
        <div class="card">
          <h3 style="margin-top:0">📚 ${t('Từ vựng TOEIC (TSL)')}</h3>
          <div class="progress"><i style="width:${total ? learned / total * 100 : 0}%"></i></div>
          <div class="small muted" style="margin:.3rem 0 .6rem">${t('{a}/{b} từ đã lưu vào flashcard', { a: learned, b: total || 1250 })}</div>
          <div class="row"><a class="btn sm primary" href="#/practice/learn?src=topic:${ws[0] ? ws[0].id : 'toeic1'}">🧠 ${t('Học thông minh')}</a><a class="btn sm" href="#/library?g=toeic">${t('Xem 10 bộ từ')}</a></div>
          <div class="tiny muted" style="margin-top:.5rem">${t('Nguồn:')} TOEIC Service List 1.2 © Browne & Culligan, CC BY-SA 4.0.</div>
        </div>
      </div>
      <h2 style="margin-top:1.4rem">🎧 Listening</h2>
      <div class="grid auto">${T().listening.map(p => `<div class="card"><span class="chip">Part ${p.part} · ${L_PART[p.part] || ''}</span><h3 style="margin:.5rem 0 .2rem">Test ${p.test} · ${esc(p.title)}</h3><div class="small muted">${App.listening ? t('{n} câu', { n: App.listening.qNums(p).length }) : ''}</div>
        <div class="row" style="margin-top:.6rem"><a class="btn sm primary" href="#/listen/${p.id}">🎯 ${t('Luyện tập')}</a><a class="btn sm" href="#/listen/${p.id}?mode=exam">⏱ ${t('Nghe 1 lần')}</a><a class="btn sm ghost" href="#/dictation/${p.id}">⌨️ ${t('Chép chính tả')}</a></div></div>`).join('') || `<div class="card muted">${t('Đang cập nhật.')}</div>`}</div>
      <h2 style="margin-top:1.4rem">📖 Reading</h2>
      <div class="grid auto">${T().reading.flatMap(rt => rt.parts.map(pt => `<div class="card"><span class="chip">Part ${pt.part} · ${R_PART[pt.part] || ''}</span><h3 style="margin:.5rem 0 .2rem">Test ${rt.test} · ${esc(pt.title)}</h3><div class="small muted">${t('{n} câu', { n: countPart(pt) })}</div>
        <div class="row" style="margin-top:.6rem"><a class="btn sm primary" href="#/toeic-r/${rt.id}?part=${pt.part}">🎯 ${t('Luyện Part {n}', { n: pt.part })}</a></div></div>`)).join('') || `<div class="card muted">${t('Đang cập nhật.')}</div>`}</div>
      <div class="card" style="margin-top:1.2rem"><h3 style="margin-top:0">💡 ${t('Chiến lược TOEIC')}</h3><ul class="small" style="line-height:1.8;padding-left:1.1rem">
        <li>${t('<b>Part 2:</b> nghe kỹ từ để hỏi (When/Where/Who…); cẩn thận đáp án lặp lại âm giống câu hỏi – thường là bẫy.')}</li>
        <li>${t('<b>Part 3–4:</b> đọc trước câu hỏi trong lúc nghe hướng dẫn; đáp án xuất hiện theo thứ tự câu hỏi.')}</li>
        <li>${t('<b>Part 5:</b> nhìn loại từ cần điền trước (danh/động/tính/trạng từ) – nhiều câu làm được trong 10 giây.')}</li>
        <li>${t('<b>Part 7:</b> đọc câu hỏi trước, dò từ khóa; bài kép thường có 1–2 câu cần nối thông tin 2 văn bản.')}</li></ul></div>`;
  };
  const countPart = pt => (pt.groups ? [pt] : pt.passages || []).reduce((a, x) => a + (x.groups || []).reduce((b, g) => b + g.items.length, 0), 0);

  // Hiện giải thích sau khi nộp
  const explainMark = (root, groups) => groups.forEach(g => g.items.forEach(it => { const el = $(`[data-item="${it.n}"] .lq-fb`, root); if (el && it.explain) el.insertAdjacentHTML('beforeend', `<div class="tiny muted" style="margin-top:.2rem">💡 ${esc(it.explain)}</div>`); }));
  const unitsOf = pt => pt.groups ? [{ title: '', text: '', groups: pt.groups }] : pt.passages;
  const unitHtml = (u, k) => `<div class="card toeic-u" data-u="${k}">${u.text ? `<div class="toeic-pass"><b>${esc(u.title || '')}</b><div style="white-space:pre-wrap;margin-top:.4rem">${esc(u.text)}</div></div>` : ''}<div class="toeic-q">${QE.questionsHtml({ groups: u.groups })}</div></div>`;

  // ---------- Luyện Reading theo Part ----------
  routes['toeic-r'] = function (id, query) {
    const tst = T().reading.find(x => x.id === id);
    if (!tst) return routes.toeic();
    const part = +(query.get('part') || 5), pt = tst.parts.find(x => x.part === part);
    if (!pt) return routes.toeic();
    const units = unitsOf(pt);
    view.innerHTML = `<a href="#/toeic" class="small">← TOEIC</a>
      <div class="page-head" style="margin-top:.4rem"><div><div class="tiny muted">${esc(tst.title)} · Part ${part}</div><h1 style="margin:.2rem 0">${esc(pt.title)}</h1><p class="muted small">${esc(pt.instr || '')}</p></div></div>
      <div id="tq">${units.map(unitHtml).join('')}</div>
      <div class="row" style="margin-top:1rem"><button class="btn primary" id="tSub">✅ ${t('Nộp bài & xem giải thích')}</button><div class="row" style="margin-left:auto">${tst.parts.map(x => `<a class="btn sm ${x.part === part ? 'primary' : ''}" href="#/toeic-r/${tst.id}?part=${x.part}">Part ${x.part}</a>`).join('')}</div></div>
      <div id="tRes" style="margin-top:1rem"></div>`;
    QE.bind($('#tq'));
    $('#tSub').onclick = async () => {
      let right = 0, total = 0;
      units.forEach((u, k) => {
        const root = $(`.toeic-u[data-u="${k}"]`), p = { groups: u.groups }, res = QE.collect(p, root);
        QE.mark(root, res); explainMark(root, u.groups);
        Object.entries(res).forEach(([n, r]) => { total++; if (r.ok) right++; else if (App.logMistake) App.logMistake({ kind: 'reading', q: `TOEIC ${n}: ${r.q || ''}`, answer: r.answer, given: r.given || t('(bỏ trống)'), explain: (u.groups.flatMap(g => g.items).find(i => i.n === +n) || {}).explain || '', ref: '' }); });
      });
      $('#tSub').disabled = true;
      await App.reward({ quizzes: 1, readings: 1, xp: 10 + right * 2 });
      $('#tRes').innerHTML = `<div class="feedback ${right / total >= 0.7 ? 'ok' : 'no'}" style="position:static"><b>${t('{a}/{b} câu đúng', { a: right, b: total })} (${Math.round(right / total * 100)}%)</b> · ${t('câu sai đã vào Sổ lỗi sai')}</div>`;
      $('#tRes').scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
  };

  // ---------- Thi thử: Listening (Part 2–4, nghe 1 lần) → Reading (Part 5–7, bấm giờ) ----------
  routes['toeic-test'] = function (n) {
    n = +n || 1;
    const LP = T().listening.filter(p => p.test === n).sort((a, b) => a.part - b.part), RT = T().reading.find(x => x.test === n);
    if (!LP.length || !RT) return routes.toeic();
    const res = { L: {}, R: {} };
    let player = null, timer = null;
    document.body.classList.add('bare');
    window.onbeforeunload = () => t('Bạn đang làm bài thi – rời trang sẽ mất kết quả.');
    App.cleanup = () => { if (player) player.stop(); clearInterval(timer); document.body.classList.remove('bare'); window.onbeforeunload = null; };
    const bar = (title, right = '') => `<div class="mk-bar"><div class="row nowrap"><b>💼 TOEIC Mock · Test ${n}</b><span class="chip">${esc(title)}</span></div><div class="row nowrap">${right}<a class="btn sm ghost" href="#/toeic" onclick="return confirm(${esc(JSON.stringify(t('Thoát bài thi?')))})">${t('Thoát')}</a></div></div>`;
    const lPart = k => {
      const p = LP[k];
      view.innerHTML = `${bar('Listening · Part ' + p.part)}<div class="card lplayer" style="margin-top:1rem"><b id="tState">🔊 ${t('Đang phát – chỉ nghe 1 lần')}</b><span class="lnow small muted" id="lNow"></span></div>
        <div class="card" id="lQs">${QE.questionsHtml(p)}<div class="row" style="margin-top:1rem"><button class="btn primary" id="tNext" disabled>${k < LP.length - 1 ? t('Phần tiếp') + ' →' : t('Sang Reading') + ' →'}</button></div></div>`;
      QE.bind($('#lQs'));
      player = App.listening.Player(p, { onEnd: () => { const s = $('#tState'); if (s) s.textContent = '✓ ' + t('Hết phần nghe'); const b = $('#tNext'); if (b) b.disabled = false; } });
      player.play(0);
      setTimeout(() => { const b = $('#tNext'); if (b) b.disabled = false; }, 30000);
      $('#tNext').onclick = () => { player.stop(); Object.assign(res.L, QE.collect(p, $('#lQs'))); if (k < LP.length - 1) lPart(k + 1); else reading(); window.scrollTo({ top: 0 }); };
    };
    const reading = () => {
      const units = RT.parts.flatMap(pt => unitsOf(pt).map(u => ({ ...u, part: pt.part })));
      const mins = Math.max(20, Math.round(units.reduce((a, u) => a + u.groups.reduce((b, g) => b + g.items.length, 0), 0) * 0.75));
      view.innerHTML = `${bar('Reading', `<span class="mk-clock" id="tClock"></span>`)}<div id="tq" style="margin-top:1rem">${units.map(unitHtml).join('')}</div><div class="row" style="margin-top:1rem"><button class="btn primary" id="tSub">${t('Nộp bài')}</button></div>`;
      QE.bind($('#tq'));
      let left = mins * 60; const tick = () => { left--; const c = $('#tClock'); if (c) { c.textContent = `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`; c.classList.toggle('warn', left < 300); } if (left <= 0) submit(); };
      tick(); timer = setInterval(tick, 1000);
      const submit = () => { clearInterval(timer); units.forEach((u, k) => Object.assign(res.R, QE.collect({ groups: u.groups }, $(`.toeic-u[data-u="${k}"]`)))); finish(); };
      $('#tSub').onclick = () => { if (confirm(t('Nộp bài Reading?'))) submit(); };
    };
    const finish = async () => {
      App.cleanup(); App.cleanup = null;
      const cnt = o => { const v = Object.values(o); return [v.filter(r => r.ok).length, v.length]; };
      const [lr, lt] = cnt(res.L), [rr, rt] = cnt(res.R);
      const ls = scaled(lr / Math.max(1, lt)), rs = scaled(rr / Math.max(1, rt)), total = ls + rs;
      state.game = await Game.mutate(gs => { gs.toeicBest = { total: Math.max(total, (gs.toeicBest || {}).total || 0), at: Date.now() }; gs.toeicTests = [...(gs.toeicTests || []), { n, ls, rs, total, at: Date.now() }].slice(-20); });
      await App.reward({ quizzes: 2, listens: LP.length, readings: 1, xp: 40 + lr + rr });
      if (total >= 700) { Sfx.win(); confetti(140); }
      const sheet = o => `<div class="lsheet">${Object.keys(o).map(Number).sort((a, b) => a - b).map(q => `<div class="${o[q].ok ? 'ok' : 'no'}"><b>${q}</b> ${o[q].ok ? '✓' : '✗'} <span>${esc(o[q].answer)}</span></div>`).join('')}</div>`;
      view.innerHTML = `<div class="study-wrap" style="max-width:860px"><div class="card celebrate"><div class="em">💼</div><h2>${t('{n}/990 điểm (ước tính)', { n: total })}</h2>
        <div class="mk-bands" style="grid-template-columns:repeat(2,minmax(0,1fr))"><div><span>🎧</span><b>${ls}</b><small>Listening · ${lr}/${lt}</small></div><div><span>📖</span><b>${rs}</b><small>Reading · ${rr}/${rt}</small></div></div>
        <p class="small muted" style="margin-top:.8rem">${t('Quy đổi tuyến tính trên đề rút gọn tự biên soạn – chỉ để tham khảo, không phải thang điểm chính thức của ETS.')}</p></div>
        <div class="card"><details><summary><b>🎧 ${t('Đáp án Listening')}</b></summary>${sheet(res.L)}</details></div>
        <div class="card"><details><summary><b>📖 ${t('Đáp án Reading')}</b></summary>${sheet(res.R)}</details></div>
        <div class="row center"><a class="btn primary" href="#/toeic">${t('Về TOEIC')}</a><a class="btn" href="#/mistakes">📕 ${t('Sổ lỗi sai')}</a></div></div>`;
    };
    view.innerHTML = `<div class="study-wrap"><div class="card celebrate empty"><div class="em">💼</div><h2>TOEIC Mock Test ${n}</h2><p class="muted">${t('Listening ({parts}) nghe 1 lần → Reading (Part 5–7) có bấm giờ. Đeo tai nghe và chọn nơi yên tĩnh.', { parts: LP.map(p => 'Part ' + p.part).join(', ') })}</p><button class="btn primary lg" id="tGo">${t('Bắt đầu')}</button></div></div>`;
    $('#tGo').onclick = () => lPart(0);
  };
})();
