// Bộ sinh file mẫu cho kiểm thử độc lập Pha 3 (người kiểm thử) — tự viết theo đặc tả, không dùng make-docx.js của người làm.
// Sinh .docx (OMML, OLE, đánh số tự động, hình inline/anchor/VML, bảng), .xlsx (SheetJS), .csv trong bộ nhớ.
// Nội dung đề do người kiểm thử tự soạn (không lấy từ đề thật).
//   const M = require('./fixtures/pha3-kt-make')(LIBS_DIR);  → M.docx({...}) trả Promise<Buffer>
const path = require('path');
const zlib = require('zlib');

module.exports = function make(LIBS) {
  const JSZip = require(path.join(LIBS, 'jszip'));
  const XLSX = require(path.join(LIBS, 'xlsx'));

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
    'xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
    'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ' +
    'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
    'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" ' +
    'xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"';

  // ---- Đoạn / chữ ----
  const t = (s) => `<w:r><w:t xml:space="preserve">${esc(s)}</w:t></w:r>`;
  const tb = (s) => `<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${esc(s)}</w:t></w:r>`;
  const p = (...runs) => `<w:p>${runs.join('')}</w:p>`;
  const pText = (line) => p(t(line));
  const pNum = (numId, ...runs) => `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="${numId}"/></w:numPr></w:pPr>${runs.join('')}</w:p>`;

  // ---- OMML ----
  const mr = (s, plain) => `<m:r>${plain ? '<m:rPr><m:sty m:val="p"/></m:rPr>' : ''}<m:t xml:space="preserve">${esc(s)}</m:t></m:r>`;
  const me = (...x) => `<m:e>${x.join('')}</m:e>`;
  const O = {
    r: mr,
    txt: (s) => mr(s, true),
    f: (num, den) => `<m:f><m:num>${num}</m:num><m:den>${den}</m:den></m:f>`,
    sup: (e, s) => `<m:sSup><m:e>${e}</m:e><m:sup>${s}</m:sup></m:sSup>`,
    sub: (e, s) => `<m:sSub><m:e>${e}</m:e><m:sub>${s}</m:sub></m:sSub>`,
    subsup: (e, b, s) => `<m:sSubSup><m:e>${e}</m:e><m:sub>${b}</m:sub><m:sup>${s}</m:sup></m:sSubSup>`,
    sqrt: (e) => `<m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/><m:e>${e}</m:e></m:rad>`,
    root: (n, e) => `<m:rad><m:deg>${n}</m:deg><m:e>${e}</m:e></m:rad>`,
    d: (e, beg, end) => `<m:d>${beg ? `<m:dPr><m:begChr m:val="${beg}"/><m:endChr m:val="${end}"/></m:dPr>` : ''}<m:e>${e}</m:e></m:d>`,
    nary: (chr, sub, sup, e) => `<m:nary><m:naryPr>${chr ? `<m:chr m:val="${chr}"/>` : ''}<m:limLoc m:val="undOvr"/></m:naryPr><m:sub>${sub}</m:sub><m:sup>${sup}</m:sup><m:e>${e}</m:e></m:nary>`,
    func: (name, e) => `<m:func><m:fName>${mr(name, true)}</m:fName><m:e>${e}</m:e></m:func>`,
    acc: (chr, e) => `<m:acc><m:accPr><m:chr m:val="${chr}"/></m:accPr><m:e>${e}</m:e></m:acc>`,
    bar: (e) => `<m:bar><m:barPr><m:pos m:val="top"/></m:barPr><m:e>${e}</m:e></m:bar>`,
    matrix: (rows) => `<m:m>${rows.map((r) => `<m:mr>${r.map((c) => me(mr(c))).join('')}</m:mr>`).join('')}</m:m>`
  };
  const math = (inner) => `<m:oMath>${inner}</m:oMath>`;

  // ---- Hình ----
  let docPr = 1;
  const drawingInline = (rid) => `<w:r><w:drawing><wp:inline><wp:extent cx="952500" cy="714375"/><wp:docPr id="${docPr++}" name="Hinh"/>` +
    `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="h"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${rid}"/></pic:blipFill><pic:spPr/></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
  const drawingAnchor = (rid) => `<w:r><w:drawing><wp:anchor behindDoc="0" allowOverlap="1" simplePos="0" relativeHeight="1" locked="0" layoutInCell="1">` +
    `<wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="column"><wp:posOffset>0</wp:posOffset></wp:positionH><wp:positionV relativeFrom="paragraph"><wp:posOffset>0</wp:posOffset></wp:positionV>` +
    `<wp:extent cx="952500" cy="714375"/><wp:wrapSquare wrapText="bothSides"/><wp:docPr id="${docPr++}" name="HinhNoi"/>` +
    `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="h"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${rid}"/></pic:blipFill><pic:spPr/></pic:pic></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r>`;
  const vml = (rid) => `<w:r><w:pict><v:shape id="_x0000_s${docPr++}" type="#_x0000_t75" style="width:75pt;height:56pt"><v:imagedata r:id="${rid}" o:title=""/></v:shape></w:pict></w:r>`;
  const ole = (rid) => `<w:r><w:object w:dxaOrig="1200" w:dyaOrig="600"><v:shape id="_x0000_i${docPr++}" type="#_x0000_t75" style="width:60pt;height:30pt" o:ole=""><v:imagedata r:id="${rid}" o:title=""/></v:shape>` +
    `<o:OLEObject Type="Embed" ProgID="Equation.DSMT4" ShapeID="_x0000_i1" DrawAspect="Content" ObjectID="_1" r:id="${rid}ole"/></w:object></w:r>`;

  // ---- Bảng ----
  const table = (rows) => `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/></w:tblPr><w:tblGrid>${rows[0].map(() => '<w:gridCol w:w="1500"/>').join('')}</w:tblGrid>` +
    rows.map((r) => `<w:tr>${r.map((c) => `<w:tc><w:tcPr><w:tcW w:w="1500" w:type="dxa"/></w:tcPr>${p(t(c))}</w:tc>`).join('')}</w:tr>`).join('') + '</w:tbl>';

  // ---- PNG tối giản (màu đặc) ----
  function crc32(buf) {
    let c, crc = 0xffffffff;
    for (let n = 0; n < buf.length; n++) {
      c = (crc ^ buf[n]) & 0xff;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crc = (crc >>> 8) ^ c;
    }
    return (crc ^ 0xffffffff) >>> 0;
  }
  function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  }
  function png(w, h, rgb) {
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
    const raw = Buffer.alloc((w * 3 + 1) * h);
    for (let y = 0; y < h; y++) {
      raw[y * (w * 3 + 1)] = 0;
      for (let x = 0; x < w; x++) {
        const o = y * (w * 3 + 1) + 1 + x * 3;
        raw[o] = (rgb[0] + x) & 255; raw[o + 1] = (rgb[1] + y) & 255; raw[o + 2] = rgb[2];
      }
    }
    return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
  }
  const fakeEmf = () => Buffer.concat([Buffer.from([1, 0, 0, 0, 0x6c, 0, 0, 0]), Buffer.alloc(100, 7)]);
  const fakeWmf = () => Buffer.concat([Buffer.from([0xd7, 0xcd, 0xc6, 0x9a]), Buffer.alloc(100, 9)]);

  // ---- Đóng gói .docx ----
  // media: [{ rid, file: 'image1.png', data: Buffer }]; ole: [{rid}] (thêm quan hệ oleObject); numbering: chuỗi numbering.xml
  async function docx({ body, media = [], oles = [], numbering = null }) {
    const z = new JSZip();
    const exts = new Set(media.map((m) => m.file.split('.').pop().toLowerCase()));
    const mimes = { png: 'image/png', jpeg: 'image/jpeg', jpg: 'image/jpeg', emf: 'image/x-emf', wmf: 'image/x-wmf', gif: 'image/gif' };
    z.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
      [...exts].map((e) => `<Default Extension="${e}" ContentType="${mimes[e] || 'application/octet-stream'}"/>`).join('') +
      (oles.length ? '<Default Extension="bin" ContentType="application/vnd.openxmlformats-officedocument.oleObject"/>' : '') +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      (numbering ? '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>' : '') +
      '</Types>');
    z.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    const rels = media.map((m) => `<Relationship Id="${m.rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${m.file}"/>`)
      .concat(oles.map((o) => `<Relationship Id="${o.rid}ole" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/oleObject" Target="embeddings/oleObject${o.rid}.bin"/>`))
      .concat(numbering ? ['<Relationship Id="rIdNum" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>'] : []);
    z.file('word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + rels.join('') + '</Relationships>');
    z.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${body}<w:sectPr/></w:body></w:document>`);
    media.forEach((m) => z.file('word/media/' + m.file, m.data));
    oles.forEach((o) => z.file(`word/embeddings/oleObject${o.rid}.bin`, Buffer.alloc(64, 1)));
    if (numbering) z.file('word/numbering.xml', numbering);
    return z.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  }

  // numbering.xml: abstract = [{ id, fmt, lvlText }], nums = [{ numId, abs, restart }]
  function numberingXml(abstracts, nums) {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering ${NS}>` +
      abstracts.map((a) => `<w:abstractNum w:abstractNumId="${a.id}"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="${a.fmt}"/><w:lvlText w:val="${esc(a.lvlText)}"/><w:lvlJc w:val="left"/></w:lvl></w:abstractNum>`).join('') +
      nums.map((n) => `<w:num w:numId="${n.numId}"><w:abstractNumId w:val="${n.abs}"/>${n.restart ? '<w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride>' : ''}</w:num>`).join('') +
      '</w:numbering>';
  }

  // ---- Đề chữ thường 28 câu (18 – 4 – 6) tự soạn ----
  function exam28Lines() {
    const L = ['PHẦN I. Trắc nghiệm nhiều phương án lựa chọn'];
    const keys = 'ABCDABCDABCDABCDAB';
    for (let i = 1; i <= 18; i++) {
      L.push(`Câu ${i}. Một vật chuyển động thẳng đều với tốc độ ${i} m/s. Quãng đường vật đi được trong ${i + 1} s là bao nhiêu?`);
      L.push(`A. ${i * (i + 1)} m.`, `B. ${i * (i + 1) + 1} m.`, `C. ${i * (i + 1) + 2} m.`, `D. ${i * (i + 1) + 3} m.`);
      L.push(`Đáp án: ${keys[i - 1]}`);
    }
    L.push('PHẦN II. Trắc nghiệm đúng sai');
    const ds = ['ĐSĐS', 'ĐĐSS', 'SSĐĐ', 'ĐĐĐS'];
    for (let i = 1; i <= 4; i++) {
      L.push(`Câu ${i}. Xét một lượng khí lí tưởng thứ ${i} được nén đẳng nhiệt.`);
      L.push(`a) Áp suất của khối khí ${i} tăng.`, `b) Nhiệt độ của khối khí ${i} tăng.`, `c) Thể tích của khối khí ${i} giảm.`, `d) Mật độ phân tử khí ${i} giảm.`);
      L.push(`Đáp án: ${ds[i - 1]}`);
    }
    L.push('PHẦN III. Trắc nghiệm trả lời ngắn');
    const tl = ['2,5', '12', '0,75', '300', '-4', '1,2'];
    for (let i = 1; i <= 6; i++) {
      L.push(`Câu ${i}. Tính đại lượng số ${i} theo đơn vị của đề bài (kết quả làm tròn).`);
      L.push(`Đáp án: ${tl[i - 1]}`);
      L.push(`Lời giải: Thay số vào công thức được ${tl[i - 1]}.`);
    }
    return L;
  }

  // ---- 20 công thức OMML + LaTeX kỳ vọng (người kiểm thử tự viết, phong cách kho: T_{1} = 300\ \text{K}) ----
  const F = O;
  const FORMULAS = [
    { id: 'phân số lồng', omml: F.r('f=') + F.f(F.r('1'), F.f(F.r('1'), F.sub(F.r('d'), F.r('1'))) + F.r('+') + F.f(F.r('1'), F.sub(F.r('d'), F.r('2')))),
      tex: 'f = \\frac{1}{\\frac{1}{d_{1}} + \\frac{1}{d_{2}}}' },
    { id: 'mũ âm 10^{-5} + đơn vị', omml: F.r('q=2.') + F.sup(F.r('10'), F.r('-5')) + F.r(' ') + F.txt('C'), tex: 'q = 2.10^{-5}\\ \\text{C}' },
    { id: 'căn bậc hai', omml: F.r('v=') + F.sqrt(F.r('2gh')), tex: 'v = \\sqrt{2gh}' },
    { id: 'căn bậc ba', omml: F.r('a=') + F.root(F.r('3'), F.r('V')), tex: 'a = \\sqrt[3]{V}' },
    { id: 'ngoặc tròn lớn quanh phân số', omml: F.r('p=') + F.d(F.f(F.r('m'), F.r('V'))) + F.r('RT'), tex: 'p = \\left( \\frac{m}{V} \\right)RT' },
    { id: 'ngoặc vuông', omml: F.d(F.r('x+1'), '[', ']'), tex: '\\left[ x + 1 \\right]' },
    { id: 'Delta', omml: F.r('ΔU=A+Q'), tex: '\\Delta U = A + Q' },
    { id: 'omega, pi', omml: F.r('ω=2πf'), tex: '\\omega = 2\\pi f' },
    { id: 'lambda', omml: F.r('λ=') + F.f(F.r('v'), F.r('f')), tex: '\\lambda = \\frac{v}{f}' },
    { id: 'hàm cos + phi + ngoặc', omml: F.r('x=A') + F.func('cos', F.d(F.r('ωt+φ'))), tex: 'x = A\\cos\\left( \\omega t + \\varphi \\right)' },
    { id: 'đơn vị \\text{K}', omml: F.sub(F.r('T'), F.r('1')) + F.r('=300 ') + F.txt('K'), tex: 'T_{1} = 300\\ \\text{K}' },
    { id: 'đơn vị m/s', omml: F.r('v=5 ') + F.txt('m/s'), tex: 'v = 5\\ \\text{m/s}' },
    { id: 'vector', omml: F.acc('⃗', F.r('F')) + F.r('=m') + F.acc('⃗', F.r('a')), tex: '\\vec{F} = m\\vec{a}' },
    { id: 'độ C', omml: F.r('t=27°') + F.txt('C'), tex: 't = 27^\\circ\\text{C}' },
    { id: 'chỉ số dưới + mũ', omml: F.subsup(F.r('x'), F.r('1'), F.r('2')) + F.r('+') + F.sup(F.r('y'), F.r('2')), tex: 'x_{1}^{2} + y^{2}' },
    { id: 'tổng', omml: F.r('F=') + F.nary('∑', F.r('i=1'), F.r('n'), F.sub(F.r('F'), F.r('i'))), tex: 'F = \\sum_{i = 1}^{n}F_{i}' },
    { id: 'tích phân', omml: F.r('A=') + F.nary(null, F.r('0'), F.r('1'), F.r('Fdx')), tex: 'A = \\int_{0}^{1}Fdx' },
    { id: 'nhân chấm, nhân chéo, xấp xỉ', omml: F.r('F≈6·') + F.sup(F.r('10'), F.r('3')) + F.r('×2'), tex: 'F \\approx 6 \\cdot 10^{3} \\times 2' },
    { id: 'so sánh ≤ ≥ ≠ →', omml: F.r('0≤x≤1, y≥0, z≠0, A→B'), tex: '0 \\leq x \\leq 1,\\ y \\geq 0,\\ z \\neq 0,\\ A \\rightarrow B' },
    { id: 'gạch trên (bar) + mũ ^', omml: F.bar(F.r('v')) + F.r('=') + F.f(F.r('s'), F.r('t')) + F.r(', ') + F.acc('̂', F.r('n')), tex: '\\overline{v} = \\frac{s}{t},\\ \\hat{n}' }
  ];

  // ---- Bảng tính (TC-3.8) ----
  const SHEET_ROWS = [
    ['TN', 'Đơn vị của áp suất trong hệ SI là', 'Pa', 'atm', 'mmHg', 'bar', 'A', 'Khí lí tưởng', 'NB', 'Pascal là đơn vị SI', '', '', ''],
    ['DS', 'Xét quá trình đẳng tích của khí lí tưởng', 'Áp suất tỉ lệ thuận nhiệt độ tuyệt đối', 'Thể tích tăng', 'Khối lượng không đổi', 'Mật độ tăng', 'ĐSĐS', 'Khí lí tưởng', 'TH', '', '', '', ''],
    ['TL', 'Nén đẳng nhiệt từ 10 lít xuống 4 lít, áp suất tăng bao nhiêu lần?', '', '', '', '', '2,5', 'Khí lí tưởng', 'VD', 'p2/p1 = V1/V2', '', '0,1', ''],
    ['TN', 'Công thức $p V = nRT$ là phương trình', 'Clapeyron', 'Boyle', 'Charles', 'Gay-Lussac', 'A', '', '', '', '0,5', '', '']
  ];
  const SHEET_HEADER = ['Loại', 'Nội dung', 'A', 'B', 'C', 'D', 'Đáp án', 'Chủ đề', 'Mức độ', 'Lời giải', 'Điểm', 'Sai số', 'Hình ảnh'];
  function xlsx(rows) {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Cau hoi');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }
  function csv(rows, sep = ',') {
    const q = (c) => { c = String(c); return /[",;\n\t]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; };
    return Buffer.from('\ufeff' + rows.map((r) => r.map(q).join(sep)).join('\r\n'), 'utf8');
  }
  const tsv = (rows) => rows.map((r) => r.join('\t')).join('\n');

  return { esc, t, tb, p, pText, pNum, O, math, drawingInline, drawingAnchor, vml, ole, table, png, fakeEmf, fakeWmf, docx, numberingXml,
    exam28Lines, FORMULAS, SHEET_ROWS, SHEET_HEADER, xlsx, csv, tsv, XLSX, JSZip };
};
