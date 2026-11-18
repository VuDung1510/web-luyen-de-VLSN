// Kiểm thử độc lập Pha 1 (người kiểm thử) — giao diện, viết theo docs/spec/pha-1-tang-toc.md.
// Tự chạy dev-server (máy chủ mới và SERVER_COMPAT=1.0.0) với LATENCY_MS (mặc định 1500).
//   NODE_PATH=$(npm root -g) LIBS_DIR=... node tests/pha1-kiem-thu.e2e.js [new|compat|all]
// Biến môi trường: PORT_NEW (mặc định 8790), PORT_OLD (8791), LATENCY_MS (1500),
//   SHOTS (docs/bao-cao/anh/pha-1), JSON_OUT (ghi số đo/kết quả ra file JSON).
// Bao phủ: TC-1.0, 1.1, 1.2, 1.3, 1.4, 1.9, 1.9b, 1.10, 1.11, 1.14 (+ bảo mật kho lưu trình duyệt).
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const MODE = process.argv[2] || 'all';
const LAT = +(process.env.LATENCY_MS || 1500);
const PORT_NEW = +(process.env.PORT_NEW || 8790);
const PORT_OLD = +(process.env.PORT_OLD || 8791);
const SHOTS = process.env.SHOTS || path.join(__dirname, '..', 'docs', 'bao-cao', 'anh', 'pha-1');
const LIBS = process.env.LIBS_DIR;
fs.mkdirSync(SHOTS, { recursive: true });

const R = { tc: {}, measure: {}, notes: [] };
function verdict(tc, pass, evidence) {
  const prev = R.tc[tc];
  const entry = prev || { pass: true, evidence: [] };
  entry.pass = entry.pass && !!pass;
  entry.evidence.push((pass ? 'OK  ' : 'FAIL ') + evidence);
  R.tc[tc] = entry;
  console.log(`  ${pass ? '✓' : '✗'} ${tc}: ${evidence}`);
}
const note = (s) => { R.notes.push(s); console.log('  • ' + s); };
const median = (a) => { const s = a.filter((x) => x != null).sort((x, y) => x - y); if (!s.length) return null; return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
const r0 = (x) => (x == null ? null : Math.round(x));

function startServer(port, env) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [path.join(__dirname, 'dev-server.js'), String(port)], { env: Object.assign({}, process.env, env), stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    p.stdout.on('data', (d) => {
      out += d;
      const m = out.match(/mật khẩu: (\S+)\)/);
      if (m) resolve({ proc: p, pw: m[1], base: 'http://localhost:' + port });
    });
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
  await page.route(/fonts\.(googleapis|gstatic)\.com|accounts\.google\.com/, (r) => r.fulfill({ status: 200, body: '' }));
  await page.route(/cdnjs\.cloudflare\.com/, (r) => {
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

// Ghi mọi toast lỗi (đỏ) và thời điểm khung xương đầu tiên xuất hiện từ lúc tải trang.
async function instrument(ctx, sink) {
  await ctx.exposeBinding('__pha1Report', (_src, kind, text) => { sink.push([kind, text]); });
  await ctx.addInitScript(() => {
    window.__first = {};
    const seen = new WeakSet();
    const mo = new MutationObserver(() => {
      if (window.__first.sk == null && document.querySelector('main .skeleton')) window.__first.sk = performance.now();
      document.querySelectorAll('.toast').forEach((el) => {
        if (seen.has(el)) return; seen.add(el);
        window.__pha1Report(el.classList.contains('err') ? 'toast-err' : 'toast', el.textContent.trim());
      });
    });
    mo.observe(document, { childList: true, subtree: true });
  });
}

function wireErrors(page, errors, tag) {
  page.on('pageerror', (e) => errors.push(tag + ' pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errors.push(tag + ' console: ' + m.text()); });
}

// Đổi hash và đo trong trang: thời điểm khung xương, thời điểm nội dung chính (h1 đúng, không còn .skeleton), số khung trống.
async function nav(page, hash, title, timeout = 9000) {
  return page.evaluate(({ hash, title, timeout }) => new Promise((res) => {
    const main = document.querySelector('main');
    let done = false, tSk = null, blank = 0, tFirst = null;
    let t0;
    const chk = () => {
      if (done) return true;
      const now = performance.now();
      const sk = main.querySelector('.skeleton');
      if (sk && tSk == null) tSk = now - t0;
      const h1 = main.querySelector('h1');
      const hasText = main.innerText.trim().length > 0;
      if (!sk && !hasText) blank++;
      if (tFirst == null && h1 && h1.textContent.trim().startsWith(title)) tFirst = now - t0;
      if (!sk && h1 && h1.textContent.trim().startsWith(title)) { done = true; mo.disconnect(); res({ tSk, tReady: now - t0, tFirst, blank }); return true; }
      if (now - t0 > timeout) { done = true; mo.disconnect(); res({ tSk, tReady: null, tFirst, blank, timeout: true, h1: h1 && h1.textContent }); return true; }
      return false;
    };
    const mo = new MutationObserver(chk);
    mo.observe(main, { childList: true, subtree: true, characterData: true });
    const loop = () => { if (!chk()) requestAnimationFrame(loop); };
    t0 = performance.now();
    location.hash = hash;
    requestAnimationFrame(loop);
  }), { hash, title, timeout });
}
const storageDump = (page) => page.evaluate(() => {
  const dump = (s) => { const o = {}; for (let i = 0; i < s.length; i++) { const k = s.key(i); o[k] = s.getItem(k); } return o; };
  return { local: dump(localStorage), session: dump(sessionStorage) };
});
const clearViewCache = (page) => page.evaluate(() => {
  [localStorage, sessionStorage].forEach((s) => Object.keys(s).filter((k) => k.startsWith('ld_c_')).forEach((k) => s.removeItem(k)));
});
function trackPosts(page) {
  const list = [];
  const h = (req) => {
    if (req.method() !== 'POST' || !/\/exec/.test(req.url())) return;
    try { list.push(JSON.parse(req.postData()).action); } catch (e) { list.push('?'); }
  };
  page.on('request', h);
  return { list, stop: () => page.off('request', h) };
}

async function loginStudent(page, base, id, pin) {
  if (!/localhost/.test(page.url())) await page.goto(base + '/');
  await page.waitForSelector('#selClass option[value="12A1"]', { state: 'attached', timeout: 20000 });
  await page.selectOption('#selClass', '12A1');
  await page.waitForSelector(`#selStudent option[value="${id}"]`, { state: 'attached', timeout: 20000 });
  await page.selectOption('#selStudent', id);
  await page.fill('#pin', pin);
  await page.click('#btnLogin');
}
const SCREENS = [['#/', 'Xin chào'], ['#/lich-su', 'Lịch sử'], ['#/thong-ke', 'Thống kê'], ['#/bang-xep-hang', 'Bảng xếp hạng']];
const ADMIN_TABS = [['#/', 'Tổng quan'], ['#/de-thi', 'Đề thi'], ['#/ket-qua', 'Kết quả']];

// Làm bài đề mẫu: đáp án giống e2e.js → 5,56 điểm.
async function doExam(page, compat, phase) {
  await page.click('text=Bắt đầu làm bài');
  await page.waitForSelector('#btnStart', { timeout: 20000 });
  const goalShown = !!(await page.$('#goal')) || !!(await page.$('[data-goal]'));
  if (compat) verdict('TC-1.0', !goalShown, '[1.0.0] hộp mục tiêu điểm ' + (goalShown ? 'VẪN HIỆN' : 'bị ẩn'));
  else {
    verdict('TC-1.0', goalShown, '[mới] hộp mục tiêu điểm hiển thị');
    await page.click('[data-goal="8"]');
  }
  await page.click('#btnStart');
  await page.waitForSelector('.timer', { timeout: 20000 });
  const qs = await page.$$('.q');
  await (await qs[0].$('[data-opt="C"]')).click();
  await (await qs[1].$('[data-opt="A"]')).click();
  await (await qs[2].$('[data-opt="A"]')).click();
  for (const v of ['0:D', '1:S', '2:D', '3:D']) await (await qs[3].$(`[data-tf="${v}"]`)).click();
  await (await qs[4].$('input')).fill('420');
  await page.waitForTimeout(300);
  // TC-1.11: đang làm bài, kho lưu không chứa dapAn/loiGiai
  const st = await storageDump(page);
  const bad = Object.entries(Object.assign({}, st.local, st.session)).filter(([, v]) => /dapAn|loiGiai/.test(v)).map(([k]) => k);
  verdict('TC-1.11', bad.length === 0, `[${phase}] đang làm bài: ${Object.keys(st.local).length} khóa localStorage, khóa chứa dapAn/loiGiai: ${bad.join(',') || 'không có'}`);
  await page.click('#btnSubmit');
  await page.click('[data-close="ok"]');
  await page.waitForSelector('.score-ring', { timeout: 20000 });
  const score = await page.$eval('.score-ring b', (e) => e.textContent);
  return score;
}

// ======================= MÁY CHỦ MỚI =======================
async function runNew(browser) {
  console.log(`\n=== Máy chủ mới (cổng ${PORT_NEW}, LATENCY_MS=${LAT}) ===`);
  const srv = await startServer(PORT_NEW, { LATENCY_MS: String(LAT), SERVER_COMPAT: '' });
  const B = srv.base;
  const errors = [];
  const toasts = [];
  try {
    // Dữ liệu: HS B cùng lớp, 1 HS có PIN dễ nhận
    const tTok = (await api(B, 'loginAdminPassword', { password: srv.pw })).token;
    const hsB = await api(B, 'adminSaveStudent', { token: tTok, student: { hoTen: 'Học Sinh Bê', lop: '12A1', ngaySinh: '02/02/2008' } });
    await api(B, 'adminSaveStudent', { token: tTok, student: { hoTen: 'Phạm Quang Huy', lop: '12A2', ngaySinh: '27/09/2008' } });
    const pinsAll = (await api(B, 'adminListStudents', { token: tTok })).map((s) => s.pin);

    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    await instrument(ctx, toasts);
    const page = await ctx.newPage();
    wireErrors(page, errors, 'HS');
    await routeCdn(page);

    // ---- đăng nhập HS A
    await loginStudent(page, B, 'HS0001', '0101');
    await page.waitForSelector('text=Đề đang mở', { timeout: 20000 });
    const pinBtn = await page.$('#btnPin');
    verdict('TC-1.0', !!pinBtn && (await pinBtn.isVisible()), '[mới] nút Đổi PIN hiển thị trên trang chủ');
    await page.screenshot({ path: path.join(SHOTS, '03-trang-chu-may-chu-moi.png') });

    // ---- TC-1.11 + TC-1.10: làm bài, nộp, về trang chủ không tải lại
    await page.evaluate(() => { window.__noReload = 1; });
    const score = await doExam(page, false, 'mới');
    verdict('TC-1.4', score === '5,56', '[mới] nộp bài, điểm ' + score);
    const st2 = await storageDump(page);
    const afterSubmit = Object.entries(Object.assign({}, st2.local, st2.session)).filter(([, v]) => /dapAn|loiGiai/.test(v)).map(([k]) => k);
    if (afterSubmit.length) note('Sau khi nộp (không phải lúc đang làm): khóa chứa dapAn/loiGiai: ' + afterSubmit.join(', ') + ' (ld_lastResult có từ trước Pha 1)');
    const tHome0 = Date.now();
    await page.click('a[data-nav="home"]');
    let newScoreShown = false;
    try {
      await page.waitForFunction(() => /5,56/.test(document.querySelector('main').innerText) && /Xin chào/.test(document.querySelector('main').innerText), null, { timeout: 4 * LAT + 3000 });
      newScoreShown = true;
    } catch (e) { /* hết giờ */ }
    const tHome = Date.now() - tHome0;
    const noReload = await page.evaluate(() => window.__noReload === 1);
    const done1 = await page.$eval('main .stat b', (e) => e.textContent).catch(() => '?');
    verdict('TC-1.10', newScoreShown && noReload, `về trang chủ sau nộp: điểm 5,56 hiện sau ${tHome} ms, không tải lại trang=${noReload}, "Bài đã làm"=${done1}`);
    R.measure.tc110_ms = tHome;
    const h = await nav(page, '#/lich-su', 'Lịch sử');
    const histHas = await page.evaluate(() => /5,56/.test(document.querySelector('main').innerText));
    verdict('TC-1.10', histHas, `Lịch sử có bài mới ngay (sẵn sàng sau ${r0(h.tReady)} ms)`);

    // ---- làm đầy đệm 4 màn
    for (const [hs, title] of SCREENS) { await nav(page, hs, title); await page.waitForTimeout(LAT + 600); }

    // ---- TC-1.1 học sinh: 5 vòng
    const per = {};
    for (let round = 0; round < 5; round++) {
      for (const [hs, title] of [SCREENS[1], SCREENS[2], SCREENS[3], SCREENS[0]]) {
        const m = await nav(page, hs, title);
        (per[title] = per[title] || []).push(m.tReady);
        await page.waitForTimeout(150);
      }
    }
    const stuMed = {};
    Object.keys(per).forEach((k) => { stuMed[k] = median(per[k]); });
    R.measure.tc11_student = { median: stuMed, raw: per };
    Object.entries(stuMed).forEach(([k, v]) => verdict('TC-1.1', v != null && v < 300, `HS "${k}" có đệm: trung vị ${v == null ? 'hết giờ' : v.toFixed(1)} ms (5 lần: ${per[k].map((x) => x == null ? 'x' : x.toFixed(0)).join('/')})`));

    // ---- chỉ báo "đang cập nhật" + ảnh
    await page.waitForTimeout(LAT + 500);
    await nav(page, '#/lich-su', 'Lịch sử'); await page.waitForTimeout(LAT + 500);
    await nav(page, '#/', 'Xin chào');
    const pill = await page.waitForSelector('.sync-pill:not(.hidden)', { timeout: 1500 }).catch(() => null);
    const pillText = pill ? (await pill.textContent()).trim() : '';
    if (pill) await page.screenshot({ path: path.join(SHOTS, '02-dang-cap-nhat.png') });
    note('Chỉ báo khi hiện từ đệm: ' + (pill ? `"${pillText}"` : 'KHÔNG thấy .sync-pill'));
    R.measure.syncPill = pillText;
    await page.waitForTimeout(LAT + 800);
    const pillGone = await page.$('.sync-pill:not(.hidden)');
    note('Chỉ báo tắt sau khi dữ liệu về: ' + (!pillGone));

    // ---- TC-1.2 học sinh: chưa có đệm → khung xương < 150 ms, không màn trắng
    const sk = {};
    for (const [hs, title] of [SCREENS[1], SCREENS[2], SCREENS[3], SCREENS[0]]) {
      await nav(page, hs === '#/' ? '#/lich-su' : '#/', hs === '#/' ? 'Lịch sử' : 'Xin chào');
      await page.waitForTimeout(LAT + 600);
      await clearViewCache(page);
      const m = await nav(page, hs, title);
      sk[title] = m;
      verdict('TC-1.2', m.tSk != null && m.tSk < 150 && m.blank === 0, `HS "${title}" chưa có đệm: khung xương sau ${m.tSk == null ? 'KHÔNG CÓ' : m.tSk.toFixed(1)} ms, nội dung sau ${r0(m.tReady)} ms, khung trống=${m.blank}`);
    }
    R.measure.tc12_student = sk;
    // ảnh khung xương
    await nav(page, '#/', 'Xin chào'); await page.waitForTimeout(LAT + 600);
    await clearViewCache(page);
    await page.evaluate(() => { location.hash = '#/thong-ke'; });
    if (await page.waitForSelector('main .skeleton', { timeout: 1000 }).catch(() => null)) await page.screenshot({ path: path.join(SHOTS, '01-khung-xuong-hoc-sinh.png') });
    await page.waitForTimeout(LAT + 800);

    // ---- TC-1.2 tải lại trang (đã đăng nhập, chưa có đệm): khung xương tính từ lúc bắt đầu điều hướng
    await page.evaluate(() => { location.hash = '#/'; });
    await page.waitForTimeout(LAT + 600);
    await clearViewCache(page);
    await page.reload();
    await page.waitForFunction(() => /Xin chào/.test(document.querySelector('main').innerText) && !document.querySelector('main .skeleton'), null, { timeout: 4 * LAT + 3000 });
    const reloadSk = await page.evaluate(() => window.__first.sk);
    const dcl = await page.evaluate(() => performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd);
    R.measure.tc12_reload = { skeletonFromNavStart: reloadSk, domContentLoaded: dcl };
    note(`Tải lại trang không có đệm: khung xương ở ${r0(reloadSk)} ms kể từ đầu điều hướng (DOMContentLoaded ${r0(dcl)} ms)`);

    // ---- TC-1.3: đếm POST khi tải trang chủ đã đăng nhập
    async function countLoad(label, prep) {
      await prep();
      const tr = trackPosts(page);
      const t0 = Date.now();
      await page.reload();
      await page.waitForFunction(() => /Xin chào/.test(document.querySelector('main').innerText) && /Đề đang mở/.test(document.querySelector('main').innerText) && !document.querySelector('main .skeleton'), null, { timeout: 4 * LAT + 3000 });
      const tShown = Date.now() - t0;
      await page.waitForTimeout(2 * LAT + 1000); // chờ các lời gọi ngầm
      tr.stop();
      const cnt = {}; tr.list.forEach((a) => { cnt[a] = (cnt[a] || 0) + 1; });
      const okc = cnt.bootstrap === 1 && (cnt.publicConfig || 0) <= 1 && tr.list.length === 1 + (cnt.publicConfig || 0);
      verdict('TC-1.3', okc, `${label}: POST = ${JSON.stringify(cnt)}; trang chủ đầy đủ sau ${tShown} ms`);
      R.measure['tc13_' + label] = { posts: cnt, shownMs: tShown };
    }
    await countLoad('có đệm', async () => {});
    await countLoad('xóa đệm màn, giữ ld_pub', async () => clearViewCache(page));
    await countLoad('xóa đệm + ld_pub', async () => { await clearViewCache(page); await page.evaluate(() => { localStorage.removeItem('ld_pub'); localStorage.removeItem('ld_pub_t'); }); });

    // ---- TC-1.14: ngoại tuyến (chặn /exec) khi đã có đệm
    for (const [hs, title] of SCREENS) { await nav(page, hs, title); await page.waitForTimeout(LAT + 600); }
    const t0n = toasts.length;
    await page.route('**/exec', (r) => r.abort('internetdisconnected'));
    await ctx.setOffline(true);
    for (const [hs, title] of [SCREENS[1], SCREENS[2], SCREENS[3], SCREENS[0]]) {
      const m = await nav(page, hs, title);
      await page.waitForTimeout(2500);
      const text = await page.evaluate(() => document.querySelector('main').innerText.length);
      verdict('TC-1.14', m.tReady != null && text > 30, `HS ngoại tuyến "${title}": hiện sau ${r0(m.tReady)} ms (${text} ký tự)`);
    }
    const offToasts = toasts.slice(t0n);
    verdict('TC-1.14', offToasts.length > 0, 'HS ngoại tuyến: thông báo nhẹ: ' + JSON.stringify(offToasts.slice(0, 3)));
    await page.evaluate(() => { location.hash = '#/thong-ke'; });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(SHOTS, '05-ngoai-tuyen.png') });
    await ctx.setOffline(false);
    await page.unroute('**/exec');
    await page.waitForTimeout(LAT + 500);

    // ---- TC-1.9: đăng xuất A, đăng nhập B
    await nav(page, '#/', 'Xin chào'); await page.waitForTimeout(LAT + 600);
    const beforeOut = await storageDump(page);
    note('Khóa localStorage của HS A trước đăng xuất: ' + Object.keys(beforeOut.local).join(', '));
    await page.click('#btnLogout');
    await page.click('[data-close="ok"]');
    await page.waitForSelector('#selStudent', { timeout: 20000 });
    const afterOut = await storageDump(page);
    const leftA = Object.keys(Object.assign({}, afterOut.local, afterOut.session)).filter((k) => k.startsWith('ld_c_') || k === 'ld_lastResult' || k === 'ld_token' || k === 'ld_user');
    const leftAny = Object.entries(Object.assign({}, afterOut.local, afterOut.session)).filter(([, v]) => /5[.,]56|Học Sinh Mẫu/.test(v)).map(([k]) => k);
    verdict('TC-1.9', leftA.length === 0, 'sau đăng xuất A, còn khóa ld_c_*/ld_lastResult/ld_token: ' + (leftA.join(',') || 'không') + '; tất cả khóa còn lại: ' + Object.keys(afterOut.local).join(','));
    if (leftAny.length) note('Sau đăng xuất A, giá trị còn nhắc tới A: ' + leftAny.join(', ') + ' (ld_last = lựa chọn lớp/HS ở màn đăng nhập, có từ trước)');
    // B đăng nhập — theo dõi từng khung hình xem có thoáng hiện dữ liệu A không
    await page.evaluate(() => {
      window.__leak = [];
      const chk = () => { const t = document.querySelector('main').innerText; if (/5,56|Xin chào, Mẫu/.test(t)) window.__leak.push(t.slice(0, 80)); };
      new MutationObserver(chk).observe(document.querySelector('main'), { childList: true, subtree: true, characterData: true });
    });
    await loginStudent(page, B, hsB.id, '0202');
    await page.waitForSelector('text=Đề đang mở', { timeout: 20000 });
    await page.waitForTimeout(LAT + 600);
    const leak1 = await page.evaluate(() => window.__leak);
    const leakScreens = [];
    for (const [hs, title] of SCREENS.slice(0, 3)) {
      await nav(page, hs, title); await page.waitForTimeout(LAT + 600);
      const t = await page.evaluate(() => document.querySelector('main').innerText);
      if (/5,56|Xin chào, Mẫu/.test(t)) leakScreens.push(title);
    }
    const stB = await storageDump(page);
    const keysA = Object.keys(Object.assign({}, stB.local, stB.session)).filter((k) => k.includes('HS0001'));
    verdict('TC-1.9', !leak1.length && !leakScreens.length && !keysA.length,
      `HS B (${hsB.id}): thoáng hiện dữ liệu A=${leak1.length}, màn có dữ liệu A=${leakScreens.join(',') || 'không'}, khóa của A còn=${keysA.join(',') || 'không'}`);

    // ---- AUTH phía học sinh: token hỏng → xóa ld_c_*
    // token đúng định dạng nhưng sai chữ ký → máy chủ trả AUTH: (giống hết hạn)
    await page.evaluate(() => { const t = JSON.parse(localStorage.getItem('ld_token')); localStorage.setItem('ld_token', JSON.stringify(t.slice(0, -3) + 'abc')); });
    await page.reload();
    await page.waitForTimeout(2 * LAT + 1500);
    const stAuth = await storageDump(page);
    const leftAuth = Object.keys(Object.assign({}, stAuth.local, stAuth.session)).filter((k) => k.startsWith('ld_c_') || k === 'ld_lastResult');
    const authUi = await page.$('#selClass');
    verdict('TC-1.9', leftAuth.length === 0 && !!authUi, `HS token hỏng (AUTH): về màn đăng nhập=${!!authUi}, còn ld_c_*/ld_lastResult: ${leftAuth.join(',') || 'không'}`);
    await ctx.close();

    // ================= GIÁO VIÊN =================
    const actx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    await instrument(actx, toasts);
    const ad = await actx.newPage();
    wireErrors(ad, errors, 'GV');
    ad.on('dialog', (d) => d.accept());
    await routeCdn(ad);
    const pinRe = new RegExp('"(' + pinsAll.join('|') + ')"');
    const scanPins = async (label) => {
      const st = await storageDump(ad);
      const all = Object.assign({}, st.local, st.session);
      const hits = Object.entries(all).filter(([k, v]) => k !== 'ld_pub_t' && (pinRe.test(v) || /"pin"\s*:/.test(v))).map(([k]) => k);
      const raw = Object.entries(all).filter(([k, v]) => k.startsWith('ld_c_') && pinsAll.some((p) => v.includes(p))).map(([k]) => k);
      return { hits, raw, keys: Object.keys(all) };
    };
    async function adminLogin() {
      await ad.goto(B + '/admin.html');
      await ad.fill('#pw', srv.pw);
      await ad.click('#btnLogin');
      await ad.waitForSelector('text=Bài nộp mới nhất', { timeout: 20000 });
    }
    await adminLogin();
    await ad.screenshot({ path: path.join(SHOTS, '06-qt-tong-quan.png') });
    for (const [hs, title] of ADMIN_TABS) { await nav(ad, hs, title); await ad.waitForTimeout(LAT + 600); }
    await nav(ad, '#/hoc-sinh', 'Học sinh'); await ad.waitForTimeout(LAT + 800);
    const perA = {};
    for (let round = 0; round < 5; round++) {
      for (const [hs, title] of [ADMIN_TABS[1], ADMIN_TABS[2], ADMIN_TABS[0]]) {
        const m = await nav(ad, hs, title);
        (perA[title] = perA[title] || []).push(m.tReady);
        await ad.waitForTimeout(150);
      }
    }
    const adMed = {};
    Object.keys(perA).forEach((k) => { adMed[k] = median(perA[k]); });
    R.measure.tc11_admin = { median: adMed, raw: perA };
    Object.entries(adMed).forEach(([k, v]) => verdict('TC-1.1', v != null && v < 300, `GV "${k}" có đệm: trung vị ${v == null ? 'hết giờ' : v.toFixed(1)} ms (5 lần: ${perA[k].map((x) => x == null ? 'x' : x.toFixed(0)).join('/')})`));
    await ad.waitForTimeout(LAT + 500);
    const skA = {};
    for (const [hs, title] of [ADMIN_TABS[1], ADMIN_TABS[2], ADMIN_TABS[0]]) {
      await nav(ad, '#/hoc-sinh', 'Học sinh'); await ad.waitForTimeout(LAT + 600);
      await clearViewCache(ad);
      const m = await nav(ad, hs, title);
      skA[title] = m;
      verdict('TC-1.2', m.tSk != null && m.tSk < 150 && m.blank === 0, `GV "${title}" chưa có đệm: khung xương sau ${m.tSk == null ? 'KHÔNG CÓ' : m.tSk.toFixed(1)} ms, nội dung sau ${r0(m.tReady)} ms, khung trống=${m.blank}`);
    }
    R.measure.tc12_admin = skA;
    await nav(ad, '#/hoc-sinh', 'Học sinh'); await ad.waitForTimeout(LAT + 600);
    await clearViewCache(ad);
    await ad.evaluate(() => { location.hash = '#/ket-qua'; });
    if (await ad.waitForSelector('main .skeleton', { timeout: 1000 }).catch(() => null)) await ad.screenshot({ path: path.join(SHOTS, '07-qt-khung-xuong.png') });
    await ad.waitForTimeout(LAT + 800);
    // xem 1 bài (có thể đặt ld_lastResult) rồi quét PIN trong phiên
    await nav(ad, '#/ket-qua', 'Kết quả');
    const xem = await ad.$('a.btn:has-text("Xem")');
    if (xem) { await xem.click(); await ad.waitForSelector('.score-ring', { timeout: 20000 }).catch(() => {}); }
    const during = await scanPins('trong phiên');
    verdict('TC-1.9b', !during.hits.length && !during.raw.length, 'GV trong phiên: khóa chứa PIN/"pin": ' + (during.hits.concat(during.raw).join(',') || 'không') + '; khóa: ' + during.keys.join(','));
    // ngoại tuyến quản trị
    for (const [hs, title] of ADMIN_TABS) { await nav(ad, hs, title); await ad.waitForTimeout(LAT + 600); }
    const t1n = toasts.length;
    await ad.route('**/exec', (r) => r.abort('internetdisconnected'));
    for (const [hs, title] of [ADMIN_TABS[1], ADMIN_TABS[2], ADMIN_TABS[0]]) {
      const m = await nav(ad, hs, title);
      await ad.waitForTimeout(2500); // api() thử lại 1 lần sau 800 ms rồi mới báo lỗi mạng
      verdict('TC-1.14', m.tReady != null, `GV ngoại tuyến "${title}": hiện sau ${r0(m.tReady)} ms`);
    }
    verdict('TC-1.14', toasts.length > t1n, 'GV ngoại tuyến: thông báo nhẹ: ' + JSON.stringify(toasts.slice(t1n, t1n + 2)));
    await ad.unroute('**/exec');
    await ad.waitForTimeout(LAT + 500);
    // đăng xuất
    await ad.click('#btnOut');
    await ad.waitForTimeout(800);
    const confirmBtn = await ad.$('[data-close="ok"]');
    if (confirmBtn) await confirmBtn.click();
    await ad.waitForSelector('#pw', { timeout: 20000 });
    const out = await scanPins('sau đăng xuất');
    const left = out.keys.filter((k) => k.startsWith('ld_c_') || k === 'ld_lastResult');
    verdict('TC-1.9b', !out.hits.length && !out.raw.length && !left.length, 'GV sau đăng xuất: PIN=' + (out.hits.join(',') || 'không') + ', ld_c_*/ld_lastResult còn: ' + (left.join(',') || 'không'));
    // token hỏng → AUTH
    await adminLogin();
    for (const [hs, title] of ADMIN_TABS) { await nav(ad, hs, title); await ad.waitForTimeout(LAT + 600); }
    await nav(ad, '#/ket-qua', 'Kết quả');
    const xem2 = await ad.$('a.btn:has-text("Xem")');
    if (xem2) { await xem2.click(); await ad.waitForSelector('.score-ring', { timeout: 20000 }).catch(() => {}); }
    await ad.evaluate(() => { const t = JSON.parse(localStorage.getItem('ld_admin_token')); localStorage.setItem('ld_admin_token', JSON.stringify(t.slice(0, -3) + 'abc')); });
    await ad.evaluate(() => { location.hash = '#/hoc-sinh'; });
    await ad.waitForTimeout(2 * LAT + 1500);
    const au = await scanPins('AUTH');
    const leftAu = au.keys.filter((k) => k.startsWith('ld_c_') || k === 'ld_lastResult');
    verdict('TC-1.9b', !au.hits.length && !au.raw.length && !leftAu.length, 'GV token hỏng (AUTH): PIN=' + (au.hits.join(',') || 'không') + ', ld_c_*/ld_lastResult còn: ' + (leftAu.join(',') || 'không') + ', màn đăng nhập=' + !!(await ad.$('#pw')));
    await actx.close();

    const reds = toasts.filter(([k]) => k === 'toast-err');
    note('[mới] toast lỗi đỏ đã thấy (gồm cả bước cố ý: token hỏng, ngoại tuyến): ' + JSON.stringify(reds.slice(0, 6)));
    verdict('TC-1.0', errors.length === 0, '[mới] lỗi console/pageerror: ' + (errors.join(' | ') || 'không'));
  } finally { srv.proc.kill(); }
}

// ======================= MÁY CHỦ 1.0.0 =======================
async function runCompat(browser) {
  console.log(`\n=== SERVER_COMPAT=1.0.0 (cổng ${PORT_OLD}, LATENCY_MS=${LAT}) ===`);
  const srv = await startServer(PORT_OLD, { LATENCY_MS: String(LAT), SERVER_COMPAT: '1.0.0' });
  const B = srv.base;
  const errors = [];
  const toasts = [];
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    await instrument(ctx, toasts);
    const page = await ctx.newPage();
    wireErrors(page, errors, 'HS');
    await routeCdn(page);
    const tr = trackPosts(page);
    await loginStudent(page, B, 'HS0001', '0101');
    await page.waitForSelector('text=Đề đang mở', { timeout: 20000 });
    await page.waitForTimeout(LAT + 500);
    verdict('TC-1.4', true, '[1.0.0] đăng nhập được, trang chủ hiện "Đề đang mở"');
    const pinBtn = await page.$('#btnPin');
    const pinVisible = !!pinBtn && (await pinBtn.isVisible());
    verdict('TC-1.0', !pinVisible, '[1.0.0] nút Đổi PIN ' + (pinVisible ? 'VẪN HIỆN' : 'bị ẩn'));
    verdict('TC-1.4', !pinVisible, '[1.0.0] nút Đổi PIN bị ẩn');
    await page.screenshot({ path: path.join(SHOTS, '04-trang-chu-may-chu-cu.png') });
    tr.stop();
    note('[1.0.0] POST từ mở trang tới trang chủ: ' + tr.list.join(', '));
    const score = await doExam(page, true, '1.0.0');
    verdict('TC-1.4', score === '5,56', '[1.0.0] nộp bài, điểm ' + score);
    const goalCard = await page.$('.goal-card');
    verdict('TC-1.4', !goalCard, '[1.0.0] không có khung mục tiêu ở trang kết quả');
    await page.click('a[data-nav="home"]');
    let shown = false;
    try { await page.waitForFunction(() => /5,56/.test(document.querySelector('main').innerText), null, { timeout: 4 * LAT + 3000 }); shown = true; } catch (e) { /* */ }
    verdict('TC-1.10', shown, '[1.0.0] về trang chủ sau nộp: điểm mới hiện không cần tải lại');
    for (const [hs, title] of SCREENS) { const m = await nav(page, hs, title); await page.waitForTimeout(LAT + 600); if (m.tReady == null) verdict('TC-1.4', false, '[1.0.0] màn ' + title + ' không hiện'); }
    const per = {};
    for (let round = 0; round < 5; round++) {
      for (const [hs, title] of [SCREENS[1], SCREENS[2], SCREENS[3], SCREENS[0]]) {
        const m = await nav(page, hs, title);
        (per[title] = per[title] || []).push(m.tReady);
        await page.waitForTimeout(150);
      }
    }
    const med = {}; Object.keys(per).forEach((k) => { med[k] = median(per[k]); });
    R.measure.tc11_compat = { median: med, raw: per };
    note('[1.0.0] chuyển màn có đệm, trung vị ms: ' + JSON.stringify(Object.fromEntries(Object.entries(med).map(([k, v]) => [k, v && +v.toFixed(1)]))));
    // đếm POST khi tải lại trang chủ
    await nav(page, '#/', 'Xin chào'); await page.waitForTimeout(LAT + 600);
    const tr2 = trackPosts(page);
    await page.reload();
    await page.waitForFunction(() => /Đề đang mở/.test(document.querySelector('main').innerText) && !document.querySelector('main .skeleton'), null, { timeout: 4 * LAT + 3000 });
    await page.waitForTimeout(2 * LAT + 800);
    tr2.stop();
    note('[1.0.0] POST khi tải lại trang chủ (có ld_pub): ' + tr2.list.join(', '));
    R.measure.compat_reload_posts = tr2.list;
    // lần đầu không có ld_pub: không được hiện lỗi đỏ
    await page.evaluate(() => { localStorage.removeItem('ld_pub'); localStorage.removeItem('ld_pub_t'); Object.keys(localStorage).filter((k) => k.startsWith('ld_c_')).forEach((k) => localStorage.removeItem(k)); });
    const tr3 = trackPosts(page);
    await page.reload();
    await page.waitForFunction(() => /Đề đang mở/.test(document.querySelector('main').innerText) && !document.querySelector('main .skeleton'), null, { timeout: 6 * LAT + 3000 });
    await page.waitForTimeout(2 * LAT + 800);
    tr3.stop();
    note('[1.0.0] POST khi tải lại không có ld_pub/đệm: ' + tr3.list.join(', '));
    R.measure.compat_reload_nopub_posts = tr3.list;
    const pinVisible2 = await page.$('#btnPin').then((b) => b && b.isVisible());
    verdict('TC-1.0', !pinVisible2, '[1.0.0] không có ld_pub: nút Đổi PIN ' + (pinVisible2 ? 'VẪN HIỆN' : 'bị ẩn'));
    const bodyBad = await page.evaluate(() => document.body.innerText.includes('Không có chức năng'));
    const reds = toasts.filter(([k]) => k === 'toast-err');
    const fnToast = toasts.filter(([, t]) => /Không có chức năng/.test(t));
    verdict('TC-1.4', !bodyBad && !fnToast.length && !reds.length, `[1.0.0] HS: "Không có chức năng" trên trang=${bodyBad}, toast "Không có chức năng"=${fnToast.length}, toast đỏ=${JSON.stringify(reds)}`);
    // đăng xuất / đăng nhập lại
    await page.click('#btnLogout'); await page.click('[data-close="ok"]');
    await loginStudent(page, B, 'HS0001', '0101');
    await page.waitForSelector('text=Đề đang mở', { timeout: 20000 });
    verdict('TC-1.4', true, '[1.0.0] đăng xuất rồi đăng nhập lại được');
    await ctx.close();

    // giáo viên với máy chủ cũ
    const actx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    await instrument(actx, toasts);
    const ad = await actx.newPage();
    wireErrors(ad, errors, 'GV');
    await routeCdn(ad);
    await ad.goto(B + '/admin.html');
    await ad.fill('#pw', srv.pw);
    await ad.click('#btnLogin');
    await ad.waitForSelector('text=Bài nộp mới nhất', { timeout: 20000 });
    await ad.waitForTimeout(LAT + 500);
    const noteSrv = await ad.evaluate(() => document.body.innerText.includes('Cần cập nhật máy chủ'));
    note('[1.0.0] trang quản trị có ghi chú "Cần cập nhật máy chủ": ' + noteSrv);
    await ad.screenshot({ path: path.join(SHOTS, '08-qt-may-chu-cu.png') });
    for (const [hs, title] of ADMIN_TABS) { const m = await nav(ad, hs, title); await ad.waitForTimeout(LAT + 600); verdict('TC-1.4', m.tReady != null, `[1.0.0] GV tab "${title}" hiện (${r0(m.tReady)} ms)`); }
    const m2 = await nav(ad, '#/de-thi', 'Đề thi');
    note(`[1.0.0] GV chuyển lại tab Đề thi có đệm: ${m2.tReady.toFixed(1)} ms`);
    const reds2 = toasts.filter(([k, t]) => k === 'toast-err' || /Không có chức năng/.test(t));
    const bad2 = await ad.evaluate(() => document.body.innerText.includes('Không có chức năng'));
    verdict('TC-1.4', !reds2.length && !bad2, '[1.0.0] GV: toast đỏ/"Không có chức năng": ' + (JSON.stringify(reds2) + (bad2 ? ' + trên trang' : '')));
    await actx.close();
    verdict('TC-1.4', errors.length === 0, '[1.0.0] lỗi console/pageerror: ' + (errors.join(' | ') || 'không'));
  } finally { srv.proc.kill(); }
}

(async () => {
  const browser = await chromium.launch();
  try {
    if (MODE === 'all' || MODE === 'new') await runNew(browser);
    if (MODE === 'all' || MODE === 'compat') await runCompat(browser);
  } catch (e) {
    console.error('LỖI KỊCH BẢN:', e);
    R.crash = String(e && e.stack || e);
    process.exitCode = 2;
  } finally {
    await browser.close();
  }
  console.log('\n=== Tổng hợp ===');
  Object.entries(R.tc).sort().forEach(([k, v]) => console.log(`${k}: ${v.pass ? 'ĐẠT' : 'KHÔNG ĐẠT'}`));
  if (Object.values(R.tc).some((v) => !v.pass)) process.exitCode = process.exitCode || 1;
  if (process.env.JSON_OUT) fs.writeFileSync(process.env.JSON_OUT, JSON.stringify(R, null, 1));
})();
