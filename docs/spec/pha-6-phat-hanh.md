# Pha 6 — Phát hành

## Mục tiêu
Đưa toàn bộ thay đổi máy chủ lên Apps Script **một lần**, cập nhật tài liệu, kiểm tra trên hệ thống thật cùng giáo viên.

## Phạm vi
**Làm**: chốt `APP_VERSION` (dự kiến `1.4.0`, gồm 1.1.0 + Pha 1/2/4); README; tài liệu "Việc giáo viên cần làm" từng bước có ảnh/chữ; danh sách kiểm tra sau triển khai; cập nhật `docs/QUYET-DINH.md` và Google Doc (nhật ký); dọn mã dự phòng chỉ khi giáo viên xác nhận máy chủ mới đã chạy (không dọn trong pha này — giữ tương thích ít nhất 1 tháng).
**Không làm**: tính năng mới; đổi dữ liệu thật thay giáo viên.

## Thiết kế kỹ thuật
- `Code.gs`: một file duy nhất; `APP_VERSION` mới; `publicConfig.features` đủ: `bootstrap, cache, bank, practice, changePin, goal`.
- `appsscript.json`: thêm `oauthScopes` tường minh nếu người làm thấy cần để tránh xin quyền thừa (spreadsheets, drive, script.external_request, script.scriptapp, userinfo.email, script.send_mail) — so với danh sách quyền hiện đang được cấp, ghi rõ quyền mới.
- Hàm `kiemTraSauTrienKhai()` (chạy tay trong trình soạn Apps Script): in phiên bản, kiểm trang tính/cột, thử đọc kho (nếu có `KHO_CAU_HOI_ID`), thử ghi/đọc đệm, liệt kê trigger. Chỉ đọc, ngoại trừ ghi thử 1 khóa CacheService.
- `docs/VIEC-GIAO-VIEN.md`: danh sách việc (mục dưới), mỗi bước một câu, có chỗ đánh dấu ✓.
- README: cập nhật mục Cài đặt, Soạn đề (ngân hàng, tải file Word/Excel), Luyện tập, Hiệu năng (đệm 60 s, sửa Sheet trực tiếp thấy sau ≤ 60 s), mục "Khi cập nhật Code.gs".

## Danh sách việc giáo viên (bản nháp, Pha 1–5 bổ sung)
1. Sao lưu: Tệp → Tạo bản sao file "web luyện đề" (phòng hờ).
2. Mở Apps Script gắn với file, dán toàn bộ `apps-script/Code.gs` mới, Lưu.
3. Chạy hàm `setup` một lần ⇒ cấp quyền mới (mở file khác, Drive, hẹn giờ). Tạo trang tính `LuyenTap`, `KetQuaLuyenTap`, thêm cột mới vào CauHoi, thêm hàng CaiDat mới; dữ liệu cũ giữ nguyên.
4. Trong CaiDat: dán `KHO_CAU_HOI_ID`; (tùy chọn) `THU_MUC_HINH_KHO_ID`; đặt `CHO_LUYEN_TAP`.
5. Chạy `caiHenGio` một lần (giữ ấm 10 phút/lần).
6. Triển khai → Quản lý các bản triển khai → ✏ Chỉnh sửa → Phiên bản: **Phiên bản mới** → Triển khai (URL giữ nguyên, không sửa `config.js`).
7. Chạy `kiemTraSauTrienKhai`, chụp nhật ký gửi lại.
8. Mở trang web, đăng nhập quản trị: Cài đặt hiện phiên bản mới; thử tạo 1 đề từ ngân hàng (bản nháp), thử đăng nhập 1 học sinh mẫu.

## Tiêu chí nghiệm thu
- **TC-6.1** `APP_VERSION` mới; `doGet` và `publicConfig` trả đúng phiên bản và đủ `features`.
- **TC-6.2** Toàn bộ test các pha + test cũ đạt trên nhánh phát hành, hai chế độ máy chủ (mới / `SERVER_COMPAT=1.0.0`).
- **TC-6.3** Chạy `setup()` trên Sheet giả **có dữ liệu kiểu cũ 1.0.0** (thiếu cột Mục tiêu, thiếu trang mới): không mất hàng/cột nào, chỉ thêm (test so sánh trước/sau từng ô cũ).
- **TC-6.4** `setup()` chạy 2 lần liên tiếp không tạo hàng CaiDat trùng, không trigger trùng.
- **TC-6.5** Quét repo: không có mật khẩu, PIN thật, email học sinh, id file kho/thư mục thật (trừ trong tài liệu nội bộ đã được giáo viên đồng ý), không có nội dung nguyên văn câu hỏi của kho.
- **TC-6.6** README và `docs/VIEC-GIAO-VIEN.md` khớp hành vi thật (người kiểm thử làm theo đúng từng bước trên dev-server / shim; bước nào không làm được thì báo).
- **TC-6.7** Sau khi giáo viên triển khai: đo lại TC-1.1/1.3 trên máy chủ thật (thời gian chuyển tab, số request, thời gian `bootstrap` lần 1/lần 2) và ghi vào báo cáo. (cần giáo viên)
- **TC-6.8** Sau triển khai: một lượt học sinh thật làm đề + một lượt luyện tập nộp thành công; KetQua có hàng mới đúng cột. (cần giáo viên)

## Kế hoạch kiểm thử
`tests/pha6.test.js` (6.1, 6.3, 6.4), script quét bí mật `tests/scan-secrets.js` (6.5), chạy toàn bộ e2e hai chế độ. Ảnh: trang Cài đặt hiện phiên bản; kết quả `kiemTraSauTrienKhai` do giáo viên gửi.

## Rủi ro & cách giảm
| Rủi ro | Giảm |
|---|---|
| Dán thiếu/nhầm code ⇒ web hỏng với mọi HS | Giao diện có đường dự phòng máy chủ cũ; sao lưu; hướng dẫn quay về "Phiên bản" trước trong Quản lý triển khai |
| Quên chọn "Phiên bản mới" ⇒ máy chủ vẫn cũ | Bước 8 kiểm tra phiên bản hiển thị |
| Cấp quyền mới bị cảnh báo "ứng dụng chưa xác minh" | Hướng dẫn bấm Nâng cao → Đi tới… (đã có trong README cài đặt) |
| Quota trigger | Giữ ấm 10 phút, ước ≤ 15 phút/ngày; có `goHenGio` để tắt |

## Việc giáo viên cần làm
Như danh sách trên; duyệt báo cáo cuối; xác nhận thời điểm dọn mã dự phòng (sau ≥ 1 tháng).

## Ước lượng: **S**
