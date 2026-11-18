// E2E Pha 2 (người làm): Ngân hàng câu hỏi trên trang quản trị. Cần dev-server đang chạy (kho giả mặc định).
//   PORT=8787 ADMIN_PW=<mật khẩu dev-server> LIBS_DIR=<node_modules có katex> node tests/bank.e2e.js [thư mục ảnh]
//   SERVER_COMPAT=1.0.0 (dev-server cũng chạy SERVER_COMPAT=1.0.0): chỉ kiểm tab Ngân hàng hiện "Cần cập nhật máy chủ"
//   và các tab khác không lỗi.
// Luồng máy chủ mới: lọc → ma trận 18–4–6 → Tạo đề → trình soạn → Lưu (mở đề) → học sinh làm → kết quả;
// lấy đề gốc có cảnh báo thiếu; [BẢNG] hiển thị thành bảng 2 cột, 5 hàng; câu có hình.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:' + (process.env.PORT || 8787);
const SHOTS = process.argv[2] || path.join(__dirname, 'screenshots', 'bank');
const LIBS = process.env.LIBS_DIR;
const COMPAT = process.env.SERVER_COMPAT === '1.0.0';
fs.mkdirSync(SHOTS, { recursive: true });

async function routeCdn(page) {
  await page.route(/fonts\.(googleapis|gstatic)\.com|accounts\.google\.com|lh3\.googleusercontent\.com/, (r) => r.fulfill({ status: 200, body: '' }));
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
function check(cond, msg) { if (!cond) throw new Error('KHÔNG ĐẠT: ' + msg); console.log('  ✓ ' + msg); }

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const ad = await ctx.newPage();
  ad.on('pageerror', (e) => errors.push(e.message));
  ad.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await routeCdn(ad);
  await ad.goto(BASE + '/admin.html');
  await ad.fill('#pw', process.env.ADMIN_PW);
  await ad.click('#btnLogin');
  await ad.waitForSelector('#nav:not(.hidden)');
  await ad.waitForTimeout(500);
  check(await ad.isVisible('[data-nav="bank"]'), 'menu có mục Ngân hàng');

  if (COMPAT) {
    await ad.click('[data-nav="bank"]');
    await ad.waitForSelector('#bankNeedUpdate');
    check(/Cần cập nhật máy chủ/.test(await ad.textContent('#bankNeedUpdate')), 'máy chủ 1.0.0: tab Ngân hàng hiện "Cần cập nhật máy chủ"');
    await ad.screenshot({ path: path.join(SHOTS, '09-ngan-hang-may-chu-cu.png') });
    for (const nav of ['home', 'exams', 'students', 'results', 'gradebook', 'settings']) {
      await ad.click(`[data-nav="${nav}"]`);
      await ad.waitForTimeout(400);
      const txt = await ad.textContent('#app');
      check(!/Có lỗi/.test(txt) && !/Không có chức năng/.test(txt), 'tab ' + nav + ' không lỗi');
    }
    check(!(await ad.$('[data-k="KHO_CAU_HOI_ID"]')), 'Cài đặt không hiện ô kho khi máy chủ cũ');
    check(!errors.length, 'không có lỗi JS: ' + errors.join(' | '));
    await browser.close();
    console.log('bank.e2e (máy chủ 1.0.0): ĐẠT');
    return;
  }

  // ---- tab Ngân hàng ----
  await ad.click('[data-nav="bank"]');
  await ad.waitForSelector('.bank-item');
  check(/dùng được/.test(await ad.textContent('#bkInfo')), 'có dòng thống kê kho');
  await ad.screenshot({ path: path.join(SHOTS, '01-ngan-hang.png') });
  // lọc Phần II
  await ad.check('input[data-f="loai"][value="DS"]');
  await ad.waitForFunction(() => document.querySelectorAll('.bank-item').length && [...document.querySelectorAll('.bank-item .badge-primary')].every((b) => /P2/.test(b.textContent)));
  check(true, 'lọc Dạng = Phần II chỉ còn câu P2');
  await ad.uncheck('input[data-f="loai"][value="DS"]');
  // tìm chữ [BẢNG]
  await ad.fill('#bkQ', 'nhiệt dung riêng của một số');
  await ad.waitForFunction(() => document.querySelectorAll('.bank-item').length === 1);
  await ad.click('.bank-item [data-view]');
  await ad.waitForSelector('#bkPreview table.q-table');
  const tb = await ad.$$eval('#bkPreview table.q-table tr', (trs) => trs.map((tr) => tr.children.length));
  check(tb.length === 5 && tb.every((n) => n === 2), '[BẢNG] hiển thị thành bảng 2 cột, 5 hàng');
  await ad.screenshot({ path: path.join(SHOTS, '05-bang.png') });
  await ad.click('.overlay [data-close]');
  await ad.fill('#bkQ', '');
  await ad.waitForTimeout(700);

  // câu có hình
  const imgItem = await ad.$('.bank-item:has(.badge:text("có hình")) [data-view]');
  await imgItem.click();
  await ad.waitForSelector('#bkPreview');
  await ad.waitForTimeout(300);
  const src = await ad.getAttribute('#bkPreview img.q-img', 'src');
  check(/^https:\/\/lh3\.googleusercontent\.com\/d\//.test(src || ''), 'câu có hình: hình là bản chép (' + src + ')');
  await ad.screenshot({ path: path.join(SHOTS, '04-cau-co-hinh.png') });
  await ad.click('.overlay [data-close]');

  // lấy đề gốc: Nguồn mẫu B (số câu nhảy)
  await ad.selectOption('#bkNguon', { label: /Nguồn mẫu B/ }).catch(async () => {
    const val = await ad.$eval('#bkNguon', (s) => [...s.options].find((o) => /Nguồn mẫu B/.test(o.textContent)).value);
    await ad.selectOption('#bkNguon', val);
  });
  await ad.waitForTimeout(500);
  await ad.click('#bkSource');
  await ad.waitForSelector('#srcMissing');
  check(/Phần I: kho không có câu 5–11, 13/.test(await ad.textContent('#srcMissing')), 'đề gốc: cảnh báo câu thiếu (số câu nhảy)');
  check(/1 câu chưa có đáp án/.test(await ad.textContent('#srcNoKey')), 'đề gốc: cảnh báo câu chưa có đáp án');
  await ad.screenshot({ path: path.join(SHOTS, '03-canh-bao-thieu.png') });
  await ad.click('.overlay [data-close="ok"]');
  await ad.waitForFunction(() => /P1 6 · P2 2 · P3 1/.test(document.querySelector('#cartCount').textContent));
  check(true, 'giỏ câu sau khi lấy đề gốc: P1 6 · P2 2 · P3 1');
  await ad.selectOption('#bkNguon', '');
  await ad.waitForTimeout(500);

  // ma trận 18–4–6, lớp 12
  await ad.selectOption('#bkLop', 'Lớp 12');
  await ad.waitForTimeout(500);
  await ad.click('#bkMatrix');
  await ad.waitForSelector('.overlay [data-close="ok"]');
  check(!(await ad.$('#mxShort')), 'ma trận 18–4–6 lớp 12 đủ câu');
  await ad.click('.overlay [data-close="ok"]');
  await ad.waitForFunction(() => /P1 18 · P2 4 · P3 6/.test(document.querySelector('#cartCount').textContent));
  check(true, 'giỏ câu: P1 18 · P2 4 · P3 6');
  await ad.screenshot({ path: path.join(SHOTS, '02-gio-cau.png') });
  // ma trận thiếu: chọn một bài ít câu
  await ad.fill('#soTN', '40');
  await ad.click('#bkMatrix');
  await ad.waitForSelector('#mxShort');
  check(/Phần I: cần 40/.test(await ad.textContent('#mxShort')), 'ma trận thiếu: nêu phần và số câu');
  await ad.click('.overlay [data-close=""]');
  await ad.fill('#soTN', '18');

  // tạo đề → trình soạn → lưu
  await ad.click('#cartMake');
  await ad.waitForSelector('#draftNote');
  const n = await ad.$$eval('.qedit', (x) => x.length);
  check(n === 28, 'trình soạn có 28 câu đã nạp (chưa lưu)');
  await ad.screenshot({ path: path.join(SHOTS, '06-trinh-soan.png') });
  await ad.fill('#eTitle', 'Đề ma trận từ kho (e2e)');
  await ad.selectOption('#eStatus', 'MO');
  await ad.click('#btnSave');
  await ad.waitForFunction(() => /Đã lưu/.test(document.getElementById('saveInfo').textContent));
  check(/#\/de-thi\/sua\//.test(ad.url()), 'đã lưu đề');
  check(!errors.length, 'không có lỗi JS phía quản trị: ' + errors.join(' | '));

  // ---- học sinh làm đề ----
  const sctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const st = await sctx.newPage();
  st.on('pageerror', (e) => errors.push('HS: ' + e.message));
  await routeCdn(st);
  await st.goto(BASE + '/');
  await st.waitForSelector('#selClass option[value="12A1"]', { state: 'attached' });
  await st.selectOption('#selClass', '12A1');
  await st.waitForSelector('#selStudent option[value="HS0001"]', { state: 'attached' });
  await st.selectOption('#selStudent', 'HS0001');
  await st.fill('#pin', '0101');
  await st.click('#btnLogin');
  await st.waitForSelector('text=Đề ma trận từ kho (e2e)');
  await st.evaluate(() => {
    let el = [...document.querySelectorAll('#app *')].find((e) => e.children.length === 0 && /Đề ma trận từ kho \(e2e\)/.test(e.textContent));
    while (el && !el.querySelector('a,button')) el = el.parentElement;
    [...el.querySelectorAll('a,button')].find((b) => /Bắt đầu làm bài/.test(b.textContent)).click();
  });
  await st.waitForSelector('#btnStart');
  if (await st.$('[data-goal="8"]')) await st.click('[data-goal="8"]');
  await st.click('#btnStart');
  await st.waitForSelector('.timer');
  const nq = await st.$$eval('.q', (x) => x.length);
  check(nq === 28, 'học sinh thấy 28 câu');
  const bodyTxt = await st.textContent('body');
  check(!/L1[12]C\d/.test(bodyTxt), 'trang làm bài không lộ mã câu kho');
  await st.screenshot({ path: path.join(SHOTS, '07-hoc-sinh-lam-bai.png') });
  await st.click('#btnSubmit');
  await st.click('[data-close="ok"]');
  await st.waitForSelector('.score-ring', { timeout: 15000 });
  check(true, 'học sinh làm và nộp đề tạo từ kho');
  await st.screenshot({ path: path.join(SHOTS, '08-hoc-sinh-ket-qua.png'), fullPage: true });
  check(!errors.length, 'không có lỗi JS: ' + errors.join(' | '));
  await browser.close();
  console.log('bank.e2e (máy chủ mới): ĐẠT');
})().catch((e) => { console.error(e); process.exit(1); });
