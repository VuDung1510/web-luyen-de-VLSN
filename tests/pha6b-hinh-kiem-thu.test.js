// Pha 6b — KIỂM THỬ ĐỘC LẬP bản sửa "hình nổi/inline ở đầu đoạn Word".
// Viết theo yêu cầu, không dựa vào test của người làm.
//   LIBS_DIR=<node_modules có jszip, xlsx, katex> node tests/pha6b-hinh-kiem-thu.test.js
// Tuỳ chọn (chỉ chạy khi file tồn tại, chỉ in số liệu, không in nội dung đề):
//   DE_THAY=<đường dẫn de.docx của giáo viên>   WORD_THAT=<thư mục 4 file Pha 3>   MAIN_IMPORTER=<importer.js của origin/main>
// Mặc định MAIN_IMPORTER được lấy bằng `git show origin/main:assets/js/importer.js` ra thư mục tạm.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const LIBS = process.env.LIBS_DIR;
if (!LIBS) { console.error('Cần LIBS_DIR (thư mục node_modules có jszip, xlsx, katex).'); process.exit(1); }
const JSZip = require(path.join(LIBS, 'jszip'));
const XLSX = require(path.join(LIBS, 'xlsx'));
const katex = require(path.join(LIBS, 'katex'));
const ROOT = path.join(__dirname, '..');
const I = require('../assets/js/importer.js');
const R = require('../assets/js/docx-reader.js');
const M = require('./fixtures/make-docx')(LIBS);

let mainPath = process.env.MAIN_IMPORTER;
if (!mainPath) {
  mainPath = path.join(fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), 'kt6b-')), 'importer-main.js');
  fs.writeFileSync(mainPath, execSync('git show origin/main:assets/js/importer.js', { cwd: ROOT }));
}
const IM = require(mainPath);

const validate = (t) => { try { katex.renderToString(t.replace(/(\d),(?=\d)/g, '$1{,}'), { throwOnError: true }); return true; } catch (e) { return false; } };
const libsNew = { JSZip, XLSX, Importer: I, validate };
const libsMain = { JSZip, XLSX, Importer: IM, validate };
const read = (buf, libs) => R.readFile('de.docx', buf, libs || libsNew);

let n = 0, failed = 0;
const rows = [];
async function test(name, fn) {
  try { const note = await fn(); n++; rows.push([name, 'ĐẠT', note || '']); console.log('  ✓ ' + name + (note ? '  — ' + note : '')); }
  catch (e) { failed++; rows.push([name, 'LỖI', String(e.message).split('\n')[0]]); console.log('  ✗ ' + name + '\n    ' + (e.stack || e).toString().split('\n').slice(0, 4).join('\n    ')); }
}

// ---- tiện ích ----
const FIELDS = ['noiDung', 'A', 'B', 'C', 'D', 'loiGiai', 'dapAn', 'hinhAnh'];
const HINH = /\{\{HINH:(\d+)\}\}/g;
/** n hình → danh sách chỉ số câu (0-based) chứa mốc {{HINH:n}} */
function where(qs) {
  const m = {};
  qs.forEach((q, i) => FIELDS.forEach((f) => String(q[f] || '').replace(HINH, (_, k) => { (m[k] = m[k] || []).push(i); return ''; })));
  return m;
}
/** chỉ số câu có hình (sắp xếp, không lặp) */
const withImg = (qs) => qs.map((q, i) => (FIELDS.some((f) => /\{\{HINH:\d+\}\}/.test(String(q[f] || ''))) ? i : -1)).filter((i) => i >= 0);
const byPart = (qs) => [1, 2, 3].map((p) => qs.filter((q) => q.phan === p).length).join('-');
const noMark = (s) => String(s || '').replace(HINH, '').replace(/\s+/g, ' ').trim();
const opts4 = (q) => ['A', 'B', 'C', 'D'].every((k) => noMark(q[k]) !== '');
const png = (c) => M.png(40, 30, c);
const media = (k) => { const o = {}; for (let i = 1; i <= k; i++) o['rId' + i] = { name: 'image' + i + '.png', data: png([i * 50, 80, 120]) }; return o; };
const img = (rid, kind) => M.img(rid, { anchor: kind === 'anchor' });

/** Đề nhỏ 4 TN + 2 DS + 2 TL; hook(part, i) trả về khối thay thế cho đoạn "Câu i" nếu cần */
function exam(o) {
  o = o || {};
  const P = (s) => M.p(s);
  const B = [];
  B.push(o.part1 ? o.part1 : P('PHẦN I. TRẮC NGHIỆM NHIỀU LỰA CHỌN'));
  for (let i = 1; i <= 4; i++) {
    const sep = o.sep || ':';
    const stem = 'Câu ' + i + sep + ' Nội dung câu trắc nghiệm ' + i + '.';
    B.push(o.stem && o.stem(1, i, stem) || P(stem));
    if (o.optLine && o.optLine(1, i)) B.push(...o.optLine(1, i));
    else B.push(P('A. phương án A' + i + '\tB. phương án B' + i), P('C. phương án C' + i + '\tD. phương án D' + i));
  }
  B.push(o.part2 ? o.part2 : P('PHẦN II. TRẮC NGHIỆM ĐÚNG SAI'));
  for (let i = 1; i <= 2; i++) {
    const stem = 'Câu ' + i + ': Nội dung câu đúng sai ' + i + '.';
    B.push(o.stem && o.stem(2, i, stem) || P(stem));
    const lab = o.dsLabel || ((k) => k + '.');
    ['a', 'b', 'c', 'd'].forEach((k) => {
      const t = lab(k) + ' Ý ' + k + ' của câu ' + i + '.';
      B.push(o.item && o.item(i, k, t) || P(t));
    });
  }
  B.push(P('PHẦN III. TRẮC NGHIỆM TRẢ LỜI NGẮN'));
  for (let i = 1; i <= 2; i++) {
    const stem = 'Câu ' + i + ': Tính đại lượng ' + i + '.';
    B.push(o.stem && o.stem(3, i, stem) || P(stem));
  }
  return B;
}
const idx = (part, i) => ({ 1: 0, 2: 4, 3: 6 }[part] + i - 1); // chỉ số câu trong đề nhỏ 4-2-2

/** Kiểm cấu trúc chuẩn của đề nhỏ */
function checkShape(r, label) {
  const qs = r.questions;
  assert.strictEqual(qs.length, 8, label + ': số câu ' + qs.length + ' (mong 8)');
  assert.strictEqual(byPart(qs), '4-2-2', label + ': theo phần ' + byPart(qs));
  assert.deepStrictEqual(qs.map((q) => q.loai).join(','), 'TN,TN,TN,TN,DS,DS,TL,TL', label);
  qs.slice(0, 4).forEach((q, i) => {
    assert.ok(opts4(q), label + ': câu ' + (i + 1) + ' P1 thiếu phương án ' + JSON.stringify([q.A, q.B, q.C, q.D]));
    assert.ok(/Nội dung câu trắc nghiệm/.test(noMark(q.noiDung)), label + ': câu ' + (i + 1) + ' mất nội dung: ' + q.noiDung);
  });
  qs.slice(4, 6).forEach((q, i) => {
    assert.ok(opts4(q), label + ': câu ĐS ' + (i + 1) + ' thiếu ý ' + JSON.stringify([q.A, q.B, q.C, q.D]));
    ['a', 'b', 'c', 'd'].forEach((k, j) => assert.ok(noMark(q['ABCD'[j]]).includes('Ý ' + k + ' của câu ' + (i + 1)), label + ': ý ' + k + ' câu ĐS ' + (i + 1) + ' = ' + q['ABCD'[j]]));
  });
  // Không còn nhãn lẫn vào nội dung
  qs.forEach((q, i) => assert.ok(!/(^|\n)\s*(Câu \d+[:.]|PHẦN)/.test(noMark(q.noiDung)), label + ': nhãn lẫn vào câu ' + (i + 1) + ': ' + q.noiDung));
}
/** Mỗi hình 1..k nằm ở đúng 1 câu, tại các chỉ số mong đợi */
function checkImgs(r, k, expect, label) {
  const w = where(r.questions);
  for (let i = 1; i <= k; i++) {
    assert.ok(w[i], label + ': hình ' + i + ' bị mất (không câu nào chứa)');
    assert.strictEqual(w[i].length, 1, label + ': hình ' + i + ' ở ' + w[i].length + ' chỗ');
    if (expect) assert.strictEqual(w[i][0], expect[i - 1], label + ': hình ' + i + ' gắn câu #' + (w[i][0] + 1) + ', mong #' + (expect[i - 1] + 1));
  }
  assert.strictEqual(r.images.length, k, label + ': images.length=' + r.images.length);
  // attachImages đưa được hết về URL
  const qs = JSON.parse(JSON.stringify(r.questions));
  const urls = {}; r.images.forEach((im) => { urls[im.n] = 'https://x/h' + im.n; });
  assert.deepStrictEqual(R.attachImages(qs, urls), [], label + ': attachImages lỗi');
  for (let i = 1; i <= k; i++) {
    const has = qs.map((q, j) => (JSON.stringify(q).includes('https://x/h' + i + '"') || JSON.stringify(q).includes('https://x/h' + i + ')') ? j : -1)).filter((j) => j >= 0);
    assert.strictEqual(has.length, 1, label + ': sau attachImages hình ' + i + ' ở ' + has.length + ' câu');
  }
}

(async () => {
  console.log('Pha 6b — kiểm thử hình đầu đoạn (độc lập)');

  // ===== K1: hình đầu đoạn "Câu n" =====
  for (const kind of ['anchor', 'inline']) {
    for (const sep of [':', '.']) {
      await test(`K1 ${kind} đầu "Câu 2${sep}" (P1)`, async () => {
        const buf = await M.docx(exam({ sep, stem: (p, i, s) => (p === 1 && i === 2 ? M.p([img('rId1', kind), s]) : null) }), { media: media(1) });
        const r = await read(buf);
        checkShape(r, 'mới'); checkImgs(r, 1, [idx(1, 2)], 'mới');
        assert.ok(/^Nội dung câu trắc nghiệm 2\.$/.test(noMark(r.questions[1].noiDung)), r.questions[1].noiDung);
        const rm = await read(buf, libsMain);
        return 'main: ' + rm.questions.length + ' câu (' + byPart(rm.questions) + ')';
      });
    }
  }
  await test('K1b anchor đầu "Câu 1:" (ngay sau dòng PHẦN I) và đầu "Câu 4:" (câu cuối P1)', async () => {
    const buf = await M.docx(exam({ stem: (p, i, s) => (p === 1 && i === 1 ? M.p([img('rId1', 'anchor'), s]) : p === 1 && i === 4 ? M.p([img('rId2', 'inline'), s]) : null) }), { media: media(2) });
    const r = await read(buf); checkShape(r, 'mới'); checkImgs(r, 2, [0, 3], 'mới');
  });
  await test('K1c anchor đầu "Câu 1:" PHẦN II (số câu lặp lại) → câu ĐS 1, không phải câu 1 P1', async () => {
    const buf = await M.docx(exam({ stem: (p, i, s) => (p === 2 && i === 1 ? M.p([img('rId1', 'anchor'), s]) : null) }), { media: media(1) });
    const r = await read(buf); checkShape(r, 'mới'); checkImgs(r, 1, [idx(2, 1)], 'mới');
  });
  await test('K1d inline đầu "Câu 2:" PHẦN III (trả lời ngắn)', async () => {
    const buf = await M.docx(exam({ stem: (p, i, s) => (p === 3 && i === 2 ? M.p([img('rId1', 'inline'), s]) : null) }), { media: media(1) });
    const r = await read(buf); checkShape(r, 'mới'); checkImgs(r, 1, [idx(3, 2)], 'mới');
  });
  await test('K1e đánh số liên tục: anchor đầu "Câu 6:" ở PHẦN II (đề 1–4, 5–6, 7–8)', async () => {
    const B = [M.p('PHẦN I')];
    for (let i = 1; i <= 4; i++) B.push(M.p('Câu ' + i + ': Hỏi trắc nghiệm ' + i + '.'), M.p('A. a\tB. b\tC. c\tD. d'));
    B.push(M.p('PHẦN II'));
    for (let i = 5; i <= 6; i++) { const s = 'Câu ' + i + ': Hỏi đúng sai ' + i + '.'; B.push(i === 6 ? M.p([img('rId1', 'anchor'), s]) : M.p(s)); ['a', 'b', 'c', 'd'].forEach((k) => B.push(M.p(k + '. Ý ' + k + '.'))); }
    B.push(M.p('PHẦN III'));
    for (let i = 7; i <= 8; i++) B.push(M.p('Câu ' + i + ': Tính ' + i + '.'));
    const r = await read(await M.docx(B, { media: media(1) }));
    assert.strictEqual(byPart(r.questions), '4-2-2'); checkImgs(r, 1, [5], 'mới');
    assert.ok(opts4(r.questions[5]));
  });

  // ===== K2: hình đầu dòng phương án =====
  for (const kind of ['anchor', 'inline']) {
    await test(`K2 ${kind} đầu dòng "A. …\\tB. …" của câu 3`, async () => {
      const buf = await M.docx(exam({ optLine: (p, i) => (i === 3 ? [M.p([img('rId1', kind), 'A. phương án A3\tB. phương án B3']), M.p('C. phương án C3\tD. phương án D3')] : null) }), { media: media(1) });
      const r = await read(buf); checkShape(r, 'mới'); checkImgs(r, 1, [idx(1, 3)], 'mới');
      assert.strictEqual(noMark(r.questions[2].A), 'phương án A3');
    });
    await test(`K2b ${kind} đầu dòng "A." riêng một dòng (A/B/C/D mỗi dòng một đoạn) câu 2`, async () => {
      const buf = await M.docx(exam({ optLine: (p, i) => (i === 2 ? [M.p([img('rId1', kind), 'A. một']), M.p('B. hai'), M.p('C. ba'), M.p('D. bốn')] : null) }), { media: media(1) });
      const r = await read(buf); checkShape(r, 'mới'); checkImgs(r, 1, [idx(1, 2)], 'mới');
      assert.deepStrictEqual(['A', 'B', 'C', 'D'].map((k) => noMark(r.questions[1][k])), ['một', 'hai', 'ba', 'bốn']);
    });
    await test(`K2c ${kind} đầu dòng "C. …" (giữa các phương án) câu 4`, async () => {
      const buf = await M.docx(exam({ optLine: (p, i) => (i === 4 ? [M.p('A. phương án A4\tB. phương án B4'), M.p([img('rId1', kind), 'C. phương án C4\tD. phương án D4'])] : null) }), { media: media(1) });
      const r = await read(buf); checkShape(r, 'mới'); checkImgs(r, 1, [idx(1, 4)], 'mới');
    });
  }

  // ===== K3: hình đầu ý câu Đúng/Sai =====
  for (const kind of ['anchor', 'inline']) {
    for (const [nm, lab] of [['a.', (k) => k + '.'], ['a)', (k) => k + ')']]) {
      await test(`K3 ${kind} đầu ý "${nm}" câu ĐS 2`, async () => {
        const buf = await M.docx(exam({ dsLabel: lab, item: (i, k, t) => (i === 2 && k === 'a' ? M.p([img('rId1', kind), t]) : null) }), { media: media(1) });
        const r = await read(buf); checkShape(r, 'mới'); checkImgs(r, 1, [idx(2, 2)], 'mới');
        const rm = await read(buf, libsMain);
        return 'main: câu ĐS 2 ý a = ' + JSON.stringify(noMark(rm.questions[5] && rm.questions[5].A)).slice(0, 30);
      });
    }
  }
  await test('K3b inline đầu ý "c." câu ĐS 1', async () => {
    const buf = await M.docx(exam({ item: (i, k, t) => (i === 1 && k === 'c' ? M.p([img('rId1', 'inline'), t]) : null) }), { media: media(1) });
    const r = await read(buf); checkShape(r, 'mới'); checkImgs(r, 1, [idx(2, 1)], 'mới');
  });

  // ===== K4: hình đầu dòng PHẦN =====
  for (const kind of ['anchor', 'inline']) {
    await test(`K4 ${kind} đầu dòng "PHẦN II" → vẫn đủ 3 phần, hình không mất`, async () => {
      const buf = await M.docx(exam({ part2: M.p([img('rId1', kind), 'PHẦN II. TRẮC NGHIỆM ĐÚNG SAI']) }), { media: media(1) });
      const r = await read(buf); checkShape(r, 'mới'); checkImgs(r, 1, null, 'mới');
      return 'hình gắn câu #' + (where(r.questions)[1][0] + 1);
    });
  }
  await test('K4b anchor đầu dòng "PHẦN I" (đoạn đầu đề)', async () => {
    const buf = await M.docx(exam({ part1: M.p([img('rId1', 'anchor'), 'PHẦN I. TRẮC NGHIỆM NHIỀU LỰA CHỌN']) }), { media: media(1) });
    const r = await read(buf); checkShape(r, 'mới');
    const w = where(r.questions);
    return w[1] ? 'hình gắn câu #' + (w[1][0] + 1) : 'hình ở trước câu đầu tiên (không gắn câu nào; images=' + r.images.length + ')';
  });

  // ===== K5: hai hình đầu đoạn, hình giữa / cuối đoạn, đoạn chỉ có hình =====
  await test('K5 hai hình (anchor + inline) đầu "Câu 3:" → cả hai ở câu 3', async () => {
    const buf = await M.docx(exam({ stem: (p, i, s) => (p === 1 && i === 3 ? M.p([img('rId1', 'anchor'), img('rId2', 'inline'), s]) : null) }), { media: media(2) });
    const r = await read(buf); checkShape(r, 'mới'); checkImgs(r, 2, [2, 2], 'mới');
  });
  await test('K5b hai hình anchor đầu ý "a." câu ĐS 1', async () => {
    const buf = await M.docx(exam({ item: (i, k, t) => (i === 1 && k === 'a' ? M.p([img('rId1', 'anchor'), img('rId2', 'anchor'), t]) : null) }), { media: media(2) });
    const r = await read(buf); checkShape(r, 'mới'); checkImgs(r, 2, [4, 4], 'mới');
  });
  const oldStyle = {
    'giữa đoạn': (s) => M.p([s.slice(0, 10), img('rId1', 'inline'), s.slice(10)]),
    'cuối đoạn': (s) => M.p([s, img('rId1', 'anchor')]),
    'cuối đoạn inline': (s) => M.p([s, ' ', img('rId1', 'inline')])
  };
  for (const nm of Object.keys(oldStyle)) {
    await test(`K5c hình ${nm} "Câu 3:" → câu 3, kết quả y hệt origin/main`, async () => {
      const buf = await M.docx(exam({ stem: (p, i, s) => (p === 1 && i === 3 ? oldStyle[nm](s) : null) }), { media: media(1) });
      const r = await read(buf); checkShape(r, 'mới'); checkImgs(r, 1, [2], 'mới');
      assert.deepStrictEqual(r, await read(buf, libsMain));
    });
  }
  await test('K5d đoạn chỉ có hình (anchor, inline) sau "Câu 2:" và sau dòng ý "b." → y hệt origin/main', async () => {
    const blocks = exam({ stem: (p, i, s) => (p === 1 && i === 2 ? M.raw(M.p(s).xml + M.p([img('rId1', 'anchor')]).xml) : null), item: (i, k, t) => (i === 1 && k === 'b' ? M.raw(M.p(t).xml + M.p([img('rId2', 'inline')]).xml) : null) });
    const buf = await M.docx(blocks, { media: media(2) });
    const r = await read(buf); checkShape(r, 'mới'); checkImgs(r, 2, [1, 4], 'mới');
    assert.deepStrictEqual(r, await read(buf, libsMain));
  });

  // ===== K6: đề cũ / văn bản dán không mốc → y hệt origin/main =====
  await test('K6 dán văn bản không mốc hình: fromText y hệt origin/main (8 mẫu)', async () => {
    const texts = [M.sampleText28(),
      'Câu 1: Hỏi?\nA. 1\tB. 2\tC. 3\tD. 4\nĐáp án: A',
      'PHẦN II\nCâu 1. Cho\na) x\nb) y\nc) z\nd) t',
      'Câu 1. Xem Hình 1.\nHình 1\nA. một\nB. hai\nC. ba\nD. bốn\nLời giải: Chọn C.',
      'PHẦN I\nCâu 1: a.\nA. Câu 2: lạ\tB. x\tC. y\tD. z\nCâu 2: b\nA.1 B.2 C.3 D.4',
      'Câu 1: {{HIN}} không phải mốc\nA. {x}\tB. }}\tC. {{\tD. ;',
      'PHẦN III\nCâu 1: Tính?\nĐáp số: 1,5\nCâu 2: Tính\n  a. không phải ý\nĐáp án của em: …',
      '1. Hỏi kiểu số?\nA. a\nB. b\nC. c\nD. d\n2) Hỏi tiếp?\nA. a B. b C. c D. d'];
    texts.forEach((t, i) => assert.deepStrictEqual(I.fromText(t), IM.fromText(t), 'mẫu ' + (i + 1)));
    // và TSV không đổi
    const tsv = 'TN\tĐơn vị lực?\tN\tJ\tW\tPa\tA\nDS\tMệnh đề\ta\tb\tc\td\tĐSĐS';
    assert.deepStrictEqual(I.fromTsv(tsv), IM.fromTsv(tsv));
  });
  await test('K6b docx không có hình (đề 28 câu, khung Form VLSN) → y hệt origin/main', async () => {
    const buf = await M.docx(M.lines(M.sampleText28()), { header: 'Đầu trang' });
    assert.deepStrictEqual(await read(buf), await read(buf, libsMain));
    const buf2 = await M.docx(exam());
    const r2 = await read(buf2); checkShape(r2, 'mới');
    assert.deepStrictEqual(r2, await read(buf2, libsMain));
  });

  // ===== K7: file thật của giáo viên (chỉ ghi số liệu) =====
  const DE = process.env.DE_THAY;
  if (DE && fs.existsSync(DE)) {
    await test('K7 file thật giáo viên: 18–4–6, câu 6/13/16 P1 + P2 câu 3 có hình, đủ phương án/ý, số hình = số a:blip', async () => {
      const buf = fs.readFileSync(DE);
      const z = await JSZip.loadAsync(buf);
      const xml = await z.file('word/document.xml').async('string');
      const cnt = (s) => (s.match(/<a:blip\b[^>]*r:embed=/g) || []).length + (s.match(/<v:imagedata\b[^>]*r:id=/g) || []).length;
      // hình trong khung đầu đề (bảng trước câu đầu tiên, vd. logo) bị bỏ qua theo thiết kế Pha 3 → chỉ đếm từ chữ "Câu" đầu tiên
      const blipsAll = cnt(xml), blips = cnt(xml.slice(xml.indexOf('Câu')));
      const r = await read(buf);
      const qs = r.questions;
      const p1 = qs.filter((q) => q.phan === 1), p2 = qs.filter((q) => q.phan === 2);
      assert.strictEqual(byPart(qs), '18-4-6', 'theo phần ' + byPart(qs));
      p1.forEach((q, i) => assert.ok(opts4(q), 'P1 câu ' + (i + 1) + ' thiếu phương án'));
      p2.forEach((q, i) => assert.ok(opts4(q), 'P2 câu ' + (i + 1) + ' thiếu ý'));
      const has = (q) => FIELDS.some((f) => /\{\{HINH:\d+\}\}/.test(String(q[f] || '')));
      const p1img = p1.map((q, i) => (has(q) ? i + 1 : 0)).filter(Boolean);
      const p2img = p2.map((q, i) => (has(q) ? i + 1 : 0)).filter(Boolean);
      [6, 13, 16].forEach((k) => assert.ok(p1img.includes(k), 'P1 câu ' + k + ' không có hình; có hình: ' + p1img));
      assert.ok(p2img.includes(3), 'P2 câu 3 không có hình; có hình: ' + p2img);
      const w = where(qs);
      const ks = Object.keys(w);
      assert.strictEqual(ks.length, blips, 'số hình gắn ' + ks.length + ' ≠ số hình trong document.xml ' + blips);
      ks.forEach((k) => assert.strictEqual(w[k].length, 1, 'hình ' + k + ' ở ' + w[k].length + ' câu'));
      const rm = await read(buf, libsMain);
      return `${qs.length} câu (${byPart(qs)}); a:blip toàn file=${blipsAll}, trong phần câu hỏi=${blips}, hình gắn=${ks.length}, mỗi hình 1 câu; P1 có hình: ${p1img.join(',')}; P2 có hình: ${p2img.join(',')}; P3 có hình: ${qs.filter((q) => q.phan === 3).map((q, i) => (has(q) ? i + 1 : 0)).filter(Boolean).join(',') || '—'}; cảnh báo: ${r.warnings.length}. origin/main: ${rm.questions.length} câu (${byPart(rm.questions)}), hình gắn=${Object.keys(where(rm.questions)).length}`;
    });
  } else console.log('  (bỏ qua K7: không có DE_THAY)');

  const WT = process.env.WORD_THAT;
  if (WT && fs.existsSync(WT)) {
    const files = [['f1-gk1-vlsn.docx', 28], ['f2-ks-doituyen.docx', 44], ['f3-vl11-de.docx', 22], ['f4-vl11-loigiai.docx', 28]];
    for (const [f, want] of files) {
      const p = path.join(WT, f);
      if (!fs.existsSync(p)) { console.log('  (bỏ qua ' + f + ')'); continue; }
      await test(`K8 file Pha 3 ${f}: ${want} câu, y hệt origin/main`, async () => {
        const buf = fs.readFileSync(p);
        const r = await read(buf), rm = await read(buf, libsMain);
        assert.strictEqual(r.questions.length, want);
        assert.deepStrictEqual(r.questions, rm.questions);
        assert.deepStrictEqual(r.warnings, rm.warnings);
        return `${r.questions.length} câu (${byPart(r.questions)}), hình ${r.images.length}, cảnh báo ${r.warnings.length} — giống main`;
      });
    }
  } else console.log('  (bỏ qua K8: không có WORD_THAT)');

  console.log('\n' + n + ' đạt, ' + failed + ' lỗi');
  if (process.env.KT_JSON) fs.writeFileSync(process.env.KT_JSON, JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
