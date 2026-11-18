> Bản sao của Google Doc "Quyết định đã chốt — Web luyện đề VLSN" (id `160yRH-KzpC_4YMsKrkrZiuZjpyrHsJduDwt5QScImHc`). Bản trên Drive là bản đúng. Chép lại lần cuối: 18/11/2026.

# WEB LUYỆN ĐỀ VLSN — QUYẾT ĐỊNH ĐÃ CHỐT

## 0. Cách dùng file này
- Bên nào chốt quyết định liên quan đến web luyện đề thì ghi vào đúng mục, kèm ngày, và thêm một dòng vào mục 10. Nhật ký thay đổi.
- Không xóa quyết định cũ. Khi đổi ý, gạch ngang dòng cũ rồi ghi dòng mới kèm ngày.
- Việc chưa chốt thì ghi vào mục 9. Câu hỏi mở.
- Mỗi đầu pha, agent kiến trúc sư đọc file Drive và chép sang file này.

## 1. Thông tin chung
- Repo GitHub: VuDung1510/web-luyen-de-VLSN (nhánh main; GitHub Pages phát hành từ main).
- Trang học sinh: https://vudung1510.github.io/web-luyen-de-VLSN/ · Trang giáo viên: .../admin.html
- Dữ liệu web: Google Sheet "web luyện đề" (HocSinh, DeThi, CauHoi, KetQua, CaiDat), Apps Script gắn kèm làm máy chủ.
- Ngân hàng câu hỏi: Google Sheet "KHO CÂU HỎI VẬT LÝ" (Kho câu hỏi, Thống kê, Nhật ký nhập, Danh mục chủ đề), hình ở thư mục "02. HÌNH VẼ".
- Mật khẩu quản trị: không ghi vào tài liệu (xem trang tính CaiDat).

## 2. Kiến trúc
- GitHub Pages + Google Apps Script + Google Sheet. Miễn phí.
- Đáp án chỉ nằm trong Google Sheet; chấm trên máy chủ; trình duyệt không nhận đáp án trước khi nộp.
- **Ngân hàng câu hỏi để ở file riêng**; máy chủ chỉ mở kho khi giáo viên tạo đề rồi chép câu được chọn sang CauHoi; học sinh không đọc kho. (18/11/2026)
- Sửa dữ liệu trực tiếp trong Google Sheet thì web tự cập nhật. Không đổi tên trang tính, hàng tiêu đề, cột Mã HS / Mã đề.

## 3. Cấu trúc đề và chấm điểm
- Theo đề tốt nghiệp THPT từ 2025: Phần I 0,25 điểm/câu; Phần II đúng 1/2/3/4 ý → 0,1/0,25/0,5/1 điểm; Phần III 0,25 điểm/câu (dấu phẩy, sai số, nhiều đáp án cách "|").
- Điểm quy về thang 10. Công thức LaTeX trong $…$.
- Phần IV Tự luận: chưa hỗ trợ chấm; khi lấy từ kho thì tạm bỏ qua.
- Mức độ NB/TH/VD/VDC; kho ghi Biết/Hiểu/Vận dụng → NB/TH/VD.
- Chủ đề cho nhận xét và gợi ý đề tương tự: theo Chương / Bài của kho.

## 4. Tài khoản, học sinh, kết quả
- Đăng nhập PIN (mặc định ngày + tháng sinh) hoặc Google. Sai PIN 5 lần khóa 10 phút.
- Học sinh tự đổi PIN (cần PIN hiện tại); giáo viên đặt lại được.
- Nút Đổi PIN và ô mục tiêu điểm tạm ẩn trên trang thật cho tới khi dán Code.gs mới ở Pha 6. (18/11/2026)
- Trước mỗi lần làm bài, học sinh đặt mục tiêu điểm; chưa đạt thì động viên + gợi ý đề tương tự.
- Mỗi bài nộp ghi 1 dòng vào KetQua; có bảng điểm theo lớp, xuất CSV, tùy chọn email.

## 5. Ngân hàng câu hỏi và cách tạo đề
- Hai cách nhập đề: (a) tải đề hoàn chỉnh (đề gốc từ kho theo Nguồn + Vị trí, hoặc file Word/Excel); (b) tạo đề từ ngân hàng (lọc, chọn câu, ma trận đề).
- Chỉ lấy câu đã có đáp án.
- Mở rộng: ma trận đề 1 chạm (18–4–6), học sinh tự tạo đề luyện từ kho (không tính bảng xếp hạng), đề "luyện câu đã sai", đề nhanh 10 phút theo bài.
- Nhiều mã đề: hoãn, tạm dùng "Trộn câu". (18/11/2026)
- Kết quả luyện tập lưu ở trang tính riêng KetQuaLuyenTap. (18/11/2026)
- Câu thuộc đề thi chưa công bố lời giải không xuất hiện trong luyện tập cho tới khi đề đó công bố lời giải. (18/11/2026)
- Đề Word của giáo viên gõ công thức bằng Equation có sẵn của Word. (18/11/2026)
- Quy tắc nhập kho (Cowork, 11/2026): nhập toàn bộ câu của mỗi đề/tài liệu, gắn nhãn 7 tiêu chí: khối; chủ đề (lớp – chương – bài); dạng câu (Phần I/II/III); mức độ; nguồn; đi kèm (đáp án, lời giải, hình); mã câu. Ba tiêu chí đầu ưu tiên; chưa rõ thì hỏi giáo viên.
- Câu tự luận vẫn nhập kho, nhãn "Phần IV – Tự luận" (mã P4). Trắc nghiệm 4 lựa chọn kiểu cũ xếp Phần I. (11/2026)
- Nhập xong mỗi đề: báo thống kê các câu vừa thêm.
- Kho lưu trên Drive, thư mục TÀI LIỆU ONLINE / KHO TÀI LIỆU; bản sao trên máy tại D:\VLSN\KHO ĐỀ\KHO ĐỀ MẪU.

## 6. Thiết kế
- ~~Phương án B: nền sáng cho phần làm bài, đầu trang/kết quả phong cách bảng đen, chế độ tối.~~
- ~~Bảng màu bảng đen #1e2b27 … và logo mê cung chữ Q.~~
- **Đổi màu và logo (chốt 18/11/2026, Cowork):** giữ nguyên giao diện web hiện tại và bố cục hiện tại; đổi màu chủ đạo sang xanh **#1D6B3E** (màu chủ đạo bảng màu VLSN); đổi logo thành logo VLSN lấy từ vatly.ai (ảnh "Logo Vật Lý Siêu Nhẩm" ở góc trên khung bài học). Không làm bố cục phương án B.
- Giữ: phông Montserrat, tiêu đề in hoa đậm 800; slogan "VẬT LÝ SIÊU NHẨM - ĐỊNH HƯỚNG TRUYỀN CẢM HỨNG"; chân trang "HỆ THỐNG GIÁO DỤC VẬT LÝ SIÊU NHẨM" + hotline 0978 650726 - 0326 425 111.
- Chỉ hiện thương hiệu trung tâm, không đưa tên giáo viên lên phần nhận diện.
- Pha 5 làm theo đúng mục này, ưu tiên dòng "Đổi màu và logo". (18/11/2026)
- **Form VLSN cho file Word đề** (Cowork, 10/11/2026): file Word đề tạo mới dựng từ mẫu MAU_CHUAN_WORD_VLSN.docx; khổ Letter dọc; lề 2 / 1,5 cm; font Cambria Math 12, giãn dòng 1,15; công thức gõ bằng Equation; header/footer, khung đầu đề, tiêu đề "PHẦN 1. TRẮC NGHIỆM NHIỀU LỰA CHỌN" / "PHẦN 2. TRẮC NGHIỆM ĐÚNG SAI" / "PHẦN 3. TRẮC NGHIỆM TRẢ LỜI NGẮN", phương án A–D đặt tab, Phần III có dòng "Đáp án của em", cuối đề "---------- HẾT ----------". (Liên quan Pha 3: bộ đọc file Word phải nhận dạng đúng mẫu này.)

## 7. Hiệu năng (Pha 1)
- Hiện ngay dữ liệu đã lưu trên máy, cập nhật ngầm; gộp nhiều lần gọi thành 1; máy chủ nhớ tạm; khung xương trang khi tải.
- Thời gian máy chủ nhớ tạm dữ liệu: 60 giây. Không làm hẹn giờ giữ máy chủ. (18/11/2026)

## 8. Quy trình làm việc — phương án B (18/11/2026)
Mỗi pha 3 vai độc lập: người làm, người soát code, người kiểm thử (xem docs/spec/00-quy-trinh.md).
1. Pha 0 — Đặc tả + tiêu chí nghiệm thu (đã duyệt 18/11/2026).
2. Pha 1 — Tăng tốc.
3. Pha 2 — Nối ngân hàng câu hỏi.
4. Pha 3 — Tải đề Word/Excel lên.
5. Pha 4 — Luyện tập cho học sinh.
6. Pha 5 — Thiết kế VLSN: đổi màu xanh và logo VLSN, giữ bố cục hiện tại (18/11/2026).
7. Pha 6 — Phát hành; giáo viên dán Code.gs một lần cho tất cả.
- Thứ tự pha: giữ nguyên 1 → 6. (18/11/2026)

## 9. Câu hỏi mở / việc đang chờ
- Code.gs 1.1.0 chưa dán vào Apps Script — dán một lần ở Pha 6.
- 12 đề xuất tham khảo giao diện từ vatly.ai, Azota, OnLuyen, SHub, Moon: chưa chốt, xem lại sau.

## 10. Nhật ký thay đổi
- 18/11/2026 — Claude Code: tạo file.
- 18/11/2026 — Claude Code: giáo viên duyệt đặc tả Pha 0; ghi các quyết định (thứ tự pha, nhớ tạm 60 giây, hoãn nhiều mã đề, KetQuaLuyenTap, loại câu đang thi khỏi luyện tập, Equation, thiết kế theo mục 6, tạm ẩn Đổi PIN và mục tiêu điểm).
- 18/11/2026 — Cowork: bổ sung quy tắc nhập kho (mục 5), form VLSN cho file Word đề (mục 6); chốt giữ giao diện hiện tại, màu xanh #1D6B3E, logo VLSN từ vatly.ai.
