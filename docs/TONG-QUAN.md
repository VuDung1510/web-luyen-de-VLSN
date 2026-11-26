# Tổng quan dự án — Web luyện đề VLSN

Bản tóm tắt cho **người cộng tác mới** (và Claude của họ). Đọc file này sau `CLAUDE.md`; chi tiết nằm ở các tài liệu liệt kê ở mục 5.
Cập nhật: 24/11/2026. Trạng thái: đã xong Pha 0–6, trang thật đang chạy, máy chủ Code.gs **1.5.0**.

## 1. Dự án là gì

Web luyện đề Vật lý THPT của hệ thống **Vật Lý Siêu Nhẩm (VLSN)**. Đề theo mẫu thi tốt nghiệp THPT từ 2025, chạy miễn phí.

- Trang học sinh: https://vudung1510.github.io/web-luyen-de-VLSN/
- Trang giáo viên: https://vudung1510.github.io/web-luyen-de-VLSN/admin.html

## 2. Chức năng chính

**Học sinh** (`index.html`, `assets/js/app.js`)
- Đăng nhập bằng PIN (mặc định ngày + tháng sinh) hoặc Google. Sai 5 lần thì bị khóa 10 phút. Học sinh tự đổi được PIN.
- Đặt **mục tiêu điểm** trước khi làm bài, làm bài có tính giờ rồi nộp. Máy chủ chấm điểm, sau đó học sinh xem điểm (thang 10), **nhận xét tự động** (theo phần, mức độ, chủ đề, thời gian, tiến bộ), đáp án và lời giải.
- Chưa đạt mục tiêu thì web động viên và gợi ý **đề tương tự**.
- Xem **lịch sử**, **thống kê theo chủ đề**, **bảng xếp hạng**.
- **Luyện tập** (khi giáo viên bật): tự tạo đề theo bài, luyện lại câu đã sai, đề nhanh 10 phút. Kết quả luyện tập không tính vào bảng xếp hạng.
- **Sổ tay** (Pha 7, máy chủ 1.6.0; đang làm): mọi câu đã sai, phân loại lỗi ("Sai ngoo" / "Hổng kiến thức"), màu đỏ–vàng–xanh theo mức đã khắc phục. Đặc tả `docs/spec/pha-7-so-tay.md`, trang mẫu `docs/spec/mau-so-tay.html`.

**Giáo viên** (`admin.html`, `assets/js/admin.js`)
- Quản lý học sinh: thêm từng em, dán danh sách từ Excel, đặt lại PIN, in phiếu đăng nhập, khóa tài khoản.
- Soạn đề bằng nhiều cách: gõ tay; dán văn bản hoặc bảng từ Word/Excel (`importer.js`); **tải file `.docx`/`.xlsx`** (`docx-reader.js`, công thức Equation được đổi sang LaTeX); lấy câu từ **Ngân hàng** (lọc, giỏ câu, ma trận 1 chạm 18–4–6, lấy nguyên đề gốc).
- Tùy chọn đề: thời gian, lớp, giờ mở/đóng, số lần làm, trộn câu, thời điểm hiện lời giải.
- Kết quả: lọc, thống kê từng đề (phổ điểm, tỉ lệ đúng từng câu), bảng điểm theo lớp, xuất CSV, tùy chọn gửi email khi có bài nộp.
- Quản lý **Pool luyện tập** (bật/tắt từng câu) và **Cài đặt** (lưu ở trang tính `CaiDat`).

**Cách chấm:** Phần I 0,25 điểm/câu. Phần II đúng 1/2/3/4 ý được 0,1/0,25/0,5/1 điểm. Phần III 0,25 điểm/câu (chấp nhận dấu phẩy, sai số, nhiều đáp án cách nhau bằng `|`). Phần IV (tự luận) chưa chấm.

## 3. Kiến trúc

```
Trình duyệt ──► GitHub Pages (index.html, admin.html, assets/) ──► Google Apps Script (apps-script/Code.gs) ──► Google Sheet
```

- **Đáp án chỉ nằm trong Google Sheet.** Máy chủ chấm điểm; trình duyệt không nhận đáp án trước khi nộp.
- Sheet **"web luyện đề"** có 7 trang tính: `HocSinh`, `DeThi`, `CauHoi`, `KetQua`, `CaiDat`, `LuyenTap`, `KetQuaLuyenTap`. Không đổi tên trang tính, hàng tiêu đề, cột Mã HS / Mã đề.
- **Ngân hàng câu hỏi** là một Sheet riêng, "KHO CÂU HỎI VẬT LÝ", kèm thư mục hình "02. HÌNH VẼ". Máy chủ chỉ đọc kho khi giáo viên tạo đề, rồi chép câu sang `CauHoi`. Kho do dự án Cowork "Kho đề" nhập và gắn nhãn.
- Máy chủ nhớ tạm dữ liệu 60 giây; sửa thẳng trên Sheet thì web thấy chậm nhất sau 60 giây.
- `assets/js/config.js` chứa URL máy chủ. `common.js` gồm hàm dùng chung: gọi máy chủ, hiển thị công thức KaTeX.
- Giao diện: màu chủ đạo xanh **#1D6B3E**, logo `assets/img/logo-vlsn.png` (thay file là đổi logo), phông Montserrat, có chế độ tối.

## 4. Cách làm việc

- **Quyết định:** mọi quyết định đã chốt nằm trong Google Doc "Quyết định đã chốt — Web luyện đề VLSN" (đường dẫn trong `CLAUDE.md`), thư mục Drive "WEB LUYỆN ĐỀ – TÀI LIỆU CHUNG". `docs/QUYET-DINH.md` chỉ là bản chép lại. Chốt điều mới thì ghi vào Google Doc (đúng mục, kèm ngày, thêm dòng Nhật ký) rồi cập nhật bản chép.
- **Theo pha, 3 vai độc lập:** người làm, người soát code, người kiểm thử (`docs/spec/00-quy-trinh.md`).
- **Người cộng tác** (chốt 24/11/2026, xem `docs/QUYET-DINH.md` mục 8):
  - Làm trên nhánh riêng và gộp vào `main` qua pull request. Giáo viên duyệt trước khi gộp, vì `main` phát hành thẳng ra trang thật.
  - Vào trang quản trị bằng email Google của mình, được ghi trong `CaiDat` → `EMAIL_GIAO_VIEN`.
  - **Chỉ giáo viên triển khai Apps Script.** Ai sửa `Code.gs` thì tăng `APP_VERSION` và ghi việc cần làm vào `docs/VIEC-GIAO-VIEN.md`.
- **Kiểm thử:** `node tests/backend.test.js`, `node tests/importer.test.js`, `node tests/dev-server.js` + `node tests/e2e.js`. Không cần mạng tới Google, vì `tests/gas-shim.js` giả lập Apps Script. Trước khi đẩy code, chạy `node tests/scan-secrets.js`.
- **Bảo mật:** repo công khai, nên không ghi mật khẩu, PIN, email, id file Drive thật hay nội dung kho/đề thật vào repo.

## 5. Tài liệu liên quan

| Tài liệu | Nội dung |
|---|---|
| `CLAUDE.md` | Quy tắc bắt buộc cho mọi phiên Claude |
| `README.md` | Cài đặt, hướng dẫn dùng cho giáo viên, cấu trúc thư mục |
| `docs/QUYET-DINH.md` | Bản chép các quyết định đã chốt (bản đúng nằm trên Drive) |
| `docs/BAN-GIAO.md` | Lịch sử các pha, môi trường kiểm thử, các lỗi đã gặp |
| `docs/VIEC-GIAO-VIEN.md` | Việc giáo viên tự làm: dán Code.gs, triển khai, nhóm C/D còn lại |
| `docs/spec/` | Đặc tả và tiêu chí nghiệm thu từng pha (`00-quy-trinh.md` là quy trình) |
| `docs/bao-cao/` | Báo cáo làm / soát / kiểm thử từng pha, kèm ảnh |
| `tests/` | Kiểm thử tự động, máy chủ giả (`dev-server.js`, `gas-shim.js`), kho giả (`fixtures/`) |

Trên Google Drive (giáo viên chia sẻ khi cần):
- Thư mục **"WEB LUYỆN ĐỀ – TÀI LIỆU CHUNG"**: file Quyết định đã chốt, danh sách câu kho bị lỗi định dạng.
- Sheet **"web luyện đề"** (dữ liệu web và Apps Script).
- Sheet **"KHO CÂU HỎI VẬT LÝ"** và thư mục **"02. HÌNH VẼ"**.
