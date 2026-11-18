# Pha 1 — Tăng tốc

## Mục tiêu
Chuyển tab gần như tức thì khi đã có dữ liệu; giảm số lần gọi máy chủ; giảm thời gian mỗi lần gọi bằng bộ nhớ đệm phía máy chủ. Có số đo trước/sau.

## Phạm vi
**Làm**
1. Bộ nhớ đệm trên trình duyệt kiểu "hiện ngay – cập nhật ngầm" (stale-while-revalidate) cho các trang đọc dữ liệu: học sinh (trang chủ, lịch sử, thống kê, bảng xếp hạng), quản trị (tổng quan, đề thi, học sinh, kết quả, bảng điểm, cài đặt).
2. Action gộp `bootstrap` (học sinh) và `adminBootstrap` (quản trị).
3. Bộ nhớ đệm máy chủ cho `readTable_()` bằng CacheService, chia mảnh, tự xóa khi ghi.
4. Hàm giữ ấm + hàm cài hẹn giờ; xóa đệm khi giáo viên sửa trực tiếp Sheet (trigger `onEdit` đơn giản).
5. Khung xương (skeleton) khi chưa có dữ liệu; chỉ báo nhỏ "đang cập nhật".
6. Hạ tầng đo: `tests/dev-server.js` thêm `LATENCY_MS` (trễ giả mỗi request) và `SERVER_COMPAT=1.0.0`.

**Không làm**: đổi giao diện/màu (Pha 5); lưu bài đang làm dở; service worker/offline; thay đổi chấm điểm.

## Thiết kế kỹ thuật

### API mới (Code.gs → 1.2.0)
| Action | Tham số | Kết quả |
|---|---|---|
| `publicConfig` (sửa) | — | thêm `features: ["bootstrap","cache"]`, `serverTime` |
| `bootstrap` | `token` | `{ me, pub, exams, results, stats, v }` — `exams` = kết quả `apiListExams_`, `results` = `apiMyResults_`, `stats` = `apiMyStats_` (có thể `null` nếu tốn > 1 s), `v` = chuỗi phiên bản dữ liệu |
| `adminBootstrap` | `token` | `{ me, overview, exams, students, settings, v }` (không gồm `adminResults` vì lớn; trang Kết quả gọi riêng) |
Cả hai đọc mỗi trang tính tối đa 1 lần (dùng `MEMO_`). Không trả đáp án/lời giải. Token hết hạn ⇒ lỗi `AUTH:` như cũ.

### Bộ nhớ đệm máy chủ
- Bọc trong `readTable_(name)`: trước khi gọi `getDataRange()`, thử `cacheGetTable_(name)`; sau khi đọc Sheet, `cachePutTable_(name, rows)`.
- Khóa: `tb_<name>_<gen>` với `gen` = số thế hệ lưu ở khóa `tbgen_<name>` (CacheService, 6 giờ). Mảnh: `tb_<name>_<gen>_<i>` + khóa đầu chứa số mảnh; mỗi mảnh ≤ 90 000 ký tự; ghi bằng `putAll`, đọc bằng `getAll`. Thời hạn mảnh 60 s (`CACHE_SECONDS`, đặt được trong CaiDat `THOI_GIAN_NHO_TAM`).
- Bảng tuần tự hóa > 900 KB ⇒ không đệm (đọc Sheet như cũ). Thiếu bất kỳ mảnh nào ⇒ coi như trượt đệm.
- Xóa đệm: `appendRows_`, `updateRow_`, `deleteRows_`, `replaceQuestions_` và `apiAdminSaveSettings_` tăng `tbgen_<name>` (không cần xóa từng mảnh). Hàm `onEdit(e)` đơn giản tăng thế hệ của trang tính vừa sửa (người làm xác minh CacheService chạy được trong trigger đơn giản; nếu không, ghi rõ và giới hạn trễ = 60 s).
- Trang `CaiDat` có MAT_KHAU_QUAN_TRI: được đệm (chỉ nằm trong CacheService của máy chủ), không bao giờ trả về giao diện.
- Không đệm: kết quả kiểm tra PIN/khóa sai (đã dùng cache riêng), `startExam`, `submitExam` (vẫn đọc qua `readTable_` nên hưởng đệm khi đọc; ghi xong thì thế hệ tăng).

### Giữ ấm
- `giuAm()`: đọc trước HocSinh, DeThi, CauHoi, CaiDat, KetQua vào đệm. `caiHenGio()`: xóa trigger `giuAm` cũ rồi tạo trigger mỗi 10 phút (chạy lại không sinh trigger trùng). `goHenGio()`: gỡ. Ước tính ≤ 15 phút/ngày quota trigger.
- Ghi chú: giữ ấm không bảo đảm hết "khởi động lạnh" của Apps Script; lợi ích chính là đệm luôn đầy.

### Giao diện (`common.js`, `app.js`, `admin.js`)
- `common.js` thêm `cached(key, loader, render, opts)`: đọc `localStorage` khóa `ld_c_<userId>_<key>` ⇒ gọi `render(data, {stale:true})` ngay; đồng thời gọi `loader()`; khi về, nếu JSON khác thì `render(newData, {stale:false})` giữ vị trí cuộn; lỗi mạng khi đã có dữ liệu ⇒ toast nhẹ, giữ dữ liệu cũ.
- Học sinh: sau đăng nhập/tải trang gọi `bootstrap` một lần, chia ra các khóa `home`, `history`, `stats`. Máy chủ cũ ⇒ dự phòng `Promise.all([listExams, myResults])` như hiện tại.
- Kích thước đệm ≤ 1 MB/người dùng; quá thì bỏ khóa cũ nhất. Đăng xuất (`logout`) xóa mọi khóa `ld_c_*`. Khóa có phiên bản giao diện (`ld_c_v1_`) để đổi định dạng thì bỏ đệm cũ.
- Sau `submitExam` thành công: xóa khóa `home`, `history`, `stats` rồi làm mới ngầm.
- Không đệm: `startExam`, câu hỏi khi đang làm bài, `getResult` của bài chưa được xem lời giải (đệm `getResult` được phép vì đó là dữ liệu đã được máy chủ cho phép hiện).
- Skeleton: lớp CSS `.skeleton` (khối xám nhấp nháy) cho thẻ đề/bảng; hiện khi không có đệm.
- Chuyển tab không gọi lại `publicConfig` nếu đã có `ld_pub` < 10 phút (vẫn làm mới ngầm khi tải trang).

### Tương thích máy chủ cũ
Toàn bộ phần giao diện chạy với 1.0.0 (dùng đệm trình duyệt + gọi API cũ). Chỉ `bootstrap`, đệm máy chủ, giữ ấm cần máy chủ mới.

## Tiêu chí nghiệm thu
Đo trên dev-server với `LATENCY_MS=1500` trừ khi ghi khác; trình duyệt Playwright Chromium, khổ 390×844.
- **TC-1.1** Đã có đệm: chuyển Trang chủ → Lịch sử → Thống kê → Trang chủ, mỗi lần nội dung chính hiện **< 300 ms** kể từ `hashchange` (trung vị 5 lần đo). Tương tự 4 tab quản trị.
- **TC-1.2** Chưa có đệm: skeleton hiện **< 150 ms** sau `hashchange`; không có màn hình trắng.
- **TC-1.3** Máy chủ mới: từ lúc tải trang học sinh đã đăng nhập đến khi trang chủ đầy đủ, số request POST = **1** (`bootstrap`) + tối đa 1 `publicConfig` ngầm. Trước Pha 1 ghi số đo gốc (hiện 3).
- **TC-1.4** Máy chủ cũ (`SERVER_COMPAT=1.0.0`): toàn bộ e2e hiện có đạt; không có lỗi console; không hiện thông báo "Không có chức năng".
- **TC-1.5** Đệm máy chủ (test Node có đếm số lần `getDataRange`): 2 request `listExams` liên tiếp trong 60 s (hai lần chạy, `MEMO_` đã xóa) ⇒ lần 2 không đọc Sheet DeThi/CauHoi/KetQua.
- **TC-1.6** Sau mỗi thao tác ghi (`submitExam`, `adminSaveExam`, `adminSaveStudent`, `adminDeleteResult`, `adminSaveSettings`, `changePin`), request đọc kế tiếp trả dữ liệu mới (không dữ liệu cũ) — 6 trường hợp.
- **TC-1.7** Chia mảnh: bảng KetQua giả 600 hàng (~1,2 KB/hàng) lưu/đọc lại giống hệt; shim từ chối giá trị > 100 KB/khóa (shim phải mô phỏng giới hạn này). Bảng > 900 KB không đệm nhưng kết quả vẫn đúng.
- **TC-1.8** Mất một mảnh (xóa tay trong shim) ⇒ đọc lại từ Sheet, kết quả đúng, không lỗi.
- **TC-1.9** Đăng xuất HS A, đăng nhập HS B trên cùng trình duyệt ⇒ không hiện bất kỳ dữ liệu nào của A (kiểm tra `localStorage` không còn khóa của A).
- **TC-1.10** Nộp bài xong quay về trang chủ: điểm mới hiện ngay (≤ 1 lần trễ mạng), không phải tải lại trang.
- **TC-1.11** Không khóa đệm nào trong `localStorage` chứa trường `dapAn`, `loiGiai` của đề chưa nộp (quét toàn bộ giá trị sau khi bắt đầu làm bài).
- **TC-1.12** `caiHenGio()` gọi 3 lần ⇒ đúng 1 trigger `giuAm` (shim giả lập `ScriptApp`).
- **TC-1.13** Mất mạng (Playwright offline) khi đã có đệm: các tab vẫn hiển thị dữ liệu cũ kèm thông báo nhẹ; không mất dữ liệu bài đang hiển thị.
- **TC-1.14** Báo cáo có bảng số đo trước/sau: thời gian chuyển tab, số request khi mở trang chủ, thời gian `listExams` lần 1/lần 2 trong shim (ms). (khuyến nghị) Sau Pha 6, đo lại trên máy chủ thật.
- **TC-1.15** Mọi test cũ đạt.

## Kế hoạch kiểm thử
- Node: `tests/pha1.test.js` (TC-1.5 → 1.8, 1.12) — mở rộng `gas-shim.js`: `getAll/putAll/removeAll`, giới hạn 100 KB, bộ đếm `getDataRange`, `ScriptApp` giả.
- E2E: `tests/e2e-pha1.js` (TC-1.1 → 1.4, 1.9 → 1.11, 1.13), chạy với `LATENCY_MS=1500` và `SERVER_COMPAT=1.0.0`. Đo bằng `performance.now()` trong trang + chờ selector nội dung.
- Ảnh: skeleton, trang chủ hiện từ đệm có chỉ báo "đang cập nhật", trang quản trị đề thi.

## Rủi ro & cách giảm
| Rủi ro | Giảm |
|---|---|
| Dữ liệu cũ hiển thị gây hiểu nhầm (đề vừa đóng vẫn hiện "Đang mở") | Luôn làm mới ngầm; `startExam` vẫn kiểm tra trên máy chủ; chỉ báo "đang cập nhật" |
| Giáo viên sửa Sheet trực tiếp, đệm cũ tới 60 s | `onEdit` tăng thế hệ; thời hạn ngắn; README ghi rõ |
| Đệm vượt 100 KB/khóa, lỗi ngầm | Chia mảnh + ngưỡng 900 KB + test TC-1.7 |
| Lớp 40 HS nộp cùng lúc, đệm bị tăng thế hệ liên tục | Chấp nhận; ghi vẫn qua `withLock_`; đọc trượt đệm chỉ chậm như hiện tại |
| Lộ dữ liệu trên máy dùng chung | Khóa theo userId, xóa khi đăng xuất (TC-1.9) |

## Việc giáo viên cần làm (gộp vào Pha 6)
Dán Code.gs; chạy `setup`; chạy `caiHenGio` một lần (cấp quyền "chạy khi bạn không có mặt"); Triển khai → Quản lý → Phiên bản mới.

## Ước lượng: **M**
