// Kiểm thử rich() (assets/js/common.js) với bảng kẻ gạch kiểu pandoc đã hỏng khoảng trắng (Pha 6b).
// node tests/bang-gach.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const window = { APP_CONFIG: { API_URL: 'x' } };
const mem = { getItem: () => null, setItem() {}, removeItem() {}, key: () => null, length: 0 };
const ctx = { window, document: { addEventListener() {}, documentElement: {} }, localStorage: mem, sessionStorage: mem, setTimeout: () => 0, console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'common.js'), 'utf8'), ctx);
const { rich } = window.App;

/** Phân tích bảng đầu tiên (đủ cho HTML do rich() sinh): [{ th: [...]|null, td: [[...]] }] */
function tables(h) {
  const res = [];
  h.replace(/<table class="q-table">([\s\S]*?)<\/table>/g, (m, inner) => {
    const head = /<thead>([\s\S]*?)<\/thead>/.exec(inner);
    const cells = (tr, tag) => [...tr.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'g'))].map((x) => x[1]);
    const body = /<tbody>([\s\S]*?)<\/tbody>/.exec(inner)[1];
    res.push({
      th: head ? cells(head[1], 'th') : null,
      td: [...body.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((r) => cells(r[1], 'td'))
    });
    return m;
  });
  return res;
}

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); } catch (e) { console.error('  ✗ ' + name + '\n    ' + (e.stack || e)); process.exitCode = 1; }
}

const D = '–'.repeat(35) + '-';
const SEP = '–'.repeat(12) + ' ' + '–'.repeat(10) + '- ' + '–'.repeat(12);
const VD = ['Một viên pin được đo, số liệu ghi được trong bảng sau:', D, 'Lần đo $U$ (V) $I$ (mA)', SEP, '1 5,88 120', '2 5,85 150', '3 5,80 200', D, 'Suất điện động của viên pin này là'].join('\n');

console.log('Bảng kẻ gạch trong rich():');

t('Ví dụ giáo viên gửi: 3 cột, 1 hàng tiêu đề + 3 hàng, không còn dòng gạch', () => {
  const h = rich(VD);
  const tb = tables(h);
  assert.strictEqual(tb.length, 1);
  assert.deepStrictEqual(tb[0].th, ['Lần đo', '$U$ (V)', '$I$ (mA)']);
  assert.deepStrictEqual(tb[0].td, [['1', '5,88', '120'], ['2', '5,85', '150'], ['3', '5,80', '200']]);
  assert(!/–––/.test(h), 'còn dòng gạch');
  assert(/^Một viên pin[^<]*bảng sau:<div class="table-wrap q-table-wrap"><table class="q-table">/.test(h), h.slice(0, 160));
  assert(/<\/table><\/div>Suất điện động của viên pin này là$/.test(h));
});

t('Không có viền trên (có viền dưới)', () => {
  const tb = tables(rich(['Bảng:', 'Lần đo $U$ (V) $I$ (mA)', SEP, '1 5,88 120', D, 'Hết.'].join('\n')));
  assert.strictEqual(tb.length, 1);
  assert.deepStrictEqual(tb[0].th, ['Lần đo', '$U$ (V)', '$I$ (mA)']);
  assert.deepStrictEqual(tb[0].td, [['1', '5,88', '120']]);
});

t('Có viền trên, kết thúc ở dòng trống (không viền dưới)', () => {
  const h = rich(['Bảng:', D, 'A B', '--- ---', '1 2', '', 'Câu hỏi.'].join('\n'));
  const tb = tables(h);
  assert.deepStrictEqual(tb[0].th, ['A', 'B']);
  assert.deepStrictEqual(tb[0].td, [['1', '2']]);
  assert(/Câu hỏi\.$/.test(h));
});

t('Không tiêu đề (pandoc headerless): chia cột → dữ liệu → chia cột', () => {
  const h = rich(['Số liệu:', '------ ------ ------', 'x 1 2', 'y 3 4', '------ ------ ------', 'Tính.'].join('\n'));
  const tb = tables(h);
  assert.strictEqual(tb.length, 1);
  assert.strictEqual(tb[0].th, null);
  assert.deepStrictEqual(tb[0].td, [['x', '1', '2'], ['y', '3', '4']]);
  assert(/^Số liệu:<div/.test(h));
});

t('Còn khoảng trắng canh cột: tách theo vị trí cột (ô có dấu cách)', () => {
  const tb = tables(rich(['---------------------------', 'Chất       Nhiệt độ sôi', '---------- ----------------', 'Nước cất   100', 'Rượu        78', '---------------------------'].join('\n')));
  assert.deepStrictEqual(tb[0].th, ['Chất', 'Nhiệt độ sôi']);
  assert.deepStrictEqual(tb[0].td, [['Nước cất', '100'], ['Rượu', '78']]);
});

t('Ô chứa $…$ có dấu cách không bị cắt; dấu phẩy thập phân trong công thức như cũ', () => {
  const tb = tables(rich([D, 'Đại lượng Giá trị', '-------- --------', '$p = 1,5 \\cdot 10^5$ Pa', D].join('\n')));
  // "Đại lượng Giá trị": 3 mảnh, 2 cột, không có công thức, không phải số → cả dòng vào ô đầu
  assert.deepStrictEqual(tb[0].th, ['Đại lượng Giá trị', '']);
  assert.deepStrictEqual(tb[0].td, [['$p = 1{,}5 \\cdot 10^5$', 'Pa']]);
});

t('Không tách được đúng n ô: ô đầu chứa cả dòng, không mất chữ', () => {
  const tb = tables(rich([D, 'Tên Ghi chú', '---- ---- ----', 'một hai ba bốn năm', D].join('\n')));
  assert.deepStrictEqual(tb[0].td, [['một hai ba bốn năm', '', '']]);
  assert.deepStrictEqual(tb[0].th, ['Tên', 'Ghi', 'chú']);
});

t('Nhãn nhiều chữ + n−1 ô số', () => {
  const tb = tables(rich([D, 'Lần $t$ (s) $x$ (m)', '---- ---- ----', 'Lần thứ nhất 0,5 -1,2', D].join('\n')));
  assert.deepStrictEqual(tb[0].th, ['Lần', '$t$ (s)', '$x$ (m)']);
  assert.deepStrictEqual(tb[0].td, [['Lần thứ nhất', '0,5', '-1,2']]);
});

t('Dòng gạch đơn lẻ / "HẾT" / chữ có gạch: giữ nguyên là chữ', () => {
  for (const s of ['Phần I\n-----\nCâu 1', '---------- HẾT ----------', 'Nhiệt độ 20 – 30 °C - khá ấm', '–––––––––\n\n–––––––––', 'a\n--- ---\n\nb']) {
    const h = rich(s);
    assert(!/<table/.test(h), 'thành bảng nhầm: ' + JSON.stringify(s));
  }
  assert.strictEqual(rich('Phần I\n-----\nCâu 1'), 'Phần I<br>-----<br>Câu 1');
});

t('Chữ rồi dòng chia cột rồi dữ liệu nhưng không có dòng đóng: không thành bảng', () => {
  assert(!/<table/.test(rich('Ý kiến:\n---- ----\nđồng ý không\nCâu sau.')));
});

t('Khối [BẢNG] cũ không đổi', () => {
  const s = 'Bảng:\n\n[BẢNG] Chất | Nhiệt dung riêng (J/kg.K)\nChất X | 880\nChất Y | $c = 4,2$\nHỏi gì đó.';
  assert.strictEqual(rich(s), 'Bảng:<div class="table-wrap q-table-wrap"><table class="q-table"><thead><tr><th>Chất</th><th>Nhiệt dung riêng (J/kg.K)</th></tr></thead><tbody><tr><td>Chất X</td><td>880</td></tr><tr><td>Chất Y</td><td>$c = 4{,}2$</td></tr></tbody></table></div>Hỏi gì đó.');
});

t('Escape HTML trong ô (không XSS)', () => {
  const h = rich([D, '<script>alert(1)</script> $x$', '---- ----', '<img src=x onerror=alert(1)> 2', D].join('\n'));
  assert(!/<script|<img/.test(h), h);
  const tb = tables(h);
  assert.deepStrictEqual(tb[0].th, ['&lt;script&gt;alert(1)&lt;/script&gt;', '$x$']);
  assert.strictEqual(tb[0].td[0][1], '2');
});

t('Hai bảng trong một câu, dòng \\r\\n', () => {
  const tb = tables(rich([D, 'a b', '--- ---', '1 2', D, 'giữa', D, 'c d', '--- ---', '3 4', D].join('\r\n')));
  assert.strictEqual(tb.length, 2);
  assert.deepStrictEqual(tb[1].td, [['3', '4']]);
});

console.log(`\n${passed} kiểm thử đạt${process.exitCode ? ', CÓ LỖI' : ''}.`);
