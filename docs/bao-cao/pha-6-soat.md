# Soát code Pha 6a — Phát hành (chuẩn bị trước khi giáo viên dán Code.gs)

Người soát: độc lập (không phải người làm). Nhánh `pha-6-phat-hanh` (commit `190d81e`), so với `main` (`4b14311`). Lệnh: `git diff main...pha-6-phat-hanh`. Ngoài diff, tôi đọc lại `apps-script/Code.gs` 1.5.0 như một bản phát hành (các hàm công khai, mọi lệnh gọi dịch vụ Apps Script, `setup`, `kiemTraSauTrienKhai`, đệm, ghi theo hàng).
Ngày: 20/11/2026.

## Tóm tắt cho giáo viên
- Code.gs 1.5.0 an toàn để thầy dán: không có lỗi cú pháp, chỉ dùng lệnh có thật của Google, không tạo hẹn giờ. `setup` chỉ thêm cột, trang tính và dòng cài đặt, chạy lại nhiều lần cũng không trùng. Hàm kiểm tra mới `kiemTraSauTrienKhai` chỉ đọc và không in mật khẩu.
- Hai lỗi file Word của Pha 3 đã sửa đúng. Tải đề Word vẫn chạy như cũ.
- Còn **2 việc vừa phải sửa trước khi gộp**, đều nhỏ và sửa nhanh. (1) Bài quét bí mật đang **báo đỏ** trên nhánh: chính báo cáo Pha 6 có một chữ làm bài quét báo nhầm. (2) Danh sách việc của thầy thiếu bước **đo tốc độ trang thật TRƯỚC khi dán code**. Dán code xong thì không đo lại được số gốc này nữa.
- Có vài ghi chú nhỏ về câu chữ trong hướng dẫn: tên nút, tên file trong Apps Script, và lời nhắc không gửi ảnh nhật ký `setup` vì nhật ký đó có mật khẩu.

## Kết luận: **CHƯA ĐẠT**
Không có phát hiện Nặng. Có 2 phát hiện Vừa (R-1, R-2), cả hai sửa trong vài phút, không cần đổi Code.gs. Có 7 phát hiện Nhẹ (R-3 … R-9). Sửa R-1 và R-2 xong thì đạt. Vòng 2 chỉ cần soát lại phần sửa và chạy `pha6.test.js`, `scan-secrets.js`.

## Đã kiểm

### 1. `apps-script/Code.gs` 1.5.0 (đọc như bản phát hành)
- **Cú pháp**: bọc cả file trong một hàm rồi chạy `node --check`: không lỗi. Không có `require`, `module`, `process`, `??`, `?.` hay trường `#private`. Không có hàm hay `var` nào khai báo trùng tên (Apps Script lấy bản khai báo sau cùng nên trùng tên rất nguy hiểm). `appsscript.json` dùng `runtimeVersion: V8`.
- **Hàm công khai** (hiện ở ô chọn hàm của trình soạn): `setup`, `kiemTraSauTrienKhai`, `doGet`, `doPost`, `onEdit`. Mọi hàm khác có đuôi `_` nên bị ẩn. `kiemTraSauTrienKhai` không có trong `ROUTES`, nên không ai gọi được hàm này từ web.
- **Dịch vụ Apps Script**: tôi liệt kê mọi lệnh gọi tới `SpreadsheetApp`, `DriveApp`, `CacheService` (`get`, `getAll`, `put`, `putAll`, `remove`), `LockService`, `PropertiesService`, `Utilities` (`base64EncodeWebSafe`, `base64DecodeWebSafe`, `base64Decode`, `computeHmacSha256Signature`, `newBlob`, `getUuid`, `formatDate`), `UrlFetchApp`, `MailApp`, `ContentService`, `Logger`. Lệnh nào cũng có trong Apps Script thật. Không lệnh nào chỉ có trong `gas-shim`. Các phương thức trên Range, Sheet, File, Folder (`getSheet`, `getDataAsString`, `getFolders`, `makeCopy`, `setSharing`, `deleteRow`, `clearContent`) cũng đều có thật.
- **Quyền**: `openById` (kho) và `DriveApp` (hình) cần quyền Sheets/Drive đầy đủ, `UrlFetchApp` (xác minh Google) và `MailApp` cũng cần quyền riêng. Không khai `oauthScopes`, nên Apps Script tự dò quyền từ toàn bộ file và xin quyền khi chạy bất kỳ hàm nào lần đầu (`setup`). Cách này đúng đặc tả. Không có `ScriptApp`, nên không tạo trigger. `onEdit` là trigger đơn giản.
- **`setup()` trên Sheet 1.0.0**: so với `tests/fixtures/Code-1.0.0.gs`, thân hàm giống hệt, chỉ khác ba chỗ: gọi thêm `bumpAllGens_` (chỉ ghi khóa đệm), áp định dạng số cho cả `KetQuaLuyenTap`, và có thêm trang tính/cột mới trong `SCHEMA`. Cột thiếu luôn được thêm vào **cuối** hàng tiêu đề. Dòng CaiDat chỉ thêm khóa còn thiếu. Học sinh mẫu và đề mẫu chỉ được gieo khi trang trống. Chỉ xóa trang tính mặc định khi trang đó trống. `pha6.test.js` TC-6.3 dựng Sheet bằng đúng Code 1.0.0, có cột và trang tính riêng của giáo viên, rồi so từng ô (> 100 ô): đạt. Chạy hai lần thì lần 2 không đổi ô nào (TC-6.4): đạt. Phần định dạng xem R-5.
- **Trong lúc thầy làm A2–A4**, web vẫn chạy bằng bản triển khai cũ 1.0.0, nhưng Sheet đã được `setup` thêm cột và trang tính. Máy chủ 1.0.0 đọc cột theo tên tiêu đề, nên không bị ảnh hưởng.
- **`kiemTraSauTrienKhai()`** (`Code.gs:147–220`):
  - Chỉ đọc hàng tiêu đề, `getLastRow`, `getMaxRows`.
  - CaiDat được đọc thẳng bằng `readSheet_` rồi đặt vào `MEMO_`. Vì vậy `getSetting_` không ghi đệm. `MEMO_.CaiDat = []` vẫn được coi là có (mảng rỗng vẫn là giá trị đúng), nên không đọc lại.
  - `readSheet_` không tự tạo trang tính tùy chọn: nhánh tạo trang chỉ nằm ở `sheet_`, và trang thiếu đã được chặn trước.
  - `bankOpen_` chỉ đọc. `DriveApp.getFolderById(...).getName()` chỉ đọc.
  - Việc ghi duy nhất là 1 khóa `kiemtra_xxxxxxxx` trong CacheService, sống 60 s và bị xóa ngay.
  - Hàm không in mật khẩu (chỉ báo khi mật khẩu trống), không in id hay email. Thông báo lỗi của `openById` và `getFolderById` trên Apps Script không chứa id. Tên thư mục hình ("02. HÌNH VẼ") được in ra, nhưng tên này không phải bí mật.
  - Test shim xác nhận: 0 lần ghi vào trang tính, 0 lần ghi vào kho, không còn khóa thử trong đệm.
- **`features`** đủ 6 mục `changePin, goal, bootstrap, cache, bank, practice`. `APP_VERSION = '1.5.0'`. `doGet`, `publicConfig`, `bootstrap.v` trả đúng số này (TC-6.1).
- **Tương thích ngược**: giao diện trên nhánh (gần như giống `main`, chỉ khác chữ gợi ý email, `docx-reader.js`, `importer.js`) chạy được với cả hai máy chủ. Tôi tự chạy `tests/e2e.js` trên cổng 8795 với máy chủ mới và với `SERVER_COMPAT=1.0.0`: cả hai đạt. `cache.test.js` có mục "Máy chủ 1.0.0 chạy được, không có features": đạt.

### 2. N-2, N-3 của Pha 3
- **N-2** (`docx-reader.js:496–526, 546–555, 801`):
  - `readLimited` đọc qua `internalStream`. JSZip tự giải mã UTF-8 nối qua ranh giới các đoạn (Utf8DecodeWorker), nên ghép bằng `join('')` vẫn đúng.
  - Hàm đếm số byte/ký tự thật và vượt giới hạn thì dừng ngay. Mọi lỗi giải nén được đổi thành thông báo tiếng Việt.
  - `budget` tổng 60 MB được trừ dần qua từng phần (kể cả hình). Hình là dữ liệu đã nén, nên file 10 MB không chạm ngưỡng này.
  - Khi không có `internalStream`, hàm dùng lại cách cũ.
  - `docx.test.js`: 29/29 đạt, có mục N-2. Tôi tự chạy `docx.e2e.js` (cổng 8795, máy chủ mới): ĐẠT.
- **N-3** (`importer.js:115–122, 161–163, 175`): phần còn lại trên dòng "Câu n." sau HẾT nay đi qua cùng hàm `solLine` với các dòng lời giải sau đó. Dòng chỉ có nhãn ("Lời giải:") không thêm gì. "Đáp án:" chỉ ghi đè khi câu chưa có đáp án. Đường dán văn bản cũ không đổi: `importer.test.js` và TC-3.13 trong `docx.test.js` đều đạt.

### 3. `tests/scan-secrets.js`
- Quét mọi file git theo dõi cộng file mới chưa bị `.gitignore` (bỏ file nhị phân). Tôi thử trong một repo tạm, cài sẵn các chuỗi giả:
  - **Bắt được**: "Mật khẩu quản trị: …", "mật khẩu là …", email gmail (cả trong `tests/`), id Drive 44 ký tự (trần và trong link `/d/…`), id tài liệu quyết định nằm sai file.
  - **Bỏ sót**: `ADMIN_PW="…"` (có dấu nháy), `process.env.ADMIN_PW || '…'`, "PIN của em là 1503", "pin riêng: 2807", một hàng học sinh thật dạng bảng (họ tên, ngày sinh, PIN; chỉ email bị bắt), id kiểu cũ `0B…`. Xem R-4.
  - **Báo nhầm**: `ADMIN_PW=` có dấu backtick đi sau (đây là nguyên nhân của R-1).
- **Ngoại lệ PIN** (`scan-secrets.js:29, 47`): mọi file trong `tests/` có chữ `dev-server` hoặc `localhost` ở bất kỳ đâu đều được miễn. Hiện 15/30 file test thỏa điều kiện này. Ngoại lệ rộng hơn mô tả "file dùng máy chủ giả" (xem R-4). Hiện tại không có PIN thật trong repo: PIN trong test là của học sinh giả do test tự gieo (`0101`, `0503`…).
- Ảnh PNG không được quét. Ảnh Pha 6 là trang Cài đặt trên dev-server, dùng mật khẩu ngẫu nhiên giả, nên không có vấn đề.

### 4. Sửa TC-5.14 (`pha5.test.js:261–268`, `pha5-kiem-thu.test.js:309–315`)
Hợp lệ. Pha 6 bắt buộc phải đổi Code.gs, nên điều kiện cũ "`git diff main -- apps-script/` rỗng" chắc chắn hỏng. Cách mới so đúng phần Pha 5 đã đưa vào `main` (`4b14311^1..4b14311`), tức vẫn kiểm đúng ý TC-5.14 "Pha 5 không đổi máy chủ". `4b14311` là commit gộp thật, nên `git log --merges --grep` tìm ra nó. Hai test đều đạt (11/11 và 27/27). Việc người làm sửa file của người kiểm thử Pha 5 đã được nêu ở chỗ lệch 1 và chỉ đụng đúng mục đó. Tôi chấp nhận. Nhãn test trong `pha5.test.js` vẫn ghi "git diff origin/main", nhưng chỉ là chữ.

### 5. README và `docs/VIEC-GIAO-VIEN.md`
- **Khớp với code**:
  - Khóa CaiDat (`KHO_CAU_HOI_ID`, `THU_MUC_HINH_KHO_ID`, `CHO_LUYEN_TAP`, `LUYEN_NHANH`, `TEN_GIAO_VIEN`), tên hàm (`setup`, `kiemTraSauTrienKhai`), 7 tên trang tính.
  - Cột mới: KetQua thêm "Mục tiêu"; CauHoi thêm 5 cột từ "Mã câu kho" (so với SCHEMA 1.0.0).
  - Nhãn giao diện: "Phiên bản máy chủ" trong khung "Dữ liệu", "Tên trang web", "Mục Luyện tập cho học sinh" (Bật/Tắt), "Đề nhanh theo bài", "Lưu cài đặt", "↻ Đọc lại kho", "Đưa vào luyện tập", "Pool luyện tập", nút "Tắt/Bật", "Tải file lên", "tối đa 10 MB", "3 000 câu đang bật", "Câu đã bị gỡ…", nhãn "đang thi".
  - Link kho/thư mục dạng URL được `idFromSetting_` nhận (`/d/…`, `/folders/…`).
  - Bước F5: `ld_pub` sống 10 phút và `bootstrap` cũng trả cấu hình, nên tải lại trang là đủ.
- **Đã gom đủ** từ báo cáo Pha 1–5: dán code, `setup`, cấp quyền, Phiên bản mới, `onEdit` (Pha 1), kho mà thầy mở được, R-9, R-10, 31 câu kho lỗi (Pha 2), CDN và hình (Pha 3), bật luyện tập, không xóa hàng `LuyenTap`, đo trang Luyện tập V2-1 (Pha 4), logo, 4 câu hỏi, R-3, R-7 (Pha 5), dọn mã dự phòng sau 1 tháng. Thiếu bước đo số gốc trước khi dán (R-2). Thiếu Lighthouse TC-5.15, nhưng mục này chỉ khuyến nghị (R-9).
- **Không lộ bí mật**: không có id kho/thư mục thật, mật khẩu, email hay học sinh thật. Tài liệu quyết định chỉ được nhắc bằng tên.

### 6. Test đã chạy lại (20/11/2026)
| Lệnh | Kết quả |
|---|---|
| `pha6.test.js` | **7/8 — TC-6.5 KHÔNG ĐẠT** (R-1) |
| `scan-secrets.js` | **1 phát hiện**: `docs/bao-cao/pha-6.md:21` (R-1) |
| `docx.test.js` (`LIBS_DIR`) | 29/29 |
| `backend.test.js` · `importer.test.js` | 13/13 · đạt |
| `bank.test.js` · `cache.test.js` · `common-cache.test.js` | 30/30 · 17/17 · 5/5 |
| `pha4.test.js` · `pha5.test.js` | 22/22 · 11/11 |
| `e2e.js` (8795) máy chủ mới / `SERVER_COMPAT=1.0.0` | đạt / đạt |
| `docx.e2e.js` (8795, máy chủ mới) | ĐẠT |

Tôi không chạy các e2e cố định cổng khác vì người kiểm thử đang chạy song song. Tôi dựa vào bảng kết quả của người làm.

## Phát hiện

| Mã | Mức | Vị trí | Vấn đề | Đề xuất |
|---|---|---|---|---|
| R-1 | **Vừa** | `docs/bao-cao/pha-6.md:21`; `tests/scan-secrets.js:41` | Trên commit cuối của nhánh, `node tests/scan-secrets.js` thoát mã 1 vì phát hiện ``ADMIN_PW=` `` trong chính báo cáo người làm. Kéo theo, `pha6.test.js` chỉ đạt 7/8. Báo cáo ghi "0 phát hiện" và "8/8 đạt" (TC-6.2, TC-6.5): hai con số này đúng trước commit báo cáo `190d81e`, nhưng nay sai. Nguyên nhân: lookahead `(?![<$.…\s'"])` không loại dấu backtick, nên đây là báo nhầm, không phải lộ bí mật. Nhánh phát hành đang có test đỏ. | Sửa regex: `ADMIN_PW=` phải theo sau bởi một giá trị thật, ví dụ `ADMIN_PW=(?![<$.…\s'"\`])\S+`, hoặc chỉ nhận `[A-Za-z0-9]{6,}`. Hoặc viết lại câu trong báo cáo. Chạy lại `pha6.test.js` và `scan-secrets.js`, rồi sửa bảng kết quả. |
| R-2 | **Vừa** | `docs/VIEC-GIAO-VIEN.md:55–57` (B1), thiếu bước trước A2 | TC-6.7 (bắt buộc) so số đo sau triển khai với "số gốc 1.0.0 đã đo ở TC-1.15a". Số gốc này **chưa đo** (Pha 1 và Pha 2 đều ghi là việc của giáo viên). Danh sách đặt việc đo ở nhóm B, sau khi dán code, kèm câu "nếu chưa đo thì ghi không có số gốc". Một khi thầy làm A5 thì không đo được máy chủ 1.0.0 nữa (trừ khi quay về phiên bản cũ), nên số đo bắt buộc bị mất. | Thêm bước **A0** trước A1: "Trên trang thật đang chạy (máy chủ 1.0.0), đo thời gian chuyển tab và thời gian các lời gọi `listExams`, `myResults` trên điện thoại và máy tính (hoặc hẹn buổi cùng Claude để đo trước khi dán)". B1 thì đổi thành "so với số đo ở A0". |
| R-3 | Nhẹ | `Code.gs:138`; `VIEC-GIAO-VIEN.md:24, 40` | `setup` in **mật khẩu quản trị** ra nhật ký ("✅ Cài đặt xong! Mật khẩu…"). Bước A3 bảo thầy xem nhật ký này, A6 bảo chụp nhật ký gửi Claude. Thầy dễ chụp nhầm nhật ký `setup`. Hành vi này có từ bản 1.0.0. | Thêm vào A3 hoặc A6: "Không chụp hay gửi nhật ký của `setup` (có mật khẩu); chỉ gửi nhật ký của `kiemTraSauTrienKhai`". Muốn chắc hơn: ở vòng này, khi CaiDat đã có mật khẩu từ trước thì `setup` không in mật khẩu nữa (đổi Code.gs: vẫn là 1.5.0 vì chưa triển khai). |
| R-4 | Nhẹ | `tests/scan-secrets.js:29, 41, 46–47` | Bài quét còn hở: (a) ngoại lệ PIN miễn **mọi** file `tests/` chỉ cần có chữ `dev-server`/`localhost` ở bất kỳ đâu (15/30 file), nên một PIN thật dán vào test sẽ lọt; (b) bỏ sót `ADMIN_PW="…"`, `process.env.ADMIN_PW \|\| '…'`, "PIN của em là 1503", "pin riêng: 2807"; (c) không bắt dữ liệu học sinh thật dạng bảng (họ tên + ngày sinh) và id `0B…` kiểu cũ. Hiện repo sạch, nên đây là độ bền của công cụ, chưa phải lỗi lộ dữ liệu. | (a) Chỉ miễn PIN khi giá trị là PIN của học sinh giả do test tự gieo (danh sách cố định, ví dụ `0101`, `0503`…), hoặc khi file `require('./gas-shim')`. (b) Cho regex mật khẩu nhận cả dạng có dấu nháy và `\|\| '…'`; thêm mẫu `PIN[^\n]{0,15}\d{4}`. (c) Ghi rõ giới hạn này trong đầu file. |
| R-5 | Nhẹ | `Code.gs:121` (`setup`) | `setup` đặt định dạng chữ `@` cho **toàn bộ** cột đang có, kể cả cột riêng giáo viên tự thêm (ví dụ cột ngày hay số trong HocSinh hoặc KetQua). Giá trị không đổi (TC-6.3 so giá trị nên vẫn đạt), nhưng ô ngày hay số đã nhập có thể **hiển thị** khác. Hành vi này giống bản 1.0.0, nhưng lần này `setup` chạy trên Sheet đã có dữ liệu thật vài tháng. | Không bắt buộc sửa. Nếu sửa: chỉ áp `@` cho các cột có trong `SCHEMA`. Tối thiểu: thêm vào A3 câu "cột riêng của thầy có thể bị đổi sang định dạng chữ; xem lại nếu có cột ngày/số riêng". |
| R-6 | Nhẹ | `VIEC-GIAO-VIEN.md:16, 18` | (a) "Mở file `Code.gs`": dự án tạo trên giao diện tiếng Việt có file mặc định tên **`Mã.gs`**, và có thể có hơn một file .gs. (b) "Kiểm tra **dòng đầu** có `var APP_VERSION = '1.5.0'`": dòng này ở dòng 21, sau khối chú thích. | (a) "Mở file .gs đang chứa code cũ (thường tên `Code.gs` hoặc `Mã.gs`); nếu có nhiều file .gs thì chỉ giữ một". (b) "Dùng Ctrl+F tìm `APP_VERSION`, phải thấy `'1.5.0'`". |
| R-7 | Nhẹ | `VIEC-GIAO-VIEN.md:43, 64` | Tên nút chưa đúng giao diện. "Ma trận 1 chạm lớp 12 → Tạo đề": thực tế là chọn lớp ở bộ lọc bên trái → **Tạo ma trận** → **Tạo đề (n câu) →** (`admin.js:806, 880`). "Đề thi → Tạo đề → Nhập nhanh": nút thật là **+ Tạo đề mới** (`admin.js:182`). | Sửa chữ cho đúng nhãn nút. |
| R-8 | Nhẹ | `Code.gs:74, 351` | Ghi chú mới "chỉ dùng nội bộ" cho `TEN_GIAO_VIEN`, nhưng `publicConfig` (không cần đăng nhập) vẫn trả `teacherName` cho mọi người. Pha 5 đã bỏ chỗ dùng ở giao diện. Ghi chú này dễ làm hiểu nhầm là tên không ra khỏi máy chủ. | Bỏ `teacherName` khỏi `apiPublicConfig_` (giao diện không còn dùng; máy chủ 1.0.0 không bị ảnh hưởng). Hoặc sửa ghi chú thành "không hiển thị trên trang học sinh". |
| R-9 | Nhẹ | `VIEC-GIAO-VIEN.md` nhóm B | Thiếu TC-5.15 Lighthouse (khuyến nghị, Pha 5 ghi "để Pha 6"). | Thêm một dòng tùy chọn vào B6, hoặc ghi rõ là bỏ. |

## Đánh giá 6 chỗ lệch của người làm
1. Sửa TC-5.14: **chấp nhận** (xem mục 4).
2. `setup` không sửa ghi chú cũ của `TEN_GIAO_VIEN`: **chấp nhận**, đúng luật "chỉ thêm". A4 đã có bước tùy chọn (xem thêm R-8).
3. Chưa so nguyên văn với kho thật: **chấp nhận**. Có chế độ `KHO_TEXT`. Đề nghị điều phối chạy một lần với bản xuất cột "Nội dung câu hỏi" trước khi gộp, để TC-6.5 trọn vẹn.
4. PIN trong test: **chấp nhận về nguyên tắc**, nhưng ngoại lệ rộng hơn mô tả (R-4a).
5. `kiemTraSauTrienKhai` báo thêm mục: **chấp nhận**. Các mục thêm đều chỉ đọc, có ích (CauHoi sắp hết hàng, trùng khóa, mật khẩu trống).
6. QUYET-DINH/Google Doc là việc của điều phối: **chấp nhận** (đặc tả 00 §3).

## Ghi chú cho điều phối
- Khi gộp, cập nhật mục 9 của `QUYET-DINH.md`: dòng "Code.gs 1.1.0 chưa dán" đổi thành 1.5.0. Ghi cả Google Doc.
- R-1 và R-2 không đổi Code.gs. Nếu sửa thêm R-3 hoặc R-8 trong Code.gs thì giữ `APP_VERSION` 1.5.0, vì bản này chưa triển khai.

---

## Vòng 2 (soát `git diff 74bd64e..4b7d7b9`) — 20/11/2026

### Tóm tắt cho giáo viên
- Hai lỗi vừa ở vòng 1 đã sửa xong. Bài quét bí mật không còn báo đỏ. Danh sách việc của thầy có thêm bước **A0**: đo tốc độ trang đang chạy **trước** khi dán code.
- Mã bài nộp nay không còn trùng, kể cả khi nhiều học sinh nộp cùng một giây. Mã của các bài cũ vẫn đọc được bình thường. Học sinh không bao giờ xem được bài của bạn khác.
- Sau khi thầy triển khai, chỉ cần bấm F5 một lần là trang web nhận máy chủ mới. Khi thầy lưu cài đặt, web cập nhật luôn, không phải tải lại trang.
- Code.gs vẫn là bản 1.5.0, an toàn để dán. Không còn lỗi phải sửa trước khi gộp.

### Kết luận vòng 2: **ĐẠT**
R-1 và R-2 (Vừa) đã sửa. Cũng đã sửa R-3, R-4, R-5 (ghi vào tài liệu), R-6, R-7, R-8, R-9. Vòng này có thêm 3 phát hiện Nhẹ (R2-1 … R2-3), không chặn việc gộp.

### Đã kiểm
- **Code.gs (đọc lại như bản phát hành ở các chỗ đổi)**:
  - `node --check` (bọc cả file trong một hàm): không lỗi. Không có hàm trùng tên. Vẫn là `APP_VERSION = '1.5.0'`; giữ số này là đúng, vì bản này chưa từng được triển khai.
  - `newResultId_` (`Code.gs:2514`) sinh mã `KQ` + `yyMMddHHmmss` + 8 hex lấy từ `Utilities.getUuid()`. Hàm `getUuid` có thật trên Apps Script.
  - `submitExam` kiểm trùng mã **trong khóa** bằng `resultIdTaken_`: hàm này đọc thẳng cột "Mã bài" của Sheet, không qua đệm, và xóa `__si_` trước khi đọc. Trùng thì sinh lại mã, tối đa 5 lần. Sau đó `appendRows_` ghi và `afterWrite_` xóa `__si_`.
  - Mã cũ (`KQ` + 15 chữ số) vẫn chỉ là một chuỗi. `getResult`, `myResults`, `adminDeleteResult` đều so cả chuỗi, nên mã cũ vẫn đọc được. TC trong `pha6.test.js` dùng đúng một mã kiểu cũ để thử.
  - **`getResult`** (`Code.gs:651–666`): với học sinh, hàm ưu tiên hàng của chính em khi có hai hàng trùng mã. Không có hàng của em thì lấy hàng đầu, nhưng vẫn bị câu kiểm `studentId` chặn. Vì vậy học sinh không bao giờ nhận bài của người khác. Giáo viên nhận hàng đầu (xem R2-1).
  - Mã bài luyện tập nay có 16 hex. `pid` là UUID 32 hex, nên đủ ký tự. Kiểm trùng theo mã bài + mã HS: chỉ hàng có mã trùng mới đọc thêm ô "Mã HS". Máy chủ thật chưa từng chạy bản luyện tập, nên không có mã luyện tập 12 hex nào cần giữ tương thích.
  - Bỏ `teacherName` khỏi `publicConfig` (R-8): giao diện không còn dùng trường này (grep `assets/js`: 0 chỗ).
- **Giao diện**:
  - `app.js` và `admin.js` hỏi lại `publicConfig` khi bản lưu không có `features` (K-2).
  - `booted` khai báo trước khi gọi `boot()` (`app.js:850`), nên không bị lỗi TDZ.
  - Khi máy chủ đổi, trang vẽ lại màn đang xem, trừ màn đang làm bài (có `ld_attempt` hoặc hash `lam-bai`, `luyen-tap/lam`). Trình soạn đề đang có thay đổi chưa lưu (`editorDirty`) cũng không bị vẽ lại.
  - Lưu cài đặt thì gọi `refreshPub()` (K-3). Gọi lỗi thì xóa bản lưu như cũ.
  - Tôi tự chạy `e2e.js` trên cổng 8795 với máy chủ mới và với `SERVER_COMPAT=1.0.0`: cả hai đạt.
- **`scan-secrets.js`**: tôi chạy lại trên repo tạm, với các mẫu của vòng 1 cộng mẫu mới. Kết quả: bắt được hết, gồm `ADMIN_PW="…"`, `ADMIN_PW || '…'`, câu PIN dạng tự do, `**…**`. Không báo nhầm `ADMIN_PW=<…>`, backtick hay `$PW`. Ngoại lệ PIN nay chỉ cho 11 file test được liệt kê đích danh, cộng hai PIN tài liệu (`0101`, `0503`). Ngoại lệ `ALLOW` chỉ khớp đúng từng chuỗi ví dụ trong báo cáo này. Repo: sạch, 92 file.
- **`dev-server.js`**: khóa ký phiên cố định theo cổng, chỉ dùng trong test. Giá trị này không phải bí mật thật và không nằm trong Code.gs.
- **Tài liệu**:
  - A0 đặt trước A1. B1 so với số đo ở A0.
  - A3, A6 và README nhắc không gửi nhật ký `setup`. Có `Mã.gs`, Ctrl+F `APP_VERSION`, câu về cột riêng (R-5), Lighthouse (R-9).
  - Tên nút khớp `admin.js`: "Tạo ma trận", "Tạo đề (n câu) →", "+ Tạo đề mới", "⇪ Nhập nhanh từ Word / Excel".
- **Test chạy lại**:
  - `scan-secrets` sạch. `pha6.test.js` 10/10.
  - `backend` 13, `bank` 30, `cache` 17, `common-cache` 5, `pha4` 22, `pha4-kiem-thu` 33, `pha5` 11, `pha1-kiem-thu` 29, `docx` 29: đều đạt. `importer`: đạt.
  - `e2e.js` (8795): đạt ở cả hai chế độ máy chủ.

### Phát hiện vòng 2
| Mã | Mức | Vị trí | Vấn đề | Đề xuất |
|---|---|---|---|---|
| R2-1 | Nhẹ | `Code.gs:662–663` (`getResult`, vai giáo viên), `Code.gs:1213` (`adminDeleteResult`) | Dữ liệu cũ của 1.0.0 có thể có hai bài trùng mã (mã cũ chỉ có 3 chữ số ngẫu nhiên). Khi đó giáo viên xem hay xóa sẽ trúng **hàng đầu**, có thể không phải hàng thầy bấm. Không lộ dữ liệu cho học sinh. Mã mới không còn trùng. | Chấp nhận. Nếu muốn: `kiemTraSauTrienKhai` báo ⚠️ khi KetQua có mã trùng. |
| R2-2 | Nhẹ | `Code.gs:632–634` | Mỗi lần nộp bài, máy chủ đọc thêm cả cột "Mã bài" của KetQua trong khóa (2 lần gọi Sheet). Với vài nghìn hàng thì nhanh, nhưng chưa đo trên Apps Script thật. | Đưa vào B1/B2: ghi thời gian nộp bài khi KetQua đã lớn. |
| R2-3 | Nhẹ | `app.js:28`, `admin.js:31` | Trong thời gian máy chủ thật còn chạy 1.0.0 (trước A5, hoặc sau khi quay về ở A7), bản lưu luôn thiếu `features`, nên mỗi lần mở trang lại gọi thêm `publicConfig` (1 request chạy ngầm). Cái giá này chấp nhận được, đổi lại F5 thấy ngay máy chủ mới. | Chấp nhận. Khi dọn mã dự phòng (nhóm D) thì bỏ luôn nhánh này. |
