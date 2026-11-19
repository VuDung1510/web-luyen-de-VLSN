# Soát code Pha 4 — Luyện tập cho học sinh

Người soát: độc lập (không phải người làm). Nhánh `pha-4-luyen-tap` (commit `e2ae46a`), so với `main` (`git diff main...pha-4-luyen-tap`).
Ngày: 19/11/2026.

## Tóm tắt cho giáo viên
- Phần lớn đã làm đúng. Học sinh không nhận đáp án trước khi nộp. Bài luyện không vào bảng xếp hạng hay bảng điểm. Kho câu hỏi không bị ghi. Máy chủ cũ 1.0.0 vẫn chạy bình thường. Khi thầy tắt Luyện tập, máy chủ cũng chặn chứ không chỉ ẩn nút.
- **Còn một lỗ hổng cần sửa trước khi gộp.** Đề thi để "Hiện lời giải: Ngay sau khi nộp" (đây là mặc định) và đang mở thì câu của đề vẫn xuất hiện trong Luyện tập. Học sinh **chưa làm đề** có thể luyện đúng câu đó và xem đáp án, lời giải trước khi vào thi.
- Thêm hai điểm nên sửa. Khi xem lại bài luyện cũ, học sinh vẫn thấy đáp án của câu vừa được đưa vào đề đang thi. Khi số bài luyện nhiều lên, mỗi lần mở Luyện tập sẽ đọc lại toàn bộ trang `KetQuaLuyenTap`, nên trang sẽ chậm dần.

## Kết luận: **CHƯA ĐẠT**
Có 1 phát hiện **Nặng** (R-1). R-1 do đặc tả chưa nói rõ trường hợp này, nên cần kiến trúc sư chốt cách hiểu. Nên sửa thêm 2 phát hiện **Vừa** (R-2, R-3) trong cùng vòng. Các phát hiện còn lại đều Nhẹ.

## Đã kiểm
- **Test chạy lại**:
  - `pha4.test.js` 17/17.
  - `backend` 13/13, `importer` đạt, `bank` 30/30, `cache` 17/17.
  - `pha1-kiem-thu` 29/29, `pha2-kiem-thu` 31/31, `common-cache` 5/5.
  - `pha4.e2e.js` chạy với `PORT_NEW=PORT_OLD=8795` (hai chế độ chạy lần lượt), ảnh lưu vào thư mục nháp: **tất cả đạt** ở cả máy chủ mới và `SERVER_COMPAT=1.0.0`.
  - Chưa chạy `docx`, `pha3-kiem-thu`, `e2e.js`, `bank.e2e.js`, vì người kiểm thử dùng chung thư mục và các test này cố định cổng.
- **Đường học sinh gọi được**:
  - `practiceMeta` chỉ trả cây chương/bài và số đếm.
  - `practiceStart` trả câu không có `dapAn`/`loiGiai`/`maKho` (`Code.gs` 2357–2360).
  - `publicConfig` chỉ thêm cờ `practice`.
  - `myResults loai=luyen` dùng `resultSummary_`.
  - `getResult LT…` kiểm tra `studentId` (581–585).
  - `bootstrap` không đổi.
  - localStorage của học sinh chỉ chứa câu chưa có đáp án.
- **Chặn câu đang thi** (`examLocked_` 1978, `blockedBankIds_` 1990):
  - Đã chặn câu của đề NHAP, đề chưa tới giờ mở và đề có `canReveal_` = false, ở cả TU_TAO, NHANH (kể cả phần lấy thêm cùng chương, vì cùng lấy từ `practiceCandidates_`) và CAU_SAI. CAU_SAI lọc thêm ở `resolve` và lọc lần cuối ở `practiceStart` (2352–2353).
  - Đệm theo thế hệ `DeThi` + `CauHoi`; `adminSaveExam`/`adminDeleteExam` đổi thế hệ qua `afterWrite_`; khóa đệm hết hạn ở mốc mở/đóng gần nhất. Đúng.
  - Lỗ hổng còn lại: đề có lời giải "NGAY" đang mở (R-1).
- **Token `p`**:
  - Ký HMAC chung bí mật với token `a`, kiểm `t === 'p'`.
  - Sửa `qids`, `sid` khác hoặc token hết hạn đều bị từ chối (TC-4.8).
  - Token `a` không đọc được thành `p` và ngược lại.
  - Nộp lại: mã bài cố định theo `pid`; trước khi ghi, đọc thẳng cột "Mã bài" trong khóa → không thêm hàng.
  - Token chứa `maKho`: R-4.
- **Dữ liệu**:
  - Chỉ thêm 2 trang tính và các khóa CaiDat. KetQua giữ nguyên cột, `chiTiet` chỉ thêm trường `k`, `h`.
  - Phần Pha 4 không có `deleteRow`/`clearContent` nào.
  - `poolWrite_` và `adminPracticeToggle_` đọc thẳng Sheet trong `withLock_`, ghi theo chỉ số của chính lần đọc đó. Toggle chỉ ghi ô Bật và Cập nhật.
  - Sheet cũ thiếu trang: đọc = rỗng; lần ghi đầu tự tạo trang, có tiêu đề và định dạng `@` và số (`createOptionalSheet_`).
  - Kho 0 lần ghi (TC-4.1 `extWrites = {}`).
  - TC-4.5 so khớp bảng xếp hạng, bảng điểm, thống kê đề, `myStats`.
- **Máy chủ 1.0.0 / tắt luyện tập**:
  - `requirePracticeOn_` có ở `practiceMeta`, `practiceStart` và `practiceSubmit_`.
  - Giao diện ẩn mục Luyện tập khi thiếu `features.practice` hoặc `pub.practice` = false.
  - Kết quả e2e ở hai chế độ đều đạt.
- **Phiên bản**:
  - `APP_VERSION = '1.4.0'`, `FEATURES` có `"practice"`.
  - `EDITABLE_SETTINGS` có 2 khóa mới.
  - Báo cáo người làm có mục "Việc giáo viên cần làm" (dán Code.gs, Phiên bản mới, `setup`, bật CHO_LUYEN_TAP).
- **R-12**:
  - `bankImageNames_` giữ đúng hành vi cũ với ô chỉ có 1 hình. Đã đối chiếu `main`: ô có dấu cách trong tên, ô "Có" không có tên, ô "Không" đều cho kết quả như cũ.
  - `bankFetch_` được `adminBankToQuestions` và `adminPracticeSync` dùng chung. Test Tạo đề Pha 2 (`bank`, `pha2-kiem-thu`) vẫn đạt.
- **XSS**:
  - Giao diện mới (`app.js` trang Luyện tập, `admin.js` tab Pool và hộp "Đưa vào luyện tập", `common.js` câu bị gỡ) đưa mọi chuỗi qua `esc()` hoặc `rich()`: tên chương/bài, `thongBao`, mã câu, cảnh báo.
  - Các giá trị không escape đều là số hoặc lấy từ bảng tra (`lop`, `soLuot`, `PRACTICE_KIEU`, `TYPES`).
- **Test cũ người làm đã sửa**: `cache.test.js` và `bank.test.js` chỉ đổi số phiên bản 1.3.0 → 1.4.0 và thêm `practice` vào `features`. Hợp lệ.
- **Hạ tầng test**: `dev-server.js` mặc định bật luyện tập và nạp sẵn pool. Có biến `PRACTICE=0` để tắt. Hợp lệ.

## Đánh giá 8 chỗ lệch đặc tả của người làm
| # | Chỗ lệch | Đánh giá |
|---|---|---|
| 1 | Chặn thêm đề chưa tới giờ mở | Đồng ý. Chặt hơn đặc tả và cần thiết, vì `canReveal_` trả true cho đề SAU_HAN chưa mở. Nhưng đề "NGAY" đang mở vẫn chưa chặn, xem R-1 |
| 2 | CAU_SAI tìm lại câu kho theo mã | Đồng ý. Vẫn kiểm `blocked[k]` và đề còn công khai (`open(eid)`) |
| 3 | KetQua cũ không có mã băm: so cột Cập nhật của đề | Đồng ý. Cách làm thận trọng; câu kho trong KetQua cũ (chưa có `k`) bị bỏ, chấp nhận được |
| 4 | Token `p` chứa `qids` dạng base64 | Chấp nhận, xem R-4 (Nhẹ) |
| 5 | `CHO_LUYEN_TAP` mặc định KHONG | Đồng ý. An toàn hơn; mục "Việc giáo viên cần làm" đã ghi bước bật |
| 6 | `adminPracticeList` chỉ tìm theo mã câu | Đồng ý. Đúng yêu cầu chỉ mục không giữ nội dung |
| 7 | Thời gian mặc định của CAU_SAI và TU_TAO | Đồng ý. Máy chủ vẫn kẹp trong 5–90 phút |
| 8 | `publicConfig.practice` | Đồng ý. Chỉ là cờ bật/tắt, không lộ dữ liệu |

## Bảng phát hiện

### R-1 — **Nặng** — Câu của đề "Hiện lời giải: Ngay sau khi nộp" đang mở vẫn vào luyện tập
- **Vị trí**: `apps-script/Code.gs` 1978–1985 (`examLocked_`). Test `tests/pha4.test.js` 466–468 khẳng định hành vi này ("đề công bố lời giải ngay: không chặn").
- **Mô tả**: `examLocked_` chỉ chặn đề NHAP, đề chưa mở và đề có `canReveal_(e)` = false. Với `hienLoiGiai = NGAY`, đây là **mặc định** (`admin.js` 226, `examOut_`), `canReveal_` luôn trả true. Vì vậy câu kho nằm trong một đề đang mở không bị chặn. Học sinh chưa làm đề vẫn tự tạo đề luyện có câu đó, nộp bài luyện và thấy `dapAn` + `loiGiai`, rồi mới vào thi. Lời giải của đề "NGAY" chỉ được công bố cho người **đã nộp**, nên điều này trái với `QUYET-DINH` ("Câu thuộc đề thi chưa công bố lời giải không xuất hiện trong luyện tập…") và mục tiêu Pha 4. Tình huống rất dễ gặp: thầy đưa cả chương vào pool rồi tạo đề kiểm tra từ kho cùng chương.
- **Tái hiện**: `scratchpad/soat4/repro.js` (mục A).
  1. Lưu đề `MO`, `hienLoiGiai: NGAY`, `ketThuc` sau 1 giờ, chứa câu X có trong pool.
  2. Học sinh HS0001 chưa làm đề, gọi `practiceStart` TU_TAO.

  Kết quả: `blockedBankIds_()[X] = false`; X xuất hiện 11/30 lần; nộp bài luyện trả `dapAn = "A"` kèm `loiGiai`.
- **Đề xuất**: chặn cả khi đề đang mở, bất kể `hienLoiGiai`. Tức là `examLocked_` trả true khi `examStatus_(e).open`, ngoài các điều kiện hiện có. Câu được mở lại khi đề đóng hoặc hết hạn và `canReveal_` = true. Hệ quả cần chấp nhận: đề không có giờ đóng sẽ chặn câu cho tới khi thầy đóng đề. Trang Pool đã có nhãn "đang thi" để giải thích việc này. Cần kiến trúc sư chốt cách hiểu trong đặc tả (TC-4.13 thêm trường hợp "NGAY đang mở"), rồi sửa test 466–468.

### R-2 — **Vừa** — Xem lại bài luyện cũ vẫn lộ đáp án câu vừa bị đưa vào đề đang thi
- **Vị trí**: `Code.gs` 2435–2470 (`buildPracticeView_`), 2386–2433 (`practiceSubmit_`).
- **Mô tả**:
  - Với câu lấy từ đề thi (`examId#stt`), `buildPracticeView_` có ẩn nội dung khi đề bị khóa.
  - Với câu từ pool (qid = `maKho`) thì **không** kiểm `blockedBankIds_`. Học sinh luyện X tuần trước; hôm nay thầy tạo đề thi có X. Trong giờ thi, học sinh mở Lịch sử → Luyện tập → bài cũ và thấy đáp án, lời giải của X.
  - Cũng vậy với bài luyện bắt đầu trước khi X bị chặn rồi nộp sau đó: token sống tới thời gian làm + 6 giờ.
- **Tái hiện**: `repro.js` mục B. Đưa X vào đề SAU_HAN đang mở: `blocked[X] = true`, nhưng `getResult` bài luyện cũ vẫn trả `dapAn = "A"`, có `loiGiai`.
- **Đề xuất**: trong `buildPracticeView_`, khi `role === 'student'` và `q.maKho && blockedBankIds_()[q.maKho]`, bỏ `dapAn`/`loiGiai`. Có thể giữ nội dung và hiện ghi chú "Lời giải tạm ẩn vì câu đang nằm trong đề thi chưa công bố lời giải". `practiceSubmit_` dùng chung hàm này nên được sửa luôn. Thêm một TC vào TC-4.13.

### R-3 — **Vừa** — Mỗi thao tác luyện tập đọc toàn bộ `KetQuaLuyenTap` (và `KetQua`)
- **Vị trí**: `Code.gs` 2207–2214 (`wrongList_`), 2257 (`practiceMeta`), 2319 (`practiceStart`), 2405 và 2429 (`practiceSubmit_`), 2577 (`practiceUsage_`), 562 và 571 (`myResults`/`getResult`).
- **Mô tả**: theo đếm trên shim, khi đệm trống:
  - `practiceMeta` đọc cả trang KetQuaLuyenTap, KetQua, DeThi, CauHoi;
  - `practiceStart` đọc cả trang KetQuaLuyenTap;
  - nộp bài đọc cả trang KetQuaLuyenTap 2 lần.

  Đệm chỉ giữ bảng ≤ 900 KB. Mỗi bài luyện có `chiTiet` khoảng 1,5–3 KB, nên chừng 300–600 bài luyện (một lớp 40 em, 1–2 tuần) là vượt ngưỡng. Từ lúc đó mọi lần mở Luyện tập, bắt đầu hay nộp đều `getDataRange` toàn trang, và trang chậm dần theo thời gian. Bảng TC-4.11 chỉ đo `LuyenTap`, không đo trang kết quả. Rủi ro này lớn hơn ghi chú "`practiceUsage_` chậm dần" trong báo cáo người làm.
- **Tái hiện**: `repro.js` mục C, in `reads` theo trang.
- **Đề xuất** (chọn một):
  - đọc riêng cột "Mã HS" rồi chỉ đọc các hàng của học sinh đó (như `readRowRuns_`);
  - hoặc đệm theo từng học sinh (tập câu đã làm và câu sai) với khóa thế hệ `KetQuaLuyenTap`.

  Tối thiểu: đưa số đo với 5 000 hàng KetQuaLuyenTap vào báo cáo và danh sách kiểm tra Pha 6.

### R-4 — Nhẹ — Token `p` lộ mã câu kho
- **Vị trí**: `Code.gs` 2346–2349.
- **Mô tả**: phần thân token là base64 không mã hóa. Học sinh giải mã được `qids` (vd `L12C2B01-P1-00010`, `DE…#3`). Mã câu không dẫn tới đáp án: kho là file riêng, chữ ký ngăn sửa token, `startExam` không trả mã kho. Chỉ lộ cấu trúc mã (lớp, chương, bài). Đặc tả đã cho phép.
- **Đề xuất**: chấp nhận. Nếu muốn kín hơn thì thay `qids` bằng chỉ số và lưu danh sách câu trong CacheService kèm dự phòng, hoặc mã hóa thân token.

### R-5 — Nhẹ — Tìm bài đã nộp chỉ theo mã bài, không kiểm học sinh
- **Vị trí**: `Code.gs` 2372–2384 và 2392–2396.
- **Mô tả**: mã bài gồm giây bắt đầu + 6 ký tự hex của `pid`, tức 24 bit. Nếu hai lượt trùng mã (xác suất rất nhỏ), lượt sau sẽ bị coi là "đã nộp", và `view()` trả kết quả của **học sinh khác**.
- **Đề xuất**: `view()` lọc thêm `x.studentId === st.id`; lấy 10–12 ký tự của `pid`.

### R-6 — Nhẹ — Giới hạn pool 3 000 câu chỉ áp cho từng lần đưa
- **Vị trí**: `Code.gs` 2500.
- **Mô tả**: nhiều lần "Thêm" vẫn làm pool vượt 3 000 câu. Chỉ mục vẫn đệm được (tối đa 2 MB), nên chưa gây lỗi; chỉ là khác con số trong đặc tả.
- **Đề xuất**: cảnh báo trong kết quả khi tổng số câu đang bật vượt `POOL_MAX`.

## Việc người làm cần làm ở vòng 2
1. Sửa R-1 theo cách kiến trúc sư chốt; thêm trường hợp "NGAY đang mở" vào TC-4.13.
2. Sửa R-2; thêm test xem lại bài luyện cũ khi câu đang bị chặn.
3. R-3: đọc theo học sinh hoặc đệm theo học sinh, hoặc ít nhất đo và ghi rủi ro.
4. R-5 (một dòng). R-4 và R-6 tùy chọn.
