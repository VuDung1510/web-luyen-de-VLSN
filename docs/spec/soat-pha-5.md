# Soát đặc tả Pha 5 (agent soát độc lập)

> Người soát: agent "Soát đặc tả (Pha 5)". Tôi không viết đặc tả này. Ngày 19/11/2026.
> Đã đọc: `CLAUDE.md`; Google Doc "Quyết định đã chốt" trên Drive (mục 6, 9, 10); `docs/QUYET-DINH.md` mục 6; `docs/spec/00-quy-trinh.md`; `docs/spec/soat-pha-0.md`; `docs/spec/pha-5-thiet-ke.md` (commit `a98eb10`, diff `origin/main...HEAD`).
> Đã đối chiếu với code trên `main` (`bb59e71`): `index.html`, `admin.html`, `assets/css/style.css`, `assets/js/*.js`, `tests/dev-server.js`, `tests/fixtures/Code-1.0.0.gs`.
> File này không sửa đặc tả.

## Kết luận: **ĐẠT** (cần sửa 5 điểm Vừa trước khi giao người làm)

Đặc tả đúng các quyết định chính:
- **Giữ bố cục.** Không làm phương án B, bảng đen hay nút chế độ tối. Giữ mọi `id` và DOM.
- **Màu chủ đạo `#1D6B3E`.** `--good` đổi sang màu khác để không lẫn với màu chủ đạo.
- **Logo.** Thay chữ "Φ" và favicon bằng một file ảnh trong `assets/img/`.
- **Thương hiệu.** Chỉ hiện thương hiệu trung tâm. Bỏ tên giáo viên khỏi chân trang. Chân trang khớp từng ký tự với quyết định.
- **Máy chủ.** Không đổi `Code.gs`, không thêm action. Chạy được với máy chủ 1.0.0.

Phần hiện trạng mô tả đúng code thật. Các tiêu chí nghiệm thu đo được.

Không có lỗi Nặng. Các điểm Vừa nằm ở 3 chỗ:
- **Cách mô tả logo tạm.** Đặc tả chưa nói rõ logo tạm là logo mê cung chữ Q, và chưa đánh dấu nó là TẠM. Giáo viên cũng chưa thay được logo chỉ bằng cách thả một file vào.
- **Phông tiêu đề.** Montserrat được áp cho `.brand`, mâu thuẫn với TC-5.8.
- **Câu chữ về in hoa tiêu đề.** Đặc tả ghi mặc định "không trái quyết định", trong khi thực tế là có lệch.

## Kiểm tra độc lập

**Tương phản và ΔE.** Tôi tự tính lại bằng script Node theo công thức WCAG 2.1 (độ sáng tương đối sRGB) và ΔE76 (Lab, D65). Kết quả **khớp mọi số** trong hai bảng "Số liệu đã tính sẵn":
- 6,51; 8,55; 6,02; 5,80; 5,59
- 5,60 / 5,16 / 4,99
- 7,36 / 8,14 / 6,47; 8,37 / 10,59; 5,69; 9,69; 12,56
- ΔE: 27,0 (cũ 15,4); 55,3; 91,6; 87,3

Các cặp đặc tả chưa liệt kê cũng đạt:
- Chữ trắng trên `--bad #c2410c`: 5,18
- `#0b1020` trên `--bad` tối `#fb923c`: 8,37
- `--good` tối `#a3e635` trên `--surface #171e2e`: 11,04
- `--good #4a7311` trên `--bg`: 5,18
- ΔE ở chế độ tối giữa `--primary` và `--bad` / `--accent`: 84,7 / 85,2. Trong khối tối, `--accent` không được định nghĩa lại nên vẫn là `#f59e0b`.

Chỉ một cặp không đạt: viền focus `--primary-soft #e3f1e8` trên nền trắng chỉ đạt 1,17. Đặc tả đã xử lý bằng `border-color: var(--primary)`, đạt 6,51.

**Grep màu cũ và logo cũ.** Mọi chỗ đều đã có trong mục 5 và TC-5.1, không sót chỗ nào:
- `style.css` dòng 8, 10, 12, 13, 26, 33: `--primary`, `--primary-soft`, `--good`, `--good-soft` ở chế độ sáng và hai khối tối.
- `style.css` dòng 148, 150, 158, 159, 222: 5 dòng `color:#fff`.
- `index.html`: favicon `%231d4ed8` và chữ `Φ`.
- `admin.html`: favicon `%23f59e0b`, chữ `Φ` và `style="background:var(--accent)"`.
- `app.js:42`: dòng chân trang có tên giáo viên.

Không có file test nào tham chiếu `footer`, `Φ`, `brand-logo` hay mã màu cũ. Chỗ duy nhất hiện tên giáo viên trên web là `app.js:42`. Hai biểu đồ (`app.js:575`, `admin.js:546–552`) và vòng điểm (`common.js:568`) đều đọc biến CSS.

**Máy chủ 1.0.0.** `tests/dev-server.js` có `SERVER_COMPAT=1.0.0`. Bản 1.0.0 vẫn trả `teacherName` và cho sửa `TEN_GIAO_VIEN` qua `EDITABLE_SETTINGS`, nên TC-5.7 chạy được trên cả hai bản. TC-5.14 kiểm `apps-script/` không đổi.

## Bảng phát hiện

| Mã | Mức | Chỗ trong đặc tả | Vấn đề | Đề xuất sửa |
|---|---|---|---|---|
| S-1 | **Vừa** | §2 Logo, "Nguồn"; Tóm tắt; Rủi ro | **Logo tạm chưa được gọi đúng tên và chưa đánh dấu là TẠM.** Quyết định 18/11 gạch logo mê cung chữ Q và ghi logo vatly.ai "thay logo mê cung chữ Q". Ảnh logo trong file Word mẫu `MAU_CHUAN_WORD_VLSN.docx` (khung đầu đề, watermark) **chính là logo mê cung chữ Q** kèm chữ "VẬT LÝ SIÊU NHẨM": PNG 339×339, nền trong suốt. Drive mục 9 và Nhật ký 19/11 đã ghi: "Pha 5 tạm dùng logo mê cung, thay sau bằng một file". Đặc tả chỉ viết "ảnh logo trích từ file Word mẫu", không nói đó là logo mê cung đã bị gạch. Tóm tắt cho giáo viên ghi "đổi thành logo Vật Lý Siêu Nhẩm" như thể đã là logo chuẩn. Người làm và giáo viên dễ hiểu nhầm logo tạm là logo đã chốt. | 1) Sửa "Nguồn" thành: **logo tạm = logo mê cung chữ Q trích từ file Word mẫu** (PNG 339×339 nền trong suốt, trong `word/media/`). Ghi rõ **đây là logo TẠM, không phải logo chuẩn**, chờ giáo viên gửi logo vatly.ai hoặc xác nhận. Logo trong skill `mo-phong-bai-toan` (480×480, nền trắng) cũng là logo mê cung, chỉ dùng dự phòng khi không có file Word. 2) Thêm một dòng chú thích HTML ngay trên `<img class="brand-logo">` ở cả hai trang, ví dụ `<!-- Logo TẠM (mê cung chữ Q từ file Word mẫu). Logo chuẩn: thay file assets/img/logo-vlsn.png -->`. 3) Tóm tắt cho giáo viên ghi "logo tạm (logo mê cung trong file Word mẫu) cho đến khi thầy gửi logo vatly.ai". 4) Báo cáo Pha 5 và chú thích ảnh chụp ghi "logo tạm". 5) Không câu nào trong đặc tả, báo cáo hay code được gọi logo mê cung là logo chuẩn. |
| S-2 | **Vừa** | §2 Logo, "File trong repo", "Hiển thị"; TC-5.4, TC-5.5, TC-5.8 | **Chưa thay logo bằng đúng một file được.** Theo Drive, web "chỉ trỏ tới một file `assets/img/logo-vlsn.png` để thay sau". Đặc tả lại bắt file logo đã qua xử lý: cắt bỏ chữ, đúng 96×96, ≤ 20 KB, 4 góc trong suốt. Đặc tả cũng thêm `favicon-32.png` (32×32, ≤ 4 KB) làm file thứ hai, và tách riêng nhánh "logo ngang" (cao 68 px, rộng tối đa 160 px, miễn lệch ở TC-5.8). Khi giáo viên gửi logo vatly.ai (kích thước và tỉ lệ chưa biết), người sau phải xử lý ảnh lại, và có thể phải sửa CSS hoặc TC. | 1) Code chỉ trỏ tới **`assets/img/logo-vlsn.png`**. Favicon cũng trỏ tới file này (`<link rel="icon" type="image/png" href="assets/img/logo-vlsn.png">`; trình duyệt tự thu nhỏ). Nếu vẫn muốn có `favicon-32.png` thì ghi đó là bản **tùy chọn sinh từ logo**, và không có nó trang vẫn đúng. 2) CSS `.brand-logo` phải chạy được với **mọi tỉ lệ ảnh** mà không sửa code: `height: 34px; width: auto; max-width: 34px` (hoặc khung 34×34 với `object-fit: contain`). Bỏ thuộc tính `width/height` cố định hoặc chỉ giữ `height="34"`. 3) TC-5.4 áp giới hạn kích thước và 4 góc trong suốt **cho file tạm**. Với file giáo viên thay sau, chỉ cần PNG/SVG tải được, ≤ 200 KB. 4) Ghi trong mục "Việc giáo viên cần làm": "Đổi logo = thay đúng file `assets/img/logo-vlsn.png` (giữ tên), không sửa code". |
| S-3 | **Vừa** | §2 "Phông chữ" (áp `--font-head` cho `.brand`); TC-5.8 | **Thiết kế mâu thuẫn với tiêu chí bố cục.** Đặc tả áp Montserrat 800 cho `.brand`. Hiện `.brand` dùng Be Vietnam Pro 700, mà Montserrat 800 rộng hơn rõ. Chữ "Luyện đề Vật lý" ở 1,05rem sẽ rộng thêm khoảng 10–20 px, nên `#nav` ở khổ 1280 lệch ngang hơn 4 px. TC-5.8 chỉ miễn lệch cho trường hợp logo ngang, nên tiêu chí này sẽ trượt dù code đúng đặc tả. Ở khổ 390, `.topbar-in` xuống dòng: `.brand` rộng hơn có thể đẩy `#userBox` xuống hàng mới, làm đầu trang cao thêm. | Chọn một trong hai cách: (a) **không** áp `--font-head` cho `.brand` (giữ phông và độ đậm hiện tại; khuyến nghị, vì quyết định ưu tiên "giữ nguyên giao diện"); hoặc (b) giữ thiết kế nhưng TC-5.8 cho `.brand` (width) và `#nav` (x) lệch đúng bằng chênh độ rộng chữ thương hiệu đo được, và thêm yêu cầu ở khổ 390: `#userBox` cùng hàng với `.brand` như trên `main`. |
| S-4 | **Vừa** | §4 Phông chữ; "Câu hỏi cho giáo viên" câu 1 ("mặc định không trái `QUYET-DINH.md`") | **Mặc định có lệch quyết định, nhưng đặc tả lại ghi là không lệch.** Mục 6 ghi "Giữ: phông Montserrat, tiêu đề in hoa đậm 800". Đặc tả mặc định không in hoa tiêu đề, và chữ nội dung vẫn dùng Be Vietnam Pro. Lệch này có căn cứ: dòng "Đổi màu và logo" được ưu tiên và ghi "giữ nguyên giao diện web hiện tại"; Nhật ký Drive 19/11 cũng ghi "Tiêu đề có in hoa toàn bộ không" là chưa chốt. Nhưng câu "mặc định không trái `QUYET-DINH.md`" là sai, trái với luật ở 00 §8 (đề xuất trái quyết định thì giữ quyết định). | Sửa câu chữ: "Mặc định lệch dòng 'tiêu đề in hoa' vì dòng 'Đổi màu và logo' được ưu tiên (giữ nguyên giao diện); đã ghi chưa chốt ở Nhật ký Drive 19/11." Có thể làm thêm một phương án trung gian ít rủi ro: in hoa (`text-transform: uppercase`) chỉ các tiêu đề tĩnh, ngắn (`.part-title`, chân trang). Tên đề và tên học sinh trong `h1` giữ chữ thường. |
| S-5 | **Vừa** | "Việc giáo viên cần làm"; Rủi ro | **Xác nhận logo dời sang Pha 6, trong khi Pha 5 lên trang thật ngay.** 00-quy-trinh dòng 10 ghi Pha 5 "xong pha nào học sinh thấy ngay pha đó". Như vậy học sinh sẽ thấy logo mê cung (logo quyết định đã gạch) suốt từ Pha 5 tới Pha 6. Drive cho phép dùng logo tạm, nên đây không phải lỗi Nặng. Nhưng giáo viên cần được hỏi ngay ở báo cáo Pha 5. | Câu hỏi 3 đưa vào báo cáo Pha 5, kèm ảnh chụp logo tạm. Ghi rõ: nếu giáo viên trả lời "không dùng logo mê cung" trước khi gộp vào trang thật, thì tạm giữ chữ "Φ" trên nền `--primary` (chỉ đổi màu), cho tới khi có file logo. Mục danh sách Pha 6 giữ như hiện tại để không quên. |
| S-6 | Nhẹ | Ngoài đặc tả: `docs/QUYET-DINH.md` | **Bản sao quyết định trong repo cũ hơn bản trên Drive.** Drive mục 9 đã có dòng "Logo VLSN chuẩn từ vatly.ai: chưa có file… Pha 5 tạm dùng logo mê cung, thay sau bằng một file" và Nhật ký 19/11 (3 điểm chưa chốt của Pha 5). Bản sao trong repo chưa có các dòng này. | Theo CLAUDE.md quy tắc 2: chép lại các dòng đó vào `docs/QUYET-DINH.md` trên nhánh đặc tả. Trích dẫn trong đặc tả (S-1, S-4) dẫn tới đúng mục 9 và Nhật ký 19/11. |
| S-7 | Nhẹ | §3; TC-5.7 | **Tên trang (`TEN_UNG_DUNG`) cũng là chữ trong phần nhận diện.** Ô `#appName` ở đầu trang và `document.title` lấy từ giá trị giáo viên tự đặt. Nếu giá trị đó có tên giáo viên (ví dụ "Luyện đề thầy …"), thì "chỉ thương hiệu trung tâm" vẫn bị phạm, mà TC-5.7 chỉ kiểm `TEN_GIAO_VIEN`. | Không cần sửa code. Ghi vào báo cáo hoặc câu hỏi: "Tên trang web (Cài đặt → Tên trang web) nên là tên trung tâm, không có tên giáo viên." Người làm kiểm giá trị mặc định (`Luyện đề Vật lý`) không có tên người. |
| S-8 | Nhẹ | §3 cuối; §5 bảng file | **Ô "Tên giáo viên" trong Cài đặt không còn tác dụng trên web,** nên giáo viên có thể sửa ô này rồi thắc mắc vì không thấy gì thay đổi. | Thêm `hint` cho `TEN_GIAO_VIEN` trong `SETTING_UI` (`assets/js/admin.js`, không đổi Code.gs): "Không hiển thị trên trang học sinh (chỉ dùng nội bộ)". Thêm `admin.js` vào bảng file ở mục 5. |
| S-9 | Nhẹ | §1 "Số liệu đã tính sẵn"; TC-5.2 | **Bảng tương phản thiếu cặp chữ `--on-status` trên nền `--bad`,** dù đặc tả có thêm biến này cho cả nút "sai". | Thêm vào bảng và vào TC-5.2: chữ trắng trên `#c2410c` = 5,18; `#0b1020` trên `#fb923c` = 8,37 (tôi đã tính lại). Thêm `--good` trên `--surface` ở chế độ tối (`#a3e635`/`#171e2e` = 11,04), vì `.review-tag.ok` và `.ok-h` dùng cặp này. |
| S-10 | Nhẹ | TC-5.7, TC-5.10 | **Chưa ghi rõ cách đo ở hai TC.** (a) TC-5.7 ghi "đặt `TEN_GIAO_VIEN` trong dev-server" nhưng không nói đặt bằng cách nào. (b) TC-5.10 so `borderColor` với "giá trị tính": `App.cssVar` trả nguyên chuỗi đã viết trong CSS (giữ hoa/thường, có thể có khoảng trắng). | (a) Ghi: đặt qua action `adminSaveSettings` (có cả ở bản 1.0.0) trước khi tải trang. (b) Ghi: so sau khi `trim()` và đổi về chữ thường. |
| S-11 | Nhẹ | Ngoài đặc tả: `docs/spec/cau-hoi-mo.md` câu 8 | Lựa chọn (b) vẫn ghi "làm theo nhận diện bảng đen và phương án B như đặc tả Pha 5". Điều này đã sai sau khi viết lại đặc tả. | Sửa (b) thành "làm theo đặc tả Pha 5 (giữ bố cục, màu #1D6B3E, logo VLSN)", hoặc đánh dấu câu 8 là đã chốt. |
| S-12 | Nhẹ | §2 Hiển thị | **Hai trang dùng cùng logo và favicon,** nên không còn ô cam để phân biệt trang quản trị. Khi giáo viên mở cả hai tab, khó nhận ra tab nào là tab quản trị. | Chấp nhận được (chữ "Quản trị" vẫn còn). Có thể đổi `<title>` trang quản trị thành "Quản trị · …" cho dễ nhận. Ghi vào câu hỏi cho giáo viên nếu muốn. |

## Rủi ro bổ sung (đặc tả chưa nêu)
- **Phông ở phiên kiểm thử.** Google Fonts bị chặn trong môi trường thử thì Montserrat không tải được, nên số đo TC-5.8 "sau" không phản ánh trang thật. Ghi rõ trong báo cáo kiểm thử phông nào đã thực sự tải. Nếu có thể, đo cả khi có phông qua `LIBS_DIR` hoặc file phông cục bộ chỉ dùng khi thử.
- **Logo mê cung có chữ nhỏ.** Ở ô 30×30 (34 trừ đệm), chữ bị cắt hoặc không đọc được. Đặc tả đã yêu cầu cắt bỏ phần chữ. Nếu áp S-2 (dùng nguyên file), phải kiểm ảnh chụp để chắc biểu tượng vẫn rõ.

## Tóm tắt điểm cần sửa trước khi giao
S-1, S-2, S-3, S-4, S-5 (Vừa). Các điểm Nhẹ (S-6 … S-12) sửa cùng lúc nếu tiện.
