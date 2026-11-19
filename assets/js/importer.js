/* Nhập câu hỏi nhanh: dán từ Excel/Google Sheets (TSV) hoặc dán văn bản đề từ Word */
(function (root) {
  'use strict';

  /** Tách dữ liệu dán từ bảng tính (tab), hỗ trợ ô có xuống dòng trong dấu ngoặc kép */
  function parseTsv(text, delim) {
    const D = delim || '\t';
    const rows = [];
    let row = [], cell = '', q = false;
    const s = String(text || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (q) {
        if (c === '"' && s[i + 1] === '"') { cell += '"'; i++; }
        else if (c === '"') q = false;
        else cell += c;
      } else if (c === '"' && cell === '') q = true;
      else if (c === D) { row.push(cell); cell = ''; }
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

  /** CSV (Excel lưu "CSV UTF-8"): tự nhận dấu phân cách , ; hoặc tab ở dòng đầu (ngoài dấu ngoặc kép) */
  function parseCsv(text) {
    const s = String(text || '').replace(/^\uFEFF/, '');
    const first = [];
    let q = false;
    for (let i = 0; i < s.length && (q || (s[i] !== '\n' && s[i] !== '\r')); i++) {
      if (s[i] === '"') q = !q; else if (!q) first.push(s[i]);
    }
    const cnt = (c) => first.filter((x) => x === c).length;
    const delim = [['\t', cnt('\t')], [';', cnt(';')], [',', cnt(',')]].sort((a, b) => b[1] - a[1])[0];
    return parseTsv(s, delim[1] ? delim[0] : ',');
  }

  function fromTsv(text) { return fromRows(parseTsv(text)); }
  function fromCsv(text) { return fromRows(parseCsv(text)); }

  /** Mảng hàng (từ TSV, CSV hoặc trang tính .xlsx) → câu hỏi, theo mẫu cột DEFAULT_COLS hoặc hàng tiêu đề */
  function fromRows(input) {
    const rows = (input || []).map((r) => (r || []).map((x) => (x == null ? '' : String(x))))
      .filter((r) => r.some((x) => x.trim() !== ''));
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
    // K-1: hàng không có nội dung (sai thứ tự cột / sai mẫu) → cảnh báo, không âm thầm ra câu trống
    const warnings = [];
    questions.forEach((q, i) => { if (!String(q.noiDung || '').trim() && !String(q.hinhAnh || '').trim()) warnings.push('Câu ' + (i + 1) + ': không có nội dung — kiểm tra thứ tự cột (Loại | Nội dung | A | B | C | D | Đáp án …).'); });
    return { questions, warnings };
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
   * Thêm (Pha 3, mẫu "Form VLSN cho file Word đề" và đề có lời giải):
   *   PHẦN 1. TRẮC NGHIỆM NHIỀU LỰA CHỌN / PHẦN 2. … / PHẦN 3. …  (số Ả Rập)
   *   PHẦN IV (tự luận) → bỏ qua kèm cảnh báo (web chưa chấm tự luận)
   *   "Đáp án của em: ……" (dòng để học sinh ghi) → bỏ qua
   *   "---------- HẾT ----------" → hết đề; sau đó "Câu n" (nếu có) là lời giải của câu n đã có
   *   Câu 1. [NB] / [B] / [H] / [VD] / [VDC] … → mức độ; a) [NB] … → bỏ nhãn
   *   Lời giải: Chọn B. → đáp án B; lời giải Đúng/Sai "a) Đúng – …" → đáp án ĐS…; "Đáp số: 0,5 Hz" → 0,5
   */
  function fromText(text) {
    const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
    const qs = [];
    const warnings = [];
    let part = 0, cur = null, mode = 'body', inKey = false, keyPart = 0, ended = false, sawP4 = false;
    let solPart = 0, solIdx = -1; // phần lời giải sau HẾT: PHẦN ghi rõ (nếu có) và vị trí câu vừa ghép
    const keyMap = {};
    const partOf = (s) => {
      const m = s.match(/^\s*PH[ẦÀAẦ]N\s+(IV|III|II|I|4|3|2|1)\b/i);
      if (!m) return 0;
      return { I: 1, II: 2, III: 3, IV: 4, 1: 1, 2: 2, 3: 3, 4: 4 }[m[1].toUpperCase()];
    };
    const LEVEL = { NB: 'NB', B: 'NB', TH: 'TH', H: 'TH', VD: 'VD', VDC: 'VDC' };
    const LEVEL_RE = /^\[\s*(NB|TH|VDC|VD|B|H)\s*\]\s*\.?\s*/i;
    const push = () => { if (cur && !cur._old) qs.push(cur); cur = null; };

    for (let raw of lines) {
      const line = raw.replace(/ /g, ' ').trimEnd();
      const t = line.trim();
      if (!t) { if (cur && mode === 'sol') cur.loiGiai += '\n'; continue; }

      // dòng để học sinh tự ghi đáp án (Phần III của mẫu VLSN) — không phải đáp án
      if (/^Đ[áa]p\s*[áa]n\s+c[ủu]a\s+em\b/i.test(t)) continue;
      // "---------- HẾT ----------": hết phần đề
      if (/^[-–—_=.*\s]*H[ẾE]T[-–—_=.*\s]*$/i.test(t) && /[-–—_=.*]/.test(t)) { push(); ended = true; solPart = 0; solIdx = -1; mode = 'body'; continue; }
      // "HƯỚNG DẪN GIẢI" / "LỜI GIẢI CHI TIẾT" (dòng riêng, sau phần đề): các "Câu n" tiếp theo là lời giải
      if (qs.length + (cur ? 1 : 0) > 0 && /^(H[ƯU][ỚO]NG\s+D[ẪA]N(\s+GI[ẢA]I)?|L[ỜO]I\s+GI[ẢA]I(\s+CHI\s+TI[ẾE]T)?|Đ[ÁA]P\s+[ÁA]N\s+V[ÀA]\s+H[ƯU][ỚO]NG\s+D[ẪA]N(\s+GI[ẢA]I)?)\s*:?\s*$/i.test(t) && t === t.toUpperCase()) {
        push(); inKey = false; ended = true; solPart = 0; solIdx = -1; mode = 'body'; continue;
      }
      if (/^(B[ẢA]NG\s+)?Đ[ÁA]P\s+[ÁA]N\s*:?\s*$/i.test(t) || /^B[ẢA]NG\s+Đ[ÁA]P\s+[ÁA]N/i.test(t)) { push(); inKey = true; keyPart = part; }
      const p = partOf(t);
      if (p) { if (inKey) keyPart = p; else if (ended) { push(); solPart = p; solIdx = -1; } else { push(); part = p; if (p === 4) sawP4 = true; } continue; }
      if (inKey) {
        const re = /(?:C[âa]u\s*)?(\d+)\s*[.:)\-]\s*([ĐDSABCđds]{1,4}(?=\s|$|[,;|])|[-+]?\d+(?:[.,]\d+)?)/g;
        let m;
        while ((m = re.exec(t))) keyMap[(keyPart || 0) + ':' + m[1]] = m[2];
        continue;
      }

      const qm = t.match(/^C[âa]u\s*(\d+)\s*[.:)]?\s*(?:\((?:[^)]*)\)\s*)?(.*)$/i);
      if (qm) {
        push();
        if (ended) {
          // sau "HẾT": phần hướng dẫn giải, "Câu n" là lời giải của câu n đã đọc
          // có "PHẦN …" trong phần lời giải: khớp (phần, số câu). Không có: ghép theo thứ tự — câu đầu tiên có số n
          // nằm SAU câu vừa ghép (đề đánh số lại từ 1 ở mỗi phần thì lần lặp sau thuộc phần sau)
          const n0 = +qm[1];
          let idx = solPart ? qs.findIndex((q) => q.num === n0 && q.phan === solPart) : qs.findIndex((q, j) => j > solIdx && q.num === n0);
          if (idx < 0 && !solPart) idx = qs.findIndex((q) => q.num === n0);
          const old = idx >= 0 ? qs[idx] : null;
          if (old) {
            solIdx = idx;
            cur = old; cur._old = true; mode = 'sol';
            const rest = (qm[2] || '').replace(LEVEL_RE, '').trim();
            if (rest) cur.loiGiai = (cur.loiGiai ? cur.loiGiai + '\n' : '') + rest;
          }
          continue;
        }
        let body = qm[2] || '', lv = '';
        const lm0 = body.match(LEVEL_RE);
        if (lm0) { lv = LEVEL[lm0[1].toUpperCase()]; body = body.slice(lm0[0].length); }
        cur = { num: +qm[1], phan: part || 0, noiDung: body, A: '', B: '', C: '', D: '', dapAn: '', loiGiai: '', mucDo: lv, _ds: false, _tn: false };
        mode = 'body';
        continue;
      }
      if (!cur) continue;
      if (cur._old && mode === 'sol') {
        const am2 = t.match(/^(Đ[áa]p\s*[áa]n|ĐA|Đ[áa]p\s*s[ốo])\s*[:.]?\s*(.+)$/i);
        if (am2 && !cur.dapAn) { cur.dapAn = am2[2].trim().replace(/[.。]$/, ''); cur._solKey = true; }
        const lm2 = t.match(/^(L[ờo]i\s*gi[ảa]i|H[ưu][ớo]ng\s*d[ẫa]n(\s*gi[ảa]i)?|HDG|HD|Gi[ảa]i)\s*[:.]\s*(.*)$/i);
        const line = lm2 ? lm2[3] : t;
        if (line) cur.loiGiai += (cur.loiGiai && !cur.loiGiai.endsWith('\n') ? '\n' : '') + line;
        continue;
      }

      // "Chọn" chỉ là đáp án khi theo sau là đúng một chữ A–D (tránh nhầm câu dẫn "Chọn phát biểu đúng…")
      // "Chọn B" / "Chọn: B." (có thể kèm "Lời giải: …" phía sau); "Chọn câu đúng." là câu dẫn, giữ trong nội dung
      let am = t.match(/^(Đ[áa]p\s*[áa]n|ĐA|Đ[áa]p\s*s[ốo])\s*[:.]?\s*(.+)$/i);
      if (!am) {
        const cm0 = t.match(/^([Cc]h[ọo]n)\s*[:.]?\s*([A-D])(?![\p{L}\d])\s*[.,;)]?\s*(.*)$/u);
        if (cm0 && (!cm0[3] || /^(L[ờo]i\s*gi[ảa]i|HD|Gi[ảa]i)\b/i.test(cm0[3]))) am = [t, cm0[1], cm0[2] + (cm0[3] ? ' ' + cm0[3] : '')];
      }
      if (am && mode !== 'sol') {
        cur.dapAn = am[2].trim().replace(/[.。]$/, '');
        const sm = cur.dapAn.match(/^(\S+)\s*[.;]?\s*(L[ờo]i\s*gi[ảa]i|HD|Gi[ảa]i)\s*[:.]?\s*(.*)$/i);
        if (sm) { cur.dapAn = sm[1]; cur.loiGiai = sm[3]; mode = 'sol'; }
        continue;
      }
      const lm = t.match(/^(L[ờo]i\s*gi[ảa]i|H[ưu][ớo]ng\s*d[ẫa]n(\s*gi[ảa]i)?|HDG|HD|Gi[ảa]i)\s*[:.]\s*(.*)$/i);
      if (lm) { mode = 'sol'; cur.loiGiai = (cur.loiGiai ? cur.loiGiai + '\n' : '') + lm[3]; continue; }
      if (mode === 'sol') {
        // "Đáp số: 0,5 Hz" / "Đáp án: B" nằm trong lời giải: ghi đáp án (nếu chưa có), vẫn giữ trong lời giải
        const am3 = t.match(/^(Đ[áa]p\s*[áa]n|ĐA|Đ[áa]p\s*s[ốo])\s*[:.]\s*(.+)$/i);
        if (am3 && !cur.dapAn) cur.dapAn = am3[2].trim().replace(/[.。]$/, '');
        cur.loiGiai += (cur.loiGiai && !cur.loiGiai.endsWith('\n') ? '\n' : '') + t;
        continue;
      }

      const dm = t.match(/^([a-d])\s*[).]\s*(.*)$/);
      if (dm && (dm[1] === 'a' || cur._ds)) {
        cur._ds = true;
        cur[dm[1].toUpperCase()] = dm[2].trim().replace(LEVEL_RE, '');
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

    const p4 = qs.filter((q) => q.phan === 4).length;
    if (sawP4 || p4) warnings.push('Bỏ qua Phần IV (tự luận)' + (p4 ? ': ' + p4 + ' câu' : '') + '. Web chưa chấm tự luận.');
    const out = qs.filter((q) => q.phan !== 4).map((q, i) => {
      let loai = q._ds ? 'DS' : q._tn ? 'TN' : q.phan === 2 ? 'DS' : q.phan === 1 ? 'TN' : 'TL';
      if (q._solKey && q.dapAn) {
        // đáp án lấy từ phần lời giải sau "HẾT": phải hợp loại câu, không thì bỏ và cảnh báo (tránh ghép lệch phần)
        const v = String(q.dapAn).trim();
        const fit = loai === 'TN' ? /^[A-D]\.?$/i.test(v) : loai === 'DS' ? /^[ĐDS]{4}$/i.test(v.replace(/[\s,;.-]/g, '')) : /\d/.test(v) && !/^[A-D]\.?$/i.test(v);
        if (!fit) { warnings.push('Câu ' + (i + 1) + ' (số ' + q.num + ' trong văn bản): đáp án trong lời giải "' + v + '" không khớp loại câu — đã bỏ, hãy kiểm tra lời giải có gắn đúng câu không.'); q.dapAn = ''; }
      }
      if (!q.dapAn) {
        // bảng đáp án có chia PHẦN thì khớp theo (phần, số câu); không chia phần thì khớp theo số câu
        const k = keyMap[(q.phan || 0) + ':' + q.num] || keyMap['0:' + q.num];
        if (k) q.dapAn = k;
      }
      if (!q.dapAn && loai === 'TN') {
        // "Lời giải: Chọn B."
        const cm = String(q.loiGiai).match(/^\s*(?:Ch[ọo]n|Đ[áa]p\s*[áa]n)\s*[:.]?\s*([ABCD])(?![\p{L}\d])/iu);
        if (cm) q.dapAn = cm[1].toUpperCase();
      }
      if (!q.dapAn && loai === 'DS') {
        // lời giải từng ý: "a) Đúng – …", "b) Sai – …"
        const got = {};
        String(q.loiGiai).split('\n').forEach((ln) => {
          const mm = ln.trim().match(/^([a-d])\s*[).]\s*(Đúng|Sai|Đ|S)(?=[\s,.;:–—\-)]|$)/i);
          if (mm && !got[mm[1].toLowerCase()]) got[mm[1].toLowerCase()] = /^(Đ|Đúng)$/i.test(mm[2]) ? 'Đ' : 'S';
        });
        if (['a', 'b', 'c', 'd'].every((k) => got[k])) q.dapAn = ['a', 'b', 'c', 'd'].map((k) => got[k]).join('');
      }
      if (loai === 'TL' && q.dapAn) {
        // "Đáp số: $0,5$ Hz" → 0,5 (giữ nguyên nếu đã là số / nhiều số cách "|")
        const raw = String(q.dapAn).trim();
        const plain = raw.replace(/\$/g, '').replace(/\\[,;: ]/g, ' ').replace(/\{,\}/g, ',').trim();
        if (!/^[-+]?\d+(?:[.,]\d+)?(\s*\|\s*[-+]?\d+(?:[.,]\d+)?)*$/.test(plain)) {
          const nm = plain.match(/^(?:[^\d=]*=\s*)?([-+−]?\d+(?:[.,]\d+)?)(?![\d.,]*\s*[.,]?\d)/);
          if (nm) {
            q.dapAn = nm[1].replace('−', '-');
            warnings.push('Câu ' + (i + 1) + ' (số ' + q.num + ' trong văn bản): đáp số "' + raw + '" — đã lấy số ' + q.dapAn + ', hãy kiểm tra lại.');
          }
          else if (!/^[-+]?\d+(?:[.,]\d+)?(\s*\|\s*[-+]?\d+(?:[.,]\d+)?)*$/.test(String(q.dapAn))) {
            warnings.push('Câu ' + (i + 1) + ' (số ' + q.num + ' trong văn bản): đáp án Phần III "' + raw + '" không phải số — máy không chấm được, hãy sửa (vd 1,6e-19 hoặc 0,5).');
          }
        } else q.dapAn = plain;
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
        A: q.A, B: q.B, C: q.C, D: q.D, dapAn: q.dapAn, loiGiai: q.loiGiai.trim(), mucDo: q.mucDo || '', num: q.num
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

  const api = { parseTsv, parseCsv, fromTsv, fromCsv, fromRows, fromText, splitOptions, DEFAULT_COLS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Importer = api;
})(typeof window !== 'undefined' ? window : this);
