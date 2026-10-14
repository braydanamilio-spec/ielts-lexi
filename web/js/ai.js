/* Chấm Writing/Speaking bằng AI (Google Gemini) – mỗi người dùng dùng khóa API miễn phí của riêng mình.
 * Khóa chỉ lưu trên máy (không đồng bộ, không gửi đi đâu ngoài Google). Kết quả lưu đệm để không gọi lại cùng một bài. */
(function () {
  const { $, $$, esc, toast, modal, closeModal } = UI;
  const { Store } = Core;
  const App = window.App;
  const { state } = App;
  const MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'];
  const API = (m, k) => `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent?key=${encodeURIComponent(k)}`;
  const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };

  const getKey = () => Store.get('aiKey', '');
  const SYS = `You are a certified senior IELTS examiner. Assess strictly according to the official public IELTS band descriptors. Be accurate, not generous: short or off-topic answers must receive low bands. Write all comments, explanations and advice in Vietnamese (clear, encouraging, specific). Quote the learner's exact words when pointing out errors. Return ONLY valid JSON matching the requested schema.`;
  const SCHEMA = kind => `JSON schema:
{
  "overall": number (IELTS band, multiple of 0.5),
  "criteria": [ { "name": string (English criterion name), "band": number, "comment": string (Vietnamese, 1-3 sentences) } ],
  "summary": string (Vietnamese, 2-3 sentences overall verdict),
  "strengths": [string] (Vietnamese, 2-4 items),
  "improvements": [string] (Vietnamese, 3-5 concrete actions),
  "errors": [ { "quote": string (exact learner text), "fix": string (corrected English), "why": string (Vietnamese) } ] (up to 8 most important grammar/vocabulary errors),
  "vocab": [ { "from": string, "to": string (more precise/academic alternative), "note": string (Vietnamese) } ] (up to 6),
  "${kind === 'speaking' ? 'sample' : 'rewrite'}": string (${kind === 'speaking' ? 'a natural band 8 answer to the last question, 80-140 words' : 'the learner\'s weakest paragraph rewritten at band 8, keeping their ideas'})
}
Criteria to use: ${kind === 'task1' ? 'Task Achievement, Coherence and Cohesion, Lexical Resource, Grammatical Range and Accuracy' : kind === 'task2' ? 'Task Response, Coherence and Cohesion, Lexical Resource, Grammatical Range and Accuracy' : 'Fluency and Coherence, Lexical Resource, Grammatical Range and Accuracy (Pronunciation cannot be assessed from a transcript: do not include it)'}.`;

  async function call(prompt) {
    const key = await getKey();
    if (!key) throw new Error('NO_KEY');
    const pref = state.settings.aiModel;
    const models = pref ? [pref, ...MODELS.filter(m => m !== pref)] : MODELS;
    let lastErr = null;
    for (const m of models) {
      const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 60000);
      try {
        const r = await fetch(API(m, key), { method: 'POST', signal: ctrl.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYS }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.2, maxOutputTokens: 4096 },
        }) });
        clearTimeout(t);
        const j = await r.json().catch(() => ({}));
        if (r.status === 404) { lastErr = new Error('MODEL'); continue; } // mẫu này không còn → thử mẫu khác
        if (!r.ok) { const msg = (j.error && j.error.message) || r.statusText; throw new Error(r.status === 400 && /API key/i.test(msg) ? 'BAD_KEY' : r.status === 429 ? 'QUOTA' : msg); }
        const text = (((j.candidates || [])[0] || {}).content || { parts: [] }).parts.map(p => p.text || '').join('');
        const out = JSON.parse(text.replace(/^```(json)?|```$/g, '').trim());
        out._model = m;
        return out;
      } catch (e) { clearTimeout(t); if (['BAD_KEY', 'QUOTA', 'NO_KEY'].includes(e.message)) throw e; lastErr = e; }
    }
    throw lastErr || new Error('FAILED');
  }

  // kind: 'task1' | 'task2' | 'speaking'; task: đề bài (chuỗi); text: bài làm / bản chữ
  async function grade({ kind, task, text, extra = '' }) {
    const id = kind + ':' + hash(task + '|' + text);
    const cache = await Store.get('aiCache', {});
    if (cache[id]) return cache[id];
    const body = kind === 'speaking'
      ? `Assess this IELTS Speaking performance (machine transcript, punctuation may be missing). Questions and answers:\n${text}\n\n${SCHEMA(kind)}`
      : `IELTS Writing ${kind === 'task1' ? 'Task 1 (Academic)' : 'Task 2'} question:\n"""${task}"""\n${extra ? `Data for Task 1:\n${extra}\n` : ''}\nCandidate's response (${(text.match(/[A-Za-z][A-Za-z'’-]*/g) || []).length} words):\n"""${text}"""\n\n${SCHEMA(kind)}`;
    const res = await call(body);
    const keys = Object.keys(cache); if (keys.length >= 20) delete cache[keys[0]];
    cache[id] = { ...res, at: Date.now() };
    await Store.set('aiCache', cache);
    App.reward && App.reward({ aiGraded: 1, xp: 5 });
    return cache[id];
  }

  // ---------- Hướng dẫn lấy khóa ----------
  function keyDialog(onSaved) {
    modal(`<h2 style="margin-top:0">🤖 Bật chấm bài bằng AI</h2>
      <p class="small">Vocaband dùng <b>Google Gemini</b> để chấm Writing & Speaking chi tiết theo 4 tiêu chí IELTS. Mỗi người dùng tạo <b>khóa miễn phí</b> của riêng mình (gói miễn phí của Google đủ cho hàng chục bài mỗi ngày).</p>
      <ol class="small" style="padding-left:1.1rem;line-height:1.8"><li>Mở <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a> và đăng nhập Google.</li><li>Bấm <b>Create API key</b> → sao chép khóa (bắt đầu bằng “AIza…”).</li><li>Dán vào ô dưới đây.</li></ol>
      <input class="input" id="aiK" placeholder="AIza…" autocomplete="off" spellcheck="false">
      <p class="tiny muted">🔒 Khóa chỉ lưu trên trình duyệt này, không đồng bộ lên tài khoản và chỉ gửi tới Google khi bạn bấm chấm bài. Bài làm của bạn được gửi tới Google Gemini để chấm.</p>
      <div class="row" style="margin-top:.6rem"><button class="btn primary" id="aiSave">Lưu & kiểm tra</button><button class="btn ghost" data-close>Để sau</button></div><div id="aiMsg" class="small" style="margin-top:.5rem"></div>`);
    $('#aiSave').onclick = async () => {
      const k = $('#aiK').value.trim();
      if (!/^AIza[\w-]{20,}$/.test(k)) { $('#aiMsg').textContent = '⚠️ Khóa không đúng định dạng (bắt đầu bằng AIza…).'; return; }
      $('#aiMsg').textContent = '⏳ Đang kiểm tra khóa…';
      await Store.set('aiKey', k);
      try { await call('Return {"ok": true} as JSON.'); $('#aiMsg').textContent = '✅ Khóa hoạt động!'; setTimeout(() => { closeModal(); onSaved && onSaved(); }, 600); }
      catch (e) { $('#aiMsg').textContent = '❌ ' + errText(e); if (e.message === 'BAD_KEY') await Store.set('aiKey', ''); }
    };
  }
  const errText = e => ({ NO_KEY: 'Chưa có khóa AI.', BAD_KEY: 'Khóa không hợp lệ – kiểm tra lại.', QUOTA: 'Đã hết lượt miễn phí trong ngày/phút của khóa này – thử lại sau ít phút.', MODEL: 'Không tìm thấy mô hình AI phù hợp.' }[e.message] || ('Lỗi: ' + e.message));

  // ---------- Hiển thị kết quả ----------
  function render(r, kind) {
    const crit = (r.criteria || []).map(c => `<div class="ai-crit"><div class="row between nowrap"><b class="small">${esc(c.name)}</b><span class="ai-band">${esc(c.band)}</span></div><div class="small muted">${esc(c.comment || '')}</div></div>`).join('');
    const list = (t, a) => a && a.length ? `<div><b class="small">${t}</b><ul class="small" style="margin:.3rem 0;padding-left:1.1rem">${a.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '';
    return `<div class="ai-res">
      <div class="row nowrap" style="gap:1rem"><div class="ai-score">${esc(r.overall)}</div><div><b>Band ước tính bởi AI</b><div class="small">${esc(r.summary || '')}</div></div></div>
      <div class="ai-grid">${crit}</div>
      <div class="grid g2">${list('✅ Điểm mạnh', r.strengths)}${list('🎯 Cần cải thiện', r.improvements)}</div>
      ${r.errors && r.errors.length ? `<div><b class="small">✏️ Lỗi cần sửa</b>${r.errors.map(e => `<div class="ai-err"><span class="bad">${esc(e.quote)}</span> → <span class="good">${esc(e.fix)}</span><div class="tiny muted">${esc(e.why || '')}</div></div>`).join('')}</div>` : ''}
      ${r.vocab && r.vocab.length ? `<div style="margin-top:.6rem"><b class="small">💎 Nâng cấp từ vựng</b><div class="ai-vocab">${r.vocab.map(v => `<div><span class="muted">${esc(v.from)}</span> → <b>${esc(v.to)}</b><div class="tiny muted">${esc(v.note || '')}</div></div>`).join('')}</div></div>` : ''}
      ${r.rewrite || r.sample ? `<details style="margin-top:.6rem"><summary class="small"><b>${kind === 'speaking' ? '🗣️ Câu trả lời mẫu band 8' : '📝 Viết lại đoạn yếu nhất ở band 8'}</b></summary><div class="example-box small" style="margin-top:.4rem;white-space:pre-wrap">${esc(r.rewrite || r.sample)}</div>${r.sample || r.rewrite ? `<button class="ctx-say sm" data-saysent="${esc(r.rewrite || r.sample)}" title="Nghe">🔊</button>` : ''}</details>` : ''}
      <div class="tiny muted" style="margin-top:.5rem">Chấm bởi ${esc(r._model || 'Gemini')} – AI có thể sai sót, hãy dùng như một ý kiến tham khảo của giám khảo.</div></div>`;
  }

  // Gắn nút "Chấm chi tiết bằng AI" vào một vùng; getInput() trả về { kind, task, text, extra }
  function attach(box, getInput) {
    if (!box) return;
    const wrap = document.createElement('div'); wrap.className = 'card ai-box';
    wrap.innerHTML = `<div class="row between"><div><b>🤖 Chấm chi tiết bằng AI</b><div class="tiny muted">4 tiêu chí IELTS · chỉ ra lỗi & cách sửa · gợi ý từ vựng · bài mẫu</div></div><button class="btn primary sm" data-ai>Chấm bằng AI</button></div><div data-ai-out></div>`;
    box.appendChild(wrap);
    const go = async () => {
      const inp = getInput(); if (!inp || !inp.text || inp.text.split(/\s+/).length < 20) return toast('Bài quá ngắn để chấm (cần ≥ 20 từ)');
      if (!(await getKey())) return keyDialog(go);
      const out = $('[data-ai-out]', wrap), b = $('[data-ai]', wrap);
      b.disabled = true; out.innerHTML = '<div class="small muted" style="margin-top:.6rem">⏳ AI đang chấm bài (10–30 giây)…</div>';
      try { const r = await grade(inp); out.innerHTML = render(r, inp.kind); b.textContent = '↻ Chấm lại'; }
      catch (e) { out.innerHTML = `<div class="small" style="margin-top:.6rem">❌ ${esc(errText(e))} ${e.message === 'BAD_KEY' || e.message === 'NO_KEY' ? '<button class="btn sm" data-k>Nhập khóa</button>' : ''}</div>`; const k = $('[data-k]', out); if (k) k.onclick = () => keyDialog(go); }
      b.disabled = false;
    };
    $('[data-ai]', wrap).onclick = go;
  }

  // Phần cài đặt
  async function settingsHtml() {
    const k = await getKey();
    return `<div class="card"><h2>🤖 Chấm bài bằng AI</h2><p class="small muted">Dùng khóa Google Gemini miễn phí của bạn để chấm Writing & Speaking chi tiết. Khóa chỉ lưu trên máy này.</p>
      <div class="row"><span class="chip ${k ? 'ok' : ''}">${k ? '✓ Đã có khóa ' + esc(k.slice(0, 6)) + '…' : 'Chưa có khóa'}</span><button class="btn sm" id="aiSet">${k ? 'Đổi khóa' : 'Thêm khóa'}</button>${k ? '<button class="btn sm ghost" id="aiDel">Xóa khóa</button>' : ''}</div>
      <label class="field" style="margin-top:.6rem"><span class="small">Mô hình</span><select class="input" id="aiModel">${['', ...MODELS].map(m => `<option value="${m}" ${(state.settings.aiModel || '') === m ? 'selected' : ''}>${m || 'Tự động (khuyên dùng)'}</option>`).join('')}</select></label></div>`;
  }
  function bindSettings(rerender) {
    const s = $('#aiSet'); if (s) s.onclick = () => keyDialog(rerender);
    const d = $('#aiDel'); if (d) d.onclick = async () => { await Store.set('aiKey', ''); toast('Đã xóa khóa AI'); rerender(); };
    const m = $('#aiModel'); if (m) m.onchange = () => { state.settings.aiModel = m.value; App.saveSettings(); };
  }

  window.AI = { grade, attach, keyDialog, settingsHtml, bindSettings };
})();
