# Báo cáo Pha 2 — Nối ngân hàng câu hỏi

## Tóm tắt cho giáo viên (bản của người làm)
- Trang quản trị có tab mới **Ngân hàng**. Thầy lọc câu trong "KHO CÂU HỎI VẬT LÝ" theo lớp, chương → bài, dạng câu, mức độ, nguồn, hoặc gõ chữ để tìm, rồi cho câu vào **giỏ**.
- **Ma trận 1 chạm** (mặc định 18–4–6, sửa được) chọn câu ít dùng trước. **Lấy đề gốc** nạp lại nguyên đề theo thứ tự câu. Kho thiếu câu thì web báo rõ phần nào thiếu bao nhiêu câu.
- Bấm **Tạo đề**: web chép hình sang thư mục hình của web (file gốc giữ nguyên quyền), rồi mở trình soạn đề để thầy xem lại và bấm Lưu.
- Web **chỉ đọc** kho, không sửa. Chỉ câu **đã có đáp án** mới dùng được. Hiện kho thật có 10 239 câu, nhưng mới **1 014 câu** dùng được (đa số câu chưa có đáp án).
- Tab này chỉ chạy sau khi thầy dán máy chủ mới ở Pha 6. Trước đó tab hiện "Cần cập nhật máy chủ", các mục khác vẫn chạy bình thường.

---

## Người làm

### Đã làm
**Máy chủ (`Code.gs` 1.2.0 → 1.3.0, `features` thêm `"bank"`)**
- `CaiDat`: thêm `KHO_CAU_HOI_ID`, `THU_MUC_HINH_KHO_ID` vào `DEFAULT_SETTINGS` (mặc định trống; `setup()` chạy lại an toàn) và vào danh sách sửa được ở mục Cài đặt. Nhận cả id lẫn link (`/d/<id>`, `/folders/<id>`). Không có id thật trong repo.
- `CauHoi`: thêm 5 cột cuối qua `SCHEMA`: `Mã câu kho`, `Chương`, `Bài`, `Mức độ từng ý`, `Nguồn`. `normalizeQuestion_` mang các cột này; câu nhập tay để trống. `startExam` và kết quả của học sinh không có các cột này (danh sách trường liệt kê tường minh như trước).
- `bankToQuestion_(row)` (hàm thuần) trả `{ q, loi, coDapAn, hinh }`:
  - Dạng: `Phần I/II/III/IV` (dự phòng theo mã câu `-P2-`). Phần IV → `loi: 'tuLuan'`.
  - Mức độ: bảng tường minh Biết→NB, Hiểu→TH, Vận dụng→VD, Vận dụng cao→VDC (không dùng `normalizeLevel_`).
  - Phần II: regex `([a-d])\)\s*(Đúng|Sai|Đ|S)(?=[\s,;.]|$)` cờ `gi`, lấy theo a–d, ghép `ĐSSĐ`; thiếu ý → chưa có đáp án hợp lệ.
  - Phần III: giữ nguyên chuỗi (`3,0`, `-120`), `saiSo` trống; bỏ dấu `'` đầu ô.
  - Chủ đề = Bài bỏ tiền tố "Bài N. "; giữ `chuong`, `bai`, `nguon`, `mucDoY`, `loiGiai`, nội dung, A–D nguyên văn.
  - Hình: tên file trong ô `Có – <mã>.png (…)`; `hinhAnh` điền URL bản chép ở bước sau.
- Đọc kho: `openById` → trang "Kho câu hỏi", tìm cột theo **tên tiêu đề** (thiếu cột bắt buộc thì báo lỗi nêu tên cột). Dựng chỉ mục chỉ đọc 15 cột cần (bỏ Lời giải…), gom cột liền nhau thành ít lần `getRange`. Chỉ mục gọn (từ điển cho Lớp/Chương/Bài/Nguồn) đệm **10 phút** bằng hạ tầng chia mảnh của Pha 1 (`cacheGetChunked_`/`cachePutChunked_`, tách từ `readCachedTable_`/`writeCachedTable_`), ngưỡng riêng **2 MB**. Có thế hệ `bankgen`; "Đọc lại kho" (`refresh`) đặt thế hệ mới. Đổi `KHO_CAU_HOI_ID` thì chỉ mục tự dựng lại.
- Câu đầy đủ: đọc đúng các hàng được chọn, gom thành khối hàng liền nhau. Ô mã câu ở hàng đó không khớp (kho vừa chèn/xóa hàng) thì đọc lại chỉ mục một lần rồi lấy lại theo mã.
- API (đều `requireTeacher_`): `adminBankMeta`, `adminBankList` (`size ≤ 100`), `adminBankSource`, `adminBankMatrix` (ưu tiên `daDung` nhỏ, ngẫu nhiên trong cùng mức, `seed` lặp lại được), `adminBankToQuestions` (chia lô hình, trả `tiepTuc`). `daDung` = số đề web có mã câu đó (đọc `CauHoi` qua đệm).
- Hình: bản đồ tên → id dựng **một lần** bằng duyệt đệ quy `THU_MUC_HINH_KHO_ID`, đệm 10 phút. Chưa cấu hình thư mục thì `DriveApp.getFilesByName`. Mỗi hình: `makeCopy` vào `imageFolder_()`, chia sẻ **bản chép** "ai có liên kết được xem", URL `https://lh3.googleusercontent.com/d/<id>`, ghi `IMG_<tên>` vào Script Properties để không chép lại. Mỗi lần gọi tối đa 40 hình, hoặc dừng ở mốc 4,5 phút (trừ 15 s dự phòng). Không thấy hình thì cảnh báo nêu tên file, câu vẫn thêm được.
- `validateQuestion_`: từ chối câu Phần IV / `phan > 3`. Thông báo lỗi nêu số câu và mã câu kho, vd `Câu 2 (L12…): chưa có đáp án.`

**Giao diện**
- `admin.html`: thêm mục menu **Ngân hàng** (`#/ngan-hang`).
- `admin.js`, tab Ngân hàng:
  - dòng thống kê kho và cảnh báo (kho > 3 000 câu);
  - bộ lọc: Lớp, Dạng, Mức độ, Nguồn, tìm chữ (bỏ dấu), cây Chương → Bài có số câu `TN·DS·TL`;
  - danh sách 20 câu/trang có KaTeX và nhãn "có hình", "đã dùng N lần"; nút "Xem đầy đủ" (có đáp án, lời giải, hình);
  - giỏ câu nổi ở dưới "P1 x · P2 y · P3 z", lưu trong `sessionStorage` (chỉ mã câu);
  - **Ma trận 1 chạm**: theo lớp, chương, bài, mức độ, nguồn đang lọc. Thiếu câu thì hộp xác nhận nêu từng phần: cần, có, thiếu. Không âm thầm tạo đề thiếu.
  - **Lấy đề gốc**: cảnh báo câu thiếu và câu chưa có đáp án, kèm vị trí.
  - **Tạo đề**: gọi `adminBankToQuestions` lặp theo `tiepTuc`, có thanh tiến độ "Đã chép x/y hình". Sau đó mở trình soạn đề với câu đã nạp (sắp theo phần), đánh dấu "chưa lưu", hiện cảnh báo hình. Lưu xong thì xóa giỏ. Trong trình soạn, câu lấy từ kho có nhãn "Kho: <mã>".
  - Máy chủ chưa có `bank` (biết qua `features` hoặc lỗi "Không có chức năng") thì tab hiện "**Cần cập nhật máy chủ (bước phát hành)**". Mục Cài đặt chỉ hiện ô kho khi máy chủ có `bank` hoặc CaiDat đã có khóa đó.
- `common.js`:
  - `FEATURE_OF` thêm `adminBank*` → `bank`;
  - `rich()` hiển thị khối `[BẢNG] Cột 1 | Cột 2` + các dòng `ô | ô` liền sau thành `<table class="q-table">` (dùng chung cho trang học sinh). Công thức trong ô vẫn qua KaTeX; văn bản không có bảng cho kết quả như cũ.
- `style.css`: bảng `.q-table`, bố cục tab Ngân hàng (2 cột; dưới 900 px còn 1 cột; ở 390 px không cuộn ngang), thanh giỏ câu.

**Hạ tầng test**
- `tests/gas-shim.js`:
  - `SpreadsheetApp.openById` (`ctx._addSpreadsheet(id, {trang: mảng})`) có đếm `openById`;
  - đếm ghi riêng cho bảng tính ngoài (`_stats.extWrites[id]`: `setValues`, `clearContent`, `deleteRow`, `appendRow`, `insert*`, `insertSheet`);
  - đếm ô đọc theo trang (`_stats.cells`);
  - Drive giả: thư mục lồng nhau, `getFolderById`, `getFileById`, `getFilesByName`, `makeCopy` (đếm, chi phí giả `makeCopyMs` cộng vào đồng hồ giả), `setSharing` đếm theo id file;
  - đồng hồ giả: Code.gs đọc giờ qua `nowMs_()`, shim thay hàm này; `ctx._clock`.
- `tests/fixtures/kho-gia.js`: kho **tự soạn**, đúng 22 cột của kho thật. Có hai kiểu đáp án Phần II và một kiểu lẫn, Phần III `3,0`/`-120`, LaTeX, ô hình, hai kiểu Vị trí và kiểu có "file:", nguồn có hai đề gốc, câu thiếu đáp án, Phần IV, `[BẢNG]` 2 cột × 5 hàng, câu lỗi định dạng, hình nằm sâu hơn đường dẫn ghi trong ô, 1 hình thiếu. `bigRows(n)` sinh kho lớn.
- `tests/dev-server.js`: máy chủ mới tự gắn kho giả, điền sẵn `KHO_CAU_HOI_ID`. Biến `BANK=0`, `BANK_ROWS`, `MAKE_COPY_MS`.
- `tests/bank.test.js` (23 test) và `tests/bank.e2e.js` (Playwright, cả hai chế độ máy chủ).
- `tests/cache.test.js`: sửa 3 khẳng định cũ theo `features` mới và `APP_VERSION` 1.3.0.

### File đổi
`apps-script/Code.gs`, `admin.html`, `assets/js/admin.js`, `assets/js/common.js`, `assets/css/style.css`, `README.md` (mục "Tạo đề từ Ngân hàng câu hỏi", lệnh test), `tests/gas-shim.js`, `tests/dev-server.js`, `tests/cache.test.js`. File mới: `tests/fixtures/kho-gia.js`, `tests/bank.test.js`, `tests/bank.e2e.js`, `docs/bao-cao/pha-2.md`, ảnh `docs/bao-cao/anh/pha-2/`.

### Kết quả test (người làm tự chạy)
| Lệnh | Kết quả |
|---|---|
| `node tests/backend.test.js` | 13/13 đạt |
| `node tests/importer.test.js` | đạt |
| `node tests/cache.test.js` | 17/17 đạt |
| `node tests/common-cache.test.js` | 5/5 đạt |
| `node tests/pha1-kiem-thu.test.js` | 29/29 đạt |
| `node tests/bank.test.js` (mới) | 23/23 đạt: TC-2.1 → TC-2.11 phía máy chủ; kho đổi tên cột; chưa cấu hình kho; id dạng link; kho vừa chèn hàng; Sheet cũ thiếu cột mới; `setup` chạy lại; máy chủ 1.0.0 |
| dev-server + `tests/e2e.js`, máy chủ mới / `SERVER_COMPAT=1.0.0` | đạt / đạt |
| `tests/bank.e2e.js`, máy chủ mới | đạt: lọc; `[BẢNG]` 2 cột × 5 hàng; câu có hình (URL bản chép); đề gốc báo "Phần I: kho không có câu 5–11, 13" và 1 câu chưa có đáp án; ma trận 18–4–6; ma trận thiếu nêu phần; trình soạn 28 câu → lưu → học sinh thấy 28 câu, không lộ mã kho, nộp bài; không lỗi JS |
| `tests/bank.e2e.js`, `SERVER_COMPAT=1.0.0` | đạt: tab Ngân hàng hiện "Cần cập nhật máy chủ"; 6 tab khác không lỗi; Cài đặt không hiện ô kho (TC-2.14) |
| `tests/pha1-r1.e2e.js`, hai chế độ | đạt / đạt |
| `tests/pha1-kiem-thu.e2e.js all` (`PORT_NEW=8788 PORT_OLD=8789`, ảnh ra thư mục tạm, không ghi đè ảnh Pha 1) | K-1, K-3, TC-1.0, 1.1, 1.2, 1.3, 1.4, 1.9, 1.9b, 1.10, 1.11, 1.14 đều ĐẠT |

TC-2.12 (bảng) và TC-2.14 có trong e2e của người làm. TC-2.13 dành cho agent kiểm tra dữ liệu riêng; người làm chỉ chạy bộ chuyển đổi trên kho thật (mục dưới).

### Ảnh (`docs/bao-cao/anh/pha-2/`, dữ liệu kho giả tự soạn)
`01-ngan-hang` (tab Ngân hàng), `02-gio-cau` (giỏ 18–4–6), `03-canh-bao-thieu` (đề gốc thiếu câu / chưa có đáp án), `04-cau-co-hinh`, `05-bang` ([BẢNG] 2 cột × 5 hàng), `06-trinh-soan` (28 câu đã nạp, chưa lưu), `07-hoc-sinh-lam-bai`, `08-hoc-sinh-ket-qua` (390×844), `09-ngan-hang-may-chu-cu` (máy chủ 1.0.0), `10-ngan-hang-dien-thoai`, `11-danh-sach-dien-thoai` (390×844). Ảnh quản trị khổ 1280×800. Môi trường chặn CDN nên ảnh điện thoại không có phông/KaTeX; ảnh 1280 có KaTeX từ thư viện cục bộ.

### Chạy thử trên kho thật (chỉ đọc, ngày 18/11/2026; dữ liệu không lưu vào repo)
Đọc bằng công cụ Google Sheets (`Kho câu hỏi!A1:V11000`, 4 lần đọc), nạp vào gas-shim rồi chạy chính `Code.gs` (`adminBankMeta`, `bankToQuestion_` từng hàng, List, Matrix, ToQuestions, SaveExam). Kho chỉ đọc: 0 lần ghi.

| Chỉ số | Số |
|---|---|
| Số hàng đọc | **10 239** (Lớp 12: 9 330, Lớp 11: 909). Trang "Thống kê" của kho cũng ghi 10 239; cộng theo dạng: 6 567 + 1 453 + 2 181 = 10 201, cộng 38 câu Phần IV = 10 239, khớp |
| Ô "Đáp án" không trống | 1 057 |
| Đáp án hợp lệ (cả Phần IV) | 1 030 |
| **Dùng được** | **1 014**: Phần I 772 · Phần II 120 · Phần III 122. Theo mức độ: NB 262 · TH 279 · VD 473 |
| Dùng được, theo lớp | Lớp 12: P1 136 · P2 32 · P3 **6**. Lớp 11: P1 636 · P2 88 · P3 116 |
| Bị loại: chưa có đáp án | 9 156 (P1 5 793 · P2 1 331 · P3 2 032) |
| Bị loại: Phần IV (tự luận) | 38 (12 câu có đáp án) |
| Bị loại: đáp án Phần III không phải một số | 27 câu, đều lớp 11. Đáp án có đơn vị/LaTeX/chữ, dạng `\approx <số>`, `<số>\ \text{<đơn vị>}.`, `<đại lượng> = <số> <đơn vị>.`, hoặc một câu chữ. Danh sách mã câu đầy đủ sẽ gửi giáo viên riêng (không ghi vào repo). |
| Bị loại: Phần I thiếu phương án | 2 (danh sách gửi riêng) |
| Bị loại: Phần II thiếu nội dung câu (và không có hình) | 2 (danh sách gửi riêng) |
| Phần II | Đủ 3 kiểu đáp án: `a) Đúng b) Sai…`, `a) S b) Đ…`, `a) Đúng, b) Sai, …` (có dấu phẩy). Cả 122 đáp án đều đọc ra 4 ý |
| Đề gốc | 289 tên Nguồn. Một Nguồn có thể gồm nhiều file đề (tới 7). Tách theo Nguồn + file thì có **379 đề gốc**; 41 đề có câu dùng được; 210 đề có số câu nhảy (`thieu`) |
| Hình | 2 838 hàng có ô "Có – <mã>.png (02. HÌNH VẼ/…)", file nằm trong các thư mục con sâu hơn. Không có ô "Có" nào thiếu tên file. Chưa thử chép hình trên Drive thật (môi trường không có Apps Script) |
| Chỉ mục | 970 KB < 2 MB → được nhớ tạm. Meta hiện cảnh báo "Kho có 10 239 câu (nhiều hơn 3 000)" |
| Ma trận 18–4–6 Lớp 12 | Đủ (P3 vừa đúng 6 câu). `adminSaveExam` nhận 28 câu đã ánh xạ |

### Chỗ lệch đặc tả + lý do
1. **Kho thật đã lớn hơn khảo sát nhiều** (10 239 hàng so với 74; đặc tả tính cho tối đa 3 000 câu). Để chỉ mục vẫn dưới 2 MB, `tom` (≤ 160 ký tự) chỉ lưu cho câu **dùng được**: câu bị loại không bao giờ hiện trong danh sách nên không cần. `viTri` lưu dạng gọn "P1 – Câu 3" vì ô thật có cả đường dẫn file dài. Mỗi câu vẫn có đủ các trường đặc tả nêu, thêm `phan`, `cau`, `loi`.
2. **Phần III**: đặc tả ghi "giữ nguyên chuỗi" và khảo sát ghi "không có đơn vị". Kho thật nay có 27 đáp án kèm đơn vị/LaTeX/chữ, mà máy không chấm được. Vì vậy chỉ nhận đáp án là số (hoặc nhiều số cách `|`). Câu khác bị loại với lý do "đáp án không đúng định dạng" để giáo viên sửa trong kho. Không tự trích số, vì có thể sai.
3. **Đề gốc = Nguồn + file**: kho thật có Nguồn chứa nhiều file đề (vị trí "P1 – Câu 1" lặp tới 7 lần trong một Nguồn). Nếu gộp, đề gốc sẽ bị trộn. Vì vậy `adminBankSource({nguon})` nhận khóa `ma` trả về từ `adminBankMeta().nguon[]`; Nguồn chỉ có một file thì `ma` vẫn kèm đường dẫn file, còn `ten` chỉ thêm tên file khi Nguồn có hơn một file.
4. **Thêm lý do loại**: thiếu phương án/ý (Phần I/II) và thiếu nội dung khi không có hình. `validateQuestion_` cũng sẽ từ chối những câu này, nên loại sớm để không vào giỏ.
5. **Kết quả API có thêm trường** (không bớt trường nào):
   - Meta: `boQua`, `lop`, `canhBao`; `nguon[]` có `ma`, `dungDuoc`.
   - List: mỗi câu có `lop`, `maNguon`; thêm `page`, `size`.
   - Source: `ma`, `ten`, `khongDapAnViTri`, `tuLuan`; `thieu` là `[{phan, cau[], text}]`.
   - Matrix: nhận thêm `mucDo`, `nguon` (giao diện gửi theo bộ lọc đang chọn); trả `coSan`, `so`.
   - ToQuestions: `tienDo`.
6. **"Xem đầy đủ" dùng `adminBankToQuestions`** cho 1 câu, nên hình của câu đó được chép sang thư mục web ngay lúc xem. Bản chép được dùng lại khi tạo đề, không chép lần hai.
7. **Không khóa (`withLock_`) khi chép hình**: khóa script dùng chung với lúc học sinh nộp bài; giữ khóa trong lúc chép 40 hình có thể làm học sinh nộp bài bị chờ. Hệ quả: hai tab giáo viên tạo đề cùng lúc có thể chép trùng một hình (vô hại).
8. **Tên file test**: `tests/bank.test.js`, `tests/bank.e2e.js`. Tên `tests/pha2.test.js` trong "Kế hoạch kiểm thử" để dành cho người kiểm thử, tránh trùng.
9. `rich()` `[BẢNG]` làm ở pha này vì Pha 3 chưa làm. Dòng trống ngay trước `[BẢNG]` được bỏ để bảng không cách xa câu dẫn.

### Rủi ro còn lại
- **Chưa chạy trên Apps Script thật** (môi trường chặn script.google.com). Chưa xác minh trên Apps Script thật:
  - thời gian dựng chỉ mục 10 239 hàng (≈ 160 000 ô, ước vài giây, 10 phút mới dựng lại một lần);
  - giới hạn CacheService khi cất 11 mảnh;
  - thời gian duyệt đệ quy thư mục ≈ 2 800 hình;
  - màn xin quyền Drive/Sheets.
  
  Người kiểm thử Pha 6 nên đo lần đầu mở tab Ngân hàng.
- Script Properties giữ `IMG_<tên>` (≈ 60 B/hình). Giới hạn 500 KB đủ cho khoảng 8 000 hình đã chép; kho tăng mạnh thì cần đổi cách lưu.
- Chưa cấu hình `THU_MUC_HINH_KHO_ID` thì tìm hình bằng `getFilesByName` trên toàn Drive: chậm hơn, và có thể gặp file trùng tên ở chỗ khác.
- Lớp 12 hiện chỉ có 6 câu Phần III dùng được: ma trận 18–4–6 lớp 12 vừa đủ; lọc theo chương sẽ báo thiếu.
- Đổi tên/xóa file bản chép trong thư mục web thì câu đã lưu mất hình; mã `IMG_` vẫn trỏ bản cũ (xóa dòng trong Script Properties để chép lại).

### Việc giáo viên cần làm (cộng dồn cho Pha 6)
1. (Từ Pha 1) Đo số gốc TC-1.15a trên trang thật đang chạy máy chủ 1.0.0 (hoặc cho phép một phiên agent có mạng mở trang để đo).
2. Pha 6: dán toàn bộ `apps-script/Code.gs` (bản **1.3.0** trở lên), chạy `setup` một lần, rồi Triển khai → Quản lý các bản triển khai → ✏ → **Phiên bản mới** → Triển khai (URL giữ nguyên). Lần chạy `setup` này Google sẽ **xin thêm quyền đọc Google Sheets khác và Google Drive** (để đọc kho và chép hình): bấm Cho phép. `setup` tự thêm 2 dòng `KHO_CAU_HOI_ID`, `THU_MUC_HINH_KHO_ID` vào CaiDat; 5 cột mới của `CauHoi` tự thêm vào cuối.
3. (Từ Pha 1) Sau Pha 6: sửa một ô trên Sheet rồi tải lại trang web để kiểm `onEdit`.
4. Sau Pha 6: vào **Cài đặt** của trang quản trị, dán link file "KHO CÂU HỎI VẬT LÝ" **mà thầy mở được trong Drive của mình** (mở file, chép địa chỉ trên thanh trình duyệt; kho có thể đã đổi sang file khác) vào ô *Kho câu hỏi*, và link thư mục "02. HÌNH VẼ" vào ô *Thư mục hình của kho*, rồi Lưu.
5. Thử tab **Ngân hàng**: Ma trận 1 chạm lớp 12 → Tạo đề → xem hình có hiện trong trình soạn → Lưu (để Bản nháp) → xóa đề thử.
6. Bổ sung đáp án trong kho: mới 1 030/10 239 câu có đáp án hợp lệ. Sửa 27 đáp án Phần III có đơn vị/chữ thành **chỉ số** (đơn vị ghi trong đề), 2 câu Phần I thiếu phương án, 2 câu Phần II thiếu nội dung (danh sách mã câu gửi riêng). Xong bấm **↻ Đọc lại kho**.
7. (R-9, kiểm ở Pha 6) Theo dõi kích thước trang `CauHoi`: câu từ kho có lời giải dài, khoảng 20–25 đề 28 câu có thể vượt ngưỡng đệm 900 KB của Pha 1. Khi đó web vẫn đúng nhưng `startExam`/`submitExam` đọc thẳng Sheet (chậm hơn). Pha 6 đo `/__stats` hoặc thời gian thật; nếu cần thì đệm `CauHoi` theo đề.
8. (R-10, kiểm ở Pha 6 trên Apps Script thật) Khi `CauHoi` vượt 1 000 hàng: hàng mới có thể không có định dạng văn bản `@` (đáp án `3,0` có thể bị đổi thành số) hoặc `getRange` vượt số hàng tối đa. Thử lưu một đề khi `CauHoi` đã đầy 1 000 hàng; nếu lỗi thì thêm `insertRowsAfter` + `setNumberFormat('@')` trước khi ghi.

---

## Vòng 2 (người làm) — sửa theo `pha-2-soat.md` và `pha-2-kiem-thu.md`

### Đã sửa
| Mã | Sửa | File |
|---|---|---|
| **R-1** (Vừa) | `App.currentView()`/`App.viewIs(id)` mới trong `common.js`. Ở tab Ngân hàng: lấy mã màn trước mỗi `await`, sau `await` nếu đã sang màn khác thì không vẽ, không mở hộp, không báo lỗi; chỉ giữ `bankMeta`. Áp dụng cho: đọc kho lần đầu, "Đọc lại kho", danh sách, Ma trận, Lấy đề gốc, Xem đầy đủ, Tạo đề (đã rời tab thì không tự mở trình soạn). Lỗi `AUTH` cũng đổi màn nên không còn hộp lỗi đè màn đăng nhập. | `common.js`, `admin.js` |
| **N-1** | `bankReadRows_`: mỗi khối hàng liền nhau đúng **1** lần `getRange` phủ cột đầu → cuối cần đọc (A:T), vẫn so ô mã câu với chỉ mục. 28 câu rải rác của test người kiểm thử: 85 → 29 lần `getRange` (1 tiêu đề + 28 khối), 582 ô. | `Code.gs` |
| **R-2, R-3** | Không còn im lặng khi thiếu hình. Lượt cuối của `adminBankToQuestions` (không còn `tiepTuc`) rà **mọi** câu kho ghi "Có" hình mà chưa có URL — dù hình không tìm thấy, chép lỗi, hay con trỏ lượt trước nhảy qua — và trả `thieuHinh: [mã câu]` kèm cảnh báo "Câu <mã>: …". `bankImageName_` đọc được tên file có dấu cách ("Có – hinh 1.png (…)"). Ô chỉ ghi "Có" mà không có tên file: câu vẫn dùng được, chỉ mục đánh dấu có hình, và có cảnh báo "không đọc được tên file". Trình soạn đề hiện các cảnh báo ở đầu trang và nhãn "Kho ghi có hình — chưa có hình" trên từng câu, **trước khi lưu**. | `Code.gs`, `admin.js` |
| **R-4** | Đáp án Phần III nhận `1e-7`, `6.4e-19`, `.5`, `,5`, `-0,5`, và ô kiểu số (Sheet trả `1e-7`). Chấm: `1e-7` đúng với `0,0000001`. | `Code.gs` |
| **R-5** | Một giới hạn chung 500 câu: `adminBankMatrix` từ chối tổng > 500; Meta trả `gioiHan`. Giao diện báo ngay khi bấm "Tạo ma trận" với tổng > 500; giỏ > 500 thì hiện "Quá 500 câu — bớt N câu" và khóa nút Tạo đề. | `Code.gs`, `admin.js` |
| **R-7** | Bản chép công khai tên `hinh-<12 ký tự hex>.<đuôi>`. 12 ký tự là băm có khóa (HMAC với khóa bí mật của máy chủ) của tên gốc, nên người ngoài không đoán ngược ra mã câu. Máy chủ tra ngược bằng `IMG_<tên gốc>` → id, hoặc tính lại `bankCopyName_(tên gốc)`. | `Code.gs` |
| **R-6** | Mỗi lượt đọc Script Properties **1 lần** (`getProperties()`), gọi `imageFolder_()` 1 lần. `secret_()` nhớ trong request. 30 câu có hình: ≤ 5 lần đọc Properties. | `Code.gs`, shim thêm `getProperties` |
| **R-8** | "Đọc lại kho" (`adminBankMeta {refresh}`) xóa luôn bản đồ tên hình đã nhớ (`bkimg_<thư mục>`), nên hình mới thêm vào Drive được tìm thấy ngay. | `Code.gs` |
| R-11 | Bỏ danh sách mã câu thật khỏi báo cáo, chỉ ghi số lượng theo loại lỗi. Danh sách đầy đủ ở thư mục nháp của phiên để gửi giáo viên riêng (không vào repo). | báo cáo |
| N-2 | README và việc giáo viên mục 4: dán link file kho **mà mình mở được**. | `README.md`, báo cáo |

**Không sửa ở pha này** (theo chỉ đạo): R-9, R-10 → đưa vào "Việc giáo viên cần làm / kiểm ở Pha 6" (mục 7, 8).

### Test mới
- `tests/bank.test.js` thêm 7 test (tổng 30):
  - R-4: số mũ, `.5`, ô kiểu số; chấm đúng.
  - R-3: tên có dấu cách; ô chỉ ghi "Có" → `thieuHinh` + cảnh báo.
  - R-2: con trỏ nhảy và hình không có trên Drive → lượt cuối cảnh báo đủ 8 câu.
  - R-7: tên bản chép không chứa mã câu, đúng dạng `hinh-<hex>`, tính lại được.
  - R-5: giới hạn chung, Meta có `gioiHan`.
  - R-6, R-8: số lần đọc Properties; "Đọc lại kho" tìm thấy hình mới.
  - N-1: 3 khối hàng → 4 lần `getRange`.
- `tests/bank.e2e.js` thêm R-1: làm chậm `adminBankMeta` 2,5 s → sang trình soạn và gõ tên đề → sau 3,5 s ô tên vẫn còn. Tương tự "Đọc lại kho" → sang Tổng quan. Đã xác nhận test **bắt được lỗi**: bỏ dòng kiểm `viewIs` thì test báo KHÔNG ĐẠT.
- Sửa 1 dòng test cũ của người làm: TC-2.3 dùng ma trận 100/100/100 thay cho 200/200/200 (vượt giới hạn mới).

### Kết quả test vòng 2
| Lệnh | Kết quả |
|---|---|
| `backend` / `importer` / `cache` / `common-cache` | 13/13 · đạt · 17/17 · 5/5 |
| `pha1-kiem-thu.test.js` / `pha2-kiem-thu.test.js` (không sửa) | 29/29 · 29/29 (28 câu rải rác: 29 lần `getRange`, 582 ô) |
| `bank.test.js` | 30/30 |
| `e2e.js`, máy chủ mới / `SERVER_COMPAT=1.0.0` | đạt / đạt |
| `bank.e2e.js`, máy chủ mới / 1.0.0 | đạt (có R-1) / đạt |
| `pha1-r1.e2e.js`, hai chế độ | đạt / đạt |
| `pha1-kiem-thu.e2e.js all` (cổng 8788/8789, ảnh ra thư mục nháp) | K-1, K-3, TC-1.0 → 1.14 đều ĐẠT |
| `pha2-kiem-thu.e2e.js all` (cổng 8788/8789, ảnh ra thư mục nháp; không sửa) | 11/11 nhóm đạt, gồm TC-2.10, 2.12, 2.14 |
| Chạy lại bộ chuyển đổi trên dữ liệu kho thật đã đọc (thư mục nháp) | số liệu không đổi (1 014 dùng được; 27 + 2 + 2 câu lỗi định dạng; 0 ô "Có" thiếu tên file) |
