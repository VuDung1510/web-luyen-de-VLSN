# Pha 2 — Nối ngân hàng câu hỏi

## Mục tiêu
Giáo viên tạo đề từ "KHO CÂU HỎI VẬT LÝ" ngay trên trang quản trị: lọc/chọn câu, lấy nguyên đề gốc, ma trận 1 chạm. Máy chủ chỉ **đọc** kho và chép câu được chọn sang CauHoi. Chỉ lấy câu **đã có đáp án** (`QUYET-DINH.md` §5).

## Khảo sát thực tế kho (đọc ngày 18/11/2026, chỉ đọc, trang "Kho câu hỏi" A1:V75)
- 74 câu (52 lớp 12, 22 lớp 11), 3 nguồn: Nguồn 1 (44 câu, đề khảo sát), Nguồn 2 (21 câu, đề giữa kì lớp 11), Nguồn 3 (9 câu, đề thi thử "mã 101"). Tên thật của nguồn nằm trong Google Doc, không ghi vào repo.
- **Có đáp án 49/74.** Theo phần: P I 30/48, P II 6/11, P III 10/12, P IV 3/3 (bỏ qua). Dùng được **46 câu**. Lớp 12 có đúng 18–4–6; lớp 11 có 12–2–4.
- Đáp án P I: một chữ `A`…`D`.
- Đáp án P II: **hai kiểu**, `a) Đúng b) Sai c) Sai d) Đúng` và `a) S b) Đ c) Đ d) Đ`. `normTF_()` hiện tại đọc nhầm "d)" thành Đ (ra 5 ký tự), nên cần hàm đổi riêng.
- Đáp án P III: số kiểu Việt Nam, có thể có phẩy hoặc dấu âm: `4383`, `3,0`, `0,8`, `-120`. Không có đơn vị, không có `|`.
- Cột "Mức độ từng ý (Phần II)": `a) Biết; b) Hiểu; c) Hiểu; d) Vận dụng`. Mức độ câu: `Biết` / `Hiểu` / `Vận dụng`.
- Ý a–d của P II nằm ở 4 cột `A / a)`…`D / d)`, không có tiền tố. P III để trống 4 cột này.
- LaTeX: viết trong `$…$` (41/74 câu), không có `$$` hay `\(`, dấu `\` đơn. Kiểu chuyển từ Word: `${3.10}^{8}\ \text{m/s}$`, `\left( … \right)`, `\frac`, `\text{°C}`. `rich()` + KaTeX hiển thị được.
- Bảng trong nội dung: `\n[BẢNG] Cột 1 | Cột 2\nNhôm | 880\n…` (1 câu); 2 ô có xuống dòng.
- Hình vẽ: `Có – L12C2B11-P1-00001.png (02. HÌNH VẼ/Lớp 12)` (20 câu) hoặc để trống. Tên file = Mã câu + `.png`. File thật nằm sâu hơn đường dẫn ghi trong ô (`…/Lớp 12/HINH_VE_Lop12_lan1/…`), nên tìm theo **tên file**.
- Vị trí: `P1 – Câu 3` hoặc `Mã 101 – P1 Câu 12`. Nguồn 3 có số câu nhảy (P1 câu 1, 2, 3, 12, 14, 15), tức đề gốc không đủ.
- Mã câu `L12C1B04-P2-00031`. Trang "Danh mục chủ đề": Lớp | Chương | Mã chương | Bài | Mã bài.

## Phạm vi
**Làm**: tab "Ngân hàng"; đọc kho qua chỉ mục có đệm; lọc; giỏ câu; lấy đề gốc; ma trận 18–4–6 (sửa được số); ưu tiên câu ít dùng; tìm và chép hình theo lô; ánh xạ dữ liệu; hiển thị `[BẢNG]` (nếu Pha 3 chưa làm).
**Không làm**: sửa kho từ web; chấm P IV; câu chưa có đáp án; học sinh đọc kho.
**Hoãn sau**: **nhiều mã đề** và trộn phương án (dùng "Trộn câu" `tronCau` sẵn có; xem câu hỏi mở số 4); ma trận theo tỉ lệ mức độ.

## Thiết kế kỹ thuật

### Cấu hình (CaiDat, thêm vào `DEFAULT_SETTINGS`)
`KHO_CAU_HOI_ID` (mặc định trống, giáo viên dán id), `THU_MUC_HINH_KHO_ID` (id thư mục "02. HÌNH VẼ"; nếu trống thì dùng `getFilesByName` trên toàn Drive). Không ghi id thật vào repo.

### Dữ liệu web (chỉ thêm cột cuối CauHoi qua `SCHEMA`)
`maKho` "Mã câu kho", `chuong` "Chương", `bai` "Bài", `mucDoY` "Mức độ từng ý", `nguon` "Nguồn". Câu nhập tay để trống các cột này. Có test cho Sheet cũ thiếu cột.

### Ánh xạ kho → CauHoi (`bankToQuestion_(row)`: hàm thuần, có bản JS tương đương nếu Pha 3 cần)
| Kho | CauHoi |
|---|---|
| Dạng "Phần I/II/III" | `loai` TN/DS/TL, `phan` 1/2/3. "Phần IV" bị loại, đếm vào `boQua.tuLuan` |
| Mức độ | ánh xạ tường minh: Biết→NB, Hiểu→TH, Vận dụng→VD, Vận dụng cao→VDC (không dựa vào `normalizeLevel_`) |
| Đáp án P II | regex `([a-d])\)\s*(Đúng\|Sai\|Đ\|S)(?=[\s,;.]\|$)` cờ `i`, lấy theo thứ tự a–d, ghép thành `ĐSSĐ`; thiếu ý thì coi là chưa có đáp án |
| Đáp án P III | giữ nguyên chuỗi (vd `3,0`); `saiSo` trống |
| Chương / Bài | `chuong`, `bai`; `chuDe` = Bài bỏ tiền tố "Bài N. " (`QUYET-DINH` §3: chủ đề theo Chương/Bài; giữ cả cột Chương để thống kê) |
| Hình vẽ `Có – <tên>.png (…)` | `hinhAnh` = URL bản chép |
| Nội dung, A–D, Lời giải, Mã câu, Nguồn, Mức độ từng ý | chép nguyên văn |
Câu thiếu đáp án hợp lệ không bao giờ vào đề; máy chủ kiểm tra lại bằng `validateQuestion_`.

### Đọc kho và đệm (hỗ trợ tối đa 3 000 câu)
- Đọc `openById(KHO_CAU_HOI_ID)` → "Kho câu hỏi", tìm cột theo **tên tiêu đề** (thiếu cột bắt buộc thì báo lỗi kèm tên cột).
- Từ đó dựng **chỉ mục gọn**, mỗi câu: `maKho, hang (số hàng), lop, chuong, bai, loai, mucDo, nguon, viTri, coDapAn, coHinh, tom (≤ 160 ký tự nội dung)`. Đệm chỉ mục 10 phút bằng hạ tầng chia mảnh của Pha 1, ngưỡng riêng 2 MB (khoảng 3 000 câu × ~300 B). Nút "Đọc lại kho" (`refresh`).
- Cần câu đầy đủ (xem trước, nạp vào đề) thì đọc theo `hang` bằng `getRange` từng khối liền nhau, chỉ các hàng được chọn.

### Hình vẽ (không đổi quyền file gốc)
- Bản đồ tên→id dựng **một lần** bằng cách duyệt đệ quy `THU_MUC_HINH_KHO_ID`, đệm 10 phút. Nếu chưa cấu hình thư mục thì dùng `getFilesByName`.
- Mỗi hình: `makeCopy` vào `imageFolder_()`, chia sẻ bản chép "ai có liên kết được xem", URL `https://lh3.googleusercontent.com/d/<id>`. Ghi `IMG_<tên>` → id bản chép vào Script Properties để không chép lại.
- **Chia lô:** mỗi lần gọi xử lý tối đa 40 hình, hoặc dừng ở mốc 4,5 phút, rồi trả `{tiepTuc: cursor}`; giao diện tự gọi tiếp và hiện tiến độ. Không tìm thấy hình thì cảnh báo, câu vẫn chọn được.

### API (Code.gs: tăng số phụ, `features` thêm `"bank"`; tất cả gọi `requireTeacher_`)
| Action | Tham số | Kết quả |
|---|---|---|
| `adminBankMeta` | `refresh?` | `{ tong, coDapAn, dungDuoc, theoDang, theoMucDo, cay:[{lop,chuong,bai,dem:{TN,DS,TL}}], nguon:[{ten,soCau,coDapAn}], docLuc }` |
| `adminBankList` | `filter{lop,chuong[],bai[],loai[],mucDo[],nguon,q}`, `page`, `size≤100` | `{ tong, items:[{maKho,loai,phan,mucDo,chuong,bai,tom,coHinh,nguon,viTri,daDung}] }`; chỉ câu có đáp án; `daDung` = số đề web có `maKho` này |
| `adminBankSource` | `nguon` | câu có đáp án của nguồn, sắp theo (phần, câu); `{ items, thieu:[…], khongDapAn:n }` |
| `adminBankMatrix` | `{lop,chuong[],bai[],so:{TN:18,DS:4,TL:6},seed?}` | `{ maKho:[…], thieu:{TN,DS,TL} }`: ưu tiên câu `daDung` nhỏ, ngẫu nhiên trong cùng mức |
| `adminBankToQuestions` | `maKho[]`, `cursor?` | `{ questions:[đã ánh xạ, đầy đủ], canhBao:[…], tiepTuc? }` (chia lô vì có chép hình) |
Lưu đề bằng `adminSaveExam` sẵn có (nhận thêm các cột mới).

### Giao diện quản trị
- Tab `#/ngan-hang`: bộ lọc (Lớp, cây Chương→Bài, Dạng, Mức độ, Nguồn, ô tìm chữ); danh sách câu (KaTeX, nhãn "có hình", "đã dùng N lần", nút xem đầy đủ); giỏ câu nổi "P1 x · P2 y · P3 z".
- Nút **Lấy đề gốc** (nạp câu có đáp án của nguồn, cảnh báo câu thiếu và câu không có đáp án), **Ma trận 1 chạm** (mặc định 18–4–6), **Tạo đề**: mở `viewEditor` với câu đã nạp, chưa lưu, để giáo viên xem lại rồi lưu.
- `rich()` hiển thị khối `[BẢNG]` thành `<table>` (dùng chung cho trang học sinh).
- Máy chủ chưa có `bank` thì tab hiện "Cần cập nhật máy chủ".

## Tiêu chí nghiệm thu
- **TC-2.1** `bankToQuestion_`: `a) Đúng b) Sai c) Sai d) Đúng`→`ĐSSĐ`; `a) S b) Đ c) Đ d) Đ`→`SĐĐĐ`; `a) đúng; b) Sai, c) S. d) Đ`→`ĐSSĐ`; thiếu ý thì không có đáp án. Chấm: `ĐSSĐ` được 1 điểm, sai 1 ý được 0,5. Mức độ "Vận dụng cao"→VDC.
- **TC-2.2** P III `3,0` chấm đúng với `3`, `3.0`, `3,0`; `-120` đúng với `-120`, sai với `120`.
- **TC-2.3** Câu không có đáp án và P IV không bao giờ xuất hiện ở List/Source/Matrix; gửi `adminSaveExam` có câu như vậy thì bị từ chối, thông báo nêu số câu.
- **TC-2.4** Hình: URL bản chép; gọi lần 2 thì `makeCopy` vẫn = 1; không thấy file thì cảnh báo có tên file; file gốc 0 lần `setSharing`.
- **TC-2.5** `adminBankSource` sắp đúng cả hai kiểu Vị trí; có `thieu` khi số câu nhảy.
- **TC-2.6** Ma trận 18–4–6 trên dữ liệu đủ thì ra đúng 18/4/6, đúng lớp/chương đã lọc; thiếu thì `thieu` nêu đúng phần và số câu, không tạo đề thiếu một cách âm thầm.
- **TC-2.7** Ưu tiên ít dùng: kho mẫu 30 câu P1, 10 câu đã dùng, chọn 18 thì cả 18 câu lấy từ 20 câu chưa dùng.
- **TC-2.8** Chia lô hình: 300 câu có hình, shim tính chi phí `makeCopy` 1 s/hình; xong sau nhiều lượt `tiepTuc`, không lượt nào quá 4,5 phút giả, không chép trùng.
- **TC-2.9** Kho chỉ đọc: shim của file kho ghi nhận 0 lần `setValues/appendRow/deleteRow/insert*/setSharing`.
- **TC-2.10** Học sinh gọi mọi `adminBank*` thì lỗi `AUTH`. `startExam` của đề tạo từ kho không chứa `dapAn`, `loiGiai`, `maKho`, `mucDoY`.
- **TC-2.11** Kho giả 3 000 câu: duyệt 10 trang `adminBankList` + 1 `Meta` + 1 `Matrix` thì `openById` = 1; mỗi trang tuần tự hóa < 150 KB; `adminBankToQuestions` 28 câu chỉ đọc đúng các hàng cần (đếm ô đọc).
- **TC-2.12** `[BẢNG]` hiển thị thành bảng 2 cột, 5 hàng (e2e + ảnh).
- **TC-2.13** Kiểm tra dữ liệu thật (agent riêng, chỉ đọc kho bằng công cụ Sheets): so số câu dùng được với **trang "Thống kê" của kho**, và so 10 hàng mẫu do một agent khác đọc tay (đáp án, loại, mức độ); liệt kê mã câu bị loại kèm lý do. Không lưu nội dung kho vào repo.
- **TC-2.14** Máy chủ 1.0.0: tab Ngân hàng hiện thông báo; các tab khác không lỗi.

## Kế hoạch kiểm thử
Node `tests/pha2.test.js`. Shim thêm `SpreadsheetApp.openById` với kho giả tự soạn đúng định dạng khảo sát, `DriveApp` (duyệt thư mục, `getFilesByName`, `makeCopy` có chi phí giả), đồng hồ giả cho mốc 4,5 phút. E2E: lọc → ma trận → trình soạn → lưu → học sinh làm → kết quả. Ảnh: tab Ngân hàng, giỏ câu, cảnh báo thiếu, câu có hình, bảng.

## Rủi ro & cách giảm
- Kho ít câu có đáp án nên đề gốc và ma trận thiếu câu: báo rõ phần thiếu; giáo viên bổ sung đáp án trong kho (quyết định đã chốt: chỉ lấy câu có đáp án).
- Quyền `openById`/`DriveApp` cần cấp lại; lỗi quyền thì thông báo kèm hướng dẫn.
- Kho đổi tên cột: đọc theo tiêu đề, báo lỗi rõ.
- Kho vượt 3 000 câu: cảnh báo; khi đó chỉ mục vượt ngưỡng đệm nên chậm hơn nhưng vẫn đúng.

## Việc giáo viên cần làm
Dán `KHO_CAU_HOI_ID` (và nên dán `THU_MUC_HINH_KHO_ID`) vào CaiDat; chạy `setup` để cấp quyền.

## Ước lượng: **L** (sau khi hoãn nhiều mã đề)

Sửa đặc tả ngày 18/11/2026: theo `soat-pha-0.md` S-3, S-8, S-9, S-10, S-18, S-19, S-20.
