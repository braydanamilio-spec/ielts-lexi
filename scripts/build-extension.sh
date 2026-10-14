#!/usr/bin/env bash
# Chép web app vào extension/app để add-on dùng chung mã nguồn với bản web.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
rm -rf "$ROOT/extension/app" "$ROOT/extension/icons"
mkdir -p "$ROOT/extension/app" "$ROOT/extension/icons"
cp -R "$ROOT/web/index.html" "$ROOT/web/manifest.webmanifest" "$ROOT/web/css" "$ROOT/web/js" "$ROOT/web/icons" "$ROOT/extension/app/"
cp "$ROOT"/web/icons/icon-{16,32,48,128}.png "$ROOT/extension/icons/"
echo "✓ Đã build add-on vào $ROOT/extension"
if [[ "${1:-}" == "--zip" ]]; then
  (cd "$ROOT/extension" && rm -f ../ielts-lexi-extension.zip && zip -qr ../ielts-lexi-extension.zip . -x '.*')
  echo "✓ Đã tạo ielts-lexi-extension.zip (để đăng lên Chrome Web Store)"
fi
