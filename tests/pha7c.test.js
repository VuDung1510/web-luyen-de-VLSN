// Test Pha 7c (người làm) — Đề khắc phục từ sổ tay. node tests/pha7c.test.js
// Kho giả tự soạn (tests/fixtures/kho-gia.js), câu nhập tay tự soạn — không chứa nội dung kho/đề thật.
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
const b64 = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
const payload = (tok) => JSON.parse(b64(tok.split('.')[0]));
const H = K.HEADER;
const col = (name) => H.indexOf(name);

function world(opts = {}) {
  const g = createContext(Object.assign({ quiet: true }, opts.ctx || {}));
  g.setup();
  const k = K.install(g, {});
  K.setSetting(g, { CHO_LUYEN_TAP: 'CO' });
  const w = { g, k };
  w.tTok = ok(g.call('loginAdminPassword', { password: pwOf(g) })).token;
  w.sTok = ok(g.call('loginPin', { studentId: 'HS0001', pin: '0101' })).token;
  w.call = (a, b, tok) => g.call(a, Object.assign({ token: tok || w.sTok }, b || {}));
  w.nb = () => ok(w.call('notebook'));
  let r;
  do { r = ok(g.call('adminPracticeSync', { token: w.tTok, mode: 'them', filter: {}, cursor: r && r.tiepTuc })); } while (r.tiepTuc != null);
  w.byMa = Object.fromEntries(k.rows.map((x) => [x[0], x]));
  w.pool = Object.fromEntries(g._sheets.LuyenTap._data().slice(1).map((x) => [x[0], { bai: x[3], chuong: x[2], loai: x[4], bat: x[16] }]));
  w.right = (ma) => {
    const x = w.byMa[ma];
    const d = String(x[col('Đáp án')]);
    if (/Phần I –/.test(x[col('Dạng câu hỏi')])) return d.trim();
    if (/Phần II –/.test(x[col('Dạng câu hỏi')])) return g.bankTF_(d).replace(/Đ/g, 'D').split('');
    return d;
  };
  w.wrong = (ma) => {
    const a = w.right(ma);
    if (Array.isArray(a)) return a.map((v) => (v === 'D' ? 'S' : 'D'));
    if (/^[ABCD]$/.test(a)) return a === 'A' ? 'B' : 'A';
    return '99999';
  };
  /** Làm một đề luyện TU_TAO, trả mã câu và câu trả lời theo hàm fn(maKho). */
  w.practice = (so, fn) => {
    const s = ok(g.call('practiceStart', { token: w.sTok, kieu: 'TU_TAO', so, phut: 10 }));
    const q = payload(s.attemptToken).qids;
    const ans = {}; q.forEach((m, i) => { ans[i + 1] = fn(m); });
    return { qids: q, res: ok(g.call('submitExam', { token: w.sTok, attemptToken: s.attemptToken, answers: ans })) };
  };
  w.fix = (body) => ok(w.call('practiceStart', Object.assign({ kieu: 'KHAC_PHUC' }, body)));
  w.submitFix = (s, fn) => {
    const p = payload(s.attemptToken);
    const ans = {}; p.qids.forEach((q, i) => { ans[i + 1] = fn(q, p.goc[i]); });
    return ok(g.call('submitExam', { token: w.sTok, attemptToken: s.attemptToken, answers: ans }));
  };
  return w;
}
const fmt = (ms) => { const d = new Date(ms + 7 * 3600e3); const p = (n) => String(n).padStart(2, '0'); return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`; };
function backdateAll(w, sheet, daysAgo, from) {
  const rows = w.g._sheets[sheet]._data();
  const c = rows[0].indexOf('Nộp lúc');
  for (let i = from || 1; i < rows.length; i++) rows[i][c] = fmt(Date.now() - daysAgo * 86400e3);
  clearCache(w.g);
}

console.log('Đề khắc phục (Pha 7c) — máy chủ:');

t('APP_VERSION 1.8.0; kiểu KHAC_PHUC; mẫu lạ / sổ tay trống / tắt sổ tay / tắt luyện tập đều báo lỗi rõ', () => {
  const w = world();
  assert.strictEqual(ok(w.g.call('publicConfig')).version, '1.8.0');
  assert.ok(/không hợp lệ/.test(err(w.call('practiceStart', { kieu: 'KHAC_PHUC', mau: 'XYZ' }))));
  assert.ok(/chưa có câu sai/.test(err(w.call('practiceStart', { kieu: 'KHAC_PHUC', mau: 'MUOI_CAU' }))));
  assert.ok(/không hợp lệ/.test(err(w.call('practiceStart', { kieu: 'KHAC_PHUC', mau: 'MOT_LOI', ma: 'CHUA_RO' }))));
  K.setSetting(w.g, { BAT_SO_TAY: 'KHONG' }); clearCache(w.g);
  assert.ok(/tắt sổ tay/.test(err(w.call('practiceStart', { kieu: 'KHAC_PHUC', mau: 'MUOI_CAU' }))));
  K.setSetting(w.g, { BAT_SO_TAY: 'CO', CHO_LUYEN_TAP: 'KHONG' }); clearCache(w.g);
  assert.ok(/tắt luyện tập/.test(err(w.call('practiceStart', { kieu: 'KHAC_PHUC', mau: 'MUOI_CAU' }))));
});

t('TC-7.18 MUOI_CAU: ≤ 4 câu gốc + câu tương tự cùng bài, đủ 10 câu; không lộ dapAn/loiGiai/maKho; goc song song qids', () => {
  const w = world();
  const { qids } = w.practice({ TN: 6 }, (m) => w.wrong(m));
  const s = w.fix({ mau: 'MUOI_CAU' });
  const p = payload(s.attemptToken);
  assert.strictEqual(p.kieu, 'KHAC_PHUC');
  assert.strictEqual(p.qids.length, 10, s.thongBao.join(' | '));
  assert.strictEqual(p.goc.length, p.qids.length);
  const gocLam = p.qids.filter((q, i) => q === p.goc[i]);
  assert.ok(gocLam.length >= 1 && gocLam.length <= 4, 'câu gốc làm lại: ' + gocLam.length);
  assert.ok(gocLam.every((q) => qids.includes(q)));
  p.qids.forEach((q, i) => {
    if (q === p.goc[i]) return;
    const a = w.pool[q], b = w.pool[p.goc[i]];
    assert.ok(a && b && (a.bai === b.bai || a.chuong === b.chuong), 'câu tương tự cùng bài/chương: ' + q + ' ~ ' + p.goc[i]);
    assert.ok(!qids.includes(q), 'câu tương tự không phải câu em vừa sai');
  });
  assert.strictEqual(new Set(p.qids).size, p.qids.length, 'không trùng câu');
  const raw = JSON.stringify(s);
  ['dapAn', 'loiGiai', 'maKho'].forEach((k) => assert.ok(!raw.includes('"' + k + '"'), 'lộ ' + k));
  assert.strictEqual(s.durationSec, 900);
});

t('TC-7.18 câu gốc thuộc đề chưa công bố lời giải không bao giờ vào đề khắc phục (50 lần); đóng đề thì vào được', () => {
  const w = world();
  const X = Object.keys(w.pool).find((m) => /12/.test(w.byMa[m][col('Lớp')]) && w.pool[m].loai === 'TN');
  const q = ok(w.g.call('adminBankToQuestions', { token: w.tTok, maKho: [X] })).questions[0];
  const manual = { loai: 'TN', noiDung: 'Câu nhập tay tự soạn', A: 'a', B: 'b', C: 'c', D: 'd', dapAn: 'A', chuong: 'Chương thử', bai: 'Bài thử' };
  const e = ok(w.g.call('adminSaveExam', { token: w.tTok, exam: { tieuDe: 'Đề đang mở', thoiGian: 15, trangThai: 'MO', hienLoiGiai: 'NGAY' }, questions: [q, manual] })).id;
  const st = ok(w.g.call('startExam', { token: w.sTok, examId: e, mucTieu: 5 }));
  ok(w.g.call('submitExam', { token: w.sTok, attemptToken: st.attemptToken, answers: { 1: w.wrong(X), 2: 'B' } }));
  for (let i = 0; i < 50; i++) {
    let p;
    try { p = payload(w.fix({ mau: 'MUOI_CAU' }).attemptToken); } catch (x) { continue; } // không dựng được đề cũng là đúng
    assert.ok(!p.qids.includes(X) && !p.qids.some((z) => z.startsWith(e + '#')), 'lộ câu đề đang mở: ' + p.qids.join(','));
  }
  ok(w.g.call('adminSaveExam', { token: w.tTok, exam: { id: e, tieuDe: 'Đề đang mở', thoiGian: 15, trangThai: 'DONG', hienLoiGiai: 'NGAY' }, questions: [q, manual] }));
  clearCache(w.g);
  const p = payload(w.fix({ mau: 'MUOI_CAU' }).attemptToken);
  assert.ok(p.qids.includes(X), 'đề đã đóng: câu kho X làm lại được');
  assert.ok(p.qids.includes(e + '#2'), 'đề đã đóng: câu nhập tay làm lại được theo examId#stt');
});

t('TC-7.19 câu khắc phục đúng ngày 1 → gốc vàng; đúng lần nữa cùng ngày vẫn vàng; ngày 2 đúng → xanh; sai lại → đỏ', () => {
  const w = world();
  w.practice({ TN: 5 }, (m) => w.wrong(m));
  backdateAll(w, 'KetQuaLuyenTap', 3);
  const nb0 = w.nb();
  const X = nb0.items[0].key;
  const color = () => w.nb().items.find((x) => x.key === X).mau;
  const one = (ok2) => {
    const s = w.fix({ mau: 'MUOI_CAU' });
    const p = payload(s.attemptToken);
    assert.ok(p.goc.includes(X));
    return w.submitFix(s, (q, g) => (g === X ? (ok2 ? w.right(q) : w.wrong(q)) : w.right(q)));
  };
  one(true);
  backdateAll(w, 'KetQuaLuyenTap', 2, 2);
  assert.strictEqual(color(), 'vang');
  one(true);
  backdateAll(w, 'KetQuaLuyenTap', 2, 3);
  assert.strictEqual(color(), 'vang', 'hai lần đúng cùng một ngày');
  const r = one(true); // hôm nay: ngày thứ 2
  assert.strictEqual(color(), 'xanh');
  assert.ok(r.khacPhuc.some((x) => x.key === X && x.truoc === 'vang' && x.sau === 'xanh'), JSON.stringify(r.khacPhuc));
  // câu gốc xanh không vào đề nữa → làm lại chính câu đó qua bài luyện thường thì vẫn tính
  w.practice({ TN: 40 }, (m) => (m === X ? w.wrong(m) : w.right(m)));
  assert.strictEqual(color(), 'do', 'sai lại → đỏ');
  assert.strictEqual(w.nb().items.find((x) => x.key === X).lanSai, 2, 'lần sai câu tương tự không cộng vào câu gốc');
});

t('TC-7.19 câu tương tự làm sai: câu gốc về đỏ nhưng không thêm "lần sai" của câu gốc; câu tương tự sai thành mục mới', () => {
  const w = world();
  w.practice({ TN: 5 }, (m) => w.wrong(m));
  backdateAll(w, 'KetQuaLuyenTap', 2);
  const s = w.fix({ mau: 'MUOI_CAU' });
  const p = payload(s.attemptToken);
  const iSim = p.qids.findIndex((q, i) => q !== p.goc[i]);
  assert.ok(iSim >= 0, 'có câu tương tự');
  const G = p.goc[iSim], S = p.qids[iSim];
  w.submitFix(s, (q, g) => (q === S ? w.wrong(q) : w.right(q)));
  const nb = w.nb();
  const g = nb.items.find((x) => x.key === G);
  assert.strictEqual(g.mau, 'do');
  assert.strictEqual(g.lanSai, 1);
  assert.ok(nb.items.some((x) => x.key === S), 'câu tương tự sai thành một mục riêng');
});

t('TC-7.20 ON_NHANH 5 câu 420 giây nhắm loại lỗi nặng nhất; MOT_LOI ma=SOT ưu tiên Phần II', () => {
  const w = world();
  w.practice({ TN: 4, DS: 2 }, (m) => w.wrong(m));
  const nb = w.nb();
  const tn = nb.items.filter((x) => x.loai === 'TN').map((x) => x.key), ds = nb.items.filter((x) => x.loai === 'DS').map((x) => x.key);
  ok(w.call('notebookTag', { items: tn.map((k) => ({ key: k, ma: 'DOC_DE' })).concat(ds.map((k) => ({ key: k, ma: 'SOT' }))) }));
  const s = w.fix({ mau: 'ON_NHANH' });
  const p = payload(s.attemptToken);
  assert.strictEqual(s.durationSec, 420);
  assert.ok(p.qids.length <= 5 && p.qids.length >= 1);
  assert.ok(p.goc.every((g) => tn.includes(g)), 'nhắm loại lỗi nặng nhất (Đọc sai đề, nhiều câu hơn)');
  assert.ok(/Đọc sai đề/.test(s.exam.tieuDe), s.exam.tieuDe);
  const s2 = w.fix({ mau: 'MOT_LOI', ma: 'SOT' });
  const p2 = payload(s2.attemptToken);
  assert.ok(p2.goc.every((g) => ds.includes(g)));
  const sims = p2.qids.filter((q, i) => q !== p2.goc[i]);
  const hasDsInPool = Object.keys(w.pool).some((m) => w.pool[m].loai === 'DS' && !ds.includes(m));
  if (hasDsInPool && sims.length) assert.ok(sims.some((q) => w.pool[q].loai === 'DS'), 'ưu tiên Phần II: ' + sims.map((q) => w.pool[q].loai).join(','));
  assert.strictEqual(s2.durationSec, 420);
});

t('TC-7.21 nộp đề khắc phục ghi KetQuaLuyenTap (kieu KHAC_PHUC, có goc), KetQua không thêm hàng; xem lại có lời giải', () => {
  const w = world();
  w.practice({ TN: 5 }, (m) => w.wrong(m));
  const nKQ = w.g._sheets.KetQua._data().length;
  const r = w.submitFix(w.fix({ mau: 'MUOI_CAU' }), (q) => w.right(q));
  assert.strictEqual(w.g._sheets.KetQua._data().length, nKQ);
  const rows = w.g._sheets.KetQuaLuyenTap._data();
  const last = rows[rows.length - 1];
  assert.strictEqual(last[rows[0].indexOf('Kiểu')], 'KHAC_PHUC');
  const ct = JSON.parse(last[rows[0].indexOf('Chi tiết (JSON)')]);
  assert.ok(ct.every((d) => d.goc), 'mỗi câu có goc');
  assert.ok(r.items.every((it) => it.dapAn != null), 'có đáp án ngay');
  assert.strictEqual(r.kieu, 'KHAC_PHUC');
  const lb = ok(w.call('leaderboard', {}));
  assert.ok(!JSON.stringify(lb).includes(r.id), 'không vào bảng xếp hạng');
});

t('TC-7.22 token đề khắc phục bị sửa goc hoặc qids thì bị từ chối', () => {
  const w = world();
  w.practice({ TN: 5 }, (m) => w.wrong(m));
  const s = w.fix({ mau: 'MUOI_CAU' });
  const [body, sig] = s.attemptToken.split('.');
  const p = JSON.parse(b64(body));
  const enc = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const p1 = Object.assign({}, p, { goc: p.goc.map(() => 'KHAC') });
  assert.ok(/không hợp lệ|quá hạn/.test(err(w.call('submitExam', { attemptToken: enc(p1) + '.' + sig, answers: {} }))));
  const p2 = Object.assign({}, p, { qids: p.qids.slice().reverse() });
  assert.ok(/không hợp lệ|quá hạn/.test(err(w.call('submitExam', { attemptToken: enc(p2) + '.' + sig, answers: {} }))));
  ok(w.call('submitExam', { attemptToken: s.attemptToken, answers: {} }));
});

t('Vòng 2 (R-1): trong một bài, làm lại câu gốc vẫn sai nhưng câu tương tự đúng → câu gốc đỏ (không vàng, không xanh)', () => {
  const w = world();
  w.practice({ TN: 5 }, (m) => w.wrong(m));
  backdateAll(w, 'KetQuaLuyenTap', 3);
  for (let day = 2; day >= 1; day--) {
    const s = w.fix({ mau: 'MUOI_CAU' });
    const p = payload(s.attemptToken);
    const G = p.qids.find((q, i) => q === p.goc[i] && p.qids.some((z, j) => z !== q && p.goc[j] === q));
    assert.ok(G, 'cần câu gốc vừa làm lại vừa có câu tương tự');
    w.submitFix(s, (q, g) => (q === G ? w.wrong(q) : w.right(q)));
    const it = w.nb().items.find((x) => x.key === G);
    assert.strictEqual(it.mau, 'do', 'ngày ' + day);
    backdateAll(w, 'KetQuaLuyenTap', day, w.g._sheets.KetQuaLuyenTap._data().length - 1);
  }
});

t('Vòng 2 (G-1, R-2): "Ôn phần hổng kiến thức" lấy cả câu chưa phân loại; ON_NHANH bỏ qua loại lỗi chỉ còn câu đã gỡ', () => {
  const w = world();
  w.practice({ TN: 5 }, (m) => w.wrong(m));
  const s = w.fix({ mau: 'MOT_LOI', ma: 'HONG' });
  assert.ok(payload(s.attemptToken).qids.length >= 1, 'câu chưa phân loại vào được đề Hổng kiến thức');
  const s2 = w.fix({ mau: 'ON_NHANH' });
  assert.ok(payload(s2.attemptToken).qids.length >= 1);
});

t('TC-7.23 (khuyến nghị) học sinh có 300 bài nộp: notebook < 3 giây trên shim chậm (SHEET_READ_MS)', () => {
  const w = world({ ctx: { sheetReadMs: 20 } });
  const e = ok(w.g.call('adminSaveExam', { token: w.tTok, exam: { tieuDe: 'Đề nhiều lần', thoiGian: 15, trangThai: 'DONG', hienLoiGiai: 'NGAY', soLanLam: 0 },
    questions: Array.from({ length: 10 }, (_, i) => ({ loai: 'TN', noiDung: 'Câu tự soạn ' + i, A: 'a', B: 'b', C: 'c', D: 'd', dapAn: 'A', bai: 'Bài ' + (i % 3) })) })).id;
  const rows = w.g._sheets.KetQua._data();
  const head = rows[0];
  for (let r = 0; r < 300; r++) {
    const row = head.map(() => '');
    const set = (lab, v) => { row[head.indexOf(lab)] = v; };
    set('Nộp lúc', fmt(Date.now() - (300 - r) * 3600e3)); set('Mã HS', 'HS0001'); set('Mã đề', e); set('Mã bài', 'KQGIA' + r); set('Đề', 'Đề nhiều lần');
    set('Chi tiết (JSON)', JSON.stringify(Array.from({ length: 10 }, (_, i) => ({ s: i + 1, l: 'TN', a: (r + i) % 3 ? 'A' : 'B', sc: (r + i) % 3 ? 0.25 : 0, m: 0.25, p: 1 }))));
    rows.push(row);
  }
  clearCache(w.g);
  const t0 = Date.now();
  const nb = w.nb();
  const ms = Date.now() - t0;
  assert.strictEqual(nb.items.length, 10);
  console.log('      notebook với 300 bài: ' + ms + ' ms');
  assert.ok(ms < 3000, ms + ' ms');
});

console.log(`\n${passed} kiểm thử đạt${failed ? ', ' + failed + ' KHÔNG ĐẠT' : '.'}`);
