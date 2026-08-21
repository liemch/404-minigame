Bạn là Senior Frontend Engineer đồng thời có kinh nghiệm xây dựng HTML5 Canvas mini game.

Hãy xây dựng dự án “404 Arcade” dựa trên kế hoạch dưới đây.

MỤC TIÊU
Tạo một trang 404 hiện đại, nơi người dùng có thể quay về trang chủ hoặc chọn một trong nhiều mini game để chơi trực tiếp. Đây phải là một sản phẩm chạy được, không phải mockup giao diện.

CÔNG NGHỆ
- HTML5
- CSS3
- JavaScript ES Modules
- HTML5 Canvas
- localStorage
- Không backend
- Không framework
- Không CDN
- Không dùng thư viện game lớn
- Có thể chạy bằng local static server

GAME TRONG MVP
1. Endless Runner
2. Bug Hunter
3. Stack Tower
4. Snake

YÊU CẦU KIẾN TRÚC
- Mỗi game là một module độc lập.
- Tạo game registry để đăng ký và lazy-load game.
- Tất cả game phải có interface vòng đời thống nhất:
  mount(container, options)
  start()
  pause()
  resume()
  restart()
  destroy()
- Chỉ một game được phép hoạt động tại một thời điểm.
- destroy() phải hủy requestAnimationFrame, timer, event listener và âm thanh.
- Tách input manager, audio manager và storage thành module dùng chung.
- Không tạo một file JavaScript khổng lồ.
- Ưu tiên code dễ đọc, dễ mở rộng và có chú thích ở các đoạn logic phức tạp.

TRẢI NGHIỆM
- Phần đầu phải thể hiện rõ đây là lỗi 404.
- Có nút “Về trang chủ” luôn hiển thị.
- Danh sách game trình bày dưới dạng card.
- Khi chọn, game mở ngay trên trang và không reload.
- Mỗi game có hướng dẫn điều khiển ngắn.
- Game Over hiển thị điểm, kỷ lục, Chơi lại, Đổi game và Về trang chủ.
- Hỗ trợ keyboard, mouse và touch.
- Esc để đóng game.
- Tự pause khi document.visibilityState chuyển sang hidden.
- Không tự phát âm thanh trước tương tác đầu tiên của người dùng.
- Lưu điểm cao và lựa chọn âm thanh bằng localStorage.

GIAO DIỆN
- Phong cách Retro Arcade hiện đại.
- Nền tối xanh tím.
- Điểm nhấn cyan, tím và hồng.
- Card có hiệu ứng kính mờ vừa phải.
- Chuyển động mượt nhưng không lạm dụng.
- Responsive từ 360px.
- Không bắt buộc người dùng mobile phải xoay ngang.
- Tôn trọng prefers-reduced-motion.
- Có focus state rõ ràng và hỗ trợ thao tác bàn phím.

GAMEPLAY
Endless Runner:
- Nhân vật tự chạy.
- Space, ArrowUp hoặc touch để nhảy.
- Né chướng ngại vật.
- Có vật phẩm cộng điểm.
- Tốc độ tăng dần nhưng phải có giới hạn.

Bug Hunter:
- Bug xuất hiện ngẫu nhiên.
- Click hoặc touch để tiêu diệt.
- Một lượt 30 giây.
- Có nhiều loại bug với điểm và tốc độ khác nhau.
- Có loại nguy hiểm khiến người chơi bị trừ điểm.

Stack Tower:
- Khối di chuyển ngang.
- Click, Space hoặc touch để thả.
- Phần lệch bị cắt.
- Game kết thúc khi khối không còn giao nhau.
- Điểm bằng số tầng.

Snake:
- Điều khiển bằng Arrow hoặc WASD.
- Có điều khiển cảm ứng trên mobile.
- Rắn không được đảo ngược hướng trực tiếp.
- Ăn vật phẩm để dài hơn.
- Tăng tốc theo cấp độ.
- Va tường hoặc thân thì kết thúc.

CHẤT LƯỢNG
- Không có lỗi console.
- Không dùng eval hoặc innerHTML với dữ liệu không tin cậy.
- Không có memory leak khi đổi game nhiều lần.
- Nếu JavaScript hoặc Canvas lỗi, nút Về trang chủ vẫn sử dụng được.
- Chỉ tải module game khi người dùng chọn.
- Dùng CSS variables cho màu sắc, khoảng cách và theme.
- Không dùng emoji làm toàn bộ hệ thống icon chính; có thể dùng SVG nội bộ hoặc hình vẽ Canvas.
- Không được để TODO giả hoặc chức năng nút bấm chưa hoạt động.

CÁCH THỰC HIỆN
1. Kiểm tra thư mục dự án và các file hiện có.
2. Nếu dự án chưa tồn tại, khởi tạo cấu trúc rõ ràng.
3. Viết kế hoạch triển khai ngắn trước khi code.
4. Xây foundation và hoàn thiện từng game theo thứ tự:
   - Endless Runner
   - Bug Hunter
   - Stack Tower
   - Snake
5. Sau mỗi game, tự kiểm tra vòng đời start/pause/restart/destroy.
6. Chạy ứng dụng và sửa toàn bộ lỗi runtime.
7. Kiểm tra responsive desktop/mobile.
8. Viết README bằng tiếng Việt gồm:
   - Cách chạy
   - Cấu trúc dự án
   - Cách thêm game mới
   - Cách tích hợp vào trang 404 của website khác
9. Cuối cùng, báo cáo:
   - File đã tạo hoặc thay đổi
   - Tính năng hoàn thành
   - Cách chạy
   - Kết quả kiểm thử
   - Hạn chế còn lại

Hãy bắt đầu bằng việc khảo sát repository hiện tại. Không tự ý thay đổi framework hoặc xóa code đang có. Nếu repository đã dùng React, Next.js hoặc framework khác, hãy giữ nguyên stack hiện tại và điều chỉnh kiến trúc cho phù hợp, nhưng vẫn phải giữ mỗi game thành module độc lập.