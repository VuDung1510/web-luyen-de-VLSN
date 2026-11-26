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

## Người làm — Vòng 2 (soát CHƯA ĐẠT vì R-1; kiểm thử: TC-7.20 KHÔNG ĐẠT một phần vì K-1)

| Phát hiện | Đã sửa |
|---|---|
| R-1 (Vừa) làm lại câu gốc sai + câu tương tự đúng cùng bài → vàng | Trong một bài luyện, mọi lần làm đúng (kể cả câu khắc phục) xếp trước, lần sai xếp sau → câu gốc về đỏ. Kiểm thử "Vòng 2 (R-1)" (hai ngày liền vẫn đỏ). |
| K-1 (Nhẹ) câu tương tự chưa ưu tiên đúng phần | Đúng phần +20 (Tính toán → Phần III, Sót → Phần II) hơn cùng mức độ +10. `pha7c-kiem-thu` 16/16 (trước 14/16). |
| R-2 (Nhẹ) ON_NHANH chọn loại chỉ còn câu đã gỡ | Chọn loại lỗi nặng nhất **còn câu dùng được**. |
| R-3 (Nhẹ) tìm câu tương tự duyệt cả pool | Chia pool theo bài và chương một lần, mỗi câu sai chỉ xét câu cùng bài / chương. |
| G-1 "Ôn phần hổng kiến thức" bỏ câu chưa phân loại | Gồm cả câu chưa phân loại (như bản đồ trong sổ); nút hiện khi nhóm có câu. |
| G-3 `khacPhuc` có cả câu không đổi màu | Chỉ trả câu đổi màu. |
| R-4 (Nhẹ) nộp đề khắc phục tính sổ tay 2 lần | Giữ: chỉ ở kiểu khắc phục, ngoài khóa; cần màu trước/sau để báo cho học sinh. |
| G-2 câu gốc của đề chưa công bố vẫn làm đích câu tương tự | Giữ: không lộ nội dung/đáp án (câu tương tự từ pool đã kiểm chặn); đặc tả không cấm. |

Kiểm thử vòng 2: `pha7c` 11/11, `pha7c-kiem-thu` 16/16, `pha7c-kiem-thu.e2e.js all` ĐẠT, `pha7`, `pha7b`, `pha7a-kiem-thu`, `pha7b-kiem-thu`, `pha4`, `pha4-kiem-thu`, backend, bank, cache, `pha6`, `pha6-kiem-thu` đạt, `scan-secrets` sạch.

## Kết luận Pha 7c
- Soát code vòng 2 **ĐẠT**, kiểm thử vòng 2 **ĐẠT** (TC-7.18 → 7.23; `pha7c-kiem-thu` 17/17, e2e đạt).
- Sửa thêm ghi nhận Nhẹ của soát vòng 2: chỉ mục pool theo bài/chương dùng `Object.create(null)` (tên bài trùng thuộc tính có sẵn không làm hỏng). Chạy lại `pha7c` 11/11, `pha7c-kiem-thu` 17/17.
- **Pha 7 xong.** Bản để giáo viên dán: **Code.gs 1.8.0**.
