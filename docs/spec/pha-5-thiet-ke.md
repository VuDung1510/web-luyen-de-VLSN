# Pha 5 — Thiết kế nhận diện VLSN (phương án B)

## Mục tiêu
Đổi giao diện trang học sinh và quản trị sang nhận diện Vật Lý Siêu Nhẩm theo phương án B đã chốt: **nền sáng cho phần làm bài**; **đầu trang và trang kết quả phong cách bảng đen**; có **chế độ tối**. Chỉ đổi giao diện, không đổi chức năng.

## Nguồn nhận diện (bắt buộc dùng đúng)
- Logo: file gốc nằm ngoài repo, trong thư mục skill `mo-phong-bai-toan/assets/logo-vat-ly-sieu-nham.png` (480×480, 177 KB, nền trắng). **Việc đầu tiên của pha**: chép và tối ưu vào repo, rồi commit; không tìm thấy file gốc thì hỏi giáo viên. Xuất bản tối ưu `assets/img/logo-vlsn.png` ≤ 128×128, ≤ 25 KB (và `favicon` 32×32). Luôn đặt trên **thẻ trắng bo góc**, không đặt thẳng lên nền tối.
- Màu bảng đen: nền `#1e2b27` / `#24332e`, khung gỗ `#7b5a3a`, phấn trắng `#f1eee4`, phấn mờ `#b9c2ba`, vàng nhấn `#f5d76a`, xanh `#9fd0ee`, hồng cảnh báo `#f3a3a3`, nền trang tối `#141a18`.
- Phông Montserrat (Google Fonts — ngoại lệ đã ghi ở 00 §7; `subset=vietnamese`, `display=swap`, trọng số 400/600/800); tiêu đề in hoa đậm 800. Công thức giữ KaTeX (phông có chân).
- Slogan trên tiêu đề: `VẬT LÝ SIÊU NHẨM - ĐỊNH HƯỚNG TRUYỀN CẢM HỨNG`, gạch chân vàng dưới đầu trang.
- Chân trang: trái `HỆ THỐNG GIÁO DỤC VẬT LÝ SIÊU NHẨM` (vàng, đậm), phải `Hotline: 0978 650726 - 0326 425 111`.
- Chỉ thương hiệu trung tâm: **bỏ** "Giáo viên: <TEN_GIAO_VIEN>" khỏi chân trang (`app.js` `applyPub`), không hiện tên giáo viên ở đầu/chân trang. `TEN_GIAO_VIEN` giữ trong CaiDat, không xóa.

## Phạm vi
**Làm**: `assets/css/style.css` (biến màu mới, hai chủ đề), `index.html`, `admin.html` (đầu trang, chân trang, logo, phông, nút chế độ tối), chỉnh nhỏ HTML sinh trong `app.js`/`admin.js`/`common.js` để gắn lớp CSS (vd `.chalk` cho trang kết quả). **Không làm**: đổi bố cục luồng làm bài, đổi chữ/nội dung nhận xét, thay KaTeX/Chart.js, giao diện in thẻ học sinh (`printCards` giữ nền trắng).
**Hoãn sau**: số thứ tự câu trong lục giác vàng ở trang kết quả; điểm Lighthouse (chỉ khuyến nghị).

## Thiết kế kỹ thuật
- Biến CSS: giữ tên biến hiện có (`--bg`, `--surface`, `--text`, `--primary`…) để không phải sửa mọi chỗ; thêm nhóm `--chalk-bg`, `--chalk-bg-2`, `--wood`, `--chalk`, `--chalk-dim`, `--accent-yellow`, `--accent-blue`, `--accent-pink`.
- Chủ đề sáng (mặc định khi hệ điều hành sáng): nền trang sáng ấm (vd `#f6f4ee`), thẻ trắng, chữ `#1e2b27`, nút chính xanh bảng đen `#24332e` chữ phấn trắng, điểm nhấn vàng `#f5d76a` (chỉ làm nền/viền, không làm chữ trên nền sáng vì độ tương phản thấp).
- Chủ đề tối: nền `#141a18`, thẻ `#1e2b27`, chữ `#f1eee4`, chữ phụ `#b9c2ba`, nhấn vàng/xanh/hồng.
- Đầu trang (cả hai chủ đề): dải bảng đen `#1e2b27` có viền gỗ `#7b5a3a` dưới, thẻ logo trắng bên trái, slogan nhỏ + tên ứng dụng in hoa 800, gạch chân vàng.
- Trang kết quả (`resultHtml` trong `common.js`): khối điểm lớn kiểu bảng đen (số điểm vàng, chữ phấn), phần chi tiết câu bên dưới dùng nền theo chủ đề.
- Trang làm bài (`runExam`): luôn nền sáng ở chủ đề sáng; ở chủ đề tối dùng thẻ tối nhưng giữ độ tương phản cao; đồng hồ còn ≤ 5 phút: ở chủ đề sáng dùng nền/viền hồng `#f3a3a3` với chữ màu đậm (chữ hồng trên nền sáng chỉ đạt khoảng 2:1); ở chủ đề tối được dùng chữ hồng.
- Nút chế độ tối: ở đầu trang, 3 trạng thái Tự động/Sáng/Tối, lưu `localStorage` `ld_theme`, đặt `data-theme` trên `<html>` **trước khi vẽ trang** (script nhỏ inline trong `<head>`) để không nháy.
- Biểu đồ Chart.js: màu lấy từ biến CSS, vẽ lại khi đổi chủ đề.
- Hiệu năng: tổng CSS + logo + phông thêm ≤ 120 KB; không thêm thư viện JS.

## Tương thích máy chủ
Không đổi Code.gs. Chạy được với 1.0.0.

## Tiêu chí nghiệm thu
- **TC-5.1** Mọi màu nhận diện trong `style.css` trùng đúng mã hex đã chốt (kiểm bằng script tìm chuỗi); không còn màu chủ đạo xanh dương cũ `#1d4ed8` ở đầu trang.
- **TC-5.2** Độ tương phản (tính bằng công thức WCAG trong test): chữ thường trên nền ≥ 4.5:1, chữ lớn/nút ≥ 3:1, ở cả hai chủ đề, cho các cặp: chữ/nền trang, chữ/thẻ, chữ nút chính, chữ phụ/thẻ, chữ trên dải bảng đen.
- **TC-5.3** Logo hiển thị trên thẻ trắng ở cả hai chủ đề; file logo ≤ 25 KB; có `alt`.
- **TC-5.4** Slogan và chân trang đúng từng ký tự (so chuỗi); không xuất hiện giá trị `TEN_GIAO_VIEN` ở đầu/chân trang khi CaiDat có tên giáo viên.
- **TC-5.5** Đổi chế độ tối/sáng: giữ sau khi tải lại. Chống nháy: `<script>` đặt chủ đề là phần tử script đầu tiên trong `<head>` (kiểm tra tĩnh), và `document.documentElement.dataset.theme` đã có giá trị khi sự kiện `DOMContentLoaded` xảy ra (`page.on('domcontentloaded')` + `evaluate`).
- **TC-5.6** Khổ 360, 390, 768, 1280 px: không thanh cuộn ngang ở mọi trang (e2e đo `scrollWidth <= innerWidth`).
- **TC-5.7** Công thức KaTeX và hình câu hỏi đọc rõ ở chế độ tối (ảnh chụp; KaTeX dùng `color: inherit`).
- **TC-5.8** Trang kết quả có khối điểm phong cách bảng đen (nền `#1e2b27`, số điểm màu `#f5d76a`).
- **TC-5.9** Toàn bộ e2e cũ đạt (selector không đổi, hoặc kiểm thử cập nhật selector và ghi rõ).
- **TC-5.10** Không lỗi console; Lighthouse Accessibility ≥ 90 trang đăng nhập và trang chủ (khuyến nghị).

## Kế hoạch kiểm thử
`tests/pha5.test.js` (TC-5.1, 5.2, 5.4 tĩnh), `tests/e2e-pha5.js` (5.3, 5.5–5.9). Bộ ảnh bắt buộc (sáng + tối, 390×844 và 1280×800): đăng nhập, trang chủ HS, giới thiệu đề + mục tiêu, đang làm bài, kết quả, thống kê, quản trị tổng quan, trình soạn đề, ngân hàng (nếu Pha 2 đã gộp). Giáo viên duyệt bằng ảnh.

## Rủi ro & cách giảm
- Vàng trên nền sáng khó đọc ⇒ chỉ dùng vàng làm nền/viền ở chủ đề sáng (TC-5.2).
- Phông Google bị chặn ⇒ phông dự phòng `system-ui`.
- Đổi lớp CSS làm vỡ selector e2e ⇒ giữ id/lớp chức năng, chỉ thêm lớp mới.
- Gộp sau Pha 2/4 dễ xung đột CSS ⇒ Pha 5 rebase lên `main` mới nhất trước khi soát.

## Việc giáo viên cần làm
Duyệt ảnh chụp; trả lời câu hỏi mở số 8 (bản thiết kế bên Cowork) trước khi bắt đầu pha.

## Ước lượng: **M**

Sửa đặc tả ngày 18/11/2026: theo `soat-pha-0.md` S-25, S-26; hoãn lục giác vàng.
