# 00 — Quy trình làm việc theo pha (3 vai độc lập)

> Áp dụng cho Pha 1–6. Quyết định gốc: `docs/QUYET-DINH.md` mục 8 (bản trên Drive là bản đúng).
> Thứ tự pha mặc định 1→6; giáo viên có thể đưa Pha 2 lên trước (xem `cau-hoi-mo.md` câu 1).

## 1. Ba vai trong một pha

| Vai | Nhiệm vụ | Đầu vào | Đầu ra |
|---|---|---|---|
| **Người làm** | Viết code đúng đặc tả `docs/spec/pha-N-*.md`; viết/cập nhật test đơn vị cho phần mình làm; đo số liệu yêu cầu trong đặc tả | Đặc tả pha, `QUYET-DINH.md`, code trên `main` | Nhánh `pha-N-...` có commit; bản nháp `docs/bao-cao/pha-N.md` (mục "Người làm": đã làm gì, file đã đổi, số đo, chỗ lệch đặc tả và lý do) |
| **Người soát code** | Đọc diff nhánh so với `main`; đối chiếu từng mục "Thiết kế kỹ thuật"; tìm lỗi đúng/sai, bảo mật (lộ đáp án, PIN, mật khẩu), tương thích máy chủ cũ, làm vỡ dữ liệu Sheet | Diff nhánh + đặc tả | Mục "Soát code" trong báo cáo: danh sách phát hiện (mức Nặng/Vừa/Nhẹ, file:dòng), kết luận ĐẠT / CHƯA ĐẠT |
| **Người kiểm thử** | Viết kiểm thử **theo đặc tả**, chạy và chụp ảnh; mỗi tiêu chí TC-N.x có kết quả ĐẠT/KHÔNG ĐẠT + bằng chứng | Chỉ đặc tả + giao diện chạy được (dev-server); **không đọc code tính năng trước khi viết xong kịch bản** | Test mới trong `tests/` (vd `tests/pha1.test.js`, bổ sung `tests/e2e.js`), ảnh trong `docs/bao-cao/anh/pha-N/`, mục "Kiểm thử" trong báo cáo |

## 2. Quy tắc kiểm tra chéo
1. Người soát và người kiểm thử **không phải** người làm (agent khác, phiên khác). Người kiểm thử không trao đổi với người làm về cách cài đặt; chỉ hỏi kiến trúc sư nếu đặc tả mơ hồ — kiến trúc sư trả lời bằng cách **sửa đặc tả** (ghi dòng "Sửa đặc tả ngày …" cuối file).
2. Kiểm thử viết kịch bản trước, chạy sau. Được đọc code test có sẵn (`tests/gas-shim.js`, `tests/dev-server.js`) và được sửa chúng nếu cần giả lập thêm dịch vụ (ghi rõ trong báo cáo).
3. Khi soát/kiểm thử báo CHƯA ĐẠT: người làm sửa trên cùng nhánh, ghi "Vòng 2, 3…" trong báo cáo; soát + kiểm thử chạy lại **toàn bộ** TC của pha (không chỉ TC bị lỗi).
4. Pha chỉ xong khi: soát code ĐẠT **và** mọi TC bắt buộc ĐẠT **và** các test cũ vẫn đạt:
   `node tests/backend.test.js`, `node tests/importer.test.js`, `node tests/dev-server.js` + `node tests/e2e.js`.
5. TC đánh dấu "(khuyến nghị)" được phép KHÔNG ĐẠT nếu báo cáo nêu lý do; giáo viên quyết định.

## 3. Cổng duyệt cuối pha
- File `docs/bao-cao/pha-N.md` gồm: tóm tắt 5 dòng cho giáo viên (không thuật ngữ), bảng TC (mã · mô tả ngắn · kết quả · bằng chứng), số đo trước/sau (nếu có), ảnh chụp chính (đường dẫn), danh sách "Việc giáo viên cần làm" cộng dồn cho Pha 6, rủi ro còn lại.
- Ảnh chụp: khổ điện thoại 390×844 và máy tính 1280×800; tên `NN-mo-ta.png`.
- Giáo viên duyệt ⇒ gộp nhánh vào `main` (giao diện lên GitHub Pages ngay). Code.gs trên nhánh `main` có thể mới hơn máy chủ đang chạy — điều này là bình thường đến Pha 6.
- Sau khi duyệt, kiến trúc sư ghi quyết định mới (nếu có) vào Google Doc + `docs/QUYET-DINH.md`.

## 4. Quy ước nhánh và commit
- Mỗi pha một nhánh từ `main` mới nhất: `pha-1-tang-toc`, `pha-2-ngan-hang`, `pha-3-tai-de`, `pha-4-luyen-tap`, `pha-5-thiet-ke`, `pha-6-phat-hanh`.
- Commit nhỏ, tiêu đề tiếng Việt dạng `Pha N: <việc>`; người kiểm thử commit test với tiền tố `Pha N (kiểm thử):`.
- Không force-push lên `main`; không gộp khi chưa có duyệt của giáo viên.
- Đổi `apps-script/Code.gs` ⇒ tăng `APP_VERSION` (Pha 1 → `1.2.0`, Pha 2 → `1.3.0`, Pha 4 → `1.4.0`; Pha 6 chốt số cuối) và thêm dòng vào "Việc giáo viên cần làm".

## 5. Khi máy chủ chưa cập nhật (bắt buộc với mọi pha)
Máy chủ thật đang chạy **1.0.0** (bản 1.1.0 trong repo chưa dán). Giao diện mới gộp vào `main` phải chạy được với máy chủ cũ:
1. Từ 1.2.0, `publicConfig` trả thêm `features: [...]` (vd `"bootstrap"`, `"cache"`, `"bank"`, `"practice"`). Giao diện bật tính năng theo danh sách này, **không** so số phiên bản. Thiếu `features` ⇒ coi như máy chủ cũ.
2. `api()` trong `assets/js/common.js`: lỗi dạng `Không có chức năng: <action>` ⇒ ghi nhớ action không hỗ trợ trong phiên và chuyển sang đường dự phòng (gọi API cũ), không hiện lỗi đỏ cho học sinh.
3. Tính năng **bắt buộc máy chủ mới** (ngân hàng, luyện tập, đổi PIN, mục tiêu điểm) thì ẩn nút, hoặc hiện ghi chú nhỏ "Cần cập nhật máy chủ (giáo viên làm ở bước phát hành)" — chỉ ở trang quản trị.
4. Dev-server phải giả lập được máy chủ cũ: biến môi trường `SERVER_COMPAT=1.0.0` (Pha 1 thêm) xóa các action mới khỏi `ROUTES` và bỏ `features`. Mọi pha chạy e2e **hai lần**: máy chủ mới và `SERVER_COMPAT=1.0.0`.
5. Đường dẫn GitHub Pages dùng chung một `API_URL`; không tạo bản triển khai thứ hai.

## 6. Luật không làm vỡ dữ liệu của giáo viên
1. Chỉ **thêm** cột (cuối hàng tiêu đề) hoặc trang tính mới; không đổi tên, xóa, đảo thứ tự cột/trang tính có sẵn; không đổi nhãn tiêu đề trong `SCHEMA`.
2. Cột mới khai báo trong `SCHEMA` để `headerOf_()` tự thêm khi ghi; `readTable_()` phải chạy đúng khi cột mới **chưa có** (đã có tiền lệ test "file Google Sheet cũ thiếu cột Mục tiêu").
3. Trang tính mới tạo bằng `setup()` (chạy lại an toàn, không xóa dữ liệu) **và** tự tạo khi ghi lần đầu nếu thiếu.
4. File "KHO CÂU HỎI VẬT LÝ" và thư mục "02. HÌNH VẼ": máy chủ chỉ **đọc**. Mọi test có giả lập kho phải khẳng định không có lệnh ghi vào kho.
5. Không ghi PIN, mật khẩu, email, danh sách học sinh thật, hay nội dung câu hỏi nguyên văn của kho vào repo; dữ liệu mẫu cho test tự soạn theo đúng định dạng.
6. Mỗi thay đổi định dạng dữ liệu phải có test "dữ liệu cũ vẫn đọc được".

## 7. Giới hạn nền tảng cần nhớ
- Apps Script: 6 phút/lần chạy; ~30 lần chạy đồng thời; CacheService ≤ 100 KB/khóa, ≤ 6 giờ, `putAll` nhiều khóa; tổng thời gian trigger tài khoản thường ~90 phút/ngày; `SpreadsheetApp.openById` và `DriveApp` cần cấp quyền lại sau khi dán code.
- GitHub Pages: tĩnh; thư viện chỉ từ cdnjs/jsdelivr, **ghi phiên bản cố định**, tải lười (chỉ khi cần).
- Bảo mật: đáp án/lời giải chỉ rời máy chủ sau khi nộp (theo `canReveal_`). Bộ nhớ đệm trên trình duyệt không bao giờ chứa đáp án.
