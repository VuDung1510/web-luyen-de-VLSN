// Pha 6 (người làm): phát hành — TC-6.1, 6.3, 6.4 và hàm kiemTraSauTrienKhai() trên gas-shim.
//   node tests/pha6.test.js
const assert = require('assert');
const path = require('path');
const { createContext } = require('./gas-shim');
const K = require('./fixtures/kho-gia');

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.error('  ✗ ' + name + '\n    ' + (e.stack || e).toString().split('\n').slice(0, 5).join('\n    ')); }
}
const ok = (r) => { if (!r.ok) throw new Error('API lỗi: ' + r.error); return r.data; };
const snap = (g) => {
  const o = {};
  Object.keys(g._sheets).forEach((n) => { o[n] = g._sheets[n]._data().map((r) => (r || []).map((v) => (v === undefined || v === null ? '' : v))); });
  return o;
};
const cellAt = (rows, r, c) => { const v = rows[r] && rows[r][c]; return v === undefined || v === null ? '' : v; };
const header = (g, n) => g._sheets[n]._data()[0].map(String);
const OLD_GS = path.join(__dirname, 'fixtures', 'Code-1.0.0.gs');

/* ---------- Sheet giả kiểu cũ 1.0.0 (dữ liệu tự soạn) ---------- */
function oldSheet() {
  const old = createContext({ quiet: true, codePath: OLD_GS });
  old.setup();
  const add = (name, rows) => rows.forEach((r) => old._sheets[name].appendRow(r));
  // HocSinh: thêm 2 học sinh giả + giáo viên tự thêm 1 cột riêng ở cuối
  const hs = old._sheets.HocSinh._data();
  hs[0].push('Ghi chú riêng của thầy');
  hs[1].push('ngồi bàn đầu');
  add('HocSinh', [['HS0002', 'Học Sinh Thử Hai', '12A2', '15/03/2008', '', '', 'HOAT_DONG', '2026-01-02T00:00:00.000Z', ''],
    ['HS0003', 'Học Sinh Thử Ba', '11B1', '20/10/2009', '', '', 'KHOA', '2026-01-03T00:00:00.000Z', 'chuyển lớp']]);
  // KetQua 1.0.0: KHÔNG có cột "Mục tiêu"; số lưu dạng số
  add('KetQua', [
    ['2026-02-01T08:00:00.000Z', 'Học Sinh Mẫu', '12A1', 'Đề mẫu — Vật lý 12 (6 câu)', 7.5, 1.85, 2.5, 4, 6, '12 phút 5 giây', '[+] Tốt', 'KQ0001', 'HS0001', 'DEMAU', '2026-02-01T07:48:00.000Z', 725, '', '{"1":"C"}'],
    ['2026-02-02T09:00:00.000Z', 'Học Sinh Thử Hai', '12A2', 'Đề mẫu — Vật lý 12 (6 câu)', 4.25, 1.05, 2.5, 2, 6, '9 phút', '[-] Cần cố gắng', 'KQ0002', 'HS0002', 'DEMAU', '2026-02-02T08:51:00.000Z', 540, 'Nộp trễ', '{}']]);
  // CaiDat: giáo viên đã sửa vài giá trị
  const cd = old._sheets.CaiDat._data();
  cd.find((r) => r[0] === 'TEN_UNG_DUNG')[1] = 'Luyện đề Vật lý — Trung tâm';
  cd.find((r) => r[0] === 'HIEN_BANG_XEP_HANG')[1] = 'KHONG';
  // giáo viên có thêm một trang tính riêng
  old.SpreadsheetApp.getActiveSpreadsheet().insertSheet('BangDiemRieng')._setData([['Tên', 'Điểm'], ['A', 9]]);
  return old;
}
/** Chép mọi trang tính của Sheet cũ sang một gas-shim chạy Code.gs mới (như giáo viên dán code mới vào cùng file). */
function upgrade(old) {
  const g = createContext({ quiet: true });
  const ss = g.SpreadsheetApp.getActiveSpreadsheet();
  old.SpreadsheetApp.getActiveSpreadsheet().getSheets().forEach((sh) => ss.insertSheet(sh.getName())._setData(sh._data()));
  Object.assign(g._props, old._props);
  return g;
}

const old = oldSheet();
const before = snap(old);
const g = upgrade(old);
assert.deepStrictEqual(snap(g), before);
g.setup();
const after1 = snap(g);

console.log('Pha 6 — phát hành:');

t('TC-6.1 APP_VERSION 1.5.0; doGet, publicConfig, bootstrap trả đúng phiên bản và đủ features', () => {
  assert.strictEqual(g.APP_VERSION, '1.5.0');
  const d = JSON.parse(g.doGet().getContent()).data;
  assert.strictEqual(d.version, '1.5.0');
  const p = ok(g.call('publicConfig'));
  assert.strictEqual(p.version, '1.5.0');
  assert.deepStrictEqual(p.features.slice().sort(), ['bank', 'bootstrap', 'cache', 'changePin', 'goal', 'practice']);
  const tok = ok(g.call('loginPin', { studentId: 'HS0001', pin: '0101' })).token;
  assert.strictEqual(ok(g.call('bootstrap', { token: tok })).v, '1.5.0');
  // appsscript.json: không khai oauthScopes; setup() không tạo trigger
  const manifest = require('../apps-script/appsscript.json');
  assert.ok(!('oauthScopes' in manifest), 'appsscript.json không được có oauthScopes');
  const code = require('fs').readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8');
  assert.ok(!/ScriptApp\.newTrigger|ScriptApp\.getProjectTriggers/.test(code), 'Code.gs không tạo trigger');
});

t('TC-6.3 setup() trên Sheet kiểu cũ 1.0.0: mọi ô cũ giữ nguyên, không mất hàng/cột, chỉ thêm', () => {
  let cells = 0;
  Object.keys(before).forEach((n) => {
    assert.ok(after1[n], 'mất trang tính ' + n);
    before[n].forEach((row, r) => row.forEach((v, c) => {
      cells++;
      assert.strictEqual(cellAt(after1[n], r, c), v, `${n} ô (${r + 1},${c + 1}) đổi từ ${JSON.stringify(v)} thành ${JSON.stringify(cellAt(after1[n], r, c))}`);
    }));
    const oldRows = before[n].filter((r) => r.some((v) => v !== '')).length;
    const newRows = after1[n].filter((r) => r.some((v) => v !== '')).length;
    if (n === 'CaiDat') assert.ok(newRows > oldRows, 'CaiDat phải thêm dòng mới');
    else assert.strictEqual(newRows, oldRows, n + ': số hàng đổi');
  });
  assert.ok(cells > 100, 'đã so ' + cells + ' ô');
  // cột mới thêm vào CUỐI hàng tiêu đề, sau cả cột riêng của giáo viên
  assert.deepStrictEqual(header(g, 'KetQua').slice(18), ['Mục tiêu']);
  assert.deepStrictEqual(header(g, 'CauHoi').slice(16), ['Mã câu kho', 'Chương', 'Bài', 'Mức độ từng ý', 'Nguồn']);
  assert.strictEqual(header(g, 'HocSinh')[8], 'Ghi chú riêng của thầy');
  // trang tính mới
  ['LuyenTap', 'KetQuaLuyenTap'].forEach((n) => assert.ok(g._sheets[n], 'thiếu ' + n));
  assert.ok(g._sheets.BangDiemRieng, 'trang riêng của giáo viên phải còn');
  // CaiDat: thêm đủ dòng mới, giữ giá trị giáo viên đã sửa
  const cd = g.readTable_('CaiDat');
  ['KHO_CAU_HOI_ID', 'THU_MUC_HINH_KHO_ID', 'CHO_LUYEN_TAP', 'LUYEN_NHANH'].forEach((k) => assert.ok(cd.some((r) => r.khoa === k), 'thiếu ' + k));
  assert.strictEqual(cd.find((r) => r.khoa === 'TEN_UNG_DUNG').giaTri, 'Luyện đề Vật lý — Trung tâm');
  // không gieo thêm học sinh / đề mẫu
  assert.strictEqual(g._sheets.HocSinh.getLastRow(), 4);
  assert.strictEqual(g._sheets.DeThi.getLastRow(), 2);
  // dữ liệu cũ vẫn đọc được qua máy chủ mới: kết quả cũ không có mục tiêu
  const kq = g.readTable_('KetQua');
  assert.strictEqual(kq.length, 2);
  assert.strictEqual(+kq[0].diem, 7.5);
  assert.ok(kq.every((r) => r.mucTieu === '' || r.mucTieu == null));
});

t('TC-6.4 setup() chạy lần 2: không thêm gì (không trùng hàng CaiDat, trang tính, cột); KetQuaLuyenTap cùng định dạng số với KetQua', () => {
  g.setup();
  const after2 = snap(g);
  assert.deepStrictEqual(after2, after1, 'lần chạy thứ 2 không được đổi ô nào');
  const names = g.SpreadsheetApp.getActiveSpreadsheet().getSheets().map((s) => s.getName());
  assert.strictEqual(new Set(names).size, names.length, 'trang tính trùng: ' + names.join(','));
  Object.keys(g.SCHEMA).forEach((n) => {
    const h = header(g, n).filter(Boolean);
    assert.strictEqual(new Set(h).size, h.length, n + ' có cột trùng');
  });
  const keys = g.readTable_('CaiDat').map((r) => r.khoa);
  assert.strictEqual(new Set(keys).size, keys.length, 'CaiDat có dòng trùng');
  const fmt = (n) => {
    const f = g._sheets[n]._formats(), h = header(g, n);
    return JSON.parse(JSON.stringify(g.RESULT_NUMBER_FORMATS.map((p) => [p[0], f['2,' + (h.indexOf(g.labelOf_(n, p[0])) + 1)]])));
  };
  const a = fmt('KetQua'), b = fmt('KetQuaLuyenTap');
  assert.deepStrictEqual(b, a);
  assert.ok(a.every((p) => p[1] && p[1] !== '@'), JSON.stringify(a));
  // trang tạo tự động khi ghi lần đầu (không qua setup) cũng cùng định dạng
  const g2 = createContext({ quiet: true });
  g2.setup();
  g2.SpreadsheetApp.getActiveSpreadsheet().deleteSheet(g2._sheets.KetQuaLuyenTap);
  g2.sheet_('KetQuaLuyenTap');
  const f2 = g2._sheets.KetQuaLuyenTap._formats(), h2 = header(g2, 'KetQuaLuyenTap');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(g2.RESULT_NUMBER_FORMATS.map((p) => [p[0], f2['2,' + (h2.indexOf(g2.labelOf_('KetQuaLuyenTap', p[0])) + 1)]]))), a);
});

t('kiemTraSauTrienKhai: Sheet đã setup, chưa có kho → 0 lỗi, có lưu ý kho; chỉ đọc (không ghi trang tính, đệm không còn khóa thử)', () => {
  const s0 = snap(g);
  const cache0 = Object.keys(g._cache).filter((k) => g._cache[k].exp > Date.now()).sort();
  g._resetStats();
  g.__MEMO();
  const r = g.kiemTraSauTrienKhai();
  assert.strictEqual(r.loi, 0, r.dong.join('\n'));
  assert.ok(r.dong[0].indexOf('1.5.0') >= 0 && r.dong[0].indexOf('practice') >= 0, r.dong[0]);
  assert.ok(r.dong.some((d) => /Chưa có KHO_CAU_HOI_ID/.test(d)));
  assert.ok(r.dong.some((d) => /CacheService\): ghi\/đọc thử được/.test(d)));
  assert.ok(/Phiên bản máy chủ 1\.5\.0/.test(r.dong[r.dong.length - 1]));
  assert.deepStrictEqual(snap(g), s0, 'không được sửa trang tính');
  assert.deepStrictEqual(g._stats.writes, {}, 'không ghi: ' + JSON.stringify(g._stats.writes));
  const cache1 = Object.keys(g._cache).filter((k) => g._cache[k].exp > Date.now()).sort();
  assert.deepStrictEqual(cache1, cache0, 'đệm phải như cũ (khóa thử đã xóa, không cất bảng)');
  // không in mật khẩu
  const pw = g.readTable_('CaiDat').find((x) => x.khoa === 'MAT_KHAU_QUAN_TRI').giaTri;
  assert.ok(pw && r.dong.join('\n').indexOf(pw) < 0, 'không được in mật khẩu');
});

t('kiemTraSauTrienKhai: có kho giả và thư mục hình → mở được kho, 0 lần ghi vào kho', () => {
  const g3 = createContext({ quiet: true });
  g3.setup();
  const kho = K.install(g3);
  g3._resetStats();
  const r = g3.kiemTraSauTrienKhai();
  assert.strictEqual(r.loi, 0, r.dong.join('\n'));
  assert.ok(r.dong.some((d) => /Mở được kho câu hỏi: trang "Kho câu hỏi" có \d+ hàng/.test(d)), r.dong.join('\n'));
  assert.ok(r.dong.some((d) => /Mở được thư mục hình của kho: "02\. HÌNH VẼ"/.test(d)));
  assert.ok(r.dong.join('\n').indexOf(kho.khoId) < 0, 'không in id kho');
  assert.deepStrictEqual(g3._stats.extWrites, {});
  assert.deepStrictEqual(g3._stats.writes, {});
  // id kho sai → báo lỗi rõ, không ném ra ngoài
  K.setSetting(g3, { KHO_CAU_HOI_ID: 'KHONG_CO_FILE_NAY' });
  const r2 = g3.kiemTraSauTrienKhai();
  assert.strictEqual(r2.loi, 1, r2.dong.join('\n'));
  assert.ok(r2.dong.some((d) => /^❌ Kho câu hỏi: Không mở được kho/.test(d)));
});

t('kiemTraSauTrienKhai: Sheet cũ 1.0.0 chưa chạy setup → báo thiếu trang tính/cột/dòng CaiDat, không tự sửa', () => {
  const g4 = upgrade(oldSheet());
  const s0 = snap(g4);
  const r = g4.kiemTraSauTrienKhai();
  const all = r.dong.join('\n');
  assert.ok(r.loi >= 4, all);
  assert.ok(/Thiếu trang tính "LuyenTap"/.test(all) && /Thiếu trang tính "KetQuaLuyenTap"/.test(all), all);
  assert.ok(/KetQua: thiếu cột "Mục tiêu"/.test(all), all);
  assert.ok(/CauHoi: thiếu cột "Mã câu kho"/.test(all), all);
  assert.ok(/CaiDat thiếu dòng: .*KHO_CAU_HOI_ID/.test(all), all);
  assert.ok(/CÓ \d+ LỖI/.test(r.dong[r.dong.length - 1]));
  assert.deepStrictEqual(snap(g4), s0, 'không được sửa trang tính');
  assert.ok(!g4._sheets.LuyenTap);
});

t('kiemTraSauTrienKhai: CaiDat có dòng trùng khóa → lưu ý', () => {
  const g5 = createContext({ quiet: true });
  g5.setup();
  g5._sheets.CaiDat._data().push(['CHO_LUYEN_TAP', 'CO', '']);
  const r = g5.kiemTraSauTrienKhai();
  assert.strictEqual(r.loi, 0);
  assert.ok(r.dong.some((d) => /^⚠️ CaiDat có dòng trùng khóa: CHO_LUYEN_TAP/.test(d)), r.dong.join('\n'));
});

t('TC-6.5 tests/scan-secrets.js: repo sạch (mật khẩu, PIN, email, id file Drive)', () => {
  const out = require('child_process').execSync('node ' + JSON.stringify(path.join(__dirname, 'scan-secrets.js')), { encoding: 'utf8' });
  assert.ok(/sạch — \d+ file, 0 phát hiện/.test(out), out);
});

t('Vòng 2 (R-1, R-4): scan-secrets bắt đủ mẫu cài sẵn, không báo nhầm "ADMIN_PW=<…>", backtick, regex', () => {
  const fs = require('fs');
  const f = path.join(__dirname, '..', 'zz-scan-thu.md');
  // mẫu vi phạm GIẢ, mã hóa base64 để chính file này không bị quét ra
  const bad = Buffer.from('UElOIGPhu6dhIGVtIGzDoCAxNTAzCnBpbiByacOqbmc6IDI4MDcKQURNSU5fUFc9IkFiYzEyMzQ1IiBub2RlIHgKY29uc3QgcHcgPSBwcm9jZXNzLmVudi5BRE1JTl9QVyB8fCAnbWF0a2hhdTEnOwpBRE1JTl9QVz1hYmMxMjMgbm9kZQppZCAwQnhZekFiQ2RFZkdoSWpLbE1uT3BRclN0VXZXMTIKcGluOiAnMTIzNCcKdGhheS50aGF0QGdtYWlsLmNvbQoxQWJDZEVmR2hJaktsTW5PcFFyU3RVdld4WXowMTIzNDU2Nzg5Ck3huq10IGto4bqpdSBxdeG6o24gdHLhu4s6IFh5MTJhYjM0', 'base64').toString('utf8').split('\n');
  const good = ['ADMIN_PW=<mật khẩu> node', 'ADMIN_PW=`x`', 'ADMIN_PW=(?![<$])\\S+', 'ADMIN_PW=$PW', 'nhập PIN 0101', 'hs@example.com'];
  fs.writeFileSync(f, bad.concat(good).join('\n') + '\n');
  let out = '';
  try { require('child_process').execSync('node ' + JSON.stringify(path.join(__dirname, 'scan-secrets.js')), { encoding: 'utf8' }); }
  catch (e) { out = String(e.stdout); } finally { fs.unlinkSync(f); }
  const lines = out.split('\n').filter((l) => l.indexOf('zz-scan-thu.md:') >= 0).map((l) => +l.split(':')[1].split(' ')[0]);
  assert.deepStrictEqual([...new Set(lines)].sort((a, b) => a - b), bad.map((_, i) => i + 1), out);
});

console.log(failed ? `pha6.test: ${failed} KHÔNG ĐẠT / ${passed + failed}` : `pha6.test: ${passed}/${passed} đạt`);
process.exit(failed ? 1 : 0);
