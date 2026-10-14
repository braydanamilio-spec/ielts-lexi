(async () => {
  const { Store, Cards, Stats, DEFAULT_SETTINGS, todayKey } = Core;
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Mở ứng dụng: dùng lại tab Vocaband đang mở (không mở thêm tab), chờ Chrome mở xong rồi mới đóng popup
  const open = async hash => {
    const base = chrome.runtime.getURL('app/index.html');
    try {
      const [tab] = await chrome.tabs.query({ url: base + '*' });
      if (tab) { await chrome.tabs.update(tab.id, { url: base + hash, active: true }); await chrome.windows.update(tab.windowId, { focused: true }); }
      else await chrome.tabs.create({ url: base + hash });
    } catch (e) { await chrome.tabs.create({ url: base + hash }).catch(() => {}); }
    window.close();
  };

  const settings = { ...DEFAULT_SETTINGS, ...(await Store.get('settings', {})) };
  const [cards, stats] = await Promise.all([Cards.all(), Stats.get()]);
  const { total } = Cards.dueCount(cards, settings, stats);
  const done = stats.days[todayKey()] || 0;
  $('#due').textContent = total;
  $('#streak').textContent = `🔥 ${Stats.streak(stats)}`;
  $('#goalTxt').textContent = `${done}/${settings.dailyGoal}`;
  $('#goalBar').style.width = Math.min(100, done / settings.dailyGoal * 100) + '%';
  $('#review').onclick = () => open(total ? '#/review' : '#/library');
  // Chi tiết thẻ cần học: ôn lại / từ mới (như Anki) – biết rõ hôm nay cần làm gì
  const { due, newCount } = Cards.dueCount(cards, settings, stats);
  $('#dueChips').innerHTML = `<span class="pp-chip">🔁 ${due} ôn lại</span><span class="pp-chip">✨ ${newCount} từ mới</span>`;
  if (!total) $('#review').textContent = 'Thêm từ mới →';
  // Từ vừa lưu gần đây: nhìn lại nhanh, bấm để xem chi tiết
  const recent = Object.values(cards).filter(c => c.added).sort((a, b) => b.added - a.added).slice(0, 5);
  if (recent.length) {
    $('#recent').innerHTML = `<div class="pp-sec">🕘 Vừa lưu gần đây</div>${recent.map(c => `<a href="#" class="pp-word" data-w="${esc(c.word)}"><b>${esc(c.word)}</b><span>${esc(String(c.vi || '').split(/[,;]/)[0])}</span></a>`).join('')}`;
    document.querySelectorAll('.pp-word').forEach(a => a.onclick = e => { e.preventDefault(); open('#/dict/' + encodeURIComponent(a.dataset.w)); });
  }
  $('#open').onclick = e => { e.preventDefault(); open('#/home'); };
  // Trạng thái đồng bộ tài khoản (liên kết qua web app vocaband.web.app)
  const { linked } = await chrome.storage.local.get('linked');
  const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? "vừa xong" : m < 60 ? `${m} phút trước` : m < 1440 ? `${Math.round(m / 60)} giờ trước` : `${Math.round(m / 1440)} ngày trước`; };
  $('#syncRow').innerHTML = linked && linked.email
    ? `<span>☁️ Đồng bộ với <b>${esc(linked.email)}</b> · ${ago(linked.at)}</span><a href="#" id="syncNow">Đồng bộ ngay</a>`
    : `<span>⚠️ Chưa đồng bộ tài khoản – dữ liệu chỉ ở máy này</span><a href="#" id="syncNow" class="strong">☁️ Đồng bộ với Google</a>`;
  $('#syncNow').onclick = async e => {
    e.preventDefault();
    if (!linked || !linked.email) { chrome.tabs.create({ url: 'https://vocaband.web.app/#/settings' }); return window.close(); }
    // Đã liên kết: mở Vocaband ở tab nền để gộp dữ liệu với tài khoản, xong tự đóng – không làm phiền
    const a = $('#syncNow'); a.textContent = '⏳ Đang đồng bộ…'; a.style.pointerEvents = 'none';
    const r = await chrome.runtime.sendMessage({ type: 'syncNow' }).catch(() => null);
    a.textContent = r && r.ok ? '✓ Đã đồng bộ' : 'Thử lại'; a.style.pointerEvents = '';
    if (r && r.ok) setTimeout(() => location.reload(), 800);
  };

  $('#dbl').checked = settings.dblclickOn !== false;
  $('#selMode').value = settings.selectMode || 'icon';
  $('#selMode').onchange = async e => { settings.selectMode = e.target.value; await Store.set('settings', settings); };
  $('#markK').checked = settings.markKnown !== false;
  $('#markK').onchange = async e => { settings.markKnown = e.target.checked; await Store.set('settings', settings); };
  $('#dbl').onchange = async e => { settings.dblclickOn = e.target.checked; await Store.set('settings', settings); };

  const speak = (w, url) => {
    if (url) return new Audio(url).play().catch(() => {});
    const u = new SpeechSynthesisUtterance(w); u.lang = settings.accent; speechSynthesis.speak(u);
  };

  $('#f').onsubmit = async ev => {
    ev.preventDefault();
    const q = $('#q').value.trim();
    if (!q) return;
    $('#res').innerHTML = '<div class="card muted small">⏳ Đang tra…</div>';
    const e = await Dict.lookup(q);
    if (!e || !e.found) { $('#res').innerHTML = `<div class="card muted small">Không tìm thấy “${esc(q)}”.${e && e.vi ? ` Dịch: <b>${esc(e.vi)}</b>` : ''}</div>`; return; }
    const saved = !!(await Cards.all())[e.word];
    $('#res').innerHTML = `<div class="card"><div class="row" style="align-items:flex-start;flex-wrap:nowrap">
      <div class="pic">${e.image ? `<img src="${esc(e.image)}" alt="">` : esc(e.emoji || '📘')}</div>
      <div><div class="row"><span class="entry-word">${esc(e.word)}</span>${e.pos ? `<span class="chip pos">${esc(e.pos)}</span>` : ''}${e.level ? `<span class="chip lv">${esc(e.level)}</span>` : ''}</div>
        <div class="row"><span class="ipa">${esc(e.ipa)}</span><button class="icon-btn" id="spk">🔊</button></div>
        <div class="vi">${esc(e.vi)}</div>
        <div class="small">${esc(e.def)}</div></div></div>
      <div class="row" style="margin-top:10px"><button class="btn sm primary" id="save" ${saved ? 'disabled' : ''}>${saved ? '✓ Đã có' : '+ Lưu flashcard'}</button><button class="btn sm" id="more">Chi tiết</button></div></div>`;
    $('#spk').onclick = () => speak(e.word, settings.accent === 'en-US' ? e.audioUS : e.audio);
    $('#more').onclick = () => open('#/dict/' + encodeURIComponent(e.word));
    $('#save').onclick = async () => { await Cards.add(e); $('#save').textContent = '✓ Đã lưu'; $('#save').disabled = true; };
  };
})();
