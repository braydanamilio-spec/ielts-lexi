/* Tài khoản & đồng bộ đám mây (Firebase Auth + Firestore).
 * Dữ liệu lưu ở users/{uid}/data/{meta|cards_0..n}; gộp 2 chiều theo hoạt động gần nhất.
 */
(function () {
  const { Store, Cards } = Core;
  const { $, esc, toast } = UI;
  const App = window.App;
  const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
  const CHUNK = 250;

  const Sync = { user: null, status: 'idle', lastSync: 0 };
  window.Sync = Sync;
  let fb = null, db = null, timer = null, box = null;

  const supported = !Store.isExtension && window.FIREBASE_CONFIG && location.protocol.startsWith('http');

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
  function mergeCards(a, b) {
    const out = { ...a };
    for (const [k, c] of Object.entries(b)) {
      const mine = out[k];
      if (!mine) { out[k] = c; continue; }
      const win = activity(c) > activity(mine) ? { ...c } : { ...mine };
      const lose = win === c ? mine : c;
      win.contexts = [...(win.contexts || []), ...(lose.contexts || []).filter(x => !(win.contexts || []).some(y => y.text === x.text))].slice(0, 5);
      out[k] = win;
    }
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
    return { ...a, xp: Math.max(a.xp || 0, b.xp || 0), days, total, best, badges: { ...b.badges, ...a.badges }, readDone: { ...(b.readDone || {}), ...(a.readDone || {}) }, questsDone: { ...(b.questsDone || {}), ...(a.questsDone || {}) } };
  }

  const ref = () => db.collection('users').doc(Sync.user.uid).collection('data');

  async function pullMerge() {
    setStatus('syncing');
    try {
      const snap = await ref().get();
      const docs = {}; snap.forEach(d => { docs[d.id] = d.data(); });
      const local = { cards: await Cards.all(), stats: await Core.Stats.get(), game: await Game.get(), settings: await Store.get('settings', {}) };
      if (docs.meta) {
        let remoteCards = {};
        for (let i = 0; i < (docs.meta.chunks || 0); i++) if (docs['cards_' + i]) Object.assign(remoteCards, JSON.parse(docs['cards_' + i].json || '{}'));
        const remote = JSON.parse(docs.meta.json || '{}');
        await Cards.save(mergeCards(local.cards, remoteCards));
        await Store.set('stats', mergeStats(local.stats, remote.stats || { days: {} }));
        await Store.set('game', mergeGame(local.game, remote.game));
        // Cài đặt: ưu tiên bản mới sửa gần nhất
        if (remote.settings && (remote.settingsAt || 0) > (await Store.get('settingsAt', 0))) await Store.set('settings', remote.settings);
        await App.load();
        App.route();
      }
      await push();
      toast(docs.meta ? '☁️ Đã đồng bộ dữ liệu học' : '☁️ Đã sao lưu dữ liệu lên tài khoản');
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
      for (let i = 0; i < chunks; i++) {
        const part = {}; keys.slice(i * CHUNK, (i + 1) * CHUNK).forEach(k => { part[k] = cards[k]; });
        batch.set(ref().doc('cards_' + i), { json: JSON.stringify(part) });
      }
      batch.set(ref().doc('meta'), {
        chunks, updated: Date.now(),
        json: JSON.stringify({ stats: await Core.Stats.get(), game: await Game.get(), settings: await Store.get('settings', {}), settingsAt: await Store.get('settingsAt', 0) }),
      });
      await batch.commit();
      Sync.lastSync = Date.now();
      setStatus('ok');
    } catch (e) { console.warn('push', e); setStatus('error', e.message); }
  }

  Sync.schedule = () => {
    if (!Sync.user) return;
    clearTimeout(timer);
    timer = setTimeout(push, 4000);
  };
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
  Sync.signOut = async () => { await push(); await firebase.auth().signOut(); toast('Đã đăng xuất – dữ liệu vẫn còn trên máy này'); };
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
