// node tests/importer.test.js
const assert = require('assert');
const I = require('../assets/js/importer.js');

const text = `ĐỀ KIỂM TRA VẬT LÝ 12
PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn.
Câu 1. Đơn vị của cảm ứng từ là
A. tesla.	B. vêbe.	C. henry.	D. vôn.
Câu 2: Công thức tính nhiệt lượng
là gì?
A. $Q = mc\\Delta t$
*B. $Q = mL$
C. $Q = m\\lambda$
D. $Q = Pt$
Lời giải: Nhiệt hóa hơi
dòng 2 của lời giải
PHẦN II. Câu trắc nghiệm đúng sai.
Câu 1. Cho khí lí tưởng
a) Ý một (Đ)
b) Ý hai (S)
c) Ý ba
kéo dài sang dòng sau (Đ)
d) Ý bốn (S)
PHẦN III. Câu trắc nghiệm trả lời ngắn.
Câu 1. Tính g?
Đáp số: 9,8
Câu 2. Tính v (m/s)?
BẢNG ĐÁP ÁN
PHẦN I
1.A 2.C
PHẦN III
2. 12,5
`;
const r = I.fromText(text);
assert.strictEqual(r.questions.length, 5, JSON.stringify(r, null, 1));
const [q1, q2, q3, q4, q5] = r.questions;
assert.deepStrictEqual([q1.loai, q1.A, q1.D, q1.dapAn], ['TN', 'tesla.', 'vôn.', 'A']);
assert.strictEqual(q2.noiDung, 'Công thức tính nhiệt lượng\nlà gì?');
assert.strictEqual(q2.dapAn, 'B'); // dấu * thắng bảng đáp án
assert.strictEqual(q2.loiGiai, 'Nhiệt hóa hơi\ndòng 2 của lời giải');
assert.deepStrictEqual([q3.loai, q3.dapAn, q3.C, q3.phan], ['DS', 'ĐSĐS', 'Ý ba kéo dài sang dòng sau', 2]);
assert.deepStrictEqual([q4.loai, q4.dapAn], ['TL', '9,8']);
assert.deepStrictEqual([q5.loai, q5.dapAn], ['TL', '12,5']);
assert.strictEqual(r.warnings.length, 0, r.warnings.join('\n'));

const tsv = 'Loại\tNội dung\tA\tB\tC\tD\tĐáp án\tChủ đề\n' +
  'TN\t"Dòng 1\nDòng 2"\t1\t2\t3\t4\tB\tCơ học\n' +
  'Đúng/Sai\tMệnh đề\ta\tb\tc\td\tĐSĐS\tNhiệt\n' +
  '\tTính g\t\t\t\t\t9,8\t\n';
const t = I.fromTsv(tsv);
assert.strictEqual(t.questions.length, 3);
assert.strictEqual(t.questions[0].noiDung, 'Dòng 1\nDòng 2');
assert.deepStrictEqual(t.questions.map(q => q.loai), ['TN', 'DS', 'TL']);
assert.strictEqual(t.questions[1].chuDe, 'Nhiệt');
console.log('  ✓ importer: văn bản Word và bảng Excel');
