/* Phương pháp học: nguyên lý nghiên cứu → tính năng cụ thể → số liệu thật của chính người học.
 * Gồm vòng lặp mỗi ngày, bộ nhớ từ vựng (FSRS), cân bằng 4 mạch học (Nation), 12 nguyên lý và lộ trình theo band. */
(function () {
  const { $, $$, esc } = UI;
  const { Store, SRS, Golden, todayKey, DAY } = Core;
  const App = window.App;
  const { state, routes } = App;
  const view = App.view;

  const sumDays = (days, keys, n = 7) => {
    let t = 0; const d = new Date();
    for (let i = 0; i < n; i++) { const k = todayKey(d); const x = days[k] || {}; keys.forEach(m => { t += x[m] || 0; }); d.setDate(d.getDate() - 1); }
    return t;
  };
  const reviewsIn = n => { let t = 0; const d = new Date(); for (let i = 0; i < n; i++) { t += state.stats.days[todayKey(d)] || 0; d.setDate(d.getDate() - 1); } return t; };
  const pct = (a, b) => b ? Math.round(a / b * 100) : 0;

  // ---------- Bộ nhớ từ vựng: dự báo khả năng còn nhớ nếu ngừng ôn ----------
  function memory() {
    const cards = Object.values(state.cards).filter(c => c.srs && c.srs.last && c.srs.reps > 0);
    const now = Date.now();
    const S = c => c.srs.S != null ? c.srs.S : Math.max(0.5, c.srs.interval || 1);
    const at = days => cards.length ? cards.reduce((a, c) => a + SRS.F.R(Math.max(0, (now - c.srs.last) / DAY) + days, S(c)), 0) / cards.length : 0;
    return { cards, at, learning: Object.values(state.cards).filter(c => c.srs && c.srs.last && c.srs.reps === 0).length };
  }
  function curveSvg(m, mark) {
    const W = 560, H = 190, P = 34, days = 60;
    const x = d => P + d / days * (W - P - 10), y = r => 12 + (1 - r) * (H - 40);
    const demo = !m.cards.length;
    const f = demo ? (d => SRS.F.R(d, 3)) : m.at;
    const keep = SRS.retentionTarget;
    let path = ''; for (let d = 0; d <= days; d += 1) path += `${d ? 'L' : 'M'}${x(d).toFixed(1)},${y(f(d)).toFixed(1)}`;
    // Có ôn đúng lịch: răng cưa quanh mức mục tiêu
    let saw = `M${x(0)},${y(Math.max(keep, f(0)))}`; let t = 0, S = 2;
    while (t < days) { const ivl = Math.max(1, SRS.F.ivl(S, keep)); const t2 = Math.min(days, t + ivl); for (let d = t + 1; d <= t2; d++) saw += `L${x(d).toFixed(1)},${y(SRS.F.R(d - t, S)).toFixed(1)}`; saw += `L${x(t2).toFixed(1)},${y(1).toFixed(1)}`; t = t2; S *= 2.6; }
    const grid = [1, 0.8, 0.6, 0.4].map(r => `<line x1="${P}" x2="${W - 10}" y1="${y(r)}" y2="${y(r)}" stroke="var(--line)"/><text x="4" y="${y(r) + 4}" font-size="11" fill="var(--muted)">${r * 100}%</text>`).join('');
    const xt = [0, 7, 14, 30, 60].map(d => `<text x="${x(d) - 6}" y="${H - 8}" font-size="11" fill="var(--muted)">${d}d</text>`).join('');
    return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto" role="img" aria-label="Đường cong quên lãng">
      ${grid}${xt}
      <path d="${saw}" fill="none" stroke="#16a34a" stroke-width="2" stroke-dasharray="4 3" opacity=".8"/>
      <path d="${path}" fill="none" stroke="var(--primary)" stroke-width="3"/>
      <line x1="${x(mark)}" x2="${x(mark)}" y1="10" y2="${H - 26}" stroke="#f59e0b" stroke-width="2"/>
      <circle cx="${x(mark)}" cy="${y(f(mark))}" r="5" fill="#f59e0b"/>
    </svg>
    <div class="row small" style="gap:1rem"><span><b style="color:var(--primary)">━</b> ${demo ? 'Ví dụ 1 từ mới học' : 'Từ của bạn nếu ngừng ôn'}</span><span><b style="color:#16a34a">┅</b> Ôn đúng “thời điểm vàng” (FSRS)</span></div>`;
  }

  routes.method = async function () {
    const g = state.game, s = state.settings, d = g.days[todayKey()] || {};
    const dueNow = Golden.dueNow(state.cards);
    const forget = App.forgetting().length;
    const mistakes = (await Store.get('mistakes', [])).filter(x => !x.fixed).length;
    const essays = (await Store.get('essays', [])).length;
    const cards = Object.values(state.cards);
    const mine = cards.reduce((a, c) => a + (c.contexts || []).filter(x => x.title === 'Câu của tôi').length, 0);
    const withCtx = cards.filter(c => (c.contexts || []).some(x => x.title !== 'Câu của tôi')).length;
    const phrases = cards.filter(c => App.isPhrase ? App.isPhrase(c) : /\s/.test(c.word)).length;
    const READ = window.READINGS || [];
    const readDone = Object.keys(g.readDone || {}).length, listenDone = Object.keys(g.listenDone || {}).length, grammarDone = Object.keys(g.grammarDone || {}).length, pronDone = Object.keys(g.pronDone || {}).length;
    const totalReviews = Object.values(state.stats.days || {}).reduce((a, b) => a + b, 0);
    const m = memory();
    const pl = s.placement;

    // Vòng lặp hôm nay
    const LOOP = [
      { em: '🔁', t: 'Ôn thẻ đến hạn', sub: dueNow ? `${dueNow} thẻ đang ở thời điểm vàng` : 'Không còn thẻ đến hạn', href: '#/review', done: !dueNow && (state.stats.days[todayKey()] || 0) > 0, why: 'Lặp lại ngắt quãng' },
      { em: '🎧', t: 'Nghe hoặc đọc 1 bài', sub: 'Đầu vào dễ hiểu, hơi vượt trình độ', href: (d.readings || 0) > (d.listens || 0) ? '#/listening' : '#/reading', done: (d.readings || 0) + (d.listens || 0) > 0, why: 'Ngữ liệu dễ hiểu' },
      { em: '📌', t: 'Lưu 5 từ kèm câu gốc', sub: `Hôm nay: ${d.newWords || 0} từ`, href: '#/reading', done: (d.newWords || 0) >= 5, why: 'Học trong ngữ cảnh' },
      { em: '📐', t: '1 bài ngữ pháp', sub: 'Học từng bước + tự luận', href: '#/grammar', done: (d.grammar || 0) > 0, why: 'Học tập trung vào ngôn ngữ' },
      { em: '🗣️', t: 'Nói hoặc viết', sub: 'Dùng lại từ vừa học', href: (d.spoken || 0) ? '#/write' : '#/speaking', done: (d.spoken || 0) + (d.writes || 0) > 0, why: 'Đầu ra bắt buộc' },
      { em: '📕', t: 'Sửa lỗi sai', sub: mistakes ? `${mistakes} lỗi chưa xem lại` : 'Không có lỗi tồn đọng', href: '#/mistakes', done: !mistakes, why: 'Phản hồi sửa lỗi' },
    ];
    const loopDone = LOOP.filter(x => x.done).length;

    // 4 mạch học (7 ngày) – quy đổi về “phiên” ~10 phút
    const D = g.days || {};
    const strands = [
      { k: 'in', em: '📖', t: 'Đầu vào có nghĩa', sub: 'Đọc, nghe', v: sumDays(D, ['readings']) + sumDays(D, ['listens']), href: '#/listening', cta: 'Nghe 1 phần' },
      { k: 'out', em: '🗣️', t: 'Đầu ra có nghĩa', sub: 'Nói, viết, tự đặt câu', v: Math.round(sumDays(D, ['spoken']) / 3) + sumDays(D, ['writes']) + cards.reduce((a, c) => a + (c.contexts || []).filter(x => x.title === 'Câu của tôi' && Date.now() - (x.at || 0) < 7 * DAY).length, 0) / 3, href: '#/speaking', cta: 'Luyện Speaking' },
      { k: 'lang', em: '🧠', t: 'Tập trung ngôn ngữ', sub: 'Flashcard, ngữ pháp, phát âm', v: Math.round(reviewsIn(7) / 20) + sumDays(D, ['grammar', 'pron']), href: '#/grammar', cta: 'Học ngữ pháp' },
      { k: 'flu', em: '⚡', t: 'Luyện trôi chảy', sub: 'Ghép thẻ tính giờ, chép chính tả, thi thử', v: sumDays(D, ['matches', 'dictations']), href: '#/practice/match?src=deck', cta: 'Ghép thẻ tính giờ' },
    ].map(x => ({ ...x, v: Math.round(x.v) }));
    const sTotal = strands.reduce((a, x) => a + x.v, 0);
    const weakest = sTotal ? strands.slice().sort((a, b) => a.v - b.v)[0] : null;

    // 12 nguyên lý → tính năng → số liệu của bạn
    const P = [
      { em: '📉', t: 'Đường cong quên lãng', who: 'Ebbinghaus (1885) · Murre & Dros (2015, tái lập)', idea: 'Trí nhớ về thông tin mới giảm nhanh nhất trong vài ngày đầu; mỗi lần nhớ lại thành công làm đường cong thoải hơn.', how: 'Mỗi từ có chỉ số <b>🧠 % còn nhớ</b> tính theo FSRS. Từ tụt dưới mục tiêu vào danh sách <b>Sắp quên</b>.', stat: forget ? `${forget} từ đang sắp quên` : 'Chưa có từ nào sắp quên', links: [['#/deck?from=forget', 'Xem từ sắp quên']] },
      { em: '🔁', t: 'Lặp lại ngắt quãng (FSRS)', who: 'Leitner (1972) · Woźniak (1987) · Ye và cs. (2022)', idea: 'Ôn với khoảng cách tăng dần, đúng lúc sắp quên, cho hiệu quả gấp nhiều lần học dồn.', how: `Thuật toán <b>FSRS</b> (mặc định của Anki) tính độ ổn định & độ khó riêng từng từ; lịch ôn giữ khả năng nhớ ≈ <b>${Math.round(SRS.retentionTarget * 100)}%</b>.`, stat: `${dueNow} thẻ đến hạn · ${totalReviews} lượt ôn đã làm`, links: [['#/review', 'Ôn tập ngay'], ['#/settings', 'Chỉnh mục tiêu ghi nhớ']] },
      { em: '🎯', t: 'Chủ động nhớ lại', who: 'Roediger & Karpicke (2006)', idea: 'Tự kiểm tra – cố nhớ ra trước khi xem đáp án – giúp nhớ lâu hơn hẳn đọc lại nhiều lần.', how: 'Thẻ luôn bắt <b>đoán trước khi lật</b>; Học thông minh đi từ nhận diện (trắc nghiệm) đến <b>tự gõ lại từ</b>; ngữ pháp có <b>bài tự luận</b>.', stat: `${cards.filter(c => c.srs && c.srs.last).length} từ đã học`, links: [['#/practice/learn?src=deck', 'Học thông minh']] },
      { em: '📖', t: 'Ngữ liệu dễ hiểu (i+1)', who: 'Krashen (1985) · Nation (2006): cần biết ~98% từ để đọc thoải mái', idea: 'Ngôn ngữ được tiếp thu qua nội dung có ý nghĩa, hơi vượt trình độ hiện tại.', how: 'Bài đọc B1→C1 và <b>20 phần nghe</b> nhiều giọng Anh–Mỹ–Úc; chạm từ bất kỳ để tra & lưu kèm câu gốc.', stat: `Đã đọc ${readDone}/${READ.length} bài · nghe ${listenDone}/${(window.LISTENING || []).length || 20} phần`, links: [['#/reading', 'Đọc bài'], ['#/listening', 'Luyện nghe']] },
      { em: '🔦', t: 'Chú ý có chủ đích (Noticing)', who: 'Schmidt (1990)', idea: 'Người học chỉ tiếp thu được những gì họ để ý thấy – tô sáng cấu trúc giúp “nhìn ra” ngôn ngữ.', how: 'Bài đọc tô sáng <b>từ học thuật AWL, từ nối, collocation</b>; bài mẫu Writing chú thích <b>cụm hay, nghĩa, vai trò từng câu</b>.', stat: `${withCtx} từ đã lưu kèm ngữ cảnh thật`, links: [['#/phrases', 'Bài mẫu có chú thích']] },
      { em: '✍️', t: 'Hiệu ứng tự tạo', who: 'Slamecka & Graf (1978) · Laufer & Hulstijn (2001)', idea: 'Thông tin do chính mình tạo ra (tự đặt câu, tự viết lại) được nhớ tốt hơn thông tin cho sẵn.', how: 'Mặt sau flashcard có ô <b>Tự đặt câu</b>; câu của bạn thành ngữ cảnh cho lần ôn sau. Bài mẫu có dạng <b>viết lại câu</b>.', stat: `${mine} câu tự đặt`, links: [['#/review', 'Thử đặt câu']] },
      { em: '🖼️', t: 'Mã hóa kép', who: 'Paivio (1971) · Mayer (2009)', idea: 'Kết hợp hình ảnh, chữ và âm thanh tạo nhiều “đường dẫn” để gọi lại trí nhớ.', how: 'Từ có <b>hình minh họa</b> (ảnh giấy phép mở), IPA, <b>phát âm UK/US</b>; ngữ pháp có dòng thời gian & sơ đồ màu.', stat: `${pronDone} bài phát âm đã học`, links: [['#/practice/speak?src=deck', 'Luyện phát âm từ'], ['#/pron', 'Thư viện phát âm']] },
      { em: '🔀', t: 'Học xen kẽ', who: 'Rohrer & Taylor (2007) · Brunmair & Richter (2019)', idea: 'Trộn nhiều dạng bài/chủ điểm trong một buổi giúp phân biệt và ghi nhớ tốt hơn học từng khối.', how: '<b>Kiểm tra chương</b> trộn trắc nghiệm với tự luận; phiên ôn xen từ mới vào giữa từ cũ.', stat: `${grammarDone} bài ngữ pháp đã làm`, links: [['#/grammar/mix', 'Luyện trộn ngữ pháp']] },
      { em: '🗣️', t: 'Đầu ra bắt buộc', who: 'Swain (1985, Output Hypothesis)', idea: 'Phải nói/viết mới phát hiện ra lỗ hổng của mình – đầu ra buộc xử lý ngữ pháp sâu hơn đầu vào.', how: '<b>Phòng Speaking</b> ghi âm & phân tích từ vựng; <b>Phòng viết</b> Task 1 & 2 bấm giờ, chấm sơ bộ theo band.', stat: `${essays} bài viết · ${sumDays(D, ['spoken'], 30)} điểm nói (30 ngày)`, links: [['#/speaking', 'Phòng Speaking'], ['#/write', 'Phòng viết']] },
      { em: '🧩', t: 'Học theo cụm từ', who: 'Lewis (1993, Lexical Approach) · Boers & Lindstromberg (2009)', idea: 'Người bản ngữ nói bằng các cụm có sẵn; học collocation giúp nói & viết tự nhiên và nhanh hơn.', how: '<b>Sổ cụm từ</b>: bôi đen bất kỳ đoạn nào để lưu cụm kèm nghĩa; 5 dạng bài luyện từ mỗi bài mẫu.', stat: `${phrases} cụm từ đã lưu`, links: [['#/phrases', 'Sổ cụm từ']] },
      { em: '📕', t: 'Phản hồi sửa lỗi', who: 'Lyster & Ranta (1997) · Hattie (2007)', idea: 'Phản hồi cụ thể, kịp thời và được xem lại là một trong những yếu tố tác động mạnh nhất tới kết quả học.', how: 'Mọi câu sai (từ vựng, ngữ pháp, đọc, nghe) tự vào <b>Sổ lỗi sai</b> kèm giải thích và nút học lại đúng chỗ.', stat: mistakes ? `${mistakes} lỗi chưa xem lại` : 'Không có lỗi tồn đọng', links: [['#/mistakes', 'Sổ lỗi sai']] },
      { em: '🏆', t: 'Động lực & thói quen', who: 'Deci & Ryan (Self-Determination) · Lally và cs. (2010)', idea: 'Thói quen hình thành sau trung bình ~66 ngày lặp lại; mục tiêu nhỏ, phản hồi tiến bộ giữ động lực.', how: 'Chuỗi ngày, XP, nhiệm vụ & huy hiệu; <b>thời điểm vàng</b> nhắc đúng lúc; kế hoạch hôm nay cá nhân hóa.', stat: `Chuỗi ${App.streak()} ngày · ${g.xp || 0} XP`, links: [['#/stats', 'Tiến độ & huy hiệu']] },
    ];

    // Lộ trình gợi ý theo band (phút/ngày)
    const stage = pl ? pl.stage : null;
    const PLAN = {
      s0: ['Nền tảng (band < 4.5)', [['Từ vựng cốt lõi NGSL', 15, '#/path'], ['Ngữ pháp A2–B1', 10, '#/grammar'], ['Phát âm IPA', 5, '#/pron'], ['Nghe Part 1', 5, '#/listening']]],
      s1: ['Tăng tốc (band 4.5–5.5)', [['Flashcard + từ chủ đề', 15, '#/review'], ['Ngữ pháp B1–B2', 10, '#/grammar'], ['Nghe Part 1–2', 10, '#/listening'], ['Đọc 1 bài', 10, '#/reading']]],
      s2: ['Bứt phá (band 5.5–6.5)', [['Flashcard AWL', 10, '#/review'], ['Nghe Part 3–4 + chép chính tả', 15, '#/listening'], ['Đọc & tô sáng', 10, '#/reading'], ['Viết 1 đoạn / nói 1 câu', 10, '#/write']]],
      s3: ['Về đích (band 6.5+)', [['Ôn thẻ', 10, '#/review'], ['Thi thử Listening/Reading', 20, '#/listening'], ['Bài mẫu + viết Task 2', 15, '#/phrases'], ['Speaking Part 2–3', 10, '#/speaking']]],
    };
    const plan = PLAN[stage] || PLAN.s1;

    view.innerHTML = `
      <div class="page-head"><div><h1>🧪 Phương pháp học của Vocaband</h1><p class="muted">Mỗi tính năng dựa trên một nguyên lý đã được nghiên cứu về trí nhớ và thụ đắc ngôn ngữ – kèm số liệu thật của chính bạn để biết nên làm gì tiếp theo.</p></div></div>

      <div class="card hero-main" style="margin-bottom:1rem">
        <div class="row between"><h2 style="color:#fff;margin:0">Vòng lặp học mỗi ngày (~30 phút)</h2><span class="chip" style="background:rgba(255,255,255,.2);color:#fff">Hôm nay ${loopDone}/${LOOP.length}</span></div>
        <div class="mloop">${LOOP.map((x, i) => `<a class="mstep ${x.done ? 'done' : ''}" href="${x.href}"><span class="mnum">${x.done ? '✓' : i + 1}</span><span class="mem">${x.em}</span><b>${x.t}</b><small>${esc(x.sub)}</small><i>${x.why}</i></a>`).join('')}</div>
      </div>

      <div class="grid g2" style="margin-bottom:1rem">
        <div class="card">
          <div class="row between"><h2 style="margin:0">🧠 Bộ nhớ từ vựng của bạn</h2><a class="small" href="#/settings">Mục tiêu ${Math.round(SRS.retentionTarget * 100)}% →</a></div>
          ${m.cards.length ? `<div class="mstats"><div><b>${m.cards.length}</b><span>từ đang nhớ</span></div><div><b>${Math.round(m.at(0) * 100)}%</b><span>khả năng nhớ trung bình</span></div><div><b>${dueNow}</b><span>đến hạn ôn</span></div><div><b>${m.learning}</b><span>đang ở bước học</span></div></div>`
            : '<p class="small muted">Bạn chưa có từ nào ở lịch ôn theo ngày. Dưới đây là đường cong của một từ mới học – hãy học vài từ để xem biểu đồ của chính bạn.</p>'}
          <div id="mCurve" style="margin-top:.6rem">${curveSvg(m, 7)}</div>
          <label class="field" style="margin-top:.4rem"><span>Nếu ngừng ôn <b id="mDays">7</b> ngày → còn nhớ khoảng <b id="mPct"></b></span><input type="range" min="0" max="60" value="7" id="mSlide" style="width:100%"></label>
          <div class="row" style="margin-top:.4rem">${dueNow ? `<a class="btn primary sm" href="#/review">Ôn ${dueNow} thẻ ngay</a>` : '<a class="btn primary sm" href="#/library">Học từ mới</a>'}${forget ? `<a class="btn sm" href="#/deck?from=forget">${forget} từ sắp quên</a>` : ''}</div>
        </div>
        <div class="card">
          <h2 style="margin:0 0 .3rem">⚖️ Cân bằng 4 mạch học <span class="tiny muted">· 7 ngày qua</span></h2>
          <p class="small muted" style="margin-top:0">Paul Nation (2007): một chương trình hiệu quả chia thời gian gần đều cho 4 mạch. Thiếu mạch nào thì tiến bộ chậm ở mạch đó.</p>
          ${strands.map(x => `<div class="mstrand"><span class="mse">${x.em}</span><div class="grow"><div class="row between nowrap"><b class="small">${x.t}</b><span class="tiny muted">${sTotal ? pct(x.v, sTotal) : 0}%</span></div><div class="progress"><i style="width:${sTotal ? pct(x.v, sTotal) : 0}%;background:${weakest && x.k === weakest.k ? '#f59e0b' : 'var(--primary)'}"></i></div><div class="tiny muted">${x.sub}</div></div></div>`).join('')}
          ${weakest ? `<div class="example-box small" style="margin-top:.6rem">💡 Mạch đang thiếu: <b>${weakest.t}</b>. <a href="${weakest.href}">${weakest.cta} →</a></div>` : '<div class="example-box small" style="margin-top:.6rem">Bắt đầu học để xem bạn đang cân bằng thế nào giữa 4 mạch.</div>'}
        </div>
      </div>

      <div class="card" style="margin-bottom:1rem">
        <div class="row between"><h2 style="margin:0">🗺️ Lộ trình gợi ý: ${plan[0]}</h2>${pl ? `<span class="chip">Band đầu vào ${esc(pl.band)}</span>` : '<a class="btn sm primary" href="#/placement">🧭 Kiểm tra trình độ để cá nhân hóa</a>'}</div>
        <div class="mplan">${plan[1].map(([t, min, href]) => `<a class="mpi" href="${href}"><b>${min}′</b><span>${t}</span></a>`).join('')}</div>
        <div class="tiny muted" style="margin-top:.4rem">Tổng ~${plan[1].reduce((a, x) => a + x[1], 0)} phút/ngày. Đều đặn mỗi ngày hiệu quả hơn học dồn cuối tuần. <a href="#/path">Xem Lộ trình chi tiết →</a></div>
      </div>

      <h2>📚 12 nguyên lý & cách Vocaband áp dụng</h2>
      <div class="grid g2">${P.map(p => `
        <div class="card mprin">
          <div class="row nowrap"><span style="font-size:2rem">${p.em}</span><div><h3 style="margin:0">${p.t}</h3><div class="tiny muted">${p.who}</div></div></div>
          <p class="small" style="margin:.6rem 0">${p.idea}</p>
          <div class="example-box small" style="border-left-color:var(--primary)"><b>Trong Vocaband:</b> ${p.how}</div>
          <div class="row between" style="margin-top:auto;padding-top:.7rem"><span class="chip">📊 ${esc(p.stat)}</span><div class="row">${p.links.map(([h, l], i) => `<a class="btn sm ${i ? 'ghost' : ''}" href="${h}">${l} →</a>`).join('')}</div></div>
        </div>`).join('')}</div>

      <div class="card" style="margin-top:1rem"><h2 style="margin-top:0">❓ Câu hỏi thường gặp</h2>
        <details><summary><b>Mỗi ngày nên học bao nhiêu từ mới?</b></summary><p class="small">10–20 từ là hợp lý. Mỗi từ mới sinh ra khoảng 5–8 lượt ôn trong tháng đầu, nên học quá nhiều sẽ khiến lượng ôn dồn lên. Chỉnh số từ mới/ngày và giới hạn phiên ôn trong <a href="#/settings">Cài đặt</a>.</p></details>
        <details><summary><b>Bấm “Khó” hay “Quên” khác nhau thế nào?</b></summary><p class="small">“Quên” = không nhớ ra → thẻ quay lại bước học (1 phút), độ ổn định giảm. “Khó” = nhớ ra nhưng vất vả → khoảng ôn tăng ít. Hãy trả lời trung thực – FSRS dựa vào đó để tính lịch tối ưu cho riêng bạn.</p></details>
        <details><summary><b>Mục tiêu ghi nhớ 90% nghĩa là gì?</b></summary><p class="small">Khi một từ đến lượt ôn, bạn có ~90% khả năng còn nhớ. Tăng lên 95% thì nhớ chắc hơn nhưng số lượt ôn gần gấp đôi; giảm xuống 85% thì ít ôn hơn. 90% là điểm cân bằng được khuyên dùng.</p></details>
        <details><summary><b>Bỏ lỡ vài ngày thì sao?</b></summary><p class="small">Không sao – FSRS tính đến thời gian thực tế đã trôi qua. Từ bạn vẫn nhớ sau thời gian dài sẽ được giãn lịch xa hơn; hãy ôn phần “Sắp quên” trước, giới hạn phiên ôn để không bị ngợp.</p></details>
        <details><summary><b>Vì sao nên lưu từ kèm câu gốc?</b></summary><p class="small">Câu gốc cho biết cách dùng thật: từ đi với giới từ nào, collocation nào, sắc thái ra sao. Khi ôn, nhìn lại ngữ cảnh giúp bạn dùng đúng từ khi nói và viết – điều Lexical Resource trong IELTS chấm.</p></details>
      </div>`;
    App.bindCommon && App.bindCommon();
    const paint = n => { $('#mDays').textContent = n; const r = m.cards.length ? m.at(n) : SRS.F.R(n, 3); $('#mPct').textContent = Math.round(r * 100) + '%' + (m.cards.length ? ` (≈${Math.round(r * m.cards.length)}/${m.cards.length} từ)` : ''); $('#mCurve').innerHTML = curveSvg(m, n); };
    $('#mSlide').oninput = e => paint(+e.target.value);
    paint(7);
  };
})();
