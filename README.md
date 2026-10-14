# Vocaband – Từ điển & Flashcard luyện từ vựng IELTS

Gồm 2 phần dùng **chung một mã nguồn** (`web/`):

| Phần | Thư mục | Dùng để |
|---|---|---|
| Web app (PWA) | `web/` | Học trên máy tính / điện thoại, cài như app, dùng offline |
| Add-on Chrome | `extension/` | Bấm đúp vào từ trên **mọi trang web** để tra & lưu kèm ngữ cảnh, nhắc học hằng ngày |

## Tính năng
- **Từ điển Anh–Việt**: phiên âm IPA giọng Anh–Anh (chuẩn Oxford) và Anh–Mỹ, nghe phát âm UK/US, nghĩa tiếng Việt, định nghĩa, ví dụ, từ đồng nghĩa, **hình minh họa**.
- **144 từ IELTS chọn lọc** theo 12 chủ đề (Giáo dục, Môi trường, Công nghệ, Sức khỏe, Công việc, Xã hội, Tội phạm, Truyền thông, Đô thị, Du lịch, Writing Task 1, Writing Task 2) – mỗi từ có cấp độ CEFR, collocation, câu ví dụ học thuật, emoji minh họa.
- **Flashcard lặp lại ngắt quãng (SRS, thuật toán SM-2 kiểu Anki)**: 4 mức Quên / Khó / Nhớ / Dễ, hiển thị trước khoảng ôn tiếp theo, giới hạn số từ mới mỗi ngày, lật 2 chiều (Anh→Việt, Việt→Anh với câu điền khuyết), phím tắt `Space`, `1–4`, `P`.
- **Từ gắn theo ngữ cảnh**: khi lưu từ (từ trang web qua add-on hoặc tự dán), câu gốc được lưu lại và hiện trên thẻ với từ được tô sáng.
- **Luyện tập**: trắc nghiệm nghĩa, điền từ vào câu IELTS, nghe & chép chính tả.
- **Nhắc học hằng ngày**: thông báo theo giờ đã đặt (add-on: `chrome.alarms`, chạy cả khi chưa mở app; web: thông báo khi trang đang mở + file lịch `.ics` lặp hằng ngày cho điện thoại), số thẻ cần ôn trên biểu tượng add-on.
- Chuỗi ngày học 🔥, biểu đồ 14 ngày, mục tiêu ngày, sổ từ có lọc/sửa/ghi chú mẹo nhớ, xuất/nhập JSON.

## Chạy web app
```bash
cd web && python3 -m http.server 5173
```
Mở http://localhost:5173 . Để đưa lên mạng, deploy thư mục `web/` lên bất kỳ host tĩnh nào (GitHub Pages, Netlify, Vercel, Cloudflare Pages) – cần HTTPS để PWA và thông báo hoạt động.

## Cài add-on Chrome
```bash
./scripts/build-extension.sh
```
Sau đó mở `chrome://extensions` → bật **Developer mode** → **Load unpacked** → chọn thư mục `extension/`.
- Bấm đúp vào một từ → hiện bảng tra; **bôi đen cụm từ + giữ Alt** khi thả chuột để tra cụm (vd. *life expectancy*); hoặc chuột phải → *Tra “…” với Vocaband*.
- `Alt+L` mở popup tra nhanh.
- `./scripts/build-extension.sh --zip` tạo file zip để đăng lên Chrome Web Store.

> Sau khi sửa code trong `web/`, chạy lại `build-extension.sh` rồi bấm ↻ ở trang `chrome://extensions`.

## Cấu trúc
```
web/
  index.html, css/style.css, sw.js, manifest.webmanifest, icons/
  js/data.js        bộ từ IELTS theo chủ đề
  js/core.js        lưu trữ (localStorage / chrome.storage), SRS, thẻ, thống kê
  js/dictionary.js  tra từ: bộ từ có sẵn + API miễn phí
  js/app.js         giao diện: trang chủ, tra từ, chủ đề, ôn tập, luyện tập, sổ từ, cài đặt
extension/
  manifest.json, background.js (nhắc học, badge, tra từ), content.js (bảng tra trên trang), popup.*
  app/  ← bản sao của web/ do build-extension.sh tạo
scripts/  build-extension.sh, make_icons.py
```

## Nguồn dữ liệu (miễn phí, không cần API key)
- [dictionaryapi.dev](https://dictionaryapi.dev) – phiên âm, audio, định nghĩa, ví dụ
- [MyMemory](https://mymemory.translated.net) – dịch nghĩa sang tiếng Việt cho từ ngoài bộ IELTS (giới hạn ~5.000 từ/ngày/IP)
- [Wikipedia REST API](https://en.wikipedia.org/api/rest_v1/) – hình minh họa

Phiên âm/nghĩa trong bộ 144 từ do dự án biên soạn theo chuẩn IPA Anh–Anh, không phải dữ liệu chính thức của Oxford University Press. Hình từ Wikipedia lấy tự động nên đôi khi chưa sát nghĩa – sửa trong **Sổ từ → ✏️**.

## Lưu ý
- Dữ liệu học lưu cục bộ: web dùng `localStorage`, add-on dùng `chrome.storage` (riêng biệt). Dùng **Xuất / Nhập** trong Sổ từ để chuyển qua lại.
- Hướng phát triển: tài khoản & đồng bộ đám mây (Supabase/Firebase), mở rộng lên Oxford 3000/5000 + AWL, chấm phát âm bằng Web Speech Recognition, bộ đề Reading có tra từ trực tiếp.
