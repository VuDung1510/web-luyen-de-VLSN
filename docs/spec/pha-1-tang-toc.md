# Pha 1 — Tăng tốc

## Mục tiêu
Chuyển tab gần như tức thì khi đã có dữ liệu; giảm số lần gọi máy chủ; giảm thời gian mỗi lần gọi bằng bộ nhớ đệm phía máy chủ mà **không bao giờ ghi nhầm hàng**. Có số đo trước/sau. Sửa lỗi Đổi PIN/mục tiêu điểm đang có trên trang thật.

## Phạm vi
**Làm**
0. **Việc đầu tiên** (gộp riêng được, nếu giáo viên muốn phát hành sớm): ẩn nút Đổi PIN và hộp mục tiêu điểm khi máy chủ không có cờ `changePin`/`goal`; thêm `tests/fixtures/Code-1.0.0.gs` và `SERVER_COMPAT=1.0.0` trong dev-server (xem 00 §5).
1. Bộ đệm trình duyệt kiểu "hiện ngay – cập nhật ngầm" cho **4 màn học sinh** (Trang chủ, Lịch sử, Thống kê, Bảng xếp hạng) và **3 tab quản trị** (Tổng quan, Đề thi, Kết quả).
2. Action gộp `bootstrap` (học sinh) và `adminBootstrap` (quản trị).
3. Đệm máy chủ cho `readTable_()` (CacheService, chia mảnh, theo thế hệ), với đường ghi an toàn.
4. Skeleton khi chưa có dữ liệu; chỉ báo nhỏ "đang cập nhật".
5. Hạ tầng đo: dev-server `LATENCY_MS`; shim có chi phí giả `SHEET_READ_MS`, `CACHE_MS`.

**Không làm**: đổi màu/giao diện (Pha 5); lưu bài làm dở; service worker/offline; đổi cách chấm điểm.

**Hoãn sau**: hẹn giờ giữ ấm `giuAm`/`caiHenGio` (thời hạn đệm 60 s nên hẹn giờ 10 phút gần như vô ích); trigger cài đặt `onChange`; đệm tab Học sinh, Bảng điểm, Cài đặt và trình soạn đề.

## Thiết kế kỹ thuật

### API (Code.gs: tăng số phụ, dự kiến 1.2.0)
| Action | Tham số | Kết quả |
|---|---|---|
| `publicConfig` (sửa) | — | thêm `features: ["changePin","goal","bootstrap","cache"]` |
| `bootstrap` | `token` | `{ me, pub, exams, results, v }`: `exams` = `apiListExams_`, `results` = `apiMyResults_`. Không gồm thống kê (tab Thống kê gọi `myStats` khi cần, có đệm). |
| `adminBootstrap` | `token` | `{ me, overview, exams, v }`. Không gồm học sinh (có PIN) và kết quả (lớn). |
Mỗi trang tính được đọc tối đa 1 lần cho mỗi request (`MEMO_`). Không trả đáp án/lời giải. Token hết hạn trả lỗi `AUTH:` như cũ.

### Đệm máy chủ — quy tắc bắt buộc
- `readTable_(name, opts)`: mặc định thử đệm trước. `opts.fresh=true` thì đọc thẳng Sheet, bỏ qua đệm (và không dùng `MEMO_` cũ).
- **Thứ tự khi đọc:** (1) đọc `gen = tbgen_<name>` **trước**; (2) đọc mảnh `tb_<name>_<gen>_*` bằng `getAll`; trượt đệm thì (3) đọc Sheet và (4) cất dưới **chính `gen` đã đọc ở bước 1**. Như vậy dữ liệu cũ không thể nằm dưới thế hệ mới.
- `gen` mới tạo bằng `Date.now() + số ngẫu nhiên` (không đếm từ 0). Nếu khóa `tbgen_*` bị xóa sớm thì tạo lại giá trị mới, không trùng thế hệ cũ.
- Mảnh ≤ 90 000 ký tự; khóa đầu chứa số mảnh; thời hạn hằng số `CACHE_SECONDS = 60` trong Code.gs (không đọc từ CaiDat). Bảng tuần tự hóa > 900 KB thì không đệm. Thiếu một mảnh thì coi là trượt đệm.
- **Đường ghi:** mọi hàm ghi chạy trong `withLock_`, và trong khóa phải đọc lại bằng `readTable_(…, {fresh:true})` để lấy `_row`. Áp dụng cho: `apiChangePin_`, `apiAdminSaveStudent_`, `apiAdminDeleteStudent_`, `apiAdminImportStudents_` (`nextStudentId_`), `apiAdminSaveExam_`, `apiAdminDeleteExam_`, `apiAdminDeleteResult_`, `apiAdminSaveSettings_`, `apiLinkGoogle_`.
- `updateRow_`/`deleteRows_` nhận thêm ô khóa mong đợi (Mã HS / Mã bài / Mã đề / Khóa). Trước khi ghi, đọc ô khóa ở hàng đó; không khớp thì đọc lại toàn bảng (fresh), tìm lại hàng; vẫn không thấy thì báo lỗi, không ghi.
- Ghi xong: `SpreadsheetApp.flush()`, rồi đặt `tbgen_<name>` mới, vẫn trong khóa.
- `onEdit(e)` đơn giản đặt `gen` mới cho trang tính vừa sửa. Người làm xác minh CacheService dùng được trong trigger đơn giản; nếu không được thì sửa tay thấy trễ tối đa `CACHE_SECONDS` (ghi README). Chèn/xóa hàng hoặc sửa qua API không gọi `onEdit`: chấp nhận đọc trễ ≤ 60 s, còn ghi vẫn an toàn nhờ quy tắc trên.
- CaiDat (có `MAT_KHAU_QUAN_TRI`) được đệm phía máy chủ, không bao giờ trả về giao diện.

### Giao diện (`common.js`, `app.js`, `admin.js`)
- `common.js` thêm `cached(key, loader, render, opts)`: có bản lưu thì `render(data,{stale:true})` ngay, đồng thời gọi `loader()`; dữ liệu về mà khác thì vẽ lại, giữ vị trí cuộn; lỗi mạng khi đã có bản lưu thì hiện toast nhẹ.
- Học sinh: `localStorage`, khóa `ld_c_v1_<userId>_<key>`, tổng ≤ 1 MB/người (quá thì bỏ khóa cũ nhất). Gọi `bootstrap` một lần khi vào trang; máy chủ cũ thì dùng `Promise.all([listExams, myResults])`.
- Quản trị: **`sessionStorage`** (mất khi đóng tab); chỉ 3 tab đã nêu; không lưu dữ liệu có `pin` hay `dapAn`.
- Gặp lỗi `AUTH:` hoặc đăng xuất: xóa mọi `ld_c_*` trong cả hai kho lưu, và xóa thêm `ld_lastResult`.
- Sau `submitExam`: xóa khóa `home`, `history`, `stats` rồi làm mới ngầm.
- Không đệm: `startExam`, câu hỏi đang làm.
- Skeleton: lớp `.skeleton` cho thẻ đề/bảng. `publicConfig` không gọi lại khi chuyển tab nếu `ld_pub` mới hơn 10 phút.

### Tương thích máy chủ cũ
Phần giao diện chạy với 1.0.0 (đệm trình duyệt + API cũ; ẩn Đổi PIN/mục tiêu). `bootstrap` và đệm máy chủ cần máy chủ mới.

## Tiêu chí nghiệm thu
Đo trên dev-server `LATENCY_MS=1500`, Chromium 390×844, trừ khi ghi khác.
- **TC-1.0** Máy chủ 1.0.0: nút Đổi PIN và hộp mục tiêu điểm không hiển thị; máy chủ mới: hiển thị và hoạt động như e2e hiện tại.
- **TC-1.1** Đã có đệm: chuyển giữa 4 màn học sinh, và giữa 3 tab quản trị, nội dung chính hiện **< 300 ms** kể từ `hashchange` (trung vị của 5 lần).
- **TC-1.2** Chưa có đệm: skeleton hiện **< 150 ms**, không có màn trắng.
- **TC-1.3** Máy chủ mới: tải trang học sinh đã đăng nhập đến lúc trang chủ đầy đủ = **1** POST `bootstrap` + tối đa 1 `publicConfig` ngầm (số gốc trước Pha 1 ghi vào báo cáo).
- **TC-1.4** `SERVER_COMPAT=1.0.0` (Code.gs 1.0.0 thật): e2e chạy hết, bỏ qua các bước Đổi PIN/mục tiêu, khẳng định nút bị ẩn; không lỗi console; không hiện "Không có chức năng".
- **TC-1.5** Shim đếm `getDataRange`: hai request `listExams` cách nhau < 60 s (hai lần chạy riêng) thì lần 2 không đọc DeThi/CauHoi/KetQua.
- **TC-1.6** Sau mỗi thao tác ghi (`submitExam`, `adminSaveExam`, `adminSaveStudent`, `adminDeleteResult`, `adminSaveSettings`, `changePin`), lần đọc kế tiếp trả dữ liệu mới.
- **TC-1.7** Chia mảnh: KetQua giả 600 hàng (~1,2 KB/hàng) lưu/đọc giống hệt; shim từ chối giá trị > 100 KB/khóa; bảng > 900 KB không đệm nhưng kết quả vẫn đúng.
- **TC-1.8** Xóa tay một mảnh, hoặc xóa khóa `tbgen_*`: đọc lại từ Sheet, kết quả đúng, thế hệ mới khác mọi thế hệ cũ.
- **TC-1.9** Đăng xuất HS A, đăng nhập HS B: không còn khóa nào của A; không hiện dữ liệu của A.
- **TC-1.9b** Giáo viên: sau đăng xuất hoặc token hết hạn (`AUTH:`), `localStorage` và `sessionStorage` không chứa chuỗi PIN nào, không chứa `ld_lastResult`.
- **TC-1.10** Nộp bài xong về trang chủ: điểm mới hiện mà không phải tải lại trang.
- **TC-1.11** Đang làm bài: không giá trị nào trong `localStorage` chứa `dapAn` hoặc `loiGiai`.
- **TC-1.12** Ghi an toàn: (a) xóa tay 1 hàng HocSinh trong shim (không gọi `onEdit`, đệm còn sống) rồi HS khác `changePin` thì PIN ghi đúng hàng của HS đó, không hàng nào khác bị đổi; (b) chèn 1 hàng lên đầu KetQua rồi `adminDeleteResult` thì xóa đúng bài; (c) thêm học sinh sau khi xóa tay thì không sinh Mã HS trùng.
- **TC-1.13** Tranh chấp (giả lập trong shim): lần A đọc Sheet, lần B ghi và đổi `gen`, rồi A mới cất đệm; lần đọc sau vẫn thấy dữ liệu của B.
- **TC-1.14** Offline (Playwright) khi đã có đệm: các tab vẫn hiển thị kèm thông báo nhẹ.
- **TC-1.15** Số đo: (a) **số gốc trên máy chủ thật 1.0.0 trước khi bắt đầu Pha 1**: thời gian `listExams`, `myResults`, thời gian chuyển tab, đo bằng trình duyệt thật (giáo viên, hoặc agent có quyền mở trang); (b) shim với `SHEET_READ_MS`: số lần đọc Sheet trước/sau (chỉ số chính), ms để tham khảo; (c) số đo lại trên máy chủ thật làm ở TC-6.7.
- **TC-1.16** Mọi test cũ đạt.

## Kế hoạch kiểm thử
Node `tests/pha1.test.js` (TC-1.5 → 1.8, 1.12, 1.13). Shim cần thêm: `getAll/putAll/removeAll`, giới hạn 100 KB, bộ đếm `getDataRange`, `flush`, chi phí giả. E2E `tests/e2e-pha1.js` chạy hai chế độ máy chủ (TC-1.0 → 1.4, 1.9 → 1.11, 1.14). Ảnh: skeleton, trang chủ từ đệm có chỉ báo, trang chủ máy chủ 1.0.0 không có nút Đổi PIN.

## Rủi ro & cách giảm
| Rủi ro | Giảm |
|---|---|
| Ghi nhầm hàng vì đệm cũ | Đọc fresh trong khóa + kiểm ô khóa + thứ tự gen (TC-1.12, 1.13) |
| Đọc dữ liệu cũ ≤ 60 s khi sửa Sheet bằng tay hoặc qua Cowork | `onEdit`; thời hạn ngắn; README; câu hỏi mở số 3 |
| Vượt 100 KB/khóa | Chia mảnh, ngưỡng 900 KB (TC-1.7) |
| Lộ dữ liệu trên máy dùng chung | Khóa theo người dùng; quản trị dùng sessionStorage, không lưu PIN (TC-1.9, 1.9b) |

## Việc giáo viên cần làm (gộp vào Pha 6)
Dán Code.gs; chạy `setup`; Triển khai → Quản lý → Phiên bản mới. Trước pha: đo số gốc TC-1.15a (hoặc cho phép agent đo).

## Ước lượng: **M** (sau khi cắt giữ ấm và thu hẹp số màn được đệm)

Sửa đặc tả ngày 18/11/2026: theo `soat-pha-0.md` S-1, S-4, S-5, S-11, S-13, S-15, S-21, S-22.
