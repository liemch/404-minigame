/**
 * registry.js — nơi đăng ký toàn bộ mini game.
 * Mỗi game chỉ khai báo metadata + hàm loader (dynamic import);
 * module game CHỈ được tải khi người dùng bấm chơi (lazy-load).
 *
 * Muốn thêm game mới: thêm một mục vào GAMES và tạo file trong js/games/
 * export hàm createGame() trả về interface vòng đời chuẩn
 * (mount / start / pause / resume / restart / destroy).
 */

export const GAMES = [
  {
    id: "runner",
    title: "Endless Runner",
    accent: "cyan",
    goal: "Né chướng ngại vật, thu thập tinh thể. Tốc độ tăng dần — sống sót càng lâu, điểm càng cao!",
    hint: { keys: ["SPACE"], text: "nhảy" },
    controls: [
      { keys: ["Space", "↑", "W"], text: "nhảy (giữ để nhảy cao hơn)" },
      { keys: ["Chạm"], text: "chạm màn hình để nhảy" },
    ],
    loader: () => import("../games/runner.js"),
  },
  {
    id: "bug-hunter",
    title: "Bug Hunter",
    accent: "lime",
    goal: "Diệt càng nhiều bọ càng tốt trong 30 giây. Hạ liên tiếp để ăn thưởng combo!",
    hint: { keys: [], text: "nhấp vào bọ (tránh bọ đỏ)" },
    controls: [
      { keys: ["Click", "Chạm"], text: "tiêu diệt bọ" },
      { keys: ["!"], text: "bọ đỏ phát sáng sẽ TRỪ điểm — đừng đụng vào" },
    ],
    loader: () => import("../games/bug-hunter.js"),
  },
  {
    id: "stack-tower",
    title: "Stack Tower",
    accent: "violet",
    goal: "Xếp khối càng thẳng càng tốt — phần lệch sẽ bị cắt bỏ. Điểm bằng số tầng xếp được!",
    hint: { keys: [], text: "nhấn để thả khối" },
    controls: [
      { keys: ["Click", "Space", "Chạm"], text: "thả khối" },
      { keys: ["★"], text: "thả trùng khớp hoàn hảo để giữ nguyên độ rộng" },
    ],
    loader: () => import("../games/stack-tower.js"),
  },
  {
    id: "snake",
    title: "Snake",
    accent: "green",
    goal: "Ăn táo để dài ra và lên cấp. Đừng đâm tường hay tự cắn thân mình!",
    hint: { keys: ["←", "↑", "↓", "→"], text: "điều hướng" },
    controls: [
      { keys: ["↑ ↓ ← →", "WASD"], text: "điều hướng" },
      { keys: ["Vuốt"], text: "vuốt trên màn hình cảm ứng (hoặc dùng d-pad)" },
    ],
    loader: () => import("../games/snake.js"),
  },
];

const byId = new Map(GAMES.map((g) => [g.id, g]));

export function getGame(id) {
  return byId.get(id) || null;
}
