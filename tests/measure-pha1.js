// Đo số liệu Pha 1 (không phải kiểm thử đạt/không đạt).
//
// 1) Phía máy chủ (gas-shim, chi phí giả):
//    node tests/measure-pha1.js backend [đường dẫn Code.gs cũ]
//    So sánh số lần đọc trang tính (chỉ số chính) và ms tham khảo giữa cách gọi cũ (trước Pha 1) và mới,
//    với SHEET_READ_MS (mặc định 300) và CACHE_MS (mặc định 15).
//
// 2) Trình duyệt (Playwright, dev-server đang chạy, nên đặt LATENCY_MS=1500):
//    ADMIN_PW=... node tests/measure-pha1.js browser [http://localhost:8787]
//    Đo thời gian từ hashchange đến khi nội dung chính hiện (trung vị 5 lần), thời gian hiện khung xương,
//    và số request khi tải trang chủ học sinh đã đăng nhập.
const path = require('path');
const { createContext } = require('./gas-shim');

const median = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };

function backend(oldCode) {
  const sheetReadMs = +(process.env.SHEET_READ_MS || 300);
  const cacheMs = +(process.env.CACHE_MS || 15);
  function prepare(codePath) {
    const g = createContext({ quiet: true, codePath, sheetReadMs: 0, cacheMs: 0 });
    g.setup();
    const pw = g._sheets.CaiDat._data().find((r) => r[0] === 'MAT_KHAU_QUAN_TRI')[1];
    const tTok = JSON.parse(g.doPost({ postData: { contents: JSON.stringify({ action: 'loginAdminPassword', password: pw }) } }).getContent()).data.token;
    // dữ liệu giả cỡ một lớp thật: 40 học sinh, 8 đề × 28 câu, 300 bài nộp
    g.call('adminImportStudents', { token: tTok, rows: Array.from({ length: 40 }, (_, i) => ({ hoTen: 'Học Sinh ' + i, lop: '12A' + (i % 3 + 1), ngaySinh: '0' + (i % 9 + 1) + '/03/2008' })) });
    const ex = g.call('adminGetExam', { token: tTok, examId: 'DEMAU' }).data;
    for (let k = 0; k < 7; k++) {
      const qs = Array.from({ length: 28 }, (_, i) => Object.assign({}, ex.questions[i % 6]));
      g.call('adminSaveExam', { token: tTok, exam: Object.assign({}, ex.exam, { id: '', tieuDe: 'Đề ' + k, trangThai: 'MO' }), questions: qs });
    }
    const sTok = g.call('loginPin', { studentId: 'HS0001', pin: '0101' }).data.token;
    for (let i = 0; i < 300; i++) {
      const s = g.call('startExam', { token: sTok, examId: 'DEMAU' }).data;
      g.call('submitExam', { token: sTok, attemptToken: s.attemptToken, answers: { 1: 'C', 2: 'B' } });
    }
    g._env.sheetReadMs = sheetReadMs; g._env.cacheMs = cacheMs;
    Object.keys(g._cache).forEach((k) => delete g._cache[k]); // đệm trống như máy chủ vừa khởi động
    return { g, tTok, sTok };
  }
  const OLD = {
    'HS: mở trang chủ': ['publicConfig', 'listExams', 'myResults'],
    'HS: Lịch sử': ['myResults'], 'HS: Thống kê': ['myStats'], 'HS: Xếp hạng': ['leaderboard'],
    'HS: về Trang chủ': ['listExams', 'myResults'],
    'GV: Tổng quan': ['adminOverview'], 'GV: Đề thi': ['adminListExams'], 'GV: Kết quả': ['adminListExams', 'adminListStudents', 'adminResults'],
    'GV: về Tổng quan': ['adminOverview']
  };
  const NEW = Object.assign({}, OLD, {
    'HS: mở trang chủ': ['publicConfig', 'bootstrap'], 'HS: về Trang chủ': ['bootstrap'], 'GV: Tổng quan': ['adminBootstrap']
  });
  function run(label, codePath, plan) {
    const { g, tTok, sTok } = prepare(codePath);
    const rows = [];
    let totalReads = 0, totalMs = 0, totalReq = 0;
    for (let round = 1; round <= 2; round++) {
      Object.keys(plan).forEach((step) => {
        g._resetStats();
        const t0 = Date.now();
        plan[step].forEach((a) => {
          const r = g.call(a, { token: a.startsWith('admin') ? tTok : sTok });
          if (!r.ok) throw new Error(a + ': ' + r.error);
        });
        const ms = Date.now() - t0;
        const reads = Object.values(g._stats.reads).reduce((s, n) => s + n, 0);
        rows.push({ round, step, req: plan[step].length, reads, cache: g._stats.cacheCalls, ms });
        totalReads += reads; totalMs += ms; totalReq += plan[step].length;
      });
    }
    console.log(`\n== ${label} (SHEET_READ_MS=${sheetReadMs}, CACHE_MS=${cacheMs}) ==`);
    console.log('vòng | bước                 | request | đọc Sheet | gọi Cache | ms (tuần tự)');
    rows.forEach((r) => console.log(`  ${r.round}  | ${r.step.padEnd(20)} | ${String(r.req).padStart(7)} | ${String(r.reads).padStart(9)} | ${String(r.cache).padStart(9)} | ${String(r.ms).padStart(6)}`));
    console.log(`TỔNG: ${totalReq} request, ${totalReads} lần đọc Sheet, ${totalMs} ms`);
    return { totalReads, totalMs, totalReq };
  }
  const a = run('TRƯỚC Pha 1 (cách gọi cũ, ' + path.basename(oldCode) + ')', oldCode, OLD);
  const b = run('SAU Pha 1 (Code.gs mới, cách gọi mới)', undefined, NEW);
  console.log(`\nSố lần đọc Sheet: ${a.totalReads} → ${b.totalReads}; request: ${a.totalReq} → ${b.totalReq}; ms: ${a.totalMs} → ${b.totalMs}`);
}

async function browser(base) {
  const { chromium } = require('playwright');
  const br = await chromium.launch();
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.route(/cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com|accounts\.google\.com/, (r) => r.fulfill({ status: 200, body: '' }));
  let posts = [];
  page.on('request', (r) => { if (r.method() === 'POST') { try { posts.push(JSON.parse(r.postData()).action); } catch (e) { posts.push('?'); } } });
  // đăng nhập
  await page.goto(base + '/');
  await page.waitForSelector('#selClass option[value="12A1"]', { state: 'attached', timeout: 60000 });
  await page.selectOption('#selClass', '12A1');
  await page.waitForSelector('#selStudent option[value="HS0001"]', { state: 'attached', timeout: 60000 });
  await page.selectOption('#selStudent', 'HS0001');
  await page.fill('#pin', '0101');
  await page.click('#btnLogin');
  await page.waitForSelector('text=Đề đang mở', { timeout: 60000 });

  // thời gian tải lại trang chủ (đã đăng nhập) + số request
  posts = [];
  const t0 = Date.now();
  await page.reload();
  await page.waitForSelector('.exam-card', { timeout: 60000 });
  const firstPaint = Date.now() - t0;
  await page.waitForTimeout(+(process.env.LATENCY_MS || 1500) + 1500);
  console.log(`Tải lại trang chủ đã đăng nhập: nội dung hiện sau ${firstPaint} ms; POST: ${JSON.stringify(posts)}`);

  // chờ nội dung chính hiện sau khi đổi hash, đo trong trang
  const SEL = { '#/': '.exam-card', '#/lich-su': 'h1', '#/thong-ke': 'h1', '#/bang-xep-hang': 'h1' };
  async function switchTo(hash, sel, skeletonOnly) {
    return page.evaluate(([h, s, sk]) => new Promise((resolve) => {
      const app = document.getElementById('app');
      const t = performance.now();
      const done = () => {
        if (sk ? app.querySelector('.sk-wrap, .loading, ' + s) : (app.querySelector(s) && !app.querySelector('.sk-wrap'))) { obs.disconnect(); resolve(Math.round(performance.now() - t)); return true; }
        return false;
      };
      const obs = new MutationObserver(done);
      obs.observe(app, { childList: true, subtree: true });
      location.hash = h;
      setTimeout(() => { if (!done()) { /* chờ tiếp */ } }, 0);
      setTimeout(() => { obs.disconnect(); resolve(-1); }, 30000);
    }), [hash, sel, !!skeletonOnly]);
  }
  const order = ['#/lich-su', '#/thong-ke', '#/bang-xep-hang', '#/'];
  // làm nóng: mỗi màn một lần (lưu đệm)
  for (const h of order) { await switchTo(h, SEL[h]); await page.waitForTimeout(+(process.env.LATENCY_MS || 1500) + 800); }
  const times = {};
  for (let i = 0; i < 5; i++) {
    for (const h of order) {
      (times[h] = times[h] || []).push(await switchTo(h, SEL[h]));
      await page.waitForTimeout(+(process.env.LATENCY_MS || 1500) + 800);
    }
  }
  console.log('Chuyển màn học sinh (đã có đệm), trung vị 5 lần (ms):', JSON.stringify(Object.fromEntries(order.map((h) => [h, median(times[h])]))));
  // chưa có đệm: khung xương
  const sk = [];
  for (let i = 0; i < 5; i++) {
    for (const h of order) {
      await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('ld_c_')).forEach((k) => localStorage.removeItem(k)));
      await page.evaluate(() => { location.hash = '#/x'; });
      sk.push(await switchTo(h, SEL[h], true));
      await page.waitForTimeout(+(process.env.LATENCY_MS || 1500) + 800);
    }
  }
  console.log('Chưa có đệm: khung xương/nội dung đầu tiên hiện sau (ms) trung vị', median(sk), 'lớn nhất', Math.max(...sk));

  if (process.env.ADMIN_PW) {
    const ad = await ctx.newPage();
    await ad.route(/cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com|accounts\.google\.com/, (r) => r.fulfill({ status: 200, body: '' }));
    await ad.goto(base + '/admin.html');
    await ad.fill('#pw', process.env.ADMIN_PW);
    await ad.click('#btnLogin');
    await ad.waitForSelector('text=Bài nộp mới nhất', { timeout: 60000 });
    const ASEL = { '#/': '.stats', '#/de-thi': 'h1', '#/ket-qua': '.stats' };
    const aorder = ['#/de-thi', '#/ket-qua', '#/'];
    const sw = (h) => ad.evaluate(([hh, s]) => new Promise((resolve) => {
      const app = document.getElementById('app');
      const t = performance.now();
      const obs = new MutationObserver(() => { if (app.querySelector(s) && !app.querySelector('.sk-wrap')) { obs.disconnect(); resolve(Math.round(performance.now() - t)); } });
      obs.observe(app, { childList: true, subtree: true });
      location.hash = hh;
      setTimeout(() => { obs.disconnect(); resolve(-1); }, 30000);
    }), [h, ASEL[h]]);
    for (const h of aorder) { await sw(h); await ad.waitForTimeout(+(process.env.LATENCY_MS || 1500) * 3 + 800); }
    const at = {};
    for (let i = 0; i < 5; i++) for (const h of aorder) { (at[h] = at[h] || []).push(await sw(h)); await ad.waitForTimeout(+(process.env.LATENCY_MS || 1500) * 3 + 800); }
    console.log('Chuyển tab quản trị (đã có đệm), trung vị 5 lần (ms):', JSON.stringify(Object.fromEntries(aorder.map((h) => [h, median(at[h])]))));
  }
  await br.close();
}

const mode = process.argv[2];
if (mode === 'backend') backend(process.argv[3] || path.join(__dirname, 'fixtures', 'Code-1.0.0.gs'));
else if (mode === 'browser') browser(process.argv[3] || 'http://localhost:8787').catch((e) => { console.error(e); process.exit(1); });
else console.log('Dùng: node tests/measure-pha1.js backend [Code.gs cũ] | browser [địa chỉ]');
