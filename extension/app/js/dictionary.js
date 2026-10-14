/* Tra từ: ưu tiên bộ từ IELTS có sẵn, bổ sung từ các nguồn miễn phí, không cần key:
 *  - Google Dictionary (dữ liệu Oxford Languages): nghĩa tiếng Việt theo từ loại,
 *    định nghĩa tiếng Anh + ví dụ, từ đồng nghĩa; dịch câu ngữ cảnh
 *  - dictionaryapi.dev : phiên âm IPA, audio UK/US, định nghĩa bổ sung
 *  - Tatoeba           : câu ví dụ thật, song ngữ Anh – Việt
 *  - Wikipedia REST    : hình minh họa
 *  - MyMemory          : dự phòng khi Google không phản hồi
 */
(function (g) {
  const cache = new Map();

  const fetchJSON = async (url, ms = 8000) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try {
      const r = await fetch(url, { signal: ctrl.signal });
      if (!r.ok) return null;
      return await r.json();
    } catch (e) { return null; } finally { clearTimeout(t); }
  };

  const GTX = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&hl=vi&dj=1';

  async function fromGoogle(word) {
    const d = await fetchJSON(`${GTX}&dt=t&dt=bd&dt=md&dt=ex&dt=ss&q=${encodeURIComponent(word)}`, 4000);
    if (!d) return null;
    const vi = (d.sentences || []).map(s => s.trans || '').join('').trim();
    const senses = (d.dict || []).map(x => ({ pos: x.pos, terms: (x.terms || []).slice(0, 6) }));
    const exById = {};
    ((d.examples && d.examples.example) || []).forEach(e => { exById[e.definition_id] = e.text.replace(/<\/?b>/g, ''); });
    const defs = (d.definitions || []).map(x => ({
      pos: x.pos,
      defs: (x.entry || []).slice(0, 4).map(e => ({ def: e.gloss, ex: e.example || exById[e.definition_id] || '' })),
    }));
    const syn = [...new Set((d.synsets || []).flatMap(s => (s.entry || []).flatMap(e => e.synonym || [])))].slice(0, 8);
    const base = (d.dict && d.dict[0] && d.dict[0].base_form) || (d.definitions && d.definitions[0] && d.definitions[0].base_form) || '';
    return { vi, senses, defs, syn, base };
  }

  async function fromFreeDict(word) {
    const data = await fetchJSON(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, 3000);
    if (!Array.isArray(data) || !data.length) return null;
    const out = { ipa: '', ipaUS: '', audio: '', audioUS: '', meanings: [], syn: [] };
    for (const entry of data) {
      for (const p of entry.phonetics || []) {
        const a = p.audio || '';
        if (/-uk\.mp3$/.test(a) && !out.audio) { out.audio = a; if (p.text) out.ipa = p.text; }
        else if (/-us\.mp3$/.test(a) && !out.audioUS) { out.audioUS = a; if (p.text) out.ipaUS = p.text; }
      }
      if (!out.ipa) out.ipa = entry.phonetic || (entry.phonetics || []).map(p => p.text).find(Boolean) || '';
      for (const m of entry.meanings || []) {
        out.meanings.push({
          pos: m.partOfSpeech,
          defs: (m.definitions || []).slice(0, 3).map(d => ({ def: d.definition, ex: d.example || '' })),
        });
        out.syn.push(...(m.synonyms || []));
      }
    }
    if (!out.audio) out.audio = out.audioUS;
    out.syn = [...new Set(out.syn)].slice(0, 6);
    return out;
  }

  // Câu ví dụ song ngữ từ Tatoeba (ưu tiên câu dài vừa phải, giống văn phong IELTS hơn)
  async function sentences(word, limit = 4) {
    const d = await fetchJSON(`https://api.tatoeba.org/unstable/sentences?lang=eng&q=${encodeURIComponent(word)}&trans:lang=vie&sort=relevance&limit=20&showtrans=matching`, 3500);
    if (!d || !Array.isArray(d.data)) return [];
    return d.data
      .map(x => ({ en: x.text, vi: ((x.translations || []).flat().find(t => t && t.lang === 'vie') || (x.translations || []).flat()[0] || {}).text || '' }))
      .filter(x => x.vi && x.en.split(' ').length >= 5)
      .sort((a, b) => Math.abs(a.en.length - 70) - Math.abs(b.en.length - 70))
      .slice(0, limit);
  }

  // Phiên âm UK/US từ Wiktionary (khi dictionaryapi.dev thiếu); đổi ɹ → r theo quy ước từ điển Oxford
  async function wiktIPA(word) {
    const d = await fetchJSON(`https://en.wiktionary.org/w/api.php?action=parse&page=${encodeURIComponent(word)}&prop=wikitext&format=json&formatversion=2&origin=*`, 3500);
    const text = d && d.parse && d.parse.wikitext;
    if (!text) return null;
    const en = text.split(/\n==(?!=)/).find(sec => /^English==/.test(sec)) || text;
    let uk = '', us = '', any = '';
    for (const line of en.split('\n')) {
      const m = line.match(/\{\{IPA\|en\|([^}|]+)/);
      if (!m || !m[1].startsWith('/')) continue;
      const ipa = m[1].trim();
      if (/a=[^}|]*(UK|RP|Received|British)/.test(line)) uk = uk || ipa;
      else if (/a=[^}|]*(GA|US|General American)/.test(line)) us = us || ipa;
      else any = any || ipa;
    }
    const fix = x => x.replace(/ɹ/g, 'r').replace(/\./g, '');
    if (!uk && !us && !any) return null;
    return { ipa: fix(uk || any || us), ipaUS: fix(us || any || uk) };
  }

  async function myMemory(text) {
    const d = await fetchJSON(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|vi`);
    const t = d && d.responseData && d.responseData.translatedText;
    return !t || /MYMEMORY WARNING|INVALID/i.test(t) ? '' : t;
  }

  // Dịch cả câu (dùng cho câu ngữ cảnh)
  async function translateVi(text) {
    const d = await fetchJSON(`${GTX}&dt=t&q=${encodeURIComponent(text)}`);
    const t = d && (d.sentences || []).map(s => s.trans || '').join('').trim();
    return t || myMemory(text);
  }

  // Ảnh minh họa từ Openverse (kho ảnh Creative Commons): ưu tiên CC0/phạm vi công cộng, sau đó giấy phép cho phép dùng thương mại.
  // Trả về { src, credit, link, license } – luôn hiển thị ghi nguồn theo giấy phép.
  async function freeImage(word) {
    const q = encodeURIComponent(word);
    // Chỉ nhận ảnh thực sự liên quan: tiêu đề hoặc thẻ mô tả phải chứa từ (hoặc dạng gốc của từ)
    const stem = word.toLowerCase().replace(/(ies|es|s|ed|ing)$/, '').slice(0, Math.max(4, word.length - 3));
    const relevant = r => {
      const hay = [(r.title || ''), ...(r.tags || []).map(t => t.name || '')].join(' ').toLowerCase();
      return new RegExp(`\\b${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(hay);
    };
    const titleHit = r => new RegExp(`\\b${stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test((r.title || '').toLowerCase());
    const photo = r => r.thumbnail && !r.mature && !/svg|gif/i.test(r.filetype || '') && !/maki|icon|logo|symbol|emblem|coat of arms|\.svg|\.tif|\.pdf|diagram|chart|map of/i.test(r.title || '')
      && (!r.width || r.width >= 400) && (!r.height || !r.width || (r.width / r.height > 0.6 && r.width / r.height < 2.2));
    const pick = d => d && Array.isArray(d.results) && (d.results.find(r => photo(r) && titleHit(r)) || d.results.find(r => photo(r) && relevant(r)));
    const api = qs => fetchJSON(`https://api.openverse.org/v1/images/?q=${q}&page_size=12&mature=false&${qs}`, 3000);
    // 3 truy vấn chạy song song, chọn theo thứ tự ưu tiên: stock CC0 → mọi CC0/PD → CC BY (ghi nguồn)
    const [a1, a2, a3] = await Promise.all([api('license=cc0,pdm&source=stocksnap,rawpixel,nappy,wikimedia'), api('license=cc0,pdm'), api('license_type=commercial&source=wikimedia,flickr')]);
    let r = pick(a1) || pick(a2) || pick(a3);
    if (!r) return null;
    // Ảnh thu nhỏ lấy thẳng từ nguồn (dịch vụ thumb của Openverse đôi khi lỗi 424)
    const thumbOf = r => {
      const u = r.url || '';
      if (/upload\.wikimedia\.org/.test(u)) { const f = decodeURIComponent(u.split('/').pop()); return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(f)}?width=480`; }
      if (/staticflickr\.com/.test(u)) return u.replace(/(_[a-z])?\.jpg$/, '_n.jpg');
      return u || r.thumbnail;
    };
    const lic = (r.license || '').toUpperCase() + (r.license_version && !/cc0|pdm/i.test(r.license) ? ' ' + r.license_version : '');
    return { src: thumbOf(r), link: r.foreign_landing_url || r.url, license: lic,
      credit: `“${(r.title || word).slice(0, 60)}” – ${r.creator || 'không rõ tác giả'} · ${/pdm/i.test(r.license) ? 'Public Domain' : lic} · qua Openverse` };
  }
  // Giữ tên cũ cho mã gọi trước đây
  const wikiImage = async word => { const im = await freeImage(word); return im ? im.src : ''; };


  const POS_SHORT_RAW = { noun: 'n', verb: 'v', adjective: 'adj', adverb: 'adv', preposition: 'prep', conjunction: 'conj', pronoun: 'pron', interjection: 'excl',
    'danh từ': 'n', 'động từ': 'v', 'tính từ': 'adj', 'trạng từ': 'adv', 'giới từ': 'prep', 'liên từ': 'conj', 'đại từ': 'pron', 'thán từ': 'excl' };
  const POS_SHORT = Object.fromEntries(Object.entries(POS_SHORT_RAW).map(([k, v]) => [k.normalize('NFC'), v]));

  // ---------- Bộ nhớ đệm bền (giữ kết quả tra qua các lần mở trang / khởi động lại add-on) ----------
  const persist = {
    async get(w) { try { return g.Core ? await g.Core.Store.get('dc2:' + w, null) : null; } catch (e) { return null; } },
    async set(w, e) {
      try {
        if (!g.Core) return;
        await g.Core.Store.set('dc2:' + w, { ...e, _t: Date.now() });
        const idx = (await g.Core.Store.get('dcIndex', [])).filter(x => x !== w);
        idx.push(w);
        while (idx.length > 150) { const old = idx.shift(); if (g.Core.Store.remove) await g.Core.Store.remove('dc2:' + old); }
        await g.Core.Store.set('dcIndex', idx);
      } catch (e) { /* hết dung lượng: bỏ qua */ }
    },
  };
  const FRESH = 14 * 86400000;

  const normWord = raw => String(raw || '').trim().toLowerCase().replace(/[’]/g, "'").replace(/[^a-z\s'-]/g, '').replace(/\s+/g, ' ');

  function build(word, local, gg, fd, wk, img, sents) {
    const gFirst = gg && gg.defs[0] && gg.defs[0].defs[0];
    const fFirst = fd && fd.meanings[0];
    const anyEx = (gg && gg.defs.flatMap(m => m.defs).find(d => d.ex)) || (fd && fd.meanings.flatMap(m => m.defs).find(d => d.ex));
    const senseVi = gg && gg.senses.length ? gg.senses.map(s => s.terms.slice(0, 3).join(', ')).join('; ') : '';
    const posRaw = ((gg && gg.senses[0] && gg.senses[0].pos) || (gg && gg.defs[0] && gg.defs[0].pos) || (fFirst && fFirst.pos) || '').normalize('NFC').toLowerCase();
    return {
      word,
      found: true,
      ipa: (local && local.ipa) || (wk && wk.ipa) || (fd && fd.ipa) || '',
      ipaUS: (wk && wk.ipaUS) || (fd && fd.ipaUS) || '',
      audio: (fd && fd.audio) || '',
      audioUS: (fd && fd.audioUS) || '',
      pos: (local && local.pos) || POS_SHORT[posRaw] || posRaw,
      vi: (local && local.vi) || (gg && gg.vi && gg.vi.toLowerCase() !== word ? gg.vi : '') || senseVi || '',
      def: (local && local.def) || (gFirst && gFirst.def) || (fFirst && fFirst.defs[0] && fFirst.defs[0].def) || '',
      ex: (local && local.ex) || (anyEx && anyEx.ex) || (sents && sents[0] && sents[0].en) || '',
      col: (local && local.col) || [],
      syn: (local && local.syn && local.syn.length ? local.syn : (gg && gg.syn.length ? gg.syn : (fd ? fd.syn : []))),
      level: (local && local.level) || '',
      emoji: (local && local.emoji) || '',
      topic: (local && local.topic) || 'mine',
      image: (img && img.src) || '',
      imageCredit: img ? { text: img.credit, link: img.link } : null,
      senses: gg ? gg.senses : [],
      oxford: gg ? gg.defs : [],
      meanings: fd ? fd.meanings : [],
      sentences: sents || [],
    };
  }

  /* Tra nhanh (~0,2–0,5 giây): nghĩa, phiên âm, định nghĩa – để hiện ngay; chi tiết bổ sung sau bằng lookup(). */
  const quickCache = new Map();
  async function quick(raw) {
    const word = normWord(raw);
    if (!word) return null;
    if (cache.has(word)) return cache.get(word);
    if (quickCache.has(word)) return quickCache.get(word);
    const saved = await persist.get(word);
    if (saved && Date.now() - saved._t < FRESH) { cache.set(word, saved); return saved; }
    const local = (g.IELTS_DATA && g.IELTS_DATA.INDEX[word]) || null;
    const [gg, wk] = await Promise.all([fromGoogle(word), wiktIPA(word)]);
    const hasGoogle = gg && (gg.senses.length || gg.defs.length);
    if (!local && !hasGoogle) return null;
    const e = { ...build(word, local, gg, null, wk, '', []), partial: true };
    quickCache.set(word, e);
    return e;
  }

  /* Tra đầy đủ: thêm âm thanh, hình ảnh, câu song ngữ, định nghĩa bổ sung. */
  async function lookup(raw, { image = true, examples = true } = {}) {
    const word = normWord(raw);
    if (!word) return null;
    if (cache.has(word)) return cache.get(word);
    const saved = await persist.get(word);
    if (saved && Date.now() - saved._t < FRESH) { cache.set(word, saved); return saved; }

    const local = (g.IELTS_DATA && g.IELTS_DATA.INDEX[word]) || null;
    let [gg, fd, wk, img, sents] = await Promise.all([
      fromGoogle(word),
      fromFreeDict(word),
      wiktIPA(word),
      image ? freeImage(word) : null,
      examples ? sentences(word) : [],
    ]);
    const base = gg && gg.base && gg.base !== word ? gg.base : '';
    if (base && (!fd || (!wk && !(local && local.ipa)))) {
      const [fb, wb] = await Promise.all([fd ? fd : fromFreeDict(base), wk ? wk : wiktIPA(base)]);
      fd = fb; wk = wb;
    }
    const hasGoogle = gg && (gg.senses.length || gg.defs.length);
    if (!local && !fd && !hasGoogle) {
      return { word, found: false, vi: (gg && gg.vi !== word && gg.vi) || await myMemory(word) };
    }
    // Thiếu câu song ngữ → dịch các câu ví dụ Oxford sang tiếng Việt
    if (examples && sents.length < 2 && gg) {
      const exs = gg.defs.flatMap(m => m.defs).map(d => d.ex).filter(Boolean).filter(x => !sents.some(s => s.en === x)).slice(0, 3 - sents.length);
      if (exs.length) {
        const vi = (await translateVi(exs.join('\n'))).split('\n');
        exs.forEach((en, i) => { if (vi[i]) sents.push({ en: en[0].toUpperCase() + en.slice(1), vi: vi[i].trim().replace(/^./, c => c.toUpperCase()), auto: true }); });
      }
    }
    const entry = build(word, local, gg, fd, wk, img, sents);
    if (entry.image && !/^n|danh/.test(entry.pos || '')) { entry.image = ''; entry.imageCredit = null; }
    cache.set(word, entry);
    if (image && examples) persist.set(word, { ...entry, meanings: entry.oxford.length ? [] : entry.meanings.slice(0, 2) });
    return entry;
  }

  g.Dict = { lookup, quick, translateVi, wikiImage, freeImage, sentences, normWord };
})(typeof self !== 'undefined' ? self : this);
