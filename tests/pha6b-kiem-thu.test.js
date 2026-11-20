// Pha 6b — kiểm thử độc lập (người kiểm thử) cho bản sửa "bảng kẻ gạch" trong rich() (assets/js/common.js).
// Viết theo đặc tả trước khi đọc code: bảng "đơn giản" pandoc có gạch "–"/"-", khoảng trắng canh cột đã gộp
// → <table> như khối [BẢNG]; $…$ trong ô giữ cho KaTeX; không mất chữ; không nhận nhầm văn bản thường.
//   node tests/pha6b-kiem-thu.test.js
// Nội dung câu hỏi tự soạn (trừ ví dụ của giáo viên trong đặc tả).
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ---------- nạp common.js trong vm (giống tests/common-cache.test.js) ----------
function fakeStorage() {
  const m = new Map();
  return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } };
}
function fakeEl() {
  const cls = new Set();
  return { id: '', className: '', innerHTML: '', textContent: '', children: [], setAttribute() {}, appendChild(c) { this.children.push(c); return c; }, remove() {},
    classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c), toggle() {}, contains: (c) => cls.has(c) } };
}
function load() {
  const local = fakeStorage(), session = fakeStorage();
  const document = { body: fakeEl(), getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => fakeEl(), addEventListener() {}, documentElement: {} };
  const window = { APP_CONFIG: { API_URL: 'x' }, localStorage: local, sessionStorage: session, scrollY: 0, scrollTo() {}, addEventListener() {} };
  const ctx = { window, document, localStorage: local, sessionStorage: session, setTimeout: () => 0, clearTimeout() {}, getComputedStyle: () => ({ getPropertyValue: () => '' }), console };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'common.js'), 'utf8'), ctx);
  const rich = ctx.rich || (window.App && window.App.rich);
  if (typeof rich !== 'function') throw new Error('Không tìm thấy rich() trong common.js');
  return rich;
}
const rich = load();

// ---------- bộ đọc HTML tối giản (không có jsdom) ----------
const ENT = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'", nbsp: ' ', '#39': "'", '#039': "'", '#x27': "'", '#34': '"' };
const decode = (s) => s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => {
  if (ENT[e.toLowerCase()] != null) return ENT[e.toLowerCase()];
  if (/^#x/i.test(e)) return String.fromCodePoint(parseInt(e.slice(2), 16));
  if (/^#/.test(e)) return String.fromCodePoint(+e.slice(1));
  return m;
});
const VOID = new Set(['br', 'img', 'hr', 'input', 'col', 'wbr', 'meta', 'link']);
function parse(html) {
  const root = { tag: '#root', attrs: '', children: [] };
  const stack = [root];
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>|([^<]+)|(<)/g;
  let m;
  while ((m = re.exec(html))) {
    const top = stack[stack.length - 1];
    if (m[4] != null || m[5] != null) { top.children.push({ text: decode(m[4] != null ? m[4] : m[5]) }); continue; }
    const tag = m[2].toLowerCase();
    if (m[1]) { // đóng thẻ
      for (let i = stack.length - 1; i > 0; i--) if (stack[i].tag === tag) { stack.length = i; break; }
      continue;
    }
    const el = { tag, attrs: m[3], children: [] };
    top.children.push(el);
    if (!VOID.has(tag) && !/\/\s*$/.test(m[3])) stack.push(el);
  }
  return root;
}
const BLOCK = /^(div|p|br|tr|td|th|table|thead|tbody|li|ul|ol|h\d)$/;
function text(n) {
  if (n.text != null) return n.text;
  const inner = n.children.map(text).join('');
  return BLOCK.test(n.tag) ? ' ' + inner + ' ' : inner;
}
function all(n, tag, out = []) { if (n.tag === tag) out.push(n); (n.children || []).forEach((c) => all(c, tag, out)); return out; }
const norm = (s) => String(s).replace(/[{}]/g, '').replace(/\s+/g, ' ').trim();
function tables(html) {
  const root = parse(html);
  return all(root, 'table').map((t) => all(t, 'tr').map((tr) => tr.children.filter((c) => c.tag === 'td' || c.tag === 'th').map((c) => ({ th: c.tag === 'th', t: norm(text(c)) }))));
}
const outsideText = (html) => { const root = parse(html); const strip = (n) => { if (n.tag === 'table') return ' '; if (n.text != null) return n.text; return n.children.map(strip).join(' '); }; return norm(strip(root)); };

// "không mất chữ": mọi từ (bỏ dòng chỉ có gạch) của đầu vào có trong textContent đầu ra (bỏ { } do đổi dấu phẩy thập phân)
function lostWords(input, html) {
  const out = norm(text(parse(html)));
  const words = input.split(/\r?\n/).filter((l) => !/^[\s\-–—]+$/.test(l) || !/[-–—]{3,}/.test(l)).join(' ').split(/\s+/).filter(Boolean);
  // so theo từng từ; bỏ ngoặc nhọn ở cả hai phía
  return words.filter((w) => w !== '|' && !out.includes(norm(w)));
}

// ---------- khung chạy ----------
let pass = 0, fail = 0;
const results = [];
function ok(id, name, cond, detail) {
  results.push({ id, name, ok: !!cond, detail: detail == null ? '' : detail });
  if (cond) pass++; else fail++;
  console.log(`${cond ? '✓' : '✗'} [${id}] ${name}${detail ? '  — ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''}`);
}
function run(id, name, fn) {
  try { fn(); } catch (e) { ok(id, name + ' (ném lỗi)', false, String(e && e.stack || e).slice(0, 300)); }
}
const shape = (tb) => tb.map((r) => r.length);
const cells = (tb) => tb.map((r) => r.map((c) => c.t));
const thRows = (tb) => tb.filter((r) => r.length && r.every((c) => c.th)).length;
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---------- dữ liệu ----------
const VD = [
  'Một học sinh đo suất điện động và điện trở trong của một viên pin, số liệu ghi được trong bảng sau:',
  '–––––––––––––––––––––––––––––––––––-',
  'Lần đo $U$ (V) $I$ (mA)',
  '–––––––––––– ––––––––––- ––––––––––––',
  '1 5,88 120',
  '2 5,85 150',
  '3 5,80 200',
  '–––––––––––––––––––––––––––––––––––-',
  'Suất điện động của viên pin này là'
].join('\n');
const VD_CELLS = [['Lần đo', '$U$ (V)', '$I$ (mA)'], ['1', '5,88', '120'], ['2', '5,85', '150'], ['3', '5,80', '200']];
const BORDER = '–––––––––––––––––––––––––––––––––––';

// ===== A. Ví dụ thật =====
run('A1', 'ví dụ của giáo viên', () => {
  const h = rich(VD);
  const T = tables(h);
  ok('A1', 'ví dụ thật → đúng 1 bảng', T.length === 1, `số bảng ${T.length}`);
  if (!T.length) return;
  ok('A1', 'ví dụ thật → 3 cột × 4 dòng (1 tiêu đề + 3 hàng)', eq(shape(T[0]), [3, 3, 3, 3]), shape(T[0]));
  ok('A1', 'ví dụ thật → nội dung từng ô đúng', eq(cells(T[0]), VD_CELLS), cells(T[0]));
  ok('A1', 'ví dụ thật → dòng đầu là tiêu đề (th), 3 hàng dữ liệu (td)', T[0][0].every((c) => c.th) && T[0].slice(1).every((r) => r.every((c) => !c.th)), T[0].map((r) => r.map((c) => (c.th ? 'th' : 'td')).join(',')).join(' / '));
  ok('A1', 'công thức $U$, $I$ còn nguyên dấu $ cho KaTeX', /\$U\$/.test(h) && /\$I\$/.test(h));
  ok('A1', 'không còn dòng gạch nào in thành chữ', !/[–-]{3,}/.test(outsideText(h)), outsideText(h));
  ok('A1', 'đoạn văn trước/sau bảng còn nguyên', /số liệu ghi được trong bảng sau:/.test(outsideText(h)) && /Suất điện động của viên pin này là$/.test(outsideText(h)), outsideText(h));
  ok('A1', 'bảng dùng cùng lớp CSS với [BẢNG]', /class="[^"]*q-table/.test(h) && /class="[^"]*q-table/.test(rich('[BẢNG] a | b\n1 | 2')));
  ok('A1', 'không mất chữ', !lostWords(VD, h).length, lostWords(VD, h));
  ok('A1', 'dòng kết thúc \\r\\n cho cùng kết quả', eq(tables(rich(VD.replace(/\n/g, '\r\n'))).map(cells), [VD_CELLS]));
});

// ===== B. Biến thể vẫn phải thành bảng =====
function expectTable(id, name, input, wantCells, opts) {
  opts = opts || {};
  run(id, name, () => {
    const h = rich(input);
    const T = tables(h);
    const nT = opts.tables || 1;
    ok(id, name + ' → ' + nT + ' bảng', T.length === nT, `số bảng ${T.length}`);
    if (wantCells) ok(id, name + ' → ô đúng', eq(T.map(cells), nT === 1 ? [wantCells] : wantCells), T.map(cells));
    if (opts.header != null) ok(id, name + ' → số dòng tiêu đề = ' + opts.header, T.length && thRows(T[0]) === opts.header, T.length ? thRows(T[0]) : '-');
    const lost = lostWords(input, h);
    ok(id, name + ' → không mất chữ', !lost.length, lost);
    if (opts.after) opts.after(h, T);
  });
}

expectTable('B1', 'không viền trên', [
  'Bảng số liệu:',
  'Lần đo $U$ (V) $I$ (mA)',
  '–––––––––––– ––––––––––- ––––––––––––',
  '1 5,88 120',
  '2 5,85 150',
  BORDER,
  'Tính $E$.'
].join('\n'), [['Lần đo', '$U$ (V)', '$I$ (mA)'], ['1', '5,88', '120'], ['2', '5,85', '150']], { header: 1 });

expectTable('B2', 'không tiêu đề (gạch chia cột ở trên và dưới)', [
  'Kết quả đo:',
  '–––––– –––––– ––––––',
  '1 0,25 4,0',
  '2 0,50 8,1',
  '3 0,75 12,0',
  '–––––– –––––– ––––––',
  'Nhận xét.'
].join('\n'), [['1', '0,25', '4,0'], ['2', '0,50', '8,1'], ['3', '0,75', '12,0']], { header: 0 });

expectTable('B3', '2 cột (tiêu đề có công thức)', [
  BORDER,
  'Chất $c$ (J/kg.K)',
  '––––––––––– –––––––––––––––––',
  'Nhôm 880',
  'Đồng 380',
  'Chì 130',
  BORDER
].join('\n'), [['Chất', '$c$ (J/kg.K)'], ['Nhôm', '880'], ['Đồng', '380'], ['Chì', '130']], { header: 1 });

expectTable('B4', '4 cột', [
  'Bảng:',
  BORDER,
  'Lần $t$ (s) $x$ (cm) $v$ (cm/s)',
  '–––– –––––––– –––––––– ––––––––––',
  '1 0,5 2,0 4,0',
  '2 1,0 8,0 8,0',
  BORDER
].join('\n'), [['Lần', '$t$ (s)', '$x$ (cm)', '$v$ (cm/s)'], ['1', '0,5', '2,0', '4,0'], ['2', '1,0', '8,0', '8,0']], { header: 1 });

expectTable('B5', 'ô có công thức chứa dấu cách', [
  BORDER,
  'Đại lượng $\\Delta t$ (s) $v_0 + a t$',
  '–––––––––– –––––––––– ––––––––––',
  '1 $2 \\cdot 10^{3}$ 5',
  '2 $4 \\cdot 10^{3}$ $7 + 1$',
  BORDER
].join('\n'), [['Đại lượng', '$\\Delta t$ (s)', '$v_0 + a t$'], ['1', '$2 \\cdot 10^3$', '5'], ['2', '$4 \\cdot 10^3$', '$7 + 1$']], {
  header: 1,
  after: (h) => ok('B5', 'không cắt giữa $…$ (mọi ô có số $ chẵn)', tables(h).every((tb) => tb.every((r) => r.every((c) => (c.t.match(/\$/g) || []).length % 2 === 0))))
});

expectTable('B6', 'gạch "-" thường thay "–"', [
  'Số liệu:',
  '-----------------------------------',
  'Lần đo $U$ (V) $I$ (mA)',
  '------------ ----------- ------------',
  '1 5,88 120',
  '2 5,85 150',
  '3 5,80 200',
  '-----------------------------------',
  'Hết bảng.'
].join('\n'), VD_CELLS, { header: 1 });

expectTable('B7', 'bảng nằm giữa đoạn văn', [
  'Đoạn đầu: một vật chuyển động thẳng.',
  'Vị trí của vật theo thời gian:',
  BORDER,
  'Lần $t$ (s) $x$ (m)',
  '–––––– –––––– ––––––',
  '1 0 0',
  '2 1 5',
  BORDER,
  'Đoạn sau: tính vận tốc trung bình.',
  'Dòng cuối cùng.'
].join('\n'), [['Lần', '$t$ (s)', '$x$ (m)'], ['1', '0', '0'], ['2', '1', '5']], {
  header: 1,
  after: (h) => {
    const o = outsideText(h);
    ok('B7', 'văn bản trước + sau bảng đúng thứ tự, ngoài bảng', /^Đoạn đầu.*theo thời gian:.*Đoạn sau: tính vận tốc trung bình\. Dòng cuối cùng\.$/.test(o), o);
    ok('B7', 'thứ tự: đoạn đầu → bảng → đoạn sau', h.indexOf('Đoạn đầu') < h.indexOf('<table') && h.indexOf('<table') < h.indexOf('Đoạn sau'));
  }
});

expectTable('B8a', 'hai bảng liền nhau (cách 1 dòng trống)', [
  'Hai bảng:',
  BORDER,
  'Lần $U$ (V)',
  '–––––– ––––––',
  '1 5,0',
  BORDER,
  '',
  BORDER,
  'Lần $I$ (A)',
  '–––––– ––––––',
  '1 0,5',
  '2 0,7',
  BORDER,
  'Hết.'
].join('\n'), [[['Lần', '$U$ (V)'], ['1', '5,0']], [['Lần', '$I$ (A)'], ['1', '0,5'], ['2', '0,7']]], { tables: 2 });

expectTable('B8b', 'hai bảng liền nhau (cách 1 dòng chữ)', [
  BORDER,
  'Lần $U$ (V)',
  '–––––– ––––––',
  '1 5,0',
  BORDER,
  'Bảng 2:',
  BORDER,
  'Lần $I$ (A)',
  '–––––– ––––––',
  '1 0,5',
  BORDER
].join('\n'), [[['Lần', '$U$ (V)'], ['1', '5,0']], [['Lần', '$I$ (A)'], ['1', '0,5']]], { tables: 2 });

expectTable('B8c', 'hai bảng sát nhau (viền dưới bảng 1 ngay trên viền trên bảng 2)', [
  BORDER,
  'Lần $U$ (V)',
  '–––––– ––––––',
  '1 5,0',
  BORDER,
  BORDER,
  'Lần $I$ (A)',
  '–––––– ––––––',
  '1 0,5',
  BORDER
].join('\n'), [[['Lần', '$U$ (V)'], ['1', '5,0']], [['Lần', '$I$ (A)'], ['1', '0,5']]], { tables: 2 });

run('B9', 'câu có cả [BẢNG] cũ và bảng kẻ gạch', () => {
  const old = '[BẢNG] Chất | Nhiệt dung riêng (J/kg.K)\nChất X | 880\nChất Y | 460';
  const oldAlone = rich(old);
  const input = 'Bảng 1:\n' + old + '\nBảng 2:\n' + VD.split('\n').slice(1, 8).join('\n') + '\nTính.';
  const h = rich(input);
  const T = tables(h);
  ok('B9', '[BẢNG] + bảng kẻ gạch → 2 bảng', T.length === 2, T.map(cells));
  ok('B9', 'bảng [BẢNG] giữ nguyên 2 cột × 3 dòng', T[0] && eq(cells(T[0]), [['Chất', 'Nhiệt dung riêng (J/kg.K)'], ['Chất X', '880'], ['Chất Y', '460']]), T[0] && cells(T[0]));
  ok('B9', 'bảng kẻ gạch đúng ô', T[1] && eq(cells(T[1]), VD_CELLS), T[1] && cells(T[1]));
  const m = /<table[\s\S]*?<\/table>/.exec(oldAlone);
  ok('B9', 'HTML bảng [BẢNG] giống hệt khi đứng riêng', m && h.includes(m[0]));
  ok('B9', 'không mất chữ', !lostWords(input.replace('[BẢNG]', ''), h).length, lostWords(input.replace('[BẢNG]', ''), h));
});

expectTable('B10a', 'khoảng trắng canh cột còn nguyên (pandoc gốc, có viền)', [
  '-----------------------------------',
  'Lần đo   $U$ (V)   $I$ (mA)',
  '-------- --------- ----------',
  '1        5,88      120',
  '2        5,85      150',
  '-----------------------------------'
].join('\n'), [['Lần đo', '$U$ (V)', '$I$ (mA)'], ['1', '5,88', '120'], ['2', '5,85', '150']], { header: 1 });

// Ghi nhận (không chặn): không viền trên + dòng đóng là dòng CHIA CỘT (nhiều đoạn) → dạng này trùng với "bảng không tiêu đề"
// của pandoc, nên dòng chữ ngay trên có thể bị coi là đoạn văn. Ghi lại hành vi để báo cáo, không tính đạt/không đạt.
const notes = [];
function note(id, name, input) {
  const h = rich(input); const T = tables(h);
  const r = { id, name, tables: T.map(cells), header: T.length ? thRows(T[0]) : null, outside: outsideText(h), lost: lostWords(input, h) };
  notes.push(r);
  console.log(`• [${id}] (ghi nhận) ${name} — ${JSON.stringify(r)}`);
}
note('N1', 'không viền trên, dòng đóng nhiều đoạn, cách 1 dấu cách', 'Bảng:\nLần đo $U$ (V) $I$ (mA)\n–––– –––– ––––\n1 5,88 120\n2 5,85 150\n–––– –––– ––––\nHết.');
note('N2', 'như N1 nhưng còn khoảng trắng canh cột', 'Lần đo   $U$ (V)   $I$ (mA)\n-------- --------- ----------\n1        5,88      120\n-------- --------- ----------');
note('N3', 'ô mơ hồ: tiêu đề "Lần đo $U$ (V) Ghi chú" (4 mảnh, 3 cột)', BORDER + '\nLần đo $U$ (V) Ghi chú\n–––– –––– ––––\n1 5,88 tốt\n' + BORDER);
note('N4', 'tiêu đề 2 cột không công thức "Chất Nhiệt dung riêng (J/kg.K)"', BORDER + '\nChất Nhiệt dung riêng (J/kg.K)\n–––– ––––\nNhôm 880\nChất X 460\n' + BORDER);

// ===== C. KHÔNG được thành bảng =====
function expectText(id, name, input, mustKeep) {
  run(id, name, () => {
    const h = rich(input);
    const T = tables(h);
    ok(id, name + ' → không thành bảng', T.length === 0, T.map(cells));
    const lost = lostWords(input, h);
    ok(id, name + ' → không mất chữ', !lost.length, lost);
    if (mustKeep) ok(id, name + ' → dòng gạch vẫn in ra', norm(text(parse(h))).includes(norm(mustKeep)), norm(text(parse(h))));
  });
}
expectText('C1', 'dòng gạch đơn lẻ', 'Phần trên.\n––––––––––––––––––––\nPhần dưới.', '––––––––––––––––––––');
expectText('C2', '"---------- HẾT ----------"', 'Câu 40. ...\n---------- HẾT ----------', '---------- HẾT ----------');
expectText('C2b', '"–––––– HẾT ––––––" (gạch dài)', 'Câu 40.\n–––––– HẾT ––––––', '–––––– HẾT ––––––');
expectText('C3', 'gạch đầu dòng "- ý a"', 'Chọn các ý đúng:\n- ý a: vật đứng yên\n- ý b: vật chuyển động\n- ý c 1 2', '- ý a: vật đứng yên');
expectText('C4', 'công thức "$a - b$"', 'Tính $a - b$ khi $a = 5$, $b - 3 = 0$.\nKết quả $a - b - c$.');
expectText('C5', 'lời giải có dòng "–––" phân cách bước', 'Bước 1: $E = U + Ir$\n–––\nBước 2: thay số 5,88 = E - 0,12r\n–––\nBước 3: giải hệ.', '–––');
expectText('C5b', 'lời giải: viền — chữ — viền (không có dòng chia cột)', 'Lời giải:\n––––––––––––––––\nTa có $E = 6$ V\n––––––––––––––––\nĐáp số 6.', '––––––––––––––––');
expectText('C6', 'dòng chia cột không có dòng đóng', 'Ghi chú:\n––––– –––––\n1 2\n3 4\nHết.', '––––– –––––');
expectText('C7', 'tiêu đề + chia cột nhưng không có hàng dữ liệu', BORDER + '\nLần đo $U$ (V)\n––––– –––––\n' + BORDER + '\nHết.');
expectText('C8', 'dòng "— — —" (gạch rời ngắn)', 'Điền vào chỗ trống: — — — và - - -.');

// ===== D. XSS =====
run('D1', 'XSS trong ô', () => {
  const input = [BORDER, 'Lần đo $U$ (V) Ghi chú', '–––––– –––––– ––––––', '1 5,88 <img src=x onerror=alert(1)>', '2 5,85 <script>alert(2)</script>', BORDER].join('\n');
  const h = rich(input);
  ok('D1', 'không có thẻ <img>/<script> thật trong HTML', !/<img|<script/i.test(h), h.slice(0, 300));
  ok('D1', 'chữ được escape (&lt;img …) và vẫn hiển thị', /&lt;img/.test(h) && /&lt;script/.test(h));
  ok('D1', 'không có thuộc tính onerror thật', !all(parse(h), 'img').length && !/<[^>]+onerror=/i.test(h));
  const T = tables(h);
  ok('D1', 'vẫn là bảng', T.length === 1, T.map(cells));
  const hdr = [BORDER, '<b onmouseover=alert(1)>Lần</b> $U$ (V)', '–––––– ––––––', '1 5', BORDER].join('\n');
  ok('D1', 'thẻ trong dòng tiêu đề cũng bị escape', !/<b /.test(rich(hdr)));
});

// ===== E. Không mất chữ — quét nhiều đầu vào =====
run('E1', 'không mất chữ trên toàn bộ ca + ca ghép ngẫu nhiên', () => {
  const lines = [BORDER, 'Lần đo $U$ (V) $I$ (mA)', '–––––––––––– ––––––––––- ––––––––––––', '1 5,88 120', '- ý a', '$a - b$', 'Chữ thường ở đây', '', '–––', '–––– ––––', 'x y z', '---------- HẾT ----------', '[BẢNG] a | b', 'c | d'];
  let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  let bad = [];
  for (let k = 0; k < 400; k++) {
    const n = 2 + Math.floor(rnd() * 12);
    const inp = Array.from({ length: n }, () => lines[Math.floor(rnd() * lines.length)]).join('\n');
    let h;
    try { h = rich(inp); } catch (e) { bad.push({ inp, err: String(e) }); continue; }
    const lost = lostWords(inp.replace(/\[BẢNG\]/g, ''), h).filter((w) => w !== '|');
    if (lost.length) bad.push({ inp, lost });
  }
  ok('E1', '400 đầu vào ghép ngẫu nhiên: không mất từ nào, không ném lỗi', !bad.length, bad.slice(0, 2));
});

// ===== F. Hiệu năng =====
run('F1', 'chuỗi dài 5 000 dòng gạch', () => {
  const shapes = {
    'viền đơn × 5000': Array(5000).fill(BORDER).join('\n'),
    'chia cột × 5000': Array(5000).fill('–––– –––– ––––').join('\n'),
    'xen kẽ viền / chữ / chia cột × 5000': Array.from({ length: 5000 }, (_, i) => [BORDER, 'a $b$ c', '––– ––– –––', '1 2 3'][i % 4]).join('\n'),
    'chia cột + dòng chữ dài không đóng × 5000': Array.from({ length: 5000 }, (_, i) => (i % 2 ? 'x '.repeat(50) : '–––– ––––')).join('\n'),
    'dòng gạch 5000 ký tự': '–'.repeat(5000) + '\n' + '– '.repeat(2500)
  };
  for (const [k, s] of Object.entries(shapes)) {
    const t0 = process.hrtime.bigint();
    rich(s);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    ok('F1', `${k}: xong < 1 s`, ms < 1000, ms.toFixed(1) + ' ms');
  }
});

console.log(`\n${pass} đạt, ${fail} không đạt`);
if (process.env.OUT) fs.writeFileSync(process.env.OUT, JSON.stringify({ results, notes }, null, 1));
if (fail) process.exitCode = 1;
