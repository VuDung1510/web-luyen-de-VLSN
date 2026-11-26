// Test Pha 7a (người làm) — Sổ tay cá nhân, phần máy chủ. node tests/pha7.test.js
// Câu hỏi tự soạn, không chứa nội dung kho/đề thật.
const assert = require('assert');
const { createContext } = require('./gas-shim');
const K = require('./fixtures/kho-gia');

let passed = 0, failed = 0;
function t(name, fn) {
  if (process.env.ONLY && !name.includes(process.env.ONLY)) return;
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.error('  ✗ ' + name + '\n    ' + (e.stack || e).split('\n').slice(0, 6).join('\n    ')); process.exitCode = 1; }
}
function ok(r) { if (!r.ok) throw new Error('API lỗi: ' + r.error); return r.data; }
function err(r) { assert.ok(!r.ok, 'lẽ ra phải lỗi'); return r.error; }
const pwOf = (g) => g._sheets.CaiDat._data().find((r) => r[0] === 'MAT_KHAU_QUAN_TRI')[1];
const clearCache = (g) => Object.keys(g._cache).forEach((k) => delete g._cache[k]);

function world(opts = {}) {
  const g = createContext({ quiet: true });
  g.setup();
  const w = { g };
  if (opts.kho) { K.install(g, {}); K.setSetting(g, { CHO_LUYEN_TAP: 'CO' }); }
  w.tTok = ok(g.call('loginAdminPassword', { password: pwOf(g) })).token;
  w.sTok = ok(g.call('loginPin', { studentId: 'HS0001', pin: '0101' })).token;
  w.call = (a, b, tok) => g.call(a, Object.assign({ token: tok || w.sTok }, b || {}));
  w.nb = (tok) => ok(w.call('notebook', {}, tok));
  w.item = (keys, tok) => ok(w.call('notebookItem', { keys }, tok)).items;
  return w;
}

const CH = 'Chương I. Dao động', BAI = 'Bài 2. Con lắc đơn';
const TN = (n, extra) => Object.assign({ loai: 'TN', noiDung: 'Câu TN tự soạn ' + n, A: 'a', B: 'b', C: 'c', D: 'd', dapAn: 'A', loiGiai: 'Lời giải ' + n, chuong: CH, bai: BAI, mucDo: 'TH' }, extra || {});
const TL = (n, dapAn, extra) => Object.assign({ loai: 'TL', noiDung: 'Câu TL tự soạn ' + n, dapAn, loiGiai: 'Giải TL ' + n, chuong: 'Chương II. Sóng', bai: 'Bài 5. Sóng cơ', mucDo: 'VD' }, extra || {});
const DS = (n) => ({ loai: 'DS', noiDung: 'Câu Đ/S tự soạn ' + n, A: 'ý a', B: 'ý b', C: 'ý c', D: 'ý d', dapAn: 'DSDS', loiGiai: 'Giải ĐS ' + n, chuong: CH, bai: 'Bài 3. Sóng dừng' });

function saveExam(w, exam, qs, id) {
  return ok(w.g.call('adminSaveExam', { token: w.tTok, exam: Object.assign({ id, tieuDe: 'Đề thử sổ tay', thoiGian: 15 }, exam), questions: qs })).id;
}
function doExam(w, eid, answers, extra, tok) {
  const s = ok(w.g.call('startExam', { token: tok || w.sTok, examId: eid, mucTieu: 5 }));
  return ok(w.g.call('submitExam', Object.assign({ token: tok || w.sTok, attemptToken: s.attemptToken, answers: answers || {} }, extra || {})));
}
const fmt = (ms) => { const d = new Date(ms + 7 * 3600e3); const p = (n) => String(n).padStart(2, '0'); return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`; };
/** Đặt "Nộp lúc" của hàng kết quả thứ i (tính từ 1, không kể tiêu đề) lùi về `daysAgo` ngày. */
function backdate(w, sheet, i, daysAgo) {
  const rows = w.g._sheets[sheet]._data();
  rows[i][rows[0].indexOf('Nộp lúc')] = fmt(Date.now() - daysAgo * 86400e3);
  clearCache(w.g);
}
const byStt = (nb, eid, stt) => nb.items.find((x) => x.nguon.examId === eid && x.nguon.stt === stt);

console.log('Sổ tay cá nhân (Pha 7a) — máy chủ:');

t('features có "notebook"; APP_VERSION 1.6.0; setup tạo SoTay, CongThuc và 2 khóa CaiDat (chạy lại an toàn); publicConfig.notebook mặc định bật', () => {
  const w = world();
  const p = ok(w.g.call('publicConfig'));
  assert.ok(p.features.includes('notebook'));
  assert.strictEqual(p.version, '1.6.0');
  assert.strictEqual(p.notebook, true);
  w.g.setup();
  assert.deepStrictEqual(JSON.parse(JSON.stringify(w.g._sheets.SoTay._data()[0])), JSON.parse(JSON.stringify(w.g.SCHEMA.SoTay.map((d) => d[1]))));
  assert.deepStrictEqual(JSON.parse(JSON.stringify(w.g._sheets.CongThuc._data()[0])), JSON.parse(JSON.stringify(w.g.SCHEMA.CongThuc.map((d) => d[1]))));
  const keys = w.g._sheets.CaiDat._data().map((r) => r[0]);
  assert.strictEqual(keys.filter((k) => k === 'BAT_SO_TAY').length, 1);
  assert.strictEqual(keys.filter((k) => k === 'TU_KHOA_DOC_SAI').length, 1);
});

t('TC-7.1 liệt kê mọi câu từng sai, gộp theo khóa; màu đỏ → vàng → xanh (đúng 2 lần ở 2 ngày khác nhau); sai lại thì về đỏ', () => {
  const w = world();
  const e = saveExam(w, { trangThai: 'MO', hienLoiGiai: 'NGAY' }, [TN(1), TN(2), TN(3), TN(4)]);
  doExam(w, e, { 1: 'B', 2: 'B', 3: 'B', 4: 'A' }); // sai 1, 2, 3
  backdate(w, 'KetQua', 1, 3);
  doExam(w, e, { 1: 'A', 2: 'A', 3: 'B', 4: 'A' }); // câu 1, 2 đúng lại; câu 3 sai tiếp
  backdate(w, 'KetQua', 2, 2);
  doExam(w, e, { 1: 'A', 2: 'B', 3: 'A', 4: 'A' }); // câu 1 đúng ngày thứ 2; câu 2 sai lại; câu 3 đúng 1 lần
  const nb = w.nb();
  assert.strictEqual(nb.items.length, 3, 'câu 4 chưa từng sai thì không có');
  assert.deepStrictEqual(nb.items.map((x) => x.nguon.stt).sort(), [1, 2, 3]);
  assert.strictEqual(byStt(nb, e, 1).mau, 'xanh');
  assert.strictEqual(byStt(nb, e, 2).mau, 'do', 'sai lại thì về đỏ');
  assert.strictEqual(byStt(nb, e, 3).mau, 'vang');
  assert.strictEqual(byStt(nb, e, 2).lanSai, 2);
  assert.strictEqual(byStt(nb, e, 3).lanSai, 2);
  assert.strictEqual(nb.tongHop.tong, 3);
  assert.strictEqual(nb.tongHop.chuaKhacPhuc, 1);
  // hai lần đúng trong cùng một ngày: vẫn vàng
  const e2 = saveExam(w, { trangThai: 'MO', hienLoiGiai: 'NGAY' }, [TN(9)]);
  doExam(w, e2, { 1: 'C' });
  backdate(w, 'KetQua', 4, 5);
  doExam(w, e2, { 1: 'A' });
  doExam(w, e2, { 1: 'A' });
  assert.strictEqual(byStt(w.nb(), e2, 1).mau, 'vang');
});

t('TC-7.1 dữ liệu cũ (chiTiet không có t) vẫn đọc được; sắp theo thời gian dù hàng không theo thứ tự', () => {
  const w = world();
  const e = saveExam(w, { trangThai: 'MO', hienLoiGiai: 'NGAY' }, [TN(1)]);
  doExam(w, e, { 1: 'A' }); // đúng (hàng 1)
  doExam(w, e, { 1: 'B' }); // sai (hàng 2)
  // hàng 1 (đúng) thật ra nộp SAU hàng 2 → câu đã đúng lại
  backdate(w, 'KetQua', 2, 4);
  const rows = w.g._sheets.KetQua._data();
  const c = rows[0].indexOf('Chi tiết (JSON)');
  rows.slice(1).forEach((r) => { r[c] = JSON.stringify(JSON.parse(r[c]).map((d) => { delete d.t; delete d.h; return d; })); });
  clearCache(w.g);
  const it = byStt(w.nb(), e, 1);
  assert.strictEqual(it.mau, 'vang');
});

t('TC-7.2 notebook không có nội dung/đáp án/lời giải; notebookItem của đề đang mở: có nội dung + câu trả lời, KHÔNG có đáp án/lời giải; đóng đề thì có', () => {
  const w = world();
  const qs = [TN(1), TL(2, '25')];
  const e = saveExam(w, { trangThai: 'MO', hienLoiGiai: 'NGAY' }, qs);
  doExam(w, e, { 1: 'C', 2: '0,25' });
  const nb = w.nb();
  const raw = JSON.stringify(nb);
  ['noiDung', 'dapAn', 'loiGiai', '_ref', '_src', 'Câu TN tự soạn', 'Lời giải'].forEach((k) => assert.ok(!raw.includes(k), 'notebook lộ ' + k));
  // máy không đoán "lệch 10ⁿ" khi đề chưa công bố (tránh lộ đáp án)
  assert.strictEqual(byStt(nb, e, 2).loi.ma, 'CHUA_RO');
  assert.strictEqual(byStt(nb, e, 2).congBo, false);
  const keys = nb.items.map((x) => x.key);
  let its = w.item(keys);
  its.forEach((x) => {
    assert.ok(x.noiDung && !('dapAn' in x) && !('loiGiai' in x), JSON.stringify(x));
    assert.strictEqual(x.an, true);
  });
  assert.strictEqual(its.find((x) => x.loai === 'TN').answer, 'C');
  assert.strictEqual(its.find((x) => x.loai === 'TL').answer, '0,25');
  saveExam(w, { trangThai: 'DONG', hienLoiGiai: 'NGAY' }, qs, e);
  clearCache(w.g);
  its = w.item(keys);
  assert.strictEqual(its.find((x) => x.loai === 'TN').dapAn, 'A');
  assert.strictEqual(its.find((x) => x.loai === 'TL').loiGiai, 'Giải TL 2');
  its.forEach((x) => assert.ok(!x.an));
  const nb2 = w.nb();
  assert.strictEqual(byStt(nb2, e, 2).loi.ma, 'TINH_TOAN', 'đề đã công bố: máy đoán được');
  // đề đóng nhưng KHÔNG cho xem lời giải: vẫn ẩn
  saveExam(w, { trangThai: 'DONG', hienLoiGiai: 'KHONG' }, qs, e);
  clearCache(w.g);
  w.item(keys).forEach((x) => assert.ok(x.an && !('dapAn' in x)));
});

t('TC-7.3 máy đoán: lệch 10ⁿ → đơn vị (chắc); lệch nhỏ / ngược dấu → bấm máy (hỏi); bỏ trống → sót (chắc); Đ/S sai 1 ý → sót (hỏi); Phần I sai → chưa phân loại', () => {
  const w = world();
  const qs = [TL(1, '25'), TL(2, '2,5'), TL(3, '180'), TL(4, '7'), DS(5), DS(6), TN(7), TL(8, '3')];
  const e = saveExam(w, { trangThai: 'MO', hienLoiGiai: 'NGAY' }, qs);
  doExam(w, e, { 1: '0,25', 2: '2,48', 3: '-180', 4: '', 5: ['D', 'S', 'D', 'D'], 6: ['D', 'S', '', 'S'], 7: 'B', 8: '40' });
  saveExam(w, { trangThai: 'DONG', hienLoiGiai: 'NGAY' }, qs, e);
  clearCache(w.g);
  const nb = w.nb();
  const L = (s) => byStt(nb, e, s).loi;
  assert.deepStrictEqual(L(1), { ma: 'TINH_TOAN', nguon: 'MAY', canHoi: false, y: 'DON_VI' });
  assert.deepStrictEqual(L(2), { ma: 'TINH_TOAN', nguon: 'MAY', canHoi: true, y: 'BAM_MAY' });
  assert.deepStrictEqual(L(3), { ma: 'TINH_TOAN', nguon: 'MAY', canHoi: true, y: 'BAM_MAY' });
  assert.deepStrictEqual(L(4), { ma: 'SOT', nguon: 'MAY', canHoi: false });
  assert.deepStrictEqual(L(5), { ma: 'SOT', nguon: 'MAY', canHoi: true });
  assert.deepStrictEqual(L(6), { ma: 'SOT', nguon: 'MAY', canHoi: false }, 'còn ý để trống');
  assert.deepStrictEqual(L(7), { ma: 'CHUA_RO', nguon: '', canHoi: false });
  assert.deepStrictEqual(L(8), { ma: 'CHUA_RO', nguon: '', canHoi: false }, 'lệch lớn, không phải 10ⁿ');
});

t('TC-7.3 bỏ trống được nhận ra cả khi đề CHƯA công bố (không cần đáp án)', () => {
  const w = world();
  const e = saveExam(w, { trangThai: 'MO', hienLoiGiai: 'SAU_HAN' }, [TN(1), TL(2, '5')]);
  doExam(w, e, {});
  const nb = w.nb();
  assert.strictEqual(byStt(nb, e, 1).loi.ma, 'SOT');
  assert.strictEqual(byStt(nb, e, 2).loi.ma, 'SOT');
});

t('TC-7.4 "Lặp lại": 3 câu đỏ cùng loại ở 1 đề → vàng; thêm câu ở đề thứ 2 → đỏ + lặp lại; tỉ lệ cộng đủ 100%', () => {
  const w = world();
  const e1 = saveExam(w, { trangThai: 'DONG', hienLoiGiai: 'NGAY' }, [TL(1, '2'), TL(2, '3'), TL(3, '4'), TN(4)]);
  saveExam(w, { trangThai: 'MO', hienLoiGiai: 'NGAY' }, [TL(1, '2'), TL(2, '3'), TL(3, '4'), TN(4)], e1);
  doExam(w, e1, { 1: '200', 2: '300', 3: '400', 4: 'B' });
  saveExam(w, { trangThai: 'DONG', hienLoiGiai: 'NGAY' }, [TL(1, '2'), TL(2, '3'), TL(3, '4'), TN(4)], e1);
  clearCache(w.g);
  let s = w.nb().tongHop.saiNgoo.find((x) => x.ma === 'TINH_TOAN');
  assert.strictEqual(s.so, 3);
  assert.strictEqual(s.mau, 'vang');
  assert.strictEqual(s.lapLai, false);
  const e2 = saveExam(w, { trangThai: 'MO', hienLoiGiai: 'NGAY' }, [TL(9, '5')]);
  doExam(w, e2, { 1: '0,5' });
  saveExam(w, { trangThai: 'DONG', hienLoiGiai: 'NGAY' }, [TL(9, '5')], e2);
  clearCache(w.g);
  const nb = w.nb();
  s = nb.tongHop.saiNgoo.find((x) => x.ma === 'TINH_TOAN');
  assert.strictEqual(s.so, 4);
  assert.strictEqual(s.mau, 'do');
  assert.strictEqual(s.lapLai, true);
  assert.strictEqual(nb.tongHop.lapLai, 1);
  assert.strictEqual(nb.tongHop.tiLe.reduce((a, x) => a + x.so, 0), nb.tongHop.tong);
  // câu Phần I sai, chưa phân loại → nằm trong bản đồ Hổng kiến thức theo chương
  assert.strictEqual(nb.tongHop.hongKT.so, 1);
  assert.strictEqual(nb.tongHop.hongKT.chuaRo, 1);
  assert.strictEqual(nb.tongHop.hongKT.chuong[0].chuong, CH);
  assert.strictEqual(nb.tongHop.hongKT.chuong[0].bai[0].bai, BAI);
});

t('TC-7.5 học sinh khác không xem được câu của em; sổ tay của học sinh B trống', () => {
  const w = world();
  const e = saveExam(w, { trangThai: 'MO', hienLoiGiai: 'NGAY' }, [TN(1)]);
  doExam(w, e, { 1: 'B' });
  const key = w.nb().items[0].key;
  const s2 = ok(w.g.call('adminSaveStudent', { token: w.tTok, student: { hoTen: 'Học Sinh Thử', lop: '12A1', ngaySinh: '05/03/2008' } }));
  const tok2 = ok(w.g.call('loginPin', { studentId: s2.id, pin: '0503' })).token; // PIN mẫu của README
  assert.strictEqual(w.nb(tok2).items.length, 0);
  assert.ok(/không có trong sổ tay/.test(err(w.call('notebookItem', { keys: [key] }, tok2))));
  assert.ok(/không có trong sổ tay/.test(err(w.call('notebookItem', { keys: ['ABC#1'] }))));
  assert.ok(/dành cho học sinh/.test(err(w.call('notebook', {}, w.tTok))));
  assert.ok(/tối đa 20/.test(err(w.call('notebookItem', { keys: Array.from({ length: 21 }, (_, i) => 'K' + i) }))));
});

t('TC-7.7 BAT_SO_TAY = KHONG: notebook, notebookItem báo lỗi ở máy chủ; publicConfig.notebook = false', () => {
  const w = world();
  ok(w.g.call('adminSaveSettings', { token: w.tTok, settings: { BAT_SO_TAY: 'KHONG' } }));
  clearCache(w.g);
  assert.strictEqual(ok(w.g.call('publicConfig')).notebook, false);
  assert.ok(/tắt sổ tay/.test(err(w.call('notebook'))));
  assert.ok(/tắt sổ tay/.test(err(w.call('notebookItem', { keys: ['x'] }))));
  ok(w.g.call('adminSaveSettings', { token: w.tTok, settings: { BAT_SO_TAY: 'CO' } }));
  clearCache(w.g);
  assert.strictEqual(w.nb().items.length, 0);
});

t('TC-7.8 Sheet cũ chưa có SoTay, CongThuc (và chưa có khóa BAT_SO_TAY): sổ tay vẫn chạy, chỉ đọc thì không tạo trang', () => {
  const w = world();
  const e = saveExam(w, { trangThai: 'MO', hienLoiGiai: 'NGAY' }, [TN(1)]);
  doExam(w, e, { 1: 'B' });
  const ss = w.g.SpreadsheetApp.getActiveSpreadsheet();
  ['SoTay', 'CongThuc'].forEach((n) => ss.deleteSheet(ss.getSheetByName(n)));
  const cd = w.g._sheets.CaiDat._data();
  cd.splice(cd.findIndex((r) => r[0] === 'BAT_SO_TAY'), 1);
  clearCache(w.g);
  assert.strictEqual(ok(w.g.call('publicConfig')).notebook, true, 'thiếu khóa thì coi là bật');
  const nb = w.nb();
  assert.strictEqual(nb.items.length, 1);
  const it = w.item([nb.items[0].key])[0];
  assert.deepStrictEqual(it.congThuc, []);
  assert.ok(!w.g._sheets.SoTay && !w.g._sheets.CongThuc, 'đường đọc không được tạo trang tính');
});

t('Thời gian trả lời t: lưu số giây hợp lệ (0 … thời gian làm), bỏ giá trị âm / quá lớn / không phải số', () => {
  const w = world();
  const e = saveExam(w, { trangThai: 'MO', hienLoiGiai: 'NGAY' }, [TN(1), TN(2), TN(3), TN(4), TN(5)]);
  doExam(w, e, { 1: 'A', 2: 'B' }, { times: { 1: 0, 2: -5, 3: 99999, 4: 'abc', 5: true } });
  const rows = w.g._sheets.KetQua._data();
  const d = JSON.parse(rows[1][rows[0].indexOf('Chi tiết (JSON)')]);
  assert.strictEqual(d[0].t, 0);
  [1, 2, 3, 4].forEach((i) => assert.ok(!('t' in d[i]), 'câu ' + (i + 1) + ' không được có t'));
  doExam(w, e, {}, { times: 'xx' });
  doExam(w, e, {}); // máy khách cũ không gửi times
});

t('Câu nhập tay bị sửa sau khi làm → daSua; câu bị gỡ khỏi đề → go; vẫn còn trong sổ tay', () => {
  const w = world();
  const e = saveExam(w, { trangThai: 'MO', hienLoiGiai: 'NGAY' }, [TN(1), TN(2)]);
  doExam(w, e, { 1: 'B', 2: 'B' });
  saveExam(w, { trangThai: 'DONG', hienLoiGiai: 'NGAY' }, [TN(1, { noiDung: 'Câu TN đã sửa' })], e);
  clearCache(w.g);
  const nb = w.nb();
  assert.strictEqual(nb.items.length, 2);
  assert.strictEqual(byStt(nb, e, 1).daSua, true);
  assert.strictEqual(byStt(nb, e, 2).go, true);
  const its = w.item(nb.items.map((x) => x.key));
  const a = its.find((x) => x.key === byStt(nb, e, 1).key), b = its.find((x) => x.key === byStt(nb, e, 2).key);
  assert.strictEqual(a.daSua, true);
  assert.strictEqual(a.noiDung, 'Câu TN đã sửa');
  assert.strictEqual(b.go, true);
  assert.strictEqual(b.answer, 'B');
});

t('Loại lỗi học sinh đã chọn (hàng SoTay) thắng máy đoán; ghi chú → coGhiChu; CongThuc khớp tên bài (chỉ hàng bật)', () => {
  const w = world();
  const e = saveExam(w, { trangThai: 'DONG', hienLoiGiai: 'NGAY' }, [TN(1), TL(2, '5')]);
  saveExam(w, { trangThai: 'MO', hienLoiGiai: 'NGAY' }, [TN(1), TL(2, '5')], e);
  doExam(w, e, { 1: 'B', 2: '' });
  const keys = w.nb().items.map((x) => x.key);
  const sh = w.g._sheets.SoTay._data();
  sh.push(['HS0001', keys[1], 'DOC_DE', 'HS', '{}', 'Đọc kĩ đơn vị', '']);
  sh.push(['HS0002', keys[0], 'CONG_THUC', 'HS', '{}', '', '']); // của học sinh khác: bỏ qua
  sh.push(['HS0001', '_CHUNG', '', '', '', 'Ghi chú chung thử', '']);
  const ct = w.g._sheets.CongThuc._data();
  ct.push([BAI, 'Chu kì con lắc đơn', 'T = 2\\pi\\sqrt{l/g}', 'Lờ trên Gờ dưới', 'Dao động nhỏ', 'Có chiều dài dây và g', 'CO']);
  ct.push([BAI, 'Công thức tắt', 'x', '', '', '', 'KHONG']);
  clearCache(w.g);
  const nb = w.nb();
  const it2 = byStt(nb, e, 2);
  assert.deepStrictEqual(it2.loi, { ma: 'DOC_DE', nguon: 'HS', canHoi: false });
  assert.strictEqual(it2.coGhiChu, true);
  assert.strictEqual(byStt(nb, e, 1).loi.ma, 'CHUA_RO');
  assert.strictEqual(nb.ghiChuChung, 'Ghi chú chung thử');
  const its = w.item([byStt(nb, e, 1).key]);
  assert.strictEqual(its[0].congThuc.length, 1);
  assert.strictEqual(its[0].congThuc[0].tenGoiNho, 'Lờ trên Gờ dưới');
});

t('Bài luyện tập: câu sai ở bài luyện có trong sổ tay (nguồn luyện tập), gộp với cùng mã câu ở đề thi; đề thi cập nhật thì sổ tay cập nhật ngay (không chờ đệm)', () => {
  const w = world({ kho: true });
  let r;
  do { r = ok(w.g.call('adminPracticeSync', { token: w.tTok, mode: 'them', filter: {}, cursor: r && r.tiepTuc })); } while (r.tiepTuc != null);
  const s = ok(w.g.call('practiceStart', { token: w.sTok, kieu: 'TU_TAO', so: { TN: 5 }, phut: 5 }));
  const pl = JSON.parse(Buffer.from(s.attemptToken.split('.')[0].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  const ans = {};
  pl.qids.forEach((q, i) => { ans[i + 1] = 'Z'; });
  ok(w.g.call('submitExam', { token: w.sTok, attemptToken: s.attemptToken, answers: ans, times: { 1: 3 } }));
  const nb = w.nb();
  assert.strictEqual(nb.items.length, 5);
  nb.items.forEach((x) => { assert.strictEqual(x.nguon.luyenTap, true); assert.ok(x.congBo); });
  const X = pl.qids[0];
  backdate(w, 'KetQuaLuyenTap', 1, 1); // bài luyện nộp hôm qua, đề thi nộp hôm nay
  const its = w.item([X]);
  assert.ok(its[0].noiDung && its[0].dapAn != null, 'bài luyện: câu kho đã công bố có đáp án');
  // cùng câu X trong một đề thi đang mở → đáp án bị ẩn (câu đang thi), nguồn vẫn gộp một khóa
  const q = ok(w.g.call('adminBankToQuestions', { token: w.tTok, maKho: [X] })).questions[0];
  const e = saveExam(w, { trangThai: 'MO', hienLoiGiai: 'NGAY' }, [q]);
  doExam(w, e, { 1: 'Z' });
  const nb2 = w.nb();
  assert.strictEqual(nb2.items.length, 5, 'cùng mã kho thì gộp');
  const x2 = nb2.items.find((x) => x.key === X);
  assert.strictEqual(x2.lanSai, 2);
  assert.strictEqual(x2.soDe, 2);
  assert.strictEqual(x2.nguon.examId, e);
  assert.ok(w.item([X])[0].an, 'câu đang nằm trong đề thi chưa đóng → ẩn đáp án');
});

t('Vòng 2 (R-1): sổ tay đọc ít Sheet — câu luyện tập chỉ cần chương/bài lấy từ chỉ mục, Phần III đọc theo khối gộp; học sinh khác nộp bài không làm mất đệm', () => {
  const w = world({ kho: true });
  let r;
  do { r = ok(w.g.call('adminPracticeSync', { token: w.tTok, mode: 'them', filter: {}, cursor: r && r.tiepTuc })); } while (r.tiepTuc != null);
  const meta = ok(w.g.call('practiceMeta', { token: w.sTok }));
  const tong = meta.cay.reduce((a, x) => ({ TN: a.TN + x.dem.TN, TL: a.TL + x.dem.TL }), { TN: 0, TL: 0 });
  for (let k = 0; k < 3; k++) {
    const s = ok(w.g.call('practiceStart', { token: w.sTok, kieu: 'TU_TAO', so: { TN: Math.min(10, tong.TN), TL: Math.min(3, tong.TL) }, phut: 10 }));
    const n = JSON.parse(Buffer.from(s.attemptToken.split('.')[0].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')).qids.length;
    const ans = {};
    for (let i = 1; i <= n; i++) ans[i] = s.questions[i - 1].loai === 'TL' ? '123456' : 'Z';
    ok(w.g.call('submitExam', { token: w.sTok, attemptToken: s.attemptToken, answers: ans }));
  }
  const s2 = ok(w.g.call('adminSaveStudent', { token: w.tTok, student: { hoTen: 'Học Sinh Thử', lop: '12A1', ngaySinh: '05/03/2008' } }));
  const tok2 = ok(w.g.call('loginPin', { studentId: s2.id, pin: '0503' })).token; // PIN mẫu của README
  const e = saveExam(w, { trangThai: 'MO', hienLoiGiai: 'NGAY' }, [TN(1)]); // tạo đề trước (tạo đề đổi thế hệ DeThi → đệm mới là đúng)
  clearCache(w.g);
  w.g._resetStats();
  const nb = w.nb();
  assert.ok(nb.items.length >= 10, 'có nhiều câu sai: ' + nb.items.length);
  const lt = w.g._stats.ranges.LuyenTap || 0;
  assert.ok(lt <= 2 + w.g.ROW_RUNS_MAX, 'số lần đọc LuyenTap: ' + lt);
  // đệm: học sinh khác nộp bài → sổ tay của em vẫn lấy từ đệm (không đọc lại KetQua / LuyenTap)
  doExam(w, e, { 1: 'B' }, null, tok2);
  w.g._resetStats();
  const again = w.nb();
  assert.strictEqual(again.items.length, nb.items.length);
  assert.ok(!w.g._stats.ranges.LuyenTap && !w.g._stats.ranges.KetQuaLuyenTap, 'lấy từ đệm: ' + JSON.stringify(w.g._stats.ranges));
  // chính em nộp bài → có số liệu mới ngay
  doExam(w, e, { 1: 'C' });
  assert.strictEqual(w.nb().items.length, nb.items.length + 1);
  // xem 1 câu: không phải đọc cả pool
  w.g._resetStats();
  const its = w.item([nb.items[0].key]);
  assert.ok(its[0].noiDung);
  assert.ok((w.g._stats.ranges.LuyenTap || 0) <= 3, 'notebookItem đọc LuyenTap: ' + w.g._stats.ranges.LuyenTap);
});

console.log(`\n${passed} kiểm thử đạt${failed ? ', ' + failed + ' KHÔNG ĐẠT' : '.'}`);
