#!/usr/bin/env bash
# Build add-on, commit + push lên GitHub (tự deploy GitHub Pages), deploy Firebase Hosting.
set -euo pipefail
cd "$(dirname "$0")/.."
# Mỗi lần deploy đổi tên cache của service worker → người dùng nhận bản mới đồng bộ
sed -i '' "s/const CACHE = '[^']*';/const CACHE = 'vocaband-$(date +%Y%m%d%H%M%S)';/" web/sw.js
./scripts/build-extension.sh
# Chỉ commit mã nguồn & tài nguyên của dự án (không đưa tài liệu cá nhân lên GitHub)
git add web extension scripts store brand README.md firebase.json firestore.rules .firebaserc .gitignore .github
git diff --cached --quiet || git commit -q -m "${1:-Cập nhật Vocaband}

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -q
firebase deploy --only hosting
