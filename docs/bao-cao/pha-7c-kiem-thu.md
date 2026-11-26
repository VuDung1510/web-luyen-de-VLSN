# Pha 7c — Kiểm thử (người kiểm thử độc lập)

Ngày 27/11/2026 · commit `d16b81d` + `f010456` (Code.gs 1.8.0) · kịch bản viết theo `docs/spec/pha-7-so-tay.md` §7 "Đề khắc phục (7c)", TC-7.18 → TC-7.23 và dòng "Sửa đặc tả ngày 27/11/2026 (Pha 7c)", **trước khi** đọc code tính năng. Sau khi có kết quả, tôi đọc hàm chọn câu tương tự (`nbSimilar_`) để giải thích chỗ chưa đạt ở TC-7.20.

## Tóm tắt cho giáo viên
1. Học sinh bấm "Ôn trước giờ kiểm tra", "Đề khắc phục" (ở đầu Sổ tay và trang Luyện tập) hoặc "Ôn lỗi này" (cạnh từng lỗi) thì có ngay đề 5 hoặc 10 câu, đúng số phút, không lộ đáp án.
2. Làm đúng câu khắc phục thì câu sai cũ chuyển vàng, đúng thêm ở ngày khác thì xanh; làm sai thì về đỏ. Trang kết quả ghi rõ câu nào vừa đổi màu.
3. Câu của đề chưa công bố lời giải không bao giờ lọt vào đề khắc phục (thử 100 lần). Bài khắc phục không vào bảng điểm, bảng xếp hạng.
4. Tắt Luyện tập hoặc tắt Sổ tay thì các nút biến mất; máy chủ cũ (1.0.0, 1.5.0) không có nút; mọi trang khác vẫn chạy.
5. Một điểm cần sửa nhỏ: khi chọn câu tương tự, máy ưu tiên "cùng mức độ" hơn "đúng phần", nên lỗi Sót ý chưa chắc được ôn bằng câu Phần II, lỗi tính toán chưa chắc được ôn bằng câu Phần III như đặc tả nói.

## Kết quả theo tiêu chí
| Mã | Mô tả | Kết quả | Bằng chứng |
|---|---|---|---|
| TC-7.18 | `MUOI_CAU`: ≤ 4 câu gốc + câu tương tự cùng bài, đủ 10; không lộ; câu đề chưa công bố không xuất hiện | **ĐẠT** | Node (`tests/pha7c-kiem-thu.test.js`): sai 6 câu Bài 9 → 10 câu, 900 giây, 1–4 câu gốc, mọi câu cùng Bài 9, token có `goc` song song `qids`, phản hồi không có `dapAn`/`loiGiai`/`maKho`. Pool thiếu (Bài 14 chỉ 4 câu) → lấy cùng chương, báo "Chỉ dựng được 4 câu". 100 lần dựng (MUOI_CAU, ON_NHANH, MOT_LOI) khi có câu gốc ở đề mở NGAY, mở SAU_HAN, đóng KHONG và câu nhập tay của đề đang thi: **không lần nào** có câu đó; đóng đề NGAY thì câu được dùng lại. E2E: bấm "Đề khắc phục" → 10 câu, 15 phút |
| TC-7.19 | Vàng → vàng (cùng ngày) → xanh (ngày 2) → đỏ (sai lại) | **ĐẠT** | Node: câu gốc X đỏ; đúng câu khắc phục ngày 05/11 → vàng, `khacPhuc` báo đỏ → vàng; lần nữa cùng ngày vẫn vàng; ngày 06/11 → xanh; sai lại → đỏ; "số lần sai" của X không đổi. Trong một bài, một câu khắc phục đúng + một câu sai cho cùng câu gốc → đỏ; câu khắc phục sai thành mục riêng trong sổ. E2E: làm đúng hết → 6 câu gốc đỏ → vàng, trang kết quả có mục "Câu đã sai trước đây vừa đổi màu", sổ tay hiện 6 đèn vàng; bỏ trống bài "Ôn lỗi này" → vàng → đỏ |
| TC-7.20 | `ON_NHANH` 5 câu 420 giây nhắm loại lỗi đỏ nặng nhất; `MOT_LOI` `ma = SOT` ưu tiên Phần II | **KHÔNG ĐẠT** (phần ưu tiên Phần II/III — K-1) | ĐẠT: `ON_NHANH` 10/10 lần đúng 5 câu, 420 giây, mọi `goc` là câu của loại lỗi đỏ (Sót ý) dù có loại Đọc đề vàng; E2E "Ôn lỗi này", "Ôn trước giờ kiểm tra" → 5 câu, 420 giây; thiếu `ma`, mẫu lạ, `ma` không có câu → báo lỗi rõ. CHƯA ĐẠT: `MOT_LOI SOT` với câu gốc Phần II (mức "Hiểu"): trung bình chỉ **1/3** câu tương tự là Phần II (bài còn 3 câu Phần II); câu gốc Phần I bỏ trống: **0/4**; `TINH_TOAN` gốc Phần III: **1/3** câu Phần III. Câu cùng mức độ ở phần khác được chọn trước |
| TC-7.21 | Ghi `KetQuaLuyenTap`, KetQua không thêm; xếp hạng, bảng điểm, gợi ý không đổi | **ĐẠT** | Node: KetQuaLuyenTap +1 hàng `Kiểu = KHAC_PHUC`, `chiTiet` mọi câu có `goc`, KetQua không đổi; `leaderboard`, `myStats`, `myResults`, `adminResults` giống hệt trước khi nộp; kết quả có lời giải ngay. E2E: trang kết quả có đáp án/lời giải, không có nút Bảng xếp hạng |
| TC-7.22 | Token bị sửa `goc` hoặc `qids` → từ chối | **ĐẠT** | Sửa `goc[0]`, `qids[0]`, cắt bớt `goc` mà không ký lại → cả 3 bị từ chối. (Thử thêm: nếu có khóa ký của máy chủ thì `goc` trỏ câu lạ được nhận, câu lạ đó chỉ thành mục sai bình thường, không làm đổi màu câu khác — kẻ gian thật không có khóa này) |
| TC-7.23 (khuyến nghị) | 300 bài nộp, `notebook` < 3 giây với `SHEET_READ_MS` | **ĐẠT** | 300 bài × 15 câu của một học sinh, `SHEET_READ_MS = 300`, đệm trống: `notebook` ≈ 1,2 giây |
| Tắt / máy chủ cũ | Cần cả `BAT_SO_TAY` và `CHO_LUYEN_TAP` | **ĐẠT** | Node: tắt Sổ tay → "Giáo viên đang tắt sổ tay." (TU_TAO vẫn chạy); tắt Luyện tập → "Giáo viên đang tắt luyện tập.". E2E: tắt một trong hai → không nút nào ở Sổ tay và Luyện tập; máy chủ 1.0.0, 1.5.0: không có nút, không lỗi JS |
| Giao diện | 1280/390, sáng/tối | **ĐẠT** | Nút ở đầu Sổ tay, cạnh dòng lỗi ("Ôn lỗi này") và thẻ "🔧 Đề khắc phục từ sổ tay" ở Luyện tập; làm bài, trang kết quả — không tràn ngang ở cả 4 khổ/chế độ, không lỗi JS |

Bài kiểm thử: `tests/pha7c-kiem-thu.test.js` **14/16** (2 ca chưa đạt đều thuộc K-1); `tests/pha7c-kiem-thu.e2e.js all`: mọi mục ĐẠT.

### Test cũ
backend 13, importer, bank 30, cache 17, common-cache 5, bang-gach 13, docx 30/30, pha1–pha4 kiểm thử, pha6 10/10, pha6-kiem-thu 105/105, pha6b 97/97, pha6b-hinh 30/30, pha7 16, pha7a-kiem-thu 28/28, pha7b 12, pha7b-kiem-thu 16/16, pha7c 9, `scan-secrets` sạch: **ĐẠT**. `pha7a-kiem-thu.e2e.js all`, `pha7b-kiem-thu.e2e.js all`: **ĐẠT**. `tests/e2e.js` máy chủ mới và `SERVER_COMPAT=1.0.0` (dev-server riêng): **ĐẠT**. TC-5.1 (Pha 5) vẫn chỉ báo bảng màu Sổ tay, chờ giáo viên chốt. Ảnh Pha 7a, 7b bị các e2e cũ ghi đè đã được trả về (`git checkout`).

## Lỗi và ghi nhận
| # | Mức | Mô tả | Cách tái hiện |
|---|---|---|---|
| K-1 | Nhẹ | Chọn câu tương tự: "cùng mức độ" (+10 điểm) được ưu tiên hơn "đúng phần" (+8 điểm, `nbSimilar_`), nên khi bài có câu cùng mức độ ở phần khác thì lỗi Sót ý ít được ôn bằng câu Phần II, lỗi Tính toán ít được ôn bằng câu Phần III (TC-7.20). Đề xuất: cho "đúng phần" nặng hơn "cùng mức độ", hoặc kiến trúc sư ghi rõ thứ tự ưu tiên trong đặc tả | Kho: Bài 9 có P1 mức Biết/Hiểu xen kẽ, P2 Hiểu–Hiểu–Vận dụng–Vận dụng; bỏ trống ý một câu P2 mức Hiểu rồi gọi `MOT_LOI ma=SOT` 20 lần → trung bình 1/3 câu tương tự là P2 (`tests/pha7c-kiem-thu.test.js`, hai ca TC-7.20) |
| G-1 | Ghi nhận | `MOT_LOI ma=HONG` chỉ lấy câu "Chưa biết làm"/"Đoán mò"; sổ chỉ có câu "Chưa phân loại" thì báo "chưa có câu sai nào cần khắc phục" (dù sổ tay xếp câu chưa phân loại vào nhóm Hổng kiến thức). Chưa kiểm trên giao diện xem nhóm Hổng kiến thức có nút "Ôn lỗi này" hay không. `MUOI_CAU` vẫn dùng các câu này | Sổ chỉ có câu P1 sai chưa phân loại → `practiceStart {kieu:KHAC_PHUC, mau:MOT_LOI, ma:HONG}` |
| G-2 | Ghi nhận | Câu gốc ở đề **chưa công bố** không xuất hiện, nhưng vẫn được làm "đích" (`goc`) cho câu tương tự cùng bài; làm đúng thì câu đó đổi màu. Không lộ nội dung hay đáp án; đặc tả không cấm | 100 lần dựng ở ca TC-7.18 |
| G-3 | Ghi nhận | `khacPhuc` trong kết quả nộp có cả mục không đổi màu (đỏ → đỏ); giao diện chỉ hiện các mục thực sự đổi màu | Bỏ trống bài "Ôn lỗi này" khi có câu gốc đang đỏ |
| G-4 | Ghi nhận | Câu xanh không còn được chọn làm câu gốc (không còn gì để khắc phục): hợp lý | Đưa câu lên xanh rồi gọi `MOT_LOI` |

Không có lỗi Nặng hay Vừa.

## Ảnh (`docs/bao-cao/anh/pha-7c/`)
- `kt-01-so-tay-nut-khac-phuc-1280.png` — nút "Ôn trước giờ kiểm tra", "Đề khắc phục" ở đầu sổ tay, "Ôn lỗi này" cạnh dòng lỗi.
- `kt-02-lam-de-khac-phuc-1280.png` — đang làm đề khắc phục 10 câu.
- `kt-03-ket-qua-doi-mau-1280.png`, `kt-03b-ket-qua-ve-do-1280.png` — trang kết quả báo câu đổi màu (đỏ → vàng; vàng → đỏ).
- `kt-04-luyen-tap-de-khac-phuc-1280.png` — thẻ "Đề khắc phục từ sổ tay" ở trang Luyện tập.
- `kt-05-so-tay-*.png`, `kt-06-luyen-tap-*.png`, `kt-07-ket-qua-*.png` — 390 sáng, 390 tối, 1280 tối.
- `kt-08-tat-luyen-tap-so-tay-1280.png` — tắt Luyện tập: không có nút.
- `kt-compat-100-390.png`, `kt-compat-150-390.png` — máy chủ cũ.

## Hạ tầng test
Không sửa `gas-shim.js`, `dev-server.js`. Bài Node chép các hàm trợ giúp của `tests/pha4-kiem-thu.test.js` (thế giới thử, pool, sổ đáp án, token).

## Cách chạy
```
node tests/pha7c-kiem-thu.test.js
NODE_PATH=$(npm root -g) LIBS_DIR=<node_modules có katex, chart.js> node tests/pha7c-kiem-thu.e2e.js [new|compat|all]
```
