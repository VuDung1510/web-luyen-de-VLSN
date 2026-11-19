# Pha 4 — Báo cáo kiểm thử (người kiểm thử, độc lập)

Nhánh `pha-4-luyen-tap`, code tính năng ở commit `e2ae46a` (Code.gs 1.4.0). Đặc tả theo bản bổ sung `46739d8` (19/11/2026: chặn câu của đề đang mở ở mọi chế độ hiện lời giải, R-1; ẩn lời giải câu đang bị chặn khi xem lại bài luyện, R-2). Ngày 19/11/2026.

## Tóm tắt cho giáo viên
- **Kết luận: CHƯA ĐẠT.** 13/14 TC đạt. Riêng TC-4.13 chưa đạt ở điều mới bổ sung ngày 19/11.
- **Lỗi chính (K-1, Nặng):** câu nằm trong đề **đang mở** với chế độ "Hiện lời giải ngay sau khi nộp" (chế độ mặc định) vẫn hiện trong Luyện tập, kèm đáp án và lời giải sau khi nộp. Học sinh làm trước có thể luyện câu này rồi báo đáp án cho bạn chưa thi. Đề nháp, đề "Sau hạn", đề "Không hiện" và đề chưa tới giờ mở thì chặn đúng.
- **Lỗi thứ hai (K-2, Vừa):** bài luyện đã làm từ trước, nếu mở lại đúng lúc câu trong bài đó đang có trong đề thi, vẫn hiện đáp án và lời giải của câu đó.
- **Phần còn lại chạy đúng:**
  - Học sinh tự tạo đề, luyện câu sai, làm đề nhanh 10 phút, có lời giải ngay sau khi nộp.
  - Bảng xếp hạng, bảng điểm và thống kê đề không đổi sau các bài luyện.
  - Trước khi nộp, trình duyệt không nhận đáp án.
  - Tắt luyện tập hoặc dùng máy chủ cũ thì mục Luyện tập biến mất, các trang khác vẫn bình thường.
- **Cách sửa:** cả hai lỗi sửa được trong `Code.gs`, mỗi lỗi vài dòng (xem chẩn đoán bên dưới).

## Cách kiểm
- **`tests/pha4-kiem-thu.test.js`** (Node, hộp đen qua `doPost` của gas-shim): **24/26 mục đạt**. 2 mục KHÔNG ĐẠT là K-1 và K-2.
  - Kho giả lấy từ `tests/fixtures/kho-gia.js` (kho chuẩn, `bigRows` 60–3 000 câu, kho nhỏ tự dựng để biết trước kết quả).
  - Đối chiếu bằng cách đọc thẳng trang tính giả (`LuyenTap`, `KetQua`, `KetQuaLuyenTap`).
  - Riêng TC-4.8 dùng khóa `SECRET` của shim để ký token "đúng chữ ký" (hết hạn, đổi loại token). Có kiểm đối chứng: ký lại payload gốc thì ra đúng token của máy chủ.
- **`tests/pha4-kiem-thu.e2e.js`** (Playwright): **20/20 nhóm đạt**, chạy ở 3 chế độ, dev-server tự khởi động cho từng chế độ:
  - máy chủ mới, cổng 8790, pool = kho giả;
  - `PRACTICE=0` (`CHO_LUYEN_TAP=KHONG`), cổng 8791;
  - `SERVER_COMPAT=1.0.0`, cổng 8792.
  - Cả ba đều có `LATENCY_MS=150`; route CDN như `routeCdn` của Pha 2.
  - Ghi lại mọi phản hồi `/exec`, `localStorage` và `sessionStorage` để kiểm lộ đáp án trước khi nộp.
- **Thứ tự làm:** kịch bản viết theo đặc tả và giao diện chạy được. Selector lấy bằng cách xem DOM của trang đang chạy.
  - Chỉ đọc `Code.gs` (`examLocked_`, `blockedBankIds_`, `buildPracticeView_`) sau khi đã chạy xong, để chẩn đoán K-1 và K-2.
  - Không đọc `assets/js/*.js` và `tests/pha4*.js` của người làm.
- **Hạ tầng test:** không sửa `gas-shim.js` và `dev-server.js`, không sửa code tính năng, không commit.
- **Lệnh chạy:**
  - `node tests/pha4-kiem-thu.test.js`
  - `NODE_PATH=$(npm root -g) LIBS_DIR=<node_modules có katex, chart.js> node tests/pha4-kiem-thu.e2e.js all`

## Bảng TC

| TC | Kết quả | Bằng chứng |
|---|---|---|
| TC-4.1 | **ĐẠT** | Đồng bộ toàn kho chuẩn → pool **47** hàng, đúng bằng tập câu dùng được của `adminBankList`. 0 câu thiếu đáp án, 0 câu P IV. `boQua` = `{khongDapAn:5, tuLuan:1, khac:1}`. Chỉ định riêng câu P IV + câu thiếu đáp án → bị từ chối, không thêm. Chạy lại → `them=0`, số hàng giữ nguyên. Sửa nội dung 1 câu trong kho → `capNhat=1`, nội dung pool cập nhật. "thay" bằng 5 câu → `tat=42`, số hàng vẫn 47 (chỉ đổi cột Bật). Ghi vào file kho: **0 lần** |
| TC-4.2 | **ĐẠT** | Pool có thêm 3 câu "Lớp 10"; tắt 3 câu lớp 12. Kết quả: 10A1 → 3, 11B2 → 3, 12A1 → 41, CLB → 47, khớp từng khối với các hàng `Bật=CO`; số câu Phần I cũng khớp. JSON không có `noiDung` / `dapAn` / `loiGiai` / `maKho` / `A` / `B`, không chứa mã câu hay nội dung câu nào. Có đủ `cay`, `soCauSai`, `nhanh`, `soBai`, `diemTB` |
| TC-4.3 | **ĐẠT** | Pool 300 câu, chọn Bài 1, 10–2–3, 20 phút, chạy 5 lần: mỗi lần đúng 15 câu (10 TN, 2 DS, 3 TL), không trùng câu, tất cả thuộc bài đã chọn, `durationSec=1200`. JSON không có khóa `dapAn` / `loiGiai` / `maKho`, không có mã câu kho hay lời giải ở bất kỳ đâu, không có trường nào mang giá trị đáp án. Token `p` (giải mã base64) có `t, pid, sid, kieu, qids, st, dur, exp, goal, td`, không có đáp án. Giới hạn: 4 câu và 41 câu bị từ chối ("Tổng số câu phải từ 5 đến 40."); 4 phút → kẹp lên 300 s; 91 phút → kẹp xuống 5 400 s; `mucTieu=11` và kiểu lạ bị từ chối. **Ưu tiên câu chưa làm:** bài có 12 câu, làm 6 câu → lần sau 0 câu trùng. E2E: tick 1 bài → giao diện gửi `bai=["Bài 9…"]`, không gửi `chuong`; đề 10 câu đều thuộc Bài 9 (ảnh `kt-02`, `kt-03`) |
| TC-4.4 | **ĐẠT** | Bài 10–2–3: 5 TN đúng, DS1 đúng 3/4 ý, DS2 đúng hết, 1/3 TL đúng → `diemGoc 3`, `diemToiDa 5,25`, `diem 5,71` (tính tay đúng). `KetQua` **không thêm hàng**, `KetQuaLuyenTap` +1. Cột Điểm và Điểm gốc là **số**; cột Kiểu = `TU_TAO`. `chiTiet` có 15 mục, mỗi mục có `q` = maKho. Kết quả trả về 15/15 câu có `dapAn` + `loiGiai`. Mục tiêu 9 được so (chưa đạt, −3,29). Làm đúng hết → 10. E2E: 10 câu, điểm hiện "6,25", đúng như tính tay 2,5/4; trang `#/ket-qua/LT…` có nhãn "Luyện tập · không tính vào bảng xếp hạng" và 10 lời giải (ảnh `kt-04`, `kt-05`) |
| TC-4.5 | **ĐẠT** | Có dữ liệu thi thật (2 HS làm Đề mẫu). Chụp trước và sau 5 bài luyện, so `deepStrictEqual` **giống hệt** ở 8 mục: `leaderboard` (HS theo đề, HS tất cả, GV), `adminGradebook`, `adminExamStats`, `myResults` mặc định, `listExams`, số hàng KetQua. Gợi ý đề tương tự (`goal.goiY`) trước và sau giống nhau. E2E: trang Xếp hạng không có bài luyện |
| TC-4.6 | **ĐẠT** | X sai ở đề NGAY **đã đóng**, X2 là câu nhập tay của đề đó, Y sai ở bài luyện, Z và Z2 sai ở đề SAU_HAN đang mở. Tập câu sai = {X, X2, Y} (3 câu, `soCauSai=3`); không có Z, Z2; không lộ đáp án. Bài CAU_SAI ghi Kiểu `CAU_SAI`. Làm đúng Y → Y rút khỏi tập, X còn. Đóng đề SAU_HAN → Z, Z2 vào tập. Xóa đề NGAY → X2 (`examId#stt`) ra khỏi tập, X (theo maKho) vẫn còn. 25 câu sai → đề CAU_SAI 20 câu, có đủ 10 câu sai gần nhất. Chưa có câu sai → "Bạn chưa có câu sai nào để luyện lại." E2E: thẻ "Luyện câu đã sai (3)" → đề 3 câu → làm đúng → thẻ về "(0)" (ảnh `kt-06`). *Đề NGAY phải đóng trước, vì theo đặc tả 19/11 câu của đề đang mở bị chặn* |
| TC-4.7 | **ĐẠT** | `practiceMeta.nhanh` = 7/1/2/10. Bài đủ câu → 7–1–2, 600 s, đúng bài. Bài thiếu (4 P1, 0 P2, 1 P3) → vẫn 7–1–2, phần bù lấy cùng chương, 3 thông báo "Bài này mới có 4 câu Phần I; lấy thêm 3 câu cùng chương." … Đổi `LUYEN_NHANH=5,2,1,8` → đề 5–2–1, 480 s. Cả chương cũng thiếu → đề 5 câu, báo "…cả chương cũng chỉ có 0 câu (cần 2)". E2E: Bài 9 → 7–1–2, đồng hồ 09:59. Bài 11 (3·0·0) → 10 câu cùng chương, hộp vàng báo thiếu (ảnh `kt-07`) |
| TC-4.8 | **ĐẠT** | Các trường hợp sau đều bị từ chối "Lượt làm bài không hợp lệ hoặc đã quá hạn.": sửa / bớt / đảo `qids` (giữ chữ ký); chữ ký của token khác; HS khác nộp token; token hết hạn **ký đúng khóa**; sửa `exp` (giữ chữ ký); token `a` đổi `t=p`; token `p` đổi `t=a`; token đăng nhập dùng làm attemptToken. Không ghi hàng nào. Token `a` ký đúng khóa nhưng gắn thêm `qids` được chấm như đề thi bình thường, **không** vào KetQuaLuyenTap. Nộp lại cùng token → trả lại bài cũ (cùng id, cùng điểm), KetQuaLuyenTap không thêm hàng |
| TC-4.9 | **ĐẠT** | Làm bài 7 câu, sau đó "thay" pool bằng 3 câu khác và tắt thêm 1 câu của bài. `getResult` (HS và GV) vẫn hiện đủ 7/7 câu, có nội dung + đáp án + lời giải, điểm giữ nguyên. HS khác không xem được. Xóa tay 1 hàng khỏi `LuyenTap` → đúng 1 câu "Câu đã bị gỡ khỏi ngân hàng."; 6 câu còn lại đúng nội dung (chỉ mục không lệch hàng). `myResults loai:"luyen"` có bài, `loai` mặc định không có |
| TC-4.10 | **ĐẠT** | Đặt `CHO_LUYEN_TAP=KHONG` rồi gọi thẳng 5 lời: `practiceMeta`, `practiceStart` TU_TAO / CAU_SAI / NHANH, `submitExam` token `p` lấy trước khi tắt. Cả 5 đều báo "Giáo viên đang tắt luyện tập.", không ghi hàng. `publicConfig.practice=false`; vẫn thi bình thường. E2E `PRACTICE=0`: không có mục Luyện tập trên thanh điều hướng, không có thẻ ở trang chủ; mở thẳng `#/luyen-tap` → "Mục Luyện tập hiện chưa mở…", không có cây chọn bài; 4 trang khác bình thường; trang quản trị ghi "Mục Luyện tập đang tắt với học sinh." (ảnh `kt-13`, `kt-14`, `kt-15`). E2E 1.0.0: không có mục, không có lời gọi `practice*`, các trang khác bình thường. Đề mẫu nộp được, 0 toast đỏ, 0 lỗi JS. Tab Ngân hàng "Cần cập nhật máy chủ", không có tab Pool hay nút "Đưa vào luyện tập" (ảnh `kt-16`, `kt-17`) |
| TC-4.11 | **ĐẠT** | Pool 3 000 câu × 18 cột (cả trang 54 018 ô), đề 40 câu. Lần 1 (đệm trống): đọc **21 738 ô** = chỉ mục 7 cột × 3 001 hàng + 40 hàng × 18 cột; `getDataRange` = 0; 17 ms. Lần 2 (có đệm): **738 ô** (chỉ 40 hàng được chọn); 7 ms. Nộp: 1 458 ô; xem lại: 738 ô; `practiceMeta`: 0 ô. Với `SHEET_READ_MS=300`: `practiceStart` 4 ms, vì không có lần đọc cả trang |
| TC-4.12 | **ĐẠT** | Xóa trang `LuyenTap`, `KetQuaLuyenTap` và dòng `LUYEN_NHANH`. `practiceMeta` → `cay: []`, `soCauSai: 0`, `nhanh` về mặc định 7/1/2/10, không lỗi. `practiceStart` → "Chưa có câu nào phù hợp trong pool luyện tập…"; `myResults luyen` = [], `adminPracticeList` chạy được. Đồng bộ lần đầu tự tạo `LuyenTap` có tiêu đề; nộp lần đầu tự tạo `KetQuaLuyenTap` có tiêu đề, điểm là số. KetQuaLuyenTap cũ thiếu cột "Kiểu" → vẫn ghi được, tự thêm cột cuối |
| TC-4.13 | **KHÔNG ĐẠT** | 7 trường hợp. Mỗi trường hợp gọi 50 lần `practiceStart`: 30 TU_TAO (trong đó có đề 40 câu lấy cả pool), 10 NHANH, 10 CAU_SAI. Bài của X chỉ có 5 câu P1, nên nếu không bị chặn thì X gần như chắc chắn được chọn. **Đạt (X 0/50 lần, meta không đếm X, mở khóa thì X trở lại, Pool gắn nhãn "đang thi"):** đề SAU_HAN đang mở; đề NHAP (SAU_HAN và NGAY); đề SAU_HAN "Mở lúc" tương lai; đề KHONG; đề NGAY "Mở lúc" tương lai. **Không đạt:** đề **NGAY đang mở** (bổ sung 19/11) → X xuất hiện **50/50 lần**, meta đếm X, không có nhãn "đang thi" (**K-1**). **R-2 không đạt** ở cả 7 trường hợp: bài luyện cũ có X, xem lại lúc X đang bị chặn → hiện đáp án + lời giải của X. Bắt đầu bài luyện có X, giáo viên đưa X vào đề đang mở, rồi nộp → kết quả cũng hiện đáp án X (**K-2**). E2E (đề SAU_HAN): HS thấy 43 câu trước và sau khi GV thêm lại X; đóng đề → 44 câu |
| TC-4.14 | **ĐẠT** | Đề (NGAY, HS làm xong thì đóng) gồm M (nhập tay), X (maKho), N (nhập tay), HS sai cả 3. GV chèn câu mới lên đầu, đánh số lại. Tập câu sai còn **[X]**: M và N (lệch vị trí) bị bỏ, câu mới chèn (HS chưa làm) không lọt vào. Làm đúng → 10 điểm. Sửa chữ câu nhập tay tại chỗ → câu đó bị bỏ, câu còn lại giữ |

**Ngoài TC (đã kiểm, đạt):**
- **Phân quyền:** HS gọi `adminPracticeSync` / `List` / `Toggle` bị từ chối; chưa đăng nhập thì không gọi được `practiceMeta` / `practiceStart`.
- **Phiên bản:** `features` có `practice`; `APP_VERSION` 1.4.0.
- **Trang tính:** `setup` tạo 2 trang tính mới; KetQuaLuyenTap = các cột của KetQua + "Kiểu".
- **Mạng phía học sinh (e2e):** trước khi nộp có 7 phản hồi `/exec` (gồm `practiceStart`), không có `dapAn` / `loiGiai` / `maKho` / `mucDoY`, mã câu kho hay lời giải. `localStorage` và `sessionStorage` sạch.
- **Giáo viên (e2e):**
  - "Đưa vào luyện tập" có hộp chọn Thêm / Thay. Sau khi thêm, báo "1 câu đang thi (…): đã thêm nhưng học sinh chưa thấy…" kèm mã câu (ảnh `kt-10`, `kt-10b`).
  - Tab Pool: lọc "Đang thi" ra đúng X, có nhãn (ảnh `kt-11`); có số lượt làm.
  - Nút "Tắt" trên dòng → HS thấy bớt 1 câu. "Chọn cả trang" + "Bật" → bật lại (ảnh `kt-12`).
- **Điện thoại 390×844:** trang Luyện tập không tràn ngang (ảnh `kt-09`).
- **Lỗi JS:** 0 `pageerror` hoặc `console.error` ở cả 3 chế độ.

## Lỗi

### K-1 (Nặng) — câu của đề đang mở chế độ "Ngay sau khi nộp" không bị chặn khỏi luyện tập
- **Tái hiện:**
  - Câu X có trong pool. GV tạo đề `trangThai=MO`, `hienLoiGiai=NGAY` (chế độ mặc định) chứa X.
  - 50/50 lần `practiceStart` có X. `practiceMeta` đếm X. `adminPracticeList` không gắn nhãn đang thi cho X.
  - Sau khi nộp bài luyện, HS nhận đáp án + lời giải của X trong khi bạn khác chưa thi đề.
  - Lệnh: `node tests/pha4-kiem-thu.test.js`, mục "TC-4.13 X trong đề NGAY đang mở".
- **Chẩn đoán** (đọc code sau khi chạy):
  - `apps-script/Code.gs:1978` `examLocked_()` chỉ khóa đề khi: NHAP; hoặc `!canReveal_(e)`; hoặc chưa tới `batDau`.
  - Với NGAY, `canReveal_` (`Code.gs:3053`) luôn trả `true`, nên đề NGAY đang mở không bị khóa.
  - Đúng theo đặc tả cũ, nhưng trái bản bổ sung 19/11 (R-1): chỉ mở khi đề **đã đóng** và `canReveal_` = true.
- **Đề xuất:** trong `examLocked_`, thêm điều kiện khóa khi `examStatus_(e).open` (còn mở).
  - Ghi chú: hiện đề `DONG` mà "Mở lúc" vẫn ở tương lai thì vẫn bị khóa (kiểm ở TC-4.13). Điều này chấp nhận được, chỉ ghi để người làm biết.
  - `blockedBankIds_` đã đệm theo mốc `batDau`/`ketThuc` gần nhất, nên khi đề hết hạn câu sẽ tự mở mà không cần sửa thêm.

### K-2 (Vừa) — xem lại / kết quả nộp bài luyện hiện đáp án câu đang bị chặn (R-2)
- **Tái hiện:**
  - (a) HS luyện câu X, nộp. Sau đó GV đưa X vào đề SAU_HAN đang mở. HS mở lại bài luyện cũ (`getResult LT…`) → X vẫn có `dapAn` + `loiGiai`. Lỗi xảy ra ở cả 7 trường hợp chặn.
  - (b) HS bắt đầu bài luyện có X, GV đưa X vào đề đang mở, rồi HS nộp → kết quả nộp hiện đáp án X.
  - Mục "TC-4.13 / R-2" của test Node.
- **Chẩn đoán:**
  - `Code.gs:2435` `buildPracticeView_()` chỉ ẩn câu lấy từ đề thi (`q` dạng `examId#stt`) khi đề bị khóa.
  - Câu có maKho thì lấy thẳng từ pool, không đối chiếu `blockedBankIds_()`.
  - Nhánh nộp (`Code.gs:2431`) cũng gọi hàm này.
- **Đề xuất:**
  - Trong `buildPracticeView_`, lấy `var blocked = blockedBankIds_()`. Câu nào có `q.maKho` nằm trong `blocked` thì vẫn hiện nội dung và điểm, nhưng bỏ `dapAn` / `loiGiai` và ghi chú "Lời giải tạm ẩn vì câu đang nằm trong đề thi".
  - Lưu ý TC-4.9 vẫn phải giữ: câu bị **tắt** hoặc bị "thay" khỏi pool vẫn hiện lời giải; chỉ câu **đang thi** mới ẩn.

## Ghi nhận (không tính lỗi)
- **N-1. Cách gửi chương + bài:** `practiceStart` gửi cả `chuong:[C]` và `bai:[b]` thì máy chủ lấy **hợp**, tức cả chương C (9/15 câu ngoài bài b). Giao diện khi tick 1 bài chỉ gửi `bai`, nên học sinh không gặp. Nên ghi rõ trong đặc tả hoặc chú thích API.
- **N-2. Lịch sử khi tắt luyện tập:** khi `CHO_LUYEN_TAP=KHONG`, trang Lịch sử ẩn bộ lọc "Đề thi / Luyện tập", nên học sinh không xem lại được bài luyện cũ trên giao diện. API `myResults loai:"luyen"` vẫn trả được. Đặc tả không nói; giáo viên quyết định.
- **N-3. Token `p` chứa mã câu:** `qids` (mã câu kho) đọc được bằng giải mã base64. Đúng theo thiết kế; không chứa đáp án.
- **N-4. Hạn token theo đồng hồ:** máy chủ so hạn token bằng `Date.now()`, không qua `nowMs_()`. Vì vậy phép thử tua đồng hồ giả 48 giờ không có tác dụng (vẫn nhận). Hạn đã được kiểm bằng token ký đúng có `exp` trong quá khứ (bị từ chối).

## Test cũ (chạy lại trên `e2ae46a`)

| Test | Kết quả |
|---|---|
| `backend.test.js` | 13 đạt |
| `importer.test.js` | đạt |
| `bank.test.js` | 30 đạt |
| `pha2-kiem-thu.test.js` | 31/31 |
| `pha3-kiem-thu.test.js` (LIBS_DIR) | 17/17 nhóm, mã thoát 0 |
| `pha4.test.js` (người làm, tham khảo) | 17 đạt |
| `e2e.js` máy chủ mới (dev-server mới, cổng 8793) | đạt |
| `e2e.js` `SERVER_COMPAT=1.0.0` (dev-server mới, cổng 8794) | đạt |

## Ảnh (`docs/bao-cao/anh/pha-4/`, dữ liệu kho giả tự soạn, 1280×800 trừ khi ghi khác)
- `kt-01-trang-luyen-tap`: 3 thẻ, "44 câu có thể luyện".
- `kt-02-cay-chon-bai`: cây chương → bài có số câu, ô số câu / thời gian.
- `kt-03-lam-bai-luyen`: đang làm bài luyện (dùng lại màn làm bài).
- `kt-04-ket-qua-luyen`: kết quả, nhãn "Luyện tập".
- `kt-05-ket-qua-loi-giai`: lời giải.
- `kt-06-luyen-cau-sai`: đề luyện câu sai.
- `kt-07-de-nhanh-thieu-cau`: đề nhanh bài thiếu câu, có thông báo.
- `kt-08-lich-su-luyen-tap`: Lịch sử lọc "Luyện tập".
- `kt-09-luyen-tap-dien-thoai`: 390×844.
- `kt-10-dua-vao-luyen-tap-hop-thoai`: hộp "Đưa vào luyện tập".
- `kt-10b-dua-vao-luyen-tap-ket-qua`: kết quả thêm, báo "1 câu đang thi".
- `kt-11-pool-dang-thi`: tab Pool, nhãn "đang thi".
- `kt-12-pool-luyen-tap`: tab Pool sau khi bật/tắt.
- `kt-13`, `kt-14`, `kt-15`: `CHO_LUYEN_TAP=KHONG` (trang chủ, mở thẳng `#/luyen-tap`, tab Pool).
- `kt-16`, `kt-17`: máy chủ 1.0.0.

## Kết luận
**CHƯA ĐẠT.**
- **TC-4.13 KHÔNG ĐẠT** do K-1 (Nặng) và K-2 (Vừa). Cả hai đều thuộc phần đặc tả bổ sung ngày 19/11.
- **13 TC còn lại ĐẠT**; test cũ vẫn đạt.
- **Sau khi người làm sửa:** chạy lại `node tests/pha4-kiem-thu.test.js` (2 mục đang đỏ phải xanh, TC-4.9 phải vẫn xanh) và `tests/pha4-kiem-thu.e2e.js all`.

---

## Vòng 2 (kiểm lại trên `f228081`, 19/11/2026)

### Tóm tắt cho giáo viên
- **K-1 và K-2 đã sửa.**
  - Câu nằm trong đề **chưa đóng** không còn hiện trong Luyện tập. Điều này đúng với mọi chế độ hiện lời giải, kể cả "Ngay sau khi nộp".
  - Xem lại bài luyện cũ có câu đang thi thì học sinh thấy dòng "Câu này đang nằm trong một đề thi chưa kết thúc. Đáp án và lời giải sẽ hiện khi đề thi đó kết thúc." Điểm vẫn đúng.
  - Giáo viên vẫn thấy lời giải. Đóng đề xong thì lời giải hiện lại cho học sinh.
- **14/14 TC ĐẠT** ở máy chủ mới, khi tắt luyện tập và ở máy chủ cũ 1.0.0. Test cũ vẫn đạt.
- **Ghi chú:** 1 bài kiểm thử của người làm (`pha4.test.js`, TC-4.6) thỉnh thoảng báo đỏ (1/6 lần). Đây là lỗi của bài kiểm thử, không phải lỗi web (xem T-1).

### Thay đổi trong test của người kiểm thử
Không sửa test vòng 1, trừ một chỗ ở TC-4.3: dòng ghi nhận N-1 đổi thành "đếm câu ngoài bài". Thêm vào cuối hai file:
- **Node:** 7 mục "V2".
- **E2E:**
  - Máy chủ mới: mở lại bài luyện đầu tiên khi một câu của bài đang nằm trong đề NGAY đang mở; sau đó đóng đề rồi mở lại.
  - Chế độ tắt luyện tập: tạo sẵn 1 bài luyện khi còn bật, giáo viên tắt, rồi mở bài đó từ Lịch sử.

### Kết quả
- `node tests/pha4-kiem-thu.test.js`: **33/33** (26 mục vòng 1 + 7 mục V2).
  - Các mục vòng 1 trước đây đỏ nay đã xanh:
    - "TC-4.13 X trong đề NGAY đang mở": X 0/50 lần, meta không đếm X, có nhãn "đang thi", đóng đề thì X trở lại.
    - "TC-4.13 / R-2": cả 7 trường hợp chặn đều ẩn lời giải khi xem lại; kết quả nộp cũng ẩn.
- `tests/pha4-kiem-thu.e2e.js all`: **22/22 nhóm** ở 3 chế độ (mới, `PRACTICE=0`, `SERVER_COMPAT=1.0.0`). 0 lỗi JS.

| TC | Vòng 2 |
|---|---|
| TC-4.1 → TC-4.12, TC-4.14 | **ĐẠT** (chạy lại toàn bộ; số liệu như vòng 1) |
| TC-4.13 | **ĐẠT** (7/7 trường hợp chặn, gồm đề NGAY đang mở; R-2 ẩn đúng) |

| Kiểm thêm theo vòng 2 | Kết quả | Bằng chứng |
|---|---|---|
| Xem lại bài luyện có câu đang bị chặn | **ĐẠT** | Node: học sinh thấy câu X còn đề bài và câu trả lời của mình, không có `dapAn`/`loiGiai`, có dòng "…sẽ hiện khi đề thi đó kết thúc"; điểm và số câu đúng giữ nguyên; các câu khác vẫn có lời giải. Giáo viên (`getResult`) thấy đủ. Đóng đề → học sinh thấy lại lời giải, hết dòng báo. E2E: điểm "6,25" như lúc nộp, 9/10 lời giải + dòng báo (ảnh `kt-18`); đóng đề → 10/10 |
| "Luyện câu đã sai" chỉ lấy câu của đề đã đóng | **ĐẠT** | Câu sai ở đề NGAY đang mở và đề SAU_HAN còn hạn → không vào tập ("Bạn chưa có câu sai nào…"). Đóng đề NGAY và cho đề kia hết hạn (`ketThuc` đã qua) → cả 2 vào tập |
| Chọn cả chương và bài → lấy giao | **ĐẠT** | Chương I + Bài 1 → 15/15 câu thuộc Bài 1. Chương II + bài của chương I → "Chưa có câu nào phù hợp…" |
| Tắt luyện tập vẫn xem bài luyện cũ | **ĐẠT** | Node: `myResults loai:"luyen"` và `getResult LT…` vẫn trả bài, có lời giải; `practiceMeta` báo tắt. E2E `PRACTICE=0`: Lịch sử có bộ lọc "Đề thi / Luyện tập" → mở bài cũ → 5/5 lời giải (ảnh `kt-19`); mục Luyện tập vẫn ẩn |
| Pool vượt 3 000 câu đang bật | **ĐẠT** | Kho 3 010 câu, "Thêm" tất cả → "Mỗi lần đưa tối đa 3000 câu…", 0 lần ghi `LuyenTap`. Có 2 990 câu, thêm 20 → "Pool luyện tập tối đa 3000 câu đang bật; sau lần này sẽ có 3010 câu… Chưa ghi gì.", 0 lần ghi. Tắt 30 câu rồi thêm 20 → được (`them=20`, 2 980 đang bật). "Thay" bằng đúng 3 000 câu → được. TC-4.11 (đúng 3 000 câu) vẫn đạt |
| Nộp lại cùng token | **ĐẠT** | Nộp lại 3 lần → cùng mã bài, KetQuaLuyenTap không thêm hàng. Học sinh khác nộp token → bị từ chối. Mã bài mới 26 ký tự (`LT…` + 12 ký tự) |
| Mã bài cũ (6 ký tự) | **ĐẠT** | Đổi mã một bài luyện trong sheet về dạng cũ `LT2611191406244C9BC4` → `getResult` mở được, 5 câu có lời giải; `myResults luyen` có bài đó. Bài thi do **Code.gs 1.0.0 thật** ghi (`KQ…`, KetQua thiếu cột "Mục tiêu"), chép sang máy chủ mới → `getResult` mở được, đúng điểm, có trong `myResults` |
| Đưa vào luyện tập / tab Pool | **ĐẠT** | Hộp thoại đổi chữ thành "…đề thi chưa đóng (nháp, chưa mở, đang mở) hoặc không công bố lời giải…". Sau khi thêm vẫn báo "1 câu đang thi" kèm mã. Lọc "Đang thi" ra đúng câu đó (ảnh `kt-10`, `kt-10b`, `kt-11` chụp lại) |

### Test cũ (vòng 2)

| Test | Kết quả |
|---|---|
| `backend.test.js` | 13 đạt |
| `importer.test.js` | đạt |
| `bank.test.js` | 30 đạt |
| `pha2-kiem-thu.test.js` | 31/31 |
| `pha3-kiem-thu.test.js` (LIBS_DIR) | 17/17 nhóm |
| `pha4.test.js` (người làm) | 22/22 ở 5/6 lần chạy; 1 lần đỏ TC-4.6 (xem T-1) |
| `e2e.js` máy chủ mới (dev-server mới, cổng 8793) | đạt |
| `e2e.js` `SERVER_COMPAT=1.0.0` (dev-server mới, cổng 8794) | đạt |

### T-1 (lỗi bài kiểm thử của người làm, Nhẹ) — `tests/pha4.test.js` TC-4.6 chập chờn
- **Hiện tượng:** khoảng 1/6 lần chạy báo "có X: …" (thiếu X trong tập câu sai).
- **Chẩn đoán:**
  - Bài luyện tạo Y (`practiceStart` TU_TAO 5 câu ngẫu nhiên) có thể chọn trúng X.
  - Test trả lời **đúng** mọi câu khác Y (`tests/pha4.test.js:253`), nên X được làm đúng và rút khỏi tập. Máy chủ làm đúng đặc tả ("làm đúng ở lần luyện sau thì rút").
  - Lỗi này giống hệt lỗi tôi đã gặp và sửa trong test của mình.
- **Đề xuất:** ở dòng 253, trả lời **sai** khi `q === X` (hoặc loại X khỏi pool của bài luyện đó).

### Ảnh vòng 2
- **Ảnh mới:**
  - `kt-18-xem-lai-cau-dang-thi`: câu đang thi trong bài luyện cũ, có dòng báo, không có đáp án; câu bên dưới vẫn có lời giải.
  - `kt-19-tat-luyen-tap-lich-su`: tắt luyện tập, Lịch sử vẫn lọc được "Luyện tập".
- **Ảnh chụp lại:** `kt-08` đến `kt-11`, `kt-15`, `kt-17`. Lý do: chữ hộp thoại và tab Pool đổi, câu X đổi.
- Các ảnh còn lại giữ nguyên nội dung.

### Kết luận vòng 2
**ĐẠT.**
- **TC:** 14/14 TC đạt, kể cả hai điểm bổ sung 19/11 (R-1, R-2).
- **Kiểm thêm theo vòng 2:** 8/8 mục đạt.
- **Test cũ:** vẫn đạt.
- **Còn lại:** T-1 là lỗi của bài kiểm thử phía người làm, không chặn pha. Nên sửa để CI không đỏ ngẫu nhiên.
