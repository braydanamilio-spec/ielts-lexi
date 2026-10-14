/* Giọng đọc chất lượng cao cho bài nghe (Kokoro-82M, Apache-2.0): file mp3 tạo sẵn cho từng câu thoại.
 * Dùng chung cho trình phát (trình duyệt) và scripts/gen-audio.mjs (Node) → tên file luôn khớp.
 * Mỗi người nói nhận 1 giọng cố định theo giọng Anh/Mỹ/Úc + giới tính; lời dẫn đề dùng giọng người dẫn riêng. */
(function (g) {
  const POOL = {
    'en-GB:f': ['bf_emma', 'bf_isabella', 'bf_alice', 'bf_lily'], 'en-GB:m': ['bm_lewis', 'bm_daniel', 'bm_fable', 'bm_george'],
    'en-US:f': ['af_heart', 'af_bella', 'af_nicole', 'af_sarah'], 'en-US:m': ['am_michael', 'am_adam', 'am_eric', 'am_liam'],
    // Kokoro chưa có giọng Úc → dùng giọng Anh khác với các người nói còn lại
    'en-AU:f': ['bf_lily', 'bf_alice', 'bf_isabella', 'bf_emma'], 'en-AU:m': ['bm_fable', 'bm_daniel', 'bm_lewis', 'bm_george'],
  };
  const NARRATOR = 'bm_george';
  function voices(p) {
    const used = new Set([NARRATOR]), out = { _narrator: NARRATOR };
    for (const [k, s] of Object.entries(p.speakers || {})) {
      const pool = POOL[`${s.accent || 'en-GB'}:${s.gender === 'f' ? 'f' : 'm'}`] || POOL['en-GB:m'];
      const v = pool.find(x => !used.has(x)) || pool[0]; used.add(v); out[k] = v;
    }
    return out;
  }
  // FNV-1a 32-bit → base36: khóa file theo giọng + nội dung câu (đổi chữ là tự tạo file mới)
  const hash = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36); };
  const lineKey = (voice, text) => hash(voice + '|' + String(text).trim());
  g.KVoice = { voices, lineKey, NARRATOR };
})(typeof self !== 'undefined' ? self : this);
