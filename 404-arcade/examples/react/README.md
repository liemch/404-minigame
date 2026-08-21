# Ví dụ React / Vite

> Máy phát triển gói này đang offline nên ví dụ không kèm `node_modules`.
> Khi có mạng: `npm create vite@latest my-app -- --template react`, copy 2 file dưới vào `src/`, và cài package `404-arcade-widget` (hoặc trỏ tới thư mục `dist/`).

## `src/NotFoundPage.jsx`

```jsx
import { useEffect, useRef } from "react";
import "404-arcade-widget/style.css";
import "404-arcade-widget"; // đăng ký custom element <arcade-404>

export default function NotFoundPage() {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    const onOver = (e) => console.log("score:", e.detail);
    el.addEventListener("arcade:game-over", onOver);
    // Chặn điều hướng cứng, dùng router của SPA:
    const onHome = (e) => {
      e.preventDefault(); // hủy điều hướng mặc định của component
      // navigate("/") bằng react-router tại đây
    };
    el.addEventListener("arcade:home", onHome);
    return () => {
      el.removeEventListener("arcade:game-over", onOver);
      el.removeEventListener("arcade:home", onHome);
    };
  }, []);

  return <arcade-404 ref={ref} home-url="/" locale="vi" />;
}
```

## Ghi chú

- Custom element hoạt động trực tiếp trong JSX (React 19 hỗ trợ custom element tốt; React 18 dùng thuộc tính chữ-thường như trên là đủ).
- Nếu chưa phát hành npm, có thể import theo đường dẫn file:
  `import "./vendor/404-arcade/arcade-404.es.js"` (kèm thư mục `es/` và `chunks/` nếu build bằng Vite).
