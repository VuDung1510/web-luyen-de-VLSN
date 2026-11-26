// Test đơn vị Pha 2 (người làm) — ngân hàng câu hỏi. node tests/bank.test.js
// Kho giả tự soạn: tests/fixtures/kho-gia.js (không chứa câu hỏi thật).
const assert = require('assert');
const path = require('path');
const { createContext } = require('./gas-shim');
const K = require('./fixtures/kho-gia');

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.error('  ✗ ' + name + '\n    ' + (e.stack || e).split('\n').slice(0, 5).join('\n    ')); process.exitCode = 1; }
}
function ok(r) { if (!r.ok) throw new Error('API lỗi: ' + r.error); return r.data; }
const pwOf = (g) => g._sheets.CaiDat._data().find((r) => r[0] === 'MAT_KHAU_QUAN_TRI')[1];
const clearCache = (g) => Object.keys(g._cache).forEach((k) => delete g._cache[k]);

function world(opts = {}) {
  const g = createContext(Object.assign({ quiet: true }, opts.ctx || {}));
  g.setup();
  const k = K.install(g, opts.kho || {});
  const tTok = ok(g.call('loginAdminPassword', { password: pwOf(g) })).token;
  const sTok = ok(g.call('loginPin', { studentId: 'HS0001', pin: '0101' })).token;
  return { g, k, tTok, sTok };
}
/** Hàng kho dạng object như Code.gs đọc (khóa BANK_COLS) từ một mảng 22 ô của fixture. */
function asRow(arr) {
  const H = K.HEADER;
  const o = {};
  const map = { maKho: 'Mã câu', lop: 'Lớp', chuong: 'Chương', bai: 'Bài', dang: 'Dạng câu hỏi', mucDo: 'Mức độ', mucDoY: 'Mức độ từng ý (Phần II)', noiDung: 'Nội dung câu hỏi', A: 'A / a)', B: 'B / b)', C: 'C / c)', D: 'D / d)', dapAn: 'Đáp án', loiGiai: 'Lời giải', hinhVe: 'Hình vẽ', nguon: 'Nguồn', viTri: 'Vị trí trong đề gốc' };
  Object.keys(map).forEach((k) => { o[k] = arr[H.indexOf(map[k])]; });
  return o;
}

console.log('Ngân hàng câu hỏi (Pha 2):');
const g0 = createContext({ quiet: true });

t('TC-2.1 đáp án Phần II hai kiểu + kiểu lẫn; thiếu ý = chưa có đáp án', () => {
  assert.strictEqual(g0.bankTF_('a) Đúng b) Sai c) Sai d) Đúng'), 'ĐSSĐ');
  assert.strictEqual(g0.bankTF_('a) S b) Đ c) Đ d) Đ'), 'SĐĐĐ');
  assert.strictEqual(g0.bankTF_('a) đúng; b) Sai, c) S. d) Đ'), 'ĐSSĐ');
  assert.strictEqual(g0.bankTF_('a) Đúng, b) Đúng, c) Sai, d) Sai'), 'ĐĐSS');
  assert.strictEqual(g0.bankTF_('a) Đúng b) Sai c) Sai'), '');
  assert.strictEqual(g0.bankTF_(''), '');
  // normTF_ cũ đọc nhầm "d)" thành Đ: hàm mới không dùng nó
  const base = asRow(K.row({ phan: 2, dapAn: 'a) Đúng b) Sai c) Sai' }));
  const r = g0.bankToQuestion_(base);
  assert.strictEqual(r.q, null); assert.strictEqual(r.loi, 'dapAnSai'); assert.strictEqual(r.coDapAn, false);
  const good = g0.bankToQuestion_(asRow(K.row({ phan: 2, dapAn: 'a) Đúng b) Sai c) Sai d) Đúng' })));
  assert.strictEqual(good.q.loai, 'DS'); assert.strictEqual(good.q.phan, 2); assert.strictEqual(good.q.dapAn, 'ĐSSĐ');
});

t('TC-2.1 chấm câu Phần II lấy từ kho: đúng 4 ý = 1 điểm, sai 1 ý = 0,5', () => {
  const q = g0.normalizeQuestion_(g0.bankToQuestion_(asRow(K.row({ phan: 2, dapAn: 'a) Đúng b) Sai c) Sai d) Đúng' }))).q, 0);
  assert.strictEqual(q.dapAn, 'DSSD');
  assert.strictEqual(g0.gradeOne_(q, ['D', 'S', 'S', 'D']).score, 1);
  assert.strictEqual(g0.gradeOne_(q, 'ĐSSS').score, 0.5);
});

t('TC-2.1 mức độ ánh xạ tường minh (Biết/Hiểu/Vận dụng/Vận dụng cao)', () => {
  assert.strictEqual(g0.bankLevel_('Biết'), 'NB');
  assert.strictEqual(g0.bankLevel_('Hiểu'), 'TH');
  assert.strictEqual(g0.bankLevel_('Vận dụng'), 'VD');
  assert.strictEqual(g0.bankLevel_('Vận dụng cao'), 'VDC');
  assert.strictEqual(g0.bankLevel_('  vận dụng cao '), 'VDC');
  assert.strictEqual(g0.bankLevel_('Không rõ'), '');
  assert.strictEqual(g0.bankToQuestion_(asRow(K.row({ phan: 1, dapAn: 'A', muc: 'Vận dụng cao' }))).q.mucDo, 'VDC');
});

t('ánh xạ đầy đủ: Phần I/III, chủ đề theo Bài, hình, giữ nguyên văn, Phần IV bị loại', () => {
  const r1 = g0.bankToQuestion_(asRow(K.row({ phan: 1, dapAn: ' b ', hinh: true, ch: 1, bai: 1 })));
  assert.strictEqual(r1.q.loai, 'TN'); assert.strictEqual(r1.q.dapAn, 'B');
  assert.strictEqual(r1.q.chuong, 'Chương II. Khí lí tưởng');
  assert.strictEqual(r1.q.bai, 'Bài 11. Phương trình trạng thái khí lí tưởng');
  assert.strictEqual(r1.q.chuDe, 'Phương trình trạng thái khí lí tưởng');
  assert(/\.png$/.test(r1.hinh) && r1.hinh.startsWith(r1.q.maKho));
  assert.strictEqual(r1.q.hinhAnh, '');
  assert(/\$m = \d+\\ \\text\{kg\}\$/.test(r1.q.noiDung), 'giữ nguyên LaTeX');
  const r3 = g0.bankToQuestion_(asRow(K.row({ phan: 3, dapAn: '3,0' })));
  assert.strictEqual(r3.q.loai, 'TL'); assert.strictEqual(r3.q.dapAn, '3,0'); assert.strictEqual(r3.q.saiSo, '');
  assert.strictEqual(r3.q.A + r3.q.B + r3.q.C + r3.q.D, '');
  const r4 = g0.bankToQuestion_(asRow(K.row({ phan: 4, dapAn: 'a) 2 m/s' })));
  assert.strictEqual(r4.q, null); assert.strictEqual(r4.loi, 'tuLuan');
  assert.strictEqual(g0.bankToQuestion_(asRow(K.row({ phan: 1, dapAn: '' }))).loi, 'khongDapAn');
  assert.strictEqual(g0.bankToQuestion_(asRow(K.row({ phan: 1, dapAn: 'E' }))).loi, 'dapAnSai');
  assert.strictEqual(g0.bankToQuestion_(asRow(K.row({ phan: 3, dapAn: '3\\ \\text{cm}.' }))).loi, 'dapAnSai');
  assert.strictEqual(g0.bankToQuestion_(asRow(K.row({ phan: 3, dapAn: "'-9,9" }))).q.dapAn, '-9,9');
  assert.strictEqual(g0.bankToQuestion_(asRow(K.row({ phan: 1, dapAn: 'A', opts: ['a', 'b', 'c', ''] }))).loi, 'thieuPhuongAn');
  // Mã câu "-P2-" khi cột Dạng trống
  assert.strictEqual(g0.bankPart_('', 'L12C1B04-P2-00031'), 2);
  assert.strictEqual(g0.bankPart_('Phần III – Trả lời ngắn', ''), 3);
  assert.strictEqual(g0.bankPart_('Phần I – Nhiều lựa chọn', ''), 1);
  assert.strictEqual(g0.bankPart_('Phần IV – Tự luận', ''), 4);
  // ô hình
  assert.strictEqual(g0.bankImageName_('Có – L12C2B11-P1-00001.png (02. HÌNH VẼ/Lớp 12)'), 'L12C2B11-P1-00001.png');
  assert.strictEqual(g0.bankImageName_('Có – L12C2B11-P1-00001.png (02. HÌNH VẼ/Lớp 12/HINH_VE_Lop12_lan6)'), 'L12C2B11-P1-00001.png');
  assert.strictEqual(g0.bankImageName_(''), '');
  assert.strictEqual(g0.bankImageName_('Không'), '');
  // Vị trí hai kiểu (+ kiểu có file)
  assert.deepStrictEqual(JSON.parse(JSON.stringify(g0.bankPosition_('P1 – Câu 3'))), { phan: 1, cau: 3, file: '' });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(g0.bankPosition_('Mã 101 – P1 Câu 12'))), { phan: 1, cau: 12, file: '' });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(g0.bankPosition_('P2 – Câu 1 (trang 3) – file: A/B/1. Đề.pdf'))), { phan: 2, cau: 1, file: 'A/B/1. Đề.pdf' });
});

t('TC-2.2 Phần III "3,0" đúng với 3 / 3.0 / 3,0; "-120" đúng -120, sai 120', () => {
  const q = g0.normalizeQuestion_(g0.bankToQuestion_(asRow(K.row({ phan: 3, dapAn: '3,0' }))).q, 0);
  ['3', '3.0', '3,0'].forEach((a) => assert(g0.gradeOne_(q, a).correct, a));
  const q2 = g0.normalizeQuestion_(g0.bankToQuestion_(asRow(K.row({ phan: 3, dapAn: '-120' }))).q, 0);
  assert(g0.gradeOne_(q2, '-120').correct);
  assert(!g0.gradeOne_(q2, '120').correct);
});

const W = world();
const { g, k, tTok, sTok } = W;
const meta = ok(g.call('adminBankMeta', { token: tTok }));
const allCodes = k.rows.map((r) => r[0]);
const unusable = k.rows.filter((r) => !g.bankToQuestion_(asRow(r)).q).map((r) => r[0]);

t('Meta: đếm đúng, nguồn có hai file tách thành hai đề gốc, có cây chương/bài', () => {
  assert.strictEqual(meta.tong, k.rows.length);
  assert.strictEqual(meta.dungDuoc, k.rows.length - unusable.length);
  assert.strictEqual(meta.boQua.tuLuan, 1);
  assert.strictEqual(meta.theoDang.TN + meta.theoDang.DS + meta.theoDang.TL, meta.dungDuoc);
  const c = meta.nguon.filter((x) => /Nguồn mẫu C/.test(x.ten));
  assert.strictEqual(c.length, 2);
  assert(c.every((x) => x.soCau === 3));
  assert(meta.cay.length >= 5 && meta.cay.every((x) => x.lop && x.chuong && x.bai && x.dem));
  assert(meta.docLuc);
});

t('TC-2.3 câu chưa có đáp án / sai định dạng / Phần IV không xuất hiện ở List, Source, Matrix', () => {
  const listed = [];
  for (let p = 1; p < 10; p++) {
    const r = ok(g.call('adminBankList', { token: tTok, page: p, size: 10 }));
    listed.push(...r.items.map((x) => x.maKho));
    if (r.items.length < 10) break;
  }
  assert.strictEqual(listed.length, meta.dungDuoc);
  unusable.forEach((m) => assert(listed.indexOf(m) < 0, m));
  meta.nguon.forEach((s) => {
    const r = ok(g.call('adminBankSource', { token: tTok, nguon: s.ma }));
    r.items.forEach((x) => assert(unusable.indexOf(x.maKho) < 0, x.maKho));
  });
  const mx = ok(g.call('adminBankMatrix', { token: tTok, so: { TN: 100, DS: 100, TL: 100 } }));
  mx.maKho.forEach((m) => assert(unusable.indexOf(m) < 0, m));
  assert.strictEqual(mx.maKho.length, meta.dungDuoc);
  // adminBankToQuestions bỏ qua kèm cảnh báo
  const r = ok(g.call('adminBankToQuestions', { token: tTok, maKho: unusable }));
  assert.strictEqual(r.questions.length, 0);
  assert.strictEqual(r.canhBao.length, unusable.length);
});

t('TC-2.3 adminSaveExam từ chối câu không có đáp án / Phần IV, thông báo nêu số câu', () => {
  const qs = ok(g.call('adminBankToQuestions', { token: tTok, maKho: allCodes.slice(0, 3) })).questions;
  const bad = Object.assign({}, qs[1], { dapAn: '' });
  const r = g.call('adminSaveExam', { token: tTok, exam: { tieuDe: 'Thử' }, questions: [qs[0], bad, qs[2]] });
  assert(!r.ok && /^Câu 2 \(L12/.test(r.error) && /đáp án/.test(r.error), r.error);
  const r4 = g.call('adminSaveExam', { token: tTok, exam: { tieuDe: 'Thử' }, questions: [qs[0], Object.assign({}, qs[2], { phan: 4 })] });
  assert(!r4.ok && /^Câu 2/.test(r4.error) && /Phần IV/.test(r4.error), r4.error);
});

t('TC-2.4 hình: URL bản chép; gọi lại không chép thêm; thiếu file thì cảnh báo có tên; file gốc 0 lần setSharing', () => {
  const W2 = world();
  const withImg = W2.k.rows.filter((r) => /^Có/.test(r[15]) && W2.g.bankToQuestion_(asRow(r)).q).map((r) => r[0]);
  const present = withImg.filter((m) => W2.k.originals[m + '.png']);
  const missing = withImg.filter((m) => !W2.k.originals[m + '.png']);
  assert(present.length >= 2 && missing.length === 1);
  W2.g._resetStats();
  const r = ok(W2.g.call('adminBankToQuestions', { token: W2.tTok, maKho: [present[0]] }));
  assert.strictEqual(W2.g._stats.makeCopy, 1);
  const url = r.questions[0].hinhAnh;
  const copyId = W2.g._props['IMG_' + present[0] + '.png'];
  assert.strictEqual(url, 'https://lh3.googleusercontent.com/d/' + copyId);
  assert.strictEqual(W2.g._drive.files[copyId].copyOf, W2.k.originals[present[0] + '.png']);
  const r2 = ok(W2.g.call('adminBankToQuestions', { token: W2.tTok, maKho: [present[0]] }));
  assert.strictEqual(W2.g._stats.makeCopy, 1, 'gọi lần 2 không chép lại');
  assert.strictEqual(r2.questions[0].hinhAnh, url);
  const r3 = ok(W2.g.call('adminBankToQuestions', { token: W2.tTok, maKho: [missing[0], present[1]] }));
  assert.strictEqual(r3.questions.length, 2, 'câu thiếu hình vẫn được thêm');
  assert(r3.canhBao.some((c) => c.indexOf(missing[0] + '.png') >= 0), 'cảnh báo nêu tên file');
  assert.strictEqual(r3.questions[0].hinhAnh, '');
  Object.values(W2.k.originals).forEach((id) => assert(!W2.g._stats.setSharing[id], 'file gốc bị setSharing'));
  // bản chép được chia sẻ
  assert.strictEqual(W2.g._stats.setSharing[copyId], 1);
});

t('TC-2.4 chưa cấu hình thư mục hình: tìm theo tên trên toàn Drive', () => {
  const W3 = world({ kho: { noFolder: true } });
  const m = W3.k.rows.filter((r) => /^Có/.test(r[15]))[0][0];
  W3.g._resetStats();
  const r = ok(W3.g.call('adminBankToQuestions', { token: W3.tTok, maKho: [m] }));
  assert(r.questions[0].hinhAnh);
  assert.strictEqual(W3.g._stats.getFilesByName, 1);
  assert.strictEqual(W3.g._stats.folderScans, 0);
});

t('TC-2.5 đề gốc sắp đúng cả hai kiểu Vị trí; có "thiếu" khi số câu nhảy; đếm câu không có đáp án', () => {
  const A = ok(g.call('adminBankSource', { token: tTok, nguon: 'Nguồn mẫu A' }));
  const keyA = A.items.map((x) => x.phan * 100 + +x.viTri.match(/Câu (\d+)/)[1]);
  assert.deepStrictEqual(keyA, keyA.slice().sort((a, b) => a - b));
  assert.strictEqual(A.items.filter((x) => x.phan === 1).length, 18);
  assert.strictEqual(A.khongDapAn, 2);
  assert.strictEqual(A.tuLuan, 1);
  const B = ok(g.call('adminBankSource', { token: tTok, nguon: 'Nguồn mẫu B' }));
  assert.deepStrictEqual(B.items.map((x) => x.viTri), ['P1 – Câu 1', 'P1 – Câu 2', 'P1 – Câu 3', 'P1 – Câu 12', 'P1 – Câu 14', 'P1 – Câu 15', 'P2 – Câu 1', 'P2 – Câu 3', 'P3 – Câu 2']);
  const t1 = B.thieu.find((x) => x.phan === 1);
  assert.deepStrictEqual(t1.cau, [5, 6, 7, 8, 9, 10, 11, 13], 'câu 4 có trong kho (chưa có đáp án) nên không tính là thiếu');
  assert(/5–11, 13/.test(t1.text));
  assert.deepStrictEqual(B.thieu.find((x) => x.phan === 2).cau, [2]);
  assert.deepStrictEqual(B.thieu.find((x) => x.phan === 3).cau, [1]);
  assert.strictEqual(B.khongDapAn, 1);
  assert(/P1 – Câu 4/.test(B.khongDapAnViTri[0]));
  const C = meta.nguon.filter((x) => /Nguồn mẫu C/.test(x.ten)).map((x) => ok(g.call('adminBankSource', { token: tTok, nguon: x.ma })));
  C.forEach((c) => { assert.strictEqual(c.items.length, 3); assert.strictEqual(c.thieu.length, 0); });
  assert(!g.call('adminBankSource', { token: tTok, nguon: 'không có' }).ok);
});

t('TC-2.6 ma trận 18–4–6 đúng số, đúng lớp/chương lọc; thiếu thì nêu phần và số câu', () => {
  const mx = ok(g.call('adminBankMatrix', { token: tTok, lop: 'Lớp 12', so: { TN: 18, DS: 4, TL: 6 }, seed: 1 }));
  assert.deepStrictEqual(JSON.parse(JSON.stringify(mx.thieu)), { TN: 0, DS: 0, TL: 0 });
  const qs = ok(g.call('adminBankToQuestions', { token: tTok, maKho: mx.maKho })).questions;
  const cnt = (l) => qs.filter((q) => q.loai === l).length;
  assert.deepStrictEqual([cnt('TN'), cnt('DS'), cnt('TL')], [18, 4, 6]);
  const rowsBy = {};
  k.rows.forEach((r) => { rowsBy[r[0]] = r; });
  mx.maKho.forEach((m) => assert.strictEqual(rowsBy[m][1], 'Lớp 12'));
  // lọc chương
  const ch = 'Chương II. Khí lí tưởng';
  const m2 = ok(g.call('adminBankMatrix', { token: tTok, lop: 'Lớp 12', chuong: [ch], so: { TN: 18, DS: 4, TL: 6 } }));
  m2.maKho.forEach((m) => assert.strictEqual(rowsBy[m][2], ch));
  const avail = (l) => k.rows.filter((r) => r[1] === 'Lớp 12' && r[2] === ch && g.bankToQuestion_(asRow(r)).q && g.bankToQuestion_(asRow(r)).q.loai === l).length;
  assert.deepStrictEqual(JSON.parse(JSON.stringify(m2.thieu)), { TN: Math.max(0, 18 - avail('TN')), DS: Math.max(0, 4 - avail('DS')), TL: Math.max(0, 6 - avail('TL')) });
  assert(m2.thieu.TL > 0 || m2.thieu.DS > 0 || m2.thieu.TN > 0, 'kho mẫu phải thiếu ở chương này');
  assert.strictEqual(m2.maKho.length, Math.min(18, avail('TN')) + Math.min(4, avail('DS')) + Math.min(6, avail('TL')));
  // seed lặp lại được
  const a = ok(g.call('adminBankMatrix', { token: tTok, lop: 'Lớp 12', seed: 7 })).maKho;
  const b = ok(g.call('adminBankMatrix', { token: tTok, lop: 'Lớp 12', seed: 7 })).maKho;
  assert.deepStrictEqual(a, b);
});

t('TC-2.7 ưu tiên câu ít dùng: 30 câu P1, 10 câu đã dùng, chọn 18 → cả 18 từ 20 câu chưa dùng', () => {
  const rows = [];
  for (let i = 0; i < 30; i++) rows.push(K.row({ phan: 1, cau: i + 1, dapAn: 'ABCD'[i % 4], nguon: 'N30' }));
  const W4 = world({ kho: { rows } });
  const used = rows.slice(0, 10).map((r) => r[0]);
  const qs = ok(W4.g.call('adminBankToQuestions', { token: W4.tTok, maKho: used })).questions;
  ok(W4.g.call('adminSaveExam', { token: W4.tTok, exam: { tieuDe: 'Đề đã dùng' }, questions: qs }));
  for (let s = 1; s <= 5; s++) {
    const mx = ok(W4.g.call('adminBankMatrix', { token: W4.tTok, so: { TN: 18, DS: 0, TL: 0 }, seed: s }));
    assert.strictEqual(mx.maKho.length, 18);
    mx.maKho.forEach((m) => assert(used.indexOf(m) < 0, 'chọn câu đã dùng ' + m));
  }
  const list = ok(W4.g.call('adminBankList', { token: W4.tTok, size: 100 })).items;
  assert.strictEqual(list.filter((x) => x.daDung === 1).length, 10);
});

t('TC-2.8 chia lô hình: 300 câu có hình, makeCopy 1 s giả; nhiều lượt tiepTuc, không lượt nào quá 4,5 phút, không chép trùng', () => {
  const W5 = world({ ctx: { makeCopyMs: 1000 }, kho: { rows: K.bigRows(300, { hinh: true }), missingImages: 0 } });
  const codes = W5.k.rows.map((r) => r[0]);
  let cursor, lots = 0, last;
  do {
    const t0 = W5.g._clock.offset();
    last = ok(W5.g.call('adminBankToQuestions', { token: W5.tTok, maKho: codes, cursor }));
    lots++;
    assert(W5.g._clock.offset() - t0 <= 270000, 'một lượt quá 4,5 phút giả');
    cursor = last.tiepTuc;
    assert(lots < 50);
  } while (cursor != null);
  assert(lots >= 8, 'phải chia nhiều lượt (' + lots + ')');
  assert.strictEqual(W5.g._stats.makeCopy, 300, 'không chép trùng');
  assert.strictEqual(last.questions.length, 300);
  assert(last.questions.every((q) => /^https:\/\/lh3\.googleusercontent\.com\/d\//.test(q.hinhAnh)));
  // hình chậm (10 s giả/hình) → lượt dừng vì thời gian, vẫn ≤ 4,5 phút
  const W6 = world({ ctx: { makeCopyMs: 10000 }, kho: { rows: K.bigRows(60, { hinh: true }), missingImages: 0 } });
  const t0 = W6.g._clock.offset();
  const r = ok(W6.g.call('adminBankToQuestions', { token: W6.tTok, maKho: W6.k.rows.map((x) => x[0]) }));
  assert(r.tiepTuc > 0 && r.tiepTuc < 40, 'dừng vì thời gian: ' + r.tiepTuc);
  assert(W6.g._clock.offset() - t0 <= 270000);
});

t('TC-2.9 kho chỉ đọc: 0 lần ghi vào file kho, file gốc không bị setSharing', () => {
  // W đã chạy Meta, List, Source, Matrix, ToQuestions, SaveExam ở các test trên
  assert.strictEqual(g._stats.extWrites[k.khoId] || 0, 0);
  const W7 = world();
  ['adminBankMeta', 'adminBankList', 'adminBankMatrix'].forEach((a) => ok(W7.g.call(a, { token: W7.tTok, refresh: true })));
  ok(W7.g.call('adminBankToQuestions', { token: W7.tTok, maKho: W7.k.rows.map((r) => r[0]) }));
  assert.strictEqual(W7.g._stats.extWrites[W7.k.khoId] || 0, 0);
  Object.values(W7.k.originals).forEach((id) => assert(!W7.g._stats.setSharing[id]));
});

t('TC-2.10 học sinh gọi adminBank* → AUTH; startExam đề từ kho không lộ dapAn/loiGiai/maKho/mucDoY', () => {
  ['adminBankMeta', 'adminBankList', 'adminBankSource', 'adminBankMatrix', 'adminBankToQuestions'].forEach((a) => {
    const r = g.call(a, { token: sTok, maKho: allCodes.slice(0, 1), nguon: 'Nguồn mẫu A' });
    assert(!r.ok && /^AUTH/.test(r.error), a + ': ' + r.error);
    const r2 = g.call(a, {});
    assert(!r2.ok && /^AUTH/.test(r2.error), a);
  });
  const mx = ok(g.call('adminBankMatrix', { token: tTok, lop: 'Lớp 12', seed: 3 }));
  const qs = ok(g.call('adminBankToQuestions', { token: tTok, maKho: mx.maKho })).questions;
  const id = ok(g.call('adminSaveExam', { token: tTok, exam: { tieuDe: 'Đề từ kho', trangThai: 'MO' }, questions: qs })).id;
  const s = ok(g.call('startExam', { token: sTok, examId: id }));
  assert.strictEqual(s.questions.length, 28);
  const txt = JSON.stringify(s);
  ['dapAn', 'loiGiai', 'maKho', 'mucDoY', 'chuong', 'nguon'].forEach((f) => assert(txt.indexOf('"' + f + '"') < 0, f));
  // Câu trong CauHoi có đủ cột mới
  const ex = ok(g.call('adminGetExam', { token: tTok, examId: id }));
  assert(ex.questions.every((q) => q.maKho && q.chuong && q.bai && q.nguon));
  assert(ex.questions.filter((q) => q.loai === 'DS').every((q) => q.mucDoY));
  // làm bài, chấm đúng
  const ans = {};
  ex.questions.forEach((q) => { ans[q.stt] = q.loai === 'DS' ? q.dapAn.split('') : q.dapAn; });
  const res = ok(g.call('submitExam', { token: sTok, attemptToken: s.attemptToken, answers: ans }));
  assert.strictEqual(res.diem, 10);
});

t('TC-2.11 kho 3 000 câu: 10 trang List + Meta + Matrix chỉ openById 1 lần; trang < 150 KB; ToQuestions 28 câu chỉ đọc hàng cần', () => {
  const W8 = world({ kho: { rows: K.bigRows(3000), missingImages: 0 } });
  clearCache(W8.g);
  W8.g._resetStats();
  ok(W8.g.call('adminBankMeta', { token: W8.tTok }));
  for (let p = 1; p <= 10; p++) {
    const r = W8.g.call('adminBankList', { token: W8.tTok, page: p, size: 100, filter: p % 2 ? {} : { loai: ['TN'] } });
    assert(r.ok, r.error);
    assert(Buffer.byteLength(JSON.stringify(r), 'utf8') < 150 * 1024);
    assert.strictEqual(r.data.items.length, 100);
  }
  const mx = ok(W8.g.call('adminBankMatrix', { token: W8.tTok }));
  assert.strictEqual(W8.g._stats.openById, 1);
  // đệm chỉ mục: kiểm tra kích thước nằm dưới ngưỡng 2 MB
  const heads = Object.keys(W8.g._cache).filter((x) => /^bk_[^_]+$/.test(x));
  assert.strictEqual(heads.length, 1);
  const len = +W8.g._cache[heads[0]].v.split(':')[1];
  assert(len < 2000000, 'chỉ mục ' + len);
  W8.g._resetStats();
  const r = ok(W8.g.call('adminBankToQuestions', { token: W8.tTok, maKho: mx.maKho }));
  assert.strictEqual(r.questions.length, 28);
  const cells = W8.g._stats.cells['Kho câu hỏi'];
  // chỉ đọc hàng tiêu đề (22 ô) + đúng 28 hàng × 22 cột
  assert(cells <= 22 + 28 * 22, 'đọc ' + cells + ' ô');
  assert.strictEqual(W8.g._stats.reads['Kho câu hỏi'] || 0, 0, 'không đọc cả trang (getDataRange)');
});

t('kho lớn hơn ngưỡng đệm: vẫn đúng, có cảnh báo; kho đổi tên cột: báo lỗi nêu tên cột', () => {
  const W9 = world({ kho: { rows: K.bigRows(3200), missingImages: 0 } });
  const m = ok(W9.g.call('adminBankMeta', { token: W9.tTok }));
  assert.strictEqual(m.tong, 3200);
  assert(m.canhBao.length === 1 && /3200/.test(m.canhBao[0]));
  const bad = [K.HEADER.map((h) => (h === 'Đáp án' ? 'Đáp số' : h))].concat(K.standardRows());
  const W10 = world();
  W10.g._external[W10.k.khoId]._sheets['Kho câu hỏi']._setData(bad);
  const r = W10.g.call('adminBankMeta', { token: W10.tTok, refresh: true });
  assert(!r.ok && /thiếu cột: "Đáp án"/.test(r.error), r.error);
});

t('chưa cấu hình kho / id sai: thông báo rõ; id dạng link cũng nhận', () => {
  const W11 = world();
  K.setSetting(W11.g, { KHO_CAU_HOI_ID: '' });
  const r = W11.g.call('adminBankMeta', { token: W11.tTok });
  assert(!r.ok && /KHO_CAU_HOI_ID/.test(r.error));
  K.setSetting(W11.g, { KHO_CAU_HOI_ID: 'https://docs.google.com/spreadsheets/d/' + W11.k.khoId + '/edit#gid=0' });
  assert.strictEqual(ok(W11.g.call('adminBankMeta', { token: W11.tTok })).tong, W11.k.rows.length);
  K.setSetting(W11.g, { KHO_CAU_HOI_ID: 'KHONG_CO_FILE_NAY' });
  const r2 = W11.g.call('adminBankMeta', { token: W11.tTok });
  assert(!r2.ok && /Không mở được kho/.test(r2.error) && /setup/.test(r2.error));
});

t('kho vừa đổi (chèn hàng) sau khi dựng chỉ mục: vẫn lấy đúng câu theo mã', () => {
  const W12 = world();
  const code = W12.k.rows[5][0];
  ok(W12.g.call('adminBankMeta', { token: W12.tTok }));
  const sh = W12.g._external[W12.k.khoId]._sheets['Kho câu hỏi'];
  const data = sh._data();
  sh._setData([data[0], K.row({ phan: 1, dapAn: 'A' })].concat(data.slice(1)));
  const r = ok(W12.g.call('adminBankToQuestions', { token: W12.tTok, maKho: [code] }));
  assert.strictEqual(r.questions.length, 1);
  assert.strictEqual(r.questions[0].maKho, code);
});

t('Sheet cũ thiếu các cột mới của CauHoi: vẫn đọc được, ghi thì tự thêm cột cuối', () => {
  const g2 = createContext({ quiet: true });
  g2.setup();
  const sh = g2._sheets.CauHoi;
  const data = sh._data();
  const oldLabels = ['Mã câu kho', 'Chương', 'Bài', 'Mức độ từng ý', 'Nguồn'];
  const keep = data[0].map((h, i) => (oldLabels.indexOf(h) < 0 ? i : -1)).filter((i) => i >= 0);
  sh._setData(data.map((r) => keep.map((i) => r[i])));
  clearCache(g2);
  const tok = ok(g2.call('loginAdminPassword', { password: pwOf(g2) })).token;
  const ex = ok(g2.call('adminGetExam', { token: tok, examId: 'DEMAU' }));
  assert.strictEqual(ex.questions.length, 6);
  assert(ex.questions.every((q) => q.maKho === '' && q.chuong === ''));
  const st = ok(g2.call('loginPin', { studentId: 'HS0001', pin: '0101' })).token;
  assert.strictEqual(ok(g2.call('startExam', { token: st, examId: 'DEMAU' })).questions.length, 6);
  ok(g2.call('adminSaveExam', { token: tok, exam: Object.assign(ex.exam, {}), questions: ex.questions }));
  const header = g2._sheets.CauHoi._data()[0];
  assert.deepStrictEqual(header.slice(-5), oldLabels);
});

t('features có "bank"; APP_VERSION 1.7.0; CaiDat có KHO_CAU_HOI_ID, THU_MUC_HINH_KHO_ID (setup chạy lại an toàn)', () => {
  const p = ok(g.call('publicConfig'));
  assert(p.features.indexOf('bank') >= 0);
  assert.strictEqual(p.version, '1.7.0');
  const g2 = createContext({ quiet: true });
  g2.setup(); g2.setup();
  const keys = g2._sheets.CaiDat._data().map((r) => r[0]);
  assert.strictEqual(keys.filter((x) => x === 'KHO_CAU_HOI_ID').length, 1);
  assert.strictEqual(keys.filter((x) => x === 'THU_MUC_HINH_KHO_ID').length, 1);
  const tok = ok(g2.call('loginAdminPassword', { password: pwOf(g2) })).token;
  ok(g2.call('adminSaveSettings', { token: tok, settings: { KHO_CAU_HOI_ID: 'abc' } }));
  assert(ok(g2.call('adminGetSettings', { token: tok })).some((r) => r.khoa === 'KHO_CAU_HOI_ID' && r.giaTri === 'abc'));
});

t('máy chủ 1.0.0 (fixture) không có adminBank*', () => {
  const old = createContext({ quiet: true, codePath: path.join(__dirname, 'fixtures', 'Code-1.0.0.gs') });
  old.setup();
  const r = old.call('adminBankMeta', {});
  assert(!r.ok && /Không có chức năng: adminBankMeta/.test(r.error));
});

// ---------- Vòng 2 ----------
t('R-4 Phần III nhận 1e-7, .5, ,5, -0,5 và ô kiểu số; chấm đúng', () => {
  ['1e-7', '6.4e-19', '.5', ',5', '-0,5', '3,0', '-120', '1,2|1,25'].forEach((a) => assert.strictEqual(g0.bankShort_(a), a, a));
  assert.strictEqual(g0.bankShort_(1e-7), '1e-7');
  assert.strictEqual(g0.bankShort_(0.5), '0.5');
  ['3 cm', 'x = 2', 'e5', '.'].forEach((a) => assert.strictEqual(g0.bankShort_(a), '', a));
  const q = g0.normalizeQuestion_(g0.bankToQuestion_(asRow(K.row({ phan: 3, dapAn: '1e-7' }))).q, 0);
  assert(g0.gradeOne_(q, '0,0000001').correct);
  assert(g0.gradeOne_(q, '1e-7').correct);
  const q2 = g0.normalizeQuestion_(g0.bankToQuestion_(asRow(K.row({ phan: 3, dapAn: '.5' }))).q, 0);
  assert(g0.gradeOne_(q2, '0,5').correct);
});

t('R-3 tên hình có dấu cách; ô "Có" không có tên file → cảnh báo theo mã câu', () => {
  assert.strictEqual(g0.bankImageName_('Có – hinh 1.png (02. HÌNH VẼ/Lớp 12)'), 'hinh 1.png');
  assert.strictEqual(g0.bankImageName_('Có – L12C2B11-P1-00001.png (02. HÌNH VẼ/Lớp 12/HINH_VE_Lop12_lan6)'), 'L12C2B11-P1-00001.png');
  assert.strictEqual(g0.bankImageName_('Có'), '');
  assert(g0.bankSaysImage_('Có') && g0.bankSaysImage_('Có – x.png') && !g0.bankSaysImage_('') && !g0.bankSaysImage_('Không'));
  const rows = [K.row({ phan: 1, dapAn: 'A' }), K.row({ phan: 1, dapAn: 'B' })];
  rows[0][15] = 'Có';                                  // không có tên file
  rows[1][15] = 'Có – hinh co dau cach.png (02. HÌNH VẼ/Lớp 12)';
  const W = world({ kho: { rows, missingImages: 0 } });
  const fid = W.g._drive.addFile('hinh co dau cach.png', W.k.folderId);
  const r = ok(W.g.call('adminBankToQuestions', { token: W.tTok, maKho: [rows[0][0], rows[1][0]] }));
  assert.strictEqual(r.questions.length, 2);
  assert.deepStrictEqual(r.thieuHinh, [rows[0][0]]);
  assert(r.canhBao.some((c) => c.indexOf(rows[0][0]) >= 0 && /không đọc được tên file/.test(c)));
  assert(r.questions[1].hinhAnh, 'tên có dấu cách vẫn tìm được hình');
  assert.strictEqual(W.g._drive.files[W.g._props['IMG_hinh co dau cach.png']].copyOf, fid);
  const list = ok(W.g.call('adminBankList', { token: W.tTok })).items;
  assert(list.every((x) => x.coHinh), 'chỉ mục đánh dấu có hình');
});

t('R-2 con trỏ bị lệch / hình không tìm thấy ở lượt trước → lượt cuối vẫn cảnh báo theo mã câu', () => {
  const W = world({ ctx: { makeCopyMs: 1000 }, kho: { rows: K.bigRows(60, { hinh: true }), missingImages: 3 } });
  const codes = W.k.rows.map((r) => r[0]);
  const r1 = ok(W.g.call('adminBankToQuestions', { token: W.tTok, maKho: codes }));
  assert.strictEqual(r1.tiepTuc, 40);
  assert(!r1.thieuHinh, 'lượt giữa chưa tổng kết');
  // giả lập con trỏ nhảy quá (kho đổi giữa hai lượt): bỏ qua 5 hình
  const r2 = ok(W.g.call('adminBankToQuestions', { token: W.tTok, maKho: codes, cursor: 45 }));
  assert.strictEqual(r2.tiepTuc, undefined);
  assert.strictEqual(r2.thieuHinh.length, 5 + 3, JSON.stringify(r2.thieuHinh));
  W.k.missingImages.forEach((n) => assert(r2.thieuHinh.indexOf(n.replace('.png', '')) >= 0));
  assert(r2.questions.filter((q) => !q.hinhAnh).length === 8);
});

t('R-7 bản chép công khai không lộ mã câu kho; máy chủ tính lại được', () => {
  const W = world();
  const m = W.k.rows.filter((r) => /^Có/.test(r[15]))[0][0];
  ok(W.g.call('adminBankToQuestions', { token: W.tTok, maKho: [m] }));
  const copy = W.g._drive.files[W.g._props['IMG_' + m + '.png']];
  assert(copy.name.indexOf(m) < 0 && !/L1[12]C/.test(copy.name), copy.name);
  assert(/^hinh-[0-9a-f]{12}\.png$/.test(copy.name), copy.name);
  assert.strictEqual(W.g.bankCopyName_(m + '.png'), copy.name);
  assert.notStrictEqual(W.g.bankCopyName_('a.png'), W.g.bankCopyName_('b.png'));
});

t('R-5 ma trận và Tạo đề cùng giới hạn; Meta trả gioiHan', () => {
  const r = g.call('adminBankMatrix', { token: tTok, so: { TN: 200, DS: 200, TL: 101 } });
  assert(!r.ok && /tối đa 500/.test(r.error));
  assert.strictEqual(ok(g.call('adminBankMeta', { token: tTok })).gioiHan, 500);
});

t('R-6 đọc Script Properties một lần mỗi lượt; R-8 "Đọc lại kho" làm mới bản đồ hình', () => {
  const W = world({ kho: { rows: K.bigRows(30, { hinh: true }), missingImages: 1 } });
  const codes = W.k.rows.map((r) => r[0]);
  W.g._resetStats();
  ok(W.g.call('adminBankToQuestions', { token: W.tTok, maKho: codes }));
  assert(W.g._stats.propReads <= 5, 'đọc Properties ' + W.g._stats.propReads);
  // thêm hình thiếu vào Drive → chưa "Đọc lại kho" thì vẫn dùng bản đồ cũ; đọc lại thì tìm thấy
  const miss = W.k.missingImages[0];
  W.g._drive.addFile(miss, W.k.folderId);
  const code = miss.replace('.png', '');
  assert(!ok(W.g.call('adminBankToQuestions', { token: W.tTok, maKho: [code] })).questions[0].hinhAnh);
  ok(W.g.call('adminBankMeta', { token: W.tTok, refresh: true }));
  assert(ok(W.g.call('adminBankToQuestions', { token: W.tTok, maKho: [code] })).questions[0].hinhAnh);
});

t('N-1 lấy câu: mỗi khối hàng liền nhau 1 lần getRange', () => {
  const W = world({ kho: { rows: K.bigRows(200), missingImages: 0 } });
  ok(W.g.call('adminBankMeta', { token: W.tTok }));
  const codes = [3, 4, 5, 50, 51, 120].map((i) => W.k.rows[i][0]);
  W.g._resetStats();
  const r = ok(W.g.call('adminBankToQuestions', { token: W.tTok, maKho: codes }));
  assert.strictEqual(r.questions.length, 6);
  // 1 lần đọc tiêu đề + 3 khối hàng
  assert.strictEqual(W.g._stats.ranges['Kho câu hỏi'], 4);
});

console.log(`\n${passed} kiểm thử đạt${failed ? ', ' + failed + ' LỖI' : ''}.`);
