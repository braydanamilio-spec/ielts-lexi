/* Lõi dùng chung cho web app, trang add-on và background service worker.
 * Không đụng tới DOM để có thể chạy bằng importScripts().
 */
(function (g) {
  // ---------- Storage: chrome.storage.local trong add-on, localStorage trên web ----------
  const hasChrome = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
  const PREFIX = 'ielts.';

  const Store = {
    async get(key, fallback) {
      try {
        if (hasChrome) {
          const r = await chrome.storage.local.get(key);
          return r[key] !== undefined ? r[key] : fallback;
        }
        const raw = localStorage.getItem(PREFIX + key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (e) { return fallback; }
    },
    async set(key, value) {
      if (hasChrome) return chrome.storage.local.set({ [key]: value });
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    },
    isExtension: !!hasChrome,
  };

  const DEFAULT_SETTINGS = {
    reminderOn: true,
    reminderTime: '20:00',
    dailyNew: 10,
    dailyGoal: 20,
    accent: 'en-GB',
    autoSpeak: true,
  };

  // ---------- Ngày tháng ----------
  const DAY = 86400000;
  const todayKey = (d = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const endOfToday = () => startOfToday() + DAY - 1;

  // ---------- SRS: biến thể SM-2 (kiểu Anki) ----------
  // grade: 0 = Quên, 1 = Khó, 2 = Nhớ, 3 = Dễ
  const SRS = {
    newState: () => ({ ef: 2.5, interval: 0, reps: 0, lapses: 0, due: Date.now(), last: null }),

    // Trả về trạng thái mới; interval tính theo ngày
    review(s, grade, now = Date.now()) {
      s = { ...s };
      if (grade === 0) {
        s.lapses += 1;
        s.reps = 0;
        s.interval = 0;
        s.ef = Math.max(1.3, s.ef - 0.2);
        s.due = now + 60 * 1000; // ôn lại sau 1 phút trong phiên
      } else {
        if (grade === 1) {
          s.interval = s.reps === 0 ? 1 : Math.max(1, Math.round(s.interval * 1.2));
          s.ef = Math.max(1.3, s.ef - 0.15);
        } else if (grade === 2) {
          s.interval = s.reps === 0 ? 1 : s.reps === 1 ? 3 : Math.round(s.interval * s.ef);
        } else {
          s.interval = s.reps === 0 ? 4 : Math.round(s.interval * s.ef * 1.3);
          s.ef += 0.15;
        }
        s.reps += 1;
        // Đến hạn vào đầu ngày (giờ địa phương) sau `interval` ngày
        const d = new Date(now); d.setHours(4, 0, 0, 0);
        s.due = d.getTime() + s.interval * DAY;
      }
      s.last = now;
      return s;
    },

    // Nhãn dự kiến hiển thị trên nút
    preview(s, grade) {
      const n = SRS.review(s, grade);
      if (grade === 0) return '1 phút';
      return n.interval === 1 ? '1 ngày' : n.interval < 30 ? `${n.interval} ngày` : `${Math.round(n.interval / 30)} tháng`;
    },

    // Mức thuộc: 0 mới, 1 đang học, 2 quen, 3 thuộc
    mastery(s) {
      if (!s || s.reps === 0) return s && s.last ? 1 : 0;
      if (s.interval >= 21) return 3;
      if (s.interval >= 4) return 2;
      return 1;
    },
  };

  // ---------- Thẻ ----------
  const Cards = {
    async all() { return Store.get('cards', {}); },
    async save(map) { return Store.set('cards', map); },

    make(entry, extra = {}) {
      return {
        word: entry.word,
        ipa: entry.ipa || '',
        ipaUS: entry.ipaUS || '',
        pos: entry.pos || '',
        vi: entry.vi || '',
        def: entry.def || '',
        ex: entry.ex || '',
        col: entry.col || [],
        syn: entry.syn || [],
        level: entry.level || '',
        topic: entry.topic || 'mine',
        emoji: entry.emoji || '📘',
        image: entry.image || '',
        audio: entry.audio || '',
        sentences: (entry.sentences || []).slice(0, 2), // câu song ngữ [{en, vi}]
        contexts: [],          // [{text, vi, source, title, at}]
        note: '',
        added: Date.now(),
        srs: SRS.newState(),
        ...extra,
      };
    },

    // Thêm/gộp một thẻ. context = {text, source, title}
    async add(entry, context) {
      const map = await Cards.all();
      const key = entry.word.toLowerCase();
      let card = map[key];
      if (!card) card = Cards.make(entry);
      else {
        // bổ sung trường còn trống
        for (const k of ['ipa', 'ipaUS', 'pos', 'vi', 'def', 'ex', 'image', 'audio', 'level']) {
          if (!card[k] && entry[k]) card[k] = entry[k];
        }
        if (!(card.sentences || []).length && entry.sentences) card.sentences = entry.sentences.slice(0, 2);
      }
      if (context && context.text && !card.contexts.some(c => c.text === context.text)) {
        card.contexts.unshift({ ...context, at: Date.now() });
        card.contexts = card.contexts.slice(0, 5);
      }
      map[key] = card;
      await Cards.save(map);
      return card;
    },

    async remove(word) {
      const map = await Cards.all();
      delete map[word.toLowerCase()];
      await Cards.save(map);
    },

    async update(card) {
      const map = await Cards.all();
      map[card.word.toLowerCase()] = card;
      await Cards.save(map);
    },

    dueCount(map, settings, stats) {
      const list = Object.values(map);
      const end = endOfToday();
      const due = list.filter(c => c.srs.reps > 0 || c.srs.last ? c.srs.due <= end : false).length;
      const introduced = (stats && stats.newToday && stats.newToday.day === todayKey()) ? stats.newToday.n : 0;
      const newAvail = list.filter(c => c.srs.reps === 0 && !c.srs.last).length;
      const newCount = Math.min(newAvail, Math.max(0, (settings || DEFAULT_SETTINGS).dailyNew - introduced));
      return { due, newCount, total: due + newCount };
    },
  };

  // ---------- Thống kê & chuỗi ngày ----------
  const Stats = {
    async get() { return Store.get('stats', { days: {}, newToday: { day: '', n: 0 } }); },
    async logReview(isNew) {
      const s = await Stats.get();
      const k = todayKey();
      s.days[k] = (s.days[k] || 0) + 1;
      if (isNew) {
        if (s.newToday.day !== k) s.newToday = { day: k, n: 0 };
        s.newToday.n += 1;
      }
      await Store.set('stats', s);
      return s;
    },
    streak(s) {
      let n = 0;
      const d = new Date();
      if (!s.days[todayKey(d)]) d.setDate(d.getDate() - 1); // hôm nay chưa học vẫn giữ chuỗi
      while (s.days[todayKey(d)]) { n++; d.setDate(d.getDate() - 1); }
      return n;
    },
  };

  g.Core = { Store, SRS, Cards, Stats, DEFAULT_SETTINGS, todayKey, startOfToday, endOfToday, DAY };
})(typeof self !== 'undefined' ? self : this);
