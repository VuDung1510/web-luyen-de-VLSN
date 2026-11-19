// E2E Pha 5 (người làm): màu #1D6B3E, logo tạm, chân trang, giữ bố cục.
// Tự chạy dev-server.
//   NODE_PATH=$(npm root -g) LIBS_DIR=... node tests/pha5.e2e.js [new|compat|all]   (mặc định all)
//   Đo "trước" trên bản main (worktree tạm):
//   TRUOC_ROOT=<thư mục worktree main> node tests/pha5.e2e.js truoc
// Biến môi trường: PORT_NEW (8783), PORT_OLD (8784), PORT_TRUOC (8785), SHOTS (docs/bao-cao/anh/pha-5).
// Bao phủ: TC-5.5 (logo 4 vị trí, thử logo ngang 300×100), TC-5.7 (chân trang, không tên giáo viên),
// TC-5.8 (so bố cục với bo-cuc-truoc.json), TC-5.9 (ảnh chụp), TC-5.10 (biểu đồ), TC-5.11 (không lỗi JS), TC-5.12 (không cuộn ngang).
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');

const MODE = process.argv[2] || 'all';
const PORT_NEW = +(process.env.PORT_NEW || 8783);
const PORT_OLD = +(process.env.PORT_OLD || 8784);
const PORT_TRUOC = +(process.env.PORT_TRUOC || 8785);
const SHOTS = process.env.SHOTS || path.join(__dirname, '..', 'docs', 'bao-cao', 'anh', 'pha-5');
const LIBS = process.env.LIBS_DIR;
const TEACHER = 'Thầy Thử Nghiệm';
const LOGO_PATH = 'assets/img/logo-vlsn.png';
const BRAND = ['HỆ THỐNG GIÁO DỤC VẬT LÝ SIÊU NHẨM', 'Hotline: 0978 650726 - 0326 425 111', 'VẬT LÝ SIÊU NHẨM - ĐỊNH HƯỚNG TRUYỀN CẢM HỨNG'];
const VPS = [{ w: 390, h: 844 }, { w: 1280, h: 800 }];
fs.mkdirSync(SHOTS, { recursive: true });

let failed = 0;
function check(name, pass, info) {
  if (!pass) failed++;
  console.log(`  ${pass ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`);
}

function startServer(port, env, root) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [path.join(root || path.join(__dirname, '..'), 'tests', 'dev-server.js'), String(port)], { env: Object.assign({}, process.env, env), stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    p.stdout.on('data', (d) => { out += d; const m = out.match(/mật khẩu: (\S+)\)/); if (m) resolve({ proc: p, pw: m[1], base: 'http://localhost:' + port }); });
    p.stderr.on('data', (d) => { out += d; });
    p.on('exit', (c) => reject(new Error('dev-server thoát ' + c + ': ' + out)));
    setTimeout(() => reject(new Error('dev-server không khởi động: ' + out)), 20000);
  });
}
async function api(base, action, body) {
  const r = await fetch(base + '/exec', { method: 'POST', body: JSON.stringify(Object.assign({ action }, body || {})) });
  return r.json();
}
async function routeCdn(page) {
  // Google Fonts bị chặn trong môi trường thử → trả rỗng (trang rơi về phông hệ thống)
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
function watch(page, sink, tag) {
  page.on('pageerror', (e) => sink.push(tag + ' pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) sink.push(tag + ' console: ' + m.text()); });
}

/* ---------- PNG ngang 300×100 (chỉ dùng khi thử, không ghi vào repo) ---------- */
const CRC = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xffffffff; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function widePng(w, h) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = y * (w * 4 + 1) + 1 + x * 4, inside = x > 10 && x < w - 10 && y > 10 && y < h - 10;
    raw[o] = 200; raw[o + 1] = 30; raw[o + 2] = 30; raw[o + 3] = inside ? 255 : 0;
  }
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/* ---------- đo bố cục ---------- */
const BLOCKS = ['.topbar', '.brand', '.brand-logo', '#nav', '#userBox', '.card', '.tabs', '.stats', '.exam-bar', '.qnav', '#btnNav', '.score-hero', '.score-ring', '.table-wrap'];
async function measure(page) {
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.waitForTimeout(250);
  return page.evaluate((sels) => {
    const r = (e) => { const b = e.getBoundingClientRect(); return { x: Math.round(b.x + scrollX), y: Math.round(b.y + scrollY), width: Math.round(b.width), height: Math.round(b.height) }; };
    const blocks = {};
    sels.forEach((s) => { const e = document.querySelector(s); if (e) blocks[s] = r(e); });
    [...document.querySelectorAll('main > *')].forEach((e, i) => { blocks['main > *:nth-child(' + (i + 1) + ')'] = r(e); });
    const heads = [...document.querySelectorAll('h1, h2, h3')].map(r);
    return { blocks, heads };
  }, BLOCKS);
}
/** TC-5.8: x, width ≤ 4 px; y ≤ 4 + Σ chênh chiều cao tiêu đề đứng trước khối; height ≤ 4 + Σ chênh tiêu đề nằm trong khối. */
function compareLayout(before, after) {
  const bad = [];
  for (const key of Object.keys(before)) {
    const B = before[key], A = after[key];
    if (!A) { bad.push(key + ': không có ở bản sau'); continue; }
    const hd = B.heads.map((h, i) => ({ h, d: A.heads[i] ? Math.abs(A.heads[i].height - h.height) : 0 }));
    for (const [sel, b] of Object.entries(B.blocks)) {
      const a = A.blocks[sel];
      if (!a) { bad.push(`${key} ${sel}: mất khối`); continue; }
      const above = hd.filter((x) => x.h.y + x.h.height <= b.y + 1).reduce((s, x) => s + x.d, 0);
      const inside = hd.filter((x) => x.h.y >= b.y - 1 && x.h.y + x.h.height <= b.y + b.height + 1).reduce((s, x) => s + x.d, 0);
      const dx = Math.abs(a.x - b.x), dw = Math.abs(a.width - b.width), dy = Math.abs(a.y - b.y), dh = Math.abs(a.height - b.height);
      if (dx > 4 || dw > 4 || dy > 4 + above || dh > 4 + inside) bad.push(`${key} ${sel}: dx=${dx} dw=${dw} dy=${dy}(cho ${4 + above}) dh=${dh}(cho ${4 + inside})`);
    }
  }
  return bad;
}

/* ---------- kiểm logo / chân trang ---------- */
async function logoInfo(page) {
  return page.evaluate(() => {
    const img = document.querySelector('img.brand-logo');
    if (!img) return null;
    const cs = getComputedStyle(img), b = img.getBoundingClientRect();
    return { src: img.getAttribute('src'), alt: img.getAttribute('alt'), nw: img.naturalWidth, complete: img.complete, w: b.width, h: b.height, fit: cs.objectFit, bg: cs.backgroundColor,
      icon: (document.querySelector('link[rel=icon]') || {}).href || '' };
  });
}
async function checkLogo(page, tag) {
  await page.waitForFunction(() => { const i = document.querySelector('img.brand-logo'); return i && i.complete; }, null, { timeout: 5000 }).catch(() => {});
  const L = await logoInfo(page);
  check(`TC-5.5 logo ${tag}`, L && L.src.endsWith(LOGO_PATH) && L.alt === 'Vật Lý Siêu Nhẩm' && L.nw > 0 && Math.abs(L.w - 34) <= 1 && Math.abs(L.h - 34) <= 1 &&
    L.fit === 'contain' && L.bg === 'rgb(255, 255, 255)', JSON.stringify(L));
  return L;
}
async function checkFooter(page, tag) {
  const f = await page.evaluate(() => {
    const ft = document.querySelector('#footer') || document.querySelector('footer');
    const top = document.querySelector('#topbar') || document.querySelector('.topbar');
    return { ft: ft ? ft.innerText : null, top: top ? top.innerText : '', hidden: ft ? getComputedStyle(ft).display === 'none' : true };
  });
  const brandOk = f.ft != null && BRAND.every((s) => f.ft.includes(s));
  const noTeacher = ![f.ft || '', f.top].some((s) => s.includes(TEACHER) || s.includes('Giáo viên:'));
  check(`TC-5.7 chân trang ${tag}`, brandOk && noTeacher && !f.hidden, brandOk ? (noTeacher ? '' : 'còn tên giáo viên') : 'thiếu chữ: ' + JSON.stringify(f.ft));
}
async function noHScroll(page, tag) {
  const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
  check(`TC-5.12 không cuộn ngang ${tag}`, o.sw <= o.iw, `${o.sw} / ${o.iw}`);
}

/* ---------- một lượt (khổ × chế độ) ---------- */
async function pass(browser, srv, opt) {
  const { vp, dark, truoc, save, compat } = opt;
  const tag = `${vp.w}${dark ? ' tối' : ''}${compat ? ' [1.0.0]' : ''}`;
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1, colorScheme: dark ? 'dark' : 'light' });
  const errs = [];
  const layout = {};
  const shots = [];
  const shot = async (page, screen, full) => {
    if (!save) return;
    const name = truoc ? `truoc-${screen}-${vp.w}` : `${dark ? 'toi-' : ''}${screen}-${vp.w}`;
    shots.push(name);
    await page.screenshot({ path: path.join(SHOTS, '_' + name + '.png'), fullPage: !!full });
  };
  const step = async (page, screen, full, extra) => {
    if (!dark) layout[screen] = await measure(page);
    if (!truoc) { await noHScroll(page, `${screen} ${tag}`); if (extra) await extra(); }
    await shot(page, screen, full);
  };

  // ---------- HỌC SINH ----------
  const page = await ctx.newPage();
  watch(page, errs, 'hs');
  page.on('dialog', (d) => d.accept());
  await routeCdn(page);
  await page.goto(srv.base + '/');
  await page.waitForSelector('#selClass option[value="12A1"]', { state: 'attached' });
  await step(page, 'dang-nhap', true, () => checkLogo(page, `đăng nhập ${tag}`));
  await page.selectOption('#selClass', '12A1');
  await page.waitForSelector('#selStudent option[value="HS0001"]', { state: 'attached' });
  await page.selectOption('#selStudent', 'HS0001');
  await page.fill('#pin', '0101');
  await page.click('#btnLogin');
  await page.waitForSelector('text=Đề đang mở');
  await page.waitForTimeout(300);
  await step(page, 'trang-chu', true, async () => { await checkLogo(page, `trang chủ ${tag}`); await checkFooter(page, `trang chủ ${tag}`); });

  if (!truoc && !dark && vp.w === 1280) {
    // favicon tải được (HTTP 200) — trang học sinh
    const L = await logoInfo(page);
    const st = await page.evaluate((u) => fetch(u).then((r) => r.status), L.icon);
    check('TC-5.5 favicon trang học sinh', L.icon.endsWith(LOGO_PATH) && st === 200, L.icon + ' → ' + st);
    // Thử logo ngang 300×100 (chỉ trong trình duyệt thử) → khung vẫn 34×34, bố cục trang chủ không đổi
    const png = widePng(300, 100);
    await page.route('**/' + LOGO_PATH, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: png }));
    await page.reload();
    await page.waitForSelector('text=Đề đang mở');
    await page.waitForFunction(() => { const i = document.querySelector('img.brand-logo'); return i && i.complete && i.naturalWidth === 300; }, null, { timeout: 5000 }).catch(() => {});
    const W = await logoInfo(page);
    const wl = await measure(page);
    const diff = compareLayout({ x: layout['trang-chu'] }, { x: wl });
    check('TC-5.5 thay bằng logo ngang 300×100: khung 34×34, bố cục giữ', W.nw === 300 && Math.abs(W.w - 34) <= 1 && Math.abs(W.h - 34) <= 1 && diff.length === 0, JSON.stringify({ nw: W.nw, w: W.w, h: W.h }) + ' ' + diff.join('; '));
    if (save) await page.screenshot({ path: path.join(SHOTS, '_thu-logo-ngang-1280.png'), clip: { x: 0, y: 0, width: 640, height: 60 } });
    await page.unroute('**/' + LOGO_PATH);
    await page.reload();
    await page.waitForSelector('text=Đề đang mở');
  }

  // làm bài
  await page.goto(srv.base + '/#/lam-bai/DEMAU');
  await page.waitForSelector('#btnStart');
  if (await page.$('[data-goal="8"]')) await page.click('[data-goal="8"]');
  await page.click('#btnStart');
  await page.waitForSelector('.timer');
  const qs = await page.$$('.q');
  await qs[0].$('[data-opt="C"]').then((b) => b.click());
  await qs[1].$('[data-opt="A"]').then((b) => b.click());
  await qs[2].$('[data-opt="A"]').then((b) => b.click());
  for (const v of ['0:D', '1:S', '2:D', '3:D']) await qs[3].$(`[data-tf="${v}"]`).then((b) => b.click());
  await qs[4].$('input').then((i) => i.fill('420'));
  await page.evaluate(() => scrollTo(0, 0));
  await step(page, 'lam-bai', false, async () => {
    const hid = await page.evaluate(() => getComputedStyle(document.getElementById('footer')).display === 'none' || document.getElementById('footer').classList.contains('hidden'));
    check(`TC-5.7 màn làm bài ẩn chân trang ${tag}`, hid);
  });
  await page.click('#btnSubmit');
  await page.click('[data-close="ok"]');
  await page.waitForSelector('.score-ring', { timeout: 15000 });
  await page.waitForTimeout(400);
  await step(page, 'ket-qua', true);

  if (!truoc && !dark) {
    // TC-5.10 biểu đồ thống kê học sinh
    await page.goto(srv.base + '/#/thong-ke');
    await page.waitForSelector('#chTimeline');
    await page.waitForFunction(() => window.Chart && Chart.getChart('chTimeline'), null, { timeout: 5000 }).catch(() => {});
    const c = await page.evaluate(() => {
      const ch = window.Chart && Chart.getChart('chTimeline');
      return { border: ch ? String(ch.data.datasets[0].borderColor).trim().toLowerCase() : null, primary: getComputedStyle(document.documentElement).getPropertyValue('--primary').trim().toLowerCase() };
    });
    check(`TC-5.10 chTimeline dùng --primary ${tag}`, c.border && c.border === c.primary && c.primary === '#1d6b3e', JSON.stringify(c));
    await noHScroll(page, `thống kê ${tag}`);
  }

  // ---------- GIÁO VIÊN ----------
  const ad = await ctx.newPage();
  watch(ad, errs, 'qt');
  ad.on('dialog', (d) => d.accept());
  await routeCdn(ad);
  await ad.goto(srv.base + '/admin.html');
  await ad.fill('#pw', srv.pw);
  await ad.click('#btnLogin');
  await ad.waitForSelector('text=Bài nộp mới nhất');
  await ad.waitForTimeout(300);
  await step(ad, 'qt-tong-quan', true, async () => { await checkLogo(ad, `quản trị ${tag}`); await checkFooter(ad, `quản trị ${tag}`); });
  if (!truoc && !dark && vp.w === 1280) {
    const L = await logoInfo(ad);
    const st = await ad.evaluate((u) => fetch(u).then((r) => r.status), L.icon);
    check('TC-5.5 favicon trang quản trị', L.icon.endsWith(LOGO_PATH) && st === 200, L.icon + ' → ' + st);
    const title = await ad.title();
    check('Tiêu đề tab quản trị', title === 'Quản trị · Luyện đề', title);
    // ảnh phóng to đầu trang (logo tạm) — trang học sinh
    if (save) {
      const z = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 3 });
      const zp = await z.newPage(); await routeCdn(zp);
      await zp.goto(srv.base + '/');
      await zp.waitForSelector('#selClass option[value="12A1"]', { state: 'attached' });
      await zp.waitForFunction(() => document.querySelector('img.brand-logo').complete);
      const b = await zp.$eval('.brand', (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
      await zp.screenshot({ path: path.join(SHOTS, '_logo-tam-dau-trang.png'), clip: { x: Math.max(0, b.x - 16), y: 0, width: b.width + 32, height: b.y + b.height + 10 } });
      await z.close();
    }
  }
  await ad.goto(srv.base + '/admin.html#/de-thi/sua/DEMAU');
  await ad.waitForSelector('.qedit');
  await ad.waitForTimeout(400);
  await step(ad, 'qt-soan-de', false);

  if (!truoc && !dark && vp.w === 1280) {
    await ad.goto(srv.base + '/admin.html#/de-thi/thong-ke/DEMAU');
    await ad.waitForSelector('text=Phân tích từng câu');
    await ad.waitForFunction(() => window.Chart && Chart.getChart('chBins') && Chart.getChart('chQ'), null, { timeout: 5000 }).catch(() => {});
    const c = await ad.evaluate(() => {
      const v = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim().toLowerCase();
      const b = Chart.getChart('chBins'), q = Chart.getChart('chQ');
      const qc = q ? [].concat(q.data.datasets[0].backgroundColor).map((x) => String(x).trim().toLowerCase()) : [];
      return { bins: b ? String(b.data.datasets[0].backgroundColor).trim().toLowerCase() : null, q: [...new Set(qc)], primary: v('--primary'), good: v('--good'), bad: v('--bad') };
    });
    check('TC-5.10 chBins dùng --primary', c.bins === c.primary, JSON.stringify(c));
    check('TC-5.10 chQ dùng ≥ 2 màu trong --good/--primary/--bad', c.q.length >= 2 && c.q.every((x) => [c.good, c.primary, c.bad].includes(x)), JSON.stringify(c.q));
  }

  check(`TC-5.11 không lỗi JS ${tag}${truoc ? ' (main)' : ''}`, errs.length === 0, errs.join(' | '));
  await ctx.close();
  return { layout, shots };
}

/* ---------- đặt tên ảnh theo thứ tự NN-mo-ta.png ---------- */
const ORDER = [
  'dang-nhap-390', 'dang-nhap-1280', 'trang-chu-390', 'trang-chu-1280', 'lam-bai-390', 'lam-bai-1280', 'ket-qua-390', 'ket-qua-1280',
  'qt-tong-quan-390', 'qt-tong-quan-1280', 'qt-soan-de-390', 'qt-soan-de-1280',
  'toi-dang-nhap-390', 'toi-trang-chu-390', 'toi-lam-bai-390', 'toi-ket-qua-390', 'toi-qt-tong-quan-390', 'toi-qt-soan-de-390',
  'logo-tam-dau-trang', 'thu-logo-ngang-1280', 'truoc-trang-chu-1280', 'truoc-ket-qua-1280'
];
function renameShots() {
  ORDER.forEach((n, i) => {
    const src = path.join(SHOTS, '_' + n + '.png');
    if (fs.existsSync(src)) fs.renameSync(src, path.join(SHOTS, String(i + 1).padStart(2, '0') + '-' + n + '.png'));
  });
  fs.readdirSync(SHOTS).filter((f) => /^_truoc-/.test(f)).forEach((f) => fs.unlinkSync(path.join(SHOTS, f))); // ảnh "trước" không cần giữ
}

async function prepare(srv) {
  const tok = (await api(srv.base, 'loginAdminPassword', { password: srv.pw })).data.token;
  const r = await api(srv.base, 'adminSaveSettings', { token: tok, settings: { TEN_GIAO_VIEN: TEACHER } });
  if (!r.ok) throw new Error('adminSaveSettings: ' + r.error);
}

async function run(mode) {
  const compat = mode === 'compat', truoc = mode === 'truoc';
  const root = truoc ? process.env.TRUOC_ROOT : null;
  if (truoc && !root) throw new Error('Cần TRUOC_ROOT = thư mục worktree của main');
  const port = truoc ? PORT_TRUOC : compat ? PORT_OLD : PORT_NEW;
  const srv = await startServer(port, compat ? { SERVER_COMPAT: '1.0.0' } : { SERVER_COMPAT: '' }, root);
  console.log(`\n== ${truoc ? 'TRƯỚC (main)' : compat ? 'Máy chủ 1.0.0' : 'Máy chủ mới'} — ${srv.base}`);
  const browser = await chromium.launch();
  try {
    await prepare(srv);
    const save = !compat; // ảnh và số đo chỉ ghi ở lượt máy chủ mới (và lượt "trước")
    const layout = {};
    for (const vp of VPS) {
      const r = await pass(browser, srv, { vp, truoc, save, compat });
      for (const [k, v] of Object.entries(r.layout)) layout[`${k}@${vp.w}`] = v;
    }
    if (!truoc) await pass(browser, srv, { vp: VPS[0], dark: true, save, compat });
    const fontInfo = await (async () => {
      const c = await browser.newContext(); const p = await c.newPage(); await routeCdn(p);
      await p.goto(srv.base + '/');
      await p.waitForSelector('#selClass', { state: 'attached' });
      const f = await p.evaluate(async () => { await document.fonts.ready; return { soPhongWeb: document.fonts.size, daTai: [...document.fonts].filter((x) => x.status === 'loaded').map((x) => x.family), ghiChu: 'Google Fonts bị chặn khi thử: Montserrat và Be Vietnam Pro rơi về phông hệ thống' }; });
      await c.close(); return f;
    })();
    if (save) {
      const file = path.join(SHOTS, truoc ? 'bo-cuc-truoc.json' : 'bo-cuc-sau.json');
      fs.writeFileSync(file, JSON.stringify({ ghiChu: 'getBoundingClientRect (px, toạ độ trang), chế độ sáng; khoá = màn@khổ', phong: fontInfo, layout }, null, 1));
    }
    // TC-5.8 so cùng dữ liệu: bo-cuc-truoc.json đo với máy chủ mới, nên chỉ so ở lượt máy chủ mới
    // (máy chủ 1.0.0 không có mục tiêu điểm / luyện tập → trang khác dữ liệu, không so được)
    if (!truoc && !compat) {
      const fileB = path.join(SHOTS, 'bo-cuc-truoc.json');
      if (fs.existsSync(fileB)) {
        const B = JSON.parse(fs.readFileSync(fileB, 'utf8')).layout;
        const bad = compareLayout(B, layout);
        check('TC-5.8 bố cục giữ nguyên so với main', bad.length === 0, bad.length ? bad.slice(0, 12).join('\n      ') : `${Object.keys(B).length} màn × khổ`);
        // Ở khổ 390, #userBox cùng hàng với .brand như trên main
        const same = (L) => { const b = L.blocks['.brand'], u = L.blocks['#userBox']; return b && u && Math.abs((b.y + b.height / 2) - (u.y + u.height / 2)) < 8; };
        const k = 'trang-chu@390';
        check('TC-5.8 khổ 390: #userBox cùng hàng .brand như main', B[k] && layout[k] && same(B[k]) === same(layout[k]), `main: ${B[k] && same(B[k])}, nhánh: ${layout[k] && same(layout[k])}`);
      } else console.log('  (chưa có bo-cuc-truoc.json — chạy chế độ "truoc" trước để so TC-5.8)');
    }
    console.log('  Phông khi đo:', JSON.stringify(fontInfo));
  } finally {
    await browser.close();
    srv.proc.kill();
  }
}

(async () => {
  const modes = MODE === 'all' ? ['new', 'compat'] : [MODE];
  for (const m of modes) await run(m);
  if (MODE !== 'compat') renameShots();
  console.log(failed ? `\n${failed} kiểm tra KHÔNG đạt` : '\nTất cả kiểm tra Pha 5 đạt');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
