// Pha 6b — KIỂM THỬ ĐỘC LẬP (E2E): tải file Word có hình neo ở đầu "Câu 2:" và hình cùng dòng ở đầu ý "a."
// vào trình soạn đề → Nhập nhanh → Tải file lên. Chạy cả máy chủ mới và SERVER_COMPAT=1.0.0.
//   NODE_PATH=$(npm root -g) LIBS_DIR=<node_modules có katex, chart.js, jszip, xlsx> node tests/pha6b-hinh-kiem-thu.e2e.js
// Cổng: PORT_NEW (8790), PORT_OLD (8791). Đếm adminUploadImage qua /__stats của dev-server.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const LIBS = process.env.LIBS_DIR;
if (!LIBS) { console.error('Cần LIBS_DIR'); process.exit(2); }
const PORT_NEW = +(process.env.PORT_NEW || 8790);
const PORT_OLD = +(process.env.PORT_OLD || 8791);
const M = require('./fixtures/make-docx')(LIBS);
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else fail++; console.log('  ' + (c ? '✓' : '✗') + ' ' + msg); };

function startServer(port, env) {
  return new Promise((resolve, reject) => {
    const pr = spawn(process.execPath, [path.join(__dirname, 'dev-server.js'), String(port)], { env: Object.assign({}, process.env, env), stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    pr.stdout.on('data', (d) => { out += d; const m = out.match(/mật khẩu: (\S+)\)/); if (m) resolve({ proc: pr, pw: m[1], base: 'http://localhost:' + port }); });
    pr.stderr.on('data', (d) => { out += d; });
    pr.on('exit', (c) => reject(new Error('dev-server thoát ' + c + ': ' + out)));
    setTimeout(() => reject(new Error('dev-server không khởi động: ' + out)), 10000);
  });
}
const stats = async (base, reset) => (await (await fetch(base + '/__stats' + (reset ? '?reset=1' : ''))).json());
const uploads = async (base) => ((await stats(base)).actions.adminUploadImage || 0);

async function routeCdn(page) {
  await page.route(/fonts\.(googleapis|gstatic)\.com|accounts\.google\.com|lh3\.googleusercontent\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: M.png(8, 8, [90, 90, 90]) }));
  await page.route(/cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net/, (r) => {
    const u = r.request().url();
    const map = [
      [/jszip\/3\.10\.1\/jszip\.min\.js$|jszip@3\.10\.1\/dist\/jszip\.min\.js$/, 'jszip/dist/jszip.min.js', 'text/javascript'],
      [/xlsx\/0\.18\.5\/xlsx\.full\.min\.js$|xlsx@0\.18\.5\/dist\/xlsx\.full\.min\.js$/, 'xlsx/dist/xlsx.full.min.js', 'text/javascript'],
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

// Đề tự sinh: PHẦN I 4 câu (hình neo đầu "Câu 2:"), PHẦN II 1 câu Đúng/Sai (hình cùng dòng đầu ý "a."), PHẦN III 1 câu
async function makeDocx() {
  const media = { rId1: { name: 'image1.png', data: M.png(120, 80, [200, 40, 40]) }, rId2: { name: 'image2.png', data: M.png(110, 70, [40, 40, 200]) } };
  const B = [M.p('PHẦN I. TRẮC NGHIỆM NHIỀU LỰA CHỌN')];
  for (let i = 1; i <= 4; i++) {
    const s = 'Câu ' + i + ': Nội dung câu ' + i + '.';
    B.push(i === 2 ? M.p([M.img('rId1', { anchor: true }), s]) : M.p(s));
    B.push(M.p('A. pa ' + i + '\tB. pb ' + i), M.p('C. pc ' + i + '\tD. pd ' + i), M.p('Đáp án: ' + 'ABCD'[i - 1]));
  }
  B.push(M.p('PHẦN II. TRẮC NGHIỆM ĐÚNG SAI'), M.p('Câu 1: Cho một khối khí.'));
  ['a', 'b', 'c', 'd'].forEach((k) => B.push(k === 'a' ? M.p([M.img('rId2'), 'a. Ý a đúng sai.']) : M.p(k + '. Ý ' + k + ' đúng sai.')));
  B.push(M.p('PHẦN III. TRẮC NGHIỆM TRẢ LỜI NGẮN'), M.p('Câu 1: Tính áp suất (Pa).'), M.p('Đáp số: 2,5'));
  return M.docx(B, { media });
}

async function runMode(browser, compat) {
  const tag = compat ? '[1.0.0] ' : '[mới] ';
  const errors = [];
  const srv = await startServer(compat ? PORT_OLD : PORT_NEW, Object.assign({ LATENCY_MS: '50' }, compat ? { SERVER_COMPAT: '1.0.0' } : {}));
  const B = srv.base;
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const ad = await ctx.newPage();
    ad.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    ad.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
    ad.on('dialog', (d) => d.accept());
    await routeCdn(ad);
    await ad.goto(B + '/admin.html');
    await ad.fill('#pw', srv.pw);
    await ad.click('#btnLogin');
    await ad.waitForSelector('text=Bài nộp mới nhất');
    await ad.goto(B + '/admin.html#/de-thi/moi');
    await ad.waitForSelector('#btnImport');
    await ad.waitForTimeout(200);
    await stats(B, true);
    await ad.click('#btnImport');
    await ad.waitForSelector('#impTabFile');
    await ad.click('#impTabFile');
    await ad.waitForSelector('#impFileInput', { state: 'attached' });
    await ad.setInputFiles('#impFileInput', { name: 'de-hinh-neo.docx', mimeType: DOCX, buffer: await makeDocx() });
    await ad.waitForFunction(() => { const r = document.querySelector('#impResult'); return r && /Tìm thấy/.test(r.textContent) && !/Đọc file…|Đổi công thức…/.test(r.textContent); }, null, { timeout: 15000 });
    const res = (await ad.$eval('#impResult', (r) => r.innerText)).replace(/[ \t]+/g, ' ');
    ok(/Tìm thấy\s*6\s*câu/.test(res) && /Phần I:\s*4\s*·\s*Phần II:\s*1\s*·\s*Phần III:\s*1/.test(res), tag + 'bảng kết quả: "' + (res.match(/Tìm thấy[^\n]*/) || [''])[0] + '" / "' + (res.match(/Phần I:[^\n]*/) || [''])[0] + '"');
    ok(/Hình[^\n]*2/.test(res), tag + 'bảng kết quả dòng hình: "' + (res.match(/Hình[^\n]*/) || [''])[0] + '"');
    const upBefore = await uploads(B);
    await ad.click('#impReplace');
    await ad.waitForFunction(() => !document.querySelector('.modal #impResult'), null, { timeout: 30000 });
    await ad.waitForTimeout(600);
    const upAfter = await uploads(B);
    ok(upBefore === 0 && upAfter === 2, tag + `adminUploadImage trước khi bấm = ${upBefore}, sau khi bấm = ${upAfter} (mong 0 rồi 2)`);
    const st = await ad.$$eval('.qedit', (qs) => qs.map((q) => { const o = {}; q.querySelectorAll('[data-f]').forEach((el) => { o[el.dataset.f] = el.value; }); return o; }));
    ok(st.length === 6, tag + 'trình soạn có ' + st.length + ' câu (mong 6)');
    const q2 = st[1] || {}, ds = st[4] || {};
    const has = (q) => /^https?:/.test(q.hinhAnh || '') || /!\[\]\(https?:/.test(Object.values(q).join(' '));
    ok(/^https?:/.test(q2.hinhAnh || '') && /Nội dung câu 2\./.test(q2.noiDung || '') && ['A', 'B', 'C', 'D'].every((k) => (q2[k] || '').trim()), tag + `câu 2: hinhAnh=${q2.hinhAnh || '—'}, nội dung="${q2.noiDung}", A–D đủ`);
    ok(st.filter((q, i) => i !== 1 && i !== 4).every((q) => !has(q)), tag + 'các câu khác không có hình');
    ok(has(ds) && /Ý a đúng sai/.test(ds.A || '') && ['B', 'C', 'D'].every((k) => (ds[k] || '').trim()), tag + `câu Đúng/Sai: có hình=${has(ds)}, ý a="${(ds.A || '').slice(0, 60)}", đủ 4 ý`);
    ok(errors.length === 0, tag + 'không lỗi trang: ' + (errors.join(' | ') || 'không'));
    await ctx.close();
  } finally { srv.proc.kill(); }
}

(async () => {
  const browser = await chromium.launch();
  try { await runMode(browser, false); await runMode(browser, true); }
  catch (e) { fail++; console.log('  ✗ ' + (e.stack || e)); }
  finally { await browser.close(); }
  console.log('\n' + pass + ' đạt, ' + fail + ' lỗi');
  process.exit(fail ? 1 : 0);
})();
