# 404 Arcade — Web Component `<arcade-404>`

Trang 404 dạng arcade đóng gói thành **một Web Component độc lập**: nhúng được vào HTML thuần, React, Next.js hay bất kỳ hệ thống nào mà không phụ thuộc framework. Danh sách mini game:

| Game | Loại | Điều khiển |
|---|---|---|
| Endless Runner | 2D Canvas | Space / ↑ / W / chạm |
| Bug Hunter | 2D Canvas | Click / chạm (30 giây, combo) |
| Stack Tower | 2D Canvas | Click / Space / chạm |
| Snake | 2D Canvas | Mũi tên / WASD / vuốt / d-pad |
| **404 Strike** | **3D FPS (WebGL)** | WASD + chuột, Pointer Lock, desktop-first |
| **Portal Puzzle 404** | 2D puzzle 15 màn | Mũi tên/WASD · U hoàn tác · R chơi lại · H gợi ý (3 lượt/màn) · vuốt/chạm ô kề |
| **Void Runner 404** | **3D Parkour (WebGL)** | WASD + chuột, Space nhảy, Shift sprint, Ctrl trượt, wall-run, desktop-first |
| **Neon Drift 404** | 2D đua xe top-down | ↑↓←→/WASD · Space drift · Shift nitro · mobile: nút ◀ ▶ + NITRO, tự ga |
| **Cyber Defense** | 2D tower defense 8 wave | Click chọn tháp → click pad để xây · 1–5 chọn nhanh · nâng cấp 3 cấp / bán 70% |
| **Rogue Arena** | 2D survival 3 phút | WASD di chuyển (vũ khí TỰ NHẮM) · 1/2/3 chọn nâng cấp · joystick mobile |
| **Rhythm Hack** | 2D rhythm 4 lane | D F J K theo nhịp · chạm 4 vùng lane · pause có chỉnh độ trễ ±150ms |
| **Brick Breaker 404** | 2D phá gạch 10 màn | Chuột/A D/mũi tên lái paddle · Space/click thả bóng · mobile kéo paddle · 4 loại gạch + 5 power-up |
| **Laser Maze 404** | 2D puzzle laser 20 màn | Click đặt/xoay gương · U hoàn tác · R chơi lại · H gợi ý · splitter + kính lọc màu + chấm sao |
| **Pixel Golf 404** | 2D mini golf 9 hố | Kéo ngược hướng đánh (lực theo độ dài) · ←→ + Space fallback · cát/bumper/cổng trượt/portal/gió |
| **Typing Rush 404** | 2D gõ phím (desktop-first) | Gõ từ đang rơi (tiếng Việt có/không dấu) · ⌫ lùi ký tự · 3 độ khó + adaptive · WPM chuẩn ký tự/5 |
| **Astro Patrol 404** | 2D bắn phi thuyền dọc | WASD/chuột di chuyển · Space/click bắn (auto-fire tùy chọn) · 5 wave + boss 2 phase · joystick mobile |

Điểm cao + cài đặt lưu bằng `localStorage` (có namespace). CSS cô lập trong shadow DOM. Không backend, không CDN, không đăng nhập. Nhạc nền Rhythm Hack + toàn bộ SFX **tổng hợp trực tiếp bằng WebAudio** — không file audio ngoài.

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
  enabled-games="runner,bug-hunter,stack-tower,snake,strike,portal-puzzle,void-runner,neon-drift,cyber-defense,rogue-arena,rhythm-hack"
  sound="off"
  locale="vi"
  storage-prefix="arcade404"
></arcade-404>
```

**Bật/tắt game:** bỏ trống `enabled-games` để hiện TẤT CẢ game trong registry; hoặc liệt kê id (phân tách bằng dấu phẩy) để chỉ bật một phần, ví dụ `enabled-games="snake,portal-puzzle,rhythm-hack"`. Id hợp lệ: `runner`, `bug-hunter`, `stack-tower`, `snake`, `strike`, `portal-puzzle`, `void-runner`, `neon-drift`, `cyber-defense`, `rogue-arena`, `rhythm-hack`, `brick-breaker`, `laser-maze`, `pixel-golf`, `typing-rush`, `astro-patrol`.

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
    ├── strike/             # 404 Strike (FPS 3D)
    │   ├── engine.js       # renderer WebGL thuần DÙNG CHUNG cho game 3D
    │   │                   # (node/mesh/camera/fog/roll/raycast — xem ghi chú)
    │   ├── world.js        # map 60×40m theo Level Map: khu cao, hành lang,
    │   │                   # 8 cổng spawn, vật cản, neon, collider, patrol
    │   ├── player.js weapon.js bots.js fx.js pickups.js
    │   ├── hud.js screens.js styles.js       # HUD + start/pause/kết thúc trận
    │   └── index.js        # vòng đời + wave + điểm + pointer lock
    ├── void-runner/        # Void Runner 404 (parkour 3D góc nhìn thứ nhất)
    │   ├── course.js       # dữ liệu 8 zone theo blueprint (1 unit = 1 m):
    │   │                   # xuất phát → nhảy → wall-run → trượt → platform
    │   │                   # động → laser → leap cuối → đích (chữ U)
    │   ├── world.js        # dựng scene + collider + laser/pad/shard/gate/
    │   │                   # portal + landing marker + skyline cyber
    │   ├── player.js       # capsule controller: coyote time, jump buffer,
    │   │                   # slide, wall-run, moving platform displacement
    │   ├── gloves.js fx.js # viewmodel găng neon + particle/speed streaks
    │   ├── hud.js screens.js styles.js config.js  # HUD + start/pause/results
    │   └── index.js        # vòng đời + timer/energy/combo + pointer lock
    ├── _shared/            # KHUNG DÙNG CHUNG cho 5 game expansion 6–10:
    │   │                   # top bar (tên game + chỉ số + TẠM DỪNG/ÂM THANH/
    │   │                   # ĐỔI GAME/TRANG CHỦ), intro/pause/results, toast
    │   └── frame.js frame-styles.js
    ├── portal-puzzle/      # Portal Puzzle 404 — puzzle lưới data-driven
    │   ├── engine.js       # logic thuần (test bằng node): đẩy thùng, công tắc
    │   │                   # giữ/bật-tắt, portal 2 chiều, laser, giới hạn bước
    │   ├── levels.js       # 15 màn ASCII + lời giải BFS (par/hint sinh từ solver)
    │   └── render.js styles.js index.js  # board canvas + sidebar + Undo/Hint
    ├── neon-drift/         # Neon Drift 404 — đua xe drift top-down
    │   ├── track.js        # polyline khép kín Catmull-Rom + 8 checkpoint + decor
    │   ├── physics.js      # fixed timestep 1/120s: drift/nitro/va chạm/xe cản
    │   └── render.js styles.js index.js  # camera + trail + minimap + nút mobile
    ├── cyber-defense/      # Cyber Defense — tower defense 8 wave
    │   ├── data.js         # 2 tuyến đường, 14 pad, 5 tháp (2 khóa wave), 8 wave
    │   ├── engine.js       # sim thuần (test node): targeting, economy, slow…
    │   └── render.js styles.js index.js  # PCB board + build bar + panel tháp
    ├── rogue-arena/        # Rogue Arena — survival 3 phút
    │   ├── data.js         # 8 nâng cấp {id,name,description,maxLevel,weight,apply}
    │   ├── engine.js       # OBJECT POOL + SPATIAL HASH + auto-aim hysteresis
    │   └── render.js styles.js index.js  # đấu trường + level-up panel + joystick
    ├── rhythm-hack/        # Rhythm Hack — rhythm 4 lane D/F/J/K
    │   ├── chart.js        # bài "SYSTEM REPAIR" 124 BPM: nhạc + note SINH TỪ
    │   │                   # CÙNG pattern (nhạc-note luôn khớp)
    │   ├── audio.js        # chiptune synth + lookahead scheduler; ĐỒNG HỒ CHUẨN
    │   │                   # là audioContext.currentTime (pause = suspend)
    │   ├── engine.js       # judgement ±45/±90/±140ms, combo cap, accuracy
    │   └── render.js styles.js index.js  # highway phối cảnh + panels + calib
    ├── brick-breaker/      # Brick Breaker 404 — phá gạch 10 màn (exp 11–15)
    │   ├── engine.js       # logic thuần: SUBSTEP chống xuyên gạch, góc nảy
    │   │                   # theo vị trí chạm paddle, chống kẹt quỹ đạo,
    │   │                   # gạch nổ lan 8 ô (hàng đợi), 5 power-up có trần
    │   ├── levels.js       # 10 màn ASCII (màn 4 = bố cục "404" trong ảnh)
    │   └── render.js styles.js index.js  # sidebar PHẢI (nút 2×2 + ĐIỂM/MẠNG/
    │                       # MÀN/COMBO + chú giải), tim pixel, khung neon
    ├── laser-maze/         # Laser Maze 404 — puzzle dẫn tia 20 màn
    │   ├── engine.js       # ray engine theo ô + 4 hướng: gương / \\, splitter
    │   │                   # tách 2 hướng, filter nhuộm/chặn màu, receiver đúng
    │   │                   # màu, chống vòng lặp bằng visited-state
    │   ├── levels.js       # 20 màn 7×6 → 12×10 + LỜI GIẢI KIỂM CHỨNG unit test
    │   └── render.js styles.js index.js  # sidebar trái (chú giải 7 thành phần)
    │                       # + board + sidebar phải (HOÀN TÁC/CHƠI LẠI/GỢI Ý/KHO GƯƠNG)
    ├── pixel-golf/         # Pixel Golf 404 — mini golf 9 hố
    │   ├── engine.js       # fixed timestep + substep: circle-vs-segment,
    │   │                   # ma sát cỏ/cát, bumper, cổng trượt kinematic,
    │   │                   # portal cooldown, gió, out-of-bounds phạt gậy
    │   ├── courses.js      # 9 hố (poly tường + cát + bumper + gate + portal + gió)
    │   └── render.js styles.js index.js  # sân ca-rô tường gạch tím pixel,
    │                       # panel HỐ/GẬY/PAR/ĐIỂM/GIÓ, thanh SỨC MẠNH, kéo-thả ngắm
    ├── typing-rush/        # Typing Rush 404 — gõ phím tốc độ (desktop-first)
    │   ├── engine.js       # fold() Unicode tiếng Việt (NFD bỏ dấu, đ→d),
    │   │                   # target lock TẤT ĐỊNH, WPM chuẩn ký tự/5, spawn
    │   │                   # theo lane không chồng chữ, danger line trừ mạng 1 lần
    │   ├── dictionary.js difficulty.js    # từ điển vi 3 nhóm + 3 độ khó + adaptive
    │   └── keyboard.js styles.js index.js # bàn phím QWERTY ảo sáng phím kế tiếp,
    │                       # HEAT MAP tần suất, mưa ký tự matrix theo lane
    └── astro-patrol/       # Astro Patrol 404 — bắn phi thuyền dọc
        ├── engine.js       # OBJECT POOL đạn + SPATIAL GRID va chạm + trần
        │                   # projectile; khiên hấp thụ trước HP + i-frame;
        │                   # boss 2 phase (chuyển đúng 1 lần) 3 pattern có
        │                   # telegraph, wall/spiral luôn chừa khe né
        ├── waves.js        # 5 wave (scout/shooter/charger) + boss def
        └── render.js styles.js index.js  # parallax sao + asteroid tinh thể,
                            # thanh máu boss đầu lâu, joystick + NÚT BẮN
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

**Test gói expansion (game 6–10):**

```bash
# Unit test logic thuần (38 test: 15 lời giải Portal, kinh tế/8 wave Cyber Defense,
# hysteresis/pool/trọn trận Rogue Arena, judgement/chart Rhythm Hack)
ELECTRON_RUN_AS_NODE=1 /usr/share/cursor/cursor --test tools/expansion5.test.mjs

# Integration test trên Chrome headless (server 8404 + CDP port 9223)
python3 tools/expansion5-qa.py all        # hoặc: portal|drift|defense|rogue|rhythm|old

# Regression tổng (trang chọn game đọc SỐ CARD ĐỘNG từ registry + 404 Strike + IIFE)
ARCADE_QA_PORT=9223 python3 tools/browser-qa.py

# Solver BFS in lời giải tối ưu 15 màn Portal Puzzle (dùng khi thiết kế màn mới)
ELECTRON_RUN_AS_NODE=1 /usr/share/cursor/cursor tools/portal-solver.mjs
```

**Test gói expansion (game 11–15):**

```bash
# Unit test logic thuần (68 test: collision/level Brick Breaker, 20 lời giải
# Laser Maze + ray engine, physics/portal/gate Pixel Golf, fold Unicode/WPM
# Typing Rush, pool/khiên/boss-phase Astro Patrol)
ELECTRON_RUN_AS_NODE=1 /usr/share/cursor/cursor --test tools/expansion11.test.mjs

# Integration test trên Chrome headless (server 8404 + CDP port 9223)
python3 tools/expansion11-qa.py all       # hoặc: brick|laser|golf|typing|astro|old
```

## 6. Ghi chú kỹ thuật quan trọng

- **Renderer 3D là WebGL thuần dùng chung** (`games/strike/engine.js`, API mô phỏng Three.js: node/mesh/camera/fog/camera-roll/raycast; geometry: box, plane, tri, gem, cyl, ring). Lý do: môi trường phát triển offline không thể cài `three` từ npm. 404 Strike và Void Runner 404 cùng import engine này (Void Runner chỉ tải engine khi được chọn — vẫn lazy). Toàn bộ hình khối low-poly + texture canvas là nguyên bản, không dùng tài sản bên thứ ba. Muốn chuyển sang Three.js: thay `engine.js`, giữ nguyên API các module còn lại; `vite.config.js` đã sẵn sàng cho code-splitting.
- **Void Runner 404**: movement controller theo plan (coyote time + jump buffer, slide không đứng dậy dưới trần, wall-run chỉ trên tường đánh dấu, moving platform truyền displacement, jump pad boost); 8 checkpoint kích hoạt theo thứ tự, respawn + penalty theo độ khó; kết quả chính là thời gian (best time lưu prefs) + điểm tổng hợp lưu qua hệ thống điểm chung. Settings (âm lượng, độ nhạy chuột, FOV 75–105, chất lượng, rung, giảm chuyển động) persist bằng storage.
- Không autoplay audio trước tương tác thật (`isTrusted` + `userActivation`); SFX tổng hợp WebAudio, không file ngoài.
- Tự pause khi tab ẩn; Pointer Lock được giải phóng khi thoát 404 Strike; đổi game nhiều lần không rò rỉ (canvas/listener/GL đều được dispose — đã kiểm chứng bằng integration test trên Chrome thật).
- Mobile: các game 2D responsive từ 360px (Snake có d-pad; Neon Drift có nút ◀ ▶ + NITRO và tự ga; Rogue Arena có joystick ảo; Portal Puzzle vuốt/chạm ô kề; Rhythm Hack chạm 4 vùng lane; Cyber Defense thao tác hoàn toàn bằng chạm). 404 Strike / Void Runner hiển thị "Tối ưu cho máy tính". WebGL không khả dụng → màn hình fallback, các game 2D vẫn chạy.
- Gói expansion 6–10: cả 5 game dùng khung chrome chung `games/_shared/frame.js` (fullBleed — tự vẽ top bar/intro/pause/results theo ảnh reference); Rhythm Hack lấy AudioContext qua `audio.getContext()` và pause bằng `suspend()` nên chart không bao giờ lệch nhịp; Rogue Arena dùng object pool + spatial hash (không O(n²)); tiến trình 15 màn Portal Puzzle lưu `storage.setPref`.
- Gói expansion 11–15 tái sử dụng cùng khung `_shared/frame.js` (thêm tùy chọn additive `attachTopbar:false` cho Brick Breaker đặt cụm nút hệ thống vào sidebar phải như ảnh reference). Tiến trình màn/hố của Brick Breaker / Laser Maze / Pixel Golf lưu `storage.setPref` (có version + fallback); Typing Rush hiển thị nhãn "Tối ưu cho máy tính" trên cảm ứng; Astro Patrol có joystick ảo + NÚT BẮN và tùy chọn auto-fire trong pause.
- Tôn trọng `prefers-reduced-motion`; nút tối thiểu 44×44px; focus-visible rõ.

## 7. Hạn chế hiện tại

- Điểm lưu cục bộ theo trình duyệt — chưa có leaderboard online (ngoài phạm vi MVP).
- Bản IIFE inline toàn bộ (kể cả engine 3D ~290KB chưa minify) — hệ thống cũ chấp nhận tải một lần; ưu tiên bản `es/` khi có thể.
- Chưa chạy `npm install` / `vite build` / example React–Next trên máy này do **không có mạng** — cấu hình đã sẵn, chạy được ngay khi online.
- SFX chip-tune tổng hợp đơn giản, chưa có nhạc nền.
