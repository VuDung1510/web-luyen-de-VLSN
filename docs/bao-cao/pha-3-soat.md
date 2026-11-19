# Soát code Pha 3 — Tải đề Word / Excel lên

Người soát: độc lập (không phải người làm). Nhánh `pha-3-tai-de` (commit `8cfe62e`), so với `main` (`git diff main...pha-3-tai-de`, 10 commit từ c14b3e8).
Ngày: 19/11/2026.

## Tóm tắt cho giáo viên
- Phần tải file Word/Excel làm đúng yêu cầu: web đọc file ngay trên máy, đổi công thức đúng, chỉ gửi hình lên Drive khi thầy bấm "Thêm vào đề", mỗi hình gửi một lần. Máy chủ hiện tại của thầy dùng được, không phải dán lại Code.gs.
- Đã thử trên 4 file đề thật: nhận đủ số câu, đổi được hết công thức. Chữ lạ trong file không chèn được mã độc vào trang.
- Còn 3 điểm nên sửa trước khi gộp. (1) Câu có dòng riêng "Chọn câu đúng." bị hiểu thành "đáp án C". (2) Lời giải đặt sau "HẾT" mà không có tiêu đề PHẦN có thể gắn nhầm vào câu khác. (3) Một file cố tình làm hỏng có thể làm trang đứng hình nhiều phút.
- Thầy vẫn cần xem trước kỹ cột "Đáp án" của từng câu trước khi bấm thêm.

## Kết luận: **ĐẠT**
Không có phát hiện Nặng. Có 3 phát hiện **Vừa** nên sửa trước khi gộp: R-1, R-2, R-3. Các phát hiện còn lại đều Nhẹ.

## Đã kiểm
- **Test chạy lại** (`LIBS_DIR` = thư mục nháp có katex, jszip 3.10.1, xlsx 0.18.5):
  - `node tests/importer.test.js`: đạt.
  - `node tests/backend.test.js`: 13/13 đạt.
  - `node tests/docx.test.js`: 19/19 đạt.
  - `tests/docx.e2e.js` với dev-server `SERVER_COMPAT=1.0.0`, cổng 8795: ĐẠT. Gồm: lưu đề 28 câu; học sinh thấy 28 câu, bảng và hình rồi nộp bài; `adminUploadImage` gọi 0 lần trước khi bấm thêm và 3 lần sau đó; R-13.
  - Chưa chạy e2e ở chế độ máy chủ mới, vì người kiểm thử đang dùng chung thư mục.
- **File Word thật** (4 file trong thư mục nháp, chỉ đọc): số câu theo phần, số công thức (46/46, 153/153, 72/72, 254/254) và số hình khớp bảng của người làm. Mỗi file đọc trong 20–60 ms trên Node. Không có đáp án nào sai kiểu (TN ngoài A–D, ĐS khác 4 ký tự, TL không phải số).
- **Tương thích 1.0.0**: diff không đụng `apps-script/`. Giao diện chỉ gọi `adminUploadImage` (có `base64`, `mime`, `name`) và `adminSaveExam`, cả hai đều có trong `tests/fixtures/Code-1.0.0.gs`. Không dùng action mới.
- **XSS** (thử bằng Playwright với file .docx độc tự tạo): `<img onerror>` đặt trong nội dung, phương án, lời giải, ô bảng, trong `$…$`, trong ProgID của OLE, trong chữ của công thức lỗi, và trong mốc `⟦ … ⟧` cắt ngang cú pháp `![](url)`. Kết quả: 0 lần chạy, 0 thuộc tính `onerror`, cả ở hộp xem trước lẫn trình soạn.
  - Mọi chuỗi lấy từ file đều qua `esc()` hoặc `rich()`: tên file, cảnh báo, đáp án, mức độ, tên trang tính. Thông báo lỗi dùng `esc()`. `toast` dùng `textContent`.
  - Thẻ `<mark>` cho mốc `⟦…⟧` được thêm sau `rich()`. Nếu mốc cắt ngang thuộc tính thì HTML có thể méo, nhưng ngay sau thuộc tính luôn là `">` cố định, nên không chèn được thuộc tính sự kiện.
  - Hình SVG không được nhận là hình ảnh (`BROWSER_OK` không có svg), nên không có blob SVG.
- **Lộ đáp án / PIN / mật khẩu**: dữ liệu chỉ nằm ở trang quản trị. Không có gì mới được ghi vào bộ đệm. Không có PIN hay mật khẩu trong diff.
- **Hình**: chỉ tải lên trong `finish()` (`admin.js` 626–658), sau khi bấm "Thêm vào đề" hoặc "Thay toàn bộ". Hình được gộp theo đường dẫn media (`byPath`), nên mỗi file hình chỉ tải 1 lần. Chỉ tải hình thật sự nằm trong câu (`toQuestions().images`). WMF/EMF, hình vẽ của Word, hình liên kết và hình thiếu không được tải. Trong lúc tải, hộp nhập không đóng được (`sticky`).
- **Tải lười thư viện**: chỉ tải khi mở tab "Tải file lên" (e2e đếm 0 → 2 yêu cầu). URL cố định đúng đặc tả. Nguồn dự phòng jsdelivr cùng phiên bản: `jszip@3.10.1/dist/jszip.min.js` và `xlsx@0.18.5/dist/xlsx.full.min.js` đều có trong gói npm đúng phiên bản (đã xem trong `LIBS_DIR`). Từ môi trường này không gọi được cdnjs hay jsdelivr (bị chặn), nên chưa xác nhận trực tiếp.
- **omml2latex**: đã thử thêm 22 công thức ngoài test. Gồm mũ âm, phân số lồng, `e^{-t/τ}`, ngoặc `[ ]` `| |`, `\overrightarrow{AB}`, căn bậc 3, `\sum`/`\int` có cận, gạch trên/dưới (mặc định `bot` đúng theo OMML), hạt nhân `{}_{92}^{235}U`, `-3,5^\circ\text{C}`, đơn vị `\text{m/s}`, `\sin \left(\omega t + \varphi\right)`, chữ Việt trong công thức. Tất cả đều đúng và KaTeX `throwOnError` vẽ được. Mặc định của `m:nary` (∫), `m:acc` (U+0302), `m:groupChr` và `m:bar` đều đúng chuẩn.
- **`fromText()` với dữ liệu cũ**: `importer.test.js` đạt. Đối chiếu bản `main`: phần mở rộng chỉ chạy khi gặp dòng mới (PHẦN 4/IV, HẾT, HƯỚNG DẪN GIẢI, nhãn mức độ, "Đáp án của em"), hoặc khi câu chưa có đáp án.
- **Bộ đọc XML tự viết**:
  - Không mở rộng entity tự khai báo, nên không bị "billion laughs". `<!DOCTYPE …>` bị bỏ qua.
  - Dựng cây bằng ngăn xếp nên không đệ quy.
  - Giới hạn 10 MB được kiểm cả theo `file.size` (trước khi đọc) lẫn trong `read()`/`readFile()`.
  - Xem R-3 và R-4 cho các trường hợp còn lại.
- **R-13**: `logout()` đặt `bankMeta = null` và `draftFromBank = null`, xóa `ld_bank_cart` và `ld_bank_filter` trong `sessionStorage`. Các biến khai báo bằng `let` ở cấp module và chỉ được dùng sau khi script chạy xong, nên không gặp TDZ. e2e có kiểm. Đúng.

## Bảng phát hiện

| Mã | Mức | File:dòng | Mô tả | Tái hiện | Đề xuất sửa |
|---|---|---|---|---|---|
| R-1 | **Vừa** | `assets/js/importer.js` 166 | Bản sửa "Chọn …" chưa kín. Regex `^(Ch[ọo]n)\s*[:.]?\s*([A-D]\b.*)$` có cờ `i`, và `\b` của JS (không có cờ `u`) coi chữ có dấu là "không phải chữ". Vì vậy dòng câu dẫn **"Chọn câu đúng."**, "Chọn cách…", "Chọn công thức…", "Chọn dãy…" vẫn bị hiểu là đáp án C hoặc D. Dòng đó cũng **mất khỏi nội dung câu**. Đáp án sai mà không có cảnh báo, vì "C" là đáp án hợp lệ. Lỗi này có từ trước (bản `main` cũng ra "C"), nhưng từ Pha 3, mọi file Word đều đi qua `fromText()` nên dễ gặp hơn. | `fromText('PHẦN I\nCâu 1. Cho các phát biểu sau:\nChọn câu đúng.\nA. x\nB. y\nC. z\nD. t')` → `dapAn: "C"`, `noiDung` thiếu dòng "Chọn câu đúng." | Chỉ nhận khi cả dòng là đáp án: `/^Ch[ọo]n\s*[:.]?\s*([A-D])\s*[.,;)]?\s*$/` (chữ hoa, không cờ `i`). Hoặc dùng cờ `u` với `(?![\p{L}\d])` như regex `cm` ở dòng 214. Thêm test cho "Chọn câu đúng." / "Chọn cách làm đúng:". |
| R-2 | **Vừa** | `assets/js/importer.js` 140, 158 | Sau "HẾT", "Câu n" được tra theo `(num, part)`, với `part` là phần cuối cùng đã gặp (thường là 3). Nếu phần hướng dẫn giải **không có tiêu đề PHẦN** mà mỗi phần lại đánh số từ 1 (đúng mẫu VLSN), thì lời giải "Câu 1" của Phần I bị gắn vào câu 1 của **Phần III**. Dòng "Đáp án: B" ở đó còn ghi `dapAn = "B"` cho câu trả lời ngắn mà **không cảnh báo**. Câu Phần I thật thì vẫn không có đáp án. Học sinh sẽ thấy lời giải lệch câu. | `fromText('PHẦN 1\nCâu 1. a?\nA. 1\nB. 2\nC. 3\nD. 4\nPHẦN 3\nCâu 1. Tính x?\n---------- HẾT ----------\nHƯỚNG DẪN GIẢI\nCâu 1.\nĐáp án: B\nVì ...')` → câu Phần III có `dapAn: "B"`, `loiGiai: "Đáp án: B\nVì ..."`. | Khi phần lời giải không có PHẦN: ghép theo thứ tự. Câu "Câu n" kế tiếp ứng với câu đầu tiên có `num = n` **sau** câu vừa ghép, nên số lặp lại sẽ chuyển dần qua phần sau. Thêm kiểm tra kiểu đáp án theo loại câu (TN chỉ A–D, TL chỉ số); sai kiểu thì bỏ và cảnh báo "Câu n: đáp án lời giải không khớp loại câu". |
| R-3 | **Vừa** | `assets/js/docx-reader.js` 50 (regex thẻ của `parseXml`) | Bộ đọc XML tự viết chạy **bậc hai** khi gặp thẻ không đóng mà giá trị thuộc tính có `<`. Lý do: `"[^"]*"` và tên thuộc tính `[^\s=>\/]+` đều nhận `<`, nên mỗi dấu `<` nằm trong giá trị lại quét đến cuối chuỗi. Một file .docx **757 byte** làm trang đứng **12,5 giây**. Thời gian tăng theo bình phương: document.xml cỡ 1 MB sẽ treo nhiều phút. Mọi việc chạy trên luồng chính, không có giới hạn thời gian. Word thật không bao giờ sinh ra XML như vậy, nên chỉ gặp khi file bị làm hỏng có chủ đích. Trang quản trị chỉ giáo viên dùng, nên rủi ro thấp. Nhưng đặc tả yêu cầu "không treo trang". | Thư mục nháp `soat/xml.js`: chuỗi `'<a' + ' x="<"'.repeat(N)` cho N = 2 000 / 4 000 / 8 000 / 16 000 mất 56 / 211 / 888 / 3 323 ms. `soat/bomb.js quad`: docx 757 B (30 000 thuộc tính) → `readFile` 12 522 ms. | Loại `<` khỏi giá trị và tên thuộc tính: `"[^"<]*"`, `'[^'<]*'`, tên `[^\s=>\/<]+`. Mỗi lần thử khi đó dừng ở dấu `<` kế tiếp, nên thời gian tuyến tính. Thêm test hiệu năng với chuỗi trên (< 200 ms cho N = 50 000). |
| R-4 | Nhẹ | `assets/js/docx-reader.js` 495–500, 99–113 | (a) **Zip bom**: giới hạn 10 MB chỉ áp cho file nén. `f.async('string')` giải nén `document.xml` mà không kiểm kích thước thật. Thử: file 195 KB bung thành 200 MB, mất 1,8 s và khoảng 600 MB bộ nhớ (Node). File 10 MB có thể bung tới hàng GB: tab trình duyệt hết bộ nhớ hoặc báo lỗi tiếng Anh. (b) **Lồng sâu**: `find`, `findAll`, `textOf` và `block` là hàm đệ quy. Với 200 000 thẻ lồng nhau trước `w:body`, trang hiện "Không đọc được file. Maximum call stack size exceeded" (không treo, nhưng thông báo tiếng Anh). SheetJS đọc .xlsx cũng không có giới hạn bung. | `soat/bomb.js bomb` và `soat/bomb.js deepbody` trong thư mục nháp. | Trước khi `async()`, đọc `zip.file(p)._data.uncompressedSize` (JSZip 3 có trường này). Nếu `document.xml` > 30 MB, hoặc tổng media > 50 MB, báo "File Word bất thường (quá lớn khi giải nén)". Bắt `RangeError` trong `readFile` và đổi thành thông báo tiếng Việt. |
| R-5 | Nhẹ | `assets/js/importer.js` 226–238 | Đáp án Phần III không phải số mà không bóc được số đầu thì **giữ nguyên, không cảnh báo**. Ví dụ "Đáp số: $1,6.10^{-19}$ C" cho ra `dapAn = "$1,6.10^{-19}$ C"`, "Đáp án: 2,5.10^5" cho ra `"2,5.10^5"`. Máy chủ không chấm được (có thể chấm sai mọi bài), trong khi cảnh báo "chưa có đáp án" cũng không hiện. | `fromText('PHẦN III\nCâu 1. tính\nĐáp số: $1,6.10^{-19}$ C')` → `warnings: []`. | Câu TL có đáp án không khớp `^[-+]?\d+([.,]\d+)?(\|…)*$` sau khi chuẩn hóa thì cảnh báo "Câu n: đáp án Phần III không phải số, hãy sửa (vd 1,6e-19)". Nếu muốn, đổi dạng `a.10^{b}` thành số. |
| R-6 | Nhẹ | `assets/js/admin.js` 485–503 (`LIB_URLS`, `loadLib`) | (a) SheetJS 0.18.5 (bản cuối trên cdnjs/npm) có hai lỗi đã công bố khi đọc file độc: prototype pollution (CVE-2023-30533, sửa ở 0.19.3) và ReDoS (CVE-2024-22363, sửa ở 0.20.2). Bản mới chỉ có ở cdn.sheetjs.com, ngoài danh sách CDN cho phép (00 §7). (b) Thẻ `<script>` tải động không có `integrity` (SRI). (c) Người làm chưa xác nhận được URL CDN (môi trường bị chặn). | — | Ghi (a) vào "Rủi ro còn lại": file .xlsx chỉ nên lấy từ nguồn tin cậy. Có thể thêm `integrity` + `crossOrigin='anonymous'` cho từng URL (băm theo đúng file của từng CDN). Kiểm (c) ở Pha 6 trên trang thật. |
| R-7 | Nhẹ | `assets/js/admin.js` 647–652 | Hình tải lên lỗi thì `attachImages` xóa mốc, và chỉ có một toast 6 giây báo số câu. Câu vào trình soạn **không có nhãn** "hình cần chụp lại" (khác với hình WMF, có `hinhLoi`). Toast tắt rồi thì không còn dấu vết. | Cho `adminUploadImage` lỗi (mất mạng) → câu không có hình, không có nhãn. | Đặt `q.hinhLoi = (q.hinhLoi || 0) + 1` cho câu có hình lỗi (đã có danh sách `failed`), để nhãn vàng hiện trong trình soạn. |
| R-8 | Nhẹ | `assets/js/docx-reader.js` 140, 165 (`SYM['$']`, `escText`) | Ký tự `$` trong công thức thành `\$`. KaTeX chấp nhận, nhưng `rich()` tách `$…$` bằng `\$[^$\n]+?\$`, nên công thức bị cắt ở `\$` và hiện lỗi. Ngoài ra, hai dấu trừ liền nhau ("x − −y") cho ra `x --y` (chỉ khác khoảng cách). | `omml2latex` với `m:t` = `\$%` → `\backslash\$\%`. | Đổi `$` trong công thức thành `\char36` hoặc `\text{\textdollar}`. Hiếm gặp trong đề Vật lý, có thể để sau. |
| R-9 | Nhẹ | `docs/QUYET-DINH.md` 16; `docs/bao-cao/pha-3.md` 20–22 | (a) Bản sao QUYET-DINH (chép từ Drive ở commit c14b3e8 của nhánh này) có **id file kho câu hỏi thật**. Repo có thể công khai, mà 00 §6.6 cấm "id file thật". Nếu file kho từng được chia sẻ "ai có liên kết" thì người ngoài mở được toàn bộ kho kèm đáp án. (b) Báo cáo người làm ghi tên file đề thật và tên thư mục thật trên Drive (một phần đã rút gọn bằng "…"). | — | (a) Trong bản sao trong repo, thay id bằng "(xem Google Doc)", và kiểm file kho đang ở chế độ "Hạn chế". (b) Đổi tên file trong bảng thành "File 1–4" + mô tả chung. |
| R-10 | Nhẹ | `assets/js/admin.js` 41–42 | R-13: `logout()` chưa xóa `ld_bank_so` (số câu ma trận vừa nhập). Không nhạy cảm. | — | Thêm vào danh sách xóa cho gọn, hoặc bỏ qua. |
| R-11 | Nhẹ | `assets/js/admin.js` 439–462 (`shrinkImage`) khi gọi từ `finish()` | Hình BMP (hoặc TIFF, nếu sau này nhận) nhỏ hơn 900 KB được gửi nguyên với `mime = image/bmp`. Máy chủ 1.0.0 chỉ nhận png/jpeg/gif/webp/svg nên gán nhãn `image/png` cho dữ liệu BMP. Hình có thể không hiện. Hiếm gặp trong file Word. | — | Trong `finish()`, ép vẽ lại qua canvas (PNG/JPEG) với mime ngoài png/jpeg/gif/webp. |

## Đánh giá các chỗ lệch đặc tả (báo cáo người làm có 8 mục)

| # | Chỗ lệch | Đánh giá |
|---|---|---|
| 1 | Tự viết bộ đọc XML thay cho `DOMParser` | **Chấp nhận.** Node và trình duyệt cho cùng kết quả, và cách này không mở rộng entity. Đổi lại phải tự lo độ bền với file hỏng: xem R-3 (bậc hai) và R-4 (đệ quy). |
| 2 | .csv tự đọc, không qua SheetJS | **Chấp nhận.** Không phải tải thư viện. Nhận BOM, `,`/`;`/tab, ô có xuống dòng. Dùng chung `fromRows` với TSV và .xlsx, đúng ý TC-3.8. |
| 3 | Chưa xác nhận URL CDN | **Chấp nhận, có điều kiện.** URL đúng đặc tả. Nguồn dự phòng jsdelivr cùng phiên bản, đường dẫn có thật trong gói npm. Hỏng cả hai thì báo lỗi và vẫn dán văn bản được (e2e có kiểm). Cần kiểm trên trang thật (R-6c). |
| 4 | Mở rộng `fromText()` theo mẫu VLSN và đề có lời giải | **Chấp nhận, có ghi chú.** Đúng QUYET-DINH §6 (mẫu VLSN). Test cũ vẫn đạt. Nhưng sửa "Chọn …" chưa kín (R-1), ghép lời giải sau HẾT có thể lệch phần (R-2), và đáp số không phải số không được cảnh báo (R-5). |
| 5 | `°` thành `^\circ` (khác kho `\text{°C}`) | **Chấp nhận.** Đúng đặc tả, hiển thị như nhau. |
| 6 | Bổ sung (bảng đáp án, bảng phương án, bảng dàn trang, Text Box, công thức KaTeX lỗi thành mốc, gộp cảnh báo) | **Chấp nhận.** Đều giúp tránh dữ liệu sai âm thầm. Riêng "KaTeX lỗi thành mốc" phụ thuộc KaTeX đã tải. KaTeX được nạp sẵn trong `admin.html`; nếu CDN KaTeX lỗi thì bỏ qua bước kiểm. Chấp nhận được. |
| 7 | Sửa ngoài `importDialog` (`viewEditor` tô vàng, `qPreviewHtml`, `logout`) | **Chấp nhận.** Đặc tả yêu cầu tô vàng trong trình soạn, R-13 do soát Pha 2 đề xuất. Phần sửa nhỏ, không đụng route hay tải dữ liệu của Pha 1. |
| 8 | Chỉ hình đầu tiên trong nội dung vào `hinhAnh`; hình trong phương án/lời giải giữ `![](url)` tại chỗ | **Chấp nhận.** Đúng TC-3.5 và giữ đúng vị trí hình. |

## Ghi chú
- Đã chạy e2e trên cổng 8795 (máy chủ 1.0.0) rồi tắt đúng tiến trình đó. Không đụng file của người kiểm thử.
- Script và file thử nằm trong thư mục nháp của phiên (`soat/`). Không đưa vào repo, không chép nội dung đề thật.

---

## Vòng 2 (soát lại, 19/11/2026)

Phạm vi: `git diff 7cb813a..b5a4757` (1 commit b5a4757) và mục "Vòng 2" trong `docs/bao-cao/pha-3.md`.

Test chạy lại trên `b5a4757`:
- `node tests/importer.test.js`: đạt.
- `node tests/backend.test.js`: 13/13 đạt.
- `node tests/docx.test.js`: 27/27 đạt.
- `node tests/pha3-kiem-thu.test.js` (của người kiểm thử, chỉ chạy, không sửa): 17/17 nhóm đạt.
- `tests/docx.e2e.js` trên cổng 8795: ĐẠT ở **cả hai** chế độ máy chủ (mới và `SERVER_COMPAT=1.0.0`). Gồm R-7, R-10, R-11, và TC-3.11 (lưu 28 câu → học sinh làm và nộp bài). Sau đó đã tắt đúng tiến trình cổng 8795.
- Chạy lại các script tái hiện trong thư mục nháp `soat/`:
  - `xml.js`, `bomb.js` (deep, deepbody, quad, bomb), `ft.js`, `om.js`.
  - `real.js` trên 4 file thật: kết quả không đổi (28/44/22/28 câu, 525/525 công thức, 0 đáp án sai kiểu).
  - `xss.e2e.js`: vẫn 0 lần chạy mã, 0 thuộc tính `onerror`.

### Kết luận Vòng 2: **ĐẠT**
Cả 3 phát hiện Vừa (R-1, R-2, R-3) đã sửa đúng. Các phát hiện Nhẹ đều đã sửa hoặc ghi rủi ro hợp lý. K-1 của người kiểm thử đã sửa. Có 2 phát hiện mới, đều Nhẹ và không chặn gộp.

| Mã | Trạng thái | Bằng chứng |
|---|---|---|
| R-1 | **Đã sửa** | Regex mới có cờ `u`, chỉ nhận chữ hoa, dùng `(?![\p{L}\d])`, và chỉ nhận khi sau chữ cái không còn gì (hoặc là "Lời giải …"). Thử 7 câu dẫn: "Chọn câu đúng." / "Chọn câu sai:" / "Chọn cách làm đúng:" / "Chọn dãy đúng." / "Chọn đáp án đúng." đều giữ nguyên trong nội dung, `dapAn` rỗng, có cảnh báo "chưa tìm thấy đáp án". "Chọn B." → B. "Chọn D, vì x" không được nhận là đáp án (thận trọng, có cảnh báo). Chấp nhận. |
| R-2 | **Đã sửa** | Không có tiêu đề PHẦN thì ghép theo thứ tự. Ca tái hiện cũ: lời giải và "Đáp án: B" nay gắn vào câu Phần I, câu Phần III không nhận gì và có cảnh báo. "Câu 1 … Đáp án: B / Câu 1 … Đáp số: 5" lần lượt vào Phần I (B) và Phần III (5). Đáp án lấy từ lời giải mà không hợp loại câu thì bị bỏ và cảnh báo. Khi có tiêu đề PHẦN thì khớp theo (phần, số). |
| R-3 | **Đã sửa** | Với `xml.js`, N = 2 000 / 4 000 / 8 000 / 16 000 mất 2 / 3 / 4 / 6 ms (vòng 1: 56 / 211 / 888 / 3 323 ms). `bomb.js quad` (docx 757 B): 26 ms (vòng 1: 12 522 ms). Không còn thành phần nào của regex nhận `<`. Chú thích và CDATA tìm điểm kết thúc bằng `indexOf`. Thời gian tuyến tính. |
| R-4 | **Đã sửa (còn kẽ hở nhỏ, xem N-2)** | `bomb.js bomb` (195 KB → 200 MB): bị chặn sau 4 ms với thông báo tiếng Việt "File Word bất thường: khi giải nén quá lớn (191 MB)…". `bomb.js deepbody`: "File bất thường (cấu trúc lồng quá sâu hoặc quá lớn)…". |
| R-5 | **Đã sửa** | `"$1,6.10^{-19}$ C"` và `"2,5.10^5"` nay có cảnh báo "đáp án Phần III … không phải số — máy không chấm được, hãy sửa". |
| R-6 | **Chấp nhận** | Giữ 0.18.5 theo đặc tả (bản mới chỉ có trên CDN ngoài danh sách cho phép). Không thêm SRI vì chưa so được băm thật trên CDN. Rủi ro đã ghi trong báo cáo người làm. Kiểm URL CDN trên trang thật ở Pha 6. |
| R-7 | **Đã sửa** | `admin.js` 659: câu có hình tải lỗi được gắn `hinhLoi`. e2e "R-7" đạt ở cả hai chế độ. |
| R-8 | **Đã sửa** | `$` thành `\char36` (trong `\text{}` thành `\textdollar`), KaTeX `throwOnError` vẽ được. "x − −y" thành `x - -y`. |
| R-9 | **Đã sửa** | `docs/QUYET-DINH.md` không còn id file kho (bỏ ở commit 7cb813a). Bảng file thật trong `pha-3.md` đổi thành "File 1–4" + mô tả chung. |
| R-10 | **Đã sửa** | `logout()` xóa thêm `ld_bank_so`. e2e "R-13/R-10" đạt. |
| R-11 | **Đã sửa** | Mime ngoài png/jpeg/gif/webp thì `shrinkImage(blob, true)` vẽ lại qua canvas. e2e: hình BMP được gửi dạng `image/jpeg`. |
| K-1 | **Đã sửa** | .txt đọc như tab "Dán văn bản" (`fromText`). `fromRows`/`fromTsv`/`fromCsv` cảnh báo hàng không có nội dung. Kéo thả lọc đuôi giống ô chọn file. Nhóm K-1 trong `pha3-kiem-thu.test.js` nay đạt. Dữ liệu cũ hợp lệ không sinh cảnh báo mới (đã thử TSV/hàng đúng mẫu → `warnings: []`). |
| N-1 | **Đã sửa** | Bảng kết quả chỉ đếm công thức nằm trong câu ("Công thức trong câu hỏi"). |

### Phát hiện mới (Nhẹ, không chặn)
| Mã | Mức | File:dòng | Mô tả | Tái hiện | Đề xuất |
|---|---|---|---|---|---|
| N-2 | Nhẹ | `assets/js/docx-reader.js` 509–513 (kiểm `_data.uncompressedSize`), 514 (`get`) | Phần chặn bom nén dựa vào kích thước **do chính file khai báo** trong mục lục zip. File độc khai báo sai (vd 1 000 byte) thì qua được bước kiểm. JSZip vẫn giải nén hết vào bộ nhớ rồi mới báo lỗi tiếng Anh "Bug : uncompressed data size mismatch". Lỗi này ném ra trong `get()`, ngoài khối `try` của `loadAsync`, nên thông báo không được Việt hóa. File 10 MB khai báo sai vẫn có thể làm tab hết bộ nhớ. Chỉ gặp khi có người cố ý làm file độc; trang chỉ giáo viên dùng. | `soat/lie.js 200`: docx 195 KB khai báo 1 000 B → giải nén 200 MB rồi báo "Bug : uncompressed data size mismatch" (695 ms, khoảng 207 MB bộ nhớ). | (a) Bọc `get()` trong `try` và đổi lỗi thành "File Word bị hỏng…". (b) Nếu muốn chặn hẳn: đọc bằng `f.internalStream('uint8array')`, đếm byte, quá `MAX_XML` thì `pause()` rồi báo lỗi. |
| N-3 | Nhẹ | `assets/js/importer.js` 142–157 (nhánh `ended`) | Sau "HẾT", nếu lời giải viết cùng dòng với số câu ("Câu 1. Lời giải: Chọn B.") thì phần `rest` được ghi nguyên vào lời giải, không bỏ nhãn "Lời giải:". Vì vậy không lấy được đáp án "Chọn B". Câu vẫn có cảnh báo "chưa tìm thấy đáp án", không sai âm thầm. Lỗi này có từ vòng 1. | `fromText('PHẦN 1\nCâu 1. a?\nA. 1\nB. 2\nC. 3\nD. 4\n---------- HẾT ----------\nCâu 1. Lời giải: Chọn B.')` → `dapAn: ""`, `loiGiai: "Lời giải: Chọn B."`. | Cho `rest` đi qua cùng xử lý `lm2`/`am2` như các dòng sau (bỏ nhãn, nhận "Đáp án:"). |
