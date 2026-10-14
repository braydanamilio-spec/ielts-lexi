/* Tự phục hồi: nếu ứng dụng không khởi động được (vd. trình duyệt trộn file cũ/mới sau khi cập nhật)
 * → xóa cache + gỡ service worker rồi tải lại đúng 1 lần. Không ảnh hưởng dữ liệu học (localStorage/IndexedDB). */
(function () {
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') return;
  window.addEventListener('load', () => setTimeout(async () => {
    if (window.App && window.App.route && typeof window.t === 'function') { try { sessionStorage.removeItem('vb.healed'); } catch (e) { /* bỏ qua */ } return; }
    try { if (sessionStorage.getItem('vb.healed')) return; sessionStorage.setItem('vb.healed', '1'); } catch (e) { return; }
    try { const rs = await navigator.serviceWorker.getRegistrations(); await Promise.all(rs.map(r => r.unregister())); } catch (e) { /* bỏ qua */ }
    try { const ks = await caches.keys(); await Promise.all(ks.map(k => caches.delete(k))); } catch (e) { /* bỏ qua */ }
    location.reload();
  }, 1500));
})();
