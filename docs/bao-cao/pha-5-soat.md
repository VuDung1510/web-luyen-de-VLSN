# Soát code Pha 5 — Màu xanh #1D6B3E và logo VLSN (giữ bố cục)

Người soát: độc lập (không phải người làm). Nhánh `pha-5-thiet-ke` (commit `c9804ee`), so với `main` (`0715c88`, đúng `origin/main`, nhánh đã nằm trên `main` mới nhất). Lệnh: `git diff main...pha-5-thiet-ke`. Hai commit đầu nhánh chỉ là đặc tả và QUYET-DINH, không phải code.
Ngày: 19/11/2026.

## Tóm tắt cho giáo viên
- Pha 5 làm đúng đặc tả. Màu xanh dương đổi hết sang xanh #1D6B3E. Màu "đúng" đổi sang xanh nõn chuối nên không lẫn với màu chính. Chữ trên nút đọc rõ ở cả chế độ sáng và tối.
- Logo tạm (mê cung chữ Q) chỉ lấy từ một file `assets/img/logo-vlsn.png`. Về sau thầy đổi logo bằng cách thay đúng file này. Cuối trang có dòng "HỆ THỐNG GIÁO DỤC VẬT LÝ SIÊU NHẨM", hotline và slogan. Tên giáo viên không còn hiện ở đâu.
- Bố cục trang giữ nguyên. Máy chủ (Code.gs) không đổi. Web chạy được với máy chủ đang dùng thật (1.0.0).
- Không có lỗi phải sửa trước khi gộp. Chỉ có vài ghi chú nhỏ để Pha 6 xem tiếp.

## Kết luận: **ĐẠT**
Không có phát hiện Nặng hay Vừa. Có 4 phát hiện Nhẹ (R-1 … R-4), không chặn việc gộp.

## Đã kiểm
- **Bảng ánh xạ màu** (`assets/css/style.css` 8–39). Khối sáng và hai khối tối khớp từng mã với bảng ở mục 1 của đặc tả: `--primary`, `--primary-hover` (mới), `--primary-soft`, `--good`, `--good-soft`, `--on-status` (mới). `--primary-ink`, `--bad`, `--accent` và nhóm nền/chữ/viền giữ nguyên. Hai khối tối (`@media … :root:not([data-theme="light"])` và `:root[data-theme="dark"]`) giống hệt nhau. `.btn-primary:hover` đã dùng `--primary-hover`, bỏ `filter`. Cả 5 dòng `color: #fff` trên nền đúng/sai đã đổi sang `var(--on-status)`. Viền focus giữ như cũ.
- **Màu cũ còn sót**: grep không phân biệt hoa thường trong `index.html`, `admin.html`, `style.css`, `assets/js/*.js`.
  - 9 chuỗi màu cũ: 0 kết quả.
  - Mã màu có trong `style.css` mà `main` không có: đúng 10 mã mới của bảng ánh xạ, không thừa mã nào.
  - JS: chỉ còn `#fff`, `#000`, `#555` (vẽ canvas khi nén ảnh `admin.js:456` và phiếu in `admin.js:1261–1262`, đúng danh sách cho phép). Màu viết thẳng trong HTML do JS sinh ra đều dùng `var(--good)` / `var(--bad)`.
  - Phần Pha 3 (tab Tải file lên: màu vàng đánh dấu `#fff8db`, `#ffe58f`, `#a5841c`…) và Pha 4 (Luyện tập, tab Pool) chỉ dùng biến hoặc màu vàng "cần sửa". Những màu này không phải màu chủ đạo, nên được giữ.
  - Chart.js: `chTimeline`, `chBins`, `chQ` lấy màu qua `App.cssVar` (`app.js:793`, `admin.js:725,731`). Vòng điểm `common.js:584` dùng biến. Không có mã màu viết cứng.
- **Tương phản**: tôi tự tính lại bằng script Python riêng (WCAG 2.1, ΔE76 với D65). Mọi cặp ở bảng "Số liệu đã tính sẵn" khớp đến 0,01 với đặc tả và với `pha5.test.js`. Thấp nhất là `--good` trên `--surface-2` (sáng): 4,99. Tôi kiểm thêm các cặp ngoài bảng:
  - Tối: `--good` trên `--surface-2` 9,70; trên `--bg` 12,20.
  - Sáng: `--good` trên `--primary-soft` 4,80; `--primary` trên `--good-soft` 6,00.
  - `--muted` trên `--primary-soft`: sáng 5,09, tối 5,13 (hàng "tôi" trong bảng).
  - Tất cả đều ≥ 4,5.
  - ΔE76: `--primary`/`--good` là 27,0 ở chế độ sáng (cũ 15,4) và 55,3 ở chế độ tối. Đều ≥ 25.
- **Chế độ tối**:
  - Ô logo luôn nền trắng: `background: #fff` cứng; e2e đo ra `rgb(255, 255, 255)` ở chế độ tối.
  - `--on-status` tối là `#0b1020`, nên chữ trên nền đúng/sai đọc được. Trước đây chữ trắng trên `#4ade80` gần như không đọc được.
  - Tôi đã xem ảnh 16 (kết quả, tối): chữ rõ, chân trang hiện đúng.
- **Logo**:
  - Chỉ có một đường dẫn ảnh logo, `assets/img/logo-vlsn.png`, ở 4 chỗ: hai `<img>` và hai favicon. Favicon SVG chữ Φ và `style="background:var(--accent)"` đã bỏ. Không còn ký tự `Φ`.
  - File logo: PNG RGBA 96×96, 15 911 byte.
  - `alt="Vật Lý Siêu Nhẩm"`.
  - Chú thích "Logo TẠM" có ở `index.html:20` và `admin.html:20` (xem R-4).
  - CSS `.brand-logo`: 34×34, `object-fit: contain`, `padding: 2px`, `flex: none`. Có `* { box-sizing: border-box }` (`style.css:41`), nên khung vẫn đúng 34×34.
  - Báo cáo người làm và chú thích ảnh đều gọi đây là logo **tạm**. Không chỗ nào gọi là logo chuẩn.
- **Không tên giáo viên**:
  - `teacherName` không còn được dùng ở đâu trong `assets/`.
  - `applyPub()` (`app.js:41–50`) vẫn đặt `appName`, `document.title` và nút Xếp hạng như cũ. Chỉ bỏ dòng ghi chân trang.
  - Chân trang là chữ tĩnh trong HTML. Ẩn/hiện theo id vẫn chạy (`app.js:118, 393`), và bản in vẫn ẩn chân trang (`style.css` `@media print`).
- **XSS**:
  - Chân trang là chữ tĩnh, không chèn dữ liệu.
  - Tên ứng dụng đặt bằng `textContent` / `document.title`.
  - Gợi ý ô "Tên giáo viên" (`admin.js:1347`) là chuỗi hằng, chèn qua `u.hint` (`admin.js:1375`) giống các gợi ý có sẵn.
  - Không có đường chèn mới nào từ dữ liệu người dùng.
- **Hành vi JS ngoài phạm vi**: diff JS chỉ có 2 dòng: bỏ dòng ghi chân trang trong `app.js:49` và thêm `hint` trong `admin.js:1347`. Không đổi gì khác.
- **Code.gs**: `git diff main...pha-5-thiet-ke -- apps-script/` rỗng. `APP_VERSION` không đổi, nên giáo viên không phải dán lại Code.gs.
- **Bố cục**:
  - Tôi so `bo-cuc-truoc.json` với `bo-cuc-sau.json` từng giá trị. Mọi khối giữ nguyên vị trí và kích thước. Chỉ phần tử tiêu đề (`heads`) rộng thêm 1–4 px, do đổi độ đậm 700 → 800 với phông dự phòng. Kết quả này đúng như đặc tả cho phép.
  - Chạy lại e2e: TC-5.8 đạt cho 12 màn × khổ.
- **Phông**:
  - Link Google Fonts gộp một dòng, có `display=swap` (`index.html:13`, `admin.html:13`).
  - `--font-head: "Montserrat", var(--font)` chỉ áp cho `h1–h3` và `.footer-brand`, không áp cho `.brand`.
  - Tôi tự thử thêm (`scratchpad/soat5/f.js`). Khi request Google Fonts bị từ chối ngay, trang hiện sau khoảng 0,1 s, logo tải được, không lỗi JS, tiêu đề dùng phông dự phòng. Khi request bị treo, xem R-1.
- **Test chạy lại**:
  - `node tests/pha5.test.js`: 9/9.
  - `tests/pha5.e2e.js all`, chạy với `PORT_NEW=PORT_OLD=8795`, `SHOTS` trỏ vào thư mục nháp và có bản sao `bo-cuc-truoc.json`: **tất cả đạt** ở cả máy chủ mới và `SERVER_COMPAT=1.0.0`. Đạt các mục TC-5.5, 5.7, 5.8, 5.10, 5.11, 5.12, cả chế độ tối, cả phần thay bằng logo ngang 300×100.
  - Không chạy các e2e cũ cố định cổng khác (`e2e.js`, `bank.e2e.js`…), vì người kiểm thử đang chạy song song. Tôi dựa vào kết quả người làm đã ghi.
- **7 (+1) chỗ lệch người làm nêu**: tôi chấp nhận tất cả.
  - (1) Phông chưa đo thật: do môi trường. Đặc tả đã dự liệu. Xem R-3.
  - (2) TC-5.8 chỉ so với máy chủ mới: hợp lý, vì máy chủ 1.0.0 cho trang có dữ liệu khác.
  - (3) Cách tính dung sai: đúng ý đặc tả. Mọi chênh đều bằng 0 nên không ảnh hưởng kết quả.
  - (4) Vị trí chú thích: xem R-4.
  - (5) Không in hoa tiêu đề và (6) không có `favicon-32.png`: đặc tả cho phép.
  - (7) Lighthouse chưa đo: đặc tả chỉ khuyến nghị.
  - (8) Ảnh 20 là phần thêm, hữu ích.
- **Lỗi K-1 của Pha 1 trên `main`**: lỗi này có sẵn trước Pha 5. Bố cục Pha 5 lệch 0 px so với `main`, nên Pha 5 không gây ra lỗi này. Đồng ý với người làm: điều phối nên mở việc riêng.

## Phát hiện

| Mã | Mức | Vị trí | Vấn đề | Đề xuất |
|---|---|---|---|---|
| R-1 | Nhẹ | `index.html:13`, `admin.html:13` | `<link rel="stylesheet">` tới fonts.googleapis.com **chặn hiển thị** khi request bị treo (ví dụ tường lửa trường nuốt gói tin thay vì từ chối). Tôi thử treo 3 s thì trang hiện sau 3,36 s. `display=swap` chỉ áp cho file phông, không áp cho file CSS này. Lỗi **có sẵn trên `main`** (link Be Vietnam Pro đã có từ trước). Pha 5 không thêm request mới, vì Montserrat gộp chung một URL. | Không sửa ở Pha 5. Ghi vào Pha 6: tải CSS phông không chặn (`media="print" onload="this.media='all'"` kèm `<noscript>`), hoặc đặt file phông trong repo. |
| R-2 | Nhẹ | `docs/bao-cao/anh/pha-5/bo-cuc-truoc.json:3` | Trường `phong` của file "trước" ghi `montserrat: true`. File này do phiên bản e2e cũ hơn sinh ra, dùng `document.fonts.check`, mà hàm này trả `true` khi không có phông nào cần tải. Bản `main` không có Montserrat, nên giá trị này dễ gây hiểu nhầm. File "sau" ghi đúng: `daTai: []`. Không ảnh hưởng số đo. | Khi sinh lại số đo "trước", dùng cùng mã đo phông với file "sau", hoặc sửa tay trường `phong` thành `daTai: []` kèm ghi chú. |
| R-3 | Nhẹ | `assets/css/style.css:46` | Chưa ai xem tiêu đề Montserrat 800 trên mạng thật. Montserrat rộng hơn phông dự phòng, nên tiêu đề dài (tên đề ở `h1`, khổ 390) có thể xuống dòng. TC-5.8 cho phép trường hợp này, nhưng chưa có ảnh làm bằng chứng. | Người kiểm thử hoặc giáo viên mở trang thật trên điện thoại, xem một đề có tên dài. Nếu xấu thì cân nhắc hạ cấp chữ `h1` ở khổ hẹp. Không chặn việc gộp. |
| R-4 | Nhẹ | `index.html:20`, `admin.html:20` | Chú thích "Logo TẠM" nằm ở dòng ngay trên `<a class="brand">`, chưa đúng "ngay trên `img.brand-logo`" như đặc tả. `img` là phần tử con đầu tiên của thẻ `<a>`, nên người đọc code vẫn thấy ngay. Người làm đã nêu lý do (giữ DOM, lệch số 4). | Chấp nhận, không cần sửa. |

## Ghi chú cho điều phối
- Bản sao `docs/QUYET-DINH.md` trên nhánh được chép từ Drive ở đầu pha. Tôi đối chiếu mục 6 và mục 9 với đặc tả và thấy thống nhất. Tôi không đọc lại bản trên Drive.
- Đề nghị ghi R-1 và R-3 vào danh sách Pha 6.
