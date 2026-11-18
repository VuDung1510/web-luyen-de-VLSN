// Kiểm thử R-1 (vòng 2 Pha 1) trên giao diện thật: HS A nộp bài, đăng xuất, HS B đăng nhập TRƯỚC khi lời gọi
// làm mới ngầm (myStats/bootstrap) của A trả về → kho của B không được chứa dữ liệu của A.
// Cần dev-server đang chạy (PORT, mặc định 8787). node tests/pha1-r1.e2e.js
const { chromium } = require('playwright');

const BASE = 'http://localhost:' + (process.env.PORT || 8787);

(async () => {
  const br = await chromium.launch();
  const page = await (await br.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route(/cdnjs|fonts\.g|accounts\.google/, (r) => r.fulfill({ status: 200, body: '' }));
  // thêm HS B qua trang quản trị
  if (process.env.ADMIN_PW) {
    const ad = await page.context().newPage();
    await ad.route(/cdnjs|fonts\.g|accounts\.google/, (r) => r.fulfill({ status: 200, body: '' }));
    await ad.goto(BASE + '/admin.html');
    await ad.fill('#pw', process.env.ADMIN_PW); await ad.click('#btnLogin');
    await ad.waitForSelector('text=Bài nộp mới nhất');
    await ad.goto(BASE + '/admin.html#/hoc-sinh'); await ad.waitForSelector('#btnBulk');
    await ad.click('#btnBulk'); await ad.fill('#bText', 'Bạn Thứ Hai\t12A1\t07/04/2008');
    await ad.click('#bGo'); await ad.waitForSelector('text=Đã thêm'); await ad.close();
  }
  const login = async (id, pin, noNav) => {
    if (!noNav) await page.goto(BASE + '/'); // đăng nhập B KHÔNG tải lại trang, để lời gọi cũ của A còn sống
    await page.waitForSelector('#selClass option[value="12A1"]', { state: 'attached' });
    await page.selectOption('#selClass', '12A1');
    await page.waitForSelector(`#selStudent option[value="${id}"]`, { state: 'attached' });
    await page.selectOption('#selStudent', id);
    await page.fill('#pin', pin); await page.click('#btnLogin');
    await page.waitForSelector('text=Đề đang mở');
  };
  await login('HS0001', '0101');
  // giữ lại các lời gọi làm mới ngầm sau khi nộp bài
  const held = [];
  let hold = false;
  await page.route(/\/exec/, (r) => {
    const a = (() => { try { return JSON.parse(r.request().postData()).action; } catch (e) { return ''; } })();
    if (hold && /^(myStats|bootstrap|listExams|myResults)$/.test(a)) held.push(r); else r.continue();
  });
  await page.click('text=Bắt đầu làm bài'); await page.waitForSelector('#btnStart');
  if (await page.$('#goal')) await page.click('[data-goal="8"]');
  await page.click('#btnStart'); await page.waitForSelector('.timer');
  hold = true;
  await page.click('#btnSubmit'); await page.click('[data-close="ok"]');
  await page.waitForSelector('.score-ring');
  await page.waitForTimeout(300);
  if (!held.length) errors.push('Không giữ được lời gọi làm mới ngầm nào');
  hold = false;
  await page.click('#btnLogout'); await page.click('[data-close="ok"]');
  await page.waitForSelector('#btnLogin');
  await login('HS0002', '0704', true);
  for (const r of held) await r.continue(); // dữ liệu của A về muộn
  await page.waitForTimeout(1500);
  const leak = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('ld_c_') && !k.startsWith('ld_c_v1_HS0002_')));
  if (leak.length) errors.push('Còn khóa không phải của B: ' + leak.join(', '));
  const stats = await page.evaluate(() => localStorage.getItem('ld_c_v1_HS0002_stats'));
  if (stats && JSON.parse(stats).d.count > 0) errors.push('Kho Thống kê của B chứa dữ liệu của A');
  const home = await page.evaluate(() => localStorage.getItem('ld_c_v1_HS0002_home'));
  if (home && JSON.parse(home).d.results.length) errors.push('Kho Trang chủ của B chứa bài của A');
  await page.goto(BASE + '/#/thong-ke');
  await page.waitForSelector('h1');
  if (!(await page.$('text=Làm ít nhất một bài'))) errors.push('B thấy thống kê không phải của mình');
  await br.close();
  if (errors.length) { console.error('LỖI:\n' + errors.join('\n')); process.exit(1); }
  console.log('✓ R-1: dữ liệu làm mới ngầm của HS A không lọt vào kho của HS B (' + held.length + ' lời gọi bị giữ)');
})().catch((e) => { console.error(e); process.exit(1); });
