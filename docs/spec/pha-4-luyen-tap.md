# Pha 4 — Luyện tập cho học sinh

## Mục tiêu
Học sinh tự tạo đề luyện từ một **pool luyện tập** do giáo viên chọn, luyện lại câu đã sai, làm đề nhanh 10 phút theo bài. Bài luyện tập không vào bảng xếp hạng/bảng điểm. Học sinh không đọc thẳng kho, không nhận đáp án trước khi nộp, và **không gặp câu của đề thi chưa công bố lời giải**.

## Phạm vi
**Làm**: trang tính pool trong file web; đồng bộ pool từ kho; kiểu TU_TAO và CAU_SAI; NHANH là **mẫu dựng sẵn** của TU_TAO; lưu kết quả luyện tập riêng; trang "Luyện tập"; xem lại bài luyện; chặn câu đang thi.
**Không làm**: bảng xếp hạng luyện tập; giao bài về nhà có hạn; P IV; học sinh chọn từng câu.
**Hoãn sau**: giới hạn số lượt/ngày (nếu làm thì đếm từ dữ liệu bền: số hàng `KetQuaLuyenTap` trong ngày theo `TZ`, cộng lượt bắt đầu chưa nộp lưu ở trang tính `LuotLuyenTap`, trong `withLock_`; **không** đếm bằng CacheService); `myPracticeStats` theo chương/bài (Pha 4 chỉ trả số đếm cơ bản trong `practiceMeta`).

## Thiết kế kỹ thuật

### Dữ liệu (chỉ thêm trang tính; `setup()` tạo, lần ghi đầu cũng tự tạo)
- **`LuyenTap`** (pool): `maKho` · `lop` · `chuong` · `bai` · `loai` · `phan` · `mucDo` · `noiDung` · `hinhAnh` · `A`–`D` · `dapAn` · `saiSo` · `loiGiai` · `bat` (CO/KHONG) · `capNhat`. Khóa `maKho`. **Không bao giờ xóa hàng**: "thay" pool chỉ đặt `bat=KHONG` cho câu không còn chọn.
- **`KetQuaLuyenTap`**: cùng cột với KetQua, thêm `kieu` (TU_TAO / CAU_SAI / NHANH). Định dạng số giống KetQua (`setup` áp cho cả hai). Mỗi mục `chiTiet` lưu thêm `q` = qid (`maKho` hoặc `examId#stt`).
- Pool tối đa khoảng 3 000 câu. Đệm máy chủ chỉ giữ **chỉ mục** (`maKho, hang, lop, chuong, bai, loai, mucDo, bat`); câu đầy đủ đọc theo hàng (`getRange`) khi bắt đầu, nộp hoặc xem lại.

### Chặn câu đang thi — `blockedBankIds_()` (có đệm, đổi `gen` khi DeThi/CauHoi đổi)
Tập `maKho` có trong CauHoi của mọi đề có `trangThai = NHAP`, hoặc đề mà `canReveal_(e)` = false. **Bổ sung 19/11/2026 (theo soát code Pha 4, R-1):** đề **đang mở hoặc chưa tới giờ mở** cũng bị chặn, với **mọi** chế độ hiện lời giải (kể cả "Ngay sau khi nộp"): lời giải hiện cho từng học sinh sau khi nộp không phải là "công bố". Tóm lại câu chỉ được vào luyện tập khi đề **đã đóng** (hết hạn hoặc giáo viên đóng) **và** `canReveal_(e)` = true. Đề không có hạn và còn mở thì câu bị chặn cho tới khi giáo viên đóng đề. Xem lại bài luyện cũ (`getResult`/`buildPracticeView_`) và kết quả nộp của bài luyện cũng ẩn đáp án + lời giải của câu đang bị chặn tại thời điểm xem (R-2). `practiceMeta`, `practiceStart` (mọi kiểu) và tập CAU_SAI đều loại các câu này. Khi đề đóng (lời giải được công bố), câu xuất hiện lại. Giáo viên "Đưa vào luyện tập" một câu đang bị chặn thì trang quản trị cảnh báo (vẫn cho thêm; câu tự mở khi đề công bố lời giải).

### Khớp lớp
Học sinh: cụm số đầu của lớp `/^\s*(\d+)/` ("12A1"→12, "10A1"→10). Pool: số trong cột `lop` ("Lớp 12"→12). Không tách được số (vd "CLB") thì học sinh thấy toàn pool đang bật.

### API (Code.gs: tăng số phụ, `features` thêm `"practice"`)
| Action | Ai | Tham số | Kết quả |
|---|---|---|---|
| `adminPracticeSync` | GV | `{maKho[]}` hoặc `{filter}` (như `adminBankList`), `mode: "them"` hoặc `"thay"`, `cursor?` | `{them, capNhat, tat, boQua:{khongDapAn, tuLuan}, dangThi:[maKho…], tiepTuc?}`. Chép bằng `bankToQuestion_` + chép hình chia lô (Pha 2). |
| `adminPracticeList` | GV | `filter`, `page` | câu trong pool + `bat` + `dangThi` + số lượt đã làm |
| `adminPracticeToggle` | GV | `{maKho[], bat}` | `{n}` |
| `practiceMeta` | HS | — | `{ cay:[{chuong,bai,dem:{TN,DS,TL}}], soCauSai, nhanh:{TN,DS,TL,phut}, soBai, diemTB }`: chỉ đúng khối lớp, đã trừ câu bị chặn; không có nội dung câu |
| `practiceStart` | HS | `{kieu, chuong[], bai[], so:{TN,DS,TL}, phut, mucTieu?}` | như `startExam`: `{attemptToken, durationSec, questions:[không dapAn/loiGiai/maKho], exam:{tieuDe}}`; token loại `p` chứa `sid`, `qids`, `exp` (đã ký) |
| `submitExam` (sửa) | HS | token `p` | chấm theo `qids`, ghi `KetQuaLuyenTap`, trả kết quả **kèm lời giải** qua `buildPracticeView_` |
| `myResults` (sửa) | HS | `loai: "thi"` (mặc định) hoặc `"luyen"` | danh sách tóm tắt từ KetQua hoặc KetQuaLuyenTap |
| `getResult` (sửa) | HS/GV | `resultId` bắt đầu `LT` | tìm trong `KetQuaLuyenTap`; dựng bằng `buildPracticeView_`: lấy câu theo `q`, câu không còn thì hiện "Câu đã bị gỡ khỏi ngân hàng" |
- CaiDat `CHO_LUYEN_TAP` (CO/KHONG). Đặt KHONG thì `practiceMeta`, `practiceStart`, `submitExam` token `p` đều báo lỗi "Giáo viên đang tắt luyện tập" (chặn ở máy chủ, không chỉ ẩn trên giao diện).

### Hai kiểu đề + một mẫu
1. **TU_TAO**: chọn chương/bài, số câu mỗi phần (tổng 5–40), thời gian 5–90 phút. Ngẫu nhiên, ưu tiên câu học sinh chưa làm (theo `q` trong `KetQuaLuyenTap`).
2. **CAU_SAI**: câu học sinh đã làm chưa trọn điểm: (a) bài luyện, theo `maKho`; (b) đề thi chính, theo `examId#stt`, **chỉ** đề còn tồn tại và `canReveal_(e)` = true. Với (b), nếu câu ở `examId#stt` hiện có `maKho` khác với lúc làm, hoặc câu nhập tay mà nội dung đã đổi (so mã băm nội dung lưu trong `chiTiet` từ pha này), thì bỏ khỏi tập. Làm đúng ở lần luyện sau thì rút khỏi tập. Tối đa 20 câu, câu sai gần nhất trước.
3. **NHANH**: chọn 1 bài, gọi TU_TAO với mặc định 7 P1 + 1 P2 + 2 P3, 10 phút (CaiDat `LUYEN_NHANH` = `7,1,2,10`). Thiếu câu thì lấy thêm cùng chương và báo cho học sinh.
- Thiếu câu: tạo đề ít câu hơn và nói rõ ("Bài này mới có 4 câu Phần I").
- Mục tiêu điểm: hiện hộp mục tiêu như đề thi, có nút "Bỏ qua" (`QUYET-DINH` §4).

### Giao diện
- Học sinh: mục "Luyện tập" (`#/luyen-tap`): 3 thẻ (Tự tạo đề · Luyện câu đã sai (n) · Đề nhanh 10 phút); cây chương→bài có số câu; bắt đầu thì dùng lại `runExam()`; trang kết quả có lời giải. Lịch sử có bộ lọc "Đề thi / Luyện tập" (`myResults loai`).
- Giáo viên: trong tab Ngân hàng có nút "Đưa vào luyện tập" (cảnh báo câu đang thi); tab con "Pool luyện tập" (bật/tắt, nhãn "đang thi", số lượt làm).
- Máy chủ cũ, hoặc `CHO_LUYEN_TAP=KHONG`: không hiện mục Luyện tập.

## Tiêu chí nghiệm thu
- **TC-4.1** `adminPracticeSync` từ kho giả: chỉ câu có đáp án, không P IV; chạy lại không nhân đôi; "thay" không xóa hàng (chỉ đặt `bat`); kho 0 lần ghi.
- **TC-4.2** `practiceMeta`: lớp 10A1, 11B2, 12A1 chỉ đếm câu cùng khối và `bat`=CO; lớp "CLB" thấy toàn pool đang bật; không có trường `noiDung`, `dapAn`.
- **TC-4.3** `practiceStart` TU_TAO 10–2–3: đúng 15 câu thuộc bài đã chọn; JSON trả về không chứa `dapAn`, `loiGiai`, `maKho`.
- **TC-4.4** Nộp: điểm thang 10 đúng quy tắc chấm hiện hành; ghi `KetQuaLuyenTap` (điểm lưu dạng số); **KetQua không thêm hàng**; kết quả có lời giải.
- **TC-4.5** Bảng xếp hạng, `adminGradebook`, `adminExamStats`, gợi ý đề tương tự không đổi sau 5 bài luyện.
- **TC-4.6** CAU_SAI: sai X ở đề đã cho xem lời giải và Y ở bài luyện thì tập có X, Y; sai Z ở đề `SAU_HAN` còn mở thì không có Z; làm đúng Y lần sau thì Y bị rút.
- **TC-4.7** NHANH: bài đủ câu thì 7–1–2 và 600 s; bài thiếu thì bổ sung cùng chương, có thông báo.
- **TC-4.8** Token: token `a` gửi vào nhánh luyện tập bị từ chối; token `p` sửa `qids` bị từ chối; token `p` của học sinh khác (`sid` khác) bị từ chối; token `p` hết hạn bị từ chối; nộp lại cùng token không ghi thêm hàng.
- **TC-4.9** Xem lại bài luyện sau khi pool bị "thay" và một câu bị tắt: vẫn hiện đủ câu và lời giải; câu bị gỡ hẳn khỏi sheet (xóa tay) thì hiện "Câu đã bị gỡ".
- **TC-4.10** `CHO_LUYEN_TAP=KHONG`: gọi **trực tiếp** `practiceMeta`, `practiceStart`, `submitExam` token `p` đều báo lỗi; giao diện không có mục Luyện tập. `SERVER_COMPAT=1.0.0`: không có mục, các trang khác bình thường.
- **TC-4.11** Pool giả 3 000 câu (shim có `SHEET_READ_MS`): `practiceStart` chỉ đọc chỉ mục + các hàng được chọn (đếm số ô đọc); số ms để tham khảo.
- **TC-4.12** Sheet cũ không có `LuyenTap`/`KetQuaLuyenTap`: `practiceMeta` trả rỗng, không lỗi; lần ghi đầu tự tạo trang tính có tiêu đề.
- **TC-4.13** Câu X nằm trong pool và trong đề đang mở (mọi chế độ hiện lời giải, gồm `NGAY`/mặc định và `SAU_HAN`), đề chưa tới giờ mở, hoặc đề `NHAP`: 50 lần `practiceStart` (mọi kiểu) không lần nào có X, `practiceMeta` không đếm X; đóng đề xong thì X xuất hiện lại.
- **TC-4.14** Sửa đề sau khi học sinh làm (chèn câu lên đầu, đánh số lại): câu nhập tay bị lệch thì bỏ khỏi tập CAU_SAI; câu có `maKho` vẫn đúng.

## Kế hoạch kiểm thử
Node `tests/pha4.test.js` (TC-4.1 → 4.14 phần máy chủ). E2E: học sinh vào Luyện tập → tự tạo đề → nộp → xem lời giải → luyện câu sai → lịch sử lọc. Ảnh: trang Luyện tập, cây chọn bài, kết quả luyện, tab Pool có nhãn "đang thi".

## Rủi ro & cách giảm
- Lộ lời giải đề thi qua luyện tập: `blockedBankIds_` (TC-4.13) và điều kiện `canReveal_` (TC-4.6).
- Pool lớn làm chậm: chỉ mục + đọc theo hàng; tối đa khoảng 3 000 câu.
- Câu đề thi bị sửa: ưu tiên `maKho`; câu nhập tay dùng mã băm (TC-4.14).
- Phụ thuộc Pha 1 (đệm) và Pha 2 (`bankToQuestion_`, chép hình): Pha 4 bắt đầu sau khi hai pha đó được gộp.

## Việc giáo viên cần làm
Chạy `setup` (tạo 2 trang tính); chọn câu vào pool; đặt `CHO_LUYEN_TAP=CO`.

## Ước lượng: **L**

Sửa đặc tả ngày 18/11/2026: theo `soat-pha-0.md` S-2, S-6, S-7, S-12, S-16, S-17, S-23, S-30.

Sửa đặc tả ngày 19/11/2026: chặn cả đề đang mở ở mọi chế độ hiện lời giải; ẩn lời giải câu đang bị chặn khi xem lại bài luyện (theo `docs/bao-cao/pha-4-soat.md` R-1, R-2).
