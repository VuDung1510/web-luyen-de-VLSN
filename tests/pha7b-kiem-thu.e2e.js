// Kiểm thử độc lập Pha 7b (người kiểm thử) — giao diện, viết theo docs/spec/pha-7-so-tay.md §5, §7 (phần 7b), TC-7.9 → TC-7.17.
// Tự chạy dev-server: máy chủ mới (PORT_NEW 8790, có gieo 1 hàng CongThuc qua biến CONG_THUC), giả lập 1.0.0 (8791) và 1.5.0 (8792).
//   NODE_PATH=$(npm root -g) LIBS_DIR=... node tests/pha7b-kiem-thu.e2e.js [new|compat|all]
// Ảnh: docs/bao-cao/anh/pha-7b/kt-*.png. Câu hỏi tự soạn; học sinh B giả (PIN mặc định theo ngày sinh).
const { chromium } = require('playwright');
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const MODE = process.argv[2] || 'all';
const PORT_NEW = +(process.env.PORT_NEW || 8790);
const PORT_OLD = +(process.env.PORT_OLD || 8791);
const PORT_150 = +(process.env.PORT_150 || 8792);
const SHOTS = process.env.SHOTS || path.join(__dirname, '..', 'docs', 'bao-cao', 'anh', 'pha-7b');
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


// ---------- Dữ liệu ----------
const TL = (n, dapAn, x) => Object.assign({ loai: 'TL', phan: 3, noiDung: `Câu trả lời ngắn tự soạn số ${n}: tính đại lượng y.`, dapAn: String(dapAn), saiSo: '0', chuDe: 'Chủ đề thử', chuong: 'Chương III. Thử', bai: 'Bài 14. Thử', loiGiai: `Lời giải tự soạn câu ${n}.` }, x || {});
const TN = (n, dapAn, x) => Object.assign({ loai: 'TN', phan: 1, noiDung: `Câu trắc nghiệm tự soạn số ${n}: chọn phát biểu đúng.`, A: 'Phương án một', B: 'Phương án hai', C: 'Phương án ba', D: 'Phương án bốn', dapAn, chuDe: 'Chủ đề thử', chuong: 'Chương I. Thử', bai: 'Bài 4. Thử', loiGiai: `Lời giải tự soạn câu ${n}.` }, x || {});
const BAI_CT = 'Bài 7. Thử công thức';
const CONG_THUC = [{ 'Mã bài': BAI_CT, 'Tên công thức': 'Định luật thử', 'Công thức': 'F = m a', 'Tên gợi nhớ': 'Ép bằng ma', 'Phạm vi áp dụng': 'Hệ quy chiếu quán tính', 'Dấu hiệu sử dụng': 'Có lực và gia tốc', 'Bật': 'CO' }];
const KW_TEXT = 'Vật nhỏ không chuyển động lúc đầu; kết quả làm tròn đến hai chữ số, quãng đường 5 cm, có vôn kế phụ.';
const B_BIRTH = '03/04/2008';
async function seed(base, pw) {
  const t = (await api(base, 'loginAdminPassword', { password: pw })).token;
  const st = (await api(base, 'loginPin', { studentId: 'HS0001', pin: '0101' })).token;
  const mk = async (title, qs, ex) => (await api(base, 'adminSaveExam', { token: t, exam: Object.assign({ tieuDe: title, lop: '12A1', thoiGian: 50, trangThai: 'MO', soLanLam: 0, hienLoiGiai: 'NGAY' }, ex || {}), questions: qs })).id;
  const sub = async (e, a, tok) => { const s = await api(base, 'startExam', { token: tok || st, examId: e }); await api(base, 'submitExam', { token: tok || st, attemptToken: s.attemptToken, answers: a }); };
  const close = async (e) => { const ex = await api(base, 'adminGetExam', { token: t, examId: e }); await api(base, 'adminSaveExam', { token: t, exam: Object.assign({}, ex.exam, { trangThai: 'DONG' }), questions: ex.questions }); };
  // lỗi sẵn: SOT đỏ (3 câu bỏ trống ở 2 đề)
  const A = await mk('Đề cũ A', [TL(1, '5'), TL(2, '6')]);
  const B = await mk('Đề cũ B', [TL(3, '7')]);
  await sub(A, { 1: '', 2: '' }); await sub(B, { 1: '' });
  // đề có từ khóa + bài có công thức + bài không có công thức (sai qua API, đóng đề)
  const K = await mk('Đề từ khóa', [TN(21, 'A', { noiDung: KW_TEXT, bai: BAI_CT }), TN(22, 'A', { bai: 'Bài 8. Không có công thức' })]);
  await sub(K, { 1: 'B', 2: 'B' }); await close(K);
  // đề 25 phút: bỏ trống 1 câu Phần III
  const D = await mk('Đề 25 phút', [TL(31, '9')], { thoiGian: 25 });
  await sub(D, { 1: '' });
  // đề C (50 phút) sẽ làm trên giao diện
  const C = await mk('Đề C làm trên web', [TN(41, 'A'), TL(42, '25'), TL(43, '8'), TN(44, 'B')]);
  const E = await mk('Đề còn mở', [TN(51, 'A')]); // đề C sẽ đóng; dùng E để xem trang bắt đầu
  // học sinh B: chưa có lỗi
  const sB = await api(base, 'adminSaveStudent', { token: t, student: { hoTen: 'Học sinh B thử', lop: '12A1', ngaySinh: B_BIRTH } });
  return { t, st, A, B, K, D, C, E, close, bId: sB.id };
}
const pinOf = (d) => d.slice(0, 2) + d.slice(3, 5);
async function answerExamC(page) {
  const qs = await page.$$('.q');
  await (await qs[0].$('[data-opt="C"]')).click();
  await (await qs[1].$('input')).fill('2500');
  await (await qs[3].$('[data-opt="B"]')).click();
  await page.click('#btnSubmit');
  await page.click('[data-close="ok"]');
  await page.waitForSelector('.score-ring', { timeout: 15000 });
  await page.waitForTimeout(800);
}
const visibleWhy = (page) => page.evaluate(() => [...document.querySelectorAll('#nbResult .nb-why-item')].filter((e) => e.offsetParent !== null).length);

async function runNew(browser) {
  console.log('\n== Máy chủ mới (cổng ' + PORT_NEW + ') ==');
  const srv = await startServer(PORT_NEW, { CONG_THUC: JSON.stringify(CONG_THUC) });
  const errs = [];
  try {
    const S = await seed(srv.base, srv.pw);
    // ================= 1280×800 sáng: luồng chính =================
    const { ctx, page } = await newPage(browser, [1280, 800], 'light', errs, '1280');
    await studentLogin(page, srv.base);
    // TC-7.17
    const ban = await page.evaluate(() => { const b = document.querySelector('.nb-banner'); return b && b.offsetParent !== null ? b.textContent.replace(/\s+/g, ' ').trim() : null; });
    verdict('TC-7.17', !!ban && /lặp lại/i.test(ban) && /sổ tay/i.test(ban), `trang chủ có lỗi đỏ → dải nhắc: "${ban}"`);
    await shot(page, '01-trang-chu-dai-nhac-1280');
    // TC-7.16 đề thi
    await page.goto(srv.base + '/#/lam-bai/' + S.C); await page.waitForSelector('#btnStart'); await page.waitForTimeout(600);
    const box = await page.evaluate(() => { const b = document.querySelector('#nbRemind .nb-remind'); return b ? { lines: b.querySelectorAll('li').length, txt: b.textContent.replace(/\s+/g, ' ').trim().slice(0, 160), afterGoal: !!document.querySelector('.goal-box') && (document.querySelector('.goal-box').compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) > 0 } : null; });
    await page.click('[data-goal="8"]');
    const dis1 = await page.$eval('#btnStart', (b) => b.disabled);
    await page.click('#btnStart', { force: true }).catch(() => {}); await page.waitForTimeout(300);
    const started1 = !!(await page.$('.timer'));
    await shot(page, '02-dieu-can-nho-1280');
    await page.check('#nbReadOk');
    const dis2 = await page.$eval('#btnStart', (b) => b.disabled);
    verdict('TC-7.16', box && box.lines >= 1 && box.lines <= 3 && box.afterGoal && dis1 && !started1 && !dis2, `đề thi khi có lỗi đỏ: hộp "Điều cần nhớ" (${box && box.lines} dòng, sau hộp mục tiêu) — Bắt đầu khóa (bấm không vào bài) tới khi tick "Em đã đọc": ${dis1} → ${dis2}; "${box && box.txt}"`);
    await page.click('#btnStart'); await page.waitForSelector('.timer');
    await answerExamC(page);
    // TC-7.9
    const why = await page.evaluate(() => {
      const c = document.getElementById('nbResult'); if (!c) return null;
      const items = [...c.querySelectorAll('.nb-why-item')].map((it) => ({ k: it.dataset.key, on: [...it.querySelectorAll('[aria-pressed="true"]')].map((b) => b.dataset.whyma), chips: it.querySelectorAll('[data-whyma]').length }));
      const score = document.querySelector('.score-ring'); const overlay = !!document.querySelector('.modal-backdrop, .modal.show');
      return { items, below: score && (score.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING) > 0, overlay, txt: c.textContent.replace(/\s+/g, ' ').slice(0, 200) };
    });
    const resUrl = page.url();
    const it3 = why && why.items.find((x) => /#3$/.test(x.k));
    verdict('TC-7.9', why && why.items.length === 3 && why.items.every((x) => x.chips === 6) && it3 && it3.on.join() === 'SOT' && why.below && !why.overlay,
      `nộp đề 3 câu sai: thẻ "Em sai vì sao?" trong trang kết quả (dưới điểm, không che) có ${why && why.items.length} câu, mỗi câu 6 chip; câu bỏ trống chọn sẵn ${JSON.stringify(it3 && it3.on)}`);
    await shot(page, '03-em-sai-vi-sao-1280', { fullPage: true });
    // "Lỗi này em đã mắc n lần"
    const lap = await page.evaluate(() => { const e = document.querySelector('#nbResult .nb-lap'); return e ? e.textContent.replace(/\s+/g, ' ').trim() : ''; });
    const nSot = (await api(srv.base, 'notebook', { token: S.st })).items.filter((x) => x.loi.ma === 'SOT').length;
    const mN = lap.match(/mắc\s*(\d+)\s*lần/);
    verdict('Trang kết quả (§7)', mN && +mN[1] === nSot, `dòng nhắc câu sai trùng loại lỗi đỏ: "${lap}" — sổ tay có ${nSot} câu Sót ý (đặc tả: "Lỗi này em đã mắc n lần")`);
    // Bỏ qua → tải lại không hiện → "Phân loại lỗi" mở lại
    await page.click('[data-why="skip"]'); await page.waitForTimeout(500);
    const afterSkip = await visibleWhy(page);
    await page.reload(); await page.waitForSelector('.score-ring'); await page.waitForTimeout(1200);
    const afterReload = await visibleWhy(page);
    const openBtn = await page.$('#nbResult [data-why="open"]');
    if (openBtn) { await openBtn.click(); await page.waitForTimeout(600); }
    const reopened = await visibleWhy(page);
    verdict('TC-7.9', afterSkip === 0 && afterReload === 0 && !!openBtn && reopened === 3, `"Bỏ qua" → ẩn (${afterSkip}); tải lại không hiện lại (${afterReload}); nút "Phân loại lỗi" mở lại ${reopened} câu`);
    // Lưu: chọn Đọc sai đề cho câu 1 → notebookTag
    await page.click('#nbResult .nb-why-item[data-key$="#1"] [data-whyma="DOC_DE"]');
    await page.click('#nbWhySave'); await page.waitForTimeout(900);
    const nbd = await api(srv.base, 'notebook', { token: S.st });
    const k1 = nbd.items.find((x) => x.key === S.C + '#1');
    verdict('TC-7.10', k1 && k1.loi.ma === 'DOC_DE' && k1.loi.nguon === 'HS', `chọn trong thẻ "Em sai vì sao?" rồi Lưu → sổ tay ghi ${k1 && JSON.stringify(k1.loi)}`);
    // đóng đề C để có đáp án (DON_VI)
    await S.close(S.C);

    // ================= Sổ tay =================
    await page.goto(srv.base + '/#/so-tay'); await page.waitForSelector('#nbSplit .nb-item'); await page.waitForTimeout(500);
    // TC-7.12 công cụ đơn vị
    const kU = S.C + '#2';
    await page.click(`.nb-row[data-nbopen="${kU}"]`); await page.waitForTimeout(900);
    const u0 = await page.evaluate((k) => {
      const it = document.querySelector(`.nb-item[data-key="${k}"]`);
      const all = [...it.querySelectorAll('.nb-rung')]; const sig = (b) => { const c = getComputedStyle(b); return c.fontWeight + '|' + c.borderTopWidth + '|' + c.borderTopColor; };
      const cnt = {}; all.forEach((b) => { cnt[sig(b)] = (cnt[sig(b)] || 0) + 1; }); const common = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
      const rungs = all.map((b) => ({ u: b.dataset.unit, bold: sig(b) !== common, sig: sig(b) }));
      const sel = it.querySelector('[data-unitdl]');
      return { dl: sel && sel.options[sel.selectedIndex].text, rungs, fb: [...it.querySelectorAll('.nb-fb')].map((x) => x.textContent.trim()) };
    }, kU);
    const units = u0.rungs.map((x) => x.u);
    const bold = u0.rungs.filter((x) => x.bold).map((x) => x.u);
    verdict('TC-7.12', u0.dl === 'Chiều dài' && units[0] === 'km' && units[units.length - 1] === 'nm' && ['km', 'hm', 'dam', 'm', 'dm', 'cm', 'mm', 'µm', 'nm'].every((x) => units.includes(x)) && bold.join() === 'm' && u0.fb.some((x) => /lệch.*10²\s*lần/.test(x)),
      `câu 2500/25: đại lượng "${u0.dl}", thang ${units.join(' ')} (tô đậm: ${bold.join()}), "${u0.fb.find((x) => /lệch/.test(x))}"`);
    const fbAfter = async () => page.evaluate((k) => [...document.querySelectorAll(`.nb-item[data-key="${k}"] .nb-fb`)].slice(1).map((x) => (x.classList.contains('good') ? '[good] ' : x.classList.contains('bad') ? '[bad] ' : '') + x.textContent.trim()), kU);
    const pick = async (u) => { await page.click(`.nb-item[data-key="${kU}"] .nb-rung[data-unit="${u}"]`); await page.waitForTimeout(200); };
    const isRight = (arr) => arr.some((x) => /^\[good\]/.test(x) || (/đúng/i.test(x) && !/chưa đúng|không đúng|đơn vị đúng mà/i.test(x)));
    // lượt 1: em dùng cm, chọn m (đúng: lệch 10²)
    await pick('cm'); const fbEm = await fbAfter(); await pick('m'); const fbRight = await fbAfter();
    const arrow = (await page.textContent(`.nb-item[data-key="${kU}"] .nb-tool`)).replace(/\s+/g, ' ');
    // lượt 2: em dùng cm, chọn mm (sai: chỉ 10¹, ngược chiều)
    await pick('cm'); await pick('mm'); const fbWrong = await fbAfter();
    console.log('      · đơn vị: chọn "cm": ' + JSON.stringify(fbEm) + ' | rồi "m": ' + JSON.stringify(fbRight) + ' | lượt 2 "cm"→"mm": ' + JSON.stringify(fbWrong));
    verdict('TC-7.12', isRight(fbRight) && /10²|10\^2|×\s*10/.test(fbRight.join(' ') + arrow), `em dùng "cm", chọn đơn vị đúng "m" → ${JSON.stringify(fbRight)}`);
    await page.waitForTimeout(1500);
    const itU = (await api(srv.base, 'notebookItem', { token: S.st, keys: [kU] }));
    const ctU = (JSON.stringify(itU).match(/"dv(Em|Dung)"\s*:\s*"[^"]*"/g) || []).join(', ') || '(không có dvEm/dvDung)';
    verdict('TC-7.12 (biên)', !isRight(fbWrong) && fbWrong.some((x) => /^\[bad\]/.test(x)) && !/"dvDung":"mm"/.test(ctU), `máy đã biết lệch 10², em dùng "cm" mà chọn "mm" (chỉ 10¹) → ${JSON.stringify(fbWrong)}; chi tiết lỗi đã lưu ${ctU}`);
    await shot(page, '04-cong-cu-don-vi-1280');
    // chọn nhiệt độ: công thức cộng trừ
    await page.selectOption(`.nb-item[data-key="${kU}"] [data-unitdl]`, 'nhietDo'); await page.waitForTimeout(250);
    const nd = (await page.textContent(`.nb-item[data-key="${kU}"] .nb-tool`)).replace(/\s+/g, ' ');
    verdict('TC-7.12', /273/.test(nd) && !(await page.$(`.nb-item[data-key="${kU}"] .nb-rung`)), `đại lượng nhiệt độ → công thức cộng trừ (${(nd.match(/[^.]*273[^.]*/) || [''])[0].trim().slice(0, 60)}), không có thang nhân`);
    // TC-7.10 giao diện: đổi loại lỗi trong chi tiết, tải lại vẫn giữ
    const kK = S.K + '#1';
    await page.click(`.nb-row[data-nbopen="${kK}"]`); await page.waitForTimeout(900);
    await page.click(`.nb-item[data-key="${kK}"] [data-nbma="DOC_DE"]`); await page.waitForTimeout(900);
    // TC-7.13 tập gạch từ khóa
    const tokClass = async () => page.evaluate((k) => [...document.querySelectorAll(`.nb-item[data-key="${k}"] .nb-tok`)].map((b) => ({ w: b.textContent.trim(), c: b.className.replace('nb-tok', '').trim(), bg: getComputedStyle(b).backgroundColor })), kK);
    const before = await tokClass();
    await page.click(`.nb-item[data-key="${kK}"] .nb-tok:text-is("không")`).catch(() => {});
    await page.click(`.nb-item[data-key="${kK}"] [data-kwcheck]`); await page.waitForTimeout(300);
    const after = await tokClass();
    const changed = (w) => { const b = before.filter((x) => x.w.replace(/[,.;]/g, '') === w); const a = after.filter((x) => x.w.replace(/[,.;]/g, '') === w); return a.length > 0 && a.some((x, i) => x.c !== (b[i] || {}).c || x.bg !== (b[i] || {}).bg); };
    const hl = ['không', 'làm', 'tròn'].map((w) => w + ':' + changed(w));
    const numHl = changed('5') || changed('cm');
    console.log('      · token sau So sánh: ' + JSON.stringify(after.filter((x) => x.c)));
    verdict('TC-7.13', changed('không') && changed('làm') && changed('tròn'), `câu có "không", "làm tròn": sau "So sánh" được tô ${hl.join(' ')}; dữ kiện số "5 cm" tô: ${numHl}`);
    const missed = after.filter((x) => /làm|tròn/.test(x.w)).map((x) => x.c).join(',');
    const em = after.filter((x) => x.w === 'không').map((x) => x.c).join(',');
    verdict('TC-7.13', em !== missed, `từ em đã gạch ("không": ${em}) khác từ em bỏ sót ("làm tròn": ${missed})`);
    await shot(page, '05-tap-gach-tu-khoa-1280');
    const tagged = (await api(srv.base, 'notebook', { token: S.st })).items.find((x) => x.key === kK);
    verdict('TC-7.10', tagged && tagged.loi.ma === 'DOC_DE' && tagged.loi.nguon === 'HS', `bấm chip "Đọc sai đề" trong chi tiết câu → máy chủ ghi ${JSON.stringify(tagged && tagged.loi)}`);
    // TC-7.11 ghi chú câu
    const noteTxt = '<b>đậm?</b><img src=x onerror="window.__xss=1"> chú ý chữ KHÔNG';
    await page.fill(`.nb-item[data-key="${kK}"] [data-nbnote="${kK}"]`, noteTxt);
    await page.waitForTimeout(2600);
    // ghi chú chung nhiều dòng
    const gnote = ['Dòng một: đọc kỹ đề.', 'Dòng hai: đổi đơn vị về SI.', 'Dòng ba: chừa 8 phút dò bài.', 'Dòng bốn: <script>window.__xss=2</script>', 'Dòng năm: không bỏ trống.'].join('\n');
    await page.fill('#nbGnote', gnote);
    await page.waitForTimeout(2600);
    const saved = (await page.textContent('#nbGsaved')).trim();
    await page.reload(); await page.waitForSelector('#nbSplit .nb-item'); await page.waitForTimeout(600);
    const gBack = await page.$eval('#nbGnote', (t) => t.value);
    await page.click(`.nb-row[data-nbopen="${kK}"]`); await page.waitForTimeout(900);
    const nBack = await page.$eval(`.nb-item[data-key="${kK}"] [data-nbnote="${kK}"]`, (t) => t.value);
    const xss = await page.evaluate(() => window.__xss || null);
    const imgs = await page.evaluate(() => document.querySelectorAll('#nbSplit img[src="x"]').length);
    verdict('TC-7.11', gBack === gnote && nBack === noteTxt && xss === null && imgs === 0, `tự lưu sau ~2 giây ("${saved}"); tải lại vẫn còn ghi chú chung (5 dòng) và ghi chú câu; ký tự HTML hiện nguyên văn, không chạy mã (xss=${xss}, img=${imgs})`);
    await page.fill('#nbGnote', 'x'.repeat(650)); const len = (await page.$eval('#nbGnote', (t) => t.value)).length;
    verdict('TC-7.11', len <= 500, `ô ghi chú chung nhận tối đa ${len} ký tự (máy chủ cũng cắt 500, xem bài Node)`);
    await page.fill('#nbGnote', gnote); await page.waitForTimeout(2600);
    // ---- Vòng 2 (R-2): gõ ghi chú trong lúc trang vẽ lại; gõ rồi chuyển trang ngay ----
    {
      await page.reload(); await page.waitForSelector('#nbSplit .nb-item'); await page.waitForTimeout(600);
      for (const k of [kK, S.K + '#2']) { await page.click(`.nb-row[data-nbopen="${k}"]`); await page.waitForTimeout(900); }
      const sel = `.nb-item[data-key="${kK}"] [data-nbnote="${kK}"]`;
      await page.fill(sel, ''); await page.focus(sel);
      await page.keyboard.type('một ', { delay: 30 });
      await page.evaluate((k) => document.querySelector(`.nb-item[data-key="${k}"] [data-nbma="HONG_KT"]`).click(), S.K + '#2');
      await page.keyboard.type('hai ', { delay: 30 });
      await page.evaluate(() => { const b = document.querySelector('#nbBook [data-nbfix="SOT"]'); if (b) b.click(); });
      await page.keyboard.type('ba ', { delay: 30 });
      await page.evaluate((k) => document.querySelector(`.nb-row[data-nbopen="${k}"]`).click(), S.D + '#1');
      await page.waitForTimeout(60); await page.keyboard.type('bốn', { delay: 30 });
      await page.waitForTimeout(1200); await page.keyboard.type(' năm', { delay: 30 }); // sau khi câu khác tải xong
      const st = await page.evaluate((s2) => { const ta = document.querySelector(s2); return { v: ta && ta.value, focus: document.activeElement === ta, pos: ta && ta.selectionStart }; }, sel);
      await page.waitForTimeout(2500);
      const srvNote = ((await api(srv.base, 'notebookItem', { token: S.st, keys: [kK] })).items || [])[0];
      const want = 'một hai ba bốn năm';
      verdict('TC-7.11', st.v === want && st.focus && st.pos === want.length && srvNote && srvNote.ghiChu === want,
        `vòng 2: gõ ghi chú trong lúc bấm chip câu khác, mở "Cách sửa", một câu khác tải xong → ô còn "${st.v}", con trỏ ở ${st.pos}, vẫn trong ô (${st.focus}); máy chủ lưu "${srvNote && srvNote.ghiChu}"`);
      // gõ rồi rời trang ngay
      await page.focus(sel); await page.keyboard.press('End'); await page.keyboard.type(' gấp', { delay: 20 });
      await page.waitForTimeout(300);
      await page.goto(srv.base + '/#/lich-su'); await page.waitForTimeout(2000);
      const n2 = ((await api(srv.base, 'notebookItem', { token: S.st, keys: [kK] })).items || [])[0];
      const g2 = (await api(srv.base, 'notebook', { token: S.st })).ghiChuChung;
      await page.goto(srv.base + '/#/so-tay'); await page.waitForSelector('#nbGnote'); await page.waitForTimeout(500);
      await page.focus('#nbGnote'); await page.keyboard.press('Control+End'); await page.keyboard.type(' X', { delay: 20 });
      await page.waitForTimeout(200);
      await page.evaluate(() => { location.hash = '#/'; });
      await page.waitForTimeout(2000);
      const g3 = (await api(srv.base, 'notebook', { token: S.st })).ghiChuChung;
      verdict('TC-7.11', n2 && n2.ghiChu === want + ' gấp' && g3 === g2 + ' X', `vòng 2: gõ rồi chuyển trang sau 0,2–0,3 giây → ghi chú câu "${n2 && n2.ghiChu}", ghi chú chung kết thúc "${String(g3).slice(-12)}"`);
      await page.goto(srv.base + '/#/so-tay'); await page.waitForSelector('#nbSplit .nb-item'); await page.waitForTimeout(400);
    }
    // TC-7.14 thẻ công thức
    await api(srv.base, 'notebookTag', { token: S.st, items: [{ key: S.K + '#1', ma: 'CONG_THUC' }, { key: S.K + '#2', ma: 'CONG_THUC' }] });
    await page.reload(); await page.waitForSelector('#nbSplit .nb-item'); await page.waitForTimeout(500);
    await page.click(`.nb-row[data-nbopen="${S.K}#1"]`); await page.waitForTimeout(1200);
    const ct1 = await page.evaluate((k) => { const t = document.querySelector(`.nb-item[data-key="${k}"] .nb-tool`); return t ? { txt: t.textContent.replace(/\s+/g, ' '), katex: !!t.querySelector('.katex'), big: (() => { const e = [...t.querySelectorAll('*')].find((x) => x.childElementCount === 0 && /Ép bằng ma/.test(x.textContent)); return e ? parseFloat(getComputedStyle(e).fontSize) : 0; })(), body: parseFloat(getComputedStyle(document.body).fontSize) } : null; }, S.K + '#1');
    verdict('TC-7.14', ct1 && /Ép bằng ma/.test(ct1.txt) && /quán tính/.test(ct1.txt) && /lực và gia tốc/.test(ct1.txt) && ct1.katex && ct1.big >= 1.1 * ct1.body, `bài có CongThuc: tên gợi nhớ chữ to (${ct1 && ct1.big}px, chữ thường ${ct1 && ct1.body}px), công thức KaTeX (${ct1 && ct1.katex}), phạm vi, dấu hiệu`);
    await shot(page, '06-the-cong-thuc-1280');
    await page.click(`.nb-row[data-nbopen="${S.K}#2"]`); await page.waitForTimeout(1200);
    const ct2 = (await page.textContent(`.nb-item[data-key="${S.K}#2"] .nb-tool`).catch(() => '')).replace(/\s+/g, ' ');
    verdict('TC-7.14', /ghi chú|tự ghi|chưa nhập/i.test(ct2) && !/Ép bằng ma/.test(ct2), `bài không có công thức → gợi ý tự ghi: "${ct2.slice(0, 120)}"`);
    // TC-7.15 bảng thời gian
    const planOf = async (k) => { await page.click(`.nb-row[data-nbopen="${k}"]`); await page.waitForTimeout(1200); return page.evaluate((kk) => { const t = document.querySelector(`.nb-item[data-key="${kk}"] table.nb-plan`); return t ? [...t.querySelectorAll('tbody tr')].map((r) => [...r.cells].map((c) => c.textContent.trim())) : null; }, k); };
    const p50 = await planOf(S.C + '#3');
    const p25 = await planOf(S.D + '#1');
    console.log('      · bảng đề 50: ' + JSON.stringify(p50) + '\n      · bảng đề 25: ' + JSON.stringify(p25));
    const col = (p, i) => (p || []).map((r) => r[i]);
    const num = (s) => parseFloat(String(s).replace(',', '.'));
    verdict('TC-7.15', JSON.stringify(col(p50, 1).map(num)) === JSON.stringify([15, 15, 12, 8]), `đề 50 phút: ${col(p50, 1).join(' / ')}`);
    verdict('TC-7.15', JSON.stringify(col(p25, 1).map(num)) === JSON.stringify([7.5, 7.5, 6, 4]), `đề 25 phút co giãn: ${col(p25, 1).join(' / ')} (mong 7,5 / 7,5 / 6 / 4)`);
    const real = col(p50, 3).filter((x) => x && x !== '—');
    verdict('TC-7.15', real.length >= 1 && col(p25, 3).every((x) => x === '—' || !x), `bài làm trên web (có t) hiện thời gian thực tế: ${col(p50, 3).join(' / ')}; bài không có t: ${col(p25, 3).join(' / ')}`);
    await shot(page, '07-bang-thoi-gian-1280');
    // "Cách sửa ▸" trong sổ + dòng kẻ
    await page.reload(); await page.waitForSelector('#nbSplit .nb-item'); await page.waitForTimeout(600);
    const rc0 = await ruleCheck(page);
    verdict('Dòng kẻ 32px', rc0.ok, `1280 sáng, ghi chú chung 5 dòng: ${rc0.nText} dòng chữ khớp; ô ghi chú ${JSON.stringify(rc0.tas)}; lệch ${JSON.stringify(rc0.bad.concat(rc0.badTa))}`);
    for (const ma of ['SOT', 'TINH_TOAN', 'DOC_DE', 'CONG_THUC']) {
      const b = await page.$(`#nbBook [data-nbfix="${ma}"]`); if (!b) { console.log('      · không có "Cách sửa" cho ' + ma); continue; }
      await b.click(); await page.waitForTimeout(900);
    }
    const rc1 = await ruleCheck(page);
    verdict('Dòng kẻ 32px', rc1.ok, `mở mọi "Cách sửa ▸": khối công cụ cao ${JSON.stringify(rc1.panels)} px (bội 32), chữ sau khối vẫn khớp (${rc1.nText} dòng); lệch ${JSON.stringify(rc1.bad.concat(rc1.badPanel))}`);
    await shot(page, '08-cach-sua-trong-so-1280', { fullPage: true });
    verdict('Không tràn ngang', await noHScroll(page), '1280 sáng: sổ tay mở công cụ');
    await ctx.close();

    // ================= 390×844 và tối =================
    for (const [vp, scheme, tag] of [[[390, 844], 'light', '390'], [[390, 844], 'dark', '390-toi'], [[1280, 800], 'dark', '1280-toi']]) {
      const { ctx: c2, page: p2 } = await newPage(browser, vp, scheme, errs, tag);
      await studentLogin(p2, srv.base);
      await shot(p2, '10-trang-chu-' + tag);
      await p2.goto(srv.base + '/#/lam-bai/' + S.E); await p2.waitForSelector('#btnStart'); await p2.waitForTimeout(500);
      const hasBox = !!(await p2.$('#nbRemind .nb-remind'));
      await shot(p2, '11-dieu-can-nho-' + tag, { fullPage: true });
      const okStart = hasBox && (await noHScroll(p2));
      await p2.goto(srv.base + resUrl.slice(resUrl.indexOf('#'))); await p2.waitForSelector('.score-ring'); await p2.waitForTimeout(900);
      const btn = await p2.$('#nbResult [data-why="open"]'); if (btn) { await btn.click(); await p2.waitForTimeout(500); }
      await shot(p2, '12-ket-qua-so-tay-' + tag, { fullPage: true });
      const okRes = (await visibleWhy(p2)) === 3 && (await noHScroll(p2));
      await p2.goto(srv.base + '/#/so-tay'); await p2.waitForSelector('#nbSplit'); await p2.waitForTimeout(600);
      for (const ma of ['SOT', 'TINH_TOAN']) { const b = await p2.$(`#nbBook [data-nbfix="${ma}"]`); if (b) { await b.click(); await p2.waitForTimeout(700); } }
      const rc = await ruleCheck(p2);
      await shot(p2, '13-so-tay-cach-sua-' + tag, { fullPage: true });
      verdict('Dòng kẻ 32px', rc.ok, `${tag}: mở "Cách sửa" + ghi chú 5 dòng — ${rc.nText} dòng chữ, khối ${JSON.stringify(rc.panels)}, ô ghi chú ${JSON.stringify(rc.tas)}; lệch ${JSON.stringify(rc.bad.concat(rc.badPanel, rc.badTa))}`);
      const okNb = await noHScroll(p2);
      await p2.click('#nbTabList').catch(() => {}); await p2.waitForTimeout(200);
      const r2 = await p2.$(`.nb-row[data-nbopen="${S.C}#2"]`); if (r2) { await r2.click(); await p2.waitForTimeout(900); }
      await shot(p2, '14-cong-cu-' + tag, { fullPage: true });
      verdict('Không tràn ngang', okStart && okRes && okNb && (await noHScroll(p2)), `${tag}: trang bắt đầu (có hộp), trang kết quả (thẻ 3 câu), sổ tay + công cụ đơn vị đều không tràn ngang`);
      await c2.close();
    }

    // ================= Học sinh B: không có lỗi =================
    {
      const { ctx: c3, page: p3 } = await newPage(browser, [1280, 800], 'light', errs, 'B');
      await studentLogin(p3, srv.base, S.bId, pinOf(B_BIRTH));
      const ban2 = await p3.evaluate(() => { const b = document.querySelector('.nb-banner'); return !!(b && b.offsetParent !== null); });
      verdict('TC-7.17', !ban2, 'học sinh chưa có lỗi đỏ → không có dải nhắc');
      await p3.goto(srv.base + '/#/lam-bai/' + S.E); await p3.waitForSelector('#btnStart'); await p3.waitForTimeout(600);
      const box2 = !!(await p3.$('#nbRemind .nb-remind, #nbReadOk'));
      await p3.click('[data-goal="8"]');
      const dis = await p3.$eval('#btnStart', (b) => b.disabled);
      verdict('TC-7.16', !box2 && !dis, 'sổ tay không có lỗi đỏ/vàng → không hiện hộp "Điều cần nhớ", nút Bắt đầu bấm được');
      await c3.close();
    }
    // ================= Luyện tập: không có hộp; trang kết quả luyện tập có thẻ =================
    {
      const { ctx: c4, page: p4 } = await newPage(browser, [1280, 800], 'light', errs, 'luyen');
      await studentLogin(p4, srv.base);
      await p4.goto(srv.base + '/#/luyen-tap'); await p4.waitForSelector('#ptQuick', { timeout: 15000 }); await p4.waitForTimeout(500);
      await p4.selectOption('#ptQuickBai', 'Bài 9. Định luật Boyle'); await p4.click('#ptQuick'); await p4.waitForSelector('.modal', { timeout: 10000 }); await p4.waitForTimeout(200);
      const inModal = !!(await p4.$('.modal #nbReadOk, .modal .nb-remind'));
      const startResp = p4.waitForResponse(async (r) => r.url().includes('/exec') && /practiceStart/.test(r.request().postData() || ''));
      await p4.click('#ptGoalSkip'); await p4.waitForSelector('#btnSubmit', { timeout: 15000 }); await p4.waitForTimeout(400);
      // Phần II: đúng 3 ý, sai 1 ý → máy đoán SOT "cần hỏi" (bài luyện có lời giải ngay)
      const KG = require('./fixtures/kho-gia'); const rows = KG.standardRows(); const byNd = new Map(rows.map((r) => [r[8], r]));
      const dsKey = (r) => (r[13].match(/([a-d])\)\s*(Đúng|Sai|Đ|S)/gi) || []).map((x) => (/Đ|Đúng/i.test(x.replace(/^[a-d]\)\s*/i, '')) ? 'D' : 'S'));
      let dsStt = null;
      try {
        const sd = JSON.parse(await (await startResp).text()).data;
        for (const q of sd.questions) { const r = byNd.get(q.noiDung); if (q.loai === 'DS' && r) { const k = dsKey(r); k[3] = k[3] === 'D' ? 'S' : 'D'; const el = await p4.$(`.q[data-stt="${q.stt}"]`); for (let j = 0; j < 4; j++) await (await el.$(`[data-tf="${j}:${k[j]}"]`)).click(); dsStt = q.stt; break; } }
      } catch (e) { console.log('      · không điền được Phần II: ' + e.message); }
      const inPage = !!(await p4.$('#nbReadOk, .nb-remind'));
      verdict('TC-7.16', !inModal && !inPage, 'luyện tập (có lỗi đỏ): không hiện hộp "Điều cần nhớ", vào bài ngay');
      await p4.click('#btnSubmit'); await p4.click('[data-close="ok"]'); await p4.waitForSelector('.score-ring', { timeout: 15000 }); await p4.waitForTimeout(1000);
      const n = await visibleWhy(p4);
      const ask = await p4.evaluate(() => [...document.querySelectorAll('#nbResult .nb-chip')].filter((b) => /\?/.test(getComputedStyle(b, '::after').content) || /\?/.test(getComputedStyle(b, '::before').content) || /\?/.test(b.textContent) || b.classList.contains('ask')).length);
      verdict('TC-7.9', n > 0, `trang kết quả luyện tập cũng có thẻ "Em sai vì sao?" (${n} câu)`);
      if (dsStt != null) verdict('TC-7.9', ask >= 1, `câu Phần II sai đúng 1 ý (máy đoán chưa chắc): chip có dấu "?" — ${ask} chip`);
      await shot(p4, '15-ket-qua-luyen-tap-1280', { fullPage: true });
      await c4.close();
    }
    // ================= Tắt sổ tay =================
    await api(srv.base, 'adminSaveSettings', { token: S.t, settings: { BAT_SO_TAY: 'KHONG' } });
    {
      const { ctx: c5, page: p5 } = await newPage(browser, [1280, 800], 'light', errs, 'off');
      await studentLogin(p5, srv.base);
      const ban3 = await p5.evaluate(() => !!document.querySelector('.nb-banner'));
      await p5.goto(srv.base + '/#/lam-bai/' + S.E); await p5.waitForSelector('#btnStart'); await p5.waitForTimeout(600);
      const box3 = !!(await p5.$('#nbReadOk'));
      await p5.goto(srv.base + resUrl.slice(resUrl.indexOf('#'))); await p5.waitForSelector('.score-ring'); await p5.waitForTimeout(900);
      const card = !!(await p5.$('#nbResult'));
      verdict('TC-7.7', !ban3 && !box3 && !card, `BAT_SO_TAY=KHONG: không dải nhắc (${ban3}), không hộp "Điều cần nhớ" (${box3}), không thẻ Sổ tay ở trang kết quả (${card})`);
      await c5.close();
    }
    await api(srv.base, 'adminSaveSettings', { token: S.t, settings: { BAT_SO_TAY: 'CO' } });
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
    const t = (await api(srv.base, 'loginAdminPassword', { password: srv.pw })).token;
    const st = (await api(srv.base, 'loginPin', { studentId: 'HS0001', pin: '0101' })).token;
    const mk = async (title, qs) => (await api(srv.base, 'adminSaveExam', { token: t, exam: { tieuDe: title, lop: '12A1', thoiGian: 50, trangThai: 'MO', soLanLam: 0 }, questions: qs })).id;
    const A = await mk('Đề cũ A', [TL(1, '5'), TL(2, '6')]); const B = await mk('Đề cũ B', [TL(3, '7')]);
    for (const [e, a] of [[A, { 1: '', 2: '' }], [B, { 1: '' }]]) { const s = await api(srv.base, 'startExam', { token: st, examId: e }); await api(srv.base, 'submitExam', { token: st, attemptToken: s.attemptToken, answers: a }); }
    const C = await mk('Đề C', [TN(41, 'A'), TL(42, '25'), TL(43, '8'), TN(44, 'B')]);
    const { ctx, page } = await newPage(browser, [390, 844], 'light', errs, ver);
    await studentLogin(page, srv.base);
    const ban = await page.evaluate(() => !!document.querySelector('.nb-banner'));
    await page.goto(srv.base + '/#/lam-bai/' + C); await page.waitForSelector('#btnStart'); await page.waitForTimeout(500);
    const box = !!(await page.$('#nbReadOk, .nb-remind'));
    const goal = await page.$('[data-goal="8"]'); if (goal) await goal.click();
    const dis = await page.$eval('#btnStart', (b) => b.disabled);
    await page.click('#btnStart'); await page.waitForSelector('.timer');
    await answerExamC(page);
    const card = !!(await page.$('#nbResult'));
    const score = await page.$eval('.score-ring b', (e) => e.textContent.trim());
    verdict('TC-7.7', !ban && !box && !dis && !card && score === '2,5', `máy chủ ${ver}: không dải nhắc, không hộp "Điều cần nhớ", Bắt đầu bấm được, nộp bài bình thường (điểm ${score}), không thẻ Sổ tay`);
    await shot(page, 'compat-' + ver.replace(/\./g, '') + '-ket-qua-390', { fullPage: true });
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
