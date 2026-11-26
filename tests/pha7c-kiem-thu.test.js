// Kiểm thử độc lập Pha 7c (người kiểm thử) — phía máy chủ, viết theo docs/spec/pha-7-so-tay.md (§7 "Đề khắc phục (7c)", TC-7.18 → TC-7.23,
// dòng "Sửa đặc tả ngày 27/11/2026 (Pha 7c)"). node tests/pha7c-kiem-thu.test.js
// Hộp đen qua gas-shim, kho giả tests/fixtures/kho-gia.js (tự soạn) + pool luyện tập; hàm trợ giúp chép từ tests/pha4-kiem-thu.test.js.
// TC-7.22 dùng khóa SECRET của shim để dựng token "hợp lệ chữ ký" (kẻ gian thật không có khóa này).
const assert = require('assert');
const crypto = require('crypto');
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
const normTF = (s) => String(s || '').toUpperCase().replace(/Đ/g, 'D').replace(/[^DS]/g, '');
const OFF_MSG = /Giáo viên đang tắt luyện tập/;

// ---------- Thế giới thử ----------
const CLASSES = { '12A1': 'HS0001' };
function world(opts = {}) {
  const g = createContext({ quiet: true, sheetReadMs: opts.sheetReadMs || 0 });
  g.setup();
  const kho = opts.noBank ? null : K.install(g, { rows: opts.rows || K.standardRows(), missingImages: 0 });
  K.setSetting(g, { CHO_LUYEN_TAP: opts.off ? 'KHONG' : 'CO' });
  const tTok = ok(g.call('loginAdminPassword', { password: pwOf(g) })).token;
  const st = { '12A1': ok(g.call('loginPin', { studentId: 'HS0001', pin: '0101' })).token };
  for (const lop of opts.classes || []) {
    const s = ok(g.call('adminSaveStudent', { token: tTok, student: { hoTen: 'HS lớp ' + lop, lop, ngaySinh: '01/02/2008' } }));
    st[lop] = ok(g.call('loginPin', { studentId: s.id, pin: ['01','02'].join('') })).token;
  }
  const w = { g, kho, tTok, st, A: (a, b) => g.call(a, Object.assign({ token: tTok }, b || {})), S: (lop, a, b) => g.call(a, Object.assign({ token: w.st[lop || '12A1'] }, b || {})) };
  if (opts.sync !== false && kho) w.syncRes = sync(w, { filter: {}, mode: 'them' });
  g._resetStats();
  return w;
}
function sync(w, body) {
  let cursor; let n = 0; const agg = { them: 0, capNhat: 0, tat: 0, dangThi: [], calls: 0, last: null };
  for (;;) {
    const d = ok(w.A('adminPracticeSync', Object.assign({}, body, { cursor })), 'adminPracticeSync');
    agg.them += d.them || 0; agg.capNhat += d.capNhat || 0; agg.tat += d.tat || 0; agg.dangThi.push(...(d.dangThi || [])); agg.last = d; agg.calls++;
    if (d.tiepTuc == null || d.tiepTuc === '' || d.tiepTuc === false) break;
    cursor = d.tiepTuc; if (++n > 500) throw new Error('tiepTuc không dừng');
  }
  return agg;
}
// Đọc trang LuyenTap thành đối tượng
function pool(w) {
  const sh = w.g._sheets.LuyenTap; if (!sh) return [];
  const d = sh._data(); const h = d[0];
  const ix = (l) => h.indexOf(l);
  return d.slice(1).filter((r) => r && r[0]).map((r, i) => ({
    row: i + 2, maKho: r[ix('Mã câu kho')], lop: r[ix('Lớp')], chuong: r[ix('Chương')], bai: r[ix('Bài')], loai: r[ix('Loại')], phan: r[ix('Phần')],
    noiDung: r[ix('Nội dung')], dapAn: r[ix('Đáp án')], loiGiai: r[ix('Lời giải')], bat: r[ix('Bật')]
  }));
}
const lopNum = (s) => +(String(s).match(/(\d+)/) || [])[1];
// Bảng nội dung → câu (đáp án) để tự làm bài: từ pool + mọi đề
function answerBook(w) {
  const m = new Map();
  pool(w).forEach((p) => m.set(p.noiDung, { loai: p.loai, dapAn: String(p.dapAn), maKho: p.maKho, loiGiai: p.loiGiai }));
  for (const e of ok(w.A('adminListExams'))) {
    const ex = ok(w.A('adminGetExam', { examId: e.id }));
    ex.questions.forEach((q) => { if (!m.has(q.noiDung)) m.set(q.noiDung, { loai: q.loai, dapAn: String(q.dapAn), maKho: q.maKho, loiGiai: q.loiGiai, examId: e.id, stt: q.stt }); });
  }
  return m;
}
function ansOf(q, b, right) {
  if (q.loai === 'TN') return right ? b.dapAn : 'ABCD'.replace(b.dapAn, '')[0];
  if (q.loai === 'DS') { const a = normTF(b.dapAn).split(''); return right ? a : a.map((x) => (x === 'D' ? 'S' : 'D')); }
  return right ? b.dapAn.split('|')[0] : '98765';
}
// Làm bài: wrongIf(q, book) → true = trả lời sai
function answer(w, start, wrongIf) {
  const book = answerBook(w);
  const ans = {};
  start.questions.forEach((q, i) => {
    const b = book.get(q.noiDung); if (!b) throw new Error('không tra được câu: ' + q.noiDung.slice(0, 50));
    ans[q.stt || i + 1] = ansOf(q, b, !(wrongIf && wrongIf(q, b)));
  });
  return ans;
}
function practice(w, lop, body) { return w.S(lop, 'practiceStart', body); }
const contents = (st) => st.questions.map((q) => q.noiDung);
function toQuestions(w, maKho) {
  const qs = []; let cursor;
  for (let i = 0; i < 50; i++) {
    const d = ok(w.A('adminBankToQuestions', { maKho, cursor }));
    qs.push(...(d.questions || []));
    if (d.tiepTuc == null || d.tiepTuc === '' || d.tiepTuc === false) break; cursor = d.tiepTuc;
  }
  return qs;
}
function saveExam(w, exam, questions) {
  return ok(w.A('adminSaveExam', { exam: Object.assign({ tieuDe: 'Đề thử', lop: '', thoiGian: 15 }, exam), questions }), 'adminSaveExam').id;
}
function setExam(w, id, patch, qsPatch) {
  const ex = ok(w.A('adminGetExam', { examId: id }));
  ok(w.A('adminSaveExam', { exam: Object.assign({}, ex.exam, patch), questions: qsPatch ? qsPatch(ex.questions) : ex.questions }), 'sửa đề');
}
const manual = (nd, dapAn) => ({ loai: 'TN', noiDung: nd, A: 'một', B: 'hai', C: 'ba', D: 'bốn', dapAn: dapAn || 'A', chuDe: 'Chủ đề tay' });
function doExam(w, lop, examId, wrongIf) {
  const s = ok(w.S(lop, 'startExam', { examId }), 'startExam');
  return ok(w.S(lop, 'submitExam', { attemptToken: s.attemptToken, answers: answer(w, s, wrongIf) }), 'submitExam');
}
// Soi lộ: khóa cấm, mã câu kho, lời giải, payload token
function leaks(obj, w) {
  const out = [];
  const j = JSON.stringify(obj);
  const m = j.match(/"(dapAn|loiGiai|maKho|mucDoY)"\s*:/g); if (m) out.push('khóa ' + [...new Set(m)].join(','));
  const pl = pool(w);
  const kh = pl.map((p) => p.maKho).filter((x) => j.includes(x)); if (kh.length) out.push('mã kho ' + kh.slice(0, 3).join(','));
  const lg = [...new Set(pl.map((p) => p.loiGiai).filter((x) => x && x.length > 8))].filter((x) => j.includes(x)); if (lg.length) out.push('lời giải');
  if (obj && obj.attemptToken) {
    const p = decodeTok(obj.attemptToken).p;
    const pj = JSON.stringify(p);
    if (/dapAn|loiGiai|"da"|"lg"/.test(pj)) out.push('token chứa đáp án/lời giải');
  }
  return out;
}
// ---------- token ----------
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
function decodeTok(tok) { const [a, s] = tok.split('.'); return { p: JSON.parse(Buffer.from(a.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')), a, s }; }
function signTok(g, payload) {
  const a = b64(JSON.stringify(payload));
  const s = crypto.createHmac('sha256', g._props.SECRET).update(a).digest('base64').replace(/\+/g, '-').replace(/\//g, '_');
  return a + '.' + s;
}
const rowsOf = (w, n) => (w.g._sheets[n] ? w.g._sheets[n].getLastRow() : 0);
const KQ = (w) => rowsOf(w, 'KetQua');
const KQLT = (w) => rowsOf(w, 'KetQuaLuyenTap');



// ================= riêng 7c =================
const clearCache = (g) => Object.keys(g._cache).forEach((k) => delete g._cache[k]);
const OFF_NB = /tắt sổ tay/; const OFF_LT = /tắt luyện tập/;
const nb = (w, lop) => ok(w.S(lop, 'notebook'), 'notebook');
const byKey = (d) => Object.fromEntries((d.items || []).map((x) => [x.key, x]));
function color(v) { const s = String(v || '').toLowerCase(); return /do|đỏ|red/.test(s) ? 'do' : /vang|vàng|yellow/.test(s) ? 'vang' : /xanh|green/.test(s) ? 'xanh' : s; }
function stampLast(w, sheet, when) { const d = w.g._sheets[sheet]._data(); d[d.length - 1][d[0].indexOf('Nộp lúc')] = when; clearCache(w.g); }
const KP = (w, body, lop) => w.S(lop, 'practiceStart', Object.assign({ kieu: 'KHAC_PHUC' }, body));
const tokOf = (st) => decodeTok(st.attemptToken).p;
// Mức độ đặt cố định: P1 xen kẽ Biết/Hiểu; P2 Hiểu,Hiểu,Vận dụng,Vận dụng; P3 Biết,Biết,Vận dụng,Vận dụng.
// Kho riêng cho 7c: chương "Khí lí tưởng" (ch 1): Bài 9 (bai 0) nhiều câu; Bài 11 (bai 1) 6 câu P1; chương "Từ trường" (ch 2) Bài 14: 4 câu P1.
function rows7c() {
  const r = [];
  for (let i = 1; i <= 10; i++) r.push(K.row({ phan: 1, cau: i, ch: 1, bai: 0, dapAn: 'ABCD'[i % 4], muc: i % 2 ? 'Biết' : 'Hiểu', noiDung: `B9 P1 câu ${i} (tự soạn).`, loiGiai: `Lời giải B9 P1 ${i} tự soạn dài.` }));
  for (let i = 1; i <= 4; i++) r.push(K.row({ phan: 2, cau: i, ch: 1, bai: 0, muc: i <= 2 ? 'Hiểu' : 'Vận dụng', dapAn: 'a) Đúng b) Sai c) Đúng d) Sai', noiDung: `B9 P2 câu ${i} (tự soạn).`, loiGiai: `Lời giải B9 P2 ${i} tự soạn dài.` }));
  for (let i = 1; i <= 4; i++) r.push(K.row({ phan: 3, cau: i, ch: 1, bai: 0, muc: i <= 2 ? 'Biết' : 'Vận dụng', dapAn: '2,5', noiDung: `B9 P3 câu ${i} (tự soạn).`, loiGiai: `Lời giải B9 P3 ${i} tự soạn dài.` }));
  for (let i = 1; i <= 6; i++) r.push(K.row({ phan: 1, cau: 20 + i, ch: 1, bai: 1, dapAn: 'B', noiDung: `B11 P1 câu ${i} (tự soạn).`, loiGiai: `Lời giải B11 ${i} tự soạn dài.` }));
  for (let i = 1; i <= 4; i++) r.push(K.row({ phan: 1, cau: 40 + i, ch: 2, bai: 0, dapAn: 'C', noiDung: `B14 P1 câu ${i} (tự soạn).`, loiGiai: `Lời giải B14 ${i} tự soạn dài.` }));
  return r;
}
const W7 = (o) => world(Object.assign({ rows: rows7c() }, o || {}));
const maOf = (w, nd) => (pool(w).find((p) => p.noiDung === nd) || {}).maKho;
const ndOf = (w, ma) => (pool(w).find((p) => p.maKho === ma) || {}).noiDung;
// đề thi từ câu kho (maKho), làm sai các câu chọn, rồi đóng đề (đã công bố lời giải)
function examFromBank(w, title, maList, wrongSet, opts = {}) {
  const id = saveExam(w, Object.assign({ tieuDe: title, lop: '12A1', thoiGian: 50, trangThai: 'MO', soLanLam: 0, hienLoiGiai: 'NGAY' }, opts.exam || {}), toQuestions(w, maList));
  const s = ok(w.S(opts.lop, 'startExam', { examId: id }), 'startExam');
  const book = answerBook(w); const ans = {};
  s.questions.forEach((q) => { const b = book.get(q.noiDung); const m = maOf(w, q.noiDung); ans[q.stt] = opts.blank && wrongSet.has(m) ? (q.loai === 'DS' ? ['', '', '', ''] : '') : ansOf(q, b, !wrongSet.has(m)); });
  ok(w.S(opts.lop, 'submitExam', { attemptToken: s.attemptToken, answers: ans }), 'submitExam');
  if (opts.close !== false) setExam(w, id, { trangThai: 'DONG' });
  clearCache(w.g);
  return id;
}
// làm bài khắc phục: right(q, maKho, gocKey) → true = trả lời đúng
function doKP(w, st, right, lop) {
  const p = tokOf(st); const book = answerBook(w); const ans = {};
  st.questions.forEach((q, i) => { const b = book.get(q.noiDung); ans[q.stt || i + 1] = ansOf(q, b, right(q, p.qids[i], p.goc[i])); });
  return ok(w.S(lop, 'submitExam', { attemptToken: st.attemptToken, answers: ans }), 'submitExam (khắc phục)');
}
const bai9 = (w) => pool(w).filter((p) => /Bài 9/.test(p.bai));

console.log('\nTC-7.18 — MUOI_CAU');
t('TC-7.18 MUOI_CAU: ≤ 4 câu gốc + câu tương tự cùng bài, đủ 10; không lộ dapAn/loiGiai/maKho; token có goc song song qids', () => {
  const w = W7();
  const b9 = bai9(w).filter((p) => p.phan == 1 || /Phần I –/.test(p.phan) || p.loai === 'TN').slice(0, 6).map((p) => p.maKho);
  examFromBank(w, 'Đề gốc B9', b9, new Set(b9)); // sai cả 6 câu Bài 9
  const st = ok(KP(w, { mau: 'MUOI_CAU' }), 'practiceStart MUOI_CAU');
  const p = tokOf(st);
  info(`MUOI_CAU: ${st.questions.length} câu; qids ${p.qids.length}, goc ${p.goc && p.goc.length}; thông báo: ${st.thongBao || st.note || st.canhBao || '—'}`);
  assert.strictEqual(st.questions.length, 10, 'đủ 10 câu');
  assert(Array.isArray(p.goc) && p.goc.length === p.qids.length, 'goc song song qids');
  const origins = new Set(b9);
  const nGoc = p.qids.filter((q) => origins.has(q)).length;
  assert(nGoc >= 1 && nGoc <= 4, 'số câu gốc làm lại ' + nGoc);
  assert(p.goc.every((g) => origins.has(g)), 'mọi câu đều nhắm một câu gốc: ' + p.goc);
  const pl = Object.fromEntries(pool(w).map((x) => [x.maKho, x]));
  assert(p.qids.every((q) => /Bài 9/.test(pl[q].bai)), 'câu tương tự phải cùng Bài 9: ' + p.qids.map((q) => pl[q].bai));
  assert.deepStrictEqual(leaks(st, w), [], 'lộ: ' + leaks(st, w));
  assert.strictEqual(+st.durationSec, 900, '15 phút: durationSec ' + st.durationSec);
});
t('TC-7.18 (biên) pool thiếu: gốc ở Bài 14 (4 câu) → lấy thêm cùng chương rồi báo "Chỉ dựng được n câu"', () => {
  const w = W7();
  const b14 = pool(w).filter((p) => /Bài 14/.test(p.bai)).map((p) => p.maKho);
  examFromBank(w, 'Đề gốc B14', b14.slice(0, 2), new Set(b14.slice(0, 2)));
  const st = ok(KP(w, { mau: 'MUOI_CAU' }));
  const msg = JSON.stringify(st).match(/Chỉ dựng được \d+ câu/);
  info(`${st.questions.length} câu; "${msg && msg[0]}"`);
  assert(st.questions.length < 10 && st.questions.length >= 2);
  assert(msg && new RegExp(st.questions.length + ' câu').test(msg[0]), 'thiếu thông báo Chỉ dựng được n câu');
  const pl = Object.fromEntries(pool(w).map((x) => [x.maKho, x]));
  assert(tokOf(st).qids.every((q) => /Từ trường/.test(pl[q].chuong)), 'chỉ được lấy cùng chương');
});
t('TC-7.18 câu gốc thuộc đề chưa công bố (đang mở NGAY / SAU_HAN / đóng KHONG) không bao giờ xuất hiện — 50 lần × 3 mẫu', () => {
  const w = W7();
  const b11 = pool(w).filter((p) => /Bài 11/.test(p.bai)).map((p) => p.maKho);
  const b9 = bai9(w).map((p) => p.maKho);
  examFromBank(w, 'Đề B9 đã công bố', b9.slice(0, 3), new Set(b9.slice(0, 3)));
  examFromBank(w, 'Đề mở NGAY', [b11[0]], new Set([b11[0]]), { close: false });
  examFromBank(w, 'Đề mở SAU_HAN', [b11[1]], new Set([b11[1]]), { close: false, exam: { hienLoiGiai: 'SAU_HAN' } });
  examFromBank(w, 'Đề KHONG', [b11[2]], new Set([b11[2]]), { exam: { hienLoiGiai: 'KHONG' } });
  // câu nhập tay của đề đang mở
  const eM = saveExam(w, { tieuDe: 'Đề tay mở', lop: '12A1', thoiGian: 10, trangThai: 'MO', soLanLam: 0 }, [manual('Câu tay đang thi (tự soạn).', 'A')]);
  doExam(w, null, eM, () => true);
  const blocked = new Set(b11.slice(0, 3).map((m) => ndOf(w, m)).concat(['Câu tay đang thi (tự soạn).']));
  let n = 0; const seen = {};
  for (let i = 0; i < 50; i++) for (const body of [{ mau: 'MUOI_CAU' }, { mau: 'ON_NHANH' }, { mau: 'MOT_LOI', ma: 'HONG' }, { mau: 'MOT_LOI', ma: 'HONG' }]) {
    const r = KP(w, body); if (!r.ok) { seen[body.mau + (body.ma || '')] = r.error; continue; }
    n++;
    const bad = r.data.questions.filter((q) => blocked.has(q.noiDung) || /tay đang thi/.test(q.noiDung));
    assert.strictEqual(bad.length, 0, 'xuất hiện câu bị chặn: ' + bad.map((q) => q.noiDung));
    tokOf(r.data).goc.filter((g) => b11.slice(0, 3).includes(g) || /#/.test(g)).forEach((g) => { seen.gocChuaCongBo = (seen.gocChuaCongBo || new Set()).add(g); });
  }
  info('lỗi theo mẫu: ' + JSON.stringify(Object.fromEntries(Object.entries(seen).filter(([k]) => k !== 'gocChuaCongBo'))));
  info(`${n} lần dựng đề, không lần nào có câu bị chặn; ghi nhận: câu gốc chưa công bố vẫn làm "đích" (goc) cho câu tương tự: ${[...(seen.gocChuaCongBo || [])].join(',') || 'không'}`);
  assert(n >= 50);
  // đóng đề NGAY → câu xuất hiện lại được làm câu gốc
  const eNgay = ok(w.A('adminListExams')).find((e) => e.tieuDe === 'Đề mở NGAY').id;
  setExam(w, eNgay, { trangThai: 'DONG' }); clearCache(w.g);
  let back = false;
  for (let i = 0; i < 30 && !back; i++) { const r = ok(KP(w, { mau: 'MUOI_CAU' })); back = tokOf(r).goc.includes(b11[0]); }
  assert(back, 'đóng đề thì câu gốc dùng lại được');
});

console.log('\nTC-7.19 — trạng thái câu gốc');
t('TC-7.19 đúng câu khắc phục ngày 1 → vàng; lần nữa cùng ngày vẫn vàng; ngày 2 → xanh; sai lại → đỏ; khacPhuc báo đổi màu; lanSai câu gốc không đổi', () => {
  const w = W7();
  const b9 = bai9(w).filter((p) => p.loai === 'TN');
  const X = b9[0].maKho;
  examFromBank(w, 'Đề gốc X', [X], new Set([X]));
  stampLast(w, 'KetQua', '01/11/2026 08:00:00');
  ok(w.S(null, 'notebookTag', { items: [{ key: X, ma: 'HONG_KT' }] }));
  const lan0 = +byKey(nb(w))[X].lanSai;
  const run = (right, when, pre) => {
    const st = pre || ok(KP(w, { mau: 'MOT_LOI', ma: 'HONG' }));
    const p = tokOf(st);
    assert(p.goc.every((g) => g === X), 'goc phải là X');
    const res = doKP(w, st, () => right);
    stampLast(w, 'KetQuaLuyenTap', when);
    return { res, mau: color(byKey(nb(w))[X].mau), it: byKey(nb(w))[X], has: p.qids.some((q) => q !== X) };
  };
  const a = run(true, '05/11/2026 08:00:00');
  info('khacPhuc lần 1: ' + JSON.stringify(a.res.khacPhuc));
  assert.strictEqual(a.mau, 'vang'); assert(a.has, 'đề có câu tương tự (khác X)');
  assert(Array.isArray(a.res.khacPhuc) && a.res.khacPhuc.some((k) => k.key === X && color(k.truoc) === 'do' && color(k.sau) === 'vang'), 'kết quả không báo X đỏ → vàng');
  assert.strictEqual(+a.it.lanSai, lan0, 'lanSai câu gốc đổi');
  const b = run(true, '05/11/2026 15:00:00');
  assert.strictEqual(b.mau, 'vang', 'cùng ngày vẫn vàng');
  // (khacPhuc của lần này tính theo giờ nộp thật, trước khi bài được đổi ngày nộp → không so ở đây)
  const pre = ok(KP(w, { mau: 'MOT_LOI', ma: 'HONG' })); // dựng sẵn khi X còn vàng (câu xanh không còn được chọn làm câu gốc)
  const c = run(true, '06/11/2026 08:00:00');
  assert.strictEqual(c.mau, 'xanh', 'ngày 2 → xanh');
  const rG = KP(w, { mau: 'MOT_LOI', ma: 'HONG' });
  info('X đã xanh → dựng đề khắc phục: ' + (rG.ok ? 'vẫn có (goc ' + [...new Set(tokOf(rG.data).goc)] + ')' : '"' + rG.error + '"'));
  const d = run(false, '07/11/2026 08:00:00', pre);
  assert.strictEqual(d.mau, 'do', 'sai lại → đỏ');
  assert(d.res.khacPhuc.some((k) => k.key === X && color(k.sau) === 'do'), 'báo xanh → đỏ');
  for (const r of [a, c, d]) assert(!(r.res.khacPhuc || []).some((k) => color(k.truoc) === color(k.sau)), 'vòng 2 (G-3): khacPhuc có mục không đổi màu');
});
t('TC-7.19 (biên) trong một bài có câu khắc phục đúng và sai cho cùng câu gốc → tính sai (đỏ); câu khắc phục sai thành mục riêng trong sổ', () => {
  const w = W7();
  const X = bai9(w).filter((p) => p.loai === 'TN')[0].maKho;
  examFromBank(w, 'Đề gốc X', [X], new Set([X])); stampLast(w, 'KetQua', '01/11/2026 08:00:00');
  ok(w.S(null, 'notebookTag', { items: [{ key: X, ma: 'HONG_KT' }] }));
  // đưa X lên vàng trước
  let st = ok(KP(w, { mau: 'MOT_LOI', ma: 'HONG' })); doKP(w, st, () => true); stampLast(w, 'KetQuaLuyenTap', '02/11/2026 08:00:00');
  assert.strictEqual(color(byKey(nb(w))[X].mau), 'vang');
  st = ok(KP(w, { mau: 'MOT_LOI', ma: 'HONG' }));
  const p = tokOf(st);
  const others = p.qids.filter((q) => q !== X);
  assert(others.length >= 2, 'cần ≥ 2 câu tương tự');
  const wrongQ = others[0];
  doKP(w, st, (q, qid) => qid !== wrongQ); stampLast(w, 'KetQuaLuyenTap', '03/11/2026 08:00:00');
  const m = byKey(nb(w));
  assert.strictEqual(color(m[X].mau), 'do', 'đúng + sai trong một bài → đỏ');
  assert(m[wrongQ], 'câu khắc phục sai phải thành mục riêng');
});
t('TC-7.19 (biên) câu gốc là câu nhập tay (examId#stt) của đề đã công bố cũng được khắc phục bằng câu tương tự? — ghi nhận', () => {
  const w = W7();
  const e = saveExam(w, { tieuDe: 'Đề tay', lop: '12A1', thoiGian: 10, trangThai: 'MO', soLanLam: 0 }, [Object.assign(manual('Câu tay đã công bố (tự soạn).', 'A'), { chuong: 'Chương II. Khí lí tưởng', bai: 'Bài 9. Định luật Boyle' })]);
  doExam(w, null, e, () => true); setExam(w, e, { trangThai: 'DONG' }); clearCache(w.g);
  const r = KP(w, { mau: 'MUOI_CAU' });
  info(r.ok ? `${r.data.questions.length} câu; goc ${JSON.stringify([...new Set(tokOf(r.data).goc)])}` : 'lỗi: ' + r.error);
  assert(r.ok || /Chỉ dựng|không có|chưa có/i.test(r.error));
});

t('MOT_LOI ma=HONG khi sổ chỉ có câu "Chưa phân loại" (sổ tay xếp chúng vào nhóm Hổng kiến thức) — ghi nhận', () => {
  const w = W7();
  const X = bai9(w).filter((p) => p.loai === 'TN')[0].maKho;
  examFromBank(w, 'Đề gốc', [X], new Set([X]));
  const r = KP(w, { mau: 'MOT_LOI', ma: 'HONG' });
  info('sổ chỉ có câu chưa phân loại → MOT_LOI HONG: ' + (r.ok ? r.data.questions.length + ' câu' : '"' + r.error + '"') + '; MUOI_CAU: ' + (KP(w, { mau: 'MUOI_CAU' }).ok ? 'dựng được' : 'không'));
  assert(r.ok && r.data.questions.length === 5 && tokOf(r.data).goc.every((g) => g === X), 'vòng 2 (G-1): Ôn phần hổng kiến thức phải gồm câu chưa phân loại');
});
t('Vòng 2 (R-1): làm lại chính câu gốc SAI + câu tương tự ĐÚNG trong cùng bài → câu gốc đỏ (hai ngày liền vẫn đỏ); khacPhuc chỉ câu đổi màu (G-3)', () => {
  const w = W7();
  const X = bai9(w).filter((p) => p.loai === 'TN')[0].maKho;
  examFromBank(w, 'Đề gốc X', [X], new Set([X])); stampLast(w, 'KetQua', '01/11/2026 08:00:00');
  // đưa X lên vàng trước bằng một bài đúng hết
  let st = ok(KP(w, { mau: 'MOT_LOI', ma: 'HONG' })); doKP(w, st, () => true); stampLast(w, 'KetQuaLuyenTap', '02/11/2026 08:00:00');
  assert.strictEqual(color(byKey(nb(w))[X].mau), 'vang');
  for (const day of ['03', '04']) {
    let p; let tries = 0;
    do { st = ok(KP(w, { mau: 'MOT_LOI', ma: 'HONG' })); p = tokOf(st); } while (!p.qids.includes(X) && ++tries < 20);
    assert(p.qids.includes(X), 'đề khắc phục phải có chính câu gốc X');
    const res = doKP(w, st, (q, qid) => qid !== X);
    stampLast(w, 'KetQuaLuyenTap', day + '/11/2026 08:00:00');
    const m = color(byKey(nb(w))[X].mau);
    info(`ngày ${day}: X ${m}; khacPhuc ${JSON.stringify((res.khacPhuc || []).map((k) => k.truoc + '→' + k.sau))}`);
    assert.strictEqual(m, 'do', 'câu gốc làm sai trong bài phải đỏ (ngày ' + day + ')');
    assert(!(res.khacPhuc || []).some((k) => color(k.truoc) === color(k.sau)), 'khacPhuc có mục không đổi màu');
  }
});
console.log('\nTC-7.20 — ON_NHANH, MOT_LOI');
t('TC-7.20 ON_NHANH: 5 câu, 420 giây, nhắm loại lỗi đỏ nặng nhất', () => {
  const w = W7();
  const p2 = bai9(w).filter((p) => p.loai === 'DS').map((p) => p.maKho);
  const p1b11 = pool(w).filter((p) => /Bài 11/.test(p.bai)).map((p) => p.maKho);
  // SOT đỏ: bỏ trống 3 câu Phần II ở 2 đề; Đọc đề vàng: 2 câu Bài 11 gắn DOC_DE
  examFromBank(w, 'Đề sót 1', p2.slice(0, 2), new Set(p2.slice(0, 2)), { blank: true });
  examFromBank(w, 'Đề sót 2', [p2[2]], new Set([p2[2]]), { blank: true });
  examFromBank(w, 'Đề đọc đề', p1b11.slice(0, 2), new Set(p1b11.slice(0, 2)));
  ok(w.S(null, 'notebookTag', { items: p1b11.slice(0, 2).map((k) => ({ key: k, ma: 'DOC_DE' })) }));
  const sot = nb(w).tongHop.saiNgoo.find((x) => x.ma === 'SOT');
  assert.strictEqual(color(sot.mau), 'do', 'SOT phải đỏ: ' + JSON.stringify(sot));
  for (let i = 0; i < 10; i++) {
    const st = ok(KP(w, { mau: 'ON_NHANH' }));
    const p = tokOf(st);
    assert.strictEqual(st.questions.length, 5, 'ON_NHANH 5 câu');
    const secs = +st.durationSec;
    assert.strictEqual(secs, 420, '420 giây: ' + JSON.stringify({ p: Object.keys(p), st: Object.keys(st) }));
    assert(p.goc.every((g) => p2.slice(0, 3).includes(g)), 'goc phải là câu SOT: ' + p.goc);
  }
});
t('TC-7.20 MOT_LOI: thiếu ma / mẫu lạ / ma không có câu → báo lỗi rõ', () => {
  const w = W7();
  const p1 = bai9(w).filter((p) => p.loai === 'TN').map((p) => p.maKho);
  examFromBank(w, 'Đề sót', p1.slice(0, 2), new Set(p1.slice(0, 2)), { blank: true });
  const r1 = KP(w, { mau: 'MOT_LOI', ma: 'CONG_THUC' });
  assert(!r1.ok && !/undefined|TypeError/.test(r1.error), 'ma không có câu: ' + JSON.stringify(r1).slice(0, 120));
  assert(!KP(w, { mau: 'MOT_LOI' }).ok, 'thiếu ma phải lỗi');
  assert(!KP(w, { mau: 'BIA' }).ok, 'mẫu lạ phải lỗi');
  info('ma không có câu: "' + r1.error + '"');
});
// Ưu tiên phần: câu gốc 1 câu ở Bài 9; Bài 9 còn 3–4 câu đúng phần ưu tiên → 4 câu tương tự mỗi đề phải gồm hết các câu đó.
function partShare(ma, loaiO, tag, want) {
  const w = W7();
  const o = bai9(w).filter((p) => p.loai === loaiO)[0];
  examFromBank(w, 'Đề gốc', [o.maKho], new Set([o.maKho]), { blank: !tag });
  if (tag) ok(w.S(null, 'notebookTag', { items: [{ key: o.maKho, ma: tag.ma, y: tag.y }] }));
  const pl = Object.fromEntries(pool(w).map((x) => [x.maKho, x]));
  const avail = bai9(w).filter((p) => p.loai === want && p.maKho !== o.maKho).length;
  let got = 0; const N = 20;
  for (let i = 0; i < N; i++) { const r = ok(KP(w, { mau: 'MOT_LOI', ma })); got += tokOf(r).qids.filter((q) => q !== o.maKho && pl[q].loai === want).length; }
  return { avg: got / N, avail: Math.min(avail, 4) };
}
t('TC-7.20 MOT_LOI ma=SOT ưu tiên câu Phần II; TINH_TOAN (DON_VI) ưu tiên Phần III — câu gốc cùng phần', () => {
  const a = partShare('SOT', 'DS', null, 'DS');
  const c = partShare('TINH_TOAN', 'TL', { ma: 'TINH_TOAN', y: 'DON_VI' }, 'TL');
  info(`SOT, gốc Phần II: trung bình ${a.avg}/${a.avail} câu tương tự là Phần II; TINH_TOAN, gốc Phần III: ${c.avg}/${c.avail} là Phần III`);
  assert(a.avg >= a.avail - 0.5 && c.avg >= c.avail - 0.5);
});
t('TC-7.20 (biên) câu gốc ở phần khác: SOT gốc Phần I (bỏ trống cả câu) vẫn ưu tiên Phần II; TINH_TOAN/BAM_MAY gốc Phần I vẫn ưu tiên Phần III', () => {
  const b = partShare('SOT', 'TN', null, 'DS');
  const d = partShare('TINH_TOAN', 'TN', { ma: 'TINH_TOAN', y: 'BAM_MAY' }, 'TL');
  info(`SOT gốc Phần I: ${b.avg}/${b.avail} câu Phần II; BAM_MAY gốc Phần I: ${d.avg}/${d.avail} câu Phần III (câu cùng mức độ được ưu tiên hơn đúng phần)`);
  assert(b.avg >= b.avail - 0.5, `SOT gốc Phần I: chỉ ${b.avg}/${b.avail} câu Phần II`);
  assert(d.avg >= d.avail - 0.5, `BAM_MAY gốc Phần I: chỉ ${d.avg}/${d.avail} câu Phần III`);
});
console.log('\nTC-7.21 — ghi KetQuaLuyenTap, không đổi bảng xếp hạng');
t('TC-7.21 nộp KHAC_PHUC: KetQuaLuyenTap +1 (kieu KHAC_PHUC), KetQua không đổi; xếp hạng, bảng điểm, gợi ý đề không đổi; có lời giải ngay', () => {
  const w = W7();
  const b9 = bai9(w).filter((p) => p.loai === 'TN').map((p) => p.maKho);
  const E = examFromBank(w, 'Đề gốc', b9.slice(0, 3), new Set(b9.slice(0, 3)), { close: false });
  const snap = () => JSON.stringify([ok(w.S(null, 'leaderboard', { examId: E })), ok(w.S(null, 'myStats')), ok(w.S(null, 'myResults')), ok(w.A('adminResults', {}))]);
  setExam(w, E, { trangThai: 'DONG' });
  const s0 = snap(); const kq0 = KQ(w); const lt0 = KQLT(w);
  const st = ok(KP(w, { mau: 'MUOI_CAU' }));
  const res = doKP(w, st, () => true);
  clearCache(w.g);
  assert.strictEqual(KQ(w), kq0, 'KetQua thêm hàng'); assert.strictEqual(KQLT(w), lt0 + 1, 'KetQuaLuyenTap không thêm');
  const d = w.g._sheets.KetQuaLuyenTap._data(); const h = d[0];
  assert.strictEqual(d[d.length - 1][h.indexOf('Kiểu')], 'KHAC_PHUC');
  const det = JSON.parse(d[d.length - 1][h.indexOf('Chi tiết (JSON)')]);
  assert(det.every((x) => x.goc), 'chiTiet thiếu goc');
  assert.strictEqual(snap(), s0, 'xếp hạng / bảng điểm / kết quả đổi');
  const j = JSON.stringify(res);
  assert(/Lời giải B9/.test(j), 'không có lời giải ngay');
});

console.log('\nTC-7.22 — token bị sửa');
t('TC-7.22 sửa goc hoặc qids trong token (không có khóa) → từ chối; có khóa mà goc trỏ câu không phải câu sai của em → không đổi màu câu đó', () => {
  const w = W7();
  const b9 = bai9(w).filter((p) => p.loai === 'TN').map((p) => p.maKho);
  examFromBank(w, 'Đề gốc', b9.slice(0, 2), new Set(b9.slice(0, 2)));
  const other = b9[5];
  const st = ok(KP(w, { mau: 'MUOI_CAU' }));
  const { p, s } = decodeTok(st.attemptToken);
  for (const mut of [(x) => { x.goc[0] = other; }, (x) => { x.qids[0] = other; }, (x) => { x.goc = x.goc.slice(1); }]) {
    const q = JSON.parse(JSON.stringify(p)); mut(q);
    const forged = b64(JSON.stringify(q)) + '.' + s;
    const r = w.S(null, 'submitExam', { attemptToken: forged, answers: {} });
    assert(!r.ok, 'token sửa không chữ ký phải bị từ chối');
  }
  // có khóa (giả định kẻ gian có SECRET): goc trỏ câu em chưa từng sai
  const q = JSON.parse(JSON.stringify(p)); q.goc = q.goc.map(() => other);
  const r = w.S(null, 'submitExam', { attemptToken: signTok(w.g, q), answers: {} });
  info('token ký lại với goc lạ: ' + (r.ok ? 'nhận' : 'từ chối "' + r.error + '"'));
  if (r.ok) info('khacPhuc với goc lạ: ' + JSON.stringify(r.data.khacPhuc) + '; mục trong sổ: ' + JSON.stringify(byKey(nb(w))[other] && byKey(nb(w))[other].mau));
  // token khắc phục vẫn nộp được bình thường
  assert(ok(w.S(null, 'submitExam', { attemptToken: st.attemptToken, answers: {} })));
});

console.log('\nTắt sổ tay / luyện tập');
t('KHAC_PHUC cần cả BAT_SO_TAY và CHO_LUYEN_TAP: tắt một trong hai → lỗi; các kiểu luyện tập khác vẫn chạy khi chỉ tắt sổ tay', () => {
  const w = W7();
  const b9 = bai9(w).filter((p) => p.loai === 'TN').map((p) => p.maKho);
  examFromBank(w, 'Đề gốc', b9.slice(0, 2), new Set(b9.slice(0, 2)));
  K.setSetting(w.g, { BAT_SO_TAY: 'KHONG' }); clearCache(w.g);
  const r1 = KP(w, { mau: 'MUOI_CAU' });
  assert(!r1.ok, 'tắt sổ tay mà vẫn dựng: ' + JSON.stringify(r1).slice(0, 80));
  assert(ok(w.S(null, 'practiceStart', { kieu: 'TU_TAO', so: { TN: 5 }, phut: 5 })).questions.length === 5, 'TU_TAO phải chạy');
  K.setSetting(w.g, { BAT_SO_TAY: 'CO', CHO_LUYEN_TAP: 'KHONG' }); clearCache(w.g);
  const r2 = KP(w, { mau: 'MUOI_CAU' });
  assert(!r2.ok && OFF_LT.test(r2.error), 'tắt luyện tập: ' + JSON.stringify(r2).slice(0, 80));
  info(`tắt sổ tay: "${r1.error}"; tắt luyện tập: "${r2.error}"`);
});
t('Học sinh chưa có câu sai → KHAC_PHUC báo rõ, không lỗi lạ', () => {
  const w = W7();
  const r = KP(w, { mau: 'MUOI_CAU' });
  info(r.ok ? `ok ${r.data.questions.length} câu` : `"${r.error}"`);
  assert(!r.ok || r.data.questions.length === 0);
  assert(r.ok || !/undefined|TypeError|Cannot/.test(r.error));
});

console.log('\nTC-7.23 (khuyến nghị) — hiệu năng');
t('TC-7.23 300 bài nộp giả của một học sinh: notebook < 3 giây với SHEET_READ_MS=300 (đệm trống)', () => {
  const w = W7();
  const pl = pool(w);
  const d = w.g._sheets.KetQua._data(); const h = d[0];
  for (let i = 0; i < 300; i++) {
    const det = JSON.stringify(Array.from({ length: 15 }, (_, j) => { const p = pl[(i + j) % pl.length]; return { s: j + 1, l: p.loai, a: 'A', sc: j % 3 ? 0.25 : 0, m: 0.25, c: j % 3 ? 1 : 0, cd: 'Chủ đề', md: '', p: 1, q: p.maKho, k: p.maKho }; }));
    const o = { 'Nộp lúc': '0' + (1 + (i % 9)) + '/11/2026 10:00:00', 'Họ tên': 'Học Sinh Mẫu', 'Lớp': '12A1', 'Đề': 'Đề giả ' + i, 'Điểm (thang 10)': 5, 'Mã bài': 'KQGIA' + i, 'Mã HS': 'HS0001', 'Mã đề': 'DEGIA' + (i % 30), 'Chi tiết (JSON)': det };
    d.push(h.map((x) => (x in o ? o[x] : '')));
  }
  clearCache(w.g); w.g._env.sheetReadMs = 300; w.g._resetStats();
  const t0 = Date.now(); const r = nb(w); const ms = Date.now() - t0;
  info(`notebook: ${ms} ms, ${r.items.length} câu; đọc trang: ${JSON.stringify(w.g._stats.reads)}`);
  assert(ms < 3000, ms + ' ms');
  w.g._resetStats(); const t1 = Date.now(); ok(KP(w, { mau: 'MUOI_CAU' })); info(`practiceStart MUOI_CAU: ${Date.now() - t1} ms`);
});

const pass = results.filter((r) => r[1]).length;
console.log(`\n${pass}/${results.length} đạt`);
if (pass !== results.length) results.filter((r) => !r[1]).forEach((r) => console.log('  ✗ ' + r[0] + ': ' + r[2]));
