# 404 Arcade — Expansion Plan: Games 11–15

## 1. Mục tiêu

Tiếp tục mở rộng Web Component `<arcade-404>` bằng năm mini game mới, đưa roadmap tổng thể lên 15 game:

11. Brick Breaker 404
12. Astro Patrol 404
13. Laser Maze 404
14. Pixel Golf 404
15. Typing Rush 404

Đây là nhóm game có nhịp chơi ngắn, dễ bổ sung dần và phần lớn không cần dependency mới.

## 2. Ảnh UI/UX reference

- `images/brick-breaker-404.png`
- `images/astro-patrol-404.png`
- `images/laser-maze-404.png`
- `images/pixel-golf-404.png`
- `images/typing-rush-404.png`

Ảnh dùng để khóa design system, bố cục gameplay và HUD. Không dùng ảnh làm background tĩnh; tất cả gameplay phải dựng thật bằng HTML5 Canvas, HTML, CSS và JavaScript.

## 3. Nguyên tắc tích hợp

- Giữ nguyên package và các game hiện có.
- Mỗi game là một dynamic module riêng.
- Đăng ký qua game registry.
- Dùng lifecycle chung: `mount/start/pause/resume/restart/resize/destroy`.
- Tái sử dụng input, storage, audio, game shell, pause và results screen.
- Không tải code/asset trước khi game được chọn.
- Chỉ một game chạy tại một thời điểm.
- Dọn sạch animation frame, timer, listener, audio, Canvas và asset khi thoát.

## 4. Cấu trúc đề xuất

```text
src/games/
├── brick-breaker/
│   ├── index.js
│   ├── config.js
│   ├── paddle.js
│   ├── ball.js
│   ├── brick.js
│   ├── level-loader.js
│   ├── powerups.js
│   └── levels/
├── astro-patrol/
│   ├── index.js
│   ├── config.js
│   ├── ship.js
│   ├── enemy.js
│   ├── projectile.js
│   ├── wave-manager.js
│   ├── boss.js
│   └── object-pool.js
├── laser-maze/
│   ├── index.js
│   ├── config.js
│   ├── board.js
│   ├── ray-engine.js
│   ├── components.js
│   ├── history.js
│   ├── level-loader.js
│   └── levels/
├── pixel-golf/
│   ├── index.js
│   ├── config.js
│   ├── ball.js
│   ├── course.js
│   ├── physics.js
│   ├── hazards.js
│   ├── camera.js
│   └── courses/
└── typing-rush/
    ├── index.js
    ├── config.js
    ├── word-manager.js
    ├── input-buffer.js
    ├── scoring.js
    ├── dictionary.js
    └── difficulty.js
```

---

# GAME 11 — BRICK BREAKER 404

## 5. Concept

Điều khiển paddle phản xạ quả cầu để phá toàn bộ block. Mỗi màn có pattern riêng, block đặc biệt và power-up. Một lượt khoảng 60–120 giây.

## 6. Điều khiển

- Desktop: chuột, `A/D` hoặc ArrowLeft/ArrowRight.
- `Space`: thả bóng lúc bắt đầu.
- Mobile: kéo paddle trực tiếp.
- Esc: pause.

## 7. Block MVP

- Normal: vỡ sau một hit.
- Reinforced: cần hai hit.
- Explosive: phá block lân cận.
- Unbreakable: không thể phá.

## 8. Power-up MVP

- Multi-ball.
- Wide paddle.
- Slow ball.
- Laser paddle.
- Extra life.

Mỗi power-up có thời lượng và không được cộng dồn vô hạn.

## 9. Level data

```json
{
  "id": "level-04",
  "rows": 8,
  "cols": 14,
  "layout": [],
  "ballSpeed": 420,
  "powerupChance": 0.12
}
```

MVP có ít nhất 10 level.

## 10. Kỹ thuật

- Continuous collision hoặc swept circle để giảm xuyên block khi bóng nhanh.
- Không đổi góc phản xạ chỉ dựa vào normal; vị trí bóng chạm paddle phải ảnh hưởng hướng.
- Giới hạn tốc độ bóng.
- Object pool cho particle và power-up.

## 11. Nghiệm thu

- Không xuyên paddle/block ở tốc độ tối đa.
- Không kẹt bóng theo trục ngang/dọc quá lâu.
- Multi-ball kết thúc đúng khi quả cuối cùng rơi.
- Clear level khi hết block có thể phá.
- Mobile drag mượt và không scroll trang.

---

# GAME 12 — ASTRO PATROL 404

## 12. Concept

Vertical space shooter: điều khiển tàu, né asteroid và đạn, tiêu diệt enemy theo wave, kết thúc bằng mini-boss.

## 13. Điều khiển

- WASD/Arrow hoặc chuột để di chuyển.
- Space/click để bắn; có tùy chọn auto-fire.
- Mobile: vùng joystick và nút bắn.
- Esc: pause.

## 14. Gameplay MVP

- Năm wave thường và một boss wave.
- Ba enemy: scout, shooter, charger.
- Asteroid là vật cản trung lập.
- Shield pickup.
- Laser/power pickup.
- Combo khi hạ địch liên tục.
- Ba mạng hoặc một thanh HP cấu hình được; MVP ưu tiên HP + shield.

## 15. Boss MVP

- Ba attack pattern rõ ràng.
- Telegraph trước đòn nguy hiểm.
- Hai phase theo lượng HP.
- Có vùng an toàn hợp lý, không tạo pattern không thể né.

## 16. Hiệu năng

- Object pool cho projectile, enemy, asteroid và particle.
- Spatial partition cho collision.
- Giới hạn projectile trên màn hình.
- Background parallax nhiều lớp nhưng không tạo DOM node mỗi frame.

## 17. Nghiệm thu

- Hitbox hợp lý và nhất quán.
- Wave chỉ hoàn tất khi điều kiện đúng.
- Boss chuyển phase đúng một lần.
- Shield hấp thụ damage trước HP.
- Game vẫn ổn định khi nhiều projectile xuất hiện.

---

# GAME 13 — LASER MAZE 404

## 18. Concept

Puzzle dạng lưới: xoay và đặt mirror để dẫn tia laser tới đúng receiver. Có splitter, filter màu và blocker. Một màn khoảng 1–3 phút.

## 19. Thành phần MVP

- Laser source.
- Receiver.
- Mirror `/` và `\\`.
- Beam splitter.
- Blocker.
- Filter cyan, violet, magenta.
- Receiver yêu cầu đúng màu.

## 20. Ray engine

Laser được mô phỏng theo từng ô và hướng:

```text
UP, RIGHT, DOWN, LEFT
```

Engine phải:

- Tìm phần tử tiếp theo theo hướng tia.
- Phản xạ đúng qua mirror.
- Tách tia qua splitter.
- Thay đổi/kiểm tra màu qua filter.
- Phát hiện vòng lặp bằng state `(x, y, direction, color)`.
- Dừng khi ra ngoài board, chạm blocker hoặc lặp state.

## 21. Level MVP

- Ít nhất 20 level JSON.
- Board tăng từ `7×6` đến `12×10`.
- Có giới hạn mirror/component được dùng.
- Undo, restart và hint.
- Có par solution để chấm sao.

## 22. Nghiệm thu

- Không treo khi laser chạy vòng lặp.
- Splitter không nhân tia vô hạn.
- Receiver chỉ active khi đúng màu.
- Undo khôi phục đúng vị trí và góc component.
- Tất cả level có lời giải được kiểm chứng.

---

# GAME 14 — PIXEL GOLF 404

## 23. Concept

Mini-golf góc nhìn nghiêng/top-down. Người chơi kéo để ngắm, chỉnh lực và đưa bóng vào lỗ với số gậy thấp nhất.

## 24. Điều khiển

- Pointer/touch drag ngược hướng muốn đánh.
- Độ dài drag quyết định lực.
- Thả để đánh.
- Keyboard có Arrow chỉnh góc, Space giữ/thả lực như fallback.

## 25. Course MVP

- Chín hố.
- Tường phản xạ.
- Sand làm giảm tốc mạnh.
- Bumper tạo lực bật.
- Moving gate.
- Portal pair.
- Wind chỉ xuất hiện ở hố nâng cao.
- Out-of-bounds đưa bóng về vị trí trước và cộng penalty.

## 26. Physics

- Fixed timestep.
- Circle-vs-segment/circle collision.
- Friction theo bề mặt.
- Ngưỡng vận tốc để xác định bóng dừng.
- Không cho đánh khi bóng còn di chuyển.
- Giới hạn lực tối đa.

## 27. Scoring

- Lưu số gậy mỗi hố.
- So với par: eagle, birdie, par, bogey.
- Tổng điểm qua chín hố.
- High score là tổng số gậy thấp nhất.

## 28. Nghiệm thu

- Aim line phản ánh đúng hướng ban đầu.
- Ball không xuyên tường ở lực tối đa.
- Portal giữ vận tốc có kiểm soát và có cooldown chống lặp.
- Moving gate đồng bộ với collision.
- Save progress giữa các hố.

---

# GAME 15 — TYPING RUSH 404

## 29. Concept

Các từ rơi về danger line. Người chơi gõ chính xác để loại bỏ mục tiêu, duy trì combo và tăng WPM. Ưu tiên desktop; mobile có thể dùng bàn phím hệ thống nhưng không phải trải nghiệm chính.

## 30. Input model

- Khi bắt đầu gõ ký tự đầu, khóa vào một target phù hợp.
- Ký tự đúng tiến target; ký tự sai ghi nhận lỗi.
- Backspace được cho phép theo config.
- Enter không bắt buộc với từ thường.
- Hỗ trợ Unicode tiếng Việt bằng normalization nhất quán.

## 31. Dictionary

Tách danh sách từ khỏi engine:

```js
{
  locale: 'vi',
  categories: {
    basic: [],
    technology: [],
    mixed: []
  }
}
```

Không dùng nội dung nhạy cảm hoặc dữ liệu người dùng.

## 32. Difficulty

- Easy: từ ngắn, rơi chậm, ít target.
- Normal: độ dài và tốc độ trung bình.
- Hard: từ dài, nhiều target, tốc độ cao.
- Adaptive mode điều chỉnh nhẹ theo accuracy/WPM nhưng có giới hạn.

## 33. Chỉ số

- Score.
- WPM.
- Raw WPM.
- Accuracy.
- Combo.
- Số từ hoàn thành.
- Lỗi gõ.

WPM phải tính theo chuẩn số ký tự chia 5, không tính đơn thuần số từ.

## 34. Nghiệm thu

- Target selection có quy tắc xác định, không nhảy ngẫu nhiên.
- Unicode tiếng Việt hoạt động nhất quán.
- Không bắt phím khi game pause hoặc đã destroy.
- WPM/accuracy có unit test.
- Khi target chạm danger line, mất mạng/reset combo đúng một lần.
- Game vẫn đọc được khi có nhiều target nhưng không chồng chữ.

---

## 35. Thứ tự triển khai đề xuất

1. Brick Breaker 404 — cơ chế quen thuộc, xác nhận collision và level data.
2. Laser Maze 404 — puzzle data-driven, nhẹ và dễ kiểm thử.
3. Pixel Golf 404 — mở rộng physics nhưng gameplay chậm, dễ tuning.
4. Typing Rush 404 — tập trung input/Unicode và scoring.
5. Astro Patrol 404 — làm sau cùng vì cần nhiều entity, effect và boss pattern.

## 36. Game card metadata

```js
[
  {
    id: 'brick-breaker',
    title: 'Brick Breaker 404',
    tags: ['Arcade', 'Phản xạ', 'Mobile'],
    difficulty: 'Dễ chơi'
  },
  {
    id: 'astro-patrol',
    title: 'Astro Patrol 404',
    tags: ['Bắn phi thuyền', 'Action', 'Mobile'],
    difficulty: 'Khó'
  },
  {
    id: 'laser-maze',
    title: 'Laser Maze 404',
    tags: ['Giải đố', 'Logic', 'Mobile'],
    difficulty: 'Tăng dần'
  },
  {
    id: 'pixel-golf',
    title: 'Pixel Golf 404',
    tags: ['Thể thao', 'Căn lực', 'Mobile'],
    difficulty: 'Trung bình'
  },
  {
    id: 'typing-rush',
    title: 'Typing Rush 404',
    tags: ['Gõ phím', 'Desktop'],
    difficulty: 'Thích ứng'
  }
]
```

## 37. Storage namespace

```text
arcade404:brick-breaker:progress
arcade404:astro-patrol:highScore
arcade404:laser-maze:progress
arcade404:pixel-golf:progress
arcade404:typing-rush:stats
```

Saved state phải có version và fallback an toàn khi schema thay đổi.

## 38. Test chung

- Dynamic chunk chỉ tải khi chọn game.
- Mount/destroy mỗi game liên tục 10 lần.
- Không còn animation, listener hoặc audio sau destroy.
- Pause khi tab hidden.
- Restart không giữ entity/state của lượt trước.
- Storage hoạt động sau reload.
- Không game nào chặn nút về trang chủ khi lỗi.
- Responsive từ 360 px, riêng Typing Rush hiển thị nhãn “Tối ưu cho máy tính”.
- Production build thành công.

## 39. Definition of Done

- Đủ năm game chơi được thực tế.
- Brick Breaker có tối thiểu 10 level.
- Astro Patrol có 5 wave và 1 boss.
- Laser Maze có tối thiểu 20 puzzle hợp lệ.
- Pixel Golf có 9 hố hoàn chỉnh.
- Typing Rush có ít nhất 3 difficulty và thống kê WPM/accuracy đúng.
- Không làm hỏng 10 game trước.
- README và danh sách game được cập nhật.

## 40. Master Prompt cho Cursor + Fable 5

```text
Bạn là Senior Frontend Engineer và HTML5 Game Engineer.

Hãy mở rộng repository 404 Arcade hiện tại bằng năm game:

1. Brick Breaker 404
2. Astro Patrol 404
3. Laser Maze 404
4. Pixel Golf 404
5. Typing Rush 404

Đọc toàn bộ file 404_ARCADE_EXPANSION_GAMES_11_15_PLAN.md và sử dụng năm ảnh trong thư mục images làm UI/UX reference.

YÊU CẦU

- Không thay framework, viết lại package hoặc xóa game cũ.
- Giữ Web Component <arcade-404> và public API hiện tại.
- Mỗi game là module độc lập, đăng ký qua game registry và dynamic import.
- Tái sử dụng lifecycle, storage, input, audio và UI shell.
- Không dùng ảnh reference làm background tĩnh.
- Gameplay phải hoạt động thực tế bằng HTML5 Canvas/HTML/CSS/JavaScript.
- Không dừng lại chỉ để lập kế hoạch hoặc chờ xác nhận sau mỗi bước nhỏ.

THỨ TỰ TRIỂN KHAI

1. Brick Breaker 404.
2. Laser Maze 404.
3. Pixel Golf 404.
4. Typing Rush 404.
5. Astro Patrol 404.

SAU MỖI GAME

- Chạy lint, test và build.
- Kiểm tra start/pause/resume/restart/destroy.
- Kiểm tra chuyển game và memory leak.
- Kiểm tra desktop/mobile theo phạm vi.
- Chỉ chuyển game tiếp theo khi tiêu chí nghiệm thu đã đạt.

ĐIỂM KỸ THUẬT BẮT BUỘC

- Brick Breaker dùng collision chống xuyên block.
- Laser Maze phát hiện vòng lặp ray bằng state đã thăm.
- Pixel Golf dùng fixed timestep và portal cooldown.
- Typing Rush xử lý Unicode tiếng Việt và WPM theo chuẩn ký tự/5.
- Astro Patrol dùng object pooling, giới hạn projectile và boss pattern có vùng né hợp lý.

KẾT THÚC

- Cập nhật README tiếng Việt và game metadata.
- Báo cáo file thay đổi, kết quả test/build và giới hạn còn lại.

Hãy khảo sát repository hiện tại rồi triển khai Brick Breaker 404 ngay trong cùng phiên, không dừng lại ở kế hoạch.
```

