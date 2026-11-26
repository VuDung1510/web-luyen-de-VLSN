# Pha 7c — Đề khắc phục

## Tóm tắt cho giáo viên
- Học sinh tạo **đề khắc phục** từ chính các câu em đã sai: *Ôn trước giờ kiểm tra* (5 câu, 7 phút, nhắm loại lỗi nặng nhất), *Đề khắc phục* (10 câu, 15 phút), *Ôn lỗi này* (5 câu, 7 phút, cho một loại lỗi bấm trong sổ). Nút ở đầu Sổ tay, cạnh từng loại lỗi trong sổ, và thẻ "Đề khắc phục" trong trang Luyện tập.
- Đề gồm tối đa 2–4 **câu em từng sai làm lại được** (đề đã đóng và công bố lời giải) và **câu tương tự** cùng bài trong pool luyện tập (ưu tiên cùng mức độ, đúng phần với loại lỗi, câu em chưa làm). Thiếu câu thì web báo rõ.
- Làm đúng thì câu sai trong sổ tay chuyển **vàng**, đúng thêm ở ngày khác thì **xanh**; sai thì về **đỏ**. Trang kết quả báo câu nào vừa đổi màu.
- Bài ghi vào `KetQuaLuyenTap` (kiểu `KHAC_PHUC`), có lời giải ngay, không tính bảng xếp hạng.
- **Code.gs 1.8.0 là bản cuối để dán** (gồm 7a, 7b, 7c) — làm theo mục "Pha 7" đầu `docs/VIEC-GIAO-VIEN.md` sau khi Pha 7c được gộp.

## Người làm

### Đã làm
**Máy chủ (`apps-script/Code.gs` 1.7.0 → 1.8.0)**
- `practiceStart` thêm kiểu `KHAC_PHUC` (`nbFixStart_`): `mau` = `ON_NHANH` | `MUOI_CAU` | `MOT_LOI` (+ `ma`, có `HONG`). Phần phát đề tách thành `practiceIssue_` dùng chung với các kiểu cũ (không đổi hành vi cũ).
- Câu gốc làm lại được (`nbRedoQid_`): mã kho trong pool đang bật và không bị chặn, hoặc `examId#stt` của đề đã đóng + cho xem lời giải, câu nhập tay chưa bị sửa — cùng luật "Luyện câu đã sai" của Pha 4.
- Câu tương tự (`nbSimilar_`): cùng bài (100 điểm) hoặc cùng chương (50), +10 cùng mức độ, +8 đúng phần (Tính toán → Phần III, Sót → Phần II, còn lại cùng phần với câu gốc), +5 chưa làm; chia vòng tròn cho các câu sai, nặng nhất trước (Đề khắc phục ưu tiên câu "chưa biết làm", "đoán mò").
- Token `p` mang `goc` (song song `qids`, đã ký → sửa là bị từ chối). Bài nộp lưu `goc` từng câu; kết quả nộp có `khacPhuc` (màu trước/sau của câu gốc).
- Sổ tay: câu khắc phục là sự kiện phụ của câu gốc — đổi màu, không cộng "số lần sai"; trong một bài có cả đúng và sai thì tính sai.

**Giao diện:** nút đề khắc phục ở đầu Sổ tay (khi còn câu chưa xanh và mục Luyện tập bật), "Ôn lỗi này" cạnh từng loại sai ngoo và "Ôn phần hổng kiến thức" trong bản đồ; thẻ "🔧 Đề khắc phục từ sổ tay" ở trang Luyện tập; trang kết quả: dòng "Câu đã sai trước đây vừa đổi màu".

### Chỗ lệch / làm rõ đặc tả (đã ghi "Sửa đặc tả ngày 27/11/2026 (Pha 7c)")
1. Đề khắc phục cần cả `BAT_SO_TAY` và `CHO_LUYEN_TAP` (là một kiểu luyện tập, dùng pool).
2. Câu khắc phục chỉ đổi màu câu gốc, không cộng số lần sai; đúng + sai trong cùng bài → sai.
3. "Kiểm tra lại sau 7 ngày" của bản đề xuất ban đầu không nằm trong §7 nên không làm.

### Kiểm thử
- Mới: `tests/pha7c.test.js` 9/9 (TC-7.18 ×2, 7.19 ×2, 7.20, 7.21, 7.22, 7.23 khuyến nghị: notebook với 300 bài khoảng 100 ms trên shim chậm, các lỗi rõ ràng).
- Chạy lại: `pha7` 16/16, `pha7b` 12/12, `pha7a-kiem-thu` 28/28, `pha7b-kiem-thu` 16/16, `pha4` 22, `pha4-kiem-thu` 33/33, các test cũ đạt, `tests/e2e.js` ĐẠT. Số phiên bản trong test cũ 1.7.0 → 1.8.0.
- Bấm thử trên trình duyệt (1280×900): làm một đề nhanh sai hết → Sổ tay có hai nút và "Ôn lỗi này" → Đề khắc phục dựng 6 câu (pool thử ít câu cùng bài, có thông báo) → nộp → nhãn "Luyện tập · Đề khắc phục", thẻ Sổ tay. Không lỗi console.

### Ảnh
- `anh/pha-7c/01-so-tay-nut-de-khac-phuc-1280.png`, `anh/pha-7c/02-ket-qua-de-khac-phuc-1280.png`.

### Việc giáo viên cần làm
Sau khi Pha 7c gộp vào `main`: dán **Code.gs 1.8.0** một lần theo mục "Pha 7" đầu `docs/VIEC-GIAO-VIEN.md`. Đề khắc phục cần `CHO_LUYEN_TAP` = `CO` và pool luyện tập có câu các bài học sinh hay sai.
