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

  // Khóa AI dùng chung giữa web app và add-on trên cùng máy (qua cầu nối cục bộ, không lên cloud)
  const bridge = () => window.VBBridge && VBBridge.ready() ? VBBridge : null;
  async function getKey() {
    let k = await Store.get('aiKey', '');
    if (!k && bridge()) { try { const r = await bridge().call('aiKeyGet'); const rk = r && r.data && r.data.aiKey; if (rk) { k = rk; await Store.set('aiKey', k); } } catch (e) { /* add-on cũ */ } }
    return k;
  }
  const setKey = async k => { await Store.set('aiKey', k); if (bridge()) try { await bridge().call('aiKeySet', { aiKey: k }); } catch (e) { /* bỏ qua */ } };
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

  // Tự dò danh sách mô hình Gemini hiện có (Google hay đổi/ngừng mô hình cũ) – lưu 3 ngày
  async function discover(key) {
    const c = await Store.get('aiModels', null);
    if (c && c.k === key.slice(-6) && Date.now() - c.at < 3 * 864e5 && c.list.length) return c.list;
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${encodeURIComponent(key)}`);
      if (!r.ok) return MODELS;
      const j = await r.json();
      const ver = n => parseFloat((n.match(/gemini-(\d+(?:\.\d+)?)/) || [0, 0])[1]);
      const list = (j.models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
        .map(m => m.name.replace(/^models\//, ''))
        .filter(n => /^gemini-[\d.]+-flash/.test(n) && !/image|tts|live|audio|embed|exp|thinking/.test(n))
        .sort((x, y) => ver(y) - ver(x) || (/preview/.test(x) - /preview/.test(y)) || (/lite/.test(x) - /lite/.test(y)));
      const out = [...new Set([...list.slice(0, 4), ...MODELS])];
      await Store.set('aiModels', { k: key.slice(-6), at: Date.now(), list: out });
      return out;
    } catch (e) { return MODELS; }
  }

  // AI có sẵn trong Chrome (Gemini Nano, chạy trên máy): miễn phí, không cần khóa, không gửi bài đi đâu
  const LMapi = () => self.LanguageModel || null;
  const LMopts = { expectedInputs: [{ type: 'text', languages: ['en'] }], expectedOutputs: [{ type: 'text', languages: ['en'] }] };
  async function nanoStatus() { try { return LMapi() ? await LMapi().availability(LMopts) : 'none'; } catch (e) { return 'none'; } }
  let nanoProgress = null;
  async function callNano(prompt) {
    const s = await LMapi().create({ ...LMopts, initialPrompts: [{ role: 'system', content: SYS.replace(/Write all comments[^.]*\./, 'Write all comments in clear, simple English.') }],
      monitor(m) { m.addEventListener('downloadprogress', e => nanoProgress && nanoProgress(e.loaded)); } });
    try {
      const out = await s.prompt(prompt.replace(/\(Vietnamese[^)]*\)/g, '(English)').replace(/Vietnamese/g, 'English') + '\nReturn only JSON.');
      const j = JSON.parse(String(out).replace(/^[^{]*/, '').replace(/[^}]*$/, ''));
      j._model = 'Gemini Nano (' + t('AI trên máy') + ')';
      return await toVietnamese(j);
    } finally { try { s.destroy(); } catch (e) { /* bỏ qua */ } }
  }
  // Dịch các trường nhận xét sang tiếng Việt (một lần gọi dịch cho cả bài)
  const VI_KEYS = new Set(['summary', 'strengths', 'improvements', 'comment', 'why', 'note', 'meaning', 'explain', 'grammar', 'tip']);
  async function toVietnamese(obj) {
    const slots = [];
    const walk = (o, inVi) => { if (Array.isArray(o)) o.forEach((x, i) => typeof x === 'string' ? inVi && slots.push([o, i]) : walk(x, inVi)); else if (o && typeof o === 'object') Object.keys(o).forEach(k => typeof o[k] === 'string' ? VI_KEYS.has(k) && slots.push([o, k]) : walk(o[k], VI_KEYS.has(k))); };
    walk(obj, false);
    (obj.examples || []).forEach(e => { if (e && e.en) slots.push([e, 'vi', e.en]); });
    if (!slots.length || !window.Dict) return obj;
    const src = slots.map(([o, k, en]) => String(en || o[k]).replace(/\n/g, ' '));
    const vi = (await Dict.translateVi(src.join('\n'))).split('\n');
    slots.forEach(([o, k], i) => { if (vi[i]) o[k] = vi[i].trim(); });
    return obj;
  }

  async function call(prompt) {
    const key = await getKey();
    if (!key) {
      const st = await nanoStatus();
      if (st !== 'none' && st !== 'unavailable') return callNano(prompt);
      throw new Error('NO_KEY');
    }
    const pref = state.settings.aiModel;
    const found = await discover(key);
    const models = pref ? [pref, ...found.filter(m => m !== pref)] : found;
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
        if (r.status === 404) { lastErr = new Error('MODEL'); await Store.set('aiModels', null); continue; } // mô hình đã bị ngừng → dò lại lần sau
        if (!r.ok) { const msg = (j.error && j.error.message) || r.statusText; throw new Error(r.status === 400 && /API key/i.test(msg) ? 'BAD_KEY' : r.status === 429 ? 'QUOTA' : msg); }
        const text = (((j.candidates || [])[0] || {}).content || { parts: [] }).parts.map(p => p.text || '').join('');
        const out = JSON.parse(text.replace(/^```(json)?|```$/g, '').trim());
        out._model = m;
        return out;
      } catch (e) { clearTimeout(t); if (['BAD_KEY', 'NO_KEY'].includes(e.message)) throw e; if (e.message === 'QUOTA') { const st = await nanoStatus(); if (st !== 'none' && st !== 'unavailable') return callNano(prompt); throw e; } lastErr = e; }
    }
    // Hết mô hình trên mạng → thử AI trên máy trước khi báo lỗi
    const st = await nanoStatus(); if (st !== 'none' && st !== 'unavailable') return callNano(prompt);
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
    modal(`<h2 style="margin-top:0">🤖 ${t('Bật chấm bài bằng AI')}</h2>
      <p class="small" style="background:var(--primary-soft);padding:.5rem .7rem;border-radius:10px">💡 ${t('Trên <b>Chrome máy tính bản mới</b> (máy đủ mạnh), Vocaband dùng được <b>AI có sẵn trong Chrome</b> – miễn phí, không cần khóa. Trình duyệt này chưa hỗ trợ, nên bạn có thể dùng khóa Gemini miễn phí dưới đây (chất lượng chấm tốt hơn).')}</p>
      <p class="small">${t('Vocaband dùng <b>Google Gemini</b> để chấm Writing & Speaking chi tiết theo 4 tiêu chí IELTS. Mỗi người dùng tạo <b>khóa miễn phí</b> của riêng mình (gói miễn phí của Google đủ cho hàng chục bài mỗi ngày).')}</p>
      <ol class="small" style="padding-left:1.1rem;line-height:1.8"><li>${t('Mở {link} và đăng nhập Google.', { link: '<a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a>' })}</li><li>${t('Bấm <b>Create API key</b> → sao chép khóa (bắt đầu bằng “AIza…”).')}</li><li>${t('Dán vào ô dưới đây.')}</li></ol>
      <input class="input" id="aiK" placeholder="AIza…" autocomplete="off" spellcheck="false">
      <p class="tiny muted">🔒 ${t('Khóa chỉ lưu trên trình duyệt này, không đồng bộ lên tài khoản và chỉ gửi tới Google khi bạn bấm chấm bài. Bài làm của bạn được gửi tới Google Gemini để chấm.')}</p>
      <div class="row" style="margin-top:.6rem"><button class="btn primary" id="aiSave">${t('Lưu & kiểm tra')}</button><button class="btn ghost" data-close>${t('Để sau')}</button></div><div id="aiMsg" class="small" style="margin-top:.5rem"></div>`);
    $('#aiSave').onclick = async () => {
      const k = $('#aiK').value.trim();
      if (!/^AIza[\w-]{20,}$/.test(k)) { $('#aiMsg').textContent = '⚠️ ' + t('Khóa không đúng định dạng (bắt đầu bằng AIza…).'); return; }
      $('#aiMsg').textContent = '⏳ ' + t('Đang kiểm tra khóa…');
      await setKey(k);
      try { await call('Return {"ok": true} as JSON.'); $('#aiMsg').textContent = '✅ ' + t('Khóa hoạt động!'); setTimeout(() => { closeModal(); onSaved && onSaved(); }, 600); }
      catch (e) { $('#aiMsg').textContent = '❌ ' + errText(e); if (e.message === 'BAD_KEY') await setKey(''); }
    };
  }
  const errText = e => ({ NO_KEY: t('Chưa có khóa AI.'), BAD_KEY: t('Khóa không hợp lệ – kiểm tra lại.'), QUOTA: t('Đã hết lượt miễn phí trong ngày/phút của khóa này – thử lại sau ít phút.'), MODEL: t('Không tìm thấy mô hình AI phù hợp.') }[e.message] || t('Lỗi: {msg}', { msg: e.message }));

  // ---------- Hiển thị kết quả ----------
  function render(r, kind) {
    const crit = (r.criteria || []).map(c => `<div class="ai-crit"><div class="row between nowrap"><b class="small">${esc(c.name)}</b><span class="ai-band">${esc(c.band)}</span></div><div class="small muted">${esc(c.comment || '')}</div></div>`).join('');
    const list = (title, a) => a && a.length ? `<div><b class="small">${title}</b><ul class="small" style="margin:.3rem 0;padding-left:1.1rem">${a.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '';
    return `<div class="ai-res">
      <div class="row nowrap" style="gap:1rem"><div class="ai-score">${esc(r.overall)}</div><div><b>${t('Band ước tính bởi AI')}</b><div class="small">${esc(r.summary || '')}</div></div></div>
      <div class="ai-grid">${crit}</div>
      <div class="grid g2">${list('✅ ' + t('Điểm mạnh'), r.strengths)}${list('🎯 ' + t('Cần cải thiện'), r.improvements)}</div>
      ${r.errors && r.errors.length ? `<div><b class="small">✏️ ${t('Lỗi cần sửa')}</b>${r.errors.map(e => `<div class="ai-err"><span class="bad">${esc(e.quote)}</span> → <span class="good">${esc(e.fix)}</span><div class="tiny muted">${esc(e.why || '')}</div></div>`).join('')}</div>` : ''}
      ${r.vocab && r.vocab.length ? `<div style="margin-top:.6rem"><b class="small">💎 ${t('Nâng cấp từ vựng')}</b><div class="ai-vocab">${r.vocab.map(v => `<div><span class="muted">${esc(v.from)}</span> → <b>${esc(v.to)}</b><div class="tiny muted">${esc(v.note || '')}</div></div>`).join('')}</div></div>` : ''}
      ${r.rewrite || r.sample ? `<details style="margin-top:.6rem"><summary class="small"><b>${kind === 'speaking' ? '🗣️ ' + t('Câu trả lời mẫu band 8') : '📝 ' + t('Viết lại đoạn yếu nhất ở band 8')}</b></summary><div class="example-box small" style="margin-top:.4rem;white-space:pre-wrap">${esc(r.rewrite || r.sample)}</div>${r.sample || r.rewrite ? `<button class="ctx-say sm" data-saysent="${esc(r.rewrite || r.sample)}" title="${t('Nghe')}">🔊</button>` : ''}</details>` : ''}
      <div class="tiny muted" style="margin-top:.5rem">${t('Chấm bởi {model} – AI có thể sai sót, hãy dùng như một ý kiến tham khảo của giám khảo.', { model: esc(r._model || 'Gemini') })}</div></div>`;
  }

  // Gắn nút "Chấm chi tiết bằng AI" vào một vùng; getInput() trả về { kind, task, text, extra }
  function attach(box, getInput) {
    if (!box) return;
    const wrap = document.createElement('div'); wrap.className = 'card ai-box';
    wrap.innerHTML = `<div class="row between"><div><b>🤖 ${t('Chấm chi tiết bằng AI')}</b><div class="tiny muted">${t('4 tiêu chí IELTS · chỉ ra lỗi & cách sửa · gợi ý từ vựng · bài mẫu')}</div></div><button class="btn primary sm" data-ai>${t('Chấm bằng AI')}</button></div><div data-ai-out></div>`;
    box.appendChild(wrap);
    const go = async () => {
      const inp = getInput(); if (!inp || !inp.text || inp.text.split(/\s+/).length < 20) return toast(t('Bài quá ngắn để chấm (cần ≥ 20 từ)'));
      if (!(await getKey())) { const st = await nanoStatus(); if (st === 'none' || st === 'unavailable') return keyDialog(go); }
      const out = $('[data-ai-out]', wrap), b = $('[data-ai]', wrap);
      b.disabled = true; out.innerHTML = '<div class="small muted" style="margin-top:.6rem">⏳ ' + t('AI đang chấm bài (10–30 giây)…') + '</div>';
      nanoProgress = p => { out.innerHTML = `<div class="small muted" style="margin-top:.6rem">⬇️ ${t('Chrome đang tải AI trên máy lần đầu ({pct}%) – chỉ tải một lần…', { pct: Math.round(p * 100) })}</div>`; };
      try { const r = await grade(inp); out.innerHTML = render(r, inp.kind); b.textContent = '↻ ' + t('Chấm lại'); }
      catch (e) { out.innerHTML = `<div class="small" style="margin-top:.6rem">❌ ${esc(errText(e))} ${e.message === 'BAD_KEY' || e.message === 'NO_KEY' ? `<button class="btn sm" data-k>${t('Nhập khóa')}</button>` : ''}</div>`; const k = $('[data-k]', out); if (k) k.onclick = () => keyDialog(go); }
      b.disabled = false;
    };
    $('[data-ai]', wrap).onclick = go;
  }

  // Phần cài đặt
  async function settingsHtml() {
    const k = await getKey();
    const ns = await nanoStatus();
    const nano = ns === 'available' ? '✅ ' + t('Sẵn sàng') : ns === 'downloadable' || ns === 'downloading' ? '⬇️ ' + t('Sẽ tự tải khi dùng lần đầu') : '— ' + t('Trình duyệt chưa hỗ trợ');
    return `<div class="card"><h2>🤖 ${t('Chấm bài bằng AI')}</h2><div class="small" style="margin-bottom:.5rem">${t('AI có sẵn trong Chrome (miễn phí, không cần khóa):')} <b>${nano}</b></div><p class="small muted">${t('Dùng khóa Google Gemini miễn phí của bạn để chấm Writing & Speaking chi tiết. Khóa chỉ lưu trên máy này.')}</p>
      <div class="row"><span class="chip ${k ? 'ok' : ''}">${k ? '✓ ' + t('Đã có khóa {key}…', { key: esc(k.slice(0, 6)) }) : t('Chưa có khóa')}</span><button class="btn sm" id="aiSet">${k ? t('Đổi khóa') : t('Thêm khóa')}</button>${k ? `<button class="btn sm ghost" id="aiDel">${t('Xóa khóa')}</button>` : ''}</div>
      <label class="field" style="margin-top:.6rem"><span class="small">${t('Mô hình')}</span><select class="input" id="aiModel">${['', ...MODELS].map(m => `<option value="${m}" ${(state.settings.aiModel || '') === m ? 'selected' : ''}>${m || t('Tự động (khuyên dùng)')}</option>`).join('')}</select></label></div>`;
  }
  function bindSettings(rerender) {
    const s = $('#aiSet'); if (s) s.onclick = () => keyDialog(rerender);
    const d = $('#aiDel'); if (d) d.onclick = async () => { await setKey(''); toast(t('Đã xóa khóa AI')); rerender(); };
    const m = $('#aiModel'); if (m) m.onchange = () => { state.settings.aiModel = m.value; App.saveSettings(); };
  }

  // Giải thích sâu một cụm/câu trong ngữ cảnh (nghĩa, cấu trúc, ngữ pháp, collocation, ví dụ)
  async function explain(text, sentence) {
    const id = 'ex:' + hash(text + '|' + (sentence || ''));
    const cache = await Store.get('aiCache', {});
    if (cache[id]) return cache[id];
    const r = await call(`Explain the English expression for a Vietnamese IELTS learner. Expression: "${text}"${sentence && sentence !== text ? `\nSentence it appears in: "${sentence}"` : ''}
Return ONLY JSON: {"meaning": string (Vietnamese meaning in THIS context), "structure": [{"pattern": string, "explain": string (Vietnamese)}] (1-3), "grammar": string (Vietnamese), "collocations": [string] (3-5), "examples": [{"en": string, "vi": string}] (2, IELTS style), "tip": string (Vietnamese: how to use it in IELTS Writing/Speaking)}`);
    const keys = Object.keys(cache); if (keys.length >= 20) delete cache[keys[0]];
    cache[id] = r; await Store.set('aiCache', cache);
    return r;
  }
  function renderExplain(x) {
    return `<div class="ai-ex"><b>🤖 ${t('Giải thích sâu')}</b>
      ${x.meaning ? `<div class="small"><b>${t('Nghĩa trong ngữ cảnh:')}</b> ${esc(x.meaning)}</div>` : ''}
      ${(x.structure || []).map(y => `<div class="small" style="margin-top:.3rem"><b style="color:var(--primary)">${esc(y.pattern)}</b> – ${esc(y.explain)}</div>`).join('')}
      ${x.grammar ? `<div class="small" style="margin-top:.3rem"><b>${t('Ngữ pháp:')}</b> ${esc(x.grammar)}</div>` : ''}
      ${(x.collocations || []).length ? `<div class="row" style="margin-top:.3rem;gap:.25rem">${x.collocations.map(c => `<span class="chip">${esc(c)}</span>`).join('')}</div>` : ''}
      ${(x.examples || []).map(e => `<div class="small" style="margin-top:.35rem">“${esc(e.en)}” <button class="ctx-say sm" data-saysent="${esc(e.en)}">🔊</button><div class="muted">${esc(e.vi)}</div></div>`).join('')}
      ${x.tip ? `<div class="small" style="margin-top:.35rem">💡 ${esc(x.tip)}</div>` : ''}</div>`;
  }

  window.AI = { ask: p => call(p), nanoStatus, explain, renderExplain, errText: e => errText(e), getKey, grade, attach, keyDialog, settingsHtml, bindSettings };
})();
