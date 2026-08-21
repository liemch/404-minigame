# 404 Arcade — Web Component `<arcade-404>`

Trang 404 dạng arcade đóng gói thành **một Web Component độc lập**: nhúng được vào HTML thuần, React, Next.js hay bất kỳ hệ thống nào mà không phụ thuộc framework. Gồm **5 mini game**:

| Game | Loại | Điều khiển |
|---|---|---|
| Endless Runner | 2D Canvas | Space / ↑ / W / chạm |
| Bug Hunter | 2D Canvas | Click / chạm (30 giây, combo) |
| Stack Tower | 2D Canvas | Click / Space / chạm |
| Snake | 2D Canvas | Mũi tên / WASD / vuốt / d-pad |
| **404 Strike** | **3D FPS (WebGL)** | WASD + chuột, Pointer Lock, desktop-first |

Điểm cao + cài đặt lưu bằng `localStorage` (có namespace). CSS cô lập trong shadow DOM. Không backend, không CDN, không đăng nhập.

---

## 1. Chạy thử nhanh

```bash
cd 404-arcade
python3 -m http.server 8404      # hoặc npx serve / Live Server
# mở http://localhost:8404
```

`index.html` ở gốc package là trang demo dùng thẳng `src/` (buildless ES modules).

## 2. Nhúng vào dự án

### HTML thuần (IIFE — một file, không cần bundler)

```html
<link rel="stylesheet" href="/vendor/404-arcade/arcade-404.css">
<script src="/vendor/404-arcade/arcade-404.iife.js" defer></script>

<arcade-404 home-url="/"></arcade-404>
```

### ES Modules (giữ lazy-load từng game — khuyến nghị)

```html
<script type="module" src="/vendor/404-arcade/es/index.js"></script>
<arcade-404 home-url="/"></arcade-404>
```

### React / Next.js

Xem `examples/react/` và `examples/nextjs/` (client wrapper cho App Router, chặn điều hướng bằng sự kiện `arcade:home` để dùng router của SPA).

Trỏ trang lỗi của server về trang chứa component:

```nginx
error_page 404 /404/index.html;   # Nginx
```

## 3. Public API

### Attributes

```html
<arcade-404
  home-url="/"
  home-label="Về trang chủ"
  default-game=""
  enabled-games="runner,bug-hunter,stack-tower,snake,strike"
  sound="off"
  locale="vi"
  storage-prefix="arcade404"
></arcade-404>
```

### Properties / Methods

```js
const arcade = document.querySelector("arcade-404");
arcade.config = { homeUrl: "/", enabledGames: ["snake", "strike"], quality: "auto" };

arcade.openGame("strike");
arcade.closeGame();
arcade.pause();
arcade.resume();
arcade.resetHighScores();
arcade.destroy();
```

### Custom events (bubbles + composed, detail không chứa dữ liệu cá nhân)

```js
arcade.addEventListener("arcade:ready", (e) => {});
arcade.addEventListener("arcade:game-start", (e) => {});   // { gameId }
arcade.addEventListener("arcade:game-over", (e) => {});    // { gameId, score, durationMs, ... }
arcade.addEventListener("arcade:game-change", (e) => {});  // { gameId | null }
arcade.addEventListener("arcade:home", (e) => e.preventDefault()); // cancelable — SPA tự điều hướng
arcade.addEventListener("arcade:error", (e) => {});        // { gameId, message }
```

### CSS variables (đổi theme từ bên ngoài)

```css
arcade-404 {
  --arcade-bg: #050b1c;
  --arcade-panel: #0b1730;
  --arcade-cyan: #20e3ff;
  --arcade-violet: #9a5cff;
  --arcade-magenta: #ff4fd8;
  --arcade-lime: #a8ff3e;
  --arcade-danger: #ff4f64;
  --arcade-text: #f4f7ff;
  --arcade-radius: 16px;
}
```

## 4. Kiến trúc

```
src/
├── index.js               # đăng ký <arcade-404> (initial bundle KHÔNG chứa game)
├── arcade-404.js          # Web Component: config, API, events
├── core/
│   ├── game-registry.js   # 5 game + dynamic import (lazy-load)
│   ├── game-controller.js # vòng đời: 1 game/lúc, await destroy() trước khi mount
│   ├── storage.js         # localStorage namespace: điểm + prefs
│   ├── audio-manager.js   # WebAudio synth, unlock sau tương tác thật
│   ├── input-manager.js   # keyboard/pointer/swipe + AbortSignal cleanup
│   └── ...                # canvas, loop, hud, pixel-text, previews, utils
├── ui/                    # template shadow DOM, home, card, overlay
└── games/
    ├── runner|bug-hunter|stack-tower|snake/   # 4 game 2D độc lập
    └── strike/             # 404 Strike (FPS 3D)
        ├── engine.js       # renderer WebGL thuần (xem ghi chú bên dưới)
        ├── world.js        # map 60×40m theo Level Map: khu cao, hành lang,
        │                   # 8 cổng spawn, vật cản, neon, collider, patrol
        ├── player.js weapon.js bots.js fx.js pickups.js
        ├── hud.js screens.js styles.js       # HUD + start/pause/kết thúc trận
        └── index.js        # vòng đời + wave + điểm + pointer lock
```

**Interface bắt buộc của mỗi game** (game-controller gọi):

```js
export function createGame() {
  return {
    async mount(container, context) {}, // context: audio, storage, hudRoot,
    start() {},                         //   reducedMotion, signal (AbortSignal),
    pause() {}, resume() {},            //   getBest(), onGameOver(score),
    restart() {},                       //   onMatchStart(), requestSwitch(),
    resize() {},                        //   requestHome(), config
    async destroy() {},                 // BẮT BUỘC dọn rAF/listener/DOM/GL
  };
}
```

Thêm game mới: tạo `src/games/<id>/index.js` theo interface trên + đăng ký một mục trong `game-registry.js` (+ painter preview trong `core/previews.js` nếu muốn card có tranh).

## 5. Build / test

```bash
npm run bundle:offline   # tạo dist/ bằng bundler nội bộ (KHÔNG cần mạng)
npm test                 # unit test bằng node --test (không cần cài gì)
npm run build            # Vite ES + IIFE (cần mạng để npm install lần đầu)
```

`dist/` gồm: `arcade-404.iife.js` (1 file nhúng thẳng), `es/` (ES modules, giữ lazy-load — engine 3D chỉ tải khi người chơi chọn 404 Strike), `arcade-404.css` (style tối thiểu cho host).

> Máy không có Node? Dùng runtime của Cursor/VS Code:
> `ELECTRON_RUN_AS_NODE=1 /usr/share/cursor/cursor tools/bundle.mjs`

## 6. Ghi chú kỹ thuật quan trọng

- **Renderer của 404 Strike là WebGL thuần** (`games/strike/engine.js`, API mô phỏng Three.js: node/mesh/camera/fog/raycast). Lý do: môi trường phát triển offline không thể cài `three` từ npm. Toàn bộ hình khối low-poly + texture canvas là nguyên bản, không dùng tài sản của Counter-Strike/Valve hay bên thứ ba. Muốn chuyển sang Three.js: thay `engine.js`, giữ nguyên API các module còn lại; `vite.config.js` đã sẵn sàng cho code-splitting.
- Không autoplay audio trước tương tác thật (`isTrusted` + `userActivation`); SFX tổng hợp WebAudio, không file ngoài.
- Tự pause khi tab ẩn; Pointer Lock được giải phóng khi thoát 404 Strike; đổi game nhiều lần không rò rỉ (canvas/listener/GL đều được dispose — đã kiểm chứng bằng integration test trên Chrome thật).
- Mobile: 4 game 2D responsive từ 360px (Snake có d-pad); 404 Strike hiển thị "Tối ưu cho máy tính". WebGL không khả dụng → màn hình fallback, 4 game 2D vẫn chạy.
- Tôn trọng `prefers-reduced-motion`; nút tối thiểu 44×44px; focus-visible rõ.

## 7. Hạn chế hiện tại

- Điểm lưu cục bộ theo trình duyệt — chưa có leaderboard online (ngoài phạm vi MVP).
- Bản IIFE inline toàn bộ (kể cả engine 3D ~290KB chưa minify) — hệ thống cũ chấp nhận tải một lần; ưu tiên bản `es/` khi có thể.
- Chưa chạy `npm install` / `vite build` / example React–Next trên máy này do **không có mạng** — cấu hình đã sẵn, chạy được ngay khi online.
- SFX chip-tune tổng hợp đơn giản, chưa có nhạc nền.
