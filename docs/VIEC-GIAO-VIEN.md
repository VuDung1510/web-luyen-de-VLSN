# Việc giáo viên cần làm — phát hành (Pha 6)

Gom từ báo cáo Pha 1 → Pha 5. Làm lần lượt từng nhóm. Xong bước nào thì đánh dấu ☐ → ☑ (hoặc ghi ✓ bên cạnh).
Máy chủ mới: **Code.gs 1.5.0** (gồm toàn bộ thay đổi máy chủ của Pha 1, 2, 4 và 6). Dán **một lần**, lấy file `apps-script/Code.gs` trên nhánh `main` **sau khi Pha 6 đã gộp**.

---

## A. Dán Code.gs và triển khai (thầy tự làm, khoảng 15 phút)

### A1. Sao lưu
- ☐ Mở Google Sheet "web luyện đề", chọn **Tệp → Tạo bản sao** (đặt tên có ngày, ví dụ "web luyện đề — sao lưu 20-11").
- ☐ Ghi lại số phiên bản đang chạy: **Tiện ích mở rộng → Apps Script → Triển khai → Quản lý các bản triển khai**, xem dòng "Phiên bản" (để quay về nếu cần).

### A2. Dán code mới
- ☐ Trong Google Sheet gốc (không phải bản sao), chọn **Tiện ích mở rộng → Apps Script**.
- ☐ Mở file `Code.gs`, bấm Ctrl+A rồi xóa hết nội dung cũ.
- ☐ Mở `apps-script/Code.gs` trên GitHub, bấm nút **Copy raw file**, dán vào Apps Script.
- ☐ Bấm 💾 **Lưu**. Kiểm tra dòng đầu có `var APP_VERSION = '1.5.0';`.

### A3. Chạy `setup` và cấp quyền
- ☐ Trên thanh công cụ, chọn hàm **`setup`**, bấm ▶ **Chạy**.
- ☐ Google hỏi quyền mới (đọc Google Sheets khác và Google Drive, để đọc kho và chép hình): bấm **Xem xét quyền** → chọn tài khoản.
- ☐ Gặp cảnh báo "Google chưa xác minh ứng dụng này": bấm **Nâng cao** → **Đi tới … (không an toàn)** → **Cho phép**. Cảnh báo này có vì script do chính thầy tạo.
- ☐ Nhật ký hiện "✅ Cài đặt xong!". Quay lại Google Sheet: có thêm trang tính `LuyenTap`, `KetQuaLuyenTap`.
- ☐ Kiểm nhanh: dữ liệu cũ (HocSinh, DeThi, CauHoi, KetQua) còn nguyên; chỉ có thêm cột ở **cuối** (KetQua thêm "Mục tiêu", CauHoi thêm 5 cột từ "Mã câu kho") và thêm dòng ở cuối CaiDat.

### A4. Điền trang tính CaiDat (hoặc điền sau ở trang quản trị → Cài đặt)
- ☐ `KHO_CAU_HOI_ID`: mở file "KHO CÂU HỎI VẬT LÝ" **mà thầy mở được trong Drive của mình**, chép địa chỉ trên thanh trình duyệt, dán vào cột Giá trị.
- ☐ `THU_MUC_HINH_KHO_ID` (nên điền): mở thư mục "02. HÌNH VẼ" của kho, chép địa chỉ, dán vào. Để trống thì web tìm hình trên toàn Drive (chậm hơn).
- ☐ `CHO_LUYEN_TAP`: tạm để **KHONG**. Bật sau ở nhóm C, khi đã đưa câu vào luyện tập.
- ☐ (Tùy chọn) Ô Ghi chú của dòng `TEN_GIAO_VIEN` còn chữ cũ "hiển thị ở chân trang": sửa tay thành "chỉ dùng nội bộ" nếu muốn. `setup` không sửa ô cũ.

### A5. Triển khai phiên bản mới
- ☐ **Triển khai → Quản lý các bản triển khai** → bấm ✏ **Chỉnh sửa** ở bản đang dùng.
- ☐ Ô **Phiên bản**: chọn **Phiên bản mới** → bấm **Triển khai**. URL giữ nguyên, **không** sửa `config.js`, **không** tạo bản triển khai thứ hai.

### A6. Kiểm tra sau triển khai
- ☐ Trong Apps Script, chọn hàm **`kiemTraSauTrienKhai`**, bấm ▶ **Chạy** (hàm này chỉ đọc, không sửa dữ liệu).
- ☐ Xem **Nhật ký thực thi**: mọi dòng ✅ là ổn; dòng ⚠️ là lưu ý; dòng ❌ là lỗi cần sửa (dòng đó ghi cách sửa).
- ☐ Chụp màn hình nhật ký, gửi cho Claude.
- ☐ Mở trang quản trị, đăng nhập, vào **Cài đặt**, kéo xuống khung **Dữ liệu** (cuối trang): dòng "Phiên bản máy chủ" phải là **1.5.0** (xem ảnh `docs/bao-cao/anh/pha-6/01-cai-dat-phien-ban-1280.png`). Nếu vẫn số cũ: làm lại A5 (quên chọn "Phiên bản mới").
- ☐ Trên máy đã từng mở web, bấm tải lại trang (F5) một lần để nút Đổi PIN và ô Mục tiêu điểm hiện ra.
- ☐ Thử nhanh: đăng nhập 1 học sinh mẫu; tab **Ngân hàng** → Ma trận 1 chạm lớp 12 → Tạo đề → xem hình có hiện → Lưu (để Bản nháp) → xóa đề thử.

### A7. Nếu hỏng: quay về phiên bản trước
- ☐ **Triển khai → Quản lý các bản triển khai → ✏ Chỉnh sửa → Phiên bản:** chọn số phiên bản đã ghi ở A1 → **Triển khai**. Học sinh dùng lại máy chủ cũ ngay; giao diện web tự ẩn các nút cần máy chủ mới.
- ☐ Dữ liệu mất hoặc sai (rất hiếm): mở bản sao ở A1 để đối chiếu. Báo Claude trước khi sửa tay.

---

## B. Kiểm tra trên trang thật cùng Claude (Pha 6b, một buổi)

Claude không mở được trang thật từ môi trường làm việc (mạng chặn), nên cần thầy mở và đọc số giúp.

### B1. Tốc độ (TC-6.7, bắt buộc)
- ☐ Trang học sinh, trên điện thoại và máy tính: đo thời gian chuyển tab (Trang chủ ↔ Lịch sử ↔ Thống kê ↔ Xếp hạng), số request, thời gian `bootstrap` lần 1 và lần 2.
- ☐ So với số gốc của máy chủ 1.0.0 (TC-1.15a). Nếu chưa đo số gốc trước khi dán code thì ghi rõ "không có số gốc".

### B2. Một lượt thật (TC-6.8, bắt buộc)
- ☐ Một học sinh thật làm một đề và nộp: KetQua có hàng mới, đúng cột, có cột "Mục tiêu".
- ☐ Một học sinh làm một bài luyện tập và nộp (sau khi bật luyện tập ở nhóm C): KetQuaLuyenTap có hàng mới; bảng xếp hạng không đổi.

### B3. Tải file Word thật (Pha 3)
- ☐ Trang quản trị → Đề thi → Tạo đề → Nhập nhanh → **Tải file lên** một file đề Word thật: thư viện tải được từ CDN, số câu đúng, công thức hiện đúng.
- ☐ Bấm Thêm vào đề → Lưu: hình trong file được tải lên Drive và hiện ở trang học sinh.

### B4. Ngân hàng câu hỏi (Pha 2)
- ☐ Lần đầu mở tab **Ngân hàng**: ghi thời gian đọc chỉ mục kho 10 239 hàng (đọc lại sau 10 phút hoặc khi bấm Đọc lại kho).
- ☐ Tạo đề từ kho có câu có hình: hình được **chép** sang thư mục web (file gốc giữ nguyên quyền), hiện ở trang học sinh.
- ☐ (R-9) Sau khi đã lưu nhiều đề từ kho: báo Claude số hàng của trang `CauHoi`; nếu `startExam`/nộp bài chậm rõ thì Claude xem lại đệm.
- ☐ (R-10) Khi `CauHoi` gần 1 000 hàng: thử lưu thêm một đề; đáp án như `3,0` phải giữ nguyên dạng chữ. `kiemTraSauTrienKhai` có lưu ý khi CauHoi sắp hết hàng.

### B5. Sửa trực tiếp trên Sheet (`onEdit`, Pha 1)
- ☐ Sửa một ô Tên đề trong trang tính DeThi, rồi tải lại trang web ngay: thấy tên mới (nếu phải chờ tới 1 phút thì `onEdit` không chạy — vẫn dùng được, chỉ chậm).

### B6. Xem trên điện thoại thật (Pha 5)
- ☐ (R-3) Mở một đề có **tên dài** ở khổ điện thoại: tiêu đề Montserrat xuống dòng có gọn không.
- ☐ (R-7) Các tiêu đề trang có nút bên phải (Ngân hàng, Đề thi…) ở khổ điện thoại: nút không rơi xuống dòng, chữ không quá nhỏ.
- ☐ Logo, màu xanh, chân trang hiện đúng ở chế độ sáng và tối.

### B7. Trang Luyện tập (Pha 4)
- ☐ Với một học sinh đã làm nhiều bài luyện: đo thời gian mở trang 🎯 Luyện tập và thời gian nộp bài luyện.

---

## C. Việc nội dung (thầy làm khi tiện)

- ☐ **Logo:** gửi file logo VLSN chuẩn (ảnh góc trên khung bài học trên vatly.ai, PNG nền trong suốt hoặc SVG), hoặc xác nhận dùng tiếp logo tạm (mê cung chữ Q). Đổi logo = thay đúng file `assets/img/logo-vlsn.png`, giữ tên file.
- ☐ **Trả lời 4 câu hỏi của Pha 5** (`docs/bao-cao/pha-5.md`, mục "Câu hỏi cho giáo viên"; chưa trả lời thì web giữ mặc định):
  - ☐ Câu 1: tiêu đề có in hoa toàn bộ không (mặc định: không).
  - ☐ Câu 2: slogan ở đầu trang hay chân trang (mặc định: chân trang).
  - ☐ Câu 3: logo (như dòng trên).
  - ☐ Câu 4: kiểm ô Cài đặt → **Tên trang web** trên trang thật là tên trung tâm, không có tên giáo viên.
- ☐ **Sửa 31 câu kho lỗi định dạng** theo Google Doc "Danh sách câu kho bị lỗi định dạng (18-11-2026)" (thư mục "WEB LUYỆN ĐỀ – TÀI LIỆU CHUNG"): 27 đáp án Phần III có đơn vị/chữ → chỉ ghi số; 2 câu Phần I thiếu phương án; 2 câu Phần II thiếu nội dung.
- ☐ Bổ sung đáp án cho các câu khác trong kho khi có thời gian (hiện khoảng 1 000/10 239 câu dùng được).
- ☐ Sửa kho xong: trang quản trị → **Ngân hàng** → bấm **↻ Đọc lại kho**.
- ☐ **Đưa câu vào luyện tập:** tab Ngân hàng → lọc, cho câu vào giỏ → **Đưa vào luyện tập**; xem lại ở tab **Pool luyện tập**. Không xóa hàng trong `LuyenTap`; muốn bỏ câu thì bấm **Tắt**.
- ☐ **Bật luyện tập:** Cài đặt → "Mục Luyện tập cho học sinh" = **Bật** → Lưu cài đặt. (Tùy chọn) đổi "Đề nhanh theo bài", mặc định 7,1,2,10.

---

## D. Sau ít nhất 1 tháng chạy máy chủ mới

- ☐ Xác nhận với Claude: máy chủ 1.5.0 chạy ổn từ ngày …, cho phép **dọn mã dự phòng máy chủ cũ** trong giao diện web (phần giữ cho web chạy được với máy chủ 1.0.0).
- ☐ Duyệt báo cáo cuối Pha 6 (`docs/bao-cao/pha-6.md`).
