/**
 * hud.js — dựng bảng điểm (HUD) bên cạnh canvas.
 * Game khai báo các ô chỉ số cần hiển thị; shell cấp container.
 */

import { el } from "./utils.js";

export function createHud(root) {
  root.textContent = "";
  const values = new Map();

  return {
    root,

    /** Thêm một ô chỉ số: trả về chính phần tử để tùy biến thêm. */
    addStat({ id, label, value = "0", accent = "", small = false }) {
      const box = el("div", `hud-stat${small ? " small" : ""}`);
      if (accent) box.dataset.accent = accent;
      box.appendChild(el("span", "hud-label", label));
      const val = el("span", "hud-value", value);
      box.appendChild(val);
      root.appendChild(box);
      values.set(id, val);
      return box;
    },

    /** Cập nhật giá trị một ô chỉ số. */
    set(id, value) {
      const node = values.get(id);
      if (node && node.textContent !== String(value)) {
        node.textContent = String(value);
      }
    },

    /** Thêm phần tử tùy biến (vòng đếm giờ, d-pad...). */
    addCustom(node) {
      root.appendChild(node);
      return node;
    },

    destroy() {
      values.clear();
      root.textContent = "";
    },
  };
}
