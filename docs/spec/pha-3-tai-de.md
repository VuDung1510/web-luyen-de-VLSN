# Pha 3 — Tải đề Word (.docx) / Excel (.xlsx) lên

## Mục tiêu
Trong hộp "Nhập nhanh câu hỏi" của trình soạn đề (`importDialog` trong `admin.js`), giáo viên chọn file .docx hoặc .xlsx/.csv; web đọc file **ngay trên trình duyệt**, đổi thành câu hỏi (kể cả công thức và hình), cho xem trước, rồi thêm vào đề. Chạy được với máy chủ cũ 1.0.0.

## Phạm vi
**Làm**
1. Tab thứ ba "Tải file lên" (kéo-thả hoặc chọn file, ≤ 10 MB).
2. .docx: đọc `word/document.xml` bằng JSZip; chuyển đoạn văn thành văn bản theo đúng quy ước mà `Importer.fromText()` đã hiểu (Câu 1., PHẦN I/II/III, A. B. C. D., a) b) c) d), (Đ)/(S), Đáp án:, Lời giải:), rồi gọi `fromText()`.
3. Công thức Equation của Word (OMML `m:oMath`) ⇒ LaTeX trong `$…$` bằng bộ chuyển tự viết `omml2latex` (mục dưới).
4. Hình nhúng (`word/media/*`) ⇒ thu nhỏ bằng `shrinkImage()` sẵn có ⇒ `adminUploadImage` ⇒ gắn vào câu chứa hình (cột `hinhAnh`; câu có ≥ 2 hình thì hình thứ 2 trở đi chèn `![](url)` vào nội dung).
5. Bảng Word ⇒ khối `[BẢNG] a | b` (cùng định dạng kho, đã hiển thị được từ Pha 2; nếu Pha 3 làm trước Pha 2 thì Pha 3 làm luôn phần hiển thị `[BẢNG]`).
6. (đề xuất thêm) Đáp án đánh dấu bằng **gạch chân** hoặc **chữ đỏ** ở phương án/ý (thói quen phổ biến trong đề Word) ⇒ hiểu như `*B.` / `(Đ)`.
7. .xlsx/.csv: đọc bằng SheetJS ⇒ mảng hàng ⇒ dùng logic `fromTsv()` (nhận diện tiêu đề). Thêm nhận diện **mẫu 22 cột của kho** (Mã câu, Dạng câu hỏi, Nội dung câu hỏi, A / a)…, Đáp án, Lời giải, Hình vẽ…) dùng chung hàm ánh xạ của Pha 2 (bản JS ở `importer.js`: `fromBankRows()`), để giáo viên tải một phần kho đã xuất ra Excel.
8. Xem trước từng câu (dùng `previewHtml` sẵn có) + danh sách cảnh báo có số câu.

**Không làm**: .doc (Word 97), PDF, ảnh chụp đề (OCR); công thức MathType dạng OLE (chỉ báo cảnh báo); ghi câu từ file vào kho.

## Thiết kế kỹ thuật

### Thư viện (tải lười khi mở tab, phiên bản cố định)
- JSZip `https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js`
- SheetJS `https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js`
- Không dùng mammoth.js: mammoth bỏ qua công thức OMML (rủi ro lớn nhất của pha) và không giữ được gạch chân/màu đủ tin cậy; tự đọc XML bằng `DOMParser` gọn hơn. Người làm xác nhận URL tồn tại trước khi dùng; tải thất bại ⇒ thông báo "Không tải được thư viện đọc file, hãy dán văn bản".
- Mã mới đặt trong `assets/js/docx-reader.js` (hàm thuần, chạy được cả trên Node để test, như `importer.js`).

### Đọc .docx (`DocxReader.read(arrayBuffer) → {text, images[], warnings[]}`)
- Duyệt `w:body` theo thứ tự: `w:p` (đoạn) ⇒ một dòng; `w:tbl` ⇒ khối `[BẢNG]`; `w:r/w:t` ⇒ chữ; `w:br` ⇒ xuống dòng; `w:drawing` (`a:blip r:embed`) ⇒ chèn mốc `{{HINH:n}}` rồi tra `word/_rels/document.xml.rels` lấy file media.
- Đánh số tự động của Word (`w:numPr`) cho "Câu 1." hay "A." **không nằm trong văn bản**: đọc `word/numbering.xml` để dựng lại tiền tố (`decimal` ⇒ "Câu n.", `upperLetter` ⇒ "A.", `lowerLetter` ⇒ "a)"). Không dựng được ⇒ cảnh báo.
- Định dạng: `w:u` (gạch chân), `w:color` đỏ (`FF0000` hoặc gần đỏ) trên phương án ⇒ đánh dấu đáp án (mục 6).

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
- **TC-3.7** (đề xuất thêm) Phương án gạch chân/chữ đỏ ⇒ đáp án đúng; ý Đ/S đánh dấu đỏ ⇒ chuỗi `ĐSSĐ` đúng.
- **TC-3.8** .xlsx theo mẫu cột hiện tại (`DEFAULT_COLS`) và theo mẫu 22 cột của kho ⇒ nhận đúng; câu kho không đáp án bị bỏ kèm cảnh báo; Phần IV bỏ kèm cảnh báo.
- **TC-3.9** File 40 câu, 10 công thức/câu, 5 hình: đọc + đổi xong < 5 s trên máy kiểm thử (không tính tải hình lên).
- **TC-3.10** File > 10 MB, file không phải docx/xlsx, docx hỏng ⇒ thông báo tiếng Việt rõ ràng, không treo trang.
- **TC-3.11** Chạy e2e với `SERVER_COMPAT=1.0.0`: tải docx ⇒ lưu đề ⇒ học sinh làm được.
- **TC-3.12** Thư viện chỉ tải khi mở tab "Tải file lên" (kiểm tra tab mạng: trang quản trị lúc đầu không tải jszip/xlsx).
- **TC-3.13** Test cũ `importer.test.js` vẫn đạt.

## Kế hoạch kiểm thử
Node: `tests/docx.test.js` (DocxReader + omml2latex trên fixture tự sinh; KaTeX từ `LIBS_DIR` để kiểm tra hiển thị), `tests/importer.test.js` bổ sung xlsx (SheetJS từ node_modules). E2E: tải file qua `setInputFiles`. Ảnh: hộp tải file, bảng kết quả có cảnh báo, câu có công thức đã đổi, câu có mốc chưa đổi.

## Rủi ro & cách giảm
| Rủi ro | Giảm |
|---|---|
| Công thức Word đa dạng, đổi sai âm thầm | Bộ test 20 công thức; xem trước bắt buộc trước khi thêm; mốc `⟦…⟧` khi không chắc |
| Đề dùng MathType OLE (phổ biến ở đề cũ) | Phát hiện + hướng dẫn chuyển đổi trong Word; không cố đọc ảnh WMF |
| Định dạng đề khác quy ước (đáp án ở bảng cuối, "Câu 1:" in đậm…) | Dựa vào `fromText()` đã có (bảng đáp án cuối đề có hỗ trợ); cảnh báo câu thiếu đáp án |
| Thư viện CDN không tải được | Dự phòng: dán văn bản như cũ |

## Việc giáo viên cần làm
Không có việc với máy chủ. (khuyến nghị) Gửi 1–2 file đề Word thật để kiểm thử TC-3.1/3.2 (không đưa vào repo).

## Ước lượng: **L** (riêng `omml2latex` ~ M)
