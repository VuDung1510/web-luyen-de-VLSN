# Web luyện đề Vật lý

Trang web luyện đề trực tuyến cho học sinh, chạy **miễn phí** trên GitHub Pages + Google Sheets.

**Học sinh** đăng nhập bằng mã PIN (ngày + tháng sinh) hoặc tài khoản Google, làm bài có **tính giờ**, nộp xong thấy ngay **điểm, nhận xét tự động, đáp án và lời giải**. Học sinh cũng xem được **lịch sử làm bài**, **thống kê theo chủ đề** và **bảng xếp hạng**.

**Giáo viên** dùng trang quản trị (`admin.html`) để soạn đề (gõ tay, dán hoặc tải file Word/Excel, lấy câu từ ngân hàng câu hỏi), mở mục **Luyện tập** cho học sinh, quản lý học sinh và xem kết quả.
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
- File Google Sheet có 9 trang tính: `HocSinh`, `DeThi`, `CauHoi`, `KetQua`, `CaiDat`, `LuyenTap` (câu cho học sinh luyện tập), `KetQuaLuyenTap` (bài luyện đã nộp), `SoTay` (loại lỗi và ghi chú học sinh tự nhập trong Sổ tay), `CongThuc` (thẻ công thức theo bài, giáo viên nhập). Thầy/cô mở trực tiếp để xem, lọc hay tải về Excel bất cứ lúc nào. Không đổi tên trang tính, hàng tiêu đề, cột Mã HS / Mã đề.
- Ngân hàng câu hỏi nằm ở một file Google Sheet **riêng** ("KHO CÂU HỎI VẬT LÝ"). Máy chủ chỉ **đọc** kho khi giáo viên tạo đề; học sinh không đọc kho.

### Hiệu năng (nhớ tạm 60 giây)

- Máy chủ nhớ tạm dữ liệu trang tính tối đa **60 giây**. Trang web hiện ngay dữ liệu đã lưu trên máy (chuyển trang gần như tức thì), rồi cập nhật ngầm; lần đầu mở trang thì hiện khung xám trong lúc tải.
- Mọi thao tác trên web (nộp bài, lưu đề, sửa học sinh…) hiện kết quả mới ngay.
- Sửa **trực tiếp trên Google Sheet** thì web thấy sau **tối đa 60 giây**. Sửa **ô** thì thường thấy ngay ở lần mở tiếp theo (hàm `onEdit` báo máy chủ bỏ bản nhớ tạm — chưa kiểm chứng trên Apps Script thật). **Chèn / xóa / sắp xếp hàng** thì luôn có thể chậm tối đa 60 giây.
- Việc ghi của web luôn đọc lại Sheet nên không bao giờ ghi nhầm hàng.

---

## Cài đặt (khoảng 15 phút, chỉ làm một lần)

### Bước 1. Cài máy chủ (Google Apps Script)

1. Vào <https://sheets.new> để tạo **một Google Sheet mới**, đặt tên ví dụ "Luyện đề Vật lý — Dữ liệu".
2. Trên thanh menu, chọn **Tiện ích mở rộng → Apps Script**.
3. Xóa hết nội dung có sẵn trong `Code.gs`, rồi dán **toàn bộ** nội dung file [`apps-script/Code.gs`](apps-script/Code.gs) vào. Bấm 💾 **Lưu**.
4. Trên thanh công cụ, chọn hàm **`setup`** rồi bấm ▶ **Chạy**.
   - Google sẽ hỏi cấp quyền: **Xem xét quyền → chọn tài khoản → Nâng cao → Đi tới … (không an toàn) → Cho phép**. Cảnh báo này xuất hiện vì đây là script do chính thầy/cô tạo.
   - Chạy xong, quay lại Google Sheet sẽ thấy 9 trang tính, một học sinh mẫu và một đề mẫu.
   - **Mật khẩu trang quản trị** nằm ở trang tính `CaiDat`, dòng `MAT_KHAU_QUAN_TRI` (nhật ký của `setup` cũng in mật khẩu: đừng chụp gửi ai).
5. Bấm **Triển khai → Tùy chọn triển khai mới**:
   - Bấm ⚙ cạnh "Chọn loại", chọn **Ứng dụng web**.
   - **Thực thi với tư cách:** *Tôi*
   - **Người có quyền truy cập:** *Bất kỳ ai* (**bắt buộc** chọn mục này để học sinh dùng được)
   - Bấm **Triển khai**, rồi **sao chép "URL ứng dụng web"** (dạng `https://script.google.com/macros/s/…/exec`).

6. (Tùy chọn) Chọn hàm **`kiemTraSauTrienKhai`** rồi bấm ▶ **Chạy**, xem **Nhật ký thực thi**: mọi dòng ✅ là ổn. Hàm này chỉ đọc, không sửa dữ liệu.

### Khi cập nhật Code.gs

Danh sách từng bước có ô đánh dấu: [`docs/VIEC-GIAO-VIEN.md`](docs/VIEC-GIAO-VIEN.md). Tóm tắt:

0. Trước khi dán: đo tốc độ trang đang chạy (bước A0) để so sau khi cập nhật.
1. Sao lưu: trong Google Sheet, **Tệp → Tạo bản sao**.
2. Mở **Tiện ích mở rộng → Apps Script**, mở file .gs đang có code (`Code.gs` hoặc `Mã.gs`), xóa hết nội dung cũ, dán **toàn bộ** `apps-script/Code.gs` mới, bấm 💾 **Lưu**.
3. Chạy hàm **`setup`** một lần. Dữ liệu cũ giữ nguyên; `setup` chỉ **thêm** trang tính, cột và dòng cài đặt còn thiếu. Chạy lại nhiều lần cũng không trùng. Nếu Google hỏi quyền mới (đọc file khác, Drive): **Nâng cao → Đi tới … (không an toàn) → Cho phép**.
4. **Triển khai → Quản lý các bản triển khai → ✏ Chỉnh sửa → Phiên bản: Phiên bản mới → Triển khai.** URL giữ nguyên, không sửa `config.js`. Quên chọn "Phiên bản mới" thì học sinh vẫn dùng máy chủ cũ.
5. Chạy hàm **`kiemTraSauTrienKhai`** (chỉ gửi nhật ký của hàm này, không gửi nhật ký `setup`), rồi mở trang quản trị → **Cài đặt** → khung **Dữ liệu** (cuối trang): dòng "Phiên bản máy chủ" phải là số mới (hiện là **1.7.0**; máy chủ thật đang là 1.5.0). Trang đang mở từ trước: bấm F5 một lần là web nhận máy chủ mới.
6. Hỏng thì quay về: **Triển khai → Quản lý các bản triển khai → ✏ → Phiên bản:** chọn số phiên bản cũ → **Triển khai**. Giao diện web vẫn chạy được với máy chủ cũ (tự ẩn nút cần máy chủ mới).

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

Vào **Đề thi → + Tạo đề mới**. Có các cách nhập câu hỏi sau (có thể kết hợp):

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
4. **Tải file lên** (*Nhập nhanh từ Word / Excel → Tải file lên*): kéo thả hoặc chọn file Word (`.docx`), Excel (`.xlsx`), `.csv` hoặc `.txt`, tối đa 10 MB.
   - File Word theo mẫu VLSN: công thức gõ bằng **Equation** của Word được đổi sang LaTeX; hình trong file được tải lên Drive khi bấm thêm; khung đầu đề, "Đáp án của em", "HẾT" không lẫn vào câu. Lời giải sau "HẾT" ("Câu 1. Lời giải: Chọn B.") được gắn vào đúng câu và lấy đáp án.
   - Web cho **xem trước** số câu từng phần và các cảnh báo (công thức chưa đổi được, hình cần chụp lại, câu chưa có đáp án) rồi mới **Thêm vào đề** hoặc **Thay toàn bộ câu hiện có**. Câu còn công thức cần gõ lại (⟦…⟧) được tô vàng trong trình soạn; câu có hình cần chụp lại có nhãn riêng.
   - Không đọc được file `.doc` (Word 97–2003), PDF, chữ trong Text Box, công thức MathType: web báo rõ; khi đó mở bằng Word, lưu lại dạng `.docx` hoặc dán văn bản.
   - Thư viện đọc file tải từ cdnjs (dự phòng jsdelivr). Không tải được thì vẫn dán văn bản như cách 2.

Nên ghi **Chủ đề** và **Mức độ** (NB/TH/VD/VDC) cho mỗi câu. Phần nhận xét tự động và thống kê dựa vào hai thông tin này.

**Tùy chọn của mỗi đề:** thời gian làm bài, dành cho lớp nào, giờ mở/đóng, số lần làm tối đa, trộn thứ tự câu, và thời điểm hiện đáp án (ngay sau khi nộp / sau khi đề đóng / không hiện).

### Tạo đề từ Ngân hàng câu hỏi (cần máy chủ mới)

Ngân hàng là file Google Sheet riêng **"KHO CÂU HỎI VẬT LÝ"**. Web chỉ **đọc** kho (không bao giờ sửa kho), rồi chép các câu được chọn sang trang tính `CauHoi` của đề.

1. **Cài một lần:** trong **Cài đặt** (hoặc trang tính `CaiDat`), dán link file kho **mà thầy mở được trong Drive của mình** (mở file kho, chép địa chỉ trên thanh trình duyệt) vào *KHO_CAU_HOI_ID* và nên dán link thư mục hình "02. HÌNH VẼ" vào *THU_MUC_HINH_KHO_ID*. Lần đầu: mở Apps Script, chạy hàm `setup` một lần để cho phép máy chủ đọc Drive.
2. Mở tab **Ngân hàng**: lọc theo lớp, chương → bài, dạng câu, mức độ, nguồn, hoặc tìm chữ. Chỉ câu **đã có đáp án hợp lệ** mới hiện; câu tự luận (Phần IV) tạm bỏ qua.
3. Cho câu vào **giỏ** (thanh dưới cùng: *P1 x · P2 y · P3 z*), hoặc:
   - **Ma trận 1 chạm**: mặc định 18–4–6, sửa được số câu mỗi phần; ưu tiên câu ít được dùng. Kho không đủ câu thì web báo rõ phần nào thiếu bao nhiêu câu.
   - **Lấy đề gốc**: chọn một Nguồn, web nạp các câu có đáp án theo đúng thứ tự trong đề gốc và báo câu thiếu / câu chưa có đáp án.
4. Bấm **Tạo đề**: web chép hình của các câu sang thư mục hình của web (file gốc giữ nguyên quyền), rồi mở trình soạn đề với các câu đã nạp. Kiểm tra, đặt tên rồi bấm **Lưu đề**.

Sửa kho (thêm đáp án, thêm câu) xong thì bấm **↻ Đọc lại kho** (web nhớ kho 10 phút). Đầu tab Ngân hàng ghi số câu của kho, số câu có đáp án và số câu **dùng được**; câu thiếu đáp án hoặc đáp án Phần III không phải số thì không dùng được — sửa trong kho rồi Đọc lại kho.

### Luyện tập cho học sinh (cần máy chủ mới)

1. Tab **Ngân hàng**: lọc, cho câu vào giỏ → **Đưa vào luyện tập**. Câu được chép sang trang tính `LuyenTap` (tối đa 3 000 câu đang bật).
2. Tab **Pool luyện tập**: xem, **Tắt/Bật** từng câu. Không xóa hàng trong `LuyenTap` (bài luyện cũ sẽ báo "câu đã bị gỡ"); muốn bỏ câu thì bấm Tắt.
3. **Cài đặt → Mục Luyện tập cho học sinh = Bật** (`CHO_LUYEN_TAP` = `CO`). Mặc định là Tắt. "Đề nhanh theo bài" mặc định `7,1,2,10` (số câu Phần I, II, III, số phút).
4. Học sinh vào **🎯 Luyện tập**: tự tạo đề theo bài, **luyện lại câu đã sai**, hoặc **đề nhanh** theo bài. Nộp xong có đáp án và lời giải ngay. Bài luyện ghi vào `KetQuaLuyenTap`, **không** tính vào bảng xếp hạng hay bảng điểm.
5. Câu đang nằm trong một **đề thi chưa đóng** (hoặc đề không cho xem lời giải) không xuất hiện trong luyện tập; tab Pool gắn nhãn "đang thi". Câu chỉ vào luyện tập khi đề đó đã đóng và cho xem lời giải.

### Sổ tay cá nhân (cần máy chủ 1.7.0)

1. Học sinh vào **Sổ tay**: một nửa là danh sách **mọi câu đã làm sai** (đề thi và luyện tập), một nửa là **cuốn sổ** tổng hợp lỗi. Câu sai gộp theo câu: làm lại đúng thì đèn chuyển **đỏ → vàng → xanh** (xanh = đúng 2 lần ở 2 ngày khác nhau).
2. Lỗi chia hai nhóm: **Sai ngoo** (nhớ nhầm công thức, đọc sai đề, tính toán / quên đổi đơn vị, sót ý / sót câu) hiện trước; **Hổng kiến thức** (theo chương, bài; gồm câu đoán mò và câu chưa phân loại) để dưới cùng. Loại lỗi nào sai ≥ 3 câu ở ≥ 2 đề thì gắn nhãn **Lặp lại**.
3. Máy tự nhận ra câu bỏ trống, và (khi đề đã công bố lời giải) đáp án Phần III lệch đúng 10ⁿ lần, lệch nhỏ hoặc ngược dấu. Câu thuộc đề chưa công bố lời giải vẫn hiện nội dung và câu trả lời của em, **không** hiện đáp án và lời giải.
4. **Cài đặt → Mục Sổ tay cho học sinh** (`BAT_SO_TAY`): mặc định Bật. Trang tính `CongThuc` (thẻ công thức theo bài) do giáo viên nhập dần; học sinh tự phân loại lỗi, ghi chú, đề khắc phục sẽ có ở các bản sau (Pha 7b, 7c).

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

### Giao diện: màu và logo

- Màu chủ đạo xanh VLSN **#1D6B3E**; có chế độ tối theo cài đặt của máy. Tiêu đề phông Montserrat đậm.
- Chân trang: "HỆ THỐNG GIÁO DỤC VẬT LÝ SIÊU NHẨM", hotline và slogan. Tên giáo viên (`TEN_GIAO_VIEN`) không hiện trên trang học sinh.
- **Thay logo:** thay đúng file [`assets/img/logo-vlsn.png`](assets/img/logo-vlsn.png), **giữ nguyên tên file**, không cần sửa code. Ảnh PNG nền trong suốt, vuông hoặc ngang đều vừa, nên ≤ 200 KB. Logo này cũng là biểu tượng trên tab trình duyệt. (Logo hiện tại là logo **tạm**.)

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
assets/js/docx-reader.js Đọc file Word / Excel tải lên
assets/img/logo-vlsn.png Logo (thay file này để đổi logo)
apps-script/Code.gs   Máy chủ: dán vào Google Apps Script
docs/                 Quyết định, đặc tả, báo cáo từng pha, việc giáo viên cần làm
docs/TONG-QUAN.md     Tóm tắt dự án cho người cộng tác mới
tests/                Kiểm thử (dành cho lập trình viên)
```

## Dành cho lập trình viên

Có thể chạy toàn bộ hệ thống trên máy mà không cần Google. Máy chủ giả lập chạy `Code.gs` bằng Node.

```bash
node tests/backend.test.js     # kiểm thử máy chủ: chấm điểm, đăng nhập, phân quyền…
node tests/importer.test.js    # kiểm thử bộ nhập đề
node tests/dev-server.js       # chạy thử tại http://localhost:8787 (in ra mật khẩu quản trị)
ADMIN_PW=<mật khẩu> node tests/e2e.js   # kiểm thử giao diện bằng Playwright (cổng: biến PORT, mặc định 8787)
node tests/cache.test.js       # kiểm thử đệm máy chủ và ghi an toàn (Pha 1)
node tests/common-cache.test.js   # kiểm thử bộ đệm trình duyệt (Pha 1)
PORT=8787 ADMIN_PW=<mật khẩu> node tests/pha1-r1.e2e.js   # đổi tài khoản giữa lúc làm mới ngầm (Pha 1)
node tests/bank.test.js        # ngân hàng câu hỏi: ánh xạ kho → câu hỏi, chỉ mục, ma trận, chép hình theo lô (Pha 2)
PORT=8787 ADMIN_PW=<mật khẩu> node tests/bank.e2e.js      # tab Ngân hàng đầu-cuối (dev-server mới; hoặc SERVER_COMPAT=1.0.0)
LIBS_DIR=<node_modules có jszip, xlsx, katex> node tests/docx.test.js   # đọc file Word/Excel (Pha 3)
node tests/pha4.test.js        # luyện tập (Pha 4)
node tests/pha5.test.js        # màu, tương phản (Pha 5)
node tests/pha6.test.js        # phát hành: phiên bản, setup trên Sheet cũ, kiemTraSauTrienKhai (Pha 6)
node tests/scan-secrets.js     # quét repo: mật khẩu, PIN, email, id file Drive (Pha 6)
```

Các e2e khác (`docx.e2e.js`, `pha4.e2e.js`, `pha5.e2e.js`, `pha*-kiem-thu.e2e.js`) chạy trên dev-server **khởi động mới**, cần `ADMIN_PW` và `LIBS_DIR`; xem dòng đầu mỗi file.

Biến môi trường của `tests/dev-server.js`:
- `SERVER_COMPAT=1.0.0` — nạp đúng máy chủ 1.0.0 (`tests/fixtures/Code-1.0.0.gs`) để thử giao diện với máy chủ cũ; chạy e2e kèm `SERVER_COMPAT=1.0.0` để bỏ qua các bước cần máy chủ mới.
- `LATENCY_MS=1500` — mỗi lần gọi máy chủ chậm thêm 1,5 giây như Apps Script thật.
- `SHEET_READ_MS`, `CACHE_MS` — chi phí giả mỗi lần đọc trang tính / gọi CacheService. `GET /__stats` xem số lần đọc.
- Ngân hàng câu hỏi: dev-server máy chủ mới tự gắn **kho giả tự soạn** (`tests/fixtures/kho-gia.js`, đúng định dạng kho thật, không chứa câu thật). `BANK=0` tắt; `BANK_ROWS=3000` dùng kho lớn tự sinh; `MAKE_COPY_MS=1000` chi phí giả mỗi lần chép hình.
- Đo số liệu Pha 1: `node tests/measure-pha1.js backend` và `ADMIN_PW=… node tests/measure-pha1.js browser`.

**Giới hạn của Google Apps Script** (tài khoản miễn phí): khoảng 30 người gửi yêu cầu cùng lúc, và mỗi yêu cầu mất 1–2 giây. Một lớp 40–50 em cùng làm bài vẫn chạy ổn, vì học sinh chỉ gọi máy chủ lúc bắt đầu và lúc nộp bài.
