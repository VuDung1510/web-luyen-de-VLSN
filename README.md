# Web luyện đề Vật lý

Trang web luyện đề trực tuyến cho học sinh, chạy **miễn phí** trên GitHub Pages + Google Sheets.

**Học sinh** đăng nhập bằng mã PIN (ngày + tháng sinh) hoặc tài khoản Google, làm bài có **tính giờ**, nộp xong thấy ngay **điểm, nhận xét tự động, đáp án và lời giải**. Học sinh cũng xem được **lịch sử làm bài**, **thống kê theo chủ đề** và **bảng xếp hạng**.

**Giáo viên** dùng trang quản trị (`admin.html`) để soạn đề (gõ tay hoặc dán từ Word/Excel), quản lý học sinh và xem kết quả.
Mỗi bài nộp tự ghi một dòng **Họ tên – Lớp – Đề – Điểm – Thời gian – Nhận xét** vào Google Sheet. Trang quản trị có thống kê từng đề, bảng điểm theo lớp, xuất Excel, và tùy chọn gửi email mỗi khi có bài nộp.

Cấu trúc đề theo mẫu thi tốt nghiệp THPT từ 2025, gồm 3 phần:

| Phần | Dạng câu | Cách chấm (mặc định) |
|---|---|---|
| I | Trắc nghiệm 4 lựa chọn | 0,25 điểm/câu |
| II | Đúng/Sai (4 ý a, b, c, d) | đúng 1/2/3/4 ý → 0,1 / 0,25 / 0,5 / 1 điểm |
| III | Trả lời ngắn (đáp số) | 0,25 điểm/câu; chấp nhận dấu phẩy, có thể đặt sai số |

Điểm được quy về thang 10. Công thức viết bằng LaTeX trong dấu `$...$`.

---

## Cách hệ thống hoạt động

```
Học sinh / Giáo viên ──► Trang web (GitHub Pages) ──► Máy chủ (Google Apps Script) ──► Google Sheet của thầy/cô
```

- Đáp án **chỉ nằm trong Google Sheet**. Trang web không bao giờ nhận đáp án trước khi học sinh nộp bài, và việc chấm điểm chạy trên máy chủ, nên học sinh không thể xem trộm hay sửa điểm.
- File Google Sheet có 5 trang tính: `HocSinh`, `DeThi`, `CauHoi`, `KetQua`, `CaiDat`. Thầy/cô mở trực tiếp để xem, lọc hay tải về Excel bất cứ lúc nào.

---

## Cài đặt (khoảng 15 phút, chỉ làm một lần)

### Bước 1. Cài máy chủ (Google Apps Script)

1. Vào <https://sheets.new> để tạo **một Google Sheet mới**, đặt tên ví dụ "Luyện đề Vật lý — Dữ liệu".
2. Trên thanh menu, chọn **Tiện ích mở rộng → Apps Script**.
3. Xóa hết nội dung có sẵn trong `Code.gs`, rồi dán **toàn bộ** nội dung file [`apps-script/Code.gs`](apps-script/Code.gs) vào. Bấm 💾 **Lưu**.
4. Trên thanh công cụ, chọn hàm **`setup`** rồi bấm ▶ **Chạy**.
   - Google sẽ hỏi cấp quyền: **Xem xét quyền → chọn tài khoản → Nâng cao → Đi tới … (không an toàn) → Cho phép**. Cảnh báo này xuất hiện vì đây là script do chính thầy/cô tạo.
   - Chạy xong, quay lại Google Sheet sẽ thấy 5 trang tính, một học sinh mẫu và một đề mẫu.
   - **Mật khẩu trang quản trị** nằm ở trang tính `CaiDat`, dòng `MAT_KHAU_QUAN_TRI`.
5. Bấm **Triển khai → Tùy chọn triển khai mới**:
   - Bấm ⚙ cạnh "Chọn loại", chọn **Ứng dụng web**.
   - **Thực thi với tư cách:** *Tôi*
   - **Người có quyền truy cập:** *Bất kỳ ai* (**bắt buộc** chọn mục này để học sinh dùng được)
   - Bấm **Triển khai**, rồi **sao chép "URL ứng dụng web"** (dạng `https://script.google.com/macros/s/…/exec`).

> **Khi cập nhật Code.gs sau này:** dán code mới, chạy lại `setup` (dữ liệu cũ không bị mất), rồi vào **Triển khai → Quản lý các bản triển khai → ✏ Chỉnh sửa → Phiên bản: Phiên bản mới → Triển khai**. Làm theo cách này thì URL giữ nguyên.

### Bước 2. Nối trang web với máy chủ

Mở file [`assets/js/config.js`](assets/js/config.js) trên GitHub (bấm ✏ để sửa), dán URL vừa sao chép vào giữa hai dấu nháy:

```js
window.APP_CONFIG = {
  API_URL: 'https://script.google.com/macros/s/XXXXXXXX/exec'
};
```

rồi bấm **Commit changes**.

### Bước 3. Bật GitHub Pages

1. GitHub Pages miễn phí **chỉ dùng được cho repo công khai**. Vào **Settings → General → Danger Zone → Change visibility → Public**.
   Đáp án và dữ liệu học sinh nằm trong Google Sheet riêng của thầy/cô, **không** nằm trong repo, nên để repo công khai vẫn an toàn.
2. Vào **Settings → Pages**. Ở mục *Source*, chọn **Deploy from a branch**, chọn branch **`main`**, thư mục **`/ (root)`**, rồi bấm **Save**.
3. Chờ khoảng 1–2 phút. Trang web sẽ có địa chỉ:
   - Học sinh: `https://vudung1510.github.io/web-luyen-de-VLSN/`
   - Giáo viên: `https://vudung1510.github.io/web-luyen-de-VLSN/admin.html`

### Bước 4. Dùng thử

- Mở trang học sinh, chọn lớp **12A1**, chọn **Học Sinh Mẫu**, nhập PIN **0101**, rồi làm đề mẫu.
- Mở trang quản trị, nhập mật khẩu lấy từ trang tính `CaiDat`. Thầy/cô sẽ thấy ngay bài vừa nộp.
- Khi đã chạy ổn, có thể xóa học sinh mẫu và đề mẫu.

---

## Bật đăng nhập bằng Google (tùy chọn)

Nếu chưa bật, mọi thứ vẫn chạy được: học sinh dùng PIN, giáo viên dùng mật khẩu.

1. Vào <https://console.cloud.google.com/>, tạo một project mới (ví dụ "Luyen de").
2. Vào **APIs & Services → OAuth consent screen**: chọn *External*, điền tên ứng dụng và email, lưu lại. Sau đó bấm **Publish app** để mọi tài khoản Google đều đăng nhập được.
3. Vào **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**
   - Authorized JavaScript origins: `https://vudung1510.github.io`
   - Bấm **Create**, rồi sao chép **Client ID** (dạng `….apps.googleusercontent.com`).
4. Trong trang quản trị, vào **Cài đặt**:
   - Dán Client ID vào ô **Google OAuth Client ID**.
   - Điền **Email Google của giáo viên** (để đăng nhập trang quản trị bằng Google).
   - Bấm **Lưu cài đặt**.

Học sinh có hai cách gắn tài khoản Google:
- **Tự liên kết:** lần đầu bấm "Đăng nhập bằng Google", hệ thống hỏi lớp, họ tên và PIN một lần để xác minh. Các lần sau chỉ cần bấm nút Google.
- **Giáo viên gắn sẵn:** điền email của học sinh trong mục Học sinh.

---

## Hướng dẫn sử dụng cho giáo viên

### Thêm học sinh

Vào **Học sinh** trong trang quản trị:
- **+ Thêm học sinh:** thêm từng em.
- **⇪ Nhập danh sách:** bôi đen danh sách trong Excel hoặc Google Sheets theo cột *Họ tên | Lớp | Ngày sinh | Email* rồi dán vào.
- **PIN** mặc định là ngày và tháng sinh. Ví dụ em sinh 05/03/2008 thì PIN là `0503`. Có thể đặt **PIN riêng** cho từng em.
- **🖨 In phiếu đăng nhập:** in phiếu ghi tên, lớp, PIN để phát cho học sinh.
- **Học sinh tự đổi PIN:** sau khi đăng nhập, bấm **Đổi PIN** ở góc trên (cần nhập PIN hiện tại). Học sinh quên PIN thì giáo viên vào **Sửa** để đặt lại.
- Nhập sai PIN 5 lần thì tài khoản bị khóa tạm 10 phút. Muốn chặn hẳn một học sinh, chọn trạng thái **Khóa**.

### Soạn đề

Vào **Đề thi → + Tạo đề mới**. Có 3 cách nhập câu hỏi:

1. **Gõ trực tiếp** trên trang. Bấm vào nút để chọn đáp án, và **Tải ảnh** để thêm hình (ảnh được lưu vào Google Drive của thầy/cô).
2. **Dán văn bản từ Word** (nút *Nhập nhanh*), theo mẫu:

   ```
   PHẦN I
   Câu 1. Đơn vị của cảm ứng từ là
   A. tesla.   B. vêbe.   C. henry.   D. vôn.
   Câu 2. ...
   *B. ...                      ← dấu * đánh dấu đáp án đúng
   Lời giải: ...
   PHẦN II
   Câu 1. Một bình khí ...
   a) Ý thứ nhất (Đ)
   b) Ý thứ hai (S)
   c) ... (Đ)
   d) ... (S)
   PHẦN III
   Câu 1. Tính nhiệt lượng ... (kJ)?
   Đáp số: 420
   BẢNG ĐÁP ÁN
   PHẦN I
   1.A 2.B 3.C ...
   ```

   Công thức trong Word nên chuyển sang dạng LaTeX, ví dụ `$v = \sqrt{2gh}$`, `$2.10^5$ Pa`. Dấu phẩy thập phân viết bình thường: `$2,67.10^5$`.
3. **Dán từ Excel hoặc Google Sheets** theo cột: *Loại | Nội dung | A | B | C | D | Đáp án | Chủ đề | Mức độ | Lời giải | Điểm | Sai số | Hình ảnh*.

Nên ghi **Chủ đề** và **Mức độ** (NB/TH/VD/VDC) cho mỗi câu. Phần nhận xét tự động và thống kê dựa vào hai thông tin này.

**Tùy chọn của mỗi đề:** thời gian làm bài, dành cho lớp nào, giờ mở/đóng, số lần làm tối đa, trộn thứ tự câu, và thời điểm hiện đáp án (ngay sau khi nộp / sau khi đề đóng / không hiện).

### Mục tiêu điểm

Trước mỗi lần làm bài, học sinh **tự đặt mục tiêu** (0–10 điểm). Hệ thống gợi ý mục tiêu cao hơn điểm lần trước một chút.
Nộp bài xong:
- **Đạt:** hệ thống chúc mừng và gợi ý mục tiêu cao hơn cho lần sau.
- **Chưa đạt:** hệ thống hiện lời động viên phù hợp với khoảng cách còn thiếu, kèm kế hoạch luyện tập: xem lời giải các câu sai, làm lại đề, và tối đa 3 **đề tương tự**. Đề tương tự là các đề đang mở có nhiều câu thuộc những chủ đề học sinh vừa mất điểm.

Mục tiêu được lưu ở cột **Mục tiêu** trong trang tính `KetQua`. Trang thống kê đề có thêm tỉ lệ học sinh đạt mục tiêu tự đặt.

### Nhận xét tự động

Sau khi nộp, mỗi bài được nhận xét theo:
- kết quả từng phần (trắc nghiệm, Đúng/Sai, trả lời ngắn), số ý đúng ở phần Đúng/Sai và cảnh báo khi một câu chỉ sai đúng 1 ý;
- mức độ: mất điểm ở câu nhận biết, làm tốt câu vận dụng…;
- chủ đề: chủ đề **nắm vững** và chủ đề **cần ôn lại**;
- số câu bỏ trống, cách dùng thời gian (nộp quá sớm hay hết giờ mà còn bỏ trống);
- **tiến bộ** so với lần làm trước và so với điểm trung bình của chính học sinh đó.

Nhận xét được lưu vào cột *Nhận xét* trong trang tính `KetQua`.

### Xem kết quả

- **Google Sheet → trang tính `KetQua`:** mỗi lần nộp là một dòng gồm Nộp lúc, Họ tên, Lớp, Đề, Điểm (thang 10), Số câu đúng, Thời gian làm, Nhận xét. Bài nộp trễ quá 2 phút sau giờ quy định được ghi chú "Nộp muộn".
- **Trang quản trị:**
  - **Kết quả:** lọc theo đề, lớp hoặc học sinh; xem chi tiết từng bài; **xuất Excel (CSV)**.
  - **Đề thi → Thống kê:** điểm trung bình, trung vị, phổ điểm, tỉ lệ làm đúng từng câu, phân bố lựa chọn A/B/C/D, so sánh giữa các lớp.
  - **Bảng điểm:** bảng học sinh × đề (điểm cao nhất mỗi đề), xuất được ra Excel.
- **Email:** trong **Cài đặt**, bật *Gửi email cho giáo viên mỗi khi có bài nộp* (giới hạn khoảng 100 email/ngày với tài khoản Gmail thường).

---

## Cấu trúc thư mục

```
index.html            Trang học sinh
admin.html            Trang quản trị giáo viên
assets/css/style.css  Giao diện (hỗ trợ điện thoại, chế độ tối)
assets/js/config.js   ← DÁN URL MÁY CHỦ VÀO ĐÂY
assets/js/common.js   Hàm dùng chung (gọi máy chủ, hiển thị kết quả, công thức)
assets/js/app.js      Logic trang học sinh
assets/js/admin.js    Logic trang quản trị
assets/js/importer.js Đọc đề dán từ Word / Excel
apps-script/Code.gs   Máy chủ: dán vào Google Apps Script
tests/                Kiểm thử (dành cho lập trình viên)
```

## Dành cho lập trình viên

Có thể chạy toàn bộ hệ thống trên máy mà không cần Google. Máy chủ giả lập chạy `Code.gs` bằng Node.

```bash
node tests/backend.test.js     # kiểm thử máy chủ: chấm điểm, đăng nhập, phân quyền…
node tests/importer.test.js    # kiểm thử bộ nhập đề
node tests/dev-server.js       # chạy thử tại http://localhost:8787 (in ra mật khẩu quản trị)
ADMIN_PW=<mật khẩu> node tests/e2e.js   # kiểm thử giao diện bằng Playwright
```

**Giới hạn của Google Apps Script** (tài khoản miễn phí): khoảng 30 người gửi yêu cầu cùng lúc, và mỗi yêu cầu mất 1–2 giây. Một lớp 40–50 em cùng làm bài vẫn chạy ổn, vì học sinh chỉ gọi máy chủ lúc bắt đầu và lúc nộp bài.
