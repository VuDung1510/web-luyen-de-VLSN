# Pha 7a — Sổ tay tự động

## Tóm tắt cho giáo viên
- Học sinh có thêm mục **Sổ tay** trên thanh menu: nửa trái là mọi câu từng làm sai (đề thi và luyện tập), nửa phải là cuốn sổ trên nền giấy kẻ, chữ nằm giữa hai dòng kẻ như thầy đã chốt.
- Mỗi câu có đèn **đỏ / vàng / xanh** (xanh = đã làm đúng 2 lần ở 2 ngày khác nhau). Lỗi chia nhóm **Sai ngoo** (hiện trước) và **Hổng kiến thức** (thu gọn ở dưới). Loại lỗi sai ≥ 3 câu ở ≥ 2 đề gắn nhãn **Lặp lại**.
- Máy tự nhận ra câu bỏ trống và, khi đề đã công bố lời giải, đáp án Phần III lệch 10ⁿ lần (quên đổi đơn vị) hoặc lệch nhỏ / ngược dấu. Đề chưa công bố: hiện nội dung câu và câu trả lời của em, **không** hiện đáp án và lời giải.
- Máy chủ lên **Code.gs 1.6.0**: thầy dán lại và chạy `setup` một lần (thêm trang tính `SoTay`, `CongThuc`). Trước khi dán, trang web vẫn chạy bình thường và chưa hiện mục Sổ tay.
- Chưa có trong 7a: học sinh tự chọn loại lỗi, ghi chú, công cụ sửa lỗi, lời nhắc trước khi làm đề (7b); đề khắc phục (7c).

## Người làm

### Đã làm
**Máy chủ (`apps-script/Code.gs`, 1.5.0 → 1.6.0, `features` thêm `"notebook"`)**
- `SCHEMA` thêm `SoTay` (Mã HS, Khóa câu, Loại lỗi, Nguồn, Chi tiết lỗi (JSON), Ghi chú, Cập nhật) và `CongThuc` (Mã bài, Tên công thức, Công thức, Tên gợi nhớ, Phạm vi áp dụng, Dấu hiệu sử dụng, Bật); cả hai nằm trong `OPTIONAL_SHEETS` (Sheet cũ đọc = rỗng, lần ghi đầu tự tạo).
- `CaiDat` thêm `BAT_SO_TAY` (mặc định `CO`; thiếu khóa cũng coi là bật) và `TU_KHOA_DOC_SAI` (danh sách mặc định §5.2, dùng ở 7b); cả hai sửa được ở trang quản trị → Cài đặt.
- `publicConfig.notebook`; API mới `notebook`, `notebookItem` (bảng §6 của đặc tả). `BAT_SO_TAY = KHONG` → hai API báo lỗi "Giáo viên đang tắt sổ tay." ở máy chủ.
- `nbCompute_`: đọc `KetQua` + `KetQuaLuyenTap` của **một** học sinh (`rowsWhere_`), gộp theo khóa (`maKho` hoặc `examId#stt` / mã câu luyện tập), tính màu §4, số lần sai, số đề, loại lỗi (máy đoán §3, hàng `SoTay` của học sinh thắng). Đệm 60 giây theo học sinh, khóa đệm gồm thế hệ của 6 trang tính liên quan nên nộp bài / sửa đề là có số liệu mới ngay.
- Luật công bố đáp án dùng lại `examLocked_` + `blockedBankIds_` của Pha 4: đề phải đã đóng và cho xem lời giải, mã kho không nằm trong đề đang thi.
- Thời gian trả lời `t` (giây từ lúc bắt đầu tới lần sửa đáp án cuối) lưu vào `chiTiet` của bài thi và bài luyện; máy chủ chỉ nhận số 0 … số giây đã làm.

**Giao diện học sinh** (`index.html`, `assets/js/app.js`, `assets/js/common.js`, `assets/css/style.css`)
- Mục **Sổ tay** (`#/so-tay`) chỉ hiện khi máy chủ có `notebook` và `BAT_SO_TAY` bật. Máy tính: hai cột; điện thoại: 2 tab, tab Sổ tay mở trước.
- Nửa trái: bộ lọc loại lỗi / đề / mức độ / ô tìm (theo bài, chương, tên đề), nhóm Sai ngoo trước; mỗi câu thu gọn một dòng, bấm mở thì tải chi tiết (`notebookItem`) và hiện câu hỏi (KaTeX, hình), câu trả lời của em, đáp án + lời giải khi đã công bố, loại lỗi, nút "Xem lại bài làm".
- Nửa phải: thanh tỉ lệ loại lỗi, nhóm Sai ngoo (bấm tên lỗi thì nửa trái lọc theo lỗi đó), Hổng kiến thức thu gọn với bản đồ chương → bài. Dòng chữ cao đúng 32px theo dòng kẻ. Màu mới khai báo thành biến `--nb-*` ở cả 3 khối màu (sáng, tối theo hệ thống, tối bật tay).
- Nộp bài xong xóa bản lưu `notebook` trên máy; gửi kèm `times`.
- Trang quản trị → Cài đặt: thêm 2 ô "Mục Sổ tay cho học sinh", "Sổ tay: từ khóa dễ đọc sai".

**Tài liệu:** README (9 trang tính, mục Sổ tay, phiên bản 1.6.0), `docs/VIEC-GIAO-VIEN.md` (nhóm việc Pha 7a ở đầu file), `docs/TONG-QUAN.md`, `docs/BAN-GIAO.md`, `docs/spec/pha-7-so-tay.md` (sửa câu chữ TC-7.1, ghi ngày ở cuối).

### Chỗ lệch đặc tả / quyết định của người làm
1. **TC-7.1**: câu chữ cũ "lần làm gần nhất" mâu thuẫn với đèn xanh "đã khắc phục". Đã sửa đặc tả: liệt kê mọi câu **từng** sai; câu đã làm đúng lại vẫn hiện (vàng / xanh).
2. **Ghi `t` ngay từ 7a** (đặc tả không nói pha nào) để khi làm 7b đã có dữ liệu chia thời gian thật.
3. **Ý con** của loại lỗi Tính toán (`DON_VI` / `BAM_MAY`) nằm trong cột *Chi tiết lỗi (JSON)* của `SoTay`, không thêm cột.
4. `notebookItem` đã trả `congThuc[]` (đọc `CongThuc`, khớp tên bài hoặc mã bài là tiền tố mã câu kho) và `ghiChu`, để 7b chỉ việc vẽ.
5. Ô tìm kiếm tìm theo bài / chương / tên đề, không theo nội dung câu: `notebook` cố ý không trả nội dung câu (TC-7.2).
6. Hai bài nộp trong **cùng một giây** thì thứ tự là đề thi trước, luyện tập sau (không phân biệt được hơn). Thực tế gần như không gặp.

### Kiểm thử
- Mới: `tests/pha7.test.js` — 14/14 đạt (TC-7.1 → 7.5, 7.7, 7.8, thời gian `t`, câu bị sửa / bị gỡ, hàng `SoTay` thắng máy đoán, `CongThuc`, bài luyện gộp với đề thi).
- Cũ (chạy lại toàn bộ): backend 13, importer, bank 30, cache 17, common-cache 5, bang-gach 13, docx 30/30, pha1-kiem-thu 29/29, pha2-kiem-thu 31/31, pha3-kiem-thu 17/17, pha4 22, pha4-kiem-thu 33/33, pha5 10/11, pha5-kiem-thu 26/27, pha6 10/10, pha6-kiem-thu 104/105 (mục 6.5 quét bản đã commit; hết sau commit này), pha6b-kiem-thu 97/97, pha6b-hinh 30/30, `scan-secrets` sạch.
- E2E (`tests/e2e.js`, cần `LIBS_DIR` vì máy này không tới được cdnjs): máy chủ mới **ĐẠT**; máy chủ giả lập 1.0.0 **ĐẠT**, mục Sổ tay ẩn, `#/so-tay` báo "chưa mở".
- Xem tay trang Sổ tay thật trên dev-server: 1280×800 sáng và 390×844 tối, không lỗi console, không tràn ngang (ảnh dưới).

**Bài kiểm thử cũ em đã sửa** (chỉ số phiên bản / danh sách, không đổi logic): `tests/pha4.test.js`, `bank.test.js`, `cache.test.js`, `pha6.test.js` (1.5.0 → 1.6.0, thêm `notebook`); `tests/pha6-kiem-thu.test.js` (hằng `VERSION`, `FEATURES`, `NEW_SHEETS`; dòng tìm `APP_VERSION` theo `VERSION`). Bộ quét `tests/scan-secrets.js` **không** sửa: trang mẫu bỏ logo nhúng base64 (trỏ tới file logo), học sinh thử trong bài kiểm thử dùng ngày sinh ví dụ của README nên PIN thuộc danh sách PIN mẫu bộ quét đã cho phép.

### Chưa đạt, cần người soát / kiểm thử / giáo viên quyết định
- **TC-5.1 (Pha 5, "danh sách màu cho phép")** báo các mã màu mới của Sổ tay (đỏ / vàng / xanh, màu 5 loại lỗi, giấy kẻ, bản tối). Bài này so với `main` nên màu mới nào cũng bị báo cho tới khi gộp. Các màu này đúng bảng màu trang mẫu thầy đã duyệt; người làm **không** sửa bài kiểm thử Pha 5. Đề nghị kiểm thử Pha 7a xác nhận tương phản các màu mới rồi ghi kết luận.

### Ảnh
- `anh/pha-7a/01-so-tay-1280.png` — máy tính, giao diện sáng, một câu đang mở (đề chưa công bố: ẩn đáp án).
- `anh/pha-7a/02-so-tay-390-toi.png` — điện thoại, giao diện tối, tab Sổ tay.
- `anh/pha-7a/03-cau-sai-390-toi.png` — điện thoại, tab Câu đã sai, câu đang mở.

### Việc giáo viên cần làm
Xem `docs/VIEC-GIAO-VIEN.md` → mục "Pha 7a" (dán Code.gs 1.6.0, chạy `setup`, triển khai phiên bản mới, kiểm tra mục Sổ tay). Chỉ làm sau khi Pha 7a được gộp vào `main`.

### Rủi ro còn lại
- Học sinh có rất nhiều bài nộp: chưa đo thời gian `notebook` trên dữ liệu lớn (TC-7.23 thuộc 7c, khuyến nghị).
- Câu nhập tay không có Chương / Bài: gom vào "Chưa rõ chương", bài lấy theo chủ đề của câu.

## Người làm — Vòng 2 (sau soát code và kiểm thử vòng 1)

| Phát hiện | Đã sửa |
|---|---|
| R-1 (Vừa) chậm khi nhiều câu sai ở bài luyện | Câu luyện tập chỉ cần chương/bài/mức độ thì lấy từ chỉ mục pool (không đọc hàng); chỉ câu Phần III đã trả lời mà học sinh chưa tự phân loại mới đọc đủ (cần đáp án để đoán), đọc theo khối gộp (`nbPoolGet_`). Đệm sổ tay cất theo mảnh (`cachePutChunked_`, ≤ 900 KB). Khóa đệm dùng **phiên bản riêng của từng học sinh** (`nbVer_`, đổi khi chính em nộp bài) cộng thế hệ DeThi, CauHoi, SoTay, LuyenTap — học sinh khác nộp bài không làm mất đệm của em. `notebookItem` dùng lại đệm, chỉ đọc đủ ≤ 20 câu được xem. Kiểm thử mới đo số lần đọc Sheet (`tests/pha7.test.js`, mục "Vòng 2 (R-1)"). |
| R-2 (Vừa) ô lọc mất tác dụng sau khi bấm trong sổ | Ô lọc luôn tạo lại `nb.filter` hiện tại; bỏ lọc chương ẩn khi đổi ô lọc. Đã thử trên trình duyệt: bấm tên lỗi / tên chương rồi đổi ô lọc, ô tìm đều đúng. |
| R-3, K-1 (Nhẹ) chữ nhãn sáng < 4,5:1 | Thêm `--nb-do-text` #b42323, `--nb-xanh-text` #1D6B3E (sáng; tối giữ màu cũ) cho chữ nhãn ("LẶP LẠI", "EM CHỌN", "ĐÁP ÁN", "sai n lần", "Đã khắc phục"). Tương phản: 5,58 / 6,49 / 5,67 / 6,51 (sáng), ≥ 5,5 (tối). Màu chấm giữ nguyên. |
| R-5 (Nhẹ) kích thước đệm theo ký tự | Dùng `cachePutChunked_` (chia theo byte). |
| R-6 (Nhẹ) tắt sổ tay vẫn hiện bản lưu | Vào `#/so-tay` mà cấu hình đã tắt thì xóa bản lưu, hiện "chưa mở". |
| R-7 (Nhẹ) điện thoại không luôn mở tab Sổ tay | Mỗi lần vào trang đặt lại tab Sổ tay. |
| R-8 (Nhẹ) lọc chương lẫn câu Sai ngoo | Lọc theo chương chỉ lấy câu nhóm Hổng kiến thức; nhãn "Hổng kiến thức · <chương>". |
| R-9 (Nhẹ) từ khóa mặc định lệch §5.2 | Đúng danh sách §5.2 (Sheet chưa dán 1.6.0 nên chưa ảnh hưởng dữ liệu thật). |
| R-10, K-2, K-3 (đặc tả) | Ghi rõ trong đặc tả, có dòng "Sửa đặc tả ngày 26/11/2026 (vòng 2)". |
| R-4 (Nhẹ) nhãn đoán chậm ≤ 60 giây | Chấp nhận, ghi trong đặc tả: đáp án/lời giải luôn kiểm tra lại lúc xem nên không lộ. |
| R-11 người làm tự sửa đặc tả | Ghi nhận: trong dự án này kiến trúc sư và người làm cùng là Claude phiên chính; các lần sửa đặc tả đều có dòng ngày ở cuối file để giáo viên duyệt. |
| TC-5.1 (danh sách màu Pha 5) | Chưa đổi: cần giáo viên chốt bảng màu Sổ tay (QUYET-DINH §6) rồi người kiểm thử thêm vào danh sách cho phép. |

Kiểm thử vòng 2: `tests/pha7.test.js` 15/15, `tests/pha7a-kiem-thu.test.js` 26/26, `tests/pha7a-kiem-thu.e2e.js all` ĐẠT (TC-7.6, 7.7; máy chủ mới, 1.0.0, 1.5.0), `tests/e2e.js` ĐẠT, các test cũ như vòng 1, `scan-secrets` sạch.

### Sau soát và kiểm thử vòng 2 (cả hai ĐẠT)
- V2-1 (Nhẹ, soát vòng 2): `apiAdminDeleteResult_` gọi `nbVer_(r.studentId, true)` sau khi xóa bài, để sổ tay của học sinh đó bỏ ngay câu thuộc bài đã xóa. Thêm kiểm thử `tests/pha7.test.js` mục "Vòng 2 (V2-1)" (16/16 đạt); `pha7a-kiem-thu` 28/28, backend, cache, pha6, pha6-kiem-thu vẫn đạt. Sửa một dòng, chưa qua soát lại.
- V2-2 (Nhẹ): giữ như mục Luyện tập — cấu hình trên máy học sinh sống tối đa 10 phút nên ngay sau khi tắt Sổ tay, em có thể thấy sổ cũ thêm một lần.
- V2-3 / TC-5.1: chờ giáo viên chốt bảng màu Sổ tay.
