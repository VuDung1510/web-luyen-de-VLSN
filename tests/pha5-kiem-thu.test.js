// Kiểm thử độc lập Pha 5 (người kiểm thử) — phần tĩnh, viết theo docs/spec/pha-5-thiet-ke.md.
// TC-5.1 (màu cũ hết, mã màu còn lại thuộc danh sách cho phép), TC-5.2 (tương phản WCAG tự tính từ style.css),
// TC-5.3 (ΔE76, hai khối tối giống nhau), TC-5.4 (file logo), TC-5.5 phần tĩnh (một file logo, không còn Φ),
// TC-5.6 (theme-color), TC-5.14 (Code.gs không đổi), và vài mục "Thiết kế kỹ thuật" kiểm được bằng đọc file.
//   node tests/pha5-kiem-thu.test.js            (so với nhánh main: BASE_REF=main mặc định)
// Không cần thư viện ngoài: tự giải mã PNG bằng zlib.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const BASE_REF = process.env.BASE_REF || 'main';
const R = [];
function check(tc, pass, evidence) {
  R.push({ tc, pass: !!pass, evidence });
  console.log(`  ${pass ? '✓' : '✗'} ${tc}: ${evidence}`);
}
const rd = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const gitShow = (p) => { try { return execSync(`git show ${BASE_REF}:${p}`, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 << 20 }); } catch (e) { return ''; } };
const jsFiles = fs.readdirSync(path.join(ROOT, 'assets/js')).filter((f) => f.endsWith('.js')).map((f) => 'assets/js/' + f);
const SCOPE = ['index.html', 'admin.html', 'assets/css/style.css'].concat(jsFiles);
const SRC = Object.fromEntries(SCOPE.map((f) => [f, rd(f)]));
const css = SRC['assets/css/style.css'];

// ---------- CSS: tách khối biến ----------
function blockAfter(text, startIdx) {
  const open = text.indexOf('{', startIdx);
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') { depth--; if (depth === 0) return text.slice(open + 1, i); }
  }
  return '';
}
function vars(block) {
  const out = {};
  const re = /(--[\w-]+)\s*:\s*([^;]+);/g; let m;
  while ((m = re.exec(block))) out[m[1]] = m[2].trim();
  return out;
}
const noComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');
const cssNC = noComments(css);
// :root đầu tiên (sáng)
const lightIdx = cssNC.search(/(^|[}\s]):root\s*\{/);
const LIGHT = vars(blockAfter(cssNC, lightIdx));
// Hai khối tối
const mediaIdx = cssNC.search(/@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)/);
const mediaBlock = mediaIdx >= 0 ? blockAfter(cssNC, mediaIdx) : '';
const notLightIdx = mediaBlock.search(/:root:not\(\[data-theme=["']?light["']?\]\)/);
const DARK1 = notLightIdx >= 0 ? vars(blockAfter(mediaBlock, notLightIdx)) : {};
const dataDarkIdx = cssNC.search(/:root\[data-theme=["']?dark["']?\]\s*\{/);
const DARK2 = dataDarkIdx >= 0 ? vars(blockAfter(cssNC, dataDarkIdx)) : {};
const DARK = Object.assign({}, LIGHT, DARK1);

// ---------- màu ----------
function hexToRgb(h) {
  h = String(h).trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
function resolve(v, set) {
  let s = String(v || '').trim(); let n = 0;
  while (/^var\(/.test(s) && n++ < 10) { const m = /^var\((--[\w-]+)\s*(?:,\s*([^)]+))?\)$/.exec(s); s = (set[m[1]] || m[2] || '').trim(); }
  return s;
}
function lum(rgb) {
  const c = rgb.map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrast(a, b) { const la = lum(a); const lb = lum(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); }
function lab(rgb) {
  const c = rgb.map((x) => { x /= 255; return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
  const X = (c[0] * 0.4124564 + c[1] * 0.3575761 + c[2] * 0.1804375) / 0.95047;
  const Y = (c[0] * 0.2126729 + c[1] * 0.7151522 + c[2] * 0.0721750) / 1.0;
  const Z = (c[0] * 0.0193339 + c[1] * 0.1191920 + c[2] * 0.9503041) / 1.08883;
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
function dE(a, b) { const A = lab(a); const B = lab(b); return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]); }
const fmt = (x) => x.toFixed(2).replace('.', ',');

console.log('Pha 5 — kiểm thử tĩnh (so với ' + BASE_REF + ')');

// ================= TC-5.1 =================
const OLD = ['1d4ed8', '6b93ff', 'e3ebff', '1d2b52', '15803d', '4ade80', 'dcfce7', '14321f', '%23f59e0b'];
const oldHits = [];
for (const [f, t] of Object.entries(SRC)) for (const o of OLD) { const n = (t.toLowerCase().match(new RegExp(o.replace('%', '\\%'), 'g')) || []).length; if (n) oldHits.push(`${f}:${o}×${n}`); }
check('TC-5.1 màu cũ', oldHits.length === 0, oldHits.length ? 'còn: ' + oldHits.join(', ') : `0 kết quả cho ${OLD.length} chuỗi trong ${SCOPE.length} file (${SCOPE.join(', ')})`);
check('TC-5.1 --primary', /^#1d6b3e$/i.test(LIGHT['--primary'] || ''), `:root --primary = ${LIGHT['--primary']}`);
// Danh sách cho phép
const HEX_RE = /#[0-9a-f]{3,8}\b/gi;
const RGBA_RE = /rgba?\([^)]*\)/gi;
const normRgba = (s) => s.toLowerCase().replace(/\s+/g, '').replace(/,0\./g, ',.');
const normHex = (h) => { h = h.toLowerCase(); return h.length === 4 ? '#' + h.slice(1).split('').map((c) => c + c).join('') : h; };
const NEW_VALUES = ['#1d6b3e', '#5fbf87', '#15573a', '#7fd3a2', '#ffffff', '#0b1020', '#e3f1e8', '#183826', '#4a7311', '#a3e635', '#ecfccb', '#1a2e05', '#0f1420'];
const LISTED = ['#fff', '#000', '#555', '#182033', '#9a3412', '#166534', '#f59e0b', '#fbbf24'];
const mainHex = new Set(); const mainRgba = new Set();
let mainFiles = 0;
for (const f of SCOPE) {
  const t = gitShow(f); if (!t) continue; mainFiles++;
  (t.match(HEX_RE) || []).forEach((h) => mainHex.add(normHex(h)));
  (t.match(RGBA_RE) || []).forEach((h) => mainRgba.add(normRgba(h)));
}
const oldNorm = new Set(OLD.filter((o) => !o.startsWith('%')).map((o) => '#' + o));
const allowHex = new Set([...NEW_VALUES, ...LISTED].map(normHex));
mainHex.forEach((h) => { if (!oldNorm.has(h)) allowHex.add(h); });
const allowRgbaRe = [/^rgba\(16,24,40,/, /^rgba\(0,0,0,/, /^rgba\(245,158,11,\.12\)$/, /^rgba\(10,15,30,\.45\)$/];
const badHex = []; const badRgba = [];
for (const [f, t] of Object.entries(SRC)) {
  (t.match(HEX_RE) || []).forEach((h) => { if (!allowHex.has(normHex(h))) badHex.push(f + ':' + h); });
  (t.match(RGBA_RE) || []).forEach((h) => { const n = normRgba(h); if (!allowRgbaRe.some((re) => re.test(n)) && !mainRgba.has(n)) badRgba.push(f + ':' + h); });
}
check('TC-5.1 danh sách cho phép', !badHex.length && !badRgba.length,
  (badHex.length || badRgba.length) ? 'ngoài danh sách: ' + badHex.concat(badRgba).join(', ') : `mọi mã hex (${allowHex.size} giá trị cho phép, ${mainHex.size} lấy từ ${mainFiles} file trên ${BASE_REF}) và rgb/rgba còn lại đều thuộc danh sách`);

// ================= Bảng ánh xạ (giá trị đúng như đặc tả) =================
const EXPECT_LIGHT = { '--primary': '#1d6b3e', '--primary-hover': '#15573a', '--primary-ink': '#ffffff', '--primary-soft': '#e3f1e8', '--good': '#4a7311', '--good-soft': '#ecfccb', '--on-status': '#ffffff' };
const EXPECT_DARK = { '--primary': '#5fbf87', '--primary-hover': '#7fd3a2', '--primary-ink': '#0b1020', '--primary-soft': '#183826', '--good': '#a3e635', '--good-soft': '#1a2e05', '--on-status': '#0b1020' };
const mism = [];
for (const [k, v] of Object.entries(EXPECT_LIGHT)) if (normHex(resolve(LIGHT[k], LIGHT) || '') !== v) mism.push(`sáng ${k}=${LIGHT[k]} (cần ${v})`);
for (const [k, v] of Object.entries(EXPECT_DARK)) if (normHex(resolve(DARK1[k], DARK) || '') !== v) mism.push(`tối ${k}=${DARK1[k]} (cần ${v})`);
// biến giữ nguyên so với main
const mainCss = noComments(gitShow('assets/css/style.css'));
const mLight = vars(blockAfter(mainCss, mainCss.search(/(^|[}\s]):root\s*\{/)));
const mMedia = blockAfter(mainCss, mainCss.search(/@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)/));
const mDark = vars(blockAfter(mMedia, mMedia.search(/:root:not\(\[data-theme=["']?light["']?\]\)/)));
const KEEP = ['--bad', '--bad-soft', '--warn', '--accent', '--info-soft', '--bg', '--surface', '--surface-2', '--text', '--muted', '--border'];
const changedKeep = [];
for (const k of KEEP) {
  if (k in mLight && mLight[k] !== LIGHT[k]) changedKeep.push(`sáng ${k}: ${mLight[k]} → ${LIGHT[k]}`);
  if (k in mDark && mDark[k] !== DARK1[k]) changedKeep.push(`tối ${k}: ${mDark[k]} → ${DARK1[k]}`);
}
check('Bảng ánh xạ màu', !mism.length && !changedKeep.length,
  (mism.concat(changedKeep).join('; ')) || `7 biến sáng + 7 biến tối đúng bảng; ${KEEP.length} biến "giữ nguyên" không đổi so với ${BASE_REF}`);

// ================= TC-5.2 =================
const L = (k) => hexToRgb(resolve(LIGHT[k], LIGHT));
const D = (k) => hexToRgb(resolve(DARK[k], DARK)); // biến không có trong khối tối thì lấy giá trị sáng
const W = [255, 255, 255];
const PAIRS = [
  ['Sáng: chữ trắng (--primary-ink) trên --primary', L('--primary-ink'), L('--primary'), 6.51],
  ['Sáng: chữ trắng trên --primary-hover', L('--primary-ink'), L('--primary-hover'), 8.55],
  ['Sáng: --primary trên --surface', L('--primary'), L('--surface'), 6.51],
  ['Sáng: --primary trên --bg', L('--primary'), L('--bg'), 6.02],
  ['Sáng: --primary trên --surface-2', L('--primary'), L('--surface-2'), 5.80],
  ['Sáng: --primary trên --primary-soft', L('--primary'), L('--primary-soft'), 5.59],
  ['Sáng: --good trên trắng', L('--good'), W, 5.60],
  ['Sáng: --good trên --good-soft', L('--good'), L('--good-soft'), 5.16],
  ['Sáng: --good trên --surface-2', L('--good'), L('--surface-2'), 4.99],
  ['Sáng: --on-status trên --good', L('--on-status'), L('--good'), 5.60],
  ['Sáng: --on-status trên --bad', L('--on-status'), L('--bad'), 5.18],
  ['Tối: --primary trên --surface', D('--primary'), D('--surface'), 7.36],
  ['Tối: --primary trên --bg', D('--primary'), D('--bg'), 8.14],
  ['Tối: --primary trên --surface-2', D('--primary'), D('--surface-2'), 6.47],
  ['Tối: --primary-ink trên --primary', D('--primary-ink'), D('--primary'), 8.37],
  ['Tối: --primary-ink trên --primary-hover', D('--primary-ink'), D('--primary-hover'), 10.59],
  ['Tối: --primary trên --primary-soft', D('--primary'), D('--primary-soft'), 5.69],
  ['Tối: --good trên --good-soft', D('--good'), D('--good-soft'), 9.69],
  ['Tối: --on-status trên --good', D('--on-status'), D('--good'), 12.56],
  ['Tối: --good trên --surface', D('--good'), D('--surface'), 11.04],
  ['Tối: --on-status trên --bad', D('--on-status'), D('--bad'), 8.37]
];
const pairOut = []; let pairFail = 0; const CONTRAST = {};
for (const [name, a, b, spec] of PAIRS) {
  if (!a || !b) { pairFail++; pairOut.push(name + ': thiếu biến'); continue; }
  const c = contrast(a, b); CONTRAST[name] = c;
  const ok = c >= 4.5 && Math.abs(c - spec) < 0.05;
  if (!ok) pairFail++;
  pairOut.push(`${name} ${fmt(c)}${ok ? '' : ` (đặc tả ${fmt(spec)})`}`);
}
check('TC-5.2 tương phản', pairFail === 0, `${PAIRS.length - pairFail}/${PAIRS.length} cặp ≥ 4,5 và khớp số đặc tả: ` + pairOut.join('; '));
const focusL = contrast(L('--primary'), L('--surface')); const focusD = contrast(D('--primary'), D('--surface'));
check('TC-5.2 viền focus', focusL >= 3 && focusD >= 3, `--primary trên --surface: sáng ${fmt(focusL)}, tối ${fmt(focusD)} (≥ 3)`);

// ================= TC-5.3 =================
const de = [];
let deFail = 0;
for (const [mode, G] of [['sáng', L], ['tối', D]]) for (const k of ['--good', '--bad', '--accent']) {
  const v = dE(G('--primary'), G(k)); if (v < 25) deFail++;
  de.push(`${mode} --primary/${k} ${v.toFixed(1).replace('.', ',')}`);
}
const deOld = dE(hexToRgb('#1d6b3e'), hexToRgb('#15803d'));
check('TC-5.3 ΔE76', deFail === 0, de.join('; ') + ` (đối chứng: #1D6B3E/#15803d cũ = ${deOld.toFixed(1).replace('.', ',')} < 25)`);
const keys = new Set(Object.keys(DARK1).concat(Object.keys(DARK2)));
const diff = [...keys].filter((k) => DARK1[k] !== DARK2[k]);
check('TC-5.3 hai khối tối giống nhau', Object.keys(DARK1).length > 5 && diff.length === 0,
  diff.length ? 'khác: ' + diff.map((k) => `${k} ${DARK1[k]} ≠ ${DARK2[k]}`).join(', ') : `${keys.size} biến, cùng giá trị ở @media … :root:not([data-theme="light"]) và :root[data-theme="dark"]`);

// ================= TC-5.4 =================
function readPng(file) {
  const buf = fs.readFileSync(file);
  const sig = buf.slice(0, 8).toString('hex') === '89504e470d0a1a0a';
  let off = 8; const chunks = []; let ihdr = null; const idat = []; let trns = null; let crcOk = true;
  const crcTable = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0; }
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  while (off < buf.length) {
    const len = buf.readUInt32BE(off); const type = buf.slice(off + 4, off + 8).toString('ascii');
    const data = buf.slice(off + 8, off + 8 + len);
    if (crc(buf.slice(off + 4, off + 8 + len)) !== buf.readUInt32BE(off + 8 + len)) crcOk = false;
    chunks.push(type);
    if (type === 'IHDR') ihdr = { w: data.readUInt32BE(0), h: data.readUInt32BE(4), depth: data[8], ctype: data[9], interlace: data[12] };
    if (type === 'IDAT') idat.push(data);
    if (type === 'tRNS') trns = data;
    off += 12 + len;
    if (type === 'IEND') break;
  }
  const out = { size: buf.length, sig, crcOk, chunks, ihdr, trns: !!trns };
  if (!ihdr || ihdr.depth !== 8 || ihdr.interlace) return out;
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ihdr.ctype];
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = ch; const stride = ihdr.w * bpp; const px = Buffer.alloc(stride * ihdr.h);
  for (let y = 0; y < ihdr.h; y++) {
    const ft = raw[y * (stride + 1)]; const line = raw.slice(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[y * stride + x - bpp] : 0; const b = y ? px[(y - 1) * stride + x] : 0; const c = x >= bpp && y ? px[(y - 1) * stride + x - bpp] : 0;
      let v = line[x];
      if (ft === 1) v += a; else if (ft === 2) v += b; else if (ft === 3) v += (a + b) >> 1;
      else if (ft === 4) { const p = a + b - c; const pa = Math.abs(p - a); const pb = Math.abs(p - b); const pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[y * stride + x] = v & 0xff;
    }
  }
  const alpha = (x, y) => {
    if (ihdr.ctype === 6) return px[(y * ihdr.w + x) * 4 + 3];
    if (ihdr.ctype === 4) return px[(y * ihdr.w + x) * 2 + 1];
    if (ihdr.ctype === 3 && trns) { const i = px[y * ihdr.w + x]; return i < trns.length ? trns[i] : 255; }
    return 255;
  };
  out.alpha = alpha;
  // tỉ lệ điểm trong suốt / số điểm có nét theo hàng (để xem phần dưới có còn dải chữ không)
  const rows = []; for (let y = 0; y < ihdr.h; y++) { let n = 0; for (let x = 0; x < ihdr.w; x++) if (alpha(x, y) > 32) n++; rows.push(n); }
  out.rows = rows;
  out.opaque = rows.reduce((s, n) => s + n, 0) / (ihdr.w * ihdr.h);
  return out;
}
const LOGO = path.join(ROOT, 'assets/img/logo-vlsn.png');
if (!fs.existsSync(LOGO)) check('TC-5.4 file logo', false, 'không có assets/img/logo-vlsn.png');
else {
  const p = readPng(LOGO);
  const corners = p.alpha ? [p.alpha(0, 0), p.alpha(p.ihdr.w - 1, 0), p.alpha(0, p.ihdr.h - 1), p.alpha(p.ihdr.w - 1, p.ihdr.h - 1)] : null;
  const hasAlpha = p.ihdr && (p.ihdr.ctype === 6 || p.ihdr.ctype === 4 || p.trns);
  check('TC-5.4 PNG hợp lệ', p.sig && p.crcOk && p.ihdr && p.chunks[0] === 'IHDR' && p.chunks[p.chunks.length - 1] === 'IEND',
    `chữ ký PNG ${p.sig}, CRC mọi khối đúng ${p.crcOk}, khối: ${[...new Set(p.chunks)].join(',')}`);
  check('TC-5.4 logo tạm 96×96 ≤ 20 KB, trong suốt', p.ihdr && p.ihdr.w === 96 && p.ihdr.h === 96 && p.size <= 20 * 1024 && hasAlpha && corners && corners.every((a) => a === 0),
    `${p.ihdr && p.ihdr.w}×${p.ihdr && p.ihdr.h}, ${p.size} byte (${(p.size / 1024).toFixed(1).replace('.', ',')} KB), kiểu màu ${p.ihdr && p.ihdr.ctype} (6 = RGBA), alpha 4 góc = ${corners && corners.join('/')}, phủ ${(p.opaque * 100).toFixed(0)}% diện tích`);
  if (p.rows) {
    // Gợi ý "đã cắt chữ": dải chữ ở dưới sẽ là một vùng nét tách rời biểu tượng bằng một khoảng hàng trống
    const nonEmpty = p.rows.map((n, y) => (n ? y : -1)).filter((y) => y >= 0);
    const gaps = []; for (let i = 1; i < nonEmpty.length; i++) if (nonEmpty[i] - nonEmpty[i - 1] > 1) gaps.push([nonEmpty[i - 1], nonEmpty[i]]);
    check('TC-5.4 đã cắt phần chữ (dấu hiệu)', gaps.length === 0,
      `hàng có nét: ${nonEmpty[0]}–${nonEmpty[nonEmpty.length - 1]}; khoảng hàng trống giữa các vùng nét: ${gaps.length ? JSON.stringify(gaps) : 'không có (một khối liền, không có dải chữ tách riêng ở dưới)'}. Xem ảnh phóng to để xác nhận bằng mắt`);
  }
}
for (const f of ['index.html', 'admin.html']) {
  const t = SRC[f];
  const m = /<!--([^]*?)-->\s*(?:<a[^>]*>\s*)?<img\b[^>]*class="[^"]*\bbrand-logo\b[^"]*"[^>]*>/i.exec(t);
  const imgs = t.match(/<img\b[^>]*\bbrand-logo\b[^>]*>/gi) || [];
  check(`TC-5.4 chú thích "Logo TẠM" (${f})`, !!m && /Logo TẠM/.test(m[1]) && imgs.length === 1,
    m ? `chú thích ngay trước img.brand-logo: "${m[1].trim().slice(0, 140)}"; số img.brand-logo: ${imgs.length}` : 'không thấy chú thích ngay trên img.brand-logo');
}

// ================= TC-5.5 (tĩnh) =================
for (const f of ['index.html', 'admin.html']) {
  const t = SRC[f];
  const img = (t.match(/<img\b[^>]*\bbrand-logo\b[^>]*>/i) || [''])[0];
  const icons = t.match(/<link\b[^>]*rel="(?:shortcut )?icon"[^>]*>/gi) || [];
  check(`TC-5.5 thẻ logo + favicon (${f})`, /src="assets\/img\/logo-vlsn\.png"/.test(img) && /alt="Vật Lý Siêu Nhẩm"/.test(img) && !/style=/.test(img) &&
    icons.length === 1 && /href="assets\/img\/logo-vlsn\.png"/.test(icons[0]) && !/Φ/.test(t),
  `img: ${img}; favicon: ${icons.join(' ') || 'không có'}; ký tự Φ: ${(t.match(/Φ/g) || []).length}`);
}
const imgPaths = [];
for (const [f, t] of Object.entries(SRC)) {
  const re = /[\w./-]*\.(png|svg|jpe?g|webp|ico|gif)\b|data:image\/[\w+.-]+/gi; let m;
  while ((m = re.exec(t))) imgPaths.push(`${f}:${m[0]}`);
}
const otherImg = imgPaths.filter((x) => !/assets\/img\/logo-vlsn\.png$/.test(x));
check('TC-5.5 chỉ một file logo', otherImg.length === 0, otherImg.length ? 'đường dẫn ảnh khác: ' + otherImg.join(', ') : `chỉ có ${imgPaths.length} chỗ trỏ assets/img/logo-vlsn.png (${[...new Set(imgPaths.map((x) => x.split(':')[0]))].join(', ')})`);

// ================= TC-5.6 =================
for (const f of ['index.html', 'admin.html']) {
  const metas = SRC[f].match(/<meta\b[^>]*name="theme-color"[^>]*>/gi) || [];
  const light = metas.find((m) => /content="#1D6B3E"/i.test(m) && /media="\(prefers-color-scheme:\s*light\)"/.test(m));
  const dark = metas.find((m) => /content="#0f1420"/i.test(m) && /media="\(prefers-color-scheme:\s*dark\)"/.test(m));
  check(`TC-5.6 theme-color (${f})`, metas.length === 2 && light && dark, metas.join(' ') || 'không có');
}

// ================= Mục "Thiết kế kỹ thuật" kiểm được tĩnh =================
const ruleOf = (sel) => { const re = new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*[,{]', 'g'); const out = []; let m; while ((m = re.exec(cssNC))) out.push(blockAfter(cssNC, m.index)); return out.join(';'); };
const hov = ruleOf('.btn-primary:hover');
check('Nút chính khi rê chuột', /background(-color)?\s*:\s*var\(--primary-hover\)/.test(hov) && !/brightness/.test(hov), `.btn-primary:hover { ${hov.replace(/\s+/g, ' ').trim()} }`);
const ON = ['.opt.right .key', '.opt.wrong .key', '.tf-btns button.right', '.tf-btns button.wrong', '.key-pick button.sel'];
const onRes = ON.map((s) => { const r = ruleOf(s); return [s, /color\s*:\s*var\(--on-status\)/.test(r) && !/(^|[^-])color\s*:\s*#fff/.test(r)]; });
check('Chữ trên nền đúng/sai dùng --on-status', onRes.every(([, ok]) => ok), onRes.map(([s, ok]) => `${s}: ${ok ? 'var(--on-status)' : 'CHƯA'}`).join('; '));
const fontLinks = ['index.html', 'admin.html'].map((f) => [f, (SRC[f].match(/<link\b[^>]*fonts\.googleapis\.com\/css2[^>]*>/gi) || [])]);
check('Phông: một link gộp Be Vietnam Pro + Montserrat 700;800', fontLinks.every(([, l]) => l.length === 1 && /family=Be\+Vietnam\+Pro:wght@400;500;600;700;800&(amp;)?family=Montserrat:wght@700;800&(amp;)?display=swap/.test(l[0])),
  fontLinks.map(([f, l]) => `${f}: ${l.length} link`).join('; '));
const fh = LIGHT['--font-head'] || '';
const hRule = ruleOf('h1');
check('Phông tiêu đề --font-head', /^"?Montserrat"?\s*,\s*var\(--font\)$/.test(fh) && /font-family\s*:\s*var\(--font-head\)/.test(hRule), `--font-head: ${fh}; h1… { ${hRule.replace(/\s+/g, ' ').trim().slice(0, 120)} }`);
check('Tiêu đề trang quản trị', /<title>Quản trị · Luyện đề<\/title>/.test(SRC['admin.html']), (SRC['admin.html'].match(/<title>[^<]*<\/title>/) || ['?'])[0]);
const FOOT = ['HỆ THỐNG GIÁO DỤC VẬT LÝ SIÊU NHẨM', 'Hotline: 0978 650726 - 0326 425 111', 'VẬT LÝ SIÊU NHẨM - ĐỊNH HƯỚNG TRUYỀN CẢM HỨNG'];
check('Chân trang trong HTML', ['index.html', 'admin.html'].every((f) => FOOT.every((s) => SRC[f].includes(s))), 'cả hai trang có đủ 3 dòng chân trang');
const hint = /TEN_GIAO_VIEN[^\n]*hint\s*:\s*'Không hiển thị trên trang học sinh \(chỉ dùng nội bộ\)'/.test(SRC['assets/js/admin.js']);
check('Gợi ý ô Tên giáo viên', hint, hint ? 'SETTING_UI.TEN_GIAO_VIEN có hint đúng chữ' : 'không thấy hint');
const printSame = (s) => (noComments(s).match(/@media\s+print\s*\{/) ? blockAfter(noComments(s), noComments(s).search(/@media\s+print\s*\{/)).replace(/\s+/g, '') : '');
check('Giao diện in giữ nguyên', printSame(css) === printSame(gitShow('assets/css/style.css')), 'khối @media print giống ' + BASE_REF);

// ================= TC-5.14 =================
let gd = '';
try { gd = execSync(`git diff ${BASE_REF} -- apps-script/`, { cwd: ROOT, encoding: 'utf8' }); } catch (e) { gd = 'LỖI: ' + e.message; }
check('TC-5.14 Code.gs không đổi', gd.trim() === '', gd.trim() ? gd.slice(0, 200) : `git diff ${BASE_REF} -- apps-script/ rỗng`);

const fails = R.filter((x) => !x.pass);
console.log(`\n${R.length - fails.length}/${R.length} mục đạt` + (fails.length ? ' — KHÔNG ĐẠT: ' + fails.map((x) => x.tc).join(', ') : ''));
if (process.env.JSON_OUT) fs.writeFileSync(process.env.JSON_OUT, JSON.stringify({ R, LIGHT, DARK1, CONTRAST }, null, 2));
if (fails.length) process.exitCode = 1;
