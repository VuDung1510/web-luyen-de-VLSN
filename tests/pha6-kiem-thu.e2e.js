// Pha 6a — kiểm thử độc lập TC-6.6 (giao diện): làm theo docs/VIEC-GIAO-VIEN.md nhóm A (+ C "bật luyện tập")
// và README "Khi cập nhật Code.gs" trên dev-server; đối chiếu tên nút/nhãn trong tài liệu với giao diện thật.
//   NODE_PATH=$(npm root -g) LIBS_DIR=... node tests/pha6-kiem-thu.e2e.js
// Biến môi trường: PORT_NEW (8790), PORT_OLD (8791), LATENCY_MS (150), SHOTS (docs/bao-cao/anh/pha-6; ảnh kt-*.png)
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const K = require('./fixtures/kho-gia');
const ROWS = new Map(K.standardRows().map((r) => [r[0], r]));

const LAT = +(process.env.LATENCY_MS || 150);
const PORT_NEW = +(process.env.PORT_NEW || 8790);
const PORT_OLD = +(process.env.PORT_OLD || 8791);
const SHOTS = process.env.SHOTS || path.join(__dirname, '..', 'docs', 'bao-cao', 'anh', 'pha-6');
const LIBS = process.env.LIBS_DIR;
fs.mkdirSync(SHOTS, { recursive: true });

let pass = 0, fail = 0;
function ok(step, cond, detail) {
  if (cond) pass++; else fail++;
  console.log(`  ${cond ? '✓' : '✗'} ${step}${detail ? '  — ' + detail : ''}`);
}
const shot = (page, name, opts) => page.screenshot(Object.assign({ path: path.join(SHOTS, 'kt-' + name + '.png') }, opts || {}));

function startServer(port, env) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [path.join(__dirname, 'dev-server.js'), String(port)], { env: Object.assign({}, process.env, env), stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    p.stdout.on('data', (d) => { out += d; const m = out.match(/mật khẩu: (\S+)\)/); if (m) resolve({ proc: p, pw: m[1], base: 'http://localhost:' + port }); });
    p.stderr.on('data', (d) => { out += d; });
    p.on('exit', (c) => reject(new Error('dev-server thoát ' + c + ': ' + out)));
    setTimeout(() => reject(new Error('dev-server không khởi động: ' + out)), 15000);
  });
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
const errors = [];
function watchErrors(page, tag) {
  page.on('pageerror', (e) => errors.push(tag + ' pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(tag + ' console: ' + m.text()); });
}
const settle = (p) => p.waitForLoadState('networkidle').catch(() => {}).then(() => p.waitForTimeout(LAT + 400));
const mainText = (p) => p.$eval('main', (e) => e.innerText).catch(() => '');
const hasButton = (p, re) => p.evaluate((src) => { const r = new RegExp(src); return [...document.querySelectorAll('button, a, label, .tab, [role=tab]')].some((e) => e.offsetParent !== null && r.test(e.textContent.trim())); }, re.source);

async function adminLogin(page, base, pw) {
  await page.goto(base + '/admin.html');
  await page.fill('#pw', pw);
  await page.click('#btnLogin');
  await page.waitForSelector('text=Bài nộp mới nhất');
}
async function studentLogin(page, base, lop, name, pin) {
  await page.goto(base + '/');
  await page.waitForSelector(`#selClass option[value="${lop}"]`, { state: 'attached' });
  await page.selectOption('#selClass', lop);
  await page.waitForFunction((n) => [...document.querySelectorAll('#selStudent option')].some((o) => o.textContent.trim() === n), name);
  const val = await page.$eval('#selStudent', (s, n) => [...s.options].find((o) => o.textContent.trim() === n).value, name);
  await page.selectOption('#selStudent', val);
  await settle(page);
  // danh sách lớp/tên có thể được vẽ lại khi bản đệm cập nhật ngầm → chọn lại nếu bị xóa
  if ((await page.$eval('#selStudent', (s) => s.value)) !== val) { await page.selectOption('#selClass', lop); await page.waitForTimeout(LAT + 300); await page.selectOption('#selStudent', val); }
  await page.fill('#pin', pin);
  await page.click('#btnLogin');
  try { await page.waitForSelector('a[href="#/lich-su"]', { timeout: 15000 }); } catch (e) {
    const toast = await page.$$eval('.toast', (ts) => ts.map((t) => t.textContent.trim())).catch(() => []);
    await page.screenshot({ path: path.join(process.env.TMPSHOT || SHOTS, 'loi-dang-nhap.png') });
    throw new Error('đăng nhập học sinh không vào được; toast: ' + toast.join(' | ') + '; ' + e.message.split('\n')[0]);
  }
  await settle(page);
}
async function gotoSettings(ad, base) {
  await ad.goto(base + '/admin.html#/cai-dat');
  await ad.waitForSelector('text=Lưu cài đặt');
  await settle(ad);
}
/** Ô nhập/chọn đi kèm nhãn (theo chữ của nhãn, trong cùng khối .field). */
async function fieldByLabel(ad, text) {
  return ad.evaluateHandle((t) => {
    const lab = [...document.querySelectorAll('main .field > label')].find((l) => l.textContent.includes(t));
    return lab ? lab.parentElement.querySelector('input, select, textarea') : null;
  }, text);
}
const keyOf = (h) => (h.asElement() ? h.asElement().getAttribute('data-k') : null);

async function runNew(browser) {
  console.log(`\n=== Máy chủ mới (cổng ${PORT_NEW}, CHO_LUYEN_TAP=KHONG như sau bước A4) ===`);
  const srv = await startServer(PORT_NEW, { LATENCY_MS: String(LAT), PRACTICE: '0' });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const ad = await ctx.newPage();
    await routeCdn(ad); watchErrors(ad, 'admin');
    const dialogs = []; ad.on('dialog', (d) => { dialogs.push(d.message()); d.accept(); });

    // ---- A6: Cài đặt → khung Dữ liệu (cuối trang): "Phiên bản máy chủ" = 1.5.0 ----
    await adminLogin(ad, srv.base, srv.pw);
    await gotoSettings(ad, srv.base);
    const t = await mainText(ad);
    const dataIdx = t.lastIndexOf('Dữ liệu');
    const tail = dataIdx >= 0 ? t.slice(dataIdx) : '';
    ok('A6 Cài đặt → khung "Dữ liệu" ở cuối trang có "Phiên bản máy chủ 1.5.0"', dataIdx > t.length / 2 && /Phiên bản máy chủ\s*1\.5\.0/.test(tail), tail.replace(/\s+/g, ' ').slice(0, 160));
    const card = await ad.$('xpath=//main//*[contains(normalize-space(.),"Phiên bản máy chủ")][not(.//*[contains(normalize-space(.),"Phiên bản máy chủ")])]/ancestor::*[contains(@class,"card")][1]');
    if (card) { await card.scrollIntoViewIfNeeded(); await card.screenshot({ path: path.join(SHOTS, 'kt-01-cai-dat-du-lieu-1.5.0.png') }); }
    // ---- A4 (làm ở trang quản trị): ô kho / thư mục hình / luyện tập / đề nhanh ----
    const fKho = await fieldByLabel(ad, 'Kho câu hỏi');
    const fDir = await fieldByLabel(ad, 'Thư mục hình');
    const fPr = await fieldByLabel(ad, 'Mục Luyện tập cho học sinh');
    const fQuick = await fieldByLabel(ad, 'Đề nhanh theo bài');
    const khoVal = fKho.asElement() ? await fKho.asElement().inputValue() : null;
    ok('A4 Cài đặt có ô "Kho câu hỏi (id hoặc link …)" ghi vào KHO_CAU_HOI_ID', (await keyOf(fKho)) === 'KHO_CAU_HOI_ID', 'data-k=' + (await keyOf(fKho)) + ', giá trị đang có: ' + khoVal);
    ok('A4 Cài đặt có ô "Thư mục hình của kho" ghi vào THU_MUC_HINH_KHO_ID', (await keyOf(fDir)) === 'THU_MUC_HINH_KHO_ID', 'data-k=' + (await keyOf(fDir)));
    ok('A4/C ô "Mục Luyện tập cho học sinh" = CHO_LUYEN_TAP, "Đề nhanh theo bài" = LUYEN_NHANH', (await keyOf(fPr)) === 'CHO_LUYEN_TAP' && (await keyOf(fQuick)) === 'LUYEN_NHANH', (await keyOf(fPr)) + ', ' + (await keyOf(fQuick)));
    const prText = fPr.asElement() ? await fPr.asElement().evaluate((e) => e.tagName === 'SELECT' ? [...e.options].map((o) => o.text).join('|') + ' (đang: ' + e.options[e.selectedIndex].text + ')' : e.type) : null;
    ok('A4/C "Mục Luyện tập cho học sinh" có Bật/Tắt, đang Tắt', prText && /Bật/.test(prText) && /đang: Tắt/.test(prText), prText);
    const qv = fQuick.asElement() ? await fQuick.asElement().inputValue() : null;
    ok('C "Đề nhanh theo bài" mặc định 7,1,2,10', qv === '7,1,2,10', qv);
    // A4: "chép địa chỉ trên thanh trình duyệt, dán vào" — dán LINK kho thay cho id, Lưu cài đặt, Đọc lại kho
    if (khoVal) {
      const link = `https://docs.google.com/spreadsheets/d/${khoVal}/edit#gid=0`;
      await fKho.asElement().fill(link);
      await ad.click('button:has-text("Lưu cài đặt")');
      await settle(ad);
      await ad.goto(srv.base + '/admin.html#/ngan-hang'); await ad.waitForSelector('#bkReload'); await settle(ad);
      await ad.click('#bkReload'); await settle(ad); await ad.waitForTimeout(1500);
      const nh = await mainText(ad);
      const m = /Kho có (\d+) câu/.exec(nh);
      ok('A4 dán LINK file kho (thay vì id) → Lưu cài đặt → Ngân hàng "↻ Đọc lại kho" đọc được kho', !!m, m ? m[0] : nh.replace(/\s+/g, ' ').slice(0, 200));
      await gotoSettings(ad, srv.base);
      const saved = await (await fieldByLabel(ad, 'Kho câu hỏi')).asElement().inputValue();
      console.log('     (ô kho sau khi lưu: ' + saved + ')');
    }

    // ---- Học sinh mẫu đăng nhập (A6 "Thử nhanh"; README Bước 4) ----
    const sctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const st = await sctx.newPage();
    await routeCdn(st); watchErrors(st, 'hs');
    await studentLogin(st, srv.base, '12A1', 'Học Sinh Mẫu', '0101');
    ok('A6 đăng nhập học sinh mẫu (12A1, Học Sinh Mẫu, PIN 0101)', true);
    ok('A6 nút "Đổi PIN" hiện (máy chủ mới)', await hasButton(st, /Đổi PIN/));
    const navPr = () => st.evaluate(() => [...document.querySelectorAll('a[href="#/luyen-tap"]')].some((a) => a.offsetParent !== null));
    ok('Luyện tập đang tắt: học sinh chưa thấy mục Luyện tập', !(await navPr()));
    await shot(st, '02-hoc-sinh-mau-trang-chu');

    // ---- A6: Ngân hàng → Ma trận 1 chạm lớp 12 → Tạo đề → xem hình → Lưu (Bản nháp) → xóa đề thử ----
    await ad.goto(srv.base + '/admin.html#/ngan-hang'); await ad.waitForSelector('#bkReload'); await ad.waitForSelector('text=câu phù hợp'); await settle(ad);
    // A4 vừa "Lưu cài đặt" ở trang quản trị: kiểm xem tab Ngân hàng còn đủ nút KHÔNG cần tải lại trang
    const noReload = (await hasButton(ad, /Đưa vào luyện tập/)) && !!(await ad.$('#tabPool'));
    ok('Sau "Lưu cài đặt" (A4), tab Ngân hàng vẫn có "Đưa vào luyện tập" + tab con "Pool luyện tập" khi CHƯA tải lại trang', noReload, noReload ? '' : 'mất cả hai cho tới khi bấm F5 (K-3)');
    if (!noReload) { await ad.reload(); await ad.waitForSelector('#bkReload'); await ad.waitForSelector('text=câu phù hợp'); await settle(ad); }
    ok('README/A6 tab "Ngân hàng" có nút "↻ Đọc lại kho", "Đưa vào luyện tập", tab con "Pool luyện tập"', await hasButton(ad, /Đọc lại kho/) && await hasButton(ad, /Đưa vào luyện tập/) && /Pool luyện tập/.test(await mainText(ad)));
    const lopSel = await ad.$$eval('main select', (ss) => { const s = ss.find((x) => [...x.options].some((o) => o.text === 'Lớp 12')); return s ? (s.id ? '#' + s.id : null) : null; });
    if (lopSel) await ad.selectOption(lopSel, { label: 'Lớp 12' }); else await ad.selectOption('main select >> nth=0', { label: 'Lớp 12' });
    await settle(ad);
    const matrixLabel = /Ma trận 1 chạm/.test(await mainText(ad));
    ok('A6 có khối "Ma trận 1 chạm" (mặc định 18–4–6)', matrixLabel);
    await ad.click('button:has-text("Tạo ma trận")'); await settle(ad);
    const dlgTxt = await ad.$eval('dialog[open], .modal', (e) => e.innerText).catch(() => '');
    ok('A6 bấm "Tạo ma trận" mở hộp "Ma trận đề" (tài liệu không nhắc nút này và nút "Thêm vào giỏ")', /Tìm được 28 câu/.test(dlgTxt), dlgTxt.replace(/\s+/g, ' ').slice(0, 120));
    await ad.click('button:has-text("Thêm vào giỏ")'); await settle(ad);
    const cart = await ad.$eval('#cartCount', (e) => e.textContent.trim()).catch(() => '');
    ok('Giỏ: P1 18 · P2 4 · P3 6', /18.*4.*6/.test(cart), cart);
    await ad.click('button:has-text("Tạo đề (")');
    await ad.waitForSelector('#eTitle', { timeout: 20000 }); await settle(ad);
    const ed = await mainText(ad);
    const imgs = await ad.$$eval('main img', (es) => es.map((e) => e.getAttribute('src')).filter(Boolean));
    // câu nào của kho giả có hình → phải có <img> (trừ câu có cảnh báo "chưa có hình")
    const codes = [...ed.matchAll(/Kho: (\S+)/g)].map((m) => m[1]);
    const withImg = codes.filter((c) => (ROWS.get(c) || [])[15] && /^Có/.test(ROWS.get(c)[15])).length;
    const warn = new Set([...ed.matchAll(/Câu (\S+): chưa có hình/g)].map((m) => m[1])).size;
    ok('A6 "Tạo đề" mở trình soạn với 28 câu, hình tự gắn vào câu (số hình = số câu có hình trong kho − câu báo thiếu hình)', codes.length === 28 && imgs.length === withImg - warn, `${codes.length} câu; ${withImg} câu có hình, ${warn} báo thiếu, ${imgs.length} <img>`);
    const status = await ad.$eval('#eStatus', (e) => e.options[e.selectedIndex].text);
    ok('A6 trạng thái mặc định "Bản nháp"', status === 'Bản nháp', status);
    await shot(ad, '03-tao-de-tu-ngan-hang', { fullPage: false });
    await ad.fill('#eTitle', 'Đề thử Pha 6 (kiểm thử)');
    const saveLabel = await ad.$$eval('button', (bs) => bs.filter((b) => b.offsetParent !== null).map((b) => b.textContent.trim()).filter((x) => /Lưu/.test(x)));
    ok('A6 nút lưu tên là "Lưu đề" (tài liệu A6 ghi "Lưu")', saveLabel.includes('Lưu đề') || saveLabel.some((x) => /Lưu đề/.test(x)), saveLabel.join(' | '));
    await ad.click('button:has-text("Lưu đề") >> visible=true'); await settle(ad); await ad.waitForTimeout(1200);
    await ad.goto(srv.base + '/admin.html#/de-thi'); await settle(ad);
    let list = await mainText(ad);
    const rowTxt = (list.split('\n').find((l) => /Đề thử Pha 6/.test(l)) || '');
    ok('Đề thử đã lưu, nằm trong danh sách Đề thi', /Đề thử Pha 6/.test(list));
    const draftShown = await ad.evaluate(() => { const row = [...document.querySelectorAll('main tr, main .card, main li')].find((r) => /Đề thử Pha 6/.test(r.textContent) && r.textContent.length < 600); return row ? row.innerText.replace(/\s+/g, ' ') : ''; });
    ok('Đề thử ở trạng thái Bản nháp', /nháp/i.test(draftShown), draftShown.slice(0, 160));
    ok('README "Đề thi → + Tạo đề mới" có nút', await hasButton(ad, /Tạo đề mới/));
    // xóa đề thử
    const delBtn = await ad.evaluateHandle(() => { const row = [...document.querySelectorAll('main tr, main .card, main li')].find((r) => /Đề thử Pha 6/.test(r.textContent) && r.textContent.length < 600); return row ? [...row.querySelectorAll('button, a')].find((b) => /Xóa|🗑|✕/.test(b.textContent + (b.title || ''))) : null; });
    if (delBtn.asElement()) {
      await delBtn.asElement().click(); await settle(ad); await ad.waitForTimeout(800);
      const cf = await ad.$('dialog[open] button:has-text("Xóa"), .modal button:has-text("Xóa")');
      if (cf) { await cf.click(); await settle(ad); }
      await ad.goto(srv.base + '/admin.html#/de-thi'); await settle(ad);
      list = await mainText(ad);
      ok('A6 "xóa đề thử": đề biến mất khỏi danh sách', !/Đề thử Pha 6/.test(list), dialogs.slice(-1)[0] || '');
    } else ok('A6 tìm thấy nút xóa đề trong danh sách', false, rowTxt);
    // README Soạn đề: Nhập nhanh → Tải file lên
    await ad.click('text=Tạo đề mới').catch(() => {}); await settle(ad);
    const quick = await ad.$('button:has-text("Nhập nhanh")');
    if (quick) { await quick.click(); await settle(ad); }
    ok('README/B3 "Nhập nhanh từ Word / Excel → Tải file lên" có trên giao diện', !!quick && await hasButton(ad, /Tải file lên/));
    await ad.keyboard.press('Escape').catch(() => {});
    // README Học sinh
    await ad.goto(srv.base + '/admin.html#/hoc-sinh'); await settle(ad);
    const hsBtns = { '+ Thêm học sinh': /Thêm học sinh/, '⇪ Nhập danh sách': /Nhập danh sách/, '🖨 In phiếu đăng nhập': /In phiếu/, 'Sửa': /^(✏\s*)?Sửa$/ };
    const missingHs = [];
    for (const [k, re] of Object.entries(hsBtns)) if (!(await hasButton(ad, re))) missingHs.push(k);
    ok('README "Thêm học sinh": các nút có trên tab Học sinh', missingHs.length === 0, missingHs.join(', '));

    // ---- C: bật luyện tập — Cài đặt → "Mục Luyện tập cho học sinh" = Bật → Lưu cài đặt ----
    await gotoSettings(ad, srv.base);
    const pr = (await fieldByLabel(ad, 'Mục Luyện tập cho học sinh')).asElement();
    const tag = await pr.evaluate((e) => e.tagName);
    if (tag === 'SELECT') await pr.selectOption({ label: 'Bật' });
    await ad.click('button:has-text("Lưu cài đặt")'); await settle(ad);
    await ad.goto(srv.base + '/admin.html#/ngan-hang'); await ad.waitForSelector('text=câu phù hợp'); await settle(ad);
    const poolNoReload = !!(await ad.$('#tabPool'));
    ok('C sau "Lưu cài đặt" bật luyện tập: tab con "Pool luyện tập" có ngay (chưa F5)', poolNoReload, poolNoReload ? '' : 'phải F5 mới thấy (K-3)');
    if (!poolNoReload) { await ad.reload(); await ad.waitForSelector('#tabPool'); await settle(ad); }
    await ad.click('#tabPool'); await ad.waitForSelector('text=Pool có'); await settle(ad);
    const pool = await mainText(ad);
    ok('C tab "Pool luyện tập" có câu và nút "Tắt"; không còn ghi chú "đang tắt"', await hasButton(ad, /^Tắt$/) && !/Mục Luyện tập đang tắt/.test(pool), (/Pool có[^\n]*/.exec(pool) || [''])[0].slice(0, 90));
    await shot(ad, '04-pool-luyen-tap');
    await st.reload(); await settle(st); await st.waitForTimeout(1500);
    const navOn = await navPr();
    ok('C sau khi Bật + Lưu cài đặt: học sinh tải lại trang thấy "🎯 Luyện tập"', navOn);
    if (navOn) {
      await st.click('a[href="#/luyen-tap"] >> visible=true'); await settle(st);
      await shot(st, '05-hoc-sinh-luyen-tap');
    }
    ok('Không có lỗi JS trên trang (máy chủ mới)', errors.length === 0, errors.slice(0, 5).join(' | '));
    await ctx.close(); await sctx.close();
  } finally { srv.proc.kill(); }
}

// A6/A7: máy chủ chưa cập nhật (quên "Phiên bản mới" hoặc đã quay về bản cũ) — trang Cài đặt phải cho thấy số cũ
async function runOld(browser) {
  console.log(`\n=== SERVER_COMPAT=1.0.0 (cổng ${PORT_OLD}) — A6 "Nếu vẫn số cũ", A7 quay về bản cũ ===`);
  const srv = await startServer(PORT_OLD, { LATENCY_MS: String(LAT), SERVER_COMPAT: '1.0.0' });
  const before = errors.length;
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const ad = await ctx.newPage();
    await routeCdn(ad); watchErrors(ad, 'admin-1.0.0');
    await adminLogin(ad, srv.base, srv.pw);
    await gotoSettings(ad, srv.base);
    const t = await mainText(ad);
    const tail = t.slice(t.lastIndexOf('Dữ liệu'));
    ok('A6 máy chủ cũ: khung "Dữ liệu" hiện "Phiên bản máy chủ 1.0.0" (giáo viên nhận ra chưa cập nhật)', /Phiên bản máy chủ\s*1\.0\.0/.test(tail), tail.replace(/\s+/g, ' ').slice(0, 160));
    await ad.goto(srv.base + '/admin.html#/ngan-hang'); await settle(ad);
    ok('A7 máy chủ cũ: tab Ngân hàng báo "Cần cập nhật máy chủ"', /Cần cập nhật máy chủ/i.test(await mainText(ad)));
    const st = await ctx.newPage();
    await routeCdn(st); watchErrors(st, 'hs-1.0.0');
    // (vòng 2) A0 làm trên máy chủ 1.0.0: nút đăng nhập và các tab nêu trong A0
    await st.goto(srv.base + '/'); await st.waitForSelector('#btnLogin');
    const loginLabel = (await st.$eval('#btnLogin', (b) => b.textContent.trim()));
    const viec = fs.readFileSync(path.join(__dirname, '..', 'docs', 'VIEC-GIAO-VIEN.md'), 'utf8');
    const a0 = viec.split('## A0')[1].split('\n## ')[0];
    const a0Btn = (/bấm "([^"]+)"/.exec(a0) || [])[1];
    ok(`A0 "bấm \"${a0Btn}\"" là nút đăng nhập thật`, a0Btn === loginLabel, `nút thật: "${loginLabel}"`);
    await studentLogin(st, srv.base, '12A1', 'Học Sinh Mẫu', '0101');
    const navs = await st.$$eval('a[href^="#/"]', (as) => as.filter((a) => a.offsetParent !== null).map((a) => a.textContent.trim()));
    const need = ['Lịch sử', 'Thống kê', 'Xếp hạng', 'Trang chủ'];
    ok('A0 các tab "Lịch sử, Thống kê, Xếp hạng, Trang chủ" có trên trang học sinh (máy chủ 1.0.0)', need.every((n) => navs.some((x) => x.includes(n))), navs.join(' | '));
    ok('A7 máy chủ cũ: học sinh đăng nhập được, nút Đổi PIN bị ẩn', !(await hasButton(st, /Đổi PIN/)));
    ok('Không có lỗi JS trên trang (1.0.0)', errors.length === before, errors.slice(before, before + 5).join(' | '));
    await ctx.close();
  } finally { srv.proc.kill(); }
}

// A6 "Trên máy đã từng mở web, bấm tải lại trang (F5) một lần để nút Đổi PIN và ô Mục tiêu điểm hiện ra":
// cùng một địa chỉ (cổng), máy chủ 1.0.0 → máy chủ mới; trình duyệt giữ bộ nhớ của lần mở trước.
const PORT_SW = +(process.env.PORT_SW || 8792);
async function runSwitch(browser) {
  console.log(`\n=== Chuyển máy chủ 1.0.0 → 1.5.0 trên cùng địa chỉ (cổng ${PORT_SW}) — A6 "F5 một lần" ===`);
  let srv = await startServer(PORT_SW, { LATENCY_MS: String(LAT), SERVER_COMPAT: '1.0.0' });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const st = await ctx.newPage();
  await routeCdn(st);
  const ad = await ctx.newPage();
  await routeCdn(ad);
  try {
    await studentLogin(st, srv.base, '12A1', 'Học Sinh Mẫu', '0101');
    const before = await hasButton(st, /Đổi PIN/);
    await adminLogin(ad, srv.base, srv.pw);
    await ad.goto(srv.base + '/admin.html#/ngan-hang'); await settle(ad);
    const adBefore = /Cần cập nhật máy chủ/i.test(await mainText(ad));
    srv.proc.kill(); await new Promise((r) => setTimeout(r, 800));
    srv = await startServer(PORT_SW, { LATENCY_MS: String(LAT) });
    // Giáo viên (đã mở trang quản trị trước khi triển khai) F5 rồi làm A6 "Thử nhanh … tab Ngân hàng"
    await ad.reload(); await settle(ad); await ad.waitForTimeout(800);
    if (await ad.$('#pw:visible')) { await ad.fill('#pw', srv.pw); await ad.click('#btnLogin'); await ad.waitForSelector('text=Bài nộp mới nhất'); }
    await ad.goto(srv.base + '/admin.html#/ngan-hang'); await settle(ad); await ad.waitForTimeout(1500);
    const adAfter = await mainText(ad);
    ok('A6 trang quản trị đã mở trước khi triển khai: sau F5 tab Ngân hàng dùng được ngay', adBefore && !/Cần cập nhật máy chủ/i.test(adAfter) && /Kho có \d+ câu/.test(adAfter), `trước: "Cần cập nhật" ${adBefore}; sau F5: ${adAfter.replace(/\s+/g, ' ').slice(0, 120)}`);
    await shot(ad, '06-ngan-hang-sau-trien-khai-van-bao-1.0.0');
    const seen = []; let relog = 0;
    for (let i = 1; i <= 3; i++) {
      await st.reload(); await settle(st); await st.waitForTimeout(1000);
      // dev-server mới có khóa ký phiên khác (Apps Script thật giữ Script Properties nên phiên cũ vẫn dùng được) → đăng nhập lại nếu cần
      if (await st.$('#selClass:visible')) { relog++; await studentLogin(st, srv.base, '12A1', 'Học Sinh Mẫu', '0101'); }
      await st.waitForSelector('a[href="#/lich-su"]', { timeout: 15000 }); await settle(st); await st.waitForTimeout(1500);
      seen.push(await hasButton(st, /Đổi PIN/));
      if (seen[seen.length - 1]) break;
    }
    const dump = await st.evaluate(() => { const o = {}; for (const k of Object.keys(localStorage)) if (/pub|unsup|feat|cap/i.test(k)) o['L:' + k] = localStorage.getItem(k).slice(0, 200); for (const k of Object.keys(sessionStorage)) o['S:' + k] = sessionStorage.getItem(k).slice(0, 200); return o; });
    console.log('     bộ nhớ trình duyệt sau chuyển máy chủ:', JSON.stringify(dump));
    if (!seen[seen.length - 1]) {
      const acts = []; st.on('request', (r) => { if (r.url().includes('/exec')) { try { acts.push(JSON.parse(r.postData()).action); } catch (e) { /* */ } } });
      await st.reload(); await settle(st); await st.waitForTimeout(1500);
      console.log('     lời gọi máy chủ khi F5: ' + acts.join(', '));
      for (const [lab, age] of [['5 phút', 3e5], ['10 phút', 6e5], ['15 phút', 9e5], ['20 phút', 12e5], ['30 phút', 18e5], ['45 phút', 27e5], ['1 giờ', 36e5], ['6 giờ', 216e5], ['24 giờ', 864e5]]) {
        await st.evaluate((a) => localStorage.setItem('ld_pub_t', String(Date.now() - a)), age);
        await st.reload(); await settle(st); await st.waitForTimeout(1500);
        if (await st.$('#selClass:visible')) await studentLogin(st, srv.base, '12A1', 'Học Sinh Mẫu', '0101');
        const v = await hasButton(st, /Đổi PIN/);
        console.log(`     ld_pub_t lùi ${lab}: Đổi PIN = ${v}`);
        if (v) break;
      }
      const p2 = await ctx.newPage(); await routeCdn(p2);
      await p2.goto(srv.base + '/'); await settle(p2); await p2.waitForTimeout(1500);
      if (await p2.$('#selClass:visible')) await studentLogin(p2, srv.base, '12A1', 'Học Sinh Mẫu', '0101');
      console.log('     mở THẺ MỚI (sessionStorage mới): Đổi PIN = ' + (await hasButton(p2, /Đổi PIN/)));
      await p2.close();
    }
    ok('A6 máy chủ 1.0.0 → 1.5.0: "Đổi PIN" hiện sau đúng 1 lần F5', !before && seen[0] === true, `trước: ${before}; sau F5 lần 1..: ${seen.join(', ')}; phải đăng nhập lại ${relog} lần (do dev-server, xem chú thích)`);
  } finally { srv.proc.kill(); await ctx.close(); }
}

(async () => {
  const browser = await chromium.launch();
  try {
    await runNew(browser);
    await runOld(browser);
    await runSwitch(browser);
  } catch (e) { fail++; console.log('✗ LỖI KỊCH BẢN: ' + (e.stack || e)); }
  await browser.close();
  console.log(`\npha6-kiem-thu.e2e: ${pass} đạt, ${fail} không đạt.`);
  process.exit(fail ? 1 : 0);
})();
