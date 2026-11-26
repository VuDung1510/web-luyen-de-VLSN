// Kiểm thử độc lập Pha 7a (người kiểm thử) — phía máy chủ, viết theo docs/spec/pha-7-so-tay.md (TC-7.1 → 7.5, 7.7, 7.8).
// node tests/pha7a-kiem-thu.test.js
// Hộp đen: chỉ gọi API qua gas-shim (doPost) và đọc/sửa trang tính giả để dựng "dữ liệu cũ" (đổi ngày nộp, bỏ trường t/h).
// Câu hỏi tự soạn, không dùng nội dung thật. Học sinh thử: HS0001 (setup gieo) và một học sinh thêm qua adminSaveStudent.
const assert = require('assert');
const path = require('path');
const { createContext } = require('./gas-shim');
const K = require('./fixtures/kho-gia');

const results = [];
function t(name, fn) {
  try { fn(); results.push([name, true]); console.log('  ✓ ' + name); }
  catch (e) { results.push([name, false, e.message]); console.error('  ✗ ' + name + '\n    ' + (e.stack || e).split('\n').slice(0, 6).join('\n    ')); process.exitCode = 1; }
}
const info = (s) => console.log('      · ' + s);
function ok(r, what) { if (!r.ok) throw new Error((what || 'API') + ' lỗi: ' + r.error); return r.data; }
const pwOf = (g) => g._sheets.CaiDat._data().find((r) => r[0] === 'MAT_KHAU_QUAN_TRI')[1];
const clearCache = (g) => Object.keys(g._cache).forEach((k) => delete g._cache[k]);
const OFF_MSG = /Giáo viên đang tắt sổ tay/;

// ---------- Thế giới thử ----------
function world(opts = {}) {
  const g = createContext({ quiet: true, codePath: opts.codePath });
  g.setup();
  const kho = opts.bank ? K.install(g, { rows: opts.rows, missingImages: 0 }) : null;
  if (opts.bank) K.setSetting(g, { CHO_LUYEN_TAP: 'CO' });
  const tTok = ok(g.call('loginAdminPassword', { password: pwOf(g) })).token;
  const A = ok(g.call('loginPin', { studentId: 'HS0001', pin: '0101' })).token;
  const w = { g, kho, tTok, A, adm: (a, b) => g.call(a, Object.assign({ token: tTok }, b || {})) };
  if (opts.studentB !== false) {
    const ngaySinh = '01/02/2008'; // học sinh GIẢ; PIN mặc định = ddmm của ngày sinh
    const s = ok(w.adm('adminSaveStudent', { student: { hoTen: 'Học sinh B thử', lop: '12A1', ngaySinh } }));
    w.bId = s.id;
    w.B = ok(g.call('loginPin', { studentId: s.id, pin: ngaySinh.slice(0, 2) + ngaySinh.slice(3, 5) })).token;
  }
  if (opts.bank) {
    let cursor; let n = 0;
    for (;;) {
      const d = ok(w.adm('adminPracticeSync', { filter: {}, mode: 'them', cursor }), 'adminPracticeSync');
      if (d.tiepTuc == null || d.tiepTuc === '' || d.tiepTuc === false) break;
      cursor = d.tiepTuc; if (++n > 200) throw new Error('tiepTuc không dừng');
    }
  }
  return w;
}
// Câu tự soạn
const TN = (n, dapAn, extra) => Object.assign({ loai: 'TN', phan: 1, noiDung: `Câu trắc nghiệm tự soạn số ${n}: chọn phát biểu đúng về đại lượng x${n}.`, A: 'Phương án một', B: 'Phương án hai', C: 'Phương án ba', D: 'Phương án bốn', dapAn: dapAn || 'A', chuDe: 'Chủ đề thử', chuong: 'Chương I. Thử', bai: 'Bài 1. Thử', loiGiai: `Lời giải tự soạn câu ${n}: lập luận theo định nghĩa.` }, extra || {});
const DS = (n, dapAn, extra) => Object.assign({ loai: 'DS', phan: 2, noiDung: `Câu đúng/sai tự soạn số ${n}: xét bốn nhận định.`, A: 'Nhận định a', B: 'Nhận định b', C: 'Nhận định c', D: 'Nhận định d', dapAn: dapAn || 'ĐSĐS', chuDe: 'Chủ đề thử', chuong: 'Chương II. Thử', bai: 'Bài 2. Thử', loiGiai: `Lời giải tự soạn câu ĐS ${n}.` }, extra || {});
const TL = (n, dapAn, extra) => Object.assign({ loai: 'TL', phan: 3, noiDung: `Câu trả lời ngắn tự soạn số ${n}: tính đại lượng y${n}.`, dapAn: String(dapAn), saiSo: '0', chuDe: 'Chủ đề thử', chuong: 'Chương III. Thử', bai: 'Bài 3. Thử', loiGiai: `Lời giải tự soạn câu TL ${n}: y = ${dapAn}.` }, extra || {});

function mkExam(w, title, qs, ex) {
  return ok(w.adm('adminSaveExam', { exam: Object.assign({ tieuDe: title, lop: '12A1', thoiGian: 50, trangThai: 'MO', soLanLam: 0, hienLoiGiai: 'NGAY' }, ex || {}), questions: qs }), 'adminSaveExam').id;
}
function setExam(w, id, patch) {
  const ex = ok(w.adm('adminGetExam', { examId: id }));
  ok(w.adm('adminSaveExam', { exam: Object.assign({}, ex.exam, patch), questions: ex.questions }), 'sửa đề');
  clearCache(w.g);
}
function submit(w, tok, examId, answers) {
  const s = ok(w.g.call('startExam', { token: tok, examId }), 'startExam');
  return ok(w.g.call('submitExam', { token: tok, attemptToken: s.attemptToken, answers }), 'submitExam');
}
// Sửa trang tính để giả "dữ liệu cũ": đổi ngày nộp của hàng cuối, bỏ t/h trong chiTiet
function stampLast(w, sheet, when) {
  const d = w.g._sheets[sheet]._data(); const h = d[0];
  d[d.length - 1][h.indexOf('Nộp lúc')] = when;
  clearCache(w.g);
}
function makeOld(w, sheet) {
  const sh = w.g._sheets[sheet]; if (!sh) return 0;
  const d = sh._data(); const ci = d[0].indexOf('Chi tiết (JSON)'); let n = 0;
  for (let i = 1; i < d.length; i++) {
    if (!d[i][ci]) continue;
    d[i][ci] = JSON.stringify(JSON.parse(d[i][ci]).map((x) => { if ('t' in x || 'h' in x) n++; delete x.t; delete x.h; return x; }));
  }
  clearCache(w.g);
  return n;
}
const nb = (w, tok) => ok(w.g.call('notebook', { token: tok || w.A }), 'notebook');
const nbItem = (w, keys, tok) => w.g.call('notebookItem', { token: tok || w.A, keys });
const itemsOf = (d) => (d.items || []);
const byKey = (d) => { const m = {}; itemsOf(d).forEach((x) => { m[x.key] = x; }); return m; };
// Chuẩn hóa màu: chấp nhận do/vang/xanh, red/yellow/green, emoji
function color(v) {
  const s = String(v == null ? '' : v).toLowerCase();
  if (/do|đỏ|red|🔴/.test(s)) return 'do';
  if (/vang|vàng|yellow|amber|🟡/.test(s)) return 'vang';
  if (/xanh|green|🟢/.test(s)) return 'xanh';
  return s || '(trống)';
}
const loiOf = (it) => it && it.loi ? it.loi : {};
function forbidKeys(obj, keys) {
  const j = JSON.stringify(obj);
  const bad = keys.filter((k) => new RegExp('"' + k + '"\\s*:').test(j));
  return bad;
}
function contentOf(d) {
  // nội dung trả về từ notebookItem: chấp nhận mảng items hoặc map theo key
  if (Array.isArray(d)) return d;
  if (d && Array.isArray(d.items)) return d.items;
  if (d && typeof d === 'object') return Object.keys(d).map((k) => Object.assign({ key: k }, d[k]));
  return [];
}

// =====================================================================
console.log('\nTC-7.1 — dữ liệu cũ, gộp theo key, màu §4');
// =====================================================================
t('TC-7.1 bài cũ (không t/h): liệt kê mọi câu từng sai, gộp theo key, màu đỏ/vàng/xanh đúng §4', () => {
  const w = world({ studentB: false });
  // E1: Q1 TN, Q2 TN, Q3 TN, Q4 DS, Q5 TL
  const e1 = mkExam(w, 'Đề cũ một', [TN(1, 'A'), TN(2, 'B'), TN(3, 'C'), DS(4, 'ĐSĐS'), TL(5, '12')]);
  // E2: Q1 TN (xanh sau 2 ngày), Q2 TN luôn đúng
  const e2 = mkExam(w, 'Đề cũ hai', [TN(11, 'D'), TN(12, 'A')]);
  const W = 'C';
  // Lần 1 — 01/11
  submit(w, w.A, e1, { 1: W, 2: W, 3: 'C', 4: ['D', 'S', 'D', 'D'], 5: '13' }); stampLast(w, 'KetQua', '01/11/2026 08:00:00');
  submit(w, w.A, e2, { 1: 'A', 2: 'A' }); stampLast(w, 'KetQua', '01/11/2026 09:00:00');
  // Lần 2 — 02/11 sáng
  submit(w, w.A, e1, { 1: 'A', 2: W, 3: 'C', 4: ['D', 'S', 'D', 'D'], 5: '12' }); stampLast(w, 'KetQua', '02/11/2026 08:00:00');
  submit(w, w.A, e2, { 1: 'D', 2: 'A' }); stampLast(w, 'KetQua', '02/11/2026 09:00:00');
  // Lần 3 — 02/11 chiều (cùng ngày lần 2)
  submit(w, w.A, e1, { 1: 'A', 2: W, 3: 'A', 4: ['D', 'S', 'D', 'S'], 5: '14' }); stampLast(w, 'KetQua', '02/11/2026 15:00:00');
  // E2 lần 3 — 03/11
  submit(w, w.A, e2, { 1: 'D', 2: 'A' }); stampLast(w, 'KetQua', '03/11/2026 09:00:00');
  const stripped = makeOld(w, 'KetQua');
  info('đã bỏ t/h khỏi ' + stripped + ' mục chiTiet (giả dữ liệu trước Pha 7)');
  const d = nb(w);
  const m = byKey(d);
  const keys = Object.keys(m).sort();
  const want = [e1 + '#1', e1 + '#2', e1 + '#3', e1 + '#4', e1 + '#5', e2 + '#1'].sort();
  assert.deepStrictEqual(keys, want, 'danh sách key: ' + JSON.stringify(keys));
  const col = {}; keys.forEach((k) => { col[k] = color(m[k].mau); });
  info('màu: ' + JSON.stringify(col));
  assert.strictEqual(col[e1 + '#1'], 'vang', 'Q1: sai rồi đúng 2 lần cùng ngày → vàng');
  assert.strictEqual(col[e1 + '#2'], 'do', 'Q2: luôn sai → đỏ');
  assert.strictEqual(col[e1 + '#3'], 'do', 'Q3: đúng, đúng, rồi sai lại → đỏ');
  assert.strictEqual(col[e1 + '#4'], 'vang', 'Q4 (Phần II 3/4 rồi 4/4): đúng 1 lần → vàng');
  assert.strictEqual(col[e1 + '#5'], 'do', 'Q5: sai, đúng, sai lại → đỏ');
  assert.strictEqual(col[e2 + '#1'], 'xanh', 'E2 Q1: đúng ngày 02 và 03 → xanh');
  assert.strictEqual(+m[e1 + '#2'].lanSai, 3, 'Q2 lanSai = 3, được ' + m[e1 + '#2'].lanSai);
  assert.strictEqual(+m[e1 + '#5'].lanSai, 2, 'Q5 lanSai = 2, được ' + m[e1 + '#5'].lanSai);
  assert.strictEqual(+m[e1 + '#3'].lanSai, 1, 'Q3 lanSai = 1');
  // nguồn đề có tên đề
  assert(m[e1 + '#2'].nguon && m[e1 + '#2'].nguon.examId === e1, 'nguon.examId');
  assert.strictEqual(+m[e1 + '#2'].phan, 1); assert.strictEqual(+m[e1 + '#4'].phan, 2); assert.strictEqual(+m[e1 + '#5'].phan, 3);
});

t('TC-7.1 (biên) Phần II đúng 3/4 ý vẫn là sai; câu luôn đúng không có trong sổ', () => {
  const w = world({ studentB: false });
  const e = mkExam(w, 'Đề biên PII', [DS(1, 'ĐĐĐĐ'), TN(2, 'B')]);
  submit(w, w.A, e, { 1: ['D', 'D', 'D', 'S'], 2: 'B' });
  const m = byKey(nb(w));
  assert(m[e + '#1'], 'Phần II 3/4 phải có trong sổ');
  assert(!m[e + '#2'], 'câu đúng không được có trong sổ');
});

t('TC-7.1 (gộp) cùng một câu sai ở đề thi rồi làm đúng ở bài luyện CAU_SAI → một mục, màu vàng', () => {
  const w = world({ studentB: false });
  K.setSetting(w.g, { CHO_LUYEN_TAP: 'CO' });
  const e = mkExam(w, 'Đề đã đóng', [TN(1, 'B'), TN(2, 'C')]);
  submit(w, w.A, e, { 1: 'A', 2: 'C' }); stampLast(w, 'KetQua', '05/11/2026 08:00:00');
  setExam(w, e, { trangThai: 'DONG' });
  const p = w.g.call('practiceStart', { token: w.A, kieu: 'CAU_SAI' });
  if (!p.ok) { info('practiceStart CAU_SAI: ' + p.error + ' — bỏ qua phần gộp với luyện tập'); return; }
  const qs = p.data.questions;
  assert.strictEqual(qs.length, 1, 'CAU_SAI có 1 câu');
  ok(w.g.call('submitExam', { token: w.A, attemptToken: p.data.attemptToken, answers: { [qs[0].stt || 1]: 'B' } }));
  stampLast(w, 'KetQuaLuyenTap', '06/11/2026 08:00:00');
  const d = nb(w);
  const its = itemsOf(d).filter((x) => x.key === e + '#1');
  assert.strictEqual(its.length, 1, 'gộp theo key: 1 mục, được ' + itemsOf(d).map((x) => x.key));
  assert.strictEqual(color(its[0].mau), 'vang');
  assert.strictEqual(itemsOf(d).length, 1);
});

// =====================================================================
console.log('\nTC-7.2 — không lộ đáp án');
// =====================================================================
function leakWorld() {
  const w = world({ studentB: false });
  const qs = [TN(1, 'B'), DS(2, 'ĐSĐS'), TL(3, '25')];
  const eNgay = mkExam(w, 'Đề mở NGAY', qs);
  const eSau = mkExam(w, 'Đề mở SAU_HAN', [TN(21, 'B'), TL(22, '7')], { hienLoiGiai: 'SAU_HAN' });
  const eKhong = mkExam(w, 'Đề KHONG', [TN(31, 'C'), TL(32, '9')], { hienLoiGiai: 'KHONG' });
  submit(w, w.A, eNgay, { 1: 'A', 2: ['S', 'S', 'D', 'S'], 3: '0,25' });
  submit(w, w.A, eSau, { 1: 'A', 2: '8' });
  submit(w, w.A, eKhong, { 1: 'A', 2: '1' });
  return { w, eNgay, eSau, eKhong };
}
const SECRET_TEXT = /Lời giải tự soạn/;
t('TC-7.2 notebook không chứa noiDung, dapAn, loiGiai (cả khóa lẫn chữ lời giải)', () => {
  const { w, eNgay } = leakWorld();
  setExam(w, eNgay, { trangThai: 'DONG' }); // kể cả đề đã công bố
  const d = nb(w);
  assert(itemsOf(d).length >= 7, 'có đủ câu sai, được ' + itemsOf(d).length);
  const bad = forbidKeys(d, ['noiDung', 'dapAn', 'loiGiai', 'A', 'B']);
  assert.deepStrictEqual(bad, [], 'notebook có khóa cấm: ' + bad);
  const j = JSON.stringify(d);
  assert(!SECRET_TEXT.test(j) && !/tự soạn số/.test(j), 'notebook có chữ của câu/lời giải');
});
t('TC-7.2 notebookItem đề đang mở (NGAY, SAU_HAN) và đề KHONG đã đóng: có nội dung + đáp án em chọn, KHÔNG có dapAn/loiGiai', () => {
  const { w, eNgay, eSau, eKhong } = leakWorld();
  setExam(w, eKhong, { trangThai: 'DONG' });
  const keys = [eNgay + '#1', eNgay + '#2', eNgay + '#3', eSau + '#1', eSau + '#2', eKhong + '#1', eKhong + '#2'];
  const r = nbItem(w, keys); const d = ok(r, 'notebookItem');
  const arr = contentOf(d);
  assert.strictEqual(arr.length, keys.length, 'đủ ' + keys.length + ' câu, được ' + arr.length);
  const bad = forbidKeys(d, ['dapAn', 'loiGiai']);
  const j = JSON.stringify(d);
  assert.deepStrictEqual(bad, [], 'lộ khóa: ' + bad);
  assert(!SECRET_TEXT.test(j), 'lộ chữ lời giải');
  assert(/tự soạn số 1/.test(j) && /tự soạn số 21/.test(j) && /tự soạn số 31/.test(j), 'thiếu nội dung câu');
  assert(/0,25|0\.25/.test(j), 'thiếu đáp án em chọn (Phần III 0,25)');
});
t('TC-7.2 đóng đề NGAY (có lời giải) → notebookItem có dapAn và loiGiai; đề SAU_HAN đóng cũng có', () => {
  const { w, eNgay, eSau } = leakWorld();
  setExam(w, eNgay, { trangThai: 'DONG' });
  setExam(w, eSau, { trangThai: 'DONG' });
  const d = ok(nbItem(w, [eNgay + '#1', eNgay + '#3', eSau + '#2']));
  const j = JSON.stringify(d);
  assert.deepStrictEqual(forbidKeys(d, ['dapAn', 'loiGiai']).length, 2, 'phải có dapAn và loiGiai');
  assert(/Lời giải tự soạn câu 1/.test(j) && /Lời giải tự soạn câu TL 22/.test(j), 'thiếu lời giải đúng câu');
});
t('TC-7.2 (biên) đề hết hạn theo giờ (ketThuc đã qua, SAU_HAN) → công bố; đề NHAP lại (nháp) → ẩn', () => {
  const { w, eSau, eNgay } = leakWorld();
  setExam(w, eSau, { ketThuc: '01/01/2020 00:00:00' });
  const d1 = ok(nbItem(w, [eSau + '#1']));
  assert(forbidKeys(d1, ['dapAn']).length === 1, 'đề hết hạn SAU_HAN phải hiện đáp án');
  setExam(w, eNgay, { trangThai: 'NHAP' });
  const d2 = ok(nbItem(w, [eNgay + '#1']));
  assert.deepStrictEqual(forbidKeys(d2, ['dapAn', 'loiGiai']), [], 'đề nháp không được hiện đáp án');
});
t('TC-7.2 (biên) câu kho sai ở bài luyện, sau đó nằm trong đề đang mở → notebookItem ẩn đáp án; đóng đề thì hiện', () => {
  const rows = [K.row({ phan: 1, cau: 1, dapAn: 'B', noiDung: 'Câu kho tự soạn X: chọn phương án đúng.', loiGiai: 'Lời giải kho X tự soạn.' }),
    K.row({ phan: 1, cau: 2, dapAn: 'C', noiDung: 'Câu kho tự soạn Y: chọn phương án đúng.', loiGiai: 'Lời giải kho Y tự soạn.' })]
    .concat([3, 4, 5].map((c) => K.row({ phan: 1, cau: c, dapAn: 'D', noiDung: 'Câu kho tự soạn Z' + c + '.', loiGiai: 'Lời giải kho Z tự soạn.' })));
  const w = world({ bank: true, rows, studentB: false });
  const p = ok(w.g.call('practiceStart', { token: w.A, kieu: 'TU_TAO', so: { TN: 5 }, phut: 5 }), 'practiceStart');
  const ans = {}; p.questions.forEach((q, i) => { ans[q.stt || i + 1] = 'A'; });
  ok(w.g.call('submitExam', { token: w.A, attemptToken: p.attemptToken, answers: ans }));
  const X = rows[0][0];
  const m = byKey(nb(w));
  assert(m[X], 'key = mã kho X, được ' + Object.keys(m));
  const before = ok(nbItem(w, [X]));
  assert.strictEqual(forbidKeys(before, ['dapAn']).length, 1, 'câu luyện tập (chưa bị chặn) phải có đáp án');
  // đưa X vào đề đang mở
  const qs = ok(w.adm('adminBankToQuestions', { maKho: [X] })).questions;
  const e = mkExam(w, 'Đề mở có câu kho', qs);
  clearCache(w.g);
  const during = ok(nbItem(w, [X]));
  assert.deepStrictEqual(forbidKeys(during, ['dapAn', 'loiGiai']), [], 'câu kho trong đề đang mở bị lộ đáp án');
  assert(!/Lời giải kho X/.test(JSON.stringify(during)));
  setExam(w, e, { trangThai: 'DONG' });
  const after = ok(nbItem(w, [X]));
  assert.strictEqual(forbidKeys(after, ['dapAn']).length, 1, 'đóng đề thì hiện lại');
});
t('TC-7.2 (biên) notebookItem > 20 key bị từ chối hoặc cắt còn ≤ 20', () => {
  const { w, eNgay } = leakWorld();
  const keys = Array.from({ length: 25 }, (_, i) => eNgay + '#' + (i + 1));
  const r = nbItem(w, keys);
  if (!r.ok) { info('từ chối: ' + r.error); return; }
  assert(contentOf(r.data).length <= 20, 'trả ' + contentOf(r.data).length + ' mục');
});

// =====================================================================
console.log('\nTC-7.3 — máy đoán loại lỗi');
// =====================================================================
function guessWorld(hien) {
  const w = world({ studentB: false });
  const e = mkExam(w, 'Đề máy đoán', [
    TL(1, '25'), TL(2, '2,5'), TL(3, '7'), DS(4, 'ĐSĐS'), TN(5, 'B'),
    TL(6, '30|25'), TL(7, '-2,5'), TL(8, '0'), TL(9, '25'), DS(10, 'ĐSĐS'), TL(11, '4'), TL(12, '25')
  ], { hienLoiGiai: hien || 'NGAY' });
  submit(w, w.A, e, {
    1: '0,25', 2: '2,48', 3: '', 4: ['D', 'S', 'D', 'D'], 5: 'A',
    6: '0,25', 7: '2,5', 8: '5', 9: '0', 10: ['D', 'S', '', 'S'], 11: '4,3', 12: '2500'
  });
  return { w, e };
}
const L = (m, k) => loiOf(m[k]);
const sure = (l) => l.canHoi === false || l.canHoi === 0 || l.canHoi == null;
t('TC-7.3 đề đã công bố: 0,25/25 → TINH_TOAN/DON_VI chắc; 2,48/2,5 → BAM_MAY cần hỏi; trống → SOT chắc; PII sai 1 ý → SOT hỏi; PI sai → CHUA_RO', () => {
  const { w, e } = guessWorld();
  setExam(w, e, { trangThai: 'DONG' });
  const m = byKey(nb(w));
  const g = (i) => L(m, e + '#' + i);
  info('câu 1..5: ' + [1, 2, 3, 4, 5].map((i) => JSON.stringify(g(i))).join(' | '));
  assert.strictEqual(g(1).ma, 'TINH_TOAN'); assert.strictEqual(g(1).y, 'DON_VI'); assert(sure(g(1)) && g(1).canHoi === false, 'DON_VI phải chắc (canHoi=false)');
  assert.strictEqual(g(2).ma, 'TINH_TOAN'); assert.strictEqual(g(2).y, 'BAM_MAY'); assert.strictEqual(g(2).canHoi, true, 'BAM_MAY cần hỏi');
  assert.strictEqual(g(3).ma, 'SOT'); assert.strictEqual(g(3).canHoi, false, 'bỏ trống chắc');
  assert.strictEqual(g(4).ma, 'SOT'); assert.strictEqual(g(4).canHoi, true, 'PII sai 1 ý cần hỏi');
  assert.strictEqual(g(5).ma, 'CHUA_RO');
  [1, 2, 3, 4].forEach((i) => assert.strictEqual(g(i).nguon, 'MAY', 'câu ' + i + ' nguồn MAY'));
});
t('TC-7.3 (biên) nhiều đáp án "|", ngược dấu, đáp án 0, em trả 0, PII còn ý trống, lệch >10%, lệch 10² lần', () => {
  const { w, e } = guessWorld();
  setExam(w, e, { trangThai: 'DONG' });
  const m = byKey(nb(w));
  const g = (i) => L(m, e + '#' + i);
  info('câu 6..12: ' + [6, 7, 8, 9, 10, 11, 12].map((i) => i + '=' + JSON.stringify(g(i))).join(' | '));
  assert.strictEqual(g(6).y, 'DON_VI', '"30|25", em 0,25 → DON_VI (khớp một đáp án)');
  assert.strictEqual(g(7).ma, 'TINH_TOAN'); assert.strictEqual(g(7).y, 'BAM_MAY', 'ngược dấu → BAM_MAY'); assert.strictEqual(g(7).canHoi, true);
  assert.notStrictEqual(g(8).y, 'DON_VI', 'đáp án đúng 0: không chia cho 0 ra DON_VI');
  assert(g(8).ma, 'câu 8 vẫn có loại lỗi (không vỡ)');
  assert.notStrictEqual(g(9).y, 'DON_VI', 'em trả 0: không phải 10ⁿ');
  assert.strictEqual(g(10).ma, 'SOT'); assert.strictEqual(g(10).canHoi, false, 'PII còn ý trống → SOT chắc');
});
t('TC-7.3 (biên) lệch 7,5% (4,3/4) → BAM_MAY hỏi; 2500/25 = 10² → DON_VI chắc', () => {
  const { w, e } = guessWorld();
  setExam(w, e, { trangThai: 'DONG' });
  const m = byKey(nb(w));
  const g = (i) => L(m, e + '#' + i);
  assert.strictEqual(g(11).y, 'BAM_MAY', '4,3 vs 4: lệch 7,5% ≤ 10% → BAM_MAY, được ' + JSON.stringify(g(11)));
  assert.strictEqual(g(12).y, 'DON_VI', '2500 vs 25 → DON_VI, được ' + JSON.stringify(g(12)));
  assert.strictEqual(g(12).canHoi, false);
});
t('TC-7.3 (không lộ) đề còn mở: chỉ đoán SOT cho câu bỏ trống; câu cần so đáp án là CHUA_RO', () => {
  const { w, e } = guessWorld();
  const m = byKey(nb(w));
  const g = (i) => L(m, e + '#' + i);
  info('đề mở: ' + [1, 2, 3, 4, 10].map((i) => i + '=' + (g(i).ma + '/' + (g(i).y || ''))).join(' '));
  [1, 2, 4, 6, 7, 11, 12].forEach((i) => assert.strictEqual(g(i).ma, 'CHUA_RO', 'câu ' + i + ' lộ qua máy đoán: ' + JSON.stringify(g(i))));
  assert.strictEqual(g(3).ma, 'SOT');
  assert.strictEqual(g(10).ma, 'SOT', 'PII còn ý trống (không cần đáp án) → SOT');
  assert(!JSON.stringify(nb(w)).includes('DON_VI'), 'không có DON_VI khi đề mở');
});
t('TC-7.3 (không lộ) đề KHONG đã đóng: vẫn không đoán bằng đáp án', () => {
  const { w, e } = guessWorld('KHONG');
  setExam(w, e, { trangThai: 'DONG' });
  const m = byKey(nb(w));
  [1, 2, 4, 7, 12].forEach((i) => assert.strictEqual(L(m, e + '#' + i).ma, 'CHUA_RO', 'câu ' + i));
  assert.strictEqual(L(m, e + '#3').ma, 'SOT');
});

// =====================================================================
console.log('\nTC-7.4 — ngưỡng Lặp lại');
// =====================================================================
function sotOf(d) {
  const a = (d.tongHop && d.tongHop.saiNgoo) || [];
  return a.find((x) => x.ma === 'SOT') || null;
}
t('TC-7.4 3 câu đỏ cùng loại (SOT) ở 2 đề → loại lỗi đỏ "Lặp lại"', () => {
  const w = world({ studentB: false });
  const a = mkExam(w, 'Đề lặp A', [TL(1, '5'), TL(2, '6')]);
  const b = mkExam(w, 'Đề lặp B', [TL(3, '7'), TN(4, 'A')]);
  submit(w, w.A, a, { 1: '', 2: '' }); submit(w, w.A, b, { 1: '', 2: 'A' });
  const d = nb(w); const s = sotOf(d);
  info('SOT: ' + JSON.stringify(s));
  assert(s, 'thiếu SOT trong tongHop.saiNgoo');
  assert.strictEqual(+s.so, 3); assert.strictEqual(color(s.mau), 'do');
});
t('TC-7.4 3 câu đỏ cùng 1 đề → chỉ vàng', () => {
  const w = world({ studentB: false });
  const a = mkExam(w, 'Đề một mình', [TL(1, '5'), TL(2, '6'), TL(3, '7')]);
  submit(w, w.A, a, { 1: '', 2: '', 3: '' });
  const s = sotOf(nb(w));
  assert.strictEqual(+s.so, 3); assert.strictEqual(color(s.mau), 'vang', JSON.stringify(s));
});
t('TC-7.4 (biên) 2 câu đỏ ở 2 đề → vàng; 3 câu ở 2 đề nhưng 1 câu đã đúng lại → chỉ còn 2 đỏ → vàng; tất cả xanh → xanh', () => {
  const w = world({ studentB: false });
  const a = mkExam(w, 'Đề biên A', [TL(1, '5'), TL(2, '6')]);
  const b = mkExam(w, 'Đề biên B', [TL(3, '7')]);
  submit(w, w.A, a, { 1: '', 2: '6' }); stampLast(w, 'KetQua', '01/11/2026 08:00:00');
  submit(w, w.A, b, { 1: '' }); stampLast(w, 'KetQua', '01/11/2026 09:00:00');
  assert.strictEqual(color(sotOf(nb(w)).mau), 'vang', '2 đỏ / 2 đề');
  submit(w, w.A, a, { 1: '', 2: '' }); stampLast(w, 'KetQua', '02/11/2026 08:00:00');
  assert.strictEqual(color(sotOf(nb(w)).mau), 'do', 'giờ 3 đỏ / 2 đề');
  submit(w, w.A, b, { 1: '7' }); stampLast(w, 'KetQua', '03/11/2026 08:00:00');
  assert.strictEqual(color(sotOf(nb(w)).mau), 'vang', 'câu đề B vàng → còn 2 đỏ');
  submit(w, w.A, a, { 1: '5', 2: '6' }); stampLast(w, 'KetQua', '04/11/2026 08:00:00');
  submit(w, w.A, a, { 1: '5', 2: '6' }); stampLast(w, 'KetQua', '05/11/2026 08:00:00');
  submit(w, w.A, b, { 1: '7' }); stampLast(w, 'KetQua', '05/11/2026 09:00:00');
  const s = sotOf(nb(w));
  assert.strictEqual(color(s.mau), 'xanh', 'mọi câu xanh → loại lỗi xanh: ' + JSON.stringify(s));
});

// =====================================================================
console.log('\nTC-7.5 — tách dữ liệu học sinh');
// =====================================================================
t('TC-7.5 token A với key của B: notebook không có câu B; notebookItem không trả nội dung câu B', () => {
  const w = world();
  const eb = mkExam(w, 'Đề chỉ B làm', [TN(51, 'A'), TL(52, '3')]);
  const ea = mkExam(w, 'Đề cả hai làm', [TN(61, 'A'), TN(62, 'B')]);
  submit(w, w.B, eb, { 1: 'B', 2: '4' });
  submit(w, w.B, ea, { 1: 'B', 2: 'C' }); // B sai cả hai
  submit(w, w.A, ea, { 1: 'B', 2: 'B' }); // A sai câu 1, đúng câu 2
  setExam(w, eb, { trangThai: 'DONG' }); setExam(w, ea, { trangThai: 'DONG' });
  const na = byKey(nb(w, w.A));
  assert.deepStrictEqual(Object.keys(na), [ea + '#1'], 'notebook A chỉ có ' + ea + '#1, được ' + Object.keys(na));
  const nB = byKey(nb(w, w.B));
  assert.strictEqual(Object.keys(nB).length, 4);
  const r = nbItem(w, [eb + '#1', eb + '#2', ea + '#2'], w.A);
  const j = JSON.stringify(r);
  info('A xin key của B: ' + (r.ok ? 'ok, ' + contentOf(r.data).length + ' mục' : 'lỗi "' + r.error + '"'));
  assert(!/tự soạn số 51|tự soạn số 52|tự soạn số 62/.test(j), 'lộ nội dung câu của B / câu A không sai');
  assert(!/Lời giải tự soạn/.test(j), 'lộ lời giải');
  // B sai câu 62 → B xin được
  const rb = ok(nbItem(w, [ea + '#2'], w.B));
  assert(/tự soạn số 62/.test(JSON.stringify(rb)), 'B phải đọc được câu sai của mình');
});
t('TC-7.5 (biên) gửi kèm studentId của B / không token / token giáo viên → không lấy được sổ của B', () => {
  const w = world();
  const e = mkExam(w, 'Đề B', [TN(71, 'A')]);
  submit(w, w.B, e, { 1: 'C' });
  const r1 = w.g.call('notebook', { token: w.A, studentId: w.bId });
  assert(r1.ok && itemsOf(r1.data).length === 0, 'studentId trong body bị dùng: ' + JSON.stringify(r1).slice(0, 200));
  const r2 = w.g.call('notebook', {});
  assert(!r2.ok, 'không token phải lỗi');
  const r3 = w.g.call('notebookItem', { keys: [e + '#1'] });
  assert(!r3.ok, 'notebookItem không token phải lỗi');
  const r4 = w.g.call('notebookItem', { token: w.A, studentId: w.bId, keys: [e + '#1'] });
  assert(!/tự soạn số 71/.test(JSON.stringify(r4)), 'lộ câu B qua studentId');
});

// =====================================================================
console.log('\nTC-7.7 — tắt sổ tay / máy chủ cũ');
// =====================================================================
t('TC-7.7 BAT_SO_TAY = KHONG: notebook, notebookItem (và notebookTag/notebookNote nếu có) đều báo "Giáo viên đang tắt sổ tay"', () => {
  const w = world({ studentB: false });
  const e = mkExam(w, 'Đề tắt', [TN(1, 'A')]);
  submit(w, w.A, e, { 1: 'B' });
  assert(nb(w).items.length === 1);
  K.setSetting(w.g, { BAT_SO_TAY: 'KHONG' }); clearCache(w.g);
  for (const [a, b] of [['notebook', {}], ['notebookItem', { keys: [e + '#1'] }], ['notebookTag', { items: [{ key: e + '#1', ma: 'SOT' }] }], ['notebookNote', { key: '_CHUNG', text: 'x' }]]) {
    const r = w.g.call(a, Object.assign({ token: w.A }, b));
    if (!r.ok && /Không có chức năng/.test(r.error)) { info(a + ': chưa có ở 7a (Không có chức năng) — bỏ qua'); continue; }
    assert(!r.ok && OFF_MSG.test(r.error), a + ' phải báo tắt, được ' + JSON.stringify(r).slice(0, 160));
  }
  const pc = ok(w.g.call('publicConfig', {}));
  info('publicConfig khi tắt: features ' + JSON.stringify(pc.features) + ', notebook=' + JSON.stringify(pc.notebook));
  assert(pc.notebook === false || pc.notebook === 'KHONG' || (pc.features || []).indexOf('notebook') < 0, 'publicConfig phải cho giao diện biết sổ tay đang tắt');
  // bật lại
  K.setSetting(w.g, { BAT_SO_TAY: 'CO' }); clearCache(w.g);
  assert(nb(w).items.length === 1, 'bật lại thì chạy');
});
t('TC-7.7 (biên) CaiDat thiếu khóa BAT_SO_TAY (Sheet cũ) → coi là bật', () => {
  const w = world({ studentB: false });
  const d = w.g._sheets.CaiDat._data();
  const i = d.findIndex((r) => r[0] === 'BAT_SO_TAY'); d.splice(i, 1); clearCache(w.g);
  assert(Array.isArray(nb(w).items));
});
t('TC-7.7 máy chủ 1.0.0 (fixture) và 1.5.0 (git 36e9d9f): không có "notebook" trong features, action báo "Không có chức năng"', () => {
  const fs = require('fs');
  const p150 = path.join(__dirname, 'fixtures', 'Code-1.5.0.gs');
  if (!fs.existsSync(p150)) {
    const src = require('child_process').execSync('git show 36e9d9f:apps-script/Code.gs', { cwd: path.join(__dirname, '..'), maxBuffer: 1 << 26 }).toString();
    fs.writeFileSync(p150, src);
  }
  for (const [v, p] of [['1.0.0', path.join(__dirname, 'fixtures', 'Code-1.0.0.gs')], ['1.5.0', p150]]) {
    const g = createContext({ quiet: true, codePath: p });
    g.setup();
    const pc = g.call('publicConfig', {});
    const f = (pc.data && pc.data.features) || [];
    assert(f.indexOf('notebook') < 0, v + ' có notebook?');
    const r = g.call('notebook', { token: 'x' });
    assert(!r.ok && /Không có chức năng/.test(r.error), v + ': ' + JSON.stringify(r));
    info(v + ': features=' + JSON.stringify(f) + '; notebook → "' + r.error + '"');
  }
});

// =====================================================================
console.log('\nTC-7.8 — Sheet cũ chưa có SoTay, CongThuc');
// =====================================================================
t('TC-7.8 Sheet cũ không có SoTay/CongThuc: notebook, notebookItem chạy; chỉ đọc không tạo trang; setup() tạo đúng tiêu đề, chạy lại an toàn', () => {
  const w = world({ studentB: false });
  const e = mkExam(w, 'Đề Sheet cũ', [TN(1, 'A'), TL(2, '3')], { trangThai: 'MO' });
  submit(w, w.A, e, { 1: 'B', 2: '' });
  const ss = w.g.SpreadsheetApp.getActiveSpreadsheet();
  ['SoTay', 'CongThuc'].forEach((n) => ss.deleteSheet(w.g._sheets[n]));
  clearCache(w.g);
  const d = nb(w);
  assert.strictEqual(d.items.length, 2);
  ok(nbItem(w, [e + '#1', e + '#2']), 'notebookItem');
  assert(!w.g._sheets.SoTay && !w.g._sheets.CongThuc, 'đọc mà tự tạo trang tính');
  // Lần ghi đầu (nếu đã có action ghi ở 7a)
  const r = w.g.call('notebookNote', { token: w.A, key: '_CHUNG', text: 'Ghi chú thử' });
  if (r.ok) {
    assert(w.g._sheets.SoTay, 'ghi lần đầu phải tạo SoTay');
    assert.deepStrictEqual(w.g._sheets.SoTay._data()[0].map(String), JSON.parse(JSON.stringify(w.g.SCHEMA.SoTay.map((x) => x[1]))));
  } else info('notebookNote: ' + r.error + ' (ghi SoTay thuộc 7b — kiểm phần ghi ở 7b)');
  w.g.setup();
  for (const n of ['SoTay', 'CongThuc']) {
    assert(w.g._sheets[n], 'setup phải tạo ' + n);
    assert.deepStrictEqual(w.g._sheets[n]._data()[0].map(String).filter(Boolean), JSON.parse(JSON.stringify(w.g.SCHEMA[n].map((x) => x[1]))), 'tiêu đề ' + n);
  }
  // CongThuc có dữ liệu giáo viên, chạy lại setup không mất
  w.g._sheets.CongThuc._data().push(['Bài 3. Thử', 'Công thức thử', 'y=2x', 'Gợi nhớ thử', 'Phạm vi thử', 'Dấu hiệu thử', 'CO']);
  w.g.setup();
  assert.strictEqual(w.g._sheets.CongThuc._data().length, 2, 'setup lần 2 làm mất hàng CongThuc');
  assert.strictEqual(w.g._sheets.CongThuc._data()[0].filter(Boolean).length, 7, 'setup lần 2 thêm cột trùng');
  clearCache(w.g);
  assert.strictEqual(nb(w).items.length, 2);
});
t('TC-7.8 (biên) KetQuaLuyenTap chưa có (Sheet trước Pha 4) → notebook vẫn chạy', () => {
  const w = world({ studentB: false });
  const e = mkExam(w, 'Đề trước Pha 4', [TN(1, 'A')]);
  submit(w, w.A, e, { 1: 'B' });
  const ss = w.g.SpreadsheetApp.getActiveSpreadsheet();
  ['SoTay', 'CongThuc', 'KetQuaLuyenTap', 'LuyenTap'].forEach((n) => w.g._sheets[n] && ss.deleteSheet(w.g._sheets[n]));
  makeOld(w, 'KetQua');
  clearCache(w.g);
  assert.strictEqual(nb(w).items.length, 1);
});

// =====================================================================
console.log('\nThêm — dữ liệu cũ, đệm, thứ tự');
// =====================================================================
t('Đệm: nộp bài mới thì notebook có số liệu mới ngay (không chờ 60 giây)', () => {
  const w = world({ studentB: false });
  const e = mkExam(w, 'Đề đệm', [TN(1, 'A'), TN(2, 'A')]);
  submit(w, w.A, e, { 1: 'B', 2: 'A' });
  assert.strictEqual(nb(w).items.length, 1);
  submit(w, w.A, e, { 1: 'B', 2: 'B' });
  assert.strictEqual(nb(w).items.length, 2, 'đệm cũ sau khi nộp');
});
t('notebook: tongHop có saiNgoo, bản đồ chương hongKT, số câu chưa phân loại', () => {
  const w = world({ studentB: false });
  const e = mkExam(w, 'Đề thứ tự', [TN(1, 'A'), TL(2, '5'), TN(3, 'A')]);
  submit(w, w.A, e, { 1: 'B', 2: '', 3: 'C' });
  const d = nb(w);
  const th = d.tongHop || {};
  assert(Array.isArray(th.saiNgoo), 'thiếu tongHop.saiNgoo');
  const hk = Array.isArray(th.hongKT) ? th.hongKT : (th.hongKT && th.hongKT.chuong);
  assert(Array.isArray(hk), 'thiếu bản đồ chương hongKT');
  if (!Array.isArray(th.hongKT)) info('LỆCH NHẸ §6: hongKT là đối tượng {so, doanMo, chuaRo, chuong:[…]} thay vì mảng; chuaRo nằm trong hongKT');
  const chuaRo = th.chuaRo != null ? +th.chuaRo : +(th.hongKT && th.hongKT.chuaRo);
  assert.strictEqual(chuaRo, 2, 'chuaRo = 2');
  const ks = d.items.map((x) => loiOf(x).ma);
  info('thứ tự items máy chủ trả: ' + ks + ' (thứ tự hiển thị Sai ngoo trước do giao diện sắp — kiểm ở e2e)');
});

// ---------- tổng kết ----------
const pass = results.filter((r) => r[1]).length;
console.log(`\n${pass}/${results.length} đạt`);
if (pass !== results.length) { results.filter((r) => !r[1]).forEach((r) => console.log('  ✗ ' + r[0] + ': ' + r[2])); }
