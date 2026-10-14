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
    const d = await fetchJSON(`${GTX}&dt=t&dt=bd&dt=md&dt=ex&dt=ss&q=${encodeURIComponent(word)}`);
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
    const data = await fetchJSON(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, 3500);
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
    const d = await fetchJSON(`https://api.tatoeba.org/unstable/sentences?lang=eng&q=${encodeURIComponent(word)}&trans:lang=vie&sort=relevance&limit=20&showtrans=matching`, 5000);
    if (!d || !Array.isArray(d.data)) return [];
    return d.data
      .map(x => ({ en: x.text, vi: ((x.translations || []).flat().find(t => t && t.lang === 'vie') || (x.translations || []).flat()[0] || {}).text || '' }))
      .filter(x => x.vi && x.en.split(' ').length >= 5)
      .sort((a, b) => Math.abs(a.en.length - 70) - Math.abs(b.en.length - 70))
      .slice(0, limit);
  }

  // Phiên âm UK/US từ Wiktionary (khi dictionaryapi.dev thiếu); đổi ɹ → r theo quy ước từ điển Oxford
  async function wiktIPA(word) {
    const d = await fetchJSON(`https://en.wiktionary.org/w/api.php?action=parse&page=${encodeURIComponent(word)}&prop=wikitext&format=json&formatversion=2&origin=*`);
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

  async function wikiImage(word) {
    const d = await fetchJSON(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(word.replace(/ /g, '_'))}`);
    if (!d || d.type === 'disambiguation') return '';
    return (d.thumbnail && d.thumbnail.source) || '';
  }

  const POS_SHORT_RAW = { noun: 'n', verb: 'v', adjective: 'adj', adverb: 'adv', preposition: 'prep', conjunction: 'conj', pronoun: 'pron', interjection: 'excl',
    'danh từ': 'n', 'động từ': 'v', 'tính từ': 'adj', 'trạng từ': 'adv', 'giới từ': 'prep', 'liên từ': 'conj', 'đại từ': 'pron', 'thán từ': 'excl' };
  const POS_SHORT = Object.fromEntries(Object.entries(POS_SHORT_RAW).map(([k, v]) => [k.normalize('NFC'), v]));

  /* Trả về entry chuẩn hóa:
   * {word, found, ipa, ipaUS, audio, audioUS, pos, vi, def, ex, col, syn, level, emoji, image, topic,
   *  senses[{pos, terms}], oxford[{pos, defs[{def, ex}]}], meanings[...], sentences[{en, vi}]}
   */
  async function lookup(raw, { image = true, examples = true } = {}) {
    const word = String(raw || '').trim().toLowerCase().replace(/[^a-z\s'-]/g, '').replace(/\s+/g, ' ');
    if (!word) return null;
    if (cache.has(word)) return cache.get(word);

    const local = (g.IELTS_DATA && g.IELTS_DATA.INDEX[word]) || null;
    let [gg, fd, wk, img, sents] = await Promise.all([
      fromGoogle(word),
      fromFreeDict(word),
      local && local.ipa ? null : wiktIPA(word),
      image ? wikiImage(word) : '',
      examples ? sentences(word) : [],
    ]);
    // Từ biến đổi (vd. "recruited") → lấy phiên âm của dạng gốc
    const base = gg && gg.base && gg.base !== word ? gg.base : '';
    if (base && (!fd || (!wk && !(local && local.ipa)))) {
      const [fb, wb] = await Promise.all([fd ? fd : fromFreeDict(base), wk ? wk : wiktIPA(base)]);
      fd = fb; wk = wb;
    }
    // Thiếu câu song ngữ → dịch các câu ví dụ Oxford sang tiếng Việt
    if (examples && sents.length < 2 && gg) {
      const exs = gg.defs.flatMap(m => m.defs).map(d => d.ex).filter(Boolean).filter(x => !sents.some(s => s.en === x)).slice(0, 3 - sents.length);
      if (exs.length) {
        const vi = (await translateVi(exs.join('\n'))).split('\n');
        exs.forEach((en, i) => { if (vi[i]) sents.push({ en: en[0].toUpperCase() + en.slice(1), vi: vi[i].trim().replace(/^./, c => c.toUpperCase()), auto: true }); });
      }
    }

    const hasGoogle = gg && (gg.senses.length || gg.defs.length);
    if (!local && !fd && !hasGoogle) {
      return { word, found: false, vi: (gg && gg.vi !== word && gg.vi) || await myMemory(word) };
    }

    const gFirst = gg && gg.defs[0] && gg.defs[0].defs[0];
    const fFirst = fd && fd.meanings[0];
    const anyEx = (gg && gg.defs.flatMap(m => m.defs).find(d => d.ex)) || (fd && fd.meanings.flatMap(m => m.defs).find(d => d.ex));
    const senseVi = gg && gg.senses.length ? gg.senses.map(s => s.terms.slice(0, 3).join(', ')).join('; ') : '';
    const posRaw = ((gg && gg.senses[0] && gg.senses[0].pos) || (gg && gg.defs[0] && gg.defs[0].pos) || (fFirst && fFirst.pos) || '').normalize('NFC').toLowerCase();

    const entry = {
      word,
      found: true,
      ipa: (local && local.ipa) || (wk && wk.ipa) || (fd && fd.ipa) || '',
      ipaUS: (wk && wk.ipaUS) || (fd && fd.ipaUS) || '',
      audio: (fd && fd.audio) || '',
      audioUS: (fd && fd.audioUS) || '',
      pos: (local && local.pos) || POS_SHORT[posRaw] || posRaw,
      vi: (local && local.vi) || (gg && gg.vi && gg.vi.toLowerCase() !== word ? gg.vi : '') || senseVi || '',
      def: (local && local.def) || (gFirst && gFirst.def) || (fFirst && fFirst.defs[0] && fFirst.defs[0].def) || '',
      ex: (local && local.ex) || (anyEx && anyEx.ex) || (sents[0] && sents[0].en) || '',
      col: (local && local.col) || [],
      syn: (local && local.syn && local.syn.length ? local.syn : (gg && gg.syn.length ? gg.syn : (fd ? fd.syn : []))),
      level: (local && local.level) || '',
      emoji: (local && local.emoji) || '',
      topic: (local && local.topic) || 'mine',
      image: img || '',
      senses: gg ? gg.senses : [],
      oxford: gg ? gg.defs : [],
      meanings: fd ? fd.meanings : [],
      sentences: sents,
    };
    cache.set(word, entry);
    return entry;
  }

  g.Dict = { lookup, translateVi, wikiImage, sentences };
})(typeof self !== 'undefined' ? self : this);
