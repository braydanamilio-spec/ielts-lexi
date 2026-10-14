/* Service worker: cache giao diện để dùng offline + mở app khi bấm thông báo. */
const CACHE = 'vocaband-20261014110157';
const SHELL = ['./', 'index.html', 'css/style.css', 'js/data.js', 'js/lib/topics-more.js', 'js/lib/skills.js', 'js/lib/awl.js', 'js/lib/ngsl.js', 'js/readings.js', 'js/lexis.js', 'js/core.js', 'js/write.js', 'js/speaking.js', 'js/grammar/tenses.js', 'js/grammar/verbs.js', 'js/grammar/sentences.js', 'js/grammar/foundation.js', 'js/grammar/academic.js', 'js/grammar/chapters.js', 'js/grammar/book2.js', 'js/grammar/drills-a.js', 'js/grammar/drills-b.js', 'js/grammar/drills-c.js', 'js/grammar.js', 'js/pron/sounds.js', 'js/pron/skills.js', 'js/pron.js', 'js/plan.js', 'js/cbt.js', 'js/task1.js', 'js/models.js', 'js/phrases.js', 'js/path.js', 'js/dictionary.js', 'js/game.js', 'js/ui.js', 'js/app.js', 'js/study.js', 'js/reading.js', 'js/firebase-config.js', 'js/sync.js', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// HTML/JS/CSS: lấy bản mới từ mạng (chờ tối đa 2,5 giây) → không bao giờ trộn file cũ với file mới; offline thì dùng cache.
// Ảnh/icon: lấy từ cache ngay.
const STATIC = /\.(png|svg|jpg|jpeg|webp|ico|woff2?)$/;
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // API từ điển luôn đi mạng
  if (STATIC.test(url.pathname)) {
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; })));
    return;
  }
  e.respondWith(new Promise(resolve => {
    let done = false;
    const fallback = () => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('index.html'));
    const t = setTimeout(() => { fallback().then(r => { if (!done && r) { done = true; resolve(r); } }); }, 2500);
    fetch(e.request).then(r => {
      if (r.ok) { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); }
      clearTimeout(t); if (!done) { done = true; resolve(r); }
    }).catch(() => { clearTimeout(t); fallback().then(r => { if (!done) { done = true; resolve(r || Response.error()); } }); });
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || './#/review';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if ('focus' in c) { c.navigate(target); return c.focus(); }
    return self.clients.openWindow(target);
  }));
});
