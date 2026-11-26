# Pha 7a — Soát code (vai độc lập)

Phạm vi: `git diff 36e9d9f..HEAD` (nhánh `claude/peaceful-rubin-4l9uxr`, 2 commit). Đối chiếu `docs/spec/pha-7-so-tay.md` (TC-7.1 → 7.8), `docs/spec/00-quy-trinh.md` §2, §5, §6, §7, `docs/QUYET-DINH.md` §5 và báo cáo `docs/bao-cao/pha-7a.md`.

## Tóm tắt cho giáo viên
- Không tìm thấy chỗ nào làm lộ đáp án hay lời giải của đề chưa công bố. Học sinh này không xem được câu của học sinh khác. Dữ liệu trong Google Sheet của thầy chỉ được thêm (2 trang tính mới, 2 dòng cài đặt mới).
- Khi máy chủ chưa cập nhật (bản 1.0.0 hoặc 1.5.0), mục Sổ tay tự ẩn và các trang khác vẫn chạy bình thường.
- Có 2 lỗi mức Vừa nên sửa trước khi gộp. (1) Học sinh có nhiều câu sai ở bài luyện tập (khoảng 200 câu) thì mở Sổ tay, và cả mỗi lần bấm xem một câu, đều chậm vài giây: máy chủ đọc Sheet hơn 120 lần cho mỗi lần như vậy. (2) Sau khi bấm tên một loại lỗi trong cuốn sổ, các ô lọc bên trái không còn tác dụng cho tới khi tải lại trang.
- Kết luận: **ĐẠT**. Các lỗi tìm thấy không chạm tới bảo mật hay dữ liệu. Em vẫn đề nghị sửa R-1 và R-2 ở vòng 2, trước khi thầy dán Code.gs 1.6.0.

## Đã kiểm
- Chạy `node tests/pha7.test.js`: 14/14 đạt. Chạy lại các bài kiểm thử cũ:
  - backend 13, importer, bank 30, cache 17, pha4 22, pha4-kiem-thu 33/33, pha6 10/10, pha6-kiem-thu 105/105, pha6b-kiem-thu 97/97, pha1-kiem-thu 29/29, pha2-kiem-thu 31/31, bang-gach 13: đạt.
  - pha5 10/11 và pha5-kiem-thu 26/27: chỉ trượt TC-5.1, xem mục ý kiến bên dưới.
  - `scan-secrets`: sạch.
  - docx, pha3-kiem-thu, pha6b-hinh cần `LIBS_DIR` nên chưa chạy ở máy soát.
- Bài kiểm thử cũ bị sửa (`bank`, `cache`, `pha4`, `pha6`, `pha6-kiem-thu`) chỉ đổi số phiên bản 1.5.0 → 1.6.0, danh sách `features` và danh sách trang tính mới. Không nới lỏng phép kiểm nào. Dòng "VIEC-GIAO-VIEN ghi Code.gs 1.5.0" vẫn giữ nguyên.
- Script thử tạm (trong scratchpad, không đưa vào repo) dùng kho giả 600 câu và 20 bài luyện × 10 câu sai = 200 câu trong sổ tay. Kết quả đo được:
  - `notebook`: 128–136 lần `getRange` trên trang `LuyenTap`. Không cất vào đệm vì JSON nội bộ vượt 90 000 ký tự; riêng bản gửi cho học sinh đã là 82 748 ký tự (88 197 byte).
  - `notebookItem` với 1 câu: 126 lần `getRange` trên `LuyenTap`.
- Bảo mật, đã đọc kỹ:
  - `notebook` bỏ trường nội bộ `_ref` và `_src`; không có `noiDung`, `dapAn`, `loiGiai`.
  - `notebookItem` chỉ nhận khóa có trong sổ tay của chính học sinh. Đáp án chỉ trả khi `nbPublished_` đúng, tức là thỏa cùng lúc: `examLocked_` sai (đề đã đóng và cho xem lời giải) và mã kho không nằm trong `blockedBankIds_`. Điều này đúng với câu đề thi, câu luyện tập lấy từ đề (`examId#stt`) và câu kho, kể cả khi câu kho vừa được đưa vào một đề đang mở.
  - Máy đoán (lệch 10ⁿ, lệch nhỏ, ngược dấu, Phần II sai 1 ý) chỉ chạy khi đáp án đã công bố. Câu bỏ trống thì đoán `SOT`, việc này không cần biết đáp án.
  - Khóa đệm có mã học sinh, nên không trộn dữ liệu giữa các học sinh.
  - Giao diện: mọi chuỗi lấy từ Sheet đều qua `esc()` hoặc `rich()`. Các chuỗi không qua hàm nào chỉ là hằng do máy chủ sinh (`mau`, `ma`) hoặc số.
  - Bộ đệm trình duyệt (`cached('notebook')`) không chứa đáp án. Chi tiết câu chỉ giữ trong bộ nhớ của trang.
- Logic đúng:
  - Màu từng câu: đỏ / vàng (đúng 1 lần hoặc 2 lần cùng ngày) / xanh (2 ngày khác nhau, ngày tính theo `TZ` vì `parseDate_` đọc giờ Việt Nam). Sai lại thì về đỏ.
  - "Lặp lại": ≥ 3 câu đỏ ở ≥ 2 nguồn khác nhau.
  - Câu bị gộp theo khóa `maKho` hoặc `examId#stt`, bài luyện và đề thi dùng chung khóa.
  - Câu nhập tay bị sửa thì có cờ `daSua` và không đoán. Câu bị gỡ thì có cờ `go`.
  - `times` chỉ nhận số từ 0 tới số giây đã làm. Giá trị boolean, chuỗi rỗng hoặc số âm đều bị bỏ.
  - Đoán loại lỗi: số âm (cùng dấu thì xét lệch 10ⁿ, ngược dấu thì `BAM_MAY`), đáp án 0 (bỏ qua), đáp án có nhiều giá trị cách nhau "|" (xét từng giá trị), Phần II còn ý để trống (`SOT` chắc).
- Tương thích:
  - `SoTay` và `CongThuc` nằm trong `OPTIONAL_SHEETS`. Thiếu khóa `BAT_SO_TAY` thì coi là bật.
  - Chỉ thêm khóa `SCHEMA` và trang tính, không đổi nhãn cũ.
  - `FEATURE_OF` ánh xạ `notebook`/`notebookItem` vào tính năng `notebook`, nên máy chủ cũ trả "không hỗ trợ" và giao diện ẩn mục, không hiện lỗi đỏ.

## Bảng phát hiện

| Mã | Mức | File:dòng | Mô tả | Đề xuất sửa |
|---|---|---|---|---|
| R-1 | Vừa | `apps-script/Code.gs:2952` (`nbResolve_` → `poolGet_`), `Code.gs:2280` (`readRowRuns_` không gộp khối), `Code.gs:3073`, `Code.gs:3146`, `Code.gs:3018` | **Chậm khi học sinh có nhiều câu sai ở bài luyện tập.** `nbCompute_` lấy đủ nội dung câu cho **mọi** câu sai chỉ để biết chương, bài, mức độ và đáp án dùng cho máy đoán. Với câu kho, `poolGet_` đọc mỗi khối hàng liền nhau một lần, không gộp như `rowsWhere_`. Đo được: 200 câu sai cần ~130 lần `getRange`, tức vài giây trên Apps Script thật. Có ba điều làm chậm thêm: (a) JSON đệm ≥ 90 000 ký tự thì không cất, mà điều này xảy ra đúng ở học sinh có nhiều câu; (b) mỗi lần `notebookItem` lại chạy cả `nbCompute_`, nên mỗi lần bấm xem 1 câu lại tốn ~126 lần đọc; (c) khóa đệm gồm thế hệ **chung** của `KetQua`/`KetQuaLuyenTap`, nên bất kỳ học sinh nào nộp bài cũng làm mất đệm sổ tay của mọi học sinh, và trong giờ kiểm tra gần như không trúng đệm. | Trong `nbCompute_`: lấy chương, bài, mức độ từ `poolIndex_()` (đã có sẵn, không đọc hàng). Chỉ đọc hàng kho cho câu Phần III cần đoán khi đã công bố, và đọc bằng `readRowRuns_(info, nums, true)` (gộp ≤ 10 khối). Cất đệm bằng `cachePutChunked_` (đo theo byte, cho phép nhiều mảnh). Trong `notebookItem`, kiểm khóa và lấy `_ref` từ `nbEvents_` thay vì tính cả sổ tay. Nên đưa phép đo vào test (đếm `ranges.LuyenTap` ≤ 15 với 200 câu). |
| R-2 | Vừa | `assets/js/app.js:681`, `app.js:688`, `app.js:837`, `app.js:839` | **Ô lọc mất tác dụng sau khi bấm tên lỗi hoặc tên chương trong cuốn sổ.** `renderNotebook` giữ `const f = nb.filter` và `onFilter` ghi vào `f`, trong khi `nbBookClick` **thay** `nb.filter` bằng object mới, còn `nbPasses` đọc `nb.filter`. Từ đó đổi loại lỗi, đề, mức độ hay gõ ô tìm đều không làm danh sách đổi, cho tới khi trang vẽ lại (bấm "✕" hoặc có dữ liệu mới). Ngoài ra `onFilter` không xóa `f.chuong`: bộ lọc chương vẫn chạy ngầm trong khi nhãn "Đang xem" đã mất. | `onFilter` ghi thẳng vào `nb.filter` (bỏ biến `f` ngoài hàm) và đặt lại `chuong = ''`. Hoặc `nbBookClick` dùng `Object.assign(nb.filter, …)`. Thêm bước e2e: bấm tên lỗi → đổi ô "Mọi mức độ" → danh sách đổi. |
| R-3 | Nhẹ | `assets/css/style.css:22`, `style.css:461`, `style.css:496` | Tương phản chữ nhỏ dưới 4,5:1 (yêu cầu của TC-5.2) ở giao diện sáng: `--nb-xanh` #2f8a4f trên nền trắng 4,31:1 và trên `--nb-xanh-soft` 3,76:1 (nhãn "ĐÁP ÁN", "Đã khắc phục"); `--nb-do` #d23b3b trên `--nb-do-soft` 4,04:1 (nhãn "Lặp lại", "EM CHỌN"). Giao diện tối đạt (≥ 5,5:1). | Làm tối `--nb-xanh` (vd #237a42 ≈ 5:1) và `--nb-do` (vd #b92f2f) cho chữ, hoặc tách biến chữ riêng. Đưa các cặp này vào TC-5.2. |
| R-4 | Nhẹ | `apps-script/Code.gs:3049`, `Code.gs:3073` | `congBo` và loại lỗi máy đoán được cất trong đệm 60 giây. Khi đề tự đóng, hoặc một đề khác tự mở theo giờ, thế hệ trang tính không đổi nên trong ≤ 60 giây có thể còn kết quả cũ, ví dụ còn nhãn `DON_VI` của câu kho vừa vào đề đang mở. `notebookItem` tính lại `pub` mỗi lần nên **không lộ đáp án**; chỉ là nhãn đoán cũ tồn tại tối đa 60 giây. | Chấp nhận được. Nếu muốn chặt hơn: cho đệm hết hạn tại mốc mở hoặc đóng gần nhất, như `blockedBankIds_` đang làm (`until`). |
| R-5 | Nhẹ | `apps-script/Code.gs:3073` | So `j.length` (số ký tự) với `CACHE_CHUNK_BYTES` (byte). Chuỗi tiếng Việt có dấu vượt 90 000 byte dù chưa tới 90 000 ký tự. Lỗi `put` đã được bắt nên không hỏng gì, chỉ mất đệm. | Gộp vào cách sửa R-1 (`cachePutChunked_` đo theo byte). |
| R-6 | Nhẹ | `assets/js/app.js:630–645`; `common.js` `cached()` | Thầy tắt `BAT_SO_TAY` khi máy học sinh còn bản lưu `notebook`: lỗi "Giáo viên đang tắt sổ tay." không phải `unsupported`, nên `cached()` giữ bản lưu và chỉ hiện thông báo nhỏ. Nhánh `catch` hiện "chưa mở" không chạy, học sinh vẫn thấy sổ tay cũ qua `#/so-tay`. Dữ liệu là của chính em và không có đáp án, nên không phải lỗi bảo mật. TC-7.7 chỉ đạt khi máy chưa có bản lưu. | Trong `viewNotebook`, kiểm `notebookAllowed()` trước khi gọi `cached`. Hoặc gắn cờ cho lỗi tắt sổ tay để `cached()` không giữ bản lưu, rồi `App.cacheDel('notebook')`. |
| R-7 | Nhẹ | `assets/js/app.js:623`, `app.js:630` | `nb.tab` không đặt lại khi vào trang: trên điện thoại, nếu lần trước em ở tab "Câu đã sai" thì lần sau mở thẳng tab đó. TC-7.6 yêu cầu tab Sổ tay mở trước. | `viewNotebook` đặt `nb.tab = 'sotay'` (và `nb.hkt = false` nếu muốn). |
| R-8 | Nhẹ | `assets/js/app.js:839`; `Code.gs` `nbSummary_` | Bấm tên chương trong bản đồ "Hổng kiến thức" lọc **mọi** câu của chương, kể cả câu Sai ngoo. Số câu trong danh sách vì vậy lớn hơn số câu ghi trên bản đồ. | Khi lọc theo chương từ bản đồ, thêm điều kiện nhóm không phải Sai ngoo. |
| R-9 | Nhẹ | `apps-script/Code.gs:96` | `TU_KHOA_DOC_SAI` mặc định lệch đặc tả §5.2: thiếu "đúng"; "lấy g =" ghi thành "lấy g"; thêm "nửa". Chưa ảnh hưởng 7a; 7b sẽ dùng. | Theo đúng danh sách §5.2, hoặc ghi vào "Chỗ lệch đặc tả" để kiến trúc sư chốt. |
| R-10 | Nhẹ | `apps-script/Code.gs:3004–3010`; `app.js:647` | "Lặp lại" đếm mỗi bài luyện là một "đề" riêng (`_src` = mã bài luyện), trong khi bộ lọc "đề" ở giao diện gom mọi bài luyện thành một ("Bài luyện tập"). Ngưỡng 2 đề vì thế dễ đạt nhờ các bài luyện, và người xem khó đối chiếu với danh sách. Đặc tả chưa nói rõ. | Hỏi kiến trúc sư: bài luyện tính là 1 nguồn chung hay mỗi bài một nguồn. Ghi vào đặc tả §4. |
| R-11 | Nhẹ (quy trình) | `docs/spec/pha-7-so-tay.md:111`, dòng cuối | Người làm tự sửa câu chữ TC-7.1 trong đặc tả. `00-quy-trinh` §2.1 quy định kiến trúc sư sửa đặc tả. Nội dung sửa hợp lý, khớp §4 và trang mẫu. | Kiến trúc sư xác nhận và ghi lại dòng "Sửa đặc tả ngày …" dưới tên mình. |

Không có phát hiện mức **Nặng**. Không có phát hiện nào ảnh hưởng bảo mật (lộ đáp án, PIN, dữ liệu học sinh khác) hay làm vỡ dữ liệu Sheet.

## Ý kiến về TC-5.1 (Pha 5) KHÔNG ĐẠT
- Bài TC-5.1 (`tests/pha5-kiem-thu.test.js` và `tests/pha5.test.js`) so mọi mã màu với một danh sách cố định của Pha 5. Danh sách đó được viết để khẳng định đã thay hết bảng màu cũ, không phải để cấm màu mới về sau. Bảy mã báo trượt (#fffef9, #e6ecf3, #b9d9c4, #d23b3b, #fde8e8, #b97d00, #2f8a4f) đều là màu của Sổ tay. Các màu này đã khai báo thành biến `--nb-*` ở cả 3 khối màu (sáng, tối theo hệ thống, tối bật tay) và lấy theo trang mẫu `mau-so-tay.html` thầy đã duyệt. Không còn màu cũ nào quay lại (phần "màu cũ" của TC-5.1 vẫn đạt).
- Vì vậy đây **không phải lỗi code** của Pha 7a. Nhưng theo `00-quy-trinh` §2.4, pha chỉ xong khi test cũ vẫn đạt. Đề nghị:
  1. Kiến trúc sư hoặc giáo viên chốt bảng màu Sổ tay thành quyết định (ghi QUYET-DINH §6).
  2. **Người kiểm thử** (không phải người làm) mở rộng danh sách cho phép của TC-5.1: thêm đúng các giá trị `--nb-*`, hoặc cho phép mọi mã màu chỉ xuất hiện trong khai báo biến `--nb-*` ở 3 khối màu.
  3. Đồng thời sửa R-3 và thêm các cặp chữ/nền của Sổ tay vào TC-5.2, để danh sách mới không cho qua màu thiếu tương phản.
- Người làm không tự sửa bài kiểm thử Pha 5 là đúng quy trình.

## Kết luận
**ĐẠT** — không có phát hiện Nặng, không có phát hiện Vừa nào ảnh hưởng bảo mật hay dữ liệu. Đề nghị sửa R-1 (tốc độ) và R-2 (ô lọc) ở vòng 2 trước khi gộp và trước khi thầy dán Code.gs 1.6.0. Các mục Nhẹ có thể sửa cùng lúc hoặc chuyển sang 7b. TC-5.1 cần người kiểm thử cập nhật danh sách màu sau khi bảng màu Sổ tay được chốt.

---

## Vòng 2

Phạm vi: `git diff 2908dc7..fab23cd` (commit `fab23cd`). Đã soát lại toàn bộ khối Sổ tay theo `00-quy-trinh` §2.3, tập trung vào khóa đệm mới và số lần đọc Sheet.

**Tóm tắt:** cả hai lỗi mức Vừa đã được sửa đúng. Sổ tay của học sinh có 200 câu sai giờ chỉ đọc trang `LuyenTap` 4 lần (trước là ~130 lần) và được cất vào đệm. Ô lọc chạy đúng. Không có chỗ nào làm lộ đáp án. Khóa đệm mới chỉ có thể cho kết quả cũ tối đa 60 giây, và chỉ khi giáo viên xóa bài hoặc sửa tay trang kết quả; mức này nằm trong giới hạn đệm 60 giây đã chốt.

**Đã chạy:**
- `tests/pha7.test.js`: 15/15 đạt. `tests/pha7a-kiem-thu.test.js`: 28/28 đạt.
- backend, cache, bank, pha4, pha4-kiem-thu, pha6, pha6-kiem-thu (105/105): đạt. `scan-secrets`: sạch.
- `pha5-kiem-thu` vẫn trượt TC-5.1 (danh sách màu).
- Chạy lại script đo của vòng 1 (kho giả 600 câu, 200 câu sai ở bài luyện):

| Thao tác | Số lần đọc trang `LuyenTap` (`getRange`) | Có cất vào đệm không |
|---|---|---|
| `notebook` | 4 (vòng 1: 128–136) | Có, 3 khóa (chia mảnh) |
| `notebookItem` xem 1 câu | 2 (vòng 1: 126) | — |

| Mã | Đã sửa đúng chưa | Ghi chú / phát hiện mới |
|---|---|---|
| R-1 | **Đúng** | Hai cách đọc Sheet ít hơn: (1) câu luyện tập chỉ cần chương / bài / mức độ thì lấy từ `poolIndex_`, không đọc hàng; (2) chỉ câu Phần III đã trả lời và học sinh chưa tự chọn loại lỗi mới đọc đủ hàng, theo khối gộp (`readRowRuns_(…, true)`, ≤ 10 khối). Đọc từng phần như vậy không đổi kết quả đoán: `nbGuess_` chỉ dùng `q.dapAn` cho câu Phần III, và các câu khác trả kết quả trước khi chạm tới đáp án. Đệm dùng `cachePutChunked_` / `cacheGetChunked_` (đo theo byte, kiểm độ dài khi ghép mảnh). **Khóa đệm mới** = `nbVer_(mã HS)` + thế hệ DeThi / CauHoi / SoTay / LuyenTap. Đã xét các trường hợp tranh chấp: phiên bản được tăng **sau** khi ghi bài trong khóa, nên một lần tính chen giữa chỉ cất dưới phiên bản cũ, không ai đọc lại khóa đó. Phiên bản bị CacheService xóa sớm thì sinh phiên bản mới, tức là tính lại, không trả dữ liệu cũ. Khóa vẫn có mã học sinh nên không trộn giữa các học sinh. Sửa đề hay đồng bộ pool vẫn làm đổi khóa. Có hai trường hợp không làm đổi khóa: xóa bài và sửa tay Sheet (xem V2-1). |
| R-2 | **Đúng** | `onFilter` tạo lại `nb.filter` từ các ô lọc và xóa lọc chương ngầm. Nút "✕" và `nbBookClick` đều đặt `chuong`. |
| R-3 | **Đúng** | Tương phản tự tính: `--nb-do-text` #b42323 đạt 6,55 trên nền trắng, 5,58 trên nền đỏ nhạt, 6,49 trên nền giấy; `--nb-xanh-text` #1D6B3E đạt 6,51 / 5,67 / 6,45. Giao diện tối ≥ 5,5. Đạt ≥ 4,5:1. |
| R-4 | Chấp nhận (ghi trong đặc tả) | Đồng ý: `notebookItem` luôn tính lại điều kiện công bố, nên không lộ đáp án. |
| R-5 | **Đúng** | Gộp vào R-1. |
| R-6 | **Đúng** (còn khe nhỏ) | Vào `#/so-tay` khi cấu hình đã tắt thì xóa bản lưu và hiện "chưa mở". Khe còn lại: nếu cấu hình lưu trên máy (`ld_pub`, sống ≤ 10 phút) chưa biết thầy vừa tắt, trang vẫn hiện bản lưu một lần; lần sau sẽ hết. Xem V2-2. |
| R-7 | **Đúng** | `nb.tab = 'sotay'` mỗi lần vào trang. |
| R-8 | **Đúng** | Lọc chương bỏ nhóm Sai ngoo; nhãn "Hổng kiến thức · <chương>"; đặc tả §7 đã ghi. |
| R-9 | **Đúng** | Danh sách mặc định khớp §5.2. |
| R-10 | **Đúng** (đặc tả) | §4 ghi rõ: mỗi bài luyện tính là một đề; "đề" lấy theo lần sai gần nhất. |
| R-11 | Ghi nhận | Mỗi lần sửa đặc tả đều có dòng ngày để giáo viên duyệt. Không chặn. |
| V2-1 (mới) | Nhẹ | `apps-script/Code.gs:1229` `apiAdminDeleteResult_`: giáo viên xóa một bài nhưng không tăng `nbVer_` của học sinh đó, nên sổ tay của em còn câu của bài đã xóa tối đa 60 giây (đệm hết hạn theo `CACHE_SECONDS`). Sửa tay trang `KetQua` / `KetQuaLuyenTap` cũng vậy (đã ghi trong chú thích `nbVer_`). Không lộ đáp án, không hỏng dữ liệu, vẫn trong giới hạn đệm 60 giây của QUYET-DINH §7. Đề xuất: thêm `nbVer_(r.studentId, true)` sau `deleteRows_` (một dòng; nhớ cập nhật bài kiểm thử). |
| V2-2 (mới) | Nhẹ | `assets/js/app.js:632`: R-6 dựa vào `notebookAllowed()` đọc cấu hình đã lưu trên máy. Đề xuất (không bắt buộc): khi `cached()` trả về bản lưu mà lỗi là "Giáo viên đang tắt sổ tay", cũng xóa bản lưu. |
| V2-3 (mới) | Nhẹ (kiểm thử) | TC-5.1 nay báo thêm #b42323. #1D6B3E đã có trong danh sách. Ý kiến như vòng 1: giáo viên chốt bảng màu Sổ tay, người kiểm thử thêm các màu `--nb-*` (kể cả `--nb-do-text`) vào danh sách cho phép. |

Bài kiểm thử mới "Vòng 2 (R-1)" kiểm đúng ý: đếm số lần đọc, học sinh khác nộp bài vẫn trúng đệm, chính em nộp bài thì có số liệu mới ngay, `notebookItem` đọc ≤ 3 lần. Không bài kiểm thử cũ nào bị sửa trong vòng 2.

### Kết luận vòng 2
**ĐẠT.** R-1, R-2 và các mục Nhẹ R-3, R-5 → R-10 đã sửa đúng. Không có phát hiện Nặng hay Vừa mới. Ba mục mới (V2-1, V2-2, V2-3) đều Nhẹ; V2-1 nên thêm cùng lúc nếu còn vòng sửa. TC-5.1 chờ giáo viên chốt bảng màu rồi người kiểm thử cập nhật danh sách.
