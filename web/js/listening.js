/* Luyện nghe IELTS: đề tự biên soạn (js/listen/*.js), giọng đọc nhiều người (Anh–Mỹ–Úc) bằng Web Speech,
 * chế độ luyện tập (nghe lại, chỉ chỗ có đáp án) / thi thật (nghe 1 lần), thi trọn 40 câu có quy đổi band, chép chính tả. */
(function () {
  const { $, $$, esc, toast } = UI;
  const App = window.App;
  const { state, routes } = App;
  const view = App.view;
  // Xoay vòng phương án trắc nghiệm theo số câu → đáp án phân bố đều A/B/C (chấm theo chỉ số nên vẫn đúng)
  (window.LISTENING || []).forEach(p => p.groups.forEach(g => g.type === 'mcq' && !g._rot && (g._rot = 1) && g.items.forEach(it => {
    if (it.options.length !== 3) return;
    const want = [0, 2, 1, 1, 0, 2, 2, 1, 0, 1, 2, 0][it.n % 12], r = (it.a - want + 3) % 3; if (!r) return;
    it.options = it.options.slice(r).concat(it.options.slice(0, r)); it.a = (it.a - r + 3) % 3;
  })));
  const ALL = () => window.LISTENING || [];
  const byId = id => ALL().find(p => p.id === id);
  const tests = () => [...new Set(ALL().map(p => p.test))].sort((a, b) => a - b);
  const partsOf = n => ALL().filter(p => p.test === n).sort((a, b) => a.part - b.part);
  const PART = { 1: 'Hội thoại đời sống', 2: 'Độc thoại xã hội', 3: 'Thảo luận học thuật', 4: 'Bài giảng học thuật' };
  const ACC = { 'en-GB': '🇬🇧', 'en-US': '🇺🇸', 'en-AU': '🇦🇺' };
  const qNums = p => p.groups.flatMap(g => g.type === 'multi' ? g.n : g.items.map(i => i.n));

  // Quy đổi điểm Listening (thang công bố phổ biến của IELTS, chỉ mang tính tham khảo)
  const BAND = [[39, 9], [37, 8.5], [35, 8], [32, 7.5], [30, 7], [26, 6.5], [23, 6], [18, 5.5], [16, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5], [0, 0]];
  const bandOf = raw => (BAND.find(([m]) => raw >= m) || [0, 0])[1];

  // ================= GIỌNG ĐỌC =================
  const FEMALE = /female|woman|samantha|karen|moira|tessa|serena|kate|susan|martha|fiona|victoria|allison|ava|zira|hazel|libby|sonia|maisie|emma|jenny|aria|natasha|catherine|nicky|joanna|salli|kimberly|ivy|amy|olivia|google uk english female|google us english/i;
  const MALE = /\bmale\b|daniel|alex|fred|oliver|arthur|gordon|\blee\b|aaron|\btom\b|rishi|ryan|guy|george|james|thomas|william|christopher|eric|brian|russell|matthew|joey|justin|google uk english male/i;
  function castVoices(p) {
    const used = new Set(), cast = {};
    const pick = (accent, gender) => {
      const list = UI.voicesFor(accent).length ? UI.voicesFor(accent) : UI.voicesFor('en-GB');
      const want = gender === 'f' ? FEMALE : MALE, avoid = gender === 'f' ? MALE : FEMALE;
      const v = list.find(x => !used.has(x.name) && want.test(x.name) && !(gender === 'f' && /\bmale\b/i.test(x.name) && !/female/i.test(x.name)))
        || list.find(x => !used.has(x.name) && !avoid.test(x.name)) || list.find(x => !used.has(x.name)) || list[0] || null;
      if (v) used.add(v.name);
      // Không đủ giọng khác nhau → đổi cao độ để vẫn phân biệt người nói
      const same = v && Object.values(cast).some(c => c.voice === v);
      return { voice: v, lang: accent, pitch: same ? (gender === 'f' ? 1.2 : 0.8) : (gender === 'f' ? 1.05 : 0.95) };
    };
    Object.entries(p.speakers || {}).forEach(([k, s]) => { cast[k] = pick(s.accent || 'en-GB', s.gender); });
    const gb = UI.voicesFor('en-GB');
    cast._narrator = { voice: gb.find(v => !used.has(v.name)) || gb[0] || null, lang: 'en-GB', pitch: 1 };
    return cast;
  }

  // ================= TRÌNH PHÁT =================
  // Hàng đợi: mỗi phần tử là 1 dòng thoại / lời dẫn / khoảng lặng; onLine(i) để tô sáng transcript
  function Player(p, opts = {}) {
    const cast = castVoices(p);
    const q = p.script.map((l, i) => ({ ...l, i }));
    let pos = 0, playing = false, seq = 0, timer = null;
    const rate = () => opts.rate ? opts.rate() : (state.settings.listenRate || 0.95);
    const stopNow = () => { seq++; clearTimeout(timer); if ('speechSynthesis' in window) speechSynthesis.cancel(); };
    function step(my) {
      if (my !== seq) return;
      if (pos >= q.length) { playing = false; opts.onLine && opts.onLine(-1); opts.onEnd && opts.onEnd(); return; }
      const l = q[pos];
      opts.onLine && opts.onLine(l.i);
      const next = () => { if (my !== seq) return; pos++; step(my); };
      if (l.pause != null) { timer = setTimeout(next, Math.min(8, l.pause) * 1000); return; }
      if (l.say && opts.skipNarrator) { next(); return; }
      const c = l.say ? cast._narrator : (cast[l.s] || cast._narrator);
      const parts = UI.splitSentences(l.say || l.t);
      parts.forEach((t, k) => {
        const u = new SpeechSynthesisUtterance(t);
        u.lang = c.lang; if (c.voice) u.voice = c.voice; u.pitch = c.pitch; u.rate = l.say ? 0.95 : rate();
        if (k === parts.length - 1) u.onend = u.onerror = () => { timer = setTimeout(next, l.say ? 600 : 280); };
        speechSynthesis.speak(u);
      });
    }
    return {
      play(from) { if (!('speechSynthesis' in window)) { toast('Trình duyệt không hỗ trợ đọc giọng nói – hãy dùng Chrome/Edge/Safari'); return; } stopNow(); if (from != null) pos = Math.max(0, q.findIndex(x => x.i === from)); playing = true; opts.onState && opts.onState(true); step(seq); },
      pause() { stopNow(); playing = false; opts.onState && opts.onState(false); },
      stop() { stopNow(); playing = false; pos = 0; opts.onState && opts.onState(false); },
      back() { const was = playing; stopNow(); let k = pos - 1; while (k > 0 && (q[k].pause != null || q[k].say)) k--; pos = Math.max(0, k); if (was) { playing = true; step(seq); } else opts.onLine && opts.onLine(q[pos].i); },
      get playing() { return playing; }, get pos() { return pos; }, cast,
    };
  }

  // ================= CHẤM ĐIỂM =================
  const norm = s => String(s || '').toLowerCase().replace(/[’‘`]/g, "'").replace(/[£$€]/g, '').replace(/(\d),(\d{3})/g, '$1$2').replace(/[.,!?;:"“”()]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^(the|a|an) /, '');
  const words = s => norm(s).split(' ').filter(Boolean).length;
  function gradeGap(it, limit, given) {
    if (!given || !given.trim()) return { ok: false, empty: true };
    const over = limit && words(given) > limit;
    const ok = !over && it.a.some(a => norm(a) === norm(given));
    return { ok, over };
  }
  // Trả về {n: {ok, given, answer, cue, q}} cho mọi câu trong phần
  function collect(p, root) {
    const res = {};
    p.groups.forEach((g, gi) => {
      if (g.type === 'multi') {
        const picked = $$(`[data-multi="${gi}"]:checked`, root).map(x => x.value);
        const correct = picked.filter(x => g.a.includes(x));
        g.n.forEach((n, k) => { res[n] = { ok: k < correct.length, given: picked.join(', '), answer: g.a.join(', '), cue: g.cue, q: g.q }; });
        return;
      }
      g.items.forEach(it => {
        const el = $(`[data-qn="${it.n}"]`, root);
        if (g.type === 'mcq') { const v = $(`input[name="q${it.n}"]:checked`, root); const given = v ? +v.value : null; res[it.n] = { ok: given === it.a, given: given == null ? '' : 'ABC'[given], answer: 'ABC'[it.a] + '. ' + it.options[it.a], cue: it.cue, q: it.q }; }
        else if (g.type === 'match') { const v = el ? el.value : ''; res[it.n] = { ok: v === it.a, given: v, answer: it.a + ' – ' + ((g.options.find(o => o.startsWith(it.a + ' ')) || '').slice(2)), cue: it.cue, q: it.text }; }
        else { const v = el ? el.value.trim() : ''; const r = gradeGap(it, g.limit, v); res[it.n] = { ok: r.ok, over: r.over, given: v, answer: it.a[0], cue: it.cue, q: it.text }; }
      });
    });
    return res;
  }

  // ================= GIAO DIỆN CÂU HỎI =================
  function groupHtml(g, gi) {
    const head = `<div class="lq-instr">${g.title ? `<b>${esc(g.title)}</b><br>` : ''}<i>${esc(g.instr)}</i></div>`;
    if (g.type === 'mcq') return `<div class="lq-group">${head}${g.items.map(it => `<div class="lq-item" data-item="${it.n}"><div><span class="qn">${it.n}</span> ${esc(it.q)}</div>
      <div class="lq-opts">${it.options.map((o, k) => `<label><input type="radio" name="q${it.n}" value="${k}"> <b>${'ABC'[k]}</b> ${esc(o)}</label>`).join('')}</div><div class="lq-fb" hidden></div></div>`).join('')}</div>`;
    if (g.type === 'match') return `<div class="lq-group">${head}<div class="lq-box">${g.options.map(o => `<div>${esc(o)}</div>`).join('')}</div>
      ${g.items.map(it => `<div class="lq-item lq-row" data-item="${it.n}"><span class="qn">${it.n}</span><span style="flex:1">${esc(it.text)}</span><select data-qn="${it.n}"><option value="">–</option>${g.options.map(o => `<option>${esc(o[0])}</option>`).join('')}</select><div class="lq-fb" hidden></div></div>`).join('')}</div>`;
    if (g.type === 'multi') return `<div class="lq-group">${head}<div class="lq-item" data-item="${g.n.join(',')}"><div><span class="qn">${g.n.join('–')}</span> ${esc(g.q)}</div>
      <div class="lq-opts">${g.options.map(o => `<label><input type="checkbox" data-multi="${gi}" value="${esc(o[0])}"> ${esc(o)}</label>`).join('')}</div><div class="lq-fb" hidden></div></div></div>`;
    const cls = g.type === 'table' ? 'lq-table' : 'lq-notes';
    return `<div class="lq-group">${head}<div class="${cls}">${g.items.map(it => `<div class="lq-item lq-gap" data-item="${it.n}">${esc(it.text).replace('___', `<span class="qn">${it.n}</span><input class="gap" data-qn="${it.n}" autocomplete="off" spellcheck="false" size="12">`)}<div class="lq-fb" hidden></div></div>`).join('')}</div></div>`;
  }
  const questionsHtml = p => `<div class="lq">${p.groups.map(groupHtml).join('')}</div>`;

  // Transcript: chạm từ để tra, bấm số câu để nghe lại đoạn có đáp án
  function transcriptHtml(p, showEv) {
    const ev = {};
    if (showEv) p.groups.forEach(g => (g.type === 'multi' ? [{ n: g.n.join('–'), cue: g.cue }] : g.items).forEach(it => { const i = p.script.findIndex(l => l.t && it.cue && l.t.includes(it.cue)); if (i >= 0) (ev[i] = ev[i] || []).push({ n: it.n, cue: it.cue }); }));
    return p.script.map((l, i) => {
      if (l.pause != null) return '';
      if (l.say) return `<div class="tl say" data-line="${i}"><i>${esc(l.say)}</i></div>`;
      const sp = p.speakers[l.s] || { name: l.s };
      let html = Lexis.markSentence(l.t);
      (ev[i] || []).forEach(e => { const k = esc(e.cue); if (html.includes(k)) html = html.replace(k, `<mark class="evi">${k}</mark>`); });
      return `<div class="tl ${ev[i] ? 'has-ev' : ''}" data-line="${i}"><span class="spk">${esc(sp.name)}</span> <span class="sent">${html}</span>${(ev[i] || []).map(e => ` <span class="evn">Câu ${e.n}</span>`).join('')}</div>`;
    }).join('');
  }

  // Popover tra từ trong transcript
  function bindWordPop(box, title) {
    let pop = null;
    const close = () => { if (pop) { pop.remove(); pop = null; } };
    box.addEventListener('click', async e => {
      const t = e.target.closest('.tw'); if (!t) return;
      e.stopPropagation(); close();
      const word = t.dataset.w, sentence = t.closest('.sent').textContent.replace(/\s+/g, ' ').trim();
      pop = document.createElement('div'); pop.className = 'pop'; const mine = pop;
      const br = box.getBoundingClientRect(), er = t.getBoundingClientRect();
      pop.style.left = Math.max(8, Math.min(er.left - br.left - 20, br.width - 340)) + 'px';
      pop.style.top = (er.bottom - br.top + box.scrollTop + 6) + 'px';
      pop.innerHTML = `<div class="muted">⏳ Đang tra “${esc(word)}”…</div>`; box.appendChild(pop);
      const d = (await Dict.quick(word)) || (await Dict.lookup(word, { examples: false, image: false }));
      if (pop !== mine) return;
      if (!d || !d.found) { pop.innerHTML = `<div class="muted">Không tìm thấy “${esc(word)}”.</div>`; return; }
      pop.innerHTML = `<div class="row between nowrap"><b style="font-size:1.15rem">${esc(d.word)}</b><button class="icon-btn sm" data-x>✕</button></div>
        <div class="row"><span class="ipa">${esc(d.ipa || '')}</span><button class="icon-btn sm" data-s>🔊</button></div><div class="vi">${esc(d.vi)}</div>
        <div class="example-box small" style="margin-top:.5rem">📌 ${UI.highlight(sentence, d.word)}</div>
        <div class="row" style="margin-top:.6rem"><button class="btn sm primary" data-save>${App.inDeck(d.word) ? '+ Thêm ngữ cảnh' : '+ Lưu flashcard'}</button></div>`;
      $('[data-x]', pop).onclick = close;
      $('[data-s]', pop).onclick = () => UI.speak(d.word, state.settings.accent, d.audio);
      $('[data-save]', pop).onclick = async ev => { const b = ev.currentTarget; b.disabled = true; const vi = await Dict.translateVi(sentence); await App.addWord(d, { text: sentence, vi, title: '🎧 ' + title }); b.textContent = '✓ Đã lưu kèm ngữ cảnh'; };
    });
    document.addEventListener('mousedown', function off(e) { if (!document.body.contains(box)) return document.removeEventListener('mousedown', off); if (pop && !pop.contains(e.target)) close(); });
  }

  const speakersHtml = p => Object.values(p.speakers || {}).map(s => `<span class="chip">${ACC[s.accent] || ''} ${esc(s.name)}</span>`).join('');
  const rateSel = () => `<select id="lRate" title="Tốc độ">${[0.8, 0.9, 0.95, 1, 1.1].map(r => `<option value="${r}" ${(state.settings.listenRate || 0.95) == r ? 'selected' : ''}>${r === 0.95 ? 'Chuẩn' : r + '×'}</option>`).join('')}</select>`;

  // ================= DANH SÁCH =================
  routes.listening = function () {
    const done = state.game.listenDone || {};
    const best = state.game.listenBest || {};
    view.innerHTML = `
      <div class="page-head"><div><h1>🎧 Luyện nghe IELTS</h1><p class="muted">Đề tự biên soạn theo đúng cấu trúc IELTS Listening (4 phần · 40 câu). Mỗi người nói một giọng riêng – Anh, Mỹ, Úc. Luyện từng phần với nghe lại & chỉ chỗ có đáp án, hoặc thi thật nghe một lần.</p></div></div>
      ${!ALL().length ? '<div class="card empty"><div class="em">🎧</div>Đang cập nhật đề.</div>' : ''}
      ${tests().map(n => `<div class="card" style="margin-bottom:1rem">
        <div class="row between"><h2 style="margin:0">Test ${n}</h2><div class="row">${best[n] != null ? `<span class="chip ok">Band ${best[n]}</span>` : ''}<a class="btn primary" href="#/listen-test/${n}">⏱ Thi thử 40 câu</a></div></div>
        <div class="grid auto" style="margin-top:.8rem">${partsOf(n).map(p => `<div class="card hover" style="box-shadow:none;border:1px solid var(--line)">
          <div class="row between"><span class="chip">Part ${p.part} · ${PART[p.part]}</span>${done[p.id] != null ? `<span class="chip ok">✓ ${done[p.id]}/10</span>` : ''}</div>
          <h3 style="margin:.5rem 0 .2rem">${esc(p.title)}</h3><div class="small muted">${esc(p.titleVi || '')} · ${esc(p.topic || '')}</div>
          <div class="row" style="margin-top:.4rem">${speakersHtml(p)}</div>
          <div class="row" style="margin-top:.7rem"><a class="btn sm primary" href="#/listen/${p.id}">🎯 Luyện tập</a><a class="btn sm" href="#/listen/${p.id}?mode=exam">⏱ Nghe 1 lần</a><a class="btn sm ghost" href="#/dictation/${p.id}">⌨️ Chép chính tả</a></div></div>`).join('')}</div></div>`).join('')}
      <div class="card"><h3>💡 Mẹo làm bài Listening</h3><ul class="small">
        <li><b>Đọc trước câu hỏi</b> trong thời gian chờ: gạch chân từ khóa, đoán loại từ cần điền (số, tên, danh từ…).</li>
        <li><b>Cẩn thận bẫy “đổi ý”</b>: người nói hay nói một đáp án rồi sửa lại (“sorry, I mean…”). Đáp án là thông tin cuối cùng.</li>
        <li><b>Paraphrase</b>: câu hỏi hiếm khi dùng đúng từ trong bài nghe – hãy nghe ý, không chỉ nghe từ.</li>
        <li><b>Giới hạn từ</b>: “ONE WORD AND/OR A NUMBER” mà viết 2 từ là sai cả câu. Chú ý chính tả và số nhiều.</li>
        <li><b>Chép chính tả</b> 10 phút mỗi ngày là cách nhanh nhất để nghe ra từng âm, nối âm và nuốt âm.</li></ul></div>`;
  };

  // ================= 1 PHẦN: LUYỆN TẬP / THI THẬT =================
  routes.listen = function (id, query) {
    const p = byId(id);
    if (!p) return routes.listening();
    const exam = query && query.get('mode') === 'exam';
    let submitted = false, plays = 0;
    view.innerHTML = `
      <div class="row between"><a href="#/listening" class="small">← Luyện nghe</a>${exam ? `<a class="btn sm ghost" href="#/listen/${p.id}">🎯 Chế độ luyện tập</a>` : `<a class="btn sm ghost" href="#/listen/${p.id}?mode=exam">⏱ Chế độ thi thật</a>`}</div>
      <div class="page-head" style="margin-top:.6rem"><div><div class="tiny muted">Test ${p.test} · Part ${p.part} · ${PART[p.part]} · Câu ${qNums(p)[0]}–${qNums(p).slice(-1)[0]}</div><h1 style="margin:.2rem 0">${esc(p.title)}</h1><p class="muted" style="margin:0">${esc(p.context || '')}</p><div class="row" style="margin-top:.4rem">${speakersHtml(p)}</div></div></div>
      <div class="card lplayer" id="lPlayer">
        <button class="btn primary lg" id="lPlay">▶ Nghe</button>
        ${exam ? '<span class="small muted" id="lNote">Chế độ thi thật: chỉ nghe được 1 lần, không tua lại.</span>' : `<button class="btn" id="lBack" title="Nghe lại câu trước">⏪ Câu trước</button>${rateSel()}<label class="small row nowrap" style="gap:.3rem"><input type="checkbox" id="lLive"> Hiện lời thoại khi nghe</label>`}
        <div class="lnow small muted" id="lNow"></div>
      </div>
      <div class="lgrid">
        <div class="card" id="lQs">${questionsHtml(p)}<div class="row" style="margin-top:1rem"><button class="btn primary" id="lSubmit">✅ Nộp bài & xem đáp án</button></div><div id="lRes" style="margin-top:1rem"></div></div>
        <div class="card ltrans" id="lTransWrap" ${exam ? 'hidden' : ''}><div class="row between"><h3 style="margin:0">📜 Lời thoại</h3><span class="tiny muted">Bấm dòng để nghe từ đó · chạm từ để tra</span></div><div id="lTrans" class="ltr blur" data-own-lookup>${transcriptHtml(p, false)}</div></div>
      </div>`;
    App.bindCommon();
    const trans = $('#lTrans');
    const player = Player(p, {
      rate: () => +(($('#lRate') || {}).value || state.settings.listenRate || 0.95),
      onLine: i => {
        $$('.tl.now', trans).forEach(x => x.classList.remove('now'));
        const el = $(`.tl[data-line="${i}"]`, trans);
        if (el) { el.classList.add('now'); if (!trans.classList.contains('blur')) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
        const l = p.script[i]; $('#lNow').textContent = !l ? '' : l.pause != null ? '… (khoảng lặng)' : l.say ? '🎙️ Lời dẫn' : '🗣️ ' + ((p.speakers[l.s] || {}).name || l.s);
      },
      onState: on => { $('#lPlay').textContent = on ? '⏸ Tạm dừng' : (plays ? '▶ Nghe tiếp' : '▶ Nghe'); },
      onEnd: () => { $('#lPlay').textContent = exam ? '✓ Đã nghe xong' : '↺ Nghe lại từ đầu'; if (exam) $('#lPlay').disabled = true; else player.stop(); $('#lNow').textContent = exam && !submitted ? 'Hết bài nghe – kiểm tra lại đáp án rồi nộp bài.' : ''; },
    });
    App.cleanup = () => player.stop();
    $('#lPlay').onclick = () => {
      if (player.playing) { if (exam) return; player.pause(); return; }
      if (exam && plays) return;
      plays++; player.play(exam ? 0 : undefined);
      if (exam) { $('#lPlay').disabled = true; $('#lPlay').textContent = '🔊 Đang phát…'; }
    };
    if (!exam) {
      $('#lBack').onclick = () => player.back();
      $('#lRate').onchange = e => { state.settings.listenRate = +e.target.value; App.saveSettings(); };
      $('#lLive').onchange = e => trans.classList.toggle('blur', !e.target.checked);
      trans.addEventListener('click', e => { if (e.target.closest('.tw') && !trans.classList.contains('blur')) return; const l = e.target.closest('.tl'); if (l && !trans.classList.contains('blur')) { plays++; player.play(+l.dataset.line); } });
    }
    bindWordPop(trans, `Listening: ${p.title}`);
    // Enter → ô kế tiếp
    $$('#lQs input.gap').forEach((inp, k, arr) => inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); (arr[k + 1] || $('#lSubmit')).focus(); } }));

    $('#lSubmit').onclick = async () => {
      if (submitted) return;
      if (player.playing && exam && !confirm('Bài nghe chưa phát xong. Vẫn nộp bài?')) return;
      submitted = true; player.stop();
      const res = collect(p, $('#lQs'));
      const nums = Object.keys(res).map(Number).sort((a, b) => a - b);
      const right = nums.filter(n => res[n].ok).length;
      // Đánh dấu từng câu
      $$('#lQs .lq-item').forEach(item => {
        const ns = item.dataset.item.split(',').map(Number), r = res[ns[0]]; if (!r) return;
        const ok = ns.every(n => res[n].ok), part = ns.some(n => res[n].ok);
        item.classList.add(ok ? 'ok' : part ? 'half' : 'no');
        const fb = $('.lq-fb', item); fb.hidden = false;
        fb.innerHTML = `${ok ? '✅' : '❌'} Đáp án: <b>${esc(r.answer)}</b>${r.over ? ' <span class="tiny">(vượt quá số từ cho phép)</span>' : ''} ${r.cue ? `<button class="btn sm ghost" data-hear="${ns[0]}">🔎 Nghe đoạn có đáp án</button>` : ''}`;
        $$('input, select', item).forEach(x => x.disabled = true);
      });
      nums.filter(n => !res[n].ok).forEach(n => App.logMistake && App.logMistake({ kind: 'listening', q: `${p.title} – Câu ${n}: ${res[n].q}`, answer: res[n].answer, given: res[n].given || '(bỏ trống)', explain: res[n].cue ? `Nghe: “…${res[n].cue}…”` : '', ref: p.id }));
      state.game = await Game.mutate(gs => { gs.listenDone = { ...(gs.listenDone || {}), [p.id]: Math.max(right, (gs.listenDone || {})[p.id] || 0) }; });
      await App.reward({ quizzes: 1, perfect: right === nums.length ? 1 : 0, xp: 15 + right * 3 }, $('#lRes'));
      if (right >= 8) { Sfx.win(); confetti(); }
      $('#lRes').innerHTML = `<div class="feedback ${right >= 7 ? 'ok' : 'no'}" style="position:static"><b>${right}/${nums.length} câu đúng</b> · +${15 + right * 3} XP
        <div class="small">${right >= 9 ? 'Xuất sắc – mức band 8+ cho phần này.' : right >= 7 ? 'Tốt! Xem lại các câu sai trong lời thoại.' : 'Mở lời thoại bên cạnh, bấm “Nghe đoạn có đáp án” để nghe lại chỗ sai. Câu sai đã vào Sổ lỗi sai.'}</div>
        <div class="row" style="margin-top:.6rem"><a class="btn sm" href="#/dictation/${p.id}">⌨️ Chép chính tả phần này</a><button class="btn sm" id="lAgain">↺ Làm lại</button></div></div>
        ${p.vocab && p.vocab.length ? `<div class="card" style="box-shadow:none;border:1px solid var(--line);margin-top:.8rem"><h3 style="margin-top:0">📚 Từ vựng đáng học trong bài</h3><div class="lvocab">${p.vocab.map((v, k) => `<div class="row between nowrap"><span><b>${esc(v.w)}</b> <span class="muted small">${esc(v.vi)}</span></span><button class="btn sm ghost" data-v="${k}">${App.inDeck(v.w) ? '✓' : '+ Lưu'}</button></div>`).join('')}</div></div>` : ''}`;
      $('#lAgain').onclick = () => routes.listen(id, query);
      $$('[data-v]', $('#lRes')).forEach(b => b.onclick = async () => {
        b.disabled = true; const v = p.vocab[+b.dataset.v];
        const line = (p.script.find(l => l.t && l.t.toLowerCase().includes(v.w.toLowerCase())) || {}).t || '';
        const d = (await Dict.quick(v.w)) || { word: v.w, vi: v.vi, found: true };
        await App.addWord({ ...d, word: v.w, vi: d.vi || v.vi }, line ? { text: line, vi: await Dict.translateVi(line), title: '🎧 ' + p.title } : null); b.textContent = '✓';
      });
      // Hiện lời thoại kèm chỗ có đáp án
      $('#lTransWrap').hidden = false; trans.innerHTML = transcriptHtml(p, true); trans.classList.remove('blur');
      const lv = $('#lLive'); if (lv) { lv.checked = true; lv.disabled = true; }
      $$('[data-hear]').forEach(b => b.onclick = () => { const r = res[+b.dataset.hear]; const i = p.script.findIndex(l => l.t && l.t.includes(r.cue)); if (i < 0) return; const el = $(`.tl[data-line="${i}"]`, trans); if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); let k = i; while (k > 0 && i - k < 1 && p.script[k - 1].t) k--; player.play(k); });
      if (exam) { $('#lPlay').disabled = false; $('#lPlay').textContent = '▶ Nghe lại'; exam && ($('#lNote').textContent = 'Đã nộp bài – giờ bạn có thể nghe lại và xem lời thoại.'); }
      $('#lRes').scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Sau khi nộp: nghe lại tự do
      $('#lPlay').onclick = () => { if (player.playing) player.pause(); else player.play(); };
      if (exam) trans.addEventListener('click', e => { if (e.target.closest('.tw')) return; const l = e.target.closest('.tl'); if (l) player.play(+l.dataset.line); });
    };
  };

  // ================= THI THỬ TRỌN 40 CÂU =================
  routes['listen-test'] = function (n) {
    n = +n || 1;
    const parts = partsOf(n);
    if (!parts.length) return routes.listening();
    let cur = 0, results = {}, player = null;
    App.cleanup = () => player && player.stop();
    const intro = () => {
      view.innerHTML = `<div class="study-wrap"><div class="card celebrate empty"><div class="em">🎧</div><h2>IELTS Listening – Test ${n}</h2>
        <p class="muted">4 phần · 40 câu · khoảng 30 phút. Mỗi phần chỉ nghe <b>một lần</b>. Trước mỗi phần có 30 giây đọc câu hỏi. Đeo tai nghe và chọn nơi yên tĩnh nhé.</p>
        <div class="row center"><button class="btn primary lg" id="tGo">Bắt đầu thi</button><a class="btn" href="#/listening">Để sau</a></div></div></div>`;
      $('#tGo').onclick = () => part(0);
    };
    function part(k) {
      cur = k; const p = parts[k];
      view.innerHTML = `
        <div class="row between"><span class="chip">Test ${n} · Part ${p.part}/4 · Câu ${qNums(p)[0]}–${qNums(p).slice(-1)[0]}</span><span class="small muted" id="tState"></span></div>
        <div class="progress" style="margin:.6rem 0"><i style="width:${k / parts.length * 100}%"></i></div>
        <div class="card lplayer"><b id="tCount">⏳ 30 giây đọc câu hỏi</b><button class="btn sm ghost" id="tSkip">Bắt đầu nghe ngay</button><span class="lnow small muted" id="lNow"></span></div>
        <div class="card" id="lQs">${questionsHtml(p)}<div class="row" style="margin-top:1rem"><button class="btn primary" id="tNext" disabled>${k < parts.length - 1 ? 'Sang phần tiếp →' : '✅ Nộp bài'}</button></div></div>`;
      let left = 30, started = false;
      const tick = setInterval(() => { if (started || !document.body.contains($('#tCount') || document.createElement('i'))) return clearInterval(tick); left--; $('#tCount').textContent = `⏳ ${left} giây đọc câu hỏi`; if (left <= 0) start(); }, 1000);
      const start = () => {
        if (started) return; started = true; clearInterval(tick);
        $('#tSkip').remove(); $('#tCount').textContent = '🔊 Đang phát – chỉ nghe 1 lần';
        player = Player(p, {
          onLine: i => { const l = p.script[i]; $('#lNow') && ($('#lNow').textContent = !l ? '' : l.say ? '🎙️ Lời dẫn' : l.pause != null ? '' : '🗣️ ' + ((p.speakers[l.s] || {}).name || '')); },
          onEnd: () => { if (!$('#tCount')) return; $('#tCount').textContent = '✓ Hết phần nghe – kiểm tra lại đáp án'; $('#tNext').disabled = false; },
        });
        player.play(0);
        setTimeout(() => { const b = $('#tNext'); if (b) b.disabled = false; }, 20000); // cho phép đi tiếp nếu giọng đọc lỗi
      };
      $('#tSkip').onclick = start;
      $('#tNext').onclick = () => {
        if (player && player.playing && !confirm('Phần nghe chưa phát xong. Vẫn chuyển tiếp?')) return;
        if (player) player.stop();
        Object.assign(results, Object.fromEntries(Object.entries(collect(p, $('#lQs'))).map(([q, r]) => [q, { ...r, pid: p.id }])));
        if (k < parts.length - 1) { part(k + 1); window.scrollTo({ top: 0 }); } else finish();
      };
    }
    async function finish() {
      const nums = Object.keys(results).map(Number).sort((a, b) => a - b);
      const raw = nums.filter(q => results[q].ok).length, band = bandOf(raw);
      nums.filter(q => !results[q].ok).forEach(q => App.logMistake && App.logMistake({ kind: 'listening', q: `Test ${n} – Câu ${q}: ${results[q].q}`, answer: results[q].answer, given: results[q].given || '(bỏ trống)', explain: results[q].cue ? `Nghe: “…${results[q].cue}…”` : '', ref: results[q].pid }));
      state.game = await Game.mutate(gs => { gs.listenBest = { ...(gs.listenBest || {}), [n]: Math.max(band, (gs.listenBest || {})[n] || 0) }; gs.listenTests = [...(gs.listenTests || []), { n, raw, band, at: Date.now() }].slice(-30); });
      await App.reward({ quizzes: 1, perfect: raw === 40 ? 1 : 0, xp: 40 + raw * 2 });
      if (band >= 7) { Sfx.win(); confetti(160); }
      const byPart = parts.map(p => ({ p, r: qNums(p).filter(q => results[q] && results[q].ok).length }));
      view.innerHTML = `<div class="study-wrap" style="max-width:820px">
        <div class="card celebrate"><div class="em">🎧</div><h2>Band ${band} · ${raw}/40 câu đúng</h2><p class="muted">Quy đổi theo thang điểm Listening phổ biến của IELTS – chỉ mang tính tham khảo.</p>
          <div class="grid g2" style="margin-top:.8rem">${byPart.map(({ p, r }) => `<a class="card hover" href="#/listen/${p.id}" style="box-shadow:none;border:1px solid var(--line);color:var(--text)"><b>Part ${p.part}</b> · ${r}/10<div class="progress" style="margin-top:.4rem"><i style="width:${r * 10}%"></i></div><div class="tiny muted">Bấm để luyện lại có lời thoại</div></a>`).join('')}</div></div>
        <div class="card"><h3>📋 Bảng đáp án</h3><div class="lsheet">${nums.map(q => `<div class="${results[q].ok ? 'ok' : 'no'}"><b>${q}</b> ${results[q].ok ? '✓' : '✗'} <span>${esc(results[q].answer)}</span>${!results[q].ok && results[q].given ? `<span class="tiny muted">(bạn: ${esc(results[q].given)})</span>` : ''}</div>`).join('')}</div>
          <div class="row" style="margin-top:1rem"><a class="btn primary" href="#/listening">Về Luyện nghe</a><a class="btn" href="#/mistakes">📕 Xem Sổ lỗi sai</a></div></div></div>`;
    }
    intro();
  };

  // ================= CHÉP CHÍNH TẢ =================
  routes.dictation = function (id) {
    const p = byId(id);
    if (!p) return routes.listening();
    const lines = p.script.map((l, i) => ({ ...l, i })).filter(l => l.t && l.t.split(/\s+/).length >= 4);
    let k = 0, score = 0, done = 0;
    const cast = castVoices(p);
    const say = (l, slow) => { speechSynthesis.cancel(); const c = cast[l.s] || cast._narrator; UI.splitSentences(l.t).forEach(t => { const u = new SpeechSynthesisUtterance(t); u.lang = c.lang; if (c.voice) u.voice = c.voice; u.pitch = c.pitch; u.rate = slow ? 0.7 : (state.settings.listenRate || 0.95); speechSynthesis.speak(u); }); };
    App.cleanup = () => speechSynthesis.cancel();
    const toks = s => s.replace(/[’‘]/g, "'").split(/\s+/).filter(Boolean);
    const clean = w => w.toLowerCase().replace(/[^a-z0-9'%]/g, '');
    function diff(target, given) {
      // So khớp từng từ (LCS) → đúng / sai / thiếu
      const a = toks(target), b = toks(given).map(clean).filter(Boolean), A = a.map(clean);
      const dp = Array.from({ length: A.length + 1 }, () => new Array(b.length + 1).fill(0));
      for (let x = A.length - 1; x >= 0; x--) for (let y = b.length - 1; y >= 0; y--) dp[x][y] = A[x] === b[y] ? dp[x + 1][y + 1] + 1 : Math.max(dp[x + 1][y], dp[x][y + 1]);
      const out = []; let x = 0, y = 0;
      while (x < A.length) { if (y < b.length && A[x] === b[y]) { out.push(`<span class="dk ok">${esc(a[x])}</span>`); x++; y++; } else if (y < b.length && dp[x][y + 1] >= dp[x + 1][y]) { out.push(`<span class="dk extra">${esc(b[y])}</span>`); y++; } else { out.push(`<span class="dk miss">${esc(a[x])}</span>`); x++; } }
      while (y < b.length) out.push(`<span class="dk extra">${esc(b[y++])}</span>`);
      return { html: out.join(' '), pct: A.filter(Boolean).length ? dp[0][0] / A.filter(Boolean).length : 0 };
    }
    const draw = () => {
      if (k >= lines.length) {
        const pct = done ? Math.round(score / done * 100) : 0;
        App.reward({ quizzes: 1, xp: 10 + Math.round(pct / 5) });
        view.innerHTML = `<div class="study-wrap"><div class="card celebrate empty"><div class="em">⌨️</div><h2>Chính xác ${pct}%</h2><p class="muted">${done} câu đã chép. Chép chính tả đều đặn giúp tai nhận ra nối âm, nuốt âm và trọng âm câu.</p><div class="row center"><a class="btn primary" href="#/listen/${p.id}">🎯 Làm câu hỏi phần này</a><a class="btn" href="#/listening">Về Luyện nghe</a></div></div></div>`;
        return;
      }
      const l = lines[k];
      view.innerHTML = `<div class="study-wrap"><div class="study-top"><a class="icon-btn" href="#/listening">✕</a><div class="progress"><i style="width:${k / lines.length * 100}%"></i></div><span class="small muted">${k + 1}/${lines.length}</span></div>
        <div class="card q-card"><div class="tiny muted">⌨️ Chép chính tả · ${esc(p.title)} · ${esc((p.speakers[l.s] || {}).name || '')}</div>
          <div class="row center" style="margin:1rem 0"><button class="btn primary lg" id="dPlay">🔊 Nghe</button><button class="btn" id="dSlow">🐢 Nghe chậm</button></div>
          <textarea id="dIn" rows="3" class="dict-in" placeholder="Gõ lại những gì bạn nghe được… (Enter để kiểm tra)" spellcheck="false"></textarea>
          <div id="dFb" style="margin-top:.6rem"></div>
          <div class="row" style="margin-top:.6rem"><button class="btn primary" id="dChk">Kiểm tra</button><button class="btn ghost" id="dSkip">Bỏ qua</button></div></div></div>`;
      $('#dPlay').onclick = () => say(l); $('#dSlow').onclick = () => say(l, true);
      setTimeout(() => say(l), 300); $('#dIn').focus();
      let checked = false;
      const check = () => {
        if (checked) { k++; draw(); return; }
        checked = true; const d = diff(l.t, $('#dIn').value); done++; score += d.pct;
        d.pct >= 0.9 ? Sfx.correct() : Sfx.wrong();
        $('#dFb').innerHTML = `<div class="feedback ${d.pct >= 0.9 ? 'ok' : 'no'}" style="position:static"><b>${Math.round(d.pct * 100)}% chính xác</b><div style="margin-top:.4rem;line-height:1.9">${d.html}</div><div class="tiny muted" style="margin-top:.3rem"><span class="dk ok">đúng</span> <span class="dk miss">bỏ sót</span> <span class="dk extra">thừa/sai</span></div></div>`;
        $('#dChk').textContent = 'Câu tiếp ↵';
      };
      $('#dChk').onclick = check; $('#dSkip').onclick = () => { k++; draw(); };
      $('#dIn').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); check(); } });
    };
    draw();
  };

  App.listening = { bandOf, byId, castVoices };
})();
