#!/usr/bin/env bash
# Gắn CDN jsDelivr (đúng commit đã đẩy lên GitHub) vào dist/index.html → phần nặng tải từ CDN miễn phí, không tốn băng thông Firebase.
# Chỉ gắn khi commit hiện tại đã có trên GitHub (jsDelivr lấy file từ đó); chưa đẩy thì bỏ qua – app tự dùng máy chủ chính.
set -euo pipefail
cd "$(dirname "$0")/.."
git fetch -q origin 2>/dev/null || true
SHA=$(git rev-parse HEAD)
if git branch -r --contains "$SHA" 2>/dev/null | grep -q origin/; then
  sed -i '' -e '/name="vb-cdn"/d' -e "s#  <meta name=\"theme-color\"#  <meta name=\"vb-cdn\" content=\"https://cdn.jsdelivr.net/gh/braydanamilio-spec/ielts-lexi@${SHA}/web/\">\n  <meta name=\"theme-color\"#" dist/index.html
  echo "✓ CDN: jsDelivr @${SHA:0:7}"
else
  echo "⚠ commit chưa có trên GitHub – không dùng CDN lần này"
fi
