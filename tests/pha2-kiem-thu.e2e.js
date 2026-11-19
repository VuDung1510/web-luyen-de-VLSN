// Kiểm thử độc lập Pha 2 (người kiểm thử) — giao diện quản trị + học sinh, viết theo docs/spec/pha-2-ngan-hang.md.
// Tự chạy dev-server (máy chủ mới có kho giả, và SERVER_COMPAT=1.0.0).
//   NODE_PATH=$(npm root -g) LIBS_DIR=... node tests/pha2-kiem-thu.e2e.js [new|compat|all]
// Biến môi trường: PORT_NEW (8792), PORT_OLD (8793), LATENCY_MS (200), SHOTS (docs/bao-cao/anh/pha-2; ảnh tên kt-*.png).
// Bao phủ: lọc, giỏ câu, Lấy đề gốc, Ma trận 1 chạm (đủ/thiếu), Tạo đề → trình soạn → lưu → học sinh làm đề
// (đáp án/mã kho không tới trình duyệt học sinh), TC-2.12 ([BẢNG] 2 cột × 5 hàng), TC-2.14 (máy chủ 1.0.0).
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const K = require('./fixtures/kho-gia');

const MODE = process.argv[2] || 'all';
const LAT = +(process.env.LATENCY_MS || 200);
const PORT_NEW = +(process.env.PORT_NEW || 8792);
const PORT_OLD = +(process.env.PORT_OLD || 8793);
const SHOTS = process.env.SHOTS || path.join(__dirname, '..', 'docs', 'bao-cao', 'anh', 'pha-2');
const LIBS = process.env.LIBS_DIR;
fs.mkdirSync(SHOTS, { recursive: true });

const R = { tc: {} };
function verdict(tc, pass, evidence) {
  const e = R.tc[tc] || { pass: true, evidence: [] };
  e.pass = e.pass && !!pass; e.evidence.push((pass ? 'OK  ' : 'FAIL ') + evidence); R.tc[tc] = e;
  console.log(`  ${pass ? '✓' : '✗'} ${tc}: ${evidence}`);
}
const shot = (page, name, opts) => page.screenshot(Object.assign({ path: path.join(SHOTS, 'kt-' + name + '.png') }, opts || {}));

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
async function adminLogin(page, base, pw) {
  await page.goto(base + '/admin.html');
  await page.fill('#pw', pw);
  await page.click('#btnLogin');
  await page.waitForSelector('text=Bài nộp mới nhất');
}
const listCount = async (ad) => {
  await ad.waitForTimeout(150);
  await ad.waitForFunction(() => /câu phù hợp/.test((document.querySelector('#bkList') || {}).textContent || ''));
  const t = await ad.$eval('#bkList', (e) => e.textContent);
  return +(/(\d+)\s*câu phù hợp/.exec(t) || [])[1];
};
const settle = (ad) => ad.waitForLoadState('networkidle').catch(() => {}).then(() => ad.waitForTimeout(LAT + 250));
const cartText = (ad) => ad.$eval('#cartCount', (e) => e.textContent.trim()).catch(() => '');
const normTF = (s) => String(s || '').toUpperCase().replace(/Đ/g, 'D').replace(/[^DS]/g, '');

async function runNew(browser) {
  const errors = [];
  const srv = await startServer(PORT_NEW, { LATENCY_MS: String(LAT) });
  try {
    const B = srv.base;
    const tTok = (await api(B, 'loginAdminPassword', { password: srv.pw })).token;
    const rows = K.standardRows(); // cùng kho dev-server nạp (tất định)
    const byMa = Object.fromEntries(rows.map((r) => [r[0], r]));
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    const ad = await ctx.newPage();
    watchErrors(ad, errors, 'admin');
    await routeCdn(ad);
    await adminLogin(ad, B, srv.pw);

    // ---------- Tab Ngân hàng + lọc ----------
    await ad.click('a[data-nav="bank"]');
    await ad.waitForSelector('#bkInfo');
    const total = await listCount(ad);
    const infoTxt = await ad.$eval('#bkInfo', (e) => e.textContent.replace(/\s+/g, ' '));
    verdict('Lọc', total === 47 && /54/.test(infoTxt) && /47/.test(infoTxt), `không lọc: ${total} câu; dòng thống kê "${infoTxt.slice(0, 90)}…"`);
    await shot(ad, '01-ngan-hang');
    // Dạng: Phần II
    await ad.check('input[data-f="loai"][value="DS"]'); await settle(ad);
    let n = await listCount(ad);
    let badges = await ad.$$eval('#bkList .bank-item', (els) => els.map((e) => e.querySelector('.badge').textContent));
    verdict('Lọc', n === 7 && badges.every((b) => /P2/.test(b)), `Dạng = Phần II → ${n} câu (mong 7), nhãn: ${[...new Set(badges)].join(',')}`);
    // + Lớp 11
    await ad.selectOption('#bkLop', 'Lớp 11'); await settle(ad);
    n = await listCount(ad);
    verdict('Lọc', n === 1, `Phần II + Lớp 11 → ${n} câu (mong 1)`);
    await ad.click('#bkClear'); await settle(ad);
    n = await listCount(ad);
    verdict('Lọc', n === 47, `Bỏ lọc → ${n} câu`);
    // Mức độ VD + Phần III
    await ad.check('input[data-f="mucDo"][value="VD"]'); await ad.check('input[data-f="loai"][value="TL"]'); await settle(ad);
    n = await listCount(ad);
    const expVD = rows.filter((r) => /Phần III/.test(r[4]) && r[5] === 'Vận dụng' && r[13] && r[16] !== 'Nguồn mẫu E').length;
    verdict('Lọc', n === expVD, `Mức độ Vận dụng + Phần III → ${n} câu (kho giả có ${expVD})`);
    await ad.click('#bkClear'); await settle(ad);
    // Chương → Bài
    const ch = 'Chương II. Khí lí tưởng';
    await ad.check(`input[data-f="chuong"][value="${ch}"]`); await settle(ad);
    n = await listCount(ad);
    const expCh = rows.filter((r) => r[2] === ch && r[13] && !/Phần IV/.test(r[4]) && r[16] !== 'Nguồn mẫu E').length;
    verdict('Lọc', n === expCh, `Chương "${ch}" → ${n} câu (kho giả có ${expCh})`);
    await ad.click('#bkClear'); await settle(ad);
    // Tìm chữ (mã câu)
    await ad.fill('#bkQ', 'P3-00026'); await ad.press('#bkQ', 'Enter'); await settle(ad);
    n = await listCount(ad);
    const maTL = await ad.$$eval('#bkList .bank-item', (els) => els.map((e) => e.dataset.ma));
    verdict('Lọc', n === 1 && /P3-00026$/.test(maTL[0] || ''), `Tìm "P3-00026" → ${n} câu ${maTL.join(',')}`);
    await ad.click('#bkClear'); await settle(ad);

    // ---------- TC-2.12 [BẢNG] ----------
    await ad.fill('#bkQ', 'nhiệt dung riêng của một số chất'); await ad.press('#bkQ', 'Enter'); await settle(ad);
    const tblMa = rows.find((r) => /\[BẢNG\]/.test(r[8]))[0];
    await ad.click(`[data-view="${tblMa}"]`);
    await ad.waitForSelector('.modal table', { timeout: 10000 }).catch(() => {});
    const tbl = await ad.evaluate(() => {
      const t = document.querySelector('.modal table');
      if (!t) return null;
      const trs = [...t.querySelectorAll('tr')];
      return { rows: trs.length, cols: trs.map((r) => r.children.length), first: trs[0] && trs[0].textContent.trim(), raw: /\[BẢNG\]/.test(t.closest('.modal').textContent) };
    });
    verdict('TC-2.12', tbl && tbl.rows === 5 && tbl.cols.every((c) => c === 2) && !tbl.raw, `"Xem đầy đủ" câu ${tblMa}: ${JSON.stringify(tbl)}`);
    await shot(ad, '02-bang');
    await ad.click('.modal [data-close]').catch(() => ad.keyboard.press('Escape'));
    await ad.waitForTimeout(300);
    await ad.click('#bkClear'); await settle(ad);

    // ---------- Giỏ câu ----------
    const items = await ad.$$eval('#bkList [data-cart]', (els) => els.slice(0, 3).map((e) => e.dataset.cart));
    for (const m of items) { await ad.click(`[data-cart="${m}"]`); await ad.waitForTimeout(100); }
    let ct = await cartText(ad);
    verdict('Giỏ câu', /P1 3 · P2 0 · P3 0/.test(ct), `thêm 3 câu P1 → "${ct}"`);
    await ad.click(`[data-cart="${items[0]}"]`); await ad.waitForTimeout(150);
    ct = await cartText(ad);
    verdict('Giỏ câu', /P1 2/.test(ct), `bấm lại 1 câu (bỏ khỏi giỏ) → "${ct}"`);
    await ad.reload(); await ad.waitForSelector('#bkInfo'); await settle(ad);
    ct = await cartText(ad);
    verdict('Giỏ câu', /P1 2/.test(ct), `tải lại trang, giỏ còn → "${ct}"`);
    await ad.click('#cartClear'); await ad.waitForTimeout(300);
    if (await ad.$('.modal [data-close="ok"]')) { await ad.click('.modal [data-close="ok"]'); await ad.waitForTimeout(300); }
    ct = await cartText(ad);
    verdict('Giỏ câu', !/P1 [1-9]/.test(ct), `Xóa giỏ → "${ct || '(ẩn)'}"`);

    // ---------- Lấy đề gốc (Nguồn mẫu B: số câu nhảy + 1 câu chưa có đáp án) ----------
    const srcBtnDisabled = await ad.$eval('#bkSource', (b) => b.disabled);
    await ad.selectOption('#bkNguon', 'Nguồn mẫu B'); await settle(ad);
    await ad.click('#bkSource');
    await ad.waitForSelector('.modal');
    await ad.waitForTimeout(300);
    const srcTxt = await ad.$eval('.modal', (e) => e.textContent.replace(/\s+/g, ' '));
    verdict('Lấy đề gốc', srcBtnDisabled && /5[–-]11/.test(srcTxt) && /13/.test(srcTxt) && /(chưa có đáp án|không có đáp án)/i.test(srcTxt) && /Câu 4|câu 4|P1 Câu 4/.test(srcTxt),
      `nút tắt khi chưa chọn Nguồn: ${srcBtnDisabled}; hộp: "${srcTxt.slice(0, 260)}"`);
    await shot(ad, '03-de-goc-thieu');
    await ad.click('.modal [data-close="ok"]'); await ad.waitForTimeout(400);
    ct = await cartText(ad);
    verdict('Lấy đề gốc', /P1 6 · P2 2 · P3 1/.test(ct), `nạp vào giỏ → "${ct}"`);
    await ad.click('#cartClear'); await ad.waitForTimeout(300);
    if (await ad.$('.modal [data-close="ok"]')) { await ad.click('.modal [data-close="ok"]'); await ad.waitForTimeout(300); }
    await ad.click('#bkClear'); await settle(ad);

    // ---------- Ma trận thiếu (Lớp 11) → không âm thầm tạo đề thiếu ----------
    await ad.selectOption('#bkLop', 'Lớp 11'); await settle(ad);
    await ad.click('#bkMatrix'); await ad.waitForSelector('.modal'); await ad.waitForTimeout(300);
    const mxTxt = await ad.$eval('.modal', (e) => e.textContent.replace(/\s+/g, ' '));
    const okShort = /Phần I.*thiếu 17/.test(mxTxt) && /Phần II.*thiếu 3/.test(mxTxt) && /Phần III.*thiếu 5/.test(mxTxt);
    await ad.click('.modal [data-close=""]'); await ad.waitForTimeout(300);
    ct = await cartText(ad);
    verdict('Ma trận 1 chạm', okShort && !/P[123] [1-9]/.test(ct), `Lớp 11, 18–4–6 → hộp "${mxTxt.slice(0, 200)}"; bấm Hủy → giỏ "${ct || '(trống)'}"`);

    // ---------- Ma trận đủ (Lớp 12) → Tạo đề → trình soạn ----------
    await ad.selectOption('#bkLop', 'Lớp 12'); await settle(ad);
    await ad.click('#bkMatrix'); await ad.waitForSelector('.modal'); await ad.waitForTimeout(300);
    const mx2 = await ad.$eval('.modal', (e) => e.textContent.replace(/\s+/g, ' '));
    await ad.click('.modal [data-close="ok"]'); await ad.waitForTimeout(400);
    ct = await cartText(ad);
    verdict('Ma trận 1 chạm', /P1 18 · P2 4 · P3 6/.test(ct) && !/thiếu/.test(mx2), `Lớp 12, 18–4–6 → "${mx2.slice(0, 120)}"; giỏ "${ct}"`);
    await ad.click('#cartMake');
    await ad.waitForSelector('.qedit', { timeout: 30000 });
    await ad.waitForTimeout(500);
    const ed = await ad.evaluate(() => ({
      n: document.querySelectorAll('.qedit').length,
      note: (document.querySelector('#draftNote') || {}).textContent || '',
      kho: [...document.querySelectorAll('.qedit')].map((q) => ((q.textContent.match(/Kho: (\S+)/) || [])[1]) || ''),
      img: [...document.querySelectorAll('.qedit input[data-f="hinhAnh"]')].map((i) => i.value),
      url: location.hash
    }));
    const imgOk = ed.kho.every((ma, i) => {
      const r = byMa[ma]; if (!r) return false;
      const want = /^Có/.test(r[15]) && r[0] !== 'L12C2B01-P1-00036'; // hình thiếu trên Drive giả
      return want ? /^https:\/\/lh3\.googleusercontent\.com\/d\//.test(ed.img[i]) : !ed.img[i] || /lh3/.test(ed.img[i]);
    });
    verdict('Tạo đề', ed.n === 28 && /chưa được lưu/.test(ed.note) && ed.kho.every((k) => byMa[k]) && /de-thi\/moi/.test(ed.url),
      `trình soạn ${ed.n} câu, ghi chú "${ed.note.trim().slice(0, 80)}", mọi câu có nhãn Kho: ${ed.kho.every(Boolean)}`);
    verdict('Tạo đề', imgOk, `câu có hình trong kho → ô hình là URL bản chép lh3…/d/<id> (${ed.img.filter(Boolean).length} câu có hình)`);
    // chưa lưu: đề chưa có trên máy chủ
    const before = await api(B, 'adminListExams', { token: tTok });
    await ad.fill('#eTitle', 'Đề từ kho — kiểm thử Pha 2');
    await ad.fill('#eClass', '12A1');
    await ad.selectOption('#eStatus', 'MO');
    await ad.selectOption('#eReveal', 'SAU_HAN');
    await ad.evaluate(() => { const i = [...document.querySelectorAll('.qedit input[data-f="hinhAnh"]')].find((x) => x.value); (i ? i.closest('.qedit') : document.querySelector('.qedit')).scrollIntoView({ block: 'start' }); window.scrollBy(0, -70); });
    await ad.waitForTimeout(300);
    await shot(ad, '04-trinh-soan');
    await ad.click('#btnSave');
    await ad.waitForSelector('text=Đã lưu đề', { timeout: 15000 }).catch(() => {});
    await settle(ad);
    const after = await api(B, 'adminListExams', { token: tTok });
    const exNew = after.find((e) => e.tieuDe === 'Đề từ kho — kiểm thử Pha 2');
    verdict('Tạo đề', before.length + 1 === after.length && exNew, `trước khi Lưu: ${before.length} đề; sau khi Lưu: ${after.length} đề`);
    const full = await api(B, 'adminGetExam', { token: tTok, examId: exNew.id });
    const mism = full.questions.filter((q) => {
      const r = byMa[q.maKho]; if (!r) return true;
      if (q.loai === 'TN') return q.dapAn !== r[13];
      if (q.loai === 'DS') { const m = r[13].match(/([a-d])\)\s*(Đúng|Sai|Đ|S)/gi).map((x) => /Đ|Đúng/i.test(x.replace(/^[a-d]\)\s*/i, '')) ? 'D' : 'S'); return normTF(q.dapAn) !== m.join(''); }
      return q.dapAn !== r[13];
    });
    verdict('Tạo đề', full.questions.length === 28 && !mism.length, `đề đã lưu: ${full.questions.length} câu, đáp án khác kho: ${mism.map((q) => q.maKho).join(',') || 'không'}`);

    // ---------- Học sinh làm đề vừa tạo ----------
    const sctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    const st = await sctx.newPage();
    watchErrors(st, errors, 'hs');
    await routeCdn(st);
    const bodies = [];
    st.on('response', async (res) => { if (/\/exec/.test(res.url())) { try { bodies.push([Date.now(), await res.text()]); } catch (e) { /* bỏ qua */ } } });
    await st.goto(B + '/');
    await st.waitForSelector('#selClass option[value="12A1"]', { state: 'attached' });
    await st.selectOption('#selClass', '12A1');
    await st.waitForSelector('#selStudent option[value="HS0001"]', { state: 'attached' });
    await st.selectOption('#selStudent', 'HS0001');
    await st.fill('#pin', '0101');
    await st.click('#btnLogin');
    await st.waitForSelector('text=Đề từ kho — kiểm thử Pha 2');
    await st.goto(B + '/#/lam-bai/' + exNew.id).catch(() => {});
    if (!(await st.$('#btnStart'))) {
      await st.goto(B + '/');
      const card = st.locator('.card', { hasText: 'Đề từ kho — kiểm thử Pha 2' }).last();
      await card.locator('text=Bắt đầu làm bài').first().click();
    }
    await st.waitForSelector('#btnStart');
    if (await st.$('[data-goal="8"]')) await st.click('[data-goal="8"]');
    await st.click('#btnStart');
    await st.waitForSelector('.timer');
    await st.waitForTimeout(500);
    const qEls = await st.$$('.q');
    const qs = full.questions.slice().sort((a, b) => (a.stt || 0) - (b.stt || 0));
    let filled = 0;
    for (let i = 0; i < qs.length && i < qEls.length; i++) {
      const q = qs[i];
      if (q.loai === 'TN') { const b = await qEls[i].$(`[data-opt="${q.dapAn}"]`); if (b) { await b.click(); filled++; } }
      else if (q.loai === 'DS') { const tf = normTF(q.dapAn).split(''); let k = 0; for (let j = 0; j < 4; j++) { const b = await qEls[i].$(`[data-tf="${j}:${tf[j]}"]`); if (b) { await b.click(); k++; } } if (k === 4) filled++; }
      else { const inp = await qEls[i].$('input'); if (inp) { await inp.fill(String(q.dapAn).split('|')[0]); filled++; } }
    }
    await shot(st, '05-hoc-sinh-lam-bai');
    const tBeforeSubmit = Date.now();
    const storage = await st.evaluate(() => JSON.stringify(Object.assign({}, localStorage)) + JSON.stringify(Object.assign({}, sessionStorage)));
    await st.click('#btnSubmit');
    await st.click('[data-close="ok"]');
    await st.waitForSelector('.score-ring', { timeout: 20000 });
    await st.waitForTimeout(300);
    const score = await st.$eval('.score-ring b', (e) => e.textContent.trim());
    verdict('Học sinh làm đề', qEls.length === 28 && filled === 28 && score === '10', `trang học sinh: ${qEls.length} câu, điền ${filled}, điểm "${score}"`);
    const maList = full.questions.map((q) => q.maKho);
    const leakKeys = /"(dapAn|loiGiai|maKho|mucDoY)"/;
    const pre = bodies.filter(([t]) => t <= tBeforeSubmit).map(([, b]) => b);
    const all = bodies.map(([, b]) => b);
    const leakPre = pre.filter((b) => leakKeys.test(b) || maList.some((m) => b.includes(m)));
    const leakAll = all.filter((b) => /"(maKho|mucDoY)"/.test(b) || maList.some((m) => b.includes(m)));
    const leakStore = leakKeys.test(storage) || maList.some((m) => storage.includes(m));
    verdict('TC-2.10 (giao diện)', !leakPre.length && !leakAll.length && !leakStore,
      `${pre.length} phản hồi máy chủ trước khi nộp: không có dapAn/loiGiai/maKho/mucDoY/mã câu kho (${leakPre.length} vi phạm); cả sau khi nộp không có maKho/mucDoY (${leakAll.length}); kho lưu trình duyệt sạch: ${!leakStore}`);
    await sctx.close();

    verdict('Không lỗi JS', errors.length === 0, errors.length ? errors.join(' | ').slice(0, 500) : 'không có pageerror / console error (quản trị + học sinh)');
    await ctx.close();
  } finally {
    srv.proc.kill();
  }
}

async function runCompat(browser) {
  const errors = [];
  const srv = await startServer(PORT_OLD, { SERVER_COMPAT: '1.0.0', LATENCY_MS: String(LAT) });
  try {
    const B = srv.base;
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    const ad = await ctx.newPage();
    watchErrors(ad, errors, 'admin(1.0.0)');
    const toasts = [];
    await ad.exposeBinding('__kt2Toast', (_s, t) => toasts.push(t));
    await ad.addInitScript(() => {
      const seen = new WeakSet();
      new MutationObserver(() => document.querySelectorAll('.toast.err').forEach((el) => { if (!seen.has(el)) { seen.add(el); window.__kt2Toast(el.textContent.trim()); } }))
        .observe(document, { childList: true, subtree: true });
    });
    await routeCdn(ad);
    await adminLogin(ad, B, srv.pw);
    await ad.click('a[data-nav="bank"]');
    await ad.waitForSelector('text=Cần cập nhật máy chủ', { timeout: 10000 }).catch(() => {});
    await ad.waitForTimeout(500);
    const txt = await ad.$eval('main', (e) => e.textContent.replace(/\s+/g, ' '));
    const noTools = !(await ad.$('#bkMatrix')) && !(await ad.$('#cartMake'));
    verdict('TC-2.14', /Cần cập nhật máy chủ/.test(txt) && noTools, `tab Ngân hàng: "${txt.slice(0, 120)}"; không có nút Ma trận/Tạo đề: ${noTools}`);
    await shot(ad, '06-may-chu-cu');
    const tabs = ['home', 'exams', 'students', 'results', 'gradebook', 'settings'];
    const tabRes = [];
    for (const tb of tabs) {
      const e0 = errors.length; const t0 = toasts.length;
      await ad.click(`a[data-nav="${tb}"]`);
      await ad.waitForTimeout(LAT + 900);
      const h = await ad.$eval('main', (e) => e.textContent.trim().length);
      tabRes.push(`${tb}:${errors.length === e0 && toasts.length === t0 && h > 20 ? 'ok' : 'LỖI'}`);
    }
    const setTxt = await ad.$eval('main', (e) => e.textContent);
    verdict('TC-2.14', tabRes.every((x) => /ok$/.test(x)) && !/KHO_CAU_HOI_ID|Kho câu hỏi/.test(setTxt), `6 tab khác: ${tabRes.join(' ')}; Cài đặt không có ô kho: ${!/KHO_CAU_HOI_ID|Kho câu hỏi/.test(setTxt)}`);
    // Đề mẫu vẫn mở/sửa được, trình soạn không lỗi
    await ad.goto(B + '/admin.html#/de-thi/sua/DEMAU');
    await ad.waitForTimeout(LAT + 1200);
    const nq = await ad.$$eval('.qedit', (e) => e.length);
    verdict('TC-2.14', nq === 6, `máy chủ 1.0.0: trình soạn đề mẫu ${nq} câu`);
    verdict('Không lỗi JS (1.0.0)', errors.length === 0 && toasts.length === 0, (errors.concat(toasts)).join(' | ').slice(0, 400) || 'không có lỗi JS / toast đỏ');
    await ctx.close();
  } finally {
    srv.proc.kill();
  }
}

// ---------- Vòng 2: cảnh báo thiếu hình trước khi lưu; giới hạn 500; chuyển màn khi tab Ngân hàng đang tải ----------
const PORT_V2 = +(process.env.PORT_V2 || 8794);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function delayActions(page, re, ms) {
  await page.route(/\/exec$/, async (route) => {
    const body = route.request().postData() || '';
    if (re.test(body)) await sleep(ms);
    route.continue();
  });
}
async function newAdmin(browser, srv, errors, tag) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const ad = await ctx.newPage();
  watchErrors(ad, errors, tag);
  ad.on('dialog', (d) => d.accept());
  await routeCdn(ad);
  await adminLogin(ad, srv.base, srv.pw);
  return { ctx, ad };
}
async function runV2(browser) {
  const errors = [];
  // A + C trên kho chuẩn
  let srv = await startServer(PORT_NEW, { LATENCY_MS: String(LAT) });
  try {
    const B = srv.base;
    const tTok = (await api(B, 'loginAdminPassword', { password: srv.pw })).token;
    // A. Câu kho ghi có hình nhưng không có hình → cảnh báo trong trình soạn, trước khi lưu
    let { ctx, ad } = await newAdmin(browser, srv, errors, 'v2-A');
    await ad.click('a[data-nav="bank"]'); await ad.waitForSelector('#bkInfo'); await listCount(ad);
    for (const m of ['L12C2B01-P1-00036', 'L12C3B01-P1-00002']) {
      await ad.fill('#bkQ', m); await ad.press('#bkQ', 'Enter'); await settle(ad);
      await ad.click(`[data-cart="${m}"]`); await ad.waitForTimeout(150);
    }
    const nExam = (await api(B, 'adminListExams', { token: tTok })).length;
    await ad.click('#cartMake');
    await ad.waitForSelector('.qedit', { timeout: 30000 }); await ad.waitForTimeout(500);
    const w = await ad.evaluate(() => {
      const qe = [...document.querySelectorAll('.qedit')];
      const miss = qe.find((q) => /L12C2B01-P1-00036/.test(q.textContent));
      const okq = qe.find((q) => /L12C3B01-P1-00002/.test(q.textContent));
      const top = (document.querySelector('main').textContent.split('Tên đề')[0] || '').replace(/\s+/g, ' ');
      return { top, missLabel: miss ? /chưa có hình/.test(miss.textContent) : null, okLabel: okq ? /chưa có hình/.test(okq.textContent) : null,
        missImg: miss ? (miss.querySelector('input[data-f="hinhAnh"]') || {}).value : null };
    });
    const nExam2 = (await api(B, 'adminListExams', { token: tTok })).length;
    verdict('V2 cảnh báo thiếu hình', /L12C2B01-P1-00036/.test(w.top) && w.missLabel === true && w.okLabel === false && !w.missImg && nExam2 === nExam,
      `đầu trình soạn: "${w.top.slice(0, 200)}"; nhãn trên câu thiếu hình: ${w.missLabel}, trên câu có hình: ${w.okLabel}; đề chưa lưu (${nExam}→${nExam2})`);
    await ctx.close();

    // C1. Mở Ngân hàng (máy chủ chậm 2,5 s) → sang trình soạn, gõ tên đề → sau 3,5 s tên vẫn còn
    ({ ctx, ad } = await newAdmin(browser, srv, errors, 'v2-C1'));
    await delayActions(ad, /adminBank/, 2500);
    await ad.click('a[data-nav="bank"]'); await ad.waitForTimeout(300);
    await ad.goto(B + '/admin.html#/de-thi/moi'); await ad.waitForSelector('#eTitle');
    await ad.fill('#eTitle', 'Đề đang soạn dở');
    await ad.waitForTimeout(3500);
    let st = await ad.evaluate(() => ({ t: (document.querySelector('#eTitle') || {}).value, modal: !!document.querySelector('.modal'), hash: location.hash }));
    verdict('V2 chuyển màn khi Ngân hàng đang tải', st.t === 'Đề đang soạn dở' && !st.modal && /de-thi\/moi/.test(st.hash), `đọc kho lần đầu → sang Tạo đề mới: ${JSON.stringify(st)}`);
    // C2. Bấm "Đọc lại kho" (chậm) → sang trình soạn → tên còn
    await ad.click('a[data-nav="bank"]'); await ad.waitForSelector('#bkReload', { timeout: 15000 }); await ad.waitForTimeout(3000);
    await ad.click('#bkReload'); await ad.waitForTimeout(300);
    await ad.goto(B + '/admin.html#/de-thi/moi'); await ad.waitForSelector('#eTitle');
    await ad.fill('#eTitle', 'Đề soạn dở 2'); await ad.waitForTimeout(3500);
    st = await ad.evaluate(() => ({ t: (document.querySelector('#eTitle') || {}).value, modal: !!document.querySelector('.modal'), hash: location.hash }));
    verdict('V2 chuyển màn khi Ngân hàng đang tải', st.t === 'Đề soạn dở 2' && !st.modal && /de-thi\/moi/.test(st.hash), `"Đọc lại kho" → sang Tạo đề mới: ${JSON.stringify(st)}`);
    // C3. Ma trận (chậm) → rời tab trước khi xong → không bật hộp ma trận đè lên trình soạn
    await ad.click('a[data-nav="bank"]'); await ad.waitForSelector('#bkMatrix', { timeout: 15000 }); await ad.waitForTimeout(3000);
    await ad.selectOption('#bkLop', 'Lớp 12'); await ad.waitForTimeout(3000);
    await ad.click('#bkMatrix'); await ad.waitForTimeout(300);
    await ad.goto(B + '/admin.html#/de-thi/moi'); await ad.waitForSelector('#eTitle');
    await ad.fill('#eTitle', 'Đề soạn dở 3'); await ad.waitForTimeout(3500);
    st = await ad.evaluate(() => ({ t: (document.querySelector('#eTitle') || {}).value, modal: !!document.querySelector('.modal'), hash: location.hash }));
    verdict('V2 chuyển màn khi Ngân hàng đang tải', st.t === 'Đề soạn dở 3' && !st.modal, `Ma trận đang chạy → sang Tạo đề mới: ${JSON.stringify(st)}`);
    // C4. Tạo đề (chậm) → rời sang trình soạn trống, gõ tên → không bị trình soạn của giỏ đè
    await ad.click('a[data-nav="bank"]'); await ad.waitForSelector('#bkList [data-cart]', { timeout: 15000 }); await ad.waitForTimeout(3000);
    const one = await ad.$eval('#bkList [data-cart]', (e) => e.dataset.cart);
    await ad.click(`[data-cart="${one}"]`); await ad.waitForTimeout(200);
    await ad.click('#cartMake'); await ad.waitForTimeout(300);
    await ad.goto(B + '/admin.html#/de-thi/moi'); await ad.waitForSelector('#eTitle');
    await ad.fill('#eTitle', 'Đề soạn dở 4'); await ad.waitForTimeout(3800);
    st = await ad.evaluate(() => ({ t: (document.querySelector('#eTitle') || {}).value, n: document.querySelectorAll('.qedit').length, note: !!document.querySelector('#draftNote'), modal: !!document.querySelector('.modal') }));
    verdict('V2 chuyển màn khi Ngân hàng đang tải', st.t === 'Đề soạn dở 4' && !st.note && !st.modal, `Tạo đề đang chạy → sang Tạo đề mới: ${JSON.stringify(st)}`);
    await ctx.close();
  } finally { srv.proc.kill(); }

  // B. Giới hạn 500 (kho lớn 1 200 câu)
  srv = await startServer(PORT_V2, { LATENCY_MS: '0', BANK_ROWS: '1200' });
  try {
    const { ctx, ad } = await newAdmin(browser, srv, errors, 'v2-B');
    await ad.click('a[data-nav="bank"]'); await ad.waitForSelector('#bkInfo'); await listCount(ad);
    await ad.fill('#soTN', '200'); await ad.fill('#soDS', '200'); await ad.fill('#soTL', '101');
    await ad.click('#bkMatrix'); await ad.waitForTimeout(800);
    const msg = await ad.evaluate(() => [...document.querySelectorAll('.toast, .modal')].map((e) => e.textContent.replace(/\s+/g, ' ')).join(' | '));
    if (await ad.$('.modal [data-close]')) { await ad.click('.modal [data-close]'); await ad.waitForTimeout(300); }
    let ct = await cartText(ad);
    verdict('V2 giới hạn 500', /500/.test(msg) && !/P[123] [1-9]/.test(ct), `ma trận 200+200+101 → "${msg.slice(0, 160)}"; giỏ "${ct}"`);
    // P1 250 (> 200 ô nhập cho phép): xem giao diện báo gì
    await ad.fill('#soTN', '250'); await ad.fill('#soDS', '0'); await ad.fill('#soTL', '0');
    await ad.click('#bkMatrix'); await ad.waitForTimeout(1200);
    const msg250 = await ad.evaluate(() => [...document.querySelectorAll('.toast, .modal')].map((e) => e.textContent.replace(/\s+/g, ' ')).join(' | '));
    verdict('K-1 ma trận P1 > 200 bị cắt âm thầm', /tối đa 200|thiếu/i.test(msg250.replace(/Ma trận tối đa 500[^|]*/g, '')), `ô P1 = 250 → "${msg250.slice(0, 200)}"`);
    if (await ad.$('.modal [data-close=""]')) { await ad.click('.modal [data-close=""]'); await ad.waitForTimeout(300); }
    // Giỏ > 500: ma trận 200/150/150 = 500 rồi thêm 1 câu
    await ad.fill('#soTN', '200'); await ad.fill('#soDS', '150'); await ad.fill('#soTL', '150');
    await ad.click('#bkMatrix'); await ad.waitForSelector('.modal'); await ad.waitForTimeout(300);
    await ad.click('.modal [data-close="ok"]'); await ad.waitForTimeout(500);
    ct = await cartText(ad);
    const free = await ad.$eval('#bkList [data-cart]:not(.in-cart)', (e) => e.dataset.cart).catch(() => null);
    if (free) { await ad.click(`[data-cart="${free}"]`); await ad.waitForTimeout(300); }
    const bar = await ad.evaluate(() => ({ t: (document.querySelector('#bkCart') || {}).textContent.replace(/\s+/g, ' '), dis: (document.querySelector('#cartMake') || {}).disabled }));
    verdict('V2 giới hạn 500', /P1 200 · P2 150 · P3 150/.test(ct) && /Quá 500 câu/.test(bar.t) && /bớt 1/.test(bar.t) && bar.dis === true,
      `giỏ 500 ("${ct}") + 1 câu → "${bar.t.slice(0, 120)}", nút Tạo đề khóa: ${bar.dis}`);
    await ctx.close();
  } finally { srv.proc.kill(); }
  verdict('V2 không lỗi JS', errors.length === 0, errors.join(' | ').slice(0, 400) || 'không có lỗi JS');
}

(async () => {
  const browser = await chromium.launch();
  try {
    if (MODE === 'new' || MODE === 'all') { console.log('— Máy chủ mới (kho giả) —'); await runNew(browser); }
    if (MODE === 'compat' || MODE === 'all') { console.log('— Máy chủ 1.0.0 —'); await runCompat(browser); }
    if (MODE === 'v2' || MODE === 'all') { console.log('— Vòng 2 —'); await runV2(browser); }
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
