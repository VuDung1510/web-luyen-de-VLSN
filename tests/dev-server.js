// Máy chủ thử nghiệm cục bộ: chạy giao diện + máy chủ giả lập (Code.gs trên Node).
// node tests/dev-server.js [cổng]   → mở http://localhost:8787
//
// Biến môi trường:
//   SERVER_COMPAT=1.0.0  nạp đúng Code.gs 1.0.0 (tests/fixtures/Code-1.0.0.gs) thay cho apps-script/Code.gs,
//                        để thử giao diện với máy chủ cũ đang chạy thật.
//   LATENCY_MS=1500      mỗi lần gọi máy chủ chậm thêm chừng ấy mili-giây (giả lập Apps Script).
//   SHEET_READ_MS=300    chi phí giả mỗi lần đọc cả một trang tính (gas-shim).
//   CACHE_MS=20          chi phí giả mỗi lần gọi CacheService (gas-shim).
//   BANK=0               không gắn kho câu hỏi giả (mặc định: máy chủ mới có kho giả tests/fixtures/kho-gia.js,
//                        KHO_CAU_HOI_ID đã điền sẵn; BANK_ROWS=3000 dùng kho lớn tự sinh thay cho kho chuẩn).
//   MAKE_COPY_MS=1000    chi phí giả (đồng hồ giả) mỗi lần chép hình từ kho.
//   PRACTICE=0           (Pha 4) để CHO_LUYEN_TAP=KHONG (mặc định máy chủ mới: CO).
//   PRACTICE_POOL=0      (Pha 4) không đưa sẵn câu kho giả vào pool luyện tập (mặc định: đưa mọi câu dùng được).
// GET /__stats trả số lần đọc trang tính / gọi CacheService / số request theo action; /__stats?reset=1 để đặt lại.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { createContext } = require('./gas-shim');

const PORT = +process.argv[2] || +process.env.PORT || 8787;
const ROOT = path.join(__dirname, '..');
const COMPAT = process.env.SERVER_COMPAT || '';
const LATENCY = +process.env.LATENCY_MS || 0;
let codePath;
if (COMPAT) {
  codePath = path.join(__dirname, 'fixtures', 'Code-' + COMPAT + '.gs');
  if (!fs.existsSync(codePath)) { console.error('Không có ' + codePath); process.exit(1); }
}
const g = createContext({ quiet: true, codePath, makeCopyMs: +process.env.MAKE_COPY_MS || 0 });
g.setup();
let kho = null;
if (!COMPAT && process.env.BANK !== '0') {
  const K = require('./fixtures/kho-gia');
  kho = K.install(g, process.env.BANK_ROWS ? { rows: K.bigRows(+process.env.BANK_ROWS, { hinh: true }), missingImages: 0 } : {});
}
if (!COMPAT) {
  // Pha 4: bật luyện tập và đưa sẵn câu kho giả vào pool (giáo viên làm việc này ở tab Ngân hàng)
  const K = require('./fixtures/kho-gia');
  K.setSetting(g, { CHO_LUYEN_TAP: process.env.PRACTICE === '0' ? 'KHONG' : 'CO' });
  if (kho && process.env.PRACTICE_POOL !== '0') {
    const pw = g._sheets.CaiDat._data().find((r) => r[0] === 'MAT_KHAU_QUAN_TRI')[1];
    const tok = JSON.parse(g.doPost({ postData: { contents: JSON.stringify({ action: 'loginAdminPassword', password: pw }) } }).getContent()).data.token;
    let cur, r;
    do {
      g.__MEMO();
      r = JSON.parse(g.doPost({ postData: { contents: JSON.stringify({ action: 'adminPracticeSync', token: tok, filter: {}, mode: 'them', cursor: cur }) } }).getContent());
      cur = r.ok ? r.data.tiepTuc : null;
    } while (cur != null);
    if (!r.ok) console.error('Không đưa được câu vào pool:', r.error);
  }
}
const adminPw = g._sheets.CaiDat._data().find((r) => r[0] === 'MAT_KHAU_QUAN_TRI')[1];
let actions = {};

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url.startsWith('/exec')) {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const run = () => {
        try { const a = JSON.parse(body).action; actions[a] = (actions[a] || 0) + 1; } catch (e) { /* bỏ qua */ }
        g.__MEMO();
        const out = g.doPost({ postData: { contents: body } });
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(out.getContent());
      };
      if (LATENCY) setTimeout(run, LATENCY); else run();
    });
    return;
  }
  if (req.url.startsWith('/__stats')) {
    const s = g._stats;
    const out = JSON.stringify({ compat: COMPAT || null, reads: s.reads, writes: s.writes, cacheCalls: s.cacheCalls, actions });
    if (/reset=1/.test(req.url)) { g._resetStats(); actions = {}; }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(out);
  }
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/assets/js/config.js') {
    res.writeHead(200, { 'Content-Type': TYPES['.js'] });
    return res.end(`window.APP_CONFIG = { API_URL: 'http://localhost:${PORT}/exec' };`);
  }
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); return res.end('404'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

server.listen(PORT, () => {
  console.log(`Đang chạy: http://localhost:${PORT}  (quản trị: /admin.html, mật khẩu: ${adminPw})` +
    (COMPAT ? `  [máy chủ giả lập ${COMPAT}]` : '') + (LATENCY ? `  [trễ ${LATENCY} ms]` : ''));
  console.log('Học sinh mẫu: lớp 12A1, Học Sinh Mẫu, PIN 0101');
  if (kho) console.log(`Kho câu hỏi giả: ${kho.rows.length} hàng (Ngân hàng câu hỏi ở /admin.html#/ngan-hang)`);
});
module.exports = { server, adminPw, g, kho };
