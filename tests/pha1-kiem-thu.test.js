// Kiểm thử độc lập Pha 1 (người kiểm thử) — phía máy chủ, viết theo docs/spec/pha-1-tang-toc.md.
// node tests/pha1-kiem-thu.test.js
// Bao phủ: TC-1.0 (cờ features), TC-1.3 (phía máy chủ), TC-1.5, TC-1.6, TC-1.7, TC-1.8, TC-1.12, TC-1.13,
// bảo mật bootstrap/adminBootstrap, TC-1.15b (số lần đọc Sheet trước/sau).
const assert = require('assert');
const path = require('path');
const { createContext } = require('./gas-shim');

const results = [];
function t(name, fn) {
  try { fn(); results.push([name, true]); console.log('  ✓ ' + name); }
  catch (e) { results.push([name, false, e.message]); console.error('  ✗ ' + name + '\n    ' + (e.stack || e).split('\n').slice(0, 4).join('\n    ')); process.exitCode = 1; }
}
function ok(r) { if (!r.ok) throw new Error('API lỗi: ' + r.error); return r.data; }
const pwOf = (g) => g._sheets.CaiDat._data().find((r) => r[0] === 'MAT_KHAU_QUAN_TRI')[1];
const colOf = (g, sheet, label) => { const i = g._sheets[sheet]._data()[0].indexOf(label); assert(i >= 0, 'không có cột ' + label); return i; };
const clearCache = (g) => Object.keys(g._cache).forEach((k) => delete g._cache[k]);
const reads = (g, names) => names.reduce((s, n) => s + (g._stats.reads[n] || 0), 0);
const snapshot = (g, sheet) => JSON.parse(JSON.stringify(g._sheets[sheet]._data()));
const genOf = (g, name) => (g._cache['tbgen_' + name] ? g._cache['tbgen_' + name].v : null);

function world(codePath) {
  const g = createContext({ quiet: true, codePath, sheetReadMs: 0, cacheMs: 0 });
  g.setup();
  const tTok = ok(g.call('loginAdminPassword', { password: pwOf(g) })).token;
  const sTok = ok(g.call('loginPin', { studentId: 'HS0001', pin: '0101' })).token;
  return { g, tTok, sTok };
}
function addStudents(g, tTok, list) {
  return list.map(([hoTen, lop, ngaySinh]) => ok(g.call('adminSaveStudent', { token: tTok, student: { hoTen, lop, ngaySinh } })));
}
function doExam(g, tok, examId, answers) {
  const s = ok(g.call('startExam', { token: tok, examId: examId || 'DEMAU' }));
  return ok(g.call('submitExam', { token: tok, attemptToken: s.attemptToken, answers: answers || { 1: 'C' } }));
}

console.log('Kiểm thử độc lập Pha 1 — máy chủ:');

// ---------- TC-1.0 (phía máy chủ) ----------
t('TC-1.0 máy chủ mới: publicConfig.features có changePin, goal, bootstrap, cache', () => {
  const { g } = world();
  const p = ok(g.call('publicConfig'));
  ['changePin', 'goal', 'bootstrap', 'cache'].forEach((f) => assert(p.features.includes(f), f));
});
t('TC-1.0 máy chủ 1.0.0 (fixture): publicConfig không có features; bootstrap → "Không có chức năng"', () => {
  const { g, sTok } = world(path.join(__dirname, 'fixtures', 'Code-1.0.0.gs'));
  const p = ok(g.call('publicConfig'));
  assert(!('features' in p));
  assert(/Không có chức năng/.test(g.call('bootstrap', { token: sTok }).error));
  assert(/Không có chức năng/.test(g.call('changePin', { token: sTok, oldPin: '0101', newPin: '2468' }).error));
});

// ---------- API bootstrap / adminBootstrap + bảo mật ----------
t('bootstrap: {me,pub,exams,results,v}; exams = listExams, results = myResults; không lộ đáp án/lời giải/PIN/mật khẩu', () => {
  const { g, sTok, tTok } = world();
  doExam(g, sTok, 'DEMAU', { 1: 'C', 2: 'A' });
  // đề đóng + hiện lời giải để myResults/listExams có cơ hội lộ dữ liệu
  const b = ok(g.call('bootstrap', { token: sTok }));
  ['me', 'pub', 'exams', 'results', 'v'].forEach((k) => assert(k in b, 'thiếu ' + k));
  assert.deepStrictEqual(b.exams, ok(g.call('listExams', { token: sTok })));
  assert.deepStrictEqual(b.results, ok(g.call('myResults', { token: sTok })));
  assert(!('stats' in b), 'bootstrap không gồm thống kê');
  const s = JSON.stringify(b);
  assert(!/dapAn|loiGiai|"pin"|pinRieng|MAT_KHAU|Chi tiết/.test(s), 'bootstrap lộ dữ liệu: ' + s.slice(0, 200));
  assert(!s.includes(pwOf(g)), 'lộ mật khẩu quản trị');
  assert(!s.includes('"0101"'), 'lộ PIN');
});
t('adminBootstrap: {me,overview,exams,v}; không có học sinh (PIN), kết quả, mật khẩu; HS gọi → AUTH', () => {
  const { g, sTok, tTok } = world();
  addStudents(g, tTok, [['Phạm Quang Huy', '12A1', '27/09/2008']]);
  const a = ok(g.call('adminBootstrap', { token: tTok }));
  ['me', 'overview', 'exams', 'v'].forEach((k) => assert(k in a, 'thiếu ' + k));
  const s = JSON.stringify(a);
  assert(!/"pin"|MAT_KHAU|"2709"|"0101"/.test(s), 'adminBootstrap lộ PIN/mật khẩu');
  assert(!s.includes(pwOf(g)));
  assert(/AUTH/.test(g.call('adminBootstrap', { token: sTok }).error));
});
t('token sai/hết hạn: bootstrap và adminBootstrap trả lỗi AUTH:', () => {
  const { g, sTok, tTok } = world();
  assert(/^AUTH/.test(g.call('bootstrap', { token: sTok.slice(0, -2) + 'zz' }).error));
  assert(/^AUTH/.test(g.call('adminBootstrap', { token: tTok.slice(0, -2) + 'zz' }).error));
  assert(/^AUTH/.test(g.call('bootstrap', {}).error));
});
t('publicConfig / adminGetSettings / bootstrap không trả MAT_KHAU_QUAN_TRI (CaiDat được đệm phía máy chủ)', () => {
  const { g, sTok, tTok } = world();
  const pw = pwOf(g);
  for (let i = 0; i < 2; i++) { // lần 2 đi qua đệm
    assert(!JSON.stringify(g.call('publicConfig')).includes(pw));
    assert(!JSON.stringify(g.call('bootstrap', { token: sTok })).includes(pw));
    assert(!JSON.stringify(g.call('adminBootstrap', { token: tTok })).includes(pw));
    assert(!JSON.stringify(g.call('adminGetSettings', { token: tTok })).includes(pw));
  }
});

// ---------- TC-1.3 (phía máy chủ) ----------
t('TC-1.3 (máy chủ): một request bootstrap đọc mỗi trang tính tối đa 1 lần (đệm trống)', () => {
  const { g, sTok, tTok } = world();
  clearCache(g); g._resetStats();
  ok(g.call('bootstrap', { token: sTok }));
  Object.entries(g._stats.reads).forEach(([n, c]) => assert(c <= 1, n + ' đọc ' + c + ' lần'));
  clearCache(g); g._resetStats();
  ok(g.call('adminBootstrap', { token: tTok }));
  Object.entries(g._stats.reads).forEach(([n, c]) => assert(c <= 1, 'adminBootstrap: ' + n + ' đọc ' + c + ' lần'));
});

// ---------- TC-1.5 ----------
t('TC-1.5: hai request listExams riêng (< 60 s) → lần 2 không đọc DeThi/CauHoi/KetQua (getDataRange = 0)', () => {
  const { g, sTok } = world();
  doExam(g, sTok);
  clearCache(g);
  ok(g.call('listExams', { token: sTok }));
  g._resetStats();
  const a = ok(g.call('listExams', { token: sTok }));
  assert.strictEqual(reads(g, ['DeThi', 'CauHoi', 'KetQua']), 0, JSON.stringify(g._stats.reads));
  assert.strictEqual(a.length, 1);
});
t('TC-1.5 (bổ sung): sau 61 s đệm hết hạn → đọc lại Sheet (thời hạn 60 s)', () => {
  const { g, sTok } = world();
  ok(g.call('listExams', { token: sTok }));
  const realNow = Date.now;
  try {
    Date.now = () => realNow() + 61000; // shim so hạn đệm bằng Date.now() của Node
    g._resetStats();
    ok(g.call('listExams', { token: sTok }));
    assert(reads(g, ['DeThi']) >= 1, 'đệm còn sống sau 61 s: ' + JSON.stringify(g._stats.reads));
  } finally { Date.now = realNow; }
});

// ---------- TC-1.6 ----------
t('TC-1.6 submitExam → myResults / listExams / adminResults / leaderboard thấy bài mới ngay', () => {
  const { g, sTok, tTok } = world();
  ok(g.call('myResults', { token: sTok })); ok(g.call('adminResults', { token: tTok })); ok(g.call('listExams', { token: sTok }));
  ok(g.call('myStats', { token: sTok }));
  const r = doExam(g, sTok, 'DEMAU', { 1: 'C' });
  assert(ok(g.call('myResults', { token: sTok })).some((x) => x.id === r.id));
  assert(ok(g.call('adminResults', { token: tTok })).some((x) => x.id === r.id));
  const st = ok(g.call('myStats', { token: sTok }));
  assert(JSON.stringify(st).includes(String(r.diem).replace('.', '.')), 'myStats chưa có bài mới');
});
t('TC-1.6 adminSaveExam (sửa tên đề + tạo đề mới) → listExams / adminListExams thấy ngay', () => {
  const { g, sTok, tTok } = world();
  ok(g.call('listExams', { token: sTok })); ok(g.call('adminListExams', { token: tTok })); ok(g.call('adminBootstrap', { token: tTok }));
  const ex = ok(g.call('adminGetExam', { token: tTok, examId: 'DEMAU' }));
  ok(g.call('adminSaveExam', { token: tTok, exam: Object.assign({}, ex.exam, { tieuDe: 'Tên đề đã sửa' }), questions: ex.questions }));
  assert.strictEqual(ok(g.call('listExams', { token: sTok }))[0].tieuDe, 'Tên đề đã sửa');
  const nw = ok(g.call('adminSaveExam', { token: tTok, exam: Object.assign({}, ex.exam, { id: '', tieuDe: 'Đề thứ hai' }), questions: ex.questions }));
  assert(ok(g.call('listExams', { token: sTok })).some((e) => e.id === nw.id));
  assert(ok(g.call('adminListExams', { token: tTok })).some((e) => e.id === nw.id));
  assert(ok(g.call('adminBootstrap', { token: tTok })).exams.some((e) => e.id === nw.id));
  assert.strictEqual(ok(g.call('adminGetExam', { token: tTok, examId: nw.id })).questions.length, ex.questions.length);
});
t('TC-1.6 adminSaveStudent (thêm + sửa) → adminListStudents / listStudentsInClass / loginPin thấy ngay', () => {
  const { g, tTok } = world();
  ok(g.call('adminListStudents', { token: tTok })); ok(g.call('listStudentsInClass', { lop: '12A1' }));
  const [st] = addStudents(g, tTok, [['Đỗ Minh Khang', '12A1', '14/02/2008']]);
  assert(ok(g.call('listStudentsInClass', { lop: '12A1' })).some((s) => s.id === st.id));
  ok(g.call('loginPin', { studentId: st.id, pin: '1402' }));
  ok(g.call('adminSaveStudent', { token: tTok, student: Object.assign({}, st, { hoTen: 'Đỗ Minh Khang Sửa' }) }));
  assert.strictEqual(ok(g.call('adminListStudents', { token: tTok })).find((s) => s.id === st.id).hoTen, 'Đỗ Minh Khang Sửa');
});
t('TC-1.6 adminDeleteResult → myResults / adminResults không còn bài', () => {
  const { g, sTok, tTok } = world();
  const r = doExam(g, sTok);
  ok(g.call('myResults', { token: sTok })); ok(g.call('adminResults', { token: tTok }));
  ok(g.call('adminDeleteResult', { token: tTok, resultId: r.id }));
  assert(!ok(g.call('myResults', { token: sTok })).some((x) => x.id === r.id));
  assert(!ok(g.call('adminResults', { token: tTok })).some((x) => x.id === r.id));
  assert(!ok(g.call('bootstrap', { token: sTok })).results.some((x) => x.id === r.id));
});
t('TC-1.6 adminSaveSettings → publicConfig / bootstrap.pub / adminGetSettings thấy ngay', () => {
  const { g, sTok, tTok } = world();
  ok(g.call('publicConfig')); ok(g.call('bootstrap', { token: sTok })); ok(g.call('adminGetSettings', { token: tTok }));
  ok(g.call('adminSaveSettings', { token: tTok, settings: { TEN_UNG_DUNG: 'Tên mới kiểm thử', HIEN_BANG_XEP_HANG: 'KHONG' } }));
  const p = ok(g.call('publicConfig'));
  assert.strictEqual(p.appName, 'Tên mới kiểm thử');
  assert.strictEqual(p.showLeaderboard, false);
  assert.strictEqual(ok(g.call('bootstrap', { token: sTok })).pub.appName, 'Tên mới kiểm thử');
  assert.strictEqual(ok(g.call('adminGetSettings', { token: tTok })).find((x) => x.khoa === 'TEN_UNG_DUNG').giaTri, 'Tên mới kiểm thử');
});
t('TC-1.6 changePin → PIN mới đăng nhập được ngay, PIN cũ bị từ chối, adminListStudents thấy PIN mới', () => {
  const { g, sTok, tTok } = world();
  ok(g.call('adminListStudents', { token: tTok })); ok(g.call('listStudentsInClass', { lop: '12A1' }));
  ok(g.call('changePin', { token: sTok, oldPin: '0101', newPin: '3692' }));
  assert(!g.call('loginPin', { studentId: 'HS0001', pin: '0101' }).ok);
  ok(g.call('loginPin', { studentId: 'HS0001', pin: '3692' }));
  assert.strictEqual(ok(g.call('adminListStudents', { token: tTok })).find((s) => s.id === 'HS0001').pin, '3692');
});
t('TC-1.6 (bổ sung) adminDeleteStudent / adminImportStudents / adminDeleteExam → đọc kế tiếp thấy ngay', () => {
  const { g, sTok, tTok } = world();
  const [a] = addStudents(g, tTok, [['Vũ Thu Trang', '12A1', '03/04/2008']]);
  ok(g.call('adminListStudents', { token: tTok }));
  ok(g.call('adminDeleteStudent', { token: tTok, id: a.id }));
  assert(!ok(g.call('adminListStudents', { token: tTok })).some((s) => s.id === a.id));
  ok(g.call('adminImportStudents', { token: tTok, rows: [{ hoTen: 'Lý Gia Bảo', lop: '12A1', ngaySinh: '06/07/2008' }] }));
  assert(ok(g.call('listStudentsInClass', { lop: '12A1' })).some((s) => s.hoTen === 'Lý Gia Bảo'));
  const ex = ok(g.call('adminGetExam', { token: tTok, examId: 'DEMAU' }));
  const nw = ok(g.call('adminSaveExam', { token: tTok, exam: Object.assign({}, ex.exam, { id: '', tieuDe: 'Đề xóa' }), questions: ex.questions }));
  ok(g.call('listExams', { token: sTok }));
  ok(g.call('adminDeleteExam', { token: tTok, examId: nw.id }));
  assert(!ok(g.call('listExams', { token: sTok })).some((e) => e.id === nw.id));
});

// ---------- TC-1.7 ----------
function fillKetQua(g, sTok, n, padChar, rowChars) {
  // n hàng giả, mỗi hàng ~rowChars ký tự khi tuần tự hóa JSON
  doExam(g, sTok);
  const data = g._sheets.KetQua._data();
  const base = data[1].slice();
  const iId = colOf(g, 'KetQua', 'Mã bài'), iNote = colOf(g, 'KetQua', 'Ghi chú');
  base[colOf(g, 'KetQua', 'Nhận xét')] = ''; base[colOf(g, 'KetQua', 'Chi tiết (JSON)')] = '[]';
  base[iNote] = '';
  const rest = JSON.stringify(base).length;
  const padLen = Math.max(0, rowChars - rest - 8);
  for (let i = 0; i < n; i++) {
    const row = base.slice();
    row[iId] = 'KQTEST' + String(i).padStart(5, '0');
    row[iNote] = (padChar.repeat(Math.ceil(padLen / padChar.length))).slice(0, padLen) + '#' + i;
    data.push(row);
  }
}
function tableBytes(g, name) { return JSON.stringify(g._sheets[name]._data()).length; }
function chunkKeys(g, name) {
  const gen = genOf(g, name);
  return Object.keys(g._cache).filter((k) => k.startsWith('tb_' + name + '_' + gen + '_'));
}

t('TC-1.7 shim: từ chối giá trị > 100 KB/khóa (put và putAll)', () => {
  const { g } = world();
  const c = g.CacheService.getScriptCache();
  assert.throws(() => c.put('x', 'a'.repeat(100 * 1024 + 1), 60));
  assert.throws(() => c.putAll({ y: 'a'.repeat(100 * 1024 + 1) }, 60));
  assert.throws(() => c.put('z', 'ệ'.repeat(40000), 60), 'chữ có dấu 3 byte: 120 KB'); // 40 000 ký tự nhưng 120 000 byte
  c.put('w', 'a'.repeat(100 * 1024), 60);
});
t('TC-1.7 KetQua giả 600 hàng (~1,2 KB/hàng, ASCII): chia mảnh ≤ 90 000 ký tự, đọc từ đệm giống hệt đọc Sheet', () => {
  const { g, sTok, tTok } = world();
  fillKetQua(g, sTok, 600, 'abcdefghij', 1229);
  const kb = tableBytes(g, 'KetQua') / 1024;
  clearCache(g);
  g.__MEMO();
  const fromSheet = g.readTable_('KetQua', { fresh: true });
  g.__MEMO(); g._resetStats();
  const first = g.readTable_('KetQua');
  const keys = chunkKeys(g, 'KetQua');
  assert(keys.length >= 2, 'không chia mảnh: ' + keys.length + ' mảnh, bảng ' + kb.toFixed(0) + ' KB');
  keys.forEach((k) => assert(g._cache[k].v.length <= 90000, k + ' dài ' + g._cache[k].v.length));
  g.__MEMO(); g._resetStats();
  const second = g.readTable_('KetQua');
  assert.strictEqual(g._stats.reads.KetQua || 0, 0, 'lần 2 vẫn đọc Sheet');
  assert.deepStrictEqual(second, fromSheet);
  assert.deepStrictEqual(first, fromSheet);
  g.__MEMO();
  assert.strictEqual(ok(g.call('adminResults', { token: tTok })).length, 601);
  console.log('    (bảng ' + kb.toFixed(0) + ' KB, ' + keys.length + ' mảnh)');
});
t('TC-1.7 KetQua 600 hàng ~1,2 KB UTF-8/hàng có chữ tiếng Việt (mảnh ≤ 100 KB byte): đọc đúng, không lỗi, VẪN được đệm (lần 2 không đọc Sheet)', () => {
  const { g, sTok, tTok } = world();
  fillKetQua(g, sTok, 600, 'Nguyễn Thị Ánh Tuyết ôn tập điện xoay chiều ', 1000); // ~1,2 KB UTF-8 mỗi hàng
  clearCache(g); g.__MEMO();
  const fromSheet = g.readTable_('KetQua', { fresh: true });
  g.__MEMO();
  const r1 = g.call('adminResults', { token: tTok });
  assert(r1.ok, 'lỗi khi cất đệm: ' + r1.error);
  assert.strictEqual(r1.data.length, 601);
  g.__MEMO(); g._resetStats();
  const second = g.readTable_('KetQua');
  assert.deepStrictEqual(second, fromSheet);
  const kb = Buffer.byteLength(JSON.stringify(g._sheets.KetQua._data()), 'utf8') / 1024;
  const chars = JSON.stringify(g._sheets.KetQua._data()).length / 1024;
  assert.strictEqual(g._stats.reads.KetQua || 0, 0,
    'bảng ' + chars.toFixed(0) + ' K ký tự / ' + kb.toFixed(0) + ' KB UTF-8 không được đệm (mảnh 90 000 ký tự có dấu vượt 100 KB?)');
});
t('TC-1.7 bảng > 900 KB: không đệm (không có mảnh), nhưng kết quả vẫn đúng và không lỗi', () => {
  const { g, sTok, tTok } = world();
  fillKetQua(g, sTok, 800, 'abcdefghij', 1229);
  clearCache(g); g.__MEMO();
  const fromSheet = g.readTable_('KetQua', { fresh: true });
  g.__MEMO();
  const r = g.call('adminResults', { token: tTok });
  assert(r.ok, r.error);
  assert.strictEqual(r.data.length, 801);
  assert.strictEqual(chunkKeys(g, 'KetQua').length, 0, 'bảng > 900 KB vẫn được đệm');
  g.__MEMO(); g._resetStats();
  assert.deepStrictEqual(g.readTable_('KetQua'), fromSheet);
  assert(g._stats.reads.KetQua >= 1);
  // đường ghi vẫn chạy
  const one = doExam(g, sTok);
  assert(ok(g.call('myResults', { token: sTok })).some((x) => x.id === one.id));
});

// ---------- TC-1.8 ----------
t('TC-1.8 xóa tay một mảnh → coi là trượt đệm, đọc lại Sheet, kết quả đúng', () => {
  const { g, sTok, tTok } = world();
  fillKetQua(g, sTok, 600, 'abcdefghij', 1229);
  clearCache(g);
  const want = ok(g.call('adminResults', { token: tTok }));
  const keys = chunkKeys(g, 'KetQua');
  assert(keys.length >= 2);
  delete g._cache[keys[keys.length - 1]];
  g._resetStats();
  assert.deepStrictEqual(ok(g.call('adminResults', { token: tTok })), want);
  assert(g._stats.reads.KetQua >= 1, 'không đọc lại Sheet khi thiếu mảnh');
});
t('TC-1.8 xóa khóa tbgen_* (nhiều lần) → đọc lại Sheet, đúng; thế hệ mới khác mọi thế hệ cũ; mảnh cũ không được dùng', () => {
  const { g, sTok, tTok } = world();
  doExam(g, sTok);
  ok(g.call('adminResults', { token: tTok }));
  const seen = new Set([genOf(g, 'KetQua')]);
  const iNote = colOf(g, 'KetQua', 'Ghi chú');
  for (let i = 0; i < 6; i++) {
    // sửa thẳng Sheet (không onEdit) rồi xóa khóa gen: phải thấy dữ liệu mới chứ không phải mảnh cũ
    g._sheets.KetQua._data()[1][iNote] = 'sửa tay ' + i;
    delete g._cache.tbgen_KetQua;
    g._resetStats();
    const r = ok(g.call('adminResults', { token: tTok }));
    assert.strictEqual(r[0].ghiChu, 'sửa tay ' + i, 'dùng lại mảnh của thế hệ cũ');
    assert(g._stats.reads.KetQua >= 1);
    const gen = genOf(g, 'KetQua');
    assert(gen, 'không tạo lại tbgen');
    assert(!seen.has(gen), 'thế hệ trùng: ' + gen);
    seen.add(gen);
  }
  // xóa gen của mọi bảng cùng lúc (CacheService bị xóa sớm)
  ['HocSinh', 'DeThi', 'CauHoi', 'CaiDat'].forEach((n) => delete g._cache['tbgen_' + n]);
  assert.strictEqual(ok(g.call('listExams', { token: sTok })).length, 1);
});

// ---------- TC-1.12 ----------
function studentWorld() {
  const w = world();
  const sts = addStudents(w.g, w.tTok, [
    ['Hồ Ngọc Anh', '12A1', '11/02/2008'], ['Mai Đức Bình', '12A1', '13/04/2008'],
    ['Tạ Thu Cúc', '12A1', '15/06/2008'], ['La Văn Dũng', '12A1', '17/08/2008']
  ]);
  return Object.assign(w, { sts });
}
t('TC-1.12a xóa tay 1 hàng HocSinh (đệm còn sống) rồi HS khác changePin → ghi đúng hàng, không hàng nào khác đổi', () => {
  const { g, tTok, sts } = studentWorld();
  // HS0004 (Tạ Thu Cúc) đăng nhập trước khi xóa
  const cuc = sts[2];
  const tok = ok(g.call('loginPin', { studentId: cuc.id, pin: '1506' })).token;
  ok(g.call('adminListStudents', { token: tTok })); ok(g.call('listStudentsInClass', { lop: '12A1' })); ok(g.call('me', { token: tok }));
  const data = g._sheets.HocSinh._data();
  const iId = colOf(g, 'HocSinh', 'Mã HS'), iPin = colOf(g, 'HocSinh', 'PIN riêng');
  const rBinh = data.findIndex((r) => r[iId] === sts[1].id);
  g._sheets.HocSinh.deleteRow(rBinh + 1); // xóa tay "Mai Đức Bình", không gọi onEdit
  const before = snapshot(g, 'HocSinh');
  g._resetStats();
  ok(g.call('changePin', { token: tok, oldPin: '1506', newPin: '4826' }));
  const after = snapshot(g, 'HocSinh');
  assert.strictEqual(after.length, before.length);
  after.forEach((row, i) => {
    if (row[iId] === cuc.id) {
      assert.strictEqual(String(row[iPin]), '4826', 'PIN không ghi vào hàng của ' + cuc.id);
      row.forEach((v, j) => { if (j !== iPin) assert.deepStrictEqual(v, before[i][j], 'cột ' + j + ' của hàng ' + cuc.id + ' bị đổi'); });
    } else assert.deepStrictEqual(row, before[i], 'hàng ' + (i + 1) + ' (' + row[iId] + ') bị đổi');
  });
  ok(g.call('loginPin', { studentId: cuc.id, pin: '4826' }));
  ok(g.call('loginPin', { studentId: sts[3].id, pin: '1708' }));
});
t('TC-1.12a (bổ sung) xóa tay 1 hàng rồi adminSaveStudent sửa HS khác / adminDeleteStudent → đúng hàng', () => {
  const { g, tTok, sts } = studentWorld();
  ok(g.call('adminListStudents', { token: tTok }));
  const iId = colOf(g, 'HocSinh', 'Mã HS'), iTen = colOf(g, 'HocSinh', 'Họ tên');
  const data = g._sheets.HocSinh._data();
  g._sheets.HocSinh.deleteRow(data.findIndex((r) => r[iId] === sts[0].id) + 1);
  ok(g.call('adminSaveStudent', { token: tTok, student: Object.assign({}, sts[2], { hoTen: 'Tạ Thu Cúc (sửa)' }) }));
  const now = g._sheets.HocSinh._data();
  assert.strictEqual(now.find((r) => r[iId] === sts[2].id)[iTen], 'Tạ Thu Cúc (sửa)');
  assert.strictEqual(now.find((r) => r[iId] === sts[3].id)[iTen], 'La Văn Dũng');
  assert.strictEqual(now.find((r) => r[iId] === sts[1].id)[iTen], 'Mai Đức Bình');
  ok(g.call('adminListStudents', { token: tTok }));
  g._sheets.HocSinh.deleteRow(now.findIndex((r) => r[iId] === sts[1].id) + 1); // xóa tay thêm 1 hàng
  ok(g.call('adminDeleteStudent', { token: tTok, id: sts[3].id }));
  const ids = g._sheets.HocSinh._data().slice(1).map((r) => r[iId]).filter(Boolean);
  assert.deepStrictEqual(ids, ['HS0001', sts[2].id], 'xóa nhầm hàng: ' + ids);
});
t('TC-1.12b chèn 1 hàng lên đầu KetQua rồi adminDeleteResult → xóa đúng bài, hàng chèn và bài khác còn nguyên', () => {
  const { g, sTok, tTok } = world();
  const r1 = doExam(g, sTok, 'DEMAU', { 1: 'C' });
  const r2 = doExam(g, sTok, 'DEMAU', { 1: 'A' });
  ok(g.call('adminResults', { token: tTok })); ok(g.call('myResults', { token: sTok }));
  const data = g._sheets.KetQua._data();
  const iId = colOf(g, 'KetQua', 'Mã bài');
  const ins = data[1].slice(); ins[iId] = 'KQCHENTAY';
  data.splice(1, 0, ins);
  ok(g.call('adminDeleteResult', { token: tTok, resultId: r1.id }));
  const ids = g._sheets.KetQua._data().slice(1).map((r) => r[iId]);
  assert(!ids.includes(r1.id), 'chưa xóa ' + r1.id);
  assert(ids.includes('KQCHENTAY') && ids.includes(r2.id), 'xóa nhầm: còn ' + ids);
  assert.strictEqual(ids.length, 2);
});
t('TC-1.12c xóa tay HS rồi thêm học sinh (adminSaveStudent, adminImportStudents) → không sinh Mã HS trùng', () => {
  const { g, tTok, sts } = studentWorld();
  ok(g.call('adminListStudents', { token: tTok }));
  const iId = colOf(g, 'HocSinh', 'Mã HS');
  g._sheets.HocSinh.deleteRow(g._sheets.HocSinh._data().findIndex((r) => r[iId] === sts[1].id) + 1);
  // thêm tay 1 hàng cuối (không onEdit) — đệm cũ không biết hàng này
  const extra = g._sheets.HocSinh._data()[1].slice(); extra[iId] = 'HS0006'; extra[1] = 'Thêm Tay';
  g._sheets.HocSinh._data().push(extra);
  const a = ok(g.call('adminSaveStudent', { token: tTok, student: { hoTen: 'Mới Một', lop: '12A1', ngaySinh: '01/05/2008' } }));
  ok(g.call('adminListStudents', { token: tTok }));
  g._sheets.HocSinh._data().push(Object.assign(extra.slice(), { [iId]: 'HS0009', 1: 'Thêm Tay 2' }));
  ok(g.call('adminImportStudents', { token: tTok, rows: [{ hoTen: 'Mới Hai', lop: '12A1', ngaySinh: '02/05/2008' }, { hoTen: 'Mới Ba', lop: '12A1', ngaySinh: '03/05/2008' }] }));
  const ids = g._sheets.HocSinh._data().slice(1).map((r) => r[iId]).filter(Boolean);
  assert.strictEqual(new Set(ids).size, ids.length, 'Mã HS trùng: ' + ids.join(','));
  assert.notStrictEqual(a.id, 'HS0006');
});

// ---------- TC-1.13 ----------
t('TC-1.13 tranh chấp: A đọc Sheet, B ghi + đổi gen, A mới cất đệm → lần đọc sau thấy dữ liệu của B', () => {
  const { g, sTok, tTok } = world();
  doExam(g, sTok);
  clearCache(g);
  const sh = g._sheets.KetQua;
  const iNote = colOf(g, 'KetQua', 'Ghi chú');
  const orig = sh.getDataRange;
  let fired = false;
  sh.getDataRange = function () {
    const range = orig.apply(this, arguments);
    const gv = range.getValues;
    range.getValues = () => {
      const vals = gv(); // A đã đọc xong dữ liệu cũ
      if (!fired) {
        fired = true;
        // B: ghi vào Sheet, flush, đặt gen mới (đúng như đường ghi của đặc tả)
        sh._data()[1][iNote] = 'DỮ LIỆU CỦA B';
        g._cache.tbgen_KetQua = { v: 'genB' + Date.now(), exp: Date.now() + 60000 };
      }
      return vals;
    };
    return range;
  };
  const a = ok(g.call('adminResults', { token: tTok }));
  assert.notStrictEqual(a[0].ghiChu, 'DỮ LIỆU CỦA B'); // A trả dữ liệu cũ (chấp nhận)
  sh.getDataRange = orig;
  const next = ok(g.call('adminResults', { token: tTok }));
  assert.strictEqual(next[0].ghiChu, 'DỮ LIỆU CỦA B', 'đệm chứa dữ liệu cũ dưới thế hệ mới');
  assert.strictEqual(ok(g.call('myResults', { token: sTok }))[0].ghiChu, 'DỮ LIỆU CỦA B');
});
t('TC-1.13 (API thật) B = adminDeleteResult chạy chen giữa lúc A đọc KetQua → lần sau không còn bài đã xóa', () => {
  const { g, sTok, tTok } = world();
  const r1 = doExam(g, sTok, 'DEMAU', { 1: 'C' });
  doExam(g, sTok, 'DEMAU', { 1: 'A' });
  clearCache(g);
  const sh = g._sheets.KetQua;
  const orig = sh.getDataRange;
  let fired = false;
  sh.getDataRange = function () {
    const range = orig.apply(this, arguments);
    const gv = range.getValues;
    range.getValues = () => {
      const vals = gv();
      if (!fired) { fired = true; sh.getDataRange = orig; const ret = g.call('adminDeleteResult', { token: tTok, resultId: r1.id }); assert(ret.ok, ret.error); }
      return vals;
    };
    return range;
  };
  g.__MEMO();
  g.doPost({ postData: { contents: JSON.stringify({ action: 'myResults', token: sTok }) } });
  sh.getDataRange = orig;
  assert(fired);
  assert(!ok(g.call('myResults', { token: sTok })).some((x) => x.id === r1.id), 'đọc lại thấy bài đã bị xóa (đệm cũ)');
  assert(!ok(g.call('adminResults', { token: tTok })).some((x) => x.id === r1.id));
});

// ---------- TC-1.15b ----------
t('TC-1.15b số lần đọc Sheet: luồng học sinh + giáo viên, máy chủ 1.0.0 vs mới (in số đo)', () => {
  const plan = [
    ['HS mở trang chủ', { old: ['publicConfig', 'listExams', 'myResults'], neu: ['publicConfig', 'bootstrap'] }],
    ['HS Lịch sử', { old: ['myResults'], neu: ['myResults'] }],
    ['HS Thống kê', { old: ['myStats'], neu: ['myStats'] }],
    ['HS Xếp hạng', { old: ['leaderboard'], neu: ['leaderboard'] }],
    ['HS về Trang chủ', { old: ['listExams', 'myResults'], neu: ['bootstrap'] }],
    ['GV Tổng quan', { old: ['adminOverview'], neu: ['adminBootstrap'] }],
    ['GV Đề thi', { old: ['adminListExams'], neu: ['adminListExams'] }],
    ['GV Kết quả', { old: ['adminListExams', 'adminListStudents', 'adminResults'], neu: ['adminListExams', 'adminListStudents', 'adminResults'] }]
  ];
  const out = {};
  for (const [label, codePath] of [['old', path.join(__dirname, 'fixtures', 'Code-1.0.0.gs')], ['neu', undefined]]) {
    const { g, sTok, tTok } = world(codePath);
    doExam(g, sTok);
    clearCache(g);
    let total = 0;
    out[label] = {};
    for (let round = 1; round <= 2; round++) {
      for (const [step, p] of plan) {
        g._resetStats();
        p[label].forEach((a) => { const r = g.call(a, { token: a.startsWith('admin') ? tTok : sTok }); assert(r.ok, a + ': ' + r.error); });
        const n = Object.values(g._stats.reads).reduce((s, x) => s + x, 0);
        out[label][round + ' ' + step] = n; total += n;
      }
    }
    out[label].TONG = total;
  }
  console.log('    Số lần đọc trang tính (vòng 1 đệm trống, vòng 2 đệm nóng):');
  Object.keys(out.old).forEach((k) => console.log('      ' + k.padEnd(22) + ' cũ ' + String(out.old[k]).padStart(3) + '  →  mới ' + String(out.neu[k]).padStart(3)));
  global.__MEASURE = out;
  assert(out.neu.TONG < out.old.TONG);
});

const pass = results.filter((r) => r[1]).length;
console.log(`\n${pass}/${results.length} kiểm thử đạt`);
if (process.env.JSON_OUT) require('fs').writeFileSync(process.env.JSON_OUT, JSON.stringify({ results, measure: global.__MEASURE }, null, 1));
