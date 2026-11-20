// Pha 3 (người làm): đọc file Word / Excel / CSV trên Node. File mẫu tự sinh bằng tests/fixtures/make-docx.js.
//   LIBS_DIR=<node_modules có jszip@3.10.1, xlsx@0.18.5, katex@0.16.9> node tests/docx.test.js
const assert = require('assert');
const path = require('path');
const LIBS = process.env.LIBS_DIR;
if (!LIBS) { console.error('Cần LIBS_DIR (thư mục node_modules có jszip, xlsx, katex).'); process.exit(1); }
const JSZip = require(path.join(LIBS, 'jszip'));
const XLSX = require(path.join(LIBS, 'xlsx'));
const katex = require(path.join(LIBS, 'katex'));
const I = require('../assets/js/importer.js');
const R = require('../assets/js/docx-reader.js');
const M = require('./fixtures/make-docx')(LIBS);
const { mr, f, sup, sub, subsup, rad, d, acc, bar, func, nary, pre } = M;

// như common.js rich(): dấu phẩy thập phân trong công thức → {,}
const katexOk = (t) => { katex.renderToString(t.replace(/(\d),(?=\d)/g, '$1{,}'), { throwOnError: true }); return true; };
const validate = (t) => { try { return katexOk(t); } catch (e) { return false; } };
const libs = { JSZip, XLSX, Importer: I, validate };
const readDocx = async (blocks, opt) => R.readFile('de.docx', await M.docx(blocks, opt), libs);

let n = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); n++; console.log('  ✓ ' + name); } catch (e) { failed++; console.log('  ✗ ' + name + '\n    ' + (e.stack || e).toString().split('\n').slice(0, 4).join('\n    ')); }
}
const strip = (q) => { const o = Object.assign({}, q); delete o.hinhAnh; return o; };

(async () => {
  await test('TC-3.1 docx 28 câu (18–4–6) giống hệt khi dán cùng văn bản', async () => {
    const text = M.sampleText28();
    const pasted = I.fromText(text);
    const r = await readDocx(M.lines(text), { header: 'Tiêu đề đầu trang (không được lẫn vào câu)' });
    assert.strictEqual(r.questions.length, 28);
    assert.deepStrictEqual(r.stats.cau, { 1: 18, 2: 4, 3: 6 });
    assert.deepStrictEqual(r.questions.map(strip), pasted.questions.map(strip));
    assert.deepStrictEqual(r.questions.map((q) => q.loai).join(''), 'TN'.repeat(18) + 'DS'.repeat(4) + 'TL'.repeat(6));
    assert.strictEqual(r.questions[0].dapAn, 'B');
    assert.strictEqual(r.questions[18].dapAn, 'SĐSĐ');
    assert.strictEqual(r.questions[19].dapAn, 'ĐSĐS');
    assert.strictEqual(r.questions[22].dapAn, '1,5');
    assert.strictEqual(r.questions[27].dapAn, '6,5');
    assert.ok(!JSON.stringify(r.questions).includes('Tiêu đề đầu trang'));
    assert.ok(!JSON.stringify(r.questions).includes('của em'));
    assert.ok(!JSON.stringify(r.questions).includes('HẾT'));
    assert.deepStrictEqual(r.warnings, []);
  });

  await test('Mẫu "Form VLSN": khung đầu đề bảng 2 ô, PHẦN 1/2/3, phương án cách tab, "Đáp án của em", HẾT', async () => {
    const blocks = [
      M.tbl([[['TRUNG TÂM MẪU', 'Mã đề: 001'], ['ĐỀ KIỂM TRA MẪU', 'Thời gian: 50 phút']]]),
      M.p('Họ và tên: ……………… SBD: ……'),
      M.p('PHẦN 1. TRẮC NGHIỆM NHIỀU LỰA CHỌN (Thí sinh trả lời từ câu 1 đến câu 2)'),
      M.p('Câu 1: Đơn vị của áp suất là'),
      M.p('A. Pa.\tB. N.\tC. J.\tD. W.'),
      M.p(['Câu 2: Công thức ', M.math(mr('p') + mr('=', 1) + f(mr('F'), mr('S'))), ' gọi là']),
      M.p('A. định nghĩa áp suất.\tB. định luật I.'),
      M.p('C. định luật II.\tD. định luật III.'),
      M.p('PHẦN 2. TRẮC NGHIỆM ĐÚNG SAI (Thí sinh trả lời từ câu 1 đến câu 1)'),
      M.p('Câu 1: Cho một khối khí.'),
      M.p('a. Ý a.'), M.p('b. Ý b.'), M.p('c. Ý c.'), M.p('d. Ý d.'),
      M.p('PHẦN 3. TRẮC NGHIỆM TRẢ LỜI NGẮN (Thí sinh trả lời từ câu 1 đến câu 1)'),
      M.p('Câu 1: Tính áp suất (Pa).'),
      M.p('Đáp án của em:…………………'),
      M.p('---------- HẾT ----------'),
      M.p('(Thí sinh không được sử dụng tài liệu)')
    ];
    const r = await readDocx(blocks);
    assert.deepStrictEqual(r.questions.map((q) => q.loai + q.phan), ['TN1', 'TN1', 'DS2', 'TL3']);
    assert.strictEqual(r.stats.headerTables, 1);
    assert.deepStrictEqual([r.questions[0].A, r.questions[0].D], ['Pa.', 'W.']);
    assert.strictEqual(r.questions[1].noiDung, 'Công thức $p = \\frac{F}{S}$ gọi là');
    assert.deepStrictEqual([r.questions[1].B, r.questions[1].C], ['định luật I.', 'định luật II.']);
    assert.strictEqual(r.questions[2].D, 'Ý d.');
    assert.strictEqual(r.questions[3].noiDung, 'Tính áp suất (Pa).');
    assert.strictEqual(r.questions[3].dapAn, '');
    assert.ok(!JSON.stringify(r.questions).match(/Mã đề|Thí sinh không|Họ và tên/));
    assert.strictEqual(r.warnings.length, 1); // gộp "chưa có đáp án" thành 1 dòng
    assert.ok(/Chưa có đáp án ở 4 câu \(câu 1–4\)/.test(r.warnings[0]), r.warnings[0]);
  });

  await test('Đề có lời giải: [NB]/[H], "Lời giải: Chọn B.", Đúng/Sai từng ý, "Đáp số: $0,5$ Hz", Phần IV bỏ qua', async () => {
    const text = ['PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn.',
      'Câu 1. [B] Hỏi một?', 'A. x', 'B. y', 'C. z', 'D. t', 'Lời giải: Chọn B.', 'Vì y đúng.',
      'Câu 2. [H]. Hỏi hai?', 'A. x\tB. y\tC. z\tD. t', 'Lời giải: Chọn D.',
      'PHẦN II. Câu trắc nghiệm đúng sai.',
      'Câu 3. Dẫn.', 'a) [NB] Ý một.', 'b) [TH]. Ý hai.', 'c) Ý ba.', 'd) Ý bốn.', 'Lời giải:', 'a) Sai – vì…', 'b) Đúng – vì…', 'c) Đúng – vì…', 'd) Sai – vì…',
      'PHẦN III. Câu trắc nghiệm trả lời ngắn',
      'Câu 4. [VDC] Tính f.', 'Lời giải:', 'f = 1/T.', 'Đáp số: $0,5$ Hz',
      'PHẦN IV. TỰ LUẬN', 'Câu 5. Trình bày…'].join('\n');
    const r = await readDocx(M.lines(text));
    assert.deepStrictEqual(r.questions.map((q) => [q.loai, q.dapAn, q.mucDo]), [['TN', 'B', 'NB'], ['TN', 'D', 'TH'], ['DS', 'SĐĐS', ''], ['TL', '0,5', 'VDC']]);
    assert.strictEqual(r.questions[0].noiDung, 'Hỏi một?');
    assert.strictEqual(r.questions[2].A, 'Ý một.');
    assert.strictEqual(r.questions[2].B, 'Ý hai.');
    assert.ok(/Đáp số/.test(r.questions[3].loiGiai));
    assert.ok(r.warnings.some((w) => /Bỏ qua Phần IV.*1 câu/.test(w)), r.warnings.join('|'));
    assert.ok(r.warnings.some((w) => /^Câu 4 .*đã lấy số 0,5/.test(w)), r.warnings.join('|'));
  });

  await test('Sau "HẾT": bảng đáp án dạng bảng Word + lời giải "Câu n" gắn vào câu đã có', async () => {
    const blocks = M.lines('PHẦN I\nCâu 1. Một?\nA. a\tB. b\tC. c\tD. d\nCâu 2. Hai?\nA. a\tB. b\tC. c\tD. d\nPHẦN III\nCâu 1. Ba?\n---------- HẾT ----------\nĐÁP ÁN\nPHẦN I')
      .concat([M.tbl([['Câu', '1', '2'], ['Đáp án', 'C', 'A']]), M.p('PHẦN III'), M.tbl([['Câu', '1'], ['Đáp án', '-2,5']])])
      .concat(M.lines('HƯỚNG DẪN GIẢI\nPHẦN I\nCâu 1. Vì c.\nCâu 2. Vì a.'));
    const r = await readDocx(blocks);
    assert.strictEqual(r.questions.length, 3);
    assert.deepStrictEqual(r.questions.map((q) => q.dapAn), ['C', 'A', '-2,5']);
    assert.deepStrictEqual(r.questions.map((q) => q.loiGiai), ['Vì c.', 'Vì a.', '']);
  });

  // ---------- TC-3.2: 20+ công thức mẫu ----------
  const F = [
    [sub(mr('T'), mr('1')) + mr('=', 1) + mr('300') + mr(' ') + mr('K', 'nor'), 'T_{1} = 300\\ \\text{K}'],
    [sup(mr('10'), mr('−', 1) + mr('5')), '10^{-5}'],
    [mr('p') + mr('=', 1) + sup(mr('1,013.10'), mr('5')) + mr(' ') + mr('Pa', 'nor'), 'p = {1,013.10}^{5}\\ \\text{Pa}'],
    [f(f(mr('a'), mr('b')), mr('c')), '\\frac{\\frac{a}{b}}{c}'],
    [rad(mr('2gh')), '\\sqrt{2gh}'],
    [rad(mr('x'), mr('3')), '\\sqrt[3]{x}'],
    [sup(d(mr('a') + mr('+', 1) + mr('b')), mr('2')), '\\left( a + b \\right)^{2}'],
    [d(mr('x'), '[', ']'), '\\left[ x \\right]'],
    [d(mr('x'), '|', '|'), '\\left| x \\right|'],
    [mr('ΔU') + mr('=', 1) + mr('A') + mr('+', 1) + mr('Q'), '\\Delta U = A + Q'],
    [mr('ω') + mr('=', 1) + mr('2πf'), '\\omega = 2\\pi f'],
    [mr('λ') + mr('=', 1) + f(mr('v'), mr('f')), '\\lambda = \\frac{v}{f}'],
    [sub(mr('φ'), mr('0')) + mr('=', 1) + mr('−', 1) + f(mr('π'), mr('2')), '\\varphi_{0} = -\\frac{\\pi}{2}'],
    [mr('g') + mr('=', 1) + mr('9') + mr(',', 1) + mr('8') + mr(' ') + sup(mr('m/s', 'nor'), mr('2')), 'g = 9,8\\ \\text{m/s}^{2}'],
    [acc(mr('F'), '\u20d7'), '\\vec{F}'],
    [acc(mr('AB'), '\u20d7'), '\\overrightarrow{AB}'],
    [mr('t') + mr('=', 1) + mr('25') + mr(' ') + mr('°C', 'nor'), 't = 25^\\circ\\text{C}'],
    [mr('x') + mr('=', 1) + mr('A') + func('cos', d(mr('ωt') + mr('+', 1) + mr('φ'))), 'x = A\\cos \\left( \\omega t + \\varphi \\right)'],
    [mr('F') + mr('≈', 1) + mr('2') + mr('×', 1) + sup(mr('10'), mr('3')) + mr(' ') + mr('N', 'nor'), 'F \\approx 2 \\times 10^{3}\\ \\text{N}'],
    [nary('∫', mr('0'), mr('T'), mr('P') + mr('d', 1) + mr('t')), '\\int_{0}^{T} P\\text{d}t'],
    [nary('∑', mr('i=1'), mr('n'), sub(mr('F'), mr('i'))), '\\sum_{i = 1}^{n} F_{i}'],
    [pre(mr('2'), mr('4'), mr('He', 'nor')), '{}_{2}^{4}\\text{He}'],
    [bar(mr('v')), '\\overline{v}'],
    [subsup(mr('v'), mr('0'), mr('2')), 'v_{0}^{2}'],
    [mr('a') + mr('≤', 1) + mr('b') + mr('≠', 1) + mr('c') + mr('→', 1) + mr('0'), 'a \\le b \\neq c \\rightarrow 0'],
    [mr('sin', 1) + mr('α') + mr('=', 1) + mr('0') + mr(',', 1) + mr('5'), '\\sin\\alpha = 0,5'],
    [sub(mr('W'), mr('đ')) + mr('=', 1) + mr('3') + mr('·', 1) + mr('2'), 'W_{\\text{đ}} = 3 \\cdot 2'],
    [mr('c') + mr('=', 1) + mr('4200') + mr(' ') + mr('J/(kg.K)', 'nor'), 'c = 4200\\ \\text{J/(kg.K)}'],
    [d(mr('x'), '{', '') , '\\left\\{ x \\right.'],
    [mr('R') + mr('=', 1) + mr('8') + mr(' ') + mr('Ω', 1), 'R = 8\\ \\Omega']
  ];
  await test('TC-3.2 OMML → LaTeX: ' + F.length + ' công thức đúng từng chuỗi, KaTeX hiển thị (throwOnError)', async () => {
    F.forEach(([xml, want], i) => {
      const node = R._find(R.parseXml('<m:oMath>' + xml + '</m:oMath>'), 'm:oMath');
      const r = R.omml2latex(node);
      assert.ok(r.ok, 'công thức ' + (i + 1) + ': ' + r.reason);
      assert.strictEqual(r.latex, want, 'công thức ' + (i + 1));
      katexOk(r.latex);
    });
  });
  await test('TC-3.2 công thức trong file .docx → $…$ trong câu, đếm đúng', async () => {
    const r = await readDocx([M.p('PHẦN III'), M.p(['Câu 1. Khí ở ', M.math(F[0][0]), ' và ', M.math(F[16][0]), '.']), M.p('Đáp số: 2')]);
    assert.strictEqual(r.questions[0].noiDung, 'Khí ở $T_{1} = 300\\ \\text{K}$ và $t = 25^\\circ\\text{C}$.');
    assert.deepStrictEqual([r.stats.math, r.stats.mathOk, r.stats.mathFail], [2, 2, 0]);
  });

  await test('TC-3.3 ma trận (chưa hỗ trợ) và MathType OLE → cảnh báo đúng số câu, không lỗi, câu khác vẫn nhận', async () => {
    const r = await readDocx([
      M.p('PHẦN I'),
      M.p('Câu 1. Bình thường?'), M.p('A. 1\tB. 2\tC. 3\tD. 4'),
      M.p(['Câu 2. Ma trận ', M.math(mr('M') + mr('=', 1) + M.matrix()), ' là gì?']), M.p('A. 1\tB. 2\tC. 3\tD. 4'),
      M.p(['Câu 3. Công thức MathType ', M.ole(), ' đây.']), M.p('A. 1\tB. 2\tC. 3\tD. 4'),
      M.p('Câu 4. Bình thường nữa?'), M.p('A. 1\tB. 2\tC. 3\tD. 4')
    ]);
    assert.strictEqual(r.questions.length, 4);
    assert.ok(/⟦công thức chưa đổi được: M=1001⟧/.test(r.questions[1].noiDung), r.questions[1].noiDung);
    assert.ok(/⟦công thức MathType chưa đổi được⟧/.test(r.questions[2].noiDung));
    assert.ok(r.warnings.some((w) => /^Câu 2: 1 công thức cần gõ lại/.test(w)), r.warnings.join('|'));
    assert.ok(r.warnings.some((w) => /^Câu 3: 1 công thức MathType.*Convert Equations/.test(w)), r.warnings.join('|'));
    assert.ok(!r.warnings.some((w) => /^Câu (1|4):/.test(w)));
    assert.deepStrictEqual([r.stats.mathFail, r.stats.ole], [1, 1]);
  });

  await test('TC-3.4 đánh số tự động của Word cho "Câu" và "A./B./C./D.", "a)…d)" nhận như gõ tay', async () => {
    const numbering = M.numbering([[{ fmt: 'decimal', text: '%1.' }], [{ fmt: 'upperLetter', text: '%1.' }], [{ fmt: 'lowerLetter', text: '%1)' }], [{ fmt: 'decimal', text: 'Câu %1:' }]],
      [{ id: 1, abs: 0 }, { id: 2, abs: 1 }, { id: 3, abs: 1, start: 1 }, { id: 4, abs: 2 }, { id: 5, abs: 3, start: 1 }, { id: 6, abs: 1, start: 1 }]);
    const blocks = [
      M.p('PHẦN I'),
      M.p('Hỏi một?', { numId: 1 }), M.p('x', { numId: 2 }), M.p('y', { numId: 2 }), M.p('z', { numId: 2 }), M.p('t', { numId: 2 }), M.p('Đáp án: C'),
      M.p('Hỏi hai?', { numId: 1 }), M.p('x2', { numId: 3 }), M.p('y2', { numId: 3 }), M.p('z2', { numId: 3 }), M.p('t2', { numId: 3 }), M.p('Đáp án: A'),
      M.p('PHẦN II'),
      M.p('Dẫn ba.', { numId: 5 }), M.p('ý một (Đ)', { numId: 4 }), M.p('ý hai (S)', { numId: 4 }), M.p('ý ba (S)', { numId: 4 }), M.p('ý bốn (Đ)', { numId: 4 })
    ];
    const r = await readDocx(blocks, { numbering });
    const typed = I.fromText('PHẦN I\nCâu 1. Hỏi một?\nA. x\nB. y\nC. z\nD. t\nĐáp án: C\nCâu 2. Hỏi hai?\nA. x2\nB. y2\nC. z2\nD. t2\nĐáp án: A\nPHẦN II\nCâu 1: Dẫn ba.\na) ý một (Đ)\nb) ý hai (S)\nc) ý ba (S)\nd) ý bốn (Đ)');
    assert.deepStrictEqual(r.questions.map(strip), typed.questions.map(strip));
    assert.strictEqual(r.questions[1].D, 't2');
    assert.strictEqual(r.questions[2].dapAn, 'ĐSSĐ');
    assert.strictEqual(r.stats.numbered, 15);
  });

  const png = (c) => M.png(40, 30, c);
  await test('TC-3.5 3 hình ở câu 2, 5, 5 → câu 2 có hinhAnh, câu 5 có hinhAnh + 1 ![](…) trong nội dung', async () => {
    const media = { rId1: { name: 'image1.png', data: png([200, 0, 0]) }, rId2: { name: 'image2.png', data: png([0, 200, 0]) }, rId3: { name: 'image3.png', data: png([0, 0, 200]) } };
    const blocks = [M.p('PHẦN I')];
    for (let i = 1; i <= 6; i++) {
      blocks.push(M.p('Câu ' + i + '. Hỏi ' + i + '?'));
      if (i === 2) blocks.push(M.p([M.img('rId1')]));
      if (i === 5) { blocks.push(M.p([M.img('rId2')])); blocks.push(M.p(['Xem thêm hình ', M.img('rId3'), ' bên.'])); }
      blocks.push(M.p('A. 1\tB. 2\tC. 3\tD. 4'));
    }
    const r = await readDocx(blocks, { media });
    assert.strictEqual(r.images.length, 3);
    assert.deepStrictEqual(r.images.map((im) => im.name), ['image1.png', 'image2.png', 'image3.png']);
    assert.ok(r.images.every((im) => im.data && im.data.length > 50 && im.mime === 'image/png'));
    const urls = {};
    r.images.forEach((im) => { urls[im.n] = 'https://lh3.googleusercontent.com/d/HINH' + im.n; });
    const qs = r.questions;
    const failedImgs = R.attachImages(qs, urls);
    assert.deepStrictEqual(failedImgs, []);
    assert.strictEqual(qs[1].hinhAnh, urls[1]);
    assert.strictEqual(qs[1].noiDung, 'Hỏi 2?');
    assert.strictEqual(qs[4].hinhAnh, urls[2]);
    assert.strictEqual(qs[4].noiDung, 'Hỏi 5?\nXem thêm hình ![](' + urls[3] + ') bên.');
    assert.ok(qs.filter((q, i) => i !== 1 && i !== 4).every((q) => !q.hinhAnh && !/HINH|!\[/.test(q.noiDung)));
  });

  await test('TC-3.6 bảng Word 2×5 → khối [BẢNG]; bảng phương án → dòng A–D', async () => {
    const blocks = [M.p('PHẦN I'), M.p('Câu 1. Cho bảng:'),
      M.tbl([['Chất', 'c (J/kg.K)'], ['Nhôm', '880'], ['Đồng', '380'], ['Chì', '130'], ['Nước | đá', '2100']]),
      M.p('Chất nào nóng nhanh nhất?'),
      M.tbl([['A. Nhôm.', 'B. Đồng.'], ['C. Chì.', 'D. Nước đá.']])];
    const r = await readDocx(blocks);
    const q = r.questions[0];
    assert.strictEqual(q.noiDung, 'Cho bảng:\n[BẢNG] Chất | c (J/kg.K)\nNhôm | 880\nĐồng | 380\nChì | 130\nNước / đá | 2100\nChất nào nóng nhanh nhất?');
    assert.deepStrictEqual([q.A, q.B, q.C, q.D], ['Nhôm.', 'Đồng.', 'Chì.', 'Nước đá.']);
  });

  await test('TC-3.7 hình nổi (wp:anchor) và VML được nhận; EMF/WMF/hình vẽ Word → cảnh báo đúng câu, không đưa vào danh sách tải lên', async () => {
    const media = { rIdA: { name: 'image1.png', data: png() }, rIdV: { name: 'image2.png', data: png([10, 10, 10]) }, rIdE: { name: 'image3.emf', data: Buffer.from('EMF giả') }, rIdW: { name: 'image4.wmf', data: Buffer.from('WMF giả') } };
    const r = await readDocx([M.p('PHẦN I'),
      M.p(['Câu 1. Hình nổi ', M.img('rIdA', { anchor: true })]), M.p('A. 1\tB. 2\tC. 3\tD. 4'),
      M.p(['Câu 2. Hình VML ', M.vml('rIdV')]), M.p('A. 1\tB. 2\tC. 3\tD. 4'),
      M.p(['Câu 3. Hình EMF ', M.img('rIdE')]), M.p('A. 1\tB. 2\tC. 3\tD. 4'),
      M.p(['Câu 4. Hình WMF ', M.vml('rIdW'), ' và hình vẽ ', M.shape()]), M.p('A. 1\tB. 2\tC. 3\tD. 4')
    ], { media });
    assert.strictEqual(r.questions.length, 4);
    assert.deepStrictEqual(r.images.map((im) => im.name), ['image1.png', 'image2.png']);
    assert.ok(r.images[0].anchor && r.images[1].vml);
    assert.ok(r.warnings.some((w) => /^Câu 3: hình cần chụp lại hoặc lưu lại dạng PNG \(hình dạng WMF\/EMF/.test(w)), r.warnings.join('|'));
    assert.ok(r.warnings.some((w) => /^Câu 4: 2 hình cần chụp lại hoặc lưu lại dạng PNG/.test(w)), r.warnings.join('|'));
    assert.ok(!r.warnings.some((w) => /^Câu (1|2):/.test(w)));
    assert.strictEqual(r.questions[2].noiDung, 'Hình EMF');
    assert.strictEqual(r.questions[2].hinhLoi, 1);
  });

  // ---------- TC-3.8: .xlsx / .csv ----------
  const rowsNoHead = [['TN', 'Đơn vị lực?', 'N', 'J', 'W', 'Pa', 'A', 'Lực', 'NB'], ['DS', 'Mệnh đề', 'a', 'b', 'c', 'd', 'ĐSĐS'], ['TL', 'Tính g', '', '', '', '', '9,8']];
  const head = ['Loại', 'Nội dung', 'A', 'B', 'C', 'D', 'Đáp án', 'Chủ đề', 'Mức độ'];
  const tsvOf = (rows) => rows.map((r) => r.map((c) => (/[\t\n"]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c)).join('\t')).join('\n');
  const csvOf = (rows, sep) => '\uFEFF' + rows.map((r) => r.map((c) => (/[,;\n"]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c)).join(sep)).join('\r\n');
  const xlsxOf = (rows) => { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Câu hỏi'); return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }); };
  await test('TC-3.8 .xlsx có và không có hàng tiêu đề → giống dán TSV', async () => {
    for (const rows of [rowsNoHead, [head].concat(rowsNoHead), [head].concat([['TN', 'Dòng 1\nDòng 2', '1', '2', '3', '4', 'B', 'Cơ', 'TH']])]) {
      const r = await R.readFile('de.xlsx', xlsxOf(rows), libs);
      assert.deepStrictEqual(r.questions, I.fromTsv(tsvOf(rows)).questions);
    }
    const r = await R.readFile('de.xlsx', xlsxOf(rowsNoHead), libs);
    assert.deepStrictEqual(r.questions.map((q) => [q.loai, q.dapAn]), [['TN', 'A'], ['DS', 'ĐSĐS'], ['TL', '9,8']]);
  });
  await test('TC-3.8 .csv (UTF-8 có BOM, dấu , hoặc ;, ô có xuống dòng) → giống dán TSV', async () => {
    const rows = [head].concat(rowsNoHead, [['TN', 'Có dấu, phẩy\nvà "ngoặc"', '1,5', '2', '3', '4', 'C', '', '']]);
    for (const sep of [',', ';']) {
      const r = await R.readFile('de.csv', Buffer.from(csvOf(rows, sep), 'utf8'), libs);
      assert.deepStrictEqual(r.questions, I.fromTsv(tsvOf(rows)).questions, 'dấu ' + sep);
    }
    const r2 = await R.readFile('de.csv', Buffer.from(csvOf(rowsNoHead, ','), 'utf8'), libs);
    assert.deepStrictEqual(r2.questions, I.fromTsv(tsvOf(rowsNoHead)).questions);
  });

  await test('TC-3.9 file 40 câu × 10 công thức + 5 hình: đọc + đổi xong < 5 s', async () => {
    const media = {};
    for (let k = 1; k <= 5; k++) media['rIdP' + k] = { name: 'image' + k + '.png', data: M.png(600, 400, [k * 40, 100, 50]) };
    const blocks = [M.p('PHẦN 1. TRẮC NGHIỆM NHIỀU LỰA CHỌN')];
    for (let i = 1; i <= 40; i++) {
      const parts = ['Câu ' + i + '. Cho '];
      for (let k = 0; k < 6; k++) parts.push(M.math(F[(i + k) % F.length][0]), ', ');
      blocks.push(M.p(parts));
      if (i % 8 === 0) blocks.push(M.p([M.img('rIdP' + (i / 8))]));
      blocks.push(M.p(['A. ', M.math(F[i % F.length][0]), '\tB. ', M.math(F[(i + 1) % F.length][0])]));
      blocks.push(M.p(['C. ', M.math(F[(i + 2) % F.length][0]), '\tD. ', M.math(F[(i + 3) % F.length][0])]));
    }
    const buf = await M.docx(blocks, { media });
    const t0 = Date.now();
    const r = await R.readFile('de.docx', buf, libs);
    const ms = Date.now() - t0;
    assert.strictEqual(r.questions.length, 40);
    assert.strictEqual(r.stats.math, 400);
    assert.strictEqual(r.stats.mathOk, 400);
    assert.strictEqual(r.images.length, 5);
    assert.ok(ms < 5000, ms + ' ms');
    console.log('    (TC-3.9: ' + ms + ' ms trên Node, file ' + Math.round(buf.length / 1024) + ' KB)');
  });

  await test('TC-3.10 file > 10 MB, không phải docx/xlsx, .doc, docx hỏng → thông báo tiếng Việt', async () => {
    const rej = async (name, data, re) => { await assert.rejects(R.readFile(name, data, libs), (e) => { assert.ok(re.test(e.message), e.message); return true; }); };
    await rej('to.docx', Buffer.alloc(10 * 1024 * 1024 + 1), /lớn hơn 10 MB/);
    await rej('anh.png', M.png(2, 2), /Chỉ nhận file Word \(\.docx\), Excel \(\.xlsx\), \.csv hoặc văn bản \.txt/);
    await rej('de.pdf', Buffer.from('%PDF-1.4'), /PDF/);
    await rej('de.doc', Buffer.from([0xd0, 0xcf, 0x11, 0xe0]), /Word 97–2003/);
    await rej('hong.docx', Buffer.from('PK\u0003\u0004 không phải zip thật'), /bị hỏng/);
    await rej('gia.docx', Buffer.from('chỉ là chữ'), /bị hỏng hoặc không phải file Word/);
    await rej('gia.docx', Buffer.from([0xd0, 0xcf, 0x11, 0xe0]), /Word 97–2003/);
    const z = new JSZip(); z.file('a.txt', 'x');
    await rej('thieu.docx', await z.generateAsync({ type: 'nodebuffer' }), /thiếu word\/document\.xml/);
    await rej('hong.xlsx', Buffer.from('không phải excel'), /Excel bị hỏng/);
    assert.throws(() => R.kindOf('a.docx', 11 * 1024 * 1024), /lớn hơn 10 MB \(11,0 MB\)/);
  });

  await test('Không có thư viện JSZip / SheetJS → "Không tải được thư viện đọc file, hãy dán văn bản."', async () => {
    await assert.rejects(R.readFile('de.docx', await M.docx(M.lines('Câu 1. x')), { Importer: I }), /Không tải được thư viện đọc file, hãy dán văn bản/);
    await assert.rejects(R.readFile('de.xlsx', xlsxOf(rowsNoHead), { Importer: I }), /Không tải được thư viện đọc file/);
  });

  await test('Công thức KaTeX không hiển thị được → mốc ⟦…⟧ (không đưa LaTeX hỏng vào đề)', async () => {
    const node = R._find(R.parseXml('<m:oMath>' + mr('x') + '</m:oMath>'), 'm:oMath');
    assert.deepStrictEqual(R.omml2latex(node, { validate: () => false }).ok, false);
    const r = await readDocx([M.p('PHẦN III'), M.p(['Câu 1. ', M.math(mr('x'))])], {});
    assert.strictEqual(r.questions[0].noiDung, '$x$');
  });

  await test('Tiền tố XML lạ (file do công cụ khác tạo) vẫn đọc được', async () => {
    const z = new JSZip();
    z.file('word/document.xml', '<?xml version="1.0"?><ns0:document xmlns:ns0="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:ns1="http://schemas.openxmlformats.org/officeDocument/2006/math"><ns0:body>' +
      '<ns0:p><ns0:r><ns0:t>PHẦN III</ns0:t></ns0:r></ns0:p><ns0:p><ns0:r><ns0:t xml:space="preserve">Câu 1. Tính </ns0:t></ns0:r><ns1:oMath><ns1:r><ns1:t>x</ns1:t></ns1:r></ns1:oMath></ns0:p>' +
      '<ns0:p><ns0:r><ns0:t>Đáp số: 3 &amp; 4</ns0:t></ns0:r></ns0:p></ns0:body></ns0:document>');
    const r = await R.readFile('x.docx', await z.generateAsync({ type: 'nodebuffer' }), libs);
    assert.strictEqual(r.questions[0].noiDung, 'Tính $x$');
  });

  // ---------- Vòng 2 (soát code / kiểm thử) ----------
  await test('R-1 "Chọn câu đúng." / "Chọn cách…" là câu dẫn (giữ trong nội dung); "Chọn B." mới là đáp án', async () => {
    const r = I.fromText('PHẦN I\nCâu 1. Cho các phát biểu sau:\nChọn câu đúng.\nA. x\nB. y\nC. z\nD. t\nCâu 2. Hỏi?\nChọn cách làm đúng:\nA. x\tB. y\tC. z\tD. t\nCâu 3. Hỏi?\nA. x\tB. y\tC. z\tD. t\nChọn B.\nCâu 4. Hỏi?\nA. x\tB. y\tC. z\tD. t\nChọn: D. Lời giải: vì t');
    assert.deepStrictEqual(r.questions.map((q) => q.dapAn), ['', '', 'B', 'D']);
    assert.strictEqual(r.questions[0].noiDung, 'Cho các phát biểu sau:\nChọn câu đúng.');
    assert.strictEqual(r.questions[1].noiDung, 'Hỏi?\nChọn cách làm đúng:');
    assert.strictEqual(r.questions[3].loiGiai, 'vì t');
  });
  await test('R-2 lời giải sau HẾT đánh số lại, không có PHẦN → ghép theo thứ tự; đáp án lệch loại câu → bỏ + cảnh báo', async () => {
    const de = 'PHẦN 1\nCâu 1. a?\nA. 1\tB. 2\tC. 3\tD. 4\nCâu 2. b?\nA. 1\tB. 2\tC. 3\tD. 4\nPHẦN 3\nCâu 1. Tính x?\n---------- HẾT ----------\nHƯỚNG DẪN GIẢI\n';
    const r = I.fromText(de + 'Câu 1.\nĐáp án: B\nVì 1\nCâu 2.\nĐáp án: C\nCâu 1.\nĐáp số: 2,5\nVì 3');
    assert.deepStrictEqual(r.questions.map((q) => [q.phan, q.dapAn, q.loiGiai]), [[1, 'B', 'Đáp án: B\nVì 1'], [1, 'C', 'Đáp án: C'], [3, '2,5', 'Đáp số: 2,5\nVì 3']]);
    const r2 = I.fromText(de + 'PHẦN 3\nCâu 1.\nĐáp án: B');
    assert.strictEqual(r2.questions[2].dapAn, '');
    assert.ok(r2.warnings.some((w) => /^Câu 3 .*"B" không khớp loại câu/.test(w)), r2.warnings.join('|'));
  });
  await test('R-3 XML hỏng (thuộc tính chứa "<", chú thích không đóng): đọc tuyến tính, file hỏng < 1 s', async () => {
    let t0 = Date.now();
    R.parseXml('<a' + ' x="<"'.repeat(50000));
    R.parseXml('<!--'.repeat(50000));
    R.parseXml('<![CDATA['.repeat(50000) + '<a x="1">');
    assert.ok(Date.now() - t0 < 1000, (Date.now() - t0) + ' ms');
    const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
    const z = new JSZip(); z.file('word/document.xml', `<w:document ${W}><w:body><w:p><w:r><w:t>PHẦN III</w:t></w:r></w:p><w:p><w:r><w:t>Câu 1. x</w:t></w:r></w:p>` + '<a' + ' x="<"'.repeat(30000) + '</w:body></w:document>');
    const buf = await z.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    t0 = Date.now();
    await R.readFile('hong.docx', buf, libs);
    assert.ok(Date.now() - t0 < 1000, 'docx hỏng: ' + (Date.now() - t0) + ' ms');
  });
  await test('R-4 bom nén (giải nén quá lớn) và lồng quá sâu → thông báo tiếng Việt', async () => {
    const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
    const z = new JSZip(); z.file('word/document.xml', `<w:document ${W}><w:body><w:p><w:r><w:t>` + 'a'.repeat(70e6) + '</w:t></w:r></w:p></w:body></w:document>');
    const bomb = await z.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });
    assert.ok(bomb.length < 10 * 1024 * 1024);
    await assert.rejects(R.readFile('bom.docx', bomb, libs), /khi giải nén quá lớn/);
    const z2 = new JSZip(); z2.file('word/document.xml', `<w:document ${W}>` + '<x>'.repeat(200000) + '<w:body></w:body></w:document>');
    await assert.rejects(R.readFile('sau.docx', await z2.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }), libs), /File bất thường \(cấu trúc lồng quá sâu/);
  });
  await test('R-5 đáp án Phần III không phải số → cảnh báo có số câu', async () => {
    const r = I.fromText('PHẦN III\nCâu 1. Tính q.\nĐáp số: $1,6.10^{-19}$ C\nCâu 2. Tính g.\nĐáp số: 9,8');
    assert.ok(r.warnings.some((w) => /^Câu 1 .*không phải số/.test(w)), r.warnings.join('|'));
    assert.ok(!r.warnings.some((w) => /^Câu 2/.test(w)));
  });
  await test('R-8 "$" trong công thức không phá $…$; hai dấu trừ liền nhau tách ra', async () => {
    const conv = (xml) => R.omml2latex(R._find(R.parseXml('<m:oMath>' + xml + '</m:oMath>'), 'm:oMath')).latex;
    const a = conv(mr('x') + mr('=', 1) + mr('5$'));
    assert.ok(a.indexOf('$') < 0, a); katexOk(a);
    const b = conv(mr('x') + mr('−', 1) + mr('−', 1) + mr('y'));
    assert.strictEqual(b, 'x - -y'); katexOk(b);
    const c = conv(mr('a$b', 'nor'));
    assert.ok(c.indexOf('$') < 0, c); katexOk(c);
  });
  await test('K-1 .txt đọc như "Dán văn bản"; .csv sai mẫu cột → cảnh báo câu không có nội dung', async () => {
    const t = await R.readFile('de.txt', Buffer.from('Câu 1. Một câu hỏi\nCâu 2. Câu khác'), libs);
    assert.deepStrictEqual(t.questions.map((q) => q.noiDung), ['Một câu hỏi', 'Câu khác']);
    const c = await R.readFile('mot-cot.csv', Buffer.from('Câu 1. Một câu hỏi\nCâu 2. Câu khác'), libs);
    assert.ok(c.warnings.length === 2 && /^Câu 1: không có nội dung — kiểm tra thứ tự cột/.test(c.warnings[0]), c.warnings.join('|'));
  });
  await test('N-1 thống kê "công thức trong câu hỏi" không tính công thức ở đầu đề', async () => {
    const r = await readDocx([M.p(['Cho biết: ', M.math(mr('g') + mr('=', 1) + mr('10'))]), M.p('PHẦN III'), M.p(['Câu 1. Tính ', M.math(mr('x'))]), M.p('Đáp số: 1')]);
    assert.deepStrictEqual([r.stats.mathOk, r.stats.mathOkInQ], [2, 1]);
  });

  // Pha 6: sửa nốt N-2, N-3 của soát Pha 3
  // khai sai kích thước giải nén của word/document.xml (mục lục cuối file + đầu từng file)
  const lieSize = (buf, name, size) => {
    const b = Buffer.from(buf), nm = Buffer.from(name);
    for (let i = 0; i < b.length - 4; i++) {
      const sig = b.readUInt32LE(i);
      if (sig === 0x04034b50 && b.slice(i + 30, i + 30 + nm.length).equals(nm)) b.writeUInt32LE(size, i + 22);
      if (sig === 0x02014b50 && b.slice(i + 46, i + 46 + nm.length).equals(nm)) b.writeUInt32LE(size, i + 24);
    }
    return b;
  };
  await test('N-2 file .docx khai sai kích thước giải nén → thông báo tiếng Việt, dừng sớm, không giải nén hết', async () => {
    const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
    // (a) khai 1 000 B nhưng thật ~80 MB: dừng khi vượt giới hạn, không báo lỗi tiếng Anh
    const z = new JSZip(); z.file('word/document.xml', `<w:document ${W}><w:body><w:p><w:r><w:t>` + 'a'.repeat(80e6) + '</w:t></w:r></w:p></w:body></w:document>');
    const big = lieSize(await z.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } }), 'word/document.xml', 1000);
    const t0 = Date.now();
    const e1 = await R.readFile('noi-doi.docx', big, libs).then(() => null, (e) => e);
    assert.ok(e1, 'phải báo lỗi');
    assert.ok(/^File Word bất thường: khi giải nén quá lớn/.test(e1.message), e1.message);
    assert.ok(!/Bug|mismatch/i.test(e1.message), e1.message);
    assert.ok(Date.now() - t0 < 3000, (Date.now() - t0) + ' ms');
    // (b) khai 1 000 B, thật nhỏ hơn giới hạn nhưng lệch: "File Word bị hỏng…" thay cho "Bug : uncompressed data size mismatch"
    const z2 = new JSZip(); z2.file('word/document.xml', `<w:document ${W}><w:body><w:p><w:r><w:t>PHẦN I</w:t></w:r></w:p><w:p><w:r><w:t>Câu 1. ` + 'x'.repeat(5000) + '</w:t></w:r></w:p></w:body></w:document>');
    const small = lieSize(await z2.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }), 'word/document.xml', 1000);
    const e2 = await R.readFile('lech.docx', small, libs).then(() => null, (e) => e);
    assert.ok(e2 && /^File Word bị hỏng/.test(e2.message) && !/Bug|mismatch/i.test(e2.message), e2 && e2.message);
    // file đúng vẫn đọc được (có hình: dữ liệu hình đọc qua cùng đường giới hạn)
    const ok = await readDocx([M.p('PHẦN I'), M.p('Câu 1. Một câu?'), M.p('A. 1'), M.p('B. 2'), M.p('C. 3'), M.p('D. 4')]);
    assert.strictEqual(ok.questions.length, 1);
  });
  await test('N-3 sau "HẾT": "Câu 1. Lời giải: Chọn B." lấy được đáp án B, bỏ nhãn "Lời giải:"', async () => {
    const de = 'PHẦN 1\nCâu 1. a?\nA. 1\nB. 2\nC. 3\nD. 4\nCâu 2. b?\nA. 1\nB. 2\nC. 3\nD. 4\nPHẦN 3\nCâu 1. Tính x?\n---------- HẾT ----------\n';
    const r = I.fromText(de + 'Câu 1. Lời giải: Chọn B.\nCâu 2. Đáp án: D\nVì 2\nCâu 1. Đáp số: 2,5');
    assert.deepStrictEqual(r.questions.map((q) => [q.phan, q.dapAn, q.loiGiai]), [[1, 'B', 'Chọn B.'], [1, 'D', 'Đáp án: D\nVì 2'], [3, '2,5', 'Đáp số: 2,5']]);
    assert.ok(!r.warnings.some((w) => /chưa tìm thấy đáp án/.test(w)), r.warnings.join('|'));
    // dòng riêng như trước vẫn đúng
    const r2 = I.fromText('PHẦN 1\nCâu 1. a?\nA. 1\nB. 2\nC. 3\nD. 4\n---------- HẾT ----------\nCâu 1.\nLời giải: Chọn C.');
    assert.strictEqual(r2.questions[0].dapAn, 'C');
  });

  await test('TC-3.13 importer cũ: dán văn bản / TSV không đổi kết quả (xem tests/importer.test.js)', async () => {
    require('./importer.test.js');
  });

  console.log(failed ? `docx.test: ${failed} KHÔNG ĐẠT / ${n + failed}` : `docx.test: ${n}/${n} đạt`);
  process.exit(failed ? 1 : 0);
})();
