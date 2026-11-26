# Pha 7b — Học sinh tự phân loại lỗi, ghi chú, công cụ sửa lỗi, lời nhắc

## Tóm tắt cho giáo viên
- Trong Sổ tay, mỗi câu sai có hàng chip **"Em sai vì sao?"**: em chọn hoặc đổi loại lỗi; chọn của em thắng máy đoán, bỏ chọn thì quay về máy đoán. Loại "Tính toán" có thêm lựa chọn *quên / đổi sai đơn vị* hoặc *bấm máy / tính nhầm*.
- Mỗi loại sai ngoo có **công cụ sửa**: thẻ công thức (từ trang tính `CongThuc`), tập gạch từ khóa, thang đổi đơn vị (em chọn đơn vị đã dùng và đơn vị đúng), bảng chia thời gian kèm giờ em làm xong thật từng phần. Trong cuốn sổ, nút **"Cách sửa ▸"** mở công cụ của cả loại lỗi.
- **Ghi chú** cho từng câu và **ghi chú chung** trên giấy kẻ, tự lưu.
- Nộp bài xong, trang kết quả có thẻ **Sổ tay** mở sẵn khung "Em sai vì sao?" (một lần mỗi bài, bỏ qua được). Trang chủ nhắc khi có lỗi lặp lại. Trước khi làm **đề thi**, em phải tick "Em đã đọc" hộp **Điều cần nhớ** (luyện tập không hỏi).
- Máy chủ lên 1.7.0 nhưng **chưa dán** — đã chốt dán một lần sau Pha 7c.

## Người làm

### Đã làm
**Máy chủ (`apps-script/Code.gs` 1.6.0 → 1.7.0)**
- API mới: `notebookTag` (≤ 40 câu; `ma` rỗng = bỏ chọn; ý con chỉ cho Tính toán; chi tiết lỗi chỉ giữ `dl`, `dvEm`, `dvDung` ≤ 30 ký tự), `notebookNote` (câu hoặc `_CHUNG`, cắt 500 ký tự), `notebookResult` (câu sai của một bài của chính em, không nội dung câu).
- Ghi `SoTay` trong `withLock_`, mỗi (học sinh, câu) một hàng (`nbUpsert_`); lần ghi đầu tự tạo trang (TC-7.8 phần ghi). Chuỗi bắt đầu bằng `=`/`+` được chặn thành chữ (`safe_`).
- `notebook` trả thêm `tuKhoa` (từ `TU_KHOA_DOC_SAI`) và `nhacNho` (≤ 3 loại sai ngoo còn đỏ/vàng, kèm câu nhắc); `notebookItem` trả thêm `thoiGian {phut, daLam, xong}` từ trường `t` đã ghi từ 7a.
- Đệm: bỏ thế hệ chung của `SoTay` khỏi khóa đệm; mỗi lần ghi sổ tay chỉ đổi phiên bản của chính học sinh đó (`nbVer_`), nên em B ghi không làm mất đệm của em A.

**Giao diện (`assets/js/app.js`, `assets/css/style.css`)**
- Module Sổ tay viết lại trên nền 7a (giữ mọi sửa vòng 2): chip loại lỗi, ý con, "Bỏ chọn của em", 4 công cụ (§5), ghi chú câu (tự lưu sau 1,2 giây), "Cách sửa ▸" trong sổ (tải chi tiết các câu cần), ghi chú chung trên dòng kẻ 32px (ô cao theo số dòng, khối công cụ bù tròn 32px).
- Trang chủ: dải "Em có n lỗi đang lặp lại". Trang bắt đầu làm đề thi: hộp "Điều cần nhớ" + ô tick bắt buộc (lỗi tải sổ tay thì không chặn). Trang kết quả (thi và luyện): thẻ Sổ tay + khung "Em sai vì sao?".

### Chỗ lệch đặc tả (đã ghi "Sửa đặc tả ngày 27/11/2026")
1. Khung "Em sai vì sao?" là **thẻ trong trang kết quả**, không phải hộp nổi: hộp nổi che điểm và lời giải (và làm `tests/e2e.js` cũ không bấm tiếp được). Vẫn hiện một lần, đủ các câu sai, bỏ qua được, có nút mở lại.
2. Thêm API `notebookResult`.
3. Bảng thời gian ghi **lúc em làm xong từng phần** (lần sửa đáp án cuối trong phần), không phải "số phút dành cho phần": học sinh không làm tuần tự từng phần nên chỉ có số này là đúng.
4. Thang đơn vị thêm vận tốc, công suất, điện dung, dòng điện, hiệu điện thế, độ phóng xạ, góc.

### Kiểm thử
- Mới: `tests/pha7b.test.js` 9/9 (TC-7.10, 7.11, 7.8 phần ghi, 7.9 phần máy chủ, 7.15, 7.16 phần máy chủ, đệm không bị học sinh khác làm mất).
- Chạy lại: `pha7` 16/16, `pha7a-kiem-thu` 28/28, `pha7a-kiem-thu.e2e.js all` ĐẠT, `tests/e2e.js` ĐẠT, mọi test cũ đạt trừ TC-5.1 (màu, tự đạt khi PR Pha 7a được gộp), `scan-secrets` sạch.
- Bấm thử trên trình duyệt (1280×900): chọn Đọc sai đề → công cụ gạch từ khóa chạy; chọn Tính toán → đơn vị → bấm cm rồi m → lưu chi tiết; ghi chú câu và ghi chú chung lưu, tải lại vẫn còn; "Cách sửa ▸" mở thang đơn vị; hộp Điều cần nhớ khóa nút Bắt đầu tới khi tick; thẻ Sổ tay ở trang kết quả. Không lỗi console.
- Số phiên bản trong các test cũ đổi 1.6.0 → 1.7.0 (không đổi logic).

### Ảnh
- `anh/pha-7b/01-so-tay-cong-cu-1280.png` — chip loại lỗi, gạch từ khóa, thang đơn vị, Cách sửa trong sổ, ghi chú chung.
- `anh/pha-7b/02-dieu-can-nho-1280.png` — hộp Điều cần nhớ trước khi làm đề thi.
- `anh/pha-7b/03-ket-qua-em-sai-vi-sao-1280.png` — thẻ Sổ tay ở trang kết quả.

### Việc giáo viên cần làm
Không có việc mới (dán Code.gs một lần sau 7c). Nên nhập dần trang tính `CongThuc` để thẻ công thức có nội dung.
