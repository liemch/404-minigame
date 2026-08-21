# VOID RUNNER 404 — Premium 3D Game Plan

## 1. Mục tiêu

Xây dựng game 3D chất lượng cao thứ 21 cho 404 Arcade:

> **VOID RUNNER 404** — parkour góc nhìn thứ nhất trên các công trình lơ lửng giữa thành phố cyber.

Người chơi chạy, nhảy, trượt, wall-run, vượt platform động và laser để hoàn thành tám checkpoint trong thời gian ngắn nhất.

Đây là game single-player, desktop-first, mỗi lượt khoảng 2–4 phút. Không multiplayer và không backend.

## 2. Bộ ảnh reference

- `images/void-runner-gameplay.png`: gameplay, HUD, góc nhìn và ngôn ngữ môi trường.
- `images/void-runner-start-screen.png`: màn hình bắt đầu và hướng dẫn điều khiển.
- `images/void-runner-pause-screen.png`: pause, settings và điều hướng.
- `images/void-runner-level-blueprint.png`: tuyến parkour, checkpoint, respawn và module map.
- `images/void-runner-asset-sheet.png`: runner, gloves, platform, wall-run, slide, laser, checkpoint, energy và finish portal.

Không dùng ảnh làm background tĩnh. Cursor phải dựng scene, UI và gameplay thực tế bằng Three.js, HTML và CSS.

## 3. Công nghệ

- Three.js cài qua npm.
- JavaScript ES Modules.
- Pointer Lock API.
- Web Audio API/audio manager hiện có.
- GLTF/GLB cho asset modular nếu cần.
- KTX2/Basis cho texture nếu pipeline hỗ trợ.
- localStorage thông qua storage hiện có.
- Không CDN.
- Không physics engine lớn trong MVP; dùng capsule controller và collision geometry đơn giản.

Game phải lazy-load. Three.js, model, texture và audio không được nằm trong initial bundle của trang 404.

## 4. Tích hợp package

Đăng ký game:

```js
gameRegistry.register({
  id: 'void-runner',
  title: 'Void Runner 404',
  category: '3d-parkour',
  mobile: false,
  premium: true,
  loader: () => import('./games/void-runner/index.js')
});
```

Lifecycle bắt buộc:

```js
mount(container, context)
start()
pause()
resume()
restart()
resize(viewport)
destroy()
```

## 5. Cấu trúc module

```text
src/games/void-runner/
├── index.js
├── config.js
├── world.js
├── renderer.js
├── camera.js
├── player/
│   ├── controller.js
│   ├── movement-state.js
│   ├── capsule.js
│   ├── wall-run.js
│   ├── slide.js
│   └── camera-effects.js
├── level/
│   ├── level-loader.js
│   ├── course-data.js
│   ├── checkpoint.js
│   ├── respawn.js
│   ├── moving-platform.js
│   ├── laser.js
│   └── fallback-volume.js
├── systems/
│   ├── collision.js
│   ├── timer.js
│   ├── scoring.js
│   ├── quality-manager.js
│   ├── asset-manager.js
│   └── audio.js
├── ui/
│   ├── hud.js
│   ├── start-screen.js
│   ├── pause-screen.js
│   └── results-screen.js
└── assets/
```

Không gom toàn bộ game vào một file.

## 6. Điều khiển

| Hành động | Điều khiển |
|---|---|
| Di chuyển | WASD |
| Quan sát | Chuột |
| Nhảy | Space |
| Chạy nhanh | Shift |
| Trượt | Ctrl hoặc C |
| Wall-run | Tự kích hoạt khi đủ điều kiện; Q có thể dùng làm assist tùy config |
| Pause | Esc |
| Restart checkpoint | R khi pause/dead |

Game kích hoạt Pointer Lock sau khi người dùng bấm **Bắt đầu chạy**. Esc giải phóng Pointer Lock và pause.

## 7. Movement controller

Movement là phần quan trọng nhất. Phải hoàn thiện cảm giác điều khiển trước khi làm đẹp map.

### Trạng thái

```text
IDLE
RUN
SPRINT
JUMP
FALL
WALL_RUN
SLIDE
LAND
DEAD
RESPAWN
FINISH
```

### Thông số khởi tạo

- Walk speed: 7 m/s.
- Sprint speed: 11 m/s.
- Max boosted speed: 18–20 m/s.
- Ground acceleration: 35 m/s².
- Air acceleration: 12 m/s².
- Jump height: khoảng 1,7 m.
- Gravity: khoảng 24 m/s².
- Coyote time: 100–140 ms.
- Jump buffer: 100–140 ms.
- Slide duration: 0,8–1,2 giây.
- Wall-run duration tối đa: khoảng 1,5 giây.

Các giá trị nằm trong config để tuning.

### Coyote time

Cho phép jump trong thời gian ngắn sau khi rời cạnh platform để điều khiển bớt khó chịu.

### Jump buffer

Nếu người chơi nhấn jump ngay trước lúc chạm đất, jump được thực hiện khi tiếp đất.

### Air control

Cho phép chỉnh hướng nhẹ khi đang bay nhưng không thể đổi hướng vô hạn.

### Landing

- Landing nhẹ không làm mất tốc độ.
- Landing mạnh có camera dip nhỏ.
- `prefers-reduced-motion` hoặc setting giảm chuyển động phải loại bỏ camera dip/shake.

## 8. Wall-run

Điều kiện:

- Player đang ở trên không.
- Có wall-run surface hợp lệ ở bên trái/phải.
- Vận tốc tiến đạt ngưỡng tối thiểu.
- Surface normal hợp lệ.
- Không vừa wall-run cùng một mặt quá thời gian cooldown.

Trong wall-run:

- Giảm gravity.
- Giữ vận tốc tiến có giới hạn.
- Camera roll nhẹ về phía tường.
- Có trail/audio riêng.
- Jump khỏi tường tạo lực ra ngoài và lên trên.

Không cho wall-run trên mọi bề mặt; surface phải được đánh dấu.

## 9. Slide

- Chỉ bắt đầu khi grounded và tốc độ đủ lớn.
- Giảm chiều cao capsule.
- Giữ momentum rồi giảm dần.
- Cho phép đi qua tunnel thấp.
- Không được đứng lên nếu phía trên còn vật cản.
- Nếu hết slide mà bị chặn, giữ crouch capsule đến khi an toàn.

## 10. Collision

Player sử dụng capsule collider.

World collision ưu tiên:

- Box/ramp/plane đơn giản.
- Static collision mesh tách khỏi visual mesh.
- Capsule-vs-triangle hoặc BVH nếu course phức tạp.
- Moving platform xử lý relative motion.

Không dùng visual mesh quá chi tiết làm collision trực tiếp nếu gây tốn CPU.

## 11. Course và checkpoint

Một course duy nhất gồm tám zone:

1. Xuất phát.
2. Nhảy cơ bản.
3. Wall-run.
4. Trượt.
5. Platform động.
6. Laser.
7. Leap cuối.
8. Đích.

Mỗi zone khoảng 10–20 giây trong lượt chạy chuẩn. Tổng par time khoảng 1 phút 40 giây đến 2 phút 30 giây tùy tuning.

### Checkpoint

- Checkpoint lưu transform an toàn gần nhất.
- Lưu position, rotation, course progress và timestamp.
- Không lưu trạng thái platform giữa chừng nếu gây respawn không xác định; reset zone theo quy tắc rõ.
- Chỉ kích hoạt theo thứ tự.

### Fallback volume

Mỗi zone có volume phía dưới. Khi player rơi:

1. Chuyển state DEAD.
2. Dừng timer penalty hoặc tiếp tục theo config.
3. Fade nhanh.
4. Respawn tại checkpoint.
5. Cộng penalty thời gian, gợi ý 3 giây.

## 12. Moving platform

- Di chuyển theo path xác định.
- Easing đơn giản, không teleport.
- Player đứng trên platform phải nhận displacement của platform.
- Tránh platform kẹp player vào trần/tường.
- Reset về state xác định khi respawn zone.

## 13. Laser hazard

- Laser có telegraph trước khi bật.
- Chu kỳ cố định, được mô tả bằng config.
- Collision đơn giản bằng segment/box.
- Chạm laser respawn hoặc trừ năng lượng tùy difficulty.
- Không sinh pattern không có cửa sổ vượt qua.

## 14. Energy và combo

Energy shard:

- Đặt dọc tuyến chạy tối ưu hoặc shortcut.
- Hồi sprint/boost energy.
- Cộng điểm và combo.

Combo tăng khi:

- Nhặt shard liên tiếp.
- Hoàn thành wall-run.
- Slide qua tunnel.
- Vượt hazard không bị chết.

Combo reset khi rơi hoặc đứng yên quá lâu.

## 15. Timer và scoring

Kết quả chính là thời gian hoàn thành.

Thống kê:

- Total time.
- Best time.
- Death/fall count.
- Checkpoint split times.
- Energy collected.
- Shortcut used.
- Max speed.
- Max combo.

High score cục bộ lưu bằng storage hiện có.

## 16. HUD

HUD trong gameplay:

- Timer ở giữa phía trên.
- Checkpoint progress.
- Speed.
- Energy.
- Combo.
- Pause/sound/change game/home.
- Landing marker chỉ xuất hiện khi hữu ích.

Không che tầm nhìn trung tâm.

## 17. Camera và game feel

- FOV cơ bản 90, cho phép chỉnh 75–105.
- FOV tăng nhẹ theo sprint/speed.
- Camera bob rất nhẹ.
- Camera roll khi wall-run.
- Camera dip khi slide/landing.
- Tất cả effect có thể giảm hoặc tắt.
- Không lạm dụng motion blur; MVP không cần motion blur thật.

First-person gloves:

- Animation run/jump/land/wall-run/slide nhẹ.
- Có thể dùng procedural animation để giảm asset.
- Không che quá nhiều màn hình.

## 18. Audio

- Footstep theo surface.
- Wind tăng theo speed.
- Jump/land/slide/wall-run.
- Checkpoint.
- Energy pickup.
- Laser warning.
- Fall/respawn.
- Finish.

Không phát audio trước tương tác đầu tiên. Audio dừng khi pause và destroy.

## 19. Quality settings

### Low

- Pixel ratio giới hạn 1.0.
- Không shadow động hoặc shadow rất thấp.
- Giảm particle và emissive effects.
- Texture thấp.

### Medium

- Pixel ratio tối đa 1.5.
- Một directional shadow giới hạn.
- Particle vừa phải.

### High

- Pixel ratio tối đa 2.0 nhưng phải có cap.
- Shadow và bloom nhẹ.
- Particle đầy đủ.

### Auto

- Đo frame time sau warm-up.
- Giảm quality nếu FPS thấp kéo dài.
- Không đổi quality liên tục; có hysteresis/cooldown.

## 20. Hiệu năng

- Target 60 FPS trên desktop phổ thông.
- Lazy-load tất cả asset.
- GLTF tối ưu polygon.
- Texture WebP/KTX2.
- Gộp static geometry hoặc instancing cho module lặp.
- Không tạo geometry/material trong mỗi frame.
- Object pool cho particle.
- Frustum culling.
- Giới hạn light động.
- Chỉ update object gần/active.
- Dispose renderer, geometry, material, texture, render target và audio khi destroy.

## 21. Desktop và mobile

MVP desktop-first.

Trên mobile:

- Card vẫn hiển thị nhưng có nhãn “Tối ưu cho máy tính”.
- Có thể mở preview/instruction.
- Không bắt buộc gameplay mobile trong phase đầu.
- Không ảnh hưởng các game 2D mobile-friendly.

## 22. Accessibility

- Reduced motion.
- Điều chỉnh FOV.
- Điều chỉnh mouse sensitivity.
- Toggle camera shake/bob.
- Màu checkpoint/hazard có icon và hình dạng, không chỉ dựa vào màu.
- Hướng dẫn điều khiển rõ.
- Có restart checkpoint thay vì bắt đầu lại toàn bộ.

## 23. Loading và fallback

Khi chọn game:

1. Hiển thị loading progress.
2. Import Three.js/game chunk.
3. Tải asset thiết yếu.
4. Dựng start screen.
5. Tải asset phụ ở nền nếu phù hợp.

Nếu WebGL không hỗ trợ hoặc load lỗi:

- Hiển thị lỗi thân thiện.
- Có nút thử lại.
- Có nút chọn game khác.
- Nút về trang chủ luôn hoạt động.

## 24. Cleanup bắt buộc

`destroy()` phải:

- Exit Pointer Lock.
- Cancel RAF.
- Hủy timer/timeout.
- Gỡ keyboard/mouse/visibility/resize listener.
- Dừng audio.
- Abort asset request nếu còn.
- Dispose renderer.
- Traverse scene và dispose geometry/material/texture.
- Dispose render targets/post-processing.
- Xóa HUD/menu/loading DOM.
- Clear scene, camera, controller và level references.

## 25. Test

### Movement tests

- Coyote time.
- Jump buffer.
- Không double jump nếu chưa cho phép.
- Slide capsule không đứng lên xuyên trần.
- Wall-run chỉ trên surface hợp lệ.
- Moving platform displacement.

### Gameplay tests

- Checkpoint theo thứ tự.
- Respawn đúng transform.
- Penalty đúng một lần.
- Finish chỉ khi đủ checkpoint.
- Best time lưu đúng.

### Lifecycle tests

- Mount/destroy game 10 lần.
- Chuyển qua 2D game và quay lại.
- Không còn Pointer Lock/listener/RAF/audio.
- WebGL context không tăng không kiểm soát.

### Performance tests

- Low/Medium/High/Auto.
- 1080p desktop.
- Throttled/low-end test.
- Tab hidden/resume.
- Production build.

## 26. Roadmap

### Phase VR1 — Movement prototype

- Empty test room.
- Capsule collision.
- WASD, sprint, jump.
- Coyote time, jump buffer.
- Camera và Pointer Lock.

### Phase VR2 — Advanced movement

- Slide.
- Wall-run.
- Moving platform.
- Fall/respawn.

### Phase VR3 — Greybox course

- Dựng đủ 8 zone bằng primitive.
- Checkpoint.
- Laser.
- Timer và finish.
- Test toàn course trước khi làm art.

### Phase VR4 — Art và HUD

- Modular environment.
- Gloves.
- Lighting.
- HUD/start/pause/results.
- Audio và VFX.

### Phase VR5 — Optimization/integration

- Lazy loading.
- Quality manager.
- Asset compression.
- Cleanup.
- Package integration.

## 27. Definition of Done

- Course 8 zone hoàn chỉnh.
- Movement chạy/jump/slide/wall-run mượt.
- Checkpoint và respawn ổn định.
- Timer, split time và best time đúng.
- Có start, pause, results và settings.
- Có Low/Medium/High/Auto.
- Three.js không nằm trong initial bundle.
- Không memory leak khi đổi game.
- Production build thành công.
- Không sử dụng asset có bản quyền không phù hợp.

## 28. Master Prompt cho Cursor + Fable 5

```text
Bạn là Senior 3D Web Game Engineer, chuyên Three.js và first-person movement controller.

Hãy bổ sung game premium “VOID RUNNER 404” vào repository 404 Arcade hiện tại.

Đọc toàn bộ file VOID_RUNNER_404_3D_IMPLEMENTATION_PLAN.md và sử dụng năm ảnh trong thư mục images làm bộ UI/UX, level-design và asset reference.

NGUYÊN TẮC

- Không thay framework, viết lại package hoặc xóa game cũ.
- Giữ Web Component <arcade-404> và game registry.
- Game là dynamic module riêng.
- Three.js và asset 3D không nằm trong initial bundle.
- Không dùng ảnh reference làm background tĩnh.
- Không sao chép map hoặc asset từ game khác.
- Bắt đầu code trong cùng phiên, không dừng ở kế hoạch.

ƯU TIÊN THỰC HIỆN

1. Xây test room và movement controller.
2. Hoàn thiện capsule collision, sprint, jump, coyote time và jump buffer.
3. Thêm slide, wall-run, moving platform và respawn.
4. Dựng greybox đủ 8 zone theo blueprint.
5. Chỉ sau khi course chơi tốt mới thêm art, lighting, HUD, audio và VFX.
6. Tích hợp lazy-loading, quality manager và cleanup.

YÊU CẦU CHẤT LƯỢNG

- Fixed timestep hoặc movement update ổn định theo delta có cap.
- Không xuyên vật thể ở tốc độ tối đa.
- Wall-run chỉ trên surface đánh dấu.
- Slide không cho đứng xuyên trần.
- Moving platform truyền displacement đúng cho player.
- Checkpoint/respawn xác định.
- Pointer Lock được giải phóng khi pause/exit.
- Reduced motion, FOV và mouse sensitivity hoạt động.
- Target 60 FPS trên desktop phổ thông.
- Có Low/Medium/High/Auto.
- Dispose toàn bộ Three.js resource khi destroy.

SAU MỖI PHASE

- Chạy test và production build.
- Kiểm tra lifecycle và memory leak.
- Ghi lại kết quả trước khi chuyển phase.
- Không đánh dấu hoàn thành nếu chỉ có mockup hoặc scene không chơi được.

KẾT THÚC

- Cập nhật README tiếng Việt.
- Báo cáo file thay đổi, cách chạy, test/build, bundle và giới hạn còn lại.

Hãy khảo sát repository, sau đó triển khai Phase VR1 ngay trong cùng phiên.
```

