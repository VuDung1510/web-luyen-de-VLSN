# Pha 6b — Làm cùng giáo viên trên trang thật

## A0. Số gốc trên máy chủ 1.0.0 (21/11/2026, máy tính của giáo viên, Chrome, cửa sổ ẩn danh)
Lượt đo: đăng nhập học sinh → Lịch sử → Thống kê → Xếp hạng → Trang chủ; F5 giữa các lượt. Lọc "exec" trong thẻ Network.

| Lượt | Số lời gọi `exec` | Thời gian từng lời gọi (s, đến lúc chuyển hướng 302) | Trung bình |
|---|---|---|---|
| 1 | 8 | 1,84 · 3,68 · 2,35 · 3,66 · 2,92 · 4,06 · 3,47 · 2,15 | ≈ 3,0 s |
| 2 | 8 | 3,55 · 3,76 · 3,81 · 3,41 · 3,49 · 4,50 · 5,20 · 4,60 | ≈ 4,0 s |
| 3 | 8 | 3,65 · 7,02 · 4,87 · 4,38 · 4,68 · 3,90 · 3,78 · 3,17 | ≈ 4,4 s |

- Cả lượt kéo dài khoảng 20–35 s (dải thời gian của Network).
- Ghi chú: giao diện hiện tại (Pha 1–6a) đang chạy với máy chủ 1.0.0 qua đường dự phòng; con số là điểm gốc để so ở TC-6.7 sau khi dán Code.gs 1.5.0.

## A1–A6. Triển khai Code.gs 1.5.0 (21/11/2026)
- A1: đã sao lưu Sheet; phiên bản triển khai trước khi dán: **2** (quay về số này nếu có sự cố).
- A2–A3: dán Code.gs 1.5.0 vào Sheet gốc, chạy `setup`, cấp quyền: xong; có thêm `LuyenTap`, `KetQuaLuyenTap`, dữ liệu cũ còn nguyên.
- A4: đã điền link kho và thư mục hình; `CHO_LUYEN_TAP` = KHONG.
- A5: triển khai Phiên bản mới.
- A6 `kiemTraSauTrienKhai`: **TẤT CẢ ĐỀU ỔN** — phiên bản 1.5.0, features đủ 6; HocSinh 8 cột/1 hàng, DeThi 13/1, CauHoi 21/6, KetQua 19/1, CaiDat 3 cột/13 dòng, LuyenTap 18/0, KetQuaLuyenTap 20/0; mở được kho (10 239 hàng, đủ cột) và thư mục "02. HÌNH VẼ"; luyện tập đang tắt; CacheService ghi/đọc được.

## B1 / TC-6.7. Đo lại sau khi triển khai 1.5.0 (cùng máy, cùng cách đo như A0)
| Lượt | Số lời gọi `exec` | Thời gian từng lời gọi (s) | Trung bình |
|---|---|---|---|
| 1 | 5 | 2,57 · 1,75 · 1,15 · 1,48 · 3,21 | ≈ 2,0 s |
| 2 | 5 | 4,43 · 1,23 · 1,40 · 0,89 · 3,18 | ≈ 2,2 s |
| 3 | 5 | 2,99 · 1,35 · 1,41 · 1,03 · 1,45 | ≈ 1,6 s |

- So với A0: số lời gọi mỗi lượt **8 → 5**; thời gian trung bình mỗi lời gọi **3,0–4,4 s → 1,6–2,2 s**; cả lượt 20–35 s → 18–23 s.
- Giáo viên thấy viên "Đang cập nhật" khi chuyển tab (đúng thiết kế Pha 1: hiện dữ liệu đã lưu rồi cập nhật ngầm; lần đầu trong cửa sổ ẩn danh chưa có dữ liệu lưu nên phải chờ). Rời trang > 60 s rồi quay lại thì lời gọi chậm hơn: hết đệm máy chủ 60 s và Apps Script "ngủ" (đã chốt không làm hẹn giờ giữ ấm).
- Nút Đổi PIN đã hiện cho học sinh.
