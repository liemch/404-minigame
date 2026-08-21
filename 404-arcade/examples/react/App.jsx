/**
 * Ví dụ React/Vite — trang 404 dùng <arcade-404>.
 *
 * Cài đặt (khi package đã publish hoặc dùng đường dẫn local):
 *   npm i 404-arcade-widget        # hoặc: npm i ../404-arcade
 *
 * Custom element hoạt động trực tiếp trong JSX (React 19 hỗ trợ đầy đủ
 * custom elements; React 18 vẫn render được thẻ + attributes chuỗi).
 */

import { useEffect, useRef } from "react";
import "404-arcade-widget"; // đăng ký <arcade-404>
import "404-arcade-widget/style.css";

export default function NotFoundPage() {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onGameOver = (e) => {
      // Gửi analytics tùy ý — detail không chứa dữ liệu cá nhân
      console.log("arcade:game-over", e.detail);
    };
    const onHome = (e) => {
      // Ví dụ: chặn điều hướng mặc định để dùng router của SPA
      e.preventDefault();
      window.history.pushState({}, "", "/");
      window.dispatchEvent(new PopStateEvent("popstate"));
    };

    el.addEventListener("arcade:game-over", onGameOver);
    el.addEventListener("arcade:home", onHome);
    return () => {
      el.removeEventListener("arcade:game-over", onGameOver);
      el.removeEventListener("arcade:home", onHome);
    };
  }, []);

  return <arcade-404 ref={ref} home-url="/" locale="vi" />;
}
