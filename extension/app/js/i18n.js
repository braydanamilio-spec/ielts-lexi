/* Đa ngôn ngữ giao diện (i18n). Khóa dịch = chuỗi gốc tiếng Việt trong mã (kiểu gettext): t('Ôn tập') → "Review".
 * Ngôn ngữ: lựa chọn đã lưu → ngôn ngữ trình duyệt → mặc định English. Chỉ nạp file của ngôn ngữ đang dùng.
 * Nội dung học (nghĩa từ, giải thích) theo "ngôn ngữ người học" (learnLang) – mặc định theo giao diện. */
(function (g) {
  const LANGS = {
    en: ['English', 'English'], vi: ['Vietnamese', 'Tiếng Việt'], es: ['Spanish', 'Español'], pt: ['Portuguese', 'Português'], fr: ['French', 'Français'],
    de: ['German', 'Deutsch'], id: ['Indonesian', 'Bahasa Indonesia'], th: ['Thai', 'ไทย'], zh: ['Chinese (Simplified)', '简体中文'], ja: ['Japanese', '日本語'],
    ko: ['Korean', '한국어'], hi: ['Hindi', 'हिन्दी'], ar: ['Arabic', 'العربية'], ru: ['Russian', 'Русский'], tr: ['Turkish', 'Türkçe'],
  };
  const RTL = new Set(['ar']);
  const KEY = 'vb.uiLang';
  const read = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  function detect() {
    const saved = read(KEY); if (saved && LANGS[saved]) return saved;
    const navs = (g.navigator && (navigator.languages || [navigator.language])) || [];
    for (const l of navs) { const b = String(l || '').toLowerCase().split('-')[0]; if (LANGS[b]) return b; }
    return 'en';
  }
  const lang = detect();
  const D = g.I18N_DICT = g.I18N_DICT || {};
  // t(chuỗi gốc, {biến}) – thiếu bản dịch thì dùng tiếng Anh, rồi mới tới chuỗi gốc
  function t(src, vars) {
    let s = lang === 'vi' ? src : ((D[lang] && D[lang][src]) || (D.en && D.en[src]) || src);
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
    return s;
  }
  // Dịch các phần tử tĩnh trong HTML: <span data-i18n>Ôn tập</span>, data-i18n-title, data-i18n-placeholder
  function apply(root) {
    if (lang === 'vi' || !g.document) return;
    (root || document).querySelectorAll('[data-i18n]').forEach(el => { const k = el.getAttribute('data-i18n') || el.textContent.trim(); el.textContent = t(k); });
    (root || document).querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.getAttribute('data-i18n-title')); });
    (root || document).querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.getAttribute('data-i18n-placeholder')); });
  }
  function set(l) { if (!LANGS[l]) return; try { localStorage.setItem(KEY, l); } catch (e) { /* bỏ qua */ } location.reload(); }
  // Ngôn ngữ dùng để hiển thị nghĩa/giải thích (người học có thể chọn khác giao diện)
  const learnLang = () => read('vb.learnLang') || (lang === 'en' ? 'vi' : lang);
  g.t = t;
  g.I18N = { t, apply, set, lang: () => lang, learnLang, LANGS, rtl: RTL.has(lang), detect };
  if (g.document) {
    document.documentElement.lang = lang;
    if (RTL.has(lang)) document.documentElement.dir = 'rtl';
    // Nạp đồng bộ đúng 1 file ngôn ngữ trước khi các module khác chạy (giao diện không bị nhảy chữ)
    if (lang !== 'vi' && document.readyState === 'loading' && document.currentScript) {
      document.write(`<script src="js/i18n/en.js"><\/script>`);
      if (lang !== 'en') document.write(`<script src="js/i18n/${lang}.js"><\/script>`);
    }
    document.addEventListener('DOMContentLoaded', () => apply());
  }
})(typeof self !== 'undefined' ? self : this);
