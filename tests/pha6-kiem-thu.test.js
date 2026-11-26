// Pha 6a — kiểm thử độc lập (người kiểm thử), viết theo đặc tả docs/spec/pha-6-phat-hanh.md.
//   node tests/pha6-kiem-thu.test.js            — TC-6.1, 6.3, 6.4, kiemTraSauTrienKhai, phần Node của 6.5 và 6.6
//   OUT=<thư mục> node tests/pha6-kiem-thu.test.js   — ghi thêm bằng chứng (JSON, nhật ký) vào thư mục đó
// Chỉ dùng hạ tầng test (gas-shim, fixtures/Code-1.0.0.gs, fixtures/kho-gia.js) và tài liệu (README, docs/VIEC-GIAO-VIEN.md).
// Dữ liệu tự soạn; mật khẩu / PIN trong file này là giá trị GIẢ chỉ dùng trên máy chủ giả.
const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');
const { createContext } = require('./gas-shim');
const K = require('./fixtures/kho-gia');

const ROOT = path.join(__dirname, '..');
const OLD_CODE = path.join(__dirname, 'fixtures', 'Code-1.0.0.gs');
const OUT = process.env.OUT || '';
const VERSION = '1.6.0'; // Pha 7a: máy chủ lên 1.6.0
const FEATURES = ['changePin', 'goal', 'bootstrap', 'cache', 'bank', 'practice', 'notebook'];
const NEW_SHEETS = ['LuyenTap', 'KetQuaLuyenTap', 'SoTay', 'CongThuc'];
const FAKE_PW = 'MkGiaPha6-73915';      // mật khẩu GIẢ đặt vào CaiDat để dò trong nhật ký
const FAKE_PIN = '4826';                 // PIN riêng GIẢ của một học sinh giả
const KHO_ID = 'KHOGIAkiemthuPha6xxxxxxxxxxxxxxxxxxxxxxxx'; // id GIẢ dài như id thật (không bắt đầu bằng 1)

let pass = 0, fail = 0;
const results = [];
function ok(tc, name, cond, detail) {
  results.push({ tc, name, ok: !!cond, detail: detail == null ? '' : detail });
  if (cond) pass++; else fail++;
  console.log(`${cond ? '✓' : '✗'} [${tc}] ${name}${detail != null && detail !== '' ? '  — ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''}`);
}
function save(name, data) {
  if (!OUT) return;
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, name), typeof data === 'string' ? data : JSON.stringify(data, null, 2));
}

/** Gắn bắt nhật ký vào một context: Logger.log và console.* đều vào mảng. */
function captureLogs(ctx) {
  const lines = [];
  const push = (...a) => lines.push(a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '));
  ctx.Logger.log = push;
  ctx.console = { log: push, info: push, warn: push, error: push };
  return lines;
}
/** Đếm mọi thao tác ghi không qua makeSheet.wrote(): insertSheet / deleteSheet / setProperty / cache put/remove. */
function instrument(ctx) {
  const c = { insertSheet: 0, deleteSheet: 0, setProperty: 0, cachePut: 0, cacheRemove: 0, cacheKeysPut: [] };
  const ss = ctx.SpreadsheetApp.getActiveSpreadsheet();
  const ins = ss.insertSheet, del = ss.deleteSheet;
  ss.insertSheet = (n) => { c.insertSheet++; return ins(n); };
  ss.deleteSheet = (s) => { c.deleteSheet++; return del(s); };
  const ps = ctx.PropertiesService.getScriptProperties;
  ctx.PropertiesService.getScriptProperties = () => { const p = ps(); const sp = p.setProperty; p.setProperty = (k, v) => { c.setProperty++; return sp(k, v); }; return p; };
  const cs = ctx.CacheService.getScriptCache;
  ctx.CacheService.getScriptCache = () => {
    const x = cs();
    const put = x.put, putAll = x.putAll, rm = x.remove, rmAll = x.removeAll;
    x.put = (k, v, s) => { c.cachePut++; c.cacheKeysPut.push(k); return put(k, v, s); };
    x.putAll = (o, s) => { c.cachePut++; c.cacheKeysPut.push(...Object.keys(o)); return putAll(o, s); };
    x.remove = (k) => { c.cacheRemove++; return rm(k); };
    x.removeAll = (ks) => { c.cacheRemove++; return rmAll(ks); };
    return x;
  };
  return c;
}
const call = (ctx, action, body) => ctx.call(action, body || {});
const data = (r, what) => { if (!r.ok) throw new Error((what || '') + ': ' + r.error); return r.data; };
const adminToken = (ctx) => data(call(ctx, 'loginAdminPassword', { password: setting(ctx, 'MAT_KHAU_QUAN_TRI') }), 'loginAdminPassword').token;
const setting = (ctx, k) => { const r = ctx._sheets.CaiDat._data().find((x) => x[0] === k); return r ? r[1] : undefined; };
const header = (ctx, name) => (ctx._sheets[name]._data()[0] || []).map(String);
const sheetNames = (ctx) => ctx.SpreadsheetApp.getActiveSpreadsheet().getSheets().map((s) => s.getName());
const norm = (v) => (v === undefined || v === null ? '' : v);
const same = (a, b) => { a = norm(a); b = norm(b); if (a instanceof Date || b instanceof Date) return a instanceof Date && b instanceof Date && a.getTime() === b.getTime(); return a === b; };
function snapshot(ctx) {
  const out = {};
  sheetNames(ctx).forEach((n) => { out[n] = ctx._sheets[n]._data().map((r) => (r || []).map((v) => (v instanceof Date ? new Date(v.getTime()) : v))); });
  return out;
}
/** Mọi khóa của `a` có trong `b` với cùng giá trị (đệ quy; mảng cùng độ dài). Trả danh sách chỗ khác. */
function subsetDiff(a, b, p = '') {
  const d = [];
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return [p + ': mảng ' + (Array.isArray(b) ? b.length : typeof b) + ' ≠ ' + a.length];
    a.forEach((x, i) => d.push(...subsetDiff(x, b[i], p + '[' + i + ']')));
    return d;
  }
  if (a && typeof a === 'object') {
    if (!b || typeof b !== 'object') return [p + ': không còn là đối tượng'];
    Object.keys(a).forEach((k) => d.push(...subsetDiff(a[k], b[k], p + '.' + k)));
    return d;
  }
  return a === b ? [] : [p + ': ' + JSON.stringify(a) + ' → ' + JSON.stringify(b)];
}
function oldCtx() {
  const g = createContext({ quiet: true, codePath: OLD_CODE });
  g.setup();
  return g;
}
function newCtx(opts) { return createContext(Object.assign({ quiet: true }, opts || {})); }
/** "Dán code mới vào cùng file Sheet": chuyển trang tính (theo thứ tự), Script Properties sang context Code.gs mới. */
function migrate(from) {
  const g = newCtx();
  const ss = g.SpreadsheetApp.getActiveSpreadsheet();
  sheetNames(from).forEach((n) => { const sh = ss.insertSheet(n); sh._setData(from._sheets[n]._data()); });
  Object.assign(g._props, from._props);
  g._resetStats();
  return g;
}
const fmtOf = (ctx, sheet, label) => {
  const h = header(ctx, sheet); const c = h.indexOf(label) + 1; if (!c) return undefined;
  const f = ctx._sheets[sheet]._formats();
  return f[`2,${c}`] != null ? f[`2,${c}`] : (f[`1,${c}`] != null ? f[`1,${c}`] : f['1,1']);
};

// ---------------------------------------------------------------------------------------------
// Dựng Sheet "kiểu cũ" bằng đúng Code 1.0.0 + dữ liệu giả + chỉnh tay như giáo viên hay làm
// ---------------------------------------------------------------------------------------------
function buildOldSheet() {
  const g = oldCtx();
  const tok = adminToken(g);
  data(call(g, 'adminImportStudents', { token: tok, rows: [
    { hoTen: 'Trần Thị Thử', lop: '12A1', ngaySinh: '05/03/2008', email: '' },
    { hoTen: 'Lê Văn Giả', lop: '12A2', ngaySinh: '17/11/2008', email: 'hs.gia@example.com' },
    { hoTen: 'Phạm Mẫu Ba', lop: '12A2', ngaySinh: '29/02/2008', email: '' }
  ] }), 'import');
  const pinSt = data(call(g, 'adminSaveStudent', { token: tok, student: { hoTen: 'Đỗ Pin Riêng', lop: '11B1', ngaySinh: '', pin: FAKE_PIN } }), 'saveStudent');
  const ex = data(call(g, 'adminSaveExam', { token: tok, exam: { tieuDe: 'Đề cũ kiểm thử 1.0.0', lop: '12A1, 12A2', thoiGian: 20, trangThai: 'MO', hienLoiGiai: 'NGAY', soLanLam: 3 },
    questions: [
      { loai: 'TN', noiDung: 'Câu TN tự soạn $x$', A: 'một', B: 'hai', C: 'ba', D: 'bốn', dapAn: 'B', chuDe: 'Chủ đề A', mucDo: 'NB', loiGiai: 'Vì hai.' },
      { loai: 'DS', noiDung: 'Câu Đ/S tự soạn', A: 'ý a', B: 'ý b', C: 'ý c', D: 'ý d', dapAn: 'DSSD', chuDe: 'Chủ đề B', mucDo: 'TH' },
      { loai: 'TL', noiDung: 'Câu trả lời ngắn tự soạn', dapAn: '3,0', saiSo: '0,1', chuDe: 'Chủ đề A', mucDo: 'VD' }
    ] }), 'saveExam');
  const draft = data(call(g, 'adminSaveExam', { token: tok, exam: { tieuDe: 'Đề nháp cũ', thoiGian: 10, trangThai: 'NHAP' },
    questions: [{ loai: 'TN', noiDung: 'Nháp', A: '1', B: '2', C: '3', D: '4', dapAn: 'A' }] }), 'saveDraft');
  // Học sinh làm bài (máy chủ 1.0.0 ghi KetQua)
  const sts = data(call(g, 'adminListStudents', { token: tok }));
  const pinOf = { 'Học Sinh Mẫu': '0101', 'Trần Thị Thử': '0503', 'Lê Văn Giả': '1711', 'Phạm Mẫu Ba': '2902', 'Đỗ Pin Riêng': FAKE_PIN };
  const take = (name, examId, answers) => {
    const s = sts.find((x) => x.hoTen === name);
    const t = data(call(g, 'loginPin', { studentId: s.id, pin: pinOf[name] }), 'login ' + name).token;
    const a = data(call(g, 'startExam', { token: t, examId }), 'start');
    return data(call(g, 'submitExam', { token: t, attemptToken: a.attemptToken, answers }), 'submit');
  };
  take('Học Sinh Mẫu', 'DEMAU', { 1: 'C', 2: 'B', 3: 'A', 4: 'DSDS', 5: '420', 6: '12,5' });
  take('Học Sinh Mẫu', ex.id, { 1: 'B', 2: 'DSSD', 3: '3' });
  take('Trần Thị Thử', ex.id, { 1: 'A', 2: 'DSDD', 3: '2,95' });
  take('Lê Văn Giả', ex.id, { 1: 'B', 2: 'SSSS', 3: '7' });
  take('Lê Văn Giả', 'DEMAU', { 1: 'C', 2: 'A' });
  take('Trần Thị Thử', 'DEMAU', {});
  // Chỉnh tay kiểu giáo viên
  const HS = g._sheets.HocSinh._data();
  HS.forEach((r, i) => r.splice(3, 0, i === 0 ? 'SĐT phụ huynh' : (i === 2 ? '0900000000' : ''))); // chèn cột GIỮA bảng
  HS.splice(3, 0, []);                                          // một hàng trống ở giữa (xóa nội dung hàng)
  const KQ = g._sheets.KetQua._data();
  KQ[0].push('Ghi chú GV'); KQ.forEach((r, i) => { if (i) r[KQ[0].length - 1] = i === 1 ? 'đã gọi phụ huynh' : (i === 2 ? 7 : ''); });
  KQ[1][4] = 7.5;                                                // giáo viên sửa tay điểm thành SỐ (ô định dạng số)
  const CH = g._sheets.CauHoi._data();
  CH[0].push('Nguồn (GV)'); CH.slice(1).forEach((r, i) => { r[CH[0].length - 1] = 'nguồn tự ghi ' + i; });
  const ss = g.SpreadsheetApp.getActiveSpreadsheet();
  const own = ss.insertSheet('Bảng điểm tay');
  own._setData([['Lớp', 'Ghi chú', 'Ngày'], ['12A1', '=AVERAGE(KetQua!E2:E9)', new Date(Date.UTC(2026, 9, 1))], ['12A2', 'họp phụ huynh', 3]]);
  g._sheets.CaiDat._data().push(['GHI_CHU_RIENG', 'giá trị riêng của giáo viên', 'giáo viên tự thêm']);
  g._sheets.CaiDat._data().find((r) => r[0] === 'TEN_UNG_DUNG')[1] = 'Luyện đề — tên đã đổi';
  // Kết quả các API cũ trên máy chủ 1.0.0 (để so sau khi nâng cấp)
  const ref = {};
  g.__MEMO();
  ref.adminResults = data(call(g, 'adminResults', { token: tok }));
  ref.gradebook = data(call(g, 'adminGradebook', { token: tok }));
  ref.leaderboard = data(call(g, 'leaderboard', { token: tok }));
  ref.examStats = data(call(g, 'adminExamStats', { token: tok, examId: ex.id }));
  ref.listExamsAdmin = data(call(g, 'adminListExams', { token: tok }));
  ref.students = data(call(g, 'adminListStudents', { token: tok }));
  ref.classes = data(call(g, 'listClasses'));
  const hsm = sts.find((x) => x.hoTen === 'Học Sinh Mẫu');
  const t = data(call(g, 'loginPin', { studentId: hsm.id, pin: '0101' })).token;
  ref.myResults = data(call(g, 'myResults', { token: t }));
  ref.myStats = data(call(g, 'myStats', { token: t }));
  ref.getResult = data(call(g, 'getResult', { token: t, resultId: ref.myResults[0].id }));
  ref.listExams = data(call(g, 'listExams', { token: t }));
  return { g, ex, draft, pinSt, ref, pinOf, sts };
}

// =============================================================================================
console.log('\n=== TC-6.1 — phiên bản và features ===');
{
  const g = newCtx();
  g.setup();
  const get = JSON.parse(g.doGet().getContent());
  ok('6.1', 'doGet trả version ' + VERSION, get.ok && get.data && get.data.version === VERSION, get.data);
  const gf = (get.data && get.data.features) || null;
  if (gf) ok('6.1', 'doGet.features đủ 6 mục (nếu có)', FEATURES.every((f) => gf.includes(f)), gf);
  const pc = call(g, 'publicConfig');
  ok('6.1', 'publicConfig.version = ' + VERSION, pc.ok && pc.data.version === VERSION, pc.ok ? pc.data.version : pc.error);
  const feats = (pc.ok && pc.data.features) || [];
  ok('6.1', 'publicConfig.features chứa ' + FEATURES.join(','), FEATURES.every((f) => feats.includes(f)), feats);
  ok('6.1', 'APP_VERSION trong Code.gs = ' + VERSION, g.APP_VERSION === VERSION, g.APP_VERSION);
  // phụ: appsscript.json không thêm oauthScopes; setup không tạo trigger (shim không có ScriptApp → setup chạy được là không gọi)
  const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps-script', 'appsscript.json'), 'utf8'));
  ok('6.1', 'appsscript.json không có oauthScopes (thiết kế kỹ thuật)', !('oauthScopes' in man), Object.keys(man));
  ok('6.1', 'setup() chạy không cần ScriptApp (không tạo trigger)', typeof g.ScriptApp === 'undefined');
  save('tc61.json', { doGet: get, publicConfig: pc });
}

// =============================================================================================
console.log('\n=== TC-6.3 — setup() trên Sheet kiểu 1.0.0 có dữ liệu ===');
const OLD = buildOldSheet();
const before = snapshot(OLD.g);
const M = migrate(OLD.g);
const migLog = captureLogs(M);
let setupErr = null;
try { M.setup(); } catch (e) { setupErr = e; }
ok('6.3', 'setup() mới chạy không lỗi trên Sheet 1.0.0', !setupErr, setupErr && String(setupErr.stack || setupErr));
const after = snapshot(M);
{
  const lostSheets = Object.keys(before).filter((n) => !after[n]);
  ok('6.3', 'không mất trang tính nào (kể cả trang riêng "Bảng điểm tay")', !lostSheets.length, lostSheets);
  const oldOrder = Object.keys(before);
  const newOrder = sheetNames(M).filter((n) => oldOrder.includes(n));
  ok('6.3', 'thứ tự các trang tính cũ giữ nguyên', JSON.stringify(oldOrder) === JSON.stringify(newOrder), newOrder);
  const added = sheetNames(M).filter((n) => !before[n]);
  ok('6.3', 'chỉ thêm ' + NEW_SHEETS.join(', '), JSON.stringify(added.slice().sort()) === JSON.stringify(NEW_SHEETS.slice().sort()), added);
  let cells = 0; const diffs = [];
  const growth = {};
  Object.keys(before).forEach((n) => {
    const A = before[n], B = after[n] || [];
    const cols = A.reduce((m, r) => Math.max(m, (r || []).length), 0);
    for (let r = 0; r < A.length; r++) for (let c = 0; c < cols; c++) {
      cells++;
      const a = (A[r] || [])[c], b = (B[r] || [])[c];
      if (!same(a, b)) diffs.push(`${n}!R${r + 1}C${c + 1}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`);
    }
    const hA = (A[0] || []).filter((x) => norm(x) !== '').length, hB = (B[0] || []).filter((x) => norm(x) !== '').length;
    growth[n] = { hang: [A.length, B.length], cotTieuDe: [hA, hB], themCot: (B[0] || []).slice((A[0] || []).length).filter((x) => norm(x) !== '') };
  });
  ok('6.3', `so TỪNG ô cũ trước/sau: ${cells} ô, 0 ô đổi`, diffs.length === 0, diffs.slice(0, 10));
  const rowsChanged = Object.keys(before).filter((n) => n !== 'CaiDat' && growth[n].hang[0] !== growth[n].hang[1]);
  ok('6.3', 'không thêm/bớt hàng ở trang dữ liệu (không gieo lại HS/đề mẫu)', rowsChanged.length === 0, rowsChanged.map((n) => n + ' ' + growth[n].hang.join('→')));
  ok('6.3', 'KetQua chỉ thêm cột "Mục tiêu" ở cuối (sau cột riêng của GV)', JSON.stringify(growth.KetQua.themCot) === JSON.stringify(['Mục tiêu']), growth.KetQua.themCot);
  ok('6.3', 'HocSinh/DeThi/CaiDat/"Bảng điểm tay" không thêm cột', ['HocSinh', 'DeThi', 'CaiDat', 'Bảng điểm tay'].every((n) => growth[n].themCot.length === 0), ['HocSinh', 'DeThi', 'CaiDat'].map((n) => n + ':' + growth[n].themCot.join('|')));
  ok('6.3', 'CauHoi thêm 5 cột, cột đầu là "Mã câu kho" (theo VIEC-GIAO-VIEN A3)', growth.CauHoi.themCot.length === 5 && growth.CauHoi.themCot[0] === 'Mã câu kho', growth.CauHoi.themCot);
  const cdOld = before.CaiDat.map((r) => r[0]);
  const cdNew = after.CaiDat.slice(before.CaiDat.length).map((r) => r[0]);
  ok('6.3', 'CaiDat: chỉ thêm dòng ở cuối, có KHO_CAU_HOI_ID, THU_MUC_HINH_KHO_ID, CHO_LUYEN_TAP', ['KHO_CAU_HOI_ID', 'THU_MUC_HINH_KHO_ID', 'CHO_LUYEN_TAP'].every((k) => cdNew.includes(k)) && !cdNew.some((k) => cdOld.includes(k)), cdNew);
  save('tc63-tang-truong.json', { growth, cdNew, cells, diffs });
  console.log('   tăng trưởng:', JSON.stringify(growth));
}
// API cũ đọc dữ liệu cũ sau nâng cấp
{
  const g = M;
  const tok = adminToken(g);
  const R = OLD.ref;
  const cmp = (name, a, b) => { const d = subsetDiff(a, b); ok('6.3', `API cũ "${name}" trả đúng dữ liệu cũ (mọi trường của 1.0.0 giữ nguyên)`, d.length === 0, d.slice(0, 6)); };
  cmp('adminResults', R.adminResults, data(call(g, 'adminResults', { token: tok })));
  cmp('adminGradebook', R.gradebook, data(call(g, 'adminGradebook', { token: tok })));
  cmp('leaderboard (giáo viên)', R.leaderboard, data(call(g, 'leaderboard', { token: tok })));
  cmp('adminExamStats', R.examStats, data(call(g, 'adminExamStats', { token: tok, examId: OLD.ex.id })));
  const le = data(call(g, 'adminListExams', { token: tok }));
  cmp('adminListExams', R.listExamsAdmin, le);
  const stNew = data(call(g, 'adminListStudents', { token: tok }));
  // PIN trong danh sách quản trị có thể bị ẩn theo Pha 1 (bộ đệm quản trị không chứa PIN) — so riêng phần còn lại
  const strip = (arr) => arr.map((s) => { const o = Object.assign({}, s); delete o.pin; return o; });
  cmp('adminListStudents (trừ trường pin)', strip(R.students), stNew);
  cmp('listClasses', R.classes, data(call(g, 'listClasses')));
  const hsm = OLD.sts.find((x) => x.hoTen === 'Học Sinh Mẫu');
  const lg = call(g, 'loginPin', { studentId: hsm.id, pin: '0101' });
  ok('6.3', 'đăng nhập học sinh mẫu (PIN ngày sinh 0101) sau nâng cấp', lg.ok, lg.error);
  const t = lg.data.token;
  cmp('myResults', R.myResults, data(call(g, 'myResults', { token: t })));
  cmp('myStats', R.myStats, data(call(g, 'myStats', { token: t })));
  cmp('getResult (bài cũ)', R.getResult, data(call(g, 'getResult', { token: t, resultId: R.myResults[0].id })));
  cmp('listExams', R.listExams, data(call(g, 'listExams', { token: t })));
  const pl = call(g, 'loginPin', { studentId: OLD.pinSt.id, pin: FAKE_PIN });
  ok('6.3', 'đăng nhập học sinh có "PIN riêng" cũ', pl.ok, pl.error);
  const lv = OLD.sts.find((x) => x.hoTen === 'Lê Văn Giả');
  const lt = data(call(g, 'loginPin', { studentId: lv.id, pin: '1711' }), 'login Lê Văn Giả').token;
  // làm lại đề cũ (lượt thứ 2/3): đáp án đúng hết → 10 điểm, ghi đúng cột
  const st = call(g, 'startExam', { token: lt, examId: OLD.ex.id });
  ok('6.3', 'startExam đề cũ sau nâng cấp', st.ok && st.data.questions.length === 3, st.ok ? st.data.questions.length : st.error);
  const sb = call(g, 'submitExam', { token: lt, attemptToken: st.data.attemptToken, answers: { 1: 'B', 2: 'DSSD', 3: '3,05' } });
  ok('6.3', 'submitExam đề cũ → 10 điểm', sb.ok && sb.data.diem === 10, sb.ok ? sb.data.diem : sb.error);
  const KQ = g._sheets.KetQua._data();
  const h = KQ[0]; const last = KQ[KQ.length - 1];
  const at = (l) => last[h.indexOf(l)];
  ok('6.3', 'hàng KetQua mới ghi đúng cột cũ (Họ tên, Lớp, Đề, Điểm, Mã đề)', at('Họ tên') === 'Lê Văn Giả' && at('Lớp') === '12A2' && at('Đề') === 'Đề cũ kiểm thử 1.0.0' && Number(at('Điểm (thang 10)')) === 10 && at('Mã đề') === OLD.ex.id,
    { hoTen: at('Họ tên'), lop: at('Lớp'), de: at('Đề'), diem: at('Điểm (thang 10)'), maDe: at('Mã đề') });
  ok('6.3', 'cột riêng "Ghi chú GV" của hàng mới để trống', norm(at('Ghi chú GV')) === '', at('Ghi chú GV'));
  ok('6.3', 'hàng cũ không bị chạm khi ghi hàng mới', KQ.length - 1 === before.KetQua.length && before.KetQua.every((r, i) => r.every((v, j) => same(v, KQ[i][j]))));
  // Đăng nhập học sinh mẫu sau nâng cấp: bảng điểm có cả bài mới lẫn cũ
  const gb = data(call(g, 'adminGradebook', { token: tok }));
  const row = gb.rows.find((r) => r.hoTen === 'Lê Văn Giả');
  ok('6.3', 'bảng điểm sau bài mới: Lê Văn Giả có điểm cao nhất 10 ở đề cũ, n=2', row && row.scores[OLD.ex.id] && row.scores[OLD.ex.id].best === 10 && row.scores[OLD.ex.id].n === 2, row && row.scores[OLD.ex.id]);
  ok('6.3', 'TEN_UNG_DUNG đã đổi tay và dòng CaiDat riêng còn nguyên', setting(g, 'TEN_UNG_DUNG') === 'Luyện đề — tên đã đổi' && setting(g, 'GHI_CHU_RIENG') === 'giá trị riêng của giáo viên');
  const pc = data(call(g, 'publicConfig'));
  ok('6.3', 'publicConfig đọc TEN_UNG_DUNG cũ', pc.appName === 'Luyện đề — tên đã đổi', pc.appName);
}

// =============================================================================================
console.log('\n=== TC-6.4 — setup() chạy nhiều lần ===');
function idem(label, g, runs) {
  const snaps = [snapshot(g)];
  for (let i = 0; i < runs; i++) { g.setup(); snaps.push(snapshot(g)); }
  const s0 = JSON.stringify(snaps[1]);
  const allSame = snaps.slice(2).every((s) => JSON.stringify(s) === s0);
  ok('6.4', `${label}: lần chạy 2..${runs} không đổi gì so với lần 1`, allSame,
    allSame ? '' : snaps.slice(2).map((s, i) => Object.keys(s).filter((n) => JSON.stringify(s[n]) !== JSON.stringify(snaps[1][n])).join(',') + '@' + (i + 2)));
  const names = sheetNames(g);
  ok('6.4', `${label}: không trùng trang tính`, new Set(names).size === names.length, names);
  const keys = g._sheets.CaiDat._data().map((r) => r[0]).filter((k) => norm(k) !== '');
  const dup = keys.filter((k, i) => keys.indexOf(k) !== i);
  ok('6.4', `${label}: không trùng khóa CaiDat (${keys.length} khóa)`, dup.length === 0, dup);
  const dupCols = names.map((n) => { const h = header(g, n).filter((x) => x !== ''); return [n, h.filter((x, i) => h.indexOf(x) !== i)]; }).filter((x) => x[1].length);
  ok('6.4', `${label}: không trùng cột ở trang nào`, dupCols.length === 0, dupCols);
}
{
  const g = newCtx();
  const logs = captureLogs(g);
  idem('Sheet trống', g, 3);
  ok('6.4', 'Sheet trống: có đủ ' + (5 + NEW_SHEETS.length) + ' trang tính chuẩn', ['HocSinh', 'DeThi', 'CauHoi', 'KetQua', 'CaiDat', ...NEW_SHEETS].every((n) => g._sheets[n]), sheetNames(g));
  // định dạng số KetQuaLuyenTap giống KetQua
  const hK = header(g, 'KetQua'), hL = header(g, 'KetQuaLuyenTap');
  const common = hK.filter((l) => l && hL.includes(l));
  const fdiff = common.filter((l) => fmtOf(g, 'KetQua', l) !== fmtOf(g, 'KetQuaLuyenTap', l)).map((l) => `${l}: KetQua=${fmtOf(g, 'KetQua', l)} / KQLT=${fmtOf(g, 'KetQuaLuyenTap', l)}`);
  const numCols = common.filter((l) => /^0/.test(String(fmtOf(g, 'KetQua', l) || '')));
  ok('6.4', `KetQuaLuyenTap cùng định dạng số với KetQua ở ${common.length} cột chung (${numCols.length} cột số: ${numCols.join(', ')})`, fdiff.length === 0 && numCols.length >= 3, fdiff);
  ok('6.4', 'KetQuaLuyenTap: định dạng chung của trang (ô 1,1) giống KetQua', g._sheets.KetQua._formats()['1,1'] === g._sheets.KetQuaLuyenTap._formats()['1,1'], [g._sheets.KetQua._formats()['1,1'], g._sheets.KetQuaLuyenTap._formats()['1,1']]);
  save('tc64-dinh-dang.json', { KetQua: g._sheets.KetQua._formats(), KetQuaLuyenTap: g._sheets.KetQuaLuyenTap._formats(), hK, hL });
  // README Bước 1.4 & 4: setup trên Sheet trống
  ok('6.6', 'setup in "✅ Cài đặt xong!" (VIEC-GIAO-VIEN A3)', logs.some((l) => l.includes('✅ Cài đặt xong!')), logs.filter((l) => /Cài đặt/.test(l)).map((l) => l.replace(String(setting(g, 'MAT_KHAU_QUAN_TRI')), '<mật khẩu>')));
  const nSheets = sheetNames(g).length;
  // (vòng 2) README Bước 1.4 "sẽ thấy N trang tính" và VIEC-GIAO-VIEN A3 "tổng cộng N trang tính" phải khớp setup thật
  const rd = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  const vg = fs.readFileSync(path.join(ROOT, 'docs', 'VIEC-GIAO-VIEN.md'), 'utf8');
  const nReadme = +((/sẽ thấy (\d+) trang tính/.exec(rd) || [])[1]);
  const nViec = +((/tổng cộng (\d+) trang tính/.exec(vg) || [])[1]);
  ok('6.6', `README Bước 1.4 "sẽ thấy ${nReadme} trang tính" khớp setup thật (${nSheets} trang)`, nReadme === nSheets, sheetNames(g));
  ok('6.6', `VIEC-GIAO-VIEN A3 "tổng cộng ${nViec} trang tính" khớp setup thật (${nSheets})`, nViec === nSheets);
  const hs = g._sheets.HocSinh._data(); const de = g._sheets.DeThi._data();
  ok('6.6', 'README: có học sinh mẫu "Học Sinh Mẫu" lớp 12A1 và một đề mẫu', hs.length === 2 && hs[1].includes('Học Sinh Mẫu') && hs[1].includes('12A1') && de.length === 2);
  const lg = call(g, 'loginPin', { studentId: hs[1][0], pin: '0101' });
  ok('6.6', 'README Bước 4: Học Sinh Mẫu đăng nhập bằng PIN 0101', lg.ok, lg.error);
  ok('6.6', 'README: mật khẩu quản trị ở CaiDat dòng MAT_KHAU_QUAN_TRI', !!setting(g, 'MAT_KHAU_QUAN_TRI'));
  ok('6.6', 'CHO_LUYEN_TAP mặc định KHONG (README "Mặc định là Tắt", VIEC-GIAO-VIEN A4)', setting(g, 'CHO_LUYEN_TAP') === 'KHONG', setting(g, 'CHO_LUYEN_TAP'));
  const cdVals = g._sheets.CaiDat._data().map((r) => String(r[1]));
  ok('6.6', 'Có dòng CaiDat giá trị mặc định "7,1,2,10" (Đề nhanh theo bài)', cdVals.includes('7,1,2,10'), g._sheets.CaiDat._data().filter((r) => /7.?1.?2.?10/.test(String(r[1]))).map((r) => r[0]));
}
{
  idem('Sheet 1.0.0 đã nâng cấp (TC-6.3)', M, 2);
  const hK = header(M, 'KetQua'), hL = header(M, 'KetQuaLuyenTap');
  const common = hK.filter((l) => l && hL.includes(l));
  const fdiff = common.filter((l) => fmtOf(M, 'KetQua', l) !== fmtOf(M, 'KetQuaLuyenTap', l)).map((l) => `${l}: ${fmtOf(M, 'KetQua', l)} / ${fmtOf(M, 'KetQuaLuyenTap', l)}`);
  ok('6.4', 'Sheet nâng cấp: KetQuaLuyenTap cùng định dạng số với KetQua (cột KetQua lệch chỗ vì có cột riêng của GV)', fdiff.length === 0, fdiff);
}

// =============================================================================================
console.log('\n=== kiemTraSauTrienKhai() ===');
function runCheck(g, label) {
  const logs = captureLogs(g);
  const cnt = instrument(g);
  g._resetStats();
  g.__MEMO();
  const cacheKeysBefore = Object.keys(g._cache);
  let err = null, ret;
  try { ret = g.kiemTraSauTrienKhai(); } catch (e) { err = e; }
  const st = g._stats;
  const sheetWrites = Object.values(st.writes).reduce((a, b) => a + b, 0);
  const extWrites = Object.values(st.extWrites).reduce((a, b) => a + b, 0);
  const newKeys = Object.keys(g._cache).filter((k) => !cacheKeysBefore.includes(k));
  save('kiem-tra-' + label + '.log', logs.join('\n'));
  return { logs, err, ret, sheetWrites, extWrites, cnt, newKeys, st };
}
{
  ok('6.x', 'Code.gs có hàm kiemTraSauTrienKhai', typeof newCtx().kiemTraSauTrienKhai === 'function');
  // (a) hệ thống đầy đủ + kho giả + mật khẩu giả
  const g = newCtx(); g.setup();
  K.install(g, { khoId: KHO_ID });
  K.setSetting(g, { MAT_KHAU_QUAN_TRI: FAKE_PW });
  const sec = Object.values(g._props).filter((v) => String(v).length >= 16);
  const tok = adminToken(g);
  data(call(g, 'adminSaveStudent', { token: tok, student: { hoTen: 'HS PIN Riêng', lop: '10A1', pin: FAKE_PIN } }));
  const r = runCheck(g, 'day-du');
  ok('6.x', '(đủ) chạy không lỗi', !r.err, r.err && String(r.err.stack));
  ok('6.x', '(đủ) 0 lần ghi Sheet (setValues/appendRow/clear/deleteRow/insert…)', r.sheetWrites === 0, r.st.writes);
  ok('6.x', '(đủ) 0 lần ghi file kho', r.extWrites === 0, r.st.extWrites);
  ok('6.x', '(đủ) không tạo/xóa trang tính, không ghi Script Properties', r.cnt.insertSheet + r.cnt.deleteSheet + r.cnt.setProperty === 0, r.cnt);
  ok('6.x', `(đủ) ghi đệm tối đa 1 khóa thử (put: ${r.cnt.cachePut}, khóa: ${r.cnt.cacheKeysPut.join(',')}; còn lại sau chạy: ${r.newKeys.length})`, new Set(r.cnt.cacheKeysPut).size <= 1);
  const all = r.logs.join('\n');
  ok('6.x', '(đủ) nhật ký không chứa mật khẩu giả', !all.includes(FAKE_PW));
  ok('6.x', '(đủ) nhật ký không chứa PIN riêng / bí mật ký token', !all.includes(FAKE_PIN) && !sec.some((s) => all.includes(s)));
  ok('6.x', '(đủ) nhật ký có phiên bản ' + VERSION, all.includes(VERSION));
  ok('6.x', '(đủ) không có dòng ❌', !/❌/.test(all), r.logs.filter((l) => /❌/.test(l)));
  const khoLines = r.logs.filter((l) => /kho/i.test(l));
  ok('6.x', '(đủ) có dòng ✅ về đọc kho', khoLines.some((l) => /✅/.test(l)), khoLines);
  ok('6.x', '(đủ) có dòng về đệm (CacheService)', r.logs.some((l) => /đệm|cache/i.test(l)), r.logs.filter((l) => /đệm|cache/i.test(l)));
  r.logs.forEach((l) => console.log('     │ ' + l));

  // (b) kho dán dưới dạng ĐỊA CHỈ trình duyệt (VIEC-GIAO-VIEN A4: "chép địa chỉ trên thanh trình duyệt, dán vào")
  const folderId = setting(g, 'THU_MUC_HINH_KHO_ID');
  K.setSetting(g, { KHO_CAU_HOI_ID: `https://docs.google.com/spreadsheets/d/${KHO_ID}/edit#gid=0`, THU_MUC_HINH_KHO_ID: `https://drive.google.com/drive/folders/${folderId}?usp=sharing` });
  const ru = runCheck(g, 'kho-url');
  const khoU = ru.logs.filter((l) => /kho|thư mục|hình/i.test(l));
  ok('6.6', 'kiemTraSauTrienKhai chấp nhận KHO_CAU_HOI_ID/THU_MUC_HINH_KHO_ID dạng địa chỉ trình duyệt', !ru.err && !/❌/.test(ru.logs.join('\n')) && khoU.some((l) => /✅/.test(l)), khoU);
  ok('6.x', '(url) vẫn 0 lần ghi', ru.sheetWrites === 0 && ru.extWrites === 0);

  // (c) kho sai id
  K.setSetting(g, { KHO_CAU_HOI_ID: 'KHOkhongtontaixxxxxxxxxxxxxxxxxxxxxxx', THU_MUC_HINH_KHO_ID: folderId });
  const rb = runCheck(g, 'kho-sai');
  ok('6.x', '(kho sai id) không ném lỗi, báo ❌/⚠️ về kho', !rb.err && rb.logs.some((l) => /kho/i.test(l) && /❌|⚠️/.test(l)), rb.logs.filter((l) => /kho/i.test(l)));
  ok('6.x', '(kho sai id) 0 lần ghi', rb.sheetWrites === 0);

  // (d) thiếu trang tính và thiếu cột
  K.setSetting(g, { KHO_CAU_HOI_ID: KHO_ID });
  const ss = g.SpreadsheetApp.getActiveSpreadsheet();
  ss.deleteSheet(g._sheets.LuyenTap);
  const hK = g._sheets.KetQua._data()[0]; const iMT = hK.indexOf('Mục tiêu'); hK[iMT] = '';
  const hC = g._sheets.CauHoi._data()[0]; const iMa = hC.indexOf('Mã câu kho'); hC[iMa] = 'Ma cau kho (đổi tên)';
  const rm = runCheck(g, 'thieu');
  const bad = rm.logs.filter((l) => /❌|⚠️/.test(l));
  ok('6.x', '(thiếu) không ném lỗi', !rm.err, rm.err && String(rm.err.stack));
  ok('6.x', '(thiếu) báo thiếu trang tính LuyenTap', bad.some((l) => l.includes('LuyenTap') && !l.includes('KetQuaLuyenTap')) || bad.some((l) => /LuyenTap(?!\w)/.test(l.replace(/KetQuaLuyenTap/g, ''))), bad);
  ok('6.x', '(thiếu) báo thiếu cột "Mục tiêu" của KetQua', bad.some((l) => l.includes('Mục tiêu')), bad);
  ok('6.x', '(thiếu) báo thiếu cột "Mã câu kho" của CauHoi', bad.some((l) => l.includes('Mã câu kho')), bad);
  ok('6.x', '(thiếu) dòng ❌ ghi cách sửa (VIEC-GIAO-VIEN A6 "dòng đó ghi cách sửa")', bad.filter((l) => /❌/.test(l)).every((l) => /setup|chạy|điền|dán|→|hãy|cần/i.test(l)), bad.filter((l) => /❌/.test(l)));
  ok('6.x', '(thiếu) KHÔNG tự sửa: 0 lần ghi, không tạo lại trang tính', rm.sheetWrites === 0 && rm.cnt.insertSheet === 0 && !g._sheets.LuyenTap, rm.st.writes);
  rm.logs.forEach((l) => console.log('     │ ' + l));

  // (e) giáo viên dán code nhưng QUÊN chạy setup (Sheet 1.0.0)
  const o = oldCtx();
  const g2 = migrate(o);
  const rf = runCheck(g2, 'quen-setup');
  ok('6.x', '(quên setup) không ném lỗi; báo thiếu LuyenTap/KetQuaLuyenTap; 0 lần ghi', !rf.err && rf.logs.some((l) => /❌|⚠️/.test(l) && /KetQuaLuyenTap/.test(l)) && rf.sheetWrites === 0 && rf.cnt.insertSheet === 0, rf.err ? String(rf.err) : rf.logs.filter((l) => /❌|⚠️/.test(l)));
  ok('6.x', '(quên setup) nhật ký không chứa mật khẩu', !rf.logs.join('\n').includes(String(setting(g2, 'MAT_KHAU_QUAN_TRI'))));

  // (f) chưa điền kho
  const g3 = newCtx(); g3.setup();
  const rk = runCheck(g3, 'chua-dien-kho');
  ok('6.x', '(chưa điền KHO_CAU_HOI_ID) không lỗi, nhắc điền kho, 0 lần ghi', !rk.err && rk.logs.some((l) => /KHO_CAU_HOI_ID/.test(l)) && rk.sheetWrites === 0, rk.logs.filter((l) => /kho/i.test(l)));

  // (g) CauHoi gần 1 000 hàng (VIEC-GIAO-VIEN B4 R-10: "kiemTraSauTrienKhai có lưu ý khi CauHoi sắp hết hàng")
  const g4 = newCtx(); g4.setup();
  const CH = g4._sheets.CauHoi._data();
  const w = CH[0].length;
  for (let i = CH.length; i < 960; i++) { const r0 = new Array(w).fill(''); r0[0] = 'DEGIA'; r0[1] = i; r0[4] = 'Câu giả ' + i; CH.push(r0); }
  const rc = runCheck(g4, 'cauhoi-960');
  ok('6.6', '(CauHoi 960 hàng) có lưu ý ⚠️ về CauHoi sắp hết hàng', rc.logs.some((l) => /⚠️/.test(l) && /CauHoi/.test(l)), rc.logs.filter((l) => /CauHoi/.test(l)));
}

// =============================================================================================
console.log('\n=== TC-6.6 (phần Node) — đối chiếu tài liệu với hành vi thật ===');
{
  const code = fs.readFileSync(path.join(ROOT, 'apps-script', 'Code.gs'), 'utf8').split('\n');
  const viec = fs.readFileSync(path.join(ROOT, 'docs', 'VIEC-GIAO-VIEN.md'), 'utf8');
  const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  // (vòng 2) A2: "Ctrl+F, tìm APP_VERSION: phải thấy var APP_VERSION = '1.5.0'; (ở khoảng dòng 21, sau khối chú thích)"
  const firstHit = code.findIndex((l) => l.includes('APP_VERSION'));
  const declLine = code.findIndex((l) => l.includes("var APP_VERSION = '" + VERSION + "';"));
  const lineDoc = +((/khoảng dòng (\d+)/.exec(viec) || [])[1]);
  ok('6.6', 'A2 Ctrl+F "APP_VERSION": kết quả tìm ĐẦU TIÊN chính là dòng var APP_VERSION = \'' + VERSION + '\';', firstHit >= 0 && firstHit === declLine, `lần gặp đầu: dòng ${firstHit + 1}: ${code[firstHit]}`);
  ok('6.6', `A2 "khoảng dòng ${lineDoc}" khớp vị trí thật (dòng ${declLine + 1}, lệch ≤ 3), và trước đó chỉ là khối chú thích`, Math.abs(lineDoc - (declLine + 1)) <= 3 && code.slice(0, declLine).every((l) => /^\s*(\/\*\*?|\*|\*\/|\/\/|$)/.test(l)), code.slice(0, declLine).filter((l) => !/^\s*(\/\*\*?|\*|\*\/|\/\/|$)/.test(l)).slice(0, 3));
  ok('6.6', 'VIEC-GIAO-VIEN ghi Code.gs 1.5.0', viec.includes('1.5.0') && readme.includes('1.5.0'));
  const g = newCtx();
  ['setup', 'kiemTraSauTrienKhai'].forEach((f) => ok('6.6', `hàm "${f}" nêu trong tài liệu có trong Code.gs`, typeof g[f] === 'function'));
  // Tên trang tính trong tài liệu
  const docSheets = Array.from(new Set((viec + readme).match(/`(HocSinh|DeThi|CauHoi|KetQua|CaiDat|LuyenTap|KetQuaLuyenTap)`/g) || [])).map((s) => s.replace(/`/g, ''));
  ok('6.6', 'mọi tên trang tính trong tài liệu có sau setup', docSheets.every((n) => after[n]), docSheets);
  // Khóa CaiDat trong tài liệu
  // chỉ phần dành cho giáo viên (README trước mục "Dành cho lập trình viên"); bỏ tên biến mã nguồn APP_VERSION/APP_CONFIG/API_URL
  const readmeGv = readme.split('## Dành cho lập trình viên')[0];
  const keys = Array.from(new Set((viec + readmeGv).match(/\b[A-Z]{2,}(?:_[A-Z]+)+\b/g) || [])).filter((k) => !['APP_VERSION', 'APP_CONFIG', 'API_URL'].includes(k));
  const cd = M._sheets.CaiDat._data().map((r) => r[0]);
  const missingKeys = keys.filter((k) => !cd.includes(k));
  ok('6.6', `mọi khóa kiểu CAI_DAT trong tài liệu có trong CaiDat (${keys.join(', ')})`, missingKeys.length === 0, missingKeys);
  const ten = M._sheets.CaiDat._data().find((r) => r[0] === 'TEN_GIAO_VIEN');
  ok('6.6', 'A4: setup không sửa ô Ghi chú cũ của TEN_GIAO_VIEN (vẫn "hiển thị ở chân trang")', ten && /chân trang/.test(ten[2]), ten && ten[2]);
  const files = viec.match(/`docs\/[^`]+`/g) || [];
  const miss = files.map((f) => f.replace(/`/g, '')).filter((f) => !fs.existsSync(path.join(ROOT, f)));
  ok('6.6', 'mọi file docs/… nêu trong VIEC-GIAO-VIEN tồn tại', miss.length === 0, miss);
  ok('6.6', 'ghi chú cảnh báo "ứng dụng chưa xác minh" có ở cả hai tài liệu', /Nâng cao/.test(viec) && /Nâng cao/.test(readme));
}

// =============================================================================================
console.log('\n=== Vòng 2 — N-1: Mã bài không trùng; mã kiểu cũ vẫn mở được ===');
{
  const g = newCtx(); g.setup();
  K.install(g, { khoId: KHO_ID });
  K.setSetting(g, { CHO_LUYEN_TAP: 'CO' });
  const tok = adminToken(g);
  let cur, r;
  do { r = call(g, 'adminPracticeSync', { token: tok, filter: {}, mode: 'them', cursor: cur }); cur = r.ok ? r.data.tiepTuc : null; } while (cur != null);
  ok('N-1', 'đưa kho giả vào pool luyện tập', r.ok, r.error);
  data(call(g, 'adminImportStudents', { token: tok, rows: [{ hoTen: 'HS Hai', lop: '12A1', ngaySinh: '02/02/2008' }, { hoTen: 'HS Ba', lop: '12A1', ngaySinh: '03/03/2008' }] }));
  const sts = data(call(g, 'adminListStudents', { token: tok }));
  const pins = { 'Học Sinh Mẫu': '0101', 'HS Hai': '0202', 'HS Ba': '0303' };
  const toks = Object.keys(pins).map((n) => data(call(g, 'loginPin', { studentId: sts.find((x) => x.hoTen === n).id, pin: pins[n] }), 'login ' + n).token);
  // 300 bài thi nộp liền nhau (3 học sinh xen kẽ) — phần lớn rơi vào cùng một giây
  const ids = [], secs = {};
  const t0 = Date.now();
  for (let i = 0; i < 300; i++) {
    const t = toks[i % 3];
    const a = data(call(g, 'startExam', { token: t, examId: 'DEMAU' }), 'start');
    const res = data(call(g, 'submitExam', { token: t, attemptToken: a.attemptToken, answers: {} }), 'submit');
    ids.push(res.id); const sec = String(res.id).slice(2, 14); secs[sec] = (secs[sec] || 0) + 1;
  }
  const maxSame = Math.max(...Object.values(secs));
  ok('N-1', `300 bài thi nộp liền nhau (${((Date.now() - t0) / 1000).toFixed(1)} s, tối đa ${maxSame} bài cùng một giây): 300 mã bài khác nhau`, new Set(ids).size === 300, ids.length - new Set(ids).size + ' trùng');
  const kq = g._sheets.KetQua._data(); const hk = kq[0]; const iId = hk.indexOf('Mã bài');
  const sheetIds = kq.slice(1).map((x) => x[iId]);
  ok('N-1', 'cột Mã bài trong KetQua: 300 hàng, không trùng', sheetIds.length === 300 && new Set(sheetIds).size === 300);
  ok('N-1', 'mỗi học sinh mở được đúng bài của mình (mẫu 30 bài)', ids.filter((_, i) => i % 10 === 0).every((id, k) => { const rr = call(g, 'getResult', { token: toks[(k * 10) % 3], resultId: id }); return rr.ok && rr.data.id === id; }));
  // Luyện tập: 60 bài luyện nộp liền nhau
  const lt = [];
  for (let i = 0; i < 60; i++) {
    const t = toks[i % 3];
    const a = call(g, 'practiceStart', { token: t, kieu: 'TU_TAO', chuong: [], bai: ['Bài 9. Định luật Boyle'], so: { TN: 5 }, phut: 10 });
    if (!a.ok) { lt.push('LỖI ' + a.error); continue; }
    const res = call(g, 'submitExam', { token: t, attemptToken: a.data.attemptToken, answers: {} });
    lt.push(res.ok ? res.data.id : 'LỖI ' + res.error);
  }
  ok('N-1', '60 bài luyện tập nộp liền nhau: 60 mã LT khác nhau', lt.every((x) => /^LT/.test(x)) && new Set(lt).size === 60, lt.filter((x) => !/^LT/.test(x)).slice(0, 2).concat([lt[0]]));
  // Mã kiểu cũ: KQ + 15 số (1.0.0) — chép một hàng thật rồi đổi mã; thêm cả hai hàng TRÙNG mã cũ của hai học sinh khác nhau
  const base = kq.find((x, i) => i && x[hk.indexOf('Mã HS')] === sts.find((s0) => s0.hoTen === 'Học Sinh Mẫu').id);
  const other = kq.find((x, i) => i && x[hk.indexOf('Mã HS')] === sts.find((s0) => s0.hoTen === 'HS Hai').id);
  const OLD1 = 'KQ261101101010123', OLDDUP = 'KQ261101101011456';
  const r1 = base.slice(); r1[iId] = OLD1;
  const r2 = base.slice(); r2[iId] = OLDDUP; r2[hk.indexOf('Đề')] = 'bài cũ của Học Sinh Mẫu';
  const r3 = other.slice(); r3[iId] = OLDDUP; r3[hk.indexOf('Đề')] = 'bài cũ của HS Hai';
  kq.splice(1, 0, r3, r1, r2); // hàng của HS Hai đứng TRƯỚC
  Object.keys(g._cache).forEach((k) => delete g._cache[k]);
  const g1 = call(g, 'getResult', { token: toks[0], resultId: OLD1 });
  ok('N-1', 'mã kiểu cũ KQ+15 số mở được (getResult)', g1.ok && g1.data.id === OLD1, g1.error);
  ok('N-1', 'mã kiểu cũ có trong myResults', data(call(g, 'myResults', { token: toks[0] })).some((x) => x.id === OLD1));
  const d0 = call(g, 'getResult', { token: toks[0], resultId: OLDDUP });
  const d1 = call(g, 'getResult', { token: toks[1], resultId: OLDDUP });
  ok('N-1', 'hai bài cũ TRÙNG mã của hai học sinh: mỗi em mở được bài của chính mình', d0.ok && d1.ok && d0.data.tieuDe === 'bài cũ của Học Sinh Mẫu' && d1.data.tieuDe === 'bài cũ của HS Hai', [d0.ok ? d0.data.tieuDe : d0.error, d1.ok ? d1.data.tieuDe : d1.error]);
  // Mã LT kiểu cũ (LT + 12 hex)
  const kl = g._sheets.KetQuaLuyenTap._data(); const hl = kl[0]; const iL = hl.indexOf('Mã bài');
  if (iL >= 0 && kl.length > 1) {
    const rl = kl[1].slice(); rl[iL] = 'LT261101101010' + 'A1B2C3D4E5F6'; kl.push(rl);
    Object.keys(g._cache).forEach((k) => delete g._cache[k]);
    const owner = sts.find((s0) => s0.id === rl[hl.indexOf('Mã HS')]);
    const tk = toks[Object.keys(pins).indexOf(owner.hoTen)];
    const gl = call(g, 'getResult', { token: tk, resultId: rl[iL] });
    ok('N-1', 'mã luyện tập kiểu cũ LT+12 hex mở được', gl.ok, gl.error);
  } else ok('N-1', 'có KetQuaLuyenTap để thử mã LT cũ', false, hl);
  // cache.test chạy nhiều lần
  let bad = 0; const N = +(process.env.CACHE_RUNS || 30);
  for (let i = 0; i < N; i++) if (spawnSync(process.execPath, [path.join(__dirname, 'cache.test.js')], { cwd: ROOT }).status !== 0) bad++;
  ok('N-1', `tests/cache.test.js chạy ${N} lần: 0 lần lỗi`, bad === 0, bad + ' lần lỗi');
}

// =============================================================================================
console.log('\n=== TC-6.5 — quét bí mật ===');
{
  const sc = spawnSync(process.execPath, [path.join(__dirname, 'scan-secrets.js')], { cwd: ROOT, encoding: 'utf8' });
  ok('6.5', 'tests/scan-secrets.js thoát mã 0', sc.status === 0, (sc.stdout + sc.stderr).trim().split('\n').slice(-6).join(' | '));
  save('scan-secrets.txt', sc.stdout + sc.stderr);
  // Quét độc lập: nội dung HEAD của mọi file đang theo dõi + file mới chưa commit (trừ ảnh/nhị phân)
  const sh = (c) => execSync(c, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 });
  const tracked = sh('git ls-tree -r --name-only HEAD').split('\n').filter(Boolean);
  const untracked = sh('git ls-files --others --exclude-standard').split('\n').filter(Boolean);
  const BIN = /\.(png|jpe?g|gif|webp|ico|docx|xlsx|xls|pdf|zip|woff2?|ttf)$/i;
  const SELF = 'tests/pha6-kiem-thu.test.js';
  const RX = [
    ['email', /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g],
    ['chuỗi giống id Drive', /(?<![A-Za-z0-9_-])[A-Za-z0-9_-]{25,60}(?![A-Za-z0-9_-])/g],
    ['mật khẩu kèm giá trị', /(m[ậa]t\s*kh[ẩa]u|password|passwd|MAT_KHAU_QUAN_TRI|ADMIN_PW)[^\n]{0,25}?(?:[:=]|\bl[àa]\b)\s*[`'"]?([^\s`'",;)]{4,})/gi],
    ['PIN 4–8 số', /\bPIN\b[^\n\d]{0,25}(\d{4,8})\b|\bpin\b['"]?\s*[:=]\s*['"]?(\d{4,8})\b/gi]
  ];
  const isIdLike = (m) => /[A-Z]/.test(m) && /[a-z]/.test(m) && /\d/.test(m) && !/^[a-z]+([A-Z][a-z0-9]*)+$/.test(m) && !/[-_]{2}/.test(m);
  const found = [];
  const scanText = (file, src, where) => src.split('\n').forEach((ln, i) => RX.forEach(([kind, re]) => {
    re.lastIndex = 0; let m;
    while ((m = re.exec(ln))) {
      if (kind === 'chuỗi giống id Drive' && !isIdLike(m[0])) continue;
      found.push({ where, file, line: i + 1, kind, m: m[0].slice(0, 80), val: m[2] || m[1] || '', ln });
    }
  }));
  tracked.filter((f) => !BIN.test(f) && f !== SELF).forEach((f) => { let s; try { s = sh(`git show HEAD:"${f}"`); } catch (e) { return; } scanText(f, s, 'HEAD'); });
  untracked.filter((f) => !BIN.test(f) && f !== SELF && fs.existsSync(path.join(ROOT, f))).forEach((f) => scanText(f, fs.readFileSync(path.join(ROOT, f), 'utf8'), 'chưa commit'));
  // Lịch sử: chuỗi giống id Drive bắt đầu bằng "1" (kiểu id thật) trong mọi bản vá đã commit
  const hist = sh('git log -p --all --no-color --format=%H -- . ":(exclude)*.png" ":(exclude)*.docx" ":(exclude)*.xlsx"');
  const histIds = new Set();
  (hist.match(/(?<![A-Za-z0-9_-])1[A-Za-z0-9_-]{24,43}(?![A-Za-z0-9_-])/g) || []).filter(isIdLike).forEach((x) => histIds.add(x));
  const histEmails = new Set(hist.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g) || []);
  // Đánh giá: phân loại phát hiện (sau khi xem tay từng loại)
  const DOC_ID = '160yRH-KzpC_4YMsKrkrZ' + 'iuZjpyrHsJduDwt5QScImHc'; // ghép để chính file này không chứa id
  const verdict = (x) => {
    if (x.kind === 'email') {
      if (/@(example\.(com|org|net)|[\w-]+\.(test|example|invalid))$/i.test(x.m) || x.m === 'noreply@anthropic.com') return 'ok: tên miền ví dụ / ký tên commit';
      if (/\.(js|css|png|gs|json|html|md)$/i.test(x.m) || /@\d/.test(x.m) || /^[\w.-]+@\d+\.\d+/.test(x.m) || /@(fontsource|kurkle|anthropic-ai|types|playwright)\b/.test(x.m)) return 'ok: tên gói npm / phiên bản thư viện (không phải email)';
      return 'XEM';
    }
    if (x.kind === 'chuỗi giống id Drive') {
      if (x.m === DOC_ID) {
        if (['CLAUDE.md', 'docs/QUYET-DINH.md', 'docs/BAN-GIAO.md'].includes(x.file)) return 'ok: id Google Doc quy trình (được phép)';
        if (x.file === 'tests/scan-secrets.js') return 'ok: hằng số của script quét (cùng id đã công khai ở CLAUDE.md)';
        return 'XEM: id Doc quy trình ngoài 3 file được phép';
      }
      if (/^(KHO|KHOGIA|FAKE|GIA)/i.test(x.m) || /(gia|fake|test|mau|xxxx)/i.test(x.m)) return 'ok: id giả trong test';
      const parts = x.m.split(/[-_]/);
      if (parts.length >= 3 && parts.every((p) => p.length <= 12)) return 'ok: tên file/ảnh ghép bằng - hoặc _ (không phải id)';
      return 'XEM';
    }
    if (x.kind === 'mật khẩu kèm giá trị') {
      const v = x.val;
      if (/[(_.<>{}$\\…]/.test(v) || /^(false|true|không|password|current-password|new-password|numeric)$/i.test(v.replace(/[`'"]/g, ''))) return 'ok: mã nguồn / thuộc tính HTML / chữ thường (không phải mật khẩu)';
      if (!(/\d/.test(v) && /[A-Za-z]/.test(v))) return 'ok: không phải chuỗi giống mật khẩu (' + v + ')';
      return 'XEM';
    }
    if (x.kind === 'PIN 4–8 số') {
      const v = x.val;
      if (v === '0101') return 'ok: PIN học sinh mẫu do setup tạo (công khai trong README)';
      if (v === '0000') return 'ok: ví dụ PIN dễ đoán bị chặn';
      if (/-soat\.md$/.test(x.file) && /Bỏ sót|bỏ sót|PIN\[/.test(x.ln)) return 'ok: chuỗi GIẢ người soát dùng để thử script quét';
      if (v.length === 4 && new RegExp(v.slice(0, 2) + '/' + v.slice(2)).test(x.ln)) return 'ok: ví dụ tính PIN từ ngày sinh ghi cùng dòng';
      if (x.file.startsWith('tests/')) return 'ok: PIN học sinh giả trong test';
      return 'XEM';
    }
    return 'XEM';
  };
  found.forEach((x) => { x.v = verdict(x); });
  const review = found.filter((x) => /^XEM/.test(x.v));
  const byKind = {};
  found.forEach((x) => { byKind[x.kind] = byKind[x.kind] || { tong: 0, xem: 0 }; byKind[x.kind].tong++; if (/^XEM/.test(x.v)) byKind[x.kind].xem++; });
  console.log('   tổng phát hiện theo loại:', JSON.stringify(byKind));
  review.forEach((x) => console.log(`   ? ${x.where} ${x.file}:${x.line}  ${x.kind}  ${x.m}`));
  const histIdsBad = [...histIds].filter((x) => x !== DOC_ID && !/(gia|fake|test|xxxx)/i.test(x));
  const histEmailsBad = [...histEmails].filter((x) => !(/@(example\.(com|org|net)|[\w-]+\.(test|example|invalid))$/i.test(x) || x === 'noreply@anthropic.com' || /@\d|\.(js|css|png)$/i.test(x)));
  console.log('   lịch sử: id kiểu "1…" =', [...histIds].length, ' (ngoài id Doc quy trình:', histIdsBad.length + ')', histIdsBad.slice(0, 10).join(' '));
  console.log('   lịch sử: email ngoài tên miền ví dụ =', histEmailsBad.length, histEmailsBad.slice(0, 10).join(' '));
  save('tc65-quet-rieng.json', { byKind, found, histIdsBad, histEmailsBad });
  ok('6.5', `quét riêng (HEAD + file chưa commit, ${tracked.length + untracked.length} file): mọi phát hiện đã được đánh giá là vô hại`, review.length === 0, review.slice(0, 12).map((x) => `${x.file}:${x.line} ${x.kind} ${x.m}`));
  // Lịch sử: chỉ ghi lại (đặc tả: HEAD là đủ) — không tính vào đạt/không đạt
  console.log(`   (thông tin) lịch sử git: ${histIdsBad.length} chuỗi kiểu id Drive thật đã bị xóa khỏi HEAD nhưng còn trong lịch sử; ${histEmailsBad.length} email @gmail.com giả cũ`);
}

// =============================================================================================
save('ket-qua.json', results);
console.log(`\npha6-kiem-thu: ${pass} đạt, ${fail} không đạt (tổng ${pass + fail}).`);
process.exit(fail ? 1 : 0);
