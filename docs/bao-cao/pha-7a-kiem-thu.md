# Pha 7a — Kiểm thử (người kiểm thử độc lập)

Ngày 26/11/2026 · nhánh làm việc hiện tại (commit `a18765f`, Code.gs 1.6.0) · kịch bản viết theo `docs/spec/pha-7-so-tay.md` và trang mẫu `docs/spec/mau-so-tay.html` **trước khi** đọc code tính năng.

## Tóm tắt cho giáo viên
1. Sổ tay chạy đúng như đặc tả: liệt kê mọi câu em từng làm sai, đèn đỏ / vàng / xanh đúng luật "đúng 2 lần ở 2 ngày khác nhau", nhãn "Lặp lại" đúng ngưỡng 3 câu ở 2 đề.
2. Không lộ đáp án: câu của đề đang mở hoặc chưa công bố chỉ hiện nội dung và câu trả lời của em; máy cũng không "đoán lỗi" bằng đáp án khi đề chưa công bố.
3. Học sinh này không xem được câu của học sinh khác; thầy tắt Sổ tay thì mục này biến mất và máy chủ từ chối; máy chủ cũ (1.0.0, 1.5.0) vẫn chạy bình thường, không có mục Sổ tay.
4. Giao diện: máy tính hai cột, điện thoại hai tab (Sổ tay mở trước), chữ nằm giữa hai dòng kẻ ở cả chế độ sáng và tối, không tràn ngang.
5. Cần sửa nhỏ: ở chế độ sáng, ba nhãn chữ nhỏ ("LẶP LẠI", "EM CHỌN", "ĐÁP ÁN") hơi nhạt so với chuẩn dễ đọc; bài kiểm tra màu của Pha 5 cần bổ sung bảng màu Sổ tay.

## Kết quả theo tiêu chí
| Mã | Mô tả | Kết quả | Bằng chứng |
|---|---|---|---|
| TC-7.1 | Bài cũ (không có `t`, `h`): liệt kê mọi câu từng sai, gộp theo key, màu §4 | **ĐẠT** | `tests/pha7a-kiem-thu.test.js` (3 ca): 3 lần làm ở 01/11, 02/11 sáng, 02/11 chiều, 03/11 (sửa ngày nộp trực tiếp trên trang tính, bỏ `t`/`h` khỏi `chiTiet`) → đúng 6 key; đúng 2 lần cùng ngày = vàng; đúng ngày 02 và 03 = xanh; đúng rồi sai lại = đỏ; `lanSai` 3/2/1 đúng; Phần II 3/4 ý vẫn là sai; câu luôn đúng không có. Sai ở đề thi rồi làm đúng ở bài luyện `CAU_SAI` → 1 mục, vàng |
| TC-7.2 | `notebook` không có nội dung/đáp án/lời giải; `notebookItem` ẩn đáp án khi chưa công bố, hiện khi đã công bố | **ĐẠT** | 6 ca: `notebook` không có khóa `noiDung`/`dapAn`/`loiGiai`/`A`/`B` và không có chữ của câu, kể cả đề đã đóng; đề mở NGAY, mở SAU_HAN, đóng KHONG → có nội dung + "0,25" em chọn, không có `dapAn`/`loiGiai`; đóng đề NGAY/SAU_HAN, hoặc SAU_HAN hết giờ → có; đề chuyển về nháp → ẩn lại; **câu kho sai ở bài luyện rồi được đưa vào đề đang mở → ẩn đáp án, đóng đề thì hiện lại**; > 20 key → trả ≤ 20 |
| TC-7.3 | Máy đoán loại lỗi | **ĐẠT** | 0,25/25 → `TINH_TOAN/DON_VI`, chắc; 2,48/2,5 → `BAM_MAY`, hỏi; trống → `SOT`, chắc; Phần II sai 1 ý → `SOT`, hỏi; Phần I → `CHUA_RO`. Biên: đáp án "30\|25" em 0,25 → `DON_VI`; ngược dấu → `BAM_MAY` hỏi; đáp án đúng 0 hoặc em trả 0 → không ra `DON_VI`, không lỗi; Phần II còn ý trống → `SOT` chắc; 4,3/4 → `BAM_MAY`; 2500/25 → `DON_VI`. **Đề còn mở hoặc đề KHONG**: chỉ đoán `SOT` cho câu bỏ trống, còn lại `CHUA_RO` (không lộ đáp án qua máy đoán) |
| TC-7.4 | "Lặp lại" đúng ngưỡng 3 câu / 2 đề | **ĐẠT** | 3 câu đỏ ở 2 đề → đỏ, `lapLai`; 3 câu cùng 1 đề → vàng; biên: 2 câu/2 đề → vàng → thêm 1 câu → đỏ → 1 câu thành vàng → về vàng → mọi câu xanh → loại lỗi xanh |
| TC-7.5 | Học sinh A không lấy được câu của B | **ĐẠT** | `notebook` của A chỉ có câu A sai; A gọi `notebookItem` với key của B (và key câu A làm đúng) → "Câu này không có trong sổ tay của em.", không có nội dung; gửi kèm `studentId` của B không có tác dụng; không token → lỗi |
| TC-7.6 | Giao diện hai cột / hai tab, nhóm, lọc, thu gọn | **ĐẠT** | `tests/pha7a-kiem-thu.e2e.js` — 42 bằng chứng, sáng và tối: 1280×800 hai cột (trái 53 %, phải 47 %), không hiện tab; 390×844 hai tab, "Sổ tay" chọn sẵn, danh sách ẩn; "Sai ngoo" trên, "Hổng kiến thức" thu gọn (bản đồ ẩn tới khi bấm); dòng đỏ có nhãn "Lặp lại"; bấm tên lỗi (SOT, TINH_TOAN) → bên trái còn đúng các câu loại đó, có nhãn "Đang xem…" (điện thoại tự chuyển sang tab danh sách); mọi câu thu gọn mặc định; câu sai 2 lần ghi "sai 2 lần"; câu đề chưa công bố: có câu trả lời của em, dòng "Đáp án và lời giải sẽ hiện khi đề đóng và thầy công bố lời giải", phản hồi `notebookItem` không có `dapAn`/`loiGiai`; câu đề đã công bố có đáp án và lời giải; **chữ trong sổ nằm giữa hai dòng kẻ 32px** (đo bằng điểm ảnh: 15–19 dòng kẻ, 20–22 dòng chữ, mọi tâm dòng chữ cách dòng kẻ phía trên 16 ± 4 px, cả khi mở bản đồ); không tràn ngang; không lỗi JS |
| TC-7.7 | Tắt sổ tay; máy chủ 1.0.0 và 1.5.0 | **ĐẠT** | Node: `BAT_SO_TAY = KHONG` → `notebook`, `notebookItem` báo "Giáo viên đang tắt sổ tay." (`notebookTag`/`notebookNote` chưa có ở 7a); `publicConfig.notebook = false`; thiếu khóa trong CaiDat → coi là bật. 1.0.0 và 1.5.0: `features` không có `notebook`, gọi `notebook` → "Không có chức năng". E2E: khi tắt, menu không hiện Sổ tay, `#/so-tay` báo "Mục Sổ tay hiện chưa mở", Lịch sử bình thường; dev-server `SERVER_COMPAT=1.0.0` và `1.5.0`: không có mục, trang chủ và Lịch sử bình thường, không lỗi JS |
| TC-7.8 | Sheet cũ chưa có `SoTay`, `CongThuc` | **ĐẠT** (phần ghi: chưa áp dụng) | Xóa hai trang tính → `notebook`, `notebookItem` chạy, **không** tự tạo trang tính khi chỉ đọc; Sheet trước Pha 4 (thiếu cả `LuyenTap`, `KetQuaLuyenTap`) vẫn chạy; `setup()` tạo hai trang đúng tiêu đề, chạy lại không mất hàng `CongThuc`, không thêm cột trùng. "Lần ghi đầu tự tạo": 7a chưa có action ghi `SoTay` (ghi thuộc 7b) → kiểm lại ở 7b |

Thêm (ngoài TC): nộp bài mới thì sổ tay cập nhật ngay, không chờ đệm 60 giây — ĐẠT.

### Test cũ (chạy lại toàn bộ)
| Bài | Kết quả |
|---|---|
| backend 13, importer, bank 30, cache 17, common-cache 5, bang-gach 13, docx 30/30, pha1-kiem-thu 29/29, pha2-kiem-thu 31/31, pha3-kiem-thu 17/17, pha4 22, pha4-kiem-thu 33/33, pha6 10/10, pha6-kiem-thu 105/105, pha6b-kiem-thu 97/97, pha6b-hinh-kiem-thu 30/30, pha7 14/14, `scan-secrets` sạch | ĐẠT |
| `pha5.test.js` 10/11, `pha5-kiem-thu.test.js` 26/27 — **TC-5.1** danh sách màu cho phép | KHÔNG ĐẠT (xem dưới) |
| `tests/e2e.js` máy chủ mới · `SERVER_COMPAT=1.0.0` | ĐẠT · ĐẠT |

### TC-5.1 và tương phản màu Sổ tay (WCAG 2.1)
Mọi mã màu TC-5.1 báo đều thuộc bảng màu `--nb-*` của trang mẫu thầy đã duyệt (giấy, dòng kẻ, lề, đỏ/vàng/xanh, 6 màu loại lỗi, bản tối); không có màu cũ trước Pha 5 quay lại, `--primary` vẫn `#1D6B3E`. Tương phản đo trên màu khai báo ở `assets/css/style.css` (chữ: cần ≥ 4,5:1; chấm/màu loại lỗi là đồ họa: cần ≥ 3:1):

| Cặp | Cần | Sáng | Tối |
|---|---|---|---|
| Chữ thường trên giấy kẻ | 4,5 | 16,08 đạt | 13,07 đạt |
| Chữ phụ (muted) trên giấy | 4,5 | 5,88 đạt | 6,73 đạt |
| Tiêu đề "Sổ tay", liên kết (primary) trên giấy | 4,5 | 6,45 đạt | 7,46 đạt |
| Nhãn "LẶP LẠI" (đỏ trên nền đỏ nhạt, 10,9 px đậm) | 4,5 | **4,04 không** | 5,51 đạt |
| "sai n lần" (đỏ trên thẻ câu) | 4,5 | 4,74 đạt | 6,02 đạt |
| Nhãn "EM CHỌN" (đỏ trên ô đỏ nhạt, 11,2 px) | 4,5 | **4,04 không** | 5,51 đạt |
| Nhãn "ĐÁP ÁN" (xanh trên ô xanh nhạt, 11,2 px) | 4,5 | **3,76 không** | 9,22 đạt |
| Chữ xanh trên thẻ câu (`.nb-good`, `.nb-fixed`) | 4,5 | **4,31 không** (chưa thấy dùng ở 7a) | 10,78 đạt |
| Chấm đỏ / vàng / xanh trên giấy | 3 | 4,70 / 3,47 / 4,27 đạt | 6,10 / 10,11 / 10,93 đạt |
| Màu loại lỗi: công thức / đọc đề / tính toán / sót / hổng KT | 3 | 5,00 / 4,45 / 3,93 / 4,52 / 4,63 đạt | 6,77 / 7,58 / 8,94 / 7,43 / 6,94 đạt |
| Màu "Chưa phân loại" (xám) trên giấy | 3 | **1,63 không** | **2,22 không** |
| Dòng kẻ, lề vở | trang trí | 1,18 / 1,51 | 1,21 / 2,12 |

**Kết luận TC-5.1:** KHÔNG ĐẠT về hình thức vì danh sách màu của Pha 5 chưa có bảng màu Sổ tay; đây không phải lỗi hồi quy. Đề nghị kiến trúc sư bổ sung các mã `--nb-*` vào danh sách cho phép của TC-5.1, **sau khi** người làm đổi màu chữ của ba nhãn ở chế độ sáng (đề xuất: chữ đỏ `#b42323` → 5,58:1 trên `#fde8e8`; chữ xanh dùng `--primary #1D6B3E` → 5,67:1 trên `#e1f4e7`; giữ màu chấm như cũ). Màu xám "Chưa phân loại" luôn đi kèm chữ "Chưa phân loại" nên có thể giữ (giáo viên quyết định).

## Lỗi và lệch tìm được
| # | Mức | Mô tả | Cách tái hiện |
|---|---|---|---|
| K-1 | Nhẹ | Chế độ sáng: nhãn "LẶP LẠI", "EM CHỌN", "ĐÁP ÁN" tương phản 4,04 / 4,04 / 3,76:1 (< 4,5:1, chữ nhỏ 11 px) | Mở `#/so-tay` ở chế độ sáng; mở một câu Phần I của đề đã đóng; đo màu chữ/nền của `.nb-rep`, `.nb-lab` (bảng trên) |
| K-2 | Nhẹ | Hình dạng `tongHop` lệch bảng API §6: `hongKT` là đối tượng `{so, doanMo, chuaRo, chuong:[…]}` thay vì mảng `[{chuong,bai,so,mau}]`; `chuaRo` nằm trong `hongKT`. Giao diện dùng đúng nên học sinh không thấy khác. Đề nghị sửa đặc tả cho khớp | `notebook` với 2 câu chưa phân loại → xem `data.tongHop` |
| K-3 | Ghi nhận | Danh sách bên trái xếp **theo loại lỗi** (thứ tự như trong sổ, loại đỏ trước) rồi đỏ → vàng → xanh trong cùng loại, nên một câu vàng của loại đứng trước có thể nằm trên câu đỏ của loại sau. Khớp trang mẫu (`renderList`), nhưng câu chữ đặc tả "nhóm Sai ngoo trước (🔴 trước)" đọc được theo hai cách. Đề nghị ghi rõ vào đặc tả | Đề có câu Tính toán vàng + câu Sót đỏ → xem nhóm Sai ngoo |
| K-4 | Ghi nhận | TC-7.8 phần "lần ghi đầu tự tạo trang tính" chưa kiểm được ở 7a vì chưa có action ghi `SoTay` (`notebookTag`, `notebookNote` thuộc 7b) | — |

Không có lỗi Nặng hay Vừa.

## Ảnh (`docs/bao-cao/anh/pha-7a/`)
- `kt-01-so-tay-1280.png` — máy tính, sáng: hai cột, Sai ngoo (SÓT ý "Lặp lại"), Hổng kiến thức thu gọn.
- `kt-02-loc-theo-loi-1280.png` — bấm "Tính toán / quên đổi đơn vị" bên phải, bên trái chỉ còn 2 câu.
- `kt-03-cau-chua-cong-bo-1280.png` — câu đề đang mở: có câu trả lời của em, không có đáp án.
- `kt-05-so-tay-1280-toi.png` — máy tính, tối.
- `kt-06-so-tay-390.png`, `kt-08-so-tay-390-toi.png` — điện thoại, tab Sổ tay (sáng, tối).
- `kt-07-cau-sai-390.png`, `kt-09-cau-sai-390-toi.png` — điện thoại, tab Câu đã sai, một câu đang mở.
- `kt-10-tat-so-tay-1280.png` — `BAT_SO_TAY = KHONG`: không có mục Sổ tay.
- `kt-compat-100-390.png`, `kt-compat-150-390.png` — máy chủ 1.0.0 và 1.5.0: trang `#/so-tay` báo chưa mở, menu không có mục.

## Cách chạy
```
node tests/pha7a-kiem-thu.test.js
NODE_PATH=$(npm root -g) LIBS_DIR=<node_modules có katex, chart.js> node tests/pha7a-kiem-thu.e2e.js [new|compat|all]
```
E2E tự chạy dev-server ở cổng 8790 (mới), 8791 (`SERVER_COMPAT=1.0.0`), 8792 (`SERVER_COMPAT=1.5.0`), tạo đề và bài làm qua API, câu hỏi tự soạn.

## Hạ tầng test đã sửa
- **Thêm** `tests/fixtures/Code-1.5.0.gs` = `git show 36e9d9f:apps-script/Code.gs` (máy chủ 1.5.0 trước Pha 7a) để dev-server chạy được `SERVER_COMPAT=1.5.0` và kiểm "máy chủ 1.5.0" của TC-7.7 (cả hai bài kiểm thử tự tạo lại file này nếu thiếu). Không sửa `gas-shim.js`, `dev-server.js`, không sửa bài kiểm thử của người làm.
