// Kiểm thử độc lập Pha 7b (người kiểm thử) — phía máy chủ, viết theo docs/spec/pha-7-so-tay.md (§5, §6, TC-7.10, 7.11, 7.13–7.15 phần máy chủ,
// notebookResult, nhacNho, tuKhoa, thoiGian; TC-7.7 phần 7b). node tests/pha7b-kiem-thu.test.js
// Hộp đen qua gas-shim; câu hỏi tự soạn; học sinh B giả (PIN mặc định theo ngày sinh).
const assert = require('assert');
const path = require('path');
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
const clearCache = (g) => Object.keys(g._cache).forEach((k) => delete g._cache[k]);
const OFF_MSG = /Giáo viên đang tắt sổ tay/;

// ---------- Thế giới thử ----------
function world(opts = {}) {
  const g = createContext({ quiet: true, codePath: opts.codePath });
  g.setup();
  const kho = opts.bank ? K.install(g, { rows: opts.rows, missingImages: 0 }) : null;
  if (opts.bank) K.setSetting(g, { CHO_LUYEN_TAP: 'CO' });
  const tTok = ok(g.call('loginAdminPassword', { password: pwOf(g) })).token;
  const A = ok(g.call('loginPin', { studentId: 'HS0001', pin: '0101' })).token;
  const w = { g, kho, tTok, A, adm: (a, b) => g.call(a, Object.assign({ token: tTok }, b || {})) };
  if (opts.studentB !== false) {
    const ngaySinh = '01/02/2008'; // học sinh GIẢ; PIN mặc định = ddmm của ngày sinh
    const s = ok(w.adm('adminSaveStudent', { student: { hoTen: 'Học sinh B thử', lop: '12A1', ngaySinh } }));
    w.bId = s.id;
    w.B = ok(g.call('loginPin', { studentId: s.id, pin: ngaySinh.slice(0, 2) + ngaySinh.slice(3, 5) })).token;
  }
  if (opts.bank) {
    let cursor; let n = 0;
    for (;;) {
      const d = ok(w.adm('adminPracticeSync', { filter: {}, mode: 'them', cursor }), 'adminPracticeSync');
      if (d.tiepTuc == null || d.tiepTuc === '' || d.tiepTuc === false) break;
      cursor = d.tiepTuc; if (++n > 200) throw new Error('tiepTuc không dừng');
    }
  }
  return w;
}
// Câu tự soạn
const TN = (n, dapAn, extra) => Object.assign({ loai: 'TN', phan: 1, noiDung: `Câu trắc nghiệm tự soạn số ${n}: chọn phát biểu đúng về đại lượng x${n}.`, A: 'Phương án một', B: 'Phương án hai', C: 'Phương án ba', D: 'Phương án bốn', dapAn: dapAn || 'A', chuDe: 'Chủ đề thử', chuong: 'Chương I. Thử', bai: 'Bài 1. Thử', loiGiai: `Lời giải tự soạn câu ${n}: lập luận theo định nghĩa.` }, extra || {});
const DS = (n, dapAn, extra) => Object.assign({ loai: 'DS', phan: 2, noiDung: `Câu đúng/sai tự soạn số ${n}: xét bốn nhận định.`, A: 'Nhận định a', B: 'Nhận định b', C: 'Nhận định c', D: 'Nhận định d', dapAn: dapAn || 'ĐSĐS', chuDe: 'Chủ đề thử', chuong: 'Chương II. Thử', bai: 'Bài 2. Thử', loiGiai: `Lời giải tự soạn câu ĐS ${n}.` }, extra || {});
const TL = (n, dapAn, extra) => Object.assign({ loai: 'TL', phan: 3, noiDung: `Câu trả lời ngắn tự soạn số ${n}: tính đại lượng y${n}.`, dapAn: String(dapAn), saiSo: '0', chuDe: 'Chủ đề thử', chuong: 'Chương III. Thử', bai: 'Bài 3. Thử', loiGiai: `Lời giải tự soạn câu TL ${n}: y = ${dapAn}.` }, extra || {});

function mkExam(w, title, qs, ex) {
  return ok(w.adm('adminSaveExam', { exam: Object.assign({ tieuDe: title, lop: '12A1', thoiGian: 50, trangThai: 'MO', soLanLam: 0, hienLoiGiai: 'NGAY' }, ex || {}), questions: qs }), 'adminSaveExam').id;
}
function setExam(w, id, patch) {
  const ex = ok(w.adm('adminGetExam', { examId: id }));
  ok(w.adm('adminSaveExam', { exam: Object.assign({}, ex.exam, patch), questions: ex.questions }), 'sửa đề');
  clearCache(w.g);
}
function submit(w, tok, examId, answers) {
  const s = ok(w.g.call('startExam', { token: tok, examId }), 'startExam');
  return ok(w.g.call('submitExam', { token: tok, attemptToken: s.attemptToken, answers }), 'submitExam');
}
// Sửa trang tính để giả "dữ liệu cũ": đổi ngày nộp của hàng cuối, bỏ t/h trong chiTiet
function stampLast(w, sheet, when) {
  const d = w.g._sheets[sheet]._data(); const h = d[0];
  d[d.length - 1][h.indexOf('Nộp lúc')] = when;
  clearCache(w.g);
}
function makeOld(w, sheet) {
  const sh = w.g._sheets[sheet]; if (!sh) return 0;
  const d = sh._data(); const ci = d[0].indexOf('Chi tiết (JSON)'); let n = 0;
  for (let i = 1; i < d.length; i++) {
    if (!d[i][ci]) continue;
    d[i][ci] = JSON.stringify(JSON.parse(d[i][ci]).map((x) => { if ('t' in x || 'h' in x) n++; delete x.t; delete x.h; return x; }));
  }
  clearCache(w.g);
  return n;
}
const nb = (w, tok) => ok(w.g.call('notebook', { token: tok || w.A }), 'notebook');
const nbItem = (w, keys, tok) => w.g.call('notebookItem', { token: tok || w.A, keys });
const itemsOf = (d) => (d.items || []);
const byKey = (d) => { const m = {}; itemsOf(d).forEach((x) => { m[x.key] = x; }); return m; };
// Chuẩn hóa màu: chấp nhận do/vang/xanh, red/yellow/green, emoji
function color(v) {
  const s = String(v == null ? '' : v).toLowerCase();
  if (/do|đỏ|red|🔴/.test(s)) return 'do';
  if (/vang|vàng|yellow|amber|🟡/.test(s)) return 'vang';
  if (/xanh|green|🟢/.test(s)) return 'xanh';
  return s || '(trống)';
}
const loiOf = (it) => it && it.loi ? it.loi : {};
function forbidKeys(obj, keys) {
  const j = JSON.stringify(obj);
  const bad = keys.filter((k) => new RegExp('"' + k + '"\\s*:').test(j));
  return bad;
}
function contentOf(d) {
  // nội dung trả về từ notebookItem: chấp nhận mảng items hoặc map theo key
  if (Array.isArray(d)) return d;
  if (d && Array.isArray(d.items)) return d.items;
  if (d && typeof d === 'object') return Object.keys(d).map((k) => Object.assign({ key: k }, d[k]));
  return [];
}

// ---------- riêng 7b ----------
// Máy chủ tính "thời gian đã làm" bằng Date thật (không qua nowMs_), nên tua giờ bằng cách thay Date trong vm của shim (chỉ trong bài này).
function shiftDate(g) {
  if (g.__shift) return;
  require('vm').runInContext('(function(){var O=Date,off=0;function D(){var a=[].slice.call(arguments);if(!(this instanceof D))return O();return a.length?new (Function.prototype.bind.apply(O,[null].concat(a)))():new O(O.now()+off);}D.prototype=O.prototype;D.now=function(){return O.now()+off;};D.UTC=O.UTC;D.parse=O.parse;this.Date=D;this.__shift=function(s){off+=s*1000;};})()', g);
}
function submitT(w, tok, examId, answers, times, advanceSec) {
  shiftDate(w.g);
  const s = ok(w.g.call('startExam', { token: tok, examId }), 'startExam');
  if (advanceSec) { w.g.__shift(advanceSec); w.g._clock.advance(advanceSec * 1000); }
  return ok(w.g.call('submitExam', { token: tok, attemptToken: s.attemptToken, answers, times }), 'submitExam');
}
const tag = (w, items, tok) => w.g.call('notebookTag', { token: tok || w.A, items });
const note = (w, key, text, tok) => w.g.call('notebookNote', { token: tok || w.A, key, text });
const soTay = (w) => { const sh = w.g._sheets.SoTay; if (!sh) return []; const d = sh._data(); const h = d[0].map(String); return d.slice(1).filter((r) => r && r[0]).map((r) => { const o = {}; h.forEach((x, i) => { o[x] = r[i]; }); return o; }); };
function lastResultId(w, tok) {
  const r = ok(w.g.call('myResults', { token: tok || w.A }), 'myResults');
  const arr = Array.isArray(r) ? r : (r.items || r.results || []);
  return arr[0].id;
}
const nbRes = (w, resultId, tok) => w.g.call('notebookResult', { token: tok || w.A, resultId });
function base3(w) {
  // 4 câu: P1 sai (CHUA_RO), P3 bỏ trống (SOT chắc), P3 0,25/25 (DON_VI khi công bố), P1 đúng
  const e = mkExam(w, 'Đề 7b', [TN(1, 'A'), TL(2, '5'), TL(3, '25'), TN(4, 'B')]);
  submit(w, w.A, e, { 1: 'C', 2: '', 3: '0,25', 4: 'B' });
  return e;
}

// =====================================================================
console.log('\nTC-7.10 — notebookTag');
// =====================================================================
t('TC-7.10 học sinh chọn thắng máy đoán, nguồn HS; đổi lại được; notebook cập nhật ngay', () => {
  const w = world({ studentB: false });
  const e = base3(w);
  assert.strictEqual(loiOf(byKey(nb(w))[e + '#2']).ma, 'SOT');
  assert.strictEqual(ok(tag(w, [{ key: e + '#2', ma: 'DOC_DE' }]), 'notebookTag').n, 1);
  let l = loiOf(byKey(nb(w))[e + '#2']);
  assert.strictEqual(l.ma, 'DOC_DE'); assert.strictEqual(l.nguon, 'HS');
  ok(tag(w, [{ key: e + '#2', ma: 'CONG_THUC' }]));
  l = loiOf(byKey(nb(w))[e + '#2']);
  assert.strictEqual(l.ma, 'CONG_THUC', 'đổi lại'); assert.strictEqual(l.nguon, 'HS');
  ok(tag(w, [{ key: e + '#3', ma: 'TINH_TOAN', y: 'DON_VI' }, { key: e + '#1', ma: 'DOAN_MO' }]));
  const m = byKey(nb(w));
  assert.strictEqual(loiOf(m[e + '#3']).y, 'DON_VI'); assert.strictEqual(loiOf(m[e + '#1']).ma, 'DOAN_MO');
  const d = nb(w);
  assert(!(d.tongHop.saiNgoo || []).some((x) => x.ma === 'SOT'), 'không còn câu SOT');
  assert.strictEqual(+d.tongHop.hongKT.doanMo, 1, 'đoán mò đếm vào Hổng kiến thức');
});
t('TC-7.10 gắn 2 lần cùng key → 1 hàng SoTay; nhiều lần đổi vẫn 1 hàng; ghi chú cùng key dùng chung hàng', () => {
  const w = world({ studentB: false });
  const e = base3(w);
  for (const ma of ['DOC_DE', 'DOC_DE', 'SOT', 'HONG_KT']) ok(tag(w, [{ key: e + '#1', ma }]));
  ok(note(w, e + '#1', 'Ghi chú câu 1'));
  const rows = soTay(w).filter((r) => r['Khóa câu'] === e + '#1');
  assert.strictEqual(rows.length, 1, 'số hàng ' + rows.length);
  assert.strictEqual(rows[0]['Loại lỗi'], 'HONG_KT'); assert.strictEqual(rows[0]['Nguồn'], 'HS');
  assert.strictEqual(rows[0]['Ghi chú'], 'Ghi chú câu 1');
});
t('TC-7.10 từ chối: key không phải câu sai của mình (câu B sai, câu mình làm đúng, key bịa), mã lỗi lạ, > 40 mục; không ghi hàng nào', () => {
  const w = world();
  const e = base3(w);
  submit(w, w.B, e, { 1: 'A', 2: '5', 3: '25', 4: 'C' }); // B chỉ sai câu 4 (A làm đúng câu 4)
  const before = soTay(w).length;
  const bad = [[{ key: e + '#4', ma: 'SOT' }], [{ key: 'DEBIA#1', ma: 'SOT' }], [{ key: e + '#1', ma: 'LOI_BIA' }], [{ key: e + '#1', ma: 'SOT', y: 'DON_VI' }]];
  for (const items of bad) {
    const r = tag(w, items);
    const n = r.ok ? r.data.n : 0;
    info(JSON.stringify(items[0]) + ' → ' + (r.ok ? 'ok n=' + n : 'lỗi "' + r.error + '"'));
    if (items[0].y && r.ok) { // ý con chỉ cho TINH_TOAN: chấp nhận nếu bỏ ý con
      const row = soTay(w).find((x) => x['Khóa câu'] === e + '#1');
      assert(!row || !/DON_VI/.test(row['Chi tiết lỗi (JSON)'] || ''), 'ý con DON_VI ghi vào SOT');
      continue;
    }
    assert(!r.ok || n === 0, 'phải từ chối ' + JSON.stringify(items));
  }
  assert.strictEqual(soTay(w).filter((r) => r['Khóa câu'] !== e + '#1').length, 0, 'đã ghi hàng cho key không hợp lệ');
  const many = Array.from({ length: 41 }, () => ({ key: e + '#1', ma: 'SOT' }));
  const r41 = tag(w, many);
  assert(!r41.ok || r41.data.n <= 40, '> 40 mục');
  // lô lẫn hợp lệ + không hợp lệ: không ghi key B
  tag(w, [{ key: e + '#1', ma: 'SOT' }, { key: e + '#4', ma: 'SOT' }]);
  assert(!soTay(w).some((r) => r['Khóa câu'] === e + '#4' && r['Mã HS'] === 'HS0001'), 'lô lẫn: ghi key không phải của em');
  // B gắn câu 4 của B được; sổ A không đổi
  ok(tag(w, [{ key: e + '#4', ma: 'DOC_DE' }], w.B));
  assert(!byKey(nb(w))[e + '#4'], 'sổ A có câu 4');
  assert.strictEqual(loiOf(byKey(nb(w, w.B))[e + '#4']).ma, 'DOC_DE');
  info('hàng SoTay: ' + soTay(w).length + ' (trước ' + before + ')');
});
t('TC-7.10 (biên) bỏ chọn (ma rỗng) → về máy đoán; chiTiet ghi chuỗi bắt đầu "=" không thành công thức', () => {
  const w = world({ studentB: false });
  const e = base3(w);
  ok(tag(w, [{ key: e + '#2', ma: 'DOC_DE' }]));
  const r = tag(w, [{ key: e + '#2', ma: '' }]);
  if (r.ok) assert.strictEqual(loiOf(byKey(nb(w))[e + '#2']).ma, 'SOT', 'bỏ chọn phải về máy đoán');
  else info('ma rỗng: ' + r.error);
  ok(tag(w, [{ key: e + '#3', ma: 'TINH_TOAN', y: 'DON_VI', chiTiet: { dl: '=HYPERLINK("x")', dvEm: 'cm', dvDung: 'm' } }]));
  const row = soTay(w).find((x) => x['Khóa câu'] === e + '#3');
  const cells = Object.values(row).map(String);
  assert(!cells.some((c) => /^[=+]/.test(c)), 'ô bắt đầu bằng = hoặc +: ' + JSON.stringify(row));
});

// =====================================================================
console.log('\nTC-7.11 — ghi chú');
// =====================================================================
t('TC-7.11 ghi chú câu và ghi chú chung lưu, đọc lại (notebook.ghiChuChung, notebookItem.ghiChu, coGhiChu); > 500 ký tự cắt; HTML giữ nguyên văn', () => {
  const w = world({ studentB: false });
  const e = base3(w);
  const html = '<img src=x onerror=alert(1)><b>đậm</b> & "nháy"';
  ok(note(w, '_CHUNG', html), 'notebookNote _CHUNG');
  ok(note(w, e + '#1', 'x'.repeat(600)), 'notebookNote câu');
  clearCache(w.g);
  const d = nb(w);
  assert.strictEqual(d.ghiChuChung, html, 'ghi chú chung đọc lại: ' + JSON.stringify(d.ghiChuChung));
  assert(byKey(d)[e + '#1'].coGhiChu, 'coGhiChu');
  const it = contentOf(ok(nbItem(w, [e + '#1'])))[0];
  assert.strictEqual(String(it.ghiChu).length, 500, 'độ dài ghi chú ' + String(it.ghiChu).length);
  ok(note(w, '_CHUNG', 'y'.repeat(700)));
  assert.strictEqual(String(nb(w).ghiChuChung).length, 500);
  ok(note(w, '_CHUNG', ''));
  assert.strictEqual(nb(w).ghiChuChung || '', '', 'xóa ghi chú chung');
});
t('TC-7.11 ghi chú cho key không phải câu sai của mình bị từ chối; ghi chú của A không hiện ở B', () => {
  const w = world();
  const e = base3(w);
  submit(w, w.B, e, { 1: 'C', 2: '5', 3: '25', 4: 'C' });
  const r = note(w, e + '#4', 'ghi chú lén');
  assert(!r.ok, 'ghi chú key câu mình làm đúng phải bị từ chối');
  ok(note(w, '_CHUNG', 'chung của A')); ok(note(w, e + '#1', 'riêng của A'));
  const dB = nb(w, w.B);
  assert(!dB.ghiChuChung, 'B thấy ghi chú chung của A');
  assert(!JSON.stringify(ok(nbItem(w, [e + '#1'], w.B))).includes('riêng của A'), 'B thấy ghi chú câu của A');
});

// =====================================================================
console.log('\nnotebookResult — khung "Em sai vì sao?"');
// =====================================================================
t('notebookResult: chỉ câu sai của MỘT bài, không có nội dung/đáp án; daPhanLoai đổi sau khi gắn; bài của người khác bị từ chối', () => {
  const w = world();
  const e = base3(w);
  const rid = lastResultId(w);
  const d = ok(nbRes(w, rid), 'notebookResult');
  const st = d.items.map((x) => +x.stt).sort();
  assert.deepStrictEqual(st, [1, 2, 3], 'câu sai ' + st);
  assert.deepStrictEqual(forbidKeys(d, ['noiDung', 'dapAn', 'loiGiai']), []);
  assert(!/tự soạn số/.test(JSON.stringify(d)));
  assert.strictEqual(d.daPhanLoai, false);
  const two = d.items.find((x) => +x.stt === 2);
  assert.strictEqual(loiOf(two).ma, 'SOT'); assert.strictEqual(loiOf(two).canHoi, false, 'chip máy đoán chắc');
  ok(tag(w, d.items.map((x) => ({ key: x.key, ma: 'DOC_DE' }))));
  assert.strictEqual(ok(nbRes(w, rid)).daPhanLoai, true, 'daPhanLoai sau khi gắn');
  submit(w, w.B, e, { 1: 'C', 2: '5', 3: '25', 4: 'B' });
  const ridB = lastResultId(w, w.B);
  const r = nbRes(w, ridB);
  assert(!r.ok || (r.data.items || []).length === 0, 'A đọc được bài của B: ' + JSON.stringify(r).slice(0, 150));
  assert(!nbRes(w, 'KHONGCO').ok || ok(nbRes(w, 'KHONGCO')).items.length === 0);
});
t('notebookResult (biên): bài không có câu sai → items rỗng; bài luyện tập cũng dùng được; lapLai/lanSai', () => {
  const w = world({ studentB: false });
  const a = mkExam(w, 'Đề đủ điểm', [TN(1, 'A')]);
  submit(w, w.A, a, { 1: 'A' });
  assert.strictEqual(ok(nbRes(w, lastResultId(w))).items.length, 0);
  const b = mkExam(w, 'Đề lặp B', [TL(1, '5'), TL(2, '6')]);
  const c = mkExam(w, 'Đề lặp C', [TL(1, '7')]);
  submit(w, w.A, b, { 1: '', 2: '' }); submit(w, w.A, c, { 1: '' });
  const d = ok(nbRes(w, lastResultId(w)));
  info('items: ' + JSON.stringify(d.items));
  assert.strictEqual(d.items.length, 1); assert.strictEqual(d.items[0].lapLai, true, 'câu thuộc loại lỗi đang lặp lại');
  assert(+d.items[0].lanSai >= 1);
});

// =====================================================================
console.log('\nnhacNho, tuKhoa (TC-7.13 máy chủ), congThuc (TC-7.14 máy chủ)');
// =====================================================================
t('nhacNho: ≤ 3 dòng, chỉ loại Sai ngoo đỏ/vàng, đỏ trước; sổ trống → rỗng', () => {
  const w = world({ studentB: false });
  assert.strictEqual((nb(w).nhacNho || []).length, 0, 'sổ trống mà có nhắc');
  const a = mkExam(w, 'Đề N1', [TL(1, '5'), TL(2, '6'), TN(3, 'A'), TN(4, 'A'), TN(5, 'A'), TN(6, 'A')]);
  const b = mkExam(w, 'Đề N2', [TL(1, '7')]);
  submit(w, w.A, a, { 1: '', 2: '', 3: 'B', 4: 'B', 5: 'B', 6: 'B' }); submit(w, w.A, b, { 1: '' });
  ok(tag(w, [{ key: a + '#3', ma: 'DOC_DE' }, { key: a + '#4', ma: 'CONG_THUC' }, { key: a + '#5', ma: 'TINH_TOAN', y: 'BAM_MAY' }, { key: a + '#6', ma: 'HONG_KT' }]));
  const n = nb(w).nhacNho || [];
  info('nhacNho: ' + JSON.stringify(n));
  assert(n.length >= 1 && n.length <= 3, 'số dòng ' + n.length);
  const s = JSON.stringify(n);
  assert(!/HONG_KT|DOAN_MO|CHUA_RO/.test(s), 'nhắc có loại Hổng kiến thức');
  assert(/SOT/.test(JSON.stringify(n[0])), 'loại đỏ (SOT lặp lại) phải đứng đầu');
});
t('TC-7.13 (máy chủ) notebook.tuKhoa có danh sách mặc định §5.2; thêm từ khóa vào TU_KHOA_DOC_SAI có hiệu lực', () => {
  const w = world({ studentB: false });
  base3(w);
  const tk = nb(w).tuKhoa;
  const list = (Array.isArray(tk) ? tk : String(tk).split(';')).map((x) => (typeof x === 'string' ? x : x.tu || x.k || x.text)).map((x) => String(x).trim());
  for (const k of ['không', 'sai', 'đúng', 'chỉ', 'luôn', 'ít nhất', 'nhiều nhất', 'tối đa', 'tối thiểu', 'bỏ qua', 'ban đầu', 'từ trạng thái nghỉ', 'ngay sau', 'ngay trước', 'độ lớn', 'gần nhất', 'làm tròn', 'đơn vị']) assert(list.includes(k), 'thiếu từ khóa "' + k + '"');
  assert(list.some((x) => /^lấy g/.test(x)), 'thiếu "lấy g ="');
  const cur = w.g._sheets.CaiDat._data().find((r) => r[0] === 'TU_KHOA_DOC_SAI')[1];
  ok(w.adm('adminSaveSettings', { settings: { TU_KHOA_DOC_SAI: cur + ';vận tốc góc riêng' } }));
  const tk2 = JSON.stringify(nb(w).tuKhoa);
  assert(/vận tốc góc riêng/.test(tk2), 'từ khóa mới chưa có hiệu lực');
});
t('TC-7.14 (máy chủ) notebookItem.congThuc: bài có hàng CongThuc bat=CO → có; bat=KHONG → không; bài khác → rỗng', () => {
  const w = world({ studentB: false });
  const e = mkExam(w, 'Đề công thức', [TN(1, 'A', { bai: 'Bài 7. Thử công thức' }), TN(2, 'A', { bai: 'Bài 8. Không có' })]);
  submit(w, w.A, e, { 1: 'B', 2: 'B' });
  w.g.setup();
  const ct = w.g._sheets.CongThuc._data();
  const h = ct[0].map(String);
  const row = (o) => h.map((x) => o[x] != null ? o[x] : '');
  ct.push(row({ 'Mã bài': 'Bài 7. Thử công thức', 'Tên công thức': 'Định luật thử', 'Công thức': 'F = ma', 'Tên gợi nhớ': 'Ép bằng ma', 'Phạm vi áp dụng': 'Hệ quy chiếu quán tính', 'Dấu hiệu sử dụng': 'Có lực và gia tốc', 'Bật': 'CO' }));
  ct.push(row({ 'Mã bài': 'Bài 7. Thử công thức', 'Tên công thức': 'Công thức tắt', 'Công thức': 'x', 'Tên gợi nhớ': 'Tắt', 'Phạm vi áp dụng': '', 'Dấu hiệu sử dụng': '', 'Bật': 'KHONG' }));
  clearCache(w.g);
  const arr = contentOf(ok(nbItem(w, [e + '#1', e + '#2'])));
  const by = {}; arr.forEach((x) => { by[x.key] = x; });
  const c1 = by[e + '#1'].congThuc || [];
  info('congThuc câu 1: ' + JSON.stringify(c1));
  assert.strictEqual(c1.length, 1, 'chỉ hàng bật');
  assert(/Ép bằng ma/.test(JSON.stringify(c1)) && /F = ma/.test(JSON.stringify(c1)) && /quán tính/.test(JSON.stringify(c1)) && /lực và gia tốc/.test(JSON.stringify(c1)));
  assert.strictEqual((by[e + '#2'].congThuc || []).length, 0);
});

// =====================================================================
console.log('\nTC-7.15 (máy chủ) — thời gian t');
// =====================================================================
t('TC-7.15 t hợp lệ được lưu, t âm / lớn hơn thời gian làm / không phải số bị bỏ; thoiGian {phut, daLam, xong theo phần}', () => {
  const w = world({ studentB: false });
  const e = mkExam(w, 'Đề 25 phút', [TN(1, 'A'), TN(2, 'A'), DS(3, 'ĐĐĐĐ'), TL(4, '5'), TL(5, '6')], { thoiGian: 25 });
  submitT(w, w.A, e, { 1: 'B', 2: 'B', 3: ['D', 'D', 'D', 'S'], 4: '', 5: '1' }, { 1: 120, 2: 300, 3: -5, 4: 99999, 5: 'abc' }, 600);
  const kq = w.g._sheets.KetQua._data(); const ci = kq[0].indexOf('Chi tiết (JSON)');
  const det = JSON.parse(kq[kq.length - 1][ci]);
  const tOf = (s) => (det.find((x) => +x.s === s) || {}).t;
  info('t lưu: ' + det.map((x) => x.s + '=' + x.t).join(' '));
  assert.strictEqual(tOf(1), 120); assert.strictEqual(tOf(2), 300);
  [3, 4, 5].forEach((s) => assert(tOf(s) == null, 'câu ' + s + ' t phải bị bỏ, được ' + tOf(s)));
  const it = contentOf(ok(nbItem(w, [e + '#1'])))[0];
  info('thoiGian: ' + JSON.stringify(it.thoiGian));
  assert(it.thoiGian, 'thiếu thoiGian');
  assert.strictEqual(+it.thoiGian.phut, 25);
  assert(+it.thoiGian.daLam >= 590 && +it.thoiGian.daLam <= 700, 'daLam ' + it.thoiGian.daLam);
  const xong = it.thoiGian.xong || {};
  assert.strictEqual(+xong[1] || +xong['1'], 300, 'Phần I xong lúc 300 giây (lần sửa cuối trong phần)');
  assert(xong[3] == null && xong[2] == null, 'phần không có t hợp lệ thì không có thời điểm xong: ' + JSON.stringify(xong));
});
t('TC-7.15 (biên) bài cũ không có t → thoiGian không có xong, không lỗi', () => {
  const w = world({ studentB: false });
  const e = base3(w);
  makeOld(w, 'KetQua');
  const it = contentOf(ok(nbItem(w, [e + '#1'])))[0];
  const x = (it.thoiGian && it.thoiGian.xong) || {};
  assert.strictEqual(Object.keys(x).length, 0, JSON.stringify(it.thoiGian));
});

// =====================================================================
console.log('\nTC-7.7 (7b) — tắt sổ tay');
// =====================================================================
t('TC-7.7 BAT_SO_TAY=KHONG: notebookTag, notebookNote, notebookResult báo "Giáo viên đang tắt sổ tay"; không ghi SoTay', () => {
  const w = world({ studentB: false });
  const e = base3(w);
  const rid = lastResultId(w);
  K.setSetting(w.g, { BAT_SO_TAY: 'KHONG' }); clearCache(w.g);
  const n0 = soTay(w).length;
  for (const [a, b] of [['notebookTag', { items: [{ key: e + '#1', ma: 'SOT' }] }], ['notebookNote', { key: '_CHUNG', text: 'x' }], ['notebookResult', { resultId: rid }]]) {
    const r = w.g.call(a, Object.assign({ token: w.A }, b));
    assert(!r.ok && OFF_MSG.test(r.error), a + ': ' + JSON.stringify(r).slice(0, 120));
  }
  assert.strictEqual(soTay(w).length, n0);
});
t('TC-7.8 (phần ghi, 7b) Sheet cũ không có SoTay: notebookTag/notebookNote lần đầu tự tạo trang có tiêu đề', () => {
  const w = world({ studentB: false });
  const e = base3(w);
  w.g.SpreadsheetApp.getActiveSpreadsheet().deleteSheet(w.g._sheets.SoTay); clearCache(w.g);
  ok(tag(w, [{ key: e + '#1', ma: 'SOT' }]));
  assert(w.g._sheets.SoTay, 'không tự tạo SoTay');
  assert.deepStrictEqual(w.g._sheets.SoTay._data()[0].map(String), JSON.parse(JSON.stringify(w.g.SCHEMA.SoTay.map((x) => x[1]))));
  assert.strictEqual(soTay(w).length, 1);
});
t('Đệm (7b): B gắn nhãn không làm sai sổ A; A gắn nhãn thì sổ A đổi ngay', () => {
  const w = world();
  const e = base3(w);
  submit(w, w.B, e, { 1: 'C', 2: '', 3: '1', 4: 'B' });
  nb(w); nb(w, w.B);
  ok(tag(w, [{ key: e + '#1', ma: 'HONG_KT' }], w.B));
  assert.strictEqual(loiOf(byKey(nb(w))[e + '#1']).ma, 'CHUA_RO', 'sổ A bị nhãn của B');
  ok(tag(w, [{ key: e + '#1', ma: 'DOC_DE' }]));
  assert.strictEqual(loiOf(byKey(nb(w))[e + '#1']).ma, 'DOC_DE');
  assert.strictEqual(loiOf(byKey(nb(w, w.B))[e + '#1']).ma, 'HONG_KT');
});

// ---------- tổng kết ----------
const pass = results.filter((r) => r[1]).length;
console.log(`\n${pass}/${results.length} đạt`);
if (pass !== results.length) { results.filter((r) => !r[1]).forEach((r) => console.log('  ✗ ' + r[0] + ': ' + r[2])); }
