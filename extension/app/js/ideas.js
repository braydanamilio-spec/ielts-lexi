/* Ngân hàng ý tưởng Writing Task 2: theo chủ đề → vấn đề → luận điểm ủng hộ / phản đối, câu mẫu và cụm từ để lưu. */
(function () {
  const { $, $$, esc, toast } = UI;
  const App = window.App;
  const { state, routes } = App;
  const view = App.view;
  const I = () => window.IDEAS || [];

  routes.ideas = function (topic) {
    const all = I();
    if (!all.length) { view.innerHTML = '<div class="card empty"><div class="em">💡</div>Đang cập nhật ngân hàng ý tưởng.</div>'; return; }
    const t = all.find(x => x.topic === topic) || all[0];
    const prompt = (window.WRITE_PROMPTS || []).filter(p => p.topic === t.topic);
    view.innerHTML = `
      <div class="page-head"><div><h1>💡 Ngân hàng ý tưởng Task 2</h1><p class="muted">Bí ý là lỗi phổ biến nhất khi viết Task 2. Chọn chủ đề → vấn đề → lấy luận điểm ủng hộ/phản đối kèm câu mẫu band 8 và cụm từ hay để lưu vào Sổ cụm từ.</p></div></div>
      <div class="row" style="margin-bottom:1rem">${all.map(x => `<a class="chip ${x === t ? 'lv' : ''}" href="#/ideas/${x.topic}">${x.emoji} ${esc(x.title)}</a>`).join('')}</div>
      <div class="stack">${t.issues.map((iss, i) => `<details class="card idea" ${i ? '' : 'open'}><summary><b>❓ ${esc(iss.q)}</b></summary>
        <div class="grid g2" style="margin-top:.8rem">${[['for', '👍 Ủng hộ'], ['against', '👎 Phản đối']].map(([k, l]) => `<div><h4 style="margin:.2rem 0 .5rem">${l}</h4>${(iss[k] || []).map(x => `<div class="idea-it">
          <b>${esc(x.idea)}</b><div class="small muted">${esc(x.vi)}</div>
          <div class="ctx-box"><div class="ctx-tx">${esc(x.ex)}</div><div class="ctx-act"><button class="ctx-say" data-saysent="${esc(x.ex)}">🔊</button></div></div>
          <div class="row" style="margin-top:.4rem;gap:.3rem">${(x.chunks || []).map(c => { const [en, vi] = String(c).split('|'); return `<button class="chip idea-ch" data-en="${esc(en)}" data-vi="${esc(vi || '')}" data-ex="${esc(x.ex)}" title="${esc(vi || '')} – bấm để lưu">+ ${esc(en)}</button>`; }).join('')}</div></div>`).join('')}</div>`).join('')}</div>
      </details>`).join('')}</div>
      <div class="card" style="margin-top:1rem"><h3 style="margin-top:0">📚 Từ vựng chủ đề ${esc(t.title)}</h3><div class="ai-vocab">${(t.vocab || []).map(([en, vi]) => `<div><b>${esc(en)}</b><div class="tiny muted">${esc(vi)}</div></div>`).join('')}</div></div>
      ${prompt.length ? `<div class="card" style="margin-top:1rem"><h3 style="margin-top:0">✍️ Luyện viết với chủ đề này</h3>${prompt.slice(0, 5).map(p => `<a class="md-item" href="#/write/${p.id}" style="color:var(--text)"><span class="small">${esc(p.text)}</span><span>→</span></a>`).join('')}</div>` : ''}`;
    $$('.idea-ch').forEach(b => b.onclick = () => App.savePhraseDialog ? App.savePhraseDialog({ phrase: b.dataset.en, vi: b.dataset.vi, sentence: b.dataset.ex, title: 'Ý tưởng Task 2' }) : toast('Không lưu được'));
  };
})();
