// Pha 6b — kiểm thử độc lập (người kiểm thử) "bảng kẻ gạch" trên giao diện thật (Playwright).
// Tự chạy dev-server: máy chủ mới (PORT_NEW 8790) và SERVER_COMPAT=1.0.0 (PORT_OLD 8791).
//   NODE_PATH=$(npm root -g) LIBS_DIR=... node tests/pha6b-kiem-thu.e2e.js [new|compat|all]
// Ảnh: docs/bao-cao/anh/pha-6b/kt-01-bang-gach.png (1280) và kt-01-bang-gach-390.png (390), kt-02-xem-truoc.png.
// Nội dung câu tự soạn + ví dụ bảng của giáo viên; PIN/mật khẩu là giá trị GIẢ của máy chủ giả.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const MODE = process.argv[2] || 'all';
const LAT = +(process.env.LATENCY_MS || 100);
const PORT_NEW = +(process.env.PORT_NEW || 8790);
const PORT_OLD = +(process.env.PORT_OLD || 8791);
const SHOTS = process.env.SHOTS || path.join(__dirname, '..', 'docs', 'bao-cao', 'anh', 'pha-6b');
const LIBS = process.env.LIBS_DIR;
fs.mkdirSync(SHOTS, { recursive: true });

const NOI_DUNG = [
  'Một học sinh đo suất điện động và điện trở trong của một viên pin, số liệu ghi được trong bảng sau:',
  '–––––––––––––––––––––––––––––––––––-',
  'Lần đo $U$ (V) $I$ (mA)',
  '–––––––––––– ––––––––––- ––––––––––––',
  '1 5,88 120',
  '2 5,85 150',
  '3 5,80 200',
  '–––––––––––––––––––––––––––––––––––-',
  'Suất điện động của viên pin này là'
].join('\n');
const WANT = [['Lần đo', 'U (V)', 'I (mA)'], ['1', '5,88', '120'], ['2', '5,85', '150'], ['3', '5,80', '200']];
const TITLE = 'Kiểm thử bảng kẻ gạch — Pha 6b';

const R = {};
let failed = 0;
function verdict(tc, pass, evidence) {
  (R[tc] = R[tc] || []).push((pass ? 'OK  ' : 'FAIL ') + evidence);
  if (!pass) failed++;
  console.log(`  ${pass ? '✓' : '✗'} ${tc}: ${evidence}`);
}
function startServer(port, env) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [path.join(__dirname, 'dev-server.js'), String(port)], { env: Object.assign({}, process.env, env), stdio: ['ignore', 'pipe', 'pipe'] });
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
function watchErrors(page, sink, tag) {
  page.on('pageerror', (e) => sink.push(tag + ' pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) sink.push(tag + ' console: ' + m.text()); });
}
// đọc bảng trong một vùng: số dòng/ô, chữ ô (KaTeX: lấy annotation/ chữ hiển thị), có .katex trong th không
const readTables = (page, sel) => page.evaluate((sel) => {
  const root = document.querySelector(sel);
  if (!root) return null;
  const cellText = (c) => {
    const cl = c.cloneNode(true);
    cl.querySelectorAll('.katex').forEach((k) => { const a = k.querySelector('annotation'); k.replaceWith(a ? a.textContent : (k.querySelector('.katex-html') || k).textContent); });
    return cl.textContent.replace(/\s+/g, ' ').trim();
  };
  const tabs = [...root.querySelectorAll('table')];
  return {
    n: tabs.length,
    tables: tabs.map((t) => ({
      rows: [...t.querySelectorAll('tr')].map((tr) => [...tr.children].map(cellText)),
      th: t.querySelectorAll('th').length,
      katexTh: t.querySelectorAll('th .katex').length,
      rawDollar: /\$/.test(t.textContent.replace(/<annotation[\s\S]*?<\/annotation>/g, '')) && !t.querySelector('.katex')
    })),
    dashText: /[–-]{5,}/.test(root.innerText),
    text: root.innerText.replace(/\s+/g, ' ').slice(0, 400)
  };
}, sel);
const cellsOk = (t) => t && JSON.stringify(t.rows.map((r) => r.map((c) => c.replace(/[$]/g, '').replace(/\s+/g, ' ').trim()))) === JSON.stringify(WANT);

async function studentDo(browser, B, examId, width, tag, errors, shotName) {
  const ctx = await browser.newContext({ viewport: { width, height: 860 }, deviceScaleFactor: 1 });
  const st = await ctx.newPage();
  watchErrors(st, errors, tag);
  await routeCdn(st);
  await st.goto(B + '/');
  await st.waitForSelector('#selClass option[value="12A1"]', { state: 'attached' });
  await st.selectOption('#selClass', '12A1');
  await st.waitForSelector('#selStudent option[value="HS0001"]', { state: 'attached' });
  await st.selectOption('#selStudent', 'HS0001');
  await st.fill('#pin', '0101');
  await st.click('#btnLogin');
  await st.waitForSelector('text=' + TITLE, { timeout: 15000 });
  await st.goto(B + '/#/lam-bai/' + encodeURIComponent(examId));
  await st.waitForSelector('#btnStart', { timeout: 15000 });
  if (await st.$('[data-goal="8"]')) await st.click('[data-goal="8"]'); // máy chủ mới: đặt mục tiêu điểm trước khi bắt đầu
  await st.click('#btnStart');
  await st.waitForSelector('.q-body table', { timeout: 15000 }).catch(() => {});
  await st.waitForFunction(() => document.querySelector('.q-body .katex'), null, { timeout: 8000 }).catch(() => {});
  await st.waitForTimeout(400);
  const t = await readTables(st, '.q');
  const tb = t && t.tables[0];
  verdict(tag, t && t.n === 1 && cellsOk(tb), `học sinh (${width}px): ${t ? t.n : 0} bảng, ô ${tb ? JSON.stringify(tb.rows) : '-'}`);
  verdict(tag, tb && tb.th === 3 && tb.katexTh === 2, `tiêu đề: ${tb ? tb.th : 0} ô th, KaTeX trong th: ${tb ? tb.katexTh : 0} (mong 3 / 2)`);
  verdict(tag, t && !t.dashText, `không còn dòng gạch in thành chữ trong câu (${t ? t.text.slice(0, 160) : ''})`);
  const sw = await st.evaluate(() => document.documentElement.scrollWidth);
  verdict(tag, sw <= width, `không cuộn ngang trang: scrollWidth ${sw} ≤ ${width}`);
  if (shotName) {
    await st.evaluate(() => { const q = document.querySelector('.q'); if (q) { q.scrollIntoView({ block: 'start' }); window.scrollBy(0, -70); } });
    await st.waitForTimeout(200);
    await st.screenshot({ path: path.join(SHOTS, shotName) });
  }
  await ctx.close();
}

async function runMode(browser, mode) {
  const errors = [];
  const port = mode === 'compat' ? PORT_OLD : PORT_NEW;
  const env = { LATENCY_MS: String(LAT) };
  if (mode === 'compat') env.SERVER_COMPAT = '1.0.0';
  const srv = await startServer(port, env);
  const tag = mode === 'compat' ? 'máy chủ 1.0.0' : 'máy chủ mới';
  console.log(`— ${tag} (cổng ${port})`);
  try {
    const B = srv.base;
    const tTok = (await api(B, 'loginAdminPassword', { password: srv.pw })).token;
    // Giáo viên tạo đề qua adminSaveExam (như nút Lưu của trình soạn)
    const saved = await api(B, 'adminSaveExam', { token: tTok, exam: { tieuDe: TITLE, lop: '12A1', thoiGian: 10, trangThai: 'MO' }, questions: [
      { loai: 'TN', noiDung: NOI_DUNG, A: '$5{,}97$ V', B: '$6{,}00$ V', C: '$5{,}90$ V', D: '$6{,}10$ V', dapAn: 'B', loiGiai: 'Ta có $E = U + Ir$.\n–––\nGiải hệ được $E = 6$ V.' }
    ] });
    const full = await api(B, 'adminGetExam', { token: tTok, examId: saved.id });
    verdict(tag + ' · lưu đề', full.questions[0].noiDung === NOI_DUNG, 'nội dung câu lưu nguyên văn (không đổi gạch / dấu cách)');

    // Trình soạn đề: xem trước
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1 });
    const ad = await ctx.newPage();
    watchErrors(ad, errors, tag + ' admin');
    await routeCdn(ad);
    await ad.goto(B + '/admin.html');
    await ad.fill('#pw', srv.pw);
    await ad.click('#btnLogin');
    await ad.waitForSelector('text=Bài nộp mới nhất');
    await ad.goto(B + '/admin.html#/de-thi/sua/' + encodeURIComponent(saved.id));
    await ad.waitForSelector('.qedit', { timeout: 15000 });
    await ad.evaluate(() => { const d = document.querySelector('.qedit details'); if (d) d.open = true; });
    await ad.waitForTimeout(400);
    let p = await readTables(ad, '#pv-0');
    let tb = p && p.tables[0];
    verdict(tag + ' · xem trước', p && p.n === 1 && cellsOk(tb) && tb.katexTh === 2, `trình soạn "Xem trước": ${p ? p.n : 0} bảng, ô ${tb ? JSON.stringify(tb.rows) : '-'}, KaTeX trong th ${tb ? tb.katexTh : 0}`);
    // Lời giải có dòng "–––" đơn lẻ → vẫn là chữ, không thành bảng
    const sol = await ad.evaluate(() => { const s = document.querySelector('#pv-0 .solution'); return s ? { t: s.querySelectorAll('table').length, txt: s.innerText } : null; });
    verdict(tag + ' · xem trước', sol && sol.t === 0 && /–––/.test(sol.txt), `lời giải có dòng "–––": ${JSON.stringify(sol)}`);
    // Sửa nội dung trên giao diện → xem trước cập nhật thành bảng mới (4 cột)
    const typed = 'Bảng mới:\n' + '–'.repeat(30) + '\nLần $t$ (s) $x$ (cm) $v$ (cm/s)\n–––– –––– –––– ––––\n1 0,5 2,0 4,0\n' + '–'.repeat(30) + '\nTính gia tốc.';
    await ad.fill('textarea[data-f="noiDung"][data-i="0"]', typed);
    await ad.waitForTimeout(900);
    p = await readTables(ad, '#pv-0');
    tb = p && p.tables[0];
    verdict(tag + ' · xem trước', p && p.n === 1 && tb.rows.length === 2 && tb.rows.every((r) => r.length === 4) && tb.katexTh === 3,
      `gõ bảng 4 cột vào ô Nội dung → xem trước ${p ? p.n : 0} bảng, ${tb ? JSON.stringify(tb.rows) : '-'}`);
    if (mode === 'new') {
      await ad.evaluate(() => { const q = document.querySelector('.qedit'); q.scrollIntoView({ block: 'start' }); window.scrollBy(0, -70); });
      await ad.screenshot({ path: path.join(SHOTS, 'kt-02-xem-truoc.png') });
    }
    await ctx.close();

    // Học sinh làm bài (1280 và 390)
    await studentDo(browser, B, saved.id, 1280, tag + ' · học sinh', errors, mode === 'new' ? 'kt-01-bang-gach.png' : null);
    await studentDo(browser, B, saved.id, 390, tag + ' · học sinh', errors, mode === 'new' ? 'kt-01-bang-gach-390.png' : null);

    verdict(tag + ' · không lỗi JS', errors.length === 0, errors.join(' | ').slice(0, 400) || 'không có pageerror / console error');
  } finally {
    srv.proc.kill();
  }
}

(async () => {
  const browser = await chromium.launch();
  try {
    if (MODE === 'new' || MODE === 'all') await runMode(browser, 'new');
    if (MODE === 'compat' || MODE === 'all') await runMode(browser, 'compat');
  } catch (e) {
    console.error('LỖI CHẠY:', e); failed++;
  } finally {
    await browser.close();
  }
  console.log(failed ? `\n${failed} kiểm tra không đạt` : '\nTất cả đạt');
  if (process.env.OUT) fs.writeFileSync(process.env.OUT, JSON.stringify(R, null, 1));
  process.exitCode = failed ? 1 : 0;
})();
