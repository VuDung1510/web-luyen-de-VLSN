# Pha 6a — Báo cáo kiểm thử (người kiểm thử, độc lập)

Nhánh `pha-6-phat-hanh`, code tính năng tới commit `190d81e` (báo cáo người làm), kiểm trên HEAD `0addd2a`. Đặc tả `docs/spec/pha-6-phat-hanh.md` (sửa 18/11/2026). Ngày 20/11/2026.

## Tóm tắt cho giáo viên
- **Kết luận: CHƯA ĐẠT.** Máy chủ 1.5.0 đúng: dán lên Sheet cũ không mất ô dữ liệu nào, chỉ thêm. Chạy `setup` nhiều lần không sinh trùng. `kiemTraSauTrienKhai` chỉ đọc và không in mật khẩu. Mọi test cũ vẫn đạt.
- Chưa đạt vì hai việc. Một: script quét bí mật đang báo đỏ, do báo nhầm một dòng chữ trong báo cáo (K-1). Hai: tài liệu "Việc giáo viên cần làm" có vài bước chưa khớp trang web thật (K-2, K-4 → K-6).
- **Quan trọng cho buổi dán code (K-2):** máy nào đã mở web trong khoảng 10 phút trước khi triển khai sẽ vẫn tưởng máy chủ là bản cũ, kể cả trang quản trị. Bấm F5 không giúp gì. Khi đó tab Ngân hàng báo "Cần cập nhật máy chủ… 1.0.0", còn trang Cài đặt lại ghi 1.5.0. Thầy có thể tưởng triển khai hỏng. Tài liệu đang ghi "F5 một lần là đủ", câu này chưa đúng.
- Còn một lỗi nhỏ có sẵn từ Pha 4 (K-3): bấm "Lưu cài đặt" xong thì tab Ngân hàng mất nút "Đưa vào luyện tập" và tab "Pool luyện tập". Phải F5 mới hiện lại.
- Ngoài phạm vi (N-1, nên sửa trước khi dán vì đây là lần dán duy nhất): hai bài nộp trong cùng một giây có thể bị trùng "Mã bài".

## Cách kiểm
- **`tests/pha6-kiem-thu.test.js`** (Node, gas-shim), viết theo đặc tả trước khi đọc code tính năng. Không đọc `tests/pha6.test.js`. Gồm:
  - **TC-6.1:** `doGet`, `publicConfig`, `APP_VERSION`, `appsscript.json`.
  - **TC-6.3:** dựng Sheet bằng **đúng Code 1.0.0** (`tests/fixtures/Code-1.0.0.gs`, chạy `setup` của 1.0.0) rồi thêm dữ liệu qua chính API 1.0.0:
    - 5 học sinh, trong đó một em có "PIN riêng".
    - 1 đề đang mở, 1 đề nháp.
    - 6 bài nộp.
  - **Chỉnh tay kiểu giáo viên:**
    - chèn cột "SĐT phụ huynh" **giữa** HocSinh;
    - để một hàng trống giữa bảng;
    - thêm cột "Ghi chú GV" cuối KetQua (có ô kiểu số);
    - sửa một điểm thành số;
    - thêm cột "Nguồn (GV)" cuối CauHoi;
    - thêm trang riêng "Bảng điểm tay" (có công thức, ngày, số);
    - thêm dòng CaiDat riêng và đổi `TEN_UNG_DUNG`.
  - **Chạy và so:** chụp lại trang tính, Script Properties và mọi kết quả API của 1.0.0 (bảng điểm, kết quả, xếp hạng, thống kê đề, danh sách học sinh/đề, `myResults`, `myStats`, `getResult`, `listExams`). Sau đó nạp Code.gs mới vào **cùng** Sheet và chạy `setup()`. So **từng ô cũ**, rồi so từng trường cũ của các API.
  - **TC-6.4:** `setup()` 3 lần trên Sheet trống, 2 lần trên Sheet đã nâng cấp. So định dạng số theo **tên cột** của `KetQuaLuyenTap` với `KetQua`.
  - **`kiemTraSauTrienKhai()`:** chạy ở 7 tình huống. Đếm mọi lần ghi:
    - ghi Sheet và ghi file kho (thống kê của shim);
    - `insertSheet`/`deleteSheet`, `setProperty`, số khóa đệm (bọc thêm hàm đếm).

    Đặt mật khẩu giả và PIN riêng giả, rồi tìm hai chuỗi này (cùng khóa ký phiên) trong nhật ký.
  - **TC-6.5:** chạy `tests/scan-secrets.js`, rồi chạy bộ quét riêng của người kiểm thử:
    - tìm email, chuỗi giống id Drive (25–60 ký tự, đủ chữ hoa, chữ thường và số), mật khẩu có giá trị, PIN 4–8 số đứng cạnh chữ PIN;
    - quét nội dung **HEAD** của mọi file đang theo dõi, cộng các file mới chưa commit;
    - thêm `git log -p --all` để tìm id kiểu Drive và email trong lịch sử.

    Mỗi phát hiện được đánh giá tay. Lý do đánh giá ghi trong `verdict()`.
  - **TC-6.6, phần Node:** đối chiếu tên hàm, trang tính, khóa CaiDat, file tài liệu và các câu tài liệu khẳng định ("✅ Cài đặt xong!", "5 trang tính", "dòng đầu có `var APP_VERSION`", PIN 0101, `CHO_LUYEN_TAP` mặc định, `7,1,2,10`, ghi chú `TEN_GIAO_VIEN` giữ nguyên) với hành vi thật.
- **`tests/pha6-kiem-thu.e2e.js`** (Playwright, TC-6.6): làm theo VIEC-GIAO-VIEN nhóm A (A4, A6, A7), nhóm C "bật luyện tập", và README "Khi cập nhật Code.gs" / "Dùng thử". Chạy trên 3 dev-server mới:
  - máy chủ mới, `PRACTICE=0` (như sau A4);
  - `SERVER_COMPAT=1.0.0`;
  - một cổng chuyển từ 1.0.0 sang 1.5.0 ngay trong lúc trình duyệt đang mở trang, để thử câu "F5 một lần".
- **TC-6.2:** script `run-tc62.sh` (để ở thư mục nháp) chạy tuần tự **mọi** test Node và e2e:
  - mỗi e2e chạy trên một dev-server khởi động mới;
  - test cần dev-server ngoài thì chạy hai lần, máy chủ mới và `SERVER_COMPAT=1.0.0`; test tự khởi động dev-server thì chạy chế độ `all` (đã gồm hai máy chủ);
  - cổng 8790–8794 (đặt qua `PORT`, `PORT_NEW`, `PORT_OLD`, `PORT_OFF`, `PORT_V2`, `PORT_TRUOC`), không đụng cổng 8795 của người soát;
  - ảnh của các e2e cũ ghi vào thư mục nháp, không ghi đè ảnh trong repo.
- **Môi trường:** KaTeX, Chart.js, JSZip, xlsx lấy từ `LIBS_DIR` qua route giống `routeCdn` của Pha 2. Google Fonts và ảnh `lh3` bị chặn.
- **Đã làm / không làm:** không sửa code tính năng hay hạ tầng test. Không commit (riêng `tests/pha6-kiem-thu.test.js` đã được phiên điều phối commit tạm ở `0addd2a`).

**Lệnh chạy:**
```
node tests/pha6-kiem-thu.test.js                       # OUT=<thư mục> để lưu nhật ký/JSON bằng chứng
NODE_PATH=$(npm root -g) LIBS_DIR=… node tests/pha6-kiem-thu.e2e.js
```

## Bảng TC

| TC | Kết quả | Bằng chứng |
|---|---|---|
| TC-6.1 | **ĐẠT** | `doGet` → `{version: "1.5.0"}`; `publicConfig.version = "1.5.0"`, `features = [changePin, goal, bootstrap, cache, bank, practice]`; `APP_VERSION = '1.5.0'`. Thêm: `appsscript.json` không có `oauthScopes`; `setup()` chạy được trên shim không có `ScriptApp` (không tạo trigger) |
| TC-6.2 | **KHÔNG ĐẠT** (chỉ vì K-1) | **Node (15 file):** `backend` 13/13, `importer` đạt, `bank` 30/30, `common-cache` 5/5, `docx` 29/29, `pha1-kiem-thu` 29/29, `pha2-kiem-thu` 31/31, `pha3-kiem-thu` 17/17, `pha4-kiem-thu` 33/33, `pha5-kiem-thu` 27/27, `pha4` 22, `pha5` 11. `cache` lần đầu 16/17 (TC-1.12b chập chờn, N-1), chạy lại 30/30 lần đạt. **`pha6` 7/8** (TC-6.5 = K-1). **e2e, mỗi lần một dev-server mới, cả máy chủ mới và `SERVER_COMPAT=1.0.0`:** `e2e.js` ×2, `bank.e2e` ×2, `docx.e2e` ×2, `pha1-r1.e2e` ×2 đều ĐẠT; `pha1-kiem-thu.e2e all` 57 ✓ 0 ✗; `pha2-kiem-thu` 16/16; `pha3-kiem-thu` 23/23; `pha4-kiem-thu` 22/22; `pha5-kiem-thu` 16/16 (không có `MAIN_DIR`/`WIDE_DIR`/`FONTS_DIR` nên phần so bố cục với `main` được bỏ qua; Pha 6 không đổi giao diện); `pha4.e2e all`, `pha5.e2e all` đạt. Cổng 8790–8792, không trùng 8795 |
| TC-6.3 | **ĐẠT** | So **477 ô cũ** ở 6 trang (kể cả trang riêng "Bảng điểm tay"): **0 ô đổi**, không mất trang, thứ tự trang giữ nguyên. Chỉ thêm `LuyenTap`, `KetQuaLuyenTap`. Số hàng không đổi ở mọi trang dữ liệu (không gieo lại HS/đề mẫu). Cột thêm: KetQua chỉ "Mục tiêu" (ở **sau** cột riêng của GV); CauHoi đúng 5 cột "Mã câu kho, Chương, Bài, Mức độ từng ý, Nguồn"; HocSinh/DeThi/CaiDat/trang riêng không thêm cột. CaiDat chỉ thêm 4 dòng cuối (`KHO_CAU_HOI_ID, THU_MUC_HINH_KHO_ID, CHO_LUYEN_TAP, LUYEN_NHANH`). Sau nâng cấp, 12 API cũ trả **đúng từng trường** như 1.0.0 (bảng điểm, kết quả, xếp hạng, thống kê đề, danh sách đề/học sinh, lớp, `myResults`, `myStats`, `getResult` bài cũ, `listExams`). Đăng nhập được học sinh PIN ngày sinh và học sinh "PIN riêng" cũ. Làm lại đề cũ được 10 điểm; hàng KetQua mới đúng cột cũ dù có cột GV chèn giữa, cột "Ghi chú GV" để trống, hàng cũ không bị chạm; bảng điểm cập nhật (best 10, n=2) |
| TC-6.4 | **ĐẠT** | Sheet trống: `setup` ×3 → lần 2, 3 không đổi ô nào; 7 trang, 14 khóa CaiDat, không trùng trang/khóa/cột. Sheet 1.0.0 đã nâng cấp: thêm 2 lần, không đổi gì; 15 khóa (có dòng riêng của GV). `KetQuaLuyenTap` cùng định dạng với `KetQua` ở **19 cột chung**, gồm 6 cột số `0.00`/`0` (Điểm thang 10, Điểm gốc, Điểm tối đa, Số câu đúng, Tổng số câu, Số giây), và nền `@` của trang. Đúng cả trên Sheet nâng cấp, nơi cột của KetQua bị lệch chỗ vì có cột riêng của GV |
| `kiemTraSauTrienKhai` | **ĐẠT** | 7 tình huống: đủ + kho giả; kho dán dạng **link** trình duyệt; kho sai id; thiếu trang `LuyenTap` + thiếu cột "Mục tiêu" + đổi tên cột "Mã câu kho"; dán code nhưng **quên `setup`**; chưa điền kho; CauHoi 960 hàng. Mọi lần: **không ném lỗi, 0 lần ghi Sheet, 0 lần ghi kho**, 0 `insertSheet/deleteSheet/setProperty`; chỉ ghi/xóa đúng **1 khóa đệm** `kiemtra_*`. Nhật ký **không chứa** mật khẩu giả, PIN riêng giả, khóa ký phiên. Báo đúng: `❌ Thiếu trang tính "LuyenTap". Hãy chạy hàm setup() một lần.`, `❌ KetQua: thiếu cột "Mục tiêu"…`, `❌ CauHoi: thiếu cột "Mã câu kho"…`, `❌ Kho câu hỏi: Không mở được kho … Kiểm tra KHO_CAU_HOI_ID…`, `⚠️ Chưa có KHO_CAU_HOI_ID…`, `⚠️ CauHoi đã dùng 960/1000 hàng…`. Không tự sửa (trang thiếu vẫn thiếu). Mọi dòng ❌ có cách sửa. Nhật ký mẫu ở mục dưới |
| TC-6.5 | **KHÔNG ĐẠT** (K-1) | **Nội dung repo sạch** (HEAD): bộ quét riêng có 133 phát hiện, đều vô hại sau khi đánh giá. Email: 9, đều là tên miền ví dụ, tên gói npm hoặc ký tên commit. Chuỗi giống id: 5, gồm id Doc quy trình ở 3 file được phép, hằng số trong `scan-secrets.js` (cùng id đã công khai) và 2 tên file/ảnh. "Mật khẩu" có giá trị: 54, đều là mã nguồn/thuộc tính HTML/biến. PIN: 65, đều là PIN học sinh giả trong test, `0101` mẫu, ví dụ "05/03 → 0503", "0000", hoặc chuỗi thử của người soát. **Nhưng `node tests/scan-secrets.js` thoát mã 1** trên HEAD: báo nhầm `` ADMIN_PW=` `` ở `docs/bao-cao/pha-6.md:21` (và nay thêm 4 chỗ trong `pha-6-soat.md`). `tests/pha6.test.js` vì thế chỉ 7/8. Lịch sử git: xem N-2 |
| TC-6.6 | **KHÔNG ĐẠT** (K-2 → K-6) | Bước làm được trên shim/dev-server: xem bảng "Đi theo tài liệu" dưới đây. 4 chỗ tài liệu sai/thiếu; 1 lỗi giao diện ảnh hưởng nhóm C |
| TC-6.7, 6.8 | (6b, cần giáo viên) | Không chạy ở 6a |

### Đi theo tài liệu (TC-6.6)

| Bước tài liệu | Làm ở đây | Kết quả |
|---|---|---|
| A1 Sao lưu (Tệp → Tạo bản sao; ghi số "Phiên bản") | — | **cần giáo viên** |
| A2 Dán Code.gs, Lưu; "dòng đầu có `var APP_VERSION = '1.5.0';`" | nạp Code.gs mới vào Sheet 1.0.0 trên shim | Dán được. **Sai (K-5):** dòng 1 là `/**`, `APP_VERSION` ở dòng 21. Nút "Copy raw file", tên file `Code.gs`/`Mã.gs`: **cần giáo viên** |
| A3 Chạy `setup`, cấp quyền; nhật ký "✅ Cài đặt xong!"; có `LuyenTap`, `KetQuaLuyenTap`; KetQua thêm "Mục tiêu", CauHoi 5 cột từ "Mã câu kho", thêm dòng cuối CaiDat | shim | **Đúng** từng ý (TC-6.3). Cấp quyền / "chưa xác minh": **cần giáo viên**. Ghi chú: nhật ký `setup` có in mật khẩu quản trị (giống 1.0.0, xem soát R-3) |
| A4 CaiDat: `KHO_CAU_HOI_ID` (dán **địa chỉ** trình duyệt), `THU_MUC_HINH_KHO_ID`, `CHO_LUYEN_TAP` = KHONG; ghi chú `TEN_GIAO_VIEN` cũ không bị sửa | shim + trang Cài đặt | **Đúng.** Dán link `https://docs.google.com/spreadsheets/d/<id>/edit#gid=0` và link thư mục `…/drive/folders/<id>?usp=sharing` đều được nhận: `kiemTraSauTrienKhai` ✅; trang quản trị "Lưu cài đặt" → "↻ Đọc lại kho" → "Kho có 54 câu". Trang Cài đặt có đủ ô: "Kho câu hỏi (id hoặc link…)" (`KHO_CAU_HOI_ID`), "Thư mục hình của kho" (`THU_MUC_HINH_KHO_ID`), "Mục Luyện tập cho học sinh" Bật/Tắt (`CHO_LUYEN_TAP`, mặc định Tắt), "Đề nhanh theo bài" = `7,1,2,10` (`LUYEN_NHANH`). Ghi chú cũ "hiển thị ở chân trang" giữ nguyên |
| A5 Triển khai → Quản lý → ✏ → Phiên bản mới | — | **cần giáo viên** |
| A6 `kiemTraSauTrienKhai` → nhật ký ✅/⚠️/❌ | shim | **Đúng** (xem bảng TC); dòng ❌ đều ghi cách sửa |
| A6 Cài đặt → khung **Dữ liệu** (cuối trang) → "Phiên bản máy chủ 1.5.0"; nếu vẫn số cũ thì làm lại A5 | dev-server | **Đúng**: "Phiên bản máy chủ 1.5.0" (ảnh `kt-01`). Với máy chủ 1.0.0 trang ghi "1.0.0" |
| A6 "Trên máy đã từng mở web, F5 **một lần** để Đổi PIN và Mục tiêu hiện ra" | cùng địa chỉ, 1.0.0 → 1.5.0 | **Sai (K-2):** F5 ba lần vẫn không hiện; chỉ hiện khi bản nhớ `publicConfig` trong trình duyệt quá ~5–10 phút, hoặc mở thẻ mới. Trang quản trị cũng vậy (ảnh `kt-06`) |
| A6 Thử nhanh: đăng nhập 1 học sinh mẫu | dev-server | **Đúng**: 12A1 / Học Sinh Mẫu / PIN 0101 vào được, có nút "Đổi PIN" (ảnh `kt-02`) |
| A6 "Ngân hàng → Ma trận 1 chạm lớp 12 → Tạo đề → xem hình → Lưu (để Bản nháp) → xóa đề thử" | dev-server | **Làm được nhưng thiếu bước (K-6):** thực tế là chọn **Lớp 12** ở bộ lọc → **Tạo ma trận** → hộp "Ma trận đề: Tìm được 28 câu" → **Thêm vào giỏ** → **Tạo đề (28 câu) →** → đặt **Tên đề** → **💾 Lưu đề**. Trạng thái mặc định "Bản nháp" đúng; hình tự gắn đúng số câu có hình (ảnh `kt-03`); đề lưu hiện "Bản nháp" trong danh sách; nút **Xóa** xóa được |
| A7 Quay về phiên bản cũ; giao diện tự ẩn nút cần máy chủ mới | `SERVER_COMPAT=1.0.0` | Phần Apps Script: **cần giáo viên**. Phần giao diện **đúng**: Ngân hàng báo "Cần cập nhật máy chủ", Đổi PIN ẩn, học sinh đăng nhập/làm bài được, 0 lỗi JS |
| C "Đưa vào luyện tập", tab **Pool luyện tập**, nút **Tắt**; "Cài đặt → Mục Luyện tập = Bật → Lưu cài đặt" | dev-server | Nhãn **đúng**; học sinh F5 thấy "🎯 Luyện tập" (ảnh `kt-04`, `kt-05`). **Lỗi (K-3):** ngay sau "Lưu cài đặt", tab Ngân hàng mất "Đưa vào luyện tập" và "Pool luyện tập" tới khi F5 |
| README Cài đặt Bước 1.4 "quay lại Google Sheet sẽ thấy **5 trang tính**…" | shim | **Sai (K-4):** `setup` tạo **7** trang (README đoạn trên cũng ghi 7) |
| README Bước 4 (12A1, Học Sinh Mẫu, PIN 0101; mật khẩu ở `CaiDat` dòng `MAT_KHAU_QUAN_TRI`) | shim + dev-server | **Đúng** |
| README "Khi cập nhật Code.gs" 1–6 | như A1–A7 | Như trên: bước 3, 5 đúng; bước 1, 2, 4, 6 phần Apps Script **cần giáo viên** |
| README Soạn đề "Đề thi → + Tạo đề mới", "Nhập nhanh từ Word / Excel → Tải file lên"; Học sinh "+ Thêm học sinh", "⇪ Nhập danh sách", "🖨 In phiếu", "Sửa"; Ngân hàng "↻ Đọc lại kho" | dev-server | **Đúng** (B3 của VIEC-GIAO-VIEN ghi "Đề thi → Tạo đề", nút thật là "+ Tạo đề mới" — gộp vào K-6) |
| Mọi tên trang tính (`HocSinh … KetQuaLuyenTap`), khóa CaiDat (`KHO_CAU_HOI_ID, THU_MUC_HINH_KHO_ID, CHO_LUYEN_TAP, TEN_GIAO_VIEN, MAT_KHAU_QUAN_TRI`), hàm (`setup`, `kiemTraSauTrienKhai`), file `docs/…` nêu trong hai tài liệu | shim | **Đều có thật** |

### Nhật ký `kiemTraSauTrienKhai` (shim, đủ dữ liệu + kho giả)
```
KIỂM TRA SAU TRIỂN KHAI
✅ Phiên bản máy chủ: 1.5.0 · tính năng: changePin, goal, bootstrap, cache, bank, practice
✅ HocSinh: đủ 8 cột, 2 hàng dữ liệu.
…
✅ Mở được kho câu hỏi: trang "Kho câu hỏi" có 54 hàng, đủ cột cần đọc.
✅ Mở được thư mục hình của kho: "02. HÌNH VẼ".
✅ Luyện tập cho học sinh: đang TẮT (bật ở Cài đặt khi đã đưa câu vào luyện tập).
✅ Bộ nhớ đệm (CacheService): ghi/đọc thử được.
✅ TẤT CẢ ĐỀU ỔN. Mở trang quản trị → Cài đặt: phải thấy "Phiên bản máy chủ 1.5.0".
```

## Lỗi

### K-1 (Vừa) — `scan-secrets.js` đỏ trên nhánh (báo nhầm), TC-6.5 và `pha6.test.js` không đạt
- `node tests/scan-secrets.js` (trên worktree sạch của HEAD) → `✗ docs/bao-cao/pha-6.md:21  mật khẩu  ADMIN_PW=``,` → thoát mã 1. Từ `0addd2a` thêm 4 phát hiện cùng kiểu trong `pha-6-soat.md`.
- Nguyên nhân: mẫu `ADMIN_PW=(?![<$.…\s'"])\S+` không loại dấu backtick. Không phải lộ bí mật. Báo cáo người làm ghi "0 phát hiện, 8/8" là số cũ (trước `190d81e`). Trùng R-1 của người soát.
- Đề xuất: thêm `` ` `` vào lookahead (hoặc đòi giá trị `[A-Za-z0-9]{6,}`), chạy lại.

### K-2 (Vừa) — Sau khi triển khai, máy đã mở web trong ~10 phút trước vẫn chạy chế độ "máy chủ cũ"; F5 không giúp
- **Tái hiện** (`pha6-kiem-thu.e2e.js`, phần "Chuyển máy chủ"):
  - Cùng địa chỉ: mở trang học sinh và trang quản trị khi máy chủ là 1.0.0.
  - Thay bằng máy chủ 1.5.0, bấm F5.
  - Học sinh: F5 lần 1, 2, 3 vẫn **không có "Đổi PIN"**. Khi F5, trang không gọi lại `publicConfig` (chỉ `listExams, myResults`).
  - `localStorage.ld_pub` vẫn là `{"version":"1.0.0"}`, không có `features`.
- **Thử lùi giờ bản nhớ:**
  - lùi `ld_pub_t` 5 phút: vẫn ẩn;
  - lùi 10 phút: hiện;
  - mở thẻ mới: hiện.
- **Trang quản trị:** sau F5, tab Ngân hàng vẫn báo "Ngân hàng câu hỏi cần máy chủ mới. Máy chủ đang chạy phiên bản 1.0.0. Cần cập nhật máy chủ…" (ảnh `kt-06-ngan-hang-sau-trien-khai-van-bao-1.0.0.png`). Trong khi đó trang Cài đặt (đọc thẳng từ máy chủ) ghi 1.5.0.
- **Ảnh hưởng:**
  - Thầy làm A5 rồi A6 ngay trên trang quản trị đã mở để điền A4 sẽ gặp đúng tình huống này. Thầy có thể làm lại A5 hoặc quay về bản cũ (A7) không cần thiết.
  - Học sinh đã mở web trong 10 phút trước không thấy Đổi PIN, Mục tiêu, Luyện tập cho tới khi bản nhớ hết hạn.
  - Không mất dữ liệu.
- **Đề xuất:**
  - (a) Giao diện: khi bản nhớ `publicConfig` không có `features` (máy chủ cũ), luôn gọi lại `publicConfig` lúc tải trang, hoặc giảm thời hạn bản nhớ cho trường hợp này. Chỉ đổi `common.js`, không đổi Code.gs.
  - (b) Tối thiểu: sửa A6 thành "đợi khoảng 10 phút rồi F5, hoặc mở thẻ mới / cửa sổ ẩn danh". Thêm vào A6: "tab Ngân hàng báo cần cập nhật trong khi Cài đặt ghi 1.5.0 thì chỉ cần đợi".
- Hành vi bản nhớ có từ Pha 1. Câu sai nằm ở tài liệu Pha 6.

### K-3 (Nhẹ, có sẵn trên `main` từ Pha 4) — "Lưu cài đặt" làm tab Ngân hàng mất "Đưa vào luyện tập" và "Pool luyện tập" tới khi F5
- **Tái hiện:** Cài đặt → bấm "Lưu cài đặt" (đổi hay không đổi gì cũng vậy) → tab Ngân hàng: không còn `#tabPool`, không còn nút `#cartPractice`. F5 thì hiện lại.
- Sau khi lưu, `localStorage` chỉ còn `ld_admin_user, ld_admin_token, ld_bank_filter`; `ld_pub` bị xóa mà không được tải lại.
- Đối chứng trên worktree `main` (`4b14311`): cùng kết quả.
- **Ảnh hưởng:** nhóm C ("Bật luyện tập → Lưu cài đặt", rồi "Đưa vào luyện tập" / "Pool luyện tập") và A4 nếu thầy điền ở trang Cài đặt.
- **Đề xuất:** sau `adminSaveSettings`, tải lại `publicConfig` (hoặc giữ `features` cũ). Không thì thêm "bấm F5" vào nhóm C.

### K-4 (Nhẹ) — README Bước 1.4: "sẽ thấy 5 trang tính"
`setup` 1.5.0 tạo 7 trang (`… CaiDat, LuyenTap, KetQuaLuyenTap`). Đoạn "Cách hệ thống hoạt động" của README đã ghi 7. Sửa thành "7 trang tính".

### K-5 (Nhẹ) — VIEC-GIAO-VIEN A2: "Kiểm tra dòng đầu có `var APP_VERSION = '1.5.0';`"
Dòng 1 của Code.gs là `/**`; `var APP_VERSION = '1.5.0';` ở **dòng 21**, sau khối chú thích. Đề xuất: "Ctrl+F tìm `APP_VERSION`, phải thấy `'1.5.0'`". Trùng R-6b của người soát.

### K-6 (Nhẹ) — VIEC-GIAO-VIEN A6 / B3: thiếu bước, sai nhãn nút
- A6: "Ma trận 1 chạm lớp 12 → Tạo đề → … → Lưu". Trên giao diện là: chọn **Lớp 12** ở bộ lọc → **Tạo ma trận** → hộp "Ma trận đề" → **Thêm vào giỏ** → **Tạo đề (28 câu) →** → nhập **Tên đề** (bắt buộc) → **💾 Lưu đề**. Xóa: nút **Xóa** ở dòng đề trong tab Đề thi.
- B3: "Đề thi → Tạo đề → Nhập nhanh". Nút thật là **+ Tạo đề mới** → **⇪ Nhập nhanh từ Word / Excel** → **Tải file lên**.
- Trùng một phần R-7 của người soát.

## Ghi chú ngoài TC

### N-1 (đề xuất cho kiến trúc sư, nên quyết trước khi giáo viên dán Code.gs) — "Mã bài" có thể trùng
- `tests/cache.test.js` TC-1.12b chập chờn:
  - lần chạy đầu trên nhánh: 1 lỗi; sau đó 30/30 lần đạt;
  - trên `main`: 1/30 lần lỗi.
- **Nguyên nhân:** `Mã bài` = `KQ` + `yyMMddHHmmss` + 3 chữ số ngẫu nhiên. Thử 150 lần, mỗi lần 3 bài nộp liền nhau trên shim: **3/150 lần có hai bài cùng mã**, ví dụ `KQ261120094416508` ×2.
- **Ảnh hưởng thật:** cả lớp nộp lúc hết giờ thì có thể trùng mã.
  - `getResult` lấy hàng đầu tiên trùng mã, nên một học sinh có thể bị báo "Bạn không xem được bài làm này".
  - `adminDeleteResult` có thể xóa nhầm bài.
- Có từ 1.0.0, không do Pha 6. Nhưng Pha 6 là lần dán Code.gs duy nhất, nên đây là lúc rẻ nhất để sửa: thêm `Utilities.getUuid()` rút gọn hoặc mili-giây vào mã.

### N-2 (thông tin) — Lịch sử git còn id file Drive thật
- HEAD sạch. Nhưng lịch sử (commit `690b4a6`, `c14b3e8` …, đã xóa ở `7cb813a` của Pha 3) còn **5 id Drive thật**: file kho "KHO CÂU HỎI VẬT LÝ", thư mục "01. ĐỀ GỐC ĐÃ NHẬP", 2 file đề `.docx`, và 1 id khác trong `docs/BAN-GIAO.md`/`QUYET-DINH.md` cũ.
- Lịch sử cũng còn 4 email giả `…@gmail.com` cũ (`hs@`, `thay@`, `hocsinh@`), đã đổi sang `example.com` ở `60a0147`.
- Đặc tả chỉ đòi HEAD. Repo công khai thì ai cũng xem được các id này, nhưng mở file vẫn cần quyền Drive của thầy.
- Muốn xóa hẳn thì phải viết lại lịch sử (force-push `main`), trái quy tắc 00 §4, nên chỉ ghi để giáo viên biết.

### N-3 — `setup` in mật khẩu quản trị vào nhật ký
Hành vi này có từ 1.0.0. Bước A3 bảo thầy xem nhật ký đó. Đồng ý với R-3 của người soát: thêm câu "không gửi nhật ký `setup`, chỉ gửi nhật ký `kiemTraSauTrienKhai`".

### Hạ tầng test
Không sửa `gas-shim.js` hay `dev-server.js`. Trong `pha6-kiem-thu.e2e.js`, phần "Chuyển máy chủ" có một điểm khác máy thật: dev-server mới sinh khóa ký phiên mới, nên trình duyệt phải đăng nhập lại. Trên Apps Script thật, Script Properties được giữ nên phiên cũ vẫn dùng được. Điểm này không ảnh hưởng kết luận K-2: bản nhớ `ld_pub` vẫn cũ kể cả sau khi đăng nhập lại.

## Ảnh (`docs/bao-cao/anh/pha-6/`)
- `kt-01-cai-dat-du-lieu-1.5.0.png` — khung Dữ liệu, "Phiên bản máy chủ 1.5.0".
- `kt-02-hoc-sinh-mau-trang-chu.png` — Học Sinh Mẫu đăng nhập, có Đổi PIN.
- `kt-03-tao-de-tu-ngan-hang.png` — trình soạn sau "Tạo đề (28 câu)", trạng thái Bản nháp.
- `kt-04-pool-luyen-tap.png`, `kt-05-hoc-sinh-luyen-tap.png` — sau khi bật luyện tập.
- `kt-06-ngan-hang-sau-trien-khai-van-bao-1.0.0.png` — K-2.

## Kết luận
**CHƯA ĐẠT.**
- **Phần máy chủ đạt hết:** TC-6.1, 6.3, 6.4, `kiemTraSauTrienKhai`.
- **TC-6.5 không đạt** vì công cụ quét báo đỏ (K-1), dù nội dung repo sạch.
- **TC-6.6 không đạt** vì tài liệu sai/thiếu: K-2 (Vừa), K-4, K-5, K-6. Thêm lỗi giao diện K-3 có sẵn từ Pha 4.
- **TC-6.2:** mọi test cũ đạt ở cả hai máy chủ; chỉ `pha6.test.js` đỏ vì K-1.
- **Để đạt cần:**
  - sửa K-1;
  - sửa K-2 (ưu tiên sửa `common.js`, tối thiểu sửa A6);
  - sửa chữ K-4/K-5/K-6.

  K-3 và N-1 nên sửa trong vòng này (N-1 đổi Code.gs nhưng vẫn là 1.5.0 vì chưa triển khai). Sau đó chạy lại toàn bộ TC.
