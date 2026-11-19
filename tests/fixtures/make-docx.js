// Dựng file .docx / .xlsx mẫu bằng JSZip / SheetJS trên Node (dữ liệu tự soạn, không lấy từ đề thật).
//   const M = require('./fixtures/make-docx')(LIBS_DIR);
//   const buf = await M.docx([M.p('Câu 1. …'), M.p(['Có ', M.math(M.mr('x'))]), M.tbl([['a','b'],['1','2']])], { media, numbering });
// Khối: M.p(nội dung, {numId, ilvl, style}) ; nội dung là chuỗi hoặc mảng: chuỗi (một run, '\t' → w:tab),
//   M.math(xml OMML bên trong m:oMath), M.img(rId, {anchor}), M.vml(rId), M.ole(), M.raw(xml).
// M.png(w, h, [r,g,b]) → Buffer PNG hợp lệ (để trình duyệt vẽ được).
const path = require('path');
const zlib = require('zlib');

module.exports = function (LIBS_DIR) {
  const JSZip = require(path.join(LIBS_DIR, 'jszip'));
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ' +
    'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" ' +
    'xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"';

  const run = (t) => '<w:r><w:rPr><w:rFonts w:ascii="Cambria Math"/></w:rPr>' + String(t).split('\t').map((x) => (x ? '<w:t xml:space="preserve">' + esc(x) + '</w:t>' : '')).join('<w:tab/>') + '</w:r>';
  const item = (x) => (typeof x === 'string' ? run(x) : x.xml);
  const M = {
    raw: (xml) => ({ xml }),
    run: (t) => ({ xml: run(t) }),
    br: () => ({ xml: '<w:r><w:br/></w:r>' }),
    // OMML
    math: (inner) => ({ xml: '<m:oMath>' + inner + '</m:oMath>' }),
    mr: (t, plain) => '<m:r>' + (plain === 'nor' ? '<m:rPr><m:nor/><m:sty m:val="p"/></m:rPr>' : plain ? '<m:rPr><m:sty m:val="p"/></m:rPr>' : '') + '<w:rPr><w:rFonts w:ascii="Cambria Math"/></w:rPr><m:t xml:space="preserve">' + esc(t) + '</m:t></m:r>',
    f: (num, den) => '<m:f><m:fPr><m:ctrlPr/></m:fPr><m:num>' + num + '</m:num><m:den>' + den + '</m:den></m:f>',
    sup: (e, s) => '<m:sSup><m:e>' + e + '</m:e><m:sup>' + s + '</m:sup></m:sSup>',
    sub: (e, s) => '<m:sSub><m:sSubPr><m:ctrlPr/></m:sSubPr><m:e>' + e + '</m:e><m:sub>' + s + '</m:sub></m:sSub>',
    subsup: (e, b, s) => '<m:sSubSup><m:e>' + e + '</m:e><m:sub>' + b + '</m:sub><m:sup>' + s + '</m:sup></m:sSubSup>',
    rad: (e, deg) => '<m:rad><m:radPr>' + (deg ? '' : '<m:degHide m:val="1"/>') + '</m:radPr><m:deg>' + (deg || '') + '</m:deg><m:e>' + e + '</m:e></m:rad>',
    d: (e, beg, end) => '<m:d><m:dPr>' + (beg != null ? '<m:begChr m:val="' + esc(beg) + '"/>' : '') + (end != null ? '<m:endChr m:val="' + esc(end) + '"/>' : '') + '</m:dPr><m:e>' + e + '</m:e></m:d>',
    acc: (e, chr) => '<m:acc><m:accPr><m:chr m:val="' + chr + '"/></m:accPr><m:e>' + e + '</m:e></m:acc>',
    bar: (e, pos) => '<m:bar><m:barPr><m:pos m:val="' + (pos || 'top') + '"/></m:barPr><m:e>' + e + '</m:e></m:bar>',
    func: (name, e) => '<m:func><m:funcPr/><m:fName>' + M.mr(name, true) + '</m:fName><m:e>' + e + '</m:e></m:func>',
    nary: (chr, sub, sup, e) => '<m:nary><m:naryPr><m:chr m:val="' + chr + '"/>' + (sub ? '' : '<m:subHide m:val="1"/>') + (sup ? '' : '<m:supHide m:val="1"/>') + '</m:naryPr><m:sub>' + (sub || '') + '</m:sub><m:sup>' + (sup || '') + '</m:sup><m:e>' + e + '</m:e></m:nary>',
    pre: (sub, sup, e) => '<m:sPre><m:sPrePr/><m:sub>' + sub + '</m:sub><m:sup>' + sup + '</m:sup><m:e>' + e + '</m:e></m:sPre>',
    matrix: () => '<m:m><m:mPr/><m:mr><m:e>' + M.mr('1') + '</m:e><m:e>' + M.mr('0') + '</m:e></m:mr><m:mr><m:e>' + M.mr('0') + '</m:e><m:e>' + M.mr('1') + '</m:e></m:mr></m:m>',
    // hình
    img: (rid, opt) => {
      opt = opt || {};
      const g = '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="1" name="h"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="' + rid + '"/></pic:blipFill><pic:spPr/></pic:pic></a:graphicData></a:graphic>';
      const wrap = opt.anchor ? '<wp:anchor behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1" relativeHeight="1" simplePos="0" distT="0" distB="0" distL="0" distR="0"><wp:simplePos x="0" y="0"/><wp:extent cx="952500" cy="952500"/><wp:wrapSquare wrapText="bothSides"/><wp:docPr id="1" name="h"/>' + g + '</wp:anchor>'
        : '<wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="952500" cy="952500"/><wp:docPr id="1" name="h"/>' + g + '</wp:inline>';
      return { xml: '<w:r><w:drawing>' + wrap + '</w:drawing></w:r>' };
    },
    vml: (rid) => ({ xml: '<w:r><w:pict><v:shape id="s1" style="width:60pt;height:40pt" type="#_x0000_t75"><v:imagedata r:id="' + rid + '" o:title=""/></v:shape></w:pict></w:r>' }),
    ole: (rid) => ({ xml: '<w:r><w:object w:dxaOrig="400" w:dyaOrig="300"><v:shape id="o1" style="width:20pt;height:15pt" type="#_x0000_t75"><v:imagedata r:id="' + (rid || 'rIdOle') + '" o:title=""/></v:shape><o:OLEObject Type="Embed" ProgID="Equation.DSMT4" ShapeID="o1" DrawAspect="Content" ObjectID="_1" r:id="rIdOleBin"/></w:object></w:r>' }),
    shape: () => ({ xml: '<w:r><mc:AlternateContent><mc:Choice Requires="wps"><w:drawing><wp:inline><wp:extent cx="1" cy="1"/><wp:docPr id="9" name="v"/><a:graphic><a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"></a:graphicData></a:graphic></wp:inline></w:drawing></mc:Choice><mc:Fallback><w:pict><v:rect/></w:pict></mc:Fallback></mc:AlternateContent></w:r>' }),
    p: (content, opt) => {
      opt = opt || {};
      const parts = Array.isArray(content) ? content : [content];
      const ppr = (opt.style || opt.numId != null) ? '<w:pPr>' + (opt.style ? '<w:pStyle w:val="' + opt.style + '"/>' : '') + (opt.numId != null ? '<w:numPr><w:ilvl w:val="' + (opt.ilvl || 0) + '"/><w:numId w:val="' + opt.numId + '"/></w:numPr>' : '') + '</w:pPr>' : '';
      return { xml: '<w:p>' + ppr + parts.map(item).join('') + '</w:p>' };
    },
    tbl: (rows) => ({ xml: '<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/></w:tblPr>' + rows.map((r) => '<w:tr>' + r.map((c) => '<w:tc><w:tcPr/>' + (Array.isArray(c) ? c : [c]).map((x) => (typeof x === 'string' ? M.p(x).xml : x.xml)).join('') + '</w:tc>').join('') + '</w:tr>').join('') + '</w:tbl>' }),
    /** Văn bản nhiều dòng → mỗi dòng một đoạn */
    lines: (text) => String(text).split('\n').map((l) => M.p(l)),
    /** numbering.xml: levels = [{fmt:'decimal', text:'%1.'}…] cho mỗi abstractNum; nums = [{id, abs, start}] */
    numbering: (abstracts, nums) => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering ' + W + '>' +
      abstracts.map((lv, i) => '<w:abstractNum w:abstractNumId="' + i + '">' + lv.map((l, j) => '<w:lvl w:ilvl="' + j + '"><w:start w:val="' + (l.start || 1) + '"/><w:numFmt w:val="' + l.fmt + '"/><w:lvlText w:val="' + esc(l.text) + '"/></w:lvl>').join('') + '</w:abstractNum>').join('') +
      nums.map((n) => '<w:num w:numId="' + n.id + '"><w:abstractNumId w:val="' + n.abs + '"/>' + (n.start ? '<w:lvlOverride w:ilvl="0"><w:startOverride w:val="' + n.start + '"/></w:lvlOverride>' : '') + '</w:num>').join('') + '</w:numbering>',
    /** media: { rId: { name:'image1.png', data: Buffer } } */
    docx: async (blocks, opt) => {
      opt = opt || {};
      const z = new JSZip();
      const media = opt.media || {};
      z.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="emf" ContentType="image/x-emf"/><Default Extension="wmf" ContentType="image/x-wmf"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
      z.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
      const rels = Object.keys(media).map((id) => '<Relationship Id="' + id + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/' + media[id].name + '"/>').join('');
      z.file('word/_rels/document.xml.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + rels + '<Relationship Id="rIdOleBin" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/oleObject" Target="embeddings/oleObject1.bin"/></Relationships>');
      Object.keys(media).forEach((id) => z.file('word/media/' + media[id].name, media[id].data));
      if (opt.numbering) z.file('word/numbering.xml', opt.numbering);
      if (opt.header) z.file('word/header1.xml', '<?xml version="1.0"?><w:hdr ' + W + '>' + M.p(opt.header).xml + '</w:hdr>');
      const sect = '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/></w:sectPr>';
      z.file('word/document.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document ' + W + '><w:body>' + blocks.map((b) => b.xml).join('') + sect + '</w:body></w:document>');
      return z.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    },
    png: (w, h, rgb) => {
      rgb = rgb || [200, 30, 30];
      const crcTable = [];
      for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0; }
      const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
      const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
      const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
      const raw = Buffer.alloc((w * 3 + 1) * h);
      for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = rgb[0]; raw[o + 1] = (rgb[1] + x) & 255; raw[o + 2] = rgb[2]; } }
      return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
    },
    /** Đề mẫu 28 câu (18–4–6) gõ chữ thường theo quy ước, có đáp án */
    sampleText28: () => {
      const L = ['ĐỀ KIỂM TRA MẪU (tự soạn)', 'PHẦN 1. TRẮC NGHIỆM NHIỀU LỰA CHỌN'];
      for (let i = 1; i <= 18; i++) {
        L.push('Câu ' + i + '. Câu hỏi mẫu số ' + i + ' về chuyển động thẳng đều?');
        if (i % 2) L.push('A. ' + i + ' m/s\tB. ' + (i + 1) + ' m/s\tC. ' + (i + 2) + ' m/s\tD. ' + (i + 3) + ' m/s');
        else { L.push('A. phương án một'); L.push('B. phương án hai'); L.push('C. phương án ba'); L.push('D. phương án bốn'); }
        L.push('Đáp án: ' + 'ABCD'[i % 4]);
      }
      L.push('PHẦN 2. TRẮC NGHIỆM ĐÚNG SAI');
      for (let i = 1; i <= 4; i++) {
        L.push('Câu ' + i + '. Cho một lượng khí mẫu số ' + i + '.');
        ['a', 'b', 'c', 'd'].forEach((k, j) => L.push(k + ') Mệnh đề ' + k + ' của câu ' + i + ' (' + ((i + j) % 2 ? 'S' : 'Đ') + ')'));
      }
      L.push('PHẦN 3. TRẮC NGHIỆM TRẢ LỜI NGẮN');
      for (let i = 1; i <= 6; i++) {
        L.push('Câu ' + i + '. Tính đại lượng mẫu số ' + i + ' (đơn vị chuẩn).');
        L.push('Đáp án của em: …………');
        L.push('Đáp số: ' + i + ',5');
      }
      L.push('---------- HẾT ----------');
      return L.join('\n');
    }
  };
  return M;
};
