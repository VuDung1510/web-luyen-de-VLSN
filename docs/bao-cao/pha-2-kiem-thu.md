# Pha 2 — Báo cáo kiểm thử (người kiểm thử + kiểm tra dữ liệu, độc lập)

Nhánh `pha-2-ngan-hang`, commit `898fdd3`, `APP_VERSION` 1.3.0. Ngày 18/11/2026.

## Tóm tắt cho giáo viên
- Kiểm thử theo đặc tả: **13/13 TC kiểm được tại đây ĐẠT**, có **TC-2.13 ĐẠT** phần làm được với kho thật. Không có lỗi chặn.
- Kho thật: đối chiếu bằng mắt **61 câu** chọn ngẫu nhiên. Kết quả: **61/61 xử lý đúng**: 56 câu dùng được ra đúng nội dung, đủ 4 phương án, đúng đáp án, mức độ, chủ đề và hình; 5 câu bị loại đúng lý do. Chạy thêm phép so tự động trên **toàn bộ 1 057 câu có đáp án**: không lệch câu nào.
- Web chỉ **đọc** kho, không ghi. Học sinh làm đề tạo từ kho được 10/10 điểm. Trình duyệt của học sinh không nhận đáp án, lời giải hay mã câu kho.
- Chưa thử được trên Apps Script và Google Drive thật: quyền truy cập, thời gian dựng chỉ mục, chép hình thật. Phần này để giáo viên kiểm ở Pha 6.

## Cách kiểm
- `tests/pha2-kiem-thu.test.js` (máy chủ, hộp đen qua `doPost` của gas-shim, kho giả `tests/fixtures/kho-gia.js`): **29/29 đạt**.
- `tests/pha2-kiem-thu.e2e.js` (Playwright 1280×800, tự chạy dev-server cổng 8792 máy chủ mới / 8793 `SERVER_COMPAT=1.0.0`, `LATENCY_MS=200`, chặn CDN/fonts/google/lh3): **11/11 nhóm đạt** ở cả hai chế độ.
- Kịch bản viết trước khi đọc code tính năng. Chỉ đọc code sau đó để ghi nhận xét N-1.
- Không sửa hạ tầng test, không sửa code tính năng.
- Chạy:
  - `node tests/pha2-kiem-thu.test.js`
  - `NODE_PATH=$(npm root -g) LIBS_DIR=<node_modules có katex> node tests/pha2-kiem-thu.e2e.js all`

## Bảng TC

| TC | Kết quả | Bằng chứng |
|---|---|---|
| TC-2.1 | **ĐẠT** | Ba kiểu ghi đáp án Phần II ra đúng: `a) Đúng b) Sai c) Sai d) Đúng`→`ĐSSĐ`; `a) S b) Đ c) Đ d) Đ`→`SĐĐĐ` (có 4 ký tự, không đọc nhầm "d)"); `a) đúng; b) Sai, c) S. d) Đ`→`ĐSSĐ`. Thiếu ý c hoặc d: câu không có trong List, ToQuestions không nạp và cảnh báo "đáp án không đúng định dạng". Chấm: `ĐSSĐ` được 1 điểm, sai 1 ý được 0,5. Mức độ Biết/Hiểu/Vận dụng/Vận dụng cao → NB/TH/VD/VDC. Chương, Bài; `chuDe` bỏ "Bài N. "; nội dung, A–D, lời giải, nguồn, mức độ từng ý giữ nguyên văn |
| TC-2.2 | **ĐẠT** | `3,0` giữ nguyên, `saiSo` trống; chấm đúng với `3`, `3.0`, `3,0`, sai với `3,1`. `-120` đúng với `-120`, sai với `120`. Thêm: ô số (Apps Script trả kiểu number: `0.6`, `4383`, `-120`) và `0`, `640,0` đều chấm đúng |
| TC-2.3 | **ĐẠT** | Kho giả: List trả 47/54 câu. Câu chưa có đáp án, Phần IV và 3 câu lỗi định dạng không có trong List, Source (mọi nguồn), Matrix (5 seed, xin 60–20–20). `adminSaveExam` từ chối: "Câu 3 (…): đáp án phải là A, B, C hoặc D."; "Câu 2 (…): câu tự luận (Phần IV) chưa hỗ trợ chấm…"; Phần II 3 ý ở câu 5 cũng bị từ chối |
| TC-2.4 | **ĐẠT** | URL `https://lh3.googleusercontent.com/d/<id>`; `<id>` là **bản chép** của đúng file gốc (`copyOf`), bản chép đã `setSharing`. Gọi lần 2: `makeCopy` vẫn = 1. Không thấy file: cảnh báo nêu `L12C2B01-P1-00036.png`, câu vẫn nạp được, không có hình. File gốc: 0 lần `setSharing`. Chưa cấu hình thư mục: tìm bằng `getFilesByName` |
| TC-2.5 | **ĐẠT** | "P1 – Câu n" sắp (phần, câu) đúng 29 câu, `khongDapAn` 2. "Mã 101 – P1 Câu n" ra 1,2,3,12,14,15 / 1,3 / 2 (cả khi xáo thứ tự hàng). `thieu` = P1 5–11, 13 · P2 2 · P3 1; câu 4 chưa có đáp án tính vào `khongDapAn`=1. Nguồn có 2 file đề thành 2 đề gốc riêng (lệch đặc tả đã ghi, mục 3 báo cáo người làm) |
| TC-2.6 | **ĐẠT** | Kho 300 câu, lớp 12, 3 seed: đúng 18/4/6, không trùng, `thieu` = 0. Lọc chương/bài: mọi câu đúng chương/bài. Kho chuẩn lớp 11: `thieu` {17,3,5}; 18–4–10 lớp 12: thiếu TL 2. Lọc chương: `thieu` khớp số đếm từ List. Giao diện: hộp "Kho không đủ câu… thiếu 17/3/5", bấm Hủy thì giỏ trống |
| TC-2.7 | **ĐẠT** | 30 câu P1, 10 câu đã có trong một đề: `daDung` đúng 10 câu. 5 seed × chọn 18: không câu nào đã dùng; 5 seed dùng tổng 20/20 câu chưa dùng (có ngẫu nhiên). Chọn 25: đúng 5 câu đã dùng |
| TC-2.8 | **ĐẠT** | 300 câu có hình, `makeCopy` 1 s giả: 8 lượt `tiepTuc`, mỗi lượt 40 s giả (tối đa 40 hình), `makeCopy` = 300, không chép trùng, gọi lại không chép thêm. `makeCopy` 10 s giả: 4 lượt, mỗi lượt 260 s giả (≤ 270 s), dừng theo đồng hồ |
| TC-2.9 | **ĐẠT** | Chạy Meta (`refresh`), List, Source, Matrix, ToQuestions, SaveExam trên kho: `extWrites` = 0, nội dung kho không đổi, file gốc 0 `setSharing`. Kho thật trong shim (1 057 câu, chép 149 hình): `extWrites` = {} |
| TC-2.10 | **ĐẠT** | Học sinh gọi, hoặc gọi không có token, cả 5 `adminBank*` → `AUTH`. `startExam`/`listExams`/`bootstrap` của đề 28 câu từ kho: không có `dapAn`, `loiGiai`, `maKho`, `mucDoY`, giá trị mã câu kho, lời giải. Nộp đúng hết: 10 điểm. E2E: 8 phản hồi máy chủ trước khi nộp và `localStorage`/`sessionStorage` sạch; sau khi nộp không có `maKho`/`mucDoY` |
| TC-2.11 | **ĐẠT** | Kho 3 000 câu: 1 Meta + 10 trang List + 1 Matrix → `openById` = 1; mỗi trang 46,8 KB (< 150 KB); `size` 500 bị giới hạn ≤ 100. ToQuestions 28 câu rải rác: đọc 498 ô (≤ 28 × 22), 0 lần `getDataRange` (xem N-1) |
| TC-2.12 | **ĐẠT** | E2E "Xem đầy đủ" câu có `[BẢNG]`: `<table>` 5 hàng × 2 cột, không còn chữ `[BẢNG]` (ảnh `kt-02-bang.png`) |
| TC-2.13 | **ĐẠT** (phần làm được; xem mục dưới) | Tổng 10 239 câu khớp trang "Thống kê" (6 567 + 1 453 + 2 181 + 38 Phần IV). Trang Thống kê không có số câu có đáp án nên không so được số câu dùng được với trang này. Không có "10 hàng mẫu do agent khác đọc tay"; thay bằng đối chiếu tay 61 câu và so tự động 1 057 câu |
| TC-2.14 | **ĐẠT** | Node: Code 1.0.0 không có `features`; `adminBank*` → "Không có chức năng". E2E 1.0.0: tab Ngân hàng hiện "Cần cập nhật máy chủ (bước phát hành)", không có nút Ma trận/Tạo đề. 6 tab khác không có lỗi JS hay toast đỏ. Cài đặt không có ô kho. Trình soạn đề mẫu 6 câu (ảnh `kt-06-may-chu-cu.png`) |
| Quyền Sheets/Drive, thời gian dựng chỉ mục 10 239 hàng, chép hình thật | **KHÔNG KIỂM ĐƯỢC TẠI ĐÂY (cần giáo viên)** | Cần Apps Script thật (Pha 6, việc 2, 4, 5 trong báo cáo người làm) |

**Ngoài TC, giao diện (e2e, máy chủ mới):**
- **Lọc**: Dạng, Lớp, Mức độ, Chương, ô tìm mã câu đều cho số câu khớp kho giả; Bỏ lọc về 47 câu.
- **Giỏ câu**: thêm, bỏ, tải lại trang vẫn còn, Xóa giỏ.
- **Lấy đề gốc**: nút tắt khi chưa chọn Nguồn; hộp cảnh báo "kho không có câu 5–11, 13", "1 câu chưa có đáp án"; nạp giỏ P1 6 · P2 2 · P3 1 (ảnh `kt-03`).
- **Ma trận 1 chạm** lớp 12 → giỏ 18/4/6 → **Tạo đề**: trình soạn 28 câu, "chưa được lưu", nhãn "Kho: <mã>", ô hình là URL bản chép (ảnh `kt-04`). Trước khi bấm Lưu, máy chủ chưa có đề. Lưu xong: 28 câu, đáp án khớp kho.
- **Học sinh** làm 28 câu qua giao diện được 10 điểm (ảnh `kt-05`).
- Không có lỗi JS.

## Kiểm tra dữ liệu với kho thật (TC-2.13, chỉ đọc)
- **File kho:** id ghi trong nhiệm vụ (`1p6B…`) bị **từ chối quyền** (Permission denied). Tìm trên Drive theo tên thì thấy file "KHO CÂU HỎI VẬT LÝ" của giáo viên, id khác (`1sCy…`, tạo 18/11/2026). Kiểm tra dùng file này.
- **Cách đọc:**
  - Đọc `Kho câu hỏi!A1:V10500` bằng công cụ Sheets (3 lần đọc, chỉ đọc) và trang "Thống kê".
  - Dữ liệu tạm để ở thư mục nháp, không đưa vào repo.
  - Nạp toàn bộ 10 239 hàng vào gas-shim, chạy **chính Code.gs** (`adminBankMeta`, `adminBankList`, `adminBankToQuestions`). Drive giả có đủ file hình theo tên.
- **Số liệu máy chủ:** `tong` 10 239 · ô Đáp án không trống 1 057 · `coDapAn` 1 030 · **`dungDuoc` 1 014** (TN 772 · DS 120 · TL 122; NB 262 · TH 279 · VD 473). Bị loại:
  - chưa có đáp án 9 156;
  - Phần IV 38;
  - đáp án Phần III không phải số 27;
  - Phần I thiếu phương án 2;
  - Phần II thiếu nội dung 2.

  Khớp số người làm báo cáo.
- **Mẫu đối chiếu bằng mắt:** 61 câu ngẫu nhiên có đáp án (seed cố định), gồm:
  - Phần I: 21 câu (6 câu có hình, 1 câu có `[BẢNG]`);
  - Phần II: 18 câu, đủ hai kiểu `a) Đúng, b) Sai, …` (7 câu) và `a) Đ b) S …` (11 câu), 9 câu có hình;
  - Phần III: 20 câu (2 câu có hình; gồm `'-9,5`, có dấu nháy đầu ô);
  - Phần IV: 2 câu;
  - 37 câu có LaTeX trong nội dung.

  Mỗi câu so với ô gốc: loại/phần, mức độ, đáp án, chủ đề (Bài bỏ "Bài N. "), hình (URL là bản chép của đúng file `<mã>.png`), nội dung, A–D, lời giải, nguồn, chương, bài, mức độ từng ý (so nguyên văn).
- **Kết quả: 61/61 đúng (100 %).**
  - 56 câu dùng được, mọi trường đúng; `'-9,5` ra `-9,5`.
  - 5 câu bị loại đúng lý do:
    - L11C1B05-P4-00787, L11C2B08-P4-00255: Phần IV;
    - L11C3B18-P3-00694, L11C3B18-P3-00695, L11C1B03-P3-00786: đáp án Phần III kèm đơn vị/LaTeX/`\approx`.
  - **Câu sai: không có.**
- **So tự động toàn kho:** bộ quy tắc tự viết theo đặc tả, độc lập với code, so với kết quả máy chủ trên cả 1 057 câu có đáp án. Kết quả: 1 014 câu khớp mọi trường, 43 câu bị loại khớp lý do, **0 lệch**.
- **Lưu ý về đặc tả:** 27 câu Phần III bị loại vì đáp án có đơn vị/chữ (danh sách mã ở báo cáo người làm). Đặc tả ghi "giữ nguyên chuỗi", nhưng giữ nguyên thì máy không chấm được. Loại câu và báo giáo viên sửa kho là hợp lý (lệch đặc tả đã ghi). Giáo viên quyết định.

## Lỗi
**Không phát hiện lỗi (K-…) ở pha này.**

Nhận xét (không chặn):
- **N-1:** `adminBankToQuestions` đọc từng khối hàng theo 3 nhóm cột. 28 câu rải rác tốn 85 lần `getRange` (Code.gs `bankReadRows_` dòng 1420; `bankReadBlock_` dòng 1408). Trên Apps Script thật có thể mất vài giây mỗi lần Tạo đề. Nên đọc liền A:V mỗi khối (≈ 28 lần). Đặc tả không cấm cách hiện tại.
- **N-2:** Id kho ghi trong tài liệu giao việc không mở được (không có quyền). Khi dán `KHO_CAU_HOI_ID`, giáo viên nên dán link của file "KHO CÂU HỎI VẬT LÝ" mở được trong Drive của mình.

## Test cũ (chạy lại trên nhánh)
| Lệnh | Kết quả |
|---|---|
| `node tests/backend.test.js` | 13/13 đạt |
| `node tests/importer.test.js` | đạt |
| `node tests/cache.test.js` | 17/17 đạt |
| `node tests/common-cache.test.js` | 5/5 đạt |
| `node tests/pha1-kiem-thu.test.js` | 29/29 đạt |
| `node tests/bank.test.js` | 23/23 đạt |
| dev-server + `tests/e2e.js`, máy chủ mới / `SERVER_COMPAT=1.0.0` | đạt / đạt |
| `tests/bank.e2e.js`, máy chủ mới / 1.0.0 | ĐẠT / ĐẠT |
| `tests/pha1-kiem-thu.e2e.js all` (cổng 8790/8791, ảnh ra thư mục nháp) | đạt: K-1, K-3, TC-1.0, 1.1, 1.2, 1.3, 1.4, 1.9, 1.9b, 1.10, 1.11, 1.14 đều ĐẠT, không mục nào KHÔNG ĐẠT |

## Ảnh (`docs/bao-cao/anh/pha-2/`, 1280×800, kho giả tự soạn)
`kt-01-ngan-hang`, `kt-02-bang` ([BẢNG] 5×2), `kt-03-de-goc-thieu`, `kt-04-trinh-soan` (câu từ kho có hình bản chép), `kt-05-hoc-sinh-lam-bai`, `kt-06-may-chu-cu` (máy chủ 1.0.0).

## Kết luận kiểm thử
**ĐẠT.** Mọi TC kiểm được tại đây đều đạt. Phần cần Apps Script thật chuyển sang Pha 6 (cần giáo viên).

---

## Vòng 2 (commit `4565ec6`, ngày 19/11/2026)

### Tóm tắt cho giáo viên
- Ba thay đổi thầy nhìn thấy đều chạy đúng:
  - Câu thiếu hình được cảnh báo ngay trong trình soạn, **trước khi lưu**.
  - Ma trận và giỏ câu giới hạn 500 câu.
  - Đang mở tab Ngân hàng mà chuyển sang soạn đề thì không mất đề đang soạn.
- Còn **1 lỗi nhẹ (K-1)**: gõ số câu Phần I/II/III **lớn hơn 200** vào ô ma trận thì web lặng lẽ chỉ lấy 200 câu, không báo thiếu.
- Kho thật: chạy lại trên Code.gs mới, vẫn 1 014 câu dùng được, **0 lệch**.

### Chạy lại toàn bộ
| Lệnh | Kết quả |
|---|---|
| `node tests/pha2-kiem-thu.test.js` | **30/31**: 29 test vòng 1 đạt (TC-2.11 nay 29 lần `getRange`, 582 ô); 1 test vòng 2 KHÔNG ĐẠT vì K-1 |
| `pha2-kiem-thu.e2e.js all` (8792 / 8793 / 8794) | **15/16 nhóm**: 11 nhóm vòng 1 đạt cả hai chế độ; vòng 2 đạt 4/5, nhóm còn lại là K-1 |
| `backend` / `importer` / `cache` / `common-cache` | 13/13 · đạt · 17/17 · 5/5 |
| `pha1-kiem-thu.test.js` / `bank.test.js` | 29/29 · 30/30 |
| `e2e.js`, máy chủ mới / 1.0.0 | đạt / đạt |
| `bank.e2e.js`, máy chủ mới / 1.0.0 | ĐẠT / ĐẠT |
| `pha1-kiem-thu.e2e.js all` (8790/8791) | PHA1_V2 |
| Kho thật (Code.gs mới, cùng dữ liệu nháp) | Meta không đổi (1 014 dùng được); so tự động 1 057 câu: 0 lệch; 0 lần ghi kho |

### Kiểm thêm theo thay đổi người dùng thấy được
| Mục | Kết quả | Bằng chứng |
|---|---|---|
| Cảnh báo câu thiếu hình trước khi lưu | **ĐẠT** | Node: `adminBankToQuestions` lượt cuối trả `thieuHinh: ["L12C2B01-P1-00036"]` (câu có hình không nằm trong đó), kèm cảnh báo nêu mã câu và tên file. E2E: cho vào giỏ 1 câu thiếu hình + 1 câu có hình → Tạo đề. Đầu trình soạn có "Câu L12C2B01-P1-00036: chưa có hình …"; chỉ câu thiếu hình có nhãn "chưa có hình"; đề chưa được lưu |
| Giới hạn 500 câu | **ĐẠT** | Node: Meta `gioiHan` = 500; Matrix 200+200+101 bị từ chối "Ma trận tối đa 500 câu…"; 460 câu được; ToQuestions 501 mã bị từ chối. E2E: ma trận 501 → toast "Ma trận tối đa 500 câu (giới hạn của Tạo đề).", giỏ không đổi. Giỏ 500 (ma trận 200/150/150) + 1 câu → "Quá 500 câu — bớt 1 câu để tạo đề", nút Tạo đề bị khóa |
| Chuyển màn khi tab Ngân hàng đang tải (máy chủ chậm 2,5 s) | **ĐẠT** | 4 tình huống: đọc kho lần đầu, "Đọc lại kho", Ma trận, Tạo đề. Mỗi lần đang chờ thì sang "Tạo đề mới" và gõ tên đề. Sau 3,5–3,8 s tên vẫn còn, không có hộp thoại đè lên, không bị trình soạn của giỏ thay thế, không lỗi JS |

### Lỗi
**K-1 (Nhẹ). Ma trận lặng lẽ cắt số câu mỗi phần xuống 200.**
- Tái hiện:
  1. Kho đủ câu (dev-server `BANK_ROWS=1200`).
  2. Ô P1 = 250, P2 = 0, P3 = 0 → bấm "Tạo ma trận".
  3. Hộp hiện "Tìm được 200 câu (Phần I 200 …)", không có dòng "thiếu".
- API cho cùng kết quả: `adminBankMatrix {so:{TN:250}}` trả 200 mã câu, `thieu` = 0, `so.TN` = 200.
- Trái TC-2.6 ("không tạo đề thiếu một cách âm thầm") ở trường hợp biên.
- Chẩn đoán:
  - `apps-script/Code.gs`, `apiAdminBankMatrix_`: `want[p] = Math.max(0, Math.min(200, v))`.
  - Ô nhập có `max="200"`, nhưng gõ tay vẫn vượt được.
  - Lỗi có từ vòng 1 (`898fdd3`); vòng 1 chưa có kịch bản thử số > 200.
- Đề xuất: báo lỗi "mỗi phần tối đa 200 câu", hoặc bỏ mức trần 200 vì đã có giới hạn chung 500.
- Kịch bản bắt lỗi:
  - test "Vòng 2: giới hạn 500 câu…" trong `tests/pha2-kiem-thu.test.js`;
  - nhóm "K-1 ma trận P1 > 200…" trong `tests/pha2-kiem-thu.e2e.js`.

### Kết luận vòng 2
**ĐẠT, kèm K-1 (Nhẹ).** Mọi TC-2.x vẫn đạt với số liệu mặc định 18–4–6. K-1 chỉ xảy ra khi gõ hơn 200 câu cho một phần. Nên sửa trước khi gộp, hoặc giáo viên chấp nhận. Ảnh `kt-01` … `kt-06` đã được chụp lại trên bản vòng 2.
