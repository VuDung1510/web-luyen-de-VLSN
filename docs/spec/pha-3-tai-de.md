# Pha 3 — Tải đề Word (.docx) / Excel (.xlsx) lên

## Mục tiêu
Trong hộp "Nhập nhanh câu hỏi" của trình soạn đề (`importDialog` trong `admin.js`), giáo viên chọn file .docx hoặc .xlsx/.csv; web đọc file **ngay trên trình duyệt**, đổi thành câu hỏi (kể cả công thức và hình), cho xem trước, rồi thêm vào đề. Chạy được với máy chủ cũ 1.0.0.

## Điều kiện vào pha (bắt buộc)
Giáo viên gửi 2–3 file đề Word thật (không đưa vào repo). Người làm thống kê: số công thức Equation (OMML) và MathType (OLE), số hình WMF/EMF, có dùng đánh số tự động không. Ghi vào báo cáo **trước** khi viết `omml2latex`.
- Đa số là OMML: làm đủ phạm vi dưới.
- Đa số là MathType: **thu nhỏ** pha thành .xlsx/.csv + .docx chữ thường và hình (bỏ `omml2latex`, ước lượng M); giáo viên quyết định có hoãn hẳn phần Word hay không (câu hỏi mở số 7).

## Phạm vi
**Làm**
1. Tab thứ ba "Tải file lên" (kéo-thả hoặc chọn file, ≤ 10 MB).
2. .docx: đọc `word/document.xml` bằng JSZip; chuyển đoạn văn thành văn bản theo đúng quy ước mà `Importer.fromText()` đã hiểu (Câu 1., PHẦN I/II/III, A. B. C. D., a) b) c) d), (Đ)/(S), Đáp án:, Lời giải:), rồi gọi `fromText()`.
3. Công thức Equation của Word (OMML `m:oMath`) ⇒ LaTeX trong `$…$` bằng bộ chuyển tự viết `omml2latex` (mục dưới).
4. Hình nhúng (`word/media/*`) ⇒ thu nhỏ bằng `shrinkImage()` sẵn có ⇒ `adminUploadImage` ⇒ gắn vào câu chứa hình (cột `hinhAnh`; câu có ≥ 2 hình thì hình thứ 2 trở đi chèn `![](url)` vào nội dung).
5. Bảng Word ⇒ khối `[BẢNG] a | b` (cùng định dạng kho). Phần hiển thị `[BẢNG]` trong `rich()` do pha vào trước làm (00 §4).
6. .xlsx/.csv: đọc bằng SheetJS ⇒ mảng hàng ⇒ dùng logic `fromTsv()` (nhận diện tiêu đề, mẫu cột hiện có `DEFAULT_COLS`).
7. Xem trước từng câu (dùng `previewHtml` sẵn có) + danh sách cảnh báo có số câu.

**Không làm**: .doc (Word 97), PDF, ảnh chụp đề (OCR); công thức MathType dạng OLE (chỉ cảnh báo); giải mã hình WMF/EMF; ghi câu từ file vào kho.

**Hoãn sau**: đáp án đánh dấu bằng gạch chân/chữ đỏ; nhận mẫu 22 cột của kho qua .xlsx (giáo viên đã có tab Ngân hàng ở Pha 2).

## Thiết kế kỹ thuật

### Thư viện (tải lười khi mở tab, phiên bản cố định)
- JSZip `https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js`
- SheetJS `https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js`
- Không dùng mammoth.js: mammoth bỏ qua công thức OMML (rủi ro lớn nhất của pha) và không giữ được gạch chân/màu đủ tin cậy; tự đọc XML bằng `DOMParser` gọn hơn. Người làm xác nhận URL tồn tại trước khi dùng; tải thất bại ⇒ thông báo "Không tải được thư viện đọc file, hãy dán văn bản".
- Mã mới đặt trong `assets/js/docx-reader.js` (hàm thuần, chạy được cả trên Node để test, như `importer.js`).

### Đọc .docx (`DocxReader.read(arrayBuffer) → {text, images[], warnings[]}`)
- Duyệt `w:body` theo thứ tự: `w:p` (đoạn) ⇒ một dòng; `w:tbl` ⇒ khối `[BẢNG]`; `w:r/w:t` ⇒ chữ; `w:br` ⇒ xuống dòng; hình ở cả 3 dạng `w:drawing/wp:inline`, `w:drawing/wp:anchor` (hình nổi) và VML `v:imagedata r:id` ⇒ chèn mốc `{{HINH:n}}` rồi tra `word/_rels/document.xml.rels` lấy file media.
- Hình `.wmf`/`.emf` (trình duyệt không vẽ được, `shrinkImage()` sẽ lỗi) ⇒ không tải lên, cảnh báo "Câu n: hình cần chụp lại hoặc lưu lại dạng PNG".
- Đánh số tự động của Word (`w:numPr`) cho "Câu 1." hay "A." **không nằm trong văn bản**: đọc `word/numbering.xml` để dựng lại tiền tố (`decimal` ⇒ "Câu n.", `upperLetter` ⇒ "A.", `lowerLetter` ⇒ "a)"). Không dựng được ⇒ cảnh báo.

### Công thức OMML → LaTeX (`omml2latex(node)`)
Hỗ trợ tối thiểu (đủ cho đề Vật lý THPT): `m:f` ⇒ `\frac{}{}`; `m:sSup`, `m:sSub`, `m:sSubSup` ⇒ `^{}`, `_{}`; `m:rad` ⇒ `\sqrt{}` / `\sqrt[n]{}`; `m:d` ⇒ `\left( … \right)` (theo `m:begChr/m:endChr`); `m:nary` ⇒ `\sum`, `\int`; `m:func` ⇒ `\sin`, `\cos`, `\ln`…; `m:acc` ⇒ `\vec`, `\overline`, `\hat`; `m:bar`; `m:m` (ma trận) ⇒ cảnh báo; `m:r/m:t` ⇒ ký tự, ánh xạ Unicode ⇒ lệnh (α ⇒ `\alpha`, π ⇒ `\pi`, Δ ⇒ `\Delta`, ω ⇒ `\omega`, λ ⇒ `\lambda`, φ/ϕ ⇒ `\varphi`, ° ⇒ `^\circ`, · ⇒ `\cdot`, × ⇒ `\times`, ≈ ⇒ `\approx`, ≤ ≥ ≠ → ⇒ lệnh tương ứng). Chữ thường trong `m:sty m:val="p"` ⇒ `\text{}`.
- Kết quả phải giống phong cách kho (vd `$T_{1} = 300\ \text{K}$`) và hiển thị được bằng KaTeX hiện có. Phần tử không hỗ trợ ⇒ chèn `⟦công thức chưa đổi được⟧` + cảnh báo "Câu n: 1 công thức cần gõ lại".
- Công thức MathType (OLE, `w:object` + ảnh WMF/EMF) ⇒ không đọc được; cảnh báo kèm số câu và gợi ý: trong Word dùng MathType → "Convert Equations" sang Word Equation, rồi tải lại.

### Luồng giao diện
Chọn file ⇒ thanh tiến độ "Đọc file… / Đổi công thức… / Tải n hình…" ⇒ bảng kết quả: số câu theo phần, số công thức đã đổi / chưa đổi, số hình, cảnh báo ⇒ nút "Thêm vào đề" / "Thay toàn bộ" như hiện có. Hình chỉ tải lên **sau** khi giáo viên bấm thêm (tránh rác trong Drive). Câu còn mốc `⟦…⟧` được tô vàng trong trình soạn.

### Tương thích máy chủ
Chỉ dùng `adminUploadImage` và `adminSaveExam` (có ở 1.0.0) ⇒ **không cần máy chủ mới**. Không đổi Code.gs trong pha này.

## Tiêu chí nghiệm thu
File mẫu do người kiểm thử **tự tạo** bằng script (`tests/fixtures/make-docx.js` dùng JSZip trên Node) và (khuyến nghị) một file Word thật giáo viên cung cấp.
- **TC-3.1** .docx 28 câu (18 P1 – 4 P2 – 6 P3) gõ chữ thường theo quy ước ⇒ nhận đủ 28 câu đúng loại/phần/đáp án, giống kết quả khi dán cùng văn bản vào tab "Dán văn bản".
- **TC-3.2** OMML: bộ 20 công thức mẫu (phân số lồng, mũ âm `10^{-5}`, căn, ngoặc lớn, chữ Hy Lạp, đơn vị `\text{}`, vector, độ °C) ⇒ LaTeX đúng từng chuỗi kỳ vọng và KaTeX hiển thị không lỗi (`throwOnError: true` trong test).
- **TC-3.3** Công thức không hỗ trợ (ma trận) và đối tượng OLE ⇒ cảnh báo đúng số câu; không văng lỗi; các câu khác vẫn nhận.
- **TC-3.4** Đánh số tự động của Word cho "Câu" và "A./B./C./D." ⇒ nhận đúng như gõ tay.
- **TC-3.5** 3 hình nhúng ở câu 2, 5, 5 ⇒ câu 2 có `hinhAnh`, câu 5 có `hinhAnh` + 1 `![](…)` trong nội dung; mỗi hình gọi `adminUploadImage` đúng 1 lần, chỉ sau khi bấm thêm.
- **TC-3.6** Bảng Word 2×5 ⇒ khối `[BẢNG]` hiển thị thành bảng.
- **TC-3.7** Hình nổi (`wp:anchor`), hình VML (`v:imagedata`) được nhận; hình `.emf`/`.wmf` ⇒ cảnh báo đúng số câu, không gọi `adminUploadImage`, không lỗi.
- **TC-3.8** .xlsx và .csv theo mẫu cột hiện tại (`DEFAULT_COLS`, có và không có hàng tiêu đề) ⇒ nhận đúng như dán TSV.
- **TC-3.0** Báo cáo có bảng thống kê file thật theo "Điều kiện vào pha".
- **TC-3.9** File 40 câu, 10 công thức/câu, 5 hình: đọc + đổi xong < 5 s trên máy kiểm thử (không tính tải hình lên).
- **TC-3.10** File > 10 MB, file không phải docx/xlsx, docx hỏng ⇒ thông báo tiếng Việt rõ ràng, không treo trang.
- **TC-3.11** Chạy e2e với `SERVER_COMPAT=1.0.0`: tải docx ⇒ lưu đề ⇒ học sinh làm được.
- **TC-3.12** Thư viện chỉ tải khi mở tab "Tải file lên" (kiểm tra tab mạng: trang quản trị lúc đầu không tải jszip/xlsx).
- **TC-3.13** Test cũ `importer.test.js` vẫn đạt.

## Kế hoạch kiểm thử
Cài thư viện cho test (không thêm vào repo): `npm i --no-save jszip@3.10.1 xlsx@0.18.5 katex@0.16.9`, hoặc trỏ `LIBS_DIR` tới thư mục `node_modules` có sẵn như e2e hiện tại.
Node: `tests/docx.test.js` (DocxReader + omml2latex trên fixture tự sinh; KaTeX từ `LIBS_DIR` để kiểm tra hiển thị), `tests/importer.test.js` bổ sung xlsx (SheetJS từ node_modules). E2E: tải file qua `setInputFiles`. Ảnh: hộp tải file, bảng kết quả có cảnh báo, câu có công thức đã đổi, câu có mốc chưa đổi.

## Rủi ro & cách giảm
| Rủi ro | Giảm |
|---|---|
| Công thức Word đa dạng, đổi sai âm thầm | Bộ test 20 công thức; xem trước bắt buộc trước khi thêm; mốc `⟦…⟧` khi không chắc |
| Đề dùng MathType OLE (phổ biến ở đề cũ) | Phát hiện + hướng dẫn chuyển đổi trong Word; không cố đọc ảnh WMF |
| Định dạng đề khác quy ước (đáp án ở bảng cuối, "Câu 1:" in đậm…) | Dựa vào `fromText()` đã có (bảng đáp án cuối đề có hỗ trợ); cảnh báo câu thiếu đáp án |
| Thư viện CDN không tải được | Dự phòng: dán văn bản như cũ |

## Việc giáo viên cần làm
Không có việc với máy chủ. **Trước pha:** gửi 2–3 file đề Word thật (bắt buộc, xem Điều kiện vào pha).

## Ước lượng: **L** nếu đề thật dùng Equation (riêng `omml2latex` cỡ M); **M** nếu thu nhỏ vì đa số là MathType.

Sửa đặc tả ngày 18/11/2026: theo `soat-pha-0.md` S-14, S-27, S-28; hoãn mục gạch chân/chữ đỏ và mẫu 22 cột.
