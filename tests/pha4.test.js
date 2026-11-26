// Test Pha 4 (người làm) — Luyện tập, phần máy chủ: TC-4.1 → TC-4.14 + R-12. node tests/pha4.test.js
// Kho giả tự soạn: tests/fixtures/kho-gia.js (không chứa câu hỏi thật).
const assert = require('assert');
const path = require('path');
const { createContext } = require('./gas-shim');
const K = require('./fixtures/kho-gia');

let passed = 0, failed = 0;
function t(name, fn) {
  if (process.env.ONLY && !name.includes(process.env.ONLY)) return; // ONLY=TC-4.6 node tests/pha4.test.js
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.error('  ✗ ' + name + '\n    ' + (e.stack || e).split('\n').slice(0, 6).join('\n    ')); process.exitCode = 1; }
}
function ok(r) { if (!r.ok) throw new Error('API lỗi: ' + r.error); return r.data; }
const pwOf = (g) => g._sheets.CaiDat._data().find((r) => r[0] === 'MAT_KHAU_QUAN_TRI')[1];
const clearCache = (g) => Object.keys(g._cache).forEach((k) => delete g._cache[k]);
const plain = (x) => JSON.parse(JSON.stringify(x));
const payload = (tok) => JSON.parse(Buffer.from(tok.split('.')[0].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
const H = K.HEADER;
const col = (name) => H.indexOf(name);

/** Thế giới thử: sheet web + kho giả (+ pool đã đồng bộ), CHO_LUYEN_TAP=CO, học sinh HS0001 (12A1). */
function world(opts = {}) {
  const g = createContext(Object.assign({ quiet: true }, opts.ctx || {}));
  g.setup();
  const k = K.install(g, opts.kho || {});
  K.setSetting(g, { CHO_LUYEN_TAP: opts.off ? 'KHONG' : 'CO' });
  const tTok = ok(g.call('loginAdminPassword', { password: pwOf(g) })).token;
  const sTok = ok(g.call('loginPin', { studentId: 'HS0001', pin: '0101' })).token;
  const w = { g, k, tTok, sTok };
  w.sync = (body) => {
    let cur, r;
    do { r = ok(g.call('adminPracticeSync', Object.assign({ token: tTok, mode: 'them' }, body, { cursor: cur }))); cur = r.tiepTuc; } while (cur != null);
    return r;
  };
  w.student = (lop) => {
    const s = ok(g.call('adminSaveStudent', { token: tTok, student: { hoTen: 'Học Sinh ' + lop, lop, ngaySinh: '02/03/2008' } }));
    return ok(g.call('loginPin', { studentId: s.id, pin: '0203' })).token;
  };
  w.byMa = Object.fromEntries(k.rows.map((r) => [r[0], r]));
  /** Đáp án đúng (dạng học sinh gửi) theo mã câu kho. */
  w.right = (ma) => {
    const r = w.byMa[ma];
    const d = String(r[col('Đáp án')]);
    if (/Phần I –/.test(r[col('Dạng câu hỏi')])) return d.trim();
    if (/Phần II –/.test(r[col('Dạng câu hỏi')])) return g.bankTF_(d).replace(/Đ/g, 'D').split('');
    return d;
  };
  w.wrong = (ma) => {
    const a = w.right(ma);
    if (Array.isArray(a)) return a.map((x) => (x === 'D' ? 'S' : 'D'));
    if (/^[ABCD]$/.test(a)) return a === 'A' ? 'B' : 'A';
    return '99999';
  };
  w.answersFor = (tok, fn) => { const a = {}; payload(tok).qids.forEach((q, i) => { a[i + 1] = fn(q, i); }); return a; };
  if (opts.sync !== false) w.syncRes = w.sync({ filter: {} });
  return w;
}
const sumMeta = (m) => m.cay.reduce((s, x) => s + x.dem.TN + x.dem.DS + x.dem.TL, 0);

console.log('Luyện tập (Pha 4) — máy chủ:');

t('features có "practice"; APP_VERSION 1.6.0; publicConfig.practice theo CHO_LUYEN_TAP; setup tạo 2 trang tính, chạy lại an toàn', () => {
  const w = world({ sync: false });
  const p = ok(w.g.call('publicConfig'));
  assert(p.features.includes('practice'));
  assert.strictEqual(p.version, '1.6.0');
  assert.strictEqual(p.practice, true);
  K.setSetting(w.g, { CHO_LUYEN_TAP: 'KHONG' });
  assert.strictEqual(ok(w.g.call('publicConfig')).practice, false);
  const g2 = createContext({ quiet: true });
  g2.setup(); g2.setup();
  assert.deepStrictEqual(plain(g2._sheets.LuyenTap._data()[0]), plain(g2.SCHEMA.LuyenTap.map((d) => d[1])));
  assert.deepStrictEqual(plain(g2._sheets.KetQuaLuyenTap._data()[0]), plain(g2.SCHEMA.KetQuaLuyenTap.map((d) => d[1])));
  assert.deepStrictEqual(plain(g2.SCHEMA.KetQuaLuyenTap.slice(0, -1)), plain(g2.SCHEMA.KetQua), 'KetQuaLuyenTap = cột KetQua + kieu');
  const keys = g2._sheets.CaiDat._data().map((r) => r[0]);
  assert.strictEqual(keys.filter((x) => x === 'CHO_LUYEN_TAP').length, 1);
  assert.strictEqual(g2._sheets.CaiDat._data().find((r) => r[0] === 'CHO_LUYEN_TAP')[1], 'KHONG', 'mặc định tắt');
});

t('TC-4.1 adminPracticeSync: chỉ câu có đáp án, không P IV; chạy lại không nhân đôi; "thay" chỉ đặt Bật; kho 0 lần ghi', () => {
  const w = world({ sync: false });
  w.g._resetStats();
  const r = w.sync({ filter: {} });
  const usable = w.k.rows.filter((x) => !w.g.bankToQuestion_(asRow(w.g, x)).loi);
  assert.strictEqual(r.them, usable.length);
  assert.strictEqual(r.boQua.tuLuan, 1);
  assert.strictEqual(r.boQua.khongDapAn, 5); // 3 chưa có đáp án + 2 sai định dạng
  const data = () => w.g._sheets.LuyenTap._data().slice(1).filter((x) => x[0]);
  const codes = data().map((x) => x[0]);
  assert.strictEqual(codes.length, usable.length);
  assert(!codes.some((c) => /-P4-/.test(c)), 'không có Phần IV');
  data().forEach((row) => { assert(String(row[13]).trim(), 'có đáp án: ' + row[0]); assert.strictEqual(row[16], 'CO'); });
  // chạy lại: không nhân đôi
  const r2 = w.sync({ filter: {} });
  assert.strictEqual(r2.them, 0); assert.strictEqual(r2.capNhat, 0);
  assert.strictEqual(data().length, usable.length);
  // "thay" bằng 5 câu: các câu khác Bật=KHONG, không xóa hàng
  const five = codes.slice(0, 5);
  const r3 = w.sync({ maKho: five, mode: 'thay' });
  assert.strictEqual(r3.tat, usable.length - 5);
  assert.strictEqual(data().length, usable.length, 'không xóa hàng');
  data().forEach((row) => assert.strictEqual(row[16], five.includes(row[0]) ? 'CO' : 'KHONG'));
  // thêm lại câu đã tắt: bật lại, không thêm hàng
  const r4 = w.sync({ maKho: [codes[7]], mode: 'them' });
  assert.strictEqual(r4.them, 0); assert.strictEqual(r4.capNhat, 1);
  assert.strictEqual(data().find((x) => x[0] === codes[7])[16], 'CO');
  // gửi mã câu P IV / không đáp án: bỏ qua
  const p4 = w.k.rows.find((x) => /-P4-/.test(x[0]))[0];
  const r5 = w.sync({ maKho: [p4, codes[0]] });
  assert.strictEqual(r5.boQua.tuLuan, 1);
  assert.deepStrictEqual(w.g._stats.extWrites, {}, 'kho 0 lần ghi');
});

function asRow(g, arr) {
  const map = { maKho: 'Mã câu', lop: 'Lớp', chuong: 'Chương', bai: 'Bài', dang: 'Dạng câu hỏi', mucDo: 'Mức độ', mucDoY: 'Mức độ từng ý (Phần II)', noiDung: 'Nội dung câu hỏi', A: 'A / a)', B: 'B / b)', C: 'C / c)', D: 'D / d)', dapAn: 'Đáp án', loiGiai: 'Lời giải', hinhVe: 'Hình vẽ', nguon: 'Nguồn', viTri: 'Vị trí trong đề gốc' };
  const o = {};
  Object.keys(map).forEach((k) => { o[k] = arr[H.indexOf(map[k])]; });
  return o;
}

t('TC-4.2 practiceMeta: 10A1/11B2/12A1 chỉ câu cùng khối và đang bật; "CLB" thấy toàn pool; không có nội dung/đáp án', () => {
  const w = world();
  const pool = w.g._sheets.LuyenTap._data().slice(1).filter((x) => x[0]);
  const n11 = pool.filter((x) => /11/.test(x[1])).length, n12 = pool.filter((x) => /12/.test(x[1])).length;
  // tắt 2 câu lớp 12
  const off = pool.filter((x) => /12/.test(x[1])).slice(0, 2).map((x) => x[0]);
  assert.strictEqual(ok(w.g.call('adminPracticeToggle', { token: w.tTok, maKho: off, bat: 'KHONG' })).n, 2);
  const m = (lop) => ok(w.g.call('practiceMeta', { token: w.student(lop) }));
  assert.strictEqual(sumMeta(m('10A1')), 0);
  assert.strictEqual(sumMeta(m('11B2')), n11);
  assert.strictEqual(sumMeta(m('12A1')), n12 - 2);
  const clb = m('CLB');
  assert.strictEqual(sumMeta(clb), n11 + n12 - 2);
  const j = JSON.stringify(clb);
  assert(!/"(noiDung|dapAn|loiGiai|maKho|A|B)"/.test(j), j.slice(0, 200));
  assert(!pool.some((x) => j.includes(x[0])), 'không lộ mã câu');
  assert.deepStrictEqual(clb.nhanh, { TN: 7, DS: 1, TL: 2, phut: 10 });
});

// Kho lớn đủ câu (mọi câu có đáp án)
const BIG = () => ({ kho: { rows: K.bigRows(300), missingImages: 0 } });

t('TC-4.3 practiceStart TU_TAO 10–2–3: đúng 15 câu thuộc bài đã chọn; không có dapAn/loiGiai/maKho', () => {
  const w = world(BIG());
  const meta = ok(w.g.call('practiceMeta', { token: w.sTok }));
  const bai = meta.cay.filter((x) => /Chương II/.test(x.chuong)).map((x) => x.bai);
  const s = ok(w.g.call('practiceStart', { token: w.sTok, kieu: 'TU_TAO', bai, so: { TN: 10, DS: 2, TL: 3 }, phut: 30 }));
  assert.strictEqual(s.questions.length, 15);
  assert.deepStrictEqual(s.questions.map((q) => q.loai), Array(10).fill('TN').concat(['DS', 'DS', 'TL', 'TL', 'TL']));
  assert.deepStrictEqual(s.questions.map((q) => q.stt), Array.from({ length: 15 }, (_, i) => i + 1));
  assert.strictEqual(s.durationSec, 1800);
  const json = JSON.stringify(Object.assign({}, s, { attemptToken: '' }));
  assert(!/"(dapAn|loiGiai|maKho)"/.test(json));
  const p = payload(s.attemptToken);
  assert.strictEqual(p.t, 'p'); assert.strictEqual(p.qids.length, 15); assert(p.exp > Date.now()); assert(p.sid);
  p.qids.forEach((q) => assert(bai.includes(w.byMa[q][col('Bài')]), q));
  assert(!p.qids.some((q) => json.includes(q)), 'phần trả về (ngoài token) không có mã câu');
  // tổng ngoài 5–40 bị từ chối
  assert(!w.g.call('practiceStart', { token: w.sTok, kieu: 'TU_TAO', bai, so: { TN: 3 }, phut: 10 }).ok);
  assert(!w.g.call('practiceStart', { token: w.sTok, kieu: 'TU_TAO', bai, so: { TN: 30, DS: 11 }, phut: 10 }).ok);
  // ưu tiên câu chưa làm: làm xong bài 15 câu, lần sau không lặp câu khi còn đủ câu mới
  ok(w.g.call('submitExam', { token: w.sTok, attemptToken: s.attemptToken, answers: {} }));
  const s2 = ok(w.g.call('practiceStart', { token: w.sTok, kieu: 'TU_TAO', bai, so: { TN: 10, DS: 2, TL: 3 }, phut: 30 }));
  const again = payload(s2.attemptToken).qids.filter((q) => p.qids.includes(q));
  assert.strictEqual(again.length, 0, 'lặp câu đã làm: ' + again);
});

t('TC-4.4 nộp: điểm thang 10 đúng quy tắc; ghi KetQuaLuyenTap (điểm dạng số); KetQua không thêm hàng; có lời giải', () => {
  const w = world(BIG());
  const kq0 = w.g._sheets.KetQua._data().length;
  const s = ok(w.g.call('practiceStart', { token: w.sTok, kieu: 'TU_TAO', so: { TN: 4, DS: 2, TL: 2 }, phut: 10, mucTieu: 8 }));
  const qids = payload(s.attemptToken).qids;
  // TN: 2 đúng 2 sai (0,5/1); DS: câu 1 đúng 4 ý (1), câu 2 đúng 3 ý (0,5); TL: 1 đúng 1 sai (0,25) → 2,25 / 3,5
  const ans = {};
  qids.forEach((q, i) => {
    const r = w.right(q);
    if (i < 4) ans[i + 1] = i < 2 ? r : w.wrong(q);
    else if (i === 4) ans[i + 1] = r;
    else if (i === 5) { const a = r.slice(); a[3] = a[3] === 'D' ? 'S' : 'D'; ans[i + 1] = a; }
    else ans[i + 1] = i === 6 ? r : w.wrong(q);
  });
  const v = ok(w.g.call('submitExam', { token: w.sTok, attemptToken: s.attemptToken, answers: ans }));
  assert.strictEqual(v.diemGoc, 2.25); assert.strictEqual(v.diemToiDa, 3.5);
  assert.strictEqual(v.diem, Math.round(2.25 / 3.5 * 1000) / 100);
  assert(/^LT/.test(v.id)); assert.strictEqual(v.luyenTap, true); assert.strictEqual(v.reveal, true);
  assert(v.items.every((it) => it.loiGiai && it.dapAn && it.noiDung), 'mỗi câu có đáp án + lời giải');
  assert.strictEqual(v.goal.mucTieu, 8); assert.strictEqual(v.goal.dat, false);
  assert.strictEqual(w.g._sheets.KetQua._data().length, kq0, 'KetQua không thêm hàng');
  const sh = w.g._sheets.KetQuaLuyenTap._data();
  assert.strictEqual(sh.length, 2);
  const hd = sh[0];
  const row = sh[1];
  assert.strictEqual(typeof row[hd.indexOf('Điểm (thang 10)')], 'number');
  assert.strictEqual(typeof row[hd.indexOf('Số giây')], 'number');
  assert.strictEqual(row[hd.indexOf('Kiểu')], 'TU_TAO');
  const det = JSON.parse(row[hd.indexOf('Chi tiết (JSON)')]);
  assert.deepStrictEqual(det.map((d) => d.q), qids, 'mỗi mục chiTiet có q');
  // lịch sử
  const luyen = ok(w.g.call('myResults', { token: w.sTok, loai: 'luyen' }));
  assert.strictEqual(luyen.length, 1); assert.strictEqual(luyen[0].kieu, 'TU_TAO');
  assert.strictEqual(ok(w.g.call('myResults', { token: w.sTok })).length, 0);
  // getResult LT…: học sinh khác không xem được; giáo viên xem được
  const other = w.student('12A2');
  assert(!w.g.call('getResult', { token: other, resultId: v.id }).ok);
  assert.strictEqual(ok(w.g.call('getResult', { token: w.tTok, resultId: v.id })).items.length, 8);
});

t('TC-4.5 bảng xếp hạng, adminGradebook, adminExamStats, gợi ý đề tương tự không đổi sau 5 bài luyện', () => {
  const w = world(BIG());
  const ex = ok(w.g.call('startExam', { token: w.sTok, examId: 'DEMAU', mucTieu: 10 }));
  const res = ok(w.g.call('submitExam', { token: w.sTok, attemptToken: ex.attemptToken, answers: { 1: 'C' } }));
  const snap = () => JSON.stringify([
    ok(w.g.call('leaderboard', { token: w.sTok })), ok(w.g.call('leaderboard', { token: w.sTok, examId: 'DEMAU' })),
    ok(w.g.call('adminGradebook', { token: w.tTok })), ok(w.g.call('adminExamStats', { token: w.tTok, examId: 'DEMAU' })),
    ok(w.g.call('getResult', { token: w.sTok, resultId: res.id })).goal, ok(w.g.call('adminResults', { token: w.tTok })),
    ok(w.g.call('myStats', { token: w.sTok })), ok(w.g.call('adminOverview', { token: w.tTok })).counts
  ]).replace(/"(today|nopLuc)":[^,}]*/g, '');
  const before = snap();
  for (let i = 0; i < 5; i++) {
    const s = ok(w.g.call('practiceStart', { token: w.sTok, kieu: i % 2 ? 'NHANH' : 'TU_TAO', bai: [K.bigRows(1)[0][col('Bài')]], so: { TN: 5 }, phut: 5 }));
    ok(w.g.call('submitExam', { token: w.sTok, attemptToken: s.attemptToken, answers: w.answersFor(s.attemptToken, (q) => w.right(q)) }));
  }
  assert.strictEqual(w.g._sheets.KetQuaLuyenTap._data().length, 6);
  assert.strictEqual(snap(), before);
});

/** Đề do giáo viên lưu: questions = câu kho (theo mã) hoặc câu nhập tay. */
function saveExam(w, exam, questions, id) {
  const qs = questions.map((q) => (typeof q === 'string' ? ok(w.g.call('adminBankToQuestions', { token: w.tTok, maKho: [q] })).questions[0] : q));
  return ok(w.g.call('adminSaveExam', { token: w.tTok, exam: Object.assign({ id, tieuDe: 'Đề thử', thoiGian: 15 }, exam), questions: qs })).id;
}
const MANUAL = (n) => ({ loai: 'TN', noiDung: 'Câu nhập tay số ' + n + ' (tự soạn).', A: 'a', B: 'b', C: 'c', D: 'd', dapAn: 'A', loiGiai: 'Giải ' + n });
function doExam(w, eid, answers) {
  const s = ok(w.g.call('startExam', { token: w.sTok, examId: eid, mucTieu: 5 }));
  return ok(w.g.call('submitExam', { token: w.sTok, attemptToken: s.attemptToken, answers: answers || {} }));
}
const hourAgo = () => { const d = new Date(Date.now() + 7 * 3600e3 - 3600e3); const p = (n) => String(n).padStart(2, '0'); return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`; };
const inHour = () => { const d = new Date(Date.now() + 7 * 3600e3 + 3600e3); const p = (n) => String(n).padStart(2, '0'); return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`; };

t('TC-4.6 CAU_SAI: có X (đề đã cho xem lời giải) và Y (bài luyện); không có Z (đề SAU_HAN còn mở); làm đúng Y thì rút Y', () => {
  const w = world();
  const pool = w.g._sheets.LuyenTap._data().slice(1).filter((x) => /12/.test(x[1]) && x[4] === 'TN').map((x) => x[0]);
  const X = pool[3];
  const eX = saveExam(w, { trangThai: 'MO', hienLoiGiai: 'NGAY' }, [X, MANUAL(1)]);
  doExam(w, eX, {}); // sai cả X và câu nhập tay
  saveExam(w, { trangThai: 'DONG', hienLoiGiai: 'NGAY' }, [X, MANUAL(1)], eX); // vòng 2: chỉ đề ĐÃ ĐÓNG mới cho câu vào luyện tập
  const eZ = saveExam(w, { trangThai: 'MO', hienLoiGiai: 'SAU_HAN', ketThuc: inHour() }, [MANUAL(9)]);
  doExam(w, eZ, {});
  // Y: sai ở bài luyện
  const s = ok(w.g.call('practiceStart', { token: w.sTok, kieu: 'TU_TAO', so: { TN: 5 }, phut: 5 }));
  const pq = payload(s.attemptToken).qids;
  const Y = pq.find((q) => q !== X);
  ok(w.g.call('submitExam', { token: w.sTok, attemptToken: s.attemptToken, answers: w.answersFor(s.attemptToken, (q) => (q === Y || q === X ? w.wrong(q) : w.right(q))) }));
  const meta = ok(w.g.call('practiceMeta', { token: w.sTok }));
  const c = ok(w.g.call('practiceStart', { token: w.sTok, kieu: 'CAU_SAI' }));
  const set = payload(c.attemptToken).qids;
  assert(set.includes(X), 'có X: ' + set);
  assert(set.includes(Y), 'có Y');
  assert(set.includes(eX + '#2'), 'có câu nhập tay của đề đã công bố lời giải');
  assert(!set.some((q) => q.startsWith(eZ)), 'không có Z');
  assert.strictEqual(meta.soCauSai, set.length);
  // câu sai gần nhất trước (X cũng có thể vừa sai trong cùng bài luyện → cùng thời điểm)
  assert(set.indexOf(Y) < (pq.includes(X) ? 2 : 1), 'câu sai gần nhất trước: ' + set.slice(0, 3));
  assert(JSON.stringify(c.questions).indexOf('Câu nhập tay số 9') < 0);
  // làm đúng Y (sai các câu khác) → Y bị rút, X vẫn còn
  ok(w.g.call('submitExam', { token: w.sTok, attemptToken: c.attemptToken, answers: w.answersFor(c.attemptToken, (q) => (q === Y ? w.right(q) : '')) }));
  const set2 = payload(ok(w.g.call('practiceStart', { token: w.sTok, kieu: 'CAU_SAI' })).attemptToken).qids;
  assert(!set2.includes(Y), 'Y đã rút');
  assert(set2.includes(X));
  // đóng đề Z (lời giải công bố) → Z vào tập
  saveExam(w, { trangThai: 'DONG', hienLoiGiai: 'SAU_HAN' }, [MANUAL(9)], eZ);
  // lưu lại đề làm đổi nội dung? Không: cùng nội dung → mã băm khớp
  const set3 = payload(ok(w.g.call('practiceStart', { token: w.sTok, kieu: 'CAU_SAI' })).attemptToken).qids;
  assert(set3.includes(eZ + '#1'), 'đề đóng → Z xuất hiện: ' + set3);
});

t('TC-4.7 NHANH: bài đủ câu → 7–1–2, 600 s; bài thiếu → bổ sung cùng chương, có thông báo', () => {
  const w = world(BIG());
  const meta = ok(w.g.call('practiceMeta', { token: w.sTok }));
  const full = meta.cay.find((x) => x.dem.TN >= 7 && x.dem.DS >= 1 && x.dem.TL >= 2);
  const s = ok(w.g.call('practiceStart', { token: w.sTok, kieu: 'NHANH', bai: [full.bai] }));
  assert.deepStrictEqual(s.questions.map((q) => q.loai), Array(7).fill('TN').concat(['DS', 'TL', 'TL']));
  assert.strictEqual(s.durationSec, 600);
  assert.deepStrictEqual(s.thongBao, []);
  payload(s.attemptToken).qids.forEach((q) => assert.strictEqual(w.byMa[q][col('Bài')], full.bai));
  // kho chuẩn: "Bài 11" chỉ có 3 câu Phần I; cùng chương có "Bài 9"
  const w2 = world();
  const m2 = ok(w2.g.call('practiceMeta', { token: w2.sTok }));
  const thin = m2.cay.find((x) => /Bài 11/.test(x.bai));
  assert.strictEqual(thin.dem.TN, 3);
  const s2 = ok(w2.g.call('practiceStart', { token: w2.sTok, kieu: 'NHANH', bai: [thin.bai] }));
  assert.strictEqual(s2.questions.length, 10);
  assert.strictEqual(s2.durationSec, 600);
  assert(s2.thongBao.some((x) => /Bài này mới có 3 câu Phần I; lấy thêm 4 câu cùng chương/.test(x)), s2.thongBao.join(' | '));
  payload(s2.attemptToken).qids.forEach((q) => assert.strictEqual(w2.byMa[q][col('Chương')], thin.chuong));
  // chương cũng thiếu → đề ít câu hơn, nói rõ
  const lone = m2.cay.find((x) => /Bài 14/.test(x.bai));
  const s3 = ok(w2.g.call('practiceStart', { token: w2.sTok, kieu: 'NHANH', bai: [lone.bai] }));
  assert(s3.questions.length < 10);
  assert(s3.thongBao.some((x) => /Phần II/.test(x) && /chỉ có 0 câu/.test(x)), s3.thongBao.join(' | '));
  // CaiDat LUYEN_NHANH
  K.setSetting(w.g, { LUYEN_NHANH: '3,1,1,5' });
  const s4 = ok(w.g.call('practiceStart', { token: w.sTok, kieu: 'NHANH', bai: [full.bai] }));
  assert.strictEqual(s4.questions.length, 5); assert.strictEqual(s4.durationSec, 300);
  assert(!w.g.call('practiceStart', { token: w.sTok, kieu: 'NHANH', bai: [] }).ok, 'phải chọn một bài');
});

t('TC-4.8 token: a vào nhánh luyện bị từ chối; sửa qids, sid khác, hết hạn bị từ chối; nộp lại không ghi thêm hàng', () => {
  const w = world();
  const ex = ok(w.g.call('startExam', { token: w.sTok, examId: 'DEMAU', mucTieu: 5 }));
  w.g.__MEMO();
  assert.strictEqual(w.g.readToken_(ex.attemptToken, 'p'), null, 'token a không đọc được như token p');
  const s = ok(w.g.call('practiceStart', { token: w.sTok, kieu: 'TU_TAO', so: { TN: 5 }, phut: 5 }));
  assert.strictEqual(w.g.readToken_(s.attemptToken, 'a'), null, 'token p không dùng cho đề thi');
  // sửa qids (giữ chữ ký cũ)
  const p = payload(s.attemptToken);
  p.qids = p.qids.slice(0, 1);
  const forged = Buffer.from(JSON.stringify(p)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_') + '.' + s.attemptToken.split('.')[1];
  const r1 = w.g.call('submitExam', { token: w.sTok, attemptToken: forged, answers: {} });
  assert(!r1.ok && /không hợp lệ/.test(r1.error), r1.error);
  // học sinh khác
  const other = w.student('12A3');
  const r2 = w.g.call('submitExam', { token: other, attemptToken: s.attemptToken, answers: {} });
  assert(!r2.ok && /không hợp lệ/.test(r2.error));
  // hết hạn (ký bằng khóa thật, exp đã qua)
  const old = w.g.signToken_(Object.assign(payload(s.attemptToken), { exp: Date.now() - 1000 }));
  const r3 = w.g.call('submitExam', { token: w.sTok, attemptToken: old, answers: {} });
  assert(!r3.ok && /quá hạn/.test(r3.error));
  assert.strictEqual(w.g._sheets.KetQuaLuyenTap._data().length, 1, 'chưa ghi hàng nào');
  // nộp 3 lần (lần 3 sau khi đệm bị xóa) → 1 hàng, cùng mã bài
  const v1 = ok(w.g.call('submitExam', { token: w.sTok, attemptToken: s.attemptToken, answers: { 1: 'A' } }));
  const v2 = ok(w.g.call('submitExam', { token: w.sTok, attemptToken: s.attemptToken, answers: { 1: 'B' } }));
  clearCache(w.g);
  const v3 = ok(w.g.call('submitExam', { token: w.sTok, attemptToken: s.attemptToken, answers: {} }));
  assert(v1.id === v2.id && v2.id === v3.id);
  assert.strictEqual(w.g._sheets.KetQuaLuyenTap._data().length, 2);
  assert.strictEqual(v3.diem, v1.diem, 'giữ kết quả lần đầu');
});

t('TC-4.9 xem lại bài luyện sau khi pool bị "thay" và một câu bị tắt: đủ câu + lời giải; câu bị xóa tay → "Câu đã bị gỡ"', () => {
  const w = world();
  const s = ok(w.g.call('practiceStart', { token: w.sTok, kieu: 'TU_TAO', so: { TN: 5, TL: 1 }, phut: 5 }));
  const qids = payload(s.attemptToken).qids;
  const v = ok(w.g.call('submitExam', { token: w.sTok, attemptToken: s.attemptToken, answers: {} }));
  const other = w.g._sheets.LuyenTap._data().slice(1).map((x) => x[0]).filter((x) => x && !qids.includes(x));
  w.sync({ maKho: other.slice(0, 3), mode: 'thay' }); // mọi câu của bài luyện bị tắt
  ok(w.g.call('adminPracticeToggle', { token: w.tTok, maKho: [qids[0]], bat: 'KHONG' }));
  const r = ok(w.g.call('getResult', { token: w.sTok, resultId: v.id }));
  assert.strictEqual(r.items.length, 6);
  assert(r.items.every((it) => it.loiGiai && !it.go), 'đủ lời giải');
  // xóa tay hàng của câu thứ 2 khỏi trang LuyenTap (giáo viên xóa hàng trên Sheet; không gọi onEdit)
  const data = w.g._sheets.LuyenTap._data();
  data.splice(data.findIndex((x) => x[0] === qids[1]), 1);
  clearCache(w.g);
  const r2 = ok(w.g.call('getResult', { token: w.sTok, resultId: v.id }));
  assert.strictEqual(r2.items.length, 6);
  assert(r2.items[1].go && /Câu đã bị gỡ/.test(r2.items[1].noiDung));
  assert(!r2.items[1].dapAn);
  assert(r2.items.filter((it) => !it.go).every((it) => it.loiGiai), 'các câu còn lại vẫn đúng câu (đọc lại chỉ mục khi lệch hàng)');
  r2.items.filter((it) => !it.go).forEach((it, i) => assert.strictEqual(it.noiDung, String(w.byMa[qids[it.stt - 1]][col('Nội dung câu hỏi')])));
});

t('TC-4.10 CHO_LUYEN_TAP=KHONG: practiceMeta, practiceStart, submitExam token p đều báo lỗi; máy chủ 1.0.0 không có chức năng', () => {
  const w = world();
  const s = ok(w.g.call('practiceStart', { token: w.sTok, kieu: 'TU_TAO', so: { TN: 5 }, phut: 5 }));
  K.setSetting(w.g, { CHO_LUYEN_TAP: 'KHONG' });
  const msg = 'Giáo viên đang tắt luyện tập.';
  assert.strictEqual(w.g.call('practiceMeta', { token: w.sTok }).error, msg);
  assert.strictEqual(w.g.call('practiceStart', { token: w.sTok, kieu: 'CAU_SAI' }).error, msg);
  assert.strictEqual(w.g.call('submitExam', { token: w.sTok, attemptToken: s.attemptToken, answers: {} }).error, msg);
  assert.strictEqual(w.g._sheets.KetQuaLuyenTap._data().length, 1);
  // đề thi vẫn chạy
  doExam(w, 'DEMAU', {});
  const old = createContext({ quiet: true, codePath: path.join(__dirname, 'fixtures', 'Code-1.0.0.gs') });
  old.setup();
  const tok = ok(old.call('loginPin', { studentId: 'HS0001', pin: '0101' })).token;
  assert(/Không có chức năng: practiceMeta/.test(old.call('practiceMeta', { token: tok }).error));
  assert(!('features' in ok(old.call('publicConfig'))));
});

t('TC-4.11 pool 3 000 câu: practiceStart chỉ đọc chỉ mục + các hàng được chọn (đếm ô)', () => {
  const w = world({ kho: { rows: K.bigRows(3000), missingImages: 0 }, sync: false });
  const t0 = Date.now();
  const r = w.sync({ filter: {} });
  const syncMs = Date.now() - t0;
  assert.strictEqual(r.them, 3000);
  const nCol = w.g.SCHEMA.LuyenTap.length;
  const run = () => {
    w.g._resetStats();
    const a = Date.now();
    const s = ok(w.g.call('practiceStart', { token: w.sTok, kieu: 'TU_TAO', so: { TN: 10, DS: 2, TL: 3 }, phut: 30 }));
    return { ms: Date.now() - a, cells: w.g._stats.cells.LuyenTap || 0, full: w.g._stats.reads.LuyenTap || 0, n: s.questions.length };
  };
  clearCache(w.g);
  const cold = run(); // chỉ mục chưa đệm
  const warm = run(); // chỉ mục đã đệm
  assert.strictEqual(cold.full, 0, 'không đọc cả trang LuyenTap (getDataRange)');
  assert.strictEqual(warm.full, 0);
  assert(cold.cells <= 3000 * 8 + nCol * 20, 'lần đầu: ' + cold.cells + ' ô');
  assert(warm.cells <= nCol + 15 * nCol, 'đã đệm chỉ mục: ' + warm.cells + ' ô (≤ tiêu đề + 15 hàng)');
  assert.strictEqual(warm.n, 15);
  console.log(`    số đo: đồng bộ 3000 câu ${syncMs} ms; practiceStart chỉ mục chưa đệm ${cold.cells} ô / ${cold.ms} ms; đã đệm ${warm.cells} ô / ${warm.ms} ms (pool ${3000 * nCol} ô)`);
  module.exports.tc411 = { syncMs, cold, warm, poolCells: 3000 * nCol };
});

t('TC-4.12 Sheet cũ không có LuyenTap/KetQuaLuyenTap: practiceMeta rỗng, không lỗi; lần ghi đầu tự tạo trang có tiêu đề', () => {
  const w = world({ sync: false });
  const ss = w.g.SpreadsheetApp.getActiveSpreadsheet();
  ss.deleteSheet(ss.getSheetByName('LuyenTap'));
  ss.deleteSheet(ss.getSheetByName('KetQuaLuyenTap'));
  clearCache(w.g);
  const m = ok(w.g.call('practiceMeta', { token: w.sTok }));
  assert.deepStrictEqual(m.cay, []); assert.strictEqual(m.soCauSai, 0); assert.strictEqual(m.soBai, 0);
  assert(!ss.getSheetByName('LuyenTap'), 'đọc không tạo trang');
  assert.strictEqual(ok(w.g.call('adminPracticeList', { token: w.tTok })).tong, 0);
  assert.strictEqual(ok(w.g.call('myResults', { token: w.sTok, loai: 'luyen' })).length, 0);
  assert(!w.g.call('practiceStart', { token: w.sTok, kieu: 'TU_TAO', so: { TN: 5 }, phut: 5 }).ok);
  w.sync({ filter: {} });
  assert.deepStrictEqual(plain(w.g._sheets.LuyenTap._data()[0]), plain(w.g.SCHEMA.LuyenTap.map((d) => d[1])));
  const s = ok(w.g.call('practiceStart', { token: w.sTok, kieu: 'TU_TAO', so: { TN: 5 }, phut: 5 }));
  ok(w.g.call('submitExam', { token: w.sTok, attemptToken: s.attemptToken, answers: {} }));
  assert.deepStrictEqual(plain(w.g._sheets.KetQuaLuyenTap._data()[0]), plain(w.g.SCHEMA.KetQuaLuyenTap.map((d) => d[1])));
  assert.strictEqual(w.g._sheets.KetQuaLuyenTap._data().length, 2);
  // dữ liệu cũ: KetQua trước Pha 4 (chiTiet không có h/k) vẫn đọc được
  doExam(w, 'DEMAU', {});
  const kq = w.g._sheets.KetQua._data();
  const ci = kq[0].indexOf('Chi tiết (JSON)');
  kq[1][ci] = JSON.stringify(JSON.parse(kq[1][ci]).map((d) => { delete d.h; delete d.k; return d; }));
  clearCache(w.g);
  assert(ok(w.g.call('practiceMeta', { token: w.sTok })).soCauSai >= 1);
});

t('TC-4.13 câu X trong pool và trong đề đang mở (SAU_HAN, NGAY) / đề NHAP: 50 lần practiceStart (mọi kiểu) không có X; đóng đề thì X xuất hiện lại', () => {
  for (const kind of ['SAU_HAN', 'NGAY', 'NHAP']) {
    const w = world();
    const meta0 = ok(w.g.call('practiceMeta', { token: w.sTok }));
    const thin = meta0.cay.find((x) => /Bài 11/.test(x.bai)); // 3 câu Phần I
    const X = w.k.rows.find((r) => r[col('Bài')] === thin.bai && /Phần I –/.test(r[col('Dạng câu hỏi')]))[0];
    // X sai ở bài luyện trước khi đề được tạo (để X có trong tập CAU_SAI nếu không bị chặn)
    const s0 = ok(w.g.call('practiceStart', { token: w.sTok, kieu: 'TU_TAO', bai: [thin.bai], so: { TN: 5, DS: 0, TL: 0 }, phut: 5 }));
    assert(payload(s0.attemptToken).qids.includes(X));
    ok(w.g.call('submitExam', { token: w.sTok, attemptToken: s0.attemptToken, answers: {} }));
    const eid = saveExam(w, kind === 'NHAP' ? { trangThai: 'NHAP' } : { trangThai: 'MO', hienLoiGiai: kind, ketThuc: inHour() }, [X]);
    // R-2: xem lại bài luyện cũ (có X) lúc X đang bị chặn → không có đáp án/lời giải của X; giáo viên vẫn thấy
    const old = ok(w.g.call('getResult', { token: w.sTok, resultId: ok(w.g.call('myResults', { token: w.sTok, loai: 'luyen' }))[0].id }));
    const xi = old.items.find((it) => it.noiDung === String(w.byMa[X][col('Nội dung câu hỏi')]));
    assert(xi && xi.an && !xi.dapAn && !xi.loiGiai && /chưa kết thúc/.test(xi.anNote), kind + ': xem lại lộ đáp án X');
    assert(old.items.filter((it) => it !== xi).every((it) => it.loiGiai), 'câu khác vẫn có lời giải');
    const oldT = ok(w.g.call('getResult', { token: w.tTok, resultId: old.id }));
    assert(oldT.items.find((it) => it.stt === xi.stt).loiGiai, 'giáo viên vẫn thấy lời giải');
    const meta = ok(w.g.call('practiceMeta', { token: w.sTok }));
    assert.strictEqual(meta.cay.find((x) => x.bai === thin.bai).dem.TN, 2, 'practiceMeta không đếm X');
    const kinds = ['TU_TAO', 'CAU_SAI', 'NHANH'];
    for (let i = 0; i < 50; i++) {
      const k = kinds[i % 3];
      const body = k === 'TU_TAO' ? { bai: [thin.bai], so: { TN: 5, DS: 0, TL: 0 }, phut: 5 } : k === 'NHANH' ? { bai: [thin.bai] } : {};
      const s = ok(w.g.call('practiceStart', Object.assign({ token: w.sTok, kieu: k }, body)));
      assert(!payload(s.attemptToken).qids.some((q) => q === X || q.startsWith(eid + '#')), kind + ' lần ' + i + ' có X');
    }
    // câu trong pool bị chặn cũng không lộ qua kết quả xem lại? (bài s0 làm trước khi chặn: vẫn là câu luyện tập đã nộp → được xem)
    // đóng đề → X xuất hiện lại
    saveExam(w, { trangThai: 'DONG', hienLoiGiai: kind === 'NGAY' ? 'NGAY' : 'SAU_HAN' }, [X], eid);
    const back = ok(w.g.call('getResult', { token: w.sTok, resultId: old.id }));
    assert(back.items.every((it) => it.loiGiai && !it.an), 'đóng đề → lời giải hiện lại');
    assert.strictEqual(ok(w.g.call('practiceMeta', { token: w.sTok })).cay.find((x) => x.bai === thin.bai).dem.TN, 3);
    const s = ok(w.g.call('practiceStart', { token: w.sTok, kieu: 'TU_TAO', bai: [thin.bai], so: { TN: 5, DS: 0, TL: 0 }, phut: 5 }));
    assert(payload(s.attemptToken).qids.includes(X), 'X xuất hiện lại');
    assert(payload(ok(w.g.call('practiceStart', { token: w.sTok, kieu: 'CAU_SAI' })).attemptToken).qids.includes(X));
  }
  // đề chưa tới giờ mở (Mở lúc ở tương lai) cũng chặn; đề "Không hiện" lời giải chặn luôn
  const w = world();
  const X = w.g._sheets.LuyenTap._data()[1][0];
  const e1 = saveExam(w, { trangThai: 'MO', hienLoiGiai: 'NGAY', batDau: inHour() }, [X]);
  assert(w.g.blockedBankIds_()[X], 'đề chưa mở');
  saveExam(w, { trangThai: 'MO', hienLoiGiai: 'KHONG', batDau: hourAgo() }, [X], e1);
  w.g.__MEMO(); clearCache(w.g);
  assert(w.g.blockedBankIds_()[X], 'đề không công bố lời giải');
  saveExam(w, { trangThai: 'MO', hienLoiGiai: 'NGAY', batDau: hourAgo() }, [X], e1);
  w.g.__MEMO();
  assert(w.g.blockedBankIds_()[X], 'vòng 2: đề NGAY đang mở vẫn chặn');
  saveExam(w, { trangThai: 'MO', hienLoiGiai: 'NGAY', batDau: hourAgo(), ketThuc: hourAgo() }, [X], e1);
  w.g.__MEMO();
  assert(!w.g.blockedBankIds_()[X], 'đề NGAY đã hết hạn: không chặn');
  saveExam(w, { trangThai: 'DONG', hienLoiGiai: 'KHONG' }, [X], e1);
  w.g.__MEMO();
  assert(w.g.blockedBankIds_()[X], 'đề đã đóng nhưng không công bố lời giải: vẫn chặn');
  // đệm hết hạn đúng mốc đóng đề: đề NGAY đóng sau 2 giây
  saveExam(w, { trangThai: 'MO', hienLoiGiai: 'NGAY', ketThuc: inHour() }, [X], e1);
  w.g.__MEMO();
  assert(w.g.blockedBankIds_()[X]);
  const blkKey = Object.keys(w.g._cache).find((k) => /^blk_/.test(k));
  assert(JSON.parse(w.g._cache[blkKey].v).until <= Date.now() + 3600e3 + 60e3, 'đệm sống tới mốc đóng đề');
});

t('TC-4.14 sửa đề sau khi học sinh làm (chèn câu lên đầu): câu nhập tay lệch bị bỏ khỏi CAU_SAI; câu có maKho vẫn đúng', () => {
  const w = world({ sync: false }); // pool rỗng: câu kho X chỉ có trong đề
  w.sync({ maKho: [w.k.rows[0][0]] });
  const X = w.k.rows.find((r) => /Phần I –/.test(r[col('Dạng câu hỏi')]) && r[col('Đáp án')] && r[0] !== w.k.rows[0][0])[0];
  const M = MANUAL(1);
  const eid = saveExam(w, { trangThai: 'MO', hienLoiGiai: 'NGAY' }, [M, X]);
  doExam(w, eid, {});
  saveExam(w, { trangThai: 'DONG', hienLoiGiai: 'NGAY' }, [M, X], eid);
  let set = payload(ok(w.g.call('practiceStart', { token: w.sTok, kieu: 'CAU_SAI' })).attemptToken).qids;
  assert.deepStrictEqual(set.sort(), [eid + '#1', eid + '#2'].sort());
  // giáo viên chèn câu mới lên đầu, đánh số lại
  saveExam(w, { trangThai: 'DONG', hienLoiGiai: 'NGAY' }, [MANUAL(0), M, X], eid);
  set = payload(ok(w.g.call('practiceStart', { token: w.sTok, kieu: 'CAU_SAI' })).attemptToken).qids;
  assert(!set.includes(eid + '#1'), 'ô #1 nay là câu khác → bỏ');
  assert(!set.includes(eid + '#2'), 'không đoán theo vị trí mới cho câu nhập tay');
  assert(set.includes(eid + '#3'), 'câu kho X tìm lại theo mã: ' + set);
  // sửa nội dung câu nhập tay tại chỗ → mã băm khác → bỏ
  const w2 = world({ sync: false });
  w2.sync({ maKho: [w2.k.rows[0][0]] });
  const e2 = saveExam(w2, { trangThai: 'MO', hienLoiGiai: 'NGAY' }, [MANUAL(5)]);
  doExam(w2, e2, {});
  saveExam(w2, { trangThai: 'DONG', hienLoiGiai: 'NGAY' }, [MANUAL(5)], e2);
  assert.strictEqual(ok(w2.g.call('practiceMeta', { token: w2.sTok })).soCauSai, 1);
  saveExam(w2, { trangThai: 'DONG', hienLoiGiai: 'NGAY' }, [Object.assign(MANUAL(5), { noiDung: 'Nội dung đã sửa.' })], e2);
  assert.strictEqual(ok(w2.g.call('practiceMeta', { token: w2.sTok })).soCauSai, 0);
  // câu lấy từ đề thi trong bài luyện: chiTiet q = examId#stt, xem lại có lời giải
  const w3 = world({ sync: false });
  w3.sync({ maKho: [w3.k.rows[0][0]] });
  const e3 = saveExam(w3, { trangThai: 'MO', hienLoiGiai: 'NGAY' }, [MANUAL(7)]);
  doExam(w3, e3, {});
  assert.strictEqual(ok(w3.g.call('practiceMeta', { token: w3.sTok })).soCauSai, 0, 'đề còn mở: câu chưa vào tập câu sai');
  saveExam(w3, { trangThai: 'DONG', hienLoiGiai: 'NGAY' }, [MANUAL(7)], e3);
  const s = ok(w3.g.call('practiceStart', { token: w3.sTok, kieu: 'CAU_SAI' }));
  assert(!/Giải 7|"dapAn"/.test(JSON.stringify(s.questions)));
  const v = ok(w3.g.call('submitExam', { token: w3.sTok, attemptToken: s.attemptToken, answers: { 1: 'A' } }));
  assert.strictEqual(v.items[0].loiGiai, 'Giải 7');
  assert.strictEqual(ok(w3.g.call('practiceMeta', { token: w3.sTok })).soCauSai, 0, 'làm đúng → rút');
});

t('Pool: adminPracticeList (đang thi, số lượt) và adminPracticeToggle chỉ sửa ô Bật/Cập nhật; học sinh không gọi được', () => {
  const w = world();
  const X = w.g._sheets.LuyenTap._data()[1][0];
  saveExam(w, { trangThai: 'NHAP' }, [X]);
  const L = ok(w.g.call('adminPracticeList', { token: w.tTok, filter: { bat: 'DANG_THI' } }));
  assert.strictEqual(L.tong, 1); assert.strictEqual(L.items[0].maKho, X); assert.strictEqual(L.items[0].dangThi, true);
  assert.strictEqual(L.dem.dangThi, 1);
  assert(!w.g.call('adminPracticeList', { token: w.sTok }).ok);
  assert(!w.g.call('adminPracticeSync', { token: w.sTok, filter: {} }).ok);
  assert(!w.g.call('adminPracticeToggle', { token: w.sTok, maKho: [X], bat: 'KHONG' }).ok);
  const before = JSON.stringify(w.g._sheets.LuyenTap._data().map((r) => r.slice(0, 16)));
  assert.strictEqual(ok(w.g.call('adminPracticeToggle', { token: w.tTok, maKho: [X, 'KHONG_CO'], bat: 'KHONG' })).n, 1);
  assert.strictEqual(JSON.stringify(w.g._sheets.LuyenTap._data().map((r) => r.slice(0, 16))), before, 'không đổi nội dung');
  assert.strictEqual(ok(w.g.call('adminPracticeList', { token: w.tTok, filter: { bat: 'KHONG' } })).tong, 1);
  const s = ok(w.g.call('practiceStart', { token: w.sTok, kieu: 'TU_TAO', so: { TN: 5 }, phut: 5 }));
  ok(w.g.call('submitExam', { token: w.sTok, attemptToken: s.attemptToken, answers: {} }));
  const q0 = payload(s.attemptToken).qids[0];
  const L2 = ok(w.g.call('adminPracticeList', { token: w.tTok, filter: { q: q0 } }));
  assert.strictEqual(L2.items[0].soLuot, 1);
});

t('R-12 ô "Hình vẽ" có nhiều hình: nhận đủ tên; chép đủ hình, hình thêm gắn vào nội dung', () => {
  const g0 = createContext({ quiet: true });
  assert.deepStrictEqual(plain(g0.bankImageNames_('Có – A1.png, B 2.png (02. HÌNH VẼ/Lớp 12)')), ['A1.png', 'B 2.png']);
  assert.deepStrictEqual(plain(g0.bankImageNames_('Có – A1.png; B2.jpg')), ['A1.png', 'B2.jpg']);
  assert.deepStrictEqual(plain(g0.bankImageNames_('Có – A1.png và B2.png (x)')), ['A1.png', 'B2.png']);
  assert.deepStrictEqual(plain(g0.bankImageNames_('Có – hinh 1.png (02. HÌNH VẼ/Lớp 12)')), ['hinh 1.png']);
  assert.strictEqual(g0.bankImageName_('Có – A1.png, B2.png (x)'), 'A1.png');
  assert.deepStrictEqual(plain(g0.bankImageNames_('Không')), []);
  // chép thật qua Drive giả
  const rows = K.standardRows();
  const r = rows.find((x) => /^Có/.test(x[col('Hình vẽ')]));
  r[col('Hình vẽ')] = `Có – ${r[0]}.png, ${r[0]}-b.png (02. HÌNH VẼ/Lớp 12)`;
  const w = world({ kho: { rows, missingImages: 0 }, sync: false });
  w.g._drive.addFile(r[0] + '-b.png', w.k.folderId);
  const out = ok(w.g.call('adminBankToQuestions', { token: w.tTok, maKho: [r[0]] }));
  const q = out.questions[0];
  assert(/^https:\/\/lh3/.test(q.hinhAnh));
  assert(/!\[\]\(https:\/\/lh3\.googleusercontent\.com\/d\/[^)]+\)$/.test(q.noiDung), q.noiDung);
  assert.deepStrictEqual(plain(out.thieuHinh), []);
  assert.strictEqual(w.g._stats.makeCopy, 2);
});

/** Thêm n bài luyện giả của học sinh khác vào KetQuaLuyenTap (đo hiệu năng R-3). */
function fillPracticeRows(w, n) {
  const sh = w.g._sheets.KetQuaLuyenTap._data();
  const hd = sh[0];
  const det = JSON.stringify(Array.from({ length: 15 }, (_, i) => ({ s: i + 1, l: 'TN', a: 'A', sc: 0, m: 0.25, c: 0, cd: 'Chủ đề mẫu', md: 'NB', p: 1, q: 'L12C1B01-P1-' + String(i).padStart(5, '0'), h: 'abcdef12', k: 'L12C1B01-P1-' + String(i).padStart(5, '0') })));
  for (let i = 0; i < n; i++) {
    const o = { 'Mã bài': 'LTGIA' + i, 'Mã HS': 'HSX' + (i % 300), 'Điểm (thang 10)': 5, 'Chi tiết (JSON)': det, 'Họ tên': 'Học sinh giả', 'Nộp lúc': '01/11/2026 10:00:00', 'Kiểu': 'TU_TAO' };
    sh.push(hd.map((h) => (h in o ? o[h] : '')));
  }
}
module.exports.measure = (w) => {
  const m = {};
  const run = (name, fn) => { clearCache(w.g); w.g._resetStats(); fn(); m[name] = { cells: w.g._stats.cells.KetQuaLuyenTap || 0, full: w.g._stats.reads.KetQuaLuyenTap || 0, fullKQ: w.g._stats.reads.KetQua || 0 }; };
  let s;
  run('practiceMeta', () => ok(w.g.call('practiceMeta', { token: w.sTok })));
  run('practiceStart', () => { s = ok(w.g.call('practiceStart', { token: w.sTok, kieu: 'TU_TAO', so: { TN: 5 }, phut: 5 })); });
  run('submitExam', () => ok(w.g.call('submitExam', { token: w.sTok, attemptToken: s.attemptToken, answers: {} })));
  run('myResults luyen', () => ok(w.g.call('myResults', { token: w.sTok, loai: 'luyen' })));
  return m;
};

t('Vòng 2 R-3: 5 000 bài luyện của học sinh khác — mở Luyện tập / bắt đầu / nộp không đọc cả trang KetQuaLuyenTap, KetQua', () => {
  const w = world();
  const s0 = ok(w.g.call('practiceStart', { token: w.sTok, kieu: 'TU_TAO', so: { TN: 5 }, phut: 5 }));
  ok(w.g.call('submitExam', { token: w.sTok, attemptToken: s0.attemptToken, answers: {} }));
  fillPracticeRows(w, 5000);
  const m = module.exports.measure(w);
  Object.keys(m).forEach((k) => {
    assert.strictEqual(m[k].full, 0, k + ': đọc cả trang KetQuaLuyenTap');
    assert.strictEqual(m[k].fullKQ, 0, k + ': đọc cả trang KetQua');
    assert(m[k].cells <= (k === 'submitExam' ? 2 : 1) * 5002 + 3 * 20 + 40, k + ': ' + m[k].cells + ' ô'); // nộp: cột Mã HS + cột Mã bài (kiểm trùng trong khóa)
  });
  console.log('    số đo (ô đọc trên KetQuaLuyenTap, 5 001 hàng): ' + Object.keys(m).map((k) => `${k} ${m[k].cells}`).join(' · '));
  module.exports.r3 = m;
});

t('Vòng 2 R-2: bắt đầu bài luyện có X, giáo viên đưa X vào đề đang mở, nộp → kết quả không có đáp án/lời giải của X; điểm vẫn chấm', () => {
  const w = world();
  const s = ok(w.g.call('practiceStart', { token: w.sTok, kieu: 'TU_TAO', so: { TN: 5 }, phut: 5 }));
  const qids = payload(s.attemptToken).qids;
  const X = qids[0];
  saveExam(w, { trangThai: 'MO', hienLoiGiai: 'NGAY' }, [X]);
  const v = ok(w.g.call('submitExam', { token: w.sTok, attemptToken: s.attemptToken, answers: w.answersFor(s.attemptToken, (q) => w.right(q)) }));
  assert.strictEqual(v.diem, 10, 'điểm vẫn chấm đủ');
  assert(v.items[0].an && !v.items[0].dapAn && !v.items[0].loiGiai, 'lộ đáp án X');
  assert(v.items.slice(1).every((it) => it.loiGiai), 'câu khác có lời giải');
});

t('Vòng 2 N-1: gửi cả chương và bài → lấy giao (chỉ bài thuộc chương)', () => {
  const w = world(BIG());
  const meta = ok(w.g.call('practiceMeta', { token: w.sTok }));
  const a = meta.cay.find((x) => /Chương II/.test(x.chuong));
  const s = ok(w.g.call('practiceStart', { token: w.sTok, kieu: 'TU_TAO', chuong: [a.chuong], bai: [a.bai], so: { TN: 10 }, phut: 10 }));
  payload(s.attemptToken).qids.forEach((q) => assert.strictEqual(w.byMa[q][col('Bài')], a.bai, 'ngoài bài đã chọn: ' + q));
  // bài không thuộc chương → không có câu
  const other = meta.cay.find((x) => x.chuong !== a.chuong);
  assert(!w.g.call('practiceStart', { token: w.sTok, kieu: 'TU_TAO', chuong: [a.chuong], bai: [other.bai], so: { TN: 5 }, phut: 10 }).ok);
});

t('Vòng 2 R-6: tổng pool đang bật quá 3 000 câu sau "Thêm" → báo lỗi rõ, không ghi', () => {
  const w = world({ kho: { rows: K.bigRows(3010), missingImages: 0 }, sync: false });
  const codes = w.k.rows.map((r) => r[0]);
  w.sync({ maKho: codes.slice(0, 2995) });
  const n0 = w.g._sheets.LuyenTap._data().length;
  const r = w.g.call('adminPracticeSync', { token: w.tTok, maKho: codes.slice(2995, 3010), mode: 'them' });
  assert(!r.ok && /tối đa 3000 câu đang bật/.test(r.error) && /3010/.test(r.error), r.error);
  assert.strictEqual(w.g._sheets.LuyenTap._data().length, n0, 'không ghi');
  // tắt bớt rồi thêm: được
  ok(w.g.call('adminPracticeToggle', { token: w.tTok, maKho: codes.slice(0, 20), bat: 'KHONG' }));
  assert.strictEqual(w.sync({ maKho: codes.slice(2995, 3010) }).them, 15);
  // "thay" bằng 10 câu: được
  assert(w.sync({ maKho: codes.slice(0, 10), mode: 'thay' }).tat > 0);
});

t('Vòng 2 R-5 / N-2: nộp lại tìm bài theo mã bài + mã học sinh; tắt luyện tập vẫn xem được lịch sử và bài luyện cũ', () => {
  const w = world();
  const s = ok(w.g.call('practiceStart', { token: w.sTok, kieu: 'TU_TAO', so: { TN: 5 }, phut: 5 }));
  const v = ok(w.g.call('submitExam', { token: w.sTok, attemptToken: s.attemptToken, answers: {} }));
  assert(/^LT\d{12}[0-9A-F]{16}$/.test(v.id), v.id); // Pha 6 (N-1): 16 hex
  // giả lập hàng trùng mã bài của học sinh khác (đổi Mã HS): nộp lại không trả bài của người khác
  const d = w.g._sheets.KetQuaLuyenTap._data();
  d[1][d[0].indexOf('Mã HS')] = 'HS9999';
  clearCache(w.g);
  const r = w.g.call('submitExam', { token: w.sTok, attemptToken: s.attemptToken, answers: {} });
  assert(!r.ok || r.data.studentId === 'HS0001', 'trả bài của học sinh khác');
  // Pha 6 (N-1): kiểm trùng theo mã bài + mã HS → hàng của "học sinh khác" giữ nguyên, bài của HS0001 được ghi riêng
  assert.strictEqual(d[1][d[0].indexOf('Mã HS')], 'HS9999');
  clearCache(w.g);
  K.setSetting(w.g, { CHO_LUYEN_TAP: 'KHONG' });
  assert.strictEqual(ok(w.g.call('myResults', { token: w.sTok, loai: 'luyen' })).length, 1);
  assert(ok(w.g.call('getResult', { token: w.sTok, resultId: v.id })).items.length);
});

console.log(`\n${passed} kiểm thử đạt${failed ? ', ' + failed + ' KHÔNG ĐẠT' : '.'}`);
