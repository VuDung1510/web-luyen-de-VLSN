# Pha 7b — Soát code (vai độc lập)

Phạm vi: `git diff 8566ecf..d563d44`, gồm hai commit trên máy chưa đẩy lên GitHub: `c9c1001` (máy chủ) và `d563d44` (giao diện). Đối chiếu `docs/spec/pha-7-so-tay.md` (§5, §7 phần 7b, TC-7.9 → 7.17, dòng "Sửa đặc tả ngày 27/11/2026") và `docs/bao-cao/pha-7b.md`.

## Tóm tắt cho giáo viên
- Học sinh chỉ ghi được loại lỗi và ghi chú cho câu trong sổ tay của chính mình. Chữ học sinh gõ và chữ thầy nhập (từ khóa, thẻ công thức) đều hiện nguyên văn, không chạy thành mã. Không thấy chỗ nào làm lộ đáp án.
- Có **2 lỗi mức Vừa** liên quan tới dữ liệu, phải sửa trước khi gộp:
  1. **Lưu nhiều câu cùng lúc rất chậm.** Khi em lưu khung "Em sai vì sao?" (tối đa 40 câu), máy chủ đọc lại **cả trang SoTay một lần cho mỗi câu**, trong lúc đang giữ khóa ghi chung. Ngay sau giờ kiểm tra, khi cả lớp cùng lưu, học sinh khác **nộp bài** có thể phải chờ quá 20 giây rồi báo lỗi.
  2. **Ghi chú vừa gõ có thể mất.** Nếu trang tự vẽ lại trong lúc em đang gõ (ví dụ một câu khác vừa tải xong, hoặc em bấm chọn loại lỗi), ô ghi chú quay về nội dung cũ. Lần gõ tiếp theo có thể ghi đè nội dung đã lưu.
- Hộp "Điều cần nhớ" không khóa nút Bắt đầu vĩnh viễn: lỗi mạng thì nút vẫn bấm được.
- Kết luận: **CHƯA ĐẠT**. Lý do là 2 lỗi Vừa ảnh hưởng tới dữ liệu (R-1, R-2). Cả hai đều sửa được ít dòng.

## Đã kiểm
- Đã chạy:
  - `tests/pha7b.test.js` 9/9 đạt.
  - Đạt: `pha7` 16/16, `pha7a-kiem-thu` 28/28, backend, cache, bank, pha4, pha6 10/10, pha6-kiem-thu 105/105. `scan-secrets`: sạch.
  - Bài kiểm thử cũ chỉ đổi số phiên bản 1.6.0 → 1.7.0.
  - `APP_VERSION` đã tăng và `docs/VIEC-GIAO-VIEN.md` đã cập nhật (CLAUDE.md mục 6).
- Thử thêm bằng script tạm trong scratchpad, không đưa vào repo:
  - Lưu `notebookTag` 40 câu: **40 lần đọc cả trang `SoTay`** (`getDataRange`) cộng 80 lần đọc vùng, tất cả trong `withLock_`.
  - Gửi 2 mục trùng khóa trong cùng một lần lưu: không sinh hàng trùng (vẫn 40 hàng).
  - `notebookItem` 20 câu: 5 lần đọc `KetQua` cho `nbTimes_`.
- Ghi Sheet:
  - Mọi lần ghi đều trong `withLock_` và đọc thẳng Sheet (`fresh`). Mỗi (học sinh, câu) chỉ có một hàng.
  - `safe_` chặn chuỗi bắt đầu bằng `=` hoặc `+`. Cột của trang tính mới định dạng chữ (`@`) cả khi chạy `setup` lẫn khi tự tạo, nên ghi chú kiểu "3/4" hay "- nhớ…" không bị đổi thành ngày hay công thức.
  - Ghi chú dài nhất 500 ký tự, chi tiết lỗi tối đa 3 trường, mỗi trường ≤ 30 ký tự. Không ô nào chạm giới hạn 50 000 ký tự.
- Quyền:
  - `notebookTag` và `notebookNote` từ chối khóa không có trong sổ tay của chính học sinh. `notebookResult` lọc theo `studentId`.
  - `ma` phải thuộc danh sách loại lỗi và khác `CHUA_RO`. Ý con chỉ nhận cho Tính toán.
  - `BAT_SO_TAY = KHONG` chặn mọi API mới.
- Đệm: ghi sổ tay đổi `nbVer_` của chính học sinh sau khi ghi xong (đúng thứ tự). Học sinh B ghi không làm mất đệm của A. Giáo viên sửa tay trang `SoTay` thì đệm cũ tồn tại tối đa 60 giây (trong giới hạn §7).
- XSS: đã xem ghi chú (trong `textarea` qua `esc`), từ khóa (`esc` từng chữ), thẻ công thức (`rich()` thoát cả phần công thức), "Điều cần nhớ", dải nhắc trang chủ, thẻ kết quả (đoạn câu qua `nbPlain` rồi `esc`), thang đơn vị (giá trị lưu chỉ dùng khi khớp bảng hằng). Không thấy chỗ hở.
- Nút Bắt đầu: khóa trong lúc tải sổ tay. Lỗi tải hoặc không có lời nhắc thì mở lại. Nút cũng kiểm lại ô tick khi bấm. Luyện tập không hiện hộp.

## Bảng phát hiện

| Mã | Mức | File:dòng | Mô tả | Đề xuất sửa |
|---|---|---|---|---|
| R-1 | **Vừa** (dữ liệu: nộp bài của học sinh khác có thể lỗi) | `apps-script/Code.gs:3210` (`nbUpsert_`), `Code.gs:3232` (`apiNotebookTag_`) | `nbUpsert_` gọi `readTable_('SoTay', { fresh: true })` cho **từng** câu, nghĩa là đọc cả trang `SoTay` mỗi lần (đã đo: 40 câu → 40 lần đọc cả trang + 80 lần đọc vùng), tất cả khi đang giữ khóa ghi chung. `SoTay` chứa hàng của cả trường nên lớn dần; mỗi lần đọc cả trang có thể mất vài trăm mili giây. Một lần lưu khung "Em sai vì sao?" có thể giữ khóa nhiều giây. Ngay sau giờ kiểm tra cả lớp cùng lưu, nên `submitExam` của học sinh khác (`waitLock(20000)`) có thể hết thời gian chờ. Mỗi lần sửa thêm gọi `verifyRow_` (đọc thêm 1 ô). | Trong `withLock_`: đọc `SoTay` **một lần** (`rowsWhere_` theo `studentId` hoặc một lần `readTable_ fresh`), lập bảng `key → hàng`. Hàng mới gộp vào **một** `appendRows_`. Hàng có sẵn thì `updateRow_` (thường ít). Nên thêm test đếm `reads.SoTay ≤ 1` cho 40 câu. |
| R-2 | **Vừa** (mất chữ học sinh vừa gõ) | `assets/js/app.js:1048` (`nbQueueNote`), `app.js:1121` (`nbInput`), `app.js:1011`, `app.js:1038`, `app.js:1189` | Chữ đang gõ chỉ được ghi vào `nb.detail[key].ghiChu` hoặc `nb.data.ghiChuChung` **sau khi** máy chủ trả lời, tức ≥ 1,2 giây cộng thời gian mạng. Trong khoảng đó, nhiều thao tác vẽ lại ô ghi chú bằng nội dung cũ và làm mất con trỏ: `nbLoadDetail` (một câu khác tải xong, hoặc "Cách sửa ▸"), `nbSaveTag` (bấm chip, thay `nb.data` bằng dữ liệu máy chủ lúc ghi chú chung chưa lưu xong), công cụ đơn vị hoặc từ khóa, và lần vẽ thứ hai của `cached()`. Hẹn giờ vẫn gửi bản đã gõ, nhưng ô trên màn hình hiện bản cũ. Em gõ tiếp vào đó thì bản cũ cộng chữ mới được lưu, **ghi đè** bản mới hơn. Ngoài ra đóng tab hay tải lại trong 1,2 giây sẽ mất lần sửa cuối, vì không có lưu khi rời trang. | Trong `nbInput`, cập nhật **ngay** `nb.detail[key].ghiChu` hoặc `nb.data.ghiChuChung` (và `coGhiChu`). Khi vẽ lại, giữ ô đang có con trỏ (hoặc không vẽ lại ô đó). Sau `api('notebook')` trong `nbSaveTag`, giữ lại ghi chú chung đang chờ lưu. Thêm `pagehide` / `visibilitychange` để gửi ngay các ghi chú đang chờ. |
| R-3 | Nhẹ | `Code.gs:3268`, `Code.gs:3258` | Mỗi lần tự lưu ghi chú đổi `nbVer_`, nên lần lưu sau (`notebookNote` kiểm khóa câu qua `nbCompute_`) phải **tính lại cả sổ tay**: đọc `KetQua`, `KetQuaLuyenTap`, `SoTay`… cứ mỗi lần em ngừng gõ 1,2 giây. | Kiểm khóa câu bằng `nbEvents_` hoặc danh sách khóa nhẹ hơn, hoặc cập nhật trực tiếp `coGhiChu` / `ghiChuChung` trong bản đệm thay vì bỏ đệm. |
| R-4 | Nhẹ | `Code.gs:3194` (`nbTimes_`) | `rowsWhere_(…, 'id', rid)` đọc lại cả cột Mã bài cho **mỗi** mã bài khác nhau: 20 câu ở 20 bài thì ~40 lần đọc. Hàm lấy `[0]` mà không lọc `studentId`; nếu hiếm khi trùng mã bài (N-1 Pha 6) thì có thể lấy thời gian làm bài của học sinh khác. Chỉ lộ số giây, không lộ nội dung. | Lọc thêm `studentId`. Dùng `rowsWhere_(…, 'studentId', st.id)` một lần (đã có trong bộ nhớ khi tính sổ tay) rồi tìm theo `id`. |
| R-5 | Nhẹ | `Code.gs:3210` → `updateRow_(…, 'key', key)`, `verifyRow_` | Ô khóa dùng để kiểm hàng là `key`, mà `key` (mã kho) **trùng giữa các học sinh**. Nếu hàng bị dời (giáo viên sắp xếp hay xóa hàng đúng lúc đó) và chỉ còn một hàng khác có cùng `key`, đường dự phòng của `verifyRow_` có thể ghi vào hàng của học sinh khác. Rất hiếm, vì đã đọc thẳng trong khóa. | Kiểm cả `studentId`: so thêm ô Mã HS sau `verifyRow_`, hoặc truyền khóa ghép. |
| R-6 | Nhẹ | `assets/js/app.js:1256` (`nbExamReminder`) | Hộp "Điều cần nhớ" lấy `nhacNho` từ bản lưu trên máy nếu có (`nbFetch()` không làm mới), nên có thể là lời nhắc cũ. Không khóa nhầm, chỉ có thể nhắc lỗi đã khắc phục. | Chấp nhận, hoặc làm mới ngầm rồi vẽ lại hộp. |

Không có phát hiện mức **Nặng**. R-1 và R-2 xếp Vừa nhưng ảnh hưởng dữ liệu (lần nộp bài của học sinh khác, chữ học sinh đã gõ), nên theo quy tắc kết luận là CHƯA ĐẠT.

## Kết luận
**CHƯA ĐẠT** vì R-1 và R-2. Đề nghị người làm sửa ở vòng 2, kèm test đếm số lần đọc `SoTay` khi lưu 40 câu, và một bước e2e: gõ ghi chú rồi mở câu khác trước 1,2 giây, ghi chú vẫn còn. Các mục Nhẹ R-3 → R-6 có thể sửa cùng lúc hoặc để sang 7c.
