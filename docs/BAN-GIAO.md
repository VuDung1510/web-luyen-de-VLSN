# Bàn giao cho phiên làm việc mới (từ Pha 3)

Viết ngày 19/11/2026, cuối phiên làm Pha 0–2. Đọc file này **sau** `CLAUDE.md` và file quyết định chung trên Drive.

## 1. Trạng thái

| Pha | Trạng thái | Ghi chú |
|---|---|---|
| 0 — Đặc tả | Xong, đã gộp `main` | `docs/spec/`; câu trả lời của giáo viên ở cuối `docs/spec/cau-hoi-mo.md` |
| 1 — Tăng tốc | Xong, đã gộp `main` | Code.gs 1.2.0; đệm theo thế hệ, `features`, `App.cached`, cacheToken. Báo cáo `docs/bao-cao/pha-1*.md` |
| 2 — Ngân hàng câu hỏi | Xong (xem mục 6), gộp `main` | Code.gs 1.3.0; tab Ngân hàng. Báo cáo `docs/bao-cao/pha-2*.md` |
| 3 — Tải đề Word/Excel | **Việc tiếp theo** | Đặc tả `docs/spec/pha-3-tai-de.md` |
| 4 — Luyện tập | Chưa làm | `docs/spec/pha-4-luyen-tap.md` |
| 5 — Màu xanh + logo VLSN | Chưa làm | **Đặc tả phải viết lại trước** (mục 4) |
| 6 — Phát hành | Chưa làm | 6a chuẩn bị; 6b làm cùng giáo viên |

Máy chủ Apps Script **đang chạy thật vẫn là 1.0.0**. Giáo viên dán Code.gs bản cuối **một lần** ở Pha 6. Giao diện phải chạy được với máy chủ 1.0.0 (cờ `features`, dev-server `SERVER_COMPAT=1.0.0`).

## 2. Quy trình mỗi pha (giáo viên đã chốt phương án B)

1. Tạo nhánh `pha-N-...` từ `main`, push có upstream.
2. **Người làm** (agent general-purpose, chạy nền): đọc CLAUDE.md, QUYET-DINH, `00-quy-trinh.md`, đặc tả pha, báo cáo pha trước; làm đúng đặc tả; test; viết mục "Người làm" trong `docs/bao-cao/pha-N.md`; commit/push trên nhánh; không gộp main, không sửa `docs/spec/`.
3. **Soát code** và **Kiểm thử** chạy **song song**, mỗi agent mới, độc lập:
   - Soát: đọc diff `main...nhánh`, ghi `docs/bao-cao/pha-N-soat.md` (R-x, Nặng/Vừa/Nhẹ; có Nặng → CHƯA ĐẠT). Không sửa file khác, không commit, cổng 8795.
   - Kiểm thử: viết test **theo đặc tả, chưa đọc code**: `tests/phaN-kiem-thu.test.js` + `.e2e.js`, cả hai chế độ máy chủ; ảnh `docs/bao-cao/anh/pha-N/kt-*.png`; báo cáo `docs/bao-cao/pha-N-kiem-thu.md`. Cổng 8790–8794. Không sửa code tính năng, không commit.
4. **Vòng 2**: gửi lại cho Người làm (SendMessage tới chính agent đó) danh sách lỗi cần sửa; sau đó Soát và Kiểm thử chạy lại để xác nhận (thêm mục "Vòng 2" vào báo cáo của mình).
5. Điều phối (phiên chính) commit báo cáo của Soát/Kiểm thử, gộp `--no-ff` vào `main`, push, cập nhật trang tiến độ và file quyết định chung.

Mọi commit kết thúc bằng 2 dòng `Co-Authored-By` / `Claude-Session` theo nhắc nhở của hệ thống.

## 3. Môi trường (đã gặp)

- Bị chặn: `script.google.com`, `cdnjs`, Google Fonts. Kiểm thử bằng `tests/gas-shim.js` + `tests/dev-server.js` (biến `PORT`, `SERVER_COMPAT`, `LATENCY_MS`, `SHEET_READ_MS`, `CACHE_MS`; `GET /__stats`).
- Thư viện test KaTeX/Chart.js: cài vào thư mục nháp của phiên (`npm i katex@0.16.9 chart.js@4.4.1`) rồi truyền `LIBS_DIR=<thư mục>/node_modules` cho các e2e.
- Playwright có sẵn: `NODE_PATH=$(npm root -g) node tests/...e2e.js`.
- Kho giả cho test: `tests/fixtures/kho-gia.js`. **Không** đưa nội dung kho thật hay đề thật vào repo.
- Tài khoản có giới hạn sử dụng 5 giờ: agent bị dừng giữa chừng thì lưu tạm file, rồi nhắn agent đó chạy tiếp.
- Hook của phiên yêu cầu commit + push mọi thay đổi trước khi dừng: lưu tạm phần dở của agent lên nhánh pha.

## 4. Việc riêng cho từng pha còn lại

- **Pha 3**: giáo viên gõ công thức bằng **Equation** của Word. Bộ đọc phải nhận dạng mẫu "Form VLSN cho file Word đề" (QUYET-DINH mục 6). File Word thật trên Drive để thử (chỉ đọc, tải về thư mục nháp, không đưa vào repo):
  - `01. De_thi_thu_GK1_VL12.docx`: đề theo mẫu VLSN;
  - `De_KS_Doi_tuyen_VL12_Lan1.docx`: nguồn của mẫu chuẩn;
  - khoảng 30 file `VL11_ĐỀ CHÍNH THỨC_…` (có bản `_LỜI GIẢI`) trong thư mục "01. ĐỀ GỐC ĐÃ NHẬP".
- **Pha 4**: kết quả luyện tập ở trang tính riêng `KetQuaLuyenTap`; loại câu thuộc đề chưa công bố lời giải khỏi luyện tập; giới hạn lượt/ngày đã hoãn.
- **Pha 5**: Cowork đã chốt **giữ bố cục hiện tại**, đổi màu chủ đạo sang **#1D6B3E**, logo VLSN lấy từ vatly.ai (ảnh "Logo Vật Lý Siêu Nhẩm" ở góc trên khung bài học). Bản `docs/spec/pha-5-thiet-ke.md` hiện viết theo phương án bảng đen đã bỏ: cho agent Kiến trúc sư viết lại trước, rồi chạy soát đặc tả. Nếu không tải được logo từ vatly.ai (mạng bị chặn), hỏi giáo viên gửi file logo.
- **Còn lại từ Pha 2 (Nhẹ, sửa đầu Pha 3 hoặc ở Pha 6)**: R-12 `bankImageName_` đọc ô có hai hình "Có – A.png, B.png" thành một tên (vẫn có cảnh báo thiếu hình); R-13 `logout()` trang quản trị không xóa thống kê kho và giỏ câu trong bộ nhớ. Chi tiết: `docs/bao-cao/pha-2-soat.md` mục Vòng 2.
- **Pha 6**: gom "Việc giáo viên cần làm" từ các `docs/bao-cao/pha-*.md`; Code.gs bản cuối; README; danh sách kiểm tra trên trang thật (đo thời gian thật, `onEdit`, chỉ mục kho 10 239 hàng, chép hình, R-9/R-10 của Pha 2).

## 5. Liên kết

- Quyết định chung (nguồn đúng): Google Doc "Quyết định đã chốt — Web luyện đề VLSN", thư mục "WEB LUYỆN ĐỀ – TÀI LIỆU CHUNG".
- Kho câu hỏi đang dùng: "KHO CÂU HỎI VẬT LÝ" (file cũ `1p6B…` không còn mở được).
- Danh sách 31 câu kho lỗi định dạng: Google Doc "Danh sách câu kho bị lỗi định dạng (18-11-2026)" trong thư mục tài liệu chung.
- Trang theo dõi tiến độ (artifact riêng tư của giáo viên): https://claude.ai/artifact/LShA5Qu3C1h7gzq3py4z8L. Cập nhật từ phiên mới bằng công cụ Artifact: đọc (`action: "read"`) rồi publish với `url` đó.

## 6. Kết quả Pha 2 lúc bàn giao

Gộp vào `main` ngày 19/11/2026. Soát code vòng 2 ĐẠT; kiểm thử vòng 2 ĐẠT sau khi sửa K-1 (giới hạn ma trận). Kho thật: 1 014/10 239 câu dùng được, đối chiếu 61/61 đúng.

**Việc đầu tiên của phiên mới:** nhóm "Tạo đề" trong `tests/pha2-kiem-thu.e2e.js` chập chờn (khoảng 3/9 lần không đạt, tùy câu bốc ngẫu nhiên). Bắt ca hỏng (in mã câu, ô hình, nhãn) để xác định là lỗi test hay lỗi chép hình theo lô; sửa rồi mới bắt đầu Pha 3. Xem ghi chú cuối `docs/bao-cao/pha-2-kiem-thu.md`.
