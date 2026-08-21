# Ví dụ Next.js (App Router)

Custom element và game chỉ chạy trên trình duyệt nên cần client wrapper.

## `components/Arcade404Client.jsx`

```jsx
"use client";

import { useEffect } from "react";
import "404-arcade-widget/style.css";

export default function Arcade404Client() {
  useEffect(() => {
    // Import động để tránh chạy trên server
    import("404-arcade-widget");
  }, []);

  return <arcade-404 home-url="/" locale="vi" />;
}
```

## `app/not-found.jsx`

```jsx
import Arcade404Client from "../components/Arcade404Client";

export default function NotFound() {
  return <Arcade404Client />;
}
```

## Ghi chú

- Không render `<arcade-404>` trong môi trường SSR trước khi element được
  define — wrapper trên xử lý đúng thứ tự (define xong mới hiển thị UI game;
  trước đó element là thẻ trơ, không lỗi hydration).
- Muốn giữ người dùng trong SPA khi bấm "Về trang chủ": nghe sự kiện
  `arcade:home`, gọi `event.preventDefault()` rồi `router.push("/")`.
