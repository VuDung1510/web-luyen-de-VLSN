// Máy chủ thử nghiệm cục bộ: chạy giao diện + máy chủ giả lập (Code.gs trên Node).
// node tests/dev-server.js [cổng]   → mở http://localhost:8787
const http = require('http');
const fs = require('fs');
const path = require('path');
const { createContext } = require('./gas-shim');

const PORT = +process.argv[2] || 8787;
const ROOT = path.join(__dirname, '..');
const g = createContext({ quiet: true });
g.setup();
const adminPw = g._sheets.CaiDat._data().find((r) => r[0] === 'MAT_KHAU_QUAN_TRI')[1];

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url.startsWith('/exec')) {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      g.__MEMO();
      const out = g.doPost({ postData: { contents: body } });
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(out.getContent());
    });
    return;
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
  console.log(`Đang chạy: http://localhost:${PORT}  (quản trị: /admin.html, mật khẩu: ${adminPw})`);
  console.log('Học sinh mẫu: lớp 12A1, Học Sinh Mẫu, PIN 0101');
});
module.exports = { server, adminPw };
