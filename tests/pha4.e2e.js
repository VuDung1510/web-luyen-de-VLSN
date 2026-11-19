// E2E Pha 4 (người làm): Luyện tập cho học sinh + Pool luyện tập của giáo viên.
// Tự chạy dev-server (máy chủ mới có kho giả + pool; và SERVER_COMPAT=1.0.0).
//   NODE_PATH=$(npm root -g) LIBS_DIR=... node tests/pha4.e2e.js [new|compat|all]
// Biến môi trường: PORT_NEW (8781), PORT_OLD (8782), LATENCY_MS (100), SHOTS (docs/bao-cao/anh/pha-4).
// Bao phủ: vào Luyện tập → tự tạo đề → nộp → xem lời giải → luyện câu sai → đề nhanh → lịch sử lọc;
// không lộ dapAn/loiGiai/maKho trước khi nộp; tab Pool có nhãn "đang thi"; CHO_LUYEN_TAP=KHONG; máy chủ 1.0.0.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const MODE = process.argv[2] || 'all';
const LAT = +(process.env.LATENCY_MS || 100);
const PORT_NEW = +(process.env.PORT_NEW || 8781);
const PORT_OLD = +(process.env.PORT_OLD || 8782);
const SHOTS = process.env.SHOTS || path.join(__dirname, '..', 'docs', 'bao-cao', 'anh', 'pha-4');
const LIBS = process.env.LIBS_DIR;
fs.mkdirSync(SHOTS, { recursive: true });

let failed = 0;
function check(name, pass, info) {
  if (!pass) failed++;
  console.log(`  ${pass ? '✓' : '✗'} ${name}${info ? ' — ' + info : ''}`);
}
const shot = (page, name, opts) => page.screenshot(Object.assign({ path: path.join(SHOTS, name + '.png') }, opts || {}));

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
async function api(base, action, body) {
  const r = await fetch(base + '/exec', { method: 'POST', body: JSON.stringify(Object.assign({ action }, body || {})) });
  return r.json();
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
function watch(page, sink, tag) {
  page.on('pageerror', (e) => sink.push(tag + ' pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) sink.push(tag + ' console: ' + m.text()); });
}
/** Ghi lại mọi phản hồi máy chủ (để khẳng định không lộ đáp án trước khi nộp). */
function recordApi(page, sink) {
  page.on('response', async (res) => {
    if (!/\/exec$/.test(res.url())) return;
    try { sink.push({ req: res.request().postData() || '', body: await res.text() }); } catch (e) { /* bỏ qua */ }
  });
}
async function studentLogin(page, base) {
  await page.goto(base + '/');
  await page.waitForSelector('#selClass option[value="12A1"]', { state: 'attached' });
  await page.selectOption('#selClass', '12A1');
  await page.waitForSelector('#selStudent option[value="HS0001"]', { state: 'attached' });
  await page.selectOption('#selStudent', 'HS0001');
  await page.fill('#pin', '0101');
  await page.click('#btnLogin');
  await page.waitForSelector('text=Đề đang mở');
}
async function adminLogin(page, base, pw) {
  await page.goto(base + '/admin.html');
  await page.fill('#pw', pw);
  await page.click('#btnLogin');
  await page.waitForSelector('text=Bài nộp mới nhất');
}
const settle = (p) => p.waitForLoadState('networkidle').catch(() => {}).then(() => p.waitForTimeout(LAT + 250));

/** Làm bài đang mở: chọn A cho Phần I, Đ cho mọi ý Phần II, "1" cho Phần III; nộp; chờ trang kết quả. */
async function answerAndSubmit(page) {
  for (const q of await page.$$('.q')) {
    const opt = await q.$('[data-opt="A"]');
    if (opt) { await opt.click(); continue; }
    const tfs = await q.$$('[data-tf$=":D"]');
    if (tfs.length) { for (const b of tfs) await b.click(); continue; }
    const inp = await q.$('input[data-short]');
    if (inp) await inp.fill('1');
  }
  await page.click('#btnSubmit');
  await page.click('[data-close="ok"]');
  await page.waitForSelector('.score-ring', { timeout: 20000 });
  await page.waitForTimeout(300);
}

async function runNew(browser) {
  console.log('Máy chủ mới (1.4.0):');
  const errors = [];
  const srv = await startServer(PORT_NEW, { LATENCY_MS: String(LAT) });
  try {
    const B = srv.base;
    const tTok = (await api(B, 'loginAdminPassword', { password: srv.pw })).data.token;
    // Một đề NHÁP chứa 1 câu của pool → câu đó "đang thi": không được xuất hiện ở luyện tập
    const pool = (await api(B, 'adminPracticeList', { token: tTok, page: 1, size: 100 })).data;
    const lockedMa = pool.items.find((x) => x.loai === 'TN' && x.lop === 12).maKho;
    const lockedQ = (await api(B, 'adminBankToQuestions', { token: tTok, maKho: [lockedMa] })).data.questions[0];
    const saved = await api(B, 'adminSaveExam', { token: tTok, exam: { tieuDe: 'Đề nháp chứa câu pool', trangThai: 'NHAP', thoiGian: 15 }, questions: [lockedQ] });
    check('Chuẩn bị: đề NHÁP chứa câu pool', saved.ok, lockedMa);

    // ---------- HỌC SINH (điện thoại 390×844) ----------
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    watch(page, errors, 'hs');
    await routeCdn(page);
    const calls = [];
    recordApi(page, calls);
    await studentLogin(page, B);
    const navShown = await page.$eval('#navPractice', (e) => !e.classList.contains('hidden'));
    check('Mục "Luyện tập" hiện trên thanh điều hướng', navShown);
    check('Trang chủ có lối vào Luyện tập', !!(await page.$('#homePractice')));
    await page.goto(B + '/#/luyen-tap');
    await page.waitForSelector('#ptBuilder');
    await settle(page);
    await shot(page, '01-luyen-tap-dien-thoai', { fullPage: true });
    const cards = await page.$$eval('.practice-cards .card h3', (e) => e.map((x) => x.textContent.trim()));
    check('3 thẻ: Tự tạo đề · Luyện câu đã sai (n) · Đề nhanh 10 phút', cards.length === 3 && /Tự tạo đề/.test(cards[0]) && /Luyện câu đã sai \(0\)/.test(cards[1]) && /Đề nhanh 10 phút/.test(cards[2]), cards.join(' | '));
    check('Luyện câu đã sai bị khóa khi chưa có câu sai', await page.$eval('#ptWrong', (b) => b.disabled));
    // Cây chương → bài: chọn cả "Chương II. Khí lí tưởng"
    const chIdx = await page.$$eval('.pt-ch', (els) => els.findIndex((e) => /Khí lí tưởng/.test(e.value)));
    await page.click(`.pt-ch[data-ci="${chIdx}"]`);
    const nBai = await page.$$eval(`.pt-bai[data-ci="${chIdx}"]:checked`, (e) => e.length);
    check('Chọn chương thì chọn mọi bài của chương', nBai === 2, nBai + ' bài');
    await page.fill('#ptTN', '5'); await page.fill('#ptDS', '2'); await page.fill('#ptTL', '2'); await page.fill('#ptPhut', '20');
    await page.$eval('#ptBuilder', (e) => e.scrollIntoView());
    await shot(page, '02-cay-chon-bai-dien-thoai');
    await page.click('#ptStart');
    await page.waitForSelector('#ptGoal');
    await shot(page, '03-muc-tieu-bo-qua-dien-thoai');
    await page.click('[data-goal="8"]');
    const before = calls.length;
    await page.click('#ptGoalOk');
    await page.waitForSelector('.timer');
    await settle(page);
    const nq = await page.$$eval('.q', (e) => e.length);
    check('TU_TAO 5–2–2: đúng 9 câu', nq === 9, nq + ' câu');
    const startResp = calls.slice(before).find((c) => /"practiceStart"/.test(c.req));
    const leak = (s) => /"(dapAn|loiGiai|maKho)"\s*:/.test(s) || s.includes(lockedMa);
    check('practiceStart không trả dapAn/loiGiai/maKho', startResp && !leak(startResp.body));
    const stored = await page.evaluate(() => JSON.stringify(localStorage));
    check('Bộ nhớ trình duyệt không có đáp án / mã kho', !leak(stored));
    await shot(page, '04-lam-bai-luyen-dien-thoai');
    await answerAndSubmit(page);
    check('Trang kết quả có nhãn Luyện tập', !!(await page.$('#practiceBadge')));
    const sol = await page.$$eval('#rvDetail .solution', (e) => e.length);
    check('Kết quả luyện tập có lời giải', sol > 0, sol + ' lời giải');
    check('Không có nút Bảng xếp hạng ở kết quả luyện', !(await page.$('#app a[href^="#/bang-xep-hang"]')));
    await shot(page, '05-ket-qua-luyen-dien-thoai', { fullPage: true });

    // Luyện câu đã sai
    await page.goto(B + '/#/luyen-tap');
    await page.waitForSelector('#ptWrong:not([disabled])', { timeout: 10000 });
    const wrongTxt = await page.$eval('.practice-cards .card:nth-child(2) h3', (e) => e.textContent);
    const nWrong = +(/\((\d+)\)/.exec(wrongTxt) || [])[1];
    check('Có câu đã sai sau bài luyện', nWrong > 0, wrongTxt);
    await page.click('#ptWrong');
    await page.click('#ptGoalSkip');
    await page.waitForSelector('.timer');
    const nq2 = await page.$$eval('.q', (e) => e.length);
    check('Luyện câu đã sai: số câu = số câu sai (≤ 20)', nq2 === Math.min(20, nWrong), nq2 + '/' + nWrong);
    await answerAndSubmit(page);

    // Đề nhanh
    await page.goto(B + '/#/luyen-tap');
    await page.waitForSelector('#ptQuickBai');
    const opts = await page.$$eval('#ptQuickBai option', (e) => e.map((o) => o.value));
    const bai = opts.find((o) => /Boyle/.test(o)) || opts[0];
    await page.selectOption('#ptQuickBai', bai);
    await page.click('#ptQuick');
    await page.click('#ptGoalSkip');
    await page.waitForSelector('.timer');
    const timer = await page.$eval('#timer', (e) => e.textContent);
    const nq3 = await page.$$eval('.q', (e) => e.length);
    const notes = await page.$eval('#examNotes', (e) => e.textContent).catch(() => '');
    check('Đề nhanh: 10 câu, 10 phút', nq3 === 10 && /^(10:00|09:5\d)$/.test(timer), `${nq3} câu, đồng hồ ${timer}${notes ? ', thông báo: ' + notes : ''}`);
    await answerAndSubmit(page);

    // Lịch sử có bộ lọc
    await page.goto(B + '/#/lich-su');
    await page.waitForSelector('#histSeg');
    await page.click('#histSeg [data-h="luyen"]');
    await page.waitForFunction(() => document.querySelectorAll('table tbody tr').length >= 3);
    const nLuyen = await page.$$eval('table tbody tr', (e) => e.length);
    await shot(page, '06-lich-su-luyen-tap-dien-thoai', { fullPage: true });
    await page.click('#histSeg [data-h="thi"]');
    await page.waitForSelector('text=Bạn chưa làm bài nào');
    check('Lịch sử lọc Đề thi / Luyện tập', nLuyen === 3, `luyện tập ${nLuyen} bài, đề thi 0 bài`);
    // Bảng xếp hạng không có bài luyện
    const lb = await api(B, 'leaderboard', { token: await page.evaluate(() => JSON.parse(localStorage.getItem('ld_token'))) });
    check('Bảng xếp hạng không tính bài luyện', lb.ok && lb.data.total === 0, 'total = ' + (lb.data && lb.data.total));
    // Không lần nào câu "đang thi" xuất hiện
    const starts = calls.filter((c) => /"practiceStart"/.test(c.req));
    check('Câu của đề NHÁP không xuất hiện ở luyện tập', starts.length === 3 && starts.every((c) => !c.body.includes(JSON.stringify(lockedQ.noiDung).slice(1, -1))), starts.length + ' lần bắt đầu');

    // Màn hình máy tính: trang Luyện tập + kết quả
    const pc = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    const p2 = await pc.newPage();
    watch(p2, errors, 'hs-pc');
    await routeCdn(p2);
    await studentLogin(p2, B);
    await p2.goto(B + '/#/luyen-tap');
    await p2.waitForSelector('#ptBuilder');
    await settle(p2);
    await shot(p2, '07-luyen-tap', { fullPage: true });
    await p2.$eval('#ptBuilder', (e) => e.scrollIntoView());
    await shot(p2, '08-cay-chon-bai');
    await p2.goto(B + '/#/lich-su');
    await p2.waitForSelector('#histSeg');
    await p2.click('#histSeg [data-h="luyen"]');
    await p2.waitForSelector('table tbody tr');
    await p2.click('table tbody tr:last-child a');
    await p2.waitForSelector('#practiceBadge');
    await settle(p2);
    await shot(p2, '09-ket-qua-luyen', { fullPage: true });

    // ---------- GIÁO VIÊN ----------
    const ad = await pc.newPage();
    watch(ad, errors, 'gv');
    await routeCdn(ad);
    await adminLogin(ad, B, srv.pw);
    await ad.goto(B + '/admin.html#/ngan-hang/pool');
    await ad.waitForSelector('#plList');
    await ad.selectOption('#plBat', 'DANG_THI');
    await ad.waitForFunction(() => /1 câu phù hợp/.test(document.body.textContent));
    const tag = await ad.$eval('#plList .pool-item', (e) => e.textContent);
    check('Tab Pool: nhãn "đang thi" cho câu trong đề nháp', /đang thi/.test(tag) && tag.includes(lockedMa));
    await ad.selectOption('#plBat', '');
    await ad.waitForFunction(() => /\d+ câu phù hợp/.test(document.body.textContent) && !/^1 câu/.test(''));
    await settle(ad);
    await shot(ad, '10-pool-dang-thi', { fullPage: false });
    // Tắt một câu → số câu học sinh thấy giảm
    const meta0 = (await api(B, 'practiceMeta', { token: await p2.evaluate(() => JSON.parse(localStorage.getItem('ld_token'))) })).data;
    const sum = (m) => m.cay.reduce((s, x) => s + x.dem.TN + x.dem.DS + x.dem.TL, 0);
    const target = await ad.$$eval('#plList .pool-item', (els) => {
      const it = els.find((e) => !/đang thi/.test(e.textContent) && /Lớp 12/.test(e.textContent) && e.querySelector('[data-to="KHONG"]'));
      return it && it.dataset.ma;
    });
    await ad.click(`#plList .pool-item[data-ma="${target}"] [data-to="KHONG"]`);
    await ad.waitForFunction(() => document.querySelector('#plList .pool-item.off'));
    const meta1 = (await api(B, 'practiceMeta', { token: await p2.evaluate(() => JSON.parse(localStorage.getItem('ld_token'))) })).data;
    check('Tắt câu trong pool: học sinh bớt 1 câu', sum(meta1) === sum(meta0) - 1, sum(meta0) + ' → ' + sum(meta1));
    // Ngân hàng: Đưa vào luyện tập (có câu đang thi → cảnh báo)
    await ad.goto(B + '/admin.html#/ngan-hang');
    await ad.waitForSelector('#bkList .bank-item');
    await ad.fill('#bkQ', lockedMa);
    await ad.waitForFunction(() => /1 câu phù hợp/.test((document.querySelector('#bkList') || {}).textContent || ''));
    await ad.click('#bkList [data-cart]');
    await ad.click('#cartPractice');
    await ad.click('#ptAdd');
    await ad.waitForSelector('#ptResult', { timeout: 15000 });
    const warn = await ad.$eval('#ptDangThi', (e) => e.textContent).catch(() => '');
    check('Đưa vào luyện tập câu đang thi: có cảnh báo', /đang thi/.test(warn) && warn.includes(lockedMa));
    await shot(ad, '11-dua-vao-luyen-tap-canh-bao');
    await ad.click('.modal [data-close]:not([href])');
    // Điện thoại: tab Pool
    const ph = await ctx.newPage();
    watch(ph, errors, 'gv-dt');
    await routeCdn(ph);
    await adminLogin(ph, B, srv.pw);
    await ph.goto(B + '/admin.html#/ngan-hang/pool');
    await ph.waitForSelector('#plList .pool-item');
    await ph.selectOption('#plBat', 'DANG_THI');
    await ph.waitForFunction(() => /1 câu phù hợp/.test(document.body.textContent));
    await settle(ph);
    await shot(ph, '12-pool-dang-thi-dien-thoai', { fullPage: true });

    // CHO_LUYEN_TAP = KHONG: máy chủ chặn, giao diện ẩn mục
    await api(B, 'adminSaveSettings', { token: tTok, settings: { CHO_LUYEN_TAP: 'KHONG' } });
    const sTok = await p2.evaluate(() => JSON.parse(localStorage.getItem('ld_token')));
    const m = await api(B, 'practiceMeta', { token: sTok });
    const s = await api(B, 'practiceStart', { token: sTok, kieu: 'TU_TAO', bai: [bai], so: { TN: 5 }, phut: 10 });
    check('CHO_LUYEN_TAP=KHONG: practiceMeta/practiceStart báo lỗi', !m.ok && !s.ok && /tắt luyện tập/.test(m.error), m.error);
    await p2.evaluate(() => { localStorage.removeItem('ld_pub'); localStorage.removeItem('ld_pub_t'); });
    await p2.goto(B + '/#/');
    await p2.waitForSelector('text=Đề đang mở');
    await settle(p2);
    const hidden = await p2.$eval('#navPractice', (e) => e.classList.contains('hidden'));
    check('CHO_LUYEN_TAP=KHONG: không có mục Luyện tập', hidden && !(await p2.$('#homePractice')));
    await p2.goto(B + '/#/luyen-tap');
    await p2.waitForSelector('#practiceOff');
    check('CHO_LUYEN_TAP=KHONG: vào thẳng #/luyen-tap thấy thông báo tắt', true);
    // N-2: tắt luyện tập vẫn xem lại được bài luyện cũ
    await p2.goto(B + '/#/lich-su');
    await p2.waitForSelector('#histSeg');
    await p2.click('#histSeg [data-h="luyen"]');
    await p2.waitForSelector('table tbody tr');
    await p2.click('table tbody tr:first-child a');
    await p2.waitForSelector('#practiceBadge');
    check('CHO_LUYEN_TAP=KHONG: Lịch sử vẫn xem lại được bài luyện cũ', !!(await p2.$('#rvDetail .solution')));
    await api(B, 'adminSaveSettings', { token: tTok, settings: { CHO_LUYEN_TAP: 'CO' } });

    check('Không lỗi JS', errors.length === 0, errors.join(' | ').slice(0, 500));
    await ctx.close(); await pc.close();
  } finally {
    srv.proc.kill();
  }
}

async function runCompat(browser) {
  console.log('Máy chủ cũ (SERVER_COMPAT=1.0.0):');
  const errors = [];
  const srv = await startServer(PORT_OLD, { SERVER_COMPAT: '1.0.0', LATENCY_MS: String(LAT) });
  try {
    const B = srv.base;
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    watch(page, errors, 'hs(1.0.0)');
    await routeCdn(page);
    await studentLogin(page, B);
    await settle(page);
    check('Không có mục Luyện tập', await page.$eval('#navPractice', (e) => e.classList.contains('hidden')) && !(await page.$('#homePractice')));
    for (const [h, sel] of [['#/lich-su', 'h1'], ['#/thong-ke', 'h1'], ['#/bang-xep-hang', 'h1']]) {
      await page.goto(B + '/' + h);
      await page.waitForSelector(sel);
      await settle(page);
    }
    await page.goto(B + '/#/lich-su');
    await page.waitForSelector('h1');
    await settle(page);
    check('Lịch sử không có bộ lọc Luyện tập', !(await page.$('#histSeg')));
    await page.goto(B + '/#/luyen-tap');
    await page.waitForSelector('#practiceOff');
    check('#/luyen-tap: thông báo chưa mở, không lỗi đỏ', !(await page.$('.toast.err')));
    await shot(page, '13-may-chu-cu-dien-thoai', { fullPage: true });
    // Học sinh vẫn làm đề bình thường
    await page.goto(B + '/#/');
    await page.waitForSelector('text=Bắt đầu làm bài');
    await page.click('text=Bắt đầu làm bài');
    await page.click('#btnStart');
    await page.waitForSelector('.timer');
    await answerAndSubmit(page);
    check('Máy chủ 1.0.0: làm và nộp đề thi bình thường', !!(await page.$('.score-ring')));
    // Giáo viên: không có tab Pool
    const pc = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    const ad = await pc.newPage();
    watch(ad, errors, 'gv(1.0.0)');
    await routeCdn(ad);
    await adminLogin(ad, B, srv.pw);
    await ad.goto(B + '/admin.html#/ngan-hang');
    await settle(ad);
    check('Quản trị: không có tab Pool luyện tập', !(await ad.$('#bankTabs')));
    await ad.goto(B + '/admin.html#/ngan-hang/pool');
    await ad.waitForSelector('#poolNeedUpdate');
    check('Quản trị #/ngan-hang/pool: "Cần cập nhật máy chủ"', true);
    await ad.goto(B + '/admin.html#/cai-dat');
    await ad.waitForSelector('#btnSaveSet');
    check('Cài đặt không có ô Luyện tập', !(await ad.$('[data-k="CHO_LUYEN_TAP"]')));
    check('Không lỗi JS (1.0.0)', errors.length === 0, errors.join(' | ').slice(0, 500));
    await ctx.close(); await pc.close();
  } finally {
    srv.proc.kill();
  }
}

(async () => {
  const browser = await chromium.launch();
  try {
    if (MODE === 'new' || MODE === 'all') await runNew(browser);
    if (MODE === 'compat' || MODE === 'all') await runCompat(browser);
  } catch (e) {
    failed++;
    console.error('LỖI:', e.stack || e);
  } finally {
    await browser.close();
  }
  console.log(failed ? `\n${failed} kiểm tra KHÔNG ĐẠT` : '\nE2E Pha 4: tất cả đạt');
  process.exit(failed ? 1 : 0);
})();
