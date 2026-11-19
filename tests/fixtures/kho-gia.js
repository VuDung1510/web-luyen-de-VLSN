// Kho câu hỏi GIẢ (tự soạn) mô phỏng đúng ĐỊNH DẠNG trang "Kho câu hỏi" của file "KHO CÂU HỎI VẬT LÝ":
// cùng tên cột, hai kiểu đáp án Phần II, Phần III có dấu phẩy/số âm, LaTeX $…$, ô hình "Có – <mã>.png (…)",
// hai kiểu Vị trí, câu thiếu đáp án, Phần IV. KHÔNG chứa câu hỏi thật của kho (repo có thể công khai).
// Dùng: const K = require('./fixtures/kho-gia'); K.install(g) → { khoId, folderId, ... }

const HEADER = ['Mã câu', 'Lớp', 'Chương', 'Bài', 'Dạng câu hỏi', 'Mức độ', 'Mức độ từng ý (Phần II)', 'Năng lực',
  'Nội dung câu hỏi', 'A / a)', 'B / b)', 'C / c)', 'D / d)', 'Đáp án', 'Lời giải', 'Hình vẽ', 'Nguồn', 'Loại đề',
  'Năm học', 'Vị trí trong đề gốc', 'Ngày nhập', 'Ghi chú phân loại'];

const DANG = { 1: 'Phần I – Nhiều lựa chọn', 2: 'Phần II – Đúng/Sai', 3: 'Phần III – Trả lời ngắn', 4: 'Phần IV – Tự luận' };
const CHUONG = {
  12: [['Chương I. Vật lí nhiệt', ['Bài 1. Cấu trúc của chất. Sự chuyển thể', 'Bài 4. Nhiệt dung riêng']],
    ['Chương II. Khí lí tưởng', ['Bài 9. Định luật Boyle', 'Bài 11. Phương trình trạng thái khí lí tưởng']],
    ['Chương III. Từ trường', ['Bài 14. Từ trường']]],
  11: [['Chương IV. Dòng điện, mạch điện', ['Bài 25. Năng lượng và công suất điện']]]
};
const MUC = ['Biết', 'Hiểu', 'Vận dụng'];
let seq = 0;

/** Một hàng kho (mảng 22 ô) từ mô tả gọn. */
function row(o) {
  const lop = o.lop || 12;
  const [chuong, bais] = CHUONG[lop][o.ch || 0];
  const bai = bais[o.bai || 0];
  const phan = o.phan || 1;
  const ma = o.ma || `L${lop}C${(o.ch || 0) + (lop === 11 ? 4 : 1)}B${String((o.bai || 0) + 1).padStart(2, '0')}-P${phan}-${String(++seq).padStart(5, '0')}`;
  const opts = phan <= 2 ? (o.opts || (phan === 1
    ? ['Phương án một $x = 1$.', 'Phương án hai.', 'Phương án ba.', 'Phương án bốn.']
    : ['Ý thứ nhất về đại lượng $p$.', 'Ý thứ hai.', 'Ý thứ ba.', 'Ý thứ tư.'])) : ['', '', '', ''];
  return [
    ma, 'Lớp ' + lop, chuong, bai, DANG[phan], o.muc || MUC[seq % 3],
    phan === 2 ? (o.mucY != null ? o.mucY : 'a) Biết; b) Hiểu; c) Hiểu; d) Vận dụng') : '', 'Năng lực mẫu',
    o.noiDung || `Câu hỏi mẫu số ${seq} (tự soạn): một vật có khối lượng $m = ${seq}\\ \\text{kg}$. Hãy chọn phát biểu đúng.`,
    opts[0], opts[1], opts[2], opts[3],
    o.dapAn != null ? o.dapAn : '',
    o.loiGiai != null ? o.loiGiai : 'Lời giải mẫu: áp dụng $\\frac{a}{b}$.',
    o.hinh ? `Có – ${ma}.png (02. HÌNH VẼ/Lớp ${lop})` : '',
    o.nguon || 'Nguồn mẫu A', o.loaiDe || 'Đề mẫu', '2026–2027',
    o.viTri || `P${phan} – Câu ${o.cau || 1}`, '18/11/2026', ''
  ];
}

/**
 * Kho chuẩn cho kiểm thử và dev-server:
 *  - Nguồn mẫu A (Vị trí "P1 – Câu n"): lớp 12, Phần I câu 1–20 (18 có đáp án, câu 19–20 chưa có), Phần II 4 câu (hai kiểu đáp án),
 *    Phần III 6 câu ("3,0", "-120", "4383", "0,8", "12", "2,5"), 1 câu Phần IV có đáp án (bỏ qua).
 *  - Nguồn mẫu B (Vị trí "Mã 101 – P1 Câu n", số câu nhảy): P1 câu 1,2,3,12,14,15; P2 câu 1,3; P3 câu 2.
 *  - Nguồn mẫu C: hai file đề gốc trong cùng một Nguồn ("… – file: …/1. Đề X.pdf").
 *  - Lớp 11: 3 câu.
 *  - Câu lỗi định dạng: Phần II thiếu ý d, Phần III có đơn vị, Phần I thiếu phương án D.
 *  - Câu có bảng [BẢNG] (2 cột, 5 hàng); 6 câu có hình (1 hình không có trên Drive).
 */
function standardRows() {
  seq = 0;
  const rows = [];
  const tn = 'ABCD';
  for (let c = 1; c <= 20; c++) {
    rows.push(row({ phan: 1, cau: c, ch: c % 3, bai: c % 2 && c % 3 !== 2 ? 1 : 0, dapAn: c <= 18 ? tn[c % 4] : '', hinh: c === 2 || c === 5 }));
  }
  const ds = ['a) Đúng b) Sai c) Sai d) Đúng', 'a) S b) Đ c) Đ d) Đ', 'a) đúng; b) Sai, c) S. d) Đ', 'a) Đúng, b) Đúng, c) Sai, d) Sai'];
  ds.forEach((d, i) => rows.push(row({ phan: 2, cau: i + 1, ch: i % 2, dapAn: d, hinh: i === 0 })));
  ['3,0', '-120', '4383', '0,8', '12', '2,5'].forEach((d, i) => rows.push(row({ phan: 3, cau: i + 1, ch: i % 3, dapAn: d, hinh: i === 1 })));
  rows.push(row({ phan: 4, cau: 1, dapAn: 'a) $v = 2$ m/s; b) 3 s.', noiDung: 'Câu tự luận mẫu.' }));
  // [BẢNG]: 2 cột, 5 hàng (1 hàng tiêu đề + 4 hàng)
  rows.push(row({
    phan: 3, cau: 7, ch: 0, bai: 1, dapAn: '0,5', muc: 'Vận dụng',
    noiDung: 'Bảng sau cho nhiệt dung riêng của một số chất (số liệu tự soạn):\n[BẢNG] Chất | Nhiệt dung riêng (J/kg.K)\nChất X | 880\nChất Y | 460\nChất Z | 380\nChất W | 130\nTính tỉ số nhiệt lượng (làm tròn đến hàng phần mười).'
  }));
  // Nguồn B: kiểu "Mã 101 – P1 Câu n", số câu nhảy
  [[1, 1], [1, 2], [1, 3], [1, 12], [1, 14], [1, 15], [2, 1], [2, 3], [3, 2]].forEach(([p, c], i) => rows.push(row({
    phan: p, cau: c, nguon: 'Nguồn mẫu B', viTri: `Mã 101 – P${p} Câu ${c}`, ch: 1,
    dapAn: p === 1 ? tn[i % 4] : p === 2 ? 'a) S b) S c) Đ d) Đ' : '-1,5', hinh: i === 3
  })));
  // một câu nguồn B chưa có đáp án
  rows.push(row({ phan: 1, cau: 4, nguon: 'Nguồn mẫu B', viTri: 'Mã 101 – P1 Câu 4', ch: 1, dapAn: '' }));
  // Nguồn C: hai file đề gốc
  ['1. Đề X.pdf', '2. Đề Y.pdf'].forEach((f, k) => {
    for (let c = 1; c <= 3; c++) rows.push(row({ phan: 1, cau: c, nguon: 'Nguồn mẫu C', ch: 2, dapAn: tn[(c + k) % 4], viTri: `P1 – Câu ${c} (trang 1) – file: Chương 1/9. Tỉnh mẫu/${f}` }));
  });
  // Lớp 11
  rows.push(row({ lop: 11, phan: 1, cau: 1, dapAn: 'B', nguon: 'Nguồn mẫu D' }));
  rows.push(row({ lop: 11, phan: 2, cau: 1, dapAn: 'a) Đ b) Đ c) S d) S', nguon: 'Nguồn mẫu D' }));
  rows.push(row({ lop: 11, phan: 3, cau: 1, dapAn: '12,5', nguon: 'Nguồn mẫu D' }));
  // câu lỗi định dạng
  rows.push(row({ phan: 2, cau: 5, dapAn: 'a) Đúng b) Sai c) Sai', nguon: 'Nguồn mẫu E' }));               // thiếu ý d
  rows.push(row({ phan: 3, cau: 8, dapAn: '3\\ \\text{cm}.', nguon: 'Nguồn mẫu E' }));                       // có đơn vị
  rows.push(row({ phan: 1, cau: 21, dapAn: 'A', opts: ['Một.', 'Hai.', 'Ba.', ''], nguon: 'Nguồn mẫu E' })); // thiếu D
  return rows;
}

/** Kho lớn n câu (chu kì P1,P1,P1,P2,P3), mọi câu có đáp án; opts.hinh: mọi câu có hình. */
function bigRows(n, opts = {}) {
  seq = 0;
  const rows = [];
  const pad = ' Nội dung dài thêm để giống câu thật, có công thức $p_{1}V_{1} = p_{2}V_{2}$ và $\\Delta U = A + Q$.'.repeat(2);
  for (let i = 0; i < n; i++) {
    const phan = [1, 1, 1, 2, 3][i % 5];
    rows.push(row({
      phan, cau: i + 1, ch: i % 3, bai: i % 2 && i % 3 !== 2 ? 1 : 0, nguon: 'Nguồn lớn ' + (i % 7),
      dapAn: phan === 1 ? 'ABCD'[i % 4] : phan === 2 ? 'a) Đúng b) Sai c) Đúng d) Sai' : '1,5', hinh: !!opts.hinh,
      noiDung: `Câu lớn số ${i + 1}.` + pad
    }));
  }
  return rows;
}

/**
 * Gắn kho giả vào gas-shim: bảng tính id khoId (trang "Kho câu hỏi") + cây thư mục hình
 * "02. HÌNH VẼ/Lớp 12/HINH_VE_Lop12_lan1/<mã>.png" (file nằm sâu hơn đường dẫn ghi trong ô, như kho thật).
 * opts.rows (mặc định standardRows()), opts.missingImages: số hình cuối cùng KHÔNG tạo trên Drive (mặc định 1),
 * opts.setSettings (mặc định true): ghi KHO_CAU_HOI_ID / THU_MUC_HINH_KHO_ID vào CaiDat.
 */
function install(g, opts = {}) {
  const rows = opts.rows || standardRows();
  const khoId = opts.khoId || 'KHO_GIA_' + Math.random().toString(36).slice(2, 8);
  g._addSpreadsheet(khoId, {
    'Kho câu hỏi': [HEADER].concat(rows),
    'Thống kê': [['Thống kê kho câu hỏi (giả)']],
    'Danh mục chủ đề': [['Lớp', 'Chương', 'Mã chương', 'Bài', 'Mã bài (dùng trong mã câu)']]
  });
  const root = g._drive.addFolder('02. HÌNH VẼ');
  const l12 = g._drive.addFolder('Lớp 12', root);
  const deep = g._drive.addFolder('HINH_VE_Lop12_lan1', l12);
  const l11 = g._drive.addFolder('Lớp 11', root);
  const names = rows.filter((r) => /^Có/.test(r[15])).map((r) => r[0] + '.png');
  const missing = opts.missingImages == null ? 1 : opts.missingImages;
  const created = names.slice(0, names.length - missing);
  const originals = {};
  created.forEach((n) => { originals[n] = g._drive.addFile(n, /^L11/.test(n) ? l11 : deep); });
  if (opts.setSettings !== false) setSetting(g, { KHO_CAU_HOI_ID: khoId, THU_MUC_HINH_KHO_ID: opts.noFolder ? '' : root });
  return { khoId, folderId: root, rows, imageNames: names, missingImages: names.slice(names.length - missing), originals };
}

/** Ghi thẳng vào trang CaiDat của shim (thêm dòng nếu thiếu) và xóa đệm. */
function setSetting(g, kv) {
  const data = g._sheets.CaiDat._data();
  Object.keys(kv).forEach((k) => {
    const r = data.find((x) => x[0] === k);
    if (r) r[1] = kv[k]; else data.push([k, kv[k], '']);
  });
  Object.keys(g._cache).forEach((k) => { if (/CaiDat/.test(k)) delete g._cache[k]; });
}

module.exports = { HEADER, row, standardRows, bigRows, install, setSetting };
