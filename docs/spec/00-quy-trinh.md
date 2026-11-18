# 00 — Quy trình làm việc theo pha (3 vai độc lập)

## Tóm tắt cho giáo viên
- **Pha 1 – Tăng tốc:** chuyển trang gần như tức thì (máy nhớ dữ liệu lần trước, cập nhật âm thầm). Ẩn ngay nút Đổi PIN và ô mục tiêu điểm trên trang thật cho đến khi thầy dán máy chủ mới (hiện hai nút này đang báo lỗi).
- **Pha 2 – Nối ngân hàng câu hỏi:** thầy lọc và chọn câu từ "KHO CÂU HỎI VẬT LÝ", lấy nguyên đề gốc, hoặc bấm một lần ra đề 18–4–6. Hình vẽ tự gắn vào. Kho không bị sửa.
- **Pha 3 – Tải đề Word/Excel:** thầy chọn file, web tự tách câu, công thức và hình, cho xem trước rồi thêm vào đề. Cần thầy gửi trước 2–3 file đề thật để biết công thức gõ bằng gì.
- **Pha 4 – Luyện tập:** học sinh tự tạo đề luyện từ những câu thầy cho phép, luyện lại câu đã sai, làm đề nhanh 10 phút. Có lời giải ngay; không tính vào bảng xếp hạng; câu đang nằm trong đề thi chưa công bố lời giải sẽ không xuất hiện.
- **Pha 5 – Giao diện VLSN:** logo, màu bảng đen, phông Montserrat, chế độ tối. Phần làm bài nền sáng.
- **Pha 6 – Phát hành:** thầy dán lại Code.gs **một lần duy nhất** cho Pha 1, 2, 4. Sau đó làm cùng thầy một buổi kiểm tra trên trang thật.
- Pha 3 và Pha 5 không cần dán lại Code.gs; xong pha nào học sinh thấy ngay pha đó. Pha 1, 2, 4 chỉ chạy đủ sau Pha 6, trước đó trang web vẫn chạy bình thường với máy chủ cũ.
- Mỗi pha kết thúc bằng một báo cáo ngắn kèm ảnh chụp để thầy duyệt. Dữ liệu trong Google Sheet của thầy chỉ được thêm, không bị xóa hay đổi tên.

## 1. Ba vai trong một pha
| Vai | Nhiệm vụ | Đầu vào | Đầu ra |
|---|---|---|---|
| **Người làm** | Viết code đúng đặc tả `docs/spec/pha-N-*.md`; viết test đơn vị cho phần mình làm; đo số liệu đặc tả yêu cầu | Đặc tả, `QUYET-DINH.md`, `main` | Nhánh `pha-N-...`; mục "Người làm" trong `docs/bao-cao/pha-N.md` (đã làm gì, file đổi, số đo, chỗ lệch đặc tả + lý do) |
| **Người soát code** | Đọc diff so với `main`; đối chiếu "Thiết kế kỹ thuật"; tìm lỗi đúng/sai, bảo mật (lộ đáp án, PIN, mật khẩu), tương thích máy chủ cũ, làm vỡ dữ liệu Sheet | Diff + đặc tả | Mục "Soát code": phát hiện (Nặng/Vừa/Nhẹ, file:dòng), kết luận ĐẠT/CHƯA ĐẠT |
| **Người kiểm thử** | Viết kiểm thử **theo đặc tả**, chạy, chụp ảnh; mỗi TC-N.x có ĐẠT/KHÔNG ĐẠT + bằng chứng | Đặc tả + giao diện chạy được (dev-server); **không đọc code tính năng trước khi viết xong kịch bản** | Test trong `tests/`, ảnh trong `docs/bao-cao/anh/pha-N/`, mục "Kiểm thử" |

## 2. Quy tắc kiểm tra chéo
1. Người soát và người kiểm thử **không phải** người làm. Đặc tả mơ hồ thì hỏi kiến trúc sư; kiến trúc sư trả lời bằng cách **sửa đặc tả** và ghi "Sửa đặc tả ngày …" ở cuối file.
2. Kiểm thử viết kịch bản trước, chạy sau. Được đọc và sửa hạ tầng test (`tests/gas-shim.js`, `tests/dev-server.js`); sửa gì thì ghi trong báo cáo.
3. Có kết luận CHƯA ĐẠT: người làm sửa trên cùng nhánh, ghi "Vòng 2, 3…"; soát và kiểm thử chạy lại **toàn bộ** TC của pha.
4. Pha xong khi: soát ĐẠT **và** mọi TC bắt buộc ĐẠT **và** test cũ vẫn đạt (`node tests/backend.test.js`, `node tests/importer.test.js`, `node tests/dev-server.js` + `node tests/e2e.js`). TC ghi "(cần giáo viên)" nằm trong pha con riêng (vd 6b), không chặn pha chính.
5. TC ghi "(khuyến nghị)" được phép KHÔNG ĐẠT nếu có lý do; giáo viên quyết định.

## 3. Cổng duyệt cuối pha
- `docs/bao-cao/pha-N.md` gồm: tóm tắt 5 dòng không thuật ngữ; bảng TC (mã · mô tả · kết quả · bằng chứng); số đo trước/sau; ảnh; "Việc giáo viên cần làm" cộng dồn cho Pha 6; rủi ro còn lại.
- Ảnh khổ 390×844 và 1280×800, tên `NN-mo-ta.png`.
- Giáo viên duyệt thì gộp vào `main` (lên GitHub Pages ngay). Code.gs trên `main` mới hơn máy chủ đang chạy là bình thường cho tới Pha 6.
- Sau khi duyệt, kiến trúc sư ghi quyết định mới vào Google Doc và `docs/QUYET-DINH.md`.

## 4. Nhánh, commit, phiên bản, sở hữu file
- Mỗi pha một nhánh tách từ `main` mới nhất: `pha-1-tang-toc`, `pha-2-ngan-hang`, `pha-3-tai-de`, `pha-4-luyen-tap`, `pha-5-thiet-ke`, `pha-6-phat-hanh`. Commit tiêu đề `Pha N: <việc>`; kiểm thử dùng `Pha N (kiểm thử): …`. Không force-push `main`; không gộp khi chưa được duyệt.
- Pha nào đổi `apps-script/Code.gs` thì tăng **số phụ** so với `APP_VERSION` đang có trên `main` (không cố định số trước), rồi thêm dòng vào "Việc giáo viên cần làm".
- Khi hai pha chạy song song: pha vào trước **sở hữu** file dùng chung. Pha 1 sở hữu `common.js` (hàm `api`, đệm) và phần route/tải dữ liệu của `admin.js`/`app.js`. Pha 3 chỉ sửa `importDialog` trong `admin.js` cùng các file mới. `rich()` (khối `[BẢNG]`) thuộc pha nào vào trước trong hai Pha 2 và 3. Pha sau rebase lên `main` trước khi soát.

## 5. Khi máy chủ chưa cập nhật (bắt buộc với mọi pha)
Máy chủ thật đang chạy **1.0.0**. Bản 1.1.0 trong repo chưa được dán, nhưng giao diện 1.1.0 (Đổi PIN, mục tiêu điểm) đã ở trên `main`, nên học sinh đang gặp lỗi. Pha 1 sửa việc này đầu tiên.
1. `publicConfig` (từ bản máy chủ của Pha 1) trả `features: [...]`. Bản đầu tiên phải có `"changePin","goal","bootstrap","cache"`; các pha sau thêm `"bank"`, `"practice"`. Giao diện bật tính năng theo danh sách này, **không** so số phiên bản. Thiếu `features` thì coi là máy chủ 1.0.0.
2. `api()` (`common.js`): lỗi `Không có chức năng: <action>` thì ghi nhớ action đó không được hỗ trợ trong phiên và dùng đường dự phòng, không hiện lỗi đỏ cho học sinh.
3. Tính năng **bắt buộc máy chủ mới** (Đổi PIN, mục tiêu điểm, ngân hàng, luyện tập) thì ẩn nút. Trang quản trị hiện ghi chú "Cần cập nhật máy chủ (bước phát hành)".
4. Dev-server giả lập máy chủ cũ bằng `SERVER_COMPAT=1.0.0`: nạp **đúng Code.gs 1.0.0** trong `tests/fixtures/Code-1.0.0.gs` (lấy bằng `git show 89b3f28:apps-script/Code.gs`), không xóa route bằng tay. Mọi pha chạy e2e **hai lần**: máy chủ mới và 1.0.0. Ở chế độ 1.0.0, các bước e2e dùng tính năng mới được bỏ qua, và kiểm thử khẳng định nút tương ứng bị ẩn.
5. Chỉ một `API_URL`; không tạo bản triển khai thứ hai.

## 6. Luật không làm vỡ dữ liệu của giáo viên
1. Chỉ **thêm** cột (cuối hàng tiêu đề) hoặc trang tính; không đổi tên, xóa, đảo cột/trang tính có sẵn; không đổi nhãn trong `SCHEMA`.
2. Cột mới khai báo trong `SCHEMA` để `headerOf_()` tự thêm. `readTable_()` phải chạy đúng khi cột mới chưa có.
3. Trang tính mới do `setup()` tạo (chạy lại an toàn), **và** tự tạo khi ghi lần đầu nếu thiếu. Định dạng số/chữ giống trang tương ứng (vd `KetQuaLuyenTap` giống `KetQua`).
4. File kho và thư mục "02. HÌNH VẼ": máy chủ chỉ **đọc**. Test giả lập kho phải khẳng định 0 lần ghi.
5. Mọi lần ghi theo số hàng (`updateRow_`, `deleteRows_`) phải dựa trên dữ liệu đọc **thẳng từ Sheet** trong khóa và kiểm tra ô khóa của hàng (xem Pha 1).
6. Không ghi PIN, mật khẩu, email, học sinh thật, id file thật, tên trường/nguồn đề thật, hay nội dung câu hỏi nguyên văn vào repo. Dữ liệu test tự soạn theo đúng định dạng.
7. Mỗi thay đổi định dạng dữ liệu phải có test "dữ liệu cũ vẫn đọc được".

## 7. Giới hạn nền tảng
- Apps Script: tối đa 6 phút/lần chạy (việc dài phải chia lô, dừng ở khoảng 4,5 phút, trả `tiepTuc` để gọi tiếp); khoảng 30 lần chạy đồng thời; CacheService ≤ 100 KB/khóa, ≤ 6 giờ, có thể bị xóa sớm (không dùng làm bộ đếm bền); trigger đơn giản `onEdit` không chạy khi chèn/xóa/sắp xếp hàng hay khi sửa qua API; dùng `openById`/`DriveApp` thì phải cấp quyền lại.
- GitHub Pages: tĩnh; thư viện JS chỉ từ cdnjs/jsdelivr, **phiên bản cố định**, tải khi cần. Ngoại lệ: phông chữ từ Google Fonts (có bộ chữ `vietnamese`).
- Bảo mật: đáp án/lời giải chỉ rời máy chủ sau khi nộp (theo `canReveal_`). Bộ nhớ đệm trình duyệt của học sinh không bao giờ chứa đáp án. Bộ đệm của trang quản trị không chứa PIN.

## 8. Câu hỏi mở
Xem `cau-hoi-mo.md`. Giáo viên chưa trả lời thì làm theo đề xuất. **Ngoại lệ:** nếu đề xuất trái `QUYET-DINH.md` thì giữ quyết định đã chốt.

## Phản hồi phát hiện soát (`soat-pha-0.md`)
- Đồng ý và đã sửa toàn bộ S-1 → S-30 trong các file pha. Không có phát hiện nào bị bác bỏ.
- Đã hoãn theo đề xuất cắt phạm vi: giữ ấm bằng hẹn giờ (Pha 1); nhiều mã đề và trộn phương án (Pha 2); đánh dấu đáp án bằng gạch chân/chữ đỏ và mẫu 22 cột qua .xlsx (Pha 3); giới hạn lượt/ngày và `myPracticeStats` (Pha 4); lục giác vàng (Pha 5). Mỗi pha có mục "Hoãn sau".
- S-3: theo quyết định đã chốt, ngân hàng chỉ lấy câu có đáp án. Câu này bỏ khỏi danh sách câu hỏi mở vì đã có quyết định; muốn đổi thì giáo viên sửa `QUYET-DINH.md`.
- Ngoài báo cáo soát: luyện tập vẫn hỏi mục tiêu điểm (có nút "Bỏ qua") để không trái `QUYET-DINH.md` §4 ("trước mỗi lần làm bài"). Hình vẽ kho mặc định được **chép** sang thư mục web (không đổi quyền file gốc), nên bỏ khỏi câu hỏi mở cho đủ 8 câu.

Sửa đặc tả ngày 18/11/2026: theo `soat-pha-0.md` (S-3, S-4, S-25, S-28, S-29); thêm Tóm tắt cho giáo viên.
