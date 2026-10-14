// Trang tĩnh cho từng bài mẫu Writing Task 2 (SEO): dist/samples/<id>.html + dist/samples/index.html, thêm vào sitemap.
// Nội dung lấy từ dữ liệu app (đề + bài mẫu tự biên soạn) → không tốn chi phí chạy, Google lập chỉ mục được.
import fs from 'node:fs'; import vm from 'node:vm';
const SITE = 'https://vocaband.web.app/';
const ctx = { self: {}, window: {} }; ctx.self = ctx.window = ctx; vm.createContext(ctx);
for (const f of ['write/task2-more', 'models', 'write/models2', 'write/models3', 'write/models4', 'write/models5']) vm.runInContext(fs.readFileSync(`web/js/${f}.js`, 'utf8'), ctx);
const w = fs.readFileSync('web/js/write.js', 'utf8');
const T = (id, type, topic, text) => ({ id, type, topic, text });
const PROMPTS = vm.runInNewContext(w.slice(w.indexOf('const PROMPTS = [') + 16, w.indexOf('];', w.indexOf('const PROMPTS = [')) + 1), { T });
for (const a of ctx.WRITE_MORE || []) if (!PROMPTS.some(p => p.id === a[0])) PROMPTS.push(T(...a));
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const plain = s => s.replace(/<<[^>]*>>\s*/g, '').replace(/\[\[([^|\]]*)\|[^\]]*\]\]/g, '$1').replace(/\{\{([^}]*)\}\}/g, '$1');
const rich = s => esc(s).replace(/&lt;&lt;([^&]*)&gt;&gt;\s*/g, '<span class="lb">$1</span> ').replace(/\[\[([^|\]]*)\|([^\]]*)\]\]/g, '<mark title="$2">$1</mark>').replace(/\{\{([^}]*)\}\}/g, '<b class="ln">$1</b>');
const css = `body{font:17px/1.7 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;margin:0;background:#f5f6fb;color:#1c1d2b}main{max-width:760px;margin:0 auto;padding:20px 16px 60px}a{color:#5b4cf0}.top{display:flex;justify-content:space-between;align-items:center;gap:8px;font-weight:800}.q{background:#fff;border-left:4px solid #5b4cf0;padding:14px 16px;border-radius:12px;font-weight:600}.ess p{background:#fff;padding:14px 16px;border-radius:12px}mark{background:#ede9ff;border-radius:4px;padding:0 2px}.ln{color:#0e8f8e}.lb{display:inline-block;font-size:12px;font-weight:700;color:#fff;background:#8b85ff;border-radius:6px;padding:0 6px;margin-right:4px}table{width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden}td{border-bottom:1px solid #eee;padding:6px 10px;vertical-align:top}.cta{display:inline-block;background:#5b4cf0;color:#fff;padding:12px 18px;border-radius:12px;text-decoration:none;font-weight:700;margin:12px 0}ul.l{padding-left:18px}@media(prefers-color-scheme:dark){body{background:#0f1017;color:#eceef7}.q,.ess p,table{background:#181a24}mark{background:#2a2850;color:#eceef7}td{border-color:#2a2c3b}}`;
const page = (title, desc, canon, body) => `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${canon}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:image" content="${SITE}icons/icon-512.png"><link rel="icon" href="/icons/icon.svg"><style>${css}</style></head><body><main><div class="top"><a href="/" style="text-decoration:none">Vocaband</a><a href="/samples/">Bài mẫu Task 2</a></div>${body}<p class="small" style="color:#888;font-size:13px">© Vocaband – bài mẫu tự biên soạn, miễn phí cho người học.</p></main></body></html>`;
fs.mkdirSync('dist/samples', { recursive: true });
const done = [];
for (const p of PROMPTS) {
  const m = ctx.MODELS.find(x => x.id === 't2-' + p.id); if (!m) continue;
  const gl = [...m.text.matchAll(/\[\[([^|\]]*)\|([^\]]*)\]\]/g)].map(x => [x[1], x[2]]);
  const short = p.text.length > 70 ? p.text.slice(0, 67).replace(/\s+\S*$/, '') + '…' : p.text;
  const title = `IELTS Writing Task 2 bài mẫu band ${m.band}: ${short}`;
  const desc = `Bài mẫu IELTS Writing Task 2 band ${m.band} (${p.type}, ${m.words} từ) có chú giải ${gl.length} cụm từ hay kèm nghĩa tiếng Việt: ${plain(m.text).slice(0, 90)}…`;
  const body = `<h1 style="font-size:24px;line-height:1.3">Bài mẫu IELTS Writing Task 2 – Band ${esc(m.band)}</h1><p>Dạng đề: <b>${esc(p.type)}</b> · ${m.words} từ</p><div class="q">${esc(p.text)}</div>
<a class="cta" href="/#/model/t2-${p.id}">✍️ Luyện viết đề này miễn phí trên Vocaband →</a>
<h2>Bài mẫu</h2><div class="ess">${rich(m.text).split(/\n\s*\n/).map(x => `<p>${x.trim()}</p>`).join('')}</div>
<h2>Từ vựng & cụm từ hay (${gl.length})</h2><table>${gl.map(([e, v]) => `<tr><td><b>${esc(e)}</b></td><td>${esc(v)}</td></tr>`).join('')}</table>
<a class="cta" href="/#/write/${p.id}">📝 Tự viết bài và được chấm điểm ngay →</a>`;
  fs.writeFileSync(`dist/samples/${p.id}.html`, page(title, desc, `${SITE}samples/${p.id}.html`, body));
  done.push([p, m]);
}
const byType = {}; for (const [p, m] of done) (byType[p.type] = byType[p.type] || []).push([p, m]);
fs.writeFileSync('dist/samples/index.html', page(`${done.length} bài mẫu IELTS Writing Task 2 band 8 có chú giải tiếng Việt – Vocaband`, `Trọn bộ ${done.length} bài mẫu IELTS Writing Task 2 band 8 theo từng dạng đề, chú giải cụm từ hay kèm nghĩa tiếng Việt, luyện viết và chấm điểm miễn phí.`, `${SITE}samples/`,
  `<h1>${done.length} bài mẫu IELTS Writing Task 2 (band 8)</h1><p>Tự biên soạn, có chú giải từ vựng tiếng Việt. Bấm vào đề để xem bài mẫu.</p>${Object.entries(byType).map(([ty, xs]) => `<h2>${esc(ty)}</h2><ul class="l">${xs.map(([p]) => `<li><a href="/samples/${p.id}.html">${esc(p.text)}</a></li>`).join('')}</ul>`).join('')}`));
// thêm vào sitemap
const sm = 'dist/sitemap.xml', urls = [`${SITE}samples/`, ...done.map(([p]) => `${SITE}samples/${p.id}.html`)].map(u => `  <url><loc>${u}</loc><changefreq>monthly</changefreq></url>`).join('\n');
fs.writeFileSync(sm, fs.readFileSync(sm, 'utf8').replace('</urlset>', urls + '\n</urlset>'));
console.log(`✓ SEO: ${done.length} trang bài mẫu Task 2 + mục lục`);

// ===== IELTS Speaking: 1 trang / chủ đề (Part 1–3 + câu trả lời mẫu) =====
{
  const sp = fs.readFileSync('web/js/speaking.js', 'utf8'), i0 = sp.indexOf('const BANK = [') + 13;
  const BANK = vm.runInNewContext(sp.slice(i0, sp.indexOf('\n  ];', i0) + 4), { t: s => s });
  const c2 = { self: {}, window: {} }; c2.self = c2.window = c2; vm.createContext(c2);
  for (const f of ['speak/samples', 'speak/more', 'speak/more2', 'speak/more3']) vm.runInContext(fs.readFileSync(`web/js/${f}.js`, 'utf8'), c2);
  for (const x of c2.SPEAK_MORE || []) if (!BANK.some(b => b.title === x.title)) BANK.push(x);
  const S = c2.SPEAK_SAMPLES || {};
  fs.mkdirSync('dist/speaking', { recursive: true });
  const slug = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const qa = (q, part) => { const s = S[q]; return `<h3>${esc(q)}</h3>${part === 2 ? '' : ''}${s ? `<div class="ess"><p>${esc(s.a)}</p></div>${s.vocab && s.vocab.length ? `<table>${s.vocab.map(([e, v]) => `<tr><td><b>${esc(e)}</b></td><td>${esc(v)}</td></tr>`).join('')}</table>` : ''}` : ''}`; };
  const made = [];
  BANK.forEach((b, i) => {
    const id = slug(b.title), title = `IELTS Speaking chủ đề ${b.title}: câu hỏi Part 1, 2, 3 & câu trả lời mẫu`;
    const desc = `Bộ câu hỏi IELTS Speaking chủ đề ${b.title} (Part 1–3) kèm câu trả lời mẫu band 8 và từ vựng nghĩa tiếng Việt. Cue card: ${b.p2.q}`;
    const body = `<h1 style="font-size:24px;line-height:1.3">IELTS Speaking – ${esc(b.title)}</h1><a class="cta" href="/#/speaking/p1/${i}">🎙️ Luyện nói chủ đề này (ghi âm & chấm) →</a>
<h2>Part 1</h2>${b.p1.map(q => qa(q, 1)).join('')}
<h2>Part 2 – Cue card</h2><div class="q">${esc(b.p2.q)}<ul class="l">${b.p2.points.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>${qa(b.p2.q, 2).replace(/^<h3>[^<]*<\/h3>/, '')}
<h2>Part 3</h2>${b.p3.map(q => qa(q, 3)).join('')}<a class="cta" href="/#/speaking/p2/${i}">🗣️ Thử nói Part 2 với đồng hồ đếm giờ →</a>`;
    fs.writeFileSync(`dist/speaking/${id}.html`, page(title, desc, `${SITE}speaking/${id}.html`, body).replace(/<a href="\/samples\/">Bài mẫu Task 2<\/a>/, '<a href="/speaking/">IELTS Speaking</a>'));
    made.push([id, b]);
  });
  fs.writeFileSync('dist/speaking/index.html', page(`${made.length} chủ đề IELTS Speaking có câu trả lời mẫu – Vocaband`, `Trọn bộ ${made.length} chủ đề IELTS Speaking Part 1, 2, 3 với câu trả lời mẫu band 8 và từ vựng tiếng Việt, luyện nói miễn phí.`, `${SITE}speaking/`,
    `<h1>${made.length} chủ đề IELTS Speaking</h1><p>Câu hỏi Part 1–3, cue card Part 2 và câu trả lời mẫu tự biên soạn.</p><ul class="l">${made.map(([id, b]) => `<li><a href="/speaking/${id}.html">${esc(b.title)}</a> – ${esc(b.p2.q)}</li>`).join('')}</ul>`).replace(/<a href="\/samples\/">Bài mẫu Task 2<\/a>/, '<a href="/samples/">Bài mẫu Writing</a>'));
  const urls = [`${SITE}speaking/`, ...made.map(([id]) => `${SITE}speaking/${id}.html`)].map(u => `  <url><loc>${u}</loc><changefreq>monthly</changefreq></url>`).join('\n');
  fs.writeFileSync(sm, fs.readFileSync(sm, 'utf8').replace('</urlset>', urls + '\n</urlset>'));
  console.log(`✓ SEO: ${made.length} trang chủ đề Speaking + mục lục`);
}
