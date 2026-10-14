#!/usr/bin/env bash
# Build add-on, commit + push lên GitHub (tự deploy GitHub Pages), deploy Firebase Hosting.
set -euo pipefail
cd "$(dirname "$0")/.."
./scripts/build-extension.sh
git add -A
git diff --cached --quiet || git commit -q -m "${1:-Cập nhật IELTS Lexi}

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -q
firebase deploy --only hosting
