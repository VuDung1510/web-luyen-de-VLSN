// Test Pha 7b (người làm) — Sổ tay: học sinh tự phân loại, ghi chú, lời nhắc, thời gian từng phần. node tests/pha7b.test.js
// Câu hỏi tự soạn, không chứa nội dung kho/đề thật.
const assert = require('assert');
const { createContext } = require('./gas-shim');

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
const plain = (x) => JSON.parse(JSON.stringify(x));

function world() {
  const g = createContext({ quiet: true });
  g.setup();
  const w = { g };
  w.tTok = ok(g.call('loginAdminPassword', { password: pwOf(g) })).token;
  w.sTok = ok(g.call('loginPin', { studentId: 'HS0001', pin: '0101' })).token;
  w.call = (a, b, tok) => g.call(a, Object.assign({ token: tok || w.sTok }, b || {}));
  w.nb = (tok) => ok(w.call('notebook', {}, tok));
  w.student2 = () => {
    const s2 = ok(g.call('adminSaveStudent', { token: w.tTok, student: { hoTen: 'Học Sinh Thử', lop: '12A1', ngaySinh: '05/03/2008' } }));
    return ok(g.call('loginPin', { studentId: s2.id, pin: '0503' })).token; // PIN mẫu của README
  };
  return w;
}
const TN = (n) => ({ loai: 'TN', noiDung: 'Câu TN tự soạn ' + n, A: 'a', B: 'b', C: 'c', D: 'd', dapAn: 'A', loiGiai: 'Giải ' + n, chuong: 'Chương I. Dao động', bai: 'Bài 2. Con lắc đơn' });
const TL = (n, d) => ({ loai: 'TL', noiDung: 'Câu TL tự soạn ' + n, dapAn: d, loiGiai: 'Giải TL ' + n, chuong: 'Chương II. Sóng', bai: 'Bài 5. Sóng cơ' });
const DS = (n) => ({ loai: 'DS', noiDung: 'Câu Đ/S tự soạn ' + n, A: 'a', B: 'b', C: 'c', D: 'd', dapAn: 'DSDS', loiGiai: 'Giải ' + n });
function saveExam(w, exam, qs, id) {
  return ok(w.g.call('adminSaveExam', { token: w.tTok, exam: Object.assign({ id, tieuDe: 'Đề thử 7b', thoiGian: 50 }, exam), questions: qs })).id;
}
function doExam(w, eid, answers, extra, tok) {
  const s = ok(w.g.call('startExam', { token: tok || w.sTok, examId: eid, mucTieu: 5 }));
  return ok(w.g.call('submitExam', Object.assign({ token: tok || w.sTok, attemptToken: s.attemptToken, answers: answers || {} }, extra || {})));
}
const byStt = (nb, stt) => nb.items.find((x) => x.nguon.stt === stt);
const soTay = (w) => w.g._sheets.SoTay ? w.g._sheets.SoTay._data().slice(1) : [];

console.log('Sổ tay — Pha 7b (máy chủ):');

t('APP_VERSION 1.7.0; notebook trả từ khóa (TU_KHOA_DOC_SAI) và lời nhắc', () => {
  const w = world();
  assert.strictEqual(ok(w.g.call('publicConfig')).version, '1.7.0');
  const nb = w.nb();
  assert.ok(nb.tuKhoa.includes('làm tròn') && nb.tuKhoa.includes('ít nhất') && nb.tuKhoa.includes('lấy g ='), JSON.stringify(nb.tuKhoa));
  assert.deepStrictEqual(plain(nb.nhacNho), []);
  ok(w.g.call('adminSaveSettings', { token: w.tTok, settings: { TU_KHOA_DOC_SAI: ' Bỏ qua ; tối đa;;bỏ qua ' } }));
  clearCache(w.g);
  assert.deepStrictEqual(plain(w.nb().tuKhoa), ['bỏ qua', 'tối đa']);
});

t('TC-7.10 notebookTag: em chọn thắng máy đoán, đổi lại được, bỏ chọn thì về máy đoán; 1 hàng SoTay mỗi câu; sổ tay cập nhật ngay', () => {
  const w = world();
  const e = saveExam(w, { trangThai: 'MO', hienLoiGiai: 'NGAY' }, [TN(1), TL(2, '5')]);
  doExam(w, e, { 1: 'B', 2: '' });
  let nb = w.nb();
  const k1 = byStt(nb, 1).key, k2 = byStt(nb, 2).key;
  assert.strictEqual(byStt(nb, 2).loi.ma, 'SOT');
  assert.strictEqual(ok(w.call('notebookTag', { items: [{ key: k1, ma: 'CONG_THUC' }, { key: k2, ma: 'DOC_DE' }] })).n, 2);
  nb = w.nb(); // không xóa đệm: phải thấy ngay
  assert.deepStrictEqual(plain(byStt(nb, 1).loi), { ma: 'CONG_THUC', nguon: 'HS', canHoi: false });
  assert.strictEqual(byStt(nb, 2).loi.ma, 'DOC_DE');
  ok(w.call('notebookTag', { items: [{ key: k1, ma: 'TINH_TOAN', y: 'DON_VI', chiTiet: { dl: 'chieuDai', dvEm: 'cm', dvDung: 'm', xau: 'x'.repeat(99) } }] }));
  nb = w.nb();
  assert.deepStrictEqual(plain(byStt(nb, 1).loi), { ma: 'TINH_TOAN', nguon: 'HS', canHoi: false, y: 'DON_VI' });
  const it = ok(w.call('notebookItem', { keys: [k1] })).items[0];
  assert.deepStrictEqual(plain(it.chiTietLoi), { y: 'DON_VI', dl: 'chieuDai', dvEm: 'cm', dvDung: 'm' }, 'chỉ giữ trường cho phép');
  ok(w.call('notebookTag', { items: [{ key: k2, ma: '' }] }));
  assert.strictEqual(byStt(w.nb(), 2).loi.ma, 'SOT', 'bỏ chọn → máy đoán');
  ok(w.call('notebookTag', { items: [{ key: k1, ma: 'DOC_DE', y: 'DON_VI' }] }));
  assert.ok(!('y' in byStt(w.nb(), 1).loi), 'ý con chỉ dành cho Tính toán');
  assert.strictEqual(soTay(w).length, 2, 'mỗi câu một hàng');
});

t('TC-7.10 notebookTag từ chối: câu không thuộc sổ tay của em, loại lỗi lạ, quá 40 câu, giáo viên, BAT_SO_TAY tắt', () => {
  const w = world();
  const e = saveExam(w, { trangThai: 'MO', hienLoiGiai: 'NGAY' }, [TN(1)]);
  doExam(w, e, { 1: 'B' });
  const k = w.nb().items[0].key;
  const tok2 = w.student2();
  assert.ok(/không có trong sổ tay/.test(err(w.call('notebookTag', { items: [{ key: k, ma: 'DOC_DE' }] }, tok2))));
  assert.ok(/không hợp lệ/.test(err(w.call('notebookTag', { items: [{ key: k, ma: 'XYZ' }] }))));
  assert.ok(/không hợp lệ/.test(err(w.call('notebookTag', { items: [{ key: k, ma: 'CHUA_RO' }] }))));
  assert.ok(/tối đa 40/.test(err(w.call('notebookTag', { items: Array.from({ length: 41 }, () => ({ key: k, ma: 'SOT' })) }))));
  assert.ok(/dành cho học sinh/.test(err(w.call('notebookTag', { items: [] }, w.tTok))));
  assert.strictEqual(soTay(w).length, 0, 'không ghi gì khi bị từ chối');
  ok(w.g.call('adminSaveSettings', { token: w.tTok, settings: { BAT_SO_TAY: 'KHONG' } }));
  clearCache(w.g);
  ['notebookTag', 'notebookNote', 'notebookResult'].forEach((a) => assert.ok(/tắt sổ tay/.test(err(w.call(a, { items: [{ key: k, ma: 'SOT' }], key: k, text: 'x', resultId: 'x' }))), a));
});

t('TC-7.11 ghi chú câu và ghi chú chung: lưu, tải lại vẫn còn; cắt 500 ký tự; chuỗi bắt đầu bằng = không thành công thức; câu của người khác bị từ chối', () => {
  const w = world();
  const e = saveExam(w, { trangThai: 'MO', hienLoiGiai: 'NGAY' }, [TN(1)]);
  doExam(w, e, { 1: 'B' });
  const k = w.nb().items[0].key;
  ok(w.call('notebookNote', { key: k, text: 'Nhớ: l trên, g dưới <b>x</b>' }));
  const r = ok(w.call('notebookNote', { key: '_CHUNG', text: 'y'.repeat(600) }));
  assert.strictEqual(r.text.length, 500);
  ok(w.call('notebookNote', { key: '_CHUNG', text: '=1+1 nhớ đổi đơn vị' }));
  clearCache(w.g);
  const nb = w.nb();
  assert.strictEqual(nb.items[0].coGhiChu, true);
  assert.strictEqual(nb.ghiChuChung, '=1+1 nhớ đổi đơn vị');
  assert.strictEqual(ok(w.call('notebookItem', { keys: [k] })).items[0].ghiChu, 'Nhớ: l trên, g dưới <b>x</b>', 'giữ nguyên văn (giao diện tự esc)');
  // ghi qua safe_ (thêm dấu nháy) → Sheet giữ là chữ, không phải công thức
  assert.strictEqual(w.g.safe_('=1+1 nhớ đổi đơn vị'), "'=1+1 nhớ đổi đơn vị");
  assert.strictEqual(soTay(w).find((x) => x[1] === '_CHUNG')[5].replace(/^'/, ''), '=1+1 nhớ đổi đơn vị');
  ok(w.call('notebookTag', { items: [{ key: k, ma: 'SOT' }] }));
  assert.strictEqual(ok(w.call('notebookItem', { keys: [k] })).items[0].ghiChu, 'Nhớ: l trên, g dưới <b>x</b>', 'chọn loại lỗi không xóa ghi chú');
  const tok2 = w.student2();
  assert.ok(/không có trong sổ tay/.test(err(w.call('notebookNote', { key: k, text: 'x' }, tok2))));
  ok(w.call('notebookNote', { key: '_CHUNG', text: 'của bạn B' }, tok2));
  assert.strictEqual(w.nb().ghiChuChung, '=1+1 nhớ đổi đơn vị', 'ghi chú chung riêng từng học sinh');
});

t('TC-7.8 (phần ghi) Sheet cũ chưa có SoTay: lần ghi đầu tự tạo trang tính đúng tiêu đề', () => {
  const w = world();
  const e = saveExam(w, { trangThai: 'MO', hienLoiGiai: 'NGAY' }, [TN(1)]);
  doExam(w, e, { 1: 'B' });
  const ss = w.g.SpreadsheetApp.getActiveSpreadsheet();
  ss.deleteSheet(ss.getSheetByName('SoTay'));
  clearCache(w.g);
  const k = w.nb().items[0].key;
  ok(w.call('notebookTag', { items: [{ key: k, ma: 'DOC_DE' }] }));
  assert.deepStrictEqual(plain(w.g._sheets.SoTay._data()[0]), plain(w.g.SCHEMA.SoTay.map((d) => d[1])));
  assert.strictEqual(w.nb().items[0].loi.ma, 'DOC_DE');
});

t('TC-7.9 notebookResult: câu sai của một bài (không nội dung), lặp lại, đã phân loại; chỉ bài của chính em', () => {
  const w = world();
  const qs = [TL(1, '2'), TL(2, '3'), TL(3, '4'), TN(4), DS(5)];
  const e1 = saveExam(w, { trangThai: 'MO', hienLoiGiai: 'NGAY' }, qs);
  const r1 = doExam(w, e1, { 1: 'a', 2: 'a', 3: 'a', 4: 'A', 5: ['D', 'S', 'D', 'S'] });
  const e2 = saveExam(w, { trangThai: 'MO', hienLoiGiai: 'NGAY' }, [TL(9, '5')]);
  doExam(w, e2, { 1: 'b' });
  let res = ok(w.call('notebookResult', { resultId: r1.id }));
  assert.deepStrictEqual(res.items.map((x) => x.stt), [1, 2, 3]);
  assert.ok(!JSON.stringify(res).includes('Câu TL tự soạn'), 'không có nội dung câu');
  assert.strictEqual(res.daPhanLoai, false);
  ok(w.call('notebookTag', { items: res.items.map((x) => ({ key: x.key, ma: 'TINH_TOAN', y: 'BAM_MAY' })) }));
  const k9 = w.nb().items.find((x) => x.nguon.examId === e2).key;
  ok(w.call('notebookTag', { items: [{ key: k9, ma: 'TINH_TOAN', y: 'BAM_MAY' }] }));
  res = ok(w.call('notebookResult', { resultId: r1.id }));
  assert.strictEqual(res.daPhanLoai, true);
  assert.ok(res.items.every((x) => x.lapLai), 'TINH_TOAN 4 câu đỏ / 2 đề → lặp lại');
  const tok2 = w.student2();
  assert.ok(/Không tìm thấy bài làm/.test(err(w.call('notebookResult', { resultId: r1.id }, tok2))));
});

t('TC-7.16 nhacNho: tối đa 3 loại sai ngoo còn đỏ/vàng, nặng nhất trước, kèm lời nhắc; loại đã xanh thì không nhắc', () => {
  const w = world();
  const qs = [TL(1, '2'), TL(2, '3'), TL(3, '4'), TN(4), TN(5), TN(6), TN(7)];
  const e1 = saveExam(w, { trangThai: 'MO', hienLoiGiai: 'NGAY' }, qs);
  doExam(w, e1, { 1: 'a', 2: 'a', 3: 'a', 4: 'B', 5: 'B', 6: 'B', 7: 'B' });
  const e2 = saveExam(w, { trangThai: 'MO', hienLoiGiai: 'NGAY' }, [TL(9, '5')]);
  doExam(w, e2, { 1: 'b' });
  const nb = w.nb();
  const key = (s, e) => nb.items.find((x) => x.nguon.examId === e && x.nguon.stt === s).key;
  ok(w.call('notebookTag', { items: [1, 2, 3].map((s) => ({ key: key(s, e1), ma: 'TINH_TOAN' })).concat([{ key: key(1, e2), ma: 'TINH_TOAN' },
    { key: key(4, e1), ma: 'DOC_DE' }, { key: key(5, e1), ma: 'CONG_THUC' }, { key: key(6, e1), ma: 'SOT' }, { key: key(7, e1), ma: 'SOT' }]) }));
  const n = w.nb().nhacNho;
  assert.strictEqual(n.length, 3);
  assert.strictEqual(n[0].ma, 'TINH_TOAN');
  assert.strictEqual(n[0].lapLai, true);
  assert.strictEqual(n[1].ma, 'SOT', 'cùng vàng thì nhiều câu trước');
  assert.ok(n.every((x) => x.nhac && x.ten));
});

t('TC-7.15 notebookItem.thoiGian: phút của đề, giây làm xong từng phần (theo t); bài cũ không có t → xong = null', () => {
  const w = world();
  const e = saveExam(w, { trangThai: 'MO', hienLoiGiai: 'NGAY', thoiGian: 25 }, [TN(1), TN(2), DS(3), TL(4, '1')]);
  doExam(w, e, { 1: 'B', 2: 'A', 3: ['D', 'S', 'D', 'D'], 4: '9' }, { times: { 1: 0 } });
  // bài nộp ngay nên máy chủ chỉ nhận t ≤ số giây đã làm; đặt t như một bài làm thật 1 200 giây
  const rows = w.g._sheets.KetQua._data();
  const c = rows[0].indexOf('Chi tiết (JSON)'), cg = rows[0].indexOf('Số giây');
  const tt = { 1: 100, 2: 400, 3: 700, 4: 30 };
  rows[1][c] = JSON.stringify(JSON.parse(rows[1][c]).map((d) => Object.assign(d, { t: tt[d.s] })));
  rows[1][cg] = 1200;
  clearCache(w.g);
  const nb = w.nb();
  const it = ok(w.call('notebookItem', { keys: [byStt(nb, 1).key] })).items[0];
  assert.strictEqual(it.thoiGian.phut, 25);
  assert.strictEqual(it.thoiGian.daLam, 1200);
  assert.deepStrictEqual(plain(it.thoiGian.xong), { 1: 400, 2: 700, 3: 30 }, 'mọi câu của bài, kể cả câu đúng');
  rows[1][c] = JSON.stringify(JSON.parse(rows[1][c]).map((d) => { delete d.t; return d; }));
  clearCache(w.g);
  assert.strictEqual(ok(w.call('notebookItem', { keys: [byStt(w.nb(), 1).key] })).items[0].thoiGian.xong, null);
});

t('Học sinh khác ghi sổ tay không làm mất đệm sổ tay của em', () => {
  const w = world();
  const e = saveExam(w, { trangThai: 'MO', hienLoiGiai: 'NGAY' }, [TN(1)]);
  doExam(w, e, { 1: 'B' });
  const tok2 = w.student2();
  doExam(w, e, { 1: 'C' }, null, tok2);
  w.nb(); // làm ấm đệm
  const k2 = w.nb(tok2).items[0].key;
  ok(w.call('notebookTag', { items: [{ key: k2, ma: 'DOC_DE' }] }, tok2));
  ok(w.call('notebookNote', { key: '_CHUNG', text: 'B ghi' }, tok2));
  w.g._resetStats();
  w.nb();
  assert.ok(!w.g._stats.ranges.KetQua && !w.g._stats.ranges.SoTay, 'lấy từ đệm: ' + JSON.stringify(w.g._stats.ranges));
});

console.log(`\n${passed} kiểm thử đạt${failed ? ', ' + failed + ' KHÔNG ĐẠT' : '.'}`);
