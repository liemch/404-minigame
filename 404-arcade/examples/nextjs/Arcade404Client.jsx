"use client";

/**
 * Wrapper client cho Next.js App Router.
 * Custom element + game chỉ chạy trên trình duyệt nên import động
 * trong useEffect (không SSR).
 */

import { useEffect } from "react";
import "404-arcade-widget/style.css";

export default function Arcade404Client() {
  useEffect(() => {
    import("404-arcade-widget"); // đăng ký <arcade-404> phía client
  }, []);

  return <arcade-404 home-url="/" locale="vi" />;
}
