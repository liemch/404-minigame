# 404 Arcade — Expansion Plan: Games 16–20

## 1. Phạm vi

Mở rộng package `<arcade-404>` bằng năm game:

16. Neon Pinball 404
17. Gravity Flip 404
18. Memory Matrix 404
19. Cyber Goal 404
20. Stealth Escape 404

Ảnh reference:

- `images/neon-pinball-404.png`
- `images/gravity-flip-404.png`
- `images/memory-matrix-404.png`
- `images/cyber-goal-404.png`
- `images/stealth-escape-404.png`

Ảnh chỉ định hướng UI/UX và gameplay. Không dùng ảnh làm background tĩnh.

## 2. Quy tắc tích hợp

- Không thay framework hoặc phá vỡ 15 game hiện tại.
- Mỗi game là dynamic module độc lập.
- Đăng ký qua game registry.
- Dùng lifecycle chung: `mount/start/pause/resume/restart/resize/destroy`.
- Tái sử dụng storage, input, audio, pause, results và game shell.
- Chỉ một game chạy tại một thời điểm.
- Cleanup animation, timer, listener, audio và Canvas khi thoát.
- Gameplay/config/level data tách biệt.

## 3. Cấu trúc đề xuất

```text
src/games/
├── neon-pinball/
│   ├── index.js
│   ├── table.js
│   ├── ball.js
│   ├── flipper.js
│   ├── collision.js
│   └── scoring.js
├── gravity-flip/
│   ├── index.js
│   ├── player.js
│   ├── segment-loader.js
│   ├── collision.js
│   └── difficulty.js
├── memory-matrix/
│   ├── index.js
│   ├── board.js
│   ├── card.js
│   ├── deck-generator.js
│   └── scoring.js
├── cyber-goal/
│   ├── index.js
│   ├── ball.js
│   ├── goalkeeper.js
│   ├── shot-physics.js
│   └── opponent-ai.js
└── stealth-escape/
    ├── index.js
    ├── level-loader.js
    ├── player.js
    ├── guard.js
    ├── vision.js
    ├── pathfinding.js
    └── levels/
```

---

# GAME 16 — NEON PINBALL 404

## 4. Concept

Pinball neon với hai flipper, launcher, bumper, target, ramp và multiplier. Một lượt khoảng 2–4 phút.

## 5. Điều khiển

- Left Arrow/A hoặc touch trái: flipper trái.
- Right Arrow/D hoặc touch phải: flipper phải.
- Space/drag launcher: phóng bi.
- Esc: pause.

## 6. Bàn chơi MVP

- Hai flipper chính.
- Ba bumper.
- Hai slingshot.
- Một launch lane.
- Hai ramp.
- Spinner và drop targets.
- Multiplier x2/x4/x8.
- Ball saver ngắn sau khi launch.
- Ba bi mỗi lượt.

## 7. Physics

- Fixed timestep.
- Circle-vs-segment/circle collision.
- Flipper là rotating segment/capsule.
- Continuous collision cho ball tốc độ cao.
- Giới hạn tốc độ và chống kẹt bi.
- Không dùng random để thay thế physics.

## 8. Scoring

- Bumper, target, ramp và spinner có điểm riêng.
- Hoàn thành nhóm target kích hoạt multiplier.
- Combo ramp nếu đi liên tiếp.
- Bonus tổng kết sau mỗi bi.

## 9. Nghiệm thu

- Flipper phản hồi ngay, không xuyên bi.
- Launcher lực thay đổi theo thời gian kéo/giữ.
- Drain tính đúng một lần.
- Ball saver hoạt động đúng thời lượng.
- Không có trạng thái bi đứng yên vĩnh viễn.

---

# GAME 17 — GRAVITY FLIP 404

## 10. Concept

One-button endless platformer. Nhân vật tự chạy; người chơi chạm để đảo trọng lực giữa sàn và trần, né chướng ngại và nhặt năng lượng.

## 11. Điều khiển

- Space/ArrowUp/click/touch: đảo trọng lực.
- Esc: pause.
- Không cho spam đảo trọng lực khi nhân vật chưa ổn định nếu cấu hình yêu cầu.

## 12. Gameplay MVP

- Segment map sinh từ thư viện pattern đã kiểm chứng.
- Spike ở sàn/trần.
- Moving platform.
- Energy shard.
- Shield pickup hiếm.
- Tốc độ tăng theo quãng đường, có trần.
- Combo theo chuỗi shard.

## 13. Segment schema

```json
{
  "id": "segment-12",
  "length": 1200,
  "minSpeed": 320,
  "obstacles": [],
  "collectibles": [],
  "safeEntry": "floor",
  "safeExit": "ceiling"
}
```

Generator chỉ ghép segment tương thích `safeExit/safeEntry`, tránh đường không thể vượt.

## 14. Nghiệm thu

- Đảo trọng lực nhất quán và không teleport.
- Không sinh chuỗi chướng ngại bất khả thi.
- Tốc độ tăng có giới hạn.
- Collision spike rõ ràng, hitbox không quá khắt khe.
- Chơi tốt bằng một tay trên mobile.

---

# GAME 18 — MEMORY MATRIX 404

## 15. Concept

Lật thẻ tìm cặp trong thời gian hoặc số lượt giới hạn. Đây là game thư giãn, phù hợp desktop và mobile.

## 16. Board MVP

- 4×3: dễ.
- 4×4: thường.
- 5×4: khó.
- 6×4: challenge.
- Icon deck nguyên bản và không phụ thuộc emoji.
- Fisher–Yates shuffle với seed tùy chọn.

## 17. Luật

- Chỉ tối đa hai thẻ đang mở chưa match.
- Khóa input trong animation so khớp.
- Match giữ trạng thái mở.
- Sai thì đóng sau thời gian cấu hình.
- Combo khi match liên tiếp.
- Hint mở nhanh một số thẻ nhưng trừ điểm.

## 18. Accessibility

- Card có focus keyboard.
- Enter/Space để lật.
- Có label mô tả icon cho screen reader nhưng không tiết lộ thẻ khi chưa lật.
- Không chỉ dựa vào màu để nhận biết matched.

## 19. Nghiệm thu

- Deck luôn có đúng hai thẻ mỗi biểu tượng.
- Không lật một thẻ hai lần.
- Không nhận click thứ ba khi đang xử lý cặp.
- Timer pause đúng khi tab hidden.
- Board responsive không làm card quá nhỏ.

---

# GAME 19 — CYBER GOAL 404

## 20. Concept

Penalty-kick arcade. Người chơi kéo để ngắm, điều chỉnh lực/spin và sút qua thủ môn. Có shootout 5 hoặc 10 lượt.

## 21. Điều khiển

- Drag xác định hướng và độ cao.
- Độ dài drag xác định power.
- Độ cong gesture phụ xác định spin hoặc dùng thanh spin đơn giản.
- Keyboard fallback: Arrow chỉnh hướng, Space giữ/thả lực.

## 22. Gameplay MVP

- Năm vùng mục tiêu trong khung thành.
- Goalkeeper có các hướng dive.
- Wind nhẹ ở difficulty cao.
- Combo khi ghi bàn liên tiếp.
- Sudden death nếu hòa.
- Ba difficulty.

## 23. Goalkeeper AI

- Không đọc chính xác input để gian lận.
- Chọn dự đoán theo xác suất, history và difficulty.
- Telegraph nhỏ trước dive ở Easy.
- Reaction delay và reach nằm trong config.

## 24. Shot model

- Mô phỏng 2.5D: x/y màn hình + tiến trình z.
- Gravity và curve đơn giản.
- Goal plane xác định bóng vào/ra.
- Va chạm keeper dùng capsule/rect hợp lý.
- Post/crossbar có collision.

## 25. Nghiệm thu

- Cùng input gần giống cho kết quả ổn định.
- Power/spin có ảnh hưởng nhìn thấy được.
- Goal/miss/save chỉ được tính một lần.
- Keeper không bắt được mọi cú sút ở difficulty cao.
- Shootout và sudden death đúng luật nội bộ đã định nghĩa.

---

# GAME 20 — STEALTH ESCAPE 404

## 26. Concept

Puzzle chiến thuật theo ô hoặc chuyển động từng bước. Người chơi né vision cone của guard/camera, lấy keycard, tắt alarm và đến exit.

## 27. Điều khiển

- WASD/Arrow hoặc tap ô lân cận.
- U: Undo.
- R: Restart.
- H: Hint.
- Esc: pause.

## 28. Thành phần MVP

- Wall và cover.
- Guard đi patrol route.
- Camera quay theo chu kỳ.
- Vision cone.
- Door và keycard.
- Alarm terminal.
- Shadow tile giảm khả năng bị phát hiện.
- Exit chỉ mở khi đủ mục tiêu.

## 29. Turn model

MVP ưu tiên turn-based để logic rõ và dễ undo:

1. Player thực hiện một action.
2. Guard di chuyển một bước.
3. Camera cập nhật góc.
4. Tính line of sight.
5. Cập nhật alarm.
6. Kiểm tra win/lose.

## 30. Vision

- Grid raycast/Bresenham hoặc polygon cone có ray-blocking.
- Wall chặn vision.
- Cover cao chặn; cover thấp tùy config.
- Không phát hiện xuyên góc tường.
- Guard có trạng thái patrol, suspicious, alert, return.

## 31. Level MVP

- Ít nhất 15 level JSON.
- Mỗi level có mục tiêu và par turns.
- Patrol route xác định.
- Hint lưu dưới dạng mục tiêu trung gian.
- Undo tối thiểu 30 lượt.

## 32. Nghiệm thu

- Vision cone khớp logic detection.
- Undo phục hồi player, guard, camera, door, keycard và alarm.
- Không level nào bắt buộc dựa vào timing ngẫu nhiên.
- Guard không đi xuyên vật cản.
- Tất cả level có lời giải xác minh được.

---

## 33. Thứ tự triển khai

1. Memory Matrix 404 — nhẹ nhất, hoàn thiện nhanh.
2. Gravity Flip 404 — one-button, dễ tối ưu mobile.
3. Cyber Goal 404 — physics vừa phải.
4. Stealth Escape 404 — data-driven và nhiều state.
5. Neon Pinball 404 — để cuối vì collision/physics khó tuning nhất.

## 34. Metadata

```js
[
  { id: 'neon-pinball', title: 'Neon Pinball 404', tags: ['Arcade', 'Physics', 'Mobile'] },
  { id: 'gravity-flip', title: 'Gravity Flip 404', tags: ['One-button', 'Runner', 'Mobile'] },
  { id: 'memory-matrix', title: 'Memory Matrix 404', tags: ['Trí nhớ', 'Thư giãn', 'Mobile'] },
  { id: 'cyber-goal', title: 'Cyber Goal 404', tags: ['Thể thao', 'Căn lực', 'Mobile'] },
  { id: 'stealth-escape', title: 'Stealth Escape 404', tags: ['Chiến thuật', 'Puzzle', 'Mobile'] }
]
```

## 35. Storage

```text
arcade404:neon-pinball:highScore
arcade404:gravity-flip:highScore
arcade404:memory-matrix:progress
arcade404:cyber-goal:stats
arcade404:stealth-escape:progress
```

## 36. Test chung

- Dynamic import chỉ khi chọn game.
- Mở/đóng mỗi game ít nhất 10 lần.
- Không còn RAF, timer, listener hoặc audio sau destroy.
- Pause khi tab hidden.
- Restart không giữ state lượt cũ.
- Storage có version và fallback.
- Responsive từ 360 px.
- Build production thành công.

## 37. Definition of Done

- Đủ 5 game chơi thực tế.
- Memory Matrix có đủ 4 kích thước board.
- Gravity Flip có segment generator không tạo đường bất khả thi.
- Cyber Goal có 3 difficulty và sudden death.
- Stealth Escape có tối thiểu 15 level hợp lệ.
- Neon Pinball có bàn chơi hoàn chỉnh, 3 bi và hệ thống bonus.
- Không làm hỏng 15 game trước.
- README và game registry cập nhật.

## 38. Master Prompt cho Cursor + Fable 5

```text
Bạn là Senior Frontend Engineer và HTML5 Game Engineer.

Hãy mở rộng repository 404 Arcade hiện tại bằng năm game:

1. Neon Pinball 404
2. Gravity Flip 404
3. Memory Matrix 404
4. Cyber Goal 404
5. Stealth Escape 404

Đọc toàn bộ file 404_ARCADE_EXPANSION_GAMES_16_20_PLAN.md và sử dụng năm ảnh trong thư mục images làm UI/UX reference.

YÊU CẦU

- Không thay framework, viết lại package hoặc xóa game cũ.
- Giữ Web Component <arcade-404> và public API hiện tại.
- Mỗi game là module độc lập, dynamic import qua game registry.
- Tái sử dụng lifecycle, storage, input, audio và UI shell.
- Không dùng ảnh reference làm background tĩnh.
- Gameplay phải hoạt động thật bằng HTML5 Canvas/HTML/CSS/JavaScript.
- Không dừng lại chỉ để lập kế hoạch hoặc chờ xác nhận sau bước nhỏ.

THỨ TỰ

1. Memory Matrix 404.
2. Gravity Flip 404.
3. Cyber Goal 404.
4. Stealth Escape 404.
5. Neon Pinball 404.

SAU MỖI GAME

- Chạy lint, test và build.
- Kiểm tra lifecycle và chuyển game.
- Kiểm tra memory leak.
- Kiểm tra desktop/mobile.
- Chỉ chuyển tiếp khi đạt tiêu chí nghiệm thu.

ĐIỂM BẮT BUỘC

- Memory Matrix khóa input khi đang so khớp cặp.
- Gravity Flip generator không tạo segment bất khả thi.
- Cyber Goal goalkeeper không gian lận bằng cách đọc kết quả input.
- Stealth Escape có vision/undo xác định và level JSON.
- Neon Pinball dùng fixed timestep và collision chống xuyên bi.

Kết thúc bằng README tiếng Việt, báo cáo file thay đổi, test/build và giới hạn còn lại.

Hãy khảo sát repository rồi triển khai Memory Matrix 404 ngay trong cùng phiên.
```

