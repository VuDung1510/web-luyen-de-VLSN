# Pha 4 — Luyện tập cho học sinh

## Mục tiêu
Học sinh tự tạo đề luyện từ một **pool luyện tập** do giáo viên chọn, luyện lại câu đã sai, và làm đề nhanh 10 phút theo bài. Bài luyện tập không vào bảng xếp hạng/bảng điểm. Học sinh không bao giờ đọc thẳng kho lớn, không bao giờ nhận đáp án trước khi nộp.

## Phạm vi
**Làm**: trang tính pool trong file web; đồng bộ pool từ kho (giáo viên); 3 kiểu đề luyện; lưu kết quả luyện tập riêng; trang "Luyện tập" cho học sinh; thống kê luyện tập cá nhân.
**Không làm**: bảng xếp hạng luyện tập; giao bài tập về nhà có hạn; Phần IV; học sinh tự chọn từng câu.

## Thiết kế kỹ thuật

### Dữ liệu (chỉ thêm trang tính mới; `setup()` tạo, ghi lần đầu cũng tự tạo)
- **`LuyenTap`** (pool): `maKho` Mã câu kho · `lop` Lớp · `chuong` Chương · `bai` Bài · `loai` Loại · `phan` Phần · `mucDo` Mức độ · `noiDung` · `hinhAnh` · `A`–`D` · `dapAn` · `saiSo` · `loiGiai` · `bat` Bật (CO/KHONG) · `capNhat`. Một hàng/câu, khóa `maKho`.
- **`KetQuaLuyenTap`**: cùng cột với KetQua + `kieu` Kiểu (TU_TAO / CAU_SAI / NHANH) + `cauHoi` Mã câu (JSON danh sách `maKho` hoặc `examId#stt`). Để riêng để KetQua (bảng điểm chính của giáo viên) không phình và leaderboard/gradebook không phải lọc (theo `cau-hoi-mo.md` câu 6).
- Pool lớn tối đa ~3 000 câu (ước ~3 KB/câu ⇒ ~9 MB đọc mỗi lần trượt đệm): đệm máy chủ theo **chỉ mục** nhẹ (`maKho, lop, chuong, bai, loai, mucDo`) riêng, câu đầy đủ đọc theo hàng cần dùng (`getRange` từng khối) — người làm đo và ghi lại.

### API (Code.gs → 1.4.0)
| Action | Ai | Tham số | Kết quả |
|---|---|---|---|
| `adminPracticeSync` | GV | `{maKho[]}` hoặc `{filter}` (như `adminBankList`), `mode: "them"` hoặc `"thay"` | `{them, capNhat, boQua:{khongDapAn, tuLuan}}` — chép từ kho qua `bankToQuestion_` (Pha 2), chép hình như Pha 2 |
| `adminPracticeList` | GV | `filter`, `page` | các câu trong pool + `bat` + số lượt HS đã làm |
| `adminPracticeToggle` | GV | `{maKho[], bat}` | `{n}` |
| `practiceMeta` | HS | — | `{ cay: [{chuong, bai, dem:{TN,DS,TL}}], soCauSai, nhanh:{TN,DS,TL,phut}, gioiHanNgay, daDungHomNay }` — **chỉ** của lớp HS (khớp `lop` theo khối "12"/"11" từ lớp "12A1"), không nội dung câu |
| `practiceStart` | HS | `{kieu, chuong[], bai[], so:{TN,DS,TL}, phut}` | giống `startExam`: `{attemptToken, durationSec, questions:[không dapAn/loiGiai/maKho], exam:{tieuDe}}`; token loại `p` chứa `qids` (đã ký) |
| `submitExam` (sửa) | HS | token `p` | chấm bằng câu tra theo `qids`, ghi `KetQuaLuyenTap`, trả kết quả **kèm lời giải ngay** |
| `myPracticeStats` | HS | — | số bài, điểm TB, theo chương/bài, câu sai còn lại |
| `getResult` (sửa) | HS/GV | `resultId` bắt đầu `LT` | tìm trong `KetQuaLuyenTap` |

### Ba kiểu đề
1. **TU_TAO**: HS chọn chương/bài + số câu mỗi phần (tổng 5–40) + thời gian (5–90 phút). Chọn ngẫu nhiên, ưu tiên câu HS chưa làm (dựa trên `KetQuaLuyenTap.cauHoi`).
2. **CAU_SAI**: tập câu HS đã sai (điểm < tối đa), từ (a) `KetQuaLuyenTap` theo `maKho`; (b) `KetQua.chiTiet` của đề thi chính theo `examId#stt` — **chỉ** đề đã cho xem lời giải (`canReveal_(e)` đúng) và đề còn tồn tại; câu đã làm đúng ở lần luyện sau thì rút khỏi tập. Tối đa 20 câu/lần, câu sai gần nhất trước.
3. **NHANH**: chọn 1 bài ⇒ mặc định 7 P1 + 1 P2 + 2 P3, 10 phút (CaiDat `LUYEN_NHANH`, vd `7,1,2,10`). Bài không đủ câu ⇒ lấy thêm cùng chương, báo cho HS.
- Thiếu câu ⇒ tạo đề ít câu hơn và nói rõ ("Bài này mới có 4 câu Phần I").
- Giới hạn chống lạm dụng (đề xuất thêm): `LUYEN_TAP_MOI_NGAY` (mặc định 30 lượt bắt đầu/HS/ngày, đếm bằng CacheService).
- CaiDat `CHO_LUYEN_TAP` (CO/KHONG) bật/tắt cả tính năng.

### Giao diện
- Học sinh: mục điều hướng "Luyện tập" (`#/luyen-tap`): 3 thẻ (Tự tạo đề · Luyện câu đã sai (n) · Đề nhanh 10 phút), bộ chọn chương→bài dạng cây có số câu, nút bắt đầu ⇒ dùng lại `runExam()` (không hỏi mục tiêu điểm — theo `cau-hoi-mo.md` câu 7) ⇒ trang kết quả có lời giải. Lịch sử có bộ lọc "Đề thi / Luyện tập".
- Giáo viên: trong tab Ngân hàng (Pha 2) nút "Đưa vào luyện tập"; tab con "Pool luyện tập" (danh sách, bật/tắt, số lượt làm); trang Kết quả có bộ lọc xem bài luyện tập của HS (chỉ xem).
- Máy chủ cũ / `CHO_LUYEN_TAP=KHONG`: không hiện mục "Luyện tập".

### Bảo mật
- `practiceMeta` không chứa nội dung câu. `practiceStart` chỉ trả các câu được chọn, không `dapAn/loiGiai/maKho` (dùng `qids` trong token đã ký `signToken_`).
- Token `p` không dùng được cho `startExam`; token `a` không dùng được ở nhánh luyện tập.
- HS không thể chọn câu cụ thể (chỉ chọn chương/bài/số lượng) ⇒ không dò từng câu để xem lời giải hàng loạt ngoài giới hạn ngày.

## Tiêu chí nghiệm thu
- **TC-4.1** `adminPracticeSync` từ kho giả: chỉ câu có đáp án, không Phần IV; chạy lại không nhân đôi hàng (khóa `maKho`); kho 0 lần ghi.
- **TC-4.2** `practiceMeta` của HS lớp 12A1 chỉ đếm câu `lop` = Lớp 12 và `bat`=CO; không chứa trường `noiDung`, `dapAn`.
- **TC-4.3** `practiceStart` TU_TAO 10–2–3: trả đúng 15 câu thuộc bài đã chọn; JSON trả về không chứa chuỗi đáp án của bất kỳ câu nào (quét `dapAn`, `loiGiai`, `maKho`).
- **TC-4.4** Nộp: điểm thang 10 đúng theo quy tắc chấm hiện hành; hàng ghi vào `KetQuaLuyenTap`; **KetQua không đổi số hàng**; kết quả trả kèm lời giải.
- **TC-4.5** Leaderboard, `adminGradebook`, `adminExamStats`, gợi ý đề tương tự không thay đổi sau 5 bài luyện tập.
- **TC-4.6** CAU_SAI: HS sai câu X ở đề thi đã cho xem lời giải và câu Y ở bài luyện ⇒ tập gồm X, Y; sai câu Z ở đề `hienLoiGiai=SAU_HAN` còn mở ⇒ Z **không** có; làm đúng Y ở lần sau ⇒ Y bị rút.
- **TC-4.7** NHANH: bài đủ câu ⇒ 7–1–2, thời gian 600 s; bài thiếu ⇒ bổ sung cùng chương và có thông báo.
- **TC-4.8** Token giả mạo `qids` (sửa payload) ⇒ bị từ chối; token `p` gửi `startExam` ⇒ lỗi.
- **TC-4.9** Lượt thứ 31 trong ngày ⇒ thông báo giới hạn (khi bật).
- **TC-4.10** `CHO_LUYEN_TAP=KHONG` hoặc `SERVER_COMPAT=1.0.0` ⇒ không có mục "Luyện tập", các trang khác bình thường.
- **TC-4.11** Pool giả 3 000 câu: `practiceStart` < 2 s trong shim khi đệm nóng; ghi số đo khi đệm nguội.
- **TC-4.12** Sheet cũ không có `LuyenTap`/`KetQuaLuyenTap` ⇒ `practiceMeta` trả rỗng, không lỗi; ghi lần đầu tự tạo trang tính có tiêu đề.

## Kế hoạch kiểm thử
Node `tests/pha4.test.js` (TC-4.1 → 4.9, 4.11, 4.12). E2E: HS vào Luyện tập → tự tạo đề → nộp → thấy lời giải → luyện câu sai → lịch sử lọc. Ảnh: trang Luyện tập (sáng/tối nếu Pha 5 xong), bộ chọn bài, kết quả luyện tập, tab Pool của giáo viên.

## Rủi ro & cách giảm
- Pool lớn làm chậm: chỉ mục nhẹ + đệm; giới hạn ~3 000 câu, quá thì cảnh báo giáo viên.
- Câu đề thi bị sửa sau khi HS làm (`replaceQuestions_` đánh số lại) ⇒ `examId#stt` lệch: ưu tiên `maKho`; câu nhập tay lệch thì bỏ khỏi tập câu sai (ghi chú trong README).
- Lộ lời giải đề thi đang mở qua "câu đã sai": điều kiện `canReveal_` (TC-4.6).
- Trùng lớp: quy ước lớp "12A1" ⇒ khối "Lớp 12" (lấy chữ số đầu); lớp đặt tên lạ ⇒ thấy toàn pool đang bật.

## Việc giáo viên cần làm
Chạy `setup` (tạo 2 trang tính mới); chọn câu vào pool; bật `CHO_LUYEN_TAP`.

## Ước lượng: **L**
