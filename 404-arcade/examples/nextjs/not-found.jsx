/**
 * app/not-found.jsx — trang 404 của Next.js App Router.
 * Copy file này + Arcade404Client.jsx vào thư mục app/ của dự án.
 */

import Arcade404Client from "./Arcade404Client";

export const metadata = {
  title: "404 — Trang không tồn tại",
};

export default function NotFound() {
  return <Arcade404Client />;
}
