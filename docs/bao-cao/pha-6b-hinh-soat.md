# Pha 6b — Soát code bản sửa "hình đặt nổi trong file Word" (Người soát)

Nhánh `pha-6b-hinh-noi`, commit `0b3c33e`. Phạm vi: `assets/js/importer.js` (`fromText`, `splitOptions`), test mới trong `tests/docx.test.js`.

## Tóm tắt cho giáo viên

1. Đề Word thật có hình neo trong đoạn "Câu 6: …" / ý "a. …" nay đọc đủ câu: đề thầy gửi từ 25 lên 28 câu, không còn câu thiếu phương án; mỗi hình vào đúng câu, không hình nào bị lặp.
2. Văn bản dán bình thường (không có hình) cho kết quả y hệt bản cũ. 4 file Word thật khác cũng cho kết quả y hệt.
3. Còn 3 chỗ nhỏ cần lưu ý (xem R-1 đến R-3). Không có chỗ nào chặn việc gộp. Code.gs không đổi, thầy không cần triển khai lại.

## Đã kiểm

- `node tests/importer.test.js`: đạt. `node tests/docx.test.js` (có `LIBS_DIR`): 30/30 đạt. `node tests/backend.test.js`: 13/13 đạt.
- `apps-script/Code.gs`: không có trong diff, nên không cần tăng `APP_VERSION`.
- File thật (chỉ đọc, không chép nội dung ra đây): `de-thay/de.docx` lên 28 câu (18/4/6), 4/4 mốc vào câu và đúng câu (3 hình ở đoạn "Câu n" vào câu n, 1 hình ở ý "a." vào câu Đúng/Sai đó), không còn câu thiếu phương án. `f1`–`f4`: kết quả giống hệt bản cũ (so JSON). Ở `f3` có một mốc nằm trong PHẦN IV nên bị bỏ, đúng thiết kế.
- So ngẫu nhiên 30 000 văn bản ghép từ các dòng mẫu (nhãn câu, phương án, ý a–d, Đáp án, Lời giải, Chọn, HẾT, HƯỚNG DẪN GIẢI, BẢNG ĐÁP ÁN, PHẦN I–IV). Không có mốc, có mốc giữa dòng hay có dòng chỉ chứa mốc: **0 khác biệt** so với bản cũ. Khác biệt duy nhất là dòng kiểu `A. a}}B. b …` (R-3).
- Không lặp hình: 235 000 mốc ngẫu nhiên, không mốc nào xuất hiện quá 1 lần.
- Trước Câu 1: dòng có mốc mà không phải PHẦN thì vẫn bị bỏ như cũ.
- Sau HẾT: hình ở đầu "Câu n" của lời giải vào `loiGiai` của câu n.
- Hiệu năng: `LEAD_RE` neo đầu dòng và không backtrack bùng nổ. 3000 câu chạy trong khoảng 11 ms; một dòng 20 000 mốc chạy trong khoảng 2 ms.
- `splitOptions`: `A. 1{{HINH:6}}B. 2 C. 3 D. 4` tách đúng (mốc dính vào A). `A.1{{HINH:7}}B tiếp` không bị tách nhầm, vì sau "B" không có dấu chấm và khoảng trắng. Công thức `$\vec{B}.$` không bị ảnh hưởng.

## Phát hiện

**R-1 (Vừa) — hình ở đầu đoạn "Lời giải:" / "Đáp án:" / "Chọn B" được đưa vào nội dung câu hỏi** (`assets/js/importer.js:204`, `:211`).
Ví dụ `{{HINH:1}}Lời giải: …` cho ra `noiDung = "…\n{{HINH:1}}"`. Hình của lời giải vì thế hiện cho học sinh ngay lúc làm bài. Bản cũ còn tệ hơn: cả dòng lời giải rơi vào nội dung câu. Vậy đây không phải lỗi mới sinh ra, nhưng test mới lại khẳng định đúng hành vi này.
Đề xuất: ở nhánh `lm` (dòng 211), ghi mốc vào `loiGiai` thay cho `noiDung`. Ở nhánh `am` (dòng 204), nếu có phần "Lời giải" cùng dòng thì cũng ghi vào `loiGiai`. Sửa kỳ vọng test tương ứng trong `tests/docx.test.js`.

**R-2 (Nhẹ) — mốc gửi chờ ở dòng PHẦN có thể mất hoặc vào sai chỗ** (`:153`, `:165`).
- Có hình ở dòng "PHẦN …" mà sau đó không có "Câu n" (gặp HẾT, BẢNG ĐÁP ÁN hoặc hết văn bản): `pendingImg` không bao giờ được xả, nên hình mất lặng lẽ.
- Hình ở dòng "PHẦN …" trước HẾT bị chuyển vào `loiGiai` của câu lời giải đầu tiên sau HẾT.
- Logo hoặc hình khung đầu đề neo trong đoạn "PHẦN I" (trước Câu 1) nay vào nội dung Câu 1. Điều này hơi trái với nguyên tắc "trước câu 1 bỏ như cũ".

Chưa gặp trong 5 file thật. Đề xuất: khi gặp HẾT, BẢNG ĐÁP ÁN, HƯỚNG DẪN GIẢI hoặc hết vòng lặp, nếu `pendingImg` còn thì gắn vào câu vừa đóng, hoặc thêm cảnh báo "hình ở dòng PHẦN … chưa gắn câu". Có thể bỏ hình ở dòng PHẦN đầu tiên khi chưa có câu nào (`qs.length === 0 && !cur`).

**R-3 (Nhẹ) — `splitOptions` tách cả sau `}}` bất kỳ, không riêng mốc hình** (`:313`).
Một dòng phương án có công thức kết thúc bằng `}}` dính liền "B. " (vd `A. $\frac{1}{2}}B. x$ …`) nay bị tách thành phương án B. Bản cũ không tách. Trường hợp này hiếm và chỉ xảy ra với dòng đã bắt đầu bằng "A.".
Đề xuất: chỉ nhận đúng mốc, tức đổi `\}\}` thành lookbehind `(?<=\{\{HINH:\d+\}\})`, hoặc nhóm `\{\{HINH:\d+\}\}` rồi tính `start` theo nhóm đó.

**Ghi chú nhỏ (không cần sửa):**
- `restoreLead` bỏ khoảng trắng giữa mốc và chữ (`{{HINH:3}} Cho…` thành `{{HINH:3}}Cho…`). Không ảnh hưởng hiển thị.
- Sau HẾT, dòng `{{HINH}}Lời giải:` / `{{HINH}}Đáp án: B` vẫn giữ nguyên nhãn và không lấy được đáp án (`:194`), giống bản cũ. Có thể gọi `solLine(lead)` rồi `solLine(t)` để nhất quán.
- Hình đặt ở đầu dòng phương án "A." đi vào nội dung câu chứ không vào ô phương án. Với đề có phương án là hình nổi, các hình sẽ dồn vào nội dung theo thứ tự. Bản cũ cũng không xử lý được trường hợp này.

## Kết luận

**ĐẠT, có lưu ý.** Bản sửa đúng mục tiêu: hình thuộc đúng câu, hình ở dòng PHẦN chuyển sang câu kế, không lặp hình. Văn bản không có mốc và 4 file Word thật khác cho kết quả y hệt bản cũ. Hiệu năng tốt, Code.gs không đổi. Nên sửa R-1 trước khi gộp vì nó làm lộ hình lời giải cho học sinh, dù chưa gặp trong file thật. R-2 và R-3 có thể để sau.

## Vòng 2 (soát commit `34bd21b`, diff `665a3e0..34bd21b`)

**Tóm tắt cho giáo viên:** hình nằm ở dòng "Lời giải / Chọn B / Đáp án" nay vào phần lời giải, học sinh không còn thấy lúc làm bài. Hình ở dòng "PHẦN …" không còn bị mất. Công thức có "}}" không còn bị tách nhầm thành phương án. Đề thầy và 4 file Word thật khác vẫn cho kết quả như vòng 1.

- **R-1: đã sửa.**
  - Dòng `{{HINH}}Lời giải: …`, `{{HINH}}Chọn B`, `{{HINH}}Chọn B. Lời giải: …` và `{{HINH}} Đáp án: C`: hình vào `loiGiai` qua `addSolImg` (`importer.js:224–231`), đáp án vẫn nhận đúng.
  - Sau HẾT, dòng có nhãn được nhận nhãn trước rồi mới nối hình (`:210–214`): "Lời giải:" bỏ nhãn đúng cách, "Đáp án: B" ghi được đáp án. Đây cũng là ghi chú nhỏ ở vòng 1, nay đã giải quyết.
  - Lời giải bắt đầu bằng một dòng chỉ có hình không còn che việc tìm "Chọn B" hay "a) Đúng …", nhờ `HINH_LINE` (`:129`, `:282`, `:288`). Đã thử cả câu trắc nghiệm lẫn câu Đúng/Sai.
- **R-2: đã sửa.**
  - Hình ở dòng "PHẦN …" mà không có "Câu n" theo sau được `flushPending` (`:138`, gọi ở HẾT, HƯỚNG DẪN GIẢI, BẢNG ĐÁP ÁN và cuối văn bản) gắn vào câu vừa đóng. Trước HẾT thì vào nội dung câu, sau HẾT thì vào lời giải. Không có câu nào thì có cảnh báo.
  - Dòng PHẦN đầu đề (trước Câu 1) và dòng PHẦN trong bảng đáp án: bỏ như cũ (`:167`).
  - Hình ở dòng "PHẦN IV" đi theo câu Phần IV và bị bỏ cùng các câu đó. Cảnh báo "Bỏ qua Phần IV" chung đã bao trường hợp này, chấp nhận được.
- **R-3: đã sửa.** `splitOptions` chỉ nhận nhãn ngay sau đúng mốc `{{HINH:n}}` (`:334`). `A. $\frac{1}{2}}B. x$` không còn bị tách; `A. 1{{HINH:6}}B. 2 …` vẫn tách đúng.
- **Không hồi quy:**
  - Bộ test: `importer.test.js` đạt, `docx.test.js` 30/30 đạt, `backend.test.js` 13/13 đạt.
  - So ngẫu nhiên lại với bản `main`: không có mốc, có mốc giữa dòng, dòng chỉ có mốc, và cả dòng `x}}B.` lẫn `A. a}}B. b …`: **0 khác biệt**.
  - Không lặp hình: khoảng 233 000 mốc ngẫu nhiên, không mốc nào xuất hiện quá 1 lần. Mốc còn rơi ngoài câu chỉ là những dòng thuộc Phần IV, đứng trước Câu 1, hoặc là lời giải cho câu không có trong đề. Chữ của các dòng này cũng bị bỏ như văn bản thường.
  - 5 file thật: `de.docx` vẫn 28 câu, 4/4 hình vào đúng câu, không câu nào thiếu phương án. `f1`–`f4` giống hệt bản cũ.
  - `apps-script/Code.gs` không đổi.

**Phát hiện mới:** không có lỗi Nặng hay Vừa. Có một điểm Nhẹ, không cần sửa: sau HẾT, dòng bắt đầu bằng "Giải thích…" (không có dấu ":") cũng khớp nhãn ở `:212`, nên hình bị chuyển xuống sau dòng chữ. Hình vẫn nằm trong đúng lời giải.

### Kết luận vòng 2

**ĐẠT.** R-1, R-2 và R-3 đều đã sửa đúng, có test đi kèm, không thấy hồi quy. Có thể gộp.
