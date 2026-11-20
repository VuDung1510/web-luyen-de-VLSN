# Pha 6b — Soát code: sửa lỗi bảng kẻ gạch

Người soát code (độc lập) · 20/11/2026 · nhánh `pha-6b-bang-gach` (diff `main...pha-6b-bang-gach`)

## Tóm tắt cho giáo viên
1. Câu có bảng kẻ gạch như ví dụ thầy gửi giờ hiện thành bảng 3 cột "Lần đo | $U$ (V) | $I$ (mA)" với 3 hàng số; công thức trong ô vẫn hiện đẹp.
2. Chữ bình thường (dòng gạch lẻ, "---------- HẾT ----------", gạch đầu dòng, phép trừ, lời giải có dòng gạch) không bị biến nhầm thành bảng; khối `[BẢNG]` cũ giữ nguyên; không mất chữ, không chèn được mã độc.
3. Không phải dán lại Code.gs. Chỉ có vài điểm nhỏ ở trường hợp hiếm (ghi bên dưới), không chặn việc đưa lên.

## Đã kiểm
- `node tests/bang-gach.test.js`: 13/13 đạt. `node tests/backend.test.js`: 13 đạt. `node tests/importer.test.js`: đạt.
- `apps-script/Code.gs` không đổi (diff rỗng) → không cần tăng `APP_VERSION`.
- Tôi tự viết thêm script (`scratchpad/soat6b/s.js`, không đưa vào repo):
  - Ví dụ thật (viền "–" + chia cột "– – –" + 3 hàng): ra `<thead>` 3 ô, `<tbody>` 3×3, không còn dòng gạch, chữ trước/sau bảng giữ nguyên.
  - Giữ là chữ: "a / ---------- / b"; "---------- HẾT ----------"; "- ý a / - ý b / --- --- / - ý c"; "x = 5 - 3 - 1", "$a - b$"; "Lời giải: / ---------- / Ta có $F=ma$ / ---------- / Đáp số"; chữ + dòng chia cột không có dòng đóng.
  - Không mất chữ: dòng thừa ô được dồn vào ô (đối chiếu từng từ — 0 từ bị mất). Hàm tách ô không bao giờ trả về quá n ô.
  - XSS: `<img onerror>`, `"><script>` trong ô và `$<b>x</b>$` trong công thức đều bị escape (`&lt;…`).
  - Trang dùng `rich()`: học sinh (app.js 420/557/565), kết quả (common.js 504–534), trình soạn/hộp nhập (admin.js 491, mốc `\u0003` hình không bị ảnh hưởng vì nằm trong ô vẫn qua `inline()`), xem trước Ngân hàng (admin.js 876/1087/1124–1127). Tất cả đi qua cùng `inline()`/`esc()` nên an toàn như nhau.
  - Hiệu năng: 20 000 khối "--- --- ---/abc def" 63 ms; 20 000 cặp "chữ/--- ---" 41 ms; 50 000 hàng 109 ms; dòng 200 000 gạch 1 ms; 5 000 cột 13 ms. Vòng quét đi tiếp tối đa đến dòng gạch/dòng trống kế tiếp nên tổng thể gần tuyến tính; regex `dashSegs` không backtrack bùng nổ.

## Điểm cần lưu ý
- **R-1 (Nhẹ)** — `assets/js/common.js:364` `line.replace(/\s+$/, '')` có độ phức tạp bình phương khi một hàng bảng chứa một chuỗi khoảng trắng rất dài ở giữa (100 000 dấu cách → 4 s; 20 000 → 0,14 s). Nội dung do giáo viên nhập nên khó gặp. Đề xuất: dùng `line.trimEnd()`.
- **R-2 (Nhẹ)** — `assets/js/common.js:349,356`: có viền trên thì bảng được phép kết thúc ở dòng trống/hết nội dung; nếu viền dưới bị mất và câu hỏi viết liền ngay dưới (không có dòng trống) thì câu đó bị cuốn vào làm một hàng của bảng (không mất chữ, nhưng hiển thị sai chỗ). Đề xuất: chấp nhận được (không mất chữ); nếu muốn chặt hơn thì khi không có viền dưới, bỏ các hàng cuối không tách được đúng n ô ra khỏi bảng. Hướng dẫn giáo viên: bảng thiếu viền dưới thì để 1 dòng trống sau bảng.
- **R-3 (Nhẹ)** — `assets/js/common.js:340–344`: chữ thường mà ngay dưới là dòng có ≥ 2 đoạn gạch (vd "----- -----") rồi chữ rồi một dòng gạch đơn sẽ thành bảng (ví dụ "Tiêu đề / ----- ----- / nội dung / ----- / Kết" → bảng 2 cột "Tiêu | đề"). Mẫu này rất hiếm trong đề Vật lý; ghi nhận, không cần sửa ngay.
- **R-4 (Nhẹ, giới hạn đã biết)** — `assets/js/common.js:385–395`: khi khoảng trắng đã bị gộp, ô trống ở giữa hàng không thể nhận ra nên các ô sau dồn sang trái; ô có nhiều chữ không có công thức/không phải số sẽ dồn cả dòng vào ô đầu. Không mất chữ. Đề xuất: ghi vào hướng dẫn nhập kho — bảng phức tạp nên dùng khối `[BẢNG] a | b`.

## Kết luận
**ĐẠT.** Không có điểm Nặng/Vừa. R-1 nên sửa một dòng (`trimEnd()`) khi tiện; R-2…R-4 là trường hợp biên, ghi nhận.
