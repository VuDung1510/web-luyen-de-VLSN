// Kiểm thử độc lập Pha 4 (người kiểm thử) — phía máy chủ, viết theo docs/spec/pha-4-luyen-tap.md (TC-4.1 → TC-4.14).
// node tests/pha4-kiem-thu.test.js
// Hộp đen: chỉ gọi API qua gas-shim (doPost), đọc trang tính giả để đối chiếu; kho giả tests/fixtures/kho-gia.js (tự soạn).
// Riêng TC-4.8 dùng khóa SECRET của shim để dựng token "hợp lệ chữ ký" (hết hạn, đổi loại) — kẻ gian thật không có khóa này.
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
    st[lop] = ok(g.call('loginPin', { studentId: s.id, pin: '0102' })).token;
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

// Kho nhỏ có kiểm soát: bài "Bài 14. Từ trường" (Chương III) có đúng nTN câu P1 …
function rowsBai14(nTN, extra) {
  const rows = [];
  for (let i = 1; i <= nTN; i++) rows.push(K.row({ phan: 1, cau: i, ch: 2, bai: 0, dapAn: 'ABCD'[i % 4], noiDung: `B14 câu P1 số ${i} (tự soạn).` }));
  return rows.concat(extra || []);
}
const lop10 = (r) => { const x = r.slice(); x[1] = 'Lớp 10'; x[0] = x[0].replace(/^L11/, 'L10'); x[8] = x[8] + ' [lớp 10]'; return x; };

console.log('Kiểm thử độc lập Pha 4 — máy chủ:');

t('Chung: features có "practice"; APP_VERSION tăng số phụ (≥ 1.4.0); CaiDat có CHO_LUYEN_TAP, LUYEN_NHANH=7,1,2,10', () => {
  const g = createContext({ quiet: true }); g.setup();
  const p = ok(g.call('publicConfig'));
  assert(p.features.includes('practice'), p.features);
  ['changePin', 'goal', 'bootstrap', 'cache', 'bank'].forEach((f) => assert(p.features.includes(f), 'mất ' + f));
  assert(+g.APP_VERSION.split('.')[1] >= 4, g.APP_VERSION);
  const cd = Object.fromEntries(g._sheets.CaiDat._data().map((r) => [r[0], r[1]]));
  assert('CHO_LUYEN_TAP' in cd); assert.strictEqual(String(cd.LUYEN_NHANH), '7,1,2,10');
  ['LuyenTap', 'KetQuaLuyenTap'].forEach((n) => assert(g._sheets[n] && g._sheets[n].getLastRow() === 1, 'setup chưa tạo ' + n));
  const kq = g._sheets.KetQua._data()[0]; const kl = g._sheets.KetQuaLuyenTap._data()[0];
  assert.deepStrictEqual(kl.slice(0, kq.length), kq, 'KetQuaLuyenTap không cùng cột KetQua'); assert(kl.length > kq.length, 'thiếu cột kiểu');
  info(`APP_VERSION ${g.APP_VERSION}; mặc định CHO_LUYEN_TAP=${cd.CHO_LUYEN_TAP}; cột thêm: ${kl.slice(kq.length).join(',')}`);
});

t('Quyền: học sinh gọi adminPractice* bị từ chối; chưa đăng nhập gọi practiceMeta/Start bị từ chối', () => {
  const w = world();
  ['adminPracticeSync', 'adminPracticeList', 'adminPracticeToggle'].forEach((a) => assert(!w.S(null, a, { filter: {}, mode: 'them', maKho: ['x'], bat: 'KHONG' }).ok, a));
  assert(!w.g.call('practiceMeta', {}).ok); assert(!w.g.call('practiceStart', { kieu: 'TU_TAO', so: { TN: 5 }, phut: 10 }).ok);
});

// ---------- TC-4.1 ----------
t('TC-4.1 Đồng bộ pool: chỉ câu có đáp án, không P IV; chạy lại không nhân đôi; "thay" chỉ đặt bat; kho 0 lần ghi', () => {
  const w = world({ sync: false });
  const rows = w.kho.rows;
  const r1 = sync(w, { filter: {}, mode: 'them' });
  const pl = pool(w);
  const bankList = []; for (let pg = 1; pg < 20; pg++) { const d = ok(w.A('adminBankList', { filter: {}, page: pg, size: 100 })); bankList.push(...d.items.map((x) => x.maKho)); if (bankList.length >= d.tong || !d.items.length) break; }
  const byMa = Object.fromEntries(rows.map((r) => [r[0], r]));
  const bad = pl.filter((p) => !byMa[p.maKho] || !byMa[p.maKho][13] || /Phần IV/.test(byMa[p.maKho][4]));
  assert.deepStrictEqual(bad.map((p) => p.maKho), [], 'pool có câu thiếu đáp án / P IV');
  assert.deepStrictEqual(pl.map((p) => p.maKho).sort(), bankList.slice().sort(), 'pool khác danh sách câu dùng được của Ngân hàng');
  assert.strictEqual(r1.them, pl.length);
  assert(pl.every((p) => p.bat === 'CO') && pl.every((p) => p.dapAn !== ''));
  assert(r1.last.boQua && r1.last.boQua.tuLuan >= 1 && r1.last.boQua.khongDapAn >= 3, JSON.stringify(r1.last.boQua));
  info(`lần 1: them=${r1.them}, pool ${pl.length} hàng (= ${bankList.length} câu dùng được của adminBankList), boQua=${JSON.stringify(r1.last.boQua)}, ${r1.calls} lượt gọi`);
  // chỉ định maKho gồm câu P IV và câu thiếu đáp án → không thêm
  const p4 = rows.find((r) => /Phần IV/.test(r[4]))[0]; const noAns = rows.find((r) => !r[13])[0];
  const r1b = w.A('adminPracticeSync', { maKho: [p4, noAns], mode: 'them' });
  assert(!r1b.ok || !r1b.data.them, 'thêm câu P IV/thiếu đáp án'); info('chỉ định P IV + câu thiếu đáp án: ' + (r1b.ok ? 'them=' + r1b.data.them : 'lỗi "' + r1b.error + '"'));
  assert(!pool(w).some((p) => p.maKho === p4 || p.maKho === noAns));
  // chạy lại
  const n0 = w.g._sheets.LuyenTap.getLastRow();
  const r2 = sync(w, { filter: {}, mode: 'them' });
  assert.strictEqual(r2.them, 0, 'chạy lại vẫn thêm ' + r2.them); assert.strictEqual(w.g._sheets.LuyenTap.getLastRow(), n0);
  // sửa nội dung một câu trong kho → capNhat
  const kh = w.g._external[w.kho.khoId]._sheets['Kho câu hỏi']._data();
  const target = pl[0].maKho; const kr = kh.find((r) => r[0] === target); kr[8] = kr[8] + ' (đã sửa)';
  const r3 = sync(w, { filter: {}, mode: 'them' });
  assert(r3.capNhat >= 1, 'capNhat=' + r3.capNhat); assert(/đã sửa/.test(pool(w).find((p) => p.maKho === target).noiDung));
  assert.strictEqual(w.g._sheets.LuyenTap.getLastRow(), n0);
  // thay bằng 5 câu
  const keep = pl.slice(0, 5).map((p) => p.maKho);
  const r4 = sync(w, { maKho: keep, mode: 'thay' });
  const pl2 = pool(w);
  assert.strictEqual(w.g._sheets.LuyenTap.getLastRow(), n0, '"thay" làm đổi số hàng');
  assert.strictEqual(pl2.filter((p) => p.bat === 'CO').length, 5);
  assert(keep.every((m) => pl2.find((p) => p.maKho === m).bat === 'CO'));
  assert.strictEqual(r4.tat, pl.length - 5, 'tat=' + r4.tat);
  // ghi vào kho = 0
  const ext = w.g._stats.extWrites[w.kho.khoId] || 0;
  assert.strictEqual(ext, 0, 'kho bị ghi ' + ext + ' lần');
  info(`chạy lại: them=0; sửa kho → capNhat=${r3.capNhat}; "thay" 5 câu → tat=${r4.tat}, số hàng giữ ${n0 - 1}; ghi vào kho: ${ext}`);
});

// ---------- TC-4.2 ----------
t('TC-4.2 practiceMeta theo khối lớp (10A1, 11B2, 12A1, CLB), chỉ bat=CO, không có nội dung/đáp án', () => {
  const std = K.standardRows();
  const l10 = [K.row({ lop: 11, phan: 1, cau: 31, dapAn: 'A' }), K.row({ lop: 11, phan: 1, cau: 32, dapAn: 'B' }), K.row({ lop: 11, phan: 3, cau: 33, dapAn: '1,5' })].map(lop10);
  const w = world({ rows: std.concat(l10), classes: ['10A1', '11B2', 'CLB'] });
  // tắt 3 câu lớp 12
  const off = pool(w).filter((p) => lopNum(p.lop) === 12).slice(0, 3).map((p) => p.maKho);
  assert.strictEqual(ok(w.A('adminPracticeToggle', { maKho: off, bat: 'KHONG' })).n, 3);
  const pl = pool(w).filter((p) => p.bat === 'CO');
  const sumMeta = (m) => m.cay.reduce((s, c) => s + c.dem.TN + c.dem.DS + c.dem.TL, 0);
  const exp = (k) => { const x = pl.filter((p) => k == null || lopNum(p.lop) === k); return { n: x.length, TN: x.filter((p) => p.loai === 'TN').length }; };
  const res = [];
  for (const [lop, k] of [['10A1', 10], ['11B2', 11], ['12A1', 12], ['CLB', null]]) {
    const m = ok(w.S(lop, 'practiceMeta'), 'practiceMeta ' + lop);
    const j = JSON.stringify(m);
    assert(!/"(noiDung|dapAn|loiGiai|maKho|A|B)"\s*:/.test(j), lop + ': có trường nội dung/đáp án');
    assert(!pl.some((p) => j.includes(p.maKho)) && !pl.some((p) => j.includes(p.noiDung)), lop + ': lộ mã/nội dung');
    const e = exp(k);
    assert.strictEqual(sumMeta(m), e.n, `${lop}: meta ${sumMeta(m)} ≠ ${e.n}`);
    assert.strictEqual(m.cay.reduce((s, c) => s + c.dem.TN, 0), e.TN);
    ['cay', 'soCauSai', 'nhanh', 'soBai', 'diemTB'].forEach((f) => assert(f in m, lop + ' thiếu ' + f));
    res.push(`${lop}: ${sumMeta(m)}`);
  }
  info(res.join(' · ') + ` (đã tắt ${off.length} câu lớp 12)`);
});

// ---------- TC-4.3 ----------
t('TC-4.3 practiceStart TU_TAO 10–2–3 trong một bài: đúng 15 câu, đúng bài, không lộ dapAn/loiGiai/maKho', () => {
  const w = world({ rows: K.bigRows(300) });
  const ch = 'Chương I. Vật lí nhiệt'; const bai = 'Bài 1. Cấu trúc của chất. Sự chuyển thể';
  const pl = pool(w); const by = new Map(pl.map((p) => [p.noiDung, p]));
  for (let k = 0; k < 5; k++) {
    const s = ok(practice(w, null, { kieu: 'TU_TAO', chuong: [], bai: [bai], so: { TN: 10, DS: 2, TL: 3 }, phut: 20 }));
    assert.strictEqual(s.questions.length, 15);
    const src = s.questions.map((q) => by.get(q.noiDung));
    assert(src.every(Boolean), 'câu không thuộc pool');
    assert(src.every((p) => p.bai === bai && p.chuong === ch), 'có câu ngoài bài: ' + src.filter((p) => p.bai !== bai).map((p) => p.bai));
    const c = { TN: 0, DS: 0, TL: 0 }; s.questions.forEach((q) => c[q.loai]++);
    assert.deepStrictEqual(c, { TN: 10, DS: 2, TL: 3 });
    assert.strictEqual(new Set(contents(s)).size, 15, 'trùng câu');
    assert.strictEqual(s.durationSec, 1200);
    assert(s.exam && s.exam.tieuDe, 'thiếu exam.tieuDe');
    const lk = leaks(s, w); assert.deepStrictEqual(lk, [], 'lộ: ' + lk.join('; '));
    // không trả đáp án dưới tên khác: không có trường nào trùng giá trị đáp án DS (DSDS…) hoặc TL
    s.questions.forEach((q) => { const p = by.get(q.noiDung); if (q.loai !== 'TN') { const hit = Object.keys(q).filter((k) => q[k] !== '' && (q[k] === p.dapAn || q[k] === normTF(p.dapAn))); assert.deepStrictEqual(hit, [], 'giá trị đáp án trong câu: ' + hit + '=' + p.dapAn); } });
  }
  const s = ok(practice(w, null, { kieu: 'TU_TAO', chuong: [ch], bai: [bai], so: { TN: 10, DS: 2, TL: 3 }, phut: 20 }));
  const tp = decodeTok(s.attemptToken).p;
  info(`5 lần: 15 câu (10-2-3), 1200 s; khóa trong token: ${Object.keys(tp).join(',')} (qids = mã kho, chỉ mã hóa base64)`);
  // chương + bài cùng gửi: vòng 2 (N-1) lấy GIAO — xem mục Vòng 2
  const su = ok(practice(w, null, { kieu: 'TU_TAO', chuong: [ch], bai: [bai], so: { TN: 10, DS: 2, TL: 3 }, phut: 20 }));
  const outside = su.questions.filter((q) => by.get(q.noiDung).bai !== bai).length;
  info('gửi chuong=[Chương I] + bai=[Bài 1]: ' + outside + '/15 câu thuộc bài khác của chương');
  // chỉ chọn chương
  const s2 = ok(practice(w, null, { kieu: 'TU_TAO', chuong: [ch], bai: [], so: { TN: 8, DS: 0, TL: 0 }, phut: 10 }));
  assert(s2.questions.every((q) => by.get(q.noiDung).chuong === ch));
});

t('TC-4.3 Giới hạn tổng 5–40 câu, 5–90 phút; mucTieu ngoài 0–10 bị từ chối', () => {
  const w = world({ rows: K.bigRows(300) });
  const tries = [[{ TN: 4, DS: 0, TL: 0 }, 10], [{ TN: 30, DS: 6, TL: 5 }, 10], [{ TN: 5, DS: 0, TL: 0 }, 4], [{ TN: 5, DS: 0, TL: 0 }, 91]];
  const out = tries.map(([so, phut]) => { const r = practice(w, null, { kieu: 'TU_TAO', chuong: [], bai: [], so, phut }); return r.ok ? `n=${r.data.questions.length},${r.data.durationSec}s` : 'lỗi "' + r.error + '"'; });
  info('4 câu → ' + out[0] + ' · 41 câu → ' + out[1] + ' · 4 phút → ' + out[2] + ' · 91 phút → ' + out[3]);
  [0, 1].forEach((i) => { const r = practice(w, null, { kieu: 'TU_TAO', chuong: [], bai: [], so: tries[i][0], phut: 10 }); assert(!r.ok || (r.data.questions.length >= 5 && r.data.questions.length <= 40), 'vượt giới hạn câu: ' + out[i]); });
  [2, 3].forEach((i) => { const r = practice(w, null, { kieu: 'TU_TAO', chuong: [], bai: [], so: tries[i][0], phut: tries[i][1] }); assert(!r.ok || (r.data.durationSec >= 300 && r.data.durationSec <= 5400), 'vượt giới hạn phút: ' + out[i]); });
  assert(!practice(w, null, { kieu: 'TU_TAO', chuong: [], bai: [], so: { TN: 5 }, phut: 10, mucTieu: 11 }).ok, 'mucTieu 11 được nhận');
  assert(!practice(w, null, { kieu: 'LA', chuong: [], bai: [], so: { TN: 5 }, phut: 10 }).ok, 'kiểu lạ được nhận');
});

t('TC-4.3 Ưu tiên câu chưa làm: bài có 12 câu P1, làm 6 câu → lần sau đúng 6 câu còn lại', () => {
  const w = world({ rows: rowsBai14(12) });
  const body = { kieu: 'TU_TAO', chuong: ['Chương III. Từ trường'], bai: ['Bài 14. Từ trường'], so: { TN: 6, DS: 0, TL: 0 }, phut: 10 };
  const s1 = ok(practice(w, null, body));
  ok(w.S(null, 'submitExam', { attemptToken: s1.attemptToken, answers: answer(w, s1) }));
  const s2 = ok(practice(w, null, body));
  const inter = contents(s2).filter((c) => contents(s1).includes(c));
  assert.strictEqual(inter.length, 0, 'lần 2 lặp ' + inter.length + ' câu đã làm');
  // câu chỉ BẮT ĐẦU mà chưa nộp thì không tính là đã làm (theo q trong KetQuaLuyenTap)
  const s3 = ok(practice(w, null, Object.assign({}, body, { so: { TN: 12 } })));
  assert.strictEqual(s3.questions.length, 12);
  info('lần 1 ∩ lần 2 = 0 câu');
});

// ---------- TC-4.4 ----------
t('TC-4.4 Nộp: điểm đúng quy tắc; ghi KetQuaLuyenTap (điểm là số, kieu, q), KetQua không thêm hàng; kết quả có lời giải', () => {
  const w = world({ rows: K.bigRows(300) });
  const ch = 'Chương I. Vật lí nhiệt'; const bai = 'Bài 1. Cấu trúc của chất. Sự chuyển thể';
  const s = ok(practice(w, null, { kieu: 'TU_TAO', chuong: [ch], bai: [bai], so: { TN: 10, DS: 2, TL: 3 }, phut: 20, mucTieu: 9 }));
  const book = answerBook(w);
  // TN: 5 đúng 5 sai; DS1: đúng 3/4 ý; DS2: đúng hết; TL: 1 đúng 2 sai → 1,25 + 0,5 + 1 + 0,25 = 3 / 5,25 → 5,71
  const ans = {}; let tn = 0; let ds = 0; let tl = 0;
  s.questions.forEach((q) => {
    const b = book.get(q.noiDung); const k = q.stt;
    if (q.loai === 'TN') ans[k] = ansOf(q, b, tn++ < 5);
    else if (q.loai === 'DS') { const a = ansOf(q, b, true); if (ds++ === 0) a[3] = a[3] === 'D' ? 'S' : 'D'; ans[k] = a; }
    else ans[k] = ansOf(q, b, tl++ === 0);
  });
  const n0 = KQ(w); const l0 = KQLT(w);
  const r = ok(w.S(null, 'submitExam', { attemptToken: s.attemptToken, answers: ans }));
  assert.strictEqual(r.diemGoc, 3); assert.strictEqual(r.diemToiDa, 5.25); assert.strictEqual(r.diem, 5.71);
  assert.strictEqual(KQ(w), n0, 'KetQua thêm hàng'); assert.strictEqual(KQLT(w), l0 + 1);
  assert(/^LT/.test(r.id), 'id ' + r.id);
  const d = w.g._sheets.KetQuaLuyenTap._data(); const h = d[0]; const row = d[d.length - 1];
  assert.strictEqual(typeof row[h.indexOf('Điểm (thang 10)')], 'number'); assert.strictEqual(row[h.indexOf('Điểm (thang 10)')], 5.71);
  assert.strictEqual(typeof row[h.indexOf('Điểm gốc')], 'number');
  assert.strictEqual(row[h.length - 1], 'TU_TAO');
  const ct = JSON.parse(row[h.indexOf('Chi tiết (JSON)')]);
  assert.strictEqual(ct.length, 15); assert(ct.every((x) => x.q && pool(w).some((p) => p.maKho === x.q)), 'chiTiet thiếu q = maKho');
  // kết quả kèm lời giải + đáp án
  assert(r.items && r.items.length === 15);
  const withSol = r.items.filter((it) => it.loiGiai && it.dapAn != null).length;
  assert.strictEqual(withSol, 15, 'chỉ ' + withSol + '/15 câu có lời giải');
  assert(r.goal && r.goal.dat === false, 'mục tiêu không được so');
  info(`diem=${r.diem} (3/5,25), KetQua giữ ${n0} hàng, KetQuaLuyenTap +1, kieu TU_TAO, 15/15 câu có lời giải; goal=${JSON.stringify({ dat: r.goal.dat, chenh: r.goal.chenh })}`);
  // đúng hết → 10
  const s2 = ok(practice(w, null, { kieu: 'TU_TAO', chuong: [ch], bai: [bai], so: { TN: 10, DS: 2, TL: 3 }, phut: 20 }));
  assert.strictEqual(ok(w.S(null, 'submitExam', { attemptToken: s2.attemptToken, answers: answer(w, s2) })).diem, 10);
});

// ---------- TC-4.5 ----------
t('TC-4.5 Bảng xếp hạng, adminGradebook, adminExamStats, gợi ý đề tương tự không đổi sau 5 bài luyện', () => {
  const w = world({ classes: ['12A2'] });
  // dữ liệu thi thật: 2 HS làm DEMAU; có đề cùng chủ đề để gợi ý
  saveExam(w, { tieuDe: 'Luyện Khí lí tưởng', trangThai: 'MO' }, [manual('Câu tay KLT 1'), Object.assign(manual('Câu tay KLT 2'), { chuDe: 'Khí lí tưởng' })].map((q) => Object.assign(q, { chuDe: 'Khí lí tưởng' })));
  doExam(w, '12A1', 'DEMAU', (q) => q.loai !== 'TN');
  doExam(w, '12A2', 'DEMAU', () => false);
  const goalOf = () => { const s = ok(w.S(null, 'startExam', { examId: 'DEMAU', mucTieu: 9.5 })); return ok(w.S(null, 'submitExam', { attemptToken: s.attemptToken, answers: answer(w, s, (q) => q.loai !== 'TN') })).goal.goiY; };
  const g1 = goalOf();
  const snap = () => ({
    lbS: ok(w.S(null, 'leaderboard', { examId: 'DEMAU' })), lbS2: ok(w.S(null, 'leaderboard', {})), lbT: ok(w.A('leaderboard', {})),
    gb: ok(w.A('adminGradebook')), stats: ok(w.A('adminExamStats', { examId: 'DEMAU' })), my: ok(w.S(null, 'myResults', {})),
    ex: ok(w.S(null, 'listExams', {})), kq: KQ(w)
  });
  const A = snap();
  for (let i = 0; i < 5; i++) { const s = ok(practice(w, null, { kieu: 'TU_TAO', chuong: [], bai: [], so: { TN: 5, DS: 1, TL: 1 }, phut: 10 })); ok(w.S(null, 'submitExam', { attemptToken: s.attemptToken, answers: answer(w, s, (q) => q.loai === 'TN') })); }
  const B = snap();
  for (const k of Object.keys(A)) assert.deepStrictEqual(B[k], A[k], k + ' đổi sau 5 bài luyện');
  const g2 = goalOf();
  assert.deepStrictEqual(g2, g1, 'gợi ý đề tương tự đổi');
  assert.strictEqual(KQLT(w), 6);
  const ov = ok(w.A('adminOverview')); const ms = ok(w.S(null, 'myStats'));
  info(`8 mục so sánh giống hệt (bảng xếp hạng HS/đề, HS/tất cả, GV; bảng điểm; thống kê đề; myResults; listExams; số hàng KetQua); gợi ý: ${g1.map((x) => x.tieuDe).join(',')}; adminOverview.counts.results=${ov.counts && ov.counts.results}; myStats.count=${ms.count}`);
});

// ---------- TC-4.6 ----------
t('TC-4.6 CAU_SAI: có X (đề NGAY đã đóng) và Y (bài luyện), không có Z (đề SAU_HAN đang mở); làm đúng Y thì Y bị rút', () => {
  const w = world({ rows: K.bigRows(200) });
  const pl = pool(w);
  const X = pl[0]; const Z = pl[1];
  const e1 = saveExam(w, { tieuDe: 'Đề NGAY', trangThai: 'MO', hienLoiGiai: 'NGAY' }, toQuestions(w, [X.maKho]).concat([manual('Câu tay X2 đề NGAY (tự soạn)', 'B')]));
  const e2 = saveExam(w, { tieuDe: 'Đề SAU_HAN', trangThai: 'MO', hienLoiGiai: 'SAU_HAN' }, toQuestions(w, [Z.maKho]).concat([manual('Câu tay Z2 đề SAU_HAN (tự soạn)', 'C')]));
  doExam(w, null, e1, () => true); doExam(w, null, e2, () => true);
  setExam(w, e1, { trangThai: 'DONG' }); // đặc tả 19/11: chỉ đề ĐÃ ĐÓNG + canReveal mới mở câu
  // bài luyện: sai đúng 1 câu Y (P1), đúng các câu khác
  const s = ok(practice(w, null, { kieu: 'TU_TAO', chuong: [], bai: [], so: { TN: 5, DS: 0, TL: 0 }, phut: 10 }));
  let Y = null;
  ok(w.S(null, 'submitExam', { attemptToken: s.attemptToken, answers: answer(w, s, (q) => { if (q.noiDung === X.noiDung) return true; if (!Y && q.noiDung !== X.noiDung && q.noiDung !== Z.noiDung) { Y = q.noiDung; return true; } return false; }) }));
  const m = ok(w.S(null, 'practiceMeta'));
  const c = ok(practice(w, null, { kieu: 'CAU_SAI' }));
  const set = contents(c);
  const lk = leaks(c, w); assert.deepStrictEqual(lk, [], 'CAU_SAI lộ: ' + lk.join('; '));
  assert(set.includes(X.noiDung), 'thiếu X'); assert(set.includes('Câu tay X2 đề NGAY (tự soạn)'), 'thiếu câu tay X2'); assert(set.includes(Y), 'thiếu Y');
  assert(!set.includes(Z.noiDung), 'có Z'); assert(!set.includes('Câu tay Z2 đề SAU_HAN (tự soạn)'), 'có Z2');
  assert.strictEqual(set.length, 3, 'tập: ' + set.length + ' câu'); assert.strictEqual(m.soCauSai, 3, 'soCauSai=' + m.soCauSai);
  const lt = (c.questions.length && decodeTok(c.attemptToken).p.qids) || [];
  info(`soCauSai=${m.soCauSai}; qids=${JSON.stringify(lt)}`);
  // làm đúng Y, sai X → Y rút, X còn
  const r = ok(w.S(null, 'submitExam', { attemptToken: c.attemptToken, answers: answer(w, c, (q) => q.noiDung !== Y) }));
  assert(/^LT/.test(r.id));
  const d = w.g._sheets.KetQuaLuyenTap._data(); assert.strictEqual(d[d.length - 1][d[0].length - 1], 'CAU_SAI');
  const set2 = contents(ok(practice(w, null, { kieu: 'CAU_SAI' })));
  assert(!set2.includes(Y), 'Y chưa bị rút'); assert(set2.includes(X.noiDung));
  // đóng đề SAU_HAN → Z, Z2 vào tập
  setExam(w, e2, { trangThai: 'DONG' });
  const set3 = contents(ok(practice(w, null, { kieu: 'CAU_SAI' })));
  assert(set3.includes('Câu tay Z2 đề SAU_HAN (tự soạn)') && set3.includes(Z.noiDung), 'đóng đề mà Z chưa vào tập');
  // xóa đề NGAY → câu tay X2 (examId#stt) ra khỏi tập
  ok(w.A('adminDeleteExam', { examId: e1 }));
  const set4 = contents(ok(practice(w, null, { kieu: 'CAU_SAI' })));
  assert(!set4.includes('Câu tay X2 đề NGAY (tự soạn)'), 'đề đã xóa vẫn còn câu tay');
  info(`sau khi làm đúng Y: ${set2.length} câu; đóng đề SAU_HAN: ${set3.length}; xóa đề NGAY: ${set4.length} (X theo maKho ${set4.includes(X.noiDung) ? 'còn' : 'mất'})`);
});

t('TC-4.6 CAU_SAI tối đa 20 câu, câu sai gần nhất trước; chưa có câu sai → báo rõ, không lỗi', () => {
  const w = world({ rows: K.bigRows(200) });
  const e = ok(practice(w, null, { kieu: 'CAU_SAI' }).ok ? practice(w, null, { kieu: 'CAU_SAI' }) : { ok: true, data: null });
  const r0 = practice(w, null, { kieu: 'CAU_SAI' });
  info('chưa có câu sai: ' + (r0.ok ? `${r0.data.questions.length} câu, thongBao=${JSON.stringify(r0.data.thongBao)}` : 'lỗi "' + r0.error + '"'));
  assert(!r0.ok || r0.data.questions.length === 0); void e;
  const s1 = ok(practice(w, null, { kieu: 'TU_TAO', chuong: [], bai: [], so: { TN: 15, DS: 0, TL: 0 }, phut: 10 }));
  ok(w.S(null, 'submitExam', { attemptToken: s1.attemptToken, answers: answer(w, s1, () => true) }));
  w.g._clock.advance(5000);
  const s2 = ok(practice(w, null, { kieu: 'TU_TAO', chuong: [], bai: [], so: { TN: 10, DS: 0, TL: 0 }, phut: 10 }));
  ok(w.S(null, 'submitExam', { attemptToken: s2.attemptToken, answers: answer(w, s2, () => true) }));
  const newer = contents(s2);
  assert.strictEqual(newer.filter((x) => contents(s1).includes(x)).length, 0, 'lần 2 trùng lần 1 (ưu tiên câu chưa làm)');
  const m = ok(w.S(null, 'practiceMeta'));
  const c = ok(practice(w, null, { kieu: 'CAU_SAI' }));
  assert.strictEqual(c.questions.length, 20);
  assert(newer.every((x) => contents(c).includes(x)), 'thiếu câu sai gần nhất');
  info(`25 câu sai → soCauSai=${m.soCauSai}, CAU_SAI ${c.questions.length} câu, đủ 10 câu sai gần nhất`);
});

// ---------- TC-4.7 ----------
t('TC-4.7 NHANH: bài đủ câu → 7–1–2, 600 s; bài thiếu → bổ sung cùng chương, có thông báo', () => {
  const extra = [];
  // Chương III: Bài 14 chỉ 4 P1 + 1 P3; các câu khác cùng chương III không có (Chương III chỉ có Bài 14 trong kho giả) →
  // dùng Chương II: "Bài 11" thiếu, "Bài 9" nhiều
  for (let i = 0; i < 4; i++) extra.push(K.row({ phan: 1, cau: 100 + i, ch: 1, bai: 1, dapAn: 'A', noiDung: `B11 P1 số ${i} (tự soạn).` }));
  extra.push(K.row({ phan: 3, cau: 110, ch: 1, bai: 1, dapAn: '2,5', noiDung: 'B11 P3 (tự soạn).' }));
  for (let i = 0; i < 12; i++) extra.push(K.row({ phan: 1, cau: 120 + i, ch: 1, bai: 0, dapAn: 'B', noiDung: `B9 P1 số ${i} (tự soạn).` }));
  for (let i = 0; i < 3; i++) extra.push(K.row({ phan: 2, cau: 140 + i, ch: 1, bai: 0, dapAn: 'a) Đ b) S c) Đ d) S', noiDung: `B9 P2 số ${i} (tự soạn).` }));
  for (let i = 0; i < 3; i++) extra.push(K.row({ phan: 3, cau: 150 + i, ch: 1, bai: 0, dapAn: '1,5', noiDung: `B9 P3 số ${i} (tự soạn).` }));
  for (let i = 0; i < 10; i++) extra.push(K.row({ phan: 1, cau: 160 + i, ch: 0, bai: 0, dapAn: 'C', noiDung: `Chương I P1 số ${i} (tự soạn).` }));
  const w = world({ rows: extra });
  const by = new Map(pool(w).map((p) => [p.noiDung, p]));
  const m = ok(w.S(null, 'practiceMeta'));
  assert.deepStrictEqual(m.nhanh, { TN: 7, DS: 1, TL: 2, phut: 10 });
  const C2 = 'Chương II. Khí lí tưởng';
  const full = ok(practice(w, null, { kieu: 'NHANH', chuong: [C2], bai: ['Bài 9. Định luật Boyle'] }));
  const cnt = (s) => { const c = { TN: 0, DS: 0, TL: 0 }; s.questions.forEach((q) => c[q.loai]++); return c; };
  assert.deepStrictEqual(cnt(full), { TN: 7, DS: 1, TL: 2 }); assert.strictEqual(full.durationSec, 600);
  assert(full.questions.every((q) => by.get(q.noiDung).bai === 'Bài 9. Định luật Boyle'));
  const lk = leaks(full, w); assert.deepStrictEqual(lk, [], 'NHANH lộ: ' + lk.join('; '));
  const short = ok(practice(w, null, { kieu: 'NHANH', chuong: [C2], bai: ['Bài 11. Phương trình trạng thái khí lí tưởng'] }));
  const src = short.questions.map((q) => by.get(q.noiDung));
  assert(src.every((p) => p.chuong === C2), 'bổ sung ngoài chương: ' + src.filter((p) => p.chuong !== C2).map((p) => p.chuong));
  assert.strictEqual(src.filter((p) => p.bai === 'Bài 11. Phương trình trạng thái khí lí tưởng').length, 5, 'không lấy hết câu của bài');
  assert.deepStrictEqual(cnt(short), { TN: 7, DS: 1, TL: 2 });
  const tb = JSON.stringify(short.thongBao || short.canhBao || '');
  assert(tb.length > 4 && /thiếu|chỉ|mới có|thêm|bổ sung/i.test(tb), 'không có thông báo: ' + tb);
  info(`bài đủ: 7-1-2, 600 s; bài thiếu (4 P1, 0 P2, 1 P3) → 7-1-2 cùng chương, thông báo: ${tb}`);
  // đổi CaiDat LUYEN_NHANH
  K.setSetting(w.g, { LUYEN_NHANH: '5,2,1,8' });
  const m2 = ok(w.S(null, 'practiceMeta'));
  const f2 = ok(practice(w, null, { kieu: 'NHANH', chuong: [C2], bai: ['Bài 9. Định luật Boyle'] }));
  assert.deepStrictEqual(m2.nhanh, { TN: 5, DS: 2, TL: 1, phut: 8 }); assert.deepStrictEqual(cnt(f2), { TN: 5, DS: 2, TL: 1 }); assert.strictEqual(f2.durationSec, 480);
  // chương cũng thiếu → đề ít câu hơn, nói rõ
  const ch3 = ok(practice(w, null, { kieu: 'NHANH', chuong: ['Chương I. Vật lí nhiệt'], bai: ['Bài 1. Cấu trúc của chất. Sự chuyển thể'] }));
  info(`chương cũng thiếu (chỉ 10 P1): ${ch3.questions.length} câu ${JSON.stringify(cnt(ch3))}, thông báo ${JSON.stringify(ch3.thongBao)}`);
  assert(JSON.stringify(ch3.thongBao || '').length > 4, 'thiếu câu mà không báo');
});

// ---------- TC-4.8 ----------
t('TC-4.8 Token: a vào nhánh p, p sửa qids, sid khác, hết hạn bị từ chối; nộp lại không ghi thêm', () => {
  const w = world({ classes: ['12A2'] });
  const s = ok(practice(w, null, { kieu: 'TU_TAO', chuong: [], bai: [], so: { TN: 5, DS: 1, TL: 1 }, phut: 10 }));
  const ans = answer(w, s);
  const { p, a: pa, s: psig } = decodeTok(s.attemptToken);
  const n0 = KQLT(w); const k0 = KQ(w);
  const rej = [];
  assert.strictEqual(signTok(w.g, p), s.attemptToken, 'đối chứng: ký lại payload gốc phải ra đúng token (cách ký của bài test đúng)');
  const tryTok = (label, tok, lop) => { const r = w.S(lop || null, 'submitExam', { attemptToken: tok, answers: ans }); rej.push(label + ': ' + (r.ok ? 'NHẬN' : '"' + r.error + '"')); return r; };
  // 1) sửa qids (giữ chữ ký cũ)
  const other = pool(w).map((x) => x.maKho).filter((m) => !p.qids.includes(m));
  assert(!tryTok('sửa qids', b64(JSON.stringify(Object.assign({}, p, { qids: p.qids.slice(0, -1).concat([other[0]]) }))) + '.' + psig).ok);
  assert(!tryTok('bớt qids', b64(JSON.stringify(Object.assign({}, p, { qids: p.qids.slice(0, 1) }))) + '.' + psig).ok);
  assert(!tryTok('đổi thứ tự qids', b64(JSON.stringify(Object.assign({}, p, { qids: p.qids.slice().reverse() }))) + '.' + psig).ok);
  assert(!tryTok('chữ ký của token khác', pa + '.' + decodeTok(w.st['12A1']).s).ok);
  // 2) sid khác: HS 12A2 nộp token của HS0001; và HS0001 sửa sid trong token
  assert(!tryTok('HS khác nộp token', s.attemptToken, '12A2').ok);
  // 3) hết hạn (token ký đúng khóa, exp đã qua)
  const now = Date.now();
  assert(!tryTok('hết hạn (ký đúng)', signTok(w.g, Object.assign({}, p, { st: now - 7200e3, exp: now - 1000 }))).ok);
  assert(!tryTok('hết hạn (sửa exp, chữ ký cũ)', b64(JSON.stringify(Object.assign({}, p, { exp: now + 9e9 }))) + '.' + psig).ok);
  // 4) token a vào nhánh p: đổi t a→p giữ chữ ký; và ngược lại
  const sa = ok(w.S(null, 'startExam', { examId: 'DEMAU' }));
  const A = decodeTok(sa.attemptToken);
  assert(!tryTok('token a đổi t=p', b64(JSON.stringify(Object.assign({}, A.p, { t: 'p', qids: p.qids, kieu: 'TU_TAO' }))) + '.' + A.s).ok);
  assert(!tryTok('token p đổi t=a', b64(JSON.stringify(Object.assign({}, p, { t: 'a', eid: 'DEMAU' }))) + '.' + psig).ok);
  // token a hợp lệ kèm qids/kieu (ký đúng khóa) không được ghi vào KetQuaLuyenTap
  const forgedA = signTok(w.g, Object.assign({}, A.p, { qids: p.qids, kieu: 'TU_TAO' }));
  const ra = w.S(null, 'submitExam', { attemptToken: forgedA, answers: ans });
  assert.strictEqual(KQLT(w), n0, 'token a ghi vào KetQuaLuyenTap');
  rej.push('token a (ký đúng) kèm qids: ' + (ra.ok ? 'chấm như đề ' + ra.data.examId + ', id ' + ra.data.id : '"' + ra.error + '"'));
  if (ra.ok) assert(!/^LT/.test(ra.data.id));
  const k1 = KQ(w); // token a ký đúng → bài thi bình thường (1 hàng KetQua, hợp lệ)
  // token đăng nhập (t=s) dùng làm attemptToken
  assert(!tryTok('token đăng nhập', w.st['12A1']).ok);
  assert.strictEqual(KQLT(w), n0, 'có hàng luyện tập bị ghi');
  // 5) nộp hợp lệ, rồi nộp lại
  const r1 = ok(w.S(null, 'submitExam', { attemptToken: s.attemptToken, answers: ans }));
  const r2 = w.S(null, 'submitExam', { attemptToken: s.attemptToken, answers: {} });
  assert.strictEqual(KQLT(w), n0 + 1, 'nộp lại ghi thêm hàng');
  if (r2.ok) { assert.strictEqual(r2.data.id, r1.id); assert.strictEqual(r2.data.diem, r1.diem, 'nộp lại đổi điểm'); }
  rej.push('nộp lại: ' + (r2.ok ? 'trả lại bài cũ ' + r2.data.id + ' điểm ' + r2.data.diem : '"' + r2.error + '"'));
  // HS khác sau khi nộp
  assert(!w.S('12A2', 'submitExam', { attemptToken: s.attemptToken, answers: ans }).ok || KQLT(w) === n0 + 1);
  // hết hạn theo đồng hồ (tua đồng hồ giả của shim nếu Code.gs dùng nowMs_)
  const s2 = ok(practice(w, null, { kieu: 'TU_TAO', chuong: [], bai: [], so: { TN: 5 }, phut: 5 }));
  w.g._clock.advance(48 * 3600e3);
  const late = w.S(null, 'submitExam', { attemptToken: s2.attemptToken, answers: {} });
  w.g._clock.advance(-48 * 3600e3);
  rej.push('nộp sau 48 giờ (đồng hồ giả): ' + (late.ok ? 'NHẬN' : '"' + late.error + '"'));
  // (đồng hồ giả chỉ tác động nowMs_; nếu Code.gs so exp bằng Date.now thì phép thử này không có hiệu lực — chỉ ghi nhận)
  assert.strictEqual(KQ(w), k1, 'KetQua bị ghi'); void k0;
  rej.forEach(info);
});

// ---------- TC-4.9 ----------
t('TC-4.9 Xem lại bài luyện sau "thay" pool + tắt câu: đủ câu + lời giải; câu xóa tay khỏi sheet → "Câu đã bị gỡ"', () => {
  const w = world({ classes: ['12A2'] });
  const s = ok(practice(w, null, { kieu: 'TU_TAO', chuong: [], bai: [], so: { TN: 5, DS: 1, TL: 1 }, phut: 10 }));
  const r = ok(w.S(null, 'submitExam', { attemptToken: s.attemptToken, answers: answer(w, s, (q) => q.loai === 'DS') }));
  const qids = decodeTok(s.attemptToken).p.qids;
  // myResults
  const lt = ok(w.S(null, 'myResults', { loai: 'luyen' })); const th = ok(w.S(null, 'myResults', {}));
  assert(lt.some((x) => x.id === r.id) && !th.some((x) => x.id === r.id), 'myResults lọc sai');
  // thay pool bằng 3 câu khác, tắt thêm 1 câu trong bài
  const others = pool(w).map((p) => p.maKho).filter((m) => !qids.includes(m)).slice(0, 3);
  sync(w, { maKho: others, mode: 'thay' });
  ok(w.A('adminPracticeToggle', { maKho: [qids[0]], bat: 'KHONG' }));
  const v = ok(w.S(null, 'getResult', { resultId: r.id }));
  assert.strictEqual(v.items.length, 7);
  assert(v.items.every((it) => it.noiDung && it.loiGiai && it.dapAn != null), 'thiếu nội dung/lời giải: ' + v.items.filter((it) => !it.loiGiai).length);
  assert.strictEqual(v.diem, r.diem);
  const vt = ok(w.A('getResult', { resultId: r.id }));
  assert.strictEqual(vt.items.length, 7);
  assert(!w.S('12A2', 'getResult', { resultId: r.id }).ok, 'HS khác xem được bài luyện');
  // xóa tay hàng của qids[1] khỏi LuyenTap
  const d = w.g._sheets.LuyenTap._data(); const idx = d.findIndex((x) => x[0] === qids[1]); d.splice(idx, 1);
  const v2 = ok(w.S(null, 'getResult', { resultId: r.id }));
  const gone = v2.items.filter((it) => /Câu đã bị gỡ/.test(JSON.stringify(it)));
  assert.strictEqual(v2.items.length, 7); assert.strictEqual(gone.length, 1, 'số câu báo bị gỡ: ' + gone.length);
  const rest = v2.items.filter((it) => !/Câu đã bị gỡ/.test(JSON.stringify(it)));
  assert(rest.every((it) => it.loiGiai), 'câu còn lại mất lời giải (có thể do chỉ mục đệm lệch hàng sau khi xóa tay)');
  // nội dung từng câu còn lại phải đúng câu đã làm (không lệch hàng)
  const want = s.questions.map((q) => q.noiDung);
  const bad = rest.filter((it) => !want.includes(it.noiDung));
  assert.deepStrictEqual(bad.map((x) => x.noiDung.slice(0, 40)), [], 'câu hiện sai nội dung sau khi xóa hàng');
  info(`sau "thay" + tắt: 7/7 câu có lời giải; xóa tay 1 hàng: 1 câu "Câu đã bị gỡ", 6 câu đúng nội dung`);
});

// ---------- TC-4.10 ----------
t('TC-4.10 CHO_LUYEN_TAP=KHONG: practiceMeta, practiceStart, submitExam token p đều báo lỗi', () => {
  const w = world();
  const s = ok(practice(w, null, { kieu: 'TU_TAO', chuong: [], bai: [], so: { TN: 5 }, phut: 10 }));
  K.setSetting(w.g, { CHO_LUYEN_TAP: 'KHONG' });
  const n0 = KQLT(w);
  const m = w.S(null, 'practiceMeta'); const st = practice(w, null, { kieu: 'TU_TAO', chuong: [], bai: [], so: { TN: 5 }, phut: 10 });
  const c = practice(w, null, { kieu: 'CAU_SAI' }); const nh = practice(w, null, { kieu: 'NHANH', chuong: [], bai: [] });
  const sub = w.S(null, 'submitExam', { attemptToken: s.attemptToken, answers: answer(w, s) });
  [m, st, c, nh, sub].forEach((r, i) => assert(!r.ok && OFF_MSG.test(r.error), 'lần ' + i + ': ' + JSON.stringify(r).slice(0, 120)));
  assert.strictEqual(KQLT(w), n0);
  const pc = ok(w.g.call('publicConfig'));
  assert(pc.features.includes('practice'));
  info(`5 lời gọi đều "${m.error}"; publicConfig.practice=${pc.practice}; myResults luyen: ${w.S(null, 'myResults', { loai: 'luyen' }).ok ? 'được' : 'lỗi'}`);
  assert.strictEqual(pc.practice, false, 'publicConfig không báo luyện tập đang tắt');
  // vẫn thi bình thường
  doExam(w, null, 'DEMAU', () => false);
  K.setSetting(w.g, { CHO_LUYEN_TAP: 'CO' });
  assert(w.S(null, 'practiceMeta').ok);
});

// ---------- TC-4.11 ----------
t('TC-4.11 Pool 3 000 câu: practiceStart chỉ đọc chỉ mục + hàng được chọn (đếm ô)', () => {
  const t0 = Date.now();
  const w = world({ rows: K.bigRows(3000), sheetReadMs: 0 });
  const nPool = pool(w).length; assert.strictEqual(nPool, 3000);
  const cols = w.g._sheets.LuyenTap._data()[0].length;
  info(`đồng bộ 3 000 câu: ${Date.now() - t0} ms (cả dựng kho giả), ${cols} cột`);
  const run = (label, body) => {
    w.g._resetStats();
    const t1 = Date.now();
    const s = ok(practice(w, null, body));
    const ms = Date.now() - t1;
    const st = w.g._stats;
    const c = st.cells.LuyenTap || 0; const full = st.reads.LuyenTap || 0;
    info(`${label}: ${s.questions.length} câu, ô đọc LuyenTap=${c} (cả trang = ${3001 * cols}), getDataRange LuyenTap=${full}, ô KetQuaLuyenTap=${st.cells.KetQuaLuyenTap || 0}, ${ms} ms`);
    return { s, c, full };
  };
  const body = { kieu: 'TU_TAO', chuong: [], bai: [], so: { TN: 20, DS: 10, TL: 10 }, phut: 60 };
  const cold = run('lần 1 (đệm trống)', body);
  const warm = run('lần 2 (có đệm)', body);
  const limitCold = 3000 * 8 + 40 * cols + 200;
  assert(cold.full === 0 || cold.c <= limitCold, 'đọc cả trang');
  assert(cold.c <= limitCold, `lần 1 đọc ${cold.c} ô > ${limitCold}`);
  assert(warm.c <= 40 * cols * 2 + 100, `lần 2 đọc ${warm.c} ô — chỉ mục không được đệm?`);
  // nộp + xem lại: chỉ đọc hàng
  w.g._resetStats();
  const r = ok(w.S(null, 'submitExam', { attemptToken: warm.s.attemptToken, answers: {} }));
  const cs = w.g._stats.cells.LuyenTap || 0;
  w.g._resetStats(); ok(w.S(null, 'getResult', { resultId: r.id })); const cg = w.g._stats.cells.LuyenTap || 0;
  w.g._resetStats(); ok(w.S(null, 'practiceMeta')); const cm = w.g._stats.cells.LuyenTap || 0;
  info(`nộp: ${cs} ô; xem lại: ${cg} ô; practiceMeta: ${cm} ô`);
  assert(cs <= limitCold && cg <= limitCold, 'nộp/xem lại đọc quá nhiều');
  // có SHEET_READ_MS = 300 (giả lập đọc cả trang chậm)
  w.g._env.sheetReadMs = 300; w.g._resetStats();
  const t2 = Date.now(); ok(practice(w, null, body)); info(`SHEET_READ_MS=300: practiceStart ${Date.now() - t2} ms`);
  w.g._env.sheetReadMs = 0;
});

// ---------- TC-4.12 ----------
t('TC-4.12 Sheet cũ không có LuyenTap/KetQuaLuyenTap: practiceMeta rỗng không lỗi; lần ghi đầu tự tạo trang có tiêu đề', () => {
  const w = world({ sync: false });
  const ss = w.g.SpreadsheetApp.getActiveSpreadsheet();
  ['LuyenTap', 'KetQuaLuyenTap'].forEach((n) => ss.deleteSheet(w.g._sheets[n]));
  // CaiDat cũ cũng không có các khóa mới (giáo viên tự đặt CHO_LUYEN_TAP=CO)
  const cd = w.g._sheets.CaiDat._data(); const li = cd.findIndex((r) => r[0] === 'LUYEN_NHANH'); cd.splice(li, 1);
  const m = ok(w.S(null, 'practiceMeta'), 'practiceMeta');
  assert.deepStrictEqual(m.cay, []); assert.strictEqual(m.soCauSai, 0);
  assert.deepStrictEqual(m.nhanh, { TN: 7, DS: 1, TL: 2, phut: 10 }, 'thiếu LUYEN_NHANH không về mặc định');
  const st = practice(w, null, { kieu: 'TU_TAO', chuong: [], bai: [], so: { TN: 5 }, phut: 10 });
  info('practiceStart khi pool trống: ' + (st.ok ? st.data.questions.length + ' câu' : '"' + st.error + '"'));
  assert(!st.ok || st.data.questions.length === 0);
  assert(ok(w.S(null, 'myResults', { loai: 'luyen' })).length === 0);
  assert(ok(w.A('adminPracticeList', { filter: {}, page: 1 })));
  assert(!w.g._sheets.LuyenTap || w.g._sheets.LuyenTap.getLastRow() <= 1);
  sync(w, { filter: {}, mode: 'them' });
  assert(w.g._sheets.LuyenTap, 'không tự tạo LuyenTap');
  assert.strictEqual(w.g._sheets.LuyenTap._data()[0][0], 'Mã câu kho');
  const s = ok(practice(w, null, { kieu: 'TU_TAO', chuong: [], bai: [], so: { TN: 5 }, phut: 10 }));
  ok(w.S(null, 'submitExam', { attemptToken: s.attemptToken, answers: answer(w, s) }));
  const kl = w.g._sheets.KetQuaLuyenTap; assert(kl, 'không tự tạo KetQuaLuyenTap');
  const h = kl._data()[0]; assert.strictEqual(h[0], 'Nộp lúc'); assert.strictEqual(kl.getLastRow(), 2);
  assert.strictEqual(typeof kl._data()[1][h.indexOf('Điểm (thang 10)')], 'number');
  // Sheet cũ có cột Kết quả nhưng thiếu cột "Kiểu" cuối → vẫn ghi được
  const d = kl._data(); d.forEach((r) => r.splice(h.length - 1, 1));
  const s2 = ok(practice(w, null, { kieu: 'TU_TAO', chuong: [], bai: [], so: { TN: 5 }, phut: 10 }));
  ok(w.S(null, 'submitExam', { attemptToken: s2.attemptToken, answers: {} }), 'ghi khi thiếu cột Kiểu');
  ok(w.S(null, 'myResults', { loai: 'luyen' }));
  info(`tự tạo 2 trang tính có tiêu đề; KetQuaLuyenTap thiếu cột "Kiểu" vẫn ghi, tiêu đề sau đó: …${kl._data()[0].slice(-2).join(', ')}`);
});

// ---------- TC-4.13 ----------
function tc413(label, examPatch, release) {
  const w = world({ rows: rowsBai14(5, [K.row({ phan: 3, cau: 50, ch: 2, bai: 0, dapAn: '7', noiDung: 'B14 câu P3 (tự soạn).' })]) });
  const pl = pool(w); const X = pl.find((p) => p.noiDung === 'B14 câu P1 số 1 (tự soạn).');
  // X sai trong một bài luyện trước khi vào đề (để thử cả CAU_SAI)
  const s0 = ok(practice(w, null, { kieu: 'TU_TAO', chuong: [], bai: [], so: { TN: 5, DS: 0, TL: 1 }, phut: 10 }));
  ok(w.S(null, 'submitExam', { attemptToken: s0.attemptToken, answers: answer(w, s0, () => true) }));
  const eid = saveExam(w, Object.assign({ tieuDe: 'Đề chứa X — ' + label }, examPatch), toQuestions(w, [X.maKho]).concat([manual('Câu tay trong đề chặn (tự soạn)')]));
  // R-2: xem lại bài luyện cũ (có X) trong lúc X bị chặn → không có đáp án/lời giải của X
  const r0 = ok(w.S(null, 'myResults', { loai: 'luyen' }))[0];
  const v0 = ok(w.S(null, 'getResult', { resultId: r0.id }));
  const xItem = v0.items.find((it) => it.noiDung === X.noiDung);
  const reviewLeak = !!(xItem && (xItem.loiGiai || (xItem.dapAn != null && xItem.dapAn !== '')));
  // dangThi trong adminPracticeSync / adminPracticeList
  const sy = sync(w, { maKho: [X.maKho], mode: 'them' });
  const li = ok(w.A('adminPracticeList', { filter: {}, page: 1, size: 100 }));
  const xi = (li.items || []).find((i) => i.maKho === X.maKho);
  const flagged = sy.dangThi.includes(X.maKho) && xi && xi.dangThi;
  let hits = 0; const kinds = {};
  const meta = ok(w.S(null, 'practiceMeta'));
  const metaN = meta.cay.reduce((s, c) => s + c.dem.TN, 0);
  const bodies = [
    { kieu: 'TU_TAO', chuong: [], bai: [], so: { TN: 5, DS: 0, TL: 0 }, phut: 10 },
    { kieu: 'TU_TAO', chuong: ['Chương III. Từ trường'], bai: ['Bài 14. Từ trường'], so: { TN: 5, DS: 0, TL: 1 }, phut: 10 },
    { kieu: 'NHANH', chuong: ['Chương III. Từ trường'], bai: ['Bài 14. Từ trường'] },
    { kieu: 'CAU_SAI' },
    { kieu: 'TU_TAO', chuong: [], bai: [], so: { TN: 40, DS: 0, TL: 0 }, phut: 10 }
  ];
  for (let i = 0; i < 50; i++) {
    const b = bodies[i % bodies.length];
    const r = practice(w, null, b);
    kinds[b.kieu] = (kinds[b.kieu] || 0) + 1;
    if (r.ok && (contents(r.data).includes(X.noiDung) || JSON.stringify(r.data).includes(X.maKho))) hits++;
    if (r.ok && contents(r.data).includes('Câu tay trong đề chặn (tự soạn)')) hits++;
  }
  // mở khóa
  release(w, eid);
  const meta2 = ok(w.S(null, 'practiceMeta'));
  const back = ok(practice(w, null, bodies[1]));
  const backC = ok(practice(w, null, { kieu: 'CAU_SAI' }));
  return { hits, metaN, metaN2: meta2.cay.reduce((s, c) => s + c.dem.TN, 0), back: contents(back).includes(X.noiDung), backC: contents(backC).includes(X.noiDung), flagged, kinds, reviewLeak, xInReview: !!xItem };
}
const future = () => new Date(Date.now() + 2 * 86400e3).toISOString();
const cases413 = [
  ['đề SAU_HAN đang mở', { trangThai: 'MO', hienLoiGiai: 'SAU_HAN' }, (w, id) => setExam(w, id, { trangThai: 'DONG' })],
  ['đề NHAP', { trangThai: 'NHAP', hienLoiGiai: 'SAU_HAN' }, (w, id) => ok(w.A('adminDeleteExam', { examId: id }))],
  ['đề NHAP (NGAY)', { trangThai: 'NHAP', hienLoiGiai: 'NGAY' }, (w, id) => setExam(w, id, { trangThai: 'DONG' })],
  ['đề SAU_HAN "Mở lúc" tương lai', { trangThai: 'MO', hienLoiGiai: 'SAU_HAN', batDau: future() }, (w, id) => setExam(w, id, { trangThai: 'DONG', batDau: '' })],
  ['đề KHONG cho xem lời giải', { trangThai: 'MO', hienLoiGiai: 'KHONG' }, (w, id) => setExam(w, id, { hienLoiGiai: 'NGAY', trangThai: 'DONG' })],
  ['đề NGAY đang mở (mặc định, bổ sung 19/11)', { trangThai: 'MO', hienLoiGiai: 'NGAY' }, (w, id) => setExam(w, id, { trangThai: 'DONG' })],
  ['đề NGAY "Mở lúc" tương lai (chưa ai làm)', { trangThai: 'MO', hienLoiGiai: 'NGAY', batDau: future() }, (w, id) => setExam(w, id, { trangThai: 'DONG', batDau: '' })]
];
const r2Res = [];
cases413.forEach(([label, patch, release]) => {
  t(`TC-4.13 X trong ${label}: 50 lần practiceStart (mọi kiểu) không có X; practiceMeta không đếm X; mở khóa thì X trở lại`, () => {
    const r = tc413(label, patch, release);
    r2Res.push([label, r.reviewLeak]);
    info(`${label}: X xuất hiện ${r.hits}/50 lần (${JSON.stringify(r.kinds)}); meta P1 ${r.metaN} → sau mở khóa ${r.metaN2}; X trở lại: TU_TAO ${r.back}, CAU_SAI ${r.backC}; nhãn đang thi: ${r.flagged}; xem lại bài luyện cũ lộ đáp án X: ${r.reviewLeak} (X có trong bài: ${r.xInReview})`);
    assert.strictEqual(r.hits, 0, 'X xuất hiện ' + r.hits + ' lần');
    assert.strictEqual(r.metaN, 4, 'meta đếm X'); assert.strictEqual(r.metaN2, 5);
    assert(r.back && r.backC, 'mở khóa mà X chưa trở lại');
    assert(r.flagged, 'adminPracticeSync/List không gắn nhãn đang thi');

  });
});

t('TC-4.13 / R-2 (bổ sung 19/11) Xem lại bài luyện cũ có X trong lúc X bị chặn: không hiện đáp án/lời giải của X', () => {
  info(r2Res.map(([l, v]) => `${l}: ${v ? 'LỘ' : 'ẩn'}`).join(' · '));
  // bắt đầu bài luyện có X → giáo viên đưa X vào đề SAU_HAN đang mở → nộp: kết quả không được hiện đáp án/lời giải của X
  const w = world({ rows: rowsBai14(5) });
  const X = pool(w)[0];
  const s = ok(practice(w, null, { kieu: 'TU_TAO', chuong: [], bai: [], so: { TN: 5 }, phut: 10 }));
  saveExam(w, { tieuDe: 'Đề mới chứa X', trangThai: 'MO', hienLoiGiai: 'SAU_HAN' }, toQuestions(w, [X.maKho]));
  const r = ok(w.S(null, 'submitExam', { attemptToken: s.attemptToken, answers: answer(w, s, () => true) }));
  const it = r.items.find((x) => x.noiDung === X.noiDung);
  const subLeak = !!(it && (it.loiGiai || (it.dapAn != null && it.dapAn !== '')));
  info('nộp bài luyện sau khi X vào đề đang mở: ' + (subLeak ? 'LỘ' : 'ẩn') + ' đáp án/lời giải của X');
  r2Res.push(['kết quả nộp', subLeak]);
  assert.deepStrictEqual(r2Res.filter(([, v]) => v).map(([l]) => l), [], 'getResult bài luyện cũ hiện đáp án + lời giải của câu đang bị chặn');
});

// ---------- TC-4.14 ----------
t('TC-4.14 Sửa đề sau khi HS làm (chèn câu lên đầu): câu nhập tay bị lệch bỏ khỏi CAU_SAI; câu có maKho vẫn đúng', () => {
  const w = world({ rows: K.bigRows(60) });
  const X = pool(w)[0];
  const M = manual('Câu tay M (tự soạn).', 'A'); const N = manual('Câu tay N (tự soạn).', 'B');
  const eid = saveExam(w, { tieuDe: 'Đề sẽ sửa', trangThai: 'MO', hienLoiGiai: 'NGAY' }, [M].concat(toQuestions(w, [X.maKho]), [N]));
  doExam(w, null, eid, () => true);
  setExam(w, eid, { trangThai: 'DONG' });
  const before = contents(ok(practice(w, null, { kieu: 'CAU_SAI' })));
  assert.deepStrictEqual(before.slice().sort(), [M.noiDung, X.noiDung, N.noiDung].sort());
  // chèn câu mới lên đầu → đánh số lại
  const NEW = manual('Câu mới chèn đầu (tự soạn).', 'C');
  setExam(w, eid, {}, (qs) => [NEW].concat(qs).map((q, i) => Object.assign({}, q, { stt: i + 1 })));
  const c = ok(practice(w, null, { kieu: 'CAU_SAI' }));
  const after = contents(c);
  info(`trước khi sửa: ${before.length} câu; sau khi chèn: [${after.join(' | ')}]`);
  assert(!after.includes(NEW.noiDung), 'câu mới chèn (HS chưa làm) lọt vào tập câu sai');
  assert(after.includes(X.noiDung), 'mất câu có maKho');
  assert(!after.includes(M.noiDung) && !after.includes(N.noiDung), 'câu tay bị lệch vẫn còn');
  // nộp được: chấm câu X theo đúng câu X
  const r = ok(w.S(null, 'submitExam', { attemptToken: c.attemptToken, answers: answer(w, c) }));
  assert.strictEqual(r.diem, 10);
  // sửa nội dung câu tay tại chỗ (không chèn)
  const w2 = world({ rows: K.bigRows(30) });
  const e2 = saveExam(w2, { tieuDe: 'Đề sửa chữ', trangThai: 'MO', hienLoiGiai: 'NGAY' }, [manual('Câu tay P (tự soạn).'), manual('Câu tay Q (tự soạn).')]);
  doExam(w2, null, e2, () => true);
  setExam(w2, e2, { trangThai: 'DONG' }, (qs) => qs.map((q, i) => (i === 0 ? Object.assign({}, q, { noiDung: 'Câu tay P đã sửa đề bài (tự soạn).' }) : q)));
  const a2 = contents(ok(practice(w2, null, { kieu: 'CAU_SAI' })));
  assert.deepStrictEqual(a2, ['Câu tay Q (tự soạn).'], 'sửa chữ câu tay: ' + JSON.stringify(a2));
});


// ======================= Vòng 2 (f228081) =======================
console.log('\nVòng 2:');
const MSG_HIDE = /Đáp án và lời giải sẽ hiện khi đề thi đó kết thúc/;
t('V2 Xem lại bài luyện có câu đang bị chặn: HS thấy dòng "…sẽ hiện khi đề thi đó kết thúc", điểm giữ nguyên; GV vẫn thấy lời giải; đóng đề thì hiện lại', () => {
  const w = world({ rows: rowsBai14(5) });
  const X = pool(w)[0];
  const s = ok(practice(w, null, { kieu: 'TU_TAO', chuong: [], bai: [], so: { TN: 5 }, phut: 10 }));
  const r = ok(w.S(null, 'submitExam', { attemptToken: s.attemptToken, answers: answer(w, s, (q) => q.noiDung !== X.noiDung) }));
  const eid = saveExam(w, { tieuDe: 'Đề NGAY đang mở chứa X', trangThai: 'MO', hienLoiGiai: 'NGAY' }, toQuestions(w, [X.maKho]));
  const v = ok(w.S(null, 'getResult', { resultId: r.id }));
  const it = v.items.find((x) => x.noiDung === X.noiDung);
  assert(it, 'không còn đề bài của X');
  assert(!it.loiGiai && (it.dapAn == null || it.dapAn === ''), 'HS vẫn thấy đáp án/lời giải X');
  assert(MSG_HIDE.test(JSON.stringify(it)), 'thiếu dòng báo: ' + JSON.stringify(it).slice(0, 200));
  assert(it.answer != null && it.answer !== '', 'mất câu trả lời của HS');
  assert.strictEqual(v.diem, r.diem); assert.strictEqual(v.soCauDung, r.soCauDung);
  const others = v.items.filter((x) => x !== it);
  assert(others.every((x) => x.loiGiai), 'câu khác mất lời giải');
  const vt = ok(w.A('getResult', { resultId: r.id }));
  const itT = vt.items.find((x) => x.noiDung === X.noiDung);
  assert(itT && itT.loiGiai && itT.dapAn, 'GV không thấy lời giải');
  setExam(w, eid, { trangThai: 'DONG' });
  const v2 = ok(w.S(null, 'getResult', { resultId: r.id }));
  const it2 = v2.items.find((x) => x.noiDung === X.noiDung);
  assert(it2.loiGiai && it2.dapAn && !MSG_HIDE.test(JSON.stringify(it2)), 'đóng đề mà chưa hiện lại lời giải');
  info(`HS: "${(JSON.stringify(it).match(/[^"]*kết thúc[^"]*/) || [''])[0]}"; điểm ${v.diem} = ${r.diem}; GV thấy lời giải; đóng đề → HS thấy lời giải`);
});

t('V2 "Luyện câu đã sai" chỉ lấy câu của đề đã đóng (NGAY đang mở: không; hết hạn hoặc đóng: có)', () => {
  const w = world({ rows: K.bigRows(30) });
  const eOpen = saveExam(w, { tieuDe: 'Đề NGAY mở', trangThai: 'MO', hienLoiGiai: 'NGAY' }, [manual('Câu tay đề mở (tự soạn).')]);
  const eExp = saveExam(w, { tieuDe: 'Đề sẽ hết hạn', trangThai: 'MO', hienLoiGiai: 'SAU_HAN' }, [manual('Câu tay đề hết hạn (tự soạn).')]);
  doExam(w, null, eOpen, () => true); doExam(w, null, eExp, () => true);
  const r0 = practice(w, null, { kieu: 'CAU_SAI' });
  const set0 = r0.ok ? contents(r0.data) : [];
  assert(!set0.includes('Câu tay đề mở (tự soạn).') && !set0.includes('Câu tay đề hết hạn (tự soạn).'), 'có câu của đề chưa đóng: ' + set0);
  setExam(w, eExp, { ketThuc: new Date(Date.now() - 60e3).toISOString() });
  setExam(w, eOpen, { trangThai: 'DONG' });
  const set1 = contents(ok(practice(w, null, { kieu: 'CAU_SAI' })));
  assert(set1.includes('Câu tay đề mở (tự soạn).') && set1.includes('Câu tay đề hết hạn (tự soạn).'), 'đề đã đóng/hết hạn mà chưa có câu: ' + set1);
  info(`đang mở: ${r0.ok ? set0.length + ' câu' : '"' + r0.error + '"'}; sau khi đóng + hết hạn: ${set1.length} câu`);
});

t('V2 (N-1) Chọn cả chương và bài → lấy GIAO', () => {
  const w = world({ rows: K.bigRows(300) });
  const by = new Map(pool(w).map((p) => [p.noiDung, p]));
  const s = ok(practice(w, null, { kieu: 'TU_TAO', chuong: ['Chương I. Vật lí nhiệt'], bai: ['Bài 1. Cấu trúc của chất. Sự chuyển thể'], so: { TN: 10, DS: 2, TL: 3 }, phut: 20 }));
  assert(s.questions.every((q) => by.get(q.noiDung).bai === 'Bài 1. Cấu trúc của chất. Sự chuyển thể'), 'có câu ngoài bài');
  const x = practice(w, null, { kieu: 'TU_TAO', chuong: ['Chương II. Khí lí tưởng'], bai: ['Bài 1. Cấu trúc của chất. Sự chuyển thể'], so: { TN: 5 }, phut: 10 });
  info('chương II + bài thuộc chương I: ' + (x.ok ? x.data.questions.length + ' câu' : '"' + x.error + '"'));
  assert(!x.ok || x.data.questions.length === 0, 'giao rỗng mà vẫn ra câu');
});

t('V2 (N-2) Tắt luyện tập vẫn xem được bài luyện cũ (myResults luyen + getResult LT)', () => {
  const w = world();
  const s = ok(practice(w, null, { kieu: 'TU_TAO', chuong: [], bai: [], so: { TN: 5 }, phut: 10 }));
  const r = ok(w.S(null, 'submitExam', { attemptToken: s.attemptToken, answers: answer(w, s) }));
  K.setSetting(w.g, { CHO_LUYEN_TAP: 'KHONG' });
  const l = ok(w.S(null, 'myResults', { loai: 'luyen' }));
  const v = ok(w.S(null, 'getResult', { resultId: r.id }));
  assert(l.some((x) => x.id === r.id) && v.items.every((x) => x.loiGiai));
  assert(OFF_MSG.test(w.S(null, 'practiceMeta').error));
});

t('V2 (R-6) Pool vượt 3 000 câu đang bật bị từ chối, không ghi gì', () => {
  const w = world({ rows: K.bigRows(3010), sync: false });
  const ms = w.kho.rows.map((r) => r[0]);
  w.g._resetStats();
  const r1 = w.A('adminPracticeSync', { filter: {}, mode: 'them' });
  const wr1 = w.g._stats.writes.LuyenTap || 0;
  assert(!r1.ok, '3 010 câu được nhận'); assert.strictEqual(wr1, 0, 'đã ghi ' + wr1 + ' lần'); assert.strictEqual(w.g._sheets.LuyenTap.getLastRow(), 1);
  info('3 010 câu: "' + r1.error + '"');
  sync(w, { maKho: ms.slice(0, 2990), mode: 'them' });
  assert.strictEqual(pool(w).length, 2990);
  w.g._resetStats();
  const r2 = w.A('adminPracticeSync', { maKho: ms.slice(2990, 3010), mode: 'them' });
  assert(!r2.ok, '2 990 + 20 được nhận'); assert.strictEqual(w.g._stats.writes.LuyenTap || 0, 0); assert.strictEqual(pool(w).length, 2990);
  // tắt 30 câu rồi thêm 20 → 2 980 bật → được
  ok(w.A('adminPracticeToggle', { maKho: ms.slice(0, 30), bat: 'KHONG' }));
  const r3 = sync(w, { maKho: ms.slice(2990, 3010), mode: 'them' });
  assert.strictEqual(r3.them, 20); assert.strictEqual(pool(w).filter((p) => p.bat === 'CO').length, 2980);
  // "thay" bằng đúng 3 000 câu → được
  const r4 = w.A('adminPracticeSync', { maKho: ms.slice(0, 3000), mode: 'thay' });
  info(`2 990 + 20: "${r2.error}"; tắt 30 rồi thêm 20: them=${r3.them}; "thay" 3 000 câu: ${r4.ok ? 'được' : '"' + r4.error + '"'}`);
});

t('V2 (R-5) Nộp lại cùng token không thêm hàng; HS khác nộp token không ghi', () => {
  const w = world({ classes: ['12A2'] });
  const s = ok(practice(w, null, { kieu: 'TU_TAO', chuong: [], bai: [], so: { TN: 5 }, phut: 10 }));
  const a = ok(w.S(null, 'submitExam', { attemptToken: s.attemptToken, answers: answer(w, s) }));
  const n = KQLT(w);
  for (let i = 0; i < 3; i++) { const b = w.S(null, 'submitExam', { attemptToken: s.attemptToken, answers: {} }); if (b.ok) assert.strictEqual(b.data.id, a.id); }
  assert(!w.S('12A2', 'submitExam', { attemptToken: s.attemptToken, answers: {} }).ok);
  assert.strictEqual(KQLT(w), n); assert(a.id.length > 20, 'mã bài ' + a.id);
  info('mã bài mới: ' + a.id + ' (' + a.id.length + ' ký tự)');
});

t('V2 Mã bài cũ (6 ký tự): bài luyện và bài thi dạng cũ vẫn mở được', () => {
  const w = world();
  // bài luyện: đổi mã bài trong sheet về dạng cũ LT + yyMMddHHmmss + 6 ký tự
  const s = ok(practice(w, null, { kieu: 'TU_TAO', chuong: [], bai: [], so: { TN: 5 }, phut: 10 }));
  const r = ok(w.S(null, 'submitExam', { attemptToken: s.attemptToken, answers: answer(w, s) }));
  const d = w.g._sheets.KetQuaLuyenTap._data(); const ci = d[0].indexOf('Mã bài');
  const oldId = 'LT261119140624' + '4C9BC4';
  d[d.length - 1][ci] = oldId;
  const v = ok(w.S(null, 'getResult', { resultId: oldId }), 'getResult bài luyện mã cũ');
  assert.strictEqual(v.items.length, 5); assert(v.items.every((x) => x.loiGiai));
  assert(ok(w.S(null, 'myResults', { loai: 'luyen' })).some((x) => x.id === oldId));
  // bài thi do máy chủ 1.0.0 ghi (mã cũ, KetQua thiếu cột Mục tiêu)
  const path = require('path');
  const old = createContext({ quiet: true, codePath: path.join(__dirname, 'fixtures', 'Code-1.0.0.gs') }); old.setup();
  const ot = ok(old.call('loginPin', { studentId: 'HS0001', pin: '0101' })).token;
  const os = ok(old.call('startExam', { token: ot, examId: 'DEMAU' }));
  const orr = ok(old.call('submitExam', { token: ot, attemptToken: os.attemptToken, answers: { 1: 'C' } }));
  const g2 = createContext({ quiet: true }); g2.setup();
  g2._sheets.KetQua._setData(old._sheets.KetQua._data());
  const t2 = ok(g2.call('loginPin', { studentId: 'HS0001', pin: '0101' })).token;
  const ov = ok(g2.call('getResult', { token: t2, resultId: orr.id }), 'getResult bài thi 1.0.0');
  assert.strictEqual(ov.diem, orr.diem);
  assert(ok(g2.call('myResults', { token: t2 })).some((x) => x.id === orr.id));
  info(`bài luyện mã cũ ${oldId}: mở được, 5 câu có lời giải; bài thi 1.0.0 ${orr.id}: mở được, điểm ${ov.diem}`);
});

// ---------- tổng ----------
const fail = results.filter((r) => !r[1]);
console.log(`\n${results.length - fail.length}/${results.length} kiểm thử đạt` + (fail.length ? ' — KHÔNG ĐẠT: ' + fail.map((r) => r[0].slice(0, 60)).join(' | ') : ''));
