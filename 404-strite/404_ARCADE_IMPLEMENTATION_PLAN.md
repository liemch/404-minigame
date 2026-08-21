# 404 Arcade — Implementation & Packaging Plan

## 1. Mục tiêu

Xây dựng một bộ mini game dành cho trang 404, chạy độc lập trên trình duyệt và có thể tích hợp vào nhiều dự án mà không phụ thuộc framework của ứng dụng đích.

Phiên bản mục tiêu gồm 5 game:

1. Endless Runner
2. Bug Hunter
3. Stack Tower
4. Snake
5. 404 Strike — mini FPS 3D, desktop-first

Hai ảnh UI/UX reference đi kèm tài liệu:

- `images/404-arcade-ui-reference.png`: trang chọn game và 4 game 2D.
- `images/404-strike-ui-reference.png`: màn hình gameplay FPS 3D.

Ảnh chỉ dùng làm định hướng thiết kế. Cursor phải dựng giao diện thật bằng HTML, CSS, SVG, Canvas và Three.js; không dùng ảnh làm background thay cho giao diện.

## 2. Giải pháp đóng gói được chọn

Đóng gói toàn bộ hệ thống thành một **Web Component độc lập**, phát hành dưới dạng package có thể cài bằng npm hoặc nhúng bằng file build tĩnh.

Custom element chính:

```html
<arcade-404 home-url="/" theme="neon"></arcade-404>
```

Lý do chọn Web Component:

- Chạy được trong HTML thuần, React, Next.js, Vue và hầu hết framework hiện đại.
- CSS và trạng thái game được cô lập trong component.
- Dự án đích không cần biết cấu trúc nội bộ của từng game.
- Có thể lazy-load từng game, đặc biệt là Three.js và 404 Strike.
- Có thể đóng gói thành npm package hoặc copy thư mục `dist` lên CDN nội bộ/static hosting.
- Không bắt buộc dự án tích hợp phải đổi framework.

Không đóng gói bằng iframe ở chế độ mặc định. Có thể cung cấp iframe build như phương án fallback cho hệ thống cũ hoặc có CSS toàn cục khó kiểm soát.

## 3. Đầu ra package

Tên package đề xuất:

```text
@company/404-arcade
```

Nếu chưa phát hành npm, sử dụng tên local:

```text
404-arcade-widget
```

Cấu trúc dự kiến:

```text
404-arcade/
├── package.json
├── vite.config.js
├── README.md
├── LICENSE
├── src/
│   ├── index.js
│   ├── arcade-404.js
│   ├── core/
│   │   ├── game-registry.js
│   │   ├── game-controller.js
│   │   ├── storage.js
│   │   ├── audio-manager.js
│   │   ├── input-manager.js
│   │   ├── lifecycle.js
│   │   └── events.js
│   ├── ui/
│   │   ├── arcade-home.js
│   │   ├── game-shell.js
│   │   ├── game-card.js
│   │   ├── game-over.js
│   │   └── styles/
│   ├── games/
│   │   ├── runner/
│   │   ├── bug-hunter/
│   │   ├── stack-tower/
│   │   ├── snake/
│   │   └── strike/
│   └── assets/
├── public/
├── examples/
│   ├── vanilla/
│   ├── react/
│   └── nextjs/
├── tests/
└── dist/
    ├── arcade-404.es.js
    ├── arcade-404.iife.js
    ├── arcade-404.css
    ├── chunks/
    └── assets/
```

## 4. Public API

### 4.1 HTML attributes

```html
<arcade-404
  home-url="/"
  home-label="Về trang chủ"
  theme="neon"
  default-game=""
  enabled-games="runner,bug-hunter,stack-tower,snake,strike"
  sound="off"
  locale="vi"
  storage-prefix="arcade404"
></arcade-404>
```

### 4.2 JavaScript properties

```js
const arcade = document.querySelector('arcade-404');

arcade.config = {
  homeUrl: '/',
  enabledGames: ['runner', 'bug-hunter', 'stack-tower', 'snake', 'strike'],
  defaultGame: null,
  soundEnabled: false,
  locale: 'vi',
  quality: 'auto'
};
```

### 4.3 Public methods

```js
arcade.openGame('snake');
arcade.closeGame();
arcade.pause();
arcade.resume();
arcade.resetHighScores();
arcade.destroy();
```

### 4.4 Custom events

```js
arcade.addEventListener('arcade:ready', handler);
arcade.addEventListener('arcade:game-start', handler);
arcade.addEventListener('arcade:game-over', handler);
arcade.addEventListener('arcade:game-change', handler);
arcade.addEventListener('arcade:home', handler);
arcade.addEventListener('arcade:error', handler);
```

Chi tiết sự kiện không chứa dữ liệu cá nhân. Ví dụ:

```js
{
  gameId: 'runner',
  score: 2450,
  durationMs: 48120
}
```

## 5. Interface bắt buộc cho mỗi game

```js
export class ArcadeGame {
  async mount(container, context) {}
  async start() {}
  pause() {}
  resume() {}
  restart() {}
  resize(viewport) {}
  async destroy() {}
}
```

`context` cung cấp các dịch vụ dùng chung:

```js
{
  storage,
  audio,
  input,
  emit,
  config,
  signal
}
```

Mỗi game phải dùng `AbortSignal` hoặc cơ chế tương đương để hủy listener và tác vụ bất đồng bộ.

`destroy()` bắt buộc:

- Dừng `requestAnimationFrame`.
- Xóa timer và timeout.
- Gỡ listener.
- Dừng audio.
- Hủy input đang giữ.
- Xóa DOM/Canvas do game tạo.
- Giải phóng asset và tham chiếu.
- Với Three.js: dispose renderer, geometry, material, texture và render target.

## 6. Game Registry và lazy-loading

```js
const games = {
  runner: () => import('./games/runner/index.js'),
  'bug-hunter': () => import('./games/bug-hunter/index.js'),
  'stack-tower': () => import('./games/stack-tower/index.js'),
  snake: () => import('./games/snake/index.js'),
  strike: () => import('./games/strike/index.js')
};
```

Quy tắc:

- Không tải code game trước khi người dùng chọn.
- Không đưa Three.js vào initial bundle.
- Chỉ một game được hoạt động tại một thời điểm.
- Khi đổi game, phải `await currentGame.destroy()` trước khi mount game mới.
- Nếu load game lỗi, hiển thị trạng thái lỗi và vẫn giữ nút về trang chủ.

## 7. Design system

Phong cách: Retro Arcade hiện đại, không trẻ con.

- Background: deep navy/indigo.
- Primary: electric cyan.
- Secondary: violet/magenta.
- Success/accent: lime.
- Danger: red/coral.
- Text: warm off-white.
- Glass panel nhẹ, đường viền rõ, glow có kiểm soát.
- Font sans-serif dễ đọc; pixel font chỉ dùng cho tiêu đề và điểm.
- Nút cảm ứng tối thiểu 44×44 px.
- Có focus state, keyboard navigation và `prefers-reduced-motion`.

CSS variables công khai để dự án đích tùy biến:

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

## 8. Phạm vi 4 game 2D

### Endless Runner

- Nhân vật tự chạy.
- Space, ArrowUp hoặc touch để nhảy.
- Chướng ngại vật và collectible.
- Tốc độ tăng dần có giới hạn.
- Điểm theo thời gian và vật phẩm.

### Bug Hunter

- Click/touch mục tiêu xuất hiện ngẫu nhiên.
- Một lượt 30 giây.
- Bug thường, bug nhanh, bug thưởng và bug phạt.
- Score và combo.

### Stack Tower

- Click, Space hoặc touch để thả block.
- Phần lệch bị cắt.
- Game over khi hai block không giao nhau.
- Điểm bằng số tầng.

### Snake

- Arrow/WASD trên desktop.
- D-pad cảm ứng trên mobile.
- Không cho đảo hướng trực tiếp.
- Tăng tốc theo level.
- Collision với tường và thân.

## 9. 404 Strike — mini FPS 3D

### MVP

- Một map digital-industrial nguyên bản.
- Góc nhìn thứ nhất.
- WASD, mouse look, Pointer Lock.
- Click trái bắn, click phải ngắm, R thay đạn.
- Space nhảy, Shift chạy, Esc pause.
- Một rifle hư cấu, 30/120 viên.
- Raycasting cho đường đạn.
- Hitbox đầu và thân.
- Bot theo wave và state machine đơn giản.
- Trận đấu 90 giây.
- HP, ammo, timer, wave, score, combo và high score.
- Desktop-first; mobile hiển thị “Tối ưu cho máy tính”.

### Bot state machine

```text
SPAWN → PATROL → CHASE → ATTACK → DEAD
```

### Không đưa vào MVP

- Multiplayer.
- Matchmaking.
- Voice chat.
- Mua súng, inventory, skin.
- Nhiều map.
- Chế độ đặt bom.
- Backend hoặc leaderboard online.

### Bản quyền

Không sử dụng tên, logo, map, model, texture, âm thanh hoặc HUD của Counter-Strike/Valve. Không dựng lại Dust2. Tất cả asset phải nguyên bản hoặc có giấy phép phù hợp.

## 10. Build targets

Vite phải xuất ít nhất hai target:

### ES Module

```html
<script type="module">
  import '@company/404-arcade';
</script>
<arcade-404 home-url="/"></arcade-404>
```

### IIFE/static embed

```html
<link rel="stylesheet" href="/404-arcade/arcade-404.css">
<script src="/404-arcade/arcade-404.iife.js" defer></script>
<arcade-404 home-url="/"></arcade-404>
```

Asset paths phải được resolve tương đối với bundle hoặc thông qua thuộc tính `asset-base-url`.

## 11. Tích hợp vào các loại dự án

### HTML thuần

```html
<!doctype html>
<html lang="vi">
  <head>
    <link rel="stylesheet" href="/vendor/404-arcade/arcade-404.css">
    <script src="/vendor/404-arcade/arcade-404.iife.js" defer></script>
  </head>
  <body>
    <arcade-404 home-url="/"></arcade-404>
  </body>
</html>
```

### React/Vite

```jsx
import '@company/404-arcade';
import '@company/404-arcade/style.css';

export function NotFoundPage() {
  return <arcade-404 home-url="/" locale="vi" />;
}
```

### Next.js App Router

Tạo client wrapper vì custom element và game chỉ chạy trên browser:

```jsx
'use client';

import { useEffect } from 'react';
import '@company/404-arcade/style.css';

export default function Arcade404Client() {
  useEffect(() => {
    import('@company/404-arcade');
  }, []);

  return <arcade-404 home-url="/" locale="vi" />;
}
```

Sau đó sử dụng wrapper trong `app/not-found.jsx`.

## 12. Hiệu năng

- Initial bundle không chứa code game và Three.js.
- Mỗi game là một dynamic chunk.
- Asset 3D chỉ tải khi chọn 404 Strike.
- Giới hạn bot và particle.
- Không tạo geometry/material trong mỗi frame.
- Dùng object pooling khi phù hợp.
- Tự pause khi tab bị ẩn.
- Có quality `low`, `medium`, `high`, `auto`.
- Có loading progress và fallback khi WebGL không hỗ trợ.
- Bốn game 2D vẫn phải hoạt động nếu 404 Strike không tải được.

## 13. Kiểm thử

### Unit tests

- Game registry.
- Storage namespace.
- Score validation.
- Lifecycle state transitions.
- Config parser.

### Integration tests

- Mount/unmount custom element nhiều lần.
- Chuyển qua lại giữa năm game.
- Không có nhiều animation loop chạy đồng thời.
- Pause khi tab hidden.
- Điểm cao tồn tại sau reload.
- Pointer Lock được giải phóng khi thoát 404 Strike.

### Build checks

- `npm run lint`
- `npm run test`
- `npm run build`
- Kiểm tra example Vanilla.
- Kiểm tra example React.
- Kiểm tra example Next.js.

## 14. Roadmap triển khai

### Phase 1 — Package foundation

- Vite Vanilla JavaScript.
- Custom element `<arcade-404>`.
- Design system.
- Game registry và lifecycle.
- Storage, input, audio, event API.
- Trang chọn game.

### Phase 2 — Hai game đầu

- Endless Runner.
- Bug Hunter.
- Hoàn chỉnh score, high score, game over.

### Phase 3 — Đủ 4 game 2D

- Stack Tower.
- Snake.
- Mobile controls và responsive.

### Phase 4 — Package hardening

- Build ES Module và IIFE.
- Examples HTML/React/Next.js.
- Unit/integration tests.
- README tích hợp.

### Phase 5 — 404 Strike

- Three.js prototype.
- Movement, Pointer Lock và collision.
- Weapon, raycast, bot, wave và HUD.
- Lazy-loading, cleanup và quality settings.

## 15. Definition of Done

- Có đủ 5 game chơi được.
- Nút về trang chủ luôn hoạt động.
- Mỗi game là module độc lập.
- Có Web Component dùng được ngoài repository gốc.
- Có ES Module build và IIFE build.
- Có ví dụ HTML, React và Next.js.
- Chỉ tải game khi được chọn.
- Three.js không nằm trong initial bundle.
- Không lỗi console trong luồng chính.
- Không còn animation/listener/audio sau khi đổi game.
- Production build thành công.
- README tiếng Việt đầy đủ.

## 16. Master Prompt cho Cursor + Fable 5

```text
Bạn là Senior Frontend Engineer và HTML5 Game Engineer.

Hãy xây dựng dự án mới “404 Arcade” từ đầu và đóng gói thành một Web Component độc lập có tên <arcade-404>.

MỤC TIÊU

- Tạo trang 404 có kho mini game.
- Có 5 game: Endless Runner, Bug Hunter, Stack Tower, Snake và 404 Strike.
- Có thể tích hợp vào HTML thuần, React, Next.js hoặc hệ thống khác.
- Không backend.
- Không yêu cầu đăng nhập.

CÔNG NGHỆ

- Vite Vanilla JavaScript.
- HTML5, CSS3, JavaScript ES Modules.
- Canvas cho 4 game 2D.
- Three.js cho 404 Strike.
- localStorage.
- Web Component.
- Không CDN.
- Không framework frontend trong package lõi.

THỰC THI

- Workspace hiện tại là dự án mới, chưa có repository/source code.
- Khởi tạo dự án và code ngay trong cùng phiên.
- Không dừng ở bước lập kế hoạch.
- Không chờ xác nhận.
- Tạo file, cài dependency, chạy test và build.
- Sử dụng hai ảnh UI/UX reference đính kèm làm định hướng; không dùng ảnh làm giao diện tĩnh.

KIẾN TRÚC

- Custom element chính: <arcade-404>.
- Mỗi game là module độc lập.
- Có game registry và dynamic import.
- Chỉ một game hoạt động tại một thời điểm.
- Interface chung: mount/start/pause/resume/restart/resize/destroy.
- Dùng AbortSignal hoặc cơ chế tương đương để cleanup.
- Three.js và 404 Strike không được nằm trong initial bundle.
- Xuất ES Module build và IIFE/static build.

TÍCH HỢP

- Tạo examples cho HTML thuần, React/Vite và Next.js App Router.
- Hỗ trợ attributes, JavaScript properties, public methods và custom events được mô tả trong tài liệu.
- CSS variables phải cho phép dự án đích đổi màu và border radius.

GAMEPLAY

- Endless Runner: chạy, nhảy, né chướng ngại, nhặt vật phẩm.
- Bug Hunter: click/touch bug trong 30 giây, có combo và mục tiêu phạt.
- Stack Tower: thả block, cắt phần lệch, tính số tầng.
- Snake: keyboard và mobile D-pad, level và tăng tốc.
- 404 Strike: FPS 3D desktop-first, một map nguyên bản, WASD, mouse look, Pointer Lock, rifle hư cấu, raycast, bot theo wave, 90 giây, HP/ammo/score/combo.

CHẤT LƯỢNG

- Responsive từ 360px cho 4 game 2D.
- 404 Strike hiển thị nhãn tối ưu desktop.
- Không autoplay audio trước tương tác.
- Tôn trọng prefers-reduced-motion.
- Tự pause khi tab hidden.
- Không memory leak khi đổi game.
- Có fallback khi WebGL không khả dụng.
- Không sử dụng tài sản của Counter-Strike, Valve hoặc game có bản quyền khác.

QUY TRÌNH

1. Khởi tạo package foundation và Web Component.
2. Hoàn thiện game registry, lifecycle, storage, input, audio và UI shell.
3. Hoàn thiện lần lượt 4 game 2D.
4. Hoàn thiện build ES Module/IIFE và ba integration examples.
5. Sau khi 4 game 2D và package đã ổn định, triển khai 404 Strike.
6. Chạy lint, test, build và sửa toàn bộ lỗi.
7. Viết README tiếng Việt.
8. Báo cáo file thay đổi, cách chạy, kết quả test/build và giới hạn còn lại.

Không chỉ tạo mockup. Tất cả nút bấm, vòng đời và 5 game phải hoạt động thực tế.
```

## 17. Lệnh dự kiến cho người phát triển

```bash
npm install
npm run dev
npm run test
npm run build
```

Sau khi build, thư mục `dist/` là đầu ra có thể chuyển sang dự án khác hoặc phát hành thành npm package.
