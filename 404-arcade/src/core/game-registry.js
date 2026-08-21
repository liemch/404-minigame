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
