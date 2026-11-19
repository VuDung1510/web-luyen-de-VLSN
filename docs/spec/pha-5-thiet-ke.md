# Pha 5 — Thiết kế VLSN: đổi màu xanh #1D6B3E và logo VLSN, giữ bố cục

## Tóm tắt cho giáo viên
- Trang web giữ nguyên cách sắp xếp như bây giờ. Học sinh không phải làm quen lại.
- Màu xanh dương hiện nay đổi thành màu xanh lá đậm của Vật Lý Siêu Nhẩm. Màu "đúng" đổi sang xanh nõn chuối để không lẫn với màu chính.
- Chữ "Φ" ở góc trên trái đổi thành logo Vật Lý Siêu Nhẩm, cả trang học sinh lẫn trang quản trị, cả biểu tượng trên tab trình duyệt.
- Cuối trang có thêm dòng "HỆ THỐNG GIÁO DỤC VẬT LÝ SIÊU NHẨM", hotline và slogan. Tên giáo viên không còn hiện ở cuối trang.
- Thầy không phải dán lại Code.gs. Thầy cần gửi file logo gốc (hoặc xác nhận logo tạm) và trả lời 3 câu hỏi ở cuối file.

## Mục tiêu
Đổi màu chủ đạo sang **#1D6B3E** và đổi logo thành logo VLSN theo quyết định Cowork 18/11/2026 (`QUYET-DINH.md` mục 6, dòng "Đổi màu và logo"). **Giữ nguyên bố cục và giao diện hiện tại.** Chỉ đổi giao diện, không đổi chức năng. Chạy được với máy chủ 1.0.0.

## Hiện trạng (đọc từ code trên `main`, 19/11/2026)
- Màu chủ đạo: `--primary: #1d4ed8` (xanh dương) trong `assets/css/style.css`; chế độ tối `--primary: #6b93ff`, `--primary-soft: #1d2b52`. Hầu hết chỗ dùng màu đi qua biến CSS.
- Màu "đúng" `--good: #15803d` là **xanh lá**, gần như trùng tông với #1D6B3E (khoảng cách màu ΔE76 = 15,4). Vòng điểm trang kết quả dùng `--good` khi ≥ 8 điểm và `--primary` khi 5–8 điểm (`resultHtml` trong `common.js`); biểu đồ "% điểm theo câu" (`admin.js`) cũng tô `--good`/`--primary`/`--bad`. Không đổi `--good` thì hai mức này không phân biệt được.
- Logo hiện tại **không phải** logo mê cung chữ Q. Đó là chữ "Φ" trong ô vuông bo góc 34×34 (`<span class="brand-logo">Φ</span>`): nền `--primary` ở trang học sinh, nền `--accent` (cam) ở trang quản trị (`style` viết thẳng trong `admin.html`). Favicon là SVG nhúng chữ Φ: nền `#1d4ed8` (học sinh), `#f59e0b` (quản trị).
- Chế độ tối **đã có**, tự theo hệ điều hành (`prefers-color-scheme`); CSS cũng nhận `data-theme="light|dark"` trên `<html>` nhưng không có nút chuyển. Không có `<meta name="theme-color">`.
- Phông: **Be Vietnam Pro** (Google Fonts). Chưa có Montserrat.
- Chân trang: chỉ ở trang học sinh (`<footer id="footer">`), nội dung do `applyPub()` trong `app.js` ghi: `Giáo viên: <tên> · <tên ứng dụng>`. Trang quản trị không có chân trang. Chưa có slogan, chưa có hotline.
- Biểu đồ Chart.js lấy màu từ biến CSS lúc vẽ (`App.cssVar('--primary')`, `--good`, `--bad`, `--accent`), không có mã màu viết cứng.
- Màn hình làm bài (`runExam`) ẩn đầu trang và chân trang, chỉ còn thanh `.exam-bar`.

## Phạm vi
**Làm**
1. Đổi bộ biến màu chủ đạo (sáng và tối) theo bảng ánh xạ dưới. Đổi `--good`/`--good-soft` để màu "đúng" tách khỏi màu chủ đạo.
2. Thay chữ "Φ" bằng ảnh logo VLSN ở đầu trang học sinh và quản trị; thay favicon cả hai trang; thêm `theme-color`.
3. Thêm chân trang thương hiệu (dòng hệ thống, hotline, slogan) cho cả hai trang; bỏ tên giáo viên khỏi chân trang.
4. Thêm phông Montserrat cho tiêu đề (xem "Phông chữ").
5. Thay vài màu chữ trắng viết cứng trên nền "đúng/sai" bằng biến để đọc được ở chế độ tối.

**Không làm**
- Bố cục phương án B, phong cách bảng đen, khung gỗ, dải đầu trang tối. Không đổi vị trí, kích thước, thứ tự khối nào.
- Nút chuyển chế độ tối/sáng (chế độ tối vẫn theo hệ điều hành như hiện nay).
- Đổi nội dung chữ, nhận xét, luồng làm bài; thay KaTeX/Chart.js; giao diện in phiếu (`printCards` giữ nguyên trắng đen).
- Đổi `apps-script/Code.gs`.

**Hoãn sau**: lục giác vàng ở trang kết quả; nút chuyển chế độ tối; 12 đề xuất giao diện tham khảo (QUYET-DINH mục 9).

## Thiết kế kỹ thuật

### 1. Bảng ánh xạ màu (`assets/css/style.css`)
Giữ nguyên tên biến. Thêm 2 biến mới: `--primary-hover`, `--on-status`. Mã hex ghi chữ thường hay hoa đều được; test so không phân biệt hoa thường.

| Biến | Vai trò | Sáng: cũ → mới | Tối: cũ → mới |
|---|---|---|---|
| `--primary` | Nút chính, liên kết, mục đang chọn, đồng hồ, tiêu đề phần | `#1d4ed8` → **`#1D6B3E`** | `#6b93ff` → **`#5fbf87`** |
| `--primary-hover` (mới) | Nền nút chính khi rê chuột | — → **`#15573A`** | — → **`#7fd3a2`** |
| `--primary-ink` | Chữ trên nền `--primary` | `#ffffff` (giữ) | `#0b1020` (giữ) |
| `--primary-soft` | Nền nhấn nhạt: mục nav đang chọn, đồng hồ, ô mục tiêu, hàng "tôi" trong bảng, viền focus | `#e3ebff` → **`#e3f1e8`** | `#1d2b52` → **`#183826`** |
| `--good` | Đúng, đạt, lời giải | `#15803d` → **`#4a7311`** | `#4ade80` → **`#a3e635`** |
| `--good-soft` | Nền "đúng" | `#dcfce7` → **`#ecfccb`** | `#14321f` → **`#1a2e05`** |
| `--on-status` (mới) | Chữ trên nền `--good`/`--bad` đặc | — → `#ffffff` | — → `#0b1020` |
| `--bad`, `--bad-soft`, `--warn`, `--accent`, `--info-soft` | Sai, cảnh báo, đánh dấu, mục tiêu | giữ nguyên | giữ nguyên |
| `--bg`, `--surface`, `--surface-2`, `--text`, `--muted`, `--border` | Nền, chữ | giữ nguyên | giữ nguyên |

Đổi kèm theo:
- `.btn-primary:hover`: thay `filter: brightness(1.08)` bằng `background: var(--primary-hover); border-color: var(--primary-hover)` (nút đậm hơn khi rê chuột).
- Viền focus giữ như cũ: `outline: 2px solid var(--primary-soft); border-color: var(--primary)` (viền `--primary` trên nền trắng đạt 6,5:1, đủ ≥ 3:1).
- `color: #fff` trên nền `--good`/`--bad` (các dòng `.opt.right .key`, `.opt.wrong .key`, `.tf-btns button.right`, `.tf-btns button.wrong`, `.key-pick button.sel`) đổi thành `color: var(--on-status)`. Ở chế độ tối hiện nay chữ trắng trên `#4ade80` gần như không đọc được.
- Khối chế độ tối có **hai bản giống nhau** (`@media (prefers-color-scheme: dark) :root:not([data-theme="light"])` và `:root[data-theme="dark"]`): sửa cả hai, giữ hai bản giống hệt nhau.
- Không đổi: màu toast (`#182033`, `#9a3412`, `#166534`), bóng đổ `rgba(16, 24, 40, …)`, `rgba(245, 158, 11, .12)` (của `--accent`), `#fbbf24` trong `.goal-bar`, màu `@media print`.

Số liệu đã tính sẵn (công thức WCAG 2.1; ΔE76 trong không gian Lab, D65):

| Cặp | Tỉ lệ tương phản | Yêu cầu |
|---|---|---|
| Chữ trắng trên `#1D6B3E` (nút chính sáng) | 6,51 | ≥ 4,5 |
| Chữ trắng trên `#15573A` (nút rê chuột) | 8,55 | ≥ 4,5 |
| `#1D6B3E` trên nền trắng (liên kết, tiêu đề phần) | 6,51 | ≥ 4,5 |
| `#1D6B3E` trên `--bg #f4f6fb` | 6,02 | ≥ 4,5 |
| `#1D6B3E` trên `--surface-2 #eef2fa` (tab đang chọn) | 5,80 | ≥ 4,5 |
| `#1D6B3E` trên `--primary-soft #e3f1e8` (nav đang chọn, đồng hồ) | 5,59 | ≥ 4,5 |
| `--good #4a7311` trên trắng / trên `#ecfccb` / trên `#eef2fa` | 5,60 / 5,16 / 4,99 | ≥ 4,5 |
| Chữ trắng trên `#4a7311` | 5,60 | ≥ 4,5 |
| Tối: `#5fbf87` trên `--surface #171e2e` / `--bg #0f1420` / `--surface-2 #1f2840` | 7,36 / 8,14 / 6,47 | ≥ 4,5 |
| Tối: `#0b1020` trên `#5fbf87` (nút chính) / trên `#7fd3a2` (rê chuột) | 8,37 / 10,59 | ≥ 4,5 |
| Tối: `#5fbf87` trên `#183826` (nav đang chọn) | 5,69 | ≥ 4,5 |
| Tối: `#a3e635` trên `#1a2e05`; `#0b1020` trên `#a3e635` | 9,69; 12,56 | ≥ 4,5 |

| Cặp màu phải phân biệt được | ΔE76 | Yêu cầu |
|---|---|---|
| `--primary` với `--good` (sáng) `#1D6B3E` / `#4a7311` | 27,0 (cũ `#15803d`: 15,4) | ≥ 25 |
| `--primary` với `--good` (tối) `#5fbf87` / `#a3e635` | 55,3 | ≥ 25 |
| `--primary` với `--bad` (sáng) `#1D6B3E` / `#c2410c` | 91,6 | ≥ 25 |
| `--primary` với `--accent` `#1D6B3E` / `#f59e0b` | 87,3 | ≥ 25 |

Hai màu xanh `--primary` và `--good` gần nhau về độ sáng (tỉ lệ 1,16), nên người mù màu đỏ–lục có thể khó phân biệt. Trang xem lại bài đã có chữ đi kèm (`✓ Đúng`, `✗ Sai`, `◐ Đúng một phần`), nên không dựa riêng vào màu. Không thêm việc ở pha này.

### 2. Logo
**File trong repo**
- `assets/img/logo-vlsn.png` (hoặc `.svg` nếu nguồn là SVG): phần **biểu tượng** của logo, vuông, 96×96 px (đủ nét ở màn hình ×2 khi hiện 34×34), nền **trong suốt**, ≤ 20 KB. Nếu logo gốc có chữ "VẬT LÝ SIÊU NHẨM" bên dưới biểu tượng thì cắt bỏ phần chữ (ở 34 px chữ không đọc được); chữ vẫn có trong `alt` và chân trang.
- `assets/img/favicon-32.png`: cùng biểu tượng, 32×32, ≤ 4 KB.
- Nếu logo gốc là hình ngang không tách được biểu tượng (tỉ lệ rộng/cao > 1,3): `logo-vlsn.png` cao 68 px, rộng theo tỉ lệ, hiển thị cao 34 px, rộng tối đa 160 px; ghi vào báo cáo; TC-5.8 cho phép khối `.brand` và `#nav` lệch ngang tương ứng.

**Nguồn (theo thứ tự ưu tiên)**
1. File logo giáo viên gửi (bản "Logo Vật Lý Siêu Nhẩm" ở góc trên khung bài học trên vatly.ai). Mạng của phiên Claude bị chặn vatly.ai nên không tự tải được.
2. Nguồn tạm khi giáo viên chưa gửi: ảnh logo trích từ file Word mẫu chuẩn `MAU_CHUAN_WORD_VLSN.docx` (điều phối viên sẽ đưa file vào thư mục nháp của người làm; mở .docx bằng unzip, lấy ảnh trong `word/media/` ở header). Không đưa file .docx vào repo.
3. Đối chiếu: skill `mo-phong-bai-toan` có file `assets/logo-vat-ly-sieu-nham.png` (480×480, nền trắng, biểu tượng mê cung chữ Q + chữ "VẬT LÝ SIÊU NHẨM"). Chỉ dùng khi không có nguồn 1 và 2, và ghi rõ trong báo cáo.

Người làm ghi trong báo cáo: dùng nguồn nào, kích thước gốc, cách cắt/tách nền. Logo tạm phải được giáo viên xác nhận ở Pha 6 (xem "Việc giáo viên cần làm").

**Hiển thị**
- Đầu trang `index.html` và `admin.html`: thay `<span class="brand-logo" …>Φ</span>` bằng
  `<img class="brand-logo" src="assets/img/logo-vlsn.png" alt="Vật Lý Siêu Nhẩm" width="34" height="34">`. Trang quản trị bỏ `style="background:var(--accent)"`.
- `.brand-logo` (CSS): giữ ô 34×34 bo góc 10 px như hiện nay; `background: #fff; padding: 2px; object-fit: contain; display: block`. **Nền trắng ở cả hai chế độ** — logo VLSN có nét đen, đặt thẳng lên nền tối sẽ mất nét. Ô này cùng kích thước ô "Φ" cũ nên bố cục không đổi.
- Không thêm logo vào nơi khác (thẻ đăng nhập, thanh làm bài, trang kết quả) để giữ bố cục. Màn đăng nhập vẫn có đầu trang nên vẫn thấy logo.
- Favicon cả hai trang: `<link rel="icon" type="image/png" href="assets/img/favicon-32.png">` thay cho SVG nhúng.
- `theme-color` cả hai trang:
  `<meta name="theme-color" content="#1D6B3E" media="(prefers-color-scheme: light)">` và
  `<meta name="theme-color" content="#0f1420" media="(prefers-color-scheme: dark)">`.

### 3. Chân trang thương hiệu
Nội dung (đúng từng ký tự, theo QUYET-DINH mục 6):
```html
<footer class="footer" id="footer">
  <div class="footer-brand">HỆ THỐNG GIÁO DỤC VẬT LÝ SIÊU NHẨM</div>
  <div>Hotline: 0978 650726 - 0326 425 111</div>
  <div class="footer-slogan">VẬT LÝ SIÊU NHẨM - ĐỊNH HƯỚNG TRUYỀN CẢM HỨNG</div>
</footer>
```
- `index.html`: thay `<footer>` rỗng bằng khối trên (giữ `id="footer"` vì `route()`/`runExam()` ẩn/hiện theo id). `applyPub()` trong `app.js` **bỏ** dòng ghi `footer.textContent` (vẫn đặt `appName`, `document.title`, nút Xếp hạng).
- `admin.html`: thêm cùng khối ngay sau `</main>` (không cần ẩn ở đâu).
- CSS: `.footer` giữ căn giữa, cỡ chữ, khoảng đệm như cũ; `.footer-brand { font-family: var(--font-head); font-weight: 800; color: var(--primary); }`; `.footer-slogan { font-size: .78rem; letter-spacing: .02em; }`. Chân trang nằm cuối trang nên chỉ làm trang dài thêm, không đẩy khối nào khác.
- Màn làm bài vẫn ẩn chân trang như hiện nay.
- Không hiện tên giáo viên ở đầu trang hay chân trang. `TEN_GIAO_VIEN` giữ trong CaiDat, không xóa, không đổi Code.gs (ghi chú cột "hiển thị ở chân trang" trong `SCHEMA` cập nhật ở Pha 6 nếu giáo viên muốn).

### 4. Phông chữ
- QUYET-DINH mục 6 giữ "phông Montserrat, tiêu đề in hoa đậm 800". Web hiện dùng Be Vietnam Pro, chưa có Montserrat.
- **Mặc định của pha** (an toàn cho bố cục): thêm Montserrat **chỉ cho tiêu đề**; chữ thường giữ Be Vietnam Pro (đọc tiếng Việt dài dễ hơn và không làm xô bảng, nút).
  - Link Google Fonts gộp một dòng: `family=Be+Vietnam+Pro:wght@400;500;600;700;800&family=Montserrat:wght@700;800&display=swap`.
  - Biến mới `--font-head: "Montserrat", var(--font)`; áp cho `h1, h2, h3, .brand, .footer-brand` với `font-weight: 800`.
  - **Không** in hoa toàn bộ tiêu đề (tên đề, tên học sinh trong `h1` có thể rất dài). Chỉ chân trang vốn đã in hoa. Đây là câu hỏi số 1 cho giáo viên.
- Không tải được Google Fonts thì rơi về `system-ui` như hiện nay, không lỗi.

### 5. Chỗ cần đổi theo file
| File | Việc |
|---|---|
| `assets/css/style.css` | Biến màu `:root` + 2 khối tối; `--primary-hover`, `--on-status`, `--font-head`; `.btn-primary:hover`; `.brand-logo` (ảnh trên ô trắng); 5 dòng `color:#fff` → `var(--on-status)`; `h1,h2,h3,.brand` dùng `--font-head`; `.footer-brand`, `.footer-slogan` |
| `index.html` | favicon, 2 `theme-color`, link phông, `<img class="brand-logo">`, nội dung `<footer>` |
| `admin.html` | favicon, 2 `theme-color`, link phông, `<img class="brand-logo">` (bỏ style inline), thêm `<footer>` |
| `assets/js/app.js` | `applyPub()`: bỏ dòng ghi chân trang |
| `assets/img/logo-vlsn.png`, `assets/img/favicon-32.png` | File mới |
| `assets/js/common.js`, `admin.js` | Không cần đổi (biểu đồ và vòng điểm đọc biến CSS). Chỉ đổi nếu kiểm thử thấy còn màu viết cứng |
| `apps-script/Code.gs` | **Không đổi** |

Giữ mọi `id`, lớp chức năng và cấu trúc DOM hiện có để e2e cũ chạy nguyên.

## Tương thích máy chủ
Không đổi Code.gs, không gọi action mới. Chạy được với máy chủ 1.0.0 đang chạy thật. Mọi e2e chạy hai lần: máy chủ mới và `SERVER_COMPAT=1.0.0`.

## Tiêu chí nghiệm thu
Phạm vi quét tĩnh: `index.html`, `admin.html`, `assets/css/style.css`, `assets/js/*.js`.
- **TC-5.1 (màu cũ đã hết)** Tìm không phân biệt hoa thường các chuỗi `1d4ed8`, `6b93ff`, `e3ebff`, `1d2b52`, `15803d`, `4ade80`, `dcfce7`, `14321f`, `%23f59e0b` ⇒ **0 kết quả**. `:root` có `--primary: #1D6B3E`. Mọi mã hex/`rgba(` còn lại thuộc danh sách cho phép: các biến ở bảng ánh xạ, `#fff`/`#ffffff`, `#000`, `#555`, `#182033`, `#9a3412`, `#166534`, `#f59e0b`, `#fbbf24`, `rgba(16, 24, 40, …)`, `rgba(0,0,0,…)`, `rgba(245, 158, 11, .12)`, `rgba(10, 15, 30, .45)`, và các biến nền/chữ/viền/bad/warn/info giữ nguyên (lấy từ `main` làm danh sách). Kiểm bằng script grep.
- **TC-5.2 (tương phản)** Script đọc giá trị biến từ `style.css` (cả sáng và tối), tính tỉ lệ WCAG cho mọi cặp ở bảng "Số liệu đã tính sẵn" ⇒ mọi cặp ≥ 4,5:1; viền focus `--primary` trên `--surface` ≥ 3:1.
- **TC-5.3 (màu ngữ nghĩa tách khỏi màu chủ đạo)** Cùng script: ΔE76 giữa `--primary` và mỗi màu `--good`, `--bad`, `--accent` ≥ 25 ở cả hai chế độ. Hai khối chế độ tối trong CSS có cùng giá trị cho mọi biến.
- **TC-5.4 (file logo)** `assets/img/logo-vlsn.png` (hoặc `.svg`) tồn tại, ≤ 20 KB; PNG có kênh trong suốt và 4 điểm góc có alpha = 0; `favicon-32.png` đúng 32×32, ≤ 4 KB. Báo cáo ghi nguồn logo.
- **TC-5.5 (logo ở đúng 4 vị trí)** (a) đầu trang học sinh, (b) đầu trang quản trị: `img.brand-logo` có `alt="Vật Lý Siêu Nhẩm"`, `naturalWidth > 0` (ảnh tải được), hộp hiển thị 34×34 (±1 px; hoặc cao 34 nếu logo ngang), nền tính được `rgb(255, 255, 255)` ở **cả chế độ sáng và tối**; kiểm ở màn đăng nhập, trang chủ học sinh, tổng quan quản trị. (c), (d) `link[rel=icon]` của hai trang trỏ `assets/img/favicon-32.png` và tải được (HTTP 200). Không còn ký tự `Φ` trong `index.html`, `admin.html`.
- **TC-5.6 (meta)** Hai trang có 2 thẻ `meta[name=theme-color]` với `#1D6B3E` (sáng) và `#0f1420` (tối).
- **TC-5.7 (chân trang)** Ở trang chủ học sinh và tổng quan quản trị, `#footer` / `footer` chứa đúng 3 chuỗi `HỆ THỐNG GIÁO DỤC VẬT LÝ SIÊU NHẨM`, `Hotline: 0978 650726 - 0326 425 111`, `VẬT LÝ SIÊU NHẨM - ĐỊNH HƯỚNG TRUYỀN CẢM HỨNG` (so chuỗi). Đặt `TEN_GIAO_VIEN` = "Thầy Thử Nghiệm" trong dev-server ⇒ chuỗi này và chuỗi `Giáo viên:` không xuất hiện trong `#topbar` lẫn `#footer`. Ở màn làm bài, `#footer` bị ẩn.
- **TC-5.8 (không đổi bố cục)** Kiểm thử ghi vị trí/kích thước (`getBoundingClientRect`) của các khối chính trên `main` trước khi đổi (lưu `docs/bao-cao/anh/pha-5/bo-cuc-truoc.json`) và trên nhánh pha (`bo-cuc-sau.json`), cùng dữ liệu, cùng khổ 390×844 và 1280×800, chế độ sáng. Khối chính: `.topbar`, `.brand`, `.brand-logo`, `#nav`, `#userBox`, `main > *` cấp 1, `.card` đầu tiên, `.tabs`, `.stats`, `.exam-bar`, `.qnav`/nút danh sách câu, `.score-hero`, `.score-ring`, `.table-wrap` đầu tiên. Yêu cầu: `x`, `width` lệch ≤ 4 px; `y`, `height` lệch ≤ 4 px **cộng** tổng chênh chiều cao của các `h1/h2/h3` đứng trước khối đó (do đổi phông tiêu đề). Riêng `.footer` được phép cao hơn. Logo ngang (xem mục Logo) thì `.brand`, `#nav`, `#userBox` được miễn lệch ngang; ghi rõ.
- **TC-5.9 (ảnh chụp)** Bộ ảnh `docs/bao-cao/anh/pha-5/`, khổ 390×844 và 1280×800, chế độ sáng, cho 6 màn: đăng nhập, trang chủ học sinh, làm bài, kết quả, quản trị tổng quan, trình soạn đề (12 ảnh). Thêm 6 ảnh chế độ tối khổ 390×844 (`page.emulateMedia({ colorScheme: 'dark' })`). Kèm 2 ảnh "trước" (trang chủ học sinh, kết quả, 1280×800) để giáo viên so.
- **TC-5.10 (biểu đồ)** Trang Thống kê học sinh: `Chart.getChart('chTimeline').data.datasets[0].borderColor` = giá trị tính của `--primary` (sáng: `#1D6B3E`). Thống kê đề ở quản trị: `chBins` dùng `--primary`; `chQ` dùng ≥ 2 màu khác nhau trong `--good`/`--primary`/`--bad` khi dữ liệu có cả câu dễ và khó.
- **TC-5.11 (không lỗi JS)** Không có `pageerror` và không có `console.error` ở mọi màn của TC-5.9, ở cả máy chủ mới và `SERVER_COMPAT=1.0.0`. Bỏ qua lỗi tải tài nguyên ngoài khi CDN/Google Fonts bị chặn trong môi trường thử (ghi rõ).
- **TC-5.12 (không cuộn ngang)** Khổ 390 và 1280: `document.documentElement.scrollWidth <= innerWidth` ở cả 6 màn.
- **TC-5.13 (test cũ đạt)** Đạt ở cả hai chế độ máy chủ: `node tests/backend.test.js`, `node tests/importer.test.js`, `node tests/dev-server.js` + `node tests/e2e.js`; và các test đã có từ Pha 1–2 (`tests/*.test.js`, `tests/*.e2e.js`). Không sửa selector cũ; nếu buộc phải sửa thì ghi lý do.
- **TC-5.14 (máy chủ không đổi)** `git diff origin/main -- apps-script/` rỗng.
- **TC-5.15 (khuyến nghị)** Lighthouse Accessibility ≥ 90 cho đăng nhập và trang chủ học sinh.

## Kế hoạch kiểm thử
- `tests/pha5.test.js` (Node, không cần trình duyệt): TC-5.1, 5.2, 5.3, 5.4, 5.6, 5.14. Tự viết hàm độ sáng tương đối WCAG và ΔE76; đọc biến bằng regex từ `style.css`; đọc kích thước PNG từ phần đầu file (IHDR), kiểm alpha bằng `zlib` hoặc `pngjs` nếu có sẵn trong `LIBS_DIR` (không thêm vào repo).
- `tests/pha5.e2e.js` (Playwright như `tests/e2e.js`): TC-5.5, 5.7–5.12. Chạy:
  `node tests/dev-server.js` + `node tests/pha5.e2e.js`, rồi `SERVER_COMPAT=1.0.0 node tests/dev-server.js` + `SERVER_COMPAT=1.0.0 node tests/pha5.e2e.js`.
- Ảnh "trước" và `bo-cuc-truoc.json`: tạo worktree tạm từ `origin/main` (`git worktree add <thư mục nháp> origin/main`), chạy dev-server ở cổng khác (`PORT=8788`), chạy `pha5.e2e.js --truoc`. Xóa worktree tạm sau khi xong.
- Dữ liệu: dùng dữ liệu mẫu của dev-server; có ít nhất 1 bài đã nộp để có trang kết quả và biểu đồ.

## Rủi ro & cách giảm
| Rủi ro | Giảm |
|---|---|
| Logo tạm khác logo thật trên vatly.ai | Ghi nguồn trong báo cáo; giáo viên xác nhận ở Pha 6; đổi logo chỉ là thay 2 file ảnh |
| Logo nét đen mất trên nền tối | Ô logo luôn nền trắng (TC-5.5) |
| Màu "đúng" lẫn màu chủ đạo | Đổi `--good` sang xanh nõn chuối, kiểm ΔE ≥ 25 (TC-5.3); trang xem lại bài có chữ ✓/✗ |
| Đổi phông tiêu đề làm tiêu đề dài xuống dòng | Chỉ đổi phông tiêu đề, không in hoa; TC-5.8 đo và cho phép đúng phần chênh do tiêu đề |
| Google Fonts bị chặn | Phông dự phòng `system-ui` như hiện nay |
| Sửa một khối tối, quên khối kia | TC-5.3 so hai khối |
| Xung đột CSS với Pha 3/4 nếu chạy song song | Pha 5 chỉ sửa biến và vài dòng nêu ở mục 5; rebase lên `main` mới nhất trước khi soát |

## Câu hỏi cho giáo viên
Chưa trả lời thì làm theo mặc định; mặc định không trái `QUYET-DINH.md`.
1. **Tiêu đề in hoa?** QUYET-DINH ghi "tiêu đề in hoa đậm 800". Mặc định: tiêu đề dùng Montserrat đậm 800 nhưng **giữ chữ thường** (tên đề dài in hoa khó đọc, dễ xô bố cục); chữ nội dung giữ phông hiện tại. Thầy muốn in hoa toàn bộ tiêu đề, hoặc đổi cả chữ nội dung sang Montserrat không?
2. **Slogan ở đâu?** Mặc định: slogan nằm ở chân trang (không đổi đầu trang). Thầy có muốn slogan ở đầu trang không (đầu trang sẽ cao thêm một dòng)?
3. **Logo:** thầy gửi file logo gốc (ảnh ở góc trên khung bài học trên vatly.ai, PNG nền trong suốt hoặc SVG) hoặc xác nhận logo tạm trong ảnh chụp là đúng. Logo vatly.ai có phải biểu tượng mê cung chữ Q không?

## Việc giáo viên cần làm
- Không dán lại Code.gs ở pha này.
- Duyệt ảnh chụp (sáng, tối, điện thoại, máy tính).
- Gửi file logo gốc hoặc xác nhận logo tạm (câu hỏi 3). **Ghi vào danh sách Pha 6:** "Xác nhận logo VLSN trên web đúng logo vatly.ai; nếu khác, gửi file để thay `assets/img/logo-vlsn.png` và `favicon-32.png`."
- Trả lời câu hỏi 1 và 2 (không bắt buộc, có mặc định).

## Ước lượng: **S–M**
Phần CSS và HTML nhỏ (S). Phần kiểm thử bố cục trước/sau và ảnh chụp hai chế độ là phần lớn (M).

Viết lại đặc tả ngày 19/11/2026 theo quyết định Cowork 18/11/2026 (giữ bố cục, màu #1D6B3E, logo VLSN).
