/**
 * dictionary.js — từ điển Typing Rush 404 (locale vi), tách khỏi engine.
 * basic: từ ngắn quen thuộc · technology: thuật ngữ CNTT ·
 * mixed: cụm dài / tiếng Việt có dấu. Không chứa nội dung nhạy cảm.
 */

export const DICTIONARY = {
  locale: "vi",
  categories: {
    basic: [
      "web",
      "code",
      "wifi",
      "chip",
      "data",
      "lỗi",
      "mạng",
      "phím",
      "chuột",
      "màn hình",
      "tập tin",
      "thư mục",
      "trang chủ",
      "hình nền",
      "tài khoản",
      "mật khẩu",
      "tin nhắn",
      "trò chơi",
    ],
    technology: [
      "function",
      "debug",
      "system",
      "server",
      "cache",
      "router",
      "kernel",
      "python",
      "socket",
      "docker",
      "commit",
      "branch",
      "deploy",
      "backend",
      "frontend",
      "database",
      "compiler",
      "terminal",
      "firewall",
      "protocol",
    ],
    mixed: [
      "bộ nhớ",
      "kết nối",
      "thuật toán",
      "máy chủ ảo",
      "lập trình viên",
      "dữ liệu lớn",
      "bảo mật mạng",
      "trí tuệ nhân tạo",
      "điện toán đám mây",
      "hệ điều hành",
      "phần mềm mở",
      "băng thông rộng",
    ],
  },
};

/** Gộp pool theo tên nhóm. */
export function poolOf(...names) {
  const out = [];
  for (const n of names) out.push(...(DICTIONARY.categories[n] || []));
  return out;
}
