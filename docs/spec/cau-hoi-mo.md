# Câu hỏi mở — cần giáo viên quyết định

Mỗi câu gồm các lựa chọn, **đề xuất** của kiến trúc sư và ảnh hưởng. Thầy chỉ cần trả lời "Câu n: chọn …".
Thầy chưa trả lời thì người làm theo đề xuất. **Ngoại lệ:** đề xuất nào trái `QUYET-DINH.md` thì giữ quyết định đã chốt. Những việc đã có quyết định (chỉ lấy câu có đáp án; chủ đề theo Chương/Bài; luyện tập không tính xếp hạng; học sinh đặt mục tiêu trước khi làm bài) không hỏi lại.

### 1. Thứ tự các pha
- (a) Giữ 1 → 6. (b) Đưa Pha 2 (ngân hàng) lên trước. (c) Làm Pha 1 và Pha 3 song song, rồi 2 → 4 → 5 → 6.
- **Đề xuất (c).** Pha 2 cũng chỉ dùng được thật sau khi dán máy chủ ở Pha 6, và kho hiện mới có 46 câu dùng được, nên đẩy Pha 2 lên không có lợi. Pha 3 cần file đề mẫu của thầy (câu 7).

### 2. Lỗi đang có trên trang thật: nút Đổi PIN và ô mục tiêu điểm (máy chủ đang chạy chưa có hai chức năng này)
- (a) Sửa ngay ở đầu Pha 1: ẩn hai mục này cho tới khi thầy dán máy chủ mới ở Pha 6. (b) Thầy dán Code.gs 1.1.0 ngay bây giờ (một lần dán thêm, trước Pha 6). (c) Để nguyên tới Pha 6.
- **Đề xuất (a):** giữ đúng kế hoạch "dán một lần ở Pha 6", học sinh không còn thấy lỗi.

### 3. Thầy (hoặc phiên Cowork) có hay sửa trực tiếp Sheet "web luyện đề" không, nhất là chèn/xóa/sắp xếp hàng?
- (a) Hiếm khi: web nhớ tạm dữ liệu 60 giây, sửa trên Sheet có thể chậm tối đa 1 phút mới hiện. (b) Thường xuyên: rút thời gian nhớ tạm còn 20 giây (web nhanh lên ít hơn).
- **Đề xuất (a).** Việc ghi của web luôn an toàn trong cả hai cách; câu này chỉ quyết định độ trễ hiển thị.

### 4. Có làm "sinh nhiều mã đề" không? (`QUYET-DINH` §5 ghi "chờ duyệt")
- (a) Hoãn; dùng "Trộn câu" sẵn có (mỗi học sinh một thứ tự câu khác nhau). (b) Cùng bộ câu, chỉ đảo thứ tự, mỗi mã một đề riêng. (c) Mỗi mã một bộ câu khác nhau theo cùng ma trận.
- **Đề xuất (a).** Thi trên web thì "Trộn câu" đã đủ. Nhiều mã sẽ tách bảng điểm thành nhiều đề và cộng dồn lượt làm. Đảo phương án A–D làm sai những lời giải ghi "Chọn B". Lớp 12 hiện chỉ có đúng một bộ 18–4–6.

### 5. Kết quả luyện tập lưu ở đâu?
- (a) Trang tính riêng `KetQuaLuyenTap`. (b) Chung trang KetQua, thêm cột "Loại bài".
- **Đề xuất (a):** bảng điểm chính gọn; bảng xếp hạng và bảng điểm không phải lọc; web không chậm dần vì bài luyện.

### 6. Câu đang nằm trong đề thi chưa công bố lời giải có được xuất hiện trong luyện tập không?
- (a) Không: tự loại câu đó khỏi luyện tập cho tới khi đề cho xem lời giải (cả đề bản nháp). (b) Có: thầy tự tránh đưa câu thi vào kho luyện tập.
- **Đề xuất (a).** Nếu không loại, học sinh có thể làm luyện tập nhiều lần để gom lời giải trước giờ thi. Vì có (a) nên tạm chưa cần giới hạn số lượt luyện mỗi ngày.

### 7. Đề Word của thầy gõ công thức bằng gì?
- (a) Equation có sẵn của Word. (b) MathType. (c) Cả hai.
- **Đề xuất:** thầy gửi 2–3 file đề thật trước Pha 3. Nếu đa số là MathType thì Pha 3 thu nhỏ còn: Excel/CSV + Word chữ thường và hình; công thức MathType sẽ được báo "cần gõ lại" (hoặc thầy chuyển sang Equation trong Word trước khi tải lên).

### 8. Bản thiết kế "form VLSN" bên Cowork
- (a) Có bản riêng (ảnh, màu, bố cục): thầy gửi trước Pha 5, Pha 5 làm theo bản đó. (b) Không có: làm theo nhận diện bảng đen và phương án B như đặc tả Pha 5.
- **Đề xuất:** thầy xác nhận trước Pha 5; không ảnh hưởng Pha 1–4.

Sửa đặc tả ngày 18/11/2026: gộp lại theo `soat-pha-0.md` (bỏ câu đã có quyết định; thêm câu 2, 3, 6, 7).

---
## Giáo viên đã trả lời (18/11/2026)
- Thứ tự pha: **giữ nguyên 1 → 2 → 3 → 4 → 5 → 6** (không làm song song Pha 1 và Pha 3).
- Câu 2 (ẩn Đổi PIN / mục tiêu đầu Pha 1), 3 (nhớ tạm 60 giây), 4 (hoãn nhiều mã đề), 5 (KetQuaLuyenTap), 6 (loại câu đang thi khỏi luyện tập): **đồng ý đề xuất**.
- Câu 7: đề Word gõ công thức bằng **Equation** có sẵn của Word. Bộ đọc Pha 3 phải nhận dạng mẫu "Form VLSN cho file Word đề" (QUYET-DINH mục 6).
- Câu 8: làm theo file quyết định chung. Cowork đã chốt: **giữ bố cục hiện tại, đổi màu chủ đạo sang xanh #1D6B3E và logo VLSN từ vatly.ai** — đặc tả `pha-5-thiet-ke.md` phải được kiến trúc sư viết lại theo quyết định này trước khi bắt đầu Pha 5.
