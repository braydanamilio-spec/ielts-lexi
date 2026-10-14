/* Service worker: cache giao diện để dùng offline + mở app khi bấm thông báo. */
const CACHE = 'vocaband-v4';
const SHELL = ['./', 'index.html', 'css/style.css', 'js/data.js', 'js/lib/topics-more.js', 'js/lib/skills.js', 'js/lib/awl.js', 'js/readings.js', 'js/lexis.js', 'js/core.js', 'js/write.js', 'js/dictionary.js', 'js/game.js', 'js/ui.js', 'js/app.js', 'js/study.js', 'js/reading.js', 'js/path.js', 'js/firebase-config.js', 'js/sync.js', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // API từ điển luôn đi mạng
  // Trả ngay bản trong cache (mở app tức thì, không tốn băng thông), đồng thời cập nhật bản mới ở nền
  e.respondWith(caches.open(CACHE).then(async cache => {
    const hit = await cache.match(e.request, { ignoreSearch: url.pathname.endsWith('/') || url.pathname.endsWith('.html') });
    const net = fetch(e.request).then(r => { if (r.ok) cache.put(e.request, r.clone()); return r; }).catch(() => hit || cache.match('index.html'));
    if (hit) { e.waitUntil(net); return hit; }
    return net;
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
