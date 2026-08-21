/**
 * game-registry.js — đăng ký 5 mini game.
 * Mỗi game chỉ khai báo metadata + loader (dynamic import). Module game
 * và engine 3D CHỈ được tải khi người dùng chọn (lazy-load, không nằm
 * trong initial bundle).
 *
 * Thêm game mới: thêm một mục vào GAMES + tạo games/<id>/index.js
 * export createGame() theo interface mount/start/pause/resume/restart/
 * resize/destroy.
 */

export const GAMES = [
  {
    id: "runner",
    title: "Endless Runner",
    accent: "cyan",
    kind: "2d",
    goal: "Né chướng ngại vật, thu thập tinh thể. Tốc độ tăng dần — sống sót càng lâu, điểm càng cao!",
    hint: { keys: ["SPACE"], text: "nhảy" },
    controls: [
      { keys: ["Space", "↑", "W"], text: "nhảy (giữ để nhảy cao hơn)" },
      { keys: ["Chạm"], text: "chạm màn hình để nhảy" },
    ],
    loader: () => import("../games/runner/index.js"),
  },
  {
    id: "bug-hunter",
    title: "Bug Hunter",
    accent: "lime",
    kind: "2d",
    goal: "Diệt càng nhiều bọ càng tốt trong 30 giây. Hạ liên tiếp để ăn thưởng combo!",
    hint: { keys: [], text: "nhấp vào bọ (tránh bọ đỏ)" },
    controls: [
      { keys: ["Click", "Chạm"], text: "tiêu diệt bọ" },
      { keys: ["!"], text: "bọ đỏ phát sáng sẽ TRỪ điểm — đừng đụng vào" },
    ],
    loader: () => import("../games/bug-hunter/index.js"),
  },
  {
    id: "stack-tower",
    title: "Stack Tower",
    accent: "violet",
    kind: "2d",
    goal: "Xếp khối càng thẳng càng tốt — phần lệch sẽ bị cắt bỏ. Điểm bằng số tầng xếp được!",
    hint: { keys: [], text: "nhấn để thả khối" },
    controls: [
      { keys: ["Click", "Space", "Chạm"], text: "thả khối" },
      { keys: ["★"], text: "thả trùng khớp hoàn hảo để giữ nguyên độ rộng" },
    ],
    loader: () => import("../games/stack-tower/index.js"),
  },
  {
    id: "snake",
    title: "Snake",
    accent: "green",
    kind: "2d",
    goal: "Ăn táo để dài ra và lên cấp. Đừng đâm tường hay tự cắn thân mình!",
    hint: { keys: ["←", "↑", "↓", "→"], text: "điều hướng" },
    controls: [
      { keys: ["↑ ↓ ← →", "WASD"], text: "điều hướng" },
      { keys: ["Vuốt"], text: "vuốt trên màn hình cảm ứng (hoặc dùng d-pad)" },
    ],
    loader: () => import("../games/snake/index.js"),
  },
  {
    id: "strike",
    title: "404 Strike",
    accent: "magenta",
    kind: "3d",
    badge: "3D",
    goal: "Mini FPS 3D: sống sót qua các đợt tấn công của bot trong 90 giây.",
    hint: { keys: ["WASD"], text: "+ chuột — tối ưu desktop" },
    controls: [
      { keys: ["W A S D"], text: "di chuyển" },
      { keys: ["Chuột"], text: "quan sát / Click trái bắn / Click phải ngắm" },
      { keys: ["R"], text: "thay đạn" },
      { keys: ["Space", "Shift"], text: "nhảy / chạy" },
    ],
    // Toàn bộ engine WebGL chỉ tải ở đây — không nằm trong initial bundle
    loader: () => import("../games/strike/index.js"),
    fullBleed: true, // game tự vẽ chrome/HUD riêng, shell không hiện thanh cửa sổ
    ownResults: true, // game tự hiển thị màn hình kết quả theo reference
  },

  /* ---------- Expansion 6–10 ---------- */
  {
    id: "portal-puzzle",
    title: "Portal Puzzle 404",
    accent: "cyan",
    kind: "2d",
    goal: "Giải đố 15 màn: đẩy thùng gỗ, kích hoạt công tắc, né tia laser và dịch chuyển qua cổng không gian để đến lối thoát.",
    hint: { keys: ["←↑↓→"], text: "di chuyển · U hoàn tác · H gợi ý" },
    controls: [
      { keys: ["↑ ↓ ← →", "WASD"], text: "di chuyển từng ô" },
      { keys: ["U"], text: "hoàn tác" },
      { keys: ["R"], text: "chơi lại màn" },
      { keys: ["H"], text: "gợi ý một bước" },
      { keys: ["Vuốt"], text: "vuốt / chạm ô kề trên cảm ứng" },
    ],
    loader: () => import("../games/portal-puzzle/index.js"),
    fullBleed: true,
    ownResults: true,
  },
  {
    id: "void-runner",
    title: "Void Runner 404",
    accent: "violet",
    kind: "3d",
    badge: "3D",
    goal: "Parkour 3D góc nhìn thứ nhất: chạy, nhảy, trượt, wall-run qua 8 checkpoint giữa thành phố cyber trong thời gian ngắn nhất.",
    hint: { keys: ["WASD"], text: "+ chuột — tối ưu desktop" },
    controls: [
      { keys: ["W A S D"], text: "di chuyển / Chuột quan sát" },
      { keys: ["Space", "Shift"], text: "nhảy / chạy nhanh" },
      { keys: ["Ctrl", "C"], text: "trượt (qua cổng tròn)" },
      { keys: ["Q"], text: "wall-run assist / Esc tạm dừng" },
    ],
    // Engine WebGL dùng chung với 404 Strike — chỉ tải khi chọn game
    loader: () => import("../games/void-runner/index.js"),
    fullBleed: true,
    ownResults: true,
  },
  {
    id: "neon-drift",
    title: "Neon Drift 404",
    accent: "pink",
    kind: "2d",
    goal: "Đua xe neon nhìn từ trên xuống: qua 8 checkpoint đúng thứ tự, drift ăn combo, thu năng lượng và bung nitro trước khi hết giờ.",
    hint: { keys: ["← →"], text: "lái · SPACE drift · SHIFT nitro" },
    controls: [
      { keys: ["↑ ↓ ← →", "WASD"], text: "ga / phanh / đánh lái" },
      { keys: ["SPACE"], text: "drift (phanh tay) — giữ để ôm cua" },
      { keys: ["SHIFT"], text: "nitro (có thanh năng lượng)" },
      { keys: ["Chạm"], text: "nút ◀ ▶ + NITRO, xe tự ga trên cảm ứng" },
    ],
    loader: () => import("../games/neon-drift/index.js"),
    fullBleed: true,
    ownResults: true,
  },
  {
    id: "cyber-defense",
    title: "Cyber Defense",
    accent: "violet",
    kind: "2d",
    goal: "Tower defense trên bảng mạch: xây và nâng cấp tháp trên các pad, chặn 8 wave bot trước khi chúng chạm tới lõi CORE.",
    hint: { keys: [], text: "click chọn tháp → click pad để xây" },
    controls: [
      { keys: ["Click", "Chạm"], text: "chọn tháp / xây trên pad / nâng cấp / bán" },
      { keys: ["1 2 3 4 5"], text: "chọn nhanh loại tháp" },
      { keys: ["Esc"], text: "hủy chế độ xây / tạm dừng" },
    ],
    loader: () => import("../games/cyber-defense/index.js"),
    fullBleed: true,
    ownResults: true,
  },
  {
    id: "rogue-arena",
    title: "Rogue Arena",
    accent: "magenta",
    kind: "2d",
    goal: "Sinh tồn 3 phút: vũ khí tự nhắm, bạn chỉ cần di chuyển và né. Hút XP, chọn nâng cấp mỗi cấp và hạ boss ở phút cuối.",
    hint: { keys: ["WASD"], text: "di chuyển — vũ khí tự bắn" },
    controls: [
      { keys: ["W A S D", "↑ ↓ ← →"], text: "di chuyển (vũ khí tự nhắm bắn)" },
      { keys: ["1 2 3"], text: "chọn nâng cấp khi lên cấp" },
      { keys: ["Chạm"], text: "joystick ảo trên màn hình cảm ứng" },
    ],
    loader: () => import("../games/rogue-arena/index.js"),
    fullBleed: true,
    ownResults: true,
  },
  {
    id: "rhythm-hack",
    title: "Rhythm Hack",
    accent: "lime",
    kind: "2d",
    goal: "Nhấn D F J K đúng lúc note chạm vạch để vá hệ thống: nhạc chiptune tổng hợp trực tiếp, judgement ±45ms, combo và độ chính xác.",
    hint: { keys: ["D", "F", "J", "K"], text: "gõ theo nhịp" },
    controls: [
      { keys: ["D", "F", "J", "K"], text: "đánh 4 lane theo nhịp nhạc" },
      { keys: ["Chạm"], text: "chạm 4 phím / 4 vùng lane trên tablet" },
      { keys: ["Esc"], text: "tạm dừng — có chỉnh độ trễ ±ms" },
    ],
    loader: () => import("../games/rhythm-hack/index.js"),
    fullBleed: true,
    ownResults: true,
  },

  /* ---------- Expansion 11–15 ---------- */
  {
    id: "brick-breaker",
    title: "Brick Breaker 404",
    accent: "cyan",
    kind: "2d",
    goal: "Phá sạch gạch qua 10 màn: phản xạ quả cầu bằng paddle, hứng power-up (bóng x2, paddle rộng, laser, +1 mạng). Gạch nổ phá lan, gạch thép bất hoại!",
    hint: { keys: ["← →"], text: "lái paddle · SPACE thả bóng" },
    controls: [
      { keys: ["Chuột"], text: "rê để lái paddle chính xác" },
      { keys: ["← →", "A D"], text: "di chuyển bằng phím" },
      { keys: ["SPACE", "Click"], text: "thả bóng" },
      { keys: ["Chạm"], text: "kéo paddle trực tiếp trên mobile" },
    ],
    loader: () => import("../games/brick-breaker/index.js"),
    fullBleed: true,
    ownResults: true,
  },
  {
    id: "laser-maze",
    title: "Laser Maze 404",
    accent: "cyan",
    kind: "2d",
    goal: "Giải đố 20 màn: đặt và xoay gương dẫn tia laser tới mọi bộ thu. Tách chùm qua splitter, nhuộm màu tia qua kính lọc — bộ thu chỉ nhận đúng màu!",
    hint: { keys: [], text: "click đặt/xoay gương · U hoàn tác · H gợi ý" },
    controls: [
      { keys: ["Click", "Chạm"], text: "ô trống: đặt gương · gương: xoay / gỡ" },
      { keys: ["U"], text: "hoàn tác" },
      { keys: ["R"], text: "chơi lại màn" },
      { keys: ["H"], text: "gợi ý một bước (mất thưởng sao)" },
    ],
    loader: () => import("../games/laser-maze/index.js"),
    fullBleed: true,
    ownResults: true,
  },
];

const byId = new Map(GAMES.map((g) => [g.id, g]));

export function getGame(id) {
  return byId.get(id) || null;
}

/** Lọc registry theo attribute enabled-games. */
export function enabledGames(ids) {
  if (!ids || ids.length === 0) return GAMES;
  const set = new Set(ids);
  return GAMES.filter((g) => set.has(g.id));
}
