# Pha 5 — Báo cáo kiểm thử (người kiểm thử, độc lập)

Nhánh `pha-5-thiet-ke`, code tính năng ở commit `34d2c53` (báo cáo người làm `c9804ee`). So với `main` `0715c88`. Đặc tả `docs/spec/pha-5-thiet-ke.md` (bản sửa 19/11/2026). Ngày 19/11/2026.

## Tóm tắt cho giáo viên
- **Kết luận: CHƯA ĐẠT, chỉ vì một lỗi nhỏ về bố cục (K-1).** 14/15 TC đạt (tính cả TC-5.15, mục khuyến nghị).
- Màu xanh #1D6B3E đã thay hết màu xanh dương cũ, ở cả chế độ sáng và tối. Màu "đúng" (xanh nõn chuối) dễ phân biệt với màu chính. Chữ trên nền màu đều đủ độ tương phản.
- Logo tạm (mê cung chữ Q) hiện ở đầu trang học sinh và trang quản trị, và trên tab trình duyệt. Ô logo luôn có nền trắng. Đã thử thay bằng một ảnh ngang: khung logo vẫn 34×34, trang không bị xô.
- Chân trang có đủ 3 dòng thương hiệu. Đã đặt tên giáo viên "Thầy Thử Nghiệm": tên này không hiện ở đầu trang hay chân trang.
- **K-1 (Nhẹ):** trên điện thoại, khi tải được phông Montserrat (trên trang thật sẽ tải được), tiêu đề "Ngân hàng câu hỏi" rộng hơn trước. Nút "↻ Đọc lại kho" vì thế rơi xuống dòng dưới, đẩy cả tab Ngân hàng xuống 35 px. Chỉ gặp ở trang quản trị, khổ 390.

## Cách kiểm
- **`tests/pha5-kiem-thu.test.js`** (Node, không cần trình duyệt): **27/27 mục đạt**.
  - Quét màu cũ. Lấy danh sách màu cho phép từ các file trên `main`.
  - Tự tính tỉ lệ tương phản WCAG và ΔE76 từ giá trị biến trong `style.css` (khối sáng và hai khối tối).
  - Tự giải mã PNG bằng `zlib`: kiểm CRC, IHDR và alpha từng điểm ảnh.
  - Kiểm thẻ HTML (logo, favicon, theme-color, phông, tiêu đề tab), các luật CSS nêu ở mục 1 và 5 của đặc tả, và `git diff main -- apps-script/`.
- **`tests/pha5-kiem-thu.e2e.js`** (Playwright):
  - Đi qua **20 màn**. Học sinh: đăng nhập, trang chủ, Luyện tập, làm bài, kết quả, Thống kê, Lịch sử, Xếp hạng. Quản trị: đăng nhập, tổng quan, trình soạn, tab Tải file lên, Ngân hàng, Pool, Đề thi, Học sinh, Kết quả, Bảng điểm, Cài đặt, thống kê đề.
  - Máy chủ mới chạy 4 lượt: 1280 sáng, 390 sáng, 390 tối, 1280 tối. `SERVER_COMPAT=1.0.0` chạy 3 lượt: 1280, 390, 390 tối (18 màn, máy chủ cũ không có Luyện tập và Pool).
  - Mỗi lượt khởi động một dev-server mới, nên dữ liệu ở mọi lượt giống nhau. Dữ liệu dựng qua API trước khi mở trang:
    - `adminSaveSettings` đặt `TEN_GIAO_VIEN = "Thầy Thử Nghiệm"`.
    - 5 học sinh phụ làm Đề mẫu (câu 1–2 đúng, câu 3 sai), để biểu đồ % theo câu có cả câu dễ lẫn câu khó.
    - Học sinh mẫu làm bài qua giao diện, nộp, rồi xem kết quả.
  - Đo màu bằng `getComputedStyle`. Chế độ tối dùng `emulateMedia({ colorScheme: 'dark' })`.
  - Quét màu của **mọi phần tử** ở mọi màn (color, nền, viền, outline, fill, stroke), tìm 8 màu cũ.
- **TC-5.8, bố cục:**
  - `git worktree add <nháp>/main-wt main`. Dev-server của `main` chạy ở cổng 8792; worktree đã xóa sau khi xong.
  - Đo cùng dữ liệu, cùng kịch bản, khổ 390×844 và 1280×800, chế độ sáng. Hai bên chạy giống hệt nhau (không có bước kiểm màu chen vào).
  - Đo hai lần:
    1. Google Fonts bị chặn: cả hai bên rơi về `system-ui`.
    2. Phông cục bộ từ `@fontsource` (Be Vietnam Pro 5.0.19, Montserrat 5.0.19) phục vụ qua route của Playwright, chỉ dùng khi thử. Lần này nhánh tải được thật "Montserrat 800".
  - Dung sai đúng như đặc tả. `y` được cộng thêm phần chênh chiều cao của các `h1/h2/h3` đứng trước khối; `height` được cộng phần chênh của tiêu đề nằm trong khối; `.footer` được cao hơn.
- **Logo ngang:** chép nhánh sang thư mục nháp, ghi đè `assets/img/logo-vlsn.png` trong bản chép bằng PNG 300×100 tự sinh, chạy dev-server từ bản chép (cổng 8793). File trong repo không đổi.
- **Môi trường:**
  - Google Fonts và cdnjs bị chặn. KaTeX và Chart.js lấy từ `LIBS_DIR`, route giống `routeCdn` của Pha 2.
  - Lỗi "Failed to load resource" của tài nguyên ngoài bị bỏ qua.
  - Cổng 8790–8793.
- **Thứ tự làm:**
  - Kịch bản viết theo đặc tả, DOM của trang đang chạy và mẫu `tests/pha4-kiem-thu.e2e.js`.
  - Không đọc `assets/`, `index.html`, `admin.html`, `tests/pha5*.js` của người làm. Test Node đọc `style.css` và HTML bằng chương trình, đúng như TC-5.1–5.6 yêu cầu.
  - Không sửa code tính năng hay hạ tầng test. Không commit.
- **Lệnh chạy:**
  - `node tests/pha5-kiem-thu.test.js`
  - `NODE_PATH=$(npm root -g) LIBS_DIR=… MAIN_DIR=<worktree main> WIDE_DIR=<bản chép logo ngang> FONTS_DIR=<node_modules có @fontsource> node tests/pha5-kiem-thu.e2e.js all`

## Bảng TC

| TC | Kết quả | Bằng chứng |
|---|---|---|
| TC-5.1 | **ĐẠT** | Quét 9 file. 9 chuỗi màu cũ: **0 kết quả**. `:root --primary: #1D6B3E`. Mọi mã hex và `rgb(a)` còn lại thuộc danh sách cho phép (45 giá trị; 43 lấy từ `main`, đã trừ màu cũ). Bảng ánh xạ: đúng 7 biến sáng và 7 biến tối. 11 biến "giữ nguyên" không đổi so với `main`. E2E: quét 4 717 phần tử ở 20 màn (máy chủ mới, mỗi lượt) và 2 986 phần tử (1.0.0), sáng và tối: **0** chỗ còn dùng 8 màu cũ |
| TC-5.2 | **ĐẠT** | 21/21 cặp ≥ 4,5 và khớp số trong đặc tả. Ví dụ: trắng/#1D6B3E 6,51; #1D6B3E/#e3f1e8 5,59; #4a7311/#eef2fa 4,99; tối #5fbf87/#1f2840 6,47; #0b1020/#a3e635 12,56. Viền focus `--primary`/`--surface`: sáng 6,51, tối 7,36 (≥ 3) |
| TC-5.3 | **ĐẠT** | ΔE76 sáng: primary/good **27,0**, /bad 91,6, /accent 87,3. Tối: 55,3 / 84,7 / 85,2. Đối chứng: màu "đúng" cũ #15803d chỉ 15,4. Hai khối tối có 18 biến, giá trị giống hệt nhau |
| TC-5.4 | **ĐẠT** | PNG hợp lệ (chữ ký, CRC từng khối, IHDR…IEND). **96×96**, 15 911 byte (15,5 KB), RGBA, alpha 4 góc = 0/0/0/0. Phần nét là một khối liền từ hàng 1 đến 93, không có dải chữ tách riêng ở dưới. Xem bằng mắt: chỉ còn biểu tượng mê cung, chữ "VẬT LÝ SIÊU NHẨM" đã cắt. Cả hai trang có chú thích "Logo TẠM …" ngay trên `img.brand-logo`. Báo cáo người làm ghi nguồn (`MAU_CHUAN_WORD_VLSN.docx`, 339×339) và chữ "logo tạm" |
| TC-5.5 | **ĐẠT** | Kiểm ở màn đăng nhập, trang chủ học sinh và tổng quan quản trị, cả sáng lẫn tối, cả máy chủ mới lẫn 1.0.0. Kết quả giống nhau ở mọi lần: `img` có `src="assets/img/logo-vlsn.png"` và `alt="Vật Lý Siêu Nhẩm"`; ảnh gốc 96×96; hiển thị **34×34**; `object-fit: contain`; nền `rgb(255, 255, 255)`; bo góc 10px. Favicon: một `link[rel=icon]` trỏ `assets/img/logo-vlsn.png`, trả **200 image/png**. Không còn chữ Φ. Chỉ có 7 chỗ trỏ tới ảnh, đều là `logo-vlsn.png`. **Logo ngang 300×100:** khung vẫn 34×34 ở 19 màn, mỗi khổ 390 và 1280. So bố cục với `main`: chỉ lệch ở Cài đặt (+24 px), cùng nguyên nhân với ghi chú N-1, không do logo (ảnh `kt-logo-ngang-*`) |
| TC-5.6 | **ĐẠT** | Hai trang có đúng 2 thẻ `theme-color`: `#1D6B3E` với `(prefers-color-scheme: light)`, `#0f1420` với `(prefers-color-scheme: dark)` |
| TC-5.7 | **ĐẠT** | Ở trang chủ học sinh, trang kết quả và tổng quan quản trị, `#footer` có đúng 3 dòng: `HỆ THỐNG GIÁO DỤC VẬT LÝ SIÊU NHẨM` / `Hotline: 0978 650726 - 0326 425 111` / `VẬT LÝ SIÊU NHẨM - ĐỊNH HƯỚNG TRUYỀN CẢM HỨNG`. `TEN_GIAO_VIEN` đã đặt "Thầy Thử Nghiệm" qua `adminSaveSettings`, nhưng chuỗi này và chuỗi "Giáo viên:" không có trong đầu trang hay chân trang (cũng không có ở bất kỳ đâu trên trang). Đúng ở cả máy chủ mới và 1.0.0. Màn làm bài: `#footer` bị ẩn. Dòng thương hiệu dùng `--primary` (sáng `rgb(29,107,62)`, tối `rgb(95,191,135)`), Montserrat 800 |
| TC-5.8 | **KHÔNG ĐẠT** (K-1) | So **212 khối ở 20 màn**, khổ 390 và 1280. **Phông bị chặn:** mọi khối nằm trong dung sai, trừ thẻ Cài đặt +24 px (ghi chú N-1). `.brand`, `#nav`, `#userBox` lệch 0 px. Ở khổ 390, `#userBox` nằm ở hàng thứ hai cả trên `main` lẫn nhánh (không đổi). **Phông cục bộ (Montserrat tải được):** 1280 đạt (trừ N-1). 390 **lệch** ở tab Ngân hàng: `.card-title` cao 45 → 80, `.bank-layout` tụt từ y 364 xuống 399. Đây là K-1. Chân trang cao thêm 40 px (được phép). Số đo: `kt-bo-cuc-{truoc,sau}-{390,1280}-{chan,cuc-bo}.json` |
| TC-5.9 | **ĐẠT** | 21 màn × (1280 sáng `kt-1280-*`, 390 sáng `kt-390-*`, 390 tối `kt-toi-390-*`), kèm ảnh chân trang `*-chan-trang`. Ảnh "trước" (`main`): `kt-truoc-1280-trang-chu`, `kt-truoc-1280-ket-qua`. Phóng to đầu trang có logo tạm: `kt-logo-tam-phong-to-sang/toi.png`. Máy chủ 1.0.0: `kt-1.0.0-1280-*`. Logo ngang: `kt-logo-ngang-*`. Logo trong mọi ảnh là **logo tạm** |
| TC-5.10 | **ĐẠT** | `chTimeline.borderColor` bằng `--primary` (sáng `#1d6b3e`, tối `#5fbf87`). `chBins` dùng `--primary`. `chQ` có 6 câu, dùng `#4a7311` và `#c2410c` (good và bad) ở bản 1.0.0, `#1d6b3e` và `#c2410c` ở máy chủ mới. Cả hai đều có ≥ 2 màu, đều thuộc good, primary, bad. Đạt ở cả hai máy chủ và cả hai chế độ |
| TC-5.11 | **ĐẠT** | 0 `pageerror` và 0 `console.error`. Máy chủ mới: 4 lượt × 20 màn. 1.0.0: 3 lượt × 18 màn |
| TC-5.12 | **ĐẠT** | `scrollWidth <= innerWidth` ở mọi màn, khổ 390 và 1280, sáng và tối, cả hai máy chủ |
| TC-5.13 | **ĐẠT** (*) | `backend` 13/13, `importer` đạt, `bank` 30/30, `pha2-kiem-thu` 31/31, `pha3-kiem-thu` 17/17 nhóm, `pha4-kiem-thu` 33/33. `e2e.js` đạt ở máy chủ mới và 1.0.0. `pha1-kiem-thu.e2e.js all`: 56 ✓, 1 ✗ (mục K-1 "viên Đang cập nhật ở 390 px che nút Làm lại"). Chạy độc lập trên worktree `main`: **cùng kết quả 56/1, cùng mục K-1**. Lỗi này có sẵn trên `main`, không do Pha 5. Không sửa selector cũ nào |
| TC-5.14 | **ĐẠT** | `git diff main -- apps-script/` rỗng |
| TC-5.15 (khuyến nghị) | **ĐẠT** | Lighthouse 12.2.1, chỉ mục Accessibility, chạy trên Chromium của Playwright: màn đăng nhập **100**, trang chủ học sinh (đã đăng nhập, `--disable-storage-reset`) **100** |

(*) Mục K-1 của Pha 1 hỏng như nhau trên `main` và trên nhánh.

**Ngoài TC (đã kiểm, đạt):**
- **Màu đo trên trang đang chạy (sáng → tối):**
  - Nút chính: nền `rgb(29,107,62)` → `rgb(95,191,135)`, chữ trắng → `#0b1020`. Rê chuột: `rgb(21,87,58)` → `rgb(127,211,162)`.
  - Mục điều hướng đang chọn: chữ `--primary` trên nền `--primary-soft`.
  - Thanh tiến độ `#prog`, đồng hồ, phương án đã chọn, liên kết ("Cài đặt" ở tổng quan) và tab đang chọn của hộp Tải đề đều dùng `--primary`.
- **Màu "đúng" khác màu chủ đạo:**
  - Ô phương án đúng ở trang kết quả: nền `rgb(74,115,17)`, khác `--primary`. Chữ dùng `--on-status`: trắng ở chế độ sáng, `rgb(11,16,32)` ở chế độ tối.
  - Ô sai: chữ cũng đổi theo `--on-status`.
  - Nút đáp án đã chọn trong trình soạn (`.key-pick button.sel`): đúng như trên.
- **Phông và tiêu đề:**
  - Một link Google Fonts gộp Be Vietnam Pro và Montserrat 700/800. `--font-head: "Montserrat", var(--font)`. `h1`–`h3` đậm 800.
  - `.brand` giữ nguyên bề rộng 109 px ở 1280, cả khi Montserrat tải được.
  - Tiêu đề tab quản trị là "Quản trị · Luyện đề".
  - Trang Cài đặt có gợi ý "Không hiển thị trên trang học sinh (chỉ dùng nội bộ)" ở cả hai máy chủ.
- **Giao diện in** (`@media print`) giống `main`.
- **Máy chủ 1.0.0:** không có mục Luyện tập. Tab Ngân hàng báo "cần máy chủ mới". Làm bài, nộp bài và xem kết quả bình thường.

## Lỗi

### K-1 (Nhẹ) — tab Ngân hàng ở khổ 390: tiêu đề Montserrat đẩy nút "Đọc lại kho" xuống dòng
- **Tái hiện:**
  - Trang quản trị, khổ 390×844, có tải phông thật (đo bằng `@fontsource` thay cho Google Fonts, cùng phiên bản phông). Mở tab Ngân hàng.
  - `main > .card-title` gồm `h1` "Ngân hàng câu hỏi" và nút "↻ Đọc lại kho".
  - Trên `main`: `h1` dùng Be Vietnam Pro 700, 21,6px, rộng 201 px; nút nằm cùng hàng; khối cao 45 px.
  - Trên nhánh: `h1` dùng Montserrat 800, rộng 217 px; nút rơi xuống hàng dưới; khối cao **80 px**; mọi khối bên dưới tụt **35 px**.
  - Khi Google Fonts bị chặn, cả hai bên dùng `system-ui` nên không thấy lệch. Trên trang thật Montserrat sẽ tải được, nên sẽ gặp lỗi này.
  - Chiều cao của chính `h1` không đổi (27 px). Vì vậy phần lệch không thuộc dung sai "chênh chiều cao tiêu đề" của TC-5.8.
- **Bằng chứng:**
  - Ảnh `kt-K1-ngan-hang-390-truoc.png` / `kt-K1-ngan-hang-390-sau.png`.
  - Số đo `kt-bo-cuc-{truoc,sau}-390-cuc-bo.json`, màn `qt-ngan-hang`.
- **Phạm vi:** đã kiểm 20 màn ở cả hai khổ với phông thật. Chỉ màn này bị.
- **Đề xuất (chọn một):**
  - Giữ chiều ngang như cũ cho tiêu đề này ở khổ hẹp, ví dụ thu nhỏ cỡ chữ `h1` trong `.card-title` ở `@media (max-width: …)`, hoặc rút gọn nhãn nút thành "↻ Đọc lại".
  - Hoặc kiến trúc sư sửa đặc tả, cho phép `.card-title` xuống dòng do đổi phông tiêu đề.

### Ghi chú N-1 (đặc tả, không tính là lỗi của người làm) — thẻ Cài đặt cao thêm 24 px
- Ở trang Cài đặt, thẻ đầu tiên cao thêm 24 px (1280: 924 → 948; 390: 1446 → 1470), và hai thẻ bên dưới tụt theo. Lệch như nhau dù phông bị chặn hay tải được.
- Nguyên nhân: dòng gợi ý "Không hiển thị trên trang học sinh (chỉ dùng nội bộ)" dưới ô Tên giáo viên. Đặc tả yêu cầu dòng này (Phạm vi mục 6, Thiết kế mục 3).
- TC-5.8 ghi "Không có miễn trừ nào khác", nên trái với yêu cầu thêm gợi ý. Đề nghị kiến trúc sư thêm miễn trừ cho thẻ có ô `TEN_GIAO_VIEN`.
- Không tính là lý do CHƯA ĐẠT.

## Kết luận
**CHƯA ĐẠT.**
- **Đạt:** TC-5.1–5.7, 5.9–5.14 (bắt buộc) và TC-5.15 (khuyến nghị) đều đạt, ở cả máy chủ mới và 1.0.0, sáng và tối.
- **Chưa đạt:** TC-5.8, do K-1 (Nhẹ). Sửa xong K-1 (và kiến trúc sư thêm miễn trừ cho N-1) thì người kiểm thử chạy lại toàn bộ `tests/pha5-kiem-thu.*`.
