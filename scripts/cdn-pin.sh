#!/usr/bin/env bash
# Gắn CDN jsDelivr (đúng commit đã đẩy lên GitHub) vào dist/index.html → phần nặng tải từ CDN miễn phí, không tốn băng thông Firebase.
# Trước khi gắn: "hâm nóng" CDN (tải trước mọi file 1 lần) để người dùng đầu tiên không phải chờ jsDelivr lấy file từ GitHub.
# Commit chưa có trên GitHub hoặc hâm nóng lỗi → không gắn, app tự dùng máy chủ chính.
set -uo pipefail
cd "$(dirname "$0")/.."
sed -i '' '/name="vb-cdn"/d' dist/index.html
git fetch -q origin 2>/dev/null || true
SHA=$(git rev-parse HEAD)
git branch -r --contains "$SHA" 2>/dev/null | grep -q origin/ || { echo "⚠ commit chưa có trên GitHub – không dùng CDN lần này"; exit 0; }
BASE="https://cdn.jsdelivr.net/gh/braydanamilio-spec/ielts-lexi@${SHA}/web/"
FILES=$(node -e "const s=require('fs').readFileSync('web/js/app.js','utf8');const a=s.indexOf(\"const G = 'js/grammar/', BUNDLES = {\"),b=s.indexOf('\n  };',a);const B=new Function(s.slice(a,b+4)+';return BUNDLES')();console.log([...new Set(Object.values(B).flat())].join('\n'))")
warm() { echo "$1" | grep . | xargs -P 8 -I{} sh -c 'c=$(curl -s -o /dev/null -w "%{http_code}" -m 60 "'"$BASE"'{}"); [ "$c" = 200 ] || echo "{}"'; }
TODO="$FILES"
for try in 1 2 3 4 5 6; do
  TODO=$(warm "$TODO")
  [ -z "$TODO" ] && break
  echo "… $(echo "$TODO" | wc -l | tr -d ' ') file chưa sẵn sàng trên CDN, thử lại sau 30s (lần $try)"; sleep 30
done
if [ -n "$TODO" ]; then echo "$TODO"; echo "⚠ hâm nóng CDN lỗi – không dùng CDN lần này"; exit 0; fi
sed -i '' "s#  <meta name=\"theme-color\"#  <meta name=\"vb-cdn\" content=\"${BASE}\">\n  <meta name=\"theme-color\"#" dist/index.html
echo "✓ CDN: jsDelivr @${SHA:0:7} ($(echo "$FILES" | wc -l | tr -d ' ') file đã hâm nóng)"
