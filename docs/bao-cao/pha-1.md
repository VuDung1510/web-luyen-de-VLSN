# Báo cáo Pha 1 — Tăng tốc

## Tóm tắt cho giáo viên (bản của người làm)
- Chuyển giữa các trang (Trang chủ, Lịch sử, Thống kê, Xếp hạng; và Tổng quan, Đề thi, Kết quả bên quản trị) hiện **ngay lập tức** từ dữ liệu máy đã lưu, rồi tự cập nhật âm thầm.
- Lần đầu mở trang (chưa có dữ liệu lưu) hiện khung xương xám thay cho màn trắng.
- Nút **Đổi PIN** và ô **Mục tiêu điểm** tự ẩn khi máy chủ đang chạy là bản cũ (1.0.0) — học sinh không còn gặp lỗi; trang quản trị ghi rõ "Cần cập nhật máy chủ (bước phát hành)".
- Sau khi thầy dán máy chủ mới ở Pha 6: mở trang học sinh chỉ cần 1 lần gọi máy chủ, và máy chủ nhớ tạm dữ liệu 60 giây nên mỗi lần gọi nhanh hơn nhiều (số lần đọc Google Sheet giảm từ 76 xuống 5 trong phép đo giả lập).
- Dữ liệu trong Google Sheet chỉ được thêm, không đổi tên/xóa cột; việc ghi của web luôn đọc lại Sheet nên không ghi nhầm hàng.

---

## Người làm

### Đã làm
**Bước 0 (ưu tiên, sửa lỗi đang có trên trang thật)**
- Cờ tính năng: `publicConfig` (máy chủ 1.2.0) trả `features: ["changePin","goal","bootstrap","cache"]`. Giao diện chỉ bật nút theo danh sách này (`App.has`), không so số phiên bản; thiếu `features` = máy chủ 1.0.0.
- Học sinh: nút Đổi PIN chỉ hiện khi có `changePin`; hộp mục tiêu điểm chỉ hiện khi có `goal` (máy chủ cũ thì bấm "Bắt đầu" là làm luôn, không gửi `mucTieu`). Trang giới thiệu đề chờ biết cấu hình máy chủ trước khi vẽ ô mục tiêu (nếu chưa có `ld_pub`).
- `api()` gặp `Không có chức năng: <action>` thì ghi nhớ action/tính năng đó không có trong phiên, ném lỗi `unsupported` để nơi gọi dùng đường dự phòng (bootstrap → listExams + myResults; adminBootstrap → adminOverview; changePin → đóng hộp, ẩn nút, báo nhẹ). Không hiện chữ "Không có chức năng".
- Trang quản trị (Tổng quan): ghi chú "Máy chủ đang chạy phiên bản …: nút Đổi PIN … và ô Mục tiêu điểm đang tạm ẩn. Cần cập nhật máy chủ (bước phát hành)." khi máy chủ thiếu `changePin`/`goal`.
- `tests/fixtures/Code-1.0.0.gs` = `git show 89b3f28:apps-script/Code.gs` (không sửa tay); dev-server `SERVER_COMPAT=1.0.0` nạp đúng file này.

**Máy chủ (`Code.gs` 1.1.0 → 1.2.0)**
- Action gộp `bootstrap` → `{ me, pub, exams, results, v }` và `adminBootstrap` → `{ me, overview, exams, v }`. Không có đáp án/lời giải/PIN/mật khẩu; token hết hạn trả `AUTH:` như cũ. Mỗi trang tính đọc tối đa 1 lần/request (`MEMO_`).
- `readTable_(name, opts)`: MEMO_ → đệm CacheService → Sheet. Thứ tự đúng đặc tả: (1) đọc `tbgen_<tên>` trước; (2) `getAll` các mảnh `tb_<tên>_<gen>_*`; trượt thì (3) đọc Sheet, (4) cất dưới **chính gen đã đọc**. `gen` = `Date.now()` (base36) + số ngẫu nhiên; mất khóa `tbgen_*` thì tạo giá trị mới. `CACHE_SECONDS = 60` là hằng số. Chia mảnh, khóa đầu chứa số mảnh, thiếu một mảnh = trượt đệm, bảng quá lớn không đệm. `opts.fresh` đọc thẳng Sheet, bỏ MEMO_ cũ (và nạp lại MEMO_ bằng bản vừa đọc, để `checkPin_`/`findStudent_` trong cùng lần ghi dùng bản mới).
- Đường ghi: 9 hàm đặc tả liệt kê (`apiChangePin_`, `apiAdminSaveStudent_`, `apiAdminDeleteStudent_`, `apiAdminImportStudents_`, `apiAdminSaveExam_`, `apiAdminDeleteExam_`, `apiAdminDeleteResult_`, `apiAdminSaveSettings_`, `apiLinkGoogle_`) đều đọc `readTable_(…, {fresh:true})` **trong** `withLock_`. `apiChangePin_` kiểm PIN cũ trên bản đọc mới trong khóa.
- `updateRow_(name, row, obj, keyField, keyValue)` / `deleteRows_(name, rows, keyField, keyValues)`: đọc ô khóa (Mã HS / Mã đề / Mã bài / Khóa) ở hàng đó; không khớp thì đọc lại cả bảng (fresh) tìm đúng hàng; không thấy (hoặc thấy trùng) thì báo lỗi, không ghi. Thiếu ô khóa cũng báo lỗi (bắt buộc mọi chỗ gọi truyền khóa).
- Ghi xong (`appendRows_`, `updateRow_`, `deleteRows_`, `replaceQuestions_`): `SpreadsheetApp.flush()` rồi đặt thế hệ mới, vẫn trong khóa. `setup()` đặt thế hệ mới cho mọi trang tính ở đầu và cuối.
- `onEdit(e)` (trigger đơn giản): đặt thế hệ mới cho trang tính vừa sửa tay. CaiDat được đệm phía máy chủ nhưng mật khẩu không bao giờ trả ra (có test).
- Không thêm/đổi cột hay trang tính nào ở Pha 1.

**Giao diện (`common.js`, `app.js`, `admin.js`, `style.css`)**
- `App.cached(key, loader, render, opts)`: có bản lưu → `render(data,{stale:true})` ngay + chỉ báo nhỏ "Đang cập nhật…" (góc phải) → gọi `loader()`; dữ liệu mới khác thì vẽ lại, giữ vị trí cuộn; mất mạng khi có bản lưu → toast nhẹ "Mất kết nối — đang hiện dữ liệu đã lưu trên máy." Dữ liệu về muộn của màn cũ không vẽ đè màn mới (`App.newView`), và không ghi vào kho của người dùng khác nếu đổi tài khoản giữa chừng.
- Học sinh: 4 màn (Trang chủ, Lịch sử, Thống kê, Bảng xếp hạng — khóa theo đề + "chỉ lớp tôi") đệm ở `localStorage`, khóa `ld_c_v1_<mã HS>_<tên>`, tổng ≤ 1 MB/người (quá thì bỏ khóa cũ nhất; kho đầy thì bỏ khóa cũ nhất rồi thử lại). Trang chủ gọi `bootstrap` (một lần, dùng chung lời gọi đang chạy); máy chủ cũ dùng `Promise.all([listExams, myResults])`. Kết quả trong bootstrap được cất luôn làm bản lưu "Lịch sử".
- Giáo viên: 3 tab (Tổng quan, Đề thi, Kết quả) đệm ở `sessionStorage` (`ld_c_v1_admin_*`). Tab Kết quả chỉ lưu mã/họ tên/lớp học sinh (không lưu PIN). Mọi lần ghi thành công (`adminSave*`, `adminDelete*`, `adminImport*`) xóa đệm quản trị.
- Chặn an toàn: `cacheSet` từ chối mọi dữ liệu có khóa `"dapAn"`, `"loiGiai"` hoặc `"pin"`. Không đệm `startExam` / câu hỏi đang làm.
- Đăng xuất hoặc lỗi `AUTH:` (cả hai trang): xóa mọi `ld_c_*` ở cả `localStorage` và `sessionStorage`, và `ld_lastResult`. Đăng nhập mới cũng xóa trước khi lưu.
- Sau `submitExam`: xóa `home`, `history`, `stats` rồi làm mới ngầm (gọi lại bootstrap và `myStats`, cất vào đệm).
- `publicConfig` lưu kèm thời điểm (`ld_pub_t`); chỉ gọi lại khi bản lưu cũ hơn 10 phút (không gọi khi chuyển tab). `bootstrap` cũng trả `pub` và cập nhật bản lưu.
- Khung xương `.skeleton` (thẻ đề, ô số liệu, bảng, biểu đồ) khi chưa có đệm; tắt hiệu ứng khi người dùng chọn giảm chuyển động.

**Hạ tầng test / đo**
- `tests/gas-shim.js`: CacheService đủ `get/getAll/put/putAll/remove/removeAll`, từ chối giá trị > 100 KB (byte UTF-8) và khóa > 250 ký tự, thời hạn tối đa 6 giờ; `SpreadsheetApp.flush`; bộ đếm `getDataRange` / ghi / gọi Cache (`ctx._stats`, `ctx._resetStats()`); chi phí giả `SHEET_READ_MS`, `CACHE_MS` (chờ đồng bộ bằng `Atomics.wait`); móc `ctx._hooks.onReadSheet`; `range.getSheet()` cho thử `onEdit`; `opts.codePath`.
- `tests/dev-server.js`: `SERVER_COMPAT=1.0.0`, `LATENCY_MS`, `PORT`, `GET /__stats[?reset=1]`.
- `tests/e2e.js` (sửa theo 00-quy-trinh §5.4): `SERVER_COMPAT=1.0.0` bỏ qua bước đặt mục tiêu, khung mục tiêu, Đổi PIN, đăng nhập lại bằng PIN cũ; khẳng định `#btnPin` và `#goal` không có; khẳng định không hiện "Không có chức năng". Ở chế độ 1.0.0 nút lọc câu sai dùng `[data-rvfilter="wrong"]` (nút trong khung mục tiêu không có).
- `tests/cache.test.js` (test đơn vị của người làm, 15 test): features/bootstrap/adminBootstrap + không lộ dữ liệu, 1 lần đọc mỗi trang tính/request, TC-1.5, 1.6, 1.7, 1.8, 1.12 a/b/c, kiểm ô khóa, TC-1.13, `onEdit`, mật khẩu không lộ, fixture 1.0.0 chạy được, chi phí giả.
- `tests/measure-pha1.js`: đo phía máy chủ (`backend`) và trình duyệt (`browser`).

### File đổi
`apps-script/Code.gs`, `assets/js/common.js`, `assets/js/app.js`, `assets/js/admin.js`, `assets/css/style.css`, `README.md` (ghi chú trễ ≤ 60 s, biến môi trường dev-server), `tests/gas-shim.js`, `tests/dev-server.js`, `tests/e2e.js`; mới: `tests/fixtures/Code-1.0.0.gs`, `tests/cache.test.js`, `tests/measure-pha1.js`, `docs/bao-cao/pha-1.md`.

### Kết quả test (người làm tự chạy)
| Lệnh | Kết quả |
|---|---|
| `node tests/backend.test.js` | 13/13 đạt |
| `node tests/importer.test.js` | đạt |
| `node tests/cache.test.js` | 15/15 đạt |
| dev-server + `node tests/e2e.js` (máy chủ mới) | đạt |
| `SERVER_COMPAT=1.0.0` dev-server + `SERVER_COMPAT=1.0.0 node tests/e2e.js` | đạt (nút Đổi PIN, hộp mục tiêu bị ẩn; không lỗi console; không có chữ "Không có chức năng") |
| Kịch bản tự kiểm bằng Playwright (không đưa vào repo; người kiểm thử viết `e2e-pha1.js` độc lập) — cả hai chế độ máy chủ | TC-1.9, 1.9b, 1.10, 1.11, 1.14 đạt |

### Số đo
**(a) Số gốc trên máy chủ thật 1.0.0 (TC-1.15a): CHƯA ĐO.** Môi trường của người làm bị chặn `script.google.com`, không mở được trang thật. Cần giáo viên đo (hoặc cho phép một phiên có mạng mở trang): thời gian `listExams`, `myResults`, thời gian chuyển tab (DevTools → Network). Đặc tả cho phép giáo viên làm; ghi vào việc cần làm.

**(b) Phía máy chủ, gas-shim** — `node tests/measure-pha1.js backend` với `SHEET_READ_MS=300`, `CACHE_MS=15`; dữ liệu giả 41 học sinh, 8 đề (1×6 + 7×28 câu), 300 bài nộp; kịch bản: HS mở trang chủ → Lịch sử → Thống kê → Xếp hạng → về Trang chủ; GV Tổng quan → Đề thi → Kết quả → về Tổng quan; lặp 2 vòng trong < 60 s; đệm máy chủ trống lúc đầu. "Trước" = Code.gs 1.0.0 + cách gọi cũ; "sau" = Code.gs 1.2.0 + cách gọi mới.

| Chỉ số | Trước | Sau |
|---|---|---|
| **Số lần đọc Sheet (chỉ số chính)** | **76** | **5** (chỉ lần mở trang đầu tiên khi đệm trống) |
| Số request | 28 | 24 |
| HS mở trang chủ (vòng 1 / vòng 2) | 7 lần đọc, 2117 ms / 7 lần, 2111 ms | 5 lần đọc, 1855 ms / 0 lần, 206 ms |
| HS về Trang chủ | 6 lần đọc, 1811 ms | 0 lần đọc, 175 ms |
| GV Kết quả | 6 lần đọc, 1818 ms | 0 lần đọc, 242 ms |
| Tổng ms (tuần tự, tham khảo) | 22 950 | 4 376 |

**(c) Trình duyệt** — Chromium 390×844, dev-server `LATENCY_MS=1500`, `node tests/measure-pha1.js browser`; thời gian đo trong trang từ lúc đổi `location.hash` đến khi nội dung chính có trong DOM (MutationObserver, chưa tính thời gian vẽ khung hình ~16 ms). "Trước" = giao diện + máy chủ của `main` chạy trên cùng dev-server mới.

| Chỉ số | Trước (`main`) | Sau |
|---|---|---|
| Chuyển màn học sinh đã có đệm, trung vị 5 lần (Lịch sử / Thống kê / Xếp hạng / Trang chủ) | 1508 / 1508 / 1507 / 1510 ms | 1 / 1 / 2 / 1 ms |
| Chuyển tab quản trị đã có đệm (Đề thi / Kết quả / Tổng quan) | 1508 / 1510 / 1508 ms | 1 / 2 / 2 ms |
| Chưa có đệm: thứ đầu tiên hiện (trước: vòng quay; sau: khung xương) | 1–3 ms (vòng quay "Đang tải…") | 1–2 ms (khung xương) |
| Tải lại trang chủ đã đăng nhập: nội dung hiện / POST | 1842 ms / `publicConfig, listExams, myResults` | 61 ms (từ đệm) / `bootstrap` (TC-1.3: 1 POST; lần đầu chưa có `ld_pub` thì thêm 1 `publicConfig`) |
| Như trên, máy chủ 1.0.0 (`SERVER_COMPAT`) với giao diện mới | — | 48 ms / `listExams, myResults` (biết trước máy chủ cũ nhờ `ld_pub`, không thử `bootstrap`); chuyển màn học sinh đã có đệm 1–2 ms |

Với máy chủ cũ 1.0.0, phần đệm trình duyệt vẫn chạy (chuyển màn tức thì); chỉ `bootstrap` và đệm máy chủ cần máy chủ mới.

### Chỗ lệch đặc tả + lý do
1. **Mảnh đệm ≤ 90 000 byte UTF-8 (đặc tả: ≤ 90 000 ký tự)** và ngưỡng "không đệm" là 900 000 byte. Tiếng Việt có dấu chiếm 2–3 byte/ký tự; 90 000 ký tự có thể vượt 100 KB của CacheService. Đếm byte chặt hơn nên vẫn thỏa "≤ 90 000 ký tự".
2. **`opts.fresh` nạp lại `MEMO_`** bằng bản vừa đọc (đặc tả chỉ nói "không dùng MEMO_ cũ"). Để mọi lần đọc sau trong cùng request ghi (vd `checkPin_` trong `changePin`) dùng bản mới nhất. Lần đọc fresh không cất vào CacheService (chưa đọc gen trước nên không bảo đảm thứ tự).
3. **Đọc mảnh bằng 2 lần `getAll`**: lần 1 lấy khóa đầu + mảnh 0 (đa số bảng chỉ 1 mảnh), lần 2 chỉ khi có > 1 mảnh. Đúng "đọc mảnh bằng getAll", ít lần gọi Cache hơn.
4. **`updateRow_`/`deleteRows_` báo lỗi cả khi tìm lại thấy > 1 hàng trùng khóa** (đặc tả chỉ nói "không thấy"); và thiếu tham số ô khóa cũng báo lỗi. An toàn hơn: không đoán hàng.
5. **Sau nộp bài làm mới ngầm cả `stats`** (gọi `myStats`), không chỉ xóa — để màn Thống kê vẫn có bản lưu khi mất mạng ngay sau đó (TC-1.14).
6. **Đăng nhập cũng xóa `ld_c_*`** (đặc tả chỉ yêu cầu khi đăng xuất / AUTH): phòng máy dùng chung khi phiên trước bị đóng mà không đăng xuất.
7. **`tests/e2e.js` được sửa** cho chế độ `SERVER_COMPAT=1.0.0` (đặc tả 00 §5.4 yêu cầu chạy e2e hai lần và bỏ qua bước dùng tính năng mới). Chế độ máy chủ mới giữ nguyên các bước cũ.
8. **`onEdit` + CacheService trong trigger đơn giản: chưa xác minh được trên Apps Script thật** (không truy cập được script.google.com). Theo tài liệu Google, trigger đơn giản không dùng được dịch vụ *cần cấp quyền*; CacheService không cần phạm vi quyền nên dự kiến chạy được. Nếu không chạy, hậu quả chỉ là sửa ô trực tiếp thấy trễ tối đa 60 s — đã ghi trong README. Người kiểm thử Pha 6 (`kiemTraSauTrienKhai`/TC-6.7) nên thử: sửa 1 ô tên đề trên Sheet rồi tải lại trang ngay.
9. **Phép đo (c) dùng dev-server có trễ cố định**, không phải máy chủ thật; số thật chờ TC-1.15a/TC-6.7.

### Rủi ro còn lại
- Lần gọi đầu khi đệm máy chủ trống chậm hơn một chút (thêm ~3 lần gọi Cache/trang tính, cỡ vài chục ms) — đổi lại các lần sau không đọc Sheet.
- Trong ≤ 60 s sau khi giáo viên chèn/xóa/sắp xếp hàng trực tiếp trên Sheet (không gọi `onEdit`), web có thể **hiển thị** dữ liệu cũ; việc **ghi** vẫn đúng hàng (TC-1.12).
- Sau khi thầy dán máy chủ mới, máy nào đã lưu cấu hình cũ (`ld_pub`) sẽ thấy nút Đổi PIN/ô mục tiêu ở lần mở trang kế tiếp khi bản lưu đã quá 10 phút (cấu hình không được hỏi lại khi chuyển tab). Trang để mở liên tục nhiều giờ thì phải tải lại trang.
- `ld_last` (lớp + mã HS chọn lần trước ở màn đăng nhập) vẫn giữ sau đăng xuất như trước Pha 1 — chỉ là tiện ích chọn sẵn tên, không có điểm/PIN.
- `nextStudentId_` vẫn có thể dùng lại mã của học sinh **cuối danh sách** đã bị xóa (hành vi có từ trước; kết quả cũ trong KetQua sẽ gắn với học sinh mới cùng mã). Không thuộc phạm vi Pha 1; đề xuất xử lý ở pha sau.
- Các hàm render tách ra (`renderStats`, `renderBoard`, `renderExams`, `renderResults`) còn khối `{ … }` thừa để giảm diff — chỉ là hình thức.

### Việc giáo viên cần làm (cộng dồn cho Pha 6)
1. (Trước/trong Pha 1, nếu được) Đo số gốc TC-1.15a trên trang thật đang chạy máy chủ 1.0.0: mở trang học sinh trên điện thoại/máy tính, ghi thời gian chuyển tab và thời gian các lời gọi `listExams`, `myResults` (hoặc cho phép một phiên agent có mạng mở trang để đo).
2. Pha 6: dán toàn bộ `apps-script/Code.gs` (bản 1.2.0 trở lên), chạy `setup` một lần, Triển khai → Quản lý các bản triển khai → ✏ → **Phiên bản mới** → Triển khai (URL giữ nguyên). `onEdit` là trigger đơn giản, không cần cài thêm.
3. Sau Pha 6: thử sửa một ô trên Sheet rồi tải lại trang web để xác nhận web thấy ngay (kiểm `onEdit`).

---

## Vòng 2 (người làm) — sửa theo `pha-1-soat.md` và `pha-1-kiem-thu.md`

### Đã sửa
| Mã | Sửa | File |
|---|---|---|
| **R-1** (Vừa) | Thêm "thẻ kho" `App.cacheToken()` = {kho hiện tại, số lần xóa đệm}. `cacheSet(key, d, tok)` bỏ qua nếu kho đã đổi (đăng xuất / người khác đăng nhập) hoặc đệm đã bị xóa sau khi lấy thẻ. Sau `submitExam` lấy thẻ **sau** khi xóa `home/history/stats`, rồi mới làm mới ngầm `bootstrap` và `myStats`. Đã rà mọi chỗ cất đệm ngầm: `loadHome` (cất `history`), `cached()`, `admin.js loadOverview` (cất `exams`). Tất cả đều dùng thẻ. | `common.js`, `app.js`, `admin.js` |
| **R-9** | Cùng cơ chế: `cacheDel` tăng số đếm, nên lời gọi bắt đầu trước khi giáo viên ghi (xóa đệm) không cất lại bản cũ. | `common.js` |
| **K-1** | Viên "Đang cập nhật…" chuyển xuống góc dưới bên trái (`left:12px; bottom:12px`), không còn che nút Đăng xuất / Đổi PIN ở khổ 390 px. Đã chụp kiểm: viên ở y≈803, nút Đăng xuất ở y 52–86. | `style.css` |
| **R-8** | Chỉ báo đếm theo từng màn (`viewId`). `newView()` ẩn ngay; chỉ hiện khi màn đang xem còn lời gọi chưa xong. Đã kiểm: sang màn làm bài khi Lịch sử đang cập nhật thì chỉ báo ẩn. | `common.js` |
| **R-2** | Đang hiện bản lưu mà máy chủ trả lỗi (không phải `AUTH`, không phải "Không có chức năng") thì giữ bản lưu và chỉ báo nhẹ "Chưa cập nhật được (…) — đang hiện dữ liệu đã lưu." Mất mạng vẫn báo như cũ. | `common.js` |
| **R-3** | `render(bản lưu)` ném lỗi thì xóa khóa đó, hiện khung xương và chờ dữ liệu mới. | `common.js` |
| **R-4** | Khóa đầu lưu `"số mảnh:độ dài chuỗi"`. Khi đọc, ghép mảnh xong phải đúng độ dài, không đúng thì coi là trượt đệm. Hai lần cất xen nhau không thể ghép thành bảng lai, trừ trường hợp cực hiếm hai bản dài bằng nhau từng ký tự; khi đó `JSON.parse` và việc so khóa cột vẫn chặn. Khóa đầu kiểu cũ (chỉ có số) bị coi là trượt. `APP_VERSION` giữ 1.2.0 vì chưa phát hành. | `Code.gs` |
| **R-5** | Thêm test: ô khóa ở hàng truyền vào không khớp thì `verifyRow_` tìm đúng hàng khác (sửa và xóa); các hàng còn lại không đổi. | `tests/cache.test.js` |
| **R-6** | Test "Chi phí giả" không còn so ms ở lần đọc đệm: khẳng định lần 2 không đọc trang tính nào. | `tests/cache.test.js` |
| **R-7** | README nói rõ `onEdit` **chưa được kiểm chứng** trên Apps Script thật (nếu không chạy thì trễ tối đa 1 phút), và trang luôn hiện bản lưu trước rồi mới cập nhật. | `README.md` |
| **K-3** | Trang quản trị: lỗi `AUTH:` thì vẽ lại màn đăng nhập sau khi nơi gọi đã xử lý lỗi (`setTimeout(route, 0)`), không còn hộp "Có lỗi…" đè lên. Đã kiểm: token sai chữ ký, mở `#/hoc-sinh` thì thấy màn đăng nhập, không có hộp lỗi. | `admin.js` |
| e2e | `tests/e2e.js` đọc cổng từ `PORT` (mặc định 8787). | `tests/e2e.js` |

**Không sửa K-2** (máy chủ 1.0.0, máy chưa từng lưu `ld_pub`: lần đầu thử `bootstrap` rồi mới dùng đường dự phòng, tốn thêm 1 vòng gọi). Muốn bỏ vòng này thì phải chờ `publicConfig` trước khi gọi `bootstrap`, mà như vậy *mọi* lần tải đầu với máy chủ mới đều chậm thêm 1 vòng. Đường hiện tại đúng 00 §5.2, chỉ xảy ra một lần mỗi máy, và sẽ hết sau Pha 6.

### Test mới
- `tests/common-cache.test.js` (5 test, chạy bằng Node với `window`/`localStorage`/`document` giả): R-1, R-9, R-2, R-3, R-8.
- `tests/pha1-r1.e2e.js` (Playwright, cần dev-server, `PORT`, `ADMIN_PW`): HS A nộp bài; giữ lại các lời gọi làm mới ngầm; A đăng xuất; HS B đăng nhập **không tải lại trang**; thả lời gọi của A. Kiểm: kho chỉ có khóa của B, Thống kê và Trang chủ của B không chứa dữ liệu của A. Đã xác nhận test **bắt được lỗi**: bỏ thẻ ở `cacheSet('stats')` thì test báo "Kho Thống kê của B chứa dữ liệu của A".

### Kết quả test vòng 2
| Lệnh | Kết quả |
|---|---|
| `node tests/backend.test.js` | 13/13 đạt |
| `node tests/importer.test.js` | đạt |
| `node tests/cache.test.js` | 17/17 đạt (thêm R-4, R-5) |
| `node tests/common-cache.test.js` | 5/5 đạt (mới) |
| `node tests/pha1-kiem-thu.test.js` (người kiểm thử) | 29/29 đạt |
| `node tests/pha1-kiem-thu.e2e.js all` (người kiểm thử, `LATENCY_MS=1500`) | TC-1.0, 1.1, 1.2, 1.3, 1.4, 1.9, 1.9b, 1.10, 1.11, 1.14 đều ĐẠT ở cả hai chế độ máy chủ; không sửa file này |
| `PORT=… node tests/e2e.js`, máy chủ mới / `SERVER_COMPAT=1.0.0` | đạt / đạt |
| `node tests/pha1-r1.e2e.js`, máy chủ mới / `SERVER_COMPAT=1.0.0` | đạt / đạt |
