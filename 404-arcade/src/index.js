/**
 * index.js — entry của package: đăng ký custom element <arcade-404>.
 * Initial bundle KHÔNG chứa code game hay engine 3D (chỉ tải khi chọn).
 */

import { Arcade404 } from "./arcade-404.js";

if (!customElements.get("arcade-404")) {
  customElements.define("arcade-404", Arcade404);
}

export { Arcade404 };
export { GAMES } from "./core/game-registry.js";
