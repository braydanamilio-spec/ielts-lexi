#!/usr/bin/env bash
# CDN jsDelivr theo TỪNG FILE: mỗi file trỏ tới commit cuối cùng đã sửa nó (đã có trên GitHub). File không đổi giữa các lần
# phát hành → URL không đổi → luôn sẵn trong cache CDN. File mới sửa: hâm nóng (thử lại tới ~3 phút); chưa sẵn thì bỏ khỏi danh sách
# → riêng file đó lấy từ máy chủ chính. Kết quả ghi vào dist/index.html dạng <script type="application/json" id="vb-cdn">.
set -uo pipefail
cd "$(dirname "$0")/.."
git fetch -q origin 2>/dev/null || true
node - <<'JS'
const { execSync } = require('child_process'), fs = require('fs');
const sh = c => { try { return execSync(c, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch (e) { return ''; } };
const src = fs.readFileSync('web/js/app.js', 'utf8'), a = src.indexOf("const G = 'js/grammar/', BUNDLES = {"), b = src.indexOf('\n  };', a);
const files = [...new Set(Object.values(new Function(src.slice(a, b + 4) + ';return BUNDLES')()).flat())];
const dirty = new Set(sh('git status --porcelain web').split('\n').map(l => l.slice(3).replace(/^web\//, '')));
const map = {};
for (const f of files) {
  if (dirty.has(f)) continue;                                   // chưa commit → không có trên GitHub
  const sha = sh(`git log -1 --format=%H -- web/${f}`);
  if (sha && sh(`git branch -r --contains ${sha}`).includes('origin/')) map[f] = sha;
}
fs.writeFileSync(process.env.TMPDIR + '/cdnmap.json', JSON.stringify(map));
JS
BASE="https://cdn.jsdelivr.net/gh/braydanamilio-spec/ielts-lexi@"
check() { # kiểm tra song song (8 luồng) từng URL; in ra URL chưa sẵn sàng. Không dùng xargs -I (macOS giới hạn 255 ký tự)
  local out="${TMPDIR:-/tmp}/cdnbad.$$"; : > "$out"
  node -e "const m=require(process.env.TMPDIR+'/cdnmap.json');for(const [f,s] of Object.entries(m))console.log(s+'/web/'+f)" | while read -r u; do
    while [ "$(jobs -rp | wc -l)" -ge 8 ]; do sleep 0.2; done
    { c=$(curl -s -o /dev/null -w "%{http_code}" -m 60 "$BASE$u"); [ "$c" = 200 ] || echo "$u" >> "$out"; } &
  done
  wait; cat "$out"; rm -f "$out"
}
for try in 1 2 3 4 5 6; do
  BAD=$(check); [ -z "$BAD" ] && break
  echo "… $(echo "$BAD" | wc -l | tr -d ' ') file mới sửa chưa sẵn trên CDN, thử lại sau 30s (lần $try)"; sleep 30
done
# File vẫn chưa sẵn sàng → bỏ khỏi bản đồ (lấy từ máy chủ chính); còn lại vẫn dùng CDN
node -e "const fs=require('fs');const p=process.env.TMPDIR+'/cdnmap.json';const m=JSON.parse(fs.readFileSync(p));const bad=process.argv[1].split('\n').filter(Boolean);for(const x of bad){const f=x.replace(/^[0-9a-f]+\/web\//,'');delete m[f]}
let h=fs.readFileSync('dist/index.html','utf8').replace(/\n  <script type=\"application\/json\" id=\"vb-cdn\">[^<]*<\/script>/,'').replace(/\n  <meta name=\"vb-cdn\"[^>]*>/,'');
h=h.replace('  <meta name=\"theme-color\"','  <script type=\"application/json\" id=\"vb-cdn\">'+JSON.stringify({base:'$BASE',files:m})+'</script>\n  <meta name=\"theme-color\"');fs.writeFileSync('dist/index.html',h);
console.log('✓ CDN: '+Object.keys(m).length+' file qua jsDelivr'+(bad.length?', '+bad.length+' file lấy từ máy chủ chính':''))" "${BAD:-}"
