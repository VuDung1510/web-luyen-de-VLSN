// Test Pha 5 (người làm) — màu #1D6B3E, logo tạm, meta. Không cần trình duyệt.
// node tests/pha5.test.js   → TC-5.1, 5.2, 5.3, 5.4, 5.6, 5.14 (+ một phần TC-5.5, 5.7 quét tĩnh)
// In bảng tương phản / ΔE để chép vào báo cáo: BANG=1 node tests/pha5.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const JS = fs.readdirSync(path.join(ROOT, 'assets/js')).filter((f) => f.endsWith('.js')).map((f) => 'assets/js/' + f);
const SCOPE = ['index.html', 'admin.html', 'assets/css/style.css'].concat(JS);
const CSS = read('assets/css/style.css');
const LOGO = 'assets/img/logo-vlsn.png';

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.error('  ✗ ' + name + '\n    ' + String(e.message || e).split('\n').slice(0, 8).join('\n    ')); process.exitCode = 1; }
}

/* ---------- đọc biến CSS ---------- */
function varsOf(block) {
  const o = {};
  block.replace(/(--[\w-]+)\s*:\s*([^;]+);/g, (_, k, v) => { o[k] = v.trim().toLowerCase(); });
  return o;
}
const lightBlock = CSS.match(/^:root\s*\{([\s\S]*?)\n\}/m)[1];
const darkMedia = CSS.match(/@media \(prefers-color-scheme: dark\)\s*\{\s*:root:not\(\[data-theme="light"\]\)\s*\{([\s\S]*?)\}\s*\}/)[1];
const darkAttr = CSS.match(/^:root\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/m)[1];
const L = varsOf(lightBlock);
const D = Object.assign({}, L, varsOf(darkMedia)); // biến không định nghĩa lại ở khối tối (vd --accent) giữ giá trị sáng
const D2 = Object.assign({}, L, varsOf(darkAttr));

/* ---------- màu ---------- */
function rgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
function lum(hex) {
  const [r, g, b] = rgb(hex).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
function lab(hex) {
  const [r, g, b] = rgb(hex).map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  const X = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const Y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.0;
  const Z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
function dE(a, b) { const p = lab(a), q = lab(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); }

/* ---------- PNG ---------- */
function decodePng(buf) {
  assert.strictEqual(buf.slice(0, 8).toString('hex'), '89504e470d0a1a0a', 'không phải PNG');
  let off = 8, ihdr = null; const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off), type = buf.slice(off + 4, off + 8).toString('ascii'), data = buf.slice(off + 8, off + 8 + len);
    if (type === 'IHDR') ihdr = { w: data.readUInt32BE(0), h: data.readUInt32BE(4), depth: data[8], color: data[9], interlace: data[12] };
    if (type === 'IDAT') idat.push(data);
    if (type === 'IEND') break;
    off += 12 + len;
  }
  assert(ihdr, 'thiếu IHDR');
  if (ihdr.color !== 6 || ihdr.depth !== 8 || ihdr.interlace) return { ihdr, alpha: null };
  const raw = zlib.inflateSync(Buffer.concat(idat)), bpp = 4, stride = ihdr.w * bpp, px = Buffer.alloc(stride * ihdr.h);
  for (let y = 0; y < ihdr.h; y++) {
    const ft = raw[y * (stride + 1)], line = raw.slice(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[y * stride + x - bpp] : 0, b = y ? px[(y - 1) * stride + x] : 0, c = (x >= bpp && y) ? px[(y - 1) * stride + x - bpp] : 0;
      let v = line[x];
      if (ft === 1) v += a; else if (ft === 2) v += b; else if (ft === 3) v += (a + b) >> 1;
      else if (ft === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
      px[y * stride + x] = v & 255;
    }
  }
  return { ihdr, alpha: (x, y) => px[y * stride + x * bpp + 3] };
}

/* ================= TC ================= */
console.log('Pha 5 — kiểm tĩnh');

t('TC-5.1 màu cũ đã hết, :root có --primary #1D6B3E, mọi mã màu còn lại thuộc danh sách cho phép', () => {
  const OLD = ['1d4ed8', '6b93ff', 'e3ebff', '1d2b52', '15803d', '4ade80', 'dcfce7', '14321f', '%23f59e0b'];
  const hits = [];
  for (const f of SCOPE) {
    const s = read(f).toLowerCase();
    for (const o of OLD) if (s.includes(o)) hits.push(f + ': ' + o);
  }
  assert.deepStrictEqual(hits, [], 'còn màu cũ:\n' + hits.join('\n'));
  assert.strictEqual(L['--primary'], '#1d6b3e');
  // Danh sách cho phép = mọi mã của main (trừ 8 mã cũ ở trên) + các mã mới của bảng ánh xạ
  const MAIN_KEPT = ['#0b1020', '#0f1420', '#132c3d', '#166534', '#171e2e', '#182033', '#1f2840', '#2a3450', '#3a2314', '#3a3110', '#4a3d0c',
    '#5b6478', '#5c4400', '#9a3412', '#9aa4b8', '#a5841c', '#b45309', '#c2410c', '#dfe4ee', '#e0b100', '#e0f2fe', '#e7ebf3', '#eef2fa',
    '#f2c94c', '#f4f6fb', '#f59e0b', '#fb923c', '#fbbf24', '#ffe58f', '#ffedd5', '#fff', '#fff3b0', '#fff8db', '#ffffff', '#000', '#555'];
  const NEW = ['#1d6b3e', '#15573a', '#e3f1e8', '#4a7311', '#ecfccb', '#5fbf87', '#7fd3a2', '#183826', '#a3e635', '#1a2e05'];
  const ALLOW = new Set(MAIN_KEPT.concat(NEW));
  const RGBA = [/^rgba\(16, 24, 40, \.0\d\)$/, /^rgba\(0,0,0,\.\d+\)$/, /^rgba\(245, 158, 11, \.12\)$/, /^rgba\(10, 15, 30, \.45\)$/];
  const bad = [];
  for (const f of SCOPE) {
    const s = read(f).replace(/&#\d+;|&#x[0-9a-f]+;/gi, ''); // bỏ thực thể HTML (&#10003; …)
    (s.match(/#[0-9a-fA-F]{3,8}\b/g) || []).forEach((h) => {
      const hl = h.toLowerCase();
      if (!ALLOW.has(hl) && /^#([0-9a-f]{3}|[0-9a-f]{6})$/.test(hl)) bad.push(f + ': ' + h);
    });
    (s.match(/rgba\([^)]*\)/g) || []).forEach((r) => { if (!RGBA.some((re) => re.test(r))) bad.push(f + ': ' + r); });
  }
  assert.deepStrictEqual([...new Set(bad)], [], 'mã màu ngoài danh sách:\n' + [...new Set(bad)].join('\n'));
});

t('TC-5.1b bảng ánh xạ: đúng giá trị mới ở sáng và tối', () => {
  const want = {
    light: { '--primary': '#1d6b3e', '--primary-hover': '#15573a', '--primary-ink': '#ffffff', '--primary-soft': '#e3f1e8', '--good': '#4a7311', '--good-soft': '#ecfccb', '--on-status': '#ffffff',
      '--bad': '#c2410c', '--accent': '#f59e0b', '--bg': '#f4f6fb', '--surface': '#ffffff', '--surface-2': '#eef2fa' },
    dark: { '--primary': '#5fbf87', '--primary-hover': '#7fd3a2', '--primary-ink': '#0b1020', '--primary-soft': '#183826', '--good': '#a3e635', '--good-soft': '#1a2e05', '--on-status': '#0b1020',
      '--bad': '#fb923c', '--bg': '#0f1420', '--surface': '#171e2e', '--surface-2': '#1f2840' }
  };
  for (const [k, v] of Object.entries(want.light)) assert.strictEqual(L[k], v, 'sáng ' + k);
  for (const [k, v] of Object.entries(want.dark)) assert.strictEqual(D[k], v, 'tối ' + k);
  assert(/\.btn-primary:hover\s*\{\s*background: var\(--primary-hover\); border-color: var\(--primary-hover\);\s*\}/.test(CSS), '.btn-primary:hover');
  assert(!/brightness\(1\.08\)/.test(CSS), 'còn filter brightness(1.08)');
  for (const sel of ['.opt.right .key', '.opt.wrong .key', '.tf-btns button.right', '.tf-btns button.wrong', '.key-pick button.sel']) {
    const m = CSS.match(new RegExp(sel.replace(/\./g, '\\.') + '\\s*\\{([^}]*)\\}'));
    assert(m && /color: var\(--on-status\)/.test(m[1]) && !/color: #fff/.test(m[1]), sel + ' phải dùng var(--on-status)');
  }
});

const PAIRS = [
  ['Chữ trắng trên --primary (nút chính, sáng)', L['--primary-ink'], L['--primary']],
  ['Chữ trắng trên --primary-hover (sáng)', L['--primary-ink'], L['--primary-hover']],
  ['--primary trên --surface (liên kết, tiêu đề phần)', L['--primary'], L['--surface']],
  ['--primary trên --bg', L['--primary'], L['--bg']],
  ['--primary trên --surface-2 (tab đang chọn)', L['--primary'], L['--surface-2']],
  ['--primary trên --primary-soft (nav đang chọn, đồng hồ)', L['--primary'], L['--primary-soft']],
  ['--good trên trắng', L['--good'], '#ffffff'],
  ['--good trên --good-soft', L['--good'], L['--good-soft']],
  ['--good trên --surface-2', L['--good'], L['--surface-2']],
  ['--good trên --bg', L['--good'], L['--bg']],
  ['--on-status trên --good (sáng)', L['--on-status'], L['--good']],
  ['--on-status trên --bad (sáng)', L['--on-status'], L['--bad']],
  ['Tối: --primary trên --surface', D['--primary'], D['--surface']],
  ['Tối: --primary trên --bg', D['--primary'], D['--bg']],
  ['Tối: --primary trên --surface-2', D['--primary'], D['--surface-2']],
  ['Tối: --primary-ink trên --primary (nút chính)', D['--primary-ink'], D['--primary']],
  ['Tối: --primary-ink trên --primary-hover', D['--primary-ink'], D['--primary-hover']],
  ['Tối: --primary trên --primary-soft (nav đang chọn)', D['--primary'], D['--primary-soft']],
  ['Tối: --good trên --good-soft', D['--good'], D['--good-soft']],
  ['Tối: --on-status trên --good', D['--on-status'], D['--good']],
  ['Tối: --good trên --surface (.review-tag.ok, .ok-h)', D['--good'], D['--surface']],
  ['Tối: --on-status trên --bad', D['--on-status'], D['--bad']]
];
const FOCUS = [['Viền focus --primary trên --surface (sáng)', L['--primary'], L['--surface']], ['Viền focus --primary trên --surface (tối)', D['--primary'], D['--surface']]];
const DE = [
  ['--primary / --good (sáng)', L['--primary'], L['--good']], ['--primary / --good (tối)', D['--primary'], D['--good']],
  ['--primary / --bad (sáng)', L['--primary'], L['--bad']], ['--primary / --bad (tối)', D['--primary'], D['--bad']],
  ['--primary / --accent (sáng)', L['--primary'], L['--accent']], ['--primary / --accent (tối)', D['--primary'], D['--accent']]
];

t('TC-5.2 tương phản mọi cặp ≥ 4,5:1; viền focus ≥ 3:1', () => {
  const low = PAIRS.filter(([, a, b]) => contrast(a, b) < 4.5).map(([n, a, b]) => `${n}: ${a} / ${b} = ${contrast(a, b).toFixed(2)}`);
  low.push(...FOCUS.filter(([, a, b]) => contrast(a, b) < 3).map(([n]) => n));
  assert.deepStrictEqual(low, []);
  assert(/input:focus[^{]*\{\s*outline: 2px solid var\(--primary-soft\); border-color: var\(--primary\);/.test(CSS), 'viền focus giữ như cũ');
});

t('TC-5.3 ΔE76 giữa --primary và --good/--bad/--accent ≥ 25 (sáng, tối); hai khối tối giống hệt', () => {
  const low = DE.filter(([, a, b]) => dE(a, b) < 25).map(([n, a, b]) => `${n}: ${dE(a, b).toFixed(1)}`);
  assert.deepStrictEqual(low, []);
  assert.deepStrictEqual(varsOf(darkMedia), varsOf(darkAttr), 'hai khối tối khác nhau');
  assert.deepStrictEqual(D, D2);
});

t('TC-5.4 file logo tạm: PNG 96×96, ≤ 20 KB, có alpha, 4 góc trong suốt, đã cắt chữ; chú thích "Logo TẠM"', () => {
  const buf = fs.readFileSync(path.join(ROOT, LOGO));
  const { ihdr, alpha } = decodePng(buf);
  assert.strictEqual(ihdr.w, 96); assert.strictEqual(ihdr.h, 96);
  assert(buf.length <= 20 * 1024, 'quá 20 KB: ' + buf.length);
  assert(alpha, 'cần PNG RGBA 8 bit (có kênh trong suốt)');
  for (const [x, y] of [[0, 0], [95, 0], [0, 95], [95, 95]]) assert.strictEqual(alpha(x, y), 0, `góc ${x},${y}`);
  // Đã cắt chữ "VẬT LÝ SIÊU NHẨM": ảnh gốc có một dải chữ ngang (> 60% bề rộng) ở 1/5 dưới cùng.
  // Ảnh đã cắt: ở 1/5 dưới cùng chỉ còn đuôi chữ Q và mũi tên, không hàng nào phủ quá 60% bề rộng.
  let widest = 0;
  for (let y = Math.floor(ihdr.h * 0.8); y < ihdr.h; y++) {
    let x0 = -1, x1 = -1;
    for (let x = 0; x < ihdr.w; x++) if (alpha(x, y) > 40) { if (x0 < 0) x0 = x; x1 = x; }
    if (x0 >= 0) widest = Math.max(widest, (x1 - x0 + 1) / ihdr.w);
  }
  assert(widest < 0.6, 'có vẻ còn dải chữ ở đáy logo (rộng ' + (widest * 100).toFixed(0) + '%)');
  for (const f of ['index.html', 'admin.html']) {
    const s = read(f);
    assert(/<!-- Logo TẠM[^>]*-->\s*<a class="brand" href="#\/"><img class="brand-logo" src="assets\/img\/logo-vlsn\.png" alt="Vật Lý Siêu Nhẩm">/.test(s), f + ': thiếu chú thích Logo TẠM ngay trên img.brand-logo');
    assert(!/Φ/.test(s), f + ': còn chữ Φ');
  }
});

t('TC-5.5 (tĩnh) chỉ một file logo; favicon trỏ cùng file; không còn style nền cam ở admin', () => {
  const other = [];
  for (const f of SCOPE) {
    const s = read(f);
    (s.match(/[\w\/.-]+\.(png|svg|jpe?g|ico|gif|webp)\b/gi) || []).forEach((m) => { if (m !== LOGO) other.push(f + ': ' + m); });
    if (/data:image\/svg/.test(s)) other.push(f + ': favicon SVG nhúng');
  }
  assert.deepStrictEqual(other, []);
  for (const f of ['index.html', 'admin.html']) {
    const s = read(f);
    assert(s.includes('<link rel="icon" type="image/png" href="assets/img/logo-vlsn.png">'), f + ': favicon');
    assert(!/style="background:var\(--accent\)"/.test(s), f + ': còn nền cam');
    assert(s.includes('family=Be+Vietnam+Pro:wght@400;500;600;700;800&family=Montserrat:wght@700;800&display=swap'), f + ': link phông');
  }
  assert(read('admin.html').includes('<title>Quản trị · Luyện đề</title>'));
  const m = CSS.match(/\.brand-logo\s*\{([^}]*)\}/)[1];
  for (const d of ['width: 34px', 'height: 34px', 'border-radius: 10px', 'background: #fff', 'padding: 2px', 'object-fit: contain', 'display: block', 'flex: none']) assert(m.includes(d), '.brand-logo thiếu ' + d);
  assert(/--font-head:\s*"Montserrat", var\(--font\)/.test(CSS));
  assert(!/\.brand\s*\{[^}]*font-head/.test(CSS), 'không áp --font-head cho .brand');
});

t('TC-5.6 meta theme-color sáng #1D6B3E, tối #0f1420 ở hai trang', () => {
  for (const f of ['index.html', 'admin.html']) {
    const s = read(f);
    const metas = s.match(/<meta name="theme-color"[^>]*>/g) || [];
    assert.strictEqual(metas.length, 2, f);
    assert(metas.some((m) => /content="#1D6B3E"/i.test(m) && /media="\(prefers-color-scheme: light\)"/.test(m)), f + ' sáng');
    assert(metas.some((m) => /content="#0f1420"/i.test(m) && /media="\(prefers-color-scheme: dark\)"/.test(m)), f + ' tối');
  }
});

t('TC-5.7 (tĩnh) chân trang thương hiệu ở hai trang; app.js không ghi tên giáo viên', () => {
  const S = ['HỆ THỐNG GIÁO DỤC VẬT LÝ SIÊU NHẨM', 'Hotline: 0978 650726 - 0326 425 111', 'VẬT LÝ SIÊU NHẨM - ĐỊNH HƯỚNG TRUYỀN CẢM HỨNG'];
  for (const f of ['index.html', 'admin.html']) {
    const s = read(f);
    const ft = s.match(/<footer class="footer" id="footer">([\s\S]*?)<\/footer>/);
    assert(ft, f + ': thiếu <footer id="footer">');
    S.forEach((x) => assert(ft[1].includes(x), f + ': thiếu ' + x));
  }
  const app = read('assets/js/app.js');
  assert(!/getElementById\('footer'\)\.(textContent|innerHTML)/.test(app), 'app.js còn ghi chân trang');
  assert(!/'Giáo viên: '/.test(app), 'app.js còn chữ "Giáo viên: "');
  assert(/TEN_GIAO_VIEN: \{ label: 'Tên giáo viên', hint: 'Không hiển thị trên trang học sinh \(chỉ dùng nội bộ\)' \}/.test(read('assets/js/admin.js')));
  // Tên trang web mặc định không có tên người
  const def = read('apps-script/Code.gs').match(/\['TEN_UNG_DUNG', '([^']*)'/)[1];
  assert.strictEqual(def, 'Luyện đề Vật lý');
});

t('Vòng 2 R-1: CSS Google Fonts tải không chặn (một link, media="print" + onload đổi sang "all")', () => {
  for (const f of ['index.html', 'admin.html']) {
    const links = read(f).match(/<link[^>]*fonts\.googleapis\.com\/css2[^>]*>/g) || [];
    assert.strictEqual(links.length, 1, f + ': cần đúng 1 link phông');
    assert(/rel="stylesheet"/.test(links[0]) && /media="print"/.test(links[0]) && /onload="this\.media='all'"/.test(links[0]), f + ': link phông phải tải không chặn');
  }
});

t('Vòng 2 K-1: tiêu đề h1 trong .card-title nhỏ lại ở khổ hẹp', () => {
  const m = CSS.match(/@media \(max-width: 640px\) \{\n  h1 \{ font-size: 1\.35rem; \}[\s\S]*?\.card-title h1 \{ font-size: 1\.2rem; \}/);
  assert(m, 'thiếu .card-title h1 { font-size: 1.2rem } trong @media (max-width: 640px)');
});

t('TC-5.14 máy chủ không đổi: git diff origin/main -- apps-script/ rỗng', () => {
  let out;
  // Pha 6 đổi Code.gs: sau khi Pha 5 đã gộp, so đúng phần thay đổi của commit gộp Pha 5 (cha thứ nhất → commit gộp)
  const merge = execSync('git log --merges --grep="^Gộp Pha 5" -1 --format=%H', { cwd: ROOT, encoding: 'utf8' }).trim();
  try { out = execSync(merge ? `git diff ${merge}^1 ${merge} -- apps-script/` : 'git diff origin/main -- apps-script/', { cwd: ROOT, encoding: 'utf8' }); }
  catch (e) { throw new Error('không chạy được git diff (thiếu origin/main?): ' + e.message); }
  assert.strictEqual(out.trim(), '', 'apps-script/ đã đổi');
});

if (process.env.BANG) {
  console.log('\nBảng tương phản (WCAG 2.1):');
  PAIRS.concat(FOCUS).forEach(([n, a, b]) => console.log(`| ${n} | ${a} / ${b} | ${contrast(a, b).toFixed(2).replace('.', ',')} |`));
  console.log('\nΔE76:');
  DE.forEach(([n, a, b]) => console.log(`| ${n} | ${a} / ${b} | ${dE(a, b).toFixed(1).replace('.', ',')} |`));
}
console.log(`\n${passed} đạt, ${failed} lỗi`);
