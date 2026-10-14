/* Background service worker: tra từ, lưu thẻ, nhắc học hằng ngày, badge số thẻ cần ôn. */
importScripts('app/js/data.js', 'app/js/core.js', 'app/js/dictionary.js');
const { Store, Cards, Stats, DEFAULT_SETTINGS, todayKey } = Core;

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
    title: 'IELTS Lexi – đến giờ học rồi! 📚',
    message: total ? `Bạn có ${total} thẻ cần ôn hôm nay.${streak ? ` Giữ chuỗi ${streak} ngày 🔥` : ''}` : 'Thêm vài từ mới để giữ chuỗi ngày học nhé 🔥',
    buttons: [{ title: 'Ôn ngay' }],
    priority: 2,
  });
}

async function updateBadge() {
  const [s, cards, stats] = await Promise.all([getSettings(), Cards.all(), Stats.get()]);
  const { total } = Cards.dueCount(cards, s, stats);
  chrome.action.setBadgeText({ text: total ? String(total > 99 ? '99+' : total) : '' });
  chrome.action.setBadgeBackgroundColor({ color: '#e5484d' });
}

const openApp = (hash = '#/review') => chrome.tabs.create({ url: APP_URL + hash });

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  chrome.contextMenus.create({ id: 'lexi-lookup', title: 'Tra “%s” với IELTS Lexi', contexts: ['selection'] });
  chrome.alarms.create('badge', { periodInMinutes: 30 });
  await scheduleReminder();
  updateBadge();
  if (reason === 'install') openApp('#/home');
});
chrome.runtime.onStartup.addListener(() => { scheduleReminder(); updateBadge(); });

chrome.alarms.onAlarm.addListener(a => {
  if (a.name === 'daily-reminder') sendReminder();
  updateBadge();
});
chrome.notifications.onClicked.addListener(id => { chrome.notifications.clear(id); openApp(); });
chrome.notifications.onButtonClicked.addListener(id => { chrome.notifications.clear(id); openApp(); });

chrome.storage.onChanged.addListener(ch => {
  if (ch.settings) scheduleReminder();
  if (ch.cards || ch.stats || ch.settings) updateBadge();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'lexi-lookup' && tab && tab.id) {
    chrome.tabs.sendMessage(tab.id, { type: 'showLookup', word: info.selectionText }).catch(() => openApp('#/dict/' + encodeURIComponent(info.selectionText)));
  }
});

// ---------- Tin nhắn từ content script / popup / app ----------
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  (async () => {
    switch (msg.type) {
      case 'lookup': {
        const e = await Dict.lookup(msg.word);
        const cards = await Cards.all();
        return reply({ entry: e, saved: !!(e && cards[e.word]) });
      }
      case 'save': {
        const card = await Cards.add(msg.entry, msg.context);
        return reply({ ok: true, card });
      }
      case 'translate': return reply({ vi: await Dict.translateVi(msg.text) });
      case 'testNotify': await sendReminder(true); return reply({ ok: true });
      case 'openApp': await openApp(msg.hash); return reply({ ok: true });
      default: reply({});
    }
  })();
  return true; // trả lời bất đồng bộ
});
