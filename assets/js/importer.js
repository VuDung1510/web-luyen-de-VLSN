/* Nhập câu hỏi nhanh: dán từ Excel/Google Sheets (TSV) hoặc dán văn bản đề từ Word */
(function (root) {
  'use strict';

  /** Tách dữ liệu dán từ bảng tính (tab), hỗ trợ ô có xuống dòng trong dấu ngoặc kép */
  function parseTsv(text) {
    const rows = [];
    let row = [], cell = '', q = false;
    const s = String(text || '').replace(/\r\n?/g, '\n');
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (q) {
        if (c === '"' && s[i + 1] === '"') { cell += '"'; i++; }
        else if (c === '"') q = false;
        else cell += c;
      } else if (c === '"' && cell === '') q = true;
      else if (c === '\t') { row.push(cell); cell = ''; }
      else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.filter((r) => r.some((x) => String(x).trim() !== ''));
  }

  const DEFAULT_COLS = ['loai', 'noiDung', 'A', 'B', 'C', 'D', 'dapAn', 'chuDe', 'mucDo', 'loiGiai', 'diem', 'saiSo', 'hinhAnh'];
  const HEADER_RULES = [
    ['loai', /^lo[aạ]i/i], ['noiDung', /n[ộo]i\s*dung|c[âa]u\s*h[ỏo]i|đ[ềe]\s*b[àa]i/i], ['dapAn', /đ[áa]p\s*[áa]n|đ[áa]p\s*s[ốo]|^key$/i],
    ['chuDe', /ch[ủu]\s*đ[ềe]/i], ['mucDo', /m[ứu]c\s*đ[ộo]/i], ['loiGiai', /l[ờo]i\s*gi[ảa]i|h[ưu][ớo]ng\s*d[ẫa]n/i],
    ['diem', /^đi[ểe]m/i], ['saiSo', /sai\s*s[ốo]/i], ['hinhAnh', /h[ìi]nh/i], ['phan', /^ph[ầa]n/i],
    ['A', /^(a|pa\s*a|phương án a)$/i], ['B', /^(b|pa\s*b|phương án b)$/i], ['C', /^(c|pa\s*c|phương án c)$/i], ['D', /^(d|pa\s*d|phương án d)$/i]
  ];

  function fromTsv(text) {
    const rows = parseTsv(text);
    if (!rows.length) return { questions: [], warnings: ['Không có dữ liệu.'] };
    let cols = DEFAULT_COLS;
    const first = rows[0].map((x) => String(x).trim());
    const mapped = first.map((h) => { const r = HEADER_RULES.find((x) => x[1].test(h)); return r ? r[0] : null; });
    if (mapped.filter(Boolean).length >= 3) { cols = mapped; rows.shift(); }
    const questions = rows.map((r) => {
      const q = {};
      cols.forEach((k, i) => { if (k) q[k] = String(r[i] == null ? '' : r[i]).trim(); });
      q.loai = normType(q.loai, q);
      return q;
    });
    return { questions, warnings: [] };
  }

  function normType(t, q) {
    const s = String(t || '').toUpperCase().replace(/Đ/g, 'D').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z]/g, '');
    if (['DS', 'DUNGSAI', 'TF'].includes(s)) return 'DS';
    if (['TL', 'TLN', 'TRALOINGAN', 'SHORT'].includes(s)) return 'TL';
    if (['TN', 'TRACNGHIEM', 'MCQ'].includes(s)) return 'TN';
    // tự đoán
    const key = String(q && q.dapAn || '').toUpperCase().replace(/Đ/g, 'D').replace(/\s/g, '');
    if (/^[DS]{4}$/.test(key)) return 'DS';
    if (/^[ABCD]$/.test(key) && q.A) return 'TN';
    return q && q.A ? 'TN' : 'TL';
  }

  /**
   * Đọc văn bản đề (dán từ Word). Hỗ trợ:
   *   PHẦN I / PHẦN II / PHẦN III          → loại câu mặc định TN / DS / TL
   *   Câu 1. nội dung…                       → bắt đầu câu mới
   *   A. …  B. …  C. …  D. …  (cùng dòng hoặc mỗi dòng 1 phương án; *B. = đáp án đúng)
   *   a) … b) … c) … d) …     (Đúng/Sai; thêm (Đ) hoặc (S) ở cuối ý để ghi đáp án)
   *   Đáp án: B  |  Đáp án: ĐSĐS  |  Đáp số: 12,5
   *   Lời giải: …  (các dòng sau thuộc lời giải đến câu tiếp theo)
   *   BẢNG ĐÁP ÁN: 1.B 2.C 3.A …  (đặt cuối, có thể kèm PHẦN I/II/III)
   */
  function fromText(text) {
    const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
    const qs = [];
    const warnings = [];
    let part = 0, cur = null, mode = 'body', inKey = false, keyPart = 0;
    const keyMap = {};
    const partOf = (s) => {
      const m = s.match(/^\s*PH[ẦÀAẦ]N\s+(III|II|I|3|2|1)\b/i);
      if (!m) return 0;
      return { I: 1, II: 2, III: 3, 1: 1, 2: 2, 3: 3 }[m[1].toUpperCase()];
    };
    const push = () => { if (cur) qs.push(cur); cur = null; };

    for (let raw of lines) {
      const line = raw.replace(/ /g, ' ').trimEnd();
      const t = line.trim();
      if (!t) { if (cur && mode === 'sol') cur.loiGiai += '\n'; continue; }

      if (/^(B[ẢA]NG\s+)?Đ[ÁA]P\s+[ÁA]N\s*:?\s*$/i.test(t) || /^B[ẢA]NG\s+Đ[ÁA]P\s+[ÁA]N/i.test(t)) { push(); inKey = true; keyPart = part; }
      const p = partOf(t);
      if (p) { if (inKey) keyPart = p; else { push(); part = p; } continue; }
      if (inKey) {
        const re = /(?:C[âa]u\s*)?(\d+)\s*[.:)\-]\s*([ĐDSABCđds]{1,4}(?=\s|$|[,;|])|[-+]?\d+(?:[.,]\d+)?)/g;
        let m;
        while ((m = re.exec(t))) keyMap[(keyPart || 0) + ':' + m[1]] = m[2];
        continue;
      }

      const qm = t.match(/^C[âa]u\s*(\d+)\s*[.:)]?\s*(?:\((?:[^)]*)\)\s*)?(.*)$/i);
      if (qm) {
        push();
        cur = { num: +qm[1], phan: part || 0, noiDung: qm[2] || '', A: '', B: '', C: '', D: '', dapAn: '', loiGiai: '', _ds: false, _tn: false };
        mode = 'body';
        continue;
      }
      if (!cur) continue;

      const am = t.match(/^(Đ[áa]p\s*[áa]n|ĐA|Đ[áa]p\s*s[ốo]|Ch[ọo]n)\s*[:.]?\s*(.+)$/i);
      if (am && mode !== 'sol') {
        cur.dapAn = am[2].trim().replace(/[.。]$/, '');
        const sm = cur.dapAn.match(/^(\S+)\s*[.;]?\s*(L[ờo]i\s*gi[ảa]i|HD|Gi[ảa]i)\s*[:.]?\s*(.*)$/i);
        if (sm) { cur.dapAn = sm[1]; cur.loiGiai = sm[3]; mode = 'sol'; }
        continue;
      }
      const lm = t.match(/^(L[ờo]i\s*gi[ảa]i|H[ưu][ớo]ng\s*d[ẫa]n(\s*gi[ảa]i)?|HDG|HD|Gi[ảa]i)\s*[:.]\s*(.*)$/i);
      if (lm) { mode = 'sol'; cur.loiGiai = (cur.loiGiai ? cur.loiGiai + '\n' : '') + lm[3]; continue; }
      if (mode === 'sol') { cur.loiGiai += (cur.loiGiai && !cur.loiGiai.endsWith('\n') ? '\n' : '') + t; continue; }

      const dm = t.match(/^([a-d])\s*[).]\s*(.*)$/);
      if (dm && (dm[1] === 'a' || cur._ds)) {
        cur._ds = true;
        cur[dm[1].toUpperCase()] = dm[2].trim();
        continue;
      }

      const opts = splitOptions(t);
      if (opts) {
        cur._tn = true;
        opts.forEach((o) => { cur[o.k] = o.v; if (o.star) cur.dapAn = o.k; });
        continue;
      }
      // dòng tiếp theo của nội dung / phương án cuối cùng
      if (cur._ds) { const last = ['D', 'C', 'B', 'A'].find((k) => cur[k]); if (last) cur[last] += ' ' + t; }
      else if (cur._tn) { const last = ['D', 'C', 'B', 'A'].find((k) => cur[k]); if (last) cur[last] += ' ' + t; }
      else cur.noiDung += (cur.noiDung ? '\n' : '') + t;
    }
    push();

    const out = qs.map((q, i) => {
      let loai = q._ds ? 'DS' : q._tn ? 'TN' : q.phan === 2 ? 'DS' : q.phan === 1 ? 'TN' : 'TL';
      if (!q.dapAn) {
        // bảng đáp án có chia PHẦN thì khớp theo (phần, số câu); không chia phần thì khớp theo số câu
        const k = keyMap[(q.phan || 0) + ':' + q.num] || keyMap['0:' + q.num];
        if (k) q.dapAn = k;
      }
      if (loai === 'DS') {
        // đáp án ghi cuối mỗi ý: "(Đ)" / "(S)"
        const marks = ['A', 'B', 'C', 'D'].map((k) => {
          const mk = String(q[k]).match(/\s*[([]\s*(Đ|S|Đúng|Sai)\s*[)\]]\s*$/i);
          if (!mk) return '';
          q[k] = q[k].slice(0, mk.index).trim();
          return /^(Đ|Đúng)$/i.test(mk[1]) ? 'Đ' : 'S';
        });
        if (!q.dapAn && marks.every(Boolean)) q.dapAn = marks.join('');
      }
      if (loai === 'TN') q.dapAn = String(q.dapAn).toUpperCase().replace(/[^ABCD]/g, '').charAt(0);
      if (loai === 'DS') q.dapAn = String(q.dapAn).toUpperCase().replace(/Đ/g, 'D').replace(/[^DS]/g, '').replace(/D/g, 'Đ');
      if (!q.dapAn) warnings.push('Câu ' + (i + 1) + ' (số ' + q.num + ' trong văn bản): chưa tìm thấy đáp án.');
      return {
        loai, phan: q.phan || (loai === 'TN' ? 1 : loai === 'DS' ? 2 : 3), noiDung: q.noiDung.trim(),
        A: q.A, B: q.B, C: q.C, D: q.D, dapAn: q.dapAn, loiGiai: q.loiGiai.trim()
      };
    });
    if (!out.length) warnings.push('Không tìm thấy câu hỏi nào. Mỗi câu cần bắt đầu bằng "Câu 1.", "Câu 2:"…');
    return { questions: out, warnings };
  }

  /** "A. 1 m/s  B. 2 m/s  C. 3 m/s  D. 4 m/s" → [{k:'A',v:'1 m/s'}, …] (chỉ khi phương án theo đúng thứ tự) */
  function splitOptions(t) {
    const re = /(^|\s)(\*?)([A-D])\s*[.)]\s+/g;
    const marks = [];
    let m;
    while ((m = re.exec(t))) marks.push({ k: m[3], star: !!m[2], start: m.index + m[1].length, end: re.lastIndex });
    if (!marks.length || marks[0].start !== 0) return null;
    const seq = [];
    let expect = marks[0].k;
    for (const mk of marks) { if (mk.k === expect) { seq.push(mk); expect = String.fromCharCode(expect.charCodeAt(0) + 1); } }
    return seq.map((mk, i) => ({ k: mk.k, star: mk.star, v: t.slice(mk.end, i + 1 < seq.length ? seq[i + 1].start : t.length).trim() }));
  }

  const api = { parseTsv, fromTsv, fromText, splitOptions };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Importer = api;
})(typeof window !== 'undefined' ? window : this);
