# Pha 6b — Làm cùng giáo viên trên trang thật

## A0. Số gốc trên máy chủ 1.0.0 (21/11/2026, máy tính của giáo viên, Chrome, cửa sổ ẩn danh)
Lượt đo: đăng nhập học sinh → Lịch sử → Thống kê → Xếp hạng → Trang chủ; F5 giữa các lượt. Lọc "exec" trong thẻ Network.

| Lượt | Số lời gọi `exec` | Thời gian từng lời gọi (s, đến lúc chuyển hướng 302) | Trung bình |
|---|---|---|---|
| 1 | 8 | 1,84 · 3,68 · 2,35 · 3,66 · 2,92 · 4,06 · 3,47 · 2,15 | ≈ 3,0 s |
| 2 | 8 | 3,55 · 3,76 · 3,81 · 3,41 · 3,49 · 4,50 · 5,20 · 4,60 | ≈ 4,0 s |
| 3 | 8 | 3,65 · 7,02 · 4,87 · 4,38 · 4,68 · 3,90 · 3,78 · 3,17 | ≈ 4,4 s |

- Cả lượt kéo dài khoảng 20–35 s (dải thời gian của Network).
- Ghi chú: giao diện hiện tại (Pha 1–6a) đang chạy với máy chủ 1.0.0 qua đường dự phòng; con số là điểm gốc để so ở TC-6.7 sau khi dán Code.gs 1.5.0.

## A1–A6. Triển khai Code.gs 1.5.0 (21/11/2026)
- A1: đã sao lưu Sheet; phiên bản triển khai trước khi dán: **2** (quay về số này nếu có sự cố).
- A2–A3: dán Code.gs 1.5.0 vào Sheet gốc, chạy `setup`, cấp quyền: xong; có thêm `LuyenTap`, `KetQuaLuyenTap`, dữ liệu cũ còn nguyên.
- A4: đã điền link kho và thư mục hình; `CHO_LUYEN_TAP` = KHONG.
- A5: triển khai Phiên bản mới.
- A6 `kiemTraSauTrienKhai`: **TẤT CẢ ĐỀU ỔN** — phiên bản 1.5.0, features đủ 6; HocSinh 8 cột/1 hàng, DeThi 13/1, CauHoi 21/6, KetQua 19/1, CaiDat 3 cột/13 dòng, LuyenTap 18/0, KetQuaLuyenTap 20/0; mở được kho (10 239 hàng, đủ cột) và thư mục "02. HÌNH VẼ"; luyện tập đang tắt; CacheService ghi/đọc được.

## B1 / TC-6.7. Đo lại sau khi triển khai 1.5.0 (cùng máy, cùng cách đo như A0)
| Lượt | Số lời gọi `exec` | Thời gian từng lời gọi (s) | Trung bình |
|---|---|---|---|
| 1 | 5 | 2,57 · 1,75 · 1,15 · 1,48 · 3,21 | ≈ 2,0 s |
| 2 | 5 | 4,43 · 1,23 · 1,40 · 0,89 · 3,18 | ≈ 2,2 s |
| 3 | 5 | 2,99 · 1,35 · 1,41 · 1,03 · 1,45 | ≈ 1,6 s |

- So với A0: số lời gọi mỗi lượt **8 → 5**; thời gian trung bình mỗi lời gọi **3,0–4,4 s → 1,6–2,2 s**; cả lượt 20–35 s → 18–23 s.
- Giáo viên thấy viên "Đang cập nhật" khi chuyển tab (đúng thiết kế Pha 1: hiện dữ liệu đã lưu rồi cập nhật ngầm; lần đầu trong cửa sổ ẩn danh chưa có dữ liệu lưu nên phải chờ). Rời trang > 60 s rồi quay lại thì lời gọi chậm hơn: hết đệm máy chủ 60 s và Apps Script "ngủ" (đã chốt không làm hẹn giờ giữ ấm).
- Nút Đổi PIN đã hiện cho học sinh.

## Sửa lỗi bảng kẻ gạch (Người làm)
- **Lỗi:** một số câu trong kho ghi bảng kiểu "bảng đơn giản" của pandoc, nhưng gạch đã thành "–" (lẫn "-") và khoảng trắng canh cột bị gộp thành 1 dấu cách. `rich()` không nhận ra nên web in nguyên các dòng gạch và số liệu thành chữ.
- **Cách sửa** (`assets/js/common.js`, chỉ giao diện, không đổi `Code.gs`): `rich()` nhận thêm "bảng kẻ gạch" và vẽ thành `<table class="q-table">` giống khối `[BẢNG]` (cùng CSS; công thức trong ô vẫn do KaTeX vẽ; ô được escape như phần còn lại).
  - Dòng gạch = chỉ gồm `-`, `–`, `—` và khoảng trắng, có ít nhất một đoạn ≥ 3 gạch; 1 đoạn = dòng viền, ≥ 2 đoạn = dòng chia cột (số đoạn = số cột).
  - Có tiêu đề: [viền] → tiêu đề → chia cột → dữ liệu → viền. Thiếu viền trên thì phải có viền dưới; có viền trên thì bảng cũng có thể dừng ở dòng trống / hết nội dung. Không tiêu đề: chia cột → dữ liệu → dòng gạch đóng (bắt buộc).
  - Tách ô: dòng còn ≥ 2 khoảng trắng liền → theo vị trí các đoạn gạch; chỉ còn 1 dấu cách → theo dấu cách (không bao giờ cắt trong `$…$`); thừa mảnh thì nhóm theo công thức ("Lần đo $U$ (V) $I$ (mA)" → "Lần đo" | "$U$ (V)" | "$I$ (mA)"), hoặc dồn phần đầu vào ô 1 nếu n − 1 mảnh cuối là số; không được thì cả dòng vào ô đầu (không mất chữ).
  - Giữ nguyên là chữ: dòng gạch đơn lẻ, "---------- HẾT ----------", chữ có dấu gạch, bảng không có hàng dữ liệu, chia cột không có dòng đóng. Khối `[BẢNG]` không đổi.
- **Test:** `tests/bang-gach.test.js` (13 ca: ví dụ của giáo viên → 3 cột, 1 tiêu đề + 3 hàng; có/không viền trên; không tiêu đề; tách theo vị trí cột; ô `$…$` có dấu cách; không tách được; dòng gạch đơn lẻ/HẾT; `[BẢNG]` cũ giống hệt; `<script>` bị escape; 2 bảng + `\r\n`) — đạt. `tests/bang-gach.e2e.js` (học sinh làm đề có câu bảng kẻ gạch, KaTeX vẽ 2 công thức ở tiêu đề) — đạt. Chạy lại: backend, importer, docx (29/29), pha2-kiem-thu (31/31), pha2-kiem-thu.e2e all (16/16 nhóm), pha5 (11), common-cache, e2e.js máy chủ mới và 1.0.0, scan-secrets — đều đạt.
- **Ảnh:** `docs/bao-cao/anh/pha-6b/01-bang-gach.png` (nội dung câu tự soạn).

## TC-6.8 (21/11/2026)
- Giáo viên tạo "Đề thử phát hành" từ kho (ma trận Lớp 12), đưa câu vào luyện tập, bật Luyện tập. Học sinh mẫu làm đề và làm một bài luyện: **KetQua và KetQuaLuyenTap đều có hàng mới. ĐẠT.**
- Vòng xem thứ hai các tab hiện ngay (đệm trên máy chạy đúng).
- Giáo viên thấy 3 lỗi hiển thị: (1) bảng kẻ gạch của kho chưa thành bảng → đã sửa (mục dưới); (2) một hình quét bị nghiêng → lỗi của file hình trong kho; (3) câu `L12C3B16-P1-07955` mất ký hiệu Φ → lỗi dữ liệu kho (mất khi nhập), đã ghi cho bên Cowork ở mục 9 file quyết định chung.

## Gộp bản sửa bảng kẻ gạch (điều phối)
- Soát code: ĐẠT (4 Nhẹ). Kiểm thử: ĐẠT (97/97 ca Node, e2e hai chế độ). R-1 (soát: `replace(/\s+$/)` chậm bậc hai) điều phối đã đổi thành `trimEnd()`, chạy lại test đạt.
- Còn nhẹ, chấp nhận: bảng thiếu viền dưới mà câu viết liền thì câu bị cuốn vào bảng; tiêu đề không có công thức và nhiều chữ hơn số cột dồn vào ô đầu; dạng không viền trên + dòng đóng nhiều đoạn thì tiêu đề in thành chữ. Không mất chữ trong mọi trường hợp. Không đổi Code.gs.

## Sửa lỗi hình đặt nổi trong file Word (Người làm)
**Lỗi.** Giáo viên tải một đề Word thật: trang chỉ nhận 15 câu Phần I (đúng là 18), 4 câu Phần II, 6 câu Phần III; Phần II câu 3 có ô a)–d) trống. Nguyên nhân: hình đặt nổi/neo (`wp:anchor`) nằm trong chính đoạn "Câu 6: …" (và câu 13, 16; Phần II câu 3 ở đoạn ý "a. …"). Bộ đọc Word đặt mốc `{{HINH:n}}` ở vị trí của hình trong đoạn — tức là ĐẦU dòng ("{{HINH:1}}Câu 6: …") — nên `Importer.fromText` không nhận ra nhãn "Câu n" / ý "a." → câu bị gộp vào câu trước, các ý dồn vào phần dẫn.

**Cách sửa** (chỉ `assets/js/importer.js`, không đổi `docx-reader.js`, không đổi `Code.gs`):
- `fromText`: mốc hình đứng đầu dòng (một hoặc nhiều, có/không dấu cách) được tách ra trước khi nhận nhãn, rồi gắn vào chỗ hợp lý:
  dòng "Câu n" → nội dung câu n (sau phần chữ của dòng); dòng phương án "A. …" / ý "a. …", "Đáp án:", "Lời giải:" → nội dung câu đang đọc
  (hình của câu: hình đầu tiên vào ô `hinhAnh`, ý/phương án giữ nguyên); dòng "PHẦN …" → giữ lại cho câu kế tiếp;
  trước câu đầu tiên (khung đầu đề, logo) → bỏ như cũ. Dòng không có nhãn, dòng chỉ có mốc, phần lời giải → giữ mốc tại chỗ như trước.
- `splitOptions`: nhãn phương án đứng ngay sau mốc hình không có dấu cách ("A. 1{{HINH:6}}B. 2") vẫn được nhận (hình thuộc phương án đứng trước).
- Lý do chọn sửa ở importer: áp dụng cho mọi nguồn (file Word và văn bản dán có mốc), không dời vị trí hình trong đoạn nên các file Word đã thử ở Pha 3 cho kết quả giống hệt từng ký tự; sửa ở docx-reader (dời mốc ra cuối đoạn) sẽ đưa hình ở đoạn ý "a." vào ô ý a thay vì hình của câu.

**Test.** Thêm ca "Pha 6b: hình neo/nổi và inline ở ĐẦU đoạn…" vào `tests/docx.test.js` (fixture tự sinh): hình neo đầu "Câu 2:", hình inline đầu "Câu 3.", hình neo đầu phương án "A.", hai hình (inline + neo) đầu "Câu 4.", hình chen giữa "A. 1" và "B. 2", hình neo đầu "PHẦN II", hình neo đầu ý "a.", hình inline đầu "Câu 2:" Phần II; kèm văn bản dán có mốc trước "Đáp án:", "Lời giải:". Ca mới hỏng với importer cũ, đạt với bản sửa.
- `docx.test.js` 30/30; `importer.test.js` đạt; `pha3-kiem-thu.test.js` 17/17; `docx.e2e.js` máy chủ mới ĐẠT, máy chủ 1.0.0 ĐẠT (cổng 8781/8782); `pha3-kiem-thu.e2e.js` mới 23/23, 1.0.0 22/22 (PORT_NEW=8783, PORT_OLD=8784); `scan-secrets.js` sạch.

**Kết quả trên file thật** (file không đưa vào repo):
- Đề giáo viên gặp lỗi: 25 câu (15–4–6) → **28 câu (18–4–6)**; câu 6, 13, 16 Phần I có hình; Phần II câu 3 có đủ 4 ý và có hình; mọi câu trắc nghiệm đủ 4 phương án, mọi câu Đúng/Sai đủ 4 ý.
- 4 file Word Pha 3: vẫn 28/44/22/28 câu, 525/525 công thức; danh sách câu hỏi giống hệt trước khi sửa (so băm toàn bộ kết quả).

### Vòng 2 (sửa theo soát `pha-6b-hinh-soat.md`)
- R-1 (Vừa): hình ở đầu dòng "Lời giải:", "Chọn B", "Đáp án: …" nay vào `loiGiai` (đặt sau chữ của dòng), không vào nội dung câu, nên học sinh không thấy hình lời giải lúc làm bài. Khi tìm "Chọn B" hay "a) Đúng" trong lời giải thì bỏ qua dòng chỉ có mốc. Sau HẾT, dòng `{{HINH}}Lời giải: …` / `{{HINH}}Đáp án: B` nay nhận được nhãn, hình nối vào sau.
- R-2 (Nhẹ): hình ở dòng "PHẦN …" mà không có "Câu n" theo sau (gặp HẾT, bảng đáp án, HƯỚNG DẪN GIẢI hoặc hết văn bản) nay gắn vào câu vừa đóng: trước HẾT thì vào nội dung, sau HẾT thì vào lời giải của câu vừa ghép. Nếu không có câu nào thì có cảnh báo. Hình ở dòng "PHẦN …" trước câu đầu tiên (logo) hoặc trong bảng đáp án thì bỏ như cũ.
- R-3 (Nhẹ): `splitOptions` chỉ nhận nhãn đứng sát sau đúng mốc `{{HINH:n}}`, không nhận sau `}}` của công thức.
- Test: đã sửa kỳ vọng trong `tests/docx.test.js` (hình lời giải vào `loiGiai`) và thêm ca cho "Chọn B" / "Lời giải: Chọn D." có hình, hình ở dòng PHẦN trước HẾT hoặc ở cuối văn bản, hình ở PHẦN I trước câu 1, và `A. $\frac{1}{2}}B. x$`.
- Kết quả test: `docx.test.js` 30/30; `importer.test.js` đạt; `pha3-kiem-thu.test.js` 17/17; `pha6b-hinh-kiem-thu.test.js` (có DE_THAY, WORD_THAT) 35/35; `scan-secrets.js` sạch.
- File thật không đổi so với vòng 1: đề giáo viên ra 28 câu (18–4–6), 4 hình ở câu 6/13/16 Phần I và câu 3 Phần II. 4 file Pha 3 cho kết quả y hệt (băm trùng).

## Gộp bản sửa hình đặt nổi (điều phối, 21/11/2026)
- Soát: vòng 1 ĐẠT kèm R-1 Vừa (hình đầu dòng lời giải lọt vào nội dung câu); vòng 2 ĐẠT. Kiểm thử: ĐẠT (35/35 Node, e2e 16/16 hai chế độ).
- Đề Word thật của giáo viên: trước 25 câu (15–4–6), sau 28 câu (18–4–6), 4/4 hình vào đúng câu. 4 đề thật của Pha 3: kết quả y hệt. Không đổi Code.gs.

## Kết luận Pha 6b (giáo viên chốt 21/11/2026)
| TC | Kết quả |
|---|---|
| TC-6.7 Đo tốc độ trước/sau | **ĐẠT** — 8 → 5 lời gọi mỗi lượt; mỗi lời gọi 3,0–4,4 s → 1,6–2,2 s; vòng xem thứ hai hiện ngay |
| TC-6.8 Học sinh làm đề + luyện tập | **ĐẠT** — KetQua và KetQuaLuyenTap có hàng mới |
| `kiemTraSauTrienKhai` | Tất cả ổn (1.5.0, đủ 7 trang tính, mở được kho và thư mục hình) |
| Lỗi phát hiện trên trang thật | Đã sửa và lên trang: bảng kẻ gạch của kho; đề Word có hình đặt nổi. Lỗi dữ liệu kho (mất Φ, hình quét nghiêng) chuyển cho Cowork |

- Máy chủ thật: **Code.gs 1.5.0** (phiên bản triển khai trước: 2).
- Giáo viên chốt pha khi chưa báo kết quả thử lại đề Word sau bản sửa hình đặt nổi (bản sửa đã kiểm trên đúng file đó: 28 câu, 4/4 hình).
- Việc còn lại của giáo viên: nhóm C (logo chuẩn, 4 câu hỏi giao diện Pha 5, sửa câu kho lỗi, đưa câu vào luyện tập) và nhóm D (sau ≥ 1 tháng: xác nhận dọn mã dự phòng máy chủ cũ) trong `docs/VIEC-GIAO-VIEN.md`; xem trên điện thoại thật (Pha 5 R-3, R-7).
