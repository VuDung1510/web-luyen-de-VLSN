# Pha 6b — Kiểm thử độc lập: sửa lỗi "bảng kẻ gạch"

Người kiểm thử · 20/11/2026 · nhánh `pha-6b-bang-gach` · kịch bản viết theo đặc tả, trước khi đọc `assets/js/common.js` và `tests/bang-gach*`.

## Tóm tắt cho giáo viên
1. Câu hỏi có bảng kẻ bằng dòng gạch (như ví dụ "Lần đo · U (V) · I (mA)") giờ hiện thành bảng thật trên trang học sinh và trong ô "Xem trước" của trình soạn đề, công thức trong tiêu đề vẫn hiện đẹp, ở cả điện thoại (390 px) và máy tính.
2. Không chữ nào bị mất. Các dòng gạch kiểu "---------- HẾT ----------", gạch đầu dòng "- ý a", dòng "–––" trong lời giải vẫn hiện là chữ như cũ. Bảng `[BẢNG]` cũ không đổi.
3. Không cần dán lại Code.gs: bản sửa chỉ đổi phần giao diện. Có 1 lỗi nhỏ (K-1, hiếm gặp), không chặn phát hành.

## Cách chạy
```
node tests/pha6b-kiem-thu.test.js                                   # 97 kiểm tra + 4 ghi nhận
NODE_PATH=$(npm root -g) LIBS_DIR=… node tests/pha6b-kiem-thu.e2e.js all   # dev-server cổng 8790 (mới) và 8791 (SERVER_COMPAT=1.0.0)
```

## Kết quả theo ca

### Node — `tests/pha6b-kiem-thu.test.js` (97/97 đạt)
| Ca | Nội dung | Kết quả |
|---|---|---|
| A1 | Ví dụ thật của giáo viên → 1 bảng 3 cột × (1 tiêu đề `th` + 3 hàng `td`), ô đúng từng chữ; `$U$`, `$I$` giữ nguyên cho KaTeX; không còn dòng gạch in ra; đoạn trước/sau còn nguyên; cùng lớp `q-table` với `[BẢNG]`; `\r\n` cho cùng kết quả | Đạt |
| B1 | Không viền trên (tiêu đề → chia cột → dữ liệu → viền) | Đạt |
| B2 | Không tiêu đề (chia cột trên + dưới), dòng chữ ngay trên không bị coi là tiêu đề | Đạt |
| B3 / B4 | 2 cột, 4 cột (tiêu đề có công thức) | Đạt |
| B5 | Ô có công thức chứa dấu cách (`$\Delta t$ (s)`, `$v_0 + a t$`, `$2 \cdot 10^{3}$`) — không cắt giữa `$…$` | Đạt |
| B6 | Gạch "-" thường thay "–" | Đạt |
| B7 | Bảng giữa đoạn văn — thứ tự đoạn đầu → bảng → đoạn sau | Đạt |
| B8a/b/c | Hai bảng: cách dòng trống / cách dòng chữ / viền sát viền | Đạt (2 bảng, ô đúng) |
| B9 | Câu có cả `[BẢNG]` cũ và bảng kẻ gạch → 2 bảng; HTML `[BẢNG]` giống hệt khi đứng riêng | Đạt |
| B10a | Còn khoảng trắng canh cột (pandoc gốc, có viền) | Đạt |
| C1–C8 | KHÔNG thành bảng: dòng gạch đơn; "---------- HẾT ----------"; "–––––– HẾT ––––––"; "- ý a"; "$a - b$"; lời giải có dòng "–––"; viền–chữ–viền; chia cột không có dòng đóng; tiêu đề + chia cột không có hàng dữ liệu; "— — —" — chữ và dòng gạch vẫn in ra | Đạt |
| D1 | XSS: `<img src=x onerror=…>`, `<script>` trong ô, `<b onmouseover>` trong tiêu đề → escape, không có thẻ thật | Đạt |
| E1 | 400 đầu vào ghép ngẫu nhiên (bảng, gạch, `[BẢNG]`, chữ): không mất từ nào, không ném lỗi | Đạt |
| F1 | 5 000 dòng gạch (viền / chia cột / xen kẽ / chia cột không đóng / dòng 5 000 ký tự): 0,4–14 ms | Đạt (< 1 s) |
| N1–N4 | Ghi nhận (không tính đạt/không đạt) — xem K-1 và O-1 | — |

### Playwright — `tests/pha6b-kiem-thu.e2e.js` (đạt cả hai chế độ: máy chủ mới 13/13, máy chủ 1.0.0 13/13)
| Ca | Kết quả |
|---|---|
| Giáo viên lưu đề qua `adminSaveExam`, nội dung giữ nguyên văn | Đạt |
| Trình soạn đề → "Xem trước": 1 bảng, ô đúng, 2 công thức KaTeX trong `th`; lời giải có "–––" vẫn là chữ | Đạt |
| Gõ bảng 4 cột vào ô "Nội dung" → xem trước cập nhật thành bảng 4 cột, 3 KaTeX trong tiêu đề | Đạt |
| Học sinh làm bài 1280 px và 390 px: 1 `<table>`, 3 `th`, 2 `.katex` trong `th`, ô đúng, không còn dòng gạch, không cuộn ngang trang | Đạt |
| Không lỗi JS / console (quản trị + học sinh) | Đạt |

Ảnh: `docs/bao-cao/anh/pha-6b/kt-01-bang-gach.png` (1280), `kt-01-bang-gach-390.png` (390), `kt-02-xem-truoc.png` (trình soạn).

### Chạy lại (hồi quy)
| Bộ | Kết quả |
|---|---|
| `importer.test.js` | Đạt |
| `docx.test.js` | 29/29 |
| `pha2-kiem-thu.test.js` | 31/31 |
| `pha2-kiem-thu.e2e.js all` (TC-2.12 `[BẢNG]` 2 cột × 5 hàng) | 16/16 nhóm |
| `backend.test.js`, `common-cache.test.js` | 13, 5 đạt |
| `e2e.js` máy chủ mới (cổng 8792) và `SERVER_COMPAT=1.0.0` (cổng 8793) | Đạt cả hai |

## Lỗi
**K-1 (nhẹ, không chặn).** Bảng có tiêu đề, **không có viền trên** và **dòng đóng là dòng chia cột nhiều đoạn** (thay vì viền 1 đoạn) → dòng tiêu đề bị in thành chữ thường phía trên, bảng chỉ còn các hàng dữ liệu (không mất chữ). Ví dụ (N1, N2):
```
Lần đo $U$ (V) $I$ (mA)
–––– –––– ––––
1 5,88 120
–––– –––– ––––
```
Nguyên nhân (đọc sau khi viết kịch bản): `dashTable()` chỉ nhận tiêu đề khi có viền trên hoặc viền đóng 1 đoạn; dạng trên trùng mẫu "bảng không tiêu đề" nên dòng chữ đứng trên bị bỏ ra ngoài. Ở N2 (khoảng trắng canh cột còn nguyên, tiêu đề thẳng cột với các đoạn gạch) có thể nhận ra là tiêu đề. Chưa gặp dạng này trong ví dụ thật; nếu kho có, nên coi dòng chữ ngay trên dòng chia cột là tiêu đề khi nó tách được đúng n ô (theo công thức hoặc theo vị trí).

**Ghi nhận (không phải lỗi theo đặc tả):**
- O-1: dòng mơ hồ không tách được đúng n ô thì cả dòng vào ô đầu, các ô sau trống (đúng quy tắc "không mất chữ" của người làm). Ví dụ tiêu đề "Lần đo $U$ (V) Ghi chú" (N3), "Chất Nhiệt dung riêng (J/kg.K)" (N4), hàng "1 5,88 <img …>" (D1). Hiển thị hơi lạ nhưng đủ chữ; giáo viên sửa được bằng cách chuyển sang `[BẢNG] a | b`.
- O-2: khung viền bo góc `.table-wrap` rộng hết khung câu trong khi bảng chỉ rộng ≥ 50% (thấy trong ảnh 1280). Đây là CSS dùng chung với `[BẢNG]` từ trước, không do bản sửa này.

## Kết luận
**Đạt — có thể gộp.** Mọi ca theo đặc tả (ví dụ thật, biến thể, không nhận nhầm, XSS, không mất chữ, hiệu năng, giao diện học sinh và trình soạn, máy chủ mới và 1.0.0) đều đạt; hồi quy không vỡ. Còn K-1 (nhẹ, dạng hiếm) để người làm quyết định sửa ngay hoặc ghi lại.
