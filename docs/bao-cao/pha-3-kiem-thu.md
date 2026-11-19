# Pha 3 — Báo cáo kiểm thử (người kiểm thử, độc lập)

Nhánh `pha-3-tai-de`. Bắt đầu kiểm ở commit `8cfe62e`, chạy lại lần cuối trên `bcbbad2` (commit này chỉ thêm báo cáo soát và lưu tạm test của người kiểm thử, không đổi code tính năng). Ngày 19/11/2026.

## Tóm tắt cho giáo viên
- **14/14 TC ĐẠT** (TC-3.0 → TC-3.13), ở cả máy chủ mới lẫn máy chủ cũ 1.0.0. Không có lỗi chặn.
- Thử trên **4 file đề Word thật của thầy**. Số câu từng phần, số công thức và số hình của từng câu khớp **100 %** với số tôi tự đếm từ file: 525/525 công thức hiển thị được, 18/18 đáp án Phần I của file lời giải khớp.
- Hình chỉ được tải lên Drive khi thầy bấm "Thêm vào đề", mỗi hình đúng một lần. Hình WMF/EMF và công thức MathType được báo đúng số câu.
- Đề tải từ Word lưu được, học sinh làm đúng hết được 10 điểm, kể cả với máy chủ cũ.
- Có 1 lỗi nhẹ (K-1): file .txt hoặc .csv sai mẫu cột cho ra câu trống mà không báo. Khi bấm Lưu, máy chủ vẫn chặn, nên không hỏng dữ liệu.

## Cách kiểm
- **`tests/pha3-kiem-thu.test.js`** (Node, hộp đen qua API đọc file): **12 nhóm TC đạt**. Nhóm thứ 13 là K-1 (cố ý ghi KHÔNG ĐẠT để giữ dấu lỗi).
  - File mẫu sinh trong bộ nhớ bằng **`tests/fixtures/pha3-kt-make.js`**: JSZip/SheetJS trên Node, PNG tự mã hóa, EMF/WMF giả.
  - Viết riêng, không dùng `make-docx.js` của người làm.
  - Bộ 20 công thức OMML và chuỗi LaTeX kỳ vọng do người kiểm thử tự viết. Mọi công thức qua KaTeX `throwOnError: true`.
- **`tests/pha3-kiem-thu.e2e.js`** (Playwright, `setInputFiles`): **17/17 nhóm đạt**.
  - Tự chạy dev-server cổng 8792 (máy chủ mới) và 8793 (`SERVER_COMPAT=1.0.0`), `LATENCY_MS=150`.
  - Đếm `adminUploadImage` qua `/__stats`.
  - Ghi lại mọi yêu cầu tới jszip/xlsx (TC-3.12).
  - Route CDN: `jszip/3.10.1/jszip.min.js` → `jszip/dist/jszip.min.js`, `xlsx/0.18.5/xlsx.full.min.js` → `xlsx/dist/xlsx.full.min.js`, katex/chart như Pha 2.
- **Thứ tự làm:** kịch bản viết trước, theo đặc tả và giao diện chạy được.
  - Trước khi viết xong, chỉ đọc phần chú thích API ở đầu `assets/js/docx-reader.js` (chữ ký `read`/`toQuestions`/`attachImages`/`readFile`) để biết cách truyền JSZip trên Node.
  - Phần code còn lại chỉ đọc sau khi chạy xong, để chẩn đoán K-1.
- **Không sửa** hạ tầng test (`gas-shim.js`, `dev-server.js`), **không sửa** code tính năng, **không commit**. Hai file test của tôi được một phiên khác commit "lưu tạm" trong `bcbbad2`.
- **Lệnh chạy:**
  - `LIBS_DIR=<node_modules có jszip, xlsx, katex> node tests/pha3-kiem-thu.test.js`
  - `NODE_PATH=$(npm root -g) LIBS_DIR=<…, thêm chart.js> node tests/pha3-kiem-thu.e2e.js all`

## Bảng TC

| TC | Kết quả | Bằng chứng |
|---|---|---|
| TC-3.0 (file thật) | **ĐẠT** | Bảng thống kê của người làm khớp số tôi tự đếm (unzip, đếm thẻ) ở cả 4 file. Bộ đọc cho số câu theo phần, số công thức và số hình **từng câu** đúng như đếm tay. Xem mục dưới |
| TC-3.1 | **ĐẠT** | Node: .docx 28 câu → 28 câu (18-4-6), `deepStrictEqual` với `fromText()` của cùng văn bản, cả hai đường (`read`+`fromText` và `toQuestions`). E2E: bảng "Tìm thấy 28 câu · Phần I: 18 · Phần II: 4 · Phần III: 6"; trình soạn sau "Thay toàn bộ" **giống hệt** khi dán văn bản (mọi ô + nút đáp án). Thêm mẫu VLSN: khung đầu đề (bảng), "PHẦN 1. TRẮC NGHIỆM…", phương án cách tab (2 dòng × 2), "Đáp án của em", "HẾT" → 4 câu đúng, không lẫn đầu đề/HẾT |
| TC-3.2 | **ĐẠT** | 20 công thức tự viết (phân số lồng, `10^{-5}` + `\text{C}`, `\sqrt{}`, `\sqrt[3]{}`, ngoặc `\left( \right)` / `[ ]`, Δ ω π λ φ, `\cos`, `T_{1} = 300\ \text{K}`, `\text{m/s}`, `\vec{}`, `27^\circ\text{C}`, `x_{1}^{2}`, `\sum`, `\int`, `\approx \cdot \times`, `\le \ge \neq \rightarrow`, `\overline`, `\hat`). **16/20 đúng nguyên chuỗi**, 4 còn lại chỉ khác khoảng trắng hoặc `\le`/`\leq`, `\ge`/`\geq`; KaTeX vẽ ra MathML **trùng khớp** với chuỗi kỳ vọng (20/20). KaTeX `throwOnError` lỗi 0/20. E2E xem trước: 20 công thức KaTeX, 0 `.katex-error`, "Đã đổi: 20 · Chưa đổi được: 0" (ảnh `kt-03`) |
| TC-3.3 | **ĐẠT** | Ma trận ở câu 4, OLE MathType ở câu 6. Không văng lỗi; 6/6 (Node) và 7/7 (e2e) câu nhận đủ. Cảnh báo "Câu 4: 1 công thức cần gõ lại (đánh dấu ⟦…⟧)" và "Câu 6: 1 công thức MathType chưa đổi được… Convert Equations"; không gán nhầm câu khác. Câu 4 giữ công thức khác (`$F = ma$`). Trình soạn tô vàng câu 4 (khung `rgb(255,248,219)`, ô nội dung `rgb(255,243,176)`, nhãn "Còn công thức cần gõ lại"); gõ lại thì hết vàng (ảnh `kt-04`) |
| TC-3.4 | **ĐẠT** | `numbering.xml` tự sinh: "Câu %1." (decimal), "%1." (upperLetter) cho A–D, "%1)" (lowerLetter) cho a–d, đánh lại từ đầu mỗi phần/câu → 6 câu (3-2-1) **giống hệt gõ tay**. Biến thể "%1." decimal cũng giống. Kiểu lạ (`ordinalText`) → cảnh báo "đánh số tự động không dựng lại được" |
| TC-3.5 | **ĐẠT** | Hình ở câu 2, 5, 5: `adminUploadImage` = 0 sau khi đọc, 0 sau khi bấm Hủy, 0 khi đọc lại, **3** sau khi bấm thêm. Câu 2 có `hinhAnh`; câu 5 có `hinhAnh` + đúng 1 `![](…)`; 3 URL khác nhau; câu khác không có hình. Thêm: 1 hình dùng ở 2 câu → tải 1 lần, 2 câu cùng URL |
| TC-3.6 | **ĐẠT** | Bảng 2 hàng × 5 cột → `[BẢNG] t (s) \| 0 \| 2 \| 4 \| 6` / `v (m/s) \| 0 \| 5 \| 10 \| 15`; bảng 5×2 cũng đúng. Xem trước là `<table>` 2×5. Học sinh thấy bảng 2×5 (TC-3.11) |
| TC-3.7 | **ĐẠT** | `wp:anchor` (câu 1) và VML `v:imagedata` (câu 3) có `hinhAnh`. EMF (câu 5) và WMF (Phần II câu 1 = câu 7 trong trình soạn) → "hình cần chụp lại hoặc lưu lại dạng PNG" đúng câu, ghi kèm "(câu 1 Phần II trong file)". `adminUploadImage` = **2** (không gọi cho EMF/WMF); bảng "Sẽ tải lên: 2 · Cần chụp lại: 2"; không lỗi JS |
| TC-3.8 | **ĐẠT** | Node: xlsx có/không tiêu đề, csv `,` có/không tiêu đề, csv `;` → `deepStrictEqual` với `fromTsv()`. E2E: 4 trường hợp, trình soạn giống hệt khi dán TSV |
| TC-3.9 | **ĐẠT** | 40 câu × 10 công thức + 5 hình PNG 400×300: Node 30–49 ms; Chromium từ lúc chọn file tới bảng kết quả **374–405 ms** (< 5 s). Đủ 400/400 công thức, KaTeX lỗi 0. File thật lớn nhất (2,2 MB) trong Chromium: 432 ms |
| TC-3.10 | **ĐẠT** | Mỗi trường hợp có thông báo tiếng Việt riêng, xem mục "Thông báo TC-3.10" dưới bảng. Thời gian 0–30 ms (file > 10 MB: 1,2 s). Trang vẫn phản hồi, nút "Thêm vào đề" khóa; chọn lại file đúng vẫn đọc được. (Ngoài danh sách: .txt bị coi là .csv, xem K-1) |
| TC-3.11 | **ĐẠT** | Cả hai chế độ. Đề 28 câu: câu 2 có 1 hình, câu 5 có 2 hình, câu 3 có 2 công thức, Phần III câu 1 có bảng 2×5. Đã lưu, `adminGetExam` ra 28 câu, đáp án khớp, `adminUploadImage` = 3. Học sinh (390×844) thấy 28 câu, hình, 2 công thức KaTeX, bảng 2×5, 0 `.katex-error`; làm đúng hết → **10 điểm** (ảnh `kt-06`, `kt-09`) |
| TC-3.12 | **ĐẠT** | Cả hai chế độ: đăng nhập + 4 trang + trình soạn + mở hộp nhập ở tab "Dán văn bản" → **0** yêu cầu jszip/xlsx, không có thẻ `<script>` thư viện, `admin.html` không chứa URL thư viện. Bấm "Tải file lên" → đúng 2 yêu cầu `cdnjs…/jszip/3.10.1/jszip.min.js`, `cdnjs…/xlsx/0.18.5/xlsx.full.min.js`. CDN hỏng (404 cả cdnjs và jsdelivr): chọn file → "Không tải được thư viện đọc file, hãy dán văn bản."; tab Dán văn bản vẫn dùng được |
| TC-3.13 | **ĐẠT** | `node tests/importer.test.js` mã thoát 0 |

### Thông báo TC-3.10

| Trường hợp | Thông báo |
|---|---|
| File > 10 MB | "File lớn hơn 10 MB (10,0 MB). Hãy nén ảnh…" |
| PDF | "Chưa đọc được file PDF. Hãy dùng file Word (.docx) gốc…" |
| PDF đổi tên .docx | "File bị hỏng hoặc không phải file Word .docx." |
| Ảnh .png | "Chỉ nhận file Word (.docx), Excel (.xlsx) hoặc .csv." |
| .doc | "File .doc (Word 97–2003) chưa đọc được. Hãy … Lưu thành → Word Document (.docx)" |
| Byte ngẫu nhiên | "File bị hỏng hoặc không phải file Word .docx." |
| Docx cắt cụt | "File Word bị hỏng, không mở được (…)" |
| Zip không có `document.xml` | "File không có nội dung Word (thiếu word/document.xml)…" |
| .xlsx hỏng | "File Excel bị hỏng hoặc không đúng định dạng." |

**Ngoài TC (e2e, cả hai chế độ):**
- **An toàn:** chữ `<img onerror>`, `<script>`, `<b onmouseover>` trong nội dung file và trong **tên file** hiện nguyên văn; không chạy mã, không chèn phần tử (xem trước và trình soạn).
- **Điện thoại 390×844:** bảng kết quả có cảnh báo không tràn ngang (ảnh `kt-07`).
- **Không lỗi JS:** không có `pageerror` hay `console.error` ở trang quản trị và trang học sinh.

## Kiểm với file Word thật (TC-3.0, chỉ đọc)
4 file trong thư mục nháp của phiên. Không chép file hay nội dung đề vào repo. Script đếm và đối chiếu để ở thư mục nháp, chỉ in số.

**Đếm độc lập** (giải nén, đếm thẻ trong `word/document.xml`; đếm "Câu n" theo PHẦN từ chữ của đoạn văn):

| File | `m:oMath` | `w:object` / `o:OLEObject` | Media theo đuôi | Hình trong thân bài | `wp:anchor` / `v:imagedata` | `w:numPr` | Bảng | Câu đếm tay (P I-II-III) |
|---|---|---|---|---|---|---|---|---|
| 01. Đề thi thử GK1 VL12 | 46 | 0 / 0 | png 5 | 5 | 0 / 0 | 0 | 2 | 18-4-6 |
| Đề KS đội tuyển lần 1 | 153 | 0 / 0 | png 19 | 18 | 0 / 0 | 0 | 2 | 30-8-6 |
| VL11 GK1 (đề) | 72 | 0 / 0 | png 5 | 4 | 0 / 0 | 0 | 1 | 14-2-6 |
| VL11 GK1 (lời giải) | 254 | 0 / 0 | png 10 | 9 | 0 / 0 | 0 | 1 | 18-4-6 |

→ **Khớp từng ô** với bảng TC-3.0 trong `docs/bao-cao/pha-3.md`. Kết luận "100 % Equation, không MathType, không đánh số tự động" đúng.

**Chạy bộ đọc (Node và Chromium qua giao diện)**, đối chiếu **theo từng câu** số `$…$` và số mốc hình với số `m:oMath` và số hình đếm tay trong vùng của câu đó:

| File | Câu web (P I-II-III) | Công thức trong câu: web / đếm tay | Lệch theo câu (công thức · hình) | KaTeX `throwOnError` | Mốc ⟦…⟧ | Hình sẽ tải | Chromium |
|---|---|---|---|---|---|---|---|
| 01 | 18-4-6 | 43 / 43 | 0 · 0 | 0 lỗi | 0 | 5 | 230 ms |
| KS đội tuyển | 30-8-6 | 153 / 153 | 0 · 0 | 0 lỗi | 0 | 17 | 432 ms |
| VL11 đề | 14-2-6 (bỏ Phần IV, có cảnh báo) | 65 / 65 | 0 · 0 | 0 lỗi | 0 | 2 | 185 ms |
| VL11 lời giải | 18-4-6 | 254 / 254 | 0 · 0 | 0 lỗi | 0 | 8 | 299 ms |

- **Đáp án:** file lời giải có 27/28 câu có đáp án.
  - Phần I: tôi tự dò "Chọn X" trong vùng từng câu, so với web: **18/18 khớp**.
  - Cảnh báo "đáp số có đơn vị — đã lấy số" (5 câu) và "chưa tìm thấy đáp án" (1 câu) đúng như người làm báo cáo.
- **Giao diện:** 0 `.katex-error`, 0 `pageerror`.
- **Ghi chú N-1:** dòng "Công thức – Đã đổi" trong bảng kết quả đếm **mọi** công thức trong file, kể cả ngoài câu hỏi. File 01: 46, trong khi câu hỏi chỉ chứa 43 (3 công thức ở phần hướng dẫn/đầu đề). File VL11 đề: 72, trong đó 7 công thức thuộc Phần IV bị bỏ qua. Không sai dữ liệu, nhưng thầy có thể thắc mắc vì sao số công thức không khớp với đề.

## Lỗi

### K-1 (Nhẹ) — file .txt hoặc .csv sai mẫu cột ra câu trống, không cảnh báo
- **Tái hiện:**
  - Node: `DocxReader.readFile('de.txt', Buffer.from('Câu 1. Một câu hỏi\nCâu 2. Câu khác'), libs)` → 2 câu loại TL, `noiDung` rỗng, `warnings: []`. Cùng kết quả với `mot-cot.csv`.
  - Giao diện: ô chọn file có `accept` không gồm .txt, nhưng kéo thả thì không lọc đuôi (`admin.js:624` đưa thẳng file vào `handleFile`), nên file .txt đi cùng đường `readFile` ở trên. Chưa chạy riêng thao tác kéo thả trên giao diện; suy ra từ code.
  - Bấm Lưu đề thì máy chủ chặn ("chưa có nội dung"), nên **không hỏng dữ liệu**.
- **Chẩn đoán** (đọc code sau khi chạy):
  - `assets/js/docx-reader.js:870` `kindOf()` coi đuôi `.txt` (và `.tsv`) là `csv`.
  - `assets/js/importer.js:51–66` `fromRows()` không cảnh báo khi hàng không có nội dung, nên chữ của cột đầu rơi vào cột "Loại". Hành vi này có sẵn từ trước ở `fromTsv` (cũng có trên `main`).
- **Đề xuất:**
  - Trong `readFile()`, đuôi `.txt`: hoặc đưa sang `fromText()` (đề Word dán ra), hoặc báo "Chỉ nhận…".
  - `fromRows()` (hoặc riêng nhánh file): cảnh báo "Câu n: không có nội dung — kiểm tra thứ tự cột" khi `noiDung` rỗng.

### Quan sát ngoài phạm vi Pha 3 (không tính lỗi)
- Đang mở hộp "Nhập nhanh" mà đổi trang bằng địa chỉ (`#/…`, nút Lùi) thì hộp vẫn che trang mới. Hành vi giống hệt trên `main` (đã thử dev-server dựng từ `git archive main`), không do Pha 3.

## Test cũ (chạy lại)

| Test | Kết quả |
|---|---|
| `backend.test.js` | 13 đạt |
| `importer.test.js` | đạt |
| `bank.test.js` | 30 đạt |
| `pha2-kiem-thu.test.js` | 31/31 |
| `docx.test.js` (người làm) | 19/19 |
| `e2e.js` máy chủ mới (cổng 8794) | đạt |
| `e2e.js` `SERVER_COMPAT=1.0.0` (cổng 8790) | đạt |

## Ảnh (`docs/bao-cao/anh/pha-3/`, đề mẫu tự soạn)
- `kt-01-hop-tai-file`: tab "Tải file lên", máy chủ mới.
- `kt-02-ket-qua-canh-bao`: bảng kết quả, có cảnh báo ma trận / MathType / EMF / WMF theo câu.
- `kt-03-cau-cong-thuc`: xem trước các câu có công thức đã đổi.
- `kt-04-moc-to-vang`: trình soạn, câu còn mốc ⟦…⟧ tô vàng.
- `kt-05-ket-qua-may-chu-1.0.0`: bảng kết quả + cảnh báo ở chế độ 1.0.0.
- `kt-06-hoc-sinh-lam-bai`: học sinh làm đề tải từ Word, 390×844.
- `kt-07-ket-qua-dien-thoai`: bảng kết quả, 390×844.
- `kt-08-hop-tai-file-1.0.0`: tab "Tải file lên", chế độ 1.0.0.
- `kt-09-hoc-sinh-1.0.0`: học sinh làm đề ở chế độ 1.0.0.

Ảnh máy tính 1280×800. KaTeX, JSZip, SheetJS lấy từ thư viện cục bộ vì môi trường chặn CDN.

## Chưa kiểm được tại đây
- **URL CDN thật** (cdnjs/jsdelivr bị chặn): đúng đường dẫn và phiên bản, nhưng chưa tải thật. Giáo viên thử một lần trên trang thật sau khi gộp.
- **Tải hình lên Apps Script/Drive thật:** chỉ thử với máy chủ giả lập (mới và 1.0.0).

## Kết luận
**ĐẠT.** 14/14 TC đạt ở cả hai chế độ máy chủ; test cũ vẫn đạt. Có 1 lỗi nhẹ (K-1) và 1 ghi chú (N-1), không chặn gộp; nên sửa K-1 trong vòng sau hoặc pha sau.
