# Báo cáo Pha 4 — Luyện tập cho học sinh

## Tóm tắt cho giáo viên (bản của người làm)
- Học sinh có mục **Luyện tập**: tự chọn chương, bài, số câu để tạo đề; luyện lại câu đã sai; làm **đề nhanh 10 phút** theo một bài.
- Nộp xong thấy ngay đáp án và lời giải. Bài luyện lưu ở trang tính riêng **KetQuaLuyenTap**, không vào bảng xếp hạng, bảng điểm hay thống kê đề.
- Thầy chọn câu cho học sinh luyện ở tab **Ngân hàng**: cho câu vào giỏ rồi bấm **Đưa vào luyện tập**. Tab con **Pool luyện tập** để bật/tắt từng câu, xem số lượt làm.
- Câu đang nằm trong đề thi chưa công bố lời giải sẽ **tự ẩn** với học sinh (nhãn "đang thi"), đề công bố lời giải thì câu tự hiện lại.
- Cần dán Code.gs 1.4.0 (ở Pha 6), chạy `setup`, chọn câu vào pool, rồi bật "Mục Luyện tập" trong Cài đặt. Trước đó trang web vẫn chạy bình thường, chỉ chưa có mục Luyện tập.

---

## Người làm

### Bảng tự kiểm TC
Lệnh: `node tests/pha4.test.js` (17/17 đạt) và `NODE_PATH=$(npm root -g) LIBS_DIR=… node tests/pha4.e2e.js` (cả máy chủ mới và `SERVER_COMPAT=1.0.0`, đạt hết).

| Mã | Mô tả | Kết quả | Bằng chứng |
|---|---|---|---|
| TC-4.1 | Đồng bộ pool: chỉ câu có đáp án, không P IV; chạy lại không nhân đôi; "thay" không xóa hàng; kho 0 lần ghi | ĐẠT | `pha4.test.js` TC-4.1: 47 câu dùng được, bỏ 1 P IV + 5 không đáp án; chạy lại `them=0`; "thay" tắt 42 câu, số hàng giữ nguyên; `extWrites = {}` |
| TC-4.2 | `practiceMeta` theo khối lớp 10A1/11B2/12A1, "CLB" thấy toàn pool đang bật; không có nội dung, đáp án | ĐẠT | TC-4.2: 0 / 3 / 42 / 45 câu (đã tắt 2 câu lớp 12); JSON không có `noiDung`, `dapAn`, mã câu |
| TC-4.3 | TU_TAO 10–2–3: 15 câu đúng bài đã chọn; không có `dapAn`, `loiGiai`, `maKho` | ĐẠT | TC-4.3 (kho 300 câu); ưu tiên câu chưa làm: lần 2 không lặp câu; e2e: phản hồi `practiceStart` và localStorage sạch |
| TC-4.4 | Điểm đúng quy tắc; ghi KetQuaLuyenTap (số); KetQua không thêm hàng; có lời giải | ĐẠT | TC-4.4: 2,25/3,5 điểm gốc → 6,43; ô điểm kiểu số; KetQua giữ nguyên; mọi câu có `dapAn` + `loiGiai`; ảnh 05, 09 |
| TC-4.5 | Bảng xếp hạng, bảng điểm, thống kê đề, gợi ý đề tương tự không đổi sau 5 bài luyện | ĐẠT | TC-4.5 so khớp JSON trước/sau (leaderboard tổng + theo đề, adminGradebook, adminExamStats, goal.goiY, adminResults, myStats, adminOverview.counts) |
| TC-4.6 | CAU_SAI: có X (đề đã cho xem lời giải) và Y (bài luyện); không có Z (SAU_HAN còn mở); làm đúng Y thì rút Y | ĐẠT | TC-4.6; thêm: đóng đề Z thì Z vào tập; câu sai gần nhất đứng đầu |
| TC-4.7 | NHANH 7–1–2, 600 s; bài thiếu thì bổ sung cùng chương, có thông báo | ĐẠT | TC-4.7: "Bài này mới có 3 câu Phần I; lấy thêm 4 câu cùng chương."; chương cũng thiếu thì đề ít câu hơn và nói rõ; `LUYEN_NHANH=3,1,1,5` → 5 câu, 300 s |
| TC-4.8 | Token: `a` sang nhánh luyện bị từ chối; sửa `qids`, `sid` khác, hết hạn bị từ chối; nộp lại không ghi thêm hàng | ĐẠT | TC-4.8: nộp 3 lần (lần 3 sau khi xóa đệm) → 1 hàng, cùng mã bài, giữ điểm lần đầu |
| TC-4.9 | Xem lại sau khi pool bị "thay" và tắt câu: đủ câu + lời giải; xóa tay hàng → "Câu đã bị gỡ" | ĐẠT | TC-4.9: các câu còn lại vẫn đúng nội dung (chỉ mục lệch hàng thì đọc lại) |
| TC-4.10 | `CHO_LUYEN_TAP=KHONG`: 3 lời gọi trực tiếp báo lỗi; giao diện không có mục; máy chủ 1.0.0 không có mục, trang khác bình thường | ĐẠT | TC-4.10 (Node) + e2e: nav ẩn, `#/luyen-tap` báo "chưa mở"; 1.0.0: làm/nộp đề, lịch sử, thống kê, xếp hạng, quản trị không lỗi; ảnh 13 |
| TC-4.11 | Pool 3 000 câu: `practiceStart` chỉ đọc chỉ mục + hàng được chọn | ĐẠT | Xem số đo dưới |
| TC-4.12 | Sheet cũ thiếu 2 trang tính: `practiceMeta` rỗng, không lỗi; lần ghi đầu tự tạo trang có tiêu đề | ĐẠT | TC-4.12: đọc không tạo trang; đồng bộ tạo `LuyenTap`, nộp bài tạo `KetQuaLuyenTap`; KetQua cũ không có mã băm vẫn đọc được |
| TC-4.13 | X trong pool và trong đề SAU_HAN đang mở / đề NHAP: 50 lần `practiceStart` (3 kiểu) không có X; `practiceMeta` không đếm X; đóng đề thì X hiện lại | ĐẠT | TC-4.13 chạy cho cả SAU_HAN và NHAP; thêm: đề chưa tới giờ mở và đề "Không hiện" lời giải cũng chặn; e2e: 3 lần bắt đầu không có câu của đề nháp |
| TC-4.14 | Chèn câu lên đầu đề: câu nhập tay lệch bị bỏ; câu có `maKho` vẫn đúng | ĐẠT | TC-4.14: `#1` (nay là câu khác) bị bỏ; câu kho tìm lại theo mã ở `#3`; sửa nội dung câu nhập tay → mã băm khác → bỏ |
| R-12 | Ô "Hình vẽ" có nhiều hình | ĐẠT | `pha4.test.js` R-12: `"Có – A.png, B.png (…)"` → 2 tên; chép 2 hình; hình thứ hai gắn vào cuối nội dung `![](url)` |

Test cũ: `backend` 13/13, `importer`, `bank` 30/30, `pha2-kiem-thu` 31/31, `pha1-kiem-thu` 29/29, `cache` 17/17, `common-cache` 5/5, `docx` 27/27, `pha3-kiem-thu` 17/17; `e2e.js` đạt cả hai chế độ; `bank.e2e.js` đạt cả hai chế độ; thêm `pha2-kiem-thu.e2e.js` 16/16, `pha3-kiem-thu.e2e.js` 23/23.

### Số đo TC-4.11 (gas-shim, pool 3 000 câu × 18 cột = 54 000 ô)
| Việc | Ô đọc trên `LuyenTap` | Đọc cả trang (`getDataRange`) | Thời gian (shim, tham khảo) |
|---|---|---|---|
| Đồng bộ 3 000 câu vào pool | — | — | 118 ms |
| `practiceStart` 10–2–3, chỉ mục **chưa** đệm | 21 288 (tiêu đề + 7 cột chỉ mục, 2 khối cột) | 0 | 13 ms |
| `practiceStart` 10–2–3, chỉ mục **đã** đệm | 288 (tiêu đề 18 + 15 hàng × 18) | 0 | 7 ms |

Thời gian trên Apps Script thật chưa đo được (mạng chặn script.google.com); để vào danh sách kiểm tra Pha 6.

### Đã làm
**`apps-script/Code.gs` → 1.4.0**, `features` thêm `"practice"`, `publicConfig.practice` = CHO_LUYEN_TAP.
- `SCHEMA` thêm `LuyenTap` (đúng cột đặc tả) và `KetQuaLuyenTap` (cột KetQua + `Kiểu`). `setup()` tạo cả hai, định dạng số KetQuaLuyenTap như KetQua. Trang tính thiếu: đọc = rỗng (không tạo); lần ghi đầu tự tạo có tiêu đề và định dạng (`createOptionalSheet_`).
- CaiDat thêm `CHO_LUYEN_TAP` (mặc định KHONG) và `LUYEN_NHANH` (7,1,2,10); cả hai sửa được ở mục Cài đặt.
- Chỉ mục pool `poolIndex_` (mã, hàng, lớp, chương, bài, loại, mức độ, bật) đọc 7 cột bằng `getRange`, đệm theo thế hệ `LuyenTap`; câu đầy đủ đọc theo hàng (`readRowRuns_`), ô mã lệch thì đọc lại chỉ mục một lần.
- `blockedBankIds_`: mã câu kho trong CauHoi của đề NHAP, đề chưa tới giờ mở, hoặc `canReveal_ = false`; đệm theo thế hệ DeThi + CauHoi, sống tới mốc mở/đóng gần nhất của một đề (tối đa 60 s).
- API mới: `practiceMeta`, `practiceStart` (TU_TAO / CAU_SAI / NHANH), `adminPracticeSync` (dùng `bankToQuestion_` + chép hình chia lô, tách thành `bankFetch_` dùng chung với `adminBankToQuestions`), `adminPracticeList`, `adminPracticeToggle` (chỉ ghi ô Bật + Cập nhật).
- `submitExam`: token `p` (ký HMAC như token `a`; chứa `pid`, `sid`, `qids`, `exp`, kiểu, mục tiêu) → `practiceSubmit_` chấm bằng `gradeExam_`, ghi KetQuaLuyenTap trong khóa. Mã bài `LT…` cố định theo lượt, kiểm tra cột "Mã bài" đọc thẳng Sheet trước khi ghi → nộp lại không thêm hàng. `chiTiet` có `q` (qid), `k` (mã kho), `h` (mã băm nội dung).
- `submitExam` đề thi: mỗi mục `chiTiet` thêm `k` và `h` (để CAU_SAI nhận ra đề đã sửa). Cột và hàng KetQua không đổi.
- `myResults` có `loai: "luyen"`; `getResult` nhận mã `LT…` → `buildPracticeView_` (luôn có lời giải; câu không còn → "Câu đã bị gỡ khỏi ngân hàng").
- **R-12**: `bankImageNames_` đọc đủ các hình (cách nhau `,` `;` `+` "và"); hình đầu vào `hinhAnh`, hình sau gắn `![](url)` vào nội dung; thiếu hình nào thì cảnh báo theo mã câu.

**Giao diện**
- `index.html`: mục "Luyện tập" (ẩn khi máy chủ không có `practice` hoặc giáo viên tắt).
- `assets/js/app.js`: trang `#/luyen-tap` (3 thẻ, cây chương → bài có số câu P I·P II·P III, số câu và thời gian), hộp mục tiêu có nút **Bỏ qua**, làm bài bằng `runExam()` (có thông báo khi thiếu câu), tiếp tục bài dở `#/luyen-tap/lam`, kết quả có nhãn Luyện tập và nút "Luyện tiếp", lịch sử lọc "Đề thi / Luyện tập", lối vào ở trang chủ. Không cho bắt đầu bài mới khi đang làm dở bài khác.
- `assets/js/common.js`: `FEATURE_OF` thêm các action luyện tập; câu bị gỡ hiện thông báo; khung mục tiêu của bài luyện mời "Luyện tiếp" thay cho gợi ý đề thi.
- `assets/js/admin.js`: tab con "Kho câu hỏi / Pool luyện tập"; nút **Đưa vào luyện tập** trong giỏ câu (Thêm / Thay pool, chép hình theo lô, cảnh báo câu "đang thi"); trang Pool (lọc lớp, chương, bật/tắt/đang thi, mã câu; bật/tắt từng câu hoặc cả trang; số lượt làm); Cài đặt có 2 ô mới. Máy chủ cũ: không có tab Pool, `#/ngan-hang/pool` báo "Cần cập nhật máy chủ".
- `assets/css/style.css`: kiểu cho trang Luyện tập, pool, nhãn "đang thi".

**Kiểm thử**
- `tests/pha4.test.js` (mới), `tests/pha4.e2e.js` (mới, tự chạy dev-server cổng 8781/8782).
- `tests/dev-server.js`: máy chủ mới tự đặt `CHO_LUYEN_TAP=CO` và đưa mọi câu dùng được của kho giả vào pool; `PRACTICE=0` để tắt, `PRACTICE_POOL=0` để pool rỗng.
- `tests/cache.test.js`, `tests/bank.test.js`: sửa số phiên bản mong đợi 1.3.0 → 1.4.0 và danh sách `features` thêm `practice`.
- Không đổi `gas-shim.js`, `kho-gia.js`.

### Ảnh (`docs/bao-cao/anh/pha-4/`)
01 trang Luyện tập (điện thoại) · 02 cây chọn bài (điện thoại) · 03 hộp mục tiêu có "Bỏ qua" · 04 làm bài luyện · 05 kết quả có lời giải (điện thoại) · 06 lịch sử lọc Luyện tập · 07 trang Luyện tập (1280) · 08 cây chọn bài (1280) · 09 kết quả có lời giải (1280) · 10 tab Pool có nhãn "đang thi" (1280) · 11 cảnh báo khi đưa câu đang thi vào luyện tập · 12 tab Pool lọc "đang thi" (điện thoại) · 13 máy chủ 1.0.0: không có Luyện tập.

### Chỗ lệch đặc tả và lý do
1. **Chặn thêm đề chưa tới giờ mở** (`Mở lúc` ở tương lai). Với `canReveal_` hiện có, đề SAU_HAN chưa mở trả `true`, nên câu sẽ lộ trước giờ thi. Chặt hơn đặc tả.
2. **CAU_SAI, câu thi có mã kho**: không bỏ khi ô `examId#stt` đổi mã, mà tìm lại câu trong đề **theo mã kho** (đúng câu dù đề bị đánh số lại). Nếu câu đó đang bật trong pool thì luyện bản trong pool (qid = mã kho). Câu nhập tay vẫn theo đúng đặc tả (lệch mã băm → bỏ).
3. **KetQua cũ** (trước pha này, không có mã băm): chỉ nhận câu nhập tay khi đề chưa được sửa sau lần làm (so cột "Cập nhật" của đề); câu ở ô nay có mã kho thì bỏ.
4. Token `p` chứa `qids` (mã câu kho) dạng base64 như đặc tả: học sinh giải mã được **mã câu**, không phải đáp án. Phần trả về ngoài token không có mã câu.
5. `CHO_LUYEN_TAP` mặc định **KHONG** khi `setup()` thêm (đặc tả: giáo viên đặt CO). Thiếu dòng này cũng coi là tắt.
6. `adminPracticeList` tìm chữ chỉ theo **mã câu** (chỉ mục không giữ nội dung, theo yêu cầu đệm chỉ mục).
7. Thời gian mặc định: CAU_SAI 2 phút/câu (10–90 phút); TU_TAO thiếu `phut` thì 45. Học sinh chọn 5–90 phút như đặc tả.
8. `publicConfig` thêm trường `practice` để giao diện biết giáo viên đã bật (không có trong bảng API).

### Việc giáo viên cần làm (cộng dồn cho Pha 6)
1. Ở Pha 6: dán **Code.gs 1.4.0**, triển khai **Phiên bản mới** (cùng URL).
2. Chạy hàm **`setup`** một lần: tạo trang tính `LuyenTap`, `KetQuaLuyenTap` và 2 dòng CaiDat `CHO_LUYEN_TAP`, `LUYEN_NHANH`. Không mất dữ liệu cũ.
3. Trang quản trị → **Ngân hàng**: lọc, cho câu vào giỏ → **Đưa vào luyện tập**. Xem lại ở tab **Pool luyện tập**.
4. **Cài đặt** → "Mục Luyện tập cho học sinh" = **Bật** (tức `CHO_LUYEN_TAP=CO`). Có thể đổi "Đề nhanh theo bài" (mặc định 7,1,2,10).
5. Không xóa hàng trong `LuyenTap` (bài luyện cũ sẽ hiện "Câu đã bị gỡ"); muốn bỏ câu thì bấm **Tắt**.

### Rủi ro còn lại
- Chưa đo trên Apps Script thật: đồng bộ 3 000 câu có hình (mỗi lượt chép 40 hình đọc lại các hàng kho được chọn), `practiceMeta` khi KetQua/KetQuaLuyenTap lớn (đọc cả trang, quá ~900 KB thì không đệm).
- Câu đã phát cho học sinh rồi mới bị đưa vào đề chưa công bố lời giải: học sinh nộp bài đó vẫn thấy lời giải của câu (đã thấy đề từ trước).
- `practiceUsage_` (số lượt làm ở tab Pool) đọc toàn bộ KetQuaLuyenTap; chậm dần khi nhiều bài luyện.
- `bank.e2e.js` chỉ đạt khi chạy trên dev-server **mới khởi động** (chạy sau `e2e.js` trên cùng dev-server thì không đạt; trên `main` cũng vậy — lỗi sẵn có của bài test, không do pha này).
- Giới hạn lượt luyện/ngày và thống kê theo chương/bài: hoãn theo đặc tả.

---

## Vòng 2 (người làm)

Sửa theo `docs/bao-cao/pha-4-soat.md`, `docs/bao-cao/pha-4-kiem-thu.md` và đặc tả bổ sung ngày 19/11/2026 (mục "Chặn câu đang thi", TC-4.13).

| Mã | Mức | Đã sửa |
|---|---|---|
| R-1 / K-1 | Nặng | `examLocked_`: câu chỉ vào luyện tập khi đề **đã đóng** (giáo viên đóng hoặc hết hạn) **và** `canReveal_` = true. Chặn đề NHAP, đề chưa tới giờ mở, đề đang mở ở **mọi** chế độ hiện lời giải (kể cả "Ngay sau khi nộp"), đề "Không hiện". Đệm `blockedBankIds_` hết hạn đúng mốc mở/đóng gần nhất. `practiceMeta` không đếm câu bị chặn, tab Pool gắn nhãn "đang thi"; chữ trên trang quản trị đổi thành "đề chưa đóng". "Luyện câu đã sai" chỉ lấy câu của đề đã đóng. |
| R-2 / K-2 | Vừa | `buildPracticeView_` (xem lại bài luyện cũ và kết quả ngay khi nộp): câu có mã kho đang bị chặn **lúc xem**, hoặc câu lấy từ đề chưa đóng, thì học sinh chỉ thấy đề bài và câu trả lời của mình, kèm dòng "Câu này đang nằm trong một đề thi chưa kết thúc. Đáp án và lời giải sẽ hiện khi đề thi đó kết thúc." Điểm vẫn chấm bình thường. Giáo viên vẫn thấy lời giải. Câu bị tắt hoặc bị "thay" khỏi pool vẫn hiện lời giải (TC-4.9 giữ nguyên). |
| R-3 | Vừa | Không còn đọc cả trang KetQua / KetQuaLuyenTap. `rowsWhere_` chỉ đọc cột "Mã HS" (hoặc "Mã bài"), rồi đọc riêng các hàng khớp. Khi nộp không đọc lại trang để dựng kết quả. Tab Pool đếm lượt làm chỉ đọc cột "Chi tiết". |
| R-5 | Nhẹ | Nộp lại: tìm bài theo mã bài **và** mã học sinh; mã bài dùng 12 ký tự của mã lượt (trước 6). |
| R-6 | Nhẹ | Giới hạn 3 000 câu áp cho **tổng** câu đang bật sau mỗi lần "Thêm". Vượt thì báo lỗi rõ (số câu sau lần này, cách xử lý) và không ghi gì. |
| N-1 | — | Gửi cả `chuong` và `bai` thì lấy **giao** (bài thuộc chương đó). |
| N-2 | — | Máy chủ không chặn `myResults loai:"luyen"` / `getResult LT…` khi tắt luyện tập. Giao diện: nếu cấu hình máy chủ về sau lần vẽ đầu, trang Lịch sử tự vẽ lại để có bộ lọc "Đề thi / Luyện tập". E2E thêm bước: tắt luyện tập, vẫn mở được bài luyện cũ có lời giải. |
| R-4 / N-3 | — | Chấp nhận, không sửa. |

### Số đo R-3 (gas-shim, KetQuaLuyenTap 5 001 hàng × 20 cột; trang có KetQua mẫu)
| Lời gọi | Trước (e2ae46a) | Sau (vòng 2) |
|---|---|---|
| `practiceMeta` | KetQuaLuyenTap 1 lần cả trang (100 040 ô) + KetQua 1 lần cả trang | 0 lần cả trang; 5 041 ô (cột Mã HS + hàng của em) |
| `practiceStart` | 1 lần cả trang (100 040 ô) | 0 lần cả trang; 5 041 ô |
| `submitExam` (token `p`) | 2 lần cả trang (210 162 ô) | 0 lần cả trang; 10 082 ô (cột Mã HS + cột Mã bài kiểm trùng trong khóa) |

### Test
- `tests/pha4.test.js` 22/22. Sửa test cũ của tôi theo đặc tả mới: TC-4.6 và TC-4.14 đóng đề trước khi xét "Luyện câu đã sai"; TC-4.13 thêm đề NGAY đang mở, đề hết hạn, đề đã đóng nhưng "Không hiện", mốc hết hạn của đệm, và xem lại bài cũ (học sinh không thấy lời giải, giáo viên vẫn thấy, đóng đề thì hiện lại). Thêm 5 mục "Vòng 2" (R-3 đo ô, R-2 khi nộp, N-1, R-6, R-5/N-2).
- `tests/pha4-kiem-thu.test.js` của người kiểm thử: 26/26 (không sửa file). `tests/pha4-kiem-thu.e2e.js` 20/20.
- `tests/pha4.e2e.js` đạt ở máy chủ mới và 1.0.0. Test cũ (`backend`, `importer`, `bank`, `pha1/2/3-kiem-thu`, `cache`, `common-cache`, `docx`, `e2e.js` và `bank.e2e.js` hai chế độ) đều đạt.

### Rủi ro còn lại (cập nhật)
- Đề không có giờ đóng thì câu bị chặn khỏi luyện tập cho tới khi giáo viên đóng đề (đúng đặc tả bổ sung). Giáo viên xem nhãn "đang thi" ở tab Pool.
- Nộp bài luyện vẫn đọc 2 cột của KetQuaLuyenTap (tỉ lệ với số hàng); chưa đo trên Apps Script thật.

---

## Vòng 3 (người làm)

| Mã | Đã sửa |
|---|---|
| V2-1 (Vừa) | `rowsWhere_` không còn đọc từng hàng khớp một. Các hàng liền nhau gộp thành khối; quá 10 khối thì gộp hai khối gần nhau nhất cho tới khi còn ≤ 10, đọc cả vùng gộp rồi chỉ giữ hàng cần trong bộ nhớ. Đọc chỉ mục pool và câu theo hàng (TC-4.11) giữ nguyên cách cũ. Dữ liệu trả về giống hệt `readTable_` lọc theo học sinh (script đo của soát: `rowsWhere_ == readTable_ filter: true`). |
| T-1 / V2-2 | `tests/pha4.test.js` TC-4.6: câu X nếu bị bốc vào bài luyện thì cũng trả lời sai; "câu sai gần nhất trước" cho phép X và Y cùng thời điểm. Chạy riêng TC-4.6 (`ONLY=TC-4.6 node tests/pha4.test.js`) 20 lần liền: 20/20 đạt. |
| V2-3 | Chấp nhận, không sửa (xem rủi ro). |

**Số đo V2-1** (script `calls.js` của soát; KetQuaLuyenTap 3 002 hàng, học sinh có 102 bài nằm rải rác cứ 30 hàng một bài):

| Lời gọi | Vòng 2: lần đọc / ô | Vòng 3: lần đọc / ô |
|---|---|---|
| `practiceMeta` | 102 / 5 041 | 12 / 57 241 |
| `practiceStart` | 102 / 5 041 | 12 / 57 241 |
| Nộp bài luyện | 105 / 8 082 | 15 / 60 282 |
| `myResults loai:"luyen"` | 103 / 5 062 | 12 / 57 842 |

Số lần đọc Sheet giảm từ khoảng 100 xuống tối đa 12–15, đổi lại số ô đọc tăng khi bài của học sinh nằm rải khắp trang. Vẫn không đọc cả trang bằng `getDataRange`.

**Test vòng 3**: `pha4.test.js` 22/22; `pha4-kiem-thu.test.js` 33/33 (không sửa); `pha4.e2e.js`, `pha4-kiem-thu.e2e.js` 22/22 nhóm (máy chủ mới, tắt luyện tập, 1.0.0); test cũ đạt (`backend`, `importer`, `bank`, `pha1/2/3-kiem-thu`, `cache`, `common-cache`, `docx`, `e2e.js` và `bank.e2e.js` hai chế độ).

**Rủi ro thêm**: V2-3 — câu bị ẩn lời giải (đang nằm trong đề chưa kết thúc) vẫn hiện nhãn đúng/sai và điểm của câu, nên với câu Phần I học sinh có thể suy ra đáp án nếu đã chọn đúng. Học sinh đã làm câu đó trước khi câu vào đề. Khi học sinh có rất nhiều bài luyện rải khắp trang, mỗi lần đọc vùng gộp lớn hơn (số ô gần bằng cả trang), nhưng chỉ ≤ 10 lần đọc.
