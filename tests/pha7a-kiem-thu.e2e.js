// Kiểm thử độc lập Pha 7a (người kiểm thử) — giao diện Sổ tay, viết theo docs/spec/pha-7-so-tay.md (TC-7.6, phần giao diện TC-7.7)
// và trang mẫu docs/spec/mau-so-tay.html (chữ nằm giữa hai dòng kẻ 32px).
// Tự chạy dev-server: máy chủ mới (PORT_NEW 8790), giả lập 1.0.0 (PORT_OLD 8791), giả lập 1.5.0 (PORT_150 8792, fixture Code-1.5.0.gs).
//   NODE_PATH=$(npm root -g) LIBS_DIR=... node tests/pha7a-kiem-thu.e2e.js [new|compat|all]
// Ảnh: docs/bao-cao/anh/pha-7a/kt-*.png (390×844 và 1280×800, sáng và tối).
// Dữ liệu đề/bài làm tạo qua API dev-server; câu hỏi tự soạn.
const { chromium } = require('playwright');
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const MODE = process.argv[2] || 'all';
const PORT_NEW = +(process.env.PORT_NEW || 8790);
const PORT_OLD = +(process.env.PORT_OLD || 8791);
const PORT_150 = +(process.env.PORT_150 || 8792);
const SHOTS = process.env.SHOTS || path.join(__dirname, '..', 'docs', 'bao-cao', 'anh', 'pha-7a');
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
async function studentLogin(page, base) {
  await page.goto(base + '/');
  await page.waitForSelector('#selClass option[value="12A1"]', { state: 'attached' });
  await page.selectOption('#selClass', '12A1');
  await page.waitForSelector('#selStudent option[value="HS0001"]', { state: 'attached' });
  await page.selectOption('#selStudent', 'HS0001');
  await page.fill('#pin', '0101');
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

// ---------- Dữ liệu ----------
const TL = (n, dapAn, x) => Object.assign({ loai: 'TL', phan: 3, noiDung: `Câu trả lời ngắn tự soạn số ${n}: tính đại lượng y.`, dapAn: String(dapAn), saiSo: '0', chuDe: 'Chủ đề thử', chuong: 'Chương III. Từ trường thử', bai: 'Bài 14. Thử từ trường', loiGiai: `Lời giải tự soạn câu ${n}.` }, x || {});
const TN = (n, dapAn, x) => Object.assign({ loai: 'TN', phan: 1, noiDung: `Câu trắc nghiệm tự soạn số ${n}: chọn phát biểu đúng.`, A: 'Phương án một', B: 'Phương án hai', C: 'Phương án ba', D: 'Phương án bốn', dapAn, chuDe: 'Chủ đề thử', chuong: 'Chương I. Vật lí nhiệt thử', bai: 'Bài 4. Thử nhiệt dung', loiGiai: `Lời giải tự soạn câu ${n}.` }, x || {});
const DS = (n, dapAn, x) => Object.assign({ loai: 'DS', phan: 2, noiDung: `Câu đúng/sai tự soạn số ${n}.`, A: 'Nhận định a', B: 'Nhận định b', C: 'Nhận định c', D: 'Nhận định d', dapAn, chuDe: 'Chủ đề thử', chuong: 'Chương II. Khí lí tưởng thử', bai: 'Bài 9. Thử Boyle', loiGiai: `Lời giải tự soạn câu ${n}.` }, x || {});
async function seed(base, pw) {
  const t = (await api(base, 'loginAdminPassword', { password: pw })).token;
  const st = (await api(base, 'loginPin', { studentId: 'HS0001', pin: '0101' })).token;
  const mk = async (title, qs, ex) => (await api(base, 'adminSaveExam', { token: t, exam: Object.assign({ tieuDe: title, lop: '12A1', thoiGian: 50, trangThai: 'MO', soLanLam: 0, hienLoiGiai: 'NGAY' }, ex || {}), questions: qs })).id;
  const sub = async (e, a) => { const s = await api(base, 'startExam', { token: st, examId: e }); await api(base, 'submitExam', { token: st, attemptToken: s.attemptToken, answers: a }); };
  // Đề A: đang mở (chưa công bố)
  const A = await mk('Đề thử A (đang mở)', [TL(1, '25'), TL(2, '25'), TN(3, 'A'), DS(4, 'ĐSĐS'), TL(5, '8')]);
  // Đề B: sẽ đóng (đã công bố)
  const B = await mk('Đề thử B (đã đóng)', [TL(11, '25'), TL(12, '6'), TL(13, '2,5'), TN(14, 'C')]);
  await sub(A, { 1: '', 2: '0,25', 3: 'B', 4: ['D', 'S', 'D', 'D'], 5: '' });
  await sub(B, { 1: '0,25', 2: '', 3: '2,48', 4: 'A' });
  await sub(B, { 1: '0,25', 2: '', 3: '2,5', 4: 'A' }); // câu 13 đúng lần 2 → vàng; câu 11, 12, 14 sai 2 lần
  const ex = await api(base, 'adminGetExam', { token: t, examId: B });
  await api(base, 'adminSaveExam', { token: t, exam: Object.assign({}, ex.exam, { trangThai: 'DONG' }), questions: ex.questions });
  return { t, st, A, B };
}

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
      const el = n.parentElement; if (!el || el.closest('details:not([open]) > :not(summary)')) continue;
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
    return { ok: spacingOk && bad.length === 0, rules: rows.length, phase, nText: out.length, bad: bad.slice(0, 6), sample: out.slice(0, 5) };
  }, { data, box });
}

async function runNew(browser) {
  console.log('\n== Máy chủ mới (cổng ' + PORT_NEW + ') ==');
  const srv = await startServer(PORT_NEW, {});
  const errs = [];
  try {
    const S = await seed(srv.base, srv.pw);
    const nbData = await api(srv.base, 'notebook', { token: S.st });
    const sot = nbData.tongHop.saiNgoo.find((x) => x.ma === 'SOT');
    const tt = nbData.tongHop.saiNgoo.find((x) => x.ma === 'TINH_TOAN');
    console.log('  · sổ tay: ' + nbData.items.length + ' câu; SOT ' + (sot && sot.so) + ' (' + (sot && sot.mau) + '), TINH_TOAN ' + (tt && tt.so));

    for (const scheme of ['light', 'dark']) {
      // ---------- 1280×800 ----------
      {
        const { ctx, page } = await newPage(browser, [1280, 800], scheme, errs, '1280-' + scheme);
        const itemResp = [];
        page.on('response', async (r) => { if (r.url().includes('/exec') && r.request().method() === 'POST') { try { const b = JSON.parse(r.request().postData() || '{}'); if (b.action === 'notebookItem') itemResp.push({ keys: b.keys, body: await r.text() }); } catch (e) { /* */ } } });
        await studentLogin(page, srv.base);
        const navOk = await navVisible(page);
        if (scheme === 'light') verdict('TC-7.6', navOk, 'thanh menu có mục Sổ tay (máy chủ mới, BAT_SO_TAY=CO)');
        await page.click('a[href="#/so-tay"]');
        await page.waitForSelector('#nbSplit .nb-item', { timeout: 10000 });
        await page.waitForTimeout(300);
        const lay = await page.evaluate(() => {
          const L = document.querySelector('.nb-list-pane').getBoundingClientRect();
          const B = document.querySelector('.nb-book-pane').getBoundingClientRect();
          const tabs = document.querySelector('.nb-tabs'); const tabsVis = tabs && getComputedStyle(tabs).display !== 'none';
          return { lx: L.left, lw: L.width, bx: B.left, bw: B.width, sameRow: Math.abs(L.top - B.top) < 30, tabsVis };
        });
        const frac = lay.lw / (lay.lw + lay.bw);
        verdict('TC-7.6', lay.sameRow && lay.bx > lay.lx + lay.lw - 1 && frac > 0.5 && frac < 0.62 && !lay.tabsVis,
          `1280×800 ${scheme}: hai cột cạnh nhau (trái ${Math.round(lay.lw)}px = ${Math.round(frac * 100)}%, phải ${Math.round(lay.bw)}px), không hiện tab`);
        // Sai ngoo trên, Hổng kiến thức thu gọn
        const sec = await page.evaluate(() => {
          const book = document.getElementById('nbBook');
          const h3 = [...book.querySelectorAll('h3')].map((h) => ({ t: h.textContent.trim(), y: h.getBoundingClientRect().top }));
          const hk = document.getElementById('nbHkt');
          const mapVisible = hk ? [...hk.querySelectorAll('.nb-map-ch')].some((e) => e.checkVisibility()) : null;
          return { h3, hkOpen: hk ? hk.open : null, mapVisible };
        });
        const ySN = (sec.h3.find((h) => /Sai ngoo/.test(h.t)) || {}).y; const yHK = (sec.h3.find((h) => /Hổng kiến thức/.test(h.t)) || {}).y;
        verdict('TC-7.6', ySN != null && yHK != null && ySN < yHK && sec.hkOpen === false && sec.mapVisible === false,
          `${scheme}: "Sai ngoo" (y=${Math.round(ySN)}) nằm trên "Hổng kiến thức" (y=${Math.round(yHK)}); Hổng kiến thức thu gọn (open=${sec.hkOpen}), bản đồ ẩn (hiện=${sec.mapVisible})`);
        // Nhóm bên trái: Sai ngoo trước, đỏ trước
        const groups = await page.evaluate(() => [...document.querySelectorAll('#nbList .nb-group')].map((g) => g.textContent.trim()));
        const order = await page.evaluate(() => [...document.querySelectorAll('#nbList .nb-items')].map((box) => [...box.querySelectorAll('.nb-dot')].map((d) => (d.classList.contains('do') ? 'do' : d.classList.contains('vang') ? 'vang' : 'xanh'))));
        // Theo trang mẫu đã duyệt (renderList): nhóm Sai ngoo xếp theo thứ tự loại lỗi như trong sổ (đỏ/nặng trước),
        // trong cùng loại thì đỏ → vàng → xanh; nhóm Hổng kiến thức xếp đỏ → vàng → xanh.
        const rank = { do: 0, vang: 1, xanh: 2 };
        const bookTypes = await page.evaluate(() => [...document.querySelectorAll('#nbBook .nb-err-name[data-nbtype]')].map((b) => b.dataset.nbtype).filter((x) => x !== 'CHUA_RO'));
        const leftRows = await page.evaluate(() => [...document.querySelectorAll('#nbList .nb-items')].map((box) => [...box.querySelectorAll('.nb-item')].map((e) => e.dataset.key)));
        const byK = {}; nbData.items.forEach((x) => { byK[x.key] = x; });
        const sevOf = (k) => rank[{ do: 'do', vang: 'vang', xanh: 'xanh' }[String(byK[k].mau)] || 'do'];
        const ngoo = leftRows[0] || [];
        const tIdx = (k) => bookTypes.indexOf(byK[k].loi.ma);
        const okNgoo = ngoo.every((k, i) => i === 0 || (tIdx(ngoo[i - 1]) < tIdx(k)) || (tIdx(ngoo[i - 1]) === tIdx(k) && sevOf(ngoo[i - 1]) <= sevOf(k)));
        const hk = leftRows[1] || [];
        const okHk = hk.every((k, i) => i === 0 || sevOf(hk[i - 1]) <= sevOf(k));
        const redFirst = okNgoo && okHk;
        console.log('      · thứ tự loại lỗi trong sổ: ' + bookTypes.join(' > '));
        const detail = await page.evaluate(() => [...document.querySelectorAll('#nbList .nb-items')].map((box) => [...box.querySelectorAll('.nb-item')].map((e) => e.dataset.key.replace(/^DE\d+/, '') + ':' + e.querySelector('.nb-dot').className.replace('nb-dot ', '') + ':' + (e.querySelector('.nb-tag') || {}).textContent + ':' + (e.querySelector('.nb-row-sub') || {}).textContent)));
        console.log('      · thứ tự trái: ' + JSON.stringify(detail));
        verdict('TC-7.6', /Sai ngoo/.test(groups[0] || '') && /Hổng kiến thức/.test(groups[groups.length - 1] || '') && redFirst,
          `${scheme}: danh sách trái nhóm ${JSON.stringify(groups)}; thứ tự trong nhóm theo loại lỗi của sổ rồi đỏ→vàng→xanh (như trang mẫu): ${JSON.stringify(order)}`);
        // Thu gọn mặc định
        const collapsed = await page.evaluate(() => {
          const rows = [...document.querySelectorAll('#nbList .nb-row')];
          return { n: rows.length, allCollapsed: rows.every((r) => r.getAttribute('aria-expanded') === 'false'), noDetail: !document.querySelector('#nbList .nb-item .nb-detail, #nbList .nb-item [class*="detail"]') };
        });
        verdict('TC-7.6', collapsed.n === nbData.items.length && collapsed.allCollapsed && collapsed.noDetail, `${scheme}: ${collapsed.n} câu, mọi câu thu gọn mặc định`);
        // Số lần sai trên dòng
        const kB1 = S.B + '#1';
        const rowTxt = await page.textContent(`.nb-item[data-key="${kB1}"]`);
        verdict('TC-7.6', /2/.test(rowTxt.replace(/Câu 1|Phần|\d{2}\/\d{2}|Bài 14/g, '')) , `${scheme}: dòng câu sai 2 lần có số lần sai: "${rowTxt.replace(/\s+/g, ' ').trim()}"`);
        if (scheme === 'light') await shot(page, '01-so-tay-1280');
        else await shot(page, '05-so-tay-1280-toi');
        // Kiểm chữ khớp dòng kẻ
        const rc = await ruleCheck(page);
        verdict('TC-7.6', rc.ok, `${scheme} 1280: chữ trong sổ nằm giữa hai dòng kẻ 32px — ${rc.rules} dòng kẻ, pha ${rc.phase}, ${rc.nText} dòng chữ, lệch: ${JSON.stringify(rc.bad)}`);
        // Dòng loại lỗi đỏ có nhãn "Lặp lại" (SOT: 3 câu đỏ ở 2 đề)
        const rep = await page.evaluate(() => [...document.querySelectorAll('#nbBook .nb-err-line')].map((l) => ({ ma: (l.querySelector('[data-nbtype]') || {}).dataset?.nbtype, red: !!l.querySelector('.nb-dot.do'), rep: /Lặp lại/.test(l.textContent) })));
        const sotL = rep.find((x) => x.ma === 'SOT'); const others = rep.filter((x) => x.ma !== 'SOT');
        verdict('TC-7.6', sot && sot.mau === 'do' && sotL && sotL.red && sotL.rep && others.every((x) => x.rep === x.red), `${scheme}: dòng lỗi đỏ có nhãn "Lặp lại", dòng khác không: ${JSON.stringify(rep)}`);
        // Bấm tên lỗi → lọc
        for (const ma of ['SOT', 'TINH_TOAN']) {
          const want = nbData.items.filter((x) => x.loi && x.loi.ma === ma).map((x) => x.key).sort();
          await page.click(`#nbBook .nb-err-name[data-nbtype="${ma}"]`);
          await page.waitForTimeout(250);
          const got = await page.evaluate(() => [...document.querySelectorAll('#nbList .nb-item')].filter((e) => e.offsetParent !== null).map((e) => e.dataset.key).sort());
          const active = (await page.textContent('#nbActive').catch(() => '')).replace(/\s+/g, ' ').trim();
          verdict('TC-7.6', JSON.stringify(got) === JSON.stringify(want), `${scheme}: bấm "${ma}" bên phải → trái còn ${got.length}/${want.length} câu đúng loại; nhãn lọc "${active}"`);
        }
        if (scheme === 'light') await shot(page, '02-loc-theo-loi-1280');
        // bỏ lọc
        const selVal = await page.$eval('#nbfLoai', (e) => e.value);
        console.log('      · sau khi bấm tên lỗi, ô lọc loại lỗi = "' + selVal + '"');
        const x = await page.$('#nbActive button'); if (x) await x.click(); else await page.selectOption('#nbfLoai', '');
        await page.waitForTimeout(250);
        // Mở câu đề đang mở → không có đáp án
        const kA2 = S.A + '#2';
        itemResp.length = 0;
        await page.click(`.nb-row[data-nbopen="${kA2}"]`);
        await page.waitForTimeout(600);
        const detA = (await page.textContent(`.nb-item[data-key="${kA2}"]`)).replace(/\s+/g, ' ');
        const respA = itemResp.map((x) => x.body).join('');
        const exp = await page.getAttribute(`.nb-row[data-nbopen="${kA2}"]`, 'aria-expanded');
        verdict('TC-7.6', exp === 'true' && /tự soạn số 2/.test(detA) && /0,25|0\.25/.test(detA), `${scheme}: mở câu đề đang mở — có nội dung + đáp án em chọn`);
        const noAns = !/Lời giải tự soạn/.test(detA) && !/"dapAn"|"loiGiai"|Lời giải tự soạn/.test(respA) && !/(Đáp án đúng|Đáp án)\s*:?\s*25\b/.test(detA);
        verdict('TC-7.6', noAns && /công bố/.test(detA), `${scheme}: câu đề chưa công bố không có đáp án/lời giải (DOM + phản hồi notebookItem); dòng nhắc: "${(detA.match(/[^.]*công bố[^.]*/) || [''])[0].trim()}"`);
        if (scheme === 'light') await shot(page, '03-cau-chua-cong-bo-1280');
        // Mở câu đề đã đóng → có lời giải
        const kB3 = S.B + '#3';
        await page.click(`.nb-row[data-nbopen="${kB3}"]`);
        await page.waitForTimeout(600);
        const detB = (await page.textContent(`.nb-item[data-key="${kB3}"]`)).replace(/\s+/g, ' ');
        verdict('TC-7.6', /2,5|2\.5/.test(detB) && (/Lời giải/.test(detB)), `${scheme}: câu đề đã công bố có đáp án đúng và mục lời giải`);
        verdict('TC-7.6', await noHScroll(page), `1280 ${scheme}: không tràn ngang`);
        await ctx.close();
      }
      // ---------- 390×844 ----------
      {
        const { ctx, page } = await newPage(browser, [390, 844], scheme, errs, '390-' + scheme);
        await studentLogin(page, srv.base);
        await page.goto(srv.base + '/#/so-tay');
        await page.waitForSelector('#nbSplit', { timeout: 10000 });
        await page.waitForTimeout(400);
        const st = await page.evaluate(() => {
          const vis = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return getComputedStyle(e).display !== 'none' && r.height > 0 && r.width > 0; };
          const tabs = [...document.querySelectorAll('.nb-tabs [role="tab"]')].map((b) => ({ t: b.textContent.trim(), sel: b.getAttribute('aria-selected') }));
          return { tabs, tabsVis: vis('.nb-tabs'), book: vis('.nb-book-pane'), list: vis('.nb-list-pane') };
        });
        verdict('TC-7.6', st.tabsVis && st.tabs.length === 2 && /Sổ tay/.test(st.tabs[0].t) && st.tabs[0].sel === 'true' && st.book && !st.list,
          `390×844 ${scheme}: hai tab ${JSON.stringify(st.tabs.map((x) => x.t + (x.sel === 'true' ? '*' : '')))}, tab Sổ tay mở trước (sổ hiện, danh sách ẩn)`);
        verdict('TC-7.6', await noHScroll(page), `390 ${scheme}: tab Sổ tay không tràn ngang`);
        const rc = await ruleCheck(page);
        verdict('TC-7.6', rc.ok, `${scheme} 390: chữ trong sổ nằm giữa hai dòng kẻ — ${rc.rules} dòng kẻ, ${rc.nText} dòng chữ, lệch: ${JSON.stringify(rc.bad)}`);
        await shot(page, scheme === 'light' ? '06-so-tay-390' : '08-so-tay-390-toi', { fullPage: true });
        // mở Hổng kiến thức
        await page.click('#nbHkt summary');
        await page.waitForTimeout(200);
        const mapOpen = await page.evaluate(() => [...document.querySelectorAll('#nbHkt .nb-map-ch')].some((e) => e.checkVisibility()));
        verdict('TC-7.6', mapOpen, `${scheme} 390: bấm "Hổng kiến thức" thì hiện bản đồ chương → bài`);
        const rc2 = await ruleCheck(page);
        verdict('TC-7.6', rc2.ok, `${scheme} 390 (mở bản đồ): chữ vẫn khớp dòng kẻ — lệch: ${JSON.stringify(rc2.bad)}`);
        await page.click('#nbTabList');
        await page.waitForTimeout(250);
        const st2 = await page.evaluate(() => ({ list: getComputedStyle(document.querySelector('.nb-list-pane')).display !== 'none', book: document.querySelector('.nb-book-pane').getBoundingClientRect().height > 0 && getComputedStyle(document.querySelector('.nb-book-pane')).display !== 'none' }));
        await page.click(`.nb-row[data-nbopen="${S.A}#4"]`);
        await page.waitForTimeout(600);
        verdict('TC-7.6', st2.list && !st2.book && (await noHScroll(page)), `${scheme} 390: tab "Câu đã sai" hiện danh sách, ẩn sổ, mở chi tiết không tràn ngang`);
        await shot(page, scheme === 'light' ? '07-cau-sai-390' : '09-cau-sai-390-toi', { fullPage: true });
        // bấm tên lỗi trên điện thoại → chuyển sang tab danh sách đã lọc
        await page.click('#nbTabBook'); await page.waitForTimeout(150);
        await page.click('#nbBook .nb-err-name[data-nbtype="SOT"]'); await page.waitForTimeout(300);
        const st3 = await page.evaluate(() => ({ list: getComputedStyle(document.querySelector('.nb-list-pane')).display !== 'none', keys: [...document.querySelectorAll('#nbList .nb-item')].filter((e) => e.offsetParent !== null).length }));
        const nSot = nbData.items.filter((x) => x.loi && x.loi.ma === 'SOT').length;
        verdict('TC-7.6', st3.list && st3.keys === nSot, `${scheme} 390: bấm tên lỗi SOT → chuyển sang danh sách, còn ${st3.keys}/${nSot} câu`);
        await ctx.close();
      }
    }

    // ---------- TC-7.7 giao diện: BAT_SO_TAY = KHONG ----------
    await api(srv.base, 'adminSaveSettings', { token: S.t, settings: { BAT_SO_TAY: 'KHONG' } });
    {
      const { ctx, page } = await newPage(browser, [1280, 800], 'light', errs, 'off');
      await studentLogin(page, srv.base);
      const nav = await navVisible(page);
      await page.goto(srv.base + '/#/so-tay'); await page.waitForTimeout(800);
      const hasSplit = !!(await page.$('#nbSplit .nb-item'));
      const body = (await page.textContent('main').catch(() => '')).replace(/\s+/g, ' ').slice(0, 120);
      verdict('TC-7.7', !nav && !hasSplit, `BAT_SO_TAY=KHONG: không có mục Sổ tay trên menu; #/so-tay không hiện sổ ("${body}")`);
      let r = null; try { await api(srv.base, 'notebook', { token: S.st }); } catch (e) { r = e.message; }
      verdict('TC-7.7', /tắt sổ tay/.test(r || ''), `BAT_SO_TAY=KHONG: gọi trực tiếp notebook → "${r}"`);
      await page.goto(srv.base + '/#/lich-su'); await page.waitForTimeout(800);
      const hist = await page.textContent('main');
      verdict('TC-7.7', /Đề thử B/.test(hist), 'BAT_SO_TAY=KHONG: trang Lịch sử vẫn bình thường');
      await shot(page, '10-tat-so-tay-1280');
      await ctx.close();
    }
    await api(srv.base, 'adminSaveSettings', { token: S.t, settings: { BAT_SO_TAY: 'CO' } });
  } finally {
    srv.proc.kill();
  }
  verdict('TC-7.6', errs.length === 0, 'không lỗi JS/console: ' + (errs.slice(0, 5).join(' | ') || 'không có'));
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
    const e = (await api(srv.base, 'adminSaveExam', { token: t, exam: { tieuDe: 'Đề cũ thử', lop: '12A1', thoiGian: 50, trangThai: 'MO' }, questions: [TN(1, 'A'), TN(2, 'B')] })).id;
    const s = await api(srv.base, 'startExam', { token: st, examId: e });
    await api(srv.base, 'submitExam', { token: st, attemptToken: s.attemptToken, answers: { 1: 'B', 2: 'B' } });
    const { ctx, page } = await newPage(browser, [390, 844], 'light', errs, ver);
    await studentLogin(page, srv.base);
    const nav = await navVisible(page);
    const home = (await page.textContent('main')).replace(/\s+/g, ' ');
    await page.goto(srv.base + '/#/so-tay'); await page.waitForTimeout(800);
    const split = !!(await page.$('#nbSplit'));
    const msg = (await page.textContent('main')).replace(/\s+/g, ' ').slice(0, 100);
    await page.goto(srv.base + '/#/lich-su'); await page.waitForTimeout(800);
    const hist = await page.textContent('main');
    verdict('TC-7.7', !nav && !split && /Đề cũ thử/.test(home) && /Đề cũ thử/.test(hist) && (await noHScroll(page)),
      `máy chủ ${ver}: không có mục Sổ tay, #/so-tay không vẽ sổ ("${msg.trim()}"); trang chủ và Lịch sử bình thường`);
    await shot(page, 'compat-' + ver.replace(/\./g, '') + '-390');
    await ctx.close();
  } finally { srv.proc.kill(); }
  verdict('TC-7.7', errs.length === 0, `máy chủ ${ver}: không lỗi JS: ` + (errs.slice(0, 4).join(' | ') || 'không có'));
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
