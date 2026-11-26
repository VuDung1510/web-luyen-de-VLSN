> Bản sao của Google Doc "Quyết định đã chốt — Web luyện đề VLSN" (id `160yRH-KzpC_4YMsKrkrZiuZjpyrHsJduDwt5QScImHc`). Bản trên Drive là bản đúng. Chép lại lần cuối: 26/11/2026 (Sổ tay cá nhân — Pha 7; quy tắc nhập Lớp 10 của Cowork).

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
- File kho đang dùng (từ 18/11/2026, thay file cũ không còn mở được): "KHO CÂU HỎI VẬT LÝ" (id: xem bản trên Drive; repo không ghi id file thật); 10 239 câu, 1 014 câu có đáp án dùng được cho web.
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
  - Cách hiểu "đã công bố lời giải": đề đã đóng (hết hạn hoặc giáo viên đóng) và đề cho xem lời giải. Đề đang mở ở mọi chế độ hiện lời giải, kể cả "ngay sau khi nộp", vẫn bị chặn (19/11/2026).
- Đề Word của giáo viên gõ công thức bằng Equation có sẵn của Word. (18/11/2026)
- Quy tắc nhập kho (Cowork, 11/2026): nhập toàn bộ câu của mỗi đề/tài liệu, gắn nhãn 7 tiêu chí: khối; chủ đề (lớp – chương – bài); dạng câu (Phần I/II/III); mức độ; nguồn; đi kèm (đáp án, lời giải, hình); mã câu. Ba tiêu chí đầu ưu tiên; chưa rõ thì hỏi giáo viên.
- Câu tự luận vẫn nhập kho, nhãn "Phần IV – Tự luận" (mã P4). Trắc nghiệm 4 lựa chọn kiểu cũ xếp Phần I. (11/2026)
- Nhập xong mỗi đề: báo thống kê các câu vừa thêm.
- Kho lưu trên Drive, thư mục TÀI LIỆU ONLINE / KHO TÀI LIỆU; bản sao trên máy tại D:\VLSN\KHO ĐỀ\KHO ĐỀ MẪU.
- Nhập Lớp 10 (Cowork, 26/11/2026): danh mục Lớp 10 theo SGK Kết nối tri thức (7 chương, 34 bài, mã L10C{chương}B{bài}); số thứ tự mã câu đánh riêng theo từng lớp. Câu đo g có tính sai số xếp Bài 11. Câu Phần III dùng chung đoạn dẫn thì chép đoạn dẫn vào từng câu. Chỉ nhập bản có lời giải; bỏ câu thiếu đáp án hoặc đáp án nhập nhằng. Bài, mức độ, năng lực đợt này gán tự động, ghi chú ở cột "Ghi chú phân loại" để soát dần. Hình lưu ở 02. HÌNH VẼ/Lớp 10, tên file theo mã câu.
- **Sổ tay cá nhân (chốt 26/11/2026, Pha 7):** tab mới cho học sinh, lưu mọi câu làm sai, phân loại lỗi, nhắc lỗi lặp lại, gợi ý cách sửa và tạo đề ngắn để khắc phục.
  - Giao diện hai nửa: trái là danh sách câu sai để tra cứu (chi tiết mở rộng/thu gọn); phải là sổ tay, chỉ hiện tên lỗi, mức độ theo màu, tỉ lệ từng loại lỗi và ghi chú của học sinh; giải pháp và bản đồ lỗi chỉ hiện khi bấm vào.
  - Hai nhóm lỗi: **"Sai ngoo"** (ưu tiên, hiện trước): nhớ nhầm công thức, đọc sai đề/bỏ sót dữ kiện, tính toán/quên đổi đơn vị, sót ý/sót câu/quên không làm. **"Hổng kiến thức"** (theo chương/bài, gồm cả câu đoán mò): để xuống cuối.
  - Máy tự đoán loại lỗi khi chắc chắn, không chắc thì hỏi học sinh; học sinh tự sửa được loại lỗi của từng câu.
  - Câu thuộc đề chưa công bố lời giải vẫn hiện nội dung, chỉ ẩn đáp án và lời giải.
  - Sau khi nộp bài, web hiện một lần toàn bộ câu sai để học sinh chọn lý do từng câu, được bỏ qua.
  - Một lỗi tính là đã khắc phục khi làm đúng 2 lần ở 2 ngày khác nhau.
  - Trước khi làm đề, học sinh bắt buộc đánh dấu đã đọc phần "điều cần nhớ" lấy từ sổ tay.
  - Chốt thêm 26/11/2026: thẻ công thức (tên gợi nhớ, phạm vi, dấu hiệu theo từng bài) do Cowork "Kho đề" soạn nháp, giáo viên duyệt; thời gian đề xuất cho đề 50 phút: Phần I 15, Phần II 15, Phần III 12, kiểm tra lại 8 phút (co giãn theo thời gian đề); dùng danh sách từ khóa dễ đọc sai mặc định, giáo viên bổ sung trong CaiDat, chưa gắn từ khóa riêng từng câu; đánh dấu câu đúng nhưng đoán mò làm sau Pha 7c.
  - Giao diện sổ tay (chốt 26/11/2026): nền giấy kẻ, mỗi dòng chữ cao đúng một dòng kẻ, chữ nằm giữa hai dòng kẻ (không dùng kiểu viết sát dòng kẻ).

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
- **Người cộng tác (chốt 24/11/2026):** giáo viên được mời thêm người cùng làm, gồm sửa code và dữ liệu web.
  1. GitHub: thêm làm Collaborator với quyền Write. Người cộng tác làm trên nhánh riêng, gộp vào `main` qua pull request, giáo viên (chủ repo) duyệt trước khi gộp, vì `main` phát hành thẳng ra trang thật.
  2. Sheet "web luyện đề": chia sẻ quyền Người chỉnh sửa. Người cộng tác vào trang quản trị bằng email Google ghi thêm vào `CaiDat` → `EMAIL_GIAO_VIEN` (nhiều email cách nhau dấu phẩy), hạn chế dùng chung mật khẩu quản trị.
  3. Kho "KHO CÂU HỎI VẬT LÝ", thư mục "02. HÌNH VẼ" và thư mục "WEB LUYỆN ĐỀ – TÀI LIỆU CHUNG": chia sẻ theo việc được giao (quyền sửa hoặc chỉ xem).
  4. Chỉ giáo viên (chủ máy chủ) bấm Triển khai → Phiên bản mới cho Apps Script. Người cộng tác sửa `Code.gs` trong repo, tăng `APP_VERSION`, ghi việc vào `docs/VIEC-GIAO-VIEN.md`.
  5. Người mới (và Claude của họ) đọc theo thứ tự: `CLAUDE.md` → `docs/TONG-QUAN.md` → file Quyết định đã chốt. Quyết định chung vẫn ghi vào file trên Drive. Không ghi tên, email người cộng tác vào repo.
- **Pha 7 — Sổ tay cá nhân (chốt 26/11/2026):** 7a sổ tay tự động (danh sách câu sai, phân loại lỗi máy tự đoán, mức độ theo màu); 7b học sinh tự phân loại lỗi, ghi chú, lời nhắc trước khi làm đề và công cụ khắc phục từng loại lỗi; 7c đề khắc phục và trạng thái đã khắc phục. Đặc tả: `docs/spec/pha-7-so-tay.md`.

## 9. Câu hỏi mở / việc đang chờ
- ~~Code.gs 1.1.0 chưa dán vào Apps Script — dán một lần ở Pha 6.~~ Đã dán Code.gs 1.5.0 ngày 21/11/2026.
- ~~Logo VLSN chuẩn từ vatly.ai: chưa có file (mạng bị chặn).~~ Đã chốt 21/11/2026: dùng logo hiện tại (mê cung chữ Q). Logo trong file Word mẫu là logo mê cung chữ Q — giáo viên xác nhận dùng logo này hay gửi file logo vatly.ai (19/11/2026). Pha 5 tạm dùng logo mê cung, thay sau bằng một file.
- 12 đề xuất tham khảo giao diện từ vatly.ai, Azota, OnLuyen, SHub, Moon: chưa chốt, xem lại sau.

## 10. Nhật ký thay đổi
- 18/11/2026 — Claude Code: tạo file.
- 18/11/2026 — Claude Code: giáo viên duyệt đặc tả Pha 0; ghi các quyết định (thứ tự pha, nhớ tạm 60 giây, hoãn nhiều mã đề, KetQuaLuyenTap, loại câu đang thi khỏi luyện tập, Equation, thiết kế theo mục 6, tạm ẩn Đổi PIN và mục tiêu điểm).
- 18/11/2026 — Cowork: bổ sung quy tắc nhập kho (mục 5), form VLSN cho file Word đề (mục 6); chốt giữ giao diện hiện tại, màu xanh #1D6B3E, logo VLSN từ vatly.ai.
- 19/11/2026 — Claude Code: ghi file kho câu hỏi mới (mục 1). Pha 1 đã gộp; Pha 2 qua soát code và kiểm thử.
- 19/11/2026 — Claude Code: gộp Pha 2; từ Pha 3 làm ở phiên mới theo docs/BAN-GIAO.md.
- 19/11/2026 — Claude Code (phiên mới): bài kiểm thử "Tạo đề" chập chờn của Pha 2 là lỗi của bài test (đọc nhầm mã câu khi gặp câu thiếu hình), không phải lỗi web; đã sửa. Bắt đầu Pha 3.
- 19/11/2026 — Claude Code: Pha 5 viết lại đặc tả theo mục 6. Chưa chốt: file logo chuẩn (tạm dùng logo mê cung, web chỉ trỏ tới một file assets/img/logo-vlsn.png); tiêu đề có in hoa toàn bộ không; slogan ở đầu trang hay chân trang (mặc định: chân trang).
- 19/11/2026 — Claude Code: gộp Pha 3 (Tải đề Word/Excel); soát code và kiểm thử vòng 2 ĐẠT; 4 file Word thật: đúng số câu, 525/525 công thức đổi được. Không đổi Code.gs. Repo không ghi id file thật trên Drive. Bắt đầu Pha 4.
- 19/11/2026 — Claude Code: chốt thêm mục 5 — câu của đề thi chỉ vào luyện tập khi đề đã đóng và cho xem lời giải (theo soát code Pha 4).
- 19/11/2026 — Claude Code: gộp Pha 4 (Luyện tập, Code.gs 1.4.0); soát và kiểm thử ĐẠT sau 3 vòng. Bắt đầu Pha 5.
- 20/11/2026 — Claude Code: gộp Pha 5 (màu xanh #1D6B3E, logo VLSN TẠM, chân trang thương hiệu + hotline + slogan, bỏ tên giáo viên; giữ bố cục). Tiêu đề Montserrat 800 không in hoa toàn bộ (mặc định, chờ giáo viên). Thay logo chuẩn = thay file assets/img/logo-vlsn.png. Bắt đầu Pha 6a.
- 21/11/2026 — Claude Code: gộp Pha 6a (Code.gs bản cuối 1.5.0, README, docs/VIEC-GIAO-VIEN.md); soát code và kiểm thử vòng 2 ĐẠT. Chờ giáo viên làm Pha 6b (dán Code.gs một lần).
- 21/11/2026 — Claude Code: Pha 6b xong cùng giáo viên — máy chủ thật lên Code.gs 1.5.0; TC-6.7, 6.8 ĐẠT; sửa bảng kẻ gạch và hình đặt nổi trong file Word. Lỗi dữ liệu kho (mất Φ, hình nghiêng) ghi cho Cowork (mục 9). Hoàn tất Pha 0–6.
- 21/11/2026 — Claude Code: giáo viên chốt dùng logo hiện tại (mê cung chữ Q) cho web (mục 6, mục 9).
- 21/11/2026 — Claude Code: giáo viên chốt giao diện (mục 6): tiêu đề không in hoa (Montserrat đậm 700); chữ chế độ tối dịu hơn để không chói; slogan ở chân trang; tên trang web không có tên giáo viên (giáo viên tự sửa ở Cài đặt).
- 24/11/2026 — Claude Code: giáo viên chốt cho thêm người cộng tác (sửa code và dữ liệu web), ghi ở mục 8; thêm `docs/TONG-QUAN.md` (tóm tắt chức năng và tài liệu cho người mới).
- 26/11/2026 — Cowork: nhập Lớp 10 (13 đề chính thức + 41 đề cương, bản có lời giải) vào kho; ghi quy tắc nhập Lớp 10 vào mục 5. Kho trên máy đã chốt (2.674 câu L10); chưa đồng bộ lên Google Sheet kho.
- 26/11/2026 — Claude Code: giáo viên chốt tính năng Sổ tay cá nhân cho học sinh (Pha 7a–7c), ghi ở mục 5 và mục 8. Đặc tả `docs/spec/pha-7-so-tay.md` chờ giáo viên duyệt.
- 26/11/2026 — Claude Code: giáo viên duyệt đặc tả Pha 7 và chốt 4 câu hỏi mở theo đề xuất; dựng trang mẫu giao diện Sổ tay.
- 26/11/2026 — Claude Code: giáo viên chốt giao diện sổ tay kiểu chữ nằm giữa hai dòng kẻ (mục 5); bắt đầu làm Pha 7a.
