// Kiểm thử độc lập Pha 7c (người kiểm thử) — giao diện đề khắc phục, viết theo docs/spec/pha-7-so-tay.md §7 "Đề khắc phục (7c)", TC-7.18 → 7.22.
// Tự chạy dev-server: máy chủ mới (PORT_NEW 8790, kho giả + pool), giả lập 1.0.0 (8791) và 1.5.0 (8792).
//   NODE_PATH=$(npm root -g) LIBS_DIR=... node tests/pha7c-kiem-thu.e2e.js [new|compat|all]
// Ảnh: docs/bao-cao/anh/pha-7c/kt-*.png. Câu hỏi tự soạn; học sinh B giả (PIN mặc định theo ngày sinh).
const { chromium } = require('playwright');
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const MODE = process.argv[2] || 'all';
const PORT_NEW = +(process.env.PORT_NEW || 8790);
const PORT_OLD = +(process.env.PORT_OLD || 8791);
const PORT_150 = +(process.env.PORT_150 || 8792);
const SHOTS = process.env.SHOTS || path.join(__dirname, '..', 'docs', 'bao-cao', 'anh', 'pha-7c');
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
    p.on('exit', (c) => reject(new Error('dev-server thoát ' + c)));
    setTimeout(() => reject(new Error('dev-server không khởi động')), 15000);
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
async function studentLogin(page, base, id, pin) {
  id = id || 'HS0001';
  await page.goto(base + '/');
  await page.waitForSelector('#selClass option[value="12A1"]', { state: 'attached' });
  await page.selectOption('#selClass', '12A1');
  await page.waitForSelector(`#selStudent option[value="${id}"]`, { state: 'attached' });
  await page.selectOption('#selStudent', id);
  await page.fill('#pin', pin || '0101');
  await page.click('#btnLogin');
  await page.waitForSelector('a[href="#/lich-su"]', { timeout: 15000 });
  await page.waitForTimeout(400);
}
async function newPage(browser, vp, scheme, errs, tag) {
  const ctx = await browser.newContext({ viewport: { width: vp[0], height: vp[1] }, deviceScaleFactor: 1, colorScheme: scheme || 'light' });
  const page = await ctx.newPage();
  await page.emulateMedia({ colorScheme: scheme || 'light' });
  await routeCdn(page);
  watchErrors(page, errs, tag);
  return { ctx, page };
}
const navVisible = (page) => page.$$eval('a[href="#/so-tay"]', (a) => a.some((x) => x.offsetParent !== null && x.getBoundingClientRect().width > 0));
const noHScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);

// Đo dòng kẻ: chụp khung sổ, tìm hàng điểm ảnh của dòng kẻ ở mép phải, so với tâm từng dòng chữ.
async function ruleCheck(page) {
  const book = await page.$('#nbBook');
  if (!book) return { ok: false, why: 'không có #nbBook' };
  const box = await book.boundingBox();
  const png = await book.screenshot();
  const data = 'data:image/png;base64,' + png.toString('base64');
  return page.evaluate(async ({ data, box }) => {
    const img = new Image(); img.src = data; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    // cột quét: gần mép phải, tránh viền (8–14px trong)
    const lum = (d) => 0.2126 * d[0] + 0.7152 * d[1] + 0.0722 * d[2];
    const col = c.width - 10;
    const px = x.getImageData(col, 0, 1, c.height).data;
    const L = []; for (let y = 0; y < c.height; y++) L.push(lum([px[y * 4], px[y * 4 + 1], px[y * 4 + 2]]));
    const sorted = L.slice().sort((a, b) => a - b); const med = sorted[Math.floor(sorted.length / 2)];
    const dark = matchMedia('(prefers-color-scheme: dark)').matches || document.documentElement.dataset.theme === 'dark';
    const rows = []; for (let y = 1; y < L.length - 1; y++) { const d = L[y] - med; if ((dark ? d > 3 : d < -3) && Math.abs(L[y] - med) >= Math.abs(L[y - 1] - med) && Math.abs(L[y] - med) >= Math.abs(L[y + 1] - med)) rows.push(y); }
    const phases = {}; rows.forEach((y) => { const p = y % 32; phases[p] = (phases[p] || 0) + 1; });
    const phase = +Object.keys(phases).sort((a, b) => phases[b] - phases[a])[0];
    const spacingOk = rows.length >= 4;
    // dòng chữ: mọi đoạn chữ không rỗng trong sổ (trừ ô nhập, thanh tỉ lệ)
    const bookEl = document.getElementById('nbBook');
    const bt = bookEl.getBoundingClientRect().top;
    const out = []; const walker = document.createTreeWalker(bookEl, NodeFilter.SHOW_TEXT);
    let n; while ((n = walker.nextNode())) {
      if (!n.textContent.trim()) continue;
      const el = n.parentElement; if (!el || el.closest('details:not([open]) > :not(summary)') || el.closest('.nb-fix-panel, textarea')) continue; // khối công cụ: cao tự do, chỉ cần bù tròn 32px (kiểm riêng)
      const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const r = document.createRange(); r.selectNodeContents(n);
      for (const q of r.getClientRects()) {
        if (q.height < 4 || q.width < 2) continue;
        const mid = q.top + q.height / 2 - bt; // tâm dòng chữ
        const off = (((mid - phase) % 32) + 32) % 32; // khoảng cách từ dòng kẻ phía trên
        out.push({ t: n.textContent.trim().slice(0, 24), off: Math.round(off * 10) / 10, lh: cs.lineHeight });
      }
    }
    const bad = out.filter((o) => Math.abs(o.off - 16) > 4);
    // khối công cụ mở trong sổ: chiều cao (gồm lề) bội 32px; ô ghi chú: dòng 32px, mép trên khớp dòng kẻ, không thanh cuộn
    const panels = [...bookEl.querySelectorAll('.nb-fix-panel')].filter((p) => p.offsetParent !== null).map((p) => { const r = p.getBoundingClientRect(); const cs = getComputedStyle(p); const hh = r.height + parseFloat(cs.marginTop) + parseFloat(cs.marginBottom); return Math.round(hh * 10) / 10; });
    const badPanel = panels.filter((hh) => Math.abs(hh / 32 - Math.round(hh / 32)) * 32 > 1.5);
    const tas = [...bookEl.querySelectorAll('textarea')].filter((x) => x.offsetParent !== null).map((ta) => { const r = ta.getBoundingClientRect(); const cs = getComputedStyle(ta); const top = r.top + parseFloat(cs.borderTopWidth) + parseFloat(cs.paddingTop) - bt; return { lh: cs.lineHeight, off: Math.round((((top - phase) % 32) + 32) % 32 * 10) / 10, h: Math.round(r.height), scroll: ta.scrollHeight > ta.clientHeight + 1 }; });
    const badTa = tas.filter((x) => x.lh !== '32px' || (x.off > 2 && x.off < 30) || x.scroll);
    return { ok: spacingOk && bad.length === 0 && badPanel.length === 0 && badTa.length === 0, rules: rows.length, phase, nText: out.length, bad: bad.slice(0, 6), panels, badPanel, tas, badTa };
  }, { data, box });
}


const K = require('./fixtures/kho-gia');
const ROWS = K.standardRows();
const BY_ND = new Map(ROWS.map((r) => [r[8], r]));
const dsKey = (r) => (r[13].match(/([a-d])\)\s*(Đúng|Sai|Đ|S)/gi) || []).map((x) => (/Đ|Đúng/i.test(x.replace(/^[a-d]\)\s*/i, '')) ? 'D' : 'S'));
// Điền bài trên giao diện theo danh sách câu từ phản hồi practiceStart; right(q) → true = trả lời đúng
async function fill(page, questions, right) {
  for (const q of questions) {
    const el = await page.$(`.q[data-stt="${q.stt}"]`); const r = BY_ND.get(q.noiDung);
    if (!el || !r) continue;
    if (!right(q)) continue; // để trống = sai
    if (q.loai === 'TN') await (await el.$(`[data-opt="${r[13]}"]`)).click();
    else if (q.loai === 'DS') { const k = dsKey(r); for (let j = 0; j < 4; j++) await (await el.$(`[data-tf="${j}:${k[j]}"]`)).click(); }
    else await (await el.$('input')).fill(r[13].split('|')[0]);
  }
}
const waitAction = (page, action) => page.waitForResponse((r) => r.url().includes('/exec') && (r.request().postData() || '').includes('"' + action + '"'));
async function startVia(page, sel) {
  const resp = waitAction(page, 'practiceStart');
  await page.click(sel);
  await page.waitForTimeout(300);
  const skip = await page.$('.modal #ptGoalSkip, .modal [data-goal-skip], .modal button:has-text("Bỏ qua")');
  if (skip) await skip.click();
  const d = JSON.parse(await (await resp).text());
  if (!d.ok) return { err: d.error };
  await page.waitForSelector('#btnSubmit', { timeout: 15000 }); await page.waitForTimeout(400);
  return d.data;
}
async function submitUI(page) {
  const resp = waitAction(page, 'submitExam');
  await page.click('#btnSubmit'); await page.click('[data-close="ok"]');
  const d = JSON.parse(await (await resp).text()).data;
  await page.waitForSelector('.score-ring', { timeout: 15000 }); await page.waitForTimeout(800);
  return d;
}
const nbStartBtns = (page) => page.evaluate(() => [...document.querySelectorAll('[data-nbstart]')].filter((b) => b.offsetParent !== null).map((b) => b.dataset.nbstart + (b.dataset.ma ? ':' + b.dataset.ma : '')));

async function runNew(browser) {
  console.log('\n== Máy chủ mới (cổng ' + PORT_NEW + ') ==');
  const srv = await startServer(PORT_NEW, {});
  const errs = [];
  try {
    const t = (await api(srv.base, 'loginAdminPassword', { password: srv.pw })).token;
    const st = (await api(srv.base, 'loginPin', { studentId: 'HS0001', pin: '0101' })).token;
    // câu gốc: bài luyện "Bài 9" bỏ trống (đã có lời giải ngay → được làm câu gốc)
    const s0 = await api(srv.base, 'practiceStart', { token: st, kieu: 'TU_TAO', bai: ['Bài 9. Định luật Boyle'], so: { TN: 5, DS: 1, TL: 1 }, phut: 10 });
    await api(srv.base, 'submitExam', { token: st, attemptToken: s0.attemptToken, answers: {} });
    // thêm câu "chưa phân loại": một bài luyện Bài 11 chọn sai (không bỏ trống)
    const s1 = await api(srv.base, 'practiceStart', { token: st, kieu: 'TU_TAO', bai: ['Bài 11. Phương trình trạng thái khí lí tưởng'], so: { TN: 5 }, phut: 5 });
    const a1 = {}; s1.questions.forEach((q) => { const r = BY_ND.get(q.noiDung); a1[q.stt] = q.loai === 'TN' && r ? 'ABCD'.replace(r[13], '')[0] : ''; });
    await api(srv.base, 'submitExam', { token: st, attemptToken: s1.attemptToken, answers: a1 });
    const nb0 = await api(srv.base, 'notebook', { token: st });
    console.log('      · sổ tay: ' + nb0.items.length + ' câu sai (' + [...new Set(nb0.items.map((x) => x.loi.ma))].join(',') + ')');

    const { ctx, page } = await newPage(browser, [1280, 800], 'light', errs, '1280');
    await studentLogin(page, srv.base);
    await page.goto(srv.base + '/#/so-tay'); await page.waitForSelector('#nbSplit .nb-item'); await page.waitForTimeout(500);
    const b1 = await nbStartBtns(page);
    verdict('Nút (Sổ tay)', b1.includes('ON_NHANH') && b1.includes('MUOI_CAU') && b1.includes('MOT_LOI:SOT'), `đầu sổ tay và dòng lỗi: ${JSON.stringify(b1)}`);
    await shot(page, '01-so-tay-nut-khac-phuc-1280');
    // ---- MUOI_CAU, làm đúng hết ----
    const d1 = await startVia(page, '.nb-fixbar [data-nbstart="MUOI_CAU"]');
    const nQ = await page.$$eval('.q', (x) => x.length);
    const leak = JSON.stringify(d1).match(/"(dapAn|loiGiai|maKho)"\s*:/);
    verdict('TC-7.18', d1.questions && d1.questions.length === nQ && nQ >= 5 && +d1.durationSec === 900 && !leak, `bấm "Đề khắc phục" → vào bài ${nQ} câu, ${d1.durationSec} giây; phản hồi không có dapAn/loiGiai/maKho (${leak ? leak[1] : 'sạch'}); thông báo: "${d1.thongBao || ''}"`);
    await shot(page, '02-lam-de-khac-phuc-1280');
    await fill(page, d1.questions, () => true);
    const r1 = await submitUI(page);
    const kp = (r1 && r1.khacPhuc) || [];
    const txt = (await page.textContent('main')).replace(/\s+/g, ' ');
    const shown = kp.filter((k) => txt.includes('Câu ' + k.stt) || txt.includes(k.tieuDe || '###'));
    const nb1 = await api(srv.base, 'notebook', { token: st });
    const vang = nb1.items.filter((x) => x.mau === 'vang').length;
    const mm = txt.match(/[^.]{0,80}(chuyển|đổi màu|đỏ\s*→\s*vàng|sang vàng)[^.]{0,80}/i);
    verdict('TC-7.19', kp.length >= 1 && kp.every((k) => k.truoc === 'do' && k.sau === 'vang') && vang === kp.length && !!mm, `làm đúng hết → ${kp.length} câu gốc đỏ → vàng (sổ tay có ${vang} câu vàng); trang kết quả: "${mm && mm[0].trim()}"`);
    const lg = await page.evaluate(() => { const t = document.querySelector('#rvDetail') ? document.querySelector('#rvDetail').textContent : document.body.textContent; return /Lời giải|Đáp án/.test(t); });
    const bxh = await page.$$eval('main a[href^="#/bang-xep-hang"]', (a) => a.filter((x) => x.offsetParent !== null).map((x) => x.textContent.trim()));
    verdict('TC-7.21', lg && bxh.length === 0, `trang kết quả bài khắc phục: có đáp án/lời giải ngay (${lg}); nút Bảng xếp hạng: ${JSON.stringify(bxh)}`);
    if (kp.some((k) => k.truoc === k.sau)) console.log('      · khacPhuc có mục không đổi màu: ' + JSON.stringify(kp.filter((k) => k.truoc === k.sau)));
    await shot(page, '03-ket-qua-doi-mau-1280', { fullPage: true });
    // sổ tay đổi màu
    await page.goto(srv.base + '/#/so-tay'); await page.waitForSelector('#nbSplit .nb-item'); await page.waitForTimeout(500);
    const dots = await page.$$eval('#nbList .nb-dot.vang', (x) => x.length);
    verdict('TC-7.19', dots === vang, `sổ tay hiện ${dots} đèn vàng`);
    // ---- Ôn lỗi này (MOT_LOI SOT), bỏ trống ----
    const d2 = await startVia(page, '#nbBook [data-nbstart="MOT_LOI"][data-ma="SOT"]');
    verdict('TC-7.20', d2.questions && d2.questions.length === 5 && +d2.durationSec === 420, `"Ôn lỗi này" (Sót ý) → ${d2.questions && d2.questions.length} câu, ${d2.durationSec} giây; loại: ${(d2.questions || []).map((q) => q.loai).join(',')}`);
    const r2 = await submitUI(page);
    const kp2 = (r2 && r2.khacPhuc) || [];
    verdict('TC-7.19', kp2.some((k) => k.sau === 'do' && k.truoc === 'vang'), `bỏ trống bài khắc phục → câu gốc vàng → đỏ: ${JSON.stringify(kp2.map((k) => k.truoc + '→' + k.sau))}`);
    const txt2 = (await page.textContent('#nbResult').catch(() => '')).replace(/\s+/g, ' ');
    console.log('      · thẻ kết quả bài bỏ trống: ' + txt2.slice(0, 300));
    await shot(page, '03b-ket-qua-ve-do-1280', { fullPage: true });
    // ---- trang Luyện tập ----
    await page.goto(srv.base + '/#/luyen-tap'); await page.waitForSelector('#ptFix', { timeout: 10000 }); await page.waitForTimeout(400);
    const b2 = await nbStartBtns(page);
    await shot(page, '04-luyen-tap-de-khac-phuc-1280', { fullPage: true });
    const d3 = await startVia(page, '#ptFix [data-nbstart="ON_NHANH"]');
    verdict('Nút (Luyện tập)', b2.includes('ON_NHANH') && b2.includes('MUOI_CAU') && d3.questions && d3.questions.length === 5 && +d3.durationSec === 420, `trang Luyện tập có ${JSON.stringify(b2)}; "Ôn trước giờ kiểm tra" → ${d3.questions && d3.questions.length} câu, ${d3.durationSec} giây`);
    await submitUI(page);
    verdict('Không tràn ngang', await noHScroll(page), '1280 sáng: trang kết quả khắc phục');
    // Vòng 2 (G-1): "Ôn phần hổng kiến thức" gồm câu chưa phân loại
    await page.goto(srv.base + '/#/so-tay'); await page.waitForSelector('#nbSplit .nb-item'); await page.waitForTimeout(500);
    const hb = await page.$('#nbBook [data-nbstart="MOT_LOI"][data-ma="HONG"]');
    let hd = null;
    if (hb) { const vis = await hb.isVisible(); if (!vis) await page.click('#nbHkt summary'); await page.waitForTimeout(200); hd = await startVia(page, '#nbBook [data-nbstart="MOT_LOI"][data-ma="HONG"]'); }
    const nCR = (await api(srv.base, 'notebook', { token: st })).items.filter((x) => x.loi.ma === 'CHUA_RO').length;
    verdict('Vòng 2 (G-1)', !!hb && hd && hd.questions && hd.questions.length === 5, `sổ có ${nCR} câu chưa phân loại → nút "${hb ? (await hb.textContent()).trim() : '—'}" có, bấm → ${hd && hd.questions ? hd.questions.length + ' câu' : JSON.stringify(hd)}`);
    if (hd && hd.questions) await shot(page, '09-on-hong-kien-thuc-1280');
    await ctx.close();

    // ---- 390 sáng/tối, 1280 tối ----
    for (const [vp, scheme, tag] of [[[390, 844], 'light', '390'], [[390, 844], 'dark', '390-toi'], [[1280, 800], 'dark', '1280-toi']]) {
      const { ctx: c2, page: p2 } = await newPage(browser, vp, scheme, errs, tag);
      await studentLogin(p2, srv.base);
      await p2.goto(srv.base + '/#/so-tay'); await p2.waitForSelector('#nbSplit'); await p2.waitForTimeout(600);
      const ok1 = (await nbStartBtns(p2)).length >= 3 && (await noHScroll(p2));
      await shot(p2, '05-so-tay-' + tag);
      await p2.goto(srv.base + '/#/luyen-tap'); await p2.waitForSelector('#ptFix'); await p2.waitForTimeout(400);
      await p2.$eval('#ptFix', (e) => e.scrollIntoView());
      await shot(p2, '06-luyen-tap-' + tag);
      const ok2 = await noHScroll(p2);
      const d = await startVia(p2, '#ptFix [data-nbstart="MUOI_CAU"]');
      await fill(p2, d.questions, (q) => q.stt % 2 === 0);
      await submitUI(p2);
      await shot(p2, '07-ket-qua-' + tag, { fullPage: true });
      verdict('Không tràn ngang', ok1 && ok2 && (await noHScroll(p2)), `${tag}: nút ở Sổ tay và Luyện tập, làm đề khắc phục, trang kết quả — không tràn ngang`);
      await c2.close();
    }

    // ---- tắt luyện tập / tắt sổ tay ----
    for (const [k, label] of [['CHO_LUYEN_TAP', 'tắt Luyện tập'], ['BAT_SO_TAY', 'tắt Sổ tay']]) {
      await api(srv.base, 'adminSaveSettings', { token: t, settings: { [k]: 'KHONG' } });
      const { ctx: c3, page: p3 } = await newPage(browser, [1280, 800], 'light', errs, label);
      await studentLogin(p3, srv.base);
      await p3.goto(srv.base + '/#/so-tay'); await p3.waitForTimeout(1200);
      const a = await nbStartBtns(p3);
      await p3.goto(srv.base + '/#/luyen-tap'); await p3.waitForTimeout(1200);
      const b = await nbStartBtns(p3);
      let apiErr = null; try { await api(srv.base, 'practiceStart', { token: st, kieu: 'KHAC_PHUC', mau: 'MUOI_CAU' }); } catch (e) { apiErr = e.message; }
      verdict('Tắt', a.length === 0 && b.length === 0 && !!apiErr, `${label}: Sổ tay ${JSON.stringify(a)}, Luyện tập ${JSON.stringify(b)} — không có nút; gọi thẳng: "${apiErr}"`);
      if (k === 'CHO_LUYEN_TAP') await shot(p3, '08-tat-luyen-tap-so-tay-1280');
      await c3.close();
      await api(srv.base, 'adminSaveSettings', { token: t, settings: { [k]: 'CO' } });
    }
  } finally { srv.proc.kill(); }
  verdict('Không lỗi JS', errs.length === 0, errs.slice(0, 5).join(' | ') || 'không có');
}

async function runCompat(browser, port, ver) {
  console.log(`\n== Giả lập máy chủ ${ver} (cổng ${port}) ==`);
  const p150 = path.join(__dirname, 'fixtures', 'Code-1.5.0.gs');
  if (ver === '1.5.0' && !fs.existsSync(p150)) fs.writeFileSync(p150, execSync('git show 36e9d9f:apps-script/Code.gs', { cwd: path.join(__dirname, '..'), maxBuffer: 1 << 26 }));
  const srv = await startServer(port, { SERVER_COMPAT: ver });
  const errs = [];
  try {
    const { ctx, page } = await newPage(browser, [390, 844], 'light', errs, ver);
    await studentLogin(page, srv.base);
    await page.goto(srv.base + '/#/luyen-tap'); await page.waitForTimeout(1200);
    const a = await nbStartBtns(page); const fix = !!(await page.$('#ptFix'));
    await page.goto(srv.base + '/#/so-tay'); await page.waitForTimeout(1000);
    const b = await nbStartBtns(page);
    await page.goto(srv.base + '/#/lich-su'); await page.waitForTimeout(800);
    verdict('Máy chủ cũ', a.length === 0 && b.length === 0 && !fix, `máy chủ ${ver}: không có nút đề khắc phục ở Luyện tập/Sổ tay`);
    await shot(page, 'compat-' + ver.replace(/\./g, '') + '-390');
    await ctx.close();
  } finally { srv.proc.kill(); }
  verdict('Không lỗi JS', errs.length === 0, `máy chủ ${ver}: ` + (errs.slice(0, 4).join(' | ') || 'không có'));
}

(async () => {
  const browser = await chromium.launch();
  try {
    if (MODE === 'new' || MODE === 'all') await runNew(browser);
    if (MODE === 'compat' || MODE === 'all') { await runCompat(browser, PORT_OLD, '1.0.0'); await runCompat(browser, PORT_150, '1.5.0'); }
  } catch (e) { console.error(e); process.exitCode = 1; }
  await browser.close();
  console.log('\n== Tổng hợp ==');
  for (const [k, v] of Object.entries(R.tc)) console.log(`${k}: ${v.pass ? 'ĐẠT' : 'KHÔNG ĐẠT'} (${v.evidence.length} bằng chứng)`);
  if (Object.values(R.tc).some((v) => !v.pass)) process.exitCode = 1;
})();
