// Kiểm thử độc lập Pha 3 (người kiểm thử) — viết theo docs/spec/pha-3-tai-de.md, file mẫu tự sinh (tests/fixtures/pha3-kt-make.js).
//   LIBS_DIR=<node_modules có jszip, xlsx, katex> node tests/pha3-kiem-thu.test.js
// API dùng: DocxReader.read / toQuestions / attachImages / readFile (theo chú thích đầu docx-reader.js), Importer.fromText / fromTsv.
// Bao phủ (Node): TC-3.1, 3.2, 3.3, 3.4, 3.5 (phần đọc), 3.6, 3.7, 3.8, 3.9, 3.10, 3.13. Phần giao diện ở tests/pha3-kiem-thu.e2e.js.
const path = require('path');
const assert = require('assert');
const { spawnSync } = require('child_process');

const LIBS = process.env.LIBS_DIR;
if (!LIBS) { console.error('Cần LIBS_DIR (node_modules có jszip, xlsx, katex)'); process.exit(2); }
const M = require('./fixtures/pha3-kt-make')(LIBS);
const katex = require(path.join(LIBS, 'katex'));
const D = require('../assets/js/docx-reader.js');
const I = require('../assets/js/importer.js');
const LIB = { JSZip: M.JSZip, XLSX: M.XLSX, Importer: I };

const R = {};
function verdict(tc, pass, evidence) {
  const e = R[tc] || { pass: true, ev: [] };
  e.pass = e.pass && !!pass; e.ev.push((pass ? 'OK   ' : 'FAIL ') + evidence); R[tc] = e;
  console.log(`  ${pass ? '✓' : '✗'} ${tc}: ${evidence}`);
}
const { t, p, pText, O, math } = M;
const read = (buf) => D.read(buf, { JSZip: M.JSZip });
const allWarn = (r, q) => [...(r.warnings || []), ...((q && q.warnings) || [])].join(' | ');
const qByPart = (qs) => [1, 2, 3].map((k) => qs.filter((q) => +q.phan === k).length).join('-');
const strip = (q) => { const o = Object.assign({}, q); return o; };
const katexOk = (tex) => { try { katex.renderToString(tex, { throwOnError: true }); return null; } catch (e) { return e.message; } };
const mathml = (tex) => katex.renderToString(tex, { throwOnError: true, output: 'mathml' }).replace(/<annotation[\s\S]*?<\/annotation>/, '');
const formulasIn = (s) => (String(s).match(/\$[^$]+\$/g) || []).map((x) => x.slice(1, -1));
const tab = () => '<w:r><w:tab/></w:r>';

async function tc31() {
  const lines = M.exam28Lines();
  const buf = await M.docx({ body: lines.map(pText).join('') });
  const r = await read(buf);
  const fromDoc = I.fromText(r.text);
  const fromPaste = I.fromText(lines.join('\n'));
  const qs = fromDoc.questions;
  const types = { 1: 'TN', 2: 'DS', 3: 'TL' };
  const okTypes = qs.every((q) => q.loai === types[q.phan]);
  const keys = qs.map((q) => q.dapAn).join(',');
  let same = true;
  try { assert.deepStrictEqual(fromDoc.questions.map(strip), fromPaste.questions.map(strip)); } catch (e) { same = false; }
  verdict('TC-3.1', qs.length === 28 && qByPart(qs) === '18-4-6' && okTypes && same && qs.every((q) => q.dapAn),
    `.docx 28 câu → ${qs.length} câu, theo phần ${qByPart(qs)}, đúng loại TN/DS/TL: ${okTypes}, mọi câu có đáp án; giống hệt kết quả dán văn bản (deepStrictEqual): ${same}; đáp án ${keys.slice(0, 60)}…`);
  const tq = D.toQuestions(r, I);
  let same2 = true;
  try { assert.deepStrictEqual(tq.questions, fromPaste.questions); } catch (e) { same2 = false; }
  verdict('TC-3.1', same2 && tq.warnings.length === 0, `toQuestions (đường giao diện dùng) cũng giống dán văn bản: ${same2}; cảnh báo: ${tq.warnings.length ? tq.warnings.join('; ') : 'không có'}`);

  // Mẫu VLSN (QUYẾT-ĐỊNH §6): khung đầu đề (bảng) trước PHẦN, tiêu đề "PHẦN 1. TRẮC NGHIỆM…", phương án cách tab, "Đáp án của em", "HẾT"
  const body = [M.table([['SỞ GIÁO DỤC (tự soạn)', 'ĐỀ KIỂM TRA'], ['TRƯỜNG MẪU', 'Môn: Vật lí 12']]),
    pText('Họ và tên: ……………… Số báo danh: ………'),
    pText('PHẦN 1. TRẮC NGHIỆM NHIỀU LỰA CHỌN'),
    p(M.tb('Câu 1. '), t('Đơn vị của nhiệt lượng là')),
    p(tab(), t('A. J.'), tab(), t('B. W.'), tab(), t('C. N.'), tab(), t('D. Pa.')),
    p(M.tb('Câu 2. '), t('Nhiệt độ sôi của nước ở áp suất chuẩn là')),
    p(tab(), t('A. 0 °C.'), tab(), t('B. 100 °C.')), p(tab(), t('C. 50 °C.'), tab(), t('D. 273 °C.')),
    pText('PHẦN 2. TRẮC NGHIỆM ĐÚNG SAI'),
    p(M.tb('Câu 1. '), t('Xét khí lí tưởng.')), pText('a) Ý một.'), pText('b) Ý hai.'), pText('c) Ý ba.'), pText('d) Ý bốn.'),
    pText('PHẦN 3. TRẮC NGHIỆM TRẢ LỜI NGẮN'),
    p(M.tb('Câu 1. '), t('Tính số mol khí.')), pText('Đáp án của em: …………'),
    pText('---------- HẾT ----------'), pText('Giám thị không giải thích gì thêm.')].join('');
  const rv = await read(await M.docx({ body }));
  const qv = D.toQuestions(rv, I).questions;
  const q1 = qv[0] || {};
  const leak = qv.some((q) => /HẾT|Giám thị|Đáp án của em|Họ và tên|SỞ GIÁO DỤC/.test(JSON.stringify(q)));
  verdict('TC-3.1 (mẫu VLSN)', qv.length === 4 && qByPart(qv) === '2-1-1' && q1.A === 'J.' && q1.D === 'Pa.' && (qv[1] || {}).C === '50 °C.' && !leak,
    `mẫu VLSN → ${qv.length} câu (${qByPart(qv)}); câu 1 A="${q1.A}" D="${q1.D}"; câu 2 C="${(qv[1] || {}).C}"; khung đầu đề/Họ tên/Đáp án của em/HẾT không lẫn vào câu: ${!leak}`);
}

async function tc32() {
  const lines = M.FORMULAS.map((f, i) => p(t(`Câu ${i + 1}. Công thức: `), math(f.omml)));
  const r = await read(await M.docx({ body: pText('PHẦN III') + lines.join('') }));
  const got = r.text.split('\n').filter((l) => /^Câu \d+\./.test(l)).map((l) => formulasIn(l)[0] || '');
  let exact = 0, equiv = 0; const bad = [];
  M.FORMULAS.forEach((f, i) => {
    const g = got[i] || '';
    const err = katexOk(g);
    const ex = g === f.tex;
    let eq = false;
    if (!err) { try { eq = mathml(g) === mathml(f.tex); } catch (e) { eq = false; } }
    if (ex) exact++;
    if (ex || eq) equiv++;
    if (err || !(ex || eq)) bad.push(`#${i + 1} ${f.id}: được "${g}" | kỳ vọng "${f.tex}"${err ? ' | KaTeX lỗi: ' + err.slice(0, 60) : ''}`);
    else if (!ex) console.log(`      (#${i + 1} ${f.id}: khác chuỗi nhưng KaTeX vẽ giống hệt: "${g}" ~ "${f.tex}")`);
  });
  const kErr = got.filter((g) => katexOk(g)).length;
  verdict('TC-3.2', bad.length === 0 && kErr === 0,
    `20 công thức OMML: đúng nguyên chuỗi ${exact}/20; đúng về hiển thị (MathML KaTeX trùng khớp) ${equiv}/20; KaTeX throwOnError lỗi ${kErr}/20` + (bad.length ? ' — SAI: ' + bad.join(' ; ') : ''));
  const st = r.stats || {};
  verdict('TC-3.2', !/⟦/.test(r.text) && (st.mathFail || 0) === 0, `không có mốc ⟦…⟧, thống kê math=${st.math} đổi được=${st.mathOk} chưa đổi=${st.mathFail}`);
  return got;
}

async function tc33() {
  const body = [pText('PHẦN I'),
    ...[1, 2, 3, 4, 5, 6].flatMap((i) => {
      const stem = i === 4 ? p(t('Câu 4. Cho ma trận '), math(O.matrix([['1', '2'], ['3', '4']])), t(' và lực '), math(O.r('F=ma')), t('. Chọn đáp án đúng.'))
        : i === 6 ? p(t('Câu 6. Biểu thức '), M.ole('rIdOle1'), t(' cho biết'))
          : pText(`Câu ${i}. Câu hỏi thường số ${i}.`);
      return [stem, pText('A. một'), pText('B. hai'), pText('C. ba'), pText('D. bốn'), pText('Đáp án: C')];
    })].join('');
  let r, q, err = null;
  try {
    r = await read(await M.docx({ body, media: [{ rid: 'rIdOle1', file: 'image1.wmf', data: M.fakeWmf() }], oles: [{ rid: 'rIdOle1' }] }));
    q = D.toQuestions(r, I);
  } catch (e) { err = e; }
  if (err) return verdict('TC-3.3', false, 'văng lỗi: ' + err.message);
  const w = allWarn(r, q);
  const qs = q.questions;
  const q4 = qs.find((x) => x.num === 4) || qs[3] || {};
  const w4 = /Câu 4\b[^|]*công thức/i.test(w);
  const w6 = /Câu 6\b[^|]*(MathType|OLE)/i.test(w) && /Convert Equations/i.test(w);
  verdict('TC-3.3', qs.length === 6 && qs.every((x) => x.dapAn === 'C') && w4 && w6 && /⟦/.test(q4.noiDung) && /F = ma|F=ma/.test(q4.noiDung),
    `không văng lỗi; ${qs.length}/6 câu nhận đủ đáp án; câu 4 có mốc ⟦…⟧ và công thức khác vẫn đổi ("${(q4.noiDung || '').slice(0, 90)}"); cảnh báo câu 4 (ma trận): ${w4}; câu 6 (OLE, gợi ý Convert Equations): ${w6}. Cảnh báo: ${w.slice(0, 300)}`);
  const wrong = /Câu [1235]\b[^|]*(công thức|MathType)/.test(w);
  verdict('TC-3.3', !wrong, `không có cảnh báo công thức gán nhầm cho câu 1, 2, 3, 5: ${!wrong}`);
}

async function tc34() {
  // Đánh số tự động: "Câu %1." (decimal), "%1." (upperLetter) cho phương án, "%1)" (lowerLetter) cho ý Đúng/Sai
  const abs = [{ id: 0, fmt: 'decimal', lvlText: 'Câu %1.' }, { id: 1, fmt: 'upperLetter', lvlText: '%1.' }, { id: 2, fmt: 'lowerLetter', lvlText: '%1)' }, { id: 3, fmt: 'decimal', lvlText: '%1.' }];
  const nums = [{ numId: 1, abs: 0 }, { numId: 2, abs: 0, restart: true }, { numId: 3, abs: 0, restart: true }];
  const body = []; const hand = [];
  let nid = 10;
  const opt = (texts, a) => { const id = nid++; nums.push({ numId: id, abs: a, restart: true }); return texts.map((x) => M.pNum(id, t(x))); };
  body.push(pText('PHẦN I')); hand.push('PHẦN I');
  for (let i = 1; i <= 3; i++) {
    body.push(M.pNum(1, t(`Vật nhỏ thứ ${i} rơi tự do, gia tốc bằng bao nhiêu?`)), ...opt(['9,8 m/s².', '10 m/s².', '0.', '1 m/s².'], 1), pText('Đáp án: A'));
    hand.push(`Câu ${i}. Vật nhỏ thứ ${i} rơi tự do, gia tốc bằng bao nhiêu?`, 'A. 9,8 m/s².', 'B. 10 m/s².', 'C. 0.', 'D. 1 m/s².', 'Đáp án: A');
  }
  body.push(pText('PHẦN II')); hand.push('PHẦN II');
  for (let i = 1; i <= 2; i++) {
    body.push(M.pNum(2, t(`Khí lí tưởng mẫu ${i}.`)), ...opt(['Ý thứ nhất.', 'Ý thứ hai.', 'Ý thứ ba.', 'Ý thứ tư.'], 2), pText('Đáp án: ĐSSĐ'));
    hand.push(`Câu ${i}. Khí lí tưởng mẫu ${i}.`, 'a) Ý thứ nhất.', 'b) Ý thứ hai.', 'c) Ý thứ ba.', 'd) Ý thứ tư.', 'Đáp án: ĐSSĐ');
  }
  body.push(pText('PHẦN III')); hand.push('PHẦN III');
  body.push(M.pNum(3, t('Tính áp suất khí.')), pText('Đáp án: 1,5')); hand.push('Câu 1. Tính áp suất khí.', 'Đáp án: 1,5');
  const r = await read(await M.docx({ body: body.join(''), numbering: M.numberingXml(abs, nums) }));
  const a = D.toQuestions(r, I).questions; const b = I.fromText(hand.join('\n')).questions;
  let same = true; try { assert.deepStrictEqual(a, b); } catch (e) { same = false; }
  verdict('TC-3.4', same && a.length === 6, `"Câu %1." + "A." + "a)" tự động → ${a.length} câu (${qByPart(a)}), giống gõ tay: ${same}` + (same ? '' : `; văn bản đọc được: ${JSON.stringify(r.text.slice(0, 300))}`));
  // Biến thể: lvlText "%1." (decimal) cho câu
  const nums2 = nums.map((n) => (n.abs === 0 ? Object.assign({}, n, { abs: 3 }) : n));
  const r2 = await read(await M.docx({ body: body.join(''), numbering: M.numberingXml(abs, nums2) }));
  const a2 = D.toQuestions(r2, I).questions;
  let same2 = true; try { assert.deepStrictEqual(a2, b); } catch (e) { same2 = false; }
  verdict('TC-3.4', same2, `biến thể "%1." (decimal) cho câu → ${a2.length} câu, giống gõ tay: ${same2}`);
  // Không dựng được (kiểu lạ) → cảnh báo
  const abs3 = abs.map((x) => (x.id === 1 ? Object.assign({}, x, { fmt: 'ordinalText' }) : x));
  const r3 = await read(await M.docx({ body: body.join(''), numbering: M.numberingXml(abs3, nums) }));
  const w3 = allWarn(r3, D.toQuestions(r3, I));
  verdict('TC-3.4', /đánh số|tự động/i.test(w3), `kiểu đánh số lạ (ordinalText) → cảnh báo: "${w3.slice(0, 160)}"`);
}

async function imgDoc() {
  const media = [1, 2, 3].map((k) => ({ rid: 'rIdP' + k, file: `image${k}.png`, data: M.png(40 + k, 30, [k * 60, 100, 200]) }));
  const body = [pText('PHẦN I'), ...[1, 2, 3, 4, 5, 6].flatMap((i) => {
    const s = i === 2 ? [p(t('Câu 2. Quan sát hình bên.')), p(M.drawingInline('rIdP1'))]
      : i === 5 ? [p(t('Câu 5. Hai hình: '), M.drawingInline('rIdP2'), t(' và ')), p(M.drawingInline('rIdP3'), t(' chọn đáp án.'))]
        : [pText(`Câu ${i}. Câu không có hình ${i}.`)];
    return [...s, pText('A. a1'), pText('B. b1'), pText('C. c1'), pText('D. d1'), pText('Đáp án: B')];
  })].join('');
  return M.docx({ body, media });
}

async function tc35() {
  const r = await read(await imgDoc());
  const q = D.toQuestions(r, I);
  const qs = q.questions;
  const marks = (s) => (String(s).match(/\{\{HINH:\d+\}\}/g) || []).length;
  verdict('TC-3.5 (đọc)', r.images.length === 3 && marks(qs[1].noiDung) === 1 && marks(qs[4].noiDung) === 2 && qs.filter((x) => marks(JSON.stringify(x))).length === 2,
    `${r.images.length} hình đọc được; câu 2 có ${marks(qs[1].noiDung)} mốc, câu 5 có ${marks(qs[4].noiDung)} mốc, câu khác 0`);
  const urls = {}; r.images.forEach((im, i) => { urls[im.n] = 'https://lh3.googleusercontent.com/d/KT' + (i + 1); });
  const qs2 = JSON.parse(JSON.stringify(qs));
  D.attachImages(qs2, urls);
  const q2 = qs2[1], q5 = qs2[4];
  const md5 = (q5.noiDung.match(/!\[\]\([^)]+\)/g) || []);
  verdict('TC-3.5 (đọc)', !!q2.hinhAnh && !/!\[\]/.test(q2.noiDung) && !!q5.hinhAnh && md5.length === 1 && md5[0].indexOf(q5.hinhAnh) < 0 && !/\{\{HINH/.test(JSON.stringify(qs2)),
    `gắn URL: câu 2 hinhAnh=${q2.hinhAnh}; câu 5 hinhAnh=${q5.hinhAnh} + ${md5.length} "![](…)" trong nội dung (${md5.join(' ')}); không còn mốc {{HINH}}`);
}

async function tc36() {
  const body = [pText('PHẦN I'),
    pText('Câu 1. Bảng sau cho vận tốc theo thời gian.'),
    M.table([['t (s)', '0', '2', '4', '6'], ['v (m/s)', '0', '5', '10', '15']]),
    pText('Gia tốc của vật là'), pText('A. 2,5 m/s²'), pText('B. 5 m/s²'), pText('C. 1 m/s²'), pText('D. 10 m/s²'), pText('Đáp án: A'),
    pText('Câu 2. Bảng nhiệt dung riêng (số liệu tự soạn).'),
    M.table([['Chất', 'c (J/kg.K)'], ['Nhôm', '880'], ['Sắt', '460'], ['Đồng', '380'], ['Chì', '130']]),
    pText('Chất có nhiệt dung riêng lớn nhất là'), pText('A. Nhôm'), pText('B. Sắt'), pText('C. Đồng'), pText('D. Chì'), pText('Đáp án: A')].join('');
  const r = await read(await M.docx({ body }));
  const qs = D.toQuestions(r, I).questions;
  const exp1 = '[BẢNG] t (s) | 0 | 2 | 4 | 6\nv (m/s) | 0 | 5 | 10 | 15';
  const exp2 = '[BẢNG] Chất | c (J/kg.K)\nNhôm | 880\nSắt | 460\nĐồng | 380\nChì | 130';
  const n = (s) => String(s || '').replace(/[ \t]+/g, ' ');
  verdict('TC-3.6', qs.length === 2 && n(qs[0].noiDung).includes(n(exp1)) && n(qs[1].noiDung).includes(n(exp2)) && qs[0].dapAn === 'A',
    `bảng 2 hàng × 5 cột và 5 hàng × 2 cột → khối [BẢNG] trong nội dung câu 1, 2: ${JSON.stringify(qs.map((q) => q.noiDung))}`.slice(0, 400));
}

async function tc37() {
  const media = [{ rid: 'rIdA', file: 'image1.png', data: M.png(30, 20, [200, 10, 10]) }, { rid: 'rIdV', file: 'image2.png', data: M.png(32, 20, [10, 200, 10]) },
    { rid: 'rIdE', file: 'image3.emf', data: M.fakeEmf() }, { rid: 'rIdW', file: 'image4.wmf', data: M.fakeWmf() }];
  const body = [pText('PHẦN I'), ...[1, 2, 3, 4, 5, 6].flatMap((i) => {
    const s = i === 1 ? p(t('Câu 1. Hình nổi: '), M.drawingAnchor('rIdA'))
      : i === 3 ? p(t('Câu 3. Hình VML: '), M.vml('rIdV'))
        : i === 4 ? p(t('Câu 4. Hình EMF: '), M.drawingInline('rIdE'))
          : i === 6 ? p(t('Câu 6. Hình WMF: '), M.vml('rIdW')) : pText(`Câu ${i}. Không hình.`);
    return [s, pText('A. a'), pText('B. b'), pText('C. c'), pText('D. d'), pText('Đáp án: D')];
  })].join('');
  let r, q, err;
  try { r = await read(await M.docx({ body, media })); q = D.toQuestions(r, I); } catch (e) { err = e; }
  if (err) return verdict('TC-3.7', false, 'văng lỗi: ' + err.message);
  const qs = q.questions; const w = allWarn(r, q);
  const marks = (s) => (String(s).match(/\{\{HINH:\d+\}\}/g) || []);
  const ok1 = marks(qs[0].noiDung).length === 1, ok3 = marks(qs[2].noiDung).length === 1;
  const uploadable = (q.images || r.images).filter((im) => !/emf|wmf/i.test(im.ext || im.path || '') && im.data && marks(JSON.stringify(qs)).includes('{{HINH:' + im.n + '}}'));
  const w4 = /Câu 4\b[^|]*(chụp lại|PNG)/i.test(w), w6 = /Câu 6\b[^|]*(chụp lại|PNG)/i.test(w);
  const badMarks = marks(qs[3].noiDung).length + marks(qs[5].noiDung).length;
  verdict('TC-3.7', ok1 && ok3 && w4 && w6 && qs.length === 6 && badMarks === 0,
    `hình nổi (câu 1): ${ok1}; VML (câu 3): ${ok3}; EMF câu 4 cảnh báo: ${w4}; WMF câu 6 cảnh báo: ${w6}; mốc hình còn ở câu 4/6: ${badMarks}; ${qs.length}/6 câu. Cảnh báo: ${w.slice(0, 260)}`);
  verdict('TC-3.7', uploadable.length === 2, `hình sẽ tải lên (không tính emf/wmf): ${uploadable.map((x) => x.name || x.path).join(', ')} (phần gọi adminUploadImage kiểm ở e2e)`);
}

async function tc38() {
  const H = M.SHEET_HEADER, rows = M.SHEET_ROWS;
  const ref = I.fromTsv(M.tsv(rows)).questions;
  const refH = I.fromTsv(M.tsv([H, ...rows])).questions;
  const cases = [
    ['xlsx có tiêu đề', 'a.xlsx', M.xlsx([H, ...rows]), refH],
    ['xlsx không tiêu đề', 'b.xlsx', M.xlsx(rows), ref],
    ['csv "," có tiêu đề', 'c.csv', M.csv([H, ...rows]), refH],
    ['csv "," không tiêu đề', 'd.csv', M.csv(rows), ref],
    ['csv ";" có tiêu đề', 'e.csv', M.csv([H, ...rows], ';'), refH]
  ];
  for (const [name, fn, buf, exp] of cases) {
    let got, err;
    try { got = await D.readFile(fn, buf, LIB); } catch (e) { err = e; }
    if (err) { verdict('TC-3.8', false, `${name}: lỗi ${err.message}`); continue; }
    let same = true; try { assert.deepStrictEqual(got.questions, exp); } catch (e) { same = false; }
    verdict('TC-3.8', same && exp.length === 4, `${name} → ${got.questions.length} câu, giống dán TSV (${exp.length} câu): ${same}` + (same ? '' : ' ' + JSON.stringify(got.questions[0]).slice(0, 200)));
  }
  verdict('TC-3.8', ref.length === 4 && refH.length === 4 && ref[2].dapAn === '2,5' && refH[3].diem === '0,5', `đối chứng dán TSV: ${ref.length}/${refH.length} câu; ô Sai số, Điểm đúng cột`);
}

async function bigDoc() {
  const media = [1, 2, 3, 4, 5].map((k) => ({ rid: 'rIdB' + k, file: `image${k}.png`, data: M.png(300, 200, [k * 40, 50, 90]) }));
  const body = [pText('PHẦN I')];
  for (let i = 1; i <= 40; i++) {
    const runs = [t(`Câu ${i}. Tính toán: `)];
    for (let k = 0; k < 10; k++) runs.push(math(M.FORMULAS[(i + k) % 20].omml), t('; '));
    if (i % 8 === 0) runs.push(M.drawingInline('rIdB' + i / 8));
    body.push(p(...runs), pText('A. 1'), pText('B. 2'), pText('C. 3'), pText('D. 4'), pText('Đáp án: A'));
  }
  return M.docx({ body: body.join(''), media });
}

async function tc39() {
  const buf = await bigDoc();
  const times = [];
  let q;
  for (let k = 0; k < 3; k++) {
    const t0 = process.hrtime.bigint();
    const r = await read(buf); q = D.toQuestions(r, I);
    times.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  const nf = q.questions.reduce((s, x) => s + formulasIn(x.noiDung).length, 0);
  const bad = q.questions.flatMap((x) => formulasIn(x.noiDung)).filter((f) => katexOk(f)).length;
  verdict('TC-3.9', Math.max(...times) < 5000 && q.questions.length === 40 && nf === 400 && bad === 0,
    `40 câu × 10 công thức + 5 hình (${(buf.length / 1024).toFixed(0)} KB): đọc + đổi ${times.map((x) => x.toFixed(0)).join(' / ')} ms (Node, 3 lần); ${q.questions.length} câu, ${nf} công thức, KaTeX lỗi ${bad}`);
}

async function tc310() {
  const vi = /[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹáàãéèíìóòõúùýĐ]/;
  const zipNoDoc = await (async () => { const z = new M.JSZip(); z.file('hello.txt', 'x'); return z.generateAsync({ type: 'nodebuffer' }); })();
  const big = Buffer.alloc(10 * 1024 * 1024 + 10, 0x50); big.write('PK\u0003\u0004', 0, 'latin1');
  const cases = [
    ['file 10 MB + 10 byte (.docx)', 'lon.docx', big],
    ['file PDF', 'de.pdf', Buffer.from('%PDF-1.4\n%âãÏÓ\n1 0 obj\n')],
    ['ảnh .png', 'anh.png', M.png(5, 5, [0, 0, 0])],
    ['Word 97 (.doc)', 'cu.doc', Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), Buffer.alloc(500)])],
    ['docx hỏng (byte ngẫu nhiên)', 'hong.docx', Buffer.from(Array.from({ length: 3000 }, (_, i) => (i * 7919) & 255))],
    ['docx cắt cụt', 'cut.docx', (await M.docx({ body: pText('Câu 1. x') })).subarray(0, 300)],
    ['zip không có document.xml', 'rong.docx', zipNoDoc],
    ['PDF đổi tên .docx', 'gia.docx', Buffer.from('%PDF-1.4\n...')],
    ['xlsx hỏng', 'hong.xlsx', Buffer.from('không phải excel')]
  ];
  for (const [name, fn, buf] of cases) {
    const t0 = Date.now();
    let msg = null, res = null;
    try {
      res = await Promise.race([D.readFile(fn, buf, LIB), new Promise((_, rej) => setTimeout(() => rej(new Error('__TREO__')), 5000))]);
    } catch (e) { msg = e.message; }
    const ms = Date.now() - t0;
    const ok = msg && msg !== '__TREO__' && vi.test(msg) && !/undefined|TypeError|Cannot read|at Object/.test(msg);
    verdict('TC-3.10', ok, `${name} → ${msg ? '"' + msg.slice(0, 110) + '"' : 'KHÔNG báo lỗi (' + JSON.stringify(res).slice(0, 80) + ')'} (${ms} ms)`);
  }
}

// K-1 (ngoài TC bắt buộc): .txt bị coi là .csv; .csv sai mẫu (một cột chữ) ra câu trống mà không cảnh báo
async function k1() {
  for (const [name, fn] of [['file .txt (văn bản đề)', 'de.txt'], ['.csv một cột chữ (sai mẫu cột)', 'mot-cot.csv']]) {
    let msg = null, res = null;
    try { res = await D.readFile(fn, Buffer.from('Câu 1. Một câu hỏi\nCâu 2. Câu khác'), LIB); } catch (e) { msg = e.message; }
    const empty = res ? res.questions.filter((q) => !String(q.noiDung || '').trim()).length : 0;
    const warned = res && res.warnings && res.warnings.length;
    verdict('K-1 file sai mẫu ra câu trống', !!msg || (empty === 0) || !!warned,
      `${name} → ${msg ? 'báo lỗi "' + msg + '"' : (res.questions.length + ' câu, ' + empty + ' câu nội dung trống, cảnh báo: ' + (warned ? res.warnings.join('; ') : 'không có'))}`);
  }
}

// ---- Vòng 2: kiểm theo thay đổi người dùng thấy ----
async function v2() {
  // .txt đọc như "Dán văn bản"
  const lines = M.exam28Lines();
  const rt = await D.readFile('de.txt', Buffer.from(lines.join('\r\n'), 'utf8'), LIB);
  let same = true; try { assert.deepStrictEqual(rt.questions, I.fromText(lines.join('\n')).questions); } catch (e) { same = false; }
  verdict('V2 .txt như Dán văn bản', same && rt.questions.length === 28, `.txt đề 28 câu → ${rt.questions.length} câu, giống fromText: ${same}`);
  // Câu thiếu nội dung (csv/xlsx sai cột) → cảnh báo có số câu
  const rc = await D.readFile('mot-cot.csv', Buffer.from('Câu 1. Một câu hỏi\nCâu 2. Câu khác'), LIB);
  const rx = await D.readFile('lech.xlsx', M.xlsx([['TN', '', 'a', 'b', 'c', 'd', 'A'], ['TN', 'Có nội dung', 'a', 'b', 'c', 'd', 'B']]), LIB);
  const wc = rc.warnings.join(' | '), wx = rx.warnings.join(' | ');
  verdict('V2 cảnh báo câu thiếu nội dung', /Câu 1\b[^|]*không có nội dung/.test(wc) && /Câu 2\b[^|]*không có nội dung/.test(wc) && /Câu 1\b[^|]*không có nội dung/.test(wx) && !/Câu 2\b[^|]*không có nội dung/.test(wx),
    `csv một cột: "${wc.slice(0, 160)}"; xlsx câu 1 trống: "${wx.slice(0, 120)}"`);
  // "Chọn câu đúng." / "Chọn phát biểu đúng:" là câu dẫn, không thành đáp án; "Lời giải: Chọn B." vẫn là đáp án
  const body = [pText('PHẦN I'),
    pText('Câu 1. Chọn câu đúng.'), pText('A. x'), pText('B. y'), pText('C. z'), pText('D. t'),
    pText('Câu 2. Một vật rơi tự do.'), pText('Chọn phát biểu đúng:'), pText('A. x'), pText('B. y'), pText('C. z'), pText('D. t'),
    pText('Câu 3. Chọn đáp án đúng nhất.'), pText('A. x'), pText('B. y'), pText('C. z'), pText('D. t'), pText('Lời giải: Chọn B.'),
    pText('Câu 4. Chọn C là sai vì'), pText('A. x'), pText('B. y'), pText('C. z'), pText('D. t'), pText('Đáp án: D')].join('');
  const qs = D.toQuestions(await read(await M.docx({ body })), I).questions;
  const ks = qs.map((q) => q.dapAn || '-').join(',');
  verdict('V2 câu dẫn "Chọn …" không thành đáp án', qs.length === 4 && ks === '-,-,B,D' && /Chọn câu đúng/.test(qs[0].noiDung) && /Chọn phát biểu đúng/.test(qs[1].noiDung),
    `đáp án 4 câu: ${ks} (mong -,-,B,D); câu 1 nội dung "${qs[0].noiDung}", câu 2 "${qs[1].noiDung.replace(/\n/g, ' / ')}"`);
  // File hỏng / bom nén / XML độc → báo tiếng Việt, không treo
  const vi = /[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựáàãéèíìóòõúùýĐ]/;
  const zipWith = async (xml, extra) => { const z = new M.JSZip(); z.file('[Content_Types].xml', '<Types/>'); z.file('word/document.xml', xml); if (extra) extra(z); return z.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } }); };
  const W = `<w:document ${'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'}><w:body>`;
  const cases = [
    ['bom nén: document.xml 80 MB', await zipWith(W + '<w:p><w:r><w:t>' + ' '.repeat(80 * 1024 * 1024) + '</w:t></w:r></w:p></w:body></w:document>')],
    ['bom nén: 10 phần 8 MB', await zipWith(W + '<w:p/></w:body></w:document>', (z) => { for (let i = 0; i < 10; i++) z.file(`word/media/x${i}.png`, Buffer.alloc(8 * 1024 * 1024)); })],
    ['lồng sâu 200 000 tầng', await zipWith(W + '<w:sdt>'.repeat(200000) + '</w:body></w:document>')],
    ['50 000 thuộc tính hỏng', await zipWith(W + '<w:p ' + 'a="<b '.repeat(50000) + '</w:body></w:document>')],
    ['100 000 dấu "<" lẻ', await zipWith(W + '<'.repeat(100000) + '</w:body></w:document>')],
    ['chú thích không đóng', await zipWith(W + '<!-- ' + 'x'.repeat(1e6))]
  ];
  for (const [name, buf] of cases) {
    const t0 = Date.now(); let msg = null, res = null;
    try { res = await Promise.race([D.readFile('bom.docx', buf, LIB), new Promise((_, rej) => setTimeout(() => rej(new Error('__TREO__')), 8000))]); } catch (e) { msg = e.message; }
    const ms = Date.now() - t0;
    const ok = msg ? msg !== '__TREO__' && vi.test(msg) && !/TypeError|Cannot read|Maximum call/.test(msg) : (res && Array.isArray(res.questions));
    verdict('V2 file hỏng / bom nén', ok && ms < 5000, `${name} (${(buf.length / 1024).toFixed(0)} KB) → ${msg ? '"' + msg.slice(0, 110) + '"' : 'đọc xong, ' + res.questions.length + ' câu, không lỗi'} (${ms} ms)`);
  }
}

function tc313() {
  const r = spawnSync(process.execPath, [path.join(__dirname, 'importer.test.js')], { encoding: 'utf8', env: process.env });
  verdict('TC-3.13', r.status === 0, `node tests/importer.test.js → mã thoát ${r.status}; ${(r.stdout + r.stderr).trim().split('\n').slice(-2).join(' / ').slice(0, 160)}`);
}

(async () => {
  const steps = [tc31, tc32, tc33, tc34, tc35, tc36, tc37, tc38, tc39, tc310, k1, v2, tc313];
  for (const s of steps) {
    try { await s(); } catch (e) { verdict(s.name.replace('tc3', 'TC-3.'), false, 'LỖI KỊCH BẢN: ' + (e.stack || e).toString().slice(0, 300)); }
  }
  const fails = Object.entries(R).filter(([, v]) => !v.pass);
  console.log(`\n${Object.keys(R).length - fails.length}/${Object.keys(R).length} nhóm đạt` + (fails.length ? ' — KHÔNG ĐẠT: ' + fails.map(([k]) => k).join(', ') : ''));
  if (process.env.JSON_OUT) require('fs').writeFileSync(process.env.JSON_OUT, JSON.stringify(R, null, 2));
  if (fails.length) process.exitCode = 1;
})();
