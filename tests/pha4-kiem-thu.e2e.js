// Kiểm thử độc lập Pha 4 (người kiểm thử) — giao diện học sinh + giáo viên, viết theo docs/spec/pha-4-luyen-tap.md.
// Tự chạy dev-server: máy chủ mới (pool = kho giả), PRACTICE=0 (CHO_LUYEN_TAP=KHONG), SERVER_COMPAT=1.0.0.
//   NODE_PATH=$(npm root -g) LIBS_DIR=... node tests/pha4-kiem-thu.e2e.js [new|off|compat|all]
// Biến môi trường: PORT_NEW (8790), PORT_OFF (8791), PORT_OLD (8792), LATENCY_MS (150), SHOTS (docs/bao-cao/anh/pha-4; ảnh kt-*.png).
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const K = require('./fixtures/kho-gia');

const MODE = process.argv[2] || 'all';
const LAT = +(process.env.LATENCY_MS || 150);
const PORT_NEW = +(process.env.PORT_NEW || 8790);
const PORT_OFF = +(process.env.PORT_OFF || 8791);
const PORT_OLD = +(process.env.PORT_OLD || 8792);
const SHOTS = process.env.SHOTS || path.join(__dirname, '..', 'docs', 'bao-cao', 'anh', 'pha-4');
const LIBS = process.env.LIBS_DIR;
fs.mkdirSync(SHOTS, { recursive: true });

const R = { tc: {} };
function verdict(tc, pass, evidence) {
  const e = R.tc[tc] || { pass: true, evidence: [] };
  e.pass = e.pass && !!pass; e.evidence.push((pass ? 'OK  ' : 'FAIL ') + evidence); R.tc[tc] = e;
  console.log(`  ${pass ? '✓' : '✗'} ${tc}: ${evidence}`);
}
const shot = (page, name, opts) => page.screenshot(Object.assign({ path: path.join(SHOTS, 'kt-' + name + '.png') }, opts || {}));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
async function adminLogin(page, base, pw) {
  await page.goto(base + '/admin.html');
  await page.fill('#pw', pw);
  await page.click('#btnLogin');
  await page.waitForSelector('text=Bài nộp mới nhất');
}
async function studentLogin(page, base, lop, id, pin) {
  await page.goto(base + '/');
  await page.waitForSelector(`#selClass option[value="${lop}"]`, { state: 'attached' });
  await page.selectOption('#selClass', lop);
  await page.waitForSelector(`#selStudent option[value="${id}"]`, { state: 'attached' });
  await page.selectOption('#selStudent', id);
  await page.fill('#pin', pin);
  await page.click('#btnLogin');
  await page.waitForSelector('a[href="#/lich-su"]', { timeout: 15000 });
  await page.waitForTimeout(LAT + 400);
}
const normTF = (s) => String(s || '').toUpperCase().replace(/Đ/g, 'D').replace(/[^DS]/g, '');
// Nội dung → hàng kho giả chuẩn (dev-server nạp đúng kho này; tất định)
const ROWS = K.standardRows();
const BY_ND = new Map(ROWS.map((r) => [r[8], r]));
function dsKey(r) { return (r[13].match(/([a-d])\)\s*(Đúng|Sai|Đ|S)/gi) || []).map((x) => (/Đ|Đúng/i.test(x.replace(/^[a-d]\)\s*/i, '')) ? 'D' : 'S')); }
// Làm bài trên giao diện: right(q) → true = trả lời đúng. Trả về {filled, expectGoc, maxGoc}
async function fillExam(page, questions, right) {
  let filled = 0; let goc = 0; let max = 0;
  for (const q of questions) {
    const el = await page.$(`.q[data-stt="${q.stt}"]`);
    const r = BY_ND.get(q.noiDung);
    if (!el || !r) continue;
    const ok = right(q, r);
    if (q.loai === 'TN') { max += 0.25; const a = ok ? r[13] : 'ABCD'.replace(r[13], '')[0]; await (await el.$(`[data-opt="${a}"]`)).click(); if (ok) goc += 0.25; }
    else if (q.loai === 'DS') { max += 1; const tf = dsKey(r).map((x) => (ok ? x : x === 'D' ? 'S' : 'D')); for (let j = 0; j < 4; j++) await (await el.$(`[data-tf="${j}:${tf[j]}"]`)).click(); if (ok) goc += 1; }
    else { max += 0.25; await (await el.$('input')).fill(ok ? r[13] : '98765'); if (ok) goc += 0.25; }
    filled++;
  }
  return { filled, goc, max };
}
// Ghi mọi yêu cầu/phản hồi /exec (thời điểm, action, thân)
function netLog(page) {
  const log = [];
  page.on('response', async (res) => {
    if (!/\/exec/.test(res.url())) return;
    let action = ''; try { action = JSON.parse(res.request().postData() || '{}').action; } catch (e) { /* bỏ qua */ }
    try { log.push({ t: Date.now(), action, req: res.request().postData() || '', body: await res.text() }); } catch (e) { /* bỏ qua */ }
  });
  return log;
}
const LEAK_KEYS = /"(dapAn|loiGiai|maKho|mucDoY)"\s*:/;
const MA_LIST = ROWS.map((r) => r[0]);
const LG_LIST = [...new Set(ROWS.map((r) => r[14]).filter((x) => x && x.length > 8))];
function leakIn(text) {
  const out = [];
  const m = text.match(LEAK_KEYS); if (m) out.push(m[1]);
  const ma = MA_LIST.filter((x) => text.includes(x)); if (ma.length) out.push('mã ' + ma[0]);
  const lg = LG_LIST.filter((x) => text.includes(x.slice(0, 20))); if (lg.length) out.push('lời giải');
  return out;
}
async function startPracticeVia(page, clickSel, goal) {
  await page.click(clickSel);
  await page.waitForSelector('.modal', { timeout: 10000 });
  await page.waitForTimeout(150);
  if (goal) { await page.click(`.modal [data-goal="${goal}"]`); await page.click('#ptGoalOk'); } else await page.click('#ptGoalSkip');
  await page.waitForSelector('#btnSubmit', { timeout: 15000 });
  await page.waitForTimeout(LAT + 400);
}
async function submit(page) {
  await page.click('#btnSubmit');
  await page.click('[data-close="ok"]');
  await page.waitForSelector('.score-ring', { timeout: 20000 });
  await page.waitForTimeout(LAT + 400);
  return page.$eval('.score-ring b', (e) => e.textContent.trim());
}
const lastStart = (log) => { const x = log.filter((e) => e.action === 'practiceStart').pop(); return x ? JSON.parse(x.body).data : null; };
const mainText = (p) => p.$eval('main', (e) => e.textContent.replace(/\s+/g, ' '));
const navHasPractice = (p) => p.evaluate(() => [...document.querySelectorAll('a[href="#/luyen-tap"]')].some((a) => a.offsetParent !== null));

// ======================= Máy chủ mới =======================
async function runNew(browser) {
  const errors = [];
  const srv = await startServer(PORT_NEW, { LATENCY_MS: String(LAT) });
  try {
    const B = srv.base;
    const tTok = (await api(B, 'loginAdminPassword', { password: srv.pw })).token;
    const sctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    const st = await sctx.newPage();
    watchErrors(st, errors, 'hs');
    await routeCdn(st);
    const log = netLog(st);
    await studentLogin(st, B, '12A1', 'HS0001', '0101');
    verdict('Mục Luyện tập (máy chủ mới)', await navHasPractice(st), 'thanh điều hướng có "Luyện tập"');
    await st.click('a[href="#/luyen-tap"]');
    await st.waitForSelector('#ptTree');
    await st.waitForTimeout(LAT + 300);
    const t0 = await mainText(st);
    const nLuyen = +(/(\d+)\s*Câu có thể luyện/.exec(t0) || [])[1];
    verdict('Trang Luyện tập', /Tự tạo đề/.test(t0) && /Luyện câu đã sai \(0\)/.test(t0) && /Đề nhanh 10 phút/.test(t0) && nLuyen === 44,
      `3 thẻ có mặt; "Câu có thể luyện" = ${nLuyen} (pool 47 trừ 3 câu lớp 11 → 44 cho HS 12A1)`);
    await shot(st, '01-trang-luyen-tap');

    // ---- Tự tạo đề: chọn 1 bài ----
    await st.evaluate(() => document.querySelectorAll('#ptTree details').forEach((d) => { d.open = true; }));
    await st.check('input.pt-bai[value="Bài 9. Định luật Boyle"]');
    await st.fill('#ptTN', '6'); await st.fill('#ptDS', '2'); await st.fill('#ptTL', '2'); await st.fill('#ptPhut', '15');
    await st.waitForTimeout(200);
    const sum = await st.$eval('#ptSum', (e) => e.textContent.trim());
    await shot(st, '02-cay-chon-bai');
    const tBefore = Date.now();
    await startPracticeVia(st, '#ptStart', '8');
    const req = JSON.parse(log.filter((e) => e.action === 'practiceStart').pop().req);
    const s1 = lastStart(log);
    const qEls = await st.$$('.q');
    const inBai = s1.questions.map((q) => BY_ND.get(q.noiDung)).filter((r) => r && r[3] === 'Bài 9. Định luật Boyle').length;
    const timer = await st.$eval('#timer', (e) => e.textContent.trim());
    verdict('TC-4.3 (giao diện)', qEls.length === 10 && inBai === 10 && JSON.stringify(req.bai) === '["Bài 9. Định luật Boyle"]' && /^1[45]:\d\d$/.test(timer),
      `ô tóm tắt "${sum}"; gửi chuong=${JSON.stringify(req.chuong)} bai=${JSON.stringify(req.bai)} so=${JSON.stringify(req.so)} phut=${req.phut} mucTieu=${req.mucTieu}; đề ${qEls.length} câu, ${inBai} câu thuộc Bài 9; đồng hồ ${timer}`);
    await shot(st, '03-lam-bai-luyen');
    // Làm: sai 2 câu P1 + 1 câu P2 → biết trước điểm
    let wrongTN = 0; let wrongDS = 0;
    const f = await fillExam(st, s1.questions, (q) => { if (q.loai === 'TN' && wrongTN < 2) { wrongTN++; return false; } if (q.loai === 'DS' && wrongDS < 1) { wrongDS++; return false; } return true; });
    const storage = await st.evaluate(() => JSON.stringify(Object.assign({}, localStorage)) + JSON.stringify(Object.assign({}, sessionStorage)));
    const tSubmit = Date.now();
    const pre = log.filter((e) => e.t <= tSubmit);
    const leaksPre = pre.map((e) => [e.action, leakIn(e.body)]).filter(([, l]) => l.length);
    const storeLeak = leakIn(storage);
    // token p: giải mã base64 xem có đáp án không
    const tokPayload = Buffer.from(s1.attemptToken.split('.')[0].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    verdict('Không lộ đáp án trước khi nộp (mạng)', !leaksPre.length && !storeLeak.length && !/dapAn|loiGiai/.test(tokPayload),
      `${pre.length} phản hồi máy chủ trước khi nộp (gồm ${pre.filter((e) => e.action === 'practiceStart').length} practiceStart): vi phạm ${JSON.stringify(leaksPre)}; localStorage/sessionStorage: ${storeLeak.join(',') || 'sạch'}; token p chỉ có ${Object.keys(JSON.parse(tokPayload)).join(',')} (qids = mã câu kho, không có đáp án)`);
    const score = await submit(st);
    const expect = Math.round(f.goc / f.max * 1000) / 100;
    const expectTxt = String(expect).replace('.', ',');
    const resText = await mainText(st);
    const nLG = (resText.match(/Lời giải mẫu/g) || []).length;
    const hash = await st.evaluate(() => location.hash);
    verdict('TC-4.4 (giao diện)', f.filled === 10 && score === expectTxt && /#\/ket-qua\/LT/.test(hash) && /Luyện tập/.test(resText) && /không tính vào bảng xếp hạng/.test(resText),
      `điền ${f.filled}/10; điểm "${score}" (tính tay ${f.goc}/${f.max} → ${expectTxt}); ${hash}; nhãn "Luyện tập · … không tính vào bảng xếp hạng"`);
    // Xem lời giải: mở các câu (bấm "Câu cần xem lại" nếu cần) → đếm lời giải hiển thị
    const nLG2 = await st.evaluate(() => { document.querySelectorAll('details').forEach((d) => { d.open = true; }); return (document.querySelector('main').textContent.match(/Lời giải mẫu/g) || []).length; });
    verdict('Xem lời giải', Math.max(nLG, nLG2) >= 10, `trang kết quả bài luyện hiện ${Math.max(nLG, nLG2)} lời giải (đề 10 câu)`);
    await shot(st, '04-ket-qua-luyen', { fullPage: false });
    await st.evaluate(() => { const x = [...document.querySelectorAll('main *')].find((e) => /Lời giải mẫu/.test(e.textContent) && e.children.length < 3); if (x) x.scrollIntoView(); });
    await shot(st, '05-ket-qua-loi-giai');

    // ---- Luyện câu đã sai ----
    await st.click('a[href="#/luyen-tap"]'); await st.waitForSelector('#ptWrong'); await st.waitForTimeout(LAT + 400);
    const wrongLbl = await st.$eval('.practice-cards', (e) => (/Luyện câu đã sai \((\d+)\)/.exec(e.textContent) || [])[1]);
    await startPracticeVia(st, '#ptWrong');
    const sW = lastStart(log);
    const wrongSet = sW.questions.map((q) => q.noiDung);
    const expWrong = s1.questions.filter((q) => { const el = q; void el; return true; });
    void expWrong;
    verdict('CAU_SAI (giao diện)', +wrongLbl === 3 && sW.questions.length === 3 && (await st.$$('.q')).length === 3,
      `thẻ "Luyện câu đã sai (${wrongLbl})"; đề câu sai ${sW.questions.length} câu (đã sai 2 P1 + 1 P2)`);
    await shot(st, '06-luyen-cau-sai');
    await fillExam(st, sW.questions, () => true);
    const scoreW = await submit(st);
    await st.click('a[href="#/luyen-tap"]'); await st.waitForSelector('#ptWrong'); await st.waitForTimeout(LAT + 400);
    const wrongLbl2 = await st.$eval('.practice-cards', (e) => (/Luyện câu đã sai \((\d+)\)/.exec(e.textContent) || [])[1]);
    verdict('CAU_SAI (giao diện)', scoreW === '10' && +wrongLbl2 === 0, `làm đúng cả 3 → ${scoreW} điểm; thẻ còn "(${wrongLbl2})"`);
    void wrongSet;

    // ---- Đề nhanh ----
    await st.selectOption('#ptQuickBai', 'Bài 9. Định luật Boyle');
    await startPracticeVia(st, '#ptQuick');
    const sQ = lastStart(log);
    const cnt = { TN: 0, DS: 0, TL: 0 }; sQ.questions.forEach((q) => cnt[q.loai]++);
    const timerQ = await st.$eval('#timer', (e) => e.textContent.trim());
    verdict('TC-4.7 (giao diện)', JSON.stringify(cnt) === '{"TN":7,"DS":1,"TL":2}' && sQ.durationSec === 600 && /^(10:00|09:5\d)$/.test(timerQ),
      `Bài 9 → ${JSON.stringify(cnt)}, ${sQ.durationSec} s, đồng hồ ${timerQ}`);
    await submit(st);
    await st.click('a[href="#/luyen-tap"]'); await st.waitForSelector('#ptQuickBai'); await st.waitForTimeout(LAT + 300);
    await st.selectOption('#ptQuickBai', 'Bài 11. Phương trình trạng thái khí lí tưởng');
    await startPracticeVia(st, '#ptQuick');
    const note = await st.$eval('#examNotes', (e) => e.textContent.trim()).catch(() => '');
    const sQ2 = lastStart(log);
    const sameCh = sQ2.questions.every((q) => (BY_ND.get(q.noiDung) || [])[2] === 'Chương II. Khí lí tưởng');
    verdict('TC-4.7 (giao diện)', /Bài này mới có 3 câu Phần I/.test(note) && sQ2.questions.length === 10 && sameCh, `Bài 11 (3·0·0) → ${sQ2.questions.length} câu cùng chương: ${sameCh}; thông báo "${note.slice(0, 160)}"`);
    await shot(st, '07-de-nhanh-thieu-cau');
    await submit(st);

    // ---- Lịch sử: lọc Đề thi / Luyện tập ----
    // 1 bài thi thật để có cả hai loại
    const sTok = (await api(B, 'loginPin', { studentId: 'HS0001', pin: '0101' })).token;
    const sx = await api(B, 'startExam', { token: sTok, examId: 'DEMAU' });
    await api(B, 'submitExam', { token: sTok, attemptToken: sx.attemptToken, answers: { 1: 'C' } });
    await st.click('a[href="#/lich-su"]'); await st.waitForSelector('#histSeg'); await st.waitForTimeout(LAT + 600);
    const hThi = await mainText(st);
    await st.click('#histSeg [data-h="luyen"]'); await st.waitForTimeout(LAT + 600);
    const hLuyen = await mainText(st);
    await shot(st, '08-lich-su-luyen-tap');
    const nLuyenRows = (hLuyen.match(/Tự tạo đề|Luyện câu đã sai|Đề nhanh/g) || []).length;
    verdict('Lịch sử lọc', /Đề mẫu/.test(hThi) && !/Đề nhanh|Tự tạo đề —/.test(hThi) && /Đề nhanh/.test(hLuyen) && !/Đề mẫu — Vật lý 12/.test(hLuyen) && nLuyenRows >= 4,
      `"Đề thi": có Đề mẫu, không có bài luyện; "Luyện tập": ${nLuyenRows} mục bài luyện, không có đề thi`);
    // Bảng xếp hạng không có bài luyện
    await st.click('a[href="#/bang-xep-hang"]'); await st.waitForTimeout(LAT + 900);
    const lbTxt = await mainText(st);
    verdict('TC-4.5 (giao diện)', !/Đề nhanh|Tự tạo đề|Luyện câu đã sai/.test(lbTxt), 'trang Xếp hạng không có bài luyện');

    // ---- Điện thoại ----
    const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const mp = await mctx.newPage(); watchErrors(mp, errors, 'hs-mobile'); await routeCdn(mp);
    await studentLogin(mp, B, '12A1', 'HS0001', '0101');
    await mp.goto(B + '/#/luyen-tap'); await mp.waitForSelector('#ptTree'); await mp.waitForTimeout(LAT + 400);
    const over = await mp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    await shot(mp, '09-luyen-tap-dien-thoai');
    verdict('Điện thoại 390×844', !over, 'trang Luyện tập không tràn ngang: ' + !over);
    await mctx.close();

    // ---- Giáo viên ----
    const actx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    const ad = await actx.newPage(); watchErrors(ad, errors, 'admin'); await routeCdn(ad);
    const dialogs = []; ad.on('dialog', (d) => { dialogs.push(d.message()); d.accept(); });
    // Đề SAU_HAN đang mở chứa X (một câu trong pool)
    const X = 'L12C3B01-P1-00008';
    const xq = (await api(B, 'adminBankToQuestions', { token: tTok, maKho: [X] })).questions;
    await api(B, 'adminSaveExam', { token: tTok, exam: { tieuDe: 'Đề đang thi có X', lop: '', thoiGian: 15, trangThai: 'MO', hienLoiGiai: 'SAU_HAN' }, questions: xq });
    const meta1 = await api(B, 'practiceMeta', { token: sTok });
    const n1 = meta1.cay.reduce((s, c) => s + c.dem.TN + c.dem.DS + c.dem.TL, 0);
    await adminLogin(ad, B, srv.pw);
    await ad.click('a[data-nav="bank"]'); await ad.waitForSelector('#bkInfo'); await ad.waitForTimeout(LAT + 500);
    await ad.fill('#bkQ', X); await ad.press('#bkQ', 'Enter'); await ad.waitForTimeout(LAT + 600);
    await ad.click(`[data-cart="${X}"]`); await ad.waitForTimeout(200);
    await ad.click('#cartPractice');
    await ad.waitForSelector('.modal'); await ad.waitForTimeout(300);
    const modalTxt = await ad.$eval('.modal', (e) => e.textContent.replace(/\s+/g, ' '));
    const mBtns = await ad.$$eval('.modal button', (bs) => bs.map((x) => x.textContent.trim()));
    await shot(ad, '10-dua-vao-luyen-tap-hop-thoai');
    await ad.click('.modal button:has-text("Thêm vào pool")');
    const seen = [];
    for (let i = 0; i < 20; i++) { await ad.waitForTimeout(250); seen.push(await ad.evaluate(() => [...document.querySelectorAll('.modal, .toast')].map((e) => e.textContent.replace(/\s+/g, ' ')).join(' | '))); }
    const after = [...new Set(seen.filter(Boolean))].join(' || ') + ' ' + dialogs.join(' | ');
    await shot(ad, '10b-dua-vao-luyen-tap-ket-qua');
    while (await ad.$('.modal')) { const c = await ad.$('.modal [data-close]'); if (!c) break; await c.click(); await ad.waitForTimeout(300); }
    verdict('Đưa vào luyện tập', new RegExp(X + '|1 câu (đang|đang nằm trong đề)|đang thi', 'i').test(after),
      `hộp thoại: "${modalTxt.slice(0, 200)}" [${mBtns.join(' / ')}]; sau khi bấm "Thêm vào pool": "${after.trim().slice(0, 260)}"`);
    await ad.click('#tabPool'); await ad.waitForSelector('#plList'); await ad.waitForTimeout(LAT + 500);
    await ad.selectOption('#plBat', 'DANG_THI'); await ad.waitForTimeout(LAT + 800);
    const dt = await ad.evaluate(() => [...document.querySelectorAll('#plList .pool-item')].map((e) => ({ ma: e.dataset.ma, badge: /đang thi/.test(e.textContent), luot: (/(\d+) lượt làm/.exec(e.textContent) || [])[1] })));
    await shot(ad, '11-pool-dang-thi');
    verdict('Tab Pool', dt.length === 1 && dt[0].ma === X && dt[0].badge, `lọc "Đang thi" → ${JSON.stringify(dt)}`);
    const n2 = (await api(B, 'practiceMeta', { token: sTok })).cay.reduce((s, c) => s + c.dem.TN + c.dem.DS + c.dem.TL, 0);
    verdict('TC-4.13 (giao diện)', n2 === n1, `HS thấy ${n1} câu trước và ${n2} câu sau khi thêm lại X (X đang bị chặn, không đếm)`);
    // Số lượt làm: lọc "Đang bật", tìm câu có lượt > 0
    await ad.selectOption('#plBat', 'CO'); await ad.waitForTimeout(LAT + 800);
    const luot = await ad.evaluate(() => [...document.querySelectorAll('#plList .pool-item')].map((e) => +(/(\d+) lượt làm/.exec(e.textContent) || [0, 0])[1]));
    verdict('Tab Pool', luot.some((x) => x > 0), `số lượt làm hiển thị (trang 1): tổng ${luot.reduce((a, b) => a + b, 0)}, có câu > 0: ${luot.some((x) => x > 0)}`);
    // Tắt 1 câu bằng nút trên dòng
    const first = await ad.$eval('#plList [data-toggle][data-to="KHONG"]', (e) => e.dataset.toggle);
    await ad.click(`#plList [data-toggle="${first}"]`); await ad.waitForTimeout(LAT + 900);
    const n3 = (await api(B, 'practiceMeta', { token: sTok })).cay.reduce((s, c) => s + c.dem.TN + c.dem.DS + c.dem.TL, 0);
    const lst = await api(B, 'adminPracticeList', { token: tTok, filter: { q: first }, page: 1 });
    const it = (lst.items || []).find((x) => x.maKho === first);
    verdict('Tab Pool bật/tắt', n3 === n2 - 1 && it && /KHONG|false/.test(String(it.bat)), `bấm "Tắt" ${first} → HS thấy ${n2} → ${n3} câu; bat=${it && it.bat}`);
    // Bật lại hàng loạt: lọc Đang tắt → Chọn cả trang → Bật
    await ad.selectOption('#plBat', 'KHONG'); await ad.waitForTimeout(LAT + 800);
    await ad.check('#plAll'); await ad.click('#plOn'); await ad.waitForTimeout(LAT + 1000);
    const n4 = (await api(B, 'practiceMeta', { token: sTok })).cay.reduce((s, c) => s + c.dem.TN + c.dem.DS + c.dem.TL, 0);
    verdict('Tab Pool bật/tắt', n4 === n2, `lọc "Đang tắt" → Chọn cả trang → Bật → HS thấy ${n4} câu`);
    await shot(ad, '12-pool-luyen-tap');
    // Đóng đề → X trở lại
    const ex = (await api(B, 'adminListExams', { token: tTok })).find((e) => e.tieuDe === 'Đề đang thi có X');
    const full = await api(B, 'adminGetExam', { token: tTok, examId: ex.id });
    await api(B, 'adminSaveExam', { token: tTok, exam: Object.assign({}, full.exam, { trangThai: 'DONG' }), questions: full.questions });
    const n5 = (await api(B, 'practiceMeta', { token: sTok })).cay.reduce((s, c) => s + c.dem.TN + c.dem.DS + c.dem.TL, 0);
    verdict('TC-4.13 (giao diện)', n5 === n2 + 1, `đóng đề → HS thấy ${n5} câu (X trở lại)`);
    await actx.close();
    verdict('Không lỗi JS', errors.length === 0, errors.length ? errors.join(' | ').slice(0, 500) : 'không có pageerror / console error (HS + GV)');
    void tBefore;
    await sctx.close();
  } finally { srv.proc.kill(); }
}

// ======================= CHO_LUYEN_TAP=KHONG =======================
async function runOff(browser) {
  const errors = [];
  const srv = await startServer(PORT_OFF, { LATENCY_MS: String(LAT), PRACTICE: '0' });
  try {
    const B = srv.base;
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    const st = await ctx.newPage(); watchErrors(st, errors, 'hs-off'); await routeCdn(st);
    const log = netLog(st);
    await studentLogin(st, B, '12A1', 'HS0001', '0101');
    const nav = await navHasPractice(st);
    const home = await mainText(st);
    await shot(st, '13-tat-luyen-tap-trang-chu');
    await st.goto(B + '/#/luyen-tap'); await st.waitForTimeout(LAT + 900);
    const direct = await mainText(st);
    const hasBuilder = !!(await st.$('#ptTree'));
    const calls = log.filter((e) => /practice/.test(e.action)).map((e) => e.action + ':' + (JSON.parse(e.body).ok ? 'ok' : JSON.parse(e.body).error));
    verdict('TC-4.10 (giao diện)', !nav && !/Vào luyện/.test(home) && !hasBuilder, `CHO_LUYEN_TAP=KHONG: điều hướng có Luyện tập: ${nav}; thẻ trên trang chủ: ${/Vào luyện/.test(home)}; mở thẳng #/luyen-tap → "${direct.slice(0, 120)}" (có cây chọn bài: ${hasBuilder}); lời gọi luyện tập: ${calls.join(', ') || 'không'}`);
    await shot(st, '14-tat-luyen-tap-mo-thang');
    // các trang khác
    const pages = ['#/', '#/lich-su', '#/thong-ke', '#/bang-xep-hang'];
    const res = [];
    for (const h of pages) { const e0 = errors.length; await st.goto(B + '/' + h); await st.waitForTimeout(LAT + 700); res.push(h + ':' + (errors.length === e0 && (await mainText(st)).length > 20 ? 'ok' : 'LỖI')); }
    const hist = !!(await st.$('#histSeg'));
    verdict('TC-4.10 (giao diện)', res.every((x) => /ok$/.test(x)), `các trang khác: ${res.join(' ')}; Lịch sử có bộ lọc Đề thi/Luyện tập: ${hist}`);
    const ad = await ctx.newPage(); watchErrors(ad, errors, 'admin-off'); await routeCdn(ad);
    await adminLogin(ad, B, srv.pw);
    await ad.click('a[data-nav="bank"]'); await ad.waitForTimeout(LAT + 900);
    const pool = !!(await ad.$('#tabPool'));
    if (pool) { await ad.click('#tabPool'); await ad.waitForTimeout(LAT + 900); }
    const pt = await mainText(ad);
    await shot(ad, '15-tat-luyen-tap-tab-pool');
    verdict('TC-4.10 (giao diện)', true, `quản trị khi tắt: có tab Pool ${pool}; ghi chú: "${(/[^.]*(tắt|CHO_LUYEN_TAP)[^.]*\./i.exec(pt) || [''])[0].slice(0, 160)}"`);
    verdict('Không lỗi JS (tắt luyện tập)', errors.length === 0, errors.join(' | ').slice(0, 400) || 'không có lỗi JS');
    await ctx.close();
  } finally { srv.proc.kill(); }
}

// ======================= Máy chủ 1.0.0 =======================
async function runCompat(browser) {
  const errors = [];
  const srv = await startServer(PORT_OLD, { LATENCY_MS: String(LAT), SERVER_COMPAT: '1.0.0' });
  try {
    const B = srv.base;
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    const st = await ctx.newPage(); watchErrors(st, errors, 'hs-1.0.0'); await routeCdn(st);
    const toasts = [];
    await st.exposeBinding('__kt4Toast', (_s, t) => toasts.push(t));
    await st.addInitScript(() => {
      const seen = new WeakSet();
      new MutationObserver(() => document.querySelectorAll('.toast.err').forEach((el) => { if (!seen.has(el)) { seen.add(el); window.__kt4Toast(el.textContent.trim()); } }))
        .observe(document, { childList: true, subtree: true });
    });
    const log = netLog(st);
    await studentLogin(st, B, '12A1', 'HS0001', '0101');
    const nav = await navHasPractice(st);
    const home = await mainText(st);
    await shot(st, '16-may-chu-1.0.0-trang-chu');
    await st.goto(B + '/#/luyen-tap'); await st.waitForTimeout(LAT + 900);
    const hasBuilder = !!(await st.$('#ptTree'));
    verdict('TC-4.10 / 1.0.0', !nav && !/Vào luyện/.test(home) && !hasBuilder, `máy chủ 1.0.0: điều hướng có Luyện tập ${nav}; thẻ trang chủ ${/Vào luyện/.test(home)}; #/luyen-tap có cây chọn bài ${hasBuilder}`);
    const res = [];
    for (const h of ['#/', '#/lich-su', '#/thong-ke', '#/bang-xep-hang']) { const e0 = errors.length; const t0 = toasts.length; await st.goto(B + '/' + h); await st.waitForTimeout(LAT + 800); res.push(h + ':' + (errors.length === e0 && toasts.length === t0 && (await mainText(st)).length > 20 ? 'ok' : 'LỖI')); }
    const histSeg = await st.$('#histSeg');
    let histNote = 'không có bộ lọc';
    if (histSeg) { const t0 = toasts.length; const b = await st.$('#histSeg [data-h="luyen"]'); if (b) { await b.click(); await st.waitForTimeout(LAT + 700); } histNote = `có bộ lọc; bấm "Luyện tập": toast đỏ ${toasts.length - t0}`; }
    // làm đề mẫu bình thường
    await st.goto(B + '/#/lam-bai/DEMAU'); await st.waitForSelector('#btnStart', { timeout: 10000 });
    if (await st.$('[data-goal="8"]')) await st.click('[data-goal="8"]');
    await st.click('#btnStart'); await st.waitForSelector('#btnSubmit');
    const score = await submit(st);
    const practiceCalls = log.filter((e) => /practice/.test(e.action)).map((e) => e.action);
    verdict('TC-4.10 / 1.0.0', res.every((x) => /ok$/.test(x)) && score === '0' && !toasts.length, `trang khác: ${res.join(' ')}; Lịch sử: ${histNote}; làm đề mẫu nộp trắng → ${score} điểm; lời gọi practice*: ${practiceCalls.join(',') || 'không'}; toast đỏ: ${toasts.join(' | ') || 'không'}`);
    await shot(st, '17-may-chu-1.0.0-lich-su');
    const ad = await ctx.newPage(); watchErrors(ad, errors, 'admin-1.0.0'); await routeCdn(ad);
    await adminLogin(ad, B, srv.pw);
    await ad.click('a[data-nav="bank"]'); await ad.waitForTimeout(LAT + 900);
    const at = await mainText(ad);
    verdict('TC-4.10 / 1.0.0', /Cần cập nhật máy chủ/.test(at) && !(await ad.$('#tabPool')) && !(await ad.$('#cartPractice')), `tab Ngân hàng: "${at.slice(0, 100)}"; không có tab Pool / nút Đưa vào luyện tập`);
    verdict('Không lỗi JS (1.0.0)', errors.length === 0, errors.join(' | ').slice(0, 400) || 'không có lỗi JS');
    await ctx.close();
  } finally { srv.proc.kill(); }
}

(async () => {
  const browser = await chromium.launch();
  try {
    if (MODE === 'new' || MODE === 'all') { console.log('— Máy chủ mới —'); await runNew(browser); }
    if (MODE === 'off' || MODE === 'all') { console.log('— CHO_LUYEN_TAP=KHONG (PRACTICE=0) —'); await runOff(browser); }
    if (MODE === 'compat' || MODE === 'all') { console.log('— Máy chủ 1.0.0 —'); await runCompat(browser); }
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
