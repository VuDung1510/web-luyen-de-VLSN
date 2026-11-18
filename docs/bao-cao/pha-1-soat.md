# Soát code Pha 1 — Tăng tốc

Người soát: độc lập (không phải người làm). Nhánh `pha-1-tang-toc`, so với `main` (4 commit: 8f4830e, 7ba4b5c, dcad38a, b09d727).
Ngày: 18/11/2026.

## Kết luận: **ĐẠT** (không có phát hiện Nặng; 1 phát hiện Vừa nên sửa trước khi gộp, còn lại Nhẹ)

## Đã kiểm
- Test chạy lại: `node tests/backend.test.js` 13/13 đạt; `node tests/importer.test.js` đạt; `node tests/cache.test.js` 15/15 đạt. (Không chạy e2e: agent kiểm thử đang dùng cổng 8787 và `tests/e2e.js` gắn cứng cổng 8787.)
- `tests/fixtures/Code-1.0.0.gs` giống hệt `git show 89b3f28:apps-script/Code.gs` (đã `diff`).
- **Đệm máy chủ** (`apps-script/Code.gs` 1243–1369): thứ tự đọc gen → mảnh → Sheet → cất dưới chính gen đã đọc là đúng. Đã soát cả trường hợp khóa `tbgen_*` bị xóa và tạo lại đúng lúc có người ghi: mỗi lần `put` gen mới đều xảy ra *trước* lần đọc Sheet của chính lần chạy đó, còn người ghi luôn `flush()` rồi mới đổi gen, nên không có trình tự nào khiến dữ liệu cũ nằm dưới thế hệ hiện hành. `newGen_` = thời điểm + số ngẫu nhiên. Thiếu mảnh, sai số mảnh hoặc JSON hỏng thì coi là trượt đệm. Danh sách khóa cột được so với `SCHEMA` (đổi lược đồ thì tự trượt). Mảnh cắt theo byte UTF-8, không cắt giữa cặp surrogate. Bảng lớn hơn 900 KB thì không đệm.
- **Đường ghi**: mọi chỗ dùng `_row` (dòng 274, 533, 954, 984, 1028, 1045, 1062, 1197) đều lấy từ `readTable_(…,{fresh:true})` trong `withLock_`. Không có `_row` nào lấy từ đệm được dùng để ghi. `updateRow_`/`deleteRows_` kiểm ô khóa (`verifyRow_`); không tìm thấy hoặc thấy trùng thì báo lỗi. `appendRows_`, `updateRow_`, `deleteRows_` và `replaceQuestions_` đều gọi `afterWrite_` (flush, xóa MEMO_, đổi gen) ngay trong khóa. `apiChangePin_` và `apiLinkGoogle_` kiểm tra lại bên trong khóa.
- **Bảo mật**: `bootstrap`/`adminBootstrap` không trả đáp án, lời giải, PIN hay mật khẩu (có test). `cacheSet` chặn các khóa `dapAn`, `loiGiai`, `pin`. Trang quản trị dùng `sessionStorage`, và tab Kết quả bỏ cột PIN. Đăng xuất, lỗi `AUTH:` và đăng nhập đều xóa `ld_c_*` ở cả hai kho cùng `ld_lastResult`. Kho đệm theo mã học sinh; đổi tài khoản thì tạo đối tượng scope mới, nên lời gọi về muộn trong `cached`/`loadHome` không ghi vào kho của người mới (trừ R-1).
- **Tương thích 1.0.0**: thiếu `features` thì `has()` trả false: ẩn Đổi PIN và mục tiêu, không thử `bootstrap`. Chưa có `ld_pub` thì vẫn thử `bootstrap`; gặp "Không có chức năng" thì chuyển sang đường dự phòng, không hiện chữ lỗi. Không gửi `mucTieu` khi máy chủ không có `goal`.
- **Sheet giáo viên**: không đổi tên hay xóa cột/trang tính nào. `setup()` chỉ thêm `bumpAllGens_()`.
- `APP_VERSION` đã tăng lên 1.2.0, việc giáo viên cần làm đã ghi trong báo cáo (CLAUDE.md mục 6).
- Biểu đồ vẽ lại không rò bộ nhớ (`App.chart` hủy biểu đồ cũ). Chỉ báo "Đang cập nhật…" luôn được giảm trong `finally`.

## Bảng phát hiện

| Mã | Mức | File:dòng | Mô tả | Tái hiện | Đề xuất sửa |
|---|---|---|---|---|---|
| R-1 | **Vừa** | `assets/js/app.js` ~499–500 (sau `submitExam`) | Lời gọi làm mới ngầm `api('myStats').then((d) => App.cacheSet('stats', d))` không kiểm người dùng hay scope (khác với `loadHome` có `mine()` và `cached` có `scope === sc`). Nếu HS A nộp bài, đăng xuất, rồi HS B đăng nhập trước khi `myStats` của A trả về (Apps Script thật mất 2–10 s), thống kê của A bị ghi vào khóa `ld_c_v1_<B>_stats`. B mở tab Thống kê sẽ thấy dữ liệu của A trong lúc chờ tải mới. Vi phạm TC-1.9 ("không hiện dữ liệu của A"). | dev-server `LATENCY_MS=8000`: A nộp bài → Đăng xuất ngay → B đăng nhập → chờ ~8 s → mở `#/thong-ke` (hoặc xem `localStorage`). | Giữ `const sc = App.cacheScope()` hoặc `uid = user.id` trước khi gọi; chỉ `cacheSet` khi vẫn là người đó (giống `loadHome`). Thêm một bước vào e2e-pha1 (có trễ). |
| R-2 | Nhẹ | `assets/js/common.js` `cached()` (catch) | Khi đã có bản lưu nhưng máy chủ trả lỗi không phải lỗi mạng (ví dụ Apps Script quá hạn mức, khóa hết giờ, "Service Spreadsheets timed out"), nội dung cũ đang hiện bị thay bằng hộp lỗi. Đặc tả muốn "hiện ngay" và chỉ báo nhẹ. | Cho máy chủ ném lỗi thường ở `myResults` khi đã có đệm `history`. | Có `hit` mà lỗi không phải `auth` hay `unsupported` thì giữ bản lưu và hiện toast. |
| R-3 | Nhẹ | `assets/js/common.js` `cached()`: `render(hit.d, …)` | Bản lưu hỏng hoặc không hợp định dạng (ví dụ sau này đổi cấu trúc mà quên tăng `v1`) làm `render` ném lỗi đồng bộ, nên tab đó báo lỗi mãi đến khi đăng xuất; lúc này còn chưa gọi `loader`. | Sửa tay `ld_c_v1_HS0001_stats` thành `{"t":1,"d":{}}` rồi mở Thống kê. | Bọc `render(hit.d)` trong try; lỗi thì xóa khóa, hiện khung xương và chờ `loader`. |
| R-4 | Nhẹ | `apps-script/Code.gs` `writeCachedTable_`/`readCachedTable_` | Hai lần chạy cùng một gen có thể đọc hai phiên bản Sheet khác nhau, khi giữa chúng có sửa tay không gọi `onEdit` (chèn/xóa hàng, sửa qua API). Hai lệnh `putAll` xen nhau khi đó có thể để lại khóa đầu và các mảnh của hai bản khác nhau. Thường thì `JSON.parse` lỗi (coi là trượt đệm), nhưng về lý thuyết có thể ghép ra một bảng lai. Chỉ ảnh hưởng hiển thị ≤ 60 s, không ảnh hưởng ghi (ghi luôn đọc fresh). | Khó tái hiện; giả lập bằng cách ghi tay mảnh `_1` của một bản khác. | Ghi vào khóa đầu số mảnh kèm độ dài hoặc hash của chuỗi (ví dụ `"3:123456:abcd"`), khi đọc thì kiểm lại. |
| R-5 | Nhẹ | `tests/cache.test.js` | Chưa có test cho nhánh `verifyRow_` *tìm lại đúng hàng* (ô khóa ở `rowNum` không khớp nhưng có ở hàng khác thì ghi vào hàng đó). Các test 1.12 đạt được nhờ bước đọc fresh trước đó, còn test "ô khóa không khớp" chỉ thử nhánh báo lỗi. | — | Thêm test: gọi `updateRow_('HocSinh', 2, {...}, 'id', 'HS0003')` khi HS0003 ở hàng 4; khẳng định chỉ hàng 4 đổi. |
| R-6 | Nhẹ | `tests/cache.test.js` (test "Chi phí giả") | So sánh thời gian `warm < 30` ms có thể chập chờn trên máy chậm hoặc CI. | — | Đo bằng `g._stats.reads`/`cacheCalls` thay vì ms, hoặc nới ngưỡng. |
| R-7 | Nhẹ | `README.md` dòng 30 | Câu "Sửa ô trực tiếp… web cũng cập nhật ngay (nhờ hàm `onEdit`)" là khẳng định chưa xác minh trên Apps Script thật (người làm cũng ghi ở chỗ lệch 8). Ngoài ra trình duyệt vẫn hiện bản lưu trước rồi mới cập nhật. | — | Viết thành "thường cập nhật ngay; nếu không thì tối đa 1 phút", và giữ bước kiểm ở Pha 6. |
| R-8 | Nhẹ | `assets/js/common.js` `syncPill` | Rời màn khi lời gọi của màn cũ chưa xong thì chỉ báo "Đang cập nhật…" vẫn hiện trên màn mới (màn đó có thể không cập nhật gì). Chỉ ảnh hưởng hình thức, không bị kẹt. | Trễ 3 s, mở Lịch sử (có đệm) rồi chuyển ngay sang trang làm bài. | Ẩn chỉ báo khi `my !== viewId`, hoặc đếm theo `viewId`. |
| R-9 | Nhẹ | `assets/js/admin.js` dòng 7 và 191 | `cacheDel('*')` sau khi ghi không chặn được lời gọi `cached` đã bắt đầu *trước* lần ghi: nếu lời gọi đó trả về sau, nó cất lại bản cũ, nên lần mở tab sau hiện bản cũ trong chốc lát rồi mới được cập nhật ngầm. | Trễ lớn: mở Đề thi rồi xóa đề ngay khi danh sách đang tải. | Thêm "phiên bản đệm" tăng mỗi lần `cacheDel`; `cached` chỉ ghi khi phiên bản không đổi. |

Ghi chú (không phải lỗi code): TC-1.15a (số gốc trên máy chủ thật 1.0.0) chưa đo. Đặc tả cho phép giáo viên đo; người làm đã ghi vào việc cần làm.

---

## Vòng 2 — soát lại bản sửa (`git diff 8ad5f57..b4dda85`, commit `b4dda85`)

### Kết luận vòng 2: **ĐẠT** (R-1…R-9 đã sửa đúng; không có phát hiện Nặng/Vừa mới)

Test chạy lại tại `b4dda85`: `backend.test.js` 13/13, `cache.test.js` 17/17, `common-cache.test.js` 5/5, `importer.test.js` đạt. (Không chạy e2e; người kiểm thử chạy song song.)

### Đối chiếu từng phát hiện
| Mã | Kết quả | Ghi chú soát |
|---|---|---|
| R-1 | **Đã sửa** | "Thẻ kho" `cacheToken()` = {đối tượng scope, epoch}. Đã rà **mọi** lời gọi `cacheSet` (`grep`): `admin.js:125`, `app.js:236, 242, 502, 503`, `common.js:202` (trong `cached`). Tất cả đều truyền thẻ, không còn đường ghi ngầm nào thiếu thẻ. Đăng xuất gán scope `null`, còn đăng nhập tạo đối tượng scope mới, nên thẻ cũ không bao giờ khớp kho của người mới. Thẻ lấy khi scope đang `null` cũng bị từ chối. Ở `submitExam`, thẻ được lấy **sau** `cacheDel`, nên lời gọi làm mới của chính lần nộp vẫn được cất. `tests/pha1-r1.e2e.js` thực sự giữ lời gọi `myStats`/`bootstrap` lại rồi mới thả, và kiểm kho của B. |
| R-2 | Đã sửa | Có bản lưu mà lỗi không phải `auth`/`unsupported` thì giữ bản lưu và hiện toast. Lỗi AUTH vẫn ném ra như cũ. |
| R-3 | Đã sửa | `render` của bản lưu lỗi thì xóa khóa, hiện khung xương, tải lại. Thẻ được lấy sau bước xóa, nên dữ liệu mới vẫn được cất. |
| R-4 | Đã sửa | Khóa đầu `"số mảnh:độ dài"`; độ dài là số đơn vị UTF-16, đọc và ghi tính giống nhau. Khóa đầu kiểu cũ (chỉ có số mảnh) được coi là trượt đệm, an toàn. Có test. |
| R-5 | Đã sửa | Test mới thử đúng nhánh tìm lại hàng (sửa và xóa) và khẳng định các hàng khác không đổi. |
| R-6 | Đã sửa | Kiểm bằng bộ đếm đọc thay vì đo ms. |
| R-7 | Đã sửa | README ghi rõ `onEdit` chưa được kiểm chứng trên Apps Script thật. |
| R-8 | Đã sửa | Chỉ báo đếm riêng theo `viewId`. `newView()` ẩn chỉ báo ngay; `finally` giảm đúng bộ đếm của màn đã tăng, không kẹt, không rò (khóa về 0 thì bị xóa). |
| R-9 | Đã sửa | `cacheDel` tăng epoch, nên lời gọi bắt đầu trước khi xóa đệm không cất lại bản cũ (có test). |

### Phát hiện mới (đều Nhẹ)
| Mã | Mức | File | Mô tả | Đề xuất |
|---|---|---|---|---|
| R2-1 | Nhẹ | `apps-script/Code.gs` | Vòng 2 sửa Code.gs (R-4) nhưng vẫn để `APP_VERSION = '1.2.0'`. Chấp nhận được vì bản 1.2.0 chưa từng triển khai (máy chủ thật vẫn là 1.0.0), và khóa đầu kiểu cũ được coi là trượt đệm. Tuy vậy cần chắc rằng giáo viên dán bản Code.gs **cuối cùng** ở Pha 6. | Ghi rõ trong việc giáo viên cần làm: "dán Code.gs từ commit cuối của nhánh đã gộp". |
| R2-2 | Nhẹ | `assets/js/common.js` `cached()` (nhánh R-3) | Xóa bản lưu hỏng bằng `cacheDel` làm tăng epoch chung, nên các lời gọi khác đang chạy sẽ bỏ qua bước cất đệm một lần. Chỉ ảnh hưởng hiệu năng, không ảnh hưởng độ đúng. | Có thể xóa trực tiếp khóa đó mà không tăng epoch. Không bắt buộc. |
| R2-3 | Nhẹ (có từ trước, không phải do vòng 2) | `assets/js/admin.js` `route()` | Đang soạn đề chưa lưu (`editorDirty`) mà gặp lỗi AUTH: `route()` dừng sớm vì hash vẫn là trang soạn, nên không hiện màn đăng nhập; `setTimeout(route,0)` của K-3 cũng không thay đổi điều này. Hành vi này còn có lợi là giữ được bài đang soạn; chỉ có toast báo phiên hết hạn. | Pha sau: báo rõ "Phiên hết hạn — hãy sao lưu đề rồi đăng nhập lại". |
