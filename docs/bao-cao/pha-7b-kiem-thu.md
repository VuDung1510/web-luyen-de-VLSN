# Pha 7b — Kiểm thử (người kiểm thử độc lập)

Ngày 27/11/2026 · commit cục bộ `c9c1001` + `d563d44` (Code.gs 1.7.0) · kịch bản viết theo `docs/spec/pha-7-so-tay.md` (§5, §6, §7 phần 7b, TC-7.9 → TC-7.17, dòng "Sửa đặc tả ngày 27/11/2026") và QUYET-DINH §5, **trước khi** đọc code tính năng. Giao diện được dò bằng cách xem trang đang chạy trên dev-server.

## Tóm tắt cho giáo viên
1. Sau khi nộp bài, trang kết quả có thẻ "Em sai vì sao?" liệt kê đủ các câu sai, chọn sẵn lý do máy chắc chắn, có "Bỏ qua" (tải lại không hiện lại) và nút "Phân loại lỗi" để mở lại.
2. Em chọn lý do thì thắng máy đoán, đổi lại được; mỗi câu chỉ một dòng trong Sheet; không gắn được câu của bạn khác.
3. Ghi chú tự lưu sau khoảng 2 giây, tải lại vẫn còn, tối đa 500 ký tự, gõ mã HTML không chạy; chữ trong sổ vẫn nằm đúng giữa hai dòng kẻ khi mở "Cách sửa" và khi ghi chú dài nhiều dòng.
4. Bốn công cụ sửa lỗi chạy đúng (thang đơn vị, tập gạch từ khóa, thẻ công thức, bảng chia giờ 15/15/12/8 co giãn theo đề); trước đề thi phải tick "Em đã đọc" mới bắt đầu được, luyện tập thì không hỏi; trang chủ có dải nhắc khi có lỗi lặp lại.
5. Hai điểm nhỏ cần sửa: trang kết quả chưa ghi "Lỗi này em đã mắc n lần" (có ghi "đang lặp lại" nhưng không có số lần); thang đơn vị báo "đúng" cả khi em chọn đơn vị không khớp với độ lệch máy đã biết.

## Kết quả theo tiêu chí
| Mã | Mô tả | Kết quả | Bằng chứng |
|---|---|---|---|
| TC-7.9 | Khung "Em sai vì sao?" | **ĐẠT** | E2E: nộp đề (trên web) có 3 câu sai → thẻ trong trang kết quả, dưới khung điểm, không có hộp nổi che trang; 3 câu × 6 chip (4 Sai ngoo + Chưa biết làm + Đoán mò); câu bỏ trống chọn sẵn "Sót ý". "Bỏ qua" → ẩn; tải lại → không hiện lại; "Phân loại lỗi" → mở lại đủ 3 câu. Bài luyện tập cũng có thẻ; câu Phần II sai đúng 1 ý (máy chưa chắc) có chip dấu "?". Máy chủ: `notebookResult` chỉ trả câu sai của bài đó, không có nội dung/đáp án, `daPhanLoai` false → true sau khi gắn; bài của học sinh khác bị từ chối; bài không có câu sai → rỗng; `lapLai` đúng |
| TC-7.10 | `notebookTag` | **ĐẠT** | Node: chọn của em thắng máy đoán (`nguon = HS`), đổi lại được, `TINH_TOAN` có ý con, Đoán mò tính vào Hổng kiến thức; gắn 4 lần + ghi chú cùng key → **1 hàng** `SoTay`; từ chối câu bạn sai/câu em làm đúng/key bịa ("Câu này không có trong sổ tay của em."), mã lỗi lạ; lô lẫn key hợp lệ + không hợp lệ không ghi key lạ; ≤ 40; bỏ chọn → về máy đoán; chuỗi bắt đầu "=" không vào ô như công thức; nhãn của B không đổi sổ của A. E2E: chọn trong thẻ kết quả rồi Lưu, và bấm chip trong chi tiết câu → máy chủ ghi `DOC_DE / HS` |
| TC-7.11 | Ghi chú | **ĐẠT** | Node: ghi chú câu và `_CHUNG` đọc lại đúng (`ghiChuChung`, `ghiChu`, `coGhiChu`); 600, 700 ký tự → cắt 500; xóa được; key không phải câu sai của em bị từ chối; B không thấy ghi chú của A. E2E: gõ ghi chú chung 5 dòng và ghi chú câu có `<img onerror>`, `<script>` → "Đã lưu" sau ~2 giây; tải lại còn nguyên; hiện nguyên văn, không chạy mã, không sinh thẻ `img`; ô nhận tối đa 500 ký tự |
| TC-7.12 | Công cụ đơn vị | **ĐẠT** (có 1 ca biên chưa đạt, xem K-2) | Câu 2500/25: đại lượng Chiều dài, thang km hm dam m dm cm mm µm nm, chỉ "m" khung đậm, "Đáp án của em lệch đúng 10² lần"; em dùng cm → chọn m → báo đúng "1 cm = 10⁻² m…"; nhiệt độ → công thức cộng (T = t + 273), không có thang nhân |
| TC-7.13 | Tập gạch từ khóa | **ĐẠT** | Câu có "không", "làm tròn", "5 cm": gạch "không" rồi "So sánh" → "không" tô màu "em gạch", "làm", "tròn" tô màu "bỏ sót", "5" tô màu dữ kiện số. Node: `tuKhoa` đủ danh sách mặc định §5.2 (kể cả "lấy g ="); thêm từ khóa trong Cài đặt có hiệu lực ngay |
| TC-7.14 | Thẻ công thức | **ĐẠT** | Bài có hàng `CongThuc` (gieo qua dev-server): tên gợi nhớ chữ to hơn chữ thường (17,6 / 16 px), công thức hiện bằng KaTeX, phạm vi, dấu hiệu; hàng `bat = KHONG` không hiện (Node); bài không có → "Thầy chưa nhập công thức… Em ghi công thức đúng vào ô ghi chú" |
| TC-7.15 | Thời gian từng phần | **ĐẠT** | Đề 50 phút: 15′/15′/12′/8′; đề 25 phút: 7,5′/7,5′/6′/4′; bài làm trên web (có `t`) có cột "Em xong", bài không có `t` để "—". Node: `t` 120, 300 giây được lưu; `t` âm, lớn hơn thời gian làm, không phải số bị bỏ; `thoiGian = {phut 25, daLam 600, xong {1: 300}}` (lần sửa cuối trong phần) |
| TC-7.16 | "Điều cần nhớ" trước đề thi | **ĐẠT** | Có lỗi đỏ: hộp sau hộp mục tiêu, 1–3 dòng; "Bắt đầu" bị khóa (bấm không vào bài) tới khi tick "Em đã đọc". Học sinh chưa có lỗi: không có hộp, bấm Bắt đầu được. Luyện tập (đề nhanh): không có hộp. Node: `nhacNho` ≤ 3 dòng, chỉ loại Sai ngoo đỏ/vàng, đỏ trước, sổ trống → rỗng |
| TC-7.17 | Dải nhắc trang chủ | **ĐẠT** | Có lỗi đỏ: "Em có 1 lỗi đang lặp lại: Sót ý … Xem sổ tay →"; học sinh không có lỗi đỏ: không có dải |
| TC-7.7 (phần 7b) | Tắt sổ tay / máy chủ cũ | **ĐẠT** | `BAT_SO_TAY = KHONG`: `notebookTag`, `notebookNote`, `notebookResult` báo "Giáo viên đang tắt sổ tay", không ghi `SoTay`; giao diện không có dải nhắc, hộp "Điều cần nhớ", thẻ Sổ tay ở trang kết quả. Giả lập 1.0.0 và 1.5.0: không có các phần trên, bắt đầu và nộp bài bình thường (điểm 2,5), không lỗi JS |
| TC-7.8 (phần ghi) | Sheet cũ | **ĐẠT** | Xóa trang `SoTay` → `notebookTag` lần đầu tự tạo trang đúng tiêu đề, 1 hàng |
| Dòng kẻ 32px | Chữ giữa hai dòng kẻ khi mở "Cách sửa ▸" và ghi chú nhiều dòng | **ĐẠT** | Đo bằng điểm ảnh ở 1280 sáng/tối, 390 sáng/tối: mọi dòng chữ ngoài khối công cụ cách dòng kẻ phía trên 16 ± 4 px; khối công cụ cao 192–608 px, đều là bội 32; ô ghi chú 5 dòng: dòng cao 32 px, mép chữ khớp dòng kẻ, không thanh cuộn |
| Không tràn ngang | 390 và 1280 | **ĐẠT** | Trang bắt đầu, trang kết quả (thẻ 3 câu), sổ tay + công cụ, ở cả sáng và tối |

Bài kiểm thử: `tests/pha7b-kiem-thu.test.js` **16/16**; `tests/pha7b-kiem-thu.e2e.js all`: mọi TC đạt, chỉ 2 kiểm tra ngoài TC chưa đạt (K-1, K-2); không lỗi JS.

### Test cũ
backend 13, importer, bank 30, cache 17, common-cache 5, bang-gach 13, docx 30/30, pha1-kiem-thu 29/29, pha2-kiem-thu 31/31, pha3-kiem-thu 17/17, pha4 22, pha4-kiem-thu 33/33, pha6 10/10, pha6-kiem-thu 105/105, pha6b-kiem-thu 97/97, pha6b-hinh 30/30, pha7 16, pha7a-kiem-thu 28/28, pha7b 9, `scan-secrets` sạch: **ĐẠT**. `tests/pha7a-kiem-thu.e2e.js all`: TC-7.6, TC-7.7 **ĐẠT**. `tests/e2e.js` máy chủ mới và `SERVER_COMPAT=1.0.0` (mỗi lần một dev-server riêng): **ĐẠT**. `pha5.test.js` / `pha5-kiem-thu.test.js`: TC-5.1 vẫn báo bảng màu Sổ tay như Pha 7a (chờ giáo viên chốt), không có màu mới ngoài nhóm đó.

## Lỗi tìm được
| # | Mức | Mô tả | Cách tái hiện |
|---|---|---|---|
| K-1 | Nhẹ | Trang kết quả ghi "Câu 3: Sót ý…: lỗi này đang lặp lại trong sổ tay của em." nhưng đặc tả §7 yêu cầu dòng "Lỗi này em đã mắc **n** lần" (thiếu số lần) | Có lỗi Sót ý đỏ (3 câu bỏ trống ở 2 đề), làm thêm một đề và bỏ trống 1 câu → xem thẻ Sổ tay ở trang kết quả |
| K-2 | Nhẹ | Công cụ đơn vị: máy đã biết đáp án lệch 10², nhưng em chọn "cm → mm" (chỉ 10¹) vẫn báo xanh "1 cm = 10¹ mm…" giống khi chọn đúng "cm → m". Phép đổi đúng, nhưng học sinh không biết mình chọn chưa đúng đơn vị. Đề xuất: khi đã biết 10ⁿ, cặp đơn vị không khớp thì báo "chưa khớp với độ lệch 10ⁿ" | Câu Phần III đáp án 25, em 2500, đề đã đóng → Sổ tay → mở câu → bấm cm rồi mm |
| Ghi nhận | — | Ở 390 px, thang đơn vị trong "Cách sửa" phải vuốt ngang mới thấy hết (trang không tràn); bảng chia giờ khá chật (chữ "trước phút 15" xuống dòng). Chấp nhận được | `kt-13-so-tay-cach-sua-390.png` |

Không có lỗi Nặng hay Vừa.

## Ảnh (`docs/bao-cao/anh/pha-7b/`)
- `kt-01-trang-chu-dai-nhac-1280.png`, `kt-10-trang-chu-{390,390-toi,1280-toi}.png` — dải nhắc trang chủ.
- `kt-02-dieu-can-nho-1280.png`, `kt-11-dieu-can-nho-*.png` — hộp "Điều cần nhớ", nút Bắt đầu khóa.
- `kt-03-em-sai-vi-sao-1280.png`, `kt-12-ket-qua-so-tay-*.png`, `kt-15-ket-qua-luyen-tap-1280.png` — thẻ "Em sai vì sao?".
- `kt-04-cong-cu-don-vi-1280.png`, `kt-05-tap-gach-tu-khoa-1280.png`, `kt-06-the-cong-thuc-1280.png`, `kt-07-bang-thoi-gian-1280.png`, `kt-14-cong-cu-*.png` — 4 công cụ.
- `kt-08-cach-sua-trong-so-1280.png`, `kt-13-so-tay-cach-sua-*.png` — mở "Cách sửa ▸" trong sổ, ghi chú chung 5 dòng.
- `kt-compat-100-ket-qua-390.png`, `kt-compat-150-ket-qua-390.png` — máy chủ cũ.

## Hạ tầng test đã sửa
- `tests/dev-server.js`: thêm biến `CONG_THUC` (JSON) để gieo hàng vào trang `CongThuc` khi khởi động (Sheet thật do giáo viên nhập tay, không có API) — dùng cho TC-7.14. Không ảnh hưởng khi không đặt biến.
- `tests/pha7b-kiem-thu.test.js` tự thay `Date` trong vm của shim (chỉ trong bài này) để tua giờ làm bài, vì máy chủ tính "thời gian đã làm" bằng giờ thật chứ không qua `nowMs_()` của shim. Không sửa `gas-shim.js`.

## Cách chạy
```
node tests/pha7b-kiem-thu.test.js
NODE_PATH=$(npm root -g) LIBS_DIR=<node_modules có katex, chart.js> node tests/pha7b-kiem-thu.e2e.js [new|compat|all]
```

## Vòng 2
Ngày 27/11/2026 · commit `b23740e` ("Pha 7b vòng 2") · đã chạy lại **toàn bộ** TC-7.9 → 7.17 và test cũ (00-quy-trinh §2.3), thêm ca kiểm cho các sửa đổi vòng 2.

**Kết luận vòng 2: ĐẠT.** Mọi TC đạt; K-1 và K-2 đã sửa; không có lỗi mới.

| Mã | Vòng 2 | Bằng chứng |
|---|---|---|
| TC-7.9 | ĐẠT | Như vòng 1 (thẻ 3 câu, chọn sẵn, Bỏ qua, mở lại, luyện tập, chip "?") |
| TC-7.10 | ĐẠT | Node 16/16 (gồm lô lẫn key, 1 hàng/câu); chọn trên giao diện ghi đúng |
| TC-7.11 | ĐẠT | Như vòng 1; **thêm**: đang gõ ghi chú câu thì bấm chip ở câu khác, mở "Cách sửa ▸", một câu khác tải xong → ô vẫn đủ chữ "một hai ba bốn năm", con trỏ ở cuối, vẫn trong ô; máy chủ lưu đúng. Gõ rồi chuyển trang sau 0,2–0,3 giây (dưới 1,2 giây chờ lưu) → ghi chú câu và ghi chú chung vẫn được lưu |
| TC-7.12 | ĐẠT | Như vòng 1; **K-2 đã sửa**: đáp án lệch 10², chọn cm → mm báo đỏ "Đổi từ cm sang mm chỉ lệch 10¹ lần, nhưng đáp án của em lệch 10² lần…" và không lưu (chi tiết lỗi vẫn là cặp đúng cm → m đã chọn trước đó) |
| TC-7.13 → 7.17 | ĐẠT | Như vòng 1 |
| Trang kết quả (§7) | ĐẠT | **K-1 đã sửa**: "Câu 3: Sót ý…: lỗi này em đã mắc 5 lần." — khớp 5 câu Sót ý trong sổ tay |
| TC-7.7 (7b), TC-7.8 (ghi) | ĐẠT | Tắt sổ tay; máy chủ 1.0.0, 1.5.0 không có các phần 7b, làm bài bình thường |
| Dòng kẻ 32px, không tràn ngang, không lỗi JS | ĐẠT | 1280/390, sáng/tối, mở "Cách sửa", ghi chú 5 dòng |

**Test cũ:** backend 13, importer, bank 30, cache 17, common-cache 5, bang-gach 13, docx 30/30, pha1–pha4 kiểm thử, pha6 10/10, pha6-kiem-thu 105/105, pha6b 97/97, pha6b-hinh 30/30, pha7 16, pha7a-kiem-thu 28/28, pha7b 11, pha7b-kiem-thu 16/16, `scan-secrets` sạch; `pha7a-kiem-thu.e2e.js all` ĐẠT; `tests/e2e.js` máy chủ mới và `SERVER_COMPAT=1.0.0` (dev-server riêng) ĐẠT. TC-5.1 (Pha 5) vẫn chỉ báo bảng màu Sổ tay, chờ giáo viên chốt.

**Ảnh:** `docs/bao-cao/anh/pha-7b/kt-*.png` chụp lại trên `b23740e`. Ảnh Pha 7a bị e2e 7a ghi đè đã được trả về (`git checkout -- docs/bao-cao/anh/pha-7a`).

**Bài kiểm thử:** `tests/pha7b-kiem-thu.e2e.js` thêm các ca "vòng 2" (ghi chú khi trang vẽ lại, chuyển trang ngay, số lần mắc lỗi, cặp đơn vị sai mức báo đỏ và không lưu). Không sửa thêm hạ tầng test.
