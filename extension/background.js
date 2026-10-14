/* Background service worker: tra từ, lưu thẻ, nhắc học hằng ngày, badge số thẻ cần ôn. */
importScripts('app/js/data.js', 'app/js/core.js', 'app/js/dictionary.js');
const { Store, Cards, Stats, Golden, DEFAULT_SETTINGS, todayKey } = Core;

const APP_URL = chrome.runtime.getURL('app/index.html');
const getSettings = async () => ({ ...DEFAULT_SETTINGS, ...(await Store.get('settings', {})) });

// ---------- Nhắc học ----------
async function scheduleReminder() {
  const s = await getSettings();
  await chrome.alarms.clear('daily-reminder');
  if (!s.reminderOn) return;
  const [hh, mm] = s.reminderTime.split(':').map(Number);
  const next = new Date(); next.setHours(hh, mm, 0, 0);
  if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1);
  chrome.alarms.create('daily-reminder', { when: next.getTime(), periodInMinutes: 24 * 60 });
}

async function sendReminder(force = false) {
  const [s, cards, stats] = await Promise.all([getSettings(), Cards.all(), Stats.get()]);
  const done = stats.days[todayKey()] || 0;
  if (!force && done >= s.dailyGoal) return;
  const { total } = Cards.dueCount(cards, s, stats);
  const streak = Stats.streak(stats);
  chrome.notifications.create('reminder-' + Date.now(), {
    type: 'basic',
    iconUrl: 'icons/icon-128.png',
    title: 'Vocaband – đến giờ học rồi! 📚',
    message: total ? `Bạn có ${total} thẻ cần ôn hôm nay.${streak ? ` Giữ chuỗi ${streak} ngày 🔥` : ''}` : 'Thêm vài từ mới để giữ chuỗi ngày học nhé 🔥',
    buttons: [{ title: 'Ôn ngay' }],
    priority: 2,
  });
}

// Thời điểm vàng: kiểm tra mỗi 15 phút, báo khi đủ số từ sắp quên (tối đa 1 lần / 3 giờ, tôn trọng giờ yên lặng)
async function checkGolden() {
  const [s, cards] = await Promise.all([getSettings(), Cards.all()]);
  if (!s.goldenOn || Golden.quiet(s)) return;
  const n = Golden.dueNow(cards);
  const last = await Store.get('lastGolden', 0);
  if (n < s.goldenMin || Date.now() - last < 3 * 3600 * 1000) return;
  await Store.set('lastGolden', Date.now());
  chrome.notifications.create('golden-' + Date.now(), {
    type: 'basic', iconUrl: 'icons/icon-128.png', priority: 2,
    title: '⏰ Thời điểm vàng!',
    message: `${n} từ đang ở thời điểm sắp quên – ôn 3 phút để nhớ lâu hơn.`,
    buttons: [{ title: 'Ôn ngay' }],
  });
}

async function updateBadge() {
  const [s, cards, stats] = await Promise.all([getSettings(), Cards.all(), Stats.get()]);
  const { total } = Cards.dueCount(cards, s, stats);
  chrome.action.setBadgeText({ text: total ? String(total > 99 ? '99+' : total) : '' });
  chrome.action.setBadgeBackgroundColor({ color: '#e5484d' });
}

const openApp = (hash = '#/review') => chrome.tabs.create({ url: APP_URL + hash });

// Chạy content script ngay trên các tab đang mở (không cần tải lại trang sau khi cài/cập nhật)
async function injectIntoOpenTabs() {
  const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
  await Promise.all(tabs.map(t => chrome.scripting.executeScript({ target: { tabId: t.id, allFrames: true }, files: ['app/js/structures.js', 'content.js'] }).catch(() => {})));
}

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  chrome.contextMenus.removeAll();
  chrome.contextMenus.create({ id: 'lexi-lookup', title: 'Tra từ “%s” với Vocaband', contexts: ['selection'] });
  chrome.contextMenus.create({ id: 'lexi-translate', title: 'Dịch đoạn đã chọn sang tiếng Việt', contexts: ['selection'] });
  injectIntoOpenTabs();
  chrome.alarms.create('badge', { periodInMinutes: 15 });
  await scheduleReminder();
  updateBadge();
  if (reason === 'install') openApp('#/home');
});
chrome.runtime.onStartup.addListener(() => { scheduleReminder(); updateBadge(); });

chrome.alarms.onAlarm.addListener(a => {
  if (a.name === 'daily-reminder') sendReminder();
  if (a.name === 'badge') checkGolden();
  updateBadge();
});
chrome.notifications.onClicked.addListener(id => { chrome.notifications.clear(id); openApp(); });
chrome.notifications.onButtonClicked.addListener(id => { chrome.notifications.clear(id); openApp(); });

chrome.storage.onChanged.addListener(ch => {
  if (ch.settings) scheduleReminder();
  if (ch.cards || ch.stats || ch.settings) updateBadge();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'lexi-translate' && tab && tab.id) {
    chrome.tabs.sendMessage(tab.id, { type: 'translateSelection' }).catch(() => {});
    return;
  }
  if (info.menuItemId === 'lexi-lookup' && tab && tab.id) {
    chrome.tabs.sendMessage(tab.id, { type: 'showLookup', word: info.selectionText }).catch(() => openApp('#/dict/' + encodeURIComponent(info.selectionText)));
  }
});

// ---------- Giải thích sâu bằng AI (Gemini, khóa của chính người dùng – lưu trong chrome.storage.local 'aiKey') ----------
async function aiExplain(text, sentence) {
  const { aiKey, settings } = await chrome.storage.local.get(['aiKey', 'settings']);
  if (!aiKey) return { error: 'NO_KEY' };
  const models = [(settings && settings.aiModel) || 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'];
  const prompt = `Explain the English expression for a Vietnamese IELTS learner. Expression: "${text}"${sentence && sentence !== text ? `\nSentence it appears in: "${sentence}"` : ''}
Return ONLY JSON: {"meaning": string (Vietnamese meaning in THIS context), "structure": [{"pattern": string (e.g. "the amount of + uncountable N"), "explain": string (Vietnamese)}] (1-3 items), "grammar": string (Vietnamese: key grammar point, e.g. reduced relative clause, tense, voice), "collocations": [string] (3-5 natural English collocations/variants), "examples": [{"en": string, "vi": string}] (2 IELTS-style examples), "tip": string (Vietnamese: when/how to use it in IELTS Writing/Speaking, register)}`;
  for (const m of models) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${encodeURIComponent(aiKey)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.2 } }) });
      if (r.status === 404) continue;
      const j = await r.json();
      if (!r.ok) return { error: r.status === 429 ? 'QUOTA' : r.status === 400 ? 'BAD_KEY' : 'FAILED' };
      const t = ((((j.candidates || [])[0] || {}).content || {}).parts || []).map(p => p.text || '').join('');
      return { result: JSON.parse(t.replace(/^```(json)?|```$/g, '').trim()) };
    } catch (e) { /* thử mẫu tiếp theo */ }
  }
  return { error: 'FAILED' };
}

// ---------- Tin nhắn từ content script / popup / app ----------
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  (async () => { try {
    switch (msg.type) {
      case 'lookup': {
        const e = await Dict.lookup(msg.word);
        const cards = await Cards.all();
        return reply({ entry: e, saved: !!(e && cards[e.word]) });
      }
      case 'quick': {
        const e = await Dict.quick(msg.word);
        const cards = await Cards.all();
        return reply({ entry: e, saved: !!(e && cards[e.word]) });
      }
      case 'save': {
        const card = await Cards.add(msg.entry, msg.context);
        return reply({ ok: true, card });
      }
      case 'translate': return reply({ vi: await Dict.translateVi(msg.text) });
      case 'explain': return reply(await aiExplain(msg.text, msg.sentence));
      case 'testNotify': await sendReminder(true); return reply({ ok: true });
      case 'openApp': await openApp(msg.hash); return reply({ ok: true });
      default: reply({});
    }
  } catch (e) { reply({ error: String(e && e.message || e) }); } })();
  return true; // trả lời bất đồng bộ
});
