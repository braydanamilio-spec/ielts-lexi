/* Tra từ: ưu tiên bộ từ IELTS có sẵn, bổ sung từ các API miễn phí, không cần key:
 *  - dictionaryapi.dev  : phiên âm, audio UK/US, định nghĩa, ví dụ, từ đồng nghĩa
 *  - MyMemory           : dịch nghĩa sang tiếng Việt
 *  - Wikipedia REST     : hình minh họa
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

  async function fromFreeDict(word) {
    const data = await fetchJSON(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
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

  async function translateVi(text) {
    const d = await fetchJSON(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|vi`);
    const t = d && d.responseData && d.responseData.translatedText;
    if (!t || /MYMEMORY WARNING|INVALID/i.test(t)) return '';
    return t;
  }

  async function wikiImage(word) {
    const d = await fetchJSON(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(word.replace(/ /g, '_'))}`);
    if (!d || d.type === 'disambiguation') return '';
    return (d.thumbnail && d.thumbnail.source) || '';
  }

  const POS_SHORT = { noun: 'n', verb: 'v', adjective: 'adj', adverb: 'adv', preposition: 'prep', conjunction: 'conj', pronoun: 'pron', interjection: 'excl' };

  /* Trả về entry chuẩn hóa:
   * {word, ipa, ipaUS, audio, audioUS, pos, vi, def, ex, col, syn, level, emoji, image, meanings[], topic, found}
   */
  async function lookup(raw, { image = true } = {}) {
    const word = String(raw || '').trim().toLowerCase().replace(/[^a-z\s'-]/g, '').replace(/\s+/g, ' ');
    if (!word) return null;
    if (cache.has(word)) return cache.get(word);

    const local = (g.IELTS_DATA && g.IELTS_DATA.INDEX[word]) || null;
    const [fd, vi, img] = await Promise.all([
      fromFreeDict(word),
      local ? Promise.resolve(local.vi) : translateVi(word),
      image ? wikiImage(word) : Promise.resolve(''),
    ]);

    if (!local && !fd) {
      const res = { word, found: false, vi };
      return res;
    }

    const first = fd && fd.meanings[0];
    const firstDef = first && first.defs[0];
    const firstEx = fd && fd.meanings.flatMap(m => m.defs).find(d => d.ex);
    const entry = {
      word,
      found: true,
      ipa: (local && local.ipa) || (fd && fd.ipa) || '',
      ipaUS: (fd && fd.ipaUS) || '',
      audio: (fd && fd.audio) || '',
      audioUS: (fd && fd.audioUS) || '',
      pos: (local && local.pos) || (first ? (POS_SHORT[first.pos] || first.pos) : ''),
      vi: (local && local.vi) || vi || '',
      def: (local && local.def) || (firstDef && firstDef.def) || '',
      ex: (local && local.ex) || (firstEx && firstEx.ex) || '',
      col: (local && local.col) || [],
      syn: (local && local.syn && local.syn.length ? local.syn : (fd ? fd.syn : [])),
      level: (local && local.level) || '',
      emoji: (local && local.emoji) || '',
      topic: (local && local.topic) || 'mine',
      image: img || '',
      meanings: fd ? fd.meanings : [],
    };
    cache.set(word, entry);
    return entry;
  }

  g.Dict = { lookup, translateVi, wikiImage };
})(typeof self !== 'undefined' ? self : this);
