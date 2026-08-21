# 404 Arcade

Trang 404 kiểu **Retro Arcade hiện đại**: khi người dùng lạc vào đường dẫn không tồn tại, họ có thể quay về trang chủ **hoặc chơi ngay một trong 21 mini game** ngay trên trang — không reload, không backend, không framework, không CDN.

Toàn bộ game được đóng gói thành Web Component **`<arcade-404>`** trong thư mục [`404-arcade/`](404-arcade/). File `index.html` ở gốc repo là trang 404 mẫu, nạp bản build IIFE (một file duy nhất, không cần module server).

## Danh sách game (21)

| # | Game | Loại |
|---|---|---|
| 1 | Endless Runner | 2D chạy vô tận |
| 2 | Bug Hunter | 2D click diệt bọ |
| 3 | Stack Tower | 2D xếp tầng |
| 4 | Snake | 2D rắn săn mồi |
| 5 | 404 Strike | **3D FPS (WebGL)** |
| 6 | Portal Puzzle 404 | 2D puzzle 15 màn |
| 7 | Void Runner 404 | **3D Parkour (WebGL)** |
| 8 | Neon Drift 404 | 2D đua xe top-down |
| 9 | Cyber Defense | 2D tower defense |
| 10 | Rogue Arena | 2D survival 3 phút |
| 11 | Rhythm Hack | 2D rhythm 4 lane |
| 12 | Brick Breaker 404 | 2D phá gạch 10 màn |
| 13 | Laser Maze 404 | 2D puzzle laser 20 màn |
| 14 | Pixel Golf 404 | 2D mini golf 9 hố |
| 15 | Typing Rush 404 | 2D gõ phím tốc độ |
| 16 | Astro Patrol 404 | 2D bắn phi thuyền dọc |
| 17 | Neon Pinball 404 | 2D pinball |
| 18 | Gravity Flip 404 | 2D đảo trọng lực |
| 19 | Memory Matrix 404 | 2D ghi nhớ ma trận |
| 20 | Cyber Goal 404 | 2D sút luân lưu |
| 21 | Stealth Escape 404 | 2D lẻn qua tuần tra |

Điểm cao + lựa chọn âm thanh lưu bằng `localStorage` (có namespace). CSS cô lập trong shadow DOM. Toàn bộ SFX tổng hợp bằng WebAudio — không file âm thanh ngoài.

---

## 1. Cách chạy

Dự án là static site thuần — chỉ cần một static server bất kỳ tại gốc repo:

```bash
# Cách 1: Python (có sẵn trên hầu hết máy)
python3 -m http.server 8404

# Cách 2: Node.js
npx serve .

# Cách 3: VS Code — cài extension "Live Server" rồi bấm "Go Live"
```

Sau đó mở <http://localhost:8404> — trang 404 hiển thị đầy đủ 21 game.

**Yêu cầu trình duyệt:** Chrome / Edge / Firefox / Safari hiện đại. Hai game 3D (404 Strike, Void Runner 404) cần WebGL + Pointer Lock, tối ưu cho desktop.

---

## 2. Cấu trúc dự án

```
404-minigame/
├── index.html          # Trang 404 mẫu — nạp <arcade-404> từ bản build IIFE
├── 404-arcade/         # Source + build của Web Component <arcade-404>
│   ├── src/            # ES modules: core (registry, controller, audio…) + 21 game
│   ├── dist/           # Bản build: arcade-404.iife.js (1 file), es/ (lazy-load), arcade-404.css
│   ├── tools/          # bundle.mjs (bundler offline) + harness QA (Chrome headless/CDP)
│   ├── tests/          # unit test (node --test)
│   └── README.md       # Tài liệu chi tiết: API, kiến trúc, cách thêm game
├── 404-strite/                        # Plan + ảnh tham chiếu (404 Strike)
├── 404-arcade-void-runner-3d/         # Plan + ảnh tham chiếu (Void Runner)
├── 404-arcade-expansion-5-games/      # Plan + ảnh tham chiếu (game 6–10)
├── 404-arcade-expansion-games-11-15/  # Plan + ảnh tham chiếu (game 11–15)
└── 404-arcade-expansion-games-16-20/  # Plan + ảnh tham chiếu (game 16–20)
```

Chi tiết kiến trúc, Public API (attributes / events / CSS variables), cách thêm game mới và cách build: xem [`404-arcade/README.md`](404-arcade/README.md).

---

## 3. Tích hợp vào trang 404 của website khác

1. Copy thư mục `404-arcade/dist/` vào website của bạn (ví dụ `/vendor/404-arcade/`).
2. Tạo trang 404 nạp bản IIFE (tham khảo `index.html` ở gốc repo):

```html
<script src="/vendor/404-arcade/arcade-404.iife.js" defer></script>
<arcade-404 home-url="https://ten-mien-cua-ban.com" locale="vi"></arcade-404>
```

3. Trỏ trang lỗi của server về trang đó:

```nginx
# Nginx
error_page 404 /404/index.html;
```

```apache
# Apache (.htaccess)
ErrorDocument 404 /404/index.html
```

> Dùng framework (React / Next.js) hoặc muốn giữ lazy-load từng game (bản ES modules): xem `404-arcade/examples/` và `404-arcade/README.md`.

---

## 4. Build / test (trong `404-arcade/`)

```bash
node tools/bundle.mjs              # build lại dist/ bằng bundler offline
npm test                           # unit test (node --test)
node tools/verify-pointerlock.mjs  # kiểm chứng pointer lock 2 game 3D (Chrome headless)
```

---

## 5. Ghi chú chất lượng

- Không phát âm thanh trước tương tác đầu tiên (tuân thủ chính sách autoplay).
- `Esc` đóng game, `P` tạm dừng, tự pause khi tab bị ẩn (`visibilitychange`).
- Hỗ trợ keyboard / chuột / cảm ứng; các game 2D responsive từ 360px, joystick/d-pad ảo trên mobile.
- Tôn trọng `prefers-reduced-motion`; focus state rõ ràng, thao tác được bằng bàn phím.
- Không dùng `eval` / `innerHTML` với dữ liệu động.

### Hạn chế hiện tại

- Điểm lưu cục bộ theo trình duyệt (localStorage), không có bảng xếp hạng online.
- SFX là tiếng "chip-tune" tổng hợp, chưa có nhạc nền (trừ Rhythm Hack).
- Cần trình duyệt hiện đại (2023+); không hỗ trợ IE/Safari cũ.
