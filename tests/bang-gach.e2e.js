// Pha 6b — e2e ngắn: câu có bảng kẻ gạch (pandoc, gạch "–", khoảng trắng bị gộp) hiện thành <table> khi học sinh làm bài.
//   NODE_PATH=$(npm root -g) LIBS_DIR=... node tests/bang-gach.e2e.js
// Biến môi trường: PORT (8781), SHOTS (docs/bao-cao/anh/pha-6b). Ảnh: 01-bang-gach.png.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = +(process.env.PORT || 8781);
const SHOTS = process.env.SHOTS || path.join(__dirname, '..', 'docs', 'bao-cao', 'anh', 'pha-6b');
const LIBS = process.env.LIBS_DIR;
fs.mkdirSync(SHOTS, { recursive: true });

function startServer(port) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [path.join(__dirname, 'dev-server.js'), String(port)], { env: Object.assign({}, process.env, { BANK: '0' }), stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    p.stdout.on('data', (d) => { out += d; const m = out.match(/mật khẩu: (\S+)\)/); if (m) resolve({ proc: p, pw: m[1], base: 'http://localhost:' + port }); });
    p.stderr.on('data', (d) => { out += d; });
    p.on('exit', (c) => reject(new Error('dev-server thoát ' + c + ': ' + out)));
    setTimeout(() => reject(new Error('dev-server không khởi động: ' + out)), 10000);
  });
}
async function api(base, action, body) {
  const r = await fetch(base + '/exec', { method: 'POST', body: JSON.stringify(Object.assign({ action }, body || {})) });
  const j = await r.json();
  if (!j.ok) throw new Error(action + ': ' + j.error);
  return j.data;
}
async function routeCdn(page) {
  await page.route(/fonts\.(googleapis|gstatic)\.com|accounts\.google\.com|lh3\.googleusercontent\.com/, (r) => r.fulfill({ status: 200, body: '' }));
  await page.route(/cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net/, (r) => {
    const u = r.request().url();
    if (!LIBS) return r.fulfill({ status: 200, body: '' });
    const map = [
      [/katex\.min\.css$/, 'katex/dist/katex.min.css', 'text/css'],
      [/auto-render\.min\.js$/, 'katex/dist/contrib/auto-render.min.js', 'text/javascript'],
      [/katex\.min\.js$/, 'katex/dist/katex.min.js', 'text/javascript'],
      [/chart\.umd\.min\.js$/, 'chart.js/dist/chart.umd.js', 'text/javascript'],
      [/fonts\/(.+)$/, null, 'font/woff2']
    ];
    for (const [re, file, type] of map) {
      const m = u.match(re);
      if (m) return r.fulfill({ status: 200, contentType: type, body: fs.readFileSync(path.join(LIBS, file || 'katex/dist/fonts/' + m[1])) });
    }
    return r.fulfill({ status: 404, body: '' });
  });
}

// Nội dung tự soạn (không chép đề thật), đúng kiểu lỗi: gạch "–" lẫn "-", khoảng trắng canh cột đã gộp thành 1 dấu cách.
const D = '–'.repeat(35) + '-';
const NOI_DUNG = ['Đo hiệu điện thế giữa hai cực của một nguồn điện mẫu ứng với cường độ dòng điện khác nhau, được bảng sau (số liệu tự soạn):',
  D, 'Lần đo $U$ (V) $I$ (mA)', '–'.repeat(12) + ' ' + '–'.repeat(10) + '- ' + '–'.repeat(12),
  '1 4,52 100', '2 4,49 160', '3 4,45 240', D, 'Suất điện động của nguồn gần nhất với giá trị nào sau đây?'].join('\n');

(async () => {
  const errors = [];
  const srv = await startServer(PORT);
  const browser = await chromium.launch();
  try {
    const B = srv.base;
    const tTok = (await api(B, 'loginAdminPassword', { password: srv.pw })).token;
    const ex = await api(B, 'adminSaveExam', { token: tTok, exam: { tieuDe: 'Bảng kẻ gạch — Pha 6b', lop: '12A1', thoiGian: 10, trangThai: 'MO' }, questions: [
      { loai: 'TN', noiDung: NOI_DUNG, A: '$4,50$ V', B: '$4,55$ V', C: '$4,60$ V', D: '$4,40$ V', dapAn: 'B' }
    ] });

    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const st = await ctx.newPage();
    st.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    st.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
    await routeCdn(st);
    await st.goto(B + '/');
    await st.waitForSelector('#selClass option[value="12A1"]', { state: 'attached' });
    await st.selectOption('#selClass', '12A1');
    await st.waitForSelector('#selStudent option[value="HS0001"]', { state: 'attached' });
    await st.selectOption('#selStudent', 'HS0001');
    await st.fill('#pin', '0101');
    await st.click('#btnLogin');
    await st.waitForSelector('text=Bảng kẻ gạch — Pha 6b');
    await st.locator('.card', { hasText: 'Bảng kẻ gạch — Pha 6b' }).last().locator('text=Bắt đầu làm bài').first().click();
    await st.waitForSelector('#btnStart');
    if (await st.$('[data-goal="8"]')) await st.click('[data-goal="8"]');
    await st.click('#btnStart');
    await st.waitForSelector('.timer');
    await st.waitForSelector('.q-body table.q-table');
    await st.waitForTimeout(400);
    const info = await st.$eval('.q-body', (b) => {
      const t = b.querySelector('table.q-table');
      return {
        th: [...t.querySelectorAll('thead th')].map((x) => x.textContent.replace(/\s+/g, ' ').trim()),
        rows: [...t.querySelectorAll('tbody tr')].map((r) => [...r.children].map((c) => c.textContent.trim())),
        katexTh: t.querySelectorAll('thead .katex').length,
        dash: /–––/.test(b.textContent)
      };
    });
    console.log(JSON.stringify(info));
    if (info.th.length !== 3) errors.push('Tiêu đề không đủ 3 cột: ' + JSON.stringify(info.th));
    if (info.rows.length !== 3 || info.rows.some((r) => r.length !== 3)) errors.push('Hàng dữ liệu sai: ' + JSON.stringify(info.rows));
    if (JSON.stringify(info.rows[0]) !== '["1","4,52","100"]') errors.push('Hàng 1 sai: ' + JSON.stringify(info.rows[0]));
    if (info.th[0] !== 'Lần đo') errors.push('Ô tiêu đề 1 sai: ' + info.th[0]);
    if (LIBS && info.katexTh !== 2) errors.push('KaTeX chưa vẽ công thức trong tiêu đề: ' + info.katexTh);
    if (info.dash) errors.push('Vẫn còn dòng gạch trong nội dung câu');
    await st.locator('.q').first().screenshot({ path: path.join(SHOTS, '01-bang-gach.png') });
  } catch (e) {
    errors.push(e.stack || String(e));
  } finally {
    await browser.close();
    srv.proc.kill();
  }
  if (errors.length) { console.error('LỖI:\n' + errors.join('\n')); process.exit(1); }
  console.log('bang-gach.e2e: OK (ảnh ' + path.join(SHOTS, '01-bang-gach.png') + ')');
})();
