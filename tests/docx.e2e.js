// E2E Pha 3 (người làm): tab "Tải file lên" trong hộp "Nhập nhanh câu hỏi". Cần dev-server đang chạy.
//   PORT=8780 ADMIN_PW=<mật khẩu dev-server> LIBS_DIR=<node_modules có katex, jszip, xlsx> \
//     NODE_PATH=$(npm root -g) node tests/docx.e2e.js [thư mục ảnh]
//   Chạy hai lần: dev-server máy chủ mới và SERVER_COMPAT=1.0.0 (đặt cùng SERVER_COMPAT cho e2e để chỉ đổi tên ảnh).
// Kiểm: TC-3.12 (thư viện chỉ tải khi mở tab), TC-3.1/3.5/3.6/3.7 trên giao diện, TC-3.3 (mốc ⟦…⟧ tô vàng),
//   TC-3.8 (.xlsx, .csv), TC-3.10 (file lỗi), TC-3.11 (tải docx → lưu đề → học sinh làm được), thư viện lỗi → thông báo.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:' + (process.env.PORT || 8780);
const SHOTS = process.argv[2] || path.join(__dirname, 'screenshots', 'docx');
const LIBS = process.env.LIBS_DIR;
const COMPAT = process.env.SERVER_COMPAT === '1.0.0';
const TAG = COMPAT ? '-may-chu-cu' : '';
if (!LIBS) { console.error('Cần LIBS_DIR'); process.exit(1); }
fs.mkdirSync(SHOTS, { recursive: true });
const M = require('./fixtures/make-docx')(LIBS);
const XLSX = require(path.join(LIBS, 'xlsx'));
const { mr, f, sup, sub, d, func, acc } = M;

const libHits = [];
async function routeCdn(page, opt) {
  opt = opt || {};
  await page.route(/fonts\.(googleapis|gstatic)\.com|accounts\.google\.com|lh3\.googleusercontent\.com|drive\.google\.com/, (r) => {
    const u = r.request().url();
    if (/googleusercontent|drive\.google/.test(u)) return r.fulfill({ status: 200, contentType: 'image/png', body: M.png(60, 40, [30, 120, 200]) });
    return r.fulfill({ status: 200, body: '' });
  });
  await page.route(/cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net/, (r) => {
    const u = r.request().url();
    const map = [
      [/katex\.min\.css$/, 'katex/dist/katex.min.css', 'text/css'],
      [/auto-render\.min\.js$/, 'katex/dist/contrib/auto-render.min.js', 'text/javascript'],
      [/katex\.min\.js$/, 'katex/dist/katex.min.js', 'text/javascript'],
      [/chart\.umd\.min\.js$/, 'chart.js/dist/chart.umd.js', 'text/javascript'],
      [/jszip\/3\.10\.1\/jszip\.min\.js$|jszip@3\.10\.1\/dist\/jszip\.min\.js$/, 'jszip/dist/jszip.min.js', 'text/javascript'],
      [/xlsx\/0\.18\.5\/xlsx\.full\.min\.js$|xlsx@0\.18\.5\/dist\/xlsx\.full\.min\.js$/, 'xlsx/dist/xlsx.full.min.js', 'text/javascript'],
      [/fonts\/(.+)$/, null, 'font/woff2']
    ];
    if (/jszip|xlsx/.test(u)) { libHits.push(u); if (opt.blockLibs) return r.fulfill({ status: 404, body: '' }); }
    for (const [re, file, type] of map) {
      const m = u.match(re);
      if (m) return r.fulfill({ status: 200, contentType: type, body: fs.readFileSync(path.join(LIBS, file || 'katex/dist/fonts/' + m[1])) });
    }
    return r.fulfill({ status: 404, body: '' });
  });
}
function check(cond, msg) { if (!cond) throw new Error('KHÔNG ĐẠT: ' + msg); console.log('  ✓ ' + msg); }

/** Đề mẫu tự soạn theo mẫu VLSN: 18–4–6, có công thức, 3 hình (câu 2, 5, 5), 1 hình EMF (câu 6), bảng (câu 7), ma trận (câu 4) */
async function sampleDocx() {
  const media = { rId1: { name: 'image1.png', data: M.png(240, 160, [220, 40, 40]) }, rId2: { name: 'image2.png', data: M.png(240, 160, [40, 160, 60]) },
    rId3: { name: 'image3.png', data: M.png(200, 120, [40, 60, 200]) }, rId4: { name: 'image4.emf', data: Buffer.from('EMF giả') } };
  const opt = 'A. 1\tB. 2\tC. 3\tD. 4';
  const B = [
    M.tbl([[['TRUNG TÂM MẪU', 'Mã đề: 001'], ['ĐỀ KIỂM TRA MẪU (tự soạn)', 'Thời gian: 50 phút']]]),
    M.p('Họ và tên: ……………… SBD: ……'),
    M.p('PHẦN 1. TRẮC NGHIỆM NHIỀU LỰA CHỌN (Thí sinh trả lời từ câu 1 đến câu 18)')
  ];
  for (let i = 1; i <= 18; i++) {
    if (i === 3) {
      B.push(M.p(['Câu 3: Một khối khí ở ', M.math(sub(mr('T'), mr('1')) + mr('=', 1) + mr('300') + mr(' ') + mr('K', 'nor')), ', áp suất ',
        M.math(sub(mr('p'), mr('1')) + mr('=', 1) + mr('2') + mr(',', 1) + sup(mr('5.10'), mr('5')) + mr(' ') + mr('Pa', 'nor')),
        '. Biểu thức ', M.math(mr('x') + mr('=', 1) + mr('A') + func('cos', d(mr('ωt') + mr('+', 1) + f(mr('π'), mr('3'))))), ' và ',
        M.math(acc(mr('F'), '\u20d7') + mr('=', 1) + mr('m') + acc(mr('a'), '\u20d7')), ' đúng không?']));
      B.push(M.p(['A. ', M.math(rad(mr('2gh'))), '\tB. ', M.math(f(mr('1'), mr('2')) + mr('m') + sup(mr('v'), mr('2'))), '\tC. ', M.math(mr('t') + mr('=', 1) + mr('25') + mr(' ') + mr('°C', 'nor')), '\tD. ', M.math(sup(mr('10'), mr('−', 1) + mr('5')))]));
    } else if (i === 4) {
      B.push(M.p(['Câu 4: Ma trận ', M.math(mr('M') + mr('=', 1) + M.matrix()), ' có định thức bằng']));
      B.push(M.p(opt));
    } else if (i === 7) {
      B.push(M.p('Câu 7: Cho bảng nhiệt dung riêng:'));
      B.push(M.tbl([['Chất', 'c (J/kg.K)'], ['Nhôm', '880'], ['Đồng', '380'], ['Chì', '130'], ['Nước', '4200']]));
      B.push(M.p('Chất nào nóng lên nhanh nhất?'));
      B.push(M.p('A. Nhôm.\tB. Đồng.\tC. Chì.\tD. Nước.'));
    } else {
      B.push(M.p('Câu ' + i + ': Câu hỏi mẫu số ' + i + '?'));
      if (i === 2) B.push(M.p([M.img('rId1')]));
      if (i === 5) { B.push(M.p([M.img('rId2', { anchor: true })])); B.push(M.p(['Hình phụ: ', M.vml('rId3')])); }
      if (i === 6) B.push(M.p([M.img('rId4')]));
      B.push(M.p(opt));
    }
    B.push(M.p('Đáp án: ' + 'ABCD'[i % 4]));
  }
  B.push(M.p('PHẦN 2. TRẮC NGHIỆM ĐÚNG SAI (Thí sinh trả lời từ câu 1 đến câu 4)'));
  for (let i = 1; i <= 4; i++) {
    B.push(M.p('Câu ' + i + ': Cho một lượng khí lí tưởng mẫu số ' + i + '.'));
    ['a', 'b', 'c', 'd'].forEach((k, j) => B.push(M.p(k + ') Mệnh đề ' + k + ' (' + ((i + j) % 2 ? 'S' : 'Đ') + ')')));
  }
  B.push(M.p('PHẦN 3. TRẮC NGHIỆM TRẢ LỜI NGẮN (Thí sinh trả lời từ câu 1 đến câu 6)'));
  for (let i = 1; i <= 6; i++) {
    B.push(M.p('Câu ' + i + ': Tính đại lượng mẫu số ' + i + '.'));
    B.push(M.p('Đáp án của em:…………………'));
    B.push(M.p('Đáp số: ' + i + ',5'));
  }
  B.push(M.p('---------- HẾT ----------'));
  return M.docx(B, { media, header: 'Đầu trang mẫu' });
}
const { rad } = M;

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const ad = await ctx.newPage();
  ad.on('pageerror', (e) => errors.push(e.message));
  ad.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await routeCdn(ad);
  const uploads = [];
  await ad.route('**/exec', (r) => { const pd = r.request().postData() || ''; if (/"action":"adminUploadImage"/.test(pd)) uploads.push(Date.now()); r.continue(); });
  ad.on('dialog', (dl) => dl.accept());

  await ad.goto(BASE + '/admin.html');
  await ad.fill('#pw', process.env.ADMIN_PW);
  await ad.click('#btnLogin');
  await ad.waitForSelector('#nav:not(.hidden)');
  await ad.goto(BASE + '/admin.html#/de-thi/moi');
  await ad.waitForSelector('#eTitle');
  await ad.click('#btnImport');
  await ad.waitForSelector('#impTabs');
  await ad.waitForTimeout(300);
  check(libHits.length === 0, 'TC-3.12 chưa mở tab "Tải file lên": không tải jszip/xlsx');
  await ad.click('#impTabFile');
  await ad.waitForFunction(() => window.JSZip && window.XLSX);
  check(libHits.some((u) => /jszip/.test(u)) && libHits.some((u) => /xlsx/.test(u)), 'TC-3.12 mở tab: tải jszip 3.10.1 và xlsx 0.18.5 (' + libHits.length + ' yêu cầu)');
  await ad.screenshot({ path: path.join(SHOTS, '01-hop-tai-file' + TAG + '.png') });

  // ---- TC-3.10: file lỗi ----
  const setFile = (name, buffer, mimeType) => ad.setInputFiles('#impFileInput', { name, mimeType: mimeType || 'application/octet-stream', buffer });
  await setFile('to.docx', Buffer.alloc(10 * 1024 * 1024 + 10));
  await ad.waitForSelector('#impError');
  check(/lớn hơn 10 MB/.test(await ad.textContent('#impError')), 'TC-3.10 file > 10 MB: báo rõ');
  await setFile('anh.png', M.png(4, 4), 'image/png');
  await ad.waitForFunction(() => /Chỉ nhận file Word/.test(document.querySelector('#impError') && document.querySelector('#impError').textContent));
  check(true, 'TC-3.10 file không phải docx/xlsx: báo rõ');
  await setFile('hong.docx', Buffer.from('PK\u0003\u0004 hỏng'));
  await ad.waitForFunction(() => /bị hỏng/.test(document.querySelector('#impError') && document.querySelector('#impError').textContent));
  check(await ad.isDisabled('#impAdd'), 'TC-3.10 docx hỏng: báo "bị hỏng", nút Thêm vẫn khóa, trang không treo');

  // ---- docx mẫu ----
  const buf = await sampleDocx();
  await setFile('de-mau.docx', buf, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  await ad.waitForSelector('#impStats');
  await ad.waitForSelector('#impProg', { state: 'hidden' });
  const count = await ad.textContent('#impCount');
  check(/Tìm thấy 28 câu: 18 trắc nghiệm, 4 đúng\/sai, 6 trả lời ngắn/.test(count), 'TC-3.1 nhận 28 câu 18–4–6: ' + count.trim());
  const stats = await ad.textContent('#impStats');
  check(/Phần I: 18 · Phần II: 4 · Phần III: 6/.test(stats), 'bảng kết quả: số câu theo phần');
  check(/Đã đổi: 8 · Chưa đổi được: 1/.test(stats), 'bảng kết quả: công thức đã đổi 8 / chưa đổi 1');
  check(/Sẽ tải lên: 3 · Cần chụp lại: 1/.test(stats), 'bảng kết quả: 3 hình sẽ tải, 1 hình cần chụp lại');
  const warn = await ad.textContent('#impWarn');
  check(/Câu 4: 1 công thức cần gõ lại/.test(warn), 'TC-3.3 cảnh báo đúng câu 4 (ma trận)');
  check(/Câu 6: hình cần chụp lại hoặc lưu lại dạng PNG/.test(warn), 'TC-3.7 cảnh báo đúng câu 6 (EMF)');
  check(!/Đầu trang mẫu|Mã đề/.test(await ad.textContent('#impList')), 'đầu trang và khung đầu đề không lẫn vào câu');
  check(await ad.$$eval('#impList .imp-q[data-iq="3"].imp-todo mark.todo-mark', (x) => x.length) === 1, 'xem trước: câu 4 tô vàng, mốc ⟦…⟧ được đánh dấu');
  check(await ad.$$eval('#impList .imp-q[data-iq="2"] .katex', (x) => x.length) >= 8, 'xem trước: câu 3 công thức hiển thị bằng KaTeX');
  check(await ad.$$eval('#impList .imp-q[data-iq="1"] img', (x) => x.length) === 1 && await ad.$$eval('#impList .imp-q[data-iq="4"] img', (x) => x.length) === 2, 'xem trước: hình câu 2 (1) và câu 5 (2)');
  check(await ad.$$eval('#impList .imp-q[data-iq="6"] table.q-table tr', (x) => x.length) === 5, 'TC-3.6 xem trước: bảng 2×5 hiển thị thành bảng');
  check(uploads.length === 0, 'TC-3.5 chưa bấm thêm: chưa gọi adminUploadImage');
  await ad.screenshot({ path: path.join(SHOTS, '02-ket-qua-canh-bao' + TAG + '.png') });
  const card3 = await ad.$('#impList .imp-q[data-iq="2"]');
  await card3.scrollIntoViewIfNeeded();
  await ad.screenshot({ path: path.join(SHOTS, '03-cau-cong-thuc' + TAG + '.png') });

  await ad.click('#impAdd');
  await ad.waitForSelector('#impTabs', { state: 'detached', timeout: 20000 });
  check(uploads.length === 3, 'TC-3.5 bấm thêm: adminUploadImage đúng 3 lần (' + uploads.length + ')');
  const nq = await ad.$$eval('.qedit', (x) => x.length);
  check(nq === 28, 'trình soạn có 28 câu');
  const hinh = await ad.$$eval('.qedit input[data-f="hinhAnh"]', (x) => x.map((e) => e.value));
  const nd = await ad.$$eval('.qedit textarea[data-f="noiDung"]', (x) => x.map((e) => e.value));
  check(/^https:\/\//.test(hinh[1]) && /^https:\/\//.test(hinh[4]) && !hinh[0] && !hinh[5], 'TC-3.5 câu 2 và câu 5 có hinhAnh; câu 6 (EMF) không có');
  check((nd[4].match(/!\[\]\(https:\/\/[^)]+\)/g) || []).length === 1 && !/!\[/.test(nd[1]), 'TC-3.5 câu 5 có thêm 1 ![](…) trong nội dung');
  check(/\[BẢNG\] Chất \| c \(J\/kg\.K\)\nNhôm \| 880/.test(nd[6]), 'TC-3.6 câu 7 có khối [BẢNG]');
  check(/\$T_\{1\} = 300\\ \\text\{K\}\$/.test(nd[2]), 'câu 3 có công thức $T_{1} = 300\\ \\text{K}$');
  check(await ad.$$eval('.qedit.qedit-todo', (x) => x.map((e) => e.dataset.q).join(',')) === '3', 'trình soạn: chỉ câu 4 (còn ⟦…⟧) được tô vàng');
  check(await ad.$$eval('.qedit[data-q="3"] textarea.todo', (x) => x.length) === 1, 'trình soạn: ô nội dung câu 4 tô vàng');
  check(await ad.$$eval('.qedit[data-q="5"] [data-hinhloi]', (x) => x.length) === 1, 'trình soạn: câu 6 có nhãn "hình cần chụp lại"');
  const q4 = await ad.$('.qedit[data-q="3"]');
  await q4.evaluate((e) => { e.scrollIntoView({ block: 'start' }); window.scrollBy(0, -70); });
  await ad.screenshot({ path: path.join(SHOTS, '04-cau-moc-to-vang' + TAG + '.png') });
  // giáo viên gõ lại công thức → hết tô vàng
  await ad.fill('.qedit[data-q="3"] textarea[data-f="noiDung"]', 'Ma trận đơn vị $I$ có định thức bằng');
  check(await ad.$$eval('.qedit.qedit-todo', (x) => x.length) === 0, 'sửa xong mốc ⟦…⟧: hết tô vàng');
  const q3 = await ad.$('.qedit[data-q="2"]');
  await q3.$eval('details', (e) => { e.open = true; });
  await ad.waitForTimeout(300);
  await q3.evaluate((e) => { e.scrollIntoView({ block: 'start' }); window.scrollBy(0, -70); });
  await ad.screenshot({ path: path.join(SHOTS, '05-trinh-soan-cong-thuc' + TAG + '.png') });

  // ---- TC-3.11: lưu đề → học sinh làm ----
  const title = 'Đề tải từ Word (e2e' + (COMPAT ? ', máy chủ cũ' : '') + ' ' + Date.now().toString(36) + ')';
  await ad.fill('#eTitle', title);
  await ad.selectOption('#eStatus', 'MO');
  await ad.click('#btnSave');
  await ad.waitForFunction(() => /Đã lưu/.test(document.getElementById('saveInfo').textContent), null, { timeout: 15000 });
  check(true, 'TC-3.11 lưu đề 28 câu' + (COMPAT ? ' (máy chủ 1.0.0)' : ''));

  // ---- TC-3.8: .xlsx và .csv ----
  await ad.goto(BASE + '/admin.html#/de-thi/moi');
  await ad.waitForSelector('#btnImport');
  await ad.click('#btnImport');
  await ad.click('#impTabFile');
  const rows = [['Loại', 'Nội dung', 'A', 'B', 'C', 'D', 'Đáp án'], ['TN', 'Đơn vị lực?', 'N', 'J', 'W', 'Pa', 'A'], ['DS', 'Mệnh đề', 'a', 'b', 'c', 'd', 'ĐSĐS'], ['TL', 'Tính g', '', '', '', '', '9,8']];
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'S1');
  await setFile('cau-hoi.xlsx', XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  await ad.waitForFunction(() => /Tìm thấy 3 câu: 1 trắc nghiệm, 1 đúng\/sai, 1 trả lời ngắn/.test((document.querySelector('#impCount') || {}).textContent || ''));
  check(true, 'TC-3.8 .xlsx: 3 câu đúng loại');
  await setFile('cau-hoi.csv', Buffer.from('\uFEFF' + rows.slice(1).map((r) => r.join(',')).join('\r\n'), 'utf8'), 'text/csv');
  await ad.waitForFunction(() => /Tìm thấy 3 câu/.test((document.querySelector('#impCount') || {}).textContent || '') && /File: cau-hoi\.csv/.test(document.querySelector('#impResult').textContent));
  check(true, 'TC-3.8 .csv (không hàng tiêu đề): 3 câu');
  await ad.click('#impAdd');
  await ad.waitForSelector('#impTabs', { state: 'detached' });
  check(await ad.$$eval('.qedit', (x) => x.length) === 3, '.csv: thêm 3 câu vào trình soạn');
  ad.removeAllListeners('dialog'); ad.on('dialog', (dl) => dl.accept());

  // ---- điện thoại 390×844 ----
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mp = await mctx.newPage();
  mp.on('pageerror', (e) => errors.push('ĐT: ' + e.message));
  await routeCdn(mp);
  await mp.goto(BASE + '/admin.html');
  await mp.fill('#pw', process.env.ADMIN_PW);
  await mp.click('#btnLogin');
  await mp.waitForSelector('#nav:not(.hidden)');
  await mp.goto(BASE + '/admin.html#/de-thi/moi');
  await mp.waitForSelector('#btnImport');
  await mp.click('#btnImport');
  await mp.click('#impTabFile');
  await mp.waitForTimeout(300);
  await mp.screenshot({ path: path.join(SHOTS, '06-hop-tai-file-dien-thoai' + TAG + '.png') });
  await mp.setInputFiles('#impFileInput', { name: 'de-mau.docx', mimeType: 'application/octet-stream', buffer: buf });
  await mp.waitForSelector('#impStats');
  await mp.waitForSelector('#impProg', { state: 'hidden' });
  await mp.$eval('#impCount', (e) => e.scrollIntoView({ block: 'start' }));
  const over = await mp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check(!over, 'điện thoại 390 px: hộp kết quả không tràn ngang');
  await mp.screenshot({ path: path.join(SHOTS, '07-ket-qua-dien-thoai' + TAG + '.png') });
  await mctx.close();

  // ---- thư viện không tải được ----
  const bctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const bp = await bctx.newPage();
  await routeCdn(bp, { blockLibs: true });
  await bp.goto(BASE + '/admin.html');
  await bp.fill('#pw', process.env.ADMIN_PW);
  await bp.click('#btnLogin');
  await bp.waitForSelector('#nav:not(.hidden)');
  await bp.goto(BASE + '/admin.html#/de-thi/moi');
  await bp.waitForSelector('#btnImport');
  await bp.click('#btnImport');
  await bp.click('#impTabFile');
  await bp.setInputFiles('#impFileInput', { name: 'de-mau.docx', mimeType: 'application/octet-stream', buffer: buf });
  await bp.waitForSelector('#impError', { timeout: 30000 });
  check(/Không tải được thư viện đọc file, hãy dán văn bản/.test(await bp.textContent('#impError')), 'thư viện lỗi: "Không tải được thư viện đọc file, hãy dán văn bản."');
  await bp.click('#impTabs [data-t="text"]');
  check(await bp.isVisible('#impText'), 'thư viện lỗi: vẫn dán văn bản được');
  await bctx.close();

  // ---- học sinh làm đề vừa tải ----
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
  await st.waitForSelector('text=' + title);
  await st.evaluate((t) => {
    let el = [...document.querySelectorAll('#app *')].find((e) => e.children.length === 0 && e.textContent.trim() === t);
    while (el && !el.querySelector('a,button')) el = el.parentElement;
    [...el.querySelectorAll('a,button')].find((b) => /Bắt đầu làm bài/.test(b.textContent)).click();
  }, title);
  await st.waitForSelector('#btnStart');
  if (await st.$('[data-goal="8"]')) await st.click('[data-goal="8"]');
  await st.click('#btnStart');
  await st.waitForSelector('.timer');
  check(await st.$$eval('.q', (x) => x.length) === 28, 'TC-3.11 học sinh thấy 28 câu');
  check(await st.$$eval('.q table.q-table', (x) => x.length) === 1, 'học sinh thấy bảng ở câu 7');
  check(await st.$$eval('.q img', (x) => x.length) >= 3, 'học sinh thấy hình câu 2, 5');
  await st.click('#btnSubmit');
  await st.click('[data-close="ok"]');
  await st.waitForSelector('.score-ring', { timeout: 15000 });
  check(true, 'TC-3.11 học sinh nộp bài, có kết quả');

  // ---- R-13 (còn từ Pha 2): đăng xuất xóa giỏ câu / bộ lọc Ngân hàng ----
  await ad.goto(BASE + '/admin.html#/');
  await ad.waitForSelector('#btnOut');
  await ad.evaluate(() => { sessionStorage.setItem('ld_bank_cart', JSON.stringify({ items: [{ maKho: 'X' }], tieuDe: '' })); sessionStorage.setItem('ld_bank_filter', '{}'); });
  await ad.click('#btnOut');
  await ad.waitForSelector('#pw');
  check(await ad.evaluate(() => sessionStorage.getItem('ld_bank_cart') === null && sessionStorage.getItem('ld_bank_filter') === null), 'R-13 đăng xuất: xóa giỏ câu và bộ lọc Ngân hàng');

  check(!errors.length, 'không có lỗi JS: ' + errors.join(' | '));
  await browser.close();
  console.log('docx.e2e' + (COMPAT ? ' (máy chủ 1.0.0)' : ' (máy chủ mới)') + ': ĐẠT');
})().catch((e) => { console.error(e); process.exit(1); });
