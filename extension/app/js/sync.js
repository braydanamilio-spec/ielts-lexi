/* Tài khoản & đồng bộ đám mây (Firebase Auth + Firestore).
 * Dữ liệu lưu ở users/{uid}/data/{meta|cards_0..n}; gộp 2 chiều theo hoạt động gần nhất.
 */
(function () {
  const { Store, Cards } = Core;
  const { $, esc, toast } = UI;
  const App = window.App;
  const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
  const CHUNK = 150; // giữ mỗi tài liệu < 1 MiB kể cả khi thẻ có nhiều ngữ cảnh

  const Sync = { user: null, status: 'idle', lastSync: 0 };
  window.Sync = Sync;
  let fb = null, db = null, timer = null, box = null;

  const supported = !Store.isExtension && !Store.sandbox && window.FIREBASE_CONFIG && location.protocol.startsWith('http');

  function loadScript(src) {
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  }
  async function init() {
    if (!supported || fb) return;
    await loadScript(SDK + 'firebase-app-compat.js');
    await Promise.all([loadScript(SDK + 'firebase-auth-compat.js'), loadScript(SDK + 'firebase-firestore-compat.js')]);
    fb = firebase.initializeApp(FIREBASE_CONFIG);
    db = firebase.firestore();
    firebase.auth().onAuthStateChanged(async u => {
      Sync.user = u; App.state.user = u ? { uid: u.uid, displayName: u.displayName, email: u.email, photoURL: u.photoURL } : null;
      App.updateChrome(); render();
      if (u) await pullMerge();
    });
  }

  // ---------- Gộp dữ liệu ----------
  const activity = c => Math.max(c.srs && c.srs.last || 0, c.added || 0, c.mod || 0);
  function mergeCards(a, b, deleted = {}) {
    const out = { ...a };
    for (const [k, c] of Object.entries(b)) {
      const mine = out[k];
      if (!mine) { out[k] = c; continue; }
      const remoteWins = activity(c) > activity(mine);
      const win = { ...(remoteWins ? c : mine) };
      const lose = remoteWins ? mine : c;
      win.contexts = [...(win.contexts || []), ...(lose.contexts || []).filter(x => !(win.contexts || []).some(y => y.text === x.text))].slice(0, 5);
      out[k] = win;
    }
    // Thẻ đã xóa (ở bất kỳ thiết bị nào) sau lần hoạt động cuối → bỏ
    for (const [k, t] of Object.entries(deleted)) if (out[k] && activity(out[k]) < t) delete out[k];
    return out;
  }
  function mergeStats(a, b) {
    const days = { ...a.days };
    for (const [k, v] of Object.entries(b.days || {})) days[k] = Math.max(days[k] || 0, v);
    const nt = (a.newToday && b.newToday && a.newToday.day === b.newToday.day) ? { day: a.newToday.day, n: Math.max(a.newToday.n, b.newToday.n) } : (a.newToday && a.newToday.day > (b.newToday || {}).day ? a.newToday : b.newToday || a.newToday);
    return { days, newToday: nt };
  }
  function mergeGame(a, b) {
    if (!b) return a; if (!a) return b;
    const days = { ...a.days };
    for (const [k, v] of Object.entries(b.days || {})) { days[k] = { ...(days[k] || {}) }; for (const [m, n] of Object.entries(v)) days[k][m] = Math.max(days[k][m] || 0, n); }
    const total = { ...a.total }; for (const [m, n] of Object.entries(b.total || {})) total[m] = Math.max(total[m] || 0, n);
    const best = { ...a.best }; if (b.best && b.best.match) best.match = Math.min(best.match || 1e9, b.best.match);
    const unitDone = { ...(b.unitDone || {}) };
    for (const [k, v] of Object.entries(a.unitDone || {})) unitDone[k] = Math.max(unitDone[k] || 0, v);
    return { ...a, xp: Math.max(a.xp || 0, b.xp || 0), days, total, best, unitDone, badges: { ...b.badges, ...a.badges }, readDone: { ...(b.readDone || {}), ...(a.readDone || {}) }, questsDone: { ...(b.questsDone || {}), ...(a.questsDone || {}) } };
  }

  const ref = () => db.collection('users').doc(Sync.user.uid).collection('data');

  // ---------- Cầu nối với add-on Chrome (cùng máy) ----------
  let extReady = false;
  window.addEventListener('message', e => { if (e.source === window && e.data && e.data.vbBridge === 'hello') extReady = true; });
  const extCall = (op, data) => new Promise(res => {
    if (!extReady) return res(null);
    const id = Math.random().toString(36).slice(2);
    const on = e => { if (e.source === window && e.data && e.data.vbBridge === 'res' && e.data.id === id) { window.removeEventListener('message', on); res(e.data); } };
    window.addEventListener('message', on);
    window.postMessage({ vbBridge: 'req', op, id, data }, location.origin);
    setTimeout(() => { window.removeEventListener('message', on); res(null); }, 3000);
  });
  // Gộp từ đã lưu bằng add-on vào tài khoản, rồi trả lại bản gộp cho add-on
  async function syncExtension() {
    if (!Sync.user) return false;
    const r = await extCall('get');
    if (!r || !r.data) return false;
    const ext = r.data;
    const deleted = { ...(await Store.get('deleted', {})) };
    for (const [k, t] of Object.entries(ext.deleted || {})) deleted[k] = Math.max(deleted[k] || 0, t);
    const merged = mergeCards(await Cards.all(), ext.cards || {}, deleted);
    await Store.set('deleted', deleted);
    await Cards.save(merged);
    await extCall('set', { cards: await Cards.all(), deleted });
    return Object.keys(ext.cards || {}).length;
  }
  Sync.syncExtension = syncExtension;

  // Thẻ thuộc thư viện có sẵn: chỉ lưu phần riêng của người học (lịch ôn, ngữ cảnh, ghi chú…)
  const LIB_FIELDS = ['ipa', 'pos', 'vi', 'def', 'ex', 'col', 'syn', 'level', 'emoji', 'topic'];
  function slim(c) {
    const lib = IELTS_DATA.INDEX[c.word.toLowerCase()];
    const o = { ...c };
    delete o.sentences; delete o.ipaUS; // tra lại được khi cần
    if (lib) {
      for (const k of LIB_FIELDS) if (JSON.stringify(o[k]) === JSON.stringify(lib[k])) delete o[k];
      o.L = 1;
    }
    if (!o.contexts || !o.contexts.length) delete o.contexts;
    if (!o.note) delete o.note;
    if (!o.image) delete o.image;
    if (!o.audio) delete o.audio;
    return o;
  }
  function fat(o) {
    const lib = o.L ? IELTS_DATA.INDEX[o.word.toLowerCase()] : null;
    const c = { ...Cards.make(lib || o), ...o };
    delete c.L;
    c.contexts = c.contexts || [];
    return c;
  }
  const hash = str => { let h = 0; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0; return h + ':' + str.length; };
  let sentHashes = {};

  async function pullMerge() {
    setStatus('syncing');
    try {
      const snap = await ref().get();
      const docs = {}; snap.forEach(d => { docs[d.id] = d.data(); });
      // Đăng nhập tài khoản khác với lần trước → hỏi trước khi gộp dữ liệu trên máy vào
      const lastUid = await Store.get('lastUid', '');
      if (lastUid && lastUid !== Sync.user.uid && Object.keys(await Cards.all()).length) {
        const keep = confirm('Máy này đang có dữ liệu học của tài khoản khác.\n\nOK = gộp dữ liệu trên máy vào tài khoản này\nHủy = chỉ dùng dữ liệu của tài khoản này');
        if (!keep) { await Store.set('cards', {}); await Store.set('stats', { days: {}, newToday: { day: '', n: 0 } }); await Store.set('game', null); await Store.set('deleted', {}); }
      }
      await Store.set('lastUid', Sync.user.uid);
      const local = { cards: await Cards.all(), stats: await Core.Stats.get(), game: await Game.get(), settings: await Store.get('settings', {}), deleted: await Store.get('deleted', {}) };
      if (docs.meta) {
        let remoteCards = {};
        for (let i = 0; i < (docs.meta.chunks || 0); i++) if (docs['cards_' + i]) {
          const part = JSON.parse(docs['cards_' + i].json || '{}');
          for (const [k, v] of Object.entries(part)) remoteCards[k] = fat(v);
          sentHashes['cards_' + i] = hash(docs['cards_' + i].json || '');
        }
        const remote = JSON.parse(docs.meta.json || '{}');
        const deleted = { ...(remote.deleted || {}) };
        for (const [k, t] of Object.entries(local.deleted)) deleted[k] = Math.max(deleted[k] || 0, t);
        await Store.set('deleted', deleted);
        await Cards.save(mergeCards(local.cards, remoteCards, deleted));
        await Store.set('stats', mergeStats(local.stats, remote.stats || { days: {} }));
        await Store.set('game', mergeGame(local.game, remote.game));
        // Cài đặt: ưu tiên bản mới sửa gần nhất
        if (remote.settings && (remote.settingsAt || 0) > (await Store.get('settingsAt', 0))) { await Store.set('settings', remote.settings); await Store.set('settingsAt', remote.settingsAt); }
        await syncExtension();
        await App.load();
        // Chỉ vẽ lại các trang tổng quan – không làm gián đoạn bài ôn/luyện đang làm
        if (/^#\/(home|deck|library|stats|settings|path)?(\?|$)/.test(location.hash || '#/')) App.route();
      }
      if (!docs.meta) { await syncExtension(); await App.load(); }
      await push();
      toast(docs.meta ? '☁️ Đã đồng bộ dữ liệu học' + (extReady ? ' (kể cả add-on)' : '') : '☁️ Đã sao lưu dữ liệu lên tài khoản');
    } catch (e) { console.warn('sync', e); setStatus('error', e.message); }
  }

  async function push() {
    if (!Sync.user || !db) return;
    setStatus('syncing');
    try {
      const cards = await Cards.all();
      const keys = Object.keys(cards).sort();
      const chunks = Math.ceil(keys.length / CHUNK);
      const batch = db.batch();
      const pending = {};
      let writes = 0;
      for (let i = 0; i < chunks; i++) {
        const part = {}; keys.slice(i * CHUNK, (i + 1) * CHUNK).forEach(k => { part[k] = slim(cards[k]); });
        const json = JSON.stringify(part), h = hash(json);
        if (sentHashes['cards_' + i] === h) continue;
        if (json.length > 900000) console.warn('chunk lớn', i, json.length);
        batch.set(ref().doc('cards_' + i), { json }); pending['cards_' + i] = h; writes++;
      }
      const game = await Game.get();
      const meta = JSON.stringify({ stats: await Core.Stats.get(), game: { ...game, questsDone: {} }, settings: await Store.get('settings', {}), settingsAt: await Store.get('settingsAt', 0), deleted: await Store.get('deleted', {}) });
      const mh = hash(meta + chunks);
      if (sentHashes.meta !== mh) { batch.set(ref().doc('meta'), { chunks, updated: Date.now(), json: meta }); pending.meta = mh; writes++; }
      if (writes) await batch.commit();
      if (extReady) extCall('set', { cards: await Cards.all(), deleted: await Store.get('deleted', {}) });
      Object.assign(sentHashes, pending); // chỉ ghi nhận "đã gửi" khi commit thành công
      dirty = false;
      Sync.lastSync = Date.now();
      setStatus('ok');
    } catch (e) { console.warn('push', e); setStatus('error', e.message); }
  }

  let dirty = false;
  Sync.schedule = () => {
    if (!Sync.user) return;
    dirty = true;
    if (timer) return;
    timer = setTimeout(() => { timer = null; if (dirty) push(); }, 60000);
  };
  const flush = () => { if (Sync.user && dirty) { clearTimeout(timer); timer = null; push(); } };
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
  window.addEventListener('pagehide', flush);
  Sync.signIn = async () => {
    try {
      await init();
      const p = new firebase.auth.GoogleAuthProvider();
      p.setCustomParameters({ prompt: 'select_account' });
      await firebase.auth().signInWithPopup(p);
    } catch (e) {
      if (e && e.code === 'auth/popup-blocked') return firebase.auth().signInWithRedirect(new firebase.auth.GoogleAuthProvider());
      if (e && e.code !== 'auth/popup-closed-by-user') toast('Không đăng nhập được: ' + (e.message || e));
    }
  };
  Sync.signOut = async () => { await push(); sentHashes = {}; await firebase.auth().signOut(); toast('Đã đăng xuất – dữ liệu vẫn còn trên máy này'); };
  Sync.now = () => pullMerge();

  function setStatus(s, msg) { Sync.status = s; Sync.msg = msg || ''; render(); }

  // ---------- Giao diện trong Cài đặt ----------
  Sync.renderBox = el => { box = el; render(); };
  function render() {
    if (!box || !document.body.contains(box)) return;
    if (!supported) {
      box.innerHTML = `<h2>☁️ Tài khoản & đồng bộ</h2><p class="muted">Đăng nhập và đồng bộ có trên bản web <a href="https://vocaband.web.app" target="_blank" rel="noopener">vocaband.web.app</a>. Trong add-on, dùng <b>Xuất / Nhập sao lưu</b> để chuyển dữ liệu.</p>`;
      return;
    }
    const u = Sync.user;
    const st = { idle: '', syncing: '⏳ Đang đồng bộ…', ok: `✓ Đã đồng bộ lúc ${new Date(Sync.lastSync).toLocaleTimeString('vi-VN')}`, error: `⚠️ Lỗi đồng bộ: ${esc(Sync.msg)}` }[Sync.status];
    box.innerHTML = u ? `
      <div class="row between"><div class="row nowrap"><span class="avatar">${u.photoURL ? `<img src="${esc(u.photoURL)}" alt="" referrerpolicy="no-referrer">` : esc((u.displayName || u.email || '?')[0])}</span>
        <div><b>${esc(u.displayName || 'Bạn')}</b><div class="small muted">${esc(u.email || '')}</div></div></div>
        <div class="row"><button class="btn sm" id="syncNow">🔄 Đồng bộ ngay</button><button class="btn sm ghost" id="signOut">Đăng xuất</button></div></div>
      <div class="small muted">${st || 'Dữ liệu học được tự động sao lưu và đồng bộ giữa các thiết bị.'}</div>`
      : `<div class="row between"><div><h2 style="margin:0">☁️ Đăng nhập để không mất dữ liệu</h2><p class="muted small">Sao lưu flashcard, XP, chuỗi ngày học và học tiếp trên mọi thiết bị.</p></div>
        <button class="btn primary" id="signIn"><svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg> Đăng nhập với Google</button></div>
        ${st ? `<div class="small muted">${st}</div>` : ''}`;
    const q = s => box.querySelector(s);
    if (q('#signIn')) q('#signIn').onclick = Sync.signIn;
    if (q('#signOut')) q('#signOut').onclick = Sync.signOut;
    if (q('#syncNow')) q('#syncNow').onclick = Sync.now;
  }

  // Khởi động trễ để không chặn giao diện
  if (supported) setTimeout(() => init().catch(e => console.warn('firebase', e)), 1200);
})();
