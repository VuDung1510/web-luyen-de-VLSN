# Báo cáo Pha 3 — Tải đề Word / Excel lên

## Tóm tắt cho giáo viên (bản của người làm)
- Trong trình soạn đề, nút **Nhập nhanh từ Word / Excel** có thêm tab **Tải file lên**. Thầy kéo thả hoặc chọn file Word (.docx), Excel (.xlsx) hoặc .csv, tối đa 10 MB.
- Web đọc file **ngay trên máy**: tự tách câu theo mẫu VLSN (PHẦN 1/2/3, Câu 1., A–D cách tab, a) b) c) d)), đổi công thức Equation sang dạng hiển thị trên web, lấy hình và bảng.
- Trước khi thêm, thầy thấy bảng kết quả (số câu từng phần, số công thức đã đổi / chưa đổi, số hình) và xem trước từng câu. Câu có công thức chưa đổi được được **tô vàng** để thầy gõ lại.
- Hình chỉ được tải lên Drive khi thầy bấm **Thêm vào đề**. Hình dạng WMF/EMF hay hình vẽ bằng công cụ Word thì web báo "cần chụp lại", nêu đúng số câu.
- Thử trên 4 file đề thật của thầy: đọc đúng toàn bộ số câu và **525/525 công thức**, mỗi file dưới 0,1 giây. Pha này **không** cần dán lại Code.gs.

---

## Người làm

### Điều kiện vào pha (TC-3.0): thống kê file Word thật
Tải bằng công cụ Google Drive (chỉ đọc) về thư mục nháp của phiên; **không** đưa file hay nội dung đề vào repo. Đếm trực tiếp trong `word/document.xml` (header/footer đếm riêng).

| File (trên Drive) | Dung lượng | Công thức Equation (`m:oMath`) | MathType/OLE (`w:object`, `o:OLEObject`) | Hình theo đuôi | Hình nổi `wp:anchor` | VML (`v:imagedata`/`v:shape`) | Đánh số tự động `w:numPr` | Bảng | Header/footer |
|---|---|---|---|---|---|---|---|---|---|
| `01. De_thi_thu_GK1_VL12.docx` (mẫu VLSN) | 395 KB | **46** | 0 | png 5 (wmf/emf/jpg 0) | 0 | 0 | 0 | 2 (khung đầu đề + 1 bảng số liệu) | 1 + 1 |
| `De_KS_Doi_tuyen_VL12_Lan1.docx` (nguồn mẫu chuẩn) | 2,2 MB | **153** | 0 | png 19 (18 trong thân, 1 ở đầu trang) | 0 | 0 | 0 | 2 | 3 + 2 |
| `VL11_ĐỀ CHÍNH THỨC_…_GK1.docx` (thư mục "01. ĐỀ GỐC ĐÃ NHẬP") | 1,0 MB | **72** | 0 | png 5 | 0 | 0 | 0 | 1 (khung đầu đề) | 3 + 3 |
| `VL11_ĐỀ CHÍNH THỨC_…_GK1_LỜI GIẢI.docx` (cùng thư mục) | 1,3 MB | **254** | 0 | png 10 | 0 | 0 | 0 | 1 (khung đầu đề) | 3 + 3 |

Kết luận: **100 % công thức là Equation (OMML), không có MathType** → làm đủ phạm vi, có `omml2latex`. Không file nào dùng đánh số tự động cho "Câu"/phương án (vẫn hỗ trợ, TC-3.4). Phần tử OMML gặp trong file thật: `f`, `sSup`, `sSub`, `sSubSup`, `sPre` (hạt nhân), `rad`, `d` (có `begChr/endChr`), `acc` (vector), `nor`/`sty p` (đơn vị), `scr`.

### Chạy bộ đọc trên file thật (bằng chứng chính)
Chạy chính `assets/js/docx-reader.js` + `importer.js` (Node và Chromium), có kiểm tra KaTeX `throwOnError` cho từng công thức.

| File | Câu nhận được (P I · P II · P III) | Công thức đổi được / chưa | Hình sẽ tải lên | Cảnh báo | Thời gian (Chromium) |
|---|---|---|---|---|---|
| 01. Đề thi thử GK1 VL12 | 28 (18 · 4 · 6) — đúng đề | 46 / 0 | 5 | "Chưa có đáp án ở 28 câu" (file đề không kèm đáp án) | 30 ms |
| Đề KS đội tuyển lần 1 | 44 (30 · 8 · 6) — đúng đề | 153 / 0 | 17 (logo ở khung đầu đề bị bỏ đúng) | "Chưa có đáp án ở 44 câu" | 50 ms |
| VL11 GK1 (đề) | 22 (14 · 2 · 6) — đúng đề; Phần IV tự luận bỏ qua | 72 / 0 | 2 (hình của Phần IV không lấy) | "Bỏ qua Phần IV (tự luận)"; "Chưa có đáp án ở 22 câu" | 16 ms |
| VL11 GK1 (lời giải) | 28 (18 · 4 · 6) — đúng đề | 254 / 0 | 8 | 27/28 câu tự có đáp án (từ "Lời giải: Chọn B.", lời giải Đúng/Sai từng ý, "Đáp số: …"); 21 câu có mức độ từ nhãn [B]/[H]/[VD]/[VDC]; 5 cảnh báo "đáp số có đơn vị — đã lấy số, hãy kiểm tra"; 1 câu chưa có đáp án (đúng: file ghi chú câu đó không có câu hỏi riêng) | 44 ms |

Đầu trang, chân trang, khung đầu đề (bảng 2 ô), dòng "Họ và tên", "Đáp án của em", "---------- HẾT ----------" và dòng sau HẾT **không** lẫn vào câu nào. Bảng số liệu trong câu thành khối `[BẢNG]`.

### Đã làm
**`assets/js/docx-reader.js` (mới, hàm thuần, chạy trên Node và trình duyệt)**
- Bộ đọc XML nhỏ tự viết (không dùng `DOMParser`, để Node và trình duyệt cho cùng kết quả; tự chuẩn hóa tiền tố lạ theo `xmlns`).
- `DocxReader.read()`: duyệt `w:body` theo thứ tự; `w:p` → một dòng; `w:tab`, `w:br`, `w:sym` (font Symbol), `w:hyperlink`, `w:sdt`, `w:ins`, `mc:AlternateContent`; bỏ `w:del`, mã trường. Chỉ đọc `document.xml` nên header/footer không lẫn vào.
- Hình: `wp:inline`, `wp:anchor`, VML `v:imagedata` → mốc `{{HINH:n}}` (tra `document.xml.rels`). WMF/EMF, hình vẽ bằng công cụ Word (khung, mũi tên, biểu đồ), hình liên kết ngoài, hình thiếu → không tải lên, cảnh báo theo câu.
- OLE/MathType → mốc `⟦công thức MathType chưa đổi được⟧` + cảnh báo kèm cách "Convert Equations".
- Đánh số tự động: đọc `numbering.xml` (+ `styles.xml`), dựng "Câu n." (decimal), "A." (upperLetter), "a)" (lowerLetter); giữ nguyên mẫu có chữ như "Câu %1:". Kiểu lạ → cảnh báo.
- Bảng: khung đầu đề (bảng trước "PHẦN…"/"Câu 1") bị bỏ; bảng số liệu → `[BẢNG] a | b`; bảng phương án "A. … | B. …" → một dòng phương án; bảng 1 hàng / 1 cột (bảng dàn trang) → đoạn văn thường; bảng đáp án "Câu | 1 | 2…" + "Đáp án | B | C…" (ngang hoặc dọc) → `BẢNG ĐÁP ÁN 1.B 2.C`.
- `omml2latex()`: `f` (cả `lin`, `noBar`), `sSup/sSub/sSubSup`, `sPre`, `rad`, `d` (mọi `begChr/endChr/sepChr`), `nary`, `func`, `acc` (vec, overrightarrow, hat, overline, tilde, dot…), `bar`, `groupChr`, `limLow/limUpp`, `box`, `borderBox`, `phant`, `eqArr`; ánh xạ chữ Hy Lạp, ký hiệu, chữ toán học Unicode; chữ đứng (`m:nor`, `sty p`) → `\text{}`, tên hàm → `\sin`, `\cos`, `\ln`…; chữ Việt trong công thức → `\text{}`; khoảng trắng → `\ `; quanh dấu `=`, `+`, `\approx`… có khoảng trắng như kho (`T_{1} = 300\ \text{K}`), dấu trừ một ngôi không. Ma trận / phần tử lạ → `⟦công thức chưa đổi được: <chữ gốc>⟧`. Trên trình duyệt, công thức đổi xong mà KaTeX không vẽ được cũng đổi thành mốc (không đưa LaTeX hỏng vào đề).
- `toQuestions()`: gọi `Importer.fromText()`, rồi dò mốc theo từng câu → cảnh báo "Câu n: …"; gộp "chưa có đáp án" thành một dòng khi > 3 câu. `attachImages()`: hình đầu trong nội dung → `hinhAnh`, hình sau → `![](url)` tại chỗ.
- `readFile()`: kiểm tra đuôi + kích thước + chữ ký file (.doc, PDF, ảnh, docx hỏng, thiếu `document.xml`, > 10 MB → thông báo tiếng Việt); .xlsx/.xls qua SheetJS (trang đầu có dữ liệu, cảnh báo nếu nhiều trang); .csv tự đọc (UTF-8 có/không BOM, dấu `,` `;` hoặc tab; không phải UTF-8 → đọc Windows-1258 + cảnh báo).

**`assets/js/importer.js`** (mở rộng, `tests/importer.test.js` vẫn đạt)
- `parseCsv`, `fromCsv`, `fromRows` (TSV, CSV và .xlsx dùng chung logic `fromTsv`/`DEFAULT_COLS`).
- `fromText`: nhận "PHẦN 1/2/3" và "PHẦN IV" (bỏ qua + cảnh báo); bỏ dòng "Đáp án của em"; "---------- HẾT ----------" kết thúc đề, sau đó "Câu n" (hoặc sau dòng "HƯỚNG DẪN GIẢI") là lời giải của câu n đã có; nhãn mức độ `[NB] [TH] [VD] [VDC] [B] [H]` → `mucDo`; "Lời giải: Chọn B." → đáp án; lời giải "a) Đúng – … b) Sai – …" → `ĐS…`; "Đáp số: $0,5$ Hz" trong lời giải → `0,5` + cảnh báo kiểm tra. "Chọn …" ở đầu dòng chỉ là đáp án khi theo sau đúng một chữ A–D (trước đây câu dẫn "Chọn phát biểu đúng…" bị hiểu nhầm). Kết quả mỗi câu có thêm `mucDo`, `num`.

**`assets/js/admin.js`**
- `importDialog`: tab thứ ba **Tải file lên** (kéo thả / chọn file), thanh tiến độ "Đọc file… / Đổi công thức… / Tải n hình… (k/n)", bảng kết quả, danh sách cảnh báo, xem trước từng câu (KaTeX, hình xem trước bằng blob, bảng, mốc ⟦…⟧ tô vàng). "Thêm vào đề" / "Thay toàn bộ" như cũ; hình tải lên **lúc này**, mỗi file hình một lần (`shrinkImage` → `adminUploadImage`); hình lỗi → báo câu, câu vẫn thêm. Đang tải hình thì hộp không đóng được bằng Esc/bấm ngoài. Tab dán văn bản/TSV giữ nguyên, có thêm xem trước.
- Tải lười thư viện: JSZip 3.10.1 và SheetJS 0.18.5 chỉ được chèn khi mở tab "Tải file lên" (cdnjs, dự phòng jsdelivr cùng phiên bản; quá 20 s → thử nguồn sau). Thất bại → "Không tải được thư viện đọc file, hãy dán văn bản."
- Trình soạn: câu còn mốc `⟦…⟧` tô vàng (khung câu + ô chữ), nhãn "Còn công thức cần gõ lại"; sửa hết mốc thì hết tô vàng ngay. Câu có hình hỏng có nhãn "File Word có hình cần chụp lại". `previewHtml` chuyển thành hàm chung `qPreviewHtml` (dùng cho trình soạn và hộp nhập).
- **R-13** (còn từ Pha 2): `logout()` xóa `bankMeta`, `draftFromBank`, giỏ câu và bộ lọc Ngân hàng trong `sessionStorage`.

**Khác**: `admin.html` nạp `docx-reader.js` (mã của web, ~50 KB, không kéo theo thư viện ngoài); `style.css` thêm vùng kéo thả, thanh tiến độ, bảng kết quả, tô vàng (cả chế độ tối, điện thoại 390 px).

### File đổi
`assets/js/admin.js`, `assets/js/importer.js`, `assets/css/style.css`, `admin.html`. Mới: `assets/js/docx-reader.js`, `tests/fixtures/make-docx.js`, `tests/docx.test.js`, `tests/docx.e2e.js`, `docs/bao-cao/pha-3.md`, `docs/bao-cao/anh/pha-3/*.png`. **Không đổi `apps-script/Code.gs`.**

### Bảng TC tự kiểm
Lệnh: `LIBS_DIR=<node_modules có jszip, xlsx, katex> node tests/docx.test.js`; e2e: dev-server cổng 8780 (mới) / 8781 (`SERVER_COMPAT=1.0.0`), `PORT=… ADMIN_PW=… LIBS_DIR=… NODE_PATH=$(npm root -g) node tests/docx.e2e.js <thư mục ảnh>`.

| TC | Mô tả | Kết quả | Bằng chứng |
|---|---|---|---|
| TC-3.0 | Thống kê file thật trước khi viết `omml2latex` | ĐẠT | Bảng trên (4 file) |
| TC-3.1 | .docx 28 câu 18–4–6 giống khi dán văn bản | ĐẠT | `docx.test.js` (so `deepStrictEqual` với `fromText`), e2e "Tìm thấy 28 câu: 18 · 4 · 6"; file thật 28/44/22/28 câu |
| TC-3.2 | 30 công thức mẫu đúng từng chuỗi + KaTeX `throwOnError` | ĐẠT | `docx.test.js`; file thật 525/525 công thức qua KaTeX |
| TC-3.3 | Ma trận, OLE → cảnh báo đúng câu, câu khác vẫn nhận | ĐẠT | `docx.test.js`, e2e "Câu 4: 1 công thức cần gõ lại", ảnh 02, 04 |
| TC-3.4 | Đánh số tự động "Câu", A–D, a)–d) | ĐẠT | `docx.test.js` (so với gõ tay) |
| TC-3.5 | 3 hình ở câu 2, 5, 5; upload đúng 1 lần/hình, chỉ sau khi bấm thêm | ĐẠT | `docx.test.js` + e2e: 0 lần gọi trước khi bấm, 3 lần sau; câu 5 có `hinhAnh` + 1 `![](…)` |
| TC-3.6 | Bảng 2×5 → `[BẢNG]` hiển thị thành bảng | ĐẠT | `docx.test.js`, e2e (xem trước 5 hàng; học sinh thấy bảng) |
| TC-3.7 | `wp:anchor`, VML nhận; EMF/WMF cảnh báo đúng câu, không upload | ĐẠT | `docx.test.js`, e2e (câu 6) |
| TC-3.8 | .xlsx, .csv (có/không tiêu đề) giống dán TSV | ĐẠT | `docx.test.js` (xlsx 3 kiểu, csv `,` và `;`), e2e |
| TC-3.9 | 40 câu × 10 công thức + 5 hình < 5 s | ĐẠT | Node 72–78 ms; Chromium 78 ms (file mẫu); file thật 2,2 MB: 50 ms |
| TC-3.10 | > 10 MB, sai loại, .doc, PDF, docx hỏng → thông báo tiếng Việt, không treo | ĐẠT | `docx.test.js` (9 trường hợp), e2e (3 trường hợp, nút Thêm vẫn khóa) |
| TC-3.11 | `SERVER_COMPAT=1.0.0`: tải docx → lưu → học sinh làm | ĐẠT | e2e chế độ 1.0.0: lưu 28 câu, học sinh thấy 28 câu, bảng, hình, nộp bài có kết quả |
| TC-3.12 | Lúc đầu không tải jszip/xlsx; mở tab mới tải | ĐẠT | e2e đếm yêu cầu mạng (0 → 2) |
| TC-3.13 | `importer.test.js` vẫn đạt | ĐẠT | |
| Thêm | Thư viện không tải được → thông báo, vẫn dán văn bản | ĐẠT | e2e |
| Thêm | R-13 đăng xuất xóa giỏ câu / bộ lọc | ĐẠT | e2e |

Test cũ (đã chạy lại): `backend` 13/13, `importer` đạt, `bank` 30/30, `pha2-kiem-thu` 31/31, `cache` 17/17, `common-cache` 5/5, `pha1-kiem-thu` 29/29, `docx` 19/19; `e2e.js`, `bank.e2e.js`, `docx.e2e.js` đạt ở **cả hai** chế độ máy chủ.

### Số đo TC-3.9
| Phép đo | Thời gian |
|---|---|
| File mẫu 40 câu × 10 công thức + 5 hình PNG, Node | 72–78 ms |
| Cùng file, Chromium (Playwright) | 78 ms |
| File thật lớn nhất (2,2 MB, 44 câu, 153 công thức, 17 hình), Chromium | 50 ms |
| File thật nhiều công thức nhất (254 công thức), Chromium | 44 ms |
(Không tính thời gian tải hình lên.)

### Ảnh (`docs/bao-cao/anh/pha-3/`, đề mẫu tự soạn)
`01-hop-tai-file` (tab Tải file lên), `02-ket-qua-canh-bao` (bảng kết quả + cảnh báo), `03-cau-cong-thuc` (xem trước câu có công thức đã đổi, câu có mốc tô vàng), `04-cau-moc-to-vang` (trình soạn), `05-trinh-soan-cong-thuc`, `06-hop-tai-file-dien-thoai`, `07-ket-qua-dien-thoai` (390×844), `08-ket-qua-may-chu-cu` (máy chủ 1.0.0). Ảnh máy tính 1280×800. KaTeX lấy từ thư viện cục bộ vì môi trường chặn CDN.

### Chỗ lệch đặc tả + lý do
1. **Không dùng `DOMParser`**: tự viết bộ đọc XML nhỏ trong `docx-reader.js` để test trên Node cho cùng kết quả với trình duyệt (đặc tả yêu cầu hàm thuần chạy trên Node).
2. **.csv không qua SheetJS**: tự đọc (nhận UTF-8/BOM, dấu `,`/`;`, ô có xuống dòng) rồi dùng chung logic `fromTsv`. Không cần tải thư viện cho .csv; SheetJS chỉ dùng cho .xlsx/.xls.
3. **Không xác nhận được URL CDN từ môi trường này** (mạng chặn cdnjs và jsdelivr). Dùng đúng URL đặc tả; thêm nguồn dự phòng jsdelivr cùng phiên bản (`jszip@3.10.1/dist/jszip.min.js`, `xlsx@0.18.5/dist/xlsx.full.min.js` — đúng đường dẫn trong gói npm đã cài). Cần kiểm lại trên trang thật (xem Rủi ro).
4. **Mở rộng `fromText()`** cho mẫu VLSN và đề có lời giải (PHẦN IV, "Đáp án của em", HẾT, HƯỚNG DẪN GIẢI, nhãn mức độ, "Chọn B", Đúng/Sai trong lời giải, "Đáp số" có đơn vị). Đáp số có đơn vị → lấy số đầu + cảnh báo (khác Pha 2 ở kho: ở đây giáo viên xem trước nên được phép đoán, kèm cảnh báo).
5. **Độ**: theo đặc tả `° → ^\circ` (vd `25^\circ\text{C}`), khác cách kho cũ ghi `\text{°C}`; hiển thị như nhau.
6. **Bổ sung ngoài đặc tả**: bảng đáp án/bảng phương án/bảng dàn trang; hình vẽ bằng công cụ Word và khung văn bản (Text Box) → cảnh báo; công thức KaTeX không vẽ được → mốc ⟦…⟧; gộp cảnh báo "chưa có đáp án"; mốc ⟦…⟧ ghi kèm chữ gốc của công thức để dễ gõ lại.
7. **Phạm vi sửa `admin.js`**: ngoài `importDialog` có sửa nhỏ trong `viewEditor` (tô vàng câu còn mốc, đổi `previewHtml` thành hàm chung) — đặc tả yêu cầu tô vàng "trong trình soạn" — và `logout()` (R-13).
8. Hình trong phương án hoặc lời giải giữ đúng chỗ dạng `![](url)`; chỉ hình đầu tiên trong **nội dung** vào cột `hinhAnh`.

### Việc giáo viên cần làm
- **Không có việc với máy chủ** (không đổi Code.gs). Không có gì thêm vào danh sách Pha 6.
- Khuyến nghị: sau khi gộp, thử tải một file đề thật trên trang quản trị thật (để kiểm tra thư viện tải từ CDN và hình lên Drive).

### Rủi ro còn lại
- **CDN chưa xác nhận** từ môi trường này (bị chặn). Có nguồn dự phòng; nếu cả hai lỗi, web báo và thầy vẫn dán văn bản được.
- Chưa thử tải hình lên **Apps Script thật** (chỉ thử với máy chủ giả lập, cả 1.0.0 và mới); hình được thu nhỏ bằng `shrinkImage()` như tải ảnh tay.
- Đánh số tự động kiểu số (`1.`) luôn được hiểu là "Câu n." — nếu đề dùng danh sách số cho ý khác (vd các bước trong lời giải) sẽ tách nhầm câu; file thật hiện không dùng đánh số tự động.
- Chữ trong **khung văn bản (Text Box)** chưa được đọc (có cảnh báo). File thật hiện không có.
- File cũ gõ bằng **MathType** chỉ được cảnh báo (đúng phạm vi); các file thật đã thử đều dùng Equation.
- Đáp án đánh dấu bằng gạch chân/chữ đỏ vẫn hoãn (theo đặc tả).
