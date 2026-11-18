> Bản sao của Google Doc "Quyết định đã chốt — Web luyện đề VLSN" (bản trên Drive là bản đúng).

# WEB LUYỆN ĐỀ VLSN — QUYẾT ĐỊNH ĐÃ CHỐT
*Nguồn sự thật duy nhất cho mọi phiên làm việc (Cowork và Claude Code). Cập nhật lần đầu: 18/11/2026.*

## 0. Cách dùng file này
- Bên nào chốt quyết định liên quan đến web luyện đề thì **ghi vào đúng mục bên dưới**, ghi kèm ngày, và thêm một dòng vào **mục 10. Nhật ký thay đổi**.
- Không xóa quyết định cũ. Khi đổi ý, gạch ngang dòng cũ rồi ghi dòng mới kèm ngày.
- Việc chưa chốt thì ghi vào **mục 9. Câu hỏi mở**.
- Mỗi đầu pha, agent kiến trúc sư bên Claude Code đọc file này và chép sang **docs/QUYET-DINH.md** trong repo GitHub.
- Dặn phiên Cowork (dự án "Kho đề"): *"Khi chốt quyết định liên quan web luyện đề, ghi vào file Quyết định đã chốt trong thư mục WEB LUYỆN ĐỀ – TÀI LIỆU CHUNG."*

## 1. Thông tin chung
- Repo GitHub: VuDung1510/web-luyen-de-VLSN (nhánh main; GitHub Pages phát hành từ main).
- Trang học sinh: https://vudung1510.github.io/web-luyen-de-VLSN/
- Trang giáo viên: https://vudung1510.github.io/web-luyen-de-VLSN/admin.html
- Dữ liệu web: Google Sheet "web luyện đề" (5 trang tính HocSinh, DeThi, CauHoi, KetQua, CaiDat), có Apps Script gắn kèm làm máy chủ.
- Ngân hàng câu hỏi: Google Sheet "KHO CÂU HỎI VẬT LÝ" (trang Kho câu hỏi, Thống kê, Nhật ký nhập, Danh mục chủ đề), hình ở thư mục "02. HÌNH VẼ".
- Mật khẩu quản trị: KHÔNG ghi vào file này (xem trang tính CaiDat).

## 2. Kiến trúc
- Giao diện tĩnh trên GitHub Pages + máy chủ Google Apps Script + dữ liệu trong Google Sheet. Miễn phí.
- Đáp án chỉ nằm trong Google Sheet; chấm điểm trên máy chủ; trình duyệt không nhận đáp án trước khi nộp.
- **Ngân hàng câu hỏi để ở file riêng** (KHO CÂU HỎI VẬT LÝ), không gộp vào file web. Máy chủ chỉ mở kho khi giáo viên tạo đề, rồi chép các câu được chọn sang trang tính CauHoi. Học sinh không đọc kho → web không chậm đi khi kho lớn. (chốt 18/11/2026)
- Sửa dữ liệu trực tiếp trong Google Sheet thì web tự cập nhật ở lần tải trang tiếp theo. Không đổi tên trang tính, hàng tiêu đề, cột Mã HS / Mã đề.

## 3. Cấu trúc đề và chấm điểm
- Theo đề tốt nghiệp THPT từ 2025: Phần I trắc nghiệm 4 lựa chọn (0,25 điểm/câu); Phần II Đúng/Sai 4 ý (đúng 1/2/3/4 ý → 0,1/0,25/0,5/1 điểm); Phần III trả lời ngắn (0,25 điểm/câu, chấp nhận dấu phẩy, có thể đặt sai số, nhiều đáp án cách nhau "|").
- Điểm quy về thang 10. Công thức viết LaTeX trong $…$.
- Phần IV Tự luận: **chưa hỗ trợ chấm**; khi lấy từ kho thì tạm bỏ qua.
- Mức độ: NB/TH/VD/VDC; kho ghi Biết/Hiểu/Vận dụng → đổi tương ứng NB/TH/VD.
- Chủ đề dùng cho nhận xét và gợi ý đề tương tự: lấy theo Chương / Bài của kho.

## 4. Tài khoản, học sinh, kết quả
- Học sinh đăng nhập bằng mã PIN (mặc định ngày + tháng sinh) hoặc Google. Sai PIN 5 lần khóa 10 phút.
- Học sinh tự đổi PIN (cần PIN hiện tại); giáo viên đặt lại được.
- Trước mỗi lần làm bài, học sinh đặt **mục tiêu điểm**; nộp xong so sánh, chưa đạt thì động viên + gợi ý đề tương tự.
- Mỗi bài nộp ghi 1 dòng vào KetQua: họ tên, lớp, đề, điểm, mục tiêu, thời gian, nhận xét. Có bảng điểm theo lớp, xuất CSV, tùy chọn email cho giáo viên.

## 5. Ngân hàng câu hỏi và cách tạo đề
- Hai cách nhập đề: (a) tải đề hoàn chỉnh — lấy cả "đề gốc" từ kho theo cột Nguồn + Vị trí, hoặc tải file Word/Excel lên web; (b) tạo đề từ ngân hàng — lọc, chọn câu hoặc dùng ma trận đề.
- Chỉ lấy câu **đã có đáp án**.
- Đề xuất mở rộng (chờ duyệt trong đặc tả Pha 0): ma trận đề 1 chạm (18–4–6), sinh nhiều mã đề, học sinh tự tạo đề luyện từ kho (không tính bảng xếp hạng), đề "luyện câu đã sai", đề nhanh 10 phút theo bài.

## 6. Thiết kế — phương án B (chốt 18/11/2026)
- **Nền sáng cho phần làm bài**, giữ nhận diện VLSN; đầu trang và trang kết quả mang phong cách bảng đen; có nút chế độ tối.
- Nhận diện VLSN: logo mê cung chữ Q trên thẻ trắng bo góc; phông Montserrat, tiêu đề in hoa đậm 800; slogan "VẬT LÝ SIÊU NHẨM - ĐỊNH HƯỚNG TRUYỀN CẢM HỨNG"; chân trang "HỆ THỐNG GIÁO DỤC VẬT LÝ SIÊU NHẨM" + hotline 0978 650726 - 0326 425 111.
- Bảng màu bảng đen: nền #1e2b27 / #24332e, khung gỗ #7b5a3a, phấn trắng #f1eee4, phấn mờ #b9c2ba, vàng nhấn #f5d76a, xanh #9fd0ee, hồng cảnh báo #f3a3a3, nền trang tối #141a18.
- Chỉ hiện thương hiệu trung tâm, không đưa tên giáo viên lên phần nhận diện.
- *Bên Cowork có bản thiết kế "form VLSN" khác (ảnh, màu, bố cục) thì bổ sung tại đây.*

## 7. Hiệu năng (sẽ làm ở Pha 1)
- Hiện ngay dữ liệu đã lưu trên máy, cập nhật ngầm; gộp nhiều lần gọi máy chủ thành 1; máy chủ nhớ tạm dữ liệu ~1 phút; hẹn giờ giữ máy chủ không "ngủ"; khung xương trang khi tải.

## 8. Quy trình làm việc — phương án B (chốt 18/11/2026)
Mỗi pha có 3 vai độc lập: **người làm**, **người soát code**, **người kiểm thử**. Người soát và người kiểm thử không phải người viết code; kiểm thử viết theo đặc tả, không theo code. Pha chỉ xong khi cả hai đạt; mỗi pha kết thúc bằng báo cáo + ảnh chụp để giáo viên duyệt.
1. Pha 0 — Kiến trúc sư: đặc tả + tiêu chí nghiệm thu (docs/ trong repo). Giáo viên duyệt.
2. Pha 1 — Tăng tốc (đo thời gian trước/sau).
3. Pha 2 — Nối ngân hàng câu hỏi (thêm agent kiểm tra dữ liệu đối chiếu với file kho).
4. Pha 3 — Tải đề Word/Excel lên.
5. Pha 4 — Luyện tập cho học sinh (tự tạo đề, luyện câu sai, đề 10 phút).
6. Pha 5 — Thiết kế VLSN (phương án B).
7. Pha 6 — Phát hành: README, Code.gs, danh sách việc giáo viên cần làm; dán Code.gs một lần cho tất cả.

## 9. Câu hỏi mở / việc đang chờ
- Code.gs bản 1.1.0 (Đổi PIN, Mục tiêu điểm) **chưa dán vào Apps Script** — giáo viên giữ lại để dán một lần ở Pha 6.
- Thứ tự pha: đang theo mục 8; chờ giáo viên xác nhận có muốn đưa Pha 2 (ngân hàng) lên trước không.
- Bổ sung các quyết định đã chốt bên Cowork (dự án Kho đề) vào các mục trên.

## 10. Nhật ký thay đổi
- 18/11/2026 — Claude Code: tạo file; ghi kiến trúc, cấu trúc đề, tài khoản, mục tiêu điểm, ngân hàng để riêng, thiết kế B, quy trình B.
