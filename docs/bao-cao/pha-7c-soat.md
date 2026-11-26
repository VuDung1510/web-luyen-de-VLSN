# Pha 7c — Soát code (vai độc lập)

Phạm vi: `git diff a4112f5..HEAD` (commit `d16b81d` máy chủ, `f010456` giao diện). Đối chiếu `docs/spec/pha-7-so-tay.md` (§7 "Đề khắc phục (7c)", TC-7.18 → 7.23, dòng "Sửa đặc tả ngày 27/11/2026 (Pha 7c)") và `docs/bao-cao/pha-7c.md`.

## Tóm tắt cho giáo viên
- Đề khắc phục không đưa vào câu của đề chưa công bố lời giải, và không gửi đáp án hay lời giải trước khi nộp. Học sinh không tự sửa được "câu này khắc phục cho câu nào": thông tin đó nằm trong phiếu làm bài có chữ ký của máy chủ. Các kiểu luyện tập cũ chạy như trước.
- Có **1 lỗi mức Vừa** về cách tính màu. Trong cùng một đề khắc phục, nếu em **làm lại chính câu cũ vẫn sai** nhưng **câu tương tự làm đúng**, sổ tay vẫn chuyển câu cũ sang **vàng**; theo quy tắc đã chốt thì phải là **đỏ**. Lặp lại như vậy ở 2 ngày khác nhau thì câu được báo "đã khắc phục" (xanh) dù em chưa lần nào làm đúng chính câu đó.
- Kết luận: **CHƯA ĐẠT** vì lỗi trên làm sai trạng thái "đã khắc phục" trong sổ tay. Lỗi sửa được bằng vài dòng.

## Đã kiểm
- Đã chạy:
  - `pha7c` 9/9, `pha7` 16/16, `pha7b` 12/12, `pha7a-kiem-thu` 28/28, `pha7b-kiem-thu` 16/16, `pha4` 22, `pha4-kiem-thu` 33/33, backend, cache, bank, pha6, pha6-kiem-thu 105/105: đạt. `scan-secrets`: sạch.
  - Bài kiểm thử cũ chỉ đổi số phiên bản 1.7.0 → 1.8.0.
- Thử thêm bằng script tạm (dựng từ phần chuẩn bị của `tests/pha7c.test.js`, không đưa vào repo): sai 6 câu, 2 ngày sau làm đề khắc phục. Làm lại câu gốc **sai**, các câu tương tự (có `goc` = câu đó) **đúng**. Kết quả: câu gốc có `mau = 'vang'`, `lanSai = 2`. Xem R-1.
- **Không lộ đáp án / câu đề chưa công bố:**
  - Câu gốc chỉ vào đề qua `nbRedoQid_`, theo đúng luật của Pha 4. Câu kho phải có trong pool, đang bật và không bị chặn. Câu `examId#stt` phải thuộc đề không `examLocked_` (đã đóng và cho xem lời giải); câu nhập tay thêm điều kiện chưa bị sửa (mã băm khớp).
  - Câu tương tự lấy từ `practiceCandidates_`, đã bỏ mã bị chặn.
  - `practiceIssue_` lọc lại `blocked` và `bat`.
  - Phần trả về không có `dapAn` / `loiGiai` / `maKho`; `goc` chỉ nằm trong token.
  - Lưu ý: payload token chỉ ký chứ không mã hóa, nên đọc được `qids` / `goc` (mã câu, khóa câu). Pha 4 đã như vậy; chỉ là mã, không có đáp án.
- **`goc` không bị lợi dụng:**
  - `goc` do máy chủ đặt, lấy từ các câu trong sổ tay của chính học sinh, và nằm trong token đã ký. Sửa `goc` hay `qids` thì bị từ chối (TC-7.22).
  - `practiceSubmit_` chỉ đọc `p.goc` từ token. Token không phải `KHAC_PHUC` không có `goc`.
  - Không có API nào cho học sinh tự gửi `goc`.
  - Cách duy nhất làm câu "xanh" mà không làm lại chính nó là làm đúng câu tương tự ở 2 ngày, và đặc tả §4 cho phép điều này.
- **`practiceIssue_`:** phần phát đề tách nguyên khối, các biến đều qua tham số, chỉ thêm `goc` khi có. TU_TAO, CAU_SAI, NHANH giữ nguyên hành vi (test Pha 4 đạt). `requirePracticeOn_` chạy trước `nbFixStart_`, và `nbFixStart_` gọi `requireNotebookOn_`, đúng dòng sửa đặc tả (cần cả hai cài đặt bật).
- **Đề trống / ít câu:** sổ tay trống, không có câu làm lại được, pool không có câu cùng bài, hoặc câu bị gỡ đều báo lỗi rõ hay ghi chú "Chỉ dựng được n câu".
- **Màu và số lần sai:**
  - Sự kiện phụ `phu` không cộng vào `lanSai` hay `soDe`; câu hiển thị lấy theo lần sai thật (`lw`).
  - Câu tương tự sai trở thành mục riêng.
  - Trong một bài, câu khắc phục **phụ** sai được xếp sau câu phụ đúng, nên câu gốc về đỏ (đúng). Riêng trường hợp ở R-1 thì sai.
- **Giao diện:** `khacPhuc` chỉ hiện màu hằng (`do` / `vang` / `xanh`) và `stt` / `tieuDe` đã `esc`. Nút đề khắc phục chỉ hiện khi luyện tập bật. Trang Luyện tập khóa nút khi đang có bài dở. Không thấy XSS.
- **Hiệu năng:**
  - Khi nộp đề khắc phục, sổ tay được tính 2 lần, đều **ngoài khóa**. Lần trước khi ghi thường lấy từ đệm. Lần sau phải tính lại thật, vì `nbVer_` vừa đổi.
  - TC-7.23 (300 bài) đạt trên shim chậm.

## Bảng phát hiện

| Mã | Mức | File:dòng | Mô tả | Đề xuất sửa |
|---|---|---|---|---|
| R-1 | **Vừa** (trạng thái "đã khắc phục" sai) | `apps-script/Code.gs:2943–2955` (`nbEvents_`), `Code.gs` `nbCompute_` (`lwAll`) | Khi đề khắc phục có **chính câu gốc** (qid = khóa câu gốc), lần làm lại đó là sự kiện **thường**, được thêm vào trong vòng lặp. Các sự kiện **phụ** (câu tương tự) được thêm **sau** vòng lặp, và sắp theo (t, i) nên vẫn đứng sau. Vì vậy "câu gốc làm lại sai + câu tương tự đúng" trong cùng một bài cho kết quả: lần sai thật có chỉ số nhỏ hơn, lần đúng phụ ở sau, nên `after` có 1 lần đúng và màu là **vàng**. Đặc tả (dòng sửa 27/11, Pha 7c) quy định: trong cùng một bài, câu khắc phục đúng cùng câu khắc phục sai thì tính **sai**, tức câu gốc về đỏ. Đã tái hiện bằng script (`mau = 'vang'`). Lặp lại ở 2 ngày thì câu thành **xanh** dù chưa lần nào làm đúng chính nó. Hệ quả: lời nhắc, "Lặp lại", ON_NHANH và đề khắc phục sau đó bỏ sót câu này. | Trong `nbEvents_`, với mỗi bài luyện có `goc`: gom **mọi** sự kiện của khóa gốc trong bài (cả lần làm lại thường lẫn phụ), rồi xếp các sự kiện sai sau sự kiện đúng. Ví dụ đưa lần làm lại câu gốc (`d.goc === key`) vào cùng danh sách `phuDung` / `phuSai` nhưng giữ `phu: 0`. Hoặc trong `nbCompute_`, tính `lwAll` theo nhóm `src`: bài nào có sai cho khóa đó thì mọi lần đúng cùng bài không tính. Thêm test: gốc sai + tương tự đúng cùng bài → đỏ. |
| R-2 | Nhẹ | `Code.gs:3458` (`nbFixStart_` ON_NHANH) | `top` lấy từ `tongHop.saiNgoo`, trong đó có cả câu đã bị gỡ (`go`), trong khi `its` đã bỏ câu `go`. Nếu mọi câu của loại nặng nhất đều đã bị gỡ, `its` rỗng và báo "chưa có câu sai nào cần khắc phục", dù các loại khác vẫn còn câu. | Chọn `top` theo loại còn câu trong `its`, hoặc khi rỗng thì quay về toàn bộ `its`. |
| R-3 | Nhẹ | `Code.gs:3428` (`nbSimilar_`), vòng chia trong `nbFixStart_` | Mỗi lần gọi duyệt toàn bộ pool ứng viên (tới 3 000 câu). Vòng tròn gọi cho mọi câu sai ở mỗi lượt (tới 10 lượt), nên khi có hàng trăm câu sai mà phần lớn không có câu cùng bài, phép tính có thể lên vài triệu bước. Vài giây trên Apps Script; không chạy trong khóa. | Lập chỉ mục ứng viên theo `bai` / `chuong` một lần, hoặc giới hạn số câu sai xét (vd 30 câu nặng nhất). |
| R-4 | Nhẹ | `Code.gs:2621`, `Code.gs:2636` | Nộp đề khắc phục tính sổ tay 2 lần, ngoài khóa; lần sau là tính lại đầy đủ (đọc `KetQua` / `KetQuaLuyenTap` của em, chỉ mục pool, có thể đọc thêm hàng Phần III). Thêm khoảng nửa giây đến một giây cho lần nộp. Chấp nhận được; ghi nhận để theo dõi khi dữ liệu lớn. | Có thể chỉ tính lại màu cho các khóa trong `gocs` từ sự kiện, không dựng lại cả sổ tay. |

Không có phát hiện mức **Nặng**. Không có phát hiện ảnh hưởng bảo mật.

## Kết luận
**CHƯA ĐẠT**, chỉ vì R-1: trạng thái khắc phục của câu gốc tính sai, trái quy tắc đặc tả đã chốt. Sửa ít dòng; đề nghị thêm bài kiểm thử cho trường hợp này rồi soát lại vòng 2. R-2 → R-4 là Nhẹ, không chặn.

---

## Vòng 2

Phạm vi: `git diff 1d6cdd0..HEAD` (commit `3c1f2b6`). Đã soát lại toàn bộ phần 7c, tập trung vào việc đổi thứ tự sự kiện trong bài luyện.

**Tóm tắt:** lỗi màu đã sửa đúng. Làm lại câu cũ vẫn sai thì câu cũ về đỏ, dù câu tương tự làm đúng. Việc đổi thứ tự không ảnh hưởng câu hiển thị, số lần sai, mục "Luyện câu đã sai" hay bài luyện cũ.

**Đã chạy:**
- Đạt: `pha7c` 11/11, `pha7` 16/16, `pha7b` 12/12, `pha7a-kiem-thu` 28/28, `pha7b-kiem-thu` 16/16, `pha4` 22, `pha4-kiem-thu` 33/33, backend, cache, pha6-kiem-thu 105/105. `scan-secrets`: sạch.
- `pha7c-kiem-thu`: 17/17 ở 7 lần chạy. Có **một** lần chạy đầu báo trượt mục TC-7.19, với câu báo lỗi không còn trong file khi em mở ra xem. Có lẽ người kiểm thử đang sửa bài kiểm thử đúng lúc đó. Phần "khacPhuc" của bước này phụ thuộc giờ nộp thật trước khi bài được đổi ngày (chính bài kiểm thử ghi chú điều này), nên đây không phải lỗi code. Đề nghị người kiểm thử chạy lại sau khi commit bài kiểm thử.
- Script tái hiện R-1 của vòng 1 (gốc làm lại sai + tương tự đúng cùng bài): nay `mau = 'do'`, `lanSai = 2` (trước là `vang`).

**Ảnh hưởng của việc đổi thứ tự sự kiện** (`nbEvents_`: trong mỗi bài luyện, mọi lần đúng, kể cả câu khắc phục, xếp trước; lần sai xếp sau):

| Câu hỏi | Kết luận |
|---|---|
| Câu hiển thị (`lw`) | Không đổi. Mỗi khóa xuất hiện tối đa một lần thường trong một bài, nên `lw` vẫn là lần sai thật cuối của khóa. Các sự kiện phụ (`phu`) bị loại khỏi `lw`. |
| Số lần sai, số đề (`lanSai`, `soDe`) | Không đổi. Chỉ đổi thứ tự; vẫn đếm sự kiện sai không phải phụ. |
| Thứ tự giữa các bài / đề thi | Không đổi. Sắp theo `(t, i)`; đề thi được thêm trước; các bài luyện cùng giây giữ thứ tự hàng, chỉ đảo bên trong từng bài. |
| "Luyện câu đã sai" (Pha 4) | Không liên quan: `wrongList_` không dùng `nbEvents_` (chỉ `nbCompute_` gọi hàm này). `pha4` và `pha4-kiem-thu` đạt. |
| Bài luyện cũ (không có `goc`) | Mỗi khóa một sự kiện trong bài, nên đảo thứ tự không đổi kết quả. |
| Bài thi (`KetQua`) | Không đụng tới. |

| Mã | Đã sửa đúng chưa | Ghi chú |
|---|---|---|
| R-1 | **Đúng** | Gốc làm lại sai (sự kiện thường) hoặc câu khắc phục sai, cùng bài với lần đúng: lần sai xếp sau, nên câu gốc đỏ. Có thêm bài kiểm thử "Vòng 2 (R-1)", hai ngày liền vẫn đỏ. |
| R-2 | **Đúng** | ON_NHANH chọn loại nặng nhất **còn câu trong `its`**; không có thì dùng mọi câu. |
| R-3 | **Đúng** | Chia ứng viên theo `bai` / `chuong` một lần. Mỗi câu sai chỉ xét câu cùng bài và cùng chương. Câu có thể nằm ở cả hai nhóm, nhưng `taken` và cùng điểm số nên không sai. |
| R-4 | Giữ (đồng ý) | Chỉ xảy ra ở kiểu khắc phục, chạy ngoài khóa, cần để báo màu trước/sau. |
| K-1 | **Đúng** | Đúng phần +20 hơn cùng mức độ +10. `pha7c-kiem-thu` TC-7.20 đạt. |
| G-1 | **Đúng** | "Ôn phần hổng kiến thức" gồm cả câu chưa phân loại, khớp bản đồ và đặc tả §3 (câu chưa phân loại xếp tạm vào Hổng kiến thức). |
| G-3 | **Đúng** | `khacPhuc` chỉ trả câu có màu trước khác màu sau. Giao diện vẫn lọc thêm `truoc !== sau`. |
| G-2 | Giữ (đồng ý) | Câu gốc của đề chưa công bố chỉ làm "đích" (`goc`) để chọn câu tương tự từ pool đã kiểm chặn, nên không lộ nội dung hay đáp án. |

Không có phát hiện mới mức Nặng hay Vừa. Nhẹ, ghi nhận: `cand.byBai[x.bai]` dùng object thường, nên tên bài trùng thuộc tính có sẵn (như "constructor") sẽ hỏng. Thực tế không gặp; dùng `Object.create(null)` thì hết.

### Kết luận vòng 2
**ĐẠT.** R-1 (Vừa) đã sửa đúng và có bài kiểm thử. Việc đổi thứ tự sự kiện không ảnh hưởng câu hiển thị, số lần sai, "Luyện câu đã sai" hay dữ liệu cũ. Các mục còn lại đã sửa, hoặc được giữ với lý do hợp lý.
