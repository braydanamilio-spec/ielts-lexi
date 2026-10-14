/* Tự phục hồi: nếu ứng dụng không khởi động được (vd. trình duyệt trộn file cũ/mới sau khi cập nhật)
 * → xóa cache + gỡ service worker rồi tải lại đúng 1 lần. Không ảnh hưởng dữ liệu học (localStorage/IndexedDB). */
(function () {
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') return;
  // Đăng ký + chủ động kiểm tra bản mới ngay từ file đầu tiên (không phụ thuộc app.js) – khi mở app và khi quay lại tab (tối đa 30 phút/lần)
  if ('serviceWorker' in navigator) {
    let last = 0;
    const check = () => { if (Date.now() - last < 30 * 60e3) return; last = Date.now(); navigator.serviceWorker.register('sw.js').then(r => r.update()).catch(() => {}); };
    window.addEventListener('load', check);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  }
  window.addEventListener('load', () => setTimeout(async () => {
    if (window.App && window.App.route && typeof window.t === 'function') { try { sessionStorage.removeItem('vb.healed'); } catch (e) { /* bỏ qua */ } return; }
    try { if (sessionStorage.getItem('vb.healed')) return; sessionStorage.setItem('vb.healed', '1'); } catch (e) { return; }
    try { const rs = await navigator.serviceWorker.getRegistrations(); await Promise.all(rs.map(r => r.unregister())); } catch (e) { /* bỏ qua */ }
    try { const ks = await caches.keys(); await Promise.all(ks.map(k => caches.delete(k))); } catch (e) { /* bỏ qua */ }
    location.reload();
  }, 1500));
})();
