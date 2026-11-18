# Hướng dẫn cho mọi phiên Claude làm việc trên repo này

1. **Nguồn sự thật duy nhất** cho các quyết định là Google Doc
   "Quyết định đã chốt — Web luyện đề VLSN" (Drive, thư mục "WEB LUYỆN ĐỀ – TÀI LIỆU CHUNG",
   id `160yRH-KzpC_4YMsKrkrZiuZjpyrHsJduDwt5QScImHc`). Đọc file này trước khi bắt đầu một pha.
   `docs/QUYET-DINH.md` là bản sao chép lại ở đầu mỗi pha — nếu hai bản khác nhau, bản trên Drive đúng.
2. Chốt thêm quyết định nào thì ghi vào Google Doc (đúng mục, kèm ngày, thêm dòng Nhật ký) rồi cập nhật bản sao.
3. Quy trình theo pha, mỗi pha 3 vai độc lập (làm / soát code / kiểm thử) — xem mục 8 của tài liệu.
4. Kiểm thử: `node tests/backend.test.js`, `node tests/importer.test.js`, `node tests/dev-server.js` + `node tests/e2e.js`.
5. Không ghi mật khẩu, PIN học sinh hay dữ liệu cá nhân vào repo (repo có thể công khai).
6. Đổi `apps-script/Code.gs` thì tăng `APP_VERSION` và ghi vào danh sách "việc giáo viên cần làm" (dán lại Code.gs, triển khai Phiên bản mới).
