# Báo cáo Pha 6 — Phát hành (6a: chuẩn bị trước khi giáo viên dán Code.gs)

## Tóm tắt cho giáo viên (bản của người làm)
- Máy chủ bản cuối là **Code.gs 1.5.0**, gồm mọi thay đổi máy chủ của Pha 1, 2, 4. Thầy dán **một lần**.
- Việc của thầy nằm trong **`docs/VIEC-GIAO-VIEN.md`**: từng bước có ô ☐ để đánh dấu, chia 4 nhóm (dán code, kiểm trên trang thật cùng Claude, việc nội dung, dọn mã cũ sau 1 tháng).
- Có hàm mới **`kiemTraSauTrienKhai`**: thầy bấm ▶ Chạy sau khi triển khai, nhật ký báo ✅/⚠️/❌ từng mục. Hàm chỉ đọc, không sửa dữ liệu, không in mật khẩu.
- Đã thử `setup` trên một Sheet giả kiểu cũ (1.0.0): không ô cũ nào đổi, chỉ thêm cột ở cuối, thêm trang tính và dòng cài đặt. Chạy `setup` hai lần không tạo gì trùng.
- Sửa thêm 2 lỗi nhỏ khi tải file Word (thông báo tiếng Việt cho file hỏng; lấy đáp án từ "Câu 1. Lời giải: Chọn B." sau HẾT). README viết lại phần cài đặt, soạn đề, luyện tập, hiệu năng, giao diện.

---

## Người làm

### Bảng TC
| Mã | Mô tả | Kết quả | Bằng chứng |
|---|---|---|---|
| TC-6.1 | `APP_VERSION` mới; `doGet`, `publicConfig` (và `bootstrap`) trả đúng phiên bản, đủ `features` | **ĐẠT** | `tests/pha6.test.js` "TC-6.1": 1.5.0; `features` = `changePin, goal, bootstrap, cache, bank, practice`; `appsscript.json` không có `oauthScopes`; Code.gs không tạo trigger |
| TC-6.2 | Toàn bộ test các pha + test cũ đạt, hai chế độ máy chủ | **ĐẠT** | Bảng "Kết quả test" bên dưới |
| TC-6.3 | `setup()` trên Sheet giả kiểu 1.0.0: không mất hàng/cột, chỉ thêm (so từng ô cũ) | **ĐẠT** | `pha6.test.js` "TC-6.3": Sheet dựng bằng đúng Code 1.0.0 (`tests/fixtures/Code-1.0.0.gs`), thêm học sinh, 2 kết quả không có cột Mục tiêu, 1 cột riêng của giáo viên trong HocSinh, 1 trang tính riêng; so **từng ô cũ** trước/sau (> 100 ô); cột mới nằm sau cột riêng của giáo viên; giá trị CaiDat giáo viên đã sửa giữ nguyên; không gieo thêm học sinh/đề mẫu |
| TC-6.4 | `setup()` 2 lần: không trùng hàng CaiDat, trang tính, cột; `KetQuaLuyenTap` cùng định dạng số với `KetQua` | **ĐẠT** | `pha6.test.js` "TC-6.4": lần 2 không đổi ô nào; tên trang tính, tiêu đề cột, khóa CaiDat đều không trùng; định dạng số 6 cột (`0.00`, `0`) giống nhau ở KetQua và KetQuaLuyenTap, cả khi trang được tạo tự động lúc ghi lần đầu (shim thêm `_formats()` để đọc định dạng) |
| TC-6.5 | Quét repo: mật khẩu, PIN thật, email, id file thật, nội dung kho | **ĐẠT** (phần nội dung kho: xem chỗ lệch 3) | `node tests/scan-secrets.js`: 0 phát hiện; đã tự thử script bắt đúng 7 loại cài sẵn (email thật, id Drive, mật khẩu, PIN, `ADMIN_PW=`, id tài liệu quyết định ở file khác) và so nguyên văn với một file kho mẫu. Đã sửa: email giả `…@gmail.com` trong `tests/backend.test.js` và chỗ gợi ý ô email ở `admin.js` → `…@example.com` |
| TC-6.6 | README và `VIEC-GIAO-VIEN.md` khớp hành vi thật | **ĐẠT** với phần làm được trên shim (người kiểm thử làm lại) | Đã đi theo các bước trên shim/dev-server: dán code = nạp Code.gs mới vào Sheet cũ → `setup` → `kiemTraSauTrienKhai` → trang Cài đặt hiện "Phiên bản máy chủ 1.5.0" (ảnh 01, 02). Tên nút/nhãn trong tài liệu đối chiếu với `admin.js`/`app.js`. Bước trong giao diện Apps Script/Google (cấp quyền, Phiên bản mới, quay về phiên bản cũ) không làm được ở đây |
| TC-6.7 | (6b, cần giáo viên) đo trên máy chủ thật | — | Nhóm B1 trong `VIEC-GIAO-VIEN.md` |
| TC-6.8 | (6b, cần giáo viên) một lượt thi + một lượt luyện thật | — | Nhóm B2 |

### Đã làm
1. **`apps-script/Code.gs` 1.5.0**
   - Hàm `kiemTraSauTrienKhai()` (chạy tay): in phiên bản và `features`; kiểm 7 trang tính và cột tiêu đề (thiếu → ❌, trùng → ⚠️, số hàng); CaiDat đủ khóa / trùng khóa / mật khẩu trống (không in mật khẩu); `CauHoi` sắp hết số hàng đã định dạng (R-10 Pha 2) → ⚠️; mở thử kho nếu có `KHO_CAU_HOI_ID` (chỉ đọc hàng tiêu đề và số hàng, không in id); mở thử thư mục hình kho; trạng thái `CHO_LUYEN_TAP`; ghi/đọc/xóa **1 khóa** CacheService. Đọc thẳng Sheet, không cất bảng vào đệm. Trả `{loi, canhBao, dong}` và in nhật ký.
   - Ghi chú `TEN_GIAO_VIEN`: "chỉ dùng nội bộ, không hiển thị trên trang học sinh".
   - `features` giữ đủ 6 mục; không thêm `oauthScopes`; `setup()` không tạo trigger.
   - R-12, R-13 của Pha 2 đã sửa ở Pha 3/4 (`bankImageNames_`, `logout()`), không còn lỗi để lại.
2. **N-2 (Pha 3)** `assets/js/docx-reader.js`: không tin kích thước file tự khai. Giải nén từng đoạn (`internalStream`), đếm byte thật, vượt 30 MB (`document.xml`) hoặc tổng 60 MB thì dừng ngay: "File Word bất thường: khi giải nén quá lớn…". Mọi lỗi giải nén (vd "Bug : uncompressed data size mismatch") thành "File Word bị hỏng: dữ liệu nén không khớp…". Hình trong file cũng đọc qua đường này.
3. **N-3 (Pha 3)** `assets/js/importer.js`: sau "HẾT", phần cùng dòng "Câu 1. Lời giải: Chọn B." đi qua cùng xử lý với các dòng lời giải sau đó (bỏ nhãn "Lời giải:", nhận "Đáp án:"), nên lấy được đáp án B.
4. **Test**: `tests/pha6.test.js` (8 mục), `tests/scan-secrets.js`, 2 mục mới trong `tests/docx.test.js` (N-2, N-3 — đã xác nhận cả hai **bắt được lỗi** khi bỏ phần sửa). Cập nhật số phiên bản trong `bank.test.js`, `cache.test.js`, `pha4.test.js`, `pha4.e2e.js`.
5. **`docs/VIEC-GIAO-VIEN.md`** gom từ báo cáo Pha 1–5 (việc giáo viên, R-9/R-10 Pha 2, `onEdit`, CDN và hình của Pha 3, đo trang Luyện tập Pha 4, R-3/R-7 và 4 câu hỏi Pha 5, 31 câu kho lỗi, dọn mã dự phòng).
6. **README**: thêm mục Hiệu năng, "Khi cập nhật Code.gs" (gồm quay về phiên bản trước), cách 4 "Tải file lên", mục Luyện tập, mục Giao diện (màu, logo, cách thay logo); cập nhật số trang tính, cấu trúc thư mục, lệnh test.

### Mẫu nhật ký `kiemTraSauTrienKhai` (gas-shim, kho giả)
```
✅ Phiên bản máy chủ: 1.5.0 · tính năng: changePin, goal, bootstrap, cache, bank, practice
✅ HocSinh: đủ 8 cột, 1 hàng dữ liệu.
… (DeThi, CauHoi, KetQua, CaiDat, LuyenTap, KetQuaLuyenTap)
✅ CaiDat: đủ 13 dòng cài đặt.
✅ Mở được kho câu hỏi: trang "Kho câu hỏi" có 54 hàng, đủ cột cần đọc.
✅ Mở được thư mục hình của kho: "02. HÌNH VẼ".
✅ Luyện tập cho học sinh: đang TẮT (bật ở Cài đặt khi đã đưa câu vào luyện tập).
✅ Bộ nhớ đệm (CacheService): ghi/đọc thử được.
✅ TẤT CẢ ĐỀU ỔN. Mở trang quản trị → Cài đặt: phải thấy "Phiên bản máy chủ 1.5.0".
```
Trên Sheet cũ chưa chạy `setup`, nhật ký có dòng ❌ "Thiếu trang tính "LuyenTap". Hãy chạy hàm setup() một lần." và kết luận "❌ CÓ n LỖI cần sửa".

### File đổi
`apps-script/Code.gs`, `assets/js/docx-reader.js`, `assets/js/importer.js`, `assets/js/admin.js` (chỉ chữ gợi ý email), `README.md`, `docs/VIEC-GIAO-VIEN.md` (mới), `docs/bao-cao/pha-6.md` (mới), `docs/bao-cao/anh/pha-6/*` (mới), `tests/pha6.test.js` (mới), `tests/scan-secrets.js` (mới), `tests/gas-shim.js` (thêm `_formats()`), `tests/docx.test.js`, `tests/backend.test.js`, `tests/bank.test.js`, `tests/cache.test.js`, `tests/pha4.test.js`, `tests/pha4.e2e.js`, `tests/pha5.test.js`, `tests/pha5-kiem-thu.test.js`.

### Kết quả test (TC-6.2)
Chạy trên nhánh `pha-6-phat-hanh` (commit có Code.gs 1.5.0), ngày 20/11/2026. Ảnh của các e2e ghi ra thư mục nháp (không ghi đè ảnh các pha trước).

**Node**
| Lệnh | Kết quả |
|---|---|
| `backend.test.js` | 13/13 đạt |
| `importer.test.js` | đạt |
| `bank.test.js` | 30/30 đạt |
| `cache.test.js` | 17/17 đạt |
| `common-cache.test.js` | 5/5 đạt |
| `docx.test.js` (`LIBS_DIR`) | 29/29 đạt (thêm N-2, N-3) |
| `pha1-kiem-thu.test.js` | 29/29 đạt |
| `pha2-kiem-thu.test.js` | 31/31 đạt |
| `pha3-kiem-thu.test.js` | 17/17 nhóm đạt |
| `pha4-kiem-thu.test.js` | 33/33 đạt |
| `pha5-kiem-thu.test.js` | 27/27 đạt (sau khi sửa TC-5.14, chỗ lệch 1) |
| `pha4.test.js` | 22/22 đạt |
| `pha5.test.js` | 11/11 đạt (sau khi sửa TC-5.14) |
| `pha6.test.js` | 8/8 đạt |
| `scan-secrets.js` | sạch, 0 phát hiện |

**E2E** (mỗi lần chạy một dev-server khởi động mới; Playwright Chromium)
| Lệnh | Máy chủ mới | `SERVER_COMPAT=1.0.0` |
|---|---|---|
| `e2e.js` | đạt | đạt |
| `bank.e2e.js` | đạt | đạt |
| `docx.e2e.js` | đạt | đạt |
| `pha1-r1.e2e.js` | đạt | đạt |
| `pha1-kiem-thu.e2e.js all` (tự chạy 2 dev-server) | 57 ✓, 0 ✗ — 12/12 nhóm ĐẠT (cả hai chế độ) | ↔ |
| `pha2-kiem-thu.e2e.js all` | 16/16 nhóm đạt (cả hai chế độ) | ↔ |
| `pha3-kiem-thu.e2e.js all` | 23/23 nhóm đạt (cả hai chế độ) | ↔ |
| `pha4-kiem-thu.e2e.js all` | 22/22 nhóm đạt (mới, tắt luyện tập, 1.0.0) | ↔ |
| `pha4.e2e.js all` | tất cả đạt (cả hai chế độ) | ↔ |
| `pha5.e2e.js all` | tất cả đạt (cả hai chế độ) | ↔ |
| `pha5-kiem-thu.e2e.js all` (`MAIN_DIR` = worktree `origin/main`) | 17/17 nhóm đạt (cả hai chế độ); không có `FONTS_DIR`/`WIDE_DIR` nên bỏ phần phông tải thật và logo ngang (Pha 6 không đổi CSS/HTML) | ↔ |

### Ảnh (`docs/bao-cao/anh/pha-6/`, dev-server máy chủ mới)
- `01-cai-dat-phien-ban-1280.png`: trang Cài đặt, khung Dữ liệu ghi "Phiên bản máy chủ 1.5.0".
- `02-cai-dat-phien-ban-390.png`: như trên, khổ điện thoại.
- Kết quả `kiemTraSauTrienKhai` trên máy chủ thật: chờ giáo viên gửi (bước A6).

### Chỗ lệch đặc tả + lý do
1. **TC-5.14 trong `tests/pha5.test.js` và `tests/pha5-kiem-thu.test.js` được sửa**: hai test này đòi `git diff main -- apps-script/` rỗng, nên chắc chắn hỏng khi Pha 6 đổi Code.gs. Nay so đúng phần thay đổi của commit gộp Pha 5 (`4b14311^1..4b14311`); khi Pha 5 chưa gộp thì giữ cách cũ. Sửa file của người kiểm thử Pha 5 chỉ ở mục này.
2. **`setup()` không sửa ô ghi chú cũ** của dòng `TEN_GIAO_VIEN` trên Sheet thật (luật "chỉ thêm", TC-6.3). Chữ mới chỉ có với Sheet tạo mới; trang Cài đặt vốn đã hiện gợi ý đúng. Đưa vào bước A4 (tùy chọn).
3. **TC-6.5, nội dung kho**: không so được với kho thật ở đây (không xuất kho 10 239 hàng vào phiên). `scan-secrets.js` có chế độ `KHO_TEXT=<file ngoài repo>` để so nguyên văn (3 đoạn 60 ký tự mỗi câu); người kiểm thử hoặc điều phối có thể chạy với bản xuất cột "Nội dung câu hỏi". Repo chỉ chứa câu tự soạn (đề mẫu trong Code.gs, kho giả `tests/fixtures/kho-gia.js`).
4. **PIN trong test**: các PIN `0101`, `0503`… là của học sinh giả trong gas-shim/dev-server; `scan-secrets.js` chỉ cho phép PIN trong file `tests/` có dùng máy chủ giả. Ở mọi chỗ khác, PIN bị báo.
5. **`kiemTraSauTrienKhai` báo thêm** các mục ngoài đặc tả (trùng khóa CaiDat, mật khẩu trống, CauHoi sắp hết hàng, thư mục hình kho, trạng thái luyện tập) — đều chỉ đọc.
6. Đặc tả nêu cập nhật `docs/QUYET-DINH.md` và Google Doc: việc của điều phối khi gộp (người làm không chốt quyết định mới).

### Rủi ro còn lại
- Chưa chạy trên Apps Script thật: màn xin quyền, `kiemTraSauTrienKhai`, `onEdit`, thời gian đọc kho, CDN thư viện Word — đều trong nhóm B của `VIEC-GIAO-VIEN.md`.
- Máy đã lưu cấu hình cũ (`ld_pub`) thấy nút Đổi PIN/ô Mục tiêu sau khi tải lại trang (bản lưu quá 10 phút). Đã ghi ở bước A6.
- Dán nhầm/thiếu code: có sao lưu (A1), quay về phiên bản cũ (A7), và giao diện tự dùng đường dự phòng với máy chủ 1.0.0.
- V2-3 Pha 4 (câu bị ẩn lời giải vẫn hiện đúng/sai) đã được chấp nhận, không sửa.

---

## Vòng 2 (người làm) — sửa theo `pha-6-soat.md` và `pha-6-kiem-thu.md`

### Tóm tắt cho giáo viên
- Thêm bước **A0**: đo tốc độ trang đang chạy **trước** khi dán code, để có số so sánh.
- Sau khi triển khai, thầy chỉ cần bấm **F5** một lần là web nhận máy chủ mới (trước đây phải chờ tới 10 phút).
- Mỗi bài nộp có **mã bài không trùng**, kể cả khi cả lớp nộp cùng một giây.
- Lời nhắc: **không** gửi ảnh nhật ký của `setup` (có mật khẩu); chỉ gửi nhật ký `kiemTraSauTrienKhai`.
- Tên nút và tên file trong hướng dẫn đã sửa cho đúng giao diện. Máy chủ vẫn là **1.5.0** (chưa phát hành nên không tăng số).

### Đã sửa
| Mã | Sửa | File |
|---|---|---|
| R-1 / K-1 | Mẫu `ADMIN_PW` chỉ nhận giá trị thật (≥ 6 chữ/số ngay sau `=` hoặc dấu nháy). Không còn báo nhầm `` ` ``, `<mật khẩu>`, `$PW`, `(?!…` trong báo cáo soát/kiểm thử. Repo quét sạch, gồm cả hai báo cáo đó. | `tests/scan-secrets.js` |
| R-4 | PIN chỉ được miễn ở **11 file test liệt kê đích danh** (tự gieo học sinh giả); trong tài liệu chỉ miễn PIN mẫu `0101` (Học Sinh Mẫu) và `0503` (ví dụ README). Bắt thêm `ADMIN_PW="…"`, `process.env.ADMIN_PW \|\| '…'`, "PIN của em là …", "pin riêng: …", id Drive kiểu cũ `0B…`. Hai chuỗi ví dụ trong `pha-6-soat.md` được miễn đích danh (file + chuỗi). Ghi giới hạn (hàng dữ liệu dạng bảng không kèm email/PIN) ở đầu file. Test mới cài 10 mẫu vi phạm giả (mã hóa base64 để chính file test không bị quét ra) và 6 mẫu không phải vi phạm. | `tests/scan-secrets.js`, `tests/pha6.test.js` |
| N-1 | Mã bài thi = `KQ` + `yyMMddHHmmss` + **8 hex ngẫu nhiên** (`Utilities.getUuid`), kiểm trùng **trong khóa** (đọc thẳng cột Mã bài), trùng thì sinh mã khác. Mã bài luyện tập = `LT` + giờ + **16 hex** của mã lượt; kiểm "đã ghi" theo **mã bài + mã HS** (chỉ đọc ô Mã HS của hàng trùng mã). `getResult` ưu tiên hàng của chính học sinh. Mã cũ (`KQ` + 15 số, `LT` + 12 hex) vẫn đọc được. Test: 300 bài nộp liền nhau không trùng; mã cũ đọc được; mã đã có sẵn thì sinh mã khác. `cache.test.js` chạy 30 lần liền: 30/30 đạt. | `Code.gs`, `tests/pha6.test.js`, `tests/pha4.test.js` |
| K-2 | Bản lưu `ld_pub` là của máy chủ cũ (không có `features`) thì mỗi lần tải trang luôn hỏi lại `publicConfig`. Khi danh sách tính năng đổi: trang quản trị vẽ lại màn đang xem (trừ trình soạn đề có thay đổi chưa lưu); trang học sinh vẽ lại màn đang xem (trừ khi đang làm bài). Máy chủ mới thì không thêm request (bootstrap vẫn trả cấu hình). `pha6-kiem-thu.e2e.js`: "Ngân hàng dùng được ngay sau F5" và "Đổi PIN hiện sau đúng 1 lần F5" đều ĐẠT. | `assets/js/app.js`, `assets/js/admin.js` |
| K-3 | "Lưu cài đặt" tải lại `publicConfig` ngay (không chỉ xóa bản lưu); tab Ngân hàng giữ "Đưa vào luyện tập" và "Pool luyện tập". | `assets/js/admin.js` |
| R-8 | Bỏ `teacherName` khỏi `publicConfig` (giao diện không dùng: `grep` không còn chỗ nào). Test khẳng định không còn trường này. | `Code.gs`, `tests/pha6.test.js` |
| R-2 | Thêm **A0**: đo trên máy chủ 1.0.0 trước khi dán (trang chủ lần 1/lần 2, chuyển tab, máy tính + điện thoại, F12 Network nếu làm cùng Claude). B1 so với A0. | `docs/VIEC-GIAO-VIEN.md`, README |
| R-3 / N-3 | A3: nhật ký `setup` có mật khẩu — không chụp, không gửi. A6: chỉ gửi nhật ký `kiemTraSauTrienKhai`. README nhắc tương tự. | tài liệu |
| R-5 | Không sửa code (có từ 1.0.0). Thêm câu ở A3 về cột riêng của giáo viên có thể đổi cách hiển thị. | `docs/VIEC-GIAO-VIEN.md` |
| R-6 / K-5 | A2: file có thể tên `Mã.gs`, chỉ giữ một file .gs; tìm `APP_VERSION` bằng Ctrl+F (khoảng dòng 21). | tài liệu |
| R-7 / K-6 | A6: Lớp 12 → **Tạo ma trận** → **Thêm vào giỏ** → **Tạo đề (28 câu) →** → **Tên đề** → **💾 Lưu đề**; xóa bằng nút **Xóa** ở tab Đề thi. B3: **+ Tạo đề mới** → **⇪ Nhập nhanh từ Word / Excel** → **Tải file lên**. | tài liệu |
| R-9 | B6 thêm Lighthouse (khuyến nghị, TC-5.15). | tài liệu |
| K-4 | README Bước 1: "7 trang tính". | README |
| Hạ tầng | `tests/dev-server.js` đặt khóa ký phiên cố định theo cổng (`DEV_SECRET`, mặc định theo số cổng), giống Apps Script thật giữ Script Properties khi triển khai phiên bản mới. Nhờ vậy kịch bản "chuyển 1.0.0 → 1.5.0 trên cùng địa chỉ" của kiểm thử không phải đăng nhập lại. | `tests/dev-server.js` |

### Không sửa
- **R-5**: `setup` đặt định dạng chữ cho mọi cột (có từ 1.0.0). Chỉ ghi rủi ro và nhắc ở A3.
- **N-2**: lịch sử git còn 5 id Drive thật và 4 email giả cũ. Không viết lại lịch sử (trái 00 §4). HEAD sạch.

### Chỗ lệch vòng 2
1. `tests/pha6-kiem-thu.test.js` (của kiểm thử, không sửa) còn **2 mục báo KHÔNG ĐẠT** vì kiểm đúng câu chữ cũ đã sửa: "README ghi 5 trang tính" đòi đúng 5 trang (nay README ghi 7); "A2 dòng đầu có APP_VERSION" đòi dòng 1 của Code.gs (nay tài liệu bảo tìm bằng Ctrl+F). Cả hai là lỗi tài liệu K-4, K-5 **đã sửa**; người kiểm thử cần cập nhật hai mục này ở vòng 2.
2. `tests/pha4.test.js` mục "Vòng 2 R-5": giả lập hàng trùng mã bài của học sinh khác. Nay máy chủ coi đó là bài khác (kiểm theo mã bài + mã HS) nên ghi bài của HS0001 riêng. Đã sửa kỳ vọng của test cho đúng hành vi mới.
3. `setup` vẫn in mật khẩu (giữ hành vi 1.0.0 để thầy lấy mật khẩu lần đầu); giảm rủi ro bằng lời nhắc trong tài liệu.

### Kết quả test vòng 2
KẾT_QUẢ_VÒNG_2

### Rủi ro còn lại (bổ sung)
- **R-5**: cột riêng của giáo viên có thể đổi cách hiển thị sau `setup`.
- **N-2**: id Drive thật còn trong lịch sử git (repo công khai thì xem được id, nhưng mở file vẫn cần quyền Drive của thầy).
- Trên máy chủ 1.0.0 (trước khi dán), mỗi lần tải trang tốn thêm 1 lời gọi `publicConfig` (để nhận ra ngay khi máy chủ được cập nhật). Hết sau khi triển khai 1.5.0.
