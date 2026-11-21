# Pha 6b — Kiểm thử độc lập: hình đặt nổi / cùng dòng ở đầu đoạn Word

Người kiểm thử (vai 3), nhánh `pha-6b-hinh-noi`, bản `0b3c33e`. Kịch bản viết theo yêu cầu trước khi đọc diff `importer.js` và test của người làm.

## Tóm tắt cho giáo viên

1. Đề Word của thầy nay đọc đủ **28 câu (18 · 4 · 6)**. Câu 6, 13, 16 Phần I và câu 3 Phần II có hình, mỗi hình gắn đúng một câu. Câu 3 Phần II đủ 4 ý. Bản cũ chỉ đọc được 25 câu và gắn được 1 hình.
2. Hình đặt ở đầu dòng "Câu n", "A.", "a." / "a)" hay "PHẦN …" không còn làm mất câu, phương án hay ý.
3. 4 đề Word ở Pha 3 và văn bản dán vào cho kết quả **y hệt bản cũ**. Không phát hiện lỗi.

## Cách chạy

```
LIBS_DIR=<libs/node_modules> DE_THAY=<de.docx> WORD_THAT=<thư mục 4 file Pha 3> node tests/pha6b-hinh-kiem-thu.test.js
NODE_PATH=$(npm root -g) LIBS_DIR=<libs/node_modules> node tests/pha6b-hinh-kiem-thu.e2e.js
```

So với `origin/main` bằng cách nạp `importer.js` của main (`git show origin/main:assets/js/importer.js`, hoặc chỉ định bằng `MAIN_IMPORTER`). Repo không chứa file thật, báo cáo chỉ ghi số liệu.

## Bảng ca · kết quả

| Ca | Nội dung | Kết quả |
|---|---|---|
| K1 (×4) | Hình anchor/inline ở đầu "Câu 2:" và "Câu 2." (Phần I) | ĐẠT: 8 câu (4-2-2), hình ở câu 2, đủ A–D. Bản main chỉ ra 7 câu (mất câu 2). |
| K1b | Hình anchor ở đầu "Câu 1:" (ngay sau PHẦN I) và hình inline ở đầu "Câu 4:" | ĐẠT |
| K1c | Hình ở đầu "Câu 1:" Phần II (số câu lặp lại giữa các phần) | ĐẠT: hình gắn câu Đúng/Sai 1, không gắn câu 1 Phần I |
| K1d | Hình inline ở đầu "Câu 2:" Phần III | ĐẠT |
| K1e | Đánh số liên tục, hình anchor ở đầu "Câu 6:" Phần II | ĐẠT |
| K2 (×6) | Hình anchor/inline ở đầu dòng "A. …⇥B. …", "A." riêng dòng, "C. …" | ĐẠT: hình vào câu đó, phương án đúng chữ |
| K3 (×4) | Hình anchor/inline ở đầu ý "a." và "a)" | ĐẠT: còn ý a, đủ 4 ý, hình ở câu Đúng/Sai đó. Bản main mất ý a. |
| K3b | Hình inline ở đầu ý "c." | ĐẠT |
| K4 (×2) | Hình anchor/inline ở đầu "PHẦN II" | ĐẠT: đủ 3 phần, hình gắn câu đầu Phần II |
| K4b | Hình anchor ở đầu "PHẦN I" | ĐẠT: hình gắn câu 1 |
| K5 / K5b | Hai hình ở đầu "Câu 3:"; hai hình anchor ở đầu ý "a." | ĐẠT: cả hai hình ở đúng câu |
| K5c (×3) | Hình ở giữa đoạn, cuối đoạn (anchor), cuối đoạn (inline) | ĐẠT: kết quả y hệt main |
| K5d | Đoạn chỉ có hình, sau "Câu 2:" và sau ý "b." | ĐẠT: kết quả y hệt main |
| K6 | Dán văn bản không có mốc hình (8 mẫu) và TSV | ĐẠT: `fromText`/`fromTsv` y hệt main |
| K6b | docx không có hình (đề 28 câu, đề nhỏ) | ĐẠT: y hệt main |
| K7 | **File thật của giáo viên** | ĐẠT: 28 câu (18-4-6), mọi câu Phần I đủ 4 phương án, mọi câu Phần II đủ 4 ý. Hình có ở P1 câu 6, 13, 16 và P2 câu 3. `a:blip` toàn file = 5; trong phần câu hỏi = 4; số hình gắn = 4, mỗi hình đúng 1 câu. Bản main: 25 câu (15-4-6), gắn 1 hình. |
| K8 (×4) | 4 file Word Pha 3 | ĐẠT: 28 / 44 / 22 / 28 câu; câu hỏi và cảnh báo y hệt main |
| E2E [mới] và [1.0.0] | Trình soạn → Nhập nhanh → Tải file lên. Hình neo ở đầu "Câu 2:", hình inline ở đầu ý "a." | ĐẠT 16/16: bảng "Tìm thấy 6 câu", "Phần I: 4 · Phần II: 1 · Phần III: 1", "Sẽ tải lên: 2". `adminUploadImage` = 0 trước khi bấm, = 2 sau khi bấm. Câu 2 có `hinhAnh`, câu Đúng/Sai có hình và đủ 4 ý, câu khác không có hình, trang không lỗi. |
| Hồi quy | `docx.test.js` 30/30, `importer.test.js` (mã thoát 0), `pha3-kiem-thu.test.js` 17/17 nhóm | ĐẠT |

Bộ test Node: **35/35 ĐẠT**.

## Lỗi K-x

Không có.

Ghi chú (không phải lỗi, cũng không phải hồi quy):

- Ở K7, `a:blip` thứ 5 là hình nằm trong bảng khung đầu đề, trước câu đầu tiên (logo). Pha 3 bỏ khung này theo thiết kế, nên test chỉ đếm hình từ chữ "Câu" đầu tiên.
- Hình ở đầu một dòng trong bảng đáp án ("BẢNG ĐÁP ÁN") không gắn câu nào. Bản main cũng vậy.
- Hình ở đầu dòng "PHẦN IV" bị bỏ cùng Phần IV. Bản mới còn nhận đúng dòng "PHẦN IV" này; bản main đọc nhầm câu Phần IV thành câu Phần I.

## Kết luận

**ĐẠT.** Bản sửa đáp ứng yêu cầu trên file thật và trên các fixture tự sinh, đề cũ đọc như trước. Người kiểm thử không sửa code tính năng và không commit. File thêm vào: `tests/pha6b-hinh-kiem-thu.test.js`, `tests/pha6b-hinh-kiem-thu.e2e.js` và báo cáo này.
