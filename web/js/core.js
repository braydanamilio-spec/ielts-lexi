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
    goldenOn: true,       // nhắc "thời điểm vàng" khi có đủ từ sắp quên
    goldenMin: 10,        // số từ tối thiểu để nhắc
    quietStart: '22:30',  // giờ yên lặng
    quietEnd: '07:00',
    sessionCap: 50,       // tối đa thẻ mỗi phiên ôn (0 = không giới hạn)
  };

  // ---------- Ngày tháng ----------
  const DAY = 86400000;
  const todayKey = (d = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const endOfToday = () => startOfToday() + DAY - 1;

  // ---------- SRS: SM-2 + bước học (learning steps) kiểu Anki + đường cong quên lãng ----------
  // grade: 0 = Quên, 1 = Khó, 2 = Nhớ, 3 = Dễ
  // Thẻ mới/quên đi qua các bước 1 phút → 10 phút trước khi "tốt nghiệp" sang lịch theo ngày.
  const MIN = 60 * 1000;
  const SRS = {
    newState: () => ({ ef: 2.5, interval: 0, reps: 0, lapses: 0, due: Date.now(), last: null, step: 0 }),

    isLearning: s => s.reps === 0,

    review(s, grade, now = Date.now()) {
      s = { step: 0, ...s };
      const toDay = days => {
        // giãn ngẫu nhiên ±5% để các thẻ không dồn cùng một ngày
        const fuzz = days >= 3 ? Math.round(days * (Math.random() * 0.1 - 0.05)) : 0;
        s.interval = Math.max(1, days + fuzz);
        const d = new Date(now); d.setHours(4, 0, 0, 0);
        s.due = d.getTime() + s.interval * DAY;
      };
      if (s.reps === 0) {
        // Đang học / học lại
        if (grade === 0) { s.step = 0; s.due = now + MIN; if (s.last) s.ef = Math.max(1.3, s.ef - 0.05); }
        else if (grade === 1) { s.due = now + (s.step === 0 ? 6 : 10) * MIN; }
        else if (grade === 2 && s.step === 0) { s.step = 1; s.due = now + 10 * MIN; }
        else { s.reps = 1; s.step = 0; toDay(grade === 3 ? 4 : 1); if (grade === 3) s.ef += 0.15; }
      } else if (grade === 0) {
        // Quên → về bước học lại, giảm độ dễ
        s.lapses += 1; s.reps = 0; s.step = 0; s.interval = 0;
        s.ef = Math.max(1.3, s.ef - 0.2);
        s.due = now + MIN;
      } else {
        const overdue = Math.max(0, (now - s.due) / DAY); // ôn muộn mà vẫn nhớ → thưởng khoảng dài hơn
        if (grade === 1) { s.ef = Math.max(1.3, s.ef - 0.15); toDay(Math.max(s.interval + 1, Math.round(s.interval * 1.2))); }
        else if (grade === 2) toDay(s.reps === 1 ? 3 : Math.max(s.interval + 1, Math.round((s.interval + overdue / 2) * s.ef)));
        else { s.ef += 0.15; toDay(s.reps === 1 ? 5 : Math.max(s.interval + 2, Math.round((s.interval + overdue) * s.ef * 1.3))); }
        s.reps += 1;
      }
      s.last = now;
      return s;
    },

    preview(s, grade) {
      if (s.reps === 0) {
        if (grade === 0) return '1 phút';
        if (grade === 1) return (s.step || 0) === 0 ? '6 phút' : '10 phút';
        if (grade === 2 && !(s.step > 0)) return '10 phút';
      } else if (grade === 0) return '1 phút';
      const n = SRS.review({ ...s }, grade);
      const d = Math.round((n.due - Date.now()) / DAY);
      return d <= 1 ? '1 ngày' : d < 30 ? `${d} ngày` : d < 365 ? `${Math.round(d / 30)} tháng` : `${(d / 365).toFixed(1)} năm`;
    },

    // Xác suất còn nhớ theo đường cong quên lãng Ebbinghaus: R = 0.9^(t / I)
    // (thiết kế để lúc đến hạn ôn, khả năng nhớ ≈ 90%)
    retention(s, now = Date.now()) {
      if (!s || !s.last) return null;
      if (s.reps === 0) return Math.max(0.3, 0.9 ** ((now - s.last) / (10 * MIN)));
      const t = (now - s.last) / DAY;
      return Math.pow(0.9, t / Math.max(1, s.interval));
    },

    // 5 cấp độ nhớ (kiểu MochiVocab): 1 < 1 ngày · 2 ≤ 3 ngày · 3 ≤ 10 ngày · 4 ≤ 30 ngày · 5 > 30 ngày; 0 = chưa học
    level5(s) {
      if (!s || !s.last) return 0;
      if (s.reps === 0) return 1;
      return s.interval <= 3 ? 2 : s.interval <= 10 ? 3 : s.interval <= 30 ? 4 : 5;
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

  // ---------- Thời điểm vàng ----------
  const toMin = t => { const [h, m] = String(t || '0:0').split(':').map(Number); return h * 60 + (m || 0); };
  const Golden = {
    // Số thẻ đã đến hạn ôn ngay lúc này (kể cả thẻ đang ở bước học)
    dueNow(map, now = Date.now()) { return Object.values(map).filter(c => (c.srs.reps > 0 || c.srs.last) && c.srs.due <= now).length; },
    // Mốc thời gian gần nhất có thẻ đến hạn trong tương lai
    next(map, now = Date.now()) {
      const t = Object.values(map).filter(c => (c.srs.reps > 0 || c.srs.last) && c.srs.due > now).map(c => c.srs.due).sort((a, b) => a - b);
      if (!t.length) return null;
      return { at: t[0], count: t.filter(x => x <= t[0] + 3600 * 1000).length };
    },
    quiet(settings, d = new Date()) {
      const n = d.getHours() * 60 + d.getMinutes(), a = toMin(settings.quietStart), b = toMin(settings.quietEnd);
      return a <= b ? n >= a && n < b : n >= a || n < b;
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

  g.Core = { Golden, Store, SRS, Cards, Stats, DEFAULT_SETTINGS, todayKey, startOfToday, endOfToday, DAY };
})(typeof self !== 'undefined' ? self : this);
