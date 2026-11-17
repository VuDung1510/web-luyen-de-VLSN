// Kiểm thử giao diện đầu-cuối bằng Playwright: node tests/e2e.js [thư mục ảnh chụp]
// Cần dev-server đang chạy ở cổng 8787 (node tests/dev-server.js).
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:8787';
const SHOTS = process.argv[2] || path.join(__dirname, 'screenshots');
const LIBS = process.env.LIBS_DIR; // node_modules chứa katex & chart.js (khi CDN bị chặn)
fs.mkdirSync(SHOTS, { recursive: true });

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
      if (m) {
        const f = file || 'katex/dist/fonts/' + m[1];
        return r.fulfill({ status: 200, contentType: type, body: fs.readFileSync(path.join(LIBS, f)) });
      }
    }
    return r.fulfill({ status: 404, body: '' });
  });
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const ctxPhone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await ctxPhone.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  await routeCdn(page);

  // ---------- HỌC SINH ----------
  await page.goto(BASE + '/');
  await page.waitForSelector('#selClass option[value="12A1"]', { state: 'attached' });
  await page.screenshot({ path: path.join(SHOTS, '01-dang-nhap.png'), fullPage: true });
  await page.selectOption('#selClass', '12A1');
  await page.waitForSelector('#selStudent option[value="HS0001"]', { state: 'attached' });
  await page.selectOption('#selStudent', 'HS0001');
  await page.fill('#pin', '1234');
  await page.click('#btnLogin');
  await page.waitForSelector('.toast.err');
  await page.fill('#pin', '0101');
  await page.click('#btnLogin');
  await page.waitForSelector('text=Đề đang mở');
  await page.screenshot({ path: path.join(SHOTS, '02-trang-chu.png'), fullPage: true });

  await page.click('text=Bắt đầu làm bài');
  await page.waitForSelector('#btnStart');
  await page.click('#btnStart');
  await page.waitForSelector('.timer');
  // Câu 1: C, câu 2: B, câu 3: A, câu 4: Đ S Đ S, câu 5: 420, câu 6: 12,5
  const qs = await page.$$('.q');
  await qs[0].$('[data-opt="C"]').then((b) => b.click());
  await qs[1].$('[data-opt="A"]').then((b) => b.click());
  await qs[2].$('[data-opt="A"]').then((b) => b.click());
  for (const v of ['0:D', '1:S', '2:D', '3:D']) await qs[3].$(`[data-tf="${v}"]`).then((b) => b.click());
  await qs[4].$('input').then((i) => i.fill('420'));
  await page.screenshot({ path: path.join(SHOTS, '03-lam-bai.png'), fullPage: false });
  // tải lại trang giữa chừng → câu trả lời vẫn còn
  await page.reload();
  await page.waitForSelector('.timer');
  const kept = await page.$eval('.q:nth-of-type(1) .opt.sel .key', (e) => e.textContent).catch(() => null);
  const keptCount = await page.$$eval('.opt.sel, .tf-btns .sel', (els) => els.length);
  if (keptCount !== 7) errors.push('Mất câu trả lời sau khi tải lại: ' + keptCount + ' ' + kept);
  await page.click('#btnNav');
  await page.screenshot({ path: path.join(SHOTS, '04-danh-sach-cau.png') });
  await page.click('#navClose');
  await page.click('#btnSubmit');
  await page.click('[data-close="ok"]');
  await page.waitForSelector('.score-ring', { timeout: 15000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(SHOTS, '05-ket-qua.png'), fullPage: true });
  const score = await page.$eval('.score-ring b', (e) => e.textContent);
  if (score !== '5,56') errors.push('Điểm sai: ' + score + ' (mong đợi 5,56)');

  await page.goto(BASE + '/#/thong-ke');
  await page.waitForSelector('#chTimeline');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SHOTS, '06-thong-ke.png'), fullPage: true });
  await page.goto(BASE + '/#/bang-xep-hang');
  await page.waitForSelector('table');
  await page.screenshot({ path: path.join(SHOTS, '07-xep-hang.png'), fullPage: true });

  // ---------- GIÁO VIÊN (màn hình máy tính) ----------
  const ctxPc = await browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1 });
  const ad = await ctxPc.newPage();
  ad.on('pageerror', (e) => errors.push('admin pageerror: ' + e.message));
  ad.on('dialog', (d) => d.accept());
  await routeCdn(ad);
  await ad.goto(BASE + '/admin.html');
  await ad.fill('#pw', process.env.ADMIN_PW);
  await ad.click('#btnLogin');
  await ad.waitForSelector('text=Bài nộp mới nhất');
  await ad.screenshot({ path: path.join(SHOTS, '10-qt-tong-quan.png'), fullPage: true });

  // Thêm học sinh hàng loạt
  await ad.goto(BASE + '/admin.html#/hoc-sinh');
  await ad.waitForSelector('#btnBulk');
  await ad.click('#btnBulk');
  await ad.fill('#bText', 'Họ tên\tLớp\tNgày sinh\nNguyễn Văn An\t12A2\t05/03/2008\nTrần Thị Bình\t12A2\t20/11/2008\nLê Minh Châu\t12a1\t2008-07-09');
  await ad.click('#bGo');
  await ad.waitForSelector('text=Đã thêm 3 học sinh');
  await ad.click('[data-close="ok"]');
  await ad.waitForSelector('text=Lê Minh Châu');
  await ad.screenshot({ path: path.join(SHOTS, '11-qt-hoc-sinh.png'), fullPage: true });

  // Tạo đề bằng nhập văn bản
  await ad.goto(BASE + '/admin.html#/de-thi/moi');
  await ad.waitForSelector('#eTitle');
  await ad.fill('#eTitle', 'Kiểm tra 15 phút — Khí lí tưởng');
  await ad.selectOption('#eStatus', 'MO');
  await ad.fill('#eTime', '15');
  await ad.click('#btnImport');
  await ad.fill('#impText', `PHẦN I
Câu 1. Đơn vị đo áp suất trong hệ SI là
A. Pa.  B. atm.  C. mmHg.  D. bar.
Câu 2. Quá trình đẳng nhiệt có
A. $p$ không đổi  *B. $T$ không đổi  C. $V$ không đổi  D. $pV$ tăng
PHẦN II
Câu 1. Khí lí tưởng
a) Tuân theo định luật Boyle (Đ)
b) Các phân tử có thể tích riêng lớn (S)
c) Va chạm giữa các phân tử là đàn hồi (Đ)
d) Có lực hút mạnh giữa các phân tử (S)
PHẦN III
Câu 1. Nén đẳng nhiệt khí từ 10 lít xuống 4 lít thì áp suất tăng bao nhiêu lần?
Đáp số: 2,5
Lời giải: $p_2/p_1 = V_1/V_2 = 2,5$
BẢNG ĐÁP ÁN
PHẦN I
1.A`);
  await ad.click('#impCheck');
  await ad.waitForSelector('text=Tìm thấy');
  await ad.screenshot({ path: path.join(SHOTS, '12-qt-nhap-nhanh.png') });
  await ad.click('#impReplace');
  await ad.waitForSelector('.qedit');
  const nq = await ad.$$eval('.qedit', (e) => e.length);
  if (nq !== 4) errors.push('Nhập nhanh: ' + nq + ' câu (mong đợi 4)');
  await ad.screenshot({ path: path.join(SHOTS, '13-qt-soan-de.png'), fullPage: false });
  await ad.click('#btnSave');
  await ad.waitForSelector('text=Đã lưu đề');
  await ad.goto(BASE + '/admin.html#/de-thi');
  await ad.waitForSelector('text=Kiểm tra 15 phút');
  await ad.screenshot({ path: path.join(SHOTS, '14-qt-de-thi.png'), fullPage: true });

  await ad.goto(BASE + '/admin.html#/de-thi/thong-ke/DEMAU');
  await ad.waitForSelector('text=Phân tích từng câu');
  await ad.waitForTimeout(500);
  await ad.screenshot({ path: path.join(SHOTS, '15-qt-thong-ke-de.png'), fullPage: true });
  await ad.goto(BASE + '/admin.html#/bang-diem');
  await ad.waitForSelector('#gLop');
  await ad.screenshot({ path: path.join(SHOTS, '16-qt-bang-diem.png'), fullPage: true });
  await ad.goto(BASE + '/admin.html#/ket-qua');
  await ad.waitForSelector('text=Lượt nộp');
  await ad.click('a.btn:has-text("Xem")');
  await ad.waitForSelector('.score-ring');
  await ad.screenshot({ path: path.join(SHOTS, '17-qt-xem-bai.png'), fullPage: false });
  await ad.goto(BASE + '/admin.html#/cai-dat');
  await ad.waitForSelector('#btnSaveSet');
  await ad.screenshot({ path: path.join(SHOTS, '18-qt-cai-dat.png'), fullPage: true });

  // Học sinh mới thấy đề mới
  await page.goto(BASE + '/');
  await page.waitForSelector('text=Kiểm tra 15 phút');

  // Không tràn ngang trên điện thoại
  for (const h of ['#/', '#/thong-ke', '#/bang-xep-hang', '#/lich-su']) {
    await page.goto(BASE + '/' + h);
    await page.waitForTimeout(400);
    const over = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    if (over) errors.push('Tràn ngang trên điện thoại ở ' + h);
  }

  await browser.close();
  if (errors.length) { console.error('LỖI:\n' + errors.join('\n')); process.exit(1); }
  console.log('✓ Giao diện: học sinh làm bài + giáo viên quản trị đều chạy đúng. Ảnh chụp ở', SHOTS);
})().catch((e) => { console.error(e); process.exit(1); });
