# Pha 7 — Sổ tay cá nhân

## Tóm tắt cho giáo viên
- Học sinh có thêm mục **"Sổ tay"**. Màn hình chia hai nửa. Nửa trái là **danh sách câu đã sai** để tra cứu, mỗi câu thu gọn thành một dòng và bấm vào thì mở chi tiết. Nửa phải là **cuốn sổ tay**, chỉ hiện tên lỗi, màu mức độ, tỉ lệ từng loại lỗi và ghi chú của em. Giải pháp và bản đồ lỗi chỉ hiện khi em bấm vào.
- Lỗi chia hai nhóm. Nhóm **"Sai ngoo"** hiện trước: nhớ nhầm công thức, đọc sai đề, tính toán hoặc quên đổi đơn vị, sót ý hoặc sót câu. Nhóm **"Hổng kiến thức"** (theo chương/bài, gồm cả câu đoán mò) để xuống cuối, vì kết quả theo chủ đề đã hiện ở trang kết quả mỗi đề.
- Máy tự đoán loại lỗi khi chắc chắn (bỏ trống, lệch đúng 10ⁿ lần). Không chắc thì hỏi em. Em sửa lại được loại lỗi của từng câu.
- Mỗi loại "sai ngoo" có một công cụ sửa riêng: thẻ công thức có tên gợi nhớ, bài tập gạch từ khóa, thang đổi đơn vị, kế hoạch chia thời gian.
- Có **đề khắc phục** ngắn dựng từ chính câu em đã sai cộng với câu tương tự. Một lỗi tính là đã khắc phục khi em làm đúng 2 lần ở 2 ngày khác nhau.
- Chia 3 pha con: **7a** sổ tay tự động, **7b** em tự phân loại lỗi, công cụ sửa và lời nhắc, **7c** đề khắc phục. Mỗi pha con thầy dán lại Code.gs một lần.

## Mục tiêu
Mỗi học sinh có một nơi xem lại mọi câu đã làm sai, biết mình hay mắc **loại lỗi nào** (nhất là các lỗi "sai ngoo" sửa được ngay bằng thói quen), được nhắc trước khi làm đề, và có đề ngắn để sửa đúng lỗi của mình.

## Quyết định đã chốt (26/11/2026, xem `QUYET-DINH.md` §5)
1. Câu thuộc đề **chưa công bố lời giải**: vẫn hiện nội dung câu và đáp án em đã chọn, **chỉ ẩn đáp án đúng và lời giải** (theo `canReveal_` cộng luật "đề đã đóng" của Pha 4).
2. Sau khi nộp bài: hiện **một lần** toàn bộ câu sai để em chọn lý do từng câu. Được bỏ qua.
3. Đã khắc phục = làm đúng **2 lần ở 2 ngày khác nhau** (theo `TZ`).
4. Trước khi làm đề thi, em **bắt buộc** đánh dấu "Em đã đọc" phần điều cần nhớ.
5. Phạm vi: 7a, 7b, 7c.

## Phạm vi
**Làm:** trang `#/so-tay`; trang tính `SoTay` và `CongThuc`; phân loại lỗi (máy đoán + học sinh chọn); 4 công cụ sửa lỗi; lời nhắc ở trang chủ, trước khi làm đề, ở trang kết quả; đề khắc phục (kiểu luyện tập mới `KHAC_PHUC`); đèn trạng thái 3 màu.
**Không làm:** gọi AI để sinh lời khuyên (dùng quy tắc và dữ liệu thầy nhập); góc giáo viên "lỗi phổ biến của lớp" (để pha sau); Phần IV.
**Hoãn sau:** học sinh đánh dấu câu **làm đúng nhưng đoán mò** (xem câu hỏi mở Q4); xuất sổ tay ra PDF.

## Thiết kế kỹ thuật

### 1. Khóa câu và nguồn dữ liệu
- Khóa một câu sai `key` = `maKho` nếu có, nếu không thì `examId#stt` (giống `wrongList_`, Pha 4). Câu nhập tay đã bị sửa (mã băm `h` khác) thì vẫn hiện trong nhật ký với nội dung **lúc xem** kèm nhãn "Câu đã được thầy sửa", nhưng không vào đề khắc phục.
- **Trạng thái và số lần sai tính lại mỗi lần** từ `KetQua` + `KetQuaLuyenTap` (sự kiện đúng/sai theo thời gian), không lưu bản sao. `SoTay` chỉ lưu thứ học sinh nhập.
- Một câu được tính là "sai" khi `sc < m`. Phần II đúng 3/4 ý vẫn là sai.

### 2. Dữ liệu mới (chỉ thêm trang tính; `setup()` tạo, lần ghi đầu cũng tự tạo — `OPTIONAL_SHEETS`)
- **`SoTay`**: `studentId` (Mã HS) · `key` (Khóa câu) · `loai` (Loại lỗi) · `nguon` (MAY / HS) · `chiTiet` (Chi tiết lỗi, JSON: đại lượng, đơn vị em dùng, đơn vị đúng…) · `ghiChu` (Ghi chú, ≤ 500 ký tự) · `capNhat`. Ghi chú chung của sổ tay dùng `key = _CHUNG`. Mỗi cặp (HS, key) tối đa 1 hàng; ghi theo luật `updateRow_` trong khóa (`00-quy-trinh` §6.5).
- **`CongThuc`** (thầy hoặc Cowork nhập, máy chủ chỉ đọc): `bai` (Mã bài, ví dụ `L12C1B2`, khớp cột Bài của câu) · `ten` (Tên công thức) · `congThuc` (LaTeX) · `tenGoiNho` (Tên gợi nhớ) · `phamVi` (Phạm vi áp dụng) · `dauHieu` (Dấu hiệu sử dụng) · `bat` (CO/KHONG).
- `CaiDat` thêm: `BAT_SO_TAY` (CO/KHONG, mặc định CO) và `TU_KHOA_DOC_SAI` (danh sách từ khóa cách nhau dấu `;`, có giá trị mặc định, xem §5.2).
- `chiTiet` của bài nộp thêm `t` = số giây từ lúc bắt đầu tới lần sửa đáp án cuối của câu (máy khách gửi kèm khi nộp; máy chủ kiểm tra 0 ≤ t ≤ thời gian làm, sai thì bỏ). Bài cũ không có `t` vẫn đọc được. Bài khắc phục thêm `goc` = key câu sai gốc mà câu này nhằm sửa.

### 3. Loại lỗi
| Mã | Tên hiển thị | Nhóm | Máy tự đoán |
|---|---|---|---|
| `CONG_THUC` | Nhớ nhầm công thức | Sai ngoo | không — hỏi |
| `DOC_DE` | Đọc sai đề / bỏ sót dữ kiện | Sai ngoo | không — hỏi |
| `TINH_TOAN` | Tính toán / quên đổi đơn vị (2 ý con: `DON_VI`, `BAM_MAY`) | Sai ngoo | **chắc**: Phần III, đáp án em ÷ đáp án đúng = 10ⁿ (n ≠ 0, sai lệch tương đối ≤ 1 %) → `DON_VI`. **Đoán, cần hỏi**: lệch ≤ 10 % hoặc ngược dấu → `BAM_MAY` |
| `SOT` | Sót ý / sót câu / quên không làm | Sai ngoo | **chắc**: không có câu trả lời (Phần II: còn ý để trống). **Đoán, cần hỏi**: Phần II sai đúng 1 ý |
| `HONG_KT` | Chưa biết làm (hổng kiến thức) | Hổng kiến thức | không — hỏi |
| `DOAN_MO` | Đoán mò | Hổng kiến thức | không — hỏi; coi như chưa biết làm |
| `CHUA_RO` | Chưa phân loại | — | mặc định khi chưa có gì |

- Học sinh chọn thì ghi `nguon = HS` và **luôn thắng** máy đoán. Học sinh đổi được bất cứ lúc nào.
- Câu `CHUA_RO` được xếp tạm vào nhóm Hổng kiến thức khi vẽ bản đồ chương, và có lời nhắc nhẹ "Còn n câu chưa phân loại".

### 4. Màu mức độ
- **Mỗi câu:** 🔴 chưa làm đúng lại · 🟡 đã đúng 1 lần (hoặc đúng 2 lần trong cùng 1 ngày) · 🟢 đã khắc phục (đúng 2 lần ở 2 ngày khác nhau). Lần làm đúng tính khi làm lại chính câu đó **hoặc** làm đúng một câu khắc phục có `goc` trỏ về câu đó. Sai lại thì về 🔴, đếm lại từ đầu.
- **Mỗi loại lỗi (sổ tay):** 🔴 **lặp lại** khi có ≥ 3 câu 🔴 thuộc ≥ 2 đề khác nhau · 🟡 còn câu 🔴/🟡 nhưng chưa tới ngưỡng lặp lại · 🟢 mọi câu đều 🟢. Ngưỡng `3` và `2` đặt trong hằng số để chỉnh sau.

### 5. Công cụ sửa từng loại lỗi (7b)
1. **Nhớ nhầm công thức:** thẻ công thức của bài chứa câu đó (từ `CongThuc`): **tên gợi nhớ** chữ to, công thức (KaTeX), phạm vi áp dụng, dấu hiệu sử dụng. Bài chưa có công thức thì hiện lời giải (nếu đã công bố) và gợi ý em tự ghi công thức vào ghi chú.
2. **Đọc sai đề:** "Tập gạch từ khóa". Hiện nội dung câu; em chạm vào các từ để tô màu, rồi bấm "So sánh". Máy tô các từ khóa có trong `TU_KHOA_DOC_SAI` và các dữ kiện số kèm đơn vị, chỉ ra từ em bỏ sót. Bên dưới là danh sách **từ khóa dễ đọc sai** kèm một dòng giải thích. Mặc định gồm: *không, sai, đúng, chỉ, luôn, ít nhất, nhiều nhất, tối đa, tối thiểu, bỏ qua, ban đầu, từ trạng thái nghỉ, ngay sau, ngay trước, độ lớn, gần nhất, làm tròn, đơn vị, lấy g =*.
3. **Tính toán / quên đổi đơn vị:**
   - Ý `DON_VI`: em chọn **đại lượng** (chiều dài, diện tích, thể tích, khối lượng, thời gian, vận tốc, áp suất, năng lượng, công suất, điện tích, điện dung, cường độ dòng điện, hiệu điện thế, tần số, cảm ứng từ, độ phóng xạ, góc, nhiệt độ), rồi **chọn lại đơn vị đúng**. Máy hiện **thang đo** gồm mọi đơn vị của đại lượng đó, đơn vị chuẩn SI tô đậm, mũi tên đổi giữa đơn vị em dùng và đơn vị đúng (×10ⁿ). Nếu máy đã tính được lệch 10ⁿ thì hiện luôn "Đáp án của em lệch 10ⁿ lần". Nhiệt độ hiện công thức cộng trừ (T = t + 273), không phải thang nhân. Thư viện đơn vị nằm trong `assets/js/` (dữ liệu tĩnh), không cần máy chủ.
   - Ý `BAM_MAY`: lời khuyên ước lượng bậc độ lớn trước khi bấm máy, bấm lại lần 2, kiểm tra dấu.
4. **Sót ý / sót câu:** bảng **thời gian đề xuất cho từng phần**, tính theo tỉ lệ đề 50 phút (Phần I 15 phút · Phần II 15 phút · Phần III 12 phút · kiểm tra lại 8 phút), co giãn theo thời gian của đề. Nếu bài có `t`, hiện thêm thời gian thực tế em làm xong từng phần. Kèm lời nhắc: dành một lượt kiểm tra lại cuối giờ, nhìn danh sách câu chưa làm trước khi nộp.
5. **Hổng kiến thức / đoán mò:** xem lời giải (nếu đã công bố), nút "Luyện bài này" (đề nhanh Pha 4 theo bài). Các câu này được ưu tiên vào đề khắc phục.

### 6. API (Code.gs tăng số phụ ở mỗi pha con; `features` thêm `"notebook"`)
| Action | Ai | Tham số | Kết quả |
|---|---|---|---|
| `notebook` | HS | — | `{ items:[{key, nguon:{examId,tieuDe,nopLuc,stt} hoặc {luyenTap}, phan, loai, chuong, bai, mucDo, lanSai, soDe, mau, loi:{ma, y, nguon, canHoi}, coGhiChu}], tongHop:{ saiNgoo:[{ma,ten,so,tiLe,mau}], hongKT:[{chuong,bai,so,mau}], chuaRo }, ghiChuChung, nhacNho:[…] }`. **Không có nội dung câu, đáp án, lời giải.** |
| `notebookItem` | HS | `{keys[] ≤ 20}` | nội dung câu, hình, phương án, đáp án em chọn; `dapAn`, `loiGiai` **chỉ khi** được công bố; `congThuc[]` của bài; `ghiChu`; `chiTiet` lỗi |
| `notebookTag` | HS | `{items:[{key, ma, y?, chiTiet?}] ≤ 40}` | `{n}`. Từ chối key không phải câu sai của chính học sinh |
| `notebookNote` | HS | `{key \| "_CHUNG", text}` | `{ok}`; cắt 500 ký tự |
| `practiceStart` (sửa, 7c) | HS | `kieu: "KHAC_PHUC"`, `mau: "ON_NHANH" \| "MUOI_CAU" \| "MOT_LOI"`, `ma?` | như Pha 4; token `p` mang thêm `goc` cho từng câu |
- `BAT_SO_TAY = KHONG`: các action trên báo lỗi "Giáo viên đang tắt sổ tay" (chặn ở máy chủ); giao diện ẩn mục Sổ tay, khung "Em sai vì sao?" và lời nhắc.
- Tính sổ tay đọc `KetQua` và `KetQuaLuyenTap` của **một** học sinh (`rowsWhere_`), có đệm 60 giây theo học sinh, xóa đệm khi học sinh nộp bài hoặc gắn nhãn.

### 7. Giao diện học sinh
**Trang `#/so-tay` (máy tính: hai cột 55/45; điện thoại: 2 tab "📒 Sổ tay" mở trước, "📋 Câu sai").**

*Nửa phải — Sổ tay* (nền giấy kẻ, viền xanh #1D6B3E, có chế độ tối):
1. **Thanh tỉ lệ loại lỗi**: một thanh ngang chia đoạn theo tỉ lệ từng loại.
2. **Sai ngoo** (luôn mở): mỗi loại một dòng gồm chấm màu, tên lỗi, số câu, tỉ lệ. Dòng 🔴 có nhãn "Lặp lại". Bấm tên lỗi thì nửa trái lọc theo lỗi đó; bấm "Cách sửa ▸" thì mở công cụ §5 ngay trong sổ.
3. **Hổng kiến thức** (thu gọn mặc định): mở ra là danh sách chương → bài có màu và số câu (bản đồ lỗi).
4. **Ghi chú của em**: ô viết luôn hiện, tự lưu sau 2 giây ngừng gõ.

*Nửa trái — Câu đã sai:*
- Bộ lọc: loại lỗi · đề · chương · màu; ô tìm kiếm. Thứ tự: nhóm Sai ngoo trước (🔴 trước), Hổng kiến thức sau, cùng nhóm thì mới nhất trước.
- Mỗi câu thu gọn là một dòng: đèn màu · "Câu 14 · Tên đề · 20/11" · chip loại lỗi (chip "máy đoán" viền đứt) · số lần sai.
- Mở ra (gọi `notebookItem`): nội dung câu, đáp án em chọn, đáp án đúng hoặc dòng "Đáp án hiện khi đề công bố lời giải", lời giải (thu gọn), **đổi loại lỗi**, ghi chú riêng của câu, công cụ sửa đúng loại lỗi (§5), nút "Làm lại câu này" (chỉ khi câu vào được luyện tập).

**Khung "Em sai vì sao?" (7b).** Ở trang kết quả (đề thi và luyện tập), nếu có câu sai và bài này chưa được phân loại thì hiện **một lần** danh sách toàn bộ câu sai. Mỗi câu có các chip: 4 loại Sai ngoo + "Chưa biết làm" + "Đoán mò". Chip máy đoán chắc được chọn sẵn, chip máy đoán chưa chắc có dấu "?". Nút "Lưu" và "Bỏ qua". Đã hiện thì không tự hiện lại (lưu ở máy khách theo `resultId`), nhưng trang kết quả có nút "Phân loại lỗi" để mở lại.

**Lời nhắc (7b):**
- Trang chủ: dải "Em có n lỗi đang lặp lại · Xem sổ tay" khi có loại lỗi 🔴.
- **Trước khi làm đề thi** (sau hộp mục tiêu điểm): hộp "Điều cần nhớ" gồm tối đa 3 dòng, mỗi dòng là lời nhắc ngắn của một loại lỗi 🔴/🟡 nặng nhất (cộng ghi chú chung nếu có). Nút "Bắt đầu" chỉ bấm được sau khi tick **"Em đã đọc"**. Sổ tay chưa có lỗi 🔴/🟡 thì không hiện hộp. Luyện tập không hiện hộp này.
- Trang kết quả: câu sai trùng loại lỗi đang 🔴 có dòng "Lỗi này em đã mắc n lần".

**Đề khắc phục (7c)** — ở đầu sổ tay và trong trang Luyện tập:
| Mẫu | Cấu trúc |
|---|---|
| ⚡ Ôn trước giờ kiểm tra (`ON_NHANH`) | 5 câu, 7 phút, nhắm vào loại lỗi 🔴 nặng nhất |
| 🎯 Đề khắc phục 10 câu (`MUOI_CAU`) | ≤ 4 câu gốc làm lại được + câu tương tự cho đủ 10, 15 phút |
| 🔁 Ôn một lỗi (`MOT_LOI`) | 5 câu cho một loại lỗi bấm từ sổ tay, 7 phút |
- **Câu tương tự**: lấy từ pool luyện tập (`practiceCandidates_`), cùng `bai` với câu gốc, ưu tiên cùng `mucDo`; với `DON_VI`/`BAM_MAY` ưu tiên Phần III, với `SOT` ưu tiên Phần II; ưu tiên câu em chưa làm. Thiếu thì lấy cùng chương, rồi báo "Chỉ dựng được n câu".
- Câu gốc chỉ vào đề khi vào được luyện tập (không bị chặn, đề đã công bố lời giải). Câu `HONG_KT`, `DOAN_MO` được ưu tiên.
- Kết quả ghi `KetQuaLuyenTap` với `kieu = KHAC_PHUC`, có lời giải ngay, không tính bảng xếp hạng. Trang kết quả nói câu nào vừa chuyển màu.

## Tiêu chí nghiệm thu
**7a — Sổ tay tự động**
- **TC-7.1** Học sinh có bài cũ (dữ liệu trước Pha 7, không có `t`, `goc`): `notebook` liệt kê đúng mọi câu `sc < m` lần làm gần nhất, gộp theo `key`; câu đã làm đúng lại thì có màu đúng §4.
- **TC-7.2** `notebook` không chứa `noiDung`, `dapAn`, `loiGiai`. `notebookItem` với câu của đề đang mở hoặc chưa công bố lời giải: có nội dung và đáp án em chọn, **không** có `dapAn`, `loiGiai`; đóng đề có lời giải thì có.
- **TC-7.3** Máy đoán: Phần III đáp án 0,25 với đáp án đúng 25 → `TINH_TOAN/DON_VI`, chắc; 2,48 với 2,5 → `TINH_TOAN/BAM_MAY`, cần hỏi; bỏ trống → `SOT`, chắc; Phần II sai 1 ý → `SOT`, cần hỏi; Phần I sai → `CHUA_RO`.
- **TC-7.4** Loại lỗi 🔴 "Lặp lại" đúng ngưỡng 3 câu / 2 đề; 3 câu cùng 1 đề thì chỉ 🟡.
- **TC-7.5** `notebook`, `notebookItem` của học sinh A không bao giờ trả câu của học sinh B (gọi bằng token của A với key của B).
- **TC-7.6** Giao diện: hai cột ở 1280×800, hai tab ở 390×844 (tab Sổ tay mở trước); nhóm Sai ngoo nằm trên, Hổng kiến thức thu gọn ở dưới; bấm tên lỗi bên phải thì bên trái lọc đúng; chi tiết câu thu gọn mặc định.
- **TC-7.7** `BAT_SO_TAY = KHONG`: gọi trực tiếp các action đều báo lỗi; không có mục Sổ tay. `SERVER_COMPAT=1.0.0` và máy chủ 1.5.0: không có mục, các trang khác bình thường.
- **TC-7.8** Sheet cũ chưa có `SoTay`, `CongThuc`: `notebook` chạy bình thường; lần ghi đầu tự tạo trang tính có tiêu đề.

**7b — Phân loại, công cụ sửa, lời nhắc**
- **TC-7.9** Nộp bài có 3 câu sai: khung "Em sai vì sao?" hiện một lần, có đủ 3 câu, chip máy đoán chắc được chọn sẵn; "Bỏ qua" thì tải lại trang không hiện lại; nút "Phân loại lỗi" mở lại được.
- **TC-7.10** `notebookTag`: học sinh chọn thắng máy đoán; đổi lại được; key không phải câu sai của mình bị từ chối; gắn 2 lần cùng key không tạo 2 hàng `SoTay`.
- **TC-7.11** Ghi chú câu và ghi chú chung lưu, tải lại vẫn còn; dài quá 500 ký tự bị cắt; ký tự HTML hiển thị nguyên văn (không chạy mã).
- **TC-7.12** Công cụ đơn vị: chọn "chiều dài" hiện đủ thang km…nm, m tô đậm; câu lệch 10² hiện "lệch 10² lần"; chọn đúng đơn vị thì báo đúng.
- **TC-7.13** Tập gạch từ khóa: câu chứa "không" và "làm tròn" thì sau "So sánh" hai từ này được tô; từ khóa thêm vào `TU_KHOA_DOC_SAI` có hiệu lực.
- **TC-7.14** Thẻ công thức: bài có hàng `CongThuc` (`bat = CO`) hiện tên gợi nhớ, công thức KaTeX, phạm vi, dấu hiệu; bài không có thì hiện gợi ý tự ghi.
- **TC-7.15** Thời gian từng phần: đề 50 phút hiện 15/15/12/8; đề 25 phút co giãn đúng tỉ lệ; bài có `t` hiện thời gian thực tế từng phần. `t` âm hoặc lớn hơn thời gian làm bị máy chủ bỏ.
- **TC-7.16** Trước khi làm đề thi khi có lỗi 🔴: nút Bắt đầu bị khóa tới khi tick "Em đã đọc". Không có lỗi 🔴/🟡 thì không hiện hộp. Luyện tập không hiện hộp.
- **TC-7.17** Trang chủ có dải nhắc khi có lỗi 🔴; không có thì không hiện.

**7c — Đề khắc phục**
- **TC-7.18** `MUOI_CAU`: ≤ 4 câu gốc + câu tương tự cùng bài, đủ 10 câu khi pool đủ; JSON không chứa `dapAn`, `loiGiai`, `maKho`; câu gốc thuộc đề chưa công bố lời giải không bao giờ xuất hiện (50 lần).
- **TC-7.19** Trạng thái: làm đúng câu khắc phục (có `goc`) ở ngày 1 → câu gốc 🟡; đúng lần nữa cùng ngày vẫn 🟡; ngày 2 đúng → 🟢; sai lại → 🔴.
- **TC-7.20** `ON_NHANH` 5 câu 420 giây nhắm loại lỗi 🔴 nặng nhất; `MOT_LOI` với `ma = SOT` ưu tiên câu Phần II.
- **TC-7.21** Kết quả `KHAC_PHUC` ghi `KetQuaLuyenTap` (KetQua không thêm hàng); bảng xếp hạng, bảng điểm, gợi ý đề tương tự không đổi.
- **TC-7.22** Token `p` của đề khắc phục bị sửa `goc` hoặc `qids` thì bị từ chối.
- **TC-7.23 (khuyến nghị)** Học sinh có 300 bài nộp giả: `notebook` dưới 3 giây trên shim có `SHEET_READ_MS`.

## Kế hoạch kiểm thử
Node `tests/pha7.test.js` (phần máy chủ của TC-7.1 → 7.5, 7.7 → 7.8, 7.10, 7.15, 7.18 → 7.23); thư viện đơn vị và tô từ khóa có test đơn vị riêng. E2E: nộp đề có câu sai → khung "Em sai vì sao?" → mở Sổ tay → lọc theo lỗi → mở chi tiết → công cụ đơn vị → ghi chú → đề khắc phục → màu đổi. Ảnh ở 390×844 và 1280×800, chế độ sáng và tối.

## Rủi ro và cách giảm
- **Lộ đáp án của đề đang mở:** `notebook` không bao giờ trả đáp án; `notebookItem` đi qua cùng điều kiện công bố với Pha 4 (TC-7.2, 7.18).
- **Chậm khi học sinh có nhiều bài:** đọc theo học sinh, đệm 60 giây, nội dung câu chỉ tải khi mở (TC-7.23).
- **Máy đoán sai:** chỉ coi là "chắc" hai trường hợp (bỏ trống, lệch đúng 10ⁿ); còn lại luôn hỏi; học sinh luôn sửa được.
- **Thiếu dữ liệu công thức:** công cụ vẫn chạy khi `CongThuc` trống (TC-7.14); nhập dần theo bài.
- **Học sinh không phân loại:** sổ tay vẫn có nhóm tự động (SOT, TINH_TOAN) và bản đồ chương; câu chưa phân loại có lời nhắc nhẹ.

## Câu hỏi mở (chưa trả lời thì làm theo đề xuất)
- **Q1. Ai nhập dữ liệu `CongThuc`?** Đề xuất: dự án Cowork "Kho đề" soạn bản nháp theo từng bài (tên gợi nhớ, phạm vi, dấu hiệu), thầy duyệt rồi dán vào trang tính. Web chạy được khi chưa có.
- **Q2. Danh sách từ khóa dễ đọc sai:** dùng danh sách mặc định §5.2, thầy bổ sung trong `CaiDat`. Thầy có muốn gắn từ khóa riêng cho từng câu không? Đề xuất: chưa.
- **Q3. Thời gian đề xuất từng phần (15/15/12/8 cho đề 50 phút):** thầy chỉnh lại nếu cần.
- **Q4. Câu làm đúng nhưng đoán mò:** có cho học sinh tự đánh dấu để đưa vào sổ tay không? Đề xuất: hoãn, làm sau 7c.

## Việc giáo viên cần làm
Mỗi pha con: dán Code.gs mới, Triển khai → Phiên bản mới, chạy `setup` (7a tạo `SoTay`, `CongThuc`). Nhập dần `CongThuc`. Bật/tắt bằng `BAT_SO_TAY`.

## Ước lượng: 7a **M** · 7b **L** · 7c **M**
