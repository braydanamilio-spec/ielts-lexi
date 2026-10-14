// Tạo file âm thanh chất lượng cao cho bài nghe IELTS/TOEIC bằng Kokoro-82M (Apache-2.0), chạy trên máy, miễn phí.
// Dùng: NODE_PATH=<thư mục có kokoro-js> NODE_USE_ENV_PROXY=1 node scripts/gen-audio.mjs [--limit N]
// Kết quả: web/audio/l/<khóa>.mp3 (mono 40 kbps) + web/js/listen/audio-index.js (danh sách khóa đã có). Bỏ qua file đã tạo → chạy lại an toàn.
import fs from 'node:fs'; import vm from 'node:vm'; import { execFileSync } from 'node:child_process'; import { createRequire } from 'node:module';
const require = createRequire(process.env.NODE_PATH ? process.env.NODE_PATH.split(':')[0] + '/' : import.meta.url);
const OUT = 'web/audio/l', IDX = 'web/js/listen/audio-index.js', TMP = (process.env.TMPDIR || '/tmp') + '/vb-tts.wav';
const limit = +(process.argv[process.argv.indexOf('--limit') + 1] || 0) || Infinity;
fs.mkdirSync(OUT, { recursive: true });
const c = { self: {} }; c.self = c; vm.createContext(c);
vm.runInContext(fs.readFileSync('web/js/listen/kvoice.js', 'utf8'), c);
for (const f of fs.readdirSync('web/js/listen').filter(f => /^test\d+\.js$/.test(f))) vm.runInContext(fs.readFileSync('web/js/listen/' + f, 'utf8'), c);
for (const f of fs.readdirSync('web/js/toeic').filter(f => /^listening\d+\.js$/.test(f))) vm.runInContext(fs.readFileSync('web/js/toeic/' + f, 'utf8'), c);
const parts = [...(c.LISTENING || []), ...((c.TOEIC || {}).listening || [])];
const jobs = new Map();
for (const p of parts) {
  const v = c.KVoice.voices(p);
  for (const l of p.script || []) {
    const text = l.say || l.t; if (!text || l.pause != null) continue;
    const voice = l.say ? v._narrator : (v[l.s] || v._narrator), key = c.KVoice.lineKey(voice, text);
    if (!fs.existsSync(`${OUT}/${key}.mp3`)) jobs.set(key, { voice, text: String(text).trim() });
  }
}
const writeIndex = () => { const keys = fs.readdirSync(OUT).filter(f => f.endsWith('.mp3')).map(f => f.slice(0, -4)).sort(); fs.writeFileSync(IDX, `/* Danh sách câu thoại đã có file âm thanh Kokoro (tự sinh bởi scripts/gen-audio.mjs) */\n(function (g) { g.LISTEN_AUDIO = new Set(${JSON.stringify(keys.join(' '))}.split(' ').filter(Boolean)); })(typeof self !== 'undefined' ? self : this);\n`); return keys.length; };
console.log(`${parts.length} phần nghe · cần tạo ${jobs.size} câu`);
if (jobs.size) {
  const { KokoroTTS } = require('kokoro-js');
  const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: 'q8', device: 'cpu' });
  let n = 0; const t0 = Date.now();
  for (const [key, { voice, text }] of jobs) {
    if (n >= limit) break;
    const a = await tts.generate(text, { voice, speed: 1 });
    await a.save(TMP);
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', TMP, '-ac', '1', '-ar', '24000', '-b:a', '40k', `${OUT}/${key}.mp3`]);
    if (++n % 25 === 0) { writeIndex(); console.log(`${n}/${jobs.size} · ${Math.round((Date.now() - t0) / 1000)}s`); }
  }
}
console.log(`✓ audio-index: ${writeIndex()} câu có giọng Kokoro`);
