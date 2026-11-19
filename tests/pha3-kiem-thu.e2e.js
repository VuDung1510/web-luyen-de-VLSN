// Kiểm thử độc lập Pha 3 (người kiểm thử) — hộp "Tải file lên", viết theo docs/spec/pha-3-tai-de.md.
// Tự chạy dev-server: máy chủ mới (PORT_NEW, mặc định 8792) và SERVER_COMPAT=1.0.0 (PORT_OLD, mặc định 8793).
//   NODE_PATH=$(npm root -g) LIBS_DIR=<node_modules có katex, chart.js, jszip, xlsx> node tests/pha3-kiem-thu.e2e.js [new|compat|all]
// Biến môi trường: LATENCY_MS (150), SHOTS (docs/bao-cao/anh/pha-3; ảnh kt-*.png), JSON_OUT.
// File mẫu tự sinh trong bộ nhớ (tests/fixtures/pha3-kt-make.js), đưa vào trang bằng setInputFiles.
// Đếm adminUploadImage qua /__stats của dev-server. Mạng CDN bị chặn → route jszip/xlsx/katex/chart sang LIBS_DIR.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const MODE = process.argv[2] || 'all';
const LAT = +(process.env.LATENCY_MS || 150);
const PORT_NEW = +(process.env.PORT_NEW || 8792);
const PORT_OLD = +(process.env.PORT_OLD || 8793);
const SHOTS = process.env.SHOTS || path.join(__dirname, '..', 'docs', 'bao-cao', 'anh', 'pha-3');
const LIBS = process.env.LIBS_DIR;
if (!LIBS) { console.error('Cần LIBS_DIR'); process.exit(2); }
fs.mkdirSync(SHOTS, { recursive: true });
const M = require('./fixtures/pha3-kt-make')(LIBS);
const { t, p, pText, math, O } = M;

const R = { tc: {} };
let TAG = '';
function verdict(tc, pass, evidence) {
  const e = R.tc[tc] || { pass: true, evidence: [] };
  e.pass = e.pass && !!pass; e.evidence.push((pass ? 'OK  ' : 'FAIL ') + TAG + evidence); R.tc[tc] = e;
  console.log(`  ${pass ? '✓' : '✗'} ${tc}: ${TAG}${evidence}`);
}
const shot = async (page, name, opts) => { await page.evaluate(() => document.querySelectorAll('.toast').forEach((e) => e.remove())).catch(() => {}); return page.screenshot(Object.assign({ path: path.join(SHOTS, 'kt-' + name + '.png') }, opts || {})); };
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function startServer(port, env) {
  return new Promise((resolve, reject) => {
    const pr = spawn(process.execPath, [path.join(__dirname, 'dev-server.js'), String(port)], { env: Object.assign({}, process.env, env), stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    pr.stdout.on('data', (d) => { out += d; const m = out.match(/mật khẩu: (\S+)\)/); if (m) resolve({ proc: pr, pw: m[1], base: 'http://localhost:' + port }); });
    pr.stderr.on('data', (d) => { out += d; });
    pr.on('exit', (c) => reject(new Error('dev-server thoát ' + c + ': ' + out)));
    setTimeout(() => reject(new Error('dev-server không khởi động: ' + out)), 10000);
  });
}
async function api(base, action, body) {
  const r = await fetch(base + '/exec', { method: 'POST', body: JSON.stringify(Object.assign({ action }, body || {})) });
  const j = await r.json();
  if (!j.ok) throw new Error(action + ': ' + j.error);
  return j.data;
}
const stats = async (base, reset) => (await (await fetch(base + '/__stats' + (reset ? '?reset=1' : ''))).json());
const uploads = async (base) => ((await stats(base)).actions.adminUploadImage || 0);

// libReq: mảng ghi URL jszip/xlsx được yêu cầu; failLibs: trả 404 cho jszip/xlsx (giả lập CDN hỏng)
async function routeCdn(page, libReq, opts) {
  opts = opts || {};
  await page.route(/fonts\.(googleapis|gstatic)\.com|accounts\.google\.com|lh3\.googleusercontent\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: M.png(8, 8, [90, 90, 90]) }));
  await page.route(/cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net/, (r) => {
    const u = r.request().url();
    if (/jszip|xlsx/.test(u)) { libReq.push(u); if (opts.failLibs) return r.fulfill({ status: 404, body: '' }); }
    const map = [
      [/jszip\/3\.10\.1\/jszip\.min\.js$|jszip@3\.10\.1\/dist\/jszip\.min\.js$/, 'jszip/dist/jszip.min.js', 'text/javascript'],
      [/xlsx\/0\.18\.5\/xlsx\.full\.min\.js$|xlsx@0\.18\.5\/dist\/xlsx\.full\.min\.js$/, 'xlsx/dist/xlsx.full.min.js', 'text/javascript'],
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
async function newEditor(ad, base) {
  await ad.goto(base + '/admin.html#/de-thi/moi');
  await ad.waitForSelector('#btnImport');
  await ad.waitForTimeout(200);
}
async function openFileTab(ad) {
  await ad.click('#btnImport');
  await ad.waitForSelector('#impTabFile');
  await ad.click('#impTabFile');
  await ad.waitForSelector('#impFileInput', { state: 'attached' });
}
// Chọn file rồi đợi bảng kết quả hoặc thông báo lỗi; trả thời gian (ms) từ lúc chọn file tới khi có kết quả
async function upload(ad, name, buffer, mimeType) {
  await ad.evaluate(() => { const r = document.querySelector('#impResult'); if (r) r.innerHTML = ''; window.__ktT0 = performance.now(); });
  await ad.setInputFiles('#impFileInput', { name, mimeType: mimeType || 'application/octet-stream', buffer });
  await ad.waitForFunction(() => {
    const r = document.querySelector('#impResult');
    const txt = r ? r.textContent : '';
    const toast = [...document.querySelectorAll('.toast')].map((e) => e.textContent).join(' ');
    return /Tìm thấy|Không|không|lỗi|hỏng|MB|Chỉ nhận/.test(txt + ' ' + toast) && !/Đọc file…|Đổi công thức…/.test(txt);
  }, null, { timeout: 15000 });
  return ad.evaluate(() => performance.now() - window.__ktT0);
}
const resultText = (ad) => ad.evaluate(() => {
  const r = document.querySelector('#impResult');
  const toast = [...document.querySelectorAll('.toast')].map((e) => e.textContent).join(' | ');
  return ((r ? r.innerText : '') + (toast ? ' || toast: ' + toast : '')).replace(/[ \t]+/g, ' ');
});
// Trạng thái trình soạn: mọi ô data-f + nút đang chọn của từng câu
const editorState = (ad) => ad.$$eval('.qedit', (qs) => qs.map((q) => {
  const o = {};
  q.querySelectorAll('[data-f]').forEach((el) => { o[el.dataset.f] = el.value; });
  o.sel = [...q.querySelectorAll('.sel, [aria-pressed="true"], .active')].map((b) => (b.dataset.key || '') + (b.dataset.tf || '') + b.textContent.trim()).join(',');
  return o;
}));
async function addToExam(ad, replace) {
  await ad.click(replace ? '#impReplace' : '#impAdd');
  await ad.waitForFunction(() => !document.querySelector('.modal #impResult'), null, { timeout: 30000 });
  await ad.waitForTimeout(300);
}
async function pasteImport(ad, tab, text) {
  await ad.click('#btnImport');
  await ad.waitForSelector('#impTabs');
  await ad.click(`#impTabs [data-t="${tab}"]`);
  await ad.fill('#impText', text);
  await ad.click('#impCheck');
  await ad.waitForSelector('text=Tìm thấy');
  await addToExam(ad, true);
}

// ---------- File mẫu ----------
const KEYS1 = 'ABCDABCDABCDABCDAB';
const KEYS2 = ['ĐSĐS', 'ĐĐSS', 'SSĐĐ', 'ĐĐĐS'];
const KEYS3 = ['2,5', '12', '0,75', '300', '-4', '1,2'];
const docx28 = () => M.docx({ body: M.exam28Lines().map(pText).join('') });
// Đề đủ 28 câu có hình (câu 2: 1 hình; câu 5: 2 hình), công thức (câu 3), bảng 2×5 (Phần III câu 1)
async function docxFull() {
  const media = [1, 2, 3].map((k) => ({ rid: 'rIdF' + k, file: `image${k}.png`, data: M.png(160, 90, [k * 70, 120, 60]) }));
  const L = M.exam28Lines();
  const body = []; let part = 0;
  for (const line of L) {
    if (/^PHẦN/.test(line)) part++;
    if (part === 1 && /^Câu 3\./.test(line)) { body.push(p(t(line + ' Biết '), math(M.FORMULAS[10].omml), t(' và '), math(M.FORMULAS[0].omml), t('.'))); continue; }
    body.push(pText(line));
    if (part === 1 && /^Câu 2\./.test(line)) body.push(p(M.drawingInline('rIdF1')));
    if (part === 1 && /^Câu 5\./.test(line)) body.push(p(t('Hình 1: '), M.drawingInline('rIdF2'), t(' Hình 2: '), M.drawingInline('rIdF3')));
    if (part === 3 && /^Câu 1\./.test(line)) body.push(M.table([['t (s)', '0', '2', '4', '6'], ['v (m/s)', '0', '5', '10', '15']]));
  }
  return M.docx({ body: body.join(''), media });
}
async function docxImg() { // TC-3.5: 6 câu, hình ở câu 2 (1) và câu 5 (2)
  const media = [1, 2, 3].map((k) => ({ rid: 'rIdP' + k, file: `image${k}.png`, data: M.png(60 + k, 40, [k * 60, 100, 200]) }));
  const body = [pText('PHẦN I'), ...[1, 2, 3, 4, 5, 6].flatMap((i) => {
    const s = i === 2 ? [p(t('Câu 2. Quan sát hình bên.')), p(M.drawingInline('rIdP1'))]
      : i === 5 ? [p(t('Câu 5. Hai hình: '), M.drawingInline('rIdP2'), t(' và ')), p(M.drawingInline('rIdP3'), t(' chọn đáp án.'))]
        : [pText(`Câu ${i}. Câu không có hình ${i}.`)];
    return [...s, pText('A. a1'), pText('B. b1'), pText('C. c1'), pText('D. d1'), pText('Đáp án: B')];
  })].join('');
  return M.docx({ body, media });
}
async function docxWarn() { // TC-3.3 + TC-3.7: anchor (câu 1), VML (câu 3), ma trận (câu 4), EMF (câu 5), OLE (câu 6), WMF (Phần II câu 1)
  const media = [{ rid: 'rIdA', file: 'image1.png', data: M.png(50, 30, [200, 10, 10]) }, { rid: 'rIdV', file: 'image2.png', data: M.png(52, 30, [10, 200, 10]) },
    { rid: 'rIdE', file: 'image3.emf', data: M.fakeEmf() }, { rid: 'rIdW', file: 'image4.wmf', data: M.fakeWmf() }, { rid: 'rIdOle', file: 'image5.wmf', data: M.fakeWmf() }];
  const opts = [pText('A. một'), pText('B. hai'), pText('C. ba'), pText('D. bốn'), pText('Đáp án: C')];
  const stems = {
    1: p(t('Câu 1. Hình nổi: '), M.drawingAnchor('rIdA')),
    2: p(t('Câu 2. Công thức đúng '), math(M.FORMULAS[4].omml)),
    3: p(t('Câu 3. Hình VML: '), M.vml('rIdV')),
    4: p(t('Câu 4. Ma trận '), math(O.matrix([['1', '0'], ['0', '1']])), t(' và '), math(O.r('F=ma'))),
    5: p(t('Câu 5. Hình EMF: '), M.drawingInline('rIdE')),
    6: p(t('Câu 6. MathType '), M.ole('rIdOle'), t(' cho biết'))
  };
  const body = [pText('PHẦN I'), ...[1, 2, 3, 4, 5, 6].flatMap((i) => [stems[i], ...opts]),
    pText('PHẦN II'), p(t('Câu 1. Hình WMF: '), M.vml('rIdW')), pText('a) x'), pText('b) y'), pText('c) z'), pText('d) w'), pText('Đáp án: ĐSĐS')].join('');
  return M.docx({ body, media, oles: [{ rid: 'rIdOle' }] });
}
const docxFormulas = () => M.docx({ body: pText('PHẦN III') + M.FORMULAS.map((f, i) => p(t(`Câu ${i + 1}. Công thức ${f.id}: `), math(f.omml)) + pText('Đáp án: 1')).join('') });
const docxTable = () => M.docx({ body: [pText('PHẦN I'), pText('Câu 1. Bảng vận tốc theo thời gian.'), M.table([['t (s)', '0', '2', '4', '6'], ['v (m/s)', '0', '5', '10', '15']]),
  pText('Gia tốc của vật là'), pText('A. 2,5 m/s²'), pText('B. 5 m/s²'), pText('C. 1 m/s²'), pText('D. 10 m/s²'), pText('Đáp án: A')].join('') });
async function docxBig() {
  const media = [1, 2, 3, 4, 5].map((k) => ({ rid: 'rIdB' + k, file: `image${k}.png`, data: M.png(400, 300, [k * 40, 50, 90]) }));
  const body = [pText('PHẦN I')];
  for (let i = 1; i <= 40; i++) {
    const runs = [t(`Câu ${i}. Tính toán: `)];
    for (let k = 0; k < 10; k++) runs.push(math(M.FORMULAS[(i + k) % 20].omml), t('; '));
    if (i % 8 === 0) runs.push(M.drawingInline('rIdB' + i / 8));
    body.push(p(...runs), pText('A. 1'), pText('B. 2'), pText('C. 3'), pText('D. 4'), pText('Đáp án: A'));
  }
  return M.docx({ body: body.join(''), media });
}

// ---------- Kịch bản cho một chế độ máy chủ ----------
async function runMode(browser, compat) {
  TAG = compat ? '[1.0.0] ' : '[mới] ';
  const errors = [];
  const srv = await startServer(compat ? PORT_OLD : PORT_NEW, Object.assign({ LATENCY_MS: String(LAT) }, compat ? { SERVER_COMPAT: '1.0.0' } : {}));
  const B = srv.base;
  try {
    const tok = (await api(B, 'loginAdminPassword', { password: srv.pw })).token;
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    const ad = await ctx.newPage();
    const libReq = [];
    watchErrors(ad, errors, 'admin');
    ad.on('dialog', (d) => d.accept());
    await routeCdn(ad, libReq);

    // ---- TC-3.12: thư viện chỉ tải khi mở tab ----
    await adminLogin(ad, B, srv.pw);
    const htmlHasLib = /jszip|xlsx\.full/.test(await (await fetch(B + '/admin.html')).text());
    for (const nav of ['exams', 'students', 'results', 'settings']) { await ad.click(`a[data-nav="${nav}"]`).catch(() => {}); await ad.waitForTimeout(LAT + 300); }
    await newEditor(ad, B);
    await ad.click('#btnImport'); await ad.waitForSelector('#impTabs'); await ad.waitForTimeout(500);
    const before = libReq.length;
    const scriptsBefore = await ad.$$eval('script[src]', (s) => s.map((x) => x.src).filter((u) => /jszip|xlsx/.test(u)).length);
    await ad.click('#impTabFile');
    await ad.waitForFunction(() => window.JSZip && window.XLSX, null, { timeout: 15000 }).catch(() => {});
    const after = libReq.slice();
    verdict('TC-3.12', before === 0 && scriptsBefore === 0 && !htmlHasLib && after.some((u) => /jszip\/3\.10\.1\/jszip\.min\.js/.test(u)) && after.some((u) => /xlsx\/0\.18\.5\/xlsx\.full\.min\.js/.test(u)),
      `đăng nhập + 4 trang + trình soạn + mở hộp nhập (tab Dán văn bản): ${before} yêu cầu jszip/xlsx, admin.html không chứa thẻ thư viện: ${!htmlHasLib}; mở tab "Tải file lên" → ${after.length} yêu cầu: ${after.map((u) => u.replace(/^https:\/\//, '')).join(', ')}`);
    await shot(ad, compat ? '08-hop-tai-file-1.0.0' : '01-hop-tai-file');
    await ad.click('.modal [data-close]'); await ad.waitForTimeout(200);

    // ---- TC-3.1: docx 28 câu = dán văn bản ----
    const lines = M.exam28Lines();
    await newEditor(ad, B);
    await pasteImport(ad, 'text', lines.join('\n'));
    const sPaste = await editorState(ad);
    await openFileTab(ad);
    await upload(ad, 'de-28-cau.docx', await docx28(), DOCX);
    const res28 = await resultText(ad);
    await addToExam(ad, true);
    const sDoc = await editorState(ad);
    const same = JSON.stringify(sPaste) === JSON.stringify(sDoc);
    const keys = sDoc.map((q) => q.loai + ':' + q.sel).join(' ');
    verdict('TC-3.1', /Tìm thấy\s*28\s*câu/.test(res28) && /Phần I:\s*18\s*·\s*Phần II:\s*4\s*·\s*Phần III:\s*6/.test(res28) && sDoc.length === 28 && same,
      `bảng kết quả: "${res28.split('\n').slice(1, 3).join(' / ').slice(0, 140)}"; trình soạn ${sDoc.length} câu, giống hệt khi dán văn bản (mọi ô + đáp án đã chọn): ${same}`);
    verdict('TC-3.1', sDoc.slice(0, 18).every((q, i) => q.loai === 'TN' && q.sel.startsWith(KEYS1[i])) && sDoc.slice(18, 22).every((q) => q.loai === 'DS') && sDoc.slice(22).every((q, i) => q.loai === 'TL' && q.dapAn === KEYS3[i]),
      `loại + đáp án trong trình soạn: ${keys.slice(0, 160)}…`);

    // ---- TC-3.5: 3 hình ở câu 2, 5, 5; tải lên đúng 1 lần/hình, chỉ sau khi bấm Thêm ----
    await newEditor(ad, B);
    await stats(B, true);
    await openFileTab(ad);
    await upload(ad, 'de-hinh.docx', await docxImg(), DOCX);
    const upBefore = await uploads(B);
    await ad.click('.modal [data-close]'); await ad.waitForTimeout(300); // Hủy
    const upCancel = await uploads(B);
    await openFileTab(ad);
    await upload(ad, 'de-hinh.docx', await docxImg(), DOCX);
    const upBefore2 = await uploads(B);
    await addToExam(ad, true);
    await ad.waitForTimeout(500);
    const upAfter = await uploads(B);
    const sImg = await editorState(ad);
    const q2 = sImg[1] || {}, q5 = sImg[4] || {};
    const md5 = (q5.noiDung || '').match(/!\[\]\([^)]+\)/g) || [];
    const urls = [q2.hinhAnh, q5.hinhAnh, ...md5].filter(Boolean);
    verdict('TC-3.5', upBefore === 0 && upCancel === 0 && upBefore2 === 0 && upAfter === 3,
      `adminUploadImage: sau khi đọc file ${upBefore}, bấm Hủy ${upCancel}, đọc lại ${upBefore2}, sau "Thay toàn bộ" ${upAfter} (mong 0/0/0/3)`);
    verdict('TC-3.5', /^https?:/.test(q2.hinhAnh || '') && !/!\[\]/.test(q2.noiDung) && /^https?:/.test(q5.hinhAnh || '') && md5.length === 1 && new Set(urls).size === 3 &&
      sImg.filter((q, i) => i !== 1 && i !== 4).every((q) => !q.hinhAnh && !/!\[\]/.test(q.noiDung)),
      `câu 2 hinhAnh=${q2.hinhAnh}; câu 5 hinhAnh=${q5.hinhAnh}, nội dung có ${md5.length} "![](…)"; 3 URL khác nhau: ${new Set(urls).size === 3}; câu khác không có hình`);

    // ---- TC-3.3 + TC-3.7: ma trận, OLE, anchor, VML, EMF, WMF ----
    await newEditor(ad, B);
    await stats(B, true);
    await openFileTab(ad);
    await upload(ad, 'de-canh-bao.docx', await docxWarn(), DOCX);
    const resW = await resultText(ad);
    const warnTxt = await ad.$eval('#impWarn', (e) => e.innerText).catch(() => '');
    if (!compat) { await ad.$eval('#impWarn', (e) => e.scrollIntoView({ block: 'center' })).catch(() => {}); await shot(ad, '02-ket-qua-canh-bao'); }
    await addToExam(ad, true);
    await ad.waitForTimeout(400);
    const upW = await uploads(B);
    const sW = await editorState(ad);
    const nums = await ad.$$eval('.qedit .q-num', (e) => e.map((x) => x.textContent.trim()));
    // số câu trong cảnh báo phải trỏ tới đúng câu trong trình soạn (Phần II câu 1 là câu thứ 7)
    const wq = (re) => { const m = warnTxt.split('\n').find((l) => re.test(l)); return m ? +(/Câu (\d+)/.exec(m) || [])[1] : null; };
    const wMat = wq(/công thức cần gõ lại/), wOle = wq(/MathType/), wEmf = warnTxt.split('\n').filter((l) => /chụp lại|PNG/.test(l)).map((l) => +(/Câu (\d+)/.exec(l) || [])[1]);
    verdict('TC-3.3', sW.length === 7 && wMat === 4 && wOle === 6 && /Convert Equations/.test(warnTxt) && /⟦/.test(sW[3].noiDung) && /\$F = ma\$/.test(sW[3].noiDung) && !errors.length,
      `7/7 câu vào trình soạn; cảnh báo ma trận → câu ${wMat} (mong 4), OLE → câu ${wOle} (mong 6), có gợi ý Convert Equations: ${/Convert Equations/.test(warnTxt)}; câu 4: "${(sW[3] || {}).noiDung}"`);
    verdict('TC-3.7', JSON.stringify(wEmf) === '[5,7]' && upW === 2 && /^https?:/.test(sW[0].hinhAnh || '') && /^https?:/.test(sW[2].hinhAnh || '') && !sW[4].hinhAnh && !sW[6].hinhAnh && /Cần chụp lại:\s*2/.test(resW),
      `hình nổi câu 1: ${!!sW[0].hinhAnh}; VML câu 3: ${!!sW[2].hinhAnh}; cảnh báo "chụp lại / PNG" ở câu ${JSON.stringify(wEmf)} (mong [5,7] = EMF câu 5, WMF Phần II câu 1 = câu 7 trong trình soạn "${nums[6]}"); adminUploadImage = ${upW} (mong 2); bảng: "${(resW.match(/Hình[^\n]*/) || [''])[0]}"`);
    // Tô vàng câu còn mốc ⟦…⟧ trong trình soạn
    const hl = await ad.evaluate(() => {
      const qs = [...document.querySelectorAll('.qedit')];
      const bg = (el) => getComputedStyle(el).backgroundColor;
      const q4 = qs[3], q3 = qs[2];
      const ta = q4.querySelector('textarea[data-f="noiDung"]'), ta3 = q3.querySelector('textarea[data-f="noiDung"]');
      return { q4: bg(q4), q3: bg(q3), ta4: bg(ta), ta3: bg(ta3), border4: getComputedStyle(q4).borderColor, border3: getComputedStyle(q3).borderColor, label: /cần gõ lại/i.test(q4.textContent) };
    });
    const yellow = (c) => { const m = /(\d+), (\d+), (\d+)/.exec(c || ''); return m && +m[1] > 200 && +m[2] > 170 && +m[3] < 200 && +m[1] - +m[3] > 40; };
    verdict('TC-3.3 (tô vàng)', (yellow(hl.q4) || yellow(hl.ta4)) && !yellow(hl.q3) && !yellow(hl.ta3),
      `câu 4 (còn ⟦…⟧): nền khung ${hl.q4}, ô nội dung ${hl.ta4}, nhãn "cần gõ lại": ${hl.label}; câu 3 (không mốc): ${hl.q3} / ${hl.ta3}`);
    if (!compat) {
      await ad.$eval('.qedit:nth-of-type(4)', (e) => e.scrollIntoView({ block: 'center' })).catch(() => {});
      await (await ad.$$('.qedit'))[3].scrollIntoViewIfNeeded();
      await ad.waitForTimeout(200);
      await shot(ad, '04-moc-to-vang');
      // Sửa hết mốc → hết tô vàng
      await ad.fill('.qedit:nth-of-type(4) textarea[data-f="noiDung"], .qedit[data-q="3"] textarea[data-f="noiDung"]', 'Ma trận đơn vị và $F = ma$');
      await ad.waitForTimeout(300);
      const still = await ad.$eval('.qedit[data-q="3"]', (e) => getComputedStyle(e).backgroundColor + ' | ' + getComputedStyle(e.querySelector('textarea[data-f="noiDung"]')).backgroundColor).catch(() => '?');
      verdict('TC-3.3 (tô vàng)', !yellow(still.split(' | ')[0]) && !yellow(still.split(' | ')[1]), `gõ lại công thức → câu 4 hết tô vàng: ${still}`);
    }

    // ---- TC-3.2 (giao diện): 20 công thức hiển thị bằng KaTeX, không lỗi ----
    await newEditor(ad, B);
    await openFileTab(ad);
    await upload(ad, 'cong-thuc.docx', await docxFormulas(), DOCX);
    const kq = await ad.evaluate(() => ({ k: document.querySelectorAll('#impList .katex').length, e: document.querySelectorAll('#impList .katex-error').length, raw: /\$/.test(document.querySelector('#impList').innerText), mark: document.querySelectorAll('#impList .todo-mark, #impList mark').length }));
    const r20 = await resultText(ad);
    verdict('TC-3.2', kq.k >= 20 && kq.e === 0 && !kq.raw && kq.mark === 0 && /Đã đổi:\s*20/.test(r20) && /Chưa đổi được:\s*0/.test(r20),
      `xem trước: ${kq.k} công thức KaTeX, ${kq.e} .katex-error, còn chữ "$" thô: ${kq.raw}, mốc ⟦…⟧: ${kq.mark}; bảng: "${(r20.match(/Công thức[^\n]*/) || [''])[0]}"`);
    if (!compat) { await ad.$eval('#impList', (e) => e.scrollIntoView({ block: 'start' })); await shot(ad, '03-cau-cong-thuc'); }
    await ad.click('.modal [data-close]'); await ad.waitForTimeout(200);

    // ---- TC-3.6: bảng 2×5 hiển thị thành bảng ----
    await newEditor(ad, B);
    await openFileTab(ad);
    await upload(ad, 'bang.docx', await docxTable(), DOCX);
    const tb = await ad.evaluate(() => { const tbl = document.querySelector('#impList table'); return tbl ? { rows: tbl.rows.length, cols: tbl.rows[0].cells.length, txt: tbl.innerText.replace(/\s+/g, ' ') } : null; });
    await addToExam(ad, true);
    const tbEd = (await editorState(ad))[0] || {};
    verdict('TC-3.6', tb && tb.rows === 2 && tb.cols === 5 && /\[BẢNG\] t \(s\) \| 0 \| 2 \| 4 \| 6\nv \(m\/s\) \| 0 \| 5 \| 10 \| 15/.test(tbEd.noiDung || ''),
      `xem trước: <table> ${tb ? tb.rows + ' hàng × ' + tb.cols + ' cột "' + tb.txt + '"' : 'KHÔNG có'}; trình soạn: ${JSON.stringify((tbEd.noiDung || '').slice(0, 90))}`);

    // ---- TC-3.8: .xlsx / .csv = dán TSV ----
    const H = M.SHEET_HEADER, rows = M.SHEET_ROWS;
    const cases = [['xlsx không tiêu đề', 'a.xlsx', M.xlsx(rows), M.tsv(rows)], ['xlsx có tiêu đề', 'b.xlsx', M.xlsx([H, ...rows]), M.tsv([H, ...rows])],
      ['csv có tiêu đề', 'c.csv', M.csv([H, ...rows]), M.tsv([H, ...rows])], ['csv không tiêu đề', 'd.csv', M.csv(rows), M.tsv(rows)]];
    for (const [name, fn, buf, tsv] of cases) {
      await newEditor(ad, B);
      await pasteImport(ad, 'tsv', tsv);
      const a = await editorState(ad);
      await openFileTab(ad);
      await upload(ad, fn, buf);
      await addToExam(ad, true);
      const b = await editorState(ad);
      verdict('TC-3.8', a.length === 4 && JSON.stringify(a) === JSON.stringify(b), `${name}: ${b.length} câu, trình soạn giống hệt dán TSV (${a.length} câu): ${JSON.stringify(a) === JSON.stringify(b)}`);
    }

    // ---- TC-3.9: 40 câu × 10 công thức + 5 hình < 5 s (không tính tải hình) ----
    await newEditor(ad, B);
    await openFileTab(ad);
    const big = await docxBig();
    const ms = await upload(ad, 'de-40-cau.docx', big, DOCX);
    const r40 = await resultText(ad);
    verdict('TC-3.9', ms < 5000 && /Tìm thấy\s*40/.test(r40) && /Đã đổi:\s*400/.test(r40), `${(big.length / 1024).toFixed(0)} KB: từ lúc chọn file tới bảng kết quả ${ms.toFixed(0)} ms (Chromium); "${(r40.match(/Công thức[^\n]*/) || [''])[0]}"`);
    await ad.click('.modal [data-close]'); await ad.waitForTimeout(200);

    // ---- TC-3.10: > 10 MB, sai loại, docx hỏng ----
    await newEditor(ad, B);
    await openFileTab(ad);
    const bigBuf = Buffer.concat([await docx28(), Buffer.alloc(10 * 1024 * 1024, 1)]);
    const bad = [['file 10,x MB', 'lon.docx', bigBuf, DOCX], ['PDF', 'de.pdf', Buffer.from('%PDF-1.4\n1 0 obj\n'), 'application/pdf'], ['ảnh .png', 'anh.png', M.png(4, 4, [0, 0, 0]), 'image/png'],
      ['.doc Word 97', 'cu.doc', Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), Buffer.alloc(400)]), 'application/msword'],
      ['docx hỏng', 'hong.docx', Buffer.from(Array.from({ length: 4000 }, (_, i) => (i * 7919) & 255)), DOCX]];
    const vi = /[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựáàãéèíìóòõúùýĐ]/;
    for (const [name, fn, buf, mime] of bad) {
      const t0 = Date.now();
      let txt = '', err = null;
      try { await upload(ad, fn, buf, mime); txt = await resultText(ad); } catch (e) { err = e.message; txt = await resultText(ad); }
      const alive = await Promise.race([ad.evaluate(() => 1), new Promise((r) => setTimeout(() => r(0), 2000))]);
      const addDis = await ad.$eval('#impAdd', (e) => e.disabled).catch(() => null);
      verdict('TC-3.10', !err && vi.test(txt) && !/Tìm thấy/.test(txt) && alive === 1 && addDis === true,
        `${name} → "${txt.replace(/\n/g, ' ').slice(0, 120)}" sau ${Date.now() - t0} ms; trang còn phản hồi: ${alive === 1}; nút Thêm khóa: ${addDis}`);
    }
    const tOk = await upload(ad, 'de-28-cau.docx', await docx28(), DOCX);
    verdict('TC-3.10', /Tìm thấy\s*28/.test(await resultText(ad)), `sau các file lỗi, chọn lại file đúng vẫn đọc được (${tOk.toFixed(0)} ms)`);
    await ad.click('.modal [data-close]'); await ad.waitForTimeout(200);

    // ---- Thêm: một hình dùng ở 2 câu → tải lên 1 lần (TC-3.5 "mỗi hình đúng 1 lần") ----
    await newEditor(ad, B);
    await stats(B, true);
    await openFileTab(ad);
    const dupBuf = await M.docx({ media: [{ rid: 'rIdD', file: 'image1.png', data: M.png(30, 30, [5, 5, 200]) }],
      body: [pText('PHẦN I'), p(t('Câu 1. Hình '), M.drawingInline('rIdD')), pText('A. a'), pText('B. b'), pText('C. c'), pText('D. d'), pText('Đáp án: A'),
        p(t('Câu 2. Lại hình đó '), M.drawingInline('rIdD')), pText('A. a'), pText('B. b'), pText('C. c'), pText('D. d'), pText('Đáp án: B')].join('') });
    await upload(ad, 'hinh-lap.docx', dupBuf, DOCX);
    await addToExam(ad, true);
    const sDup = await editorState(ad);
    const upDup = await uploads(B);
    verdict('TC-3.5 (một hình dùng 2 câu)', upDup === 1 && sDup[0].hinhAnh && sDup[0].hinhAnh === sDup[1].hinhAnh, `adminUploadImage = ${upDup} (mong 1); hai câu cùng URL: ${sDup[0].hinhAnh === sDup[1].hinhAnh}`);

    // ---- Thêm: chữ dạng HTML trong file / tên file không được chạy (an toàn) ----
    await newEditor(ad, B);
    await openFileTab(ad);
    const xssBuf = await M.docx({ body: [pText('PHẦN I'), pText('Câu 1. <img src=x onerror="window.__kt1=1"> chọn đáp án'), pText('A. <b onmouseover="window.__kt3=1">in đậm</b>'),
      pText('B. <script>window.__kt4=1</script>'), pText('C. c'), pText('D. d'), pText('Đáp án: A')].join('') });
    await upload(ad, '<img src=y onerror="window.__kt2=1">.docx', xssBuf, DOCX);
    await ad.waitForTimeout(300);
    const x1 = await ad.evaluate(() => ({ run: !!(window.__kt1 || window.__kt2 || window.__kt3 || window.__kt4), inj: document.querySelectorAll('.modal img[src="x"], .modal img[src="y"], .modal b[onmouseover], .modal script').length, txt: /onerror/.test(document.querySelector('#impResult').textContent) }));
    await addToExam(ad, true);
    const x2 = await ad.evaluate(() => ({ run: !!(window.__kt1 || window.__kt2 || window.__kt3 || window.__kt4), inj: document.querySelectorAll('main img[src="x"], main b[onmouseover]').length }));
    verdict('An toàn HTML trong file', !x1.run && !x1.inj && x1.txt && !x2.run && !x2.inj, `xem trước: mã chạy ${x1.run}, phần tử chèn ${x1.inj}, chữ hiện nguyên văn ${x1.txt}; trình soạn: mã chạy ${x2.run}, phần tử chèn ${x2.inj}`);

    // ================= Vòng 2 =================
    // .txt đọc như Dán văn bản; trình soạn giống hệt dán
    await newEditor(ad, B);
    await pasteImport(ad, 'text', M.exam28Lines().join('\n'));
    const sP = await editorState(ad);
    await openFileTab(ad);
    await upload(ad, 'de.txt', Buffer.from(M.exam28Lines().join('\r\n'), 'utf8'), 'text/plain');
    const rTxt = await resultText(ad);
    await addToExam(ad, true);
    const sT = await editorState(ad);
    verdict('V2 .txt như Dán văn bản', /Tìm thấy\s*28/.test(rTxt) && JSON.stringify(sP) === JSON.stringify(sT), `.txt → "${(rTxt.match(/Tìm thấy[^\n]*/) || [''])[0]}"; trình soạn giống dán văn bản: ${JSON.stringify(sP) === JSON.stringify(sT)}`);
    // csv sai cột → cảnh báo câu thiếu nội dung trong bảng kết quả
    await openFileTab(ad);
    await upload(ad, 'mot-cot.csv', Buffer.from('Câu 1. Một câu hỏi\nCâu 2. Câu khác'), 'text/csv');
    const wCsv = await ad.$eval('#impWarn', (e) => e.innerText).catch(() => '');
    verdict('V2 cảnh báo câu thiếu nội dung', /Câu 1[^\n]*không có nội dung/.test(wCsv) && /Câu 2[^\n]*không có nội dung/.test(wCsv), `csv một cột → "${wCsv.replace(/\n/g, ' / ').slice(0, 160)}"`);
    // Kéo thả lọc đuôi: thả .pdf / .png → "Chỉ nhận…"; thả .docx → đọc được
    const dropFile = async (name, b64, type) => ad.evaluate(async ({ name, b64, type }) => {
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const dt = new DataTransfer(); dt.items.add(new File([bin], name, { type }));
      const z = document.querySelector('#impDrop');
      ['dragenter', 'dragover', 'drop'].forEach((t) => z.dispatchEvent(new DragEvent(t, { bubbles: true, cancelable: true, dataTransfer: dt })));
      await new Promise((r) => setTimeout(r, 900));
      return document.querySelector('#impResult').innerText;
    }, { name, b64: b64, type });
    const dPdf = await dropFile('de.pdf', Buffer.from('%PDF-1.4').toString('base64'), 'application/pdf');
    const dPng = await dropFile('anh.png', M.png(4, 4, [1, 2, 3]).toString('base64'), 'image/png');
    const dDoc = await dropFile('de.docx', (await docx28()).toString('base64'), DOCX);
    verdict('V2 kéo thả lọc đuôi', /Chỉ nhận/.test(dPdf) && /Chỉ nhận/.test(dPng) && /Tìm thấy\s*28/.test(dDoc), `thả .pdf → "${dPdf.replace(/\n/g, ' ').slice(0, 90)}"; thả .png → "${dPng.replace(/\n/g, ' ').slice(0, 60)}"; thả .docx → "${(dDoc.match(/Tìm thấy[^\n]*/) || ['?'])[0]}"`);
    await ad.click('.modal [data-close]'); await ad.waitForTimeout(200);
    // "Công thức trong câu hỏi": công thức ngoài câu (đầu đề) không tính
    await newEditor(ad, B);
    await openFileTab(ad);
    const nBuf = await M.docx({ body: [p(t('Cho biết '), math(O.r('g=9,8')), t(' và '), math(O.r('R=8,31'))), pText('PHẦN I'), p(t('Câu 1. Tính '), math(O.r('F=ma'))), pText('A. a'), pText('B. b'), pText('C. c'), pText('D. d'), pText('Đáp án: A')].join('') });
    await upload(ad, 'ngoai-cau.docx', nBuf, DOCX);
    const rN = await resultText(ad);
    const rowN = (rN.match(/Công thức[^\n]*\n?[^\n]*/) || [''])[0].replace(/\n/g, ' ');
    verdict('V2 dòng "Công thức trong câu hỏi"', /Công thức trong câu hỏi/.test(rN) && /Đã đổi:\s*1\b/.test(rN), `2 công thức ở "Cho biết" trước PHẦN + 1 trong câu → "${rowN}"`);
    await ad.click('.modal [data-close]'); await ad.waitForTimeout(200);
    // Tải hình lỗi → câu vẫn thêm, nhãn "hình cần chụp lại" trong trình soạn
    await newEditor(ad, B);
    await ad.route(/\/exec$/, (route) => {
      const body = route.request().postData() || '';
      if (/"adminUploadImage"/.test(body)) return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ ok: false, error: 'Lỗi giả lập khi tải hình' }) });
      return route.continue();
    });
    await openFileTab(ad);
    await upload(ad, 'de-hinh.docx', await docxImg(), DOCX);
    await ad.click('#impReplace');
    await ad.waitForFunction(() => !document.querySelector('.modal #impResult'), null, { timeout: 30000 }).catch(() => {});
    await ad.waitForTimeout(500);
    const hl2 = await ad.evaluate(() => ({ n: document.querySelectorAll('.qedit').length, modal: !!document.querySelector('.modal #impResult'), lab: [...document.querySelectorAll('.qedit')].map((q, i) => (q.querySelector('[data-hinhloi]') ? (i + 1) + ':' + q.querySelector('[data-hinhloi]').textContent.trim() : null)).filter(Boolean), msg: [...document.querySelectorAll('.toast, .modal')].map((e) => e.innerText).join(' | ').slice(0, 200) }));
    await ad.unroute(/\/exec$/);
    if (hl2.modal) { await ad.click('.modal [data-close]').catch(() => {}); }
    if (!compat) { const el = (await ad.$$('.qedit'))[4]; if (el) { await el.scrollIntoViewIfNeeded(); await shot(ad, '10-nhan-hinh-loi'); } }
    verdict('V2 nhãn "hình cần chụp lại" khi tải hình lỗi', hl2.n === 6 && hl2.lab.length === 2 && /^2:/.test(hl2.lab[0]) && /^5:.*2 hình/.test(hl2.lab[1]),
      `adminUploadImage trả lỗi → ${hl2.n} câu vẫn vào trình soạn, nhãn: ${JSON.stringify(hl2.lab)}; thông báo: "${hl2.msg.replace(/\n/g, ' ').slice(0, 120)}"`);
    // Bom nén / XML độc trong giao diện → báo tiếng Việt, trang không treo
    await newEditor(ad, B);
    await openFileTab(ad);
    const zb = new M.JSZip(); zb.file('[Content_Types].xml', '<Types/>'); zb.file('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>' + ' '.repeat(80 * 1024 * 1024) + '</w:t></w:r></w:p></w:body></w:document>');
    const bomb = await zb.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });
    const zq = new M.JSZip(); zq.file('word/document.xml', '<w:document><w:body><w:p ' + 'a="<b '.repeat(50000) + '</w:body></w:document>');
    const quad = await zq.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    for (const [name, buf] of [['bom nén 80 MB', bomb], ['XML 50 000 thuộc tính hỏng', quad]]) {
      const t0 = Date.now(); let txt = '';
      try { await upload(ad, 'bom.docx', buf, DOCX); } catch (e) { /* đọc lại bên dưới */ }
      txt = await resultText(ad);
      const alive = await Promise.race([ad.evaluate(() => 1), new Promise((r) => setTimeout(() => r(0), 2000))]);
      verdict('V2 file hỏng / bom nén', alive === 1 && Date.now() - t0 < 6000 && /bất thường|hỏng|Tìm thấy\s*0|Không/.test(txt), `${name} (${(buf.length / 1024).toFixed(0)} KB) → "${txt.replace(/\n/g, ' ').slice(0, 130)}" sau ${Date.now() - t0} ms; trang còn phản hồi: ${alive === 1}`);
    }
    await ad.click('.modal [data-close]'); await ad.waitForTimeout(200);

    // ---- TC-3.11: tải docx → lưu đề → học sinh làm được ----
    const title = 'KT Pha 3 ' + (compat ? '1.0.0' : 'mới') + ' — đề tải từ Word';
    await newEditor(ad, B);
    await ad.fill('#eTitle', title);
    await ad.selectOption('#eStatus', 'MO');
    await ad.fill('#eTime', '50');
    await stats(B, true);
    await openFileTab(ad);
    await upload(ad, 'de-day-du.docx', await docxFull(), DOCX);
    await addToExam(ad, true);
    const upFull = await uploads(B);
    await ad.click('#btnSave');
    await ad.waitForSelector('text=Đã lưu đề', { timeout: 15000 });
    const ex = (await api(B, 'adminListExams', { token: tok })).find((e) => e.tieuDe === title);
    const full = ex ? await api(B, 'adminGetExam', { token: tok, examId: ex.id }) : { questions: [] };
    const qsv = full.questions;
    const expKeys = [...KEYS1].concat(KEYS2, KEYS3);
    const keyOk = qsv.length === 28 && qsv.every((q, i) => String(q.dapAn).replace(/D/g, 'Đ') === expKeys[i] || String(q.dapAn) === expKeys[i]);
    const svQ = (i) => qsv[i] || {};
    verdict('TC-3.11', keyOk && /^https?:/.test(svQ(1).hinhAnh) && /^https?:/.test(svQ(4).hinhAnh) && /!\[\]\(/.test(svQ(4).noiDung) && /\$T_\{1\} = 300/.test(svQ(2).noiDung) && /\[BẢNG\]/.test(svQ(22).noiDung) && upFull === 3,
      `đã lưu "${title}" (${ex ? ex.id : 'KHÔNG THẤY'}): ${qsv.length} câu, đáp án khớp: ${keyOk}; câu 2/5 có hình, câu 3 có công thức, P3 câu 1 có [BẢNG]; adminUploadImage = ${upFull}`);
    await ctx.close();

    // Học sinh làm đề
    const sctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const st = await sctx.newPage();
    watchErrors(st, errors, 'hs');
    await routeCdn(st, []);
    await st.goto(B + '/');
    await st.waitForSelector('#selClass option[value="12A1"]', { state: 'attached' });
    await st.selectOption('#selClass', '12A1');
    await st.waitForSelector('#selStudent option[value="HS0001"]', { state: 'attached' });
    await st.selectOption('#selStudent', 'HS0001');
    await st.fill('#pin', '0101');
    await st.click('#btnLogin');
    await st.waitForSelector('text=Đề đang mở');
    await st.waitForSelector(`text=${title}`);
    const card = st.locator('.card, .exam, li, article', { hasText: title }).last();
    await card.locator('text=Bắt đầu làm bài').first().click().catch(async () => { await st.click(`text=${title}`); await st.click('text=Bắt đầu làm bài'); });
    await st.waitForSelector('#btnStart');
    if (!compat && (await st.$('[data-goal="8"]'))) await st.click('[data-goal="8"]');
    await st.click('#btnStart');
    await st.waitForSelector('.timer');
    await st.waitForTimeout(500);
    const qs = await st.$$('.q');
    const view = await st.evaluate(() => {
      const q = [...document.querySelectorAll('.q')];
      return { n: q.length, img2: !!(q[1] && q[1].querySelector('img')), img5: q[4] ? q[4].querySelectorAll('img').length : 0, kx3: q[2] ? q[2].querySelectorAll('.katex').length : 0,
        tbl: q[22] ? (q[22].querySelector('table') ? q[22].querySelector('table').rows.length + 'x' + q[22].querySelector('table').rows[0].cells.length : null) : null, kerr: document.querySelectorAll('.katex-error').length };
    });
    await (await st.$$('.q'))[2].scrollIntoViewIfNeeded();
    await shot(st, compat ? '09-hoc-sinh-1.0.0' : '06-hoc-sinh-lam-bai');
    for (let i = 0; i < 18; i++) await (await qs[i].$(`[data-opt="${KEYS1[i]}"]`)).click();
    for (let i = 0; i < 4; i++) for (let k = 0; k < 4; k++) await (await qs[18 + i].$(`[data-tf="${k}:${KEYS2[i][k] === 'Đ' ? 'D' : 'S'}"]`)).click();
    for (let i = 0; i < 6; i++) await (await qs[22 + i].$('input')).fill(KEYS3[i]);
    await st.click('#btnSubmit');
    await st.click('[data-close="ok"]');
    await st.waitForSelector('.score-ring', { timeout: 20000 });
    const score = await st.$eval('.score-ring b', (e) => e.textContent.trim());
    verdict('TC-3.11', view.n === 28 && view.img2 && view.img5 === 2 && view.kx3 >= 2 && view.tbl === '2x5' && view.kerr === 0 && /^10([,.]0+)?$/.test(score),
      `học sinh: ${view.n} câu; câu 2 có hình: ${view.img2}; câu 5 có ${view.img5} hình; câu 3 có ${view.kx3} công thức KaTeX; P3 câu 1 bảng ${view.tbl}; .katex-error ${view.kerr}; làm đúng hết → điểm ${score}`);
    await sctx.close();

    // ---- Thư viện không tải được → thông báo, vẫn dán văn bản ----
    const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    const ad2 = await ctx2.newPage();
    watchErrors(ad2, [], 'admin-cdn-hong');
    await routeCdn(ad2, [], { failLibs: true });
    await adminLogin(ad2, B, srv.pw);
    await newEditor(ad2, B);
    await ad2.click('#btnImport'); await ad2.click('#impTabFile');
    await ad2.waitForTimeout(1500);
    await ad2.setInputFiles('#impFileInput', { name: 'de-28-cau.docx', mimeType: DOCX, buffer: await docx28() });
    await ad2.waitForFunction(() => /Không tải được thư viện/.test(document.querySelector('.modal').innerText + [...document.querySelectorAll('.toast')].map((e) => e.textContent).join(' ')), null, { timeout: 60000 }).catch(() => {});
    const cdnTxt = await ad2.evaluate(() => document.querySelector('.modal').innerText + ' ' + [...document.querySelectorAll('.toast')].map((e) => e.textContent).join(' '));
    await ad2.click('#impTabs [data-t="text"]');
    await ad2.fill('#impText', M.exam28Lines().join('\n'));
    await ad2.click('#impCheck');
    const pasteOk = await ad2.waitForSelector('text=Tìm thấy', { timeout: 5000 }).then(() => true).catch(() => false);
    verdict('Thư viện CDN hỏng', /Không tải được thư viện đọc file, hãy dán văn bản/.test(cdnTxt) && pasteOk, `jszip/xlsx trả 404 (cả cdnjs và jsdelivr), chọn file → "${(cdnTxt.match(/Không tải được[^\n.]*/) || ['(không thấy)'])[0]}"; tab Dán văn bản vẫn dùng được: ${pasteOk}`);
    await ctx2.close();

    // ---- Ảnh điện thoại (390×844) ----
    if (!compat) {
      const ctx3 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
      const ph = await ctx3.newPage();
      watchErrors(ph, errors, 'admin-dt');
      await routeCdn(ph, []);
      await adminLogin(ph, B, srv.pw);
      await newEditor(ph, B);
      await openFileTab(ph);
      await upload(ph, 'de-canh-bao.docx', await docxWarn(), DOCX);
      const overflow = await ph.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      await shot(ph, '07-ket-qua-dien-thoai');
      verdict('Điện thoại 390 px', overflow <= 1, `bảng kết quả trên 390×844: tràn ngang ${overflow} px`);
      await ctx3.close();
    } else {
      // ảnh chế độ 1.0.0: bảng kết quả có cảnh báo
      const ctx3 = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
      const a3 = await ctx3.newPage();
      await routeCdn(a3, []);
      await adminLogin(a3, B, srv.pw);
      await newEditor(a3, B);
      await openFileTab(a3);
      await upload(a3, 'de-canh-bao.docx', await docxWarn(), DOCX);
      await a3.$eval('#impWarn', (e) => e.scrollIntoView({ block: 'center' })).catch(() => {});
      await shot(a3, '05-ket-qua-may-chu-1.0.0');
      await ctx3.close();
    }
    verdict('Không lỗi JS', errors.length === 0, errors.length ? errors.join(' | ').slice(0, 500) : 'không có pageerror / console error (quản trị + học sinh)');
  } finally {
    srv.proc.kill();
  }
}

(async () => {
  const browser = await chromium.launch();
  try {
    if (MODE === 'new' || MODE === 'all') { console.log('— Máy chủ mới —'); await runMode(browser, false); }
    if (MODE === 'compat' || MODE === 'all') { console.log('— Máy chủ 1.0.0 —'); await runMode(browser, true); }
  } catch (e) {
    console.error('LỖI KỊCH BẢN:', e.stack || e); process.exitCode = 1;
    R.tc['Kịch bản chạy hết'] = { pass: false, evidence: [TAG + String(e.message).slice(0, 300)] };
  } finally {
    await browser.close();
  }
  const fails = Object.entries(R.tc).filter(([, v]) => !v.pass);
  console.log(`\n${Object.keys(R.tc).length - fails.length}/${Object.keys(R.tc).length} nhóm đạt` + (fails.length ? ' — KHÔNG ĐẠT: ' + fails.map(([k]) => k).join(', ') : ''));
  if (fails.length) process.exitCode = 1;
  if (process.env.JSON_OUT) fs.writeFileSync(process.env.JSON_OUT, JSON.stringify(R, null, 2));
})();
