// Kiểm thử đơn vị Pha 1 (người làm): đệm máy chủ, ghi an toàn, action gộp, cờ tính năng.
// node tests/cache.test.js
const assert = require('assert');
const path = require('path');
const { createContext } = require('./gas-shim');

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { console.error('  ✗ ' + name + '\n    ' + (e.stack || e)); process.exitCode = 1; }
}
function ok(r) { if (!r.ok) throw new Error('API lỗi: ' + r.error); return r.data; }
const pwOf = (g) => g._sheets.CaiDat._data().find((r) => r[0] === 'MAT_KHAU_QUAN_TRI')[1];
const col = (g, sheet, label) => g._sheets[sheet]._data()[0].indexOf(label);

function fresh() {
  const g = createContext({ quiet: true });
  g.setup();
  const tTok = ok(g.call('loginAdminPassword', { password: pwOf(g) })).token;
  const sTok = ok(g.call('loginPin', { studentId: 'HS0001', pin: '0101' })).token;
  return { g, tTok, sTok };
}

console.log('Pha 1 — đệm máy chủ và ghi an toàn:');

t('publicConfig có features; bootstrap/adminBootstrap trả đủ, không lộ đáp án', () => {
  const { g, tTok, sTok } = fresh();
  const p = ok(g.call('publicConfig'));
  assert.deepStrictEqual(p.features, ['changePin', 'goal', 'bootstrap', 'cache']);
  assert.strictEqual(p.version, '1.2.0');
  const b = ok(g.call('bootstrap', { token: sTok }));
  assert.strictEqual(b.me.id, 'HS0001');
  assert.strictEqual(b.pub.appName, p.appName);
  assert.strictEqual(b.exams.length, 1);
  assert.deepStrictEqual(b.results, []);
  assert.strictEqual(b.v, '1.2.0');
  assert(!/dapAn|loiGiai|"pin"|MAT_KHAU/.test(JSON.stringify(b)), 'bootstrap lộ dữ liệu');
  const a = ok(g.call('adminBootstrap', { token: tTok }));
  assert(a.overview.counts && a.exams.length === 1 && a.me.role === 'teacher');
  assert(!/"pin"|MAT_KHAU/.test(JSON.stringify(a)));
  // phân quyền
  assert(/AUTH/.test(g.call('bootstrap', { token: 'x.y' }).error));
  assert(!g.call('bootstrap', { token: tTok }).ok);
  assert(/AUTH/.test(g.call('adminBootstrap', { token: sTok }).error));
});

t('mỗi trang tính đọc tối đa 1 lần trong 1 request bootstrap (TC-1.3 phía máy chủ)', () => {
  const { g, sTok } = fresh();
  Object.keys(g._cache).forEach((k) => delete g._cache[k]); // đệm trống
  g._resetStats();
  ok(g.call('bootstrap', { token: sTok }));
  Object.values(g._stats.reads).forEach((n) => assert.strictEqual(n, 1));
  assert.deepStrictEqual(Object.keys(g._stats.reads).sort(), ['CaiDat', 'CauHoi', 'DeThi', 'HocSinh', 'KetQua']);
});

t('TC-1.5: hai lần listExams liên tiếp → lần 2 không đọc Sheet', () => {
  const { g, sTok } = fresh();
  ok(g.call('listExams', { token: sTok }));
  g._resetStats();
  ok(g.call('listExams', { token: sTok }));
  assert.deepStrictEqual(g._stats.reads, {});
});

t('TC-1.6: sau mỗi thao tác ghi, lần đọc kế tiếp thấy dữ liệu mới', () => {
  const { g, tTok, sTok } = fresh();
  // làm nóng đệm
  ok(g.call('listExams', { token: sTok })); ok(g.call('adminListStudents', { token: tTok }));
  ok(g.call('adminGetSettings', { token: tTok }));
  // submitExam
  const s = ok(g.call('startExam', { token: sTok, examId: 'DEMAU' }));
  ok(g.call('submitExam', { token: sTok, attemptToken: s.attemptToken, answers: { 1: 'C' } }));
  assert.strictEqual(ok(g.call('myResults', { token: sTok })).length, 1);
  assert.strictEqual(ok(g.call('listExams', { token: sTok }))[0].daLam, 1);
  // adminSaveExam
  const ex = ok(g.call('adminGetExam', { token: tTok, examId: 'DEMAU' }));
  ok(g.call('adminSaveExam', { token: tTok, exam: Object.assign(ex.exam, { tieuDe: 'Tên mới' }), questions: ex.questions }));
  assert.strictEqual(ok(g.call('listExams', { token: sTok }))[0].tieuDe, 'Tên mới');
  // adminSaveStudent
  ok(g.call('adminSaveStudent', { token: tTok, student: { id: 'HS0001', hoTen: 'Tên Đổi', lop: '12A1', ngaySinh: '01/01/2008' } }));
  assert.strictEqual(ok(g.call('me', { token: sTok })).hoTen, 'Tên Đổi');
  // adminDeleteResult
  const rid = ok(g.call('myResults', { token: sTok }))[0].id;
  ok(g.call('adminDeleteResult', { token: tTok, resultId: rid }));
  assert.strictEqual(ok(g.call('myResults', { token: sTok })).length, 0);
  // adminSaveSettings
  ok(g.call('adminSaveSettings', { token: tTok, settings: { TEN_UNG_DUNG: 'Tên web mới' } }));
  assert.strictEqual(ok(g.call('publicConfig')).appName, 'Tên web mới');
  // changePin
  ok(g.call('changePin', { token: sTok, oldPin: '0101', newPin: '2580' }));
  assert(!g.call('loginPin', { studentId: 'HS0001', pin: '0101' }).ok);
  assert(ok(g.call('loginPin', { studentId: 'HS0001', pin: '2580' })).token);
});

t('TC-1.7: KetQua 600 hàng ~1,2 KB/hàng chia mảnh, đọc ra giống hệt; >900 KB không đệm nhưng vẫn đúng', () => {
  const { g, tTok } = fresh();
  const sh = g._sheets.KetQua;
  const header = sh._data()[0];
  const mk = (i, pad) => header.map((h) => (h === 'Mã bài' ? 'KQ' + i : h === 'Mã HS' ? 'HS0001' : h === 'Điểm (thang 10)' ? 5 :
    h === 'Chi tiết (JSON)' ? '[]' : h === 'Nhận xét' ? ('Nhận xét tiếng Việt có dấu ' + i + ' ').repeat(pad) : h === 'Họ tên' ? 'Học Sinh Mẫu' : ''));
  for (let i = 0; i < 600; i++) sh._data().push(mk(i, 30)); // ~1,2 KB/hàng (UTF-8)
  g.bumpGen_('KetQua');
  const a = ok(g.call('adminResults', { token: tTok }));
  const head = Object.keys(g._cache).find((k) => /^tb_KetQua_[^_]+$/.test(k));
  assert(head, 'không thấy khóa đầu của bảng KetQua');
  const n = +g._cache[head].v;
  assert(n >= 7, 'phải chia thành nhiều mảnh, có ' + n);
  for (let i = 0; i < n; i++) assert(Buffer.byteLength(g._cache[head + '_' + i].v) <= 90000);
  g._resetStats();
  const b = ok(g.call('adminResults', { token: tTok }));
  assert.strictEqual(g._stats.reads.KetQua, undefined, 'lần 2 phải đọc từ đệm');
  assert.deepStrictEqual(b, a);
  assert.strictEqual(b.length, 600);
  // shim từ chối giá trị > 100 KB
  const c = g.CacheService.getScriptCache();
  assert.throws(() => c.put('x', 'a'.repeat(100 * 1024 + 1)), /too large/);
  assert.throws(() => c.putAll({ y: 'á'.repeat(60000) }), /too large/);
  // > 900 KB: không đệm, kết quả vẫn đúng
  for (let i = 600; i < 1000; i++) sh._data().push(mk(i, 30));
  g.bumpGen_('KetQua');
  const before = Object.keys(g._cache).filter((k) => /^tb_KetQua_/.test(k)).length;
  const d = ok(g.call('adminResults', { token: tTok }));
  assert.strictEqual(d.length, 1000);
  assert.strictEqual(Object.keys(g._cache).filter((k) => /^tb_KetQua_/.test(k)).length, before, 'không được cất bảng > 900 KB');
  g._resetStats();
  assert.strictEqual(ok(g.call('adminResults', { token: tTok })).length, 1000);
  assert.strictEqual(g._stats.reads.KetQua, 1);
});

t('TC-1.8: xóa tay một mảnh hoặc khóa tbgen_* → đọc lại Sheet, đúng; thế hệ mới khác mọi thế hệ cũ', () => {
  const { g, tTok } = fresh();
  const sh = g._sheets.KetQua;
  const header = sh._data()[0];
  for (let i = 0; i < 150; i++) sh._data().push(header.map((h) => (h === 'Mã bài' ? 'KQ' + i : h === 'Nhận xét' ? 'x'.repeat(1200) : h === 'Chi tiết (JSON)' ? '[]' : '')));
  g.bumpGen_('KetQua');
  const a = ok(g.call('adminResults', { token: tTok }));
  const seen = new Set([g._cache.tbgen_KetQua.v]);
  const head = 'tb_KetQua_' + g._cache.tbgen_KetQua.v;
  assert(+g._cache[head].v >= 2);
  delete g._cache[head + '_1'];
  g._resetStats();
  assert.deepStrictEqual(ok(g.call('adminResults', { token: tTok })), a);
  assert.strictEqual(g._stats.reads.KetQua, 1);
  for (let k = 0; k < 20; k++) {
    delete g._cache.tbgen_KetQua;
    g._resetStats();
    assert.deepStrictEqual(ok(g.call('adminResults', { token: tTok })), a);
    assert.strictEqual(g._stats.reads.KetQua, 1);
    const gen = g._cache.tbgen_KetQua.v;
    assert(!seen.has(gen), 'thế hệ trùng: ' + gen);
    seen.add(gen);
  }
});

t('TC-1.12a: xóa tay 1 hàng HocSinh (đệm còn sống) rồi HS khác đổi PIN → ghi đúng hàng', () => {
  const { g, tTok } = fresh();
  ok(g.call('adminImportStudents', { token: tTok, rows: [
    { hoTen: 'Nguyễn Văn An', lop: '12A1', ngaySinh: '05/03/2008' },
    { hoTen: 'Trần Thị Bình', lop: '12A1', ngaySinh: '20/11/2008' },
    { hoTen: 'Lê Minh Châu', lop: '12A1', ngaySinh: '09/07/2008' }] }));
  const tok = ok(g.call('loginPin', { studentId: 'HS0004', pin: '0907' })).token; // đệm HocSinh được nạp
  const data = g._sheets.HocSinh._data();
  const snapshot = JSON.parse(JSON.stringify(data));
  const rowAn = data.findIndex((r) => r[0] === 'HS0002');
  data.splice(rowAn, 1); // xóa tay, không gọi onEdit
  ok(g.call('changePin', { token: tok, oldPin: '0907', newPin: '2468' }));
  const pinCol = col(g, 'HocSinh', 'PIN riêng');
  const after = g._sheets.HocSinh._data();
  after.forEach((r) => {
    const old = snapshot.find((x) => x[0] === r[0]);
    if (r[0] === 'HS0004') assert.strictEqual(String(r[pinCol]), '2468');
    else assert.deepStrictEqual(r, old, 'hàng ' + r[0] + ' bị đổi');
  });
});

t('TC-1.12b: chèn 1 hàng lên đầu KetQua rồi adminDeleteResult → xóa đúng bài', () => {
  const { g, tTok, sTok } = fresh();
  for (let i = 0; i < 3; i++) {
    const s = ok(g.call('startExam', { token: sTok, examId: 'DEMAU' }));
    ok(g.call('submitExam', { token: sTok, attemptToken: s.attemptToken, answers: {} }));
  }
  const rs = ok(g.call('adminResults', { token: tTok })); // đệm KetQua có _row cũ
  const target = rs[1].id;
  const data = g._sheets.KetQua._data();
  const idCol = col(g, 'KetQua', 'Mã bài');
  const extra = data[0].map(() => ''); extra[idCol] = 'KQ_CHEN_TAY';
  data.splice(1, 0, extra);
  ok(g.call('adminDeleteResult', { token: tTok, resultId: target }));
  const ids = g._sheets.KetQua._data().slice(1).map((r) => r[idCol]);
  assert(!ids.includes(target));
  assert.strictEqual(ids.length, 3);
  assert(ids.includes('KQ_CHEN_TAY'));
  rs.filter((r) => r.id !== target).forEach((r) => assert(ids.includes(r.id)));
});

t('TC-1.12c: thêm học sinh sau khi sửa tay trang tính → không trùng Mã HS', () => {
  const { g, tTok } = fresh();
  ok(g.call('adminListStudents', { token: tTok })); // đệm: chỉ HS0001
  const data = g._sheets.HocSinh._data();
  const row = data[1].slice(); row[0] = 'HS0002'; row[1] = 'Thêm Tay';
  data.push(row); // giáo viên gõ thêm trên Sheet, không onEdit
  data.splice(1, 1); // và xóa HS0001
  const r = ok(g.call('adminSaveStudent', { token: tTok, student: { hoTen: 'Học Sinh Mới', lop: '12A1', ngaySinh: '02/02/2008' } }));
  assert.strictEqual(r.id, 'HS0003');
  const imp = ok(g.call('adminImportStudents', { token: tTok, rows: [{ hoTen: 'Thêm Nữa', lop: '12A1', ngaySinh: '03/03/2008' }] }));
  assert.strictEqual(imp.added, 1);
  const ids = g._sheets.HocSinh._data().slice(1).map((x) => x[0]);
  assert.strictEqual(new Set(ids).size, ids.length);
});

t('updateRow_/deleteRows_: ô khóa không khớp và không tìm thấy → báo lỗi, không ghi', () => {
  const { g, tTok } = fresh();
  ok(g.call('adminListExams', { token: tTok }));
  const ex = ok(g.call('adminGetExam', { token: tTok, examId: 'DEMAU' }));
  g._sheets.DeThi._data().splice(1, 1); // xóa tay đề
  g._resetStats();
  const r = g.call('adminSaveExam', { token: tTok, exam: Object.assign(ex.exam, { tieuDe: 'X' }), questions: ex.questions });
  assert(r.ok); // đề không còn → coi như đề mới (hành vi cũ khi không tìm thấy id)
  // gọi thẳng updateRow_ với hàng sai và khóa không tồn tại
  g.__MEMO();
  const before = JSON.stringify(g._sheets.HocSinh._data());
  assert.throws(() => g.updateRow_('HocSinh', 2, { hoTen: 'Sai' }, 'id', 'HS9999'), /vừa thay đổi/);
  assert.throws(() => g.deleteRows_('HocSinh', [2], 'id', ['HS9999']), /vừa thay đổi/);
  assert.throws(() => g.updateRow_('HocSinh', 2, { hoTen: 'Sai' }), /ô khóa/);
  assert.strictEqual(JSON.stringify(g._sheets.HocSinh._data()), before);
});

t('TC-1.13: tranh chấp — A đọc Sheet, B ghi và đổi gen, A mới cất đệm → lần đọc sau thấy dữ liệu của B', () => {
  const { g, sTok } = fresh();
  delete g._cache.tbgen_DeThi;
  Object.keys(g._cache).filter((k) => /^tb_DeThi_/.test(k)).forEach((k) => delete g._cache[k]);
  const titleCol = col(g, 'DeThi', 'Tên đề');
  // A: readTable_ → đọc gen (bước 1) → trượt → đọc Sheet (bước 3). Ngay sau khi A đọc xong Sheet,
  // B (một lần chạy khác) ghi và đặt thế hệ mới. Sau đó A mới cất đệm (bước 4) dưới gen A đã đọc.
  const realRead = g.readSheet_;
  let fired = false;
  g.readSheet_ = function (name) {
    const rows = realRead(name);
    if (name === 'DeThi' && !fired) {
      fired = true;
      g._sheets.DeThi._data()[1][titleCol] = 'Dữ liệu của B';
      g.bumpGen_('DeThi');
    }
    return rows;
  };
  g.__MEMO();
  const a = g.readTable_('DeThi');
  assert(fired);
  assert.notStrictEqual(a[0].tieuDe, 'Dữ liệu của B', 'A đọc bản cũ');
  assert(Object.keys(g._cache).some((k) => /^tb_DeThi_/.test(k)), 'A đã cất đệm');
  g.readSheet_ = realRead;
  const ex = ok(g.call('listExams', { token: sTok }));
  assert.strictEqual(ex[0].tieuDe, 'Dữ liệu của B');
});

t('onEdit (sửa tay trên Sheet) đặt thế hệ mới → lần đọc sau thấy ngay', () => {
  const { g, sTok } = fresh();
  ok(g.call('listExams', { token: sTok }));
  const titleCol = col(g, 'DeThi', 'Tên đề');
  g._sheets.DeThi._data()[1][titleCol] = 'Sửa tay';
  assert.notStrictEqual(ok(g.call('listExams', { token: sTok }))[0].tieuDe, 'Sửa tay'); // trễ khi chưa có onEdit
  g.onEdit({ range: g._sheets.DeThi.getRange(2, titleCol + 1) });
  assert.strictEqual(ok(g.call('listExams', { token: sTok }))[0].tieuDe, 'Sửa tay');
  g.onEdit({}); // không lỗi
});

t('CaiDat được đệm nhưng mật khẩu không bao giờ trả về giao diện', () => {
  const { g, tTok, sTok } = fresh();
  const pw = pwOf(g);
  const outs = [g.call('publicConfig'), g.call('bootstrap', { token: sTok }), g.call('adminBootstrap', { token: tTok }), g.call('adminGetSettings', { token: tTok })];
  outs.forEach((o) => assert(!JSON.stringify(o).includes(pw)));
});

t('Máy chủ 1.0.0 (fixture) chạy được trong shim: không có features, không có changePin/bootstrap', () => {
  const g = createContext({ quiet: true, codePath: path.join(__dirname, 'fixtures', 'Code-1.0.0.gs') });
  g.setup();
  const p = ok(g.call('publicConfig'));
  assert.strictEqual(p.version, '1.0.0');
  assert.strictEqual(p.features, undefined);
  assert.strictEqual(g.call('bootstrap', {}).error, 'Không có chức năng: bootstrap');
  assert.strictEqual(g.call('changePin', {}).error, 'Không có chức năng: changePin');
});

t('Chi phí giả: SHEET_READ_MS/CACHE_MS làm chậm đúng chỗ', () => {
  const g = createContext({ quiet: true, sheetReadMs: 30, cacheMs: 0 });
  g.setup();
  const tok = ok(g.call('loginPin', { studentId: 'HS0001', pin: '0101' })).token;
  Object.keys(g._cache).forEach((k) => delete g._cache[k]);
  let t0 = Date.now(); ok(g.call('listExams', { token: tok })); const cold = Date.now() - t0;
  t0 = Date.now(); ok(g.call('listExams', { token: tok })); const warm = Date.now() - t0;
  assert(cold >= 4 * 30, 'lần đầu phải đọc ≥ 4 trang tính: ' + cold);
  assert(warm < 30, 'lần sau đọc từ đệm: ' + warm);
});

console.log(`\n${passed} kiểm thử đạt${process.exitCode ? ', CÓ LỖI' : ''}.`);
