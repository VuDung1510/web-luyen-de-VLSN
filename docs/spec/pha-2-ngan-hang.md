# Pha 2 — Nối ngân hàng câu hỏi

## Mục tiêu
Giáo viên tạo đề từ "KHO CÂU HỎI VẬT LÝ" ngay trên trang quản trị: lọc/chọn câu, lấy nguyên đề gốc, ma trận 1 chạm, sinh nhiều mã đề. Máy chủ chỉ **đọc** kho, chép câu được chọn sang trang CauHoi.

## Khảo sát thực tế kho (đọc ngày 18/11/2026, chỉ đọc, trang "Kho câu hỏi" A1:V75)
- 74 câu (52 lớp 12, 22 lớp 11); 3 nguồn: "Vật Lý Siêu Nhẩm – Đề khảo sát đội tuyển Vật lí 12 lần 1" (44), "Đề chính thức – THPT Hoàng Cầu – Giữa kì 1 Vật lí 11 (mã 1104)" (21), "Soạn mới – Đề thi thử giữa kỳ I Vật lí 12 (mã 101)" (9).
- **Có đáp án 49/74.** Theo dạng: Phần I 30/48, Phần II 6/11, Phần III 10/12, Phần IV 3/3 (bỏ qua). Dùng được: **46 câu**. Lớp 12 dùng được đúng 18 P1 – 4 P2 – 6 P3 ⇒ ma trận 18–4–6 chỉ tạo được **một** bộ câu; lớp 11: 12–2–4 (chưa đủ).
- Đáp án Phần I: một chữ `A`…`D`.
- Đáp án Phần II: **hai kiểu** — `a) Đúng b) Sai c) Sai d) Đúng` và `a) S b) Đ c) Đ d) Đ`. Lưu ý: `normTF_()` hiện tại đọc nhầm chữ "d)" thành Đ (ra 5 ký tự) ⇒ phải đổi riêng, xem mục Ánh xạ.
- Đáp án Phần III: số kiểu Việt Nam, có thể có dấu phẩy, số âm: `4383`, `3,0`, `0,8`, `-120`. Không có đơn vị, không có `|`.
- "Mức độ từng ý (Phần II)": `a) Biết; b) Hiểu; c) Hiểu; d) Vận dụng` (rỗng với P1/P3). Mức độ câu: `Biết` / `Hiểu` / `Vận dụng`.
- Ý Phần II nằm ở 4 cột `A / a)`… `D / d)`, **không** có tiền tố "a)". Phần III để trống 4 cột phương án.
- LaTeX: công thức nội dòng trong `$…$` (41/74 câu có), không thấy `$$`, `\(`; dấu `\` đơn trong ô (không thoát đôi). Kiểu chuyển từ Word: `${3.10}^{8}\ \text{m/s}$`, `$3,{34.10}^{5}\ \text{J/kg}$`, `\left( … \right)`, `\frac`, `\text{°C}`. `rich()` + KaTeX hiện tại hiển thị được (đã có xử lý `2,67` → `2{,}67`).
- Bảng trong nội dung: 1 câu dùng dạng `\n[BẢNG] Chất | Nhiệt dung riêng (J/kg.K)\nNhôm | 880\n…`; 2 ô có xuống dòng.
- Hình vẽ: `Có – L12C2B11-P1-00001.png (02. HÌNH VẼ/Lớp 12)` (20 câu) hoặc rỗng. Tên file = Mã câu + `.png`. File thực tế nằm sâu hơn ghi chú: `02. HÌNH VẼ/Lớp 12/HINH_VE_Lop12_lan1/L12C2B11-P1-00001.png` ⇒ phải tìm theo **tên file**, không theo đường dẫn.
- Vị trí trong đề gốc: `P1 – Câu 3` hoặc `Mã 101 – P1 Câu 12`. Đề "Soạn mới (mã 101)" chỉ có 9 câu, số câu nhảy (P1 câu 1,2,3,12,14,15) ⇒ đề gốc có thể không đầy đủ.
- Lời giải: 49 câu có; Phần II viết `a) Đúng. … b) Sai. …`. Mã câu dạng `L12C1B04-P2-00031` (lớp-chương-bài-phần-số). Trang "Danh mục chủ đề": Lớp | Chương | Mã chương | Bài | Mã bài.

## Phạm vi
**Làm**: tab quản trị "Ngân hàng"; đọc kho có đệm; lọc; giỏ câu; lấy đề gốc; ma trận 18–4–6 (sửa được số); sinh N mã đề; ưu tiên câu ít dùng; tìm và chép hình; ánh xạ dữ liệu; hiển thị `[BẢNG]`.
**Không làm**: sửa kho từ web; chấm Phần IV; học sinh đọc kho (Pha 4 có pool riêng); nhập kho từ Word (Pha 3).

## Thiết kế kỹ thuật

### Cấu hình (CaiDat, thêm hàng trong `DEFAULT_SETTINGS`)
`KHO_CAU_HOI_ID` (id file kho; mặc định trống — giáo viên dán), `THU_MUC_HINH_KHO_ID` (id thư mục "02. HÌNH VẼ"; trống = tìm tên file trong toàn Drive). Không ghi id thật vào repo.

### Dữ liệu web (chỉ thêm cột cuối CauHoi qua `SCHEMA`)
`maKho` "Mã câu kho", `chuong` "Chương", `bai` "Bài", `mucDoY` "Mức độ từng ý", `nguon` "Nguồn". Câu nhập tay để trống. Test: Sheet cũ thiếu các cột vẫn chạy.

### Ánh xạ kho → CauHoi (`bankToQuestion_(row)`, hàm thuần, test riêng)
| Kho | CauHoi |
|---|---|
| Dạng "Phần I/II/III" | `loai` TN/DS/TL, `phan` 1/2/3; "Phần IV" ⇒ loại, đếm vào `boQua.tuLuan` |
| Mức độ Biết/Hiểu/Vận dụng | `mucDo` NB/TH/VD |
| Đáp án P2 | regex `([a-d])\)\s*(Đúng\|Sai\|Đ\|S)(?=\s\|$)` (không dùng `\b` vì chữ có dấu) theo thứ tự a–d ⇒ `ĐSSĐ`; không đủ 4 ⇒ coi như chưa có đáp án |
| Đáp án P3 | giữ nguyên chuỗi (vd `3,0`); `saiSo` trống |
| Chương / Bài | `chuong`, `bai`; `chuDe` = Bài bỏ tiền tố "Bài N. " (theo `cau-hoi-mo.md` câu 3) |
| Hình vẽ `Có – <tên>.png (…)` | `hinhAnh` = URL ảnh sau khi chép (xem dưới) |
| Nội dung, A–D, Lời giải, Mã câu, Nguồn, Mức độ từng ý | chép nguyên văn |
Câu **không có đáp án hợp lệ** không bao giờ lọt vào đề (máy chủ kiểm tra lại khi tạo, dùng `validateQuestion_`).

### Hình vẽ
`resolveBankImage_(fileName)`: tìm `DriveApp.getFilesByName(fileName)` (ưu tiên file có tổ tiên là `THU_MUC_HINH_KHO_ID`); **chép** (`makeCopy`) vào thư mục ảnh web `imageFolder_()` và chia sẻ bản chép "ai có liên kết được xem"; URL `https://lh3.googleusercontent.com/d/<id>`. Bản đồ tên→id bản chép lưu ở Script Properties (`IMG_<tên>`) để không chép lại. File gốc trong kho không bị đổi quyền. Không tìm thấy ⇒ cảnh báo, câu vẫn chọn được.

### API mới (Code.gs → 1.3.0, tất cả `requireTeacher_`)
| Action | Tham số | Kết quả |
|---|---|---|
| `adminBankMeta` | `refresh?` | `{ tong, coDapAn, dungDuoc, theoDang, theoMucDo, lop[], cay: [{lop, chuong, bai, dem:{TN,DS,TL}}], nguon: [{ten, soCau, coDapAn}], docLuc }` |
| `adminBankList` | `filter {lop, chuong[], bai[], loai[], mucDo[], nguon, q, chiCoDapAn=true}`, `page`, `size≤100` | `{ tong, items: [{maKho, loai, phan, mucDo, chuong, bai, noiDung, A–D, dapAn, loiGiai, hinh, nguon, viTri, daDung}] }` (`daDung` = số đề web đang dùng câu này, đếm theo `maKho` trong CauHoi) |
| `adminBankSource` | `nguon` | câu của nguồn, sắp theo (phần, câu) tách từ Vị trí; `{ items, thieu: [...], khongDapAn: n }` |
| `adminBankMatrix` | `{lop, chuong[], bai[], so:{TN:18,DS:4,TL:6}, mucDo?:{NB,TH,VD}, soMa:1..4, uuTienItDung=true, seed?}` | `{ bo: [[maKho…]…], thieu: {TN:0,DS:1,TL:0} }` — chọn câu ít dùng trước, ngẫu nhiên trong cùng mức dùng |
| `adminBankToQuestions` | `maKho[]` | danh sách câu đã ánh xạ (có hình đã chép, cảnh báo) để nạp vào trình soạn đề |
Lưu đề dùng lại `adminSaveExam` (thêm nhận các trường mới). Đọc kho: `SpreadsheetApp.openById(KHO_CAU_HOI_ID).getSheetByName('Kho câu hỏi').getDataRange().getValues()` — đệm CacheService chia mảnh (dùng chung hạ tầng Pha 1), thời hạn 10 phút, nút "Đọc lại kho" (`refresh`).

### Giao diện quản trị
- Tab mới `#/ngan-hang`: cột lọc (Lớp, Chương→Bài dạng cây, Dạng, Mức độ, Nguồn, ô tìm chữ), danh sách câu (KaTeX + hình thu nhỏ, nhãn "đã dùng N lần"), giỏ câu nổi "Đã chọn P1 x · P2 y · P3 z".
- Nút: **Lấy đề gốc** (chọn Nguồn ⇒ nạp đủ câu theo thứ tự, hiện cảnh báo thiếu/không đáp án), **Ma trận 1 chạm** (mặc định 18–4–6, sửa được), **Tạo đề** ⇒ mở `viewEditor` với câu đã nạp (chưa lưu) để giáo viên xem lại; hộp lưu có "Số mã đề" (1–4).
- Nhiều mã đề: tạo N đề "Tên – Mã 101…", mỗi mã trộn thứ tự câu trong phần và (tùy chọn) trộn phương án Phần I, đổi lại `dapAn` tương ứng (theo `cau-hoi-mo.md` câu 2).
- `rich()` hiển thị khối `[BẢNG] a | b` (các dòng có `|` liền sau) thành `<table>`; dùng cả trang học sinh.
- Máy chủ cũ: tab hiện thông báo "Cần cập nhật máy chủ" (không có `features.bank`).

## Tiêu chí nghiệm thu
- **TC-2.1** `bankToQuestion_`: `a) Đúng b) Sai c) Sai d) Đúng`→`ĐSSĐ`; `a) S b) Đ c) Đ d) Đ`→`SĐĐĐ`; chuỗi thiếu ý ⇒ không đáp án. Chấm thử: trả lời `ĐSSĐ` được 1 điểm, sai 1 ý được 0,5.
- **TC-2.2** Phần III `3,0` chấm đúng với `3`, `3.0`, `3,0`; `-120` đúng với `-120`, sai với `120`.
- **TC-2.3** Câu không đáp án và Phần IV không xuất hiện khi `chiCoDapAn=true`; gửi `adminSaveExam` có câu như vậy bị từ chối với thông báo nêu số câu.
- **TC-2.4** Hình: `Có – X.png (…)` ⇒ `hinhAnh` là URL bản chép; gọi lần 2 không chép lại (shim đếm `makeCopy` = 1); không thấy file ⇒ cảnh báo có tên file. Kho gốc: 0 lần `setSharing`.
- **TC-2.5** `adminBankSource` sắp đúng thứ tự cho cả hai kiểu Vị trí; báo `thieu` khi số câu nhảy.
- **TC-2.6** Ma trận 18–4–6 trên dữ liệu đủ ⇒ đúng 18/4/6, mỗi câu đúng lớp/chương đã lọc; thiếu ⇒ `thieu` nêu đúng phần và số câu, không tạo đề thiếu ngầm.
- **TC-2.7** Ưu tiên ít dùng: kho mẫu 30 câu P1, 10 câu đã dùng ⇒ chọn 18 câu thì ≥ 18 câu lấy từ 20 câu chưa dùng.
- **TC-2.8** Sinh 3 mã: 3 đề trong DeThi, cùng tập câu, thứ tự khác nhau, đáp án sau trộn phương án vẫn chấm đúng (nộp đúng hết ⇒ 10 điểm ở cả 3 mã).
- **TC-2.9** Không ghi vào kho: shim của file kho ghi nhận 0 lần `setValues/appendRow/deleteRow/insert*`.
- **TC-2.10** Học sinh gọi mọi `adminBank*` ⇒ lỗi `AUTH`. `startExam` của đề tạo từ kho không chứa `dapAn`, `loiGiai`, `maKho`, `mucDoY`.
- **TC-2.11** Đọc kho tối đa 1 lần/10 phút (đếm `openById`) trừ khi `refresh`.
- **TC-2.12** Kho giả 1 000 câu: `adminBankList` trả trang 100 câu, tuần tự hóa < 300 KB.
- **TC-2.13** `[BẢNG]` hiển thị thành bảng 2 cột 5 hàng (e2e + ảnh).
- **TC-2.14** (Kiểm tra dữ liệu thật — agent riêng, chỉ đọc kho bằng công cụ Sheets) áp `bankToQuestion_` lên toàn bộ kho thật: số câu dùng được = số câu có đáp án hợp lệ (hiện 46); 100% đáp án/loại/mức độ khớp từng hàng; liệt kê câu bị loại và lý do. Không lưu nội dung kho vào repo.
- **TC-2.15** Máy chủ cũ: tab Ngân hàng hiện thông báo, các tab khác không lỗi.

## Kế hoạch kiểm thử
Node `tests/pha2.test.js` (shim thêm `SpreadsheetApp.openById` với kho giả tự soạn đúng định dạng khảo sát, `DriveApp.getFilesByName/makeCopy`); e2e: lọc → ma trận → trình soạn → lưu 2 mã → học sinh làm mã 2 → kết quả. Ảnh: tab Ngân hàng, giỏ câu, cảnh báo thiếu, câu có hình, bảng.

## Rủi ro & cách giảm
- Kho ít câu có đáp án ⇒ ma trận/đề gốc thiếu: báo rõ phần thiếu; xem `cau-hoi-mo.md` câu 4 (cho phép nạp câu chưa đáp án vào bản nháp).
- Quyền: `openById` + `DriveApp` cần cấp quyền lại; lỗi quyền ⇒ thông báo hướng dẫn.
- Ảnh chép tốn dung lượng (nhỏ, ~100–250 KB/ảnh); trùng tên file ⇒ ưu tiên trong thư mục cấu hình.
- Kho đổi tên cột ⇒ đọc theo **tên tiêu đề**, thiếu cột bắt buộc thì báo lỗi nêu tên cột.

## Việc giáo viên cần làm
Dán id kho vào CaiDat `KHO_CAU_HOI_ID` (và tùy chọn `THU_MUC_HINH_KHO_ID`); chạy `setup` để cấp quyền mở file khác và Drive.

## Ước lượng: **L**
