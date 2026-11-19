// Kiểm thử độc lập Pha 5 (người kiểm thử) — giao diện, viết theo docs/spec/pha-5-thiet-ke.md.
// TC-5.5 (logo, favicon), 5.7 (chân trang), 5.8 (bố cục so với main), 5.9 (ảnh), 5.10 (biểu đồ), 5.11 (lỗi JS), 5.12 (cuộn ngang),
// cộng màu chủ đạo thực tế (sáng/tối), màu "đúng" khác màu chủ đạo, không còn màu xanh dương cũ ở bất kỳ phần tử nào.
//
//   NODE_PATH=$(npm root -g) LIBS_DIR=<node_modules có katex, chart.js> \
//     MAIN_DIR=<worktree của main> WIDE_DIR=<bản sao nhánh có logo ngang 300×100> FONTS_DIR=<node_modules có @fontsource> \
//     node tests/pha5-kiem-thu.e2e.js [nhanh|compat|bocuc|all]
// Tự khởi động dev-server: nhánh máy chủ mới (PORT_NEW 8790), nhánh SERVER_COMPAT=1.0.0 (PORT_OLD 8791),
// main (PORT_MAIN 8792), bản sao logo ngang (PORT_WIDE 8793). Ảnh: docs/bao-cao/anh/pha-5/kt-*.png.
// Không có MAIN_DIR thì bỏ phần so bố cục; không có WIDE_DIR thì bỏ phần logo ngang; không có FONTS_DIR thì chỉ đo khi Google Fonts bị chặn.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const MODE = process.argv[2] || 'all';
const LAT = +(process.env.LATENCY_MS || 100);
const PORT_NEW = +(process.env.PORT_NEW || 8790);
const PORT_OLD = +(process.env.PORT_OLD || 8791);
const PORT_MAIN = +(process.env.PORT_MAIN || 8792);
const PORT_WIDE = +(process.env.PORT_WIDE || 8793);
const ROOT = path.join(__dirname, '..');
const SHOTS = process.env.SHOTS || path.join(ROOT, 'docs', 'bao-cao', 'anh', 'pha-5');
const LIBS = process.env.LIBS_DIR;
const MAIN_DIR = process.env.MAIN_DIR;
const WIDE_DIR = process.env.WIDE_DIR;
const FONTS_DIR = process.env.FONTS_DIR;
fs.mkdirSync(SHOTS, { recursive: true });

const TEACHER = 'Thầy Thử Nghiệm';
const FOOT = ['HỆ THỐNG GIÁO DỤC VẬT LÝ SIÊU NHẨM', 'Hotline: 0978 650726 - 0326 425 111', 'VẬT LÝ SIÊU NHẨM - ĐỊNH HƯỚNG TRUYỀN CẢM HỨNG'];
const PRIMARY = { light: '#1d6b3e', dark: '#5fbf87' };
const PRIMARY_RGB = { light: 'rgb(29, 107, 62)', dark: 'rgb(95, 191, 135)' };
const HOVER_RGB = { light: 'rgb(21, 87, 58)', dark: 'rgb(127, 211, 162)' };
const GOOD_RGB = { light: 'rgb(74, 115, 17)', dark: 'rgb(163, 230, 53)' };
const ONSTATUS_RGB = { light: 'rgb(255, 255, 255)', dark: 'rgb(11, 16, 32)' };
// Màu cũ (xanh dương + "đúng" cũ + cam favicon quản trị không tính vì --accent giữ nguyên)
const OLD_RGB = ['rgb(29, 78, 216)', 'rgb(107, 147, 255)', 'rgb(227, 235, 255)', 'rgb(29, 43, 82)', 'rgb(21, 128, 61)', 'rgb(74, 222, 128)', 'rgb(220, 252, 231)', 'rgb(20, 50, 31)'];

const R = { tc: {} };
function verdict(tc, pass, evidence) {
  const e = R.tc[tc] || { pass: true, evidence: [] };
  e.pass = e.pass && !!pass; e.evidence.push((pass ? 'OK  ' : 'FAIL ') + evidence); R.tc[tc] = e;
  console.log(`  ${pass ? '✓' : '✗'} ${tc}: ${evidence}`);
}
// Bộ phụ (trước / logo ngang / 1.0.0) chỉ chụp vài màn để thư mục ảnh gọn
const KEEP_EXTRA = /^(truoc-1280-(trang-chu|ket-qua)|logo-ngang-(1280|390)-(trang-chu|qt-tong-quan)|1\.0\.0-1280-(trang-chu|qt-ngan-hang))$/;
const shot = (page, name, opts) => (/^(truoc|logo-ngang|1\.0\.0)-/.test(name) && !KEEP_EXTRA.test(name)) ? Promise.resolve() : page.screenshot(Object.assign({ path: path.join(SHOTS, 'kt-' + name + '.png') }, opts || {}));

function startServer(port, env, root) {
  return new Promise((resolve, reject) => {
    const dir = root || ROOT;
    const p = spawn(process.execPath, [path.join(dir, 'tests', 'dev-server.js'), String(port)], { cwd: dir, env: Object.assign({}, process.env, env), stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    p.stdout.on('data', (d) => { out += d; const m = out.match(/mật khẩu: (\S+)\)/); if (m) resolve({ proc: p, pw: m[1], base: 'http://localhost:' + port }); });
    p.stderr.on('data', (d) => { out += d; });
    p.on('exit', (c) => reject(new Error('dev-server thoát ' + c + ': ' + out)));
    setTimeout(() => reject(new Error('dev-server không khởi động: ' + out)), 20000);
  });
}
function stop(s) { return new Promise((r) => { s.proc.once('exit', () => setTimeout(r, 150)); s.proc.kill(); }); }
async function api(base, action, body) {
  const r = await fetch(base + '/exec', { method: 'POST', body: JSON.stringify(Object.assign({ action }, body || {})) });
  const j = await r.json();
  if (!j.ok) throw new Error(action + ': ' + j.error);
  return j.data;
}
// Dữ liệu giống nhau cho main và nhánh: tên giáo viên + 5 học sinh phụ làm Đề mẫu (câu 1, 2 đúng; câu 3 sai) để biểu đồ % theo câu có cả câu dễ lẫn khó.
async function seed(base, pw) {
  const t = (await api(base, 'loginAdminPassword', { password: pw })).token;
  await api(base, 'adminSaveSettings', { token: t, settings: { TEN_GIAO_VIEN: TEACHER } });
  for (let i = 1; i <= 5; i++) await api(base, 'adminSaveStudent', { token: t, student: { hoTen: 'Học Sinh Phụ ' + i, lop: '12A1', pin: '090' + i } });
  const ss = (await api(base, 'adminListStudents', { token: t })).filter((s) => /Học Sinh Phụ/.test(s.hoTen));
  for (const s of ss) {
    const tok = (await api(base, 'loginPin', { studentId: s.id, pin: s.pin })).token;
    const a = await api(base, 'startExam', { token: tok, examId: 'DEMAU' });
    await api(base, 'submitExam', { token: tok, attemptToken: a.attemptToken, answers: { 1: 'C', 2: 'B', 3: 'D' } });
  }
  return t;
}

// ---------- phông: chặn, hoặc phục vụ bản cục bộ (@fontsource) chỉ để đo ----------
function localFontCss(url) {
  const fams = [...new URL(url).searchParams.getAll('family')];
  let css = '';
  for (const f of fams) {
    const [name, spec] = f.split(':');
    const slug = name.toLowerCase().replace(/\+/g, '-').replace(/\s+/g, '-');
    const ws = ((spec || '').split('@')[1] || '400').split(';');
    for (const w of ws) {
      const file = path.join(FONTS_DIR, '@fontsource', slug, w + '.css');
      if (fs.existsSync(file)) css += fs.readFileSync(file, 'utf8').replace(/url\(\.\/files\/([^)]+)\)/g, `url(https://fonts.gstatic.com/__local/${slug}/$1)`);
    }
  }
  return css;
}
async function routeCdn(page, fonts) {
  await page.route(/fonts\.googleapis\.com/, (r) => {
    if (fonts === 'cuc-bo' && FONTS_DIR) return r.fulfill({ status: 200, contentType: 'text/css', body: localFontCss(r.request().url()) });
    return r.fulfill({ status: 200, contentType: 'text/css', body: '' });
  });
  await page.route(/fonts\.gstatic\.com/, (r) => {
    const m = r.request().url().match(/__local\/([^/]+)\/(.+)$/);
    if (m && FONTS_DIR) { const f = path.join(FONTS_DIR, '@fontsource', m[1], 'files', m[2]); if (fs.existsSync(f)) return r.fulfill({ status: 200, contentType: 'font/woff2', body: fs.readFileSync(f) }); }
    return r.fulfill({ status: 404, body: '' });
  });
  await page.route(/accounts\.google\.com|lh3\.googleusercontent\.com/, (r) => r.fulfill({ status: 200, body: '' }));
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
const settle = async (page, extra) => { await page.waitForTimeout(LAT + (extra || 400)); await page.evaluate(() => document.fonts && document.fonts.ready.then(() => 0)); };

// ---------- đo ----------
const SINGLE = ['.topbar', '.brand', '.brand-logo', '#nav', '#userBox', '.card', '.tabs', '.stats', '.exam-bar', '.qnav', '.score-hero', '.score-ring', '.table-wrap', '.footer'];
async function measure(page) {
  await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(100);
  return page.evaluate((SINGLE) => {
    const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
    const heads = [...document.querySelectorAll('h1,h2,h3')].filter(vis);
    const out = {};
    const rec = (key, e) => {
      const r = e.getBoundingClientRect();
      let hb = 0; let hi = 0; const hl = [];
      for (const h of heads) {
        const hh = h.getBoundingClientRect().height;
        if (e.contains(h)) hi += hh;
        else if (!h.contains(e) && (h.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING)) { hb += hh; hl.push(Math.round(hh)); }
      }
      out[key] = { x: Math.round(r.left + scrollX), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height), hb: Math.round(hb), hi: Math.round(hi), el: e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : '') };
    };
    for (const s of SINGLE) { const e = [...document.querySelectorAll(s)].find(vis); if (e) rec(s, e); }
    const main = document.querySelector('main');
    if (main) [...main.children].filter(vis).forEach((e, i) => rec(`main>*[${i}]`, e));
    const fonts = [];
    try { document.fonts.forEach((f) => { if (f.status === 'loaded') fonts.push(f.family.replace(/"/g, '') + ' ' + f.weight); }); } catch (e) { /* */ }
    return { rects: out, fonts: [...new Set(fonts)], sw: document.documentElement.scrollWidth, iw: innerWidth };
  }, SINGLE);
}
function compareLayout(before, after, label) {
  const bad = []; let n = 0; const notes = [];
  for (const scr of Object.keys(before)) {
    if (!after[scr]) { bad.push(`${scr}: thiếu màn`); continue; }
    const A = before[scr].rects; const B = after[scr].rects;
    for (const k of Object.keys(A)) {
      const a = A[k]; const b = B[k];
      if (!b) { bad.push(`${scr} ${k}: không còn trên nhánh (${a.el})`); continue; }
      n++;
      const tolY = 4 + Math.abs(b.hb - a.hb); const tolH = 4 + Math.abs(b.hi - a.hi);
      const d = { x: b.x - a.x, w: b.w - a.w, y: b.y - a.y, h: b.h - a.h };
      const fails = [];
      if (Math.abs(d.x) > 4) fails.push(`x ${a.x}→${b.x}`);
      if (Math.abs(d.w) > 4) fails.push(`w ${a.w}→${b.w}`);
      if (Math.abs(d.y) > tolY) fails.push(`y ${a.y}→${b.y} (cho phép ±${tolY})`);
      if (k === '.footer') { if (d.h < -4) fails.push(`h ${a.h}→${b.h}`); } else if (Math.abs(d.h) > tolH) fails.push(`h ${a.h}→${b.h} (cho phép ±${tolH})`);
      if (fails.length) bad.push(`${scr} ${k} [${a.el}]: ${fails.join(', ')}`);
      else if (Math.abs(d.y) > 4 || Math.abs(d.h) > 4) notes.push(`${scr} ${k}: y ${d.y >= 0 ? '+' : ''}${d.y}, h ${d.h >= 0 ? '+' : ''}${d.h} (trong phần chênh tiêu đề)`);
    }
    for (const k of Object.keys(B)) if (!A[k] && k !== '.footer') bad.push(`${scr} ${k}: khối mới trên nhánh (${B[k].el})`);
    // 390: #userBox cùng hàng .brand như main
    const sameRow = (R2) => R2['#userBox'] && R2['.brand'] ? Math.abs((R2['#userBox'].y + R2['#userBox'].h / 2) - (R2['.brand'].y + R2['.brand'].h / 2)) < R2['.brand'].h / 2 : null;
    if (sameRow(A) !== sameRow(B)) bad.push(`${scr}: #userBox cùng hàng .brand trên main ${sameRow(A)}, trên nhánh ${sameRow(B)}`);
  }
  return { bad, n, notes, label };
}

// ---------- màu ----------
async function colourScan(page) {
  return page.evaluate((OLD) => {
    const hits = []; let n = 0;
    for (const e of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(e); n++;
      for (const p of ['color', 'background-color', 'border-top-color', 'border-bottom-color', 'border-left-color', 'border-right-color', 'outline-color', 'fill', 'stroke']) {
        const v = cs.getPropertyValue(p);
        if (OLD.some((o) => v.includes(o))) hits.push(`${e.tagName.toLowerCase()}.${String(e.className).trim().split(/\s+/).join('.')} ${p}=${v}`);
      }
      const bg = cs.backgroundImage; if (bg && OLD.some((o) => bg.includes(o))) hits.push(`${e.tagName.toLowerCase()} background-image`);
    }
    return { hits: [...new Set(hits)].slice(0, 10), total: hits.length, n };
  }, OLD_RGB);
}
const cssVar = (page, v) => page.evaluate((v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim().toLowerCase(), v);
const styleOf = (page, sel, props) => page.evaluate(([sel, props]) => {
  const e = [...document.querySelectorAll(sel)].find((x) => x.offsetParent !== null || getComputedStyle(x).position === 'fixed');
  if (!e) return null; const cs = getComputedStyle(e); const o = {}; props.forEach((p) => { o[p] = cs.getPropertyValue(p); }); return o;
}, [sel, props]);

async function logoCheck(page, scheme, where) {
  const info = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll('.brand-logo')].filter((e) => e.offsetParent !== null);
    const e = imgs[0];
    if (!e) return { n: 0 };
    const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
    const icons = [...document.querySelectorAll('link[rel~="icon"]')].map((l) => l.href);
    const prev = e.previousSibling && e.parentElement.previousSibling; void prev;
    return { n: imgs.length, tag: e.tagName, src: e.getAttribute('src'), full: e.src, alt: e.getAttribute('alt'), nw: e.naturalWidth, nh: e.naturalHeight, complete: e.complete, w: r.width, h: r.height, fit: cs.objectFit, bg: cs.backgroundColor, radius: cs.borderTopLeftRadius, icons, phi: document.body.innerText.includes('Φ') };
  });
  let iconStatus = [];
  for (const u of info.icons || []) { try { const r = await fetch(u); iconStatus.push(r.status + ' ' + (r.headers.get('content-type') || '')); } catch (e) { iconStatus.push('lỗi ' + e.message); } }
  const ok = info.n === 1 && info.tag === 'IMG' && /assets\/img\/logo-vlsn\.png$/.test(info.src) && info.alt === 'Vật Lý Siêu Nhẩm' && info.nw > 0 &&
    Math.abs(info.w - 34) <= 1 && Math.abs(info.h - 34) <= 1 && info.fit === 'contain' && info.bg === 'rgb(255, 255, 255)' && !info.phi;
  verdict('TC-5.5', ok, `${where} (${scheme}): img src="${info.src}" alt="${info.alt}" tự nhiên ${info.nw}×${info.nh}, hiển thị ${info.w}×${info.h}, object-fit ${info.fit}, nền ${info.bg}, bo ${info.radius}; Φ trên trang: ${info.phi}`);
  const iconOk = info.icons && info.icons.length === 1 && /\/assets\/img\/logo-vlsn\.png$/.test(info.icons[0]) && /^200 image\/png/.test(iconStatus[0] || '');
  verdict('TC-5.5 favicon', iconOk, `${where}: link[rel=icon] ${JSON.stringify(info.icons)} → ${iconStatus.join(', ')}`);
  return info;
}
async function footerCheck(page, where, hiddenExpected) {
  const f = await page.evaluate(() => {
    const ft = document.querySelector('#footer') || document.querySelector('footer');
    const tb = document.querySelector('#topbar') || document.querySelector('.topbar');
    if (!ft) return { none: true, top: tb ? tb.innerText : '' };
    const cs = getComputedStyle(ft);
    return { shown: ft.offsetParent !== null && cs.display !== 'none' && ft.getBoundingClientRect().height > 0, lines: [...ft.children].map((c) => c.textContent.trim()), text: ft.innerText, top: tb ? tb.innerText : '', body: document.body.innerText, brandColor: ft.querySelector('.footer-brand') ? getComputedStyle(ft.querySelector('.footer-brand')).color : null, brandFont: ft.querySelector('.footer-brand') ? getComputedStyle(ft.querySelector('.footer-brand')).fontFamily + ' ' + getComputedStyle(ft.querySelector('.footer-brand')).fontWeight : null };
  });
  if (hiddenExpected) { verdict('TC-5.7', f.none || !f.shown, `${where}: #footer ${f.none ? 'không có' : f.shown ? 'ĐANG HIỆN' : 'bị ẩn'}`); return f; }
  const noTeacher = !/Thầy Thử Nghiệm|Giáo viên:/.test((f.text || '') + (f.top || ''));
  const ok = !f.none && f.shown && FOOT.every((s) => f.lines.includes(s)) && f.lines.length === 3 && noTeacher;
  verdict('TC-5.7', ok, `${where}: ${f.none ? 'không có chân trang' : `${f.lines.length} dòng ${JSON.stringify(f.lines)}`}; "${TEACHER}"/"Giáo viên:" trong đầu trang hoặc chân trang: ${!noTeacher}; trong cả trang: ${/Thầy Thử Nghiệm/.test(f.body || '')}; .footer-brand màu ${f.brandColor}, phông ${f.brandFont}`);
  return f;
}

// ---------- một lượt đi qua mọi màn ----------
// opts: { base, pw, vp:[w,h], scheme, fonts, tag, shots(prefix|null), checks(bool), compat(bool) }
async function tour(browser, o) {
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: o.vp[0], height: o.vp[1] }, deviceScaleFactor: 1, colorScheme: o.scheme });
  const page = await ctx.newPage();
  await page.emulateMedia({ colorScheme: o.scheme });
  watchErrors(page, errors, o.tag);
  await routeCdn(page, o.fonts);
  const L = {}; const scroll = []; const colours = {};
  const step = async (name, extra) => {
    await settle(page, extra);
    const m = await measure(page);
    L[name] = m; scroll.push(`${name}:${m.sw}/${m.iw}`);
    if (m.sw > m.iw) scroll.push('TRÀN');
    if (o.checks) {
      const sc = await colourScan(page);
      colours[name] = sc;
      if (sc.total) verdict('Không còn màu cũ', false, `${o.tag} ${name}: ${sc.total} chỗ: ${sc.hits.join(' | ')}`);
    }
    if (o.checks && !colours.link) {
      colours.link = await page.evaluate(() => { const a = [...document.querySelectorAll('main a, .footer a')].find((x) => x.offsetParent && !/\bbtn\b|\bcard\b|\bchip\b/.test(x.className) && x.textContent.trim()); return a ? { t: a.textContent.trim().slice(0, 30), c: getComputedStyle(a).color, scr: location.hash } : null; });
      if (colours.link) verdict('Màu chủ đạo', colours.link.c === PRIMARY_RGB[o.scheme], `${o.tag}: liên kết đầu tiên trong nội dung "${colours.link.t}" (${name}) màu ${colours.link.c}`);
    }
    if (o.shots) await shot(page, `${o.shots}-${name}`);
    return m;
  };
  const B = o.base;
  // 1. đăng nhập
  await page.goto(B + '/');
  await page.waitForSelector('#selClass option[value="12A1"]', { state: 'attached' });
  await step('dang-nhap');
  if (o.checks) { await logoCheck(page, o.scheme, `${o.tag} đăng nhập`); }
  await page.selectOption('#selClass', '12A1');
  await page.waitForSelector('#selStudent option[value="HS0001"]', { state: 'attached' });
  await page.selectOption('#selStudent', 'HS0001');
  await page.fill('#pin', '0101');
  await page.click('#btnLogin');
  await page.waitForSelector('a[href="#/lich-su"]', { timeout: 15000 });
  // 2. trang chủ
  await step('trang-chu', 600);
  if (o.checks) {
    await logoCheck(page, o.scheme, `${o.tag} trang chủ HS`);
    await footerCheck(page, `${o.tag} trang chủ HS`);
    const prim = await cssVar(page, '--primary');
    const btn = await styleOf(page, 'main .btn-primary', ['background-color', 'color', 'border-top-color']);
    const nav = await styleOf(page, '#nav a.active', ['color', 'background-color']);
    // liên kết: một <a> trong main không phải nút
    const link = await page.evaluate(() => { const a = [...document.querySelectorAll('main a')].find((x) => x.offsetParent && !/\bbtn\b|\bcard\b/.test(x.className)); return a ? { t: a.textContent.trim().slice(0, 30), c: getComputedStyle(a).color } : null; });
    let hover = null;
    const hb = await page.$('main .btn-primary');
    if (hb) { await hb.hover(); await page.waitForTimeout(300); hover = await page.evaluate(() => { const e = document.querySelector('main .btn-primary:hover'); return e ? getComputedStyle(e).backgroundColor : null; }); await page.mouse.move(0, 0); }
    colours.home = { prim, btn, nav, link, hover };
    verdict('Màu chủ đạo', prim === PRIMARY[o.scheme] && btn && btn['background-color'] === PRIMARY_RGB[o.scheme] && nav && nav.color === PRIMARY_RGB[o.scheme] && hover === HOVER_RGB[o.scheme],
      `${o.tag}: --primary ${prim}; nút chính nền ${btn && btn['background-color']} chữ ${btn && btn.color}; mục nav đang chọn chữ ${nav && nav.color} nền ${nav && nav['background-color']}; rê chuột nút chính → ${hover}; liên kết ${link ? `"${link.t}" ${link.c}` : '—'}`);
    // chân trang ở cuối trang
    if (o.shots) { await page.evaluate(() => scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(200); await shot(page, `${o.shots}-chan-trang`); await page.evaluate(() => scrollTo(0, 0)); }
  }
  // 3. Luyện tập (máy chủ mới)
  const hasPractice = await page.evaluate(() => [...document.querySelectorAll('a[href="#/luyen-tap"]')].some((a) => a.offsetParent !== null));
  if (hasPractice) {
    await page.click('#nav a[href="#/luyen-tap"]').catch(() => page.goto(B + '/#/luyen-tap'));
    await page.waitForSelector('#ptTree', { timeout: 10000 }).catch(() => {});
    await step('luyen-tap', 500);
  } else if (o.compat && o.checks) verdict('1.0.0: không có Luyện tập', true, `${o.tag}: không có mục Luyện tập (máy chủ 1.0.0)`);
  // 4. làm bài
  await page.goto(B + '/#/lam-bai/DEMAU');
  await page.waitForSelector('#btnStart', { timeout: 10000 });
  await settle(page, 200);
  if (await page.$('[data-goal="8"]')) await page.click('[data-goal="8"]');
  await page.click('#btnStart');
  await page.waitForSelector('#btnSubmit', { timeout: 15000 });
  await settle(page, 300);
  await page.click('#q-1 [data-opt="A"]').catch(() => {});
  await page.waitForTimeout(200);
  await step('lam-bai');
  if (o.checks) {
    await footerCheck(page, `${o.tag} màn làm bài`, true);
    const prog = await styleOf(page, '#prog', ['background-color', 'width']);
    const timer = await styleOf(page, '#timer', ['color', 'background-color']);
    const sel = await styleOf(page, '.opt.sel', ['border-top-color', 'background-color']);
    colours.exam = { prog, timer, sel };
    verdict('Màu chủ đạo', prog && prog['background-color'] === PRIMARY_RGB[o.scheme] && parseFloat(prog.width) > 0 && timer && timer.color === PRIMARY_RGB[o.scheme],
      `${o.tag}: thanh tiến độ #prog nền ${prog && prog['background-color']} rộng ${prog && prog.width}; đồng hồ chữ ${timer && timer.color} nền ${timer && timer['background-color']}; phương án đã chọn viền ${sel && sel['border-top-color']} nền ${sel && sel['background-color']}`);
  }
  // 5. kết quả
  await page.click('#btnSubmit');
  await page.click('[data-close="ok"]');
  await page.waitForSelector('.score-ring', { timeout: 20000 });
  await step('ket-qua', 600);
  if (o.checks) {
    await footerCheck(page, `${o.tag} trang kết quả`);
    const right = await styleOf(page, '.opt.right .key', ['background-color', 'color']);
    const wrong = await styleOf(page, '.opt.wrong .key', ['background-color', 'color']);
    const tfR = await styleOf(page, '.tf-btns button.right', ['background-color', 'color']);
    const prim = await cssVar(page, '--primary');
    const good = await cssVar(page, '--good');
    colours.result = { right, wrong, tfR, prim, good };
    const okGood = right && right['background-color'] === GOOD_RGB[o.scheme] && right['background-color'] !== PRIMARY_RGB[o.scheme] && right.color === ONSTATUS_RGB[o.scheme] && wrong && wrong.color === ONSTATUS_RGB[o.scheme];
    verdict('Màu "đúng" khác màu chủ đạo', okGood,
      `${o.tag}: --good ${good} ≠ --primary ${prim}; ô phương án đúng .opt.right .key nền ${right && right['background-color']} chữ ${right && right.color}; ô sai .opt.wrong .key nền ${wrong && wrong['background-color']} chữ ${wrong && wrong.color}; nút Đ/S đúng ${tfR ? tfR['background-color'] + ' / ' + tfR.color : '—'}`);
  }
  // 6. Thống kê HS: biểu đồ
  await page.goto(B + '/#/thong-ke');
  await page.waitForSelector('#chTimeline', { timeout: 10000 });
  await settle(page, 800);
  if (o.checks) {
    const ch = await page.evaluate(() => { const c = window.Chart && Chart.getChart('chTimeline'); return c ? String(c.data.datasets[0].borderColor) : null; });
    const prim = await cssVar(page, '--primary');
    verdict('TC-5.10', ch && ch.trim().toLowerCase() === prim && prim === PRIMARY[o.scheme], `${o.tag}: chTimeline borderColor "${ch}", --primary "${prim}"`);
  }
  await step('thong-ke', 200);
  for (const [h, n] of [['#/lich-su', 'lich-su'], ['#/bang-xep-hang', 'xep-hang']]) { await page.goto(B + '/' + h); await step(n, 900); }
  // ---- quản trị ----
  await page.goto(B + '/admin.html');
  await page.waitForSelector('#pw');
  await step('qt-dang-nhap');
  if (o.checks) {
    const title = await page.title();
    verdict('Tiêu đề tab quản trị', title === 'Quản trị · Luyện đề', `${o.tag}: <title> "${title}"`);
  }
  await page.fill('#pw', o.pw);
  await page.click('#btnLogin');
  await page.waitForSelector('text=Bài nộp mới nhất', { timeout: 15000 });
  await step('qt-tong-quan', 600);
  if (o.checks) {
    await logoCheck(page, o.scheme, `${o.tag} tổng quan quản trị`);
    await footerCheck(page, `${o.tag} tổng quan quản trị`);
    const prim = await cssVar(page, '--primary');
    const btn = await styleOf(page, 'main .btn-primary', ['background-color']);
    const nav = await styleOf(page, '#nav a.active', ['color']);
    verdict('Màu chủ đạo', prim === PRIMARY[o.scheme] && btn && btn['background-color'] === PRIMARY_RGB[o.scheme] && nav && nav.color === PRIMARY_RGB[o.scheme],
      `${o.tag} quản trị: --primary ${prim}; nút chính ${btn && btn['background-color']}; nav đang chọn ${nav && nav.color}`);
  }
  // trình soạn
  await page.goto(B + '/admin.html#/de-thi/moi');
  await page.waitForSelector('#btnImport', { timeout: 10000 });
  await step('qt-soan-de', 500);
  if (o.checks) {
    const kp = await page.$('.key-pick button');
    let pick = null;
    if (kp) { await kp.click(); await page.waitForTimeout(150); pick = await styleOf(page, '.key-pick button.sel', ['background-color', 'color']); }
    verdict('Màu trình soạn', !pick || pick.color === ONSTATUS_RGB[o.scheme], `${o.tag}: nút đáp án đã chọn .key-pick button.sel nền ${pick && pick['background-color']} chữ ${pick && pick.color}`);
    await page.goto(B + '/admin.html#/de-thi/moi'); await page.waitForSelector('#btnImport'); await settle(page, 300);
  }
  await page.click('#btnImport');
  await page.waitForSelector('#impTabFile', { timeout: 10000 }).catch(() => {});
  if (await page.$('#impTabFile')) await page.click('#impTabFile');
  await step('qt-tai-file', 400);
  if (o.checks) {
    const tab = await styleOf(page, '#impTabs button.active, .tabs button.active', ['color', 'background-color', 'border-bottom-color']);
    verdict('Màu chủ đạo', tab && [tab.color, tab['border-bottom-color'], tab['background-color']].includes(PRIMARY_RGB[o.scheme]), `${o.tag}: tab đang chọn của hộp Tải đề: chữ ${tab && tab.color}, nền ${tab && tab['background-color']}, viền dưới ${tab && tab['border-bottom-color']}`);
  }
  // ngân hàng
  await page.goto('about:blank'); await page.goto(B + '/admin.html#/');
  await page.waitForSelector('text=Bài nộp mới nhất', { timeout: 15000 });
  await page.click('a[data-nav="bank"]');
  await page.waitForTimeout(LAT + 900);
  await step('qt-ngan-hang', 600);
  if (o.compat && o.checks) { const t = await page.$eval('main', (e) => e.textContent); verdict('1.0.0: Ngân hàng', /Cần cập nhật máy chủ/.test(t), `${o.tag}: tab Ngân hàng "${t.replace(/\s+/g, ' ').trim().slice(0, 90)}"`); }
  if (await page.$('#tabPool')) {
    await page.click('#tabPool');
    await page.waitForSelector('#plList', { timeout: 10000 }).catch(() => {});
    await step('qt-pool', 600);
  }
  // các mục quản trị còn lại
  for (const [h, n] of [['#/de-thi', 'qt-de-thi'], ['#/hoc-sinh', 'qt-hoc-sinh'], ['#/ket-qua', 'qt-ket-qua'], ['#/bang-diem', 'qt-bang-diem'], ['#/cai-dat', 'qt-cai-dat']]) {
    await page.goto(B + '/admin.html' + h); await step(n, 900);
  }
  if (o.checks) {
    const t = await page.$eval('main', (e) => e.innerText);
    verdict('Gợi ý ô Tên giáo viên', /Không hiển thị trên trang học sinh \(chỉ dùng nội bộ\)/.test(t), `${o.tag}: trang Cài đặt ${/Không hiển thị trên trang học sinh/.test(t) ? 'có' : 'KHÔNG có'} dòng gợi ý "Không hiển thị trên trang học sinh (chỉ dùng nội bộ)"`);
  }
  // thống kê đề
  await page.goto(B + '/admin.html#/de-thi/thong-ke/DEMAU');
  await page.waitForSelector('#chQ', { timeout: 10000 }).catch(() => {});
  await settle(page, 900);
  if (o.checks) {
    const c = await page.evaluate(() => {
      const g = (id) => { const ch = window.Chart && Chart.getChart(id); if (!ch) return null; const bg = ch.data.datasets[0].backgroundColor; return { bg: Array.isArray(bg) ? bg.map(String) : [String(bg)], border: String(ch.data.datasets[0].borderColor), n: ch.data.labels.length }; };
      return { bins: g('chBins'), q: g('chQ') };
    });
    const prim = await cssVar(page, '--primary'); const good = await cssVar(page, '--good'); const bad = await cssVar(page, '--bad');
    const norm = (s) => s.trim().toLowerCase();
    const binsOk = c.bins && c.bins.bg.map(norm).concat([norm(c.bins.border)]).includes(prim);
    const qCols = c.q ? [...new Set(c.q.bg.map(norm))] : [];
    const qOk = qCols.length >= 2 && qCols.every((x) => [prim, good, bad].includes(x));
    verdict('TC-5.10', binsOk && qOk, `${o.tag}: chBins màu ${c.bins && [...new Set(c.bins.bg)].join(',')} (--primary ${prim}); chQ ${c.q && c.q.n} câu, màu ${qCols.join(', ')} (--good ${good}, --primary ${prim}, --bad ${bad})`);
  }
  await step('qt-thong-ke-de', 200);
  await ctx.close();
  const over = scroll.filter((x) => x === 'TRÀN');
  if (o.checks) {
    const tot = Object.values(colours).filter((c) => c && typeof c.total === 'number');
    verdict('Không còn màu cũ', tot.every((c) => c.total === 0), `${o.tag}: quét color/background/border/outline/fill/stroke của ${tot.reduce((a, c) => a + c.n, 0)} phần tử ở ${tot.length} màn: ${tot.reduce((a, c) => a + c.total, 0)} chỗ dùng 8 màu cũ (#1d4ed8, #6b93ff, #e3ebff, #1d2b52, #15803d, #4ade80, #dcfce7, #14321f)`);
    verdict('TC-5.12', !over.length && Object.values(L).every((m) => m.sw <= m.iw), `${o.tag}: scrollWidth/innerWidth ${scroll.filter((x) => x !== 'TRÀN').join(' ')}`);
    verdict('TC-5.11', errors.length === 0, `${o.tag}: ${errors.length ? errors.join(' | ').slice(0, 500) : '0 pageerror, 0 console.error ở ' + Object.keys(L).length + ' màn (bỏ qua "Failed to load resource" của Google Fonts/CDN bị chặn)'}`);
  }
  return { L, errors, colours };
}

function saveLayout(name, data) {
  const slim = {}; for (const [s, m] of Object.entries(data)) slim[s] = { fonts: m.fonts, rects: m.rects };
  fs.writeFileSync(path.join(SHOTS, name), JSON.stringify(slim, null, 1));
}

// ======================= chạy =======================
async function runBranch(browser) {
  console.log('— Nhánh, máy chủ mới —');
  const out = {};
  // mỗi lượt một máy chủ mới để dữ liệu giống nhau (đề mẫu, cùng một bài nộp)
  for (const [vp, scheme, tag] of [[[1280, 800], 'light', '1280'], [[390, 844], 'light', '390'], [[390, 844], 'dark', 'toi-390'], [[1280, 800], 'dark', 'toi-1280']]) {
    const s = await startServer(PORT_NEW, { LATENCY_MS: String(LAT) });
    try {
      await seed(s.base, s.pw);
      out[tag] = await tour(browser, { base: s.base, pw: s.pw, vp, scheme, fonts: 'chan', tag: 'mới ' + tag, shots: tag === 'toi-1280' ? null : tag, checks: true });
    } finally { await stop(s); }
  }
  return out;
}
async function runCompat(browser) {
  console.log('— Nhánh, máy chủ 1.0.0 —');
  const out = {};
  for (const [vp, scheme, tag] of [[[1280, 800], 'light', '1280'], [[390, 844], 'light', '390'], [[390, 844], 'dark', 'toi-390']]) {
    const s = await startServer(PORT_OLD, { LATENCY_MS: String(LAT), SERVER_COMPAT: '1.0.0' });
    try {
      await seed(s.base, s.pw);
      out[tag] = await tour(browser, { base: s.base, pw: s.pw, vp, scheme, fonts: 'chan', tag: '1.0.0 ' + tag, shots: tag === '1280' ? '1.0.0-1280' : null, checks: true, compat: true });
    } finally { await stop(s); }
  }
  return out;
}
async function layoutRun(browser, root, port, vp, fonts, tag, shots) {
  const s = await startServer(port, { LATENCY_MS: String(LAT) }, root);
  try { await seed(s.base, s.pw); return (await tour(browser, { base: s.base, pw: s.pw, vp, scheme: 'light', fonts, tag, shots, checks: false })); } finally { await stop(s); }
}
async function runLayout(browser, branchLight) {
  if (!MAIN_DIR) { console.log('(bỏ so bố cục: chưa đặt MAIN_DIR)'); return; }
  console.log('— TC-5.8 bố cục: main ↔ nhánh —');
  const fontModes = ['chan'].concat(FONTS_DIR ? ['cuc-bo'] : []);
  for (const fm of fontModes) {
    for (const [vp, vtag] of [[[1280, 800], '1280'], [[390, 844], '390']]) {
      const before = (await layoutRun(browser, MAIN_DIR, PORT_MAIN, vp, fm, `main ${vtag} ${fm}`, fm === 'chan' && vtag === '1280' ? 'truoc-1280' : null)).L;
      const after = (await layoutRun(browser, ROOT, PORT_NEW, vp, fm, `nhánh ${vtag} ${fm}`, null)).L;
      saveLayout(`kt-bo-cuc-truoc-${vtag}-${fm}.json`, before);
      saveLayout(`kt-bo-cuc-sau-${vtag}-${fm}.json`, after);
      const c = compareLayout(before, after, `${vtag} ${fm}`);
      const fB = [...new Set(Object.values(before).flatMap((m) => m.fonts))]; const fA = [...new Set(Object.values(after).flatMap((m) => m.fonts))];
      verdict('TC-5.8', c.bad.length === 0, `${vtag}, phông ${fm === 'chan' ? 'bị chặn (rơi về system-ui)' : 'cục bộ @fontsource'}: so ${c.n} khối ở ${Object.keys(before).length} màn; phông tải được main [${fB.join(', ') || 'không'}], nhánh [${fA.join(', ') || 'không'}]; ${c.bad.length ? 'LỆCH: ' + c.bad.slice(0, 12).join(' | ') : 'mọi khối trong dung sai'}${c.notes.length ? '; ghi chú: ' + c.notes.slice(0, 6).join(' | ') : ''}`);
      if (WIDE_DIR && fm === 'chan') {
        const wide = (await layoutRun(browser, WIDE_DIR, PORT_WIDE, vp, fm, `logo ngang ${vtag}`, 'logo-ngang-' + vtag)).L;
        saveLayout(`kt-bo-cuc-logo-ngang-${vtag}.json`, wide);
        const cw = compareLayout(before, wide, `logo ngang ${vtag}`);
        const lg = Object.entries(wide).map(([s, m]) => m.rects['.brand-logo'] ? `${m.rects['.brand-logo'].w}×${m.rects['.brand-logo'].h}` : null).filter(Boolean);
        verdict('TC-5.5 logo ngang 300×100', cw.bad.length === 0 && lg.every((x) => /^(3[345])×(3[345])$/.test(x)), `${vtag}: khung logo ${[...new Set(lg)].join(', ')} ở ${lg.length} màn; so bố cục với main: ${cw.bad.length ? 'LỆCH: ' + cw.bad.slice(0, 8).join(' | ') : `${cw.n} khối trong dung sai`}`);
      }
    }
  }
}
// Ảnh phóng to đầu trang (logo tạm)
async function zoomShot(browser) {
  const s = await startServer(PORT_NEW, { LATENCY_MS: String(LAT) });
  try {
    for (const scheme of ['light', 'dark']) {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 3, colorScheme: scheme });
      const p = await ctx.newPage(); await p.emulateMedia({ colorScheme: scheme }); await routeCdn(p, 'chan');
      await p.goto(s.base + '/'); await p.waitForSelector('.brand-logo'); await settle(p, 300);
      const b = await p.$eval('.brand', (e) => { const r = e.getBoundingClientRect(); return { x: r.left - 8, y: r.top - 8, width: r.width + 16, height: r.height + 16 }; });
      await p.screenshot({ path: path.join(SHOTS, `kt-logo-tam-phong-to-${scheme === 'light' ? 'sang' : 'toi'}.png`), clip: b });
      await ctx.close();
    }
  } finally { await stop(s); }
}

(async () => {
  const browser = await chromium.launch();
  try {
    let br = null;
    if (MODE === 'nhanh' || MODE === 'all') { br = await runBranch(browser); await zoomShot(browser); }
    if (MODE === 'compat' || MODE === 'all') await runCompat(browser);
    if (MODE === 'bocuc' || MODE === 'all') await runLayout(browser, br);
  } catch (e) {
    console.error('LỖI KỊCH BẢN:', e.stack || e); process.exitCode = 1;
  } finally {
    await browser.close();
  }
  const fails = Object.entries(R.tc).filter(([, v]) => !v.pass);
  console.log(`\n${Object.keys(R.tc).length - fails.length}/${Object.keys(R.tc).length} nhóm đạt` + (fails.length ? ' — KHÔNG ĐẠT: ' + fails.map(([k]) => k).join(', ') : ''));
  if (fails.length) process.exitCode = 1;
  if (process.env.JSON_OUT) fs.writeFileSync(process.env.JSON_OUT, JSON.stringify(R, null, 2));
})();
