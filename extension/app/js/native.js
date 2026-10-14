/* Cầu nối app gốc (Android/iOS qua Capacitor). Chỉ chạy khi mở trong app – web & add-on bỏ qua hoàn toàn.
 * – Nhắc học hằng ngày bằng thông báo cục bộ (không cần máy chủ, miễn phí)
 * – Rung phản hồi (Haptics) thay cho navigator.vibrate
 * – Không dùng service worker trong app (tài nguyên đã nằm sẵn trong gói cài đặt) */
(function (g) {
  const Cap = g.Capacitor;
  const native = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
  g.VBNative = { is: native, platform: native ? Cap.getPlatform() : 'web' };
  if (!native) return;
  const P = Cap.Plugins || {};
  document.documentElement.classList.add('native', 'native-' + Cap.getPlatform());

  // Gỡ service worker nếu lỡ đăng ký (tránh giữ bản cũ sau khi cập nhật app)
  try { navigator.serviceWorker && navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister())); } catch (e) { /* bỏ qua */ }

  // Rung: dùng Haptics của hệ điều hành
  if (P.Haptics) {
    try { Object.defineProperty(navigator, 'vibrate', { configurable: true, value: p => { const ms = Array.isArray(p) ? p[0] : p; P.Haptics.vibrate({ duration: Math.max(10, ms || 15) }).catch(() => {}); return true; } }); } catch (e) { /* bỏ qua */ }
  }

  // Nhắc học hằng ngày theo giờ người học chọn trong Cài đặt (mặc định 20:00)
  async function scheduleReminder() {
    const LN = P.LocalNotifications; if (!LN || !g.Core) return;
    try {
      const s = await g.Core.Store.get('settings', {});
      await LN.cancel({ notifications: [{ id: 1 }] }).catch(() => {});
      if (s.reminderOn === false) return;
      const perm = await LN.checkPermissions();
      if (perm.display !== 'granted') { const r = await LN.requestPermissions(); if (r.display !== 'granted') return; }
      const [hh, mm] = String(s.reminderTime || '20:00').split(':').map(Number);
      const vi = (g.I18N && g.I18N.lang && g.I18N.lang()) === 'vi';
      await LN.schedule({ notifications: [{
        id: 1,
        title: vi ? 'Vocaband – đến giờ học rồi! 📚' : 'Vocaband – time to study! 📚',
        body: vi ? 'Ôn vài thẻ để giữ chuỗi ngày học 🔥' : 'Review a few cards to keep your streak 🔥',
        schedule: { on: { hour: hh || 20, minute: mm || 0 }, repeats: true, allowWhileIdle: true },
        extra: { route: '#/review' },
      }] });
    } catch (e) { /* thiết bị không hỗ trợ */ }
  }
  // Bấm thông báo → mở thẳng trang ôn tập
  if (P.LocalNotifications) P.LocalNotifications.addListener('localNotificationActionPerformed', a => { const r = a && a.notification && a.notification.extra && a.notification.extra.route; if (r) location.hash = r; });
  g.VBNative.scheduleReminder = scheduleReminder;
  window.addEventListener('load', () => setTimeout(scheduleReminder, 3000));
})(typeof self !== 'undefined' ? self : this);
