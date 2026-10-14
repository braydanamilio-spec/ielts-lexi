/* Học thích ứng (kiểu Mochi IELTS): kiểm tra đầu vào, kế hoạch hôm nay theo điểm yếu, sổ lỗi sai, tài nguyên miễn phí chính thống. */
(function () {
  const { $, $$, esc, shuffle, toast, ring } = UI;
  const { Store, Golden, SRS, todayKey } = Core;
  const App = window.App;
  const { state, routes } = App;
  const view = App.view;

  // ================= SỔ LỖI SAI =================
  // App.logMistake({ kind: 'vocab'|'grammar'|'reading', q, answer, given, explain, ref })
  let mLock = Promise.resolve();
  App.logMistake = m => (mLock = mLock.then(async () => {
    const list = await Store.get('mistakes', []);
    const key = m.kind + '|' + m.q;
    const old = list.find(x => x.key === key);
    if (old) { old.n = (old.n || 1) + 1; old.at = Date.now(); old.fixed = false; }
    else list.unshift({ ...m, key, n: 1, at: Date.now(), fixed: false });
    await Store.set('mistakes', list.slice(0, 300));
  }));
  const KIND = { vocab: ['🔤', 'Từ vựng'], grammar: ['📐', 'Ngữ pháp'], reading: ['📖', 'Đọc hiểu'] };

  routes.mistakes = async function () {
    const list = await Store.get('mistakes', []);
    const open = list.filter(x => !x.fixed);
    view.innerHTML = `
      <div class="page-head"><div><h1>📕 Sổ lỗi sai</h1><p class="muted">Mọi câu bạn làm sai đều được ghi lại tự động. Ôn lại lỗi sai là cách tăng điểm nhanh nhất – xem lại vì sao sai rồi đánh dấu “Đã hiểu”.</p></div>
        <div class="row">${open.length ? `<a class="btn primary" href="#/practice/learn?src=forgetting">🧠 Ôn từ sắp quên</a>` : ''}<button class="btn sm" id="clearFixed">Dọn lỗi đã sửa</button></div></div>
      <div class="tabs" style="display:inline-flex;margin-bottom:1rem" id="mTabs"><button class="on" data-k="">Tất cả (${open.length})</button>${Object.entries(KIND).map(([k, [e, n]]) => `<button data-k="${k}">${e} ${n} (${open.filter(x => x.kind === k).length})</button>`).join('')}</div>
      <div id="mList"></div>`;
    const draw = k => {
      const rows = open.filter(x => !k || x.kind === k);
      $('#mList').innerHTML = rows.length ? rows.map((x, i) => `<div class="card" style="margin-bottom:.7rem">
        <div class="row between"><span class="chip">${KIND[x.kind] ? KIND[x.kind][0] + ' ' + KIND[x.kind][1] : x.kind}</span><span class="tiny muted">sai ${x.n} lần · ${new Date(x.at).toLocaleDateString('vi-VN')}</span></div>
        <div style="margin-top:.4rem;font-weight:600">${esc(x.q)}</div>
        ${x.given ? `<div class="small" style="margin-top:.3rem"><span style="color:var(--again)">✗ ${esc(x.given)}</span></div>` : ''}
        <div class="small"><span style="color:var(--good)">✓ ${esc(x.answer)}</span></div>
        ${x.explain ? `<div class="small muted" style="margin-top:.3rem">💡 ${esc(x.explain)}</div>` : ''}
        <div class="row" style="margin-top:.6rem"><button class="btn sm" data-fix="${esc(x.key)}">✓ Đã hiểu</button>
          ${x.kind === 'grammar' && x.ref ? `<a class="btn sm ghost" href="#/grammar/${esc(x.ref)}">📐 Xem lại bài</a>` : ''}
          ${x.kind === 'vocab' && x.ref ? `<a class="btn sm ghost" href="#/dict/${encodeURIComponent(x.ref)}">🔎 Tra lại từ</a>${App.inDeck(x.ref) ? '' : `<button class="btn sm ghost" data-add-seed="${esc(x.ref)}">+ Flashcard</button>`}` : ''}
          ${x.kind === 'reading' && x.ref ? `<a class="btn sm ghost" href="#/read/${esc(x.ref)}">📖 Đọc lại bài</a>` : ''}</div></div>`).join('')
        : '<div class="card empty"><div class="em">🎉</div>Không có lỗi sai nào cần xem lại.</div>';
      App.bindCommon();
      $$('[data-fix]').forEach(b => b.onclick = async () => {
        const all = await Store.get('mistakes', []); const it = all.find(x => x.key === b.dataset.fix); if (it) it.fixed = true;
        await Store.set('mistakes', all); App.reward({ xp: 2 }, b); b.closest('.card').remove();
      });
    };
    draw('');
    $$('#mTabs button').forEach(b => b.onclick = () => { $$('#mTabs button').forEach(x => x.classList.toggle('on', x === b)); draw(b.dataset.k); });
    $('#clearFixed').onclick = async () => { await Store.set('mistakes', (await Store.get('mistakes', [])).filter(x => !x.fixed)); toast('Đã dọn'); };
  };

  // ================= KIỂM TRA ĐẦU VÀO =================
  routes.placement = function () {
    const lib = IELTS_DATA.TOPICS.filter(t => t.group === 'topics' || t.group === 'awl').flatMap(t => t.words).filter(w => w.vi && w.level);
    const pickW = (lv, n) => shuffle(lib.filter(w => w.level === lv)).slice(0, n).map(w => ({ kind: 'vocab', lv, w }));
    const G = (window.GRAMMAR || []);
    const pickG = (lv, n) => shuffle(G.filter(l => l.level === lv)).slice(0, n).map(l => ({ kind: 'grammar', lv, l, q: l.quiz[Math.floor(Math.random() * l.quiz.length)] }));
    const qs = shuffle([...pickW('B1', 3), ...pickW('B2', 4), ...pickW('C1', 3), ...pickG('A2', 2), ...pickG('B1', 4), ...pickG('B2', 3), ...pickG('C1', 1)]);
    const W = { A2: 1, B1: 1.5, B2: 2, C1: 2.6, C2: 3 };
    let i = 0, got = 0, max = 0;
    const res = { vocab: [0, 0], grammar: [0, 0] };
    const next = () => {
      if (i >= qs.length) return finish();
      const q = qs[i];
      let opts, prompt, correct;
      if (q.kind === 'vocab') {
        const others = shuffle(lib.filter(x => x.word !== q.w.word && x.vi !== q.w.vi)).slice(0, 3);
        opts = shuffle([q.w, ...others]).map(x => x.vi); correct = opts.indexOf(q.w.vi);
        prompt = `<div class="tiny muted">TỪ VỰNG · ${q.lv}</div><div class="entry-word" style="margin:.3rem 0">${esc(q.w.word)}</div><div class="muted">Chọn nghĩa đúng</div>`;
      } else {
        opts = q.q.options; correct = q.q.answer;
        prompt = `<div class="tiny muted">NGỮ PHÁP · ${q.lv}</div><div style="font-size:1.15rem;font-weight:700;margin-top:.4rem">${esc(q.q.q)}</div>`;
      }
      view.innerHTML = `<div class="study-wrap"><div class="study-top"><a class="icon-btn" href="#/home">✕</a><div class="progress"><i style="width:${i / qs.length * 100}%"></i></div><span class="small muted">${i + 1}/${qs.length}</span></div>
        <div class="card q-card">${prompt}</div>
        <div class="options">${opts.map((o, k) => `<button class="option" data-k="${k}"><span class="kbd">${k + 1}</span>${esc(o)}</button>`).join('')}<button class="option" data-k="-1" style="color:var(--muted)">🤷 Tôi không biết</button></div></div>`;
      $$('.option').forEach(b => b.onclick = () => {
        const ok = +b.dataset.k === correct;
        const w = W[q.lv] || 1.5;
        max += w; if (ok) got += w;
        res[q.kind][1]++; if (ok) res[q.kind][0]++;
        i++; next();
      });
    };
    const finish = async () => {
      const pct = Math.round(got / Math.max(1, max) * 100);
      const band = pct >= 88 ? '7.5+' : pct >= 75 ? '7.0' : pct >= 62 ? '6.5' : pct >= 50 ? '6.0' : pct >= 38 ? '5.5' : pct >= 25 ? '5.0' : '4.5';
      const stage = pct >= 75 ? 's3' : pct >= 50 ? 's2' : pct >= 30 ? 's1' : 's0';
      const vp = Math.round(res.vocab[0] / Math.max(1, res.vocab[1]) * 100), gp = Math.round(res.grammar[0] / Math.max(1, res.grammar[1]) * 100);
      state.settings.placement = { band, pct, vocab: vp, grammar: gp, stage, at: Date.now() };
      await App.saveSettings();
      App.reward({ quizzes: 1, xp: 20 }); Sfx.win(); confetti();
      const weak = vp < gp ? 'từ vựng' : 'ngữ pháp';
      view.innerHTML = `<div class="study-wrap"><div class="card celebrate empty">
        <div class="em">🎯</div><h2>Trình độ ước tính: Band ${band}</h2>
        <div class="row center" style="gap:2rem;margin:1rem 0">${ring(vp, vp + '%', 'var(--primary)')}<div class="small">Từ vựng</div>${ring(gp, gp + '%', 'var(--accent)')}<div class="small">Ngữ pháp</div></div>
        <p>Điểm cần ưu tiên: <b>${weak}</b>. Kế hoạch hôm nay trên trang chủ đã được điều chỉnh theo kết quả này.</p>
        <p class="small muted">Gợi ý bắt đầu lộ trình từ <b>${{ s0: 'Chặng 0 · Từ cốt lõi', s1: 'Chặng 1 · Nền tảng', s2: 'Chặng 2 · Mở rộng chủ đề', s3: 'Chặng 3 · Học thuật' }[stage]}</b>. Kết quả chỉ để tham khảo, không thay thế bài thi thật.</p>
        <div class="row center"><a class="btn primary" href="#/home">Xem kế hoạch hôm nay →</a><a class="btn" href="#/path">🗺️ Lộ trình</a></div></div></div>`;
    };
    view.innerHTML = `<div class="study-wrap"><div class="card celebrate empty"><div class="em">🧭</div><h2>Kiểm tra đầu vào (5 phút)</h2>
      <p>20 câu từ vựng và ngữ pháp từ A2 đến C1. Vocaband dùng kết quả để <b>ước tính band</b>, tìm <b>điểm yếu</b> và cá nhân hóa kế hoạch học mỗi ngày.</p>
      <p class="small muted">Không biết thì chọn “Tôi không biết” – đừng đoán, kết quả sẽ chính xác hơn.</p>
      <button class="btn primary lg" id="go">Bắt đầu →</button></div></div>`;
    $('#go').onclick = next;
  };

  // ================= KẾ HOẠCH HÔM NAY (thích ứng) =================
  App.todayPlan = async function () {
    const s = state.settings, g = state.game, d = g.days[todayKey()] || {};
    const tasks = [];
    const dueNow = Golden.dueNow(state.cards);
    const doneReviews = (state.stats.days[todayKey()] || 0);
    if (!s.placement) tasks.push({ em: '🧭', t: 'Làm bài kiểm tra đầu vào (5 phút)', sub: 'Để Vocaband cá nhân hóa lộ trình cho bạn', href: '#/placement', done: false });
    if (dueNow || doneReviews) tasks.push({ em: '🔁', t: dueNow ? `Ôn ${dueNow} thẻ đang đến thời điểm vàng` : 'Ôn tập thẻ đến hạn', sub: 'Lặp lại ngắt quãng – ưu tiên số 1', href: '#/review', done: !dueNow && doneReviews > 0 });
    const cur = App.pathCurrent && App.pathCurrent();
    if (cur) tasks.push({ em: cur.topic.emoji, t: `Lộ trình: ${cur.topic.name}`, sub: `${cur.stage.name} · đã học ${Math.round(cur.pct * 100)}%`, href: '#/path', done: false });
    // Ngữ pháp: bài chưa đạt / bài kế tiếp phù hợp trình độ
    const G = window.GRAMMAR || [], gd = g.grammarDone || {};
    const weakG = G.find(l => gd[l.id] != null && gd[l.id] < 80) || G.find(l => gd[l.id] == null && (!s.placement || s.placement.grammar < 70 || l.level !== 'A2'));
    if (weakG) tasks.push({ em: '📐', t: `Ngữ pháp: ${weakG.title}`, sub: gd[weakG.id] != null ? `Lần trước ${gd[weakG.id]}% – làm lại cho chắc` : `Học từng bước + ${weakG.quiz.length} câu luyện tập`, href: `#/grammar/${weakG.id}`, done: (d.quizzes || 0) > 0 && gd[weakG.id] >= 80 });
    // Phát âm
    const PR = window.PRON || [], pd = g.pronDone || {};
    const nextP = PR.find(p => pd[p.id] == null);
    if (nextP) tasks.push({ em: '🔤', t: `Phát âm: ${nextP.title}`, sub: 'Khẩu hình → nghe phân biệt → nói & chấm điểm', href: `#/pron/${encodeURIComponent(nextP.id)}`, done: false });
    // Lỗi sai
    const mistakes = (await Store.get('mistakes', [])).filter(x => !x.fixed).length;
    if (mistakes) tasks.push({ em: '📕', t: `Xem lại ${mistakes} lỗi sai`, sub: 'Sửa lỗi = tăng điểm nhanh nhất', href: '#/mistakes', done: false });
    // Kỹ năng xoay vòng theo ngày: Đọc → Nói → Viết
    const dow = new Date().getDay();
    const essays = await Store.get('essays', []);
    if (dow % 3 === 0) tasks.push({ em: '📖', t: 'Đọc 1 bài IELTS & lưu từ mới', sub: 'Ngữ liệu dễ hiểu – học từ trong ngữ cảnh', href: '#/reading', done: (d.readings || 0) > 0 });
    else if (dow % 3 === 1) tasks.push({ em: '🗣️', t: 'Luyện Speaking 1 câu hỏi', sub: 'Ghi âm, nghe lại, xem phân tích từ vựng', href: '#/speaking', done: (d.spoken || 0) >= 3 });
    else tasks.push({ em: '✍️', t: 'Viết 1 đoạn Task 2', sub: essays.length ? 'Dùng lại từ vựng đã học' : 'Thử Phòng viết lần đầu', href: '#/write', done: essays.some(e => todayKey(new Date(e.at)) === todayKey()) });
    return tasks.slice(0, 6);
  };

  // ================= TÀI NGUYÊN MIỄN PHÍ CHÍNH THỐNG =================
  const RES = [
    ['📝', 'Đề mẫu chính thức IELTS', 'ielts.org – Sample test questions', 'https://ielts.org/take-a-test/preparation-resources/sample-test-questions', 'Đề mẫu cả 4 kỹ năng từ đơn vị tổ chức thi – dùng để làm quen dạng bài thật.'],
    ['🖥️', 'Làm quen thi trên máy tính', 'British Council – Computer-delivered IELTS', 'https://www.britishcouncil.vn/thi/ielts/chuan-bi', 'Bài làm quen giao diện thi trên máy (Familiarisation test) và tài liệu ôn miễn phí của Hội đồng Anh.'],
    ['🎓', 'IDP IELTS Prepare', 'ielts.idp.com/prepare', 'https://ielts.idp.com/prepare', 'Bài luyện, mẹo và video miễn phí từ IDP.'],
    ['📚', 'LearnEnglish (British Council)', 'learnenglish.britishcouncil.org', 'https://learnenglish.britishcouncil.org/', 'Bài đọc, nghe, ngữ pháp theo trình độ A1–C1 – có bài tập tương tác.'],
    ['📻', 'BBC Learning English', 'bbc.co.uk/learningenglish', 'https://www.bbc.co.uk/learningenglish/', '“6 Minute English”, tin tức chậm – tuyệt vời để “tắm ngôn ngữ” mỗi ngày.'],
    ['🎬', 'TED & TED-Ed', 'ted.com', 'https://www.ted.com/talks', 'Bài nói chủ đề học thuật có phụ đề – bật add-on Vocaband trên YouTube để tra từ trong phụ đề.'],
    ['🗽', 'VOA Learning English', 'learningenglish.voanews.com', 'https://learningenglish.voanews.com/', 'Tin tức đọc chậm, rõ (giọng Mỹ) kèm bản chữ.'],
    ['🔊', 'YouGlish', 'youglish.com', 'https://youglish.com/', 'Nghe một từ được người bản xứ phát âm trong hàng nghìn video thật.'],
    ['✍️', 'Write & Improve', 'Cambridge English', 'https://writeandimprove.com/', 'Nộp đoạn viết để nhận phản hồi tự động miễn phí (cấp độ CEFR).'],
    ['📖', 'Oxford Learner’s Dictionaries', 'oxfordlearnersdictionaries.com', 'https://www.oxfordlearnersdictionaries.com/', 'Từ điển cho người học – tra thêm ví dụ, collocation; add-on Vocaband hoạt động ngay trên trang này.'],
  ];
  routes.resources = function () {
    view.innerHTML = `
      <div class="page-head"><div><h1>🌐 Tài nguyên miễn phí chính thống</h1><p class="muted">Đã chọn lọc từ các nguồn uy tín, hợp pháp. Mẹo: mở trang và dùng add-on Vocaband để <b>bấm đúp tra từ, bôi đen dịch câu</b> – mọi từ mới tự vào thư viện “Từ trang web”.</p></div></div>
      <div class="grid auto">${RES.map(([em, t, sub, url, d]) => `<a class="card hover topic-card" href="${url}" target="_blank" rel="noopener" style="color:var(--text)">
        <span class="em">${em}</span><h3>${esc(t)}</h3><div class="tiny muted" style="font-weight:700">${esc(sub)} ↗</div><div class="muted small">${esc(d)}</div></a>`).join('')}</div>
      <div class="card" style="margin-top:1rem"><h3>📅 Thói quen “tắm ngôn ngữ” 20 phút/ngày</h3>
        <ol style="padding-left:1.2rem;line-height:1.9"><li>Nghe 1 bài BBC 6 Minute English hoặc 1 video TED có phụ đề – tra từ trong phụ đề bằng add-on.</li>
        <li>Đọc 1 bài trong Vocaband hoặc LearnEnglish – lưu 3–5 từ kèm câu gốc.</li><li>Ôn flashcard đúng thời điểm vàng.</li><li>Nói lại nội dung vừa nghe/đọc trong 1 phút ở Phòng Speaking.</li></ol></div>`;
  };
})();
