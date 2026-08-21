# 404 Arcade — Expansion Plan: 5 Mini Games

## 1. Mục tiêu

Mở rộng package `404 Arcade` hiện tại bằng 5 mini game mới, nâng tổng số game dự kiến từ 5 lên 10 nhưng vẫn giữ nguyên kiến trúc Web Component `<arcade-404>`, game registry, lifecycle, storage, input và audio manager.

Năm game trong gói mở rộng:

1. Neon Drift 404
2. Portal Puzzle 404
3. Cyber Defense
4. Rogue Arena
5. Rhythm Hack

Ảnh reference đi kèm:

- `images/neon-drift-404.png`
- `images/portal-puzzle-404.png`
- `images/cyber-defense.png`
- `images/rogue-arena.png`
- `images/rhythm-hack.png`

Ảnh dùng để xác định design system, bố cục gameplay, HUD và phân cấp thông tin. Không được dùng ảnh làm background tĩnh thay cho việc xây gameplay thật.

## 2. Nguyên tắc tích hợp

- Không viết lại package 404 Arcade hiện có.
- Không phá vỡ 5 game cũ.
- Mỗi game mới là một module độc lập và được đăng ký qua game registry.
- Chỉ tải code và asset khi người dùng chọn game.
- Chỉ một game được hoạt động tại một thời điểm.
- Dùng lại lifecycle chung: `mount`, `start`, `pause`, `resume`, `restart`, `resize`, `destroy`.
- Dùng lại storage, input, audio, event bus, game shell, pause screen và game-over screen.
- Mỗi game phải dọn sạch animation frame, timer, listener, audio, Canvas và asset khi `destroy()`.
- Bốn game đầu ưu tiên desktop và mobile. Rhythm Hack ưu tiên desktop/tablet, mobile dùng bốn vùng chạm.

## 3. Cấu trúc thư mục

```text
src/games/
├── neon-drift/
│   ├── index.js
│   ├── config.js
│   ├── car.js
│   ├── track.js
│   ├── traffic.js
│   ├── pickups.js
│   ├── physics.js
│   ├── hud.js
│   └── assets/
├── portal-puzzle/
│   ├── index.js
│   ├── config.js
│   ├── board.js
│   ├── player.js
│   ├── rules.js
│   ├── history.js
│   ├── level-loader.js
│   ├── levels/
│   └── assets/
├── cyber-defense/
│   ├── index.js
│   ├── config.js
│   ├── map.js
│   ├── enemy.js
│   ├── tower.js
│   ├── projectile.js
│   ├── wave-manager.js
│   ├── economy.js
│   ├── hud.js
│   └── assets/
├── rogue-arena/
│   ├── index.js
│   ├── config.js
│   ├── player.js
│   ├── enemy.js
│   ├── weapon.js
│   ├── pickup.js
│   ├── upgrade-system.js
│   ├── spawn-manager.js
│   ├── object-pool.js
│   └── assets/
└── rhythm-hack/
    ├── index.js
    ├── config.js
    ├── chart-loader.js
    ├── timing-engine.js
    ├── input-window.js
    ├── scoring.js
    ├── audio-clock.js
    ├── charts/
    └── assets/
```

Tên file có thể điều chỉnh theo codebase thực tế nhưng không gom toàn bộ logic của một game vào một file lớn.

## 4. Đăng ký game

```js
gameRegistry.register({
  id: 'neon-drift',
  title: 'Neon Drift 404',
  category: 'racing',
  mobile: true,
  loader: () => import('./games/neon-drift/index.js')
});
```

Tương tự cho:

```text
portal-puzzle
cyber-defense
rogue-arena
rhythm-hack
```

Không import trực tiếp năm game từ initial entry point.

---

# GAME 1 — NEON DRIFT 404

## 5. Concept

Game lái xe góc nhìn từ trên xuống. Người chơi drift qua các khúc cua, đi qua checkpoint, né xe cản đường và thu thập năng lượng để kích hoạt nitro.

Mỗi lượt chơi khoảng 60–90 giây.

## 6. Điều khiển

### Desktop

- `ArrowLeft`/`A`: rẽ trái.
- `ArrowRight`/`D`: rẽ phải.
- `ArrowUp`/`W`: tăng tốc.
- `ArrowDown`/`S`: phanh.
- `Space`: drift/phanh tay.
- `Shift`: nitro.
- `Esc`: pause.

### Mobile

- Nút trái/phải hoặc joystick.
- Nút drift.
- Nút nitro.
- Xe tự tăng tốc ở chế độ mobile mặc định.

## 7. Gameplay MVP

- Một đường đua vòng ngắn.
- Tám checkpoint.
- Một xe người chơi.
- Từ 3–5 xe/vật cản giao thông.
- Năng lượng nitro và pickup cộng điểm.
- Drift làm đầy combo.
- Nitro tiêu hao theo thời gian.
- Va chạm làm giảm tốc và reset combo.
- Hoàn thành checkpoint cuối hoặc hết giờ thì kết thúc.

## 8. Cơ chế điểm

- Qua checkpoint: `+500`.
- Pickup: `+100`.
- Drift tính theo thời lượng và góc trượt.
- Chuỗi drift không va chạm tăng multiplier.
- Về đích sớm được thưởng thời gian còn lại.

## 9. Kỹ thuật

- Canvas 2D.
- Fixed timestep cho physics.
- Camera top-down bám theo xe.
- Track bằng spline/polyline hoặc tile data.
- Collision dùng circle/OBB đơn giản.
- Tire trail và particle có giới hạn.
- Không dùng physics engine lớn.

## 10. Nghiệm thu

- Xe tăng tốc, rẽ, drift và nitro rõ ràng.
- Checkpoint phải đi đúng thứ tự.
- Combo không tăng khi xe đứng yên.
- Không đi xuyên biên đường đua.
- Mobile controls không làm trang bị scroll.
- Game giữ ổn định khoảng 60 FPS trên máy phổ thông.

---

# GAME 2 — PORTAL PUZZLE 404

## 11. Concept

Game giải đố dạng lưới. Người chơi đưa nhân vật tới cửa thoát bằng cách sử dụng portal, đẩy thùng, kích hoạt công tắc và tránh laser trong số bước giới hạn.

## 12. Điều khiển

- Arrow/WASD để di chuyển.
- Swipe hoặc chạm ô lân cận trên mobile.
- `U`: Undo.
- `R`: Restart.
- `H`: Hint.
- `Esc`: Pause.

## 13. Gameplay MVP

- 15 level được khai báo bằng JSON.
- Board từ `8×6` đến `14×10`.
- Tường và ô đi được.
- Thùng có thể đẩy nhưng không kéo.
- Công tắc giữ hoặc bật/tắt.
- Portal cyan/violet liên kết hai chiều.
- Laser chặn đường khi chưa tắt.
- Cửa thoát chỉ mở khi đủ điều kiện.
- Giới hạn số bước theo level.
- Undo tối thiểu 20 bước.

## 14. Level schema

```json
{
  "id": "level-07",
  "width": 12,
  "height": 8,
  "maxMoves": 18,
  "tiles": [],
  "player": { "x": 1, "y": 4 },
  "crates": [],
  "switches": [],
  "portals": [],
  "lasers": [],
  "exit": { "x": 10, "y": 1 },
  "parMoves": 14
}
```

## 15. Hint MVP

- Không dùng AI.
- Hint được lưu cùng level dưới dạng chuỗi bước gợi ý.
- Mỗi lần nhấn chỉ gợi ý một bước hoặc một mục tiêu trung gian.
- Không tự giải toàn bộ màn ngay lập tức.

## 16. Nghiệm thu

- Tất cả 15 level có lời giải hợp lệ.
- Undo khôi phục đúng player, crate, switch, portal và laser state.
- Không cho đẩy hai thùng cùng lúc.
- Portal không tạo vòng lặp vô hạn.
- Level reload không giữ state cũ.
- Level được thêm bằng JSON, không sửa engine.

---

# GAME 3 — CYBER DEFENSE

## 17. Concept

Mini tower-defense bảo vệ lõi hệ thống. Bot chạy theo một tuyến cố định; người chơi đặt và nâng cấp tháp tại các pad hợp lệ.

Một trận gồm 8 wave, thời lượng mục tiêu 3–5 phút.

## 18. Ba loại tháp MVP

### Rapid Tower — Cyan

- Bắn nhanh.
- Sát thương đơn mục tiêu.
- Tầm trung.

### Slow Tower — Violet

- Sát thương thấp.
- Giảm tốc trong thời gian ngắn.
- Không cộng dồn slow vô hạn.

### Blast Tower — Magenta

- Bắn chậm.
- Sát thương vùng.
- Chi phí cao.

## 19. Enemy MVP

- Basic: cân bằng.
- Fast: máu thấp, tốc độ cao.
- Tank: máu cao, tốc độ thấp.
- Shield: giảm sát thương ban đầu.

## 20. Economy

- Bắt đầu với 400 năng lượng.
- Hạ enemy nhận năng lượng.
- Xây tháp tiêu hao năng lượng.
- Mỗi tháp có tối đa ba cấp.
- Bán tháp hoàn lại một phần chi phí.
- Không cho đặt tháp ngoài pad.

## 21. Wave manager

Wave khai báo bằng data:

```js
{
  id: 4,
  groups: [
    { type: 'basic', count: 8, intervalMs: 700 },
    { type: 'fast', count: 5, intervalMs: 450 }
  ],
  delayBetweenGroupsMs: 1500
}
```

## 22. Nghiệm thu

- Enemy đi đúng path và không mắc kẹt.
- Tower chọn mục tiêu theo chiến lược xác định.
- Range circle hiển thị khi chọn tháp.
- Upgrade cập nhật đúng damage, speed và range.
- Không được chi tiêu khi thiếu năng lượng.
- Core giảm khi enemy tới đích.
- Thắng sau wave 8; thua khi Core về 0.

---

# GAME 4 — ROGUE ARENA

## 23. Concept

Game sinh tồn góc nhìn từ trên xuống. Người chơi tập trung di chuyển và né địch; vũ khí tự động nhắm và bắn. Thu thập XP để lên cấp và chọn nâng cấp.

Mỗi lượt mục tiêu khoảng 3 phút.

## 24. Điều khiển

- WASD/Arrow để di chuyển.
- Joystick trên mobile.
- Không yêu cầu ngắm hoặc bắn thủ công trong MVP.
- Esc để pause.

## 25. Gameplay MVP

- Một arena có giới hạn.
- Ba loại enemy: chaser, shooter, tank.
- Auto-target enemy gần nhất hoặc nguy hiểm nhất.
- XP shard.
- Health pickup.
- Spawn intensity tăng theo thời gian.
- Lên cấp tạm pause game và hiển thị ba lựa chọn.
- Boss nhỏ xuất hiện ở phút thứ ba.

## 26. Nâng cấp MVP

- Tăng damage.
- Tăng fire rate.
- Thêm projectile.
- Projectile xuyên mục tiêu.
- Tăng tốc di chuyển.
- Tăng max HP.
- Hút XP trong phạm vi lớn hơn.
- Energy orbit bảo vệ người chơi.

Mỗi nâng cấp cần có `id`, `name`, `description`, `maxLevel`, `weight`, `apply()`.

## 27. Hiệu năng

- Object pool cho enemy, projectile, XP và particle.
- Spatial hash/grid cho truy vấn mục tiêu gần.
- Không kiểm tra collision mọi object với mọi object.
- Giới hạn enemy và projectile hiển thị.
- Giảm particle tự động trên thiết bị yếu.

## 28. Nghiệm thu

- Auto-target ổn định và không rung giữa nhiều mục tiêu.
- XP cộng đúng và chỉ lên cấp một lần tại mỗi threshold.
- Nâng cấp không xuất hiện khi đã max level.
- Khi hiện màn chọn nâng cấp, gameplay thực sự pause.
- Không còn entity hoặc timer sau khi đổi game.
- Vẫn chơi được khi số lượng enemy đạt giới hạn thiết kế.

---

# GAME 5 — RHYTHM HACK

## 29. Concept

Game nhịp điệu bốn lane. Người chơi nhấn `D`, `F`, `J`, `K` khi note chạm hit line để sửa chữa hệ thống và duy trì combo.

## 30. Điều khiển

- Lane 1: `D`.
- Lane 2: `F`.
- Lane 3: `J`.
- Lane 4: `K`.
- Mobile/tablet: chạm trực tiếp bốn vùng lane.
- Esc để pause.

## 31. Timing engine

Không đồng bộ note bằng `setTimeout`. Audio clock là nguồn thời gian chuẩn:

```js
songTime = audioContext.currentTime - songStartedAt;
noteOffset = note.time - songTime;
```

Judgement window gợi ý:

- Perfect: `±45 ms`.
- Great: `±90 ms`.
- Good: `±140 ms`.
- Miss: lớn hơn `140 ms`.

Các giá trị phải nằm trong config để tuning.

## 32. Scoring

- Perfect: 1.000 điểm.
- Great: 700 điểm.
- Good: 400 điểm.
- Miss: 0 điểm và reset combo.
- Accuracy tính theo tổng trọng số judgement.
- Combo multiplier có giới hạn.

## 33. Beat chart schema

```json
{
  "id": "system-repair-01",
  "title": "System Repair",
  "bpm": 128,
  "offsetMs": 120,
  "audio": "system-repair-01.ogg",
  "notes": [
    { "timeMs": 1000, "lane": 0, "type": "tap" },
    { "timeMs": 1450, "lane": 2, "type": "tap" }
  ]
}
```

MVP chỉ cần tap notes. Hold notes để phase sau.

## 34. Audio và bản quyền

- Chỉ sử dụng audio tự tạo, public-domain hoặc có giấy phép phù hợp.
- Không tải nhạc bên ngoài khi chưa có tương tác người dùng.
- Preload bài sau khi người dùng chọn game.
- Có calibration offset cho thiết bị có độ trễ âm thanh.

## 35. Nghiệm thu

- Note đồng bộ theo audio clock.
- Một note không được chấm điểm hai lần.
- Key repeat không tạo nhiều hit sai.
- Pause/resume không làm lệch chart.
- Thay tab tự pause.
- Accuracy, combo và score chính xác.
- Hoạt động với keyboard và bốn vùng touch.

---

## 36. Thứ tự triển khai

### Phase E1 — Portal Puzzle 404

Ưu tiên đầu vì ít phụ thuộc hiệu ứng và giúp xác nhận module/data-driven level.

### Phase E2 — Neon Drift 404

Xây physics, track và mobile controls.

### Phase E3 — Cyber Defense

Xây path, wave, tower targeting và economy.

### Phase E4 — Rogue Arena

Tái sử dụng enemy/projectile patterns nhưng thêm pooling và spatial partition.

### Phase E5 — Rhythm Hack

Làm sau cùng vì cần audio timing, calibration và test độ trễ riêng.

## 37. Game card metadata

```js
[
  {
    id: 'neon-drift',
    title: 'Neon Drift 404',
    description: 'Drift qua thành phố neon và chinh phục checkpoint.',
    tags: ['Đua xe', 'Phản xạ', 'Mobile'],
    difficulty: 'Trung bình'
  },
  {
    id: 'portal-puzzle',
    title: 'Portal Puzzle 404',
    description: 'Dùng portal và công tắc để tìm đường thoát.',
    tags: ['Giải đố', 'Thư giãn', 'Mobile'],
    difficulty: 'Tăng dần'
  },
  {
    id: 'cyber-defense',
    title: 'Cyber Defense',
    description: 'Đặt tháp và bảo vệ lõi hệ thống qua tám wave.',
    tags: ['Chiến thuật', 'Tower Defense'],
    difficulty: 'Trung bình'
  },
  {
    id: 'rogue-arena',
    title: 'Rogue Arena',
    description: 'Sinh tồn, thu thập XP và xây bộ kỹ năng.',
    tags: ['Sinh tồn', 'Action', 'Mobile'],
    difficulty: 'Khó'
  },
  {
    id: 'rhythm-hack',
    title: 'Rhythm Hack',
    description: 'Nhấn đúng nhịp để khôi phục hệ thống.',
    tags: ['Âm nhạc', 'Nhịp điệu'],
    difficulty: 'Trung bình'
  }
]
```

## 38. Yêu cầu UI/UX chung

- Dùng ảnh của từng game làm reference chính.
- Giữ thanh điều khiển chung: pause, sound, đổi game, về trang chủ.
- HUD không che khu vực gameplay quan trọng.
- Có hướng dẫn lần đầu.
- Có pause, game over/victory, restart và đổi game.
- Có focus state và keyboard navigation cho menu.
- Không dùng emoji làm icon chính.
- Tôn trọng `prefers-reduced-motion`.
- Không autoplay audio.
- Nút touch tối thiểu 44×44 px.

## 39. Storage

Mỗi game dùng namespace riêng:

```text
arcade404:neon-drift:highScore
arcade404:portal-puzzle:progress
arcade404:cyber-defense:highScore
arcade404:rogue-arena:highScore
arcade404:rhythm-hack:highScore
```

Không lưu dữ liệu cá nhân. Có version cho saved state để tránh lỗi khi schema thay đổi.

## 40. Test chung

- Game registry load đúng từng chunk.
- Mở/đóng mỗi game liên tục tối thiểu 10 lần.
- Không có nhiều animation loop đồng thời.
- Không còn keyboard/touch listener sau `destroy()`.
- Tự pause khi tab bị ẩn.
- Không game nào chặn nút về trang chủ khi lỗi.
- High score/progress hoạt động sau reload.
- Production build thành công.
- Kiểm tra Chrome, Edge, Firefox, Safari hiện đại.
- Kiểm tra viewport từ 360 px.

## 41. Definition of Done

- Đủ năm game chơi được thực tế.
- Không chỉ dựng mockup UI.
- Mỗi game có hướng dẫn, pause và kết quả.
- Có lazy-loading và cleanup hoàn chỉnh.
- Có cấu hình gameplay tách khỏi engine.
- Portal Puzzle có tối thiểu 15 level hợp lệ.
- Cyber Defense có đủ 8 wave.
- Rogue Arena chơi được một lượt hoàn chỉnh ba phút.
- Rhythm Hack có ít nhất một chart/audio hợp pháp.
- Không làm hỏng 5 game hiện tại.
- README cập nhật cách thêm, bật/tắt và cấu hình game.

## 42. Master Prompt cho Cursor + Fable 5

```text
Bạn là Senior Frontend Engineer và HTML5 Game Engineer.

Hãy mở rộng package 404 Arcade hiện tại bằng 5 game mới:

1. Neon Drift 404
2. Portal Puzzle 404
3. Cyber Defense
4. Rogue Arena
5. Rhythm Hack

Hãy đọc toàn bộ file 404_ARCADE_EXPANSION_5_GAMES_PLAN.md và sử dụng năm ảnh trong thư mục images làm UI/UX reference.

NGUYÊN TẮC

- Làm việc trên repository 404 Arcade hiện có.
- Không thay framework, không viết lại package và không xóa game cũ.
- Giữ Web Component <arcade-404>.
- Mỗi game là module độc lập và dynamic import qua game registry.
- Dùng lifecycle, storage, input, audio và UI shell hiện tại.
- Không đưa code năm game vào initial bundle.
- Không dùng ảnh reference làm background tĩnh.
- Dựng gameplay thật bằng HTML5 Canvas, HTML, CSS và JavaScript.
- Không dừng lại chỉ để lập kế hoạch và không chờ xác nhận sau từng bước nhỏ.

THỨ TỰ

1. Portal Puzzle 404.
2. Neon Drift 404.
3. Cyber Defense.
4. Rogue Arena.
5. Rhythm Hack.

Sau mỗi game:

- Chạy lint/test/build.
- Kiểm tra start/pause/resume/restart/destroy.
- Kiểm tra chuyển sang game khác.
- Kiểm tra memory leak, listener và animation loop.
- Kiểm tra desktop/mobile theo phạm vi tài liệu.
- Chỉ chuyển game tiếp theo khi game hiện tại đạt tiêu chí nghiệm thu.

YÊU CẦU QUAN TRỌNG

- Neon Drift dùng fixed timestep và collision nhẹ.
- Portal Puzzle data-driven bằng JSON, có Undo và ít nhất 15 level có lời giải.
- Cyber Defense có 3 tower, 4 enemy, economy, upgrade và 8 wave.
- Rogue Arena dùng object pooling và spatial partition để bảo vệ hiệu năng.
- Rhythm Hack dùng AudioContext clock, không dùng setTimeout làm đồng hồ nhịp.
- Audio phải tự tạo, public-domain hoặc có giấy phép phù hợp.
- Không có TODO giả hoặc nút không hoạt động.

KẾT THÚC

- Cập nhật README tiếng Việt.
- Báo cáo file thay đổi.
- Báo cáo cách chạy và test.
- Báo cáo kết quả build.
- Nêu giới hạn còn lại nếu có.

Hãy bắt đầu bằng việc khảo sát kiến trúc repository hiện tại, sau đó triển khai Portal Puzzle 404 ngay trong cùng phiên làm việc.
```

