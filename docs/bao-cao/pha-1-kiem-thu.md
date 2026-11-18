# Pha 1 — Kiểm thử độc lập

Người kiểm thử (độc lập), ngày 18/11/2026, nhánh `pha-1-tang-toc` (sau commit `b09d727` của người làm).
Kịch bản viết theo `docs/spec/pha-1-tang-toc.md` **trước** khi đọc code tính năng. Code tính năng chỉ được đọc sau đó, để chẩn đoán.

## Tóm tắt
- **16 TC ĐẠT** (TC-1.0 → 1.14, 1.15b, 1.16), **0 KHÔNG ĐẠT**, **2 KHÔNG KIỂM ĐƯỢC TẠI ĐÂY**: TC-1.15a và TC-1.15c cần máy chủ Google thật.
- Có đệm thì chuyển màn mất 1–9 ms (ngưỡng 300 ms). Chưa có đệm thì khung xương hiện sau 1–4 ms (ngưỡng 150 ms), không lần nào màn hình trắng.
- Tải trang chủ khi đã đăng nhập: 3 POST giảm còn **1 POST `bootstrap`**. Số lần đọc Sheet trong luồng mẫu: **68 → 5** (gas-shim).
- Với máy chủ 1.0.0, học sinh vẫn đăng nhập, làm bài, nộp bài và xem kết quả được. Nút Đổi PIN và ô mục tiêu điểm bị ẩn. Không có lỗi đỏ hay lỗi console.
- Lỗi tìm thấy: 1 lỗi giao diện nhẹ (K-1) và 2 nhận xét không chặn pha (K-2, K-3).

## Cách chạy
```
node tests/pha1-kiem-thu.test.js                       # máy chủ (gas-shim), 29 kiểm thử
NODE_PATH=$(npm root -g) LIBS_DIR=<node_modules có katex, chart.js> LATENCY_MS=1500 \
  node tests/pha1-kiem-thu.e2e.js all                  # giao diện: tự bật dev-server mới (PORT_NEW, mặc định 8790)
                                                       # và SERVER_COMPAT=1.0.0 (PORT_OLD, mặc định 8791)
```
Lần chạy dùng cho báo cáo này: `LATENCY_MS=1500`, `PORT_NEW=8792`. Cổng 8790 đang bị chiếm bởi một dev-server thăm dò do chính người kiểm thử bật trước đó, và không được phép dừng tiến trình này. Chromium mở ở khổ 390×844 (học sinh) và 1280×800 (giáo viên), deviceScaleFactor 1. Các request tới CDN được chặn hoặc giả lập giống `tests/e2e.js`.
Hạ tầng test (`gas-shim.js`, `dev-server.js`) **không sửa gì**.

## Bảng tiêu chí
| Mã | Mô tả ngắn | Kết quả | Bằng chứng |
|---|---|---|---|
| TC-1.0 | Ẩn/hiện nút Đổi PIN và ô mục tiêu theo máy chủ | **ĐẠT** | e2e: máy chủ mới → `#btnPin` hiện, có ô mục tiêu `[data-goal]`; 1.0.0 → cả hai bị ẩn (kể cả khi chưa có `ld_pub`). Máy chủ: `publicConfig.features` = 4 cờ; fixture 1.0.0 không có `features`. Ảnh 03, 04 |
| TC-1.1 | Có đệm: nội dung chính < 300 ms (trung vị 5 lần) | **ĐẠT** | HS: Trang chủ 1,1 · Lịch sử 1,5 · Thống kê 7,0 · Xếp hạng 2,1 ms. GV: Tổng quan 1,9 · Đề thi 1,4 · Kết quả 2,0 ms. Máy chủ 1.0.0: 1,1–6,9 ms |
| TC-1.2 | Chưa có đệm: khung xương < 150 ms, không màn trắng | **ĐẠT** | Khung xương HS 1,1–1,7 ms, GV 1,3–1,7 ms; 0 khung trống; nội dung về sau ≈1 510 ms. Tải lại trang không có đệm: khung xương ở 53 ms tính từ lúc bắt đầu điều hướng. Ảnh 01, 07 |
| TC-1.3 | Tải trang chủ đã đăng nhập = 1 `bootstrap` (+ ≤ 1 `publicConfig`) | **ĐẠT** | Có đệm: `{bootstrap:1}`, hiện sau 68 ms. Xóa đệm, giữ `ld_pub`: `{bootstrap:1}`, 1 572 ms. Xóa cả `ld_pub`: `{publicConfig:1, bootstrap:1}`. **Số gốc trước Pha 1** (giao diện + máy chủ ở `main` 238bc32): `publicConfig, listExams, myResults` = 3 POST; về Trang chủ: 2 POST |
| TC-1.4 | Máy chủ 1.0.0: e2e chạy hết, nút bị ẩn, không lỗi | **ĐẠT** | `tests/e2e.js` với `SERVER_COMPAT=1.0.0` đạt. `pha1-kiem-thu.e2e.js`: đăng nhập, làm bài, nộp (5,56), về trang chủ, xem 4 màn, đăng xuất rồi đăng nhập lại, 3 tab quản trị; 0 toast đỏ, 0 lỗi console, không hiện "Không có chức năng". Trang quản trị có ghi chú "Cần cập nhật máy chủ". Ảnh 04, 08 |
| TC-1.5 | 2 lần `listExams` < 60 s → lần 2 không đọc DeThi/CauHoi/KetQua | **ĐẠT** | `TC-1.5` (lần 2 đọc 0 lần `getDataRange`); bổ sung: sau 61 s thì đọc lại Sheet |
| TC-1.6 | Sau mỗi thao tác ghi, lần đọc kế tiếp trả dữ liệu mới | **ĐẠT** | Đã làm nóng đệm trước khi ghi. Kiểm 6 thao tác `submitExam`, `adminSaveExam` (sửa + tạo), `adminSaveStudent` (thêm + sửa), `adminDeleteResult`, `adminSaveSettings`, `changePin`. Kiểm thêm `adminDeleteStudent`, `adminImportStudents`, `adminDeleteExam` |
| TC-1.7 | Chia mảnh 600 hàng ~1,2 KB; giới hạn 100 KB; > 900 KB không đệm | **ĐẠT** | Bảng ASCII 717 KB → 9 mảnh, mỗi mảnh ≤ 90 000 ký tự, đọc lại giống hệt, lần 2 đọc Sheet 0 lần. Bảng tiếng Việt ~1,2 KB UTF-8/hàng: được đệm, mảnh ≤ 100 KB byte. Shim từ chối > 100 KB (`put`, `putAll`, kể cả chữ có dấu 3 byte). Bảng > 900 KB: không có mảnh, `adminResults` vẫn đúng 801 hàng, vẫn ghi được |
| TC-1.8 | Xóa tay 1 mảnh / xóa `tbgen_*` → đọc Sheet, đúng, thế hệ mới | **ĐẠT** | Thiếu 1 mảnh → đọc lại Sheet. Xóa `tbgen_KetQua` 6 lần (mỗi lần sửa tay Sheet trước): luôn thấy dữ liệu mới, 7 thế hệ đều khác nhau, mảnh cũ không bị dùng lại |
| TC-1.9 | Đăng xuất HS A, đăng nhập HS B: không còn khóa và dữ liệu của A | **ĐẠT** | Sau khi đăng xuất chỉ còn `ld_pub, ld_pub_t, ld_last`. Khi B đăng nhập, đã theo dõi từng thay đổi DOM: không lần nào thoáng hiện điểm hay lời chào của A; Trang chủ, Lịch sử, Thống kê của B sạch. Token sai chữ ký (AUTH) → về màn đăng nhập, `ld_c_*` bị xóa |
| TC-1.9b | GV: sau đăng xuất / AUTH, kho lưu không có PIN, không có `ld_lastResult` | **ĐẠT** | Trong phiên (đã mở Học sinh, Kết quả, Xem bài) không khóa nào chứa `"pin"` hay PIN; đệm quản trị nằm trong `sessionStorage`. Sau đăng xuất và sau AUTH: không còn `ld_c_*` hay `ld_lastResult` |
| TC-1.10 | Nộp xong về trang chủ: điểm mới hiện, không tải lại trang | **ĐẠT** | Điểm 5,56 hiện sau 1 223 ms (LATENCY 1 500); trang không tải lại (biến đánh dấu trong `window` còn nguyên); Lịch sử có bài ngay. Máy chủ 1.0.0 cũng đạt |
| TC-1.11 | Đang làm bài: localStorage không chứa `dapAn` / `loiGiai` | **ĐẠT** | Quét toàn bộ `localStorage` + `sessionStorage` lúc đang làm bài, ở cả hai chế độ: 0 khóa |
| TC-1.12 | Ghi an toàn sau khi sửa tay Sheet | **ĐẠT** | (a) xóa tay 1 hàng HocSinh, HS khác `changePin` → chỉ ô PIN của đúng HS đổi, mọi hàng khác giữ nguyên. Kiểm thêm `adminSaveStudent` và `adminDeleteStudent` sau khi xóa tay: đúng hàng. (b) chèn 1 hàng lên đầu KetQua → `adminDeleteResult` xóa đúng bài. (c) xóa tay + thêm tay hàng (không gọi onEdit) → `adminSaveStudent` và `adminImportStudents` không sinh Mã HS trùng |
| TC-1.13 | Tranh chấp: B ghi giữa lúc A đọc và cất đệm | **ĐẠT** | Hai cách: (1) giả lập B ghi + đặt `gen` mới ngay sau `getValues` của A; (2) gọi `adminDeleteResult` thật chen vào giữa request `myResults` của A. Lần đọc sau đều thấy dữ liệu của B |
| TC-1.14 | Ngoại tuyến khi đã có đệm: vẫn hiển thị, có thông báo nhẹ | **ĐẠT** | HS 4 màn và GV 3 tab hiện sau 1–9 ms. Toast thường (không đỏ): "Mất kết nối — đang hiện dữ liệu đã lưu trên máy." Ảnh 05 |
| TC-1.15a | Số gốc trên máy chủ thật 1.0.0 | **KHÔNG KIỂM ĐƯỢC TẠI ĐÂY (cần giáo viên)** | Không có quyền mở trang thật / Apps Script thật |
| TC-1.15b | Shim `SHEET_READ_MS`: số lần đọc Sheet trước/sau | **ĐẠT** | `pha1-kiem-thu.test.js`: 8 bước × 2 vòng, **68 → 5** lần đọc. `measure-pha1.js backend` (dữ liệu cỡ lớp thật): **76 → 5** lần đọc, 22 971 → 4 353 ms tuần tự, 28 → 24 request |
| TC-1.15c | Đo lại trên máy chủ thật (TC-6.7) | **KHÔNG KIỂM ĐƯỢC TẠI ĐÂY (cần giáo viên)** | Thuộc Pha 6 |
| TC-1.16 | Mọi test cũ đạt | **ĐẠT** | Xem mục "Test cũ" |

## Số đo (dev-server, LATENCY_MS=1500, Chromium 390×844)
| Số đo | Trước Pha 1 (`main`) | Sau Pha 1 |
|---|---|---|
| POST khi tải trang chủ đã đăng nhập | 3 (`publicConfig, listExams, myResults`) | 1 (`bootstrap`) |
| Chuyển sang màn đã có đệm (trung vị) | ≈ 1 latency/màn (mỗi màn 1–2 POST chờ máy chủ) | 1,1–7,0 ms (HS), 1,4–2,0 ms (GV) |
| Khung xương khi chưa có đệm | không có (vòng xoay `loading`) | 1,1–1,7 ms |
| Tải lại trang chủ có đệm → nội dung đầy đủ | — | 68 ms |
| Nộp bài → trang chủ có điểm mới | — | 1 223 ms |
| Lần đọc Sheet (gas-shim, luồng mẫu 2 vòng) | 68 | 5 |

## Lỗi và nhận xét
| Mã | Mức | Mô tả | Cách tái hiện | Chẩn đoán |
|---|---|---|---|---|
| K-1 | Nhẹ | Trên điện thoại, viên "Đang cập nhật…" đè lên nút **Đăng xuất** suốt thời gian làm mới ngầm (~1 latency) | Khổ 390×844, đã có đệm, chuyển sang một màn bất kỳ. Xem ảnh `02-dang-cap-nhat.png` | `.sync-pill { position: fixed; top: 64px; right: 12px }` trong `assets/css/style.css`. Ở khổ hẹp, thanh trên xuống 2 dòng nên vị trí 64 px trùng hàng nút. `pointer-events:none` nên bấm vẫn được, chỉ bị che chữ |
| K-2 | Nhận xét | Máy chủ 1.0.0, lần đầu chưa có `ld_pub`: trang chủ gọi `publicConfig` và `bootstrap` song song. `bootstrap` thất bại, sau đó mới gọi `listExams, myResults`, nên mất 2 vòng gọi máy chủ. Không hiện lỗi | Xóa `ld_pub*` và `ld_c_*`, tải lại trang (SERVER_COMPAT=1.0.0) | `canTry('bootstrap')` trả true khi chưa có `ld_pub` (`common.js`). Hợp với 00 §5.2. Chỉ xảy ra một lần cho mỗi máy |
| K-3 | Nhận xét (có từ trước Pha 1) | Quản trị: token hết hạn khi đang mở tab không có đệm (vd Học sinh) thì hiện "Có lỗi: Phiên đăng nhập đã hết hạn… [Tải lại]" kèm toast đỏ, không tự về màn đăng nhập. Chuyển tab thì về màn đăng nhập. Kho lưu đã được xóa đúng | Đăng nhập GV, sửa `ld_admin_token` cho sai chữ ký, vào `#/hoc-sinh` | `errorBox` trong `admin.js` có từ `main`, không thuộc phạm vi Pha 1 |

Ghi chú thêm (không phải lỗi):
- Sau khi nộp bài, `ld_lastResult` có thể chứa đáp án khi đề cho xem lời giải. Khóa này có từ trước Pha 1 và bị xóa khi đăng xuất hoặc gặp AUTH. TC-1.11 chỉ xét lúc đang làm bài, và lúc đó kho lưu sạch.
- `ld_last` (lớp + mã HS chọn lần trước) vẫn còn sau đăng xuất, đúng như người làm đã ghi. Khóa này không chứa điểm hay PIN.
- Nếu `ld_token` bị hỏng (không phải JSON), trang coi như chưa đăng nhập và **không** gửi request, nên `ld_c_*` của người trước còn lại. Khi người kế tiếp đăng nhập thì các khóa này mới bị xóa (người làm đã làm xóa khi đăng nhập). Không vi phạm TC.
- TC-1.7: người làm đo mảnh và ngưỡng 900 KB theo **byte UTF-8**, chặt hơn "ký tự" trong đặc tả, nên an toàn với giới hạn 100 KB của CacheService. Hệ quả: bảng 600 hàng × ~1,2 K **ký tự** tiếng Việt (≈ 1,07 MB UTF-8) sẽ không được đệm, nhưng kết quả vẫn đúng.

## Test cũ (TC-1.16)
| Lệnh | Kết quả |
|---|---|
| `node tests/backend.test.js` | 13/13 đạt |
| `node tests/importer.test.js` | đạt |
| `node tests/cache.test.js` (người làm) | 15/15 đạt |
| `tests/e2e.js`, máy chủ mới | đạt |
| `tests/e2e.js`, `SERVER_COMPAT=1.0.0` | đạt |
| `node tests/pha1-kiem-thu.test.js` | 29/29 đạt |
| `tests/pha1-kiem-thu.e2e.js all` (LATENCY 1500) | 10/10 nhóm TC đạt |

`tests/e2e.js` gắn cứng cổng 8787, nên được chạy bằng một bản sao trong thư mục nháp, chỉ thay `BASE` sang cổng 8792/8791. Nội dung kiểm thử giữ nguyên.

## Ảnh (`docs/bao-cao/anh/pha-1/`)
| Ảnh | Nội dung |
|---|---|
| `01-khung-xuong-hoc-sinh.png` (390×844) | Màn Thống kê chưa có đệm: khung xương |
| `02-dang-cap-nhat.png` (390×844) | Trang chủ hiện từ đệm, có viên "Đang cập nhật…" (thấy luôn K-1) |
| `03-trang-chu-may-chu-moi.png` (390×844) | Máy chủ mới: có nút Đổi PIN |
| `04-trang-chu-may-chu-cu.png` (390×844) | Máy chủ 1.0.0: không có nút Đổi PIN |
| `05-ngoai-tuyen.png` (390×844) | Ngoại tuyến: Thống kê hiện từ đệm, kèm thông báo mất kết nối |
| `06-qt-tong-quan.png` (1280×800) | Quản trị: Tổng quan |
| `07-qt-khung-xuong.png` (1280×800) | Quản trị: tab Kết quả chưa có đệm, khung xương |
| `08-qt-may-chu-cu.png` (1280×800) | Quản trị với máy chủ 1.0.0: ghi chú "Cần cập nhật máy chủ (bước phát hành)" |

## Kết luận
Mọi TC bắt buộc kiểm được tại đây đều **ĐẠT**. TC-1.15a và TC-1.15c cần giáo viên đo trên máy chủ thật (pha con 6b). Nên sửa K-1 (một dòng CSS) trước khi gộp. K-2 và K-3 không chặn pha.

## Vòng 2 (sau commit `b4dda85`)

Ngày 18/11/2026. Đã chạy lại **toàn bộ** kiểm thử trên `b4dda85`. Không sửa hạ tầng test.
`tests/pha1-kiem-thu.e2e.js` có thêm 2 kiểm tra hồi quy:
- **K-1**: khung bao của viên "Đang cập nhật…" ở khổ 390 px không được chạm bất kỳ nút, liên kết hay `h1` nào.
- **K-3**: giáo viên gặp AUTH ở tab không có đệm (`#/hoc-sinh`) thì phải hiện ô `#pw`.

Lần chạy: `LATENCY_MS=1500`. Máy chủ mới ở cổng 8790, `SERVER_COMPAT=1.0.0` ở cổng 8791. `tests/e2e.js` chạy ở cổng 8792 (máy chủ mới) và 8793 (1.0.0). `pha1-r1.e2e.js` chạy ở cổng 8792 với một dev-server mới. Mọi dev-server đã tắt khi xong.

### Bảng TC (vòng 2)
| Mã | Kết quả | Bằng chứng vòng 2 |
|---|---|---|
| TC-1.0 | **ĐẠT** | Máy chủ mới: nút Đổi PIN và ô mục tiêu điểm hiển thị. Máy chủ 1.0.0: cả hai bị ẩn, kể cả khi chưa có `ld_pub` |
| TC-1.1 | **ĐẠT** | HS: 1,2 / 6,7 / 1,9 / 1,3 ms. GV: 1,8 / 1,9 / 2,2 ms. Máy chủ 1.0.0: 1,2–6,5 ms |
| TC-1.2 | **ĐẠT** | Khung xương sau 1,1–1,8 ms; không có khung trống. Tải lại trang: khung xương ở 48 ms |
| TC-1.3 | **ĐẠT** | `{bootstrap:1}` (hiện sau 66 ms). Khi không có `ld_pub`: `{publicConfig:1, bootstrap:1}` |
| TC-1.4 | **ĐẠT** | `e2e.js` chạy với `SERVER_COMPAT=1.0.0` đạt. Không có toast đỏ, không có lỗi console, không hiện "Không có chức năng" |
| TC-1.5 → 1.8, 1.12, 1.13 | **ĐẠT** | `pha1-kiem-thu.test.js` đạt 29/29 |
| TC-1.9 / 1.9b | **ĐẠT** | Như vòng 1. GV gặp AUTH: kho lưu sạch và về màn đăng nhập |
| TC-1.10 | **ĐẠT** | Điểm mới hiện sau 1 230 ms, không tải lại trang |
| TC-1.11 | **ĐẠT** | 0 khóa chứa `dapAn`/`loiGiai`, ở cả hai chế độ |
| TC-1.14 | **ĐẠT** | HS 4 màn và GV 3 tab vẫn hiện, kèm toast "Mất kết nối…" |
| TC-1.15a / 1.15c | **KHÔNG KIỂM ĐƯỢC TẠI ĐÂY (cần giáo viên)** | — |
| TC-1.15b | **ĐẠT** | Số lần đọc Sheet: 68 → 5 |
| TC-1.16 | **ĐẠT** | Xem bảng test cũ bên dưới |

### Lỗi vòng 1
| Mã | Vòng 2 | Bằng chứng |
|---|---|---|
| K-1 | **Đã hết** | Viên chỉ báo đã chuyển xuống góc dưới bên trái và không che nút nào (kiểm tra tự động K-1 đạt; ảnh `02-dang-cap-nhat.png`). Còn một điểm thẩm mỹ rất nhẹ, không chặn pha: viên che một phần ô bảng nằm sát đáy màn hình trong ~1 s; khi ngoại tuyến, toast "Mất kết nối" đè lên viên (ảnh 05) |
| K-3 | **Đã hết** | Token sai chữ ký ở `#/hoc-sinh` → về ngay màn đăng nhập (`#pw`); `ld_c_*` và `ld_lastResult` đã xóa |
| K-2 | Không đổi (nhận xét) | Máy chủ 1.0.0, chưa có `ld_pub`: thứ tự gọi vẫn là `publicConfig, bootstrap, listExams, myResults` |

### Test cũ (vòng 2)
| Lệnh | Kết quả |
|---|---|
| `node tests/backend.test.js` | 13/13 đạt |
| `node tests/importer.test.js` | đạt |
| `node tests/cache.test.js` | 17/17 đạt |
| `node tests/common-cache.test.js` | 5/5 đạt |
| `PORT=8792 node tests/e2e.js` (máy chủ mới) | đạt |
| `PORT=8793 SERVER_COMPAT=1.0.0 node tests/e2e.js` | đạt |
| `PORT=8792 ADMIN_PW=… node tests/pha1-r1.e2e.js` | đạt |
| `node tests/pha1-kiem-thu.test.js` | 29/29 đạt |
| `tests/pha1-kiem-thu.e2e.js all` (LATENCY 1500) | 12/12 nhóm đạt (10 nhóm TC + K-1 + K-3) |

Lưu ý về `pha1-r1.e2e.js`:
- Test này cần `ADMIN_PW` và một dev-server **không có độ trễ**.
- Chạy với `LATENCY_MS=1500` thì hết giờ chờ ở `waitForSelector`. Đây là giới hạn của test, không phải lỗi tính năng.

### Ảnh
Đã chụp lại đủ 8 ảnh trong `docs/bao-cao/anh/pha-1/` và xem từng ảnh. Trong đó có 4 ảnh người làm đã ghi đè.
- Ảnh 01: hai tab "Trang chủ" và "Thống kê" cùng được tô. Lý do là chuột của Playwright vẫn nằm trên "Trang chủ" sau cú bấm trước (trạng thái hover), không phải lỗi.

### Kết luận vòng 2
Mọi TC kiểm được tại đây **ĐẠT**; K-1 và K-3 đã được sửa. Còn 2 TC cần giáo viên đo trên máy chủ thật (TC-1.15a, TC-1.15c).
