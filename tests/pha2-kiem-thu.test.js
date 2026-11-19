// Kiểm thử độc lập Pha 2 (người kiểm thử) — phía máy chủ, viết theo docs/spec/pha-2-ngan-hang.md (TC-2.x).
// node tests/pha2-kiem-thu.test.js
// Hộp đen: chỉ gọi API qua gas-shim (doPost) và hàm chấm gradeOne_; kho giả tests/fixtures/kho-gia.js (tự soạn).
// Bao phủ: TC-2.1 → TC-2.11 (phía máy chủ), TC-2.14 (máy chủ 1.0.0), Sheet cũ thiếu cột, features "bank".
const assert = require('assert');
const path = require('path');
const { createContext } = require('./gas-shim');
const K = require('./fixtures/kho-gia');

const results = [];
function t(name, fn) {
  try { fn(); results.push([name, true]); console.log('  ✓ ' + name); }
  catch (e) { results.push([name, false, e.message]); console.error('  ✗ ' + name + '\n    ' + (e.stack || e).split('\n').slice(0, 5).join('\n    ')); process.exitCode = 1; }
}
const info = (s) => console.log('      · ' + s);
function ok(r, what) { if (!r.ok) throw new Error((what || 'API') + ' lỗi: ' + r.error); return r.data; }
const pwOf = (g) => g._sheets.CaiDat._data().find((r) => r[0] === 'MAT_KHAU_QUAN_TRI')[1];
const clearCache = (g) => Object.keys(g._cache).forEach((k) => delete g._cache[k]);
const normTF = (s) => String(s || '').toUpperCase().replace(/Đ/g, 'D').replace(/[^DS]/g, '');
const KHO = 'Kho câu hỏi';

function world(opts = {}) {
  const g = createContext({ quiet: true, codePath: opts.codePath, makeCopyMs: opts.makeCopyMs || 0 });
  g.setup();
  const kho = opts.noBank ? null : K.install(g, opts.install || {});
  const tTok = ok(g.call('loginAdminPassword', { password: pwOf(g) })).token;
  const sTok = ok(g.call('loginPin', { studentId: 'HS0001', pin: '0101' })).token; // HS lớp 12A1
  g._resetStats();
  return { g, kho, tTok, sTok, A: (action, body) => g.call(action, Object.assign({ token: tTok }, body || {})) };
}
const maOf = (r) => r[0];
const colIdx = (label) => K.HEADER.indexOf(label);
// Gọi adminBankToQuestions tới hết (theo tiepTuc); trả {questions (gộp, không trùng maKho), canhBao, calls, perCallMs}
function toQuestions(w, maKho) {
  const qs = new Map(); const canhBao = []; let cursor; let calls = 0; const perCallMs = [];
  for (;;) {
    const t0 = w.g._clock.offset();
    const d = ok(w.A('adminBankToQuestions', { maKho, cursor }), 'adminBankToQuestions');
    perCallMs.push(w.g._clock.offset() - t0);
    calls++;
    (d.questions || []).forEach((q) => qs.set(q.maKho || ('#' + qs.size), q));
    (d.canhBao || []).forEach((c) => canhBao.push(c));
    if (d.tiepTuc == null || d.tiepTuc === '' || d.tiepTuc === false) break;
    cursor = d.tiepTuc;
    if (calls > 200) throw new Error('tiepTuc không dừng');
  }
  return { questions: [...qs.values()], canhBao, calls, perCallMs };
}
function listAll(w, filter) {
  const out = []; let page = 1;
  for (;;) {
    const d = ok(w.A('adminBankList', { filter: filter || {}, page, size: 100 }), 'adminBankList');
    out.push(...d.items);
    if (!d.items.length || out.length >= d.tong) return { items: out, tong: d.tong };
    page++;
    if (page > 100) throw new Error('phân trang không dừng');
  }
}
const srcKey = (n) => (n.ma != null ? n.ma : n.ten);

console.log('Kiểm thử độc lập Pha 2 — máy chủ:');

// ---------- Chung ----------
t('features có "bank"; APP_VERSION tăng số phụ so với 1.2.x (Pha 1)', () => {
  const { g } = world({ noBank: true });
  const p = ok(g.call('publicConfig'));
  assert(p.features.includes('bank'), 'thiếu bank: ' + p.features);
  ['changePin', 'goal', 'bootstrap', 'cache'].forEach((f) => assert(p.features.includes(f), 'mất ' + f));
  assert(/^1\.(\d+)\.\d+$/.test(g.APP_VERSION) && +g.APP_VERSION.split('.')[1] >= 3, 'APP_VERSION=' + g.APP_VERSION);
  info('APP_VERSION ' + g.APP_VERSION);
});

t('Meta trên kho giả chuẩn: tong 54, dungDuoc 47 (Phần IV + 3 câu lỗi định dạng + 4 câu chưa có đáp án bị loại)', () => {
  const w = world();
  const m = ok(w.A('adminBankMeta'));
  info(`Meta: tong=${m.tong} coDapAn=${m.coDapAn} dungDuoc=${m.dungDuoc} theoDang=${JSON.stringify(m.theoDang)} theoMucDo=${JSON.stringify(m.theoMucDo)}`);
  assert.strictEqual(m.tong, w.kho.rows.length);
  assert.strictEqual(m.tong, 54);
  assert.strictEqual(m.dungDuoc, 47);
  assert(m.coDapAn >= 47 && m.coDapAn <= 51, 'coDapAn=' + m.coDapAn);
  assert(Array.isArray(m.cay) && m.cay.length > 0 && m.cay.every((c) => c.dem && 'TN' in c.dem));
  assert(Array.isArray(m.nguon) && m.nguon.some((n) => /Nguồn mẫu B/.test(n.ten)));
  assert('docLuc' in m);
  // tổng đếm theo cây = dungDuoc
  const sum = m.cay.reduce((s, c) => s + c.dem.TN + c.dem.DS + c.dem.TL, 0);
  assert.strictEqual(sum, 47, 'tổng cây ' + sum);
});

// ---------- TC-2.1 ----------
t('TC-2.1 Đáp án Phần II: 3 kiểu ghi → ĐSSĐ / SĐĐĐ / ĐSSĐ; mức độ Biết/Hiểu/Vận dụng/Vận dụng cao → NB/TH/VD/VDC', () => {
  const rows = [
    K.row({ phan: 2, cau: 1, dapAn: 'a) Đúng b) Sai c) Sai d) Đúng', muc: 'Biết' }),
    K.row({ phan: 2, cau: 2, dapAn: 'a) S b) Đ c) Đ d) Đ', muc: 'Hiểu' }),
    K.row({ phan: 2, cau: 3, dapAn: 'a) đúng; b) Sai, c) S. d) Đ', muc: 'Vận dụng' }),
    K.row({ phan: 1, cau: 1, dapAn: 'C', muc: 'Vận dụng cao' }),
    K.row({ phan: 2, cau: 4, dapAn: 'a) Đúng b) Sai c) Sai', muc: 'Biết' }),           // thiếu ý d
    K.row({ phan: 2, cau: 5, dapAn: 'a) Đúng b) Sai d) Đúng', muc: 'Biết' }),           // thiếu ý c
    K.row({ phan: 2, cau: 6, dapAn: 'a) Đúng b) Sai c) Sai d) Đúng', muc: 'Vận dụng', mucY: 'a) Biết; b) Hiểu; c) Hiểu; d) Vận dụng' })
  ];
  const w = world({ install: { rows } });
  const r = toQuestions(w, rows.slice(0, 4).map(maOf));
  const by = Object.fromEntries(r.questions.map((q) => [q.maKho, q]));
  const q = rows.map((x) => by[maOf(x)]);
  assert(q[0] && q[1] && q[2] && q[3], 'thiếu câu: ' + Object.keys(by));
  assert.strictEqual(normTF(q[0].dapAn), 'DSSD', 'kiểu 1: ' + q[0].dapAn);
  assert.strictEqual(normTF(q[1].dapAn), 'SDDD', 'kiểu 2: ' + q[1].dapAn);
  assert.strictEqual(normTF(q[2].dapAn), 'DSSD', 'kiểu lẫn: ' + q[2].dapAn);
  assert.strictEqual(q[0].loai, 'DS'); assert.strictEqual(+q[0].phan, 2);
  assert.strictEqual(q[3].loai, 'TN'); assert.strictEqual(+q[3].phan, 1); assert.strictEqual(q[3].dapAn, 'C');
  assert.deepStrictEqual(q.slice(0, 4).map((x) => x.mucDo), ['NB', 'TH', 'VD', 'VDC']);
  info(`dapAn: ${q[0].dapAn} | ${q[1].dapAn} | ${q[2].dapAn}`);
  // thiếu ý → không có đáp án: không hiện trong List, không nạp được
  const list = listAll(w).items.map((x) => x.maKho);
  assert(!list.includes(maOf(rows[4])) && !list.includes(maOf(rows[5])), 'câu thiếu ý vẫn ở List');
  assert(list.includes(maOf(rows[6])));
  const bad = w.A('adminBankToQuestions', { maKho: [maOf(rows[4])] });
  const badQs = bad.ok ? (bad.data.questions || []) : [];
  assert(!badQs.some((x) => x.maKho === maOf(rows[4]) && x.dapAn), 'câu thiếu ý d vẫn được nạp kèm đáp án');
  info('nạp câu thiếu ý d: ' + (bad.ok ? 'questions=' + badQs.length + ', canhBao=' + JSON.stringify(bad.data.canhBao) : 'lỗi "' + bad.error + '"'));
});

t('TC-2.1 Chấm câu Phần II lấy từ kho: ĐSSĐ → 1 điểm; sai 1 ý → 0,5', () => {
  const rows = [K.row({ phan: 2, cau: 1, dapAn: 'a) Đúng b) Sai c) Sai d) Đúng' })];
  const w = world({ install: { rows } });
  const q = toQuestions(w, [maOf(rows[0])]).questions[0];
  const qq = Object.assign({}, q, { stt: 1, diem: 1 });
  assert.strictEqual(w.g.gradeOne_(qq, ['D', 'S', 'S', 'D']).score, 1);
  assert.strictEqual(w.g.gradeOne_(qq, 'ĐSSĐ').score, 1);
  assert.strictEqual(w.g.gradeOne_(qq, ['D', 'S', 'S', 'S']).score, 0.5);
  assert.strictEqual(w.g.gradeOne_(qq, ['S', 'S', 'S', 'D']).score, 0.5);
});

t('TC-2.1 Ánh xạ khác: Chương/Bài, chuDe bỏ "Bài N. ", nội dung/A–D/lời giải/nguồn/mức độ từng ý nguyên văn', () => {
  const nd = 'Nội dung tự soạn có $\\frac{p_1V_1}{T_1}$ và ${3.10}^{8}\\ \\text{m/s}$, nhiệt độ $-20\\ \\text{°C}$.';
  const rows = [K.row({ phan: 2, cau: 1, ch: 1, bai: 1, dapAn: 'a) Đúng b) Sai c) Sai d) Đúng', noiDung: nd, mucY: 'a) Biết; b) Hiểu; c) Hiểu; d) Vận dụng', loiGiai: 'LG $\\Delta U = A + Q$', nguon: 'Nguồn tự soạn X' })];
  const w = world({ install: { rows } });
  const q = toQuestions(w, [maOf(rows[0])]).questions[0];
  const r = rows[0];
  assert.strictEqual(q.noiDung, nd);
  assert.deepStrictEqual([q.A, q.B, q.C, q.D], [r[9], r[10], r[11], r[12]]);
  assert.strictEqual(q.loiGiai, r[14]);
  assert.strictEqual(q.maKho, r[0]);
  assert.strictEqual(q.chuong, r[2]);
  assert.strictEqual(q.bai, r[3]);
  assert.strictEqual(q.chuDe, r[3].replace(/^Bài\s*\d+\.\s*/, ''));
  assert.strictEqual(q.nguon, r[16]);
  assert.strictEqual(q.mucDoY, r[6]);
  assert(!q.hinhAnh, 'không có hình mà có hinhAnh');
  info(`chuDe="${q.chuDe}"`);
});

// ---------- TC-2.2 ----------
t('TC-2.2 Phần III: "3,0" giữ nguyên, saiSo trống; đúng với 3, 3.0, 3,0; "-120" đúng -120, sai 120', () => {
  const rows = [K.row({ phan: 3, cau: 1, dapAn: '3,0' }), K.row({ phan: 3, cau: 2, dapAn: '-120' })];
  const w = world({ install: { rows } });
  const by = Object.fromEntries(toQuestions(w, rows.map(maOf)).questions.map((q) => [q.maKho, q]));
  const a = Object.assign({ stt: 1, diem: 0.25 }, by[maOf(rows[0])]);
  const b = Object.assign({ stt: 2, diem: 0.25 }, by[maOf(rows[1])]);
  assert.strictEqual(a.dapAn, '3,0'); assert.strictEqual(a.loai, 'TL'); assert.strictEqual(+a.phan, 3);
  assert(!a.saiSo, 'saiSo=' + a.saiSo);
  ['3', '3.0', '3,0'].forEach((x) => assert(w.g.gradeOne_(a, x).correct, x));
  assert(!w.g.gradeOne_(a, '3,1').correct);
  assert.strictEqual(b.dapAn, '-120');
  assert(w.g.gradeOne_(b, '-120').correct);
  assert(!w.g.gradeOne_(b, '120').correct);
});

// ---------- TC-2.3 ----------
t('TC-2.3 Câu chưa có đáp án / Phần IV / lỗi định dạng không xuất hiện ở List, Source, Matrix', () => {
  const w = world();
  const rows = w.kho.rows;
  const excluded = rows.filter((r) => !r[13] || /Phần IV/.test(r[4]) || r[17] === 'x').map(maOf);
  const p4 = rows.filter((r) => /Phần IV/.test(r[4])).map(maOf);
  const noAns = rows.filter((r) => !r[13]).map(maOf);
  const malformed = rows.filter((r) => r[16] === 'Nguồn mẫu E').map(maOf);
  const bad = new Set([...noAns, ...p4, ...malformed]);
  assert.strictEqual(bad.size, 7);
  const list = listAll(w);
  assert.strictEqual(list.tong, 47); assert.strictEqual(list.items.length, 47);
  const listBad = list.items.filter((x) => bad.has(x.maKho)).map((x) => x.maKho);
  assert.deepStrictEqual(listBad, []);
  const m = ok(w.A('adminBankMeta'));
  const srcBad = [];
  m.nguon.forEach((n) => {
    const s = ok(w.A('adminBankSource', { nguon: srcKey(n) }), 'Source ' + n.ten);
    s.items.forEach((x) => { if (bad.has(x.maKho)) srcBad.push(x.maKho); });
  });
  assert.deepStrictEqual(srcBad, []);
  for (const seed of [1, 2, 3, 4, 5]) {
    const mx = ok(w.A('adminBankMatrix', { so: { TN: 60, DS: 20, TL: 20 }, seed }));
    const mb = mx.maKho.filter((x) => bad.has(x));
    assert.deepStrictEqual(mb, [], 'Matrix chọn câu bị loại (seed ' + seed + ')');
  }
  void excluded;
});

t('TC-2.3 adminSaveExam: câu chưa có đáp án / Phần IV bị từ chối, thông báo nêu số câu', () => {
  const w = world();
  const good = toQuestions(w, w.kho.rows.filter((r) => r[13] && r[16] === 'Nguồn mẫu A' && /Phần I –/.test(r[4])).slice(0, 4).map(maOf)).questions;
  assert.strictEqual(good.length, 4);
  const exam = { tieuDe: 'Đề thử TC-2.3', lop: '12A1', thoiGian: 15, trangThai: 'NHAP' };
  // câu 3 mất đáp án
  const qs1 = good.map((q) => Object.assign({}, q));
  qs1[2].dapAn = '';
  const r1 = w.A('adminSaveExam', { exam, questions: qs1 });
  assert(!r1.ok, 'lưu được đề có câu chưa có đáp án');
  assert(/\b3\b/.test(r1.error), 'thông báo không nêu số câu 3: ' + r1.error);
  info('lỗi: ' + r1.error);
  // câu 2 là Phần IV
  const qs2 = good.map((q) => Object.assign({}, q));
  qs2[1] = Object.assign({}, qs2[1], { phan: 4, loai: 'TL', dapAn: '2' });
  const r2 = w.A('adminSaveExam', { exam, questions: qs2 });
  assert(!r2.ok, 'lưu được đề có câu Phần IV');
  assert(/\b2\b/.test(r2.error), 'thông báo không nêu số câu 2: ' + r2.error);
  info('lỗi: ' + r2.error);
  // Phần II thiếu ý (3 ký tự) cũng bị từ chối
  const ds = toQuestions(w, [w.kho.rows.find((r) => /Phần II/.test(r[4]) && r[13]).map((x) => x)[0]]).questions[0];
  const qs3 = good.concat([Object.assign({}, ds, { dapAn: 'DSS' })]);
  const r3 = w.A('adminSaveExam', { exam, questions: qs3 });
  assert(!r3.ok && /\b5\b/.test(r3.error), 'DS thiếu ý: ' + JSON.stringify(r3).slice(0, 200));
  // bản đúng thì lưu được
  ok(w.A('adminSaveExam', { exam, questions: good }), 'lưu đề hợp lệ');
});

// ---------- TC-2.4 ----------
function imageWorld(extra) {
  const w = world({ install: extra || {} });
  const imgRows = w.kho.rows.filter((r) => /^Có/.test(r[15]));
  return { w, imgRows };
}
t('TC-2.4 Hình: URL bản chép (lh3…/d/<id bản chép>); gọi lần 2 không chép lại; file gốc 0 lần setSharing', () => {
  const { w, imgRows } = imageWorld();
  const okRows = imgRows.filter((r) => r[13] && w.kho.originals[r[0] + '.png']);
  assert(okRows.length >= 3, 'kho giả ít hình');
  const one = [maOf(okRows[0])];
  const r1 = toQuestions(w, one);
  assert.strictEqual(w.g._stats.makeCopy, 1, 'makeCopy lần 1 = ' + w.g._stats.makeCopy);
  const url = r1.questions[0].hinhAnh;
  const m = /^https:\/\/lh3\.googleusercontent\.com\/d\/([\w-]+)$/.exec(url || '');
  assert(m, 'URL hình: ' + url);
  const copy = w.g._drive.files[m[1]];
  assert(copy, 'id trong URL không phải file trên Drive giả');
  assert.strictEqual(copy.copyOf, w.kho.originals[okRows[0][0] + '.png'], 'URL không trỏ bản chép của đúng file gốc');
  assert(w.g._stats.setSharing[m[1]] >= 1, 'bản chép chưa được chia sẻ');
  const r2 = toQuestions(w, one);
  assert.strictEqual(w.g._stats.makeCopy, 1, 'gọi lần 2 chép lại: makeCopy=' + w.g._stats.makeCopy);
  assert.strictEqual(r2.questions[0].hinhAnh, url);
  // Mọi câu có hình còn lại
  const all = toQuestions(w, okRows.map(maOf));
  assert.strictEqual(w.g._stats.makeCopy, okRows.length, 'makeCopy tổng ' + w.g._stats.makeCopy);
  all.questions.forEach((q) => assert(/^https:\/\/lh3\.googleusercontent\.com\/d\//.test(q.hinhAnh), q.maKho + ' ' + q.hinhAnh));
  const origIds = Object.values(w.kho.originals);
  const shared = origIds.filter((id) => w.g._stats.setSharing[id]);
  assert.deepStrictEqual(shared, [], 'file gốc bị setSharing');
});
t('TC-2.4 Không thấy file hình → cảnh báo có tên file, câu vẫn nạp được (không có hình)', () => {
  const { w } = imageWorld();
  const missName = w.kho.missingImages[0];
  const row = w.kho.rows.find((r) => r[0] + '.png' === missName);
  assert(row && row[13], 'hình thiếu phải thuộc câu có đáp án');
  const r = toQuestions(w, [row[0]]);
  assert.strictEqual(r.questions.length, 1, 'câu thiếu hình bị bỏ');
  assert(!r.questions[0].hinhAnh, 'hinhAnh=' + r.questions[0].hinhAnh);
  const s = JSON.stringify(r.canhBao);
  assert(s.includes(missName), 'cảnh báo không nêu tên file: ' + s);
  info('canhBao: ' + s);
});
t('TC-2.4 Chưa cấu hình THU_MUC_HINH_KHO_ID → tìm bằng getFilesByName, vẫn ra URL bản chép', () => {
  const { w, imgRows } = imageWorld({ noFolder: true });
  const r = imgRows.find((x) => x[13] && w.kho.originals[x[0] + '.png']);
  const q = toQuestions(w, [r[0]]).questions[0];
  assert(/^https:\/\/lh3\.googleusercontent\.com\/d\//.test(q.hinhAnh), q.hinhAnh);
  assert(w.g._stats.getFilesByName >= 1, 'không dùng getFilesByName');
  assert.strictEqual(w.g._stats.makeCopy, 1);
});

// ---------- TC-2.5 ----------
function parseViTri(v) { const m = /P(\d)\D*?Câu\s*(\d+)/i.exec(v || ''); return m ? [+m[1], +m[2]] : null; }
t('TC-2.5 Source: sắp đúng (phần, câu) với kiểu "P1 – Câu 3"', () => {
  const w = world();
  const m = ok(w.A('adminBankMeta'));
  const nA = m.nguon.filter((n) => /Nguồn mẫu A/.test(n.ten));
  assert.strictEqual(nA.length, 1);
  const s = ok(w.A('adminBankSource', { nguon: srcKey(nA[0]) }));
  const pos = s.items.map((x) => parseViTri(x.viTri));
  assert(pos.every(Boolean), 'viTri lạ: ' + s.items.map((x) => x.viTri));
  const exp = [];
  for (let c = 1; c <= 18; c++) exp.push([1, c]);
  for (let c = 1; c <= 4; c++) exp.push([2, c]);
  for (let c = 1; c <= 7; c++) exp.push([3, c]);
  assert.deepStrictEqual(pos, exp);
  assert.strictEqual(s.khongDapAn, 2, 'khongDapAn=' + s.khongDapAn);
  info('Nguồn A: ' + s.items.length + ' câu, thieu=' + JSON.stringify(s.thieu) + ', khongDapAn=' + s.khongDapAn);
});
t('TC-2.5 Source: kiểu "Mã 101 – P1 Câu 12", số câu nhảy → thieu nêu câu 4–11, 13 (P1), 2 (P2), 1 (P3)', () => {
  const w = world();
  const m = ok(w.A('adminBankMeta'));
  const nB = m.nguon.find((n) => /Nguồn mẫu B/.test(n.ten));
  // Xáo thứ tự hàng trong kho để chắc máy chủ tự sắp
  const s = ok(w.A('adminBankSource', { nguon: srcKey(nB) }));
  const pos = s.items.map((x) => parseViTri(x.viTri));
  assert.deepStrictEqual(pos, [[1, 1], [1, 2], [1, 3], [1, 12], [1, 14], [1, 15], [2, 1], [2, 3], [3, 2]]);
  assert.strictEqual(s.khongDapAn, 1);
  const th = JSON.stringify(s.thieu);
  info('thieu=' + th);
  assert(Array.isArray(s.thieu) && s.thieu.length > 0, 'không có thieu');
  // Câu 4 có trong kho nhưng chưa có đáp án → tính vào khongDapAn; vẫn thiếu 5–11, 13
  ['5', '11', '13'].forEach((c) => assert(new RegExp('\\b' + c + '\\b').test(th), 'thieu không nêu câu ' + c));
  assert(/P(hần)?\s*(II|2)/.test(th) || s.thieu.some((x) => x.phan === 2), 'thieu không nêu Phần II');
});
t('TC-2.5 Source: thứ tự hàng trong kho bị xáo vẫn sắp đúng', () => {
  const rows = K.standardRows().filter((r) => r[16] === 'Nguồn mẫu B');
  const shuffled = [rows[5], rows[8], rows[0], rows[3], rows[7], rows[1], rows[6], rows[2], rows[4], rows[9]];
  const w = world({ install: { rows: shuffled } });
  const m = ok(w.A('adminBankMeta'));
  const s = ok(w.A('adminBankSource', { nguon: srcKey(m.nguon[0]) }));
  assert.deepStrictEqual(s.items.map((x) => parseViTri(x.viTri)), [[1, 1], [1, 2], [1, 3], [1, 12], [1, 14], [1, 15], [2, 1], [2, 3], [3, 2]]);
});
t('(lệch đặc tả đã ghi) Nguồn có 2 file đề → 2 đề gốc riêng, không trộn "P1 Câu 1" của hai file', () => {
  const w = world();
  const m = ok(w.A('adminBankMeta'));
  const nC = m.nguon.filter((n) => /Nguồn mẫu C/.test(n.ten));
  info('Nguồn C trong Meta: ' + nC.map((n) => n.ten + ' [' + n.soCau + ']').join(' ; '));
  assert.strictEqual(nC.length, 2);
  nC.forEach((n) => {
    const s = ok(w.A('adminBankSource', { nguon: srcKey(n) }));
    assert.deepStrictEqual(s.items.map((x) => parseViTri(x.viTri)), [[1, 1], [1, 2], [1, 3]]);
  });
});

// ---------- TC-2.6 ----------
function lopOf(m, n) { return (m.cay.find((c) => String(c.lop).includes(String(n))) || {}).lop; }
function countParts(items) { const c = { TN: 0, DS: 0, TL: 0 }; items.forEach((x) => { c[x.loai]++; }); return c; }
t('TC-2.6 Ma trận 18–4–6 trên kho đủ (300 câu): đúng 18/4/6, đúng lớp/chương lọc, không trùng', () => {
  const w = world({ install: { rows: K.bigRows(300) } });
  const m = ok(w.A('adminBankMeta'));
  const all = Object.fromEntries(listAll(w).items.map((x) => [x.maKho, x]));
  for (const seed of [1, 7, 42]) {
    const mx = ok(w.A('adminBankMatrix', { lop: lopOf(m, 12), so: { TN: 18, DS: 4, TL: 6 }, seed }));
    assert.strictEqual(new Set(mx.maKho).size, 28, 'số câu ' + mx.maKho.length);
    assert.deepStrictEqual(countParts(mx.maKho.map((k) => all[k])), { TN: 18, DS: 4, TL: 6 });
    assert(['TN', 'DS', 'TL'].every((p) => !mx.thieu || !mx.thieu[p]), 'thieu=' + JSON.stringify(mx.thieu));
  }
  // Lọc chương
  const ch = m.cay.map((c) => c.chuong).find((c) => /Khí lí tưởng/.test(c));
  const mx = ok(w.A('adminBankMatrix', { lop: lopOf(m, 12), chuong: [ch], so: { TN: 18, DS: 4, TL: 6 }, seed: 3 }));
  const pick = mx.maKho.map((k) => all[k]);
  assert(pick.every((x) => x.chuong === ch), 'chọn câu ngoài chương');
  assert.deepStrictEqual(countParts(pick), { TN: 18, DS: 4, TL: 6 });
  // Lọc bài
  const bai = m.cay.find((c) => c.chuong === ch).bai;
  const mb = ok(w.A('adminBankMatrix', { lop: lopOf(m, 12), chuong: [ch], bai: [bai], so: { TN: 5, DS: 2, TL: 2 }, seed: 3 }));
  assert(mb.maKho.every((k) => all[k].bai === bai), 'chọn câu ngoài bài');
});
t('TC-2.6 Ma trận thiếu: thieu nêu đúng phần và số câu, không âm thầm tạo đề thiếu', () => {
  const w = world();
  const m = ok(w.A('adminBankMeta'));
  // Lớp 11 trong kho chuẩn: 1 TN, 1 DS, 1 TL dùng được
  const mx = ok(w.A('adminBankMatrix', { lop: lopOf(m, 11), so: { TN: 18, DS: 4, TL: 6 }, seed: 1 }));
  info('lớp 11: ' + JSON.stringify(mx).slice(0, 300));
  assert.deepStrictEqual({ TN: +mx.thieu.TN || 0, DS: +mx.thieu.DS || 0, TL: +mx.thieu.TL || 0 }, { TN: 17, DS: 3, TL: 5 });
  // Lớp 12 kho chuẩn: TN 30, DS 6, TL 8 → 18–4–6 đủ; 18–4–10 thiếu 2 TL
  const mx2 = ok(w.A('adminBankMatrix', { lop: lopOf(m, 12), so: { TN: 18, DS: 4, TL: 10 }, seed: 1 }));
  assert.deepStrictEqual({ TN: +mx2.thieu.TN || 0, DS: +mx2.thieu.DS || 0, TL: +mx2.thieu.TL || 0 }, { TN: 0, DS: 0, TL: 2 });
  // Lọc chương: đếm khả dụng từ List rồi so
  const ch = m.cay.filter((c) => String(c.lop) === String(lopOf(m, 12)))[0].chuong;
  const avail = countParts(listAll(w, { lop: lopOf(m, 12), chuong: [ch] }).items);
  const mx3 = ok(w.A('adminBankMatrix', { lop: lopOf(m, 12), chuong: [ch], so: { TN: 18, DS: 4, TL: 6 }, seed: 1 }));
  const expThieu = { TN: Math.max(0, 18 - avail.TN), DS: Math.max(0, 4 - avail.DS), TL: Math.max(0, 6 - avail.TL) };
  assert.deepStrictEqual({ TN: +mx3.thieu.TN || 0, DS: +mx3.thieu.DS || 0, TL: +mx3.thieu.TL || 0 }, expThieu);
  info(`chương "${ch}": có ${JSON.stringify(avail)} → thieu ${JSON.stringify(mx3.thieu)}`);
});

// ---------- TC-2.7 ----------
t('TC-2.7 Ưu tiên ít dùng: 30 câu P1, 10 câu đã dùng, chọn 18 → cả 18 từ 20 câu chưa dùng (5 seed)', () => {
  const rows = [];
  for (let i = 1; i <= 30; i++) rows.push(K.row({ phan: 1, cau: i, dapAn: 'ABCD'[i % 4], nguon: 'Nguồn ưu tiên' }));
  const w = world({ install: { rows } });
  const used = rows.slice(5, 15).map(maOf);
  const qs = toQuestions(w, used).questions;
  ok(w.A('adminSaveExam', { exam: { tieuDe: 'Đề đã dùng', lop: '12A1', thoiGian: 15, trangThai: 'NHAP' }, questions: qs }));
  const lst = listAll(w).items;
  const dd = lst.filter((x) => x.daDung > 0).map((x) => x.maKho).sort();
  assert.deepStrictEqual(dd, used.slice().sort(), 'daDung sai: ' + dd.length);
  const seen = new Set();
  for (const seed of [1, 2, 3, 4, 5]) {
    const mx = ok(w.A('adminBankMatrix', { so: { TN: 18, DS: 0, TL: 0 }, seed }));
    assert.strictEqual(mx.maKho.length, 18);
    const hit = mx.maKho.filter((k) => used.includes(k));
    assert.deepStrictEqual(hit, [], 'seed ' + seed + ' chọn câu đã dùng');
    mx.maKho.forEach((k) => seen.add(k));
  }
  info('5 seed dùng tổng ' + seen.size + '/20 câu chưa dùng (ngẫu nhiên trong cùng mức)');
  assert(seen.size > 18, 'không ngẫu nhiên giữa các seed');
  // chọn 25: 20 chưa dùng + 5 đã dùng
  const mx = ok(w.A('adminBankMatrix', { so: { TN: 25, DS: 0, TL: 0 }, seed: 9 }));
  assert.strictEqual(mx.maKho.filter((k) => used.includes(k)).length, 5);
});

// ---------- TC-2.8 ----------
t('TC-2.8 Chia lô hình: 300 câu có hình, makeCopy 1 s giả → nhiều lượt tiepTuc, mỗi lượt ≤ 4,5 phút giả, không chép trùng', () => {
  const w = world({ makeCopyMs: 1000, install: { rows: K.bigRows(300, { hinh: true }), missingImages: 0 } });
  const ma = w.kho.rows.map(maOf);
  const r = toQuestions(w, ma);
  info(`lượt=${r.calls}, ms/lượt=${r.perCallMs.join(',')}, makeCopy=${w.g._stats.makeCopy}`);
  assert(r.calls >= 2, 'không chia lô');
  assert(r.perCallMs.every((x) => x <= 270000), 'có lượt quá 4,5 phút');
  assert.strictEqual(w.g._stats.makeCopy, 300);
  const copies = Object.values(w.g._drive.files).filter((f) => f.copyOf);
  assert.strictEqual(new Set(copies.map((f) => f.copyOf)).size, 300, 'chép trùng');
  assert.strictEqual(r.questions.length, 300);
  assert(r.questions.every((q) => /lh3\.googleusercontent\.com\/d\//.test(q.hinhAnh)));
  // gọi lại toàn bộ: không chép thêm
  toQuestions(w, ma);
  assert.strictEqual(w.g._stats.makeCopy, 300, 'gọi lại vẫn chép');
});
t('TC-2.8 Mốc thời gian: makeCopy 10 s giả → mỗi lượt vẫn ≤ 4,5 phút giả (dừng theo đồng hồ, không chỉ theo 40 hình)', () => {
  const w = world({ makeCopyMs: 10000, install: { rows: K.bigRows(80, { hinh: true }), missingImages: 0 } });
  const r = toQuestions(w, w.kho.rows.map(maOf));
  info(`lượt=${r.calls}, ms/lượt=${r.perCallMs.join(',')}`);
  assert(r.perCallMs.every((x) => x <= 270000), 'có lượt quá 4,5 phút');
  assert.strictEqual(w.g._stats.makeCopy, 80);
  assert.strictEqual(r.questions.length, 80);
});

// ---------- TC-2.9 ----------
t('TC-2.9 Kho chỉ đọc: Meta(refresh)/List/Source/Matrix/ToQuestions/SaveExam → 0 lần ghi file kho, 0 setSharing file gốc', () => {
  const w = world();
  ok(w.A('adminBankMeta', { refresh: true }));
  listAll(w, { q: 'mẫu' });
  const m = ok(w.A('adminBankMeta'));
  m.nguon.forEach((n) => ok(w.A('adminBankSource', { nguon: srcKey(n) })));
  const mx = ok(w.A('adminBankMatrix', { lop: lopOf(m, 12), so: { TN: 18, DS: 4, TL: 6 }, seed: 2 }));
  const qs = toQuestions(w, w.kho.rows.filter((r) => /^Có/.test(r[15])).map(maOf).concat(mx.maKho)).questions;
  ok(w.A('adminSaveExam', { exam: { tieuDe: 'Đề TC-2.9', lop: '12A1', thoiGian: 50, trangThai: 'NHAP' }, questions: qs.filter((q) => q.dapAn) }));
  ok(w.A('adminBankMeta', { refresh: true }));
  assert.strictEqual(w.g._stats.extWrites[w.kho.khoId] || 0, 0, 'ghi vào kho: ' + w.g._stats.extWrites[w.kho.khoId]);
  const sh = Object.values(w.kho.originals).filter((id) => w.g._stats.setSharing[id]);
  assert.deepStrictEqual(sh, []);
  // nội dung kho không đổi
  const now = w.g._external[w.kho.khoId]._sheets[KHO]._data();
  assert.deepStrictEqual(now, [K.HEADER].concat(w.kho.rows));
});

// ---------- TC-2.10 ----------
t('TC-2.10 Học sinh gọi mọi adminBank* → lỗi AUTH; token sai → AUTH', () => {
  const w = world();
  const ma = maOf(w.kho.rows[0]);
  const calls = [['adminBankMeta', {}], ['adminBankList', { filter: {}, page: 1, size: 20 }], ['adminBankSource', { nguon: 'Nguồn mẫu A' }],
    ['adminBankMatrix', { so: { TN: 1, DS: 0, TL: 0 } }], ['adminBankToQuestions', { maKho: [ma] }]];
  calls.forEach(([a, b]) => {
    const r = w.g.call(a, Object.assign({ token: w.sTok }, b));
    assert(!r.ok && /AUTH/.test(r.error), a + ' (HS): ' + JSON.stringify(r).slice(0, 120));
    const r2 = w.g.call(a, b);
    assert(!r2.ok && /AUTH/.test(r2.error), a + ' (không token): ' + JSON.stringify(r2).slice(0, 120));
  });
});
t('TC-2.10 Đề tạo từ kho: startExam/listExams/bootstrap không chứa dapAn, loiGiai, maKho, mucDoY; nộp đúng hết → 10 điểm', () => {
  const w = world();
  const m = ok(w.A('adminBankMeta'));
  const mx = ok(w.A('adminBankMatrix', { lop: lopOf(m, 12), so: { TN: 18, DS: 4, TL: 6 }, seed: 5 }));
  const qs = toQuestions(w, mx.maKho).questions;
  assert.strictEqual(qs.length, 28);
  const saved = ok(w.A('adminSaveExam', { exam: { tieuDe: 'Đề từ kho TC-2.10', lop: '12A1', thoiGian: 50, trangThai: 'MO', hienLoiGiai: 'SAU_HAN' }, questions: qs }));
  // CauHoi có các cột mới, đã ghi giá trị
  const hdr = w.g._sheets.CauHoi._data()[0];
  ['Mã câu kho', 'Chương', 'Bài', 'Mức độ từng ý', 'Nguồn'].forEach((c) => assert(hdr.includes(c), 'CauHoi thiếu cột ' + c));
  const back = ok(w.A('adminGetExam', { examId: saved.id }));
  assert.strictEqual(back.questions.length, 28);
  assert(back.questions.every((q) => q.maKho), 'maKho không lưu');
  assert(back.questions.some((q) => q.mucDoY), 'mucDoY không lưu');
  const forbidden = /"(dapAn|loiGiai|maKho|mucDoY)"/;
  const st = ok(w.g.call('startExam', { token: w.sTok, examId: saved.id }));
  const sj = JSON.stringify(st);
  assert(!forbidden.test(sj), 'startExam lộ: ' + (sj.match(forbidden) || [])[0]);
  const maList = qs.map((q) => q.maKho);
  assert(!maList.some((k) => sj.includes(k)), 'startExam chứa mã câu kho');
  assert(!qs.some((q) => q.loiGiai && sj.includes(q.loiGiai)), 'startExam chứa lời giải');
  assert(!/Mức độ từng ý|a\) Biết; b\) Hiểu/.test(sj), 'startExam chứa mức độ từng ý');
  ['listExams', 'bootstrap'].forEach((a) => {
    const s = JSON.stringify(w.g.call(a, { token: w.sTok }));
    assert(!forbidden.test(s) && !maList.some((k) => s.includes(k)), a + ' lộ dữ liệu kho');
  });
  // trả lời đúng theo đáp án đã lưu
  const ans = {};
  back.questions.forEach((q, i) => {
    const n = q.stt || i + 1;
    if (q.loai === 'TN') ans[n] = q.dapAn;
    else if (q.loai === 'DS') ans[n] = normTF(q.dapAn).split('');
    else ans[n] = String(q.dapAn).split('|')[0];
  });
  const res = ok(w.g.call('submitExam', { token: w.sTok, attemptToken: st.attemptToken, answers: ans }));
  assert.strictEqual(res.diem, 10, 'diem=' + res.diem);
  assert(!res.reveal);
  const rs = JSON.stringify(res);
  assert(!/"(dapAn|loiGiai|maKho|mucDoY)"/.test(rs), 'kết quả trước hạn lộ dữ liệu');
});

// ---------- TC-2.11 ----------
t('TC-2.11 Kho 3 000 câu: 1 Meta + 10 trang List + 1 Matrix → openById = 1; mỗi trang < 150 KB', () => {
  const w = world({ install: { rows: K.bigRows(3000) } });
  w.g._resetStats();
  const m = ok(w.A('adminBankMeta'));
  assert.strictEqual(m.tong, 3000);
  const sizes = [];
  for (let p = 1; p <= 10; p++) {
    const raw = w.A('adminBankList', { filter: {}, page: p, size: 100 });
    const d = ok(raw);
    assert.strictEqual(d.items.length, 100, 'trang ' + p);
    sizes.push(Buffer.byteLength(JSON.stringify(raw), 'utf8'));
  }
  ok(w.A('adminBankMatrix', { so: { TN: 18, DS: 4, TL: 6 }, seed: 1 }));
  info(`openById=${w.g._stats.openById}, KB/trang=${sizes.map((s) => (s / 1024).toFixed(1)).join(',')}, ô kho đã đọc=${w.g._stats.cells[KHO]}`);
  assert.strictEqual(w.g._stats.openById, 1);
  assert(sizes.every((s) => s < 150 * 1024));
  // size > 100 bị giới hạn
  const big = ok(w.A('adminBankList', { filter: {}, page: 1, size: 500 }));
  assert(big.items.length <= 100, 'size 500 trả ' + big.items.length);
});
t('TC-2.11 adminBankToQuestions 28 câu (rải rác) chỉ đọc đúng các hàng cần', () => {
  const w = world({ install: { rows: K.bigRows(3000) } });
  ok(w.A('adminBankMeta')); // dựng chỉ mục trước
  const pick = [];
  for (let i = 0; i < 28; i++) pick.push(maOf(w.kho.rows[(i * 103 + 17) % 3000]));
  w.g._resetStats();
  const r = toQuestions(w, pick);
  assert.strictEqual(r.questions.length, 28);
  const cells = w.g._stats.cells[KHO] || 0;
  const whole = w.g._stats.reads[KHO] || 0;
  info(`ô kho đọc=${cells} (28 hàng × 22 cột = 616), lần getRange=${w.g._stats.ranges[KHO]}, getDataRange=${whole}`);
  assert.strictEqual(whole, 0, 'đọc cả trang kho');
  assert(cells <= 29 * 22, 'đọc thừa: ' + cells + ' ô');
});

// ---------- Dữ liệu cũ / cấu hình ----------
t('Sheet cũ thiếu 5 cột mới của CauHoi: đọc đề cũ được; lưu đề từ kho thì cột tự thêm vào CUỐI, cột cũ giữ nguyên', () => {
  const w = world();
  const ch = w.g._sheets.CauHoi;
  const NEW = ['Mã câu kho', 'Chương', 'Bài', 'Mức độ từng ý', 'Nguồn'];
  const hdr0 = ch._data()[0];
  const keep = hdr0.map((h, i) => (NEW.includes(h) ? -1 : i)).filter((i) => i >= 0);
  ch._setData(ch._data().map((r) => keep.map((i) => r[i])));
  const oldHdr = ch._data()[0].slice();
  clearCache(w.g);
  const ex = ok(w.A('adminGetExam', { examId: 'DEMAU' }));
  assert.strictEqual(ex.questions.length, 6);
  const st = ok(w.g.call('startExam', { token: w.sTok, examId: 'DEMAU' }));
  assert(st.questions.length === 6);
  const qs = toQuestions(w, w.kho.rows.filter((r) => r[16] === 'Nguồn mẫu D').map(maOf)).questions;
  const saved = ok(w.A('adminSaveExam', { exam: { tieuDe: 'Đề Sheet cũ', lop: '11A1', thoiGian: 15, trangThai: 'NHAP' }, questions: qs }));
  const hdr = ch._data()[0];
  assert.deepStrictEqual(hdr.slice(0, oldHdr.length), oldHdr, 'cột cũ bị đổi');
  NEW.forEach((c) => assert(hdr.indexOf(c) >= oldHdr.length, 'cột mới không ở cuối: ' + c));
  const back = ok(w.A('adminGetExam', { examId: saved.id }));
  assert(back.questions.every((q) => q.maKho));
});
t('Kho chưa cấu hình (KHO_CAU_HOI_ID trống) → adminBankMeta báo lỗi dễ hiểu, không sập', () => {
  const w = world({ noBank: true });
  const r = w.A('adminBankMeta');
  assert(!r.ok, 'không báo lỗi');
  info('lỗi: ' + r.error);
  assert(/kho/i.test(r.error));
});
t('Kho đổi tên cột bắt buộc → lỗi nêu tên cột', () => {
  const rows = K.standardRows();
  const w = world({ install: { rows } });
  w.g._external[w.kho.khoId]._sheets[KHO]._data()[0][colIdx('Đáp án')] = 'Đáp án (cũ)';
  clearCache(w.g);
  const r = w.A('adminBankMeta', { refresh: true });
  assert(!r.ok && /Đáp án/.test(r.error), JSON.stringify(r).slice(0, 200));
  info('lỗi: ' + r.error);
});

// ---------- TC-2.14 (máy chủ 1.0.0) ----------
t('TC-2.14 Máy chủ 1.0.0 (fixture): không có features; adminBank* → "Không có chức năng"', () => {
  const w = world({ noBank: true, codePath: path.join(__dirname, 'fixtures', 'Code-1.0.0.gs') });
  assert(!('features' in ok(w.g.call('publicConfig'))));
  ['adminBankMeta', 'adminBankList', 'adminBankSource', 'adminBankMatrix', 'adminBankToQuestions'].forEach((a) => {
    assert(/Không có chức năng/.test(w.A(a).error), a);
  });
});

// ---------- Vòng 2 (thay đổi người dùng thấy được) ----------
t('Vòng 2: câu kho ghi có hình mà không có hình → thieuHinh + cảnh báo nêu mã câu (trước khi lưu)', () => {
  const { w } = imageWorld();
  const missName = w.kho.missingImages[0];
  const row = w.kho.rows.find((r) => r[0] + '.png' === missName);
  const okRow = w.kho.rows.find((r) => /^Có/.test(r[15]) && r[13] && w.kho.originals[r[0] + '.png']);
  let cursor; let last; const all = [];
  for (let i = 0; i < 20; i++) { last = ok(w.A('adminBankToQuestions', { maKho: [okRow[0], row[0]], cursor })); all.push(...(last.canhBao || [])); if (!last.tiepTuc) break; cursor = last.tiepTuc; }
  info('thieuHinh=' + JSON.stringify(last.thieuHinh) + ' canhBao=' + JSON.stringify(all));
  assert(Array.isArray(last.thieuHinh) && last.thieuHinh.includes(row[0]) && !last.thieuHinh.includes(okRow[0]));
  assert(JSON.stringify(all).includes(row[0]));
});
t('Vòng 2: giới hạn 500 câu — Matrix tổng 501 bị từ chối, 460 được, không cắt âm thầm; ToQuestions 501 bị từ chối; Meta có gioiHan', () => {
  const w = world({ install: { rows: K.bigRows(700) } });
  const m = ok(w.A('adminBankMeta'));
  info('gioiHan=' + m.gioiHan);
  assert.strictEqual(+m.gioiHan, 500);
  const r = w.A('adminBankMatrix', { so: { TN: 200, DS: 200, TL: 101 }, seed: 1 });
  assert(!r.ok && /500/.test(r.error), JSON.stringify(r).slice(0, 200));
  info('501: ' + r.error);
  const r2 = ok(w.A('adminBankMatrix', { so: { TN: 200, DS: 140, TL: 140 - 20 }, seed: 1 }));
  assert.strictEqual(r2.maKho.length, 460);
  // Xin 250 câu P1 (kho có 420): phải ra đủ 250, hoặc báo rõ — không âm thầm ra ít hơn
  const r4 = w.A('adminBankMatrix', { so: { TN: 250, DS: 0, TL: 0 }, seed: 1 });
  info('xin TN 250: ' + (r4.ok ? 'ra ' + r4.data.maKho.length + ' câu, thieu=' + JSON.stringify(r4.data.thieu) + ', so=' + JSON.stringify(r4.data.so) : 'lỗi "' + r4.error + '"'));
  assert(!r4.ok || r4.data.maKho.length === 250 || (r4.data.thieu && r4.data.thieu.TN > 0), 'TN 250 bị cắt âm thầm');
  const r3 = w.A('adminBankToQuestions', { maKho: w.kho.rows.slice(0, 501).map(maOf) });
  assert(!r3.ok && /500/.test(r3.error));
});

const fail = results.filter((r) => !r[1]);
console.log(`\n${results.length - fail.length}/${results.length} đạt`);
if (fail.length) fail.forEach((f) => console.log('  ✗ ' + f[0] + ': ' + f[2]));
