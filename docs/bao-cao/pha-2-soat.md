# Soát code Pha 2 — Nối ngân hàng câu hỏi

Người soát: độc lập (không phải người làm). Nhánh `pha-2-ngan-hang` (commit `898fdd3`), so với `main` (`git diff main...pha-2-ngan-hang`, 2 commit: 950c433, 898fdd3).
Ngày: 18/11/2026.

## Kết luận: **ĐẠT**
Không có phát hiện Nặng. Có 1 phát hiện Vừa nên sửa trước khi gộp (R-1, giao diện vẽ đè màn khác). Các phát hiện còn lại đều Nhẹ, sửa được ở vòng sau hoặc ở Pha 6.

## Đã kiểm
- **Test chạy lại**: `node tests/backend.test.js` 13/13 đạt; `node tests/cache.test.js` 17/17 đạt; `node tests/bank.test.js` 23/23 đạt. Không chạy e2e vì agent kiểm thử đang dùng chung thư mục.
- **Bảo mật**
  - Cả 5 action `adminBank*` gọi `requireTeacher_` ngay dòng đầu (`Code.gs` 1553, 1585, 1598, 1652, 1680). Có test gọi bằng token học sinh và không có token, cả hai trả `AUTH`.
  - `startExam` liệt kê tường minh các trường gửi đi (`Code.gs` 467–469). `buildResultView_` cũng vậy, nên `maKho`, `mucDoY`, `chuong`, `nguon` không ra phía học sinh. `dapAn`/`loiGiai` chỉ ra khi `canReveal_` cho phép, như trước.
  - Id kho và id thư mục chỉ nằm trong CaiDat. `publicConfig` không trả CaiDat; `adminGetSettings` chỉ dành cho giáo viên.
  - Giỏ câu trong `sessionStorage` chỉ chứa mã câu. Không có lệnh `cacheSet` nào nhận dữ liệu kho.
  - Chia sẻ "ai có liên kết" chỉ gọi trên `copy` (`Code.gs` 1702). File gốc chỉ bị `makeCopy`, có test 0 lần `setSharing`.
  - Diff không có chuỗi giống id Drive (≥ 28 ký tự).
  - `tests/fixtures/kho-gia.js` là dữ liệu tự soạn: "Câu hỏi mẫu số n (tự soạn)", "Nguồn mẫu A–E", "Tỉnh mẫu". Đúng 22 cột tiêu đề.
- **XSS**
  - Mọi chuỗi kho hiện trên tab Ngân hàng, trong modal, trình soạn và hộp cảnh báo đều qua `esc()` hoặc `rich()`.
  - `rich()` mới: phần chữ của mỗi ô bảng qua `inline()`, tức `esc` trước khi định dạng. Công thức tách trước khi cắt dòng, nên `|` trong `$…$` không làm vỡ bảng. Văn bản không có `[BẢNG]` cho kết quả như cũ.
- **Đúng dữ liệu**
  - `bankTF_` đọc đủ 3 kiểu và kiểu chữ hoa `A) Đ B) S …`, kể cả khi có dấu chấm cuối. Đã thử thêm ngoài test.
  - Phần III: giữ nguyên chuỗi. `parseNum_` bỏ khoảng trắng, nên `- 120` vẫn chấm đúng. `safe_` chặn `=`/`+` đầu ô.
  - Mức độ ánh xạ tường minh. Chủ đề lấy theo Bài.
  - Câu thiếu đáp án và Phần IV bị chặn ở chỉ mục (`loi`). Khi lấy câu đầy đủ, `bankPick_` gọi lại `bankToQuestion_` trên **hàng vừa đọc**. `validateQuestion_` từ chối `phan > 3`.
- **Đọc đúng hàng**
  - `bankPick_` (1731) so ô "Mã câu" của từng hàng đọc được với mã cần lấy. Không khớp, hoặc hàng đã vượt `lastRow`, thì dựng lại chỉ mục một lần rồi lấy theo mã. Nội dung luôn lấy từ hàng vừa đọc, không lấy từ đệm.
  - Có test chèn hàng. Đã soát thêm hai trường hợp xóa hàng và sắp xếp lại: đều đi vào nhánh "stale".
- **5 cột mới của CauHoi**: chỉ thêm ở cuối `SCHEMA`.
  - `readSheet_` trả `''` khi thiếu cột.
  - `replaceQuestions_` gọi `headerOf_` trước `getDataRange`, nên độ rộng khớp.
  - `readCachedTable_` so danh sách khóa với `SCHEMA`, nên đệm 1.2.0 tự trượt.
  - Có test cho Sheet cũ thiếu các cột này.
- **Hạ tầng Pha 1**
  - Chỉ mục dùng `cacheGetChunked_`/`cachePutChunked_` có kiểm độ dài, thế hệ `bankgen` và kiểm `packed.id === id` (đổi kho thì dựng lại).
  - Các action kho chỉ đọc trang của web qua `readTable_` (đệm). Ghi vẫn chỉ qua `adminSaveExam` (trong khóa, đọc fresh).
  - Shim xóa `MEMO_` mỗi request, nên TC-2.11 "`openById` = 1" là phép kiểm thật.
- **Tương thích 1.0.0**: `FEATURE_OF` ánh xạ `adminBank*` → `bank`. `canTry` hoặc lỗi `unsupported` dẫn tới "Cần cập nhật máy chủ". Cài đặt ẩn hai ô kho.
- **Giới hạn**
  - Chia lô: tối đa 40 hình mỗi lượt, mốc 255 s; shim chạy bằng đồng hồ giả.
  - Chỉ mục kho thật khoảng 970 KB: 11 mảnh 90 KB, dưới ngưỡng 2 MB.
  - `IMG_*` khoảng 60 B/hình: kho thật có ≈ 2 800 hình ≈ 170 KB, dưới 500 KB.
- `APP_VERSION` tăng lên 1.3.0. "Việc giáo viên cần làm" có bước dán Code.gs, chạy `setup` để cấp quyền và triển khai Phiên bản mới (CLAUDE.md mục 6).
- **Test của người làm có kiểm đúng điều tuyên bố**: TC-2.1 → 2.11 khẳng định đúng tiêu chí. TC-2.8 đo từng lượt bằng đồng hồ giả và đếm `makeCopy` = 300. TC-2.11 đếm ô đọc ≤ 22 + 28 × 22 và 0 lần `getDataRange` trên kho. Riêng TC-2.13 dành cho agent dữ liệu.

## Bảng phát hiện

| Mã | Mức | File:dòng | Mô tả | Tái hiện | Đề xuất sửa |
|---|---|---|---|---|---|
| R-1 | **Vừa** | `assets/js/admin.js` 576–590 (`viewBank`), 707 (`bkReload`) | Sau `await api('adminBankMeta')`, giao diện không kiểm tra người dùng còn ở tab Ngân hàng không (không dùng `App.newView()` / so `location.hash` như Pha 1). Lần đầu dựng chỉ mục 10 000 hàng trên Apps Script thật có thể mất nhiều giây. Nếu trong lúc đó giáo viên chuyển sang "Đề thi → Tạo đề" và bắt đầu gõ, `renderBank()` vẽ đè trình soạn, làm **mất phần đang soạn chưa lưu** (`editorDirty` vẫn bật nhưng DOM đã bị thay). Lỗi `AUTH` cũng làm hộp "Chưa đọc được kho" đè lên màn đăng nhập. "Đọc lại kho" có cùng lỗi. | dev-server `LATENCY_MS=8000` → mở `#/ngan-hang` → bấm ngay "Đề thi" → "Tạo đề mới" → gõ tên đề → sau khoảng 8 s trang thành tab Ngân hàng. | Giữ `const v = App.newView()` (hoặc `const h = location.hash`) trước `await`. Sau `await`, nếu đã sang màn khác thì không vẽ, chỉ cất `bankMeta`. Làm tương tự trong `bkReload`. |
| R-2 | Nhẹ | `apps-script/Code.gs` 1688–1714 | `tiepTuc` là chỉ số trong danh sách `names`, và danh sách này dựng lại ở mỗi lượt từ `bankPick_`. Nếu giữa hai lượt kho thay đổi (câu bị loại hoặc thứ tự đổi), con trỏ có thể bỏ qua hình chưa chép. Hình chép lỗi tạm thời (lỗi Drive) cũng không được thử lại. Kết quả: câu vào đề **không có hình mà không có cảnh báo**, trừ khi lỗi ném ra. | Lượt 1 chép 40 hình. Sửa kho để một câu đứng trước con trỏ bị loại. Lượt 2 bắt đầu từ `cursor = 40`, nên bỏ qua `names[40]`. | Ở lượt cuối (không còn `tiepTuc`), cảnh báo mọi câu có `p.hinh` mà chưa có `IMG_`. Hoặc bỏ con trỏ chỉ số: mỗi lượt lấy các tên chưa có `IMG_` và chưa bị đánh dấu "không thấy" (client gửi lại danh sách đã báo thiếu). |
| R-3 | Nhẹ | `Code.gs` 1305–1310 | `bankImageName_` trả `''` khi ô hình là "Có" mà không có tên file. Khi tên file có dấu cách, hàm chỉ lấy phần sau dấu cách cuối ("Có – hinh 1.png" → `1.png`). Trong cả hai trường hợp câu vào đề không có hình và không có cảnh báo (câu có nội dung nên không bị loại). | `bankImageName_('Có')` → `''`; `bankImageName_('Có – hinh 1.png (x)')` → `1.png`. | Ô bắt đầu bằng "Có" mà không đọc ra tên `.png` thì cảnh báo, hoặc loại câu với lý do "thiếu tên hình". Cho phép dấu cách trong tên (lấy chuỗi giữa "–" và " ("). |
| R-4 | Nhẹ | `Code.gs` 1297–1302 | `bankShort_` loại đáp án Phần III khi ô kho là **số** rất nhỏ hoặc rất lớn: `String(1e-7)` = `"1e-7"`, `6.4e-19`. Cũng loại `.5` / `,5`. Hai trường hợp này hợp lệ về vật lý nhưng bị báo "đáp án không đúng định dạng". | `bankShort_(1e-7)` → `''`. | Ô kiểu số thì dùng `Utilities.formatString`/`toFixed` có kiểm soát (hoặc nhận dạng `e`). Regex cho phép `\d*[.,]\d+`. |
| R-5 | Nhẹ | `Code.gs` 1658 và 1684 | Ma trận cho mỗi phần tối đa 200 câu (tổng 600), nhưng `adminBankToQuestions` giới hạn 500. Giáo viên đặt 200–200–200 thì chỉ gặp lỗi lúc bấm "Tạo đề", sau khi đã xác nhận. | Ma trận 200/200/200 trên kho lớn → Tạo đề → "tối đa 500 câu". | Giới hạn tổng ở Matrix, hoặc giao diện cảnh báo khi giỏ > 500. |
| R-6 | Nhẹ | `Code.gs` 1695, 1701, 1710 | Mỗi lượt gọi `imageFolder_()` cho từng hình (mỗi lần `getProperty` + `getFolderById`). `getProperty('IMG_…')` gọi riêng cho từng tên, hai lần (vòng chép và vòng điền URL). Với 300 câu, mỗi lượt khoảng 600 lần đọc Properties, lặp qua khoảng 8 lượt. Kết quả vẫn đúng nhưng tốn thời gian của lượt. | — | Lấy `imageFolder_()` một lần mỗi request. Đọc `props.getProperties()` một lần rồi tra trong bộ nhớ. |
| R-7 | Nhẹ | `Code.gs` 1701 | Bản chép công khai được đặt tên `<Mã câu>.png`. Ai có URL hình (mọi học sinh làm đề) mở `drive.google.com/file/d/<id>` là thấy tên file, tức thấy mã câu kho. Trường hợp này đi vòng qua ý của TC-2.10 ("không lộ `maKho`"). Mức độ thấp vì mã câu không chứa đáp án. | Lấy `hinhAnh` từ `startExam`, đổi `lh3…/d/<id>` thành link Drive. | Đặt tên bản chép trung tính (ví dụ `kho-<số ngẫu nhiên>.png`), vì khóa `IMG_` đã giữ ánh xạ. |
| R-8 | Nhẹ | `Code.gs` 1760–1783 | Bản đồ tên hình (`bkimg_<thư mục>`) không theo `bankgen`, nên "Đọc lại kho" không làm mới. Hình mới thêm vào Drive phải chờ tới 10 phút mới được tìm thấy. Lần duyệt đệ quy đầu tiên (≈ 2 800 file) chạy ngay trong lần bấm "Xem đầy đủ" đầu tiên, không chia lô. | Thêm hình vào thư mục → "Đọc lại kho" → "Xem đầy đủ" vẫn báo "Không tìm thấy hình". | Cho `refresh` xóa luôn `bkimg_*` (hoặc gắn `bankgen` vào khóa). Có thể dựng bản đồ ngay trong "Đọc lại kho". |
| R-9 | Nhẹ | `apps-script/Code.gs` `CACHE_MAX_BYTES` (Pha 1) + cột mới | Câu từ kho mang theo Lời giải dài và LaTeX. Khoảng 20 đề 28 câu (≈ 40 KB/đề) đã có thể đưa trang `CauHoi` vượt ngưỡng 900 KB. Khi đó đệm Pha 1 tắt hẳn cho `CauHoi`: mọi `startExam`/`submitExam`/`daDung` đọc thẳng Sheet. Vẫn đúng nhưng mất phần tăng tốc. | Lưu khoảng 25 đề từ kho rồi xem `/__stats`. | Ghi rủi ro vào báo cáo. Về sau có thể đệm `CauHoi` theo đề, hoặc nâng ngưỡng riêng cho `CauHoi`. |
| R-10 | Nhẹ (có sẵn từ trước, Pha 2 làm dễ gặp hơn; **cần xác minh trên Apps Script thật**) | `Code.gs` 96–99 (`setup`), 2036–2048 (`replaceQuestions_`), `appendRows_` | `setup` chỉ định dạng văn bản (`@`) cho `getMaxRows()` hàng hiện có (thường 1 000). Tạo đề từ kho làm `CauHoi` vượt 1 000 hàng sau khoảng 36 đề. Từ đó: (a) hàng mới không có định dạng `@`, nên đáp án `3,0` có thể bị Sheet đổi thành số; (b) `getRange` vượt số hàng tối đa có thể ném "out of bounds". | Cần Apps Script thật: `CauHoi` đầy 1 000 hàng rồi lưu thêm một đề. | Trước khi `setValues`, nếu thiếu hàng thì `insertRowsAfter`/`setNumberFormat('@')` cho phần mới. Giao cho Pha 6 kiểm. |
| R-11 | Nhẹ | `docs/bao-cao/pha-2.md` (bảng "Chạy thử trên kho thật") | Báo cáo ghi khoảng 31 mã câu thật và tên thư mục thật của kho. Repo có thể công khai. 00-quy-trinh §6.6 cấm id file, nguồn và nội dung thật; mã câu không bị cấm rõ nhưng là định danh dữ liệu thật. | — | Chấp nhận được (giáo viên cần danh sách để sửa kho). An toàn hơn: chuyển danh sách mã sang Google Doc trên Drive, trong repo chỉ ghi số lượng. |

## Đánh giá các chỗ lệch đặc tả (báo cáo người làm có 9 mục)

| # | Chỗ lệch | Đánh giá |
|---|---|---|
| 1 | `tom` chỉ lưu cho câu dùng được; `viTri` dạng gọn | **Chấp nhận.** Cần để chỉ mục của kho 10 239 hàng dưới 2 MB. Câu bị loại không bao giờ được liệt kê. |
| 2 | Phần III chỉ nhận đáp án là số (hoặc nhiều số cách `\|`) | **Chấp nhận.** Máy không chấm được đáp án có đơn vị hay chữ. Loại câu kèm lý do đúng tinh thần QUYET-DINH §5 ("chỉ câu có đáp án"). Còn kẽ hở số dạng `e` (R-4). |
| 3 | Đề gốc = Nguồn + file; `adminBankSource` nhận `ma` | **Chấp nhận.** Kho thật có tới 7 file đề trong một Nguồn; gộp lại sẽ trộn đề. Tham số vẫn tên `nguon` nên giao diện cũ không vỡ. |
| 4 | Thêm lý do loại (thiếu phương án, thiếu nội dung) | **Chấp nhận.** Trùng với `validateQuestion_`, nên loại sớm tránh được lỗi lúc lưu. |
| 5 | API trả thêm trường; Matrix nhận thêm `mucDo`, `nguon` | **Chấp nhận.** Chỉ thêm, không bớt trường nào, và chỉ giáo viên nhận được. |
| 6 | "Xem đầy đủ" dùng `adminBankToQuestions`, nên chép hình ngay lúc xem | **Chấp nhận, có ghi chú.** Câu chỉ xem mà không dùng vẫn để lại một bản chép công khai trong thư mục web. Hình đề thi không nhạy cảm, nhưng xem R-7 về tên file và R-8 về lần duyệt thư mục đầu tiên chạy ngay lúc xem. |
| 7 | Không `withLock_` khi chép hình | **Chấp nhận.** Không ghi vào Sheet. Giữ khóa 4,5 phút sẽ chặn học sinh nộp bài. Hệ quả xấu nhất là thừa bản chép hoặc `IMG_` bị ghi đè, vô hại. |
| 8 | Tên file test `bank.test.js` / `bank.e2e.js` | **Chấp nhận.** Để dành `pha2.test.js` cho người kiểm thử. |
| 9 | `[BẢNG]` trong `rich()` làm ở Pha 2, bỏ dòng trống trước bảng | **Chấp nhận.** Đặc tả cho phép ("nếu Pha 3 chưa làm"). 00-quy-trinh §4 giao cho pha vào trước. Văn bản không có bảng cho kết quả như cũ. |

---

## Vòng 2 (soát lại, 19/11/2026)

Phạm vi: `git diff 50a0d0a..4565ec6` (gồm các commit lưu tạm b40582a, 07e58b9) và mục "Vòng 2" trong `docs/bao-cao/pha-2.md`.

Test chạy lại trên `4565ec6`:
- `node tests/backend.test.js`: 13/13 đạt.
- `node tests/cache.test.js`: 17/17 đạt.
- `node tests/bank.test.js`: 30/30 đạt.

Không chạy e2e vì agent kiểm thử đang chạy song song.

### Kết luận Vòng 2: **ĐẠT**
Các phát hiện R-1 đến R-8 và N-1 đều đã sửa đúng. Không có lỗi mới mức Nặng hay Vừa.

| Mã | Đánh giá |
|---|---|
| R-1 | **Đã sửa, bịt hết các đường vẽ đè.** `route()` gọi `App.newView()` mỗi lần chuyển màn. Lỗi `AUTH` gọi `logout()`, mà `logout()` lại gọi `route()`, nên mã màn cũng đổi. Sau mỗi `await` trong tab Ngân hàng đều có kiểm `viewIs`/`here()`: đọc kho lần đầu (cả nhánh lỗi), Đọc lại kho, danh sách (kèm `seq`), Ma trận (sau API và sau hộp xác nhận), Lấy đề gốc (sau API và sau hộp xác nhận), Xem đầy đủ, Tạo đề (không tự mở trình soạn nếu đã rời tab) và `drawCart`. Khi đã rời tab, `bankMeta` vẫn được cất. Cũng không còn hộp lỗi đè lên màn đăng nhập. |
| R-2, R-3 | Đã sửa. Lượt cuối rà mọi câu có hình nhưng chưa có URL, lấy theo mã câu chứ không theo con trỏ, rồi trả `thieuHinh` và cảnh báo. Trình soạn hiện nhãn trước khi lưu. Tên file có dấu cách và ô chỉ ghi "Có" đều được xử lý. |
| R-4 | Đã sửa. Đáp án nhận dạng số mũ, `.5`, `,5`. `parseNum_` vốn đã đọc được số mũ nên chấm đúng. |
| R-5 | Đã sửa. Ma trận kiểm cùng giới hạn 500 ở cả máy chủ lẫn giao diện. Giỏ quá 500 câu thì khóa nút Tạo đề. |
| R-6 | Đã sửa. Mỗi lượt gọi `getProperties()` 1 lần và `imageFolder_()` 1 lần. `secret_()` được nhớ trong `MEMO_`, mà `MEMO_` mới tinh ở mỗi lần chạy. |
| R-7 | **Đã sửa đúng.** Tên bản chép là `hinh-<12 hex>.<đuôi>`, với 12 hex là HMAC-SHA256 tính bằng `secret_()`. Bí mật chỉ nằm ở Script Properties phía máy chủ, không bao giờ trả về giao diện. Đoạn chuyển `(b + 256) % 256` cho kết quả đúng với cả byte có dấu (Apps Script thật) lẫn byte không dấu (shim). Tên bản chép không chứa mã câu. Việc tra ngược vẫn dùng `IMG_<tên gốc>` như trước. |
| R-8 | Đã sửa. `refresh` xóa `bkimg_<thư mục>` trong đệm và cả trong `MEMO_`. |
| N-1 | **Đã sửa đúng.** `bankReadRows_` đọc mỗi khối hàng liền nhau bằng 1 lần `getRange` (cột đầu → cột cuối cần đọc). `bankPick_` không đổi: vẫn so ô "Mã câu" của từng hàng với mã cần lấy, lệch thì dựng lại chỉ mục và lấy theo mã. |
| R-9, R-10 | Đã chuyển sang việc kiểm ở Pha 6. Chấp nhận. |
| R-11 | Đã bỏ danh sách mã câu thật khỏi báo cáo. |

### Phát hiện mới (Nhẹ, không chặn)
| Mã | Mức | File:dòng | Mô tả | Đề xuất |
|---|---|---|---|---|
| R-12 | Nhẹ | `apps-script/Code.gs` `bankImageName_` (≈1311–1313) | Hàm mới nhận cả phần giữa "Có –" và "(…)" làm tên file. Ô ghi hai hình ("Có – A.png, B.png (…)") vì thế bị đọc thành một tên `A.png, B.png`, không tìm thấy trên Drive. Câu không bị lỗi im lặng vì lượt cuối có cảnh báo `thieuHinh`. Kho thật hiện chỉ có một hình mỗi ô. | Nếu phần đó chứa `,` hoặc `;` thì lấy tên đầu, hoặc cảnh báo "nhiều hình". |
| R-13 | Nhẹ | `assets/js/admin.js` `logout()` | Đăng xuất không xóa `bankMeta` (thống kê kho trong bộ nhớ) và `ld_bank_*` (chỉ chứa mã câu). Không lộ đáp án; người đăng nhập lại cũng là giáo viên. | Có thể đặt `bankMeta = null` trong `logout()`. |
