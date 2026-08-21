# 404 Arcade

Trang 404 kiểu **Retro Arcade hiện đại**: khi người dùng lạc vào đường dẫn không tồn tại, họ có thể quay về trang chủ **hoặc chơi ngay 4 mini game** ngay trên trang — không reload, không backend, không framework, không CDN.

| Game | Điều khiển | Mục tiêu |
|---|---|---|
| Endless Runner | Space / ↑ / W / chạm | Né chướng ngại, gom tinh thể, sống sót càng lâu càng tốt |
| Bug Hunter | Click / chạm | Diệt bọ trong 30 giây, tránh bọ đỏ, giữ chuỗi combo |
| Stack Tower | Click / Space / chạm | Xếp khối thẳng hàng — điểm bằng số tầng |
| Snake | Mũi tên / WASD / vuốt / d-pad | Ăn táo, dài ra, lên cấp, đừng tự cắn thân |

Điểm cao (kỷ lục + điểm gần nhất) và lựa chọn âm thanh được lưu bằng `localStorage`.

---

## 1. Cách chạy

Dự án là static site thuần — chỉ cần một static server bất kỳ (bắt buộc, vì trang dùng ES Modules nên mở trực tiếp `file://` sẽ không chạy):

```bash
# Cách 1: Python (có sẵn trên hầu hết máy)
python3 -m http.server 8404

# Cách 2: Node.js
npx serve .

# Cách 3: VS Code — cài extension "Live Server" rồi bấm "Go Live"
```

Sau đó mở <http://localhost:8404> (hoặc port tương ứng).

**Yêu cầu trình duyệt:** bản Chrome / Edge / Firefox / Safari hiện đại (dùng ES Modules, `color-mix()`, `roundRect`).

---

## 2. Cấu trúc dự án

```
Minigame-404/
├── index.html              # Trang 404 + khung cửa sổ game (dialog dùng chung)
├── styles/
│   ├── base.css            # Design tokens (CSS variables), reset, nút, nền
│   ├── landing.css         # Topbar, hero 404, lưới card game, footer
│   └── shell.css           # Cửa sổ game, HUD, overlay, d-pad, responsive
├── js/
│   ├── main.js             # Điểm vào: dựng logo, card, nối shell + âm thanh
│   ├── core/               # Các module dùng chung
│   │   ├── registry.js     # ĐĂNG KÝ GAME + lazy-load (dynamic import)
│   │   ├── shell.js        # Vòng đời game, overlay, Esc/P, auto-pause
│   │   ├── storage.js      # localStorage: điểm cao + âm thanh
│   │   ├── audio.js        # WebAudio synth (không dùng file âm thanh)
│   │   ├── input.js        # Bàn phím / con trỏ / vuốt (kèm cleanup)
│   │   ├── canvas.js       # Canvas theo kích thước logic + DPR + auto-fit
│   │   ├── loop.js         # requestAnimationFrame loop có start/stop
│   │   ├── hud.js          # Dựng bảng điểm cạnh canvas
│   │   ├── pixel-text.js   # Logo "404 ARCADE" pixel bằng SVG
│   │   ├── previews.js     # Tranh minh họa card (canvas tĩnh)
│   │   └── utils.js        # Hàm tiện ích
│   └── games/              # MỖI GAME LÀ MỘT MODULE ĐỘC LẬP
│       ├── runner.js
│       ├── bug-hunter.js
│       ├── stack-tower.js
│       └── snake.js
└── README.md
```

### Kiến trúc chính

- **Registry + lazy-load:** `js/core/registry.js` chứa metadata của từng game và hàm `loader()` dùng `import()` động. Module game **chỉ được tải khi người dùng bấm "Chơi ngay"**.
- **Interface vòng đời thống nhất:** mỗi game export `createGame()` trả về đối tượng:

```js
{
  mount(container, options), // tạo canvas, HUD, input — vẽ khung hình tĩnh
  start(),                   // bắt đầu lượt chơi mới
  pause(), resume(),         // tạm dừng / tiếp tục (shell + phím P + ẩn tab)
  restart(),                 // chơi lại từ đầu
  destroy(),                 // hủy rAF, listener, canvas — bắt buộc sạch leak
}
```

- **Chỉ một game chạy tại một thời điểm:** `shell.js` luôn `destroy()` game cũ trước khi mount game mới, đồng thời dọn sạch DOM của surface + HUD.
- `options` mà shell truyền vào gồm: `audio`, `hudRoot`, `reducedMotion`, `getBest()`, `onGameOver(score)`.

---

## 3. Cách thêm game mới

1. Tạo `js/games/ten-game.js`, export `createGame()` theo interface ở trên. Ví dụ khung tối thiểu:

```js
import { createCanvas } from "../core/canvas.js";
import { createLoop } from "../core/loop.js";
import { createHud } from "../core/hud.js";

export function createGame() {
  let view, loop, hud, opts;
  let phase = "idle", paused = false, score = 0;

  function update(dt) { /* logic + render */ }

  return {
    mount(container, options) {
      opts = options;
      view = createCanvas(container, { width: 960, height: 540 });
      hud = createHud(options.hudRoot);
      hud.addStat({ id: "score", label: "Điểm", accent: "cyan" });
      loop = createLoop(update);
      // vẽ 1 khung hình tĩnh để hiện sau overlay hướng dẫn
    },
    start() { phase = "run"; loop.start(); },
    pause() { if (!paused) { paused = true; loop.stop(); } },
    resume() { if (paused) { paused = false; loop.start(); } },
    restart() { /* reset state */ phase = "run"; loop.start(); },
    destroy() { loop.stop(); hud.destroy(); view.destroy(); },
  };
}
```

2. Đăng ký trong `js/core/registry.js`:

```js
{
  id: "ten-game",
  title: "Tên Game",
  accent: "pink",            // cyan | violet | pink | lime | green | gold
  goal: "Mô tả mục tiêu ngắn.",
  hint: { keys: ["SPACE"], text: "mô tả trên card" },
  controls: [{ keys: ["Space"], text: "hướng dẫn trong overlay" }],
  loader: () => import("../games/ten-game.js"),
}
```

3. (Tùy chọn) Thêm tranh minh họa card trong `js/core/previews.js` (thêm painter vào `PAINTERS`).

Xong — card, overlay hướng dẫn, lưu điểm, pause/restart… tự hoạt động.

- Khi thua, gọi `opts.onGameOver(score)` — shell tự lưu điểm, hiện overlay.
- Trong `destroy()` phải gỡ **mọi** listener/rAF/timer mà game đã tạo.

---

## 4. Tích hợp vào trang 404 của website khác

1. Copy 3 thư mục/file: `index.html`, `styles/`, `js/` vào website của bạn (ví dụ thư mục `/404/`).
2. Đổi đích nút **"Về trang chủ"** bằng thuộc tính trên `<body>`:

```html
<body data-home-url="https://ten-mien-cua-ban.com">
```

3. Trỏ trang lỗi của server về file này:

```nginx
# Nginx
error_page 404 /404/index.html;
```

```apache
# Apache (.htaccess)
ErrorDocument 404 /404/index.html
```

```toml
# Netlify (netlify.toml) — đổi tên index.html thành 404.html là đủ
```

> Lưu ý: giữ nguyên cấu trúc thư mục `styles/` và `js/` cạnh `index.html` (đường dẫn tương đối `./styles/...`, `./js/...`). Nút "Về trang chủ" là thẻ `<a>` thuần nên vẫn hoạt động kể cả khi JavaScript lỗi.

---

## 5. Ghi chú chất lượng

- Không phát âm thanh trước tương tác đầu tiên (tuân thủ chính sách autoplay); toàn bộ SFX tổng hợp bằng WebAudio, không file ngoài.
- `Esc` đóng game, `P` tạm dừng, tự pause khi tab bị ẩn (`visibilitychange`).
- Hỗ trợ keyboard / chuột / cảm ứng; d-pad hiện trên thiết bị cảm ứng (Snake).
- Tôn trọng `prefers-reduced-motion`: tắt hiệu ứng trang trí, giảm hạt/rung màn hình.
- Responsive từ 360px, chơi được ở màn hình dọc (không bắt xoay ngang).
- Không dùng `eval` / `innerHTML` với dữ liệu động — DOM dựng bằng `createElement` + `textContent`.

### Hạn chế hiện tại

- Điểm lưu cục bộ theo trình duyệt (localStorage), không có bảng xếp hạng online.
- SFX là tiếng "chip-tune" tổng hợp đơn giản, chưa có nhạc nền.
- Cần trình duyệt hiện đại (2023+); không hỗ trợ IE/Safari cũ.
